/* Learn (2.32): the Teacher workspace as a place to be taught. Lessons whose steps show, play, then listen (notes, chords, rhythm, bends,
   vibrato, landing on chord tones over a band); the riff library; Riff Lab and its variations; the scale atlas; riffs into the song;
   lesson files for teachers. The guitar is stood in for by the tuner's readings (AN.active / midi / cents / chord / vib, as
   e2e-scales-ear does) and strums by input onsets on the bus, at the audio-clock times meant. */
const { suite } = require('./lib.cjs');
const SHEET = '[Verse]\nAm      F\nLanterns on the harbour wall\nC       G\nCalling all the boats back in';

suite('e2e-learn', async t => {
  const { ok, wait, poll } = t;
  const p = await t.open({ w: 1280, h: 860 }), ev = (f, a) => p.evaluate(f, a);
  await ev(async s => { const D = window.__daily; await D.startAudio(); await window.dailyStudio.call('load_chord_sheet', { text: s }); D.S.key = 9; D.commit(false);
    const AN = D.AN; window.__f = { active: false, midi: null, cents: 0, chord: [], vib: null }; ['active', 'midi', 'cents', 'chord', 'vib'].forEach(k => Object.defineProperty(AN, k, { configurable: true, get: () => window.__f[k], set: () => { } })); }, SHEET);
  const play = ms => ev(async ms => { const nap = x => new Promise(r => setTimeout(r, x)); for (const m of ms) { window.__f.active = true; window.__f.midi = m; await nap(200); window.__f.active = false; window.__f.midi = null; await nap(60); } await nap(120); }, ms);
  const res = () => ev(() => window.__daily.CO.res);
  const quiet = () => ev(() => Object.assign(window.__f, { active: false, midi: null, cents: 0, chord: [], vib: null }));

  /* ---- the Teacher workspace ---- */
  await ev(() => window.__daily.goalGo('teacher')); await wait(500);
  ok(await ev(() => ['gtLearn', 'gtWarm', 'gtRiffs', 'gtLab', 'gtAtlas', 'gtInk', 'gtNotes', 'gtScreen'].every(id => document.getElementById(id)) && document.getElementById('gtLearn').classList.contains('gl-main')), 'the Teacher: 🎓 Learn first, then warm-ups, riffs, Riff Lab and the atlas; annotate, lesson notes and record screen are still there');
  await ev(() => document.getElementById('gtLearn').click()); await wait(500);
  ok(await ev(() => { const d = document.getElementById('learn'); return !!(d && d.open) && ['lessons', 'warm', 'riffs', 'lab', 'atlas', 'teach'].every(k => d.querySelector('section[data-sec="' + k + '"]')) && document.querySelectorAll('#learn [data-lesson]').length >= 20; }), 'Learn: lessons, warm-ups, riffs & licks, Riff Lab, the atlas and a room for teachers; four paths of lessons');

  /* ---- a lesson: read, listen, then play it note by note ---- */
  await ev(() => document.querySelector('[data-lesson="l1"]').click()); await wait(400);
  ok(await ev(() => { const D = window.__daily; return document.getElementById('coach').open && D.CO.p.kind === 'info' && !!D.CFG.learn.done['l1.0'] && document.querySelectorAll('#coach .co-dot').length === 4; }), 'a lesson opens in the coach at its first step; reading an explanation counts as done');
  await ev(() => document.getElementById('coNext').click()); await wait(300);
  const N = await ev(() => { const D = window.__daily, ns = D.CO.p.notes.filter(n => !n.r); return { kind: D.CO.p.kind, ms: ns.map(n => n.m), board: document.querySelectorAll('#coach .co-board .ws-dot').length, tab: document.querySelector('#coach .co-tab').textContent, bpm: D.CO.bpm }; });
  ok(N.kind === 'notes' && N.ms.length >= 5 && N.board >= 3 && /\|-*\d/.test(N.tab), 'the step shows its notes on the neck and as tab (' + N.ms.length + ' notes)');
  await ev(() => document.getElementById('coListen').click()); await wait(300);
  ok(await ev(() => !!window.__daily.CO.seq), '▶ Listen plays it first');
  await ev(() => document.getElementById('coGo').click()); await wait(100);
  ok(await ev(() => !window.__daily.CO.seq || window.__daily.CO.p.back), '● Play it stops the demo and listens');
  await play([N.ms[0], N.ms[0], N.ms[1], 61 + (N.ms[1] % 12 === 1 ? 1 : 0)]);
  const R1 = await ev(() => ({ i: window.__daily.CO.run.i, miss: window.__daily.CO.run.miss, live: document.querySelector('#coach .co-live').textContent }));
  ok(R1.i === 2 && R1.miss === 1 && /Next:/.test(R1.live), 'it follows you: a note still ringing is fine, a wrong one is counted, and it says what is next (' + R1.live + ')');
  await play(N.ms.slice(2)); await wait(150);
  const D1 = await ev(() => ({ res: window.__daily.CO.res, done: !!window.__daily.CFG.learn.done[window.__daily.CO.p.id], bpm: window.__daily.CO.bpm, dot: document.querySelectorAll('#coach .co-dot.done').length }));
  ok(/^✓ All \d+ notes, 1 wrong/.test(D1.res) && D1.done && D1.dot === 2, 'played to the end with one slip: done (' + D1.res + ')');
  ok(D1.bpm === N.bpm + 5, 'and the tempo ladder steps up 5 BPM for the next go (' + N.bpm + ' → ' + D1.bpm + ')');
  await quiet();

  /* ---- a chord ---- */
  await ev(() => window.__daily.coachOpen(window.__daily.LESSONS[0].lessons[1].steps, 0, { title: 'Foundations' })); await wait(300);
  ok(await ev(() => window.__daily.CO.p.kind === 'chord' && document.querySelectorAll('#coach .co-chord').length === 1 && /\d/.test(document.querySelector('#coach .co-shape').textContent)), 'a chord step shows the chord and its shape');
  await ev(() => { window.__daily.coListen(); window.__f.active = true; window.__f.chord = [{ sym: 'G' }]; }); await wait(500);
  ok(await ev(() => !!window.__daily.CO.run), 'the wrong chord does not count');
  await ev(() => { window.__f.chord = [{ sym: 'Em7' }]; }); await poll(async () => /^✓/.test(await res()), 3000);
  ok(/^✓ That is Em/.test(await res()), 'Em held (an Em7 is near enough): ' + await res());
  await quiet();

  /* ---- rhythm: strums against the coach's own click ---- */
  const RH = await ev(async () => { const D = window.__daily; D.coachOpen(D.LESSONS[0].lessons[3].steps, 1, { title: 'Rhythm' }); D.CO.bpm = 200; D.coListen(); await new Promise(r => setTimeout(r, 80)); const q = D.CO.seq, lat = (D.rttMs ? D.rttMs() : 20) / 1000, p = D.CO.p;
    let n = 0; for (let b = 0; b < 4; b++) [...p.pattern].forEach((c, i) => { if (c === '.') return; n++; D.bus.emit('tap:di', { onset: true, t: q.t0 + (b * 16 + i) * q.sd + lat - .02 + (n % 2 ? .006 : -.006) }); });
    return { pattern: p.pattern, n, wait: (q.t0 - D.E.ctx.currentTime + 64 * q.sd) * 1000 + 600 }; });
  await poll(async () => (await res()) !== '', RH.wait + 3000);
  const RR = await res();
  ok(/^✓ (\d+) of \1 strokes on the beat, 2\d ms off on average, a little early \(rushing\)/.test(RR), 'eighths (' + RH.pattern + ') played 20 ms ahead: all on the beat, and it says you are rushing (' + RR + ')');
  const RH2 = await ev(async () => { const D = window.__daily; D.coSetPiece(1); D.CO.bpm = 200; D.coListen(); await new Promise(r => setTimeout(r, 80)); const q = D.CO.seq, lat = (D.rttMs ? D.rttMs() : 20) / 1000, p = D.CO.p;
    for (let b = 0; b < 4; b++) [...p.pattern].forEach((c, i) => { if (c !== '.' && i % 4) D.bus.emit('tap:di', { onset: true, t: q.t0 + (b * 16 + i) * q.sd + lat + .05 }); });
    return (q.t0 - D.E.ctx.currentTime + 64 * q.sd) * 1000 + 600; });
  await poll(async () => (await res()) !== '', RH2 + 3000);
  ok(/^\d+ of \d+ strokes/.test(await res()) && !/^✓/.test(await res()), 'missing the downbeats and dragging is not passed: ' + await res());
  await ev(() => document.getElementById('coach').close());

  /* ---- a bend, and vibrato ---- */
  const B = await ev(() => { const D = window.__daily; D.coachOpen(D.LESSONS[1].lessons[1].steps, 1, { title: 'Bends' }); const n = D.CO.p.notes.find(x => !x.r); D.coListen(); return { kind: D.CO.p.kind, m: n.m, to: n.to }; });
  ok(B.kind === 'bend' && B.to - B.m >= 1, 'a bend step: from ' + B.m + ' up to ' + B.to);
  await ev(b => { Object.assign(window.__f, { active: true, midi: b.to - 1, cents: 40 }); }, B); await wait(500);
  ok(await ev(() => !!window.__daily.CO.run && /Bend: \+/.test(document.querySelector('#coach .co-live').textContent)), 'a bend that is short of the note is shown, not passed (' + await ev(() => document.querySelector('#coach .co-live').textContent) + ')');
  await ev(b => { Object.assign(window.__f, { midi: b.to, cents: 8 }); }, B); await poll(async () => /^✓/.test(await res()), 4000);
  ok(/^✓ Bent up \d semitone/.test(await res()), 'in tune at the top: ' + await res());
  await quiet();
  const V = await ev(() => { const D = window.__daily; D.coachOpen(D.LESSONS[1].lessons[2].steps, 1, { title: 'Vibrato' }); const n = D.CO.p.notes.find(x => !x.r); D.coListen(); Object.assign(window.__f, { active: true, midi: n.m, vib: { rate: 5.5, ext: 6 } }); return D.CO.p.kind; });
  await wait(1200);
  ok(V === 'vib' && await ev(() => !!window.__daily.CO.run), 'a vibrato step: a narrow wobble is not enough');
  await ev(() => { window.__f.vib = { rate: 5.5, ext: 20 }; }); await poll(async () => /^✓/.test(await res()), 3000);
  ok(/^✓ Vibrato: 5\.5 times a second, 40 cents wide/.test(await res()), 'a real one passes: ' + await res());
  await quiet();

  /* ---- landing on chord tones over the band ---- */
  const L = await ev(async () => { const D = window.__daily; D.coachOpen(D.LESSONS[1].lessons[5].steps, 1, { title: 'Solo' }); D.CO.bpm = 220; D.coListen(); await new Promise(r => setTimeout(r, 80));
    const p = D.CO.p, roots = p.back.chords.map(c => D.parseChord(c).root); window.__land = setInterval(() => { const pos = D.coPos ? D.coPos() : -1; if (pos < 0) return; const bar = Math.floor(pos / 16); window.__f.active = true; window.__f.midi = 57 + ((roots[bar % roots.length] - 9 + 12) % 12); }, 15);
    return { chords: p.back.chords, bars: p.bars || 8, kind: p.kind, seq: !!D.CO.seq }; });
  ok(L.kind === 'landing' && L.seq, 'Solo over the band: the band plays ' + L.chords.join(' – ') + ' while you play');
  await poll(async () => (await res()) !== '', (L.bars + 2) * 16 * 60 / 220 / 4 * 1000 + 3000);
  await ev(() => clearInterval(window.__land));
  ok(/^Landed on a chord tone [5-8] of 8/.test(await res()) && await ev(() => !!window.__daily.CFG.learn.done[window.__daily.CO.p.id]), 'landing on each new chord’s root: ' + await res());
  await quiet(); await ev(() => document.getElementById('coach').close());

  /* ---- the riff library ---- */
  await ev(() => { const d = document.getElementById('learn'); if (d && d.open) d.close(); window.__daily.learnOpen('riffs'); }); await wait(400);
  ok(await ev(() => document.querySelectorAll('#learn [data-riff]').length === 40 && window.__daily.RIFF_STYLES.length >= 8), '40 riffs in ' + await ev(() => window.__daily.RIFF_STYLES.join(', ')));
  await ev(() => { const s = document.getElementById('rfStyle'); s.value = 'Metal'; s.dispatchEvent(new Event('change')); }); await wait(300);
  ok(await ev(() => document.querySelectorAll('#learn [data-riff]').length === 5 && [...document.querySelectorAll('#learn [data-riff] small')].every(x => /^Metal/.test(x.textContent))), 'filtered to Metal: five');
  await ev(() => { const s = document.getElementById('rfStyle'); s.value = 'Blues'; s.dispatchEvent(new Event('change')); }); await wait(300);
  await ev(() => document.querySelector('#learn [data-riff="rf-bl1"]').click()); await wait(400);
  const K = await ev(async () => { const D = window.__daily, a = D.CO.p.notes.filter(n => !n.r).map(n => n.m), fr = D.CO.p.notes.filter(n => !n.r).map(n => n.f); const s = document.getElementById('coKey'); s.value = '4'; s.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 200)); const b = D.CO.p.notes.filter(n => !n.r).map(n => n.m); return { a, b, fr, acts: [...document.querySelectorAll('#coach .co-act button')].map(x => x.id) }; });
  ok(Math.min(...K.fr) >= 4 && Math.max(...K.fr) <= 9, 'the box-one turnaround sits in box one, frets ' + Math.min(...K.fr) + '–' + Math.max(...K.fr));
  ok(K.b.every((m, i) => ((m - K.a[i]) % 12 + 12) % 12 === 7) && K.b.every((m, i) => i === 0 || Math.sign(m - K.b[i - 1]) === Math.sign(K.a[i] - K.a[i - 1])), 'in E instead of A: every note a fourth lower (or a fifth higher), the shape unchanged');
  ok(['coTimed', 'coSong', 'coShare'].every(x => K.acts.includes(x)), 'a riff can go In time, into your song, or out as a file');
  await ev(() => document.getElementById('coTimed').click()); await wait(200);
  ok(await ev(() => window.__daily.CO.p.kind === 'timed' && window.__daily.CO.p.back.drums), 'In time: the same riff, against a drummer');

  /* ---- put it in my song ---- */
  const SG = await ev(async () => { const D = window.__daily, n0 = D.S.sections.length, ns = D.CO.p.notes.filter(n => !n.r); document.getElementById('coSong').click(); await new Promise(r => setTimeout(r, 200));
    const sec = D.S.sections.find(s => /turnaround/i.test(s.name)), tab = sec ? sec.bars.flatMap(b => b.tab) : [], tu = D.S.tuning, cap = D.S.capo || 0;
    const ms = sec ? sec.bars.flatMap((b, bi) => b.tab.map(x => ({ at: bi * D.spb() + x.s, m: tu[x.st] + cap + x.f }))).sort((a, b) => a.at - b.at || a.m - b.m).map(x => x.m) : [];
    return { n0, n1: D.S.sections.length, at: D.S.sections.indexOf(sec), tab: tab.length, want: ns.length, same: JSON.stringify(ms) === JSON.stringify(ns.map(n => n.m)), lead: D.S.band.leadOn }; });
  ok(SG.n1 === SG.n0 + 1 && SG.at === 1 && SG.tab === SG.want && SG.same && SG.lead, '➕ Put it in my song: a new section after the one you are in, with the riff as tab, note for note, and the lead playing it (' + JSON.stringify(SG) + ')');
  await ev(() => window.__daily.undo()); await wait(200);
  ok(await ev(n => window.__daily.S.sections.length === n, SG.n0), 'one undo takes it out again');
  await ev(() => document.getElementById('coach').close());

  /* ---- Riff Lab ---- */
  const LB = await ev(() => { const D = window.__daily, a = D.labMake({ seed: 7, scale: 'Minor Pentatonic', feel: 'Straight eighths', bars: 1, dens: .6, key: 9 }), b = D.labMake({ seed: 7, scale: 'Minor Pentatonic', feel: 'Straight eighths', bars: 1, dens: .6, key: 9 }), c = D.labMake({ seed: 8, scale: 'Minor Pentatonic', feel: 'Straight eighths', bars: 1, dens: .6, key: 9 });
    const ivs = [0, 3, 5, 7, 10], all = []; for (let s = 1; s <= 30; s++) { const x = D.labMake({ seed: s, scale: 'Minor Pentatonic', feel: ['Straight eighths', 'Funky sixteenths', 'Shuffle', 'Heavy half-time'][s % 4], bars: 1 + s % 2, dens: .6, key: 9 }); all.push(x); }
    const inScale = all.every(x => x.src.every(n => n.r || (n.ch || [n.i]).every(i => ivs.includes(((i % 12) + 12) % 12))));
    const ends = all.every(x => { const l = x.src[x.src.length - 1]; return [0, 7, 3].includes(((l.i % 12) + 12) % 12) && l.t === '~'; }), fits = all.every(x => x.src.every(n => n.at + n.len <= x.len) && x.len === (x.lab.bars > 1 ? 32 : 16));
    return { same: JSON.stringify(a.src) === JSON.stringify(b.src), diff: JSON.stringify(a.src) !== JSON.stringify(c.src), inScale, ends, fits, n: a.src.length }; });
  ok(LB.same && LB.diff, 'Riff Lab: the same seed makes the same riff, the next seed another');
  ok(LB.inScale && LB.ends && LB.fits, 'thirty ideas in four feels: every note in the scale, each ending on a chord tone with vibrato, all inside their one or two bars');
  const VR = await ev(() => { const D = window.__daily, a = D.labMake({ seed: 7, scale: 'Minor Pentatonic', feel: 'Straight eighths', bars: 1, dens: .6, key: 9 }), iv = x => x.src.filter(n => !n.r).map(n => n.i);
    const rev = D.labVary(a, 'reverse'), flip = D.labVary(a, 'flip'), seq = D.labVary(a, 'sequence'), sh = D.labVary(a, 'shift'), hi = D.labVary(a, 'higher'), bd = D.labVary(a, 'bends');
    const maj = [0, 2, 4, 7, 9];
    return { rev: JSON.stringify(iv(rev)) === JSON.stringify(iv(a).reverse()), flip: flip.lab.scale === 'Major Pentatonic' && iv(flip).every(i => maj.includes(((i % 12) + 12) % 12)), seq: seq.len === 32 && iv(seq).length === iv(a).length * 2, shift: JSON.stringify(sh.src.map(n => n.at)) !== JSON.stringify(a.src.map(n => n.at)) && sh.src.every(n => n.at < 16), hi: hi.lift !== a.lift || hi.near !== a.near, bends: bd.src.some(n => n.t === 'b') };
  });
  ok(Object.values(VR).every(Boolean), 'its variations: reverse, major ↔ minor, sequence to two bars, shift, higher up the neck, add bends (' + JSON.stringify(VR) + ')');
  await ev(() => { const d = document.getElementById('learn'); if (d.open) d.close(); window.__daily.learnOpen('lab'); }); await wait(300);
  await ev(() => document.getElementById('labGo').click()); await wait(400);
  ok(await ev(() => window.__daily.CO.p.lab && ['coVar-shift', 'coVar-reverse', 'coVar-flip', 'coVar-bends', 'coVar-higher', 'coVar-sequence', 'coKeep', 'coAgain', 'coSong'].every(id => document.getElementById(id))), '🎲 Make a riff opens it in the coach, with the variations, Keep, Another and Put it in my song');
  const t0 = await ev(() => window.__daily.CO.p.title); await ev(() => document.getElementById('coVar-reverse').click()); await wait(200);
  ok(await ev(t => window.__daily.CO.p.title !== t && /\(reverse\)/.test(document.getElementById('coachT').textContent), t0), 'a variation replaces the idea in place');
  await ev(() => document.getElementById('coKeep').click()); await wait(200);
  ok(await ev(() => window.__daily.CFG.learn.mine.length === 1 && /\(reverse\)/.test(window.__daily.CFG.learn.mine[0].title)), '★ Keep puts it in My riffs');
  /* the coach stays in front: 🎲 Another, then closing it and pressing Make a riff again, shows the new riff (2.33.2: the hub used to
     redraw itself in front of the coach, so the new riff opened out of sight) */
  const top = () => ev(() => { const c = document.getElementById('coach'), r = c.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + 24); return c.open && !!e && c.contains(e); });
  const a0 = await ev(() => window.__daily.CO.p.title); await ev(() => document.getElementById('coAgain').click()); await wait(300);
  const A1 = await ev(() => window.__daily.CO.p.title);
  ok(A1 !== a0 && await top(), '🎲 Another: a new riff, and the coach is still in front (' + a0 + ' → ' + A1 + ')');
  await ev(() => document.getElementById('coach').close()); await wait(300);
  ok(await ev(() => document.querySelectorAll('#learn .ln-card.mine').length === 1 || document.getElementById('learn').open), 'closing the coach brings back the Learn hub, brought up to date');
  await ev(() => { const d = document.getElementById('learn'); if (!d.querySelector('#labGo')) window.__daily.learnOpen('lab'); }); await wait(300);
  await ev(() => document.getElementById('labGo').click()); await wait(400);
  const A2 = await ev(() => window.__daily.CO.p.title);
  ok(A2 !== A1 && await top() && await ev(t => document.getElementById('coachT').textContent === t, A2), 'Make a riff again: the next riff, in front of the hub (' + A2 + ')');
  await ev(() => document.getElementById('coAgain').click()); await wait(200); await ev(() => document.getElementById('coAgain').click()); await wait(300);
  ok(await top(), 'and after Another twice more it is still in front');
  await ev(() => { document.getElementById('coach').close(); document.getElementById('learn').close(); const D = window.__daily; D.CFG.learn.rf = { style: '', lvl: 0 }; D.learnOpen('riffs'); }); await wait(300);
  ok(await ev(() => document.querySelectorAll('#learn .ln-card.mine').length === 1), 'and My riffs is listed under the library');

  /* ---- the scale atlas ---- */
  const AT = await ev(() => { const D = window.__daily, A = D.CFG.learn.atlas; Object.assign(A, { key: 9, minor: true, type: 'Pentatonic boxes' }); const box = D.atlasPieces();
    A.type = 'Three notes per string'; const tnps = D.atlasPieces(); A.type = 'Arpeggios'; A.chord = 'm7'; const arp = D.atlasPieces(); A.type = 'Modes over a vamp'; A.mode = 'Dorian'; A.pos = 1; const mode = D.atlasPieces(); A.type = 'Target notes'; const tgt = D.atlasPieces();
    const up = ps => ps.map(p => p.notes.slice(0, Math.ceil(p.notes.length / 2))), per = (ns, k) => { const c = {}; ns.forEach(n => c[n.s] = (c[n.s] || 0) + 1); return Object.values(c).every(x => x === k); };
    const b1 = box[0].notes.slice(0, 6).map(n => n.s + ':' + n.f).join(' ');
    return { nbox: box.length, b1, boxPer: up(box).every(ns => per(ns, 2)), boxPcs: box.every(p => p.notes.every(n => [9, 0, 2, 4, 7].includes(n.m % 12))), boxAsc: up(box).every(ns => ns.every((n, i) => !i || n.m > ns[i - 1].m)),
      ntn: tnps.length, tnPer: up(tnps).every(ns => per(ns, 3)), arpPcs: arp.every(p => p.notes.every(n => [9, 0, 4, 7].includes(n.m % 12))), narp: arp.length, arpBack: arp[0].back.chords[0],
      vamp: mode[0].back.chords.join(' '), star: mode[0].notes.filter(n => n.lab === '★').every(n => n.m % 12 === 6) && mode[0].notes.some(n => n.lab === '★'), modeLand: mode[1].kind, tgt: tgt[0].kind + ' ' + tgt[0].back.chords.join(' ') };
  });
  ok(AT.nbox === 5 && AT.b1 === '0:5 0:8 1:5 1:7 2:5 2:7' && AT.boxPer && AT.boxPcs && AT.boxAsc, 'the atlas: five pentatonic boxes, box 1 the one from the 5th fret, two notes a string, climbing (' + AT.b1 + ')');
  ok(AT.ntn === 7 && AT.tnPer, 'seven three-notes-per-string positions of A minor, three on every string');
  ok(AT.narp === 5 && AT.arpPcs && AT.arpBack === 'Am7', 'Am7 arpeggios in five positions: only A, C, E and G, over an Am7');
  ok(AT.vamp === 'Am D' && AT.star && AT.modeLand === 'landing', 'Dorian over Am – D, its major sixth (F♯) starred, then improvising over it');
  ok(AT.tgt === 'landing Am F C G', 'target notes over Am – F – C – G');
  await ev(() => { document.getElementById('learn').close(); window.__daily.CFG.learn.atlas.type = 'Pentatonic boxes'; window.__daily.learnOpen('atlas'); }); await wait(300);
  ok(await ev(() => document.querySelectorAll('#learn [data-atlas]').length === 5), 'the atlas room lists the five boxes');
  await ev(() => document.querySelector('#learn [data-atlas="2"]').click()); await wait(300);
  ok(await ev(() => /box 3/.test(document.getElementById('coachT').textContent) && document.querySelectorAll('#coach .co-board .ws-dot.root').length >= 2), 'box 3 in the coach, its roots marked');
  await ev(() => document.getElementById('coach').close());

  /* ---- for teachers: an exercise from the song, and lesson files ---- */
  const FS = await ev(() => { const D = window.__daily; D.T.cursor = 0; D.S.sections[0].bars.forEach(b => { b.tab = []; }); D.S.sections[0].bars[0].tab = [{ s: 0, st: 5, f: 5, t: '' }, { s: 4, st: 5, f: 8, t: 'b', bend: 10 }, { s: 8, st: 4, f: 5, t: '' }, { s: 8, st: 3, f: 5, t: '' }]; D.commit(false);
    const p = D.learnFromSong(), tu = D.S.tuning; return { n: p.notes.length, m0: p.notes[0].m === tu[5] + 5, chord: !!(p.notes[2].ch && p.notes[2].ch.length === 2), bend: p.notes.some(n => n.t === 'b'), title: p.title }; });
  ok(FS.n === 3 && FS.m0 && FS.chord && FS.bend, 'This section as an exercise: the tab of the section you are in, notes played together kept together (' + FS.title + ')');
  const RT = await ev(() => { const D = window.__daily, r = D.RIFFS.find(x => x.id === 'rf-fk1'), txt = D.learnFileText([Object.assign({}, r, { keyPc: 2 })], 'For Sam'); const o = JSON.parse(txt);
    const okOpen = D.learnOpenFile(txt), p = D.CO.p, a = D.coPlace(r.src, 0, r.near).filter(n => !n.r).map(n => n.i), b = p.src.filter(n => !n.r).map(n => n.i);
    return { kind: o.daily, noNotes: !('notes' in o.pieces[0]), okOpen, title: document.getElementById('coachT').textContent, key: p.keyPc, same: JSON.stringify(a) === JSON.stringify(b), list: D.CO.title }; });
  ok(RT.kind === 'lesson' && RT.noNotes && RT.okOpen && RT.key === 2 && RT.same && RT.list === 'For Sam', 'a riff shared as a lesson file and opened again: the same riff, in the key it was shared in (' + RT.title + ')');
  await ev(() => document.getElementById('coach').close());
  const BAD = await ev(() => { const D = window.__daily; return [D.learnOpenFile('not json'), D.learnOpenFile('{"daily":"song"}'), D.learnOpenFile(JSON.stringify({ daily: 'lesson', pieces: [{ kind: 'eval', title: 'x' }, { kind: 'chord', chords: ['Xq9'] }] }))]; });
  ok(BAD.every(x => x === false) && await ev(() => !document.getElementById('coach').open), 'a file that is not a lesson, or holds nothing playable, opens nothing');
  await ev(() => window.__daily.learnOpenFile(JSON.stringify({ daily: 'lesson', title: '<img src=x onerror=window.__pwn=1>', pieces: [{ kind: 'notes', title: '<b>hi</b>', text: '<script>window.__pwn=1</script>', notes: [{ at: 0, len: 2, m: 64, s: 5, f: 0 }, { at: 2, len: 2, m: 67, s: 5, f: 3 }] }] }))); await wait(300);
  ok(await ev(() => !window.__pwn && document.getElementById('coachT').textContent === '<b>hi</b>' && !document.querySelector('#coach img, #coach script')), 'what a file says is shown as text, never run');
  await ev(() => document.getElementById('coach').close());

  /* ---- progress is kept ---- */
  await p.reload(); await wait(3000);
  ok(await p.evaluate(() => { const L = window.__daily.CFG.learn; return !!L.done['l1.1'] && L.mine.length === 1; }), 'progress and kept riffs are still there after a reload (in this browser only)');

  /* ---- a phone ---- */
  const m = await t.open({ w: 390, h: 844, mobile: true }), mv = (f, a) => m.evaluate(f, a);
  await mv(() => window.__daily.learnOpen('lessons')); await wait(400);
  await mv(() => document.querySelector('[data-lesson="l1"]').click()); await wait(400); await mv(() => window.__daily.coSetPiece(1)); await wait(300);
  const PH = await mv(() => { const d = document.getElementById('coach'), r = d.getBoundingClientRect(), f = d.querySelector('svg.ws-fret'); return { fits: r.left >= 0 && r.right <= innerWidth + .5, narrow: f && f.classList.contains('narrow'), btn: [...d.querySelectorAll('.co-ctl .btn')].every(b => b.getBoundingClientRect().height >= 44), wide: document.documentElement.scrollWidth <= innerWidth + 1 }; });
  ok(PH.fits && PH.narrow && PH.btn && PH.wide, 'on a phone the coach fits the screen, the neck shows only the frets it needs, and the buttons are a thumb high (44 px) (' + JSON.stringify(PH) + ')');
});
