"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface Announcement {
  id: string;
  kind: string;
  title: string;
  body: string;
  version: string | null;
  active: boolean;
  created_at: string;
}

export default function AdminAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [kind, setKind] = useState("post");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/announcements");
    if (res.ok) setItems((await res.json()).announcements);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function publish() {
    setError(null);
    const res = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, title, body, version }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError((json.error as string) ?? "Publish failed.");
      return;
    }
    setTitle("");
    setBody("");
    setVersion("");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="glass space-y-3 rounded-2xl p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          >
            {["post", "banner", "changelog", "maintenance"].map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="Version (optional, e.g. v2.1)"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          />
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Body — supports markdown"
          rows={4}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          onClick={publish}
          className="rounded-full bg-kore-accent px-5 py-2 text-sm font-medium text-black"
        >
          Publish
        </button>
      </div>

      {loading ? (
        <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-kore-muted" />
      ) : (
        items.map((a) => (
          <div key={a.id} className="glass flex items-start justify-between gap-3 rounded-2xl p-4">
            <div>
              <p className="text-sm font-medium text-white">
                {a.title}
                {a.version ? <span className="ml-2 text-xs text-kore-accent">{a.version}</span> : null}
                {!a.active && <span className="ml-2 text-xs text-kore-muted">inactive</span>}
              </p>
              <p className="text-xs text-kore-muted">
                {a.kind} · {a.created_at.slice(0, 10)}
              </p>
              <p className="mt-2 line-clamp-2 text-sm text-kore-muted">{a.body}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <button
                onClick={async () => {
                  await fetch("/api/admin/announcements", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: a.id, active: !a.active }),
                  });
                  load();
                }}
                className="rounded-full border border-white/10 px-3 py-1 text-xs"
              >
                {a.active ? "Unpublish" : "Publish"}
              </button>
              <button
                onClick={async () => {
                  await fetch("/api/admin/announcements", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: a.id }),
                  });
                  load();
                }}
                className="rounded-full px-3 py-1 text-xs text-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
