"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Gift, Check, Loader2 } from "lucide-react";

/**
 * Earn credits: real, currently-working ways to top up your daily balance.
 * Referrals and feedback bonuses are wired to the credit ledger.
 */
export default function EarnPage() {
  const [code, setCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState(0);
  const [bonus, setBonus] = useState(25);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claimCode, setClaimCode] = useState("");
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/referral");
      if (res.ok) {
        const data = await res.json();
        setCode(data.code);
        setReferrals(data.referrals);
        setBonus(data.bonusPerReferral);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function claim(e: React.FormEvent) {
    e.preventDefault();
    setClaiming(true);
    setClaimMsg(null);
    try {
      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: claimCode }),
      });
      const data = await res.json();
      setClaimMsg(res.ok ? "Claimed — credits added to your balance." : data.error);
      if (res.ok) setClaimCode("");
    } catch {
      setClaimMsg("Connection failed.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-16 sm:py-24">
      <div className="flex items-center gap-3">
        <span className="glass-subtle flex h-10 w-10 items-center justify-center rounded-xl">
          <Gift className="h-5 w-5 text-kore-accent" aria-hidden />
        </span>
        <p className="font-mono text-[10px] tracking-[0.28em] text-kore-muted">EARN CREDITS</p>
      </div>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-white">
        Top up your balance, for free.
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-kore-muted">
        Real ways to earn credits today. Every grant is recorded in your credit
        ledger — nothing here is hidden or fictional.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="glass glass-sheen rounded-2xl p-6 sm:col-span-2">
          <p className="text-sm font-semibold text-white">
            Invite a friend — {bonus} credits each
          </p>
          <p className="mt-1 text-xs leading-relaxed text-kore-muted">
            Share your code. When someone signs up with it and claims, you get{" "}
            {bonus} credits and they get 10. Once per account.
          </p>
          {loading ? (
            <Loader2 className="mt-4 h-4 w-4 animate-spin text-kore-muted" />
          ) : code ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <code className="glass-subtle rounded-xl px-4 py-2.5 font-mono text-sm text-kore-accent">
                {code}
              </code>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `https://zerokore.vercel.app/signup?ref=${code}`
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="glass glass-interactive flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy invite link"}
              </button>
              <span className="font-mono text-xs text-kore-muted">
                {referrals} referral{referrals === 1 ? "" : "s"} · {referrals * bonus} credits
                earned
              </span>
            </div>
          ) : (
            <Link
              href="/login?next=/earn"
              className="mt-4 inline-block text-sm text-kore-accent hover:underline"
            >
              Log in to get your code
            </Link>
          )}

          <form onSubmit={claim} className="mt-5 flex max-w-md gap-2">
            <input
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value)}
              placeholder="Have a code? Claim it here…"
              className="w-full rounded-xl border border-kore-border bg-kore-bg/60 px-3.5 py-2.5 text-sm text-kore-text placeholder:text-kore-muted focus:border-white/30 focus:outline-none"
            />
            <button
              disabled={claiming || !claimCode}
              className="shrink-0 rounded-xl bg-white px-4 text-sm font-semibold text-black disabled:opacity-50"
            >
              {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim"}
            </button>
          </form>
          {claimMsg && <p className="mt-2 text-xs text-kore-accent">{claimMsg}</p>}
        </div>

        <FeedbackCard />
        <StudentCard />
      </div>
    </main>
  );
}

function FeedbackCard() {
  return (
    <div className="glass rounded-2xl p-6">
      <p className="text-sm font-semibold text-white">Feedback — +2 credits a day</p>
      <p className="mt-2 text-xs leading-relaxed text-kore-muted">
        Use the “Need a hand?” widget on any page. The first message each day
        adds +2 credits. Bug reports, feature ideas, confusing copy — it all
        lands in the team inbox.
      </p>
    </div>
  );
}

function StudentCard() {
  return (
    <div className="glass rounded-2xl p-6">
      <p className="text-sm font-semibold text-white">Student verification — +50 a day</p>
      <p className="mt-2 text-xs leading-relaxed text-kore-muted">
        School email (.edu and friends) unlocks +50 daily bonus credits for a
        year.{" "}
        <Link href="/students" className="text-kore-accent hover:underline">
          Verify here
        </Link>
        .
      </p>
    </div>
  );
}
