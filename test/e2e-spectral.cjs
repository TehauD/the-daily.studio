/* Three worlds of sound made geometric (2.80): Pitch Spiral, Rhythm Polygons, Overtone Series, and the options each brings (Design ▸ This world).
   The measurements are checked on made-up sound with known answers: a note at 220 Hz lands on the A spoke of the spiral; harmonics are found with the
   right strength and tuning offset; a Euclidean rhythm is named and one that is not is left alone; a late hit is drawn orange. Silent bins are -Infinity
   dB, as in a real analyser, so a blend of decibels would be NaN and draw nothing: it must draw. */
const { suite } = require('./lib.cjs');
suite('e2e-spectral', async t => {
  const { ok, wait } = t, p = await t.open({ w: 1400, h: 860, debug: true }), ev = (f, a) => p.evaluate(f, a);
  await ev(() => window.__daily.dockGo('vis')); await wait(900);
  // ---- in the picker, with their options marked
  const P = await ev(() => { const q = f => [...document.querySelectorAll('#vzLooks .vz-fam[data-fam=' + f + '] [data-m]')].map(b => b.dataset.m), D = window.__daily; return { freq: q('sound'), time: q('more'), opt: [...document.querySelectorAll('#vzLooks .has-opts')].map(b => b.dataset.m).sort().join(), ids: Object.keys(D.VLOOK).sort().join() }; });
  ok(P.freq.slice(0, 2).join() === 'hex,spiral' && P.time.includes('overtones') && P.time.includes('rhythm'), 'Pitch Spiral is in Sound (a look you kept); Overtone Series and Rhythm Polygons are in More looks (' + P.freq.slice(0, 2) + ' / ' + P.time.length + ' more)');
  ok(P.opt === 'neural,nxtower,nxweb,nxjourney,chladni,overtones,pitchtrace,rhythm,spiral', 'the worlds with their own options are marked in the picker (' + P.opt + ')');
  // ---- the harmonics of a note are measured
  const H = await ev(() => { const D = window.__daily, bh = 44100 / 2048, fd = new Float32Array(1024).fill(-Infinity), put = (f, db) => { const b = f / bh; for (let i = Math.round(b) - 3; i <= Math.round(b) + 3; i++) fd[i] = Math.max(fd[i], db - 7 * (i - b) * (i - b)); }, f0 = 220,   /* a peak is a smooth lobe, as an analyser's window makes it */ cents = k => Math.pow(2, (k === 5 ? 30 : 0) / 1200);
    for (let k = 1; k <= 8; k++) put(f0 * k * cents(k), -20 - 6 * (k - 1)); const lvl = x => Math.max(0, Math.min(1, (x + 88) / 62)), hs = D.vlHarmonics(fd, bh, f0, 8, lvl);
    return { n: hs.length, v: hs.map(h => +h.v.toFixed(2)), c5: hs[4].cents, ok5: hs[4].ok, ok1: hs[0].ok, names: [1, 2, 3, 4, 5, 6, 7, 9, 11, 15].map(D.vlHarmName).join(' ') }; });
  ok(H.n === 8 && H.v[0] > H.v[3] && H.v[3] > H.v[7], 'eight harmonics are found, each quieter than the last (' + H.v.join(', ') + ')');
  ok(Math.abs(H.c5 - 30) < 9 && H.ok5 && !H.ok1, 'the fifth harmonic, 30 cents sharp, is measured as ' + H.c5.toFixed(1) + ' cents, and the fundamental’s offset is not claimed (the spectrum is too coarse down there)');
  ok(H.names === '1 1 5 1 3 5 ≈♭7 2 ≈♯4 7', 'each harmonic is named as what it is above the note (' + H.names + ')');
  // ---- rhythm: a Euclidean rhythm is named, and one that is not is left alone
  const R = await ev(() => { const D = window.__daily, row = (hits, n) => Array.from({ length: n }, (_, i) => hits.includes(i) ? 1 : 0); return { tres: D.vlEuclidOf(row([0, 3, 6], 8), 8), turned: D.vlEuclidOf(row([1, 4, 7], 8), 8), four: D.vlEuclidOf(row([0, 4, 8, 12], 16), 16), not: D.vlEuclidOf(row([0, 1, 2], 8), 8), kick: D.vlEuclidOf(row([0, 8, 10], 16), 16), one: D.vlEuclidOf(row([0], 8), 8) }; });
  ok(R.tres && R.tres.name === 'E(3,8)' && R.tres.say === 'tresillo' && R.turned && R.turned.name === 'E(3,8)', 'a tresillo is named, and so is one turned a step round');
  ok(R.four && R.four.name === 'E(4,16)' && R.four.say === 'four on the floor' && !R.not && !R.kick && !R.one, 'four on the floor is named; three hits in a row, a folk-backbeat kick and a single hit are not Euclidean rhythms');
  // ---- the spiral: the same note is always on the same spoke
  const S = await ev(() => { const D = window.__daily, low = 82.41, a = D.vlSpiralPos(110, low), b = D.vlSpiralPos(220, low), c = D.vlSpiralPos(440, low), d = D.vlSpiralPos(165, low); return { same: Math.abs(a.ang - b.ang) < 1e-6 && Math.abs(b.ang - c.ang) < 1e-6, up: [b.u - a.u, c.u - b.u], aPc: Math.round(b.pc), left: Math.abs(b.ang - Math.PI) < 1e-6, ePc: Math.round(d.pc) }; });
  ok(S.same && Math.abs(S.up[0] - 1) < 1e-6 && Math.abs(S.up[1] - 1) < 1e-6 && S.aPc === 9 && S.left, 'A at 110, 220 and 440 Hz is always on the same spoke, one turn apart, and the A spoke points left (C at the top)');
  // ---- drawn: light lands where the note is, even with silent bins
  const D1 = await ev(() => { const D = window.__daily, bh = 44100 / 2048, W = 900, H2 = 560, cv = document.createElement('canvas'); cv.width = W; cv.height = H2; const fd = new Float32Array(1024).fill(-Infinity); fd[12] = -20; fd[13] = -20;   /* C4, 261.6 Hz: at the top of the spiral, clear of the label in the middle */
    D.vlSet('spiral', 'hold', 0); D.HM.vm = null; D.HM.vHold = 0; D.AN.active = false; const X = { fd, bh, lvl: x => Math.max(0, Math.min(1, (x + 88) / 62)), bin: f => Math.round(f / bh), C: { a: '#3ddc84', b: '#f2b632' }, pulse: 0 };
    D.HM.stamp = -1; D.vlSpiral(cv.getContext('2d'), W, H2, X); const g = cv.getContext('2d'), R = Math.min(W * .44, H2 * .45), cx = W / 2, cy = H2 * .53, r = R * (.1 + .9 * Math.log2(261.63 / 82.41) / 6), px = (x, y) => { const d = g.getImageData(Math.round(x) - 3, Math.round(y) - 3, 7, 7).data; let m = 0; for (let i = 0; i < d.length; i += 4) m = Math.max(m, d[i] + d[i + 1] + d[i + 2]); return m; };
    return { at: px(cx, cy - r), opposite: px(cx, cy + r), far: px(cx + 120, cy + 120) }; });
  ok(D1.at > 250 && D1.opposite < 120 && D1.far < 150, 'a note at 261.6 Hz (C4) lights the spiral at the C spoke, the top, and nowhere else, with every other bin silent (' + D1.at + ' against ' + D1.opposite + ' / ' + D1.far + ')');
  // ---- drawn: the rhythm rings, and a late hit is orange
  const D2 = await ev(() => { const D = window.__daily, W = 900, H2 = 560, cv = document.createElement('canvas'); cv.width = W; cv.height = H2; D.S.band.pat = Array.from({ length: 6 }, () => new Array(32).fill(0)); D.S.band.pat[0][0] = 3; D.S.band.pat[0][8] = 2; D.S.band.pat[1][4] = 2; D.S.band.pat[1][12] = 2; D.S.band.drumLen = 16; D.S.band.patName = 'Test groove'; D.S.ts = [4, 4]; D.S.bpm = 90;
    D.CFG.vo = {}; D.HM.onsets = [{ t: performance.now() + 5, a: .8, slot: 4, dev: .45, m: 60 }]; D.HM.stamp = -1; const X = { fd: new Float32Array(1024).fill(-100), lvl: x => 0, bin: f => 1, C: {}, bh: 21.5 }; D.vlRhythm(cv.getContext('2d'), W, H2, X);
    const g = cv.getContext('2d'), Rmax = Math.min(W * .4, H2 * .37), cx = W / 2, cy = H2 * .52, near = (x, y) => { const d = g.getImageData(Math.round(x) - 4, Math.round(y) - 4, 9, 9).data; let best = [0, 0, 0], m = 0; for (let i = 0; i < d.length; i += 4) { const s = d[i] + d[i + 1] + d[i + 2]; if (s > m) { m = s; best = [d[i], d[i + 1], d[i + 2]]; } } return best; };
    const rl = Rmax * 1.2, a = 4 / 16 * Math.PI * 2 - Math.PI / 2; return { kickTop: near(cx, cy - Rmax * .7), live: near(cx + Math.cos(a) * rl, cy + Math.sin(a) * rl), rows: D.S.band.pat.slice(0, 2).map(r => r.filter(Boolean).length).join() }; });
  ok(D2.kickTop[0] > 150 && D2.kickTop[2] < 140, 'the kick on step 0 is a lit node at the top of its ring (' + D2.kickTop + ')');
  ok(D2.live[0] > 180 && D2.live[0] > D2.live[2] + 80, 'a hit 0.45 of a step late is drawn orange on the outer ring (' + D2.live + ')');
  // ---- the options: shown, changed, kept in a design, cleared
  await ev(() => { const D = window.__daily; D.vzSetMode('overtones', true); D.CFG.vo = {}; D.vzDesignOpen(true); }); await wait(400);
  const O = await ev(() => ({ ids: [...document.querySelectorAll('#vdOpts [data-vo]')].map(e => e.dataset.vo).filter((v, i, a) => a.indexOf(v) === i).join(), n: document.querySelectorAll('#vdOpts .vd-row').length }));
  ok(O.ids === 'view,count,scale,labels,cents,hold' && O.n === 6, 'Design ▸ This world shows the world’s own dials (' + O.ids + ')');
  await p.click('#vdOpts [data-vo=view][data-v=bars]'); await wait(150);
  ok(await ev(() => window.__daily.CFG.vo.overtones.view === 'bars' && window.__daily.vlv('overtones', 'view') === 'bars' && document.getElementById('vzDesignBtn').classList.contains('on')), 'choosing a view changes the world’s option and marks the Design button as changed');
  await ev(() => { const r = document.getElementById('vo_overtones_count'); r.value = 18; r.dispatchEvent(new Event('input')); }); await wait(100);
  ok(await ev(() => window.__daily.vlv('overtones', 'count') === 18), 'a slider sets its option');
  await ev(() => window.__daily.vdSave('My overtones')); await ev(() => { window.__daily.vdReset(); }); await wait(100);
  ok(await ev(() => Object.keys(window.__daily.CFG.vo).length === 0 && window.__daily.vlv('overtones', 'view') === 'rose'), 'Reset all clears the options too');
  await ev(() => window.__daily.vdApply(window.__daily.vdPersonal().find(x => x.name === 'My overtones'))); await wait(150);
  ok(await ev(() => window.__daily.vlv('overtones', 'view') === 'bars' && window.__daily.vlv('overtones', 'count') === 18 && window.__daily.VZ.mode === 'overtones'), 'a saved design brings back the world and its options');
  await ev(() => { const D = window.__daily; D.vdDelete(D.vdPersonal().find(x => x.name === 'My overtones').id); D.vdReset(); });
  ok(await ev(() => { const D = window.__daily; const h = D.VD_PRESETS.find(x => x.id === 'helix'); return !!h && h.mode === 'spiral' && h.vo.spiral.tilt === 52; }), 'a built-in design uses a world’s options (Pitch helix)');
  // ---- the hexagon field's spiral layout
  const L = await ev(() => { const D = window.__daily, W = 900, H2 = 560, mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H2; return c; }, bh = 21.53, fd = new Float32Array(1024).fill(-Infinity); fd[10] = -20; fd[11] = -20; const lvl = x => Math.max(0, Math.min(1, (x + 88) / 62)), C = { a: '#3ddc84', b: '#f2b632' }, P0 = D.hexPal(true), pn = performance.now; performance.now = () => 1000;
    const draw = lay => { D.CFG.vd = { layout: lay }; D.VZ.sm = null; const c = mk(), g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, W, H2); D.drawLattice(g, W, H2, fd, bh, lvl, C, 0, P0); return g; };
    const lit = (g, left) => { const d = g.getImageData(left ? 0 : W / 2, 0, W / 2, H2).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i + 1]; return s; }; const g1 = draw('spiral'), g2 = draw('rings'); const o = { spL: lit(g1, true), spR: lit(g1, false), ringsL: lit(g2, true), ringsR: lit(g2, false) }; performance.now = pn; D.CFG.vd = {}; return o; });
  ok(L.spL > L.spR * 1.4, 'in the hexagon field’s Pitch spiral layout the A at 220 Hz lights the left (the A spoke) and not the right (' + L.spL + ' against ' + L.spR + ')');
  // ---- every world still draws, and the options fit a phone
  const E0 = t.errs.length; const drawn = await ev(async () => { const D = window.__daily; D.CFG.vd = { glow: .4, mirror: 4 }; const ks = ['spiral', 'rhythm', 'overtones']; for (const k of ks) for (const v of (k === 'overtones' ? ['rose', 'bars', 'string'] : [0])) { if (k === 'overtones') D.vlSet('overtones', 'view', v); D.vzSetMode(k, true); await new Promise(r => setTimeout(r, 300)); } D.CFG.vd = {}; D.CFG.vo = {}; D.vzSetMode('hex', true); return ks.length; });
  ok(drawn === 3 && t.errs.length === E0, 'the three worlds draw on the live canvas, each view, with glow and a four-fold mirror on, without an error');
  const q = await t.open({ w: 390, h: 844, mobile: true, debug: true }); await q.evaluate(() => window.__daily.mGo('see', 'vis')); await wait(1100);
  const M = await q.evaluate(async () => { const D = window.__daily, bad = []; for (const k of ['spiral', 'rhythm', 'overtones']) { D.vzSetMode(k, true); D.vzDesignOpen(true, 'world'); await new Promise(r => setTimeout(r, 400)); const d = document.getElementById('vzDesign'), r = d.getBoundingClientRect(), vw = document.documentElement.clientWidth; if (Math.round(r.right) > vw || [...d.querySelectorAll('#vdOpts *')].some(e => e.offsetParent && e.getBoundingClientRect().right > r.right + 1) || document.documentElement.scrollWidth > vw) bad.push(k); } return bad; });
  ok(!M.length, 'on a 390 px phone each world’s options fit the screen' + (M.length ? ' (not: ' + M.join() + ')' : ''));
  ok(t.errs.length === 0, 'no errors (' + t.errs.length + ')');
});
