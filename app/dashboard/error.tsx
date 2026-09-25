"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, LayoutDashboard } from "lucide-react";

/**
 * Dashboard-scoped error boundary.
 *
 * Without this, any throw inside the workspace bubbles to the root boundary and
 * the whole page becomes a 500. Next.js redacts the message in production, so
 * the cause is also reported to the server log — otherwise a rendering fault is
 * invisible and can only be guessed at.
 *
 * `reset()` re-renders the segment without a full reload, which recovers from
 * transient faults (a database blip during render) instead of stranding the user.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Next.js redacts the underlying message in production, so only the
    // reference survives client-side. The real cause is in the deployment's
    // server logs — search for this digest there.
    console.error(
      JSON.stringify({
        event: "dashboard_render_failed",
        digest: error.digest ?? null,
      })
    );
  }, [error]);

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 bg-kore-bg px-6 py-16 text-center text-kore-text">
      <div className="glass w-full max-w-lg rounded-3xl p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
          <AlertTriangle className="h-6 w-6 text-amber-400" aria-hidden />
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-white">
          Your workspace could not load
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-kore-muted">
          Something went wrong while building this page. Your projects and files
          are safe — retrying usually fixes it.
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-kore-faint">
            Reference: {error.digest}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full bg-kore-mint px-5 py-2.5 text-sm font-medium text-black transition hover:opacity-90"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white transition hover:border-white/30"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden />
            Reload dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
