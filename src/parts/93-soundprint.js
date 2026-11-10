/* ============================================================
   Part 93 · SOUNDPRINT (2.61) — any sound becomes a print, worlds that move with it, a reading of its music and an ambient piece
   Record a sound (up to a minute), choose a file, a take, the song or its master. It is listened to here and becomes a PRINT:
   about 1 kB of shapes (its loudness, brightness and motion over 128 moments, its notes and its spectrum over 64, its onsets,
   key and pulse). Everything else is grown from the print alone, so whoever opens a print's link sees and hears what you do:
     ◎ Print         a whorl, one ridge per moment from the centre out. The colour wheel is the circle of fifths (C red, G orange…
                     notes that sound alike sit side by side), each note's sector lights up while it sounds, quiet moments break
                     the ridges, onsets leave the small gaps a fingerprint has, motion ripples them.
     〰 Ribbon       the envelope as glowing ribbons that flow past while it plays.
     ⛰ Terrain      the spectrum as a landscape you travel over: low notes in the valley, high ones at the edges, onsets as sparks.
     ∞ Harmonograph  two pendulums tuned to the intervals of the chord at the playhead (a fifth is 3:2, a major third 5:4).
   The reading: key, pulse, character, its strongest colours and a chord progression (the diatonic chords that fit its notes).
   The piece: pads on those chords (the filter follows the brightness), a drone, bells on its onsets in the key's pentatonic
   scale, wind for its noise, and, if you like, the recording itself an octave down. Made faster than it plays, here.
   Exports: artwork (PNG, 2048 px), the piece (WAV), a video of the world moving with the piece, and a link that carries the print
   only (#p=…): the sound never leaves this device. Prints you make are kept on this device (Your soundprints, newest 48).
   This part is a room (part 00): the hosted site loads it the first time it is opened.
   ============================================================ */
