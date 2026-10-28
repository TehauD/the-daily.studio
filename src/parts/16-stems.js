/* ============================================================
   Part 16 · STEMS — load a backing track, separate it into drums / bass / vocals / guitar & keys (all offline,
   in a worker), identify which instruments are present and when, find tempo · key · chords · drum groove,
   play it back with per-stem mute / solo (jam along with a stem removed), and export the stems.
   ============================================================ */
const STMS = [['drums', 'Drums', '#e4572e'], ['bass', 'Bass', '#8a5cf5'], ['vox', 'Vocals', '#ff5fa2'], ['other', 'Guitar · keys · other', '#0a9aa6']];
const STM = { name: '', title: '', artist: '', n: 0, sr: 44100, dur: 0, ch: null, feat: null, an: null, env: null, busy: false, prog: 0, mix: STMS.map(() => ({ g: 1, m: false, s: false })), loop: { on: false, a: null, b: null }, beatShift: 0, tempoMul: 1 };
const STP = { bus: null, sg: [], playing: false, segs: [], cur: 0, curT: 0, timer: 0, pos: 0 };
const fmtT = s => { s = Math.max(0, s); return Math.floor(s / 60) + ':' + ('0' + Math.floor(s % 60)).slice(-2); };

/* ---------- separation (worker with main-thread fallback) ---------- */
async function stemSeparate(L, R, sr, onP) {
  const src = `const D=(${stemDSPFactory.toString()})();onmessage=async e=>{const d=e.data;const r=await D.run(d.L,d.R,d.sr,d.opt,p=>postMessage({p}));const tr=Object.values(r.stems).map(a=>a.buffer);tr.push(r.feat.chroma.buffer);for(const k in r.feat)if(r.feat[k] instanceof Float32Array&&k!=='chroma')tr.push(r.feat[k].buffer);postMessage({done:true,stems:r.stems,feat:r.feat},tr)};`;
  try {
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' })), w = new Worker(url);
    return await new Promise((res, rej) => { w.onmessage = e => { if (e.data.p != null) onP(e.data.p); else if (e.data.done) { w.terminate(); URL.revokeObjectURL(url); res({ stems: e.data.stems, feat: e.data.feat }); } }; w.onerror = e => { w.terminate(); rej(new Error(e.message || 'worker failed')); }; w.postMessage({ L, R, sr, opt: {} }, [L.buffer, R.buffer]); });
  } catch (err) { console.warn('[stems] worker unavailable, running on the main thread', err); return stemDSPFactory().run(L, R, sr, {}, onP); }
}

