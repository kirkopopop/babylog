// Log and edit forms, one per kind, shown in a bottom sheet.
import { esc, toLocalInput, fromLocalInput, hhmm, dayKey, fromKey } from './util.js';
import { addEvent, updateEvent, deleteEvent, restoreEvent, events, state } from './store.js';
import { openSheet, toast, describe } from './ui.js';
import { TEXTURES, PORTIONS, REACTIONS, MILESTONES } from './foods.js';
import { ICON } from './icons.js';
import { zscore, pct } from './analytics.js';
import { ageMonths, ordinal } from './util.js';

const iso = d => d.toISOString();
const seg = (name, opts, val) => `<div class="seg" role="group" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${String(v) === String(val)}">${esc(l)}</button>`).join('')}</div>`;
const segVal = (root, name) => root.querySelector(`[data-seg="${name}"] [aria-pressed="true"]`)?.dataset.v ?? null;
function bindSegs(root, onChange) {
  root.querySelectorAll('[data-seg]').forEach(g => g.addEventListener('click', ev => {
    const b = ev.target.closest('button[data-v]'); if (!b) return;
    const already = b.getAttribute('aria-pressed') === 'true';
    g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', 'false'));
    if (!(already && g.dataset.toggle === '1')) b.setAttribute('aria-pressed', 'true');
    onChange?.(g.dataset.seg, segVal(root, g.dataset.seg));
  }));
}
const timeField = (label, d, id = 'f-time') => `<div class="field"><label for="${id}">${esc(label)}</label><input type="datetime-local" id="${id}" value="${toLocalInput(d)}"><div class="chips" data-shift="${id}">${[['0', 'Now'], ['-5', '−5m'], ['-15', '−15m'], ['-30', '−30m'], ['-60', '−1h']].map(([v, l]) => `<button type="button" class="chip-btn" data-m="${v}">${l}</button>`).join('')}</div></div>`;
function bindTime(root) {
  root.querySelectorAll('[data-shift]').forEach(g => g.addEventListener('click', ev => {
    const b = ev.target.closest('[data-m]'); if (!b) return;
    const inp = root.querySelector('#' + g.dataset.shift); inp.value = toLocalInput(new Date(Date.now() + Number(b.dataset.m) * 60000));
  }));
}
const val = (root, id) => root.querySelector('#' + id)?.value?.trim() ?? '';
const num = (root, id) => { const v = val(root, id).replace(',', '.'); return v === '' ? null : Number(v); };
const timeOf = (root, id = 'f-time') => fromLocalInput(val(root, id));
const err = (root, msg) => { const e = root.querySelector('.err'); if (e) { e.textContent = msg; e.hidden = !msg; } };
const actions = (existing, saveLabel = 'Save') => `<p class="err" hidden></p><div class="actions">${existing ? `<button type="button" class="btn danger" data-del>Delete</button>` : ''}<span class="spacer"></span><button type="button" class="btn ghost" data-cancel>Cancel</button><button type="button" class="btn primary big" data-save>${saveLabel}</button></div>`;
const noteField = v => `<div class="field"><label for="f-note">Note</label><input type="text" id="f-note" maxlength="300" value="${esc(v || '')}" placeholder="Optional"></div>`;

function bindCommon(root, close, existing, save) {
  bindSegs(root); bindTime(root);
  root.querySelector('[data-cancel]')?.addEventListener('click', close);
  root.querySelector('[data-save]')?.addEventListener('click', () => { const msg = save(); if (msg) err(root, msg); else close(); });
  const del = root.querySelector('[data-del]');
  if (del && existing) {
    let armed = false;
    del.addEventListener('click', () => {
      if (!armed) { armed = true; del.textContent = 'Tap again to delete'; setTimeout(() => { armed = false; del.textContent = 'Delete'; }, 3000); return; }
      const old = deleteEvent(existing.id); close();
      if (old) { const { _s, _e, ...row } = old; toast(`Deleted ${describe(old).title.toLowerCase()}`, { label: 'Undo', run: () => restoreEvent(row) }); }
    });
  }
}
const autoNight = d => { const h = d.getHours() + d.getMinutes() / 60; return h >= 18.5 || h < 5.5 ? 'night' : 'nap'; };
const saved = (e, verb = 'Logged') => toast(`${verb} ${describe(e).title.toLowerCase()} at ${hhmm(e._s)}`);

// ---------- sleep ----------
export function sleepSheet(existing) {
  const s = existing ? existing._s : new Date(); const e = existing?._e || null;
  openSheet({
    title: existing ? 'Edit sleep' : 'Add sleep', kind: 'sleep',
    body: `<div class="field"><span class="lbl">Type</span>${seg('type', [['night', 'Night sleep'], ['nap', 'Nap']], existing?.subtype || autoNight(s))}</div>
      ${timeField('Fell asleep', s, 'f-start')}
      <div class="field"><label for="f-end">Woke up</label><input type="datetime-local" id="f-end" value="${e ? toLocalInput(e) : ''}"><label class="row small muted"><input type="checkbox" id="f-running" ${existing && !e ? 'checked' : ''}> Still asleep</label></div>
      ${noteField(existing?.note)}${actions(existing)}`,
    onMount(root, close) {
      const run = root.querySelector('#f-running'), end = root.querySelector('#f-end');
      const sync = () => { end.disabled = run.checked; }; run.addEventListener('change', sync); sync();
      root.querySelector('#f-start').addEventListener('change', () => { if (!existing) { const d = timeOf(root, 'f-start'); if (d) root.querySelectorAll('[data-seg="type"] button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === autoNight(d)))); } });
      bindCommon(root, close, existing, () => {
        const st = timeOf(root, 'f-start'); const en = run.checked ? null : timeOf(root, 'f-end');
        if (!st) return 'Add the time he fell asleep.';
        if (!run.checked && !en) return 'Add a wake-up time or tick “Still asleep”.';
        if (en && en <= st) return 'Wake-up has to be after falling asleep.';
        if (en && en - st > 16 * 3600e3) return 'That is longer than 16 hours. Check the dates.';
        const running = events().find(x => x.kind === 'sleep' && !x._e && x.id !== existing?.id);
        if (!en && running) return 'Another sleep is already running. Stop it first.';
        const f = { kind: 'sleep', subtype: segVal(root, 'type'), started_at: iso(st), ended_at: en ? iso(en) : null, note: val(root, 'f-note') || null };
        const r = existing ? updateEvent(existing.id, f) : addEvent(f); saved(r, existing ? 'Updated' : 'Logged');
      });
    },
  });
}
export function startSleep() {
  if (events().some(x => x.kind === 'sleep' && !x._e)) { toast('A sleep is already running'); return; }
  const d = new Date(); const e = addEvent({ kind: 'sleep', subtype: autoNight(d), started_at: iso(d) });
  toast(`${e.subtype === 'night' ? 'Night sleep' : 'Nap'} started at ${hhmm(d)}`, { label: 'Undo', run: () => deleteEvent(e.id) });
}
export function stopSleep(e) {
  const d = new Date(); const prev = e.ended_at;
  updateEvent(e.id, { ended_at: iso(d < e._s ? e._s : d) });
  toast(`Woke up at ${hhmm(d)}`, { label: 'Undo', run: () => updateEvent(e.id, { ended_at: prev }) });
}

// ---------- bottle ----------
export function bottleSheet(existing) {
  const last = [...events()].reverse().find(x => x.kind === 'bottle' && x.amount);
  const amt = existing?.amount ?? last?.amount ?? 150;
  openSheet({
    title: existing ? 'Edit bottle' : 'Bottle', kind: 'bottle',
    body: `${timeField('Time', existing?._s || new Date())}
      <div class="field"><label for="f-amt">Amount (ml)</label><div class="stepper"><button type="button" data-step="-10" aria-label="10 ml less">−</button><input type="number" inputmode="numeric" id="f-amt" value="${Math.round(amt)}" min="0" max="500" step="5"><button type="button" data-step="10" aria-label="10 ml more">+</button></div>
      <div class="chips">${[60, 90, 120, 150, 180, 210].map(v => `<button type="button" class="chip-btn" data-amt="${v}">${v}</button>`).join('')}</div></div>
      <div class="field"><span class="lbl">Milk</span>${seg('type', [['formula', 'Formula'], ['breast_milk', 'Breast milk']], existing?.subtype || last?.subtype || 'formula')}</div>
      ${noteField(existing?.note)}${actions(existing, existing ? 'Save' : 'Log bottle')}`,
    onMount(root, close) {
      const inp = root.querySelector('#f-amt');
      root.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => { inp.value = Math.max(0, (Number(inp.value) || 0) + Number(b.dataset.step)); }));
      root.querySelectorAll('[data-amt]').forEach(b => b.addEventListener('click', () => { inp.value = b.dataset.amt; }));
      bindCommon(root, close, existing, () => {
        const t = timeOf(root); const a = num(root, 'f-amt');
        if (!t) return 'Add a time.'; if (a == null || isNaN(a) || a < 0 || a > 500) return 'Enter an amount between 0 and 500 ml.';
        const f = { kind: 'bottle', subtype: segVal(root, 'type'), started_at: iso(t), amount: a, unit: 'ml', note: val(root, 'f-note') || null };
        const r = existing ? updateEvent(existing.id, f) : addEvent(f); saved(r, existing ? 'Updated' : 'Logged');
      });
    },
  });
}

// ---------- solids ----------
const mealOf = d => { const h = d.getHours() + d.getMinutes() / 60; return h < 10.5 ? 'breakfast' : h < 13.5 ? 'lunch' : h < 16.5 ? 'snack' : 'dinner'; };
export function solidsSheet(existing) {
  const t0 = existing?._s || new Date();
  const freq = new Map(); for (const e of events()) if (e.kind === 'solids') for (const f of e.foods) freq.set(f, (freq.get(f) || 0) + 1 + (Date.now() - e._s < 21 * 864e5 ? 3 : 0));
  const common = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]).slice(0, 24);
  const chosen = new Set(existing?.foods || []);
  for (const f of chosen) if (!common.includes(f)) common.unshift(f);
  const d = existing?.detail || {};
  openSheet({
    title: existing ? 'Edit meal' : 'Meal', kind: 'solids',
    body: `${timeField('Time', t0)}
      <div class="field"><span class="lbl">Meal</span>${seg('meal', [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['snack', 'Snack'], ['dinner', 'Dinner']], d.meal || mealOf(t0))}</div>
      <div class="field"><span class="lbl">Foods</span><div class="chips" id="f-foods">${common.map(f => `<button type="button" class="chip-btn" data-food="${esc(f)}" aria-pressed="${chosen.has(f)}">${esc(f)}</button>`).join('')}</div>
        <div class="row"><input type="text" id="f-newfood" maxlength="40" placeholder="Add a food, e.g. Egg" style="flex:1"><button type="button" class="btn" data-addfood>${ICON.plus}Add</button></div></div>
      <div class="field"><span class="lbl">Texture</span>${seg('texture', TEXTURES, d.texture || '').replace('data-seg="texture"', 'data-seg="texture" data-toggle="1"')}</div>
      <div class="field"><span class="lbl">How much</span>${seg('portion', PORTIONS, d.portion || '').replace('data-seg="portion"', 'data-seg="portion" data-toggle="1"')}</div>
      <div class="field"><span class="lbl">Reaction</span>${seg('reaction', REACTIONS, d.reaction || 'none')}</div>
      ${noteField(existing?.note)}${actions(existing, existing ? 'Save' : 'Log meal')}`,
    onMount(root, close) {
      const box = root.querySelector('#f-foods');
      box.addEventListener('click', ev => { const b = ev.target.closest('[data-food]'); if (b) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); });
      const addFood = () => {
        const inp = root.querySelector('#f-newfood'); const raw = inp.value.trim(); if (!raw) return;
        raw.split(/[,+]/).map(s => s.trim()).filter(Boolean).forEach(s => {
          const name = s.charAt(0).toUpperCase() + s.slice(1);
          let b = [...box.children].find(x => x.dataset.food.toLowerCase() === name.toLowerCase());
          if (!b) { box.insertAdjacentHTML('afterbegin', `<button type="button" class="chip-btn" data-food="${esc(name)}" aria-pressed="true">${esc(name)}</button>`); }
          else b.setAttribute('aria-pressed', 'true');
        });
        inp.value = '';
      };
      root.querySelector('[data-addfood]').addEventListener('click', addFood);
      root.querySelector('#f-newfood').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addFood(); } });
      root.querySelector('#f-time').addEventListener('change', () => { const t = timeOf(root); if (t && !existing) root.querySelectorAll('[data-seg="meal"] button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === mealOf(t)))); });
      bindCommon(root, close, existing, () => {
        addFood();
        const t = timeOf(root); if (!t) return 'Add a time.';
        const foods = [...box.querySelectorAll('[aria-pressed="true"]')].map(b => b.dataset.food);
        if (!foods.length) return 'Pick at least one food.';
        const detail = { ...(existing?.detail || {}), meal: segVal(root, 'meal'), texture: segVal(root, 'texture') || undefined, portion: segVal(root, 'portion') || undefined, reaction: segVal(root, 'reaction') || 'none' };
        const f = { kind: 'solids', started_at: iso(t), foods, detail: JSON.parse(JSON.stringify(detail)), note: val(root, 'f-note') || null };
        const r = existing ? updateEvent(existing.id, f) : addEvent(f); saved(r, existing ? 'Updated' : 'Logged');
      });
    },
  });
}

// ---------- nappy ----------
export function nappySheet(existing) {
  openSheet({
    title: existing ? 'Edit nappy' : 'Nappy', kind: 'nappy',
    body: `${timeField('Time', existing?._s || new Date())}
      <div class="field"><span class="lbl">Type</span>${seg('type', [['wet', 'Wet'], ['dirty', 'Dirty'], ['mixed', 'Wet + dirty'], ['dry', 'Dry']], existing?.subtype || 'wet')}</div>
      ${noteField(existing?.note)}${actions(existing, existing ? 'Save' : 'Log nappy')}`,
    onMount(root, close) {
      bindCommon(root, close, existing, () => {
        const t = timeOf(root); if (!t) return 'Add a time.';
        const f = { kind: 'nappy', subtype: segVal(root, 'type'), started_at: iso(t), note: val(root, 'f-note') || null };
        const r = existing ? updateEvent(existing.id, f) : addEvent(f); saved(r, existing ? 'Updated' : 'Logged');
      });
    },
  });
}

// ---------- vitamin D ----------
export function vitdSheet(existing) {
  const today = events().filter(e => e.kind === 'med' && e.subtype === 'vitamin_d' && dayKey(e._s) === dayKey(new Date()) && e.id !== existing?.id);
  openSheet({
    title: existing ? 'Edit vitamin D' : 'Vitamin D', kind: 'vitd',
    body: `${today.length ? `<p class="callout" style="margin-bottom:14px">Already given today at ${today.map(e => hhmm(e._s)).join(', ')}.</p>` : ''}
      ${timeField('Time', existing?._s || new Date())}
      <div class="field"><label for="f-amt">Dose (µg)</label><input type="number" inputmode="decimal" id="f-amt" value="${existing?.amount ?? 10}" min="0" max="100" step="1"></div>
      ${noteField(existing?.note)}${actions(existing, existing ? 'Save' : 'Log vitamin D')}`,
    onMount(root, close) {
      bindCommon(root, close, existing, () => {
        const t = timeOf(root); if (!t) return 'Add a time.';
        const f = { kind: 'med', subtype: 'vitamin_d', started_at: iso(t), amount: num(root, 'f-amt'), unit: 'µg', note: val(root, 'f-note') || null };
        const r = existing ? updateEvent(existing.id, f) : addEvent(f); saved(r, existing ? 'Updated' : 'Logged');
      });
    },
  });
}

// ---------- medicine ----------
export function medSheet(existing) {
  const names = [...new Set(events().filter(e => e.kind === 'med' && e.subtype !== 'vitamin_d').map(e => e.detail?.name || e.subtype).filter(Boolean))].slice(-8).reverse();
  const cur = existing?.detail?.name || (existing?.subtype !== 'vitamin_d' ? existing?.subtype : '') || '';
  openSheet({
    title: existing ? 'Edit medicine' : 'Medicine', kind: 'med',
    body: `<div class="field"><label for="f-name">Medicine</label><input type="text" id="f-name" maxlength="40" value="${esc(cur)}" placeholder="e.g. Paracetamol">${names.length ? `<div class="chips">${names.map(n => `<button type="button" class="chip-btn" data-name="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}</div>
      <div class="field"><span class="lbl">Dose</span><div class="row"><input type="number" inputmode="decimal" id="f-amt" value="${existing?.amount ?? ''}" min="0" step="0.1" style="flex:1"><select id="f-unit" style="width:110px">${['ml', 'mg', 'drops', 'µg', 'dose'].map(u => `<option ${u === (existing?.unit || 'ml') ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
      ${timeField('Time', existing?._s || new Date())}
      ${noteField(existing?.note)}${actions(existing, existing ? 'Save' : 'Log medicine')}`,
    onMount(root, close) {
      root.querySelectorAll('[data-name]').forEach(b => b.addEventListener('click', () => { root.querySelector('#f-name').value = b.dataset.name; }));
      bindCommon(root, close, existing, () => {
        const t = timeOf(root); const n = val(root, 'f-name'); if (!n) return 'Add the medicine name.'; if (!t) return 'Add a time.';
        const f = { kind: 'med', subtype: n.toLowerCase().slice(0, 40), started_at: iso(t), amount: num(root, 'f-amt'), unit: val(root, 'f-unit'), note: val(root, 'f-note') || null, detail: { ...(existing?.detail || {}), name: n } };
        const r = existing ? updateEvent(existing.id, f) : addEvent(f); saved(r, existing ? 'Updated' : 'Logged');
      });
    },
  });
}

