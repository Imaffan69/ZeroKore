"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Square, Plus, Code2, Search, MessagesSquare, ChevronDown, Zap, AtSign, Sparkles } from "lucide-react";
import type { AgentMode } from "@/types";
import { cn } from "@/lib/utils";

interface ToolBarProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  onNew: () => void;
  loading: boolean;
  /** e.g. "12 credits left · resets 00:00 UTC" — null hides the meter. */
  creditLine: string | null;
  limitReached: boolean;
  mode: AgentMode;
  onModeChange: (m: AgentMode) => void;
  /** Currently selected model preference ("auto" or a provider id). */
  model: string;
  /** Available models with server-side key status. */
  models: { id: string; label: string; configured: boolean }[];
  onModelChange: (m: string) => void;
  /** Project files for @-mention autocomplete; null disables mentions. */
  filesForMention: { path: string }[] | null;
  /** Known skill names for /-autocomplete; null disables skills. */
  skillsForSlash: { name: string; description: string }[] | null;
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
  creditLine,
  limitReached,
  mode,
  onModeChange,
  model,
  models,
  onModelChange,
  filesForMention,
  skillsForSlash,
}: ToolBarProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [popup, setPopup] = useState<{ kind: "@" | "/"; query: string; index: number } | null>(null);

  const mentionMatches = useMemo(() => {
    if (!popup || popup.kind !== "@" || !filesForMention) return [];
    const q = popup.query.toLowerCase();
    return filesForMention
      .filter((f) => f.path.toLowerCase().includes(q))
      .slice(0, 7);
  }, [popup, filesForMention]);

  const skillMatches = useMemo(() => {
    if (!popup || popup.kind !== "/" || !skillsForSlash) return [];
    const q = popup.query.toLowerCase();
    return skillsForSlash
      .filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
      .slice(0, 7);
  }, [popup, skillsForSlash]);

  const popupCount = popup?.kind === "@" ? mentionMatches.length : skillMatches.length;

  useEffect(() => {
    setPopup(null);
  }, [loading]);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (popup && popupCount > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setPopup((p) =>
        p
          ? {
              ...p,
              index:
                e.key === "ArrowDown"
                  ? (p.index + 1) % popupCount
                  : (p.index - 1 + popupCount) % popupCount,
            }
          : p
      );
      return;
    }
    if (popup && popupCount > 0 && (e.key === "Tab" || e.key === "Enter")) {
      const pick =
        popup.kind === "@" ? mentionMatches[popup.index] : skillMatches[popup.index];
      if (pick && e.key === "Tab") {
        e.preventDefault();
        applyPick(pick);
        return;
      }
      // Enter still sends unless the popup was just opened via @// — keep Enter
      // as send for speed, Tab/↑↓ for picking. Esc dismisses.
    }
    if (e.key === "Escape" && popup) {
      e.preventDefault();
      setPopup(null);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !popup) {
      e.preventDefault();
      if (!loading && value.trim()) onSend();
    }
  }

  function applyPick(pick: { path: string } | { name: string }) {
    if (!popup || !taRef.current) return;
    const el = taRef.current;
    const caret = el.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const token = popup.kind === "@" ? (pick as { path: string }).path : (pick as { name: string }).name;
    const triggerAt = before.lastIndexOf(popup.kind);
    const next =
      before.slice(0, triggerAt + 1) + token + " " + after;
    onChange(next);
    setPopup(null);
    requestAnimationFrame(() => {
      el.focus();
      const pos = triggerAt + 1 + token.length + 1;
      el.setSelectionRange(pos, pos);
    });
  }

  function handleChange(next: string, caret: number | null) {
    onChange(next);
    autoGrow();
    if (caret === null) {
      setPopup(null);
      return;
    }
    const before = next.slice(0, caret);
    const at = before.lastIndexOf("@");
    const slash = before.lastIndexOf("/");
    // line-start slash only (a real /skill command), @ anywhere but not in email
    const atQuery = at >= 0 ? before.slice(at + 1) : null;
    const atOk =
      at >= 0 &&
      filesForMention &&
      (at === 0 || /[\s(,]/.test(before[at - 1] ?? "")) &&
      atQuery !== null &&
      !/[\s]/.test(atQuery) &&
      atQuery.length <= 80;
    const slashOk =
      slash === 0 && skillsForSlash && /^\/[a-z0-9-]*$/i.test(before);
    if (atOk && (!slashOk || at > slash)) {
      setPopup({ kind: "@", query: atQuery!, index: 0 });
    } else if (slashOk) {
      setPopup({ kind: "/", query: before.slice(1), index: 0 });
    } else {
      setPopup(null);
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
          {creditLine ?? "Out of credits for today."} Resets at midnight UTC —
          your conversation and typed input are preserved.
        </motion.p>
      )}
      <div className="mb-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Agent mode">
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

        {/* Model selector — lives in the chat like Freebuff/v0 */}
        <div className="relative ml-auto" role="group" aria-label="Model selection">
          <label htmlFor="kore-model" className="sr-only">
            Model
          </label>
          <Zap
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-kore-muted"
            aria-hidden
          />
          <ChevronDown
            className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-kore-muted"
            aria-hidden
          />
          <select
            id="kore-model"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="appearance-none rounded-md border border-kore-border bg-kore-bg/80 py-1.5 pl-7 pr-7 font-mono text-xs text-kore-text transition hover:border-white/25 focus:border-white/50"
          >
            <option value="auto">Auto</option>
            {models.map((m) => (
              <option key={m.id} value={m.id} disabled={!m.configured}>
                {m.label}
                {!m.configured ? " (no key)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="relative flex items-end gap-2">
        <AnimatePresence>
          {popup && popupCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.14 }}
              role="listbox"
              aria-label={popup.kind === "@" ? "Matching files" : "Matching skills"}
              className="glass glass-sheen absolute bottom-full left-0 z-30 mb-2 max-h-56 w-full overflow-y-auto rounded-xl p-1.5"
            >
              {popup.kind === "@"
                ? mentionMatches.map((f, i) => (
                    <button
                      key={f.path}
                      type="button"
                      role="option"
                      aria-selected={i === popup.index}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setPopup({ ...popup, index: i });
                        applyPick(f);
                      }}
                      onMouseEnter={() => setPopup({ ...popup, index: i })}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-mono text-xs",
                        i === popup.index ? "bg-white/10 text-white" : "text-kore-muted"
                      )}
                    >
                      <AtSign className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{f.path}</span>
                    </button>
                  ))
                : skillMatches.map((s, i) => (
                    <button
                      key={s.name}
                      type="button"
                      role="option"
                      aria-selected={i === popup.index}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setPopup({ ...popup, index: i });
                        applyPick(s);
                      }}
                      onMouseEnter={() => setPopup({ ...popup, index: i })}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left",
                        i === popup.index ? "bg-white/10" : ""
                      )}
                    >
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-kore-accent" aria-hidden />
                      <span>
                        <span className="block font-mono text-xs text-white">/{s.name}</span>
                        <span className="mt-0.5 line-clamp-1 block text-[11px] text-kore-muted">
                          {s.description}
                        </span>
                      </span>
                    </button>
                  ))}
              <p className="px-3 py-1.5 font-mono text-[10px] text-kore-faint">
                Tab to insert · ↑↓ to move · Esc to dismiss · Enter sends
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        <label htmlFor="kore-input" className="sr-only">
          Task input
        </label>
        <textarea
          id="kore-input"
          ref={taRef}
          rows={1}
          value={value}
          onChange={(e) => {
            handleChange(e.target.value, e.target.selectionStart);
          }}
          onKeyDown={handleKey}
          onBlur={() => setPopup(null)}
          disabled={loading}
          placeholder={
            loading ? "Agent is working…" : "Describe your task… @file for context, /skill for playbooks"
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
            className="glass-interactive flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-kore-accent px-4 text-sm font-semibold text-black shadow-glow transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-40"
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
