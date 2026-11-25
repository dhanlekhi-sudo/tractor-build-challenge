/* ============================================================
   Tractor Head Office Dashboard
   Two sources of truth, deliberately separate:
   - data/store-XX.md   — config: months/channel totals, printers,
     top-dish summary, the store's note. Small enough to hand-edit.
   - data/orders/store-XX.xlsx — the actual order book: one row per
     order, every day of the month. Real Excel files, read in the
     browser with SheetJS. The Orders tab, the Printers tab's
     kitchen-screen preview, and every "view the orders behind
     this" drill-down all read from here, not from the .md file.
   ============================================================ */

let STORES = [];
let CURRENT = { name: 'overview' };
let drillStack = [];
let currentDrillContent = null;

/* ---------------- data loading ---------------- */

async function loadStores() {
  const ids = ['01', '02', '03', '04'];
  const stores = await Promise.all(ids.map(async (id) => {
    const [mdText, xlsxBuf] = await Promise.all([
      fetch(`data/store-${id}.md`).then(r => r.text()),
      fetch(`data/orders/store-${id}.xlsx`).then(r => r.arrayBuffer()),
    ]);
    const store = parseStoreMarkdown(mdText);
    store.orders = parseOrdersWorkbook(xlsxBuf);
    return store;
  }));
  return stores.sort((a, b) => a.id.localeCompare(b.id));
}

function parseStoreMarkdown(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const data = jsyaml.load(match ? match[1] : text);
  data.body = match ? match[2].trim() : '';
  return data;
}

function parseOrdersWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { raw: true }).map(r => ({
    order_no: String(r.order_no), date: String(r.date), time: String(r.time),
    source: String(r.source), dish: String(r.dish), total: Number(r.total), status: String(r.status),
  }));
}

function distinctDates(orders) {
  return Array.from(new Set(orders.map(o => o.date))).sort();
}

function ordersOnDate(orders, dateStr) { return orders.filter(o => o.date === dateStr); }

function isFlagged(store) { return /^flagged\./i.test((store.body || '').trim()); }

/* ---------------- aggregation (the order book, rolled up) ---------------- */

function monthTotal(m) { return m.doordash + m.ubereats + m.instore + m.website; }
function pctDelta(curr, prev) { return prev ? ((curr - prev) / prev) * 100 : 0; }

function aggregateMonths(stores) {
  const labels = stores[0].months.map(m => m.label);
  return labels.map((label, i) => {
    const agg = { label, doordash: 0, ubereats: 0, instore: 0, website: 0, visits: 0 };
    stores.forEach(s => {
      const m = s.months[i];
      agg.doordash += m.doordash; agg.ubereats += m.ubereats; agg.instore += m.instore; agg.website += m.website;
      agg.visits += (m.visits || 0);
    });
    return agg;
  });
}

function channelMix(monthEntry) {
  const total = monthTotal(monthEntry) || 1;
  const names = { doordash: 'DoorDash', ubereats: 'Uber Eats', instore: 'In-store', website: 'Website / app' };
  return ['doordash', 'ubereats', 'instore', 'website']
    .map(key => ({ key, name: names[key], value: monthEntry[key], pct: (monthEntry[key] / total) * 100 }))
    .sort((a, b) => b.value - a.value);
}

function onlineSharePct(monthEntry) {
  const total = monthTotal(monthEntry) || 1;
  return ((monthEntry.doordash + monthEntry.ubereats + monthEntry.website) / total) * 100;
}

function majorityTrend(trends) {
  const c = { up: 0, flat: 0, down: 0 };
  trends.forEach(t => c[t]++);
  if (c.up >= c.down && c.up >= c.flat) return 'up';
  if (c.down >= c.up && c.down >= c.flat) return 'down';
  return 'flat';
}

