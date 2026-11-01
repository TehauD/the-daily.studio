/* On air (2.25): while recording, the header logo and the browser tab's icon blink red and the title says ● REC; calm stays steady. */
const { suite } = require('./lib.cjs');
suite('e2e-onair', async t => {
  const { ok, wait } = t, p = await t.open({}), ev = (f, a) => p.evaluate(f, a);
  const st = () => ev(() => ({ onair: document.body.classList.contains('onair'), icon: decodeURIComponent(document.querySelector('link[rel=icon]').getAttribute('href')), title: document.title, anim: getComputedStyle(document.querySelector('.brand svg')).animationName }));
  const before = await st();
  ok(!before.onair && !/ff2a3d/.test(before.icon) && !/REC/.test(before.title), 'not recording: the usual logo, icon and title');
  await ev(() => { window.__daily.REC = { fake: 1 }; window.__daily.airSync(); }); await wait(100);
  const on = await st();
  ok(on.onair && /stroke:#ff2a3d/.test(on.icon) && /^● REC · /.test(on.title) && on.anim === 'onair', 'recording: the logo glows red and blinks, the tab icon turns red, and the tab says ● REC');
  const seen = new Set(); for (let i = 0; i < 6; i++) { seen.add(/ff2a3d/.test((await st()).icon)); await wait(250); }
  ok(seen.size === 2, 'the tab icon blinks: red, then the usual, then red');
  await ev(() => { window.__daily.REC = null; window.__daily.airSync(); }); await wait(100);
  const off = await st();
  ok(!off.onair && off.icon === before.icon && off.title === before.title, 'when it stops, everything is as it was');
  await ev(() => { window.__daily.SREC.on = true; }); await wait(700);
  ok((await st()).onair, 'recording a stage video lights it too');
  await ev(() => { window.__daily.SREC.on = false; }); await wait(700);
  await p.emulateMedia({ reducedMotion: 'reduce' }); await ev(() => { window.__daily.REC = { fake: 1 }; window.__daily.airSync(); });
  const steady = new Set(); for (let i = 0; i < 5; i++) { steady.add(/ff2a3d/.test((await st()).icon)); await wait(250); }
  ok(steady.size === 1 && steady.has(true) && (await st()).anim === 'none', 'with reduced motion: a steady red light, no blinking');
  await ev(() => { window.__daily.REC = null; window.__daily.airSync(); });
});
