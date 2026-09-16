"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FileCode2, Copy, Check, Eye, Code2, BookOpen } from "lucide-react";
import type { Artifact } from "@/types";
import { cn } from "@/lib/utils";

type Tab = "preview" | "code" | "markdown";

function escapeHtmlSrc(s: string): string {
  const AMP = "&" + "amp;";
  const LT = "&" + "lt;";
  const GT = "&" + "gt;";
  return s.split("&").join(AMP).split("<").join(LT).split(">").join(GT);
}

/** Safe inline markdown for the markdown tab (escaped first). */
function renderMarkdownSafe(text: string): string {
  let out = escapeHtmlSrc(text);
  out = out.replace(/^### (.*)$/gm, "<h4>$1</h4>");
  out = out.replace(/^## (.*)$/gm, "<h3>$1</h3>");
  out = out.replace(/^# (.*)$/gm, "<h2>$1</h2>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  out = out.replace(/^[-*] (.*)$/gm, "<li>$1</li>");
  out = out.replace(/\n/g, "<br/>");
  return out;
}

export default function ArtifactViewer({
  artifact,
}: {
  artifact: Artifact | null;
}) {
  const [tab, setTab] = useState<Tab>("preview");
  const [copied, setCopied] = useState(false);

  const srcDoc = useMemo(() => {
    if (!artifact) return "";
    if (artifact.type === "html") return artifact.content;
    if (artifact.type === "svg") {
      const svg = artifact.content.includes("<svg")
        ? artifact.content
        : `<svg xmlns="http://www.w3.org/2000/svg">${artifact.content}</svg>`;
      return `<!doctype html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0d1420;">${svg}</body></html>`;
    }
    return "";
  }, [artifact]);

  async function copy() {
    if (!artifact) return;
    try {
      await navigator.clipboard.writeText(artifact.content);
    } catch {
      // Clipboard unavailable — fallback via temporary textarea.
      try {
        const ta = document.createElement("textarea");
        ta.value = artifact.content;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        return;
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  if (!artifact) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-kore-border bg-kore-panel/50 p-6 text-center">
        <FileCode2 className="h-8 w-8 text-kore-muted" aria-hidden />
        <p className="font-mono text-sm text-kore-muted">
          No artifact generated yet.
        </p>
        <p className="max-w-xs text-xs text-kore-muted/80">
          Ask ZeroKore to write code, build a page, draw an SVG, or draft a
          document — it will appear here.
        </p>
      </div>
    );
  }

  const showPreviewTab = artifact.type === "html" || artifact.type === "svg";
  const showMarkdownTab = artifact.type === "markdown";
  const activeTab: Tab = !showPreviewTab && tab === "preview" ? "code" : tab;

  return (
    <motion.div
      key={`${artifact.title}-${artifact.content.length}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex h-full min-h-[240px] flex-col overflow-hidden rounded-xl border border-kore-border bg-kore-panel"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-kore-border px-3 py-2.5">
        <div className="mr-auto min-w-0">
          <p className="truncate text-sm font-semibold text-kore-strong" title={artifact.title}>
            {artifact.title}
          </p>
          <p className="font-mono text-[11px] text-kore-muted">
            {artifact.type} · {artifact.language}
          </p>
        </div>
        <button
          onClick={copy}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-xs transition",
            copied
              ? "border-kore-accent/60 bg-kore-accent/10 text-kore-accent"
              : "border-kore-border text-kore-muted hover:border-kore-accent/40 hover:text-kore-strong"
          )}
          aria-label="Copy artifact content"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden /> Copied ✓
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden /> Copy
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-kore-border px-3 pt-2" role="tablist" aria-label="Artifact view">
        {showPreviewTab && (
          <button
            role="tab"
            aria-selected={activeTab === "preview"}
            onClick={() => setTab("preview")}
            className={cn(
              "flex items-center gap-1.5 rounded-t-md px-3 py-1.5 font-mono text-xs transition",
              activeTab === "preview"
                ? "bg-kore-bg text-kore-accent"
                : "text-kore-muted hover:text-kore-strong"
            )}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden /> Preview
          </button>
        )}
        <button
          role="tab"
          aria-selected={activeTab === "code"}
          onClick={() => setTab("code")}
          className={cn(
            "flex items-center gap-1.5 rounded-t-md px-3 py-1.5 font-mono text-xs transition",
            activeTab === "code"
              ? "bg-kore-bg text-kore-accent"
              : "text-kore-muted hover:text-kore-strong"
            )}
          >
            <Code2 className="h-3.5 w-3.5" aria-hidden /> Code
        </button>
        {showMarkdownTab && (
          <button
            role="tab"
            aria-selected={activeTab === "markdown"}
            onClick={() => setTab("markdown")}
            className={cn(
              "flex items-center gap-1.5 rounded-t-md px-3 py-1.5 font-mono text-xs transition",
              activeTab === "markdown"
                ? "bg-kore-bg text-kore-accent"
                : "text-kore-muted hover:text-kore-strong"
            )}
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden /> Markdown
          </button>
        )}
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-auto bg-kore-bg">
        {activeTab === "preview" && showPreviewTab && (
          <iframe
            title={`Preview of ${artifact.title}`}
            srcDoc={srcDoc}
            sandbox=""
            className="h-full min-h-[320px] w-full border-0 bg-white"
          />
        )}
        {activeTab === "code" && (
          <pre className="max-w-full overflow-x-auto p-3 font-mono text-xs leading-relaxed text-kore-text">
            <code>{artifact.content}</code>
          </pre>
        )}
        {activeTab === "markdown" && showMarkdownTab && (
          <div
            className="kore-prose max-w-full p-4 text-sm leading-relaxed [&_a]:text-kore-accent [&_a]:underline [&_code]:rounded [&_code]:bg-kore-panel2 [&_code]:px-1 [&_code]:text-[0.85em] [&_code]:text-kore-accent [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-kore-strong [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-kore-strong [&_h4]:font-bold [&_h4]:text-kore-strong [&_li]:ml-4 [&_li]:list-disc [&_strong]:text-kore-strong"
            dangerouslySetInnerHTML={{
              __html: renderMarkdownSafe(artifact.content),
            }}
          />
        )}
      </div>
    </motion.div>
  );
}
