"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface AdminUser {
  id: string;
  email: string | null;
  username: string | null;
  role: string;
  plan: string;
  suspended: boolean;
  mfa_enrolled: boolean;
  created_at: string;
}

const PLANS = ["free", "plus", "pro", "max", "team", "student"];
const ROLES = ["user", "viewer", "support", "moderator", "admin"];

export default function AdminUserRow({
  user, isOwner, selfRole, onPatch,
}: {
  user: AdminUser;
  isOwner: boolean;
  selfRole: string;
  onPatch: (id: string, updates: Record<string, unknown>) => Promise<void>;
}) {
  const [credits, setCredits] = useState("");
  const [open, setOpen] = useState(false);
  const canEdit = isOwner || !["admin", "owner"].includes(user.role);

  return (
    <div className="glass rounded-2xl p-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <p className="text-sm font-medium text-white">
            {user.username ?? user.email ?? user.id}
            {user.suspended && <span className="ml-2 text-xs text-red-400">suspended</span>}
            {!user.mfa_enrolled && ["admin", "owner"].includes(user.role) && (
              <span className="ml-2 text-xs text-amber-400">no MFA</span>
            )}
          </p>
          <p className="text-xs text-kore-muted">
            {user.email} · {user.plan} · {user.role} · joined {user.created_at.slice(0, 10)}
          </p>
        </div>
        <span className="text-xs text-kore-muted">{open ? "hide" : "manage"}</span>
      </button>

      {open && canEdit && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-kore-muted">
            Plan
            <select
              defaultValue={user.plan}
              onChange={(e) => onPatch(user.id, { plan: e.target.value })}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            >
              {PLANS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          {isOwner && (
            <label className="text-xs text-kore-muted">
              Role
              <select
                defaultValue={user.role}
                onChange={(e) => onPatch(user.id, { role: e.target.value })}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
          )}
          <div className="flex gap-2">
            <input
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              placeholder="Grant credits…"
              inputMode="numeric"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
            <button
              onClick={async () => {
                const n = parseInt(credits, 10);
                if (n > 0) {
                  await onPatch(user.id, { grant_credits: n });
                  setCredits("");
                }
              }}
              className="rounded-xl bg-kore-accent px-3 text-sm font-medium text-black"
            >
              Grant
            </button>
          </div>
          <button
            onClick={() => onPatch(user.id, { suspended: !user.suspended })}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-medium",
              user.suspended ? "bg-emerald-500/90 text-black" : "bg-red-500/80 text-white"
            )}
          >
            {user.suspended ? "Unsuspend account" : "Suspend account"}
          </button>
          <p className="text-[11px] text-kore-muted sm:col-span-2">
            Your rank: {selfRole}.{" "}
            {isOwner ? "You can modify anyone." : "Staff accounts are owner-only."}
          </p>
        </div>
      )}
    </div>
  );
}
