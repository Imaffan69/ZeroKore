"use client";

import { motion } from "framer-motion";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { PLANS } from "@/lib/plans";

const DAILY_LIMIT_FREE = PLANS.free.dailyCredits;

/**
 * "Credits per day, by model" — tied to the real daily allowance.
 * The bars describe access depth per provider at the Free plan's 30
 * credits/day; paid plans multiply the allowance.
 */

const MODELS: { name: string; note: string; pct: number; full: boolean }[] = [
  { name: "Groq · GPT-OSS 120B", note: "Fastest turns, file tools", pct: 100, full: true },
  { name: "DeepSeek · deepseek-chat", note: "Long reasoning", pct: 85, full: true },
  { name: "SambaNova · Llama 3.3 70B", note: "Balanced fallback", pct: 70, full: true },
  { name: "Gemini · 2.5 Flash", note: "Big context, vision", pct: 55, full: false },
];

export default function CreditsPerDay() {
  return (
    <section aria-label="Credits per day by model" className="border-t border-white/10 py-20 sm:py-28">
      <div className="kore-shell">
        <p className="font-mono text-[10px] tracking-[0.28em] text-kore-muted">
          FREE EVERY DAY
        </p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
          {DAILY_LIMIT_FREE} credits every day. Every model.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-kore-muted">
          A credit is one agent request plus a small per-token meter — tools,
          file edits and previews are included. Balance resets at midnight UTC.
          Plus, Pro and Max multiply the allowance; students get +50 a day.
        </p>

        <div className="mt-10 space-y-4">
          {MODELS.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, x: -14 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, ease: EASE, delay: i * 0.06 }}
              className="grid items-center gap-2 sm:grid-cols-[220px_1fr_90px]"
            >
              <div>
                <p className="text-sm font-medium text-white">{m.name}</p>
                <p className="text-[11px] text-kore-muted">{m.note}</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className={cn(
                    "h-full rounded-full",
                    m.full ? "bg-kore-accent" : "bg-white/40"
                  )}
                  style={{ width: `${m.pct}%` }}
                />
              </div>
              <span
                className={cn(
                  "font-mono text-[10px] tracking-[0.14em]",
                  m.full ? "text-kore-accent" : "text-kore-muted"
                )}
              >
                {m.full ? "FULL" : "LIMITED"}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
