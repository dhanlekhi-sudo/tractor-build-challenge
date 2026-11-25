---
id: "01"
name: Store 01
address: "Abbotsford, BC"
months:
  - label: Jun
    doordash: 190
    ubereats: 150
    instore: 980
    website: 70
    visits: 1372
  - label: Jul
    doordash: 200
    ubereats: 158
    instore: 1000
    website: 75
    visits: 1400
  - label: Aug
    doordash: 208
    ubereats: 165
    instore: 1030
    website: 80
    visits: 1442
  - label: Sep
    doordash: 215
    ubereats: 170
    instore: 1060
    website: 88
    visits: 1484
  - label: Oct
    doordash: 222
    ubereats: 174
    instore: 1095
    website: 95
    visits: 1533
  - label: Nov
    doordash: 229
    ubereats: 178
    instore: 1132
    website: 101
    visits: 1585
printers:
  - name: Counter printer
    status: online
  - name: Packing printer
    status: online
top_dishes:
  - name: Everyday Bowl
    orders: 564
    trend: up
  - name: Harvest Bowl
    orders: 349
    trend: up
  - name: Miso Carrot Soup
    orders: 313
    trend: flat
  - name: Green Juice
    orders: 208
    trend: down
  - name: Build-Your-Own Bowl
    orders: 206
    trend: up
# Individual orders live in data/orders/store-01.xlsx — that file, not this
# one, is the source of truth for order-level data (regenerate both with
# scripts/generate_orders.py if the channel totals above ever change).
---

Steady store. Ticket time and on-time rate both sit at or above the network median this week.
