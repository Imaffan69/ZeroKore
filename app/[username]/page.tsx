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
 * The named account is resolved server-side, but the contents are only rendered
 * for the owner. Someone else's namespace gets a plain "this is private" card —
 * the same response whether the account exists or not, so the page cannot be
 * used to discover which usernames are taken.
 */
export default async function UserWorkspacePage({ params }: Params) {
  const { username } = await params;
  const user = await requireSession(`/${username}`);

  const owner = await resolveUsername(username);
  if (!owner) notFound();

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

  // Touch the client so a missing database configuration fails here rather than
  // inside the navigator's first fetch.
  return <ProjectsNavigator email={user.email ?? ""} username={owner.username} />;
}