/* ---------- identification + tempo / key / chords / groove ---------- */
function stemAnalyze(feat, sr, dur) {
  const F = feat.F, fps = sr / feat.hop, W = Math.max(1, Math.round(fps * .5)), nW = Math.floor(F / W), db = x => 10 * Math.log10(x + 1e-12), sm = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const E4 = [feat.eD, feat.eB, feat.eV, feat.eO], winE = E4.map(e => { const o = new Float32Array(nW); for (let w = 0; w < nW; w++) { let s = 0; for (let f = w * W; f < (w + 1) * W; f++) s += e[f]; o[w] = s / W; } return o; });
  const winBS = new Float32Array(nW); for (let w = 0; w < nW; w++) { let a = 0; for (let f = w * W; f < (w + 1) * W; f++) a += feat.bS[f]; winBS[w] = a / W; }
  const winSV = new Float32Array(nW), winPK = new Float32Array(nW); for (let w = 0; w < nW; w++) { let a = 0, b = 0; for (let f = w * W; f < (w + 1) * W; f++) { a += feat.sV[f]; b += feat.pk[f]; } winSV[w] = a / W; winPK[w] = b / W; }
  const tot = winE.map(e => e.reduce((a, b) => a + b, 0)), grand = tot.reduce((a, b) => a + b, 1e-12);
  const dbs = winE.map(e => Array.from(e, v => db(v))), gref = Math.max(...dbs.map(d => [...d].sort((a, b) => a - b)[Math.floor(d.length * .95)] || -60));
  const pres = dbs.map((d, i) => Float32Array.from(d, (v, w) => { let p = sm(v - (gref - 21), 0, 10); if (i === 2) p *= sm(winSV[w], .14, .42); if (i === 1) p *= sm(winBS[w], .2, .32); return p; }));
  const info = STMS.map(([id, name], i) => {
    const p = pres[i], cov = p.filter(x => x > .5).length / Math.max(1, nW); let first = -1, run = 0; for (let w = 0; w < nW; w++) { run = p[w] > .5 ? run + 1 : 0; if (run >= 3) { first = (w - 2) * W / fps; break; } }
    const share = tot[i] / grand, mp = p.filter(x => x > .5); const conf = mp.length ? mp.reduce((a, b) => a + b, 0) / mp.length : 0;
    return { id, name, cov, first, share, level: db(tot[i] / Math.max(1, nW)), found: cov > .08 && share > .004, strength: cov > .6 && conf > .75 ? 'strong' : cov > .25 ? 'clear' : cov > .08 ? 'faint' : 'none' };
  });
  info[3].kind = '';
  /* tempo: onset envelope → comb-filter scan with a mild prior around 110 BPM */
  let oe = new Float32Array(F), dr = feat.eD.reduce((a, b) => a + b, 0) / (feat.eA.reduce((a, b) => a + b, 1e-12));
  for (let f = 1; f < F; f++) oe[f] = (dr > .04 ? feat.fk[f] * .8 + feat.fs[f] + feat.fh[f] * .6 : 0) + Math.max(0, Math.sqrt(feat.eA[f]) - Math.sqrt(feat.eA[f - 1])) * (dr > .04 ? .3 : 1);
  { const m = new Float32Array(F), hw = Math.round(fps * .5); let s = 0; for (let f = 0; f < F; f++) { s += oe[f]; if (f >= 2 * hw) s -= oe[f - 2 * hw]; m[f] = s / Math.min(f + 1, 2 * hw); } let mx = 1e-9; for (let f = 0; f < F; f++) { oe[f] = Math.max(0, oe[f] - m[f] * 1.1); mx = Math.max(mx, oe[f]); } for (let f = 0; f < F; f++) oe[f] /= mx; }
  const at = x => { const i = Math.floor(x), fr = x - i; return i < 0 || i + 1 >= F ? 0 : oe[i] * (1 - fr) + oe[i + 1] * fr; };
  let best = { s: -1 }, sum = 0, cnt = 0; const scores = [];
  for (let bpm = 60; bpm <= 190; bpm += .25) { const per = fps * 60 / bpm; let bs = 0, bph = 0; for (let ph = 0; ph < 16; ph++) { const p0 = per * ph / 16; let s = 0, c = 0; for (let x = p0; x < F - 2; x += per) { s += at(x) + .5 * (at(x - 1) + at(x + 1)) * .5; c++; } s /= Math.max(1, c); if (s > bs) { bs = s; bph = p0; } }
    const prior = Math.exp(-Math.pow(Math.log2(bpm / 110), 2) / (2 * .75 * .75)); const sc = bs * (.6 + .4 * prior); scores.push(sc); sum += sc; cnt++; if (sc > best.s) best = { s: sc, bpm, ph: bph }; }
  /* refine phase at best bpm */
  { const per = fps * 60 / best.bpm; let bs = -1; for (let ph = 0; ph < 64; ph++) { const p0 = per * ph / 64; let s = 0, c = 0; for (let x = p0; x < F - 2; x += per) { s += at(x) + .5 * (at(x - 1) + at(x + 1)) * .5; c++; } s /= Math.max(1, c); if (s > bs) { bs = s; best.ph = p0; } } }
  const tempo = { bpm: best.bpm, conf: clamp((best.s / (sum / cnt) - 1) / 2.5, 0, 1), phase: best.ph / fps, oe, fps };
  /* chroma timeline */
  const chroma = feat.chroma, chAt = (f0, f1) => { const o = new Float32Array(12); for (let f = Math.max(0, f0); f < Math.min(F, f1); f++) for (let i = 0; i < 12; i++) o[i] += chroma[f * 12 + i]; return o; };
  const out = { fps, F, W, nW, pres, info, tempo, winSV, dur, chordBars: [], key: null, groove: null, down: 0 };
  stemBeatGrid(out, feat, chAt); return out;
}
/* beat grid → downbeat → per-bar chords → key → drum groove. Re-run when tempo / downbeat is nudged. */
function stemBeatGrid(an, feat, chAt) {
  chAt = chAt || ((f0, f1) => { const o = new Float32Array(12), c = feat.chroma; for (let f = Math.max(0, f0); f < Math.min(an.F, f1); f++) for (let i = 0; i < 12; i++) o[i] += c[f * 12 + i]; return o; });
  const fps = an.fps, bpm = an.tempo.bpm * STM.tempoMul, per = fps * 60 / bpm, beats = []; for (let x = an.tempo.phase * fps; x < an.F - per * .5; x += per) beats.push(x); const nb = beats.length;
  const norm = v => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) + 1e-9; return v.map(x => x / s); };
  const bch = beats.map((x, i) => chAt(Math.round(x + per * .12), Math.round(x + per * .95))), nrm = bch.map(norm);
  const win2 = (i, d) => { const o = new Float32Array(12); for (let j = i; j < i + 2; j++) { const q = bch[j + (d < 0 ? -2 : 0)]; if (q) for (let k = 0; k < 12; k++) o[k] += q[k]; } return norm(o); }, nov = bch.map((_, i) => i < 2 || i + 1 >= bch.length ? 0 : 1 - win2(i, 1).reduce((a, v, k) => a + v * win2(i, -1)[k], 0));
  let bd = 0, bs = -1; const kS = [0, 0, 0, 0], nS = [0, 0, 0, 0]; for (let i = 0; i < nb; i++) { const x = Math.round(beats[i]); kS[i % 4] += (feat.fk[x] || 0) + (feat.fk[x + 1] || 0); nS[i % 4] += nov[i]; } const kT = kS.reduce((a, v) => a + v, 1e-9), nT = nS.reduce((a, v) => a + v, 1e-9);
  for (let d = 0; d < 4; d++) { const s = kS[d] / kT + 1.6 * nS[d] / nT; if (s > bs) { bs = s; bd = d; } }
  bd = (bd + STM.beatShift + 400) % 4; an.down = bd; an.beats = beats; an.per = per; an.bpmEff = bpm;
  const pickTri = (res, prefer) => { if (!res.length) return null; let b = res[0]; for (const r of res) if ((r.q === '' || r.q === 'm') && r.score > b.score - .045) { b = r; break; } return b; };
  const bars = []; for (let i = bd; i + 3 < nb; i += 4) {
    const h1 = bch[i].map((v, k) => v + bch[i + 1][k]), h2 = bch[i + 2].map((v, k) => v + bch[i + 3][k]), all = h1.map((v, k) => v + h2[k]), ca = pickTri(detectChord(all)), c1 = pickTri(detectChord(h1)), c2 = pickTri(detectChord(h2));
    const two = c1 && c2 && c1.sym !== c2.sym && c1.score > .8 && c2.score > .8 && ca && (c1.score + c2.score) / 2 > ca.score + .03;
    bars.push({ i, t: beats[i] / fps, chord: two ? c1.sym + ' ' + c2.sym : (ca ? ca.sym : ''), conf: ca ? ca.score : 0, chroma: all });
  }
  an.chordBars = bars; const kh = new Array(12).fill(0); bars.forEach(b => b.chroma.forEach((v, k) => kh[k] += v)); an.key = bars.length ? detectKey(kh)[0] : null;
  /* drum groove: fold onsets onto a 16-slot bar */
  const rows = [feat.fk, feat.fs, feat.fh], sl = per / 4; let nBars = 0; const hit = rows.map(() => new Float32Array(16)), amp = rows.map(() => new Float32Array(16)), top = rows.map(r => { const a = Array.from(r).sort((x, y) => x - y); return a[Math.floor(a.length * .97)] || 1; });
  bars.forEach(b => { const e0 = b.i * 0 + beats[b.i]; if (an.pres[0][Math.min(an.nW - 1, Math.floor(e0 / an.W))] < .5) return; nBars++; for (let s = 0; s < 16; s++) { const x = e0 + s * sl; rows.forEach((r, ri) => { let m = 0; for (let f = Math.round(x - sl * .4); f <= Math.round(x + sl * .4); f++) m = Math.max(m, r[f] || 0); const v = m / top[ri]; if (v > .22) { hit[ri][s]++; amp[ri][s] += v; } }); } });
  an.groove = nBars >= 2 ? { nBars, rows: rows.map((_, ri) => Array.from(hit[ri], (h, s) => { const p = h / nBars, a = h ? amp[ri][s] / h : 0; return p < .5 ? 0 : a > .85 ? 3 : a > .45 ? 2 : 1; })) } : null;
}

