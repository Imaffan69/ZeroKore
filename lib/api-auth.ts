import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient, createBearerClient } from "@/lib/supabase/server";

/**
 * Shared authentication for route handlers.
 *
 * Every /api/* route re-authenticates server-side; a client-supplied identity
 * is never trusted. Handlers call `requireUser()` and pass any throw through
 * `errorResponse()`, which keeps the status mapping in one place.
 */

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentication required.");
    this.name = "UnauthorizedError";
  }
}

export class MisconfiguredError extends Error {
  constructor(message = "Server misconfigured. Contact the administrator.") {
    super(message);
    this.name = "MisconfiguredError";
  }
}

/** Thrown while maintenance mode is on; mapped to 503 by errorResponse(). */
export class MaintenanceError extends Error {
  constructor(message = "ZeroKore is briefly down for maintenance. Check back soon.") {
    super(message);
    this.name = "MaintenanceError";
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

/** Thrown when a role requirement is not met; mapped to 403 by errorResponse(). */
export class ForbiddenError extends Error {
  constructor(message = "Not authorized.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export interface AuthContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>;
  user: User;
}

export async function requireUser(req?: Request): Promise<AuthContext> {
  let supabase;

  // Non-browser callers (the CLI, the desktop app) authenticate with a
  // Supabase access token instead of the browser cookie session. Supabase
  // verifies the token server-side, so this is the same trust level as a
  // cookie — it just does not need a cookie jar.
  const header = req?.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";

  try {
    supabase = bearer
      ? await createBearerClient(bearer)
      : await createClient();
  } catch {
    throw new MisconfiguredError();
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();

  // Maintenance gate: staff (support and above) pass through.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, suspended")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.suspended) {
    throw new ForbiddenError("This account is suspended.");
  }
  if (profile?.role !== "admin" && profile?.role !== "owner" && profile?.role !== "moderator" && profile?.role !== "support") {
    const { getMaintenanceFlag } = await import("@/lib/flags");
    const flag = await getMaintenanceFlag(supabase);
    if (flag.enabled) throw new MaintenanceError(flag.message || undefined);
  }

  return { supabase, user };
}

/** Map a thrown error onto a user-facing response. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof BadRequestError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err instanceof MaintenanceError) {
    return NextResponse.json({ error: err.message, maintenance: true }, { status: 503 });
  }
  if (err instanceof MisconfiguredError) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  console.log(JSON.stringify({ event: "api_route_failed" }));
  return NextResponse.json(
    { error: "That request could not be completed. Please try again." },
    { status: 500 }
  );
}

/** Parse a JSON body, rejecting anything that is not an object. */
export async function readJson(
  req: Request
): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new BadRequestError("Invalid request body. Expected JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequestError("Invalid request body. Expected a JSON object.");
  }
  return body as Record<string, unknown>;
}

/** Trim a string field, capped, with an empty-string fallback. */
export function readString(
  body: Record<string, unknown>,
  field: string,
  maxLength: number
): string {
  const raw = body[field];
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, maxLength);
}
