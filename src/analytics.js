// All derived numbers: nights, days, windows, weekly series, wake windows, foods, allergens, growth, targets.
import { dayKey, nightKey, hourOf, keyAdd, fromKey, median, mean, round, addDays, ageMonths, hToHHMM } from './util.js';
import { ALLERGENS } from './foods.js';
import WHO from './who.json';

const H = 3600e3;
export const isNight = e => e.kind === 'sleep' && e.subtype === 'night';
export const isNap = e => e.kind === 'sleep' && e.subtype !== 'night';
export const isFeed = e => e.kind === 'bottle' || e.kind === 'nursing';

let memo = { v: -1 };
export function model(evts, version, baby) {
  if (memo.v === version && memo.baby === baby?.id) return memo.m;
  const m = build(evts, baby); memo = { v: version, baby: baby?.id, m }; return m;
}

function build(evts, baby) {
  const nights = new Map(), days = new Map();
  const day = k => { let d = days.get(k); if (!d) days.set(k, d = { key: k, naps: [], napH: 0, ml: 0, bottles: 0, small: 0, nursing: 0, nurseMin: 0, feeds: 0, solids: [], nappies: { wet: 0, dirty: 0, mixed: 0, dry: 0 }, nappyN: 0, vitd: 0, meds: 0, sleepLogged: false, any: 0 }); return d; };
  const nightOf = k => { let n = nights.get(k); if (!n) nights.set(k, n = { key: k, segs: [], bed: null, wake: null, tot: 0, longest: 0, feeds: 0 }); return n; };
  const kinds = {};
  let firstSolid = null, firstSleep = null, first = null, last = null;
  for (const e of evts) {
    kinds[e.kind] = (kinds[e.kind] || 0) + 1;
    if (!first) first = e._s; last = e._s;
    const dk = dayKey(e._s); const d = day(dk); d.any++;
    if (e.kind === 'sleep') {
      if (!firstSleep) firstSleep = e._s;
      d.sleepLogged = true;
      if (!e._e) continue;
      const h = (e._e - e._s) / H;
      if (isNight(e)) { const n = nightOf(nightKey(e._s)); n.segs.push(e); n.tot += h; n.longest = Math.max(n.longest, h); if (!n.bed || e._s < n.bed) n.bed = e._s; if (!n.wake || e._e > n.wake) n.wake = e._e; }
      else { d.naps.push(e); d.napH += h; }
    } else if (e.kind === 'bottle') { d.bottles++; d.feeds++; d.ml += e.amount || 0; if ((e.amount || 0) <= 80) d.small++; }
    else if (e.kind === 'nursing') { d.nursing++; d.feeds++; d.nurseMin += e._e ? (e._e - e._s) / 60000 : 0; }
    else if (e.kind === 'solids') { d.solids.push(e); if (!firstSolid) firstSolid = e._s; }
    else if (e.kind === 'nappy') { d.nappyN++; const t = e.subtype || 'wet'; if (t in d.nappies) d.nappies[t]++; }
    else if (e.kind === 'med') { if (e.subtype === 'vitamin_d') d.vitd++; else d.meds++; }
    if (isFeed(e)) { const h = e._s.getHours(); if (h >= 23 || h < 5) nightOf(nightKey(e._s)).feeds++; }
  }
  for (const [k, n] of nights) {
    if (!n.segs.length) { if (!n.feeds) nights.delete(k); n.sleepless = true; continue; }
    n.bedH = hourOf(n.bed); if (n.bedH < 12) n.bedH += 24;
    n.wakeH = hourOf(n.wake); n.wakes = n.segs.length - 1;
  }
  for (const d of days.values()) {
    d.naps.sort((a, b) => a._s - b._s);
    if (d.naps.length) { const ln = d.naps[d.naps.length - 1]; d.lastNapEnd = ln._e; d.lastNapEndH = hourOf(ln._e); }
    const n = nights.get(d.key);
    if (n && d.lastNapEnd && n.bed > d.lastNapEnd) d.gapH = (n.bed - d.lastNapEnd) / H;
  }
  // wake windows: time awake before each nap (index within day) and before bed
  const ended = evts.filter(e => e.kind === 'sleep' && e._e);
  const ww = [];
  for (let i = 1; i < ended.length; i++) {
    const e = ended[i], prev = ended[i - 1];
    if (isNap(e)) {
      const d = days.get(dayKey(e._s)); const idx = d.naps.indexOf(e) + 1;
      const w = (e._s - prev._e) / H; if (w > 0.2 && w < 8) ww.push({ k: dayKey(e._s), idx, h: w, kind: 'nap' });
    }
  }
  return { nights, days, ww, kinds, firstSolid, firstSleep, first, last, baby, evts };
}

