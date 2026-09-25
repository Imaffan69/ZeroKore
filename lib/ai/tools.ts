/**
 * ZeroKore agent tools. Consistent interface: name / description /
 * input schema / execute(). Server-side only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Artifact, ArtifactType } from "@/types";
import type { ToolSpec } from "./cascade-router";
import { embedText, searchSimilarMemories } from "./memory";

export interface ToolExecResult {
  ok: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;
  error?: string;
}

export interface ToolContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>;
  userId: string;
  /** Active project id (verified owner). File tools are project-scoped. */
  projectId: string | null;
}

const ARTIFACT_TYPES: ArtifactType[] = ["code", "html", "svg", "markdown"];

export function toolSpecs(tavilyAvailable: boolean): ToolSpec[] {
  const specs: ToolSpec[] = [
    {
      name: "web_search",
      description: tavilyAvailable
        ? "Search the live web. Returns title, url, snippet per result. Use for current events, facts, comparisons, documentation."
        : "Web search is NOT configured. Do not call this tool; answer from model knowledge and say search is unavailable if asked.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          max_results: { type: "number", description: "1-8 results (default 5)" },
        },
        required: ["query"],
      },
    },
    {
      name: "search_memory",
      description:
        "Search the user's long-term memory for relevant saved context (preferences, project facts, decisions).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to recall" },
        },
        required: ["query"],
      },
    },
    {
      name: "store_memory",
      description:
        "Save durable long-term information about the user (preferences, recurring project context, decisions). Do NOT store secrets, passwords, tokens, or every message — only durable facts.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Concise fact to remember" },
        },
        required: ["content"],
      },
    },
    {
      name: "delete_memory",
      description: "Delete a saved memory by its id (ids come from search_memory).",
      parameters: {
        type: "object",
        properties: {
          memory_id: { type: "string", description: "Memory row id" },
        },
        required: ["memory_id"],
      },
    },
    {
      name: "generate_artifact",
      description:
        "Create a viewer artifact (code file, standalone HTML page, SVG graphic, or Markdown doc). Call when the user asks for code, a page, a diagram, or a document. Content must be complete and self-contained.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["code", "html", "svg", "markdown"],
            description: "Artifact kind",
          },
          title: { type: "string", description: "Filename or title" },
          content: { type: "string", description: "Full artifact content" },
          language: {
            type: "string",
            description: "Language for code/markdown (e.g. typescript, python, html, svg, markdown)",
          },
        },
        required: ["type", "title", "content"],
      },
    },
    ...fileToolSpecs(),
  ];
  return specs;
}

/** Project file tools — operate on the caller's own project_files rows. */
function fileToolSpecs(): ToolSpec[] {
  return [
    {
      name: "list_files",
      description:
        "List every file in the current project (path, size, kind). Free and fast — call this first before editing files.",
      parameters: { type: "object", properties: {} },
    },
    {
      name: "read_file",
      description:
        "Read the full content of one project file by path. Works for any text file (ts/js/py/go/rs/java/cpp/php/rb/kt/swift/json/yaml/xml/csv/env/Dockerfile/md/…); binaries are refused.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path within the project" },
        },
        required: ["path"],
      },
    },
    {
      name: "write_file",
      description:
        "Create a new project file or overwrite an existing one with COMPLETE content. Prefer edit_file for small changes.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path within the project" },
          content: { type: "string", description: "Full file content" },
        },
        required: ["path", "content"],
      },
    },
    {
      name: "edit_file",
      description:
        "Surgically edit an existing project file: replace an exact old_string with new_string. Failures report the closest match; never rewrite the whole file for small edits.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path within the project" },
          old_string: { type: "string", description: "Exact text to replace" },
          new_string: { type: "string", description: "Replacement text" },
        },
        required: ["path", "old_string", "new_string"],
      },
    },
    {
      name: "delete_file",
      description: "Delete a project file by path. Use only when removal is intended.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path within the project" },
        },
        required: ["path"],
      },
    },
  ];
}

export interface ExecutedTool {
  artifact: Artifact | null;
  execResult: ToolExecResult;
}

/**
 * Execute one tool call. Never throws — returns { ok:false } on failure
 * so the agent can continue where safe.
 */