/* ---------- player ---------- */
function spEnsure() { if (STP.bus) return; STP.bus = gn(1); STP.tfx = fxStrip(E.mix); STP.bus.connect(STP.tfx.in); STP.fx = STMS.map(() => fxStrip(STP.bus, { pan: true })); STP.sg = STMS.map((_, i) => { const g = gn(1); g.connect(STP.fx[i].in); return g; }); spGains(); spFx(); }
/** per-stem and whole-track strips: EQ, squeeze, reverb, echo and pan */
function spFx() { if (!STP.bus || !STP.fx) return; STP.tfx.set(STM.fx); STM.mix.forEach((m, i) => { STP.fx[i].set(m.fx); STP.fx[i].pan(m.p || 0); }); }
function spGains() { if (!STP.bus) return; const anyS = STM.mix.some(m => m.s); STM.mix.forEach((m, i) => { const aud = anyS ? m.s : !m.m; tc(STP.sg[i].gain, aud ? m.g : 0, .015); }); }
function spData(i) { const c = STM.ch; return i === 0 ? [c.drumsL, c.drumsR] : i === 1 ? [c.bass, c.bass] : i === 2 ? [c.vox, c.vox] : [c.otherL, c.otherR]; }
function spPos() { if (!STP.playing) return STP.pos; const now = E.ctx.currentTime; for (let i = STP.segs.length - 1; i >= 0; i--) { const s = STP.segs[i]; if (now >= s.t) return Math.min(s.from + (now - s.t), s.from + s.dur); } return STP.pos; }
function spStop() { STP.playing = false; clearInterval(STP.timer); STP.segs.forEach(s => s.srcs.forEach(o => { try { o.stop(); } catch (e) { } })); STP.segs = []; }
async function spPlay(when, from) {
  if (!STM.ch) return toast('Load a backing track first', 'warn'); await startAudio(); spEnsure(); if (STP.playing) spStop();
  const L = STM.loop.on && STM.loop.a != null && STM.loop.b != null; STP.cur = from != null ? from : (L && (STP.pos < STM.loop.a || STP.pos >= STM.loop.b) ? STM.loop.a : STP.pos); if (STP.cur >= STM.dur - .05) STP.cur = 0;
  { const now = E.ctx.currentTime; if (when && when < now + .01) { STP.cur += Math.max(0, now + .03 - when); when = now + .03; } STP.curT = when || now + .06; } STP.playing = true; spSched(); STP.timer = setInterval(spSched, 120); syncStemUI();
}
function spPause() { STP.pos = spPos(); spStop(); syncStemUI(); }
function spSeek(t) { t = clamp(t, 0, Math.max(0, STM.dur - .05)); const was = STP.playing; STP.pos = t; if (was) spPlay(null, t); else syncStemUI(); }
function spSched() {
  if (!STP.playing || !STM.ch) return; const c = E.ctx, sr = STM.sr, CH = 2.5; STP.segs = STP.segs.filter(s => s.t + s.dur > c.currentTime - 2);
  while (STP.curT < c.currentTime + 4.5) {
    const L = STM.loop.on && STM.loop.a != null && STM.loop.b != null && STM.loop.b - STM.loop.a > .2; let end = STP.cur + CH; if (L && STP.cur < STM.loop.b) end = Math.min(end, STM.loop.b); end = Math.min(end, STM.dur);
    const i0 = Math.floor(STP.cur * sr), i1 = Math.floor(end * sr), len = i1 - i0; if (len < 64) { if (L) { STP.cur = STM.loop.a; continue; } STP.playing = false; setTimeout(() => { if (!STP.playing) { STP.pos = 0; spStop(); syncStemUI(); } }, Math.max(0, (STP.curT - c.currentTime) * 1000)); return; }
    const seg = { t: STP.curT, from: STP.cur, dur: len / sr, srcs: [] };
    STMS.forEach((_, si) => { const d = spData(si), buf = c.createBuffer(2, len, sr); for (let ch = 0; ch < 2; ch++) { const o = buf.getChannelData(ch), s = d[ch]; for (let k = 0; k < len; k++) o[k] = s[i0 + k] / 32768; } const src = c.createBufferSource(); src.buffer = buf; src.connect(STP.sg[si]); src.start(STP.curT); seg.srcs.push(src); });
    STP.segs.push(seg); STP.curT += len / sr; STP.cur = end; if (L && STP.cur >= STM.loop.b - 1e-6) STP.cur = STM.loop.a; if (!L && STP.cur >= STM.dur - 1e-6) { STP.cur = STM.dur; }
  }
}

