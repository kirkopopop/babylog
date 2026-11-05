// Settings: baby profile, targets, theme, import/export, household, install help, sign out.
import { esc, hToHHMM, dayKey, fmtDate } from '../util.js';
import { state, events, saveBaby, signOut, importRows } from '../store.js';
import { model, stats, lastWindow, defaultTargets, targets } from '../analytics.js';
import { parseCSV, mapMyBaby } from '../importer.js';
import { toast } from '../ui.js';

const hm = h => hToHHMM(h);
const toH = s => { if (!s) return null; const [a, b] = s.split(':').map(Number); return a + b / 60; };
export const theme = {
  get() { try { return localStorage.getItem('babylog-theme') || 'system'; } catch { return 'system'; } },
  set(v) { try { localStorage.setItem('babylog-theme', v); } catch { } theme.apply(); },
  apply() { const v = theme.get(); if (v === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v); },
};

export function render(root) {
  const b = state.baby; const ev = events(); const m = model(ev, state.version, b);
  const st = stats(m, ...lastWindow(14)); const t = targets(b, st); const def = defaultTargets(t.napsBasis);
  const custom = !!b.settings?.targets;
  const firstApp = ev.find(e => e.source === 'app');
  const imported = ev.filter(e => e.source === 'mybaby').length;
  root.innerHTML = `
    <section style="margin-top:4px"><h1>Settings</h1></section>
    <section><div class="panel"><h2 style="margin-bottom:12px">Baby</h2>
      <div class="grid2" style="gap:0 12px">
        <div class="field"><label for="s-name">Name</label><input type="text" id="s-name" maxlength="40" value="${esc(b.name)}"></div>
        <div class="field"><label for="s-birth">Date of birth</label><input type="date" id="s-birth" value="${esc(b.birth_date)}" max="${dayKey(new Date())}"></div>
      </div>
      <div class="field"><span class="lbl">Growth charts for</span><div class="seg" id="s-sex"><button data-v="m" aria-pressed="${b.sex === 'm'}">Boys</button><button data-v="f" aria-pressed="${b.sex === 'f'}">Girls</button></div></div>
      <button class="btn primary" id="s-save-baby">Save</button></div></section>

    <section><div class="panel"><h2>Targets</h2><p class="note" style="margin:4px 0 12px">Used for the scorecard on Trends. ${custom ? 'You have custom targets.' : `Defaults for ${t.napsBasis} nap${t.napsBasis === 1 ? '' : 's'} a day, which is what the last two weeks show.`}</p>
      <div class="grid2" style="gap:0 12px">
        <div class="field"><label for="s-bf">Bedtime from</label><input type="time" id="s-bf" value="${hm(t.bedFrom)}"></div>
        <div class="field"><label for="s-bt">Bedtime to</label><input type="time" id="s-bt" value="${hm(t.bedTo)}"></div>
        <div class="field"><label for="s-ln">Last nap ends by</label><input type="time" id="s-ln" value="${hm(t.lastNapBy)}"></div>
        <div class="field"><label for="s-g1">Awake before bed (hours)</label><div class="row"><input type="number" step="0.25" min="1" max="8" id="s-g1" value="${t.gapMin}" style="flex:1"><span>to</span><input type="number" step="0.25" min="1" max="8" id="s-g2" value="${t.gapMax}" style="flex:1"></div></div>
      </div>
      <div class="row"><button class="btn primary" id="s-save-t">Save targets</button>${custom ? `<button class="btn ghost" id="s-reset-t">Use defaults (${hm(def.bedFrom)}–${hm(def.bedTo)})</button>` : ''}</div></div></section>

    <section><div class="panel"><h2>Appearance</h2><div class="field" style="margin:10px 0 0"><div class="seg" id="s-theme">${[['system', 'Match phone'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<button data-v="${v}" aria-pressed="${theme.get() === v}">${l}</button>`).join('')}</div><p class="note">Dark is easier on the eyes for night feeds.</p></div></div></section>

    <section><div class="panel"><h2>Import from MyBaby</h2>
      <p class="note" style="margin:4px 0 12px">In MyBaby, export the events as CSV and pick the file here. Entries already imported are skipped, so you can import a newer export any time. ${imported ? `${imported.toLocaleString('en-GB')} MyBaby entries are in the log now.` : ''}</p>
      <input type="file" id="s-file" accept=".csv,text/csv">
      <div id="s-preview" style="margin-top:12px"></div></div></section>

    <section><div class="panel"><h2>Export</h2><p class="note" style="margin:4px 0 12px">Download every entry as a CSV file (${ev.length.toLocaleString('en-GB')} rows).</p><button class="btn" id="s-export">Download CSV</button></div></section>

    <section><div class="panel"><h2>Household</h2><p class="note" style="margin:4px 0 10px">Everyone in your hjem household can log and see ${esc(b.name)}'s data. Sign in with the same email and password as hjem.</p>
      <div class="entries">${Object.entries(state.members).map(([id, p]) => `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)"><span class="avatar" style="background:${esc(p.color)}">${esc((p.name || '?')[0])}</span><span>${esc(p.name)}${id === state.user.id ? ' <span class="faint">(you)</span>' : ''}</span><span class="faint small" style="margin-left:auto">${p.role === 'device' ? 'Wall tablet' : p.role === 'owner' ? 'Owner' : 'Member'}</span></div>`).join('')}</div></div></section>

    <section><div class="panel"><h2>Add to home screen</h2>
      <p class="note" style="margin-top:6px"><b>iPhone:</b> open this page in Safari, tap Share, then “Add to Home Screen”.<br><b>Android:</b> open in Chrome, tap the ⋮ menu, then “Install app” or “Add to Home screen”.</p></div></section>

    <section><div class="row" style="justify-content:space-between"><span class="faint small">Signed in as ${esc(state.user.email)}</span><button class="btn danger" id="s-out">Sign out</button></div></section>`;

  root.querySelectorAll('.seg').forEach(g => g.addEventListener('click', e => { const bt = e.target.closest('button[data-v]'); if (!bt) return; g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === bt))); if (g.id === 's-theme') theme.set(bt.dataset.v); }));
  root.querySelector('#s-save-baby').addEventListener('click', async () => {
    const name = root.querySelector('#s-name').value.trim(); const birth = root.querySelector('#s-birth').value; const sex = root.querySelector('#s-sex [aria-pressed="true"]').dataset.v;
    if (!name || !birth) { toast('Add a name and date of birth'); return; }
    try { await saveBaby({ name, birth_date: birth, sex }); toast('Saved'); } catch (e) { toast('Could not save: ' + e.message); }
  });
  root.querySelector('#s-save-t').addEventListener('click', async () => {
    const nt = { bedFrom: toH(root.querySelector('#s-bf').value), bedTo: toH(root.querySelector('#s-bt').value), lastNapBy: toH(root.querySelector('#s-ln').value), gapMin: Number(root.querySelector('#s-g1').value), gapMax: Number(root.querySelector('#s-g2').value) };
    if (Object.values(nt).some(v => v == null || isNaN(v)) || nt.bedTo <= nt.bedFrom || nt.gapMax < nt.gapMin) { toast('Check the times: “to” must be after “from”'); return; }
    try { await saveBaby({ settings: { ...(b.settings || {}), targets: nt } }); toast('Targets saved'); render(root); } catch (e) { toast('Could not save: ' + e.message); }
  });
  root.querySelector('#s-reset-t')?.addEventListener('click', async () => { const s = { ...(b.settings || {}) }; delete s.targets; try { await saveBaby({ settings: s }); toast('Using default targets'); render(root); } catch (e) { toast('Could not save: ' + e.message); } });
  root.querySelector('#s-out').addEventListener('click', signOut);
  root.querySelector('#s-export').addEventListener('click', () => exportCSV(ev));
  root.querySelector('#s-file').addEventListener('change', e => previewImport(root, e.target.files?.[0], firstApp));
}

async function previewImport(root, file, firstApp) {
  const box = root.querySelector('#s-preview'); if (!file) { box.innerHTML = ''; return; }
  box.innerHTML = '<p class="note">Reading file…</p>';
  let rows, skipped;
  try { ({ rows, skipped } = mapMyBaby(parseCSV(await file.text()))); } catch (e) { box.innerHTML = `<p class="err">Could not read this file: ${esc(e.message)}</p>`; return; }
  if (!rows.length) { box.innerHTML = '<p class="err">No MyBaby entries found. Check that it is the events CSV export.</p>'; return; }
  const existing = new Set(events().filter(e => e.source_key).map(e => e.source_key));
  const fresh = rows.filter(r => !existing.has(r.source_key));
  const cut = firstApp ? firstApp._s : null;
  const counts = {}; for (const r of fresh) counts[r.kind] = (counts[r.kind] || 0) + 1;
  const first = new Date(rows[0].started_at), last = new Date(rows.reduce((a, r) => r.started_at > a ? r.started_at : a, rows[0].started_at));
  const names = { sleep: 'sleeps', bottle: 'bottles', nursing: 'nursing sessions', solids: 'meals', nappy: 'nappies', med: 'vitamin D / meds', growth: 'measurements', bath: 'baths', walk: 'walks', pump: 'pumping', note: 'other' };
  box.innerHTML = `<div class="callout"><b>${rows.length.toLocaleString('en-GB')}</b> entries from ${esc(fmtDate(first))} to ${esc(fmtDate(last))}. <b>${fresh.length.toLocaleString('en-GB')}</b> are new.${Object.keys(skipped).length ? ` Skipped: ${esc(Object.entries(skipped).map(([k, v]) => `${v} ${k}`).join(', '))}.` : ''}</div>
    ${fresh.length ? `<p class="note" style="margin:8px 0">${esc(Object.entries(counts).map(([k, v]) => `${v.toLocaleString('en-GB')} ${names[k] || k}`).join(' · '))}</p>
    ${cut ? `<label class="row small" style="margin:8px 0"><input type="checkbox" id="s-cut" checked> Skip MyBaby entries after ${esc(fmtDate(cut))} ${String(cut.getHours()).padStart(2, '0')}:${String(cut.getMinutes()).padStart(2, '0')}, when logging started here (avoids doubles)</label>` : ''}
    <button class="btn primary" id="s-import">Import ${fresh.length.toLocaleString('en-GB')} entries</button> <span class="note" id="s-prog"></span>` : '<p class="note" style="margin-top:8px">Everything in this file is already in the log.</p>'}`;
  box.querySelector('#s-import')?.addEventListener('click', async ev => {
    const btn = ev.target; btn.disabled = true;
    const useCut = box.querySelector('#s-cut')?.checked && cut;
    const todo = useCut ? fresh.filter(r => new Date(r.started_at) < cut) : fresh;
    const prog = box.querySelector('#s-prog');
    try {
      const n = await importRows(todo, (d, t) => { prog.textContent = `${Math.round(d / t * 100)}%`; });
      prog.textContent = ''; box.innerHTML = `<p class="callout">Imported ${n.toLocaleString('en-GB')} entries.</p>`; toast(`Imported ${n.toLocaleString('en-GB')} entries`);
    } catch (e) { btn.disabled = false; prog.textContent = ''; box.insertAdjacentHTML('beforeend', `<p class="err">Import stopped: ${esc(e.message)}. Already imported entries are kept; try again to continue.</p>`); }
  });
}

function exportCSV(ev) {
  const q = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const who = id => state.members[id]?.name || '';
  const lines = ['started_at,ended_at,kind,subtype,amount,unit,foods,note,details,source,logged_by'];
  for (const e of ev) lines.push([e._s.toISOString(), e._e ? e._e.toISOString() : '', e.kind, e.subtype, e.amount, e.unit, e.foods.join('; '), e.note, Object.keys(e.detail || {}).length ? JSON.stringify(e.detail) : '', e.source, e.source === 'mybaby' ? 'MyBaby' : who(e.created_by)].map(q).join(','));
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${(state.baby.name || 'baby').toLowerCase()}-log-${dayKey(new Date())}.csv`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
