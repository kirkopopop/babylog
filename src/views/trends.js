// Trends: targets scorecard, KPIs vs previous period, sleep / feeding / growth charts.
import { esc, dayKey, keyAdd, fromKey, addDays, hToHHMM, fmtDate, ordinal, ageMonths } from '../util.js';
import { events, state } from '../store.js';
import { model, stats, lastWindow, series, scorecard, foods, allergens, textures, growth, milkBand, atZ, targets } from '../analytics.js';
import { actogram, lineChart, barChart, clockChart, growthChart } from '../charts.js';
import { dayRows } from './today.js';
import { editEvent } from '../sheets.js';
import { describe } from '../ui.js';
import { ICON } from '../icons.js';

const ui = { range: 28, tab: 'overview' };
const pctTxt = p => p < 1 ? 'below 1st' : p > 99 ? 'above 99th' : ordinal(p);
const RANGES = [[14, '2 weeks'], [28, '4 weeks'], [91, '3 months'], [0, 'All']];
const TABS = [['overview', 'Overview'], ['sleep', 'Sleep'], ['feeding', 'Feeding'], ['growth', 'Growth']];
const fmt1 = v => v == null ? '–' : v.toFixed(1);
const delta = (a, b, unit = '', d = 1, invert = false) => {
  if (a == null || b == null) return '';
  const x = a - b; if (Math.abs(x) < 10 ** -d / 2) return 'same as before';
  return `${x > 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}${unit} vs previous${invert ? '' : ''}`;
};
const hDelta = (a, b) => { if (a == null || b == null) return ''; const m = Math.round((a - b) * 60); return !m ? 'same as before' : `${Math.abs(m)} min ${m > 0 ? 'later' : 'earlier'} than before`; };

export function render(root) {
  const ev = events(); const m = model(ev, state.version, state.baby);
  if (!ev.length) { root.innerHTML = `<section><h1>Trends</h1><div class="panel"><p class="empty">No data yet. Log a few days, or import the MyBaby history in Settings.</p></div></section>`; return; }
  const firstKey = dayKey(ev[0]._s);
  const n = ui.range || Math.round((addDays(new Date(), -1) - fromKey(firstKey)) / 864e5) + 1;
  const [from, to] = lastWindow(Math.min(ui.range || n, n));
  const [pfrom, pto] = [keyAdd(from, -(Math.min(ui.range || n, 28))), keyAdd(from, -1)];
  const st = stats(m, from, to), prev = stats(m, pfrom, pto);
  const head = `
    <section style="margin-top:4px"><div class="sec-head"><h1>Trends</h1><p>${esc(fmtDate(fromKey(from)))} – ${esc(fmtDate(fromKey(to)))}, complete days</p></div>
      <div class="row" style="justify-content:space-between">
        <div class="seg" role="group" aria-label="Section">${TABS.map(([k, l]) => `<button data-tab="${k}" aria-pressed="${ui.tab === k}">${l}</button>`).join('')}</div>
        <div class="seg" role="group" aria-label="Range">${RANGES.map(([k, l]) => `<button data-range="${k}" aria-pressed="${ui.range === k}">${l}</button>`).join('')}</div>
      </div></section>`;
  let body = '';
  if (ui.tab === 'overview') body = overview(m, st, prev, from, to);
  if (ui.tab === 'sleep') body = sleepTab(m, st, prev);
  if (ui.tab === 'feeding') body = feedingTab(m, st, prev, from, to);
  if (ui.tab === 'growth') body = growthTab(m);
  root.innerHTML = head + body;
  root.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { ui.tab = b.dataset.tab; render(root); }));
  root.querySelector('[data-allmeas]')?.addEventListener('click', () => { ui.allMeas = true; render(root); });
  root.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', () => { ui.range = Number(b.dataset.range); render(root); }));
  draw(root, m, from, to, ev);
}

