"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import AdminUserRow from "@/components/admin/AdminUserRow";

interface AdminUser {
  id: string;
  email: string | null;
  username: string | null;
  role: string;
  plan: string;
  credits_override: number | null;
  suspended: boolean;
  mfa_enrolled: boolean;
  created_at: string;
}

export default function AdminUsers({ isOwner, selfRole }: { isOwner: boolean; selfRole: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`);
    if (res.ok) setUsers((await res.json()).users);
    setLoading(false);
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  async function patch(userId: string, updates: Record<string, unknown>) {
    setMessage(null);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...updates }),
    });
    const json = await res.json();
    setMessage(res.ok ? "Saved." : (json.error as string) ?? "Update failed.");
    if (res.ok) load(q);
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(q);
        }}
        className="flex gap-2"
      >
        <div className="glass flex flex-1 items-center gap-2 rounded-full px-4 py-2">
          <Search className="h-4 w-4 text-kore-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by email or username…"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-kore-muted"
          />
        </div>
        <button className="glass glass-interactive rounded-full px-4 text-sm">Search</button>
      </form>

      {message && <p className="text-xs text-kore-accent">{message}</p>}
      {loading ? (
        <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-kore-muted" />
      ) : users.length === 0 ? (
        <p className="text-sm text-kore-muted">No users found.</p>
      ) : (
        users.map((u) => (
          <AdminUserRow key={u.id} user={u} isOwner={isOwner} selfRole={selfRole} onPatch={patch} />
        ))
      )}
    </div>
  );
}