// ---------- growth ----------
export function growthSheet(existing) {
  const date = existing?._s || new Date();
  const units = { weight: 'kg', length: 'cm', head: 'cm' };
  const field = (k, label) => (!existing || existing.subtype === k) ? `<div class="field"><label for="f-${k}">${label} (${units[k]})</label><input type="number" inputmode="decimal" id="f-${k}" step="0.01" min="0" value="${existing?.subtype === k ? existing.amount : ''}"><span class="small muted" id="p-${k}"></span></div>` : '';
  openSheet({
    title: existing ? 'Edit measurement' : 'Growth', kind: 'growth',
    body: `<div class="field"><label for="f-date">Date</label><input type="date" id="f-date" value="${dayKey(date)}"></div>
      ${field('weight', 'Weight')}${field('length', 'Length')}${field('head', 'Head circumference')}
      <div class="field"><span class="lbl">Measured by</span>${seg('where', [['visitor', 'Health visitor'], ['doctor', 'Doctor'], ['home', 'Home']], existing?.detail?.where || (/home/i.test(existing?.note || '') ? 'home' : 'visitor'))}</div>
      ${noteField(existing?.note)}${actions(existing, existing ? 'Save' : 'Save measurements')}`,
    onMount(root, close) {
      const upd = () => {
        const d = fromKey(val(root, 'f-date') || dayKey(new Date())); const age = ageMonths(fromKey(state.baby.birth_date), d);
        for (const k of Object.keys(units)) { const v = num(root, 'f-' + k), p = root.querySelector('#p-' + k); if (!p) continue; p.textContent = v ? `About ${ordinal(pct(zscore(k, state.baby.sex, age, v)))} percentile for age` : ''; }
      };
      root.addEventListener('input', upd); upd();
      bindCommon(root, close, existing, () => {
        const ds = val(root, 'f-date'); if (!ds) return 'Add a date.';
        const d = fromKey(ds); const now = new Date(); if (ds === dayKey(now)) d.setHours(now.getHours(), now.getMinutes()); else d.setHours(12);
        const where = segVal(root, 'where'); const note = val(root, 'f-note') || null;
        const vals = Object.keys(units).map(k => [k, num(root, 'f-' + k)]).filter(([k, v]) => root.querySelector('#f-' + k) && v != null && !isNaN(v));
        if (!vals.length) return 'Enter at least one measurement.';
        for (const [k, v] of vals) { if (k === 'weight' && (v < 1 || v > 30)) return 'Weight should be in kg, e.g. 9.4.'; if (k !== 'weight' && (v < 25 || v > 120)) return `${k === 'head' ? 'Head' : 'Length'} should be in cm.`; }
        for (const [k, v] of vals) {
          const f = { kind: 'growth', subtype: k, started_at: iso(d), amount: v, unit: units[k], note, detail: { ...(existing?.detail || {}), where } };
          existing ? updateEvent(existing.id, f) : addEvent(f);
        }
        toast(existing ? 'Measurement updated' : `Saved ${vals.length} measurement${vals.length > 1 ? 's' : ''}`);
      });
    },
  });
}

