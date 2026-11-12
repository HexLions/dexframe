// ---------- dates and the day counter ----------
// "26/04/2011", "26.04.2011" or "2011-04-26" -> days since 1970-01-01 (calendar day, no time zone).
function parseDay(str) {
  const v = String(str || '').trim();
  let m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/), y, mo, dd;
  if (m) [, dd, mo, y] = m.map(Number);
  else if ((m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [, y, mo, dd] = m.map(Number);
  else return null;
  const t0 = Date.UTC(y, mo - 1, dd), chk = new Date(t0);
  if (chk.getUTCMonth() !== mo - 1 || chk.getUTCDate() !== dd) return null;   // 31/02 and the like
  return Math.floor(t0 / 86400000);
}
const todayDay = () => { const n = new Date(); return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 86400000); };
const sinceDay = s => parseDay(s.since) ?? parseDay(s.met);
const NUM_SEP = {it: '.', en: ',', es: '.', fr: ' ', de: '.'};
const numSep = () => NUM_SEP[state.dispLang] || ',';
const fmtNum = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, numSep());

// Digit strip for the firmware, drawn exactly like text(..., 16, false): it rebuilds
// the counter every day without the browser. Layout in src/main.cpp (loadGlyphs).
const GLYPH_H = 16;   // Silkscreen 16px digits and separators sit in rows 3..14 of the text box
function buildGlyphs() {
  const chars = [...'0123456789', numSep(), '%'];   // 10 = thousands separator, 11 = per cent
  const c = document.createElement('canvas'), x = c.getContext('2d', {willReadFrequently: true});
  x.font = FONT(16, false);
  const adv = chars.map(ch => Math.round(x.measureText(ch).width));
  const gw = Math.max(...adv) + 4, stride = Math.ceil(gw / 8);
  c.width = gw; c.height = GLYPH_H;
  const out = new Uint8Array(3 + chars.length + chars.length * GLYPH_H * stride);
  out.set([gw, GLYPH_H, chars.length]); out.set(adv, 3);
  chars.forEach((ch, k) => {
    x.clearRect(0, 0, gw, GLYPH_H);
    x.font = FONT(16, false); x.textBaseline = 'top'; x.fillStyle = '#000';
    x.fillText(ch, 2, 0);
    const d = x.getImageData(0, 0, gw, GLYPH_H).data, base = 3 + chars.length + k * GLYPH_H * stride;
    for (let j = 0; j < GLYPH_H; j++) for (let i = 0; i < gw; i++)
      if (d[(j * gw + i) * 4 + 3] >= 60) out[base + j * stride + (i >> 3)] |= 0x80 >> (i & 7);
  });
  return out;
}


// ---------- Pokémon of the day: schedule (same arithmetic as dailyIndex()/dailyPick() in the firmware) ----------
const dailyEveryOf = (s = state) => Math.min(30, Math.max(1, Math.round(Number(s.dailyEvery) || 1)));
const dailyAtOf = (s = state) => Math.max(0, minutesOfDay(s.dailyAt));
function minutesOfDay(hhmm) { const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/); return m ? Math.min(1439, Number(m[1]) * 60 + Number(m[2])) : 0; }
// Period number at time ms: local days counted from the change time, grouped by "every".
function dailyIndexAt(ms, s = state) {
  const t = new Date(ms - dailyAtOf(s) * 60000);
  return Math.floor(Math.floor(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / 86400000) / dailyEveryOf(s));
}
function dailyPickJs(n, count, shuffle) {
  if (count <= 0 || n < 0) return 0;
  const pos = n % count;
  if (!shuffle) return pos;
  const perm = Array.from({length: count}, (_, i) => i);
  let r = (Math.imul(Math.floor(n / count), 0x9E3779B1) + 12345) >>> 0;
  for (let i = count - 1; i > 0; i--) {
    r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
    const j = r % (i + 1);
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  return perm[pos];
}
const dailyPickNow = (count, s = state) => dailyPickJs(dailyIndexAt(Date.now(), s), count, !!s.dailyShuffle);
// The next k changes: [[Date, pool index], ...]
function dailySchedule(count, k, s = state) {
  const out = [], at = dailyAtOf(s);
  let prev = dailyIndexAt(Date.now(), s);
  const day = new Date(); day.setHours(0, 0, 0, 0);
  for (let i = 0; out.length < k && i < 31 * k + 2; i++) {
    const when = new Date(day.getFullYear(), day.getMonth(), day.getDate() + i, Math.floor(at / 60), at % 60);
    if (when <= Date.now()) continue;
    const n = dailyIndexAt(when.getTime() + 60000, s);
    if (n !== prev) { out.push([when, dailyPickJs(n, count, !!s.dailyShuffle)]); prev = n; }
  }
  return out;
}
const fmtWhen = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
