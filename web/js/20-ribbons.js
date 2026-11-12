// ---------- ribbon images (user-supplied, served from ./ribbons/) ----------
// Lookup order: ribbons/ribbons.json {"Ribbon name": "file.png"}, then ribbons/<slug>.png
const slug = n => String(n).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
let ribbonMapP = null;
function ribbonMap() {
  ribbonMapP ??= fetch('ribbons/ribbons.json', {cache: 'no-store'})
    .then(r => r.ok ? r.json() : {}).catch(() => ({}));
  return ribbonMapP;
}
const localImgCache = new Map();
function loadLocalImage(url) {
  if (!localImgCache.has(url)) localImgCache.set(url, new Promise(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);   // missing file or CORS refused -> next candidate
    if (/^https?:/i.test(url)) img.crossOrigin = 'anonymous';  // needed for getImageData
    img.src = url;
  }));
  return localImgCache.get(url);
}
// Legend of available icons: ribbons/legend.json (user-supplied), or embedded
// by tools/make_standalone.py as window.DEXFRAME_EMBED = {legend, files}.
const EMBED = window.DEXFRAME_EMBED || null;
let legendP = null;
// Your own icons come first; then the ribbons and marks hosted by PokeAPI/sprites
// (pkx/sprites.json.gz lists them, the images load at runtime like the Pokémon sprites).
function loadLegend() {
  legendP ??= (async () => {
    const own = EMBED?.legend ? EMBED.legend
      : await fetch('ribbons/legend.json', {cache: 'no-store'}).then(r => r.ok ? r.json() : []).catch(() => []);
    const cat = await pkxData('sprites').catch(() => null);
    if (!cat) return own;
    const ownKeys = new Set(own.map(e => ribbonKey(e.name))), seen = new Set();
    // one entry per ribbon: the oldest generation (40 px pixel art) wins over the 128 px renders;
    // the ones you have yourself stay listed (for names and old saves) but hidden in the picker
    const web = [...cat.ribbons.map(e => [e, 'ribbon']), ...cat.marks.map(e => [e, 'mark'])]
      .sort((a, b) => a[0][1] - b[0][1])
      .filter(([[, , name]]) => !seen.has(name) && seen.add(name))
      .map(([[path, gen, name], type]) => ({png: 'pokeapi:' + path, name, type, origin_gen: gen, web: true, dup: ownKeys.has(ribbonKey(name))}));
    return [...own, ...web];
  })();
  return legendP;
}
const iconSrc = file => file.startsWith('pokeapi:') ? PA_RAW + file.slice(8) : EMBED?.files?.[file] || 'ribbons/' + file;

// Trainer sprites: your own trainers/legend.json + PNGs (same format as the ribbons
// legend), embedded by make_standalone.py as DEXFRAME_EMBED.trainers; or an image
// uploaded from this page (state.trImage, a small PNG data URL).
let trLegendP = null;
// Your own pack (trainers/legend.json or embedded) if present, otherwise the Showdown
// catalog (pkx/trainers.json.gz: names only; png "sd:<file>").
const SD_TRAINERS = 'https://play.pokemonshowdown.com/sprites/trainers/';
function loadTrainerLegend() {
  trLegendP ??= (EMBED?.trainers?.legend ? Promise.resolve(EMBED.trainers.legend)
    : fetch('trainers/legend.json', {cache: 'no-store'}).then(r => r.ok ? r.json() : []).catch(() => []))
    .then(async list => list.length ? list : (await pkxData('trainers').catch(() => []))
      .map(([file, name, variant, gen]) => ({png: 'sd:' + file, showdown_file: file, name, variant, origin_gen: gen})))
    .then(list => list.map(e => {
      const gen = e.origin_gen ?? (String(e.variant || e.key || e.png).match(/gen(\d+)/i) || [])[1];
      const cap = w => w.charAt(0).toUpperCase() + w.slice(1);
      const label = e.label || [cap(String(e.name || e.key || '')), e.variant].filter(Boolean).join(' · ');
      return {...e, origin_gen: gen ? Number(gen) : null, label};
    }));
  return trLegendP;
}
// sd:<file> = Showdown sprite: thumbnail straight from Showdown (display only), pixels
// from the copy the board downloaded (same origin, readable by the canvas).
const devPath = path => { const u = api(path); return u ? u.replace(/[?&]key=[^&]*/, '') : null; };
const trSrc = file => file.startsWith('sd:') ? SD_TRAINERS + file.slice(3) : EMBED?.trainers?.files?.[file] || 'trainers/' + file;
const trPixels = file => file.startsWith('sd:') ? devPath('/trainers/sd/' + file.slice(3)) : trSrc(file);
async function fetchTrainerToDevice(file) {
  const u = api('/api/trainer?f=' + encodeURIComponent(file.slice(3)));
  if (!u || !deviceInfo) throw new Error(t('tr_need_dev'));
  const r = await fetch(u, {method: 'POST'});
  if (!r.ok) throw new Error(r.status === 403 ? t('sy_key_bad') : `HTTP ${r.status} ${await r.text()}`);
}
function trUrl(s) {
  const f = String(s.trFile || '').trim(); let b = String(s.trBase || '').trim();
  if (!f) return '';
  if (/^https?:/i.test(f) || !b) return f;   // a full URL in the file field also works
  return (b.endsWith('/') ? b : b + '/') + f.replace(/^\/+/, '');
}
const trainerImageUrl = s => s.trImage || trUrl(s) || (s.trSprite ? trPixels(s.trSprite) || '' : '');

