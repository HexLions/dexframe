// ---------- shiny hunt: the board's counter ----------
// The count lives on the board (NVS), so the button can add encounters with the web UI
// closed: Display -> Button -> "Counter +1". Here: read it, change it, set it.
function buildShinyBox() {
  const fs = document.querySelector('fieldset[data-group="shiny"]');
  if (!fs || $('shinybox')) return;
  const box = document.createElement('div'); box.className = 'trbox'; box.id = 'shinybox';
  box.innerHTML = `<div class="row" style="margin-top:0;align-items:center">
    <strong id="scVal" style="font-size:28px;min-width:3.5em"></strong>
    <button type="button" id="scMinus"></button><button type="button" class="primary" id="scPlus"></button>
    <input type="number" id="scSet" min="0" style="width:8em"><button type="button" id="scSetB"></button>
    <button type="button" id="scReset"></button></div><div class="muted" id="scInfo"></div>`;
  fs.querySelector('legend').after(box);
  $('scPlus').onclick = () => counterCall({add: 1});
  $('scMinus').onclick = () => counterCall({add: -1});
  $('scSetB').onclick = () => counterCall({set: Math.max(0, Math.round(Number($('scSet').value) || 0))});
  $('scReset').onclick = () => { if (confirm(t('sc_reset_c'))) counterCall({set: 0}); };
  renderShinyBox();
}

function renderShinyBox() {
  if (!$('shinybox')) return;
  const on = !!deviceInfo && String(deviceInfo.features || '').split(',').includes('counter');
  const v = on ? deviceInfo.counter : Number(state.shCount) || 0;
  $('scVal').textContent = fmtNum(v);
  $('scPlus').textContent = '+1'; $('scMinus').textContent = '−1';
  $('scSetB').textContent = t('sc_set'); $('scReset').textContent = t('sc_reset');
  $('scSet').placeholder = String(v);
  $('scInfo').textContent = t(on ? 'sc_info' : 'sc_nodev');
}

async function counterCall(q) {
  if (!deviceInfo) {         // no board: the count is kept in the browser and shown in the preview
    state.shCount = Math.max(0, q.set ?? (Number(state.shCount) || 0) + q.add);
    renderShinyBox(); scheduleRender(); saveState(true); return;
  }
  try {
    const r = await fetch(api('/api/counter?' + new URLSearchParams(q)), {method: 'POST'});
    if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? t('sy_key_bad') : 'HTTP ' + r.status);
    deviceInfo.counter = (await r.json()).counter;
    state.shCount = deviceInfo.counter;
    renderShinyBox(); scheduleRender();
  } catch (e) { setStatus(t('st_err', {e: e.message})); }
}
