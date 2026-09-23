"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Boxes,
  Check,
  ChevronDown,
  Code2,
  Database,
  FileCode2,
  Github,
  KeyRound,
  Layers,
  Monitor,
  MousePointerClick,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import ParticleField from "@/components/visual/ParticleField";
import SavingsCalculator from "@/components/landing/SavingsCalculator";
import CreditsPerDay from "@/components/landing/CreditsPerDay";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The ZeroKore landing page.
 *
 * Full-height, full-bleed sections over a live particle field. Every claim here
 * describes something the product actually does; there are no decorative
 * buttons that lead nowhere.
 */

/* ---------------------------------------------------------------- reveal */

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] tracking-[0.28em] text-kore-muted">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------- nav */

const PRODUCTS = [
  { href: "/web", label: "Web", note: "Build apps in the browser" },
  { href: "/cloud", label: "Cloud", note: "Import any GitHub repo" },
  { href: "/chat", label: "Chat", note: "Talk to the agent" },
  { href: "/cli", label: "CLI", note: "Local terminal companion" },
] as const;

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "/pricing", label: "Pricing" },
    { href: "/earn", label: "Earn" },
    { href: "/blog", label: "Blog" },
  ];

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled ? "glass-bar" : "border-b border-transparent"
      )}
    >
      <div className="kore-shell flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="glass-subtle flex h-8 w-8 items-center justify-center rounded-xl">
            <Zap className="h-4 w-4 text-white" aria-hidden />
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">
            ZeroKore
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          <div
            className="relative"
            onMouseEnter={() => setProductsOpen(true)}
            onMouseLeave={() => setProductsOpen(false)}
          >
            <button
              type="button"
              aria-expanded={productsOpen}
              aria-haspopup="true"
              onClick={() => setProductsOpen((v) => !v)}
              onFocus={() => setProductsOpen(true)}
              className="flex items-center gap-1 rounded-full px-3.5 py-2 text-sm text-kore-muted transition-colors duration-150 hover:text-white"
            >
              Products
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", productsOpen && "rotate-180")}
                aria-hidden
              />
            </button>
            <AnimatePresence>
              {productsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.16, ease: EASE }}
                  className="glass glass-sheen absolute left-0 top-full z-50 mt-1 w-64 rounded-2xl p-2"
                >
                  {PRODUCTS.map((p) => (
                    <Link
                      key={p.label}
                      href={p.href}
                      onClick={() => setProductsOpen(false)}
                      className="block rounded-xl px-3.5 py-2.5 transition-colors hover:bg-white/8"
                    >
                      <span className="block text-sm font-medium text-white">{p.label}</span>
                      <span className="mt-0.5 block text-xs text-kore-muted">{p.note}</span>
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-3.5 py-2 text-sm text-kore-muted transition-colors duration-150 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm text-kore-muted transition-colors duration-150 hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/85"
          >
            Start building
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle menu"
          className="glass-subtle flex h-9 w-9 items-center justify-center rounded-xl md:hidden"
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="glass-bar overflow-hidden md:hidden"
          >
            <div className="kore-shell flex flex-col gap-1 py-3">
              <p className="px-3 pb-1 pt-1 font-mono text-[10px] tracking-[0.24em] text-kore-faint">
                PRODUCTS
              </p>
              {PRODUCTS.map((p) => (
                <Link
                  key={p.label}
                  href={p.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm text-kore-text"
                >
                  {p.label}
                  <span className="mt-0.5 block text-xs text-kore-muted">{p.note}</span>
                </Link>
              ))}
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm text-kore-text"
                >
                  {l.label}
                </Link>
              ))}
              <div className="mt-2 flex gap-2">
                <Link
                  href="/login"
                  className="glass-subtle flex-1 rounded-full px-4 py-2.5 text-center text-sm"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="flex-1 rounded-full bg-white px-4 py-2.5 text-center text-sm font-semibold text-black"
                >
                  Start building
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ------------------------------------------------------------------ hero */

const HERO_MARQUEE = [
  "Read the code",
  "Write the file",
  "Run the command",
  "Review the diff",
  "Push the branch",
  "Keep the memory",
];

function Hero({ totalUsers }: { totalUsers: number | null }) {
  return (
    <section className="kore-hero kore-noise">
      {/* Live particle field, behind everything and never interactive. */}
      <div className="pointer-events-none absolute inset-0">
        <ParticleField
          density={22}
          maxParticles={190}
          linkDistance={150}
          opacity={1}
        />
      </div>
      <div className="kore-ambient pointer-events-none absolute inset-0" aria-hidden />

      <div className="kore-shell relative z-10 grid items-center gap-10 pt-24 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="glass-subtle inline-flex items-center gap-2 rounded-full px-3.5 py-1.5"
        >
          <Sparkles className="h-3.5 w-3.5 text-kore-accent" aria-hidden />
          <span className="font-mono text-[10px] tracking-[0.2em] text-kore-text">
            AGENTIC DEVELOPMENT WORKSPACE
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.06 }}
          className="mt-6 max-w-4xl text-[clamp(2.6rem,7vw,5.2rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-white"
        >
          Your whole build,
          <br />
          <span className="bg-gradient-to-r from-[#b5cfa0] via-[#e8f3df] to-white bg-clip-text text-transparent">
            in one workspace.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.12 }}
          className="mt-6 max-w-2xl text-base leading-relaxed text-kore-body sm:text-lg"
        >
          Start a project from nothing, import any repository you own, then edit
          real files, run commands, review what changed and push it back to Git —
          with a four-model AI agent doing the heavy lifting beside you.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.18 }}
          className="mt-9 flex flex-wrap items-center gap-3"
        >
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 rounded-full bg-[#4ade80] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#b5cfa0]"
          >
            Start building free
            <ArrowRight
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
          <a
            href="#engine"
            className="glass glass-interactive inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-kore-text"
          >
            See what it does
          </a>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.26 }}
          className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-kore-muted"
        >
          {totalUsers !== null && totalUsers > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#4ade80]" aria-hidden />
              Join {totalUsers.toLocaleString()} builders already on ZeroKore
            </span>
          )}
          <span>
            No credit card · Your projects live at zerokore.vercel.app/&lt;you&gt;/&lt;project&gt;
          </span>
        </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.3 }}
          className="relative hidden lg:block"
        >
          <div className="glass overflow-hidden rounded-2xl text-left shadow-2xl shadow-black">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" aria-hidden />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" aria-hidden />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" aria-hidden />
              <span className="ml-3 hidden gap-1.5 sm:flex" role="tablist" aria-label="Workspace preview">
                {["Preview", "Code", "Terminal", "Changes"].map((t, i) => (
                  <span
                    key={t}
                    role="tab"
                    aria-selected={i === 0}
                    className={cn(
                      "rounded-full px-3 py-1 text-[11px]",
                      i === 0 ? "bg-[#b5cfa0]/20 text-[#e8f3df]" : "text-kore-muted"
                    )}
                  >
                    {t}
                  </span>
                ))}
              </span>
            </div>
            <div className="space-y-1.5 px-5 py-4 font-mono text-[12px] leading-relaxed">
              <p className="text-kore-muted">
                <span className="text-[#4ade80]">$</span> agent &quot;add a pricing section&quot;
              </p>
              <p className="text-kore-text">Read 6 files · mapped components/pricing</p>
              <p className="text-[#b5cfa0]">Edit pricing.tsx +48 −6 · saved</p>
              <p className="text-kore-text">Preview updated · pushed to main · 4f2a1de</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="kore-shell absolute inset-x-0 bottom-7 z-10 hidden sm:block"
      >
        <span className="font-mono text-[10px] tracking-[0.24em] text-kore-muted">
          SCROLL
        </span>
      </motion.div>
    </section>
  );
}