function aggregateDishes(stores) {
  const map = new Map();
  stores.forEach(s => s.top_dishes.forEach(d => {
    if (!map.has(d.name)) map.set(d.name, { name: d.name, orders: 0, trends: [] });
    const e = map.get(d.name);
    e.orders += d.orders;
    e.trends.push(d.trend);
  }));
  return Array.from(map.values())
    .map(d => ({ name: d.name, orders: d.orders, trend: majorityTrend(d.trends) }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 5);
}

function storeComparison(stores) {
  return stores.map(s => {
    const months = s.months;
    const latest = monthTotal(months[months.length - 1]);
    const prev = monthTotal(months[months.length - 2]);
    return { id: s.id, name: s.name, total: latest, deltaPct: pctDelta(latest, prev), flagged: isFlagged(s) };
  }).sort((a, b) => b.total - a.total);
}

/* ---------------- small render helpers ---------------- */

function escapeHTML(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function compactNum(n) { return n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K' : String(n); }

function channelColor(key) {
  const map = { doordash: 'var(--ch-doordash)', ubereats: 'var(--ch-ubereats)', instore: 'var(--ch-instore)', website: 'var(--ch-website)' };
  return map[key] || 'var(--ink-400)';
}
function channelColorBySourceLabel(source) {
  const map = { 'DoorDash': 'var(--ch-doordash)', 'Uber Eats': 'var(--ch-ubereats)', 'In-store': 'var(--ch-instore)', 'Website': 'var(--ch-website)' };
  return map[source] || 'var(--ink-400)';
}

function prefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function formatCount(n, format) {
  return format === 'pct' ? Math.round(n) + '%' : Math.round(n).toLocaleString();
}

function animateCountUp(el, target, format) {
  if (prefersReducedMotion()) { el.textContent = formatCount(target, format); return; }
  const duration = 700;
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = formatCount(target * eased, format);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function bindCountUps() {
  document.querySelectorAll('.kpi-tile .value[data-count-to]').forEach(el => {
    animateCountUp(el, parseFloat(el.dataset.countTo), el.dataset.countFormat);
  });
}

function storeSwitcherHTML(currentLabel) {
  const items = [{ route: 'overview', label: 'Overview — Head Office' }]
    .concat(STORES.map(s => ({ route: `store-${s.id}`, label: s.name, flagged: isFlagged(s) })));
  const currentRoute = CURRENT.name === 'overview' ? 'overview' : `store-${CURRENT.id}`;
  return `<div class="store-switcher">
    <button class="store-switcher__btn" id="store-switcher-btn" aria-haspopup="listbox">
      <span>${currentLabel}</span><span class="chev">▾</span>
    </button>
    <div class="store-switcher__menu" id="store-switcher-menu" hidden>
      ${items.map(it => `<div class="store-switcher__item ${it.route === currentRoute ? 'active' : ''}" data-switch-route="${it.route}">
        ${it.label}${it.flagged ? '<span class="flag-dot" title="Flagged"></span>' : ''}
      </div>`).join('')}
    </div>
  </div>`;
}

function trendArrow(trend) {
  const map = { up: ['▲', 'up'], down: ['▼', 'down'], flat: ['→', 'flat'] };
  const [glyph, cls] = map[trend] || map.flat;
  return `<span class="trend-arrow ${cls}" title="${trend}">${glyph}</span>`;
}

function rankRowHTML({ rank, name, value, pct, color, badge, badgeVariant, trend, drill, drillId }) {
  const drillAttr = drill ? `data-drill="${drill}" data-drill-id="${drillId}"` : '';
  const badgeClass = badgeVariant === 'positive' ? 'trend-badge trend-badge--positive' : 'trend-badge';
  return `<div class="rank-row" ${drillAttr}>
    <div class="rank-num">${rank}</div>
    <div class="rank-name"><span class="dot" style="background:${color}"></span>${name}${badge ? `<span class="${badgeClass}">${badge}</span>` : ''}${trend ? trendArrow(trend) : ''}</div>
    <div class="rank-track"><div class="rank-fill" data-pct="${pct}" style="background:${color}"></div></div>
    <div class="rank-value">${value}</div>
  </div>`;
}

function drawRankList(containerId, rows) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = rows.map((r, i) => rankRowHTML({ rank: i + 1, ...r })).join('');
  requestAnimationFrame(() => { el.querySelectorAll('.rank-fill').forEach(f => { f.style.width = f.dataset.pct + '%'; }); });
}

function statTile({ id, tourId, label, value, sub, deltaPct, isPct, spark, noDelta, flagged, countTo, countFormat, dot }) {
  const dir = deltaPct > 0.4 ? 'up' : deltaPct < -0.4 ? 'down' : 'flat';
  const deltaHTML = noDelta
    ? (sub ? `<div class="delta flat">${sub}</div>` : '')
    : `<div class="delta ${dir}">${dir === 'up' ? '▲' : dir === 'down' ? '▼' : '→'} ${Math.abs(deltaPct).toFixed(1)}${isPct ? ' pts' : '%'} vs last month</div>`;
  const sparkHTML = spark ? `<svg class="spark" data-spark='${JSON.stringify(spark)}'></svg>` : '';
  const countAttrs = countTo != null ? `data-count-to="${countTo}" data-count-format="${countFormat || 'int'}"` : '';
  const displayValue = countTo != null ? formatCount(0, countFormat) : value;
  const dotHTML = dot ? '<span class="flag-dot--metric" title="This is the metric behind this store\'s flag"></span>' : '';
  return `<div class="kpi-tile" data-kpi="${id}" tabindex="0" role="button" ${tourId ? `data-tour="${tourId}"` : ''} style="${flagged ? 'border-color:var(--magenta-600)' : ''}">
    ${dotHTML}
    <div class="label">${label}</div>
    <div class="value" ${countAttrs} style="${flagged ? 'color:var(--magenta-600)' : ''}">${displayValue}</div>
    ${deltaHTML}
    ${sparkHTML}
  </div>`;
}

function bindSparklines() {
  document.querySelectorAll('svg.spark[data-spark]').forEach(svg => drawSparkline(svg, JSON.parse(svg.dataset.spark)));
}

function drawSparkline(svg, data) {
  const w = 72, h = 28, pad = 3;
  const min = Math.min(...data), max = Math.max(...data), range = (max - min) || 1;
  const stepX = (w - pad * 2) / (data.length - 1 || 1);
  const pts = data.map((v, i) => [pad + i * stepX, h - pad - ((v - min) / range) * (h - pad * 2)]);
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = `<path d="${path}" fill="none" stroke="var(--ink-400)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="2.5" fill="var(--magenta-600)"/>`;
}

function drawLineChart(svgId, tooltipId, data, color) {
  const svg = document.getElementById(svgId);
  const tooltip = document.getElementById(tooltipId);
  if (!svg) return;
  const wrap = svg.parentElement;
  const W = wrap.clientWidth || 600, H = 220;
  const padL = 46, padR = 20, padT = 24, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const values = data.map(d => d.value);
  const max = Math.max(...values) * 1.15 || 1;
  const stepX = plotW / (data.length - 1 || 1);
  const xAt = i => padL + i * stepX;
  const yAt = v => padT + plotH - (v / max) * plotH;
  const pts = data.map((d, i) => [xAt(i), yAt(d.value)]);
  const linePath = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const areaPath = linePath + ` L ${pts[pts.length - 1][0].toFixed(1)},${(padT + plotH).toFixed(1)} L ${pts[0][0].toFixed(1)},${(padT + plotH).toFixed(1)} Z`;

  let gridSvg = '';
  for (let g = 0; g <= 4; g++) {
    const y = padT + plotH - (g / 4) * plotH;
    gridSvg += `<line class="grid-line" x1="${padL}" x2="${padL + plotW}" y1="${y}" y2="${y}"/>`;
    gridSvg += `<text class="axis-label" x="${padL - 8}" y="${y + 3}" text-anchor="end">${compactNum(Math.round((g / 4) * max))}</text>`;
  }
  const axisLabels = data.map((d, i) => `<text class="axis-label" x="${xAt(i)}" y="${padT + plotH + 18}" text-anchor="middle">${d.label}</text>`).join('');
  const lastPt = pts[pts.length - 1];
  const endLabel = `<text class="end-label" x="${lastPt[0]}" y="${lastPt[1] - 12}" text-anchor="middle">${data[data.length - 1].value.toLocaleString()}</text>`;

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `${gridSvg}
    <path class="area" d="${areaPath}" fill="${color}"/>
    <path class="line" d="${linePath}" stroke="${color}"/>
    ${pts.map(p => `<circle class="dot" cx="${p[0]}" cy="${p[1]}" fill="${color}"/>`).join('')}
    ${endLabel}${axisLabels}
    <line id="${svgId}-hover" x1="0" x2="0" y1="${padT}" y2="${padT + plotH}" stroke="var(--ink-400)" stroke-width="1" opacity="0"/>`;

  const linePathEl = svg.querySelector('.line');
  const areaEl = svg.querySelector('.area');
  if (linePathEl && areaEl && !prefersReducedMotion()) {
    const len = linePathEl.getTotalLength();
    linePathEl.style.strokeDasharray = String(len);
    linePathEl.style.strokeDashoffset = String(len);
    areaEl.style.opacity = '0';
    linePathEl.getBoundingClientRect(); // force reflow before transitioning
    linePathEl.style.transition = 'stroke-dashoffset 0.9s var(--ease)';
    areaEl.style.transition = 'opacity 0.7s var(--ease) 0.2s';
    requestAnimationFrame(() => {
      linePathEl.style.strokeDashoffset = '0';
      areaEl.style.opacity = '';
    });
  }

  const hoverLine = document.getElementById(`${svgId}-hover`);
  wrap.onmousemove = (e) => {
    const rect = wrap.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    let idx = Math.round((x - padL) / stepX);
    idx = Math.max(0, Math.min(data.length - 1, idx));
    const p = pts[idx];
    hoverLine.setAttribute('x1', p[0]); hoverLine.setAttribute('x2', p[0]); hoverLine.setAttribute('opacity', 1);
    if (tooltip) {
      tooltip.textContent = `${data[idx].label} · ${data[idx].value.toLocaleString()}`;
      tooltip.style.left = (p[0] / W) * rect.width + 'px';
      tooltip.style.top = (p[1] / H) * rect.height + 'px';
      tooltip.classList.add('show');
    }
  };
  wrap.onmouseleave = () => { hoverLine.setAttribute('opacity', 0); if (tooltip) tooltip.classList.remove('show'); };
}

const STACK_ORDER = ['instore', 'doordash', 'ubereats', 'website'];

function channelLegendHTML() {
  const names = { instore: 'In-store', doordash: 'DoorDash', ubereats: 'Uber Eats', website: 'Website / app' };
  return `<div class="chart-legend">${STACK_ORDER.map(k => `<span><i style="background:${channelColor(k)}"></i>${names[k]}</span>`).join('')}</div>`;
}

function drawStackedBarChart(svgId, tooltipId, months) {
  const svg = document.getElementById(svgId);
  const tooltip = document.getElementById(tooltipId);
  if (!svg) return;
  const wrap = svg.parentElement;
  const W = wrap.clientWidth || 600, H = 220;
  const padL = 46, padR = 20, padT = 16, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const totals = months.map(m => monthTotal(m));
  const max = Math.max(...totals) * 1.1 || 1;
  const n = months.length;
  const slot = plotW / n;
  const barW = Math.min(28, slot * 0.5);
  const gap = 2;

  let gridSvg = '';
  for (let g = 0; g <= 4; g++) {
    const y = padT + plotH - (g / 4) * plotH;
    gridSvg += `<line class="grid-line" x1="${padL}" x2="${padL + plotW}" y1="${y}" y2="${y}"/>`;
    gridSvg += `<text class="axis-label" x="${padL - 8}" y="${y + 3}" text-anchor="end">${compactNum(Math.round((g / 4) * max))}</text>`;
  }

  let barsSvg = '';
  const barMeta = [];
  months.forEach((m, i) => {
    const cx = padL + slot * i + slot / 2;
    const x = cx - barW / 2;
    let yCursor = padT + plotH;
    STACK_ORDER.forEach((key, segIdx) => {
      const val = m[key] || 0;
      const segH = (val / max) * plotH;
      const isTop = segIdx === STACK_ORDER.length - 1;
      const drawH = Math.max(0, segH - (segIdx < STACK_ORDER.length - 1 ? gap : 0));
      const topY = yCursor - segH;
      barsSvg += `<rect x="${x.toFixed(1)}" y="${topY.toFixed(1)}" width="${barW}" height="${drawH.toFixed(1)}" fill="${channelColor(key)}" ${isTop ? 'rx="4" ry="4"' : ''}/>`;
      yCursor = topY;
    });
    barMeta.push({ cx, month: m });
  });

  const axisLabels = months.map((m, i) => `<text class="axis-label" x="${padL + slot * i + slot / 2}" y="${padT + plotH + 18}" text-anchor="middle">${m.label}</text>`).join('');

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `${gridSvg}<g id="${svgId}-bars">${barsSvg}</g>${axisLabels}`;

  const barsGroup = document.getElementById(`${svgId}-bars`);
  if (barsGroup && !prefersReducedMotion()) {
    barsGroup.style.transformOrigin = `0px ${(padT + plotH)}px`;
    barsGroup.style.transform = 'scaleY(0)';
    barsGroup.style.transition = 'transform 0.6s var(--ease)';
    requestAnimationFrame(() => { barsGroup.style.transform = 'scaleY(1)'; });
  }

  wrap.onmousemove = (e) => {
    const rect = wrap.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const meta = barMeta.reduce((best, b) => Math.abs(b.cx - x) < Math.abs(best.cx - x) ? b : best, barMeta[0]);
    if (!meta || !tooltip) return;
    const m = meta.month;
    tooltip.innerHTML = `${m.label} · In-store ${m.instore} · DoorDash ${m.doordash} · Uber Eats ${m.ubereats} · Website ${m.website}`;
    tooltip.style.left = (meta.cx / W) * rect.width + 'px';
    tooltip.style.top = (padT / H) * rect.height + 'px';
    tooltip.classList.add('show');
  };
  wrap.onmouseleave = () => { if (tooltip) tooltip.classList.remove('show'); };
}

/* ---------------- drill-down overlay (KPIs go deeper) ---------------- */

function positionDrillOrigin(evt) {
  const panel = document.getElementById('drill-panel');
  if (!evt) { panel.style.transformOrigin = '50% 30%'; return; }
  panel.style.transformOrigin = `${(evt.clientX / window.innerWidth) * 100}% ${(evt.clientY / window.innerHeight) * 100}%`;
}

function setDrillContent(content) {
  currentDrillContent = content;
  document.getElementById('drill-title').textContent = content.title;
  document.getElementById('drill-body').innerHTML = content.html;
  document.getElementById('drill-body').scrollTop = 0;
  requestAnimationFrame(() => {
    document.querySelectorAll('#drill-body .rank-fill').forEach(f => { f.style.width = f.dataset.pct + '%'; });
    if (content.afterRender) content.afterRender();
  });
}

function openDrill(content, evt) {
  drillStack = [];
  setDrillContent(content);
  positionDrillOrigin(evt);
  document.getElementById('drill-overlay').classList.add('open');
  document.getElementById('drill-back').hidden = true;
}

function pushDrill(content) {
  drillStack.push(currentDrillContent);
  setDrillContent(content);
  document.getElementById('drill-back').hidden = false;
}

function popDrill() {
  const prev = drillStack.pop();
  if (!prev) return;
  setDrillContent(prev);
  document.getElementById('drill-back').hidden = drillStack.length === 0;
}

function closeDrill() { document.getElementById('drill-overlay').classList.remove('open'); }

/* ---- drill content builders — everything below reads from STORES ---- */

function drillStoreList() {
  const monthsAgg = aggregateMonths(STORES);
  const ranked = storeComparison(STORES);
  const max = ranked[0].total || 1;
  const html = `
  <div class="section-label">Monthly trend — all stores</div>
  <div class="chart-wrap" style="margin-bottom:24px;"><svg class="linechart" id="drill-store-trend-chart"></svg><div class="chart-tooltip" id="drill-store-trend-tooltip"></div></div>
  <div class="section-label">Ranked by orders this month</div>
  <div class="rank-list">${ranked.map((s, i) => rankRowHTML({
    rank: i + 1, name: s.name, value: s.total.toLocaleString(), pct: (s.total / max) * 100,
    color: s.flagged ? 'var(--magenta-600)' : 'var(--sage-700)', badge: s.flagged ? 'Flagged' : null,
    drill: 'store-detail', drillId: s.id,
  })).join('')}</div>
  <p style="margin-top:16px;color:var(--ink-600);font-size:0.85rem;">Click a store to see its channel split, then open its full dashboard.</p>
  ${sourceOrdersHTML(allOrdersWithStore())}`;
  return {
    title: 'Orders by store, this month', html,
    afterRender: () => drawLineChart('drill-store-trend-chart', 'drill-store-trend-tooltip', monthsAgg.map(m => ({ label: m.label, value: monthTotal(m) })), 'var(--sage-700)'),
  };
}

function channelMixFromOrders(orders) {
  const names = { doordash: 'DoorDash', ubereats: 'Uber Eats', instore: 'In-store', website: 'Website / app' };
  const sourceToKey = { 'DoorDash': 'doordash', 'Uber Eats': 'ubereats', 'In-store': 'instore', 'Website': 'website' };
  const counts = { doordash: 0, ubereats: 0, instore: 0, website: 0 };
  orders.forEach(o => { const k = sourceToKey[o.source]; if (k) counts[k]++; });
  const total = orders.length || 1;
  return Object.keys(counts)
    .map(key => ({ key, name: names[key], value: counts[key], pct: (counts[key] / total) * 100 }))
    .sort((a, b) => b.value - a.value);
}

function drillChannelMix() {
  const monthsAgg = aggregateMonths(STORES);
  const latest = monthsAgg[monthsAgg.length - 1];
  const mix = channelMix(latest);

  const allOrders = allOrdersWithStore();
  const today = allOrders.reduce((max, o) => (o.date > max ? o.date : max), allOrders[0].date);
  const todayOrders = allOrders.filter(o => o.date === today);
  const todayMix = channelMixFromOrders(todayOrders);

  const monthRankList = mix.map((c, i) => rankRowHTML({
    rank: i + 1, name: c.name, value: `${c.pct.toFixed(0)}% · ${c.value.toLocaleString()}`, pct: c.pct,
    color: channelColor(c.key), drill: 'channel-detail', drillId: c.key,
  })).join('');
  const todayRankList = todayMix.map((c, i) => rankRowHTML({
    rank: i + 1, name: c.name, value: `${c.pct.toFixed(0)}% · ${c.value.toLocaleString()}`, pct: c.pct, color: channelColor(c.key),
  })).join('');

  const html = `
  <div class="dash-tabs" style="margin-bottom:20px;">
    <button class="dash-tab active" data-mix-tab="month">This month — ${latest.label}</button>
    <button class="dash-tab" data-mix-tab="today">Current — ${formatDateLabel(today)}</button>
  </div>
  <div data-mix-view="month">
    <div class="rank-list">${monthRankList}</div>
    <p style="margin-top:16px;color:var(--ink-600);font-size:0.85rem;">Click a channel to see it broken down by store.</p>
    <div class="section-label section-label--tech">Mix over time</div>
    ${channelLegendHTML()}
    <div class="chart-wrap"><svg class="linechart" id="drill-channel-stack-chart"></svg><div class="chart-tooltip" id="drill-channel-stack-tooltip"></div></div>
  </div>
  <div data-mix-view="today" hidden>
    <div class="rank-list">${todayRankList}</div>
    <p style="margin-top:16px;color:var(--ink-600);font-size:0.85rem;">${todayOrders.length.toLocaleString()} orders across all stores today — live, not a monthly average.</p>
  </div>
  ${sourceOrdersHTML(allOrders)}`;
  return {
    title: `Channel mix`, html,
    afterRender: () => drawStackedBarChart('drill-channel-stack-chart', 'drill-channel-stack-tooltip', monthsAgg),
  };
}

function drillChannelByStore(channelKey) {
  const names = { doordash: 'DoorDash', ubereats: 'Uber Eats', instore: 'In-store', website: 'Website / app' };
  const rows = STORES.map(s => {
    const latest = s.months[s.months.length - 1];
    return { id: s.id, name: s.name, value: latest[channelKey] };
  }).sort((a, b) => b.value - a.value);
  const max = rows[0].value || 1;
  const html = `<div class="rank-list">${rows.map((r, i) => rankRowHTML({
    rank: i + 1, name: r.name, value: r.value.toLocaleString(), pct: (r.value / max) * 100,
    color: channelColor(channelKey), drill: 'goto-store', drillId: r.id,
  })).join('')}</div>
  ${sourceOrdersHTML(ordersForChannel(channelKey))}`;
  return { title: `${names[channelKey]} — by store`, html };
}

function drillDishBoard() {
  const dishes = aggregateDishes(STORES);
  const max = dishes[0].orders || 1;
  const html = `<div class="rank-list">${dishes.map((d, i) => rankRowHTML({
    rank: i + 1, name: d.name, value: d.orders.toLocaleString(), pct: (d.orders / max) * 100, color: 'var(--sage-700)',
    trend: d.trend, badge: i === 0 ? 'Trending' : null, drill: 'dish-detail', drillId: d.name,
  })).join('')}</div>
  <p style="margin-top:16px;color:var(--ink-600);font-size:0.85rem;">Click a dish to see which stores are selling it.</p>
  ${sourceOrdersHTML(allOrdersWithStore())}`;
  return { title: 'Top 5 dishes, all stores', html };
}

function drillDishByStore(dishName) {
  const rows = STORES.map(s => {
    const d = s.top_dishes.find(x => x.name === dishName);
    return { id: s.id, name: s.name, value: d ? d.orders : 0, trend: d ? d.trend : 'flat' };
  }).sort((a, b) => b.value - a.value);
  const max = rows[0].value || 1;
  const html = `<div class="rank-list">${rows.map((r, i) => rankRowHTML({
    rank: i + 1, name: r.name, value: r.value.toLocaleString(), pct: (r.value / max) * 100, color: 'var(--sage-700)',
    trend: r.trend, drill: 'goto-store', drillId: r.id,
  })).join('')}</div>
  ${sourceOrdersHTML(ordersForDish(dishName))}`;
  return { title: `${dishName} — by store`, html };
}

function drillFlags() {
  const ranked = storeComparison(STORES);
  const html = ranked.map(s => {
    const store = STORES.find(x => x.id === s.id);
    const note = (store.body || '').split('\n')[0];
    return `<div class="drill-link-row" data-drill="goto-store" data-drill-id="${s.id}">
      <span><b>${s.name}</b> — ${s.flagged ? '<span style="color:var(--magenta-600);">Flagged</span>' : 'Steady'}</span>
    </div>
    <p style="margin:-2px 0 10px 2px;color:var(--ink-400);font-size:0.78rem;">${escapeHTML(note)}</p>`;
  }).join('') + sourceOrdersHTML(allOrdersWithStore());
  return { title: 'Which stores need attention', html };
}

function drillTrafficTrend() {
  const monthsAgg = aggregateMonths(STORES);
  const latest = monthsAgg[monthsAgg.length - 1];
  const rows = STORES.map(s => ({ name: s.name, id: s.id, value: s.months[s.months.length - 1].visits || 0 })).sort((a, b) => b.value - a.value);
  const max = rows[0].value || 1;
  const html = `
  <div class="section-label">Monthly trend — all stores</div>
  <div class="chart-wrap" style="margin-bottom:24px;"><svg class="linechart" id="drill-traffic-chart"></svg><div class="chart-tooltip" id="drill-traffic-tooltip"></div></div>
  <div class="section-label">By store, ${latest.label}</div>
  <div class="rank-list">${rows.map((r, i) => rankRowHTML({
    rank: i + 1, name: r.name, value: r.value.toLocaleString(), pct: (r.value / max) * 100, color: 'var(--ch-instore)',
    drill: 'goto-store', drillId: r.id,
  })).join('')}</div>`;
  return {
    title: `Foot traffic, ${latest.label}`, html,
    afterRender: () => drawLineChart('drill-traffic-chart', 'drill-traffic-tooltip', monthsAgg.map(m => ({ label: m.label, value: m.visits || 0 })), 'var(--ch-instore)'),
  };
}

function drillStoreChannelsContent(store, opts = {}) {
  const latest = store.months[store.months.length - 1];
  const mix = channelMix(latest);
  const linkHtml = opts.showLink === false ? '' : `<div class="drill-link-row" data-drill="goto-store" data-drill-id="${store.id}" style="margin-top:18px;"><span>Open ${store.name}'s full dashboard</span><span>→</span></div>`;
  const html = `<div class="rank-list">${mix.map((c, i) => rankRowHTML({
    rank: i + 1, name: c.name, value: `${c.pct.toFixed(0)}%`, pct: c.pct, color: channelColor(c.key),
  })).join('')}</div>${linkHtml}
  <div class="section-label section-label--tech">Mix over time</div>
  ${channelLegendHTML()}
  <div class="chart-wrap"><svg class="linechart" id="drill-store-stack-chart"></svg><div class="chart-tooltip" id="drill-store-stack-tooltip"></div></div>
  ${sourceOrdersHTML(ordersForStore(store))}`;
  return {
    title: `${store.name} — channel split, ${latest.label}`, html,
    afterRender: () => drawStackedBarChart('drill-store-stack-chart', 'drill-store-stack-tooltip', store.months),
  };
}

function drillStoreMonths(store) {
  const rows = store.months.map(m => `<tr><td>${m.label}</td><td>${m.doordash}</td><td>${m.ubereats}</td><td>${m.instore}</td><td>${m.website}</td><td><b>${monthTotal(m).toLocaleString()}</b></td><td>${(m.visits || 0).toLocaleString()}</td></tr>`).join('');
  const html = `
  <div class="chart-wrap" style="margin-bottom:24px;"><svg class="linechart" id="drill-store-months-chart"></svg><div class="chart-tooltip" id="drill-store-months-tooltip"></div></div>
  <table class="data"><thead><tr><th>Month</th><th>DoorDash</th><th>Uber Eats</th><th>In-store</th><th>Website</th><th>Total orders</th><th>Foot traffic</th></tr></thead><tbody>${rows}</tbody></table>
  ${sourceOrdersHTML(ordersForStore(store))}`;
  return {
    title: `${store.name} — orders by month`, html,
    afterRender: () => drawLineChart('drill-store-months-chart', 'drill-store-months-tooltip', store.months.map(m => ({ label: m.label, value: monthTotal(m) })), 'var(--sage-700)'),
  };
}

function drillStoreDishes(store) {
  const max = store.top_dishes[0].orders || 1;
  const html = `<div class="rank-list">${store.top_dishes.map((d, i) => rankRowHTML({
    rank: i + 1, name: d.name, value: d.orders.toLocaleString(), pct: (d.orders / max) * 100, color: 'var(--sage-700)',
    trend: d.trend, badge: i === 0 ? 'Trending' : null,
  })).join('')}</div>
  ${sourceOrdersHTML(ordersForStore(store))}`;
  return { title: `${store.name} — top dishes`, html };
}

function handleKpiClick(kpiId, evt) {
  if (CURRENT.name === 'overview') {
    if (kpiId === 'kpi-orders') openDrill(drillStoreList(), evt);
    else if (kpiId === 'kpi-online') openDrill(drillChannelMix(), evt);
    else if (kpiId === 'kpi-dish') openDrill(drillDishBoard(), evt);
    else if (kpiId === 'kpi-flags') openDrill(drillFlags(), evt);
    else if (kpiId === 'kpi-traffic') openDrill(drillTrafficTrend(), evt);
    else if (kpiId === 'kpi-pie') openDrill(drillChannelMix(), evt);
  } else {
    const store = STORES.find(s => s.id === CURRENT.id);
    if (kpiId === 'kpi-orders') openDrill(drillStoreMonths(store), evt);
    else if (kpiId === 'kpi-online') openDrill(drillStoreChannelsContent(store, { showLink: false }), evt);
    else if (kpiId === 'kpi-dish') openDrill(drillStoreDishes(store), evt);
    else if (kpiId === 'kpi-traffic') openDrill(drillStoreMonths(store), evt);
  }
}

function dispatchDrillFromPage(type, id, evt) {
  if (type === 'goto-store') { location.hash = `#store-${id}`; return; }
  if (type === 'channel-detail') { openDrill(drillChannelByStore(id), evt); return; }
  if (type === 'dish-detail') { openDrill(drillDishByStore(id), evt); return; }
  if (type === 'store-detail') { openDrill(drillStoreChannelsContent(STORES.find(s => s.id === id)), evt); return; }
}

function dispatchDrillFromOverlay(type, id) {
  if (type === 'goto-store') { closeDrill(); location.hash = `#store-${id}`; return; }
  if (type === 'channel-detail') { pushDrill(drillChannelByStore(id)); return; }
  if (type === 'dish-detail') { pushDrill(drillDishByStore(id)); return; }
  if (type === 'store-detail') { pushDrill(drillStoreChannelsContent(STORES.find(s => s.id === id))); return; }
}

/* ---------------- page renders ---------------- */

function renderOverview() {
  const page = document.getElementById('dash-page');
  const monthsAgg = aggregateMonths(STORES);
  const latest = monthsAgg[monthsAgg.length - 1];
  const prev = monthsAgg[monthsAgg.length - 2];
  const latestTotal = monthTotal(latest);
  const deltaPct = pctDelta(latestTotal, monthTotal(prev));
  const onlineShare = onlineSharePct(latest);
  const onlineDelta = onlineShare - onlineSharePct(prev);
  const dishes = aggregateDishes(STORES);
  const topDish = dishes[0];
  const storesRanked = storeComparison(STORES);
  const flaggedCount = storesRanked.filter(s => s.flagged).length;
  const latestVisits = latest.visits || 0;
  const visitsDeltaPct = pctDelta(latestVisits, prev.visits || 0);
  const mix = channelMix(latest);

  page.innerHTML = `
    <div class="dash-header">
      <div><div class="eyebrow eyebrow--sage">Head office</div><h1>All stores, one order book.</h1></div>
      <div class="dash-header__right">
        ${storeSwitcherHTML('Overview — Head Office')}
        <div class="updated">Last updated · ${latest.label} 2026</div>
      </div>
    </div>

    <div class="kpi-row" data-tour="kpi-grid">
      ${statTile({ id: 'kpi-orders', tourId: 'kpi-0', label: `Total orders, ${latest.label}`, countTo: latestTotal, countFormat: 'int', deltaPct, spark: monthsAgg.map(monthTotal) })}
      ${statTile({ id: 'kpi-online', label: 'Online share', countTo: onlineShare, countFormat: 'pct', deltaPct: onlineDelta, isPct: true, spark: monthsAgg.map(onlineSharePct) })}
      ${statTile({ id: 'kpi-dish', label: 'Top dish', value: topDish.name, sub: topDish.orders.toLocaleString() + ' orders · trending ' + topDish.trend, noDelta: true })}
      ${statTile({ id: 'kpi-flags', label: 'Stores flagged', value: `${flaggedCount} of ${storesRanked.length}`, sub: flaggedCount ? 'Needs attention' : 'All steady', noDelta: true, flagged: flaggedCount > 0 })}
      ${statTile({ id: 'kpi-traffic', label: `Foot traffic, ${latest.label}`, countTo: latestVisits, countFormat: 'int', deltaPct: visitsDeltaPct, spark: monthsAgg.map(m => m.visits || 0) })}
      ${channelPieTileHTML(mix)}
    </div>
    <p class="tile-hint">Click any tile to go deeper — ranked lists, trend charts, and the order book behind every number.</p>
  `;

  drawDonutChart('overview-pie-chart', mix);
  bindSparklines();
  bindCountUps();
}

function channelPieTileHTML(mix) {
  return `<div class="kpi-tile kpi-tile--pie" data-kpi="kpi-pie">
    <div class="label">Orders by channel</div>
    <div class="pie-tile-body">
      <svg class="pie-chart" id="overview-pie-chart" viewBox="0 0 100 100"></svg>
      <div class="pie-legend">
        ${mix.map(c => `<div><i style="background:${channelColor(c.key)}"></i>${c.name}<b>${c.pct.toFixed(0)}%</b></div>`).join('')}
      </div>
    </div>
  </div>`;
}

function drawDonutChart(svgId, mix) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  const cx = 50, cy = 50, r = 34, strokeW = 17;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const segs = mix.map(c => {
    const dash = (c.pct / 100) * circumference;
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${channelColor(c.key)}" stroke-width="${strokeW}" stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += dash;
    return seg;
  }).join('');
  svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--cream-100)" stroke-width="${strokeW}"/>${segs}`;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDateLabel(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${d}`;
}

function dailyOrderCounts(orders) {
  const map = new Map();
  orders.forEach(o => map.set(o.date, (map.get(o.date) || 0) + 1));
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count, label: String(Number(date.split('-')[2])) }));
}

