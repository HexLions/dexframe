// ---------- preview ----------
function buildTabs() {
  const pages = activePages();
  if (!pages.includes(previewPage)) previewPage = pages[0] || 'cover';
  const tabs = $('tabs'); tabs.innerHTML = '';
  for (const k of pages) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = t('pg_' + k); b.dataset.page = k;
    b.setAttribute('aria-pressed', k === previewPage);
    b.onclick = () => { previewPage = k; previewCard = null; buildTabs(); render(); };
    tabs.append(b);
  }
}

let renderTimer = 0, renderSeq = 0, previewCard = null;
function scheduleRender() { clearTimeout(renderTimer); renderTimer = setTimeout(render, 150); }
// Display name for a list entry: a custom name wins; an empty or stock name (in any
// language) becomes the legend name in the display language; else the file name.
function autoRibbonName({name, file}, byFile, lang = state.dispLang) {
  const e = byFile.get(file);
  if (e && (!name || Object.keys(LANGS).some(l => displayName(e, l).toLowerCase() === name.toLowerCase())))
    return displayName(e, lang);
  return name || file.replace(/^.*\//, '').replace(/\.\w+$/, '').replace(/[_-]/g, ' ');
}
const isCustomName = ({name, file}, byFile) => !!name && autoRibbonName({name, file}, byFile) === name &&
  !(byFile.get(file) && Object.keys(LANGS).some(l => displayName(byFile.get(file), l).toLowerCase() === name.toLowerCase()));

// Searchable picker over the legend; clicking an icon adds/removes it from the list.
async function buildPicker() {
  const fs = document.querySelector('fieldset[data-group="ribbons"]');
  const legend = await loadLegend();
  if (!fs || !legend.length || $('picker')) return;
  const box = document.createElement('div'); box.className = 'picker'; box.id = 'picker';
  box.innerHTML = `<div class="sel" id="pkSel"></div><div class="bar"><input type="search" id="pkQ">
    <select id="pkT"><option value=""></option><option value="ribbon"></option><option value="mark"></option></select>
    <select id="pkG"><option value=""></option>${[3,4,5,6,7,8,9].map(g => `<option>${g}</option>`).join('')}</select>
    <label class="chk"><input type="checkbox" id="pkS"> <span id="pkSL"></span></label></div>
    <div class="count" id="pkC"></div><div class="res" id="pkR"></div>`;
  fs.querySelector('.grid').after(box);
  $('pkQ').placeholder = t('pk_search');
  const [oAll, oRib, oMark] = $('pkT').options;
  oAll.text = t('pk_all'); oRib.text = t('pk_ribbon'); oMark.text = t('pk_mark');
  $('pkG').options[0].text = t('pk_allgen');
  $('pkSL').textContent = t('pk_only');
  ['pkQ','pkT','pkG','pkS'].forEach(id => $(id).addEventListener('input', renderPicker));
  renderPicker();
}

const selectedFiles = () => new Set(PAGES.ribbons.list(state).map(r => r.file).filter(Boolean));

const ribbonLines = () => String(state.ribbons || '').split('\n').map(l => l.trim()).filter(Boolean);
function setRibbonLines(lines) {
  state.ribbons = lines.join('\n');
  const ta = document.querySelector('textarea[name=ribbons]'); if (ta) ta.value = state.ribbons;
  renderPicker(); scheduleRender();
}

// The chosen ribbons, in display order: icon + automatic name, rename/reorder/remove.
async function renderSelected() {
  const box = $('pkSel'); if (!box) return;
  const byFile = new Map((await loadLegend()).map(e => [e.png, e]));
  const lines = ribbonLines(), list = lines.map(parseRibbonLine);
  const h = document.createElement('h4'); h.textContent = t('sel_title', {n: list.length});
  const rows = list.map((r, i) => {
    const row = document.createElement('div'); row.className = 'row';
    const img = document.createElement('img'); img.alt = '';
    if (r.file) img.src = iconSrc(r.file);
    const auto = autoRibbonName({name: '', file: r.file}, byFile);
    const inp = document.createElement('input'); inp.type = 'text';
    inp.value = isCustomName(r, byFile) ? r.name : '';
    inp.placeholder = r.file ? auto : r.name;
    inp.title = t('sel_rename', {n: auto});
    inp.addEventListener('change', () => {
      const v = inp.value.trim().replace(/\|/g, '');
      const next = ribbonLines();
      next[i] = r.file ? (v ? `${v} | ${r.file}` : r.file) : (v || r.name);
      setRibbonLines(next);
    });
    const btn = (label, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.title = title; b.onclick = fn; return b; };
    const move = d => () => { const next = ribbonLines(); const j = i + d; if (j < 0 || j >= next.length) return; [next[i], next[j]] = [next[j], next[i]]; setRibbonLines(next); };
    row.append(img, inp, btn('↑', t('up'), move(-1)), btn('↓', t('down'), move(1)),
      btn('✕', t('remove'), () => { const next = ribbonLines(); next.splice(i, 1); setRibbonLines(next); }));
    return row;
  });
  if (!rows.length) { const p = document.createElement('div'); p.className = 'empty'; p.textContent = t('sel_empty'); rows.push(p); }
  box.replaceChildren(h, ...rows);
}

async function renderPicker() {
  const res = $('pkR'); if (!res) return;
  renderSelected();
  const legend = await loadLegend();
  const q = $('pkQ').value.trim().toLowerCase(), kind = $('pkT').value, g = $('pkG').value, only = $('pkS').checked;
  const sel = selectedFiles();
  const hits = legend.filter(e => !e.dup &&
    (!kind || e.type === kind) && (!g || String(e.origin_gen) === g) && (!only || sel.has(e.png)) &&
    (!q || [e.name, ...Object.keys(LANGS).map(l => displayName(e, l)), e.title, e.description, e.symbol]
      .join(' ').toLowerCase().includes(q)));
  $('pkC').textContent = t('pk_count', {n: hits.length, s: sel.size});
  res.replaceChildren(...hits.slice(0, 120).map(e => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'it' + (sel.has(e.png) ? ' on' : '');
    b.title = e.description || e.name;
    const img = document.createElement('img'); img.src = iconSrc(e.png); img.alt = ''; img.loading = 'lazy';
    const lab = document.createElement('span');
    lab.textContent = displayName(e);
    const sm = document.createElement('small');
    const alt = displayName(e) !== e.name.replace(/ Ribbon\b/, '') ? ' · ' + e.name : '';
    sm.textContent = `${t(e.type === 'mark' ? 'k_mark' : 'k_ribbon')} · gen ${e.origin_gen} · ${t(e.web ? 'k_web' : 'k_own')}${alt}`;
    lab.append(sm); b.append(img, lab);
    b.onclick = () => toggleRibbon(e);
    return b;
  }));
}

