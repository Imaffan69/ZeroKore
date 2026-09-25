import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Every server-side Supabase call is capped so an unreachable project fails
 * fast instead of holding the request open until the platform times it out.
 */
const REQUEST_TIMEOUT_MS = 10_000;

function timeoutFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    global: { fetch: timeoutFetch },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[]
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component, where cookie writes are not
          // allowed. Route handlers and the browser client refresh instead.
        }
      },
    },
  });
}

/**
 * Client for non-browser callers (the CLI, the desktop app, scripts).
 *
 * The browser uses the cookie session above. A CLI has no cookie jar, so it
 * presents a Supabase access token as `Authorization: Bearer â€¦` instead. Both
 * paths resolve to the same authenticated user, and the server still verifies
 * the token with Supabase â€” nothing here trusts the caller.
 *
 * Returns null when no bearer token was supplied, so the caller can fall back
 * to the cookie client.
 */
export async function createBearerClient(accessToken: string) {
  const { createClient: createJsClient } = await import(
    "@supabase/supabase-js"
  );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return createJsClient(url, anon, {
    global: {
      fetch: timeoutFetch,
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Service-role client for trusted server-side admin work only. Never expose to the browser. */
export async function createServiceClient() {
  const { createClient: createJsClient } = await import(
    "@supabase/supabase-js"
  );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase service configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createJsClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: timeoutFetch },
  });
}