// ---------------- overview ----------------
function kpiTile(label, val, unit, d, chip) { return `<div class="kpi"><div class="label">${esc(label)}</div><div class="val">${val}<small>${esc(unit)}</small></div><div class="delta">${esc(d || '')}</div>${chip ? `<div><span class="chip ${chip[0]}">${esc(chip[1])}</span></div>` : ''}</div>`; }
function overview(m, st, prev, from, to) {
  const sc = scorecard(m, st);
  const tiles = [
    kpiTile('Night sleep', fmt1(st.nightH), 'h', delta(st.nightH, prev.nightH, ' h')),
    kpiTile('Slept through', st.through == null ? '–' : Math.round(st.through), '%', delta(st.through, prev.through, ' pts', 0)),
    kpiTile('Bedtime', hToHHMM(st.bedH), '', hDelta(st.bedH, prev.bedH)),
    kpiTile('Wake-up', hToHHMM(st.wakeH), '', hDelta(st.wakeH, prev.wakeH)),
    kpiTile('Naps', fmt1(st.naps), `/day · ${fmt1(st.napH)} h`, delta(st.napH, prev.napH, ' h')),
    kpiTile('Last nap ends', hToHHMM(st.lastNapH), '', hDelta(st.lastNapH, prev.lastNapH)),
    kpiTile('Milk', st.ml == null ? '–' : Math.round(st.ml), 'ml/day', delta(st.ml, prev.ml, ' ml', 0)),
    kpiTile('Solid meals', fmt1(st.solids), '/day', delta(st.solids, prev.solids, '')),
    kpiTile('Night feeds', fmt1(st.nightFeeds), '/night', delta(st.nightFeeds, prev.nightFeeds, '')),
  ];
  const groups = ['Sleep', 'Feeding'];
  const t = sc.t;
  return `
    <section><div class="kpis">${tiles.join('')}</div><p class="note">Averages and medians over the selected days, compared with the period just before.</p></section>
    <section><div class="sec-head"><h2>Targets</h2><p>Based on ${t.napsBasis} nap${t.napsBasis === 1 ? '' : 's'} a day. Change them in Settings.</p></div>
      <div class="panel score">
      ${groups.map(g => `<div class="grp eyebrow">${g}</div>` + sc.rows.filter(r => r.group === g).map(r => `<div class="item"><b>${esc(r.label)}</b><span class="vals">${esc(r.now)} <span>· target</span> ${esc(r.target)}</span><span class="chip ${r.status}">${esc(r.txt)}</span></div>`).join('')).join('')}
      </div></section>
    <section><div class="panel"><h3>Three weeks, hour by hour</h3><div class="sub">Tap a block or dot to edit it.</div><div class="chart" id="c-acto"></div>
      <div class="legend"><span><i class="sw" style="background:var(--night)"></i>Night</span><span><i class="sw" style="background:var(--nap)"></i>Nap</span><span><i class="sw dot" style="background:var(--bottle)"></i>Bottle (size = ml)</span><span><i class="sw dia" style="background:var(--solid)"></i>Meal</span></div></div></section>`;
}

