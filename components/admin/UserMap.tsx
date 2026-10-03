"use client";

import { useMemo, useState } from "react";
import { ExternalLink, KeyRound, Map as MapIcon } from "lucide-react";

/**
 * One user's own map, plotted from the coordinates resolved for their IP.
 *
 * Two providers, because neither is reliably available everywhere:
 *  - OpenStreetMap's `export/embed.html` needs no key and no script, so it is
 *    the default and works on a fresh deployment.
 *  - Google retired its keyless iframe embed (it now 404s), so the Google tab
 *    uses the Embed API and renders only once NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 *    exists; without it the tab explains what is missing and offers a plain
 *    link to Google Maps, which needs no key at all.
 *
 * Either way no mapping SDK is bundled: an admin page that loads a third-party
 * tracking bundle would leak who is looking at the panel. The iframe is mounted
 * only once a card is opened — fifty open users would otherwise mean fifty
 * requests to someone else's servers.
 */

export type MapProvider = "osm" | "google";

export interface UserMapProps {
  latitude: number;
  longitude: number;
  /** Shown on the marker and in the accessible name, e.g. "ada · 1.2.3.4". */
  label: string;
  /** Sub-label under the coordinates, e.g. the city or device. */
  caption?: string | null;
  provider?: MapProvider;
  onProviderChange?: (provider: MapProvider) => void;
}

/** Degrees of longitude/latitude around the point — roughly a city view. */
const SPAN = 0.35;

/** Inlined at build time. Empty means Google Maps has no Embed API key here, and
 *  the Google tab falls back to explaining that instead of loading a map. */
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function clampLat(lat: number): number {
  return Math.max(-85, Math.min(85, lat));
}

export default function UserMap({
  latitude,
  longitude,
  label,
  caption,
  provider: controlled,
  onProviderChange,
}: UserMapProps) {
  const [internal, setInternal] = useState<MapProvider>("osm");
  const provider = controlled ?? internal;

  const setProvider = (next: MapProvider) => {
    if (onProviderChange) onProviderChange(next);
    else setInternal(next);
  };

  const { src, googleLink } = useMemo(() => {
    const lat = clampLat(latitude);
    const lon = longitude;
    const box = [
      Math.max(-180, lon - SPAN),
      Math.max(-85, lat - SPAN / 2),
      Math.min(180, lon + SPAN),
      Math.min(85, lat + SPAN / 2),
    ].join(",");
    return {
      src:
        provider === "google" && GOOGLE_MAPS_KEY
          ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(
              GOOGLE_MAPS_KEY
            )}&q=${lat},${lon}&zoom=11`
          : `https://www.openstreetmap.org/export/embed.html?bbox=${box}&layer=mapnik&marker=${lat},${lon}`,
      googleLink: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
    };
  }, [latitude, longitude, provider]);

  const rounded = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <MapIcon className="h-3.5 w-3.5 shrink-0 text-kore-accent" aria-hidden />
          <span className="truncate font-mono text-[11px] text-white">{rounded}</span>
        </span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setProvider("google")}
            aria-pressed={provider === "google"}
            className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
              provider === "google"
                ? "bg-kore-accent text-black"
                : "text-kore-muted hover:bg-white/5 hover:text-white"
            }`}
          >
            Google
          </button>
          <button
            type="button"
            onClick={() => setProvider("osm")}
            aria-pressed={provider === "osm"}
            className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
              provider === "osm"
                ? "bg-kore-accent text-black"
                : "text-kore-muted hover:bg-white/5 hover:text-white"
            }`}
          >
            OSM
          </button>
          <a
            href={googleLink}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-full p-1 text-kore-muted transition hover:bg-white/5 hover:text-white"
            aria-label={`Open ${rounded} in Google Maps`}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </span>
      </div>

      {provider === "google" && !GOOGLE_MAPS_KEY ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2 px-5 text-center">
          <KeyRound className="h-4 w-4 text-kore-muted" aria-hidden />
          <p className="text-xs text-kore-text">
            Google retired its keyless map embed. Add a Maps Embed API key as{" "}
            <span className="font-mono text-kore-accent">
              NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
            </span>{" "}
            to plot this user on Google Maps.
          </p>
          <a
            href={googleLink}
            target="_blank"
            rel="noreferrer noopener"
            className="font-mono text-[11px] text-kore-muted underline underline-offset-4 hover:text-white"
          >
            open {rounded} in Google Maps
          </a>
        </div>
      ) : (
        <iframe
          key={provider}
          src={src}
          title={`Map of ${label}${caption ? ` — ${caption}` : ""}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block h-56 w-full border-0"
          /* Dark, monochrome tiles so the widget matches the panel instead of
             punching a bright rectangle into it. */
          style={{ filter: "grayscale(1) invert(0.92) contrast(0.86) brightness(1.05)" }}
        />
      )}

      <p className="border-t border-white/10 px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] text-kore-muted">
        {caption ? `${caption} · ` : ""}
        {Math.abs(latitude).toFixed(4)}° {latitude < 0 ? "S" : "N"},{" "}
        {Math.abs(longitude).toFixed(4)}° {longitude < 0 ? "W" : "E"}
      </p>
    </div>
  );
}