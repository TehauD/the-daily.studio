/* One session: clips and the backing-track mix survive a reload and a song-bundle round trip, and every kind of change
   (a fader, a mute, a clip edit, a stem level) is a step in the one Undo history. Own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
suite('e2e-session', async t => {
  const { ok, wait, poll } = t, p = await t.open();
  const ev = fn => p.evaluate(fn);
  const addTake = (name, sec, f, kind) => p.evaluate(async ({ name, b64, kind }) => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); return !!(await window.__daily.dropTake(new File([u], name, { type: 'audio/wav' }), kind)); }, { name, b64: t.wav(t.tone(sec, f, { amp: .5 }).data, 22050).toString('base64'), kind });
  const st = () => ev(() => { const d = window.__daily; return { u: d.histStack.u.length, takes: d.TAKES.length, g: d.TAKES.map(x => x.g), mute: d.TAKES.map(x => x.mute), vol: d.STM.vol, s0: d.STM.mix[0] && d.STM.mix[0].g, m0: d.STM.mix[0] && d.STM.mix[0].m, drums: d.S.mix.drums.g, dm: d.S.mix.drums.m }; });
  const slider = async sel => { const sl = await p.$(sel); await sl.scrollIntoViewIfNeeded(); const bb = await sl.boundingBox(); await p.mouse.move(bb.x + bb.width * .6, bb.y + bb.height / 2); await p.mouse.down(); await p.mouse.move(bb.x + bb.width * .2, bb.y + bb.height / 2, { steps: 6 }); await p.mouse.up(); await wait(350); };

  ok(await addTake('Riff.wav', 6, 220, 'gtr'), 'a guitar take is added'); await p.click('.cmax[data-m="tl"]').catch(() => 0); await wait(500);
  let s0 = await st();
  // one history: a whole fader drag is one step, a mute is one step, a band mute is one step, a stem level is one step, a clip delete is one step
  await slider('.tl-head input[type=range][title^="Take volume"]'); let s = await st(); ok(s.u === s0.u + 1 && s.g[0] < s0.g[0], 'one fader drag is one undo step (' + s0.g[0] + ' → ' + s.g[0] + ')');
  await p.keyboard.press('Control+z'); await wait(300); s = await st(); ok(Math.abs(s.g[0] - s0.g[0]) < .001, 'Undo puts the fader back'); await p.keyboard.press('Control+y'); await wait(300); s = await st(); ok(s.g[0] < s0.g[0], 'Redo moves it again'); await p.keyboard.press('Control+z'); await wait(300);
  await p.click('.tl-head.take button.mute'); await wait(300); s = await st(); ok(s.mute[0] === true, 'M mutes the take'); await p.keyboard.press('Control+z'); await wait(300); s = await st(); ok(s.mute[0] === false, 'Undo un-mutes it');
  await ev(() => { const hd = [...document.querySelectorAll('.tl-head')].find(x => /Drums/.test(x.textContent)); hd.querySelector('button.mute').click(); }); await wait(300); s = await st(); ok(s.dm === 1, 'a band part mute is in the same history'); await p.keyboard.press('Control+z'); await wait(300); s = await st(); ok(!s.dm, 'Undo un-mutes the band part');
  await ev(() => { const d = window.__daily; d.tkSelect(d.TAKES[0].id); d.tkDelete(); }); s = await st(); ok(s.takes === 0, 'deleting the only clip removes the lane'); await p.keyboard.press('Control+z'); await wait(400); s = await st(); ok(s.takes === 1, 'Undo brings the lane back');
  ok(await ev(() => { const d = window.__daily; return d.TAKES[0].dry.length > 1000 && d.TAKES[0].peaks && document.querySelectorAll('.tl-head.take').length === 1; }), 'the restored take has its audio, its waveform and its lane header');

  // a backing track: mix changes are saved with the song
  const trk = await ev(() => { const sr = 22050, n = sr * 12, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const tt = i / sr, k = (tt % .5) < .08 ? Math.sin(2 * Math.PI * 60 * tt) * Math.exp(-(tt % .5) * 30) : 0; v.setInt16(44 + i * 2, Math.round((k * .8 + Math.sin(2 * Math.PI * 220 * tt) * .25 + Math.sin(2 * Math.PI * 330 * tt) * .15) * 20000), true); }
    window.__track = new File([b], 'Tone Track.wav', { type: 'audio/wav' }); return true; });
  await ev(async () => { await window.__daily.stemLoad(window.__track); }); ok(await ev(() => !!window.__daily.STM.ch), 'a backing track is split into stems');
  const u1 = (await st()).u; await ev(() => { const d = window.__daily; d.histBegin(); d.STM.mix[0].g = .35; d.STM.mix[1].m = true; d.STM.mix[3].p = -.4; d.STM.vol = .6; d.commit(false); d.histEnd(); }); await wait(300);
  s = await st(); ok(s.u === u1 + 1, 'stem and track levels are one undo step'); await p.keyboard.press('Control+z'); await wait(300); s = await st(); ok(s.vol === 1 && s.s0 === 1, 'Undo restores the stem mix'); await p.keyboard.press('Control+y'); await wait(300);
  await ev(() => { const d = window.__daily; d.tkSplit(d.TAKES[0], 2); d.TAKES[1].fadeOut = .8; d.TAKES[0].g = .5; d.commit(false); });
  await ev(async () => { await window.__daily.projSave(); }); await wait(500);

  // reload: clips, fades, lane level and the stem mix come back
  await t.boot(p, { settle: 3000 }); ok(await poll(() => ev(() => !!window.__daily.STM.ch), 40000, 400), 'the backing track comes back after a reload');
  const r = await ev(() => { const d = window.__daily; return { n: d.TAKES.length, leads: d.tkLeads().length, fo: d.TAKES[1] && d.TAKES[1].fadeOut, g: d.TAKES[0] && d.TAKES[0].g, shared: d.TAKES.length > 1 && d.TAKES[0].dry === d.TAKES[1].dry, vol: d.STM.vol, s0: d.STM.mix[0].g, m1: d.STM.mix[1].m, p3: d.STM.mix[3].p, hist: d.histStack.u.length }; });
  ok(r.n === 2 && r.leads === 1 && Math.abs(r.fo - .8) < .001 && Math.abs(r.g - .5) < .001, 'both clips, the fade and the lane level survive a reload ' + JSON.stringify([r.n, r.leads, r.fo, r.g])); ok(r.shared, 'the clips still share one recording after a reload');
  ok(Math.abs(r.vol - .6) < .001 && Math.abs(r.s0 - .35) < .001 && r.m1 === true && Math.abs(r.p3 + .4) < .001, 'the stem mix (level, mute, pan, track level) survives a reload ' + JSON.stringify([r.vol, r.s0, r.m1, r.p3])); ok(r.hist === 0, 'a freshly opened song starts with an empty history');

  // song bundle: each clip is its own trimmed WAV, and importing it reproduces the arrangement
  const z = await ev(async () => { const d = window.__daily, files = await d.projEntries(d.PRJ.cur, ''), arr = JSON.parse(new TextDecoder().decode(files.find(f => f.name === 'arrangement.json').data)); return { wavs: files.filter(f => /\.wav$/.test(f.name)).length, takes: arr.takes.length, mix: !!(arr.stemMix || (arr.stems && arr.stems.mix) || JSON.stringify(arr).includes('stemMix')), names: files.map(f => f.name) }; });
  ok(z.takes === 2 && z.wavs >= 2, 'the bundle holds one WAV per clip (' + z.wavs + ' WAV files)');
  await ev(async () => { const d = window.__daily, blob = d.zipBuild(await d.projEntries(d.PRJ.cur, '')); await d.projImport(new File([blob], 'x.daily-song.zip')); }); await wait(1500);
  const im = await ev(() => { const d = window.__daily; return { n: d.TAKES.length, leads: d.tkLeads().length, len: d.TAKES.map(c => +d.tkLen(c).toFixed(2)), start: d.TAKES.map(c => +c.startSec.toFixed(2)) }; });
  ok(im.n === 2 && im.leads === 1 && Math.abs(im.len[0] + im.len[1] - 6) < .05 && Math.abs(im.start[1] - 2) < .05, 'importing the bundle brings back both clips in place ' + JSON.stringify(im));
});
