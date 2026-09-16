"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  BrainCircuit,
  Settings,
  LayoutGrid,
  Code2,
  Search,
  MessagesSquare,
  Sun,
  Moon,
  Monitor,
  LogOut,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

export interface CommandAction {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Plus;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNewTask: () => void;
  onGoWorkspace: () => void;
  onGoMemory: () => void;
  onGoSettings: () => void;
  onMode: (m: "coding" | "research" | "general") => void;
  onLogout: () => void;
}

export default function CommandPalette({
  open,
  onClose,
  onNewTask,
  onGoWorkspace,
  onGoMemory,
  onGoSettings,
  onMode,
  onLogout,
}: CommandPaletteProps) {
  const { setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions: CommandAction[] = useMemo(
    () => [
      { id: "new", label: "New task", hint: "workspace", icon: Plus, run: onNewTask },
      { id: "workspace", label: "Go to Workspace", icon: LayoutGrid, run: onGoWorkspace },
      { id: "memory", label: "Go to Memory", icon: BrainCircuit, run: onGoMemory },
      { id: "settings", label: "Go to Settings", icon: Settings, run: onGoSettings },
      { id: "mode-coding", label: "Switch to Coding mode", icon: Code2, run: () => onMode("coding") },
      { id: "mode-research", label: "Switch to Research mode", icon: Search, run: () => onMode("research") },
      { id: "mode-general", label: "Switch to General mode", icon: MessagesSquare, run: () => onMode("general") },
      { id: "theme-light", label: "Theme: Light", icon: Sun, run: () => setTheme("light") },
      { id: "theme-dark", label: "Theme: Dark", icon: Moon, run: () => setTheme("dark") },
      { id: "theme-system", label: "Theme: System", icon: Monitor, run: () => setTheme("system") },
      { id: "logout", label: "Log out", icon: LogOut, run: onLogout },
    ],
    [onNewTask, onGoWorkspace, onGoMemory, onGoSettings, onMode, onLogout, setTheme]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [actions, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  function runAt(index: number) {
    const action = filtered[index];
    if (!action) return;
    action.run();
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="kore-glass w-full max-w-lg overflow-hidden rounded-2xl shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-kore-border px-4">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a command…"
            className="w-full bg-transparent py-3.5 text-sm text-kore-strong placeholder:text-kore-muted focus:outline-none"
            aria-label="Command search"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-2" role="listbox">
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-kore-muted">
              No matching commands.
            </li>
          )}
          {filtered.map((a, i) => (
            <li key={a.id} role="option" aria-selected={i === active}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => runAt(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition",
                  i === active
                    ? "bg-kore-accent/15 text-kore-strong"
                    : "text-kore-text hover:bg-kore-bg"
                )}
              >
                <a.icon
                  className={cn("h-4 w-4 shrink-0", i === active ? "text-kore-accent" : "text-kore-muted")}
                  aria-hidden
                />
                <span className="flex-1">{a.label}</span>
                {i === active && (
                  <CornerDownLeft className="h-3.5 w-3.5 text-kore-muted" aria-hidden />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
