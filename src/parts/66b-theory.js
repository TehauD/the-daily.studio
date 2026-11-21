/* ============================================================
   Part 66b · Two looks made of music theory (2.79)
     Harmonic Wheel   the circle of fifths as a live network. Twelve keys round the rim (the major chords outside, their relative minors
                      inside), the key you are in lit as a zone, the chords of the song as nodes, and every chord change you play or the song
                      plays drawn as a curve from one chord to the next: the more often, the brighter. The chord sounding now glows; the
                      notes sounding now are bars on the rim at their place on the circle; the middle says which chord is likely next, from
                      what this song and your playing have done so far.
     Tonnetz          the lattice music theorists draw: along one direction the notes are a fifth apart, along another a major third, along
                      the third a minor third. Every triangle is a major or minor chord. The view follows the chord and the line the song
                      draws across the lattice is how little each chord moves from the one before.
   Both read the harmony state in part 65 and draw on the visuals canvas, so they also work in the stage designer and full screen. Neither
   decides anything for you: "likely next" is a count of what has already happened here, and says so.
   ============================================================ */
VMODES.push(['wheel', 'Harmonic Wheel'], ['tonnetz', 'Tonnetz']); HM_MODES.add('wheel'); HM_MODES.add('tonnetz');
const THX = { trans: new Map(), last: null, from: null, to: null, moveT: -99, song: new Set(), seed: null, hist: [], cam: null, cent: null, base: null };
const thFif = pc => ((pc % 12) * 7 + 84) % 12;                           /* a note's place on the circle of fifths (C = 0 at the top, G = 1, D = 2 ...) */
const thMinorOf = ch => !!ch && ch.iv.includes(3) && !ch.iv.includes(4);   /* minor and diminished chords sit on the inner ring */
/** a chord as its place on the wheel: its fifths position, and whether it is on the inner (minor) ring. A minor chord sits under its relative major. */
function thNode(ch) { const m = thMinorOf(ch), k = thFif(m ? ch.root + 3 : ch.root); return { id: (m ? 'm' : 'M') + k, k, m, root: ch.root }; }
const thName = (k, m) => { const root = ((m ? k * 7 + 9 : k * 7) % 12 + 12) % 12; return pcName(root) + (m ? 'm' : ''); };
const thNodeRoot = id => (((+id.slice(1)) * 7 + (id[0] === 'm' ? 9 : 0)) % 12 + 12) % 12;
const thHue = root => lxHueOf(lxFifths(root));
const thCol = (root, l, a) => `hsla(${thHue(root)},80%,${l}%,${a})`;
/** the chords of the open song, in order: they seed the transitions, so the wheel shows the song's own path before anything plays */
function thSeed() {
  const sig = S.sections.map(s => s.bars.map(b => b.chord || '').join('|')).join('/'); if (THX.seed === sig) return; THX.seed = sig; THX.song = new Set(); const seed = new Map(); let prev = null;
  S.sections.forEach(s => s.bars.forEach(b => barChords(b).forEach(sym => { const ch = parseChord(sym); if (!ch) return; const n = thNode(ch); THX.song.add(n.id); if (prev && prev !== n.id) seed.set(prev + '>' + n.id, (seed.get(prev + '>' + n.id) || 0) + 1); prev = n.id; })));
  THX.trans.forEach((v, k) => { if (v.live) seed.set(k, (seed.get(k) || 0) + 0); });
  THX.base = seed;
}
/** note a change of chord, from the song or from your playing */
function thTrack(now) {
  thSeed(); const ch = HM.chord; if (!ch) return; const n = thNode(ch);
  if (THX.last !== n.id) { if (THX.last) { const k = THX.last + '>' + n.id; THX.trans.set(k, (THX.trans.get(k) || 0) + 1); THX.from = THX.last; THX.to = n.id; THX.moveT = now; } THX.last = n.id; }
}
const thCount = k => (THX.trans.get(k) || 0) + (THX.base ? (THX.base.get(k) || 0) * .6 : 0);
const thAll = () => { const all = new Map(); if (THX.base) THX.base.forEach((v, k) => all.set(k, v * .6)); THX.trans.forEach((v, k) => all.set(k, (all.get(k) || 0) + v)); return all; };
/** what has followed this chord so far, most often first */
function thNext(id) { const out = []; thAll().forEach((v, k) => { const [a, b] = k.split('>'); if (a === id) out.push([b, v]); }); out.sort((x, y) => y[1] - x[1]); const tot = out.reduce((s, x) => s + x[1], 0); return out.map(([b, v]) => ({ id: b, p: v / (tot || 1) })); }
/** how loud each of the twelve notes is right now (0..1): what is played, or what the song is playing */
function thChroma() {
  const c = new Float32Array(12), live = AN.active ? AN.chroma : null, play = vzPlaying() ? PB.chroma : null; let mx = .001;
  if (live) for (let i = 0; i < 12; i++) mx = Math.max(mx, live[i]);
  for (let i = 0; i < 12; i++) c[i] = Math.max(live ? live[i] / mx : 0, play ? PB.chroma[i] : 0);
  return c;
}
const thSc = (W, H) => clamp(Math.min(W, H * 1.15) / 760, .55, 1.7);

