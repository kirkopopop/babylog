// SVG charts drawn to the container width. Tooltips on hover/tap.
import { hToHHMM, esc, ordinal } from './util.js';
const NS = 'http://www.w3.org/2000/svg';
let tip;
function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function txt(parent, x, y, s, attrs) { const t = el('text', Object.assign({ x, y }, attrs || {}), parent); t.textContent = s; return t; }
function ensureTip() { if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); document.addEventListener('scroll', hideTip, { passive: true, capture: true }); } return tip; }
function moveTip(ev) { const t = ensureTip(); const pad = 14; let x = ev.clientX + pad, y = ev.clientY + pad; const w = t.offsetWidth, h = t.offsetHeight; if (x + w > innerWidth - 8) x = ev.clientX - w - pad; if (y + h > innerHeight - 8) y = ev.clientY - h - pad; t.style.left = Math.max(8, x) + 'px'; t.style.top = Math.max(8, y) + 'px'; }
export function showTip(html, ev) { const t = ensureTip(); t.innerHTML = html; t.style.opacity = 1; moveTip(ev); }
export function hideTip() { if (tip) tip.style.opacity = 0; }
function bindTip(node, html, onClick) {
  node.addEventListener('pointerenter', e => showTip(html, e)); node.addEventListener('pointermove', moveTip);
  node.addEventListener('pointerleave', hideTip); node.addEventListener('pointerdown', e => showTip(html, e));
  if (onClick) { node.style.cursor = 'pointer'; node.addEventListener('click', onClick); }
}
const W = host => Math.max(260, host.clientWidth || host.parentElement?.clientWidth || 320);

// Rows of 24h timelines. rows: [{label, bold, sleep:[{s,e,k,tip,onClick}], dots:[{t,r,cls,tip,onClick,shape}]}]
export function actogram(host, rows, opts = {}) {
  const w = W(host); host.innerHTML = '';
  const narrow = w < 520; const lw = opts.labelW ?? (narrow ? 52 : 74); const rh = opts.rowH || (narrow ? 15 : 17); const gap = 4; const top = 18;
  const startH = opts.startH ?? 0; const span = 24;
  const pw = w - lw - 6; const Hh = top + rows.length * (rh + gap) + 2;
  const svg = el('svg', { width: w, height: Hh, role: 'img', 'aria-label': opts.label || 'Daily timeline' }, host);
  const X = h => lw + (h - startH) / span * pw; // h may exceed 24 for shifted views
  const step = narrow ? 6 : 3;
  for (let h = 0; h <= span; h += step) { const hh = (startH + h) % 24; el('line', { x1: X(startH + h), x2: X(startH + h), y1: top - 4, y2: Hh, class: 'grid' }, svg); txt(svg, X(startH + h), 11, String(hh).padStart(2, '0'), { 'text-anchor': h === 0 ? 'start' : h === span ? 'end' : 'middle' }); }
  if (opts.nowH != null) { el('line', { x1: X(opts.nowH), x2: X(opts.nowH), y1: top - 4, y2: Hh, style: 'stroke:var(--bad);stroke-width:1.5' }, svg); }
  rows.forEach((r, i) => {
    const y = top + i * (rh + gap);
    txt(svg, 0, y + rh - 4, r.label, { class: r.bold ? 'lbl-strong' : '' });
    el('rect', { x: X(startH), y, width: pw, height: rh, rx: 3, style: 'fill:var(--sunk)' }, svg);
    (r.sleep || []).forEach(s => {
      const a = Math.max(startH, s.s), b = Math.min(startH + span, s.e); if (b <= a) return;
      const rc = el('rect', { x: X(a), y: y + (s.k === 'n' ? 0 : 2), width: Math.max(1.5, X(b) - X(a)), height: s.k === 'n' ? rh : rh - 4, rx: 3, class: s.k === 'n' ? 'm-night' : 'm-nap' }, svg);
      if (s.running) rc.setAttribute('style', 'opacity:.75');
      if (s.tip) bindTip(rc, s.tip, s.onClick);
    });
    (r.dots || []).forEach(d => {
      if (d.t < startH || d.t > startH + span) return;
      const cx = X(d.t), cy = y + rh / 2; let node;
      if (d.shape === 'dia') { const z = d.r || 4.5; node = el('path', { d: `M${cx} ${cy - z}L${cx + z} ${cy}L${cx} ${cy + z}L${cx - z} ${cy}Z`, class: d.cls + ' ring' }, svg); }
      else node = el('circle', { cx, cy, r: d.r || 4, class: d.cls + ' ring' }, svg);
      if (d.tip) bindTip(node, d.tip, d.onClick);
    });
  });
}

