// ---------- drawing primitives ----------
const FONT = (px, bold) => `${bold ? '700' : '400'} ${px}px Silkscreen, monospace`;
const BLACK = '#000', WHITE = '#fff';

// Text as hard 1-bit pixels (no anti-aliasing) so it survives quantization in
// either polarity. If it doesn't fit maxW at `px`, it steps down to 8px.
const textCanvas = document.createElement('canvas');
// Silkscreen Bold draws "#" and "4" as blobs at 1 bit: in bold text those two use the
// regular glyph (struck twice, 1 px apart, from 16 px), centred in the bold advance.
const BOLD_FIX = /[#4]/;
function text(ctx, str, x, y, px, bold, color, align = 'left', maxW = Infinity) {
  const tc = textCanvas.getContext('2d', {willReadFrequently: true});
  str = String(str);
  tc.font = FONT(px, bold);
  let tw = Math.ceil(tc.measureText(str).width);
  if (tw > maxW && px > 8) {
    y += Math.round((px - 8) / 2); px = 8; tc.font = FONT(px, bold);
    tw = Math.ceil(tc.measureText(str).width);
  }
  textCanvas.width = tw + 4; textCanvas.height = px * 2;
  tc.font = FONT(px, bold); tc.textBaseline = 'top'; tc.fillStyle = '#000';
  if (bold && BOLD_FIX.test(str)) {
    let cx = 2;
    for (const c of str) {
      tc.font = FONT(px, true);
      const adv = tc.measureText(c).width;
      if (BOLD_FIX.test(c)) {
        tc.font = FONT(px, false);
        const off = Math.round(cx + (adv - tc.measureText(c).width - 1) / 2);
        tc.fillText(c, off, 0);
        if (px >= 16) tc.fillText(c, off + 1, 0);   // at 8 px the plain glyph is already heavy enough
      } else tc.fillText(c, cx, 0);
      cx += adv;
    }
  } else tc.fillText(str, 2, 0);
  const d = tc.getImageData(0, 0, textCanvas.width, textCanvas.height).data;
  const x0 = Math.round(align === 'right' ? x - tw : align === 'center' ? x - tw / 2 : x) - 2;
  ctx.fillStyle = color;
  for (let j = 0; j < textCanvas.height; j++) for (let i = 0; i < textCanvas.width; i++)
    if (d[(j * textCanvas.width + i) * 4 + 3] >= 60) ctx.fillRect(x0 + i, y + j, 1, 1);
  return tw;
}

// Split at the last space that fits maxW; returns 1 or 2 lines.
function wrap(str, px, bold, maxW) {
  const tc = textCanvas.getContext('2d');
  tc.font = FONT(px, bold);
  if (tc.measureText(str).width <= maxW) return [str];
  const words = str.split(' ');
  for (let k = words.length - 1; k > 0; k--) {
    const a = words.slice(0, k).join(' '), b = words.slice(k).join(' ');
    if (tc.measureText(a).width <= maxW && tc.measureText(b).width <= maxW) return [a, b];
  }
  return [str];   // can't wrap cleanly: caller falls back to 8px
}

function box(ctx, x, y, w, h, filled, color = BLACK) {
  ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
  if (!filled) { ctx.fillStyle = WHITE; ctx.fillRect(x + 1, y + 1, w - 2, h - 2); }
}

function drawGender(ctx, x, y, g, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x + 4, y + 7, 4, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  if (g === 'M') { ctx.moveTo(x + 7, y + 4); ctx.lineTo(x + 11, y); ctx.moveTo(x + 7, y); ctx.lineTo(x + 11, y); ctx.lineTo(x + 11, y + 4); }
  else if (g === 'F') { ctx.moveTo(x + 4, y + 11); ctx.lineTo(x + 4, y + 17); ctx.moveTo(x + 1, y + 14); ctx.lineTo(x + 7, y + 14); }
  ctx.stroke();
}

// Original generic rosette glyph (not a game asset): 12x15.
function ribbonIcon(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y, 8, 10); ctx.fillRect(x, y + 2, 12, 6);       // rosette
  ctx.fillRect(x + 2, y + 10, 3, 5); ctx.fillRect(x + 7, y + 10, 3, 5); // tails
  ctx.fillStyle = WHITE; ctx.fillRect(x + 4, y + 3, 4, 4);               // centre
}

