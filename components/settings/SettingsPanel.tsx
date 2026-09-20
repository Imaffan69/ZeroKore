"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  User,
  Cpu,
  Github,
  Activity,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Link2,
  Unlink,
  Zap,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { fadeUp, staggerGroup } from "@/lib/motion";
import type {
  GitHubStatus,
  ProviderInfo,
  ProviderPreference,
  UsageState,
} from "@/types";
import { cn } from "@/lib/utils";

type TabId = "account" | "models" | "integrations" | "system";

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: "account", label: "Account", icon: User },
  { id: "models", label: "Models", icon: Cpu },
  { id: "integrations", label: "Integrations", icon: Github },
  { id: "system", label: "System", icon: Activity },
];

interface HealthData {
  database: string;
  authentication: string;
  models: ProviderInfo[];
  search: string;
  github: string;
  encryption: string;
}

export interface SettingsPanelProps {
  email: string;
  usage: UsageState | null;
  provider: string;
  providerFallback?: string;
  dbOk: boolean;
  preferredProvider: ProviderPreference;
  onProviderChange: (p: ProviderPreference) => void;
  onToast: (msg: string) => void;
}

function StatusRow({
  label,
  ok,
  detail,
  warn,
}: {
  label: string;
  ok: boolean;
  detail: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm text-kore-text">{label}</span>
      <span
        className={cn(
          "flex items-center gap-1.5 font-mono text-xs",
          ok ? "text-kore-accent" : warn ? "text-kore-warn" : "text-kore-muted"
        )}
      >
        {ok ? (
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <XCircle className="h-3.5 w-3.5" aria-hidden />
        )}
        {detail}
      </span>
    </div>
  );
}

