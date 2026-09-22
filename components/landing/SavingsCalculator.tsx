"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Calculator } from "lucide-react";
import { EASE, press } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Savings calculator — real arithmetic over real, public list prices.
 * Chips toggle tools; the seats slider multiplies. Honest numbers, no
 * invented discounts.
 */

const TOOLS: { name: string; yearly: number }[] = [
  { name: "OpenCode", yearly: 120 },
  { name: "Copilot Pro", yearly: 100 },
  { name: "Perplexity Pro", yearly: 200 },
  { name: "OpenAI Codex", yearly: 240 },
  { name: "Emergent", yearly: 240 },
  { name: "ChatGPT Plus", yearly: 240 },
  { name: "Gemini Advanced", yearly: 240 },
  { name: "Bolt.new", yearly: 240 },
  { name: "Grok", yearly: 300 },
  { name: "Lovable", yearly: 300 },
  { name: "Cursor", yearly: 240 },
  { name: "Replit Core", yearly: 240 },
  { name: "Claude Pro", yearly: 200 },
  { name: "Devin (starter)", yearly: 2400 },
];

const DEFAULT_SELECTED = new Set(["Copilot Pro", "Cursor", "ChatGPT Plus"]);

export default function SavingsCalculator() {
  const [selected, setSelected] = useState<Set<string>>(DEFAULT_SELECTED);
  const [seats, setSeats] = useState(1);

  const { formatted } = useMemo(() => {
    const total = TOOLS.filter((t) => selected.has(t.name)).reduce(
      (acc, t) => acc + t.yearly,
      0
    ) * seats;
    return { total, formatted: total.toLocaleString() };
  }, [selected, seats]);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <section aria-label="Savings calculator" className="border-t border-white/10 py-20 sm:py-28">
      <div className="kore-shell grid gap-10 lg:grid-cols-[1fr_360px] lg:items-start">
        <div>
          <p className="font-mono text-[10px] tracking-[0.28em] text-kore-muted">
            THE MATH
          </p>
          <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
            ZeroKore replaces the stack you already pay for.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-kore-muted">
            Pick the tools you pay for today and slide the team size. ZeroKore
            is free — the credits math is on the pricing page, not hidden.
          </p>

          <div className="mt-7 flex flex-wrap gap-2">
            {TOOLS.map((t) => {
              const on = selected.has(t.name);
              return (
                <motion.button
                  key={t.name}
                  whileTap={press}
                  onClick={() => toggle(t.name)}
                  aria-pressed={on}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs transition",
                    on
                      ? "border-kore-accent/60 bg-kore-accent/15 text-white"
                      : "border-white/10 text-kore-muted hover:border-white/25 hover:text-white"
                  )}
                >
                  {on && <Check className="h-3 w-3 text-kore-accent" aria-hidden />}
                  {t.name}
                  <span className="font-mono text-[10px] opacity-70">
                    ${Math.round(t.yearly / 12)}/mo
                  </span>
                </motion.button>
              );
            })}
          </div>

          <div className="mt-8 max-w-md">
            <div className="flex items-center justify-between text-xs text-kore-muted">
              <span>Team size</span>
              <span className="font-mono text-kore-text">{seats} seat{seats === 1 ? "" : "s"}</span>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--kore-accent,#7fdc91)]"
              aria-label="Team size"
            />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: EASE }}
          className="glass glass-sheen rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 text-kore-muted">
            <Calculator className="h-4 w-4" aria-hidden />
            <span className="font-mono text-[10px] tracking-[0.24em]">YOU SAVE A YEAR</span>
          </div>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-white">
            ${formatted}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-kore-muted">
            {selected.size} tool{selected.size === 1 ? "" : "s"} × {seats} seat{seats === 1 ? "" : "s"},
            at public list prices. ZeroKore costs $0.
          </p>
          <Link
            href="/signup"
            className="mt-5 block rounded-full bg-white px-4 py-2.5 text-center text-sm font-semibold text-black transition hover:bg-white/85"
          >
            Start free
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
