import Link from "next/link";
import { Megaphone, Rocket, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

interface Banner {
  id: string;
  kind: string;
  title: string;
  body: string;
  version: string | null;
}

/**
 * Site-wide announcement strip.
 *
 * Reads the most recent active banner rows that the staff published from the
 * control panel. RLS on `announcements` exposes only `active = true` rows, so
 * this server component needs no service key and still cannot leak a draft.
 *
 * Nothing is rendered when there is no live announcement — an empty strip is
 * worse than no strip.
 */
export default async function SiteBanner() {
  let banner: Banner | null = null;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("announcements")
      .select("id, kind, title, body, version")
      .eq("active", true)
      .in("kind", ["banner", "changelog"])
      .order("created_at", { ascending: false })
      .limit(1);
    banner = (data?.[0] as Banner | undefined) ?? null;
  } catch {
    return null; // a pending migration or outage never blocks the page
  }

  if (!banner) return null;

  const isUpdate = banner.kind === "changelog";

  return (
    <aside
      aria-label={isUpdate ? "Latest release" : "Announcement"}
      className="relative z-40 border-b border-white/10 bg-white/[0.03] px-4 py-2.5 backdrop-blur"
    >
      <div className="kore-shell flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs">
        {isUpdate ? (
          <Rocket className="h-3.5 w-3.5 shrink-0 text-kore-accent" aria-hidden />
        ) : (
          <Megaphone className="h-3.5 w-3.5 shrink-0 text-kore-accent" aria-hidden />
        )}
        {banner.version && (
          <span className="rounded-full border border-kore-accent/40 bg-kore-accent/10 px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] text-kore-accent">
            {banner.version}
          </span>
        )}
        <span className="font-medium text-white">{banner.title}</span>
        <span className="text-kore-muted">{banner.body}</span>
        <Link
          href={isUpdate ? "/changelog" : "/blog"}
          className="text-kore-accent underline decoration-kore-accent/40 underline-offset-2 transition hover:decoration-kore-accent"
        >
          {isUpdate ? "Full changelog" : "Details"}
        </Link>
      </div>
    </aside>
  );
}

/** Rendered by the root layout when maintenance mode is on for this viewer. */
export function MaintenanceBanner({ message }: { message: string }) {
  return (
    <aside
      role="alert"
      className="relative z-40 border-b border-amber-400/20 bg-amber-400/[0.07] px-4 py-2.5 text-center text-xs text-amber-100"
    >
      <span className="inline-flex flex-wrap items-center justify-center gap-2">
        <Wrench className="h-3.5 w-3.5" aria-hidden />
        <span className="font-medium">Maintenance mode is on.</span>
        <span className="text-amber-100/80">
          {message || "Some features may be unavailable while we ship an update."}
        </span>
      </span>
    </aside>
  );
}