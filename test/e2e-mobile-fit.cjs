/* Phones (2.15): the header dialogs (Settings, Help, Workspace, Appearance) fill the screen with a one-line header and no
   boxed cards, and the welcome screen puts all its choices on the first screen. */
const { suite } = require('./lib.cjs');
suite('e2e-mobile-fit', async t => {
  const { ok, wait } = t;
  for (const [w, hh] of [[412, 915], [390, 844], [360, 740]]) {
    /* ---- the welcome screen, for a first visit ---- */
    const c = await t.fresh({ w, h: hh, mobile: true }); await c.addInitScript(() => { try { localStorage.removeItem('fw.started'); } catch (e) { } });
    const b = await c.newPage(); await b.goto(t.BASE); await wait(2200);
    const wl = await b.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(), g = [...document.querySelectorAll('#bootGoals .boot-goal')].map(x => Math.round(x.getBoundingClientRect().left)); return { card: Math.round(document.querySelector('.boot-card').getBoundingClientRect().width), cols: new Set(g).size, studio: Math.round(r('bootNoMic').bottom), demo: Math.round(r('bootDemo').bottom), vh: innerHeight, vw: innerWidth }; });
    ok(wl.card === wl.vw && wl.cols === 2, w + '×' + hh + ' welcome: the card is the full width and the six goals are in two columns (' + JSON.stringify(wl) + ')');
    ok(wl.studio <= wl.vh && wl.demo <= wl.vh, w + '×' + hh + ' welcome: “Begin in the studio” and “Try the demo song” are on the first screen (' + wl.studio + ', ' + wl.demo + ' of ' + wl.vh + ')');
    /* ---- Settings and Help ---- */
    const p = await t.open({ w, h: hh, mobile: true });
    for (const open of ['openSettings', 'openHelp']) {
      await p.evaluate(fn => window.__daily[fn](), open); await wait(400);
      const d = await p.evaluate(() => { const d = document.querySelector('dialog.hub[open]'), r = d.getBoundingClientRect(), cd = d.querySelector('.hub-card'), hd = d.querySelector('.hub-h').getBoundingClientRect(), sub = d.querySelector('.hub-ht p'), x = d.querySelector('.hub-x').getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight, head: Math.round(hd.height), sub: sub ? getComputedStyle(sub).display : 'none', card: cd ? getComputedStyle(cd).borderTopWidth + ' ' + getComputedStyle(cd).paddingLeft : 'none', close: Math.round(x.width), closeIn: x.right <= innerWidth }; });
      ok(d.x === 0 && d.y === 0 && d.w === d.vw && d.h === d.vh, w + '×' + hh + ' ' + open + ': the dialog fills the screen (' + [d.x, d.y, d.w, d.h].join(',') + ' on ' + d.vw + '×' + d.vh + ')');
      ok(d.head <= 64 && d.sub === 'none' && /^0px 0px$/.test(d.card) && d.close >= 40 && d.closeIn, w + '×' + hh + ' ' + open + ': a one-line header, a 40 px close button on screen, and no boxed cards (' + JSON.stringify({ head: d.head, card: d.card, close: d.close }) + ')');
      await p.keyboard.press('Escape'); await wait(200);
    }
  }
  /* ---- a computer is unchanged ---- */
  const dk = await t.open({ w: 1400, h: 900 });
  await dk.evaluate(() => window.__daily.openSettings()); await wait(400);
  const dd = await dk.evaluate(() => { const d = document.querySelector('dialog.hub[open]'), r = d.getBoundingClientRect(); return { w: Math.round(r.width), sub: getComputedStyle(d.querySelector('.hub-ht p')).display, card: getComputedStyle(d.querySelector('.hub-card')).borderTopWidth }; });
  ok(dd.w <= 940 && dd.sub !== 'none' && dd.card !== '0px', 'on a computer the dialog keeps its size, its description and its cards (' + JSON.stringify(dd) + ')');
  ok(!t.errs.length, 'no console / page / network errors' + (t.errs.length ? ': ' + t.errs.join(' | ') : ''));
});
