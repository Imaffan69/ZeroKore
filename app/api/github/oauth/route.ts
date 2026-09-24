import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeGitHubToken } from "@/lib/github";

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

const SCOPE = "repo read:user";

function redirectUri(req: NextRequest): string {
  const url = new URL(req.url);
  return `${url.origin}/api/github/oauth`;
}

function backWithError(req: NextRequest, message: string): NextResponse {
  const url = new URL(req.url);
  const target = new URL(safeReturn(url.searchParams.get("next")), url.origin);
  target.searchParams.set("github_error", message);
  return NextResponse.redirect(target);
}

/** Only same-origin, absolute paths are accepted as a return target. */
function safeReturn(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")) {
    return raw;
  }
  return "/dashboard";
}

/**
 * `state` binds the callback to the user who started the flow (CSRF
 * protection) and carries where to return. It is a URL-encoded JSON envelope
 * rather than a bare user id, because the return path has to survive the
 * round-trip through GitHub.
 */
function encodeState(userId: string, next: string | null): string {
  return Buffer.from(
    JSON.stringify({ u: userId, n: safeReturn(next) }),
    "utf8"
  ).toString("base64url");
}

function decodeState(raw: string | null): { u: string; n: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8")
    ) as { u?: unknown; n?: unknown };
    if (typeof parsed.u !== "string" || !parsed.u) return null;
    return { u: parsed.u, n: safeReturn(typeof parsed.n === "string" ? parsed.n : null) };
  } catch {
    return null;
  }
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
    // CSRF binding to the session user, plus the page to come back to.
    authorize.searchParams.set(
      "state",
      encodeState(user.id, url.searchParams.get("next"))
    );
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

    // Persist server-side under the authenticated user id. `github_connections`
    // has no client policies, so this must go through the service client.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return backWithError(req, "Session expired during GitHub connection. Sign in and retry.");
    }
    try {
      await writeGitHubToken(user.id, ghLogin, accessToken);
    } catch {
      return backWithError(
        req,
        "GitHub authorised, but ZeroKore could not store the token. Check SUPABASE_SERVICE_ROLE_KEY on the server."
      );
    }

    // Record the sync with IP/geo/device like every other activity.
    try {
      const { logActivity } = await import("@/lib/request-info");
      await logActivity(user.id, "github_sync", req, { login: ghLogin, action: "connect" });
    } catch {
      // telemetry must never break the connection
    }

    // Return to wherever the user started the flow. Connecting used to always
    // land on /dashboard, which threw away the import panel they had open and
    // left them with an empty repository list and no confirmation.
    const state = decodeState(url.searchParams.get("state"));
    // The token must land on the account that authorised it; a mismatched
    // state means the callback belongs to someone else's flow.
    if (state && state.u !== user.id) {
      return backWithError(
        req,
        "This GitHub connection belongs to a different sign-in. Start again from your account."
      );
    }
    const safeNext = state?.n ?? safeReturn(url.searchParams.get("next"));
    const target = new URL(safeNext, url.origin);
    target.searchParams.set("github", "connected");
    target.searchParams.set("github_login", ghLogin);
    return NextResponse.redirect(target.toString());
  } catch {
    return backWithError(
      req,
      "Could not reach GitHub to complete the connection. Try again."
    );
  }
}
