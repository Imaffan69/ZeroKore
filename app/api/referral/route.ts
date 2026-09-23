import { NextResponse } from "next/server";
import { requireUser, errorResponse, readString, BadRequestError } from "@/lib/api-auth";
import { grantCredits } from "@/lib/credits";
import { REFERRAL_BONUS } from "@/lib/plans";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Referral claiming: a new user who signed up with ?ref=<code> claims it once.
 * The referrer earns REFERRAL_BONUS credits; the referred user also gets a
 * small welcome grant. Single-use enforced by the unique constraint on
 * referrals.referred_id and double-checked here.
 *
 * Cross-account reads (referrer lookup by code) and `referrals` writes run
 * with the service client — the session client's RLS can only see the
 * caller's own rows and has no write policy here.
 */
export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    const db = await createServiceClient();
    const body = await req.clone().json().catch(() => ({}));
    const code = readString(body, "code", 60).toLowerCase();
    if (!code) throw new BadRequestError("Missing referral code.");

    // Only claimable once, and only for fresh accounts.
    const { data: profile } = await supabase
      .from("profiles")
      .select("referral_code, created_at")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.referral_code === code) {
      throw new BadRequestError("You cannot claim your own code.");
    }
    const fresh =
      profile?.created_at &&
      Date.now() - new Date(profile.created_at).getTime() < 14 * 24 * 3600 * 1000;
    if (!fresh) throw new BadRequestError("Referrals can only be claimed within two weeks of signup.");

    const { data: existing } = await db
      .from("referrals")
      .select("id")
      .eq("referred_id", user.id)
      .maybeSingle();
    if (existing) throw new BadRequestError("A referral was already claimed for this account.");

    const { data: referrer } = await db
      .from("profiles")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();
    if (!referrer) throw new BadRequestError("That referral code does not exist.");

    const { error } = await db.from("referrals").insert({
      referrer_id: referrer.id,
      referred_id: user.id,
      credits_granted: REFERRAL_BONUS,
    });
    if (error) throw new BadRequestError("Referral already claimed.");

    await grantCredits(db, referrer.id, REFERRAL_BONUS, "referral", {
      referred: user.id,
    });
    await grantCredits(db, user.id, 10, "referral", { via: code });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

/** The caller's own referral code + referral count. */
export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("referral_code, username")
      .eq("id", user.id)
      .maybeSingle();

    let code = profile?.referral_code ?? null;
    if (!code) {
      code = `zk-${(profile?.username ?? user.id.slice(0, 6)).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20)}-${Math.random().toString(36).slice(2, 6)}`;
      await supabase.from("profiles").update({ referral_code: code }).eq("id", user.id);
    }

    const { count } = await supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", user.id);

    return NextResponse.json({ code, referrals: count ?? 0, bonusPerReferral: REFERRAL_BONUS });
  } catch (err) {
    return errorResponse(err);
  }
}
