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
  ];
  return specs;
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