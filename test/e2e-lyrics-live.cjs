/* Lyrics in time with their chords (2.15): while the song plays, the line on screen is the one whose chords are playing, and
   its chords sit over the words they were written over, the playing one lit. Stage, lower third and Perform. Invented sheets. */
const { suite } = require('./lib.cjs');
const SHEET = [
  '[Intro]',
  'Hold on, the tide is turning slow',
  'E        B                F#m         A',
  'Hold on, the tide is turning slow',
  '',
  '[Verse 1]',
  'E               B/D#            C#m',
  'Lanterns swing along the harbour wall',
  'A                  D9',
  'And the gulls are calling out'
].join('\n');

suite('e2e-lyrics-live', async t => {
  const { ok, wait } = t;
  const p = await t.open({});
  await p.evaluate(async txt => { const D = window.__daily; await D.chordSheetApply(D.chordSheetParse(txt), { mode: 'N', per: 1, fill: 'none' }); }, SHEET);

  /* ---- where the chords go ---- */
  const lay = await p.evaluate(() => { const D = window.__daily; return [D.lyLayout('[E]Lanterns swing al[B/D#]ong'), D.lyLayout('[E] [G#m] [C#m] Over the water'), D.lyLayout('No chords here')]; });
  ok(lay[0].text === 'Lanterns swing along' && JSON.stringify(lay[0].chords) === '[{"col":0,"sym":"E"},{"col":17,"sym":"B/D#"}]', 'each chord sits over the character it was written before (' + JSON.stringify(lay[0].chords) + ')');
  ok(lay[1].chords.map(c => c.col).join() === '0,2,6' && lay[1].text.indexOf('Over') > lay[1].chords[2].col, 'chords that would touch are spaced out, and the words move along with them (' + JSON.stringify(lay[1]) + ')');
  ok(lay[2].chords.length === 0 && lay[2].text === 'No chords here', 'a line without chords is just its words');

  /* ---- which line is on screen, and which chord is lit ---- */
  const at = (per, sheet) => p.evaluate(([per, sheet]) => { const D = window.__daily, s = D.chordSheetSong(D.chordSheetParse(sheet), { per, fill: 'none' }), out = [];
    s.sections.forEach(sec => sec.bars.forEach((b, bi) => { const L = D.lyAt(sec, bi, 0), ly = L.idx >= 0 ? D.lyLayout(L.lines[L.idx]) : null; out.push((L.idx + 1) + ':' + (ly && L.mi >= 0 ? ly.chords[L.mi].sym : '-')); })); return out.join(' '); }, [per, sheet]);
  const one = await at(1, SHEET);
  ok(one === '2:E 2:B 2:F#m 2:A 1:E 1:B/D# 1:C#m 2:A 2:D9', 'each bar shows the line its chord is written in, with that chord lit; the line with no chords above the intro chords is not shown over them (' + one + ')');
  const two = await at(2, SHEET);
  ok(two.startsWith('2:E 2:E 2:B 2:B 2:F#m 2:F#m 2:A 2:A 1:E 1:E'), 'a chord held for two bars stays lit for both (' + two.slice(0, 60) + ')');
  const held = await at(2, '[Verse]\nC                G\nLong note on the first line\nAnd a second line over it\nAm      F\nThen the next one');
  ok(held === '1:C 1:C 1:G 2:- 3:Am 3:Am 3:F 3:F', 'a line with no chords of its own takes its turn while the chord before it is held (' + held + ')');
  const plain = await at(1, '[Verse]\nG       C\nWords here\n[Chorus]\nNo chords in this one\nNor in this one');
  ok(plain.endsWith('1:- 1:- 2:- 2:-') || plain.endsWith('1:- 2:-'), 'a section whose words carry no chords shares its bars among its lines as before (' + plain + ')');
  const edited = await p.evaluate(() => { const D = window.__daily, sec = JSON.parse(JSON.stringify(D.S.sections[1])); sec.bars = ['Dm', 'Dm', 'Dm', 'Dm', 'Dm', 'Dm'].map(c => ({ chord: c, tab: [] })); return sec.bars.map((b, bi) => D.lyAt(sec, bi, 0).idx + 1).join(''); });
  ok(edited === '111122', 'bars changed away from the written chords: the lines share the bars by their chord count (' + edited + ')');

  /* ---- the stage, while playing ---- */
  await p.evaluate(() => window.__daily.dockGo('stage')); await wait(400);
  await p.evaluate(() => window.dailyStudio.call('transport', { action: 'play', from_bar: 3 })); await wait(700);
  const st = await p.evaluate(() => { const i = window.__daily.stageInfo(); return { lyric: i.lyric, cur: i.ly && i.ly.chords[i.ly.cur] && i.ly.chords[i.ly.cur].sym, sym: i.sym, n: i.ly && i.ly.chords.length, next: i.lyricNext }; });
  ok(st.lyric === 'Hold on, the tide is turning slow' && st.cur === 'F#m' && st.sym === 'F#m' && st.n === 4, 'stage: at bar 3 the intro line is on screen with F#m lit, the chord the band is playing (' + JSON.stringify(st) + ')');
  ok(st.next === 'Lanterns swing along the harbour wall', 'the next line is the first line of the verse');
  const lt = await p.evaluate(() => { const D = window.__daily, c = document.createElement('canvas'); c.width = 1280; c.height = 720; const g = c.getContext('2d'); const i = D.stageInfo(); D.drawLowerThird(g, 1280, 720, i, { a: '#0aa', b: '#fd0', c: '#f0a', d: '#0af' }); const px = g.getImageData(0, 0, 1280, 720).data; let lit = 0; for (let k = 0; k < px.length; k += 4) if ((k / 4) % 1280 > 520 && px[k] > 240 && px[k + 1] > 200 && px[k + 2] < 60) lit++; return lit; });
  ok(lt > 30, 'lower third: the line is drawn with its chords, the playing one in the highlight colour (' + lt + ' highlight pixels)');

  /* ---- Perform ---- */
  await p.evaluate(() => window.__daily.perfOpen()); await wait(400);
  await p.evaluate(() => { document.querySelector('.perform').classList.remove('pf-pre'); }); await wait(700);
  const pf = await p.evaluate(() => { const cur = document.querySelector('#pfLyr .pf-l.cur'); if (!cur) return null; const segs = [...cur.querySelectorAll('.ly-seg')];
    return { chords: segs.map(s => s.querySelector('.ly-c').textContent), lit: (cur.querySelector('.ly-c.cur') || {}).textContent, off: segs.map(s => Math.round(s.querySelector('.ly-c').getBoundingClientRect().left - s.querySelector('.ly-w').getBoundingClientRect().left)) }; });
  ok(pf && pf.chords.join(' ') === 'E B F#m A' && /F#m|A/.test(pf.lit), 'Perform: the line being sung shows its chords over the words with the playing one marked (' + JSON.stringify(pf) + ')');
  ok(pf && pf.off.every(x => x === 0), 'Perform: each chord starts exactly over its word (' + (pf && pf.off) + ')');
  await p.evaluate(() => window.__daily.stopPlay(false));
  ok(!t.errs.length, 'no console / page / network errors' + (t.errs.length ? ': ' + t.errs.join(' | ') : ''));
});
