import { NextResponse } from "next/server";
import {
  requireUser,
  errorResponse,
  readJson,
  readString,
  BadRequestError,
} from "@/lib/api-auth";
import { uniqueSlug, DEFAULT_ENVIRONMENTS } from "@/lib/projects";
import type { Project } from "@/types/projects";

export const dynamic = "force-dynamic";

/** List the caller's projects, most recently updated first. */
export async function GET(req: Request) {
  try {
    const { supabase, user } = await requireUser(req);
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) {
      // Most likely the projects table has not been created yet.
      return NextResponse.json(
        {
          error:
            "Projects are unavailable. Run supabase/schema.sql to create the projects table, then reload.",
          projects: [],
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ projects: (data ?? []) as Project[] });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Create a project. Always provisions its default environments. */
export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser(req);
    const body = await readJson(req);

    const name = readString(body, "name", 80);
    if (!name) throw new BadRequestError("Give the project a name.");

    const slug = await uniqueSlug(supabase, user.id, name);
    const { data: created, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        slug,
        name,
        description: readString(body, "description", 400),
        source: "created",
      })
      .select("*")
      .single();

    if (error || !created) {
      return NextResponse.json(
        {
          error:
            "Could not create the project. Run supabase/schema.sql if you have not yet, then retry.",
        },
        { status: 503 }
      );
    }

    const project = created as Project;

    // Preview / Terminal / Dev server surfaces, each starting honestly empty.
    await supabase.from("project_environments").insert(
      DEFAULT_ENVIRONMENTS.map((env) => ({
        project_id: project.id,
        ...env,
      }))
    );

    console.log(JSON.stringify({ event: "project_created", slug: project.slug }));
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
