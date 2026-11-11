// ---------- device I/O ----------
async function detectDevice() {
  if (!deviceInfo) {
    try { const ls = JSON.parse(localStorage.getItem('dexframe') || 'null'); if (ls) state = {...DEFAULTS, ...ls}; } catch {}
  }
  try {
    const url = api('/api/info');
    if (!url) throw 0;
    const r = await fetch(url, {cache: 'no-store'});
    if (!r.ok) throw 0;
    deviceInfo = await r.json();
    state.panel = deviceInfo.panel || (deviceInfo.red ? 'bwr' : 'bw');
    if (Array.isArray(deviceInfo.palette)) PANELS[state.panel] = {palette: deviceInfo.palette.filter(n => INKS.some(k => k.name === n))};
    setConnected();
    const sr = await fetch(api('/api/state'), {cache: 'no-store'});
    if (sr.ok) {
      const saved = await sr.json();
      if (saved && Object.keys(saved).length)
        state = {...DEFAULTS, ...saved, panel: state.panel, deviceUrl: state.deviceUrl, uiLang: state.uiLang};
    }
  } catch {
    deviceInfo = null;
    try { const ls = JSON.parse(localStorage.getItem('dexframe') || 'null'); if (ls) state = {...DEFAULTS, ...ls}; } catch {}
    setStatus(t('st_preview'));
  }
}

async function saveState(quiet) {
  try { localStorage.setItem('dexframe', JSON.stringify(state)); } catch {}
  if (!deviceInfo) { if (!quiet) setStatus(t('st_saved_browser')); return; }
  const r = await fetch(api('/api/state'), {method: 'POST', headers: {'Content-Type': 'text/plain'}, body: JSON.stringify(state)});
  if (!quiet) setStatus(r.ok ? t('st_saved') : t('st_save_err', {e: r.status}));
}

// Frames go to slots 0..n-1 (rotation), then the daily pool; then the rotation settings.
async function sendAll() {
  if (!deviceInfo) { setStatus(t('st_no_device')); return; }
  const entries = rotation();
  if (!entries.length) { setStatus(t('st_no_pages')); return; }
  const daily = state.pg_daily ? dailyIds() : [];
  if ((deviceInfo.w ?? W) !== W || (deviceInfo.h ?? H) !== H) { setStatus(t('st_size', {w: W, h: H, pw: deviceInfo.w, ph: deviceInfo.h})); return; }
  const dxf = deviceInfo.api >= 2;     // older firmware: raw two-plane pages, fixed size
  const total = entries.length + daily.length, max = dxf ? deviceInfo.maxSlots : deviceInfo.slotsFit ?? deviceInfo.maxSlots ?? 8;
  if (total > max) { setStatus(t('st_too_many', {n: total, m: max})); return; }
  const dots = entries.length + (daily.length ? 1 : 0);
  let note = '';
  try {
    const jobs = [...entries.map((e, i) => [e.key, e.s, i]),
      ...daily.map((id, k) => ['daily', {...state, _dailyId: id}, dots - 1])];
    // Render everything first: compressed pages differ in size, so check they all fit.
    const bpp = paletteBpp(panelOf(state).palette), frames = [];
    for (let i = 0; i < jobs.length; i++) {
      const [key, s, idx] = jobs[i];
      setStatus(t('st_rendering', {i: i + 1, n: jobs.length}));
      const ink = await renderPage(key, s, idx, dots);
      frames.push({data: dxf ? encodeFrame(ink, W, H, bpp) : pack(ink), overlay: ink.overlay});
    }
    const bytes = frames.reduce((a, f) => a + f.data.length, 0);
    if (dxf) {
      const blk = n => Math.ceil(n / 4096) * 4096;     // on flash: whole blocks, +1 for the counter box, +1 upload in progress
      const need = frames.reduce((a, f) => a + blk(f.data.length) + 4096, 0) + blk(Math.max(...frames.map(f => f.data.length)));
      if (need > deviceInfo.pageBudget) { setStatus(t('st_too_big', {n: Math.ceil(need / 1024), m: Math.floor(deviceInfo.pageBudget / 1024)})); return; }
    }
    setStatus(t('st_glyphs'));
    const gd = new FormData();
    gd.append('glyphs', new Blob([buildGlyphs()], {type: 'application/octet-stream'}), 'glyphs.bin');
    const gr = await fetch(api('/api/glyphs'), {method: 'POST', body: gd});
    if (gr.status === 404) note = ' · ' + t('st_old_fw');
    else if (!gr.ok) throw new Error(`glyphs: HTTP ${gr.status}`);
    for (let i = 0; i < frames.length; i++) {
      setStatus(t('st_sending', {i: i + 1, n: frames.length}));
      const fd = new FormData();
      fd.append('frame', new Blob([frames[i].data], {type: 'application/octet-stream'}), 'frame.bin');
      const o = frames[i].overlay;
      const ov = o ? '&ov=' + [o.x, o.y, o.w, o.h, o.align, o.start, o.color, o.sep].join(',') : '';
      const r = await fetch(api(`/api/frame?slot=${i}${ov}`), {method: 'POST', body: fd});
      if (!r.ok) throw new Error(`${t('st_page', {i: i + 1})}: HTTP ${r.status}`);
    }
    note = ' · ' + t('st_sent_kb', {kb: Math.ceil(bytes / 1024)}) + note;
    const body = new URLSearchParams({count: entries.length, interval: Math.max(0, Number(state.interval) || 0),
      daily: daily.length, sleep: state.sleep ? 1 : 0, awake: Math.max(1, Number(state.awake) || 3),
      tz: state.tz || DEFAULTS.tz, now: Math.floor(Date.now() / 1000)});
    const r = await fetch(api('/api/rotation'), {method: 'POST', body});
    if (!r.ok) throw new Error(`${t('st_rotation')}: HTTP ${r.status}`);
    await saveState(true);
    setStatus(t('st_sent', {n: jobs.length}) + note);
  } catch (e) { setStatus(t('st_send_fail', {e: e.message})); }
}

