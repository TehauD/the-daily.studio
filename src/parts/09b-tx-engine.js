/* ============================================================
   Part 09b · Polyphonic transcription engine (pure DSP, no DOM)
   Audio → onsets → onset-synchronous spectral-difference multi-pitch (iterative estimate-and-cancel)
   → quantization → string/fret Viterbi with chord-voicing + camera priors → techniques.
   ============================================================ */
const TXP = {}, TXH = {};
function txPlan(n) {
  let p = TXP[n]; if (p) return p; const cos = new Float64Array(n >> 1), sin = new Float64Array(n >> 1), rev = new Uint32Array(n), bits = Math.round(Math.log2(n));
  for (let k = 0; k < n >> 1; k++) { const a = -2 * Math.PI * k / n; cos[k] = Math.cos(a); sin[k] = Math.sin(a); }
  for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b); rev[i] = r; }
  return TXP[n] = { cos, sin, rev, re: new Float64Array(n), im: new Float64Array(n) };
}
function txFFT(p) {
  const { re, im, cos, sin, rev } = p, n = re.length;
  for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let size = 2; size <= n; size <<= 1) { const half = size >> 1, step = n / size; for (let i = 0; i < n; i += size) for (let j = 0, k = 0; j < half; j++, k += step) { const a = i + j, b = a + half, tr = re[b] * cos[k] - im[b] * sin[k], ti = re[b] * sin[k] + im[b] * cos[k]; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; } }
}
function txHann(n) { let w = TXH[n]; if (w) return w; w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = .5 - .5 * Math.cos(2 * Math.PI * (i + .5) / n); return TXH[n] = w; }
/** magnitude spectrum (amplitude-calibrated) of x[start..start+len) Hann-windowed, zero-padded to N */
function txSpec(x, start, len, N, out) {
  const p = txPlan(N), w = txHann(len), re = p.re, im = p.im; re.fill(0); im.fill(0); let ws = 0, n = x.length;
  for (let i = 0; i < len; i++) { const idx = start + i; if (idx >= 0 && idx < n) re[i] = x[idx] * w[i]; ws += w[i]; }
  txFFT(p); const o = out || new Float32Array((N >> 1) + 1), sc = 2 / ws; for (let k = 0; k <= N >> 1; k++) o[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]) * sc; return o;
}
function txPrep(mono, sr) {
  const D = Math.max(1, Math.round(sr / 22050)), fs = sr / D; if (D === 1) return { x: mono, fs };
  const taps = 8 * D + 1, h = new Float32Array(taps), fc = .46 / D, mid = (taps - 1) / 2; let sum = 0;
  for (let i = 0; i < taps; i++) { const n = i - mid; h[i] = (n === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * n) / (Math.PI * n)) * (.54 + .46 * Math.cos(2 * Math.PI * n / (taps - 1))); sum += h[i]; }
  for (let i = 0; i < taps; i++) h[i] /= sum; const n = Math.floor(mono.length / D), out = new Float32Array(n);
  for (let j = 0; j < n; j++) { let a = 0; const c = j * D; for (let i = 0; i < taps; i++) { const idx = c + i - mid; if (idx >= 0 && idx < mono.length) a += mono[idx] * h[i]; } out[j] = a; }
  return { x: out, fs };
}

/* ---------- onsets ---------- */
function txOnsets(x, fs, sens, soft) {
  const win = 1024, hop = 128, N = 1024, frames = Math.max(0, Math.floor((x.length - win) / hop) + 1), kLo = Math.max(2, Math.floor(70 * N / fs)), kHi = Math.min((N >> 1) - 3, Math.floor(5000 * N / fs));
  let prev = new Float32Array((N >> 1) + 1), cur = new Float32Array((N >> 1) + 1); const flux = new Float32Array(frames), spec = new Float32Array((N >> 1) + 1);
  for (let f = 0; f < frames; f++) {
    txSpec(x, f * hop, win, N, spec); for (let k = kLo - 1; k <= kHi + 1; k++) cur[k] = Math.log(1 + spec[k] * 1e4);
    if (f > 0) { let s = 0; for (let k = kLo; k <= kHi; k++) { const m = Math.max(prev[k - 1], prev[k], prev[k + 1]), d = cur[k] - m; if (d > 0) s += d; } flux[f] = s; }
    const t = prev; prev = cur; cur = t;
  }
  const cs = new Float64Array(frames + 1), cs2 = new Float64Array(frames + 1); for (let i = 0; i < frames; i++) { cs[i + 1] = cs[i] + flux[i]; cs2[i + 1] = cs2[i] + flux[i] * flux[i]; }
  const W = Math.round(.4 * fs / hop), dS = 3.2 - 2.2 * sens, dW = dS * .62, pk = [];
  let gmax = 0; for (let i = 0; i < frames; i++) if (flux[i] > gmax) gmax = flux[i];
  const floor_ = gmax * .035;
  for (let f = 3; f < frames - 3; f++) {
    const a = Math.max(0, f - W), b = Math.min(frames, f + W + 1), n = b - a, mu = (cs[b] - cs[a]) / n, sd_ = Math.sqrt(Math.max(0, (cs2[b] - cs2[a]) / n - mu * mu)), v = flux[f];
    const thS = Math.max(mu + dS * sd_, floor_ * 2), thW = Math.max(mu + dW * sd_, floor_);
    if (v < thW) continue; let ismax = true; for (let j = -4; j <= 4; j++) { const q = flux[f + j]; if (f + j >= 0 && f + j < frames && q > v) { ismax = false; break; } else if (q === v && j < 0) { ismax = false; break; } } if (!ismax) continue;
    pk.push({ f, v, strength: v / thS, weak: v < thS });
  }
  const out = []; for (const p of pk) { const t = (p.f * hop + win / 2) / fs; if (out.length && t - out[out.length - 1].tc < .035) { if (p.v > out[out.length - 1].v) out[out.length - 1] = { tc: t, v: p.v, strength: p.strength, weak: p.weak }; } else out.push({ tc: t, v: p.v, strength: p.strength, weak: p.weak }); }
  return out.filter(o => soft || !o.weak).map(o => ({ t: txRefine(x, fs, o.tc), tc: o.tc, strength: o.strength, weak: o.weak }));
}
function txRefine(x, fs, t) {
  const B = 32, a = Math.max(2, Math.round((t - .06) * fs / B)), b = Math.min(Math.floor(x.length / B) - 2, Math.round((t + .02) * fs / B)); if (b <= a + 4) return t;
  const E = []; for (let i = a - 3; i <= b; i++) { let s = 0; for (let j = 0; j < B; j++) { const k = i * B + j, d = x[k] - x[k - 1]; s += d * d; } E.push(Math.log(s + 1e-12)); }
  let best = -1e9, bi = -1; for (let i = 3; i < E.length; i++) { const d = E[i] - E[i - 3]; if (d > best) { best = d; bi = i; } }
  return best > 1.2 ? ((a - 3 + bi) * B - B) / fs : t;
}