const PRT = { cur: null, read: null, src: null, world: 'print', raf: 0, play: null, piece: null, rec: null, vid: null, body: null, cv: null, cache: null, weave: true, mine: false, dirty: true, KEEP: 'fw.prints', MAX: 48 };
const PRT_N = 128, PRT_M = 64;                 /* moments for loudness, brightness and motion; for the notes and the spectrum */
const PRT_WORLDS = [['print', '◎', 'Print'], ['ribbon', '〰', 'Ribbon'], ['terrain', '⛰', 'Terrain'], ['harmono', '∞', 'Harmonograph']];
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
  const N = 4096, len = x.length; if (len < sr * .5) throw new Error('That is shorter than half a second: a print needs a little more sound');
  const hop = Math.max(1024, Math.ceil((len - N) / 2000)), F = Math.max(1, Math.floor((len - N) / hop) + 1), half = N / 2;
  const win = new Float32Array(N).map((_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / (N - 1)));
  const kLo = Math.max(1, Math.ceil(50 * N / sr)), kHi = Math.min(half - 1, Math.floor(16000 * N / sr)), L2 = Math.log2(16000 / 50);
  const bandOf = new Int8Array(half), lp = new Float32Array(half), flatK = new Uint8Array(half);
  for (let k = kLo; k <= kHi; k++) { const f = k * sr / N; lp[k] = Math.log2(f / 50) / L2; bandOf[k] = Math.min(7, Math.floor(lp[k] * 8)); flatK[k] = f >= 100 && f <= 8000 ? 1 : 0; }
  const rms = new Float32Array(F), cen = new Float32Array(F), flux = new Float32Array(F), flat = new Float32Array(F), chr = new Float32Array(F * 12), bnd = new Float32Array(F * 8);
  let prev = new Float32Array(half), cur = new Float32Array(half); const re = new Float32Array(N), im = new Float32Array(N);
  for (let f = 0; f < F; f++) {
    const o = f * hop; let e = 0;
    for (let i = 0; i < N; i++) { const v = x[o + i] || 0; e += v * v; re[i] = v * win[i]; im[i] = 0; }
    rms[f] = Math.sqrt(e / N); finFft(re, im);
    let sp = 0, sw = 0, fl = 0, lg = 0, sa = 0, nb = 0;
    for (let k = kLo; k <= kHi; k++) {
      const p = re[k] * re[k] + im[k] * im[k], m = Math.sqrt(p); cur[k] = Math.log(1 + 1000 * m);
      sp += p; sw += p * lp[k]; const d = cur[k] - prev[k]; if (d > 0) fl += d;
      bnd[f * 8 + bandOf[k]] += p;
      if (flatK[k]) { lg += Math.log(p + 1e-12); sa += p; nb++; }
    }
    /* the notes: each spectral peak between 60 Hz and 5 kHz, its frequency found between the bins, given to its pitch class */
    for (let k = Math.max(kLo + 1, Math.ceil(60 * N / sr)); k < Math.min(kHi, Math.floor(5000 * N / sr)); k++) {
      const a = cur[k - 1], b = cur[k], c = cur[k + 1]; if (!(b > a && b >= c) || b < 1.2) continue;
      const d = a - 2 * b + c, sh = d ? clamp((a - c) / (2 * d), -.5, .5) : 0, fq = (k + sh) * sr / N, mid = 12 * Math.log2(fq / 440) + 69, off = Math.abs(mid - Math.round(mid));
      if (off < .35) chr[f * 12 + ((Math.round(mid) % 12) + 12) % 12] += (b - Math.max(a, c) * .5) * (1 - off * 1.5);
    }
    cen[f] = sp > 0 ? sw / sp : 0; flux[f] = fl; flat[f] = nb && sa > 0 ? Math.min(1, Math.exp(lg / nb) / (sa / nb)) : 1;
    const t = prev; prev = cur; cur = t;
  }
  const dB = rms.map(v => 20 * Math.log10(v + 1e-9)), top = prtPct(dB, .98), floor = top - 48, lin = v => clamp((v - floor) / 48, 0, 1), act = dB.map(v => v > top - 40 ? 1 : 0);
  const steps = (n, fn) => { const out = new Float32Array(n); for (let s = 0; s < n; s++) { const a = Math.floor(s * F / n), b = Math.min(F, Math.max(a + 1, Math.floor((s + 1) * F / n))); out[s] = fn(a, b); } return out; };
  const e = steps(PRT_N, (a, b) => { let s = 0; for (let i = a; i < b; i++) s += rms[i] * rms[i]; return lin(10 * Math.log10(s / (b - a) + 1e-18)); });
  const bright = steps(PRT_N, (a, b) => { let s = 0, w = 0; for (let i = a; i < b; i++) { const q = rms[i] * rms[i]; s += cen[i] * q; w += q; } return w > 0 ? clamp((s / w - .25) / .5, 0, 1) : 0; });
  const fx = prtPct(flux, .95) || 1, motion = steps(PRT_N, (a, b) => { let s = 0; for (let i = a; i < b; i++) s += flux[i]; return clamp(s / (b - a) / fx, 0, 1); });
  const chroma = [], bands = []; let btop = -200;
  const braw = [];
  for (let s = 0; s < PRT_M; s++) {
    const a = Math.floor(s * F / PRT_M), b = Math.min(F, Math.max(a + 1, Math.floor((s + 1) * F / PRT_M))), c = new Float32Array(12), bd = new Float32Array(8);
    for (let i = a; i < b; i++) { for (let k = 0; k < 12; k++) c[k] += chr[i * 12 + k]; for (let k = 0; k < 8; k++) bd[k] += bnd[i * 8 + k]; }
    const mx = Math.max(...c); chroma.push(c.map(v => mx > 0 ? v / mx : 0));
    const db = bd.map(v => 10 * Math.log10(v / (b - a) + 1e-18)); braw.push(db); btop = Math.max(btop, ...db);
  }
  braw.forEach(db => bands.push(db.map(v => clamp((v - (btop - 60)) / 60, 0, 1))));
  /* onsets: flux above its neighbourhood, at least 90 ms apart, and not in silence */
  const fr = sr / hop, gap = Math.max(1, Math.round(.09 * fr)), W8 = Math.max(3, Math.round(.2 * fr)), on = [];
  for (let f = 1; f < F - 1; f++) {
    if (!(flux[f] > flux[f - 1] && flux[f] >= flux[f + 1]) || lin(dB[f]) < .2) continue;
    let s = 0, n = 0; for (let j = Math.max(0, f - W8); j <= Math.min(F - 1, f + W8); j++) { s += flux[j]; n++; }
    const th = s / n * 1.35 + fx * .08; if (flux[f] <= th) continue;
    const st = clamp((flux[f] - th) / fx, 0, 1); if (on.length && f - on[on.length - 1].f < gap) { if (st > on[on.length - 1].s) on[on.length - 1] = { f, s: st }; continue; } on.push({ f, s: st });
  }
  const onsets = on.sort((a, b) => b.s - a.s).slice(0, 120).sort((a, b) => a.f - b.f).map(o => ({ t: (o.f * hop + N / 2) / len, s: o.s }));
  /* the pulse: the energy envelope (10 ms) of up to the first 90 s, autocorrelated over 60–180 BPM */
  let bpm = 0, pconf = 0;
  if (len / sr >= 4) {
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
  return { dur: len / sr, key: ks.root, minor: ks.minor, kconf: clamp(ks.r, 0, 1), bpm: Math.round(bpm), pconf, tonal: clamp(1 - (fw ? fs / fw : 1) * 1.6, 0, 1), dyn: clamp(dyn, 0, 60), lvl: clamp(top, -99, 0), e, b: bright, f: motion, c: chroma, bd: bands, on: onsets };
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

/* ---------- the worlds ---------- */
/** draw world `w` of print P on g (W×H) at time t (0..1). o: { dark, clock (s), still, read } */
function prtDraw(g, W, H, P, w, t, o) {
  g.save(); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  if (w === 'ribbon') prtRibbon(g, W, H, P, t, o); else if (w === 'terrain') prtTerrain(g, W, H, P, t, o); else if (w === 'harmono') prtHarmono(g, W, H, P, t, o); else prtWhorl(g, W, H, P, t, o);
  g.restore();
}
function prtBg(g, W, H, dark) {
  if (!dark) { g.fillStyle = '#fbfaf7'; g.fillRect(0, 0, W, H); return; }
  const r = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * .7); r.addColorStop(0, '#0d0f1c'); r.addColorStop(1, '#020205'); g.fillStyle = r; g.fillRect(0, 0, W, H);
}
/** the whorl, drawn to time t (1: whole). Points along an Archimedean spiral, warped by a smooth field so the ridges flow */
function prtWhorl(g, W, H, P, t, o) {
  const dark = o.dark, cx = W / 2, cy = H / 2, R = Math.min(W, H) * .45, turns = 44, sp = R / turns, rnd = prtRand(parseInt(P.id, 16)), ph = rnd() * 6.283;
  const wv = [0, 1, 2, 3].map(i => ({ k: 1 + i + Math.floor(rnd() * 2), a: (.012 + rnd() * .022) * R, p: rnd() * 6.283, c: (rnd() - .5) * 5 })), ell = .9 + rnd() * .14, rot = rnd() * 6.283, cr = Math.cos(rot), sr = Math.sin(rot);
  if (!o.noBg) prtBg(g, W, H, dark);
  const steps = Math.round(clamp(W * 22, 3000, 26000)), gaps = new Uint8Array(steps + 1);
  P.on.forEach(x => { if (x.s < .35) return; const c = Math.round(x.t * steps), wd = Math.round(steps / turns * (.035 + .05 * x.s)); for (let i = Math.max(0, c - wd); i <= Math.min(steps, c + wd); i++) gaps[i] = 1; });
  g.lineCap = 'butt'; g.lineJoin = 'round'; g.globalCompositeOperation = dark ? 'lighter' : 'source-over';
  const pt = u => { const th = u * turns * 6.283 + ph; let r = R * (.02 + .98 * u); const k = r / R; wv.forEach(v => { r += v.a * k * Math.sin(v.k * th + v.p + v.c * u * 6.283); }); r += sp * .3 * prtAt(P.f, u) * Math.sin(th * (9 + 14 * prtAt(P.b, u))); const x = r * Math.cos(th), y = r * Math.sin(th) * ell; return [cx + x * cr - y * sr, cy + x * sr + y * cr, th]; };
  /* one path per run of the same colour and width (rounded), so the ridges stay smooth curves */
  let key = '', prev = pt(0), open = false;
  const flush = () => { if (open) g.stroke(); open = false; };
  if (!o.onlyHead) for (let i = 1; i <= steps; i++) {
    const u = i / steps; if (u > t + 1e-9) break;
    const p = pt(u); if (gaps[i] || prtAt(P.e, u) < .1) { flush(); key = ''; prev = p; continue; }
    const a = (((p[2] + rot) % 6.283) + 6.283) % 6.283 / 6.283 * 12, sc = Math.floor(a) % 12, fr = a - Math.floor(a), row = prtRow(P.c, u), v = row[PRT_FIFTHS[sc]] * (1 - fr) + row[PRT_FIFTHS[(sc + 1) % 12]] * fr, e = prtAt(P.e, u);
    const al = Math.round((.3 + .7 * Math.pow(v, 1.2)) * (.5 + .5 * e) * 10) / 10, hue = Math.round(a * 3) * 10, lw = Math.round(sp * (.18 + .4 * e) * 2) / 2, k = hue + '|' + al + '|' + lw;
    if (k !== key) { flush(); key = k; g.strokeStyle = 'hsla(' + hue + ',' + (dark ? 92 : 86) + '%,' + (dark ? 62 : 46) + '%,' + al + ')'; g.lineWidth = Math.max(.5, lw); g.beginPath(); g.moveTo(prev[0], prev[1]); open = true; }
    g.lineTo(p[0], p[1]); prev = p;
  }
  flush();
  if (t < 1 && !o.still) { const p = pt(t), r = sp * (2.5 + 5 * prtAt(P.e, t)), gl = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], r); gl.addColorStop(0, dark ? 'rgba(255,255,255,.95)' : 'rgba(40,30,60,.8)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.globalCompositeOperation = dark ? 'lighter' : 'source-over'; g.fillStyle = gl; g.beginPath(); g.arc(p[0], p[1], r, 0, 6.283); g.fill(); }
  return pt;
}
function prtRibbon(g, W, H, P, t, o) {
  prtBg(g, W, H, true); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  const L = 34, M = Math.round(clamp(W / 4, 120, 260)), span = o.still ? 1 : .2, ck = o.clock || 0, s = Math.min(W, H) / 1000;
  const top4 = u => Array.from(prtRow(P.c, u), (v, k) => [k, v]).sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => prtHue(x[0]));
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < L; i += pass ? 3 : 1) {
    const k = i / (L - 1), phase = k * 2.2 + ck * .35, gr = g.createLinearGradient(0, 0, W, 0);
    for (let j = 0; j <= 8; j++) { const x = j / 8, u = o.still ? x : clamp(t + (x - .5) * span, 0, 1), hh = top4(u)[i % 4]; gr.addColorStop(x, 'hsla(' + hh + ',100%,' + (62 + 12 * prtAt(P.b, u)).toFixed(0) + '%,' + (pass ? .09 : .5) + ')'); }
    g.strokeStyle = gr; g.lineWidth = (pass ? 10 : 1.7) * s; g.beginPath();
    for (let j = 0; j <= M; j++) {
      const x = j / M, u = o.still ? x : clamp(t + (x - .5) * span, 0, 1), e = prtAt(P.e, u), b = prtAt(P.b, u), f = prtAt(P.f, u);
      const amp = H * (.05 + .27 * e) * (.55 + .45 * Math.sin(k * 3.1 + ck * .2));
      const y = H / 2 + amp * Math.sin(x * (5 + 6 * b) + phase) * Math.cos(x * 2.1 - k * 1.4 + ck * .15) + H * .022 * f * Math.sin(x * 40 + k * 9 + ck * 2);
      if (j) g.lineTo(x * W, y); else g.moveTo(0, y);
    }
    g.stroke();
  }
}
function prtTerrain(g, W, H, P, t, o) {
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#02030b'); sky.addColorStop(.45, '#0b1233'); sky.addColorStop(1, '#05040c'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  const rnd = prtRand(parseInt(P.id, 16) ^ 0x7e11), ck = o.clock || 0, hor = H * .34, s = Math.min(W, H) / 1000;
  for (let i = 0; i < 140; i++) { const x = rnd() * W, y = rnd() * hor * 1.05, tw = .4 + .6 * Math.abs(Math.sin(ck * (.5 + rnd()) + i)); g.fillStyle = 'hsla(' + Math.round(rnd() * 360) + ',80%,85%,' + (.25 + .6 * tw * rnd()).toFixed(2) + ')'; g.fillRect(x, y, 1.6 * s + rnd() * s, 1.6 * s + rnd() * s); }
  const rows = 46, cols = Math.round(clamp(W / 7, 70, 180)), spikes = Array.from({ length: 9 }, () => rnd() * 2 - 1), ons = P.on;
  for (let j = 0; j < rows; j++) {
    const Z = 1 + 7 * (1 - j / (rows - 1)), u = o.still ? 1 - (Z - 1) / 7 : t + (Z - 1) / 7 * .22, e = u > 1 ? 0 : prtAt(P.e, u), bd = prtRow(P.bd, Math.min(1, u)), fz = prtAt(P.f, Math.min(1, u));
    let hit = 0; ons.forEach(x => { const d = Math.abs(x.t - u); if (d < .006) hit = Math.max(hit, x.s * (1 - d / .006)); });
    const pts = [];
    for (let i = 0; i <= cols; i++) {
      const X = i / cols * 2 - 1, a = Math.abs(X) * 7, k = Math.floor(a), f = a - k, band = bd[Math.min(7, k)] * (1 - f) + bd[Math.min(7, k + 1)] * f;
      let y = band * (.35 + .65 * e) * .55 + .05 * fz * Math.sin(X * 23 + u * 90);
      spikes.forEach((sx, q) => { if (Math.abs(X - sx) < .02 && hit > 0) y += hit * (q % 3 ? .5 : 1.1); });
      pts.push([W / 2 + X * W * .95 / Z * 1.9, hor + H * .62 / Z * 1.1 - y * H * .55 / Z]);
    }
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#04050d'; g.beginPath(); g.moveTo(pts[0][0], H); pts.forEach(p => g.lineTo(p[0], p[1])); g.lineTo(pts[cols][0], H); g.closePath(); g.fill();
    const gr = g.createLinearGradient(pts[0][0], 0, pts[cols][0], 0), near = 1 - (Z - 1) / 7;
    for (let q = 0; q <= 6; q++) gr.addColorStop(q / 6, 'hsla(' + Math.round((280 + Math.abs(q / 3 - 1) * 250) % 360) + ',95%,' + (52 + 14 * near).toFixed(0) + '%,' + (.25 + .7 * near).toFixed(2) + ')');
    g.globalCompositeOperation = 'lighter'; g.strokeStyle = gr; g.lineWidth = (.6 + 1.6 * near) * s; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
  }
}
/** a harmonograph: two pendulums swinging across, two along, tuned to the chord at the playhead (the tonic a fifth, 3:2;
    a major chord its major third, 5:4; a minor one its minor third, 6:5), a hair out of tune so the figure turns */
