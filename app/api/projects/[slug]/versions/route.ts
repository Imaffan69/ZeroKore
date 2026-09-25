import { NextResponse } from "next/server";
import { requireUser, errorResponse } from "@/lib/api-auth";
import { getOwnedProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

/**
 * File change history for the Changes tab.
 * Returns the most recent versions per file, with the previous content so the
 * client can render a real diff. Owner-scoped via getOwnedProject.
 */
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

    const { data, error } = await supabase
      .from("file_versions")
      .select("id, file_id, path, content, size, edited_by, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      return NextResponse.json({ error: "Could not load history." }, { status: 500 });
    }

    // Group by file path; newest first, keep the two latest per file for diffing.
    const byPath = new Map<
      string,
      { path: string; edits: number; lastAt: string; lastBy: string; latest: string | null; previous: string | null }
    >();
    for (const v of data ?? []) {
      const existing = byPath.get(v.path);
      if (!existing) {
        byPath.set(v.path, {
          path: v.path,
          edits: 1,
          lastAt: v.created_at,
          lastBy: v.edited_by,
          latest: v.content,
          previous: null,
        });
      } else {
        existing.edits += 1;
        if (existing.previous === null) existing.previous = v.content;
      }
    }

    return NextResponse.json({
      changes: [...byPath.values()].slice(0, 50),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
