import { NextResponse } from "next/server";
import {
  requireUser,
  errorResponse,
  readJson,
  readString,
  BadRequestError,
} from "@/lib/api-auth";
import { getOwnedProject, DEFAULT_ENVIRONMENTS } from "@/lib/projects";
import type { EnvironmentKind, ProjectEnvironment } from "@/types/projects";

export const dynamic = "force-dynamic";

const KINDS: EnvironmentKind[] = ["preview", "terminal", "dev_server", "secrets"];

/** The project's environment surfaces. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { supabase, user } = await requireUser();

    const project = await getOwnedProject(supabase, user.id, slug);
    if (!project) {
      return NextResponse.json(
        { error: "That project does not exist, or is not yours." },
        { status: 404 }
      );
    }

    const { data } = await supabase
      .from("project_environments")
      .select("*")
      .eq("project_id", project.id)
      .order("kind", { ascending: true });

    return NextResponse.json({
      environments: (data ?? []) as ProjectEnvironment[],
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Write an environment's content. Only 'preview' and 'terminal' hold content
 * today: the dev server has no runtime in this deployment, and secrets are
 * stored encrypted in their own table, so both are rejected here rather than
 * accepting data we cannot honour.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { supabase, user } = await requireUser();

    const project = await getOwnedProject(supabase, user.id, slug);
    if (!project) {
      return NextResponse.json(
        { error: "That project does not exist, or is not yours." },
        { status: 404 }
      );
    }

    const body = await readJson(req);
    const kind = readString(body, "kind", 20) as EnvironmentKind;
    if (!KINDS.includes(kind)) {
      throw new BadRequestError("Unknown environment kind.");
    }
    if (kind === "secrets") {
      throw new BadRequestError(
        "Secrets are managed through the secrets endpoint, not the environment content."
      );
    }
    if (kind === "dev_server") {
      throw new BadRequestError(
        "A dev server needs a runtime this deployment does not host, so its state cannot be set."
      );
    }

    const content = typeof body.content === "string" ? body.content : "";
    if (Buffer.byteLength(content, "utf8") > 400_000) {
      throw new BadRequestError("That environment content is too large.");
    }

    const fallback = DEFAULT_ENVIRONMENTS.find((e) => e.kind === kind);
    const { data, error } = await supabase
      .from("project_environments")
      .upsert(
        {
          project_id: project.id,
          kind,
          label: fallback?.label ?? kind,
          content,
          language: readString(body, "language", 40) || fallback?.language || "plaintext",
          state: { status: content ? "ready" : "empty" },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,kind" }
      )
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Could not save that environment." },
        { status: 500 }
      );
    }

    await supabase
      .from("projects")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", project.id);

    return NextResponse.json({ environment: data });
  } catch (err) {
    return errorResponse(err);
  }
}
