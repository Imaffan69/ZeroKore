import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  checkAndIncrementUsage,
  refundUsage,
  getUsageState,
} from "@/lib/usage";
import type { UsageState } from "@/types";
import {
  reserveCredits,
  settleRun,
  refundRun,
  InsufficientCreditsError,
} from "@/lib/credits";
import { BASE_CREDIT_COST } from "@/lib/plans";
import { runAgent } from "@/lib/ai/agent";
import { applyArtifactToProject } from "@/lib/projects";
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
    projectId?: unknown;
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

  // A project run must belong to the caller; the id is verified below against
  // the user's own rows before anything is written into that project.
  const requestedProjectId =
    typeof body.projectId === "string" && body.projectId ? body.projectId : null;

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

  // Ownership check for project runs: an unowned or unknown project id is
  // rejected outright rather than silently dropped.
  let projectId: string | null = null;
  if (requestedProjectId) {
    const { data: owned } = await supabase
      .from("projects")
      .select("id")
      .eq("id", requestedProjectId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!owned) {
      return NextResponse.json(
        { error: "That project does not exist, or is not yours." },
        { status: 404 }
      );
    }
    projectId = requestedProjectId;
  }

  // Counting is for stats only: the credits balance is the real gate, so a
  // failure here must never block a run (and the old 15/day hard stop is gone).
  let usageState: UsageState | undefined;
  try {
    const counted = await checkAndIncrementUsage(supabase, user.id);
    usageState = counted.usage;
  } catch {
    console.log(JSON.stringify({ event: "usage_increment_failed" }));
    usageState = await getUsageState(supabase, user.id).catch(() => undefined);
  }
  // Reporting state only — a failed read must never fail the run.
  const usage: UsageState = usageState ?? { used: 0, limit: 0, unlimited: true };

  // Credits: reserve the base cost up-front, settle with real token counts
  // after the run, refund on failure. Admins/owners are exempt (unlimited).
  let creditState;
  try {
    creditState = await reserveCredits(supabase, user.id, BASE_CREDIT_COST);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error:
            "You are out of credits for today. They reset at midnight UTC — or upgrade your plan, earn credits via referrals and feedback, or verify as a student for +50/day.",
          outOfCredits: true,
          balance: err.available,
        },
        { status: 402 }
      );
    }
    return NextResponse.json({ error: "Could not check credits. Please try again." }, { status: 500 });
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
      projectId,
    });

    // Artifacts become project surfaces: rendered output fills the preview
    // environment, everything else becomes a real, editable project file.
    let savedTo: { kind: "preview" | "file"; label: string } | null = null;
    if (projectId && result.artifact) {
      try {
        savedTo = await applyArtifactToProject(
          supabase,
          projectId,
          result.artifact
        );
      } catch {
        console.log(
          JSON.stringify({ event: "artifact_project_save_failed" })
        );
      }
    }

    // Settle the run with real token counts (reserve → true cost, logged).
    try {
      await settleRun(supabase, user.id, result.promptTokens, result.completionTokens, {
        conversationId: result.conversationId,
        projectId,
        provider: result.provider,
        model: result.model,
        reserved: creditState.unlimited ? 0 : BASE_CREDIT_COST,
      });
    } catch {
      // settlement logging must never fail the response
    }

    const response: AgentResponseBody = {
      reply: result.reply,
      conversationId: result.conversationId,
      conversationTitle: result.conversationTitle,
      events: result.events,
      artifact: result.artifact,
      provider: result.provider,
      fallbackFrom: result.fallbackFrom,
      usage,
    };
    return NextResponse.json({ ...response, savedTo });
  } catch (err) {
    console.log(JSON.stringify({ event: "agent_failed" }));
    const msg =
      err instanceof Error ? err.message : "Agent request failed.";
    // A failed call produced nothing, so it is not charged.
    await refundUsage(supabase, user.id, usage);
    try {
      await refundRun(supabase, user.id, BASE_CREDIT_COST);
    } catch {
      // best-effort
    }
    // Provider/config failures → 502; internal validation → 400/500.
    const status = /provider|configured|model/i.test(msg) ? 502 : 500;
    return NextResponse.json(
      {
        error: msg,
        usage,
      },
      { status }
    );
  }
}