// Line chart with optional reference band and crosshair. cfg: {x:[labels], series:[{name,cls,v,endLabel,area}], min,max,ticks,fmt,band,tipX,tipFmt,h}
export function lineChart(host, cfg) {
  const w = W(host); host.innerHTML = '';
  const Hh = cfg.h || 200, ml = cfg.ml ?? 38, mr = cfg.mr ?? 44, mt = 10, mb = 24;
  const pw = w - ml - mr, ph = Hh - mt - mb;
  const svg = el('svg', { width: w, height: Hh, role: 'img', 'aria-label': cfg.label || '' }, host);
  const n = cfg.x.length; const X = i => ml + (n === 1 ? pw / 2 : i / (n - 1) * pw);
  const Y = v => mt + ph - (v - cfg.min) / (cfg.max - cfg.min) * ph;
  const cl = v => Math.max(cfg.min, Math.min(cfg.max, v));
  if (cfg.band) {
    if (typeof cfg.band[0] === 'number') el('rect', { x: ml, y: Y(cl(cfg.band[1])), width: pw, height: Y(cl(cfg.band[0])) - Y(cl(cfg.band[1])), class: 'ref-band' }, svg);
    else { // per-point band [[lo,hi]|null]
      const pts = cfg.band.map((b, i) => b ? [i, b] : null).filter(Boolean);
      if (pts.length) el('path', { d: pts.map((p, j) => (j ? 'L' : 'M') + X(p[0]) + ' ' + Y(cl(p[1][1]))).join('') + pts.slice().reverse().map(p => 'L' + X(p[0]) + ' ' + Y(cl(p[1][0]))).join('') + 'Z', class: 'ref-band' }, svg);
    }
  }
  cfg.ticks.forEach(t => { el('line', { x1: ml, x2: ml + pw, y1: Y(t), y2: Y(t), class: t === cfg.min ? 'axis' : 'grid' }, svg); txt(svg, ml - 6, Y(t) + 4, cfg.fmt ? cfg.fmt(t) : t, { 'text-anchor': 'end' }); });
  const every = Math.max(1, Math.ceil(n / (w < 480 ? 5 : 9)));
  cfg.x.forEach((l, i) => { if (i % every === 0) txt(svg, X(i), Hh - 6, l, { 'text-anchor': i === 0 && n > 1 ? 'start' : 'middle' }); });
  cfg.series.forEach(s => {
    const segs = []; let cur = [];
    s.v.forEach((v, i) => { if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([X(i), Y(cl(v))]); });
    if (cur.length) segs.push(cur);
    const all = segs.flat(); if (!all.length) return;
    if (s.area) segs.forEach(p => { if (p.length > 1) el('path', { d: `M${p[0][0]} ${Y(cfg.min)}` + p.map(q => `L${q[0]} ${q[1]}`).join('') + `L${p[p.length - 1][0]} ${Y(cfg.min)}Z`, class: s.cls.replace('s-', 'm-'), opacity: .12 }, svg); });
    segs.forEach(p => { if (p.length > 1) el('path', { d: p.map((q, i) => (i ? 'L' : 'M') + q[0] + ' ' + q[1]).join(''), class: s.cls, fill: 'none', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...(s.dash ? { 'stroke-dasharray': '4 3' } : {}) }, svg); else el('circle', { cx: p[0][0], cy: p[0][1], r: 2.5, class: s.cls.replace('s-', 'm-') }, svg); });
    const last = all[all.length - 1]; el('circle', { cx: last[0], cy: last[1], r: 4, class: s.cls.replace('s-', 'm-') + ' ring' }, svg);
    if (s.endLabel) txt(svg, last[0] + 8, last[1] + 4, s.endLabel, { class: 'lbl-strong' });
  });
  const xh = el('line', { x1: 0, x2: 0, y1: mt, y2: mt + ph, class: 'xh', opacity: 0 }, svg);
  const hit = el('rect', { x: ml, y: mt, width: pw, height: ph, class: 'hit' }, svg);
  const pick = e => {
    const r = svg.getBoundingClientRect(); const px = e.clientX - r.left; const i = Math.max(0, Math.min(n - 1, Math.round((px - ml) / pw * (n - 1))));
    xh.setAttribute('x1', X(i)); xh.setAttribute('x2', X(i)); xh.setAttribute('opacity', 1);
    showTip(`<b>${esc(cfg.tipX ? cfg.tipX(i) : cfg.x[i])}</b>` + cfg.series.map(s => `<div>${esc(s.name)}: ${s.v[i] == null ? '–' : esc(cfg.tipFmt ? cfg.tipFmt(s.v[i], s) : s.v[i])}</div>`).join(''), e);
  };
  hit.addEventListener('pointermove', pick); hit.addEventListener('pointerdown', pick);
  hit.addEventListener('pointerleave', () => { xh.setAttribute('opacity', 0); hideTip(); });
}

