/* Editing a recording: mark a stretch (Shift-drag, or Mark in / out), cut it out and close the gap, silence it, edit one lane or all,
   and punch in over it with the microphone. Own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
suite('e2e-edit', async t => {
  const { ok, wait, poll } = t, p = await t.open({ w: 1500, h: 900, debug: true });
  const D = (fn, a) => p.evaluate(fn, a);
  const drop = (name, sec, f, kind) => p.evaluate(async ({ name, b64, kind }) => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); return !!(await window.__daily.dropTake(new File([u], name, { type: 'audio/wav' }), kind)); }, { name, b64: t.wav(t.tone(sec, f, { amp: .5 }).data, 22050).toString('base64'), kind });
  const clips = () => D(() => { const d = window.__daily; return d.TAKES.map(c => ({ n: c.name, k: d.tkKey(c) === c.id ? 'L' : 'c', lane: d.tkLeads().findIndex(l => d.tkKey(l) === d.tkKey(c)), s: +c.startSec.toFixed(3), e: +d.tkEnd(c).toFixed(3) })); });
  const mark = async (a, b) => { await D(({ a, b }) => { const d = window.__daily; d.S.bpm = 120; d.T.cursor = a / d.slotDur(); }, { a, b }); await p.click('#rngIn'); await D(({ b }) => { const d = window.__daily; d.T.cursor = b / d.slotDur(); }, { b }); await p.click('#rngOut'); };
  await D(() => { const d = window.__daily; d.S.bpm = 120; d.commit(false); d.CFG.countIn = 0; });
  ok(await drop('Riff.wav', 8, 220, 'gtr'), 'a guitar take (8 s) is added'); await p.click('.cmax[data-m="tl"]').catch(() => 0); await wait(400);

  // Mark in / Mark out on the clip bar
  await mark(2, 4); let r = await D(() => { const t = window.__daily.TKR; return { on: t.on, a: t.a, b: t.b, act: !document.getElementById('rngAct').hidden }; });
  ok(r.on && Math.abs(r.a - 2) < .01 && Math.abs(r.b - 4) < .01 && r.act, 'Mark in and Mark out set a 2 s stretch and show the range buttons (' + JSON.stringify(r) + ')');
  const u0 = await D(() => window.__daily.histStack.u.length);
  // Cut out: the gap closes
  await p.click('#rngCut'); await wait(300); let c = await clips();
  ok(c.length === 2 && Math.abs(c[0].e - 2) < .01 && Math.abs(c[1].s - 2) < .01 && Math.abs(c[1].e - 6) < .02, 'Cut out removes 2 s and closes the gap (' + c.map(x => x.s + '–' + x.e).join(', ') + ')');
  ok(c.every(x => x.lane === 0) && await D(() => window.__daily.tkLeads().length === 1), 'it is still one lane');
  ok(await D(({ u0 }) => window.__daily.histStack.u.length === u0 + 1 && !window.__daily.TKR.on, { u0 }), 'one undo step, and the range is cleared');
  ok(await D(() => { const d = window.__daily, a = d.tkRenderClip(d.TAKES[0], 'dry'), b = d.TAKES[1]; return Math.abs(a.data[a.data.length - 1]) < .02 && d.tkFades(b)[0] > 0; }), 'the new edges are faded a few milliseconds, so the cut does not click');
  await p.keyboard.press('Control+z'); await wait(300); c = await clips(); ok(c.length === 1 && Math.abs(c[0].e - 8) < .02, 'Undo puts the whole take back');

  // Silence: the gap stays
  await mark(2, 4); await p.click('#rngSil'); await wait(300); c = await clips();
  ok(c.length === 2 && Math.abs(c[0].e - 2) < .01 && Math.abs(c[1].s - 4) < .01 && Math.abs(c[1].e - 8) < .02, 'Silence leaves the gap (' + c.map(x => x.s + '–' + x.e).join(', ') + ')');
  await p.keyboard.press('Control+z'); await wait(300);

  // the keyboard: Del cuts out, Esc clears
  await mark(1, 2); await p.keyboard.press('Escape'); ok(await D(() => !window.__daily.TKR.on), 'Esc clears the stretch');
  await mark(1, 2); await p.keyboard.press('Delete'); await wait(300); c = await clips(); ok(c.length === 2 && Math.abs(c[1].e - 7) < .02, 'Delete cuts it out and closes the gap');
  await p.keyboard.press('Control+z'); await wait(300);

  // Shift-drag across the lane
  await D(() => { const d = window.__daily; d.T.cursor = 0; d.TL.dirty = true; }); await wait(300);
  if (await D(() => document.querySelector('.tl-head.take').getBoundingClientRect().bottom > innerHeight)) { await p.click('.cmax[data-m="tl"]'); await wait(500); }       // Esc left the maximised arrangement
  const g = await D(() => { const d = window.__daily, head = document.querySelector('.tl-head.take'), cv = document.querySelector('#timeline canvas'), hr = head.getBoundingClientRect(), cr = cv.getBoundingClientRect(), sc = cv.parentElement ? cv.parentElement.scrollLeft : 0; return { y: hr.top + hr.height / 2, x0: cr.left - sc, pps: d.tkPps() }; });
  await p.keyboard.down('Shift'); await p.mouse.move(g.x0 + 5 * g.pps, g.y); await p.mouse.down(); await p.mouse.move(g.x0 + 6.5 * g.pps, g.y, { steps: 6 }); await p.mouse.up(); await p.keyboard.up('Shift'); await wait(250);
  r = await D(() => { const t = window.__daily.TKR; return { on: t.on, a: t.a, b: t.b }; }); ok(r.on && Math.abs(r.a - 5) < .3 && Math.abs(r.b - 6.5) < .3, 'Shift-drag across a take marks a stretch (' + r.a.toFixed(2) + ' – ' + r.b.toFixed(2) + ' s)');
  await p.keyboard.press('Escape');

  // two lanes recorded as one pass stay in step; All lanes off edits one
  await D(() => { window.__daily.T.cursor = 0; });
  ok(await drop('Voice.wav', 8, 300, 'vox'), 'a vocal take (8 s) is added'); await wait(300);
  ok(await D(() => window.__daily.tkLeads().length === 2), 'there are two lanes');
  await mark(2, 4); await p.click('#rngCut'); await wait(300); c = await clips();
  ok(c.length === 4 && c.filter(x => Math.abs(x.e - 6) < .02).length === 2, 'with All lanes on, both lanes are cut together (' + c.map(x => x.lane + ':' + x.s + '–' + x.e).join(' ') + ')');
  await p.keyboard.press('Control+z'); await wait(300);
  await mark(2, 4); await p.click('#rngAll'); ok(await D(() => window.__daily.TKR.all === false), 'All lanes can be switched off');
  await p.click('#rngCut'); await wait(300); c = await clips(); ok(c.length === 3 && c.filter(x => x.lane === 0).length === 1 && c.filter(x => x.lane === 0)[0].e > 7.98, 'and then only the marked lane is cut (' + c.map(x => x.lane + ':' + x.s + '–' + x.e).join(' ') + ')');
  await p.keyboard.press('Control+z'); await wait(300);
  await D(() => { window.__daily.TKR.all = true; window.__daily.tkrClear(); });
  // remove the vocal lane again: the rest is about the guitar lane
  await D(() => { const d = window.__daily; d.tkDeleteLane(d.tkLeads().find(l => l.kind === 'vox')); }); await wait(200);

  // punch in with the (fake) microphone
  ok(await D(async () => await window.__daily.ioConnect()), 'an input is connected');
  // a clip's own level: heard in the render, in the undo history, and per clip after a split
  await D(() => { const d = window.__daily, b = d.S.band; b.drumsOn = false; b.bassOn = false; b.compOn = false; b.leadOn = false; d.T.metro = false; d.commit(false); });
  const rms = async () => D(async () => { const o = await window.__daily.ofrRender({ tail: .2 }); let e = 0; for (let i = 0; i < o.l.length; i += 3) e += o.l[i] * o.l[i]; return Math.sqrt(e / (o.l.length / 3)); });
  const r1 = await rms(); await D(() => { const d = window.__daily; d.tkSetGain(d.TAKES[0], -6); d.commit(false); }); const r2 = await rms();
  ok(r1 > .005 && Math.abs(r2 / r1 - .5) < .06, 'a clip at −6 dB renders at half the level (' + r1.toFixed(4) + ' → ' + r2.toFixed(4) + ')');
  ok(await D(() => { const d = window.__daily; d.tkSelect(d.TAKES[0].id); d.T.cursor = 2 / d.slotDur(); const n = d.tkSplit(); return !!n && Math.abs(n.cg - d.TAKES[0].cg) < 1e-9 && n.cg < .6; }), 'a split keeps the level on both halves');
  await p.keyboard.press('Control+z'); await wait(300); await D(() => { const d = window.__daily; d.tkSetGain(d.TAKES[0], 0); d.commit(false); d.tkSelect(d.TAKES[0].id); d.T.cursor = 0; });
  await D(() => { const d = window.__daily; d.T.loop = false; d.T.metro = false; d.tkSelect(d.TAKES[0].id); }); await mark(2, 4); const before = await clips();
  await p.click('#rngPunch'); ok(await poll(() => D(() => window.__daily.PUNCH.on && window.__daily.T.playing), 4000), 'Punch in starts the song from a bar before the stretch');
  ok(await poll(() => D(() => !!window.__daily.REC && !!window.__daily.REC.punch), 6000), 'recording begins inside the stretch');
  ok(await poll(() => D(() => !window.__daily.REC), 9000), 'and ends by itself at the out point');
  await wait(600); c = await clips();
  ok(c.every(x => x.lane === 0) && await D(() => window.__daily.tkLeads().length === 1), 'the new audio went into the same lane (' + c.map(x => x.s + '–' + x.e).join(', ') + ')');
  const nc = c.find(x => x.s >= 1.9 && x.e <= 4.2 && x.e - x.s > 1.2);
  ok(!!nc && Math.abs(nc.s - 2) < .35 && Math.abs(nc.e - 4) < .35, 'it covers the stretch (' + (nc ? nc.s + '–' + nc.e : 'none') + ')');
  ok(await D(() => { const d = window.__daily; return d.TAKES.filter(t => d.tkLen(t) > .05).every((t, i, a) => a.every((u, j) => i === j || d.tkEnd(t) <= u.startSec + .02 || d.tkEnd(u) <= t.startSec + .02)); }), 'the old stretch is gone: no two clips overlap');
  await D(() => { window.__daily.stopPlay(true); }); await wait(300);
  await p.keyboard.press('Control+z'); await wait(400); c = await clips();
  ok(c.length === before.length && Math.abs(c[0].e - 8) < .02, 'Undo brings the original take back (' + c.length + ' clip)');
  ok(await D(() => !window.__daily.PUNCH.on && !window.__daily.REC && !window.__daily.T.rec), 'nothing is left recording');
  // the kill switch ends a punch-in
  await D(() => { const d = window.__daily; d.tkSelect(d.TAKES[0].id); }); await mark(2, 4); await p.click('#rngPunch'); await wait(1200); await p.keyboard.press('Control+.'); await wait(600);
  ok(await D(() => !window.__daily.T.playing && !window.__daily.REC && !window.__daily.PUNCH.on), 'the kill switch ends a punch-in at once');
});
