/* Room for the picture (2.86): no empty boxes, no reserved blank columns, no clipped controls. The Visuals controls are one band (one row on a wide
   screen, two otherwise), the picture takes most of the height, the song bar and the transport fit without a scrollbar or a cut, a hidden side
   panel gives its column back, and on a phone the picture and the arrangement take the room the controls leave. */
const { suite } = require('./lib.cjs');
suite('e2e-space', async t => {
  const { ok, wait } = t;
  const measure = async (w, h) => { const p = await t.open({ w, h, debug: true }); await p.evaluate(() => window.__daily.dockGo('vis')); await wait(1300);
    return { p, m: await p.evaluate(() => { const r = e => e.getBoundingClientRect(), v = r(document.querySelector('#pane-vis .vwrap')), bar = r(document.querySelector('#pane-vis .vz-bar')), tr = document.getElementById('transport'), sb = document.getElementById('songbar'), work = r(document.getElementById('work')), center = r(document.getElementById('center'));
      return { canvasTop: Math.round(v.top), canvasH: Math.round(v.height), vh: innerHeight, deck: Math.round(bar.height), trClip: tr.scrollWidth - tr.clientWidth, sbScroll: sb.scrollWidth - sb.clientWidth, work: Math.round(work.width), center: Math.round(center.width), cols: getComputedStyle(document.getElementById('work')).gridTemplateColumns, form: document.body.dataset.form }; }) }; };
  // ---- a desktop
  let { m } = await measure(1400, 860);
  ok(m.deck <= 76, 'the Visuals controls are two rows on a 1400 px screen, not four (' + m.deck + ' px)');
  ok(m.canvasH / m.vh > .6, 'the picture has most of the height (' + m.canvasH + ' of ' + m.vh + ' px)');
  ok(m.sbScroll <= 0 && m.trClip <= 0, 'the song bar and the transport fit (no scrollbar, nothing cut)');
  ({ m } = await measure(2000, 760));
  ok(m.deck <= 40, 'on a wide screen the groups, the looks and the buttons are one row (' + m.deck + ' px)');
  // ---- the transport gives up the clock before it is cut
  for (const w of [1190, 1266, 1366]) { ({ m } = await measure(w, 800)); ok(m.trClip <= 0 && m.sbScroll <= 0, 'at ' + w + ' px nothing is cut and the song bar needs no scrollbar (transport ' + m.trClip + ', song bar ' + m.sbScroll + ')'); }
  // ---- the hidden Monitor gives its column back
  ({ m } = await measure(1100, 800)); const cols = m.cols.split(' ').map(parseFloat);
  ok(cols[2] === 0 && m.center >= m.work - 250 - 2, 'between 860 and 1180 px the hidden Monitor reserves no blank column (' + m.cols + ', the picture area is ' + m.center + ' px)');
  // ---- a phone
  const q = await t.open({ w: 421, h: 921, mobile: true, debug: true }); await q.evaluate(() => { window.__daily.CFG.vzMore = true; window.__daily.mGo('see', 'vis'); }); await wait(1500);
  await q.evaluate(() => { const b = document.getElementById('vzMore'); if (b && !/Less/.test(b.textContent)) b.click(); }); await wait(600);
  const ph = await q.evaluate(() => { const r = e => e.getBoundingClientRect(), pane = r(document.getElementById('pane-vis')), v = r(document.querySelector('#pane-vis .vwrap')), bar = r(document.querySelector('#pane-vis .vz-bar')); return { canvasH: Math.round(v.height), gap: Math.round(pane.bottom - bar.bottom), bar: Math.round(bar.height) }; });
  ok(ph.canvasH >= 110 && ph.gap < 40, 'on a phone with ⋯ More open the picture keeps a preview and the controls reach the bottom: no blank block (picture ' + ph.canvasH + ' px, gap ' + ph.gap + ' px)');
  await q.evaluate(() => { const b = document.getElementById('vzMore'); if (b && /Less/.test(b.textContent)) b.click(); }); await wait(500);
  const ph2 = await q.evaluate(() => { const r = e => e.getBoundingClientRect(), pane = r(document.getElementById('pane-vis')), v = r(document.querySelector('#pane-vis .vwrap')), bar = r(document.querySelector('#pane-vis .vz-bar')); return { canvasH: Math.round(v.height), gap: Math.round(pane.bottom - bar.bottom) }; });
  ok(ph2.canvasH > 300 && ph2.gap < 40, 'and with it closed the picture takes the rest of the screen (' + ph2.canvasH + ' px, gap ' + ph2.gap + ' px)');
  const z = await t.open({ w: 484, h: 921, mobile: true, debug: true }); await z.evaluate(async () => { await window.__daily.projCreate('blank'); window.__daily.mGo('tracks'); }); await wait(1500);
  const tk = await z.evaluate(() => { const r = e => e.getBoundingClientRect(), dock = document.getElementById('dock'), kids = [...dock.querySelectorAll('.pane.on > *')].filter(e => e.offsetParent), last = kids.length ? Math.max(...kids.map(e => r(e).bottom)) : r(dock).top, tl = r(document.getElementById('timeline')); return { gap: Math.round(tl.top - last), tl: Math.round(tl.height) }; });
  ok(tk.gap < 60 && tk.tl > 200, 'on the Tracks screen the arrangement takes the room instead of leaving a blank block above it (gap ' + tk.gap + ' px, arrangement ' + tk.tl + ' px)');
  ok(t.errs.length === 0, 'no errors (' + t.errs.length + ')');
});
