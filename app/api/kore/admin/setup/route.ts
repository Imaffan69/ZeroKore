import { NextRequest, NextResponse } from "next/server";
import { hashPassword, setAdminCredentials } from "@/lib/admin-auth";

/**
 * POST /api/kore/admin/setup
 * Sets the admin username + password in the database.
 * Call this once to configure the admin panel.
 * After this, the env vars are no longer needed.
 */
export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { username, password } = body;

  if (!username || typeof username !== "string" || !password || typeof password !== "string") {
    return NextResponse.json(
      { error: "username and password are required." },
      { status: 400 }
    );
  }

  const normalizedUsername = username.trim();
  if (normalizedUsername.length < 1 || normalizedUsername.length > 64) {
    return NextResponse.json(
      { error: "username must be between 1 and 64 characters." },
      { status: 400 }
    );
  }

  if (password.length < 1) {
    return NextResponse.json(
      { error: "password is required." },
      { status: 400 }
    );
  }

  // Generate the hash server-side (same as the local node command)
  const passwordHash = hashPassword(password);

  const ok = await setAdminCredentials(normalizedUsername, passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "Failed to save admin credentials." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, username: normalizedUsername });
}