// ---------- Energy & updates: battery state, refresh, timing, Pokémon of the day schedule ----------
// Settings go to the board with "Send all pages", or alone with "Save to the display"
// (POST /api/settings: no page is sent again, the page on screen stays).

// Resting voltage -> charge of a 1S LiPo, linear between the points. Only a guide:
// the curve depends on the cell, its age and the load.
const LIPO = [[4200, 100], [4100, 90], [4000, 78], [3900, 63], [3800, 47], [3700, 30], [3600, 15], [3500, 6], [3400, 2], [3300, 0]];
function lipoPercent(mv) {
  if (mv >= LIPO[0][0]) return 100;
  for (let i = 1; i < LIPO.length; i++) {
    const [v1, p1] = LIPO[i - 1], [v0, p0] = LIPO[i];
    if (mv >= v0) return Math.round(p0 + (p1 - p0) * (mv - v0) / (v1 - v0));
  }
  return 0;
}

const dailySettings = (s = state) => ({dat: dailyAtOf(s), dev: dailyEveryOf(s), dsh: s.dailyShuffle ? 1 : 0});
const orderSettings = (s = state) => ({ord: s.orderShuffle ? 1 : 0, qi: Math.max(0, Math.round(Number(s.quietInterval) || 0))});

// The rotation settings that make sense without sending the pages again.
function settingsBody() {
  const plan = rotationPlan();
  const mins = k => Math.max(0, Math.round(Number((state.pageMin || {})[k]) || 0));
  const body = {interval: Math.max(0, Number(state.interval) || 0),
    sleep: state.sleep ? 1 : 0, awake: Math.max(1, Number(state.awake) || 3),
    tz: state.tz || DEFAULTS.tz, now: Math.floor(Date.now() / 1000),
    qf: state.quietOn ? minutesOf(state.quietFrom) : -1, qt: state.quietOn ? minutesOf(state.quietTo) : -1,
    flip: state.flip ? 1 : 0, dbl: Number(state.btnDouble) || 0, lng: Number(state.btnLong) || 0,
    batlow: Math.round((Number(state.batLow) || 3.5) * 1000), fullevery: Math.max(1, Math.round(Number(state.fullEvery) || 10)),
    ...dailySettings(), ...orderSettings()};
  // per-page minutes only when the pages on the board are the ones listed here
  if (boardMatches()) body.iv = plan.map(e => mins(e.key)).join(',');
  return new URLSearchParams(body);
}

// Fresh /api/info (battery, schedule) without reloading the saved data from the board.
async function readInfo() {
  if (!deviceInfo) return;
  try {
    const r = await fetch(api('/api/info'), {cache: 'no-store'});
    if (r.ok) { deviceInfo = await r.json(); setConnected(); }
  } catch {}
}

function buildPowerBox() {
  const fs = document.querySelector('fieldset[data-group="power"]');
  if (!fs || $('powerbox')) return;
  const box = document.createElement('div'); box.className = 'trbox'; box.id = 'powerbox';
  box.innerHTML = `<div class="batline"><div class="batgauge"><i id="pwBar"></i></div><strong id="pwPct"></strong><span class="muted" id="pwTxt"></span></div>
    <div class="row" style="margin-top:0"><button type="button" class="primary" id="pwSave"></button>
    <button type="button" id="pwRefresh"></button><button type="button" id="pwRead"></button><span class="muted" id="pwSt"></span></div>
    <div class="muted" id="pwInfo"></div>`;
  fs.querySelector('legend').after(box);
  $('pwSave').onclick = saveSettingsOnly;
  $('pwRefresh').onclick = async () => {
    if (!deviceInfo) { $('pwSt').textContent = t('st_no_device'); return; }
    const r = await fetch(api('/api/refresh'), {method: 'POST'}).catch(() => null);
    $('pwSt').textContent = r?.ok ? t('pw_refreshing') : t('st_err', {e: r ? r.status : 'network'});
  };
  $('pwRead').onclick = async () => { await readInfo(); renderPowerBox(); };
  renderPowerBox();
}

function renderPowerBox() {
  if (!$('powerbox')) return;
  $('pwSave').textContent = t('pw_save');
  $('pwRefresh').textContent = t('pw_refresh');
  $('pwRead').textContent = t('pw_read');
  $('pwInfo').textContent = t('pw_info');
  const feat = String(deviceInfo?.features || '').split(',');
  $('pwSave').disabled = !deviceInfo || !feat.includes('settings');
  $('pwRefresh').disabled = !deviceInfo || !feat.includes('refresh');
  const mv = deviceInfo?.batteryMv;
  let pct = null, txt;
  if (!deviceInfo) txt = t('st_no_device');
  else if (mv == null || mv < 0) txt = t('pw_nosense');
  else if (mv < 1000) txt = t('pw_nobat');
  else {
    pct = lipoPercent(mv);
    const low = (Number(state.batLow) || 3.5) * 1000;
    txt = t('pw_volt', {v: (mv / 1000).toFixed(2)}) + (mv > 4150 ? ' · ' + t('pw_usb') : mv <= low ? ' · ' + t('pw_low') : '');
  }
  if (deviceInfo && !feat.includes('settings')) txt += ' · ' + t('pw_oldfw');
  $('pwPct').textContent = pct == null ? '—' : pct + '%';
  $('pwTxt').textContent = txt;
  $('pwBar').style.width = (pct ?? 0) + '%';
  $('pwBar').dataset.low = pct != null && pct <= 15 ? '1' : '';
}

async function saveSettingsOnly() {
  if (!deviceInfo) { $('pwSt').textContent = t('st_no_device'); return; }
  try {
    const r = await fetch(api('/api/settings'), {method: 'POST', body: settingsBody()});
    if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? t('sy_key_bad') : 'HTTP ' + r.status);
    await saveState(true);
    $('pwSt').textContent = t('pw_saved');
    await readInfo(); renderPowerBox();
  } catch (e) { $('pwSt').textContent = t('st_err', {e: e.message}); }
}
