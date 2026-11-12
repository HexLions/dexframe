// ---------- split screen and your own images ----------

// Split screen: 2 or 4 small widgets on one page. Counters keep working: the board
// redraws the boxes of the days, countdown and shiny widgets by itself.
const SPLIT_LAYOUTS = {
  h2: [[8, 36, 188, 248], [204, 36, 188, 248]],
  v2: [[8, 36, 384, 120], [8, 164, 384, 120]],
  q4: [[8, 36, 188, 120], [204, 36, 188, 120], [8, 164, 188, 120], [204, 164, 188, 120]],
};
const SPLIT_WIDGETS = ['sprite', 'days', 'countdown', 'shiny', 'team', 'dexprog', 'stats', 'none'];
const splitCells = s => (SPLIT_LAYOUTS[s.splitLayout] || SPLIT_LAYOUTS.q4).map((r, i) => [r, s['splitW' + i] || ['sprite', 'days', 'team', 'stats'][i]]);

// One number box that the board updates: label above, digits at the largest scale that fits.
function widgetNumber(ctx, a, r, label, value, mode, start, acc) {
  const [x, y, w, h] = r;
  text(ctx, up(label), x + 4, y + 4, 8, true, acc, 'left', w - 8);
  const str = fmtNum(Math.max(0, value ?? 0)), room = mode === 2 ? fmtNum(Math.max(value, 99999)) : str;
  const scale = [3, 2, 1].find(k => digitRun(room).width * k <= w - 8 && GLYPH_H * k <= h - 20) || 1;
  const ny = y + 18 + Math.max(0, Math.floor((h - 22 - GLYPH_H * scale) / 2));
  drawDigits(ctx, str, x + 4, ny, w - 8, 0, scale, BLACK);
  if (mode != null) a.overlays.push({x: x + 4, y: ny, w: w - 8, h: GLYPH_H * scale, align: 0, start, color: 0, sep: 1, mode, scale});
}

const WIDGETS = {
  sprite: {
    load: async s => ({img: await getSprite(spriteUrl(s.style, s.dex, s.shiny)).catch(() => null)}),
    draw(ctx, s, acc, r, a, L) {
      const [x, y, w, h] = r;
      let sp = null;
      try { sp = L.img && spritePixels(L.img); } catch { sp = null; }
      if (sp) a.blits.push({sp, area: [x + 2, y + 2, w - 4, h - 20], valign: 'bottom', fit: true});
      text(ctx, up(s.name), x + w / 2, y + h - 14, 8, true, BLACK, 'center', w - 8);
    },
  },
  days: {draw(ctx, s, acc, r, a) { const st = sinceDay(s); widgetNumber(ctx, a, r, d('days'), st != null ? todayDay() - st : 0, st != null ? 0 : null, st ?? 0, acc); }},
  countdown: {draw(ctx, s, acc, r, a) { const tg = parseDay(s.cdDate); widgetNumber(ctx, a, r, s.cdTitle || d('days_left'), tg != null ? tg - todayDay() : 0, tg != null ? 1 : null, tg ?? 0, acc); }},
  shiny: {draw(ctx, s, acc, r, a) { widgetNumber(ctx, a, r, d('sh_count'), Math.round(Number(deviceInfo?.counter ?? s.shCount) || 0), 2, 0, acc); }},
  team: {
    load: async s => ({imgs: await Promise.all(teamIds(s).slice(0, 6).map(id => getSprite(iconUrl(id)).catch(() => getSprite(spriteUrl(s.style, id, false)).catch(() => null))))}),
    draw(ctx, s, acc, r, a, L) {
      const [x, y, w, h] = r, n = L.imgs.length, cols = n > 4 || w > h * 1.6 ? 3 : 2, rows = Math.ceil(n / cols) || 1;
      text(ctx, up(d('team')), x + 4, y + 4, 8, true, acc);
      const cw = Math.floor((w - 4) / cols), ch = Math.floor((h - 18) / rows);
      L.imgs.forEach((img, i) => {
        let sp = null;
        try { sp = img && spritePixels(img); } catch { sp = null; }
        if (sp) a.blits.push({sp, area: [x + 2 + (i % cols) * cw, y + 16 + Math.floor(i / cols) * ch, cw, ch], fit: true});
      });
    },
  },
  dexprog: {
    draw(ctx, s, acc, r) {
      const [x, y, w, h] = r, [lo, hi] = dexRange(s), n = hi - lo + 1, have = dexCaught(s).size;
      text(ctx, up(d('dexprog')), x + 4, y + 4, 8, true, acc);
      drawDigits(ctx, Math.floor(100 * have / n) + '%', x + 4, y + 18, w - 8, 0, h > 90 ? 2 : 1, BLACK);
      text(ctx, `${fmtNum(have)} / ${fmtNum(n)}`, x + 4, y + h - 32, 8, false, BLACK);
      box(ctx, x + 4, y + h - 18, w - 8, 10, false);
      ctx.fillStyle = acc; ctx.fillRect(x + 6, y + h - 16, Math.round((w - 12) * have / n), 6);
    },
  },
  stats: {
    draw(ctx, s, acc, r) {
      const [x, y, w, h] = r, keys = ['ps', 'att', 'dif', 'atsp', 'dfsp', 'vel'], lh = Math.floor((h - 8) / 6);
      keys.forEach((k, i) => {
        const yy = y + 4 + i * lh, v = Number(s[k]) || 0;
        text(ctx, up(d(k)), x + 4, yy + Math.floor((lh - 8) / 2), 8, true, BLACK, 'left', 52);
        text(ctx, String(v), x + 92, yy + Math.floor((lh - 8) / 2), 8, false, BLACK, 'right');
        box(ctx, x + 98, yy + 2, w - 104, Math.max(4, lh - 4), false);
        ctx.fillStyle = i === 5 ? acc : BLACK; ctx.fillRect(x + 100, yy + 4, Math.round((w - 108) * Math.min(v, 255) / 255), Math.max(1, lh - 8));
      });
    },
  },
  none: {draw() {}},
};

