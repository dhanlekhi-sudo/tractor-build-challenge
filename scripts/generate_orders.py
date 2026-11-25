#!/usr/bin/env python3
"""
Generates data/orders/store-0X.xlsx — one row per order, every day of the
current month. This is the dashboard's actual source of truth for orders:
dashboard.js reads these files directly in the browser (via SheetJS) for
the Orders tab, the Printers tab's kitchen-screen preview, and every
"view the orders behind this" drill-down.

Channel totals per store are pinned to match data/store-0X.md's `months`
entry for this month exactly, so the daily book reconciles with every
chart on the dashboard. Dish totals are *not* independently guessed —
they're generated here, then printed at the end so store-0X.md's
top_dishes can be updated to match this file instead of the other way
around. Re-run this after changing the channel totals in a store's .md.
"""

import random
from datetime import date, timedelta
from openpyxl import Workbook

random.seed(42)  # reproducible — rerun gives the same book unless inputs change

MONTH_LABEL = "Nov"
YEAR, MONTH, DAYS_IN_MONTH = 2026, 11, 30
TODAY = date(YEAR, MONTH, DAYS_IN_MONTH)  # last day of data = "today" in the story

STORES = {
    "01": {
        "channels": {"doordash": 229, "ubereats": 178, "instore": 1132, "website": 101},
        "dishes": {"Everyday Bowl": 412, "Harvest Bowl": 298, "Miso Carrot Soup": 210, "Green Juice": 180, "Build-Your-Own Bowl": 165},
        "order_no_start": 20001,  # 1000s apart isn't enough headroom for ~1700 rows/store — these are spaced 5000 apart
    },
    "02": {
        "channels": {"doordash": 179, "ubereats": 139, "instore": 1022, "website": 80},
        "dishes": {"Everyday Bowl": 350, "Harvest Bowl": 260, "Miso Carrot Soup": 190, "Green Juice": 150, "Build-Your-Own Bowl": 140},
        "order_no_start": 25001,
    },
    "03": {
        "channels": {"doordash": 272, "ubereats": 211, "instore": 906, "website": 121},
        "dishes": {"Harvest Bowl": 340, "Everyday Bowl": 300, "Miso Carrot Soup": 220, "Green Juice": 210, "Build-Your-Own Bowl": 180},
        "order_no_start": 30001,
    },
    "04": {
        "channels": {"doordash": 123, "ubereats": 96, "instore": 969, "website": 54},
        "dishes": {"Everyday Bowl": 240, "Harvest Bowl": 200, "Miso Carrot Soup": 150, "Green Juice": 120, "Build-Your-Own Bowl": 110},
        "order_no_start": 35001,
    },
}

CHANNEL_SOURCE = {"doordash": "DoorDash", "ubereats": "Uber Eats", "instore": "In-store", "website": "Website"}
BASE_PRICE = {"Everyday Bowl": 15.00, "Harvest Bowl": 15.50, "Miso Carrot Soup": 8.50, "Green Juice": 9.00, "Build-Your-Own Bowl": 16.00}
MODIFIERS = ["", ", no feta", ", extra protein", ", no onion"]

# Lunch-peaked hour weights across an 08:00-20:00 service window
HOUR_WEIGHTS = {8: 2, 9: 3, 10: 4, 11: 10, 12: 18, 13: 14, 14: 6, 15: 4, 16: 4, 17: 7, 18: 9, 19: 5, 20: 2}
LIFECYCLE = ["Received", "Accepted", "Printed", "In prep", "Ready", "Handed off", "Settled"]


def split_across_days(total, days):
    """Random day-weights that sum back to `total` exactly, with mild variation."""
    if total == 0:
        return [0] * days
    weights = [random.uniform(0.6, 1.4) for _ in range(days)]
    scale = total / sum(weights)
    counts = [round(w * scale) for w in weights]
    drift = total - sum(counts)
    step = 1 if drift > 0 else -1
    i = 0
    while drift != 0:
        idx = i % days
        if counts[idx] + step >= 0:
            counts[idx] += step
            drift -= step
        i += 1
    return counts


def weighted_choice(weights_dict):
    items, weights = zip(*weights_dict.items())
    return random.choices(items, weights=weights, k=1)[0]


def random_time_for_day():
    hour = weighted_choice(HOUR_WEIGHTS)
    minute = random.randint(0, 59)
    return hour, minute


def dish_with_modifier(name):
    mod = random.choice(MODIFIERS) if random.random() < 0.35 else ""
    price = BASE_PRICE[name] + (random.uniform(3.5, 5.5) if mod else 0) + random.choice([0, 0.5, 1.0])
    return f"{name}{mod}", round(price, 2)


def generate_store(store_id, cfg):
    rows = []
    order_no = cfg["order_no_start"]
    dish_names = list(cfg["dishes"].keys())
    dish_weights = list(cfg["dishes"].values())
    dish_totals_out = {d: 0 for d in dish_names}

    per_channel_daily = {ch: split_across_days(total, DAYS_IN_MONTH) for ch, total in cfg["channels"].items()}

    for day_idx in range(DAYS_IN_MONTH):
        this_date = date(YEAR, MONTH, 1) + timedelta(days=day_idx)
        is_today = this_date == TODAY
        day_orders = []
        for ch_key, daily_counts in per_channel_daily.items():
            count = daily_counts[day_idx]
            source = CHANNEL_SOURCE[ch_key]
            for _ in range(count):
                dish_name = random.choices(dish_names, weights=dish_weights, k=1)[0]
                dish_totals_out[dish_name] += 1
                dish, total = dish_with_modifier(dish_name)
                hour, minute = random_time_for_day()
                day_orders.append({
                    "order_no": f"T-{order_no}", "date": this_date.isoformat(),
                    "time": f"{hour:02d}:{minute:02d}", "source": source,
                    "dish": dish, "total": total, "_hour": hour, "_minute": minute,
                })
                order_no += 1

        day_orders.sort(key=lambda r: (r["_hour"], r["_minute"]))
        n = len(day_orders)
        for i, row in enumerate(day_orders):
            if is_today and i >= n - max(6, n // 12):
                row["status"] = LIFECYCLE[min(i - (n - max(6, n // 12)), len(LIFECYCLE) - 1)]
            else:
                row["status"] = "Settled"
            del row["_hour"], row["_minute"]
        rows.extend(day_orders)

    return rows, dish_totals_out


def write_xlsx(store_id, rows):
    wb = Workbook()
    ws = wb.active
    ws.title = "Orders"
    headers = ["order_no", "date", "time", "source", "dish", "total", "status"]
    ws.append(headers)
    for r in rows:
        ws.append([r[h] for h in headers])
    for col, width in zip("ABCDEFG", [10, 12, 8, 11, 32, 8, 12]):
        ws.column_dimensions[col].width = width
    path = f"data/orders/store-{store_id}.xlsx"
    wb.save(path)
    return path


if __name__ == "__main__":
    print(f"Generating {MONTH_LABEL} {YEAR} order books (today = {TODAY.isoformat()})\n")
    for store_id, cfg in STORES.items():
        rows, dish_totals = generate_store(store_id, cfg)
        path = write_xlsx(store_id, rows)
        print(f"store-{store_id}: {len(rows)} rows -> {path}")
        print("  top_dishes (paste into data/store-{}.md, trend unchanged):".format(store_id))
        for name, count in sorted(dish_totals.items(), key=lambda kv: -kv[1]):
            print(f"    {name}: {count}")
        print()
