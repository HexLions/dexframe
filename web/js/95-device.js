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

// CRC-32 (zlib), to recognise pages the board already has (GET /api/pages).
function crc32(bytes) {
  let c = ~0;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}
const minutesOf = hhmm => { const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/); return m ? Math.min(1439, Number(m[1]) * 60 + Number(m[2])) : -1; };
const overlayArg = o => o ? [o.x, o.y, o.w, o.h, o.align, o.start, o.color, o.sep, o.mode || 0, o.scale || 1].join(',') : '';

// Pages go to slots in rotation order (each entry's pool in a row), then the rotation.
// With firmware 2.0 they are uploaded to a staging copy and switched over by the last
// call (/api/rotation?commit=1): a send that stops halfway leaves the old pages working.
async function sendAll() {
  if (!deviceInfo) { setStatus(t('st_no_device')); return; }
  const plan = rotationPlan();
  if (!plan.length) { setStatus(t('st_no_pages')); return; }
  if ((deviceInfo.w ?? W) !== W || (deviceInfo.h ?? H) !== H) { setStatus(t('st_size', {w: W, h: H, pw: deviceInfo.w, ph: deviceInfo.h})); return; }
  const dxf = deviceInfo.api >= 2;     // older firmware: raw two-plane pages, fixed size
  const feat = String(deviceInfo.features || '').split(',');
  const pools = feat.includes('pools');
  if (!pools && plan.some(e => e.jobs.length > 1 && e.key !== 'daily')) { setStatus(t('st_old_pools')); return; }
  const jobs = plan.flatMap((e, idx) => e.jobs.map(j => ({...j, idx})));
  const max = dxf ? deviceInfo.maxSlots : deviceInfo.slotsFit ?? deviceInfo.maxSlots ?? 8;
  if (jobs.length > max) { setStatus(t('st_too_many', {n: jobs.length, m: max})); return; }
  const dots = plan.length;
  let note = '';
  try {
    // Render everything first, a few pages at a time (sprites and PokeAPI data load in
    // parallel): compressed pages differ in size, so check they all fit before sending.
    const bpp = paletteBpp(panelOf(state).palette), frames = new Array(jobs.length);
    let next = 0, done = 0;
    await Promise.all(Array.from({length: Math.min(4, jobs.length)}, async () => {
      while (next < jobs.length) {
        const i = next++, j = jobs[i];
        const ink = await renderPage(j.key, j.s, j.idx, dots, j.part);
        const data = dxf ? encodeFrame(ink, W, H, bpp) : pack(ink);
        frames[i] = {data, ov: overlayArg(ink.overlay), crc: crc32(data)};
        setStatus(t('st_rendering', {i: ++done, n: jobs.length}));
      }
    }));
    const bytes = frames.reduce((a, f) => a + f.data.length, 0);
    // pages the board already holds, byte for byte, are not sent again
    let have = new Map();
    if (feat.includes('pages')) {
      try { have = new Map((await (await fetch(api('/api/pages'), {cache: 'no-store'})).json()).map(p => [p.slot, p])); } catch {}
    }
    const same = (f, i) => { const h = have.get(i); return h && h.size === f.data.length && (h.crc >>> 0) === f.crc && String(h.ov || '') === f.ov; };
    const blk = n => Math.ceil(n / 4096) * 4096;     // on flash: whole blocks, +1 for the counter box
    let stage = false;
    if (dxf) {
      const need = frames.reduce((a, f) => a + blk(f.data.length) + 4096, 0) + blk(Math.max(...frames.map(f => f.data.length)));
      if (need > deviceInfo.pageBudget) { setStatus(t('st_too_big', {n: Math.ceil(need / 1024), m: Math.floor(deviceInfo.pageBudget / 1024)})); return; }
      // staging keeps old and new pages side by side until the switch: only if they fit
      const changed = frames.reduce((a, f, i) => a + (same(f, i) ? 0 : blk(f.data.length) + 4096), 0);
      stage = feat.includes('pools') && deviceInfo.freeBytes != null && changed + 16384 < deviceInfo.freeBytes;
    }
    setStatus(t('st_glyphs'));
    const gd = new FormData();
    gd.append('glyphs', new Blob([buildGlyphs()], {type: 'application/octet-stream'}), 'glyphs.bin');
    const gr = await fetch(api('/api/glyphs'), {method: 'POST', body: gd});
    if (gr.status === 404) note = ' · ' + t('st_old_fw');
    else if (!gr.ok) throw new Error(`glyphs: HTTP ${gr.status}`);
    let skipped = 0;
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      if (same(f, i)) { skipped++; continue; }
      setStatus(t('st_sending', {i: i + 1, n: frames.length}));
      const fd = new FormData();
      fd.append('frame', new Blob([f.data], {type: 'application/octet-stream'}), 'frame.bin');
      const r = await fetch(api(`/api/frame?slot=${i}${stage ? '&stage=1' : ''}${f.ov ? '&ov=' + f.ov : ''}`), {method: 'POST', body: fd});
      if (!r.ok) throw new Error(`${t('st_page', {i: i + 1})}: HTTP ${r.status}`);
    }
    note = ' · ' + t('st_sent_kb', {kb: Math.ceil(bytes / 1024)}) + (skipped ? ' · ' + t('st_skipped', {n: skipped}) : '') + note;
    const mins = k => Math.max(0, Math.round(Number((state.pageMin || {})[k]) || 0));
    const daily = plan.at(-1)?.key === 'daily' ? plan.at(-1).jobs.length : 0;
    const body = new URLSearchParams({
      ...(pools ? {pools: poolsSpec(plan)} : {count: plan.length - (daily ? 1 : 0), daily}),
      ...(stage ? {commit: 1} : {}),
      interval: Math.max(0, Number(state.interval) || 0),
      sleep: state.sleep ? 1 : 0, awake: Math.max(1, Number(state.awake) || 3),
      tz: state.tz || DEFAULTS.tz, now: Math.floor(Date.now() / 1000),
      qf: state.quietOn ? minutesOf(state.quietFrom) : -1, qt: state.quietOn ? minutesOf(state.quietTo) : -1,
      iv: plan.map(e => mins(e.key)).join(','),
      flip: state.flip ? 1 : 0, dbl: Number(state.btnDouble) || 0, lng: Number(state.btnLong) || 0,
      batlow: Math.round((Number(state.batLow) || 3.5) * 1000), fullevery: Math.max(1, Math.round(Number(state.fullEvery) || 10)),
      ...dailySettings(), ...orderSettings()});
    const r = await fetch(api('/api/rotation'), {method: 'POST', body});
    if (!r.ok) throw new Error(`${t('st_rotation')}: HTTP ${r.status}`);
    await saveState(true);
    const msg = t('st_sent', {n: jobs.length}) + note;
    setStatus(msg);
    if (pools) waitForDisplay(msg);
  } catch (e) { setStatus(t('st_send_fail', {e: e.message})); }
}