// Your own pictures: stored on the board (/www/img/…), one per turn ('v' pool: the next
// picture every time the entry comes up). Dithered with Floyd-Steinberg to the inks.
const boardUrl = path => {
  const base = String(state.deviceUrl || '').trim().replace(/\/+$/, '');
  return base ? (/^https?:\/\//i.test(base) ? base : 'http://' + base) + '/' + path : path;
};
POOL_PAGES.images = (s, part) => ({mode: 'v', jobs: (s.images?.length ? s.images : [null]).map((im, k) => ({key: 'images', s: {...s, _img: k}, part}))});

function ditherFS(rgba, w, h, palette) {
  const inks = palette.map(c => [c, INKS[c].rgb]), err = new Float32Array(w * h * 3), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, o = i * 4;
    const r = rgba[o] + err[i * 3], g = rgba[o + 1] + err[i * 3 + 1], b = rgba[o + 2] + err[i * 3 + 2];
    let best = inks[0], bd = Infinity;
    for (const k of inks) { const dd = 2 * (r - k[1][0]) ** 2 + 4 * (g - k[1][1]) ** 2 + 3 * (b - k[1][2]) ** 2; if (dd < bd) { bd = dd; best = k; } }
    out[i] = best[0];
    const er = [r - best[1][0], g - best[1][1], b - best[1][2]];
    for (const [dx, dy, f] of [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || xx >= w || yy >= h) continue;
      const j = (yy * w + xx) * 3;
      err[j] += er[0] * f; err[j + 1] += er[1] * f; err[j + 2] += er[2] * f;
    }
  }
  return out;
}

Object.assign(PAGES, {
  split: {
    header: s => [s.splitTitle || s.name, s.splitTitle ? '-' : s.gender],
    async prepare(s) {
      const cells = splitCells(s);
      const loads = await Promise.all(cells.map(([, k]) => WIDGETS[k]?.load ? WIDGETS[k].load(s).catch(() => ({})) : {}));
      return {cells, loads, blits: [], overlays: []};
    },
    draw(ctx, s, acc, a) {
      a.cells.forEach(([r, k], i) => {
        box(ctx, r[0], r[1], r[2], r[3], false);
        (WIDGETS[k] || WIDGETS.none).draw(ctx, s, acc, [r[0] + 1, r[1] + 1, r[2] - 2, r[3] - 2], a, a.loads[i] || {});
      });
      a.overlays.length = Math.min(a.overlays.length, 4);
    },
  },
  images: {
    bare: true,       // the picture is the page: no header, no page dots
    async prepare(s) {
      const list = s.images || [], it = list[s._img ?? state._previewImg ?? 0] || list[0];
      const img = it ? await loadLocalImage(boardUrl(it.src)) : null;
      return {it, img, blits: []};
    },
    draw(ctx, s, acc, a) {
      if (!a.img) { text(ctx, up(t('im_none')), W / 2, 140, 8, true, BLACK, 'center', 380); return; }
      const iw = a.img.naturalWidth, ih = a.img.naturalHeight, cap = a.it.caption ? 22 : 0, ah = H - cap;
      const k = a.it.fit === 'contain' ? Math.min(W / iw, ah / ih) : Math.max(W / iw, ah / ih);
      ctx.fillStyle = WHITE; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(a.img, (W - iw * k) / 2, (ah - ih * k) / 2, iw * k, ih * k);
      a.photo = ctx.getImageData(0, 0, W, ah).data;       // dithered in finish()
      if (cap) { ctx.fillStyle = BLACK; ctx.fillRect(0, ah, W, cap); text(ctx, up(a.it.caption), W / 2, ah + 7, 8, true, WHITE, 'center', 380); }
    },
    finish(ink, s, opt, a) {
      if (!a.photo) return;
      const h = a.photo.length / 4 / W, out = ditherFS(a.photo, W, h, panelOf(s).palette.map(inkCode));
      ink.set(out, 0);
    },
  },
});
