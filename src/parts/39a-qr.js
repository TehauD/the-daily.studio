/* ============================================================
   Part 39a · QR CODES, MADE ON THIS DEVICE
   A small QR code maker for the tip jar (part 39b): byte mode, error correction level M (about 15% of the code can be
   damaged or covered and it still scans), versions 1 to 40, the mask chosen by the standard's penalty rules (ISO/IEC 18004).
   No library and no network: the code is worked out here and drawn on a canvas or written as SVG.
   qrMake(text) → { n, dark(x, y) }   n: modules per side, without the quiet zone
   ============================================================ */
/* level M: error-correction codewords per block, and the number of blocks, for versions 1..40 (index 0 unused) */
const QR_ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const QR_BLK = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
const qrRaw = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const na = Math.floor(v / 7) + 2; r -= (25 * na - 10) * na - 55; if (v >= 7) r -= 36; } return r; };   /* modules free for data and error correction */
const qrData = v => Math.floor(qrRaw(v) / 8) - QR_ECC[v] * QR_BLK[v];   /* data codewords */
function qrMul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z; }
function qrDivisor(deg) { const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1; for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = qrMul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = qrMul(root, 2); } return r; }
function qrRemainder(data, div) { const r = div.map(() => 0); for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= qrMul(c, f); }); } return r; }
function qrAlign(v) { if (v === 1) return []; const n = Math.floor(v / 7) + 2, step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, res = [6]; for (let p = v * 4 + 10; res.length < n; p -= step) res.splice(1, 0, p); return res; }
const QR_MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => x * y % 2 + x * y % 3 === 0, (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];

