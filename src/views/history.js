// History: day-by-day entries with filters, a two-week timeline and a jump-to-date.
import { esc, dayKey, keyAdd, fromKey, addDays, hhmm } from '../util.js';
import { events, state } from '../store.js';
import { model } from '../analytics.js';
import { entryRow, dayLabel } from '../ui.js';
import { editEvent } from '../sheets.js';
import { actogram } from '../charts.js';
import { dayRows } from './today.js';

const FILTERS = [['all', 'All'], ['sleep', 'Sleep'], ['feed', 'Milk'], ['solids', 'Meals'], ['nappy', 'Nappies'], ['med', 'Meds'], ['growth', 'Growth'], ['milestone', 'Milestones'], ['other', 'Other']];
const match = (f, e) => f === 'all' || (f === 'feed' ? (e.kind === 'bottle' || e.kind === 'nursing' || e.kind === 'pump') : f === 'other' ? ['bath', 'walk', 'note'].includes(e.kind) : e.kind === f);
const ui = { filter: 'all', days: 7, end: null };

export function render(root) {
  const ev = events(); const m = model(ev, state.version, state.baby);
  const endKey = ui.end || dayKey(new Date());
  const keys = [...Array(ui.days).keys()].map(i => keyAdd(endKey, -i));
  const byDay = new Map(keys.map(k => [k, []]));
  for (const e of ev) { const k = dayKey(e._s); if (byDay.has(k) && match(ui.filter, e)) byDay.get(k).push(e); }
  const first = ev[0] ? dayKey(ev[0]._s) : endKey;
  const blocks = keys.map(k => {
    const list = byDay.get(k).slice().reverse(); const d = m.days.get(k); const n0 = m.nights.get(k); const n = n0?.segs.length ? n0 : null;
    const bits = [];
    if (d?.sleepLogged || n) bits.push(`${((d?.napH || 0)).toFixed(1)} h naps`);
    if (n) bits.push(`night from ${hhmm(n.bed)}`);
    if (d?.ml) bits.push(`${Math.round(d.ml)} ml`);
    if (d?.solids.length) bits.push(`${d.solids.length} meal${d.solids.length > 1 ? 's' : ''}`);
    return `<div class="daylabel"><span>${esc(dayLabel(k))}</span><span class="faint">${esc(bits.join(' · '))}</span></div>
      <div class="panel" style="padding:2px 12px">${list.length ? `<div class="entries">${list.map(entryRow).join('')}</div>` : `<p class="empty">Nothing logged${ui.filter !== 'all' ? ' for this filter' : ''}.</p>`}</div>`;
  }).join('');
  root.innerHTML = `
    <section style="margin-top:4px"><div class="sec-head"><h1>History</h1><div class="row"><label class="small muted" for="h-date">Jump to</label><input type="date" id="h-date" value="${endKey}" max="${dayKey(new Date())}" min="${first}" style="width:auto"></div></div>
      <div class="chips" role="group" aria-label="Filter">${FILTERS.map(([k, l]) => `<button class="chip-btn" data-f="${k}" aria-pressed="${ui.filter === k}">${l}</button>`).join('')}</div>
    </section>
    <section><div class="panel"><h3>Two weeks, hour by hour</h3><div class="sub">Ending ${esc(dayLabel(endKey).toLowerCase() === 'today' ? 'today' : dayLabel(endKey))}. Tap a block to edit it.</div><div class="chart" id="h-acto"></div>
      <div class="legend"><span><i class="sw" style="background:var(--night)"></i>Night</span><span><i class="sw" style="background:var(--nap)"></i>Nap</span><span><i class="sw dot" style="background:var(--bottle)"></i>Bottle</span><span><i class="sw dia" style="background:var(--solid)"></i>Meal</span></div></div></section>
    <section style="gap:0">${blocks}
      <div class="row" style="justify-content:center;margin-top:16px">${keys[keys.length - 1] > first ? `<button class="btn" data-more>Show 7 earlier days</button>` : `<p class="faint small">Start of the log</p>`}${ui.end ? `<button class="btn ghost" data-today>Back to today</button>` : ''}</div>
    </section>`;
  root.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { ui.filter = b.dataset.f; render(root); }));
  root.querySelectorAll('.entry').forEach(b => b.addEventListener('click', () => editEvent(state.events.get(b.dataset.id))));
  root.querySelector('[data-more]')?.addEventListener('click', () => { ui.days += 7; render(root); });
  root.querySelector('[data-today]')?.addEventListener('click', () => { ui.end = null; ui.days = 7; render(root); });
  root.querySelector('#h-date').addEventListener('change', e => { if (e.target.value) { ui.end = e.target.value === dayKey(new Date()) ? null : e.target.value; ui.days = 7; render(root); } });
  const days = [...Array(14).keys()].map(i => addDays(fromKey(endKey), -13 + i));
  actogram(root.querySelector('#h-acto'), dayRows(ev, days), { label: 'Sleep and feeds, two weeks' });
}
