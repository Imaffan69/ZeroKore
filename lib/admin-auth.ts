import { cookies } from "next/headers";
import { createHash } from "crypto";

const COOKIE_NAME = "zk_admin_session";
const SALT = "zerokore-admin-v1"; // static salt for password hashing

/**
 * Hash a password for storage in an environment variable.
 * Run once locally:  node -e "require('./lib/admin-auth').hashPassword('YOUR_PASSWORD')"
 */
export function hashPassword(password: string): string {
  return createHash("sha256").update(SALT + password).digest("hex");
}

/** Verify a plaintext password against a stored hash. */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/** Read the admin username from environment. */
export function getAdminUsername(): string {
  return process.env.ADMIN_USERNAME?.trim() || "";
}

/** Read the admin password hash from environment. */
export function getAdminPasswordHash(): string {
  return process.env.ADMIN_PASSWORD_HASH || "";
}

/** Check whether admin auth is configured. */
export function isAdminConfigured(): boolean {
  return Boolean(getAdminUsername()) && Boolean(getAdminPasswordHash());
}

/** Read the admin session cookie. */
export async function getAdminSession(): Promise<{
  username: string;
  authenticated: boolean;
}> {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) return { username: "", authenticated: false };
  try {
    const payload = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
    if (!payload.username || !payload.signed) return { username: "", authenticated: false };
    // Verify the cookie payload is valid (signed with a server secret)
    const expected = createHash("sha256")
      .update(SALT + payload.username + (process.env.ADMIN_SECRET || ""))
      .digest("hex")
      .slice(0, 16);
    if (payload.signature !== expected) return { username: "", authenticated: false };
    return { username: payload.username, authenticated: true };
  } catch {
    return { username: "", authenticated: false };
  }
}

/** Set the admin session cookie. */
export async function setAdminSession(username: string): Promise<void> {
  const secret = process.env.ADMIN_SECRET || "zerokore-admin-secret-change-me";
  const payload = { username, signed: true };
  const signature = createHash("sha256")
    .update(SALT + payload.username + secret)
    .digest("hex")
    .slice(0, 16);
  const value = Buffer.from(JSON.stringify({ ...payload, signature })).toString("base64");
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/kore/admin",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

/** Clear the admin session cookie (logout). */
export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** Return the username to show in the admin panel header, or null if not authenticated. */
export async function getAdminIdentity(): Promise<string | null> {
  const session = await getAdminSession();
  if (!session.authenticated) return null;
  return session.username;
}
