import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

/**
 * Sign out of the panel. Clears the staff-account cookie and, when the caller
 * was also signed in through Supabase Auth, ends that session too — otherwise
 * the sign-out appeared to do nothing because the Supabase session re-opened
 * the panel on reload.
 */
async function signOut() {
  await clearAdminSession();
  try {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    // no Supabase session (password-only staff) — nothing to clear
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

export async function POST() {
  return signOut();
}

export async function GET(request: Request) {
  await signOut();
  return NextResponse.redirect(new URL("/kore", request.url), {
    headers: NO_STORE,
  });
}
