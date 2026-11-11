/* ============================================================
   Part 93 · SOUNDPRINT (2.61) — any sound becomes a print, worlds that move with it, a reading of its music and an ambient piece
   Record a sound (up to a minute), choose a file, a take, the song or its master. It is listened to here and becomes a PRINT:
   about 1 kB of shapes (its loudness, brightness and motion over 128 moments, its notes and its spectrum over 64, its onsets,
   key and pulse). Everything else is grown from the print alone, so whoever opens a print's link sees and hears what you do.
   The sound decides the kind of picture (its genome, below): its fingerprint class, its colours (its own notes), its ground, its
   symmetry and texture. Five worlds:
     ◎ Print         a fingerprint: ridges along an orientation field with the class's cores and deltas, time running out from
                     the core; colour is note (round the circle of fifths), silences leave rings, onsets end ridges.
     〰 Flow         particles in a field the sound makes: laminar for calm pitched sounds, eddies for motion, bursts on onsets.
     ⛰ Terrain      the spectrum as a landscape you travel over; onsets are fountains.
     ✿ Bloom         a mandala of superformula rings, one per moment, its symmetry the pulse.
     ∞ Harmonograph  a figure for each chord of the progression, pendulums tuned to its intervals.
   The reading: key, pulse, character, its strongest colours and a chord progression (the diatonic chords that fit its notes).
   The piece: pads on those chords (the filter follows the brightness), a drone, bells on its onsets in the key's pentatonic
   scale, wind for its noise, and, if you like, the recording itself an octave down. Made faster than it plays, here.
   Exports: artwork (PNG, 2048 px), the piece (WAV), a video of the world moving with the piece, and a link that carries the print
   only (#p=…): the sound never leaves this device. Prints you make are kept on this device (Your soundprints, newest 48).
   This part is a room (part 00): the hosted site loads it the first time it is opened.
   ============================================================ */
const PRT = { cur: null, read: null, src: null, world: 'print', raf: 0, play: null, piece: null, rec: null, vid: null, body: null, cv: null, cache: null, weave: true, mine: false, dirty: true, KEEP: 'fw.prints', MAX: 48 };
const PRT_N = 128, PRT_M = 64;                 /* moments for loudness, brightness and motion; for the notes and the spectrum */
const PRT_WORLDS = [['print', '◎', 'Print'], ['flow', '〰', 'Flow'], ['terrain', '⛰', 'Terrain'], ['bloom', '✿', 'Bloom'], ['harmono', '∞', 'Harmonograph']];
const PRT_FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];      /* the colour wheel: C, G, D, A, E, B, F#, C#, G#, D#, A#, F */
const prtHue = pc => PRT_FIFTHS.indexOf(((pc % 12) + 12) % 12) * 30;
const prtRand = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
/** a line of the print at time u (0..1), interpolated */
function prtAt(a, u) { const n = a.length - 1, x = Math.min(n, Math.max(0, u * n)), i = Math.floor(x), f = x - i; return i >= n ? a[n] : a[i] * (1 - f) + a[i + 1] * f; }
/** the notes (12) or the spectrum (8) at time u */
function prtRow(rows, u) { const n = rows.length - 1, x = Math.min(n, Math.max(0, u * n)), i = Math.floor(x), f = x - i, A = rows[i], B = rows[Math.min(n, i + 1)]; return A.map((v, k) => v * (1 - f) + B[k] * f); }
const prtPct = (arr, q) => { const s = Float32Array.from(arr).sort(); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };
const prtFmt = s => { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* ---------- listening: the sound → the print ---------- */
/** x: mono samples. Returns the print's fields (before they are packed to 4 bits) */
function prtAnalyze(x, sr) {
  const N = sr > 64000 ? 16384 : sr > 32000 ? 8192 : 4096, len = x.length; if (len < sr * .5) throw new Error('That is shorter than half a second: a print needs a little more sound');
  const hop = Math.max(N / 4, Math.ceil((len - N) / 2000)), F = Math.max(1, Math.floor((len - N) / hop) + 1), half = N / 2;
  const win = new Float32Array(N).map((_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / (N - 1)));
  const kLo = Math.max(1, Math.ceil(50 * N / sr)), kHi = Math.min(half - 1, Math.floor(16000 * N / sr)), L2 = Math.log2(16000 / 50);
  const bandOf = new Int8Array(half), lp = new Float32Array(half), flatK = new Uint8Array(half);
  for (let k = kLo; k <= kHi; k++) { const f = k * sr / N; lp[k] = Math.log2(f / 50) / L2; bandOf[k] = Math.min(7, Math.floor(lp[k] * 8)); flatK[k] = f >= 100 && f <= 8000 ? 1 : 0; }
  const rms = new Float32Array(F), cen = new Float32Array(F), flux = new Float32Array(F), flat = new Float32Array(F), chr = new Float32Array(F * 12), bnd = new Float32Array(F * 8);
  let prev = new Float32Array(half), cur = new Float32Array(half); const re = new Float32Array(N), im = new Float32Array(N), pw = new Float64Array(half), cs = new Float64Array(half + 1);
  for (let f = 0; f < F; f++) {
    const o = f * hop; let e = 0;
    for (let i = 0; i < N; i++) { const v = x[o + i] || 0; e += v * v; re[i] = v * win[i]; im[i] = 0; }
    rms[f] = Math.sqrt(e / N); finFft(re, im);
    let sm = 0, sw = 0, fl = 0, sa = 0, pk = 0;
    for (let k = kLo; k <= kHi; k++) {
      const p = re[k] * re[k] + im[k] * im[k], m = Math.sqrt(p); cur[k] = Math.log(1 + 1000 * m); pw[k] = p;
      sm += m; sw += m * lp[k]; const d = cur[k] - prev[k]; if (d > 0) fl += d;
      bnd[f * 8 + bandOf[k]] += p; if (flatK[k]) sa += p;
    }
    /* how pitched: the share of the energy (100 Hz–8 kHz) in sharp peaks, six times their neighbourhood */
    cs[0] = 0; for (let k = 0; k < half; k++) cs[k + 1] = cs[k] + pw[k];
    const ws = Math.round(7 * N / 4096), wc = Math.max(1, Math.round(N / 4096));
    for (let k = kLo + ws; k < kHi - ws; k++) { if (!flatK[k] || !(pw[k] > pw[k - 1] && pw[k] >= pw[k + 1])) continue; const nbm = (cs[k + ws + 1] - cs[k - ws] - (cs[k + wc + 1] - cs[k - wc])) / (2 * (ws - wc)); if (pw[k] > 6 * nbm) pk += cs[k + wc + 1] - cs[k - wc]; }
    /* the notes: each spectral peak between 60 Hz and 5 kHz, its frequency found between the bins, given to its pitch class */
    for (let k = Math.max(kLo + 1, Math.ceil(60 * N / sr)); k < Math.min(kHi, Math.floor(5000 * N / sr)); k++) {
      const a = cur[k - 1], b = cur[k], c = cur[k + 1]; if (!(b > a && b >= c) || b < 1.2 + Math.log2(N / 4096) * .7) continue;
      const d = a - 2 * b + c, sh = d ? clamp((a - c) / (2 * d), -.5, .5) : 0, fq = (k + sh) * sr / N, mid = 12 * Math.log2(fq / 440) + 69, off = Math.abs(mid - Math.round(mid));
      if (off < .35) chr[f * 12 + ((Math.round(mid) % 12) + 12) % 12] += (b - Math.max(a, c) * .5) * (1 - off * 1.5);
    }
    cen[f] = sm > 0 ? sw / sm : 0; flux[f] = fl; flat[f] = sa > 0 ? Math.min(1, pk / sa) : 0;
    const t = prev; prev = cur; cur = t;
  }
  const dB = rms.map(v => 20 * Math.log10(v + 1e-9)), top = prtPct(dB, .98), floor = top - 48, lin = v => clamp((v - floor) / 48, 0, 1), act = dB.map(v => v > top - 40 ? 1 : 0);
  const steps = (n, fn) => { const out = new Float32Array(n); for (let s = 0; s < n; s++) { const a = Math.floor(s * F / n), b = Math.min(F, Math.max(a + 1, Math.floor((s + 1) * F / n))); out[s] = fn(a, b); } return out; };
  const e = steps(PRT_N, (a, b) => { let s = 0; for (let i = a; i < b; i++) s += rms[i] * rms[i]; return lin(10 * Math.log10(s / (b - a) + 1e-18)); });
  const bright = steps(PRT_N, (a, b) => { let s = 0, w = 0; for (let i = a; i < b; i++) { const q = rms[i] * rms[i]; s += cen[i] * q; w += q; } return w > 0 ? clamp((s / w - .2) / .5, 0, 1) : 0; });
  /* each band's level in dB, frame by frame: how much it changes (motion) and where it jumps up (onsets) */
  const bdb = new Float32Array(F * 8), btopF = new Float32Array(8).fill(-200); for (let i = 0; i < F * 8; i++) { bdb[i] = 10 * Math.log10(bnd[i] + 1e-12); btopF[i % 8] = Math.max(btopF[i % 8], bdb[i]); }
  const chg = new Float32Array(F), rise = new Float32Array(F);
  for (let f = 1; f < F; f++) { let c = 0, r = 0; for (let k = 0; k < 8; k++) { const v = Math.max(bdb[f * 8 + k], btopF[k] - 50), a1 = Math.max(bdb[(f - 1) * 8 + k], btopF[k] - 50), a2 = f > 1 ? Math.max(bdb[(f - 2) * 8 + k], btopF[k] - 50) : a1; c += Math.abs(v - a1); r += Math.max(0, v - Math.max(a1, a2)); } chg[f] = act[f] ? c / 8 : 0; rise[f] = act[f] ? r : 0; }
  const motion = steps(PRT_N, (a, b) => { let s = 0; for (let i = a; i < b; i++) s += chg[i]; return clamp(s / (b - a) / 6, 0, 1); });
  const chroma = [], bands = []; let btop = -200;
  const braw = [];
  for (let s = 0; s < PRT_M; s++) {
    const a = Math.floor(s * F / PRT_M), b = Math.min(F, Math.max(a + 1, Math.floor((s + 1) * F / PRT_M))), c = new Float32Array(12), bd = new Float32Array(8);
    for (let i = a; i < b; i++) { for (let k = 0; k < 12; k++) c[k] += chr[i * 12 + k]; for (let k = 0; k < 8; k++) bd[k] += bnd[i * 8 + k]; }
    const mx = Math.max(...c); chroma.push(c.map(v => mx > 0 ? v / mx : 0));
    const db = bd.map(v => 10 * Math.log10(v / (b - a) + 1e-18)); braw.push(db); btop = Math.max(btop, ...db);
  }
  braw.forEach(db => bands.push(db.map(v => clamp((v - (btop - 60)) / 60, 0, 1))));
  /* onsets: band levels jumping up together (9 dB or more, summed over the bands), well above their neighbourhood, 90 ms apart */
  const fr = sr / hop, gap = Math.max(1, Math.round(.09 * fr)), W8 = Math.max(3, Math.round(.25 * fr)), on = [];
  for (let f = 1; f < F - 1; f++) {
    if (!(rise[f] > rise[f - 1] && rise[f] >= rise[f + 1]) || rise[f] < 9) continue;
    let sm2 = 0, n = 0; for (let j = Math.max(0, f - W8); j <= Math.min(F - 1, f + W8); j++) { sm2 += rise[j]; n++; } if (rise[f] < sm2 / n * 1.6) continue;
    const st = clamp((rise[f] - 6) / 45, 0, 1); if (on.length && f - on[on.length - 1].f < gap) { if (st > on[on.length - 1].s) on[on.length - 1] = { f, s: st }; continue; } on.push({ f, s: st });
  }
  const onsets = on.sort((a, b) => b.s - a.s).slice(0, 120).sort((a, b) => a.f - b.f).map(o => ({ t: (o.f * hop + N / 2) / len, s: o.s }));
  /* the pulse: the energy envelope (10 ms) of up to the first 90 s, autocorrelated over 60–180 BPM */
  let bpm = 0, pconf = 0;
  if (len / sr >= 4 && on.length >= 6 && on.length / (len / sr) >= .45) {
    const h2 = Math.round(sr / 100), M = Math.min(Math.floor(len / h2) - 1, 9000), env = new Float32Array(M);
    let pe = 0; for (let m = 0; m < M; m++) { let s = 0; const o = m * h2; for (let i = 0; i < h2; i++) { const v = x[o + i]; s += v * v; } const le = Math.log(1e-6 + s / h2); env[m] = Math.max(0, le - pe); pe = le; }
    let mu = 0; for (let m = 0; m < M; m++) mu += env[m]; mu /= M || 1; for (let m = 0; m < M; m++) env[m] -= mu;
    let z = 0; for (let m = 0; m < M; m++) z += env[m] * env[m];
    const ac = L => { let s = 0; for (let m = 0; m + L < M; m++) s += env[m] * env[m + L]; return s / (z || 1); };
    let best = 0, bl = 0; const r = []; for (let L = 33; L <= 100; L++) { r[L] = ac(L); if (r[L] > best) { best = r[L]; bl = L; } }
    if (bl) { const a = r[bl - 1] || best, c = r[bl + 1] || best, den = a - 2 * best + c, sh = den ? clamp((a - c) / (2 * den), -.5, .5) : 0; bpm = 6000 / (bl + sh); while (bpm < 72) bpm *= 2; while (bpm > 170) bpm /= 2; pconf = clamp(best * 2.5, 0, 1); }
    if (best < Math.max(.2, 4 / Math.sqrt(M))) { bpm = 0; pconf = Math.min(pconf, .3); }      /* above what noise of this length reaches */
  }
  /* key and character */
  const hsum = new Array(12).fill(0); for (let f = 0; f < F; f++) if (act[f]) for (let k = 0; k < 12; k++) hsum[k] += chr[f * 12 + k];
  const kr = detectKey(hsum); let ks = kr[0]; const rel = kr.find(r => r.minor !== ks.minor && r.root === (ks.minor ? (ks.root + 3) % 12 : (ks.root + 9) % 12));
  if (rel && ks.r - rel.r < .15) {
    const part = (a, b) => { const hh = new Array(12).fill(0); for (let f = Math.floor(a * F); f < Math.floor(b * F); f++) if (act[f]) for (let k = 0; k < 12; k++) hh[k] += chr[f * 12 + k]; const t = hh.reduce((s, v) => s + v, 0) || 1; return hh.map(v => v / t); };
    const st = part(0, .2), en = part(.8, 1), tri = r => [r.root, (r.root + (r.minor ? 3 : 4)) % 12, (r.root + 7) % 12], sc = r => tri(r).reduce((s, pc) => s + 2 * st[pc] + en[pc], 0) + (r.r - ks.r);
    if (sc(rel) > sc(ks)) ks = rel;
  } let fs = 0, fw = 0; for (let f = 0; f < F; f++) if (act[f]) { fs += flat[f]; fw++; }
  const ad = dB.filter((_, f) => act[f]), dyn = ad.length ? prtPct(ad, .95) - prtPct(ad, .1) : 0;
  return { dur: len / sr, key: ks.root, minor: ks.minor, kconf: clamp(ks.r, 0, 1), bpm: Math.round(bpm), pconf, tonal: clamp(((fw ? fs / fw : 0) - .04) / .85, 0, 1), dyn: clamp(dyn, 0, 60), lvl: clamp(top, -99, 0), e, b: bright, f: motion, c: chroma, bd: bands, on: onsets };
}

/* ---------- the print as bytes (and as a link) ---------- */
const PRT_HEAD = 12, prtNib = (PRT_N * 3 + PRT_M * 20) / 2;
function prtPack(P) {
  const q = v => clamp(Math.round(v * 15), 0, 15), nib = [];
  [P.e, P.b, P.f].forEach(a => { for (let i = 0; i < PRT_N; i++) nib.push(q(a[i])); });
  P.c.forEach(r => r.forEach(v => nib.push(q(v)))); P.bd.forEach(r => r.forEach(v => nib.push(q(v))));
  const on = (P.on || []).slice(0, 120), enc = new TextEncoder(), tt = enc.encode(String(P.title || '').slice(0, 60)).slice(0, 120), by = enc.encode(String(P.by || '').slice(0, 40)).slice(0, 80);
  const u = new Uint8Array(PRT_HEAD + prtNib + on.length * 2 + 2 + tt.length + by.length + 2), dv = new DataView(u.buffer);
  u[0] = 1; dv.setUint16(1, clamp(Math.round(P.dur * 10), 1, 65535)); u[3] = 0; u[4] = (P.key & 15) | (P.minor ? 16 : 0); u[5] = q(P.kconf) * 17; u[6] = clamp(P.bpm | 0, 0, 255); u[7] = Math.round(clamp(P.pconf, 0, 1) * 255);
  u[8] = Math.round(clamp(P.tonal, 0, 1) * 255); u[9] = Math.round(clamp(P.dyn, 0, 60) * 4); u[10] = clamp(Math.round(P.lvl) + 100, 0, 255); u[11] = on.length;
  for (let i = 0; i < prtNib; i++) u[PRT_HEAD + i] = (nib[2 * i] << 4) | nib[2 * i + 1];
  let o = PRT_HEAD + prtNib; on.forEach(x => { const t = clamp(Math.round(x.t * 1023), 0, 1023); u[o++] = t >> 2; u[o++] = ((t & 3) << 6) | (q(x.s) << 2); });
  u[o++] = tt.length; u.set(tt, o); o += tt.length; u[o++] = by.length; u.set(by, o); o += by.length; dv.setUint16(o, clamp(P.day | 0, 0, 65535)); return u;
}
function prtUnpack(u) {
  const bad = () => { throw new Error('that is not a soundprint'); };
  if (!(u instanceof Uint8Array) || u.length < PRT_HEAD + prtNib + 4 || u[0] !== 1) bad();
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength), n = u[11], o0 = PRT_HEAD + prtNib + n * 2; if (n > 120 || u.length < o0 + 4) bad();
  const nib = i => (u[PRT_HEAD + (i >> 1)] >> (i & 1 ? 0 : 4)) & 15, line = s => Float32Array.from({ length: PRT_N }, (_, i) => nib(s + i) / 15);
  const P = { v: 1, dur: dv.getUint16(1) / 10, key: u[4] & 15, minor: !!(u[4] & 16), kconf: u[5] / 255, bpm: u[6], pconf: u[7] / 255, tonal: u[8] / 255, dyn: u[9] / 4, lvl: u[10] - 100 };
  if (P.key > 11) bad();
  P.e = line(0); P.b = line(PRT_N); P.f = line(PRT_N * 2);
  let k = PRT_N * 3; P.c = Array.from({ length: PRT_M }, () => Float32Array.from({ length: 12 }, () => nib(k++) / 15)); P.bd = Array.from({ length: PRT_M }, () => Float32Array.from({ length: 8 }, () => nib(k++) / 15));
  P.on = []; for (let i = 0, o = PRT_HEAD + prtNib; i < n; i++, o += 2) P.on.push({ t: ((u[o] << 2) | (u[o + 1] >> 6)) / 1023, s: ((u[o + 1] >> 2) & 15) / 15 });
  let o = o0; const dec = new TextDecoder(), tl = u[o++]; if (tl > 120 || o + tl + 3 > u.length) bad(); P.title = dec.decode(u.subarray(o, o + tl)).replace(/[\u0000-\u001f<>]/g, '').trim(); o += tl;
  const bl = u[o++]; if (bl > 80 || o + bl + 2 > u.length) bad(); P.by = dec.decode(u.subarray(o, o + bl)).replace(/[\u0000-\u001f<>]/g, '').trim(); o += bl; P.day = dv.getUint16(o);
  let hsh = 0x811c9dc5; for (let i = 0; i < o0; i++) { hsh ^= u[i]; hsh = Math.imul(hsh, 16777619); } P.id = (hsh >>> 0).toString(16).padStart(8, '0');
  P.bytes = u; return P;
}
const prtIdText = P => (P.id.slice(0, 4) + '·' + P.id.slice(4)).toUpperCase();
const prtDayNow = () => Math.floor(Date.now() / 864e5) - 20089;          /* days since 1 Jan 2025 */
const prtDate = d => new Date((d + 20089) * 864e5).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
async function prtCode(P) { try { return '1z' + slB64(await slZip(P.bytes)); } catch (e) { return '1r' + slB64(P.bytes); } }
async function prtFromCode(code) {
  const m = /^1([zr])([A-Za-z0-9_-]{20,4000})$/.exec(String(code || '').trim()); if (!m) throw new Error('that is not a soundprint link');
  const raw = slUnB64(m[2]); return prtUnpack(m[1] === 'z' ? await slZip(raw, true) : raw);
}
const prtHere = () => location.href.split('#')[0];

