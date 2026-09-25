/**
 * ZeroKore AI model registry + cascade router.
 *
 * Four providers: Groq → DeepSeek → SambaNova → Gemini.
 * - "auto" preference walks the cascade in order (only on retryable errors).
 * - An explicit preference pins ONE provider: it is tried alone and its
 *   failures surface to the user instead of silently switching models.
 * Fails fast on 400 (malformed internal request = our bug, not the provider's).
 * Server-side only. Never logs or returns API keys.
 */

import {
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_BASE,
  openRouterProviderName,
  parseOpenRouterProvider,
  isOpenRouterConfigured,
  availableOpenRouterModels,

} from "@/lib/ai/openrouter";

export interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
  /**
   * The tool calls this assistant turn asked for. Every provider requires a
   * `tool` result message to be preceded by the assistant turn that requested
   * it, carrying the matching ids — a `tool` message whose parent has no
   * `tool_calls` (OpenAI shape) or `functionCall` part (Gemini shape) is
   * rejected with a 400 and breaks the entire turn.
   */
  toolCalls?: UnifiedToolCall[];
}

export interface ToolSpec {
  name: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters: Record<string, any>;
}

export interface UnifiedToolCall {
  id: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>;
}

export interface ProviderChatResult {
  text: string;
  toolCalls: UnifiedToolCall[];
  /** Real usage from the provider response; 0 when the provider omits it. */
  promptTokens?: number;
  completionTokens?: number;
}

export interface CascadeResult extends ProviderChatResult {
  provider: string;
  fallbackFrom?: string;
}

interface ProviderDef {
  name: string;
  model: string;
  apiKey: string | undefined;
}

/** Stable id used in the UI model picker. */
export type ProviderId = "Groq" | "DeepSeek" | "SambaNova" | "Gemini";

/** Registry rows for the model picker (availability resolved separately). */
export const MODEL_REGISTRY: { id: ProviderId; label: string; model: string }[] = [
  { id: "Groq", label: "Groq · GPT-OSS 120B", model: "openai/gpt-oss-120b" },
  { id: "DeepSeek", label: "DeepSeek · deepseek-chat", model: "deepseek-chat" },
  { id: "SambaNova", label: "SambaNova · Llama 3.3 70B", model: "Meta-Llama-3.3-70B-Instruct" },
  { id: "Gemini", label: "Gemini · 2.5 Flash", model: "gemini-2.5-flash" },
];

function providers(): ProviderDef[] {
  const list: ProviderDef[] = [
    {
      name: "Groq",
      // llama-3.3-70b-versatile was retired by Groq; gpt-oss-120b is the
      // live flagship chat model on Groq with tool-calling support.
      model: "openai/gpt-oss-120b",
      apiKey: process.env.GROQ_API_KEY,
    },
    {
      name: "DeepSeek",
      model: "deepseek-chat",
      apiKey: process.env.DEEPSEEK_API_KEY,
    },
    {
      name: "SambaNova",
      // Meta-Llama-3.1-70B-Instruct is not served; Meta-Llama-3.3-70B-Instruct
      // is the live Llama 70B Instruct model on SambaNova.
      model: "Meta-Llama-3.3-70B-Instruct",
      apiKey: process.env.SAMBANOVA_API_KEY,
    },
    {
      name: "Gemini",
      // gemini-2.5-flash is the current live, GA chat model on the Gemini API.
      model: "gemini-2.5-flash",
      apiKey: process.env.GEMINI_API_KEY,
    },
  ];

  // OpenRouter models are appended last so they are only reached by the cascade
  // after the dedicated providers, and are never tried when no key is set.
  // Only the default model joins the automatic cascade; the rest are reachable
  // by explicit selection in the model picker.
  if (isOpenRouterConfigured()) {
    list.push({
      name: openRouterProviderName(OPENROUTER_DEFAULT_MODEL),
      model: OPENROUTER_DEFAULT_MODEL,
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }

  return list;
}

/**
 * Every selectable model, including the OpenRouter entries that are not part of
 * the automatic cascade. Used to populate the model picker.
 */
function selectableProviders(): ProviderDef[] {
  const list = providers();
  if (!isOpenRouterConfigured()) return list;
  const key = process.env.OPENROUTER_API_KEY;
  for (const m of availableOpenRouterModels()) {
    list.push({
      name: openRouterProviderName(m.id),
      model: m.id,
      apiKey: key,
    });
  }
  return list;
}

export function configuredProviders(): string[] {
  return providers()
    .filter((p) => !!p.apiKey)
    .map((p) => p.name);
}

/** Model-picker rows for the client: which models have keys behind them. */
export function providerCatalog(): {
  id: string;
  label: string;
  model: string;
  configured: boolean;
  group?: string;
}[] {
  const rows: {
    id: string;
    label: string;
    model: string;
    configured: boolean;
    group?: string;
  }[] = MODEL_REGISTRY.map((entry) => ({
    id: entry.id,
    label: entry.label,
    model: entry.model,
    configured: selectableProviders().some(
      (d) => d.name === entry.id && !!d.apiKey
    ),
  }));

  if (isOpenRouterConfigured()) {
    const key = process.env.OPENROUTER_API_KEY;
    for (const m of availableOpenRouterModels()) {
      rows.push({
        id: openRouterProviderName(m.id),
        label: `${m.label}${m.free ? " · free" : ""}`,
        model: m.id,
        configured: !!key,
        group: m.group,
      });
    }
  }

  return rows;
}

class RetryableError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "RetryableError";
    this.status = status;
  }
}

class FatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FatalError";
  }
}

/**
 * Extract the provider's own explanation from an error response so a failure
 * can be shown and debugged instead of guessed at. Reads at most one body and
 * never touches headers, keys or tokens.
 */
async function describeError(res: Response): Promise<string> {
  try {
    const text = (await res.text()).slice(0, 2000);
    if (!text) return "";
    try {
      const parsed = JSON.parse(text);
      const raw =
        parsed?.error?.message ??
        parsed?.message ??
        parsed?.detail ??
        parsed?.error;
      if (typeof raw === "string" && raw.trim()) {
        return `: ${raw.replace(/\s+/g, " ").trim().slice(0, 240)}`;
      }
    } catch {
      return `: ${text.replace(/\s+/g, " ").trim().slice(0, 240)}`;
    }
  } catch {
    // Body already consumed or unreadable — the status code still tells the story.
  }
  return "";
}

function toOpenAITools(tools: ToolSpec[] | undefined) {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

function toOpenAIMessages(messages: ChatMsg[]) {
  const out: Record<string, unknown>[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      out.push({ role: "system", content: m.content });
      continue;
    }
    if (m.role === "tool") {
      out.push({
        role: "tool",
        // A tool message must never be empty for OpenAI-compatible providers.
        content: m.content || "(no output)",
        tool_call_id: m.toolCallId ?? "",
      });
      continue;
    }
    if (m.role === "assistant") {
      if (m.toolCalls && m.toolCalls.length > 0) {
        // Echo the request back with its ids so the tool results are valid.
        out.push({
          role: "assistant",
          content: m.content || null,
          tool_calls: m.toolCalls.map((c) => ({
            id: c.id,
            type: "function",
            function: {
              name: c.name,
              arguments: JSON.stringify(c.args ?? {}),
            },
          })),
        });
        continue;
      }
      // An assistant turn with no text and no tool calls carries no meaning and
      // is rejected by some providers — drop it instead of sending "".
      if (!m.content) continue;
      out.push({ role: "assistant", content: m.content });
      continue;
    }
    out.push({ role: "user", content: m.content });
  }
  return out;
}

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMsg[],
  tools: ToolSpec[] | undefined,
  timeoutMs: number
): Promise<ProviderChatResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: toOpenAIMessages(messages),
        tools: toOpenAITools(tools),
        tool_choice: tools && tools.length > 0 ? "auto" : undefined,
        temperature: 0.4,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });

    if (res.status === 400) {
      // A 400 is provider-side validation (e.g. a tool turn it refused). Treat
      // it as retryable so the cascade falls through to the next provider
      // instead of failing the user's entire request.
      throw new RetryableError(
        `Provider rejected the request (400)${await describeError(res)}.`,
        400
      );
    }
    if (res.status === 429 || res.status >= 500) {
      throw new RetryableError(`Provider error (${res.status}).`, res.status);
    }
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new RetryableError(
        `Provider rejected our credentials or model (${res.status})${await describeError(res)}.`,
        res.status
      );
    }
    if (!res.ok) {
      throw new RetryableError(`Provider error (${res.status}).`, res.status);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const choice = data?.choices?.[0]?.message;
    if (!choice) throw new RetryableError("Empty provider response.");

    const toolCalls: UnifiedToolCall[] = [];
    const rawCalls = choice.tool_calls ?? [];
    for (const c of rawCalls) {
      if (c?.type === "function" && c?.function?.name) {
        let args: Record<string, unknown> = {};
        try {
          args = c.function.arguments ? JSON.parse(c.function.arguments) : {};
        } catch {
          args = {};
        }
        toolCalls.push({
          id: c.id ?? `call_${Math.random().toString(36).slice(2)}`,
          name: c.function.name,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          args: args as any,
        });
      }
    }
    return {
      text: choice.content ?? "",
      toolCalls,
      promptTokens: data?.usage?.prompt_tokens ?? 0,
      completionTokens: data?.usage?.completion_tokens ?? 0,
    };
  } catch (err) {
    if (err instanceof RetryableError || err instanceof FatalError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new RetryableError("Provider timed out.");
    }
    throw new RetryableError(
      err instanceof Error ? `Network error: ${err.message}` : "Network error."
    );
  } finally {
    clearTimeout(timer);
  }
}

