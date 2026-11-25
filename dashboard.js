/* ============================================================
   Tractor Head Office Dashboard
   One source of truth: data/store-XX.md (YAML frontmatter + a
   short note). Every number on every screen is computed from it
   at load time — edit a store file, the whole portal updates.
   ============================================================ */

let STORES = [];
let CURRENT = { name: 'overview' };
let drillStack = [];
let currentDrillContent = null;

/* ---------------- data loading ---------------- */

async function loadStores() {
  const ids = ['01', '02', '03', '04'];
  const texts = await Promise.all(ids.map(id => fetch(`data/store-${id}.md`).then(r => r.text())));
  return texts.map(parseStoreMarkdown).sort((a, b) => a.id.localeCompare(b.id));
}

function parseStoreMarkdown(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const data = jsyaml.load(match ? match[1] : text);
  data.body = match ? match[2].trim() : '';
  return data;
}

function isFlagged(store) { return /^flagged\./i.test((store.body || '').trim()); }

/* ---------------- aggregation (the order book, rolled up) ---------------- */

function monthTotal(m) { return m.doordash + m.ubereats + m.instore + m.website; }
function pctDelta(curr, prev) { return prev ? ((curr - prev) / prev) * 100 : 0; }

function aggregateMonths(stores) {
  const labels = stores[0].months.map(m => m.label);
  return labels.map((label, i) => {
    const agg = { label, doordash: 0, ubereats: 0, instore: 0, website: 0 };
    stores.forEach(s => {
      const m = s.months[i];
      agg.doordash += m.doordash; agg.ubereats += m.ubereats; agg.instore += m.instore; agg.website += m.website;
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

function trendArrow(trend) {
  const map = { up: ['▲', 'up'], down: ['▼', 'down'], flat: ['→', 'flat'] };
  const [glyph, cls] = map[trend] || map.flat;
  return `<span class="trend-arrow ${cls}" title="${trend}">${glyph}</span>`;
}

function rankRowHTML({ rank, name, value, pct, color, badge, trend, drill, drillId }) {
  const drillAttr = drill ? `data-drill="${drill}" data-drill-id="${drillId}"` : '';
  return `<div class="rank-row" ${drillAttr}>
    <div class="rank-num">${rank}</div>
    <div class="rank-name"><span class="dot" style="background:${color}"></span>${name}${badge ? `<span class="trend-badge">${badge}</span>` : ''}${trend ? trendArrow(trend) : ''}</div>
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

function statTile({ id, tourId, label, value, sub, deltaPct, isPct, spark, noDelta, flagged }) {
  const dir = deltaPct > 0.4 ? 'up' : deltaPct < -0.4 ? 'down' : 'flat';
  const deltaHTML = noDelta
    ? (sub ? `<div class="delta flat">${sub}</div>` : '')
    : `<div class="delta ${dir}">${dir === 'up' ? '▲' : dir === 'down' ? '▼' : '→'} ${Math.abs(deltaPct).toFixed(1)}${isPct ? ' pts' : '%'} vs last month</div>`;
  const sparkHTML = spark ? `<svg class="spark" data-spark='${JSON.stringify(spark)}'></svg>` : '';
  return `<div class="kpi-tile" data-kpi="${id}" tabindex="0" role="button" ${tourId ? `data-tour="${tourId}"` : ''} style="${flagged ? 'border-color:var(--magenta-600)' : ''}">
    <div class="label">${label}</div>
    <div class="value" style="${flagged ? 'color:var(--magenta-600)' : ''}">${value}</div>
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
  const ranked = storeComparison(STORES);
  const max = ranked[0].total || 1;
  const html = `<div class="rank-list">${ranked.map((s, i) => rankRowHTML({
    rank: i + 1, name: s.name, value: s.total.toLocaleString(), pct: (s.total / max) * 100,
    color: s.flagged ? 'var(--magenta-600)' : 'var(--sage-700)', badge: s.flagged ? 'Flagged' : null,
    drill: 'store-detail', drillId: s.id,
  })).join('')}</div>
  <p style="margin-top:16px;color:var(--ink-600);font-size:0.85rem;">Click a store to see its channel split, then open its full dashboard.</p>`;
  return { title: 'Orders by store, this month', html };
}

function drillChannelMix() {
  const latest = aggregateMonths(STORES).slice(-1)[0];
  const mix = channelMix(latest);
  const html = `<div class="rank-list">${mix.map((c, i) => rankRowHTML({
    rank: i + 1, name: c.name, value: `${c.pct.toFixed(0)}% · ${c.value.toLocaleString()}`, pct: c.pct,
    color: channelColor(c.key), drill: 'channel-detail', drillId: c.key,
  })).join('')}</div>
  <p style="margin-top:16px;color:var(--ink-600);font-size:0.85rem;">Click a channel to see it broken down by store.</p>`;
  return { title: `Channel mix, ${latest.label}`, html };
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
  })).join('')}</div>`;
  return { title: `${names[channelKey]} — by store`, html };
}

function drillDishBoard() {
  const dishes = aggregateDishes(STORES);
  const max = dishes[0].orders || 1;
  const html = `<div class="rank-list">${dishes.map((d, i) => rankRowHTML({
    rank: i + 1, name: d.name, value: d.orders.toLocaleString(), pct: (d.orders / max) * 100, color: 'var(--sage-700)',
    trend: d.trend, badge: i === 0 ? 'Trending' : null, drill: 'dish-detail', drillId: d.name,
  })).join('')}</div>
  <p style="margin-top:16px;color:var(--ink-600);font-size:0.85rem;">Click a dish to see which stores are selling it.</p>`;
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
  })).join('')}</div>`;
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
  }).join('');
  return { title: 'Which stores need attention', html };
}

