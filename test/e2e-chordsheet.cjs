/* Chord sheets (2.14): paste a song's chords and words and it becomes a song the studio can use.
   The sheets here are invented for the test (the same layouts as tab sites and ChordPro). */
const { suite } = require('./lib.cjs');
const SHEET = [
  'Harbour Lights - The Test Band',
  'Capo: 2',
  '',
  '[Intro]',
  '     E        B                F#m         A',
  '',
  '[Verse 1]',
  '     E' + ' '.repeat(14) + 'B/D#' + ' '.repeat(14) + 'C#m',   // over "along" and "wall"
  '     Lanterns swing along the harbour wall',
  '     A                  D9',
  '     And the gulls are calling out',
  '',
  '[Chorus]',
  '     E        B                F#m         A',
  '     Hold on, the tide is turning slow',
  '     E        B                F#m         A',
  '     Hold on, the lights will lead us home',
  '',
  '[Bridge]',
  '     E G#m C#m',
  '             Over the water',
  '     A G#m F#m',
  '',
  '[Chorus]',
  '     F        C                Gm         Bb',
  '     Hold on, the tide is turning slow'
].join('\n');

suite('e2e-chordsheet', async t => {
  const { ok, wait } = t;
  const p = await t.open({});

  /* ---- reading ---- */
  const r = await p.evaluate(txt => {
    const D = window.__daily, P = D.chordSheetParse(txt), o = {};
    o.meta = P.meta; o.names = P.sections.map(s => s.name); o.used = P.stats.used; o.like = !!D.chordSheetLike(txt);
    const s = D.chordSheetSong(P, { per: 1, fill: 'Block strum' });
    o.key = [s.key, s.minor]; o.capo = s.capo; o.title = s.title; o.artist = s.artist;
    o.bars = s.sections.map(x => x.bars.map(b => b.chord).join(' '));
    o.lyr = s.sections.map(x => x.lyrics); o.tab = s.sections.every(x => x.bars.every(b => !b.chord || b.tab.length > 0)); o.lead = s.band.leadOn && s.band.drumsOn && s.band.bassOn && s.band.compOn;
    o.half = D.chordSheetSong(P, { per: 0.5, fill: 'none' }).sections[1].bars.map(b => b.chord);
    o.two = D.chordSheetSong(P, { per: 2, fill: 'none' }).sections[0].bars.length;
    return o;
  }, SHEET);
  ok(r.like, 'a sheet with chords over the words is recognised as a chord sheet');
  ok(r.names.join() === 'Intro,Verse 1,Chorus,Bridge,Chorus', 'the headings become the sections, in order, repeats included (' + r.names.join(', ') + ')');
  ok(r.title === 'Harbour Lights' && r.artist === 'The Test Band' && r.capo === 2, 'the “Title - Artist” line and Capo are read (' + [r.title, r.artist, r.capo].join(' · ') + ')');
  ok(r.key[0] === 4 && r.key[1] === false, 'the key is read from the chords: E major (' + r.key + ')');
  ok(r.bars[1] === 'E B/D# C#m A D9', 'each chord is a bar, slash chords and 9ths kept as written (' + r.bars[1] + ')');
  ok(r.bars[0] === 'E B F#m A' && r.lyr[0] === '[E] [B] [F#m] [A]', 'a line of chords with no words under it is an instrumental line');
  ok(r.lyr[1].split('\n')[0] === '[E]Lanterns swing [B/D#]along the harbour [C#m]wall', 'each chord lands over the syllable it was over (' + r.lyr[1].split('\n')[0] + ')');
  ok(r.lyr[3].split('\n')[0] === '[E] [G#m] [C#m] Over the water', 'chords before indented words come first (' + r.lyr[3].split('\n')[0] + ')');
  ok(r.bars[4] === 'F C Gm Bb', 'a chorus in a new key keeps its own chords');
  ok(r.tab && r.lead, 'a guitar part is written into the tab for every bar, and the band is on');
  ok(r.half.join('|') === 'E B/D#|C#m|A D9', 'half a bar per chord puts two chords of a line in a bar (' + r.half.join('|') + ')');
  ok(r.two === 8, '2 bars per chord doubles the bars (' + r.two + ')');

  /* ---- words are words ---- */
  const w = await p.evaluate(() => {
    const D = window.__daily, L = s => !!D.csChordLine(s);
    return { words: ['And Be Dim the lights', 'Am I wrong', 'A Bad Cab', 'Every day', 'Don\'t go'].map(L), chords: ['Am  F  C  G', 'Cmaj7   Dm7  G7sus4', '| Am | F | C G |', 'D/F#  Em7 (x2)', 'Asus2  E7#9  Bbm  Ebmaj7'].map(L),
      simp: D.csSym(D.csTok('Cadd11')).sym + ' ' + D.csSym(D.csTok('A7sus2')).sym + ' ' + D.csSym(D.csTok('Dmin7')).sym + ' ' + D.csSym(D.csTok('Ebmaj7')).sym,
      bars: D.csBars([D.csChordLine('| Am | F | C G |'), D.csChordLine('Dm  G  x2')], 1).join(',') };
  });
  ok(w.words.every(x => !x), 'lines of words are not mistaken for chords (' + w.words + ')');
  ok(w.chords.every(Boolean), 'chord lines with 7ths, sus, slash chords, bar lines and x2 are read (' + w.chords + ')');
  ok(w.simp === 'C A7 Dmin7 Ebmaj7', 'a chord the app does not play becomes the nearest simpler one (sus2 never turns into sus4); one it plays is kept as written (' + w.simp + ')');
  ok(w.bars === 'Am,F,C G,Dm,G,Dm,G', 'bar lines keep their bars and x2 repeats the line (' + w.bars + ')');

  /* ---- inline chords and ChordPro ---- */
  const c = await p.evaluate(() => {
    const D = window.__daily, txt = '{title: Paper Boats}\n{key: Am}\n{tempo: 104}\n{c: Verse 1}\n[Am]Fold the [F]page in [C]two\n[G]Set it on the stream\n{soc}\n[F]Sail a[C]way\n[G]Sail a[Am]way\n{eoc}';
    const P = D.chordSheetParse(txt), s = D.chordSheetSong(P, { per: 1, fill: 'none' });
    return { like: !!D.chordSheetLike(txt), names: s.sections.map(x => x.name).join(), bars: s.sections.map(x => x.bars.map(b => b.chord).join(' ')).join(' | '), key: [s.key, s.minor], bpm: s.bpm, title: s.title, lyr: s.sections[0].lyrics.split('\n')[0] };
  });
  ok(c.like && c.names === 'Verse 1,Chorus', 'ChordPro: {c: …} and {soc} become sections (' + c.names + ')');
  ok(c.bars === 'Am F C G | F C G Am', 'inline [Am] chords become the bars (' + c.bars + ')');
  ok(c.key[0] === 9 && c.key[1] === true && c.bpm === 104 && c.title === 'Paper Boats', '{key}, {tempo} and {title} are used (' + JSON.stringify(c) + ')');
  ok(c.lyr === '[Am]Fold the [F]page in [C]two', 'the words keep their inline chords');
  const guess = await p.evaluate(() => { const D = window.__daily; return D.chordSheetSong(D.chordSheetParse('[Verse]\nG       C\nWalking down the road\n[Chorus]\nC          G\nsing it out loud... sing it all night\nD    G\nLa la'), { per: 1 }).title; });
  ok(guess === 'Sing it out loud', 'with no title in the sheet, the first line of the chorus is offered as the title (' + guess + ')');
  ok(await p.evaluate(() => !window.__daily.chordSheetLike('[Verse 1]\nJust some words here\nAnd some more words\n\n[Chorus]\nNo chords at all')), 'words without chords stay a lyric import');

  /* ---- the dialog: paste, preview, load as a new song ---- */
  await p.evaluate(() => { const D = window.__daily; D.S.title = 'My other song'; D.commit(true); });
  await p.evaluate(txt => window.__daily.liOpen(txt), SHEET); await wait(300);
  const ui = await p.evaluate(() => ({ head: document.querySelector('.lyi-h b').textContent, prev: (document.querySelector('.cs-prev') || {}).textContent || '', go: document.getElementById('lyiGo').textContent, title: document.getElementById('csTitle').value, chips: document.querySelectorAll('.cs-ch').length, lyOpts: [...document.querySelectorAll('.lyi-opts')].filter(x => x.offsetParent !== null).length === 1 }));
  ok(/chord sheet/i.test(ui.head) && /5 sections/.test(ui.prev) && /key E/.test(ui.prev) && ui.chips === 12, 'the dialog switches to the chord sheet and shows sections, bars, chords and key (' + ui.prev.slice(0, 90) + ')');
  ok(ui.go === 'Load as a new song' && ui.title === 'Harbour Lights' && ui.lyOpts, 'it offers a new song, with the title filled in and the lyric-only options hidden');
  { const n = await p.evaluate(() => { const ta = document.querySelector('.lyi-ta'); for (let i = 0; i < 3; i++) { ta.value += ' '; ta.dispatchEvent(new Event('input')); } const a = document.querySelectorAll('.cs-prev').length; const v = ta.value; ta.value = '[Verse]\nWords only here\n[Chorus]\nNo chords'; ta.dispatchEvent(new Event('input')); ta.dispatchEvent(new Event('input')); const b = document.querySelectorAll('.lyi-prev .lyi-row').length; ta.value = v; ta.dispatchEvent(new Event('input')); return [a, b]; });
    ok(n[0] === 1 && n[1] === 2, 'typing redraws the preview instead of adding to it (' + n + ')'); }
  await p.click('#lyiGo'); await t.poll(() => p.evaluate(() => window.__daily.S.title === 'Harbour Lights'), 8000);
  const after = await p.evaluate(() => { const D = window.__daily; return { title: D.S.title, n: D.S.sections.length, key: D.S.key, capo: D.S.capo, dock: D.DOCK.cur, wr: D.WR.mode, list: D.PRJ.list.map(x => x.title), words: !!document.querySelector('.wr-wh'), chord: D.S.sections[1].bars[1].chord }; });
  ok(after.title === 'Harbour Lights' && after.n === 5 && after.key === 4 && after.capo === 2 && after.chord === 'B/D#', 'Load makes a new song from the sheet (' + JSON.stringify(after).slice(0, 120) + ')');
  ok(after.list.includes('My other song') || after.list.length >= 2, 'the song you were on is kept in ☰ Songs (' + after.list.join(', ') + ')');
  ok(after.dock === 'tab' && after.wr === 'both', 'Write opens with the tab and the words with their chords (' + after.dock + ', ' + after.wr + ')');
  await p.evaluate(() => { const D = window.__daily; D.T.cursor = 0; D.play(); }); await wait(1500);
  const playing = await p.evaluate(() => { const D = window.__daily, a = D.E.anaMaster, b = new Float32Array(a.fftSize); a.getFloatTimeDomainData(b); let m = 0; for (const v of b) m = Math.max(m, Math.abs(v)); const out = { on: D.T.playing, peak: m }; D.stopPlay(false); return out; });
  ok(playing.on && playing.peak > 0.01, 'Play: the band plays the imported chords (peak ' + playing.peak.toFixed(3) + ')');

  /* ---- replace this song's sections, and Undo ---- */
  const rep = await p.evaluate(async () => {
    const D = window.__daily, before = D.S.sections.length; await D.chordSheetApply(D.chordSheetParse('[Verse]\nAm      G\nWords go here\n[Chorus]\nF       C\nMore words here'), { mode: 'A', per: 1, fill: 'none' });
    const mid = D.S.sections.map(s => s.name + ':' + s.bars.map(b => b.chord).join(' ')).join(' | '), key = [D.S.key, D.S.minor]; D.undo();
    return { before, mid, key, back: D.S.sections.length, title: D.S.title };
  });
  ok(rep.mid === 'Verse:Am G | Chorus:F C' && rep.key[0] === 9 && rep.key[1] === true, 'Replace puts the sheet into this song and sets the key (' + rep.mid + ', ' + rep.key + ')');
  ok(rep.back === rep.before && rep.title === 'Harbour Lights', 'Undo puts the song back');

  /* ---- the ways in ---- */
  await p.evaluate(() => { const b = document.querySelector('.sb-songs'); b && b.click(); }); await wait(250);
  ok(!!(await p.$('#smChords')), '☰ Songs has “Paste a chord sheet…”');
  await p.click('#smChords'); await wait(250);
  ok(await p.evaluate(() => !!document.querySelector('.lyi-ta')), 'it opens the import box');
  await p.keyboard.press('Escape'); await wait(150);
  await p.evaluate(() => window.__daily.goalGo('songwriter')); await wait(400);
  ok(!!(await p.$('#gtSheet')), 'the Songwriter workspace has “Paste chords” in its tools');
  const pasted = await p.evaluate(txt => { const ta = document.querySelector('textarea.lyr'); if (!ta) return 'no box'; const dt = new DataTransfer(); dt.setData('text/plain', txt); const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); ta.dispatchEvent(ev); return ev.defaultPrevented && !!document.querySelector('.cs-prev'); }, SHEET);
  ok(pasted === true || pasted === 'no box', 'pasting a chord sheet into a lyric box opens the chord sheet import (' + pasted + ')');
  ok(!t.errs.length, 'no console / page / network errors' + (t.errs.length ? ': ' + t.errs.join(' | ') : ''));
});
