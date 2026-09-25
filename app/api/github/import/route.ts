import { NextResponse } from "next/server";
import {
  requireUser,
  errorResponse,
  readJson,
  readString,
  BadRequestError,
} from "@/lib/api-auth";
import {
  uniqueSlug,
  isImportablePath,
  languageForPath,
  MAX_IMPORT_FILES,
  MAX_FILE_BYTES,
  DEFAULT_ENVIRONMENTS,
} from "@/lib/projects";
import {
  readGitHubToken,
  fetchRepoTree,
  fetchFileContent,
} from "@/lib/github";
import { buildPreviewDocument, pickPreviewEntry } from "@/lib/preview";
import { projectNameError } from "@/lib/slug";
import type { Project } from "@/types/projects";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CONCURRENCY = 10;

/** Fetch many files with a small parallel window. */
async function fetchInBatches(
  token: string,
  repo: string,
  ref: string,
  paths: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < paths.length; i += CONCURRENCY) {
    const slice = paths.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map(async (path) => ({
        path,
        content: await fetchFileContent(token, repo, path, ref),
      }))
    );
    for (const r of results) {
      if (r.content != null && Buffer.byteLength(r.content, "utf8") <= MAX_FILE_BYTES) {
        out.set(r.path, r.content);
      }
    }
  }
  return out;
}

/**
 * Import a GitHub repository as a project.
 *
 * Body: { repo: "owner/name", branch?, name?, paths? }
 * Ownership of the repo is established by the user's own OAuth token â€” GitHub
 * itself decides what that token can read, so a private repo is only importable
 * by someone who already has access to it.
 */
export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await readJson(req);

    const repo = readString(body, "repo", 200);
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
      throw new BadRequestError("Choose a repository as owner/name.");
    }

    const token = await readGitHubToken(user.id);
    if (!token) {
      return NextResponse.json(
        {
          error:
            "Connect your GitHub account before importing. Settings â†’ Integrations.",
        },
        { status: 400 }
      );
    }

    const branch = readString(body, "branch", 120);
    let tree;
    try {
      tree = await fetchRepoTree(token, repo, branch || undefined);
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Could not read that repository.",
        },
        { status: 502 }
      );
    }

    // Either an explicit selection, or everything text-like we can edit.
    const requested = Array.isArray(body.paths)
      ? (body.paths as unknown[]).filter((p): p is string => typeof p === "string")
      : null;
    const candidates = (requested ?? tree.paths).filter(isImportablePath);
    const truncated = candidates.length > MAX_IMPORT_FILES;
    const selected = candidates.slice(0, MAX_IMPORT_FILES);

    if (selected.length === 0) {
      return NextResponse.json(
        { error: "That repository has no text files ZeroKore can import." },
        { status: 400 }
      );
    }

    const contents = await fetchInBatches(
      token,
      repo,
      tree.defaultBranch,
      selected
    );
    if (contents.size === 0) {
      return NextResponse.json(
        { error: "None of the selected files could be read from GitHub." },
        { status: 502 }
      );
    }

    const name = readString(body, "name", 80) || repo.split("/")[1];
    // An imported repo's name becomes a public slug, so it is moderated exactly
    // like a typed project name. A repo called "admin" must not become /admin.
    const nameProblem = projectNameError(name);
    if (nameProblem) {
      return NextResponse.json({ error: nameProblem }, { status: 400 });
    }
    const slug = await uniqueSlug(supabase, user.id, name);

    const { data: created, error: createError } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        slug,
        name,
        description: `Imported from ${repo}`,
        source: "github",
        github_repo: repo,
        github_branch: tree.defaultBranch,
      })
      .select("*")
      .single();

    if (createError || !created) {
      return NextResponse.json(
        {
          error:
            "Repository read, but the project could not be created. Run supabase/schema.sql, then retry.",
        },
        { status: 503 }
      );
    }
    const project = created as Project;

    const rows = [...contents.entries()].map(([path, content]) => ({
      project_id: project.id,
      path,
      content,
      language: languageForPath(path),
    }));
    await supabase.from("project_files").insert(rows);

    // Preview entry point, with relative css/js inlined so it really renders.
    const entry = pickPreviewEntry([...contents.keys()]);
    const preview = entry ? buildPreviewDocument(entry, contents) : null;

    await supabase.from("project_environments").insert(
      DEFAULT_ENVIRONMENTS.map((env) =>
        env.kind === "preview" && preview
          ? {
              project_id: project.id,
              ...env,
              content: preview,
              state: { status: "ready", entry },
            }
          : { project_id: project.id, ...env }
      )
    );

    console.log(
      JSON.stringify({
        event: "project_imported",
        repo,
        files: rows.length,
        truncated,
      })
    );

    return NextResponse.json(
      {
        project,
        filesImported: rows.length,
        truncated,
        previewEntry: preview ? entry : null,
      },
      { status: 201 }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