export async function executeTool(
  ctx: ToolContext,
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>
): Promise<ExecutedTool> {
  try {
    switch (name) {
      case "web_search":
        return { artifact: null, execResult: await runWebSearch(args) };
      case "search_memory":
        return {
          artifact: null,
          execResult: await runSearchMemory(ctx, args),
        };
      case "store_memory":
        return {
          artifact: null,
          execResult: await runStoreMemory(ctx, args),
        };
      case "delete_memory":
        return {
          artifact: null,
          execResult: await runDeleteMemory(ctx, args),
        };
      case "generate_artifact":
        return runGenerateArtifact(args);
      case "list_files":
        return { artifact: null, execResult: await runListFiles(ctx) };
      case "read_file":
        return { artifact: null, execResult: await runReadFile(ctx, args) };
      case "write_file":
        return { artifact: null, execResult: await runWriteFile(ctx, args) };
      case "edit_file":
        return { artifact: null, execResult: await runEditFile(ctx, args) };
      case "delete_file":
        return { artifact: null, execResult: await runDeleteFile(ctx, args) };
      default:
        return {
          artifact: null,
          execResult: { ok: false, error: `Unknown tool: ${name}` },
        };
    }
  } catch (err) {
    return {
      artifact: null,
      execResult: {
        ok: false,
        error: err instanceof Error ? err.message : "Tool execution failed.",
      },
    };
  }
}

async function runWebSearch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>
): Promise<ToolExecResult> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Web search is unavailable (not configured). Continue without search if possible.",
    };
  }
  const query = String(args?.query ?? "").trim().slice(0, 500);
  if (!query) return { ok: false, error: "Search query must not be empty." };
  const maxResults = Math.min(Math.max(Number(args?.max_results ?? 5), 1), 8);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        search_depth: "advanced",
        include_answer: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `Search provider error (${res.status}). Continue without search if possible.`,
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const results = (data?.results ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => ({
        title: String(r?.title ?? "Untitled"),
        url: String(r?.url ?? ""),
        snippet: String(r?.content ?? "").slice(0, 600),
      })
    );
    return { ok: true, result: { results } };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error && err.name === "AbortError"
          ? "Search timed out. Continue without search if possible."
          : "Search failed. Continue without search if possible.",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runSearchMemory(
  ctx: ToolContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>
): Promise<ToolExecResult> {
  const query = String(args?.query ?? "").trim().slice(0, 500);
  if (!query) return { ok: false, error: "Memory query must not be empty." };
  try {
    const embedding = embedText(query);
    const hits = await searchSimilarMemories(
      ctx.supabase,
      ctx.userId,
      embedding,
      5
    );
    return {
      ok: true,
      result: {
        memories: hits.map((h) => ({ id: h.id, content: h.content })),
      },
    };
  } catch {
    console.log(JSON.stringify({ event: "memory_search_failed" }));
    return {
      ok: false,
      error: "Memory search failed. Continue without memory.",
    };
  }
}

async function runStoreMemory(
  ctx: ToolContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>
): Promise<ToolExecResult> {
  const content = String(args?.content ?? "").trim().slice(0, 2000);
  if (!content) return { ok: false, error: "Memory content must not be empty." };
  if (/password|secret|token|api[_-]?key|ssn/i.test(content)) {
    return {
      ok: false,
      error: "Refusing to store potential secrets. Do not save credentials.",
    };
  }
  try {
    const embedding = embedText(content);
    const { error } = await ctx.supabase.from("agent_memory").insert({
      user_id: ctx.userId,
      content,
      embedding: `[${embedding.join(",")}]`,
    });
    if (error) throw new Error(error.message);
    console.log(JSON.stringify({ event: "memory_saved" }));
    return { ok: true, result: { saved: true } };
  } catch {
    return {
      ok: false,
      error: "Memory storage failed. Continue without saving.",
    };
  }
}

async function runDeleteMemory(
  ctx: ToolContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>
): Promise<ToolExecResult> {
  const id = String(args?.memory_id ?? "").trim();
  if (!id) return { ok: false, error: "memory_id is required." };
  const { error } = await ctx.supabase
    .from("agent_memory")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.userId);
  if (error) return { ok: false, error: "Could not delete that memory." };
  return { ok: true, result: { deleted: true } };
}