/* ---------- reading it as music ---------- */
function prtRead(P) {
  const fl = keyUsesFlats(P.key, P.minor), nm = pc => pcName(pc, fl), sc = P.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const tri = sc.map((_, d) => { const r = sc[d], t = (sc[(d + 2) % 7] - r + 12) % 12, f = (sc[(d + 4) % 7] - r + 12) % 12; return { root: (P.key + r) % 12, iv: [0, t, f], q: f === 6 ? 'dim' : t === 3 ? 'm' : '', deg: d }; });
  const segs = clamp(Math.round(P.dur / 5), 4, 8), chords = [];
  for (let s = 0; s < segs; s++) {
    const h0 = new Array(12).fill(0); for (let i = Math.floor(s * PRT_M / segs); i < Math.floor((s + 1) * PRT_M / segs); i++) { const w = prtAt(P.e, (i + .5) / PRT_M) + .05; P.c[i].forEach((v, k) => { h0[k] += v * w; }); }
    let best = null, bs = -1; tri.forEach(c => { if (c.q === 'dim') return; let v = 0; c.iv.forEach((x, j) => { v += h0[(c.root + x) % 12] * (j ? 1 : 1.3); }); v += c.deg === 0 ? .15 * Math.max(...h0) : 0; if (v > bs) { bs = v; best = c; } });
    const prev = chords[chords.length - 1]; if (!prev || prev.root !== best.root) chords.push(Object.assign({ sym: nm(best.root) + best.q }, best));
  }
  while (chords.length < 2) { const c = tri[chords.length ? (P.minor ? 5 : 3) : 0]; chords.push(Object.assign({ sym: nm(c.root) + c.q }, c)); }
  const avg = a => a.reduce((s, v) => s + v, 0) / a.length, b = avg(P.b), m = avg(P.f), dens = P.on.length / Math.max(1, P.dur);
  const tone = b < .3 ? 'dark' : b < .55 ? 'warm' : 'bright', motion = dens < .6 && m < .25 ? 'still' : dens < 2.5 ? 'flowing' : 'busy', dyn = P.dyn < 8 ? 'steady' : P.dyn < 20 ? 'breathing' : 'dramatic';
  const kind = P.tonal > .6 ? 'pitched, like a voice, strings or birdsong' : P.tonal > .35 ? 'part pitched, part texture' : 'mostly texture, like wind, rain or a room';
  const mood = P.minor ? (b < .45 ? 'brooding' : 'bittersweet') : (b < .45 ? 'tender' : 'joyful');
  const tot = new Array(12).fill(0); P.c.forEach((r, i) => r.forEach((v, k) => { tot[k] += v * (prtAt(P.e, (i + .5) / PRT_M) + .05); }));
  const colours = tot.map((v, k) => [k, v]).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k]) => k);
  const sure = P.kconf > .7 ? 'clearly' : P.kconf > .45 ? 'probably' : 'perhaps', key = nm(P.key) + (P.minor ? ' minor' : ' major');
  const pulse = P.bpm ? 'about ' + P.bpm + ' BPM' : 'no steady pulse';
  const line = 'A ' + tone + ', ' + motion + ' sound, ' + dyn + ' and ' + mood + ': ' + sure + ' in ' + key + (P.bpm ? ', moving at ' + pulse : ', with ' + pulse) + '. Its strongest colour is ' + nm(colours[0]) + '.';
  return { key, sure, pulse, tone, motion, dyn, kind, mood, colours, chords, line, name: nm };
}

/* ---------- what it looks like: the print's genome ----------
   The sound decides the KIND of picture, not only its details, the way a real fingerprint's class (arch, loop, whorl) comes from
   how the finger grew and its minutiae from chance:
     class       mostly texture → arch (busy texture: tented arch); pitched and steady → whorl; dramatic → double loop;
                 busy and pitched → central-pocket whorl; otherwise a loop (to the right in major, to the left in minor)
     palette     only the notes it is made of (up to four), each its colour on the circle of fifths; noise mutes them
     ground      bright major → paper; dark minor → night; texture → stone; otherwise ink, tinted against its main colour
     the rest    turbulence from its motion, ridge spacing from its onsets, grain from its noise, a hand's wobble from its
                 dynamics, symmetry from its pulse. The print's ID seeds the chance in between. */
