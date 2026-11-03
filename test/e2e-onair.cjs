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
  await p.emulateMedia({ reducedMotion: 'no-preference' });

  /* ---- Settings ▸ Appearance ▸ On air light ---- */
  await ev(() => window.__daily.openSettings('look')); await wait(300);
  ok(await ev(() => { const s = document.getElementById('setOnAir'); return !!s && s.value === 'blink' && [...s.options].map(o => o.value).join() === 'blink,steady,off'; }), 'Settings ▸ Appearance: On air light, Blink red (the default), Steady red or Off');
  await ev(() => { const s = document.getElementById('setOnAir'); s.value = 'steady'; s.dispatchEvent(new Event('change')); window.__daily.REC = { fake: 1 }; window.__daily.airSync(); });
  const st2 = new Set(); for (let i = 0; i < 5; i++) { st2.add(/ff2a3d/.test((await st()).icon)); await wait(250); }
  ok(st2.size === 1 && st2.has(true) && /^● REC/.test((await st()).title), 'Steady red: red and still, ● REC in the title');
  await ev(() => { const s = document.getElementById('setOnAir'); s.value = 'off'; s.dispatchEvent(new Event('change')); }); await wait(200);
  const o2 = await st();
  ok(!o2.onair && o2.icon === before.icon && o2.title === before.title, 'Off, even in the middle of a take: the logo, the tab icon and the title go back to normal at once');
  await wait(800);
  ok(!(await st()).onair, 'and stay that way while recording');
  await ev(() => { window.__daily.REC = null; window.__daily.airSync(); const s = document.getElementById('setOnAir'); s.value = 'blink'; s.dispatchEvent(new Event('change')); });
  ok(await ev(() => window.__daily.CFG.onAir === 'blink'), 'and back to Blink');

  /* ---- the performance overlay: a switch in Settings, and a ✕ on the overlay ---- */
  await ev(() => document.getElementById('setPerfOv').click()); await wait(700);
  ok(await ev(() => { const o = document.querySelector('.bks-ov'); return !!o && /fps/.test(o.textContent) && !!o.querySelector('.bks-ov-x'); }), 'Settings ▸ Appearance ▸ Performance overlay shows the frames a second, bottom left, with a ✕');
  await ev(() => document.getElementById('settings').close());
  await p.click('.bks-ov-x'); await wait(200);
  ok(await ev(() => !document.querySelector('.bks-ov') && !window.__daily.CFG.labs.perf), 'the ✕ hides it, and it stays off');

  /* ---- light or dark is this device's: syncing never changes it ---- */
  const TH = await ev(async () => { const D = window.__daily; D.setTheme('light'); const base = JSON.stringify({ settings: { lookMode: 'light', theme: 'light', onAir: 'blink', a4: 440 } }), remote = JSON.stringify({ settings: { lookMode: 'dark', theme: 'dark', onAir: 'off', a4: 442 } });
    await D.ghTakeSettings(remote, base); const r = { mode: D.CFG.lookMode, theme: document.documentElement.dataset.theme, air: D.CFG.onAir, a4: D.CFG.a4 }; D.CFG.a4 = 440; D.saveCfg(); return r; });
  ok(TH.mode === 'light' && TH.theme === 'light' && TH.air === 'blink' && TH.a4 === 442, 'a sync from a device in dark mode leaves this one light (and its On air light alone), while other settings still sync (' + JSON.stringify(TH) + ')');
});