export default function SettingsPanel({
  email,
  usage,
  provider,
  providerFallback,
  dbOk,
  preferredProvider,
  onProviderChange,
  onToast,
}: SettingsPanelProps) {
  const [tab, setTab] = useState<TabId>("account");
  const [health, setHealth] = useState<HealthData | null>(null);
  const [github, setGithub] = useState<GitHubStatus | null>(null);
  const [ghBusy, setGhBusy] = useState(false);

  const loadGithub = useCallback(async () => {
    try {
      const res = await fetch("/api/github");
      if (res.ok) {
        setGithub(await res.json());
      } else {
        setGithub({ configured: false, connected: false });
      }
    } catch {
      setGithub({ configured: false, connected: false });
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/health");
        if (res.ok) setHealth(await res.json());
      } catch {
        // Non-fatal: system tab shows unknown state.
      }
      loadGithub();
    })();
  }, [loadGithub]);

  async function connectGithub() {
    if (!github?.configured) {
      onToast(
        "GitHub OAuth is not configured server-side. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET."
      );
      return;
    }
    // Full-page redirect to GitHub's consent screen, which returns to
    // /api/github/oauth?code=... and then back to /dashboard.
    window.location.href = "/api/github/oauth";
  }

  async function disconnectGithub() {
    if (
      !window.confirm(
        "Disconnect your GitHub account? ZeroKore will delete its stored token."
      )
    ) {
      return;
    }
    setGhBusy(true);
    try {
      const res = await fetch("/api/github", { method: "DELETE" });
      if (res.ok) {
        onToast("GitHub disconnected.");
        setGithub({ configured: !!github?.configured, connected: false });
      } else {
        onToast("Could not disconnect GitHub.");
      }
    } catch {
      onToast("Connection failed.");
    } finally {
      setGhBusy(false);
    }
  }

  const models = health?.models ?? [];
  const anyConfigured = models.some((m) => m.configured);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-xl font-semibold tracking-tight text-white">
          Settings
        </h2>
        <p className="mt-1 max-w-lg text-sm leading-relaxed text-kore-muted">
          Manage your account, pick the AI model every task uses, and connect
          integrations. Secret keys stay on the server — this page never
          displays them.
        </p>

        {/* Tabs */}
        <div
          className="mt-5 flex gap-1.5 overflow-x-auto rounded-xl border border-kore-border bg-kore-bg/60 p-1.5"
          role="tablist"
          aria-label="Settings sections"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition",
                tab === t.id
                  ? "bg-kore-accent/10 text-kore-accent"
                  : "text-kore-muted hover:bg-white/[0.03] hover:text-white"
              )}
            >
              <t.icon className="h-4 w-4" aria-hidden />
              {t.label}
            </button>
          ))}
        </div>

        <motion.div
          key={tab}
          initial="hidden"
          animate="visible"
          variants={staggerGroup(0.04)}
          className="mt-5 space-y-3"
        >
          {/* ---------------- ACCOUNT ---------------- */}
          {tab === "account" && (
            <>
              <motion.section
                variants={fadeUp}
                className="glass glass-sheen rounded-2xl p-5"
              >
                <div className="mb-3 flex items-center gap-2">
                  <User className="h-4 w-4 text-kore-accent" aria-hidden />
                  <h3 className="font-semibold text-white">Account</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-kore-muted">Email</span>
                    <span className="break-all text-kore-text">
                      {email || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-kore-muted">Daily usage</span>
                    <span className="font-mono text-kore-text">
                      {usage
                        ? usage.unlimited
                          ? "Unlimited"
                          : `${usage.used} / ${usage.limit} requests`
                        : "Loading…"}
                    </span>
                  </div>
                </div>
              </motion.section>

              <motion.section
                variants={fadeUp}
                className="glass glass-sheen rounded-2xl p-5"
              >
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-kore-accent" aria-hidden />
                  <h3 className="font-semibold text-white">Security</h3>
                </div>
                <ul className="space-y-1.5 text-sm text-kore-muted">
                  <li>• Passwords are hashed by Supabase Auth — never visible to ZeroKore.</li>
                  <li>• API keys live only in server environment variables.</li>
                  <li>• Database rows are protected by row-level security per account.</li>
                </ul>
              </motion.section>
            </>
          )}

          {/* ---------------- MODELS ---------------- */}
          {tab === "models" && (
            <motion.section
              variants={fadeUp}
              className="glass glass-sheen rounded-2xl p-5"
            >
              <div className="mb-1 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-kore-accent" aria-hidden />
                <h3 className="font-semibold text-white">Default model</h3>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-kore-muted">
                Choose the AI provider your tasks run on — like switching models
                in a code assistant. <strong className="text-kore-text">Auto</strong>{" "}
                uses the fastest configured provider and falls back only when a
                provider is down. Picking a specific model keeps it pinned: if
                it fails, you get an error and can retry — no silent switching.
              </p>

              <div className="space-y-2" role="radiogroup" aria-label="AI model">
                <motion.button
                  whileHover={{ translateY: -1 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => onProviderChange("auto")}
                  aria-pressed={preferredProvider === "auto"}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition",
                    preferredProvider === "auto"
                      ? "border-kore-accent/60 bg-kore-accent/10"
                      : "border-kore-border hover:border-kore-accent/30 hover:bg-white/[0.02]"
                  )}
                >
                  <Zap
                    className={cn(
                      "h-4 w-4 shrink-0",
                      preferredProvider === "auto" ? "text-kore-accent" : "text-kore-muted"
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-kore-text">
                      Auto
                    </span>
                    <span className="block text-xs text-kore-muted">
                      Fastest configured provider, automatic fallback when busy
                    </span>
                  </span>
                  {preferredProvider === "auto" && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-kore-accent" aria-hidden />
                  )}
                </motion.button>

                {models.map((m) => (
                  <motion.button
                    key={m.id}
                    whileHover={{ translateY: -1 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      if (!m.configured) {
                        onToast(
                          `${m.id} has no API key on the server yet. Add its key to the environment, then select it here.`
                        );
                        return;
                      }
                      onProviderChange(m.id);
                    }}
                    aria-pressed={preferredProvider === m.id}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition",
                      preferredProvider === m.id
                        ? "border-kore-accent/60 bg-kore-accent/10"
                        : "border-kore-border hover:border-kore-accent/30 hover:bg-white/[0.02]",
                      !m.configured && "opacity-50"
                    )}
                  >
                    <Cpu
                      className={cn(
                        "h-4 w-4 shrink-0",
                        preferredProvider === m.id ? "text-kore-accent" : "text-kore-muted"
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-kore-text">
                        {m.id}
                      </span>
                      <span className="block truncate font-mono text-xs text-kore-muted">
                        {m.model}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-mono text-[10px] uppercase tracking-wider",
                        m.configured ? "text-kore-accent" : "text-kore-warn"
                      )}
                    >
                      {m.configured ? "● ready" : "○ no key"}
                    </span>
                    {preferredProvider === m.id && (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-kore-accent" aria-hidden />
                    )}
                  </motion.button>
                ))}

                {models.length === 0 && (
                  <div className="glass-subtle rounded-xl px-4 py-5 text-center text-sm text-kore-muted">
                    {health
                      ? "No models reported by the server."
                      : "Loading model catalog…"}
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {/* ---------------- INTEGRATIONS ---------------- */}
          {tab === "integrations" && (
            <motion.section
              variants={fadeUp}
              className="glass glass-sheen rounded-2xl p-5"
            >
              <div className="mb-1 flex items-center gap-2">
                <Github className="h-4 w-4 text-kore-accent" aria-hidden />
                <h3 className="font-semibold text-white">GitHub</h3>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-kore-muted">
                Connect your GitHub account with OAuth. ZeroKore stores the
                token server-side only — it is never sent to your browser.
                Requires <span className="font-mono text-kore-text">GITHUB_CLIENT_ID</span>{" "}
                and <span className="font-mono text-kore-text">GITHUB_CLIENT_SECRET</span>{" "}
                in the server environment.
              </p>

              {!github ? (
                <div className="flex items-center gap-2 text-sm text-kore-muted">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Checking connection…
                </div>
              ) : github.connected ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-2 rounded-full border border-kore-accent/50 bg-kore-accent/10 px-3 py-1.5 text-sm text-kore-accent">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    Connected{github.user ? ` as ${github.user}` : ""}
                  </span>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={disconnectGithub}
                    disabled={ghBusy}
                    className="flex items-center gap-1.5 rounded-full border border-kore-danger/40 px-3 py-1.5 text-sm text-red-300 transition hover:bg-kore-danger/10 disabled:opacity-50"
                  >
                    {ghBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Unlink className="h-3.5 w-3.5" aria-hidden />
                    )}
                    Disconnect
                  </motion.button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <motion.button
                      whileHover={{ translateY: -1 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={connectGithub}
                      className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/85"
                    >
                      <Link2 className="h-4 w-4" aria-hidden />
                      Connect GitHub
                    </motion.button>
                    <a
                      href="https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-1 text-xs text-kore-muted transition hover:text-kore-text"
                    >
                      OAuth app setup guide
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  </div>
                  {!github.configured && (
                    <div className="flex items-start gap-2 rounded-xl border border-kore-warn/40 bg-kore-warn/10 px-3 py-2.5 text-xs text-amber-200">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>
                        Not configured yet: add <span className="font-mono">GITHUB_CLIENT_ID</span>{" "}
                        and <span className="font-mono">GITHUB_CLIENT_SECRET</span> to the
                        server environment (Vercel → Settings → Environment Variables),
                        with the OAuth callback URL set to{" "}
                        <span className="font-mono">{"{your-domain}"}/api/github/oauth</span>.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </motion.section>
          )}

          {/* ---------------- SYSTEM ---------------- */}
          {tab === "system" && (
            <>
              <motion.section
                variants={fadeUp}
                className="glass glass-sheen rounded-2xl p-5"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-kore-accent" aria-hidden />
                  <h3 className="font-semibold text-white">System status</h3>
                </div>
                <div className="divide-y divide-kore-border/60">
                  <StatusRow
                    label="Workspace"
                    ok
                    detail="operational"
                  />
                  <StatusRow
                    label="Database (Supabase)"
                    ok={health ? health.database === "configured" : dbOk}
                    detail={
                      health
                        ? health.database === "configured"
                          ? "configured"
                          : "not configured"
                        : "checking…"
                    }
                  />
                  <StatusRow
                    label="Authentication"
                    ok={health ? health.authentication === "configured" : dbOk}
                    detail={
                      health
                        ? health.authentication === "configured"
                          ? "configured"
                          : "not configured"
                        : "checking…"
                    }
                  />
                  <StatusRow
                    label="Web search (Tavily)"
                    ok={health ? health.search === "configured" : false}
                    detail={health?.search ?? "checking…"}
                    warn
                  />
                  <StatusRow
                    label="GitHub OAuth"
                    ok={health ? health.github === "configured" : false}
                    detail={health?.github ?? "checking…"}
                    warn
                  />
                  <StatusRow
                    label="Project secrets (AES-256-GCM)"
                    ok={health ? health.encryption === "configured" : false}
                    detail={health?.encryption ?? "checking…"}
                    warn
                  />
                </div>
                {health?.encryption === "not configured" && (
                  <p className="mt-3 text-xs leading-relaxed text-kore-muted">
                    Add <span className="font-mono">ENCRYPTION_KEY</span> to the
                    server environment to store project secrets. Generate one with{" "}
                    <span className="font-mono">
                      node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;base64&apos;))&quot;
                    </span>
                    . Until then the Secrets environment reports that it is
                    unconfigured instead of storing values in plaintext.
                  </p>
                )}
              </motion.section>

              <motion.section
                variants={fadeUp}
                className="glass glass-sheen rounded-2xl p-5"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-kore-accent" aria-hidden />
                  <h3 className="font-semibold text-white">Active AI provider</h3>
                </div>
                <p className="font-mono text-sm text-kore-text">
                  {providerFallback ? `${providerFallback} → ` : ""}
                  {provider}
                </p>
                {!anyConfigured && (
                  <p className="mt-2 text-xs text-kore-warn">
                    No AI provider keys are set on the server yet — agent tasks
                    will return a configuration error until at least one key is
                    added.
                  </p>
                )}
                <p className="mt-3 text-xs leading-relaxed text-kore-muted">
                  Keys are read from server environment variables at request
                  time: <span className="font-mono">GROQ_API_KEY</span>,{" "}
                  <span className="font-mono">DEEPSEEK_API_KEY</span>,{" "}
                  <span className="font-mono">SAMBANOVA_API_KEY</span>,{" "}
                  <span className="font-mono">GEMINI_API_KEY</span>. Add them in
                  your hosting provider&apos;s dashboard — they are never
                  exposed to the browser.
                </p>
              </motion.section>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