function toGeminiContents(messages: ChatMsg[]) {
  const system: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = [];
  const pushToolResponses = (group: ChatMsg[]) => {
    // Gemini requires every functionResponse that answers one model turn to
    // live in a SINGLE user turn. Emitting them as consecutive user turns
    // fails with 400 ("function response turn comes immediately after a
    // function call turn"), which is exactly what multi-tool replies produced.
    contents.push({
      role: "user",
      parts: group.map((m) => ({
        functionResponse: {
          name: m.toolName ?? "tool",
          response: { result: m.content },
        },
      })),
    });
  };
  let toolGroup: ChatMsg[] = [];
  const flushTools = () => {
    if (toolGroup.length > 0) {
      pushToolResponses(toolGroup);
      toolGroup = [];
    }
  };
  for (const m of messages) {
    if (m.role === "system") {
      system.push(m.content);
      continue;
    }
    if (m.role === "tool") {
      toolGroup.push(m);
      continue;
    }
    flushTools();
    if (m.role === "assistant") {
      // Gemini expects the model turn to carry the functionCall parts that the
      // following functionResponse answers. Empty text parts are invalid.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const c of m.toolCalls ?? []) {
        parts.push({ functionCall: { name: c.name, args: c.args ?? {} } });
      }
      if (parts.length === 0) continue;
      contents.push({ role: "model", parts });
      continue;
    }
    if (!m.content) continue;
    contents.push({ role: "user", parts: [{ text: m.content }] });
  }
  flushTools();
  return { system: system.join("\n\n"), contents };
}