// ---------------- sleep ----------------
function sleepTab(m, st, prev) {
  return `
    <section><div class="kpis">
      ${kpiTile('Night sleep', fmt1(st.nightH), 'h', delta(st.nightH, prev.nightH, ' h'))}
      ${kpiTile('Total per 24 h', fmt1(st.totalH), 'h', '12–16 h is typical for 4–12 months')}
      ${kpiTile('Longest stretch', fmt1(st.longest), 'h', delta(st.longest, prev.longest, ' h'))}
      ${kpiTile('Wake-ups', fmt1(st.wakes), '/night', delta(st.wakes, prev.wakes, ''))}
      ${kpiTile('Awake before bed', fmt1(st.gapH), 'h', delta(st.gapH, prev.gapH, ' h'))}
      ${kpiTile('Naps', fmt1(st.naps), '/day', `${fmt1(st.napH)} h in total`)}
    </div></section>
    <section><div class="panel"><h3>When he sleeps</h3><div class="sub">Weekly medians. Shaded: target bedtime window.</div><div class="chart" id="c-clock"></div>
      <div class="legend"><span><i class="sw line" style="background:var(--night)"></i>Bedtime</span><span><i class="sw line" style="background:var(--nap)"></i>Last nap ends</span></div>
      <h3 style="margin-top:18px">Wake-up</h3><div class="sub">Weekly median of the morning wake-up</div><div class="chart" id="c-wake"></div></div></section>
    <div class="grid2" style="margin-top:12px">
      <div class="panel"><h3>Sleep hours per day</h3><div class="sub">Weekly average of night sleep and naps</div><div class="chart" id="c-hours"></div>
        <div class="legend"><span><i class="sw line" style="background:var(--night)"></i>Night</span><span><i class="sw line" style="background:var(--nap)"></i>Naps</span></div></div>
      <div class="panel"><h3>Nights slept straight through</h3><div class="sub">Share of nights with one unbroken sleep, by week</div><div class="chart" id="c-through"></div></div>
      <div class="panel"><h3>Night feeds</h3><div class="sub">Feeds between 23:00 and 05:00, average per night by week</div><div class="chart" id="c-nfeeds"></div></div>
      <div class="panel"><h3>Naps per day</h3><div class="sub">Weekly average. A drop marks a nap transition.</div><div class="chart" id="c-naps"></div></div>
    </div>`;
}

// ---------------- feeding ----------------
function feedingTab(m, st, prev, from, to) {
  const ageM = ageMonths(fromKey(m.baby.birth_date)); const band = milkBand(ageM);
  const F = foods(m); const A = allergens(m); const T = textures(m, from, to);
  const nd = stats(m, from, to);
  return `
    <section><div class="kpis">
      ${kpiTile('Milk', st.ml == null ? '–' : Math.round(st.ml), 'ml/day', band ? `guideline now ${band[0]}–${band[1]} ml` : '')}
      ${kpiTile('Bottles', fmt1(st.bottles), '/day', st.small ? `${fmt1(st.small)} small top-ups (≤80 ml)` : 'no small top-ups')}
      ${kpiTile('Solid meals', fmt1(st.solids), '/day', delta(st.solids, prev.solids, ''))}
      ${kpiTile('Foods tried', F.length, '', `${F.filter(f => Date.now() - f.first < 14 * 864e5).length} new in the last 2 weeks`)}
      ${kpiTile('Vitamin D', st.vitdDays, `of ${st.nDays} days`, '10 µg daily until age 4')}
      ${kpiTile('Nappies', nd.nappyDays ? fmt1(nd.nappies) : '–', '/day', nd.nappyDays ? `${fmt1(nd.poops)} poopy, on ${nd.nappyDays} logged days` : 'not logged in this period')}
    </div></section>
    <div class="grid2" style="margin-top:12px">
      <div class="panel"><h3>Milk per day</h3><div class="sub">Weekly average, ml. Shaded: Danish guideline for his age.</div><div class="chart" id="c-ml"></div></div>
      <div class="panel"><h3>Feeds per day</h3><div class="sub">Bottles and nursing sessions, weekly average</div><div class="chart" id="c-feeds"></div>
        <div class="legend"><span><i class="sw" style="background:var(--bottle)"></i>Bottles</span>${series(m, from, to, 'week').some(w => w.nursing) ? '<span><i class="sw" style="background:var(--nurse)"></i>Nursing</span>' : ''}</div></div>
      <div class="panel"><h3>Solid meals per day</h3><div class="sub">Weekly average since solids started</div><div class="chart" id="c-solids"></div></div>
      <div class="panel"><h3>Texture of logged meals</h3><div class="sub">${T.n ? `${T.n} meals with texture logged in this period` : 'Pick a texture when logging meals to see this'}</div>
        ${T.n ? `<div class="chart" id="c-tex"></div>` : `<p class="empty">From 8 months, guidance moves to mashed and lumpy food plus soft finger foods.</p>`}</div>
    </div>
    <section><div class="sec-head"><h2>Allergens</h2><p>Danish guidance: introduce them and keep them in the diet.</p></div>
      <div class="allergens">${A.map(a => `<div class="allergen ${a.n ? '' : 'missing'}"><b>${esc(a.name)}</b><span>${a.n ? `${a.n}× · last ${esc(fmtDate(a.last))}${a.reaction ? ' · reaction noted' : ''}` : 'Not tried yet'}</span><span class="chip ${!a.n ? 'bad' : a.recent ? 'good' : 'warn'}">${!a.n ? 'Introduce' : a.recent ? 'In rotation' : 'Offer again'}</span><span class="faint" style="font-size:12px">${esc(a.tip)}</span></div>`).join('')}</div></section>
    <section><div class="sec-head"><h2>Foods tried</h2><p>In the order they first appeared; the number is how many meals included it.</p></div>
      <div class="panel"><div class="foods">${F.map(f => `<span class="food" title="First: ${esc(fmtDate(f.first))}">${esc(f.food)}<span class="n">${f.n}</span></span>`).join('') || '<p class="empty">No meals logged yet.</p>'}</div></div></section>`;
}

