/* ============================================================
   Part 66f · Voice-Leading Web (2.83)
   Chords placed by how far their notes have to move to get from one to the next. It is the geometry of voice leading (Tymoczko, "A Geometry of
   Music"; the Neo-Riemannian P, L and R moves): the distance between two chords is the fewest semitones their voices must travel in total, found
   by trying every way of pairing the notes (C → Am is 2, C → Cm is 1, C → F is 3). The chords are then laid out in 3D by classical
   multidimensional scaling of that distance table, refined by stress majorisation (SMACOF), so chords that are a smooth move apart sit close
   together, whatever the key. The song walks through the web as a glowing path; the notes of each change are drawn as voices (what moves, by how
   much, what is held); and the chords just a step or two from the one now playing, which the song does not use, are offered as ideas, named
   as P, L or R moves where they are one.
   Everything is measured from the chord symbols and what you play: nothing is guessed from the sound but the chord the detector reports. Settings are
   in the look's own panel; it draws wherever the visuals draw. The layout is worked out when the set of chords changes, not every frame.
   ============================================================ */
VMODES.push(['vlweb', 'Voice-Leading Web']);

/* ---------- the metric (pure) ---------- */
const vwMod = x => ((x % 12) + 12) % 12;
const vwCd = (a, b) => { const d = vwMod(a - b); return Math.min(d, 12 - d); };
const vwStep = (a, b) => { const d = vwMod(b - a); return d > 6 ? d - 12 : d; };                     /* signed semitones, −5 … +6 */
const VWP = {};
const vwPerms = n => VWP[n] || (VWP[n] = (function p(a) { return a.length <= 1 ? [a] : a.flatMap((x, i) => p([...a.slice(0, i), ...a.slice(i + 1)]).map(r => [x, ...r])); })(Array.from({ length: n }, (_, i) => i)));
/** every way to grow a chord to n voices by doubling its own notes */
const vwExpand = (X, n) => { let out = [X.slice()]; for (let k = X.length; k < n; k++) out = out.flatMap(o => X.map(x => [...o, x])); return out; };
/** the smallest total movement between two chords (arrays of pitch classes), and which note goes where: { d, pairs: [[from, to, signed steps]] } */
function vwDist(A, B) {
  const n = Math.max(A.length, B.length), P = vwPerms(n), EA = vwExpand(A, n), EB = vwExpand(B, n); let best = null;
  for (const a of EA) for (const b of EB) for (const p of P) { let d = 0; for (let i = 0; i < n; i++) d += vwCd(a[i], b[p[i]]); if (!best || d < best.d) best = { d, a, b: p.map(i => b[i]) }; }
  return { d: best.d, pairs: best.a.map((x, i) => [x, best.b[i], vwStep(x, best.b[i])]) };
}
/** the Neo-Riemannian move between two major/minor triads: 'P' (parallel), 'R' (relative), 'L' (leading-tone exchange), or null */
function vwPlr(a, b) {
  if (!a || !b) return null; const kind = c => c.iv.length === 3 && c.iv[1] === 4 && c.iv[2] === 7 ? 'M' : c.iv.length === 3 && c.iv[1] === 3 && c.iv[2] === 7 ? 'm' : null, ka = kind(a), kb = kind(b); if (!ka || !kb || ka === kb) return null;
  const d = vwMod(b.root - a.root); if (ka === 'M') return d === 0 ? 'P' : d === 9 ? 'R' : d === 4 ? 'L' : null; return d === 0 ? 'P' : d === 3 ? 'R' : d === 8 ? 'L' : null;
}
/** classical scaling of a distance table into `dims` dimensions (the top eigenvectors of the double-centred squared distances, by power iteration) */
function vwClassical(D, n, dims) {
  const D2 = D.map(r => r.map(x => x * x)), rm = D2.map(r => r.reduce((s, x) => s + x, 0) / n), gm = rm.reduce((s, x) => s + x, 0) / n, B = D2.map((r, i) => r.map((x, j) => -.5 * (x - rm[i] - rm[j] + gm)));
  const shift = Math.max(1e-6, ...B.map(r => r.reduce((s, x) => s + Math.abs(x), 0))), X = Array.from({ length: n }, () => [0, 0, 0]);   /* a shift makes every eigenvalue positive, so the power method finds the largest, not the largest in size */
  for (let k = 0; k < dims; k++) {
    let v = Array.from({ length: n }, (_, i) => Math.sin(i * 1.7 + k * 2.3 + 1));
    for (let it = 0; it < 90; it++) { const w = B.map((r, i) => r.reduce((s, x, j) => s + x * v[j], 0) + shift * v[i]), nr = Math.hypot(...w) || 1; v = w.map(x => x / nr); }
    const ray = B.reduce((s, r, i) => s + v[i] * r.reduce((q, x, j) => q + x * v[j], 0), 0);
    if (ray > 1e-9) { const c = Math.sqrt(ray); for (let i = 0; i < n; i++) X[i][k] = v[i] * c; }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) B[i][j] -= ray * v[i] * v[j];
  }
  return X;
}
/** the layout: classical scaling (or the previous layout, where there is one) refined by stress majorisation, centred and scaled to fit a unit ball */
function vwMds(D, n, dims, init) {
  let X = n < 2 ? [[0, 0, 0]] : init ? init.map((p, i) => p ? [p[0], p[1], dims > 2 ? p[2] : 0] : [Math.sin(i * 12.9) * .3, Math.cos(i * 7.7) * .3, dims > 2 ? Math.sin(i * 3.3) * .3 : 0]) : vwClassical(D, n, dims);
  if (n > 2) for (let it = 0; it < 45; it++) {
    const Y = X.map(() => [0, 0, 0]);
    for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) { if (i === j) continue; const dx = X[i][0] - X[j][0], dy = X[i][1] - X[j][1], dz = X[i][2] - X[j][2], dd = Math.hypot(dx, dy, dz) || 1e-6, w = D[i][j] / dd; Y[i][0] += w * dx; Y[i][1] += w * dy; Y[i][2] += w * dz; } for (let k = 0; k < 3; k++) Y[i][k] /= n; }
    X = Y; if (dims < 3) X.forEach(p => { p[2] = 0; });
  }
  if (n === 2) { const d = D[0][1] || 1; X = [[-d / 2, 0, 0], [d / 2, 0, 0]]; }
  const c = [0, 1, 2].map(k => X.reduce((s, p) => s + p[k], 0) / n); X.forEach(p => { for (let k = 0; k < 3; k++) p[k] -= c[k]; });
  const mx = Math.max(1e-6, ...X.map(p => Math.hypot(p[0], p[1], p[2]))); return X.map(p => p.map(x => x / mx));
}

