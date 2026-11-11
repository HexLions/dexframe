// ---------- form ----------
function buildForm() {
  const form = $('form');
  form.innerHTML = '';
  for (const [gid, fields] of GROUPS) {
    const fs = document.createElement('fieldset');
    const lg = document.createElement('legend'); lg.textContent = t('g_' + gid); fs.append(lg);
    fs.dataset.group = gid;
    const grid = document.createElement('div'); grid.className = 'grid';
    let advGrid = null;
    for (const [key, labelKey, type = 'text', opts] of fields) {
      const label = Array.isArray(labelKey) ? t(...labelKey) : t(labelKey);
      const lab = document.createElement('label');
      let el;
      if (type === 'select') {
        el = document.createElement('select');
        for (const [v, txt] of opts()) el.add(new Option(txt, v));
        el.value = state[key];
      } else if (type === 'textarea') {
        el = document.createElement('textarea');
        el.value = state[key] ?? '';
        lab.className = 'wide';
      } else {
        el = document.createElement('input');
        el.type = type;
        if (type === 'checkbox') { el.checked = !!state[key]; lab.className = 'chk'; if (opts === 'wide') lab.classList.add('wide'); }
        else el.value = state[key] ?? '';
        if (opts === 'wide' || opts === 'adv') lab.classList.add('wide');
      }
      if (type === 'textarea') lab.classList.add('wide');
      el.name = key;
      if (key === 'panel' && deviceInfo) el.disabled = true;  // detected from firmware
      if (key === 'panel') [...el.options].forEach(o => { if (PANELS[o.value]?.previewOnly) o.remove(); });
      if (key === 'batLow') { el.step = '0.05'; el.min = '3'; el.max = '4.2'; }
      if (key === 'deviceUrl') el.addEventListener('change', async () => {
        try { localStorage.setItem('dexframe', JSON.stringify(state)); } catch {}   // detectDevice re-reads it
        await detectDevice(); migrate(state);
        if (deviceInfo) { setConnected(); await applyUiLang(); render(); } else setStatus(t('st_preview'));
        try { localStorage.setItem('dexframe', JSON.stringify(state)); } catch {}
      });
      el.addEventListener('input', () => {
        state[key] = type === 'checkbox' ? el.checked : type === 'number' || ['teamPer', 'btnDouble', 'btnLong'].includes(key) ? Number(el.value) : el.value;
        if (key.startsWith('pg_') || ['colRotation', 'dailyCount', 'style', 'teamPer', 'team', 'hofTeam'].includes(key)) { buildTabs(); renderCollection(); renderDailyBox(); }
        if (key === 'dispLang' || key === 'ribbons') renderPicker();   // names follow the display language
        if (key === 'trBase' || key === 'trFile') renderTrainerPicker();
        if (key === 'team' || key === 'dex' || key === 'style' || key === 'shiny' || key === 'dispLang') renderMonPickers();
        scheduleRender();
      });
      if (type === 'checkbox') lab.append(el, label); else lab.append(label, el);
      if (opts === 'adv') {
        if (!advGrid) {
          const det = document.createElement('details'); det.className = 'adv';
          const sum = document.createElement('summary'); sum.textContent = t('adv');
          advGrid = document.createElement('div'); advGrid.className = 'grid';
          det.append(sum, advGrid); fs.adv = det;
        }
        advGrid.append(lab);
      } else grid.append(lab);
    }
    fs.append(grid);
    if (fs.adv) fs.append(fs.adv);
    form.append(fs);
  }
}

