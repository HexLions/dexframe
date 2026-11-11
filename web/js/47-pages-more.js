// ---------- more pages: countdown, move details, IV/EV chart, evolutions, Pokédex entry ----------
const teamPer = s => [2, 3].includes(Number(s.teamPer)) ? Number(s.teamPer) : 6;

// Team split over several pages: one row of 3 or 2 Pokémon with room for big sprites.
// Exact 2x when every sprite of the page fits its cell, otherwise one common size.
function drawTeamRow(ctx, s, acc, a) {
  const per = teamPer(s), mons = a.mons.slice((s._part || 0) * per, (s._part || 0) * per + per);
  const cw = 384 / per, top = 36, ah = 206;
  const pix = mons.map(m => { try { return m.img && spritePixels(m.img); } catch { return null; } });
  const twice = pix.every(sp => !sp || (sp.w * 2 <= cw - 4 && sp.h * 2 <= ah));
  mons.forEach((m, i) => {
    const x = Math.round(8 + i * cw);
    if (pix[i]) a.blits.push({sp: pix[i], area: [x + 2, top, Math.round(cw - 4), ah], valign: 'bottom', ...(twice ? {scale: 2} : {fit: 'size'})});
    ctx.fillStyle = BLACK; ctx.fillRect(x + 12, top + ah + 1, Math.round(cw - 24), 1);
    text(ctx, up(m.name), x + cw / 2, top + ah + 6, 16, true, BLACK, 'center', cw - 8);
    if (m.level) text(ctx, up(`${d('lv')} ${m.level}`), x + cw / 2, top + ah + 26, 8, false, BLACK, 'center');
  });
}

// Digits drawn from the same strip the board uses (buildGlyphs), as scale x scale
// blocks: what the firmware redraws every midnight matches pixel for pixel
// (paintOverlay in src/main.cpp).
function digitRun(str) {
  const g = buildGlyphs(), n = g[2], sep = numSep();
  const idx = [...String(str)].map(ch => ch === sep ? 10 : ch >= '0' && ch <= '9' ? Number(ch) : -1).filter(k => k >= 0 && k < n);
  return {g, idx, width: idx.reduce((a, k) => a + g[3 + k], 0)};
}
function drawDigits(ctx, str, x0, y0, w, align, scale, color) {
  const {g, idx, width} = digitRun(str);
  const gw = g[0], gh = g[1], n = g[2], stride = Math.ceil(gw / 8);
  let x = align === 2 ? x0 + w - width * scale : align === 1 ? x0 + Math.floor((w - width * scale) / 2) : x0;
  ctx.fillStyle = color;
  for (const k of idx) {
    const base = 3 + n + k * gh * stride;
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      if (!(g[base + gy * stride + (gx >> 3)] & (0x80 >> (gx & 7)))) continue;
      const px = x + (gx - 2) * scale, l = Math.max(px, x0), r = Math.min(px + scale, x0 + w);
      if (r > l) ctx.fillRect(l, y0 + gy * scale, r - l, scale);
    }
    x += g[3 + k] * scale;
  }
}

// Crisp 1-bit line (the canvas' own strokes are anti-aliased). dash: pixels on / off.
function line(ctx, x0, y0, x1, y1, color, thick = 1, dash = 0) {
  ctx.fillStyle = color;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, n = 0;
  for (;;) {
    if (!dash || Math.floor(n / dash) % 2 === 0) ctx.fillRect(x0 - (thick >> 1), y0 - (thick >> 1), thick, thick);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
    n++;
  }
}

// A move name typed in any language -> PokeAPI slug, through the name tables in pkx/.
async function moveSlug(name) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return '';
  const en = await pkxData('en').catch(() => null);
  if (en?.moves) for (const l of Object.keys(LANGS)) {
    const T = l === 'en' ? en : await pkxData(l).catch(() => null);
    const i = T?.moves ? T.moves.findIndex(m => m && m.toLowerCase() === key) : -1;
    if (i > 0 && en.moves[i]) return sdSlug(en.moves[i]);
  }
  return sdSlug(name);
}

