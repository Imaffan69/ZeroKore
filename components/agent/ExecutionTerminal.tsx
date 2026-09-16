"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { User, Bot, AlertTriangle, Loader2 } from "lucide-react";
import type { AgentEvent, ChatMessage } from "@/types";
import { cn } from "@/lib/utils";

function escapeHtml(s: string): string {
  // Built via concatenation so no HTML entity sequence appears in source.
  const AMP = "&" + "amp;";
  const LT = "&" + "lt;";
  const GT = "&" + "gt;";
  const QUOT = "&" + "quot;";
  return s
    .replace(/&/g, AMP)
    .replace(/</g, LT)
    .replace(/>/g, GT)
    .replace(/"/g, QUOT);
}

/** Minimal safe renderer: code fences, inline code, bold, http(s) links. */
function renderSafe(text: string): string {
  const parts: string[] = [];
  const fence = /```(\w*)\n?([\s\S]*?)(?:```|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;

  const inline = (s: string): string => {
    let out = escapeHtml(s);
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    out = out.replace(/(^|\s)(https?:\/\/[^\s)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
    return out.replace(/\n/g, "<br/>");
  };

  while ((m = fence.exec(text)) !== null) {
    const before = text.slice(last, m.index);
    if (before) parts.push(`<p>${inline(before)}</p>`);
    const lang = escapeHtml(m[1] || "text");
    parts.push(
      `<pre data-lang="${lang}"><code>${escapeHtml(m[2])}</code></pre>`
    );
    last = m.index + m[0].length;
    idx++;
    if (idx > 20) break;
  }
  const rest = text.slice(last);
  if (rest) parts.push(`<p>${inline(rest)}</p>`);
  return parts.join("");
}

interface TerminalProps {
  messages: ChatMessage[];
  events: AgentEvent[];
  loading: boolean;
  error: string | null;
  emptyHint: React.ReactNode;
}

const EVENT_STYLE: Record<AgentEvent["kind"], string> = {
  agent_started: "text-kore-accent",
  memory_retrieved: "text-kore-accent",
  tool_call: "text-kore-warn",
  tool_completed: "text-kore-muted",
  provider_fallback: "text-kore-warn",
  generating_artifact: "text-kore-success",
  completed: "text-kore-success",
  error: "text-kore-danger",
};

export default function ExecutionTerminal({
  messages,
  events,
  loading,
  error,
  emptyHint,
}: TerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, events.length, loading]);

  if (messages.length === 0 && events.length === 0 && !loading) {
    return <>{emptyHint}</>;
  }

  return (
    <div className="space-y-4" aria-live="polite">
      {messages.map((msg) => (
        <motion.div
          key={msg.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className={cn(
            "flex gap-2.5",
            msg.role === "user" ? "justify-end" : "justify-start"
          )}
        >
          {msg.role !== "user" && (
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-kore-accent/40 bg-kore-bg">
              <Bot className="h-4 w-4 text-kore-accent" aria-hidden />
            </span>
          )}
          <div
            className={cn(
              "min-w-0 max-w-full rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[90%]",
              msg.role === "user"
                ? "border-kore-accent/30 bg-kore-accent/10 text-kore-text"
                : "border-kore-border bg-kore-bg text-kore-text"
            )}
          >
            {msg.role === "user" ? (
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
            ) : (
              <div
                className="kore-prose [&_a]:text-kore-accent [&_a]:underline [&_code]:rounded [&_code]:bg-kore-panel2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.82em] [&_code]:text-kore-accent [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:text-kore-strong"
                dangerouslySetInnerHTML={{ __html: renderSafe(msg.content) }}
              />
            )}
          </div>
          {msg.role === "user" && (
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-kore-border bg-kore-bg">
              <User className="h-4 w-4 text-kore-muted" aria-hidden />
            </span>
          )}
        </motion.div>
      ))}

      {events.length > 0 && (
        <div className="rounded-lg border border-kore-border bg-kore-bg/70 px-3.5 py-2.5 font-mono text-xs leading-relaxed">
          {events.map((e, i) => (
            <div key={`${e.at}-${i}`} className={cn("break-words", EVENT_STYLE[e.kind])}>
              {e.message}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-kore-warn">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              <span>
                Working<span className="kore-caret">▊</span>
              </span>
            </div>
          )}
        </div>
      )}

      {loading && events.length === 0 && (
        <div className="flex items-center gap-2 font-mono text-xs text-kore-warn">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          <span>
            Connecting<span className="kore-caret">▊</span>
          </span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-kore-danger/40 bg-kore-danger/10 px-3.5 py-2.5 text-sm text-kore-danger"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="break-words">{error}</span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
