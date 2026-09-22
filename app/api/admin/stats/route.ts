import { NextResponse } from "next/server";
import { requireUser, errorResponse } from "@/lib/api-auth";
import { requireRole, audit } from "@/lib/rbac";

/** Site stats for the admin dashboard. Admin+ only. */
export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    await requireRole(supabase, user.id, "admin");

    const [users, projects, conversations, runs, feedback, credits] = await Promise.all([
      supabase.from("profiles").select("id, role, created_at", { count: "exact", head: false }).limit(1000),
      supabase.from("projects").select("id", { count: "exact", head: true }),
      supabase.from("conversations").select("id", { count: "exact", head: true }),
      supabase.from("usage_runs").select("prompt_tokens, completion_tokens", { count: "exact", head: false }).limit(5000),
      supabase.from("feedback").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("credits").select("balance").limit(2000),
    ]);

    const rows = users.data ?? [];
    const tokens = (runs.data ?? []).reduce(
      (acc, r) => acc + (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0),
      0
    );
    const creditsOutstanding = (credits.data ?? []).reduce((acc, r) => acc + (r.balance ?? 0), 0);

    return NextResponse.json({
      totalUsers: users.count ?? rows.length,
      staffUsers: rows.filter((r) => r.role === "admin" || r.role === "owner").length,
      totalProjects: projects.count ?? 0,
      totalConversations: conversations.count ?? 0,
      agentRuns: runs.count ?? 0,
      tokensProcessed: tokens,
      openFeedback: feedback.count ?? 0,
      creditsOutstanding,
      signupsByDay: groupByDay(rows.map((r) => r.created_at)),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

function groupByDay(dates: string[]): { day: string; count: number }[] {
  const map = new Map<string, number>();
  for (const d of dates) {
    if (!d) continue;
    const day = d.slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([day, count]) => ({ day, count }));
}
