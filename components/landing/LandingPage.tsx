"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Terminal,
  Code2,
  Search,
  BrainCircuit,
  Layers,
  ShieldCheck,
  Zap,
  ArrowRight,
  Check,
  GitBranch,
  Command,
  FileCode2,
  Boxes,
  Cpu,
  Sparkles,
  Lock,
  ListTree,
} from "lucide-react";
import {
  EASE,
  fadeUp,
  fadeIn,
  staggerGroup,
  viewportOnce,
} from "@/lib/motion";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Static content — hoisted out of the component (rerender/hoist rule)  */
/* ------------------------------------------------------------------ */

const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "Agents", href: "#agents" },
  { label: "Security", href: "#security" },
  { label: "Pricing", href: "#cta" },
];

const PROVIDERS = ["Groq", "DeepSeek", "SambaNova", "Gemini"];

const STATS = [
  { value: "4", label: "Model providers in cascade" },
  { value: "8", label: "Bounded tool iterations" },
  { value: "RLS", label: "On every user-owned table" },
  { value: "0", label: "Secrets shipped to browser" },
];

const FEATURES = [
  {
    icon: Code2,
    title: "Coding agent",
    desc: "Reads the full file before editing, makes minimal targeted patches, then validates. Produces reviewable diffs instead of blind snippets.",
    span: "lg:col-span-2",
  },
  {
    icon: Search,
    title: "Grounded research",
    desc: "Web search runs as a separate tool with cited sources, so retrieved facts stay distinguishable from model reasoning.",
    span: "",
  },
  {
    icon: BrainCircuit,
    title: "Persistent memory",
    desc: "User- and project-scoped semantic recall over pgvector. Inspect, edit, or delete anything the agent remembers.",
    span: "",
  },
  {
    icon: Layers,
    title: "Bounded tool runtime",
    desc: "Every tool call is schema-validated, authorised, timed out, and capped — no uncontrolled autonomous loops.",
    span: "",
  },
  {
    icon: GitBranch,
    title: "Git & GitHub",
    desc: "Status, branches, diffs, commits and pull requests through a server-side integration with least-privilege scopes.",
    span: "",
  },
  {
    icon: Boxes,
    title: "Artifacts & previews",
    desc: "Code, HTML, SVG and Markdown normalised into one model, rendered in a sandboxed frame you can copy or export.",
    span: "lg:col-span-2",
  },
];

const MODES = [
  { icon: Code2, label: "Coding" },
  { icon: Search, label: "Research" },
  { icon: Sparkles, label: "General" },
  { icon: ListTree, label: "Planning" },
  { icon: FileCode2, label: "Docs" },
  { icon: Command, label: "Debug" },
  { icon: Boxes, label: "Project" },
];

const STEPS = [
  {
    n: "01",
    title: "Describe the task",
    body: "Pick a mode and a model. Nothing switches behind your back if a provider is down — you get a clear error and a retry path.",
  },
  {
    n: "02",
    title: "The agent plans and acts",
    body: "It inspects context, recalls memory, plans, selects tools, edits files, runs commands and revises on failure — all visibly.",
  },
  {
    n: "03",
    title: "You review and ship",
    body: "Inspect the diff, the test output and the artifact. Commit, push or open a pull request only when you ask for it.",
  },
];

const HERO_EVENTS = [
  { kind: "start", text: "[Agent Started]  mode=coding" },
  { kind: "mem", text: "[Memory Retrieved]  3 records" },
  { kind: "tool", text: "[Tool Call]  read_file  src/app/page.tsx" },
  { kind: "tool", text: "[Tool Call]  edit_file  minimal patch (12 lines)" },
  { kind: "run", text: "[Terminal]  bun test   ▸ 18 passed" },
  { kind: "done", text: "[Completed]  diff ready for review" },
] as const;

const EVENT_COLOR: Record<(typeof HERO_EVENTS)[number]["kind"], string> = {
  start: "text-white",
  mem: "text-sky-300",
  tool: "text-amber-200",
  run: "text-violet-200",
  done: "text-white",
};

/* ------------------------------------------------------------------ */
/* Section: hero product mock                                          */
/* ------------------------------------------------------------------ */

