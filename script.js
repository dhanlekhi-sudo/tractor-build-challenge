/* ============================================================
   Tractor Build Challenge — interactive system map
   Vanilla JS: SVG connector routing + morph overlay + panel content.
   ============================================================ */

/* ---------------- connector routing ---------------- */

const DIAGRAM = document.getElementById('diagram');
const SVG_NS = 'http://www.w3.org/2000/svg';
const connectorsSvg = document.getElementById('connectors');

const CONNECTIONS = [
  ['#ch-counter', '#node-adapter-generic', 'built'],
  ['#ch-kiosk', '#node-adapter-generic', 'built'],
  ['#ch-catering', '#node-adapter-generic', 'built'],
  ['#ch-pickup', '#node-adapter-generic', 'built'],
  ['#ch-delivery', '#node-adapter-quote', 'solve'],
  ['#ch-doordash', '#node-adapter-doordash', 'solve'],
  ['#ch-ubereats', '#node-adapter-ubereats', 'solve'],
  ['#node-adapter-generic', '#node-orderbook', 'built'],
  ['#node-adapter-quote', '#node-orderbook', 'solve'],
  ['#node-adapter-doordash', '#node-orderbook', 'solve'],
  ['#node-adapter-ubereats', '#node-orderbook', 'solve'],
  ['#node-orderbook', '#node-kitchen', 'built'],
  ['#node-orderbook', '#node-dispatch', 'solve'],
  ['#node-orderbook', '#node-money', 'built'],
  ['#node-orderbook', '#node-metrics', 'built'],
  ['#node-orderbook', '#node-guests', 'built'],
];

function pointAt(el, side) {
  const r = el.getBoundingClientRect();
  const c = DIAGRAM.getBoundingClientRect();
  return {
    x: (side === 'right' ? r.right : r.left) - c.left,
    y: r.top - c.top + r.height / 2,
  };
}

