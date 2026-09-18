import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { SkillDetail, SkillSummary } from "@/types";

/**
 * Server-side skill reader.
 *
 * Skills are plain markdown files committed with the repository at
 * `.claude/skills/<name>/SKILL.md`, optionally with supporting files beside
 * them. Nothing here is user-authored data, so it is read from disk rather
 * than the database — but it is still served exclusively through an
 * authenticated route handler so the filesystem is never exposed directly.
 */

const SKILLS_DIR = path.join(process.cwd(), ".claude", "skills");
const SKILL_FILENAME = "SKILL.md";

/** Guards against path traversal: only simple slug-shaped directory names. */
const SAFE_NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

const MAX_CONTENT_BYTES = 512 * 1024;
const MAX_RESOURCES = 50;
const MAX_RESOURCE_DEPTH = 3;

interface Frontmatter {
  name?: string;
  description?: string;
}

/** Collapse a raw frontmatter value: strip block scalars and surrounding quotes. */
function cleanValue(value: string): string {
  let out = value.trim();
  // Folded (`>`) or literal (`|`) block scalar indicators.
  out = out.replace(/^[>|][-+\d]*\s*/, "");
  const quoted =
    (out.startsWith('"') && out.endsWith('"') && out.length > 1) ||
    (out.startsWith("'") && out.endsWith("'") && out.length > 1);
  if (quoted) out = out.slice(1, -1);
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Parse the leading `---` frontmatter block. Supports single-line values,
 * quoted values and YAML folded/plain multi-line scalars, which covers every
 * shape the committed skills use. Nested maps (e.g. `metadata:`) are ignored
 * rather than parsed — we only need `name` and `description`.
 */
function parseFrontmatter(raw: string): { data: Frontmatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { data: {}, body: raw };

  const data: Frontmatter = {};
  let key: string | null = null;
  let buffer: string[] = [];

  const commit = () => {
    if (key === "name" || key === "description") {
      data[key] = cleanValue(buffer.join(" "));
    }
    buffer = [];
  };

  for (const line of match[1].split(/\r?\n/)) {
    // Indented lines continue the current key (folded scalars and nested maps).
    if (/^\s/.test(line)) {
      if (key && line.trim()) buffer.push(line.trim());
      continue;
    }
    const top = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!top) continue;
    commit();
    key = top[1];
    buffer = [top[2]];
  }
  commit();

  return { data, body: raw.slice(match[0].length) };
}

/** Humanise `vercel-react-best-practices` → `Vercel React Best Practices`. */
function titleFromSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Collect supporting file paths beside SKILL.md, capped for safety. */
async function collectResources(dir: string, prefix = "", depth = 0): Promise<string[]> {
  if (depth > MAX_RESOURCE_DEPTH) return [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const found: string[] = [];
  for (const entry of entries) {
    if (found.length >= MAX_RESOURCES) break;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      found.push(...(await collectResources(path.join(dir, entry.name), rel, depth + 1)));
    } else if (entry.name !== SKILL_FILENAME) {
      found.push(rel);
    }
  }
  return found;
}

async function readSkillDir(name: string): Promise<SkillDetail | null> {
  if (!SAFE_NAME.test(name)) return null;

  const dir = path.join(SKILLS_DIR, name);
  // Defence in depth: the resolved directory must stay inside the skills root.
  const root = path.resolve(SKILLS_DIR) + path.sep;
  if (!path.resolve(dir).startsWith(root)) return null;

  let raw: string;
  let bytes: number;
  try {
    const file = path.join(dir, SKILL_FILENAME);
    const info = await stat(file);
    if (!info.isFile() || info.size > MAX_CONTENT_BYTES) return null;
    bytes = info.size;
    raw = await readFile(file, "utf8");
  } catch {
    return null;
  }

  const { data, body } = parseFrontmatter(raw);
  const resources = await collectResources(dir);

  return {
    name,
    title: data.name?.trim() || titleFromSlug(name),
    description: data.description?.trim() || "No description provided.",
    bytes,
    resourceCount: resources.length,
    resourceNames: resources.slice(0, MAX_RESOURCES),
    content: body.trim(),
  };
}

/** List every available skill, alphabetically. Never throws. */
export async function listSkills(): Promise<SkillSummary[]> {
  let entries;
  try {
    entries = await readdir(SKILLS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  const names = entries
    .filter((e) => e.isDirectory() && SAFE_NAME.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  const skills = await Promise.all(names.map((name) => readSkillDir(name)));

  return skills
    .filter((s): s is SkillDetail => s !== null)
    .map((s) => ({
      name: s.name,
      title: s.title,
      description: s.description,
      bytes: s.bytes,
      resourceCount: s.resourceCount,
    }));
}

/** Read one skill including its markdown body. Returns null when absent. */
export async function getSkill(name: string): Promise<SkillDetail | null> {
  return readSkillDir(name);
}
