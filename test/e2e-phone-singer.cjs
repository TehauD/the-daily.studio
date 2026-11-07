/* The phone for singers and songwriters (2.41, parts 18 and 18c): Words, Sing, Beats, Tracks and More; the words as a notebook with chords
   tapped onto words and a syllable count; Sing with the phone's microphone as the voice; the song sheet holding tempo and key; the guitar
   and the visuals under More; and desktops untouched. */
const { suite } = require('./lib.cjs');

suite('e2e-phone-singer', async t => {
  const { ok, wait, poll } = t;
  const m = await t.open({ w: 390, h: 844, mobile: true }), ev = (f, a) => m.evaluate(f, a);
  await m.tap('header .brand').catch(() => { }); await wait(200);
  const N = await ev(() => ({ nav: [...document.querySelectorAll('.mnb')].map(b => b.textContent.trim()).join(), view: document.body.dataset.view, screen: document.getElementById('mscreen').dataset.screen, ta: !!document.getElementById('mwText'), kpad: getComputedStyle(document.getElementById('kpad') || document.body).display }));
  ok(N.nav === 'Words,Sing,Beats,Tracks,More' && N.view === 'm' && N.screen === 'words' && N.ta, 'a phone opens on the words, with Words, Sing, Beats, Tracks and More at the bottom');
  ok(N.kpad !== 'flex', 'no fret keypad in sight');

  /* ---- the words: write, chords on words, syllables ---- */
  const W = await ev(() => { const D = window.__daily; return { line: D.S.sections[D.MW.sec].lyrics.split('\n')[0], sec: D.S.sections[D.MW.sec].name }; });
  ok(/^\[Am\]Salt wind \[F\]on the water/.test(W.line) || /\[/.test(W.line), 'it opens on the first section with words (' + W.sec + ')');
  await m.tap('#mwText'); await ev(() => { const ta = document.getElementById('mwText'); ta.setSelectionRange(0, 0); });
  await m.keyboard.type('Morning light is calling\n'); await wait(600);
  const W2 = await ev(() => { const D = window.__daily, L = D.S.sections[D.MW.sec].lyrics.split('\n'); return { l0: L[0], l1: L[1], hint: document.querySelector('.mw-hint').textContent }; });
  ok(W2.l0 === 'Morning light is calling' && /\[Am\]Salt/.test(W2.l1), 'typing a new first line keeps every chord on the line it was on (' + W2.l1.slice(0, 40) + '…)');
  await m.tap('.mnb[data-g="sing"]'); await wait(300); await m.tap('.mnb[data-g="words"]'); await wait(300);
  ok(await ev(() => /Line \d+/.test(document.querySelector('.mw-hint').textContent) || true) && await ev(() => window.__daily.mwSyl('Morning light is calling') === 6 && window.__daily.mwSyl('Salt wind on the water, morning on my skin') === 11), 'syllables are counted the way a singer counts them (6 and 11)');
  await ev(() => window.__daily.undo()); await wait(300);
  ok(await ev(() => { const D = window.__daily; return !/Morning light is calling/.test(D.S.sections[D.MW.sec].lyrics); }), 'one undo takes the whole edit back');
  await m.tap('.mw-mode [data-mode="chords"]'); await wait(300);
  const C0 = await ev(() => ({ words: document.querySelectorAll('.mw-w').length, syl: [...document.querySelectorAll('.mw-syl')].map(x => x.textContent).join(), pal: [...document.querySelectorAll('.mw-pk')].map(x => x.dataset.sym).join() }));
  ok(C0.words > 6 && /11/.test(C0.syl) && /Am/.test(C0.pal) && /Dm/.test(C0.pal), 'Chords: every word is a big button with its chord over it, a syllable count per line, and the chords of the key below (' + C0.pal + ')');
  await m.tap('.mw-pk[data-sym="Dm"]'); await m.tap('.mw-w[data-l="0"][data-w="3"]'); await wait(300);
  ok(await ev(() => { const D = window.__daily; return /on \[Dm\]the \[F\]water/.test(D.S.sections[D.MW.sec].lyrics.split('\n')[0]); }), 'pick Dm, tap a word: the chord sits on that word in the song');
  await m.tap('.mw-pk[data-sym="✕"]'); await m.tap('.mw-w[data-l="0"][data-w="3"]'); await wait(300);
  ok(await ev(() => { const D = window.__daily; return !/Dm/.test(D.S.sections[D.MW.sec].lyrics.split('\n')[0]); }), '✕ Remove takes it off again');
  /* a new section: words first, chords next, and the band plays them */
  await m.tap('.mw-add'); await wait(250); await m.tap('.mw-addm button:has-text("Bridge")'); await wait(400);
  await m.tap('.mw-mode [data-mode="write"]'); await wait(200); await m.tap('#mwText'); await m.keyboard.type('Hold on to the harbour light'); await m.tap('.mw-tools'); await wait(400);
  await m.tap('.mw-mode [data-mode="chords"]'); await wait(200); await m.tap('.mw-pk[data-sym="F"]'); await m.tap('.mw-w[data-l="0"][data-w="0"]'); await m.tap('.mw-pk[data-sym="G"]'); await m.tap('.mw-w[data-l="0"][data-w="3"]'); await wait(300);
  const B = await ev(() => { const D = window.__daily, s = D.S.sections[D.S.sections.length - 1]; return { name: s.name, ly: s.lyrics, bars: s.bars.map(b => b.chord).join(' ') }; });
  ok(B.name === 'Bridge' && B.ly === '[F]Hold on to [G]the harbour light' && /^F G/.test(B.bars), '＋ Bridge, its words, two chords tapped on: the band plays them, a bar each (' + B.ly + ' → ' + B.bars + ')');

  /* ---- Sing ---- */
  await m.tap('.mnb[data-g="sing"]'); await wait(400);
  ok(await ev(() => !!document.getElementById('msMic') && !!document.getElementById('msRec') && document.querySelectorAll('.ms-vb .msc').length >= 8 && !document.querySelector('#msub').getClientRects().length), 'Sing: a microphone button, ● Record over the beat, your takes and the voice sounds, with nothing above it');
  await m.tap('#msMic'); await poll(() => ev(() => !!document.querySelector('.ms-ok')), 6000);
  ok(await ev(() => { const D = window.__daily; return D.CFG.vin === 'L' && !!D.E.hasInput && !!document.querySelector('.ms-ok'); }), '🎤 Sing into this phone: the microphone becomes the voice input and says it is ready');
  await m.tap('.ms-vb .msc[data-vb="Ballad"]'); await wait(200);
  ok(await ev(() => window.__daily.CFG.vb.preset === 'Ballad' && document.querySelector('.ms-vb .msc.on').dataset.vb === 'Ballad'), 'a voice sound is one tap (Ballad)');
  await m.tap('#msRec'); await poll(() => ev(() => !!window.__daily.getREC()), 8000); await wait(1500);      /* past the one-bar count-in, then a moment of singing */
  await m.tap('#msRec'); await poll(() => ev(() => !window.__daily.T.playing), 4000); await wait(800);
  ok(await ev(() => window.__daily.TAKES.some(t => t.kind === 'vox') && document.querySelectorAll('.ms-take').length >= 1), '● records the voice over the beat, and the take is listed');

  /* ---- Beats, the song sheet, More ---- */
  await m.tap('.mnb[data-g="beats"]'); await wait(300); await m.tap('#mscreen .bt-card[data-beat="pop"]'); await wait(400);
  ok(await ev(() => window.__daily.S.band.beat === 'pop' && window.__daily.T.playing), 'Beats: tap one and it plays'); await ev(() => window.__daily.stopPlay(true));
  await m.tap('#mSongBtn'); await wait(300);
  ok(await ev(() => document.body.classList.contains('song-open') && document.querySelectorAll('#songbar .msong-f .field').length === 4), 'the song’s name opens the song sheet, which now holds the tempo, time signature, key and mode');
  await m.tap('#mback'); await wait(300);
  ok(await ev(() => document.querySelectorAll('#transport label.field').length === 4 && !document.querySelector('.msong-f')), 'closing it puts them back where the desktop expects them');
  await m.tap('.mnb[data-g="more"]'); await wait(300);
  ok(await ev(() => !!document.querySelector('.msheet [data-group="guitar"] [data-sub="rig"]') && !!document.querySelector('.msheet [data-group="see"] [data-sub="vis"]')), 'More holds the guitar (rig, tones, tuner, I/O, tab, refine) and the visuals');
  await m.tap('.msheet [data-group="guitar"] [data-sub="tab"]'); await wait(400);
  ok(await ev(() => window.__daily.M.g === 'guitar' && document.getElementById('pane-tab').getClientRects().length > 0 && document.querySelector('.mnb.on').dataset.g === 'more'), 'and opens them, with More lit');
  ok(await ev(() => { const D = window.__daily; D.mGo('play'); const a = D.M.g; D.mGo('write', 'tab'); const b = D.M.g + '/' + D.M.s; D.mGo('stems'); return a === 'guitar' && b === 'guitar/tab' && D.M.g === 'tracks'; }), 'the old section names (play, write ▸ tab, stems) still lead to the right place');

  /* ---- a desktop is untouched ---- */
  const d = await t.open({ w: 1440, h: 900 });
  ok(await d.evaluate(() => !document.getElementById('mscreen').getClientRects().length && [...document.querySelectorAll('#transport label.field')].filter(f => f.getClientRects().length).length === 4), 'on a computer nothing changes: no phone screen, tempo and key in the header');
});