function buildOrdersTabHTML(store) {
  const channels = ['All', 'DoorDash', 'Uber Eats', 'In-store', 'Website'];
  const dates = distinctDates(store.orders);
  const latest = dates[dates.length - 1];
  const dayOptions = dates.map(d => `<option value="${d}" ${d === latest ? 'selected' : ''}>${formatDateLabel(d)}</option>`).join('');
  return `
    <div class="section-label">Orders per day — ${formatDateLabel(dates[0]).split(' ')[0]} ${dates[0].split('-')[0]}</div>
    <div class="dash-card chart-wrap" style="margin-bottom:20px;"><svg class="linechart" id="daily-trend-chart"></svg><div class="chart-tooltip" id="daily-trend-tooltip"></div></div>
    <div class="filter-row">
      <select id="order-day-select" class="day-select">
        <option value="__all__">All ${dates.length} days</option>
        ${dayOptions}
      </select>
      ${channels.map(c => `<button class="filter-chip ${c === 'All' ? 'active' : ''}" data-filter="${c}">${c}</button>`).join('')}
    </div>
    <div id="receipts-wrap">${receiptsSectionHTML(ordersOnDate(store.orders, latest))}</div>

    <div class="section-label section-label--tech">Where this table feeds</div>
    <div class="data-flow" id="data-flow">
      <svg class="connectors" id="data-flow-connectors"></svg>
      <div class="data-flow__inner">
        <div class="data-flow__source" id="flow-source">
          <div class="data-flow__source-bar"><span></span><span></span><span></span></div>
          <div class="data-flow__source-label">store-${store.id}.xlsx</div>
          <div class="data-flow__source-sub">${store.orders.length.toLocaleString()} rows · ${dates.length} days</div>
        </div>
        <div class="data-flow__targets">
          <div class="data-flow__node" id="flow-kpi" data-flow-action="overview">KPI tiles<span>counts &amp; totals, this page</span></div>
          <div class="data-flow__node" id="flow-channel" data-flow-action="channel">Channel mix<span>Online Share drill-down</span></div>
          <div class="data-flow__node" id="flow-dish" data-flow-action="dish">Dish leaderboard<span>Top Dish drill-down</span></div>
          <div class="data-flow__node" id="flow-printers" data-flow-action="printers">Kitchen screen<span>Printers tab</span></div>
        </div>
      </div>
    </div>`;
}

