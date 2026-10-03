import { NextResponse } from "next/server";
import { requireStaff, adminError } from "@/lib/admin-guard";
import { geolocateIp, isPublicIp } from "@/lib/request-info";

/** How many distinct addresses are enriched per request. A panel refresh must
 *  stay fast even when a burst of new addresses arrives; the rest are resolved
 *  on the next refresh because the lookup is cached. */
const BACKFILL_LIMIT = 40;

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
  const kind = /mobile/i.test(ua) ? "Mobile" : /tablet|ipad/i.test(ua) ? "Tablet" : "Desktop";
  return `${kind} · ${os} · ${browser}`;
}

interface EventRow {
  user_id: string;
  event: string;
  ip: string | null;
  country: string | null;
  city: string | null;
  user_agent: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

/** Coordinates as stored on the event, or null when it never recorded any. */
function storedCoords(detail: Record<string, unknown> | null): {
  latitude: number | null;
  longitude: number | null;
} {
  const d = detail ?? {};
  const lat = typeof d.latitude === "number" ? d.latitude : null;
  const lon = typeof d.longitude === "number" ? d.longitude : null;
  if (lat === null || lon === null) return { latitude: null, longitude: null };
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return { latitude: null, longitude: null };
  }
  return { latitude: lat, longitude: lon };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Live security + traffic view for admins.
 *
 * `login_events` is a continuous activity log (sign-ins plus agent runs, file
 * edits, project creation and GitHub sync), each row carrying the request IP,
 * the location resolved from it, and the device.
 *
 * Two things this route exists to get right:
 *  - Addresses are per device. `lib/request-info` walks the proxy headers and
 *    keeps the first public hop, so two devices of the same account are two
 *    addresses rather than one shared proxy address.
 *  - Every address carries coordinates. Rows recorded before the enrichment
 *    existed (or on a deployment with no geolocation key) are resolved here, so
 *    the panel can draw a map for every user instead of showing a blank grid.
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

    const rows = (data ?? []) as EventRow[];

    // Fill in coordinates that were never captured. Distinct addresses only,
    // newest first, capped so one refresh stays quick.
    const missingIps = [
      ...new Set(
        rows
          .filter((r) => r.ip && isPublicIp(r.ip) && storedCoords(r.detail).latitude === null)
          .map((r) => r.ip as string)
      ),
    ].slice(0, BACKFILL_LIMIT);
    const resolved = new Map<
      string,
      { latitude: number; longitude: number; city: string | null; country: string | null }
    >();
    await Promise.all(
      missingIps.map(async (ip) => {
        const geo = await geolocateIp(ip);
        if (!geo || geo.latitude === null || geo.longitude === null) return;
        resolved.set(ip, {
          latitude: geo.latitude,
          longitude: geo.longitude,
          city: geo.city,
          country: geo.country,
        });
      })
    );

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

    // Flatten every row into one shape: coordinates, network and device all sit
    // at the top level so the client never has to dig into the jsonb blob.
    const events = rows.map((r) => {
      const d = (r.detail ?? {}) as Record<string, unknown>;
      const coords = storedCoords(r.detail);
      const live = r.ip ? resolved.get(r.ip) : undefined;
      const latitude = coords.latitude ?? live?.latitude ?? null;
      const longitude = coords.longitude ?? live?.longitude ?? null;
      return {
        user_id: r.user_id,
        user: byId.get(r.user_id) ?? r.user_id.slice(0, 8),
        event: r.event,
        ip: r.ip,
        city: r.city ?? live?.city ?? text(d.city) ?? null,
        country: r.country ?? live?.country ?? text(d.country) ?? null,
        region: text(d.region),
        latitude,
        longitude,
        timezone: text(d.timezone),
        asn: text(d.asn),
        network: text(d.network),
        geoProvider: live ? "resolved-live" : text(d.geoProvider),
        ipSource: text(d.ipSource) ?? "legacy",
        device: text(d.device) ?? describeDevice(r.user_agent),
        userAgent: r.user_agent,
        precise: d.precise === true || Boolean(live),
        created_at: r.created_at,
      };
    });

    // Country histogram.
    const byCountry = new Map<string, number>();
    for (const e of events) {
      const key = e.country ?? "Unknown";
      byCountry.set(key, (byCountry.get(key) ?? 0) + 1);
    }
    const countries = [...byCountry.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([country, count]) => ({ country, count }));

