import { cookies } from "next/headers";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/rbac";

const COOKIE_NAME = "zk_admin_session";
const SALT = "zerokore-admin-v1";

export type { Role };

const ROLES: Role[] = ["viewer", "support", "moderator", "admin", "owner"];

export function isValidRole(value: string): value is Role {
  return ROLES.includes(value as Role);
}

/**
 * Password hashing.
 *
 * Stored format: `scrypt$<salt-hex>$<hash-hex>` (salted, per-account). The
 * legacy `sha256(salt + password)` form written by older setup calls is still
 * accepted on verify so an existing owner credential keeps working, and is
 * upgraded to scrypt on the next successful sign-in.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function legacyHash(password: string): string {
  return createHash("sha256").update(SALT + password).digest("hex");
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  if (stored.startsWith("scrypt$")) {
    const [, saltHex, hashHex] = stored.split("$");
    if (!saltHex || !hashHex) return false;
    const derived = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
    const expected = Buffer.from(hashHex, "hex");
    if (expected.length !== derived.length) return false;
    return timingSafeEqual(derived, expected);
  }
  return stored === legacyHash(password);
}

function isLegacy(stored: string): boolean {
  return Boolean(stored) && !stored.startsWith("scrypt$");
}

export interface AdminAccount {
  id: string;
  username: string;
  role: Role;
  isOwner: boolean;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface AdminAccountRow {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  is_owner: boolean;
  disabled: boolean;
  created_at: string;
  last_login_at: string | null;
}

function toAccount(row: AdminAccountRow): AdminAccount {
  const role = isValidRole(row.role) ? row.role : "viewer";
  return {
    id: row.id,
    username: row.username,
    role: row.is_owner ? "owner" : role,
    isOwner: Boolean(row.is_owner),
    disabled: Boolean(row.disabled),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at ?? null,
  };
}

function service() {
  // Service role is required for cross-account reads; callers handle failure.
  return createServiceClient();
}

export function adminUsernameFromEnv(): string {
  return process.env.ADMIN_USERNAME?.trim() || "";
}

export function adminPasswordHashFromEnv(): string {
  return process.env.ADMIN_PASSWORD_HASH || "";
}

/** Read the legacy single-credential row, if 003 was applied and used. */
async function legacyCredential(): Promise<{ username: string; passwordHash: string } | null> {
  try {
    const db = await service();
    const { data, error } = await db
      .from("admin_credentials")
      .select("username, password_hash")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.username || !data?.password_hash) return null;
    return { username: data.username, passwordHash: data.password_hash };
  } catch {
    return null;
  }
}

/** True when at least one admin account (or a legacy/env credential) exists. */
export async function isAdminConfigured(): Promise<boolean> {
  try {
    const db = await service();
    const { data, error } = await db.from("admin_accounts").select("id").limit(1);
    if (!error && (data ?? []).length > 0) return true;
  } catch {
    // fall through to legacy/env checks
  }
  if (await legacyCredential()) return true;
  return Boolean(adminUsernameFromEnv()) && Boolean(adminPasswordHashFromEnv());
}

export async function listAdminAccounts(): Promise<AdminAccount[]> {
  const db = await service();
  const { data, error } = await db
    .from("admin_accounts")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error("Could not load admin accounts.");
  return ((data ?? []) as AdminAccountRow[]).map(toAccount);
}

export async function findAdminAccount(username: string): Promise<AdminAccountRow | null> {
  const db = await service();
  const { data, error } = await db
    .from("admin_accounts")
    .select("*")
    .eq("username", username.trim())
    .maybeSingle();
  if (error) return null;
  return (data as AdminAccountRow | null) ?? null;
}

/** Owner-only: create a staff account with its own username, password and role. */
export async function createAdminAccount(input: {
  username: string;
  password: string;
  role: Role;
  createdBy: string;
}): Promise<AdminAccount> {
  const db = await service();
  const { data, error } = await db
    .from("admin_accounts")
    .insert({
      username: input.username.trim(),
      password_hash: hashPassword(input.password),
      role: input.role,
      is_owner: false,
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("That username is already taken.");
    throw new Error(error.message || "Could not create the account.");
  }
  return toAccount(data as AdminAccountRow);
}

export async function updateAdminAccount(
  id: string,
  updates: { role?: Role; disabled?: boolean; password?: string }
): Promise<void> {
  const db = await service();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.role) patch.role = updates.role;
  if (typeof updates.disabled === "boolean") patch.disabled = updates.disabled;
  if (updates.password) patch.password_hash = hashPassword(updates.password);
  const { error } = await db.from("admin_accounts").update(patch).eq("id", id);
  if (error) throw new Error(error.message || "Could not update the account.");
}

export async function deleteAdminAccount(id: string): Promise<void> {
  const db = await service();
  const { error } = await db.from("admin_accounts").delete().eq("id", id);
  if (error) throw new Error(error.message || "Could not delete the account.");
}

export type SignInResult =
  | { ok: true; account: AdminAccount }
  | { ok: false; reason: "invalid_credentials" | "disabled" };