/* ---------- multi-pitch on the post-minus-pre spectral difference ---------- */
function txPitchTable(tuning, capo, maxFret, a4, tuneCents) {
  let lo = 1e9, hi = -1e9; tuning.forEach(o => { lo = Math.min(lo, o + capo); hi = Math.max(hi, o + capo + maxFret); });
  const t = []; for (let m = lo; m <= hi; m++) t.push({ midi: m, f: a4 * Math.pow(2, (m - 69) / 12 + (tuneCents || 0) / 1200) }); return t;
}
const TXN = 8192;
function txSmooth(a, r) { const n = a.length, cs = new Float64Array(n + 1); for (let i = 0; i < n; i++) cs[i + 1] = cs[i] + a[i]; const o = new Float32Array(n); for (let i = 0; i < n; i++) { const lo = Math.max(0, i - r), hi = Math.min(n, i + r + 1); o[i] = (cs[hi] - cs[lo]) / (hi - lo); } return o; }
function txSalience(D, nf, tbl, fs, B) {
  const bin = fs / TXN, K = D.length, out = new Array(tbl.length);
  for (let ci = 0; ci < tbl.length; ci++) {
    const f1 = tbl[ci].f; let raw = 0, present = 0, hEff = 0, hs = [];
    for (let h = 1; h <= 8; h++) {
      const fh = h * f1 * Math.sqrt(1 + B * h * h); if (fh > 5200 || fh > fs * .45) break; hEff++;
      const kc = fh / bin, kw = Math.max(2, Math.round(fh * .0145 / bin)); let pk = 0, pi = -1; for (let k = Math.max(1, Math.round(kc) - kw); k <= Math.min(K - 2, Math.round(kc) + kw); k++) if (D[k] > pk) { pk = D[k]; pi = k; }
      const pres = pi >= 0 && pk > 3.2 * nf[pi] + 1.5e-5; if (pres) { present++; raw += Math.pow(pk, .6) / Math.pow(h, .6); } hs.push({ pi, pk, pres, kw });
    }
    const need = 2; const frac = hEff ? present / hEff : 0;
    out[ci] = { sal: present >= need ? raw * Math.pow(frac, 1.15) : 0, present, hEff, hs };
  }
  return out;
}
function txCancel(D, c, partial) {
  const hs = c.hs;
  hs.forEach((h, i) => {
    if (h.pi < 0) return; let keep = .02;
    if (partial && i > 0 && h.pres) { const nb = []; if (hs[i - 1] && hs[i - 1].pres) nb.push(hs[i - 1].pk); if (hs[i + 1] && hs[i + 1].pres) nb.push(hs[i + 1].pk); const ref = nb.length ? Math.max(...nb) : h.pk, est = Math.min(h.pk, partial * ref); keep = Math.max(.02, 1 - est / h.pk); }
    const lo = Math.max(0, h.pi - h.kw - 2), hi = Math.min(D.length - 1, h.pi + h.kw + 2); for (let k = lo; k <= hi; k++) D[k] *= keep;
  });
}
function txParabolic(S, k) { if (k < 1 || k >= S.length - 1) return k; const a = Math.log(S[k - 1] + 1e-12), b = Math.log(S[k] + 1e-12), c = Math.log(S[k + 1] + 1e-12), den = a - 2 * b + c; return den ? k + .5 * (a - c) / den : k; }


