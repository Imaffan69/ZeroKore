"use client";

import { motion } from "framer-motion";
import { Menu, Circle, Cpu } from "lucide-react";
import type { AgentMode } from "@/types";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";

interface HeaderProps {
  onMenu: () => void;
  title: string;
  mode: AgentMode;
  status: "idle" | "loading" | "error";
  provider: string;
}

const MODE_LABEL: Record<AgentMode, string> = {
  coding: "Coding agent",
  research: "Research agent",
  general: "General assistant",
};

const STATUS_LABEL: Record<HeaderProps["status"], string> = {
  idle: "Idle",
  loading: "Working",
  error: "Error",
};

export default function Header({
  onMenu,
  title,
  mode,
  status,
  provider,
}: HeaderProps) {
  return (
    <header className="glass-bar glass-sheen sticky top-0 z-20 flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
      <motion.button
        whileTap={{ scale: 0.94 }}
        transition={{ duration: 0.12, ease: EASE }}
        onClick={onMenu}
        className="rounded-md p-2 text-kore-muted transition-colors duration-150 hover:bg-white/[0.04] hover:text-white lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </motion.button>

      <div className="min-w-0 flex-1">
        <h1
          className="truncate text-sm font-semibold tracking-tight text-white"
          title={title}
        >
          {title}
        </h1>
        <p className="mt-0.5 hidden items-center gap-1.5 truncate text-xs text-kore-muted sm:flex">
          <span className="truncate">{MODE_LABEL[mode]}</span>
          <span aria-hidden className="text-kore-border">
            ·
          </span>
          <Cpu className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{provider}</span>
        </p>
      </div>

      <div
        className="glass-subtle flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1"
        role="status"
        aria-live="polite"
        aria-label={`Agent status: ${STATUS_LABEL[status]}`}
      >
        <Circle
          className={cn(
            "h-1.5 w-1.5 fill-current",
            status === "loading"
              ? "animate-pulse text-kore-warn"
              : status === "error"
                ? "text-kore-danger"
                : "text-kore-accent"
          )}
          aria-hidden
        />
        <span className="font-mono text-[10px] uppercase tracking-wider text-kore-muted">
          {STATUS_LABEL[status]}
        </span>
      </div>
    </header>
  );
}
