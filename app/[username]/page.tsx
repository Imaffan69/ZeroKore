import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, UserRound } from "lucide-react";
import ProjectsNavigator from "@/components/projects/ProjectsNavigator";
import { requireSession } from "@/lib/require-session";
import { resolveUsername } from "@/lib/profiles";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  return { title: `${username} — workspace` };
}

/**
 * A person's workspace: everything they own, at their own address.
 *
 * Order matters. The account is resolved *first* so a visitor who guessed a
 * username that does not exist gets the same ordinary 404 as any other missing
 * page — the response cannot be used to discover which usernames are taken.
 * Only once the account is known to exist do we require a session, and only the
 * owner ever sees the contents; anyone else gets a plain "this is private" card.
 */
export default async function UserWorkspacePage({ params }: Params) {
  const { username } = await params;

  const owner = await resolveUsername(username);
  if (!owner) notFound();

  // Named routes (/login, /pricing, /dashboard) are matched before this
  // segment, so reaching here with a session means the caller is asking for
  // their own namespace.
  const user = await requireSession(`/${username}`);

  if (owner.id !== user.id) {
    return (
      <div className="kore-ambient flex min-h-0 flex-1 items-center justify-center px-6">
        <div className="glass glass-sheen w-full max-w-md rounded-2xl p-6 text-center">
          <span className="glass-subtle mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl">
            <Lock className="h-5 w-5 text-kore-muted" aria-hidden />
          </span>
          <h1 className="text-base font-semibold text-white">
            @{owner.username} keeps this workspace private
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-kore-muted">
            ZeroKore workspaces are private by default. Nothing here is readable
            by another account.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition-transform duration-150 hover:scale-[1.02]"
          >
            <UserRound className="h-3.5 w-3.5" aria-hidden />
            Go to your workspace
          </Link>
        </div>
      </div>
    );
  }

  return <ProjectsNavigator email={user.email ?? ""} username={owner.username} />;
}
