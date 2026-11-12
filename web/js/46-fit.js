// ---------- panels bigger than the page ----------
// Pages are drawn at 400x300. A bigger panel (e.g. 7.3", 800x480) gets them scaled up
// (nearest neighbour) to fit, centred on white; the number boxes move and grow with the
// page, and are drawn again here exactly as the board will draw them, so the frame and
// the board's own updates match pixel for pixel.
function boardValue(o, counter) {
  if (o.mode === 2) return counter;
  if (o.mode === 3) return Math.floor(100 * (1 - Math.pow(1 - 1 / Math.max(2, o.start), counter)));
  return o.mode === 1 ? o.start - todayDay() : todayDay() - o.start;
}

// Mirror of layoutOverlay() + paintOverlay() in src/main.cpp, into an ink array pw wide.
function paintBoardOverlay(ink, pw, o, g, counter) {
  const n = g[2], gw = g[0], gh = g[1], stride = Math.ceil(gw / 8), adv = g.subarray(3, 3 + n), bits = 3 + n;
  const digits = String(Math.max(0, boardValue(o, counter))), idx = [];
  [...digits].forEach((c, i) => {
    if (o.sep && n > 10 && i > 0 && (digits.length - i) % 3 === 0) idx.push(10);
    idx.push(Number(c));
  });
  if (o.mode === 3 && n > 11) idx.push(11);
  const sc = o.scale || 1, total = idx.reduce((a, k) => a + adv[k] * sc, 0);
  let x = o.align === 2 ? o.x + o.w - total : o.align === 1 ? o.x + Math.floor((o.w - total) / 2) : o.x;
  for (let yy = o.y; yy < o.y + o.h; yy++) ink.fill(0, yy * pw + o.x, yy * pw + o.x + o.w);
  for (const k of idx) {
    const base = bits + k * gh * stride;
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      if (!(g[base + gy * stride + (gx >> 3)] & (0x80 >> (gx & 7)))) continue;
      for (let dx = 0; dx < sc; dx++) {
        const px = x + (gx - 2) * sc + dx;
        if (px < o.x || px >= o.x + o.w) continue;
        for (let dy = 0; dy < sc && gy * sc + dy < o.h; dy++) ink[(o.y + gy * sc + dy) * pw + px] = (o.color || 0) + 1;
      }
    }
    x += adv[k] * sc;
  }
}

function fitInk(ink, pw, ph, counter = 0) {
  const k = Math.min(pw / W, ph / H), ow = Math.round(W * k), oh = Math.round(H * k);
  const ox = Math.floor((pw - ow) / 2), oy = Math.floor((ph - oh) / 2);
  const out = new Uint8Array(pw * ph);
  for (let y = 0; y < oh; y++) {
    const sy = Math.min(H - 1, Math.floor(y / k)), row = (oy + y) * pw + ox;
    for (let x = 0; x < ow; x++) out[row + x] = ink[sy * W + Math.min(W - 1, Math.floor(x / k))];
  }
  const g = buildGlyphs();
  out.overlays = (ink.overlays || []).map(o => {
    const sc = Math.max(1, Math.min(4, Math.round((o.scale || 1) * k)));
    const m = {...o, x: ox + Math.floor(o.x * k), y: oy + Math.floor(o.y * k), w: Math.floor(o.w * k), scale: sc};
    m.h = Math.min(Math.floor(o.h * k), ph - m.y);
    paintBoardOverlay(out, pw, m, g, counter);
    return m;
  });
  return out;
}
