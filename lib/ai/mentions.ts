/**
 * @file mentions and the File Picker sub-agent.
 *
 * - Explicit `@path` mentions inject real file contents into context.
 * - When a project is open and the user does not mention files, a fast
 *   File Picker call (pinned to Groq when available) selects relevant paths
 *   from the project tree. Bounded, real, and honest on failure.
 */
import type { ChatMsg } from "./cascade-router";
import { chatWithCascade } from "./cascade-router";

/** Extract @mentions that look like project paths (foo.ts, src/app/page.tsx). */
export function extractMentions(message: string): string[] {
  const found = new Set<string>();
  for (const match of message.matchAll(/@([\w./-]{2,200})/g)) {
    const candidate = match[1].replace(/[.,;)]+$/, "");
    if (/\.[a-z0-9]{1,12}$/i.test(candidate)) {
      found.add(candidate);
    }
  }
  return [...found];
}

/** Look up mentioned files among the project's real rows. */
export async function loadMentionedFiles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  projectId: string | null,
  paths: string[]
): Promise<{ path: string; content: string }[]> {
  if (!projectId || paths.length === 0) return [];
  const { data } = await supabase
    .from("project_files")
    .select("path, content")
    .eq("project_id", projectId)
    .in("path", paths.slice(0, 12));
  return (data ?? [])
    .filter((f: { content: unknown }) => typeof f.content === "string")
    .map((f: { path: string; content: string }) => ({
      path: f.path,
      content: f.content.slice(0, 60000),
    }));
}

/**
 * File Picker sub-agent: given a project tree and a request, choose the files
 * that matter. Pinned to Groq for speed; on any failure returns an empty list
 * (the run proceeds without injected files — never blocks).
 */
export async function pickRelevantFiles(
  request: string,
  tree: { path: string; size: number }[],
  maxFiles = 6
): Promise<string[]> {
  if (tree.length === 0 || tree.length > 400) return [];
  const listing = tree.map((f) => `${f.path} (${f.size ?? 0}b)`).join("\n");
  const messages: ChatMsg[] = [
    {
      role: "system",
      content:
        'You are a file picker. Given a project tree and a request, reply with ONLY a JSON array of the most relevant file paths (max 6). No prose. Example: ["src/app/page.tsx","package.json"]',
    },
    {
      role: "user",
      content: `Request: ${request.slice(0, 4000)}\n\nProject files:\n${listing}`,
    },
  ];
  try {
    const turn = await chatWithCascade(messages, {
      preferred: "Groq",
      timeoutMs: 12000,
    });
    const jsonText = turn.text.match(/\[[\s\S]*\]/)?.[0];
    if (!jsonText) return [];
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) return [];
    const valid = new Set(tree.map((f) => f.path));
    return parsed
      .filter((p: unknown) => typeof p === "string" && valid.has(p))
      .slice(0, maxFiles);
  } catch {
    return [];
  }
}

/** Build the injected-context system block for resolved files. */
export function fileContextBlock(
  files: { path: string; content: string }[]
): string {
  if (files.length === 0) return "";
  return (
    "Project files referenced in this request (real, current contents):\n\n" +
    files
      .map((f) => `--- FILE: ${f.path} ---\n${f.content}`)
      .join("\n\n")
  );
}
