import { NextResponse } from "next/server";
import { requireUser, errorResponse, readJson, readString, BadRequestError } from "@/lib/api-auth";
import { requireRole, audit, hasRole } from "@/lib/rbac";
import { grantCredits } from "@/lib/credits";

/**
 * User management. Admin+ can list/inspect and edit plan/credits/suspend.
 * Role changes are owner-only, and an admin can never act on an equal or
 * higher rank.
 */
export async function GET(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    await requireRole(supabase, user.id, "admin");
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const page = Math.max(0, parseInt(url.searchParams.get("page") ?? "0", 10) || 0);
    const pageSize = 25;

    let query = supabase
      .from("profiles")
      .select("id, email, username, role, plan, credits_override, suspended, mfa_enrolled, created_at")
      .order("created_at", { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (q) query = query.or(`email.ilike.%${q}%,username.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Could not load users." }, { status: 500 });
    return NextResponse.json({ users: data ?? [], page, pageSize });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    const ctx = await requireRole(supabase, user.id, "admin");
    const body = await readJson(req);
    const targetId = readString(body, "userId", 100);
    if (!targetId) throw new BadRequestError("Missing userId.");

    const { data: target } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", targetId)
      .maybeSingle();
    if (!target) throw new BadRequestError("User not found.");
    // No acting on equal/higher rank (owner can act on anyone except self).
    if (!ctx.isOwner && hasRole(target.role, "admin")) {
      throw new BadRequestError("Only the owner can modify staff accounts.");
    }
    if (targetId === user.id && body.suspended === true) {
      throw new BadRequestError("You cannot suspend yourself.");
    }

    const updates: Record<string, unknown> = {};
    if (typeof body.plan === "string" && ["free", "plus", "pro", "max", "team", "student"].includes(body.plan)) {
      updates.plan = body.plan;
    }
    if (typeof body.credits_override === "number" && body.credits_override >= 0) {
      updates.credits_override = Math.round(body.credits_override);
    }
    if (typeof body.suspended === "boolean") updates.suspended = body.suspended;
    if (typeof body.role === "string") {
      if (!ctx.isOwner) throw new BadRequestError("Only the owner can change roles.");
      if (!["user", "viewer", "support", "moderator", "admin"].includes(body.role)) {
        throw new BadRequestError("Invalid role.");
      }
      updates.role = body.role;
    }
    if (Object.keys(updates).length === 0) throw new BadRequestError("Nothing to update.");

    const { error } = await supabase.from("profiles").update(updates).eq("id", targetId);
    if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });

    if (typeof body.grant_credits === "number" && body.grant_credits > 0) {
      await grantCredits(supabase, targetId, Math.round(body.grant_credits), "admin_grant", {
        grantedBy: user.id,
      });
    }
    await audit(supabase, user.id, "update_user", targetId, updates);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