// ---------- window stats over day keys [from, to] inclusive ----------
export function stats(m, from, to) {
  const NA = [...m.nights.values()].filter(n => n.key >= from && n.key <= to);
  const N = NA.filter(n => n.segs.length);
  const D = [...m.days.values()].filter(d => d.key >= from && d.key <= to);
  const sleepDays = D.filter(d => d.sleepLogged);
  const feedDays = D.filter(d => d.feeds > 0);
  const nDays = Math.round((fromKey(to) - fromKey(from)) / 864e5) + 1;
  const solidsSince = m.firstSolid ? dayKey(m.firstSolid) : null;
  const solidDays = solidsSince ? [...Array(nDays).keys()].map(i => keyAdd(from, i)).filter(k => k >= solidsSince) : [];
  const nightH = mean(N.map(n => n.tot)), napH = mean(sleepDays.map(d => d.napH));
  return {
    from, to, nDays, nights: N.length,
    nightH, napH, totalH: nightH != null && napH != null ? nightH + napH : null,
    through: N.length ? N.filter(n => n.segs.length === 1).length / N.length * 100 : null,
    wakes: mean(N.map(n => n.wakes)),
    longest: mean(N.map(n => n.longest)),
    bedH: median(N.map(n => n.bedH)), wakeH: median(N.map(n => n.wakeH)),
    naps: mean(sleepDays.map(d => d.naps.length)),
    lastNapH: median(sleepDays.map(d => d.lastNapEndH)),
    gapH: median(D.map(d => d.gapH)),
    nightFeeds: N.length ? mean(N.map(n => n.feeds)) : null,
    ml: mean(feedDays.map(d => d.ml)), bottles: mean(feedDays.map(d => d.bottles)), small: mean(feedDays.map(d => d.small)),
    nursing: mean(feedDays.map(d => d.nursing)),
    solids: solidDays.length ? solidDays.reduce((s, k) => s + (m.days.get(k)?.solids.length || 0), 0) / solidDays.length : null,
    nappies: mean(D.filter(d => d.nappyN).map(d => d.nappyN)), nappyDays: D.filter(d => d.nappyN).length,
    poops: mean(D.filter(d => d.nappyN).map(d => d.nappies.dirty + d.nappies.mixed)),
    vitdDays: D.filter(d => d.vitd > 0).length,
    feedDays: feedDays.length, sleepDays: sleepDays.length,
  };
}

// last N complete days (ending yesterday)
export function lastWindow(n, offset = 0) {
  const to = dayKey(addDays(new Date(), -1 - offset)); return [keyAdd(to, -(n - 1)), to];
}

// ---------- grouped series ----------
const weekStart = k => { const d = fromKey(k); const wd = (d.getDay() + 6) % 7; return dayKey(addDays(d, -wd)); };
export function series(m, from, to, by = 'week') {
  const groupOf = by === 'week' ? weekStart : by === 'month' ? (k => k.slice(0, 7)) : (k => k);
  const groups = new Map();
  const g = k => { const key = groupOf(k); let x = groups.get(key); if (!x) groups.set(key, x = { key, N: [], D: [] }); return x; };
  for (let k = from; k <= to; k = keyAdd(k, 1)) g(k);
  for (const n of m.nights.values()) if (n.key >= from && n.key <= to && n.segs.length) g(n.key).N.push(n);
  for (const d of m.days.values()) if (d.key >= from && d.key <= to) g(d.key).D.push(d);
  const solidsSince = m.firstSolid ? dayKey(m.firstSolid) : '9999';
  return [...groups.values()].sort((a, b) => a.key < b.key ? -1 : 1).map(x => {
    const sd = x.D.filter(d => d.sleepLogged), fd = x.D.filter(d => d.feeds);
    const nd = x.D.filter(d => d.nappyN);
    const solidDayKeys = x.D.filter(d => d.key >= solidsSince);
    return {
      key: x.key,
      nightH: mean(x.N.map(n => n.tot)), napH: mean(sd.map(d => d.napH)),
      bedH: median(x.N.map(n => n.bedH)), wakeH: median(x.N.map(n => n.wakeH)), lastNapH: median(sd.map(d => d.lastNapEndH)),
      through: x.N.length ? x.N.filter(n => n.segs.length === 1).length / x.N.length * 100 : null,
      nightFeeds: x.N.length ? mean(x.N.map(n => n.feeds)) : null,
      ml: fd.length ? mean(fd.map(d => d.ml)) : null, bottles: fd.length ? mean(fd.map(d => d.bottles)) : null,
      nursing: fd.length ? mean(fd.map(d => d.nursing)) : null,
      solids: solidDayKeys.length ? mean(solidDayKeys.map(d => d.solids.length)) : null,
      naps: sd.length ? mean(sd.map(d => d.naps.length)) : null,
      poops: nd.length ? mean(nd.map(d => d.nappies.dirty + d.nappies.mixed)) : null,
      nappies: nd.length ? mean(nd.map(d => d.nappyN)) : null,
      nights: x.N.length, days: x.D.length,
    };
  });
}