function toggleRibbon(e) {
  const lines = ribbonLines();
  const i = lines.findIndex(l => parseRibbonLine(l).file === e.png);
  if (i >= 0) lines.splice(i, 1); else lines.push(e.png);
  setRibbonLines(lines);
}

// Trainer sprite chooser: current image, upload from disk, your trainers/ legend.
async function buildTrainerPicker() {
  const fs = document.querySelector('fieldset[data-group="trainer"]');
  if (!fs || $('trbox')) return;
  const legend = await loadTrainerLegend();
  const box = document.createElement('div'); box.className = 'trbox'; box.id = 'trbox';
  box.innerHTML = `<strong style="font-size:13px"></strong>
    <div class="cur"><img id="trCurImg" alt=""><span id="trCurTxt"></span>
      <label class="chk" style="cursor:pointer"><input type="file" id="trFile" accept="image/*" hidden><span class="btnlike" id="trUp"></span></label>
      <button type="button" id="trClr"></button></div>
    ${legend.length ? `<div class="bar" style="display:flex;gap:8px;flex-wrap:wrap"><input type="search" id="trQ" style="flex:1;min-width:160px">
      <select id="trG"><option value=""></option>${[...new Set(legend.map(e => e.origin_gen).filter(g => g != null))].sort((a, b) => a - b).map(g => `<option value="${g}">Gen ${g}</option>`).join('')}<option value="none"></option></select></div>
      <div class="count" id="trC" style="font-size:12px;color:var(--muted)"></div><div class="res" id="trR"></div>` : ''}`;
  fs.querySelector('.grid').after(box);
  box.querySelector('strong').textContent = t('tr_sprite');
  $('trUp').textContent = t('tr_upload');
  $('trUp').style.cssText = 'padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg)';
  $('trClr').textContent = t('tr_clear');
  $('trClr').onclick = () => { state.trImage = ''; state.trSprite = ''; state.trFile = ''; syncField('trFile'); renderTrainerPicker(); scheduleRender(); };
  $('trFile').addEventListener('change', onTrainerUpload);
  if (legend.length) {
    $('trQ').placeholder = t('tr_search');
    $('trG').options[0].text = t('tr_allgen');
    [...$('trG').options].find(o => o.value === 'none').text = t('tr_other');
    $('trQ').addEventListener('input', renderTrainerPicker);
    $('trG').addEventListener('input', renderTrainerPicker);
  }
  renderTrainerPicker();
}