// Original generic trainer silhouette (not a game asset), drawn into box w x h.
function silhouette(ctx, x, y, w, h, color) {
  const cx = x + w / 2, u = Math.floor(Math.min(w / 7, h / 12));   // 11u tall, 6.4u wide
  ctx.fillStyle = color;
  ctx.fillRect(cx - 2 * u, y + h - 10 * u, 4 * u, u);            // cap brim
  ctx.fillRect(cx - 1.5 * u, y + h - 11 * u, 3 * u, u);          // cap
  ctx.fillRect(cx - 1.5 * u, y + h - 9 * u, 3 * u, 2.5 * u);     // head
  ctx.fillRect(cx - 2.5 * u, y + h - 6.5 * u, 5 * u, 3.5 * u);   // torso
  ctx.fillRect(cx - 3.2 * u, y + h - 6.2 * u, 0.7 * u, 3 * u);   // arms
  ctx.fillRect(cx + 2.5 * u, y + h - 6.2 * u, 0.7 * u, 3 * u);
  ctx.fillRect(cx - 2 * u, y + h - 3 * u, 1.6 * u, 3 * u);       // legs
  ctx.fillRect(cx + 0.4 * u, y + h - 3 * u, 1.6 * u, 3 * u);
}

// Original Hall of Fame backdrop: light rays from below + a few stars, as faint dither.
function raysBackdrop(ink, y0, strength, protect) {
  const cx = W / 2, cy = H + 40;
  const inProt = (x, y) => protect.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);
  for (let y = y0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (ink[i] || inProt(x, y)) continue;
    const a = Math.atan2(cy - y, x - cx);               // angle of the ray
    const ray = Math.floor(a * 14 / Math.PI) % 2 === 0;
    const fade = (H - y) / (H - y0);                    // lighter towards the top
    const dark = (ray ? 0.55 : 0.12) * (1 - 0.6 * fade) * strength;
    if (dark > (BAYER[4][y & 3][x & 3] + 0.5) / 16) ink[i] = 1;
  }
  for (const [sx, sy] of [[34, 60], [366, 52], [70, 150], [330, 140], [200, 44]]) {   // stars
    for (let k = -3; k <= 3; k++) {
      for (const [x, y] of [[sx + k, sy], [sx, sy + k]]) if (!inProt(x, y)) ink[y * W + x] = 1;
    }
  }
}

// Thickness of the frame of the page being drawn (26-frames.js): the page dots sit above it.
let chromeFrameT = 0;
const setFrameForChrome = t => { chromeFrameT = t; };

// Shared chrome: header with name + page title, page dots at the bottom.
// Header styles: classic = black bar, accent = bar in the accent ink, light = white bar
// with a rule, tab = black tab behind the name only, boxed = outlined white bar.
function chrome(ctx, s, title, idx, total, name = s.name, gender = s.gender) {
  ctx.fillStyle = WHITE; ctx.fillRect(0, 0, W, H);
  const st = PAGE_STYLES.includes(s.pageStyle) ? s.pageStyle : 'classic';
  const barFg = st === 'classic' || st === 'accent';
  ctx.fillStyle = st === 'accent' ? accent(s) : BLACK;
  if (barFg) ctx.fillRect(0, 0, W, 30);
  else if (st === 'boxed') { box(ctx, 0, 0, W, 30, false); ctx.fillStyle = BLACK; ctx.fillRect(0, 28, W, 2); }
  else ctx.fillRect(0, 28, W, 2);
  const titleW = title ? measure(up(title), 8, true) : 0;
  const nameMax = W - titleW - 50;
  if (st === 'tab') {      // tab sized to the name, with a slanted end
    const tw = Math.min(nameMax, measure(up(name), 16, true)) + (gender && gender !== '-' ? 22 : 0) + 20;
    ctx.fillStyle = BLACK; ctx.fillRect(0, 0, tw, 30);
    for (let k = 0; k < 14; k++) ctx.fillRect(tw + k, 2 * k + 2, 1, 28 - 2 * k);
  }
  const fg = barFg || st === 'tab' ? WHITE : BLACK;
  if (title) text(ctx, up(title), W - 10, 11, 8, true, st === 'tab' ? BLACK : fg, 'right');
  const nw = text(ctx, up(name), 10, 7, 16, true, fg, 'left', nameMax);
  if (gender && gender !== '-') drawGender(ctx, 10 + nw + 8, 8, gender, fg);
  const dotsX = W / 2 - (total * 12 - 4) / 2;
  const dotsY = Math.min(288, H - chromeFrameT - 10);
  for (let i = 0; i < total; i++) box(ctx, dotsX + i * 12, dotsY, 8, 8, i === idx);
}

// label (8px) above value (16px)
function field(ctx, label, value, x, y, maxW, color = BLACK) {
  text(ctx, up(label), x, y, 8, true, color);
  text(ctx, up(value || '—'), x, y + 12, 16, false, BLACK, 'left', maxW);
}

function measure(str, px, bold) {
  const tc = textCanvas.getContext('2d'); tc.font = FONT(px, bold);
  return Math.ceil(tc.measureText(String(str)).width);
}
// Greedy word wrap into as many lines as needed.
function wrapLines(str, px, bold, maxW) {
  const lines = []; let cur = '';
  for (const w of String(str).split(/\s+/).filter(Boolean)) {
    const next = cur ? cur + ' ' + w : w;
    if (cur && measure(next, px, bold) > maxW) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