// "31/31/31/31/31/31" -> six numbers (HP Atk Def SpA SpD Spe), or null.
const six = v => { const a = String(v ?? '').split(/[^0-9]+/).filter(Boolean).map(Number); return a.length === 6 ? a : null; };
const decimal = v => v.toFixed(1).replace('.', state.dispLang === 'en' ? '.' : ',');
const slugWords = v => String(v || '').replace(/-/g, ' ');

// How a species evolves from the previous stage, in a few words.
function evoMethod(det) {
  if (!det) return '';
  if (det.min_level) return `${d('lv')} ${det.min_level}`;
  if (det.item) return slugWords(det.item.name);
  if (det.trigger?.name === 'trade') return det.held_item ? `${d('evo_trade')} + ${slugWords(det.held_item.name)}` : d('evo_trade');
  if (det.min_happiness) return d('evo_friend');
  if (det.known_move) return slugWords(det.known_move.name);
  if (det.held_item) return slugWords(det.held_item.name);
  if (det.location) return slugWords(det.location.name);
  return slugWords(det.trigger?.name);
}

Object.assign(PAGES, {
  countdown: {
    sprite: true,
    spriteArea: [12, 62, 200, 214],
    draw(ctx, s, acc, assets) {
      const x = 226, w = 164, target = parseDay(s.cdDate);
      wrapLines(up(s.cdTitle || d('countdown')), 16, true, w).slice(0, 3).forEach((l, i) => text(ctx, l, x, 40 + i * 19, 16, true, BLACK));
      ctx.fillStyle = BLACK; ctx.fillRect(12, 276, 200, 2);
      if (target == null) { text(ctx, '—', x, 118, 16, false, BLACK); return; }
      const str = fmtNum(Math.max(0, target - todayDay()));
      const scale = [3, 2].find(k => digitRun(str).width * k <= w) || 1, y = 118;
      text(ctx, up(d('days_left')), x, y - 12, 8, true, acc);
      drawDigits(ctx, str, x, y, w, 0, scale, BLACK);
      // the board redraws this box every midnight, counting down to the date
      assets.overlay = {x, y, w, h: GLYPH_H * scale, align: 0, start: target, color: 0, sep: 1, mode: 1, scale};
      field(ctx, d('cd_date'), s.cdDate, x, y + GLYPH_H * scale + 14, w, acc);
    },
  },
  movedex: {
    async prepare(s) {
      const moves = await Promise.all([0, 1, 2, 3].map(async i => {
        const n = String(s['move' + i] || '').trim();
        if (!n) return null;
        try { return await pj('move/' + await moveSlug(n)); } catch { return null; }
      }));
      return {moves, blits: []};
    },
    draw(ctx, s, acc, a) {
      for (let i = 0; i < 4; i++) {
        const y = 40 + i * 61, m = a.moves[i], cat = m?.damage_class?.name;
        box(ctx, 10, y, 380, 53, false);
        ctx.fillStyle = typeFill(s['mtype' + i], s, acc); ctx.fillRect(10, y, 12, 53);
        text(ctx, up(s['move' + i] || '—'), 30, y + 8, 16, true, BLACK, 'left', 204);
        text(ctx, up([typeName(s['mtype' + i]), cat ? d('cat_' + cat) : ''].filter(Boolean).join(' · ')), 30, y + 34, 8, true, BLACK, 'left', 204);
        ctx.fillStyle = BLACK; ctx.fillRect(242, y + 6, 1, 41);
        [['pow', m?.power], ['acc', m?.accuracy], ['pp', m?.pp]].forEach(([k, v], c) => {
          const cx = 268 + c * 48;
          text(ctx, up(d(k)), cx, y + 8, 8, true, acc, 'center');
          text(ctx, v != null ? String(v) : '—', cx, y + 24, 16, false, BLACK, 'center');
        });
      }
    },
  },
  radar: {
    draw(ctx, s, acc) {
      const ring = ['ps', 'att', 'dif', 'vel', 'dfsp', 'atsp'];      // clockwise from the top, as in the games
      const list = ['ps', 'att', 'dif', 'atsp', 'dfsp', 'vel'];      // order of the IV / EV fields
      const vals = ring.map(k => Number(s[k]) || 0), ivs = six(s.ivs), evs = six(s.evs);
      const cx = 118, cy = 168, R = 78, top = Math.max(...vals, 1);
      const pt = (i, f, r = R) => {
        const an = -Math.PI / 2 + i * Math.PI / 3;
        return [Math.round(cx + Math.cos(an) * r * f), Math.round(cy + Math.sin(an) * r * f)];
      };
      const poly = (fs, color, thick, dash) => fs.forEach((f, i) => line(ctx, ...pt(i, f), ...pt((i + 1) % 6, fs[(i + 1) % 6]), color, thick, dash));
      for (let i = 0; i < 6; i++) line(ctx, cx, cy, ...pt(i, 1), BLACK, 1, 2);
      poly(Array(6).fill(1), BLACK, 1);
      poly(Array(6).fill(0.5), BLACK, 1, 2);
      if (evs) poly(ring.map(k => Math.max(0.04, Math.min(1, evs[list.indexOf(k)] / 252))), acc, hasInk(s, 'red') ? 2 : 1, hasInk(s, 'red') ? 0 : 3);
      poly(vals.map(v => Math.max(0.06, v / top)), BLACK, 3);
      ring.forEach((k, i) => {
        const [lx, ly] = pt(i, 1, R + 20);
        text(ctx, up(d(k)), Math.max(26, lx), ly - 10, 8, true, BLACK, 'center');
        text(ctx, String(vals[i]), Math.max(26, lx), ly, 8, false, BLACK, 'center');
      });
      // table: stat, IV, EV
      const x = 244;
      text(ctx, 'IV', 338, 40, 8, true, acc, 'right');
      text(ctx, 'EV', 390, 40, 8, true, acc, 'right');
      list.forEach((k, i) => {
        const y = 54 + i * 34;
        text(ctx, up(d(k)), x, y, 8, true, BLACK);
        text(ctx, String(Number(s[k]) || 0), x, y + 10, 16, true, BLACK);
        text(ctx, ivs ? String(ivs[i]) : '—', 338, y + 10, 16, false, BLACK, 'right');
        text(ctx, evs ? String(evs[i]) : '—', 390, y + 10, 16, false, BLACK, 'right');
      });
      if (evs) text(ctx, `${up(d('total'))} EV ${evs.reduce((a, b) => a + b, 0)}`, 390, 266, 8, true, BLACK, 'right');
    },
  },
  evo: {
    async prepare(s) {
      const sp = await pj(`pokemon-species/${Number(s.dex)}`);
      const chain = (await pj(sp.evolution_chain.url)).chain;
      // the line through this species, continued along the first branch
      const find = (node, trail) => {
        const here = [...trail, node];
        if (node.species.name === sp.name) return here;
        for (const next of node.evolves_to) { const hit = find(next, here); if (hit) return hit; }
        return null;
      };
      let path = find(chain, []) || [chain];
      const branches = path[path.length - 1].evolves_to.length;
      while (path[path.length - 1].evolves_to.length) path.push(path[path.length - 1].evolves_to[0]);
      const at = path.findIndex(n => n.species.name === sp.name);
      if (path.length > 4) path = path.slice(Math.min(Math.max(0, at - 1), path.length - 4)).slice(0, 4);
      const stages = await Promise.all(path.map(async node => {
        const id = Number(node.species.url.match(/\/(\d+)\/?$/)[1]);
        const [img, name] = await Promise.all([getSprite(spriteUrl(s.style, id, false)).catch(() => null), monName(id, s.dispLang)]);
        return {id, img, name, method: evoMethod(node.evolution_details?.[0]), current: node.species.name === sp.name};
      }));
      return {stages, branches, blits: []};
    },
    draw(ctx, s, acc, a) {
      const n = a.stages.length, cw = 384 / n;
      if (a.branches > 1) text(ctx, `+${a.branches - 1}`, 390, 40, 8, true, acc, 'right');   // other branches not shown
      a.stages.forEach((st, i) => {
        const x = Math.round(8 + i * cw);
        let sp = null;
        try { sp = st.img && spritePixels(st.img); } catch { sp = null; }
        if (sp) a.blits.push({sp, area: [x + 4, 44, Math.round(cw - 8), 154], valign: 'bottom', fit: 'size'});
        ctx.fillStyle = BLACK; ctx.fillRect(x + 10, 200, Math.round(cw - 20), 1);
        text(ctx, up(st.name), x + cw / 2, 206, 8, true, BLACK, 'center', cw - 6);
        text(ctx, `#${String(st.id).padStart(4, '0')}`, x + cw / 2, 217, 8, false, BLACK, 'center');
        if (st.current) { ctx.fillStyle = acc; ctx.fillRect(x + 10, 229, Math.round(cw - 20), 3); }
        if (i > 0) {   // arrow on the boundary with the previous stage, how it evolves below
          const bx = x - 1;
          ctx.fillStyle = BLACK;
          for (let c = 0; c < 5; c++) ctx.fillRect(bx - 2 + c, 240 + c, 1, 9 - 2 * c);   // small right-pointing triangle
          wrapLines(up(st.method), 8, true, cw - 4).slice(0, 2).forEach((l, r) => text(ctx, l, bx, 258 + r * 11, 8, true, BLACK, 'center'));
        }
      });
    },
  },
  dexinfo: {
    sprite: true,
    spriteArea: [10, 36, 150, 132],
    async prepare(s) {
      const id = Number(s.dex), lang = state.dispLang;
      const [p, sp] = await Promise.all([pj(`pokemon/${id}`).catch(() => null), pj(`pokemon-species/${id}`).catch(() => null)]);
      return {p, sp, blits: [],
        genus: sp ? (sp.genera.find(g => g.language.name === lang) || sp.genera.find(g => g.language.name === 'en') || {}).genus || '' : '',
        flavor: sp ? pickFlavor(sp, s.style, lang) : ''};
    },
    draw(ctx, s, acc, a) {
      ctx.fillStyle = BLACK; ctx.fillRect(10, 170, 150, 2);
      const x = 172, w = 218;
      text(ctx, `#${String(s.dex).padStart(4, '0')}`, x, 40, 16, true, BLACK);
      wrapLines(up(a.genus), 8, true, w).slice(0, 2).forEach((l, i) => text(ctx, l, x, 62 + i * 11, 8, true, BLACK));
      field(ctx, d('height'), a.p ? `${decimal(a.p.height / 10)} m` : '', x, 90, 100, acc);
      field(ctx, d('weight'), a.p ? `${decimal(a.p.weight / 10)} kg` : '', x + 112, 90, 106, acc);
      field(ctx, d('egg'), a.sp ? a.sp.egg_groups.map(g => slugWords(g.name)).join(' / ') : '', x, 128, w, acc);
      const fl = up(a.flavor || d('flavor_none'));
      let lines = wrapLines(fl, 16, false, 372), px = 16, lh = 19;
      if (lines.length > 5) { lines = wrapLines(fl, 8, false, 372).slice(0, 9); px = 8; lh = 11; }
      const top = 180 + Math.max(0, Math.floor((102 - lines.length * lh) / 2));
      lines.forEach((l, i) => text(ctx, l, 14, top + i * lh, px, false, BLACK));
    },
  },
});