function drawConnectors() {
  if (window.innerWidth <= 880) { connectorsSvg.innerHTML = ''; return; }
  connectorsSvg.innerHTML = '';
  CONNECTIONS.forEach(([fromSel, toSel, status]) => {
    const from = document.querySelector(fromSel);
    const to = document.querySelector(toSel);
    if (!from || !to) return;
    const p1 = pointAt(from, 'right');
    const p2 = pointAt(to, 'left');
    const dx = Math.max(24, (p2.x - p1.x) * 0.5);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`);
    path.setAttribute('class', `connector ${status === 'solve' ? 'connector--solve' : 'connector--live'}`);
    connectorsSvg.appendChild(path);
  });
}

window.addEventListener('load', drawConnectors);
window.addEventListener('resize', () => requestAnimationFrame(drawConnectors));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawConnectors);

/* ---------------- panel content ---------------- */

const PANELS = {

  channels: {
    eyebrow: 'Ask 01 · Channels & Adapters',
    title: 'DoorDash and Uber Eats, joined to one order book',
    body: `
      <div class="section-label">How it looks — adapter status</div>
      <div class="mockwin">
        <div class="mockwin__bar"><span></span><span></span><span></span><div class="mockwin__title">adapters — connection status</div></div>
        <div class="mockwin__body connection-list">
          <div class="connection-row"><span><span class="dot connected"></span>Front counter</span><span class="status-text">Connected</span></div>
          <div class="connection-row"><span><span class="dot connected"></span>Kiosk</span><span class="status-text">Connected</span></div>
          <div class="connection-row"><span><span class="dot connected"></span>Catering</span><span class="status-text">Connected</span></div>
          <div class="connection-row"><span><span class="dot connected"></span>Website pickup</span><span class="status-text">Connected</span></div>
          <div class="connection-row"><span><span class="dot pending"></span>Website delivery</span><span class="status-text">Pending — driver</span></div>
          <div class="connection-row"><span><span class="dot pending"></span>DoorDash</span><span class="status-text">Pending — aggregator live, direct API filed</span></div>
          <div class="connection-row"><span><span class="dot pending"></span>Uber Eats</span><span class="status-text">Pending — aggregator live, direct API filed</span></div>
        </div>
      </div>

      <div class="section-label section-label--tech">The technicals</div>
      <ol class="flow-steps">
        <li>Platform (or aggregator) sends a webhook. Signature is verified before anything else touches it.</li>
        <li>Adapter normalises the payload into a Tractor order: <code>{ order_no, source, placed, items[] }</code>.</li>
        <li>Insert is keyed on <code>(source, platform_order_id)</code> — a repeated webhook can never create a duplicate order.</li>
        <li>Acknowledge first, within the platform's clock, then queue the kitchen ticket print job second.</li>
        <li>Fee and channel are recorded on the order at insert time, so money reporting never needs a second lookup.</li>
      </ol>

      <div class="kv-grid">
        <div class="card">
          <span class="tag-pill tag-pill--path">Path A</span>
          <h4>Direct APIs</h4>
          <p>Best end state, no third party. Gated and slow — I apply Day 1, build direct adapters only if approved.</p>
        </div>
        <div class="card card--pink">
          <span class="tag-pill tag-pill--start">Path B · start here</span>
          <h4>Certified aggregator bridge</h4>
          <p>Otter, Deliverect, Chowly and similar push marketplace orders into the order book within weeks. Temporary, swappable. Quotes in Week 2.</p>
        </div>
        <div class="card">
          <span class="tag-pill tag-pill--path">Path C</span>
          <h4>Tablet / email capture</h4>
          <p>Brittle. A one-day outage fallback only.</p>
        </div>
      </div>
      <p style="color:var(--ink-600);font-size:0.9rem;"><b>Recommendation:</b> run A and B together. B puts orders in the book by Day 45; A replaces B one platform at a time if approval comes. The order book never knows the difference.</p>
      <div class="source">Sources: DoorDash Developer, About Marketplace · Uber Eats Marketplace APIs · BC Food Delivery Service Fee Act summary</div>
    `
  },

  orderbook: {
    eyebrow: 'The database',
    title: 'One order book — it is a real database',
    body: `
      <div class="section-label">How it looks — table browser</div>
      <div class="mockwin">
        <div class="mockwin__bar"><span></span><span></span><span></span><div class="mockwin__title">order_book — production</div></div>
        <div class="tabs">
          <div class="tab active" data-tabpanel="t-items">order_items</div>
          <div class="tab" data-tabpanel="t-events">order_events</div>
          <div class="tab" data-tabpanel="t-map">channel_item_map</div>
          <div class="tab" data-tabpanel="t-payout">payout_lines</div>
          <div class="tab" data-tabpanel="t-guests">guests</div>
        </div>
        <div class="tabpanel-area">
          <div class="tabpanel" data-tab="t-items">
            <table class="data">
              <thead><tr><th>order_no</th><th>source</th><th>placed</th><th>ready</th><th>sku</th><th>dish</th><th>qty</th></tr></thead>
              <tbody>
                <tr><td>T-20418</td><td>DoorDash</td><td>12:04:10</td><td>12:19:40</td><td>BWL-014</td><td>Everyday Bowl, no feta</td><td>1</td></tr>
                <tr><td>T-20418</td><td>DoorDash</td><td>12:04:10</td><td>12:19:40</td><td>SUP-003</td><td>Miso Carrot Soup</td><td>1</td></tr>
                <tr><td>T-20431</td><td>Kiosk</td><td>12:09:55</td><td>12:22:05</td><td>BWL-021</td><td>Harvest Bowl</td><td>2</td></tr>
                <tr><td>T-20436</td><td>Uber Eats</td><td>12:11:02</td><td>12:26:30</td><td>BWL-014</td><td>Everyday Bowl</td><td>1</td></tr>
                <tr><td>T-20440</td><td>Website delivery</td><td>12:13:47</td><td>12:31:00</td><td>JCE-007</td><td>Green Juice</td><td>2</td></tr>
              </tbody>
            </table>
          </div>
          <div class="tabpanel" data-tab="t-events" style="display:none;">
            <table class="data">
              <thead><tr><th>order_no</th><th>status</th><th>at</th></tr></thead>
              <tbody>
                <tr><td>T-20418</td><td>received</td><td>12:04:10</td></tr>
                <tr><td>T-20418</td><td>accepted</td><td>12:04:14</td></tr>
                <tr><td>T-20418</td><td>printed</td><td>12:04:21</td></tr>
                <tr><td>T-20418</td><td>in_prep</td><td>12:06:00</td></tr>
                <tr><td>T-20418</td><td>ready</td><td>12:19:40</td></tr>
                <tr><td>T-20418</td><td>handed_off</td><td>12:21:12</td></tr>
                <tr><td>T-20418</td><td>settled</td><td>18:00:00</td></tr>
              </tbody>
            </table>
          </div>
          <div class="tabpanel" data-tab="t-map" style="display:none;">
            <table class="data">
              <thead><tr><th>platform</th><th>platform_item_id</th><th>sku</th></tr></thead>
              <tbody>
                <tr><td>DoorDash</td><td>itm_8831</td><td>BWL-014</td></tr>
                <tr><td>Uber Eats</td><td>5f2c-bowl-ev</td><td>BWL-014</td></tr>
                <tr><td>DoorDash</td><td>itm_7710</td><td>SUP-003</td></tr>
              </tbody>
            </table>
          </div>
          <div class="tabpanel" data-tab="t-payout" style="display:none;">
            <table class="data">
              <thead><tr><th>order_no</th><th>channel</th><th>gross</th><th>fee</th><th>net</th><th>status</th></tr></thead>
              <tbody>
                <tr><td>T-20418</td><td>DoorDash</td><td>$24.00</td><td>$4.56</td><td>$19.44</td><td><span class="status status--ok">OK</span></td></tr>
                <tr><td>T-20436</td><td>Uber Eats</td><td>$19.50</td><td>$4.10</td><td>$15.40</td><td><span class="status status--review">Review</span></td></tr>
              </tbody>
            </table>
          </div>
          <div class="tabpanel" data-tab="t-guests" style="display:none;">
            <table class="data">
              <thead><tr><th>guest_id</th><th>first_seen</th><th>channels</th><th>orders</th></tr></thead>
              <tbody>
                <tr><td>g_4471</td><td>Kiosk</td><td>Kiosk, Website pickup</td><td>14</td></tr>
                <tr><td>g_5820</td><td>DoorDash</td><td>DoorDash</td><td>3</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="section-label section-label--tech">The technicals — schema</div>
      <div class="schema-map">
        <div class="schema-node">order_items <span class="fk">PK order_no+sku</span></div>
        <div class="schema-arrow">→</div>
        <div class="schema-node">order_events <span class="fk">FK order_no</span></div>
        <div class="schema-arrow">→</div>
        <div class="schema-node">payout_lines <span class="fk">FK order_no</span></div>
      </div>
      <div class="schema-map">
        <div class="schema-node">channel_item_map <span class="fk">sku lookup</span></div>
        <div class="schema-arrow">→</div>
        <div class="schema-node">order_items.sku</div>
      </div>
      <p style="color:var(--ink-600);font-size:0.88rem;line-height:1.6;"><b>source</b> sits on every row, so any report splits by channel. <b>sku</b> is Tractor's own item number — one bowl is one product everywhere, even when three platforms use three different IDs for it. <b>placed</b> and <b>ready</b> live in <code style="font-family:var(--mono);background:var(--cream-100);padding:1px 6px;border-radius:4px;">order_events</code>, so prep time per dish, store and channel is one query.</p>

      <div class="stepper">
        <div class="stepper__step"><span>Received</span></div>
        <div class="stepper__step"><span>Accepted</span></div>
        <div class="stepper__step"><span>Printed</span></div>
        <div class="stepper__step"><span>In prep</span></div>
        <div class="stepper__step"><span>Ready</span></div>
        <div class="stepper__step"><span>Handed off</span></div>
        <div class="stepper__step"><span>Settled</span></div>
      </div>
    `
  },

  kitchen: {
    eyebrow: 'Ask 01 & 02 · Kitchen & delivery',
    title: 'Two printers, two colours. One driver chosen by data.',
    body: `
      <div class="section-label">How it looks — tickets</div>
      <div class="ticket-row">
        <div class="ticket ticket--white">
          <h5>In-store + pickup</h5>
          <div class="ticket__id">#T-20431 · DUE 12:38</div>
          BOWLS<br>1 EVERYDAY BOWL, NO FETA<br>SOUP<br>1 MISO CARROT
        </div>
        <div class="ticket ticket--blue">
          <h5>Delivery · DoorDash</h5>
          <div class="ticket__id">#T-20418 · DUE 12:42</div>
          BOWLS<br>1 EVERYDAY BOWL, NO FETA<br>SOUP<br>1 MISO CARROT
        </div>
      </div>

      <div class="section-label">How it looks — printer queue</div>
      <div class="mockwin">
        <div class="mockwin__bar"><span></span><span></span><span></span><div class="mockwin__title">print jobs — counter + packing</div></div>
        <div class="printer-queue">
          <div class="pq-row"><span>#T-20431 → Counter printer</span><span class="pq-status printed">Printed</span></div>
          <div class="pq-row"><span>#T-20418 → Packing printer</span><span class="pq-status printed">Printed</span></div>
          <div class="pq-row"><span>#T-20442 → Packing printer</span><span class="pq-status queued">Queued</span></div>
          <div class="pq-row"><span>#T-20439 → Counter printer (packing offline)</span><span class="pq-status rerouted">Rerouted</span></div>
        </div>
      </div>

      <div class="section-label section-label--tech">The technicals</div>
      <ol class="flow-steps">
        <li>Each ticket is a job: <code>print(job) → confirm → retry on silence → reroute after N failures</code>.</li>
        <li>A failed printer's jobs reroute to the working one with a <code>REROUTED</code> header and a screen alert — the packer never has to know why.</li>
        <li>Website checkout gets a live quote from the driver provider; the quote becomes the delivery fee stored on the order.</li>
        <li>Dispatch fires at <code>ready_time − pickup_travel_time</code>, not at checkout.</li>
        <li>Driver webhooks update order status and the guest tracking link; delivery cost lands on the order, so profit by channel is a query.</li>
      </ol>

      <div class="kv-grid">
        <div class="card"><h4>All-in cost</h4><p>CAD quotes for 50 real addresses, lunch and dinner.</p></div>
        <div class="card"><h4>Reliability</h4><p>On-time rate in a two-week, one-store pilot.</p></div>
        <div class="card"><h4>Contract</h4><p>No exclusivity. Keep the second driver as failover.</p></div>
      </div>
      <div class="source">Sources: Epson TM-m30III · DoorDash Drive · Uber Direct, Vancouver</div>
    `
  },

  money: {
    eyebrow: 'Ask 03 · The money',
    title: 'Payout Auditor — every payout line checked against the order book',
    body: `
      <div class="section-label">How it looks</div>
      <div class="mockwin">
        <div class="mockwin__bar"><span></span><span></span><span></span><div class="mockwin__title">payout auditor — this week</div></div>
        <div class="mockwin__body" style="padding:4px 4px 10px;">
          <table class="data" style="margin:0;">
            <thead><tr><th>Channel</th><th>Orders</th><th>Gross</th><th>Fees</th><th>Fee %</th><th>Net payout</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>DoorDash</td><td>412</td><td>$9,840.00</td><td>$1,869.60</td><td>19.0%</td><td>$7,844.00</td><td><span class="status status--ok">OK</span></td></tr>
              <tr class="store-row" data-flag="ue">
                <td>Uber Eats</td><td>301</td><td>$7,215.00</td><td>$1,515.15</td><td style="color:var(--magenta-600);font-weight:700;">21.0%</td><td>$5,611.85</td><td><span class="status status--review">Review</span></td>
              </tr>
              <tr><td>Website delivery</td><td>118</td><td>$3,460.00</td><td>$103.80</td><td>3.0%</td><td>$3,356.20</td><td><span class="status status--ok">OK</span></td></tr>
            </tbody>
          </table>
          <div class="inline-detail" id="flag-ue" style="margin:14px 16px 6px;">
            <b>Flag drafted by AI, pending approval:</b> Uber Eats fee came in at 21.0%, above BC's 20% core-service cap, with no enhanced service agreed. Dollar amount at stake: ~$30/week at this volume. Draft dispute message ready — a person reviews before anything sends.
          </div>
        </div>
      </div>
      <p style="color:var(--ink-600);font-size:0.85rem;margin-top:8px;">Click the flagged Uber Eats row above.</p>

      <div class="section-label section-label--tech">The technicals</div>
      <ol class="flow-steps">
        <li>Code reads statements exported from the merchant portals.</li>
        <li>Matches lines to orders by <code>channel_order_id + date + amount</code>.</li>
        <li>Rules raise flags with dollar amounts: missing payout, short payment, refund charged to Tractor, double charge, fee above BC's 20% cap.</li>
        <li>AI writes the reason and a dispute draft. A person approves. Nothing sends on its own.</li>
      </ol>

      <div class="kv-grid">
        <div class="card card--dark"><h4>Why I want it</h4><p>The money sits in a gap arithmetic can find, and BC law gives a hard line to test. Code checks first, AI explains.</p></div>
        <div class="card"><h4>First experiment</h4><p>Two weeks, eight weeks of statements, a person reviewing every flag. Target: 90%+ of flags valid after review.</p></div>
        <div class="card card--pink"><h4>Kill rule</h4><p>Under half the flags valid, or small dollars, and I stop.</p></div>
      </div>
      <div class="source">Figures are made up to show the shape. BC Food Delivery Service Fee Act summary.</div>
    `
  },

  metrics: {
    eyebrow: 'Ask 03 · Room to innovate',
    title: 'The order book becomes a business insights team',
    body: `
      <div class="cmdbar">
        <div class="cmdbar__label">Command Centre — ask anything</div>
        <div class="cmdbar__input-row">
          <span class="glyph">⌘</span>
          <input class="cmdbar__input" id="cmd-input" type="text" placeholder="Ask about any store, order, or dollar..." readonly>
          <span class="cmdbar__go">↵ ask</span>
        </div>
        <div class="cmdbar__chips">
          <div class="cmdbar__chip" data-q="Which store needs attention this week?" data-a="a-store">Which store needs attention this week?</div>
          <div class="cmdbar__chip" data-q="Where is the money leaking?" data-a="a-money">Where is the money leaking?</div>
          <div class="cmdbar__chip" data-q="What should I do on Monday?" data-a="a-brief">What should I do on Monday?</div>
        </div>
        <div class="cmdbar__answer" id="a-store">
          <div class="who">Owner Brief · Speed Watcher</div>
          <div class="ans"><b>Store 03.</b> Ticket time is 8:05, almost two minutes over the other three stores, and on-time dropped to 84%. Online share is highest here too (40%), so the packing station is the likely bottleneck, not the kitchen.</div>
          <div class="actions"><span>Check packing staffing, Store 03</span></div>
        </div>
        <div class="cmdbar__answer" id="a-money">
          <div class="who">Owner Brief · Payout Auditor</div>
          <div class="ans">Uber Eats fees landed at <b>21.0%</b> this week, over BC's 20% cap, on 301 orders. Flagged amount: <b>$312</b>. A dispute draft is ready for review.</div>
          <div class="actions"><span>Review Uber Eats flag</span></div>
        </div>
        <div class="cmdbar__answer" id="a-brief">
          <div class="who">Owner Brief · Monday</div>
          <div class="ans">Three things: 1) Store 03's packing station is slow at lunch. 2) Uber Eats fee flag worth $312 is waiting for review. 3) Online ordering share is rising fastest at Store 03 (40%) — worth testing the QR counter signage there first.</div>
        </div>
      </div>

      <div class="section-label">Store scorecard</div>
      <div class="stat-row">
        <div class="stat-tile"><div class="num">5,812</div><div class="label">Orders</div></div>
        <div class="stat-tile"><div class="num">6:40</div><div class="label">Ticket, median</div></div>
        <div class="stat-tile"><div class="num">91%</div><div class="label">On time</div></div>
        <div class="stat-tile" style="border-color:var(--magenta-600);"><div class="num" style="color:var(--magenta-600);">$312</div><div class="label">Payout flags</div></div>
      </div>
      <table class="data">
        <thead><tr><th>Store</th><th>Orders</th><th>Ticket</th><th>On time</th><th>Online</th></tr></thead>
        <tbody>
          <tr class="store-row" data-store="01"><td>Store 01</td><td>1,640</td><td>6:10</td><td>94%</td><td>31%</td></tr>
          <tr class="store-row" data-store="02"><td>Store 02</td><td>1,420</td><td>6:35</td><td>92%</td><td>28%</td></tr>
          <tr class="store-row is-flagged" data-store="03"><td>Store 03</td><td>1,510</td><td>8:05</td><td>84%</td><td>40%</td></tr>
          <tr class="store-row" data-store="04"><td>Store 04</td><td>1,242</td><td>6:20</td><td>93%</td><td>22%</td></tr>
        </tbody>
      </table>
      <div class="inline-detail" id="store-detail" style="margin-top:-6px;"></div>

      <div class="section-label section-label--tech">The technicals — the agent team</div>
      <div class="agent-grid">
        <div class="agent-card">
          <div class="role">Build first</div>
          <h4>Payout Auditor</h4>
          <p>Matches every payout line to an order, flags gaps, drafts the dispute.</p>
          <div class="inline-detail">Reads <code>payout_lines</code> joined to <code>order_items</code> on order_no; rule set runs nightly; flags write to <code>flags</code> table.</div>
        </div>
        <div class="agent-card">
          <div class="role">Operations</div>
          <h4>Speed Watcher</h4>
          <p>Reads order events, spots slow stations/shifts/channels, alerts the store lead.</p>
          <div class="inline-detail">Computes <code>prep_time = ready − placed</code> from <code>order_events</code>, grouped by store/station/shift; alerts when p95 exceeds the store's own baseline.</div>
        </div>
        <div class="agent-card">
          <div class="role">Growth</div>
          <h4>Marketing Agent</h4>
          <p>Proposes slow-hour offers with a 10% holdout, counts extra orders after fees.</p>
          <div class="inline-detail">A/B holdout group withheld from every offer; lift measured net of platform fees; consent required first under CASL.</div>
        </div>
        <div class="agent-card">
          <div class="role">Kitchen</div>
          <h4>Menu & Prep Agent</h4>
          <p>Reads dish sales by hour/channel, suggests prep amounts, flags weak dishes.</p>
          <div class="inline-detail">Time-series over <code>order_items</code> by <code>sku</code> and hour-of-day; suggestion is a number, not an auto-order.</div>
        </div>
        <div class="agent-card">
          <div class="role">Leadership</div>
          <h4>Owner Brief</h4>
          <p>One page every Monday: stores ranked, money flags, three actions to take.</p>
          <div class="inline-detail">Pulls the top output of each other agent into one ranked page — the Command Centre you see above, delivered automatically.</div>
        </div>
      </div>
      <p style="color:var(--ink-600);font-size:0.86rem;margin-top:14px;"><b>Limit:</b> a printer can't tell when a dish is done, so per-dish timing needs a ready tap at each station. Every agent only suggests — a person approves.</p>
      <div class="source">Sources: Chipotle Q3 2026 call · Tim Hortons strategy · Subway digital ordering. Scorecard figures are illustrative.</div>
    `
  },

  guests: {
    eyebrow: 'Outputs · Guest accounts',
    title: 'One guest, every channel',
    body: `
      <div class="section-label">How it looks</div>
      <div class="json-card">{<br>
      &nbsp;&nbsp;<span class="k">"guest_id"</span>: <span class="s">"g_4471"</span>,<br>
      &nbsp;&nbsp;<span class="k">"first_seen"</span>: <span class="s">"Kiosk"</span>,<br>
      &nbsp;&nbsp;<span class="k">"channels"</span>: [<span class="s">"Kiosk"</span>, <span class="s">"Website pickup"</span>],<br>
      &nbsp;&nbsp;<span class="k">"orders"</span>: <span class="n">14</span>,<br>
      &nbsp;&nbsp;<span class="k">"rewards_points"</span>: <span class="n">0</span> <span style="color:#727a68;">// phase 2</span><br>
      }</div>
      <div class="section-label section-label--tech">The technicals</div>
      <p style="color:var(--ink-600);font-size:0.88rem;line-height:1.6;">One rewards ID across every channel is what let Subway double digital volume in a year — Tractor's play is the same: one guest ID, captured at the counter and kiosk too, not just online. History and rewards logic layer on top of the same order book, no second database.</p>
    `
  },
};

/* ---------------- overlay open/close ---------------- */

const overlay = document.getElementById('overlay');
const panelEl = document.getElementById('panel');
const panelEyebrow = document.getElementById('panel-eyebrow');
const panelTitle = document.getElementById('panel-title');
const panelBody = document.getElementById('panel-body');

function openPanel(key, evt) {
  const data = PANELS[key];
  if (!data) return;
  panelEyebrow.textContent = data.eyebrow;
  panelTitle.textContent = data.title;
  panelBody.innerHTML = data.body;
  panelBody.scrollTop = 0;

  if (evt) {
    const ox = (evt.clientX / window.innerWidth) * 100;
    const oy = (evt.clientY / window.innerHeight) * 100;
    panelEl.style.transformOrigin = `${ox}% ${oy}%`;
  }

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePanel() {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('diagram').addEventListener('click', (e) => {
  const node = e.target.closest('[data-panel]');
  if (!node) return;
  openPanel(node.dataset.panel, e);
});

document.getElementById('panel-close').addEventListener('click', closePanel);
document.getElementById('overlay-backdrop').addEventListener('click', closePanel);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

/* ---------------- delegated interactions inside panels ---------------- */

const STORE_DETAIL = {
  '01': 'Store 01 — steady. Ticket time and on-time rate both sit at or above the network median this week.',
  '02': 'Store 02 — steady. Online share rising slightly; worth watching next month, not acting on yet.',
  '03': 'Store 03 — flagged. Ticket time is 8:05 (median 6:40), on-time dropped to 84%, online share is highest at 40%. Packing station is the likely bottleneck — Speed Watcher suggests checking lunch staffing first.',
  '04': 'Store 04 — steady, lowest volume of the four. No flags this week.',
};

panelBody.addEventListener('click', (e) => {
  // DB-browser style tabs
  const tab = e.target.closest('.tab');
  if (tab) {
    const mockwin = tab.closest('.mockwin');
    mockwin.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tabpanel;
    mockwin.querySelectorAll('.tabpanel').forEach(p => {
      p.style.display = (p.dataset.tab === target) ? '' : 'none';
    });
    return;
  }

  // command centre chips
  const chip = e.target.closest('.cmdbar__chip');
  if (chip) {
    const cmdbar = chip.closest('.cmdbar');
    cmdbar.querySelectorAll('.cmdbar__chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    cmdbar.querySelector('#cmd-input').value = chip.dataset.q;
    cmdbar.querySelectorAll('.cmdbar__answer').forEach(a => a.classList.remove('show'));
    const ans = document.getElementById(chip.dataset.a);
    if (ans) ans.classList.add('show');
    return;
  }

  // agent cards — toggle their own inline detail
  const agentCard = e.target.closest('.agent-card');
  if (agentCard) {
    const detail = agentCard.querySelector('.inline-detail');
    if (detail) detail.classList.toggle('open');
    return;
  }

  // store scorecard rows — shared detail area
  const storeRow = e.target.closest('.store-row[data-store]');
  if (storeRow) {
    const detailEl = document.getElementById('store-detail');
    const store = storeRow.dataset.store;
    if (detailEl.dataset.current === store && detailEl.classList.contains('open')) {
      detailEl.classList.remove('open');
      detailEl.dataset.current = '';
    } else {
      detailEl.innerHTML = STORE_DETAIL[store] || '';
      detailEl.classList.add('open');
      detailEl.dataset.current = store;
    }
    return;
  }

  // money panel flagged row
  const flagRow = e.target.closest('.store-row[data-flag]');
  if (flagRow) {
    const flagId = 'flag-' + flagRow.dataset.flag;
    const el = document.getElementById(flagId);
    if (el) el.classList.toggle('open');
  }
});
