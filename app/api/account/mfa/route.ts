import { NextResponse } from "next/server";
import { requireUser, errorResponse, readJson } from "@/lib/api-auth";
import { logAuthEvent } from "@/lib/request-info";

/**
 * MFA state mirror.
 *
 * Enrollment/verification itself runs through Supabase Auth MFA on the client
 * (auth.mfa.enroll / challenge / verify) — the secure path. This route keeps
 * profiles.mfa_enrolled in sync, records the security event with IP metadata,
 * and reports enrollment status to the account UI.
 */
export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const [{ data: factors }, { data: profile }] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.from("profiles").select("mfa_enrolled").eq("id", user.id).maybeSingle(),
    ]);
    const totp = factors?.totp ?? [];
    return NextResponse.json({
      enrolled: totp.some((f) => f.status === "verified") || profile?.mfa_enrolled === true,
      factors: totp.map((f) => ({ id: f.id, status: f.status, createdAt: f.created_at })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await readJson(req);
    const verified = body.verified === true;

    await supabase
      .from("profiles")
      .update({ mfa_enrolled: verified })
      .eq("id", user.id);
    await logAuthEvent(supabase, user.id, verified ? "mfa_verify" : "mfa_enroll", req);
    return NextResponse.json({ ok: true, enrolled: verified });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    await supabase.from("profiles").update({ mfa_enrolled: false }).eq("id", user.id);
    await logAuthEvent(supabase, user.id, "mfa_enroll", req);
    return NextResponse.json({ ok: true, enrolled: false });
  } catch (err) {
    return errorResponse(err);
  }
}