// Box icons from PokeAPI: Gen 7 (40x30, up to #809), then Scarlet/Violet; fetched at render time.
const iconUrl = id => `${PA_RAW}pokemon/versions/generation-vii/icons/${id}.png`;
const iconUrls = id => [iconUrl(id), `${PA_RAW}pokemon/versions/generation-ix/scarlet-violet/icons/${id}.png`, `${PA_RAW}pokemon/${id}.png`];
async function loadFirstImage(urls) {
  for (const u of urls) { const img = await loadLocalImage(u); if (img) return img; }
  return null;
}
const dexList = v => String(v || '').split(/[\s,;]+/).map(Number).filter(n => Number.isInteger(n) && n > 0 && n < 2000).slice(0, 6);
const teamIds = s => dexList(s.team);
const hofIds = s => dexList(s.hofTeam).length ? dexList(s.hofTeam) : teamIds(s);
const pokeThumb = id => `${PA_RAW}pokemon/${id}.png`;

// Gym badges in PokeAPI/sprites (badges/<n>.png), grouped by region.
const BADGES = {
  kanto: {ids: [1, 2, 3, 4, 5, 6, 7, 8], names: ['Boulder', 'Cascade', 'Thunder', 'Rainbow', 'Soul', 'Marsh', 'Volcano', 'Earth']},
  johto: {ids: [9, 10, 11, 12, 13, 14, 15, 16], names: ['Zephyr', 'Hive', 'Plain', 'Fog', 'Storm', 'Mineral', 'Glacier', 'Rising']},
  hoenn: {ids: [17, 18, 19, 20, 21, 22, 23, 24], names: ['Stone', 'Knuckle', 'Dynamo', 'Heat', 'Balance', 'Feather', 'Mind', 'Rain']},
  sinnoh: {ids: [25, 26, 27, 28, 29, 30, 31, 32], names: ['Coal', 'Forest', 'Cobble', 'Fen', 'Relic', 'Mine', 'Icicle', 'Beacon']},
  unova: {ids: [33, 34, 35, 36, 37, 38, 39, 40, 41, 42], names: []},
  kalos: {ids: [43, 44, 45, 46, 47, 48, 49, 50], names: ['Bug', 'Cliff', 'Rumble', 'Plant', 'Voltage', 'Fairy', 'Psychic', 'Iceberg']},
  galar: {ids: [51, 52, 53, 54, 55, 56, 57, 58, 59, 60], names: ['Grass', 'Water', 'Fire', 'Fighting', 'Ghost', 'Fairy', 'Rock', 'Ice', 'Dark', 'Dragon']},
  paldea: {ids: [70, 71, 72, 73, 74, 75, 76, 77], names: ['Bug', 'Grass', 'Electric', 'Water', 'Normal', 'Ghost', 'Psychic', 'Ice']},
  other: {ids: [61, 62, 63, 64, 65, 66, 67, 68, 69], names: []},
};
const badgeUrl = id => `${PA_RAW}badges/${id}.png`;
const badgeIds = s => String(s.trBadgeIds || '').split(/[\s,;]+/).map(Number).filter(n => n > 0).slice(0, 8);