const PRT_GROUNDS = { paper: ['#f4eee2', false], 'stone-light': ['#e6e3dd', false], night: ['#04050b', true], ink: [null, true], stone: ['#171614', true] };
const PRT_CLASS = { arch: 'an arch: a sound that is mostly texture', tented: 'a tented arch: busy texture', loop: 'a loop: a sound that flows', whorl: 'a whorl: pitched and steady', pocket: 'a central-pocket whorl: busy and pitched', double: 'a double loop: a dramatic sound' };
const PRT_GC = new Map(), PRT_RC = new Map(), PRT_NC = new Map();
const prtCache = (m, k, make) => { if (m.has(k)) return m.get(k); const v = make(); m.set(k, v); if (m.size > 60) m.delete(m.keys().next().value); return v; };
/** seeded 2D gradient noise, about −0.7..0.7; .fbm(x, y, octaves) */
function prtNoise(seed) {
  return prtCache(PRT_NC, seed, () => {
    const r = prtRand(seed), p = new Uint8Array(512), gx = new Float32Array(256), gy = new Float32Array(256), perm = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)), t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255]; for (let i = 0; i < 256; i++) { const a = r() * 6.2832; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
    const fd = t => t * t * t * (t * (t * 6 - 15) + 10);
    const n = (x, y) => {
      const X = Math.floor(x), Y = Math.floor(y), xf = x - X, yf = y - Y, xi = X & 255, yi = Y & 255;
      const d = (k, dx, dy) => gx[k] * dx + gy[k] * dy, a = d(p[p[xi] + yi], xf, yf), b = d(p[p[xi + 1] + yi], xf - 1, yf), c = d(p[p[xi] + yi + 1], xf, yf - 1), e = d(p[p[xi + 1] + yi + 1], xf - 1, yf - 1), u = fd(xf), v = fd(yf), top = a + (b - a) * u;
      return top + (c + (e - c) * u - top) * v;
    };
    n.fbm = (x, y, o = 3) => { let s = 0, a = 1, f = 1, t = 0; for (let i = 0; i < o; i++) { s += a * n(x * f + i * 17.1, y * f - i * 9.3); t += a; a *= .5; f *= 2.03; } return s / t; };
    return n;
  });
}
function prtGenome(P) {
  return prtCache(PRT_GC, P.id, () => {
    const R = prtRead(P), seed = parseInt(P.id, 16) | 0, rnd = prtRand(seed ^ 0x3779b9), mean = a => a.reduce((s, v) => s + v, 0) / a.length;
    const b = mean(P.b), m = mean(P.f), e = mean(P.e), dens = P.on.length / Math.max(1, P.dur), tonal = P.tonal, dyn = clamp(P.dyn / 30, 0, 1);
    const w = new Array(12).fill(0); P.c.forEach((r, i) => { const ee = prtAt(P.e, (i + .5) / PRT_M) + .02; r.forEach((v, k) => { w[k] += v * v * ee; }); });
    const ord = w.map((v, k) => [k, v]).sort((x, y) => y[1] - x[1]), wt = ord[0][1] || 1, notes = ord.filter(x => x[1] >= wt * .42).slice(0, 4).map(x => x[0]);
    const ground = tonal < .3 ? (b > .55 ? 'stone-light' : 'stone') : !P.minor && (b > .4 || m < .25) ? 'paper' : P.minor && b < .45 ? 'night' : 'ink';
    const dark = PRT_GROUNDS[ground][1], h0 = prtHue(notes[0]), bg = PRT_GROUNDS[ground][0] || 'hsl(' + Math.round((h0 + 190) % 360) + ',42%,8%)';
    const cls = tonal < .3 ? (dens > 1.4 || b > .85 ? 'tented' : 'arch') : m < .2 && dens < .7 ? 'whorl' : dyn > .45 ? 'double' : dens > 2.6 ? 'pocket' : 'loop';
    const sym = P.bpm ? clamp(Math.round(P.bpm / 16), 5, 12) : 5 + (seed >>> 3) % 7, ang = (rnd() - .5) * 1.1 + (P.minor ? Math.PI : 0);
    const pal = notes.map(pc => ({ pc, h: Math.round((prtHue(pc) + (rnd() - .5) * 14 + 360) % 360) }));
    const G = { id: P.id, seed, R, pal, notes, ground, dark, bg, cls, side: P.minor ? -1 : 1, sym, b, m, e, dens, tonal, dyn,
      sat: Math.round(26 + 66 * tonal), lit: dark ? Math.round(56 + 14 * b) : Math.round(33 + 9 * b),
      turb: .25 + 1.7 * m + .4 * Math.min(1, dens / 4), lam: clamp(tonal * (1 - m) * 1.25 - .1, 0, 1), fs: 1.1 + 2.4 * b, dx: Math.cos(ang), dy: Math.sin(ang) * .4,
      sep: .0105 + .0085 * (1 - Math.min(1, dens / 3)), grain: clamp(1 - tonal, 0, 1), wob: dyn, fade: .025 + .09 * (1 - clamp(tonal * (1 - m), 0, 1)) };
    G.style = G.grain > .6 ? 'dots' : tonal > .62 ? 'lines' : 'mesh'; G.ink = dark ? 1 : 1.9; if (!dark && tonal < .3) G.lit -= 8;
    G.why = 'Its print is ' + PRT_CLASS[cls] + '. Its colours are its notes: ' + notes.map(R.name).join(', ') + '. Its ground is ' + { paper: 'paper (bright, major)', 'stone-light': 'pale stone (bright texture)', night: 'night (dark, minor)', ink: 'ink', stone: 'stone (texture)' }[ground] + '; its bloom is ' + sym + '-fold' + (P.bpm ? ', from its pulse' : '') + '.';
    return G;
  });
}
/** colour of palette entry i (alpha a; lightness l, else the genome's) */
const prtCol = (G, i, a, l) => { const p = G.pal[((i % G.pal.length) + G.pal.length) % G.pal.length]; return 'hsla(' + p.h + ',' + G.sat + '%,' + Math.round(l == null ? G.lit : l) + '%,' + (+a).toFixed(3) + ')'; };
const prtColH = (G, h, a, l) => 'hsla(' + Math.round(h) + ',' + G.sat + '%,' + Math.round(l == null ? G.lit : l) + '%,' + (+a).toFixed(3) + ')';
const prtMixH = (a, b, f) => (a + ((((b - a) % 360) + 540) % 360 - 180) * f + 360) % 360;
function prtGround(g, W, H, G) {
  g.save(); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.filter = 'none'; g.fillStyle = G.bg; g.fillRect(0, 0, W, H);
  const r = g.createRadialGradient(W * .5, H * .44, 0, W * .5, H * .5, Math.max(W, H) * .78);
  if (G.dark) { r.addColorStop(0, prtCol(G, 0, .13, 24)); r.addColorStop(.55, prtCol(G, 1, .04, 18)); r.addColorStop(1, 'rgba(0,0,0,.55)'); } else { r.addColorStop(0, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(70,50,30,.14)'); }
  g.fillStyle = r; g.fillRect(0, 0, W, H);
  const rnd = prtRand(G.seed ^ 0x51), n = Math.round(W * H / 700), s = Math.max(1, W / 900); g.fillStyle = G.dark ? 'rgba(255,255,255,.04)' : 'rgba(60,40,20,.06)';
  for (let i = 0; i < n; i++) g.fillRect(rnd() * W, rnd() * H, s, s);
  g.restore();
}
/** draw `paint(ctx)` (the art, no ground) with a soft glow on dark grounds */
function prtGlow(g, W, H, G, paint) {
  if (!G.dark || !('filter' in g)) { paint(g); return; }
  const c = prtGlow.c && prtGlow.c.width === W ? prtGlow.c : (prtGlow.c = document.createElement('canvas')); c.width = W; c.height = H; const cg = c.getContext('2d'); cg.clearRect(0, 0, W, H); paint(cg);
  const hw = Math.max(1, Math.round(W / 2)), sm = prtGlow.s || (prtGlow.s = document.createElement('canvas')); if (sm.width !== hw) { sm.width = hw; sm.height = Math.round(H / 2); }
  const sg = sm.getContext('2d'); sg.clearRect(0, 0, sm.width, sm.height); sg.filter = 'blur(' + Math.max(1, W * .003).toFixed(1) + 'px)'; sg.drawImage(c, 0, 0, sm.width, sm.height); sg.filter = 'none';
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .65; g.drawImage(sm, 0, 0, W, H); g.globalAlpha = 1; g.drawImage(c, 0, 0); g.restore();
}

/* ---------- the worlds ---------- */
/** draw world `w` of print P (W×H, square) at time t (0..1). o: { clock (s), still, G } */
function prtDraw(g, W, H, P, w, t, o = {}) {
  const G = o.G || prtGenome(P); g.save(); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  if (w === 'flow') prtFlowStill(g, W, P, G);
  else if (w === 'terrain') prtTerrain(g, W, H, P, G, t, o);
  else { if (!o.noBg) prtGround(g, W, H, G); const f = w === 'bloom' ? prtBloom : w === 'harmono' ? prtHarmono : prtPrint; prtGlow(g, W, H, G, c => f(c, W, H, P, G, t, o)); }
  g.restore();
}

/* ◎ Print: ridges traced along an orientation field with the class's cores and deltas (the zero-pole model fingerprint
   science uses), evenly spaced, inside a fingertip. Time runs out from the core: each ridge's colour, weight and breaks
   are the sound at that moment; onsets end ridges (minutiae); noise turns them to dots and pores. Built once per print. */
function prtRidges(P, G) {
  return prtCache(PRT_RC, P.id, () => {
    const n2 = prtNoise(G.seed ^ 0x2b), rnd = prtRand(G.seed ^ 0x77), cx = .5, cy = .52, A = .35 + rnd() * .04, Bt = .41 + rnd() * .03, Bb = .37, s = G.side, J = () => (rnd() - .5) * .07;
    const sh = (x, y) => { const dx = (x - cx) / A, dy = (y - cy) / (y < cy ? Bt : Bb); return Math.pow(Math.abs(dx), 2.4) + Math.pow(Math.abs(dy), 2.4); }, inside = (x, y) => sh(x, y) <= 1;
    const SP = { loop: [[[.03 * s + J(), -.12 + J()]], [[.66 * s + J(), .62 + J()]]], whorl: [[[-.06 + J(), -.08 + J()], [.06 + J(), .02 + J()]], [[-.7 + J(), .62 + J()], [.68 + J(), .64 + J()]]],
      pocket: [[[-.03 + J(), -.05], [.04 + J(), .0]], [[-.55 + J(), .72], [.5 + J(), .74]]], double: [[[-.18 + J(), -.16 + J()], [.16 + J(), .1 + J()]], [[-.72 + J(), .5 + J()], [.7 + J(), .7 + J()]]], arch: [[], []], tented: [[], []] }[G.cls];
    const cores = SP[0], deltas = SP[1], th0 = cores.length === 1 ? Math.PI / 2 * s * .2 : 0, warp = .22 + .4 * G.wob;
    const theta = (x, y) => {
      const zx = (x - cx) / A, zy = (y - cy) / A; let t;
      if (!cores.length) { const sg = G.cls === 'tented' ? .2 : .55, am = G.cls === 'tented' ? .5 : .32; t = Math.atan((2 * am * zx / (sg * sg)) * Math.exp(-zx * zx / (sg * sg)) * (1 - .35 * zy)); }
      else { t = th0; cores.forEach(c => { t += .5 * Math.atan2(zy - c[1], zx - c[0]); }); deltas.forEach(d => { t -= .5 * Math.atan2(zy - d[1], zx - d[0]); }); }
      return t + warp * n2.fbm(x * 2.2 + 7, y * 2.2 - 3, 3) + .1 * G.grain * n2(x * 13, y * 13);
    };
    const sep = G.sep, dtest = sep * .52, hh = sep * .3, cell = sep, NG = Math.ceil(1 / cell) + 3, grid = Array.from({ length: NG * NG }, () => []), lines = [];
    const gi = (x, y) => (Math.floor(y / cell) + 1) * NG + Math.floor(x / cell) + 1;
    const free = (x, y, d, id, k) => { const i0 = Math.floor(x / cell) + 1, j0 = Math.floor(y / cell) + 1, d2 = d * d; for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) { if (i < 0 || j < 0 || i >= NG || j >= NG) continue; const B = grid[j * NG + i]; for (let q = 0; q < B.length; q++) { const p = B[q]; if (p.id === id && Math.abs(p.k - k) < 16) continue; const dx = p.x - x, dy = p.y - y; if (dx * dx + dy * dy < d2) return false; } } return true; };
    const dir = (x, y, vx, vy) => { const t = theta(x, y); let ux = Math.cos(t), uy = Math.sin(t); if (ux * vx + uy * vy < 0) { ux = -ux; uy = -uy; } return [ux, uy]; };
    const trace = (x0, y0) => {
      if (x0 < 0 || y0 < 0 || x0 > 1 || y0 > 1 || !inside(x0, y0) || !free(x0, y0, sep * .92, -1, 0)) return null;
      const id = lines.length, fw = [], bw = [], t0 = theta(x0, y0); grid[gi(x0, y0)].push({ x: x0, y: y0, id, k: 0 });
      [1, -1].forEach(sg => {
        let x = x0, y = y0, vx = Math.cos(t0) * sg, vy = Math.sin(t0) * sg, k = 0; const out = sg > 0 ? fw : bw;
        for (let st = 0; st < 1400; st++) {
          const [ux, uy] = dir(x, y, vx, vy), [wx, wy] = dir(x + ux * hh * .5, y + uy * hh * .5, ux, uy), nx = x + wx * hh, ny = y + wy * hh; k += sg;
          if (!inside(nx, ny) || !free(nx, ny, dtest, id, k)) break;
          x = nx; y = ny; vx = wx; vy = wy; out.push(x, y); grid[gi(x, y)].push({ x, y, id, k });
        }
      });
      const n = fw.length / 2 + bw.length / 2 + 1; if (n < 4) return null;
      const X = new Float32Array(n), Y = new Float32Array(n); let o = 0;
      for (let i = bw.length - 2; i >= 0; i -= 2) { X[o] = bw[i]; Y[o++] = bw[i + 1]; } X[o] = x0; Y[o++] = y0; for (let i = 0; i < fw.length; i += 2) { X[o] = fw[i]; Y[o++] = fw[i + 1]; }
      const L = { x: X, y: Y }; lines.push(L); return L;
    };
    const Q = []; let qi = 0;
    const seeds = L => { for (let i = 0; i < L.x.length - 1; i += 2) { const x = L.x[i], y = L.y[i], dx = L.x[i + 1] - x, dy = L.y[i + 1] - y, l = Math.hypot(dx, dy) || 1; Q.push(x - dy / l * sep, y + dx / l * sep, x + dy / l * sep, y - dx / l * sep); } };
    const run = () => { while (qi < Q.length) { const L = trace(Q[qi], Q[qi + 1]); qi += 2; if (L) seeds(L); } };
    const pcx = cores.length ? cx + A * cores.reduce((a, c) => a + c[0], 0) / cores.length : cx, pcy = cores.length ? cy + A * cores.reduce((a, c) => a + c[1], 0) / cores.length : cy + .12;
    const L0 = trace(pcx + sep * 2.5, pcy + sep * .7); if (L0) seeds(L0); run();
    for (let y = .1; y < .95; y += sep * 1.5) for (let x = .1; x < .9; x += sep * 1.5) { const L = trace(x, y); if (L) { seeds(L); run(); } }
    let dmax = 0; lines.forEach(L => { for (let i = 0; i < L.x.length; i++) dmax = Math.max(dmax, Math.hypot(L.x[i] - pcx, L.y[i] - pcy)); });
    lines.forEach(L => { L.u = new Float32Array(L.x.length); L.edge = new Float32Array(L.x.length); for (let i = 0; i < L.x.length; i++) { L.u[i] = Math.hypot(L.x[i] - pcx, L.y[i] - pcy) / (dmax || 1); L.edge[i] = clamp((1 - sh(L.x[i], L.y[i])) * 7, 0, 1); } });
    return { lines, pcx, pcy, dmax };
  });
}
function prtPrint(g, W, H, P, G, t, o) {
  const RG = prtRidges(P, G), n2 = prtNoise(G.seed ^ 0x5a), S = Math.min(W, H), np = G.pal.length, ons = P.on.filter(x => x.s > .25);
  const brk = new Uint8Array(1024); ons.forEach(q => { for (let i = Math.max(0, Math.round(q.t * 1023) - 1); i <= Math.min(1023, Math.round(q.t * 1023) + 1); i++) brk[i] = Math.max(brk[i], 1 + Math.round(q.s * 3)); });
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.globalCompositeOperation = 'source-over';
  const dots = G.grain > .55, lw0 = S * G.sep;
  RG.lines.forEach((L, li) => {
    let key = '', open = false; const flush = () => { if (open) g.stroke(); open = false; key = ''; };
    for (let i = 1; i < L.x.length; i++) {
      const u = L.u[i], x = L.x[i], y = L.y[i]; if (u > t) { flush(); continue; }
      const b = brk[Math.round(u * 1023)]; if (b && ((li * 13 + Math.floor(i / 3)) % 11) < b) { flush(); continue; }
      if (dots && ((i + li) % 3 === 0 || n2(x * 70, y * 70) > .5 - G.grain * .45)) { flush(); continue; }
      const e = prtAt(P.e, u); if (e < .07) { flush(); continue; }
      const q = clamp((n2.fbm(x * 1.9 + 3.3, y * 1.9 - 1.7, 2) * 1.5 + .5) * (np - 1), 0, np - 1), i0 = Math.floor(q), i1 = Math.min(np - 1, i0 + 1), fq = (q - i0) * (q - i0) * (3 - 2 * (q - i0)), row = P.c[Math.min(PRT_M - 1, Math.floor(u * PRT_M))], v = row[G.pal[i0].pc] * (1 - fq) + row[G.pal[i1].pc] * fq, hue = Math.round(prtMixH(G.pal[i0].h, G.pal[i1].h, fq) / 5) * 5;
      const al = Math.round(clamp((.25 + .6 * v) * (.4 + .5 * e) * L.edge[i] * (G.dark ? .9 : 1.15), 0, 1) * 10) / 10; if (al <= 0) { flush(); continue; }
      const lw = Math.round(lw0 * (.24 + .36 * e) * (1 + .35 * G.wob * n2(x * 45, y * 45)) * 2) / 2, li2 = Math.round((G.dark ? 6 : -4) * v), k = hue + '|' + al + '|' + lw + '|' + li2;
      if (k !== key) { flush(); key = k; g.strokeStyle = prtColH(G, hue, al, G.lit + li2); g.lineWidth = Math.max(.6, lw); g.beginPath(); g.moveTo(L.x[i - 1] * S, L.y[i - 1] * S); open = true; }
      g.lineTo(x * S, y * S);
    }
    flush();
  });
  g.restore();
}

/* 〰 Flow: particles in a field made from the sound. A calm, pitched sound is laminar (long ribbons drifting one way); motion
   makes eddies; each onset is a burst. The still is a long exposure of the whole sound; while it plays, the field lives. */
function prtFlowNew(P, G, N) {
  const s = { N, x: new Float32Array(N), y: new Float32Array(N), px: new Float32Array(N), py: new Float32Array(N), vx: new Float32Array(N), vy: new Float32Array(N), life: new Float32Array(N), pi: new Uint8Array(N), lu: new Uint8Array(N), rnd: prtRand(G.seed ^ 0xf10), tau: 0, on: 0 };
  for (let i = 0; i < N; i++) { prtFlowSpawn(s, P, G, i, 0); s.life[i] *= s.rnd(); } return s;
}
function prtFlowSpawn(s, P, G, i, u, ex, ey) {
  const r = s.rnd, row = P.c[Math.min(PRT_M - 1, Math.floor(u * PRT_M))];
  s.x[i] = ex == null ? r() * 1.2 - .1 : ex + (r() - .5) * .03; s.y[i] = ey == null ? r() * 1.2 - .1 : ey + (r() - .5) * .03; s.px[i] = s.x[i]; s.py[i] = s.y[i]; s.vx[i] = 0; s.vy[i] = 0; s.life[i] = 40 + r() * (80 + 160 * G.lam);
  let tot = 0; G.pal.forEach(p => { tot += .2 + row[p.pc]; }); let q = r() * tot, k = 0; for (; k < G.pal.length - 1; k++) { q -= .2 + row[G.pal[k].pc]; if (q <= 0) break; } s.pi[i] = k; s.lu[i] = r() < .55 ? 0 : 1;
}
function prtFlowStep(s, g, S, P, G, u, still, Hy) {
  Hy = Hy || S;
  const n2 = prtNoise(G.seed ^ 0x9f), e = prtAt(P.e, u), sp = .0034 * (.35 + 1.3 * e), fs = G.fs, ep = .0016, tu = s.tau;
  while (s.on < P.on.length && P.on[s.on].t <= u) {
    const q = P.on[s.on++]; if (q.s < .2) continue; const hr = prtRand(G.seed ^ (s.on * 977)), ex = .12 + .76 * hr(), ey = .12 + .76 * hr(), k = Math.round((20 + 150 * q.s) * s.N / 1500);
    for (let j = 0; j < k; j++) { const i = Math.floor(s.rnd() * s.N); prtFlowSpawn(s, P, G, i, q.t, ex, ey); const a = s.rnd() * 6.2832, v = (.003 + .009 * q.s) * (.3 + s.rnd()); s.vx[i] = Math.cos(a) * v; s.vy[i] = Math.sin(a) * v; s.life[i] = 25 + s.rnd() * 70; }
  }
  s.tau += .02 * (.4 + G.m + e);
  const ps = (a, b) => n2.fbm(a * fs + tu * .07, b * fs - tu * .05, 3), dl = 2.4 * G.lam, ct = G.turb * .32 / fs, th0 = Math.atan2(G.dy, G.dx);
  for (let i = 0; i < s.N; i++) {
    const x = s.x[i], y = s.y[i], cxv = (ps(x, y + ep) - ps(x, y - ep)) / (2 * ep), cyv = -(ps(x + ep, y) - ps(x - ep, y)) / (2 * ep);
    s.px[i] = x; s.py[i] = y; const th = th0 + 2.4 * n2.fbm(x * .8 + 40 + tu * .01, y * .8 - 20, 2); s.x[i] = x + (Math.cos(th) * dl + cxv * ct) * sp + s.vx[i]; s.y[i] = y + (Math.sin(th) * dl + cyv * ct) * sp + s.vy[i]; s.vx[i] *= .94; s.vy[i] *= .94;
    if (--s.life[i] <= 0 || x < -.12 || x > 1.12 || y < -.12 || y > 1.12) prtFlowSpawn(s, P, G, i, u);
  }
  g.save(); g.lineCap = 'round'; g.lineWidth = Math.max(.7, S / 1000) * (1 + .6 * G.lam); g.globalCompositeOperation = G.dark ? 'lighter' : 'source-over';
  const a = (still ? (G.dark ? .045 : .06) : .2) * (.45 + .75 * e) * G.ink;
  for (let k = 0; k < G.pal.length; k++) for (let l = 0; l < 2; l++) {
    g.strokeStyle = prtCol(G, k, a, G.dark ? G.lit + (l ? 16 : -4) : G.lit + (l ? -12 : 0)); g.beginPath();
    for (let i = 0; i < s.N; i++) if (s.pi[i] === k && s.lu[i] === l) { g.moveTo(s.px[i] * S, s.py[i] * Hy); g.lineTo(s.x[i] * S, s.y[i] * Hy); }
    g.stroke();
  }
  g.restore();
}
function prtFlowStill(g, S, P, G) {
  prtGround(g, S, S, G); const N = Math.round(clamp(S * 1.6, 250, 4200) * (1 + .5 * Math.min(1, G.dens / 4))), s = prtFlowNew(P, G, N), steps = S < 200 ? 140 : 320;
  prtGlow(g, S, S, G, c => { for (let i = 0; i < steps; i++) prtFlowStep(s, c, S, P, G, i / (steps - 1), true); });
}

/* ⛰ Terrain: the spectrum as a landscape you travel over, low notes and high ones placed by the sound's own noise. Night and
   neon for dark sounds, a pale dawn and ink for bright ones; lines, a mesh or dots by how pitched it is; onsets as fountains. */
function prtTerrain(g, W, H, P, G, t, o) {
  const n2 = prtNoise(G.seed ^ 0x7e1), rnd = prtRand(G.seed ^ 0x7e11), ck = o.clock || 0, hor = H * (.3 + .08 * rnd()), s = Math.min(W, H) / 1000, np = G.pal.length;
  /* the sky: a smooth gradient with a glow along the horizon in its colours, grain over it so it never bands */
  const sky = g.createLinearGradient(0, 0, 0, H);
  if (G.dark) { sky.addColorStop(0, '#020207'); sky.addColorStop(.55 * hor / H, prtCol(G, 0, 1, 5)); sky.addColorStop(hor / H, prtCol(G, 0, 1, 13 + 8 * G.b)); sky.addColorStop(1, '#030307'); }
  else { sky.addColorStop(0, 'hsl(' + G.pal[0].h + ',' + Math.round(10 + 25 * G.tonal) + '%,94%)'); sky.addColorStop(hor / H, 'hsl(' + G.pal[np > 1 ? 1 : 0].h + ',' + Math.round(15 + 40 * G.tonal) + '%,' + (G.tonal > .3 ? 83 : 88) + '%)'); sky.addColorStop(Math.min(1, hor / H + .05), G.bg); sky.addColorStop(1, G.bg); }
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  if (!G.dark && G.tonal > .3) { const x = W * (.25 + .5 * rnd()), gr = g.createRadialGradient(x, hor, 0, x, hor, W * .09); gr.addColorStop(0, prtCol(G, 0, .9, 72)); gr.addColorStop(.6, prtCol(G, 0, .35, 80)); gr.addColorStop(1, prtCol(G, 0, 0, 85)); g.fillStyle = gr; g.fillRect(0, 0, W, hor); }
  if (G.dark) { const ns = Math.round(60 + 180 * G.b); for (let i = 0; i < ns; i++) { const x = rnd() * W, y = rnd() * hor * .95, tw = .35 + .65 * Math.abs(Math.sin(ck * (.4 + rnd()) + i)); g.fillStyle = 'rgba(255,255,255,' + (tw * rnd() * .8).toFixed(2) + ')'; const z = (1 + rnd() * 1.4) * s; g.fillRect(x, y, z, z); } }
  { const r2 = prtRand(G.seed ^ 0x5ca), nn = Math.round(W * hor / 500); g.fillStyle = G.dark ? 'rgba(255,255,255,.035)' : 'rgba(70,50,30,.05)'; for (let i = 0; i < nn; i++) g.fillRect(r2() * W, r2() * hor * 1.05, s * 1.2, s * 1.2); }
  const rows = 54, cols = Math.round(clamp(W / 7, 60, 170)), amp = .35 + .65 * G.dyn, fountX = Array.from({ length: 11 }, () => rnd() * 1.8 - .9);
  let prev = null;
  for (let j = 0; j < rows; j++) {
    const Z = 1 + 7 * (1 - j / (rows - 1)), near = 1 - (Z - 1) / 7, u = o.still ? 1 - (Z - 1) / 7 : t + (Z - 1) / 7 * .2, uu = clamp(u, 0, 1), e = u > 1 ? 0 : prtAt(P.e, uu), bd0 = prtRow(P.bd, uu), bmx = Math.max(.05, ...bd0), bd = bd0.map(v => v / bmx), f = prtAt(P.f, uu);
    let hit = 0, hq = 0; P.on.forEach((x, qi) => { const d = Math.abs(x.t - u); if (d < .005 && x.s * (1 - d / .005) > hit) { hit = x.s * (1 - d / .005); hq = qi; } });
    const pts = [];
    for (let i = 0; i <= cols; i++) {
      const X = i / cols * 2 - 1, bp = clamp((X + 1) / 2 * 7 + 2.2 * n2.fbm(X * 1.1 + 5, 1.3, 2), 0, 7), k = Math.floor(bp), fr = bp - k, band = bd[Math.min(7, k)] * (1 - fr) + bd[Math.min(7, k + 1)] * fr;
      const y = Math.pow(band, 1.7) * (.2 + .8 * e) * amp * .95 + .08 * f * n2(X * 9, uu * 50) + .06 * n2.fbm(X * 3 + 1, uu * 9, 2) + .04;
      pts.push([W / 2 + X * W * 1.9 / Z, hor + H * .7 / Z - y * H * .6 / Z, y, X]);
    }
    const al = clamp((.22 + .75 * near) * (G.dark ? 1 : 1.4), 0, 1), lw = (.5 + 1.7 * near) * s * (G.dark ? 1 : 1.2);
    g.globalCompositeOperation = 'source-over'; g.fillStyle = G.dark ? '#04040a' : G.bg; g.beginPath(); g.moveTo(pts[0][0], H); pts.forEach(p => g.lineTo(p[0], p[1])); g.lineTo(pts[cols][0], H); g.closePath(); g.fill();
    const gr = g.createLinearGradient(pts[0][0], 0, pts[cols][0], 0); for (let q = 0; q <= 8; q++) { const X = q / 4 - 1, pi = Math.floor(clamp((n2(X * 1.4 + 2, 3.1) * 1.6 + .5) * np, 0, np - .01)); gr.addColorStop(q / 8, prtCol(G, pi, al, G.dark ? G.lit + 6 * near : G.lit - 4)); }
    g.globalCompositeOperation = G.dark ? 'lighter' : 'source-over'; g.strokeStyle = gr; g.fillStyle = gr;
    if (G.style === 'dots') { for (let i = 0; i <= cols; i += 1) { const p = pts[i], r = lw * (.9 + 2.2 * p[2]) * (G.dark ? 1 : 1.4); g.fillRect(p[0] - r / 2, p[1] - r / 2, r, r); } }
    else { g.lineWidth = lw; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
      if (G.style === 'mesh' && prev) { g.lineWidth = lw * .5; g.beginPath(); for (let i = 0; i <= cols; i += 4) { g.moveTo(prev[i][0], prev[i][1]); g.lineTo(pts[i][0], pts[i][1]); } g.stroke(); } }
    if (G.dark) for (let i = 2; i < cols - 2; i++) { const p = pts[i]; if (p[2] > .32 && p[2] >= pts[i - 1][2] && p[2] >= pts[i + 1][2]) { const r = (1.2 + 3 * p[2]) * s * (.4 + near); g.fillStyle = prtCol(G, i % np, .5 * near + .1, 80); g.beginPath(); g.arc(p[0], p[1], r, 0, 6.2832); g.fill(); } }
    if (hit > .15) {
      const fx = fountX[hq % fountX.length], i = Math.round((fx + 1) / 2 * cols), p = pts[Math.max(0, Math.min(cols, i))], len = hit * H * .55 / Z * 1.6, lg = g.createLinearGradient(0, p[1], 0, p[1] - len);
      lg.addColorStop(0, prtCol(G, hq % np, .9, G.dark ? 75 : 40)); lg.addColorStop(1, prtCol(G, hq % np, 0, 80)); g.strokeStyle = lg; g.lineWidth = (1.5 + 3 * hit) * s * (.5 + near); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0], p[1] - len); g.stroke();
      for (let k = 0; k < 8; k++) { const yy = p[1] - len * rnd(), xx = p[0] + (rnd() - .5) * 14 * s * (.5 + near); g.fillStyle = prtCol(G, k % np, .7, 80); g.fillRect(xx, yy, 2 * s, 2 * s); }
    }
    prev = pts;
  }
}

