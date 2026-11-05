// Today: live status, quick log, today's totals, timeline and entries.
import { esc, hhmm, dur, dayKey, addDays, hourOf } from '../util.js';
import { events, state } from '../store.js';
import { model, current, predictNext } from '../analytics.js';
import { ICON, KCOLOR } from '../icons.js';
import { entryRow, describe } from '../ui.js';
import { openFor, editEvent, startSleep, stopSleep, sleepSheet } from '../sheets.js';
import { actogram } from '../charts.js';

const ago = d => d ? dur(Date.now() - d) + ' ago' : '–';
const TILES = [['sleep', 'Sleep'], ['bottle', 'Bottle'], ['solids', 'Meal'], ['nappy', 'Nappy'], ['vitd', 'Vitamin D'], ['med', 'Medicine'], ['growth', 'Growth'], ['milestone', 'Milestone']];

export function render(root) {
  const ev = events(); const m = model(ev, state.version, state.baby); const now = new Date();
  const cur = current(m, ev, now); const nx = predictNext(m, cur, now);
  const tk = dayKey(now);
  // hero
  let hero;
  if (cur.running) {
    const r = cur.running;
    hero = `<div class="panel hero asleep"><div class="state"><div><div class="eyebrow">${r.subtype === 'night' ? 'Night sleep' : 'Napping'}</div><div class="big">${dur(now - r._s)}<small>since ${hhmm(r._s)}</small></div></div>
      <button class="btn big sleep" data-act="stop">${ICON.stop}Woke up</button></div>
      <p class="hint">Tap “Woke up” when he wakes. Edit the start time from the entry below if it was earlier.</p></div>`;
  } else {
    const since = cur.lastSleep?._e;
    let hint = 'Start a sleep when he goes down.';
    if (nx) {
      const late = now > nx.at;
      hint = nx.what === 'Bedtime'
        ? `Bedtime is usually about ${dur(nx.windowH * 3600e3)} after the last nap, around <b class="num">${hhmm(nx.at)}</b>${late ? ' (past that now)' : ''}.`
        : `${nx.what} usually comes after about ${dur(nx.windowH * 3600e3)} awake, around <b class="num">${hhmm(nx.at)}</b>${late ? ' (past that now)' : ''}.`;
    }
    hero = `<div class="panel hero"><div class="state"><div><div class="eyebrow">Awake</div><div class="big">${since ? dur(now - since) : '–'}<small>${since ? `since ${hhmm(since)}` : ''}</small></div></div>
      <button class="btn big sleep" data-act="start">${ICON.sleep}Start sleep</button></div>
      <p class="hint">${hint}</p></div>`;
  }
  const lb = cur.lastBottle, ls = cur.lastSolid, ln = cur.lastNappy;
  const since = `<div class="since">
    <div><span class="l">Last bottle</span><span class="v">${lb ? hhmm(lb._s) : '–'}</span><span class="x">${lb ? `${ago(lb._s)}${lb.amount ? ` · ${Math.round(lb.amount)} ml` : ''}` : 'none yet'}</span></div>
    <div><span class="l">Last meal</span><span class="v">${ls ? hhmm(ls._s) : '–'}</span><span class="x">${ls ? esc(`${ago(ls._s)} · ${ls.foods.slice(0, 2).join(', ')}`) : 'none yet'}</span></div>
    <div><span class="l">Last nappy</span><span class="v">${ln ? hhmm(ln._s) : '–'}</span><span class="x">${ln ? `${ago(ln._s)} · ${esc(describe(ln).title.replace('Nappy · ', ''))}` : 'none logged'}</span></div>
    <div><span class="l">Vitamin D</span><span class="v">${cur.vitdToday ? 'Given' : 'Not yet'}</span><span class="x">${cur.vitdToday ? `today at ${hhmm(cur.lastVitD._s)}` : cur.lastVitD ? `last ${dayKey(cur.lastVitD._s) === dayKey(addDays(now, -1)) ? 'yesterday' : cur.lastVitD._s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'not logged yet'}</span></div>
  </div>`;
  const quick = `<div class="quick">${TILES.map(([k, l]) => `<button class="qbtn" data-log="${k}" style="--k:${KCOLOR[k]}"><span class="ic">${ICON[k]}</span>${l}${k === 'vitd' && cur.vitdToday ? '<span class="badge">✓ today</span>' : ''}</button>`).join('')}</div>`;
  // totals: last night (ending today) + today
  const ln0 = m.nights.get(dayKey(addDays(now, -1))); const lastNight = ln0?.segs.length ? ln0 : null;
  const td = m.days.get(tk);
  const runNap = cur.running && cur.running.subtype !== 'night' ? (now - cur.running._s) / 3600e3 : 0;
  const totals = `<div class="totals">
    <div><span class="l">Last night</span><span class="v">${lastNight ? `${lastNight.tot.toFixed(1)} h` : '–'}</span><span class="small muted">${lastNight ? `${hhmm(lastNight.bed)}–${hhmm(lastNight.wake)}${lastNight.wakes ? ` · woke ${lastNight.wakes}×` : ' · straight through'}` : ''}</span></div>
    <div><span class="l">Naps today</span><span class="v">${td || runNap ? `${((td?.napH || 0) + runNap).toFixed(1)} h` : '–'}</span><span class="small muted">${(td?.naps.length || 0) + (runNap ? 1 : 0)} nap${((td?.naps.length || 0) + (runNap ? 1 : 0)) === 1 ? '' : 's'}</span></div>
    <div><span class="l">Milk today</span><span class="v">${td?.ml ? `${Math.round(td.ml)} ml` : '–'}</span><span class="small muted">${td?.bottles || 0} bottle${td?.bottles === 1 ? '' : 's'}</span></div>
    <div><span class="l">Meals today</span><span class="v">${td?.solids.length || 0}</span><span class="small muted">${td?.nappyN ? `${td.nappyN} nappies` : ''}</span></div>
  </div>`;
  // entries for today (incl. the night that ended today)
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const list = ev.filter(e => e._s >= t0 || (e.kind === 'sleep' && (!e._e || e._e >= t0) && e._s >= addDays(t0, -1))).slice().reverse();
  root.innerHTML = `
    ${hero}
    <section style="margin-top:12px">${since}</section>
    <section><div class="sec-head"><h2>Log</h2></div>${quick}</section>
    <section><div class="sec-head"><h2>Today so far</h2><p>${now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>${totals}
      <div class="panel"><div class="chart" id="t-acto"></div>
      <div class="legend"><span><i class="sw" style="background:var(--night)"></i>Night</span><span><i class="sw" style="background:var(--nap)"></i>Nap</span><span><i class="sw dot" style="background:var(--bottle)"></i>Bottle</span><span><i class="sw dia" style="background:var(--solid)"></i>Meal</span><span><i class="sw dot" style="background:var(--nappy)"></i>Nappy</span></div></div>
    </section>
    <section><div class="sec-head"><h2>Entries</h2><p>Tap one to edit</p></div>
      <div class="panel" style="padding:4px 12px">${list.length ? `<div class="entries">${list.map(entryRow).join('')}</div>` : `<p class="empty">Nothing logged yet today. Use the buttons above.</p>`}</div></section>`;
  root.querySelector('[data-act="start"]')?.addEventListener('click', startSleep);
  root.querySelector('[data-act="stop"]')?.addEventListener('click', () => stopSleep(cur.running));
  root.querySelectorAll('[data-log]').forEach(b => b.addEventListener('click', () => b.dataset.log === 'sleep' ? openSleepChoice(cur) : openFor(b.dataset.log)));
  root.querySelectorAll('.entry').forEach(b => b.addEventListener('click', () => editEvent(state.events.get(b.dataset.id))));
  actogram(root.querySelector('#t-acto'), dayRows(ev, [addDays(now, -1), now], now), { nowH: hourOf(now), label: 'Yesterday and today' });
}

// The Sleep tile opens the manual form (or the running sleep); the hero button handles start/stop.
function openSleepChoice(cur) { cur.running ? editEvent(cur.running) : sleepSheet(null); }

// Build actogram rows for given days (Date objects), with tooltips and edit on click.
export function dayRows(ev, days, now = new Date()) {
  return days.map(d => {
    const k = dayKey(d); const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const b = addDays(a, 1);
    const sleep = [], dots = [];
    for (const e of ev) {
      if (e._s >= b) continue;
      if (e.kind === 'sleep') {
        const end = e._e || (dayKey(now) === k || e._s < now ? now : null); if (!end || end <= a) continue;
        const s = Math.max(0, (e._s - a) / 3600e3), en = Math.min(24, (end - a) / 3600e3);
        sleep.push({ s, e: en, k: e.subtype === 'night' ? 'n' : 'd', running: !e._e, tip: `<b>${e.subtype === 'night' ? 'Night sleep' : 'Nap'}</b> ${hhmm(e._s)}–${e._e ? hhmm(e._e) : 'now'}<div class="t-sub">${dur(end - e._s)}</div>`, onClick: () => editEvent(e) });
      } else if (e._s >= a) {
        const t = (e._s - a) / 3600e3;
        if (e.kind === 'bottle') dots.push({ t, r: e.amount ? Math.max(2.8, Math.min(6.5, Math.sqrt(e.amount) / 2.1)) : 3.5, cls: 'm-bottle', tip: `<b>Bottle</b> ${hhmm(e._s)}<div class="t-sub">${e.amount ? Math.round(e.amount) + ' ml' : ''}</div>`, onClick: () => editEvent(e) });
        else if (e.kind === 'nursing') dots.push({ t, r: 3.5, cls: 'm-nurse', tip: `<b>Nursing</b> ${hhmm(e._s)}`, onClick: () => editEvent(e) });
        else if (e.kind === 'solids') dots.push({ t, shape: 'dia', cls: 'm-solid', tip: `<b>Meal</b> ${hhmm(e._s)}<div class="t-sub">${esc(e.foods.join(', '))}</div>`, onClick: () => editEvent(e) });
        else if (e.kind === 'nappy') dots.push({ t, r: 2.6, cls: 'm-nappy', tip: `<b>Nappy</b> ${hhmm(e._s)}<div class="t-sub">${esc(e.subtype || '')}</div>`, onClick: () => editEvent(e) });
      }
    }
    const today = dayKey(now) === k, yest = dayKey(addDays(now, -1)) === k;
    return { label: today ? 'Today' : yest ? 'Yesterday' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), bold: today, sleep, dots };
  });
}
