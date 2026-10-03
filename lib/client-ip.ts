/**
 * The visitor's own view of their public address.
 *
 * Server-side header parsing is the primary source of an IP, and it is what
 * every other deployment gets right. It cannot be right, though, when the app
 * sits behind a proxy or tunnel that does not forward the client's address —
 * every request then arrives with the same infrastructure address, and no
 * amount of header parsing recovers the real one. In that specific case the
 * browser asks a public echo service what it sees.
 *
 * Notes on how this is kept small and private:
 *  - No API key, no account, no tracking identifier. `api.ipify.org` answers a
 *    single GET with the caller's address and sends `Access-Control-Allow-Origin: *`.
 *  - One request per browser session, then cached in `sessionStorage`, so a
 *    sign-in does not become a stream of third-party calls.
 *  - Only invoked when the server said it needed a value (`needsHint`), so a
 *    healthy deployment makes zero requests to it.
 *  - Any failure resolves to `null`: telemetry must never break a sign-in.
 */

const STORAGE_KEY = "zerokore:client-ip";
const TIMEOUT_MS = 4000;
/** Matches CLIENT_IP_COOKIE in lib/request-info.ts. */
const COOKIE = "zk_client_ip";
/** Set by server-side sign-in routes that could not see a routable address. */
export const NEEDS_IP_COOKIE = "zk_needs_ip";
export const CLIENT_IP_COOKIE = COOKIE;
/** Half a day: long enough to cover a work session, short enough to expire. */
export const COOKIE_MAX_AGE = 60 * 60 * 12;

/** Whether a cookie is present, without needing its value. */
export function hasCookie(name: string): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((part) => part.trim().startsWith(`${name}=`));
}

/** Keyless, CORS-enabled echo endpoints, tried in order. */
const ENDPOINTS = ["https://api.ipify.org/?format=json", "https://api64.ipify.org/?format=json"];

function readCache(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked (private mode); the live request below still works.
    return null;
  }
}

function writeCache(ip: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, ip);
  } catch {
    // Not worth failing over.
  }
  // The cookie is what lets *server-recorded* events (agent runs, file edits,
  // GitHub syncs) carry the same address as the sign-in, not just the events
  // the browser posts itself.
  try {
    document.cookie = `${COOKIE}=${encodeURIComponent(
      ip
    )}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {
    // Cookies can be blocked; the sessionStorage value still serves this tab.
  }
}

/** Rejects anything that is not a bare, routable IPv4/IPv6 address. */
function isPlausibleIp(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f.:]{3,45}$/i.test(value.trim());
}

export async function fetchClientIp(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const cached = readCache();
  if (isPlausibleIp(cached)) return cached.trim();

  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) continue;
      const json = (await res.json()) as Record<string, unknown>;
      const ip = json.ip ?? json.origin;
      if (!isPlausibleIp(ip)) continue;
      writeCache(ip.trim());
      return ip.trim();
    } catch {
      // Try the next endpoint, then give up quietly.
    }
  }
  return null;
}