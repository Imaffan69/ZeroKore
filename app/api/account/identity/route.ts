import { NextResponse } from "next/server";
import { requireUser, errorResponse } from "@/lib/api-auth";
import { getRbac } from "@/lib/rbac";
import { getProfile } from "@/lib/profiles";

export const dynamic = "force-dynamic";

/**
 * Who am I — the caller's own identity facts: email, username, role and the
 * derived staff flags. Only ever about the signed-in user, so nothing here
 * leaks another account.
 *
 * Reads `profiles.role` (present in the base schema) plus the environment
 * owner bootstrap, which means the staff link works even before the platform
 * migration has been applied.
 */
export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const rbac = await getRbac(supabase, user.id, user.email);
    const profile = await getProfile(supabase, user.id);

    return NextResponse.json({
      id: user.id,
      email: user.email ?? null,
      username: profile?.username ?? null,
      role: rbac.role,
      isAdmin: rbac.isAdmin,
      isOwner: rbac.isOwner,
      isStaff: rbac.isStaff,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
