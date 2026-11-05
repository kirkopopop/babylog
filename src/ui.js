// Sheets (bottom drawers), toasts and small shared renderers.
import { esc, hhmm, dur, fmtDateDow, dayKey, addDays } from './util.js';
import { ICON, KCOLOR } from './icons.js';
import { state } from './store.js';

let openSheetEl = null;
export function openSheet({ title, kind, body, onMount }) {
  closeSheet(true);
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  const sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-label', title);
  sh.innerHTML = `<div class="grab"></div><header><h2>${kind ? `<span class="ic" style="--k:${KCOLOR[kind] || 'var(--ink-3)'}">${ICON[kind] || ''}</span>` : ''}${esc(title)}</h2><button class="btn ghost" data-close aria-label="Close">${ICON.close}</button></header><div class="sheet-body">${body}</div>`;
  document.body.append(scrim, sh);
  requestAnimationFrame(() => { scrim.classList.add('open'); sh.classList.add('open'); });
  const close = () => closeSheet();
  scrim.addEventListener('click', close); sh.querySelector('[data-close]').addEventListener('click', close);
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  openSheetEl = { scrim, sh, onKey };
  onMount?.(sh.querySelector('.sheet-body'), close);
  return close;
}
export function closeSheet(instant) {
  if (!openSheetEl) return; const { scrim, sh, onKey } = openSheetEl; openSheetEl = null;
  document.removeEventListener('keydown', onKey);
  if (instant) { scrim.remove(); sh.remove(); return; }
  scrim.classList.remove('open'); sh.classList.remove('open');
  setTimeout(() => { scrim.remove(); sh.remove(); }, 230);
}
export const sheetOpen = () => !!openSheetEl;

let toastEl, toastTimer;
export function toast(msg, action) {
  toastEl?.remove(); clearTimeout(toastTimer);
  toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status');
  toastEl.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) toastEl.querySelector('button').addEventListener('click', () => { action.run(); toastEl.remove(); });
  document.body.appendChild(toastEl);
  toastTimer = setTimeout(() => toastEl?.remove(), action ? 6000 : 2600);
}

export function member(id) { return state.members[id] || null; }
export function byline(e) {
  if (e.source === 'mybaby') return `<span class="by" title="Imported from MyBaby">MyBaby</span>`;
  const m = member(e.created_by); if (!m) return '';
  return `<span class="by"><i class="dot" style="background:${esc(m.color)}"></i>${esc(m.name)}</span>`;
}

const SUB = { formula: 'Formula', breast_milk: 'Breast milk', wet: 'Wet', dirty: 'Dirty', mixed: 'Wet + dirty', dry: 'Dry', left: 'Left', right: 'Right', both: 'Both sides', weight: 'Weight', length: 'Length', head: 'Head' };
export function describe(e) {
  const t = e.kind;
  if (t === 'sleep') {
    const name = e.subtype === 'night' ? 'Night sleep' : 'Nap';
    return { kind: e.subtype === 'night' ? 'sleep' : 'sleep', title: name, sub: e._e ? `${hhmm(e._s)}–${hhmm(e._e)} · ${dur(e._e - e._s)}` : `since ${hhmm(e._s)} · sleeping now` };
  }
  if (t === 'bottle') return { kind: 'bottle', title: `Bottle${e.amount != null ? ` ${Math.round(e.amount)} ml` : ''}`, sub: [SUB[e.subtype] || '', e.note].filter(Boolean).join(' · ') };
  if (t === 'nursing') return { kind: 'nursing', title: 'Nursing', sub: [SUB[e.subtype], e._e ? dur(e._e - e._s) : ''].filter(Boolean).join(' · ') };
  if (t === 'pump') return { kind: 'pump', title: `Pumping${e.amount != null ? ` ${e.amount} ml` : ''}`, sub: [SUB[e.subtype] || e.subtype, e.note].filter(Boolean).join(' · ') };
  if (t === 'solids') {
    const d = e.detail || {}; const bits = [d.meal && cap(d.meal), d.texture && ({ puree: 'smooth', mashed: 'mashed', lumpy: 'lumpy', finger: 'finger food' })[d.texture], d.portion && ({ taste: 'a taste', some: 'some', most: 'most', all: 'all of it' })[d.portion], d.reaction && d.reaction !== 'none' && `reaction: ${d.reaction}`, e.note].filter(Boolean);
    return { kind: 'solids', title: e.foods.length ? e.foods.join(', ') : (d.text || 'Meal'), sub: bits.join(' · ') };
  }
  if (t === 'nappy') return { kind: 'nappy', title: `Nappy · ${SUB[e.subtype] || 'Wet'}`, sub: e.note || '' };
  if (t === 'med') return e.subtype === 'vitamin_d' ? { kind: 'vitd', title: 'Vitamin D', sub: [e.amount != null ? `${e.amount} ${e.unit || 'µg'}` : '', e.note].filter(Boolean).join(' · ') } : { kind: 'med', title: cap(e.detail?.name || e.subtype || 'Medicine'), sub: [e.amount != null ? `${e.amount} ${e.unit || ''}` : '', e.note].filter(Boolean).join(' · ') };
  if (t === 'growth') return { kind: 'growth', title: `${SUB[e.subtype] || 'Measurement'} ${e.amount} ${e.unit || ''}`, sub: [e.detail?.where === 'home' ? 'Home' : e.detail?.where === 'visitor' ? 'Health visitor' : e.detail?.where === 'doctor' ? 'Doctor' : '', e.note].filter(Boolean).join(' · ') };
  if (t === 'milestone') return { kind: 'milestone', title: e.detail?.label || e.note || 'Milestone', sub: e.detail?.label ? (e.note || '') : '' };
  if (t === 'bath') return { kind: 'bath', title: 'Bath', sub: e._e ? dur(e._e - e._s) : '' };
  if (t === 'walk') return { kind: 'walk', title: 'Walk', sub: e._e ? `${hhmm(e._s)}–${hhmm(e._e)} · ${dur(e._e - e._s)}` : '' };
  return { kind: 'note', title: 'Note', sub: e.note || '' };
}
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

export function entryRow(e) {
  const d = describe(e);
  const kc = e.kind === 'sleep' && e.subtype !== 'night' ? 'var(--nap)' : KCOLOR[d.kind];
  return `<button class="entry" data-id="${esc(e.id)}"><span class="t">${hhmm(e._s)}</span><span class="ic" style="--k:${kc}">${ICON[d.kind] || ICON.note}</span><span class="txt"><b>${esc(d.title)}</b>${d.sub ? `<div class="s">${esc(d.sub)}</div>` : ''}</span>${byline(e)}</button>`;
}

export function dayLabel(k) {
  const today = dayKey(new Date()), yest = dayKey(addDays(new Date(), -1));
  if (k === today) return 'Today'; if (k === yest) return 'Yesterday';
  const [y, m, d] = k.split('-').map(Number); return fmtDateDow(new Date(y, m - 1, d));
}
