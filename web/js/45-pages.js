// ---------- pages (400x300) ----------
const PAGES = {
  cover: {
    sprite: true,
    draw(ctx, s, acc, assets) {
      const nw = text(ctx, `#${String(s.dex).padStart(4, '0')}`, 12, 40, 16, true, BLACK);
      text(ctx, up(`${d('lv')} ${s.level}`), 12 + nw + 14, 40, 16, false, BLACK);
      // right column
      const x = 226, w = 164;
      text(ctx, up(d('type')), x, 40, 8, true, BLACK);
      if (s.type1) { const c1 = typeFill(s.type1, s, acc); box(ctx, x, 52, w, 24, true, c1); text(ctx, up(typeName(s.type1)), x + w / 2, 57, 16, true, textOn(c1), 'center', w - 8); }
      if (s.type2) { box(ctx, x, 80, w, 24, false); text(ctx, up(typeName(s.type2)), x + w / 2, 85, 16, true, BLACK, 'center', w - 8); }
      // up to 4 rows of 36px from y=112: nature, ability, item (if any), days together (or language)
      const start = sinceDay(s), days = start != null ? todayDay() - start : null;
      const rows = [[d('nature'), s.nature], [d('ability'), s.ability]];
      if (String(s.item || '').trim()) rows.push([d('item'), s.item]);
      if (days != null && days >= 0) rows.push(['days']); else rows.push([d('language'), s.language]);
      rows.forEach(([label, value], i) => {
        const y = 112 + i * 36;
        if (label !== 'days') return field(ctx, label, value, x, y, w);
        text(ctx, up(d('days')), x, y, 8, true, acc);
        text(ctx, fmtNum(days), x, y + 12, 16, false, BLACK);
        // the firmware redraws this box every midnight (B/W: partial refresh)
        assets.overlay = {x, y: y + 12, w, h: GLYPH_H, align: 0, start, color: 0, sep: 1};
      });
      ctx.fillStyle = BLACK; ctx.fillRect(12, 276, 200, 2);   // floor line under the sprite
    },
    spriteArea: [12, 62, 200, 214],
  },
  moves: {
    draw(ctx, s, acc) {
      for (let i = 0; i < 4; i++) {
        const y = 40 + i * 61;
        box(ctx, 10, y, 380, 53, false);
        ctx.fillStyle = typeFill(s['mtype' + i], s, acc); ctx.fillRect(10, y, 12, 53);
        text(ctx, up(s['move' + i] || '—'), 34, y + 10, 16, true, BLACK, 'left', 344);
        text(ctx, up(typeName(s['mtype' + i])), 34, y + 34, 8, true, BLACK);
        text(ctx, String(i + 1), 380, y + 10, 16, false, BLACK, 'right');
      }
    },
  },
  stats: {
    draw(ctx, s, acc) {
      const rows = ['ps','att','dif','atsp','dfsp','vel'].map(k => [up(d(k)), k]);
      const vals = rows.map(([, k]) => Number(s[k]) || 0);
      const max = Math.max(...vals), tot = vals.reduce((a, b) => a + b, 0);
      rows.forEach(([label, k], i) => {
        const y = 40 + i * 36, v = vals[i];
        text(ctx, label, 10, y + 4, 16, true, BLACK);
        text(ctx, String(v), 170, y + 4, 16, false, BLACK, 'right');
        box(ctx, 182, y + 2, 208, 22, false);
        ctx.fillStyle = v === max && v > 0 ? acc : BLACK;
        ctx.fillRect(185, y + 5, Math.round(202 * Math.min(v, 500) / 500), 16);
      });
      ctx.fillStyle = BLACK; ctx.fillRect(10, 257, 380, 1);
      text(ctx, up(d('total')), 10, 264, 16, true, BLACK, 'left', 110);
      text(ctx, String(tot), 170, 264, 16, false, BLACK, 'right');
      text(ctx, up(`${d('nature')} ${s.nature}`), 390, 264, 16, false, BLACK, 'right', 200);
    },
  },
  weak: {
    draw(ctx, s, acc) {
      const tab = defenseTable(typeKey(s.type1), typeKey(s.type2));
      const groups = [[4, '4X'], [2, '2X'], [0.5, '1/2X'], [0.25, '1/4X'], [0, '0X']]
        .map(([m, label]) => [m, label, TYPE_KEYS.filter(k => tab[k] === m)]).filter(g => g[2].length);
      // the Pokémon's own types, top line
      let tx = 10;
      [s.type1, s.type2].map(typeKey).filter(Boolean).forEach((k, i) => {
        const lab = up(typeName(k)), w = measure(lab, 8, true) + 12;
        box(ctx, tx, 38, w, 15, i === 0, i === 0 ? acc : BLACK);
        text(ctx, lab, tx + w / 2, 42, 8, true, i === 0 ? WHITE : BLACK, 'center');
        tx += w + 4;
      });
      if (!groups.some(g => g[0] > 1)) text(ctx, up(d('w_none')), 390, 42, 8, true, BLACK, 'right');
      let y = 62;
      for (const [m, label, keys] of groups) {
        if (y > 262) break;
        text(ctx, label, 10, y + 2, 16, true, m > 1 ? acc : BLACK);
        let x = 78;
        for (const k of keys) {
          const lab = up(typeName(k)), w = measure(lab, 8, true) + 12;
          if (x + w > 390) { x = 78; y += 21; }
          // weak: filled accent · resist: outlined · immune: filled black
          if (m > 1) box(ctx, x, y, w, 18, true, acc);
          else if (m > 0) box(ctx, x, y, w, 18, false);
          else box(ctx, x, y, w, 18, true, BLACK);
          text(ctx, lab, x + w / 2, y + 5, 8, true, m > 0 && m < 1 ? BLACK : WHITE, 'center');
          x += w + 4;
        }
        y += 21 + 8;
        ctx.fillStyle = BLACK; ctx.fillRect(10, y - 5, 380, 1);
      }
    },
  },
  daily: {
    header: (s, a) => [a?.name || '—', '-'],
    async prepare(s) {
      const ids = dailyIds(s);
      const id = s._dailyId ?? ids[dailyPickNow(ids.length)];
      const lang = state.dispLang;
      const [p, sp, img] = await Promise.all([pj(`pokemon/${id}`), pj(`pokemon-species/${id}`),
        getSprite(spriteUrl(s.style, id, false)).catch(() => null)]);
      return {id, name: locName(sp, lang), img, blits: [],
        genus: (sp.genera.find(g => g.language.name === lang) || sp.genera.find(g => g.language.name === 'en') || {}).genus || '',
        types: p.types.sort((a, b) => a.slot - b.slot).map(x => typeKey(x.type.name)),
        flavor: pickFlavor(sp, s.style, lang)};
    },
    draw(ctx, s, acc, a) {
      let sp = null;
      try { sp = a.img && spritePixels(a.img); } catch { sp = null; }
      if (sp) a.blits.push({sp, area: [10, 38, 172, 150], valign: 'bottom'});
      ctx.fillStyle = BLACK; ctx.fillRect(10, 190, 172, 2);
      const x = 194, w = 196;
      text(ctx, `#${String(a.id).padStart(4, '0')}`, x, 40, 16, true, BLACK);
      wrapLines(up(a.genus), 8, true, w).slice(0, 2).forEach((l, i) => text(ctx, l, x, 64 + i * 11, 8, true, BLACK));
      a.types.forEach((k, i) => {
        const c = i === 0 ? typeFill(k, s, acc) : BLACK;
        box(ctx, x, 92 + i * 28, w, 24, i === 0, c);
        text(ctx, up(typeName(k)), x + w / 2, 97 + i * 28, 16, true, i === 0 ? textOn(c) : BLACK, 'center', w - 8);
      });
      // flavor text: 16px if it fits in 4 lines, else 8px
      const fl = up(a.flavor || d('flavor_none'));
      let lines = wrapLines(fl, 16, false, 372), px = 16, lh = 19;
      if (lines.length > 4) { lines = wrapLines(fl, 8, false, 372).slice(0, 7); px = 8; lh = 11; }
      const top = 198 + Math.max(0, Math.floor((86 - lines.length * lh) / 2));
      lines.forEach((l, i) => text(ctx, l, 14, top + i * lh, px, false, BLACK));
    },
  },
  story: {
    draw(ctx, s, acc) {
      const L = 10, R = 206, cw = 184;
      field(ctx, d('ot'), s.ot, L, 40, cw, acc);
      field(ctx, d('tid'), s.tid, R, 40, cw, acc);
      field(ctx, d('met'), s.met, L, 88, cw, acc);
      field(ctx, d('region'), s.region, R, 88, cw, acc);
      field(ctx, d('metPlace'), s.metPlace, L, 136, 380, acc);
      field(ctx, d('deposited'), s.deposited, L, 184, cw, acc);
      field(ctx, d('language'), s.language, R, 184, cw, acc);
      field(ctx, d('characteristic'), s.characteristic, L, 232, 380, acc);
    },
  },
  ribbons: {
    list: s => String(s.ribbons || '').split('\n').map(t => t.trim()).filter(Boolean).slice(0, 40)
      .map(parseRibbonLine),
    async prepare(s) {
      const list = this.list(s);
      const imgs = await Promise.all(list.map(r => ribbonImage(r).then(x => x.img)));
      // A line that points at a legend icon and still carries a stock name (in any
      // language) follows the display language; a custom name is kept as typed.
      const byFile = new Map((await loadLegend()).map(e => [e.png, e]));
      const names = list.map(r => autoRibbonName(r, byFile));
      return {imgs, names, blits: []};
    },
    draw(ctx, s, acc, assets) {
      const list = this.list(s);
      if (list.length > 10) text(ctx, up(d('count', {n: list.length})), 390, 40, 8, true, BLACK, 'right');
      // up to 10: 50px icons at native size (5 rows x 2 cols); up to 18: 16px text,
      // smaller icons; beyond that 8px text in two columns
      const big = list.length <= 18, cols = list.length <= 5 ? 1 : 2;
      const per = Math.ceil(list.length / cols) || 1;
      const native = big && per <= 5;
      const rowH = native ? 50 : big ? Math.min(44, Math.floor(228 / per)) : Math.min(22, Math.floor(232 / per));
      const colW = cols === 1 ? 380 : 190;
      const icon = native ? 50 : Math.max(12, big ? Math.min(32, rowH - 6) : rowH - 4);
      const top = native ? 36 : 54;
      const tx = icon + 8, maxW = colW - tx - 6;
      list.forEach(({name}, i) => {
        const r = assets?.names?.[i] ?? name;
        const col = Math.floor(i / per), row = i % per;
        const x = 10 + col * colW, y = top + row * rowH;
        const img = assets?.imgs[i];
        let sp = null;
        try { sp = img && spritePixels(img); } catch { sp = null; }  // file:// taints local images
        const pad = Math.max(1, Math.round(icon / 12));   // a little air between rows
        if (sp) assets.blits.push({sp, area: [x + pad, y + pad, icon - 2 * pad, icon - 2 * pad], fit: true, icon: 'outline'});   // every ribbon the same size
        else ribbonIcon(ctx, x + Math.floor((icon - 12) / 2), y + Math.floor((icon - 15) / 2), acc);
        const lines = big && rowH >= 38 ? wrap(up(r), 16, false, maxW) : [up(r)];
        if (lines.length === 2) {
          const ly = y + Math.max(0, Math.floor((icon - 34) / 2));
          text(ctx, lines[0], x + tx, ly, 16, false, BLACK, 'left', maxW);
          text(ctx, lines[1], x + tx, ly + 18, 16, false, BLACK, 'left', maxW);
        } else {
          const ty = y + Math.max(0, Math.floor((icon - (big ? 16 : 8)) / 2));
          text(ctx, up(r), x + tx, ty, big ? 16 : 8, !big, BLACK, 'left', maxW);
        }
      });
    },
  },
  trainer: {
    header: s => [s.trName || '—', '-'],
    async prepare(s) {
      const url = trainerImageUrl(s);
      let trImg = url ? await loadLocalImage(url) : null;
      if (!trImg && !s.trImage && !trUrl(s) && s.trSprite?.startsWith('sd:') && deviceInfo) {
        try { await fetchTrainerToDevice(s.trSprite); localImgCache.delete(url); trImg = await loadLocalImage(url); } catch {}
      }
      const ids = teamIds(s);
      const [icons, badges] = await Promise.all([Promise.all(ids.map(id => loadFirstImage(iconUrls(id)))),
        Promise.all(badgeIds(s).map(id => loadLocalImage(badgeUrl(id))))]);
      return {trImg, icons, badges, blits: []};
    },
    draw(ctx, s, acc, assets) {
      // trainer sprite, bottom-aligned on a floor line
      const area = [10, 36, 150, 186];
      let sp = null;
      try { sp = assets?.trImg && spritePixels(assets.trImg); } catch { sp = null; }
      if (sp) assets.blits.push({sp: fitPixels(sp, 150), area, valign: 'bottom'});   // 150 = area width, so wide images never spill over the text
      else silhouette(ctx, ...area, BLACK);
      ctx.fillStyle = BLACK; ctx.fillRect(10, 222, 150, 2);
      // card fields
      const x = 172, w = 218;
      [['trId', s.trId], ['game', s.trGame], ['started', s.trStart], ['time', s.trTime], ['dex', s.trDex]]
        .forEach(([k, v], i) => field(ctx, d(k), v, x, 38 + i * 30, w, acc));
      text(ctx, up(d('badges')), x, 190, 8, true, acc);
      if (assets.badges?.length) {
        // badge icons (PokeAPI), empty slots up to 8
        for (let i = 0; i < 8; i++) {
          const slot = [x + i * 27, 200, 24, 24];
          let bp = null;
          try { bp = assets.badges[i] && spritePixels(assets.badges[i]); } catch { bp = null; }
          if (bp) assets.blits.push({sp: bp, area: slot, valign: 'center', fit: true, icon: true});
          else box(ctx, slot[0] + 6, slot[1] + 6, 12, 12, false);
        }
      } else {
        // no icons chosen: 8 slots, filled up to the count
        const n = Math.max(0, Number(s.trBadges) || 0);
        if (n > 8) text(ctx, String(n), 390, 190, 8, true, BLACK, 'right');
        for (let i = 0; i < 8; i++) box(ctx, x + i * 27, 206, 20, 10, i < n, i < n ? acc : BLACK);
      }
      // team row
      ctx.fillStyle = BLACK; ctx.fillRect(10, 229, 380, 1);
      (assets?.icons || []).forEach((img, i) => {
        const slot = [10 + i * 64, 232, 60, 53];   // tall enough for the box icons at 2x
        let ip = null;
        try { ip = img && spritePixels(img); } catch { ip = null; }
        if (ip) assets.blits.push({sp: ip, area: slot, valign: 'center', fit: true, maxScale: 2, crisp: 110});
        else { box(ctx, slot[0] + 22, slot[1] + 9, 16, 16, false); }   // empty/missing slot
      });
    },
  },
  team: {
    header: s => [s.trName || '—', '-'],
    async prepare(s) {
      const ids = teamIds(s);
      // a Pokémon saved in the collection lends its nickname and level
      const cards = new Map((s.collection || []).map(c => [Number(c.data.dex), c.data]));
      if (Number(s.dex)) cards.set(Number(s.dex), s);
      const mons = await Promise.all(ids.map(async id => {
        const [img, name, p] = await Promise.all([
          getSprite(spriteUrl(s.style, id, false)).catch(() => null), monName(id, s.dispLang),
          pj(`pokemon/${id}`).catch(() => null)]);
        const c = cards.get(id);
        return {id, img, name: c?.name || name, level: c?.level,
          types: p ? p.types.sort((a, b) => a.slot - b.slot).map(x => typeKey(x.type.name)) : []};
      }));
      return {mons, blits: []};
    },
    parts: s => teamPer(s) < 6 ? Math.ceil(teamIds(s).length / teamPer(s)) : 1,
    draw(ctx, s, acc, a) {
      if (teamPer(s) < 6) return drawTeamRow(ctx, s, acc, a);
      for (let i = 0; i < 6; i++) {
        const x = 8 + (i % 3) * 128, y = 36 + Math.floor(i / 3) * 124, m = a.mons[i];
        if (!m) { box(ctx, x + 50, y + 34, 24, 24, false); continue; }   // empty slot
        let sp = null;
        try { sp = m.img && spritePixels(m.img); } catch { sp = null; }
        // no type chips: the sprite gets the room (cell 128 x 124)
        if (sp) a.blits.push({sp, area: [x, y - 2, 124, 102], valign: 'bottom', fit: 'size'});   // same size for every slot
        ctx.fillStyle = BLACK; ctx.fillRect(x + 14, y + 101, 96, 1);
        text(ctx, up(m.name), x + 62, y + 104, 8, true, BLACK, 'center', 120);
        if (m.level) text(ctx, up(`${d('lv')} ${m.level}`), x + 62, y + 114, 8, false, BLACK, 'center');
      }
    },
  },
  hof: {
    header: s => [s.hofRegion || '—', '-'],
    parts: s => teamPer(s) < 6 ? Math.ceil(hofIds(s).length / teamPer(s)) : 1,
    async prepare(s) {
      const per = teamPer(s), ids = per < 6 ? hofIds(s).slice((s._part || 0) * per, (s._part || 0) * per + per) : hofIds(s);
      const [sprites, names, bg] = await Promise.all([
        Promise.all(ids.map(id => getSprite(spriteUrl(s.style, id, false)).catch(() => null))),
        Promise.all(ids.map(id => monName(id, s.dispLang))),
        s.hofBg ? loadLocalImage(s.hofBg) : null,
      ]);
      return {ids, sprites, names, bg, blits: [], protect: []};
    },
    draw(ctx, s, acc, assets) {
      const n = assets.ids.length;
      const cols = n <= 3 ? n : 3, rows = n > 3 ? 2 : 1;
      const cw = 384 / Math.max(cols, 1), rh = rows === 2 ? 118 : 210, top = rows === 2 ? 34 : 48;
      const pix = assets.sprites.map(img => { try { return img && spritePixels(img); } catch { return null; } });
      // split in parts: exact 2x when every sprite of the page fits its cell
      const twice = teamPer(s) < 6 && pix.every(sp => !sp || (sp.w * 2 <= cw - 2 && sp.h * 2 <= rh - 17));
      assets.ids.forEach((id, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const rowCount = r === rows - 1 ? n - r * cols : cols;            // centre a short last row
        const x = 8 + (384 - rowCount * cw) / 2 + c * cw, y = top + r * rh;
        let sp = null;
        try { sp = assets.sprites[i] && spritePixels(assets.sprites[i]); } catch { sp = null; }
        if (sp) assets.blits.push({sp, area: [Math.round(x + 1), y, Math.round(cw - 2), rh - 17], valign: 'bottom', halo: 2, ...(twice ? {scale: 2} : {fit: 'size'})});
        // name plate (white box, protected from the background)
        const label = up(assets.names[i]);
        ctx.font = FONT(8, true);
        const tw = Math.min(cw - 10, Math.ceil(ctx.measureText(label).width) + 10);
        const px = Math.round(x + (cw - tw) / 2), py = y + rh - 16;
        box(ctx, px, py, tw, 14, false);
        text(ctx, label, px + tw / 2, py + 3, 8, true, BLACK, 'center', tw - 6);
        assets.protect.push([px - 1, py - 1, tw + 2, 16]);
      });
      // trainer + date strip above the page dots
      const strip = up([s.trName, s.hofDate].filter(Boolean).join('  ·  '));
      if (strip) {
        ctx.font = FONT(8, true);
        const tw = Math.ceil(ctx.measureText(strip).width) + 12, px = Math.round((W - tw) / 2);
        box(ctx, px, 272, tw, 13, true, acc);
        text(ctx, strip, W / 2, 275, 8, true, WHITE, 'center');
        assets.protect.push([px - 1, 271, tw + 2, 15]);
      }
      assets.protect.push([W / 2 - 50, 286, 100, 12]);   // page dots
    },
    // background goes under everything drawn above, then the sprites (with a white halo) on top
    finish(ink, s, opt, assets) {
      const strength = Math.min(100, Math.max(0, Number(s.hofStrength ?? 35))) / 100;
      let bg = null;
      try { bg = assets.bg && spritePixels(assets.bg); } catch { bg = null; }
      if (bg) blitSprite(ink, bg, 0, 30, W, H - 30, {...opt, valign: 'center', faint: strength, under: true, protect: assets.protect});
      else raysBackdrop(ink, 30, strength, assets.protect);
      for (const bl of assets.blits) blitSprite(ink, bl.sp, ...bl.area, {...opt, valign: bl.valign, halo: bl.halo, fit: bl.fit, icon: bl.icon, scale: bl.scale});
      assets.blits = [];
    },
  },
};

