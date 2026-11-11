// ---------- system: firmware / web UI update, key ----------
function xhrUpload(url, file, field, onProgress) {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest(), fd = new FormData();
    fd.append(field, file, file.name);
    x.open('POST', url);
    if (onProgress) x.upload.onprogress = e => onProgress(e.loaded / (e.total || 1));
    x.onload = () => x.status < 300 ? res(x.responseText)
      : rej(new Error(x.status === 403 ? t('sy_key_bad') : `HTTP ${x.status} ${x.responseText}`));
    x.onerror = () => rej(new Error('network'));
    x.send(fd);
  });
}
function buildSystemBox() {
  const fs = document.querySelector('fieldset[data-group="system"]');
  if (!fs || $('sysbox')) return;
  const box = document.createElement('div'); box.className = 'trbox'; box.id = 'sysbox';
  const btn = 'padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg)';
  box.innerHTML = `<div class="muted" id="syInfo"></div>
    <label><span id="syKeyL"></span><input type="password" id="syKey" autocomplete="off"></label>
    <div class="muted" id="syFwI"></div>
    <div class="row" style="margin-top:0"><label class="chk" style="cursor:pointer"><input type="file" id="syFw" accept=".bin" hidden><span id="syFwB" style="${btn}"></span></label></div>
    <div class="muted" id="syUiI"></div>
    <div class="row" style="margin-top:0"><label class="chk" style="cursor:pointer"><input type="file" id="syUi" webkitdirectory multiple hidden><span id="syUiB" style="${btn}"></span></label></div>
    <progress id="syProg" max="1" value="0" hidden style="width:100%"></progress>
    <div class="row" style="margin-top:0"><a id="sySetup" target="_blank" rel="noopener"></a><button type="button" id="syReboot"></button></div>
    <h4 style="margin:10px 0 0;font-size:13px" id="syWifiT"></h4>
    <div class="row" style="margin-top:0"><button type="button" id="syScan"></button><span class="muted" id="syWifiCur"></span></div>
    <div class="coll" id="syNets"></div>
    <label><span id="sySsidL"></span><input id="sySsid" autocomplete="off"></label>
    <label><span id="syPassL"></span><input id="syPass" type="password" autocomplete="off"></label>
    <div class="row" style="margin-top:0"><button type="button" class="primary" id="syWifiSave"></button></div>
    <h4 style="margin:10px 0 0;font-size:13px" id="syResetT"></h4>
    <div class="muted" id="syResetI"></div>
    <div class="row" style="margin-top:0"><button type="button" id="syReset" style="border-color:#c33;color:#c33"></button></div>`;
  fs.querySelector('.grid').after(box);
  $('syKeyL').textContent = t('sy_key'); $('syFwI').textContent = t('sy_fw_info'); $('syUiI').textContent = t('sy_ui_info');
  $('syFwB').textContent = t('sy_fw'); $('syUiB').textContent = t('sy_ui'); $('sySetup').textContent = t('sy_setup'); $('syReboot').textContent = t('sy_reboot');
  $('syKey').value = deviceKey();
  $('syWifiT').textContent = t('sy_wifi'); $('syScan').textContent = t('sy_scan'); $('sySsidL').textContent = t('sy_ssid');
  $('syPassL').textContent = t('sy_pass'); $('syWifiSave').textContent = t('sy_wsave');
  $('syResetT').textContent = t('sy_reset_t'); $('syResetI').textContent = t('sy_reset_i'); $('syReset').textContent = t('sy_reset');
  $('syScan').onclick = async () => {
    if (!deviceInfo) return setStatus(t('sy_nodev'));
    $('syNets').textContent = t('sy_scanning');
    try {
      const nets = await (await fetch(devPath('/api/wifi/scan'))).json();
      $('syNets').replaceChildren(...nets.map(n => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'card';
        b.textContent = `${n.secure ? '🔒 ' : ''}${n.ssid} · ${n.rssi} dBm`;
        b.onclick = () => { $('sySsid').value = n.ssid; $('syPass').focus(); };
        return b;
      }));
    } catch (e) { $('syNets').textContent = t('sy_err', {e: e.message}); }
  };
  $('syWifiSave').onclick = async () => {
    if (!deviceInfo) return setStatus(t('sy_nodev'));
    const ssid = $('sySsid').value.trim();
    if (!ssid) return;
    if (!confirm(t('sy_wconfirm', {n: ssid}))) return;
    const r = await fetch(api('/api/wifi?' + new URLSearchParams({ssid, pass: $('syPass').value, host: deviceInfo.host || 'dexframe'})), {method: 'POST'});
    setStatus(r.ok ? t('sy_wsaved', {n: ssid}) : r.status === 403 ? t('sy_key_bad') : t('sy_err', {e: r.status}));
  };
  $('syReset').onclick = async () => {
    if (!deviceInfo) return setStatus(t('sy_nodev'));
    if (!confirm(t('sy_reset_c1')) || prompt(t('sy_reset_c2')) !== 'RESET') return;
    const r = await fetch(api('/api/reset?confirm=RESET'), {method: 'POST'});
    setStatus(r.ok ? t('sy_reset_ok') : r.status === 403 ? t('sy_key_bad') : r.status === 404 ? t('sy_old_fw') : t('sy_err', {e: r.status}));
  };
  $('syKey').addEventListener('change', () => { try { localStorage.setItem('dexframe-key', $('syKey').value); } catch {} });
  $('syReboot').onclick = async () => { if (!deviceInfo) return setStatus(t('sy_nodev')); const r = await fetch(api('/api/reboot'), {method: 'POST'}); setStatus(r.ok ? '↻' : t('sy_err', {e: r.status})); };
  const prog = v => { $('syProg').hidden = v == null; $('syProg').value = v ?? 0; };
  $('syFw').addEventListener('change', async ev => {
    const f = ev.target.files?.[0]; ev.target.value = '';
    if (!f) return;
    if (!deviceInfo) return setStatus(t('sy_nodev'));
    try {
      setStatus(t('sy_sending', {f: f.name, i: 1, n: 1}));
      await xhrUpload(api('/api/ota'), f, 'firmware', prog);
      setStatus(t('sy_fw_ok'));
    } catch (e) { setStatus(t('sy_err', {e: e.message})); }
    prog(null);
  });
  $('syUi').addEventListener('change', async ev => {
    const files = [...(ev.target.files || [])].filter(f => !/(^|\/)\./.test(f.webkitRelativePath));
    ev.target.value = '';
    if (!files.length) return;
    if (!deviceInfo) return setStatus(t('sy_nodev'));
    // index.html last: if something fails halfway, the page you are using still works
    files.sort((a, b) => (a.webkitRelativePath.endsWith('/index.html') ? 1 : 0) - (b.webkitRelativePath.endsWith('/index.html') ? 1 : 0));
    try {
      for (let i = 0; i < files.length; i++) {
        const rel = files[i].webkitRelativePath.split('/').slice(1).join('/');
        setStatus(t('sy_sending', {f: rel, i: i + 1, n: files.length}));
        await xhrUpload(api('/api/fs?path=' + encodeURIComponent('/www/' + rel)), files[i], 'file');
        prog((i + 1) / files.length);
      }
      setStatus(t('sy_ui_ok', {n: files.length}));
    } catch (e) { setStatus(t('sy_err', {e: e.message})); }
    prog(null);
  });
  renderSystemBox();
}
function renderSystemBox() {
  if (!$('sysbox')) return;
  const i = deviceInfo;
  if ($('syWifiCur')) $('syWifiCur').textContent = i ? (i.ap ? 'DexFrame-Setup' : t('sy_wcur', {n: i.ssid || '—'})) : '';
  $('syInfo').textContent = i ? t('sy_info', {v: i.version || '<1.3', u: Math.round((i.fsUsed || 0) / 1024), t: Math.round((i.fsTotal || 0) / 1024),
    w: i.ap ? 'DexFrame-Setup' : (i.ssid || '—'), k: i.keySet ? t('sy_key_on') : ''}) : t('sy_nodev');
  const setup = api('/setup');
  $('sySetup').style.display = i && setup ? '' : 'none';
  if (setup) $('sySetup').href = setup.replace(/[?&]key=[^&]*/, '');
}