function drillStoreChannelsContent(store, opts = {}) {
  const latest = store.months[store.months.length - 1];
  const mix = channelMix(latest);
  const linkHtml = opts.showLink === false ? '' : `<div class="drill-link-row" data-drill="goto-store" data-drill-id="${store.id}" style="margin-top:18px;"><span>Open ${store.name}'s full dashboard</span><span>→</span></div>`;
  const html = `<div class="rank-list">${mix.map((c, i) => rankRowHTML({
    rank: i + 1, name: c.name, value: `${c.pct.toFixed(0)}%`, pct: c.pct, color: channelColor(c.key),
  })).join('')}</div>${linkHtml}`;
  return { title: `${store.name} — channel split, ${latest.label}`, html };
}

function drillStoreMonths(store) {
  const rows = store.months.map(m => `<tr><td>${m.label}</td><td>${m.doordash}</td><td>${m.ubereats}</td><td>${m.instore}</td><td>${m.website}</td><td><b>${monthTotal(m).toLocaleString()}</b></td></tr>`).join('');
  const html = `<table class="data"><thead><tr><th>Month</th><th>DoorDash</th><th>Uber Eats</th><th>In-store</th><th>Website</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>`;
  return { title: `${store.name} — orders by month`, html };
}

function drillStoreDishes(store) {
  const max = store.top_dishes[0].orders || 1;
  const html = `<div class="rank-list">${store.top_dishes.map((d, i) => rankRowHTML({
    rank: i + 1, name: d.name, value: d.orders.toLocaleString(), pct: (d.orders / max) * 100, color: 'var(--sage-700)',
    trend: d.trend, badge: i === 0 ? 'Trending' : null,
  })).join('')}</div>`;
  return { title: `${store.name} — top dishes`, html };
}