/* ---------- chords ---------- */
const vwPcs = ch => [...new Set(ch.iv.map(i => (ch.root + i) % 12))];
const vwName = ch => ch.name.split('/')[0];
const vwId = ch => ch.root + ':' + vwPcs(ch).sort((a, b) => a - b).join('.');
const vwTriadQ = { '4,7': '', '3,7': 'm', '3,6': 'dim', '4,8': 'aug' };
/** the 24 major and minor triads */
const vwTriads = () => { const a = []; for (let r = 0; r < 12; r++) { a.push(parseChord(pcName(r))); a.push(parseChord(pcName(r) + 'm')); } return a.filter(Boolean); };
/** the seven triads of the key */
function vwDiatonic() {
  const s = S.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11], out = [];
  for (let i = 0; i < 7; i++) { const q = vwTriadQ[((s[(i + 2) % 7] - s[i] + 12) % 12) + ',' + ((s[(i + 4) % 7] - s[i] + 12) % 12)]; if (q == null) continue; const c = parseChord(pcName(vwMod(S.key + s[i])) + q); if (c) out.push(c); }
  return out;
}
const vwInKey = ch => { const sc = new Set((S.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]).map(x => vwMod(S.key + x))); return vwPcs(ch).every(p => sc.has(p)); };
const VW = { nodes: new Map(), edges: [], sig: '', ssig: '', song: { ids: [], avg: 0, min: 0, max: 0 }, live: new Map(), hist: [], cur: null, move: null, ideas: [], ideasFor: '', dmemo: new Map(), yaw: .6, f: [0, 0, 0] };
/** the smallest-movement alternatives to a chord that are not in the song, nearest first: { sym, d, plr, inKey } */
function vwIdeas(ch) {
  const id = vwId(ch), A = vwPcs(ch), inSong = new Set(VW.song.ids), out = [];
  vwTriads().forEach(c => { const cid = vwId(c); if (cid === id) return; const r = vwDist(A, vwPcs(c)); if (r.d <= 2) out.push({ id: cid, sym: vwName(c), d: r.d, plr: vwPlr(ch, c), inKey: vwInKey(c), inSong: inSong.has(cid) }); });
  return out.sort((x, y) => x.inSong - y.inSong || x.d - y.d || y.inKey - x.inKey || (x.plr ? 0 : 1) - (y.plr ? 0 : 1)).slice(0, 5);
}
const vwPair = (a, b) => { const k = a.id < b.id ? a.id + '>' + b.id : b.id + '>' + a.id; let d = VW.dmemo.get(k); if (d == null) { d = vwDist(a.pcs, b.pcs).d; if (VW.dmemo.size > 4000) VW.dmemo.clear(); VW.dmemo.set(k, d); } return d; };