/* ✿ Bloom: one ring for each moment, from the centre out, each a superformula (Gielis): its symmetry the sound's pulse, its
   petals rounder for a calm sound and sharper for a busy one, their sides shaped by the spectrum at that moment. */
function prtBloom(g, W, H, P, G, t, o) {
  const K = 15, m = G.sym, Rm = Math.min(W, H) * .46, cx = W / 2, cy = H / 2, ck = o.still ? 0 : (o.clock || 0), s = Math.min(W, H) / 1000, N = 600, np = G.pal.length;
  const sf = (ph, mm, n1, n2, n3) => Math.pow(Math.pow(Math.abs(Math.cos(mm * ph / 4)), n2) + Math.pow(Math.abs(Math.sin(mm * ph / 4)), n3), -1 / n1);
  g.save(); g.globalCompositeOperation = G.dark ? 'lighter' : 'source-over'; g.lineJoin = 'round';
  for (let k = K - 1; k >= 0; k--) {
    const u = (k + .5) / K, on = !o.playing || u <= t + .02, e = prtAt(P.e, u), f = prtAt(P.f, u), bd0 = prtRow(P.bd, u), bmx = Math.max(.05, ...bd0), row = P.c[Math.min(PRT_M - 1, Math.floor(u * PRT_M))];
    const rank = G.pal.map((p, i) => [i, row[p.pc]]).sort((a, b) => b[1] - a[1]), pi = rank[k % 2 && np > 1 ? 1 : 0][0], strong = rank[0][1];
    const hit = P.on.some(x => Math.abs(x.t - u) < .5 / K && x.s > .35), mm = hit ? m * 2 : k % 5 === 4 ? Math.max(2, Math.round(m / 2)) : m;
    const n1 = .18 + 5 * Math.pow(1 - f, 1.5) * (.4 + .6 * G.tonal), q2 = .25 + 3.2 * bd0[2] / bmx, q3 = .25 + 3.2 * bd0[5] / bmx;
    const R = Rm * (.06 + .94 * Math.pow((k + 1) / K, 1.15)) * (.86 + .14 * e) * (o.still ? 1 : 1 + .025 * Math.sin(ck * 1.2 + k * .7)), rot = k * (Math.PI / m * .5 + G.m * .32) + ck * .035 * (k % 2 ? 1 : -1);
    const rr = new Float32Array(N); let mx = 0; for (let i = 0; i < N; i++) { const v = sf(i / N * 6.2832, mm, n1, q2, q3); rr[i] = isFinite(v) ? v : 0; if (rr[i] > mx) mx = rr[i]; }
    const shape = sc => { g.beginPath(); for (let i = 0; i <= N; i++) { const ph = (i % N) / N * 6.2832, r = R * sc * (rr[i % N] || mx) / (mx || 1), x = cx + r * Math.cos(ph + rot), y = cy + r * Math.sin(ph + rot); if (i) g.lineTo(x, y); else g.moveTo(x, y); } };
    const dim = on ? 1 : .15, li = G.lit + (G.dark ? 8 * strong : -6 * strong);
    if (k % 3 === 0) { g.fillStyle = prtCol(G, pi, (G.dark ? .035 : .05) * dim, G.lit + (G.dark ? -12 : 22)); shape(1); g.fill(); }
    for (let hch = 0; hch < 3; hch++) { g.strokeStyle = prtCol(G, pi, Math.min(1, (.55 - hch * .17) * (.35 + .65 * e) * dim * G.ink), li + (G.dark ? hch * 5 : -hch * 4)); g.lineWidth = (hch ? .7 : 1.1 + 1.6 * e) * s; shape(1 - hch * .04 * (1 + G.grain)); g.stroke(); }
    if (on && hit) { for (let i = 0; i < mm; i++) { const ph = i / mm * 6.2832 + rot, x = cx + R * 1.05 * Math.cos(ph), y = cy + R * 1.05 * Math.sin(ph); g.fillStyle = prtCol(G, pi, .9, G.dark ? 82 : 32); g.beginPath(); g.arc(x, y, (1.4 + 2.4 * e) * s, 0, 6.2832); g.fill(); } }
  }
  g.restore();
}

