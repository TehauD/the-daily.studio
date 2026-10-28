/* Loop & layer: record chords, hear them loop, play a lead on top, a looper pedal's way of working. It is built on the recording engine's
   cycle recording (one take per pass, earlier takes play back), so this runs real passes against the fake microphone.
   Own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
suite('e2e-looper', async t => {
  const { ok, wait, poll } = t, p = await t.open({ debug: true }), ev = f => p.evaluate(f);
  // a short song and a fast tempo (one bar at 150 BPM = 1.6 s), so passes come quickly
  await ev(() => { const d = window.__daily; d.S.bpm = 150; d.S.sections = [Object.assign({}, d.S.sections[0], { bars: d.S.sections[0].bars.slice(0, 2) })]; d.CFG.countIn = 1; d.CFG.vin = 'off'; d.CFG.armG = true; d.commit(false); });
  ok(await ev(async () => await window.__daily.ioConnect()), 'an input is connected');
  const st = () => ev(() => { const d = window.__daily, s = d.lpState(); return { on: d.LP.on, pass: d.LP.pass, rec: d.T.rec, playing: d.T.playing, recording: !!d.REC, takes: d.TAKES.map(x => x.name + ':' + x.dur.toFixed(1)), n: d.TAKES.length, state: s && s.t, bars: d.S.sections.reduce((a, x) => a + x.bars.length, 0), loop: [d.T.loopA, d.T.loopB, d.T.loop], band: [d.S.band.drumsOn, d.S.band.bassOn, d.S.band.compOn, d.S.band.leadOn].join(), metro: d.T.metro, armG: d.CFG.armG, hud: !!document.getElementById('lpHud'), hudText: (document.getElementById('lpHud') || {}).textContent || '' }; });

  // ---- the button and the window
  ok(await ev(() => { const b = document.getElementById('lpBtn'); return !!b && /Loop & layer/.test(b.textContent) && b.getClientRects().length > 0; }), 'the arrangement bar has a Loop & layer button');
  await ev(() => document.getElementById('lpBtn').click()); await wait(400);
  const dlg = await ev(() => { const d = document.getElementById('lpDlg'); return { open: !!d && d.open, segs: d ? [...d.querySelectorAll('.seg button')].map(b => b.textContent) : [], steps: d ? d.querySelectorAll('.lp-how li').length : 0 }; });
  ok(dlg.open && dlg.segs.join('|') === '1 bar|2 bars|4 bars|8 bars|Off · click only|On' && dlg.steps === 4, 'the window asks only for a loop length and whether the backing band plays (' + dlg.segs.join(' | ') + ')');
  await ev(() => { const d = document.getElementById('lpDlg'); [...d.querySelectorAll('.seg button')].find(b => b.textContent === '1 bar').click(); }); await wait(200);
  await ev(() => document.getElementById('lpGo').click());
  ok(await poll(() => ev(() => window.__daily.LP.on && !!window.__daily.T.playing), 6000), 'Start looping starts the transport');
  await wait(400); let s = await st();
  ok(s.loop[2] === true && s.loop[1] - s.loop[0] === 16 && s.armG === true && s.metro === true && s.band === 'false,false,false,false', 'it sets a one-bar loop, arms the guitar, turns the click on and clears the band away (' + s.loop.join(',') + ', band ' + s.band + ')');
  ok(s.hud && /count-in|Recording layer 1/i.test(s.hudText), 'a strip says where you are while it counts in: "' + s.hudText.slice(0, 40) + '"');
  // ---- passes: layer 1, then layer 2 while layer 1 plays back
  ok(await poll(() => ev(() => window.__daily.TAKES.length >= 2 && window.__daily.LP.pass >= 3), 14000), 'each pass of the loop is a take and the earlier ones keep playing (' + (await st()).takes.join(', ') + ')');
  s = await st();
  ok(/^Layer 1:/.test(s.takes[0]) && /^Layer 2:/.test(s.takes[1]) && s.takes.every(x => { const d = +x.split(':')[1]; return d > 1.1 && d < 2.2; }), 'layers are named in order and are one loop long (' + s.takes.join(', ') + ')');
  ok(/Recording layer \d/.test(s.hudText) && /pass \d/.test(s.hudText), 'the strip shows the layer being recorded and the pass: "' + s.hudText.slice(0, 60) + '"');
  // ---- keep looping: stop recording at the end of the pass, the loop carries on
  await ev(() => document.getElementById('lpKeep').click());
  ok(await ev(() => window.__daily.LP.finish === true && document.getElementById('lpKeep').disabled), 'Keep looping waits for the end of the pass');
  ok(await poll(() => ev(() => !window.__daily.T.rec && !window.__daily.REC), 6000), 'recording stops at the pass end');
  const before = (await st()).n; await wait(4200); s = await st();
  ok(s.playing && s.on && s.n === before && /Looping \d layer/.test(s.hudText), 'the loop keeps playing and no more layers are made (' + s.n + ' layers: "' + s.hudText.slice(0, 40) + '")');
  // ---- add a layer again: the next pass records
  await ev(() => document.getElementById('lpMore').click());
  ok(await poll(() => ev(() => !!window.__daily.REC && window.__daily.REC.cycle), 6000), 'Add a layer records on the next pass');
  ok(await poll(() => ev(() => window.__daily.TAKES.length > 0 && window.__daily.TAKES.length >= 3), 6000), 'and it ends up as another layer (' + (await st()).takes.join(', ') + ')');
  // ---- take the last layer back while it plays
  s = await st(); const n1 = s.n; await ev(() => document.getElementById('lpUndo').click()); await wait(500); s = await st();
  ok(s.n === n1 - 1 && s.playing, 'Undo layer removes the last layer and the loop keeps playing (' + n1 + ' → ' + s.n + ')');
  await ev(() => document.getElementById('lpStop').click()); await wait(700); s = await st();
  ok(!s.on && !s.playing && !s.hud && s.n >= 2, 'Stop ends it, removes the strip and keeps the layers (' + s.n + ' layers)');
  ok(await ev(() => { const d = window.__daily; return d.TAKES.every(x => x.kind === 'gtr') && new Set(d.TAKES.map(x => x.id)).size === d.TAKES.length; }), 'every layer is its own track, an ordinary take');

  // ---- a pass nobody played on is not kept (and a plain take still is)
  const sil = await ev(() => {
    const d = window.__daily; d.TAKES.length = 0; const mk = (loud, cycle) => { const n = 48000, a = new Float32Array(n); if (loud) for (let i = 0; i < n; i++) a[i] = Math.sin(i / 20) * .3; d.REC = { dry: [a], wet: [], vox: [], g: true, v: false, t0: 0, startSec: 0, bpm: 150, preset: d.CFG.preset || null, n: 0, cam: [], pkG: [], pkV: [], punch: null, tEnd: 0, cycle }; d.recEnd(); return d.TAKES.map(x => x.name); };
    return { quietLoop: mk(false, true), loudLoop: mk(true, true), loudPlain: mk(true, false) };
  });
  ok(sil.quietLoop.length === 0 && sil.loudLoop.join() === 'Layer 1' && sil.loudPlain.join() === 'Layer 1,Take 2', 'in a loop a silent pass is dropped and a played one is a Layer; outside a loop it is a Take (' + JSON.stringify(sil) + ')');

  // ---- a longer loop than the song makes the song longer
  await ev(() => { const d = window.__daily; d.TAKES.length = 0; d.T.loopB = null; d.T.loopA = 0; d.S.sections[0].bars.length = 2; d.T.bars = null; d.commit(false); });
  await ev(() => window.__daily.looperStart({ bars: 4, band: true })); await poll(() => ev(() => window.__daily.T.playing), 5000); s = await st();
  ok(s.bars >= 4 && s.loop[1] - s.loop[0] === 64 && s.band !== 'false,false,false,false' && s.on, 'a four-bar loop on a two-bar song adds the bars it needs, and "band on" leaves the band playing (' + s.bars + ' bars)');
  await ev(() => window.__daily.looperEnd()); await wait(500);
  // ---- no input: it says so and does not start
  await ev(() => { const d = window.__daily; d.E.hasInput = false; });
  const r = await ev(async () => { const d = window.__daily, ok = await d.looperStart({ bars: 1 }); return { ok, on: d.LP.on, playing: d.T.playing }; });
  ok(r.ok === false && !r.on && !r.playing, 'with no input open it asks you to connect one and does not start');
  ok(t.errors ? t.errors().length === 0 : true, 'no console errors');
});