/** note a change of chord: the web's trail, the voices that moved, the ideas from the new chord */
function vwTrack(now) {
  const ch = HM.chord; if (!ch) return; const id = vwId(ch); if (VW.cur === id) return;
  const prev = VW.cur ? VW.nodes.get(VW.cur) : null; VW.cur = id;
  if (prev) { const r = vwDist(prev.pcs, vwPcs(ch)); VW.move = { from: prev.sym, to: vwName(ch), fromId: prev.id, toId: id, d: r.d, pairs: r.pairs, t: now, plr: vwPlr(prev.ch, ch) }; }
  VW.hist.push(id); if (VW.hist.length > 64) VW.hist.shift();
  if (!VW.nodes.has(id) && !VW.songIds.has(id)) { VW.live.set(id, ch); if (VW.live.size > 12) VW.live.delete(VW.live.keys().next().value); }
  VW.ideas = vwIdeas(ch); VW.ideasFor = id;
}
VW.songIds = new Set();
/** the chords on show, laid out when the set changes (the layout starts from the last one, so the web moves rather than jumps) */
function vwSync(space, dims) {
  const song = []; S.sections.forEach(s => s.bars.forEach(b => barChords(b).forEach(sym => { const ch = parseChord(sym); if (ch) song.push(ch); })));
  const want = new Map(), add = (ch, inSong) => { if (!ch) return; const id = vwId(ch); let n = want.get(id); if (!n) want.set(id, n = { id, ch, sym: vwName(ch), pcs: vwPcs(ch), root: ch.root, count: 0, inSong: false }); if (inSong) { n.count++; n.inSong = true; } };
  song.forEach(c => add(c, true)); VW.songIds = new Set(want.keys());
  if (space === 'key') vwDiatonic().forEach(c => add(c)); else if (space === 'all') vwTriads().forEach(c => add(c));
  VW.live.forEach(c => add(c)); if (HM.chord) add(HM.chord);
  const ids = [...want.keys()].sort(), sig = dims + '|' + ids.join(','), ssig = song.map(vwId).join(',');
  if (ssig !== VW.ssig) { VW.ssig = ssig; const seq = []; song.forEach(c => { const id = vwId(c); if (seq[seq.length - 1] !== id) seq.push(id); }); const ds = []; for (let i = 1; i < seq.length; i++) { const a = want.get(seq[i - 1]), b = want.get(seq[i]); if (a && b) ds.push(vwPair(a, b)); } VW.song = { ids: seq, avg: ds.length ? ds.reduce((s, x) => s + x, 0) / ds.length : 0, min: ds.length ? Math.min(...ds) : 0, max: ds.length ? Math.max(...ds) : 0 }; }
  if (sig === VW.sig) { want.forEach((n, id) => { const o = VW.nodes.get(id); if (o) { o.count = n.count; o.inSong = n.inSong; } }); return; }
  VW.sig = sig; const list = ids.map(id => want.get(id)), n = list.length, D = list.map(a => list.map(b => a === b ? 0 : vwPair(a, b)));
  const have = list.filter(x => VW.nodes.has(x.id)).length, X = vwMds(D, n, dims, have >= Math.max(2, n / 2) ? list.map(x => (VW.nodes.get(x.id) || {}).t || null) : null);
  const keep = new Map(); list.forEach((x, i) => { const o = VW.nodes.get(x.id); keep.set(x.id, Object.assign(o || { p: X[i].slice(), act: 0 }, x, { t: X[i] })); }); VW.nodes = keep;
  VW.edges = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (D[i][j] <= 4) VW.edges.push({ a: list[i].id, b: list[j].id, d: D[i][j], plr: vwPlr(list[i].ch, list[j].ch) });
}

