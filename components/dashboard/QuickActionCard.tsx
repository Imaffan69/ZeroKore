"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { EASE, staggerGroup, fadeUp } from "@/lib/motion";

interface QuickActionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
}

export default function QuickActionCard({
  icon: Icon,
  title,
  description,
  href,
}: QuickActionCardProps) {
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