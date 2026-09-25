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
  /** Set when a real lookup ran (not just platform headers). */
  precise: boolean;
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  asn?: string | null;
  network?: string | null;
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
    precise: false,
  };
}

/**
 * Real IP geolocation via ipgeolocation.io.
 *
 * Vercel's `x-vercel-ip-*` headers only populate for requests that actually
 * traverse Vercel's edge, so on some paths (and locally) country/city were simply
 * null — which is why the admin Security tab showed an IP with no location.
 * When `IP_LOCATION_API` is set we do an authoritative lookup and keep the
 * coordinates, timezone and network, so the panel can place a session on a map.
 *
 * Private/reserved addresses are never sent to a third party, and the result is
 * cached in-process so a burst of requests costs one lookup per IP per minute.
 */
const geoCache = new Map<string, { at: number; info: GeoLookup }>();
const GEO_TTL_MS = 60_000;

interface GeoLookup {
  country: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  asn: string | null;
  network: string | null;
}

function isPublicIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 169 && b === 254) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  return true;
}

export function isPublicIp(ip: string | null): boolean {
  if (!ip) return false;
  if (ip.includes(":")) {
    // IPv6 loopback / unique-local
    const lower = ip.toLowerCase();
    return !lower.startsWith("::1") && !lower.startsWith("fc") && !lower.startsWith("fd");
  }
  return isPublicIpv4(ip);
}

async function lookupGeo(ip: string): Promise<GeoLookup | null> {
  const key = process.env.IP_LOCATION_API;
  if (!key || !isPublicIp(ip)) return null;

  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.at < GEO_TTL_MS) return cached.info;

  try {
    const res = await fetch(
      `https://api.ipgeolocation.io/ipgeo?apiKey=${encodeURIComponent(key)}&ip=${encodeURIComponent(ip)}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    if (json?.success === 0 || !json?.country_name) return null;
    const info: GeoLookup = {
      country: (json.country_name as string) ?? null,
      city: (json.city as string) ?? null,
      region: (json.region as string) ?? null,
      latitude: typeof json.latitude === "string" ? Number(json.latitude) : (json.latitude as number) ?? null,
      longitude:
        typeof json.longitude === "string" ? Number(json.longitude) : (json.longitude as number) ?? null,
      timezone: (json.time_zone as string) ?? null,
      asn: (json.asn as string) ?? null,
      network: (json.asn_name as string) ?? null,
    };
    geoCache.set(ip, { at: Date.now(), info });
    return info;
  } catch {
    // A failed lookup must never break the request it was describing.
    return null;
  }
}

/** Request info enriched with a real geolocation lookup when one is available. */
export async function describeRequest(req: Request): Promise<RequestInfo> {
  const base = extractRequestInfo(req);
  if (!base.ip) return base;
  const geo = await lookupGeo(base.ip);
  if (!geo) return base;
  return {
    ...base,
    country: geo.country ?? base.country,
    city: geo.city ?? base.city,
    region: geo.region,
    latitude: geo.latitude,
    longitude: geo.longitude,
    timezone: geo.timezone,
    asn: geo.asn,
    network: geo.network,
    precise: true,
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
    // Core columns only: `detail` (jsonb) is intentionally omitted here so this
    // path also works on a database without migration 005 applied.
    const { error } = await svc.from("login_events").insert({
      user_id: userId,
      event,
      ip: info.ip,
      country: info.country,
      city: info.city,
      user_agent: info.userAgent,
    });
    if (error) {
      console.log(
        JSON.stringify({
          event: "login_event_write_failed",
          code: error.code ?? null,
          message: error.message,
        })
      );
    }
  } catch {
    // ignore
  }
}

/**
 * Universal activity capture.
 *
 * Auth events alone left the Security tab empty, because most sign-ins never
 * pass through the OAuth callback: email + password, and username + password,
 * both authenticate straight against Supabase from the browser. The client
 * calls this endpoint once the session exists, so *every* sign-in method is
 * recorded — with the real IP, the approximate location resolved from it, and
 * the device.
 *
 * Failures are swallowed on purpose: telemetry must never break a request.
 */
export async function logActivity(
  userId: string,
  event: ActivityEvent,
  req: Request,
  detail: Record<string, unknown> = {}
): Promise<void> {
  try {
    const info = await describeRequest(req);
    const { createServiceClient } = await import("@/lib/supabase/server");
    const svc = await createServiceClient();
    const { error } = await svc.from("login_events").insert({
      user_id: userId,
      event,
      ip: info.ip,
      country: info.country,
      city: info.city,
      user_agent: info.userAgent,
      // `detail` is jsonb, added by supabase/migrations/005_login_event_detail.sql.
      // It is written apart from the core columns so a database that has not
      // applied that migration still records the sign-in, rather than the whole
      // insert failing on an unknown column and losing the event entirely.
      detail: {
        ...detail,
        device: info.device,
        region: info.region,
        latitude: info.latitude,
        longitude: info.longitude,
        timezone: info.timezone,
        asn: info.asn,
        network: info.network,
        precise: info.precise,
      },
    });
    if (error) {
      // Retry without the enrichment: device/geo detail is nice-to-have, the
      // audit row itself is not. A sign-in is recorded either way.
      console.log(
        JSON.stringify({
          event: "login_event_detail_retry",
          code: error.code ?? null,
          message: error.message,
        })
      );
      await svc.from("login_events").insert({
        user_id: userId,
        event,
        ip: info.ip,
        country: info.country,
        city: info.city,
        user_agent: info.userAgent,
      });
    }
  } catch {
    // Telemetry must never break the request it is describing.
  }
}