function drawDataFlowConnectors() {
  const container = document.getElementById('data-flow');
  const svg = document.getElementById('data-flow-connectors');
  const source = document.getElementById('flow-source');
  if (!container || !svg || !source) return;
  const targets = ['flow-kpi', 'flow-channel', 'flow-dish', 'flow-printers'].map(id => document.getElementById(id)).filter(Boolean);
  const cRect = container.getBoundingClientRect();
  const sRect = source.getBoundingClientRect();
  const p1 = { x: sRect.right - cRect.left, y: sRect.top - cRect.top + sRect.height / 2 };
  svg.innerHTML = targets.map(t => {
    const r = t.getBoundingClientRect();
    const p2 = { x: r.left - cRect.left, y: r.top - cRect.top + r.height / 2 };
    const dx = Math.max(24, (p2.x - p1.x) * 0.5);
    return `<path class="connector connector--live" d="M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}"/>`;
  }).join('');
}

function receiptCardHTML(o) {
  const isDelivery = o.source === 'DoorDash' || o.source === 'Uber Eats';
  return `<div class="ticket receipt ${isDelivery ? 'ticket--blue' : 'ticket--white'}" data-source="${o.source}">
    <div class="receipt__head">
      <span class="channel-badge" style="background:${channelColorBySourceLabel(o.source)}">${o.source}</span>
      <span class="receipt__date">${formatDateLabel(o.date)} · ${o.time}</span>
    </div>
    <div class="receipt__id">#${o.order_no}</div>
    <div class="receipt__item">${o.dish}</div>
    <div class="receipt__foot">
      <span class="receipt__total">$${o.total.toFixed(2)}</span>
      <span class="status status--${o.status === 'Review' ? 'review' : 'ok'}">${o.status}</span>
    </div>
    <div class="receipt__actions">
      <button class="receipt__btn" data-receipt-action="ready">Order ready</button>
      <button class="receipt__btn receipt__btn--ship" data-receipt-action="shipped">Shipped</button>
    </div>
  </div>`;
}

