---
name: design-system
description: The design and motion specification for the Tractor Build Challenge site (index.html + dashboard.html). Use when building or modifying any UI screen, component, chart, or transition, and when reviewing screenshots for design quality.
---

# Design & Motion System — Tractor Build Challenge

## Type & layout
- Serif for ideas, sans for facts, mono for data — this is Tractor's own rule
  (stated on the submission's "My taste" panel), not a generic choice:
  - Display/headline: `Fraunces` (serif) — section titles, hero, panel titles.
  - Body/UI: `Inter` (sans) — paragraphs, nav, buttons, stat-tile values.
  - Data/labels: `JetBrains Mono` — eyebrows, tags, table cells, order IDs.
- 4px spacing grid, cards at `12-16px` radius, hairline `1px solid var(--line)`
  border (NOT shadow-only — the brand uses visible hairlines deliberately,
  e.g. node cards, table rows). Shadow is reserved for hover lift and the
  overlay panel, never a resting card.
- Tabular vs. proportional figures: **resolved, don't "fix" this** — hero/KPI
  values use the font's default proportional figures (dataviz skill's
  guidance: tabular-nums makes a 3-digit number look loose at display size).
  Reserve `tabular-nums` for literal table columns (`.data td`) and the
  Orders tab, where digits must align vertically.

## Palette — defined once in style.css `:root`, reused everywhere
| Token | Hex | Role |
|---|---|---|
| `--green-950` / `--green-900` / `--green-800` | `#0e1912` / `#152821` / `#1d3329` | dark surfaces (hero, footer, sidebar, hub node, mockwin bars) |
| `--cream-050` / `--cream-100` | `#faf7f0` / `#f3efe4` | page background / hover tint |
| `--ink-900` / `--ink-600` / `--ink-400` | `#19201b` / `#5c6358` / `#8d9487` | primary / secondary / muted text |
| `--magenta-600` | `#c23f78` | the ONE accent — decisions, "to solve", active nav, CTAs. Never decorative. |
| `--sage-700` | `#2f5940` | "built/live" status, default chart line |
| `--ch-doordash` `--ch-ubereats` `--ch-instore` `--ch-website` | `#2a78d6` `#eb6834` `#1baf7a` `#eda100` | the dashboard's categorical channel colors — validated colorblind-safe via the `dataviz` skill's `scripts/validate_palette.js`. **Re-run that validator before ever changing one of these four.** |

## Motion constants — one source of truth: `--ease` in style.css
- `--ease: cubic-bezier(0.16, 1, 0.3, 1)` (Apple-style ease-out). Used for every
  transition in both `style.css` and `dashboard.css` — don't introduce a second
  curve.
- Opacity/transform fades: 0.18–0.45s depending on scale (hover = fast, panel
  morph = slow). Nothing exceeds ~0.7s (the guided-tour spotlight move is the
  slowest, deliberately, since it's narrating).
- Nothing bounces. No elastic/spring overshoot anywhere on this site.

## Signature patterns (status: see below — some are implemented, some are the
## concrete next improvements when this skill was installed)
1. **Count-up numbers** — ✅ implemented (`animateCountUp` in `dashboard.js`).
   KPI tile values count up from 0 once per render; instant under
   `prefers-reduced-motion`.
2. **Card → detail continuity** — ✅ implemented. The drill-down overlay
   (`openDrill`/`pushDrill`) scales up from the clicked element's screen
   position (`transform-origin` set from the click event), not a generic
   center-modal.
3. **Chart entrance** — ✅ implemented. The line chart's path draws in via
   `stroke-dasharray`/`stroke-dashoffset` once per draw call; the KPI
   sparkline does not re-animate on hover.
4. **Drill-down panel** — ✅ implemented (`.drill-panel` scale+fade, `--ease`).
5. **Skeletons** — not implemented. The dashboard's first paint shows a plain
   "Loading order book…" line (see `dashboard.html`) rather than a skeleton
   matching the final layout. Acceptable for now because the fetch of four
   small local `.md` files is near-instant; revisit if data loading ever
   becomes slow enough to be visible.

## Non-negotiables
- `prefers-reduced-motion` is respected globally (see the media query in
  `style.css` / `dashboard.css`): transitions shorten to ~1ms, count-ups show
  the final value instantly, the chart line draws in without animation.
- No layout shift after load — connector lines and charts redraw via
  `ResizeObserver`/`fonts.ready` rather than ever leaving a stale position.
- Hover: lift `translateY(-2px to -3px)` + shadow, or a border-color change.
  No scale above ~1.01 except the overlay panel's own open/close scale.
- Loading/empty/error states: the dashboard has a minimal loading line (see
  above); there is no empty state (the four stores are static data files, so
  "no stores" can't occur) and no error state UI if a fetch fails — a fetch
  failure currently just leaves the page on the loading line. If this becomes
  a real product rather than a portfolio piece, add a visible fetch-error
  message in `dashboard.js`'s `boot()` catch path.
