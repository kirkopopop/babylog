// MyBaby CSV export -> baby_events rows. Re-importable: each row gets a stable source_key.
import { zonedToDate } from './util.js';
import { parseFoods } from './foods.js';

export function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift() || [];
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const TZ = 'Europe/Copenhagen';
function ts(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s || ''); if (!m) return null;
  return zonedToDate(+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] || 0), TZ).toISOString();
}
const cleanNote = c => { const t = (c || '').trim(); return !t || /^[❓?]+$/.test(t) ? null : t.slice(0, 1000); };

export function mapMyBaby(records) {
  const out = []; const skipped = {};
  for (const r of records) {
    const ev = r['Event'], type = r['Type'] || '', when = ts(r['Date and time']);
    if (!ev || !when) { skipped[ev || '(blank)'] = (skipped[ev || '(blank)'] || 0) + 1; continue; }
    const num = r['Value.Number'] === '' ? null : Number(r['Value.Number']);
    const start = ts(r['Start']) || when, end = ts(r['End']);
    const base = { started_at: start, ended_at: null, subtype: null, amount: null, unit: null, foods: [], note: cleanNote(r['Comments']), detail: { mybaby: { event: ev, type: type || undefined } }, source: 'mybaby', source_key: `mb|${ev}|${r['Date and time']}|${type}|${r['Value']}`.slice(0, 300) };
    let x = null;
    switch (ev) {
      case 'Sleep': x = { kind: 'sleep', subtype: /night/i.test(type) ? 'night' : 'nap', ended_at: end }; break;
      case 'Bottle': x = { kind: 'bottle', subtype: /breast/i.test(type) ? 'breast_milk' : 'formula', amount: num, unit: 'ml', started_at: when }; break;
      case 'Nursing': x = { kind: 'nursing', subtype: /both|left;\s*right|right;\s*left/i.test(type) ? 'both' : /left/i.test(type) ? 'left' : /right/i.test(type) ? 'right' : null, ended_at: end }; break;
      case 'Pumping': x = { kind: 'pump', subtype: type.toLowerCase() || null, amount: num, unit: 'ml', started_at: when }; break;
      case 'Solids': x = { kind: 'solids', foods: parseFoods(type), started_at: when, detail: { ...base.detail, text: type } }; break;
      case 'Nappy': x = { kind: 'nappy', subtype: ({ clean: 'dry', dirty: 'dirty', mixed: 'mixed', wet: 'wet' })[type.toLowerCase()] || 'wet', started_at: when }; break;
      case 'Medications': x = { kind: 'med', subtype: /vitamin\s*d/i.test(type) || !type ? 'vitamin_d' : type.toLowerCase().slice(0, 40), started_at: when, amount: /vitamin\s*d/i.test(type) || !type ? 10 : null, unit: /vitamin\s*d/i.test(type) || !type ? 'µg' : null }; break;
      case 'Weight': x = { kind: 'growth', subtype: 'weight', amount: num, unit: 'kg', started_at: when }; break;
      case 'Length': case 'Height': x = { kind: 'growth', subtype: 'length', amount: num, unit: 'cm', started_at: when }; break;
      case 'Head circumference': x = { kind: 'growth', subtype: 'head', amount: num, unit: 'cm', started_at: when }; break;
      case 'Bath': x = { kind: 'bath', ended_at: end }; break;
      case 'Stroll': case 'Walk': x = { kind: 'walk', ended_at: end }; break;
      default: x = { kind: 'note', note: [ev, type, r['Value'], r['Comments']].filter(Boolean).join(' · ').slice(0, 1000), started_at: when };
    }
    const row = { ...base, ...x };
    if (row.ended_at && row.ended_at < row.started_at) row.ended_at = null;
    if (row.kind === 'sleep' && !row.ended_at) { skipped['Sleep without end'] = (skipped['Sleep without end'] || 0) + 1; continue; }
    if (row.amount != null && (isNaN(row.amount) || row.amount < 0)) row.amount = null;
    out.push(row);
  }
  // collapse exact duplicates (same key)
  const seen = new Set(); const rows = out.filter(r => !seen.has(r.source_key) && seen.add(r.source_key));
  return { rows, skipped };
}
