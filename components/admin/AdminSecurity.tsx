"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Globe,
  Laptop,
  Loader2,
  MapPin,
  Radio,
  RefreshCw,
} from "lucide-react";
import VisitorMap, { type MapPoint } from "@/components/admin/VisitorMap";
import UserMap from "@/components/admin/UserMap";
import { cn } from "@/lib/utils";

interface SecurityEvent {
  user_id: string;
  user: string;
  event: string;
  ip: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  asn: string | null;
  network: string | null;
  geoProvider: string | null;
  device: string;
  precise: boolean;
  created_at: string;
}

interface DeviceRow {
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
  devices: string[];
}

interface UserRow {
  userId: string;
  user: string;
  events: number;
  lastSeen: string;
  deviceCount: number;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  country: string | null;
  region: string | null;
  timezone: string | null;
  asn: string | null;
  network: string | null;
  devices: DeviceRow[];
}

interface Visitor {
  ip: string;
  count: number;
  country: string | null;
  city: string | null;
}

interface SecurityPayload {
  events: SecurityEvent[];
  users: UserRow[];
  countries: { country: string; count: number }[];
  visitors: Visitor[];
  located: number;
  total: number;
  summary: {
    events24h: number;
    uniqueIps: number;
    countries: number;
    users: number;
    lastEventAt: string | null;
  };
}

function when(iso: string): string {
  return iso.slice(0, 19).replace("T", " ");
}

