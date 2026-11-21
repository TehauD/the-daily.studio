/* The Voice-Leading Web (2.83): chords placed by how little their notes move. The metric is checked on chords with known answers (C → Am is 2 semitones,
   C → Cm 1, C → F 3, a seventh is one note away), the Neo-Riemannian moves are named, the layout keeps the distances (a correlation with the real table),
   the song's changes are tracked as voices (what moves, what is held), ideas are offered a step away, the three spaces hold the right chords, and it
   draws in each shape and fits a phone. */
const { suite } = require('./lib.cjs');
suite('e2e-voiceleading', async t => {
  const { ok, wait } = t, p = await t.open({ w: 1400, h: 860, debug: true }), ev = (f, a) => p.evaluate(f, a);
  await ev(() => window.__daily.dockGo('vis')); await wait(900);
  // ---- in Harmony, with its dials
  const P = await ev(() => ({ harm: [...document.querySelectorAll('#vzLooks .vz-fam[data-fam=harm] [data-m]')].map(b => b.dataset.m), opt: [...document.querySelectorAll('#vzLooks .has-opts')].map(b => b.dataset.m).includes('vlweb') }));
  ok(P.harm.includes('vlweb') && P.harm.indexOf('vlweb') === P.harm.indexOf('nxjourney') + 1 && P.opt, 'the Voice-Leading Web is in Harmony, beside the Neural looks, with its own options (' + P.harm.join() + ')');
  await ev(() => { const D = window.__daily; D.CFG.vo = {}; D.vzSetMode('vlweb', true); D.vzDesignOpen(true); }); await wait(400);
  const O = await ev(() => ({ ids: [...document.querySelectorAll('#vdOpts [data-vo]')].map(e => e.dataset.vo).filter((v, i, a) => a.indexOf(v) === i), heads: [...document.querySelectorAll('#vdOpts .vd-h')].map(e => e.textContent) }));
  ok(['space', 'dims', 'reach', 'path', 'ahead', 'voices', 'ideas', 'moves', 'edges', 'labels', 'colour', 'nodeS', 'lineW', 'textS', 'trail', 'spin', 'tilt', 'zoom', 'depth', 'follow'].every(k => O.ids.includes(k)) && O.heads.join() === 'Space,Show,Look,Camera', 'Settings: space, shape, how smooth a move is, what to show, size, trail, camera (' + O.ids.length + ' dials in ' + O.heads.join() + ')');
  // ---- the metric: the fewest semitones the voices must travel in all
  const M = await ev(() => { const D = window.__daily, d = (a, b) => D.vwDist(a, b).d; return { am: d([0, 4, 7], [9, 0, 4]), cm: d([0, 4, 7], [0, 3, 7]), f: d([0, 4, 7], [5, 9, 0]), g: d([0, 4, 7], [7, 11, 2]), em: d([0, 4, 7], [4, 7, 11]), e: d([0, 4, 7], [4, 8, 11]), same: d([0, 4, 7], [0, 4, 7]), maj7: d([0, 4, 7], [0, 4, 7, 11]), back: d([5, 9, 0], [0, 4, 7]), pairs: D.vwDist([0, 4, 7], [5, 9, 0]).pairs.map(q => q[2]).sort().join() }; });
  ok(M.am === 2 && M.cm === 1 && M.f === 3 && M.g === 3 && M.em === 1 && M.e === 2 && M.same === 0, 'C → Am 2, C → Cm 1, C → F 3, C → G 3, C → Em 1, C → E 2 semitones, and a chord to itself 0 (' + [M.am, M.cm, M.f, M.g, M.em, M.e, M.same].join(' ') + ')');
  ok(M.maj7 === 1 && M.back === M.f && M.pairs === '0,1,2', 'a major seventh is one step from its triad, the distance is the same in both directions, and C → F is one note held, one up 1, one up 2 (' + M.pairs + ')');
  const L = await ev(() => { const D = window.__daily, c = (r, m) => ({ root: r, iv: m ? [0, 3, 7] : [0, 4, 7] }); return [D.vwPlr(c(0), c(0, 1)), D.vwPlr(c(0), c(9, 1)), D.vwPlr(c(0), c(4, 1)), D.vwPlr(c(9, 1), c(0)), D.vwPlr(c(0), c(2, 1))].join(); });
  ok(L === 'P,R,L,R,', 'the Neo-Riemannian moves are named: C → Cm is P, C → Am is R, C → Em is L, and C → Dm is none (' + L + ')');
  // ---- the layout keeps the distances
  const C = await ev(() => { const D = window.__daily, tri = D.vwTriads(), pc = c => [...new Set(c.iv.map(i => (c.root + i) % 12))], n = tri.length, DD = tri.map(a => tri.map(b => D.vwDist(pc(a), pc(b)).d)), out = {};
    for (const dims of [2, 3]) { const X = D.vwMds(DD, n, dims); let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, m = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const d = Math.hypot(X[i][0] - X[j][0], X[i][1] - X[j][1], X[i][2] - X[j][2]), y = DD[i][j]; sx += d; sy += y; sxx += d * d; syy += y * y; sxy += d * y; m++; } out[dims] = (m * sxy - sx * sy) / Math.sqrt((m * sxx - sx * sx) * (m * syy - sy * sy)); out['z' + dims] = Math.max(...X.map(q => Math.abs(q[2]))); out['r' + dims] = Math.max(...X.map(q => Math.hypot(q[0], q[1], q[2]))); }
    return { n, ...out }; });
  ok(C.n === 24 && C[3] > .86 && C[2] > .82 && C[3] > C[2], 'the 24 triads, laid out from the table: distances in the picture follow the voice-leading distances (correlation ' + C[3].toFixed(2) + ' in 3D, ' + C[2].toFixed(2) + ' flat)');
  ok(C.z2 < 1e-9 && C.r3 <= 1.0001 && C.r3 > .99, 'a flat layout has no depth and a 3D one fits a unit ball');
  // ---- the song walks through it
  const song = () => ev(() => { const D = window.__daily; D.S.key = 9; D.S.minor = true; D.S.sections = [D.mkSection('Verse', ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'E'])]; D.CFG.vo = {}; D.VW.sig = ''; D.VW.ssig = ''; D.VW.nodes = new Map(); D.VW.hist = []; D.VW.live.clear(); D.VW.cur = null; D.VW.move = null; });
  const run = (syms, extra) => ev(([syms, extra]) => { const D = window.__daily, cv = document.createElement('canvas'); cv.width = 900; cv.height = 560; const g = cv.getContext('2d'); if (extra) new Function('D', extra)(D); for (const s of syms) { for (let i = 0; i < 12; i++) { D.HM.force = s; D.HM.stamp = -1; D.VZ.t += .08; D.vlWeb(g, 900, 560, { pulse: 0 }); } } D.HM.force = null;
    const V = D.VW; return { n: V.nodes.size, hist: V.hist.length, move: V.move && { from: V.move.from, to: V.move.to, d: V.move.d, held: V.move.pairs.filter(q => q[2] === 0).length, plr: V.move.plr }, ideas: V.ideas.map(i => i.sym + ':' + i.d + ':' + (i.plr || '')).join(), song: V.song }; }, [syms, extra]);
  await song(); const A = await run(['Am', 'F']);
  ok(A.move && A.move.from === 'Am' && A.move.to === 'F' && A.move.d === 1 && A.move.held === 2, 'Am → F is one step: A and C are held and E rises to F (' + JSON.stringify(A.move) + ')');
  ok(A.song.ids.length === 8 && A.song.avg > 1 && A.song.avg < 3.5 && A.song.max >= A.song.min, 'the song’s chord changes are measured (' + A.song.ids.length + ' chords in order, ' + A.song.avg.toFixed(1) + ' steps per change on average)');
  await song(); const B = await run(['Am', 'F', 'C']);
  ok(B.hist === 3 && B.move.from === 'F' && B.move.to === 'C' && B.move.d === 3, 'each change is recorded in the trail (' + B.hist + ' chords) and F → C is three steps');
  ok(/Em:1:L/.test(B.ideas) && /Cm:1:P/.test(B.ideas), 'ideas from C that the song does not use: Em (one step, an L move) and Cm (one step, a P move) (' + B.ideas + ')');
  // ---- the three spaces
  const sp = k => run(['C'], 'D.vlSet("vlweb","space","' + k + '"); D.VW.sig = ""; D.VW.nodes = new Map();');
  const s1 = await sp('song'), s2 = await sp('key'), s3 = await sp('all');
  ok(s1.n <= 8 && s2.n >= s1.n && s2.n >= 7 && s3.n >= 24, 'The song holds only its own chords, plus the key’s seven triads, then all 24 triads (' + s1.n + ' / ' + s2.n + ' / ' + s3.n + ')');
  // ---- a chord you play that the song does not use joins the web
  await song(); const J = await run(['Am', 'Bbm'], 'D.vlSet("vlweb","space","song");');
  ok(J.n >= 3 && J.hist === 2 && await ev(() => [...window.__daily.VW.nodes.values()].some(n => n.sym === 'A#m' || n.sym === 'Bbm')), 'a chord that is played but not in the song joins the web, at its place by smooth distance (' + J.n + ' chords)');
  // ---- every space and shape draws, and settings change what is drawn
  const E0 = t.errs.length, drawn = await ev(async () => { const D = window.__daily; D.CFG.vd = { glow: .3 }; let n = 0; for (const sp of ['song', 'key', 'all']) for (const dm of ['3', '2']) for (const pa of ['trail', 'song', 'off']) { D.CFG.vo = {}; D.vlSet('vlweb', 'space', sp); D.vlSet('vlweb', 'dims', dm); D.vlSet('vlweb', 'path', pa); D.vlSet('vlweb', 'moves', 1); D.vzSetMode('vlweb', true); await new Promise(r => setTimeout(r, 120)); n++; } D.CFG.vd = {}; D.CFG.vo = {}; return n; });
  ok(drawn === 18 && t.errs.length === E0, 'every space, shape and path option draws on the live canvas without an error');
  await ev(() => { const D = window.__daily; D.CFG.vo = {}; D.vlSet('vlweb', 'space', 'all'); D.vzSetMode('vlweb', true); D.vzDesignOpen(false); }); await wait(900);
  const lit = await ev(() => { const cv = document.querySelector('#pane-vis canvas'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 11) if (d[i] + d[i + 1] + d[i + 2] > 200) n++; return n; });
  ok(lit > 120, 'the live picture has the web on it (' + lit + ' bright samples)');
  // ---- a phone
  const q = await t.open({ w: 390, h: 844, mobile: true, debug: true }); await q.evaluate(() => window.__daily.mGo('see', 'vis')); await wait(1100);
  const Mo = await q.evaluate(async () => { const D = window.__daily, bad = []; D.vzSetMode('vlweb', true); D.vzDesignOpen(true, 'world'); await new Promise(r => setTimeout(r, 400)); const d = document.getElementById('vzDesign'), r = d.getBoundingClientRect(), vw = document.documentElement.clientWidth; if (Math.round(r.right) > vw || [...d.querySelectorAll('#vdOpts *')].some(e => e.offsetParent && e.getBoundingClientRect().right > r.right + 1) || document.documentElement.scrollWidth > vw) bad.push('vlweb'); return bad; });
  ok(!Mo.length, 'on a 390 px phone the options fit the screen');
  ok(t.errs.length === 0, 'no errors (' + t.errs.length + ')');
});
