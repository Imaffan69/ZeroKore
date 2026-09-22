"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Coins, Zap } from "lucide-react";
import LedgerList from "@/components/account/LedgerList";

interface CreditsData {
  balance: number;
  dailyAllowance: number;
  unlimited: boolean;
  plan: string;
  byModel: Record<
    string,
    { runs: number; promptTokens: number; completionTokens: number; credits: number }
  >;
}

export default function UsageView() {
  const [data, setData] = useState<CreditsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/credits");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-kore-muted" />
      </div>
    );
  }
  if (!data) {
    return (
      <p className="py-20 text-center text-sm text-kore-muted">
        Usage is unavailable right now.
      </p>
    );
  }

  const totalPrompt = Object.values(data.byModel).reduce((a, m) => a + m.promptTokens, 0);
  const totalCompletion = Object.values(data.byModel).reduce((a, m) => a + m.completionTokens, 0);
  const totalRuns = Object.values(data.byModel).reduce((a, m) => a + m.runs, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="glass glass-sheen rounded-2xl p-5">
          <div className="flex items-center gap-2 text-kore-muted">
            <Coins className="h-4 w-4" aria-hidden />
            <span className="font-mono text-[10px] tracking-[0.22em]">CREDIT BALANCE</span>
          </div>
          <p className="mt-2 text-3xl font-semibold text-white">
            {data.unlimited ? "∞" : data.balance}
            {!data.unlimited && (
              <span className="ml-1 text-xs font-normal text-kore-muted">
                / {data.dailyAllowance} today
              </span>
            )}
          </p>
          <p className="mt-1 text-[11px] text-kore-muted">
            Resets at midnight UTC · plan: {data.plan}
          </p>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 text-kore-muted">
            <Zap className="h-4 w-4" aria-hidden />
            <span className="font-mono text-[10px] tracking-[0.22em]">AGENT RUNS</span>
          </div>
          <p className="mt-2 text-3xl font-semibold text-white">{totalRuns}</p>
          <p className="mt-1 text-[11px] text-kore-muted">recent runs metered</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="font-mono text-[10px] tracking-[0.22em] text-kore-muted">TOKENS</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {(totalPrompt + totalCompletion).toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-kore-muted">
            {(totalPrompt / 1000).toFixed(1)}k in · {(totalCompletion / 1000).toFixed(1)}k out
          </p>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <p className="text-sm font-semibold text-white">By model</p>
        {Object.keys(data.byModel).length === 0 ? (
          <p className="mt-2 text-xs text-kore-muted">
            No metered runs yet. Send the agent something — usage appears here
            with real token counts.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {Object.entries(data.byModel).map(([model, m]) => (
              <li
                key={model}
                className="glass-subtle flex items-center gap-3 rounded-xl px-3.5 py-2.5"
              >
                <span className="min-w-0 flex-1 truncate text-xs text-kore-text">
                  {model}
                </span>
                <span className="font-mono text-[10px] text-kore-muted">{m.runs} runs</span>
                <span className="font-mono text-[10px] text-kore-muted">
                  {(m.promptTokens + m.completionTokens).toLocaleString()} tok
                </span>
                <span className="font-mono text-[10px] text-kore-accent">{m.credits} cr</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <LedgerList />

      <p className="text-xs text-kore-muted">
        Need more? Visit{" "}
        <Link href="/earn" className="text-kore-accent hover:underline">
          Earn
        </Link>{" "}
        for referrals and feedback bonuses, or{" "}
        <Link href="/students" className="text-kore-accent hover:underline">
          verify as a student
        </Link>{" "}
        for +50/day.
      </p>
    </div>
  );
}
