"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  FileCode2,
  Loader2,
  Save,
  Download,
  Upload,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { press } from "@/lib/motion";

/**
 * The project's files: a real file tree over `project_files`, edited in a
 * Monaco editor (loaded on demand so it never blocks first paint), with import
 * from a local file and export back to disk.
 */

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <span className="flex items-center gap-2 font-mono text-xs text-kore-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Loading editor…
      </span>
    </div>
  ),
});

export interface FileMeta {
  path: string;
  language: string;
  updated_at: string;
}

interface FilesPanelProps {
  slug: string;
  files: FileMeta[];
  onChanged: () => void;
}

export default function FilesPanel({ slug, files, onChanged }: FilesPanelProps) {
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPath, setNewPath] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dirty = openPath !== null && content !== savedContent;

  const openFile = useCallback(
    async (path: string) => {
      setOpenPath(path);
      setLoadingFile(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/projects/${slug}/files?path=${encodeURIComponent(path)}`
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? "Could not read that file.");
          return;
        }
        setContent(data.file.content ?? "");
        setSavedContent(data.file.content ?? "");
      } catch {
        setError("Connection failed while reading that file.");
      } finally {
        setLoadingFile(false);
      }
    },
    [slug]
  );

  const writeFile = useCallback(
    async (path: string, body: string) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${slug}/files`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, content: body }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? "Could not save that file.");
          return false;
        }
        setSavedContent(body);
        onChanged();
        return true;
      } catch {
        setError("Connection failed while saving that file.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [slug, onChanged]
  );

  const removeFile = useCallback(
    async (path: string) => {
      if (!window.confirm(`Delete ${path} from this project?`)) return;
      try {
        const res = await fetch(
          `/api/projects/${slug}/files?path=${encodeURIComponent(path)}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          setError("Could not delete that file.");
          return;
        }
        if (openPath === path) {
          setOpenPath(null);
          setContent("");
          setSavedContent("");
        }
        onChanged();
      } catch {
        setError("Connection failed while deleting that file.");
      }
    },
    [slug, openPath, onChanged]
  );

  const sorted = useMemo(
    () => [...files].sort((a, b) => a.path.localeCompare(b.path)),
    [files]
  );

  const openMeta = sorted.find((f) => f.path === openPath) ?? null;

  function download() {
    if (!openMeta) return;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Export keeps the file's own name, minus any directory prefix.
    a.download = openMeta.path.split("/").pop() ?? "file.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function copyContent() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Clipboard is unavailable in this browser.");
    }
  }

  async function importFromDisk(file: File) {
    try {
      const text = await file.text();
      const ok = await writeFile(file.name, text);
      if (ok) {
        setOpenPath(file.name);
        setContent(text);
        onChanged();
      }
    } catch {
      setError("That file could not be read.");
    }
  }

  async function createFile() {
    const path = newPath.trim().replace(/^\/+/, "");
    if (!path || path.includes("..")) {
      setError("Enter a file path such as index.html or src/app.ts.");
      return;
    }
    const ok = await writeFile(path, "");
    if (ok) {
      setNewPath("");
      setOpenPath(path);
      setContent("");
      setSavedContent("");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Tree */}
      <div className="flex min-h-0 flex-col border-b border-kore-border lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-1.5 border-b border-kore-border px-3 py-2">
          <input
            value={newPath}
            onChange={(e) => setNewPath(e.target.value.slice(0, 200))}
            onKeyDown={(e) => {
              if (e.key === "Enter") createFile();
            }}
            placeholder="new file path"
            aria-label="New file path"
            className="min-w-0 flex-1 rounded-lg border border-kore-border bg-kore-bg/60 px-2.5 py-1.5 font-mono text-xs text-kore-text placeholder:text-kore-muted focus:border-white/30 focus:outline-none"
          />
          <motion.button
            whileTap={press}
            onClick={createFile}
            className="rounded-lg p-1.5 text-kore-muted transition-colors duration-150 hover:bg-white/[0.07] hover:text-white"
            aria-label="Create file"
            title="Create file"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </motion.button>
          <motion.button
            whileTap={press}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg p-1.5 text-kore-muted transition-colors duration-150 hover:bg-white/[0.07] hover:text-white"
            aria-label="Import a file from this computer"
            title="Import a file"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden />
          </motion.button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFromDisk(f);
              e.target.value = "";
            }}
          />
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {sorted.length === 0 ? (
            <li className="px-2 py-6 text-center text-xs leading-relaxed text-kore-muted">
              No files yet. Ask the agent to build something, import a file, or
              create one above.
            </li>
          ) : (
            sorted.map((file) => {
              const active = file.path === openPath;
              return (
                <li key={file.path} className="group flex items-center gap-1">
                  <button
                    onClick={() => openFile(file.path)}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left font-mono text-[11px] transition-colors duration-150",
                      active
                        ? "bg-white/[0.09] text-white"
                        : "text-kore-muted hover:bg-white/[0.05] hover:text-kore-text"
                    )}
                    title={file.path}
                  >
                    <FileCode2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{file.path}</span>
                  </button>
                  <button
                    onClick={() => removeFile(file.path)}
                    className="rounded p-1 text-kore-muted opacity-0 transition hover:text-red-300 focus:opacity-100 group-hover:opacity-100"
                    aria-label={`Delete ${file.path}`}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* Editor */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-kore-border px-3 py-2">
          <p className="mr-auto min-w-0 truncate font-mono text-[11px] text-kore-text">
            {openMeta ? openMeta.path : "No file open"}
            {dirty && (
              <span className="ml-2 text-kore-warn" title="Unsaved changes">
                ●
              </span>
            )}
          </p>
          {openMeta && (
            <>
              <motion.button
                whileTap={press}
                onClick={() => writeFile(openMeta.path, content)}
                disabled={!dirty || saving}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] transition",
                  dirty
                    ? "border-white/25 bg-white text-black hover:scale-[1.02]"
                    : "border-kore-border text-kore-muted"
                )}
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <Save className="h-3 w-3" aria-hidden />
                )}
                Save
              </motion.button>
              <motion.button
                whileTap={press}
                onClick={download}
                className="inline-flex items-center gap-1.5 rounded-full border border-kore-border px-3 py-1.5 font-mono text-[10px] text-kore-muted transition hover:border-white/25 hover:text-white"
                title="Export this file to your computer"
              >
                <Download className="h-3 w-3" aria-hidden />
                Export
              </motion.button>
              <motion.button
                whileTap={press}
                onClick={copyContent}
                className="inline-flex items-center gap-1.5 rounded-full border border-kore-border px-3 py-1.5 font-mono text-[10px] text-kore-muted transition hover:border-white/25 hover:text-white"
              >
                {copied ? (
                  <Check className="h-3 w-3" aria-hidden />
                ) : null}
                {copied ? "Copied" : "Copy"}
              </motion.button>
            </>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 border-b border-kore-danger/30 bg-kore-danger/10 px-3 py-2 text-xs text-red-300"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <div className="min-h-0 flex-1">
          {!openMeta ? (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <p className="max-w-xs text-xs leading-relaxed text-kore-muted">
                Pick a file from the tree to open it in the editor. Files the agent
                writes appear here automatically.
              </p>
            </div>
          ) : loadingFile ? (
            <div className="flex h-full items-center justify-center">
              <span className="flex items-center gap-2 font-mono text-xs text-kore-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Opening {openMeta.path}…
              </span>
            </div>
          ) : (
            <MonacoEditor
              height="100%"
              theme="vs-dark"
              language={openMeta.language}
              path={openMeta.path}
              value={content}
              onChange={(value) => setContent(value ?? "")}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                tabSize: 2,
                automaticLayout: true,
                renderLineHighlight: "none",
                padding: { top: 12, bottom: 12 },
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
