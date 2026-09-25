import { NextResponse } from "next/server";
import { requireUser, errorResponse, readJson, readString } from "@/lib/api-auth";
import { getOwnedProject } from "@/lib/projects";
import type { ProjectEnvironment } from "@/types/projects";

export const dynamic = "force-dynamic";

/** A project, its environment surfaces, and file metadata (no file bodies). */
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

    const [{ data: files }, { data: environments }] = await Promise.all([
      supabase
        .from("project_files")
        .select("path, language, updated_at")
        .eq("project_id", project.id)
        .order("path", { ascending: true }),
      supabase
        .from("project_environments")
        .select("*")
        .eq("project_id", project.id)
        .order("kind", { ascending: true }),
    ]);

    return NextResponse.json({
      project,
      files: files ?? [],
      environments: (environments ?? []) as ProjectEnvironment[],
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Rename, re-describe, archive, or re-point a project. */
export async function PATCH(
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
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const name = readString(body, "name", 80);
    if (name) patch.name = name;
    if (typeof body.description === "string") {
      patch.description = body.description.trim().slice(0, 400);
    }
    if (body.status === "active" || body.status === "archived") {
      patch.status = body.status;
    }
    if (typeof body.github_branch === "string") {
      patch.github_branch = body.github_branch.trim().slice(0, 120) || null;
    }

    const { data: updated, error } = await supabase
      .from("projects")
      .update(patch)
      .eq("id", project.id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error || !updated) {
      return NextResponse.json(
        { error: "Could not update the project." },
        { status: 500 }
      );
    }
    return NextResponse.json({ project: updated });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Delete a project. Files, environments and secrets cascade with it. */
export async function DELETE(
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

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", project.id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json(
        { error: "Could not delete the project." },
        { status: 500 }
      );
    }
    console.log(JSON.stringify({ event: "project_deleted" }));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
