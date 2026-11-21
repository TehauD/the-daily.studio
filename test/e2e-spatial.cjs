/* Spatial audio (2.74): off by default; turning it on routes each band part through a 3D HRTF panner placed around you (not the click),
   without silencing the mix; Spin moves the sources; turning it off restores the plain path. WebXR is feature-detected and simply absent
   where no headset supports it (as in this test browser), so nothing runs. Measured on the real audio graph. */
const { suite } = require('./lib.cjs');
suite('e2e-spatial', async t => {
  const { ok, wait } = t, p = await t.open({ w: 1200, h: 820 }), ev = (f, a) => p.evaluate(f, a);
  await ev(async () => { await window.__daily.startAudio(); });
  await wait(200);

  // ---- off by default
  ok(await ev(() => window.__daily.SPAT.on === false), 'spatial audio is off by default');

  // ---- turning it on builds an HRTF panner for each band part (not the click), each placed somewhere different around you
  const on = await ev(() => {
    const D = window.__daily, r = D.spatToggle(true), p = D.SPAT.p, ids = Object.keys(p);
    const xs = ids.map(k => { try { return p[k].positionX ? +p[k].positionX.value.toFixed(2) : 0; } catch (e) { return 0; } });
    return { r, on: D.SPAT.on, ids, hrtf: ids.every(k => p[k].panningModel === 'HRTF'), click: ids.includes('click'), distinct: new Set(xs).size };
  });
  ok(on.r === true && on.on && on.ids.length >= 6 && on.hrtf, 'turning it on puts each band part through an HRTF panner (' + on.ids.join(', ') + ')');
  ok(!on.click, 'the click is left in the centre, not spatialised');
  ok(on.distinct >= 3, 'the parts are placed at different points around you (' + on.distinct + ' distinct positions)');

  // ---- it does not silence the mix: a tone fed into a band part still reaches the master, with spatial on and off
  const rms = await ev(async () => {
    const D = window.__daily, c = D.E.ctx, an = c.createAnalyser(); an.fftSize = 2048; D.E.limiter.connect(an);
    const osc = c.createOscillator(); osc.frequency.value = 220; const g = c.createGain(); g.gain.value = .3; osc.connect(g); g.connect(D.E.tr.drums.in); osc.start();
    const read = () => { const b = new Float32Array(an.fftSize); an.getFloatTimeDomainData(b); let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * b[i]; return Math.sqrt(s / b.length); };
    await new Promise(r => setTimeout(r, 250)); const withOn = read();
    D.spatToggle(false); await new Promise(r => setTimeout(r, 250)); const withOff = read();
    try { osc.stop(); D.E.limiter.disconnect(an); } catch (e) { } return { withOn, withOff };
  });
  ok(rms.withOn > 1e-4 && rms.withOff > 1e-4, 'the tone reaches the master both with spatial on and off — the re-routing never drops the audio (' + rms.withOn.toFixed(4) + ' / ' + rms.withOff.toFixed(4) + ')');

  // ---- turning it off clears the panners (back to the plain stereo path)
  ok(await ev(() => window.__daily.SPAT.on === false && Object.keys(window.__daily.SPAT.p).length === 0), 'turning it off removes the panners and restores the plain mix');

  // ---- Spin moves the sources around you
  const spin = await ev(async () => {
    const D = window.__daily; D.spatToggle(true); D.spatSet('spin', 1); const id = Object.keys(D.SPAT.p)[0];
    const x0 = D.SPAT.p[id].positionX.value; await new Promise(r => setTimeout(r, 600)); const x1 = D.SPAT.p[id].positionX.value; D.spatToggle(false);
    return Math.abs(x1 - x0);
  });
  ok(spin > .01, 'Spin turns the band around you (a source moved ' + spin.toFixed(2) + ')');

  // ---- the control shows in the visuals ⋯ More panel
  await ev(() => { window.__daily.CFG.vzMore = true; window.__daily.dockGo('vis'); }); await wait(300);
  ok(await ev(() => !!document.getElementById('spatBtn')), 'the 🎧 Spatial control is in the visuals ⋯ More panel');

  // ---- WebXR is feature-detected: with no headset support (this browser) there is no VR button, and nothing runs
  ok(await ev(() => { const D = window.__daily; const el = D.xrControl(); const no = !navigator.xr || !navigator.xr.isSessionSupported; return no ? (el === '' && !document.getElementById('xrBtn')) : true; }), 'the 🥽 VR button is absent where immersive VR is not supported (it never runs untested)');
  ok(await ev(() => typeof window.__daily.xrEnter === 'function' && window.__daily.XR.session === null), 'the WebXR entry exists but no session is open');

  await ev(() => window.__daily.spatToggle(false));
  ok(t.errs.length === 0, 'no errors (' + t.errs.length + ')');
});