/* ---------- analysis-by-synthesis: fit a hypothesised note set to the difference spectrum (non-negative least squares) ---------- */
const TXSHAPES = [[0, 0], [.8, 0], [0, .13], [.8, .13], [0, .2], [.8, .2]], TXNS = TXSHAPES.length;
function txHannK(d, len) { const x = d * len / TXN, ax = Math.abs(x); if (ax >= 3) return 0; if (ax < 1e-6) return 1; if (Math.abs(ax - 1) < 1e-4) return .5; return Math.abs(Math.sin(Math.PI * x) / (Math.PI * x) / (1 - x * x)); }
const TXCOL = new Map();
function txCol(f, shape, len, fs, B, K) {
  const key = Math.round(f * 20) + '|' + shape + '|' + len + '|' + fs; let c = TXCOL.get(key); if (c) return c; if (TXCOL.size > 3000) TXCOL.clear();
  const bin = fs / TXN, span = Math.ceil(3 * TXN / len), sh = TXSHAPES[shape], al = sh[0], be = sh[1], mp = new Map();
  for (let h = 1; h <= 10; h++) { const fh = h * f * Math.sqrt(1 + B * h * h); if (fh > 5200 || fh > fs * .45) break; const kc = fh / bin, w = Math.pow(h, -al) * (be ? Math.max(.12, Math.abs(Math.sin(Math.PI * h * be))) / Math.max(.3, Math.sin(Math.PI * be)) : 1); for (let k = Math.max(1, Math.floor(kc) - span); k <= Math.min(K - 2, Math.ceil(kc) + span); k++) { const v = w * txHannK(k - kc, len); if (v > 1e-3) mp.set(k, (mp.get(k) || 0) + v); } }
  const idx = [], val = []; mp.forEach((v, k) => { idx.push(k); val.push(v); }); c = { idx: Int32Array.from(idx), val: Float32Array.from(val) }; TXCOL.set(key, c); return c;
}
/** returns {amp:[per note], expl: explained energy fraction} */
function txFitSet(D, fs, len, B, freqs, yy) {
  const K = D.length, cols = []; freqs.forEach(f => TXSHAPES.forEach((_, si) => cols.push(txCol(f, si, len, fs, B, K)))); const n = cols.length, G = new Float64Array(n * n), b = new Float64Array(n), dense = new Float32Array(K);
  for (let j = 0; j < n; j++) { const cj = cols[j]; let a = 0; for (let t = 0; t < cj.idx.length; t++) { dense[cj.idx[t]] = cj.val[t]; a += cj.val[t] * D[cj.idx[t]]; } b[j] = a; for (let i = j; i < n; i++) { const ci = cols[i]; let g = 0; for (let t = 0; t < ci.idx.length; t++) g += ci.val[t] * dense[ci.idx[t]]; G[i * n + j] = G[j * n + i] = g; } for (let t = 0; t < cj.idx.length; t++) dense[cj.idx[t]] = 0; }
  const x = new Float64Array(n).fill(.003), gx = new Float64Array(n), lam = 1e-4;
  for (let it = 0; it < 140; it++) { for (let i = 0; i < n; i++) { let a = 0; const r = i * n; for (let j = 0; j < n; j++) a += G[r + j] * x[j]; gx[i] = a; } for (let i = 0; i < n; i++) x[i] *= b[i] / (gx[i] + lam + 1e-12); }
  let xb = 0, xgx = 0; for (let i = 0; i < n; i++) { xb += x[i] * b[i]; xgx += x[i] * gx[i]; }
  const amp = freqs.map((_, i) => { let a = 0; for (let q = 0; q < TXNS; q++) a += x[i * TXNS + q]; return a; }); return { amp, expl: yy > 0 ? clamp((2 * xb - xgx) / yy, 0, 1) : 0 };
}
const TXCH = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus2: [0, 2, 7], sus4: [0, 5, 7], 5: [0, 7] };
function txGuess(notes) {
  const w = new Array(12).fill(0); notes.forEach(n => w[n.midi % 12] += n.rel || 1); const tot = w.reduce((a, b) => a + b, 0) || 1, out = [];
  for (let r = 0; r < 12; r++) for (const q in TXCH) { const set = new Set(TXCH[q].map(i => (r + i) % 12)); let sc = 0; w.forEach((v, pc) => { sc += set.has(pc) ? v : -.7 * v; }); sc -= .04 * TXCH[q].length; out.push({ sym: NN_[r] + q, r, q, sc: sc / tot }); }
  return out.sort((a, b) => b.sc - a.sc).slice(0, 2).filter(o => o.sc > .55);
}
const NN_ = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** analyze one event: which pitches *start* at t0 (and which stop) */
function txEvent(x, fs, t0, tNext, cfg, wantStops) {
  const len = Math.round(clamp(tNext - t0 - .022, .09, .37) * fs), sPost = Math.round((t0 + .018) * fs), sPre = Math.round(t0 * fs - .004 * fs) - len;
  const post = txSpec(x, sPost, len, TXN), pre = txSpec(x, sPre, len, TXN), K = post.length, D = new Float32Array(K), Dn = new Float32Array(K);
  let nf = txSmooth(post, 30); { const cl = new Float32Array(K); for (let k = 0; k < K; k++) cl[k] = Math.min(post[k], nf[k] * 1.2); nf = txSmooth(cl, 30); const cl2 = new Float32Array(K); for (let k = 0; k < K; k++) cl2[k] = Math.min(post[k], nf[k] * 1.5); nf = txSmooth(cl2, 30); }
  for (let k = 0; k < K; k++) { const d = post[k] - .85 * pre[k]; D[k] = d > 0 ? d : 0; const e = pre[k] - post[k]; Dn[k] = e > 0 ? e : 0; }
  let rms = 0; for (let i = 0; i < len; i++) { const v = x[sPost + i] || 0; rms += v * v; } rms = Math.sqrt(rms / len);
  const salRaw = txSalience(D, nf, cfg.tbl, fs, cfg.B);
  const run = (Dd, maxPoly, minRel, sal0) => {
    const W = Float32Array.from(Dd), res = []; let s1 = 0, first = sal0, sal = sal0;
    for (let it = 0; it < maxPoly; it++) {
      if (it > 0) sal = txSalience(W, nf, cfg.tbl, fs, cfg.B);
      let bi = -1, bs = 0; for (let i = 0; i < sal.length; i++) if (sal[i].sal > bs) { bs = sal[i].sal; bi = i; }
      if (it === 0) s1 = bs; if (bi < 0 || bs < cfg.minSal || bs < minRel * s1) break;
      // sub-octave check: a partial series that is the even half of a lower series is that lower note
      for (const dn of [12, 19, 24]) { const L = bi - dn; if (L < 0 || !sal[L] || !sal[L].sal) continue; const q = sal[L], hs = q.hs; if (q.present < Math.max(3, .7 * q.hEff)) continue; let o = 0, on = 0, e = 0, en = 0; hs.forEach((h, i) => { const hh = i + 1; if (!h.pres) return; if (dn === 12 ? hh % 2 : dn === 19 ? hh % 3 : hh % 4) { o += h.pk; on++; } else { e += h.pk; en++; } }); if (on && en && o / on >= cfg.subOct * e / en && q.sal >= .35 * bs) { bi = L; bs = q.sal; break; } }
      const c = sal[bi], note = { midi: cfg.tbl[bi].midi, sal: bs, rel: bs / s1, present: c.present, hEff: c.hEff, dev: null };
      let dsum = 0, dw = 0; c.hs.forEach((h, i) => { if (!h.pres) return; const kk = txParabolic(Dd, h.pi), fobs = kk * fs / TXN, fexp = (i + 1) * cfg.tbl[bi].f * Math.sqrt(1 + cfg.B * (i + 1) * (i + 1)), cents = 1200 * Math.log2(fobs / fexp); if (Math.abs(cents) < 40) { dsum += cents * h.pk; dw += h.pk; } });
      note.dev = dw ? dsum / dw : null; res.push(note); txCancel(W, c, cfg.partial);
    }
    // partial-ghost filter: weak picks that sit on an integer harmonic of a stronger lower pick are that pick's overtones
    const keep = res.filter((n, i) => !(n.rel < cfg.ghostRel && res.some((L, j) => j !== i && L.midi < n.midi && L.rel > n.rel * 1.15 && (() => { const r = Math.pow(2, (n.midi - L.midi) / 12), hr = Math.round(r); return hr >= 2 && hr <= 12 && Math.abs(r / hr - 1) < .028; })())));
    return { notes: keep, s1, all: first };
  };
  const r = run(D, cfg.maxPoly, cfg.relSal, salRaw), out = { t: t0, notes: r.notes, s1: r.s1, rms, raw: r.all, D, len };
  if (wantStops) { const q = run(Dn, 2, .45, txSalience(Dn, nf, cfg.tbl, fs, cfg.B)); out.stops = q.notes; }
  return out;
}

