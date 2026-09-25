import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Role hierarchy for the hidden admin panel.
 *
 * Rank order (low → high): user < viewer < support < moderator < admin < owner.
 * Owner is the site owner (grants roles, shutdown). Legacy 'admin' rows map
 * onto the same rank. All checks are server-side; client role data is never
 * trusted.
 */

export type Role = "user" | "viewer" | "support" | "moderator" | "admin" | "owner";

export const ROLE_RANK: Record<Role, number> = {
  user: 0,
  viewer: 1,
  support: 2,
  moderator: 3,
  admin: 4,
  owner: 5,
};

export function rankOf(role: string | null | undefined): number {
  if (!role) return ROLE_RANK.user;
  return ROLE_RANK[role as Role] ?? ROLE_RANK.user;
}

export function hasRole(role: string | null | undefined, min: Role): boolean {
  return rankOf(role) >= ROLE_RANK[min];
}

export interface RbacContext {
  role: Role;
  isAdmin: boolean; // admin or owner
  isOwner: boolean;
  isStaff: boolean; // viewer and above — may see staff-only surfaces
}

/**
 * Owner bootstrap from environment.
 *
 * The very first owner cannot be created from inside the app: `profiles` is
 * guarded by a trigger that rejects every role change, and the role column
 * defaults to 'user'. Rather than depending on a one-off SQL edit, the owner
 * account(s) can be declared once in the deployment environment. The email is
 * matched on every authorization read, server-side, and never trusted from the
 * client.
 *
 * Accepts `OWNER_EMAIL` or `OWNER_EMAILS`, comma-separated for several staff
 * accounts (e.g. `me@example.com,ops@example.com`).
 */
export function ownerEmails(): string[] {
  const raw = `${process.env.OWNER_EMAIL ?? ""},${process.env.OWNER_EMAILS ?? ""}`;
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.includes("@") && value.length > 3)
    )
  );
}

/**
 * Staff bootstrap from environment.
 *
 * Owner bootstrap (see ownerEmails) covers the single account that must never
 * lose access. `ADMIN_EMAILS` is the wider list — every address there gets the
 * `admin` rank unless a higher role is already recorded, which makes it
 * possible to hand out staff access before the platform migration has been
 * applied (the `profiles` trigger refuses role writes made by users).
 *
 * Both lists are read server-side only and never trusted from the client.
 */
export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.includes("@") && value.length > 3)
    )
  );
}

export async function getRbac(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  email?: string | null
): Promise<RbacContext> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", userId)
    .maybeSingle();

  let role = (profile?.role as Role) ?? "user";

  // Environment-declared owners always win, so admin access is never lost to a
  // missing database row.
  const boot = ownerEmails();
  let candidate: string | null = null;
  if (boot.length > 0) {
    candidate = (email ?? profile?.email ?? null)?.toString().toLowerCase() ?? null;
    if (!candidate) {
      // Profiles may be missing (trigger not installed yet) — the user's own
      // auth record is still readable with their session.
      try {
        const { data } = await supabase.auth.getUser();
        candidate = data.user?.email?.toLowerCase() ?? null;
      } catch {
        candidate = null;
      }
    }
    if (candidate && boot.includes(candidate)) role = "owner";
  }

  // Wider staff list: never lowers a role, only raises to admin.
  const admins = adminEmails();
  if (admins.length > 0) {
    if (!candidate) {
      candidate =
        (email ?? profile?.email ?? null)?.toString().toLowerCase() ?? null;
    }
    if (candidate && admins.includes(candidate) && rankOf(role) < ROLE_RANK.admin) {
      role = "admin";
    }
  }

  return {
    role,
    isAdmin: rankOf(role) >= ROLE_RANK.admin,
    isOwner: role === "owner",
    isStaff: rankOf(role) >= ROLE_RANK.viewer,
  };
}

export class ForbiddenError extends Error {
  constructor(message = "Not authorized.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Throwing variant for route handlers; caller maps via errorResponse(). */
export async function requireRole(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  min: Role,
  email?: string | null
): Promise<RbacContext> {
  const ctx = await getRbac(supabase, userId, email);
  if (!hasRole(ctx.role, min)) throw new ForbiddenError();
  return ctx;
}

/** Append to the admin audit trail. Best-effort: must never break a request. */
export async function audit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  actorId: string | null,
  action: string,
  targetUserId: string | null = null,
  detail: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supabase.from("admin_audit").insert({
      actor_id: actorId,
      action,
      target_user_id: targetUserId,
      detail,
    });
  } catch {
    // ignore — audit failures must not mask the operation result
  }
}
