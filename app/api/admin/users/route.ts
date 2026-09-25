import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readJson, readString, BadRequestError } from "@/lib/api-auth";
import { requireStaff, adminError, type AdminContext } from "@/lib/admin-guard";
import { hasRole } from "@/lib/rbac";
import { grantCredits } from "@/lib/credits";

/**
 * User management. Admin+ can list/inspect and edit plan/credits/suspend.
 * Role changes are owner-only, and an admin can never act on an equal or
 * higher rank.
 *
 * Reads and writes run with the service client from the admin guard: RLS would
 * otherwise only ever return the caller's own row and silently block updates.
 */
export async function GET(req: Request) {
  try {
    const actor = await requireStaff("admin");
    const db = actor.db;
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const page = Math.max(0, parseInt(url.searchParams.get("page") ?? "0", 10) || 0);
    const pageSize = 25;

    let query = db
      .from("profiles")
      .select("id, email, username, role, plan, credits_override, suspended, mfa_enrolled, created_at")
      .order("created_at", { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (q) query = query.or(`email.ilike.%${q}%,username.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Could not load users." }, { status: 500 });
    return NextResponse.json({ users: data ?? [], page, pageSize });
  } catch (err) {
    return adminError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await requireStaff("admin");
    await applyUserUpdate(actor, req);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return adminError(err);
  }
}

async function applyUserUpdate(actor: AdminContext, req: Request) {
  const db = actor.db;
  const body = await readJson(req);
  const targetId = readString(body, "userId", 100);
  if (!targetId) throw new BadRequestError("Missing userId.");

  const { data: target } = await db
    .from("profiles")
    .select("id, role")
    .eq("id", targetId)
    .maybeSingle();
  if (!target) throw new BadRequestError("User not found.");
  // No acting on equal/higher rank (owner can act on anyone except self).
  if (!actor.isOwner && hasRole(target.role, "admin")) {
    throw new BadRequestError("Only the owner can modify staff accounts.");
  }
  if (targetId === actor.userId && body.suspended === true) {
    throw new BadRequestError("You cannot suspend yourself.");
  }

  const updates: Record<string, unknown> = {};
  if (
    typeof body.plan === "string" &&
    ["free", "plus", "pro", "max", "team", "student"].includes(body.plan)
  ) {
    updates.plan = body.plan;
  }
  if (typeof body.credits_override === "number" && body.credits_override >= 0) {
    updates.credits_override = Math.round(body.credits_override);
  }
  if (typeof body.suspended === "boolean") updates.suspended = body.suspended;
  if (typeof body.role === "string") {
    if (!actor.isOwner) throw new BadRequestError("Only the owner can change roles.");
    if (!["user", "viewer", "support", "moderator", "admin"].includes(body.role)) {
      throw new BadRequestError("Invalid role.");
    }
    updates.role = body.role;
  }
  if (Object.keys(updates).length === 0) throw new BadRequestError("Nothing to update.");

  const { error } = await db.from("profiles").update(updates).eq("id", targetId);
  if (error) {
    // Migration 002 narrows the anti-escalation trigger to *self* changes, so
    // a service-role role update succeeds normally. If we still see the old
    // blanket rejection, the migration has not been applied yet.
    if (typeof updates.role === "string" && /Role changes/i.test(error.message)) {
      throw new BadRequestError(
        "Role changes are blocked by the database. Run supabase/migrations/002_role_guard.sql, then retry."
      );
    }
    throw new Error("Update failed.");
  }

  if (typeof body.grant_credits === "number" && body.grant_credits > 0) {
    await grantCredits(db, targetId, Math.round(body.grant_credits), "admin_grant", {
      grantedBy: actor.userId ?? actor.username,
    });
  }
  await auditAction(db, actor, "update_user", targetId, updates);
}

/** Audit helper — kept module-private (route files may only export handlers). */
async function auditAction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any>,
  actor: AdminContext,
  action: string,
  targetUserId: string | null = null,
  detail: Record<string, unknown> = {}
): Promise<void> {
  try {
    await db.from("admin_audit").insert({
      actor_id: actor.userId,
      actor_label: actor.username,
      action,
      target_user_id: targetUserId,
      detail,
    });
  } catch {
    // audit failures must never mask the operation result
  }
}

