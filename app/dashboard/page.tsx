import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles, Briefcase, GitBranch, Settings } from "lucide-react";
import ProjectsNavigator from "@/components/projects/ProjectsNavigator";
import { requireSession } from "@/lib/require-session";
import { ensureProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import QuickActionCard from "@/components/dashboard/QuickActionCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";

export const metadata: Metadata = {
  title: "Your projects",
};

/**
 * The workspace door.
 *
 * Every account has a namespace of its own (`/<username>`), so /dashboard sends
 * a named account there rather than rendering a second, anonymous copy of the
 * same page. If the database has not run the username upgrade yet (or the
 * profile cannot be read), the navigator renders here instead — the dashboard
 * keeps working either way.
 */
export default async function DashboardPage() {
  const user = await requireSession("/dashboard");

  let username: string | null = null;
  try {
    const supabase = await createClient();
    const profile = await ensureProfile(supabase, user);
    username = profile?.username ?? null;
  } catch {
    // Unavailable database: fall through and render the navigator, which shows
    // its own honest error state instead of a redirect loop.
    username = null;
  }

  if (username) redirect(`/${username}`);

  return (
    <div className="flex min-h-dvh w-full flex-col bg-kore-bg text-kore-text">
      <ProjectsNavigator email={user.email ?? ""} username={null} />

      {/* Quick actions strip */}
      <section className="mt-6 grid gap-3 px-6 pb-8 sm:grid-cols-2 lg:grid-cols-4">
        <QuickActionCard
          icon={Sparkles}
          title="New project"
          description="Start from a blank workspace or import a GitHub repo"
          href={`/${username ?? ""}/new`}
        />
        <QuickActionCard
          icon={Briefcase}
          title="Your workspaces"
          description={`${username ? username : "account"} · ${username ? "/" + username : ""}`}
          href={`/${username ?? ""}`}
        />
        <QuickActionCard
          icon={GitBranch}
          title="Connect GitHub"
          description="Link a GitHub account to import and push repos"
          href="/settings"
        />
        <QuickActionCard
          icon={Settings}
          title="Settings & account"
          description="Models, integrations, username and account details"
          href="/settings"
        />
      </section>

      {/* Activity feed */}
      <section className="flex-1 px-6 pb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-white">Recent activity</h2>
          <p className="text-xs text-kore-muted">
            Your last sign-in and recent actions
          </p>
        </div>
        <ActivityFeed username={username ?? null} email={user.email ?? ""} />
      </section>
    </div>
  );
}