/* ---------- look ---------- */
const VWH = { fifths: n => thHue(n.root), quality: n => n.ch.iv.includes(3) && !n.ch.iv.includes(4) ? 250 : n.ch.iv.includes(4) ? 38 : 150 };
VLOOK.vlweb = { title: 'Voice-Leading Web', opts: [
  { type: 'head', label: 'Space' },
  { k: 'space', label: 'Chords', type: 'choice', def: 'key', opts: [['song', 'The song', 'Only the chords the song uses (and any you play)'], ['key', 'Song + key', 'The song and the seven triads of its key'], ['all', 'All 24', 'Every major and minor triad: the whole map of smooth moves']], tip: 'Which chords are in the web' },
  { k: 'dims', label: 'Shape', type: 'choice', def: '3', opts: [['3', '3D', 'A web you can turn'], ['2', '2D', 'Flat, like a map']], tip: 'Three dimensions fit the distances better; two read like a chart' },
  { k: 'reach', label: 'Smooth move', type: 'choice', def: '2', opts: [['1', '1 step'], ['2', '2'], ['3', '3'], ['4', '4']], tip: 'Draw a line between chords whose notes move this many semitones in all, or fewer' },
  { type: 'head', label: 'Show' },
  { k: 'path', label: 'Path', type: 'choice', def: 'trail', opts: [['trail', 'Trail', 'The chords you have just been through'], ['song', 'Song + trail', 'The whole song faintly, the trail brightly'], ['off', 'Off']], tip: 'The line the music draws through the web' },
  { k: 'ahead', label: 'Chords ahead', type: 'toggle', def: 1, tip: 'A dashed line to the next chords of the song while it plays' },
  { k: 'voices', label: 'Voices', type: 'toggle', def: 1, tip: 'For each change: which note goes where, how far, and what stays' },
  { k: 'ideas', label: 'Ideas', type: 'toggle', def: 1, tip: 'Chords a step or two from this one that the song does not use' },
  { k: 'moves', label: 'P · L · R names', type: 'toggle', def: 0, tip: 'Name the moves between major and minor chords: Parallel, Leading-tone exchange, Relative' },
  { k: 'edges', label: 'Connections', type: 'toggle', def: 1, tip: 'Lines between chords that are a smooth move apart' },
  { k: 'labels', label: 'Chord names', type: 'toggle', def: 1, tip: 'Name each chord' },
  { type: 'head', label: 'Look' },
  { k: 'colour', label: 'Colour', type: 'choice', def: 'fifths', opts: [['fifths', 'By fifths', 'Neighbours on the circle of fifths share a colour'], ['quality', 'Major / minor', 'Warm for major, cool for minor']], tip: 'What colours a chord' },
  { k: 'nodeS', label: 'Chords', type: 'range', min: .5, max: 2, step: .05, def: 1, unit: 'x', tip: 'How big the chords are' }, { k: 'lineW', label: 'Lines', type: 'range', min: .4, max: 3, step: .05, def: 1, unit: 'x', tip: 'How thick the lines are' }, { k: 'textS', label: 'Text', type: 'range', min: .6, max: 2, step: .05, def: 1, unit: 'x', tip: 'How big the names are' },
  { k: 'trail', label: 'Trail length', type: 'range', min: 2, max: 32, step: 1, def: 10, tip: 'How many chord changes the trail remembers' },
  { type: 'head', label: 'Camera' },
  { k: 'spin', label: 'Turn', type: 'range', min: 0, max: 3, step: .05, def: .6, unit: 'x', tip: 'How fast it slowly turns (3D)' }, { k: 'tilt', label: 'Angle', type: 'range', min: -30, max: 80, step: 1, def: 22, unit: 'deg', tip: 'How far above you look at it (3D)' },
  { k: 'zoom', label: 'Zoom', type: 'range', min: .5, max: 2.2, step: .05, def: 1, unit: 'x', tip: 'How close' }, { k: 'depth', label: 'Depth', type: 'range', min: 2, max: 9, step: .1, def: 4, tip: 'Perspective: low is dramatic, high is flat' },
  { k: 'follow', label: 'Follow the chord', type: 'range', min: 0, max: 1, step: .05, def: .35, unit: '%', tip: 'Slide the picture so the chord that is playing stays near the middle' }] };

