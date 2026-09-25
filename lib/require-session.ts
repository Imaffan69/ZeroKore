import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Returns the current user (or null) without redirecting.
 * Use this for hidden/role-gated routes where an anonymous visitor should see
 * an ordinary 404 rather than a login redirect. */
export async function getSession(): Promise<User | null> {
  await cookies();
  let user: User | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }
  return user;
}

/**
 * The auth gate shared by every signed-in area (`/dashboard`, `/projects`).
 *
 * This deliberately does NOT live in `middleware.ts`: routing middleware runs on
 * the CDN's Edge isolate, where a failure is not containable and takes down
 * every matched route. A layout gate runs on the Node.js server and its failure
 * is contained to that section, so public pages keep rendering.
 *
 * Any error (missing or unreachable Supabase config) denies access rather than
 * crashing, and the login page still renders.
 */
export async function requireSession(nextPath: string): Promise<User> {
  // Reading cookies opts the route into dynamic rendering, so this check runs
  // on every request instead of being baked in at build time.
  await cookies();

  let user: User | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}