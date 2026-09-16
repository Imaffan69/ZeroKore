"use client";

import { Menu, Circle, Command } from "lucide-react";
import type { AgentMode } from "@/types";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenu: () => void;
  onCommand: () => void;
  title: string;
  mode: AgentMode;
  status: "idle" | "loading" | "error";
  provider: string;
}

const MODE_LABEL: Record<AgentMode, string> = {
  coding: "Coding Agent",
  research: "Research Agent",
  general: "General Assistant",
};

export default function Header({
  onMenu,
  onCommand,
  title,
  mode,
  status,
  provider,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-kore-border kore-glass px-3 py-2.5 sm:px-4">
      <button
        onClick={onMenu}
        className="rounded-md p-2 text-kore-muted transition hover:bg-kore-bg hover:text-kore-strong lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold text-kore-strong sm:text-base" title={title}>
          {title}
        </h1>
        <p className="hidden truncate font-mono text-xs text-kore-muted sm:block">
          {MODE_LABEL[mode]} · {provider}
        </p>
      </div>

      <button
        onClick={onCommand}
        className="hidden items-center gap-2 rounded-lg border border-kore-border bg-kore-bg px-2.5 py-1.5 text-xs text-kore-muted transition hover:border-kore-accent/50 hover:text-kore-strong sm:flex"
        aria-label="Open command palette"
      >
        <Command className="h-3.5 w-3.5" aria-hidden />
        <span className="font-mono">⌘K</span>
      </button>

      <div
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-kore-border bg-kore-bg px-2.5 py-1 font-mono text-xs"
        role="status"
        aria-label={status === "loading" ? "Agent working" : status === "error" ? "Error" : "Idle"}
      >
        <Circle
          className={cn(
            "h-2 w-2 fill-current",
            status === "loading"
              ? "animate-pulse text-kore-warn"
              : status === "error"
                ? "text-kore-danger"
                : "text-kore-success"
          )}
          aria-hidden
        />
        <span className="hidden text-kore-muted sm:inline">
          {status === "loading" ? "WORKING" : status === "error" ? "ERROR" : "IDLE"}
        </span>
      </div>
    </header>
  );
}
