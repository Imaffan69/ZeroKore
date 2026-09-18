/**
 * Route-level loading state for the workspace.
 *
 * Mirrors the real dashboard chrome — sidebar rail, header and the two
 * execution/artifact panels — so the transition into the workspace doesn't
 * jump. Uses `animate-pulse` only; no client JS is required.
 */
export default function DashboardLoading() {
  return (
    <div
      className="flex h-dvh w-full overflow-hidden bg-kore-bg text-kore-text"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading your workspace…</span>

      {/* Sidebar rail */}
      <aside
        className="hidden w-72 shrink-0 flex-col border-r border-kore-border lg:flex"
        aria-hidden
      >
        <div className="flex items-center gap-2.5 border-b border-kore-border px-4 py-3.5">
          <span className="h-8 w-8 animate-pulse rounded-lg bg-white/[0.06]" />
          <span className="h-3.5 w-24 animate-pulse rounded bg-white/[0.06]" />
        </div>

        <div className="space-y-3 px-3 py-3">
          <span className="block h-24 animate-pulse rounded-xl bg-white/[0.04]" />
          <span className="block h-14 animate-pulse rounded-xl bg-white/[0.04]" />
          <span className="block h-9 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="space-y-1.5 pt-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className="block h-8 animate-pulse rounded-lg bg-white/[0.03]"
              />
            ))}
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex items-center gap-3 border-b border-kore-border px-4 py-2.5"
          aria-hidden
        >
          <span className="h-4 w-40 animate-pulse rounded bg-white/[0.06]" />
          <span className="ml-auto h-6 w-20 animate-pulse rounded-full bg-white/[0.04]" />
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 p-3 lg:grid-cols-2 lg:gap-3">
          {[0, 1].map((panel) => (
            <section
              key={panel}
              className="min-h-0 space-y-3 overflow-hidden rounded-2xl border border-kore-border p-4"
              aria-hidden
            >
              <span className="block h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
              <div className="space-y-2.5 pt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className="block h-10 animate-pulse rounded-lg bg-white/[0.035]"
                    style={{ width: `${88 - i * 11}%` }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="border-t border-kore-border px-4 py-3" aria-hidden>
          <span className="block h-11 animate-pulse rounded-2xl bg-white/[0.05]" />
        </div>
      </div>
    </div>
  );
}
