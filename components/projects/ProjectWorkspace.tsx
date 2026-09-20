"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Github,
  UploadCloud,
  Loader2,
  CheckCircle2,
  SquareTerminal,
  TerminalSquare,
  LayoutGrid,
} from "lucide-react";
import ExecutionTerminal from "@/components/agent/ExecutionTerminal";
import ToolBar from "@/components/agent/ToolBar";
import EnvironmentsPanel, {
  type TranscriptLine,
} from "@/components/projects/EnvironmentsPanel";
import ProjectShell from "@/components/projects/ProjectShell";
import type { FileMeta } from "@/components/projects/FilesPanel";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import type {
  AgentEvent,
  AgentMode,
  AgentResponseBody,
  ChatMessage,
  ProviderInfo,
  UsageState,
} from "@/types";
import type { Project, ProjectEnvironment } from "@/types/projects";

/**
 * A project workspace at /projects/<slug>.
 *
 * The agent runs against this project: conversations are filed under it, and
 * artifacts become real project surfaces (a preview environment or a file).
 * Everything shown here comes from the server — there is no pretend state.
 */

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const TONE_BY_EVENT: Record<AgentEvent["kind"], TranscriptLine["tone"]> = {
  agent_started: "info",
  memory_retrieved: "info",
  tool_call: "tool",
  tool_completed: "info",
  provider_fallback: "warn",
  generating_artifact: "tool",
  completed: "info",
  error: "error",
};