// ---------- milestone ----------
export function milestoneSheet(existing) {
  const done = new Set(events().filter(e => e.kind === 'milestone').map(e => e.detail?.label));
  openSheet({
    title: existing ? 'Edit milestone' : 'Milestone', kind: 'milestone',
    body: `<div class="field"><label for="f-label">What happened</label><input type="text" id="f-label" maxlength="80" value="${esc(existing?.detail?.label || '')}" placeholder="e.g. First tooth">
      <div class="chips">${MILESTONES.filter(m => !done.has(m) || m === existing?.detail?.label).map(m => `<button type="button" class="chip-btn" data-ms="${esc(m)}">${esc(m)}</button>`).join('')}</div></div>
      <div class="field"><label for="f-date">Date</label><input type="date" id="f-date" value="${dayKey(existing?._s || new Date())}"></div>
      ${noteField(existing?.note)}${actions(existing, existing ? 'Save' : 'Save milestone')}`,
    onMount(root, close) {
      root.querySelectorAll('[data-ms]').forEach(b => b.addEventListener('click', () => { root.querySelector('#f-label').value = b.dataset.ms; }));
      bindCommon(root, close, existing, () => {
        const l = val(root, 'f-label'); const ds = val(root, 'f-date'); if (!l) return 'Describe the milestone.'; if (!ds) return 'Add a date.';
        const d = fromKey(ds); d.setHours(12);
        const f = { kind: 'milestone', started_at: iso(d), note: val(root, 'f-note') || null, detail: { ...(existing?.detail || {}), label: l } };
        existing ? updateEvent(existing.id, f) : addEvent(f); toast(existing ? 'Milestone updated' : `Saved: ${l}`);
      });
    },
  });
}