/** how plucked is this onset? ratio of broadband (HF) energy and RMS after vs. before — hammer-ons / pull-offs barely raise either */
function txTransient(x, fs, t) {
  const a = (t0, t1, hf) => { let s = 0, n = 0; for (let i = Math.max(2, Math.round(t0 * fs)); i < Math.min(x.length, Math.round(t1 * fs)); i++) { const v = hf ? x[i] - 2 * x[i - 1] + x[i - 2] : x[i]; s += v * v; n++; } return n ? s / n : 0; };
  return { rms: Math.sqrt((a(t + .005, t + .045, false) + 1e-12) / (a(t - .045, t - .005, false) + 1e-12)), hf: (a(t + .003, t + .035, true) + 1e-14) / (a(t - .04, t - .005, true) + 1e-14) };
}
/* ---------- pitch trajectory (bend / vibrato / slide evidence) ---------- */
function txTrack(x, fs, t0, t1, f0) {
  const out = [], win = 2048, hop = 512, bin = fs / TXN, sp = new Float32Array((TXN >> 1) + 1); let a0 = 0;
  for (let s = Math.round(t0 * fs); s < t1 * fs; s += hop) {
    txSpec(x, s, win, TXN, sp); let sum = 0, wsum = 0, amp = 0;
    for (let h = 1; h <= 3; h++) { const fh = f0 * h * Math.sqrt(1 + 2e-4 * h * h), kc = Math.round(fh / bin), kw = Math.round(fh * (Math.pow(2, 200 / 1200) - 1) / bin); let pk = 0, pi = -1; for (let k = Math.max(1, kc - kw); k <= Math.min(sp.length - 2, kc + kw); k++) if (sp[k] > pk) { pk = sp[k]; pi = k; } if (pi < 0 || pk < 2e-4) continue; const fo = txParabolic(sp, pi) * bin; sum += 1200 * Math.log2(fo / fh) * pk; wsum += pk; if (h === 1) amp = pk; else if (!amp) amp = pk; }
    if (!wsum) { if (out.length > 2) break; continue; } if (!a0) a0 = amp; if (amp < .06 * a0 && out.length > 3) break; out.push({ t: s / fs, dev: sum / wsum, amp });
  }
  return out;
}
function txTechnique(series, fretNow) {
  if (series.length < 5) return null; const d = series.map(p => p.dev), base = median(d.slice(0, 3)); if (Math.abs(base) > 40) return null; for (let i = 1; i < d.length; i++) if (Math.abs(d[i] - d[i - 1]) > 110) return null; const rel = d.map(v => v - base), mx = Math.max(...rel.slice(2)), n = rel.length;
  const hp = rel.map((v, i) => { let s = 0, c = 0; for (let j = Math.max(0, i - 4); j <= Math.min(n - 1, i + 4); j++) { s += rel[j]; c++; } return v - s / c; }); let z = 0, ex = 0; for (let i = 1; i < n; i++) { if ((hp[i - 1] < 0) !== (hp[i] < 0)) z++; ex = Math.max(ex, Math.abs(hp[i])); }
  const dt = (series[n - 1].t - series[0].t) || 1, rate = z / 2 / dt;
  if (mx >= 55 && rel.slice(Math.floor(n * .4)).some(v => v >= 45)) return { t: 'b', bendTo: fretNow + Math.max(1, Math.round(mx / 100)) };
  if (z >= 4 && ex >= 11 && rate >= 3 && rate <= 9.5) return { t: '~' };
  return null;
}
function txGlide(x, fs, tA, tB, f1, f2) {
  const win = 1024, hop = 128, N = 4096, bin = fs / N, sp = new Float32Array((N >> 1) + 1), lo = Math.min(f1, f2) * .96, hi = Math.max(f1, f2) * 1.04; let inter = 0, mx = 0; const rows = [];
  for (let s = Math.round(tA * fs); s < tB * fs; s += hop) { txSpec(x, s, win, N, sp); let pk = 0, pi = -1; for (let k = Math.floor(lo / bin); k <= Math.ceil(hi / bin); k++) if (sp[k] > pk) { pk = sp[k]; pi = k; } if (pi < 0) continue; rows.push({ f: txParabolic(sp, pi) * bin, a: pk }); if (pk > mx) mx = pk; }
  rows.forEach(r => { if (r.a < .3 * mx) return; const c1 = Math.abs(1200 * Math.log2(r.f / f1)), c2 = Math.abs(1200 * Math.log2(r.f / f2)); if (c1 > 28 && c2 > 28 && r.f > lo && r.f < hi) inter++; }); return inter;
}

/* ---------- tempo / beat phase for imported audio ---------- */
function txTempo(onsets, minBpm = 60, maxBpm = 180) {
  if (onsets.length < 6) return null; const t = onsets.map(o => o.t), res = .01, len = Math.ceil((t[t.length - 1] + 1) / res), env = new Float32Array(len); t.forEach((v, i) => { env[Math.round(v / res)] += Math.min(3, onsets[i].strength || 1); });
  let best = null; for (let bpm = minBpm; bpm <= maxBpm; bpm += .25) { const p = 60 / bpm; let s = 0; for (let k = 1; k <= 3; k++) { const lag = Math.round(p * k / res); for (let i = 0; i + lag < len; i++) if (env[i]) s += env[i] * (env[i + lag] + .5 * (env[i + lag - 1] || 0) + .5 * (env[i + lag + 1] || 0)) / k; } const sc = s * (1 + .15 * Math.exp(-Math.pow(Math.log2(bpm / 100), 2))); if (!best || sc > best.sc) best = { bpm, sc }; }
  let bpm = best.bpm; const p = 60 / bpm; let bph = 0, bs = -1; for (let ph = 0; ph < p; ph += .005) { let s = 0; t.forEach(v => { const r = ((v - ph) % p + p) % p, d = Math.min(r, p - r); s += Math.exp(-d * d / (2 * .02 * .02)); }); if (s > bs) { bs = s; bph = ph; } }
  return { bpm, phase: bph };
}

