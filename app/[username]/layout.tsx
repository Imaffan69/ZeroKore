import type { Metadata } from "next";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Workspace",
};

/**
 * Auth gate for the personal workspace namespace: `/<username>` and
 * `/<username>/<project>`.
 *
 * Static routes (`/login`, `/pricing`, `/dashboard`, …) are matched before a
 * dynamic segment, so this only ever wraps addresses that really are a person's
 * namespace — and every one of them is private until a session proves
 * otherwise.
 */
export default async function UsernameLayout({
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
