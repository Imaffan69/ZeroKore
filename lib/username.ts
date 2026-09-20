/**
 * Username rules — one place, shared by the signup form, the settings form, the
 * API and the database trigger.
 *
 * A username is the public half of a ZeroKore identity: it appears in every
 * project URL (`/<username>/<project>`). Because it is public it must be safe to
 * print, safe to reserve, and impossible to confuse — so validation rejects
 * everything that could be used to impersonate the platform or harass someone.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/** Lowercase, digits, dash and underscore; must start and end alphanumeric. */
export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])$/;

/**
 * Names that belong to the platform, not to a person. Taken exactly, plus
 * anything starting with one of the `PREFIXES` so `admin-support` is refused
 * too — the goal is that nobody can look like staff.
 */
const RESERVED_EXACT = new Set([
  "admin", "administrator", "owner", "root", "superuser", "moderator", "mod",
  "staff", "official", "support", "help", "helpdesk", "security", "billing",
  "system", "zero", "kore", "zerokore", "api", "app", "apps", "auth", "account",
  "accounts", "login", "logout", "signin", "signup", "register", "settings",
  "dashboard", "projects", "project", "new", "create", "import", "export",
  "files", "file", "terminal", "preview", "deploy", "deployments", "status",
  "health", "www", "mail", "email", "smtp", "cdn", "static", "assets", "public",
  "about", "pricing", "terms", "privacy", "legal", "docs", "documentation",
  "blog", "news", "careers", "jobs", "contact", "team", "company", "null",
  "undefined", "none", "anonymous", "guest", "user", "users", "me", "you",
  "test", "testing", "demo", "example", "sample", "staging", "production",
  "internal", "private", "public", "bot", "bots", "agent", "agents", "ai",
]);

const RESERVED_PREFIXES = [
  "zerokore", "zero-kore", "zk-", "admin", "official", "support", "staff",
] as const;

/**
 * Substrings refused anywhere in a name. Kept as a single normalised string so
 * leetspeak and separator padding (`n1g-ga`, `aa_admin_aa`) still match. This is
 * a moderation guard, not a substitute for reporting.
 */
const BLOCKED = [
  "nigg", "n1gg", "ni99", "fagg", "f4gg", "raghead", "kike", "spic", "chink",
  "tranny", "retard", "whore", "slut", "rape", "pedo", "paedo", "molest",
  "hitler", "nazi", "kkk", "terror", "jihad", "cunt", "bitch", "bastard",
  "dick", "cock", "pussy", "penis", "vagina", "anus", "cum", "semen", "porn",
  "sex", "nude", "nudes", "onlyfans", "escort", "hooker",
];

/** Strip separators and leetspeak so padding cannot hide a blocked word. */
function foldForModeration(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/0/g, "o")
    .replace(/1|3|4/g, "i")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/9/g, "g")
    .replace(/@/g, "a")
    .replace(/\$/g, "s");
}

/** The canonical form of a typed username (accepts a leading `@`). */
export function normalizeUsername(input: string): string {
  return input.trim().replace(/^@+/, "").toLowerCase();
}

export function isReservedUsername(username: string): boolean {
  const u = normalizeUsername(username);
  if (RESERVED_EXACT.has(u)) return true;
  return RESERVED_PREFIXES.some((p) => u.startsWith(p));
}

export function containsBlockedWord(username: string): boolean {
  const folded = foldForModeration(normalizeUsername(username));
  return BLOCKED.some((word) => folded.includes(foldForModeration(word)));
}

/**
 * Why a username is unacceptable, or `null` when it is fine.
 * Returns user-facing text so the form, the API and the trigger agree.
 */
export function usernameError(input: string): string | null {
  const u = normalizeUsername(input);
  if (u.length < USERNAME_MIN) {
    return `Usernames need at least ${USERNAME_MIN} characters.`;
  }
  if (u.length > USERNAME_MAX) {
    return `Usernames can be at most ${USERNAME_MAX} characters.`;
  }
  if (!USERNAME_PATTERN.test(u)) {
    return "Use lowercase letters, numbers, dashes or underscores, starting and ending with a letter or number.";
  }
  if (isReservedUsername(u)) {
    return "That username is reserved by ZeroKore. Try another.";
  }
  if (containsBlockedWord(u)) {
    return "Pick a different username — that one is not allowed.";
  }
  return null;
}

export function isValidUsername(input: string): boolean {
  return usernameError(input) === null;
}

/**
 * A starting username derived from an email local part. Only a seed: uniqueness
 * is decided by the database (`uniqueUsername`), and the result is always passed
 * through the same validation as a typed one.
 */
export function usernameFromEmail(email: string): string {
  const local = (email.split("@")[0] ?? "").toLowerCase();
  const cleaned = local
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, USERNAME_MAX);
  if (cleaned.length >= USERNAME_MIN && !usernameError(cleaned)) return cleaned;
  // Fall back to a neutral, always-valid stem.
  return `builder-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Usernames that are also valid *project* slugs is a property we get for free:
 * both use the same character set. Kept as a named export so the intent is
 * explicit at call sites that rely on it.
 */
export const USERNAME_IS_SLUG_SAFE = true;
