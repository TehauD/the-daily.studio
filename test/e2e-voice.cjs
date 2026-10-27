/* Voice: the pitch ribbon, the range finder and "Find my key". Own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
suite('e2e-voice', async t => {
  const { ok, wait, poll } = t, p = await t.open({ debug: true });
  const ev = (f, a) => p.evaluate(f, a);

  // the pure parts
  ok(await ev(() => { const d = window.__daily; d.S.key = 9; d.S.minor = true; d.S.scale = 'Natural Minor (Aeolian)'; const sc = d.voxScale(); return [9, 11, 0, 2, 4, 5, 7].every(x => sc.has(x)) && !sc.has(10); }), 'the key’s notes come from the song’s scale');
  ok(await ev(() => { const d = window.__daily, a = d.voxTarget(69.1), b = d.voxTarget(70.4); return a.n === 69 && Math.abs(a.err - 10) < .01 && b.n === 71 || b.n === 69; }), 'a pitch is matched to the nearest note of the key, with its cents error');
  ok(await ev(() => { const d = window.__daily; return d.voxXSym('Am7/G', 2, false) === 'Bm7/A' && d.voxXSym('F#m', 1, false) === 'Gm' && d.voxXSym('Bb', 2, true) === 'C' && d.voxXSym('C', -1, true) === 'B'; }), 'chords and slash basses move by semitones');
  ok(await ev(() => { const d = window.__daily, r = d.voxRange({ 48: 2, 50: 1, 52: 1, 55: 3, 57: 2, 60: 1, 62: .1, 70: .05 }); return r && r.lo === 48 && r.hi === 60 && r.c0 >= 48 && r.c1 <= 60 && r.c0 <= r.c1; }), 'a range ignores notes held under a quarter second');
  ok(await ev(() => window.__daily.voxRange({ 60: .3 }) === null), 'too little singing gives no range');
  const plan = await ev(() => { const d = window.__daily; return d.voxPlan({ lo: 45, hi: 65, c0: 48, c1: 60 }, { lo: 57, hi: 68 }, 9); });
  ok(plan.length === 3 && plan[0].d < 0 && plan[0].fit && plan[0].hi <= 60, 'a melody that is too high for the voice is moved down (' + plan.map(x => x.d).join(', ') + ')');
  ok(await ev(() => { const d = window.__daily, q = d.voxPlan({ lo: 45, hi: 70, c0: 50, c1: 66 }, { lo: 55, hi: 65 }, 9); return q[0].d === 0 && q[0].fit; }), 'a melody that already fits is left alone');
  ok(await ev(() => { const d = window.__daily, q = d.voxPlan({ lo: 40, hi: 60, c0: 43, c1: 55 }, null, 9); return q.length === 3 && q[0].fit; }), 'with no melody to measure it still suggests a key');

  // transposing the whole song is one undo step
  await ev(() => { const d = window.__daily; d.S.key = 9; d.S.minor = true; d.S.sections = [{ id: 'a', name: 'Verse', lyrics: '[Am]hello [G]there', bars: [{ chord: 'Am F', tab: [{ s: 0, st: 1, f: 5 }, { s: 4, st: 0, f: 23 }] }, { chord: 'C G/B', tab: [] }] }]; d.commit(false); });
  const u0 = await ev(() => window.__daily.histStack.u.length);
  await ev(() => window.__daily.voxTranspose(3));
  let s = await ev(() => { const d = window.__daily; return { key: d.S.key, ch: d.S.sections[0].bars.map(b => b.chord), ly: d.S.sections[0].lyrics, tab: d.S.sections[0].bars[0].tab.map(x => x.f), u: d.histStack.u.length }; });
  ok(s.key === 0 && s.ch[0] === 'Cm Ab' && s.ch[1] === 'Eb Bb/D' && /\[Cm\]/.test(s.ly) && /\[Bb\]/.test(s.ly), 'transposing moves the key, the chords and the [chords] in the lyrics (' + s.ch.join(' | ') + ')');
  ok(s.tab[0] === 8 && s.tab[1] === 14 && s.u === u0 + 1, 'tab frets move and stay on the neck (' + s.tab.join(', ') + '), as one undo step');
  await p.keyboard.press('Control+z'); await wait(300);
  s = await ev(() => { const d = window.__daily; return { key: d.S.key, ch: d.S.sections[0].bars[0].chord }; });
  ok(s.key === 9 && s.ch === 'Am F', 'Undo puts the song back');

  // the window, with the (fake) microphone
  ok(await ev(async () => await window.__daily.ioConnect()), 'an input is connected');
  await p.click('#sbVoice'); ok(await poll(() => ev(() => !!document.getElementById('voxPanel') && !!document.getElementById('voxCv')), 3000), 'the Voice window opens from the song bar');
  await wait(2500);
  ok(await ev(() => window.__daily.VOX.hist.length > 20), 'the ribbon is reading the input');
  ok(await ev(() => { const cv = document.getElementById('voxCv'), g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 17) if (d[i + 3] > 0 && (d[i] > 40 || d[i + 1] > 40)) n++; return n > 30; }), 'the ribbon is drawn');
  await p.click('#voxCapture'); await ev(() => { window.__daily.VOX.hit = { 48: 1.2, 50: 1, 52: 1, 55: 2, 57: 1.5, 60: 1, 62: .6, 64: .4 }; }); await wait(600);
  ok(await ev(() => /–/.test(document.getElementById('voxLive').textContent)), 'while capturing it shows the notes heard so far (' + await ev(() => document.getElementById('voxLive').textContent) + ')');
  await p.click('#voxCapture'); await wait(500);
  const rg = await ev(() => window.__daily.CFG.vrange);
  ok(rg && rg.lo <= rg.hi, 'Done keeps the range (' + JSON.stringify(rg) + ')');
  ok(await ev(() => !!document.getElementById('voxRes')), 'Find my key shows its advice once a range is kept');
  // stage ribbon toggle
  await p.click('#voxClose'); ok(await ev(() => !document.getElementById('voxPanel')), 'Close closes the window');
  await ev(() => { window.__daily.dockGo('vis'); }); await wait(500);
  await p.click('#vzRibbonBtn'); ok(await ev(() => window.__daily.CFG.vzRibbon === true && document.getElementById('vzRibbonBtn').getAttribute('aria-pressed') === 'true'), 'the Pitch button puts the ribbon on the visuals');
  await wait(1500); ok(await ev(() => window.__daily.VOX.hist.length > 20), 'it keeps reading while only the visuals are showing');
  // the kill switch ends it
  await p.keyboard.press('Control+.'); await wait(600);
  ok(await ev(() => !window.__daily.E.hasInput), 'the kill switch releases the input (the ribbon has nothing to read)');
});
