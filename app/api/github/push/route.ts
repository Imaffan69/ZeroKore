import { NextResponse } from "next/server";
import {
  requireUser,
  errorResponse,
  readJson,
  readString,
  BadRequestError,
} from "@/lib/api-auth";
import { getOwnedProject } from "@/lib/projects";
import { readGitHubToken, pushFileToGitHub } from "@/lib/github";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Bounded so a single request cannot hammer the GitHub API. */
const MAX_PUSH_FILES = 40;

/**
 * Push project files back to the linked GitHub repository.
 *
 * Body: { slug, path?, message? }
 *  - `path` pushes one file; omitting it pushes the whole project (capped).
 *
 * Results are reported per file: a partial push is reported as partial, never
 * as success.
 */
export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await readJson(req);

    const slug = readString(body, "slug", 80);
    if (!slug) throw new BadRequestError("A project slug is required.");

    const project = await getOwnedProject(supabase, user.id, slug);
    if (!project) {
      return NextResponse.json(
        { error: "That project does not exist, or is not yours." },
        { status: 404 }
      );
    }
    if (!project.github_repo) {
      return NextResponse.json(
        {
          error:
            "This project is not linked to a GitHub repository. Import a repository to link one.",
        },
        { status: 400 }
      );
    }

    const token = await readGitHubToken(user.id);
    if (!token) {
      return NextResponse.json(
        {
          error:
            "Connect your GitHub account first. Settings → Integrations.",
        },
        { status: 400 }
      );
    }

    const branch = project.github_branch || "main";
    const singlePath = readString(body, "path", 400);
    const message =
      readString(body, "message", 200) ||
      `Update from ZeroKore (${new Date().toISOString().slice(0, 10)})`;

    let targets: { path: string; content: string }[] = [];
    if (singlePath) {
      const { data } = await supabase
        .from("project_files")
        .select("path, content")
        .eq("project_id", project.id)
        .eq("path", singlePath.replace(/^\/+/, ""))
        .maybeSingle();
      if (!data) {
        return NextResponse.json({ error: "File not found." }, { status: 404 });
      }
      targets = [data as { path: string; content: string }];
    } else {
      const { data } = await supabase
        .from("project_files")
        .select("path, content")
        .eq("project_id", project.id)
        .order("path", { ascending: true })
        .limit(MAX_PUSH_FILES);
      targets = (data ?? []) as { path: string; content: string }[];
      if (targets.length === 0) {
        return NextResponse.json(
          { error: "This project has no files to push yet." },
          { status: 400 }
        );
      }
    }

    const pushed: { path: string; commitSha: string; htmlUrl: string }[] = [];
    const failed: { path: string; error: string }[] = [];

    for (const file of targets) {
      try {
        const result = await pushFileToGitHub(
          token,
          project.github_repo,
          branch,
          file.path,
          file.content,
          `${message} — ${file.path}`
        );
        pushed.push({ path: file.path, ...result });
      } catch (err) {
        failed.push({
          path: file.path,
          error: err instanceof Error ? err.message : "Push failed.",
        });
      }
    }

    console.log(
      JSON.stringify({
        event: "project_pushed",
        repo: project.github_repo,
        pushed: pushed.length,
        failed: failed.length,
      })
    );

    return NextResponse.json({
      repo: project.github_repo,
      branch,
      pushed,
      failed,
      /** True when the project had more files than the per-request cap. */
      partial: !singlePath && targets.length === MAX_PUSH_FILES,
    });
  } catch (err) {
    return errorResponse(err);
  }
}