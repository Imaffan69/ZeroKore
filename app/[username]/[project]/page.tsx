import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProjectWorkspace from "@/components/projects/ProjectWorkspace";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/require-session";
import { resolveUsername } from "@/lib/profiles";
import { getOwnedProject } from "@/lib/projects";

type Params = { params: Promise<{ username: string; project: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username, project } = await params;
  return { title: `${project} — @${username}` };
}

/**
 * A project at its canonical address: `/<username>/<project>`.
 *
 * Ownership is checked, not assumed. A project belonging to someone else, or a
 * username that does not exist, produce the same not-found result — the
 * namespace cannot be probed for what exists.
 */
export default async function UserProjectPage({ params }: Params) {
  const { username, project: slug } = await params;
  const user = await requireSession(`/${username}/${slug}`);

  const owner = await resolveUsername(username);
  if (!owner || owner.id !== user.id) notFound();

  let project = null;
  let degraded = false;
  try {
    const supabase = await createClient();
    project = await getOwnedProject(supabase, user.id, slug);
  } catch {
    degraded = true;
  }

  if (!project) {
    if (degraded) {
      // A database outage is not a 404: say what actually happened.
      throw new Error(
        "ZeroKore could not reach the database, so this project cannot be loaded."
      );
    }
    notFound();
  }

  // The address is the source of truth for the username segment.
  if (owner.username !== username) notFound();

  return <ProjectWorkspace initialProject={project} username={owner.username} />;
}