/** Coordinates, or an explicit "not resolved" — never a fabricated position. */
function coords(lat: number | null, lon: number | null): string {
  if (lat === null || lon === null) return "not resolved";
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

/**
 * One person, their devices, and their own map.
 *
 * Selecting a device re-centres the map on that address, so when two devices of
 * the same account sit in different cities you can see both rather than a
 * single ambiguous pin.
 */
function UserCard({ user }: { user: UserRow }) {
  const [open, setOpen] = useState(false);
  const [selectedIp, setSelectedIp] = useState<string | null>(null);

  const located = user.devices.filter(
    (d) => d.latitude !== null && d.longitude !== null
  );
  const selected =
    user.devices.find((d) => d.ip === selectedIp) ?? located[0] ?? null;
  const canMap = selected !== null && selected.latitude !== null && selected.longitude !== null;

  return (
    <div className="glass rounded-2xl p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{user.user}</p>
          <p className="text-xs text-kore-muted">
            {user.deviceCount} {user.deviceCount === 1 ? "device" : "devices"} ·{" "}
            {user.events} events · last seen {when(user.lastSeen).slice(0, 16)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-kore-text">
            {[user.city, user.country].filter(Boolean).join(", ") || "Unknown location"}
          </p>
          <p className="font-mono text-[10px] text-kore-muted">
            {coords(user.latitude, user.longitude)}
          </p>
        </div>
      </button>

      {open && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_1fr]">
          <div className="min-w-0 space-y-1.5">
            {user.devices.map((d) => {
              const active = selected?.ip === d.ip;
              const placeable = d.latitude !== null && d.longitude !== null;
              return (
                <button
                  key={d.ip}
                  type="button"
                  onClick={() => setSelectedIp(d.ip)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2 text-left transition",
                    active
                      ? "border-kore-accent/50 bg-white/5"
                      : "border-white/10 hover:border-white/20 hover:bg-white/[0.03]"
                  )}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-white">{d.ip}</span>
                    <span className="font-mono text-[10px] text-kore-muted">
                      {d.count}× · {when(d.lastSeen).slice(5, 16)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11px] text-kore-muted">
                    {[d.city, d.region, d.country].filter(Boolean).join(", ") || "Unknown"}{" "}
                    · {coords(d.latitude, d.longitude)}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-kore-faint">
                    <span className="inline-flex items-center gap-1">
                      <Laptop className="h-3 w-3" aria-hidden />
                      {d.devices.join(" / ") || "Unknown device"}
                    </span>
                    {d.timezone && <span>{d.timezone}</span>}
                    {d.asn && <span>AS{d.asn}</span>}
                    {d.network && <span className="truncate">{d.network}</span>}
                    {!placeable && <span>no coordinates</span>}
                  </span>
                </button>
              );
            })}
            {user.devices.length === 0 && (
              <p className="text-xs text-kore-muted">No address recorded yet.</p>
            )}
          </div>

          <div className="min-w-0">
            {canMap && selected ? (
              <UserMap
                latitude={selected.latitude as number}
                longitude={selected.longitude as number}
                label={`${user.user} · ${selected.ip}`}
                caption={[selected.city, selected.country].filter(Boolean).join(", ")}
              />
            ) : (
              <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-white/10 px-4 text-center text-xs text-kore-muted">
                No coordinates for this account yet. They appear once an address
                resolves to a place.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Security + traffic tab.
 *
 * Every row is a real request: the device's own IP, the location resolved from
 * it, and the device. The view polls so it behaves like a live feed rather than
 * a snapshot you have to reload — the Privacy Policy discloses exactly this
 * collection. */
export default function AdminSecurity() {
  const [data, setData] = useState<SecurityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch("/api/admin/security");
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not load security events.");
        setData(null);
      } else {
        setData(json as SecurityPayload);
        setError(null);
      }
    } catch {
      setError("Connection failed while loading security events.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live refresh every 15s while the tab is visible and polling is enabled.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, 15000);
    return () => clearInterval(id);
  }, [live, load]);

  /**
   * One pin per user *and* address.
   *
   * Plotting every event stacked dozens of identical markers on top of each
   * other, so a user with one device looked like a hotspot and a user with
   * three devices looked like one. Deduplicating makes the difference visible.
   */
  const mapPoints: MapPoint[] = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    const out: MapPoint[] = [];
    for (const e of data.events) {
      if (e.latitude === null || e.longitude === null) continue;
      const key = `${e.user_id}|${e.ip ?? "unknown"}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `${e.created_at}-${e.user_id}-${e.ip ?? "unknown"}`,
        user: e.user,
        event: e.event,
        country: e.country,
        city: e.city,
        ip: e.ip,
        latitude: e.latitude,
        longitude: e.longitude,
        at: e.created_at,
      });
    }
    return out;
  }, [data]);

  if (loading)
    return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-kore-muted" />;
  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!data) return <p className="text-sm text-kore-muted">No activity recorded yet.</p>;

  const maxCount = Math.max(1, ...data.countries.map((c) => c.count));

  return (
    <div className="space-y-4">
      {/* Live summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "EVENTS · 24H", value: data.summary.events24h, hint: "requests captured" },
          { label: "UNIQUE IPS", value: data.summary.uniqueIps, hint: "distinct addresses" },
          { label: "USERS", value: data.summary.users, hint: "with recorded activity" },
          { label: "LAST EVENT", value: data.summary.lastEventAt ? new Date(data.summary.lastEventAt).toLocaleTimeString() : "—",
            hint: data.summary.lastEventAt ? new Date(data.summary.lastEventAt).toLocaleDateString() : "nothing yet" },
        ].map((t) => (
          <div key={t.label} className="glass rounded-2xl p-4">
            <p className="font-mono text-[10px] tracking-[0.18em] text-kore-muted">
              {t.label}
            </p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight text-white">
              {t.value}
            </p>
            <p className="text-[11px] text-kore-muted">{t.hint}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-kore-muted">
          <Globe className="h-3.5 w-3.5" aria-hidden />
          Traffic by country — {data.located}/{data.total} events placed on the map
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLive((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
              live
                ? "border-kore-accent/50 bg-kore-accent/10 text-kore-accent"
                : "border-white/10 text-kore-muted"
            }`}
          >
            <Radio className={`h-3 w-3 ${live ? "animate-pulse" : ""}`} aria-hidden />
            {live ? "Live · 15s" : "Paused"}
          </button>
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs text-kore-muted transition hover:text-white"
          >
            <RefreshCw className="h-3 w-3" aria-hidden /> Refresh
          </button>
        </div>
      </div>

      {/* World map — one pin per user and address, placed from the coordinates
          resolved for that IP. Rows without a coordinate are skipped, never
          guessed. */}
      <VisitorMap points={mapPoints} />

      {/* Per user: every device, its full IP details, and that user's own map. */}
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-xs text-kore-muted">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          Every user gets their own map — open a row to see each device and plot it
        </p>
        {data.users.length === 0 ? (
          <p className="glass rounded-2xl p-4 text-sm text-kore-muted">
            No activity recorded yet.
          </p>
        ) : (
          data.users.map((u) => <UserCard key={u.userId} user={u} />)
        )}
      </div>

      {/* Country histogram */}
      <div className="glass rounded-2xl p-4">
        {data.countries.length === 0 ? (
          <p className="text-sm text-kore-muted">No events recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {data.countries.map((c) => (
              <div
                key={c.country}
                className="grid grid-cols-[140px_1fr_40px] items-center gap-2 text-xs"
              >
                <span className="truncate text-kore-text">{c.country}</span>
                <span className="h-2 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="block h-full rounded-full bg-kore-accent transition-[width] duration-500"
                    style={{ width: `${(c.count / maxCount) * 100}%` }}
                  />
                </span>
                <span className="text-right font-mono text-kore-muted">{c.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Distinct visitors */}
      <div className="glass overflow-x-auto rounded-2xl p-4">
        <p className="mb-3 flex items-center gap-2 text-xs text-kore-muted">
          <Activity className="h-3.5 w-3.5" aria-hidden />
          Distinct IP addresses (repeat activity appears first)
        </p>
        {data.visitors.length === 0 ? (
          <p className="text-sm text-kore-muted">No IP data yet.</p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {data.visitors.map((v) => (
              <div
                key={v.ip}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2"
              >
                <span className="truncate font-mono text-[11px] text-kore-text">{v.ip}</span>
                <span className="shrink-0 text-[11px] text-kore-muted">
                  {[v.city, v.country].filter(Boolean).join(", ") || "Unknown"} · {v.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event log */}
      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 font-mono text-[10px] uppercase tracking-[0.14em] text-kore-muted">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Coordinates</th>
              <th className="px-4 py-3">Device</th>
            </tr>
          </thead>
          <tbody>
            {data.events.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-kore-muted">
                  Nothing recorded yet.
                </td>
              </tr>
            )}
            {data.events.map((e, i) => (
              <tr key={`${e.created_at}-${i}`} className="border-b border-white/5">
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-kore-muted">
                  {when(e.created_at)}
                </td>
                <td className="px-4 py-2.5">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white">
                    {e.event}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-kore-muted">{e.user}</td>
                <td className="px-4 py-2.5 font-mono text-kore-text">{e.ip ?? "—"}</td>
                <td className="px-4 py-2.5 text-kore-text">
                  {[e.city, e.region, e.country].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-kore-muted">
                  {coords(e.latitude, e.longitude)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-kore-muted">{e.device}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}