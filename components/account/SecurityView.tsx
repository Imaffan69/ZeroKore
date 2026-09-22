"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import LoginHistory from "@/components/account/LoginHistory";

/**
 * Sign-in & security: MFA (TOTP via Supabase Auth) and login history —
 * disclosed in the Privacy Policy and shown to the user who owns it.
 */
export default function SecurityView() {
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/mfa");
      if (res.ok) setEnrolled((await res.json()).enrolled);
    } catch {
      // leave state as-is
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function startEnroll() {
    setBusy(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "ZeroKore authenticator",
      });
      if (err || !data) throw new Error(err?.message ?? "Enrollment failed.");
      if (data.type !== "totp") throw new Error("Unexpected factor type.");
      setFactorId(data.id);
      setQr(data.totp.qr_code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrollment failed.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyEnroll() {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: err } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: code.trim(),
      });
      if (err) throw new Error(err.message);
      await fetch("/api/account/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified: true }),
      });
      setEnrolled(true);
      setQr(null);
      setFactorId(null);
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!enrolled) return;
    setBusy(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const f of factors?.totp ?? []) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      await fetch("/api/account/mfa", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      setEnrolled(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disable MFA.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">
              Two-factor authentication (TOTP)
            </p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-kore-muted">
              Adds a rotating 6-digit code at login. Enforced for staff
              accounts. Works with any authenticator app.
            </p>
          </div>
          {enrolled === null ? (
            <Loader2 className="h-4 w-4 animate-spin text-kore-muted" />
          ) : enrolled ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> On
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-xs text-kore-muted">
              <ShieldOff className="h-3.5 w-3.5" aria-hidden /> Off
            </span>
          )}
        </div>

        {qr ? (
          <div className="mt-4 space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="MFA QR code" className="h-40 w-40 rounded-xl bg-white p-2" />
            <div className="flex max-w-xs gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                className="w-full rounded-xl border border-kore-border bg-kore-bg/60 px-3 py-2 text-sm text-kore-text focus:border-white/30 focus:outline-none"
              />
              <button
                onClick={verifyEnroll}
                disabled={busy || code.length !== 6}
                className="shrink-0 rounded-xl bg-kore-accent px-4 text-sm font-semibold text-black disabled:opacity-50"
              >
                Verify
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={enrolled ? disable : startEnroll}
            disabled={busy}
            className={
              enrolled
                ? "mt-4 rounded-full border border-white/15 px-4 py-2 text-xs text-kore-text transition hover:text-red-300"
                : "mt-4 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black"
            }
          >
            {busy ? "Working…" : enrolled ? "Disable MFA" : "Enable MFA"}
          </button>
        )}
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>

      <LoginHistory />
    </div>
  );
}
