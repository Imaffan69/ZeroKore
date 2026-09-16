import Link from "next/link";
import {
  ArrowRight,
  Code2,
  Search,
  MessagesSquare,
  BrainCircuit,
  FileCode2,
  ShieldCheck,
  Layers,
  Zap,
  Github,
} from "lucide-react";
import { ThemeToggle } from "@/lib/theme";
import { APP_VERSION, APP_CODENAME } from "@/lib/version";

const FEATURES = [
  {
    icon: Code2,
    title: "Coding agent",
    body: "Generates runnable code and full pages, then renders them live in a sandboxed artifact preview.",
  },
  {
    icon: Search,
    title: "Research agent",
    body: "Grounded web research via Tavily with cited sources — it tells you when it can't verify something.",
  },
  {
    icon: BrainCircuit,
    title: "Long-term memory",
    body: "pgvector-backed recall scoped strictly to your account, so context carries across conversations.",
  },
  {
    icon: Layers,
    title: "Provider cascade",
    body: "Groq → DeepSeek → SambaNova → Gemini. Automatic failover keeps the workspace responsive.",
  },
  {
    icon: FileCode2,
    title: "Artifacts",
    body: "HTML, SVG, code, and markdown outputs open in a dedicated viewer with copy and preview.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    body: "Supabase Auth, Row Level Security, per-user scoping, and server-side secrets — never exposed.",
  },
];

const MODES = [
  { icon: Code2, label: "Coding" },
  { icon: Search, label: "Research" },
  { icon: MessagesSquare, label: "General" },
];

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-kore-bg text-kore-text">
      <div className="kore-grid-bg pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-kore-accent/20 blur-3xl"
        aria-hidden
      />

      {/* Nav */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-kore-accent/40 bg-kore-panel shadow-glow">
            <span className="font-mono text-sm font-bold text-kore-accent">Z</span>
          </span>
          <span className="font-mono text-sm font-bold tracking-widest text-kore-strong">
            ZERO<span className="text-kore-accent">KORE</span>
          </span>
        </div>
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-kore-muted transition hover:text-kore-strong sm:inline-block"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-kore-accent px-4 py-2 text-sm font-semibold text-kore-onAccent transition hover:bg-kore-accentDim"
          >
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-16 pt-14 text-center sm:px-6 sm:pt-20">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-kore-border bg-kore-panel/70 px-3 py-1 text-xs font-medium text-kore-muted kore-glass">
          <Zap className="h-3.5 w-3.5 text-kore-accent" aria-hidden />
          v{APP_VERSION} · {APP_CODENAME}
        </span>
        <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight text-kore-strong sm:text-6xl">
          The autonomous intelligence{" "}
          <span className="text-kore-accent">workspace</span>
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-base text-kore-muted sm:text-lg">
          A production-grade agentic AI platform. Write code, run research, and
          generate artifacts — with long-term memory and a professional, IDE-inspired interface.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-kore-accent px-6 py-3 text-sm font-semibold text-kore-onAccent transition hover:bg-kore-accentDim"
          >
            Start building
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-kore-border bg-kore-panel px-6 py-3 text-sm font-semibold text-kore-strong transition hover:border-kore-accent/50"
          >
            Login
          </Link>
        </div>

        {/* Mode chips */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {MODES.map((m) => (
            <span
              key={m.label}
              className="inline-flex items-center gap-1.5 rounded-lg border border-kore-border bg-kore-panel/70 px-3 py-1.5 text-sm text-kore-text kore-glass"
            >
              <m.icon className="h-4 w-4 text-kore-accent" aria-hidden />
              {m.label}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-kore-border bg-kore-panel p-5 shadow-panel transition hover:border-kore-accent/40"
            >
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-kore-accent/30 bg-kore-accent/10">
                <f.icon className="h-5 w-5 text-kore-accent" aria-hidden />
              </span>
              <h3 className="mb-1.5 text-base font-semibold text-kore-strong">
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed text-kore-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <div className="kore-glass flex flex-col items-center gap-4 rounded-3xl px-6 py-12 text-center shadow-panel">
          <h2 className="max-w-xl text-2xl font-bold tracking-tight text-kore-strong sm:text-3xl">
            Ready to put an autonomous agent to work?
          </h2>
          <p className="max-w-md text-sm text-kore-muted">
            Create a free account and start your first task in seconds.
          </p>
          <Link
            href="/signup"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-kore-accent px-6 py-3 text-sm font-semibold text-kore-onAccent transition hover:bg-kore-accentDim"
          >
            Create your account
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-kore-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-kore-muted sm:flex-row sm:px-6">
          <span className="font-mono">
            ZERO<span className="text-kore-accent">KORE</span> · v{APP_VERSION}{" "}
            {APP_CODENAME}
          </span>
          <span>Autonomous Intelligence Workspace</span>
        </div>
      </footer>
    </main>
  );
}