function vlWeb(g, W, H, X) {
  hmUpdate(); const o = k => vlv('vlweb', k), now = HM.now, dt = HM.dt || .016, sc = clamp(Math.min(W, H * 1.2) / 760, .55, 1.6), dims = o('dims') === '2' ? 2 : 3, reach = +o('reach'), pulse = (X && X.pulse) || 0;
  vwTrack(now); vwSync(o('space'), dims);
  const ease = 1 - Math.pow(.003, dt), mono = 'ui-monospace,Menlo,Consolas,monospace', chroma = thChroma(), cur = VW.nodes.get(VW.cur), nodes = [...VW.nodes.values()], maxC = Math.max(1, ...nodes.map(n => n.count));
  nodes.forEach(n => { for (let k = 0; k < 3; k++) n.p[k] += (n.t[k] - n.p[k]) * ease; const a = n.pcs.reduce((s, p) => s + chroma[p], 0) / n.pcs.length; n.act += (a - n.act) * Math.min(1, dt * 8); });
  VW.yaw += dt * .12 * o('spin') * (dims === 3 ? 1 : 0); const yaw = dims === 3 ? VW.yaw : 0, pit = dims === 3 ? o('tilt') * Math.PI / 180 : 0, fol = +o('follow');
  const tg = cur && fol > 0 ? cur.p : [0, 0, 0]; for (let k = 0; k < 3; k++) VW.f[k] += (tg[k] * fol * .8 - VW.f[k]) * Math.min(1, dt * 2.5);
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit), R = Math.min(W * .36, H * .4) * o('zoom'), Dp = o('depth');
  const P = p => { const x = p[0] - VW.f[0], y = p[1] - VW.f[1], z = p[2] - VW.f[2], x1 = cy * x + sy * z, z1 = -sy * x + cy * z, y2 = cp * y - sp * z1, z2 = sp * y + cp * z1, w = Dp / (Dp - clamp(z2, -1.4, Dp * .6)); return [W / 2 + x1 * R * w, H * .5 - y2 * R * w, z2, w]; };
  const hue = n => VWH[o('colour')](n), col = (n, l, a) => `hsla(${hue(n)},82%,${l}%,${clamp(a, 0, 1)})`, fog = q => .42 + .58 * clamp(q[2] * .5 + .5, 0, 1), tx = (s, x, y, size, c, al, wt) => { g.font = `${wt || 700} ${Math.round(size)}px ${mono}`; g.textAlign = al || 'center'; g.fillStyle = c; g.fillText(s, x, y); };
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 0, W, H); g.lineCap = 'round';
  const Q = new Map(); nodes.forEach(n => Q.set(n.id, P(n.p)));
  // the smooth moves: a line between chords a few semitones apart, brighter the smaller the move
  if (o('edges')) VW.edges.forEach(e => { if (e.d > reach) return; const a = VW.nodes.get(e.a), b = VW.nodes.get(e.b), A = Q.get(e.a), B = Q.get(e.b); if (!a || !b) return; const u = 1 - (e.d - 1) / 4, al = (.06 + .22 * u + .35 * Math.max(a.act * b.act, (cur === a || cur === b) ? .25 : 0)) * Math.min(fog(A), fog(B));
    const gr = g.createLinearGradient(A[0], A[1], B[0], B[1]); gr.addColorStop(0, col(a, 62, al)); gr.addColorStop(1, col(b, 62, al)); g.strokeStyle = gr; g.lineWidth = (.7 + 1.7 * u) * sc * o('lineW'); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
    if (o('moves') && e.plr) tx(e.plr, (A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + 3 * sc, 10 * sc * o('textS'), `rgba(255,255,255,${.55 * Math.min(fog(A), fog(B))})`); });
  // the path the music takes
  const seg = (a, b, i, w, al, dash, bulge) => { const A = Q.get(a), B = Q.get(b); if (!A || !B || a === b) return; const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, dx = B[0] - A[0], dy = B[1] - A[1], dl = Math.hypot(dx, dy) + 1, bp = Math.min(60, dl * .22) * (i % 2 ? 1 : -1) * bulge, qx = mx - dy / dl * bp, qy = my + dx / dl * bp, n = VW.nodes.get(b);
    g.strokeStyle = col(n, 64, al); g.lineWidth = w; g.setLineDash(dash || []); g.beginPath(); g.moveTo(A[0], A[1]); g.quadraticCurveTo(qx, qy, B[0], B[1]); g.stroke(); g.setLineDash([]);
    if (!dash) { const t = .82, ex = (1 - t) * (1 - t) * A[0] + 2 * (1 - t) * t * qx + t * t * B[0], ey = (1 - t) * (1 - t) * A[1] + 2 * (1 - t) * t * qy + t * t * B[1], ux = B[0] - ex, uy = B[1] - ey, ul = Math.hypot(ux, uy) || 1, s = (4 + w) * .9; g.fillStyle = col(n, 68, al); g.beginPath(); g.moveTo(ex + ux / ul * s, ey + uy / ul * s); g.lineTo(ex - uy / ul * s * .6, ey + ux / ul * s * .6); g.lineTo(ex + uy / ul * s * .6, ey - ux / ul * s * .6); g.closePath(); g.fill(); } };
  if (o('path') === 'song') VW.song.ids.forEach((id, i) => { if (i) seg(VW.song.ids[i - 1], id, i, .9 * sc * o('lineW'), .13, null, .7); });
  const tr = []; VW.hist.slice(-Math.round(o('trail') + 1)).forEach(id => { if (tr[tr.length - 1] !== id) tr.push(id); });
  if (o('path') !== 'off') { g.shadowColor = '#fff'; tr.forEach((id, i) => { if (!i) return; const u = i / (tr.length - 1 || 1); g.shadowBlur = u > .6 ? 10 * u : 0; seg(tr[i - 1], id, i, (1 + 2.8 * u) * sc * o('lineW'), .15 + .75 * u, null, 1); }); g.shadowBlur = 0; }
  if (o('ahead') && vzPlaying()) { let up = []; try { up = lxUpcoming(5); } catch (e) { } let last = VW.cur; up.slice(1, 5).forEach((u, i) => { const ch = parseChord(u.sym); if (!ch) return; const id = vwId(ch); if (id !== last && Q.has(id) && Q.has(last)) seg(last, id, i + 1, 1.4 * sc * o('lineW'), .5 - i * .1, [4 * sc, 5 * sc], .8); last = id; }); }
  // the chords: back to front
  const order = nodes.slice().sort((a, b) => Q.get(a.id)[2] - Q.get(b.id)[2]), ideaIds = new Set(o('ideas') ? VW.ideas.map(x => x.id) : []);
  order.forEach(n => { const q = Q.get(n.id), f = fog(q), isCur = n === cur, base = (7 + 7 * Math.sqrt(n.count / maxC)) * sc * o('nodeS') * q[3] * (n.inSong ? 1 : .72), r = base * (1 + n.act * .5 + (isCur ? .35 + pulse * .25 : 0)), minor = n.ch.iv.includes(3) && !n.ch.iv.includes(4), triad = n.ch.iv.length === 3 && (n.ch.iv.includes(4) || minor) && n.ch.iv.includes(7);
    if (isCur || n.act > .25) { g.shadowColor = col(n, 60, 1); g.shadowBlur = (6 + 24 * Math.max(n.act, isCur ? 1 : 0)) * sc; }
    if (ideaIds.has(n.id) && !isCur) { g.strokeStyle = `rgba(255,255,255,${.35 + .3 * Math.sin(VZ.t * 4)})`; g.lineWidth = 1.2 * sc; g.setLineDash([3, 3]); g.beginPath(); g.arc(q[0], q[1], r + 7 * sc * q[3], 0, 7); g.stroke(); g.setLineDash([]); }
    g.beginPath(); if (!triad) { g.moveTo(q[0], q[1] - r * 1.25); g.lineTo(q[0] + r * 1.1, q[1]); g.lineTo(q[0], q[1] + r * 1.25); g.lineTo(q[0] - r * 1.1, q[1]); g.closePath(); } else g.arc(q[0], q[1], r, 0, 7);
    if (minor) { g.fillStyle = col(n, 30, (.35 + n.act * .5) * f); g.fill(); g.strokeStyle = col(n, 64, (.9) * f); g.lineWidth = (2 + n.act * 2) * sc * q[3]; g.stroke(); } else { g.fillStyle = col(n, 58 + n.act * 12, (.55 + n.act * .45) * f); g.fill(); }
    g.shadowBlur = 0;
    if (VW.live.has(n.id) && !n.inSong) { g.strokeStyle = `rgba(255,255,255,${.6 * f})`; g.setLineDash([2, 3]); g.lineWidth = 1; g.beginPath(); g.arc(q[0], q[1], r + 3 * sc, 0, 7); g.stroke(); g.setLineDash([]); }
    if (isCur) { g.strokeStyle = '#fff'; g.lineWidth = 1.6 * sc; g.beginPath(); g.arc(q[0], q[1], r + 5 * sc * q[3] + pulse * 6 * sc, 0, 7); g.stroke(); }
    if (o('labels') && (isCur || q[3] > .8 || n.inSong || ideaIds.has(n.id))) tx(n.sym, q[0], q[1] - r - 6 * sc * q[3], (isCur ? 14 : 11) * sc * o('textS') * Math.min(1.35, q[3]), isCur ? '#fff' : `rgba(236,246,246,${.9 * f})`, 'center', isCur ? 800 : 700); });
  if (!VW.hist.length) tx('play or open a song: the chords are placed by how little their notes move', W / 2, H - 18 * sc, 12 * sc, 'rgba(236,246,246,.55)');
  // the song's own smoothness
  { const s = VW.song, x0 = 14 * sc, y0 = 22 * sc; tx('VOICE LEADING', x0, y0, 10 * sc, 'rgba(236,246,246,.45)', 'left'); if (s.ids.length > 1) { const avg = s.avg; tx(`song: ${avg.toFixed(1)} steps per change · ${avg <= 2 ? 'smooth' : avg <= 3.2 ? 'moderate' : 'leaping'} (${s.min}–${s.max})`, x0, y0 + 16 * sc, 11 * sc, 'rgba(236,246,246,.8)', 'left'); } }
  // the voices of the last change: what moves, how far, what is held
  const mv = VW.move; if (o('voices') && mv) { const age = (now - mv.t) / 1000, a = clamp(1.1 - age / 14, .28, 1), n = mv.pairs.length, row = 20 * sc, pw = Math.min(W * .34, 250 * sc), ph = 44 * sc + n * row, x0 = 12 * sc, y0 = H - ph - 12 * sc;
    g.fillStyle = `rgba(6,12,14,${.62 * a})`; g.beginPath(); (g.roundRect ? g.roundRect(x0, y0, pw, ph, 8 * sc) : g.rect(x0, y0, pw, ph)); g.fill();
    tx(`${mv.from} → ${mv.to}`, x0 + 10 * sc, y0 + 18 * sc, 12 * sc, `rgba(255,255,255,${a})`, 'left', 800); tx(`${mv.d} ${mv.d === 1 ? 'step' : 'steps'}${mv.plr ? ' · ' + ({ P: 'Parallel', L: 'Leading-tone', R: 'Relative' })[mv.plr] : ''}`, x0 + pw - 10 * sc, y0 + 18 * sc, 10 * sc, `rgba(236,246,246,${.75 * a})`, 'right');
    const xs = [x0 + 26 * sc, x0 + pw - 26 * sc], p0 = mv.pairs.slice().sort((p, q) => vwMod(p[0] - 0) - vwMod(q[0] - 0));
    p0.forEach((p, i) => { const y = y0 + 38 * sc + i * row + row / 2, held = p[2] === 0, c = held ? `rgba(255,205,90,${a})` : `rgba(120,230,210,${a})`; tx(pcName(p[0]), xs[0] - 6 * sc, y + 4 * sc, 11 * sc, `rgba(236,246,246,${a})`, 'right'); tx(pcName(p[1]), xs[1] + 6 * sc, y + 4 * sc, 11 * sc, `rgba(236,246,246,${a})`, 'left');
      g.strokeStyle = c; g.lineWidth = 2 * sc; g.beginPath(); g.moveTo(xs[0], y); g.lineTo(xs[1], y); g.stroke(); g.fillStyle = c; g.beginPath(); g.arc(xs[0], y, 3 * sc, 0, 7); g.fill(); g.beginPath(); g.arc(xs[1], y, 3 * sc, 0, 7); g.fill();
      tx(held ? 'held' : (p[2] > 0 ? '+' : '−') + Math.abs(p[2]), (xs[0] + xs[1]) / 2, y - 3 * sc, 9 * sc, c); }); }
  // ideas from the chord now playing
  if (o('ideas') && cur && VW.ideas.length) { const txt = VW.ideas.slice(0, 4).map(i => `${i.sym} (${i.d}${i.plr ? ' ' + i.plr : ''})`).join('  ·  '); tx('smooth ideas from ' + cur.sym, W - 14 * sc, H - 34 * sc, 10 * sc, 'rgba(236,246,246,.5)', 'right'); tx(txt, W - 14 * sc, H - 16 * sc, 12 * sc, 'rgba(236,246,246,.88)', 'right'); }
  g.lineCap = 'butt'; g.textAlign = 'left';
}
VL_DRAW.vlweb = vlWeb;