/* ∞ Harmonograph: one figure for each chord of its progression, laid over each other: two pendulums tuned to the chord (the
   tonic a fifth, 3:2; a major chord its major third, 5:4; a minor one its minor third, 6:5) and a turning table a hair out of
   tune. The sound's motion detunes it, its dynamics set how long it swings. While it plays, the chord sounding shines. */
function prtHarmono(g, W, H, P, G, t, o) {
  const R = G.R, chs = R.chords.slice(0, 6), cur = Math.min(chs.length - 1, Math.floor(clamp(t, 0, .999) * chs.length)), s = Math.min(W, H) / 1000, cx = W / 2, cy = H / 2, ck = o.still ? 0 : (o.clock || 0) * .22;
  const eps = .003 + .009 * G.m, d = .0024 + .0055 * G.dyn, N = 7000, T = 2 * Math.PI * 58;
  g.save(); g.globalCompositeOperation = G.dark ? 'lighter' : 'source-over'; g.lineCap = 'round';
  chs.forEach((ch, ci) => {
    const [fa, fb] = ch.root === P.key ? [2, 3] : ch.q === 'm' ? [5, 6] : [4, 5], rnd = prtRand(G.seed ^ (ci * 7919 + ch.root)), ph = [rnd(), rnd(), rnd()].map(v => v * 6.2832), A = Math.min(W, H) * (.23 - ci * .012);
    const lit = !o.playing || ci === cur, hue = Math.round((prtHue(ch.root) + 360) % 360), lw = (lit ? 1.1 : .8) * s * (chs.length > 3 ? .85 : 1), a0 = (!o.playing ? .34 : lit ? .5 : .1) * (G.dark ? 1 : 1.7);
    let px = 0, py = 0; g.lineWidth = lw;
    for (let i = 0; i <= N; i++) {
      const tt = i / N * T, k = Math.exp(-d * tt), x = cx + A * k * (Math.sin(tt + ph[0]) + Math.sin(tt * (1 + eps) + ph[1] + ck + ci)), y = cy + A * k * (Math.sin(fb / fa * tt + ph[2]) + Math.sin(tt * (1 + eps) + ph[1] + ck + ci + Math.PI / 2));
      if (i % 70 === 0) { if (i) g.stroke(); g.strokeStyle = 'hsla(' + hue + ',' + G.sat + '%,' + (G.lit + (G.dark ? 10 * i / N : -6 * i / N)).toFixed(0) + '%,' + (a0 * (k * .8 + .2)).toFixed(3) + ')'; g.beginPath(); g.moveTo(i ? px : x, i ? py : y); }
      g.lineTo(x, y); px = x; py = y;
    }
    g.stroke();
  });
  g.restore();
}