function runGenerateArtifact(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>
): ExecutedTool {
  const type = String(args?.type ?? "") as ArtifactType;
  const title = String(args?.title ?? "artifact").slice(0, 120) || "artifact";
  const content = String(args?.content ?? "");
  const language = String(args?.language ?? type ?? "text").slice(0, 40);

  if (!ARTIFACT_TYPES.includes(type)) {
    return {
      artifact: null,
      execResult: {
        ok: false,
        error: `Invalid artifact type. Must be one of: ${ARTIFACT_TYPES.join(", ")}.`,
      },
    };
  }
  if (!content || content.length > 200000) {
    return {
      artifact: null,
      execResult: { ok: false, error: "Artifact content is empty or too large." },
    };
  }
  const artifact: Artifact = { type, title, content, language };
  console.log(JSON.stringify({ event: "artifact_generated", type, title }));
  return {
    artifact,
    execResult: {
      ok: true,
      result: { generated: true, type, title },
    },
  };
}

// ============================================================
// Project file tools — real rows in project_files, owner-scoped.
// ============================================================

/** Extensions we can safely treat as text. Everything else is refused. */
const TEXT_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "jsonc", "md", "mdx", "txt",
  "css", "scss", "sass", "less", "html", "htm", "xml", "svg", "yml", "yaml",
  "toml", "ini", "cfg", "conf", "env", "properties", "py", "rb", "go", "rs",
  "java", "kt", "kts", "swift", "c", "h", "cpp", "cc", "cxx", "hpp", "cs",
  "php", "pl", "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd", "sql",
  "graphql", "gql", "proto", "vue", "svelte", "astro", "dart", "lua", "r",
  "gitignore", "editorconfig", "npmrc", "nvmrc", "babelrc", "eslintrc",
  "prettierrc", "dockerfile", "makefile", "lock",
]);

