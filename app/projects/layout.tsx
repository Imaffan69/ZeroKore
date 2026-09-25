import type { Metadata } from "next";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Project",
};

/**
 * Auth gate for every /projects/** route.
 *
 * Same reasoning as the dashboard gate: this runs on the Node.js server, so a
 * failure is contained to this section instead of taking down the whole site
 * the way Edge routing middleware did.
 */
export default async function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession("/dashboard");

  return (
    <div className="flex h-dvh w-full flex-col bg-kore-bg text-kore-text">
      {children}
    </div>
  );
}