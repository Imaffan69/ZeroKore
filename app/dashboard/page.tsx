import type { Metadata } from "next";
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
 * Every account has a namespace of its own (`/<username>`), so a named account
 * gets a short redirect to its own address. Everyone else lands on the full
 * dashboard below, which answers "what do I have and what can I do right now?"
 * without a scroll: live account tiles, the three project actions, quick
 * actions and recent activity.
 */
export default async function DashboardPage() {
  // TEMPORARY DIAGNOSTIC: surface the real server-render error in the HTML so
  // it can be identified. Production redacts the message behind an error
  // boundary, which makes the cause invisible.
  try {
    return <Dashboard />;
  } catch (e) {
    const err = e as Error;
    return (
      <pre style={{ color: "red", padding: 24, whiteSpace: "pre-wrap" }}>
        {`DASHBOARD_RENDER_ERROR: ${err?.message ?? "unknown"}\n${
          err?.stack ?? ""
        }`}
      </pre>
    );
  }
}

async function Dashboard() {
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

  return (
    <div className="flex min-h-dvh w-full flex-col bg-kore-bg text-kore-text">
      <ProjectsNavigator
        email={user.email ?? ""}
        username={username}
        workspaceHref={username ? `/${username}` : null}
      />

      {/* Quick actions strip */}
      <section className="mt-6 grid gap-3 px-6 pb-8 sm:grid-cols-2 lg:grid-cols-4">
        <QuickActionCard
          icon={Sparkles}
          title="New project"
          description="Start from a blank workspace or import a GitHub repo"
          // The create/import chooser lives on the dashboard itself (the
          // navigator's own panels), and there is no /[username]/new route —
          // linking there produced a 404.
          href="/dashboard"
        />
        <QuickActionCard
          icon={Briefcase}
          title="Your workspaces"
          description={
            username ? `/${username} · your named address` : "Set a username to get one"
          }
          href={username ? `/${username}` : "/settings"}
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
        <ActivityFeed username={username} />
      </section>
    </div>
  );
}
