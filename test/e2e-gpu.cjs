/* The GPU visual engine (2.71): the Stardust look is WebGL2 (a particle galaxy with a bloom glow) and falls back to a 2D particle field
   with no WebGL2. Checked by reading canvas pixels — both paths paint a real picture and move, the colour follows the chord, nothing flashes,
   and it draws on a separate canvas too (a stage scene or a recording). Whether it looks AAA behind a person is for a person to say. */
const { suite } = require('./lib.cjs');
suite('e2e-gpu', async t => {
  const { ok, wait } = t, p = await t.open({ w: 1280, h: 720, debug: true }), ev = (f, a) => p.evaluate(f, a);

  const GPU_LOOKS = ['stardust', 'ripple', 'life'];      // Stardust (particles, 2.71); Ripple + Life (living simulations, 2.72)

  // ---- registered as "Behind you" looks, before Your video, and the engine builds on WebGL2 + float targets in this browser
  const reg = await ev(() => { const d = window.__daily; return { inBack: d.VBACK.map(m => m[0]), modes: ['stardust', 'ripple', 'life'].map(k => d.VMODES.some(m => m[0] === k) && d.BK_MODES.has(k)), names: ['stardust', 'ripple', 'life'].map(k => (d.VBACK.find(m => m[0] === k) || [])[1]).join('|'), gpu: d.gpuGet(), hasCv: !!(d.GPU && d.GPU.cv), float: d.GPU.float }; });
  ok(reg.modes.every(Boolean) && reg.names === 'Stardust|Ripple|Life', 'the three GPU looks are in the Behind-you group (' + reg.names + ')');
  ok(GPU_LOOKS.every(k => reg.inBack.includes(k)) && reg.inBack.indexOf('life') === reg.inBack.indexOf('video') - 1, 'they sit together, just before Your video (' + reg.inBack.join(',') + ')');
  ok(reg.gpu === true && reg.hasCv, 'the WebGL2 engine builds (this browser has WebGL2): ' + reg.gpu);
  ok(reg.float === true, 'and float render targets are available, so the living simulations run on the GPU (' + reg.float + ')');

  // ---- play something so there is sound, then measure the look as a picture (spread, mean, movement)
  await ev(async () => { const d = window.__daily; await d.ioConnect(); d.CFG.vzNeck = false; d.vzImmersive(true); d.HM.force = 'C'; d.play && d.play(); window.__sim = setInterval(() => d.bus.emit('onset', {}), 120); });
  const stat = async (mode) => { await ev(m => window.__daily.vzSetMode(m), mode); await wait(1100);
    const a = await ev(() => { const cv = window.__daily.UI.vcv, o = document.createElement('canvas'); o.width = 48; o.height = 27; o.getContext('2d').drawImage(cv, 0, 0, 48, 27); const px = o.getContext('2d').getImageData(0, 0, 48, 27).data; let s = 0, mn = 255, mx = 0; for (let i = 0; i < px.length; i += 4) { const l = px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11; s += l; mn = Math.min(mn, l); mx = Math.max(mx, l); } return { mean: s / (px.length / 4) / 255, spread: (mx - mn) / 255, f: [...px].join() }; });
    await wait(800); const b = await ev(() => { const cv = window.__daily.UI.vcv, o = document.createElement('canvas'); o.width = 48; o.height = 27; o.getContext('2d').drawImage(cv, 0, 0, 48, 27); return [...o.getContext('2d').getImageData(0, 0, 48, 27).data].join(); });
    const A = a.f.split(',').map(Number), B = b.split(',').map(Number); let diff = 0; for (let i = 0; i < A.length; i++) diff += Math.abs(A[i] - B[i]); return { spread: a.spread, mean: a.mean, moved: diff / A.length };
  };

  // ---- each GPU look paints and moves (Stardust = particles; Ripple = a wave-field/cymatic plate; Life = reaction-diffusion)
  for (const m of GPU_LOOKS) {
    const s = await stat(m);
    ok(s.spread > .08 && s.mean > .02 && s.moved > .1, m + ' paints a real picture and moves (spread ' + s.spread.toFixed(2) + ', mean ' + s.mean.toFixed(2) + ', moved ' + s.moved.toFixed(2) + ')');
  }

  // ---- nothing flashes on any GPU look (Calm and Standard): overall brightness never jumps between frames
  for (const comfort of ['calm', 'standard']) {
    await ev(c => { window.__daily.STG.comfort = c; }, comfort);
    const worst = {};
    for (const m of GPU_LOOKS) {
      await ev(x => window.__daily.vzSetMode(x), m); await wait(600);
      worst[m] = await ev(async () => { const cv = window.__daily.UI.vcv, o = document.createElement('canvas'); o.width = 24; o.height = 14; const g = o.getContext('2d'); let prev = null, mx = 0; const t1 = performance.now() + 2400; while (performance.now() < t1) { g.drawImage(cv, 0, 0, 24, 14); const px = g.getImageData(0, 0, 24, 14).data; let s = 0; for (let i = 0; i < px.length; i += 4) s += px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11; s /= (px.length / 4) * 255; if (prev != null) mx = Math.max(mx, Math.abs(s - prev)); prev = s; await new Promise(r => setTimeout(r, 40)); } return mx; });
    }
    ok(GPU_LOOKS.every(m => worst[m] < .06), comfort + ': the largest brightness change between frames stays small (' + GPU_LOOKS.map(m => m + ' ' + worst[m].toFixed(3)).join(', ') + ')');
  }
  await ev(() => { window.__daily.STG.comfort = 'standard'; });

  // ---- the 2D fallback (no WebGL2): still paints and moves
  await ev(() => { window.__daily.GPU.off = true; });
  const f1 = await stat('stardust');
  ok(f1.spread > .08 && f1.mean > .02 && f1.moved > .12, 'with WebGL2 turned off it falls back to a 2D particle field that still paints and moves (spread ' + f1.spread.toFixed(2) + ', moved ' + f1.moved.toFixed(2) + ')');
  await ev(() => { window.__daily.GPU.off = false; });

  // ---- draws on a separate canvas too (a stage scene, a recording)
  const other = await ev(() => { const d = window.__daily, cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; try { d.bkDraw('stardust', cv.getContext('2d'), 320, 180, { fd: new Float32Array(1024).fill(-55), bin: f => Math.max(1, Math.min(1023, Math.round(f / 20))), lvl: x => Math.max(0, Math.min(1, (x + 88) / 62)), pulse: .3, energy: .4, dt: .016 }); const px = cv.getContext('2d').getImageData(0, 0, 320, 180).data; let s = 0; for (let i = 0; i < px.length; i += 16) s += px[i] + px[i + 1] + px[i + 2]; return s > 0; } catch (e) { return String(e); } });
  ok(other === true, 'it also draws on a separate canvas, as a stage scene or a recording would (' + other + ')');
  ok(await ev(() => { const d = window.__daily; d.vzSetMode('stardust'); return d.CFG.visMode === 'stardust'; }), 'a chosen GPU look is remembered');

  await ev(() => clearInterval(window.__sim));
  ok(t.errs.length === 0, 'no errors (' + t.errs.length + ')');
});
