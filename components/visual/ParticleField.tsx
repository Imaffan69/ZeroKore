"use client";

import { useEffect, useRef } from "react";

/**
 * Animated particle field.
 *
 * A real (small) simulation on a canvas: points drift with a velocity, nearby
 * points are linked by lines whose opacity falls off with distance, and the
 * pointer gently pushes the field around. It is decoration, so it is written to
 * be invisible to accessibility and cheap to run:
 *
 *  - `aria-hidden` and `pointer-events-none`: never part of the a11y tree.
 *  - density scales with viewport area and is capped, and the loop is skipped
 *    entirely while the tab is hidden or when reduced motion is requested.
 *  - links are only compared inside a coarse grid neighbourhood, so the cost
 *    stays close to linear instead of quadratic as density grows.
 */

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

export interface ParticleFieldProps {
  /** Particles per 100k px² of viewport. */
  density?: number;
  /** Hard cap on particle count, whatever the viewport size. */
  maxParticles?: number;
  /** Max distance (px) at which two particles are linked. */
  linkDistance?: number;
  /** Overall opacity of the field. */
  opacity?: number;
  className?: string;
  /** Draw links between particles (turn off for a pure starfield). */
  links?: boolean;
}

export default function ParticleField({
  density = 13,
  maxParticles = 130,
  linkDistance = 132,
  opacity = 1,
  className,
  links = true,
}: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let running = true;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.min(
        maxParticles,
        Math.round(((width * height) / 100_000) * density)
      );
      const next: Particle[] = [];
      for (let i = 0; i < target; i++) {
        next.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          r: Math.random() * 1.5 + 0.7,
        });
      }
      particles = next;
    }

    function step() {
      if (!running) return;
      ctx!.clearRect(0, 0, width, height);
      const pointer = pointerRef.current;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around the edges so the field never empties out.
        if (p.x < -12) p.x = width + 12;
        if (p.x > width + 12) p.x = -12;
        if (p.y < -12) p.y = height + 12;
        if (p.y > height + 12) p.y = -12;

        // Gentle pointer repulsion.
        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 16_000 && distSq > 0.01) {
            const force = (1 - distSq / 16_000) * 0.35;
            const dist = Math.sqrt(distSq);
            p.x += (dx / dist) * force;
            p.y += (dy / dist) * force;
          }
        }
      }

      // Links, bucketed by a coarse grid so this stays close to linear.
      if (links) {
        const cell = linkDistance;
        const cols = Math.max(1, Math.ceil(width / cell));
        const buckets = new Map<number, Particle[]>();
        for (const p of particles) {
          const key =
            Math.floor(p.y / cell) * cols + Math.floor(p.x / cell);
          const bucket = buckets.get(key);
          if (bucket) bucket.push(p);
          else buckets.set(key, [p]);
        }
        ctx!.lineWidth = 1;
        for (const p of particles) {
          const cx = Math.floor(p.x / cell);
          const cy = Math.floor(p.y / cell);
          for (let ox = 0; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
              const bucket = buckets.get((cy + oy) * cols + (cx + ox));
              if (!bucket) continue;
              for (const q of bucket) {
                if (q === p) continue;
                const dist = Math.hypot(q.x - p.x, q.y - p.y);
                if (dist > linkDistance) continue;
                ctx!.strokeStyle = `rgba(181,207,160,${
                  (1 - dist / linkDistance) * 0.13
                })`;
                ctx!.beginPath();
                ctx!.moveTo(p.x, p.y);
                ctx!.lineTo(q.x, q.y);
                ctx!.stroke();
              }
            }
          }
        }
      }

      for (const p of particles) {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(181,207,160,0.6)";
        ctx!.fill();
      }

      frameRef.current = requestAnimationFrame(step);
    }

    function onPointerMove(event: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      pointerRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        active: true,
      };
    }
    function onPointerLeave() {
      pointerRef.current.active = false;
    }
    function onVisibility() {
      if (document.hidden) {
        running = false;
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
      } else if (!running) {
        running = true;
        frameRef.current = requestAnimationFrame(step);
      }
    }

    resize();
    window.addEventListener("resize", resize);

    if (reduceMotion) {
      // One static composition: the field is there, nothing moves.
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.34)";
        ctx.fill();
      }
    } else {
      frameRef.current = requestAnimationFrame(step);
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerleave", onPointerLeave);
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      running = false;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [density, maxParticles, linkDistance, links]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{
        opacity,
        width: "100%",
        height: "100%",
        display: "block",
        pointerEvents: "none",
      }}
    />
  );
}
