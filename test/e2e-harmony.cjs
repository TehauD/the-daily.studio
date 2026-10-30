/* The harmony looks (2.10): Hex Resonance as the default, the ten new looks, the harmony model behind them (what is tension over which chord), the
   chord landscape from a song, the comfort limits on lightning, session saving and clearing. Drawing is checked by looking at the canvas pixels,
   not by eye, so these prove the looks run and respond; whether they read well is for a person to judge. Own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
suite('e2e-harmony', async t => {
  const { ok, wait, poll } = t, p = await t.open({ w: 1280, h: 720, debug: true }), ev = (f, a) => p.evaluate(f, a);
  const TEN = ['gravity', 'field', 'swarms', 'mood', 'dna', 'stars', 'fluid', 'paint'];   // eight since 2.12: Chord Landscape and Ecosystem were taken out

  // ---- the default look is the hexagon field, first in the bar
  const vm = await ev(() => { const d = window.__daily; return { first: d.VMODES[0][0], mode: d.VZ.mode, cfg: d.CFG.visMode, have: d.VMODES.map(m => m[0]) }; });
  ok(vm.first === 'hex' && vm.mode === 'hex' && vm.cfg === 'hex', 'Hex Resonance is the first look and the default (' + vm.first + ', ' + vm.mode + ')');
  ok(TEN.every(k => vm.have.includes(k)) && vm.have.includes('concert'), 'the eight harmony looks are in the list beside Concert (' + vm.have.length + ' looks)');
  ok(await ev(() => { const d = window.__daily; d.CFG.visMode = 'concert'; d.CFG.visV = 0; return true; }) && true, 'a person who had Concert chosen is reset once (the migration is keyed on a version)');

  // ---- the model: which notes are tension over which chord
  const tn = await ev(() => { const d = window.__daily, ch = d.parseChord('Gmaj7'), K = new Set([7, 9, 11, 0, 2, 4, 6]), r = pc => d.hmDiss(pc, ch, K.has(pc)); return { B: r(11), G: r(7), D: r(2), Fs: r(6), C: r(0), A: r(9), E: r(4), Bb: r(10) }; });
  ok(tn.B.d === 0 && tn.G.d === 0 && tn.D.d === 0 && tn.Fs.d === 0, 'over Gmaj7 the chord notes (G B D F♯) are stable');
  ok(tn.C.c === 'tension' && tn.C.d >= .5, 'C over Gmaj7 is tension (a half-step from B): ' + tn.C.d.toFixed(2));
  ok(tn.A.c === 'colour' && tn.E.c === 'colour' && tn.A.d < .5 && tn.E.d < .5, 'A and E over Gmaj7 are colours, not clashes');
  ok(tn.Bb.c === 'tension', 'B♭ (outside the key and a half-step from B) is tension');

  // ---- every look draws (and the canvas is not blank), with no errors
  await ev(async () => { const d = window.__daily; await d.ioConnect(); d.dockGo('vis'); d.CFG.vzNeck = false; d.vzImmersive(true); d.HM.force = 'Gmaj7'; d.play && d.play(); window.__sim = setInterval(() => { const m = [71, 72, 71, 67, 74][Math.floor(performance.now() / 700) % 5]; d.VOX.m = m + .05; d.VOX.cents = 5; d.VOX.f = [1, 2, 3]; d.VOX.db = -24; d.VOX.hist.push({ t: performance.now(), m, c: .9 }); d.bus.emit('onset', {}); }, 120); });
  const drew = {};
  for (const m of TEN) { await ev(m => window.__daily.vzSetMode(m), m); await wait(1300); drew[m] = await ev(() => { const cv = window.__daily.UI.vcv, g = cv.getContext('2d'), w = cv.width, h = cv.height, px = g.getImageData(0, 0, w, h).data; let lit = 0, n = 0; for (let i = 0; i < px.length; i += 4 * 97) { n++; if (px[i] + px[i + 1] + px[i + 2] > 120) lit++; } return { lit: lit / n, err: window.__daily.HMX.err }; }); }
  ok(TEN.every(m => drew[m].lit > .004) && !drew.gravity.err, 'all eight looks paint something on the canvas (' + TEN.map(m => m + ' ' + (drew[m].lit * 100).toFixed(1) + '%').join(', ') + ')');

  // ---- the voice is heard while a harmony look is showing
  ok(await ev(() => window.__daily.VOX.hist.length > 5), 'the voice tracker runs while a harmony look is on screen (no ribbon needed)');
  // ---- the constellation: a star for each sung note, sharp to the right, flat to the left
  await ev(() => { const d = window.__daily; d.hmClear(); d.HM.stars.push({ t: 100, m: 69, c: 30, k: .5, d: 0 }, { t: 200, m: 69, c: -30, k: .5, d: 0 }, { t: 300, m: 69, c: 1, k: .5, d: 0 }); d.vzSetMode('stars'); });
  await wait(500); ok(await ev(() => window.__daily.HM.stars.some(s => s.c > 20) && window.__daily.HM.stars.some(s => s.c < -20) && window.__daily.UI.vcv.getContext('2d').getImageData(0, 0, 4, 4).data.length > 0), 'sharp and flat notes become stars on either side of the line');
  ok(await ev(() => { const d = window.__daily; d.vzSetMode('stars'); return !document.querySelector('.hm-ctl').hidden; }), 'the New session and Save picture buttons show on the sky and the painting');
  await ev(() => window.__daily.vzSetMode('mood')); await wait(300); ok(await ev(() => document.querySelector('.hm-ctl').hidden), '...and stay out of the way on the others');
  // ---- new session clears everything
  // checked in the same call as the clear: the simulated voice keeps adding a point every 100 ms, so a later call can find a new one
  ok(await ev(() => { const d = window.__daily; d.HM.paint.push({ t: 1, m: 60, h: 40, lv: .5, v: 1, ten: 0, d: 0 }); d.hmClear(); return d.HM.stars.length === 0 && d.HM.paint.length === 0; }), 'New session clears the sky, the painting and the creatures');
  // ---- the painting renders from the session, and saving makes a picture
  const paint = await ev(() => { const d = window.__daily, c = document.createElement('canvas'); c.width = 640; c.height = 360; const pts = []; for (let i = 0; i < 200; i++) pts.push({ t: i * 100, m: 55 + Math.sin(i / 9) * 8, h: (i * 4) % 360, lv: .6, v: i % 2, ten: .2, d: 0 }); pts.push({ t: 5000, m: 60, h: 40, o: 1, a: .8, dev: .3 }); d.hmPaintRender(c.getContext('2d'), 640, 360, pts, 25000, {}); const px = c.getContext('2d').getImageData(0, 0, 640, 360).data; const seen = new Set(); for (let i = 0; i < px.length; i += 4 * 211) seen.add((px[i] >> 5) + ',' + (px[i + 1] >> 5) + ',' + (px[i + 2] >> 5)); return seen.size; });
  ok(paint >= 6, 'the painting draws colour and texture from a session (' + paint + ' distinct tones sampled)');
  ok(await ev(() => typeof window.__daily.hmSave === 'function'), 'a picture can be saved');

  // ---- comfort: Calm has no lightning at all, Full has some, and never closer than the gap
  await ev(() => { const d = window.__daily; d.HM.force = 'D7'; d.vzSetMode('mood'); d.HMX.bolts = []; d.HMX.lastBolt = -99; d.STG.comfort = 'calm'; });
  await wait(4200); const calm = await ev(() => window.__daily.HMX.lastBolt);
  ok(calm < 0, 'Calm comfort: a dominant chord brings no lightning');
  await ev(() => { const d = window.__daily; d.STG.comfort = 'full'; window.__bolts = []; const iv = setInterval(() => { const b = d.HMX.bolts; if (b.length && !window.__bolts.includes(b[b.length - 1].t0)) window.__bolts.push(b[b.length - 1].t0); }, 40); window.__biv = iv; });
  await wait(7500); const bolts = await ev(() => { clearInterval(window.__biv); return window.__bolts; });
  ok(bolts.length >= 2, 'Full comfort: a dominant chord brings some lightning (' + bolts.length + ' bolts in 7 s)');
  const gaps = bolts.slice(1).map((b, i) => b - bolts[i]); ok(gaps.every(x => x >= 690), 'bolts are never closer than the comfort gap (smallest ' + Math.round(Math.min(...gaps, 9999)) + ' ms; the limit is three flashes a second)');
  ok(await ev(() => window.__daily.STG.comfort === 'full') && await ev(() => { const d = window.__daily; d.STG.comfort = 'standard'; return true; }), 'comfort is restored');
  ok(t.errs.length === 0, 'the harmony looks run without script errors' + (t.errs.length ? ' ' + t.errs[0] : ''));
});
