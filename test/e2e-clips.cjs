/* Clips: recordings are clips on a lane. Split, move, trim, fade, duplicate, delete and undo, saved with the song and in a bundle,
   and scheduled exactly where, and from where, the clip says. Runs in its own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
suite('e2e-clips', async t => {
  const { ok, wait, poll } = t, p = await t.open({ w: 1500, h: 900 });
  const D = fn => p.evaluate(fn), file = (name, sec, f) => { const b = t.wav(t.tone(sec, f, { amp: .5 }).data, 22050); return { name, b64: b.toString('base64') }; };
  const make = f => p.evaluate(({ name, b64 }) => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); return window.__file = new File([u], name, { type: 'audio/wav' }); }, f);
  const st = () => D(() => { const d = window.__daily; return { n: d.TAKES.length, leads: d.tkLeads().length, u: d.histStack.u.length, sel: d.TKSEL.id, clips: d.TAKES.map(c => [+c.startSec.toFixed(3), +d.tkIn(c).toFixed(3), +(d.tkOut(c)).toFixed(3), c.fadeIn || 0, c.fadeOut || 0]) }; });
  const geo = () => p.evaluate(() => { const d = window.__daily, lead = d.tkLeads()[0], head = document.querySelector('.tl-head.take'), cv = document.querySelector('#timeline canvas'); if (!head || !cv) return null; const hr = head.getBoundingClientRect(), cr = cv.getBoundingClientRect(), pps = d.tkPps(), sc = cv.parentElement ? cv.parentElement.scrollLeft : 0; return { y: hr.top + hr.height / 2, ytop: hr.top + 8, x0: cr.left - sc, pps, h: hr.height }; });

  // a guitar file dropped on the page asks what it is, then becomes a take at the playhead, selected
  const f1 = await make(file('Riff.wav', 8, 220)); await p.evaluate(() => window.__daily.dropFiles([window.__file]));
  ok(await poll(() => p.$('.drop-dlg .drop-opt[data-k="gtr"]'), 5000), 'dropping audio asks what it is');
  await p.click('.drop-dlg .drop-opt[data-k="gtr"]'); ok(await poll(() => D(() => window.__daily.TAKES.length === 1), 8000), 'choosing “Guitar take” adds one take');
  let s = await st(); ok(s.leads === 1 && s.sel && Math.abs(s.clips[0][0]) < .01, 'the take starts at the playhead and is selected'); ok(await p.evaluate(() => { const b = document.getElementById('clipBar'); return !!b && !b.hidden && /Riff/.test(b.textContent); }), 'the clip bar names the selected clip');
  await p.click('.cmax[data-m="tl"]').catch(() => 0); await wait(400);

  // split at the playhead (Ctrl+E): two clips, one lane, one undo step, sharing the same audio
  const u0 = s.u; await D(() => { const d = window.__daily; d.T.cursor = 3 / d.slotDur(); });
  await p.click('#clipSplit'); s = await st();
  ok(s.n === 2 && s.leads === 1 && s.u === u0 + 1, 'Split makes two clips on one lane as one undo step ' + JSON.stringify([s.n, s.leads, s.u - u0]));
  ok(await D(() => { const d = window.__daily; return d.TAKES[0].dry === d.TAKES[1].dry && d.TAKES[0].peaks === d.TAKES[1].peaks; }), 'the two halves share one recording in memory');
  ok(await D(() => { const d = window.__daily, [a, b] = d.TAKES, la = d.tkLen(a), lb = d.tkLen(b); return Math.abs(la + lb - 8) < .01 && Math.abs(la - 3) < .05 && Math.abs(b.startSec - 3) < .05; }), 'the halves are 3 s and 5 s and meet at the cut');
  await p.keyboard.press('Control+z'); await wait(250); s = await st(); ok(s.n === 1 && s.clips[0][2] >= 7.99, 'Undo puts the clip back whole'); await p.keyboard.press('Control+y'); await wait(250); s = await st(); ok(s.n === 2, 'Redo splits it again');

  // pointer: drag the second clip's body by two beats, snapped to the beat
  let g = await geo(); const beat = await D(() => 60 / window.__daily.S.bpm), cx = g.x0 + (3 + 2) * g.pps;
  await p.mouse.move(cx, g.y); await p.mouse.down(); await p.mouse.move(cx + 2 * beat * g.pps + 3, g.y, { steps: 8 }); await p.mouse.up(); await wait(250); s = await st();
  ok(Math.abs(s.clips[1][0] - (3 + 2 * beat)) < .03 || Math.abs(s.clips[1][0] % beat) < .03 || Math.abs((s.clips[1][0] % beat) - beat) < .03, 'dragging a clip moves it in whole beats (' + s.clips[1][0] + ' s)');
  ok(s.u === u0 + 2, 'one drag is one undo step'); await p.keyboard.press('Control+z'); await wait(200);

  // trim from the left edge, then fade in from the corner
  g = await geo(); const x1 = g.x0 + 3 * g.pps; await p.mouse.move(x1 + 2, g.y); await p.mouse.down(); await p.mouse.move(x1 + 2 + 1.0 * g.pps, g.y, { steps: 8 }); await p.mouse.up(); await wait(250); s = await st();
  ok(s.clips[1][1] > 3.7 && s.clips[1][1] < 4.2, 'dragging an edge trims the clip (in-point ' + s.clips[1][1] + ' s, was 3)');
  await p.keyboard.press('Control+z'); await wait(200); s = await st(); ok(Math.abs(s.clips[1][1] - 3) < .01, 'trimming is undone in one step');
  await D(() => { const d = window.__daily; d.tkSetFade(d.TAKES[0], 'in', .5); d.tkSetFade(d.TAKES[0], 'out', .25); });
  ok(await D(() => { const d = window.__daily, r = d.tkRenderClip(d.TAKES[0], 'dry'); return !!r && Math.abs(r.data[0]) < .02 && Math.abs(r.data[Math.floor(r.sr * .25)]) < .5 * Math.max(...r.data.slice(r.sr * 2, r.sr * 2 + 400)) + .001; }), 'a fade in starts the audio from silence');

  // lane settings belong to the lane: deleting the first clip hands them to the next one
  await D(() => { const d = window.__daily; d.tkLead(d.TAKES[0]).g = .6; d.tkLead(d.TAKES[0]).pan = -.3; d.tkSelect(d.TAKES[0].id); d.tkDelete(); });
  ok(await D(() => { const d = window.__daily; return d.TAKES.length === 1 && d.tkLeads().length === 1 && Math.abs(d.TAKES[0].g - .6) < .001 && Math.abs(d.TAKES[0].pan + .3) < .001; }), 'deleting the first clip keeps the lane’s level and pan');
  await p.keyboard.press('Control+z'); await wait(250); ok(await D(() => window.__daily.TAKES.length === 2 && window.__daily.TAKES[0].dry.length > 1000), 'Undo brings a deleted clip back with its audio');

  // duplicate (Ctrl+D) places a copy right after
  await D(() => { const d = window.__daily; d.tkSelect(d.TAKES[1].id); d.tkDup(d.TAKES[1]); }); s = await st(); ok(s.n === 3 && s.leads === 1 && Math.abs(s.clips[2][0] - (await D(() => window.__daily.tkEnd(window.__daily.TAKES[1])))) < .02, 'Duplicate puts a copy right after the clip');

  // scheduling: where and from where each clip plays
  const sch = await D(() => {
    const d = window.__daily, calls = [], A = AudioBufferSourceNode.prototype, st0 = A.start; A.start = function (...a) { calls.push(a.map(x => +(+x).toFixed(3))); return st0.apply(this, a); };
    const c0 = d.TAKES[0]; d.TAKES.length = 1; Object.assign(c0, { inS: 1, outS: 5, startSec: 2, fadeIn: 0, fadeOut: 0, grp: undefined }); const out = {};
    for (const from of [0, 2, 3, 6]) { calls.length = 0; d.stopTakes(); d.scheduleTakes(100, from); out[from] = calls.map(c => c.join(',')).join(' '); }
    d.stopTakes(); A.start = st0; return out;
  });
  ok(sch[0] === '102,1,4', 'from the top, the clip starts 2 s in, from 1 s of the recording, for 4 s (' + sch[0] + ')');
  ok(sch[3] === '100,2,3', 'playing from 3 s joins the clip part-way (' + sch[3] + ')'); ok(sch[6] === '', 'playing from after the clip schedules nothing');
  await p.reload(); await wait(1500);
  ok(await D(() => /null|undefined/.test([...document.querySelectorAll('.tl-head')].map(x => x.innerText).join(' '))) === false, 'no “null” or “undefined” leaks into the lane headers');
});
