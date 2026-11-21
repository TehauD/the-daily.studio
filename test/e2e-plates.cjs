/* Chladni Plate and Pitch Trace (2.81), on known physics and known pitches. The plate's pattern is zero on its nodal lines (the diagonal for the simplest
   mode); a higher note picks a finer pattern; sand starts spread over the plate and ends on the nodal lines. A voice held in tune draws gold, and a
   voice 45 cents sharp draws warmer; the line sits at the note's lane. */
const { suite } = require('./lib.cjs');
suite('e2e-plates', async t => {
  const { ok, wait } = t, p = await t.open({ w: 1400, h: 860, debug: true }), ev = (f, a) => p.evaluate(f, a);
  await ev(() => window.__daily.dockGo('vis')); await wait(900); await ev(() => window.__daily.room('worlds'));
  // ---- the plate's patterns
  const C = await ev(() => { const D = window.__daily, M = D.CH_MODES, d = (n, m, x) => Math.abs(D.chPsi(n, m, x, x)), idx = f => D.chModeFor(f), sorted = M.every((q, i) => i === 0 || q[0] * q[0] + q[1] * q[1] >= M[i - 1][0] * M[i - 1][0] + M[i - 1][1] * M[i - 1][1]);
    return { first: M[0].join(), n: M.length, sorted, diag: [.13, .4, .77].map(x => d(0, 1, x)), anti: Math.abs(D.chPsi(0, 1, .2, .7)) > .3, swap: Math.abs(D.chPsi(2, 5, .3, .6) + D.chPsi(5, 2, .3, .6)) < 1e-9, mono: idx(100) < idx(400) && idx(400) < idx(1600), lo: idx(20), hi: idx(20000), top: M.length - 1 }; });
  ok(C.first === '0,1' && C.sorted && C.n >= 30, 'the plate has ' + C.n + ' patterns, simplest first (n² + m² rising)');
  ok(C.diag.every(v => v < 1e-9) && C.anti && C.swap, 'the simplest pattern is still along the diagonal and moves elsewhere; swapping n and m flips the sign, as the formula says');
  ok(C.mono && C.lo === 0 && C.hi === C.top, 'a higher note picks a finer pattern (100 Hz < 400 Hz < 1600 Hz), and the ends are clamped');
  // ---- the sand settles on the nodal lines
  const S = await ev(() => { const D = window.__daily, W = 900, H = 600, cv = document.createElement('canvas'); cv.width = W; cv.height = H, g = cv.getContext('2d'); D.CFG.vo = {}; D.vlSet('chladni', 'follow', 'manual'); D.vlSet('chladni', 'mode', 7); D.vlSet('chladni', 'sand', 2000); D.vlSet('chladni', 'style', 'sand');
    const [n, m] = D.CH_MODES[6], X = { fd: new Float32Array(1024).fill(-100), lvl: x => 0, bin: f => 1, C: { a: '#3ddc84', b: '#f2b632' }, bh: 21.5, energy: .5, pulse: 0 }, spread = () => { let s = 0; const sd = D.CHX.sand; for (let i = 0; i < sd.length / 2; i++) s += Math.abs(D.chPsi(n, m, sd[2 * i], sd[2 * i + 1])); return s / (sd.length / 2); };
    D.CHX.sand = null; D.CHX.idx = -1; const frame = () => { D.HM.stamp = -1; D.HM.now = performance.now() - 16; D.VZ.t += .016; D.vlChladni(g, W, H, X); }; frame(); const before = spread(); for (let i = 0; i < 500; i++) frame(); const after = spread(); D.CFG.vo = {}; return { n, m, before, after, idx: D.CHX.idx }; });
  ok(S.after < S.before * .5, 'sand starts spread over the plate and collects on the nodal lines: the mean distance from a line falls from ' + S.before.toFixed(2) + ' to ' + S.after.toFixed(2) + ' (mode ' + S.n + ', ' + S.m + ')');
  // ---- pitch trace
  const T = await ev(async () => { const D = window.__daily, W = 900, H = 600, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), X = { fd: new Float32Array(1024).fill(-100), lvl: x => 0, bin: f => 1, C: {}, bh: 21.5, energy: 0, pulse: 0 };
    D.S.key = 9; D.S.minor = true; D.CFG.vo = {}; D.vlSet('pitchtrace', 'range', 'fixed'); D.vlSet('pitchtrace', 'window', 4); D.HM.force = 'Am'; D.AN.active = false;
    /* frames in real time, so the line has length: B (59) is a note of the key but not of the chord, so its lane is faint and the colour seen is the line's */
    const run = async (midi, frames) => { D.PTX.v.length = 0; D.PTX.gt.length = 0; D.PTX.c = 60; for (let i = 0; i < frames; i++) { D.HM.vm = midi; D.HM.vOn = 1; D.HM.vHold = performance.now() + 1e6; D.HM.stamp = -1; D.VZ.t += .02; D.vlPitchTrace(g, W, H, X); await new Promise(r => setTimeout(r, 18)); } };
    const near = (x, y) => { const d = g.getImageData(Math.round(x) - 4, Math.round(y) - 4, 9, 9).data; let best = [0, 0, 0], m = 0; for (let i = 0; i < d.length; i += 4) { const s = d[i] + d[i + 1] + d[i + 2]; if (s > m) { m = s; best = [d[i], d[i + 1], d[i + 2]]; } } return best; };
    const y1 = H * .9, y0 = H * .1, lo = 48, Y = mm => y1 - (mm - lo) / 24 * (y1 - y0), x = W * .94 - 18;
    await run(59, 45); const inTune = near(x, Y(59)), n1 = D.PTX.v.filter(Boolean).length; await run(59.45, 45); const sharp = near(x, Y(59.45)); D.HM.vm = null; D.HM.vOn = 0; D.HM.vHold = 0; D.HM.force = null; D.CFG.vo = {};
    return { inTune, sharp, n1 }; });
  ok(T.n1 > 20, 'a held voice is kept as a line (' + T.n1 + ' points)');
  ok(T.inTune[0] > 180 && T.inTune[1] > 150 && T.inTune[2] < 140, 'a voice held in tune draws gold (' + T.inTune + ')');
  ok(T.sharp[0] > 180 && T.sharp[1] < T.inTune[1] - 40, 'a voice 45 cents sharp draws warmer, with less green (' + T.sharp + ' against ' + T.inTune + ')');
  // ---- both are options-rich, in the picker, and draw on the live canvas
  const E0 = t.errs.length; const L = await ev(async () => { const D = window.__daily, o = {}; for (const k of ['chladni', 'pitchtrace']) { D.vzSetMode(k, true); await new Promise(r => setTimeout(r, 400)); o[k] = Object.keys(D.VLOOK[k] ? D.VLOOK[k].opts.reduce((a, x) => (a[x.k] = 1, a), {}) : {}).length; } D.vzSetMode('hex', true); return o; });
  ok(L.chladni === 6 && L.pitchtrace === 5 && t.errs.length === E0, 'Chladni Plate (' + L.chladni + ' options) and Pitch Trace (' + L.pitchtrace + ') draw on the live canvas without an error');
  ok(t.errs.length === 0, 'no errors (' + t.errs.length + ')');
});
