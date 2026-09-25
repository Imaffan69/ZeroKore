import type { Metadata } from "next";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { PLANS, type PlanId } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "ZeroKore is free. Plus, Pro, Max and Teams multiply your daily credits — 30/100/350/600 per day.",
};

const ORDER: PlanId[] = ["free", "plus", "pro", "max", "team"];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
      <p className="font-mono text-[10px] tracking-[0.28em] text-kore-muted">PRICING</p>
      <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
        Everything is free today.{" "}
        <span className="bg-gradient-to-r from-white via-white/70 to-white/40 bg-clip-text text-transparent">
          Credits are the only limit.
        </span>
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-kore-muted sm:text-base">
        One credit is one agent request plus a small per-token meter (1 credit
        per 4k tokens). Tools, file edits, previews and exports are included in
        every plan. Balances reset at midnight UTC — no rollovers, no expiry.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {ORDER.map((id) => {
          const plan = PLANS[id];
          return (
            <div
              key={id}
              className={
                id === "free"
                  ? "glass glass-sheen flex flex-col rounded-2xl border border-kore-accent/40 p-5"
                  : "glass flex flex-col rounded-2xl p-5"
              }
            >
              <p className="text-sm font-semibold text-white">{plan.name}</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-white">
                {id === "free" ? "$0" : plan.dailyCredits}
                <span className="ml-1 text-xs font-normal text-kore-muted">
                  {id === "free" ? "forever" : "credits/day"}
                </span>
              </p>
              <p className="mt-2 min-h-10 text-xs leading-relaxed text-kore-muted">
                {plan.tagline}
              </p>
              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-kore-text">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-kore-accent" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              {id === "free" ? (
                <Link
                  href="/signup"
                  className="mt-5 rounded-full bg-white px-4 py-2.5 text-center text-sm font-semibold text-black transition hover:bg-white/85"
                >
                  Start free
                </Link>
              ) : id === "team" ? (
                <Link
                  href="/login?next=/pricing"
                  className="glass-subtle mt-5 rounded-full px-4 py-2.5 text-center text-sm text-kore-text"
                >
                  Contact us — via feedback
                </Link>
              ) : (
                <div className="mt-5 rounded-full border border-white/10 px-4 py-2.5 text-center text-xs text-kore-muted">
                  Coming soon — billing is being wired up honestly, not faked
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Student benefits */}
      <div className="glass glass-sheen mt-10 flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Student? +50 bonus credits a day.</p>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-kore-muted">
            Verify with a school email (.edu, .edu.xx, .ac.xx) and your daily
            balance gains +50 for a year, on top of any plan. Stored,
            renewable, and disclosed in the Privacy Policy.
          </p>
        </div>
        <Link
          href="/students"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-kore-accent px-5 py-2.5 text-sm font-semibold text-black"
        >
          Verify as a student <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <p className="mt-10 text-xs leading-relaxed text-kore-muted">
        Paid tiers are listed with their real future numbers but cannot be
        purchased yet — checkout is not faked. Today everyone effectively runs
        on Free with unlimited staff exceptions where applicable. See the{" "}
        <Link href="/earn" className="text-kore-accent hover:underline">
          Earn
        </Link>{" "}
        page for ways to top up your balance today: referrals and feedback
        bonuses.
      </p>
    </main>
  );
}
