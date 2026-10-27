/* ============================================================
   Part 04 · analysis & research layer: YIN f0, chroma/chord, key, onsets, timing, stats, latency lab
   ============================================================ */
function yin(buf, sr, thresh = .12) {
  const dec = sr >= 32000 ? 2 : 1, n = Math.floor(buf.length / dec), x = new Float32Array(n), fs = sr / dec;
  for (let i = 0; i < n; i++) x[i] = dec === 2 ? (buf[2 * i] + buf[2 * i + 1]) * .5 : buf[i];
  const W = n >> 1, tauMax = Math.min(W - 2, Math.floor(fs / 45)), tauMin = Math.max(2, Math.floor(fs / 1400)), d = new Float32Array(tauMax + 2);
  for (let tau = 1; tau <= tauMax; tau++) { let s = 0; for (let i = 0; i < W; i++) { const t = x[i] - x[i + tau]; s += t * t; } d[tau] = s; }
  let run = 0; d[0] = 1; for (let tau = 1; tau <= tauMax; tau++) { run += d[tau]; d[tau] = d[tau] * tau / (run || 1); }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) if (d[t] < thresh) { while (t + 1 <= tauMax && d[t + 1] < d[t]) t++; tau = t; break; }
  if (tau < 0) { let mn = 1e9, mi = -1; for (let t = tauMin; t <= tauMax; t++) if (d[t] < mn) { mn = d[t]; mi = t; } if (mn > .3 || mi < 0) return null; tau = mi; }
  const a = d[tau - 1], b = d[tau], c = d[tau + 1], den = 2 * (a - 2 * b + c), sh = den ? clamp((a - c) / den, -1, 1) : 0;
  return { f: fs / (tau + sh), clarity: clamp(1 - d[tau], 0, 1) };
}
const KS_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], KS_MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
function corr(a, b) { const ma = mean(a), mb = mean(b); let n = 0, da = 0, db = 0; for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return n / Math.sqrt(da * db || 1); }
function detectKey(h) {
  const res = []; for (let r = 0; r < 12; r++) { const rot = i => h[(r + i) % 12]; const v = Array.from({ length: 12 }, (_, i) => rot(i)); res.push({ root: r, minor: false, r: corr(v, KS_MAJ) }, { root: r, minor: true, r: corr(v, KS_MIN) }); }
  res.sort((a, b) => b.r - a.r); return res;
}
const CT = [['', [0, 4, 7]], ['m', [0, 3, 7]], ['7', [0, 4, 7, 10]], ['maj7', [0, 4, 7, 11]], ['m7', [0, 3, 7, 10]], ['sus4', [0, 5, 7]], ['sus2', [0, 2, 7]], ['dim', [0, 3, 6]], ['5', [0, 7]]];
function detectChord(ch) {
  let tot = 0; for (let i = 0; i < 12; i++) tot += ch[i]; if (tot < 1e-9) return [];
  const out = [];
  for (let r = 0; r < 12; r++) for (const [q, iv] of CT) {
    let s = 0, tn = 0; for (let i = 0; i < 12; i++) { const t = iv.includes(((i - r) + 12) % 12) ? (i === r ? 1.25 : 1) : 0; s += ch[i] * t; tn += t * t; }
    let n2 = 0; for (let i = 0; i < 12; i++) n2 += ch[i] * ch[i];
    out.push({ sym: pcName(r) + q, root: r, q, score: s / (Math.sqrt(tn) * Math.sqrt(n2) || 1) - (q === '5' ? .06 : q === 'sus2' || q === 'sus4' ? .03 : 0) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}

const AN = { rms: -120, peak: -120, crest: 0, f0: 0, cents: 0, midi: null, clarity: 0, centroid: 0, rolloff: 0, flat: 0, hfr: null, chord: [], chroma: new Float32Array(12), key: null, vib: null, clip: false, onsetT: 0, noteStable: 0, active: false };
const STAT = { t0: performance.now(), activeS: 0, notes: 0, pcDur: new Array(12).fill(0), pcN: new Array(12).fill(0), oct: {}, noteCents: [], timing: [], rows: [], rmsHist: [], centsHist: [], noise: [], actRms: [], onsets: 0, clipF: 0, fuseT: 0, fuseA: 0, frames: [], hfr: [], vibN: 0 };
let tdBuf = null, fdBuf = null, CUR = null, cand = null, lostN = 0, f0q = [], centsRing = [], clipRun = 0, steadyRun = 0, anaN = 0;
const CAP = { on: false, count: 0, lastFret: 5, lastSt: 3 };
const VIS = { cands: [], active: false };

function anaTick() {
  if (!E.ready || !E.hasInput) return; const sr = E.ctx.sampleRate; anaN++;
  if (!tdBuf) { tdBuf = new Float32Array(E.anaDI.fftSize); fdBuf = new Float32Array(E.anaChroma.frequencyBinCount); }
  E.anaDI.getFloatTimeDomainData(tdBuf); let pk = 0, e = 0; for (let i = 0; i < tdBuf.length; i++) { const v = tdBuf[i], a = Math.abs(v); if (a > pk) pk = a; e += v * v; }
  const rms = Math.sqrt(e / tdBuf.length); AN.rms = dB(rms); AN.peak = dB(pk); AN.crest = pk / (rms || 1e-9); AN.clip = pk > .985;
  clipRun = AN.clip ? clipRun + 1 : 0; if (clipRun === 30) { toast('Input is clipping — reduce the interface gain or the trim', 'warn'); STAT.clipF++; }
  const act = AN.rms > (CFG.gateDb != null ? CFG.gateDb : -56); AN.active = act;
  let f = 0, cl = 0;
  if (act) { const r = yin(tdBuf, sr); if (r) { f = r.f; cl = r.clarity; } }
  AN.clarity = cl;
  if (f > 60 && f < 1400 && cl > .8) {
    f0q.push(f); if (f0q.length > 3) f0q.shift(); const fm = median(f0q); AN.f0 = fm; const m = ftom(fm), r = Math.round(m); AN.cents = (m - r) * 100; AN.midi = r;
    centsRing.push(AN.cents); if (centsRing.length > 48) centsRing.shift();
    if (cand && cand.midi === r) cand.n++; else cand = { midi: r, n: 1, t: E.ctx.currentTime }; lostN = 0;
    if (cand.n === 3 && (!CUR || CUR.midi !== r)) noteOn(r);
    if (CUR && CUR.midi === r) { CUR.cs.push(AN.cents); CUR.n++; }
    steadyRun = (CUR && cl > .93 && AN.rms > -14) ? steadyRun + 1 : 0;
    if (steadyRun === 60 && CFG.monitor && !T.playing) { setMonitor(false); toast('Sustained tone with monitoring on — monitor muted to stop possible feedback', 'warn'); steadyRun = 0; }
  } else { if (++lostN > 4) { AN.f0 = 0; AN.midi = null; f0q = []; if (CUR) noteOff(); cand = null; centsRing = []; AN.vib = null; } }
  if (!act && CUR) noteOff();
  if (AN.f0 && centsRing.length >= 24) vibrato();
  if (anaN % 3 === 0) spectral(sr);
  if (anaN % 3 === 0) sample();
  if (typeof voxTick === 'function') voxTick();
}
function vibrato() {
  const a = centsRing, n = a.length, k = 12, hp = a.map((v, i) => { let s = 0, c = 0; for (let j = Math.max(0, i - k); j <= Math.min(n - 1, i + k); j++) { s += a[j]; c++; } return v - s / c; });
  let z = 0; for (let i = 1; i < n; i++) if ((hp[i - 1] < 0) !== (hp[i] < 0)) z++;
  const rate = z / 2 / (n / 30), ext = (Math.max(...hp) - Math.min(...hp)) / 2;
  AN.vib = (rate >= 3.5 && rate <= 9.5 && ext > 6) ? { rate, ext } : null; if (AN.vib) STAT.vibN++;
}
function noteOn(m) {
  if (CUR) noteOff(); const t = E.ctx.currentTime, onT = (t - AN.onsetT < .3 && AN.onsetT > 0) ? AN.onsetT : t - .05;
  CUR = { midi: m, t0: t, onT, cs: [], n: 0, rms: AN.rms, cam: (VIS.active ? VIS.cands.filter(c => performance.now() - c.t < 500).map(c => ({ st: c.st, fret: c.fret })) : []) }; STAT.notes++; STAT.pcN[m % 12]++; const o = Math.floor(m / 12) - 1; STAT.oct[o] = (STAT.oct[o] || 0) + 1;
  bus.emit('note', { midi: m, t: onT });
  if (VIS.active) { const rec = VIS.cands.filter(c => performance.now() - c.t < 500); STAT.fuseT++; const open = S.tuning.some(o => o + S.capo === m); if (rec.some(c => c.midi === m) || (open && !rec.some(c => c.st === S.tuning.findIndex(o => o + S.capo === m)))) STAT.fuseA++; }
  if (CAP.on && T.playing) captureNote(m, onT);
}
function noteOff() {
  const c = CUR; CUR = null; if (!c) return; const dur = E.ctx.currentTime - c.t0; STAT.pcDur[c.midi % 12] += dur; heatLive(c, dur);
  const cs = c.cs.slice(Math.floor(c.cs.length * .25)); if (cs.length > 4) STAT.noteCents.push({ midi: c.midi, mean: mean(cs), sd: sd(cs), abs: mean(cs.map(Math.abs)) });
  if (STAT.pcN.reduce((a, b) => a + b, 0) >= 8) { const k = detectKey(STAT.pcDur.map((d, i) => d + STAT.pcN[i] * .15)); AN.key = k.slice(0, 3); }
  bus.emit('noteoff', c);
}
function spectral(sr) {
  E.anaChroma.getFloatFrequencyData(fdBuf); const bh = sr / E.anaChroma.fftSize, ch = new Float32Array(12); let sw = 0, sm = 0, tot = 0, lg = 0, nb = 0;
  const k0 = Math.max(1, Math.floor(70 / bh)), k1 = Math.min(fdBuf.length - 1, Math.floor(6000 / bh)), mag = new Float32Array(k1 + 2);
  for (let k = k0; k <= k1; k++) { const dbv = fdBuf[k]; const m = dbv < -92 ? 0 : Math.pow(10, dbv / 20); mag[k] = m; const f = k * bh; sw += f * m; sm += m; if (f > 100) { lg += Math.log(m + 1e-9); nb++; } if (f < 2200 && m > 0) { const pc = ((Math.round(ftom(f)) % 12) + 12) % 12; ch[pc] += m * m; } tot += m; }
  if (sm > 0) { AN.centroid = sw / sm; let acc = 0; for (let k = k0; k <= k1; k++) { acc += mag[k]; if (acc >= .85 * sm) { AN.rolloff = k * bh; break; } } AN.flat = Math.exp(lg / Math.max(1, nb)) / (tot / Math.max(1, k1 - k0 + 1) + 1e-12); } else { AN.centroid = AN.rolloff = AN.flat = 0; }
  let en = 0; for (let i = 0; i < 12; i++) en += ch[i]; for (let i = 0; i < 12; i++) AN.chroma[i] = AN.chroma[i] * .65 + (en > 0 ? ch[i] / Math.sqrt(en) : 0) * .35;
  AN.chord = AN.active ? detectChord(AN.chroma) : [];
  if (AN.f0 && AN.clarity > .9) { const A = i => { const k = Math.round(AN.f0 * i / bh); let m = 0; for (let j = k - 2; j <= k + 2; j++) if (mag[j] > m) m = mag[j]; return m; }; const a1 = A(1); if (a1 > 0) { let s = 0; for (let i = 2; i <= 6; i++) { const a = A(i); s += a * a; } AN.hfr = 20 * Math.log10(Math.sqrt(s) / a1 + 1e-9); STAT.hfr.push(AN.hfr); if (STAT.hfr.length > 600) STAT.hfr.shift(); } } else AN.hfr = null;
}
function sample() {
  const t = (performance.now() - STAT.t0) / 1000; STAT.rows.push({ t, rms: AN.rms, peak: AN.peak, f0: AN.f0, cents: AN.cents, midi: AN.midi, centroid: AN.centroid, hfr: AN.hfr });
  if (STAT.rows.length > 12000) STAT.rows.shift(); STAT.rmsHist.push(AN.rms); if (STAT.rmsHist.length > 240) STAT.rmsHist.shift();
  STAT.centsHist.push(AN.f0 ? AN.cents : null); if (STAT.centsHist.length > 240) STAT.centsHist.shift();
  if (AN.active) { STAT.activeS += .1; STAT.actRms.push(AN.rms); if (STAT.actRms.length > 3000) STAT.actRms.shift(); } else if (AN.rms < -45) { STAT.noise.push(AN.rms); if (STAT.noise.length > 600) STAT.noise.shift(); }
}
bus.on('tap:di', m => anOnset(m, 'g'));
bus.on('tap:vox', m => anOnset(m, 'v'));
function anOnset(m, who) {
  if (!m.onset) return; const f = CFG.anSrc || 'g'; if (f !== 'b' && f !== who) return; AN.onsetT = m.t; STAT.onsets++; bus.emit('onset', m);
  if (T.playing && T.q.length) {
    const g = 16 / (CFG.timingGrid || 4) / 4 || 1, want = CFG.timingGrid || 2; /* grid: slots per grid step */
    const step = want === 4 ? 1 : want === 2 ? 2 : 4, tt = m.t - rttMs() / 1000; let best = null, bd = 1e9;
    for (const e of T.q) { if (e.slot < 0 || e.slot % step) continue; const d = tt - e.time; if (Math.abs(d) < Math.abs(bd)) { bd = d; best = e; } }
    if (best && Math.abs(bd) < slotDur() * step * .5) { STAT.timing.push(bd * 1000); if (STAT.timing.length > 800) STAT.timing.shift(); bus.emit('timing', bd * 1000); }
  }
}
function statsSnapshot() {
  const ca = STAT.noteCents.map(n => n.abs), tm = STAT.timing;
  return { notes: STAT.notes, centsAbs: ca.length ? +mean(ca).toFixed(1) : null, timingMean: tm.length ? +mean(tm).toFixed(1) : null, timingSD: tm.length > 2 ? +sd(tm).toFixed(1) : null, key: AN.key ? pcName(AN.key[0].root) + (AN.key[0].minor ? 'm' : '') : null };
}
function resetStats() { Object.assign(STAT, { t0: performance.now(), activeS: 0, notes: 0, pcDur: new Array(12).fill(0), pcN: new Array(12).fill(0), oct: {}, noteCents: [], timing: [], rows: [], rmsHist: [], centsHist: [], noise: [], actRms: [], onsets: 0, clipF: 0, fuseT: 0, fuseA: 0, hfr: [], vibN: 0 }); AN.key = null; bus.emit('stats:reset'); }
function statsCSV() {
  const L = ['t_s,rms_dbfs,peak_dbfs,f0_hz,cents,midi,centroid_hz,hfr_db']; STAT.rows.forEach(r => L.push([r.t.toFixed(2), r.rms.toFixed(1), r.peak.toFixed(1), r.f0 ? r.f0.toFixed(2) : '', r.f0 ? r.cents.toFixed(1) : '', r.midi == null ? '' : r.midi, r.centroid ? r.centroid.toFixed(0) : '', r.hfr == null ? '' : r.hfr.toFixed(1)].join(','))); return L.join('\n');
}

/* ---------- tab capture: audio (+ camera fusion) → string/fret assignment ---------- */
function assignFret(midi) {
  const cs = []; S.tuning.forEach((o, st) => { const f = midi - o - S.capo; if (f >= 0 && f <= 24) cs.push({ st, f }); });
  if (!cs.length) return null; const now = performance.now();
  cs.forEach(c => {
    c.cost = Math.abs(c.f - CAP.lastFret) * 1.0 + (c.f > 12 ? 3 : 0) + Math.abs(c.st - CAP.lastSt) * .35 - (c.f === 0 ? .6 : 0);
    if (VIS.active && VIS.cands.some(v => now - v.t < 450 && v.st === c.st && v.fret === c.f)) c.cost -= 6;
  });
  cs.sort((a, b) => a.cost - b.cost); return cs[0];
}
function captureNote(midi, onT) {
  const a = assignFret(midi); if (!a) return; const tt = onT - rttMs() / 1000, slot = Math.round(slotAtTime(tt)), sp = spb(), bi = Math.floor(slot / sp), sib = slot - bi * sp, fb = barsCache()[bi];
  if (!fb || slot < 0) return; fb.bar.tab = fb.bar.tab.filter(n => !(n.s === sib && n.st === a.st)); fb.bar.tab.push({ s: sib, st: a.st, f: a.f, t: '' });
  CAP.lastFret = a.f > 0 ? a.f : CAP.lastFret; CAP.lastSt = a.st; CAP.count++; commit(false);
}

/* ---------- latency lab: loopback round-trip measurement by chirp cross-correlation ---------- */
async function measureRTT() {
  await startAudio(); if (!E.hasInput) { toast('Open an audio input first', 'bad'); return null; }
  const c = E.ctx, sr = c.sampleRate, cn = Math.floor(sr * .008), buf = c.createBuffer(1, cn, sr), d = buf.getChannelData(0);
  for (let i = 0; i < cn; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * (800 * t + (7000 - 800) / (2 * .008) * t * t)) * (.5 - .5 * Math.cos(2 * Math.PI * i / (cn - 1))); }
  const blocks = []; const on = m => { if (!m.onset) blocks.push({ t: m.t, l: m.l }); }; LAB.fn = on; E.tapDI.on(true);
  const T0 = c.currentTime + .4, N = 6; for (let k = 0; k < N; k++) { const s = c.createBufferSource(); s.buffer = buf; s.connect(E.testOut); s.start(T0 + k * .5); }
  toast('Measuring round-trip latency… keep Line Out looped to Input (or a mic near the speaker)');
  await new Promise(r => setTimeout(r, 4600)); E.tapDI.on(false); LAB.fn = null;
  if (!blocks.length) { toast('No audio captured', 'bad'); return null; }
  const t0 = blocks[0].t, x = cat(blocks.map(b => b.l)), res = [];
  for (let k = 0; k < N; k++) {
    const tk = T0 + k * .5, s0 = Math.max(0, Math.floor((tk - t0 - .005) * sr)), s1 = Math.min(x.length - cn, Math.floor((tk - t0 + .25) * sr)); if (s1 <= s0) continue;
    let best = 0, bi = -1, sum = 0, cnt = 0;
    for (let i = s0; i < s1; i++) { let a = 0; for (let j = 0; j < cn; j += 1) a += x[i + j] * d[j]; const aa = Math.abs(a); sum += aa; cnt++; if (aa > best) { best = aa; bi = i; } }
    if (bi < 0 || best < 6 * (sum / cnt) || best < .02) continue;
    let sub = 0; { const a = Math.abs(corrAt(x, d, bi - 1, cn)), b = best, cc = Math.abs(corrAt(x, d, bi + 1, cn)), den = 2 * (a - 2 * b + cc); sub = den ? clamp((a - cc) / den, -.5, .5) : 0; }
    res.push(((t0 + (bi + sub) / sr) - tk) * 1000);
  }
  if (res.length < 3) { toast('Loopback not detected. Connect Line Out → Input 1 (or hold a mic near the speaker) and raise the input gain.', 'bad'); return null; }
  const m = median(res), s = sd(res); CFG.rtt = +m.toFixed(2); saveCfg(); bus.emit('latency', { m, s, n: res.length, all: res }); toast('Round-trip latency ' + m.toFixed(1) + ' ms (σ ' + s.toFixed(2) + ' ms) — applied to recording alignment', 'ok'); return { m, s, n: res.length };
}
const LAB = { fn: null }; bus.on('tap:di', m => { if (LAB.fn) LAB.fn(m); });
function corrAt(x, d, i, cn) { if (i < 0 || i + cn > x.length) return 0; let a = 0; for (let j = 0; j < cn; j++) a += x[i + j] * d[j]; return a; }
