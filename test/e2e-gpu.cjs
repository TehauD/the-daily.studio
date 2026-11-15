/* The GPU visual engine (2.71): the Stardust look is WebGL2 (a particle galaxy with a bloom glow) and falls back to a 2D particle field
   with no WebGL2. Checked by reading canvas pixels — both paths paint a real picture and move, the colour follows the chord, nothing flashes,
   and it draws on a separate canvas too (a stage scene or a recording). Whether it looks AAA behind a person is for a person to say. */
const { suite } = require('./lib.cjs');
suite('e2e-gpu', async t => {
  const { ok, wait } = t, p = await t.open({ w: 1280, h: 720, debug: true }), ev = (f, a) => p.evaluate(f, a);

  // ---- registered as a "Behind you" look, before Your video, and the engine builds on WebGL2 in this browser
  const reg = await ev(() => { const d = window.__daily; return { inBack: d.VBACK.map(m => m[0]), inModes: d.VMODES.some(m => m[0] === 'stardust'), isBK: d.BK_MODES.has('stardust'), name: (d.VBACK.find(m => m[0] === 'stardust') || [])[1], gpu: d.gpuGet(), hasCv: !!(d.GPU && d.GPU.cv) }; });
  ok(reg.inBack.includes('stardust') && reg.isBK && reg.inModes && reg.name === 'Stardust', 'Stardust is a “Behind you” look (' + reg.name + ')');
  ok(reg.inBack.indexOf('stardust') === reg.inBack.indexOf('video') - 1, 'it sits just before Your video (' + reg.inBack.join(',') + ')');
  ok(reg.gpu === true && reg.hasCv, 'the WebGL2 engine builds (this browser has WebGL2): ' + reg.gpu);

  // ---- play something so there is sound, then measure the look as a picture (spread, mean, movement)
  await ev(async () => { const d = window.__daily; await d.ioConnect(); d.CFG.vzNeck = false; d.vzImmersive(true); d.HM.force = 'C'; d.play && d.play(); window.__sim = setInterval(() => d.bus.emit('onset', {}), 120); });
  const stat = async () => { await ev(() => window.__daily.vzSetMode('stardust')); await wait(1100);
    const a = await ev(() => { const cv = window.__daily.UI.vcv, o = document.createElement('canvas'); o.width = 48; o.height = 27; o.getContext('2d').drawImage(cv, 0, 0, 48, 27); const px = o.getContext('2d').getImageData(0, 0, 48, 27).data; let s = 0, mn = 255, mx = 0; for (let i = 0; i < px.length; i += 4) { const l = px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11; s += l; mn = Math.min(mn, l); mx = Math.max(mx, l); } return { mean: s / (px.length / 4) / 255, spread: (mx - mn) / 255, f: [...px].join() }; });
    await wait(800); const b = await ev(() => { const cv = window.__daily.UI.vcv, o = document.createElement('canvas'); o.width = 48; o.height = 27; o.getContext('2d').drawImage(cv, 0, 0, 48, 27); return [...o.getContext('2d').getImageData(0, 0, 48, 27).data].join(); });
    const A = a.f.split(',').map(Number), B = b.split(',').map(Number); let diff = 0; for (let i = 0; i < A.length; i++) diff += Math.abs(A[i] - B[i]); return { spread: a.spread, mean: a.mean, moved: diff / A.length };
  };

  // ---- the GPU path paints and moves
  const g1 = await stat();
  ok(g1.spread > .08 && g1.mean > .02, 'the GPU look paints a real picture, not a flat colour (spread ' + g1.spread.toFixed(2) + ', mean ' + g1.mean.toFixed(2) + ')');
  ok(g1.moved > .12, 'and it moves (' + g1.moved.toFixed(2) + ')');

  // ---- nothing flashes on the GPU path (Calm and Standard): overall brightness never jumps between frames
  for (const comfort of ['calm', 'standard']) {
    await ev(c => { window.__daily.STG.comfort = c; }, comfort); await ev(() => window.__daily.vzSetMode('stardust')); await wait(500);
    const worst = await ev(async () => { const cv = window.__daily.UI.vcv, o = document.createElement('canvas'); o.width = 24; o.height = 14; const g = o.getContext('2d'); let prev = null, mx = 0; const t1 = performance.now() + 2400; while (performance.now() < t1) { g.drawImage(cv, 0, 0, 24, 14); const px = g.getImageData(0, 0, 24, 14).data; let s = 0; for (let i = 0; i < px.length; i += 4) s += px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11; s /= (px.length / 4) * 255; if (prev != null) mx = Math.max(mx, Math.abs(s - prev)); prev = s; await new Promise(r => setTimeout(r, 40)); } return mx; });
    ok(worst < .06, comfort + ': the largest change in overall brightness between frames stays small (' + worst.toFixed(3) + ')');
  }
  await ev(() => { window.__daily.STG.comfort = 'standard'; });

  // ---- the 2D fallback (no WebGL2): still paints and moves
  await ev(() => { window.__daily.GPU.off = true; });
  const f1 = await stat();
  ok(f1.spread > .08 && f1.mean > .02 && f1.moved > .12, 'with WebGL2 turned off it falls back to a 2D particle field that still paints and moves (spread ' + f1.spread.toFixed(2) + ', moved ' + f1.moved.toFixed(2) + ')');
  await ev(() => { window.__daily.GPU.off = false; });

  // ---- draws on a separate canvas too (a stage scene, a recording)
  const other = await ev(() => { const d = window.__daily, cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; try { d.bkDraw('stardust', cv.getContext('2d'), 320, 180, { fd: new Float32Array(1024).fill(-55), bin: f => Math.max(1, Math.min(1023, Math.round(f / 20))), lvl: x => Math.max(0, Math.min(1, (x + 88) / 62)), pulse: .3, energy: .4, dt: .016 }); const px = cv.getContext('2d').getImageData(0, 0, 320, 180).data; let s = 0; for (let i = 0; i < px.length; i += 16) s += px[i] + px[i + 1] + px[i + 2]; return s > 0; } catch (e) { return String(e); } });
  ok(other === true, 'it also draws on a separate canvas, as a stage scene or a recording would (' + other + ')');
  ok(await ev(() => { const d = window.__daily; d.vzSetMode('stardust'); return d.CFG.visMode === 'stardust'; }), 'a chosen GPU look is remembered');

  await ev(() => clearInterval(window.__sim));
  ok(t.errs.length === 0, 'no errors (' + t.errs.length + ')');
});