function receiptsSectionHTML(orders) {
  const white = orders.filter(o => o.source === 'In-store' || o.source === 'Website');
  const blue = orders.filter(o => o.source === 'DoorDash' || o.source === 'Uber Eats');
  return `
    <div class="section-label">In-store &amp; pickup — white — ${white.length}</div>
    <div class="receipt-grid">${white.map(receiptCardHTML).join('') || '<p style="color:var(--ink-400);font-size:0.85rem;">No in-store or pickup orders for this selection.</p>'}</div>
    <div class="section-label" style="margin-top:28px;">Delivery — blue — ${blue.length}</div>
    <div class="receipt-grid">${blue.map(receiptCardHTML).join('') || '<p style="color:var(--ink-400);font-size:0.85rem;">No delivery orders for this selection.</p>'}</div>
  `;
}

function renderOrdersReceipts(store, dayValue) {
  const orders = dayValue === '__all__' ? store.orders : ordersOnDate(store.orders, dayValue);
  document.getElementById('receipts-wrap').innerHTML = receiptsSectionHTML(orders);
  const activeChip = document.querySelector('.filter-chip.active');
  applyReceiptFilter(activeChip ? activeChip.dataset.filter : 'All');
}

function applyReceiptFilter(val) {
  document.querySelectorAll('.receipt[data-source]').forEach(card => {
    card.style.display = (val === 'All' || card.dataset.source === val) ? '' : 'none';
  });
}

