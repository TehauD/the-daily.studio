/* On air (2.25): while recording, the header logo and the browser tab's icon blink red and the title says ● REC; calm stays steady. */
const { suite } = require('./lib.cjs');
suite('e2e-onair', async t => {
  const { ok, wait } = t, p = await t.open({}), ev = (f, a) => p.evaluate(f, a);
  const st = () => ev(() => ({ onair: document.body.classList.contains('onair'), icon: decodeURIComponent(document.querySelector('link[rel=icon]').getAttribute('href')), title: document.title, anim: getComputedStyle(document.querySelector('.brand svg')).animationName }));
  const before = await st();
  ok(!before.onair && !/ff2a3d/.test(before.icon) && !/REC/.test(before.title), 'not recording: the usual logo, icon and title');
  await ev(() => { window.__daily.REC = { fake: 1 }; window.__daily.airSync(); }); await wait(100);
  const on = await st();
  ok(on.onair && /stroke:#ff2a3d/.test(on.icon) && /^● REC · /.test(on.title), 'recording: the logo glows red and blinks, the tab icon turns red, and the tab says ● REC');
  const seen = new Set(); for (let i = 0; i < 6; i++) { seen.add(/ff2a3d/.test((await st()).icon)); await wait(250); }
  ok(seen.size === 2, 'the tab icon blinks: red, then the usual, then red');
  /* the page follows the tab icon by AIR_LAG (the browser shows a new tab icon a little after it is set): every icon flip is matched by
     a logo flip about that much later, never before it */
  const SY = await ev(async () => { const t0 = performance.now(), ic = [], lg = []; let pi = null, pl = null;
    while (performance.now() - t0 < 1600) { const red = /ff2a3d/.test(decodeURIComponent(document.querySelector('link[rel=icon]').getAttribute('href'))), bright = !document.body.classList.contains('air-dim'), t = performance.now() - t0;
      if (pi !== null && red !== pi) ic.push(t); if (pl !== null && bright !== pl) lg.push(t); pi = red; pl = bright; await new Promise(r => setTimeout(r, 5)); }
    const lags = ic.map(t => { const m = lg.find(x => x >= t - 2); return m == null ? null : m - t; }).filter(x => x != null); return { ic: ic.length, lg: lg.length, lags: lags.map(x => Math.round(x)), lag: window.__daily.AIR_LAG }; });
  ok(SY.ic >= 2 && Math.abs(SY.ic - SY.lg) <= 1 && SY.lags.length >= 2 && SY.lags.every(x => x >= SY.lag - 25 && x <= SY.lag + 60), 'the logo follows each tab-icon flip about ' + SY.lag + ' ms later, so they flip together as seen (' + JSON.stringify(SY.lags) + ')');
  ok(await ev(() => { const b = document.querySelector('.btn.rec'); b.classList.add('on'); const a = getComputedStyle(b).animationName; b.classList.remove('on'); return a === 'none'; }), 'and the record button follows the same clock instead of its own pulse');
  ok(await ev(() => { const s = document.getElementById('airSay'); return !!s && s.getAttribute('role') === 'status' && s.textContent === 'On air: recording.' && s.getBoundingClientRect().width <= 1 && document.querySelector('.brand').title === 'On air: recording'; }), 'a screen reader hears it too: “On air: recording.”, said once, in a status line nobody sees');
  await ev(() => { window.__daily.REC = null; window.__daily.airSync(); }); await wait(100);
  const off = await st();
  ok(!off.onair && off.icon === before.icon && off.title === before.title, 'when it stops, everything is as it was');
  ok(await ev(() => document.getElementById('airSay').textContent === 'Off air: recording stopped.' && !document.querySelector('.brand').hasAttribute('title')), 'and the screen reader hears that it stopped');
  await ev(() => { window.__daily.SREC.on = true; }); await wait(700);
  ok((await st()).onair, 'recording a stage video lights it too');
  await ev(() => { window.__daily.SREC.on = false; }); await wait(700);
  await p.emulateMedia({ reducedMotion: 'reduce' }); await ev(() => { window.__daily.REC = { fake: 1 }; window.__daily.airSync(); });
  const steady = new Set(); for (let i = 0; i < 5; i++) { steady.add(/ff2a3d/.test((await st()).icon)); await wait(250); }
  ok(steady.size === 1 && steady.has(true) && await ev(() => !document.body.classList.contains('air-dim')), 'with reduced motion: a steady red light, no blinking');
  await ev(() => { window.__daily.REC = null; window.__daily.airSync(); });
});
