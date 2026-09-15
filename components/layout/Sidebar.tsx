"use client";

import {
  Terminal,
  Plus,
  MessageSquare,
  BrainCircuit,
  Settings,
  LogOut,
  Code2,
  Search,
  MessagesSquare,
  Trash2,
  X,
} from "lucide-react";
import type { AgentMode, Conversation, UsageState } from "@/types";
import { cn } from "@/lib/utils";

export type SidebarView = "workspace" | "memory" | "settings";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  mode: AgentMode;
  onModeChange: (m: AgentMode) => void;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  usage: UsageState | null;
  provider: string;
  providerFallback?: string;
  dbOk: boolean;
  email: string;
  view: SidebarView;
  onViewChange: (v: SidebarView) => void;
  onLogout: () => void;
}

const MODES: { id: AgentMode; label: string; icon: typeof Code2 }[] = [
  { id: "coding", label: "Coding", icon: Code2 },
  { id: "research", label: "Research", icon: Search },
  { id: "general", label: "General", icon: MessagesSquare },
];

const PROVIDERS = ["Groq", "DeepSeek", "SambaNova", "Gemini"];

export default function Sidebar(props: SidebarProps) {
  const {
    open,
    onClose,
    mode,
    onModeChange,
    conversations,
    activeId,
    onSelect,
    onDelete,
    onNew,
    usage,
    provider,
    providerFallback,
    dbOk,
    email,
    view,
    onViewChange,
    onLogout,
  } = props;

  const usagePct = usage
    ? usage.unlimited
      ? 0
      : Math.min(100, Math.round((usage.used / usage.limit) * 100))
    : 0;

  return (
    <>
      {/* Mobile scrim */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/60 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-kore-border bg-kore-panel transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="ZeroKore sidebar"
      >
        {/* Brand */}
        <div className="flex items-center justify-between border-b border-kore-border px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-kore-accent/40 bg-kore-bg">
              <Terminal className="h-4 w-4 text-kore-accent" aria-hidden />
            </span>
            <span className="font-mono text-sm font-bold tracking-widest">
              ZERO<span className="text-kore-accent">KORE</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-kore-muted hover:bg-kore-bg hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {/* Status */}
          <div className="mb-3 rounded-lg border border-kore-border bg-kore-bg p-3 font-mono text-xs">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-kore-muted">PROVIDER</span>
              <span className="text-kore-accent">
                ● {providerFallback ? `${providerFallback} → ` : ""}
                {provider}
              </span>
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Provider cascade">
              {PROVIDERS.map((p) => (
                <span
                  key={p}
                  className={cn(
                    "rounded border px-1.5 py-0.5",
                    p === provider
                      ? "border-kore-accent/60 text-kore-accent"
                      : "border-kore-border text-kore-muted"
                  )}
                >
                  ● {p.toUpperCase()}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-kore-muted">DATABASE</span>
              <span className={dbOk ? "text-kore-accent" : "text-kore-warn"}>
                {dbOk ? "● CONNECTED" : "● UNKNOWN"}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-kore-muted">AUTH</span>
              <span className="truncate text-kore-text" title={email}>
                ● {email || "—"}
              </span>
            </div>
          </div>

          {/* Usage */}
          <div className="mb-3 rounded-lg border border-kore-border bg-kore-bg p-3">
            <div className="mb-1.5 flex items-center justify-between font-mono text-xs">
              <span className="text-kore-muted">USAGE</span>
              <span className="text-kore-text">
                {usage
                  ? usage.unlimited
                    ? "Unlimited"
                    : `${usage.used} / ${usage.limit} today`
                  : "…"}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-kore-border"
              role="progressbar"
              aria-valuenow={usagePct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Daily AI usage"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  usagePct >= 100 ? "bg-kore-danger" : "bg-kore-accent"
                )}
                style={{ width: `${usage ? usagePct : 0}%` }}
              />
            </div>
          </div>

          {/* Modes */}
          <p className="mb-1.5 px-1 font-mono text-[11px] tracking-wider text-kore-muted">
            AGENT MODE
          </p>
          <div className="mb-3 grid grid-cols-3 gap-1.5" role="group" aria-label="Agent mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                aria-pressed={mode === m.id}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs transition",
                  mode === m.id
                    ? "border-kore-accent/60 bg-kore-accent/10 text-kore-accent"
                    : "border-kore-border bg-kore-bg text-kore-muted hover:border-kore-accent/30 hover:text-white"
                )}
              >
                <m.icon className="h-4 w-4" aria-hidden />
                {m.label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <button
            onClick={() => {
              onNew();
              onClose();
            }}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-kore-accent px-3 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New Task
          </button>

          {/* Conversations */}
          <p className="mb-1.5 px-1 font-mono text-[11px] tracking-wider text-kore-muted">
            CONVERSATIONS
          </p>
          <div className="mb-3 space-y-1">
            {conversations.length === 0 && (
              <p className="px-1 py-2 text-xs text-kore-muted">
                No conversations yet.
              </p>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-1 rounded-lg border transition",
                  activeId === c.id
                    ? "border-kore-accent/50 bg-kore-accent/10"
                    : "border-transparent hover:border-kore-border hover:bg-kore-bg"
                )}
              >
                <button
                  onClick={() => {
                    onSelect(c.id);
                    onClose();
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-sm"
                  title={c.title}
                >
                  <MessageSquare
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      activeId === c.id ? "text-kore-accent" : "text-kore-muted"
                    )}
                    aria-hidden
                  />
                  <span className="truncate text-kore-text">{c.title}</span>
                </button>
                <button
                  onClick={() => onDelete(c.id)}
                  className="mr-1 rounded p-1.5 text-kore-muted opacity-0 transition hover:bg-kore-danger/20 hover:text-red-300 focus:opacity-100 group-hover:opacity-100"
                  aria-label={`Delete conversation ${c.title}`}
                  title="Delete (asks for confirmation)"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </div>

          {/* Views */}
          <div className="space-y-1">
            <button
              onClick={() => {
                onViewChange("memory");
                onClose();
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                view === "memory"
                  ? "bg-kore-accent/10 text-kore-accent"
                  : "text-kore-muted hover:bg-kore-bg hover:text-white"
              )}
            >
              <BrainCircuit className="h-4 w-4" aria-hidden />
              Memory
            </button>
            <button
              onClick={() => {
                onViewChange("settings");
                onClose();
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                view === "settings"
                  ? "bg-kore-accent/10 text-kore-accent"
                  : "text-kore-muted hover:bg-kore-bg hover:text-white"
              )}
            >
              <Settings className="h-4 w-4" aria-hidden />
              Settings
            </button>
          </div>
        </div>

        {/* Logout */}
        <div className="border-t border-kore-border p-3">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-kore-muted transition hover:bg-kore-danger/10 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}