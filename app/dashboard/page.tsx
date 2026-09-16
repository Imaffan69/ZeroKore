"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Terminal, Trash2, CheckCircle2 } from "lucide-react";
import Sidebar, { type SidebarView } from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import ExecutionTerminal from "@/components/agent/ExecutionTerminal";
import ArtifactViewer from "@/components/agent/ArtifactViewer";
import DualPanelCanvas from "@/components/agent/DualPanelCanvas";
import ToolBar from "@/components/agent/ToolBar";
import CommandPalette from "@/components/CommandPalette";
import { ThemeSegmented } from "@/lib/theme";
import { APP_VERSION, APP_CODENAME, APP_BUILD_DATE, CHANGELOG } from "@/lib/version";
import { createClient } from "@/lib/supabase/client";
import type {
  AgentEvent,
  AgentMode,
  AgentResponseBody,
  Artifact,
  ChatMessage,
  Conversation,
  MemoryRecord,
  UsageState,
} from "@/types";

const SUGGESTIONS = [
  "Build a landing page",
  "Research vector databases",
  "Explain async/await",
  "Generate a logo SVG",
];

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
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
        }
      } catch {
        // Offline-tolerant: workspace still renders.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // --- Escape closes sidebar; Cmd/Ctrl+K toggles the command palette ---
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSidebarOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((p) => !p);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-kore-accent/40 bg-kore-bg shadow-glow">
        <Terminal className="h-6 w-6 text-kore-accent" aria-hidden />
      </span>
      <p className="font-mono text-sm tracking-widest text-kore-strong">
        ZERO <span className="text-kore-accent">KORE</span>
      </p>
      <p className="mt-1 text-xs text-kore-muted">
        Autonomous Intelligence Workspace
      </p>
      <p className="mb-5 mt-3 text-sm text-kore-text">
        Ready when you are. Choose a mode and start a task.
      </p>
      <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setInput(s);
              document.getElementById("kore-input")?.focus();
            }}
            className="rounded-lg border border-kore-border bg-kore-bg px-3 py-2.5 text-left text-sm text-kore-muted transition hover:border-kore-accent/50 hover:text-kore-strong"
          >
            {s}
          </button>
        ))}
      </div>
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
          onCommand={() => setPaletteOpen(true)}
          title={view === "workspace" ? activeTitle : view === "memory" ? "Memory" : "Settings"}
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
            />
          </>
        )}

        {view === "memory" && (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-2xl">
              <h2 className="mb-1 text-lg font-bold text-kore-strong">Long-term memory</h2>
              <p className="mb-4 text-sm text-kore-muted">
                Durable facts ZeroKore recalls across conversations. Scoped to
                your account only.
              </p>
              {memories.length === 0 ? (
                <p className="rounded-lg border border-dashed border-kore-border p-6 text-center text-sm text-kore-muted">
                  No saved memory yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {memories.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-start gap-2 rounded-lg border border-kore-border bg-kore-panel px-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0 flex-1 break-words text-kore-text">
                        {m.content}
                      </span>
                      <button
                        onClick={() => deleteMemory(m.id)}
                        className="rounded p-1.5 text-kore-muted transition hover:bg-kore-danger/20 hover:text-kore-danger"
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
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-2xl space-y-4">
              <div>
                <h2 className="mb-1 text-lg font-bold text-kore-strong">Settings</h2>
                <p className="text-sm text-kore-muted">
                  Safe preferences only. API secrets are never exposed here.
                </p>
              </div>
              <div className="rounded-lg border border-kore-border bg-kore-panel p-4 text-sm">
                <p className="mb-1 font-mono text-xs text-kore-muted">ACCOUNT</p>
                <p className="break-words text-kore-text">{email || "—"}</p>
              </div>
              <div className="rounded-lg border border-kore-border bg-kore-panel p-4 text-sm">
                <p className="mb-1 font-mono text-xs text-kore-muted">USAGE</p>
                <p className="text-kore-text">
                  {usage
                    ? usage.unlimited
                      ? "Unlimited (admin)"
                      : `${usage.used} / ${usage.limit} requests today`
                    : "Loading…"}
                </p>
              </div>
              <div className="rounded-lg border border-kore-border bg-kore-panel p-4 text-sm">
                <p className="mb-1 font-mono text-xs text-kore-muted">STATUS</p>
                <p className="text-kore-text">
                  Provider: {providerFallback ? `${providerFallback} → ` : ""}{provider}
                </p>
                <p className="text-kore-text">
                  Database: {dbOk ? "Connected" : "Unknown"}
                </p>
              </div>
              <div className="rounded-lg border border-kore-border bg-kore-panel p-4 text-sm">
                <p className="mb-2 font-mono text-xs text-kore-muted">APPEARANCE</p>
                <ThemeSegmented />
                <p className="mt-2 text-xs text-kore-muted">
                  Choose a theme, or follow your operating system automatically.
                </p>
              </div>
              <div className="rounded-lg border border-kore-accent/25 bg-kore-panel2 p-4 text-sm text-kore-muted">
                <p className="mb-1 font-mono text-xs text-kore-accent">SETUP NOTE</p>
                <p>
                  AI providers and web search are configured server-side via
                  environment variables (see .env.example). Missing optional
                  keys degrade gracefully — the agent tells you instead of
                  faking results.
                </p>
              </div>

              {/* About / version */}
              <div className="rounded-lg border border-kore-border bg-kore-panel p-4 text-sm">
                <p className="mb-2 font-mono text-xs text-kore-muted">ABOUT</p>
                <p className="text-kore-strong">
                  ZeroKore <span className="font-mono text-kore-accent">v{APP_VERSION}</span>{" "}
                  <span className="text-kore-muted">· {APP_CODENAME}</span>
                </p>
                <p className="mb-3 text-xs text-kore-muted">Build {APP_BUILD_DATE}</p>
                <div className="space-y-3 border-t border-kore-border pt-3">
                  {CHANGELOG.map((entry) => (
                    <div key={entry.version}>
                      <p className="font-mono text-xs text-kore-strong">
                        v{entry.version}
                        <span className="ml-2 font-sans font-normal text-kore-muted">
                          {entry.title}
                        </span>
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {entry.notes.map((n) => (
                          <li
                            key={n}
                            className="flex gap-1.5 text-xs text-kore-muted"
                          >
                            <span className="text-kore-accent" aria-hidden>
                              ·
                            </span>
                            <span>{n}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNewTask={newTask}
        onGoWorkspace={() => changeView("workspace")}
        onGoMemory={() => changeView("memory")}
        onGoSettings={() => changeView("settings")}
        onMode={setMode}
        onLogout={logout}
      />

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-kore-accent/40 bg-kore-panel px-4 py-2.5 text-sm text-kore-text shadow-panel"
        >
          <CheckCircle2 className="h-4 w-4 text-kore-accent" aria-hidden />
          {toast}
        </div>
      )}
    </>
  );
}