// Page keys in the order chosen in the Pages section (new pages go last); the
// Pokémon of the day always closes the rotation.
function orderedPages() {
  const all = Object.keys(PAGES).filter(k => k !== 'daily'), order = Array.isArray(state.pageOrder) ? state.pageOrder : [];
  return [...order.filter(k => all.includes(k)), ...all.filter(k => !order.includes(k))];
}
const activePages = () => [...orderedPages().filter(k => state['pg_' + k]), ...(state.pg_daily ? ['daily'] : [])];

// Classify every canvas pixel to an ink code: the pure marker colour of an ink the
// panel has (INKS[].css), else black or white by brightness.
function canvasToInk(ctx, palette) {
  const d = ctx.getImageData(0, 0, W, H).data;
  const ink = new Uint8Array(W * H);
  const hasRed = palette.includes('red');
  const marks = palette.map(inkCode).filter(c => c > 2).map(c => {
    const h = INKS[c].css; return [c, parseInt(h[1], 16) * 17, parseInt(h[2], 16) * 17, parseInt(h[3], 16) * 17];
  });
  for (let i = 0; i < W * H; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    let v = hasRed && r > 160 && g < 110 && b < 110 ? 2 : -1;
    for (let k = 0; v < 0 && k < marks.length; k++) {
      const m = marks[k];
      if (Math.abs(r - m[1]) < 60 && Math.abs(g - m[2]) < 60 && Math.abs(b - m[3]) < 60) v = m[0];
    }
    ink[i] = v > 0 ? v : (0.299 * r + 0.587 * g + 0.114 * b) < 128 ? 1 : 0;
  }
  return ink;
}

