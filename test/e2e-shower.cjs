/* Shower mode (2.27): hidden (hold the logo two seconds, or type "shower"), one screen of big buttons: the songs saved with a track one
   after another, the four stems, play, ● to record yourself, then your take back with the steam. The voice is Chromium's fake microphone
   and readings fed to singStep; the tracks are the synthetic backing track the stems tests use. */
const { suite } = require('./lib.cjs');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');

suite('e2e-shower', async t => {
  const { ok, wait, poll } = t;
  const p = await t.open({ w: 1280, h: 800 }), ev = (f, a) => p.evaluate(f, a);
  process.env.BARS = '8'; const SY = require('./stem_synth.cjs'), mono = SY.L.map((x, i) => (x + SY.R[i]) / 2);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shw-')), f1 = path.join(dir, 'Harbour Lights.wav'), f2 = path.join(dir, 'Salt Wind.wav');
  fs.writeFileSync(f1, t.wav(mono, 44100)); fs.writeFileSync(f2, t.wav(mono.map(x => x * .8), 44100));
  const hold = async (pg, ms) => { const b = await pg.$('header .brand'), bb = await b.boundingBox(); await pg.mouse.move(bb.x + 12, bb.y + 12); await pg.mouse.down(); await wait(ms); await pg.mouse.up(); await wait(500); };
  const open = () => ev(() => { const d = document.getElementById('shower'); return !!(d && d.open); });

  /* ---- hidden ---- */
  ok(await ev(() => !/Shower/i.test(document.body.innerText) && ![...document.querySelectorAll('button,a,[title]')].some(b => /shower/i.test(b.textContent + ' ' + (b.title || '')))), 'nothing in the studio names Shower mode or points to it');
  const home = await ev(async () => { const D = window.__daily; D.S.title = 'My work in progress'; D.commit(false); await D.projSave(); D.T.metro = true; D.S.band.drumsOn = true; D.commit(false); return D.PRJ.cur; });
  await hold(p, 900);
  ok(!(await open()), 'a short press on the logo does nothing');
  await hold(p, 2300);
  ok(await open(), 'holding the logo for two seconds opens Shower mode');
  ok(await ev(() => /You found Shower mode/.test(document.getElementById('toasts').textContent) && !!window.__daily.CFG.shed.found), 'the first time, it says you found it');
  const E0 = await ev(() => ({ empty: !document.querySelector('.shw-empty').hidden, play: document.querySelector('.shw-play').disabled, rec: document.querySelector('.shw-rec').disabled, quiet: window.__daily.T.quiet, mic: !!window.__daily.SING.mic }));
  ok(E0.empty && E0.play && E0.rec && E0.quiet && !E0.mic, 'with no songs that have a track: one big Add a song, the controls wait, the click is quiet, and the microphone is closed');

  /* ---- adding songs from in here ---- */
  await p.setInputFiles('#shower input[type=file]', f1);
  ok(await poll(() => ev(() => !window.__daily.SHW.busy && window.__daily.SHW.q.length === 1), 90000), '＋ adds a song: its track is saved and its stems are split on this device');
  await p.setInputFiles('#shower input[type=file]', f2); await poll(() => ev(() => !window.__daily.SHW.busy && window.__daily.SHW.q.length === 2), 90000);
  const Q = await ev(() => ({ song: document.querySelector('.shw-song').textContent, pos: document.querySelector('.shw-pos').textContent, band: window.__daily.T.quiet && !window.__daily.bandMuted() }));
  ok(Q.song === 'Salt Wind' && /^1 of 2/.test(Q.pos) && Q.band, 'the new song is up, first in line (' + Q.song + ', ' + Q.pos + '), with the band and the click silent while you are in here, though no song’s band is switched off: just the record');

  const bands = () => ev(async () => { const D = window.__daily; await D.projRefresh(); return JSON.stringify(D.PRJ.list.filter(r => r.track).map(r => [r.id, ['drumsOn', 'bassOn', 'compOn', 'leadOn'].map(k => !!r.song.band[k])])); });
  const bands0 = await bands();

  /* ---- the stems ---- */
  const mix = () => ev(() => window.__daily.STM.mix.map(m => (m.m ? 0 : +m.g.toFixed(2))));
  ok((await mix()).join() === '1,1,0.22,1', 'the singer starts as a quiet guide, the rest as recorded (' + (await mix()).join() + ')');
  await p.click('[data-stem="vox"]'); await wait(150);
  ok((await mix())[2] === 0 && await ev(() => document.querySelector('[data-stem="vox"]').getAttribute('aria-pressed') === 'false' && /Singer off/.test(document.querySelector('[data-stem="vox"]').textContent)), 'one tap: the singer is off (karaoke), and the button says so');
  await p.click('[data-stem="vox"]'); await wait(150);
  ok((await mix())[2] === 1, 'another: the singer as recorded');
  await p.click('[data-stem="drums"]'); await wait(150);
  ok((await mix())[0] === 0 && await ev(() => window.__daily.CFG.shed.shw.drums === false), 'the drums go off with one tap, and the choice is remembered for every song');

  /* ---- play, the queue ---- */
  await p.click('.shw-play'); ok(await poll(() => ev(() => window.__daily.T.playing), 5000), '▶ plays');
  ok(await ev(() => document.querySelector('.shw-play').getAttribute('aria-label') === 'Pause'), 'and becomes ⏸ (Pause)');
  await ev(() => { const D = window.__daily; D.stopPlay(false); });      /* the song ends on its own */
  ok(await poll(() => ev(() => !window.__daily.SHW.busy && window.__daily.SHW.i === 1 && window.__daily.T.playing), 60000), 'when a song ends, the next one starts by itself');
  ok(await ev(() => document.querySelector('.shw-song').textContent === 'Harbour Lights' && window.__daily.STM.mix[0].m === true), 'Harbour Lights is up, with the drums still off');
  await p.click('.shw-next'); ok(await poll(() => ev(() => !window.__daily.SHW.busy && window.__daily.SHW.i === 0 && window.__daily.T.playing), 60000), '⏭ goes round to the first song again and keeps playing');
  await p.click('.shw-play'); await wait(300);
  ok(await ev(() => !window.__daily.T.playing && window.__daily.SHW.paused), '⏸ pauses, and a pause is not mistaken for the end of the song');
  await wait(700); ok(await ev(() => window.__daily.SHW.i === 0 && !window.__daily.T.playing), 'so it stays on this song');

  /* ---- recording yourself ---- */
  await p.click('.shw-rec');
  ok(await poll(() => ev(() => !!window.__daily.SHW.rec && window.__daily.T.playing), 6000), '● plays the song and records you');
  await poll(() => ev(() => !document.querySelector('.shw-meter').hidden), 2000);      /* the meter shows on the next frame */
  const R1 = await ev(() => { const D = window.__daily, tr = D.SING.mic.getAudioTracks()[0]; return { live: tr.readyState === 'live', ec: tr.getSettings().echoCancellation, air: document.body.classList.contains('onair'), meter: !document.querySelector('.shw-meter').hidden, pressed: document.querySelector('.shw-rec').getAttribute('aria-pressed'), main: D.E.hasInput }; });
  ok(R1.live && R1.ec !== false && R1.meter && R1.pressed === 'true' && !R1.main, 'only now is the microphone open, with echo cancellation; the belt meter shows; the studio’s own input stays closed (' + JSON.stringify(R1) + ')');
  ok(await poll(() => ev(() => document.body.classList.contains('onair')), 2000), 'and the red On air light is on');
  await ev(() => { const D = window.__daily; for (let i = 0; i < 45; i++) D.singStep(67, -14, .1); for (let i = 0; i < 10; i++) D.singStep(62, -28, .1); });
  ok(await ev(() => window.__daily.SING.st.ducks === 1 && window.__daily.SING.st.longest > 4), 'a note held four seconds earns a rubber duck');
  await wait(1200); await p.click('.shw-rec'); await wait(900);
  const C = await ev(() => { const D = window.__daily, tk = document.querySelector('.shw-take'); return { rec: !!D.SHW.rec, card: !tk.hidden && /Longest note/.test(tk.textContent), score: D.SHW.card && D.SHW.card.score, title: D.SHW.card && D.SHW.card.title, take: D.SHW.take ? D.SHW.take.blob.size : 0, playing: D.T.playing }; });
  ok(!C.rec && C.card && C.score > 0 && C.take > 1000 && C.playing, '● again stops recording (the music plays on): a splash score (' + C.score + ', ' + C.title + ') and your take in memory (' + C.take + ' bytes)');
  ok(await poll(() => ev(() => !document.body.classList.contains('onair')), 2000), 'the red light goes off');
  await p.click('#shwHear');
  ok(await poll(() => ev(() => window.__daily.T.playing && window.__daily.SHW.hearing > 0), 6000), '▶ Hear it, steamy: the music from where you started, with your take through the bathroom reverb');
  ok(await poll(() => ev(() => !window.__daily.T.playing && window.__daily.SHW.hearing === 0 && window.__daily.SHW.i === 0), 8000), 'it stops when your take does, and does not run on to the next song');
  const dl = p.waitForEvent('download', { timeout: 15000 }); await p.click('#shwSave');
  const d1 = await dl.catch(() => null), fp = d1 && await d1.path().catch(() => null);
  ok(!!d1 && /_shower_take\.wav$/.test(d1.suggestedFilename()) && fp && fs.readFileSync(fp).toString('latin1', 8, 12) === 'WAVE', '💾 Keep it: your voice with the steam, as a WAV file (' + (d1 ? d1.suggestedFilename() : 'none') + ')');
  await p.click('#shwDrop'); ok(await ev(() => !window.__daily.SHW.take && document.querySelector('.shw-take').hidden), '✕ throws the take away');

  /* ---- leaving puts everything back ---- */
  await p.click('.shw-x');
  ok(await poll(() => ev(h => !document.getElementById('shower') && window.__daily.PRJ.cur === h, home), 30000), 'leaving goes back to the song you had open');
  const B = await ev(() => { const D = window.__daily; return { mic: !!D.SING.mic, quiet: D.T.quiet, metro: D.T.metro, muted: D.bandMuted(), drums: D.S.band.drumsOn, title: D.S.title }; });
  ok(!B.mic && !B.quiet && B.metro && !B.muted && B.drums && B.title === 'My work in progress', 'the microphone is closed, and the click and the band play again, as they were');
  ok(await bands() === bands0, 'and the songs Shower mode played keep their band exactly as it was: nothing was switched off in them');

  /* ---- type "shower" ---- */
  await ev(() => document.body.focus()); await p.keyboard.type('shower'); await wait(800);
  ok(await open() && await ev(() => !window.__daily.T.rec && !window.__daily.getREC()), 'typing "shower" opens it too, and the R at the end does not arm recording');
  ok(await poll(() => ev(() => !window.__daily.SHW.busy && window.__daily.SHW.q.length === 2), 60000), 'the songs are there, in the order they were last changed');
  await p.keyboard.press('Escape'); await poll(() => ev(() => !document.getElementById('shower')), 5000);
  await ev(() => { const i = document.createElement('input'); i.id = 'tx'; document.body.append(i); i.focus(); }); await p.keyboard.type('shower'); await wait(500);
  ok(!(await open()), 'typing the word into a text box does not');
  await ev(() => document.getElementById('tx').remove());

  /* ---- on a phone ---- */
  const m = await t.open({ w: 390, h: 844, mobile: true }), mv = (f, a) => m.evaluate(f, a);
  await hold(m, 2300); await wait(500);
  const PH = await mv(() => { const d = document.getElementById('shower'), r = s => document.querySelector(s).getBoundingClientRect(); return { open: !!(d && d.open), wide: d.scrollWidth <= innerWidth, play: r('.shw-play').height, stem: r('.shw-stem').height, x: r('.shw-x').height, fit: r('.shw-rec').right <= innerWidth }; });
  ok(PH.open && PH.wide && PH.play >= 70 && PH.stem >= 56 && PH.x >= 44 && PH.fit, 'on a phone a long press opens it, everything fits, and every button is big enough for a wet thumb (play ' + Math.round(PH.play) + ' px, stems ' + Math.round(PH.stem) + ' px)');
});
