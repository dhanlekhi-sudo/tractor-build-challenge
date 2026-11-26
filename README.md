# Tractor Build Challenge — One Order Book, Every Channel

Dhananjai Lekhi's submission for Tractor's 2026 Build Challenge — a working
prototype of the head-office admin portal the submission proposes.

**Live: [dhanlekhi-sudo.github.io/tractor-build-challenge →](https://dhanlekhi-sudo.github.io/tractor-build-challenge/)**

An opening screen states the assumptions up front — this is a draft prototype
on mock data, no real database, no production hosting or domain. After that,
every screen is a grid of square, clickable tiles — nothing to scroll through.
Click any tile and its full detail opens in an overlay: a ranked list, a
trend chart, a stacked "channel mix over time" bar chart, and (on every
drill) a **"View the orders behind this"** toggle showing the actual
order-book rows that number is built from. One order-book rollup across all
stores, a dashboard per store (switch with the dropdown in the header or the
sidebar), a ranked store leaderboard, foot traffic, a top-5 trending-dish
leaderboard, a guided tour (click **Take the tour** in the sidebar — it includes an animated demo of an order coming in and being marked Ready or Cancelled), and — per
store — a **Printers** tab: printer status (including a jammed state that
reroutes the print queue) and a kitchen-screen preview of the actual order
tickets. All of it computed live from the order-book data files, nothing
hardcoded twice.

No build step, no framework — plain HTML/CSS/JS, deployable as-is to GitHub
Pages.

## Running it locally

```bash
python3 -m http.server 8743
```

Then open `http://localhost:8743/`. You need a local server (not a `file://`
URL) because the dashboard fetches the `data/*.md` files and `data/orders/*.xlsx`.

## Editing the dashboard's data — two files per store, deliberately separate

**`data/store-0X.md`** — config, small enough to hand-edit:

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
    orders: 564
    trend: up           # up | flat | down
---
Steady store. Ticket time and on-time rate both sit at or above the network median.
```

- **`months`** drives the monthly trend chart, the channel-mix bars, the "online share" KPI, and (via `visits`) the foot-traffic KPI/chart. Add a new entry to extend the trend; keep the same `label`s across all four store files (the Head Office Overview sums stores month-by-month, so it assumes they line up).
- **`printers`** drives that store's **Printers** tab — one card per printer, `status: jammed` shows a jam warning and reroutes that printer's share of the print queue and the kitchen-screen ticket preview to the other printer.
- **`top_dishes`** is a *summary* — see below, it's generated from the Excel file, not typed independently.
- The line of text after the closing `---` is the store's note — it shows as the highlighted callout at the top of that store's Overview tab, and a store is marked **Flagged** in every list if that note starts with the word "Flagged."
- A store's id (`"01"`) must match its filename (`store-01.md`) and is what the URL hash and nav use (`#store-01`, `#store-01/restaurant`; old `#store-01/orders` links still open it).

**`data/orders/store-0X.xlsx`** — real Excel files, the *actual* order book:

One row per order, every day of the month — `order_no, date, time, source, dish, total, status`. These are genuine `.xlsx` files (openable in Excel/Numbers/Google Sheets), read in the browser with [SheetJS](https://sheetjs.com/). This is the source of truth for anything order-level: the **In-restaurant** tab (today's receipts — open orders on top, each with **Ready** and **Cancel** buttons, finished ones below under "Done today", with new orders arriving live), the **Printers** tab's kitchen-screen ticket preview, and every drill-down's **"View the orders behind this"** panel.

Ready / Cancel write the new status into the in-page order book — the same rows the **Database** page and every drill-down read — and save it in the browser's `localStorage` (`tractor.orderStatus.v1`), so it survives a refresh on that computer. The Excel files themselves never change; there's no server. Clear site data to reset.

They're generated, not hand-typed — **`scripts/generate_orders.py`** (needs `openpyxl`: `pip install openpyxl`) builds a full day-by-day book per store, with each day's channel counts summing back to that store's `months` entry in the `.md` file exactly, so the two files always reconcile. Run it after changing a store's channel totals:

```bash
python3 scripts/generate_orders.py
```

It prints each store's resulting dish totals at the end — paste those into that store's `top_dishes` in the `.md` file, so the summary stays a true reflection of the order book rather than an independent guess.

To add a **fifth store**: copy a block in `scripts/generate_orders.py`'s `STORES` dict (give it a non-overlapping `order_no_start`, 5000+ apart from its neighbors), copy a `data/store-0X.md`, re-run the generator, and add `data/store-05.md` to the `ids` array at the top of [`dashboard.js`](dashboard.js) (`loadStores()`).

## How the dashboard is built

- **`index.html` / `dashboard.css` / `dashboard.js`** — the whole app (the HTML file keeps the name `index.html` so it serves at the site root; everything in it is the dashboard). `dashboard.css` imports `style.css` for the shared brand tokens (colors, type). `dashboard.html` is kept only as a redirect, in case that URL was shared anywhere before the site became a single page.
- Routing is a plain hash router (`#overview`, `#database`, `#database/stores`, `#store-01`, `#store-01/restaurant`) — shareable, bookmarkable, no framework.
- **Database** (sidebar, next to Overview) is a raw table browser across all four stores at once — Orders (paginated, 50/page, with a store dropdown and the same channel chips), Stores, Printers, and Dishes. It reads the exact same `STORES`/`allOrdersWithStore()` data every other page does; nothing here is a separate copy.
- Every KPI tile and every ranked-bar row is clickable and opens the drill-down overlay (`openDrill` / `pushDrill` in `dashboard.js`) — the same overlay supports multiple levels deep, with a "← Back" to step up one level, and an `afterRender` hook so a drill can draw its own chart once its markup is in the DOM.
- `sourceOrdersHTML()` appends a collapsible "View the orders behind this" table to a drill, built from the same Excel-derived `store.orders` the In-restaurant tab uses (`ordersForStore`/`ordersForChannel`/`ordersForDish` filter it) — the point is that nothing on this dashboard is a number with no receipt behind it.
- Channel colors (`--ch-doordash`, `--ch-ubereats`, `--ch-instore`, `--ch-website` in `style.css`) are a validated color-blind-safe set — see the `dataviz` skill's `scripts/validate_palette.js` if you ever change them; re-validate before shipping a new set. `drawStackedBarChart` reuses them for the "channel mix over time" chart inside the Online Share / Channel Mix drills.
- The guided tour (`TOUR_STEPS` in `dashboard.js`) is a plain array of `{selector, title, text}` — add a step by adding an entry; it'll scroll to and spotlight whatever element the selector matches. A step can also take `route` (a function returning the hash to open first) and `demo: true` (plays the pretend-order Ready / Cancel animation — DOM-only, it never saves). The tour card is measured and placed fully inside the window every step, and fades while it moves, so it's never cut off.

## Deploying

This is a static site — push to GitHub and turn on **Settings → Pages → Deploy from branch (main, /tractor-build-challenge or root)**, or drag the folder into any static host (Vercel, Netlify, GitHub Pages all work with zero config).

---

*All figures in this dashboard are illustrative, not measured Tractor data.*
