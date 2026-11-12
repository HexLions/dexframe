// ---------- MD5 (RFC 1321), for the firmware upload check ----------
// The board compares it with the image it wrote (Update.setMD5), so a file damaged on
// the way is refused instead of booted. Not used for anything secret.
function md5Hex(bytes) {
  const K = new Uint32Array(64), S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;
  const n = bytes.length, total = ((n + 8) >>> 6) + 1 << 6;
  const buf = new Uint8Array(total);
  buf.set(bytes); buf[n] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, (n * 8) >>> 0, true);
  dv.setUint32(total - 4, Math.floor(n / 0x20000000), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const M = new Uint32Array(16);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) & 15; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) & 15; }
      else { f = c ^ (b | ~d); g = (7 * i) & 15; }
      const s = S[(i >> 4) * 4 + (i & 3)];
      const x = (a + f + K[i] + M[g]) >>> 0;
      a = d; d = c; c = b;
      b = (b + ((x << s) | (x >>> (32 - s)))) >>> 0;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  return [a0, b0, c0, d0].map(v => [0, 8, 16, 24].map(k => ((v >>> k) & 255).toString(16).padStart(2, '0')).join('')).join('');
}

// Text files of the web UI go to the board gzipped (it serves x.gz for x): about a
// quarter of the space. Browsers without CompressionStream send them as they are.
const GZIP_EXT = /\.(html|css|js|ttf|json|svg)$/i;
async function maybeGzip(file, rel) {
  if (!GZIP_EXT.test(rel) || typeof CompressionStream === 'undefined') return {file, rel};
  const gz = await new Response(file.stream().pipeThrough(new CompressionStream('gzip'))).blob();
  return {file: new File([gz], file.name + '.gz'), rel: rel + '.gz'};
}
