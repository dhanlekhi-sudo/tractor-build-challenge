---
id: "03"
name: Store 03
address: "Langley, BC"
months:
  - label: Jun
    doordash: 190
    ubereats: 140
    instore: 1010
    website: 70
    visits: 1414
  - label: Jul
    doordash: 205
    ubereats: 152
    instore: 985
    website: 80
    visits: 1379
  - label: Aug
    doordash: 220
    ubereats: 165
    instore: 965
    website: 92
    visits: 1351
  - label: Sep
    doordash: 238
    ubereats: 178
    instore: 945
    website: 102
    visits: 1323
  - label: Oct
    doordash: 255
    ubereats: 195
    instore: 925
    website: 112
    visits: 1295
  - label: Nov
    doordash: 272
    ubereats: 211
    instore: 906
    website: 121
    visits: 1268
printers:
  - name: Counter printer
    status: online
  - name: Packing printer
    status: jammed
top_dishes:
  - name: Harvest Bowl
    orders: 421
    trend: up
  - name: Everyday Bowl
    orders: 318
    trend: up
  - name: Green Juice
    orders: 271
    trend: up
  - name: Miso Carrot Soup
    orders: 251
    trend: up
  - name: Build-Your-Own Bowl
    orders: 249
    trend: flat
# Individual orders live in data/orders/store-03.xlsx — that file, not this
# one, is the source of truth for order-level data (regenerate both with
# scripts/generate_orders.py if the channel totals above ever change).
---

Flagged. Ticket time is 8:05 against a 6:40 network median, on-time has dropped to 84%, and online share is highest in the network at 40% and still rising fastest here. Packing station is the likely bottleneck at lunch, not the kitchen.
