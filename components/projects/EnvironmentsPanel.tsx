"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Eye,
  FileCode2,
  TerminalSquare,
  Server,
  KeyRound,
  Loader2,
  Plus,
  Trash2,
  AlertTriangle,
  Download,
  GitCompare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE, press } from "@/lib/motion";
import FilesPanel, { type FileMeta } from "./FilesPanel";
import ChangesTab from "./ChangesTab";
import type { ProjectEnvironment, ProjectSecretSummary } from "@/types/projects";

/**
 * A project's environment surfaces.
 *
 * These replace the old floating "artifact" panel: rendered output is a real
 * preview, source is a real file tree, the terminal is a real transcript of what
 * the agent actually executed, and secrets are real encrypted values.
 *
 * Nothing here is simulated. Where a surface cannot exist in this deployment
 * (a hosted dev server) the panel says so instead of showing a fake one.
 */

type Tab = "preview" | "files" | "changes" | "terminal" | "dev_server" | "secrets";

const TABS: { id: Tab; label: string; icon: typeof Eye }[] = [
  { id: "preview", label: "Preview", icon: Eye },
  { id: "files", label: "Code", icon: FileCode2 },
  { id: "changes", label: "Changes", icon: GitCompare },
  { id: "terminal", label: "Terminal", icon: TerminalSquare },
  { id: "dev_server", label: "Dev server", icon: Server },
  { id: "secrets", label: "Secrets", icon: KeyRound },
];

export interface TranscriptLine {
  at: string;
  text: string;
  tone: "info" | "tool" | "warn" | "error";
}

interface EnvironmentsPanelProps {
  slug: string;
  environments: ProjectEnvironment[];
  files: FileMeta[];
  transcript: TranscriptLine[];
  onChanged: () => void;
}

