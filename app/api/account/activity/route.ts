import { NextResponse } from "next/server";
import { requireUser, errorResponse, readJson, readString } from "@/lib/api-auth";
import {
  amendActivityIp,
  logActivity,
  resolveIp,
  type ActivityEvent,
} from "@/lib/request-info";

/** Events a client is allowed to record for its own account. */
const ALLOWED: ActivityEvent[] = ["login", "signup"];

/**
 * Record a sign-in that happened outside the OAuth callback.
 *
 * Email + password and username + password authenticate directly against
 * Supabase from the browser, so they never passed through `/auth/callback` —
 * which is exactly why the admin Security tab showed no IP addresses for most
 * users. The client calls this once the session exists, so every sign-in method
 * lands in `login_events` with its IP, location and device.
 *
 * The response reports how the address was resolved. When the deployment sits
 * behind a proxy that does not forward the visitor's address, every request
 * arrives carrying the same infrastructure IP — header parsing alone cannot fix
 * that, so the client is asked for its own view of the address and the result
 * is stored, labelled `client-reported`, instead of one shared value.
 */
export async function POST(req: Request) {
  try {
    const { user } = await requireUser();
    const body = await readJson(req);
    const event = readString(body, "event", 32) as ActivityEvent;
    if (!ALLOWED.includes(event)) {
      return NextResponse.json(
        { error: "Unsupported event." },
        { status: 400 }
      );
    }

    // Read the hint the same way the logger will, so the answer matches exactly
    // what gets written.
    const ipHint = readString(body, "ipHint", 64);
    const before = resolveIp(req, ipHint);

    // Correcting an earlier row rather than inserting a second one keeps every
    // sign-in a single event in the feed.
    const amendEventId = readString(body, "amendEventId", 64);
    if (amendEventId && ipHint) {
      const amended = await amendActivityIp(amendEventId, user.id, req, ipHint, {
        source: "client",
      });
      return NextResponse.json({
        ok: amended,
        ipSource: before.source,
        amended: true,
        needsHint: !amended,
      });
    }

    // Awaited so the row exists before the client navigates away; still
    // isolated from the user's request outcome by the internal try/catch.
    const eventId = await logActivity(user.id, event, req, { source: "client" }, { ipHint });

    return NextResponse.json({
      ok: true,
      eventId,
      ipSource: before.source,
      // True only when nothing routable came from the headers and the client
      // did not supply an address of its own.
      needsHint: !before.source.startsWith("header:") && before.source !== "client-reported",
    });
  } catch (err) {
    return errorResponse(err);
  }
}