/* ---------------- "the data behind this" — every drill can show its source orders ---------------- */

function allOrdersWithStore() {
  return STORES.flatMap(s => s.orders.map(o => ({ ...o, storeName: s.name })));
}

function ordersForStore(store) { return store.orders.map(o => ({ ...o, storeName: store.name })); }

function ordersForChannel(channelKey) {
  const names = { doordash: 'DoorDash', ubereats: 'Uber Eats', instore: 'In-store', website: 'Website' };
  return allOrdersWithStore().filter(o => o.source === names[channelKey]);
}

function ordersForDish(dishName) {
  return allOrdersWithStore().filter(o => o.dish.includes(dishName));
}

function compactOrderRowHTML(o) {
  return `<tr>
    <td>${o.storeName}</td><td>${o.order_no}</td><td>${formatDateLabel(o.date)}</td>
    <td><span class="channel-badge" style="background:${channelColorBySourceLabel(o.source)}">${o.source}</span></td>
    <td>${o.time}</td><td>${o.dish}</td><td>$${o.total.toFixed(2)}</td>
  </tr>`;
}

function sourceOrdersHTML(orders) {
  if (!orders || !orders.length) return '';
  const sorted = [...orders].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const shown = sorted.slice(0, 8);
  const rows = shown.map(compactOrderRowHTML).join('');
  const more = orders.length > shown.length ? `<p style="margin:8px 0 0;color:var(--ink-400);font-size:0.76rem;">+ ${orders.length - shown.length} more in the order book.</p>` : '';
  return `<div class="source-toggle">
    <button class="source-toggle__btn" data-source-toggle>▸ View the orders behind this (${orders.length})</button>
    <div class="source-toggle__body" hidden>
      <p style="margin:0 0 10px;color:var(--ink-400);font-size:0.74rem;">Most recent first, read straight from the Excel order book.</p>
      <table class="data"><thead><tr><th>Store</th><th>Order</th><th>Date</th><th>Source</th><th>Time</th><th>Dish</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
      ${more}
    </div>
  </div>`;
}

