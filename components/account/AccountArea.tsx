"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3, ShieldCheck, Plug, Loader2, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import UsageView from "@/components/account/UsageView";
import SecurityView from "@/components/account/SecurityView";
import IntegrationsView from "@/components/account/IntegrationsView";

type Tab = "usage" | "security" | "integrations";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "usage", label: "Usage & credits", icon: BarChart3 },
  { id: "security", label: "Sign-in & security", icon: ShieldCheck },
  { id: "integrations", label: "Integrations", icon: Plug },
];

export default function AccountArea({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>("usage");
  const [signingOut, setSigningOut] = useState(false);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
      <Link
        href="/dashboard"
        className="text-xs text-kore-muted transition hover:text-white"
      >
        ← Back
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-white">
        Account
      </h1>
      <p className="mt-1 text-xs text-kore-muted">{email}</p>

      <div className="mt-8 grid gap-6 md:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm transition",
                tab === id
                  ? "glass-subtle text-white"
                  : "text-kore-muted hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
          <button
            onClick={async () => {
              setSigningOut(true);
              const { createClient } = await import("@/lib/supabase/client");
              const supabase = createClient();
              await supabase.auth.signOut({ scope: "global" });
              window.location.href = "/login";
            }}
            className="flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-left text-sm text-kore-muted transition hover:text-red-300"
          >
            {signingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <LogOut className="h-4 w-4" aria-hidden />
            )}
            Sign out everywhere
          </button>
        </nav>

        {/* Content */}
        <section aria-label={tab}>
          {tab === "usage" && <UsageView />}
          {tab === "security" && <SecurityView />}
          {tab === "integrations" && <IntegrationsView />}
        </section>
      </div>
    </main>
  );
}
