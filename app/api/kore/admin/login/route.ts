import { NextRequest, NextResponse } from "next/server";
import { signInAdminAccount, setAdminSession, isAdminConfigured } from "@/lib/admin-auth";

/**
 * Staff sign-in for the hidden panel.
 *
 * Accepts any account in `admin_accounts` (the owner plus every account the
 * owner created), and falls back to the legacy credential / env variables so
 * an existing configuration keeps working.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminConfigured())) {
    return NextResponse.json({ error: "Admin auth not configured." }, { status: 503 });
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { username, password } = body;
  if (!username || typeof username !== "string" || !password || typeof password !== "string") {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const result = await signInAdminAccount(username, password);
  if (!result.ok) {
    if (result.reason === "disabled") {
      return NextResponse.json({ error: "That account has been disabled." }, { status: 403 });
    }
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  await setAdminSession({
    username: result.account.username,
    role: result.account.role,
    isOwner: result.account.isOwner,
  });
  return NextResponse.json({
    ok: true,
    role: result.account.role,
    isOwner: result.account.isOwner,
  });
}
