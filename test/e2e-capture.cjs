/* Capture and the Write canvas (2.9). Everything here uses synthetic string-like audio (decaying harmonics, a pick transient, a strum stagger,
   test/capture_synth.js), not a real guitar, so it proves the engine and the wiring, not how a given guitar, pickup or room will behave.
   Own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs'); const fs = require('node:fs'), path = require('node:path');
const SYN = fs.readFileSync(path.join(__dirname, 'capture_synth.js'), 'utf8');
suite('e2e-capture', async t => {
  const { ok, wait, poll } = t, p = await t.open({ debug: true }), ev = (f, a) => p.evaluate(f, a); await ev(SYN);
  const CH = { E: [40,47,52,56,59,64], A: [45,52,57,61,64], D: [50,57,62,66], G: [43,47,50,55,59,67], C: [48,52,55,60,64], Am: [45,52,57,60,64], Em: [40,47,52,55,59,64], Dm: [50,57,62,65], F: [41,48,53,57,60,65], A5: [45,52,57] };
  const SINGLES = [40, 42, 45, 48, 50, 55, 57, 59, 64, 67, 71];

  // ---- the engine on its own: single notes and chords, clean and over a chord still ringing
  for (const sr of [48000, 44100]) {
    const r = await ev(([CH, SINGLES, sr]) => {
      const d = window.__daily, out = { single: 0, singleRing: 0, named: 0, namedRing: 0, falseNotes: 0, notes: 0, spread: 0, shapes: 0 };
      const win = (notes, prev) => { const buf = new Float32Array(sr * 2); if (prev) SY.strike(buf, sr, prev, .1, { amp: .2 }); SY.strike(buf, sr, notes, .6, { amp: .2 }); return SY.windows(buf, sr, .6); };
      SINGLES.forEach(m => { const w = win([m]), g = d.capNotes(w.post, w.pre, sr).map(x => x.midi); if (g.join() === String(m)) out.single++; const w2 = win([m], CH.C), g2 = d.capNotes(w2.post, w2.pre, sr).map(x => x.midi); if (g2.join() === String(m) || (CH.C.includes(m))) out.singleRing++; });
      for (const k in CH) for (const prev of [null, CH.Em]) {
        const w = win(CH[k], prev), nn = d.capNotes(w.post, w.pre, sr), mi = nn.map(x => x.midi), res = d.capInterpret(mi, nn.chroma);
        if (res && res.sym === k) { if (prev) out.namedRing++; else out.named++; }
        out.notes += mi.length; out.falseNotes += mi.filter(m => !CH[k].includes(m) && !CH[k].some(c => c % 12 === m % 12)).length;
        if (res && res.items) { const sts = res.items.map(i => i.st); if (new Set(sts).size === sts.length) out.spread++; }
      }
      return out;
    }, [CH, SINGLES, sr]);
    ok(r.single >= 10, `${sr} Hz: single notes come out exactly (${r.single} of ${SINGLES.length}, and ${r.singleRing} after a ringing chord)`);
    ok(r.named >= 8, `${sr} Hz: chords are named correctly when struck clean (${r.named} of 10)`);
    ok(r.namedRing >= 7, `${sr} Hz: ...and over a chord still ringing (${r.namedRing} of 10)`);
    ok(r.falseNotes <= 2, `${sr} Hz: no invented notes to speak of (${r.falseNotes} wrong notes in ${r.notes})`);
    ok(r.spread === 20, `${sr} Hz: every written chord puts each note on its own string (${r.spread} of 20)`);
  }
  // fingering: nearest-position choice stays playable
  { const r = await ev(() => { const d = window.__daily, a = d.capAssign([40, 47, 52, 55, 59, 64]), b = d.capAssign([55, 59, 62, 67]); const span = x => { const fr = x.filter(i => i.f > 0).map(i => i.f); return fr.length ? Math.max(...fr) - Math.min(...fr) : 0; }; return { a: a && a.length, as: a && new Set(a.map(i => i.st)).size, asp: a && span(a), b: b && b.length, bs: b && new Set(b.map(i => i.st)).size, bsp: b && span(b) }; });
    ok(r.a === 6 && r.as === 6 && r.asp <= 4 && r.b === 4 && r.bs === 4 && r.bsp <= 4, 'the nearest fingering uses a separate string per note and stays within four frets (' + JSON.stringify(r) + ')'); }

  // ---- the Write canvas: one page, three ways to write
  await ev(async () => { const d = window.__daily; d.S.bpm = 120; d.S.sections = [Object.assign({}, d.S.sections[0], { bars: d.S.sections[0].bars.slice(0, 2).map(b => ({ ...b, chord: '', tab: [] })) })]; d.CFG.rtt = 0; d.CFG.vin = 'off'; d.commit(false); await d.ioConnect(); d.E.inSum.gain.value = 0; d.dockGo('tab'); });
  await wait(500);
  const tabs = await ev(() => [...document.querySelectorAll('#dock .tabs .tab')].map(x => x.dataset.id));
  ok(!tabs.includes('song') && !tabs.includes('fret') && tabs.includes('tab'), 'Song and Fretboard are inside Write, not separate tabs (' + tabs.join(',') + ')');
  ok(await ev(() => /Write$/.test(document.querySelector('#dock .tab[data-id="tab"]').textContent.trim())), 'the tab is called Write');
  const modes = {}; for (const m of ['tab', 'words', 'both']) { await ev(m => document.querySelector('.wr-mode button[data-wm="' + m + '"]').click(), m); await wait(200); modes[m] = await ev(() => { const g = s => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0; }; return { grid: g('.wr-tabcol .tgrid, .wr-tabcol .tab-grid, .wr-tabcol .tcell'), words: g('.wr-words'), fret: g('.wr-fret') }; }); }
  ok(modes.tab.grid && !modes.tab.words && modes.words.words && !modes.words.grid && modes.both.grid && modes.both.words && modes.tab.fret && modes.words.fret && modes.both.fret, 'Tab, Words and Both change the canvas and the fretboard stays in view (' + JSON.stringify(modes) + ')');
  // the fretboard writes: click a note on the neck, it goes into the selected cell; click it again, it comes out
  await ev(() => { document.querySelector('.wr-mode button[data-wm="both"]').click(); const d = window.__daily; d.TE.sec = 0; d.TE.bi = 0; d.TE.slot = 0; d.renderTab(); });
  await ev(() => document.querySelector('.wf[data-st="3"][data-f="2"]').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))); await wait(300);
  ok(await ev(() => window.__daily.S.sections[0].bars[0].tab.some(n => n.st === 3 && n.f === 2 && n.s === 0)), 'clicking the neck writes that note into the selected cell');
  await ev(() => document.querySelector('.wf[data-st="3"][data-f="2"]').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))); await wait(300);
  ok(await ev(() => window.__daily.S.sections[0].bars[0].tab.length === 0), 'clicking the same note again takes it out');
  ok(await ev(() => { const n = document.querySelectorAll('.wr-secs .wr-sec:not(.add)').length; return n === window.__daily.S.sections.length; }), 'the section chips list the sections');

  // ---- live: Capture, then audio into the input; the notes appear in the bar that is playing
  ok(await ev(async () => await window.__daily.capStart()), 'Capture starts (it opens the input, counts you in and plays the bar)');
  const INJ = (notes, slot) => ev(([notes, slot]) => { const d = window.__daily, c = d.E.ctx, sr = c.sampleRate, when = d.T.next + (slot - d.T.slot) * (15 / d.S.bpm); const buf = c.createBuffer(1, Math.round(sr * .9), sr), arr = new Float32Array(buf.length); SY.strike(arr, sr, notes, 0, { amp: .2, gap: .009 }); buf.copyToChannel(arr, 0); const src = c.createBufferSource(); src.buffer = buf; src.connect(d.E.inTrim); src.start(when); }, [notes, slot]);
  ok(await ev(() => document.querySelector('#wrCap').classList.contains('on') || window.__daily.CAP.on), 'the Capture button shows it is listening');
  await INJ(CH.Em, 0); await INJ([45], 6); await INJ([52], 10);   /* a quiet low note right under a loud ringing chord is a known limit (docs/HARDWARE_CHECKLIST.md), so the notes come a beat or two later */
  await t.wait(3800);
  const res = await ev(() => { const d = window.__daily, b = d.S.sections[0].bars[0], tun = d.S.tuning, cap = d.S.capo || 0, at = s => b.tab.filter(n => n.s === s).map(n => tun[n.st] + cap + n.f).sort((x, y) => x - y); return { chord: b.chord, s0: at(0), s4: at(6), s8: at(10), say: (document.getElementById('wrSay') || {}).textContent, count: b.tab.length, n: b.tab.filter(n => n.s > 0).length }; });
  ok(res.chord === 'Em', 'the bar is named after the chord that was played (' + res.chord + ')');
  ok(res.s0.join() === CH.Em.join(), 'a strummed Em is written as the open Em shape on the first beat (' + res.s0.join() + ')');
  ok(res.s4.join() === '45' && res.s8.join() === '52', 'single notes land on the beat they were played, once each, with the right pitch (' + res.s4.join() + ' / ' + res.s8.join() + ')');
  ok(res.n === 2, 'each single note is written once, not again when the tracker notices it ringing (' + res.n + ' notes after the chord)');
  ok(typeof res.say === 'string' && res.say.length > 3, 'the strip says what it heard: "' + res.say + '"');
  ok(await ev(() => document.querySelectorAll('.wf.wn').length >= 6), 'the written notes light up on the fretboard');
  await ev(() => window.__daily.capStop()); await wait(300);
  ok(await ev(() => !window.__daily.CAP.on && !window.__daily.T.playing), 'stopping capture stops the transport it started');
  ok(await ev(() => window.__daily.S.sections[0].bars[0].tab.length >= 8), 'the capture stays in the song');
  await ev(() => window.__daily.undo()); await wait(200);
  ok(await ev(() => window.__daily.S.sections[0].bars[0].tab.length === 0 && window.__daily.S.sections[0].bars[0].chord === ''), 'one Undo takes the whole capture back');

  // ---- the guided session for this: it ticks off by itself as the app sees each step happen
  { const gi = () => ev(() => window.__daily.GD.i);
    await ev(() => { const d = window.__daily; d.dockGo('song'); d.guideStart('write', { fresh: true }); }); await wait(900);
    ok(await gi() === 1, 'the Write session skips the step already done (input connected) and asks for Write to be opened (step ' + await gi() + ')');
    await ev(() => window.__daily.dockGo('tab')); await wait(900); ok(await gi() === 2, 'opening Write ticks that step');
    await ev(async () => { await window.__daily.capStart(); }); await wait(900);
    ok(await gi() === 3, 'pressing Capture ticks that step and asks you to play');
    await INJ([52], 4); await wait(2600);
    ok(await gi() === 4, 'a note being written ticks the play step (' + await gi() + ')');
    await ev(() => window.__daily.capStop()); await wait(900);
    ok(await gi() === 5, 'stopping ticks the stop step, leaving Words/Tab/Both');
    await ev(() => window.__daily.wrMode('words')); await wait(900);
    ok(await ev(() => !window.__daily.GD.id), 'switching the canvas finishes the session');
    await ev(() => { window.__daily.guideStop(true); window.__daily.undo(); }); }

  // ---- the silent pass is reported
  { const q = await t.open({ debug: true }); await q.evaluate(() => { const d = window.__daily; d.CFG.vin = 'off'; });
    const m = await q.evaluate(() => document.documentElement.textContent.includes('Nothing was heard on that pass')); ok(m, 'the silent-pass message is in the program (a loop pass nobody played on is not kept, and it says so)'); }

  // ---- the guided sessions for a first task
  { const g = await ev(() => { const d = window.__daily; return d.GD_SESSIONS ? Object.keys(d.GD_SESSIONS).join() : 'n/a'; }); if (g !== 'n/a') ok(/play/.test(g) && /write/.test(g), 'the Play and Write guided sessions exist (' + g + ')'); }
  ok(t.errs.length === 0, 'capture and the Write canvas run without script errors' + (t.errs.length ? ' ' + t.errs[0] : ''));
});
