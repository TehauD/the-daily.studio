/* The whole song and Perform's layouts (2.48).
   WRITE    a song map (a block per section, as wide as its bars), a Whole song view with every section in order, and ＋ as a menu of
            section kinds that names them (Verse 1, Verse 2…) and starts a second verse with the first one's chords.
   PERFORM  laid out the way each person likes, remembered: controls at the top right (or the bottom, or hidden until you move), the
            words in a band at the bottom like a sing-along (or in the middle), a text size, the song map, and a Sing-along view. */
const { suite } = require('./lib.cjs');

suite('e2e-songmap', async t => {
  const { ok, wait } = t;
  const p = await t.open({ w: 1600, h: 900 }), ev = (f, a) => p.evaluate(f, a);
  await ev(() => { const D = window.__daily; D.S.sections = [D.mkSection('Intro', ['Am', 'F']), D.mkSection('Verse', ['Am', 'F', 'C', 'G']), D.mkSection('Chorus', ['F', 'G', 'Am', 'Am', 'F', 'G', 'C', 'C'])]; D.S.sections[1].lyrics = '[Am]Salt wind on the [F]water\n[C]Morning on my [G]skin'; D.S.sections[2].lyrics = '[F]Hold on, [G]hold on'; D.T.bars = null; D.commit(false); D.dockGo('tab'); D.wrMode('song'); });
  await wait(500);

  /* ---- Write: the whole song as a chord sheet (2.48.1, the default) ---- */
  await ev(() => { const D = window.__daily; D.S.sections.push(Object.assign(D.mkSection('Chorus', ['F', 'G', 'Am', 'Am', 'F', 'G', 'C', 'C']), { lyrics: '[F]Hold on, [G]hold on' })); D.T.bars = null; D.commit(false); });
  await wait(500);
  const SH = await ev(() => { const sh = document.getElementById('wsSheet'), secs = [...sh.querySelectorAll('.wsh-sec')];
    return { n: secs.length, names: secs.map(x => x.querySelector('.wsh-n').textContent).join(), lines: sh.querySelectorAll('.wsh-l').length, chords: [...secs[1].querySelectorAll('.ly-c')].map(c => c.textContent.trim()).filter(Boolean).join(' '), words: secs[1].querySelector('.wsh-l').textContent.replace(/\s+/g, ' ').trim(),
      bars: [...secs[0].querySelectorAll('.wsh-bar')].map(b => b.textContent).join(' '), rep: secs[3].classList.contains('rep') && /Same words and chords as Chorus/.test(secs[3].textContent), cols: getComputedStyle(sh).columnWidth, inputs: sh.querySelectorAll('input,textarea').length }; });
  ok(SH.n === 4 && SH.names === 'Intro,Verse,Chorus,Chorus' && SH.inputs === 0, 'Whole song opens as a chord sheet: every section, nothing to edit in the way (' + SH.names + ')');
  ok(SH.chords === 'Am F C G' && /^Am ?Salt wind on the ?F? ?water/.test(SH.words) && SH.lines === 3, 'the words with their chords over them, as pasted (' + SH.chords + ' over “' + SH.words + '”)');
  ok(SH.bars === 'Am F', 'a section with no words shows its bars of chords (' + SH.bars + ')');
  ok(SH.rep, 'a chorus that repeats an earlier one word for word is one line');
  ok(SH.cols === '320px', 'it flows into columns across the screen (' + SH.cols + ' each)');
  await ev(() => document.querySelector('#wsSheet .wsh-sec[data-si="1"]').click()); await wait(300);
  ok(await ev(() => { const e = document.querySelector('#wsSheet .wsh-sec.editing'); return !!e && e.dataset.si === '1' && !!e.querySelector('textarea') && document.querySelectorAll('#wsSheet .wsh-sec').length === 4; }), 'clicking a section opens its editor in place, the rest stays a sheet');
  await ev(() => document.getElementById('wsFull').click()); await wait(300);
  const FS = await ev(() => { const r = document.getElementById('pane-tab').getBoundingClientRect(); return { full: document.body.classList.contains('ws-full'), w: r.width >= innerWidth - 1, h: r.height >= innerHeight - 1 }; });
  ok(FS.full && FS.w && FS.h, 'Full screen fills the window with the song');
  await p.keyboard.press('Escape'); await wait(200);
  ok(await ev(() => !document.body.classList.contains('ws-full')), 'and Esc brings the studio back');
  await wait(800);
  ok(await ev(() => ![...document.querySelectorAll('#toasts .toast')].some(t => /trainer/.test(t.textContent))), 'the sheet does not start the scale trainer (two functions once shared a name; the build now refuses that)');
  await ev(() => { const D = window.__daily; D.S.sections.pop(); D.T.bars = null; D.commit(false); D.CFG.wsView = 'edit'; D.wrMode('song'); }); await wait(400);

  /* ---- Write: the whole song, every editor (Edit all) ---- */
  const W = await ev(() => { const blocks = [...document.querySelectorAll('#pane-tab .wr-words .smap-b')];
    return { secs: [...document.querySelectorAll('#pane-tab .ws-sec')].map(x => x.querySelector('input.in').value), names: blocks.map(b => b.textContent), grow: blocks.map(b => +b.style.flexGrow), kinds: blocks.map(b => b.dataset.kind), tabHidden: getComputedStyle(document.querySelector('#pane-tab .wr-tabcol')).display === 'none' }; });
  ok(W.secs.join() === 'Intro,Verse,Chorus' && W.tabHidden, 'Whole song shows every section in order, each one editable (' + W.secs.join(', ') + '), with the tab out of the way');
  ok(W.names.join() === 'Intro,Verse,Chorus' && W.grow.join() === '2,4,8' && W.kinds.join() === 'intro,verse,chorus', 'its song map has a block per section, as wide as its bars (' + W.grow.join(', ') + ') and coloured by kind');
  await ev(() => document.querySelector('#pane-tab .wr-words .smap-b[data-si="2"]').click()); await wait(300);
  ok(await ev(() => window.__daily.SEL.sec === 2), 'clicking a block picks that section');

  /* ＋ is a menu of kinds; names are numbered as they repeat, and a second verse starts with the first one's chords */
  await ev(() => { window.__daily.SEL.sec = 1; document.getElementById('wsAdd').click(); }); await wait(250);
  const menu = await ev(() => [...document.querySelectorAll('.pop .sm-k')].map(b => b.textContent).join());
  ok(menu === 'Intro,Verse,Pre-chorus,Chorus,Interlude,Bridge,Solo,Outro', 'the add menu offers every kind of section (' + menu + ')');
  await ev(() => document.querySelector('.pop .sm-k[data-kind="verse"]').click()); await wait(300);
  const A = await ev(() => { const D = window.__daily; D.secAdd('inter', 2); D.secAdd('verse', 3); return { names: D.S.sections.map(s => s.name), v2: D.S.sections[2].bars.map(b => b.chord).join(' '), v2ly: D.S.sections[2].lyrics }; });
  ok(A.names.join() === 'Intro,Verse 1,Verse 2,Interlude,Verse 3,Chorus', 'sections are added after the one picked and named for you: ' + A.names.join(', '));
  ok(A.v2 === 'Am F C G' && A.v2ly === '', 'a second verse starts with the first one\'s chords and no words (' + A.v2 + ')');

  /* ---- Perform: the default is a sing-along with the controls at the top right ---- */
  await ev(async () => { const D = window.__daily; await D.startAudio(); D.T.metro = false; D.T.loop = true; D.T.cursor = 0; D.perfOpen(); document.getElementById('pfGo').click(); D.play(); });
  await wait(2600);
  const P = await ev(() => { const r = s => document.querySelector(s).getBoundingClientRect(), el = document.getElementById('perform');
    return { cls: [...el.classList].filter(c => /^pf-(ctl|lyr|size|map)-/.test(c)).sort().join(' '), play: r('#pfPlay'), stage: r('.pf-stage'), lyr: r('#pfLyr'), map: document.querySelectorAll('#perform .pf-map .smap-b').length, cur: (document.querySelector('#perform .smap-b.cur') || {}).textContent, h: innerHeight, w: innerWidth }; });
  ok(P.cls === 'pf-ctl-top pf-lyr-bottom pf-map-on pf-size-m', 'Perform opens laid out as a sing-along (' + P.cls + ')');
  ok(P.play.bottom < P.stage.top + 2 && P.play.left > P.w / 2, 'the controls are at the top right (Play at ' + Math.round(P.play.left) + ', ' + Math.round(P.play.top) + ')');
  ok(P.lyr.top > P.h * .55, 'the words sit in a band along the bottom (from ' + Math.round(P.lyr.top / P.h * 100) + '% down)');
  ok(P.map === 6 && !!P.cur, 'the song map is under the title, the section playing lit (' + P.cur + ')');

  /* the Layout menu: each choice changes the page and is remembered */
  await ev(() => document.getElementById('pfLayout').click()); await wait(250);
  const rows = await ev(() => [...document.querySelectorAll('#pfLayMenu .pf-lm-l')].map(x => x.textContent).join());
  ok(rows === 'Show,Controls,Words,Text size,Song map', 'the Layout menu has the view, the controls, the words, the text size and the map (' + rows + ')');
  await ev(() => { const b = (row, v) => [...document.querySelectorAll('#pfLayMenu .pf-lm-r')].find(r => r.querySelector('.pf-lm-l').textContent === row).querySelector('button[data-v="' + v + '"]').click(); b('Controls', 'bottom'); b('Words', 'middle'); b('Text size', 'l'); b('Song map', 'off'); });
  await wait(400);
  const Q = await ev(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { play: r('#pfPlay'), stage: r('.pf-stage'), map: getComputedStyle(document.querySelector('#perform .pf-map')).display, cls: [...document.getElementById('perform').classList].filter(c => /^pf-(ctl|lyr|size|map)-/.test(c)).sort().join(' '), cfg: JSON.stringify(window.__daily.CFG.pfLay) }; });
  ok(Q.play.top > Q.stage.bottom - 2 && Q.map === 'none' && Q.cls === 'pf-ctl-bottom pf-lyr-middle pf-map-off pf-size-l', 'controls to the bottom, words to the middle, larger text and no map, all at once (' + Q.cls + ')');
  await ev(() => { const D = window.__daily; D.perfClose(); D.perfOpen(); }); await wait(300);
  ok(await ev(() => document.getElementById('perform').classList.contains('pf-ctl-bottom') && document.getElementById('perform').classList.contains('pf-size-l')), 'the layout is remembered when Perform opens again');
  await ev(() => { document.getElementById('pfGo').click(); const D = window.__daily; D.pfLaySet('ctl', 'auto'); D.pfLaySet('map', 'on'); D.perfViewSet('sing'); if (document.activeElement) document.activeElement.blur(); }); await wait(3200);      /* a script's click leaves keyboard-style focus on Play, which (rightly) keeps the controls showing */
  const H = await ev(() => ({ op: getComputedStyle(document.querySelector('#perform .pf-bar')).opacity, low: document.getElementById('perform').classList.contains('pf-lyr-bottom') }));
  ok(+H.op < .1 && H.low, '"Hide until I move" hides the controls when nothing moves, and Sing-along puts the words at the bottom');
  await p.mouse.move(800, 400); await p.mouse.move(820, 420); await wait(500);
  ok(+(await ev(() => getComputedStyle(document.querySelector('#perform .pf-bar')).opacity)) > .9, 'moving the mouse brings the controls back');

  /* the map takes you there */
  await ev(() => { window.__daily.CFG.countIn = 0; document.querySelector('#perform .smap-b[data-si="5"]').click(); }); await wait(1500);
  ok(await ev(() => (document.querySelector('#perform .smap-b.cur') || {}).textContent === 'Chorus' && window.__daily.T.playing), 'clicking Chorus on the map plays on from the chorus');
  await ev(() => { const D = window.__daily; D.stopPlay(); D.pfLaySet('ctl', 'top'); D.pfLaySet('lyr', 'bottom'); D.pfLaySet('size', 'm'); D.pfLaySet('map', 'on'); D.perfViewSet('shapes'); D.perfClose(); });

  /* a phone: the same layout fits */
  const m = await t.open({ w: 390, h: 844, mobile: true });
  await m.evaluate(async () => { const D = window.__daily; await D.startAudio(); D.perfOpen(); document.getElementById('pfGo').click(); }); await wait(600);
  const M = await m.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth, play: !!document.getElementById('pfPlay').getClientRects().length, lyr: document.getElementById('pfLyr').getBoundingClientRect().bottom <= innerHeight + 1 }));
  ok(!M.over && M.play && M.lyr, 'on a phone it fits: no sideways scroll, the controls and the words on screen');
});
