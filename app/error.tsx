"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side logging keeps stack traces off the user's screen.
    console.error(JSON.stringify({ event: "app_error", digest: error?.digest }));
  }, [error]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-kore-bg px-4 text-kore-text">
      <div className="kore-grid-bg pointer-events-none absolute inset-0" aria-hidden />
      <div className="glass glass-sheen relative z-10 flex max-w-md flex-col items-center rounded-3xl p-8 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-kore-danger/40 bg-kore-danger/10">
          <AlertTriangle className="h-7 w-7 text-red-300" aria-hidden />
        </span>
        <p className="font-mono text-xs tracking-widest text-kore-danger">500</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Something went wrong</h1>
        <p className="mt-2 text-sm text-kore-muted">
          An unexpected error occurred. Your data is safe — try again.
          {error?.digest && (
            <>
              <br />
              <span className="font-mono text-xs text-kore-muted/70">
                Reference: {error.digest}
              </span>
            </>
          )}
        </p>
        <button
          onClick={reset}
          className="glass-interactive mt-6 flex items-center gap-2 rounded-full bg-kore-accent px-5 py-2.5 text-sm font-semibold text-black shadow-glow transition hover:bg-white/85"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Try again
        </button>
      </div>
    </main>
  );
}