async function nextOnDevice() {
  if (!deviceInfo) { setStatus(t('st_no_device')); return; }
  const r = await fetch(api('/api/next'), {method: 'POST'});
  setStatus(r.ok ? t('st_next') : t('st_err', {e: r.status}));
}

async function autofill() {
  const id = Number(state.dex);
  setStatus('PokeAPI…');
  try {
    const j = u => fetch(u).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    const [p, sp] = await Promise.all([
      j(`https://pokeapi.co/api/v2/pokemon/${id}`),
      j(`https://pokeapi.co/api/v2/pokemon-species/${id}`)]);
    // PokeAPI language codes match ours for it/en
    state.name = (sp.names.find(n => n.language.name === state.dispLang) || {}).name || p.name;
    const types = p.types.sort((a, b) => a.slot - b.slot).map(x => typeKey(x.type.name));
    state.type1 = types[0] || ''; state.type2 = types[1] || '';
    await applyUiLang(); render();
    setStatus(t('st_autofill'));
  } catch (e) { setStatus(t('st_pokeapi_err', {e: e.message})); }
}

// Same origin when the page is served by the ESP32; the configured address otherwise.
// The optional admin key (System section) rides along as ?key=, kept out of the saved state.
const deviceKey = () => { try { return localStorage.getItem('dexframe-key') || ''; } catch { return ''; } };
function api(path) {
  const base = String(state.deviceUrl || '').trim().replace(/\/+$/, '');
  let url = base ? (/^https?:\/\//i.test(base) ? base : 'http://' + base) + path : location.protocol === 'file:' ? null : path;
  const k = deviceKey();
  if (url && k) url += (url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(k);
  return url;
}

// Panel name for menus and the status line; unknown panels show their ink list.
function panelLabel(id) {
  const key = 'pn_' + id, name = t(key);
  return name !== key ? name : (PANELS[id]?.palette || [id]).join('/');
}

function setConnected() {
  const i = deviceInfo;
  const bat = i.batteryMv > 1000 ? ' · ' + t('st_bat', {v: (i.batteryMv / 1000).toFixed(2)}) : '';
  renderSystemBox();
  setStatus(t('st_connected', {w: i.w, h: i.h, mode: panelLabel(state.panel), c: i.current + 1, n: i.entries ?? i.count}) + bat);
}

// Normalise data that may come from older saves (Italian type names, missing languages).
function migrate(st) {
  for (const k of ['type1', 'type2', 'mtype0', 'mtype1', 'mtype2', 'mtype3']) st[k] = typeKey(st[k]);
  if (!(st.uiLang in LANGS)) st.uiLang = browserLang;
  if (!(st.dispLang in LANGS)) st.dispLang = st.uiLang;
  if (!(st.style in SPRITES)) st.style = 'pt';
  // a bare name typed in "File sprite" (e.g. "lucas") without a base URL can't load: drop it, the picker replaces it
  if (st.trFile && !st.trBase && !/^https?:/i.test(st.trFile)) st.trFile = '';
  if (!Array.isArray(st.collection)) st.collection = [];
  st.collection = st.collection.filter(c => c && c.data).map(c => ({id: c.id || Math.random().toString(36).slice(2), data: c.data}));
  if (!st.dailySeed) st.dailySeed = (Date.now() % 2147483647) || 1;
  return st;
}

// Form sections as separate pages. The current one is kept in the URL hash, so a
// reload or a bookmark (…/#ribbons) opens the same section.
const SECTION_PAGE = {pokemon: 'cover', moves: 'moves', stats: 'stats', story: 'story', ribbons: 'ribbons', trainer: 'team', hof: 'hof'};
let section = GROUPS.some(([g]) => g === location.hash.slice(1)) ? location.hash.slice(1) : 'pokemon';

function buildSections() {
  const nav = $('sections'); nav.innerHTML = '';
  for (const [gid] of GROUPS) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = t('g_' + gid); b.dataset.section = gid;
    b.onclick = () => showSection(gid, true);
    nav.append(b);
  }
  showSection(section, false);
}

function showSection(gid, fromClick) {
  section = gid;
  document.querySelectorAll('#form fieldset').forEach(fs => fs.classList.toggle('active', fs.dataset.group === gid));
  document.querySelectorAll('#sections button').forEach(b => {
    if (b.dataset.section === gid) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  if (location.hash !== '#' + gid) history.replaceState(null, '', '#' + gid);
  const page = SECTION_PAGE[gid];
  if (fromClick && page && activePages().includes(page) && page !== previewPage) {
    previewPage = page; buildTabs(); render();
  }
}

// Back/forward buttons and edited #hash switch section too.
window.addEventListener('hashchange', () => {
  const h = location.hash.slice(1);
  if (h !== section && GROUPS.some(([gid]) => gid === h)) showSection(h, true);
});

// Re-labels everything that belongs to the page UI (not the e-paper).
async function applyUiLang() {
  document.documentElement.lang = state.uiLang;
  $('uiLangLabel').textContent = t('lang');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  buildForm();
  buildTabs();
  await buildPicker();
  await buildTrainerPicker();
  await buildHofBox();
  buildBackupBox();
  buildCollectionBox();
  buildDailyBox();
  buildShowdownBox();
  buildPkxBox();
  buildMonPickerBoxes();
  buildBadgeBox();
  buildStyleBox();
  buildSystemBox();
  buildSections();
}

$('uiLang').append(...Object.entries(LANGS).map(([k, n]) => new Option(n, k)));
$('uiLang').addEventListener('input', async () => {
  state.uiLang = $('uiLang').value;
  await applyUiLang();
  if (deviceInfo) setConnected(); else setStatus(t('st_preview'));
  try { localStorage.setItem('dexframe', JSON.stringify(state)); } catch {}
  render();
});

$('send').onclick = sendAll;
$('next').onclick = nextOnDevice;
$('save').onclick = () => saveState(false);
$('autofill').onclick = autofill;

(async () => {
  try { await Promise.all([document.fonts.load(FONT(16, true)), document.fonts.load(FONT(16, false))]); } catch {}
  await detectDevice();
  migrate(state);
  $('uiLang').value = state.uiLang;
  if (SECTION_PAGE[section] && activePages().includes(SECTION_PAGE[section])) previewPage = SECTION_PAGE[section];
  await applyUiLang();
  if (deviceInfo) setConnected(); else setStatus(t('st_preview'));
  render();
  // ribbon names in every display language, from PKHeX texts (only if pkx data is available)
  extendRibbonNames().then(() => { renderPicker(); scheduleRender(); }).catch(() => {});
})();
