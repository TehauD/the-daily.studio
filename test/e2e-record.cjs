/* Recording: one press of R is one take. It keeps going past the end of a short song (the song grows to fit) until you press stop;
   a loop region you set yourself stacks a take per pass; the Settings choice can stop at the end or loop. A silent second input is not kept.
   Own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
suite('e2e-record', async t => {
  const { ok, wait, poll } = t, p = await t.open({ debug: true });
  const ev = f => p.evaluate(f);
  // a short song (two bars at 150 BPM = 3.2 s) so "past the end" is quick to reach; no count-in
  await ev(() => { const d = window.__daily; d.S.bpm = 150; d.S.sections = [Object.assign({}, d.S.sections[0], { bars: d.S.sections[0].bars.slice(0, 2) })]; d.CFG.countIn = 0; d.CFG.vin = 'off'; d.CFG.armG = true; d.commit(false); });
  ok(await ev(async () => await window.__daily.ioConnect()), 'an input is connected');
  const st = () => ev(() => { const d = window.__daily; return { bars: d.S.sections.reduce((a, s) => a + s.bars.length, 0), takes: d.TAKES.map(x => ({ n: x.name, dur: x.dur })), playing: d.T.playing, loop: d.T.loop, rec: !!d.REC }; });
  const rec = async secs => { await p.keyboard.press('r'); await poll(() => ev(() => !!window.__daily.REC), 6000); await wait(secs * 1000); await ev(() => { window.__daily.stopPlay(true); }); await wait(500); return st(); };
  const reset = () => ev(() => { const d = window.__daily; d.TAKES.length = 0; d.T.loopB = null; d.T.loopA = 0; d.T.loop = true; d.S.sections[0].bars.length = 2; d.T.bars = null; d.commit(false); });

  ok(await ev(() => window.__daily.T.loop === true && window.__daily.CFG.recEnd === 'grow'), 'defaults: loop is on and recording keeps going past the end');
  // 1 · default: one take, however long
  let s = await rec(8);
  ok(s.takes.length === 1 && s.takes[0].dur > 6, 'with loop on, 8 s over a 3-second song is ONE take (' + s.takes.map(x => x.n + ' ' + x.dur.toFixed(1) + ' s').join(', ') + ')');
  ok(s.bars >= 5 && s.bars <= 6, 'the song grew to hold it, with no more than one spare bar (' + s.bars + ' bars)');
  ok(s.loop === true && !s.playing && !s.rec, 'Loop is still on afterwards and everything has stopped');
  // the take fits inside the song, and the song is saved as it is
  ok(await ev(() => { const d = window.__daily; return d.tkEnd(d.TAKES[0]) <= d.songSlots() * (60 / d.S.bpm / 4) + .01; }), 'the take ends inside the song');
  // 2 · Loop off: the same
  await reset(); await ev(() => { window.__daily.T.loop = false; }); s = await rec(6);
  ok(s.takes.length === 1 && s.bars >= 4, 'with loop off it is also one take and the song grows (' + s.bars + ' bars)');
  // 3 · a loop region you set is cycle recording: a take per pass
  await reset(); await ev(() => { const d = window.__daily; d.T.loop = true; d.T.loopA = 0; d.T.loopB = 16; }); s = await rec(6);
  ok(s.takes.length >= 2 && s.bars === 2, 'a loop region you set stacks a take per pass (' + s.takes.length + ' takes, song stays ' + s.bars + ' bars)');
  // 4 · the Settings choice
  await reset(); await ev(() => { window.__daily.CFG.recEnd = 'stop'; }); await p.keyboard.press('r'); ok(await poll(() => ev(() => !window.__daily.T.playing && window.__daily.TAKES.length === 1), 9000), '“Stop at the end” stops by itself and keeps one take');
  s = await st(); ok(s.bars === 2 && s.takes[0].dur < 4.2, 'the song is not changed by it (' + s.bars + ' bars, ' + s.takes[0].dur.toFixed(1) + ' s)');
  await reset(); await ev(() => { window.__daily.CFG.recEnd = 'loop'; }); s = await rec(6);
  ok(s.takes.length >= 2 && s.bars === 2, '“Loop back, one take per pass” is the old behaviour (' + s.takes.length + ' takes)');
  await ev(() => { window.__daily.CFG.recEnd = 'grow'; });
  // 5 · two lanes armed, one input silent: only the played one is kept
  await reset(); await ev(() => { const d = window.__daily; d.chSetRoles('v', 'g'); d.CFG.armV = true; d.CFG.armG = true; });       // vocal on input 1, guitar on input 2
  await p.keyboard.press('r'); await poll(() => ev(() => !!window.__daily.REC), 6000); await wait(2500);
  ok(await ev(() => !!window.__daily.REC.v && !!window.__daily.REC.g), 'both lanes are recording');
  await ev(() => { const d = window.__daily, r = d.REC; r.vox = r.vox.map(a => new Float32Array(a.length)); d.stopPlay(true); });     // the vocal input heard nothing (zeroed and stopped in one step, so no later block can add sound)
  await wait(500); s = await st();
  ok(s.takes.length === 1 && /^Take/.test(s.takes[0].n), 'a silent vocal input is not kept (' + s.takes.map(x => x.n).join(', ') + ')');
  ok(await ev(() => /silent/.test(document.body.innerText)), 'the toast says why');
  // 6 · both have sound: both kept, one pass
  await reset(); s = await rec(5);
  ok(s.takes.length === 2, 'two lanes with sound give one take each, once (' + s.takes.map(x => x.n).join(', ') + ')');
  // 7 · the setting is in Settings
  await ev(() => { window.__daily.chSetRoles('g', 'o'); }); await p.keyboard.press('Escape'); await ev(() => { document.querySelector('#top button[title^="Settings"], #top .btn[aria-label="Settings"]') && document.querySelector('#top button[title^="Settings"], #top .btn[aria-label="Settings"]').click(); });
  ok(await poll(() => ev(() => !!document.querySelector('#settings[open]')), 3000), 'Settings opens');
  ok(await ev(() => { const l = [...document.querySelectorAll('#settings label.field')].find(x => /reaches the end/.test(x.textContent)); const sel = l && l.querySelector('select'); return !!sel && sel.options.length === 3 && sel.value === 'grow'; }), 'Settings has “When recording reaches the end of the song” with three choices');
});
