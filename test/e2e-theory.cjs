/* Two looks made of music theory (2.79) and the Neural Map's circle of fifths. The Harmonic Wheel counts chord changes and names the likely next
   chord from them; the Tonnetz moves a chord's triangle the smallest step from the last; both are in the Harmony family and draw without errors.
   The Neural Map's Fifths layout fills the canvas and looks down on the ring. */
const { suite } = require('./lib.cjs');
suite('e2e-theory', async t => {
  const { ok, wait } = t, p = await t.open({ w: 1400, h: 860, debug: true }), ev = (f, a) => p.evaluate(f, a);
  await ev(() => window.__daily.dockGo('vis')); await wait(900);
  // ---- they are in the picker, in Harmony, and Simple keeps the wheel beside the hexagons
  const P = await ev(() => ({ harm: [...document.querySelectorAll('#vzLooks .vz-fam[data-fam=harm] [data-m]')].map(b => b.dataset.m), core: [...document.querySelectorAll('#vzLooks [data-core]')].map(b => b.dataset.m) }));
  ok(P.harm.join() === 'wheel,tonnetz,neural,nxtower,nxweb,nxjourney,halo,kaleido,mood', 'Harmonic Wheel, Tonnetz, Neural Map (and its three siblings), Fifths Halo, Prism and Mood Colour are the Harmony group (' + P.harm.join() + ')');
  ok(P.core.includes('wheel') && P.core.includes('hex'), 'in Simple the wheel is kept beside Hex Resonance');
  // ---- the wheel: a progression is counted, and the next chord is named from it
  const W = await ev(() => { const D = window.__daily, cv = document.createElement('canvas'); cv.width = 900; cv.height = 560; D.S.key = 9; D.S.minor = true; D.THX.trans.clear(); D.THX.last = null; D.THX.seed = null; D.S.sections = [D.mkSection('Verse', ['Am', 'F', 'C', 'G'])];
    const out = { ids: [] }; for (let r = 0; r < 3; r++) for (const sym of ['Am', 'F', 'C', 'G']) { D.HM.force = sym; D.HM.stamp = -1; D.VZ.t += .5; D.drawVis(cv, { mode: 'wheel' }); }
    D.HM.force = 'Am'; D.HM.stamp = -1; D.VZ.t += .5; D.drawVis(cv, { mode: 'wheel' });
    out.trans = [...D.THX.trans.entries()].map(([k, v]) => k + ':' + v).join(); const nx = D.thNext('m0'); out.next = nx[0] && nx[0].id; out.nextP = nx[0] && nx[0].p;
    const d = cv.getContext('2d').getImageData(0, 0, 900, 560).data; let lit = 0; for (let i = 0; i < d.length; i += 4 * 9) if (d[i] + d[i + 1] + d[i + 2] > 150) lit++; out.lit = lit;
    out.node = D.thNode({ root: 9, iv: [0, 3, 7] }); out.nodeF = D.thNode({ root: 5, iv: [0, 4, 7] }); D.HM.force = null; return out; });
  ok(W.node.id === 'm0' && W.nodeF.id === 'M11', 'Am sits under C (inner ring, top) and F is one step round the circle (' + W.node.id + ', ' + W.nodeF.id + ')');
  ok(/m0>M11:/.test(W.trans) && /M11>M0:/.test(W.trans) && /M0>M1:/.test(W.trans), 'each change of chord is counted: Am→F, F→C, C→G (' + W.trans + ')');
  ok(W.next === 'M11' && W.nextP > .5, 'after Am the likely next chord is F, from what has happened (' + W.next + ', ' + Math.round(W.nextP * 100) + '%)');
  ok(W.lit > 60, 'the wheel draws (' + W.lit + ' lit samples)');
  // ---- the tonnetz: relative chords are neighbours, so the step is small
  const T = await ev(() => { const D = window.__daily, cv = document.createElement('canvas'); cv.width = 900, cv.height = 560; D.TN.cam = null; D.TN.trail.length = 0; D.TN.last = null; const s = Math.min(900, 560) / 8.5;
    const run = sym => { D.HM.force = sym; D.HM.stamp = -1; D.VZ.t += .5; D.drawVis(cv, { mode: 'tonnetz' }); }; run('Am'); run('C'); run('G'); run('Em'); D.HM.force = null;
    const tr = D.TN.trail, dist = i => Math.hypot(tr[i].c[0] - tr[i - 1].c[0], tr[i].c[1] - tr[i - 1].c[1]) / s; return { n: tr.length, d1: dist(1), d2: dist(2), d3: dist(3), minor: tr.map(x => x.minor ? 1 : 0).join(), roots: tr.map(x => x.root).join() }; });
  ok(T.n === 4 && T.roots === '9,0,7,4' && T.minor === '1,0,0,1', 'the chord triangles are found (Am, C, G, Em) with their quality (' + T.roots + ' / ' + T.minor + ')');
  ok(T.d1 < .7 && T.d2 < 1.2 && T.d3 < 1.2, 'each chord moves the smallest step from the last: Am→C shares an edge (' + T.d1.toFixed(2) + '), C→G (' + T.d2.toFixed(2) + '), G→Em (' + T.d3.toFixed(2) + ') lattice units');
  // ---- the neural map's circle of fifths: it fills the canvas and looks down on the ring
  const N = await ev(async () => { const D = window.__daily, cam = { yaw: -.6, pit: .38, zoom: 1, px: 0, py: 0 }, rad = lay => { D.NG.layout = lay; const P = D.ngCam(cam, 800, 600), a = P([0, 0, 0]), b = P([2.5, 0, 0]); return Math.hypot(b[0] - a[0], b[1] - a[1]); };
    const net = rad('net'), fif = rad('fifths'); D.NG.layout = 'fifths'; D.NG.pit = .38; return { net, fif }; });
  ok(N.fif > N.net * 1.3, 'the Fifths layout is drawn larger so the ring fills the canvas (' + Math.round(N.net) + ' → ' + Math.round(N.fif) + ' px for the same ring)');
  await ev(() => { const D = window.__daily; D.dockGo('neural'); D.NG.layout = 'fifths'; D.NG.pit = .38; }); await wait(3500);
  ok(await ev(() => window.__daily.NG.pit > .6), 'and it tips to look down on the ring (' + (await ev(() => window.__daily.NG.pit.toFixed(2))) + ' rad)');
  await ev(() => { window.__daily.NG.layout = 'net'; }); await wait(3500);
  ok(await ev(() => window.__daily.NG.pit < .5), 'back in Layers it returns to its own angle');
  ok(t.errs.length === 0, 'no errors (' + t.errs.length + ')');
});
