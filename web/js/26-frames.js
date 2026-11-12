// ---------- page frames ----------
// Borders drawn around the whole page after everything else. All original, geometric
// designs made in code (no game assets); "custom" is a 9-slice image the user uploads,
// kept in the saved data like the other uploaded images. Thickness is at most 8 px:
// page content keeps 10 px from the sides, the page dots move up to make room.
const PAGE_STYLES = ['classic', 'accent', 'light', 'tab', 'boxed'];
const FRAME_T = {none: 0, line: 3, double: 5, rounded: 5, accent: 5, dashed: 5, chamfer: 6, checker: 6, studs: 6, wave: 6};
const FRAME_KEYS = [...Object.keys(FRAME_T), 'custom'];
const frameOptions = () => FRAME_KEYS.filter(k => k !== 'custom' || state.frameImg).map(k => [k, t('fr_' + k)]);
const frameOf = (s, key) => {
  const f = (s.pageFrame || {})[key] || s.frame || 'none';
  return f === 'custom' && !s.frameImg ? 'none' : FRAME_KEYS.includes(f) ? f : 'none';
};
const frameThickness = (s, key) => {
  const f = frameOf(s, key);
  return f === 'custom' ? Math.min(8, Number(s.frameSlice) || 0) : FRAME_T[f] || 0;
};

// Ink for one pixel of the band. d = distance from the outer edge (0 = outermost),
// along = position along the edge, cx/cy = distance from the nearest corner on each axis.
function framePixel(style, d, along, cx, cy, x, y, acc, hasAcc) {
  const mid = hasAcc ? acc : ((x + y) & 1);     // accent ink, or a 50 % checker on B/W
  switch (style) {
    case 'line': return d < 2 ? 1 : 0;
    case 'double': return d < 2 || d === 3 ? 1 : 0;
    case 'rounded': {
      const r = 9;
      if (cx < r && cy < r) {                    // round the corner: distance from the arc
        const dd = r - Math.hypot(r - cx - 0.5, r - cy - 0.5);
        if (dd < 0) return 0;
        d = Math.floor(dd);
      }
      return d < 2 || d === 3 ? 1 : 0;
    }
    case 'accent': return d === 0 || d === 3 ? 1 : d < 3 ? mid : 0;
    case 'dashed': return d < 2 ? (Math.floor(along / 6) % 2 === 0 || (cx < 6 && cy < 6) ? 1 : 0) : d === 3 ? 1 : 0;
    case 'chamfer': {
      if (cx + cy < 4) return 0;                 // cut corners
      if (cx + cy === 4) return 1;
      return d === 0 || d === 2 || d === 3 || d === 5 ? 1 : 0;
    }
    case 'checker': return d === 0 || d === 4 ? 1 : d < 4 ? ((x >> 1) + (y >> 1)) & 1 : 0;
    case 'studs': {
      const stud = (cx < 6 && cy < 6) || Math.abs(along - (cx < cy ? H : W) / 2) < 4;
      if (stud) return (d === 2 || d === 3) && (cx < 6 && cy < 6 ? (cx === 2 || cx === 3) && (cy === 2 || cy === 3) : true) ? 0 : hasAcc && d > 0 && d < 5 ? acc : 1;
      return d < 2 || d === 3 ? 1 : 0;
    }
    case 'wave': {
      if (cx < 6 && cy < 6) return Math.abs(cx - 2.5) + Math.abs(cy - 2.5) <= 2.6 ? (hasAcc ? acc : 1) : 0;
      const w = 2.5 + 2 * Math.sin(along * Math.PI / 6);
      return Math.abs(d - w) < 0.9 || d === 5 ? 1 : 0;
    }
  }
  return 0;
}

// Decoded custom frame, cached by data URL: {w, h, rgba}
let customFrame = {url: '', img: null};
async function customFramePixels(url) {
  if (customFrame.url === url) return customFrame.img;
  const im = await loadLocalImage(url);
  let px = null;
  if (im) {
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d', {willReadFrequently: true}); x.drawImage(im, 0, 0);
    px = {w: c.width, h: c.height, rgba: x.getImageData(0, 0, c.width, c.height).data};
  }
  customFrame = {url, img: px};
  return px;
}

// Draws the frame of this page into ink (W x H ink codes), clearing the band first.
async function applyFrame(ink, s, key) {
  const style = frameOf(s, key), T = frameThickness(s, key);
  if (!T) return;
  const pal = panelOf(s).palette;
  const hasAcc = pal.includes('red'), acc = inkCode('red');
  let img = null;
  if (style === 'custom') { img = await customFramePixels(s.frameImg); if (!img) return; }
  const palOpt = {palette: pal.map(inkCode), contrast: 0};
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const cx = Math.min(x, W - 1 - x), cy = Math.min(y, H - 1 - y), d = Math.min(cx, cy);
    if (d >= T) { x = W - 1 - T; continue; }      // jump over the inside of the row
    const i = y * W + x;
    if (!img) { ink[i] = framePixel(style, d, cx <= cy ? y : x, cx, cy, x, y, acc, hasAcc); continue; }
    // 9-slice: corners as they are, edges repeat their middle part
    const b = T, sx = x < b ? x : x >= W - b ? img.w - (W - x) : b + (x - b) % Math.max(1, img.w - 2 * b);
    const sy = y < b ? y : y >= H - b ? img.h - (H - y) : b + (y - b) % Math.max(1, img.h - 2 * b);
    const o = (sy * img.w + sx) * 4, r = img.rgba[o], g = img.rgba[o + 1], bl = img.rgba[o + 2];
    const th = (BAYER[4][y & 3][x & 3] + 0.5) / 16;
    if (img.rgba[o + 3] < 128) ink[i] = 0;
    else if (pal.length > 2) ink[i] = paletteInk(r, g, bl, palOpt, th);
    else ink[i] = 1 - (0.299 * r + 0.587 * g + 0.114 * bl) / 255 > th ? 1 : 0;
  }
}

