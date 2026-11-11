// ---------- import from PKHeX files (.pk4 .pk5 .pk6 .pk7 .pk8 .pk9) ----------
// Formats, offsets, ribbon bits and game texts come from PKHeX (GPL-3.0) via
// tools/build_pkx_data.py -> pkx/core.json.gz, pkx/<lang>.json.gz.
const pkxCache = new Map();
function pkxData(name) {
  if (!pkxCache.has(name)) pkxCache.set(name, (async () => {
    if (EMBED?.pkx?.[name]) return EMBED.pkx[name];
    try {                               // the ESP32 serves name.json from name.json.gz (Content-Encoding)
      const r = await fetch(`pkx/${name}.json`);
      if (r.ok) return await r.json();
    } catch {}
    const r = await fetch(`pkx/${name}.json.gz`);     // plain static server: unpack here
    if (!r.ok) throw new Error(`pkx/${name}.json.gz: HTTP ${r.status}`);
    return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();
  })().catch(e => { pkxCache.delete(name); throw e; }));
  return pkxCache.get(name);
}

const PKX_BLOCK_POS = [0,1,2,3, 0,1,3,2, 0,2,1,3, 0,3,1,2, 0,2,3,1, 0,3,2,1, 1,0,2,3, 1,0,3,2,
  2,0,1,3, 3,0,1,2, 2,0,3,1, 3,0,2,1, 1,2,0,3, 1,3,0,2, 2,1,0,3, 3,1,0,2,
  2,3,0,1, 3,2,0,1, 1,2,3,0, 1,3,2,0, 2,1,3,0, 3,1,2,0, 2,3,1,0, 3,2,1,0,
  0,1,2,3, 0,1,3,2, 0,2,1,3, 0,3,1,2, 0,2,3,1, 0,3,2,1, 1,0,2,3, 1,0,3,2];
