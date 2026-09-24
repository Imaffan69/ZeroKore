import { NextResponse } from "next/server";
import { requireStaff, adminError } from "@/lib/admin-guard";

/**
 * Security analytics for admins: recent auth events across accounts with
 * IP, approximate location (country/city) and device — plus a country
 * histogram. Admin+ only, and every call is audited.
 */
export async function GET() {
  try {
    const actor = await requireStaff("admin");
    const db = actor.db;
    try {
      await db.from("admin_audit").insert({
        actor_id: actor.userId,
        actor_label: actor.username,
        action: "admin.security.view",
      });
    } catch {
      // audit is best effort
    }

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
    return adminError(err);
  }
}
