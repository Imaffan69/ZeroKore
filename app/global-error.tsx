"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Honest client-side logging only; server logs stay server-side.
    console.error("ZeroKore route error:", error.message);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">
        <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-4">
          <div className="kore-ambient pointer-events-none absolute inset-0" aria-hidden />
          <div className="glass glass-sheen relative z-10 flex w-full max-w-md flex-col items-center rounded-3xl p-8 text-center">
            <span className="glass-subtle mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
              <TriangleAlert className="h-7 w-7 text-amber-300" aria-hidden />
            </span>
            <p className="font-mono text-xs tracking-[0.28em] text-kore-muted">
              SOMETHING BROKE
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              This page crashed, honestly.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-kore-muted">
              No fake recovery — the error is logged and your work is untouched.
              Try again, or head back to safety.
            </p>
            {error.digest && (
              <p className="mt-3 font-mono text-[11px] text-kore-faint">
                ref {error.digest}
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/85"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Try again
              </button>
              <Link
                href="/dashboard"
                className="glass glass-interactive inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold text-kore-text hover:text-white"
              >
                Your workspace
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}