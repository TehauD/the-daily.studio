/* The Woodshed (2.25): scales, arpeggios and your ear, and the three secrets found there with the treasure each opens. The guitar is
   stood in for by the tuner's own readings (AN.active / AN.midi, as e2e-secrets does), so every note is exactly the one meant. */
const { suite } = require('./lib.cjs');
const SHEET = '[Verse]\nAm      F\nLanterns on the harbour wall\nC       G\nCalling all the boats back in';

suite('e2e-woodshed', async t => {
  const { ok, wait, poll } = t;
  const p = await t.open({}), ev = (f, a) => p.evaluate(f, a);
  await ev(async s => { const D = window.__daily; await D.startAudio(); await D.projCreate('blank', { form: 'empty' }); await window.dailyStudio.call('load_chord_sheet', { text: s }); D.S.title = 'Harbour'; D.commit(false); await D.projSave();
    const AN = D.AN; window.__f = { active: false, midi: null }; ['active', 'midi'].forEach(k => Object.defineProperty(AN, k, { configurable: true, get: () => window.__f[k], set: () => { } })); }, SHEET);
  /* play notes into the Woodshed: each held long enough to be heard, with a short gap */
  const play = ms => ev(async ms => { const nap = x => new Promise(r => setTimeout(r, x)); for (const m of ms) { window.__f.active = true; window.__f.midi = m; await nap(190); window.__f.active = false; window.__f.midi = null; await nap(70); } await nap(150); }, ms);
  const run = () => ev(() => { const r = window.__daily.WS.run; return r ? { mode: r.mode, i: r.i, miss: r.miss, n: r.notes.length, notes: r.notes.map(q => q.m) } : null; });

  /* ---- the way in, from the Theory panel ---- */
  await ev(() => { const D = window.__daily; D.S.key = 9; D.S.scale = 'Minor Pentatonic'; D.commit(false); D.sideShow('theory'); }); await wait(300);
  await ev(() => document.getElementById('theoryShed').click()); await wait(500);
  ok(await ev(() => { const d = document.getElementById('woodshed'); return !!(d && d.open) && ['scales', 'arps', 'ear', 'how'].every(k => d.querySelector('section[data-sec="' + k + '"]')) && document.getElementById('ws-key').value === '9' && document.getElementById('ws-scale').value === 'Minor Pentatonic'; }), 'Theory ▸ Practise it in the Woodshed opens the room on this key and scale: Scales, Arpeggios, Your ear');
  const SR = await ev(() => { const r = window.__daily.wsScaleRun(); return { n: r.notes.length, st: r.st, degs: r.notes.map(q => q.deg).join(' '), frets: r.notes.slice(0, 6).map(q => q.s + ':' + q.f).join(' ') }; });
  ok(SR.n === 11 && SR.st === 5 && SR.degs === 'R b3 4 5 b7 R b7 5 4 b3 R' && SR.frets === '0:5 0:8 1:5 1:7 2:5 2:7', 'A minor pentatonic from the 5th fret: the box every guitarist knows, up and back down (' + SR.degs + ')');
  ok(await ev(() => { const o = [...document.querySelectorAll('#ws-scale option')]; return o.length === 16 && o.filter(x => x.disabled).length === 11 && o.find(x => x.value === 'Dorian').disabled && /🔒 Modes and more scales/.test(document.getElementById('ws-room-scale').textContent); }), 'five scales to start with; the modes and the rest are locked, and the room says how they open');
  ok(await ev(() => document.querySelectorAll('#ws-room-scale .ws-fret .ws-dot').length === 6 && document.querySelectorAll('#ws-room-scale .ws-fret .ws-dot.root').length === 2 && document.querySelectorAll('#ws-room-scale .ws-fret .ws-ghost').length >= 4), 'the fretboard shows the run’s six places (the two roots marked), and the rest of the scale in the box, faint');

  /* ---- listen first ---- */
  await ev(() => document.getElementById('ws-scale-listen').click()); await wait(700);
  const L1 = await run(); await wait(1500); const L2 = await run();
  ok(L1 && L1.mode === 'listen' && L2.i > L1.i, '▶ Listen plays the run, and the fretboard follows it (note ' + (L1 && L1.i) + ' → ' + (L2 && L2.i) + ')');
  await ev(() => document.getElementById('ws-scale-stop').click());

  /* ---- play it: a wrong note counts, the last note still ringing does not ---- */
  await ev(() => document.getElementById('ws-scale-go').click()); await wait(200);
  const notes = (await run()).notes;
  await play([notes[0], notes[1], notes[1], 61, notes[2]]);      /* the second note heard again (ringing), then a C♯ that is not in the scale */
  const R1 = await run();
  ok(R1.i === 3 && R1.miss === 1, 'Play it follows the notes: a note still ringing is not a mistake, a wrong one is (' + R1.miss + ' wrong, at note ' + R1.i + ')');
  ok(await ev(() => /next: /.test(document.querySelector('#ws-room-scale .ws-stat').textContent) && document.querySelectorAll('#ws-room-scale .ws-chip.ok').length === 3), 'it says what is next, and ticks off what was played');
  await play(notes.slice(3)); await wait(200);
  ok((await run()).mode === 'done' && await ev(() => !window.__daily.CFG.secrets.scale), 'finished with a wrong note: done, but no secret');

  /* ---- Up and down: clean, and the treasure opens ---- */
  await ev(() => document.getElementById('ws-scale-go').click()); await wait(150); await play(notes);
  ok(await poll(() => ev(() => !!window.__daily.CFG.secrets.scale), 3000) && await ev(() => /Up and down/.test(document.getElementById('toasts').textContent) && /Modes and more scales are open/.test(document.getElementById('toasts').textContent) && /Secret 1 of 7/.test(document.getElementById('toasts').textContent)), 'up and back down without a wrong note: Up and down, secret 1 of 7, and it says what opened');
  await wait(1700);
  ok(await ev(() => !document.querySelector('#ws-scale option[value="Dorian"]').disabled && document.querySelectorAll('#ws-scale option:disabled').length === 0 && /🗝 Open: Modes/.test(document.getElementById('ws-room-scale').textContent)), 'the treasure: the modes and every other scale open in the room, at once');
  await ev(() => { const s = document.getElementById('ws-scale'); s.value = 'Dorian'; s.dispatchEvent(new Event('change')); }); await wait(200);
  ok(await ev(() => window.__daily.wsScaleRun().notes.length === 15 && window.__daily.wsScaleRun().notes.map(q => q.deg).slice(0, 8).join(' ') === 'R 2 b3 4 5 6 b7 R'), 'A Dorian: R 2 ♭3 4 5 6 ♭7 R, and back down');

  /* ---- arpeggios: this song's chords ---- */
  const AR = await ev(() => { const r = window.__daily.wsArpRun(); return { title: r.title, n: r.notes.length, chords: r.chords.length, degs: r.notes.slice(0, 4).map(q => q.deg).join(' ') }; });
  ok(AR.chords === 4 && /Am · F · C · G/.test(AR.title) && AR.degs === 'R b3 5 R', 'Arpeggios: this song’s chords in order, each from its root (' + AR.title + ', ' + AR.n + ' notes)');
  ok(await ev(() => { const s = document.getElementById('ws-src'); s.value = 'one'; s.dispatchEvent(new Event('change')); return [...document.querySelectorAll('#ws-type option')].filter(o => o.disabled).length === 5; }), 'one chord at a time: the four triads; the sevenths are locked');
  await ev(() => { const s = document.getElementById('ws-src'); s.value = 'song'; s.dispatchEvent(new Event('change')); }); await wait(150);
  await ev(() => document.getElementById('ws-arp-go').click()); await wait(150);
  await play((await run()).notes);
  ok(await poll(() => ev(() => !!window.__daily.CFG.secrets.arp), 3000) && await ev(() => /Broken chords/.test(document.getElementById('toasts').textContent)), 'four chords, every note, no mistake: Broken chords');
  await wait(1700);
  ok(await ev(() => { const s = document.getElementById('ws-src'); s.value = 'one'; s.dispatchEvent(new Event('change')); return [...document.querySelectorAll('#ws-type option')].every(o => !o.disabled) && /🗝 Open: Seventh/.test(document.getElementById('ws-room-arp').textContent); }), 'the treasure: seventh arpeggios open');
  ok(await ev(() => { const D = window.__daily; D.CFG.ws.type = 'm7'; D.CFG.ws.root = 9; const r = D.wsArpRun(); return r.notes.slice(0, 5).map(q => q.deg).join(' ') === 'R b3 5 b7 R'; }), 'A minor 7: R ♭3 5 ♭7 R');

  /* ---- your ear ---- */
  const answer = (right) => ev(r => { const D = window.__daily, q = D.WS.ear.q; const list = [...document.querySelectorAll('#ws-room-ear .ws-a')].map(b => b.dataset.a); const a = r ? q.ans : list.find(x => x !== q.ans); D.wsEarAnswer(a); D.WS.ear.lock = false; clearTimeout(D.WS.ear.tm); D.wsEarNext(); }, right);
  await ev(() => { const s = document.getElementById('ws-ear-mode'); s.value = 'easy'; s.dispatchEvent(new Event('change')); document.getElementById('ws-ear-go').click(); }); await wait(200);
  ok(await ev(() => document.querySelectorAll('#ws-room-ear .ws-a').length === 4 && !!window.__daily.WS.ear.q), 'Your ear: a question is played, four answers to choose from');
  for (let i = 0; i < 10; i++) await answer(true);
  ok(await ev(() => window.__daily.WS.ear.streak === 10 && !window.__daily.CFG.secrets.ear), 'ten in a row from four choices: a fine streak, but not the secret');
  await answer(false);
  ok(await ev(() => window.__daily.WS.ear.streak === 0 && window.__daily.WS.ear.best === 10), 'a wrong answer starts the streak again; the best is kept');
  await ev(() => { const s = document.getElementById('ws-ear-mode'); s.value = 'more'; s.dispatchEvent(new Event('change')); document.getElementById('ws-ear-go').click(); }); await wait(150);
  for (let i = 0; i < 10; i++) await answer(true);
  ok(await poll(() => ev(() => !!window.__daily.CFG.secrets.ear), 2000), 'ten in a row from six choices: Golden ear');
  await wait(1700);
  ok(await ev(() => { const o = document.querySelector('#ws-ear-mode option[value="chords"]'); return !o.disabled; }), 'the treasure: chord qualities by ear');
  await ev(() => { const s = document.getElementById('ws-ear-mode'); s.value = 'chords'; s.dispatchEvent(new Event('change')); document.getElementById('ws-ear-go').click(); }); await wait(200);
  ok(await ev(() => window.__daily.WS.ear.q.kind === 'chord' && document.querySelectorAll('#ws-room-ear .ws-a').length === 7), 'chord qualities: major, minor, diminished, augmented and three sevenths');
  ok(await ev(() => /3\/7/.test(document.querySelector('.secret-chip').textContent)), 'the 🗝 counter: 3 of 7');
  await ev(() => document.getElementById('woodshed').close());

  /* ---- with hidden surprises off, the treasures are simply open ---- */
  const q = await t.open({ init: () => { try { localStorage.setItem('fw.cfg', JSON.stringify({ eggs: false })); } catch (e) { } } });
  await q.evaluate(() => window.__daily.woodshedOpen()); await wait(400);
  ok(await q.evaluate(() => document.querySelectorAll('#ws-scale option:disabled').length === 0 && !document.querySelector('#ws-ear-mode option[value="chords"]').disabled && !/🔒/.test(document.getElementById('woodshed').textContent)), 'with hidden surprises off, nothing in the room is locked');
  ok(await q.evaluate(() => Object.keys(window.__daily.CFG.secrets).length === 0), 'and nothing is counted as found');
});
