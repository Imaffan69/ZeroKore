/**
 * ZeroKore AI cascade router.
 * Tries providers in order: Groq → DeepSeek → SambaNova → Gemini.
 * Falls back on 429 / 5xx / auth-config errors / timeout / network errors.
 * Fails fast on 400 (malformed internal request = our bug, not the provider's).
 * Server-side only. Never logs or returns API keys.
 */

export interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
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

function providers(): ProviderDef[] {
  return [
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
      // gemini-2.5-flash was retired by Google; gemini-3.6-flash is live.
      model: "gemini-3.6-flash",
      apiKey: process.env.GEMINI_API_KEY,
    },
  ];
}

export function configuredProviders(): string[] {
  return providers()
    .filter((p) => !!p.apiKey)
    .map((p) => p.name);
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
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool" as const,
        content: m.content,
        tool_call_id: m.toolCallId ?? "",
      };
    }
    return { role: m.role, content: m.content };
  });
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
      throw new FatalError(`Provider rejected the request (${res.status}).`);
    }
    if (res.status === 429 || res.status >= 500) {
      throw new RetryableError(`Provider error (${res.status}).`, res.status);
    }
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new RetryableError(
        `Provider unavailable (${res.status}).`,
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
    return { text: choice.content ?? "", toolCalls };
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
  for (const m of messages) {
    if (m.role === "system") {
      system.push(m.content);
      continue;
    }
    if (m.role === "tool") {
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: m.toolName ?? "tool",
              response: { result: m.content },
            },
          },
        ],
      });
      continue;
    }
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  }
  return { system: system.join("\n\n"), contents };
}

async function callGemini(
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
      throw new FatalError(`Provider rejected the request (${res.status}).`);
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
    return { text, toolCalls };
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

const OPENAI_BASES: Record<string, string> = {
  Groq: "https://api.groq.com/openai/v1",
  DeepSeek: "https://api.deepseek.com/v1",
  SambaNova: "https://api.sambanova.ai/v1",
};

/**
 * Run one chat turn across the cascade. Returns the first successful result.
 * Throws a clean, user-safe error when every configured provider fails.
 */
export async function chatWithCascade(
  messages: ChatMsg[],
  opts?: { tools?: ToolSpec[]; timeoutMs?: number }
): Promise<CascadeResult> {
  const timeoutMs = opts?.timeoutMs ?? 60000;
  const all = providers();
  const configured = all.filter((p) => !!p.apiKey);

  if (configured.length === 0) {
    throw new FatalError(
      "No AI provider is configured. Set at least one provider API key on the server."
    );
  }

  let firstTried: string | null = null;
  let lastError = "Unknown provider error.";

  for (const p of configured) {
    if (!firstTried) firstTried = p.name;
    try {
      let result: ProviderChatResult;
      if (p.name === "Gemini") {
        result = await callGemini(p.apiKey!, p.model, messages, opts?.tools, timeoutMs);
      } else {
        result = await callOpenAICompatible(
          OPENAI_BASES[p.name],
          p.apiKey!,
          p.model,
          messages,
          opts?.tools,
          timeoutMs
        );
      }
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