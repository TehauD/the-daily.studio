/* Perform's display options (2.15): Chords & shapes (the chord shapes beside the lyrics), Big chord, Lyric sheet; the build
   version in the very bottom-right corner; and the hidden line that a triple click on the version wakes. */
const { suite } = require('./lib.cjs');
const SHEET = '[Verse 1]\nE              B/D#              C#m\nLanterns swing along the harbour wall\nA                  D9\nAnd the gulls are calling out\nE        B\nOne more line here\nA        E\nAnd one more after that\n[Chorus]\nA        E\nHold on, the tide is turning slow';
suite('e2e-perform-views', async t => {
  const { ok, wait, fs, path } = t;
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const p = await t.open({});
  await p.evaluate(async txt => { const D = window.__daily; await D.chordSheetApply(D.chordSheetParse(txt), { mode: 'N', per: 1, fill: 'none' }); delete D.CFG.pfView; delete D.CFG.egg; D.perfOpen(); }, SHEET);
  await wait(300); await p.evaluate(() => { document.querySelector('.perform').classList.remove('pf-pre'); }); await wait(300);

  /* ---- the build version ---- */
  const ver = await p.evaluate(() => ({ pf: (document.querySelector('#perform .pf-ver') || {}).textContent, st: (document.querySelector('#status .st-ver') || {}).textContent }));
  ok(new RegExp('^v' + pkg.version.replace(/\./g, '\\.') + ' · build [0-9a-f]{7}$').test(ver.pf) && ver.st === ver.pf, 'the version and build code show in Perform and the status bar (' + ver.pf + ')');
  const pos = await p.evaluate(() => { const r = document.querySelector('#perform .pf-ver').getBoundingClientRect(); return { right: innerWidth - r.right, bottom: innerHeight - r.bottom }; });
  ok(pos.right < 20 && pos.bottom < 12, 'in the very bottom-right corner (' + JSON.stringify(pos) + ')');

  /* ---- Chords & shapes (the default) ---- */
  await p.evaluate(() => window.dailyStudio.call('transport', { action: 'play', from_bar: 2 })); await wait(700);
  const sh = await p.evaluate(() => { const D = window.__daily, i = D.stageInfo(), cards = [...document.querySelectorAll('#pfShapes .pf-sh')], v = D.voicings(i.sym, D.S.tuning, D.S.capo, 12)[0];
    return { view: D.CFG.pfView || 'shapes', btn: document.getElementById('pfView').textContent, vis: document.getElementById('pfShapes').offsetParent !== null, now: cards[0] && cards[0].querySelector('.pf-sh-n').textContent, lbl: cards[0] && cards[0].querySelector('.pf-sh-l').textContent, frets: cards[0] && cards[0].querySelector('.pf-sh-f').textContent, want: v.frets.map(f => f == null ? 'x' : f).join(' '), sym: i.sym, next: cards[1] && cards[1].querySelector('.pf-sh-n').textContent, nextSym: i.next, svg: !!(cards[0] && cards[0].querySelector('svg')), then: (document.querySelector('#pfShapes .pf-sh-up') || {}).textContent, chord: document.getElementById('pfChord').offsetParent !== null }; });
  ok(sh.vis && /Chords & shapes/.test(sh.btn) && sh.chord, 'Chords & shapes is the default: the big chord, the lyrics and the shapes panel');
  ok(sh.now === sh.sym && sh.lbl === 'NOW' && sh.svg && sh.frets === sh.want, 'the panel shows the playing chord’s shape for this tuning, with its frets (' + sh.now + ': ' + sh.frets + ')');
  ok(sh.next === sh.nextSym && /THEN/.test(sh.then || ''), 'and the next chord’s shape, then the coming chords (' + sh.next + ' · ' + sh.then + ')');
  const pref = await p.evaluate(() => { const D = window.__daily, sym = D.stageInfo().sym, all = D.voicings(sym, D.S.tuning, D.S.capo, 12); D.S.voicePref[sym] = 1; D.commit(false); return { want: all[1] && all[1].frets.map(f => f == null ? 'x' : f).join(' ') }; }); await wait(400);
  ok(!pref.want || (await p.evaluate(() => document.querySelector('#pfShapes .pf-sh-f').textContent)) === pref.want, 'the voicing picked for the song is the one shown (' + pref.want + ')');
  await p.evaluate(() => { const D = window.__daily; D.S.capo = 2; D.commit(false); }); await wait(400);
  ok(/Capo 2/.test(await p.evaluate(() => document.getElementById('pfShapes').textContent)), 'with a capo, the panel says the shapes are from the capo');
  await p.evaluate(() => { const D = window.__daily; D.S.capo = 0; D.commit(false); });

  /* ---- Big chord, Lyric sheet, and back ---- */
  await p.click('#pfView'); await wait(300);
  const big = await p.evaluate(() => ({ view: window.__daily.CFG.pfView, btn: document.getElementById('pfView').textContent, shapes: document.getElementById('pfShapes').offsetParent !== null, chord: document.getElementById('pfChord').offsetParent !== null }));
  ok(big.view === 'big' && /Big chord/.test(big.btn) && !big.shapes && big.chord, 'Display ▸ Big chord: the big chord and the lyrics, no shapes');
  await p.click('#pfView'); await wait(300);
  const sheet = await p.evaluate(() => ({ view: window.__daily.CFG.pfView, chord: document.getElementById('pfChord').offsetParent !== null, lines: document.querySelectorAll('#pfLyr .pf-l').length, chords: document.querySelectorAll('#pfLyr .pf-l.cur .ly-c').length }));
  ok(sheet.view === 'sheet' && !sheet.chord && sheet.lines >= 4 && sheet.chords > 0, 'Display ▸ Lyric sheet: no big chord, more lines, chords over the words (' + sheet.lines + ' lines)');
  await p.click('#pfView'); await wait(200);
  ok(await p.evaluate(() => window.__daily.CFG.pfView === 'shapes'), 'and round again to Chords & shapes; the choice is remembered');
  await p.evaluate(() => window.__daily.stopPlay(true));

  /* ---- the hidden line ---- */
  ok(await p.evaluate(() => [...document.querySelectorAll('.egg-line')].every(e => !e.textContent)), 'the hidden line is hidden until found');
  const before = await p.evaluate(() => [window.__daily.T.playing, window.__daily.T.metro, window.__daily.T.loop].join());
  await p.click('#perform .pf-ver', { clickCount: 1 }); await p.click('#perform .pf-ver'); await p.click('#perform .pf-ver'); await wait(300);
  const egg = await p.evaluate(() => ({ on: window.__daily.CFG.egg, pf: document.querySelector('#perform .egg-line').textContent, st: document.querySelector('#status .egg-line').textContent }));
  ok(egg.on === true && egg.pf.length > 15 && egg.st === egg.pf, 'a triple click on the version wakes it, in Perform and the status bar: “' + egg.pf + '”');
  const Q = await p.evaluate(() => { const L = window.__daily.EGG_LINES, by = w => (L.find(x => x[1] === w) || [])[0]; return { n: L.length, all: L.every(([q, w]) => q && w && !/[“”]/.test(q)), uniq: new Set(L.map(x => x[0])).size, tehau: L.filter(x => /Tehau/.test(x[1])).length, noSagan: !L.some(x => /^Carl Sagan$/.test(x[1]) && /incredible/.test(x[0])), tesla: (L.find(x => /Tesla/.test(x[1])) || [])[1], congreve: /savage breast/.test(by('William Congreve') || ''), widener: /Do what you can/.test(by('Bill Widener, quoted by Theodore Roosevelt') || '') }; });
  ok(/^“.+” — .+$/.test(egg.pf) && Q.all && Q.uniq === Q.n && Q.n >= 100, 'each line is a quote with who it is from: “…” — who (' + Q.n + ' different quotes)');
  ok(Q.tehau === 0, 'every quote is from someone in history (none from the maker)');
  ok(Q.tesla === 'attributed to Nikola Tesla' && Q.noSagan && Q.congreve && Q.widener, 'a saying with no known source says “attributed to”, and a line often credited to the wrong person carries the right name');
  /* ---- one quote a day ---- */
  const DY = await p.evaluate(() => { const D = window.__daily, n = D.EGG_LINES.length, f = D.eggFor, at = (m, d, hh, mm, y) => D.eggDay(new Date(y || 2026, m, d, hh, mm));
    const run = []; for (let d = 20000; d < 20000 + 2 * n; d++) run.push(f(d));
    return { n, cycle: new Set(run.slice(0, n)).size, again: run.slice(n).every((x, k) => x === run[k]), apart: run.every((x, k) => !k || x !== run[k - 1]),
      sameDay: at(10, 1, 0, 1) === at(10, 1, 23, 59), next: at(10, 2, 0, 1) - at(10, 1, 23, 59), year: at(0, 1, 0, 30, 2027) - at(11, 31, 23, 30), march: at(2, 9, 12, 0) - at(2, 8, 12, 0),
      today: D.eggText(f(D.eggDay())), shown: document.querySelector('#perform .egg-line').textContent }; });
  ok(DY.shown === DY.today, 'the line shows today’s quote');
  ok(DY.sameDay && DY.next === 1 && DY.march === 1 && DY.year === 1, 'it changes at midnight, by the device’s own calendar, once a day (summer time and new year too)');
  ok(DY.cycle === DY.n && DY.again && DY.apart, 'every one of the ' + DY.n + ' quotes comes round once before any comes again, and two days in a row never share one');
  const MID = await p.evaluate(() => { const D = window.__daily, today = D.EGG.i; D.EGG.day -= 1; D.EGG.i = (today + 1) % D.EGG_LINES.length; D.eggTick(); const after = document.querySelector('#perform .egg-line').textContent;
    D.eggTick(); return { after, today: D.eggText(today), same: document.querySelector('#perform .egg-line').textContent === after }; });
  ok(MID.after === MID.today && MID.same, 'left open past midnight, the line moves on to the new day’s quote by itself, and then stays');
  /* ---- a long quote ---- */
  const longest = async () => p.evaluate(async () => { const D = window.__daily, L = D.EGG_LINES, i = L.reduce((b, x, k) => D.eggText(k).length > D.eggText(b).length ? k : b, 0);
    if (D.EGG.i !== i) { D.EGG.day = D.eggDay(); D.EGG.i = i; D.eggTick(true); } await new Promise(r => setTimeout(r, 250)); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return [...document.querySelectorAll('#perform .egg-line, #status .egg-line')].map(el => { const t = el.firstElementChild, a = el._eggA, k = a ? a.effect.getKeyframes() : [], tm = a ? a.effect.getTiming() : {}, x = f => -parseFloat((/translateX\((-?[\d.]+)px\)/.exec(f.transform) || [0, 0])[1]);
      const far = k.length ? Math.max(...k.map(x)) : 0, at = k.filter(f => x(f) === far && far > 0).map(f => f.offset * tm.duration);
      return { text: el.textContent, title: el.title, over: t.getBoundingClientRect().width - el.clientWidth, long: el.classList.contains('egg-long'), reach: el.clientWidth + far - t.getBoundingClientRect().width,
        loops: tm.iterations === Infinity, back: k.length ? x(k[k.length - 1]) === 0 : true, hold: at.length > 1 ? at[at.length - 1] - at[0] : 0, start: k.length > 1 ? k[1].offset * tm.duration : 0, w: el.clientWidth }; }); });
  const LG = await longest(), pf = LG[0];
  ok(LG.every(e => e.title === e.text) && pf.over > 0 && pf.long, 'a long quote shows whole on hover, and glides if its space is too narrow (' + Math.round(pf.over) + ' px over in Perform)');
  ok(LG.every(e => !e.long || (e.reach >= 0 && e.loops && e.back && e.hold >= 3000 && e.start >= 2000)), 'in every place it is shown it waits to be read, glides far enough to show its very end, who said it included, holds there, glides back, and comes round again');
  await p.setViewportSize({ width: 1100, height: 900 }); await wait(500);
  const LN = await longest();
  ok(LN[0].w < pf.w && LN[0].long && LN[0].reach >= 0, 'when its space narrows, the glide is measured again and still reaches the end (' + Math.round(pf.w) + ' → ' + Math.round(LN[0].w) + ' px)');
  await p.setViewportSize({ width: 820, height: 900 }); await wait(500);
  const LS = await longest();
  ok(LS.every(e => e.w >= 120 || (!e.long && e.title === e.text)), 'in a sliver of space it does not glide, it is cut short with the whole quote on hover (' + LS.map(e => Math.round(e.w) + ' px').join(', ') + ')');
  await p.setViewportSize({ width: 1500, height: 900 }); await wait(300);
  await p.emulateMedia({ reducedMotion: 'reduce' }); await p.evaluate(() => window.__daily.eggTick(true)); await wait(300);
  ok(await p.evaluate(() => { const el = document.querySelector('#perform .egg-line'); return !el._eggA && !el.classList.contains('egg-long') && el.title === el.textContent && el.firstElementChild.getAnimations().length === 0; }), 'with reduced motion it stays still, cut short with the whole quote on hover');
  await p.emulateMedia({ reducedMotion: 'no-preference' });
  await p.click('#perform .pf-ver'); await p.click('#perform .pf-ver'); await p.click('#perform .pf-ver'); await wait(300);
  ok(await p.evaluate(() => window.__daily.CFG.egg === false && !document.querySelector('#perform .egg-line').textContent), 'a second triple click puts it back to sleep');
  ok((await p.evaluate(() => [window.__daily.T.playing, window.__daily.T.metro, window.__daily.T.loop].join())) === before, 'clicking the version changes nothing else (play, click and loop as they were)');

  /* ---- About shows the real version ---- */
  await p.evaluate(() => window.__daily.perfClose());
  await p.click('.btn.icon[title^="Help"]'); await wait(300); await p.click('#help .hub-nb[data-sec="about"]'); await wait(500);
  ok(new RegExp('v' + pkg.version.replace(/\./g, '\\.')).test(await p.$eval('#help .ab', e => e.textContent)), 'Help ▸ About shows the version of this build (v' + pkg.version + '), not an old one');
  ok(!t.errs.length, 'no console / page / network errors' + (t.errs.length ? ': ' + t.errs.join(' | ') : ''));
});
