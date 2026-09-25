---
name: zerokore-design-system
description: "Build or change any ZeroKore UI so it matches the product's design language — pure black canvas, sage/mint accents, glass surfaces, mono labels, purposeful motion. Triggers on: build a component, add a page, style, redesign, make it look like ZeroKore, match the aesthetic, dark UI, glass card, landing page, dashboard layout, empty-looking page, first-glance/first-fold issues, responsive/mobile layout, and any visual polish request inside this repo."
---

# ZeroKore design system

ZeroKore is a **black, glass, terminal-inspired** product. Grey is not part of
the palette: surfaces are black, text is white, and colour appears only as the
sage/mint accent. Deviating from this reads as a bug, not a variation.

## Tokens (use these, do not invent hex values)

Defined in `tailwind.config.ts` and `app/globals.css`:

| Token | Value | Use |
|---|---|---|
| `bg-kore-bg` / `#000000` | pure black | page canvas |
| `kore-accent` | `#b5cfa0` (sage) | section labels, icons, links, active tab |
| `#4ade80` | mint | primary call-to-action only |
| `kore-text` | white | headings and primary copy |
| `kore-body` / `kore-muted` | high-contrast off-whites | body and secondary copy |
| `kore-faint` | dimmed white | metadata only — never body text |
| `kore-danger` | red | destructive actions and errors |

Utility classes that already exist — use them instead of hand-rolling:
`glass`, `glass-sheen`, `glass-subtle`, `glass-interactive`, `kore-shell`,
`kore-section`, `kore-hero`, `kore-ambient`, `kore-noise`, `kore-hairline`,
`kore-marquee`.

## Rules

1. **Layout** — `.kore-shell` is the container (max 1240px, responsive gutters).
   Never write fixed pixel widths; use the shell.
2. **Surfaces** — glass cards, `rounded-2xl`/`rounded-3xl`, `border-white/10`.
3. **Type** — tight tracking on headings (`tracking-[-0.02em]` or tighter), body
   at `text-sm`/`text-base` with `leading-relaxed`. Section eyebrows are
   `font-mono text-[10px] tracking-[0.2em] text-kore-muted` and set in caps.
4. **Motion** — import `EASE`, `fadeUp`, `staggerGroup` from `@/lib/motion`.
   Reveal on scroll with `whileInView` + `viewport={{ once: true }}`. Durations
   0.4–0.8s. No bounce, no spin, no decorative looping animation except the
   particle field and marquee.
5. **First glance matters.** A page must communicate its purpose *above the
   fold*: headline, supporting line, primary action, and at least one proof
   element (a stat, a live counter, a real product preview). If content only
   appears after scrolling, the layout is wrong — tighten the hero, do not add
   more height. Never ship a page whose first screen is mostly empty space.
6. **Honest UI** — every number, count, status and button must come from real
   data or a real action. A tile that shows a dash with the word "loading" is
   fine; an invented number is not.
7. **Responsive** — check 360 / 768 / 1024 / 1440. Stack grids below `sm`, keep
   touch targets ≥ 40px, never hide primary content on mobile (`hidden lg:block`
   on the main visual is a bug — let it stack).
8. **Accessibility** — real `<button>`/`<a>`, `aria-label` on icon-only
   controls, visible `focus-visible` ring, contrast above 4.5:1, and respect
   `prefers-reduced-motion` (the particle field already does).

## Check before you finish

Run `npx tsc --noEmit`. Confirm the first screen is full, the accents are
sage/mint on black, and nothing you added is a placeholder.
