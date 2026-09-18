import { NextResponse } from "next/server";
import {
  requireUser,
  errorResponse,
  readJson,
  readString,
  BadRequestError,
} from "@/lib/api-auth";
import {
  getOwnedProject,
  languageForPath,
  MAX_FILE_BYTES,
} from "@/lib/projects";

export const dynamic = "force-dynamic";

/** Reject paths that are absolute, traversing, or too deep. */
function validatePath(raw: string): string {
  const path = raw.trim().replace(/^\/+/, "");
  if (!path) throw new BadRequestError("A file path is required.");
  if (path.length > 400) throw new BadRequestError("That file path is too long.");
  if (path.includes("..") || path.includes("\\")) {
    throw new BadRequestError("That file path is not allowed.");
  }
  if (path.split("/").length > 8) {
    throw new BadRequestError("That file path is nested too deeply.");
  }
  return path;
}

/** File metadata, or `?path=` for one file including its content. */
export async function GET(
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

    const path = new URL(req.url).searchParams.get("path");

    if (path) {
      const { data } = await supabase
        .from("project_files")
        .select("*")
        .eq("project_id", project.id)
        .eq("path", path.replace(/^\/+/, ""))
        .maybeSingle();
      if (!data) {
        return NextResponse.json({ error: "File not found." }, { status: 404 });
      }
      return NextResponse.json({ file: data });
    }

    const { data } = await supabase
      .from("project_files")
      .select("path, language, updated_at")
      .eq("project_id", project.id)
      .order("path", { ascending: true });

    return NextResponse.json({ files: data ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Create or overwrite a file (used by the editor and by imports). */
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
    const path = validatePath(readString(body, "path", 400));
    const content = typeof body.content === "string" ? body.content : "";

    if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
      throw new BadRequestError(
        `That file is larger than the ${Math.round(MAX_FILE_BYTES / 1000)} KB editor limit.`
      );
    }

    const { data, error } = await supabase
      .from("project_files")
      .upsert(
        {
          project_id: project.id,
          path,
          content,
          language: languageForPath(path),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,path" }
      )
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Could not save that file." },
        { status: 500 }
      );
    }

    await supabase
      .from("projects")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", project.id);

    return NextResponse.json({ file: data });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Remove a file from the project. */
export async function DELETE(
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

    const path = new URL(req.url).searchParams.get("path");
    if (!path) throw new BadRequestError("A file path is required.");

    const { error } = await supabase
      .from("project_files")
      .delete()
      .eq("project_id", project.id)
      .eq("path", path.replace(/^\/+/, ""));

    if (error) {
      return NextResponse.json(
        { error: "Could not delete that file." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
