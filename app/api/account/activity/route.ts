import { NextResponse } from "next/server";
import { requireUser, errorResponse, readJson, readString } from "@/lib/api-auth";
import { logActivity, type ActivityEvent } from "@/lib/request-info";

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
    // Awaited so the row exists before the client navigates away; still
    // isolated from the user's request outcome by the internal try/catch.
    await logActivity(user.id, event, req, { source: "client" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}