function isTextPath(path: string): boolean {
  const base = path.split("/").pop() ?? path;
  const ext = base.includes(".")
    ? base.split(".").pop()!.toLowerCase()
    : base.toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

function projectFileError(message: string): ToolExecResult {
  return { ok: false, error: message };
}

async function loadProjectFile(
  ctx: ToolContext,
  path: string
): Promise<ProjectFileRow | null> {
  const { data } = await ctx.supabase
    .from("project_files")
    .select("id, path, content, size")
    .eq("project_id", ctx.projectId!)
    .eq("path", path)
    .maybeSingle();
  return (data as ProjectFileRow) ?? null;
}

interface ProjectFileRow {
  id: string;
  path: string;
  content: string | null;
  size: number | null;
}

async function saveFileVersion(
  ctx: ToolContext,
  file: { id: string; path: string; content: string | null }
): Promise<void> {
  try {
    await ctx.supabase.from("file_versions").insert({
      file_id: file.id,
      project_id: ctx.projectId!,
      path: file.path,
      content: file.content,
      size: file.content?.length ?? 0,
      edited_by: "agent",
    });
  } catch {
    // history is best-effort
  }
}

async function runListFiles(ctx: ToolContext): Promise<ToolExecResult> {
  if (!ctx.projectId) {
    return projectFileError(
      "No project is open. File tools need a project — ask the user to open one."
    );
  }
  const { data, error } = await ctx.supabase
    .from("project_files")
    .select("path, size, content")
    .eq("project_id", ctx.projectId)
    .order("path", { ascending: true });
  if (error) return projectFileError("Could not list project files.");
  const files = (data ?? []).map((f) => ({
    path: f.path,
    size: f.size ?? (f.content?.length ?? 0),
    kind: isTextPath(f.path) ? "text" : "binary",
  }));
  return { ok: true, result: { count: files.length, files } };
}

async function runReadFile(
  ctx: ToolContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>
): Promise<ToolExecResult> {
  if (!ctx.projectId) {
    return projectFileError("No project is open. File tools need an active project.");
  }
  const path = String(args?.path ?? "").trim().replace(/^\/+/, "").slice(0, 400);
  if (!path) return projectFileError("path is required.");
  if (!isTextPath(path)) {
    return projectFileError(
      `"${path}" does not look like a text file. Only text files can be read or edited.`
    );
  }
  const file = await loadProjectFile(ctx, path);
  if (!file) return projectFileError(`No file at "${path}". Use list_files to see the tree.`);
  return {
    ok: true,
    result: {
      path: file.path,
      size: file.size ?? file.content?.length ?? 0,
      content: (file.content ?? "").slice(0, 100000),
    },
  };
}

async function runWriteFile(
  ctx: ToolContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>
): Promise<ToolExecResult> {
  if (!ctx.projectId) {
    return projectFileError("No project is open. File tools need an active project.");
  }
  const path = String(args?.path ?? "").trim().replace(/^\/+/, "").slice(0, 400);
  const content = typeof args?.content === "string" ? args.content : "";
  if (!path) return projectFileError("path is required.");
  if (!isTextPath(path)) {
    return projectFileError(
      `"${path}" is not a supported text file type. Text files only (ts/py/json/yaml/md/env/Dockerfile/…).`
    );
  }
  if (content.length > 300000) return projectFileError("File content too large (300k char limit).");

  const existing = await loadProjectFile(ctx, path);
  if (existing) await saveFileVersion(ctx, existing);

  if (existing) {
    await ctx.supabase
      .from("project_files")
      .update({ content, size: content.length, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await ctx.supabase.from("project_files").insert({
      project_id: ctx.projectId,
      path,
      content,
      size: content.length,
    });
  }
  console.log(JSON.stringify({ event: "file_written", path, created: !existing }));
  return {
    ok: true,
    result: { written: true, path, created: !existing, size: content.length },
  };
}

async function runEditFile(
  ctx: ToolContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>
): Promise<ToolExecResult> {
  if (!ctx.projectId) {
    return projectFileError("No project is open. File tools need an active project.");
  }
  const path = String(args?.path ?? "").trim().replace(/^\/+/, "").slice(0, 400);
  const oldString = typeof args?.old_string === "string" ? args.old_string : "";
  const newString = typeof args?.new_string === "string" ? args.new_string : "";
  if (!path || !oldString) return projectFileError("path and old_string are required.");
  if (!isTextPath(path)) {
    return projectFileError(`"${path}" is not a supported text file type.`);
  }
  const file = await loadProjectFile(ctx, path);
  if (!file) return projectFileError(`No file at "${path}". Use list_files first.`);
  const current = file.content ?? "";
  if (!current.includes(oldString)) {
    const probe = oldString.split("\n")[0].slice(0, 80);
    const near = current.split("\n").findIndex((l) => probe && l.includes(probe));
    return projectFileError(
      `old_string not found in "${path}".` +
        (near >= 0
          ? ` A similar line exists at line ${near + 1}; read the file and retry with exact text.`
          : " Read the file and retry with exact text.")
    );
  }
  const occurrences = current.split(oldString).length - 1;
  if (occurrences > 1) {
    return projectFileError(
      `old_string appears ${occurrences} times in "${path}". Include more surrounding context so it is unique.`
    );
  }
  await saveFileVersion(ctx, file);
  const next = current.replace(oldString, newString);
  await ctx.supabase
    .from("project_files")
    .update({ content: next, size: next.length, updated_at: new Date().toISOString() })
    .eq("id", file.id);
  console.log(JSON.stringify({ event: "file_edited", path }));
  return {
    ok: true,
    result: { edited: true, path, replaced: oldString.length, inserted: newString.length },
  };
}

async function runDeleteFile(
  ctx: ToolContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>
): Promise<ToolExecResult> {
  if (!ctx.projectId) {
    return projectFileError("No project is open. File tools need an active project.");
  }
  const path = String(args?.path ?? "").trim().replace(/^\/+/, "").slice(0, 400);
  if (!path) return projectFileError("path is required.");
  const file = await loadProjectFile(ctx, path);
  if (!file) return projectFileError(`No file at "${path}".`);
  await saveFileVersion(ctx, file);
  await ctx.supabase.from("project_files").delete().eq("id", file.id);
  console.log(JSON.stringify({ event: "file_deleted", path }));
  return { ok: true, result: { deleted: true, path } };
}