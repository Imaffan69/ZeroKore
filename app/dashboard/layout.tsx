import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Workspace — ZeroKore",
};

/**
 * Auth gate for `/dashboard` and its children.
 *
 * This deliberately lives here instead of in `middleware.ts`. Routing
 * middleware executes on the CDN's Edge isolate, where this project's
 * middleware kept failing with `500 MIDDLEWARE_INVOCATION_FAILED` for every
 * matched route — including routes that do not exist — which took down the
 * whole site rather than just the workspace. This layout runs on the Node.js
 * server, the same environment the Supabase client is designed for, and a
 * failure here is contained to `/dashboard`.
 *
 * Any error (missing or unreachable Supabase config) denies access instead of
 * crashing, and `/login` still renders so the user can sign in.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Reading cookies opts this route into dynamic rendering, so the check below
  // runs on every request instead of being baked in at build time.
  await cookies();

  let authed = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authed = !!user;
  } catch {
    authed = false;
  }

  // Preserve where the user was heading so sign-in returns them here.
  // `AuthForm` reads `?next=` and navigates to it after a successful login.
  if (!authed) redirect(`/login?next=${encodeURIComponent("/dashboard")}`);

  return (
    <div className="flex h-dvh overflow-hidden bg-kore-bg text-kore-text">
      {children}
    </div>
  );
}
