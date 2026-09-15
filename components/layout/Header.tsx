"use client";

import { Menu, Circle } from "lucide-react";
import type { AgentMode } from "@/types";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenu: () => void;
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

export default function Header({ onMenu, title, mode, status, provider }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-kore-border bg-kore-panel/95 px-3 py-2.5 backdrop-blur sm:px-4">
      <button
        onClick={onMenu}
        className="rounded-md p-2 text-kore-muted transition hover:bg-kore-bg hover:text-white lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold text-white sm:text-base" title={title}>
          {title}
        </h1>
        <p className="hidden truncate font-mono text-xs text-kore-muted sm:block">
          {MODE_LABEL[mode]} · {provider}
        </p>
      </div>

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
                : "text-kore-accent"
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