async function geminiOnce(
  apiKey: string,
  model: string,
  messages: ChatMsg[],
  tools: ToolSpec[] | undefined,
  timeoutMs: number
): Promise<ProviderChatResult> {
  const { system, contents } = toGeminiContents(messages);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents,
          tools:
            tools && tools.length > 0
              ? [
                  {
                    functionDeclarations: tools.map((t) => ({
                      name: t.name,
                      description: t.description,
                      parameters: t.parameters,
                    })),
                  },
                ]
              : undefined,
          generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
        }),
        signal: controller.signal,
      }
    );

    if (res.status === 400) {
      // Retryable, not fatal: the cascade should try the next provider rather
      // than aborting the user's request on one provider's validation error.
      throw new RetryableError(
        `Gemini rejected the request (400)${await describeError(res)}.`,
        400
      );
    }
    if (res.status === 429 || res.status >= 500) {
      throw new RetryableError(`Provider error (${res.status}).`, res.status);
    }
    if (!res.ok) {
      throw new RetryableError(`Provider error (${res.status}).`, res.status);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    let text = "";
    const toolCalls: UnifiedToolCall[] = [];
    for (const p of parts) {
      if (typeof p?.text === "string") text += p.text;
      if (p?.functionCall?.name) {
        toolCalls.push({
          id: `call_${Math.random().toString(36).slice(2)}`,
          name: p.functionCall.name,
          args: p.functionCall.args ?? {},
        });
      }
    }
    if (!text && toolCalls.length === 0) {
      throw new RetryableError("Empty provider response.");
    }
    return {
      text,
      toolCalls,
      promptTokens: data?.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
    };
  } catch (err) {
    if (err instanceof RetryableError || err instanceof FatalError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new RetryableError("Provider timed out.");
    }
    throw new RetryableError(
      err instanceof Error ? `Network error: ${err.message}` : "Network error."
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Chat models to try, best first.
 *
 * A model id can be retired by the provider at any time — and a retired id
 * answers with 404, which is what made the Gemini option look "broken" while
 * the other three providers kept working. So a 404 is treated as "try the next
 * name", never as a user-facing failure.
 */
const GEMINI_MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-2.5-pro",
  "gemini-pro-latest",
  "gemini-1.5-flash",
];

/** Resolved once per server process: the last model name that answered. */
let geminiModelInUse: string | null = null;

/** Ask the API which models this key can actually call. */
async function discoverGeminiModel(apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${apiKey}`,
      { signal: AbortSignal.timeout(8_000) }
    );
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const models: any[] = Array.isArray(data?.models) ? data.models : [];
    const usable = models
      .filter(
        (m) =>
          Array.isArray(m?.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes("generateContent")
      )
      .map((m) => String(m?.name ?? "").replace(/^models\//, ""))
      .filter((n) => !!n && !/embedding|aqa|imagen|veo|tts|image/i.test(n));
    // A flash model is the cheapest capable option; otherwise take what exists.
    return (
      usable.find((n) => /flash/.test(n) && !/exp|thinking/.test(n)) ??
      usable[0] ??
      null
    );
  } catch {
    return null;
  }
}

/**
 * Call Gemini, healing a stale model name on the way through.
 *
 * Order: the model that last worked, the configured model, then the known
 * candidates, and finally whatever `ListModels` reports for this key. The first
 * answer wins and is remembered for the rest of the process.
 */
async function callGemini(
  apiKey: string,
  model: string,
  messages: ChatMsg[],
  tools: ToolSpec[] | undefined,
  timeoutMs: number
): Promise<ProviderChatResult> {
  const tried = new Set<string>();
  const order = [geminiModelInUse, model, ...GEMINI_MODEL_CANDIDATES].filter(
    (m): m is string => !!m
  );

  let lastError: unknown = null;
  for (const candidate of order) {
    if (tried.has(candidate)) continue;
    tried.add(candidate);
    try {
      const result = await geminiOnce(
        apiKey,
        candidate,
        messages,
        tools,
        timeoutMs
      );
      geminiModelInUse = candidate;
      return result;
    } catch (err) {
      lastError = err;
      const notFound = err instanceof RetryableError && err.status === 404;
      if (!notFound) throw err;
    }
  }

  // Nothing known worked — ask the API what it serves and try that once.
  const discovered = await discoverGeminiModel(apiKey);
  if (discovered && !tried.has(discovered)) {
    const result = await geminiOnce(
      apiKey,
      discovered,
      messages,
      tools,
      timeoutMs
    );
    geminiModelInUse = discovered;
    return result;
  }

  throw lastError instanceof Error
    ? lastError
    : new RetryableError("Gemini has no available model for this API key.", 404);
}

const OPENAI_BASES: Record<string, string> = {
  Groq: "https://api.groq.com/openai/v1",
  DeepSeek: "https://api.deepseek.com/v1",
  SambaNova: "https://api.sambanova.ai/v1",
};

/**
 * Dispatch one chat turn to the right transport for a provider.
 *
 * Gemini uses its own generateContent shape; everything else is
 * OpenAI-compatible. OpenRouter is OpenAI-compatible too, so it reuses that
 * path with its own base URL — which is why 15 extra models needed no new
 * request code.
 */
async function callProvider(
  p: ProviderDef,
  messages: ChatMsg[],
  tools: ToolSpec[] | undefined,
  timeoutMs: number
): Promise<ProviderChatResult> {
  if (p.name === "Gemini") {
    return callGemini(p.apiKey!, p.model, messages, tools, timeoutMs);
  }
  const openRouter = parseOpenRouterProvider(p.name);
  return callOpenAICompatible(
    openRouter ? OPENROUTER_BASE : OPENAI_BASES[p.name],
    p.apiKey!,
    p.model,
    messages,
    tools,
    timeoutMs
  );
}

/**
 * Run one chat turn across the cascade. Returns the first successful result.
 *
 * `preferred` pins an exact provider (model selection like Freebuff/v0):
 * only that provider runs; its failure is returned as a clean, user-safe
 * error so the user can retry or pick another model — never a silent switch.
 * "auto" (the default) walks the configured cascade in order.
 */
export async function chatWithCascade(
  messages: ChatMsg[],
  opts?: {
    tools?: ToolSpec[];
    timeoutMs?: number;
    preferred?: string | null;
  }
): Promise<CascadeResult> {
  const timeoutMs = opts?.timeoutMs ?? 60000;
  const all = providers();
  const configured = all.filter((p) => !!p.apiKey);

  if (configured.length === 0) {
    throw new FatalError(
      "No AI provider is configured. Set at least one provider API key on the server."
    );
  }

  // Explicit model selection: run ONLY the chosen provider.
  if (opts?.preferred && opts.preferred !== "auto") {
    // `selectableProviders()` is used here (not `providers()`) so an OpenRouter
    // model other than the cascade default can still be pinned explicitly.
    const picked = selectableProviders().find(
      (p) => p.name.toLowerCase() === opts.preferred!.toLowerCase()
    );
    if (!picked) {
      throw new FatalError(`Unknown model "${opts.preferred}".`);
    }
    if (!picked.apiKey) {
      const parsed = parseOpenRouterProvider(picked.name);
      throw new FatalError(
        `${parsed ? parsed.label : picked.name} is not configured on the server. Pick another model or add the ${parsed ? "OPENROUTER_API_KEY" : picked.name} key.`
      );
    }
    try {
      const result = await callProvider(picked, messages, opts?.tools, timeoutMs);
      console.log(
        JSON.stringify({ event: "provider_pinned", provider: picked.name })
      );
      return { ...result, provider: picked.name };
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : `${picked.name} request failed.`;
      throw new RetryableError(
        `${picked.name} could not complete the request. ${msg} You can retry or pick another model.`
      );
    }
  }

  let firstTried: string | null = null;
  let lastError = "Unknown provider error.";

  for (const p of configured) {
    if (!firstTried) firstTried = p.name;
    try {
      const result = await callProvider(p, messages, opts?.tools, timeoutMs);
      console.log(
        JSON.stringify({
          event: p.name === firstTried ? "provider_selected" : "provider_fallback",
          provider: p.name,
          ...(p.name !== firstTried ? { from: firstTried } : {}),
        })
      );
      return {
        ...result,
        provider: p.name,
        fallbackFrom: p.name === firstTried ? undefined : firstTried ?? undefined,
      };
    } catch (err) {
      if (err instanceof FatalError) throw err;
      lastError = err instanceof Error ? err.message : "Provider failed.";
      console.log(
        JSON.stringify({ event: "provider_failed", provider: p.name })
      );
      continue;
    }
  }

  throw new RetryableError(
    `ZeroKore could not reach an AI provider. Please try again later. (${lastError})`
  );
}