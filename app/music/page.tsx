import type { Metadata } from "next";
import Link from "next/link";
import { Music2, ArrowLeft, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Music — ZeroKore",
  description: "The dev team's favourite playlist while shipping ZeroKore.",
};

const SPOTIFY_PLAYLIST_URL =
  "https://open.spotify.com/playlist/6zaSo0C4xQHabpnKUmysGS";

export default function MusicPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-kore-bg text-kore-text">
      <header className="glass-bar sticky top-0 z-10">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3.5 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-kore-muted transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 py-16 sm:px-8">
        <div className="glass glass-sheen glass-interactive w-full rounded-3xl p-8 text-center sm:p-12">
          <span className="glass-accent mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl">
            <Music2 className="h-6 w-6 text-white" aria-hidden />
          </span>
          <h1 className="text-balance text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
            Dev favourites
          </h1>
          <p className="mx-auto mt-3 max-w-md text-pretty text-base leading-relaxed text-kore-muted">
            What the ZeroKore team listens to while the agent works. Open the
            playlist on Spotify and ship along.
          </p>
          <a
            href={SPOTIFY_PLAYLIST_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="group mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Music2 className="h-4 w-4" aria-hidden />
            Listen on Spotify
            <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </a>
        </div>
      </main>
    </div>
  );
}
