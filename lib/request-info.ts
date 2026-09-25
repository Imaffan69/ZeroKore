/**
 * Request metadata capture: IP, approximate geo and device info.
 *
 * On Vercel, geo headers (x-vercel-ip-*) are populated by the edge; locally
 * they fall back to x-forwarded-for and unknown geo. Everything captured here
 * is disclosed in the Privacy Policy and Terms (see /privacy, /terms).
 */

export interface RequestInfo {
  ip: string | null;
  country: string | null;
  city: string | null;
  userAgent: string | null;
  device: string;
}

export function extractIp(req: Request): string | null {
  const h = req.headers;
  const candidates = [
    h.get("x-real-ip"),
    h.get("x-forwarded-for")?.split(",")[0]?.trim(),
    h.get("cf-connecting-ip"),
  ];
  for (const c of candidates) {
    if (c && c.length > 0 && c !== "unknown") return c;
  }
  return null;
}

export function extractRequestInfo(req: Request): RequestInfo {
  const h = req.headers;
  const ua = h.get("user-agent");
  return {
    ip: extractIp(req),
    country: h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry"),
    city: h.get("x-vercel-ip-city"),
    userAgent: ua,
    device: describeDevice(ua),
  };
}

function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  const os = /windows/i.test(ua)
    ? "Windows"
    : /macintosh|mac os/i.test(ua)
      ? "macOS"
      : /android/i.test(ua)
        ? "Android"
        : /iphone|ipad|ios/i.test(ua)
          ? "iOS"
          : /linux/i.test(ua)
            ? "Linux"
            : "Unknown OS";
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /chrome\//i.test(ua)
      ? "Chrome"
      : /safari\//i.test(ua)
        ? "Safari"
        : /firefox\//i.test(ua)
          ? "Firefox"
          : "Browser";
  const kind = /mobile/i.test(ua) ? "Mobile" : /tablet|ipad/i.test(ua) ? "Tablet" : "Desktop";
  return `${kind} · ${os} · ${browser}`;
}

export type ActivityEvent =
  | "login"
  | "logout"
  | "signup"
  | "mfa_enroll"
  | "mfa_verify"
  | "password_change"
  | "session_revoke"
  | "agent_run"
  | "file_edit"
  | "project_create"
  | "github_sync"
  | "page_view";

/** Persist an activity event (best-effort; must never break the caller).
 *  Runs with the service client: `login_events` has no client write policy,
 *  so a session-client insert was being silently rejected and history stayed
 *  empty. The `db` argument is kept for call-site compatibility. */
export async function logAuthEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: import("@supabase/supabase-js").SupabaseClient<any>,
  userId: string,
  event: ActivityEvent,
  req: Request
): Promise<void> {
  const info = extractRequestInfo(req);
  try {
    const { createServiceClient } = await import("@/lib/supabase/server");
    const svc = await createServiceClient();
    await svc.from("login_events").insert({
      user_id: userId,
      event,
      ip: info.ip,
      country: info.country,
      city: info.city,
      user_agent: info.userAgent,
    });
  } catch {
    // ignore
  }
}

/**
 * Continuous activity capture.
 *
 * Auth events alone left the Security tab hours stale, so the owner could not
 * see where traffic was coming from "right now". This records an event for
 * ordinary product activity too — agent runs, file edits, project creation and
 * GitHub sync — using the same IP + approximate location + device capture, so
 * the panel shows a live picture rather than a sign-in-only history.
 *
 * Failures are swallowed on purpose: telemetry must never break a request.
 */
export async function logActivity(
  userId: string,
  event: ActivityEvent,
  req: Request,
  detail: Record<string, unknown> = {}
): Promise<void> {
  const info = extractRequestInfo(req);
  try {
    const { createServiceClient } = await import("@/lib/supabase/server");
    const svc = await createServiceClient();
    await svc.from("login_events").insert({
      user_id: userId,
      event,
      ip: info.ip,
      country: info.country,
      city: info.city,
      user_agent: info.userAgent,
      detail,
    });
  } catch {
    // ignore
  }
}
