"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  Search,
  X,
  ArrowLeft,
  Copy,
  Check,
  FileCode2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Package,
} from "lucide-react";
import type { SkillDetail, SkillSummary } from "@/types";
import { cn } from "@/lib/utils";
import { renderSafeMarkdown } from "@/lib/markdown";
import { EASE, fadeUp, hoverLift, press, staggerGroup } from "@/lib/motion";

/* Prose styling for rendered skill markdown. */
const PROSE = cn(
  "kore-prose text-sm leading-relaxed text-kore-text",
  "[&_a]:text-kore-accent [&_a]:underline [&_a]:underline-offset-2",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-kore-border [&_blockquote]:pl-3 [&_blockquote]:text-kore-muted",
  "[&_code]:rounded [&_code]:bg-white/[0.06] [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_code]:text-emerald-200",
  "[&_em]:text-kore-text",
  "[&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-white",
  "[&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-white",
  "[&_h4]:mb-1.5 [&_h4]:mt-5 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-white",
  "[&_h5]:mb-1.5 [&_h5]:mt-4 [&_h5]:text-sm [&_h5]:font-semibold [&_h5]:text-kore-text",
  "[&_h6]:mb-1 [&_h6]:mt-4 [&_h6]:text-xs [&_h6]:font-semibold [&_h6]:uppercase [&_h6]:tracking-wider [&_h6]:text-kore-muted",
  "[&_hr]:my-5 [&_hr]:border-kore-border",
  "[&_li]:my-1 [&_li]:ml-4 [&_li]:list-disc [&_li]:marker:text-kore-muted",
  "[&_p]:my-2.5",
  "[&_pre]:my-3",
  "[&_strong]:font-semibold [&_strong]:text-white"
);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface SkillsPanelProps {
  /** Seeds the composer with `/skill-name` and returns to the workspace. */
  onUseSkill?: (name: string) => void;
}

