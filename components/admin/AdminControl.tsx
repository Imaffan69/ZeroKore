"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

export default function AdminControl({ isOwner }: { isOwner: boolean }) {
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string } | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/flags")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.maintenance) {
          setMaintenance(j.maintenance);
          setMessage(j.maintenance.message ?? "");
        }
      });
  }, []);

  if (!isOwner) {
    return (
      <p className="text-sm text-kore-muted">Site-wide controls are restricted to the owner.</p>
    );
  }

  async function save(enabled: boolean) {
    setSaving(true);
    setResult(null);
    const res = await fetch("/api/admin/flags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, message }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok) {
      setMaintenance(json.maintenance);
      setResult(enabled ? "Site is now in maintenance mode." : "Site is live.");
    } else {
      setResult((json.error as string) ?? "Failed.");
    }
  }

  return (
    <div className="glass max-w-xl space-y-4 rounded-2xl p-5">
      <div>
        <h2 className="text-sm font-semibold text-white">Maintenance / site shutdown</h2>
        <p className="mt-1 text-xs text-kore-muted">
          When enabled, every page and API returns a maintenance notice. Staff (support+) keep
          access. Every toggle is written to the audit trail.
        </p>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Optional message shown on the maintenance page…"
        rows={2}
        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={() => save(true)}
          disabled={saving || maintenance?.enabled === true}
          className="rounded-full bg-red-500/80 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Shut down site
        </button>
        <button
          onClick={() => save(false)}
          disabled={saving || maintenance?.enabled === false}
          className="rounded-full bg-emerald-500/90 px-5 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          Bring site back
        </button>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-kore-muted" />}
      </div>
      {result && <p className="text-xs text-kore-accent">{result}</p>}
      <p className="flex items-center gap-2 text-xs text-kore-muted">
        <RefreshCw className="h-3 w-3" /> Current state:{" "}
        {maintenance?.enabled ? "MAINTENANCE MODE" : "live"}
      </p>
    </div>
  );
}