/* ---------- quantization ---------- */
const txSlotTime = (k, dur, swing) => k * dur + (k & 1 ? swing * dur : 0);
function txQuant(tAbs, dur, swing, grid) {
  const k0 = Math.round(tAbs / dur); let bk = k0, bd = 1e9; for (let k = k0 - 2; k <= k0 + 2; k++) { if (grid === 2 && k % 2) continue; if (grid === 4 && k % 4) continue; const d = Math.abs(tAbs - txSlotTime(k, dur, swing)); if (d < bd) { bd = d; bk = k; } }
  return { k: bk, res: tAbs - txSlotTime(bk, dur, swing) };
}

/* ---------- string / fret assignment (Viterbi with musical priors) ---------- */
function txCandidates(m, tuning, capo, maxFret) { const c = []; tuning.forEach((o, st) => { const f = m - o - capo; if (f >= 0 && f <= maxFret) c.push({ st, f }); }); return c; }
function txAssign(events, cx) {
  const T = cx.tuning, capo = cx.capo, MF = cx.maxFret || 22, B = 28, vc = {}, vf = sym => { if (!sym) return []; return vc[sym] || (vc[sym] = (cx.voicings ? cx.voicings(sym) : []).slice(0, 8)); };
  const layers = [];
  events.forEach((ev, ei) => {
    ev.notes = ev.notes.filter(n => txCandidates(n.midi, T, capo, MF).length);
    const notes = ev.notes.slice().sort((a, b) => a.midi - b.midi), vs = vf(ev.sym), camNear = (cx.cam || []).filter(c => Math.abs(c.t - ev.t) < .35), camPos = camNear.length ? median(camNear.map(c => c.fret).filter(f => f > 0)) : NaN;
    const states = []; if (!notes.length) { layers.push([{ asg: [], cost: 0, pos: null }]); return; }
    const opts = notes.map(n => txCandidates(n.midi, T, capo, MF)), used = new Array(6).fill(false), cur = [];
    const dfs = (i, cost) => {
      if (states.length > 6000) return; if (i === notes.length) { states.push(txScoreSet(cur.slice(), notes, cost, vs, camNear, camPos, ev, cx)); return; }
      for (const c of opts[i]) { if (used[c.st]) continue; used[c.st] = true; cur.push({ st: c.st, f: c.f, midi: notes[i].midi }); dfs(i + 1, cost + (c.f === 0 ? 0 : .09 * c.f + (c.f > 12 ? .5 : 0))); cur.pop(); used[c.st] = false; }
    };
    dfs(0, 0); states.sort((a, b) => a.cost - b.cost); layers.push(states.length ? states.slice(0, B) : [{ asg: [], cost: 0, pos: null }]);
  });
  // viterbi
  const n = layers.length; if (!n) return; const best = layers.map(L => new Float64Array(L.length)), back = layers.map(L => new Int32Array(L.length).fill(-1));
  for (let i = 0; i < n; i++) for (let s = 0; s < layers[i].length; s++) {
    const st = layers[i][s]; if (i === 0) { best[i][s] = st.cost; continue; }
    let bv = 1e18, bj = 0; for (let j = 0; j < layers[i - 1].length; j++) { const v = best[i - 1][j] + txTrans(layers[i - 1][j], st, events[i], events[i - 1]); if (v < bv) { bv = v; bj = j; } } best[i][s] = bv + st.cost; back[i][s] = bj;
  }
  let bs = 0; for (let s = 1; s < layers[n - 1].length; s++) if (best[n - 1][s] < best[n - 1][bs]) bs = s;
  for (let i = n - 1; i >= 0; i--) { const L = layers[i][bs]; events[i].asg = L.asg; events[i].asgCost = L.cost; if (i > 0) bs = back[i][bs]; }
  events.forEach(ev => { ev.asg.forEach(a => { const nn = ev.notes.find(q => q.midi === a.midi); if (nn) { nn.st = a.st; nn.fret = a.f; nn.camHit = !!a.cam; } }); });
}
function txScoreSet(asg, notes, cost, vs, camNear, camPos, ev, cx) {
  const fretted = asg.filter(a => a.f > 0), fr = fretted.map(a => a.f); let pos = null;
  if (fr.length) { const mn = Math.min(...fr), mxf = Math.max(...fr); pos = mn; const span = mxf - mn; if (span > 4) cost += 6 + (span - 4) * 3; else if (span > 3) cost += .8;
    const fingers = new Set(fr.filter(f => f > mn)).size + (fr.some(f => f === mn) ? 1 : 0); const cnt = fretted.length; if (cnt >= 3 && fingers > 4) cost += 5 + (fingers - 4) * 2; }
  if (vs.length) { let best = 0; vs.forEach(v => { let m = 0; asg.forEach(a => { if (v.frets[a.st] === a.f) m++; }); const frac = m / asg.length; if (m === asg.length && asg.length >= 2) best = Math.max(best, 1); else best = Math.max(best, frac * .6); }); cost -= (cx.chordPrior == null ? 1 : cx.chordPrior) * (2.4 * best + (best === 1 ? 1.2 : 0)) * Math.min(asg.length, 3) / 2; }
  if (camNear.length) { asg.forEach(a => { const hit = camNear.some(c => c.st === a.st && c.fret === a.f); a.cam = hit; if (hit) cost -= 3.2 * (cx.camWeight == null ? 1 : cx.camWeight); else if (camNear.some(c => c.st === a.st)) cost += .6 * (cx.camWeight == null ? 1 : cx.camWeight); }); if (pos != null && !isNaN(camPos)) cost += Math.min(3, Math.abs(pos - camPos) * .18) * (cx.camWeight == null ? 1 : cx.camWeight); }
  return { asg, cost, pos };
}
function txTrans(a, b, evB, evA) {
  let c = 0; if (a.pos != null && b.pos != null) c += Math.min(6, Math.abs(a.pos - b.pos) * .32);
  if (a.asg.length === 1 && b.asg.length === 1 && a.asg[0].midi === b.asg[0].midi && (a.asg[0].st !== b.asg[0].st)) c += 1.4;
  if (evB.legato) { const prev = a.asg.find(q => q.midi === evB.legato.from), cur = b.asg.find(q => q.midi === evB.legato.to); if (prev && cur && prev.st !== cur.st) c += 9; else if (prev && cur) c -= 1.5; }
  if (a.asg.length === 1 && b.asg.length === 1 && Math.abs(a.asg[0].st - b.asg[0].st) > 2) c += .35 * (Math.abs(a.asg[0].st - b.asg[0].st) - 2);
  return c;
}

