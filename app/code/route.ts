import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const NO_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
};

function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")) {
    return raw;
  }
  return "/dashboard";
}

/**
 * Legacy/defensive OAuth landing: some flows arrived at `/code?...` instead of
 * `/auth/callback` (the "redirected to zerokore.vercel.app/code?4u27" report).
 *
 * This route is a FULL callback (exchanges the code itself) so it works even
 * when the OAuth app's redirect URI is `/code` rather than `/auth/callback`.
 * It also forwards to `/auth/callback` as a secondary path for consistency.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  const providerError =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (providerError) {
    const response = NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(providerError.slice(0, 200))}`, origin)
    );
    response.headers.set("Cache-Control", NO_CACHE["Cache-Control"]);
    return response;
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
        code
      );
      if (exchangeError) {
        const response = NextResponse.redirect(
          new URL(
            `/login?error=${encodeURIComponent(
              `Sign-in could not be completed (${exchangeError.message.slice(0, 120)}). Try again.`
            )}`,
            origin
          )
        );
        response.headers.set("Cache-Control", NO_CACHE["Cache-Control"]);
        return response;
      }
      // Record the sign-in (IP · approximate location · device). This route is
      // where many OAuth flows actually land, so without it the Security tab
      // stayed empty even though people were signing in.
      const user = data?.user;
      if (user) {
        const { logActivity } = await import("@/lib/request-info");
        const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
        const isNew = createdAt > 0 && Date.now() - createdAt < 5 * 60 * 1000;
        await logActivity(user.id, isNew ? "signup" : "login", req);
      }
    } catch {
      const response = NextResponse.redirect(
        new URL("/login?error=Sign-in%20could%20not%20be%20completed.%20Try%20again.", origin)
      );
      response.headers.set("Cache-Control", NO_CACHE["Cache-Control"]);
      return response;
    }
  }

  // Also forward to /auth/callback as a secondary path so both routes stay
  // consistent (in case some other flow lands there).
  const target = new URL("/auth/callback", origin);
  url.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });
  if (!target.searchParams.has("next")) {
    target.searchParams.set("next", next);
  }
  const response = NextResponse.redirect(target, 307);
  response.headers.set("Cache-Control", NO_CACHE["Cache-Control"]);
  return response;
}
