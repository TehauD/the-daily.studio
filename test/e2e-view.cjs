/* 2.12: the looks that were taken out stay out (and a saved choice of one falls back to Hex Resonance), and every panel area has an edge tab that collapses and opens it.
   Headless browser, so this proves the tabs work and sit where they should; whether they are easy to find and pleasant to use is for a person to say. */
const { suite } = require('./lib.cjs');
suite('e2e-view', async t => {
  const { ok, wait, poll } = t;
  // ================= looks that were taken out =================
  let p = await t.open({ w: 1440, h: 900, debug: true, init: `try{localStorage.setItem('fw.cfg',JSON.stringify({visMode:'strings',visV:210}));}catch(e){}` }); let ev = (f, a) => p.evaluate(f, a);
  const gone = await ev(() => { const d = window.__daily, have = d.VMODES.map(m => m[0]), names = d.VMODES.map(m => m[1]).join('|'); return { have, names, mode: d.VZ.mode, fav: d.VZ_FAVS.join() }; });
  ok(!['v86', 'strings', 'joy', 'terrain', 'eco'].some(k => gone.have.includes(k)), 'Video 2086, String Field, Ridgeline, Chord Landscape and Ecosystem are not in the list of looks');
  ok(!/Video 2086|String Field|Ridgeline|Landscape|Ecosystem/.test(gone.names), 'and none of those names is shown anywhere in the Visuals bar');
  ok(gone.mode === 'hex', 'a saved choice of a look that was taken out opens as Hex Resonance (' + gone.mode + ')');
  ok(gone.fav === 'hex,concert,halo,kaleido', 'the ✦ Look cycle is Hex Resonance, Concert, Fifths Halo, Prism (' + gone.fav + ')');
  ok(['hex', 'concert', 'gravity', 'field', 'swarms', 'mood', 'dna', 'stars', 'fluid', 'paint', 'halo', 'kaleido', 'bloom', 'orbit', 'pulse', 'prompter', 'neural'].every(k => gone.have.includes(k)), 'the other looks are all still there');
  ok(await ev(() => { const d = window.__daily; return d.STG.scenes.every(s => !['v86', 'strings', 'joy', 'terrain', 'eco'].includes(s.mode)); }), 'no stage scene is left on a look that was taken out');
  await p.ctx.close();

  // ================= edge tabs =================
  p = await t.open({ w: 1500, h: 900, debug: true }); ev = (f, a) => p.evaluate(f, a); await wait(500);
  const e0 = await ev(() => { const r = k => { const b = document.querySelector('.edge-tab[data-edge="' + k + '"]'); if (!b) return null; const q = b.getBoundingClientRect(); return { x: Math.round(q.left), y: Math.round(q.top), w: Math.round(q.width), h: Math.round(q.height), exp: b.getAttribute('aria-expanded'), label: b.getAttribute('aria-label') }; }; return { left: r('left'), right: r('right'), arr: r('arr'), pan: r('pan'), lw: document.getElementById('left').getBoundingClientRect().right, rl: document.getElementById('right').getBoundingClientRect().left }; });
  ok(e0.left && e0.right && e0.arr && e0.pan, 'there is an edge tab for the left sidebar, the right sidebar, the arrangement and the panels');
  ok(e0.left.exp === 'true' && Math.abs(e0.left.x - e0.lw) < 6 && e0.right.exp === 'true' && Math.abs(e0.right.x + e0.right.w - e0.rl) < 6, 'the sidebar tabs sit on the sidebars’ inner edges (' + e0.left.x + '/' + Math.round(e0.lw) + ', ' + (e0.right.x + e0.right.w) + '/' + Math.round(e0.rl) + ')');
  ok(/Collapse the left sidebar/.test(e0.left.label) && /Collapse the arrangement/.test(e0.arr.label), 'each says what it will do');
  await ev(() => document.querySelector('.edge-tab[data-edge="left"]').click()); await wait(400);
  const e1 = await ev(() => { const b = document.querySelector('.edge-tab[data-edge="left"]'), q = b.getBoundingClientRect(); return { left: window.__daily.LAY.left, x: Math.round(q.left), w: Math.round(document.getElementById('left').getBoundingClientRect().width), exp: b.getAttribute('aria-expanded'), label: b.getAttribute('aria-label') }; });
  ok(e1.left === false && e1.w <= 2 && e1.x <= 2 && e1.exp === 'false' && /Open the left sidebar/.test(e1.label), 'clicking it collapses the sidebar, and the tab stays at the edge, ready to open it (' + JSON.stringify(e1) + ')');
  await ev(() => document.querySelector('.edge-tab[data-edge="left"]').click()); await wait(400);
  ok(await ev(() => window.__daily.LAY.left === true && document.getElementById('left').getBoundingClientRect().width > 150), 'and clicking again opens it');
  // labelled, like the journal's tabs: the open panel's name on each side, the others listed while collapsed, "Arrangement" and "Panels" on the divider
  const nm = await ev(() => { const t = k => (document.querySelector('.edge-tab[data-edge="' + k + '"] .et-nm') || {}).textContent; return { l: t('left'), r: t('right'), a: t('arr'), p: t('pan'), vertical: getComputedStyle(document.querySelector('.edge-tab[data-edge="left"] .et-nm')).writingMode, more: document.querySelectorAll('.edge-rail .et-more').length }; });
  ok(nm.l === 'I/O' && nm.r === 'Monitor' && nm.a === 'Arrangement' && nm.p === 'Panels', 'the edge tabs are named for what they hold (' + JSON.stringify(nm) + ')');
  ok(/vertical/.test(nm.vertical) && nm.more === 0, 'the sidebar tabs read down the edge, and only the open panel is named while the sidebar is open');
  await ev(() => document.querySelector('.edge-tab[data-edge="left"]').click()); await wait(400);
  const ml = await ev(() => [...document.querySelectorAll('.er-left .et-more')].map(b => b.dataset.panel).join());
  ok(ml === 'tones,theory', 'collapsed, the left edge lists the other panels that live there (' + ml + ')');
  await ev(() => document.querySelector('.er-left .et-more[data-panel="theory"]').click()); await wait(500);
  const th = await ev(() => ({ open: window.__daily.LAY.left, cur: window.__daily.SD.cur.left, w: document.getElementById('left').getBoundingClientRect().width, nm: document.querySelector('.edge-tab[data-edge="left"] .et-nm').textContent, more: document.querySelectorAll('.er-left .et-more').length }));
  ok(th.open && th.cur === 'theory' && th.w > 150 && th.nm === 'Theory' && th.more === 0, 'one click on a listed panel opens the sidebar on exactly that panel (' + JSON.stringify(th) + ')');
  await ev(() => window.__daily.sideShow('io')); await wait(300);
  await ev(() => document.querySelector('.edge-tab[data-edge="right"]').click()); await wait(400);
  ok(await ev(() => { const q = document.querySelector('.edge-tab[data-edge="right"]').getBoundingClientRect(); return window.__daily.LAY.right === false && q.right >= innerWidth - 2; }), 'the right sidebar collapses to its edge the same way');
  await ev(() => document.querySelector('.edge-tab[data-edge="right"]').click()); await wait(300);
  // arrangement
  const h0 = await ev(() => document.getElementById('timeline').getBoundingClientRect().height);
  await ev(() => document.querySelector('.edge-tab[data-edge="arr"]').click()); await wait(500);
  const h1 = await ev(() => ({ h: document.getElementById('timeline').getBoundingClientRect().height, tlh: window.__daily.LAY.tlh, label: document.querySelector('.edge-tab[data-edge="arr"]').getAttribute('aria-label') }));
  ok(h1.tlh === '84px' && h1.h < h0 - 40 && /Open the arrangement/.test(h1.label), 'the arrangement tab collapses it to the transport (' + Math.round(h0) + ' → ' + Math.round(h1.h) + ' px)');
  await ev(() => document.querySelector('.edge-tab[data-edge="arr"]').click()); await wait(500);
  ok(await ev(h => Math.abs(document.getElementById('timeline').getBoundingClientRect().height - h) < 6, h0), 'and opens it back to where it was');
  // panels
  await ev(() => document.querySelector('.edge-tab[data-edge="pan"]').click()); await wait(500);
  const d1 = await ev(() => ({ dock: document.getElementById('dock').getBoundingClientRect().height, full: !!window.__daily.LAY.tlhFull, tab: !!document.querySelector('#dock .tabs .tab') && document.querySelector('#dock .tabs .tab').getBoundingClientRect().height > 10 }));
  ok(d1.full && d1.dock < 120 && d1.tab, 'the panels tab collapses the panel area to its tab strip, which stays reachable (' + Math.round(d1.dock) + ' px)');
  await ev(() => document.querySelector('.edge-tab[data-edge="pan"]').click()); await wait(500);
  ok(await ev(() => !window.__daily.LAY.tlhFull && document.getElementById('dock').getBoundingClientRect().height > 150), 'and opens them again');
  // dragging the divider still works and the tabs do not start a drag
  const before = await ev(() => window.__daily.LAY.tlh);
  await ev(() => { const b = document.querySelector('.edge-tab[data-edge="arr"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10, pointerId: 1 })); }); await wait(100);
  ok(await ev(b => window.__daily.LAY.tlh === b, before), 'pressing a tab never starts a drag of the divider');
  // the saved state survives a reload
  await ev(() => document.querySelector('.edge-tab[data-edge="left"]').click()); await wait(300); await ev(() => window.__daily.saveCfg && window.__daily.saveCfg());
  ok(await ev(() => JSON.parse(localStorage.getItem('fw.cfg')).layout.left === false), 'a collapsed sidebar is remembered');
  // phone: no edge tabs (the phone has its own drawers)
  const q = await t.open({ w: 390, h: 844, mobile: true, debug: true });
  ok(await q.evaluate(() => [...document.querySelectorAll('.edge-tab')].every(b => getComputedStyle(b).display === 'none')), 'on a phone the edge tabs are out of the way (it has its own drawers)');
  ok(t.errs.length === 0, 'no errors (' + t.errs.length + ')');
});
