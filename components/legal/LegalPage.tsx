import Link from "next/link";
import { Terminal, ArrowLeft } from "lucide-react";

/**
 * Shared shell for the Terms / Privacy pages: monochrome glass, one column,
 * fully server-rendered (no client JS — legal content must prerender statically).
 */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen bg-kore-bg text-kore-text">
      <div className="kore-ambient pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-sm text-kore-muted transition hover:text-kore-accent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 font-mono text-sm text-kore-muted transition hover:text-white"
          >
            <Terminal className="h-4 w-4 text-kore-accent" aria-hidden />
            ZERO<span className="text-kore-accent">KORE</span>
          </Link>
        </div>

        <div className="glass glass-sheen rounded-3xl p-6 sm:p-10">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 font-mono text-xs uppercase tracking-wider text-kore-muted">
            Last updated: {updated}
          </p>
          <div className="legal-prose mt-8 space-y-6 text-sm leading-relaxed text-kore-text/90">
            {children}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-kore-muted">
          Questions about this document? Contact the site operator through the
          support channel shown on the landing page.
        </p>
      </div>
    </main>
  );
}
