"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, ShieldCheck, Trash2, UserPlus } from "lucide-react";

interface StaffAccount {
  id: string;
  username: string;
  role: string;
  isOwner: boolean;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

const ASSIGNABLE = ["viewer", "support", "moderator", "admin"] as const;

const ROLE_SUMMARY: Record<string, string> = {
  viewer: "Dashboard counters only.",
  support: "Read-only staff view.",
  moderator: "Feedback inbox + announcements.",
  admin: "Users, security log, announcements, site control.",
};

/**
 * Owner-only staff management: create an admin account with its own username
 * and password, change its role, reset the password, disable or delete it.
 */
export default function AdminStaff() {
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("moderator");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/staff");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAccounts([]);
        setError((json.error as string) ?? `Request failed (${res.status}).`);
        return;
      }
      setAccounts(Array.isArray(json.accounts) ? json.accounts : []);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, role }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((json.error as string) ?? "Could not create that account.");
        return;
      }
      setMessage(`Created ${json.account.username} (${json.account.role}).`);
      setUsername("");
      setPassword("");
      load();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  async function updateAccount(id: string, updates: Record<string, unknown>, label: string) {
    setMessage(null);
    setError(null);
    const res = await fetch("/api/admin/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json.error as string) ?? "Update failed.");
      return;
    }
    setMessage(label);
    load();
  }

  async function removeAccount(id: string, name: string) {
    if (!window.confirm(`Delete the staff account "${name}"? This cannot be undone.`)) return;
    setMessage(null);
    setError(null);
    const res = await fetch("/api/admin/staff", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json.error as string) ?? "Delete failed.");
      return;
    }
    setMessage(`Deleted ${name}.`);
    load();
  }

  async function resetPassword(id: string, name: string) {
    const next = window.prompt(`New password for "${name}" (minimum 8 characters):`);
    if (!next) return;
    await updateAccount(id, { password: next }, `Password reset for ${name}.`);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={createAccount} className="glass space-y-3 rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-kore-accent" aria-hidden />
          <h2 className="text-sm font-semibold text-white">Create a staff account</h2>
        </div>
        <p className="text-xs text-kore-muted">
          Staff sign in at <span className="font-mono">/kore/admin</span> with this username and
          password. They do not need a ZeroKore account.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="off"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-kore-muted"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 chars)"
            autoComplete="new-password"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-kore-muted"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          >
            {ASSIGNABLE.map((r) => (
              <option key={r} value={r} className="bg-black">
                {r}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-kore-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          Create account
        </button>
      </form>

      {message && <p className="text-xs text-kore-accent">{message}</p>}
      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <Loader2 className="mx-auto mt-8 h-6 w-6 animate-spin text-kore-muted" />
      ) : (
        <div className="space-y-2">
          {accounts.map((a) => (
            <StaffRow
              key={a.id}
              account={a}
              onRole={(next) =>
                updateAccount(a.id, { role: next }, `${a.username} is now ${next}.`)
              }
              onPassword={() => resetPassword(a.id, a.username)}
              onToggle={() =>
                updateAccount(
                  a.id,
                  { disabled: !a.disabled },
                  `${a.username} ${a.disabled ? "enabled" : "disabled"}.`
                )
              }
              onDelete={() => removeAccount(a.id, a.username)}
            />
          ))}
          {accounts.length === 0 && (
            <p className="text-sm text-kore-muted">No staff accounts yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function StaffRow({
  account,
  onRole,
  onPassword,
  onToggle,
  onDelete,
}: {
  account: StaffAccount;
  onRole: (role: string) => void;
  onPassword: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm text-white">
          {account.isOwner && (
            <ShieldCheck className="h-3.5 w-3.5 text-kore-accent" aria-hidden />
          )}
          <span className="font-mono">{account.username}</span>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-kore-muted">
            {account.role}
          </span>
          {account.disabled && (
            <span className="rounded-full border border-red-500/40 px-2 py-0.5 text-[11px] text-red-300">
              disabled
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[11px] text-kore-faint">
          {ROLE_SUMMARY[account.role] ?? ""} ·{" "}
          {account.lastLoginAt
            ? `last signed in ${new Date(account.lastLoginAt).toLocaleString()}`
            : "never signed in"}
        </p>
      </div>
      {account.isOwner ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={account.role}
            onChange={(e) => onRole(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
          >
            {ASSIGNABLE.map((r) => (
              <option key={r} value={r} className="bg-black">
                {r}
              </option>
            ))}
          </select>
          <button
            onClick={onPassword}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-kore-muted hover:text-white"
          >
            <KeyRound className="h-3 w-3" aria-hidden /> Password
          </button>
          <button
            onClick={onToggle}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-kore-muted hover:text-white"
          >
            {account.disabled ? "Enable" : "Disable"}
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-full border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="h-3 w-3" aria-hidden /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