// ---------- now / prediction ----------
export function current(m, evts, now = new Date()) {
  const running = [...evts].reverse().find(e => e.kind === 'sleep' && !e._e);
  const lastSleep = [...evts].reverse().find(e => e.kind === 'sleep' && e._e && e._e <= now);
  const lastOf = k => { for (let i = evts.length - 1; i >= 0; i--) if (evts[i].kind === k && evts[i]._s <= now) return evts[i]; return null; };
  const lastVitD = [...evts].reverse().find(e => e.kind === 'med' && e.subtype === 'vitamin_d');
  return { running, lastSleep, lastBottle: lastOf('bottle'), lastSolid: lastOf('solids'), lastNappy: lastOf('nappy'), lastVitD, vitdToday: lastVitD && dayKey(lastVitD._s) === dayKey(now) };
}

export function predictNext(m, cur, now = new Date()) {
  if (cur.running || !cur.lastSleep) return null;
  const [from, to] = lastWindow(14);
  const st = stats(m, from, to);
  const typical = st.naps != null ? Math.round(st.naps) : null;
  const today = m.days.get(dayKey(now));
  // naps started today after the morning wake-up
  const napsToday = today ? today.naps.filter(n => n._e).length : 0;
  const awake = (now - cur.lastSleep._e) / H;
  const recent = m.ww.filter(w => w.k >= from && w.k <= to);
  if (typical != null && napsToday < typical) {
    const idx = napsToday + 1;
    const w = median(recent.filter(x => x.idx === idx).map(x => x.h));
    if (w == null) return null;
    return { what: idx === 1 ? 'First nap' : idx === 2 ? 'Second nap' : `Nap ${idx}`, at: new Date(cur.lastSleep._e.getTime() + w * H), windowH: w, awake };
  }
  if (st.gapH != null) {
    const at = new Date(cur.lastSleep._e.getTime() + st.gapH * H);
    return { what: 'Bedtime', at, windowH: st.gapH, awake, usualBed: st.bedH };
  }
  return null;
}

// ---------- foods & allergens ----------
export function foods(m) {
  const map = new Map();
  for (const e of m.evts) if (e.kind === 'solids') for (const f of e.foods) {
    let x = map.get(f); if (!x) map.set(f, x = { food: f, first: e._s, last: e._s, n: 0 });
    x.n++; x.last = e._s;
  }
  return [...map.values()].sort((a, b) => a.first - b.first);
}
export function allergens(m, now = new Date()) {
  return ALLERGENS.map(a => {
    const hits = m.evts.filter(e => e.kind === 'solids' && (e.foods.some(f => a.match.test(f)) || a.match.test(e.note || '')));
    const last = hits.length ? hits[hits.length - 1]._s : null;
    const recent = hits.filter(e => now - e._s < 14 * 864e5).length;
    return { ...a, first: hits[0]?._s || null, last, n: hits.length, recent, reaction: hits.some(e => e.detail?.reaction && e.detail.reaction !== 'none') };
  });
}
export function textures(m, from, to) {
  const c = { puree: 0, mashed: 0, lumpy: 0, finger: 0 }; let n = 0;
  for (const d of m.days.values()) if (d.key >= from && d.key <= to) for (const s of d.solids) { const t = s.detail?.texture; if (t && t in c) { c[t]++; n++; } }
  return { c, n };
}

