import type { GitHubRepo } from "@/types/projects";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * GitHub integration, server-side only.
 *
 * Two independent switches:
 *  - OAuth app credentials (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET) let users
 *    authorise ZeroKore.
 *  - The service-role key is required to read/write `github_connections`,
 *    because that table deliberately has NO row-level-security policies: a
 *    browser session must never be able to read a stored token. Route handlers
 *    using the user's own client therefore cannot touch it.
 *
 * When either is missing we report it instead of pretending.
 */

const TABLE = "github_connections";
const API = "https://api.github.com";
const TIMEOUT_MS = 15_000;

export function isGitHubOAuthConfigured(): boolean {
  return !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET;
}

export function isGitHubStorageConfigured(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/** The stored OAuth token for a user, or null when not connected. */
export async function readGitHubToken(userId: string): Promise<string | null> {
  if (!isGitHubStorageConfigured()) return null;
  try {
    const service = await createServiceClient();
    const { data } = await service
      .from(TABLE)
      .select("access_token")
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.access_token as string) ?? null;
  } catch {
    return null;
  }
}

export async function readGitHubLogin(userId: string): Promise<string | null> {
  if (!isGitHubStorageConfigured()) return null;
  try {
    const service = await createServiceClient();
    const { data } = await service
      .from(TABLE)
      .select("github_login")
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.github_login as string) ?? null;
  } catch {
    return null;
  }
}

export async function writeGitHubToken(
  userId: string,
  login: string,
  token: string
): Promise<void> {
  const service = await createServiceClient();
  const { error } = await service.from(TABLE).upsert({
    user_id: userId,
    github_login: login,
    access_token: token,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function deleteGitHubToken(userId: string): Promise<void> {
  if (!isGitHubStorageConfigured()) return;
  const service = await createServiceClient();
  await service.from(TABLE).delete().eq("user_id", userId);
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** The user's repositories, most recently pushed first. */
export async function fetchGitHubRepos(token: string): Promise<GitHubRepo[]> {
  const res = await fetch(
    `${API}/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator`,
    { headers: authHeaders(token), signal: AbortSignal.timeout(TIMEOUT_MS) }
  );
  if (!res.ok) {
    throw new Error(
      res.status === 401
        ? "Your GitHub authorisation expired. Reconnect GitHub and try again."
        : `GitHub returned ${res.status} while listing your repositories.`
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = await res.json();
  return (Array.isArray(data) ? data : []).map((r) => ({
    full_name: String(r?.full_name ?? ""),
    name: String(r?.name ?? ""),
    private: !!r?.private,
    default_branch: String(r?.default_branch ?? "main"),
    description: typeof r?.description === "string" ? r.description : null,
    language: typeof r?.language === "string" ? r.language : null,
    updated_at: String(r?.updated_at ?? ""),
    html_url: String(r?.html_url ?? ""),
  }));
}

export interface RepoTree {
  paths: string[];
  truncated: boolean;
  defaultBranch: string;
}

/** Every blob path in the repository, recursively (Git trees API). */
export async function fetchRepoTree(
  token: string,
  repo: string,
  branch?: string
): Promise<RepoTree> {
  const ref = branch || (await fetchDefaultBranch(token, repo));
  const res = await fetch(
    `${API}/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    { headers: authHeaders(token), signal: AbortSignal.timeout(TIMEOUT_MS) }
  );
  if (!res.ok) {
    throw new Error(`GitHub returned ${res.status} while reading ${repo}.`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const paths = (Array.isArray(data?.tree) ? data.tree : [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((n: any) => n?.type === "blob" && typeof n.path === "string")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((n: any) => n.path as string);
  return { paths, truncated: !!data?.truncated, defaultBranch: ref };
}

async function fetchDefaultBranch(
  token: string,
  repo: string
): Promise<string> {
  const res = await fetch(`${API}/repos/${repo}`, {
    headers: authHeaders(token),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`GitHub returned ${res.status} while reading ${repo}.`);
  }
  const data = (await res.json()) as { default_branch?: string };
  return data.default_branch || "main";
}

/** One file's text content, or null when it is not a readable blob. */
export async function fetchFileContent(
  token: string,
  repo: string,
  path: string,
  ref: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `${API}/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`,
      { headers: authHeaders(token), signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: string; encoding?: string };
    if (data.encoding !== "base64" || typeof data.content !== "string") {
      return null;
    }
    return Buffer.from(data.content, "base64").toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Push one file to a branch. Used by "push to Git".
 * Reads the existing blob sha first so updates do not conflict.
 */
export async function pushFileToGitHub(
  token: string,
  repo: string,
  branch: string,
  path: string,
  content: string,
  message: string
): Promise<{ commitSha: string; htmlUrl: string }> {
  const headers = { ...authHeaders(token), "Content-Type": "application/json" };

  let sha: string | undefined;
  const existing = await fetch(
    `${API}/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`,
    { headers: authHeaders(token), signal: AbortSignal.timeout(TIMEOUT_MS) }
  );
  if (existing.ok) {
    const data = (await existing.json()) as { sha?: string };
    sha = data.sha;
  }

  const res = await fetch(`${API}/repos/${repo}/contents/${encodeURI(path)}`, {
    method: "PUT",
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `GitHub rejected the push (${res.status}).${detail ? ` ${detail.slice(0, 160)}` : ""}`
    );
  }
  const data = (await res.json()) as {
    commit?: { sha?: string; html_url?: string };
  };
  return {
    commitSha: data.commit?.sha ?? "",
    htmlUrl: data.commit?.html_url ?? "",
  };
}