/* ---------- the piece ---------- */
/** grow the ambient piece from print P (and, given src { x, sr }, the recording an octave down). → { l, r, sr, len } */
async function prtCompose(P, src) {
  const sr = 44100, R = prtRead(P), rnd = prtRand(parseInt(P.id, 16) ^ 0x51ab), len = Math.round(clamp(32 + P.dur * .6, 36, 96));
  const O = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!O) throw new Error('This browser can’t make audio faster than it plays');
  const c = new O(2, sr * len, sr), hz = m => 440 * Math.pow(2, (m - 69) / 12), at = u => clamp(u, 0, 1) * (len - 4) + .5;
  const curve = (fn, n = 96) => Float32Array.from({ length: n }, (_, i) => fn(i / (n - 1)));
  const master = c.createGain(), comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 2.5; comp.attack.value = .05; comp.release.value = .5; master.connect(comp); comp.connect(c.destination);
  master.gain.setValueAtTime(0, 0); master.gain.linearRampToValueAtTime(.8, 3); master.gain.setValueAtTime(.8, len - 5); master.gain.linearRampToValueAtTime(0, len - .2);
  const irN = Math.round(sr * 4.5), ir = c.createBuffer(2, irN, sr); for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < irN; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / irN, 2.8); }
  const verb = c.createConvolver(); verb.buffer = ir; const wet = c.createGain(); wet.gain.value = .5; verb.connect(wet); wet.connect(master);
  const send = (node, dry, w) => { const a = c.createGain(); a.gain.value = dry; node.connect(a); a.connect(master); const b = c.createGain(); b.gain.value = w; node.connect(b); b.connect(verb); };
  const bAvg = P.b.reduce((s, v) => s + v, 0) / P.b.length;
  /* pads on the chords, voice-led; the filter opens with the brightness */
  const pad = c.createBiquadFilter(); pad.type = 'lowpass'; pad.Q.value = .8; pad.frequency.setValueCurveAtTime(curve(u => 380 + 2600 * Math.pow(prtAt(P.b, u), 1.4)), 0, len);
  const padG = c.createGain(); padG.gain.value = .15; pad.connect(padG); send(padG, .55, .75);
  const cd = (len - 2) / R.chords.length; let prev = [57, 60, 64, 67];
  R.chords.forEach((ch, i) => {
    const sc = P.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11], deg = sc.indexOf((ch.root - P.key + 12) % 12), ninth = (P.key + sc[(deg + 1 + 7) % 7]) % 12;
    const pcs = [ch.root, (ch.root + ch.iv[1]) % 12, (ch.root + ch.iv[2]) % 12, ninth], v = pcs.map((pc, j) => { let best = 0, bd = 99; for (let m = 50; m <= 79; m++) if (m % 12 === pc && Math.abs(m - prev[j]) < bd) { bd = Math.abs(m - prev[j]); best = m; } return best; });
    const t0 = Math.max(0, i * cd - 1.2), t1 = Math.min(len, (i + 1) * cd + 2.4);
    v.forEach(m => [-7, 7].forEach(det => { const o = c.createOscillator(), gg = c.createGain(); o.type = bAvg > .55 ? 'sawtooth' : 'triangle'; o.frequency.value = hz(m); o.detune.value = det + (rnd() - .5) * 5; gg.gain.setValueAtTime(0, t0); gg.gain.linearRampToValueAtTime(.12, t0 + 2.4); gg.gain.setValueAtTime(.12, Math.max(t0 + 2.5, t1 - 3)); gg.gain.linearRampToValueAtTime(0, t1); o.connect(gg); gg.connect(pad); o.start(t0); o.stop(t1 + .05); }));
    const b = c.createOscillator(), bg = c.createGain(); b.type = 'sine'; b.frequency.value = hz(36 + ch.root); bg.gain.setValueAtTime(0, t0); bg.gain.linearRampToValueAtTime(.22, t0 + 2); bg.gain.setValueAtTime(.22, Math.max(t0 + 2.1, t1 - 2.5)); bg.gain.linearRampToValueAtTime(0, t1); b.connect(bg); send(bg, .7, .25); b.start(t0); b.stop(t1 + .05);
    prev = v;
  });
  /* wind for its noise: filtered noise that breathes with the loudness */
  const nb = c.createBuffer(1, sr * 2, sr), nd = nb.getChannelData(0); let pk = 0; for (let i = 0; i < nd.length; i++) { pk = .97 * pk + (rnd() * 2 - 1) * .03; nd[i] = pk * 6; }
  const ns = c.createBufferSource(); ns.buffer = nb; ns.loop = true; const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.Q.value = .7; nf.frequency.setValueCurveAtTime(curve(u => 300 + 2400 * prtAt(P.b, u)), 0, len);
  const ng = c.createGain(); ng.gain.setValueCurveAtTime(curve(u => (.03 + .3 * prtAt(P.e, u)) * (1.1 - P.tonal)), 0, len); ns.connect(nf); nf.connect(ng); send(ng, .35, .9); ns.start(0); ns.stop(len);
  /* bells on its onsets, in the pentatonic scale, the note its colour at that moment */
  const pent = P.minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9], beat = P.bpm ? 60 / (P.bpm * P.dur / len) / 2 : 0, dl = c.createDelay(2), fb = c.createGain(); dl.delayTime.value = beat ? Math.min(1.8, beat * 3) : .42; fb.gain.value = .3; dl.connect(fb); fb.connect(dl); dl.connect(verb);
  P.on.filter(x => x.s > .15).sort((a, b) => b.s - a.s).slice(0, 56).forEach(x => {
    let t0 = at(x.t); if (beat) t0 = Math.round(t0 / beat) * beat; if (t0 > len - 5) return;
    const row = prtRow(P.c, x.t); let best = 0, bv = -1; pent.forEach(iv => { const v = row[(P.key + iv) % 12] + rnd() * .25; if (v > bv) { bv = v; best = iv; } });
    const m = (prtAt(P.b, x.t) > .5 ? 84 : 72) + P.key + best - (P.key + best >= 6 ? 12 : 0), f = hz(m), car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), amp = c.createGain(), pan = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 2, t0); mg.gain.exponentialRampToValueAtTime(1, t0 + 1.6); mod.connect(mg); mg.connect(car.frequency);
    const v = .05 + .11 * x.s; amp.gain.setValueAtTime(0, t0); amp.gain.linearRampToValueAtTime(v, t0 + .006); amp.gain.exponentialRampToValueAtTime(.0001, t0 + 3.8); if (pan.pan) pan.pan.value = (rnd() * 2 - 1) * .7;
    car.connect(amp); amp.connect(pan); send(pan, .45, .8); pan.connect(dl); car.start(t0); mod.start(t0); car.stop(t0 + 4); mod.stop(t0 + 4);
  });
  /* the recording itself, an octave down, under everything */
  if (src && src.x && src.x.length) {
    const n = Math.min(src.x.length, src.sr * 60), b = c.createBuffer(1, n, src.sr); b.copyToChannel(src.x.subarray(0, n), 0);
    const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = .5; s.loop = n / src.sr * 2 < len; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; const wg = c.createGain(); wg.gain.value = .22;
    s.connect(lp); lp.connect(wg); send(wg, .3, .8); s.start(.5); s.stop(len);
  }
  const out = await c.startRendering(), l = out.getChannelData(0), r = out.getChannelData(1); let p = 0;
  for (let i = 0; i < l.length; i++) { const a = Math.abs(l[i]), b = Math.abs(r[i]); if (a > p) p = a; if (b > p) p = b; }
  const g = p > 0 ? .89 / p : 1; for (let i = 0; i < l.length; i++) { l[i] *= g; r[i] *= g; }
  return { l, r, sr, len, woven: !!(src && src.x) };
}

/* ---------- your soundprints, kept on this device ---------- */
function prtShelfRead() { try { const a = JSON.parse(localStorage.getItem(PRT.KEEP) || '[]'); return Array.isArray(a) ? a.filter(x => x && typeof x.c === 'string') : []; } catch (e) { return []; } }
function prtShelfWrite(a) { try { localStorage.setItem(PRT.KEEP, JSON.stringify(a.slice(0, PRT.MAX))); return true; } catch (e) { return false; } }
function prtKeep(P) { const a = prtShelfRead().filter(x => x.id !== P.id); a.unshift({ id: P.id, c: slB64(P.bytes), t: Date.now() }); return prtShelfWrite(a); }
const prtKept = P => prtShelfRead().some(x => x.id === P.id);
function prtShelf() {
  const a = prtShelfRead(); if (!a.length) return h('p', { class: 'tiny muted prt-none' }, 'Your soundprints are kept here, on this device.');
  const grid = h('div', { class: 'prt-shelf', id: 'prtShelf' });
  a.forEach(x => {
    let P; try { P = prtUnpack(slUnB64(x.c)); } catch (e) { return; }
    const cv = h('canvas', { width: 120, height: 120, 'aria-hidden': 'true' });
    const del = h('button', { class: 'prt-del', type: 'button', title: 'Remove from this device', 'aria-label': 'Remove “' + (P.title || 'Untitled') + '”', onclick: e => { e.stopPropagation(); prtShelfWrite(prtShelfRead().filter(y => y.id !== P.id)); card.remove(); } }, '✕');
    const card = h('div', { class: 'prt-card' }, h('button', { class: 'prt-open', type: 'button', title: 'Open “' + (P.title || 'Untitled') + '”', onclick: () => { PRT.src = null; prtShow(P, { mine: true }); } }, cv, h('span', {}, P.title || 'Untitled'), h('small', {}, prtDate(P.day))), del);
    grid.append(card); setTimeout(() => { try { prtDraw(cv.getContext('2d'), 120, 120, P, 'print', 1, { still: true }); } catch (e) { } }, 30);
  });
  return h('div', {}, h('h4', { class: 'prt-h' }, 'Your soundprints'), grid);
}

