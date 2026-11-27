# Tractor Build Challenge

Dhananjai Lekhi's submission for Tractor's 2026 Build Challenge — a single
static page (`index.html`) that is the head-office admin portal itself: one
order-book rollup, a dashboard per store (switch via the header dropdown or
sidebar), drillable KPIs, a ranked store leaderboard, a guided tour. There was
previously a separate diagram-first "submission" page; it was removed in
favor of just shipping the product. No backend: this is a portfolio/interview
artifact, not a live Tractor system. `dashboard.html` still exists only as a
redirect stub to `./`, for any link shared before the merge.

## Stack
- Plain HTML / CSS / vanilla JS. No framework, no build step, on purpose —
  don't introduce one.
- `js-yaml` (CDN) parses the YAML frontmatter in `data/store-*.md`.
- Hosting: GitHub Pages (`main` branch, root). `.nojekyll` is required — Jekyll
  would otherwise try to render `data/*.md` as pages and break the dashboard's
  raw `fetch()` of them.

## Commands
- Run locally: `python3 -m http.server 8743` from this directory, then open
  `http://localhost:8743/index.html` or `/dashboard.html`. A `file://` URL
  will NOT work — the dashboard fetches `data/*.md` over HTTP.
- No build/test/lint/typecheck step exists or is needed for this stack.

## Hard rules — never violate, never "temporarily" bypass
1. **This repo is public.** Nothing private goes in it — no real Tractor data
   (every figure is explicitly labeled illustrative), no personal data beyond
   what's already public on the submission itself (name, email, phone — that
   was a deliberate choice for the interview context, not an oversight).
2. There are no secrets/env vars in this project. If one is ever introduced
   (an API key for a real integration, say), it must never be committed —
   `.env.local` + a committed `.env.example`, same as every other project.
3. Never push to `main` (= production, since GitHub Pages serves it directly)
   without the fix or feature having been verified in a browser first —
   `main` is live the moment it's pushed, there is no staging.
4. Any change to `dashboard.js`, `dashboard.css` or `style.css` must bump
   the `?v=` stamp everywhere it appears (two places in `index.html`, the
   `@import` in `dashboard.css`). GitHub Pages lets browsers cache every
   file for 10 minutes; without a new stamp a refreshed page can run with
   the previous script — e.g. a "Take the tutorial" button that only closes
   the popup.
5. After any change to `data/store-*.md`'s shape (new fields, renamed keys):
   update all four files together and re-check both the Overview rollup and
   at least one store page — the overview sums across stores assuming they
   share the same `months[].label` sequence.

## Design system
Full spec in `.claude/skills/design-system/SKILL.md` — fonts (serif/sans/mono
by role), the brand palette and the validated 4-channel chart palette, the
motion constants, and which signature patterns (count-up numbers, chart
entrance animation, drill-down continuity, reduced-motion) are implemented.
After building or changing a screen, run `/design-loop <screen>` on it.

## Workflow rules
- Small commits, one concern each, imperative messages (see git log for tone).
- The order book is the single source of truth: `data/store-*.md` holds raw
  per-store numbers; every rollup, chart, and KPI in `dashboard.js` is
  *computed* from those files (`aggregateMonths`, `aggregateDishes`,
  `storeComparison`, etc.) — never hardcode a number that's already derivable.
- Verify before trusting: after changing aggregation logic, sanity-check the
  Overview's totals against the sum of the four stores' own numbers by eye.
- The `security-reviewer` agent is mostly written for apps with auth/DB/env
  vars, which this project has none of — but its checks on "secrets hygiene"
  and "nothing private in a public repo" still apply. Run it after adding any
  new file type (an upload feature, a contact form, etc.) that could
  accidentally introduce one of those.