export default function ProjectWorkspace({
  initialProject,
  username,
}: {
  initialProject: Project;
  username: string | null;
}) {
  const [project, setProject] = useState<Project>(initialProject);
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [environments, setEnvironments] = useState<ProjectEnvironment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<AgentMode>("coding");
  const [model, setModel] = useState("auto");
  const [models, setModels] = useState<ProviderInfo[]>([]);
  const [usage, setUsage] = useState<UsageState | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"chat" | "environment" | "terminal">("chat");

  const [pushing, setPushing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3200);
  }, []);

  /* ------------------------------------------------------------ loading */

  const loadProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.slug}`);
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data?.error ?? "Could not load this project.");
        return;
      }
      setProject(data.project);
      setFiles(Array.isArray(data.files) ? data.files : []);
      setEnvironments(Array.isArray(data.environments) ? data.environments : []);
      setLoadError(null);
    } catch {
      setLoadError("Connection failed while loading this project.");
    }
  }, [project.slug]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        if (Array.isArray(data.models)) setModels(data.models as ProviderInfo[]);
      } catch {
        // The picker stays empty; the cascade still works without it.
      }
    })();
  }, []);

  /* -------------------------------------------------------------- agent */

  async function send() {
    const message = input.trim();
    if (!message || loading) return;

    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "user",
        content: message,
        created_at: new Date().toISOString(),
      },
    ]);
    setInput("");
    setLoading(true);
    setError(null);
    setEvents([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message,
          conversationId,
          mode,
          provider: model,
          projectId: project.id,
        }),
      });
      const data = (await res.json()) as AgentResponseBody & {
        error?: string;
        savedTo?: { kind: "preview" | "file"; label: string } | null;
      };

      if (!res.ok) {
        setError(data?.error ?? "The agent request failed.");
        if (data?.usage) setUsage(data.usage);
        return;
      }

      setConversationId(data.conversationId);
      if (data.usage) setUsage(data.usage);
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: data.reply,
          created_at: new Date().toISOString(),
        },
      ]);
      setEvents(data.events ?? []);

      // The terminal keeps the real execution record for this project.
      setTranscript((prev) => [
        ...prev,
        ...(data.events ?? []).map((e) => ({
          at: e.at,
          text: e.message,
          tone: TONE_BY_EVENT[e.kind] ?? "info",
        })),
        ...(data.savedTo
          ? [
              {
                at: new Date().toISOString(),
                text:
                  data.savedTo.kind === "preview"
                    ? `[Saved] preview environment updated — ${data.savedTo.label}`
                    : `[Saved] file written — ${data.savedTo.label}`,
                tone: "info" as const,
              },
            ]
          : []),
      ]);

      if (data.savedTo) {
        showToast(
          data.savedTo.kind === "preview"
            ? "Preview environment updated."
            : `Saved ${data.savedTo.label}`
        );
        loadProject();
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Stopped. Any step the agent completed is kept.");
        return;
      }
      setError("Connection failed while the agent was working.");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function newTask() {
    setMessages([]);
    setEvents([]);
    setError(null);
    setConversationId(null);
  }

  async function pushToGit() {
    setPushing(true);
    try {
      const res = await fetch("/api/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: project.slug }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data?.error ?? "Push failed.");
        return;
      }
      const pushed = Array.isArray(data.pushed) ? data.pushed.length : 0;
      const failed = Array.isArray(data.failed) ? data.failed.length : 0;
      showToast(
        failed === 0
          ? `Pushed ${pushed} file${pushed === 1 ? "" : "s"} to ${data.repo}.`
          : `Pushed ${pushed}, ${failed} failed. Check the repository for the latest state.`
      );
    } catch {
      showToast("Connection failed while pushing to GitHub.");
    } finally {
      setPushing(false);
    }
  }

  /* ------------------------------------------------------------- render */

  const limitReached =
    !!usage && !usage.unlimited && usage.used >= usage.limit;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <header className="glass-bar glass-sheen flex shrink-0 flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
        <Link
          href={username ? `/${username}` : "/dashboard"}
          className="rounded-lg p-2 text-kore-muted transition-colors duration-150 hover:bg-white/[0.06] hover:text-white"
          aria-label="Back to your projects"
          title="All projects"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>

        <div className="min-w-0 flex-1">
          <h1
            className="truncate text-sm font-semibold tracking-tight text-white"
            title={project.name}
          >
            {project.name}
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[11px] text-kore-muted">
            <span className="truncate">/projects/{project.slug}</span>
            {project.github_repo && (
              <>
                <span aria-hidden className="text-kore-border">
                  ·
                </span>
                <Github className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">
                  {project.github_repo}
                  {project.github_branch ? ` @ ${project.github_branch}` : ""}
                </span>
              </>
            )}
          </p>
        </div>

        {project.github_repo && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.12, ease: EASE }}
            onClick={pushToGit}
            disabled={pushing}
            className="glass-interactive inline-flex shrink-0 items-center gap-1.5 rounded-full border border-kore-border px-3 py-2 font-mono text-[10px] text-kore-text disabled:opacity-60"
            title="Commit this project's files to GitHub"
          >
            {pushing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <UploadCloud className="h-3.5 w-3.5" aria-hidden />
            )}
            Push to Git
          </motion.button>
        )}
      </header>

      {loadError && (
        <p
          role="alert"
          className="shrink-0 border-b border-kore-danger/30 bg-kore-danger/10 px-4 py-2 text-xs text-red-300"
        >
          {loadError}
        </p>
      )}

      {/* Chat / environment switcher (small screens) */}
      <div
        className="glass-bar grid shrink-0 grid-cols-2 gap-1 p-1.5 xl:hidden"
        role="tablist"
        aria-label="Workspace panels"
      >
        {(
          [
            { id: "chat" as const, label: "Agent", icon: TerminalSquare },
            { id: "environment" as const, label: "Environment", icon: LayoutGrid },
            { id: "terminal" as const, label: "Terminal", icon: SquareTerminal },
          ] as const
        ).map((t) => {
          const active = panel === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setPanel(t.id)}
              className={cn(
                "relative flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-150",
                active ? "text-white" : "text-kore-muted hover:text-kore-text"
              )}
            >
              {active && (
                <motion.span
                  layoutId="workspace-panel"
                  className="absolute inset-0 rounded-lg bg-white/[0.09]"
                  transition={{ duration: 0.2, ease: EASE }}
                  aria-hidden
                />
              )}
              <span className="relative flex items-center gap-2">
                <t.icon className="h-3.5 w-3.5" aria-hidden />
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Panels */}
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-2 xl:gap-3 xl:p-3">
        {/* Agent */}
        <section
          aria-label="Agent conversation"
          className={cn(
            "flex min-h-0 flex-col xl:glass xl:glass-sheen xl:rounded-2xl",
            panel === "chat" ? "flex" : "hidden xl:flex"
          )}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-kore-border px-3 py-2">
            <p className="font-mono text-[10px] tracking-[0.2em] text-kore-muted">
              AGENT
            </p>
            {usage && (
              <span className="ml-auto font-mono text-[10px] text-kore-muted">
                {usage.unlimited
                  ? "unlimited"
                  : `${usage.used}/${usage.limit} today`}
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
            <ExecutionTerminal
              messages={messages}
              events={events}
              loading={loading}
              error={error}
              emptyHint={
                <div className="flex h-full items-center justify-center px-4 text-center">
                  <div className="max-w-sm">
                    <p className="font-mono text-[10px] tracking-[0.24em] text-kore-muted">
                      {project.name.toUpperCase()}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-kore-text">
                      Describe what this project should do. The agent writes real
                      files and a preview you can inspect, edit and push to Git.
                    </p>
                    <ul className="mt-4 space-y-1.5 text-left font-mono text-[11px] text-kore-muted">
                      <li>· Build a landing page for this project</li>
                      <li>· Explain the code in this project</li>
                      <li>· Generate an SVG logo and set it as the preview</li>
                    </ul>
                  </div>
                </div>
              }
            />
          </div>

          <ToolBar
            value={input}
            onChange={setInput}
            onSend={send}
            onStop={stop}
            onNew={newTask}
            loading={loading}
            limitReached={limitReached}
            mode={mode}
            onModeChange={setMode}
            model={model}
            models={models.map((m) => ({
              id: m.id,
              label: m.label,
              configured: m.configured,
            }))}
            onModelChange={setModel}
          />
        </section>

        {/* Environment */}
        <section
          aria-label="Project environment"
          className={cn(
            "flex min-h-0 flex-col xl:glass xl:glass-sheen xl:overflow-hidden xl:rounded-2xl",
            panel === "environment" ? "flex" : "hidden xl:flex"
          )}
        >
          <EnvironmentsPanel
            slug={project.slug}
            environments={environments}
            files={files}
            transcript={transcript}
            onChanged={loadProject}
          />
        </section>

        {/* Terminal */}
        <section
          aria-label="Project terminal"
          className={cn(
            "min-h-0 flex-col xl:col-span-2 xl:flex xl:h-80",
            panel === "terminal" ? "flex" : "hidden xl:flex"
          )}
        >
          <ProjectShell slug={project.slug} onFilesChanged={loadProject} className="h-full w-full" />
        </section>
      </div>

      {/* Toast */}
      {toast && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="glass glass-sheen fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 text-sm text-kore-text"
        >
          <CheckCircle2 className="h-4 w-4 text-white" aria-hidden />
          {toast}
        </motion.div>
      )}
    </div>
  );
}