function handleKpiClick(kpiId, evt) {
  if (CURRENT.name === 'overview') {
    if (kpiId === 'kpi-orders') openDrill(drillStoreList(), evt);
    else if (kpiId === 'kpi-online') openDrill(drillChannelMix(), evt);
    else if (kpiId === 'kpi-dish') openDrill(drillDishBoard(), evt);
    else if (kpiId === 'kpi-flags') openDrill(drillFlags(), evt);
  } else {
    const store = STORES.find(s => s.id === CURRENT.id);
    if (kpiId === 'kpi-orders') openDrill(drillStoreMonths(store), evt);
    else if (kpiId === 'kpi-online') openDrill(drillStoreChannelsContent(store, { showLink: false }), evt);
    else if (kpiId === 'kpi-dish') openDrill(drillStoreDishes(store), evt);
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
  const mix = channelMix(latest);
  const onlineShare = onlineSharePct(latest);
  const onlineDelta = onlineShare - onlineSharePct(prev);
  const dishes = aggregateDishes(STORES);
  const topDish = dishes[0];
  const storesRanked = storeComparison(STORES);
  const flaggedCount = storesRanked.filter(s => s.flagged).length;
  const storeMax = storesRanked[0].total || 1;

  page.innerHTML = `
    <div class="dash-header">
      <div><div class="eyebrow eyebrow--sage">Head office</div><h1>All stores, one order book.</h1></div>
      <div class="updated">Last updated · ${latest.label} 2026</div>
    </div>

    <div class="kpi-row">
      ${statTile({ id: 'kpi-orders', tourId: 'kpi-0', label: `Total orders, ${latest.label}`, value: latestTotal.toLocaleString(), deltaPct, spark: monthsAgg.map(monthTotal) })}
      ${statTile({ id: 'kpi-online', label: 'Online share', value: onlineShare.toFixed(0) + '%', deltaPct: onlineDelta, isPct: true, spark: monthsAgg.map(onlineSharePct) })}
      ${statTile({ id: 'kpi-dish', label: 'Top dish', value: topDish.name, sub: topDish.orders.toLocaleString() + ' orders · trending ' + topDish.trend, noDelta: true })}
      ${statTile({ id: 'kpi-flags', label: 'Stores flagged', value: `${flaggedCount} of ${storesRanked.length}`, sub: flaggedCount ? 'Needs attention' : 'All steady', noDelta: true, flagged: flaggedCount > 0 })}
    </div>

    <div class="dash-section" data-tour="channel-mix">
      <div class="dash-section__title">Channel mix — ${latest.label}</div>
      <div class="dash-card"><div class="rank-list" id="channel-mix-list"></div></div>
    </div>

    <div class="dash-section" data-tour="trend-chart">
      <div class="dash-section__title">Monthly order trend — all stores</div>
      <div class="dash-card chart-wrap"><svg class="linechart" id="trend-chart"></svg><div class="chart-tooltip" id="trend-tooltip"></div></div>
    </div>

    <div class="dash-section" data-tour="store-list">
      <div class="dash-section__title">Stores, ranked by orders this month</div>
      <div class="dash-card"><div class="rank-list" id="store-rank-list"></div></div>
    </div>

    <div class="dash-section" data-tour="dish-board">
      <div class="dash-section__title">Top 5 dishes — all stores</div>
      <div class="dash-card"><div class="rank-list" id="dish-rank-list"></div></div>
    </div>
  `;

  drawRankList('channel-mix-list', mix.map(c => ({ name: c.name, value: `${c.pct.toFixed(0)}%`, pct: c.pct, color: channelColor(c.key), drill: 'channel-detail', drillId: c.key })));
  drawRankList('store-rank-list', storesRanked.map(s => ({ name: s.name, value: s.total.toLocaleString(), pct: (s.total / storeMax) * 100, color: s.flagged ? 'var(--magenta-600)' : 'var(--sage-700)', badge: s.flagged ? 'Flagged' : null, drill: 'goto-store', drillId: s.id })));
  drawRankList('dish-rank-list', dishes.map((d, i) => ({ name: d.name, value: d.orders.toLocaleString(), pct: (d.orders / (dishes[0].orders || 1)) * 100, color: 'var(--sage-700)', trend: d.trend, badge: i === 0 ? 'Trending' : null, drill: 'dish-detail', drillId: d.name })));
  drawLineChart('trend-chart', 'trend-tooltip', monthsAgg.map(m => ({ label: m.label, value: monthTotal(m) })), 'var(--sage-700)');
  bindSparklines();
}

function buildOrdersTabHTML(store) {
  const channels = ['All', 'DoorDash', 'Uber Eats', 'In-store', 'Website'];
  return `
    <div class="filter-row">${channels.map(c => `<button class="filter-chip ${c === 'All' ? 'active' : ''}" data-filter="${c}">${c}</button>`).join('')}</div>
    <table class="data">
      <thead><tr><th>Order</th><th>Source</th><th>Time</th><th>Dish</th><th>Total</th><th>Status</th></tr></thead>
      <tbody id="orders-tbody">${store.recent_orders.map(orderRowHTML).join('')}</tbody>
    </table>`;
}

function orderRowHTML(o) {
  return `<tr data-source="${o.source}">
    <td>${o.order_no}</td>
    <td><span class="channel-badge" style="background:${channelColorBySourceLabel(o.source)}">${o.source}</span></td>
    <td>${o.time}</td><td>${o.dish}</td><td>$${o.total.toFixed(2)}</td>
    <td><span class="status status--${o.status === 'Review' ? 'review' : 'ok'}">${o.status}</span></td>
  </tr>`;
}

function renderStore(storeId, tab) {
  const store = STORES.find(s => s.id === storeId);
  if (!store) { location.hash = '#overview'; return; }
  const page = document.getElementById('dash-page');
  const latest = store.months[store.months.length - 1];
  const prev = store.months[store.months.length - 2];
  const latestTotal = monthTotal(latest);
  const deltaPct = pctDelta(latestTotal, monthTotal(prev));
  const mix = channelMix(latest);
  const onlineShare = onlineSharePct(latest);
  const onlineDelta = onlineShare - onlineSharePct(prev);
  const topDish = store.top_dishes[0];

  page.innerHTML = `
    <div class="dash-header">
      <div><div class="eyebrow eyebrow--sage">${store.address || ''}</div><h1>${store.name}</h1></div>
      <div class="updated">Last updated · ${latest.label} 2026</div>
    </div>
    <div class="dash-tabs">
      <button class="dash-tab ${tab === 'overview' ? 'active' : ''}" data-store-tab="overview">Overview</button>
      <button class="dash-tab ${tab === 'orders' ? 'active' : ''}" data-store-tab="orders">Orders</button>
    </div>
    <div id="store-tab-content"></div>
  `;

  const content = document.getElementById('store-tab-content');
  if (tab === 'orders') {
    content.innerHTML = buildOrdersTabHTML(store);
    return;
  }

  content.innerHTML = `
    ${store.body ? `<div class="note-card">${escapeHTML(store.body)}</div>` : ''}
    <div class="kpi-row">
      ${statTile({ id: 'kpi-orders', label: `Orders, ${latest.label}`, value: latestTotal.toLocaleString(), deltaPct, spark: store.months.map(monthTotal) })}
      ${statTile({ id: 'kpi-online', label: 'Online share', value: onlineShare.toFixed(0) + '%', deltaPct: onlineDelta, isPct: true, spark: store.months.map(onlineSharePct) })}
      ${statTile({ id: 'kpi-dish', label: 'Top dish', value: topDish.name, sub: topDish.orders.toLocaleString() + ' orders', noDelta: true })}
    </div>
    <div class="dash-section">
      <div class="dash-section__title">Channel mix — ${latest.label}</div>
      <div class="dash-card"><div class="rank-list" id="store-channel-list"></div></div>
    </div>
    <div class="dash-section">
      <div class="dash-section__title">Monthly order trend</div>
      <div class="dash-card chart-wrap"><svg class="linechart" id="store-trend-chart"></svg><div class="chart-tooltip" id="store-trend-tooltip"></div></div>
    </div>
    <div class="dash-section">
      <div class="dash-section__title">Top 5 dishes</div>
      <div class="dash-card"><div class="rank-list" id="store-dish-list"></div></div>
    </div>
  `;
  drawRankList('store-channel-list', mix.map(c => ({ name: c.name, value: `${c.pct.toFixed(0)}%`, pct: c.pct, color: channelColor(c.key) })));
  drawLineChart('store-trend-chart', 'store-trend-tooltip', store.months.map(m => ({ label: m.label, value: monthTotal(m) })), 'var(--sage-700)');
  drawRankList('store-dish-list', store.top_dishes.map((d, i) => ({ name: d.name, value: d.orders.toLocaleString(), pct: (d.orders / (store.top_dishes[0].orders || 1)) * 100, color: 'var(--sage-700)', trend: d.trend, badge: i === 0 ? 'Trending' : null })));
  bindSparklines();
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
  { selector: '[data-tour="sidebar"]', title: 'Welcome to the admin portal', text: "This is the dashboard Tractor's head office uses to watch every store and every channel in one place. Let's walk through it." },
  { selector: '[data-tour="nav-overview"]', title: 'Head office vs. each store', text: 'Overview rolls up every store. Below it, each store has its own dashboard — same layout, scoped to just that location.' },
  { selector: '[data-tour="kpi-0"]', title: 'Every number opens up', text: "These tiles aren't static — click any one and it opens a deeper breakdown of what's behind the number." },
  { selector: '[data-tour="channel-mix"]', title: 'Ranked, not charted', text: 'Channels are ranked by volume instead of a pie chart — faster to see who needs attention. Every bar here is clickable too.' },
  { selector: '[data-tour="trend-chart"]', title: 'The trend, at a glance', text: 'Hover anywhere on the line to see the exact order count for that month.' },
  { selector: '[data-tour="store-list"]', title: 'Jump into any store', text: 'Click a store here to switch straight into its own dashboard.' },
  { selector: '[data-tour="dish-board"]', title: "What's trending on the menu", text: 'The top dishes across every store, ranked — click one to see which stores are driving it.' },
  { selector: '[data-tour="tour-btn"]', title: "That's the whole portal", text: "Open any store's Orders tab to see the order book itself, one order at a time. Replay this tour anytime from here." },
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
  if (cardLeft + 320 > window.innerWidth) { cardLeft = Math.max(16, rect.left); cardTop = rect.bottom + 20; }
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
      const val = chip.dataset.filter;
      document.querySelectorAll('#orders-tbody tr').forEach(tr => { tr.style.display = (val === 'All' || tr.dataset.source === val) ? '' : 'none'; });
    }
  });

  document.getElementById('dash-nav').addEventListener('click', (e) => {
    const item = e.target.closest('.dash-nav__item[data-route]');
    if (item) location.hash = '#' + item.dataset.route;
  });

  document.getElementById('drill-body').addEventListener('click', (e) => {
    const row = e.target.closest('[data-drill]');
    if (row) dispatchDrillFromOverlay(row.dataset.drill, row.dataset.drillId);
  });
  document.getElementById('drill-close').addEventListener('click', closeDrill);
  document.getElementById('drill-backdrop').addEventListener('click', closeDrill);
  document.getElementById('drill-back').addEventListener('click', popDrill);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrill(); });

  document.getElementById('start-tour').addEventListener('click', startTour);
  document.getElementById('tour-next').addEventListener('click', nextTourStep);
  document.getElementById('tour-skip').addEventListener('click', endTour);

  window.addEventListener('hashchange', router);
  window.addEventListener('resize', () => router());
  if (!location.hash) location.hash = '#overview';
  router();
}

boot();
