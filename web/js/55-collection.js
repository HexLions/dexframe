// ---------- collection: saved Pokémon cards ----------
function buildCollectionBox() {
  const fs = document.querySelector('fieldset[data-group="collection"]');
  if (!fs || $('colbox')) return;
  const box = document.createElement('div'); box.className = 'trbox'; box.id = 'colbox';
  box.innerHTML = `<div class="muted" id="colInfo"></div>
    <div class="row" style="margin-top:0"><button type="button" class="primary" id="colSave"></button></div>
    <div class="coll" id="colList"></div>`;
  fs.querySelector('.grid').after(box);
  $('colSave').textContent = t('col_save');
  $('colSave').onclick = () => {
    const card = {id: Date.now().toString(36), data: cardData()};
    state.collection = [...(state.collection || []), card];
    renderCollection(); buildTabs(); saveState(true);
    setStatus(t('col_saved', {n: state.name}));
  };
  renderCollection();
}

function renderCollection() {
  if (!$('colbox')) return;
  const list = state.collection || [];
  const max = deviceInfo ? (deviceInfo.api >= 2 ? deviceInfo.maxSlots : deviceInfo.slotsFit ?? deviceInfo.maxSlots ?? 8) : 28;
  $('colInfo').textContent = t('col_info', {n: list.length, p: rotationPlan().length, d: state.pg_daily ? dailyN() : 0, m: max});
  const btn = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = fn; return b; };
  const commit = next => { state.collection = next; renderCollection(); buildTabs(); scheduleRender(); saveState(true); };
  const rows = list.map((card, i) => {
    const row = document.createElement('div'); row.className = 'card';
    const img = document.createElement('img'); img.alt = ''; img.src = iconUrl(card.data.dex);
    const lab = document.createElement('span');
    lab.textContent = `${card.data.name} · Lv.${card.data.level} · #${card.data.dex}${sameCard(card.data, state) ? ' ✎' : ''}`;
    const move = dlt => () => { const n = [...list]; const j = i + dlt; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; commit(n); };
    row.append(img, lab,
      btn(t('col_preview'), () => { previewCard = card; buildTabs(); render(); }),
      btn(t('col_load'), async () => {
        Object.assign(state, card.data); previewCard = null; previewPage = activePages()[0] || 'cover';
        await applyUiLang(); showSection('pokemon', false); render();
        setStatus(t('col_loaded', {n: card.data.name}));
      }),
      btn(t('col_update'), () => {
        const n = [...list]; n[i] = {...card, data: cardData()}; commit(n);
        setStatus(t('col_upd', {n: state.name}));
      }),
      btn('↑', move(-1)), btn('↓', move(1)),
      btn('✕', () => { if (confirm(t('col_confirm', {n: card.data.name}))) { if (previewCard === card) previewCard = null; commit(list.filter(c => c !== card)); } }));
    return row;
  });
  if (!rows.length) { const e = document.createElement('div'); e.className = 'muted'; e.textContent = t('col_empty'); rows.push(e); }
  $('colList').replaceChildren(...rows);
}

