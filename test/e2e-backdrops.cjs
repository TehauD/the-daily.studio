/* 2.12: the six “Behind you” looks (Light Ribbons, Aurora, Warp Stars, Pulse Rings, Nebula, Skyline). Checked by reading canvas pixels: each paints,
   each moves, the colour follows the chord and glides, nothing flashes, and Calm is slower. Whether they look good behind a person is for a person to say. */
const { suite } = require('./lib.cjs');
suite('e2e-backdrops', async t => {
  const { ok, wait } = t, p = await t.open({ w: 1280, h: 720, debug: true }), ev = (f, a) => p.evaluate(f, a);
  const SIX = ['ribbons', 'aurora', 'warp', 'rings', 'nebula', 'skyline'];

  // ---- listed, and in their own group in the Visuals bar
  const lst = await ev(() => { const d = window.__daily; d.dockGo('vis'); return { have: d.VMODES.map(m => m[0]), names: d.VBACK.map(m => m[1]).join('|') }; }); await wait(500);
  ok(SIX.every(k => lst.have.includes(k)) && lst.names === 'Light Ribbons|Aurora|Warp Stars|Pulse Rings|Nebula|Skyline|Your video', 'the six looks are in the list, then Your video (2.19) (' + lst.names + ')');
  const bar = await ev(() => ({ back: [...document.querySelectorAll('#vzBack [data-m]')].map(b => b.dataset.m).join(), main: [...document.querySelectorAll('#pane-vis .seg:not([aria-label]) [data-m]')].map(b => b.dataset.m).join(), label: (document.querySelector('#vzBack .hx-l') || {}).textContent }));
  ok(bar.back === SIX.concat('video').join() && bar.label === 'Behind you' && !SIX.some(k => bar.main.split(',').includes(k)), 'they sit in their own “Behind you” group, apart from the main looks (' + bar.back + ')');

  // ---- the colour follows the chord
  const hues = await ev(() => { const d = window.__daily; return { C: d.bkHueFor('C'), G: d.bkHueFor('G'), Fs: d.bkHueFor('F#'), none: d.bkHueFor(null), am: d.bkHueFor('Am') }; });
  ok(hues.C === 215 && hues.G === 245 && hues.none === 215 && hues.Fs === 35 && hues.am === 305, 'C rests on blue and each fifth turns the hue 30° (' + JSON.stringify(hues) + ')');

  // ---- play something so there is sound and beats
  await ev(async () => { const d = window.__daily; await d.ioConnect(); d.CFG.vzNeck = false; d.vzImmersive(true); d.HM.force = 'C'; d.play && d.play(); window.__sim = setInterval(() => { d.bus.emit('onset', {}); }, 120); });
  const stat = pg => pg.evaluate(() => { const cv = window.__daily.UI.vcv, o = document.createElement('canvas'); o.width = 32; o.height = 18; const g = o.getContext('2d'); g.drawImage(cv, 0, 0, 32, 18); const px = g.getImageData(0, 0, 32, 18).data; let s = 0, mn = 255, mx = 0; for (let i = 0; i < px.length; i += 4) { const l = (px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11); s += l; mn = Math.min(mn, l); mx = Math.max(mx, l); } return { mean: s / (px.length / 4) / 255, spread: (mx - mn) / 255 }; });
  const drew = {};
  for (const m of SIX) {
    await ev(m => window.__daily.vzSetMode(m), m); await wait(1200);
    const a = await ev(() => window.__daily.UI.vcv.getContext('2d').getImageData(0, 0, 64, 64).data.slice(0, 4096).join()), a2 = await stat(p);
    await wait(900); const b2 = await stat(p), b = await ev(() => window.__daily.UI.vcv.toDataURL('image/png').length);
    const f1 = await ev(() => { const cv = window.__daily.UI.vcv, o = document.createElement('canvas'); o.width = 48; o.height = 27; o.getContext('2d').drawImage(cv, 0, 0, 48, 27); return [...o.getContext('2d').getImageData(0, 0, 48, 27).data].join(); }); await wait(700);
    const f2 = await ev(() => { const cv = window.__daily.UI.vcv, o = document.createElement('canvas'); o.width = 48; o.height = 27; o.getContext('2d').drawImage(cv, 0, 0, 48, 27); return [...o.getContext('2d').getImageData(0, 0, 48, 27).data].join(); });
    let diff = 0; const A = f1.split(',').map(Number), B = f2.split(',').map(Number); for (let i = 0; i < A.length; i++) diff += Math.abs(A[i] - B[i]); drew[m] = { spread: b2.spread, mean: b2.mean, moved: diff / A.length };
  }
  ok(SIX.every(m => drew[m].spread > .08 && drew[m].mean > .02), 'each look paints a real picture, not a flat colour (' + SIX.map(m => m + ' spread ' + drew[m].spread.toFixed(2)).join(', ') + ')');
  ok(SIX.every(m => drew[m].moved > .15), 'and each one moves (' + SIX.map(m => m + ' ' + drew[m].moved.toFixed(2)).join(', ') + ')');

  // ---- the hue glides when the chord changes (it does not jump)
  const glide = await ev(async () => { const d = window.__daily; d.vzSetMode('ribbons'); d.HM.force = 'C'; await new Promise(r => setTimeout(r, 1800)); const h0 = d.BK.hue; d.HM.force = 'F#'; await new Promise(r => setTimeout(r, 120)); const h1 = d.BK.hue; await new Promise(r => setTimeout(r, 3500)); const h2 = d.BK.hue; const dist = (a, b) => Math.abs(((a - b + 540) % 360) - 180); return { h0, h1, h2, early: dist(h0, h1), tgt: d.BK.tgt, final: dist(h2, d.BK.tgt) }; });
  ok(glide.early < 70 && glide.final < 25, 'the colour glides to the new chord instead of jumping (' + Math.round(glide.h0) + '° → ' + Math.round(glide.h1) + '° after 0.1 s → ' + Math.round(glide.h2) + '°, target ' + glide.tgt + '°)');

  // ---- nothing flashes: the picture's overall brightness never jumps from one moment to the next, in Calm or Standard
  for (const comfort of ['calm', 'standard']) {
    await ev(c => { window.__daily.STG.comfort = c; }, comfort);
    const worst = {};
    for (const m of SIX) {
      await ev(m => window.__daily.vzSetMode(m), m); await wait(600);
      worst[m] = await ev(async () => { const cv = window.__daily.UI.vcv, o = document.createElement('canvas'); o.width = 24; o.height = 14; const g = o.getContext('2d'); let prev = null, mx = 0; const t1 = performance.now() + 2600; while (performance.now() < t1) { g.drawImage(cv, 0, 0, 24, 14); const px = g.getImageData(0, 0, 24, 14).data; let s = 0; for (let i = 0; i < px.length; i += 4) s += px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11; s /= (px.length / 4) * 255; if (prev != null) mx = Math.max(mx, Math.abs(s - prev)); prev = s; await new Promise(r => setTimeout(r, 40)); } return mx; });
    }
    ok(SIX.every(m => worst[m] < .06), comfort + ': the largest change in overall brightness between frames stays small (' + SIX.map(m => m + ' ' + worst[m].toFixed(3)).join(', ') + ')');
  }

  // ---- Calm moves more slowly than Full show
  const speed = {};
  for (const c of ['calm', 'full']) { await ev(c => { window.__daily.STG.comfort = c; }, c); const t0 = await ev(() => window.__daily.BK.t); await wait(2000); speed[c] = (await ev(() => window.__daily.BK.t) - t0) / 2; }
  ok(speed.calm > 0 && speed.calm < speed.full * .75, 'Calm moves at about half the speed of Full show (' + speed.calm.toFixed(2) + ' vs ' + speed.full.toFixed(2) + ' per second)');

  // ---- drawn on another canvas too (a stage scene or a recording), and kept off the pitch read-out and mini fretboard
  const other = await ev(() => { const d = window.__daily, out = {}; const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; ['ribbons', 'skyline', 'rings'].forEach(m => { try { d.bkDraw(m, cv.getContext('2d'), 320, 180, { fd: new Float32Array(1024).fill(-60), bin: f => Math.max(1, Math.min(1023, Math.round(f / 20))), lvl: x => Math.max(0, Math.min(1, (x + 88) / 62)), C: d.UI && {}, pulse: .3, energy: .4, dt: .016 }); const px = cv.getContext('2d').getImageData(0, 0, 320, 180).data; let s = 0; for (let i = 0; i < px.length; i += 16) s += px[i] + px[i + 1] + px[i + 2]; out[m] = s > 0; } catch (e) { out[m] = String(e); } }); return out; });
  ok(Object.values(other).every(v => v === true), 'they also draw on a separate canvas, as a stage scene or a recording would (' + JSON.stringify(other) + ')');
  ok(await ev(() => { const d = window.__daily; d.vzSetMode('aurora'); return !!d.CFG.visMode && d.CFG.visMode === 'aurora'; }), 'a chosen backdrop is remembered');
  await ev(() => clearInterval(window.__sim));
  ok(t.errs.length === 0, 'no errors (' + t.errs.length + ')');
});
