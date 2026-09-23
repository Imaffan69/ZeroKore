import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared product-page shell (Freebuff-style): two-tone hero, a "replaces"
 * strip, feature cards, and an honest CTA. Every claim maps to something the
 * product actually does today — no fictional capabilities.
 */
export default function ProductPage({
  label,
  title,
  titleAccent,
  sub,
  replaces,
  features,
  primaryCta,
  primaryHref,
  secondaryCta,
  secondaryHref,
  children,
}: {
  label: string;
  title: string;
  titleAccent: string;
  sub: string;
  replaces: string[];
  features: { title: string; body: string }[];
  primaryCta: string;
  primaryHref: string;
  secondaryCta: string;
  secondaryHref: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="relative">
      {/* Hero */}
      <section className="kore-hero kore-noise">
        <div className="kore-ambient pointer-events-none absolute inset-0" aria-hidden />
        <div className="kore-shell relative z-10 pt-24">
          <p className="font-mono text-[10px] tracking-[0.28em] text-kore-accent">
            ZEROKORE {label}
          </p>
          <h1 className="mt-4 max-w-3xl text-[clamp(2.4rem,6vw,4.6rem)] font-semibold leading-[1.03] tracking-[-0.035em] text-white">
            {title}{" "}
            <span className="bg-gradient-to-r from-[#b5cfa0] via-white to-white bg-clip-text text-transparent">
              {titleAccent}
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-kore-body sm:text-lg">
            {sub}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={primaryHref}
              className="group inline-flex items-center gap-2 rounded-full bg-[#4ade80] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#b5cfa0]"
            >
              {primaryCta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href={secondaryHref}
              className="glass glass-interactive inline-flex items-center rounded-full px-6 py-3 text-sm font-medium text-kore-text"
            >
              {secondaryCta}
            </Link>
          </div>

          {/* Replaces strip */}
          <div className="mt-10 flex flex-wrap items-center gap-2">
            <span className="mr-1 font-mono text-[10px] tracking-[0.2em] text-kore-muted">
              REPLACES
            </span>
            {replaces.map((r) => (
              <span
                key={r}
                className="glass-subtle rounded-full px-3.5 py-1.5 text-xs text-kore-body"
              >
                {r}
              </span>
            ))}
          </div>

          {children}
        </div>
      </section>

      {/* Features */}
      <section className="kore-section relative">
        <div className="kore-shell grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="glass glass-sheen h-full rounded-2xl p-5">
              <h3 className="text-[0.95rem] font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-kore-muted">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="kore-shell mt-8">
          <div className="glass flex flex-col items-start justify-between gap-4 rounded-2xl p-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold text-white">
                Free while we grow — {cn("30")} credits a day, every model.
              </p>
              <p className="mt-1 text-xs text-kore-muted">
                Unlimited projects · GitHub import & push · real terminal · no card.
              </p>
            </div>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/85"
            >
              See pricing
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export function FeatureCheck({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-kore-body">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#4ade80]" aria-hidden />
      {children}
    </li>
  );
}
