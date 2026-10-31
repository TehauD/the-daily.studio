/* Speed, size and zoom for the visuals (2.15): one panel from the Visuals bar or the Stage, remembered, applied wherever the
   visuals are drawn. Speed scales the visuals' clock, Size the hexagons of Hex Resonance and the pulse grid, Zoom pushes in. */
const { suite } = require('./lib.cjs');
suite('e2e-vz-adjust', async t => {
  const { ok, wait } = t;
  const p = await t.open({});
  await p.evaluate(() => { const D = window.__daily; D.dockGo('vis'); D.vzSetMode('hex'); }); await wait(500);

  /* ---- the panel ---- */
  ok(!!(await p.$('#pane-vis [data-vza]')), 'the Visuals bar has 🎚 Speed · size · zoom');
  await p.click('#pane-vis [data-vza]'); await wait(250);
  ok(await p.evaluate(() => ['vzSpeedIn', 'vzSizeIn', 'vzZoomIn'].every(id => !!document.getElementById(id)) && !!document.getElementById('vzaReset')), 'it opens Speed, Size and Zoom sliders with a Reset');
  const set = (id, v) => p.evaluate(([id, v]) => { const r = document.getElementById(id); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v]);
  await set('vzSpeedIn', 3); await set('vzSizeIn', 2); await set('vzZoomIn', 2); await wait(500);
  const cfg = await p.evaluate(() => { const C = window.__daily.CFG, s = JSON.parse(localStorage.getItem('fw.cfg') || '{}'); return { now: [C.vzSpeed, C.vzSize, C.vzZoom], saved: [s.vzSpeed, s.vzSize, s.vzZoom], on: document.querySelector('#pane-vis [data-vza]').classList.contains('on') }; });
  ok(cfg.now.join() === '3,2,2' && cfg.saved.join() === '3,2,2' && cfg.on, 'moving them sets and remembers them, and the button shows they are changed (' + cfg.now + ')');

  /* ---- what they do ---- */
  const rate = async sp => { await p.evaluate(s => { window.__daily.CFG.vzSpeed = s; }, sp); const a = await p.evaluate(() => [window.__daily.VZ.t, performance.now()]); await wait(1200); const b = await p.evaluate(() => [window.__daily.VZ.t, performance.now()]); return (b[0] - a[0]) / ((b[1] - a[1]) / 1000); };
  const r1 = await rate(1), r3 = await rate(3);
  ok(r3 / r1 > 2.3 && r3 / r1 < 3.7, 'Speed 3× makes the visuals’ clock run about three times as fast (' + r1.toFixed(2) + ' → ' + r3.toFixed(2) + ' per second)');
  const cells = await p.evaluate(() => { const D = window.__daily, c = document.createElement('canvas'); c.width = 900; c.height = 500; const n = sz => { D.CFG.vzSize = sz; D.drawVis(c, { mode: 'hex' }); return D.VZ.sm.length; }; return [n(1), n(2), n(.5)]; });
  ok(cells[1] < cells[0] * .4 && cells[2] > cells[0] * 2.5, 'Size makes the hexagons bigger (fewer of them) or smaller (more of them): ' + cells.join(' / ') + ' cells at 1×, 2×, ½×');
  const zoom = await p.evaluate(() => { const D = window.__daily, c = document.createElement('canvas'); c.width = 600; c.height = 400; const seen = [], orig = CanvasRenderingContext2D.prototype.scale; CanvasRenderingContext2D.prototype.scale = function (x, y) { if (this.canvas === c) seen.push(x); return orig.call(this, x, y); }; try { D.CFG.vzZoom = 2.5; D.drawVis(c, { mode: 'hex' }); D.CFG.vzZoom = 1; D.drawVis(c, { mode: 'hex' }); } finally { CanvasRenderingContext2D.prototype.scale = orig; } return seen; });
  ok(zoom.length === 1 && zoom[0] === 2.5, 'Zoom pushes the picture in from the middle, and at 1× nothing is scaled (' + JSON.stringify(zoom) + ')');

  /* ---- Reset, and the Stage has it too ---- */
  await p.evaluate(() => { const D = window.__daily; D.CFG.vzSpeed = 3; D.CFG.vzSize = 2; D.CFG.vzZoom = 2; });
  await p.click('#vzaReset'); await wait(200);
  ok(await p.evaluate(() => { const C = window.__daily.CFG; return C.vzSpeed === 1 && C.vzSize === 1 && C.vzZoom === 1 && document.getElementById('vzSpeedIn').value === '1'; }), 'Reset puts all three back to 1×');
  await p.keyboard.press('Escape'); await p.evaluate(() => window.__daily.dockGo('stage')); await wait(400);
  ok(!!(await p.$('#pane-stage [data-vza]')), 'the Stage has the same button');
  ok(!t.errs.length, 'no console / page / network errors' + (t.errs.length ? ': ' + t.errs.join(' | ') : ''));
});