/* ---------- orchestrator ---------- */
async function txTranscribe(mono, sr, cx, progress) {
  const P = Object.assign({ sens: .5, relSal: .26, minSal: .1, subOct: .3, partial: 0, ghostRel: .7, legHF: 25, legRMS: 2.3, rawFrac: .6, rawMin: 8, fillFrac: .5, vBonus: .04, parsimony: .012, keepFrac: .15, maxPoly: 6, grid: 1, B: 2e-4, legato: true, techniques: true, autoOffset: true, offsetMs: 0, minConf: .0, chordPrior: 1, camWeight: 1, snapChord: true }, cx.params || {});
  const yield_ = () => new Promise(r => setTimeout(r, 0)), rep = (f, m) => { if (progress) progress(f, m); };
  rep(.02, 'Resampling…'); const { x, fs } = txPrep(mono, sr); await yield_();
  rep(.08, 'Finding onsets…'); const ons = txOnsets(x, fs, P.sens, P.legato); await yield_();
  const strong = ons.filter(o => !o.weak), weak = ons.filter(o => o.weak);
  // group strong onsets (strum clusters ≤ 50 ms) ; weak onsets stay separate candidates
  const evts = []; strong.forEach(o => { const l = evts[evts.length - 1]; if (l && o.t - l.last < .05) { l.last = o.t; l.times.push(o.t); l.strength = Math.max(l.strength, o.strength); } else evts.push({ t: o.t, last: o.t, times: [o.t], strength: o.strength, weak: false }); });
  if (P.legato) weak.forEach(o => evts.push({ t: o.t, last: o.t, times: [o.t], strength: o.strength, weak: true })); evts.sort((a, b) => a.t - b.t);
  const dur = cx.slotDur, swing = cx.swing || 0, base = { tbl: null, B: P.B, minSal: P.minSal, relSal: P.relSal, maxPoly: P.maxPoly, subOct: P.subOct, partial: P.partial, ghostRel: P.ghostRel };
  let tune = 0, res = [];
  for (let pass = 0; pass < 2; pass++) {
    base.tbl = txPitchTable(cx.tuning, cx.capo, cx.maxFret || 22, cx.a4 || 440, tune); res = [];
    for (let i = 0; i < evts.length; i++) {
      const e = evts[i], nxt = i + 1 < evts.length ? evts[i + 1].t : e.t + .5; const r = txEvent(x, fs, e.t, nxt, base, P.legato);
      res.push(Object.assign(r, { strength: e.strength, weak: e.weak, times: e.times, tNext: nxt, tr: txTransient(x, fs, e.t) })); if (i % 12 === 0) { rep(.1 + (pass * .25 + i / evts.length * .25) * 1, pass ? 'Re-tuning pass…' : 'Reading notes…'); await yield_(); }
    }
    if (pass === 0) { const devs = []; res.forEach(r => r.notes.forEach(n => { if (n.dev != null && n.rel > .5 && !r.weak) devs.push(n.dev); })); const md = devs.length > 4 ? median(devs) : 0; if (Math.abs(md) > 5) tune = md; else break; }
  }
  // legato classification: one new pitch + the previous pitch of the string stops + no pluck transient
  const events = []; let lastNotes = [];
  const soft = r => r.tr && r.tr.hf < P.legHF && r.tr.rms < P.legRMS;
  res.forEach((r, i) => {
    let leg = null;
    if (P.legato && r.notes.length === 1 && r.stops && r.stops.length) { const n = r.notes[0], st = r.stops.find(q => { const d = Math.abs(n.midi - q.midi); return d >= 1 && d <= 12; }), prevN = st && lastNotes.slice().reverse().find(q => q.midi === st.midi && r.t - q.t < 2); if (prevN && n.rel > .5 && (r.weak || soft(r))) leg = { from: st.midi, to: n.midi }; }
    if (cx.debugLeg) cx.debugLeg(r, leg);
    if (r.weak && !leg) return; if (!r.notes.length) return;
    events.push({ t: r.t, strength: r.strength, notes: r.notes, s1: r.s1, raw: r.raw, D: r.D, len: r.len, stops: r.stops, times: r.times, tNext: r.tNext, legato: leg });
    r.notes.forEach(n => lastNotes.push({ midi: n.midi, t: r.t })); if (lastNotes.length > 40) lastNotes.splice(0, lastNotes.length - 40);
  });
  rep(.55, 'Aligning to the grid…');
  // grid alignment with optional auto offset
  const t0abs = cx.startSec || 0; const resAt = off => events.map(e => txQuant(t0abs + e.t + off, dur, swing, P.grid).res);
  let off = (P.offsetMs || 0) / 1000, autoOff = 0;
  if (P.autoOffset && events.length >= 4) { let bo = 0, bm = 1e9; const med0 = median(resAt(off).map(Math.abs)); for (let o = -.07; o <= .07; o += .004) { const m = median(resAt(off + o).map(Math.abs)); if (m < bm) { bm = m; bo = o; } } if (bm < med0 * .85) { autoOff = bo; off += bo; } }
  events.forEach(e => { const q = txQuant(t0abs + e.t + off, dur, swing, P.grid); e.k = q.k; e.res = q.res; });
  // merge events landing on the same slot
  const byK = new Map(); events.forEach(e => { const m = byK.get(e.k); if (!m) byK.set(e.k, e); else { e.notes.forEach(n => { const d = m.notes.find(q => q.midi === n.midi); if (!d) m.notes.push(n); else if (n.sal > d.sal) Object.assign(d, n); }); m.strength = Math.max(m.strength, e.strength); if (e.legato && !m.legato) m.legato = e.legato; } });
  const merged = [...byK.values()].sort((a, b) => a.k - b.k);
  merged.forEach(e => { e.sym = cx.chordAt ? cx.chordAt(e.k) : null; });
  // model selection by synthesis: greedy hypothesis vs. every library voicing of the bar's chord (± melody extras), scored by explained spectral energy
  if (P.snapChord && cx.voicings) merged.forEach(e => {
    if (!e.D) return; const rawMax = e.raw ? Math.max(...e.raw.map(q => q.sal)) : 0, rawN = e.raw ? e.raw.filter(q => q.sal >= P.rawFrac * rawMax).length : 0; if (e.notes.length < 3 && rawN < P.rawMin) return; if (cx.debugChord) cx.debugChord(e.k, e.notes.length, rawN); const fsv = fs, f0 = m => cx.a4 * Math.pow(2, (m - 69) / 12 + tune / 1200); let yy = 0; const kmax = Math.min(e.D.length, Math.floor(5200 / (fs / TXN))); for (let k = 1; k < kmax; k++) yy += e.D[k] * e.D[k]; if (yy <= 0) return;
    const syms = e.sym ? [e.sym] : txGuess(e.notes).map(o => o.sym); if (!syms.length) return; const gset = e.notes.map(n => n.midi), hyps = [{ set: gset, tag: 'g' }];
    syms.forEach(sym => (cx.voicings(sym) || []).slice(0, 9).forEach(v => { const set = []; v.frets.forEach((f, st) => { if (f != null) set.push(cx.tuning[st] + cx.capo + f); }); if (set.length < 2) return; hyps.push({ set, tag: 'v' }); const ex = e.notes.filter(n => n.rel >= .7 && !set.includes(n.midi) && !set.some(m => m % 12 === n.midi % 12)).map(n => n.midi); if (ex.length && ex.length <= 2) hyps.push({ set: set.concat(ex), tag: 'v+' }); }));
    let best = null; const pen = P.parsimony; hyps.forEach(h => { const fit = txFitSet(e.D, fsv, e.len, P.B, h.set.map(f0), yy), sc = fit.expl - pen * h.set.length + (h.tag !== 'g' && e.sym ? P.vBonus : 0); if (!best || sc > best.sc) best = { sc, fit, h }; });
    if (cx.debug) cx.debug({ k: e.k, sym: e.sym, greedy: gset, pick: best && best.h.set, tag: best && best.h.tag, amps: best && best.fit.amp, expl: best && best.fit.expl, all: hyps.length });
    if (!best || best.h.tag === 'g') return; const mx = Math.max(...best.fit.amp), keep = []; best.h.set.forEach((m, i) => { if (best.fit.amp[i] >= P.keepFrac * mx) keep.push({ m, a: best.fit.amp[i] }); });
    const old = new Map(e.notes.map(n => [n.midi, n])); e.notes = keep.map(k => { const o = old.get(k.m); return o || { midi: k.m, sal: k.a, rel: k.a / mx, inferred: true, dev: null }; });
  });
  rep(.62, 'Assigning strings & frets…'); await yield_(); txAssign(merged, cx);
  // techniques: trajectories for bends / vibrato, glide test for slides, HO/PO tags
  rep(.78, 'Reading techniques…');
  if (P.techniques) { for (let i = 0; i < merged.length; i++) { const e = merged[i]; for (const n of e.notes) { if (n.fret == null || n.inferred || e.notes.length > 2) continue; const f0 = cx.a4 * Math.pow(2, (n.midi - 69) / 12 + tune / 1200), tEnd = Math.min(e.tNext ? e.tNext - .1 : e.t + .6, e.t + .7); if (tEnd - e.t < .28) continue; const series = txTrack(x, fs, e.t + .02, tEnd, f0), tech = txTechnique(series, n.fret); if (cx.debugTech) cx.debugTech(n.midi, e.k, series, tech); if (tech) { n.tech = tech.t; if (tech.bendTo != null) n.bendTo = tech.bendTo; } }
      if (e.legato) { const pe = merged[i - 1] ? null : null; const f1 = cx.a4 * Math.pow(2, (e.legato.from - 69) / 12 + tune / 1200), f2 = cx.a4 * Math.pow(2, (e.legato.to - 69) / 12 + tune / 1200); const glide = txGlide(x, fs, e.t - .1, e.t + .06, f1, f2); e.legato.slide = glide >= 4; e.legato.up = e.legato.to > e.legato.from; }
      if (i % 10 === 0) await yield_(); } }
  // attach legato technique to the source note (the previous note on the same string)
  merged.forEach((e, i) => { if (!e.legato) return; const to = e.notes.find(n => n.midi === e.legato.to); if (!to || to.st == null) return; for (let j = i - 1; j >= 0; j--) { const src = merged[j].notes.find(n => n.st === to.st); if (src) { if (!src.tech || src.tech === '~') src.tech = e.legato.slide ? (e.legato.up ? '/' : '\\') : (e.legato.up ? 'h' : 'p'); to.legato = true; break; } } });
  // confidence
  merged.forEach(e => e.notes.forEach(n => { const att = clamp((e.strength - .8) / 1.6, 0, 1), lvl = clamp(e.s1 / .5, 0, 1); n.conf = clamp(.5 * clamp(n.rel, 0, 1) + .3 * lvl + .2 * att - (n.inferred ? .25 : 0), 0, 1); }));
  const out = merged.filter(e => e.notes.length).map(e => ({ k: e.k, t: e.t, res: e.res, strength: e.strength, sym: e.sym, legato: e.legato || null, notes: e.notes.filter(n => n.st != null).map(n => ({ midi: n.midi, st: n.st, fret: n.fret, conf: n.conf, tech: n.tech || '', bendTo: n.bendTo, inferred: !!n.inferred, camHit: !!n.camHit, dev: n.dev })) })).filter(e => e.notes.length);
  const resid = out.map(e => e.res * 1000);
  rep(1, 'Done');
  return { events: out, stats: { onsets: ons.length, weak: weak.length, events: out.length, notes: out.reduce((a, e) => a + e.notes.length, 0), tuneCents: tune, autoOffsetMs: autoOff * 1000, offsetMs: off * 1000, residMean: resid.length ? mean(resid) : null, residSD: resid.length > 2 ? sd(resid) : null, residAbs: resid.length ? mean(resid.map(Math.abs)) : null, meanConf: out.length ? mean(out.flatMap(e => e.notes.map(n => n.conf))) : null, fs }, params: P };
}