export default function SkillsPanel({ onUseSkill }: SkillsPanelProps) {
  const [skills, setSkills] = useState<SkillSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [activeName, setActiveName] = useState<string | null>(null);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /* -------------------------------------------------------- list load */
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/skills", { signal: controller.signal });
        if (cancelled) return;
        if (!res.ok) {
          setListError(
            res.status === 401
              ? "Your session expired. Sign in again to browse skills."
              : "We couldn't load the skill list. Try again in a moment."
          );
          setSkills([]);
          return;
        }
        const data = await res.json();
        setSkills(Array.isArray(data.skills) ? data.skills : []);
        setListError(null);
      } catch (err) {
        if (cancelled || (err instanceof Error && err.name === "AbortError")) {
          return;
        }
        setListError("Connection failed while loading skills.");
        setSkills([]);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  /* ------------------------------------------------------ detail load */
  useEffect(() => {
    if (!activeName) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);

    (async () => {
      try {
        const res = await fetch(`/api/skills/${encodeURIComponent(activeName)}`, {
          signal: controller.signal,
        });
        if (cancelled) return;
        if (!res.ok) {
          setDetailError(
            res.status === 404
              ? "That skill no longer exists in the repository."
              : "We couldn't open this skill. Try again in a moment."
          );
          return;
        }
        const data = await res.json();
        setDetail(data.skill ?? null);
      } catch (err) {
        if (cancelled || (err instanceof Error && err.name === "AbortError")) {
          return;
        }
        setDetailError("Connection failed while opening this skill.");
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeName]);

  /* ------------------------------------------- keyboard: escape to close */
  useEffect(() => {
    if (!activeName) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveName(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeName]);

  const copy = useCallback(async () => {
    if (!detail) return;
    const text = detail.content;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
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
  }, [detail]);

  const filtered = useMemo(() => {
    const list = skills ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }, [skills, query]);

  const loading = skills === null;
  const detailOpen = activeName !== null;

  return (
    <div className="flex min-h-0 flex-1">
      {/* ------------------------------------------------------- Index */}
      <section
        aria-label="Available skills"
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6",
          detailOpen ? "hidden xl:block" : "block"
        )}
      >
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-5 flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-semibold tracking-tight text-white">
                  Skills
                </h2>
                {!loading && skills && skills.length > 0 ? (
                  <span className="glass-subtle rounded-full px-2 py-0.5 font-mono text-[10px] text-kore-muted">
                    {skills.length}
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-kore-muted">
                Reusable task guides that ship with this repository. An agent
                loads one on demand when your request matches it.
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-5 max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-kore-muted"
              aria-hidden
            />
            <label htmlFor="skill-search" className="sr-only">
              Search skills
            </label>
            <input
              id="skill-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search skills by name or purpose…"
              className="glass-subtle w-full rounded-xl py-2.5 pl-9 pr-9 text-sm text-kore-text placeholder:text-kore-muted/60 focus:border-kore-accent"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-kore-muted transition-colors duration-150 hover:text-white"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>

          {/* Error */}
          {listError ? (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-kore-danger/40 bg-kore-danger/10 px-3.5 py-3 text-sm text-red-300"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="leading-relaxed">{listError}</span>
            </div>
          ) : null}

          {/* Loading skeletons */}
          {loading ? (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <li
                  key={i}
                  className="glass h-40 animate-pulse rounded-2xl"
                  aria-hidden
                />
              ))}
            </ul>
          ) : null}

          {/* Empty: no skills installed */}
          {!loading && !listError && (skills?.length ?? 0) === 0 ? (
            <div className="glass-subtle rounded-2xl px-6 py-10 text-center">
              <Package className="mx-auto mb-3 h-5 w-5 text-kore-muted" aria-hidden />
              <p className="text-sm font-medium text-kore-text">
                No skills installed yet
              </p>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-kore-muted">
                Add a folder at{" "}
                <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px] text-emerald-200">
                  .claude/skills/&lt;name&gt;/SKILL.md
                </code>{" "}
                and commit it — it will appear here for everyone on the project.
              </p>
            </div>
          ) : null}

          {/* Empty: no search results */}
          {!loading && !listError && (skills?.length ?? 0) > 0 && filtered.length === 0 ? (
            <div className="glass-subtle rounded-2xl px-6 py-10 text-center">
              <Search className="mx-auto mb-3 h-5 w-5 text-kore-muted" aria-hidden />
              <p className="text-sm font-medium text-kore-text">
                No skills match “{query.trim()}”
              </p>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-kore-muted">
                Try a shorter term, or clear the search to see all{" "}
                {skills?.length} skills.
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="glass glass-interactive mt-4 rounded-full px-4 py-2 text-xs font-medium text-kore-text hover:text-white"
              >
                Clear search
              </button>
            </div>
          ) : null}

          {/* Grid */}
          {!loading && filtered.length > 0 ? (
            <motion.ul
              variants={staggerGroup(0.045)}
              initial="hidden"
              animate="visible"
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
            >
              {filtered.map((skill) => (
                <motion.li key={skill.name} variants={fadeUp}>
                  <motion.button
                    type="button"
                    whileHover={hoverLift}
                    whileTap={press}
                    onClick={() => setActiveName(skill.name)}
                    aria-current={activeName === skill.name ? "true" : undefined}
                    className={cn(
                      "glass glass-sheen group flex h-full w-full flex-col rounded-2xl p-4 text-left",
                      activeName === skill.name &&
                        "border-kore-accent/40 bg-kore-accent/[0.06]"
                    )}
                  >
                    <span className="mb-3 flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-kore-border bg-white/[0.03]">
                        <Sparkles
                          className="h-3.5 w-3.5 text-kore-accent"
                          aria-hidden
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-kore-text">
                          {skill.title}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[10px] text-kore-muted">
                          /{skill.name}
                        </span>
                      </span>
                      <ArrowRight
                        className="mt-1 h-3.5 w-3.5 shrink-0 text-kore-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                        aria-hidden
                      />
                    </span>

                    <span className="line-clamp-3 block flex-1 text-xs leading-relaxed text-kore-muted">
                      {skill.description}
                    </span>

                    <span className="mt-3 flex items-center gap-2 font-mono text-[10px] text-kore-muted/80">
                      <span>{formatBytes(skill.bytes)}</span>
                      {skill.resourceCount > 0 ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>
                            {skill.resourceCount} supporting file
                            {skill.resourceCount === 1 ? "" : "s"}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </motion.button>
                </motion.li>
              ))}
            </motion.ul>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------------ Detail */}
      <AnimatePresence initial={false}>
        {detailOpen ? (
          <motion.aside
            key="skill-detail"
            aria-label="Skill detail"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="glass-bar min-h-0 w-full overflow-y-auto border-kore-border lg:border-l xl:w-[34rem] xl:shrink-0"
          >
            {/* Sticky detail header */}
            <div className="glass-bar sticky top-0 z-10 flex items-center gap-2 px-4 py-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                transition={{ duration: 0.12, ease: EASE }}
                onClick={() => setActiveName(null)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-kore-muted transition-colors duration-150 hover:bg-white/[0.05] hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                <span className="xl:hidden">All skills</span>
                <span className="hidden xl:inline">Close</span>
              </motion.button>

              <div className="ml-auto flex items-center gap-1.5">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  transition={{ duration: 0.12, ease: EASE }}
                  onClick={copy}
                  disabled={!detail}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors duration-150 disabled:opacity-40",
                    copied
                      ? "border-kore-accent/50 bg-kore-accent/10 text-kore-accent"
                      : "border-kore-border text-kore-muted hover:border-kore-accent/40 hover:text-white"
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3" aria-hidden /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" aria-hidden /> Copy
                    </>
                  )}
                </motion.button>
              </div>
            </div>

            <div className="px-4 pb-8 pt-1 sm:px-5">
              {/* Loading */}
              {detailLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Loader2
                    className="mb-3 h-5 w-5 animate-spin text-kore-muted"
                    aria-hidden
                  />
                  <p className="text-sm text-kore-muted" role="status">
                    Opening skill…
                  </p>
                </div>
              ) : null}

              {/* Error */}
              {!detailLoading && detailError ? (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2.5 rounded-xl border border-kore-danger/40 bg-kore-danger/10 px-3.5 py-3 text-sm text-red-300"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span className="leading-relaxed">{detailError}</span>
                </div>
              ) : null}

              {/* Content */}
              {!detailLoading && detail ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE, delay: 0.05 }}
                >
                  <h2 className="text-base font-semibold tracking-tight text-white">
                    {detail.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-kore-muted">
                    {detail.description}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="glass-subtle rounded-full px-2.5 py-1 font-mono text-[10px] text-kore-text">
                      /{detail.name}
                    </span>
                    <span className="glass-subtle rounded-full px-2.5 py-1 font-mono text-[10px] text-kore-muted">
                      {formatBytes(detail.bytes)}
                    </span>
                    {detail.resourceCount > 0 ? (
                      <span className="glass-subtle rounded-full px-2.5 py-1 font-mono text-[10px] text-kore-muted">
                        {detail.resourceCount} file
                        {detail.resourceCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>

                  {onUseSkill ? (
                    <motion.button
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={press}
                      transition={{ duration: 0.18, ease: EASE }}
                      onClick={() => onUseSkill(detail.name)}
                      className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition-transform duration-150"
                    >
                      Use in a task
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </motion.button>
                  ) : null}

                  {/* Supporting files */}
                  {detail.resourceNames.length > 0 ? (
                    <div className="mt-6">
                      <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-kore-muted">
                        SUPPORTING FILES
                      </p>
                      <ul className="space-y-1">
                        {detail.resourceNames.map((file) => (
                          <li
                            key={file}
                            className="flex items-center gap-2 font-mono text-[11px] text-kore-muted"
                          >
                            <FileCode2 className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="truncate">{file}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <hr className="my-6 border-kore-border" />

                  <div
                    className={PROSE}
                    dangerouslySetInnerHTML={{
                      __html: renderSafeMarkdown(detail.content),
                    }}
                  />
                </motion.div>
              ) : null}
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
