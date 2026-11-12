// ---------- pages added in 2.0: Who's that Pokémon?, shiny hunt, Pokédex progress, item of the day ----------

// n distinct random numbers in [lo, hi] from a seed (same generator as dailyIds).
function seededIds(seed, n, lo, hi) {
  let a = (Number(seed) || 1) >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ids = [], span = hi - lo + 1;
  n = Math.min(n, span);
  while (ids.length < n) { const id = lo + Math.floor(rnd() * span); if (!ids.includes(id)) ids.push(id); }
  return ids;
}
const poolN = (v, def = 7) => Math.max(1, Math.min(14, Math.round(Number(v) || def)));
const wtpIds = (s = state) => seededIds(s.wtpSeed, poolN(s.wtpCount), 1, (SPRITES[s.style] || SPRITES.pt).max);
const BERRIES = 64;      // PokeAPI berry/1..64
const itemIds = (s = state) => seededIds(s.itemSeed, poolN(s.itemCount), 1, s.itemKind === 'berry' ? BERRIES : ITEM_MAX);
const ITEM_MAX = 300;    // item/1..300: balls, medicine, evolution and held items (most have an icon)

// Pools: the board changes them with the "of the day" schedule. Who's that Pokémon? is
// two entries over the same pool, so the answer always follows its own silhouette.
POOL_PAGES.whosthat = (s, part) => ({mode: 'd', jobs: wtpIds(s).map(id => ({key: 'whosthat', s: {...s, _wtpId: id}, part}))});
POOL_PAGES.itemday = (s, part) => ({mode: 'd', jobs: itemIds(s).map(id => ({key: 'itemday', s: {...s, _itemId: id}, part}))});

// Every opaque pixel black: the classic silhouette.
const silhouetteOf = sp => sp && {w: sp.w, h: sp.h, at: (i, y) => sp.at(i, y)[3] >= 128 ? [0, 0, 0, 255] : [255, 255, 255, 0]};

// Numbers in the glyph strip (digits, separator, %), at any scale: drawDigits with '%'.
const SHINY_ODDS = [4096, 8192, 1365, 683, 512, 1024, 2731];