// ---------- growth ----------
export function lms(kind, sex, ageM) {
  const tab = WHO[`${sex === 'f' ? 'f' : 'm'}_${kind}`]; const a = Math.min(Math.max(ageM, 0), tab.length - 1);
  const i = Math.floor(a), j = Math.min(i + 1, tab.length - 1), fr = a - i;
  return [0, 1, 2].map(k => tab[i][k] * (1 - fr) + tab[j][k] * fr);
}
export function zscore(kind, sex, ageM, x) { const [L, M, S] = lms(kind, sex, ageM); return L ? (Math.pow(x / M, L) - 1) / (L * S) : Math.log(x / M) / S; }
export function atZ(kind, sex, ageM, z) { const [L, M, S] = lms(kind, sex, ageM); return L ? M * Math.pow(1 + L * S * z, 1 / L) : M * Math.exp(S * z); }
const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
export const pct = z => Math.round(50 * (1 + erf(z / Math.SQRT2)));
export function growth(m) {
  const birth = fromKey(m.baby.birth_date); const sex = m.baby.sex;
  const out = { weight: [], length: [], head: [] };
  for (const e of m.evts) if (e.kind === 'growth' && out[e.subtype] && e.amount) {
    const age = ageMonths(birth, e._s); const z = zscore(e.subtype, sex, age, e.amount);
    out[e.subtype].push({ e, d: e._s, age, v: e.amount, p: pct(z), home: /home/i.test(e.note || '') || e.detail?.where === 'home' });
  }
  return out;
}

