# Tractor Build Challenge — One Order Book, Every Channel

Dhananjai Lekhi's submission for Tractor's 2026 Build Challenge.

**Live:**
- **[Submission walkthrough →](https://dhanlekhi-sudo.github.io/tractor-build-challenge/)** — an interactive system map of the whole order flow. Click any box to see how that piece works.
- **[Head Office Dashboard →](https://dhanlekhi-sudo.github.io/tractor-build-challenge/dashboard.html)** — the actual product: an admin portal with a head-office rollup, a dashboard per store, drillable KPIs, and a guided tour (click **Take the tour** in the sidebar).

Built as two pages:

1. **[`index.html`](index.html)** — the submission itself, as a diagram-first walkthrough: the DoorDash/Uber Eats integration paths, the order book schema, kitchen/dispatch, the Payout Auditor, and the insights agent team.
2. **[`dashboard.html`](dashboard.html)** — the head-office admin portal: total orders by channel (DoorDash / Uber Eats / in-store / website), a store switcher, monthly trends, and a top-5 trending-dish leaderboard, all computed live from the order book data files.

No build step, no framework — plain HTML/CSS/JS, deployable as-is to GitHub Pages.

## Running it locally

```bash
python3 -m http.server 8743
```

Then open `http://localhost:8743/index.html` (the submission) or `http://localhost:8743/dashboard.html` (the dashboard). You need a local server (not a `file://` URL) because the dashboard fetches the `data/*.md` files.

## Editing the dashboard's data

**Everything the dashboard shows is computed from four files — nothing else to touch:**

```
data/store-01.md
data/store-02.md
data/store-03.md
data/store-04.md
```

Each is plain Markdown with a YAML frontmatter block. Open one in any text editor:

```yaml
---
id: "01"
name: Store 01
address: "Abbotsford, BC"
months:
  - label: Nov
    doordash: 229      # orders from DoorDash this month
    ubereats: 178
    instore: 1132
    website: 101
top_dishes:
  - name: Everyday Bowl
    orders: 412
    trend: up           # up | flat | down
recent_orders:
  - order_no: T-20418
    source: DoorDash     # DoorDash | Uber Eats | In-store | Website
    time: "12:04"
    dish: "Everyday Bowl, no feta"
    total: 24.00
    status: Settled
---
Steady store. Ticket time and on-time rate both sit at or above the network median.
```

Change a number, save, refresh the page. That's it.

- **`months`** drives the monthly trend chart, the channel-mix bars, and the "online share" KPI. Add a new entry to extend the trend; keep the same `label`s across all four store files (the Head Office Overview sums stores month-by-month, so it assumes they line up).
- **`top_dishes`** drives each store's dish leaderboard. The Overview page's leaderboard is the sum of all four stores' dish lists — add a dish to a store file and it'll appear head-office-wide automatically.
- **`recent_orders`** is what shows in that store's **Orders** tab — the literal order-book slice for that store.
- The line of text after the closing `---` is the store's note — it shows as the highlighted callout at the top of that store's Overview tab, and a store is marked **Flagged** in every list if that note starts with the word "Flagged."
- A store's id (`"01"`) must match its filename (`store-01.md`) and is what the URL hash and nav use (`#store-01`, `#store-01/orders`).

To add a **fifth store**: copy one of the four files, change `id`/`name`/`address`, and add `data/store-05.md` to the `ids` array at the top of [`dashboard.js`](dashboard.js) (`loadStores()`).

## How the dashboard is built

- **`dashboard.html` / `dashboard.css` / `dashboard.js`** — the whole app. `dashboard.css` imports `style.css` so both pages share Tractor's brand tokens (colors, type) from one place.
- Routing is a plain hash router (`#overview`, `#store-01`, `#store-01/orders`) — shareable, bookmarkable, no framework.
- Every KPI tile and every ranked-bar row is clickable and opens the drill-down overlay (`openDrill` / `pushDrill` in `dashboard.js`) — the same overlay supports multiple levels deep, with a "← Back" to step up one level.
- Channel colors (`--ch-doordash`, `--ch-ubereats`, `--ch-instore`, `--ch-website` in `style.css`) are a validated color-blind-safe set — see the `dataviz` skill's `scripts/validate_palette.js` if you ever change them; re-validate before shipping a new set.
- The guided tour (`TOUR_STEPS` in `dashboard.js`) is a plain array of `{selector, title, text}` — add a step by adding an entry; it'll scroll to and spotlight whatever element the selector matches.

## Deploying

This is a static site — push to GitHub and turn on **Settings → Pages → Deploy from branch (main, /tractor-build-challenge or root)**, or drag the folder into any static host (Vercel, Netlify, GitHub Pages all work with zero config).

---

*All figures in both the submission and the dashboard are illustrative, not measured Tractor data — see each page's footer.*