    // Distinct-IP view: an IP seen more than once is worth a second look.
    const byIp = new Map<
      string,
      { ip: string; count: number; country: string | null; city: string | null }
    >();
    for (const e of events) {
      if (!e.ip) continue;
      const entry = byIp.get(e.ip) ?? { ip: e.ip, count: 0, country: e.country, city: e.city };
      entry.count += 1;
      byIp.set(e.ip, entry);
    }
    const visitors = [...byIp.values()].sort((a, b) => b.count - a.count).slice(0, 25);

    // Per user, per device. Each user gets one entry with the addresses that
    // belong to them, so "the same IP for every device" is visible as several
    // rows under one person rather than a single ambiguous value.
    type Device = {
      ip: string;
      count: number;
      lastSeen: string;
      city: string | null;
      country: string | null;
      region: string | null;
      latitude: number | null;
      longitude: number | null;
      timezone: string | null;
      asn: string | null;
      network: string | null;
      geoProvider: string | null;
      ipSource: string;
      devices: string[];
    };
    const byUser = new Map<
      string,
      {
        userId: string;
        user: string;
        events: number;
        lastSeen: string;
        devices: Map<string, Device>;
      }
    >();
    for (const e of events) {
      const entry =
        byUser.get(e.user_id) ??
        {
          userId: e.user_id,
          user: e.user,
          events: 0,
          lastSeen: e.created_at,
          devices: new Map<string, Device>(),
        };
      entry.events += 1;
      if (e.created_at > entry.lastSeen) entry.lastSeen = e.created_at;
      const key = e.ip ?? "unknown";
      const device =
        entry.devices.get(key) ??
        {
          ip: e.ip ?? "unknown",
          count: 0,
          lastSeen: e.created_at,
          city: e.city,
          country: e.country,
          region: e.region,
          latitude: e.latitude,
          longitude: e.longitude,
          timezone: e.timezone,
          asn: e.asn,
          network: e.network,
          geoProvider: e.geoProvider,
          ipSource: e.ipSource,
          devices: [],
        };
      device.count += 1;
      if (e.created_at > device.lastSeen) device.lastSeen = e.created_at;
      if (e.device && !device.devices.includes(e.device)) device.devices.push(e.device);
      // Keep the most recent coordinates this address has ever resolved to.
      if (e.latitude !== null && e.longitude !== null) {
        device.latitude = e.latitude;
        device.longitude = e.longitude;
      }
      if (e.city) device.city = e.city;
      if (e.country) device.country = e.country;
      entry.devices.set(key, device);
      byUser.set(e.user_id, entry);
    }

    const users = [...byUser.values()]
      .map((u) => {
        const devices = [...u.devices.values()].sort((a, b) =>
          b.lastSeen.localeCompare(a.lastSeen)
        );
        // The user's current position is their most recent located device.
        const current =
          devices.find((d) => d.latitude !== null && d.longitude !== null) ?? null;
        return {
          userId: u.userId,
          user: u.user,
          events: u.events,
          lastSeen: u.lastSeen,
          deviceCount: devices.length,
          latitude: current?.latitude ?? null,
          longitude: current?.longitude ?? null,
          city: current?.city ?? null,
          country: current?.country ?? null,
          region: current?.region ?? null,
          timezone: current?.timezone ?? null,
          asn: current?.asn ?? null,
          network: current?.network ?? null,
          geoProvider: current?.geoProvider ?? null,
          devices,
        };
      })
      .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));

    const last24h = Date.now() - 24 * 60 * 60 * 1000;
    const recent = rows.filter((r) => new Date(r.created_at).getTime() > last24h);

    // Why the addresses look the way they do. A single address covering almost
    // every event is the signature of a proxy that is not forwarding the
    // visitor's, and the panel says so instead of leaving staff to guess.
    const topIp = visitors[0] ?? null;
    const clientReported = events.filter((e) => e.ipSource === "client-reported").length;
    const sharedIp = topIp !== null && topIp.count / Math.max(1, events.length) >= 0.8;

    return NextResponse.json({
      events,
      countries,
      visitors,
      users,
      located: events.filter((e) => e.latitude !== null).length,
      total: rows.length,
      diagnostics: {
        sharedIp,
        topIp: topIp?.ip ?? null,
        topIpShare: topIp ? topIp.count / Math.max(1, events.length) : 0,
        clientReported,
      },
      summary: {
        events24h: recent.length,
        uniqueIps: byIp.size,
        countries: byCountry.size,
        users: users.length,
        lastEventAt: rows[0]?.created_at ?? null,
      },
    });
  } catch (err) {
    return adminError(err);
  }
}