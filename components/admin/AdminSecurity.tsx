"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Globe, Loader2, RefreshCw, Radio } from "lucide-react";
import VisitorMap, { type MapPoint } from "@/components/admin/VisitorMap";

interface SecurityEvent {
  user_id: string;
  user: string;
  event: string;
  ip: string | null;
  country: string | null;
  city: string | null;
  device: string;
  detail: Record<string, unknown> | null;
  created_at: string;
}

interface Visitor {
  ip: string;
  count: number;
  country: string | null;
  city: string | null;
}

interface SecurityPayload {
  events: SecurityEvent[];
  countries: { country: string; count: number }[];
  visitors: Visitor[];
  total: number;
  summary: {
    events24h: number;
    uniqueIps: number;
    countries: number;
    lastEventAt: string | null;
  };
}

/** Security + traffic tab.
 *
 * Every row is a real request: IP, the approximate location Vercel resolved from
 * it, and the device. The view polls so it behaves like a live feed rather than
 * a snapshot you have to reload â€” the Privacy Policy discloses exactly this
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
   * Events that carry real coordinates, newest first.
   *
   * `detail.latitude` is written by the geolocation lookup. Rows recorded before
   * that ran have no coordinates and are left off the map rather than being
   * snapped to a country centroid, which would draw a pin somewhere the user
   * has never been.
   */
  const mapPoints: MapPoint[] = useMemo(() => {
    if (!data) return [];
    const out: MapPoint[] = [];
    for (const e of data.events) {
      const d = (e.detail ?? {}) as Record<string, unknown>;
      const lat = typeof d.latitude === "number" ? d.latitude : null;
      const lon = typeof d.longitude === "number" ? d.longitude : null;
      if (lat === null || lon === null) continue;
      out.push({
        id: `${e.created_at}-${e.user_id}`,
        user: e.user,
        event: e.event,
        country: e.country,
        city: e.city,
        ip: e.ip,
        latitude: lat,
        longitude: lon,
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
          {
            label: "EVENTS Â· 24H",
            value: data.summary.events24h,
            hint: "requests captured",
          },
          {
            label: "UNIQUE IPS",
            value: data.summary.uniqueIps,
            hint: "in the recent window",
          },
          {
            label: "COUNTRIES",
            value: data.summary.countries,
            hint: "approximate locations",
          },
          {
            label: "LAST EVENT",
            value: data.summary.lastEventAt
              ? new Date(data.summary.lastEventAt).toLocaleTimeString()
              : "â€”",
            hint: data.summary.lastEventAt
              ? new Date(data.summary.lastEventAt).toLocaleDateString()
              : "nothing yet",
          },
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
          Traffic by country â€” last {data.total} events
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
            {live ? "Live Â· 15s" : "Paused"}
          </button>
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs text-kore-muted transition hover:text-white"
          >
            <RefreshCw className="h-3 w-3" aria-hidden /> Refresh
          </button>
        </div>
      </div>

      {/* World map — plotted from the coordinates ipgeolocation.io resolved for
          each event. Rows without a coordinate are skipped, never guessed. */}
      <VisitorMap points={mapPoints} />

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
                  {[v.city, v.country].filter(Boolean).join(", ") || "Unknown"} Â· {v.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event log */}
      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 font-mono text-[10px] uppercase tracking-[0.14em] text-kore-muted">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Device</th>
            </tr>
          </thead>
          <tbody>
            {data.events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-kore-muted">
                  Nothing recorded yet.
                </td>
              </tr>
            )}
            {data.events.map((e, i) => (
              <tr key={`${e.created_at}-${i}`} className="border-b border-white/5">
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-kore-muted">
                  {e.created_at.slice(0, 19).replace("T", " ")}
                </td>
                <td className="px-4 py-2.5">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white">
                    {e.event}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-kore-muted">{e.user}</td>
                <td className="px-4 py-2.5 font-mono text-kore-text">{e.ip ?? "â€”"}</td>
                <td className="px-4 py-2.5 text-kore-text">
                  {[e.city, e.country].filter(Boolean).join(", ") || "â€”"}
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