// ---------- targets ----------
export function milkBand(ageM) {
  if (ageM < 6) return null;
  if (ageM <= 9) return [500, 750];
  if (ageM >= 12) return [350, 500];
  const f = (ageM - 9) / 3; return [Math.round(500 - 150 * f), Math.round(750 - 250 * f)];
}
export function defaultTargets(naps) {
  if (naps >= 3) return { bedFrom: 20, bedTo: 20.75, lastNapBy: 17.5, gapMin: 2.75, gapMax: 3.5 };
  if (naps === 1) return { bedFrom: 19, bedTo: 20, lastNapBy: 15.5, gapMin: 4, gapMax: 5 };
  return { bedFrom: 19, bedTo: 19.75, lastNapBy: 16, gapMin: 3, gapMax: 4 };
}
export function targets(baby, st) {
  const typical = st?.naps != null ? Math.round(st.naps) : 2;
  const t = { ...defaultTargets(typical), ...(baby.settings?.targets || {}) };
  t.napsBasis = typical; return t;
}
export function scorecard(m, st, now = new Date()) {
  const baby = m.baby; const ageM = ageMonths(fromKey(baby.birth_date), now);
  const t = targets(baby, st);
  const rows = [];
  const S = (label, nowTxt, target, status, txt, group) => rows.push({ label, now: nowTxt, target, status, txt, group });
  const inBand = (x, a, b) => x != null && x >= a && x <= b;
  // sleep
  if (st.bedH != null) S('Bedtime', hToHHMM(st.bedH), `${hToHHMM(t.bedFrom)}–${hToHHMM(t.bedTo)}`, inBand(st.bedH, t.bedFrom - 0.01, t.bedTo + 0.01) ? 'good' : Math.abs(st.bedH - (st.bedH > t.bedTo ? t.bedTo : t.bedFrom)) <= 0.5 ? 'warn' : 'bad', inBand(st.bedH, t.bedFrom - 0.01, t.bedTo + 0.01) ? 'On target' : st.bedH > t.bedTo ? 'Later than target' : 'Earlier than target', 'Sleep');
  if (st.lastNapH != null) S('Last nap ends', hToHHMM(st.lastNapH), `by ${hToHHMM(t.lastNapBy)}`, st.lastNapH <= t.lastNapBy + 0.01 ? 'good' : st.lastNapH <= t.lastNapBy + 0.5 ? 'warn' : 'bad', st.lastNapH <= t.lastNapBy + 0.01 ? 'On target' : 'Too late', 'Sleep');
  if (st.gapH != null) S('Awake before bed', `${st.gapH.toFixed(1)} h`, `${t.gapMin}–${t.gapMax} h`, inBand(st.gapH, t.gapMin - 0.05, t.gapMax + 0.05) ? 'good' : 'warn', inBand(st.gapH, t.gapMin - 0.05, t.gapMax + 0.05) ? 'On target' : st.gapH < t.gapMin ? 'Short' : 'Long', 'Sleep');
  if (st.nightH != null) S('Night sleep', `${st.nightH.toFixed(1)} h`, '10–12 h', st.nightH >= 10 ? 'good' : st.nightH >= 9.5 ? 'warn' : 'bad', st.nightH >= 10 ? 'On target' : 'Short', 'Sleep');
  if (st.totalH != null) S('Total sleep per 24 h', `${st.totalH.toFixed(1)} h`, '12–16 h', inBand(st.totalH, 12, 16) ? 'good' : 'warn', inBand(st.totalH, 12, 16) ? 'In range' : 'Outside range', 'Sleep');
  if (st.through != null) S('Nights slept through', `${Math.round(st.through)}%`, 'more over time', st.through >= 60 ? 'good' : 'info', st.through >= 60 ? 'Good' : 'Building', 'Sleep');
  if (st.naps != null) S('Naps', `${st.naps.toFixed(1)}/day · ${st.napH.toFixed(1)} h`, ageM < 12 ? '2 naps, 2.5–3.5 h' : '1–2 naps, 2–3 h', st.napH <= 3.6 && st.napH >= 2 ? 'good' : 'warn', st.napH > 3.6 ? 'A lot of day sleep' : st.napH < 2 ? 'Little day sleep' : 'In range', 'Sleep');
  // feeding
  const band = milkBand(ageM);
  if (band && st.ml != null) S('Milk per day', `${Math.round(st.ml)} ml`, `${band[0]}–${band[1]} ml`, inBand(st.ml, band[0], band[1]) ? 'good' : 'warn', inBand(st.ml, band[0], band[1]) ? 'In range' : st.ml > band[1] ? 'Above range' : 'Below range', 'Feeding');
  if (st.bottles != null && ageM >= 8) S('Bottles', `${st.bottles.toFixed(1)}/day${st.small >= 0.5 ? `, ${st.small.toFixed(1)} small` : ''}`, ageM >= 11 ? '2–3 full bottles' : '3–4 full bottles', st.bottles <= (ageM >= 11 ? 3.4 : 4.4) && st.small < 0.5 ? 'good' : 'warn', st.small >= 0.5 ? 'Top-ups to fold in' : st.bottles > (ageM >= 11 ? 3.4 : 4.4) ? 'More than needed' : 'On target', 'Feeding');
  if (ageM >= 6) {
    const want = ageM >= 8.5 ? 3 : 2;
    const v = st.solids ?? 0;
    S('Solid meals', `${v.toFixed(1)}/day`, ageM >= 8.5 ? '3 meals + 1–2 snacks' : '2–3 meals', v >= want - 0.15 ? 'good' : v >= want - 1 ? 'warn' : 'bad', v >= want - 0.15 ? 'On target' : 'Add a meal', 'Feeding');
  }
  const tx = textures(m, st.from, st.to);
  if (ageM >= 8) S('Lumpy or finger food', tx.n ? `${Math.round((tx.c.lumpy + tx.c.finger) / tx.n * 100)}% of meals` : 'not logged', 'most meals by 9 months', !tx.n ? 'info' : (tx.c.lumpy + tx.c.finger) / tx.n >= 0.5 ? 'good' : 'warn', !tx.n ? 'Log texture' : (tx.c.lumpy + tx.c.finger) / tx.n >= 0.5 ? 'On track' : 'Move to lumpier', 'Feeding');
  const al = allergens(m, now).filter(a => ['egg', 'peanut', 'dairy', 'wheat', 'fish', 'sesame'].includes(a.key));
  const intro = al.filter(a => a.n), regular = al.filter(a => a.recent);
  if (ageM >= 6) S('Common allergens', `${intro.length} of 6 tried, ${regular.length} recent`, 'all 6 in regular rotation', regular.length === 6 ? 'good' : intro.length >= 4 ? 'warn' : 'bad', regular.length === 6 ? 'On track' : `Missing: ${al.filter(a => !a.n).map(a => a.name).join(', ') || 'none'}`, 'Feeding');
  S('Vitamin D', `${st.vitdDays} of ${st.nDays} days`, '10 µg every day', st.vitdDays >= st.nDays - 1 ? 'good' : st.vitdDays ? 'warn' : 'info', st.vitdDays >= st.nDays - 1 ? 'On track' : st.vitdDays ? 'Some days missed' : 'Not logged', 'Feeding');
  return { rows, t };
}
