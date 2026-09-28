import { NextResponse } from "next/server";
import { requireUser, errorResponse } from "@/lib/api-auth";
import {
  readGitHubLogin,
  deleteGitHubToken,
  isGitHubOAuthConfigured,
  isGitHubStorageConfigured,
  GitHubStorageError,
} from "@/lib/github";

export const dynamic = "force-dynamic";

/**
 * Minimal, safe GitHub account connection surface.
 *
 * GET  → status only: is the OAuth app configured server-side, and has the
 *        signed-in user stored a GitHub token? Never returns token values.
 * DELETE → removes the caller's stored token.
 *
 * `github_connections` has row-level security with NO client policies, so the
 * token row is only reachable with the service-role client (see lib/github.ts).
 * Reading it with the user's own session returned nothing, which is why the
 * connection used to look permanently disconnected.
 */
export async function GET() {
  try {
    const { user } = await requireUser();

    const configured = isGitHubOAuthConfigured();
    const storage = isGitHubStorageConfigured();
    const login = storage ? await readGitHubLogin(user.id) : null;

    return NextResponse.json({
      configured,
      storage,
      connected: !!login,
      user: login,
      message: !configured
        ? "Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET on the server to enable GitHub."
        : !storage
          ? "GitHub connections need SUPABASE_SERVICE_ROLE_KEY on the server."
          : undefined,
    });
  } catch (err) {
    // Distinguish "you are not connected" from "the server cannot read your
    // connection". Reporting a broken table as "not connected" is what made
    // this failure invisible.
    if (err instanceof GitHubStorageError) {
      return NextResponse.json(
        {
          configured: isGitHubOAuthConfigured(),
          storage: isGitHubStorageConfigured(),
          connected: false,
          user: null,
          fault: true,
          message: err.message,
          hint: err.hint,
        },
        { status: 503 }
      );
    }
    return errorResponse(err);
  }
}

export async function DELETE() {
  try {
    const { user } = await requireUser();
    await deleteGitHubToken(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