// Upload: any image; the border is a third of its short side. Big images are reduced
// by a whole factor (pixel art stays sharp) so the border is at most 8 px.
async function uploadFrame(file) {
  const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const im = await loadLocalImage(url);
  if (!im || im.naturalWidth < 6 || im.naturalHeight < 6) throw new Error('image');
  const b0 = Math.floor(Math.min(im.naturalWidth, im.naturalHeight) / 3);
  const k = Math.max(1, Math.ceil(b0 / 8), Math.ceil(Math.max(im.naturalWidth, im.naturalHeight) / 96));
  const c = document.createElement('canvas');
  c.width = Math.max(6, Math.floor(im.naturalWidth / k)); c.height = Math.max(6, Math.floor(im.naturalHeight / k));
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(im, 0, 0, c.width, c.height);
  state.frameImg = c.toDataURL('image/png');
  state.frameSlice = Math.max(2, Math.min(8, Math.floor(Math.min(c.width, c.height) / 3)));
  state.frame = 'custom';
}

// Picker: a corner of every frame on a page with the chosen header style, at 2x.
function buildFrameBox() {
  const fs = document.querySelector('fieldset[data-group="look"]');
  if (!fs || $('framebox')) return;
  const box = document.createElement('div'); box.className = 'trbox'; box.id = 'framebox';
  box.innerHTML = `<strong style="font-size:13px" id="frTitle"></strong><div class="frgrid" id="frGrid"></div>
    <div class="cur"><span class="muted" id="frInfo"></span>
    <label class="chk" style="cursor:pointer"><input type="file" id="frFile" accept="image/*" hidden><span id="frUp" class="btnlike"></span></label>
    <button type="button" id="frClr"></button></div>`;
  fs.querySelector('.grid').after(box);
  $('frFile').addEventListener('change', async ev => {
    const f = ev.target.files?.[0]; ev.target.value = '';
    if (!f) return;
    try { await uploadFrame(f); refreshFrameSelect(); renderFrameBox(); scheduleRender(); }
    catch { setStatus(t('tr_bad')); }
  });
  $('frClr').onclick = () => {
    state.frameImg = ''; state.frameSlice = 0;
    if (state.frame === 'custom') state.frame = 'none';
    refreshFrameSelect(); renderFrameBox(); scheduleRender();
  };
  renderFrameBox();
}

// The frame <select> lists "custom" only while an image is loaded.
function refreshFrameSelect() {
  const sel = document.querySelector('select[name=frame]');
  if (!sel) return;
  sel.replaceChildren(...frameOptions().map(([v, txt]) => new Option(txt, v)));
  sel.value = state.frame || 'none';
  renderPagesBox();
}

function renderFrameBox() {
  if (!$('framebox')) return;
  $('frTitle').textContent = t('fr_title');
  $('frUp').textContent = t('fr_upload');
  $('frClr').textContent = t('fr_clear');
  $('frClr').style.display = state.frameImg ? '' : 'none';
  $('frInfo').textContent = t(state.frameImg ? 'fr_custom_info' : 'fr_info');
  const keys = FRAME_KEYS.filter(k => k !== 'custom' || state.frameImg);
  const tiles = keys.map(k => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'frtile';
    b.setAttribute('aria-pressed', (state.frame || 'none') === k);
    const cv = document.createElement('canvas'); cv.width = 120; cv.height = 76;
    const cap = document.createElement('span'); cap.textContent = t('fr_' + k);
    b.append(cv, cap);
    b.onclick = () => {
      state.frame = k;
      const sel = document.querySelector('select[name=frame]'); if (sel) sel.value = k;
      renderFrameBox(); scheduleRender();
    };
    drawFrameThumb(cv, k);
    return b;
  });
  $('frGrid').replaceChildren(...tiles);
}

async function drawFrameThumb(cv, k) {
  const s = {...state, frame: k, pageFrame: {}};
  const work = document.createElement('canvas'); work.width = W; work.height = H;
  const ctx = work.getContext('2d', {willReadFrequently: true});
  setFrameForChrome(frameThickness(s, 'cover'));
  chrome(ctx, s, '', 0, 3, 'NAME', '-');
  const ink = canvasToInk(ctx, panelOf(s).palette);
  await applyFrame(ink, s, 'cover');
  const out = cv.getContext('2d'), img = out.createImageData(120, 76);
  for (let y = 0; y < 76; y++) for (let x = 0; x < 120; x++) {
    const [r, g, b] = INKS[ink[(y >> 1) * W + (x >> 1)]].rgb;
    img.data.set([r, g, b, 255], (y * 120 + x) * 4);
  }
  out.putImageData(img, 0, 0);
}