// stored size, party size, block size, where the party stats start
const PKX_FMT = {
  pk4: {stored: 136, party: 236, block: 32, gen: 4},
  pk5: {stored: 136, party: 220, block: 32, gen: 5},
  pk6: {stored: 0xE8, party: 0x104, block: 56, gen: 6},
  pk7: {stored: 0xE8, party: 0x104, block: 56, gen: 7},
  pk8: {stored: 0x148, party: 0x158, block: 80, gen: 8},
  pk9: {stored: 0x148, party: 0x158, block: 80, gen: 9},
};
const u16 = (d, o) => d[o] | (d[o + 1] << 8);
const u32 = (d, o) => (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;
function pkxCrypt(d, start, end, seed) {
  for (let i = start; i + 1 < end; i += 2) {
    seed = (Math.imul(0x41C64E6D, seed) + 0x6073) >>> 0;
    d[i] ^= (seed >>> 16) & 0xFF; d[i + 1] ^= seed >>> 24;
  }
}
// Decrypts in place if needed (same checks as PKHeX PokeCrypto.DecryptIfEncrypted*).
function pkxDecrypt(d, fmt) {
  const f = PKX_FMT[fmt], pv = u32(d, 0);
  const encrypted = f.gen <= 5 ? u32(d, 0x64) !== 0 : f.gen <= 7 ? (u16(d, 0xC8) || u16(d, 0x58)) !== 0 : (u16(d, 0x70) || u16(d, 0x110)) !== 0;
  if (!encrypted) return d;
  pkxCrypt(d, 8, f.stored, f.gen <= 5 ? u16(d, 6) : pv);
  if (d.length > f.stored) pkxCrypt(d, f.stored, d.length, pv);
  const sv = (pv >> 13) & 31, src = d.slice(8, 8 + 4 * f.block);
  for (let i = 0; i < 4; i++) {
    const from = PKX_BLOCK_POS[sv * 4 + i];
    d.set(src.subarray(from * f.block, (from + 1) * f.block), 8 + i * f.block);
  }
  return d;
}
function pkxString(d, off, bytes, g4chars) {
  let out = '';
  for (let i = off; i < off + bytes; i += 2) {
    const v = u16(d, i);
    if (v === 0xFFFF || v === 0) break;
    const c = g4chars ? (g4chars[v] ?? 0xFFFF) : v;
    if (c === 0xFFFF) continue;
    out += c === 0x246D ? '♂' : c === 0x246E ? '♀' : String.fromCharCode(c);
  }
  return out.trim();
}
const PKX_LANG = {1: 'JPN', 2: 'ENG', 3: 'FRE', 4: 'ITA', 5: 'GER', 7: 'SPA', 8: 'KOR', 9: 'CHS', 10: 'CHT'};
const PKX_REGION = {1: 'Hoenn', 2: 'Hoenn', 3: 'Hoenn', 4: 'Kanto', 5: 'Kanto', 15: 'Orre', 7: 'Johto', 8: 'Johto',
  10: 'Sinnoh', 11: 'Sinnoh', 12: 'Sinnoh', 20: 'Unima', 21: 'Unima', 22: 'Unima', 23: 'Unima', 24: 'Kalos', 25: 'Kalos',
  26: 'Hoenn', 27: 'Hoenn', 30: 'Alola', 31: 'Alola', 32: 'Alola', 33: 'Alola', 35: 'Kanto', 36: 'Kanto', 37: 'Kanto',
  38: 'Kanto', 39: 'Johto', 40: 'Johto', 41: 'Johto', 42: 'Kanto', 43: 'Kanto', 44: 'Galar', 45: 'Galar', 47: 'Hisui',
  48: 'Sinnoh', 49: 'Sinnoh', 50: 'Paldea', 51: 'Paldea', 52: 'Kalos'};
const PKX_REGION_EN = {Unima: 'Unova'};

// Raw fields, independent of the language.
function pkxRead(buf, fmt, core) {
  const f = PKX_FMT[fmt];
  buf = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (![f.stored, f.party].includes(buf.length)) throw new Error(`${fmt}: ${buf.length} byte, attesi ${f.stored} o ${f.party}`);
  const d = pkxDecrypt(new Uint8Array(buf), fmt), g = f.gen, party = d.length > f.stored;
  const r = {fmt, gen: g, species: u16(d, 8), item: u16(d, 0x0A), tid: u16(d, 0x0C), sid: u16(d, 0x0E), exp: u32(d, 0x10)};
  let o;
  if (g <= 5) {
    o = {ability: d[0x15], lang: d[0x17], ev: 0x18, moves: 0x28, iv: 0x38, nick: [0x48, 22], ver: 0x5F, ot: [0x68, 16],
      met: 0x7B, metLoc: g === 4 ? (u16(d, 0x46) || u16(d, 0x80)) : u16(d, 0x80), metLvl: 0x84, lvl: 0x8C, stats: 0x90};
    r.pid = u32(d, 0); r.ec = r.pid;
    r.nature = g === 4 ? r.pid % 25 : d[0x41]; r.statNature = r.nature;
    r.gender = (d[0x40] >> 1) & 3; r.form = d[0x40] >> 3;
  } else if (g <= 7) {
    o = {ability: d[0x14], lang: d[0xE3], ev: 0x1E, moves: 0x5A, iv: 0x74, nick: [0x40, 26], ver: 0xDF, ot: [0xB0, 26],
      met: 0xD4, metLoc: u16(d, 0xDA), metLvl: 0xDD, lvl: 0xEC, stats: 0xF2};
    r.ec = u32(d, 0); r.pid = u32(d, 0x18); r.nature = r.statNature = d[0x1C];
    r.gender = (d[0x1D] >> 1) & 3; r.form = d[0x1D] >> 3;
    r.memory = [d[0x38], d[0x39]];
  } else {
    o = {ability: u16(d, 0x14), lang: d[g === 8 ? 0xE2 : 0xD5], ev: 0x26, moves: 0x72, iv: 0x8C, nick: [0x58, 26], ver: g === 8 ? 0xDE : 0xCE,
      ot: [0xF8, 26], met: 0x11C, metLoc: u16(d, 0x122), metLvl: 0x125, lvl: 0x148, stats: 0x14A};
    r.ec = u32(d, 0); r.pid = u32(d, 0x1C); r.nature = d[0x20]; r.statNature = d[0x21];
    r.gender = (d[0x22] >> (g === 8 ? 2 : 1)) & 3; r.form = u16(d, 0x24);
    r.memory = [d[0x3C], d[0x3D]];
    if (g === 9) {   // SV stores its own species index past #916
      const {first, delta} = core.species9, k = r.species - first;
      if (k >= 0 && k < delta.length) r.species += delta[k];
    }
  }
  r.ability = o.ability; r.lang = o.lang;
  r.evs = [0, 1, 2, 3, 4, 5].map(i => d[o.ev + i]);             // HP Atk Def Spe SpA SpD
  r.moves = [0, 1, 2, 3].map(i => u16(d, o.moves + 2 * i));
  const iv32 = u32(d, o.iv);
  r.ivs = [0, 1, 2, 3, 4, 5].map(i => (iv32 >>> (5 * i)) & 31);  // HP Atk Def Spe SpA SpD
  r.isEgg = !!((iv32 >>> 30) & 1); r.nicknamed = !!(iv32 >>> 31);
  const g4 = g === 4 ? core.g4chars : null;
  r.nickname = pkxString(d, o.nick[0], o.nick[1], g4);
  r.otName = pkxString(d, o.ot[0], o.ot[1], g4);
  r.version = d[o.ver];
  r.metDate = d[o.met] ? [2000 + d[o.met], d[o.met + 1], d[o.met + 2]] : null;
  r.metLoc = o.metLoc; r.metLevel = d[o.metLvl] & 0x7F;
  if (party && d[o.lvl]) { r.level = d[o.lvl]; r.stats = [0, 1, 2, 3, 4, 5].map(i => u16(d, o.stats + 2 * i)); }  // HP Atk Def Spe SpA SpD
  const xor = r.tid ^ r.sid ^ (r.pid >>> 16) ^ (r.pid & 0xFFFF);
  r.shiny = xor < (g <= 5 ? 8 : 16);
  // characteristic (PKHeX EntityCharacteristic): highest IV, ties from EC % 6 onward
  if (iv32 || g === 4) {
    let best = r.ec % 6, max = 0;
    for (let k = 0; k < 6; k++) { const s = (r.ec % 6 + k) % 6; if (r.ivs[s] > max) { max = r.ivs[s]; best = s; } }
    r.characteristic = best * 5 + (max % 5);
  }
  r.ribbons = (core.ribbons[fmt] || []).filter(([, off, bit]) => d[off] & (1 << bit)).map(([name]) => name);
  if (r.memory?.[0]) r.ribbons.push('RibbonCountMemoryContest');
  if (r.memory?.[1]) r.ribbons.push('RibbonCountMemoryBattle');
  return r;
}

// PKHeX ribbon property -> name in your legend.json (English), for the icons.
function pkxRibbonLegendName(prop, en) {
  let m;
  if ((m = prop.match(/^RibbonG([34])(Cool|Beauty|Cute|Smart|Tough)(Super|Hyper|Great|Ultra|Master)?$/)))
    return `${m[2]} Ribbon${m[3] ? ' ' + m[3] : ''} (${m[1] === '3' ? 'Hoenn' : 'Sinnoh'})`;
  if (prop === 'RibbonChampionG3') return 'Champion Ribbon';
  if (prop === 'RibbonChampionG6Hoenn') return 'Hoenn Champion Ribbon';
  return en;
}
const ribbonKey = s => String(s).toLowerCase().replace(/ribbon|mark/g, '').replace(/[^a-z0-9]/g, '');

// Every ribbon of the legend gets its name in each display language from PKHeX.
async function extendRibbonNames() {
  const [legend, en] = await Promise.all([loadLegend(), pkxData('en')]);
  if (!legend.length) return;
  const byKey = new Map();
  legend.forEach(e => { if (!byKey.has(ribbonKey(e.name))) byKey.set(ribbonKey(e.name), e); });
  for (const lang of Object.keys(LANGS)) {
    if (lang === 'en') continue;
    const tr = await pkxData(lang).catch(() => null);
    if (!tr) continue;
    RIBBON_NAMES[lang] ??= {};
    for (const [prop, enName] of Object.entries(en.ribbons)) {
      const e = byKey.get(ribbonKey(pkxRibbonLegendName(prop, enName)));
      if (e && tr.ribbons[prop] && !RIBBON_NAMES[lang][e.name]) RIBBON_NAMES[lang][e.name] = tr.ribbons[prop];
    }
  }
}

function pkxLocation(T, gen, loc, version) {
  // Gen 3-5 Pokémon moved forward with Poké Transfer (the label is blank in the Gen 5 text table)
  if (loc === 30001 && version <= 23) return {it: 'Pokétrasporto', en: 'Poké Transfer'}[state.dispLang] || 'Poké Transfer';
  const sets = T.locations['g' + Math.max(4, gen)] || {};
  const base = Object.keys(sets).map(Number).filter(b => b <= loc).sort((a, b) => b - a)[0];
  const name = base != null ? sets[base]?.[loc - base] : '';
  // English Gen 6+ texts read "Met in the Kanto region": drop the article
  return name && !/^[－-]+$/.test(name) ? name.replace(/^(the|an?) /i, '') : '';
}

async function importPkx(file, opts) {
  const fmt = (file.name.match(/\.(?:pk|ek)([4-9])$/i) || [])[1];
  if (!fmt) throw new Error(t('pk_ext'));
  const key = 'pk' + fmt, lang = state.dispLang;
  const [core, T, en, legend] = await Promise.all([pkxData('core'), pkxData(lang), pkxData('en'), loadLegend()]);
  const r = pkxRead(await file.arrayBuffer(), key, core);
  if (!r.species || r.species > 1025) throw new Error(t('pk_bad'));
  if (r.isEgg) throw new Error(t('pk_egg'));
  // base stats, types, move types and the EXP curve still come from PokeAPI
  const [p, sp] = await Promise.all([pj(`pokemon/${r.species}`), pj(`pokemon-species/${r.species}`)]);
  let level = r.level;
  if (!level) {
    const gr = await pj(sp.growth_rate.url);
    level = Math.max(...gr.levels.filter(l => l.experience <= r.exp).map(l => l.level), 1);
  }
  const mv = await Promise.all(r.moves.map(id => id ? pj(`move/${id}`).catch(() => null) : null));
  const STAT = ['ps', 'att', 'dif', 'vel', 'atsp', 'dfsp'];                 // file order: HP Atk Def Spe SpA SpD
  const API = ['hp', 'attack', 'defense', 'speed', 'special-attack', 'special-defense'];
  let stats = r.stats;
  if (!stats) {
    const base = Object.fromEntries(p.stats.map(x => [x.stat.name, x.base_stat]));
    const NAT = ['attack', 'defense', 'speed', 'special-attack', 'special-defense'];   // nature index = 5 * up + down
    const inc = NAT[Math.floor(r.statNature / 5)], dec = NAT[r.statNature % 5];
    stats = API.map((name, i) => {
      const core2 = Math.floor((2 * base[name] + r.ivs[i] + Math.floor(r.evs[i] / 4)) * level / 100);
      if (i === 0) return base[name] === 1 ? 1 : core2 + level + 10;
      return Math.floor((core2 + 5) * (inc === dec ? 1 : name === inc ? 1.1 : name === dec ? 0.9 : 1));
    });
  }
  const types = p.types.sort((a, b) => a.slot - b.slot).map(x => typeKey(x.type.name));
  const pad = n => String(n).padStart(2, '0');
  const upd = {
    dex: r.species, level, shiny: r.shiny,
    name: r.nicknamed && r.nickname ? r.nickname : T.species[r.species] || r.nickname,
    gender: ['M', 'F', '-'][r.gender] || '-',
    type1: types[0] || '', type2: types[1] || '',
    nature: T.natures[r.nature] || '', ability: T.abilities[r.ability] || '',
    item: r.item ? (T.items[r.item] || '') : '', language: PKX_LANG[r.lang] || '',
    ...Object.fromEntries(STAT.map((k, i) => [k, stats[i]])),
  };
  r.moves.forEach((id, i) => { upd['move' + i] = id ? (T.moves[id] || '') : ''; upd['mtype' + i] = mv[i] ? typeKey(mv[i].type.name) : ''; });
  if (opts.story) {
    const reg = PKX_REGION[r.version] || '';
    Object.assign(upd, {
      ot: r.otName, tid: r.gen >= 7 ? String((((r.sid << 16) | r.tid) >>> 0) % 1000000).padStart(6, '0') : String(r.tid).padStart(5, '0'),
      met: r.metDate ? `${pad(r.metDate[2])}/${pad(r.metDate[1])}/${r.metDate[0]}` : '',
      region: lang === 'en' ? (PKX_REGION_EN[reg] || reg) : reg,
      metPlace: pkxLocation(T, r.gen, r.metLoc, r.version),
      characteristic: r.characteristic != null ? (T.characteristics[r.characteristic] || '') : '',
      deposited: '',   // HOME data, not in the file
    });
  }
  let unmatched = 0;
  if (opts.ribbons) {
    const byKey = new Map();
    legend.forEach(e => { if (!byKey.has(ribbonKey(e.name))) byKey.set(ribbonKey(e.name), e); });
    upd.ribbons = r.ribbons.map(prop => {
      const e = byKey.get(ribbonKey(pkxRibbonLegendName(prop, en.ribbons[prop] || prop)));
      if (e) return e.png;
      unmatched++;
      return (T.ribbons[prop] || en.ribbons[prop] || prop).replace(/\|/g, '');
    }).join('\n');
  }
  Object.assign(state, upd);
  return {name: state.name, ribbons: r.ribbons.length, unmatched, fmt: key, game: T.games[r.version] || ''};
}

function buildPkxBox() {
  const fs = document.querySelector('fieldset[data-group="pokemon"]');
  if (!fs || $('pkxbox')) return;
  const det = document.createElement('details'); det.className = 'adv'; det.id = 'pkxbox';
  det.innerHTML = `<summary></summary><div class="trbox"><div class="muted" id="pkxInfo"></div>
    <label class="chk"><input type="checkbox" id="pkxStory" checked> <span id="pkxStoryL"></span></label>
    <label class="chk"><input type="checkbox" id="pkxRib" checked> <span id="pkxRibL"></span></label>
    <div class="row" style="margin-top:0"><label class="chk" style="cursor:pointer"><input type="file" id="pkxFile" accept=".pk4,.pk5,.pk6,.pk7,.pk8,.pk9,.ek4,.ek5,.ek6,.ek7,.ek8,.ek9" hidden><span id="pkxUp"></span></label></div></div>`;
  fs.querySelector('.grid').after(det);
  det.querySelector('summary').textContent = t('pk_title');
  $('pkxInfo').textContent = t('pk_info');
  $('pkxStoryL').textContent = t('pk_story');
  $('pkxRibL').textContent = t('pk_ribbons');
  $('pkxUp').textContent = t('pk_pick');
  $('pkxUp').style.cssText = 'padding:6px 8px;border:1px solid var(--acc);border-radius:6px;background:var(--acc);color:#fff';
  $('pkxFile').addEventListener('change', async ev => {
    const f = ev.target.files?.[0]; ev.target.value = '';
    if (!f) return;
    setStatus(t('sd_busy'));
    try {
      const res = await importPkx(f, {story: $('pkxStory').checked, ribbons: $('pkxRib').checked});
      await applyUiLang(); showSection('pokemon', false); $('pkxbox').open = true;
      render();
      setStatus(t('pk_ok', res) + (res.unmatched ? ' · ' + t('pk_unmatched', {n: res.unmatched}) : ''));
    } catch (e) { setStatus(t('pk_err', {e: e.message || e})); }
  });
}

