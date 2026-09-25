import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workspace",
};

/**
 * Shell for the personal workspace namespace: `/<username>` and
 * `/<username>/<project>`.
 *
 * This layout deliberately does NOT gate on authentication. Because `[username]`
 * is a catch-all dynamic segment, a gate here swallowed every unknown address
 * (`/anything`) and redirected it to the login screen instead of rendering the
 * 404 — visitors were sent to sign in for a page that did not exist, and the
 * return path was wrong. Authorization now lives in the pages, which check
 * whether the account exists first and return an ordinary 404 when it does not.
 */
export default async function UsernameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh w-full flex-col bg-kore-bg text-kore-text">
      {children}
    </div>
  );
}
