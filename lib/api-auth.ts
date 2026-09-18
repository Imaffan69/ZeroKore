import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

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

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

export interface AuthContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>;
  user: User;
}

export async function requireUser(): Promise<AuthContext> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    throw new MisconfiguredError();
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
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
