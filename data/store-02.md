---
id: "02"
name: Store 02
address: "Chilliwack, BC"
months:
  - label: Jun
    doordash: 140
    ubereats: 108
    instore: 900
    website: 55
    visits: 1260
  - label: Jul
    doordash: 148
    ubereats: 114
    instore: 930
    website: 60
    visits: 1302
  - label: Aug
    doordash: 155
    ubereats: 120
    instore: 955
    website: 65
    visits: 1337
  - label: Sep
    doordash: 162
    ubereats: 126
    instore: 980
    website: 70
    visits: 1372
  - label: Oct
    doordash: 170
    ubereats: 132
    instore: 1000
    website: 75
    visits: 1400
  - label: Nov
    doordash: 179
    ubereats: 139
    instore: 1022
    website: 80
    visits: 1431
printers:
  - name: Counter printer
    status: online
  - name: Packing printer
    status: online
top_dishes:
  - name: Everyday Bowl
    orders: 459
    trend: up
  - name: Harvest Bowl
    orders: 351
    trend: flat
  - name: Miso Carrot Soup
    orders: 236
    trend: up
  - name: Green Juice
    orders: 189
    trend: flat
  - name: Build-Your-Own Bowl
    orders: 185
    trend: down
# Individual orders live in data/orders/store-02.xlsx — that file, not this
# one, is the source of truth for order-level data (regenerate both with
# scripts/generate_orders.py if the channel totals above ever change).
---

Steady store. Online share rising slightly month over month — worth watching next quarter, not acting on yet.
