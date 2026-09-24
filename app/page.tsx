import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LandingPage from "@/components/landing/LandingPage";
import { createClient } from "@/lib/supabase/server";
import { getSiteFlags } from "@/lib/flags";

export const metadata: Metadata = {
  title: "ZeroKore — Autonomous agentic development workspace",
  description:
    "ZeroKore is a browser-based AI engineering environment: coding, research and planning agents, real file editing, bounded tool execution, persistent memory, artifacts and secure Git workflows.",
};

export const dynamic = "force-dynamic";

/** Real, live total user count rendered into the hero ("Join N builders"). */
async function getTotalUsers(): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });
    return count ?? null;
  } catch {
    return null; // hero renders without the counter; never breaks the page
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Supabase returns OAuth results to the Site URL. When that lands on "/"
  // with a ?code= (or an error), forward it to the real callback so the code
  // is exchanged instead of being shown as a raw query string on the landing
  // page. This is the "redirected to zerokore.vercel.app/?code=..." report.
  const params = (await searchParams) ?? {};
  const code = typeof params.code === "string" ? params.code : "";
  const oauthError =
    typeof params.error_description === "string"
      ? params.error_description
      : typeof params.error === "string"
        ? params.error
        : "";
  if (code || oauthError) {
    const target = new URLSearchParams();
    if (code) target.set("code", code);
    if (oauthError) target.set("error_description", oauthError);
    const next = typeof params.next === "string" ? params.next : "";
    if (next.startsWith("/") && !next.startsWith("//")) target.set("next", next);
    redirect(`/auth/callback?${target.toString()}`);
  }

  const [totalUsers, flags] = await Promise.all([getTotalUsers(), getSiteFlags()]);
  return <LandingPage totalUsers={totalUsers} version={flags.version} />;
}
