// ---------- Pokémon picker (search by name in any language, number, generation) ----------
// Names from the game texts in pkx/<lang>.json.gz; thumbnails from PokeAPI.
async function monName(id, lang = state.dispLang) {
  const T = await pkxData(lang).catch(() => null);
  return T?.species?.[id] || speciesName(id, lang);
}
let monIndexP = null;
function monIndex() {
  monIndexP ??= Promise.all(Object.keys(LANGS).map(l => pkxData(l).catch(() => null))).then(lists => {
    const out = [];
    for (let id = 1; id <= 1025; id++) {
      const names = lists.map(T => T?.species?.[id]).filter(Boolean);
      if (names.length) out.push({id, names});
    }
    return out;
  }).catch(e => { monIndexP = null; throw e; });
  return monIndexP;
}
const GEN_RANGES = [[1, 151], [152, 251], [252, 386], [387, 493], [494, 649], [650, 721], [722, 809], [810, 905], [906, 1025]];
const genOf = id => GEN_RANGES.findIndex(([a, b]) => id >= a && id <= b) + 1;
const monPickers = [];

// cfg: {host, id, title(n), multi, max, get() -> [ids], set([ids]) }
function buildMonPicker(cfg) {
  if ($(cfg.id)) return;
  const box = document.createElement('div'); box.className = 'picker'; box.id = cfg.id;
  box.innerHTML = `${cfg.multi ? '<div class="sel"></div>' : ''}<div class="bar"><input type="search">
    <select><option value=""></option>${GEN_RANGES.map((_, i) => `<option value="${i + 1}">Gen ${i + 1}</option>`).join('')}</select></div>
    <div class="count"></div><div class="res"></div>`;
  cfg.host.append(box);
  const [q, g] = [box.querySelector('input'), box.querySelector('select')];
  q.placeholder = t('mon_search'); g.options[0].text = t('mon_allgen');
  q.addEventListener('input', () => renderMonPicker(cfg)); g.addEventListener('input', () => renderMonPicker(cfg));
  cfg.box = box;
  monPickers.push(cfg);
  renderMonPicker(cfg);
}
const monLabel = async id => `#${String(id).padStart(4, '0')} ${await monName(id, state.uiLang)}`;
async function renderMonPicker(cfg) {
  if (!cfg.box?.isConnected) return;
  const box = cfg.box, sel = cfg.get();
  if (cfg.multi) {
    const h = document.createElement('h4'); h.textContent = cfg.title(sel.length);
    const rows = await Promise.all(sel.map(async (id, i) => {
      const row = document.createElement('div'); row.className = 'row';
      const img = document.createElement('img'); img.alt = ''; img.src = pokeThumb(id);
      const lab = document.createElement('span'); lab.style.flex = '1'; lab.textContent = await monLabel(id);
      const btn = (txt, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.onclick = fn; return b; };
      const move = dlt => () => { const n = [...sel]; const j = i + dlt; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; cfg.set(n); };
      row.append(img, lab, btn('↑', move(-1)), btn('↓', move(1)), btn('✕', () => cfg.set(sel.filter((_, k) => k !== i))));
      return row;
    }));
    if (!rows.length) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = t('team_empty'); rows.push(e); }
    box.querySelector('.sel').replaceChildren(h, ...rows);
  }
  let list;
  try { list = await monIndex(); } catch { list = []; }
  const q = box.querySelector('input').value.trim().toLowerCase(), g = Number(box.querySelector('select').value);
  const num = /^#?\d+$/.test(q) ? Number(q.replace('#', '')) : null;
  const hits = list.filter(e => (!g || genOf(e.id) === g) &&
    (!q || (num != null ? String(e.id).startsWith(String(num)) : e.names.some(n => n.toLowerCase().includes(q)))));
  box.querySelector('.count').textContent = cfg.multi ? t('mon_count_multi', {n: hits.length, m: cfg.max}) : t('mon_count', {n: hits.length});
  box.querySelector('.res').replaceChildren(...hits.slice(0, 120).map(e => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'it' + (sel.includes(e.id) ? ' on' : '');
    const img = document.createElement('img'); img.src = pokeThumb(e.id); img.alt = ''; img.loading = 'lazy';
    const lab = document.createElement('span');
    const name = e.names[Object.keys(LANGS).indexOf(state.uiLang)] || e.names[0];
    lab.textContent = name;
    const sm = document.createElement('small'); sm.textContent = `#${String(e.id).padStart(4, '0')} · gen ${genOf(e.id)}`;
    lab.append(sm); b.append(img, lab);
    b.onclick = () => {
      if (!cfg.multi) return cfg.set([e.id]);
      const cur = cfg.get();
      if (cur.includes(e.id)) cfg.set(cur.filter(x => x !== e.id));
      else if (cur.length < cfg.max) cfg.set([...cur, e.id]);
    };
    return b;
  }));
}
function renderMonPickers() { monPickers.forEach(renderMonPicker); renderStyleBox(); }

function wrapDetails(fs, id, summary, open) {
  const det = document.createElement('details'); det.className = 'adv'; det.id = id; det.open = !!open;
  const sum = document.createElement('summary'); sum.textContent = summary; det.append(sum);
  fs.querySelector('.grid').after(det);
  return det;
}
function buildMonPickerBoxes() {
  monPickers.length = 0;
  const fsP = document.querySelector('fieldset[data-group="pokemon"]');
  if (fsP && !$('mpMain')) {
    const det = wrapDetails(fsP, 'mpMainBox', t('mon_pick'));
    buildMonPicker({host: det, id: 'mpMain', get: () => [Number(state.dex)], set: async ([id]) => {
      state.dex = id; state.name = await monName(id, state.dispLang);
      await autofill();                     // types (and the localized name) from PokeAPI
      $('mpMainBox') && ($('mpMainBox').open = true);
    }});
  }
  const fsT = document.querySelector('fieldset[data-group="trainer"]');
  if (fsT && !$('mpTeam')) {
    const host = document.createElement('div'); host.className = 'trbox';
    fsT.querySelector('.grid').after(host);
    buildMonPicker({host, id: 'mpTeam', multi: true, max: 6, title: n => t('team_title', {n}), get: () => teamIds(state),
      set: ids => { state.team = ids.join(', '); syncField('team'); renderMonPickers(); renderHofBox(); scheduleRender(); }});
  }
  const fsH = document.querySelector('fieldset[data-group="hof"]');
  if (fsH && !$('mpHof')) {
    const host = document.createElement('div'); host.className = 'trbox';
    host.innerHTML = `<label class="chk"><input type="checkbox" id="hofFollow"> <span id="hofFollowL"></span></label>`;
    fsH.querySelector('.grid').after(host);
    $('hofFollowL').textContent = t('hof_follow');
    $('hofFollow').checked = !dexList(state.hofTeam).length;
    $('hofFollow').addEventListener('input', () => {
      state.hofTeam = $('hofFollow').checked ? '' : teamIds(state).join(', ');
      renderMonPickers(); scheduleRender();
    });
    buildMonPicker({host, id: 'mpHof', multi: true, max: 6, title: n => t('hof_title', {n}), get: () => hofIds(state),
      set: ids => { state.hofTeam = ids.join(', '); $('hofFollow').checked = false; renderMonPickers(); scheduleRender(); }});
  }
}

