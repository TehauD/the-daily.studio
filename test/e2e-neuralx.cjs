/* The Neural Map's own Settings and three more looks on the same network (2.82): Fifths Tower, Chord Web, Song Journey.
   The dials are applied to the network for the one frame the look is drawn and put back after (the Neural pane is untouched); layers, sizes, how much
   of what was played stays on screen, and "follow the chord" change what is drawn; Pre-train and Forget work from Settings; all four draw on a phone. */
const { suite } = require('./lib.cjs');
suite('e2e-neuralx', async t => {
  const { ok, wait } = t, p = await t.open({ w: 1400, h: 860, debug: true }), ev = (f, a) => p.evaluate(f, a);
  await ev(() => window.__daily.dockGo('vis')); await wait(900);
  // ---- the looks are in Harmony, with their options marked
  const P = await ev(() => ({ harm: [...document.querySelectorAll('#vzLooks .vz-fam[data-fam=harm] [data-m]')].map(b => b.dataset.m), opt: [...document.querySelectorAll('#vzLooks .has-opts')].map(b => b.dataset.m) }));
  ok(P.harm.join() === 'wheel,tonnetz,neural,nxtower,nxweb,nxjourney,halo,kaleido,mood', 'Fifths Tower, Chord Web and Song Journey sit beside the Neural Map in Harmony (' + P.harm.join() + ')');
  ok(['neural', 'nxtower', 'nxweb', 'nxjourney'].every(m => P.opt.includes(m)), 'all four are marked as having their own options');
  // ---- the Neural Map has its dials, grouped
  await ev(() => { const D = window.__daily; D.CFG.vo = {}; D.vzSetMode('neural', true); D.vzDesignOpen(true); }); await wait(400);
  const O = await ev(() => ({ ids: [...document.querySelectorAll('#vdOpts [data-vo]')].map(e => e.dataset.vo).filter((v, i, a) => a.indexOf(v) === i), heads: [...document.querySelectorAll('#vdOpts .vd-h')].map(e => e.textContent) }));
  ok(['layout', 'color', 'lBand', 'lPc', 'lForm', 'edges', 'trans', 'pulses', 'ev', 'links', 'labels', 'pred', 'floor', 'ghosts', 'nodeS', 'lineW', 'labelS', 'spin', 'tilt', 'sway', 'zoom', 'depth', 'follow', 'memory', 'pretrain', 'forget'].every(k => O.ids.includes(k)), 'the Neural Map’s Settings offer layout, colour, layers, what to show, sizes, camera, memory and Pre-train / Forget (' + O.ids.length + ' dials)');
  ok(O.heads.join() === 'View,Layers,Show,Size,Camera,Memory', 'in six small groups (' + O.heads.join() + ')');
  // ---- the song, so there is a network to draw
  await ev(() => { const D = window.__daily; D.S.key = 9; D.S.minor = true; D.S.sections = [D.mkSection('Verse', ['Am', 'F', 'C', 'G']), D.mkSection('Chorus', ['F', 'C', 'G', 'Am'])]; D.NR.dirty = true; D.NR.curChord = 'Am'; D.NR.nodes.clear(); });
  const draw = (setup) => ev(setup => { const D = window.__daily, cv = document.createElement('canvas'); cv.width = 900; cv.height = 560; const g = cv.getContext('2d'); let arcs = 0, rs = 0, big = 0; const A = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (x, y, r) { arcs++; rs += r; if (r > 3) big++; return A.apply(this, arguments); };
    try { if (setup) new Function('D', setup)(D); for (let i = 0; i < 30; i++) { D.VZ.t += .05; D.nxDraw(D.VZ.mode, g, 900, 560); } arcs = rs = big = 0; D.nxDraw(D.VZ.mode, g, 900, 560); } finally { CanvasRenderingContext2D.prototype.arc = A; }
    return { arcs, mean: rs / Math.max(1, big), big }; }, setup);
  const base = await draw('D.CFG.vo = {}; D.vzSetMode("neural", true);');
  ok(base.arcs > 40, 'the network draws (' + base.arcs + ' discs)');
  // ---- a layer can be taken away
  const noBand = await draw('D.vlSet("neural","lBand",0);');
  ok(noBand.arcs < base.arcs, 'turning the Spectrum layer off draws fewer parts (' + base.arcs + ' → ' + noBand.arcs + ')');
  const noAll = await draw('D.vlSet("neural","lPc",0); D.vlSet("neural","lForm",0);');
  ok(noAll.arcs < noBand.arcs, 'and the notes and the form layer too, leaving the chords (' + noAll.arcs + ')');
  // ---- sizes
  const small = await draw('D.CFG.vo = {}; D.vlSet("neural","nodeS",.5);'), large = await draw('D.CFG.vo = {}; D.vlSet("neural","nodeS",2);');
  ok(large.mean > small.mean * 1.5, 'the Nodes size changes how big the discs are (' + small.mean.toFixed(1) + ' → ' + large.mean.toFixed(1) + ')');
  // ---- how much of what was played stays on screen
  const evs = 'D.CFG.vo = {}; D.NR.events = []; for (let i = 0; i < 300; i++) D.NR.events.push({ midi: 48 + (i % 24), pc: (48 + (i % 24)) % 12, vel: .6, src: "live", chord: "Am", sec: "Verse", prog: i / 300, i, jx: 0, jy: 0, jz: 0, born: performance.now() - 6000 }); D.NR.evSeq = 300; D.NR.cut = 1;';
  const all = await draw(evs), few = await draw(evs + 'D.vlSet("neural","memory",60);');
  ok(all.arcs - few.arcs > 150, 'Notes kept = 60 shows only the recent past: far fewer points than keeping all of them (' + all.arcs + ' → ' + few.arcs + ')');
  // ---- the pane's own settings are not disturbed
  const S = await ev(() => { const D = window.__daily; D.NG.layout = 'net'; D.NG.nodeS = 1; D.CFG.vo = {}; D.vlSet('neural', 'layout', 'fifths'); D.vlSet('neural', 'nodeS', 1.7); const cv = document.createElement('canvas'); cv.width = 900; cv.height = 560; D.nxDraw('neural', cv.getContext('2d'), 900, 560); return { layout: D.NG.layout, nodeS: D.NG.nodeS, mine: D.nxSettings('neural').layout }; });
  ok(S.layout === 'net' && S.nodeS === 1 && S.mine === 'fifths', 'the look’s layout and sizes are laid over the network for one frame and put back: the Neural pane still has its own (' + S.layout + ', ' + S.nodeS + ')');
  // ---- choosing in Settings changes the look's option
  await ev(() => { const D = window.__daily; D.CFG.vo = {}; D.vzSetMode('neural', true); D.vzDesignOpen(true); }); await wait(300);
  await p.click('#vdOpts [data-vo=layout][data-v=force]'); await p.click('#vdOpts [data-vo=color][data-v=time]'); await wait(150);
  ok(await ev(() => { const D = window.__daily, s = D.nxSettings('neural'); return s.layout === 'force' && s.color === 'time' && D.CFG.vo.neural.layout === 'force'; }), 'the layout and colour buttons change the look’s settings');
  // ---- follow the chord: the playing chord drifts towards the middle
  const F = await ev(async () => { const D = window.__daily, cv = document.createElement('canvas'); cv.width = 900; cv.height = 560; const g = cv.getContext('2d'), dist = () => { const n = D.NR.nodes.get('c:Am'), q = D.ngCam(D.NXC, 900, 560)(n.p); return Math.hypot(q[0] - 450, q[1] - 560 * .54); };
    D.CFG.vo = {}; D.vzSetMode('neural', true); D.NR.curChord = 'Am'; D.NXC.px = D.NXC.py = 0; for (let i = 0; i < 4; i++) D.nxDraw('neural', g, 900, 560); const before = dist(); D.vlSet('neural', 'follow', 1); for (let i = 0; i < 200; i++) { D.VZ.t += .02; D.nxDraw('neural', g, 900, 560); } const after = dist(); return { before, after }; });
  ok(F.after < F.before * .5 || F.after < 12, 'Follow the chord slides the picture so the chord that is playing nears the middle (' + Math.round(F.before) + ' → ' + Math.round(F.after) + ' px)');
  // ---- Pre-train and Forget, from Settings
  await ev(() => { const D = window.__daily; D.CFG.vo = {}; D.vzSetMode('neural', true); D.ngForget(); D.vzDesignOpen(true); }); await wait(300);
  await p.click('#vdOpts [data-vo=pretrain]'); await wait(200);
  const T1 = await ev(() => window.__daily.NR.trans.size); await p.click('#vdOpts [data-vo=forget]'); await wait(150);
  ok(T1 > 3 && await ev(() => window.__daily.NR.trans.size === 0), 'Pre-train teaches it the song’s chord order (' + T1 + ' paths) and Forget wipes it');
  // ---- the three new looks, each with its own starting point
  const L = await ev(() => { const D = window.__daily, r = {}; ['nxtower', 'nxweb', 'nxjourney'].forEach(k => { const s = D.nxSettings(k); r[k] = s.layout + '/' + s.color + '/' + (s.lBand ? 'b' : '-'); }); return r; });
  ok(L.nxtower === 'fifths/quality/-' && L.nxweb === 'force/quality/-' && L.nxjourney === 'fifths/time/-', 'each starts differently: tower on the circle by chord quality, web by the paths, journey by time (' + JSON.stringify(L) + ')');
  const E0 = t.errs.length;
  const drawn = await ev(async () => { const D = window.__daily; D.CFG.vd = { glow: .4 }; let n = 0; for (const k of ['neural', 'nxtower', 'nxweb', 'nxjourney']) for (const lay of ['net', 'fifths', 'force']) { D.vzSetMode(k, true); D.vlSet(k, 'layout', lay); await new Promise(r => setTimeout(r, 160)); n++; } D.CFG.vd = {}; D.CFG.vo = {}; return n; });
  ok(drawn === 12 && t.errs.length === E0, 'all four draw on the live canvas in each layout without an error');
  // ---- a phone
  const q = await t.open({ w: 390, h: 844, mobile: true, debug: true }); await q.evaluate(() => window.__daily.mGo('see', 'vis')); await wait(1100);
  const M = await q.evaluate(async () => { const D = window.__daily, bad = []; for (const k of ['neural', 'nxtower', 'nxweb', 'nxjourney']) { D.vzSetMode(k, true); D.vzDesignOpen(true, 'world'); await new Promise(r => setTimeout(r, 400)); const d = document.getElementById('vzDesign'), r = d.getBoundingClientRect(), vw = document.documentElement.clientWidth; if (Math.round(r.right) > vw || [...d.querySelectorAll('#vdOpts *')].some(e => e.offsetParent && e.getBoundingClientRect().right > r.right + 1) || document.documentElement.scrollWidth > vw) bad.push(k); } return bad; });
  ok(!M.length, 'on a 390 px phone each look’s options fit the screen' + (M.length ? ' (not: ' + M.join() + ')' : ''));
  ok(t.errs.length === 0, 'no errors (' + t.errs.length + ')');
});