// Puts one page of the rotation on the e-paper now (POST /api/show?slot=<rotation entry>).
// Only when the board holds the rotation listed here: otherwise the numbers differ.
async function showOnDevice(key, part = 0, sub = 0) {
  if (!deviceInfo) { setStatus(t('st_no_device')); return; }
  if (!boardMatches()) { setStatus(t('st_show_stale')); return; }
  const idx = key == null ? -1 : rotationIndex(key, part, sub);
  if (idx < 0) { setStatus(t('st_show_none')); return; }
  const r = await fetch(api('/api/show?slot=' + idx), {method: 'POST'}).catch(() => null);
  const label = t('pg_' + key) + (pageParts(key) > 1 ? ' ' + (part + 1) : '');
  setStatus(r?.ok ? t('st_show', {p: label}) : t('st_err', {e: r ? r.status : 'network'}));
  if (r?.ok) waitForDisplay(t('st_show', {p: label}));
}

// The board draws after replying (a B/W/R refresh takes ~16 s and blocks it): ask
// /api/info until nothing is pending, then say so.
async function waitForDisplay(prefix) {
  const t0 = Date.now();
  await new Promise(r => setTimeout(r, 1200));
  while (Date.now() - t0 < 60000) {
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 25000);
      const i = await (await fetch(api('/api/info'), {cache: 'no-store', signal: ctl.signal})).json();
      clearTimeout(to);
      deviceInfo = i;
      if (!i.pending) { setStatus(prefix + ' · ' + t('st_idle', {s: Math.round((Date.now() - t0) / 1000)})); renderPowerBox(); return; }
    } catch {}
    setStatus(prefix + ' · ' + t('st_drawing'));
    await new Promise(r => setTimeout(r, 1500));
  }
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
  renderPowerBox();
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
  if (!PAGE_STYLES.includes(st.pageStyle)) st.pageStyle = 'classic';
  if (!FRAME_KEYS.includes(st.frame) || (st.frame === 'custom' && !st.frameImg)) st.frame = 'none';
  if (!st.pageFrame || typeof st.pageFrame !== 'object') st.pageFrame = {};
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
  buildPagesBox();
  buildDailyBox();
  buildShowdownBox();
  buildPkxBox();
  buildMonPickerBoxes();
  buildBadgeBox();
  buildStyleBox();
  buildFrameBox();
  buildPowerBox();
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
$('png').onclick = exportPng;
$('next').onclick = nextOnDevice;
$('show').onclick = () => showOnDevice(previewCard ? null : previewPage, previewPart);
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
