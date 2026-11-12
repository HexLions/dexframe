// ---------- PokeAPI (cached JSON) ----------
const POKEAPI = 'https://pokeapi.co/api/v2/';
const pokeCache = new Map();
function pj(path) {
  const url = /^https?:/.test(path) ? path : POKEAPI + path;
  if (!pokeCache.has(url)) pokeCache.set(url, fetch(url).then(r => {
    if (!r.ok) throw new Error(`${r.status} ${url.replace(POKEAPI, '')}`);
    return r.json();
  }).catch(e => { pokeCache.delete(url); throw e; }));
  return pokeCache.get(url);
}
const locName = (j, lang = state.dispLang) =>
  (j?.names?.find(n => n.language.name === lang) || j?.names?.find(n => n.language.name === 'en') || {}).name || j?.name || '';

// Pokémon of the day: a fixed pool drawn from a seed; the display shows entry (day % n).
const dailyN = (s = state) => Math.max(1, Math.min(14, Math.round(Number(s.dailyCount) || 7)));
function dailyIds(s = state) {
  const max = (SPRITES[s.style] || SPRITES.pt).max;     // the sprite set decides the range
  let a = (Number(s.dailySeed) || 1) >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ids = [];
  while (ids.length < dailyN(s)) { const id = 1 + Math.floor(rnd() * max); if (!ids.includes(id)) ids.push(id); }
  return ids;
}
const FLAVOR_VERSIONS = {pt: ['platinum', 'diamond', 'pearl'], hgss: ['heartgold', 'soulsilver'], bw: ['black', 'white', 'black-2', 'white-2']};
function pickFlavor(sp, style, lang) {
  const all = sp.flavor_text_entries || [];
  const inLang = l => all.filter(e => e.language.name === l);
  const list = inLang(lang).length ? inLang(lang) : inLang('en');
  const pref = list.find(e => (FLAVOR_VERSIONS[style] || []).includes(e.version.name));
  const e = pref || list[list.length - 1];
  return e ? e.flavor_text.replace(/[\n\f\r\u00ad]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

// Rotation = regular pages (+ a portrait per collection card), the daily page last.
const CARD_GROUPS = ['pokemon', 'moves', 'stats', 'story', 'ribbons'];
const CARD_KEYS = [...GROUPS.filter(([g]) => CARD_GROUPS.includes(g)).flatMap(([, f]) => f.map(x => x[0])), 'shiny'];
const cardData = (s = state) => Object.fromEntries(CARD_KEYS.map(k => [k, s[k]]));
// a field one side never had (cards saved before it existed) does not make them differ
const sameCard = (a, b) => CARD_KEYS.every(k => a[k] == null || b[k] == null || String(a[k]) === String(b[k]));
// A page can span several screens (team split in parts): one rotation entry per part.
const pageParts = (key, s = state) => Math.max(1, PAGES[key]?.parts ? PAGES[key].parts(s) : 1);
function rotation() {
  const entries = activePages().filter(k => k !== 'daily')
    .flatMap(key => Array.from({length: pageParts(key)}, (_, part) => ({key, s: state, part})));
  if (state.colRotation) for (const card of state.collection || [])
    if (!sameCard(card.data, state)) entries.push({key: 'cover', s: {...state, ...card.data}, card});
  return entries;
}