function prtHarmono(g, W, H, P, t, o) {
  prtBg(g, W, H, true); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  const R = o.read || prtRead(P), ch = R.chords[Math.min(R.chords.length - 1, Math.floor(clamp(t, 0, .999) * R.chords.length))], [fa, fb] = ch.root === P.key ? [2, 3] : ch.q === 'm' ? [5, 6] : [4, 5];
  const f = prtAt(P.f, t), e = prtAt(P.e, t), ck = o.still ? 0 : (o.clock || 0) * .25, rnd = prtRand(parseInt(P.id, 16) ^ ch.root), ph = [0, 1, 2, 3].map(() => rnd() * 6.283);
  const eps = .003 + .008 * f, d = .0028 + .005 * clamp(P.dyn / 30, 0, 1), A = Math.min(W, H) * .22 * (.75 + .25 * e), cx = W / 2, cy = H / 2, s = Math.min(W, H) / 1000, N = 9000, T = 2 * Math.PI * 60;
  const hues = [ch.root, (ch.root + ch.iv[1]) % 12, (ch.root + ch.iv[2]) % 12].map(prtHue), hueAt = q => { const x = q * 2, i = Math.min(1, Math.floor(x)), fr = x - i, a = hues[i], b = hues[i + 1], dd = ((b - a + 540) % 360) - 180; return Math.round(a + dd * fr + 360) % 360; };
  for (let pass = 0; pass < 2; pass++) {
    g.lineWidth = (pass ? 5 : 1.15) * s; let px = 0, py = 0;
    for (let i = 0; i <= N; i++) {
      const tt = i / N * T, k = Math.exp(-d * tt), x = cx + A * k * (Math.sin(fa / fa * tt + ph[0]) + Math.sin(tt * (1 + eps) + ph[1] + ck)), y = cy + A * k * (Math.sin(fb / fa * tt + ph[2]) + Math.sin(tt * (1 + eps) + ph[1] + ck + Math.PI / 2));
      if (i % 60 === 0) { if (i) g.stroke(); const q = i / N; g.strokeStyle = 'hsla(' + hueAt(q) + ',95%,' + (58 + 12 * q) + '%,' + ((pass ? .035 : .45) * (k * .85 + .15)).toFixed(3) + ')'; g.beginPath(); g.moveTo(i ? px : x, i ? py : y); }
      g.lineTo(x, y); px = x; py = y;
    }
    g.stroke();
  }
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
    grid.append(card); setTimeout(() => { try { prtWhorl(cv.getContext('2d'), 120, 120, P, 1, { dark: prtDark(), still: true }); } catch (e) { } }, 30);
  });
  return h('div', {}, h('h4', { class: 'prt-h' }, 'Your soundprints'), grid);
}
const prtDark = () => document.documentElement.dataset.theme === 'dark';

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
async function prtFromFile(f) {
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
  const B = PRT.body; if (!B) return; prtStop(); B.innerHTML = ''; PRT.cur = P; PRT.read = prtRead(P); PRT.piece = null; PRT.mine = !!o.mine; PRT.cache = null; PRT.dirty = true;
  const R = PRT.read, cv = h('canvas', { class: 'prt-cv', id: 'prtCv', role: 'img', 'aria-label': 'Soundprint of “' + (P.title || 'Untitled') + '”. ' + R.line });
  const tabs = h('div', { class: 'seg prt-worlds', role: 'tablist', 'aria-label': 'Worlds' }, PRT_WORLDS.map(([k, ico, name]) => h('button', { type: 'button', role: 'tab', class: PRT.world === k ? 'on' : '', 'aria-selected': PRT.world === k ? 'true' : 'false', 'data-w': k, onclick: () => prtWorld(k) }, ico + ' ' + name)));
  const chip = (pc, t) => { const c = h('span', { class: 'prt-chip' }, t); c.style.setProperty('--c', 'hsl(' + prtHue(pc) + ',80%,52%)'); return c; };
  const row = (k, ...v) => h('div', { class: 'prt-row' }, h('dt', {}, k), h('dd', {}, ...v));
  const title = h('input', { class: 'in prt-title', id: 'prtTitle', maxlength: 60, value: P.title || '', placeholder: 'Untitled', 'aria-label': 'Title', onchange: e => prtRetitle(e.target.value) });
  const weave = PRT.src ? h('label', { class: 'chk tiny', title: 'The recording itself, an octave down, under the piece (only here: a link carries the print alone)' }, h('input', { type: 'checkbox', id: 'prtWeave', checked: PRT.weave, onchange: e => { PRT.weave = e.target.checked; PRT.piece = null; } }), ' Weave in the recording') : null;
  B.append(h('div', { class: 'prt-grid' },
    h('div', { class: 'prt-stage' }, tabs, h('div', { class: 'prt-cvbox' }, cv),
      h('div', { class: 'prt-play' }, h('button', { class: 'btn primary', id: 'prtPlay', type: 'button', onclick: () => prtPlay('piece') }, '▶ Play the piece'), PRT.src ? h('button', { class: 'btn', id: 'prtHear', type: 'button', onclick: () => prtPlay('sound') }, '▶ The sound') : null, weave)),
    h('div', { class: 'prt-side' },
      title, h('div', { class: 'prt-id mono tiny' }, '◎ ' + prtIdText(P) + ' · ' + prtFmt(P.dur) + ' · ' + prtDate(P.day) + (P.by ? ' · ' + P.by : '')),
      o.link ? h('p', { class: 'tiny prt-from' }, 'Someone shared this print with you. The sound stayed with them: what you see and hear is grown from the print, here.') : null,
      h('p', { class: 'prt-line', id: 'prtLine' }, R.line),
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
function prtLoop(ts) {
  PRT.raf = 0; const cv = PRT.cv, P = PRT.cur; if (!cv || !P || !document.getElementById('prtCv')) return;
  const now = prtNow(), playing = now != null, idle = !playing && PRT.world !== 'print' && !CFG.reduce, clock = ts / 1000;
  if (playing || idle || PRT.dirty) {
    const g = cv.getContext('2d'), W = cv.width, dark = PRT.world !== 'print' || prtDark() || !!PRT.vid;
    if (PRT.world === 'print' && playing) {
      if (!PRT.cache || PRT.cache.width !== W || PRT.cache.dark !== dark) { const c = document.createElement('canvas'); c.width = c.height = W; prtWhorl(c.getContext('2d'), W, W, P, 1, { dark, still: true }); c.dark = dark; PRT.cache = c; }
      prtBg(g, W, W, dark); g.save(); g.globalAlpha = .16; g.drawImage(PRT.cache, 0, 0); g.restore();
      g.save(); g.beginPath(); g.arc(W / 2, W / 2, W * .46 * Math.min(1, now * 1.02 + .01), 0, 6.283); g.clip(); g.drawImage(PRT.cache, 0, 0); g.restore();
      g.save(); prtWhorl(g, W, W, P, now, { dark, noBg: true, onlyHead: true }); g.restore();
    } else prtDraw(g, W, W, P, PRT.world, playing ? now : (idle ? (clock / 40) % 1 : 1), { dark, clock, still: !playing && !idle, read: PRT.read });
    PRT.dirty = false;
  }
  PRT.raf = requestAnimationFrame(prtLoop);
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
  const g = cv.getContext('2d'), dark = PRT.world !== 'print' || prtDark(); prtDraw(g, Sz, Sz, P, PRT.world, 1, { dark, still: true, clock: 0, read: R });
  g.fillStyle = dark ? '#020205' : '#fbfaf7'; g.fillRect(0, Sz, Sz, cap); const ink = dark ? '#f2f0ea' : '#1c1a22', mute = dark ? 'rgba(242,240,234,.62)' : 'rgba(28,26,34,.6)', pad = Sz * .045;
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
