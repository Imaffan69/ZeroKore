import { NextResponse } from "next/server";
import { getAdminIdentity, isAdminConfigured } from "@/lib/admin-auth";
import { getSession } from "@/lib/require-session";
import { createClient } from "@/lib/supabase/server";
import { getRbac } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/**
 * Who is signed in for staff purposes.
 *
 * Answers two questions: is there a staff-account session, and is the signed-in
 * ZeroKore account a staff member. Returns `isStaff` explicitly, because the
 * Settings panel gates its admin link on that exact field — a response missing
 * it made the control panel unreachable from Settings for legitimate staff.
 *
 * The same `isStaff` flag is also what keeps the link hidden from ordinary
 * accounts.
 */
export async function GET() {
  // Staff account (username + password) session.
  if (await isAdminConfigured()) {
    const identity = await getAdminIdentity();
    if (identity) {
      return NextResponse.json({
        username: identity,
        source: "admin-password",
        isStaff: true,
      });
    }
  }

  // Supabase staff session.
  const user = await getSession();
  if (user) {
    const supabase = await createClient();
    const rbac = await getRbac(supabase, user.id, user.email);
    if (rbac.isStaff) {
      return NextResponse.json({
        username: user.email,
        source: "supabase",
        isStaff: true,
      });
    }
  }

  // Signed in, but not staff — a 200 so the client can hide the row quietly
  // instead of surfacing an error to an ordinary user.
  return NextResponse.json({
    username: null,
    source: null,
    isStaff: false,
  });
}
