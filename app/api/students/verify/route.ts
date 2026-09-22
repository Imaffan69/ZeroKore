import { NextResponse } from "next/server";
import { requireUser, errorResponse, readJson, readString, BadRequestError } from "@/lib/api-auth";
import { audit } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/**
 * Student verification — school-email domain check.
 *
 * We verify the email's domain against academic patterns (.edu and country
 * equivalents), record the verification with its evidence, and grant the +50
 * daily bonus for 365 days (renewable). The verification row is visible to the
 * user and revocable in the admin panel; abuse is auditable because we store
 * the exact email and domain verified.
 */

const ACADEMIC_DOMAIN = /(^|\.)edu(\.[a-z]{2,})?$|(^|\.)ac\.[a-z]{2,}$|(^|\.)edu\.[a-z]{2,}$/i;

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await readJson(req);
    const email = readString(body, "email", 200).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestError("Enter a valid email address.");
    }
    const domain = email.split("@")[1];
    if (!ACADEMIC_DOMAIN.test(domain)) {
      return NextResponse.json(
        {
          error:
            `“${domain}” is not a recognized academic domain (.edu, .edu.xx, .ac.xx). ` +
            "If your school uses another domain, contact us via the feedback widget.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("student_verifications").upsert(
      {
        user_id: user.id,
        email,
        domain,
        verified_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) return NextResponse.json({ error: "Could not save verification." }, { status: 500 });

    await audit(supabase, user.id, "student_verified", user.id, { domain });
    return NextResponse.json({ ok: true, domain });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data } = await supabase
      .from("student_verifications")
      .select("email, domain, verified_at, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();
    const active = data ? new Date(data.expires_at).getTime() > Date.now() : false;
    return NextResponse.json({ verification: data ?? null, active });
  } catch (err) {
    return errorResponse(err);
  }
}
