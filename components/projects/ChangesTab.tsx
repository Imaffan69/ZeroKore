"use client";

import { useCallback, useEffect, useState } from "react";
import { GitCompare, Loader2, FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Changes tab: real per-file diffs from file_versions history.
 * Each entry compares the latest agent-written version against the previous
 * snapshot. A simple line-based LCS diff renders +/− counts like "Edit file.ts
 * +24 −3".
 */

interface ChangeEntry {
  path: string;
  edits: number;
  lastAt: string;
  lastBy: string;
  latest: string | null;
  previous: string | null;
}

interface DiffLine {
  type: "same" | "add" | "del";
  text: string;
}

function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  // LCS via dynamic programming, capped to keep the tab snappy.
  if (a.length * b.length > 1_000_000) {
    // Very large files: fall back to a coarse before/after view.
    return [
      { type: "del", text: `previous version (${a.length} lines)` },
      { type: "add", text: `new version (${b.length} lines)` },
    ];
  }
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: a[i++] });
    } else {
      out.push({ type: "add", text: b[j++] });
    }
  }
  while (i < m) out.push({ type: "del", text: a[i++] });
  while (j < n) out.push({ type: "add", text: b[j++] });
  return out;
}

export default function ChangesTab({ slug }: { slug: string }) {
  const [changes, setChanges] = useState<ChangeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openPath, setOpenPath] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}/versions`);
      if (res.ok) setChanges((await res.json()).changes ?? []);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-kore-muted" />
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="text-center">
          <GitCompare className="mx-auto h-6 w-6 text-kore-muted" aria-hidden />
          <p className="mt-3 text-sm text-kore-text">No changes recorded yet.</p>
          <p className="mt-1 text-xs leading-relaxed text-kore-muted">
            When the agent edits files, every version is snapshotted here with a
            real diff.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3 sm:px-4">
      <ul className="space-y-2">
        {changes.map((c) => {
          const diff =
            openPath === c.path
              ? lineDiff(c.previous ?? "", c.latest ?? "")
              : null;
          const added = diff?.filter((d) => d.type === "add").length ?? 0;
          const removed = diff?.filter((d) => d.type === "del").length ?? 0;
          return (
            <li key={c.path} className="glass-subtle rounded-xl">
              <button
                onClick={() => setOpenPath((p) => (p === c.path ? null : c.path))}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
              >
                <FileCode2 className="h-3.5 w-3.5 shrink-0 text-kore-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-kore-text">
                  {c.path}
                </span>
                {openPath === c.path ? (
                  <span className="shrink-0 font-mono text-[10px]">
                    <span className="text-emerald-400">+{added}</span>{" "}
                    <span className="text-red-400">−{removed}</span>
                  </span>
                ) : (
                  <span className="shrink-0 font-mono text-[10px] text-kore-muted">
                    {c.edits} edit{c.edits === 1 ? "" : "s"} ·{" "}
                    {c.lastAt.slice(0, 10)}
                  </span>
                )}
              </button>
              {diff && (
                <div className="max-h-72 overflow-y-auto border-t border-kore-border/60 px-3.5 py-2">
                  {diff
                    .filter((d) => d.type !== "same" || d.text.trim() !== "")
                    .slice(0, 400)
                    .map((d, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed",
                          d.type === "add" && "bg-emerald-500/10 text-emerald-300",
                          d.type === "del" && "bg-red-500/10 text-red-300",
                          d.type === "same" && "text-kore-muted"
                        )}
                      >
                        <span className="mr-2 select-none opacity-60">
                          {d.type === "add" ? "+" : d.type === "del" ? "−" : " "}
                        </span>
                        {d.text || " "}
                      </div>
                    ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
