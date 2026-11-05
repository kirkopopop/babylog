import './styles.css';
import { esc, ageText, fromKey } from './util.js';
import { sb, state, onChange, currentUser, signIn, bootstrap, setErrorHandler } from './store.js';
import { ICON } from './icons.js';
import { toast, sheetOpen } from './ui.js';
import { theme } from './views/settings.js';
import * as Today from './views/today.js';
import * as History from './views/history.js';
import * as Trends from './views/trends.js';
import * as Settings from './views/settings.js';

theme.apply();
const ROUTES = { today: { v: Today, live: true, label: 'Today', icon: 'today' }, history: { v: History, live: true, label: 'History', icon: 'history' }, trends: { v: Trends, live: true, label: 'Trends', icon: 'trends' }, settings: { v: Settings, live: false, label: 'Settings', icon: 'settings' } };
const app = document.getElementById('app');
const route = () => { const r = (location.hash || '').replace(/^#\/?/, ''); return ROUTES[r] ? r : 'today'; };

function shell() {
  app.innerHTML = `<div class="app"><header class="topbar"><div class="who"><div><h1 id="b-name"></h1><div class="age" id="b-age"></div></div></div><span class="sync" id="sync"><i></i><span></span></span></header><main id="view"></main></div>
  <div class="tabbar"><nav aria-label="Main">${Object.entries(ROUTES).map(([k, r]) => `<a href="#/${k}" data-r="${k}">${ICON[r.icon]}${r.label}</a>`).join('')}</nav></div>`;
}
function header() {
  const b = state.baby; if (!b) return;
  document.getElementById('b-name').textContent = `${b.name}'s Log`;
  document.getElementById('b-age').textContent = ageText(fromKey(b.birth_date));
  document.title = `${b.name}'s Log`;
  const s = document.getElementById('sync'); const st = state.status;
  s.className = 'sync' + (st === 'pending' ? ' pending' : st === 'offline' || st === 'error' ? ' offline' : '');
  s.querySelector('span').textContent = st === 'pending' ? `Saving ${state.outbox.length}…` : st === 'offline' ? `Offline · ${state.outbox.length} to sync` : st === 'error' ? 'Sync problem' : st === 'syncing' ? 'Syncing…' : 'Synced';
}
let lastRendered = null, renderTimer = null;
function renderView(force) {
  const r = route(); const view = document.getElementById('view'); if (!view) return;
  document.querySelectorAll('.tabbar a').forEach(a => { if (a.dataset.r === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (!force && lastRendered === r && !ROUTES[r].live) return;
  const y = lastRendered === r ? scrollY : 0;
  try { ROUTES[r].v.render(view); } catch (e) { console.error(e); view.innerHTML = `<div class="panel"><p class="err">Something went wrong drawing this page: ${esc(e.message)}</p></div>`; }
  if (lastRendered !== r) scrollTo(0, 0); else scrollTo(0, y);
  lastRendered = r;
}
const scheduleRender = () => { clearTimeout(renderTimer); renderTimer = setTimeout(() => { header(); renderView(false); }, 120); };

function loginScreen(msg) {
  app.innerHTML = `<div class="app"><div class="auth"><div><div class="eyebrow">Baby log</div><h1 style="font-size:34px">Sign in</h1><p class="muted" style="margin-top:6px">Use the same email and password as your hjem account.</p></div>
    <form id="login" class="panel" novalidate><div class="field"><label for="l-email">Email</label><input type="email" id="l-email" autocomplete="username" required></div>
    <div class="field"><label for="l-pass">Password</label><input type="password" id="l-pass" autocomplete="current-password" required></div>
    <p class="err" id="l-err" ${msg ? '' : 'hidden'}>${esc(msg || '')}</p><button class="btn primary big" type="submit">Sign in</button></form>
    <p class="note">Forgot the password? Reset it from the hjem sign-in page.</p></div></div>`;
  document.getElementById('login').addEventListener('submit', async e => {
    e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true;
    try { await signIn(document.getElementById('l-email').value.trim(), document.getElementById('l-pass').value); start(); }
    catch (err) { const el = document.getElementById('l-err'); el.hidden = false; el.textContent = /invalid/i.test(err.message) ? 'Wrong email or password.' : err.message; btn.disabled = false; }
  });
}

function setupBaby() {
  app.innerHTML = `<div class="app"><div class="auth"><div><h1>Add your baby</h1><p class="muted" style="margin-top:6px">This is shared with everyone in your household.</p></div>
    <form id="nb" class="panel"><div class="field"><label for="nb-name">Name</label><input type="text" id="nb-name" maxlength="40" required></div>
    <div class="field"><label for="nb-birth">Date of birth</label><input type="date" id="nb-birth" required></div>
    <div class="field"><span class="lbl">Growth charts for</span><select id="nb-sex"><option value="m">Boys</option><option value="f">Girls</option></select></div>
    <p class="err" hidden></p><button class="btn primary big">Continue</button></form></div></div>`;
  document.getElementById('nb').addEventListener('submit', async e => {
    e.preventDefault();
    const { error } = await sb.from('babies').insert({ household_id: state.household, name: document.getElementById('nb-name').value.trim(), birth_date: document.getElementById('nb-birth').value, sex: document.getElementById('nb-sex').value });
    if (error) { const p = e.target.querySelector('.err'); p.hidden = false; p.textContent = error.message; return; }
    location.reload();
  });
}

let started = false;
async function start() {
  const user = await currentUser();
  if (!user) return loginScreen();
  if (started) return; started = true;
  app.innerHTML = `<div class="app"><p class="empty" style="margin-top:30vh">Loading…</p></div>`;
  setErrorHandler(m => toast(m));
  let shellDrawn = false;
  const draw = () => {
    if (state.error === 'no-household') { app.innerHTML = `<div class="app"><div class="auth"><h1>No household yet</h1><p class="muted">This account is not in a hjem household. Join or create one in hjem, then come back.</p><button class="btn" onclick="location.reload()">Try again</button></div></div>`; return; }
    if (state.error === 'no-baby') { setupBaby(); return; }
    if (!state.baby) return;
    if (!shellDrawn) { shell(); shellDrawn = true; header(); renderView(true); return; }
    scheduleRender();
  };
  onChange(draw);
  try { await bootstrap(user); } catch (e) { console.error(e); if (!state.loaded) app.innerHTML = `<div class="app"><div class="auth"><h1>Could not load</h1><p class="err">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Try again</button></div></div>`; }
  draw();
}
addEventListener('hashchange', () => { if (state.baby) renderView(true); });
setInterval(() => { if (state.baby && route() === 'today' && !sheetOpen() && document.visibilityState === 'visible') { header(); renderView(true); } }, 30000);
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { started = false; loginScreen(); } });
start();

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => { });
