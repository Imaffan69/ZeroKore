"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { TerminalSquare, FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";

interface CanvasProps {
  execution: React.ReactNode;
  artifact: React.ReactNode;
  hasArtifact: boolean;
}

type MobileTab = "execution" | "artifact";

const TABS: { id: MobileTab; label: string; icon: typeof TerminalSquare }[] = [
  { id: "execution", label: "Execution", icon: TerminalSquare },
  { id: "artifact", label: "Artifact", icon: FileCode2 },
];

function PanelLabel({
  children,
  meta,
}: {
  children: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-3.5 flex items-center gap-2">
      <p className="font-mono text-[10px] tracking-[0.2em] text-kore-muted">
        {children}
      </p>
      {meta ? <div className="ml-auto">{meta}</div> : null}
    </div>
  );
}

export default function DualPanelCanvas({
  execution,
  artifact,
  hasArtifact,
}: CanvasProps) {
  const [mobileTab, setMobileTab] = useState<MobileTab>("execution");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Mobile / tablet panel switcher */}
      <div
        className="glass-bar grid shrink-0 grid-cols-2 gap-1 p-1.5 lg:hidden"
        role="tablist"
        aria-label="Workspace panels"
      >
        {TABS.map((t) => {
          const active = mobileTab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setMobileTab(t.id)}
              className={cn(
                "relative flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors duration-150",
                active ? "text-white" : "text-kore-muted hover:text-kore-text"
              )}
            >
              {active ? (
                <motion.span
                  layoutId="panel-tab"
                  className="absolute inset-0 rounded-md bg-white/[0.07]"
                  transition={{ duration: 0.2, ease: EASE }}
                  aria-hidden
                />
              ) : null}
              <span className="relative flex items-center gap-2">
                <t.icon className="h-3.5 w-3.5" aria-hidden />
                {t.label}
                {t.id === "artifact" && hasArtifact ? (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-kore-accent"
                    aria-label="Artifact available"
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      {/* Panels */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-2 lg:gap-3 lg:p-3">
        <section
          aria-label="Execution terminal"
          className={cn(
            "min-h-0 overflow-y-auto px-3 py-4 sm:px-4 lg:glass lg:glass-sheen lg:rounded-2xl lg:px-4",
            mobileTab === "execution" ? "block" : "hidden lg:block"
          )}
        >
          <PanelLabel
            meta={
              <span className="font-mono text-[10px] text-kore-muted/70">
                agent event stream
              </span>
            }
          >
            EXECUTION
          </PanelLabel>
          {execution}
        </section>

        <section
          aria-label="Artifact viewer"
          className={cn(
            "min-h-0 overflow-y-auto px-3 py-4 sm:px-4 lg:px-0 lg:py-0",
            mobileTab === "artifact" ? "block" : "hidden lg:block"
          )}
        >
          <div className="mb-3.5 hidden lg:block lg:px-1">
            <PanelLabel
              meta={
                <span
                  className={cn(
                    "font-mono text-[10px]",
                    hasArtifact ? "text-kore-accent" : "text-kore-muted/70"
                  )}
                >
                  {hasArtifact ? "ready" : "empty"}
                </span>
              }
            >
              ARTIFACT
            </PanelLabel>
          </div>
          {artifact}
        </section>
      </div>
    </div>
  );
}
