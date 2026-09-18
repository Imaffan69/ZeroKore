"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Github,
  Loader2,
  Search,
  RefreshCw,
  Lock,
  Globe,
  Check,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE, press } from "@/lib/motion";
import type { GitHubRepo } from "@/types/projects";

/** Import a GitHub repository the signed-in user already has access to. */
export default function ImportRepoPanel({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GitHubRepo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setNote(null);
    setRepos(null);
    try {
      const res = await fetch("/api/github/repos");
      const data = await res.json();
      setRepos(Array.isArray(data.repos) ? data.repos : []);
      setNote(
        typeof data.message === "string" && data.message ? data.message : null
      );
    } catch {
      setRepos([]);
      setNote("Connection failed while reaching GitHub.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const list = repos ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list.slice(0, 40);
    return list
      .filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          (r.language ?? "").toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [repos, query]);

  async function importSelected() {
    if (!selected) {
      setError("Choose a repository to import.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/github/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: selected.full_name,
          branch: selected.default_branch,
          name: selected.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Could not import that repository.");
        return;
      }
      router.push(`/projects/${data.project.slug}`);
    } catch {
      setError("Connection failed while importing the repository.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: EASE }}
      className="glass glass-sheen mt-4 rounded-2xl p-5"
      aria-label="Import a repository"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">Import a repository</h2>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] text-kore-muted transition-colors duration-150 hover:text-white"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          Refresh list
        </button>
      </div>

      {note && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-kore-warn/30 bg-kore-warn/10 px-3 py-2.5 text-xs leading-relaxed text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {note}{" "}
            <Link href="/settings" className="underline">
              Open Settings
            </Link>
          </span>
        </p>
      )}

      {repos === null ? (
        <p className="mt-4 flex items-center gap-2 font-mono text-xs text-kore-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Loading your repositories…
        </p>
      ) : repos.length > 0 ? (
        <>
          <div className="relative mt-4">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-kore-muted"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name or language"
              aria-label="Filter repositories"
              className="w-full rounded-xl border border-kore-border bg-kore-bg/60 py-2 pl-9 pr-3 text-sm text-kore-text placeholder:text-kore-muted focus:border-white/30 focus:outline-none"
            />
          </div>

          <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {filtered.map((repo) => {
              const isSelected = selected?.full_name === repo.full_name;
              return (
                <li key={repo.full_name}>
                  <button
                    onClick={() => setSelected(repo)}
                    aria-pressed={isSelected}
                    className={cn(
                      "glass-subtle flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-150",
                      isSelected ? "ring-1 ring-white/30" : "hover:bg-white/[0.07]"
                    )}
                  >
                    <span className="shrink-0 text-kore-muted" aria-hidden>
                      {repo.private ? (
                        <Lock className="h-3.5 w-3.5" />
                      ) : (
                        <Globe className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs text-kore-text">
                        {repo.full_name}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-kore-muted">
                        {repo.language ?? "Unknown language"} · {repo.default_branch}
                      </span>
                    </span>
                    {isSelected && (
                      <Check
                        className="h-3.5 w-3.5 shrink-0 text-white"
                        aria-hidden
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="mt-4 text-xs leading-relaxed text-kore-muted">
          No repositories are available for this account yet. Connect GitHub under
          Settings → Integrations, then refresh this list.
        </p>
      )}

      {repos && repos.length > 0 && (
        <>
          <div className="mt-4 flex items-center gap-2">
            <motion.button
              whileTap={press}
              onClick={importSelected}
              disabled={busy || !selected}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition-transform duration-150 hover:scale-[1.02] disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Github className="h-3.5 w-3.5" aria-hidden />
              )}
              Import {selected ? selected.name : "repository"}
            </motion.button>
            <button
              onClick={onCancel}
              className="rounded-full px-3.5 py-2 text-xs text-kore-muted transition-colors duration-150 hover:text-white"
            >
              Cancel
            </button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-kore-muted">
            Up to 200 text files are imported; binary and vendored paths are
            skipped. The preview is assembled from the repository&apos;s own HTML,
            CSS and JavaScript.
          </p>
        </>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-kore-danger/40 bg-kore-danger/10 px-3.5 py-2.5 text-sm text-red-300"
        >
          {error}
        </p>
      )}
    </motion.section>
  );
}
