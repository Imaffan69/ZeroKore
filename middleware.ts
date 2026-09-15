import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Lets us identify which build is live from outside (response header). */
const BUILD_TAG = "mw-3";

function isProtected(pathname: string) {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/api/agent")
  );
}

function isApi(pathname: string) {
  return pathname.startsWith("/api/");
}

function tag(response: NextResponse) {
  response.headers.set("x-zerokore-mw", BUILD_TAG);
  return response;
}

function apiError(message: string, status: number) {
  return tag(NextResponse.json({ error: message }, { status }));
}

/**
 * Routing middleware. Session refresh is best-effort: any Supabase failure must
 * degrade to an anonymous request (public pages still render) instead of
 * raising MIDDLEWARE_INVOCATION_FAILED / HTTP 500 for the entire site.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  try {
    const { response, supabase } = await updateSession(request);
    tag(response);

    // Public routes: only refresh cookies, then continue unconditionally.
    if (!isProtected(pathname)) return response;

    if (!supabase) {
      // Supabase is not configured (or its URL is malformed).
      if (isApi(pathname)) {
        return apiError(
          "Authentication is not configured on this deployment. Contact the administrator.",
          503
        );
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const { data, error } = await supabase.auth.getUser();

    if (!data.user) {
      // Distinguish "no session" from "Supabase unreachable/erroring".
      if (error && error.name !== "AuthSessionMissingError") {
        if (isApi(pathname)) {
          return apiError(
            "Authentication service is temporarily unavailable. Please try again.",
            503
          );
        }
        return NextResponse.redirect(new URL("/login", request.url));
      }
      if (isApi(pathname)) {
        return apiError("Authentication required.", 401);
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  } catch (err) {
    // Absolute last resort: never return a middleware 500 for the whole app.
    console.log(
      JSON.stringify({
        event: "middleware_error",
        path: pathname,
        message: err instanceof Error ? err.message : "unknown",
      })
    );

    if (isProtected(pathname)) {
      if (isApi(pathname)) {
        return apiError("Request could not be processed. Please retry.", 503);
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return tag(NextResponse.next({ request }));
  }
}

export const config = {
  // Vercel's Edge middleware runtime (a CDN isolate) cannot evaluate the
  // Supabase SDK's module graph; the failure happens BEFORE this handler runs,
  // so no try/catch can contain it, and every matched route returns
  // 500 MIDDLEWARE_INVOCATION_FAILED. The Node.js runtime runs the same code
  // that works locally, so refresh + auth checks behave normally.
  runtime: "nodejs",
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
