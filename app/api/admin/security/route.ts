import { NextResponse } from "next/server";
import { requireUser, errorResponse } from "@/lib/api-auth";
import { requireRole, audit } from "@/lib/rbac";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Security analytics for admins: recent auth events across accounts with
 * IP, approximate location (country/city) and device — plus a country
 * histogram. Every call is audited. Admin+ only. Cross-account reads use
 * the service client (login_events RLS only exposes the caller's own rows).
 */
export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    await requireRole(supabase, user.id, "admin", user.email);
    const db = await createServiceClient();
    await audit(db, user.id, "admin.security.view", "login_events");

    const { data, error } = await db
      .from("login_events")
      .select("user_id, event, ip, country, city, user_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ error: "Could not load events." }, { status: 500 });

    const rows = data ?? [];
    const byCountry = new Map<string, number>();
    for (const r of rows) {
      const key = r.country ?? "Unknown";
      byCountry.set(key, (byCountry.get(key) ?? 0) + 1);
    }
    const countries = [...byCountry.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([country, count]) => ({ country, count }));

    return NextResponse.json({
      events: rows,
      countries,
      total: rows.length,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
