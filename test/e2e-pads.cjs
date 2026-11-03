/* Pads (2.29): six pads with the band's kit, tap tempo, a groove recorded in passes over the click, the grid, two-bar grooves that
   play both bars, the bass following the kick, and beatbox to beat (the analysis run on synthesised kicks, snares and hats). */
const { suite } = require('./lib.cjs');

suite('e2e-pads', async t => {
  const { ok, wait, poll } = t;
  const p = await t.open({ w: 1280, h: 860 }), ev = (f, a) => p.evaluate(f, a);
  await ev(async () => { const D = window.__daily; await D.startAudio(); await window.dailyStudio.call('load_chord_sheet', { text: '[Verse]\nG        D\nWalking down to the harbour wall\nEm       C\nLights along the water' }); D.S.bpm = 100; D.commit(false); });

  /* ---- the ways in ---- */
  await ev(() => window.__daily.dockGo('band')); await wait(300);
  ok(await ev(() => !!document.getElementById('bandPads')), 'the Band panel has a 🥁 Pads button');
  await ev(() => document.getElementById('bandPads').click()); await wait(400);
  ok(await ev(() => document.getElementById('pads').open && document.querySelectorAll('#pads .pad').length === 6), 'it opens six pads: kick, snare, hat, open hat, clap / rim, tom');

  /* ---- playing ---- */
  const drums0 = await ev(() => window.__daily.S.band.drumsOn);
  await p.keyboard.press('a'); await p.keyboard.press('d'); await wait(60);
  ok(await ev(() => document.querySelector('#pads [data-pad="0"]').classList.contains('hit') || document.querySelector('#pads [data-pad="2"]').classList.contains('hit')), 'A and D play the kick and the hat (the pad flashes)');
  ok(await ev(d => window.__daily.S.band.drumsOn === d, drums0), 'and D does not also switch the band’s drums, as it does outside the pads');
  await p.click('#pads [data-pad="1"]'); await wait(60);
  ok(await ev(() => document.querySelector('#pads [data-pad="1"]').classList.contains('hit')), 'a tap on a pad plays it');

  /* ---- tap tempo ---- */
  await ev(async () => { for (let i = 0; i < 5; i++) { window.__daily.padTap(); await new Promise(r => setTimeout(r, 500)); } });      /* steady taps, half a second apart */
  const bpm = await ev(() => window.__daily.S.bpm);
  ok(Math.abs(bpm - 120) <= 4 && await ev(() => /BPM/.test(document.querySelector('#pads .pad-bpm').textContent)), 'tapping every half second sets the tempo to about 120 (' + bpm + ')');
  await ev(() => window.__daily.undo()); ok(await ev(() => window.__daily.S.bpm === 100), 'undo puts the tempo back');

  /* ---- the grid ---- */
  await ev(() => window.__daily.padClear()); await wait(100);
  ok(await ev(() => [...document.querySelectorAll('#pads .pad-c')].every(c => c.dataset.v === '0') && document.querySelectorAll('#pads .pad-c').length === 6 * 16), 'Clear empties the pattern; the grid shows 6 rows of 16 steps');
  await p.click('#pads .pad-c[data-r="0"][data-i="0"]'); await p.click('#pads .pad-c[data-r="1"][data-i="4"]'); await p.click('#pads .pad-c[data-r="1"][data-i="4"]');
  const G = await ev(() => { const P = window.__daily.dpat(); return { a: P[0][0], b: P[1][4], n: window.__daily.S.band.patName }; });
  ok(G.a === 2 && G.b === 3 && G.n === 'Your groove', 'tapping a step writes it (normal), again makes it an accent (' + JSON.stringify(G) + ')');

  /* ---- recording a groove, in passes ---- */
  const loop0 = await ev(() => window.__daily.T.loop);
  await ev(() => window.__daily.padRecord(1)); await poll(() => ev(() => window.__daily.T.playing), 4000); await wait(300);
  const R = await ev(() => { const D = window.__daily, E = D.E, heard = E.ctx.currentTime - (E.ctx.outputLatency || E.ctx.baseLatency || 0), i = ((Math.round(D.slotAtTime(heard)) % 16) + 16) % 16; D.padHit(2, 2); const r = D.dpat()[2]; return { i, near: [i - 1, i, i + 1].some(k => r[((k % 16) + 16) % 16] >= 2), loop: D.T.loop, metro: D.T.metro, rec: !!D.PAD.rec, btn: document.querySelector('#pads .pad-rec').getAttribute('aria-pressed') }; });
  ok(R.rec && R.loop && R.metro && R.btn === 'true', '● Record loops the bar over the click');
  ok(R.near, 'a hit while recording is written on the grid where it was heard (step ' + (R.i + 1) + ')');
  await ev(() => window.__daily.padRecStop()); await wait(200);
  ok(await ev(l => !window.__daily.PAD.rec && !window.__daily.T.playing && window.__daily.T.loop === l, loop0), '■ Keep it stops, and the loop and the click go back as they were');
  ok(await ev(() => window.__daily.dpat()[0][0] === 2 && window.__daily.dpat()[1][4] === 3), 'what was there before the pass is still there: passes go on top');
  await ev(() => window.__daily.padUndoPass()); await wait(100);
  ok(await ev(() => window.__daily.dpat()[2].every(v => !v) && window.__daily.dpat()[0][0] === 2), '↶ Last pass takes that pass away, and only that');

  /* ---- two bars, both played; the bass follows the kick ---- */
  await ev(() => { const D = window.__daily; D.padResize(32); const P = D.dpat(); P.forEach(r => r.fill(0)); P[0][0] = 3; P[0][20] = 2; D.commit(false); });
  const B = await ev(() => { const D = window.__daily, ev2 = s => D.bassEvent('Follow the Kick', 'G', s % 16, 16, 'D', s); return { len: D.S.band.drumLen, a: ev2(0), b: ev2(4), c: ev2(20), d: ev2(52) }; });
  ok(B.len === 32, 'a two-bar loop is 32 steps');
  ok(B.a && B.c && B.d && !B.b && B.a.m === B.c.m, 'the bass plays the root on the kicks of both bars (steps 1 and 21, and again in the next pass), not between them');
  await p.click('#pads .pad-follow');
  ok(await ev(() => window.__daily.S.band.bassStyle === 'Follow the Kick' && window.__daily.S.band.bassOn), 'Bass follows the kick switches the bass to it');
  await p.click('#pads .pad-follow');
  ok(await ev(() => window.__daily.S.band.bassStyle !== 'Follow the Kick'), 'and back');

  /* ---- beatbox: the sounds told apart ---- */
  const BB = await ev(() => {
    const D = window.__daily, sr = 44100, slot = .125, L = 16, x = new Float32Array(Math.round(sr * slot * L) + sr); let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };
    const at = s => Math.round(s * slot * sr);
    const kick = s => { const a = at(s); for (let i = 0; i < sr * .15; i++) x[a + i] += .9 * Math.sin(2 * Math.PI * (70 - 30 * i / (sr * .15)) * i / sr) * Math.exp(-i / (sr * .05)); };
    const snare = s => { const a = at(s); let l1 = 0, l2 = 0; for (let i = 0; i < sr * .12; i++) { const n = rnd(); l1 = l1 * .55 + n * .45; const bp = l1 - l2; l2 = l2 * .97 + l1 * .03; x[a + i] += .7 * bp * Math.exp(-i / (sr * .04)); } };
    const hat = (s, long) => { const a = at(s); let pv = 0; for (let i = 0; i < sr * (long ? .3 : .05); i++) { const n = rnd(), d = n - pv; pv = n; x[a + i] += .35 * d * Math.exp(-i / (sr * (long ? .12 : .012))); } };
    kick(0); kick(8); snare(4); snare(12); [2, 6, 10].forEach(s => hat(s)); hat(14, true);
    const hits = D.bbHits(x, sr), pat = D.bbPattern(hits, 0, slot, L), on = r => pat[r].map((v, i) => v ? i : -1).filter(i => i >= 0).join();
    return { n: hits.length, kick: on(0), snare: on(1), hat: on(2), open: on(3) };
  });
  ok(BB.kick === '0,8' && BB.snare === '4,12', 'beatbox: a low thump is a kick (steps 1 and 9), a mid crack is a snare (5 and 13)' + ' (' + JSON.stringify(BB) + ')');
  ok(BB.hat === '2,6,10' && BB.open === '14', 'a short hiss is a hat, a long one an open hat');
  ok(await ev(() => !!document.querySelector('#pads .pad-bb')), 'and 🎤 Beatbox it is beside the pads');

  /* ---- a MIDI pad controller ---- */
  const M = await ev(() => { const D = window.__daily; let n = 0; D.onMidi({ data: [0x99, 38, 120] }); n += document.querySelector('#pads [data-pad="1"]').classList.contains('hit') ? 1 : 0; return n; });
  ok(M === 1, 'a MIDI pad on note 38 plays the snare (General MIDI drums)');
  await ev(() => document.getElementById('pads').close()); await wait(200);
  ok(await ev(() => !window.__daily.PAD.rec && !window.__daily.PAD.el.open), 'closing the pads stops any recording');

  /* ---- on a phone ---- */
  const m = await t.open({ w: 390, h: 844, mobile: true }), mv = (f, a) => m.evaluate(f, a);
  await mv(() => window.__daily.padsOpen()); await wait(500);
  ok(await mv(() => { const d = document.getElementById('pads'), r = document.querySelector('#pads .pad').getBoundingClientRect(); return d.scrollWidth <= d.clientWidth + 1 && r.height >= 80 && document.querySelector('#pads .pad-grid').getBoundingClientRect().right <= innerWidth; }), 'on a phone the pads are big enough for thumbs and the grid fits the screen');
});
