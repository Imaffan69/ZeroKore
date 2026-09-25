import { NextResponse } from "next/server";
import { requireUser, errorResponse } from "@/lib/api-auth";
import { getCreditState } from "@/lib/credits";

export const dynamic = "force-dynamic";

/**
 * Credits snapshot + recent ledger + usage runs for the account area.
 * Everything shown in /account/usage comes from here — real rows only.
 */
export async function GET() {
  try {
    const { supabase, user } = await requireUser();

    const state = await getCreditState(supabase, user.id);

    const [ledger, runs] = await Promise.all([
      supabase
        .from("credit_ledger")
        .select("delta, reason, metadata, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("usage_runs")
        .select("provider, model, prompt_tokens, completion_tokens, credits_charged, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    // Aggregate per-model totals for the usage view.
    const byModel: Record<string, { runs: number; promptTokens: number; completionTokens: number; credits: number }> = {};
    for (const r of runs.data ?? []) {
      const key = `${r.provider ?? "?"} · ${r.model ?? "?"}`;
      byModel[key] ??= { runs: 0, promptTokens: 0, completionTokens: 0, credits: 0 };
      byModel[key].runs += 1;
      byModel[key].promptTokens += r.prompt_tokens ?? 0;
      byModel[key].completionTokens += r.completion_tokens ?? 0;
      byModel[key].credits += r.credits_charged ?? 0;
    }

    return NextResponse.json({
      balance: state.balance,
      dailyAllowance: state.dailyAllowance,
      unlimited: state.unlimited,
      plan: state.plan,
      // True while the platform migration is pending — credits are displayed
      // but not enforced, and the UI says so rather than faking a balance.
      unenforced: state.unenforced === true,
      ledger: ledger.data ?? [],
      runs: runs.data ?? [],
      byModel,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
