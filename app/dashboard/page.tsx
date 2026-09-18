"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Terminal,
  Trash2,
  CheckCircle2,
  Code2,
  Search,
  BookOpen,
  PenTool,
  ArrowRight,
  BrainCircuit,
  Github,
  FolderPlus,
  FolderOpen,
} from "lucide-react";
import Sidebar, { type SidebarView } from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import SkillsPanel from "@/components/skills/SkillsPanel";
import SettingsPanel from "@/components/settings/SettingsPanel";
import ExecutionTerminal from "@/components/agent/ExecutionTerminal";
import ArtifactViewer from "@/components/agent/ArtifactViewer";
import DualPanelCanvas from "@/components/agent/DualPanelCanvas";
import ToolBar from "@/components/agent/ToolBar";
import { createClient } from "@/lib/supabase/client";
import {
  loadPreferences,
  savePreferences,
  DEFAULT_PREFERENCES,
} from "@/lib/preferences";
import { EASE, fadeUp, staggerGroup, hoverLift, press } from "@/lib/motion";
import type {
  AgentEvent,
  AgentMode,
  AgentResponseBody,
  Artifact,
  ChatMessage,
  Conversation,
  MemoryRecord,
  ProviderInfo,
  ProviderPreference,
  UsageState,
} from "@/types";

const VIEW_TITLE: Record<Exclude<SidebarView, "workspace">, string> = {
  skills: "Skills",
  memory: "Memory",
  settings: "Settings",
};

