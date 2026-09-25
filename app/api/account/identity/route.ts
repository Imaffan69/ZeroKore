import { NextResponse } from "next/server";
import { getSession } from "@/lib/require-session";
import { getRbac } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";

export const dynamic = "force-dynamic";

/**
 * Who am I — the caller's own identity facts: email, username, role, the derived
 * staff flags, and whether the account is suspended. Only ever about the signed-in
 * user, so nothing here leaks another account.
 *
 * This deliberately uses `getSession()` rather than `requireUser()`: `requireUser`
 * throws 403 for a suspended account, so a suspended user could never be *told*
 * they are suspended — they only saw a generic failure. Answering the question
 * here is what lets the login form show "this account is suspended" on the same
 * page instead of bouncing the user around. Authorisation for everything else
 * still happens in `requireUser()`; this route exposes nothing privileged.
 */
export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const rbac = await getRbac(supabase, user.id, user.email);
    const profile = await getProfile(supabase, user.id);

    // Read through the service client: RLS on `profiles` is scoped to the
    // caller's own row, and this must work identically for a banned account.
    let suspended = false;
    try {
      const { createServiceClient } = await import("@/lib/supabase/server");
      const service = await createServiceClient();
      const { data } = await service
        .from("profiles")
        .select("suspended")
        .eq("id", user.id)
        .maybeSingle();
      suspended = (data?.suspended as boolean | null) === true;
    } catch {
      // If the flag cannot be read, fall back to letting them through: the
      // server-side gate in requireUser() remains the actual enforcement point.
      suspended = false;
    }

    return NextResponse.json({
      id: user.id,
      email: user.email ?? null,
      username: profile?.username ?? null,
      role: rbac.role,
      isAdmin: rbac.isAdmin,
      isOwner: rbac.isOwner,
      isStaff: rbac.isStaff,
      suspended,
    });
  } catch (err) {
    // Logged server-side so a real failure is diagnosable in the Vercel logs
    // without leaking internals to the caller.
    console.log(
      JSON.stringify({
        event: "account_identity_failed",
        message: err instanceof Error ? err.message : String(err),
      })
    );
    return NextResponse.json(
      { error: "Could not read your account. Please try again." },
      { status: 500 }
    );
  }
}
