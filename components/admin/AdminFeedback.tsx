"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface FeedbackItem {
  id: string;
  message: string;
  status: string;
  page: string | null;
  created_at: string;
  profiles: { email: string | null; username: string | null } | null;
}

export default function AdminFeedback() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/feedback");
    if (res.ok) setItems((await res.json()).feedback);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id: string, status: string) {
    await fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  if (loading) return <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-kore-muted" />;
  if (items.length === 0) return <p className="text-sm text-kore-muted">Inbox is empty.</p>;

  return (
    <div className="space-y-3">
      {items.map((f) => (
        <div key={f.id} className="glass rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-white">{f.message}</p>
              <p className="mt-1 text-xs text-kore-muted">
                {f.profiles?.username ?? f.profiles?.email ?? "anonymous"}
                {f.page ? ` · on ${f.page}` : ""} ·{" "}
                {f.created_at.slice(0, 16).replace("T", " ")}
              </p>
            </div>
            <select
              value={f.status}
              onChange={(e) => setStatus(f.id, e.target.value)}
              className="rounded-xl border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
            >
              {["open", "read", "resolved"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}
