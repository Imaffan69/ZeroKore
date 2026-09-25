import Link from "next/link";
import { Compass, Terminal, ArrowRight, Home, FolderOpen, Sparkles } from "lucide-react";
import ParticleField from "@/components/visual/ParticleField";

export const metadata = { title: "404 — ZeroKore" };

const SUGGESTIONS = [
  { href: "/dashboard", label: "Your projects", hint: "create or continue a workspace" },
  { href: "/web", label: "Web workspace", hint: "build apps in the browser" },
  { href: "/cloud", label: "Cloud", hint: "import a GitHub repository" },
  { href: "/pricing", label: "Pricing", hint: "plans and daily credits" },
];

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-black px-4 py-16 text-white">
      <ParticleField density={12} maxParticles={90} linkDistance={150} opacity={0.7} />
      <div className="kore-ambient pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-3xl">
        <div className="glass glass-sheen rounded-3xl p-8 sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              <span className="glass-subtle mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
                <Compass className="h-6 w-6 text-white" aria-hidden />
              </span>
              <p className="font-mono text-xs tracking-[0.28em] text-kore-muted">
                404 · NOTHING HERE
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                This route doesn&rsquo;t exist.
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-kore-muted">
                The address may be mistyped, or the page may have moved. Nothing
                was deleted — pick up where you were below.
              </p>
            </div>

            {/* Terminal readout, so the failure reads in the product's own voice. */}
            <div className="w-full max-w-xs rounded-2xl bg-black/60 p-4 font-mono text-[11px] leading-relaxed">
              <p className="text-kore-muted">
                <span className="text-[#4ade80]">$</span> kore where-am-i
              </p>
              <p className="text-kore-text">unmapped coordinate</p>
              <p className="mt-1 text-kore-muted">
                <span className="text-[#4ade80]">$</span> kore suggest
              </p>
              <p className="text-kore-text">{SUGGESTIONS.length} nearby destinations</p>
            </div>
          </div>

          {/* Real destinations instead of a dead end. */}
          <ul className="mt-8 grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="glass-subtle group flex items-center justify-between gap-3 rounded-2xl px-4 py-3 transition-colors duration-150 hover:bg-white/10"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-white">{s.label}</span>
                    <span className="block truncate text-[11px] text-kore-muted">{s.hint}</span>
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-kore-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-kore-accent"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-[#4ade80] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#b5cfa0]"
            >
              <Home className="h-4 w-4" aria-hidden />
              Go home
            </Link>
            <Link
              href="/dashboard"
              className="glass glass-interactive inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-kore-text hover:text-white"
            >
              <FolderOpen className="h-4 w-4" aria-hidden />
              Your workspace
            </Link>
            <Link
              href="/skills"
              className="glass-subtle inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-kore-muted transition hover:text-white"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              Browse skills
            </Link>
          </div>

          <p className="mt-6 flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-kore-muted">
            <Terminal className="h-3 w-3" aria-hidden />
            ZEROKORE · AUTONOMOUS DEVELOPMENT WORKSPACE
          </p>
        </div>
      </div>
    </main>
  );
}