/* ---------- multi-take consensus ---------- */
function txConsensus(results, minFrac) {
  const n = results.length, need = Math.max(1, Math.ceil(n * (minFrac == null ? .5 : minFrac))), votes = new Map();
  results.forEach(r => r.events.forEach(e => e.notes.forEach(nt => { const key = e.k + '|' + nt.midi; let v = votes.get(key); if (!v) votes.set(key, v = { k: e.k, midi: nt.midi, n: 0, st: {}, conf: 0, tech: {}, bend: {}, sym: e.sym, t: e.t }); v.n++; v.conf += nt.conf; const sk = nt.st + ':' + nt.fret; v.st[sk] = (v.st[sk] || 0) + 1; if (nt.tech) v.tech[nt.tech] = (v.tech[nt.tech] || 0) + 1; if (nt.bendTo != null) v.bend[nt.bendTo] = (v.bend[nt.bendTo] || 0) + 1; })));
  const byK = new Map(); votes.forEach(v => { if (v.n < need) return; let bk = null, bn = -1; for (const k in v.st) if (v.st[k] > bn) { bn = v.st[k]; bk = k; } const [st, fret] = bk.split(':').map(Number); let tech = '', tn = 0; for (const k in v.tech) if (v.tech[k] > tn && v.tech[k] >= need) { tn = v.tech[k]; tech = k; } let bend; if (tech === 'b') { let bb = -1; for (const k in v.bend) if (v.bend[k] > bb) { bb = v.bend[k]; bend = +k; } }
    const e = byK.get(v.k) || { k: v.k, t: v.t, res: 0, strength: 1, sym: v.sym, legato: null, notes: [] }; e.notes.push({ midi: v.midi, st, fret, conf: clamp(v.conf / n * (.6 + .4 * v.n / n), 0, 1), tech, bendTo: bend, inferred: false, camHit: false, dev: null }); byK.set(v.k, e); });
  return { events: [...byK.values()].sort((a, b) => a.k - b.k), stats: { takes: n, need, events: byK.size, notes: [...byK.values()].reduce((a, e) => a + e.notes.length, 0) }, params: results[0] ? results[0].params : {} };
}