function renderStore(storeId, tab) {
  const store = STORES.find(s => s.id === storeId);
  if (!store) { location.hash = '#overview'; return; }
  const page = document.getElementById('dash-page');
  const latest = store.months[store.months.length - 1];
  const prev = store.months[store.months.length - 2];
  const latestTotal = monthTotal(latest);
  const deltaPct = pctDelta(latestTotal, monthTotal(prev));
  const onlineShare = onlineSharePct(latest);
  const onlineDelta = onlineShare - onlineSharePct(prev);
  const topDish = store.top_dishes[0];
  const latestVisits = latest.visits || 0;
  const visitsDeltaPct = pctDelta(latestVisits, prev.visits || 0);

  page.innerHTML = `
    <div class="dash-header">
      <div><div class="eyebrow eyebrow--sage">${store.address || ''}</div><h1>${store.name}</h1></div>
      <div class="dash-header__right">
        ${storeSwitcherHTML(store.name)}
        <div class="updated">Last updated · ${latest.label} 2026</div>
      </div>
    </div>
    <div class="dash-tabs">
      <button class="dash-tab ${tab === 'overview' ? 'active' : ''}" data-store-tab="overview">Overview</button>
      <button class="dash-tab ${tab === 'orders' ? 'active' : ''}" data-store-tab="orders">Orders</button>
      <button class="dash-tab ${tab === 'printers' ? 'active' : ''}" data-store-tab="printers">Printers</button>
    </div>
    <div id="store-tab-content"></div>
  `;

  const content = document.getElementById('store-tab-content');
  if (tab === 'orders') {
    content.innerHTML = buildOrdersTabHTML(store);
    drawLineChart('daily-trend-chart', 'daily-trend-tooltip', dailyOrderCounts(store.orders).map(d => ({ label: d.label, value: d.count })), 'var(--ch-instore)');
    requestAnimationFrame(drawDataFlowConnectors);
    return;
  }
  if (tab === 'printers') {
    content.innerHTML = buildPrintersTabHTML(store);
    return;
  }

  content.innerHTML = `
    ${store.body ? `<div class="note-card">${escapeHTML(store.body)}</div>` : ''}
    <div class="kpi-row kpi-row--2">
      ${statTile({ id: 'kpi-orders', label: `Orders, ${latest.label}`, countTo: latestTotal, countFormat: 'int', deltaPct, spark: store.months.map(monthTotal), dot: store.flag_metric === 'kpi-orders' })}
      ${statTile({ id: 'kpi-online', label: 'Online share', countTo: onlineShare, countFormat: 'pct', deltaPct: onlineDelta, isPct: true, spark: store.months.map(onlineSharePct), dot: store.flag_metric === 'kpi-online' })}
      ${statTile({ id: 'kpi-dish', label: 'Top dish', value: topDish.name, sub: topDish.orders.toLocaleString() + ' orders', noDelta: true, dot: store.flag_metric === 'kpi-dish' })}
      ${statTile({ id: 'kpi-traffic', label: `Foot traffic, ${latest.label}`, countTo: latestVisits, countFormat: 'int', deltaPct: visitsDeltaPct, spark: store.months.map(m => m.visits || 0), dot: store.flag_metric === 'kpi-traffic' })}
    </div>
    ${store.flag_metric ? '<p class="tile-hint" style="color:var(--magenta-600);">● marks the metric behind this store\'s flag.</p>' : ''}
    <p class="tile-hint">Click any tile to go deeper — the channel split, the trend chart, and the order book behind it.</p>
  `;
  bindSparklines();
  bindCountUps();
}

function buildPrintersTabHTML(store) {
  const printers = store.printers || [];
  const statusCards = printers.map(p => `
    <div class="printer-card ${p.status === 'jammed' ? 'is-jammed' : ''}">
      <div class="pname">${p.name}</div>
      <span class="pstatus ${p.status}">${p.status === 'jammed' ? '⚠ Jammed' : 'Online'}</span>
      ${p.status === 'jammed' ? '<p style="margin:10px 0 0;font-size:0.82rem;color:var(--ink-600);">Clear the jam and reprint — tickets are rerouting to the other printer in the meantime.</p>' : ''}
    </div>`).join('');

  const dates = distinctDates(store.orders);
  const today = dates[dates.length - 1];
  const todaysOrders = ordersOnDate(store.orders, today);
  const liveOrders = todaysOrders.filter(o => o.status !== 'Settled').sort((a, b) => b.time.localeCompare(a.time));
  const queueSource = (liveOrders.length ? liveOrders : todaysOrders.slice(-5)).slice(0, 5);

  const inStoreOrder = queueSource.find(o => o.source === 'In-store') || todaysOrders.find(o => o.source === 'In-store');
  const deliveryOrder = queueSource.find(o => o.source === 'DoorDash' || o.source === 'Uber Eats') || todaysOrders.find(o => o.source === 'DoorDash' || o.source === 'Uber Eats');
  const jammedPrinter = printers.find(p => p.status === 'jammed');

  const queueRows = queueSource.map(o => {
    const toPacking = o.source !== 'In-store';
    const rerouted = toPacking && jammedPrinter;
    const statusClass = rerouted ? 'rerouted' : (o.status === 'Settled' || o.status === 'Handed off' ? 'printed' : 'queued');
    const statusLabel = rerouted ? 'Rerouted' : (statusClass === 'printed' ? 'Printed' : o.status);
    return `<div class="pq-row"><span>${o.time} · #${o.order_no} → ${toPacking ? 'Packing' : 'Counter'} printer${rerouted ? ' (packing jammed)' : ''}</span><span class="pq-status ${statusClass}">${statusLabel}</span></div>`;
  }).join('');

  return `
    <div class="dash-section">
      <div class="dash-section__title">Printer status</div>
      <div class="printer-grid">${statusCards}</div>
    </div>

    <div class="dash-section">
      <div class="dash-section__title">Print queue</div>
      <div class="dash-card"><div class="printer-queue" style="padding:0;">${queueRows}</div></div>
    </div>

    <div class="dash-section">
      <div class="dash-section__title">Kitchen display — how it looks in the restaurant</div>
      <div class="mockwin">
        <div class="mockwin__bar"><span></span><span></span><span></span><div class="mockwin__title">${store.name} — kitchen screen</div></div>
        <div class="mockwin__body" style="padding:20px;">
          <div class="ticket-row" style="margin:0;">
            ${inStoreOrder ? `<div class="ticket ticket--white">
              <h5>Counter printer — in-store</h5>
              <div class="ticket__id">#${inStoreOrder.order_no} · ${inStoreOrder.time}</div>
              ${inStoreOrder.dish}
            </div>` : ''}
            ${deliveryOrder ? `<div class="ticket ticket--blue">
              <h5>Packing printer — ${deliveryOrder.source}${jammedPrinter ? ' · REROUTED' : ''}</h5>
              <div class="ticket__id">#${deliveryOrder.order_no} · ${deliveryOrder.time}</div>
              ${deliveryOrder.dish}
            </div>` : ''}
          </div>
        </div>
      </div>
      <p style="margin-top:14px;color:var(--ink-600);font-size:0.85rem;">White paper = in-store/pickup, counter printer. Blue paper = delivery, packing station — staff never read a label, the colour says where it goes.</p>
    </div>
  `;
}

/* ---------------- router ---------------- */

function renderSidebar() {
  const nav = document.getElementById('dash-nav');
  STORES.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'dash-nav__item';
    btn.dataset.route = `store-${s.id}`;
    btn.innerHTML = `<span>${s.name}</span>${isFlagged(s) ? '<span class="flag-dot" title="Flagged"></span>' : ''}`;
    nav.appendChild(btn);
  });
}

function highlightNav(routeKey) {
  document.querySelectorAll('.dash-nav__item').forEach(el => el.classList.toggle('active', el.dataset.route === routeKey));
}

