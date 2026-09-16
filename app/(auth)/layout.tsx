import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/lib/theme";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen flex-col bg-kore-bg text-kore-text">
      <div className="kore-grid-bg pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-kore-accent/20 blur-3xl"
        aria-hidden
      />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-5 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-kore-muted transition hover:text-kore-accent"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to home
        </Link>
        <ThemeToggle />
      </header>
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <Suspense
          fallback={<div className="text-sm text-kore-muted">Loading…</div>}
        >
          {children}
        </Suspense>
      </div>
    </main>
  );
}
