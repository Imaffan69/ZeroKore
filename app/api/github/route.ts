import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Minimal, safe GitHub account connection surface.
 *
 * GET  → status only: is the OAuth app configured server-side, and has the
 *        signed-in user stored a GitHub token? Never returns token values.
 * DELETE → removes the caller's stored token.
 *
 * The OAuth exchange lives in /api/github/oauth (separate route, below).
 * GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET come from environment variables
 * (Vercel env / GitHub secrets) and never reach the browser.
 */

const TABLE = "github_connections";

export async function GET() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json(
      { error: "Server misconfigured." },
      { status: 500 }
    );
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const configured =
    !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET;

  let connected = false;
  let user_ = null as string | null;
  try {
    const { data } = await supabase
      .from(TABLE)
      .select("github_login")
      .eq("user_id", user.id)
      .maybeSingle();
    connected = !!data?.github_login;
    user_ = data?.github_login ?? null;
  } catch {
    // Table may not exist yet (schema not applied); report honestly.
  }

  return NextResponse.json({
    configured,
    connected,
    user: user_,
  });
}

export async function DELETE() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json(
      { error: "Server misconfigured." },
      { status: 500 }
    );
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }
  try {
    await supabase.from(TABLE).delete().eq("user_id", user.id);
  } catch {
    // Report success anyway: the row is gone or never existed for this user.
  }
  return NextResponse.json({ ok: true });
}