// ---------- other kinds (imported history): time, end, amount, note ----------
export function genericSheet(existing) {
  const d = describe(existing);
  openSheet({
    title: `Edit ${d.title.toLowerCase()}`, kind: d.kind,
    body: `${timeField('Start', existing._s, 'f-start')}
      ${existing.ended_at !== undefined && ['nursing', 'bath', 'walk'].includes(existing.kind) ? `<div class="field"><label for="f-end">End</label><input type="datetime-local" id="f-end" value="${existing._e ? toLocalInput(existing._e) : ''}"></div>` : ''}
      ${existing.amount != null || existing.kind === 'pump' ? `<div class="field"><label for="f-amt">Amount (${esc(existing.unit || '')})</label><input type="number" id="f-amt" value="${existing.amount ?? ''}"></div>` : ''}
      ${noteField(existing.note)}${actions(existing)}`,
    onMount(root, close) {
      bindCommon(root, close, existing, () => {
        const s = timeOf(root, 'f-start'); if (!s) return 'Add a time.';
        const f = { started_at: iso(s), note: val(root, 'f-note') || null };
        if (root.querySelector('#f-end')) { const e = timeOf(root, 'f-end'); if (e && e < s) return 'End has to be after start.'; f.ended_at = e ? iso(e) : null; }
        if (root.querySelector('#f-amt')) f.amount = num(root, 'f-amt');
        updateEvent(existing.id, f); toast('Updated');
      });
    },
  });
}

export function openFor(kind) {
  ({ sleep: () => sleepSheet(), bottle: () => bottleSheet(), solids: () => solidsSheet(), nappy: () => nappySheet(), vitd: () => vitdSheet(), med: () => medSheet(), growth: () => growthSheet(), milestone: () => milestoneSheet() })[kind]?.();
}
export function editEvent(e) {
  if (!e) return;
  if (e.kind === 'sleep') return sleepSheet(e);
  if (e.kind === 'bottle') return bottleSheet(e);
  if (e.kind === 'solids') return solidsSheet(e);
  if (e.kind === 'nappy') return nappySheet(e);
  if (e.kind === 'med') return e.subtype === 'vitamin_d' ? vitdSheet(e) : medSheet(e);
  if (e.kind === 'growth') return growthSheet(e);
  if (e.kind === 'milestone') return milestoneSheet(e);
  return genericSheet(e);
}
