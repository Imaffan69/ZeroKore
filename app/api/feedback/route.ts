import { NextResponse } from "next/server";
import { requireUser, errorResponse, readJson, readString } from "@/lib/api-auth";
import { grantCredits } from "@/lib/credits";
import { FEEDBACK_BONUS } from "@/lib/plans";

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Site-wide feedback ("Need a hand?" modal).
 *
 * Anyone logged in can submit; submissions land in `feedback` and are read in
 * the hidden admin panel. As a thank-you, the first submission each UTC day
 * grants +2 credits.
 */
export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await readJson(req);
    const message = readString(body, "message", 4000);
    const page = readString(body, "page", 200);
    if (message.length < 5) {
      return NextResponse.json({ error: "Tell us a bit more (at least 5 characters)." }, { status: 400 });
    }

    // Reward: once per UTC day.
    const startOfDay = `${todayUTC()}T00:00:00Z`;
    const { count } = await supabase
      .from("credit_ledger")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("reason", "feedback_bonus")
      .gte("created_at", startOfDay);
    const rewarded = (count ?? 0) === 0;

    const { error } = await supabase.from("feedback").insert({
      user_id: user.id,
      message,
      page: page || null,
    });
    if (error) return NextResponse.json({ error: "Could not send feedback. Try again." }, { status: 500 });

    if (rewarded) {
      await grantCredits(supabase, user.id, FEEDBACK_BONUS, "feedback_bonus", {});
    }
    return NextResponse.json({ ok: true, creditsGranted: rewarded ? FEEDBACK_BONUS : 0 });
  } catch (err) {
    return errorResponse(err);
  }
}
