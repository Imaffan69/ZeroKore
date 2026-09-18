import type { Metadata } from "next";
import ProjectsNavigator from "@/components/projects/ProjectsNavigator";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Your projects",
};

/**
 * The workspace navigator.
 *
 * This used to be the agent canvas; the canvas now lives inside a project at
 * /projects/<slug>, so the dashboard is purely a chooser: create, import, or
 * continue. The session is proven on the server before anything renders.
 */
export default async function DashboardPage() {
  const user = await requireSession("/dashboard");

  return (
    <div className="flex h-dvh w-full flex-col bg-kore-bg text-kore-text">
      <ProjectsNavigator email={user.email ?? ""} />
    </div>
  );
}