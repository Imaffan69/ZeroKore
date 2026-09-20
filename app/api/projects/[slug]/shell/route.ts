import { NextResponse } from "next/server";
import { requireUser, errorResponse, readJson, readString } from "@/lib/api-auth";
import { getOwnedProject } from "@/lib/projects";
import { runShellCommand, SHELL_BANNER } from "@/lib/shell";

export const dynamic = "force-dynamic";

/**
 * One shell command, executed against this project's real files.
 *
 * The terminal is stateless by design: each POST carries the whole command
 * line, the server runs it and returns its output. History and completion live
 * in the client. Because the shell can only reach `project_files` rows owned
 * by the caller, there is nothing it can touch beyond its own project.
 */
export async function POST(
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
    const command = readString(body, "command", 2000);
    if (!command) {
      return NextResponse.json({ error: "A command is required." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();

    const result = await runShellCommand(
      supabase,
      project.id,
      command,
      profile?.username ?? user.email?.split("@")[0] ?? "you"
    );

    return NextResponse.json({ ...result, banner: SHELL_BANNER });
  } catch (err) {
    return errorResponse(err);
  }
}