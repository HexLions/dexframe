// ---------- sprite style gallery ----------
function buildStyleBox() {
  const fs = document.querySelector('fieldset[data-group="display"]');
  if (!fs || $('stbox')) return;
  const box = document.createElement('div'); box.className = 'picker'; box.id = 'stbox';
  box.innerHTML = `<h4 style="margin:0;font-size:13px" id="stT"></h4><div class="res" id="stRes" style="grid-template-columns:repeat(auto-fill,minmax(112px,1fr));max-height:none"></div>`;
  fs.querySelector('.grid').after(box);
  $('stT').textContent = t('st_title');
  renderStyleBox();
}
function renderStyleBox() {
  if (!$('stbox')) return;
  const id = Number(state.dex) || 1;
  $('stRes').replaceChildren(...Object.entries(SPRITES).map(([k, sp]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'it' + (state.style === k ? ' on' : '');
    b.style.cssText = 'flex-direction:column;align-items:center;text-align:center';
    const img = document.createElement('img'); img.alt = ''; img.loading = 'lazy';
    img.src = spriteUrl(k, id, state.shiny); img.style.cssText = 'width:80px;height:80px;object-fit:contain;image-rendering:pixelated;background:#fff';
    const lab = document.createElement('span'); lab.textContent = t('sp_' + k);
    const sm = document.createElement('small'); sm.textContent = `gen ${sp.gen}` + (id > sp.max ? ' · ' + t('st_max', {n: sp.max}) : '');
    lab.append(sm); b.append(img, lab);
    b.onclick = () => { state.style = k; syncField('style'); renderStyleBox(); scheduleRender(); };
    return b;
  }));
}

