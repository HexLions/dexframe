// ---------- pages: which ones, in which order, for how long ----------
function buildPagesBox() {
  const fs = document.querySelector('fieldset[data-group="pages"]');
  if (!fs || $('pagesbox')) return;
  const box = document.createElement('div'); box.className = 'trbox'; box.id = 'pagesbox';
  box.innerHTML = '<div class="muted" id="pgInfo"></div><div class="pglist" id="pgList"></div>';
  fs.querySelector('.grid').before(box);
  renderPagesBox();
}

function renderPagesBox() {
  if (!$('pagesbox')) return;
  $('pgInfo').textContent = t('pg_info');
  const order = orderedPages();
  const changed = () => { buildTabs(); renderCollection(); renderDailyBox(); scheduleRender(); saveState(true); };
  const rows = [...order, 'daily'].map((key, i) => {
    const row = document.createElement('div'); row.className = 'pgrow';
    const lab = document.createElement('label'); lab.className = 'chk';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!state['pg_' + key]; cb.name = 'pg_' + key;
    cb.oninput = () => { state['pg_' + key] = cb.checked; changed(); };
    lab.append(cb, t('pg_' + key));
    const min = document.createElement('input'); min.type = 'number'; min.min = '0'; min.max = '1440';
    min.placeholder = String(Number(state.interval) || 0); min.title = t('pg_min'); min.setAttribute('aria-label', t('pg_min'));
    min.value = (state.pageMin || {})[key] || '';
    min.oninput = () => {
      const v = Math.max(0, Math.round(Number(min.value) || 0));
      state.pageMin = {...(state.pageMin || {})};
      if (v) state.pageMin[key] = v; else delete state.pageMin[key];
      saveState(true);
    };
    const move = (label, by) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.title = t(by < 0 ? 'up' : 'down'); b.setAttribute('aria-label', b.title);
      b.disabled = key === 'daily' || i + by < 0 || i + by >= order.length;   // the Pokémon of the day stays last
      b.onclick = () => {
        const next = [...order];
        [next[i], next[i + by]] = [next[i + by], next[i]];
        state.pageOrder = next; renderPagesBox(); changed();
      };
      return b;
    };
    const fr = document.createElement('select'); fr.title = t('pg_frame'); fr.setAttribute('aria-label', t('pg_frame'));
    fr.add(new Option(t('fr_default'), ''));
    for (const [v, txt] of frameOptions()) fr.add(new Option(txt, v));
    fr.value = (state.pageFrame || {})[key] || '';
    fr.oninput = () => {
      state.pageFrame = {...(state.pageFrame || {})};
      if (fr.value) state.pageFrame[key] = fr.value; else delete state.pageFrame[key];
      if (previewPage !== key) { previewPage = key; previewPart = 0; previewCard = null; buildTabs(); }
      scheduleRender(); saveState(true);
    };
    const show = document.createElement('button'); show.type = 'button'; show.textContent = '▶';
    show.title = t('pg_show'); show.setAttribute('aria-label', t('pg_show'));
    show.disabled = !state['pg_' + key] || !deviceInfo;
    show.onclick = () => showOnDevice(key, 0);
    row.append(lab, min, fr, show, move('▲', -1), move('▼', 1));
    return row;
  });
  $('pgList').replaceChildren(...rows);
}

// The page in the preview, as a 400x300 PNG.
function exportPng() {
  const a = document.createElement('a');
  a.download = `dexframe-${previewCard ? 'card' : previewPage}${previewPart ? '-' + (previewPart + 1) : ''}.png`;
  a.href = $('out').toDataURL('image/png');
  a.click();
}
