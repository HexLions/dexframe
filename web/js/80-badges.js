// ---------- badges: region + icons ----------
function buildBadgeBox() {
  const fs = document.querySelector('fieldset[data-group="trainer"]');
  if (!fs || $('bdbox')) return;
  const box = document.createElement('div'); box.className = 'picker'; box.id = 'bdbox';
  box.innerHTML = `<h4 style="margin:0;font-size:13px" id="bdT"></h4><div class="bar"><select id="bdR">${Object.keys(BADGES).map(r => `<option value="${r}"></option>`).join('')}</select>
    <button type="button" id="bdClr"></button></div><div class="muted" id="bdN"></div><div class="res" id="bdRes" style="grid-template-columns:repeat(auto-fill,minmax(64px,1fr))"></div>`;
  fs.querySelector('.grid').after(box);
  [...$('bdR').options].forEach(o => { o.text = t('rg_' + o.value); });
  $('bdR').value = state.trRegion in BADGES ? state.trRegion : 'kanto';
  $('bdClr').textContent = t('bd_clear');
  $('bdR').addEventListener('input', () => { state.trRegion = $('bdR').value; renderBadgeBox(); });
  $('bdClr').onclick = () => { state.trBadgeIds = ''; renderBadgeBox(); scheduleRender(); };
  renderBadgeBox();
}
function renderBadgeBox() {
  if (!$('bdbox')) return;
  const sel = badgeIds(state), reg = BADGES[state.trRegion] || BADGES.kanto;
  $('bdT').textContent = t('bd_title', {n: sel.length});
  $('bdN').textContent = sel.length ? '' : t('bd_none', {n: Number(state.trBadges) || 0});
  $('bdRes').replaceChildren(...reg.ids.map((id, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'it' + (sel.includes(id) ? ' on' : '');
    b.style.cssText = 'flex-direction:column;justify-content:center;padding:4px';
    const img = document.createElement('img'); img.src = badgeUrl(id); img.alt = ''; img.loading = 'lazy';
    img.style.cssText = 'width:44px;height:44px;object-fit:contain;background:#fff;border-radius:4px';
    b.title = reg.names[i] || `#${id}`;
    const lab = document.createElement('small'); lab.textContent = reg.names[i] || `#${id}`;
    b.append(img, lab);
    b.onclick = () => {
      const cur = badgeIds(state);
      const next = cur.includes(id) ? cur.filter(x => x !== id) : cur.length < 8 ? [...cur, id] : cur;
      // keep the region order
      const order = Object.values(BADGES).flatMap(r => r.ids);
      state.trBadgeIds = next.sort((a, c) => order.indexOf(a) - order.indexOf(c)).join(',');
      renderBadgeBox(); scheduleRender();
    };
    return b;
  }));
}

