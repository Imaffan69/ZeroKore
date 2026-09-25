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