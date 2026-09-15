import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

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

function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