function parseRanges(str, lo, hi) {
  const out = new Set();
  for (const part of String(str || '').split(/[\s,;]+/)) {
    const m = part.match(/^#?(\d+)(?:-#?(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
    for (let k = Math.max(lo, Math.min(a, b)); k <= Math.min(hi, Math.max(a, b)); k++) out.add(k);
  }
  return out;
}
const dexRange = s => s.dexScope && /^gen[1-9]$/.test(s.dexScope) ? GEN_RANGES[Number(s.dexScope[3]) - 1] : [1, 1025];
function dexCaught(s) {
  const [lo, hi] = dexRange(s), got = parseRanges(s.dexCaught, lo, hi);
  if (s.dexUseCol) {
    const add = id => { id = Number(id); if (id >= lo && id <= hi) got.add(id); };
    add(s.dex);
    for (const c of s.collection || []) add(c.data?.dex);
    String(s.team || '').split(/[\s,]+/).forEach(add);
  }
  return got;
}

Object.assign(PAGES, {
  whosthat: {
    parts: () => 2,          // 1: silhouette, 2: answer
    header: (s, a) => [s._part ? (a?.name || '—') : '???', '-'],
    async prepare(s) {
      const ids = wtpIds(s), id = s._wtpId ?? ids[dailyPickNow(ids.length)];
      const [sp, img] = await Promise.all([pj(`pokemon-species/${id}`).catch(() => null),
        getSprite(spriteUrl(s.style, id, false)).catch(() => null)]);
      return {id, name: sp ? locName(sp) : '#' + id, img, blits: []};
    },
    draw(ctx, s, acc, a) {
      let sp = null;
      try { sp = a.img && spritePixels(a.img); } catch { sp = null; }
      const reveal = !!s._part;
      if (sp) a.blits.push({sp: reveal ? sp : silhouetteOf(sp), area: [90, 40, 220, 196], fit: true, crisp: true});
      const q = reveal ? d('wtp_a', {n: up(a.name)}) : d('wtp_q');
      wrapLines(up(q), 16, true, 380).slice(0, 2).forEach((l, i, all) =>
        text(ctx, l, W / 2, (all.length > 1 ? 242 : 252) + i * 19, 16, true, reveal ? acc : BLACK, 'center'));
      if (!reveal) for (const [x, y] of [[40, 90], [348, 120], [62, 180], [330, 60]]) text(ctx, '?', x, y, 16, true, BLACK, 'center');
    },
    finish(ink, s, opt, a) { raysBackdrop(ink, 31, s._part ? 0.2 : 0.35, [[84, 36, 232, 204], [0, 236, W, H - 236], [28, 54, 26, 150], [334, 48, 26, 150]]); },
  },
  shiny: {
    header: (s, a) => [a?.name || s.name, '-'],
    async prepare(s) {
      const id = Number(s.shTarget) || Number(s.dex) || 1;
      const [sp, img] = await Promise.all([pj(`pokemon-species/${id}`).catch(() => null),
        getSprite(spriteUrl(s.style, id, true)).catch(() => getSprite(spriteUrl(s.style, id, false)).catch(() => null))]);
      return {id, name: sp ? locName(sp) : s.name, img, blits: [], overlays: []};
    },
    draw(ctx, s, acc, a) {
      let sp = null;
      try { sp = a.img && spritePixels(a.img); } catch { sp = null; }
      if (sp) a.blits.push({sp, area: [12, 40, 176, 210], valign: 'bottom'});
      ctx.fillStyle = BLACK; ctx.fillRect(12, 252, 176, 2);
      text(ctx, `#${String(a.id).padStart(4, '0')}`, 12, 262, 16, true, BLACK);
      const x = 200, w = 190, odds = Math.max(2, Number(s.shOdds) || 4096);
      const count = Math.max(0, Math.round(Number(deviceInfo?.counter ?? s.shCount) || 0));
      text(ctx, up(d('sh_count')), x, 40, 8, true, acc);
      const big = fmtNum(count), scale = [3, 2].find(k => digitRun(fmtNum(Math.max(count, 99999))).width * k <= w) || 2;
      drawDigits(ctx, big, x, 54, w, 0, scale, BLACK);
      a.overlays.push({x, y: 54, w, h: GLYPH_H * scale, align: 0, start: 0, color: 0, sep: 1, mode: 2, scale});
      const y2 = 64 + GLYPH_H * scale;
      text(ctx, up(d('sh_chance')), x, y2, 8, true, acc);
      const pct = Math.floor(100 * (1 - Math.pow(1 - 1 / odds, count)));
      drawDigits(ctx, pct + '%', x, y2 + 12, w, 0, 2, BLACK);
      a.overlays.push({x, y: y2 + 12, w, h: GLYPH_H * 2, align: 0, start: odds, color: 0, sep: 0, mode: 3, scale: 2});
      const y3 = y2 + 24 + GLYPH_H * 2;
      field(ctx, d('sh_odds'), `1/${fmtNum(odds)}`, x, y3, w, acc);
      wrapLines(up(s.shMethod || ''), 8, true, w).slice(0, 2).forEach((l, i) => text(ctx, l, x, y3 + 32 + i * 11, 8, true, BLACK));
      wrapLines(up(s.shPhases || ''), 8, false, w).slice(0, 4).forEach((l, i) => text(ctx, l, x, 236 + i * 11, 8, false, BLACK));
    },
  },
  dexprog: {
    header: s => [s.trName || d('dexprog'), '-'],
    draw(ctx, s, acc) {
      const [lo, hi] = dexRange(s), n = hi - lo + 1, got = dexCaught(s), have = got.size;
      text(ctx, up(d(s.dexScope && s.dexScope !== 'national' ? 'dex_gen' : 'dex_nat', {g: String(s.dexScope || '').slice(3)})), 10, 38, 8, true, acc);
      drawDigits(ctx, fmtNum(have), 10, 50, 190, 0, 2, BLACK);
      const pct = Math.floor(100 * have / n);
      text(ctx, `/ ${fmtNum(n)}`, 10 + digitRun(fmtNum(have)).width * 2 + 8, 66, 16, false, BLACK);
      drawDigits(ctx, pct + '%', 210, 50, 180, 2, 2, acc);
      box(ctx, 10, 86, 380, 10, false);
      ctx.fillStyle = acc; ctx.fillRect(12, 88, Math.round(376 * have / n), 6);
      // one square per species: filled = caught
      const top = 104, aw = 380, ah = 178;
      let c = Math.min(24, Math.floor(Math.sqrt(aw * ah / n)));
      while (c > 3 && Math.ceil(n / Math.floor(aw / c)) * c > ah) c--;
      const cols = Math.floor(aw / c), x0 = 10 + Math.floor((aw - cols * c) / 2);
      for (let k = 0; k < n; k++) {
        const x = x0 + (k % cols) * c, y = top + Math.floor(k / cols) * c, id = lo + k;
        if (got.has(id)) { ctx.fillStyle = BLACK; ctx.fillRect(x, y, c - 1, c - 1); }
        else if (c >= 5) box(ctx, x, y, c - 1, c - 1, false);
        else { ctx.fillStyle = BLACK; ctx.fillRect(x + (c >> 1) - 1, y + (c >> 1) - 1, 1, 1); }
      }
    },
  },
  itemday: {
    header: (s, a) => [a?.name || '—', '-'],
    async prepare(s) {
      const ids = itemIds(s), id = s._itemId ?? ids[dailyPickNow(ids.length)];
      const lang = state.dispLang;
      let berry = null, item = null;
      if (s.itemKind === 'berry') { berry = await pj(`berry/${id}`); item = await pj(berry.item.url); }
      else {
        // not every item id has an icon: take the next one that does
        for (let k = 0; k < 6 && !item?.sprites?.default; k++) item = await pj(`item/${(id - 1 + k) % ITEM_MAX + 1}`).catch(() => null);
        if (!item) throw new Error('item ' + id);
      }
      const [cat, img] = await Promise.all([item.category ? pj(item.category.url).catch(() => null) : null,
        item.sprites?.default ? getSprite(item.sprites.default).catch(() => null) : null]);
      const fl = item.flavor_text_entries || [];
      const flavor = ((fl.filter(e => e.language.name === lang).at(-1)) || fl.filter(e => e.language.name === 'en').at(-1) || {}).text || '';
      return {name: locName(item, lang), cat: cat ? locName(cat, lang) : slugWords(item.category?.name), cost: item.cost,
        fling: item.fling_power, berry, flavor: flavor.replace(/\s+/g, ' '), img, blits: []};
    },
    draw(ctx, s, acc, a) {
      let sp = null;
      try { sp = a.img && spritePixels(a.img); } catch { sp = null; }
      if (sp) a.blits.push({sp, area: [14, 40, 150, 150], fit: true});
      ctx.fillStyle = BLACK; ctx.fillRect(14, 194, 150, 2);
      const x = 180, w = 210;
      const rows = [[d('it_cat'), a.cat]];
      if (a.berry) rows.push([d('it_firm'), slugWords(a.berry.firmness?.name)], [d('it_size'), `${a.berry.size} mm`],
        [d('it_grow'), `${a.berry.growth_time} h`]);
      else { if (a.cost) rows.push([d('it_cost'), fmtNum(a.cost)]); if (a.fling) rows.push([d('it_fling'), String(a.fling)]); }
      rows.slice(0, 4).forEach(([l, v], i) => field(ctx, l, v, x, 40 + i * 38, w, acc));
      const fl = up(a.flavor || d('flavor_none'));
      let lines = wrapLines(fl, 16, false, 372), px = 16, lh = 19;
      if (lines.length > 4) { lines = wrapLines(fl, 8, false, 372).slice(0, 7); px = 8; lh = 11; }
      const top = 202 + Math.max(0, Math.floor((82 - lines.length * lh) / 2));
      lines.forEach((l, i) => text(ctx, l, 14, top + i * lh, px, false, BLACK));
    },
  },
});
