import { randomBytes, createHash } from "crypto";

/**
 * In-memory store for the desktop device sign-in handshake.
 *
 * Codes and grants are random, single-use and expire in minutes, and carry no
 * user data. Keeping them out of the database means a sign-in in flight leaves
 * no row behind and there is no migration to apply. They do not survive a
 * redeploy, which only means someone mid-sign-in restarts it — the right trade
 * for holding nothing durable.
 *
 * This lives outside the route files because a Next.js route may only export
 * its handlers.
 */

const CODE_TTL_MS = 10 * 60 * 1000;
const GRANT_TTL_MS = 5 * 60 * 1000;
const MAX_PENDING = 50;

interface Pending {
  userId: string;
  expiresAt: number;
}

const codes = new Map<string, Pending>();
const grants = new Map<string, Pending>();
let lastSweep = 0;

function sweep() {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const map of [codes, grants]) {
    for (const [key, row] of map) {
      if (row.expiresAt < now) map.delete(key);
    }
  }
}

/** Bound memory if handshakes are started but never completed. */
function bounded(map: Map<string, Pending>, key: string, value: Pending) {
  if (map.size < MAX_PENDING) {
    map.set(key, value);
    return;
  }
  const oldest = [...map.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
  if (oldest) map.delete(oldest[0]);
  map.set(key, value);
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

/** Issue a one-time code. Returns the raw value to hand to the app. */
export function issueCode(): string {
  sweep();
  const code = randomBytes(24).toString("base64url");
  bounded(codes, hash(code), { userId: "", expiresAt: Date.now() + CODE_TTL_MS });
  return code;
}

/** Consume a code exactly once. Returns false if unknown, stale or replayed. */
export function takeCode(code: string): boolean {
  sweep();
  const key = hash(code);
  const row = codes.get(key);
  codes.delete(key);
  return !!row && row.expiresAt >= Date.now();
}

/** Issue a short-lived grant bound to a user. */
export function issueGrant(userId: string): string {
  sweep();
  const grant = randomBytes(32).toString("base64url");
  bounded(grants, grant, { userId, expiresAt: Date.now() + GRANT_TTL_MS });
  return grant;
}

/** Consume a grant exactly once, returning the user it was bound to. */
export function takeGrant(grant: string): string | null {
  sweep();
  const row = grants.get(grant);
  grants.delete(grant);
  if (!row || row.expiresAt < Date.now()) return null;
  return row.userId;
}
