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
  /** Which geolocation provider answered, when a lookup actually ran. */
  geoProvider?: string | null;
}

/**
 * Headers that carry the originating client address, most authoritative first.
 *
 * `x-real-ip` is deliberately LAST. Behind a CDN, a hosting proxy or the Vercel
 * firewall it is frequently the *proxy's* address rather than the visitor's, and
 * it was previously consulted first — so every device of every user collapsed
 * onto one shared IP in the admin panel. `x-forwarded-for` is the chain of
 * addresses the request passed through, client first, which is what actually
 * distinguishes one device from another.
 */
const IP_HEADERS = [
  "cf-connecting-ip",
  "true-client-ip",
  "x-client-ip",
  "fly-client-ip",
  "fastly-client-ip",
  "x-vercel-forwarded-for",
  "x-forwarded-for",
  "x-forwarded",
  "x-real-ip",
];

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_RE = /^[0-9a-f]{0,4}(:[0-9a-f]{0,4}){2,7}$/;

function isIpv4(value: string): boolean {
  const m = IPV4_RE.exec(value);
  return !!m && m.slice(1).every((part) => Number(part) <= 255);
}

/**
 * Turn a raw header token into a bare address.
 *
 * Proxies hand out values in several shapes: bracketed IPv6 (`[2001:db8::1]`),
 * `host:port`, quoted strings, and IPv4-mapped IPv6 (`::ffff:203.0.113.9`).
 * Storing those verbatim made the same device look like several visitors.
 */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let v = raw.trim().toLowerCase();
  if (!v || v === "unknown" || v === "null" || v === "undefined") return null;
  v = v.replace(/^["']|["']$/g, "");
  if (v.startsWith("[")) {
    const end = v.indexOf("]");
    if (end === -1) return null;
    v = v.slice(1, end);
  } else {
    // `1.2.3.4:5678` — an IPv4 address with a port, not an IPv6 address.
    const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(v);
    if (withPort) v = withPort[1];
  }
  // IPv4-mapped and IPv4-compatible IPv6 both mean the IPv4 address above.
  const mapped = /^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/.exec(v);
  if (mapped) v = mapped[1];
  if (isIpv4(v) || IPV6_RE.test(v)) return v;
  return null;
}

/**
 * The client's real address for this request.
 *
 * Every proxy header is walked in priority order and each may carry a chain, so
 * the *first public* address wins. Private/reserved hops (a load balancer inside
 * the same network) are skipped instead of being reported as the visitor. When
 * nothing public is present — local development, for instance — the first valid
 * address is returned so the record is still meaningful.
 */
export function extractIp(req: Request): string | null {
  const h = req.headers;
  let fallback: string | null = null;
  for (const name of IP_HEADERS) {
    const raw = h.get(name);
    if (!raw) continue;
    for (const part of raw.split(",")) {
      const ip = normalizeIp(part);
      if (!ip) continue;
      if (isPublicIp(ip)) return ip;
      fallback ??= ip;
    }
  }
  return fallback;
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
 * Real IP geolocation, with a provider chain.
 *
 * Vercel's `x-vercel-ip-*` headers only populate for requests that actually
 * traverse Vercel's edge, so on some paths (and locally) country/city were simply
 * null — which is why the admin Security tab showed an IP with no location.
 *
 * A single hard-coded provider was the other half of the problem: with no key
 * present the lookup returned null and the panel drew nothing. Resolution is now
 * attempted in order and the coordinates survive whichever provider answers:
 *   1. ipgeolocation.io — used when IP_LOCATION_API (or an alias) is configured
 *   2. ipwho.is          — keyless, so coordinates work out of the box
 *   3. ip-api.com        — keyless second opinion
 *
 * Private/reserved addresses are never sent to a third party, and the result is
 * cached in-process so a burst of requests costs one lookup per IP.
 */
const geoCache = new Map<string, { at: number; info: GeoLookup | null }>();
const GEO_TTL_MS = 6 * 60 * 60 * 1000; // an address does not move cities often
const GEO_NEG_TTL_MS = 5 * 60 * 1000; // do not hammer a provider that just failed

export interface GeoLookup {
  country: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  asn: string | null;
  network: string | null;
  /** Which provider answered — shown in the admin panel for auditability. */
  provider: string | null;
}

/** Configured ipgeolocation.io key, under any of the names it may have. */
function configuredGeoKey(): string | null {
  return (
    process.env.IP_LOCATION_API ??
    process.env.IPGEOLOCATION_API_KEY ??
    process.env.IP_GEOLOCATION_API_KEY ??
    process.env.IPGEO_API_KEY ??
    null
  );
}

/**
 * Accept coordinates only when they describe a real place.
 *
 * Providers answer with 0,0 for addresses they cannot place; drawing that in the
 * Gulf of Guinea would be worse than drawing nothing, so it is treated as absent.
 */
function coordinates(
  lat: unknown,
  lon: unknown
): { latitude: number | null; longitude: number | null } {
  const latitude = typeof lat === "string" ? Number(lat) : (lat as number);
  const longitude = typeof lon === "string" ? Number(lon) : (lon as number);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    return { latitude: null, longitude: null };
  }
  return { latitude, longitude };
}

async function lookupIpgeolocation(ip: string, key: string): Promise<GeoLookup | null> {
  const res = await fetch(
    `https://api.ipgeolocation.io/ipgeo?apiKey=${encodeURIComponent(key)}&ip=${encodeURIComponent(ip)}`,
    { signal: AbortSignal.timeout(6000), cache: "no-store" }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as Record<string, unknown>;
  if (json?.success === 0 || !json?.country_name) return null;
  const { latitude, longitude } = coordinates(json.latitude, json.longitude);
  return {
    country: (json.country_name as string) ?? null,
    city: (json.city as string) ?? null,
    region: (json.region as string) ?? null,
    latitude,
    longitude,
    timezone: (json.time_zone as string) ?? null,
    asn: (json.asn as string) ?? null,
    network: (json.asn_name as string) ?? null,
    provider: "ipgeolocation.io",
  };
}

async function lookupIpwhois(ip: string): Promise<GeoLookup | null> {
  const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as Record<string, unknown>;
  if (json?.success === false || !json?.country) return null;
  const connection = (json.connection ?? {}) as Record<string, unknown>;
  const { latitude, longitude } = coordinates(json.latitude, json.longitude);
  const timezone = (json.timezone ?? {}) as Record<string, unknown>;
  return {
    country: (json.country as string) ?? null,
    city: (json.city as string) ?? null,
    region: (json.region as string) ?? null,
    latitude,
    longitude,
    timezone: (timezone.id as string) ?? null,
    asn: connection.asn != null ? String(connection.asn) : null,
    network: (connection.org as string) ?? (connection.isp as string) ?? null,
    provider: "ipwho.is",
  };
}

async function lookupIpApi(ip: string): Promise<GeoLookup | null> {
  const fields =
    "status,country,regionName,city,lat,lon,timezone,isp,org,as,query";
  const res = await fetch(
    `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${fields}`,
    { signal: AbortSignal.timeout(6000), cache: "no-store" }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as Record<string, unknown>;
  if (json?.status !== "success" || !json?.country) return null;
  const { latitude, longitude } = coordinates(json.lat, json.lon);
  return {
    country: (json.country as string) ?? null,
    city: (json.city as string) ?? null,
    region: (json.regionName as string) ?? null,
    latitude,
    longitude,
    timezone: (json.timezone as string) ?? null,
    asn: (json.as as string) ?? null,
    network: (json.isp as string) ?? (json.org as string) ?? null,
    provider: "ip-api.com",
  };
}

async function runLookup(ip: string): Promise<GeoLookup | null> {
  const key = configuredGeoKey();
  if (key) {
    try {
      const hit = await lookupIpgeolocation(ip, key);
      if (hit) return hit;
    } catch {
      // fall through to the keyless providers
    }
  }
  for (const lookup of [lookupIpwhois, lookupIpApi]) {
    try {
      const hit = await lookup(ip);
      if (hit) return hit;
    } catch {
      // A failed lookup must never break the request it was describing.
    }
  }
  return null;
}

/**
 * Resolve an address to a place. Public for the admin panel, which uses it to
 * fill in coordinates that were never recorded (older rows, or events written
 * before the enrichment path existed).
 */
export async function geolocateIp(ip: string | null): Promise<GeoLookup | null> {
  if (!ip || !isPublicIp(ip)) return null;
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.at < (cached.info ? GEO_TTL_MS : GEO_NEG_TTL_MS)) {
    return cached.info;
  }
  let info: GeoLookup | null = null;
  try {
    info = await runLookup(ip);
  } catch {
    info = null;
  }
  geoCache.set(ip, { at: Date.now(), info });
  return info;
}

function isPublicIpv4(ip: string): boolean {
  const m = IPV4_RE.exec(ip);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0) return false; // 192.0.0.0/24 + 192.0.2.0/24 docs
  if (a === 192 && b === 88) return false; // 6to4 relay anycast
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51) return false; // documentation
  if (a === 203 && b === 0) return false; // documentation
  if (a >= 224) return false; // multicast, reserved, broadcast
  return true;
}

