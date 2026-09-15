import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const AUTH_TIMEOUT_MS = 8000;

/** Fetch that can never hang longer than the edge/runtime budget. */
function timeoutFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(AUTH_TIMEOUT_MS) });
}

/**
 * Supabase config is only usable when both values are present AND the URL is a
 * valid http(s) URL. `createServerClient` throws on a malformed URL, which used
 * to surface as a site-wide 500 MIDDLEWARE_INVOCATION_FAILED on Vercel.
 */
function readConfig(): { url: string; anon: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  } catch {
    return null;
  }
  return { url, anon };
}

export type SessionResult = {
  /** Response that must be returned (or merged) by middleware. */
  response: NextResponse;
  /** Authenticated client, or null when Supabase is missing/unreachable. */
  supabase: SupabaseClient | null;
};

/**
 * Refreshes the Supabase session cookies for the incoming request.
 * Never throws: a missing, malformed, or unreachable Supabase project degrades
 * to an anonymous request instead of crashing every route in the app.
 */
export async function updateSession(
  request: NextRequest
): Promise<SessionResult> {
  let response = NextResponse.next({ request });

  const config = readConfig();
  if (!config) return { response, supabase: null };

  try {
    const supabase = createServerClient(config.url, config.anon, {
      global: { fetch: timeoutFetch },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
          headers?: Record<string, string>
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
          // Refreshed sessions must never be cached by the CDN/proxy, or one
          // user's tokens could be served to another.
          if (headers) {
            for (const [key, value] of Object.entries(headers)) {
              response.headers.set(key, value);
            }
          }
        },
      },
    });

    await supabase.auth.getUser();
    return { response, supabase };
  } catch {
    // Misconfigured or unreachable Supabase must not break public routes.
    return { response, supabase: null };
  }
}