// ---------------- growth ----------------
function growthTab(m) {
  const G = growth(m); const ms = m.evts.filter(e => e.kind === 'milestone').slice().reverse();
  const card = (k, title) => { const l = G[k][G[k].length - 1]; return `<div class="panel"><h3>${title}</h3><div class="sub">${l ? `<b class="num">${l.v} ${k === 'weight' ? 'kg' : 'cm'}</b> on ${esc(fmtDate(l.d))} · about ${pctTxt(l.p)} percentile` : 'No measurements yet'}</div><div class="chart" id="g-${k}"></div></div>`; };
  const allRows = [...G.weight, ...G.length, ...G.head].sort((a, b) => b.d - a.d); const rows = ui.allMeas ? allRows : allRows.slice(0, 9);
  return `
    <section><div class="sec-head"><h2>Growth</h2><p>Against WHO growth standards. Bands: 3rd–97th and 15th–85th percentiles; dashed line is the median. Hollow dots are home measurements.</p></div>
      <div class="grid2">${card('weight', 'Weight')}${card('length', 'Length')}${card('head', 'Head circumference')}</div></section>
    <section><div class="sec-head"><h2>Measurements</h2></div><div class="panel tbl-wrap"><table><thead><tr><th>Date</th><th>Measure</th><th>Value</th><th>Percentile</th></tr></thead><tbody>
      ${rows.map(r => `<tr data-id="${esc(r.e.id)}" style="cursor:pointer"><td>${esc(fmtDate(r.d))}</td><td>${esc(describe(r.e).title.split(' ')[0])}</td><td class="mono">${r.v} ${esc(r.e.unit || '')}</td><td class="mono">${pctTxt(r.p)}${r.home ? ' <span class="faint">home</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Nothing yet</td></tr>'}
    </tbody></table>${allRows.length > rows.length ? `<div class="row" style="justify-content:center;margin-top:10px"><button class="btn" data-allmeas>Show all ${allRows.length}</button></div>` : ''}</div></section>
    <section><div class="sec-head"><h2>Milestones</h2></div><div class="panel">${ms.length ? `<div class="entries">${ms.map(e => `<button class="entry" data-id="${esc(e.id)}"><span class="t">${esc(fmtDate(e._s))}</span><span class="ic" style="--k:var(--mile)">${ICON.milestone}</span><span class="txt"><b>${esc(e.detail?.label || 'Milestone')}</b>${e.note ? `<div class="s">${esc(e.note)}</div>` : ''}</span><span class="by">${Math.floor(ageMonths(fromKey(m.baby.birth_date), e._s))} mo</span></button>`).join('')}</div>` : '<p class="empty">Log first tooth, crawling, first word and so on from the Today screen.</p>'}</div></section>`;
}

// ---------------- charts ----------------
function draw(root, m, from, to, ev) {
  const q = id => root.querySelector('#' + id);
  const W = series(m, from, to, 'week');
  const xl = W.map(w => fmtDate(fromKey(w.key)));
  const tipX = i => `Week of ${fmtDate(fromKey(W[i].key))}`;
  if (q('c-acto')) actogram(q('c-acto'), dayRows(ev, [...Array(21).keys()].map(i => addDays(new Date(), -20 + i))), { nowH: new Date().getHours() + new Date().getMinutes() / 60, label: 'Last three weeks' });
  if (q('c-clock')) {
    const t = targets(m.baby, stats(m, ...lastWindow(14)));
    const vals = W.flatMap(w => [w.bedH, w.lastNapH]).filter(v => v != null);
    const lo = Math.floor(Math.min(...vals, t.lastNapBy)), hi = Math.ceil(Math.max(...vals, t.bedTo));
    const ticks = []; for (let h = lo; h <= hi; h += (hi - lo > 6 ? 2 : 1)) ticks.push(h);
    clockChart(q('c-clock'), { label: 'Bedtime and last nap end by week', x: xl, tipX, min: lo, max: hi, ticks, band: [t.bedFrom, t.bedTo], mr: 64, h: 220,
      series: [{ name: 'Bedtime', cls: 's-night', v: W.map(w => w.bedH), endLabel: 'Bed' }, { name: 'Last nap ends', cls: 's-nap', v: W.map(w => w.lastNapH), endLabel: 'Last nap' }] });
    const wv = W.map(w => w.wakeH).filter(v => v != null);
    if (wv.length) { const wl = Math.floor(Math.min(...wv)), wh = Math.ceil(Math.max(...wv)); const wt = []; for (let h = wl; h <= Math.max(wh, wl + 1); h++) wt.push(h);
      clockChart(q('c-wake'), { label: 'Wake-up by week', x: xl, tipX, min: wl, max: Math.max(wh, wl + 1), ticks: wt, mr: 48, h: 150, series: [{ name: 'Wake-up', cls: 's-ink', v: W.map(w => w.wakeH), endLabel: hToHHMM(wv[wv.length - 1]) }] }); }
  }
  if (q('c-hours')) lineChart(q('c-hours'), { label: 'Night and nap hours', x: xl, tipX, min: 0, max: 14, ticks: [0, 4, 8, 12], fmt: v => v + ' h', tipFmt: v => v.toFixed(1) + ' h', mr: 48,
    series: [{ name: 'Night', cls: 's-night', v: W.map(w => w.nightH), endLabel: 'Night' }, { name: 'Naps', cls: 's-nap', v: W.map(w => w.napH), endLabel: 'Naps' }] });
  if (q('c-through')) barChart(q('c-through'), { label: 'Nights slept through', x: xl, tipX, max: 100, ticks: [0, 50, 100], fmt: v => Math.round(v) + '%', series: [{ name: 'Slept through', cls: 'm-night', v: W.map(w => w.through) }], labels: W.length <= 8 ? 'all' : 'last' });
  if (q('c-nfeeds')) barChart(q('c-nfeeds'), { label: 'Night feeds', x: xl, tipX, max: Math.max(1, Math.ceil(Math.max(...W.map(w => w.nightFeeds || 0)))), ticks: [0, Math.max(1, Math.ceil(Math.max(...W.map(w => w.nightFeeds || 0))))], series: [{ name: 'Night feeds', cls: 'm-night', v: W.map(w => w.nightFeeds) }], tipFmt: v => v.toFixed(1) + ' per night' });
  if (q('c-naps')) lineChart(q('c-naps'), { label: 'Naps per day', x: xl, tipX, min: 0, max: 6, ticks: [0, 2, 4, 6], tipFmt: v => v.toFixed(1), series: [{ name: 'Naps', cls: 's-nap', v: W.map(w => w.naps), endLabel: fmt1(W[W.length - 1]?.naps) }] });
  if (q('c-ml')) {
    const birth = fromKey(m.baby.birth_date);
    const bands = W.map(w => milkBand(ageMonths(birth, addDays(fromKey(w.key), 3))));
    const mx = Math.max(800, ...W.map(w => w.ml || 0)); const top = Math.ceil(mx / 200) * 200;
    lineChart(q('c-ml'), { label: 'Milk per day', x: xl, tipX, min: 0, max: top, ticks: [...Array(top / 200 + 1).keys()].map(i => i * 200), band: bands, mr: 46, tipFmt: v => Math.round(v) + ' ml',
      series: [{ name: 'Milk', cls: 's-bottle', v: W.map(w => w.ml), endLabel: W[W.length - 1]?.ml ? String(Math.round(W[W.length - 1].ml)) : '' }] });
  }
  if (q('c-feeds')) { const mx = Math.max(4, ...W.map(w => (w.bottles || 0)), ...W.map(w => w.nursing || 0)); const top = Math.ceil(mx / 4) * 4;
    barChart(q('c-feeds'), { label: 'Feeds per day', x: xl, tipX, max: top, ticks: [0, top / 2, top], series: [{ name: 'Bottles', cls: 'm-bottle', v: W.map(w => w.bottles) }, ...(W.some(w => w.nursing) ? [{ name: 'Nursing', cls: 'm-nurse', v: W.map(w => w.nursing || null) }] : [])], tipFmt: v => v.toFixed(1) + ' per day' }); }
  if (q('c-solids')) { const S = W.filter(w => w.solids != null); if (S.length) barChart(q('c-solids'), { label: 'Solid meals per day', x: S.map(w => fmtDate(fromKey(w.key))), tipX: i => `Week of ${fmtDate(fromKey(S[i].key))}`, max: 4, ticks: [0, 1, 2, 3, 4], series: [{ name: 'Meals', cls: 'm-solid', v: S.map(w => w.solids) }], labels: 'last', tipFmt: v => v.toFixed(1) + ' per day' }); else q('c-solids').innerHTML = '<p class="empty">No meals in this period.</p>'; }
  if (q('c-tex')) { const T = textures(m, from, to); barChart(q('c-tex'), { label: 'Texture of meals', x: ['Smooth', 'Mashed', 'Lumpy', 'Finger'], max: Math.max(1, ...Object.values(T.c)), ticks: [0, Math.max(1, ...Object.values(T.c))], series: [{ name: 'Meals', cls: 'm-solid', v: [T.c.puree, T.c.mashed, T.c.lumpy, T.c.finger] }], labels: 'all' }); }
  const G = q('g-weight') ? growth(m) : null;
  if (G) {
    const sex = m.baby.sex; const ageNow = ageMonths(fromKey(m.baby.birth_date));
    const maxAge = Math.min(24, Math.max(6, Math.ceil((ageNow + 2) / 3) * 3));
    const cfg = { weight: ['kg', z => z, [2, 16, 2]], length: ['cm', z => z, [45, 95, 10]], head: ['cm', z => z, [32, 52, 4]] };
    for (const k of ['weight', 'length', 'head']) {
      const hiV = atZ(k, sex, maxAge, 2.5); const loV = atZ(k, sex, 0, -2.5);
      const step = cfg[k][2][2]; const yr = [Math.floor(loV / step) * step, Math.ceil(hiV / step) * step, step];
      growthChart(q('g-' + k), { label: `${k} against WHO percentiles`, unit: cfg[k][0], maxAge, yr, at: (a, z) => atZ(k, sex, a, z), points: G[k].map(p => ({ ...p, onClick: () => editEvent(p.e) })) });
    }
  }
  root.querySelectorAll('tr[data-id], .entry[data-id]').forEach(r => r.addEventListener('click', () => editEvent(state.events.get(r.dataset.id))));
}