export function isPublicIp(ip: string | null): boolean {
  if (!ip) return false;
  if (!ip.includes(":")) return isPublicIpv4(ip);
  // IPv6: unspecified, loopback, link-local, unique-local and IPv4-mapped
  // hops are all infrastructure, never a visitor.
  if (ip === "::" || ip === "::1") return false;
  if (/^f[cd]/.test(ip)) return false; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(ip)) return false; // fe80::/10 link-local
  if (/^::ffff:/.test(ip)) return false; // mapped IPv4 handled by normalizeIp
  return true;
}

/** Request info enriched with a real geolocation lookup when one is available. */
export async function describeRequest(req: Request): Promise<RequestInfo> {
  const base = extractRequestInfo(req);
  if (!base.ip) return base;
  const geo = await geolocateIp(base.ip);
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
    geoProvider: geo.provider,
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
 *  empty. The `db` argument is kept for call-site compatibility.
 *
 *  Delegated to `logActivity` so MFA and password-change events carry the same
 *  IP details and coordinates as sign-ins, instead of a bare address that the
 *  map could not place. */
export async function logAuthEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: import("@supabase/supabase-js").SupabaseClient<any>,
  userId: string,
  event: ActivityEvent,
  req: Request
): Promise<void> {
  void db;
  await logActivity(userId, event, req, { source: "auth" });
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
        geoProvider: info.geoProvider ?? null,
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