// Pokémon names for the Hall of Fame, from PokeAPI species data (cached per id).
const speciesCache = new Map();
function speciesName(id, lang) {
  if (!speciesCache.has(id)) speciesCache.set(id, fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`)
    .then(r => r.ok ? r.json() : null).catch(() => null));
  return speciesCache.get(id).then(sp => sp ? ((sp.names.find(n => n.language.name === lang) || {}).name || sp.name) : `#${id}`);
}

// Italian names, only where verified from the game; anything else keeps the legend's English name.
const IT_NAMES = {
  'Kalos Champion Ribbon': 'Campione Kalos', 'Effort Ribbon': 'Merito', 'Alert Ribbon': 'Allarme',
  'Downcast Ribbon': 'Sconforto', 'Relax Ribbon': 'Relax', 'Snooze Ribbon': 'Pisolino',
  'Smile Ribbon': 'Sorriso', 'Legend Ribbon': 'Leggenda', 'Contest Memory Ribbon': 'Ricordo delle Gare',
  'Footprint Ribbon': 'Orma',
};
// A list line is "file.png", "Name | file.png" or just "Name".
function parseRibbonLine(line) {
  if (line.includes('|')) { const [name, file] = line.split('|').map(x => x.trim()); return {name, file: file || ''}; }
  return /\.(png|gif|bmp|jpe?g|webp)$/i.test(line) ? {name: '', file: line} : {name: line, file: ''};
}
const RIBBON_NAMES = {it: IT_NAMES};   // add e.g. de: {...} for more languages
const displayName = (e, lang = state.dispLang) => RIBBON_NAMES[lang]?.[e.name] || e.name.replace(/ Ribbon\b/, '');

// Candidates, first hit wins:
//   explicit file ("Nome | file.png") at URL base, then in ./ribbons/
//   ribbons.json mapping, ./ribbons/<slug>.png, then <slug>.png at URL base
async function ribbonImage({name, file}) {
  const map = await ribbonMap();
  const key = Object.keys(map).find(k => slug(k) === slug(name));
  let base = String(state.ribbonBase || '').trim();
  if (base && !base.endsWith('/')) base += '/';
  const cands = [];
  if (file) { if (base) cands.push(base + file); cands.push(iconSrc(file)); }
  if (key) cands.push('ribbons/' + map[key]);
  cands.push('ribbons/' + slug(name) + '.png');
  if (base) cands.push(base + slug(name) + '.png');
  for (const url of cands) {
    const img = await loadLocalImage(url);
    if (img) return {url, img};
  }
  return {url: cands[0], img: null};
}

// Shrink a large image to fit `max` px by averaging f x f blocks (alpha-weighted),
// so a 256px PNG becomes a clean small pixel icon instead of a resampled blur.
function fitPixels(sp, max) {
  if (Math.max(sp.w, sp.h) <= max) return sp;
  const f = Math.ceil(Math.max(sp.w, sp.h) / max);
  const w = Math.ceil(sp.w / f), h = Math.ceil(sp.h / f);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0, cnt = 0;
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) {
      const sx = x * f + i, sy = y * f + j;
      if (sx >= sp.w || sy >= sp.h) continue;
      const [pr, pg, pb, pa] = sp.at(sx, sy);
      r += pr * pa; g += pg * pa; b += pb * pa; a += pa; cnt++;
    }
    const o = (y * w + x) * 4;
    if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
    out[o + 3] = cnt ? a / cnt : 0;
  }
  return {w, h, at: (x, y) => { const o = (y * w + x) * 4; return [out[o], out[o + 1], out[o + 2], out[o + 3]]; }};
}

