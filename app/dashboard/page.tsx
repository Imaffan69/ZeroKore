import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ProjectsNavigator from "@/components/projects/ProjectsNavigator";
import { requireSession } from "@/lib/require-session";
import { ensureProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";

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
    <div className="flex h-dvh w-full flex-col bg-kore-bg text-kore-text">
      <ProjectsNavigator email={user.email ?? ""} username={null} />
    </div>
  );
}
