/* Electronic (2.37): the piano roll (draw, lengthen, remove, loud/soft, scale only, keys or bass, loop the section, undo); sidechain ducking
   (the kick pushes the chosen tracks down and they swell back); MIDI out (keys, bass and drums on their channels, timed, General MIDI
   drums, the studio's own sound off if you like, live playing, all notes off on stop), with a stand-in output that records what is sent. */
const { suite } = require('./lib.cjs');
const SHEET = '[Verse]\nAm      F\nLanterns on the harbour wall\nC       G\nCalling all the boats back in';

suite('e2e-electronic', async t => {
  const { ok, wait, poll } = t;
  const p = await t.open({ w: 1440, h: 900 }), ev = (f, a) => p.evaluate(f, a);
  await ev(async s => { const D = window.__daily; await D.startAudio(); await window.dailyStudio.call('load_chord_sheet', { text: s }); D.S.bpm = 120; D.S.key = 9; D.S.minor = true; D.S.scale = 'Natural Minor (Aeolian)'; D.commit(false); D.goalGo('songwriter'); }, SHEET);
  await wait(300);

  /* ---- the piano roll ---- */
  await ev(() => document.getElementById('gtRoll').click()); await wait(400);
  const R0 = await ev(() => { const s = document.querySelector('#rollRoom .rl-svg'); return { open: document.getElementById('rollRoom').open, rows: s.querySelectorAll('.rl-row').length, cols: s._g.cols, want: window.__daily.S.sections[0].bars.length * window.__daily.spb(), part: window.__daily.RL.part }; });
  ok(R0.open && R0.rows === 25 && R0.cols === R0.want && R0.part === 'keys', '🎛 Piano roll (Songwriter tools): two octaves of rows and the section’s ' + R0.cols + ' sixteenths, for the keys part');
  const cell = (c, r) => ev(([c, r]) => { const s = document.querySelector('#rollRoom .rl-svg'), g = s._g, b = s.getBoundingClientRect(), W = +s.getAttribute('width'), H = +s.getAttribute('height'); return { x: b.left + (g.LW + c * g.CW + g.CW / 2) * b.width / W, y: b.top + (r * g.RH + g.RH / 2) * b.height / H, m: g.rows[r] }; }, [c, r]);
  const c1 = await cell(0, 12); await p.mouse.click(c1.x, c1.y); await wait(200);
  const c2 = await cell(4, 9), c3 = await cell(7, 9); await p.mouse.move(c2.x, c2.y); await p.mouse.down(); await p.mouse.move(c3.x, c3.y, { steps: 5 }); await p.mouse.up(); await wait(300);
  const N = await ev(() => window.__daily.S.sections[0].bars[0].keys.map(n => n.m + '@' + n.s + '/' + n.d));
  ok(N.length === 2 && N[0] === c1.m + '@0/1' && N[1] === c2.m + '@4/4', 'click adds a note; dragging right makes it longer (' + N.join(', ') + ')');
  ok(await ev(() => window.__daily.S.band.keysOn && document.querySelectorAll('#rollRoom .rl-note').length === 2), 'drawn notes switch the keys on in the band and show on the grid');
  await ev(() => { const n = document.querySelectorAll('#rollRoom .rl-note')[0], r = n.getBoundingClientRect(); window.__n = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); let pt = await ev(() => window.__n);
  await p.keyboard.down('Shift'); await p.mouse.click(pt.x, pt.y); await p.keyboard.up('Shift'); await wait(200);
  ok(await ev(() => window.__daily.S.sections[0].bars[0].keys[0].v === 1), 'Shift-click makes a note loud (then soft, then medium)');
  await ev(() => { const n = document.querySelectorAll('#rollRoom .rl-note')[1], r = n.getBoundingClientRect(); window.__n = { x: r.left + 4, y: r.top + r.height / 2 }; }); pt = await ev(() => window.__n);
  await p.mouse.click(pt.x, pt.y); await wait(200);
  ok(await ev(() => window.__daily.S.sections[0].bars[0].keys.length === 1), 'clicking a note removes it');
  await ev(() => window.__daily.undo()); await wait(200);
  ok(await ev(() => window.__daily.S.sections[0].bars[0].keys.length === 2), 'and undo puts it back');
  await ev(() => document.getElementById('rlScale').click()); await wait(200);
  ok(await ev(() => document.querySelectorAll('#rollRoom .rl-row').length === 15), 'Only the scale’s notes: the rows shrink to the scale (A minor: 15 rows across two octaves)');
  await ev(() => document.querySelector('#rlPart [data-p="bass"]').click()); await wait(200);
  const cb = await cell(0, 0); await p.mouse.click(cb.x, cb.y); await wait(200);
  ok(await ev(m => { const b = window.__daily.S.sections[0].bars[0]; return (b.bassLine || []).length === 1 && b.bassLine[0].m === m && window.__daily.RL.lo.bass === 28; }, cb.m), 'Bass: the rows move down to the bass register and a drawn note becomes the bass line');
  await ev(() => document.getElementById('rlPlay').click()); await poll(() => ev(() => window.__daily.T.playing), 3000);
  const LP = await ev(() => ({ a: window.__daily.T.loopA, b: window.__daily.T.loopB, loop: window.__daily.T.loop, want: window.__daily.S.sections[0].bars.length * window.__daily.spb() }));
  ok(LP.loop && LP.a === 0 && LP.b === LP.want, '▶ Loop this section loops just these bars while you draw');
  await ev(() => document.getElementById('rlPlay').click()); await wait(200);
  ok(await ev(() => !window.__daily.T.playing), 'and ■ Stop stops');
  await ev(() => document.getElementById('rollRoom').close());

  /* ---- sidechain ---- */
  const DK = await ev(async () => { const D = window.__daily, c = D.E.ctx, g = D.E.tr.keys.duck.gain, b = D.E.tr.bass.duck.gain; D.duckSet({ on: true, amt: 12, rel: 200, to: ['keys'] });
    const low = async (p, ms) => { let m = 1; const e = performance.now() + ms; while (performance.now() < e) { m = Math.min(m, p.value); await new Promise(r => setTimeout(r, 3)); } return m; };
    const t0 = c.currentTime + .05; D.drumHit(0, t0, 3); const [dip, bassDip] = await Promise.all([low(g, 250), low(b, 250)]); await new Promise(r => setTimeout(r, 800)); const back = g.value;
    D.duckSet({ on: false }); D.drumHit(0, c.currentTime + .05, 3); const off = await low(g, 250); return { dip, back, bassDip, off }; });
  ok(DK.dip < .4 && DK.back > .9, 'Sidechain: a kick pushes the keys down 12 dB (' + DK.dip.toFixed(2) + ') and they swell back (' + DK.back.toFixed(2) + ')');
  ok(DK.bassDip > .99 && DK.off > .99, 'only the tracks you tick, and nothing when it is off');
  ok(await ev(() => { window.__daily.rollOpen(); const ok = !!document.getElementById('duckOn') && document.querySelectorAll('#rollRoom [data-duck]').length === 4; document.getElementById('rollRoom').close(); return ok; }), 'its controls (depth, release, keys, bass, rhythm guitar, track) are in the piano roll and the Keys room');

  /* ---- MIDI out ---- */
  await ev(() => { const D = window.__daily; window.__mo = []; D.MIDI.access = D.MIDI.access || { inputs: new Map(), outputs: new Map(), onstatechange: null }; D.MIDI.access.outputs = new Map([['synth', { id: 'synth', name: 'Test synth', send: (d, ts) => window.__mo.push([Array.from(d), ts == null ? performance.now() : ts]) }]]); });
  await ev(() => window.__daily.openSettings('gear')); await wait(300);
  await ev(() => document.getElementById('moOn').click()); await wait(200);
  ok(await ev(() => !!document.getElementById('moOut') && document.querySelectorAll('[data-moch]').length === 3), 'Settings ▸ Pedal & MIDI sync ▸ MIDI out: a device, and a channel each for keys, bass and drums');
  await ev(() => { const s = document.getElementById('moOut'); s.value = 'synth'; s.dispatchEvent(new Event('change')); document.getElementById('moLocal').click(); document.getElementById('settings').close(); });
  const MO = await ev(async () => { const D = window.__daily; Object.assign(D.S.band, { drumsOn: true, bassOn: true, compOn: false, leadOn: false, keysOn: true, keysStyle: 'Block chords' }); D.S.sections.forEach(s => s.bars.forEach(b => { b.keys = []; b.bassLine = []; })); D.T.bars = null; D.commit(false); D.T.loop = false; D.T.cursor = 0; D.T.metro = false;
    const pk = id => { const an = D.E.tr[id].ana, b = new Float32Array(an.fftSize); an.getFloatTimeDomainData(b); return Math.max(...b.map(Math.abs)); }; let drums = 0, keys = 0;
    await D.play(); for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 50)); drums = Math.max(drums, pk('drums')); keys = Math.max(keys, pk('keys')); } D.stopPlay(true); await new Promise(r => setTimeout(r, 100));
    const on = window.__mo.filter(x => (x[0][0] & 0xf0) === 0x90), chs = [...new Set(on.map(x => x[0][0] & 15))].sort((a, b) => a - b), kick = on.filter(x => (x[0][0] & 15) === 9 && x[0][1] === 36).length, offs = window.__mo.filter(x => (x[0][0] & 0xf0) === 0x80).length, panic = window.__mo.filter(x => (x[0][0] & 0xf0) === 0xB0 && x[0][1] === 123).length;
    const ts = on.map(x => x[1]), ordered = ts.every((t, i) => !i || t >= ts[i - 1] - 30); return { n: on.length, chs, kick, offs, panic, drums, keys, ordered }; });
  ok(MO.chs.join() === '0,1,9' && MO.kick >= 2, 'playing, the keys go out on channel 1, the bass on 2 and the drums on 10 as General MIDI notes (kick 36): ' + MO.n + ' notes');
  ok(MO.offs >= MO.n * .9 && MO.ordered, 'every note has its note-off, and the times run in order (scheduled ahead, timed to what you hear)');
  ok(MO.drums < .002 && MO.keys < .002, 'with “Also play the studio’s own sound” off, the studio’s drums and keys stay quiet: the hardware plays');
  ok(MO.panic >= 3, 'stopping sends all-notes-off on each channel used');
  await ev(() => { window.__mo.length = 0; window.__daily.CFG.midiOut.local = true; window.__daily.keysOpen(); window.__daily.KY.target = 'keys'; window.__daily.kyNoteOn(64, .8); }); await wait(100); await ev(() => window.__daily.kyNoteOff(64)); await wait(50);
  const LV = await ev(() => window.__mo.map(x => x[0].join('.')));
  ok(LV[0] === '144.64.102' && LV[1] === '128.64.0', 'playing the Keys room sends straight to the synth (note on, note off), so a controller can play it through the studio');
  await ev(() => { document.getElementById('keysRoom').close(); window.__daily.CFG.midiOut.on = false; });
});