/* ---------- the dialog ---------- */
function prtSay(t) { const s = document.getElementById('prtSay'); if (s) s.textContent = t; }
function prtDlg() {
  if (PRT.body && document.getElementById('prtDlg')) return;
  PRT.body = h('div', { class: 'prt' }); pdlg('prtDlg', '◎ Soundprint', PRT.body, { wide: true, cls: 'prt-dlg', onclose: prtClose });
}
function prtClose() { prtStop(); prtRecStop(false); if (PRT.vid) { try { PRT.vid.mr.stop(); } catch (e) { } } cancelAnimationFrame(PRT.raf); PRT.raf = 0; PRT.cv = null; PRT.body = null; }
/** called by the Audio kill switch */
function prtAbort() { prtStop(); prtRecStop(false); }
/** o: {} chooser · { take } · { song: true } · { master: true } · { link: code } */
async function prtOpen(o = {}) {
  prtDlg();
  if (o.link) { try { const P = await prtFromCode(o.link); PRT.src = null; prtShow(P, { mine: false, link: true }); } catch (e) { prtChoose(); prtSay('That soundprint link could not be opened: ' + (e.message || e) + '.'); } return; }
  prtChoose();
  if (o.print) { PRT.src = null; return prtShow(o.print, { mine: true }); }
  if (o.take) return prtFromTake(o.take); if (o.master || o.song) return prtFromSong(!!o.master);
}
function prtChoose() {
  const B = PRT.body; if (!B) return; prtStop(); B.innerHTML = ''; PRT.cv = null; PRT.cur = null;
  const file = h('input', { type: 'file', accept: 'audio/*,video/*,.mp3,.wav,.flac,.m4a,.ogg,.aac,.webm,.opus', style: { display: 'none' }, onchange: e => { const f = e.target.files[0]; e.target.value = ''; if (f) prtFromFile(f); } });
  const takes = tkLeads().filter(t => (t.dry && t.dry.length) || (t.wet && t.wet.length));
  B.append(
    h('p', { class: 'prt-lede' }, 'Every sound becomes something only it could make: a print, worlds that move with it, a reading of its music and an ambient piece grown from it. It is all made here, and the sound stays on this device.'),
    h('div', { class: 'prt-src' },
      h('button', { class: 'btn primary', id: 'prtRec', type: 'button', onclick: () => prtRecord() }, '● Record a sound'),
      h('button', { class: 'btn', id: 'prtFile', type: 'button', onclick: () => file.click() }, '⤒ An audio file'), file,
      h('button', { class: 'btn', id: 'prtSong', type: 'button', title: FIN.out ? 'The master from Finish it' : 'The whole mix, rendered here', onclick: () => prtFromSong(!!FIN.out) }, FIN.out ? '✦ The finished master' : '♪ This song'),
      takes.length ? h('select', { class: 'in', id: 'prtTake', 'aria-label': 'Make the print of a take', onchange: e => { const tk = takes[+e.target.value]; e.target.value = ''; if (tk) prtFromTake(tk); } }, h('option', { value: '' }, 'A take…'), takes.map((tk, i) => h('option', { value: i }, tk.name || 'Take ' + (i + 1)))) : null),
    h('div', { class: 'prt-recbox', id: 'prtRecBox', hidden: true }, h('span', { class: 'prt-dot', 'aria-hidden': 'true' }), h('span', { class: 'mono', id: 'prtRecT' }, '0:00'), h('span', { class: 'prt-lv' }, h('i', { id: 'prtLv' })),
      h('button', { class: 'btn primary', id: 'prtRecGo', type: 'button', onclick: () => prtRecStop(true) }, '■ Stop and make its print'), h('button', { class: 'btn', type: 'button', onclick: () => prtRecStop(false) }, 'Cancel')),
    h('p', { class: 'small', id: 'prtSay', role: 'status' }), prtShelf());
}
async function prtRecord() {
  if (PRT.rec) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return prtSay('This browser can’t record here. Choose an audio file instead.');
  let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); } catch (e) { return prtSay('The microphone wasn’t allowed. Allow it in the address bar, or choose a file.'); }
  const AC = window.AudioContext || window.webkitAudioContext, actx = new AC(), an = actx.createAnalyser(); an.fftSize = 2048; actx.createMediaStreamSource(stream).connect(an);
  const chunks = [], mr = new MediaRecorder(stream), r = { stream, actx, an, mr, chunks, t0: performance.now(), buf: new Float32Array(2048), keep: false, raf: 0 };
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  mr.onstop = async () => {
    prtRecEnd(r); if (!r.keep) return;
    try { prtSay('Listening to it…'); const { pcm, sr } = await humDecode(await new Blob(chunks, { type: mr.mimeType || 'audio/webm' }).arrayBuffer(), 90); await prtMake(pcm, sr, 'A sound · ' + new Date().toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })); }
    catch (e) { prtSay('That recording couldn’t be read (' + (e.message || e) + ').'); }
  };
  PRT.rec = r; mr.start(250); const box = document.getElementById('prtRecBox'); if (box) box.hidden = false;
  const tick = () => {
    if (PRT.rec !== r) return; r.an.getFloatTimeDomainData(r.buf); let e = 0; for (let i = 0; i < r.buf.length; i++) e += r.buf[i] * r.buf[i]; const sec = (performance.now() - r.t0) / 1000;
    const lv = document.getElementById('prtLv'), tm = document.getElementById('prtRecT'); if (lv) lv.style.width = Math.min(100, Math.round(Math.sqrt(e / r.buf.length) * 600)) + '%'; if (tm) tm.textContent = prtFmt(sec) + ' / 1:00';
    if (sec >= 60) return prtRecStop(true); r.raf = requestAnimationFrame(tick);
  };
  prtSay('Recording: hold the phone or computer near the sound. A minute at most.'); r.raf = requestAnimationFrame(tick);
}
function prtRecStop(keep) { const r = PRT.rec; if (!r) return; r.keep = keep; cancelAnimationFrame(r.raf); try { if (r.mr.state !== 'inactive') r.mr.stop(); else prtRecEnd(r); } catch (e) { prtRecEnd(r); } if (!keep) prtSay(''); }
function prtRecEnd(r) { if (PRT.rec === r) PRT.rec = null; cancelAnimationFrame(r.raf); try { r.stream.getTracks().forEach(t => t.stop()); } catch (e) { } try { r.actx.close(); } catch (e) { } const box = document.getElementById('prtRecBox'); if (box) box.hidden = true; }
/** the largest sound file read for a print: ten minutes of 96 kHz 24-bit stereo, with room to spare */
const PRT_FILE_MAX = 400 * 1048576;
async function prtFromFile(f) {
  if (!f || f.size > PRT_FILE_MAX) { prtSay('That file is too large to read here (over ' + Math.round(PRT_FILE_MAX / 1048576) + ' MB). The first ten minutes of a shorter or compressed copy make the same print.'); return; }      /* 2.65.1: never read a huge file into memory */
  prtSay('Opening ' + f.name + '…');
  try { const { pcm, sr } = await humDecode(await f.arrayBuffer(), 600); await prtMake(pcm, sr, f.name.replace(/\.[^.]+$/, '').slice(0, 60)); }
  catch (e) { prtSay('That file couldn’t be read as audio (' + (e.message || e) + ').'); }
}
async function prtFromTake(tk) {
  const L = tkLead(tk), x = L.wet && L.wet.length ? L.wet : L.dry; if (!x || !x.length) return prtSay('That take has no sound in it.');
  try { await prtMake(x, L.sr || (E.ctx && E.ctx.sampleRate) || 48000, (L.name || 'Take') + (S.title ? ' · ' + S.title : '')); } catch (e) { prtSay(e.message || String(e)); }
}
async function prtFromSong(master) {
  try {
    let o = master && FIN.out ? FIN.out : null;
    if (!o) { prtSay('Rendering the song…'); o = await lxRender(null, p => prtSay('Rendering the song… ' + Math.round((p || 0) * 100) + '%')); }
    const m = new Float32Array(o.l.length); for (let i = 0; i < m.length; i++) m[i] = (o.l[i] + o.r[i]) * .5;
    await prtMake(m, o.sr, (S.title || 'Untitled') + (master && FIN.out ? ' · master' : ''));
  } catch (e) { prtSay('The song couldn’t be rendered: ' + (e.message || e) + '.'); }
}
async function prtMake(x, sr, title) {
  prtSay('Listening to it…'); await new Promise(r => setTimeout(r, 20));
  const A = prtAnalyze(x, sr); A.title = title; A.by = CFG.slName || ''; A.day = prtDayNow();
  const P = prtUnpack(prtPack(A)); PRT.src = { x, sr }; prtKeep(P); prtShow(P, { mine: true }); return P;
}
function prtShow(P, o = {}) {
  const B = PRT.body; if (!B) return; prtStop(); B.innerHTML = ''; PRT.cur = P; PRT.read = prtRead(P); PRT.flow = null; PRT.piece = null; PRT.mine = !!o.mine; PRT.cache = null; PRT.dirty = true;
  const R = PRT.read, cv = h('canvas', { class: 'prt-cv', id: 'prtCv', role: 'img', 'aria-label': 'Soundprint of “' + (P.title || 'Untitled') + '”. ' + R.line });
  const tabs = h('div', { class: 'seg prt-worlds', role: 'tablist', 'aria-label': 'Worlds' }, PRT_WORLDS.map(([k, ico, name]) => h('button', { type: 'button', role: 'tab', class: PRT.world === k ? 'on' : '', 'aria-selected': PRT.world === k ? 'true' : 'false', 'data-w': k, onclick: () => prtWorld(k) }, ico + ' ' + name)));
  const chip = (pc, t) => { const c = h('span', { class: 'prt-chip' }, t); c.style.setProperty('--c', 'hsl(' + prtHue(pc) + ',80%,52%)'); return c; };
  const row = (k, ...v) => h('div', { class: 'prt-row' }, h('dt', {}, k), h('dd', {}, ...v));
  const title = h('input', { class: 'in prt-title', id: 'prtTitle', maxlength: 60, value: P.title || '', placeholder: 'Untitled', 'aria-label': 'Title', onchange: e => prtRetitle(e.target.value) });
  const weave = PRT.src ? h('label', { class: 'chk tiny', title: 'The recording itself, an octave down, under the piece (only here: a link carries the print alone)' }, h('input', { type: 'checkbox', id: 'prtWeave', checked: PRT.weave, onchange: e => { PRT.weave = e.target.checked; PRT.piece = null; } }), ' Weave in the recording') : null;
  B.append(h('div', { class: 'prt-grid' },
    h('div', { class: 'prt-stage' }, tabs, h('div', { class: 'prt-cvbox', style: { background: prtGenome(P).bg } }, cv),
      h('div', { class: 'prt-play' }, h('button', { class: 'btn primary', id: 'prtPlay', type: 'button', onclick: () => prtPlay('piece') }, '▶ Play the piece'), PRT.src ? h('button', { class: 'btn', id: 'prtHear', type: 'button', onclick: () => prtPlay('sound') }, '▶ The sound') : null, weave)),
    h('div', { class: 'prt-side' },
      title, h('div', { class: 'prt-id mono tiny' }, '◎ ' + prtIdText(P) + ' · ' + prtFmt(P.dur) + ' · ' + prtDate(P.day) + (P.by ? ' · ' + P.by : '')),
      o.link ? h('p', { class: 'tiny prt-from' }, 'Someone shared this print with you. The sound stayed with them: what you see and hear is grown from the print, here.') : null,
      h('p', { class: 'prt-line', id: 'prtLine' }, R.line), h('p', { class: 'tiny prt-why', id: 'prtWhy' }, prtGenome(P).why),
      h('dl', { class: 'prt-dl' }, row('Key', R.key + ' (' + R.sure + ')'), row('Pulse', P.bpm ? P.bpm + ' BPM' : 'No steady pulse'), row('Character', R.tone + ', ' + R.motion + ', ' + R.dyn + '; ' + R.kind),
        row('Colours', ...R.colours.map(pc => chip(pc, R.name(pc)))), row('Harmony', h('span', { id: 'prtChords' }, ...R.chords.map(c => chip(c.root, c.sym))))),
      h('button', { class: 'btn', id: 'prtSongGo', type: 'button', title: 'A new song in this key and tempo, with these chords. Your other songs are kept.', onclick: () => prtSong() }, '✎ Start a song from it'),
      h('h4', { class: 'prt-h' }, 'Keep it, share it'),
      h('div', { class: 'prt-ex' },
        h('button', { class: 'btn', id: 'prtPng', type: 'button', title: 'This world as a 2048-pixel picture, with its title and reading', onclick: () => prtArtwork() }, '⤓ Artwork'),
        h('button', { class: 'btn', id: 'prtWav', type: 'button', onclick: () => prtSavePiece() }, '⤓ The piece (WAV)'),
        h('button', { class: 'btn', id: 'prtVid', type: 'button', title: 'This world moving with the piece, as a video (it plays through once while it records)', onclick: () => prtVideo() }, '⏺ Video'),
        h('button', { class: 'btn primary', id: 'prtLink', type: 'button', title: 'A link with the print in it (about 1 kB). The sound is not in it.', onclick: () => prtCopyLink() }, '🔗 Copy link'),
        !prtKept(P) ? h('button', { class: 'btn', id: 'prtKeepBtn', type: 'button', onclick: e => { if (prtKeep(P)) { e.target.remove(); toast('◎ Kept in Your soundprints, on this device.', 'ok'); } } }, '☆ Keep') : null),
      h('p', { class: 'small', id: 'prtSay', role: 'status' }),
      h('p', { class: 'tiny muted' }, 'Colours are notes, round the circle of fifths. The link carries the print, not the sound; whoever opens it sees these worlds and hears a piece grown from them on their own device.'),
      h('button', { class: 'btn sm', id: 'prtBack', type: 'button', onclick: () => { PRT.src = null; prtChoose(); } }, '← Make another'))));
  PRT.cv = cv; prtSize(); if (!PRT.raf) PRT.raf = requestAnimationFrame(prtLoop);
}
function prtSize() {
  const cv = PRT.cv; if (!cv) return; const w = Math.round(Math.min(1100, (cv.parentNode.clientWidth || 480) * Math.min(2, window.devicePixelRatio || 1)));
  if (w > 0 && cv.width !== w) { cv.width = cv.height = w; PRT.cache = null; PRT.dirty = true; }
}
window.addEventListener('resize', () => { if (PRT.cv) prtSize(); });
function prtWorld(k) { PRT.world = k; PRT.dirty = true; document.querySelectorAll('.prt-worlds button').forEach(b => { const on = b.dataset.w === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); }); }
function prtRetitle(t) { const P = PRT.cur; if (!P) return; P.title = String(t || '').slice(0, 60); const Q = prtUnpack(prtPack(P)); Object.assign(P, { bytes: Q.bytes, title: Q.title }); if (prtKept(P)) prtKeep(P); }
/** where the playhead is (0..1), or null when nothing plays */
function prtNow() { const p = PRT.play; if (!p || !E.ctx) return null; return clamp((E.ctx.currentTime - p.t0) / p.len, 0, 1); }
/** draw world w of P live on g (W×W): now = playhead 0..1, or null when nothing plays. st keeps its caches (print, flow layer). */
function prtLive(g, W, P, w, now, clock, st, nb) {
  const G = prtGenome(P), playing = now != null, live = !CFG.reduce, idle = !playing && live && w !== 'print', key = w + '|' + P.id + '|' + W;
  if (w === 'print' || (w === 'flow' && !live)) {
    if (!st.cache || st.cache.key !== key) { const c = document.createElement('canvas'); c.width = c.height = W; prtDraw(c.getContext('2d'), W, W, P, w, 1, { still: true, G, noBg: !!nb }); c.key = key; st.cache = c; }
    if (playing && w === 'print') {
      /* the print grows out from the core as it plays; the ridges at the front shine; onsets flash */
      const RG = prtRidges(P, G), r = RG.dmax * W * Math.min(1, now + .004), cx = RG.pcx * W, cy = RG.pcy * W, fl = P.on.reduce((m, x) => { const d = now - x.t; return d >= 0 && d < .012 ? Math.max(m, x.s * (1 - d / .012)) : m; }, 0);
      if (!nb) prtGround(g, W, W, G); g.save(); g.globalAlpha = .13; g.drawImage(st.cache, 0, 0); g.restore();
      g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.clip(); g.drawImage(st.cache, 0, 0); g.restore();
      g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.arc(cx, cy, Math.max(0, r - W * (.03 + .05 * fl)), 0, 6.2832, true); g.clip(); g.globalCompositeOperation = G.dark ? 'lighter' : 'multiply'; g.globalAlpha = .55 + .45 * fl; g.drawImage(st.cache, 0, 0); g.restore();
    } else g.drawImage(st.cache, 0, 0);
  } else if (w === 'flow') {
    /* a live field on its own layer: trails fade into the ground, the sound moves it */
    let F = st.flow; const u = playing ? now : (clock / 45) % 1;
    if (!F || F.key !== key) { const c = document.createElement('canvas'); c.width = c.height = W; prtDraw(c.getContext('2d'), W, W, P, 'flow', 1, { still: true, G }); F = st.flow = { key, c, s: prtFlowNew(P, G, Math.round(clamp(W * 2, 400, 2400) * (1 + .4 * Math.min(1, G.dens / 4)))), u }; }
    if (u < F.u - .5) F.s.on = 0; while (F.s.on < P.on.length && P.on[F.s.on].t < u - .02) F.s.on++; F.u = u;
    const lg = F.c.getContext('2d'); lg.save(); lg.globalAlpha = G.fade * .3; lg.fillStyle = G.bg; lg.fillRect(0, 0, W, W); lg.restore();
    prtFlowStep(F.s, lg, W, P, G, u, false); g.drawImage(F.c, 0, 0);
  } else prtDraw(g, W, W, P, w, playing ? now : (idle ? (clock / 40) % 1 : 1), { clock, still: !playing && !idle, playing, G, noBg: !!nb });
}
function prtLoop(ts) {
  PRT.raf = 0; const cv = PRT.cv, P = PRT.cur; if (!cv || !P || !document.getElementById('prtCv')) return;
  const now = prtNow(), moving = now != null || (!CFG.reduce && PRT.world !== 'print');
  if (moving || PRT.dirty) { prtLive(cv.getContext('2d'), cv.width, P, PRT.world, now, ts / 1000, PRT); PRT.dirty = false; }
  PRT.raf = requestAnimationFrame(prtLoop);
}

/* ---------- the song's own soundprint, as a look in the Visuals (part 92 puts it in the list) ----------
   The open song is rendered faster than it plays (the whole mix, as Finish it hears it), listened to, and its print is kept with the
   song (S.sprint, about 1.6 kB) so it is there next time. It follows the playhead. When the song changes, the old print stays until
   you press ⟳ Listen again (a render stops playback, so it never starts by itself while the song plays). */
