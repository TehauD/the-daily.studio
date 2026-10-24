/* ============================================================
   Part 16a · stem separation DSP (pure — runs in a Web Worker, or on the main thread as a fallback)
   Harmonic/percussive median-filter separation + bass crossover + centre/pitched-voice mask.
   stems sum back to the original: drums + bass + vocals + other == input.
   ============================================================ */
function stemDSPFactory() {
  const N = 2048, HOP = 1024, NB = N / 2 + 1, TWO_PI = Math.PI * 2;
  const rev = new Uint16Array(N); { const l = Math.log2(N); for (let i = 0; i < N; i++) { let r = 0; for (let b = 0; b < l; b++) if (i & (1 << b)) r |= 1 << (l - 1 - b); rev[i] = r; } }
  const cs = new Float32Array(N / 2), sn = new Float32Array(N / 2); for (let i = 0; i < N / 2; i++) { cs[i] = Math.cos(TWO_PI * i / N); sn[i] = Math.sin(TWO_PI * i / N); }
  const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = Math.sqrt(.5 * (1 - Math.cos(TWO_PI * i / N)));
  function fft(re, im, inv) {
    for (let i = 0; i < N; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1, step = N / size;
      for (let i = 0; i < N; i += size) for (let j = 0, k = 0; j < half; j++, k += step) {
        const wr = cs[k], wi = inv ? sn[k] : -sn[k], a = i + j, b = a + half, tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
    if (inv) for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; }
  }
  /* 1-D sliding median (window 2h+1, clamped edges) over a strided float array */
  function slideMedian(src, off, stride, n, out, ooff, ostride, h) {
    const W = 2 * h + 1, w = new Float32Array(W); const at = i => src[off + (i < 0 ? 0 : i >= n ? n - 1 : i) * stride];
    for (let j = 0; j < W; j++) w[j] = at(j - h); w.sort();
    for (let i = 0; i < n; i++) {
      out[ooff + i * ostride] = w[h]; if (i === n - 1) break;
      const rem = at(i - h), add = at(i + h + 1); if (rem === add) continue;
      let p = 0; while (w[p] !== rem) p++; // remove
      if (add > rem) { while (p < W - 1 && w[p + 1] < add) { w[p] = w[p + 1]; p++; } } else { while (p > 0 && w[p - 1] > add) { w[p] = w[p - 1]; p--; } }
      w[p] = add;
    }
  }
  const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  async function run(L, R, sr, opt, progress) {
    opt = Object.assign({ bassHz: 170, bassMin: 0, combH: 6, combW: 1.1, B: 128, C: 8, vox: 1, beta: 2 }, opt || {});
    const n = L.length, F = Math.ceil(n / HOP) + 1, B = opt.B, C = opt.C, fb = f => f * N / sr;
    const out = { drumsL: new Int16Array(n), drumsR: new Int16Array(n), bass: new Int16Array(n), vox: new Int16Array(n) };
    const feat = { F, hop: HOP, sr, eD: new Float32Array(F), eB: new Float32Array(F), eV: new Float32Array(F), eO: new Float32Array(F), eA: new Float32Array(F), fk: new Float32Array(F), fs: new Float32Array(F), fh: new Float32Array(F), sV: new Float32Array(F), tO: new Float32Array(F), bS: new Float32Array(F), pk: new Float32Array(F), chroma: new Float32Array(F * 12) };
    const bk = (a, b) => [Math.max(1, Math.round(fb(a))), Math.min(NB - 1, Math.round(fb(b)))];
    const KO = bk(100, 2000), KK = bk(35, 130), KS = bk(170, 3500), KH = bk(6500, 14000), KV = bk(80, 3000), KCH = bk(60, 4000);
    const lpB = new Float32Array(NB), bw = new Float32Array(NB), chPc = new Int8Array(NB), chW = new Float32Array(NB);
    for (let k = 0; k < NB; k++) { const f = k * sr / N; lpB[k] = 1 / (1 + Math.pow(f / opt.bassHz, 8)); bw[k] = smooth(f, 140, 320) * (1 - smooth(f, 6500, 11000)); chPc[k] = f > 0 ? (((Math.round(12 * Math.log2(f / 440) + 69) % 12) + 12) % 12) : 0; chW[k] = (1 / (1 + f / 900)); }
    const kLow = Math.round(fb(210)); const f0s = [], bf0 = []; for (let f = 38; f <= 150; f *= 1.025) bf0.push(f); for (let f = 80; f <= 800; f *= 1.03) f0s.push(f);
    let prevD = [0, 0, 0], acc = [0, 1, 2, 3].map(() => new Float32Array((B + 1) * HOP));
    const re = new Float32Array(N), im = new Float32Array(N);
    const T0 = B + 2 * C;
    for (let b0 = 0; b0 < F; b0 += B) {
      const b1 = Math.min(F, b0 + B), f0 = Math.max(0, b0 - C), f1 = Math.min(F, b1 + C), T = f1 - f0;
      const Lr = new Float32Array(T * NB), Li = new Float32Array(T * NB), Rr = new Float32Array(T * NB), Ri = new Float32Array(T * NB), Mg = new Float32Array(T * NB);
      for (let t = 0; t < T; t++) {
        const s0 = (f0 + t - 1) * HOP; for (let i = 0; i < N; i++) { const s = s0 + i; re[i] = s >= 0 && s < n ? L[s] * win[i] : 0; im[i] = s >= 0 && s < n ? R[s] * win[i] : 0; }
        fft(re, im, false);
        for (let k = 0; k < NB; k++) {
          const k2 = (N - k) & (N - 1), ar = re[k], ai = im[k], br = re[k2], bi = im[k2], o = t * NB + k;
          Lr[o] = (ar + br) / 2; Li[o] = (ai - bi) / 2; Rr[o] = (ai + bi) / 2; Ri[o] = (br - ar) / 2;
          const mr = (Lr[o] + Rr[o]) / 2, mi = (Li[o] + Ri[o]) / 2; Mg[o] = Math.hypot(mr, mi);
        }
      }
      const Hh = new Float32Array(T * NB), Pp = new Float32Array(T * NB);
      for (let k = 0; k < NB; k++) slideMedian(Mg, k, NB, T, Hh, k, NB, 8);
      for (let t = 0; t < T; t++) slideMedian(Mg, t * NB, 1, NB, Pp, t * NB, 1, 8);
      for (let f = b0; f < b1; f++) {
        const t = f - f0, o0 = t * NB, aA = new Float32Array(NB * 2), aB = new Float32Array(NB * 2);
        // pass 1: masks & spectra
        const Dlr = new Float32Array(NB), Dli = new Float32Array(NB), Drr = new Float32Array(NB), Dri = new Float32Array(NB), Br = new Float32Array(NB), Bi = new Float32Array(NB), Vr = new Float32Array(NB), Vi = new Float32Array(NB);
        // vocal-likeness: harmonic-series salience of the centre mid-band spectrum
        const cen = new Float32Array(NB); let cTot = 0;
        for (let k = 0; k < NB; k++) { const o = o0 + k, l = Math.hypot(Lr[o], Li[o]), r = Math.hypot(Rr[o], Ri[o]), c = (Math.min(l, r) + 1e-9) / (Math.max(l, r) + 1e-9), h2 = Hh[o] * Hh[o], p2 = Pp[o] * Pp[o]; let mp = p2 / (h2 + p2 + 1e-12); if (k < kLow) { const tr = smooth(Mg[o] / (Hh[o] + 1e-9), 2.0, 4.5) * .92; if (tr > mp) mp = tr; } mp = Math.pow(mp, opt.beta) / (Math.pow(mp, opt.beta) + Math.pow(1 - mp, opt.beta)); Pp[o] = mp; Hh[o] = c; }
        // bass: harmonic comb of the strongest low fundamental (keeps bass harmonics up to 2 kHz, away from vocals)
        const wbF = new Float32Array(NB); for (let k = 0; k < NB; k++) wbF[k] = lpB[k];
        { let best = 0, bq = -1, lowE = 1e-9; const kb = Math.round(fb(1800)); for (let k = 1; k < kb; k++) { const v = Mg[o0 + k] * (1 - Pp[o0 + k]); lowE += v; }
          for (let q = 0; q < bf0.length; q++) { let sc = 0, m1 = 0, mm = 0; for (let hh = 1; hh <= 6; hh++) { const kk = Math.round(fb(bf0[q] * hh)); if (kk >= NB - 1) break; const v = Math.max(Mg[o0 + kk - 1] * (1 - Pp[o0 + kk - 1]), Mg[o0 + kk] * (1 - Pp[o0 + kk]), Mg[o0 + kk + 1] * (1 - Pp[o0 + kk + 1])); if (hh === 1) m1 = v; if (v > mm) mm = v; sc += v / Math.sqrt(hh); } if (m1 < .45 * mm) continue; if (sc > best) { best = sc; bq = q; } }
          feat.bS[f] = bq >= 0 ? best / lowE : 0; if (bq >= 0 && best / lowE > .22 + opt.bassMin) { const f0 = bf0[bq]; for (let hh = 1; hh <= opt.combH; hh++) { const kc = fb(f0 * hh); if (kc >= NB - 2 || f0 * hh > 2200) break; const wd = opt.combW + hh * .05; for (let k = Math.floor(kc - wd - 1); k <= Math.ceil(kc + wd + 1); k++) { if (k < 1 || k >= NB) continue; const d = Math.abs(k - kc) / wd; if (d < 1) { const w = (1 - d * d) * Math.max(.35, 1 - hh * .08); if (w > wbF[k]) wbF[k] = w; } } } } }
        for (let k = 0; k < NB; k++) { const o = o0 + k, l = Math.hypot(Lr[o], Li[o]), r = Math.hypot(Rr[o], Ri[o]), c = (Math.min(l, r) + 1e-9) / (Math.max(l, r) + 1e-9); cen[k] = Mg[o] * (1 - Pp[o]) * (1 - wbF[k]) * (1 - lpB[k]) * c * c; if (k >= KV[0] && k <= KV[1]) cTot += cen[k]; }
        let sal = 0; if (cTot > 1e-6) for (let q = 0; q < f0s.length; q++) { let s = 0; for (let hh = 1; hh <= 6; hh++) { const kk = Math.round(fb(f0s[q] * hh)); if (kk >= NB - 1) break; s += Math.max(cen[kk - 1], cen[kk], cen[kk + 1]); } if (s > sal) sal = s; }
        const sV = Math.min(1, sal / (cTot + 1e-9) * 1.6), vg = smooth(sV, .18, .5), vMix = opt.vox * (.04 + .96 * vg * vg);
        let eD = 0, eB = 0, eV = 0, eA = 0, dK = 0, dS = 0, dH = 0; const chr = feat.chroma, fo = f * 12, hm = new Float32Array(NB); let oSum = 0, oMax = 0;
        for (let k = 0; k < NB; k++) {
          const o = o0 + k, mp = Pp[o], c = Hh[o], mh = 1 - mp, mr = (Lr[o] + Rr[o]) / 2, mi = (Li[o] + Ri[o]) / 2, wb = wbF[k], wv = c * c * bw[k] * vMix;
          Dlr[k] = mp * Lr[o]; Dli[k] = mp * Li[o]; Drr[k] = mp * Rr[o]; Dri[k] = mp * Ri[o];
          Br[k] = mh * wb * mr; Bi[k] = mh * wb * mi; const mv = mh * (1 - wb) * wv; Vr[k] = mv * mr; Vi[k] = mv * mi;
          const mg2 = Mg[o] * Mg[o], lr2 = (Lr[o] * Lr[o] + Li[o] * Li[o] + Rr[o] * Rr[o] + Ri[o] * Ri[o]) / 2; eA += lr2; eD += mp * mp * lr2; eB += (mh * wb) * (mh * wb) * mg2; eV += mv * mv * mg2;
          const dm = mp * Mg[o]; if (k >= KK[0] && k <= KK[1]) dK += dm; if (k >= KS[0] && k <= KS[1]) dS += dm; if (k >= KH[0] && k <= KH[1]) dH += dm;
          hm[k] = mh * Mg[o] * (1 - (1 - wb) * Math.min(1, wv * 1.25));
          if (k >= KO[0] && k <= KO[1]) { const ho = mh * (1 - wb) * (1 - Math.min(1, wv * 1.25)) * Mg[o]; oSum += ho; if (ho > oMax) oMax = ho; }
        }
        { let hmx = 1e-9; for (let k = KCH[0]; k <= KCH[1]; k++) if (hm[k] > hmx) hmx = hm[k]; for (let k = KCH[0] + 1; k < KCH[1]; k++) { const b = hm[k]; if (b < .04 * hmx || b < hm[k - 1] || b <= hm[k + 1]) continue; const la = Math.log(hm[k - 1] + 1e-9), lb = Math.log(b + 1e-9), lc = Math.log(hm[k + 1] + 1e-9), d = .5 * (la - lc) / (la - 2 * lb + lc || -1), fr = (k + Math.max(-.5, Math.min(.5, d))) * sr / N, pcf = 12 * Math.log2(fr / 440) + 69, pc = ((Math.round(pcf) % 12) + 12) % 12, dev = Math.abs(pcf - Math.round(pcf)); chr[fo + pc] += Math.sqrt(b) * chW[k] * (1 - dev * .8); } }
        feat.tO[f] = oSum > 1e-6 ? oMax / (oSum / (KO[1] - KO[0] + 1)) : 0; feat.eA[f] = eA; feat.eD[f] = eD; feat.eB[f] = eB; feat.eV[f] = eV; feat.eO[f] = Math.max(0, eA - eD - eB - eV); feat.sV[f] = sV;
        feat.fk[f] = Math.max(0, dK - prevD[0]); feat.fs[f] = Math.max(0, dS - prevD[1]); feat.fh[f] = Math.max(0, dH - prevD[2]); prevD = [dK, dS, dH];
        // peak count in harmonic spectrum 100–2000 Hz (polyphony proxy)
        { let mx = 0; const lo = Math.round(fb(100)), hi = Math.round(fb(2000)); for (let k = lo; k <= hi; k++) mx = Math.max(mx, Hh[o0 + k] === undefined ? 0 : Mg[o0 + k] * (1 - Pp[o0 + k])); let c = 0; for (let k = lo + 1; k < hi; k++) { const v = Mg[o0 + k] * (1 - Pp[o0 + k]); if (v > .2 * mx && v > Mg[o0 + k - 1] * (1 - Pp[o0 + k - 1]) && v >= Mg[o0 + k + 1] * (1 - Pp[o0 + k + 1])) c++; } feat.pk[f] = c; }
        // pass 2: inverse (two packed IFFTs)
        const pack = (Ar, Ai, Brr, Bii, w) => { for (let k = 0; k < NB; k++) { const k2 = (N - k) & (N - 1); re[k] = Ar[k] - Bii[k]; im[k] = Ai[k] + Brr[k]; if (k > 0 && k < N / 2) { re[k2] = Ar[k] + Bii[k]; im[k2] = -Ai[k] + Brr[k]; } } fft(re, im, true); };
        const loc = (f - b0) * HOP;
        pack(Dlr, Dli, Drr, Dri); for (let i = 0; i < N; i++) { const p = loc + i; if (p < acc[0].length) { acc[0][p] += re[i] * win[i]; acc[1][p] += im[i] * win[i]; } }
        pack(Br, Bi, Vr, Vi); for (let i = 0; i < N; i++) { const p = loc + i; if (p < acc[2].length) { acc[2][p] += re[i] * win[i]; acc[3][p] += im[i] * win[i]; } }
      }
      // flush finalised region [ (b0-1)*HOP , +B*HOP )
      const base = (b0 - 1) * HOP, names = ['drumsL', 'drumsR', 'bass', 'vox'];
      for (let a = 0; a < 4; a++) { const dst = out[names[a]], src = acc[a]; for (let i = 0; i < B * HOP; i++) { const s = base + i; if (s < 0 || s >= n) continue; const v = src[i] * 32767; dst[s] = v > 32767 ? 32767 : v < -32768 ? -32768 : v; } src.copyWithin(0, B * HOP, (B + 1) * HOP); src.fill(0, HOP); }
      if (progress) progress(Math.min(1, b1 / F)); await new Promise(r => setTimeout(r, 0));
    }
    out.otherL = new Int16Array(n); out.otherR = new Int16Array(n);
    for (let i = 0; i < n; i++) { const a = Math.round(L[i] * 32767) - out.drumsL[i] - out.bass[i] - out.vox[i], b = Math.round(R[i] * 32767) - out.drumsR[i] - out.bass[i] - out.vox[i]; out.otherL[i] = a > 32767 ? 32767 : a < -32768 ? -32768 : a; out.otherR[i] = b > 32767 ? 32767 : b < -32768 ? -32768 : b; }
    return { stems: out, feat };
  }
  return { run, N, HOP };
}
