/* Songs that build (2.44, part 03c), measured from the studio's own render: with Song build on, a quiet intro, a verse, a big chorus and an
   outro come out at different loudness; a section turned down drops; the chorus starts with a crash; a riser climbs into it; the last bar
   of a song that does not loop is one ringing hit. Then the controls, and the song link carrying the energies. */
const { suite } = require('./lib.cjs');

suite('e2e-build', async t => {
  const { ok, wait } = t;
  const p = await t.open({ w: 1280, h: 800 }), ev = (f, a) => p.evaluate(f, a);
  const render = o => ev(async o => {
    const D = window.__daily; await D.startAudio(); D.T.metro = false; D.mstSet('off');      /* measure the band, not the master's levelling */
    const mk = (name, n) => { const s = D.S.sections[0] ? Object.assign({}, D.S.sections[0]) : {}; return { id: Math.random().toString(36).slice(2), name, lyrics: '', bars: Array.from({ length: n }, (_, i) => ({ chord: ['Am', 'F', 'C', 'G'][i % 4], tab: [] })) }; };
    D.S.sections = [mk('Intro', 2), mk('Verse 1', 2), mk('Chorus', 2), mk('Outro', 1)]; D.S.bpm = 100; D.S.swing = 0; D.commit(false);
    D.beatUse('pop', { play: false, quiet: true }); D.S.band.build = o.build; D.S.band.leadOn = false; if (o.verseE) D.S.sections[1].energy = o.verseE; if (o.chorusE) D.S.sections[2].energy = o.chorusE; D.T.loop = false; D.T.bars = null; D.commit(false);
    const r = await D.ofrRender({ tail: 2 }), sr = r.sr, x = r.l, bar = 4 * 60 / D.S.bpm, pre = D.OFR ? (D.OFR.pre || 0) : 0;
    const seg = (a, b, hi) => { let e = 0, lp = 0, n = 0; const k = Math.exp(-2 * Math.PI * (typeof hi === 'number' ? hi : 4000) / sr); for (let i = Math.floor((pre + a) * sr); i < Math.min(x.length, Math.floor((pre + b) * sr)); i++) { lp = k * lp + (1 - k) * x[i]; const v = hi ? x[i] - lp : x[i]; e += v * v; n++; } return 10 * Math.log10(e / Math.max(1, n) + 1e-12); };
    return { intro: seg(0, 2 * bar - bar / 4), verse: seg(2 * bar, 4 * bar - bar / 4), chorus: seg(4 * bar, 6 * bar - bar / 4), outro0: seg(6 * bar, 6 * bar + .15), outroTail: seg(6 * bar + bar * .5, 7 * bar),
      crashC: seg(4 * bar, 4 * bar + .25, true), crashV: seg(2 * bar, 2 * bar + .25, true), riseA: seg(3 * bar, 3 * bar + bar / 4, true), riseB: seg(3 * bar + bar / 2, 3 * bar + .75 * bar, 1500) };
  }, o);
  const B = await render({ build: true }), F = await render({ build: false });
  ok(B.intro < B.verse - 1.5 && B.verse < B.chorus - 1.5, 'with Song build the song builds: intro ' + B.intro.toFixed(1) + ', verse ' + B.verse.toFixed(1) + ', chorus ' + B.chorus.toFixed(1) + ' dB');
  ok((B.chorus - B.intro) > (F.chorus - F.intro) + 3, 'and much more than without it (chorus over intro: ' + (B.chorus - B.intro).toFixed(1) + ' dB, against ' + (F.chorus - F.intro).toFixed(1) + ' dB with it off)');
  ok(B.crashC > F.crashC + 3, 'the chorus starts with a crash (' + (B.crashC - F.crashC).toFixed(1) + ' dB more top than the same moment without Song build)');
  
  ok(B.outroTail < F.outroTail - 4 && B.outro0 > B.outroTail + 3, 'the last bar is an ending: one hit that rings away (its second half ' + (F.outroTail - B.outroTail).toFixed(1) + ' dB under the band playing on)');
  const Q = await render({ build: true, verseE: 1 }), NR = await render({ build: true, chorusE: 3 });
  ok(B.riseB > NR.riseB + 1.5, 'a riser climbs through the last bar of the verse into a bigger chorus (' + (B.riseB - NR.riseB).toFixed(1) + ' dB more top there than when the chorus is no bigger)');
  ok(Q.verse < B.verse - 3, 'turning a section down to 1 makes it quieter (' + B.verse.toFixed(1) + ' → ' + Q.verse.toFixed(1) + ' dB)');

  /* the controls */
  await ev(() => { const D = window.__daily; D.T.loop = true; D.S.sections[1].energy = undefined; D.S.sections[2].energy = undefined; D.commit(false); D.dockGo('band'); }); await wait(400);
  const U = await ev(() => ({ on: document.getElementById('buildOn').getAttribute('aria-pressed'), rows: [...document.querySelectorAll('#pane-band .bl-sec')].map(r => r.querySelector('.bl-nm').textContent + ':' + r.querySelectorAll('.bl-dot.on').length).join() }));
  ok(U.on === 'true' && U.rows === 'Intro:2,Verse 1:3,Chorus:5,Outro:2', 'the Band panel shows Song build on and each section’s energy from its name (' + U.rows + ')');
  await ev(() => document.querySelector('#pane-band .bl-sec[data-si="2"] .bl-dot[data-e="4"]').click()); await wait(200);
  ok(await ev(() => window.__daily.S.sections[2].energy === 4), 'tapping a dot sets a section’s energy');
  const L = await ev(async () => { const D = window.__daily, s = await D.slRead(await D.slLink()); return s.band.build && s.sections[2].energy === 4 && !s.sections[1].energy; });
  ok(L, 'a song link carries Song build and the energies you set');
  const m = await t.open({ w: 390, h: 844, mobile: true }); await m.evaluate(() => { window.__daily.beatUse('pop', { play: false, quiet: true }); window.__daily.mGo('beats'); }); await wait(400);
  ok(await m.evaluate(() => !!document.querySelector('#mscreen #buildCard') && document.querySelectorAll('#mscreen .bl-sec').length >= 1), 'the phone’s Beats screen has it too');
});
