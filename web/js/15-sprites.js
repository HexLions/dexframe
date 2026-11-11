// ---------- sprites ----------
const spriteCache = new Map();
function getSprite(url) {
  if (!spriteCache.has(url)) {
    spriteCache.set(url, new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';   // needed for getImageData
      img.onload = () => res(img);
      img.onerror = () => { spriteCache.delete(url); rej(new Error(t('st_sprite'))); };
      img.src = url;
    }));
  }
  return spriteCache.get(url);
}

// Crop the transparent margin so the sprite can be scaled as large as possible.
function spritePixels(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d', {willReadFrequently: true});
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) {
    if (d[(y * c.width + i) * 4 + 3] >= 128) {
      if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return {w: x1 - x0 + 1, h: y1 - y0 + 1, at: (i, y) => {
    const o = ((y + y0) * c.width + (i + x0)) * 4;
    return [d[o], d[o + 1], d[o + 2], d[o + 3]];
  }};
}

// Ordered-dither matrices, one per integer scale: shading lives *inside* each
// sprite pixel's block, so the pixel grid stays crisp.
const BAYER = {
  2: [[0,2],[3,1]],
  3: [[0,7,3],[6,5,2],[4,1,8]],
  4: [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]],
};

// Same box, same size: scales by any factor (nearest neighbour) so every sprite in a
// row fills its cell, then a screen-space 4x4 dither. icon: black outline + darker
// tones, for small colourful pictures (badges, ribbons, box icons) that would
// otherwise dither to almost nothing.
// Area-average resize to an exact size (downscaling only).
function resamplePixels(sp, w, h) {
  const out = new Uint8ClampedArray(w * h * 4), fx = sp.w / w, fy = sp.h / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let sy = Math.floor(y * fy); sy < Math.min(sp.h, Math.ceil((y + 1) * fy)); sy++)
      for (let sx = Math.floor(x * fx); sx < Math.min(sp.w, Math.ceil((x + 1) * fx)); sx++) {
        const [pr, pg, pb, pa] = sp.at(sx, sy);
        r += pr * pa; g += pg * pa; b += pb * pa; a += pa; n++;
      }
    const o = (y * w + x) * 4;
    if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
    out[o + 3] = n ? a / n : 0;
  }
  return {w, h, at: (x, y) => { const o = (y * w + x) * 4; return [out[o], out[o + 1], out[o + 2], out[o + 3]]; }};
}
function blitFit(ink, sp, ax, ay, aw, ah, opt) {
  if (!opt.icon && opt.fit !== 'size') {
    // fit: true = keep whole pixels. Nearest integer scale that fits (8% slack), so every
    // slot is about the same size and stays crisp; bigger ones are area-averaged down.
    const kf = Math.min(aw / sp.w, ah / sp.h);
    if (kf >= 1) {
      let s = Math.min(opt.maxScale || 3, Math.round(kf));
      if (s * sp.w > aw * 1.08 || s * sp.h > ah * 1.08) s = Math.max(1, Math.floor(kf));
      return blitSprite(ink, sp, ax, ay, aw, ah, {...opt, fit: false, scale: s});
    }
    return blitSprite(ink, resamplePixels(sp, Math.max(1, Math.round(sp.w * kf)), Math.max(1, Math.round(sp.h * kf))), ax, ay, aw, ah, {...opt, fit: false, scale: 1});
  }
  if (Math.max(sp.w / aw, sp.h / ah) > 1) sp = resamplePixels(sp, Math.max(1, Math.round(sp.w * Math.min(aw / sp.w, ah / sp.h))), Math.max(1, Math.round(sp.h * Math.min(aw / sp.w, ah / sp.h))));
  const k = Math.min(aw / sp.w, ah / sp.h, opt.maxScale || 3);
  const w = Math.max(1, Math.round(sp.w * k)), h = Math.max(1, Math.round(sp.h * k));
  const ox = ax + Math.floor((aw - w) / 2);
  const oy = opt.valign === 'center' ? ay + Math.floor((ah - h) / 2) : ay + (ah - h);
  const src = (x, y) => sp.at(Math.min(sp.w - 1, Math.floor(x / k)), Math.min(sp.h - 1, Math.floor(y / k)));
  const solid = (x, y) => x >= 0 && y >= 0 && x < sp.w && y < sp.h && sp.at(x, y)[3] >= 128;
  const protect = opt.protect || [];
  const isProtected = (px, py) => protect.some(([rx, ry, rw, rh]) => px >= rx && px < rx + rw && py >= ry && py < ry + rh);
  if (opt.halo) {
    const hl = opt.halo;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (src(x, y)[3] < 128) continue;
      for (let py = oy + y - hl; py <= oy + y + hl; py++) for (let px = ox + x - hl; px <= ox + x + hl; px++)
        if (px >= 0 && py >= 0 && px < W && py < H) ink[py * W + px] = 0;
    }
  }
  // line-art threshold: the darkest colours of this sprite (its outlines), at most L 48
  let LINE_L = 48, cdf = null;
  if (!opt.icon) {
    const ls = [];
    for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) {
      const [r, g, b, a] = sp.at(x, y);
      if (a >= 128) ls.push(0.299 * r + 0.587 * g + 0.114 * b);
    }
    ls.sort((p, q) => p - q);
    LINE_L = Math.min(48, (ls[Math.floor(ls.length * 0.08)] ?? 0) + 6);   // darkest ~8% of pixels
    // histogram equalisation: tones spread by how much of the sprite has them, so big
    // areas of different colour (blue body, red chest) get clearly different textures
    const below = L => { let lo = 0, hi = ls.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ls[m] < L) lo = m + 1; else hi = m; } return lo; };
    const cache = new Map();
    cdf = L => {
      const key = Math.round(L);
      if (!cache.has(key)) { const a = below(key - 0.5), b = below(key + 0.5); cache.set(key, (a + b) / 2 / ls.length); }
      return cache.get(key);
    };
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b, a] = src(x, y);
    if (a < 128) continue;
    const px = ox + x, py = oy + y;
    if (px < 0 || py < 0 || px >= W || py >= H) continue;
    if (opt.under && (ink[py * W + px] || isProtected(px, py))) continue;
    const red = opt.hasRed && r > 140 && r > g * 1.5 && r > b * 1.5;
    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    let dark = Math.min(1, Math.max(0, (255 - L) / 255 + opt.contrast / 100));
    if (!opt.icon) {
      // scaled sprites (team, Hall of Fame): the sprite's own line art (its darkest
      // pixels, and dark pixels on a strong contrast step) stays black; colour areas
      // become a lighter texture so faces don't melt into one dark patch. 1 px outline.
      const sx = Math.floor(x / k), sy = Math.floor(y / k);
      const edge = !solid(sx - 1, sy) || !solid(sx + 1, sy) || !solid(sx, sy - 1) || !solid(sx, sy + 1);
      const lum = (i, j) => { const q = sp.at(i, j); return 0.299 * q[0] + 0.587 * q[1] + 0.114 * q[2]; };
      const line = L < LINE_L || (L < 100 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => solid(sx + dx, sy + dy) && lum(sx + dx, sy + dy) - L > 90));
      dark = edge || line ? 1 : Math.min(0.85, Math.max(0.05, 0.1 + 0.75 * (1 - cdf(L)) + opt.contrast / 100));
    }
    if (opt.icon) {
      if (opt.icon !== 'outline') dark = Math.max(dark, 1 - Math.pow(L / 255, 2.2));   // pastel colours still show
      const sx = Math.floor(x / k), sy = Math.floor(y / k);
      if (!solid(sx - 1, sy) || !solid(sx + 1, sy) || !solid(sx, sy - 1) || !solid(sx, sy + 1)) dark = 1;   // outline
    }
    if (opt.faint != null) dark *= opt.faint;
    ink[py * W + px] = red && opt.faint == null ? 2 : dark > (BAYER[4][py & 3][px & 3] + 0.5) / 16 ? 1 : 0;
  }
}
function blitSprite(ink, sp, ax, ay, aw, ah, opt) {
  if (opt.fit) return blitFit(ink, sp, ax, ay, aw, ah, opt);
  const scale = opt.scale || Math.max(1, Math.min(4, Math.floor(Math.min(aw / sp.w, ah / sp.h))));
  const ox = ax + Math.floor((aw - sp.w * scale) / 2);
  const oy = opt.valign === 'center'
    ? ay + Math.floor((ah - sp.h * scale) / 2)
    : ay + (ah - sp.h * scale);          // bottom-aligned: feet on the "floor"
  const blocks = opt.dither === 'blocks';
  const m = blocks ? BAYER[scale] || null : null;
  const n = m ? scale * scale : 0;
  if (opt.halo) {   // clear a white margin around the sprite so it reads over a background
    const hl = opt.halo;
    for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) {
      if (sp.at(x, y)[3] < 128) continue;
      for (let py = oy + y * scale - hl; py < oy + (y + 1) * scale + hl; py++)
        for (let px = ox + x * scale - hl; px < ox + (x + 1) * scale + hl; px++)
          if (px >= 0 && py >= 0 && px < W && py < H) ink[py * W + px] = 0;
    }
  }
  const protect = opt.protect || [];
  const isProtected = (px, py) => protect.some(([rx, ry, rw, rh]) => px >= rx && px < rx + rw && py >= ry && py < ry + rh);
  for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) {
    const [r, g, b, a] = sp.at(x, y);
    if (a < 128) continue;
    const red = opt.hasRed && r > 140 && r > g * 1.5 && r > b * 1.5;
    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    let dark = Math.min(1, Math.max(0, (255 - L) / 255 + opt.contrast / 100));
    if (opt.gamma) dark = Math.max(dark, 1 - Math.pow(L / 255, opt.gamma));   // small icons: darker tones
    if (opt.crisp) {   // tiny icons: outline + dark details, no dither texture
      const solid = (i, j) => i >= 0 && j >= 0 && i < sp.w && j < sp.h && sp.at(i, j)[3] >= 128;
      // three levels: outline and darkest tones black, mid tones a 50% checker, light tones white
      const edge = !solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1);
      dark = edge || L < opt.crisp ? 1 : L < opt.crisp + 80 ? 0.5 : 0;
    }
    if (opt.faint != null) dark *= opt.faint;   // background: lighter, never solid
    for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
      const px = ox + x * scale + sx, py = oy + y * scale + sy;
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      if (opt.under && (ink[py * W + px] || isProtected(px, py))) continue;   // keep text/plates on top
      let v;
      if (red && opt.faint == null) v = 2;
      else if (opt.crisp) v = dark === 0.5 ? (px + py) & 1 : dark;
      else if (m) v = dark > (m[sy][sx] + 0.5) / n ? 1 : 0;
      else if (blocks) v = dark > (BAYER[4][py & 3][px & 3] + 0.5) / 16 ? 1 : 0;  // 1:1: classic screen-space dither
      else v = dark > 0.5 ? 1 : 0;
      ink[py * W + px] = v;
    }
  }
}

