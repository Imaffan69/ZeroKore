"use client";

import { useState, useCallback } from "react";
import { BarChart3, Users, MessageSquare, Megaphone, ShieldAlert, Globe, LogOut, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminFeedback from "@/components/admin/AdminFeedback";
import AdminAnnouncements from "@/components/admin/AdminAnnouncements";
import AdminControl from "@/components/admin/AdminControl";
import AdminSecurity from "@/components/admin/AdminSecurity";
import AdminStaff from "@/components/admin/AdminStaff";
import AdminLoginForm from "@/components/admin/AdminLoginForm";

type Tab = "overview" | "users" | "security" | "feedback" | "announcements" | "staff" | "control";

/**
 * Each tab declares the minimum staff rank that may open it. The matching API
 * route enforces the same threshold server-side, so the client list is a
 * usability filter and never the security boundary.
 *
 * When accessed via admin password auth (ADMIN_USERNAME + ADMIN_PASSWORD_HASH),
 * the panel treats the user as "admin" rank for all tabs.
 */
const TABS: {
  id: Tab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  min: "viewer" | "moderator" | "admin" | "owner";
}[] = [
  { id: "overview", label: "Overview", icon: BarChart3, min: "viewer" },
  { id: "feedback", label: "Feedback", icon: MessageSquare, min: "moderator" },
  { id: "announcements", label: "Announcements", icon: Megaphone, min: "moderator" },
  { id: "users", label: "Users", icon: Users, min: "admin" },
  { id: "security", label: "Security & IPs", icon: Globe, min: "admin" },
  { id: "control", label: "Site control", icon: ShieldAlert, min: "admin" },
  { id: "staff", label: "Staff accounts", icon: UserCog, min: "owner" },
];

const RANK: Record<string, number> = {
  user: 0,
  viewer: 1,
  support: 2,
  moderator: 3,
  admin: 4,
  owner: 5,
};

export default function AdminPanel({
  role,
  isOwner,
  showLogin,
  adminUsername,
}: {
  role: string;
  isOwner: boolean;
  showLogin?: boolean;
  adminUsername?: string;
}) {
  const effectiveRole = role;
  const rank = RANK[effectiveRole] ?? 0;
  const allowed = TABS.filter((t) => rank >= (RANK[t.min] ?? 99));
  const [tab, setTab] = useState<Tab>(allowed[0]?.id ?? "overview");
  const activeTab = allowed.some((t) => t.id === tab) ? tab : (allowed[0]?.id ?? "overview");

  // Sign-out must work for both credential types: the staff account cookie and
  // a Supabase staff session.
  const handleLogout = useCallback(async () => {
    try {
      await fetch("/kore/admin/logout", { method: "POST" });
    } catch {
      // ignore — the redirect below still happens
    }
    window.location.replace("/kore");
  }, []);

  if (showLogin) {
    return (
      <div className="min-h-screen bg-black px-5 py-16">
        <div className="mx-auto max-w-md">
          <AdminLoginForm />
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-black text-kore-text">
      <header className="border-b border-white/10 px-5 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">
              ZeroKore <span className="text-kore-accent">control</span>
            </h1>
            <p className="text-xs text-kore-muted">
              Signed in as{" "}
              <span className="font-mono text-kore-accent">
                {adminUsername ?? effectiveRole}
              </span>{" "}
              · <span className="text-kore-faint">{effectiveRole}</span>
              {isOwner ? " · full authority" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs text-kore-muted transition hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-3 w-3" aria-hidden />
              Sign out
            </button>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-kore-muted">
              unlisted · do not share
            </span>
          </div>
        </div>
      </header>

      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5 py-3">
        {allowed.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm transition",
              activeTab === id
                ? "bg-kore-accent font-medium text-black"
                : "text-kore-muted hover:bg-white/5 hover:text-white"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      <main className="mx-auto max-w-6xl px-5 pb-16">
        {activeTab === "overview" && <AdminOverview />}
        {activeTab === "users" && <AdminUsers isOwner={isOwner} selfRole={effectiveRole} />}
        {activeTab === "security" && <AdminSecurity />}
        {activeTab === "feedback" && <AdminFeedback />}
        {activeTab === "announcements" && <AdminAnnouncements />}
        {activeTab === "control" && <AdminControl isOwner={isOwner} />}
        {activeTab === "staff" && <AdminStaff />}
      </main>
    </div>
  );
}
