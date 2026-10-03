"use client";

import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Map as MapIcon } from "lucide-react";

/**
 * One user's own map, plotted from the coordinates resolved for their IP.
 *
 * OpenStreetMap only, and deliberately so:
 *  - `www.openstreetmap.org/export/embed.html` needs **no API key**, no account
 *    and no signup, so a deployment cannot end up with a dead map because a key
 *    was never added.
 *  - OpenStreetMap is independent, non-commercial and run on donated
 *    infrastructure. Nothing about who is looking at an admin panel — or which
 *    of its users is where — is handed to an ad company.
 *  - No mapping SDK is bundled at all: the widget is a plain iframe, so the
 *    admin page never loads a third-party tracking bundle.
 *
 * The iframe mounts only when a card is opened. Fifty open users would
 * otherwise mean fifty map requests to someone else's servers.
 */

/** Degrees of longitude/latitude around the point — roughly a city view. */
const SPAN = 0.35;

export interface UserMapProps {
  latitude: number;
  longitude: number;
  /** Shown in the map's accessible name, e.g. "ada · 1.2.3.4". */
  label: string;
  /** Sub-label under the coordinates, e.g. the city. */
  caption?: string | null;
}

function clampLat(lat: number): number {
  return Math.max(-85, Math.min(85, lat));
}

export default function UserMap({ latitude, longitude, label, caption }: UserMapProps) {
  const [copied, setCopied] = useState(false);

  const { src, osmLink } = useMemo(() => {
    const lat = clampLat(latitude);
    const lon = longitude;
    const box = [
      Math.max(-180, lon - SPAN),
      Math.max(-85, lat - SPAN / 2),
      Math.min(180, lon + SPAN),
      Math.min(85, lat + SPAN / 2),
    ].join(",");
    return {
      src: `https://www.openstreetmap.org/export/embed.html?bbox=${box}&layer=mapnik&marker=${lat},${lon}`,
      osmLink: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=13/${lat}/${lon}`,
    };
  }, [latitude, longitude]);

  const rounded = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

  async function copyCoordinates() {
    try {
      await navigator.clipboard.writeText(rounded);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused; the coordinates are on screen anyway.
    }
  }

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
            onClick={copyCoordinates}
            aria-label={`Copy ${rounded}`}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-kore-muted transition hover:bg-white/5 hover:text-white"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" aria-hidden /> copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" aria-hidden /> copy
              </>
            )}
          </button>
          <a
            href={osmLink}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-full p-1 text-kore-muted transition hover:bg-white/5 hover:text-white"
            aria-label={`Open ${rounded} on OpenStreetMap`}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </span>
      </div>

      <iframe
        src={src}
        title={`Map of ${label}${caption ? ` — ${caption}` : ""}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block h-56 w-full border-0"
        /* Dark, monochrome tiles so the widget matches the panel instead of
           punching a bright rectangle into it. */
        style={{ filter: "grayscale(1) invert(0.92) contrast(0.86) brightness(1.05)" }}
      />

      <p className="border-t border-white/10 px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] text-kore-muted">
        {caption ? `${caption} · ` : ""}
        {Math.abs(latitude).toFixed(4)}° {latitude < 0 ? "S" : "N"},{" "}
        {Math.abs(longitude).toFixed(4)}° {longitude < 0 ? "W" : "E"}
        {" · OPENSTREETMAP"}
      </p>
    </div>
  );
}