async function renderTrainerPicker() {
  if (!$('trbox')) return;
  const url = state.trSprite?.startsWith('sd:') && !state.trImage && !trUrl(state) ? trSrc(state.trSprite) : trainerImageUrl(state);
  const img = $('trCurImg');
  img.style.display = url ? '' : 'none';
  if (url) img.src = url;
  const legend = await loadTrainerLegend();
  const cur = legend.find(e => e.png === state.trSprite);
  if (state.trImage) {
    const probe = await loadLocalImage(state.trImage);
    $('trCurTxt').textContent = t('tr_custom', {w: probe?.naturalWidth || '?', h: probe?.naturalHeight || '?'});
  } else if (trUrl(state)) {
    // loaded with CORS exactly as the renderer does, so a ✓ here means it will print
    const probe = await loadLocalImage(trUrl(state));
    $('trCurTxt').textContent = probe ? `✓ ${t('tr_url', {u: trUrl(state)})} (${probe.naturalWidth}×${probe.naturalHeight})` : `✗ ${t('tr_url_bad')}`;
    if (!probe) img.style.display = 'none';
  } else $('trCurTxt').textContent = cur ? `${cur.label}${cur.origin_gen ? ' · gen ' + cur.origin_gen : ''}` : t('tr_none');
  const res = $('trR'); if (!res) return;
  const q = $('trQ').value.trim().toLowerCase(), g = $('trG').value;
  const hits = legend.filter(e => (!g || (g === 'none' ? e.origin_gen == null : String(e.origin_gen) === g)) &&
    (!q || [e.label, e.name, e.variant, e.key, e.title, e.description, e.showdown_file].join(' ').toLowerCase().includes(q)));
  $('trC').textContent = t(legend[0]?.png?.startsWith('sd:') ? 'tr_catalog' : 'tr_legend', {n: hits.length}) + (hits.length > 150 ? ' (150)' : '');
  res.replaceChildren(...hits.slice(0, 150).map(e => {
    const b = document.createElement('button'); b.type = 'button';
    if (!state.trImage && e.png === state.trSprite) b.className = 'on';
    const im = document.createElement('img'); im.src = trSrc(e.png); im.alt = ''; im.loading = 'lazy';
    const lb = document.createElement('span'); lb.textContent = e.label;
    b.title = e.description || e.showdown_file || e.label;
    b.append(im, lb);
    b.onclick = async () => {
      if (e.png.startsWith('sd:')) {
        setStatus(t('tr_dl', {n: e.label}));
        try { await fetchTrainerToDevice(e.png); localImgCache.delete(trPixels(e.png)); setStatus(t('tr_dl_ok', {n: e.label})); }
        catch (err) { setStatus(t('tr_dl_err', {e: err.message})); return; }
      }
      state.trSprite = e.png; state.trImage = ''; state.trFile = ''; syncField('trFile'); renderTrainerPicker(); scheduleRender();
    };
    return b;
  }));
}

const syncField = k => { const el = document.querySelector(`[name="${k}"]`); if (el) el.value = state[k] ?? ''; };