/* ---------- loading ---------- */
async function stemLoad(file, opt) {
  opt = opt || {}; if (STM.busy) return; if (!file) return; const tk = STM.ticket = (STM.ticket || 0) + 1; STM.file = file; STM._saved = !!opt.restore; if (!opt.restore) stmReset(); STM.busy = true; if (STP.playing) spPause(); STM.ch = null; STM.an = null; STM.env = null; STM.beatShift = 0; STM.tempoMul = 1; setStemStatus('Decoding ' + file.name + '…', 0);
  try {
    await startAudio(); const ab = await file.arrayBuffer(), buf = await E.ctx.decodeAudioData(ab); if (tk !== STM.ticket) return; let n = buf.length, sr = buf.sampleRate; const cap = Math.floor(sr * 600); if (n > cap) { n = cap; toast('Only the first 10 minutes are analysed', 'warn'); }
    const L = new Float32Array(n), R = new Float32Array(n); L.set(buf.getChannelData(0).subarray(0, n)); R.set((buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)).subarray(0, n));
    STM.name = file.name.replace(/\.[^.]+$/, ''); { const tg = readTags(ab), np = nameParts(file.name); STM.title = cleanTitle(tg.title || '') || np.title || STM.name; STM.artist = tg.artist || np.artist || ''; } STM.sr = sr; STM.n = n; STM.dur = n / sr; const t0 = performance.now();
    const r = await stemSeparate(L, R, sr, p => setStemStatus('Separating stems… ' + Math.round(p * 100) + '%  (' + fmtT(p * STM.dur) + ' of ' + fmtT(STM.dur) + ')', p));
    if (tk !== STM.ticket) return; STM.ch = r.stems; STM.feat = r.feat; setStemStatus('Identifying instruments…', 1); await new Promise(res => setTimeout(res, 20));
    STM.an = stemAnalyze(r.feat, sr, STM.dur); STM.env = stemEnvelopes(); STP.pos = 0; STM.loop = { on: false, a: null, b: null };
    setStemStatus('Done in ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s', 1); toast('Stems ready — ' + STM.an.info.filter(i => i.found).map(i => i.name.split(' ')[0]).join(', ') + ' found', 'ok');
    STM.busy = false; bus.emit('track');
    const fr = opt.restore ? null : stemAutofill(); if (opt.restore) toast('Track restored: “' + (STM.title || STM.name) + '”', 'ok'); if (fr) toast('“' + S.title + '” — ' + S.bpm.toFixed(0) + ' BPM, ' + pcName(S.key) + (S.minor ? ' minor' : ' major') + (fr.doChords ? ', ' + totalBars() + ' bars of chords added to the song' : fr.keepWork ? ' · your chords, tab and lyrics were kept (use Import chords to replace them)' : ''), 'ok');
  } catch (e) { if (tk !== STM.ticket) return; console.error(e); STM.file = null; setStemStatus('Could not read that file: ' + (e.message || e), 0); toast('Could not decode that audio file', 'warn'); }
  if (tk !== STM.ticket) return; STM.busy = false; renderStems(); bus.emit('track');
}
function stemUnload() {
  if (STP.playing) spStop(); STM.ch = null; STM.an = null; STM.env = null; STM.feat = null; STM.name = ''; STM.title = ''; STM.artist = ''; STM.dur = 0; STP.pos = 0; STM.loop = { on: false, a: null, b: null }; STM.file = null; STM._saved = false;
  setStemStatus('Drop an audio file here, or choose one →', 0); renderStems(); bus.emit('track'); TL.dirty = true;
}
function stemEnvelopes() { const Wd = 1600, n = STM.n, step = Math.max(1, Math.floor(n / Wd)), out = []; const get = [[STM.ch.drumsL, STM.ch.drumsR], [STM.ch.bass], [STM.ch.vox], [STM.ch.otherL, STM.ch.otherR]]; const mix = new Float32Array(Wd); for (let i = 0; i < 4; i++) { const e = new Float32Array(Wd); for (let x = 0; x < Wd; x++) { let m = 0; const a = x * step, b = Math.min(n, a + step); for (const ch of get[i]) for (let k = a; k < b; k += 3) { const v = Math.abs(ch[k]); if (v > m) m = v; } e[x] = m / 32768; mix[x] += e[x]; } out.push(e); } out.push(mix); return out; }