// Colour of a type chip on colour panels: the first ink of the list the panel has.
const TYPE_INK = {fire: ['orange', 'red'], water: ['blue'], grass: ['green'], electric: ['yellow'], ice: ['blue'],
  fighting: ['red'], poison: ['blue', 'red'], ground: ['orange', 'yellow'], flying: ['blue'], psychic: ['red'],
  bug: ['green', 'yellow'], rock: ['orange', 'yellow'], ghost: ['blue'], dragon: ['blue', 'red'], fairy: ['red']};
function typeFill(type, s, fallback) {
  if (!isColour(s)) return fallback;
  const name = (TYPE_INK[typeKey(type)] || []).find(n => hasInk(s, n));
  return name ? INKS[inkCode(name)].css : fallback;
}
const textOn = css => css === '#ff0' || css === '#f80' || css === '#0f0' ? BLACK : WHITE;   // light inks take black text

// s: data to draw (state, or state + a collection card); idx/total: page dots.
async function renderPage(key, s = state, idx, total, part = 0) {
  const hasRed = hasInk(s, 'red'), acc = accent(s);
  if (idx == null) {
    const plan = rotationPlan();
    total = plan.length;
    idx = key === 'daily' ? total - 1 : plan.findIndex(e => e.key === key && e.part === part && e.jobs.some(j => j.s === s || sameCard(j.s, s)));
  }
  if (part) s = {...s, _part: part};
  const page = PAGES[key];
  const work = document.createElement('canvas'); work.width = W; work.height = H;
  const ctx = work.getContext('2d', {willReadFrequently: true});
  const assets = page.prepare ? await page.prepare(s) : {blits: []};
  setFrameForChrome(frameThickness(s, key));
  if (page.bare) { ctx.fillStyle = WHITE; ctx.fillRect(0, 0, W, H); }
  else chrome(ctx, s, d(key), idx, total, ...(page.header ? page.header(s, assets) : []));
  page.draw(ctx, s, acc, assets);
  const ink = canvasToInk(ctx, panelOf(s).palette);
  const opt = {hasRed, dither: s.dither, contrast: Number(s.contrast) || 0,
    palette: isColour(s) ? panelOf(s).palette.map(inkCode) : null};
  if (page.finish) page.finish(ink, s, opt, assets);
  for (const bl of assets?.blits || []) blitSprite(ink, bl.sp, ...bl.area, {...opt, valign: bl.valign || 'center', fit: bl.fit, icon: bl.icon, maxScale: bl.maxScale, gamma: bl.gamma, crisp: bl.crisp, scale: bl.scale});
  if (page.sprite) {
    const img = await getSprite(spriteUrl(s.style, s.dex, s.shiny));
    const sp = spritePixels(img);
    if (sp) blitSprite(ink, sp, ...page.spriteArea, opt);
  }
  await applyFrame(ink, s, key);
  // number boxes the board redraws by itself (day counter, countdown, shiny counter…)
  ink.overlays = [...(assets.overlay ? [assets.overlay] : []), ...(assets.overlays || [])].slice(0, 4);
  return ink;
}

