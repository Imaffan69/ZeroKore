import Link from "next/link";
import {
  Terminal,
  Code2,
  Search,
  BrainCircuit,
  Layers,
  ShieldCheck,
  Zap,
  ArrowRight,
  Cpu,
} from "lucide-react";

const FEATURES = [
  {
    icon: Code2,
    title: "Coding Agent",
    desc: "Generate, debug, and explain code with artifact previews — code, HTML, SVG, and Markdown.",
  },
  {
    icon: Search,
    title: "Research Agent",
    desc: "Web-grounded answers with structured sources via Tavily when configured.",
  },
  {
    icon: BrainCircuit,
    title: "Long-term Memory",
    desc: "User-scoped vector memory with pgvector. Preferences and project context persist.",
  },
  {
    icon: Layers,
    title: "Tool Execution",
    desc: "Agentic loop with web search, memory tools, and artifact generation. Max 8 safe iterations.",
  },
  {
    icon: Zap,
    title: "Provider Cascade",
    desc: "Groq → DeepSeek → SambaNova → Gemini with automatic fallback. No single point of failure.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by Design",
    desc: "Supabase Auth, RLS on every table, server-side rate limits. Keys never reach the browser.",
  },
];

const PROVIDERS = ["GROQ", "DEEPSEEK", "SAMBANOVA", "GEMINI"];

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-kore-bg text-kore-text">
      {/* Animated backdrop */}
      <div className="kore-grid-bg pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-kore-accent/15 blur-[120px]"
        aria-hidden
      />

      {/* Nav */}
      <header className="glass-bar glass-sheen sticky top-0 z-10 mx-auto flex max-w-6xl items-center justify-between rounded-none border-x-0 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="glass flex h-9 w-9 items-center justify-center rounded-lg shadow-glow">
            <Terminal className="h-5 w-5 text-kore-accent" aria-hidden />
          </span>
          <span className="font-mono text-lg font-bold tracking-widest">
            ZERO<span className="text-kore-accent">KORE</span>
          </span>
        </div>
        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Account">
          <Link
            href="/login"
            className="glass glass-interactive rounded-full px-4 py-2 text-sm text-kore-text hover:border-kore-accent/60 hover:text-white sm:px-5"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="glass-interactive group flex items-center gap-1.5 rounded-full bg-kore-accent px-4 py-2 text-sm font-semibold text-black shadow-glow transition hover:bg-emerald-400 sm:px-5"
          >
            Sign Up
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-10 text-center sm:px-6 sm:pt-16">
        <div className="glass-accent mx-auto mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-xs text-kore-accent">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-kore-accent opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-kore-accent" />
          </span>
          AUTONOMOUS AGENTIC AI PLATFORM
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          Ship work with an AI that{" "}
          <span className="bg-gradient-to-r from-emerald-300 to-kore-accent bg-clip-text text-transparent">
            actually executes
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-kore-muted sm:text-lg">
          ZeroKore combines a coding agent, research agent, tool execution,
          web search, long-term vector memory, and artifact generation — behind
          a premium dark cyber-terminal interface.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="glass-interactive group flex w-full items-center justify-center gap-2 rounded-full bg-kore-accent px-7 py-3 font-semibold text-black shadow-glow transition hover:bg-emerald-400 sm:w-auto"
          >
            Start Building
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <Link
            href="/login"
            className="glass glass-interactive w-full rounded-full px-7 py-3 font-semibold text-kore-text hover:border-kore-accent/60 hover:text-white sm:w-auto"
          >
            Login to Workspace
          </Link>
        </div>

        {/* Provider strip */}
        <div className="mx-auto mt-10 flex max-w-2xl flex-wrap items-center justify-center gap-2 font-mono text-xs text-kore-muted">
          <Cpu className="h-4 w-4 text-kore-accent" aria-hidden />
          <span className="mr-1">CASCADE:</span>
          {PROVIDERS.map((p, i) => (
            <span key={p} className="flex items-center gap-2">
              <span className="glass-subtle rounded-full px-2.5 py-1 text-kore-text">
                ● {p}
              </span>
              {i < PROVIDERS.length - 1 && <span aria-hidden>→</span>}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-label="Features">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="glass glass-interactive glass-sheen rounded-2xl p-5 text-left"
            >
              <f.icon className="mb-3 h-6 w-6 text-kore-accent" aria-hidden />
              <h2 className="mb-1.5 font-semibold text-white">{f.title}</h2>
              <p className="text-sm leading-relaxed text-kore-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Security + footer */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-20 sm:px-6" aria-label="Security">
        <div className="glass-accent glass-sheen flex flex-col items-start gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:p-6">
          <ShieldCheck className="h-8 w-8 shrink-0 text-kore-accent" aria-hidden />
          <div>
            <h2 className="font-semibold text-white">Security statement</h2>
            <p className="mt-1 text-sm leading-relaxed text-kore-muted">
              Authentication via Supabase Auth. Row-level security on every
              user-owned table. Usage limits enforced server-side. Provider API
              keys and the service-role key never leave the server. Generated
              HTML renders only inside a sandboxed iframe.
            </p>
          </div>
        </div>
        <footer className="mt-10 text-center font-mono text-xs text-kore-muted">
          ZERO<span className="text-kore-accent">KORE</span> · AUTONOMOUS
          INTELLIGENCE WORKSPACE
        </footer>
      </section>
    </main>
  );
}