import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsageState } from "@/types";

export const DAILY_LIMIT = 15;

/**
 * The daily cap is switched off for now, so nobody is blocked while the product
 * is still being built out. Requests are still counted — the counter is what
 * makes usage visible in the UI and in Settings — and the limit can be turned
 * back on by flipping this to `true`.
 */
export const ENFORCE_DAILY_LIMIT = false;

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface UsageCheck {
  allowed: boolean;
  isAdmin: boolean;
  usage: UsageState;
}

/**
 * Server-side usage enforcement.
 * 1. Reads the caller's role (never trusts client input).
 * 2. Resets the counter when the stored date is older than today.
 * 3. Normal users: max 15/day. Admins: unlimited.
 * 4. Increments the counter when the request is allowed.
 */
export async function checkAndIncrementUsage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<UsageCheck> {
  // Role comes from the server-side profile row, never the client.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";
  if (isAdmin) {
    return {
      allowed: true,
      isAdmin: true,
      usage: { used: 0, limit: DAILY_LIMIT, unlimited: true },
    };
  }

  const today = todayUTC();

  const { data: row } = await supabase
    .from("user_usage")
    .select("requests_today, last_request_date")
    .eq("user_id", userId)
    .maybeSingle();

  let used = 0;
  if (!row) {
    // Trigger should have created this; self-heal if missing.
    await supabase.from("user_usage").upsert(
      { user_id: userId, requests_today: 0, last_request_date: today },
      { onConflict: "user_id" }
    );
    used = 0;
  } else if (row.last_request_date !== today) {
    await supabase
      .from("user_usage")
      .update({ requests_today: 0, last_request_date: today })
      .eq("user_id", userId);
    used = 0;
  } else {
    used = row.requests_today ?? 0;
  }

  if (ENFORCE_DAILY_LIMIT && used >= DAILY_LIMIT) {
    return {
      allowed: false,
      isAdmin: false,
      usage: { used, limit: DAILY_LIMIT, unlimited: false },
    };
  }

  const next = used + 1;
  await supabase
    .from("user_usage")
    .update({ requests_today: next, last_request_date: today })
    .eq("user_id", userId);

  return {
    allowed: true,
    isAdmin: false,
    usage: { used: next, limit: DAILY_LIMIT, unlimited: !ENFORCE_DAILY_LIMIT },
  };
}

/**
 * Give a counted request back.
 *
 * A call that failed — provider down, credit exhausted, model retired — did not
 * produce anything, so charging the user for it would be wrong. The counter is
 * decremented (never below zero) and the caller keeps the corrected snapshot.
 */
export async function refundUsage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  usage: UsageState
): Promise<UsageState> {
  if (usage.unlimited) return usage;
  const today = todayUTC();
  const current = await getUsageState(supabase, userId);
  // Only refund a request charged today, and only if one is actually pending.
  const next = Math.max(0, Math.min(current.used, usage.used) - 1);
  try {
    await supabase
      .from("user_usage")
      .update({ requests_today: next, last_request_date: today })
      .eq("user_id", userId);
  } catch {
    // Best-effort: a failed refund must never mask the original error.
  }
  return { used: next, limit: DAILY_LIMIT, unlimited: false };
}

/** Read-only usage snapshot for UI display (no increment). */
export async function getUsageState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<UsageState> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.role === "admin") {
    return { used: 0, limit: DAILY_LIMIT, unlimited: true };
  }

  const today = todayUTC();
  const { data: row } = await supabase
    .from("user_usage")
    .select("requests_today, last_request_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row || row.last_request_date !== today) {
    return { used: 0, limit: DAILY_LIMIT, unlimited: !ENFORCE_DAILY_LIMIT };
  }
  return {
    used: row.requests_today ?? 0,
    limit: DAILY_LIMIT,
    unlimited: !ENFORCE_DAILY_LIMIT,
  };
}