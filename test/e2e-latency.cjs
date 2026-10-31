/* Latency (2.18): how late you hear your guitar and your voice, and whether takes play in time with each other.
   The browser's own compressor looks 6 ms ahead and its 4x oversampling adds 4 ms, so with the default rig the guitar used to come out of the
   app about 21 ms after it went in and the voice 12 ms; and takes played through the rig or the vocal polish were that much late on playback.
   Now the compressors and the amp and drive saturation run in the app's worklet with no look-ahead, and whatever delay is left (the browser's own
   nodes, with Settings ▸ Audio engine ▸ Zero-delay effects off) is compensated on playback. A click goes in; the tests time where it comes out. */
const { suite } = require('./lib.cjs');

/* in the page: a click into `into` (E.inSum = the guitar, E.voxIn = the vocal), timed at each tap; ms after the first tap */
function shot([into, names]) {
  const D = window.__daily, E = D.E, c = E.ctx; D.setMonitor(true); E.voxMon.gain.cancelScheduledValues(0); E.voxMon.gain.value = 1;
  const all = { gIn: E.inTrim, gRig: E.rigOut, vIn: E.voxTrim, vStrip: E.voxStrip.out, out: E.limiter }, taps = names.map(n => all[n]);
  const sr = c.sampleRate, N = Math.round(sr * 1.4), mg = c.createChannelMerger(taps.length), sp = c.createScriptProcessor(4096, taps.length, 1), z = c.createGain(); z.gain.value = 0;
  taps.forEach((n, i) => n.connect(mg, 0, i)); mg.connect(sp); sp.connect(z); z.connect(c.destination);
  const rec = taps.map(() => new Float32Array(N)); let k = 0;
  return new Promise(done => {
    sp.onaudioprocess = ev => { if (k >= N) return; const n = Math.min(ev.inputBuffer.length, N - k); for (let ch = 0; ch < taps.length; ch++) rec[ch].set(ev.inputBuffer.getChannelData(ch).subarray(0, n), k); k += n;
      if (k < N) return; sp.onaudioprocess = null; taps.forEach(n => { try { n.disconnect(mg); } catch (e) { } }); sp.disconnect();
      const pk = x => { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); return m; }, on = x => { const m = pk(x); return m < 1e-5 ? null : x.findIndex(v => Math.abs(v) > m * .05); };
      const t = rec.map(on), r = { peak: +pk(rec[rec.length - 1]).toFixed(3) }; names.forEach((n, i) => { r[n] = t[i] == null || t[0] == null ? null : +((t[i] - t[0]) / sr * 1000).toFixed(2); }); done(r); };
    const s = c.createBufferSource(), bf = c.createBuffer(1, 64, sr); bf.getChannelData(0)[0] = .3; bf.getChannelData(0)[1] = -.2; s.buffer = bf; s.connect(E[into]); s.start(c.currentTime + .4);
  });
}
/* in the page: a guitar take with a click 0.5 s in and a vocal take with a click 1.0 s in, played from the top; the gap between them as heard */
function takes(mode) {
  const D = window.__daily, E = D.E, c = E.ctx, sr = c.sampleRate, n = sr * 2, click = (a, t) => { a[Math.round(t * sr)] = .4; a[Math.round(t * sr) + 1] = -.3; return a; };
  D.stopPlay(true); D.TAKES.length = 0; D.T.cursor = 0; D.T.metro = false; D.T.loop = false;
  const wl = D.rigLat(), wet = click(new Float32Array(n), .5 + wl);      // a wet print comes out of the rig wl late
  D.REC = { dry: [click(new Float32Array(n), .5)], wet: [wet], vox: [click(new Float32Array(n), 1)], g: true, v: true, t0: 0, startSec: 0, bpm: D.S.bpm, preset: null, n: 0, cam: [], pkG: [], pkV: [], punch: null, tEnd: 0, cycle: false, wl };
  D.recEnd(); const g = D.TAKES.find(t => t.kind === 'gtr'); if (mode) g.mode = mode;
  const all = [E.rigOut, E.voxStrip.out, E.takesIn], N = Math.round(sr * 2.2), mg = c.createChannelMerger(3), sp = c.createScriptProcessor(4096, 3, 1), z = c.createGain(); z.gain.value = 0;
  all.forEach((x, i) => x.connect(mg, 0, i)); mg.connect(sp); sp.connect(z); z.connect(c.destination);
  const rec = all.map(() => new Float32Array(N)); let k = 0;
  return new Promise(done => {
    sp.onaudioprocess = ev => { if (k >= N) return; const m = Math.min(ev.inputBuffer.length, N - k); for (let ch = 0; ch < 3; ch++) rec[ch].set(ev.inputBuffer.getChannelData(ch).subarray(0, m), k); k += m;
      if (k < N) return; sp.onaudioprocess = null; all.forEach(x => { try { x.disconnect(mg); } catch (e) { } }); sp.disconnect(); D.stopPlay(true);
      const on = x => { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); return m < 1e-4 ? null : x.findIndex(v => Math.abs(v) > m * .3); };
      const gt = mode === 'wet' ? on(rec[2]) : on(rec[0]), vt = on(rec[1]);
      done({ mode: g.mode, gapMs: gt == null || vt == null ? null : +((vt - gt) / sr * 1000).toFixed(2), wl: +(wl * 1000).toFixed(2), vl: +(D.voxLat() * 1000).toFixed(2) });
    };
    D.play();
  });
}

