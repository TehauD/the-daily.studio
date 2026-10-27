/* Fretboard heatmap: where you play, how in tune, which notes belong. Own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
suite('e2e-heat', async t => {
  const { ok, wait } = t, p = await t.open({ debug: true });
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { const d = window.__daily; d.dockGo('fret'); d.heatReset(); d.S.key = 0; d.S.minor = false; d.S.scale = 'Major (Ionian)'; d.S.capo = 0; d.FB.root = 0; d.S.tuning = [40, 45, 50, 55, 59, 64]; });
  await wait(400);

  // a note that has one place is placed exactly; a note with several places is shared out, and the summary says so
  await ev(() => { const d = window.__daily; d.heatLive({ midi: 40, cs: [4, 4, 4, 4, 4, 4, 4, 4], cam: [] }, 2); });     // open low E: only one place at fret <= 22? no, it is also nowhere else
  let m = await ev(() => { const d = window.__daily, mp = d.heatMap(); return { n: mp.size, e0: mp.get('0:0') && mp.get('0:0').t, amb: d.HEAT.amb, tot: d.HEAT.tot, c: mp.get('0:0') && mp.get('0:0').c }; });
  ok(m.n === 1 && Math.abs(m.e0 - 2) < 1e-6 && m.amb === 0 && Math.abs(m.c - 4) < 1e-6, 'a note with one possible place goes exactly there, with its tuning (' + JSON.stringify(m) + ')');
  await ev(() => { const d = window.__daily; d.heatLive({ midi: 64, cs: [-10, -10, -10, -10, -10, -10, -10, -10], cam: [] }, 3); });  // E4: string 5 fret 0, 4 fret 5, 3 fret 9, 2 fret 14, 1 fret 19
  m = await ev(() => { const d = window.__daily, mp = d.heatMap(); return { k: ['5:0', '4:5', '3:9', '2:14', '1:19'].map(k => mp.get(k) && +mp.get(k).t.toFixed(2)), amb: d.HEAT.amb, tot: d.HEAT.tot }; });
  ok(m.k.every(x => x === .6) && m.amb === 3 && m.tot === 5, 'a note that can be played in five places is shared across all five and counted as shared (' + m.k.join(', ') + ')');
  await ev(() => { const d = window.__daily; d.heatLive({ midi: 64, cs: [0, 0, 0, 0, 0, 0], cam: [{ st: 4, fret: 5 }, { st: 1, fret: 3 }] }, 1); });
  m = await ev(() => { const d = window.__daily, mp = d.heatMap(); return { a: +mp.get('4:5').t.toFixed(2), wrong: mp.get('1:3'), amb: d.HEAT.amb }; });
  ok(m.a === 1.6 && !m.wrong && m.amb === 3, 'when the camera sees the hand, the note goes where the finger is (a camera guess that does not make that pitch is ignored)');
  ok(await ev(() => window.__daily.heatLive({ midi: 64, cs: [], cam: [] }, .02) === undefined && window.__daily.HEAT.tot === 6), 'a blip shorter than 50 ms is not counted');

  // the three views paint the neck
  await ev(() => { const d = window.__daily; d.heatLive({ midi: 52, cs: [20, 20, 20, 20, 20, 20, 20, 20], cam: [{ st: 2, fret: 2 }] }, 2); d.FB.mode = 'heat'; d.HEAT.view = 'where'; d.HEAT.src = 'live'; d.renderFret(); }); await wait(300);
  m = await ev(() => { const g = [...document.querySelectorAll('#fretsvg g.fn')]; const pick = (s, f) => g.find(x => x.dataset.st == s && x.dataset.f == f); const op = x => +x.querySelector('polygon').getAttribute('opacity'); return { n: g.length, shown: g.every(x => x.style.display !== 'none'), hot: op(pick(4, 5)), cold: op(pick(0, 7)), bar: document.querySelector('.heatbar').style.display, sum: document.getElementById('fbheatsum').textContent }; });
  ok(m.n > 100 && m.shown && m.hot > .8 && m.cold < .6 && m.bar === '', 'Where you play: the busiest spot is bright, an unused one is dim, and the controls show (' + m.hot + ' vs ' + m.cold + ')');
  ok(/placed exactly/.test(m.sum) && /microphone hears the pitch/.test(m.sum), 'the summary says plainly that a microphone cannot tell which string was used');
  await ev(() => { const d = window.__daily; d.HEAT.view = 'tune'; d.HEAT.rev++; d.renderFret(); }); await wait(300);
  m = await ev(() => { const g = [...document.querySelectorAll('#fretsvg g.fn')]; const f = (s, n) => g.find(x => x.dataset.st == s && x.dataset.f == n).querySelector('polygon').getAttribute('fill'); return { sharp: f(2, 2), flat: f(3, 9), ok: f(4, 5), sum: document.getElementById('fbheatsum').textContent }; });
  ok(m.sharp.includes('e8833a') || m.sharp.includes('232, 131, 58') , 'How in tune: a note that was sharp is orange (' + m.sharp + ')');
  ok(/4a90d9|74, 144, 217/i.test(m.flat), 'How in tune: a note that was flat is blue (' + m.flat + ')');
  ok(/3fb27f|63, 178, 127/i.test(m.ok) && /Average .*¢ off/.test(m.sum), 'How in tune: a note that was on pitch is green, and the summary gives the average');
  await ev(() => { const d = window.__daily; d.HEAT.view = 'key'; d.HEAT.rev++; d.renderFret(); }); await wait(300);
  await ev(() => { const d = window.__daily; d.heatLive({ midi: 61, cs: [], cam: [{ st: 4, fret: 2 }] }, 6); d.renderFret(); });                // C# : out of C major
  m = await ev(() => { const g = [...document.querySelectorAll('#fretsvg g.fn')]; const f = (s, n) => g.find(x => x.dataset.st == s && x.dataset.f == n).querySelector('polygon').getAttribute('fill'); return { out: f(4, 2), inKey: f(2, 2), sum: document.getElementById('fbheatsum').textContent }; });
  ok(/d64545|214, 69, 69/i.test(m.out), 'Which notes belong: a note outside the key that you played is red');
  ok(!/d64545|214, 69, 69/i.test(m.inKey), 'Which notes belong: a note inside the key is not');
  ok(/% of your playing is inside C Major/.test(m.sum), 'the summary gives the share inside the key (' + m.sum.slice(0, 50) + ')');

  // the song as a source
  await ev(() => { const d = window.__daily; d.S.sections = [{ id: 'a', name: 'Verse', lyrics: '', bars: [{ chord: 'C', tab: [{ s: 0, st: 1, f: 3 }, { s: 4, st: 0, f: 'x' }] }] }]; d.HEAT.src = 'song'; d.HEAT.view = 'where'; d.HEAT.song = null; d.HEAT.rev++; d.renderFret(); });
  m = await ev(() => { const d = window.__daily, mp = d.heatMap(); return { tab: mp.has('1:3'), mute: mp.has('0:x'), n: mp.size, sum: document.getElementById('fbheatsum').textContent }; });
  ok(m.tab && !m.mute && m.n >= 4 && /tab note and chord shape/.test(m.sum), 'Song source reads the tab and the chord shapes (muted notes are left out)');
  await ev(() => { const d = window.__daily; d.HEAT.view = 'tune'; d.HEAT.rev++; d.renderFret(); });
  ok(await ev(() => /written, not played/.test(document.getElementById('fbheatsum').textContent)), 'How in tune says so when the source is a written song');

  // changing the tuning or capo does not mix positions
  await ev(() => { const d = window.__daily; d.HEAT.src = 'live'; d.S.capo = 2; d.heatMap(); });
  ok(await ev(() => window.__daily.HEAT.tot === 0 && window.__daily.heatMap().size === 0), 'a new capo or tuning starts a fresh heatmap (old frets would be wrong)');

  // persistence and reset
  await ev(() => { const d = window.__daily; d.heatLive({ midi: 50, cs: [], cam: [] }, 2); d.heatReset(); });
  ok(await ev(() => window.__daily.HEAT.tot === 0), 'Reset clears it');
  await p.click('.heatbar .btn.sm'); ok(true, 'the Reset button is clickable');
  // the other modes still work
  await ev(() => { const d = window.__daily; d.FB.mode = 'scale'; d.renderFret(); });
  ok(await ev(() => document.querySelector('.heatbar').style.display === 'none' && [...document.querySelectorAll('#fretsvg g.fn')].some(x => x.style.display === 'none')), 'switching back to Scale hides the heatmap controls and shows the scale again');
  ok(t.errors ? t.errors().length === 0 : true, 'no console errors');
});