function showInk(ink) {
  const out = $('out').getContext('2d');
  const img = out.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const [r, g, b] = INKS[ink[i]].rgb;
    img.data.set([r, g, b, 255], i * 4);
  }
  out.putImageData(img, 0, 0);
}

// <codec> (extracted and run by tests/test_codec.py)
// DXF1: 12-byte header, then runs (0cccllll, llll=15 -> 16 + varint) and literals
// (1nnnnnnn + n+1 pixels packed at bpp bits, MSB first; n=127 -> 128 + varint). See include/frame_codec.h.
function encodeFrame(ink, w, h, bpp) {
  const n = w * h, out = [68, 88, 70, 49, w & 255, w >> 8, h & 255, h >> 8, bpp, 0, 0, 0];
  const minRun = Math.max(3, Math.ceil(16 / bpp) + 1);   // shorter runs are cheaper inside a literal
  const varint = v => { while (v > 127) { out.push((v & 127) | 128); v >>>= 7; } out.push(v); };
  let lit = [];
  const flush = () => {
    if (!lit.length) return;
    if (lit.length < 128) out.push(0x80 | (lit.length - 1));
    else { out.push(0xff); varint(lit.length - 128); }
    let acc = 0, bits = 0;
    for (const c of lit) { acc = ((acc << bpp) | c) & 0xfff; bits += bpp; while (bits >= 8) { out.push((acc >> (bits - 8)) & 255); bits -= 8; } }
    if (bits) out.push((acc << (8 - bits)) & 255);
    lit = [];
  };
  for (let i = 0; i < n;) {
    const c = ink[i];
    let j = i + 1;
    while (j < n && ink[j] === c) j++;
    const run = j - i;
    if (run >= minRun) {
      flush();
      if (run < 16) out.push((c << 4) | (run - 1));
      else { out.push((c << 4) | 15); varint(run - 16); }
    } else for (let k = 0; k < run; k++) lit.push(c);
    i = j;
  }
  flush();
  return new Uint8Array(out);
}
// </codec>

// Two raw 1-bit planes (black, red): the page format of firmware up to 1.4.0.
function pack(ink) {
  const buf = new Uint8Array(PLANE * 2);
  for (let i = 0; i < W * H; i++) {
    const v = ink[i];
    if (!v) continue;
    buf[(v === 1 ? 0 : PLANE) + (i >> 3)] |= 0x80 >> (i & 7);
  }
  return buf;
}

