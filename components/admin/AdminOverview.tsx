"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface Stats {
  totalUsers: number;
  staffUsers: number;
  totalProjects: number;
  totalConversations: number;
  agentRuns: number;
  tokensProcessed: number;
  openFeedback: number;
  creditsOutstanding: number;
  signupsByDay: { day: string; count: number }[];
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs text-kore-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/stats");
    if (res.ok) setStats(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !stats)
    return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-kore-muted" />;
  if (!stats) return <p className="text-sm text-kore-muted">Stats unavailable.</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total users" value={stats.totalUsers} />
        <Stat label="Projects" value={stats.totalProjects} />
        <Stat label="Conversations" value={stats.totalConversations} />
        <Stat label="Agent runs" value={stats.agentRuns} />
        <Stat label="Tokens processed" value={stats.tokensProcessed.toLocaleString()} />
        <Stat label="Credits outstanding" value={stats.creditsOutstanding.toLocaleString()} />
        <Stat label="Open feedback" value={stats.openFeedback} />
        <Stat label="Staff accounts" value={stats.staffUsers} />
      </div>
      <div className="glass rounded-2xl p-4">
        <p className="mb-3 text-xs text-kore-muted">Signups — last 14 days</p>
        {stats.signupsByDay.length === 0 ? (
          <p className="text-sm text-kore-muted">No signups recorded yet.</p>
        ) : (
          <div className="flex h-28 items-end gap-1.5">
            {stats.signupsByDay.map(({ day, count }) => (
              <div key={day} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-kore-accent/70"
                  style={{
                    height: `${Math.max(4, (count / Math.max(...stats.signupsByDay.map((s) => s.count))) * 100)}%`,
                  }}
                  title={`${day}: ${count}`}
                />
                <span className="text-[10px] text-kore-muted">{day.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