/* ---------- Harmonic Wheel ---------- */
function thWheel(g, W, H, X) {
  const now = HM.now, mo = hmCm().motion; thTrack(now); const sc = thSc(W, H), cx = W / 2, cy = H * .5, R = Math.min(W * .42, H * .385), Ri = R * .66, Rc = R * .3, pulse = (X && X.pulse) || 0;
  const ang = k => k / 12 * Math.PI * 2 - Math.PI / 2, pos = (k, m, r) => { const rr = r || (m ? Ri : R), a = ang(k); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; };
  const keyM = S.minor ? thFif(S.key + 3) : thFif(S.key), keyRoot = S.key, cur = HM.chord ? thNode(HM.chord) : null, chroma = thChroma();
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 0, W, H);
  // the key's zone: the three neighbours (IV, I, V) and their relatives, lit as a band across both rings
  { const a0 = ang(keyM - 1.5), a1 = ang(keyM + 1.5); g.beginPath(); g.arc(cx, cy, R + 24 * sc, a0, a1); g.arc(cx, cy, Rc + 6 * sc, a1, a0, true); g.closePath(); const gr = g.createRadialGradient(cx, cy, Rc, cx, cy, R + 24 * sc); gr.addColorStop(0, thCol(keyRoot, 55, .02)); gr.addColorStop(1, thCol(keyRoot, 60, .14 + .06 * pulse)); g.fillStyle = gr; g.fill(); g.strokeStyle = thCol(keyRoot, 66, .35); g.lineWidth = 1.2; g.stroke(); }
  // the rings and spokes
  g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.12)'; [R, Ri, Rc].forEach(r => { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); });
  g.strokeStyle = 'rgba(255,255,255,.07)'; for (let k = 0; k < 12; k++) { const a = pos(k, 0, Rc), b = pos(k, 0, R); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  // the notes sounding: bars on the rim at their place on the circle
  for (let pc = 0; pc < 12; pc++) { const v = chroma[pc]; if (v < .06) continue; const k = thFif(pc), a = ang(k), r0 = R + 28 * sc, r1 = r0 + v * 34 * sc; g.strokeStyle = thCol(pc, 62, .25 + .65 * v); g.lineWidth = 7 * sc; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke(); }
  g.lineCap = 'butt';
  // the chord changes: a curve from each chord to the next, brighter the more often it has happened
  const all = thAll(); let mxC = 1; all.forEach(v => { mxC = Math.max(mxC, v); });
  const nodeXY = id => { const m = id[0] === 'm', k = +id.slice(1); return pos(k, m); };
  all.forEach((v, key) => { const [a, b] = key.split('>'), A = nodeXY(a), B = nodeXY(b), u = v / mxC, hot = cur && a === cur.id, mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, qx = lerp(mx, cx, .62), qy = lerp(my, cy, .62), root = ((+a.slice(1)) * 7 + (a[0] === 'm' ? 9 : 0)) % 12;
    g.strokeStyle = thCol(root, 62, clamp(.1 + u * .45 + (hot ? .3 : 0), 0, .95)); g.lineWidth = (1 + u * 3.6 + (hot ? 1.2 : 0)) * sc; g.beginPath(); g.moveTo(A[0], A[1]); g.quadraticCurveTo(qx, qy, B[0], B[1]); g.stroke();
    // an arrowhead near the end, so the direction reads
    const t = .86, ex = (1 - t) * (1 - t) * A[0] + 2 * (1 - t) * t * qx + t * t * B[0], ey = (1 - t) * (1 - t) * A[1] + 2 * (1 - t) * t * qy + t * t * B[1], dx = B[0] - ex, dy = B[1] - ey, dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl, s = (5 + 4 * u) * sc;
    g.fillStyle = thCol(root, 66, clamp(.18 + u * .5, 0, .9)); g.beginPath(); g.moveTo(ex + ux * s, ey + uy * s); g.lineTo(ex - uy * s * .6, ey + ux * s * .6); g.lineTo(ex + uy * s * .6, ey - ux * s * .6); g.closePath(); g.fill(); });
  // a spark travelling along the change that just happened
  if (THX.from && now - THX.moveT < 1400 && mo > 0) { const A = nodeXY(THX.from), B = nodeXY(THX.to), t = clamp((now - THX.moveT) / 1100, 0, 1), qx = lerp((A[0] + B[0]) / 2, cx, .62), qy = lerp((A[1] + B[1]) / 2, cy, .62), x = (1 - t) * (1 - t) * A[0] + 2 * (1 - t) * t * qx + t * t * B[0], y = (1 - t) * (1 - t) * A[1] + 2 * (1 - t) * t * qy + t * t * B[1]; hmGlow(g, x, y, 22 * sc, 'rgba(255,255,255,A)', .9 * (1 - t * .6)); }
  // the twelve keys
  for (let k = 0; k < 12; k++) for (const m of [0, 1]) {
    const id = (m ? 'm' : 'M') + k, [x, y] = pos(k, m), root = ((m ? k * 7 + 9 : k * 7) % 12 + 12) % 12, inKey = Math.abs(((k - keyM + 18) % 12) - 6) <= 1, inSong = THX.song.has(id), now_ = cur && cur.id === id, v = chroma[root], r = (m ? 15 : 19) * sc * (1 + (now_ ? .35 : 0) + v * .25);
    if (now_) hmGlow(g, x, y, r * 3.2, thCol(root, 60, 'A'), .55 + .25 * pulse);
    g.beginPath(); g.arc(x, y, r, 0, 7);
    if (inSong || now_) { g.fillStyle = thCol(root, now_ ? 62 : 48, now_ ? .95 : .55 + v * .3); g.fill(); g.strokeStyle = thCol(root, 78, .9); g.lineWidth = (now_ ? 2.4 : 1.4) * sc; g.stroke(); }
    else { g.fillStyle = `rgba(255,255,255,${inKey ? .07 : .025})`; g.fill(); g.strokeStyle = `rgba(255,255,255,${inKey ? .3 : .13})`; g.lineWidth = 1; g.stroke(); }
    if (inSong || now_ || inKey) hmText(g, thName(k, m), x, y + 4 * sc, Math.round((m ? 11 : 13) * sc * (m ? .95 : 1)), now_ || inSong ? '#0a0f10' : 'rgba(255,255,255,.62)', 'center', 800);
  }
  // your voice: a ring on its note
  if (HM.vm != null && HM.vOn) { const pc = ((Math.round(HM.vm) % 12) + 12) % 12, a = ang(thFif(pc)), x = cx + Math.cos(a) * (R + 22 * sc), y = cy + Math.sin(a) * (R + 22 * sc); g.strokeStyle = 'rgba(255,214,102,.95)'; g.lineWidth = 2.2 * sc; g.beginPath(); g.arc(x, y, 7 * sc, 0, 7); g.stroke(); }
  // the middle: the chord, the key, and what has tended to come next
  const fs = Math.round(clamp(Rc * .58, 18, 54)); hmText(g, HM.sym || '—', cx, cy - fs * .02, fs, '#fff', 'center', 800);
  hmText(g, (pcName(S.key) + (S.minor ? ' minor' : ' major')), cx, cy + fs * .45, Math.round(fs * .3), 'rgba(255,255,255,.6)', 'center', 600);
  const nx = cur ? thNext(cur.id) : [];
  if (nx.length) { const top = nx[0], nm = thName(+top.id.slice(1), top.id[0] === 'm'); hmText(g, 'next: ' + nm + ' ' + Math.round(top.p * 100) + '%', cx, cy + fs * .98, Math.round(fs * .3), thCol(thNodeRoot(top.id), 72, .9), 'center', 700); }
  if (H > 260) hmText(g, 'outer ring: major · inner ring: relative minor · lit band: the key · “next” counts what has already happened here', 14, H - 12, hmFz(W, H, 13), 'rgba(255,255,255,.3)', 'left', 500);
}