function WorkspaceMock() {
  return (
    <div className="glass glass-sheen relative overflow-hidden rounded-2xl">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-kore-border px-3.5 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        </span>
        <p className="ml-1 truncate font-mono text-[11px] text-kore-muted">
          zerokore / dashboard
        </p>
        <span className="glass-subtle ml-auto hidden items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] text-kore-muted sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
          READY
        </span>
      </div>

      <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        {/* Execution column */}
        <div className="border-kore-border px-3.5 py-3.5 sm:border-r">
          <p className="mb-2.5 font-mono text-[10px] tracking-[0.2em] text-kore-muted">
            EXECUTION
          </p>
          <div className="space-y-1.5 font-mono text-[11px] leading-relaxed">
            {HERO_EVENTS.map((e, i) => (
              <motion.div
                key={e.text}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, ease: EASE, delay: 0.5 + i * 0.09 }}
                className={cn("truncate", EVENT_COLOR[e.kind])}
              >
                {e.text}
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 1.15 }}
              className="flex items-center gap-2 pt-1.5 text-kore-muted"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
              awaiting your instruction
              <span className="kore-caret">▊</span>
            </motion.div>
          </div>
        </div>

        {/* Artifact column */}
        <div className="border-t border-kore-border px-3.5 py-3.5 sm:border-t-0">
          <div className="mb-2.5 flex items-center gap-2">
            <FileCode2 className="h-3.5 w-3.5 text-kore-muted" aria-hidden />
            <p className="truncate font-mono text-[11px] text-kore-text">
              landing.html
            </p>
            <span className="ml-auto font-mono text-[10px] text-kore-muted">
              artifact
            </span>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 1.25 }}
            className="glass-subtle overflow-hidden rounded-lg"
          >
            <div className="flex gap-1 border-b border-kore-border px-2 py-1.5">
              {["edit", "split", "diff"].map((t, i) => (
                <span
                  key={t}
                  className={cn(
                    "rounded px-1.5 py-0.5 font-mono text-[10px]",
                    i === 2
                      ? "bg-white/10 text-white"
                      : "text-kore-muted"
                  )}
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="space-y-1 p-2 font-mono text-[10px] leading-relaxed">
              <p className="text-white">+ add sandboxed preview frame</p>
              <p className="text-white">+ cap tool loop at 8 iterations</p>
              <p className="text-red-300/80">- render generated HTML inline</p>
              <p className="text-kore-muted">  (unsafe — removed)</p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-kore-bg text-kore-text">
      {/* Ambient backdrop */}
      <div
        className="kore-grid-bg pointer-events-none fixed inset-0 z-0"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed left-1/2 top-[-18rem] z-0 h-[36rem] w-[52rem] -translate-x-1/2 rounded-full bg-kore-accent/[0.07] blur-[140px]"
        aria-hidden
      />

      {/* ---------------------------------------------------------- Nav */}
      <header className="glass-bar sticky top-0 z-40">
        <nav
          className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3.5 sm:px-8"
          aria-label="Main"
        >
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="glass flex h-8 w-8 items-center justify-center rounded-lg">
              <Terminal className="h-4 w-4 text-kore-accent" aria-hidden />
            </span>
            <span className="font-mono text-sm font-bold tracking-[0.18em]">
              ZERO<span className="text-kore-accent">KORE</span>
            </span>
          </Link>

          <div className="ml-4 hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="rounded-md px-3 py-1.5 text-sm text-kore-muted transition-colors duration-150 hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm text-kore-muted transition-colors duration-150 hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="group inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              Get started
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative z-10">
        {/* -------------------------------------------------------- Hero */}
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 sm:px-8 sm:pt-24">
          <motion.div
            variants={staggerGroup(0.08)}
            initial="hidden"
            animate="visible"
            className="mx-auto max-w-3xl text-center"
          >
            <motion.div variants={fadeUp} className="mb-6 inline-flex">
              <span className="glass-subtle inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-kore-muted">
                <span className="relative flex h-1.5 w-1.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-kore-accent opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-kore-accent" />
                </span>
                Autonomous agentic development workspace
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-white sm:text-6xl"
            >
              An AI engineering environment
              <br className="hidden sm:block" />{" "}
              <span className="text-kore-muted">that shows its work.</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-kore-muted sm:text-lg"
            >
              Inspect repositories, edit real files, run commands, review diffs
              and keep project-aware memory — across a four-provider model
              cascade, with every action visible and reversible.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Link
                href="/signup"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
              >
                Start building free
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
              <Link
                href="/login"
                className="glass glass-interactive inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-kore-text hover:text-white sm:w-auto"
              >
                Log in to workspace
              </Link>
            </motion.div>

            <motion.p
              variants={fadeIn}
              className="mt-5 font-mono text-[11px] tracking-wide text-kore-muted"
            >
              No credit card · 15 AI requests/day free
            </motion.p>
          </motion.div>

          {/* Product mock */}
          <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.25 }}
            className="mx-auto mt-14 max-w-4xl"
          >
            <WorkspaceMock />
          </motion.div>
        </section>

        {/* --------------------------------------------- Provider strip */}
        <section
          className="mx-auto max-w-6xl px-5 pb-16 sm:px-8"
          aria-label="Model providers"
        >
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="flex flex-col items-center gap-4 border-y border-kore-border py-7"
          >
            <p className="font-mono text-[10px] tracking-[0.22em] text-kore-muted">
              MODEL CASCADE
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
              {PROVIDERS.map((p, i) => (
                <span key={p} className="flex items-center gap-3">
                  <span className="font-mono text-sm text-kore-text">{p}</span>
                  {i < PROVIDERS.length - 1 ? (
                    <span className="text-kore-muted" aria-hidden>
                      →
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
            <p className="max-w-md text-center text-xs leading-relaxed text-kore-muted">
              Ordered fallback, never silent substitution — if your selected
              provider fails you get a clear error and a retry path.
            </p>
          </motion.div>
        </section>

        {/* ------------------------------------------------------- Stats */}
        <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
          <motion.dl
            variants={staggerGroup(0.07)}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-kore-border bg-kore-border lg:grid-cols-4"
          >
            {STATS.map((s) => (
              <motion.div
                key={s.label}
                variants={fadeUp}
                className="bg-kore-bg px-5 py-6 text-center sm:text-left"
              >
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="block font-mono text-2xl font-semibold text-white">
                    {s.value}
                  </span>
                  <span className="mt-1.5 block text-xs leading-relaxed text-kore-muted">
                    {s.label}
                  </span>
                </dd>
              </motion.div>
            ))}
          </motion.dl>
        </section>

        {/* ---------------------------------------------------- Features */}
        <section
          id="product"
          className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-24 sm:px-8"
        >
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="mb-10 max-w-2xl"
          >
            <p className="mb-3 font-mono text-[10px] tracking-[0.22em] text-kore-accent">
              CAPABILITIES
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
              Everything a serious agent needs, nothing it doesn&apos;t.
            </h2>
            <p className="mt-4 text-pretty text-base leading-relaxed text-kore-muted">
              Each subsystem is isolated behind a typed service boundary, so the
              runtime, the dashboard and the providers can evolve independently.
            </p>
          </motion.div>

          <motion.div
            variants={staggerGroup(0.06)}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {FEATURES.map((f) => (
              <motion.article
                key={f.title}
                variants={fadeUp}
                className={cn(
                  "glass glass-sheen glass-interactive rounded-2xl p-5",
                  f.span
                )}
              >
                <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-kore-border bg-white/[0.03]">
                  <f.icon className="h-4 w-4 text-kore-accent" aria-hidden />
                </span>
                <h3 className="text-sm font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-kore-muted">
                  {f.desc}
                </p>
              </motion.article>
            ))}
          </motion.div>
        </section>

        {/* ---------------------------------------------- How it works */}
        <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
          <motion.div
            variants={staggerGroup(0.08)}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="grid gap-8 lg:grid-cols-3"
          >
            {STEPS.map((s) => (
              <motion.div key={s.n} variants={fadeUp}>
                <span className="font-mono text-xs text-kore-accent">{s.n}</span>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-white">
                  {s.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-kore-muted">
                  {s.body}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ------------------------------------------------ Agent modes */}
        <section
          id="agents"
          className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-24 sm:px-8"
        >
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="glass glass-sheen overflow-hidden rounded-2xl"
          >
            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
              <div>
                <p className="mb-3 font-mono text-[10px] tracking-[0.22em] text-kore-accent">
                  AGENT MODES
                </p>
                <h2 className="text-balance text-2xl font-semibold tracking-[-0.02em] text-white sm:text-3xl">
                  One runtime, tuned per kind of work.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-kore-muted">
                  Every mode shares the same bounded loop — understand, plan,
                  act, observe, validate, revise — but changes the toolset and
                  the context it reads first.
                </p>
              </div>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3">
                {MODES.map((m, i) => (
                  <motion.li
                    key={m.label}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={viewportOnce}
                    transition={{ duration: 0.35, ease: EASE, delay: i * 0.04 }}
                    className="glass-subtle flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-kore-text"
                  >
                    <m.icon className="h-3.5 w-3.5 shrink-0 text-kore-muted" aria-hidden />
                    <span className="truncate">{m.label}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>
        </section>

        {/* --------------------------------------------------- Security */}
        <section
          id="security"
          className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-24 sm:px-8"
        >
          <motion.div
            variants={staggerGroup(0.06)}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="grid gap-4 lg:grid-cols-3"
          >
            <motion.div
              variants={fadeUp}
              className="glass-accent glass-sheen rounded-2xl p-6 lg:col-span-2"
            >
              <ShieldCheck className="mb-4 h-6 w-6 text-kore-accent" aria-hidden />
              <h2 className="text-xl font-semibold tracking-tight text-white">
                Security is a server-side property here.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-kore-muted">
                Authorisation is enforced on the server, never in the client.
                Row-level security covers every user-owned table, usage limits
                are counted server-side, and provider keys plus the service-role
                key never enter a browser bundle.
              </p>
              <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {[
                  "RLS on all user-owned records",
                  "Schemas validated on every input",
                  "Generated HTML sandboxed, never inline",
                  "Support sessions scoped, logged, revocable",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-kore-text"
                  >
                    <Check
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-kore-accent"
                      aria-hidden
                    />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="glass glass-sheen flex flex-col justify-between rounded-2xl p-6"
            >
              <div>
                <Lock className="mb-4 h-6 w-6 text-kore-muted" aria-hidden />
                <h3 className="text-sm font-semibold text-white">
                  Honest by default
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-kore-muted">
                  If a provider, workspace, storage bucket or integration
                  isn&apos;t configured, ZeroKore says so. It never fakes a
                  successful commit, test run or deployment.
                </p>
              </div>
              <p className="mt-6 flex items-center gap-2 font-mono text-[11px] text-kore-muted">
                <Cpu className="h-3.5 w-3.5" aria-hidden />
                health checks surface real config state
              </p>
            </motion.div>
          </motion.div>
        </section>

        {/* -------------------------------------------------------- CTA */}
        <section
          id="cta"
          className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-24 sm:px-8"
        >
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="glass glass-sheen relative overflow-hidden rounded-3xl px-6 py-12 text-center sm:px-12 sm:py-16"
          >
            <div
              className="pointer-events-none absolute left-1/2 top-0 h-56 w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-kore-accent/[0.09] blur-[110px]"
              aria-hidden
            />
            <div className="relative">
              <Zap className="mx-auto mb-5 h-6 w-6 text-kore-accent" aria-hidden />
              <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
                Give your next task an environment, not a chat box.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-kore-muted">
                Create an account and run your first agent task in under a
                minute. Free tier includes 15 AI requests per day.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
                >
                  Create free account
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
                <Link
                  href="/login"
                  className="glass glass-interactive inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-kore-text hover:text-white sm:w-auto"
                >
                  I already have an account
                </Link>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      {/* ------------------------------------------------------ Footer */}
      <footer className="relative z-10 border-t border-kore-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:px-8 lg:flex-row lg:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <span className="glass flex h-8 w-8 items-center justify-center rounded-lg">
                <Terminal className="h-4 w-4 text-kore-accent" aria-hidden />
              </span>
              <span className="font-mono text-sm font-bold tracking-[0.18em]">
                ZERO<span className="text-kore-accent">KORE</span>
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-kore-muted">
              A production-grade agentic AI and cloud development workspace.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {[
              {
                title: "Product",
                links: [
                  { label: "Capabilities", href: "#product" },
                  { label: "Agent modes", href: "#agents" },
                  { label: "Security", href: "#security" },
                ],
              },
              {
                title: "Account",
                links: [
                  { label: "Log in", href: "/login" },
                  { label: "Sign up", href: "/signup" },
                  { label: "Dashboard", href: "/dashboard" },
                ],
              },
              {
                title: "Platform",
                links: [
                  { label: "Health", href: "/api/health" },
                  { label: "Status", href: "#security" },
                  { label: "Music", href: "/music" },
                ],
              },
              {
                title: "Legal",
                links: [
                  { label: "Terms of Service", href: "/terms" },
                  { label: "Privacy Policy", href: "/privacy" },
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <p className="mb-3 font-mono text-[10px] tracking-[0.2em] text-kore-muted">
                  {col.title.toUpperCase()}
                </p>
                <ul className="space-y-2">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-sm text-kore-muted transition-colors duration-150 hover:text-white"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-kore-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 font-mono text-[11px] text-kore-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p>© {new Date().getFullYear()} ZeroKore. All rights reserved.</p>
            <p>Autonomous intelligence workspace</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
