"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Loader2, CheckCircle2 } from "lucide-react";

/**
 * Student verification: school-email domain check → +50 credits/day for a
 * year. Honest about what is checked and what is stored.
 */
export default function StudentsPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState<{
    email: string;
    domain: string;
    expires_at: string;
  } | null>(null);
  const [active, setActive] = useState(false);
  const [checking, setChecking] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/students/verify");
      if (res.ok) {
        const data = await res.json();
        setVerification(data.verification);
        setActive(data.active);
      }
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/students/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Verification failed.");
      else {
        setEmail("");
        load();
      }
    } catch {
      setError("Connection failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-16 sm:py-24">
      <div className="flex items-center gap-3">
        <span className="glass-subtle flex h-10 w-10 items-center justify-center rounded-xl">
          <GraduationCap className="h-5 w-5 text-kore-accent" aria-hidden />
        </span>
        <p className="font-mono text-[10px] tracking-[0.28em] text-kore-muted">STUDENTS</p>
      </div>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-white">
        +50 bonus credits, every day.
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-kore-muted">
        Verified students get +50 credits a day on top of their plan — that is
        up to 80/day on Free, 150/day on Plus. The bonus lasts a year and
        renews while you are still enrolled.
      </p>

      <div className="glass glass-sheen mt-8 rounded-2xl p-6">
        {checking ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-kore-muted" />
        ) : verification && active ? (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-white">Verified — {verification.email}</p>
              <p className="mt-1 text-xs text-kore-muted">
                +50/day active until {new Date(verification.expires_at).toLocaleDateString()}.
                Renew by re-verifying any time after expiry.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={verify} className="space-y-3">
            <label htmlFor="school-email" className="block text-xs text-kore-muted">
              School email
            </label>
            <input
              id="school-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu"
              className="w-full rounded-xl border border-kore-border bg-kore-bg/60 px-3.5 py-3 text-sm text-kore-text placeholder:text-kore-muted focus:border-white/30 focus:outline-none"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={busy || !email}
              className="w-full rounded-full bg-kore-accent px-4 py-2.5 text-sm font-semibold text-black transition disabled:opacity-50"
            >
              {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Verify"}
            </button>
            <p className="text-[11px] leading-relaxed text-kore-muted">
              We check the domain against academic patterns (.edu, .edu.xx,
              .ac.xx). The submitted email and domain are stored with the
              verification and disclosed in the{" "}
              <Link href="/privacy" className="text-kore-accent hover:underline">
                Privacy Policy
              </Link>
              . Unrecognized domain? Tell us via the feedback widget.
            </p>
          </form>
        )}
      </div>

      {!checking && !active && (
        <p className="mt-4 text-xs text-kore-muted">
          Not signed in?{" "}
          <Link href="/login?next=/students" className="text-kore-accent hover:underline">
            Log in first
          </Link>
          .
        </p>
      )}
    </main>
  );
}
