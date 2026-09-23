import { cookies } from "next/headers";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";

const COOKIE_NAME = "zk_admin_session";
const SALT = "zerokore-admin-v1"; // static salt for password hashing

/** Hash a password for storage. */
export function hashPassword(password: string): string {
  return createHash("sha256").update(SALT + password).digest("hex");
}

/** Verify a plaintext password against a stored hash. */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/** Read the admin username from the database (Supabase). */
export async function adminUsernameFromDb(): Promise<string> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("admin_credentials")
      .select("username")
      .single();
    if (error || !data?.username) return "";
    return data.username.trim();
  } catch {
    return "";
  }
}

/** Read the admin password hash from the database (Supabase). */
export async function adminPasswordHashFromDb(): Promise<string> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("admin_credentials")
      .select("password_hash")
      .single();
    if (error || !data?.password_hash) return "";
    return data.password_hash;
  } catch {
    return "";
  }
}

/** Read the admin username from environment (fallback). */
export function adminUsernameFromEnv(): string {
  return process.env.ADMIN_USERNAME?.trim() || "";
}

/** Read the admin password hash from environment (fallback). */
export function adminPasswordHashFromEnv(): string {
  return process.env.ADMIN_PASSWORD_HASH || "";
}

/** Check whether admin auth is configured (DB first, then env). */
export async function isAdminConfigured(): Promise<boolean> {
  const dbUser = await adminUsernameFromDb();
  const dbHash = await adminPasswordHashFromDb();
  if (dbUser && dbHash) return true;
  return Boolean(adminUsernameFromEnv()) && Boolean(adminPasswordHashFromEnv());
}

/** Get the admin secret (from env or a generated fallback). */
function getAdminSecret(): string {
  return process.env.ADMIN_SECRET || "zerokore-admin-secret-change-me";
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
    // Verify the cookie payload is signed with a server secret
    const expected = createHash("sha256")
      .update(SALT + payload.username + getAdminSecret())
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
  const secret = getAdminSecret();
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

/** Set or update the admin credentials in the database.
 *  Creates the row if it doesn't exist, updates if it does.
 *  Only callable from a trusted API (RLS or service role). */
export async function setAdminCredentials(username: string, passwordHash: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("admin_credentials")
      .upsert({ username: username.trim(), password_hash: passwordHash });
    return !error;
  } catch {
    return false;
  }
}

/** Return the username to show in the admin panel header, or null if not authenticated. */
export async function getAdminIdentity(): Promise<string | null> {
  const session = await getAdminSession();
  if (!session.authenticated) return null;
  return session.username;
}

