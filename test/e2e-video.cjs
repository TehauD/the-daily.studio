/* 2.11: the Audience view widget, the video take (your playing becomes a lane while the stage is recorded) (the Video 2086 look was taken out again in 2.12).
   Headless browser, fake microphone and fake camera, so this proves the parts work and respond; it cannot say how the look reads to a person. */
const { suite } = require('./lib.cjs');
suite('e2e-video', async t => {
  const { ok, wait, poll } = t, p = await t.open({ w: 1440, h: 900, debug: true, dpr: 1 }), ev = (f, a) => p.evaluate(f, a);
  await ev(async () => { const d = window.__daily; await d.ioConnect(); d.CFG.rtt = 0; });

  // ================= the Audience view widget =================
  ok(await ev(() => !!document.querySelector('.mon-chip[data-w="audience"]') && window.__daily.LAY.rc.hide.audience === true), 'the Monitor has an Audience widget in its chooser, and it starts out of the way');
  await ev(() => { const d = window.__daily, L = d.LAYOUTS.find(x => x[0] === 'Record'); d.applyPreset(L[2], 'Record'); d.dockGo('tab'); }); await wait(600);
  ok(await ev(() => window.__daily.LAY.rc.hide.audience === false && getComputedStyle(document.getElementById('audCard')).display !== 'none'), 'the Record layout shows it, for people recording video');
  await ev(() => { const d = window.__daily; d.vzSetMode('concert'); d.play(); }); await wait(1800);
  const px = await ev(() => { const cv = document.getElementById('audCanvas'), g = cv.getContext('2d'), w = cv.width, h = cv.height, top = g.getImageData(0, Math.floor(h * .06), w, Math.floor(h * .5)).data, low = g.getImageData(0, Math.floor(h * .74), w, Math.floor(h * .24)).data; const lit = (a, th) => { let n = 0, k = 0; for (let i = 0; i < a.length; i += 4 * 7) { k++; if (a[i] + a[i + 1] + a[i + 2] > th) n++; } return n / k; }; return { w, h, show: lit(top, 60), crowd: lit(low, 70), err: window.__daily.AUD.err || 0 }; });
  ok(px.w > 100 && px.h > 50 && Math.abs(px.w / px.h - 16 / 9) < .1, 'it is a 16:9 picture (' + px.w + '×' + px.h + ')');
  ok(px.show > .05, 'the show is on the screen (' + Math.round(px.show * 100) + '% of the screen is lit)');
  ok(px.crowd > .015, 'a crowd is lit at the bottom (' + Math.round(px.crowd * 1000) / 10 + '% of the lower strip)');
  ok(await ev(() => /camera is off/i.test(document.getElementById('audNote').textContent)), 'with the camera off it says you are not in the picture yet');
  // not mirrored: the setting is put back and the picture is drawn with it off
  const mir = await ev(() => { const d = window.__daily; d.CFG.mirror = true; d.audDraw(); return d.CFG.mirror; });
  ok(mir === true, 'drawing the audience side never leaves the Mirror setting changed');
  // camera on: you appear in the picture (the fake camera is a bright green shape)
  await ev(() => document.getElementById('audCam').click()); ok(await poll(() => ev(() => window.__daily.CAM.on), 12000), 'the widget starts the camera');
  await wait(800); await ev(() => { const b = document.getElementById('mpAskNo'); if (b) b.click(); });
  await p.selectOption('#audCard select[aria-label="Camera look"]', 'edges'); await ev(() => { window.__daily.CFG.mirror = false; });
  const green = () => ev(() => { const cv = document.getElementById('audCanvas'), g = cv.getContext('2d'), w = cv.width, h = cv.height, a = g.getImageData(Math.floor(w * .3), Math.floor(h * .12), Math.floor(w * .4), Math.floor(h * .4)).data; let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i + 1] > a[i] + 50 && a[i + 1] > a[i + 2] + 50) n++; return n; });
  ok(await poll(async () => (await green()) > 40, 10000), 'with the camera on and “Visuals frame me”, you are in the picture, in front of the show');
  ok(await ev(() => /Not mirrored/.test(document.getElementById('audNote').textContent) && document.getElementById('audCam').textContent.includes('off')), 'the note says it is the audience side, and the button now turns the camera off');
  await ev(() => document.getElementById('audBig').click()); await wait(500);
  ok(await ev(() => { const c = document.getElementById('audCanvas'); return Math.abs(c.width / c.height - 4 / 3) < .08; }), 'Taller makes the picture 4:3');
  await ev(() => { document.getElementById('audCam').click(); }); ok(await poll(() => ev(() => !window.__daily.CAM.on), 6000), 'the same button turns the camera off again');
  // while the Visuals tab is open the widget copies that picture instead of drawing the show a second time
  await ev(() => { const d = window.__daily; d.dockGo('vis'); }); await wait(1200);
  ok(await ev(() => !window.__daily.AUD.err), 'with the Visuals tab open it works from the show that is already drawn');

  // ================= the video take =================
  await ev(() => { const d = window.__daily; d.stopPlay && d.stopPlay(true); d.CFG.srecTake = true; d.TAKES.length = 0; d.T.cursor = 0; });
  await ev(() => document.getElementById('vzRecBtn').click()); await wait(400);
  ok(await ev(() => { const c = document.getElementById('srecTake'); return !!c && c.checked; }), 'the Record menu offers “also put what I play into the arrangement”, on by default when an input is connected');
  await ev(() => { document.body.click(); window.__daily.closePop && window.__daily.closePop(); });
  await ev(() => { const d = window.__daily; d.T.cursor = 16; });
  const slot16 = await ev(() => 16 * window.__daily.slotDur());
  await ev(() => window.__daily.srecStart(false)); await wait(2800);
  ok(await ev(() => !!window.__daily.getREC() && !!window.__daily.SREC.take), 'recording the stage starts the take recorder beside it');
  const dl = p.waitForEvent('download', { timeout: 9000 }); await ev(() => window.__daily.srecStop(true)); const got = await dl.catch(() => null);
  ok(!!got, 'the video is still saved as before');
  await wait(600);
  const tk = await ev(() => { const d = window.__daily, a = d.TAKES; return { n: a.length, t: a[0] ? { start: a[0].startSec, dur: a[0].dur, kind: a[0].kind, peaks: !!a[0].peaks } : null, rec: !!d.getREC() }; });
  ok(tk.n === 1 && tk.t && tk.t.dur > 1.5 && tk.t.peaks && !tk.rec, 'stopping adds one take to the arrangement (' + (tk.t ? tk.t.dur.toFixed(1) + ' s, ' + tk.t.kind : 'none') + ')');
  ok(tk.t && Math.abs(tk.t.start - slot16) < .15, 'it starts where the video started (take at ' + (tk.t ? tk.t.start.toFixed(2) : '?') + ' s, playhead was ' + slot16.toFixed(2) + ' s)');
  await p.keyboard.press('Control+z'); await wait(500);
  ok(await ev(() => window.__daily.TAKES.length === 0), 'Undo takes the lane out again');
  // the checkbox off, and the kill switch
  await ev(() => { const d = window.__daily; d.CFG.srecTake = false; d.T.cursor = 0; d.srecStart(false); }); await wait(1800);
  ok(await ev(() => !window.__daily.getREC()), 'with the box unticked, no take is recorded');
  await ev(() => window.__daily.srecStop(false)); await wait(500);
  await ev(() => { const d = window.__daily; d.CFG.srecTake = true; d.srecStart(false); }); await wait(2000);
  ok(await ev(() => !!window.__daily.getREC()), 'ticked again, it records');
  await ev(() => window.__daily.srecStop(false)); await wait(600);
  ok(await ev(() => window.__daily.TAKES.length === 0 && !window.__daily.getREC()), 'the kill switch throws the video and the take away together');
  ok(await ev(() => !window.__daily.SREC.on && !window.__daily.SREC.dest), 'and releases the recorder');

  ok(t.errs.length === 0, 'no script errors' + (t.errs.length ? ': ' + t.errs[0] : ''));
});
