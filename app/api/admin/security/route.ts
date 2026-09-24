import { NextResponse } from "next/server";
import { requireStaff, adminError } from "@/lib/admin-guard";

/** Device label derived from a stored user-agent string. */
function describeDevice(ua: string | null): string {
  if (!ua) return "—";
  const os = /windows/i.test(ua)
    ? "Windows"
    : /macintosh|mac os/i.test(ua)
      ? "macOS"
      : /android/i.test(ua)
        ? "Android"
        : /iphone|ipad|ios/i.test(ua)
          ? "iOS"
          : /linux/i.test(ua)
            ? "Linux"
            : "Unknown OS";
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /chrome\//i.test(ua)
      ? "Chrome"
      : /safari\//i.test(ua)
        ? "Safari"
        : /firefox\//i.test(ua)
          ? "Firefox"
          : "Browser";
  const kind = /mobile/i.test(ua)
    ? "Mobile"
    : /tablet|ipad/i.test(ua)
      ? "Tablet"
      : "Desktop";
  return `${kind} · ${os} · ${browser}`;
}

/**
 * Live security + traffic view for admins.
 *
 * `login_events` is now a continuous activity log (sign-ins plus agent runs,
 * file edits, project creation and GitHub sync), each row carrying the request
 * IP, the approximate location Vercel resolved from it, and the device. The
 * panel polls this route, so the owner sees where traffic is coming from as it
 * happens rather than only at sign-in.
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
      .select("user_id, event, ip, country, city, user_agent, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ error: "Could not load events." }, { status: 500 });

    const rows = (data ?? []) as {
      user_id: string;
      event: string;
      ip: string | null;
      country: string | null;
      city: string | null;
      user_agent: string | null;
      detail: Record<string, unknown> | null;
      created_at: string;
    }[];

    // Country histogram.
    const byCountry = new Map<string, number>();
    for (const r of rows) {
      const key = r.country ?? "Unknown";
      byCountry.set(key, (byCountry.get(key) ?? 0) + 1);
    }
    const countries = [...byCountry.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([country, count]) => ({ country, count }));

    // Distinct-IP view: an IP seen more than once is worth a second look.
    const byIp = new Map<string, { ip: string; count: number; country: string | null; city: string | null }>();
    for (const r of rows) {
      if (!r.ip) continue;
      const entry = byIp.get(r.ip) ?? { ip: r.ip, count: 0, country: r.country, city: r.city };
      entry.count += 1;
      byIp.set(r.ip, entry);
    }
    const visitors = [...byIp.values()].sort((a, b) => b.count - a.count).slice(0, 25);

    // Resolve usernames so rows are readable instead of raw UUIDs.
    const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    const { data: profiles } = ids.length
      ? await db.from("profiles").select("id, username, email").in("id", ids)
      : { data: [] as { id: string; username: string | null; email: string | null }[] };
    const byId = new Map(
      (profiles ?? []).map((p: { id: string; username: string | null; email: string | null }) => [
        p.id,
        p.username || p.email || p.id.slice(0, 8),
      ])
    );

    const events = rows.map((r) => ({
      ...r,
      user: byId.get(r.user_id) ?? r.user_id.slice(0, 8),
      device: describeDevice(r.user_agent),
    }));

    const last24h = Date.now() - 24 * 60 * 60 * 1000;
    const recent = rows.filter((r) => new Date(r.created_at).getTime() > last24h);

    return NextResponse.json({
      events,
      countries,
      visitors,
      total: rows.length,
      summary: {
        events24h: recent.length,
        uniqueIps: byIp.size,
        countries: byCountry.size,
        lastEventAt: rows[0]?.created_at ?? null,
      },
    });
  } catch (err) {
    return adminError(err);
  }
}
