import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsAuth =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/api/agent");

  // Always refresh the session first.
  const response = await updateSession(request);

  if (!needsAuth) return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    // Misconfigured server: fail closed for protected routes.
    if (pathname.startsWith("/api/agent")) {
      return NextResponse.json(
        { error: "Server misconfigured. Contact the administrator." },
        { status: 500 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Session refresh already handled by updateSession.
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (pathname.startsWith("/api/agent")) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};