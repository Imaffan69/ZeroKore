"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Terminal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { press } from "@/lib/motion";

/**
 * The project terminal.
 *
 * A real shell over the project's real files, driven by
 * `POST /api/projects/[slug]/shell`. The client keeps session history, arrow
 * recall and `clear`; the server owns every actual effect. Output renders as
 * it arrives — line for line, in order, exactly as the command produced it.
 */

interface Line {
  id: number;
  kind: "in" | "out" | "err" | "dim";
  text: string;
}

interface Props {
  slug: string;
  onFilesChanged?: () => void;
  className?: string;
}

const PROMPT = "❯";

export default function ProjectShell({ slug, onFilesChanged, className }: Props) {
  const [lines, setLines] = useState<Line[]>([
    { id: 0, kind: "dim", text: "ZeroKore project shell — type `help` for commands." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const push = useCallback((kind: Line["kind"], text: string) => {
    setLines((prev) => [...prev, { id: nextId.current++, kind, text }]);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, busy]);

  const run = useCallback(async () => {
    const command = input.trim();
    if (!command || busy) return;
    push("in", `${PROMPT} ${command}`);
    setInput("");
    setHistory((h) => [command, ...h.filter((c) => c !== command)].slice(0, 100));
    setHistoryIndex(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/shell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const data = (await res.json()) as {
        lines?: { text: string; tone?: "out" | "err" | "dim" }[];
        filesChanged?: boolean;
        error?: string;
      };
      if (!res.ok) {
        push("err", data?.error ?? `Request failed (${res.status}).`);
      } else {
        for (const l of data.lines ?? []) push(l.tone ?? "out", l.text);
        if (data.filesChanged) onFilesChanged?.();
      }
    } catch {
      push("err", "Connection failed. Try again.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }, [input, busy, slug, push, onFilesChanged]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void run();
      return;
    }
    if (e.key === "ArrowUp" && history.length > 0) {
      e.preventDefault();
      const next = historyIndex === null ? 0 : Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(next);
      setInput(history[next]);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === null) return;
      const next = historyIndex - 1;
      if (next < 0) {
        setHistoryIndex(null);
        setInput("");
      } else {
        setHistoryIndex(next);
        setInput(history[next]);
      }
      return;
    }
    if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setLines([]);
    }
  }

  const toneClass: Record<Line["kind"], string> = {
    in: "text-white font-semibold",
    out: "text-kore-body",
    err: "text-red-400",
    dim: "text-kore-faint",
  };

  return (
    <div
      className={cn(
        "glass glass-sheen flex h-full flex-col overflow-hidden rounded-2xl",
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-kore-muted" aria-hidden />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-kore-muted">
            Terminal
          </span>
          <span className="ml-1 flex items-center gap-1.5">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                busy ? "animate-pulse bg-amber-400" : "bg-emerald-400"
              )}
              aria-hidden
            />
            <span className="font-mono text-[10px] text-kore-faint">
              {busy ? "running" : "ready"}
            </span>
          </span>
        </div>
        <motion.button
          whileTap={press}
          onClick={(e) => {
            e.stopPropagation();
            setLines([]);
          }}
          className="rounded-lg p-1.5 text-kore-muted transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Clear terminal"
          title="Clear (Ctrl+L)"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </motion.button>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-[12.5px] leading-[1.65]"
        role="log"
        aria-live="polite"
      >
        {lines.map((l) => (
          <div key={l.id} className={cn("whitespace-pre-wrap break-words", toneClass[l.kind])}>
            {l.text}
          </div>
        ))}
        {busy && (
          <div className="text-kore-faint" aria-hidden>
            ▌
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2.5">
        <span className="font-mono text-sm font-bold text-emerald-400" aria-hidden>
          {PROMPT}
        </span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent font-mono text-[12.5px] text-white outline-none placeholder:text-kore-faint"
          placeholder={busy ? "running…" : "ls · cat · mkdir · echo · grep · tree"}
          aria-label="Terminal command input"
        />
      </div>
    </div>
  );
}