/**
 * Verify a username + password against the account table. Falls back to the
 * legacy `admin_credentials` row (treated as the owner) so a site configured
 * before 004 keeps working.
 */
export async function signInAdminAccount(
  username: string,
  password: string
): Promise<SignInResult> {
  const name = username.trim();

  const row = await findAdminAccount(name);
  if (row) {
    if (row.disabled) return { ok: false, reason: "disabled" };
    if (!verifyPassword(password, row.password_hash)) {
      return { ok: false, reason: "invalid_credentials" };
    }
    // Opportunistically upgrade a legacy sha256 hash on successful sign-in.
    if (isLegacy(row.password_hash)) {
      try {
        const db = await service();
        await db
          .from("admin_accounts")
          .update({
            password_hash: hashPassword(password),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      } catch {
        // best effort only — the sign-in already succeeded
      }
    }
    try {
      const db = await service();
      await db
        .from("admin_accounts")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", row.id);
    } catch {
      // non-critical
    }
    return { ok: true, account: toAccount(row) };
  }

  const legacy = await legacyCredential();
  if (legacy && legacy.username === name) {
    if (verifyPassword(password, legacy.passwordHash)) {
      return {
        ok: true,
        account: {
          id: "legacy",
          username: name,
          role: "owner",
          isOwner: true,
          disabled: false,
          createdAt: new Date().toISOString(),
          lastLoginAt: null,
        },
      };
    }
    return { ok: false, reason: "invalid_credentials" };
  }

  if (adminUsernameFromEnv() === name && verifyPassword(password, adminPasswordHashFromEnv())) {
    return {
      ok: true,
      account: {
        id: "env",
        username: name,
        role: "owner",
        isOwner: true,
        disabled: false,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
      },
    };
  }

  return { ok: false, reason: "invalid_credentials" };
}

/** Ensure an owner account exists (used by the one-time setup route). */
export async function ensureOwnerAccount(
  username: string,
  passwordHash: string
): Promise<boolean> {
  const db = await service();
  const { data: existing } = await db.from("admin_accounts").select("id").limit(1);
  if ((existing ?? []).length > 0) {
    // Keep the legacy row in sync so the bootstrap path agrees with accounts.
    await db
      .from("admin_credentials")
      .upsert({ username: username.trim(), password_hash: passwordHash });
    return true;
  }
  const { error } = await db.from("admin_accounts").insert({
    username: username.trim(),
    password_hash: passwordHash,
    role: "owner",
    is_owner: true,
    created_by: "setup",
  });
  if (error) return false;
  await db
    .from("admin_credentials")
    .upsert({ username: username.trim(), password_hash: passwordHash });
  return true;
}

/** Backwards-compatible helper used by the setup route. */
export async function setAdminCredentials(
  username: string,
  passwordHash: string
): Promise<boolean> {
  return ensureOwnerAccount(username, passwordHash);
}

function getAdminSecret(): string {
  return process.env.ADMIN_SECRET || "zerokore-admin-secret-change-me";
}

export interface AdminSession {
  username: string;
  role: Role;
  isOwner: boolean;
  authenticated: boolean;
}

export async function getAdminSession(): Promise<AdminSession> {
  const empty: AdminSession = {
    username: "",
    role: "user",
    isOwner: false,
    authenticated: false,
  };
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) return empty;
  try {
    const payload = JSON.parse(
      Buffer.from(value, "base64").toString("utf8")
    ) as {
      username?: string;
      role?: string;
      isOwner?: boolean;
      signature?: string;
    };
    if (!payload.username || !payload.signature) return empty;
    const expected = createHash("sha256")
      .update(SALT + payload.username + getAdminSecret())
      .digest("hex")
      .slice(0, 16);
    if (payload.signature !== expected) return empty;

    // Re-read the account so a role change or disable takes effect immediately
    // instead of waiting for the cookie to expire.
    const row = await findAdminAccount(payload.username);
    if (row) {
      if (row.disabled) return empty;
      const account = toAccount(row);
      return {
        username: account.username,
        role: account.role,
        isOwner: account.isOwner,
        authenticated: true,
      };
    }
    // Legacy / env owner without an account row.
    return {
      username: payload.username,
      role: isValidRole(payload.role ?? "") ? (payload.role as Role) : "owner",
      isOwner: payload.isOwner ?? true,
      authenticated: true,
    };
  } catch {
    return empty;
  }
}

export async function setAdminSession(account: {
  username: string;
  role: Role;
  isOwner: boolean;
}): Promise<void> {
  const signature = createHash("sha256")
    .update(SALT + account.username + getAdminSecret())
    .digest("hex")
    .slice(0, 16);
  const value = Buffer.from(
    JSON.stringify({
      username: account.username,
      role: account.role,
      isOwner: account.isOwner,
      signature,
    })
  ).toString("base64");
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // Path covers the whole /kore area and the admin APIs under /api/admin.
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getAdminIdentity(): Promise<string | null> {
  const session = await getAdminSession();
  return session.authenticated ? session.username : null;
}

