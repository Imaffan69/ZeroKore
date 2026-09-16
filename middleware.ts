import { type NextRequest, NextResponse } from "next/server";

/**
 * Lets us identify which build is live from outside (response header).
 *
 * mw-4 = middleware whose import graph contains NO heavyweight SDK. This is the
 * important part: middleware runs in Vercel's Edge isolate, and a module that
 * cannot be *evaluated* there throws before the handler runs, which no
 * try/catch can contain. Importing `@supabase/ssr` + `@supabase/supabase-js`
 * (which pulls in `ws`, and therefore `node:buffer` / `node:async_hooks`)
 * produced exactly that: every matched route answered
 * `500 MIDDLEWARE_INVOCATION_FAILED`, including routes that do not exist.
 * Only `next/server` is imported here, so there is nothing left to fail.
 */
const BUILD_TAG = "mw-4";

const AUTH_COOKIE_SUFFIX = "-auth-token";

function tag(response: NextResponse) {
  response.headers.set("x-zerokore-mw", BUILD_TAG);
  return response;
}

/** `/dashboard` and its children are the only routes gated here. */
function isProtected(pathname: string) {
  return (
    pathname === "/dashboard" || pathname.startsWith("/dashboard/")
  );
}

/**
 * Supabase stores its session in `sb-<project-ref>-auth-token`, split into
 * `.0`, `.1`, … chunks when it is large. The ref comes from the project URL
 * host (`https://<ref>.supabase.co`).
 */
function authCookieBase(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;
  try {
    const ref = new URL(url).hostname.split(".")[0];
    return ref ? `sb-${ref}${AUTH_COOKIE_SUFFIX}` : null;
  } catch {
    return null;
  }
}

/**
 * Cheap cookie-presence check — deliberately does NOT validate the token.
 * This is a redirect gate for UX only: `app/dashboard` re-checks the session in
 * the browser and every `/api/*` route validates the real token server-side
 * with the Supabase client (which also refreshes it there, where cookies are
 * writable). Not doing the crypto check here is what keeps the module graph
 * small enough to be Edge-safe.
 */
function hasSessionCookie(request: NextRequest): boolean {
  const base = authCookieBase();
  return request.cookies.getAll().some(({ name, value }) => {
    if (!value) return false;
    if (base) return name === base || name.startsWith(`${base}.`);
    return /^sb-.*-auth-token(\.\d+)?$/.test(name);
  });
}

export function middleware(request: NextRequest) {
  try {
    if (isProtected(request.nextUrl.pathname) && !hasSessionCookie(request)) {
      return tag(NextResponse.redirect(new URL("/login", request.url)));
    }
  } catch {
    // Never let the gate itself take the site down.
    return tag(NextResponse.next());
  }
  return tag(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
