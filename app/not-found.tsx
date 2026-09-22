import Link from "next/link";
import { Compass, Terminal } from "lucide-react";
import ParticleField from "@/components/visual/ParticleField";

export const metadata = { title: "404 — ZeroKore" };

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-4 text-white">
      <ParticleField density={10} maxParticles={70} linkDistance={150} opacity={0.7} />
      <div className="relative z-10 flex max-w-md flex-col items-center text-center">
        <div className="glass glass-sheen flex w-full flex-col items-center rounded-3xl p-8">
          <span className="glass-subtle mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
            <Compass className="h-7 w-7 text-white" aria-hidden />
          </span>
          <p className="font-mono text-xs tracking-[0.28em] text-kore-muted">404 · NOTHING HERE</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            This route doesn&rsquo;t exist.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-kore-muted">
            It may have moved, or the address is wrong. The workspace is one
            click back — nothing was deleted, nothing broke.
          </p>
          <div className="mt-2 w-full rounded-xl bg-black/60 px-4 py-3 text-left font-mono text-[11px] leading-relaxed">
            <p className="text-kore-muted">
              <span className="text-emerald-400">$</span> kore where-am-i
            </p>
            <p className="text-kore-text">somewhere that isn&rsquo;t on the map — heading home</p>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/85"
            >
              Go home
            </Link>
            <Link
              href="/dashboard"
              className="glass glass-interactive inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-kore-text hover:text-white"
            >
              <Terminal className="h-4 w-4" aria-hidden />
              Your workspace
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