suite('e2e-latency', async t => {
  const { ok, wait, poll } = t;
  const p = await t.open({});
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { const c = window.__daily.E.ctx; if (c.state !== 'running') return c.resume(); });

  /* ---- live: how late you hear yourself ---- */
  const g = await ev(shot, ['inSum', ['gIn', 'gRig', 'out']]), v = await ev(shot, ['voxIn', ['vIn', 'vStrip', 'out']]);
  ok(g.out != null && g.out <= 1 && g.peak > .01, 'the guitar comes out of the default rig (compressor, amp, cab, reverb) and the master in under 1 ms (' + JSON.stringify(g) + '; it was about 21 ms)');
  ok(v.out != null && v.out <= 1 && v.peak > .01, 'the voice comes out of the polish and the master in under 1 ms (' + JSON.stringify(v) + '; it was 12 ms)');
  const rig0 = await ev(() => window.__daily.rigSnapshot());
  await ev(() => { const D = window.__daily, s = D.rigSnapshot(); ['od', 'ds', 'fuzz'].forEach(k => { s.u[k].on = 1; }); s.u.reverb.on = 0; D.rigApply(s); }); await wait(1500);
  const hg = await ev(shot, ['inSum', ['gIn', 'gRig', 'out']]);
  ok(hg.out != null && hg.out >= 0 && hg.out <= 1.5 && hg.peak > .01, 'with the overdrive, distortion and fuzz on as well, still under 1.5 ms (' + JSON.stringify(hg) + ')');
  await ev(s => window.__daily.rigApply(s), rig0); await wait(1500);
  ok(await ev(() => window.__daily.rigLat() === 0 && window.__daily.voxLat() === 0), 'the zero-delay effects report no delay to compensate');

  /* ---- the zero-delay compressor keeps the browser compressor's levels ---- */
  const C = await ev(async () => {
    const D = window.__daily, sr = 48000, url = URL.createObjectURL(new Blob([D.WORKLET_SRC], { type: 'application/javascript' })), sets = [
      ['default', -24, 30, 12, .003, .25], ['compressor pedal', -28, 14, 3, .012, .22], ['vocal polish', -24, 14, 3, .008, .2], ['amp sag', -20, 20, 2, .004, .12], ['limiter', -1.5, 0, 20, .001, .08]], out = [];
    const level = async (native, P, db) => {
      const o = new OfflineAudioContext(1, sr, sr); await o.audioWorklet.addModule(url);
      const osc = o.createOscillator(), g0 = o.createGain(); osc.frequency.value = 440; g0.gain.value = Math.pow(10, db / 20);
      const n = native ? o.createDynamicsCompressor() : D.mkComp(o);
      n.threshold.value = P[1]; n.knee.value = P[2]; n.ratio.value = P[3]; n.attack.value = P[4]; n.release.value = P[5];
      osc.connect(g0); g0.connect(n); n.connect(o.destination); osc.start(); const r = (await o.startRendering()).getChannelData(0); let e = 0; for (let i = sr / 2; i < sr; i++) e += r[i] * r[i]; return 10 * Math.log10(e / (sr / 2) + 1e-30);
    };
    let worst = 0, at = '';
    for (const P of sets) for (const db of [-40, -24, -12, -6, 0]) { const a = await level(true, P, db), b = await level(false, P, db), d = Math.abs(a - b); if (d > worst) { worst = d; at = P[0] + ' at ' + db + ' dB'; } }
    URL.revokeObjectURL(url); return { worst: +worst.toFixed(2), at };
  });
  ok(C.worst <= 1, 'the zero-delay compressor matches the browser compressor’s level within 1 dB over five settings and five input levels (worst ' + C.worst + ' dB, ' + C.at + ')');

  /* ---- the zero-delay shaper sounds like the browser's 4x one ---- */
  const W = await ev(async () => {
    const D = window.__daily, sr = 48000, url = URL.createObjectURL(new Blob([D.WORKLET_SRC], { type: 'application/javascript' })), curve = D.satCurve(3.2, .12);
    const render = async (native, f, drive) => {
      const o = new OfflineAudioContext(1, sr, sr); await o.audioWorklet.addModule(url);
      const osc = o.createOscillator(), g0 = o.createGain(); osc.frequency.value = f; g0.gain.value = drive;
      const n = native ? o.createWaveShaper() : D.mkShaper(o); n.curve = curve; n.oversample = '4x';
      osc.connect(g0); g0.connect(n); n.connect(o.destination); osc.start(); return (await o.startRendering()).getChannelData(0).slice(sr / 4);
    };
    const rms = x => { let e = 0; for (const v of x) e += v * v; return 10 * Math.log10(e / x.length); };
    /* aliasing: a hard-driven 3150 Hz note's 15th, 13th, 11th and 9th harmonics fold back to 750, 7050, 13350 and 19650 Hz; their level
       against the note (one Blackman-Harris windowed DFT bin each). Without oversampling they are about −20 dB. */
    const bh = (i, N) => { const t = 2 * Math.PI * i / (N - 1); return .35875 - .48829 * Math.cos(t) + .14128 * Math.cos(2 * t) - .01168 * Math.cos(3 * t); };
    const bin = (x, b) => { const N = x.length, w = 2 * Math.PI * b / sr; let re = 0, im = 0; for (let i = 0; i < N; i++) { const v = x[i] * bh(i, N); re += v * Math.cos(w * i); im += v * Math.sin(w * i); } return Math.hypot(re, im); };
    const alias = x => { const f0 = bin(x, 3150); return Math.max(...[750, 7050, 13350, 19650].map(b => 20 * Math.log10(bin(x, b) / f0))); };
    const out = { level: [], alias: {} };
    for (const [f, d] of [[220, .3], [220, 3], [880, 8]]) { const a = await render(true, f, d), b = await render(false, f, d); out.level.push(+(rms(a) - rms(b)).toFixed(2)); }
    out.alias = { native: +alias(await render(true, 3150, 20)).toFixed(1), worklet: +alias(await render(false, 3150, 20)).toFixed(1) };
    { /* the first samples, without oversampling (the same table either way): a curve that arrived late would leave them clean */
      const one = async native => { const o = new OfflineAudioContext(1, 1024, sr); await o.audioWorklet.addModule(url); const osc = o.createOscillator(), g0 = o.createGain(); osc.frequency.value = 220; g0.gain.value = 3;
        const n = native ? o.createWaveShaper() : D.mkShaper(o); n.curve = curve; n.oversample = 'none'; osc.connect(g0); g0.connect(n); n.connect(o.destination); osc.start(); return (await o.startRendering()).getChannelData(0); };
      const a = await one(true), b = await one(false); out.first = a.filter((v, i) => Math.abs(v - b[i]) > 1e-4).length; }
    URL.revokeObjectURL(url); return out;
  });
  ok(W.level.every(d => Math.abs(d) <= .3), 'the zero-delay shaper gives the same level as the browser’s 4x waveshaper, clean and driven (' + W.level.join(', ') + ' dB)');
  ok(W.first === 0, 'in an offline render (a bounce) the distortion curve is in force from the very first sample (' + W.first + ' samples differ from the browser’s shaper)');
  ok(W.alias.worklet < -60 && W.alias.worklet <= W.alias.native + 3, 'and as little aliasing on a hard-driven high note (the loudest folded harmonic, against the note: ' + JSON.stringify(W.alias) + ' dB)');

  /* ---- takes play in time with each other ---- */
  const T1 = await ev(takes, null), T2 = await ev(takes, 'wet');
  ok(T1.gapMs != null && Math.abs(T1.gapMs - 500) <= 1, 'a guitar take played through the rig and a vocal take land exactly where they were played (' + JSON.stringify(T1) + ')');
  ok(T2.gapMs != null && Math.abs(T2.gapMs - 500) <= 1, 'so does a guitar take played from its wet print (' + JSON.stringify(T2) + ')');

  /* ---- with the browser's own effects: slower live, but takes still in time ---- */
  ok(await ev(() => !!document && typeof window.__daily.restartAudio === 'function'), 'the engine can be restarted for the setting');
  await ev(async () => { const D = window.__daily; D.CFG.lowLat = false; await D.restartAudio(); }); await wait(800);
  await ev(() => { const c = window.__daily.E.ctx; if (c.state !== 'running') return c.resume(); });
  ok(await ev(() => window.__daily.E.limiter instanceof DynamicsCompressorNode), 'Zero-delay effects off: the browser’s own compressor is used');
  const g2 = await ev(shot, ['inSum', ['gIn', 'gRig', 'out']]), L2 = await ev(() => ({ rig: window.__daily.rigLat() * 1000, vox: window.__daily.voxLat() * 1000 }));
  ok(g2.gRig != null && Math.abs(g2.gRig - L2.rig) <= 1, 'with them off, the delay the rig reports (' + L2.rig.toFixed(2) + ' ms) is the delay measured (' + g2.gRig + ' ms)');
  const T3 = await ev(takes, null), T4 = await ev(takes, 'wet');
  ok(T3.wl > 5 && Math.abs(T3.gapMs - 500) <= 1, 'and takes are moved by it, so they still land in time (' + JSON.stringify(T3) + ')');
  ok(Math.abs(T4.gapMs - 500) <= 1, '… from the wet print too (' + JSON.stringify(T4) + ')');
  await ev(async () => { const D = window.__daily; D.CFG.lowLat = true; await D.restartAudio(); }); await wait(800);
  ok(await ev(() => !(window.__daily.E.limiter instanceof DynamicsCompressorNode)), 'turning it back on brings the zero-delay effects back');
});
