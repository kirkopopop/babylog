// Small helpers: escaping, dates in device-local time, formatting.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const pad = n => String(n).padStart(2, '0');
export const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const keyAdd = (k, n) => dayKey(addDays(fromKey(k), n));
export const hourOf = d => d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
export const nightKey = d => dayKey(new Date(d.getTime() - 12 * 3600e3));
export const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const hToHHMM = h => { if (h == null || isNaN(h)) return '–'; h = ((h % 24) + 24) % 24; let H = Math.floor(h), M = Math.round((h - H) * 60); if (M === 60) { H++; M = 0; } return `${pad(H % 24)}:${pad(M)}`; };
export const dur = ms => { if (ms == null || ms < 0) return '–'; const m = Math.round(ms / 60000); const h = Math.floor(m / 60); return h ? `${h}h ${pad(m % 60)}m` : `${m}m`; };
export const durH = h => (h == null || isNaN(h)) ? '–' : `${h.toFixed(1)} h`;
export const fmtDate = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const fmtDateDow = d => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtDateLong = d => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
export const ordinal = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
export const median = a => { const b = a.filter(x => x != null && !isNaN(x)).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
export const mean = a => { const b = a.filter(x => x != null && !isNaN(x)); return b.length ? b.reduce((s, x) => s + x, 0) / b.length : null; };
export const round = (x, d = 1) => x == null ? null : Math.round(x * 10 ** d) / 10 ** d;
export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

export function ageText(birth, at = new Date()) {
  let months = (at.getFullYear() - birth.getFullYear()) * 12 + (at.getMonth() - birth.getMonth());
  let anchor = new Date(birth); anchor.setMonth(birth.getMonth() + months);
  if (anchor > at) { months--; anchor = new Date(birth); anchor.setMonth(birth.getMonth() + months); }
  const days = Math.floor((startOfDay(at) - startOfDay(anchor)) / 864e5);
  const w = Math.floor(days / 7), d = days % 7;
  if (months <= 0) return `${w} wk ${d} d`;
  return `${months} mo${w ? ` ${w} wk` : ''}${!w && d ? ` ${d} d` : ''}`;
}
export const ageMonths = (birth, at = new Date()) => (at - birth) / (30.4375 * 864e5);

// datetime-local input value <-> Date
export const toLocalInput = d => `${dayKey(d)}T${hhmm(d)}`;
export const fromLocalInput = s => { if (!s) return null; const [a, b] = s.split('T'); const [y, m, d] = a.split('-').map(Number); const [H, M] = (b || '00:00').split(':').map(Number); return new Date(y, m - 1, d, H, M); };

// Convert a wall-clock time in a named zone to a Date (for importing naive MyBaby timestamps).
const dtfCache = {};
function tzParts(date, tz) {
  const f = dtfCache[tz] || (dtfCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const p = {}; for (const x of f.formatToParts(date)) p[x.type] = x.value;
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
}
export function zonedToDate(y, mo, d, h, mi, s, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let t = guess - (tzParts(new Date(guess), tz) - guess);
  t = guess - (tzParts(new Date(t), tz) - t);
  return new Date(t);
}
