import type { Metadata } from "next";
import "./globals.css";
import FeedbackModal from "@/components/site/FeedbackModal";
import { createClient } from "@/lib/supabase/server";
import { getMaintenanceFlag } from "@/lib/flags";

export const metadata: Metadata = {
  title: {
    default: "ZeroKore — Autonomous Intelligence Workspace",
    template: "%s — ZeroKore",
  },
  description:
    "ZeroKore is a production-grade autonomous agentic AI platform: coding agent, research agent, tools, memory, and artifacts.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

async function maintenanceForViewer(): Promise<{ enabled: boolean; message: string } | null> {
  try {
    const supabase = await createClient();
    const flag = await getMaintenanceFlag(supabase);
    if (!flag.enabled) return null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const role = profile?.role ?? "user";
      if (["support", "moderator", "admin", "owner"].includes(role)) return null;
    }
    return flag;
  } catch {
    return null; // a DB failure never takes the site down
  }
}

function MaintenanceScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-kore-bg px-6 text-center">
      <p className="font-mono text-[11px] tracking-[0.3em] text-kore-accent">
        ZEROKORE
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
        Briefly down for maintenance
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-kore-muted">
        {message ||
          "We are making things better. ZeroKore will be back shortly — your projects and credits are untouched."}
      </p>
    </div>
  );
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const maintenance = await maintenanceForViewer();
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-kore-bg text-kore-text">
        {maintenance ? <MaintenanceScreen message={maintenance.message} /> : children}
        <FeedbackModal />
      </body>
    </html>
  );
}