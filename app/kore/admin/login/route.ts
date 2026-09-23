import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, setAdminSession, getAdminUsername, getAdminPasswordHash } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  if (!getAdminUsername() || !getAdminPasswordHash()) {
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

  const normalizedUsername = username.trim();

  // Check against the configured admin credentials
  if (normalizedUsername !== getAdminUsername()) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  if (!verifyPassword(password, getAdminPasswordHash())) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  // Success — set the session cookie and let the client redirect
  await setAdminSession(normalizedUsername);
  return NextResponse.json({ ok: true });
}