export default function EnvironmentsPanel({
  slug,
  environments,
  files,
  transcript,
  onChanged,
}: EnvironmentsPanelProps) {
  const [tab, setTab] = useState<Tab>("preview");
  const [savingPreview, setSavingPreview] = useState(false);

  const preview = environments.find((e) => e.kind === "preview") ?? null;
  const previewContent = preview?.content ?? "";

  const [draft, setDraft] = useState(previewContent);
  const [previewDirty, setPreviewDirty] = useState(false);
  useEffect(() => {
    setDraft(previewContent);
    setPreviewDirty(false);
  }, [previewContent]);

  const savePreview = useCallback(async () => {
    setSavingPreview(true);
    try {
      await fetch(`/api/projects/${slug}/environments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "preview", content: draft, language: "html" }),
      });
      onChanged();
    } finally {
      setSavingPreview(false);
    }
  }, [slug, draft, onChanged]);

  /* ------------------------------------------------------------ secrets */

  const [secretsConfigured, setSecretsConfigured] = useState<boolean | null>(null);
  const [secretsNote, setSecretsNote] = useState<string | null>(null);
  const [keys, setKeys] = useState<ProjectSecretSummary[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [secretBusy, setSecretBusy] = useState(false);
  const [secretError, setSecretError] = useState<string | null>(null);

  const loadSecrets = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/secrets`);
      const data = await res.json();
      setSecretsConfigured(!!data.configured);
      setKeys(Array.isArray(data.keys) ? data.keys : []);
      setSecretsNote(typeof data.message === "string" ? data.message : null);
    } catch {
      setSecretsConfigured(false);
      setSecretsNote("Connection failed while reading environment variables.");
    }
  }, [slug]);

  useEffect(() => {
    if (tab === "secrets") loadSecrets();
  }, [tab, loadSecrets]);

  async function saveSecret() {
    if (!newKey.trim() || !newValue) {
      setSecretError("Enter a name and a value.");
      return;
    }
    setSecretBusy(true);
    setSecretError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/secrets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newKey, value: newValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSecretError(data?.error ?? "Could not save that variable.");
        return;
      }
      setNewKey("");
      setNewValue("");
      loadSecrets();
    } catch {
      setSecretError("Connection failed while saving that variable.");
    } finally {
      setSecretBusy(false);
    }
  }

  async function removeSecret(key: string) {
    if (!window.confirm(`Delete ${key}? This cannot be undone.`)) return;
    try {
      await fetch(`/api/projects/${slug}/secrets?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      loadSecrets();
    } catch {
      setSecretError("Connection failed while deleting that variable.");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Surfaces */}
      <div
        className="glass-bar flex shrink-0 gap-1 overflow-x-auto p-1.5"
        role="tablist"
        aria-label="Project environments"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-150",
                active ? "text-white" : "text-kore-muted hover:text-kore-text"
              )}
            >
              {active && (
                <motion.span
                  layoutId="env-tab"
                  className="absolute inset-0 rounded-lg bg-white/[0.09]"
                  transition={{ duration: 0.2, ease: EASE }}
                  aria-hidden
                />
              )}
              <span className="relative flex items-center gap-1.5">
                <t.icon className="h-3.5 w-3.5" aria-hidden />
                {t.label}
                {t.id === "preview" && previewContent && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-white"
                    aria-label="Preview available"
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Preview */}
      {tab === "preview" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-kore-border px-3 py-2">
            <p className="mr-auto truncate font-mono text-[11px] text-kore-muted">
              {preview?.label ? preview.label : "Preview"}
              {previewDirty && <span className="ml-2 text-kore-warn">●</span>}
            </p>
            {previewDirty && (
              <motion.button
                whileTap={press}
                onClick={savePreview}
                disabled={savingPreview}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-mono text-[10px] font-semibold text-black"
              >
                {savingPreview ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : null}
                Save preview
              </motion.button>
            )}
            {previewContent && (
              <motion.button
                whileTap={press}
                onClick={() => {
                  const blob = new Blob([previewContent], {
                    type: "text/html;charset=utf-8",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "preview.html";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-kore-border px-3 py-1.5 font-mono text-[10px] text-kore-muted transition hover:border-white/25 hover:text-white"
              >
                <Download className="h-3 w-3" aria-hidden />
                Export HTML
              </motion.button>
            )}
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
            <div className="min-h-[240px] border-b border-kore-border lg:border-b-0 lg:border-r">
              {previewContent ? (
                <iframe
                  // Sandboxed with no allowances: generated markup can never
                  // reach the app, its storage or its session.
                  sandbox=""
                  title="Project preview"
                  srcDoc={previewContent}
                  className="h-full min-h-[240px] w-full border-0 bg-white"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center">
                  <p className="max-w-xs text-xs leading-relaxed text-kore-muted">
                    Nothing to preview yet. Ask the agent to build a page or
                    component, or edit the HTML on the right and save it.
                  </p>
                </div>
              )}
            </div>
            <div className="flex min-h-0 flex-col">
              <p className="border-b border-kore-border px-3 py-2 font-mono text-[10px] tracking-[0.2em] text-kore-muted">
                PREVIEW SOURCE
              </p>
              <textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setPreviewDirty(true);
                }}
                spellCheck={false}
                aria-label="Preview source"
                placeholder="<!doctype html>…"
                className="min-h-[200px] flex-1 resize-none bg-kore-bg/60 p-3 font-mono text-xs leading-relaxed text-kore-text focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Files */}
      {tab === "files" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <FilesPanel slug={slug} files={files} onChanged={onChanged} />
        </div>
      )}

      {/* Changes */}
      {tab === "changes" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <ChangesTab slug={slug} />
        </div>
      )}

      {/* Terminal */}
      {tab === "terminal" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="border-b border-kore-border px-3 py-2 font-mono text-[10px] tracking-[0.2em] text-kore-muted">
            AGENT EXECUTION TRANSCRIPT
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {transcript.length === 0 ? (
              <p className="max-w-md text-xs leading-relaxed text-kore-muted">
                This terminal records what the agent actually did in this project:
                every tool it called and every file it wrote. It fills in as you
                work. ZeroKore does not host a shell, so there is no prompt to type
                into — you get the real execution record rather than a simulated
                one.
              </p>
            ) : (
              <ul className="space-y-1 font-mono text-[11px] leading-relaxed">
                {transcript.map((line, i) => (
                  <li
                    key={`${line.at}-${i}`}
                    className={cn(
                      "break-words",
                      line.tone === "info" && "text-kore-muted",
                      line.tone === "tool" && "text-amber-200",
                      line.tone === "warn" && "text-kore-warn",
                      line.tone === "error" && "text-red-300"
                    )}
                  >
                    {line.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Dev server */}
      {tab === "dev_server" && (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10">
          <div className="glass-subtle max-w-md rounded-2xl p-5 text-center">
            <Server className="mx-auto mb-3 h-5 w-5 text-kore-muted" aria-hidden />
            <p className="text-sm font-medium text-kore-text">
              No dev server in this deployment
            </p>
            <p className="mt-2 text-xs leading-relaxed text-kore-muted">
              A dev server needs a long-running process with a container runtime.
              This deployment runs on serverless functions, which stop between
              requests, so ZeroKore will not show a fake server or a fake port.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-kore-muted">
              What works today: edit the files, render the preview, and push the
              project to GitHub. A hosted runtime can be added later without
              changing anything else here.
            </p>
          </div>
        </div>
      )}

      {/* Secrets */}
      {tab === "secrets" && (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-sm font-semibold text-white">
              Environment variables
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-kore-muted">
              Stored encrypted with AES-256-GCM and never sent back to a browser —
              this page only ever shows key names.
            </p>

            {secretsConfigured === false && (
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-kore-warn/30 bg-kore-warn/10 px-3.5 py-2.5 text-xs leading-relaxed text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {secretsNote ??
                  "Set ENCRYPTION_KEY on the server to store environment variables. ZeroKore will not save secrets unencrypted."}
              </p>
            )}

            {secretsConfigured && (
              <>
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <label
                      htmlFor="secret-key"
                      className="mb-1.5 block text-xs text-kore-text"
                    >
                      Name
                    </label>
                    <input
                      id="secret-key"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value.toUpperCase().slice(0, 64))}
                      placeholder="API_URL"
                      className="w-full rounded-xl border border-kore-border bg-kore-bg/60 px-3 py-2 font-mono text-sm text-kore-text placeholder:text-kore-muted focus:border-white/30 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="secret-value"
                      className="mb-1.5 block text-xs text-kore-text"
                    >
                      Value
                    </label>
                    <input
                      id="secret-value"
                      type="password"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-kore-border bg-kore-bg/60 px-3 py-2 font-mono text-sm text-kore-text placeholder:text-kore-muted focus:border-white/30 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-end">
                    <motion.button
                      whileTap={press}
                      onClick={saveSecret}
                      disabled={secretBusy}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition-transform duration-150 hover:scale-[1.02] disabled:opacity-60"
                    >
                      {secretBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                      )}
                      Save
                    </motion.button>
                  </div>
                </div>

                {secretError && (
                  <p
                    role="alert"
                    className="mt-3 rounded-xl border border-kore-danger/40 bg-kore-danger/10 px-3.5 py-2.5 text-sm text-red-300"
                  >
                    {secretError}
                  </p>
                )}

                <ul className="mt-4 space-y-1.5">
                  {keys.length === 0 ? (
                    <li className="glass-subtle rounded-xl px-3.5 py-3 text-xs leading-relaxed text-kore-muted">
                      No variables yet. Add one above — the value is encrypted before
                      it is stored.
                    </li>
                  ) : (
                    keys.map((k) => (
                      <li
                        key={k.key}
                        className="glass-subtle flex items-center gap-2 rounded-xl px-3.5 py-2.5"
                      >
                        <KeyRound className="h-3.5 w-3.5 shrink-0 text-kore-muted" aria-hidden />
                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-kore-text">
                          {k.key}
                        </span>
                        <span className="font-mono text-[10px] text-kore-muted">
                          updated {new Date(k.updated_at).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => removeSecret(k.key)}
                          className="rounded p-1.5 text-kore-muted transition hover:text-red-300"
                          aria-label={`Delete ${k.key}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
