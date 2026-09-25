/**
 * URL slug rules for project paths.
 *
 * Kept in its own module so both the server (uniqueness checks) and client
 * (live URL preview in the create form) derive slugs from the same logic.
 */

export const MAX_SLUG_LENGTH = 60;

/**
 * The canonical address of a project: `/<username>/<project-slug>`.
 *
 * Older links used `/projects/<slug>`. That route still exists and redirects
 * here, but it is no longer what the app links to — a project's address always
 * carries the person it belongs to. Accounts without a username yet (a database
 * that has not run the username upgrade) fall back to the legacy path so
 * nothing breaks in the meantime.
 */
export function projectPath(
  username: string | null | undefined,
  slug: string
): string {
  return username ? `/${username}/${slug}` : `/projects/${slug}`;
}

export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
  return base || "project";
}

/**
 * Project name rules.
 *
 * A project's slug is public and printed in every URL (`/<username>/<project>`),
 * so it needs the same protection a username gets. Without this, anyone could
 * create `/porn` or squat `/admin` — names already reserved at the account
 * level, which is exactly the impersonation the username rules prevent.
 *
 * The blocked-word and folding logic is shared with `lib/username.ts` rather
 * than duplicated, so the two lists cannot drift apart.
 */

import { isReservedUsername, containsBlockedWord } from "@/lib/username";

/** Platform paths a project must not shadow. */
const PROJECT_RESERVED_PREFIXES = [
  "zerokore", "zero-kore", "zk-", "admin", "official", "support", "staff",
  "api", "kore",
] as const;

/** Slugs reserved because a real page already lives there. */
const PROJECT_RESERVED_EXACT = new Set([
  "admin", "login", "logout", "signup", "register", "settings", "dashboard",
  "account", "accounts", "billing", "pricing", "about", "blog", "news",
  "privacy", "terms", "legal", "docs", "documentation", "status", "health",
  "help", "support", "contact", "careers", "jobs", "team", "security",
  "new", "create", "import", "export", "search", "explore", "home", "index",
]);

export function isReservedProjectSlug(slug: string): boolean {
  const s = slug.toLowerCase();
  if (PROJECT_RESERVED_EXACT.has(s)) return true;
  if (PROJECT_RESERVED_PREFIXES.some((p) => s.startsWith(p))) return true;
  // Inherits the full platform-reserved set (system, root, owner, …).
  return isReservedUsername(s);
}

/**
 * Why a project name is unacceptable, or `null` when it is fine.
 * Returns user-facing text so the create form and the API agree.
 */
export function projectNameError(input: string): string | null {
  const name = input.trim();
  if (!name) return "Give the project a name.";
  if (name.length > 80) return "Project names can be at most 80 characters.";

  // Check the derived slug, not just the typed name: "P0rn!" and "porn" are the
  // same URL, and padding or leet spelling must not slip past.
  const slug = slugify(name);
  if (isReservedProjectSlug(slug)) {
    return "That project name is reserved. Try another.";
  }
  if (containsBlockedWord(name) || containsBlockedWord(slug)) {
    return "Pick a different project name — that one is not allowed.";
  }
  return null;
}

export function isValidProjectName(input: string): boolean {
  return projectNameError(input) === null;
}

/** Format a timestamp as a short relative time. */
export function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "unknown";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}