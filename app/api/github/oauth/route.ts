import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GitHub OAuth: start + callback in one route.
 *
 * GET /api/github/oauth            → 302 to GitHub's authorize URL
 * GET /api/github/oauth?code=...   → token exchange, stores the token
 *                                    server-side (never in the browser)
 *
 * Requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET (from Vercel env vars /
 * GitHub secrets). If they are missing, redirects back with an actionable
 * error instead of faking success.
 */

const TABLE = "github_connections";
const SCOPE = "repo read:user";

function redirectUri(req: NextRequest): string {
  const url = new URL(req.url);
  return `${url.origin}/api/github/oauth`;
}

function backWithError(req: NextRequest, message: string): NextResponse {
  const url = new URL(req.url);
  const target = new URL("/dashboard", url.origin);
  target.searchParams.set("github_error", message);
  return NextResponse.redirect(target);
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return backWithError(
      req,
      "GitHub OAuth is not configured on the server. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET."
    );
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  // --- Step 1: no code yet → redirect the user to GitHub's consent screen ---
  if (!code) {
    let supabase;
    try {
      supabase = await createClient();
    } catch {
      return backWithError(req, "Server misconfigured.");
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return backWithError(req, "Sign in before connecting GitHub.");
    }

    const authorize = new URL("https://github.com/login/oauth/authorize");
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("redirect_uri", redirectUri(req));
    authorize.searchParams.set("scope", SCOPE);
    authorize.searchParams.set("state", user.id); // Simple CSRF binding to the session user.
    return NextResponse.redirect(authorize.toString());
  }

  // --- Step 2: callback with code → exchange for a token ---
  try {
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri(req),
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tokenData: any = await tokenRes.json();
    const accessToken = tokenData?.access_token as string | undefined;
    if (!accessToken) {
      return backWithError(
        req,
        "GitHub did not return an access token. Try connecting again."
      );
    }

    // Identify the GitHub account for display.
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
      signal: AbortSignal.timeout(10_000),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ghUser: any = await userRes.json();
    const ghLogin =
      typeof ghUser?.login === "string" ? ghUser.login : "github-user";

    // Persist server-side under the authenticated user id.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return backWithError(req, "Session expired during GitHub connection. Sign in and retry.");
    }
    await supabase.from(TABLE).upsert({
      user_id: user.id,
      github_login: ghLogin,
      access_token: accessToken,
      updated_at: new Date().toISOString(),
    });

    const target = new URL("/dashboard", url.origin);
    target.searchParams.set("github_connected", ghLogin);
    return NextResponse.redirect(target.toString());
  } catch {
    return backWithError(
      req,
      "Could not reach GitHub to complete the connection. Try again."
    );
  }
}