function router() {
  const hash = location.hash.replace(/^#/, '') || 'overview';
  const parts = hash.split('/');
  highlightNav(parts[0]);
  if (parts[0] === 'overview') {
    CURRENT = { name: 'overview' };
    renderOverview();
  } else if (parts[0].startsWith('store-')) {
    const id = parts[0].replace('store-', '');
    const tab = parts[1] || 'overview';
    CURRENT = { name: 'store', id, tab };
    renderStore(id, tab);
  }
}

/* ---------------- guided tour ---------------- */

const TOUR_STEPS = [
  { selector: '[data-tour="sidebar"]', title: 'Welcome to the admin portal', text: "This is a draft prototype of the dashboard Tractor's head office would use — built on mock data, with no real database and no production hosting or domain behind it yet. Let's walk through it." },
  { selector: '.store-switcher', title: 'Switch restaurants anytime', text: 'This dropdown jumps straight to any store, or back to the head-office Overview — from wherever you are on the site.' },
  { selector: '[data-tour="kpi-0"]', title: 'Every number opens up', text: "Click any tile and it opens the full ranked list, the trend chart, and the actual order-book rows behind that number — nothing here is just a static label." },
  { selector: '.kpi-tile--pie', title: 'Orders by channel, live', text: "This one's a real pie chart, straight from the order book. Open it for a Current tab too — today's mix, not just the monthly average." },
  { selector: '[data-tour="kpi-grid"]', title: 'Built to fit on one screen', text: 'Every box is clickable and its detail lives one click away in an overlay, so the overview itself never needs scrolling to see everything at a glance.' },
  { selector: '[data-tour="tour-btn"]', title: "That's the whole portal", text: "Open a flagged store (the dot in the sidebar) and its Overview marks exactly which tile is behind the flag. Each store also has Orders and Printers tabs — the order book and the kitchen screen itself. Replay this tour anytime, and remember: every figure here is illustrative, not real Tractor data." },
];

let tourIndex = 0;
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function startTour() {
  if ((location.hash.replace('#', '') || 'overview').split('/')[0] !== 'overview') {
    location.hash = '#overview';
    await wait(300);
  }
  tourIndex = 0;
  document.getElementById('tour-layer').hidden = false;
  await showTourStep(0);
}

async function showTourStep(i) {
  const step = TOUR_STEPS[i];
  const target = document.querySelector(step.selector);
  if (!target) { nextTourStep(); return; }
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await wait(350);
  const rect = target.getBoundingClientRect();
  const spotlight = document.getElementById('tour-spotlight');
  const cursor = document.getElementById('tour-cursor');
  const card = document.getElementById('tour-card');

  spotlight.style.left = (rect.left - 8) + 'px';
  spotlight.style.top = (rect.top - 8) + 'px';
  spotlight.style.width = (rect.width + 16) + 'px';
  spotlight.style.height = (rect.height + 16) + 'px';
  cursor.style.left = (rect.left + rect.width / 2 - 11) + 'px';
  cursor.style.top = (rect.top + rect.height / 2 - 11) + 'px';

  let cardLeft = rect.right + 24;
  let cardTop = rect.top;
  if (cardLeft + 320 > window.innerWidth) { cardLeft = rect.left; cardTop = rect.bottom + 20; }
  cardLeft = Math.max(16, Math.min(cardLeft, window.innerWidth - 336));
  if (cardTop + 190 > window.innerHeight) { cardTop = window.innerHeight - 210; }
  card.style.left = cardLeft + 'px';
  card.style.top = Math.max(16, cardTop) + 'px';

  document.getElementById('tour-step-count').textContent = `Step ${i + 1} of ${TOUR_STEPS.length}`;
  document.getElementById('tour-title').textContent = step.title;
  document.getElementById('tour-text').textContent = step.text;
  document.getElementById('tour-next').textContent = (i === TOUR_STEPS.length - 1) ? 'Finish' : 'Next →';
}

function nextTourStep() {
  tourIndex++;
  if (tourIndex >= TOUR_STEPS.length) { endTour(); return; }
  showTourStep(tourIndex);
}

function endTour() { document.getElementById('tour-layer').hidden = true; }

/* ---------------- boot ---------------- */

async function boot() {
  const intro = document.getElementById('intro-splash');
  document.getElementById('intro-continue').addEventListener('click', () => { intro.classList.add('is-hidden'); });

  STORES = await loadStores();
  renderSidebar();

  document.getElementById('dash-main').addEventListener('click', (e) => {
    const kpi = e.target.closest('.kpi-tile[data-kpi]');
    if (kpi) { handleKpiClick(kpi.dataset.kpi, e); return; }

    const row = e.target.closest('.rank-row[data-drill]');
    if (row) { dispatchDrillFromPage(row.dataset.drill, row.dataset.drillId, e); return; }

    const tabBtn = e.target.closest('.dash-tab[data-store-tab]');
    if (tabBtn) { location.hash = `#store-${CURRENT.id}/${tabBtn.dataset.storeTab}`; return; }

    const chip = e.target.closest('.filter-chip[data-filter]');
    if (chip) {
      chip.parentElement.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      applyReceiptFilter(chip.dataset.filter);
      return;
    }

    const receiptBtn = e.target.closest('.receipt__btn[data-receipt-action]');
    if (receiptBtn) {
      receiptBtn.classList.toggle('is-done');
      const card = receiptBtn.closest('.receipt');
      const statusEl = card.querySelector('.receipt__foot .status');
      if (receiptBtn.dataset.receiptAction === 'ready' && receiptBtn.classList.contains('is-done')) {
        statusEl.textContent = 'Ready'; statusEl.className = 'status status--ok';
      } else if (receiptBtn.dataset.receiptAction === 'shipped' && receiptBtn.classList.contains('is-done')) {
        statusEl.textContent = 'Handed off'; statusEl.className = 'status status--ok';
      }
      return;
    }

    const flowNode = e.target.closest('.data-flow__node[data-flow-action]');
    if (flowNode) {
      const action = flowNode.dataset.flowAction;
      if (action === 'printers') { location.hash = `#store-${CURRENT.id}/printers`; return; }
      if (action === 'overview') { location.hash = `#store-${CURRENT.id}`; return; }
      const store = STORES.find(s => s.id === CURRENT.id);
      if (action === 'channel') { openDrill(drillStoreChannelsContent(store), e); return; }
      if (action === 'dish') { openDrill(drillStoreDishes(store), e); return; }
      return;
    }

    const switcherBtn = e.target.closest('#store-switcher-btn');
    if (switcherBtn) {
      const menu = document.getElementById('store-switcher-menu');
      menu.hidden = !menu.hidden;
      return;
    }

    const switcherItem = e.target.closest('.store-switcher__item[data-switch-route]');
    if (switcherItem) { location.hash = '#' + switcherItem.dataset.switchRoute; return; }

    // clicked elsewhere on the page — close the dropdown if it's open
    const openMenu = document.getElementById('store-switcher-menu');
    if (openMenu && !openMenu.hidden) openMenu.hidden = true;
  });

  document.getElementById('dash-main').addEventListener('change', (e) => {
    const sel = e.target.closest('#order-day-select');
    if (sel && CURRENT.name === 'store') {
      const store = STORES.find(s => s.id === CURRENT.id);
      renderOrdersReceipts(store, sel.value);
    }
  });

  document.getElementById('dash-nav').addEventListener('click', (e) => {
    const item = e.target.closest('.dash-nav__item[data-route]');
    if (item) location.hash = '#' + item.dataset.route;
  });

  document.getElementById('drill-body').addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-source-toggle]');
    if (toggle) {
      const body = toggle.nextElementSibling;
      const open = !body.hidden;
      body.hidden = open;
      toggle.textContent = toggle.textContent.replace(open ? '▾' : '▸', open ? '▸' : '▾');
      return;
    }
    const mixTab = e.target.closest('.dash-tab[data-mix-tab]');
    if (mixTab) {
      mixTab.parentElement.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
      mixTab.classList.add('active');
      const target = mixTab.dataset.mixTab;
      document.querySelectorAll('[data-mix-view]').forEach(v => { v.hidden = v.dataset.mixView !== target; });
      return;
    }
    const row = e.target.closest('[data-drill]');
    if (row) dispatchDrillFromOverlay(row.dataset.drill, row.dataset.drillId);
  });
  document.getElementById('drill-close').addEventListener('click', closeDrill);
  document.getElementById('drill-backdrop').addEventListener('click', closeDrill);
  document.getElementById('drill-back').addEventListener('click', popDrill);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrill(); });

  document.getElementById('start-tour').addEventListener('click', (e) => {
    e.currentTarget.classList.remove('is-pulsing');
    startTour();
  });
  document.getElementById('tour-next').addEventListener('click', nextTourStep);
  document.getElementById('tour-skip').addEventListener('click', endTour);

  window.addEventListener('hashchange', router);
  window.addEventListener('resize', () => router());
  if (!location.hash) location.hash = '#overview';
  router();
}

boot();