/** Repeating claim strip, the way the reference site does it. */
function Marquee() {
  const row = [...HERO_MARQUEE, ...HERO_MARQUEE];
  return (
    <section
      aria-label="What the agent does"
      className="relative border-y border-kore-border/70 py-5"
    >
      <div className="kore-marquee-mask overflow-hidden">
        <div className="kore-marquee gap-10 pr-10">
          {row.map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="flex shrink-0 items-center gap-10 whitespace-nowrap font-mono text-xs tracking-[0.18em] text-kore-muted"
            >
              {item}
              <span className="h-1 w-1 rounded-full bg-white/25" aria-hidden />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ---------------------------------------------------------------- engine */

const FEATURES = [
  {
    icon: FileCode2,
    title: "A real editor over real files",
    body: "Open, edit and save the project's actual files in a full code editor, with upload and download. Saving writes the bytes — there is no draft copy to forget about.",
  },
  {
    icon: Terminal,
    title: "A terminal that touches your code",
    body: "List, read, create, move, copy and delete the files in your project and get real output back. Commands act on the same files the editor writes, so what you see is what exists.",
  },
  {
    icon: Monitor,
    title: "A dev server with its own URL",
    body: "Every project can be served as a live site: save a file and the running page updates. The address belongs to the project, and the log shows every request that reaches it.",
  },
  {
    icon: Github,
    title: "GitHub in and out",
    body: "Connect once, import any repository you own — files, folders, branch — work on it here, then push your changes back to a branch you choose, with a real commit message.",
  },
  {
    icon: Layers,
    title: "Four models, one queue",
    body: "Groq, DeepSeek, SambaNova and Gemini sit behind a single cascade. Auto mode fails over when a provider is down or out of credit; pinning a model keeps it pinned, and you always see which one answered.",
  },
  {
    icon: KeyRound,
    title: "Secrets that stay secret",
    body: "Project environment variables are encrypted before they are stored and read only on the server. The browser sees key names, never values — and no key is ever logged.",
  },
] as const;

const INTEGRATIONS = [
  { icon: Github, name: "GitHub", note: "OAuth · import · push" },
  { icon: Database, name: "Supabase", note: "Postgres · Auth · storage" },
  { icon: Boxes, name: "Groq · DeepSeek", note: "fast inference" },
  { icon: Boxes, name: "SambaNova · Gemini", note: "long context" },
  { icon: Code2, name: "Monaco", note: "the editor VS Code uses" },
] as const;

function Engine() {
  return (
    <section id="engine" className="kore-section relative">
      <div className="kore-shell">
        <Reveal className="max-w-2xl">
          <SectionLabel>THE ENGINE</SectionLabel>
          <h2 className="mt-4 text-[clamp(1.9rem,4.2vw,3.1rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
            Everything the work needs, already open.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-kore-muted">
            ZeroKore is not a chat window with a code block in it. It is the
            workspace itself: files, terminal, live server, secrets, Git and the
            agent, side by side.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05}>
              <div className="glass glass-sheen kore-spotlight h-full rounded-2xl p-5">
                <span className="glass-subtle flex h-10 w-10 items-center justify-center rounded-xl">
                  <f.icon className="h-[18px] w-[18px] text-white" aria-hidden />
                </span>
                <h3 className="mt-4 text-[0.95rem] font-semibold text-white">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-kore-muted">
                  {f.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1} className="mt-10">
          <div className="glass glass-sheen rounded-2xl px-5 py-4">
            <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
              <span className="font-mono text-[10px] tracking-[0.24em] text-kore-muted">
                INTEGRATIONS
              </span>
              {INTEGRATIONS.map((it) => (
                <span key={it.name} className="flex items-center gap-2.5">
                  <it.icon className="h-4 w-4 text-kore-muted" aria-hidden />
                  <span className="text-xs text-kore-text">{it.name}</span>
                  <span className="font-mono text-[10px] text-kore-muted">
                    {it.note}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}


/* --------------------------------------------------------------- process */

const STEPS = [
  {
    n: "01",
    title: "Start or import",
    body: "Create an empty project, or connect GitHub and pull in a repository you already own. Files arrive as real, editable content — never a screenshot of code.",
    mock: "repo you/landing-page → 42 files",
  },
  {
    n: "02",
    title: "Build with the agent",
    body: "Describe the change in plain language. The agent plans, calls its tools, writes files and streams every step to you as it happens.",
    mock: "wrote src/app/page.tsx · 1.2 kB",
  },
  {
    n: "03",
    title: "Ship it",
    body: "Watch it run in the preview, read what changed, then push to a branch. Your history stays yours, and it stays in Git.",
    mock: "pushed to main · commit 4f2a1de",
  },
] as const;

function Process() {
  return (
    <section id="process" className="kore-section relative">
      <div className="kore-shell">
        <Reveal className="max-w-2xl">
          <SectionLabel>HOW IT WORKS</SectionLabel>
          <h2 className="mt-4 text-[clamp(1.9rem,4.2vw,3.1rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
            From an idea to a commit. Three moves.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-3 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.07}>
              <div className="glass glass-sheen flex h-full flex-col rounded-2xl p-6">
                <span className="font-mono text-[11px] tracking-[0.22em] text-kore-muted">
                  STEP {s.n}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-white">
                  {s.title}
                </h3>
                <p className="mt-2.5 flex-1 text-sm leading-relaxed text-kore-muted">
                  {s.body}
                </p>
                <div className="glass-subtle mt-5 rounded-xl px-3.5 py-2.5">
                  <span className="font-mono text-[11px] text-kore-text">
                    {s.mock}
                  </span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}


/* --------------------------------------------------------------- agentic */

const LOOP = [
  {
    icon: MousePointerClick,
    title: "You ask, in plain words",
    body: "\"Build a pricing page with three tiers and a dark theme.\" No prompt syntax, no configuration file, no scaffold to memorise.",
  },
  {
    icon: Sparkles,
    title: "It plans and picks its tools",
    body: "The agent decides what it needs — searching the web, recalling what it learned about your project, writing a file, or generating a component — and calls those tools itself, up to a fixed ceiling so a run can never spiral.",
  },
  {
    icon: Terminal,
    title: "Every step is visible",
    body: "Each tool call, each file written, each provider switch appears in the transcript as it happens. There is no hidden reasoning to trust: you watch the work and you can stop it mid-run.",
  },
  {
    icon: Layers,
    title: "Design knowledge, built in",
    body: "The agent carries a library of engineering and design skills — motion, layout, accessibility, React patterns, copy — and applies them while it writes, so the result is a considered interface rather than a wall of divs.",
  },
] as const;

function Agentic() {
  return (
    <section id="agentic" className="kore-section relative">
      <div className="kore-shell">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <Reveal>
            <SectionLabel>THE AGENT</SectionLabel>
            <h2 className="mt-4 text-[clamp(1.9rem,4.2vw,3.1rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
              Agentic means it finishes the job, and shows you how.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-kore-muted">
              A chatbot answers. An agent acts: it holds a goal, chooses tools,
              observes the result, and corrects itself until the work is done —
              visibly, and with a hard limit on how far it can go.
            </p>
            <p className="mt-4 text-base leading-relaxed text-kore-muted">
              That is the difference between code you have to re-type and a
              project that is simply further along.
            </p>
          </Reveal>

          <div className="grid gap-3 sm:grid-cols-2">
            {LOOP.map((l, i) => (
              <Reveal key={l.title} delay={i * 0.06}>
                <div className="glass glass-sheen kore-spotlight h-full rounded-2xl p-5">
                  <span className="glass-subtle flex h-9 w-9 items-center justify-center rounded-xl">
                    <l.icon className="h-4 w-4 text-white" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-white">
                    {l.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-kore-muted">
                    {l.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- pricing */

const TIERS = [
  {
    name: "Free",
    price: "$0",
    note: "forever",
    blurb: "Everything you need to build real projects.",
    features: [
      "Unlimited projects & files",
      "Full code editor with save & export",
      "GitHub import & push",
      "Agent on all four model providers",
      "Project environments & secrets",
      "Real-time terminal",
    ],
    cta: "Start building",
    href: "/signup",
    highlight: false,
  },
  {
    name: "Pro",
    price: "Soon",
    note: "waitlist open",
    blurb: "For people who ship every day.",
    features: [
      "Higher agent throughput",
      "Priority provider cascade",
      "Longer project memory",
      "Team workspaces",
      "Deploy previews",
      "Early access to new tools",
    ],
    cta: "Join waitlist",
    href: "/signup",
    highlight: true,
  },
] as const;

function Pricing() {
  return (
    <section id="pricing" className="kore-section relative">
      <div className="kore-shell">
        <Reveal className="max-w-2xl">
          <SectionLabel>PRICING</SectionLabel>
          <h2 className="mt-4 text-[clamp(1.9rem,4.2vw,3.1rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
            Free while we grow. No card, no trial timer.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-kore-muted">
            ZeroKore is free today, on purpose: the best feedback comes from
            people building real things. Pro arrives when the queue does.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {TIERS.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.08}>
              <div
                className={cn(
                  "glass glass-sheen kore-spotlight relative h-full rounded-3xl p-7",
                  t.highlight && "ring-1 ring-white/25",
                )}
              >
                {t.highlight && (
                  <span className="absolute right-5 top-5 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-black">
                    Waitlist
                  </span>
                )}
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-kore-muted">
                  {t.name}
                </h3>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-4xl font-semibold tracking-tight text-white">
                    {t.price}
                  </span>
                  <span className="text-sm text-kore-muted">{t.note}</span>
                </div>
                <p className="mt-3 text-sm text-kore-muted">{t.blurb}</p>
                <ul className="mt-6 space-y-2.5">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-kore-body">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={t.href}
                  className={cn(
                    "mt-7 flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors",
                    t.highlight
                      ? "bg-white text-black hover:bg-white/85"
                      : "glass-subtle text-white hover:bg-white/10",
                  )}
                >
                  {t.cta}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- cta */

function Cta() {
  return (
    <section className="kore-section relative">
      <div className="kore-shell">
        <Reveal>
          <div className="glass glass-sheen relative overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-14">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl"
            />
            <h2 className="mx-auto max-w-2xl text-[clamp(1.8rem,4vw,2.8rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
              Your next project is one sentence away.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-kore-muted">
              Create an account, claim your username, and get a workspace with
              an editor, terminal, agent and Git — in the browser, for free.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="group flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/85"
              >
                Create your workspace
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <Link
                href="/login"
                className="glass-subtle rounded-xl px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- footer */

function Footer() {
  return (
    <footer className="relative border-t border-white/10">
      <div className="kore-shell flex flex-col items-center justify-between gap-6 py-10 sm:flex-row">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white font-mono text-[11px] font-bold text-black">
            Z
          </span>
          <span className="font-mono text-sm font-semibold tracking-[0.22em] text-white">
            ZEROKORE
          </span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-kore-muted">
          <Link href="/web" className="transition-colors hover:text-white">Web</Link>
          <Link href="/cloud" className="transition-colors hover:text-white">Cloud</Link>
          <Link href="/chat" className="transition-colors hover:text-white">Chat</Link>
          <Link href="/cli" className="transition-colors hover:text-white">CLI</Link>
          <Link href="/desktop" className="transition-colors hover:text-white">Desktop</Link>
          <Link href="/#engine" className="transition-colors hover:text-white">Engine</Link>
          <Link href="/pricing" className="transition-colors hover:text-white">Pricing</Link>
          <Link href="/earn" className="transition-colors hover:text-white">Earn</Link>
          <Link href="/students" className="transition-colors hover:text-white">Students</Link>
          <Link href="/blog" className="transition-colors hover:text-white">Blog</Link>
          <Link href="/privacy" className="transition-colors hover:text-white">Privacy</Link>
          <Link href="/terms" className="transition-colors hover:text-white">Terms</Link>
        </nav>
        <p className="font-mono text-xs text-kore-faint">
          © {new Date().getFullYear()} ZeroKore
        </p>
      </div>
    </footer>
  );
}

const REPLACES: { product: string; tools: string[] }[] = [
  {
    product: "Web",
    tools: ["Bolt", "Lovable", "v0", "Replit Agent"],
  },
  {
    product: "Cloud",
    tools: ["Cursor Cloud", "Devin", "Factory", "Claude Code"],
  },
  {
    product: "Chat",
    tools: ["Copilot Pro", "ChatGPT Plus", "Perplexity Pro", "Gemini Advanced"],
  },
  {
    product: "Terminal",
    tools: ["OpenCode", "Codex CLI", "Claude Code", "Aider"],
  },
] as const;

function Replaces() {
  return (
    <section aria-label="Tools ZeroKore replaces" className="kore-section relative">
      <div className="kore-shell">
        <Reveal className="max-w-2xl">
          <SectionLabel>WHY FREE</SectionLabel>
          <h2 className="mt-4 text-[clamp(1.9rem,4.2vw,3.1rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
            Replaces the stack you already pay for.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-kore-muted">
            One workspace instead of four subscriptions. Each surface of
            ZeroKore stands in for a paid tool — and stays free while we grow.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {REPLACES.map((r, i) => (
            <Reveal key={r.product} delay={i * 0.06}>
              <div className="glass glass-sheen h-full rounded-2xl p-5">
                <p className="font-mono text-[10px] tracking-[0.24em] text-kore-muted">
                  ZEROKORE {r.product.toUpperCase()}
                </p>
                <p className="mt-3 text-sm font-semibold text-white">Replaces</p>
                <ul className="mt-3 space-y-2">
                  {r.tools.map((t) => (
                    <li key={t} className="flex items-center gap-2 text-sm text-kore-muted">
                      <span className="h-1 w-1 rounded-full bg-white/25" aria-hidden />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function BlogTeaser() {
  const posts = [
    {
      category: "ANNOUNCEMENTS",
      title: "ZeroKore is free: 30 credits every day, every model",
      excerpt: "No trial, no card. One request plus a small per-token meter, reset at midnight UTC.",
      href: "/blog",
    },
    {
      category: "ENGINEERING",
      title: "How the agent edits your files: versions, diffs, Changes",
      excerpt: "Every edit snapshots the previous content, so the Changes tab shows a true +/− diff.",
      href: "/blog",
    },
    {
      category: "COMPARISONS",
      title: "ZeroKore vs Copilot Pro vs Cursor: what $0 gets you",
      excerpt: "Agent autonomy, file editing, workspaces and price — side by side.",
      href: "/blog",
    },
  ];
  return (
    <section aria-label="From the blog" className="kore-section relative">
      <div className="kore-shell">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <SectionLabel>FROM THE BLOG</SectionLabel>
            <h2 className="mt-4 text-[clamp(1.9rem,4.2vw,3.1rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
              Notes from the build.
            </h2>
          </div>
          <Link
            href="/blog"
            className="glass-subtle inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm text-kore-text transition-colors hover:bg-white/10"
          >
            View all posts
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Reveal>

        <div className="mt-14 grid gap-3 md:grid-cols-3">
          {posts.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.06}>
              <Link
                href={p.href}
                className="glass glass-sheen glass-interactive block h-full rounded-2xl p-5"
              >
                <span className="rounded-full bg-white/8 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] text-kore-muted">
                  {p.category}
                </span>
                <h3 className="mt-4 text-[0.95rem] font-semibold leading-snug text-white">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-kore-muted">{p.excerpt}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function VersionBlock() {
  return (
    <section aria-label="Current version" className="relative pb-4">
      <div className="kore-shell">
        <Reveal>
          <div className="glass flex flex-col items-start justify-between gap-3 rounded-2xl px-5 py-4 sm:flex-row sm:items-center">
            <p className="font-mono text-[11px] tracking-[0.14em] text-kore-muted">
              ZEROKORE <span className="text-white">v1.4</span> · CREDITS ENGINE LIVE
            </p>
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-xs text-kore-muted transition-colors hover:text-white"
            >
              Read the changelog
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ composition */

export default function LandingPage({ totalUsers }: { totalUsers: number | null }) {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-black text-white">
      <ParticleField />
      <div className="relative z-10">
        <Nav />
        <main>
          <Hero totalUsers={totalUsers} />
          <Marquee />
          <Engine />
          <Replaces />
          <Process />
          <Agentic />
          <SavingsCalculator />
          <CreditsPerDay />
          <Pricing />
          <BlogTeaser />
          <VersionBlock />
          <Cta />
        </main>
        <Footer />
      </div>
    </div>
  );
}
