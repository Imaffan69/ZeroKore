"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface LedgerRow {
  delta: number;
  reason: string;
  created_at: string;
}

const REASON_LABEL: Record<string, string> = {
  daily_reset: "Daily reset",
  agent_run: "Agent run",
  refund: "Refund",
  admin_grant: "Admin grant",
  referral: "Referral bonus",
  feedback_bonus: "Feedback bonus",
  student_bonus: "Student bonus",
  plan_grant: "Plan grant",
  signup_bonus: "Signup bonus",
  adjustment: "Adjustment",
};

export default function LedgerList() {
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/credits");
      if (res.ok) setLedger((await res.json()).ledger);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loader2 className="mx-auto mt-6 h-4 w-4 animate-spin text-kore-muted" />;
  if (!ledger) return null;

  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-sm font-semibold text-white">Credit ledger</p>
      {ledger.length === 0 ? (
        <p className="mt-2 text-xs text-kore-muted">No credit activity yet.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {ledger.map((l, i) => (
            <li key={i} className="flex items-center gap-3 text-xs">
              <span className="w-36 shrink-0 text-kore-muted">
                {REASON_LABEL[l.reason] ?? l.reason}
              </span>
              <span className="min-w-0 flex-1 font-mono text-[10px] text-kore-faint">
                {l.created_at.slice(0, 16).replace("T", " ")}
              </span>
              <span
                className={
                  l.delta >= 0 ? "font-mono text-emerald-400" : "font-mono text-red-400"
                }
              >
                {l.delta >= 0 ? "+" : ""}
                {l.delta}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
