/* Learn, part two (2.34): feedback after a go (wrong notes on the neck, a timing strip, advice with buttons, your take), 📅 Today
   (a daily plan with spaced review and a streak), 🎵 This song (the open song as lessons, up to its tempo) and 👂 By ear (call and
   response that grows). The guitar is stood in for by the tuner's readings and input onsets, as in e2e-learn. */
const { suite } = require('./lib.cjs');
const SHEET = '[Verse]\nAm      F\nLanterns on the harbour wall\nC       G\nCalling all the boats back in\n[Chorus]\nF    G    Am\nHold on, hold on';

suite('e2e-learn2', async t => {
  const { ok, wait, poll } = t;
  const p = await t.open({ w: 1280, h: 900 }), ev = (f, a) => p.evaluate(f, a);
  await ev(async s => { const D = window.__daily; await D.startAudio(); await window.dailyStudio.call('load_chord_sheet', { text: s }); D.S.key = 9; D.S.bpm = 100; D.S.title = 'Harbour'; D.commit(false);
    const AN = D.AN; window.__f = { active: false, midi: null, cents: 0, chord: [], vib: null }; ['active', 'midi', 'cents', 'chord', 'vib'].forEach(k => Object.defineProperty(AN, k, { configurable: true, get: () => window.__f[k], set: () => { } })); }, SHEET);
  const play = ms => ev(async ms => { const nap = x => new Promise(r => setTimeout(r, x)); for (const m of ms) { window.__f.active = true; window.__f.midi = m; await nap(260); window.__f.active = false; window.__f.midi = null; await nap(70); } await nap(200); }, ms);
  const quiet = () => ev(() => Object.assign(window.__f, { active: false, midi: null, cents: 0, chord: [], vib: null }));

  /* ---- 1 · feedback: a wrong note ---- */
  await ev(() => { const D = window.__daily, dst = D.E.ctx.createMediaStreamDestination(), o = D.E.ctx.createOscillator(); o.connect(dst); o.start(); window.__realStream = D.E.stream; D.E.stream = dst.stream; window.__osc = o; });      /* an input to record your take from */
  await ev(() => { const D = window.__daily; D.coachOpen(D.LESSONS[1].lessons[0].steps, 1, { title: 'Lead' }); }); await wait(300);
  const ms = await ev(() => window.__daily.CO.p.notes.filter(n => !n.r).map(n => n.m)), bpm0 = await ev(() => window.__daily.CO.bpm);
  await ev(() => window.__daily.coListen()); await play([ms[0], ms[1], ms[2] + 1].concat(ms.slice(2))); await wait(300);
  const F1 = await ev(() => { const D = window.__daily, fb = D.CO.fb; return { res: D.CO.res, tips: fb && fb.tips, want: document.querySelectorAll('#coFb .ws-dot.want').length, wrong: document.querySelectorAll('#coFb .ws-dot.wrong').length, part: !!document.getElementById('coFbPart'), again: !!document.getElementById('coFbAgain') }; });
  ok(F1.tips && /note 3: it wants .+ and you played .+ one fret too high/.test(F1.tips[0]), 'after a go the coach says which note went wrong and how: ' + (F1.tips && F1.tips[0]));
  ok(F1.want === 1 && F1.wrong === 1, 'and shows it on the neck: the note it wanted, and where you probably were (✕)');
  ok(F1.part && F1.again, 'with buttons: practise the tricky notes, or go again');
  ok(await poll(() => ev(() => !!document.getElementById('coTake')), 3000), 'your take was recorded while it listened: 🎧 Hear my take');
  await ev(() => document.getElementById('coTake').click()); await wait(300);
  ok(await ev(() => !!window.__daily.TAKE.au && !window.__daily.TAKE.au.paused), 'and plays it back, right next to ▶ Hear the coach');
  const n0 = await ev(() => window.__daily.CO.list.length); await ev(() => document.getElementById('coFbPart').click()); await wait(300);
  const P1 = await ev(() => { const D = window.__daily; return { n: D.CO.list.length, title: D.CO.p.title, k: D.CO.p.notes.length, bpm: D.CO.bpm, take: D.TAKE.url }; });
  ok(P1.n === n0 + 1 && /notes 2–5/.test(P1.title) && P1.k === 4 && P1.bpm < bpm0 + 5, '🔁 Practise notes 2–5 puts in a short, slower piece of just those notes, right after this one (' + P1.title + ', ' + P1.bpm + ' BPM)');
  ok(P1.take === null, 'and moving on drops the take: it was only ever in memory');
  await quiet(); await ev(() => { const D = window.__daily; window.__osc.stop(); D.E.stream = window.__realStream; document.getElementById('coach').close(); });

  /* ---- 1 · feedback: timing ---- */
  const RH = await ev(async () => { const D = window.__daily; D.coachOpen(D.LESSONS[0].lessons[3].steps, 1, { title: 'Rhythm' }); D.CO.bpm = 200; D.coListen(); await new Promise(r => setTimeout(r, 80)); const q = D.CO.seq, lat = D.rttMs() / 1000, pp = D.CO.p;
    let n = 0, skip = 0; for (let b = 0; b < 4; b++) [...pp.pattern].forEach((c, i) => { if (c === '.') return; n++; if (n % 7 === 3) { skip++; return; } D.bus.emit('tap:di', { onset: true, t: q.t0 + (b * 16 + i) * q.sd + lat + .045 + (n % 3) * .01 }); });
    return { skip, wait: (q.t0 - D.E.ctx.currentTime + 64 * q.sd) * 1000 + 700 }; });
  await poll(() => ev(() => !!window.__daily.CO.fb), RH.wait + 3000);
  const F2 = await ev(() => { const D = window.__daily, fb = D.CO.fb, it = fb.timing.items; return { tips: fb.tips, miss: it.filter(i => i.d == null).length, early: it.filter(i => i.d != null && i.d < 0).length, dots: document.querySelectorAll('#coFb .co-tl .tl-dot').length, hollow: document.querySelectorAll('#coFb .co-tl .tl-miss').length, n: it.length, slow: document.getElementById('coFbSlow') && document.getElementById('coFbSlow').textContent }; });
  ok(F2.miss === RH.skip && F2.hollow === RH.skip && F2.dots === F2.n - RH.skip, 'the timing strip: a dot for every stroke heard, a hollow ring for each of the ' + RH.skip + ' it did not hear');
  ok(F2.early === 0, 'every stroke counts for one beat only, so a late stroke is never also called early for the next beat');
  ok(F2.tips.some(x => /dragging, about \d+ ms behind/.test(x)) && F2.tips.some(x => /Furthest out: bar \d, beat \d/.test(x)), 'it says you are dragging, and where you were furthest out: ' + F2.tips.join(' / '));
  ok(/Slower: 190 BPM/.test(F2.slow || ''), 'and offers 🐢 Slower: 190 BPM');
  await ev(() => document.getElementById('coFbSlow').click()); await wait(200);
  ok(await ev(() => window.__daily.CO.bpm === 190 && !!window.__daily.CO.run), 'which starts the next go at 190');
  await ev(() => document.getElementById('coach').close()); await wait(200);

  /* ---- 2 · 📅 Today ---- */
  const T1 = await ev(() => { const D = window.__daily, L = D.CFG.learn; L.today = null; L.rev = {}; L.passes = {}; L.done = {}; const a = D.todayPlan(), b = D.todayPlan(); return { kinds: a.ids.map(x => x[0]).join(','), same: JSON.stringify(a.ids) === JSON.stringify(b.ids), streak: D.streak() }; });
  ok(/^warm,(read,)?new,riff$/.test(T1.kinds) && T1.same && T1.streak === 0, 'Today, first time: a warm-up, something new (with its explanation first) and a riff; nothing to review yet; the plan holds for the day (' + T1.kinds + ')');
  const T2 = await ev(() => { const D = window.__daily, L = D.CFG.learn, day = 864e5, now = Date.now(); L.rev = { 'l1.1': { n: 1, at: now - 2 * day }, 'l1.2': { n: 2, at: now - 2 * day }, 'rf-bl1': { n: 3, at: now - 10 * day } }; L.today = null; const a = D.todayPlan(); return a.ids.find(x => x[0] === 'review'); });
  ok(T2 && T2[1] === 'rf-bl1', 'a review comes back when it is due (after 1, 3, 7, 14, 30 days): the riff passed 10 days ago on its third go is the most overdue (' + JSON.stringify(T2) + ')');
  const T3 = await ev(() => { const D = window.__daily, L = D.CFG.learn, k = d => { const x = new Date(); x.setDate(x.getDate() - d); return D.dayKey(x.getTime()); }; L.passes = { [k(0)]: 2, [k(1)]: 1, [k(2)]: 4, [k(4)]: 1 }; const a = D.streak(), w = D.weekCount(); L.passes = { [k(1)]: 1, [k(2)]: 1 }; const b = D.streak(); return { a, w, b }; });
  ok(T3.a === 3 && T3.w === 8 && T3.b === 2, 'the streak counts days in a row (3, the gap ends it), and the week counts every step (8); not started today yet still counts from yesterday (2)');
  await ev(() => { const D = window.__daily, L = D.CFG.learn; L.passes = {}; L.rev = {}; L.today = null; D.learnOpen('today'); }); await wait(400);
  ok(await ev(() => document.querySelectorAll('#learn .td-row').length >= 3 && /Start a streak/.test(document.getElementById('tdStreak').textContent)), 'Learn opens on Today: the plan, and the streak');
  await ev(() => document.getElementById('lnToday').click()); await wait(400);
  const T4 = await ev(() => { const D = window.__daily; return { open: document.getElementById('coach').open, title: D.CO.title, n: D.CO.list.length, ids: D.CFG.learn.today.ids.length, first: D.CO.p.today }; });
  ok(T4.open && T4.title === 'Today' && T4.n === T4.ids && T4.first === 'warm', '▶ Start today’s session opens the coach on the warm-up, with the day’s ' + T4.n + ' pieces');
  const T5 = await ev(() => { const D = window.__daily, ids = D.CFG.learn.today.ids; ids.forEach(([, id]) => { D.CFG.learn.done[id] = Date.now(); D.learnPassed({ id }); }); return { streak: D.streak(), told: D.CFG.learn.today.told, all: ids.every(([, id]) => D.todayDone(id)) }; });
  await wait(700);
  ok(T5.all && T5.told && T5.streak === 1 && await ev(() => [...document.querySelectorAll('#toasts .toast')].some(x => /Today’s session is done. 1-day streak/.test(x.textContent))), 'finishing every piece says the session is done, and the streak is 1');
  await ev(() => document.getElementById('coach').close()); await wait(400);
  ok(await ev(() => document.querySelectorAll('#learn .td-row.done').length === document.querySelectorAll('#learn .td-row').length && /Go again/.test(document.getElementById('lnToday').textContent)), 'back in Learn, every row is ticked and the button says Go again');

  /* ---- 3 · 🎵 This song ---- */
  const S1 = await ev(() => { const D = window.__daily; D.CFG.learn.sbpm = {}; D.S.band.compStyle = 'Pop 8ths'; const ps = D.songLessons(); return { kinds: ps.map(x => x.kind).join(','), titles: ps.map(x => x.title), bpm: ps[1].bpm, target: ps[1].target, pat: ps[1].pattern, verse: ps.find(x => /Verse: the chords/.test(x.title)), whole: ps.find(x => x.title === 'The whole song') }; });
  ok(S1.titles[1] === 'The strum: Pop 8ths' && S1.pat === 'D...D.u.D...D.u.', 'This song starts with its own strum pattern (Pop 8ths, D...D.u.D...D.u.)');
  ok(S1.verse && S1.verse.back.chords.join(' ') === 'Am F C G' && S1.titles.includes('Chorus: the chords') && S1.whole && S1.whole.back.chords.length === 7, 'then each section’s chords in time (Verse: Am F C G), and the whole song’s ' + (S1.whole && S1.whole.back.chords.length) + ' bars');
  ok(S1.bpm === 70 && S1.target === 100, 'it starts at 70% of the song’s 100 BPM, and aims for 100');
  await ev(() => { const D = window.__daily; D.learnOpen('song'); }); await wait(300);
  ok(await ev(() => /Harbour/.test(document.querySelector('#learn .sg').textContent) && document.querySelectorAll('#learn [data-song-step]').length >= 5), 'Learn ▸ This song lists the steps for the open song');
  await ev(() => document.querySelector('#learn [data-song-step="2"]').click()); await wait(400);
  const S2 = await ev(async () => { const D = window.__daily; D.CO.bpm = 220; D.coListen(); await new Promise(r => setTimeout(r, 80)); const ch = D.CO.p.back.chords; window.__sg = setInterval(() => { const pos = D.coPos(); if (pos < 0) return; const bar = Math.floor(pos / 16); window.__f.active = true; window.__f.chord = [{ sym: ch[((bar % ch.length) + ch.length) % ch.length] }]; }, 20); return { title: D.CO.p.title, bars: D.CO.p.bars }; });
  await poll(() => ev(() => !!window.__daily.CO.res), (S2.bars + 2) * 16 * 60 / 220 / 4 * 1000 + 3000); await ev(() => clearInterval(window.__sg)); await quiet();
  ok(/^✓ \d of \d bars on the right chord/.test(await ev(() => window.__daily.CO.res)), S2.title + ': playing each chord as the band changes passes (' + await ev(() => window.__daily.CO.res) + ')');
  ok(await ev(() => { const D = window.__daily; return D.CFG.learn.sbpm[D.songKey()] >= 220 || D.CFG.learn.sbpm[D.songKey()] === 100; }), 'and the song remembers how far up the tempo you got (never past its own)');
  const S3 = await ev(() => { const D = window.__daily; D.CFG.learn.sbpm[D.songKey()] = 85; const p = D.songLessons()[1]; D.CO.p = Object.assign({}, p); D.CO.bpm = 100; const R = D.CO.run = { kind: 'rhythm', log: [], timing: null }; D.coFinish(R, true, '✓ Clean.'); return { bpm: D.CO.bpm, res: D.CO.res, start: p.bpm }; });
  ok(S3.start === 85 && S3.bpm === 100 && /song’s own tempo/.test(S3.res), 'next time it starts where you got to (85); at the song’s tempo the ladder stops there: ' + S3.res);
  await ev(() => document.getElementById('coach').close()); await wait(200);

  /* ---- 4 · 👂 By ear ---- */
  const E1 = await ev(() => { const D = window.__daily, o = { scale: 'Minor Pentatonic', key: 9 }, a = D.earLick(4, 11, o), b = D.earLick(4, 11, o), ok = [0, 3, 5, 7, 10];
    const all = []; for (let s = 1; s < 60; s++) for (const n of [2, 3, 5, 8]) all.push(D.earLick(n, s, o));
    return { same: JSON.stringify(a.src) === JSON.stringify(b.src), len: all.every(x => x.src.length === (x.id.split('.')[1] | 0)), scale: all.every(x => x.src.every(n => ok.includes(((n.i % 12) + 12) % 12))), root: all.filter(x => x.src.length < 4).every(x => x.src[0].i === 0), steps: all.every(x => x.src.every((n, i) => !i || (n.i !== x.src[i - 1].i && Math.abs(n.i - x.src[i - 1].i) <= 7))) }; });
  ok(E1.same && E1.len && E1.scale && E1.root && E1.steps, 'By ear phrases: the same seed gives the same phrase; the right length; every note in the scale; short ones start on the root; mostly by step, never a repeat or a leap over a fifth');
  await ev(() => { const D = window.__daily; D.CFG.learn.ear = { scale: 'Minor Pentatonic', len: 3, key: 9, best: 0 }; D.learnOpen('ear'); }); await wait(300);
  await ev(() => document.getElementById('lnEar').click()); await wait(400);
  const E2 = await ev(() => ({ hidden: !!document.getElementById('coHidden'), board: !!document.querySelector('#coach .co-board'), tab: !!document.querySelector('#coach .co-tab'), n: window.__daily.CO.p.notes.filter(x => !x.r).length, go: !!document.getElementById('coEarGo') }));
  ok(E2.hidden && !E2.board && !E2.tab && E2.n === 3 && E2.go, 'a phrase of 3 notes, the neck and the tab hidden, and 🎧 Hear it, then play it back');
  await ev(() => { window.__daily.CO.bpm = 220; document.getElementById('coEarGo').click(); }); await wait(300);
  ok(await ev(() => !!window.__daily.CO.seq && !window.__daily.CO.run), '🎧 plays it first…');
  ok(await poll(() => ev(() => !!window.__daily.CO.run), 6000), '…then listens for you to play it back');
  const em = await ev(() => window.__daily.CO.p.notes.filter(n => !n.r).map(n => n.m)); await play(em); await wait(200);
  ok(/^✓ All 3 notes/.test(await ev(() => window.__daily.CO.res)) && await ev(() => window.__daily.EAR.len === 4 && window.__daily.CFG.learn.ear.best === 3), 'played back right: passed, your best is 3, and the next one is 4 notes');
  ok(await poll(() => ev(() => window.__daily.CO.idx === 1 && window.__daily.CO.p.notes.filter(n => !n.r).length === 4), 4000), 'and it moves on to the next phrase by itself, a note longer');
  for (let k = 0; k < 2; k++) { const m4 = await ev(() => window.__daily.CO.p.notes.filter(n => !n.r).map(n => n.m)); await ev(() => window.__daily.coListen()); await play([m4[0] + 1, m4[0] + 2, m4[0] + 1].concat(m4)); await wait(200); if (!k) await ev(() => window.__daily.coSetPiece(window.__daily.CO.idx)); }
  ok(await ev(() => window.__daily.EAR.len === 3), 'two misses in a row (three wrong notes each time) and the next one is a note shorter again');
  await ev(() => document.getElementById('coReveal').click()); await wait(200);
  ok(await ev(() => !!document.querySelector('#coach .co-board') && !!document.querySelector('#coach .co-tab') && !document.getElementById('coHidden')), '👁 Show me shows the neck and the tab');
  await ev(() => document.getElementById('coach').close());

  /* ---- a phone ---- */
  const m = await t.open({ w: 390, h: 844, mobile: true }), mv = (f, a) => m.evaluate(f, a);
  await mv(() => window.__daily.learnOpen('today')); await wait(500);
  ok(await mv(() => [...document.querySelectorAll('#learn .td-row')].every(r => r.getBoundingClientRect().right <= innerWidth + .5) && document.documentElement.scrollWidth <= innerWidth + 1), 'on a phone, Today fits the screen');
});
