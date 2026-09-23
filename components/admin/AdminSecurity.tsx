"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe, Loader2 } from "lucide-react";

interface SecurityEvent {
  user_id: string;
  event: string;
  ip: string | null;
  country: string | null;
  city: string | null;
  user_agent: string | null;
  created_at: string;
}

/**
 * Security tab: recent auth events (IP · approximate location · device) and a
 * country histogram. Everything here is real data from `login_events`, which
 * the Privacy Policy discloses we collect.
 */
export default function AdminSecurity() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [countries, setCountries] = useState<{ country: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/security");
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Could not load security events.");
      } else {
        setEvents(json.events ?? []);
        setCountries(json.countries ?? []);
        setError(null);
      }
    } catch {
      setError("Connection failed while loading security events.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-kore-muted" />;
  if (error) return <p className="text-sm text-red-300">{error}</p>;

  const maxCount = Math.max(1, ...countries.map((c) => c.count));

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4">
        <p className="mb-3 flex items-center gap-2 text-xs text-kore-muted">
          <Globe className="h-3.5 w-3.5" aria-hidden />
          Signins by country — last {events.length} events
        </p>
        {countries.length === 0 ? (
          <p className="text-sm text-kore-muted">No auth events recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {countries.map((c) => (
              <div key={c.country} className="grid grid-cols-[140px_1fr_40px] items-center gap-2 text-xs">
                <span className="truncate text-kore-text">{c.country}</span>
                <span className="h-2 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="block h-full rounded-full bg-kore-accent"
                    style={{ width: `${(c.count / maxCount) * 100}%` }}
                  />
                </span>
                <span className="text-right font-mono text-kore-muted">{c.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[720px] text-left text-xs">
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
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-kore-muted">
                  Nothing recorded yet.
                </td>
              </tr>
            )}
            {events.map((e, i) => (
              <tr key={`${e.created_at}-${i}`} className="border-b border-white/5">
                <td className="px-4 py-2.5 font-mono text-kore-muted">
                  {e.created_at.slice(0, 19).replace("T", " ")}
                </td>
                <td className="px-4 py-2.5">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white">
                    {e.event}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-kore-muted">{e.user_id.slice(0, 8)}…</td>
                <td className="px-4 py-2.5 font-mono text-kore-text">{e.ip ?? "—"}</td>
                <td className="px-4 py-2.5 text-kore-text">
                  {[e.city, e.country].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-4 py-2.5 text-kore-muted">
                  {e.user_agent
                    ? `${/mobile/i.test(e.user_agent) ? "Mobile" : "Desktop"} · ${
                        /windows/i.test(e.user_agent)
                          ? "Windows"
                          : /android/i.test(e.user_agent)
                            ? "Android"
                            : /iphone|ipad|ios/i.test(e.user_agent)
                              ? "iOS"
                              : /mac/i.test(e.user_agent)
                                ? "macOS"
                                : /linux/i.test(e.user_agent)
                                  ? "Linux"
                                  : "OS?"
                      }`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
