// ---------- Showdown import ----------
// Export format: "Nick (Species) (M) @ Item", "Ability: X", "Level: 50", "Shiny: Yes",
// "EVs: 252 HP / 4 Def", "Modest Nature", "IVs: 0 Atk", "- Move" (one per line).
function parseShowdown(txt) {
  const lines = String(txt).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error('—');
  let first = lines[0], item = '', gender = '', nick = '', species;
  const at = first.lastIndexOf(' @ ');
  if (at >= 0) { item = first.slice(at + 3).trim(); first = first.slice(0, at).trim(); }
  const g = first.match(/\s*\((M|F)\)$/);
  if (g) { gender = g[1]; first = first.slice(0, g.index).trim(); }
  const pm = first.match(/^(.*\S)\s*\(([^()]+)\)$/);
  if (pm) { nick = pm[1].trim(); species = pm[2].trim(); } else species = first;
  const set = {nick, species, item, gender, level: 100, shiny: false, ability: '', nature: '', evs: {}, ivs: {}, moves: []};
  for (const l of lines.slice(1)) {
    let m;
    if ((m = l.match(/^Ability:\s*(.+)$/i))) set.ability = m[1].trim();
    else if ((m = l.match(/^Level:\s*(\d+)/i))) set.level = Math.max(1, Math.min(100, +m[1]));
    else if (/^Shiny:\s*Yes/i.test(l)) set.shiny = true;
    else if ((m = l.match(/^(EVs|IVs):\s*(.+)$/i))) {
      for (const part of m[2].split('/')) {
        const q = part.trim().match(/^(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/i);
        if (q) set[m[1].toLowerCase()][q[2].toLowerCase()] = +q[1];
      }
    } else if ((m = l.match(/^([A-Za-z]+)\s+Nature$/i))) set.nature = m[1];
    else if ((m = l.match(/^[-~]\s*(.+)$/))) set.moves.push(m[1].replace(/\s*\[.*\]\s*$/, '').trim());
  }
  return set;
}
const sdSlug = n => String(n).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/♀/g, '-f').replace(/♂/g, '-m').replace(/[’'.:%]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
// Showdown stat key -> [PokeAPI stat name, DexFrame field]
const SD_STATS = {hp: ['hp', 'ps'], atk: ['attack', 'att'], def: ['defense', 'dif'], spa: ['special-attack', 'atsp'], spd: ['special-defense', 'dfsp'], spe: ['speed', 'vel']};
function calcStats(baseByName, set, natureJ) {
  const L = set.level, out = {};
  const inc = natureJ?.increased_stat?.name, dec = natureJ?.decreased_stat?.name;
  for (const [k, [name, field]] of Object.entries(SD_STATS)) {
    const B = baseByName[name] || 0, iv = set.ivs[k] ?? 31, ev = set.evs[k] ?? 0;
    const core = Math.floor((2 * B + iv + Math.floor(ev / 4)) * L / 100);
    if (k === 'hp') out[field] = B === 1 ? 1 : core + L + 10;       // Shedinja
    else out[field] = Math.floor((core + 5) * (name === inc && inc !== dec ? 1.1 : name === dec && inc !== dec ? 0.9 : 1));
  }
  return out;
}
async function importShowdown(txt) {
  const set = parseShowdown(txt), lang = state.dispLang;
  const p = await pj('pokemon/' + sdSlug(set.species));
  const opt = path => path ? pj(path).catch(() => null) : Promise.resolve(null);
  const [sp, ab, na, it, ...mv] = await Promise.all([
    pj(p.species.url), opt(set.ability && 'ability/' + sdSlug(set.ability)), opt(set.nature && 'nature/' + sdSlug(set.nature)),
    opt(set.item && 'item/' + sdSlug(set.item)), ...set.moves.slice(0, 4).map(m => opt('move/' + sdSlug(m)))]);
  const base = Object.fromEntries(p.stats.map(x => [x.stat.name, x.base_stat]));
  const types = p.types.sort((a, b) => a.slot - b.slot).map(x => typeKey(x.type.name));
  Object.assign(state, calcStats(base, set, na), {
    dex: sp.id, name: set.nick || locName(sp, lang), level: set.level, shiny: set.shiny,
    gender: set.gender || (sp.gender_rate === -1 ? '-' : state.gender),
    type1: types[0] || '', type2: types[1] || '',
    ability: ab ? locName(ab, lang) : set.ability, nature: na ? locName(na, lang) : set.nature,
    item: it ? locName(it, lang) : set.item,
  });
  for (let i = 0; i < 4; i++) {
    state['move' + i] = mv[i] ? locName(mv[i], lang) : (set.moves[i] || '');
    state['mtype' + i] = mv[i] ? typeKey(mv[i].type.name) : (set.moves[i] ? state['mtype' + i] : '');
  }
  return state.name;
}
function buildShowdownBox() {
  const fs = document.querySelector('fieldset[data-group="pokemon"]');
  if (!fs || $('sdbox')) return;
  const det = document.createElement('details'); det.className = 'adv'; det.id = 'sdbox';
  det.innerHTML = `<summary></summary><div class="trbox"><div class="muted" id="sdInfo"></div>
    <textarea id="sdTxt" spellcheck="false"></textarea><div class="row" style="margin-top:0"><button type="button" class="primary" id="sdGo"></button></div></div>`;
  fs.querySelector('.grid').after(det);
  det.querySelector('summary').textContent = t('sd_title');
  $('sdInfo').textContent = t('sd_info');
  $('sdTxt').placeholder = t('sd_ph') + '\n\nEmpoleon @ Leftovers\nAbility: Torrent\nLevel: 100\nEVs: 252 HP / 252 SpA / 4 SpD\nModest Nature\n- Surf\n- Ice Beam\n- Grass Knot\n- Roost';
  $('sdGo').textContent = t('sd_go');
  $('sdGo').onclick = async () => {
    setStatus(t('sd_busy'));
    try {
      const name = await importShowdown($('sdTxt').value);
      const keep = $('sdTxt').value;
      await applyUiLang(); showSection('pokemon', false);
      $('sdTxt').value = keep; $('sdbox').open = true;
      render(); setStatus(t('sd_ok', {n: name}));
    } catch (e) { setStatus(t('sd_err', {e: e.message || e})); }
  };
}