// Uploaded image -> cropped, block-averaged to at most 96px, stored as a PNG data URL
// (small enough to live in the saved state on the ESP32).
async function onTrainerUpload(ev) {
  const f = ev.target.files?.[0]; ev.target.value = '';
  if (!f) return;
  try {
    const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
    const img = await loadLocalImage(url);
    const sp = img && spritePixels(img);
    if (!sp) throw new Error();
    const fp = fitPixels(sp, 96);
    const c = document.createElement('canvas'); c.width = fp.w; c.height = fp.h;
    const x = c.getContext('2d'), id = x.createImageData(fp.w, fp.h);
    for (let yy = 0; yy < fp.h; yy++) for (let xx = 0; xx < fp.w; xx++) id.data.set(fp.at(xx, yy), (yy * fp.w + xx) * 4);
    x.putImageData(id, 0, 0);
    state.trImage = c.toDataURL('image/png'); state.trSprite = '';
    renderTrainerPicker(); scheduleRender();
  } catch { setStatus(t('tr_bad')); }
}

// Shows which ribbon images were found, and the file name each one expects.
async function updateRibbonHint() {
  const fs = document.querySelector('fieldset[data-group="ribbons"]');
  if (!fs) return;
  let hint = $('ribbonHint');
  if (!hint) {
    hint = document.createElement('div'); hint.id = 'ribbonHint';
    hint.style.cssText = 'font-size:12px;color:var(--muted);margin-top:8px;line-height:1.6';
    (fs.querySelector('details.adv') || fs).append(hint);
  }
  const names = PAGES.ribbons.list(state);
  const byFile = new Map((await loadLegend()).map(e => [e.png, e]));
  names.forEach(r => { r.name = autoRibbonName(r, byFile); });
  const found = await Promise.all(names.map(ribbonImage));
  hint.replaceChildren(document.createTextNode(t('hint')));
  found.forEach(({url, img}, i) => {
    const row = document.createElement('div');
    row.textContent = `${img ? '✓' : '✗'} ${names[i].name} → ${url.startsWith('data:') ? (`${names[i].file} (${t('embedded')})`) : url}${img ? ` (${img.naturalWidth}×${img.naturalHeight})` : ''}`;
    hint.append(row);
  });
}

async function render() {
  const seq = ++renderSeq;
  updateRibbonHint();
  renderTrainerPicker();
  renderHofBox();
  renderPicker();
  renderCollection();
  try {
    // "Preview colours": draw the preview for another panel; what is sent follows the display.
    const pv = state.previewPanel && PANELS[state.previewPanel] ? {panel: state.previewPanel} : null;
    const idx = pv && !previewCard ? rotationIndex(previewPage, previewPart) : undefined;
    const ink = previewCard ? await renderPage('cover', {...state, ...previewCard.data, ...pv})
      : await renderPage(previewPage, pv ? {...state, ...pv} : state, idx, pv ? totalEntries() : undefined, previewPart);
    if (seq === renderSeq) showInk(ink);
  } catch (e) { setStatus(e.message); }
}

