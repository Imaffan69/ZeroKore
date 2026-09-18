import type { Variants } from "framer-motion";

/**
 * Shared motion primitives.
 *
 * Philosophy (design-motion-principles skill, productivity-tool weighting):
 * - Restraint and speed: 180–450ms, never showy.
 * - Motion communicates hierarchy and continuity, never decoration.
 * - `prefers-reduced-motion` is handled globally in globals.css, which
 *   collapses animation durations; nothing here relies on motion alone.
 */
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Fade + rise. Use for any element entering the viewport. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE },
  },
};

/** Fade only. Use for large surfaces where movement would feel heavy. */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, ease: EASE } },
};

/** Parent wrapper that staggers its children. */
export const staggerGroup = (stagger = 0.05, delayChildren = 0.04): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren } },
});

/** Reveal-on-scroll viewport settings: fire once, slightly before fully visible. */
export const viewportOnce = { once: true, amount: 0.15 } as const;

/** Hover lift used on interactive glass cards. */
export const hoverLift = {
  y: -3,
  transition: { duration: 0.18, ease: EASE },
} as const;

/** Tactile press used on buttons. */
export const press = { scale: 0.975 } as const;
