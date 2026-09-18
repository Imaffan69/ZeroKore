import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAndIncrementUsage } from "@/lib/usage";
import { runAgent } from "@/lib/ai/agent";
import type { AgentMode, AgentResponseBody, ProviderPreference } from "@/types";

export const maxDuration = 120;

const MODES: AgentMode[] = ["coding", "research", "general"];
const PROVIDERS = ["Groq", "DeepSeek", "SambaNova", "Gemini"];
const MAX_MESSAGE_LENGTH = 12000;

export async function POST(req: NextRequest) {
  let body: {
    message?: unknown;
    conversationId?: unknown;
    mode?: unknown;
    provider?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body. Expected JSON." },
      { status: 400 }
    );
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const conversationId =
    typeof body.conversationId === "string" && body.conversationId
      ? body.conversationId
      : null;
  const mode: AgentMode =
    typeof body.mode === "string" &&
    (MODES as string[]).includes(body.mode)
      ? (body.mode as AgentMode)
      : "general";

  // Explicit model selection (like Freebuff's model picker). "auto" walks
  // the cascade; anything else must name one of the four providers.
  const provider: ProviderPreference =
    typeof body.provider === "string"
      ? (PROVIDERS as string[]).includes(body.provider)
        ? (body.provider as ProviderPreference)
        : "auto"
      : "auto";

  if (!message) {
    return NextResponse.json(
      { error: "Message must not be empty." },
      { status: 400 }
    );
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` },
      { status: 400 }
    );
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json(
      { error: "Server misconfigured. Contact the administrator." },
      { status: 500 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  // Server-side rate limit (15/day for users, unlimited for admins).
  let usageCheck;
  try {
    usageCheck = await checkAndIncrementUsage(supabase, user.id);
  } catch {
    return NextResponse.json(
      { error: "Could not verify usage. Please try again." },
      { status: 500 }
    );
  }
  if (!usageCheck.allowed) {
    return NextResponse.json(
      {
        error:
          "Daily AI request limit reached (15/15). Resets tomorrow. Your conversation and typed input are preserved.",
        usage: usageCheck.usage,
      },
      { status: 429 }
    );
  }

  console.log(
    JSON.stringify({ event: "agent_started", user: user.id, mode, provider })
  );

  try {
    const result = await runAgent({
      supabase,
      userId: user.id,
      message,
      conversationId,
      mode,
      preferredProvider: provider,
    });

    const response: AgentResponseBody = {
      reply: result.reply,
      conversationId: result.conversationId,
      conversationTitle: result.conversationTitle,
      events: result.events,
      artifact: result.artifact,
      provider: result.provider,
      fallbackFrom: result.fallbackFrom,
      usage: usageCheck.usage,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.log(JSON.stringify({ event: "agent_failed" }));
    const msg =
      err instanceof Error ? err.message : "Agent request failed.";
    // Provider/config failures → 502; internal validation → 400/500.
    const status = /provider|configured/i.test(msg) ? 502 : 500;
    return NextResponse.json(
      {
        error: msg,
        usage: usageCheck.usage,
      },
      { status }
    );
  }
}