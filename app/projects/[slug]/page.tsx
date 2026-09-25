import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { FolderOpen } from "lucide-react";
import ProjectWorkspace from "@/components/projects/ProjectWorkspace";
import { createClient } from "@/lib/supabase/server";
import { getOwnedProject } from "@/lib/projects";
import { ensureProfile } from "@/lib/profiles";
import { redirect } from "next/navigation";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug} — project` };
}

/**
 * A single project at its own URL.
 *
 * The project is resolved on the server and scoped to the signed-in owner, so a
 * slug belonging to someone else renders the same "not found" state as a slug
 * that does not exist — no information leaks either way.
 */
export default async function ProjectPage({ params }: Params) {
  const { slug } = await params;
  // Reading cookies keeps this dynamic; the layout has already proven a session.
  await cookies();

  let project = null;
  let profile = null;
  let degraded = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      project = await getOwnedProject(supabase, user.id, slug);
      profile = await ensureProfile(supabase, user);
    }
  } catch {
    degraded = true;
  }

  // Canonical address always carries the owner's username.
  if (project && profile?.username) redirect(`/${profile.username}/${slug}`);

  if (!project) {
    return (
      <div className="kore-ambient flex min-h-0 flex-1 items-center justify-center px-6">
        <div className="glass glass-sheen w-full max-w-md rounded-2xl p-6 text-center">
          <span className="glass-subtle mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl">
            <FolderOpen className="h-5 w-5 text-kore-muted" aria-hidden />
          </span>
          <h1 className="text-base font-semibold text-white">
            {degraded ? "Projects are unavailable right now" : "Project not found"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-kore-muted">
            {degraded
              ? "ZeroKore could not reach the database, so this project cannot be loaded. Try again in a moment."
              : `There is no project at /projects/${slug} for your account. It may have been deleted, or the link may belong to another workspace.`}
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition-transform duration-150 hover:scale-[1.02]"
          >
            Back to your projects
          </Link>
        </div>
      </div>
    );
  }

  return <ProjectWorkspace initialProject={project} username={null} />;
}