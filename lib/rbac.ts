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
}

export async function getRbac(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<RbacContext> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = (profile?.role as Role) ?? "user";
  return {
    role,
    isAdmin: rankOf(role) >= ROLE_RANK.admin,
    isOwner: role === "owner",
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
  min: Role
): Promise<RbacContext> {
  const ctx = await getRbac(supabase, userId);
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
