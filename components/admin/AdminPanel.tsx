"use client";

import { useState } from "react";
import { BarChart3, Users, MessageSquare, Megaphone, ShieldAlert, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminFeedback from "@/components/admin/AdminFeedback";
import AdminAnnouncements from "@/components/admin/AdminAnnouncements";
import AdminControl from "@/components/admin/AdminControl";
import AdminSecurity from "@/components/admin/AdminSecurity";

type Tab = "overview" | "users" | "security" | "feedback" | "announcements" | "control";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "security", label: "Security & IPs", icon: Globe },
  { id: "feedback", label: "Feedback", icon: MessageSquare },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "control", label: "Site control", icon: ShieldAlert },
];

export default function AdminPanel({ role, isOwner }: { role: string; isOwner: boolean }) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-kore-text">
      <header className="border-b border-white/10 px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">
              ZeroKore <span className="text-kore-accent">control</span>
            </h1>
            <p className="text-xs text-kore-muted">
              Signed in as <span className="text-kore-accent">{role}</span>
              {isOwner ? " · full authority" : ""}
            </p>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-kore-muted">
            unlisted · do not share
          </span>
        </div>
      </header>

      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5 py-3">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm transition",
              tab === id
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
        {tab === "overview" && <AdminOverview />}
        {tab === "users" && <AdminUsers isOwner={isOwner} selfRole={role} />}
        {tab === "security" && <AdminSecurity />}
        {tab === "feedback" && <AdminFeedback />}
        {tab === "announcements" && <AdminAnnouncements />}
        {tab === "control" && <AdminControl isOwner={isOwner} />}
      </main>
    </div>
  );
}
