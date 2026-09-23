import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Rocket, Tag, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSiteFlags, CURRENT_VERSION } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Changelog — ZeroKore",
  description:
    "Every ZeroKore release: new features, fixes, model changes and platform updates.",
};

export const dynamic = "force-dynamic";

interface Release {
  id: string;
  title: string;
  body: string;
  version: string | null;
  created_at: string;
}

/**
 * Changelog.
 *
 * Releases are published from the hidden control panel (`/kore/admin` →
 * Announcements, kind = `changelog`), and the row's `version` column becomes the
 * release tag. Until the first release is published the page shows the current
 * build honestly rather than inventing history.
 */
export default async function ChangelogPage() {
  let releases: Release[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("announcements")
      .select("id, title, body, version, created_at")
      .eq("active", true)
      .eq("kind", "changelog")
      .order("created_at", { ascending: false })
      .limit(50);
    releases = (data as Release[] | null) ?? [];
  } catch {
    releases = [];
  }

  const flags = await getSiteFlags();

  return (
    <main className="min-h-dvh w-full bg-black text-kore-text">
      <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-kore-muted transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back
        </Link>

        <header className="mt-6">
          <p className="font-mono text-[10px] tracking-[0.24em] text-kore-muted">
            RELEASES
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
            Changelog
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-kore-muted">
            What shipped, in order. Releases are published from the control
            panel, so this page is the record of record rather than a marketing
            summary.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-kore-muted">
              <Tag className="h-3 w-3" aria-hidden />
              current build {CURRENT_VERSION}
            </span>
            {flags.maintenance && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-amber-200">
                <Wrench className="h-3 w-3" aria-hidden />
                maintenance in progress
              </span>
            )}
          </div>
        </header>

        {releases.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-8">
            <Rocket className="mb-3 h-5 w-5 text-kore-accent" aria-hidden />
            <p className="text-sm font-medium text-white">
              No releases published yet
            </p>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-kore-muted">
              Every future update lands here the moment it is published — new
              agent tools, model changes and platform work, tagged with the
              version that carried them.
            </p>
          </div>
        ) : (
          <ol className="mt-10 space-y-4">
            {releases.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {r.version && (
                    <span className="rounded-full border border-kore-accent/40 bg-kore-accent/10 px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] text-kore-accent">
                      {r.version}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-kore-faint">
                    {r.created_at.slice(0, 10)}
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-semibold tracking-tight text-white">
                  {r.title}
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-kore-muted">
                  {r.body}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}
