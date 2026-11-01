/* 2.24: one panel at the bottom of a phone at a time (Voice and the song sheet used to stack), the bottom More opens the sheet of extras,
   and the whole band and the click mute in one press (the band strip, the phone's transport, Perform, Shift+M) and come back as they were. */
const { suite } = require('./lib.cjs');

suite('e2e-phone-panels', async t => {
  const { ok, wait } = t;
  const p = await t.open({ w: 412, h: 915, mobile: true, init: () => { try { localStorage.setItem('fw.cfg', JSON.stringify({ form: 'phone' })); } catch (e) { } } });
  const ev = (f, a) => p.evaluate(f, a);
  await wait(600);
  const state = () => ev(() => { const D = window.__daily; return { drums: D.S.band.drumsOn, bass: D.S.band.bassOn, rhythm: D.S.band.compOn, lead: D.S.band.leadOn, click: D.T.metro }; });

  /* ---- the phone's transport ---- */
  const TR = await ev(() => ({ trans: [...document.querySelectorAll('#mtrans > *')].filter(x => x.getClientRects().length).map(x => x.id || x.className), fields: [...document.querySelectorAll('#transport label.field')].filter(x => x.getClientRects().length).length }));
  ok(TR.trans.includes('bandMute') && TR.trans.some(c => /lcd/.test(c)) && TR.fields === 4, 'the phone’s transport has a band button beside the click, the position display stays, and tempo, metre, key and mode stay at the top (' + TR.trans.length + ' items)');

  /* ---- one press mutes the band and the click; the next brings back exactly what was playing ---- */
  await ev(() => { const D = window.__daily; D.S.band.drumsOn = true; D.S.band.bassOn = false; D.S.band.compOn = true; D.S.band.leadOn = false; D.T.metro = true; D.commit(false); });
  const before = await state();
  await p.tap('#bandMute'); await wait(250);
  const muted = await state();
  ok(Object.values(muted).every(v => !v), 'one tap on a phone mutes the whole band and the click');
  ok(await ev(() => { const b = document.getElementById('bandMute'); return b.getAttribute('aria-pressed') === 'true' && b.classList.contains('on') && b.textContent.includes('🔇'); }), 'the button shows it: pressed, highlighted, 🔇');
  await p.tap('#bandMute'); await wait(250);
  ok(JSON.stringify(await state()) === JSON.stringify(before), 'the next tap brings back exactly what was playing (drums and rhythm and the click, not the bass or the lead)');
  ok(await ev(() => document.getElementById('bandMute').getAttribute('aria-pressed') === 'false' && document.getElementById('bandMute').textContent.includes('🔊')), 'and the speaker says the band is on again');

  /* ---- the bottom More: the sheet of extras, with its panels first ---- */
  await p.tap('.mnb[data-g="more"]'); await wait(400);
  const MS = await ev(() => ({ sheet: !!document.querySelector('.msheet'), panels: [...document.querySelectorAll('.msheet .mpanel-b button')].map(b => b.textContent.trim()), tiles: document.querySelectorAll('.msheet .mtile').length, pane: [...document.querySelectorAll('.pane')].filter(x => x.getClientRects().length && x.offsetHeight > 50).map(x => x.id).join() }));
  ok(MS.sheet && MS.tiles >= 12 && MS.panels.join() === 'Research,Export' && !/pane-lab/.test(MS.pane), 'the bottom More opens the sheet of extras (' + MS.tiles + ' tiles) with Research and Export as its first row, instead of jumping to the measurements');
  await p.tap('.msheet .mpanel-b button[data-sub="exp"]'); await wait(400);
  ok(await ev(() => !document.querySelector('.msheet') && document.getElementById('pane-exp').getClientRects().length > 0 && document.querySelector('.mnb[data-g="more"]').classList.contains('on')), 'Export from that row opens the Export panel, under More');
  await p.tap('.mmore'); await wait(300);
  ok(await ev(() => !!document.querySelector('.msheet')), 'the ••• at the top still opens the same sheet');
  await p.tap('.msheet .mtile:has-text("Voice")'); await wait(400);
  ok(await ev(() => !document.querySelector('.msheet') && !!document.getElementById('voxPanel')), 'Voice from the sheet: the sheet goes, Voice opens');

  /* ---- one panel at the bottom at a time ---- */
  await p.tap('.msc.song'); await wait(400);
  ok(await ev(() => document.body.classList.contains('song-open') && !document.getElementById('voxPanel')), 'opening the song sheet puts Voice away (they used to stack)');
  await p.tap('#sbVoice'); await wait(400);
  ok(await ev(() => !document.body.classList.contains('song-open') && !!document.getElementById('voxPanel')), 'Voice from the song sheet: the sheet closes, Voice is on its own');
  await ev(() => window.__daily.voxClose()); await p.tap('.msc.song'); await wait(300); await p.tap('#sbPerform'); await wait(600);
  ok(await ev(() => !document.body.classList.contains('song-open') && !!document.getElementById('perform')), 'Perform from the song sheet: the sheet closes first');

  /* ---- Perform has the band too ---- */
  const pfBefore = await state();
  await ev(() => document.getElementById('pfBand').click()); await wait(200);
  ok(await ev(() => document.getElementById('pfBand').classList.contains('on') && /muted/.test(document.getElementById('pfBand').textContent)) && Object.values(await state()).every(v => !v), 'Perform: 🔊 Band mutes everything in one press, and says so');
  await ev(() => document.getElementById('pfBand').click()); await wait(200);
  ok(JSON.stringify(await state()) === JSON.stringify(pfBefore), 'and brings it all back');
  await ev(() => window.__daily.perfClose()); await wait(300);
  ok(await ev(() => document.documentElement.scrollWidth <= innerWidth), 'nothing on the phone is wider than the screen');

  /* ---- a computer: the band strip, Shift+M ---- */
  const d = await t.open({ w: 1500, h: 900 }), dv = (f, a) => d.evaluate(f, a);
  await dv(() => { const D = window.__daily; D.S.band.drumsOn = true; D.S.band.bassOn = true; D.S.band.compOn = false; D.S.band.leadOn = true; D.T.metro = false; D.commit(false); });
  const dBefore = await dv(() => { const D = window.__daily; return JSON.stringify([D.S.band.drumsOn, D.S.band.bassOn, D.S.band.compOn, D.S.band.leadOn, D.T.metro]); });
  ok(await dv(() => !!document.getElementById('bandMuteAll') && /Mute all/.test(document.getElementById('bandMuteAll').textContent) && getComputedStyle(document.getElementById('bandMute')).display === 'none'), 'on a computer, Mute all sits in the band strip (the transport keeps its usual buttons)');
  await dv(() => document.body.focus()); await d.keyboard.press('Shift+M'); await wait(250);
  ok(await dv(() => { const D = window.__daily; return !D.S.band.drumsOn && !D.S.band.bassOn && !D.S.band.leadOn && !D.T.metro && /Unmute all/.test(document.getElementById('bandMuteAll').textContent); }), 'Shift+M mutes the whole band and the click, and the chip says Unmute all');
  await d.keyboard.press('Shift+M'); await wait(250);
  ok(await dv(b => { const D = window.__daily; return JSON.stringify([D.S.band.drumsOn, D.S.band.bassOn, D.S.band.compOn, D.S.band.leadOn, D.T.metro]) === b; }, dBefore), 'Shift+M again brings back what was playing');
  await d.keyboard.press('m'); await wait(150);
  ok(await dv(() => window.__daily.T.metro === true && !document.getElementById('bandMuteAll').classList.contains('on')), 'M on its own is still just the click');
  await dv(() => document.getElementById('bandMuteAll').click()); await wait(150); await d.keyboard.press('d'); await wait(150);
  ok(await dv(() => window.__daily.S.band.drumsOn === true && !document.getElementById('bandMuteAll').classList.contains('on')), 'switching one part back on by hand ends the mute');
});