// Time-of-day chart (y axis = clock time, top = earlier). Works like lineChart with hour values.
export function clockChart(host, cfg) {
  lineChart(host, { ...cfg, fmt: h => hToHHMM(h), tipFmt: v => hToHHMM(v), min: cfg.min, max: cfg.max });
}

// Grouped bars. cfg: {x, series:[{name,cls,v}], max, ticks, fmt, labels, tipX, tipFmt, h}
export function barChart(host, cfg) {
  const w = W(host); host.innerHTML = '';
  const Hh = cfg.h || 190, ml = 34, mr = 6, mt = 16, mb = 24; const pw = w - ml - mr, ph = Hh - mt - mb;
  const svg = el('svg', { width: w, height: Hh, role: 'img', 'aria-label': cfg.label || '' }, host);
  const n = cfg.x.length, S = cfg.series.length; const band = pw / n; const bw = Math.min(26, (band * 0.72 - (S - 1) * 2) / S);
  const Y = v => mt + ph - Math.min(v, cfg.max) / cfg.max * ph;
  cfg.ticks.forEach(t => { el('line', { x1: ml, x2: ml + pw, y1: Y(t), y2: Y(t), class: t === 0 ? 'axis' : 'grid' }, svg); txt(svg, ml - 6, Y(t) + 4, cfg.fmt ? cfg.fmt(t) : t, { 'text-anchor': 'end' }); });
  const every = Math.max(1, Math.ceil(n / (w < 480 ? 6 : 12)));
  cfg.x.forEach((l, i) => {
    const cx = ml + band * i + band / 2; if (i % every === 0) txt(svg, cx, Hh - 6, l, { 'text-anchor': 'middle' });
    const gw = S * bw + (S - 1) * 2; let x0 = cx - gw / 2;
    cfg.series.forEach(s => {
      const v = s.v[i]; if (v == null) { x0 += bw + 2; return; }
      const y = Y(v), hgt = Math.max(0, Y(0) - y), r = Math.min(4, bw / 2, hgt);
      el('path', { d: `M${x0} ${Y(0)}V${y + r}Q${x0} ${y} ${x0 + r} ${y}H${x0 + bw - r}Q${x0 + bw} ${y} ${x0 + bw} ${y + r}V${Y(0)}Z`, class: s.cls }, svg);
      if (cfg.labels && (cfg.labels === 'all' || i === n - 1)) txt(svg, x0 + bw / 2, y - 5, cfg.fmt ? cfg.fmt(v) : (Math.round(v * 10) / 10), { 'text-anchor': 'middle', class: 'lbl-strong' });
      const hr = el('rect', { x: x0 - 2, y: mt, width: bw + 4, height: ph, class: 'hit' }, svg);
      bindTip(hr, `<b>${esc(cfg.tipX ? cfg.tipX(i) : l)}</b><div>${esc(s.name)}: ${esc(cfg.tipFmt ? cfg.tipFmt(v) : Math.round(v * 10) / 10)}</div>`);
      x0 += bw + 2;
    });
  });
}