// Hall of Fame background: uploaded image, cover-cropped to 400x270 and stored at
// half resolution as JPEG (a few KB), drawn x2 as faint dither behind the team.
async function buildHofBox() {
  const fs = document.querySelector('fieldset[data-group="hof"]');
  if (!fs || $('hofbox')) return;
  const box = document.createElement('div'); box.className = 'trbox'; box.id = 'hofbox';
  box.innerHTML = `<div style="font-size:12px;color:var(--muted)" id="hofTeam"></div><strong style="font-size:13px"></strong>
    <div class="cur"><img id="hofImg" alt="" style="width:120px;height:81px;object-fit:cover"><span id="hofTxt"></span>
    <label class="chk" style="cursor:pointer"><input type="file" id="hofFile" accept="image/*" hidden><span id="hofUp"></span></label>
    <button type="button" id="hofClr"></button></div>`;
  fs.querySelector('.grid').after(box);
  box.querySelector('strong').textContent = t('hof_bg');
  $('hofUp').textContent = t('hof_bg_up');
  $('hofUp').style.cssText = 'padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg)';
  $('hofClr').textContent = t('hof_bg_clear');
  $('hofClr').onclick = () => { state.hofBg = ''; renderHofBox(); scheduleRender(); };
  $('hofFile').addEventListener('change', async ev => {
    const f = ev.target.files?.[0]; ev.target.value = '';
    if (!f) return;
    try {
      const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
      const img = await loadLocalImage(url); if (!img) throw new Error();
      const c = document.createElement('canvas'); c.width = 200; c.height = 135;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 200, 135);
      const k = Math.max(200 / img.naturalWidth, 135 / img.naturalHeight);     // cover
      const w = img.naturalWidth * k, h = img.naturalHeight * k;
      x.drawImage(img, (200 - w) / 2, (135 - h) / 2, w, h);
      state.hofBg = c.toDataURL('image/jpeg', 0.8);
      renderHofBox(); scheduleRender();
    } catch { setStatus(t('tr_bad')); }
  });
  renderHofBox();
}

function renderHofBox() {
  if (!$('hofbox')) return;
  $('hofTeam').textContent = '';
  $('hofImg').style.display = state.hofBg ? '' : 'none';
  if (state.hofBg) $('hofImg').src = state.hofBg;
  $('hofTxt').textContent = t(state.hofBg ? 'hof_bg_custom' : 'hof_bg_none');
}

// Backup: the whole state as a JSON file, and back.
function buildBackupBox() {
  const fs = document.querySelector('fieldset[data-group="backup"]');
  if (!fs || $('bkbox')) return;
  const box = document.createElement('div'); box.className = 'trbox'; box.id = 'bkbox';
  box.innerHTML = `<p style="margin:0;font-size:13px;color:var(--muted)" id="bkInfo"></p>
    <div class="row" style="margin-top:0"><button type="button" class="primary" id="bkExp"></button>
    <label class="chk" style="cursor:pointer"><input type="file" id="bkFile" accept=".json,application/json" hidden><span id="bkImp"></span></label></div>`;
  fs.querySelector('.grid').after(box);
  $('bkInfo').textContent = t('bk_info');
  $('bkExp').textContent = t('bk_export');
  $('bkImp').textContent = t('bk_import');
  $('bkImp').style.cssText = 'padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg)';
  $('bkExp').onclick = () => {
    const data = {app: 'dexframe', version: 1, exported: new Date().toISOString(), state};
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    const day = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = `dexframe-${slug(state.name || 'config')}-${day}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setStatus(t('bk_done'));
  };
  $('bkFile').addEventListener('change', async ev => {
    const f = ev.target.files?.[0]; ev.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const st = data?.app === 'dexframe' ? data.state : data;   // also accepts a bare state object
      if (!st || typeof st !== 'object' || Array.isArray(st)) throw new Error('JSON');
      const keep = {panel: state.panel, deviceUrl: state.deviceUrl, uiLang: state.uiLang};
      state = migrate({...DEFAULTS, ...st, ...(deviceInfo ? {panel: keep.panel} : {}), deviceUrl: keep.deviceUrl});
      $('uiLang').value = state.uiLang;
      await applyUiLang();
      await saveState(true);
      setStatus(t('bk_loaded'));
      render();
    } catch (e) { setStatus(t('bk_bad', {e: e.message || e})); }
  });
}

