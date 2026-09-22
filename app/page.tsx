import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import { createClient } from "@/lib/supabase/server";

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

export default async function HomePage() {
  const totalUsers = await getTotalUsers();
  return <LandingPage totalUsers={totalUsers} />;
}