/* ---------- synthetic guitar renderer (for the self-test benchmark) ---------- */
function txRng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function txPluck(out, sr, t, midi, vel, o, rnd) {
  const f = 440 * Math.pow(2, (midi - 69) / 12), D = sr / f, a = o.disp || .06, apDelay = (1 - a) / (1 + a) * (o.stages || 2), Ld = D - .5 - 1.0 - apDelay, L = Math.max(4, Math.floor(Ld)), d = Ld - L + 1.0, C = (1 - d) / (1 + d);
  const t60 = clamp(2.6 - (midi - 40) * .035, .7, 2.6) * (o.sustain || 1), g = Math.pow(10, -3 / (t60 * f)), buf = new Float32Array(L + 1);
  let lp = 0; const cut = .25 + .6 * vel; for (let i = 0; i < L; i++) { const w = rnd() * 2 - 1; lp += cut * (w - lp); buf[i] = lp; } const pp = Math.max(1, Math.round(L * (.12 + .15 * rnd()))); for (let i = L - 1; i >= pp; i--) buf[i] -= buf[i - pp] * .8; let pk = 0; for (let i = 0; i < L; i++) pk = Math.max(pk, Math.abs(buf[i])); const sc = vel * .35 / (pk || 1); for (let i = 0; i < L; i++) buf[i] *= sc;
  let xp = 0, yp = 0, ax1 = new Float64Array(o.stages || 2), ay1 = new Float64Array(o.stages || 2), idx = 0, s0 = Math.round(t * sr), n = Math.min(out.length - s0, Math.round(sr * Math.min(3.5, t60 * 1.3))), prevS = 0;
  for (let i = 0; i < n; i++) {
    const cur = buf[idx], nxt = buf[(idx + 1) % L], avg = .5 * (cur + nxt) * g; let y = C * avg + xp - C * yp; xp = avg; yp = y;
    for (let s = 0; s < ax1.length; s++) { const z = a * y + ax1[s] - a * ay1[s]; ax1[s] = y; ay1[s] = z; y = z; }
    buf[idx] = y; idx = (idx + 1) % L; if (s0 + i >= 0) out[s0 + i] += cur;
  }
}
function txSynth(notes, sr, dur, o) {
  o = o || {}; const rnd = txRng(o.seed || 7), out = new Float32Array(Math.round(sr * dur)); notes.forEach(n => txPluck(out, sr, n.t, n.midi, n.vel || .8, o, rnd));
  if (o.snr != null) { let e = 0; for (let i = 0; i < out.length; i++) e += out[i] * out[i]; const rms = Math.sqrt(e / out.length), nz = rms * Math.pow(10, -o.snr / 20); for (let i = 0; i < out.length; i++) out[i] += (rnd() * 2 - 1) * nz * 1.7; }
  return out;
}
/** F1 between truth [{k,st,fret,midi}] and detected events */
function txScore(truth, events) {
  const det = []; events.forEach(e => e.notes.forEach(n => det.push({ k: e.k, st: n.st, fret: n.fret, midi: n.midi, tech: n.tech })));
  const used = new Array(det.length).fill(false); let tpP = 0, tpS = 0; truth.forEach(t => { const i = det.findIndex((d, j) => !used[j] && d.k === t.k && d.midi === t.midi); if (i >= 0) { used[i] = true; tpP++; if (det[i].st === t.st && det[i].fret === t.fret) tpS++; } });
  const P = det.length ? tpP / det.length : 0, R = truth.length ? tpP / truth.length : 0; return { truth: truth.length, det: det.length, tp: tpP, precision: P, recall: R, f1: P + R ? 2 * P * R / (P + R) : 0, sfAcc: tpP ? tpS / tpP : 0 };
}
