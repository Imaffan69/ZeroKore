import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth completion (PKCE).
 *
 * After Google/GitHub round-trips through Supabase, the browser arrives here
 * carrying `?code=...`. We exchange it server-side (the verifier lives in the
 * cookies), which writes the session, then continue to `next`. Without this
 * route the code was never exchanged and the user bounced back to the login
 * screen — the "redirected to /code?..." bug.
 */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")) {
    return raw;
  }
  return "/dashboard";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const providerError =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (providerError) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(providerError.slice(0, 200))}`, origin)
    );
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
        code
      );
      if (exchangeError) {
        return NextResponse.redirect(
          new URL(
            `/login?error=${encodeURIComponent(
              `Sign-in could not be completed (${exchangeError.message.slice(0, 120)}). Try again.`
            )}`,
            origin
          )
        );
      }
      // Record the sign-in with IP, approximate location and device. Without
      // this the Security tab stayed empty, because OAuth sign-ins are the one
      // path that never passed through a logged event.
      const user = data?.user;
      if (user) {
        const { logActivity } = await import("@/lib/request-info");
        // A brand-new account is a signup; a returning one is a login.
        const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
        const isNew = createdAt > 0 && Date.now() - createdAt < 5 * 60 * 1000;
        await logActivity(
          user.id,
          isNew ? "signup" : "login",
          req,
          isNew ? {} : { provider: "oauth" }
        );
      }
    } catch {
      return NextResponse.redirect(
        new URL("/login?error=Sign-in%20could%20not%20be%20completed.%20Try%20again.", origin)
      );
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
