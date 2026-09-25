"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { MAP_WIDTH, MAP_HEIGHT, WORLD_PATHS, projectPoint } from "@/lib/world-map";
import { EASE } from "@/lib/motion";

/**
 * Where your users are, plotted from real coordinates.
 *
 * Every marker is a sign-in that carried a resolved latitude/longitude — the
 * panel never guesses a position from an IP string, and rows without a
 * coordinate are simply not drawn. Equirectangular projection means a point is
 * placed with two lines of maths, so there is no mapping SDK, no API key and no
 * third-party script loading an admin page and observing who looks at it.
 *
 * Pure black and white with the sage accent, per the product's design system:
 * land is a hairline, active markers are the only colour on screen.
 */

export interface MapPoint {
  id: string;
  user: string;
  event: string;
  country: string | null;
  city: string | null;
  ip: string | null;
  latitude: number | null;
  longitude: number | null;
  at: string;
}

function markerColor(event: string): string {
  if (event === "login" || event === "signup") return "#4ade80";
  if (event === "mfa_verify" || event === "password_change") return "#fbbf24";
  return "#b5cfa0";
}

export default function VisitorMap({ points }: { points: MapPoint[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const placed = useMemo(
    () =>
      points
        .map((p) => {
          const pos = projectPoint(p.latitude, p.longitude);
          return pos ? { ...p, x: pos.x, y: pos.y } : null;
        })
        .filter((p): p is MapPoint & { x: number; y: number } => p !== null),
    [points]
  );

  if (placed.length === 0) {
    return (
      <div className="glass rounded-2xl p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <MapPin className="h-4 w-4 text-kore-accent" aria-hidden />
          Where your users are
        </h3>
        <p className="mt-2 text-xs text-kore-muted">
          No sign-in has resolved to coordinates yet. Locations appear here as soon
          as activity is recorded.
        </p>
      </div>
    );
  }

  const active = hovered ? placed.find((p) => p.id === hovered) : null;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <MapPin className="h-4 w-4 text-kore-accent" aria-hidden />
          Where your users are
        </h3>
        <span className="font-mono text-[10px] tracking-[0.18em] text-kore-muted">
          {placed.length} LOCATED
        </span>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-xl border border-white/10 bg-black">
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          className="block w-full"
          role="img"
          aria-label={`World map showing ${placed.length} recorded sign-in locations`}
        >
          {/* graticule */}
          {[0.25, 0.5, 0.75].map((f) => (
            <g key={f} stroke="rgba(255,255,255,0.05)" strokeWidth="1">
              <line x1={0} y1={MAP_HEIGHT * f} x2={MAP_WIDTH} y2={MAP_HEIGHT * f} />
              <line x1={MAP_WIDTH * f} y1={0} x2={MAP_WIDTH * f} y2={MAP_HEIGHT} />
            </g>
          ))}

          {/* land: a hairline, not a fill — the markers are the subject */}
          <g fill="rgba(255,255,255,0.045)" stroke="rgba(255,255,255,0.16)" strokeWidth="0.6">
            {WORLD_PATHS.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>

          {/* markers */}
          {placed.map((p, i) => {
            const isHot = hovered === p.id;
            const r = isHot ? 7 : 4.5;
            return (
              <g
                key={p.id}
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                <circle cx={p.x} cy={p.y} r={11} fill={markerColor(p.event)} opacity={0.12} />
                <motion.circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={markerColor(p.event)}
                  stroke="#000"
                  strokeWidth="1.5"
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, delay: i * 0.03, ease: EASE }}
                />
                {/* Accessible name for screen readers on each plotted point. */}
                <title>
                  {`${p.city ?? p.country ?? "Unknown"}, ${p.user} — ${p.event}`}
                </title>
              </g>
            );
          })}
        </svg>

        {active && (
          <div className="pointer-events-none absolute bottom-2 left-2 right-2 rounded-lg border border-white/10 bg-black/90 px-3 py-2 backdrop-blur">
            <p className="truncate font-mono text-[11px] text-white">
              {[active.city, active.country].filter(Boolean).join(", ") || "Unknown"}
            </p>
            <p className="truncate font-mono text-[10px] text-kore-muted">
              {active.user} · {active.event}
              {active.ip ? ` · ${active.ip}` : ""}
            </p>
          </div>
        )}
      </div>

      <p className="mt-3 font-mono text-[10px] text-kore-muted">
        EQUIRECTANGULAR · APPROXIMATE · FROM RESOLVED IP GEOLOCATION
      </p>
    </div>
  );
}