function qrMake(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  let v = 1; for (; v <= 40; v++) if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= qrData(v) * 8) break;
  if (v > 40) throw new Error('too long for a QR code');
  /* the bit stream: mode (byte), length, the bytes, a terminator, then padding */
  const bits = [], put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }, cap = qrData(v) * 8;
  put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
  put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length % 8) % 8);
  for (let p = 0xec; bits.length < cap; p ^= 0xec ^ 0x11) put(p, 8);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => a << 1 | b, 0));
  /* split into blocks, add the error correction, and interleave */
  const nb = QR_BLK[v], ecl = QR_ECC[v], raw = Math.floor(qrRaw(v) / 8), nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = qrDivisor(ecl), blocks = [];
  for (let i = 0, k = 0; i < nb; i++) { const dat = data.slice(k, k + shortLen - ecl + (i < nShort ? 0 : 1)); k += dat.length; const ecc = qrRemainder(dat, div); if (i < nShort) dat.push(0); blocks.push(dat.concat(ecc)); }
  const words = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - ecl || j >= nShort) words.push(b[i]); });
  /* the fixed patterns */
  const n = v * 4 + 17, M = Array.from({ length: n }, () => new Uint8Array(n)), F = Array.from({ length: n }, () => new Uint8Array(n));
  const fn = (x, y, d) => { M[y][x] = d ? 1 : 0; F[y][x] = 1; };
  for (let i = 0; i < n; i++) { fn(6, i, i % 2 === 0); fn(i, 6, i % 2 === 0); }
  [[3, 3], [n - 4, 3], [3, n - 4]].forEach(([cx, cy]) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy)); if (x >= 0 && x < n && y >= 0 && y < n) fn(x, y, d !== 2 && d !== 4); } });
  const al = qrAlign(v), na = al.length;
  for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) { if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fn(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
  const format = mask => { const d = mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); const b = (d << 10 | r) ^ 0x5412, bit = i => ((b >>> i) & 1) === 1;   /* level M is 00 */
    for (let i = 0; i <= 5; i++) fn(8, i, bit(i)); fn(8, 7, bit(6)); fn(8, 8, bit(7)); fn(7, 8, bit(8)); for (let i = 9; i < 15; i++) fn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) fn(n - 1 - i, 8, bit(i)); for (let i = 8; i < 15; i++) fn(8, n - 15 + i, bit(i)); fn(8, n - 8, true); };
  format(0);   /* reserves the format areas; drawn for real once the mask is chosen */
  if (v >= 7) { let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25); const b = v << 12 | r; for (let i = 0; i < 18; i++) { const d = ((b >>> i) & 1) === 1, a = n - 11 + i % 3, c = Math.floor(i / 3); fn(a, c, d); fn(c, a, d); } }
  /* the data, in the zigzag order */
  let k = 0; for (let right = n - 1; right >= 1; right -= 2) { if (right === 6) right = 5; for (let vert = 0; vert < n; vert++) for (let j = 0; j < 2; j++) { const x = right - j, y = ((right + 1) & 2) === 0 ? n - 1 - vert : vert; if (!F[y][x] && k < words.length * 8) { M[y][x] = (words[k >>> 3] >>> (7 - (k & 7))) & 1; k++; } } }
  /* the mask with the lowest penalty */
  const apply = m => { const f = QR_MASKS[m]; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!F[y][x] && f(x, y)) M[y][x] ^= 1; };
  let best = 0, low = Infinity;
  for (let m = 0; m < 8; m++) { apply(m); format(m); const p = qrPenalty(M, n); if (p < low) { low = p; best = m; } apply(m); }
  apply(best); format(best);
  return { n, v, mask: best, dark: (x, y) => x >= 0 && y >= 0 && x < n && y < n && M[y][x] === 1 };
}
/** the standard's four penalty rules: runs of one colour, 2×2 blocks, finder-like patterns, and the balance of dark and light */
function qrPenalty(M, n) {
  let p = 0, dark = 0; const line = get => { let s = ''; for (let i = 0; i < n; i++) s += get(i); return s; };
  const runs = s => { let q = 0; s.replace(/0{5,}|1{5,}/g, r => { q += r.length - 2; return r; }); return q; };
  const finders = s => { const t = '0000' + s + '0000'; let q = 0; for (let i = t.indexOf('1011101'); i >= 0; i = t.indexOf('1011101', i + 1)) if (t.slice(i - 4, i) === '0000' || t.slice(i + 7, i + 11) === '0000') q += 40; return q; };
  for (let y = 0; y < n; y++) { const r = line(x => M[y][x]), c = line(x => M[x][y]); p += runs(r) + runs(c) + finders(r) + finders(c); }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { dark += M[y][x]; if (x < n - 1 && y < n - 1) { const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; } }
  return p + Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
}
/** the code as an SVG path (one rectangle per run of dark modules), q: the quiet zone in modules */
function qrSvg(qr, q) {
  q = q == null ? 4 : q; const N = qr.n + q * 2; let d = '';
  for (let y = 0; y < qr.n; y++) for (let x = 0; x < qr.n; x++) { if (!qr.dark(x, y)) continue; let e = x; while (qr.dark(e + 1, y)) e++; d += 'M' + (x + q) + ' ' + (y + q) + 'h' + (e - x + 1) + 'v1h-' + (e - x + 1) + 'z'; x = e; }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + N + ' ' + N + '" shape-rendering="crispEdges" role="img"><rect width="' + N + '" height="' + N + '" fill="#fff"/><path fill="#000" d="' + d + '"/></svg>';
}
/** draw the code on a canvas at whole pixel (x, y), cell pixels per module (it may be a fraction: each module's edges land on whole pixels), without a quiet zone */
function qrDraw(g, qr, x, y, cell) {
  g.fillStyle = '#000'; const at = i => Math.round(i * cell);
  for (let r = 0; r < qr.n; r++) for (let c = 0; c < qr.n; c++) { if (!qr.dark(c, r)) continue; let e = c; while (qr.dark(e + 1, r)) e++; const x0 = x + at(c), y0 = y + at(r); g.fillRect(x0, y0, x + at(e + 1) - x0, y + at(r + 1) - y0); c = e; }
}
