import { NextResponse } from "next/server";
import { requireUser, errorResponse } from "@/lib/api-auth";
import {
  readGitHubToken,
  fetchGitHubRepos,
  isGitHubOAuthConfigured,
  isGitHubStorageConfigured,
} from "@/lib/github";

export const dynamic = "force-dynamic";

/**
 * The signed-in user's GitHub repositories, for the import picker.
 * Reads the stored OAuth token server-side; the token never reaches the client.
 */
export async function GET() {
  try {
    const { user } = await requireUser();

    if (!isGitHubOAuthConfigured()) {
      return NextResponse.json({
        repos: [],
        message:
          "GitHub is not configured on the server. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, then redeploy.",
      });
    }
    if (!isGitHubStorageConfigured()) {
      return NextResponse.json({
        repos: [],
        message:
          "GitHub connections need SUPABASE_SERVICE_ROLE_KEY on the server. Nothing is stored without it.",
      });
    }

    const token = await readGitHubToken(user.id);
    if (!token) {
      return NextResponse.json({
        repos: [],
        message: "Connect your GitHub account to import a repository.",
      });
    }

    try {
      const repos = await fetchGitHubRepos(token);
      return NextResponse.json({ repos });
    } catch (err) {
      return NextResponse.json(
        {
          repos: [],
          message:
            err instanceof Error
              ? err.message
              : "Could not reach GitHub. Try again in a moment.",
        },
        { status: 502 }
      );
    }
  } catch (err) {
    return errorResponse(err);
  }
}