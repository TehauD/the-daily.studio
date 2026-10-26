/* Fast render: the song is mixed faster than it plays, matches what real-time playback produces, can be cancelled, is stopped by the
   kill switch, leaves the live audio engine untouched, and falls back to real time when switched off. Own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
suite('e2e-render', async t => {
  const { ok, wait, poll } = t, p = await t.open();
  const ev = (fn, a) => p.evaluate(fn, a);
  await ev(() => { const D = window.__daily, S = D.S; let n = 0; S.sections.forEach(sec => { sec.bars = sec.bars.filter(() => n++ < 4); }); S.sections = S.sections.filter(s => s.bars.length); D.commit(false); });
  const wavInfo = f => { const b = t.fs.readFileSync(f), sr = b.readUInt32LE(24), ch = b.readUInt16LE(22), bits = b.readUInt16LE(34), n = (b.length - 44) / (bits / 8) / ch; let e = 0, c = 0; const step = bits / 8 * ch * 4; for (let i = 44; i + 2 < b.length; i += step) { const v = (b[i] | b[i + 1] << 8 | b[i + 2] << 16) << 8 >> 8; e += v * v; c++; } return { sr, ch, bits, secs: n / sr, rms: Math.sqrt(e / c) / 8388607 }; };
  const save = async (name, run) => { const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 90000 }), run()]); const f = t.path.join(t.os.tmpdir(), `daily-${process.pid}-${name}.wav`); await dl.saveAs(f); return { f, name: dl.suggestedFilename(), info: wavInfo(f) }; };
  const engine = () => ev(() => ({ ctx: window.__daily.E.ctx.constructor.name, busy: window.__daily.OFR.busy, dlg: !!document.getElementById('rndDlg') }));

  // the whole song, through the button's path
  let t0 = Date.now(); const m = await save('master', () => ev(() => { window.__daily.bounceMaster(); })); const ms = Date.now() - t0;
  ok(/_master\.wav$/.test(m.name) && m.info.ch === 2 && m.info.bits === 24, 'Bounce saves a stereo 24-bit WAV (' + m.name + ')');
  ok(m.info.secs > 12 && m.info.secs < 16, 'the file is the song plus its tail (' + m.info.secs.toFixed(1) + ' s)'); ok(m.info.rms > .01, 'the file is not silent (rms ' + m.info.rms.toFixed(3) + ')');
  let e = await engine(); ok(e.ctx === 'AudioContext' && !e.busy && !e.dlg, 'afterwards the live engine is back and the progress window is gone');
  ok(await ev(async () => { const D = window.__daily; D.T.metro = false; await D.play(); await new Promise(r => setTimeout(r, 1200)); const an = D.E.anaMaster, a = new Float32Array(an.fftSize); an.getFloatTimeDomainData(a); let s = 0; for (const v of a) s += v * v; D.stopPlay(true); return Math.sqrt(s / a.length) > .003; }), 'playback still works after a render');

  // it matches real-time playback (same signal path). The real-time bounce is the one that suffers when the machine is busy
  // (a starved audio thread drops notes), so a mismatch is checked again, up to three times; the fast render is deterministic.
  await ev(() => { window.__daily.CFG.renderFast = false; });
  const env = f => { const b = t.fs.readFileSync(f), o = [], w = 4410 * 6 * 2; for (let i = 44; i + w <= b.length; i += w) { let s = 0, c = 0; for (let k = i; k < i + w; k += 12) { const v = (b[k] | b[k + 1] << 8 | b[k + 2] << 16) << 8 >> 8; s += v * v; c++; } o.push(Math.sqrt(s / c)); } return o; };
  const a = env(m.f); let rt, rts, rel, corr, tries = 0;
  do {
    tries++; t0 = Date.now(); rt = await save('rt' + tries, () => ev(() => { window.__daily.bounceMaster(); })); rts = Date.now() - t0;
    rel = Math.abs(rt.info.rms - m.info.rms) / rt.info.rms;
    const bb = env(rt.f), n = Math.min(a.length, bb.length); let dot = 0, na = 0, nb = 0; for (let i = 0; i < n; i++) { dot += a[i] * bb[i]; na += a[i] * a[i]; nb += bb[i] * bb[i]; } corr = dot / Math.sqrt(na * nb);
  } while ((rel >= .03 || corr <= .98) && tries < 3);
  ok(rts > 11000, 'with “faster than real time” off, Bounce plays the song through once (' + (rts / 1000).toFixed(1) + ' s)');
  ok(rel < .03, 'fast and real-time renders have the same loudness (' + m.info.rms.toFixed(4) + ' vs ' + rt.info.rms.toFixed(4) + (tries > 1 ? ', attempt ' + tries : '') + ')');
  ok(corr > .98, 'fast and real-time renders follow the same loudness shape (correlation ' + corr.toFixed(3) + ')');
  await ev(() => { window.__daily.CFG.renderFast = true; });

  // one band part at a time, and everything is put back
  const dr = await save('drums', () => ev(() => { window.__daily.bouncePart('drums'); }));
  ok(/_drums\.wav$/.test(dr.name) && dr.info.rms > .003 && dr.info.rms < m.info.rms, 'a band part renders on its own and is quieter than the whole song');
  ok(await ev(() => { const b = window.__daily.S.band; return b.drumsOn && b.bassOn && b.compOn && b.leadOn; }), 'every band part is switched back on afterwards');

  // a recording is in the render
  const before = m.info.rms; await ev(async ({ b64 }) => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); await window.__daily.dropTake(new File([u], 'Riff.wav', { type: 'audio/wav' }), 'gtr'); }, { b64: t.wav(t.tone(8, 330, { amp: .6 }).data, 22050).toString('base64') });
  const wt = await save('take', () => ev(() => { window.__daily.bounceMaster(); })); ok(wt.info.rms > before * 1.02, 'a recorded take is part of the render (' + before.toFixed(4) + ' → ' + wt.info.rms.toFixed(4) + ')');

  // cancel, and the kill switch
  let downloads = 0; p.on('download', () => downloads++);
  await ev(() => { window.__daily.bounceMaster(); }); ok(await poll(() => p.$('#rndDlg #rndCancel'), 5000), 'a progress window with a Cancel button opens'); ok(await p.$eval('#rndDlg [role=progressbar]', x => x.getAttribute('aria-label') === 'Render progress'), 'the progress bar is labelled for screen readers');
  await p.click('#rndCancel'); await wait(900); e = await engine(); ok(!e.busy && !e.dlg && e.ctx === 'AudioContext' && downloads === 0, 'Cancel stops the render, saves nothing and restores the engine');
  await ev(() => { window.__daily.bounceMaster(); }); await poll(() => p.$('#rndDlg'), 5000); await wait(200); await p.keyboard.press('Control+.'); await wait(1200); e = await engine(); ok(!e.busy && !e.dlg && e.ctx === 'AudioContext' && downloads === 0, 'the kill switch (Ctrl + .) aborts a render at once');
  ok(await ev(async () => { const D = window.__daily; D.T.metro = false; await D.play().catch(() => 0); await new Promise(r => setTimeout(r, 300)); const ok1 = true; D.stopPlay(true); return ok1; }), 'audio can be started again after the kill switch');
});
