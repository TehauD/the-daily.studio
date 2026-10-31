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
  await p.click('#perform .pf-ver'); await p.click('#perform .pf-ver'); await p.click('#perform .pf-ver'); await wait(300);
  ok(await p.evaluate(() => window.__daily.CFG.egg === false && !document.querySelector('#perform .egg-line').textContent), 'a second triple click puts it back to sleep');
  ok((await p.evaluate(() => [window.__daily.T.playing, window.__daily.T.metro, window.__daily.T.loop].join())) === before, 'clicking the version changes nothing else (play, click and loop as they were)');

  /* ---- About shows the real version ---- */
  await p.evaluate(() => window.__daily.perfClose());
  await p.click('.btn.icon[title^="Help"]'); await wait(300); await p.click('#help .hub-nb[data-sec="about"]'); await wait(500);
  ok(new RegExp('v' + pkg.version.replace(/\./g, '\\.')).test(await p.$eval('#help .ab', e => e.textContent)), 'Help ▸ About shows the version of this build (v' + pkg.version + '), not an old one');
  ok(!t.errs.length, 'no console / page / network errors' + (t.errs.length ? ': ' + t.errs.join(' | ') : ''));
});