/* ---------- actions on the analysis ---------- */
function stemApplyTempo() { const an = STM.an; if (!an) return; vhSnap('before tempo', true); S.bpm = Math.round(an.bpmEff * 100) / 100; if (an.key) { S.key = an.key.root; S.minor = an.key.minor; S.scale = an.key.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)'; } commit(true); toast('Song set to ' + S.bpm.toFixed(1) + ' BPM' + (an.key ? ' · ' + pcName(an.key.root) + (an.key.minor ? ' minor' : ' major') : ''), 'ok'); }
function stemImportChords() {
  const an = STM.an; if (!an || !an.chordBars.length) return toast('No chords found yet', 'warn'); vhSnap('before import', true); S.bpm = Math.round(an.bpmEff * 100) / 100; S.ts = [4, 4]; if (an.key) { S.key = an.key.root; S.minor = an.key.minor; S.scale = an.key.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)'; }
  stemWriteChords(); S.title = STM.title || S.title; if (STM.artist && !S.artist) S.artist = STM.artist; S.track = { name: STM.title || STM.name, dur: +STM.dur.toFixed(1), bpm: S.bpm, chords: true }; T.cursor = 0; commit(true); toast('Imported ' + totalBars() + ' bars of chords into the song', 'ok');
}
function stemImportGroove() { const g = STM.an && STM.an.groove; if (!g) return toast('No steady drum pattern found', 'warn'); vhSnap('before groove', true); const pat = [g.rows[0], g.rows[1], g.rows[2], new Array(16).fill(0), new Array(16).fill(0), new Array(16).fill(0)]; S.band.pat = pat; S.band.patName = 'From “' + (STM.name || 'track').slice(0, 18) + '”'; S.band.drumsOn = true; commit(true); toast('Drum groove copied to the band (' + g.nBars + ' bars averaged)', 'ok'); }
async function stemTogether() { const an = STM.an; if (!an) return; stemApplyTempo(); const t0 = an.beats[an.down] / an.fps; if (T.playing) stopPlay(true); if (STP.playing) spPause(); T.cursor = 0; await startAudio(); await play(); const st = T.q.length ? T.q[0].time : E.ctx.currentTime + .1; STP.pos = t0; await spPlay(st, t0); toast('Track and band started together', 'ok'); }
function wavBlob(chs, sr) { const n = chs[0].length, b = new ArrayBuffer(44 + n * 4), v = new DataView(b), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0))); w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true); for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, chs[0][i], true); v.setInt16(46 + i * 4, chs[1][i], true); } return new Blob([b], { type: 'audio/wav' }); }
function stemExport(i) { const d = spData(i), a = h('a', { href: URL.createObjectURL(wavBlob(d, STM.sr)), download: (STM.name || 'track') + ' - ' + STMS[i][1].split(' ')[0].toLowerCase() + '.wav' }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }

/* ---------- pane ---------- */
const SU = {};
function setStemStatus(t, p) { if (SU.status) SU.status.textContent = t; if (SU.bar) { SU.bar.style.width = Math.round((p || 0) * 100) + '%'; SU.barw.style.display = STM.busy && p < 1 ? '' : 'none'; } }
function syncStemUI() { if (SU.play) SU.play.textContent = STP.playing ? '⏸' : '▶'; }
function buildStemsPane() {
  const p = PANES.stems; if (!p) return; p.classList.add('flex');
  const file = h('input', { type: 'file', accept: 'audio/*,.mp3,.wav,.flac,.m4a,.ogg', style: { display: 'none' }, onchange: e => { stemLoad(e.target.files[0]); e.target.value = ''; } });
  SU.status = h('span', { class: 'small muted' }, 'Drop an audio file here, or choose one →'); SU.bar = h('i', { style: { display: 'block', height: '100%', width: '0%', background: 'var(--accent)', transition: 'width .2s' } }); SU.barw = h('div', { style: { height: '4px', background: 'var(--panel2)', borderRadius: '4px', overflow: 'hidden', flex: '1 1 160px', maxWidth: '260px', display: 'none' } }, SU.bar);
  SU.play = h('button', { class: 'btn primary', style: { width: '44px' }, onclick: () => STP.playing ? spPause() : spPlay() }, '▶');
  SU.time = h('span', { class: 'mono small', style: { minWidth: '92px' } }, '0:00 / 0:00');
  const preset = (mutes) => { const bf = snap(); STM.mix.forEach((m, i) => { m.m = mutes.includes(i); m.s = false; }); spGains(); renderStemStrips(); histPush(bf); };
  SU.file = file; SU.top = h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', alignItems: 'center', margin: '0 0 8px' } }, h('button', { class: 'btn primary', onclick: () => file.click() }, '📂 Load backing track'), file, SU.barw, SU.status);
  SU.tr = h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'center', margin: '8px 0' } }, h('button', { class: 'btn', title: 'Back to start', onclick: () => spSeek(0) }, '⏮'), SU.play, SU.time,
    h('span', { class: 'tiny muted', style: { marginLeft: '6px', fontWeight: 800, letterSpacing: '.08em' } }, 'JAM'), h('button', { class: 'btn sm', title: 'Hear everything', onclick: () => preset([]) }, 'All'), h('button', { class: 'btn sm', title: 'Mute the guitar / keys stem so you can play that part', onclick: () => preset([3]) }, 'Play the guitar'), h('button', { class: 'btn sm', title: 'Mute the bass', onclick: () => preset([1]) }, 'Play the bass'), h('button', { class: 'btn sm', title: 'Mute the vocal (karaoke)', onclick: () => preset([2]) }, 'Karaoke'), h('button', { class: 'btn sm', title: 'Mute the drums', onclick: () => preset([0]) }, 'Drummer’s out'),
    h('span', { style: { flex: 1 } }), h('label', { class: 'chk small', style: { display: 'flex', gap: '4px', alignItems: 'center', fontWeight: 700 } }, h('input', { type: 'checkbox', onchange: e => { STM.loop.on = e.target.checked; if (STP.playing) spPlay(null, spPos()); } }), 'Loop'), h('button', { class: 'btn sm', title: 'Click lane to seek · Shift-click sets loop start · Alt-click sets loop end', onclick: () => { STM.loop = { on: STM.loop.on, a: null, b: null }; } }, 'Clear loop'));
  SU.cv = h('canvas', { style: { width: '100%', height: '100%', display: 'block', cursor: 'pointer' } }); SU.cvw = h('div', { style: { position: 'relative', height: 'clamp(150px,27vh,300px)', flex: 'none', background: '#050b0c', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--line)' } }, SU.cv);
  SU.strips = h('div', { style: { display: 'grid', gap: '6px', margin: '10px 0' } }); SU.info = h('div', { class: 'card', style: { padding: '12px', margin: '0 0 10px' } }); SU.music = h('div', { class: 'card', style: { padding: '12px' } });
  SU.empty = h('div', { class: 'card', style: { padding: '22px', textAlign: 'center', color: 'var(--muted)' } }, h('div', { style: { fontSize: '30px' } }, '🎚'), h('div', { style: { fontWeight: 800, margin: '4px 0' } }, 'Bring a song in'), h('div', { class: 'small' }, 'Load any audio file. It is split into drums, bass, vocals and guitar/keys on your machine — nothing is uploaded. You get which instruments are in it and when, the tempo, key and chords, the drum groove, and a player where you can mute a part and play it yourself.'), h('div', { class: 'tiny', style: { marginTop: '8px' } }, 'Use music you made or have the right to use. The stems, chords and tab are worked out from your file, so they are based on it.'));
  SU.samples = samplesShelf(f => stemLoad(f));
  p.append(h('div', { class: 'stm-wrap' }, SU.top, SU.samples, SU.empty, SU.tr, h('div', { class: 'stm-cols' }, h('div', { class: 'stm-l' }, SU.cvw, SU.strips), h('div', { class: 'stm-r' }, SU.info, SU.music)))); ['dragover', 'dragenter'].forEach(ev => p.addEventListener(ev, e => { e.preventDefault(); p.classList.add('dropt'); })); p.addEventListener('dragleave', () => p.classList.remove('dropt')); p.addEventListener('drop', e => { e.preventDefault(); p.classList.remove('dropt'); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) stemLoad(f); });
  new ResizeObserver(() => { const d = window.devicePixelRatio || 1, w = SU.cv.clientWidth, hh = SU.cv.clientHeight; if (w && (SU.cv.width !== Math.floor(w * d) || SU.cv.height !== Math.floor(hh * d))) { SU.cv.width = Math.floor(w * d); SU.cv.height = Math.floor(hh * d); } }).observe(SU.cv);
  SU.cv.addEventListener('pointerdown', e => { if (!STM.ch) return; const r = SU.cv.getBoundingClientRect(), t = clamp((e.clientX - r.left) / r.width, 0, 1) * STM.dur; if (e.shiftKey) { STM.loop.a = t; if (STM.loop.b == null || STM.loop.b <= t) STM.loop.b = Math.min(STM.dur, t + 8); STM.loop.on = true; } else if (e.altKey) { STM.loop.b = t; if (STM.loop.a == null || STM.loop.a >= t) STM.loop.a = Math.max(0, t - 8); STM.loop.on = true; } else spSeek(t); });
  renderStems();
}
function renderStems() {
  if (!SU.strips) return; const has = !!STM.ch; [SU.tr, SU.cvw, SU.strips, SU.info, SU.music].forEach(e => e.style.display = has ? '' : 'none'); SU.empty.style.display = has ? 'none' : ''; if (!has) return;
  SU.status.textContent = STM.name + '  ·  ' + fmtT(STM.dur) + '  ·  ' + (STM.sr / 1000).toFixed(1) + ' kHz'; renderStemStrips(); renderStemInfo();
}
function renderStemStrips() {
  const s = SU.strips; s.innerHTML = ''; const an = STM.an;
  STMS.forEach(([id, name, col], i) => {
    const m = STM.mix[i], inf = an && an.info[i], mb = (l, k, t) => h('button', { class: 'btn sm' + (m[k] ? ' on' : ''), style: { width: '30px', padding: '0' }, title: t, onclick: () => { const bf = snap(); m[k] = !m[k]; spGains(); renderStemStrips(); histPush(bf); } }, l);
    s.append(h('div', { class: 'row', style: { gap: '10px', alignItems: 'center', padding: '6px 10px', background: 'var(--panel2)', borderRadius: '10px', opacity: (m.m && !STM.mix.some(x => x.s)) || (STM.mix.some(x => x.s) && !m.s) ? .5 : 1 } },
      h('i', { style: { width: '10px', height: '10px', borderRadius: '50%', background: col, flex: 'none' } }), h('b', { style: { width: '150px', fontSize: '13px' } }, name),
      h('span', { class: 'tiny', style: { width: '170px', color: inf && inf.found ? 'var(--text)' : 'var(--muted)' } }, inf ? (inf.found ? inf.strength + ' · ' + Math.round(inf.cov * 100) + '% of track' + (inf.first > 1 ? ' · enters ' + fmtT(inf.first) : '') : 'not detected') : ''),
      mb('M', 'm', 'Mute'), mb('S', 's', 'Solo'), h('input', { type: 'range', min: 0, max: 1.5, step: .01, value: m.g, style: { flex: 1, maxWidth: '260px' }, oninput: e => { histBegin(); m.g = +e.target.value; spGains(); stmDirty(); }, onchange: () => { histEnd(); } }), h('button', { class: 'btn sm', title: 'Download this stem as a WAV', onclick: () => stemExport(i) }, '⤓ WAV')));
  });
}
function renderStemInfo() {
  const an = STM.an; if (!an) return; const f = an.info, lines = f.filter(x => x.found).map(x => `<b style="color:${STMS.find(s => s[0] === x.id)[2]}">${x.name}</b> <span class="muted">${x.strength}${x.first > 1 ? ' · enters ' + fmtT(x.first) : ' · from the start'}${x.kind ? ' · ' + x.kind : ''}</span>`), miss = f.filter(x => !x.found).map(x => x.name);
  SU.info.innerHTML = '<h4 style="margin:0 0 6px">What’s in this track</h4>' + (lines.length ? lines.map(l => '<div class="small" style="padding:2px 0">' + l + '</div>').join('') : '<div class="small muted">Nothing clearly pitched or percussive was found.</div>') + (miss.length ? '<div class="tiny muted" style="margin-top:4px">Not detected: ' + miss.join(', ') + '</div>' : '') + '<div class="tiny muted" style="margin-top:6px">Separation is signal-processing based (percussive/harmonic split, bass harmonic comb, centred-voice mask). It’s good for finding and muting parts to play along; it is not studio-clean, and the vocal stem is a centre-channel voice estimate.</div>';
  const k = an.key, g = an.groove; SU.music.innerHTML = '';
  const kv = (a, b) => h('div', { class: 'kv', style: { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '3px 0', borderBottom: '1px solid var(--line)' } }, h('span', { class: 'muted' }, a), h('b', { class: 'mono' }, b));
  const cbar = h('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap', maxHeight: '140px', overflow: 'auto', margin: '8px 0' } }, an.chordBars.map((b, i) => h('button', { class: 'btn sm', style: { fontFamily: 'var(--mono)', minWidth: '52px' }, title: 'Bar ' + (i + 1) + ' · ' + fmtT(b.t), onclick: () => spSeek(b.t) }, b.chord || '—')));
  const nudge = (l, t, fn) => h('button', { class: 'btn sm', title: t, onclick: () => { fn(); stemBeatGrid(an, STM.feat); renderStemInfo(); } }, l);
  SU.music.append(h('h4', { style: { margin: '0 0 6px' } }, 'Tempo · key · chords · groove'),
    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '0 24px' } }, kv('Tempo', an.bpmEff.toFixed(1) + ' BPM  (' + Math.round(an.tempo.conf * 100) + '% sure)'), kv('Key', k ? pcName(k.root) + (k.minor ? ' minor' : ' major') + '  (r=' + k.r.toFixed(2) + ')' : '—'), kv('Bars found', an.chordBars.length + '  (assuming 4/4)'), kv('Drum groove', g ? g.nBars + ' bars averaged' : 'no steady pattern')),
    h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap', margin: '8px 0 0' } }, nudge('½ tempo', 'If it found double-time', () => { STM.tempoMul = clamp(STM.tempoMul / 2, .25, 4); }), nudge('2× tempo', 'If it found half-time', () => { STM.tempoMul = clamp(STM.tempoMul * 2, .25, 4); }), nudge('‹ downbeat', 'Move bar line one beat earlier', () => { STM.beatShift--; }), nudge('downbeat ›', 'Move bar line one beat later', () => { STM.beatShift++; }), nudge('reset', 'Back to the automatic result', () => { STM.beatShift = 0; STM.tempoMul = 1; })),
    cbar,
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, h('button', { class: 'btn sm primary', onclick: stemImportChords, title: 'Replace the song with this chord chart (a snapshot is saved first)' }, '⤵ Import chords as the song'), h('button', { class: 'btn sm', onclick: stemApplyTempo }, 'Use tempo + key only'), h('button', { class: 'btn sm', disabled: !g, onclick: stemImportGroove }, '🥁 Copy drum groove to the band'), h('button', { class: 'btn sm', onclick: stemTogether, title: 'Imports tempo, starts the track from bar 1 and the band together' }, '▶ Track + band together')));
}
function drawStemLanes() {
  if (!SU.cv || !STM.ch || !paneVisible('stems')) return; const cv = SU.cv, g = cv.getContext('2d'), W = cv.width, H = cv.height, an = STM.an, dpr = W / cv.clientWidth || 1; g.fillStyle = '#050b0c'; g.fillRect(0, 0, W, H);
  const lanes = [['Mix', '#9bb', STM.env[4], null], ...STMS.map(([id, nm, col], i) => [nm, col, STM.env[i], an && an.pres[i]])], top = 22 * dpr, lh = (H - top) / lanes.length, N = STM.env[0].length;
  g.font = `700 ${Math.round(10 * dpr)}px ui-monospace,monospace`; g.textBaseline = 'top';
  if (an) { g.fillStyle = 'rgba(255,255,255,.4)'; an.chordBars.forEach((b, i) => { const x = b.t / STM.dur * W; g.fillStyle = i % 4 === 0 ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.06)'; g.fillRect(x, top, 1, H - top); if (W / an.chordBars.length > 36 * dpr || i % 4 === 0) { g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText(b.chord.split(' ')[0], x + 3, 4); } }); }
  lanes.forEach(([nm, col, env, pr], li) => {
    const y0 = top + li * lh, mid = y0 + lh / 2, mx = Math.max(.02, ...env); if (pr) { const nw = pr.length; for (let w = 0; w < nw; w++) { const a = pr[w]; if (a < .05) continue; g.fillStyle = col; g.globalAlpha = .12 * a; g.fillRect(w * an.W / an.fps / STM.dur * W, y0 + 2, Math.ceil(an.W / an.fps / STM.dur * W) + 1, lh - 4); } g.globalAlpha = 1; }
    g.fillStyle = col; g.globalAlpha = .9; for (let x = 0; x < W; x++) { const v = env[Math.min(N - 1, Math.floor(x / W * N))] / mx * (lh * .46); g.fillRect(x, mid - v, 1, Math.max(1, v * 2)); } g.globalAlpha = 1; g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText(nm, 6, y0 + 4); g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, y0 + lh - 1, W, 1);
  });
  const L = STM.loop; if (L.a != null && L.b != null) { g.fillStyle = L.on ? 'rgba(53,211,194,.16)' : 'rgba(255,255,255,.06)'; g.fillRect(L.a / STM.dur * W, top, (L.b - L.a) / STM.dur * W, H - top); }
  const x = spPos() / STM.dur * W; g.fillStyle = '#fff'; g.fillRect(x - 1, 0, 2 * dpr / 1.5, H); if (SU.time) SU.time.textContent = fmtT(spPos()) + ' / ' + fmtT(STM.dur);
}
function stemFrame() { if (STM.ch && STM.env && !STM.busy) drawStemLanes(); }
