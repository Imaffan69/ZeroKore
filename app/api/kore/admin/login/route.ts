import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, setAdminSession, adminUsernameFromDb, adminPasswordHashFromDb, adminUsernameFromEnv, adminPasswordHashFromEnv } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const dbUsername = await adminUsernameFromDb();
  const dbHash = await adminPasswordHashFromDb();
  const envUsername = adminUsernameFromEnv();
  const envHash = adminPasswordHashFromEnv();

  const configuredUsername = dbUsername || envUsername;
  const configuredHash = dbHash || envHash;

  if (!configuredUsername || !configuredHash) {
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

  if (normalizedUsername !== configuredUsername) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  if (!verifyPassword(password, configuredHash)) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  await setAdminSession(normalizedUsername);
  return NextResponse.json({ ok: true });
}
