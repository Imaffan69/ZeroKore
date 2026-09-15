"use client";

import { useState } from "react";
import { TerminalSquare, FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CanvasProps {
  execution: React.ReactNode;
  artifact: React.ReactNode;
  hasArtifact: boolean;
}

type MobileTab = "execution" | "artifact";

export default function DualPanelCanvas({
  execution,
  artifact,
  hasArtifact,
}: CanvasProps) {
  const [mobileTab, setMobileTab] = useState<MobileTab>("execution");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Mobile panel switcher */}
      <div
        className="grid shrink-0 grid-cols-2 gap-1 border-b border-kore-border bg-kore-panel p-1.5 lg:hidden"
        role="tablist"
        aria-label="Workspace panels"
      >
        <button
          role="tab"
          aria-selected={mobileTab === "execution"}
          onClick={() => setMobileTab("execution")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md px-3 py-2 font-mono text-xs transition",
            mobileTab === "execution"
              ? "bg-kore-accent/15 text-kore-accent"
              : "text-kore-muted hover:text-white"
          )}
        >
          <TerminalSquare className="h-4 w-4" aria-hidden />
          [Execution]
        </button>
        <button
          role="tab"
          aria-selected={mobileTab === "artifact"}
          onClick={() => setMobileTab("artifact")}
          className={cn(
            "relative flex items-center justify-center gap-1.5 rounded-md px-3 py-2 font-mono text-xs transition",
            mobileTab === "artifact"
              ? "bg-kore-accent/15 text-kore-accent"
              : "text-kore-muted hover:text-white"
          )}
        >
          <FileCode2 className="h-4 w-4" aria-hidden />
          [Artifact]
          {hasArtifact && (
            <span
              className="absolute right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-kore-accent"
              aria-label="Artifact available"
            />
          )}
        </button>
      </div>

      {/* Panels */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-2 lg:gap-3 lg:p-3">
        <section
          aria-label="Execution terminal"
          className={cn(
            "min-h-0 overflow-y-auto px-3 py-4 sm:px-4 lg:rounded-xl lg:border lg:border-kore-border lg:bg-kore-panel",
            mobileTab === "execution" ? "block" : "hidden lg:block"
          )}
        >
          {execution}
        </section>
        <section
          aria-label="Artifact viewer"
          className={cn(
            "min-h-0 overflow-y-auto px-3 py-4 sm:px-4 lg:p-0",
            mobileTab === "artifact" ? "block" : "hidden lg:block"
          )}
        >
          {artifact}
        </section>
      </div>
    </div>
  );
}