const PRV = { busy: false, pct: 0, err: '', c: '', P: null, sig: '', sigAt: 0, st: {}, off: null, flow: null };
function prtSongSig() {
  const now = performance.now(); if (now - PRV.sigAt < 1000 && PRV.sig) return PRV.sig; PRV.sigAt = now;
  const txt = JSON.stringify([S.sections, S.band, S.bpm, S.key, S.minor, S.ts, S.swing, S.mix]) + '|' + TAKES.map(t => [tkKey(t), t.startSec, t.g, t.cg, t.mute, t.pan, (t.dry || []).length].join()).join(';') + '|' + (STM.ch ? STM.ch.length + ':' + STM.mute : '');
  let hh = 0x811c9dc5; for (let i = 0; i < txt.length; i++) { hh ^= txt.charCodeAt(i); hh = Math.imul(hh, 16777619); } return PRV.sig = (hh >>> 0).toString(16);
}
/** { P, fresh } for the open song, or null if it has none yet */
function prtSongPrint() {
  const sp = S.sprint; if (!sp || typeof sp.c !== 'string' || sp.c.length > PRT_CODE_MAX) return null;
  if (PRV.c !== sp.c) { try { PRV.P = prtUnpack(slUnB64(sp.c)); PRV.c = sp.c; } catch (e) { return null; } }
  return { P: PRV.P, fresh: sp.sig === prtSongSig() };
}
async function prtSongMake() {
  if (PRV.busy) return; PRV.busy = true; PRV.err = ''; PRV.pct = 0; if (typeof prtBarSync === 'function') prtBarSync();
  const song = S;
  try {
    const o = await lxRender(null, p => { PRV.pct = p || 0; }); let pk = 0; const m = new Float32Array(o.l.length); for (let i = 0; i < m.length; i++) { m[i] = (o.l[i] + o.r[i]) * .5; pk = Math.max(pk, Math.abs(m[i])); }
    if (pk < 1e-4) throw new Error('the song is silent so far: add chords, the band or a recording');
    const A = prtAnalyze(m, o.sr); A.title = (S.title || 'Untitled').slice(0, 60); A.by = CFG.slName || ''; A.day = prtDayNow();
    const P = prtUnpack(prtPack(A)); PRV.sigAt = 0; if (S === song) { S.sprint = { sig: prtSongSig(), c: slB64(P.bytes) }; try { await projSave(); } catch (e) { } }
  } catch (e) { PRV.err = e && e.cancelled ? 'the render was stopped' : (e.message || String(e)); }
  finally { PRV.busy = false; if (typeof prtBarSync === 'function') prtBarSync(); }
}
function prtLookMsg(g, W, H, text, sub) {
  g.save(); g.fillStyle = '#05060b'; g.fillRect(0, 0, W, H); const s = Math.min(W, H) / 600;
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1.2 * s; for (let i = 1; i <= 9; i++) { g.beginPath(); g.ellipse(W / 2, H / 2 - 30 * s, i * 13 * s, i * 15 * s, 0, 0, 6.2832); g.stroke(); }
  g.fillStyle = '#f0eee8'; g.textAlign = 'center'; g.font = '600 ' + Math.round(20 * s) + 'px Inter, system-ui, sans-serif'; g.fillText(text, W / 2, H / 2 + 120 * s);
  if (sub) { g.fillStyle = 'rgba(240,238,232,.6)'; g.font = Math.round(14 * s) + 'px Inter, system-ui, sans-serif'; g.fillText(sub, W / 2, H / 2 + 148 * s); }
  g.restore();
}
/** the look: called by the Visuals for every frame while Soundprint is the look */
function prtLook(g, W, H) {
  const sp = prtSongPrint(), playing = !!T.playing;
  if (!sp) {
    if (!PRV.busy && !PRV.err && !playing) prtSongMake();
    return prtLookMsg(g, W, H, PRV.busy ? 'Listening to the song… ' + Math.round(PRV.pct * 100) + '%' : PRV.err ? 'No soundprint: ' + PRV.err + '.' : playing ? 'Stop the song to make its soundprint' : 'Listening to the song…', PRV.busy ? 'Its print is made once and kept with the song.' : PRV.err ? 'Press ⟳ Listen again when it is ready.' : '');
  }
  const P = sp.P, G = prtGenome(P), w = prtLookWorld(), now = playing ? clamp(playheadSlot() / Math.max(1, songSlots()), 0, 1) : null, clock = performance.now() / 1000;
  g.save(); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  if (w === 'terrain') prtTerrain(g, W, H, P, G, now == null ? (CFG.reduce ? 1 : (clock / 40) % 1) : now, { clock, still: now == null && !!CFG.reduce, playing, G });
  else if (w === 'flow') {
    /* the field fills the whole area */
    const key = P.id + '|' + W + 'x' + H; let F = PRV.flow; const u = now != null ? now : (clock / 45) % 1;
    if (!F || F.key !== key) { const c = document.createElement('canvas'); c.width = W; c.height = H; prtGround(c.getContext('2d'), W, H, G); F = PRV.flow = { key, c, s: prtFlowNew(P, G, Math.round(clamp(Math.sqrt(W * H) * 2, 400, 2600) * (1 + .4 * Math.min(1, G.dens / 4)))), u }; }
    if (u < F.u - .5) F.s.on = 0; while (F.s.on < P.on.length && P.on[F.s.on].t < u - .02) F.s.on++; F.u = u;
    const lg = F.c.getContext('2d'); lg.save(); lg.globalAlpha = G.fade * .3; lg.fillStyle = G.bg; lg.fillRect(0, 0, W, H); lg.restore();
    if (!CFG.reduce || now != null) prtFlowStep(F.s, lg, W, P, G, u, false, H); g.drawImage(F.c, 0, 0);
  } else {
    /* the print, the bloom and the harmonograph: square, in the middle of one ground */
    const S2 = Math.max(1, Math.round(Math.min(W, H))); if (!PRV.off || PRV.off.width !== S2) { PRV.off = document.createElement('canvas'); PRV.off.width = PRV.off.height = S2; PRV.st = {}; }
    const oc = PRV.off.getContext('2d'); oc.clearRect(0, 0, S2, S2); prtLive(oc, S2, P, w, now, clock, PRV.st, true);
    prtGround(g, W, H, G); g.drawImage(PRV.off, Math.round((W - S2) / 2), Math.round((H - S2) / 2));
  }
  g.restore();
}

/* ---------- playing ---------- */
async function prtPiece() {
  if (PRT.piece) return PRT.piece; prtSay('Growing the piece…');
  PRT.piece = await prtCompose(PRT.cur, PRT.weave && PRT.src ? PRT.src : null); prtSay('The piece: ' + prtFmt(PRT.piece.len) + ', grown from the print' + (PRT.piece.woven ? ', with the recording an octave down beneath it' : '') + '.'); return PRT.piece;
}
async function prtPlay(kind, dest) {
  const was = PRT.play && PRT.play.kind; prtStop(!!dest); if (was === kind && !dest) return;
  try {
    await startAudio(); const c = E.ctx; let b, len;
    if (kind === 'sound') { const s = PRT.src; if (!s) return; b = c.createBuffer(1, s.x.length, s.sr); b.copyToChannel(s.x, 0); len = s.x.length / s.sr; }
    else { const p = await prtPiece(); b = c.createBuffer(2, p.l.length, p.sr); b.copyToChannel(p.l, 0); b.copyToChannel(p.r, 1); len = p.len; }
    if (!PRT.cur) return; const src = c.createBufferSource(); src.buffer = b; src.connect(c.destination); if (dest) src.connect(dest);
    const t0 = c.currentTime + .05; src.start(t0); PRT.play = { src, t0, len, kind }; src.onended = () => { if (PRT.play && PRT.play.src === src) prtStop(); };
    const btn = document.getElementById(kind === 'sound' ? 'prtHear' : 'prtPlay'); if (btn) btn.textContent = '■ Stop';
    return PRT.play;
  } catch (e) { prtSay('It couldn’t play: ' + (e.message || e) + '.'); }
}
function prtStop(keepVideo) {
  const p = PRT.play; PRT.play = null; PRT.dirty = true; if (p) { try { p.src.onended = null; p.src.stop(); } catch (e) { } }
  const a = document.getElementById('prtPlay'), b = document.getElementById('prtHear'); if (a) a.textContent = '▶ Play the piece'; if (b) b.textContent = '▶ The sound';
  if (!keepVideo && PRT.vid && PRT.vid.mr.state !== 'inactive') { try { PRT.vid.mr.stop(); } catch (e) { } }
}

/* ---------- exports ---------- */
const prtName = (P, ext) => ((P.title || 'soundprint').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'soundprint') + '_' + P.id.slice(0, 4) + ext;
/** the artwork: this world, square, with the title and reading underneath */
function prtArtwork(size) {
  const P = PRT.cur, R = PRT.read; if (!P) return null; const Sz = size || 2048, cap = Math.round(Sz * .13), cv = document.createElement('canvas'); cv.width = Sz; cv.height = Sz + cap;
  const g = cv.getContext('2d'), G = prtGenome(P), dark = G.dark || PRT.world === 'terrain' && G.dark; prtDraw(g, Sz, Sz, P, PRT.world, 1, { still: true, clock: 0, G });
  g.fillStyle = PRT.world === 'terrain' && dark ? '#04040a' : G.bg; g.fillRect(0, Sz, Sz, cap); const ink = dark ? '#f2f0ea' : '#1c1a22', mute = dark ? 'rgba(242,240,234,.62)' : 'rgba(28,26,34,.6)', pad = Sz * .045;
  g.textBaseline = 'alphabetic'; g.fillStyle = ink; g.font = '600 ' + Math.round(Sz * .034) + 'px Inter, system-ui, sans-serif'; g.fillText(P.title || 'Untitled', pad, Sz + cap * .42, Sz - pad * 2);
  g.fillStyle = mute; g.font = Math.round(Sz * .019) + 'px Inter, system-ui, sans-serif'; g.fillText('◎ ' + prtIdText(P) + '  ·  ' + R.key + '  ·  ' + (P.bpm ? P.bpm + ' BPM' : 'free time') + '  ·  ' + prtFmt(P.dur) + '  ·  ' + prtDate(P.day) + (P.by ? '  ·  ' + P.by : ''), pad, Sz + cap * .68, Sz - pad * 2);
  g.fillText('Soundprint · the-daily.studio', pad, Sz + cap * .88, Sz - pad * 2);
  if (size) return cv;
  cv.toBlob(b => { if (b) { download(prtName(P, '.png'), b); toast('⤓ Artwork saved (' + Sz + ' × ' + (Sz + cap) + ').', 'ok'); } }, 'image/png'); return cv;
}
async function prtSavePiece() {
  try { const p = await prtPiece(); download(prtName(PRT.cur, '.wav'), new Blob([encodeWav([p.l, p.r], p.sr, 16)], { type: 'audio/wav' })); toast('⤓ The piece saved as WAV.', 'ok'); }
  catch (e) { prtSay('The piece couldn’t be made: ' + (e.message || e) + '.'); }
}
async function prtVideo() {
  if (PRT.vid) { prtStop(); return; }
  const cv = PRT.cv; if (!cv || !cv.captureStream || !window.MediaRecorder) return prtSay('This browser can’t record a video of the page. Save the artwork and the piece instead.');
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4'].find(t => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || '';
  try {
    prtStop(); await prtPiece(); await startAudio(); const c = E.ctx, dest = c.createMediaStreamDestination(), vs = cv.captureStream(30), ms = new MediaStream([...vs.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const mr = new MediaRecorder(ms, mime ? { mimeType: mime, videoBitsPerSecond: 6e6 } : undefined), chunks = [], P = PRT.cur, btn = document.getElementById('prtVid');
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => { const v = PRT.vid; PRT.vid = null; vs.getTracks().forEach(t => t.stop()); if (btn) btn.textContent = '⏺ Video'; PRT.dirty = true; if (!v || !chunks.length) return; const type = mr.mimeType || mime || 'video/webm'; download(prtName(P, /mp4/.test(type) ? '.mp4' : '.webm'), new Blob(chunks, { type })); toast('⤓ Video saved.', 'ok'); };
    PRT.vid = { mr }; mr.start(500); if (btn) btn.textContent = '■ Stop recording'; await prtPlay('piece', dest); prtSay('Recording the video while the piece plays (' + prtFmt(PRT.piece.len) + '). Stop at any time to keep what is there.');
  } catch (e) { PRT.vid = null; prtSay('The video couldn’t be recorded: ' + (e.message || e) + '.'); }
}
async function prtCopyLink() {
  const P = PRT.cur; if (!P) return; const u = prtHere() + '#p=' + await prtCode(P);
  await copyText(u); prtSay('🔗 Link copied (' + (u.length / 1024).toFixed(1) + ' kB). It carries the print, not the sound.'); return u;
}
async function prtSong() {
  const P = PRT.cur, R = PRT.read; if (!P) return; const ch = R.chords.map(c => c.sym), bars = []; while (bars.length < 8) ch.forEach(c => { if (bars.length < 8) bars.push(c); });
  const s = blankSong({ title: P.title || 'From a sound', bpm: P.bpm || 84, key: P.key, minor: P.minor }); s.sections = [mkSection('Verse 1', bars)]; s.notes = 'Started from the soundprint ◎ ' + prtIdText(P) + '. ' + R.line;
  const d = document.getElementById('prtDlg'); if (d) d.close();
  await projCreate('blank', { song: s }); bus.emit('song', 'reload'); toast('✎ A new song in ' + R.key + ' with the print’s chords. Your other songs are kept.', 'ok');
}
