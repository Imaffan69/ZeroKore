import type { SupabaseClient } from "@supabase/supabase-js";
import {
  creditsForTokens,
  dailyCreditsFor,
  STUDENT_BONUS,
  type PlanId,
} from "@/lib/plans";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Server-side credits engine.
 *
 * Balance lives in `credits`, with a lazy UTC-midnight reset: the stored date
 * is compared to today on every read and topped back up when it is stale.
 * Every grant/spend/refund lands in `credit_ledger` so the economy is fully
 * auditable. Admin/owner roles are exempt from spending.
 *
 * These tables are RLS-locked (owner READ only, no client write policies) on
 * purpose — so every operation here runs through a cached *service* client.
 * Passing the caller's session client used to make every write silently fail:
 * balances never moved and the ledger stayed empty. Callers may still pass
 * their session client; it is ignored for platform writes.
 */

export interface CreditState {
  balance: number;
  dailyAllowance: number;
  plan: PlanId;
  unlimited: boolean;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;

let svcPromise: Promise<Db> | null = null;
async function svc(): Promise<Db> {
  if (!svcPromise) {
    svcPromise = createServiceClient() as unknown as Promise<Db>;
  }
  return svcPromise;
}

async function loadProfile(db: Db, userId: string) {
  db = await svc();
  const { data } = await db
    .from("profiles")
    .select("plan, credits_override, role, suspended")
    .eq("id", userId)
    .maybeSingle();
  return {
    plan: (data?.plan as PlanId) ?? "free",
    override: data?.credits_override ?? null,
    role: (data?.role as string) ?? "user",
    suspended: data?.suspended === true,
  };
}

/** Student bonus only counts while a verification is unexpired. */
async function studentBonusActive(db: Db, userId: string): Promise<boolean> {
  db = await svc();
  const { data } = await db
    .from("student_verifications")
    .select("expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return false;
  return new Date(data.expires_at).getTime() > Date.now();
}

async function ledger(
  db: Db,
  userId: string,
  delta: number,
  reason: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  db = await svc();
  await db.from("credit_ledger").insert({
    user_id: userId,
    delta,
    reason,
    metadata,
  });
}

/** Lazy daily reset + balance read. Creates the row if missing. */
export async function getCreditState(db: Db, userId: string): Promise<CreditState> {
  db = await svc();
  const profile = await loadProfile(db, userId);
  const unlimited = profile.role === "admin" || profile.role === "owner";
  const allowance = dailyCreditsFor(profile.plan, profile.override);
  let bonus = 0;
  if (profile.plan !== "team" && (await studentBonusActive(db, userId))) {
    bonus = STUDENT_BONUS;
  }

  const today = todayUTC();
  const { data: row } = await db
    .from("credits")
    .select("balance, last_reset_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) {
    const initial = allowance + bonus;
    await db.from("credits").upsert(
      { user_id: userId, balance: initial, last_reset_date: today },
      { onConflict: "user_id" }
    );
    await ledger(db, userId, initial, "daily_reset", { initial: true });
    return { balance: initial, dailyAllowance: allowance + bonus, plan: profile.plan, unlimited };
  }

  if (row.last_reset_date !== today) {
    const refreshed = allowance + bonus;
    await db
      .from("credits")
      .update({ balance: refreshed, last_reset_date: today, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    await ledger(db, userId, refreshed - row.balance, "daily_reset", {});
    return { balance: refreshed, dailyAllowance: refreshed, plan: profile.plan, unlimited };
  }

  return {
    balance: row.balance ?? 0,
    dailyAllowance: allowance + bonus,
    plan: profile.plan,
    unlimited,
  };
}

export class InsufficientCreditsError extends Error {
  constructor(public required: number, public available: number) {
    super("You are out of credits for today. They reset at midnight UTC.");
    this.name = "InsufficientCreditsError";
  }
}

/** Charge N credits (never below zero). */
export async function chargeCredits(
  db: Db,
  userId: string,
  amount: number,
  reason: string,
  metadata: Record<string, unknown> = {}
): Promise<number> {
  db = await svc();
  const { data: row } = await db
    .from("credits")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();
  const next = Math.max(0, (row?.balance ?? 0) - Math.max(0, amount));
  await db
    .from("credits")
    .update({ balance: next, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (amount !== 0) await ledger(db, userId, -Math.abs(amount), reason, metadata);
  return next;
}

/** Reserve the base cost before an agent run. True cost settled via settleRun(). */
export async function reserveCredits(db: Db, userId: string, estimated: number): Promise<CreditState> {
  db = await svc();
  const state = await getCreditState(db, userId);
  if (state.unlimited) return state;
  if (state.balance < estimated) {
    throw new InsufficientCreditsError(estimated, state.balance);
  }
  await chargeCredits(db, userId, estimated, "agent_run", { phase: "reserve" });
  return state;
}

/** Settle a run with real token counts: adjust reserve → true cost, log usage. */
export async function settleRun(
  db: Db,
  userId: string,
  promptTokens: number,
  completionTokens: number,
  meta: {
    conversationId?: string | null;
    projectId?: string | null;
    provider?: string;
    model?: string;
    reserved?: number;
  } = {}
): Promise<number> {
  db = await svc();
  const trueCost = creditsForTokens(promptTokens, completionTokens);
  const net = trueCost - (meta.reserved ?? 1);
  if (net > 0) {
    await chargeCredits(db, userId, net, "agent_run", { phase: "settle", ...meta });
  } else if (net < 0) {
    await grantCredits(db, userId, -net, "refund", { phase: "settle", ...meta });
  }
  try {
    await db.from("usage_runs").insert({
      user_id: userId,
      conversation_id: meta.conversationId ?? null,
      project_id: meta.projectId ?? null,
      provider: meta.provider ?? null,
      model: meta.model ?? null,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      credits_charged: trueCost,
    });
  } catch {
    // usage logging must never fail the request
  }
  return trueCost;
}

/** Refund a failed reservation. */
export async function refundRun(db: Db, userId: string, amount: number): Promise<void> {
  db = await svc();
  await grantCredits(db, userId, Math.max(0, amount), "refund", { phase: "failure" });
}

/** Grant credits (admin grant, referral, feedback bonus, refund…). */
export async function grantCredits(
  db: Db,
  userId: string,
  amount: number,
  reason: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  db = await svc();
  const { data: row } = await db
    .from("credits")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) {
    await getCreditState(db, userId); // self-heal the row first
  }
  const current = row?.balance ?? 0;
  const next = current + Math.max(0, amount);
  await db
    .from("credits")
    .update({ balance: next, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (amount > 0) await ledger(db, userId, amount, reason, metadata);
}

export { creditsForTokens };

