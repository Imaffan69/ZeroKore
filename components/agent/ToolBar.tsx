"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import { Send, Square, Plus, Code2, Search, MessagesSquare } from "lucide-react";
import type { AgentMode } from "@/types";
import { cn } from "@/lib/utils";

interface ToolBarProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  onNew: () => void;
  loading: boolean;
  limitReached: boolean;
  mode: AgentMode;
  onModeChange: (m: AgentMode) => void;
}

const MODES: { id: AgentMode; label: string; icon: typeof Code2 }[] = [
  { id: "coding", label: "Coding", icon: Code2 },
  { id: "research", label: "Research", icon: Search },
  { id: "general", label: "General", icon: MessagesSquare },
];

export default function ToolBar({
  value,
  onChange,
  onSend,
  onStop,
  onNew,
  loading,
  limitReached,
  mode,
  onModeChange,
}: ToolBarProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && value.trim()) onSend();
    }
  }

  function autoGrow() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  return (
    <div className="glass-bar px-3 py-3 sm:px-4">
      {limitReached && (
        <motion.p
          role="alert"
          className="mb-2 rounded-md border border-kore-warn/40 bg-kore-warn/10 px-3 py-2 text-xs text-amber-200"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          Daily AI request limit reached (15/15). Resets tomorrow — your
          conversation and typed input are preserved.
        </motion.p>
      )}
      <div className="mb-2 flex items-center gap-1.5" role="group" aria-label="Agent mode">
        {MODES.map((m) => (
          <motion.button
            key={m.id}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onModeChange(m.id)}
            aria-pressed={mode === m.id}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-xs transition",
              mode === m.id
                ? "border-kore-accent/60 bg-kore-accent/10 text-kore-accent"
                : "border-kore-border text-kore-muted hover:border-kore-accent/30 hover:text-white"
            )}
          >
            <m.icon className="h-3.5 w-3.5" aria-hidden />
            {m.label}
          </motion.button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <label htmlFor="kore-input" className="sr-only">
          Task input
        </label>
        <textarea
          id="kore-input"
          ref={taRef}
          rows={1}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            autoGrow();
          }}
          onKeyDown={handleKey}
          disabled={loading}
          placeholder={
            loading ? "Agent is working…" : "Describe your task… (Enter to send, Shift+Enter for newline)"
          }
          className="glass-subtle max-h-40 min-h-[44px] flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm text-kore-text placeholder:text-kore-muted/60 focus:border-kore-accent disabled:opacity-60"
        />
        {loading ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onStop}
            className="glass-interactive flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-kore-danger/50 bg-kore-danger/10 px-4 text-sm font-semibold text-red-300 transition hover:bg-kore-danger/20"
            aria-label="Stop generation"
          >
            <Square className="h-4 w-4 fill-current" aria-hidden />
            <span className="hidden sm:inline">Stop</span>
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onSend}
            disabled={!value.trim() || limitReached}
            className="glass-interactive flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-kore-accent px-4 text-sm font-semibold text-black shadow-glow transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Send</span>
          </motion.button>
        )}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onNew}
          className="glass glass-interactive flex h-11 shrink-0 items-center rounded-full px-3 text-kore-muted hover:text-white"
          aria-label="New task"
          title="New task"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </motion.button>
      </div>
    </div>
  );
}
