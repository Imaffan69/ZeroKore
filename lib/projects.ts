import type { SupabaseClient } from "@supabase/supabase-js";
import type { Project } from "@/types/projects";
import { slugify, MAX_SLUG_LENGTH } from "@/lib/slug";

/**
 * Project helpers shared by the route handlers.
 *
 * Slugs are the public URL identity (`/projects/<slug>`), so they are derived
 * from the name, kept URL-safe, and made unique per user. Uniqueness is
 * enforced by a database constraint as well — the lookup here just produces a
 * friendly slug instead of surfacing a conflict error.
 */

/** Map a file extension to the language token the editor highlights with. */
const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  md: "markdown",
  mdx: "markdown",
  svg: "xml",
  xml: "xml",
  yml: "yaml",
  yaml: "yaml",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sh: "shell",
  bash: "shell",
  sql: "sql",
  toml: "ini",
  ini: "ini",
  env: "ini",
  txt: "plaintext",
};

export function languageForPath(path: string): string {
  const name = path.split("/").pop() ?? path;
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  return LANGUAGE_BY_EXT[ext] ?? "plaintext";
}

/** Files we never fetch on import: binary, vendored or generated content. */
const SKIP_DIRS = [
  "node_modules/",
  ".git/",
  ".next/",
  "dist/",
  "build/",
  "out/",
  "coverage/",
  "vendor/",
  "__pycache__/",
  ".venv/",
];

const SKIP_EXT = [
  "png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "bmp", "tiff",
  "woff", "woff2", "ttf", "otf", "eot",
  "pdf", "zip", "gz", "tar", "rar", "7z", "jar",
  "mp3", "mp4", "mov", "avi", "webm", "wav", "ogg",
  "so", "dll", "dylib", "exe", "bin", "class", "o", "a",
  "lock", "snap", "wasm", "map",
];

/** True when a repository path is text we can store and edit. */
export function isImportablePath(path: string): boolean {
  if (!path || path.endsWith("/")) return false;
  if (path.split("/").length > 6) return false;
  if (SKIP_DIRS.some((d) => path.includes(d))) return false;
  const name = path.split("/").pop() ?? "";
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (SKIP_EXT.includes(ext)) return false;
  // Very large single files are not useful in an editor.
  return true;
}

export const MAX_IMPORT_FILES = 200;
export const MAX_FILE_BYTES = 200_000;

/** Produce a slug that is free for this user, appending -2, -3, ... */
export async function uniqueSlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  desired: string
): Promise<string> {
  const base = slugify(desired);
  const { data } = await supabase
    .from("projects")
    .select("slug")
    .eq("user_id", userId)
    .like("slug", `${base}%`);

  const taken = new Set((data ?? []).map((r: { slug: string }) => r.slug));
  if (!taken.has(base)) return base;

  for (let i = 2; i < 200; i++) {
    const candidate = `${base}-${i}`.slice(0, MAX_SLUG_LENGTH);
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, MAX_SLUG_LENGTH);
}

/** Fetch one project by slug, scoped to its owner. Null when not theirs. */
export async function getOwnedProject(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  slug: string
): Promise<Project | null> {
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .eq("slug", slug)
    .maybeSingle();
  return (data as Project) ?? null;
}

/** Default environment rows every new project starts with. */
export const DEFAULT_ENVIRONMENTS: {
  kind: "preview" | "terminal" | "dev_server";
  label: string;
  content: string;
  language: string;
  state: Record<string, unknown>;
}[] = [
  {
    kind: "preview",
    label: "Preview",
    content: "",
    language: "html",
    state: { status: "empty" },
  },
  {
    kind: "terminal",
    label: "Terminal",
    content: "",
    language: "shell",
    // Honest from the start: there is no shell in this deployment, so the
    // terminal shows the agent's real tool executions instead of a fake prompt.
    state: { status: "transcript" },
  },
  {
    kind: "dev_server",
    label: "Dev server",
    content: "",
    language: "plaintext",
    state: { status: "not_available" },
  },
];

/** Extension for a code artifact, derived from its language. */
const EXT_BY_LANGUAGE: Record<string, string> = {
  typescript: "ts",
  javascript: "js",
  tsx: "tsx",
  jsx: "jsx",
  python: "py",
  html: "html",
  css: "css",
  json: "json",
  markdown: "md",
  sql: "sql",
  shell: "sh",
  bash: "sh",
  yaml: "yml",
  go: "go",
  rust: "rs",
  java: "java",
  ruby: "rb",
  php: "php",
};

/** A safe filename for an artifact: slug plus the language's extension. */
export function artifactPath(title: string, language: string): string {
  const base = slugify(title || "artifact").slice(0, 48) || "artifact";
  const ext = EXT_BY_LANGUAGE[language.toLowerCase()] ?? "txt";
  return base.endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

/**
 * Apply an agent artifact to a project.
 *
 * Artifacts are no longer a floating viewer panel: rendered output (html, svg)
 * becomes the project's preview environment, and everything else becomes a real
 * file in the project that can be edited and pushed to Git.
 */
export async function applyArtifactToProject(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  artifact: { type: string; title: string; content: string; language: string }
): Promise<{ kind: "preview" | "file"; label: string }> {
  const now = new Date().toISOString();

  if (artifact.type === "html" || artifact.type === "svg") {
    const raw =
      artifact.type === "svg" && !artifact.content.includes("<svg")
        ? `<svg xmlns="http://www.w3.org/2000/svg">${artifact.content}</svg>`
        : artifact.content;

    // SVG is wrapped in a minimal document so the preview frame can render it.
    const document =
      artifact.type === "svg"
        ? `<!doctype html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#060607">${raw}</body></html>`
        : raw;

    await supabase.from("project_environments").upsert(
      {
        project_id: projectId,
        kind: "preview",
        label: artifact.title.slice(0, 80) || "Preview",
        content: document,
        language: "html",
        state: { status: "ready", source: artifact.title },
        updated_at: now,
      },
      { onConflict: "project_id,kind" }
    );
    return { kind: "preview", label: artifact.title };
  }

  const path = artifactPath(artifact.title, artifact.language || artifact.type);
  await supabase.from("project_files").upsert(
    {
      project_id: projectId,
      path,
      content: artifact.content,
      language: languageForPath(path),
      updated_at: now,
    },
    { onConflict: "project_id,path" }
  );
  return { kind: "file", label: path };
}
