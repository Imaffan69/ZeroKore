import { NextResponse } from "next/server";
import { getAdminIdentity, isAdminConfigured } from "@/lib/admin-auth";
import { getSession } from "@/lib/require-session";
import { createClient } from "@/lib/supabase/server";
import { getRbac } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET() {
  // Admin password session
  if (await isAdminConfigured()) {
    const identity = await getAdminIdentity();
    if (identity) {
      return NextResponse.json({ username: identity, source: "admin-password" });
    }
  }

  // Supabase staff session
  const user = await getSession();
  if (user) {
    const supabase = await createClient();
    const rbac = await getRbac(supabase, user.id, user.email);
    if (rbac.isStaff) {
      return NextResponse.json({ username: user.email, source: "supabase" });
    }
  }

  return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
}
