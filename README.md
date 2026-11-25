# Tractor Build Challenge — One Order Book, Every Channel

Dhananjai Lekhi's submission for Tractor's 2026 Build Challenge — a working
prototype of the head-office admin portal the submission proposes.

**Live: [dhanlekhi-sudo.github.io/tractor-build-challenge →](https://dhanlekhi-sudo.github.io/tractor-build-challenge/)**

One order-book rollup across all stores, a dashboard per store (switch with
the dropdown in the header or the sidebar), drillable KPIs, a ranked store
leaderboard, and a guided tour (click **Take the tour** in the sidebar).
Total orders by channel (DoorDash / Uber Eats / in-store / website), monthly
trends, foot traffic, a top-5 trending-dish leaderboard, and — per store — a
**Printers** tab: printer status (including a jammed state that reroutes the
print queue), and a kitchen-screen preview of the actual order tickets. All
of it computed live from the order-book data files, nothing hardcoded twice.

No build step, no framework — plain HTML/CSS/JS, deployable as-is to GitHub
Pages.

## Running it locally

```bash
python3 -m http.server 8743
```

Then open `http://localhost:8743/`. You need a local server (not a `file://`
URL) because the dashboard fetches the `data/*.md` files.

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
    visits: 1585        # foot traffic — total visits this month
printers:
  - name: Counter printer
    status: online       # online | jammed
  - name: Packing printer
    status: online
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

- **`months`** drives the monthly trend chart, the channel-mix bars, the "online share" KPI, and (via `visits`) the foot-traffic KPI/chart. Add a new entry to extend the trend; keep the same `label`s across all four store files (the Head Office Overview sums stores month-by-month, so it assumes they line up).
- **`printers`** drives that store's **Printers** tab — one card per printer, `status: jammed` shows a jam warning and reroutes that printer's share of the print-queue mock and the kitchen-screen ticket preview to the other printer.
- **`top_dishes`** drives each store's dish leaderboard. The Overview page's leaderboard is the sum of all four stores' dish lists — add a dish to a store file and it'll appear head-office-wide automatically.
- **`recent_orders`** is what shows in that store's **Orders** tab — the literal order-book slice for that store — and supplies the example tickets on the **Printers** tab's kitchen-screen preview (first `In-store` order → white/counter ticket, first `DoorDash`/`Uber Eats` order → blue/packing ticket).
- The line of text after the closing `---` is the store's note — it shows as the highlighted callout at the top of that store's Overview tab, and a store is marked **Flagged** in every list if that note starts with the word "Flagged."
- A store's id (`"01"`) must match its filename (`store-01.md`) and is what the URL hash and nav use (`#store-01`, `#store-01/orders`).

To add a **fifth store**: copy one of the four files, change `id`/`name`/`address`, and add `data/store-05.md` to the `ids` array at the top of [`dashboard.js`](dashboard.js) (`loadStores()`).

## How the dashboard is built

- **`index.html` / `dashboard.css` / `dashboard.js`** — the whole app (the HTML file keeps the name `index.html` so it serves at the site root; everything in it is the dashboard). `dashboard.css` imports `style.css` for the shared brand tokens (colors, type). `dashboard.html` is kept only as a redirect, in case that URL was shared anywhere before the site became a single page.
- Routing is a plain hash router (`#overview`, `#store-01`, `#store-01/orders`) — shareable, bookmarkable, no framework.
- Every KPI tile and every ranked-bar row is clickable and opens the drill-down overlay (`openDrill` / `pushDrill` in `dashboard.js`) — the same overlay supports multiple levels deep, with a "← Back" to step up one level.
- Channel colors (`--ch-doordash`, `--ch-ubereats`, `--ch-instore`, `--ch-website` in `style.css`) are a validated color-blind-safe set — see the `dataviz` skill's `scripts/validate_palette.js` if you ever change them; re-validate before shipping a new set.
- The guided tour (`TOUR_STEPS` in `dashboard.js`) is a plain array of `{selector, title, text}` — add a step by adding an entry; it'll scroll to and spotlight whatever element the selector matches.

## Deploying

This is a static site — push to GitHub and turn on **Settings → Pages → Deploy from branch (main, /tractor-build-challenge or root)**, or drag the folder into any static host (Vercel, Netlify, GitHub Pages all work with zero config).

---

*All figures in this dashboard are illustrative, not measured Tractor data.*
