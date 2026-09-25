import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminSession, type Role } from "@/lib/admin-auth";
import { getRbac, hasRole } from "@/lib/rbac";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/api-auth";

/**
 * Unified guard for every /api/admin/* route.
 *
 * The panel is reached in two ways and both must work against the same APIs:
 *
 *  1. Staff account sign-in — username + password stored in `admin_accounts`
 *     (owner-created). Authorised by the `zk_admin_session` cookie.
 *  2. Supabase Auth staff — a public account whose `profiles.role` is staff,
 *     or an address listed in OWNER_EMAIL / ADMIN_EMAILS.
 *
 * Previously the routes only accepted (2), so signing in with a username and
 * password produced a panel whose every tab answered 401. The role is now
 * resolved from whichever credential is present.
 */
export interface AdminActor {
  kind: "account" | "supabase";
  username: string;
  userId: string | null;
  role: Role;
  isOwner: boolean;
  /** Service-role client for cross-account reads/writes. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any>;
}

export interface AdminContext extends AdminActor {
  minRole: Role;
}

async function resolveActor(): Promise<AdminActor | null> {
  const db = await createServiceClient();

  // 1. Staff account (admin_accounts) — the owner/staff username + password.
  const session = await getAdminSession();
  if (session.authenticated) {
    return {
      kind: "account",
      username: session.username,
      userId: null,
      role: session.role,
      isOwner: session.isOwner,
      db,
    };
  }

  // 2. Supabase Auth staff.
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const rbac = await getRbac(supabase, user.id, user.email);
      if (rbac.isStaff) {
        return {
          kind: "supabase",
          username: user.email ?? user.id,
          userId: user.id,
          role: rbac.role,
          isOwner: rbac.isOwner,
          db,
        };
      }
    }
  } catch {
    // fall through — unauthenticated
  }

  return null;
}

/** Require any staff member (viewer and above). */
export async function requireStaff(min: Role = "viewer"): Promise<AdminContext> {
  const actor = await resolveActor();
  if (!actor) throw new UnauthorizedError();
  if (!hasRole(actor.role, min)) throw new ForbiddenError("Your staff role cannot open that.");
  return { ...actor, minRole: min };
}

/** Require the owner specifically (site shutdown, staff account management). */
export async function requireOwner(): Promise<AdminContext> {
  const actor = await resolveActor();
  if (!actor) throw new UnauthorizedError();
  if (!actor.isOwner) throw new ForbiddenError("Owner access only.");
  return { ...actor, minRole: "owner" };
}

/** Map a thrown error for an admin route (401 / 403 / 500).
 *
 * Previously anything unrecognised became a generic 500 with no detail, which
 * made real failures (a database trigger rejecting an update, for example)
 * impossible to diagnose from the panel. The message is now surfaced to the
 * caller — it contains no secrets, only the database/route error text.
 */
export function adminError(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  const message = err instanceof Error ? err.message : "";
  if (message) {
    // Log server-side too, so the failure is visible without reproducing it.
    console.error(`[admin] ${message}`);
    // A database trigger or constraint rejection is a client-visible problem
    // (the owner can act on it), not a server fault.
    const isConstraint =
      /not permitted|not allowed|violates|duplicate|already exists|Role changes|Suspension can only|permission denied/i.test(
        message
      );
    return NextResponse.json(
      { error: message.slice(0, 300) },
      { status: isConstraint ? 409 : 500 }
    );
  }
  return NextResponse.json(
    { error: "That request could not be completed. Please try again." },
    { status: 500 }
  );
}
