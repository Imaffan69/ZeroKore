"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  Briefcase,
  GitBranch,
  Settings,
  FolderPlus,
  Github,
  FolderOpen,
  Cpu,
  type LucideIcon,
} from "lucide-react";
import { fadeUp } from "@/lib/motion";

/**
 * Icon keys, not components.
 *
 * This card is a Client Component rendered from a Server Component, and a
 * component reference is not serialisable: passing `icon={Sparkles}` across the
 * RSC boundary throws "Functions cannot be passed directly to Client Components"
 * (lucide icons are forwardRef objects, hence `$$typeof`/`render`/`displayName`).
 * The caller sends a plain string and the icon is resolved here, on the client.
 */
const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  briefcase: Briefcase,
  git: GitBranch,
  settings: Settings,
  folderPlus: FolderPlus,
  github: Github,
  folder: FolderOpen,
  cpu: Cpu,
};

export type QuickActionIcon = keyof typeof ICONS;

interface QuickActionCardProps {
  icon: QuickActionIcon;
  title: string;
  description: string;
  href: string;
}

export default function QuickActionCard({
  icon,
  title,
  description,
  href,
}: QuickActionCardProps) {
  const Icon = ICONS[icon] ?? Sparkles;
  return (
    <motion.div
      variants={fadeUp}
      className="group block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-kore-accent/40 hover:bg-white/[0.05]"
    >
      <Link
        href={href}
        className="flex items-start gap-3 text-left transition hover:opacity-90"
      >
        <div className="shrink-0 rounded-xl bg-kore-accent/10 p-2.5">
          <Icon className="h-4 w-4 text-kore-accent" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-white">{title}</p>
          <p className="mt-0.5 text-xs text-kore-muted">{description}</p>
        </div>
      </Link>
    </motion.div>
  );
}