// WHO growth chart. bands: fn(ageM, z) -> value; points [{age, v, p, home, d}]
export function growthChart(host, cfg) {
  const w = W(host); host.innerHTML = '';
  const Hh = 210, ml = 34, mr = 10, mt = 8, mb = 24, pw = w - ml - mr, ph = Hh - mt - mb;
  const svg = el('svg', { width: w, height: Hh, role: 'img', 'aria-label': cfg.label }, host);
  const [y0, y1, ys] = cfg.yr; const maxA = cfg.maxAge;
  const X = a => ml + a / maxA * pw, Y = v => mt + ph - (v - y0) / (y1 - y0) * ph;
  const ages = []; for (let a = 0; a <= maxA + 1e-9; a += 0.25) ages.push(a);
  const band = (zl, zh, cls) => el('path', { d: ages.map((a, i) => (i ? 'L' : 'M') + X(a) + ' ' + Y(cfg.at(a, zh))).join('') + ages.slice().reverse().map(a => 'L' + X(a) + ' ' + Y(cfg.at(a, zl))).join('') + 'Z', class: cls }, svg);
  for (let t = y0; t <= y1; t += ys) el('line', { x1: ml, x2: ml + pw, y1: Y(t), y2: Y(t), class: t === y0 ? 'axis' : 'grid' }, svg);
  band(-1.881, 1.881, 'band-out'); band(-1.036, 1.036, 'band-in');
  el('path', { d: ages.map((a, i) => (i ? 'L' : 'M') + X(a) + ' ' + Y(cfg.at(a, 0))).join(''), class: 'median' }, svg);
  for (let t = y0; t <= y1; t += ys) txt(svg, ml - 6, Y(t) + 4, t, { 'text-anchor': 'end' });
  const step = maxA <= 9 ? 2 : maxA <= 12 ? 3 : 6;
  for (let a = 0; a <= maxA; a += step) txt(svg, X(a), Hh - 6, a === 0 ? 'birth' : a + ' mo', { 'text-anchor': a === 0 ? 'start' : a === maxA ? 'end' : 'middle' });
  const pts = cfg.points;
  if (pts.length > 1) el('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + X(p.age) + ' ' + Y(p.v)).join(''), class: 's-night', fill: 'none', 'stroke-width': 1.5, opacity: .5 }, svg);
  pts.forEach(p => {
    const c = el('circle', { cx: X(p.age), cy: Y(p.v), r: 4.5, class: p.home ? '' : 'm-night ring' }, svg);
    if (p.home) c.setAttribute('style', 'fill:var(--surface);stroke:var(--night);stroke-width:2');
    const hr = el('circle', { cx: X(p.age), cy: Y(p.v), r: 12, class: 'hit' }, svg);
    bindTip(hr, `<b>${p.v} ${esc(cfg.unit)}</b> · ${esc(p.d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))}<div class="t-sub">about ${p.p < 1 ? 'below 1st' : p.p > 99 ? 'above 99th' : ordinal(p.p)} percentile${p.home ? ' · home measurement' : ''}</div>`, p.onClick);
  });
}
