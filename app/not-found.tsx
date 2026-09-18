import Link from "next/link";
import { Compass } from "lucide-react";

export const metadata = { title: "404 — ZeroKore" };

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-kore-bg px-4 text-kore-text">
      <div className="kore-ambient pointer-events-none absolute inset-0" aria-hidden />
      <div className="glass glass-sheen relative z-10 flex max-w-md flex-col items-center rounded-3xl p-8 text-center">
        <span className="glass-accent mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
          <Compass className="h-7 w-7 text-kore-accent" aria-hidden />
        </span>
        <p className="font-mono text-xs tracking-widest text-kore-accent">404</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Page not found</h1>
        <p className="mt-2 text-sm text-kore-muted">
          This route doesn&apos;t exist in the workspace. It may have been
          moved, or the address is wrong.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/"
            className="glass-interactive rounded-full bg-kore-accent px-5 py-2.5 text-sm font-semibold text-black shadow-glow transition hover:bg-white/85"
          >
            Go home
          </Link>
          <Link
            href="/login"
            className="glass glass-interactive rounded-full px-5 py-2.5 text-sm font-semibold text-kore-text hover:text-white"
          >
            Login
          </Link>
        </div>
      </div>
    </main>
  );
}