const SUGGESTIONS = [
  {
    icon: Code2,
    label: "Build a landing page",
    prompt: "Build a responsive landing page for a developer tool",
  },
  {
    icon: Search,
    label: "Research a topic",
    prompt: "Research vector databases and compare the top options",
  },
  {
    icon: BookOpen,
    label: "Explain some code",
    prompt: "Explain how async/await works with a small example",
  },
  {
    icon: PenTool,
    label: "Generate a graphic",
    prompt: "Generate a minimal SVG logo for a terminal app",
  },
];

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<SidebarView>("workspace");

  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<AgentMode>("coding");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState("New Task");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [provider, setProvider] = useState("Groq");
  const [providerFallback, setProviderFallback] = useState<string | undefined>();
  const [dbOk, setDbOk] = useState(false);
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [modelCatalog, setModelCatalog] = useState<ProviderInfo[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<string>("");
  inputRef.current = input;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  // --- Initial load: session, conversations, usage, health ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }
        if (cancelled) return;
        setEmail(user.email ?? "");
        setDbOk(true);
      } catch {
        if (!cancelled) setDbOk(false);
      }
      try {
        const [cRes, uRes, hRes] = await Promise.all([
          fetch("/api/conversations"),
          fetch("/api/usage"),
          fetch("/api/health"),
        ]);
        if (cancelled) return;
        if (cRes.ok) {
          const data = await cRes.json();
          setConversations(data.conversations ?? []);
        }
        if (uRes.ok) {
          const data = await uRes.json();
          setUsage(data.usage ?? null);
        }
        if (hRes.ok) {
          const data = await hRes.json();
          setDbOk(data.database === "configured");
          if (Array.isArray(data.providers) && data.providers[0] && data.providers[0] !== "none configured") {
            setProvider(data.providers[0]);
          }
          if (Array.isArray(data.models)) setModelCatalog(data.models as ProviderInfo[]);
        }
      } catch {
        // Offline-tolerant: workspace still renders.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // --- Escape closes sidebar ---
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSidebarOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- Load persisted preferences (project name, pinned model, motion) ---
  useEffect(() => {
    setPreferences(loadPreferences());
  }, []);

  const updatePreferences = useCallback(
    (patch: Partial<typeof DEFAULT_PREFERENCES>) => {
      setPreferences((prev) => {
        const nextPrefs = { ...prev, ...patch };
        savePreferences(nextPrefs);
        return nextPrefs;
      });
    },
    []
  );

  const refreshUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        const data = await res.json();
        setUsage(data.usage ?? null);
      }
    } catch {
      // Non-fatal.
    }
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } catch {
      // Non-fatal.
    }
  }, []);

  // --- Send ---
  async function send() {
    const text = inputRef.current.trim();
    if (!text || loading) return;
    if (usage && !usage.unlimited && usage.used >= usage.limit) {
      setError("Daily AI request limit reached (15/15). Resets tomorrow.");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setEvents([]);
    setInput("");

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId: activeId,
          mode,
          provider: preferences.preferredProvider,
        }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 429) {
          setError(
            typeof data?.error === "string"
              ? data.error
              : "Daily AI request limit reached."
          );
          if (data?.usage) setUsage(data.usage);
        } else if (res.status === 401) {
          router.push("/login");
          return;
        } else {
          setError(
            typeof data?.error === "string"
              ? data.error
              : "Request failed. Please try again."
          );
        }
        return;
      }

      const body = data as AgentResponseBody;
      setEvents(body.events ?? []);
      if (body.artifact) setArtifact(body.artifact);
      if (body.provider) setProvider(body.provider);
      setProviderFallback(body.fallbackFrom);
      if (body.usage) setUsage(body.usage);
      else refreshUsage();

      const asst: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: body.reply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, asst]);
      setActiveId(body.conversationId);
      setActiveTitle(body.conversationTitle || "New Conversation");
      refreshConversations();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setEvents((prev) => [
          ...prev,
          {
            kind: "error",
            message: "[Stopped] Request cancelled. Kept received content.",
            at: new Date().toISOString(),
          },
        ]);
      } else {
        setError("Connection failed. Your conversation is preserved — retry when ready.");
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  // --- New task ---
  function newTask() {
    stop();
    setActiveId(null);
    setActiveTitle("New Task");
    setMessages([]);
    setEvents([]);
    setArtifact(null);
    setError(null);
    setView("workspace");
    setTimeout(() => {
      document.getElementById("kore-input")?.focus();
    }, 50);
  }

  // --- Open conversation ---
  async function openConversation(id: string) {
    if (loading) return;
    setError(null);
    setEvents([]);
    setArtifact(null);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) {
        setError("Could not load that conversation.");
        return;
      }
      const data = await res.json();
      setActiveId(id);
      setActiveTitle(data.conversation?.title ?? "Conversation");
      setMessages((data.messages ?? []) as ChatMessage[]);
      setView("workspace");
    } catch {
      setError("Connection failed while loading the conversation.");
    }
  }

  // --- Delete conversation (confirm first) ---
  async function deleteConversation(id: string) {
    const target = conversations.find((c) => c.id === id);
    if (!window.confirm(`Delete "${target?.title ?? "this conversation"}"? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        showToast("Could not delete conversation.");
        return;
      }
      showToast("Conversation deleted.");
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) newTask();
    } catch {
      showToast("Connection failed.");
    }
  }

  // --- Memory view ---
  async function loadMemories() {
    try {
      const res = await fetch("/api/memory");
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories ?? []);
      }
    } catch {
      // Non-fatal.
    }
  }

  async function deleteMemory(id: string) {
    try {
      const res = await fetch("/api/memory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
        showToast("Memory deleted.");
      }
    } catch {
      showToast("Connection failed.");
    }
  }

  function changeView(v: SidebarView) {
    setView(v);
    if (v === "memory") loadMemories();
    if (v === "workspace") setView("workspace");
  }

  // --- Logout ---
  async function logout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Continue to login regardless.
    }
    router.push("/login");
    router.refresh();
  }

  const limitReached =
    !!usage && !usage.unlimited && usage.used >= usage.limit;

  const emptyHint = (
    <div className="flex h-full flex-col items-center justify-center py-10 text-center">
      <motion.span
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="glass glass-sheen mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
      >
        <Terminal className="h-5 w-5 text-kore-accent" aria-hidden />
      </motion.span>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE, delay: 0.06 }}
      >
        <p className="font-mono text-sm tracking-[0.18em] text-white">
          ZERO<span className="text-kore-accent">KORE</span>
        </p>
        <p className="mt-1.5 text-xs text-kore-muted">
          Autonomous intelligence workspace
        </p>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-kore-text">
          Nothing running yet. Pick a mode above, then describe what you want
          built, fixed, or researched.
        </p>
      </motion.div>

        {/* Freebuff-style primary actions */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerGroup(0.07, 0.22)}
        className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-3"
      >
        {[
          {
            icon: FolderPlus,
            label: "Start a project",
            desc: "Describe something new to build",
            onClick: () => {
              setInput("");
              document.getElementById("kore-input")?.focus();
            },
          },
          {
            icon: FolderOpen,
            label: "Continue a project",
            desc: "Pick up where you left off",
            onClick: () => {
              setView("workspace");
              if (conversations.length > 0) openConversation(conversations[0].id);
              else document.getElementById("kore-input")?.focus();
            },
          },
          {
            icon: Github,
            label: "Connect GitHub",
            desc: "Sync repos, commits and PRs",
            onClick: () => {
              setView("settings");
            },
          },
        ].map((a) => (
          <motion.button
            key={a.label}
            variants={fadeUp}
            whileHover={hoverLift}
            whileTap={press}
            transition={{ duration: 0.18, ease: EASE }}
            onClick={a.onClick}
            className="glass glass-sheen glass-interactive flex flex-col items-start gap-1.5 rounded-2xl px-4 py-3.5 text-left"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-kore-border bg-white/[0.04]">
              <a.icon className="h-4 w-4 text-white" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-white">{a.label}</span>
            <span className="text-xs leading-snug text-kore-muted">{a.desc}</span>
          </motion.button>
        ))}
      </motion.div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerGroup(0.06, 0.3)}
        className="mt-6 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {SUGGESTIONS.map((s) => (
          <motion.button
            key={s.label}
            variants={fadeUp}
            whileHover={hoverLift}
            whileTap={press}
            transition={{ duration: 0.18, ease: EASE }}
            onClick={() => {
              setInput(s.prompt);
              document.getElementById("kore-input")?.focus();
            }}
            className="glass glass-sheen group flex items-start gap-3 rounded-xl px-3.5 py-3 text-left"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-kore-border bg-white/[0.03]">
              <s.icon className="h-3.5 w-3.5 text-kore-muted" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-kore-text">
                {s.label}
              </span>
              <span className="mt-0.5 block truncate text-xs text-kore-muted">
                {s.prompt}
              </span>
            </span>
            <ArrowRight
              className="mt-1 h-3.5 w-3.5 shrink-0 text-kore-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              aria-hidden
            />
          </motion.button>
        ))}
      </motion.div>
    </div>
  );

  return (
    <>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        mode={mode}
        onModeChange={setMode}
        conversations={conversations}
        activeId={activeId}
        onSelect={openConversation}
        onDelete={deleteConversation}
        onNew={newTask}
        usage={usage}
        provider={provider}
        providerFallback={providerFallback}
        dbOk={dbOk}
        email={email}
        view={view}
        onViewChange={changeView}
        onLogout={logout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onMenu={() => setSidebarOpen(true)}
          title={view === "workspace" ? activeTitle : VIEW_TITLE[view]}
          mode={mode}
          status={loading ? "loading" : error ? "error" : "idle"}
          provider={providerFallback ? `${providerFallback} → ${provider}` : provider}
        />

        {view === "workspace" && (
          <>
            <DualPanelCanvas
              hasArtifact={!!artifact}
              execution={
                <ExecutionTerminal
                  messages={messages}
                  events={events}
                  loading={loading}
                  error={error}
                  emptyHint={emptyHint}
                />
              }
              artifact={<ArtifactViewer artifact={artifact} />}
            />
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
              model={preferences.preferredProvider}
              models={modelCatalog.map((m) => ({ id: m.id, label: m.label, configured: m.configured }))}
              onModelChange={(m) => {
                updatePreferences({ preferredProvider: m as ProviderPreference });
                showToast(
                  m === "auto"
                    ? "Model set to Auto (fastest available)."
                    : `Model set to ${m}.`
                );
              }}
            />
          </>
        )}

        {view === "skills" && (
          <SkillsPanel
            onUseSkill={(name) => {
              setInput(`/${name} `);
              setView("workspace");
              setTimeout(() => {
                document.getElementById("kore-input")?.focus();
              }, 50);
            }}
          />
        )}

        {view === "memory" && (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-2xl">
              <h2 className="mb-1.5 text-lg font-semibold tracking-tight text-white">
                Long-term memory
              </h2>
              <p className="mb-5 text-sm leading-relaxed text-kore-muted">
                Facts ZeroKore recalls across conversations, scoped to your
                account. Delete anything you don&apos;t want kept.
              </p>
              {memories.length === 0 ? (
                <div className="glass-subtle rounded-xl px-6 py-8 text-center">
                  <BrainCircuit
                    className="mx-auto mb-3 h-5 w-5 text-kore-muted"
                    aria-hidden
                  />
                  <p className="text-sm text-kore-text">No memories yet</p>
                  <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-kore-muted">
                    As you work, ZeroKore will save durable preferences and
                    project context here. It stays private to your account.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {memories.map((m) => (
                    <li
                      key={m.id}
                      className="glass glass-interactive glass-sheen flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0 flex-1 break-words text-kore-text">
                        {m.content}
                      </span>
                      <button
                        onClick={() => deleteMemory(m.id)}
                        className="rounded p-1.5 text-kore-muted transition hover:bg-kore-danger/20 hover:text-red-300"
                        aria-label="Delete memory"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {view === "settings" && (
          <SettingsPanel
            email={email}
            usage={usage}
            provider={providerFallback ? `${providerFallback} → ${provider}` : provider}
            providerFallback={providerFallback}
            dbOk={dbOk}
            preferredProvider={preferences.preferredProvider}
            onProviderChange={(p: ProviderPreference) => {
              updatePreferences({ preferredProvider: p });
              showToast(
                p === "auto"
                  ? "Model set to Auto (fastest available)."
                  : `Default model set to ${p}.`
              );
            }}
            onToast={showToast}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="glass glass-sheen fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 text-sm text-kore-text"
        >
          <CheckCircle2 className="h-4 w-4 text-kore-accent" aria-hidden />
          {toast}
        </div>
      )}
    </>
  );
}