/* ---------- Tonnetz ---------- */
const TN = { cam: null, trail: [], last: null };
const thTriPcs = (i, j, up) => up ? [(7 * i + 4 * j) % 12, (7 * (i + 1) + 4 * j) % 12, (7 * i + 4 * (j + 1)) % 12] : [(7 * (i + 1) + 4 * j) % 12, (7 * i + 4 * (j + 1)) % 12, (7 * (i + 1) + 4 * (j + 1)) % 12];
const thMod = x => ((x % 12) + 12) % 12;
function thTonnetz(g, W, H, X) {
  const now = HM.now, mo = hmCm().motion, dt = HM.dt || .016, s = clamp(Math.min(W, H) / 8.5, 44, 120) / vzSize(), h3 = s * Math.sqrt(3) / 2, cx = W / 2, cy = H * .52, chroma = thChroma(), pulse = (X && X.pulse) || 0;
  const P = (i, j) => [s * (i + j * .5), h3 * j];                                       /* the plane position of lattice point (i, j) */
  const ch = HM.chord, minor = thMinorOf(ch), root = ch ? ch.root : S.key;
  // find the triangle for the chord that sits nearest where the last one was, so the line it draws is the smallest possible step
  const ref = TN.cam || [0, 0]; let best = null, bd = 1e9;
  const ci = Math.round(ref[0] / s) , cj = Math.round(ref[1] / h3);
  for (let j = cj - 9; j <= cj + 9; j++) for (let i = ci - 12; i <= ci + 12; i++) {
    if (!minor && thMod(7 * i + 4 * j) !== thMod(root)) continue; if (minor && thMod(7 * i + 4 * j + 4) !== thMod(root)) continue;
    const vs = minor ? [P(i + 1, j), P(i, j + 1), P(i + 1, j + 1)] : [P(i, j), P(i + 1, j), P(i, j + 1)], c = [(vs[0][0] + vs[1][0] + vs[2][0]) / 3, (vs[0][1] + vs[1][1] + vs[2][1]) / 3], d = Math.hypot(c[0] - ref[0], c[1] - ref[1]);
    if (d < bd) { bd = d; best = { vs, c, i, j }; } }
  if (!TN.cam) TN.cam = best ? best.c.slice() : [0, 0];
  if (best && TN.last !== HM.sym) { TN.last = HM.sym; TN.trail.push({ c: best.c, root, minor, t: now }); if (TN.trail.length > 12) TN.trail.shift(); }
  if (best) { const k = 1 - Math.exp(-dt * 2.4); TN.cam[0] += (best.c[0] - TN.cam[0]) * k; TN.cam[1] += (best.c[1] - TN.cam[1]) * k; }
  const X0 = cx - TN.cam[0], Y0 = cy - TN.cam[1], scr = (i, j) => { const p = P(i, j); return [X0 + p[0], Y0 + p[1]]; };
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 0, W, H);
  const j0 = Math.floor((TN.cam[1] - H / 2) / h3) - 2, j1 = Math.ceil((TN.cam[1] + H / 2) / h3) + 2, iR = j => [Math.floor((TN.cam[0] - W / 2) / s - j / 2) - 2, Math.ceil((TN.cam[0] + W / 2) / s - j / 2) + 2];
  const scale = (S.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]).map(x => thMod(x + S.key)), inScale = pc => scale.includes(pc);
  // the key's territory: every triangle whose three notes are all in the key
  for (let j = j0; j <= j1; j++) for (let i = iR(j)[0]; i <= iR(j)[1]; i++) for (const up of [true, false]) {
    const pcs = thTriPcs(i, j, up); if (!pcs.every(inScale)) continue; const vs = up ? [scr(i, j), scr(i + 1, j), scr(i, j + 1)] : [scr(i + 1, j), scr(i, j + 1), scr(i + 1, j + 1)];
    if (vs[0][0] < -s * 2 || vs[0][0] > W + s * 2 || vs[0][1] < -s * 2 || vs[0][1] > H + s * 2) continue; g.beginPath(); g.moveTo(vs[0][0], vs[0][1]); g.lineTo(vs[1][0], vs[1][1]); g.lineTo(vs[2][0], vs[2][1]); g.closePath(); g.fillStyle = thCol(S.key, 60, .055); g.fill(); }
  // the lattice
  g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.1)'; g.beginPath();
  for (let j = j0; j <= j1; j++) for (let i = iR(j)[0]; i <= iR(j)[1]; i++) { const a = scr(i, j), b = scr(i + 1, j), c = scr(i, j + 1), d = scr(i - 1, j + 1); if (a[1] < -s || a[1] > H + s) continue; g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); g.moveTo(a[0], a[1]); g.lineTo(d[0], d[1]); }
  g.stroke();
  // the line the chords have drawn across it
  if (TN.trail.length > 1) { g.lineJoin = 'round'; for (let n = 1; n < TN.trail.length; n++) { const a = TN.trail[n - 1], b = TN.trail[n], age = n / TN.trail.length; g.strokeStyle = thCol(b.root, 66, .12 + .6 * age); g.lineWidth = (1.5 + 3 * age) * thSc(W, H); g.beginPath(); g.moveTo(X0 + a.c[0], Y0 + a.c[1]); g.lineTo(X0 + b.c[0], Y0 + b.c[1]); g.stroke(); } }
  // the chord now: its triangle, filled and glowing
  if (best) { const v = best.vs.map(p => [X0 + p[0], Y0 + p[1]]); g.beginPath(); g.moveTo(v[0][0], v[0][1]); g.lineTo(v[1][0], v[1][1]); g.lineTo(v[2][0], v[2][1]); g.closePath(); g.save(); g.shadowColor = thCol(root, 60, .9); g.shadowBlur = 26 + 14 * pulse; g.fillStyle = thCol(root, 56, .55); g.fill(); g.restore(); g.strokeStyle = thCol(root, 80, .95); g.lineWidth = 2.4; g.stroke(); }
  // the notes
  for (let j = j0; j <= j1; j++) for (let i = iR(j)[0]; i <= iR(j)[1]; i++) {
    const pc = thMod(7 * i + 4 * j), [x, y] = scr(i, j); if (x < -s || x > W + s || y < -s || y > H + s) continue; const v = chroma[pc], inCh = ch && ch.pcs.includes(pc), r = s * (.1 + .12 * v + (inCh ? .05 : 0));
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = v > .05 || inCh ? thCol(pc, 66, .35 + .6 * Math.max(v, inCh ? .5 : 0)) : inScale(pc) ? 'rgba(255,255,255,.34)' : 'rgba(255,255,255,.14)'; g.fill();
    if (s > 36 && (inScale(pc) || v > .05 || inCh)) hmText(g, pcName(pc), x, y - r - 4, Math.round(s * .24), inCh ? '#fff' : 'rgba(255,255,255,.55)', 'center', 700);
  }
  if (HM.vm != null && HM.vOn) { const pc = thMod(Math.round(HM.vm)); for (let j = j0; j <= j1; j++) for (let i = iR(j)[0]; i <= iR(j)[1]; i++) if (thMod(7 * i + 4 * j) === pc) { const [x, y] = scr(i, j); if (x > 0 && x < W && y > 0 && y < H) { g.strokeStyle = 'rgba(255,214,102,.95)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, s * .26, 0, 7); g.stroke(); } } }
  const fz = hmFz(W, H, 26); hmText(g, HM.sym || '—', 16, H - 16, fz, '#fff', 'left', 800);
  if (H > 260) hmText(g, 'across: a fifth · up-right: a major third · up-left: a minor third · every triangle is a chord', 16, H - 16 - fz - 6, hmFz(W, H, 13), 'rgba(255,255,255,.34)', 'left', 500);
}
HM_DRAW.wheel = thWheel; HM_DRAW.tonnetz = thTonnetz;
bus.on('song', () => { THX.seed = null; });
