/* ============================================================
   Part 54 · CONCERT — a lighting rig that listens
   One visual (Visuals ▸ Concert, and the Stage) built like a touring show rather than a screen saver. The pieces:
     · part 56 — the brain: one musical clock, the show designs, the cues, the comfort limiter (three flashes a second at most)
     · part 57 — the lasers: eight patterns that combine, every angle a function of the bar
     · part 58 — the layers: stage, haze, LED wall, moving heads, floor lights, sparks, your pictures, the blinder
     · part 59 — the Show setup console (the Stage tab) and your pictures
   This part keeps what is shared by the lenses:
     · the band's drum hits, scheduled on the audio clock (lxHit), so the syncopation of the groove (the ghost notes, the off-beat hats) is what you see
     · harmony: valence (major / minor) and tension of each chord, steps round the circle of fifths, roman numerals, what comes next and why
     · three lenses: Perform (calm and big), Teach (the circle of fifths as a lit floor ring, roman numerals, what is coming next, and why it pulls),
       Sky (every chord you play becomes a star and every move a line: the session as a constellation, savable as a poster)
   Nothing is loaded from anywhere and nothing leaves the device.
   ============================================================ */
VMODES.splice(1, 0, ['concert', 'Concert']);   /* Hex Resonance stays first: it is the default look */
const lxHsl = (h, s, l, a) => `hsla(${(((h % 360) + 360) % 360) | 0},${Math.round(clamp(s, 0, 100))}%,${Math.round(clamp(l, 0, 100))}%,${clamp(a == null ? 1 : a, 0, 1).toFixed(3)})`;
const LX_LENSES = [['perform', 'Perform'], ['teach', 'Teach'], ['sky', 'Sky']];
const LX = {
  q: [], kick: 0, snare: 0, hat: 0, perc: 0, tom: 0, onset: 0, note: 0, strobe: 0, drop: 0, build: 0, strobeReq: false, lastStrobe: -1e9, chase: 0, pbSeq: 0,
  e: 0, v: 0, tn: 0, br: .4, hue: 38, ph: 0, sec: '', kind: 'ambient', int: .3, n: 4, pat: 'fan', sym: null, symT: 0, info: null, prog: null, pal: null,
  beams: Array.from({ length: 12 }, () => ({ ang: 0, I: 0, imp: 0, on: 0 })), pars: Array.from({ length: 8 }, () => ({ I: 0 })), eq: new Float32Array(56), parts: [],
  mesh: null, fog: null, ghost: null, band: null, W: 1280, H: 720, last: 0, beat: 0, bar: 0, barIdx: 0, lastPresent: 0,
  sky: { nodes: new Map(), edges: new Map(), last: null, moves: 0, dust: null, lastEdge: '', lastT: 0 }
};
/** section kinds → the show's program: intensity, beams on, movement, haze, lasers, confetti, strobe, LED wall */
const LX_PROG = {
  intro: { int: .32, n: 3, pats: ['converge'], haze: 1, laser: 0, conf: 0, strobe: 0, wall: .25, pars: .5 },
  verse: { int: .46, n: 5, pats: ['fan', 'sweep'], haze: .85, laser: 0, conf: 0, strobe: 0, wall: .4, pars: .7 },
  pre: { int: .66, n: 8, pats: ['chase', 'fan'], haze: .8, laser: 0, conf: 0, strobe: 0, wall: .55, pars: .9 },
  chorus: { int: .95, n: 12, pats: ['fan', 'sweep', 'cross', 'sweep'], haze: .7, laser: 1, conf: 1, strobe: 1, wall: .75, pars: 1 },
  bridge: { int: .38, n: 4, pats: ['cross', 'converge'], haze: 1, laser: 0, conf: 0, strobe: 0, wall: .3, pars: .5 },
  solo: { int: .82, n: 6, pats: ['spot', 'converge'], haze: .8, laser: 0, conf: .4, strobe: 0, wall: .5, pars: .8 },
  outro: { int: .3, n: 4, pats: ['fan'], haze: 1, laser: 0, conf: 0, strobe: 0, wall: .2, pars: .4 },
  ambient: { int: .3, n: 4, pats: ['fan', 'sweep'], haze: .9, laser: 0, conf: 0, strobe: 0, wall: .35, pars: .6 }
};
const lxKind = name => { const s = String(name || ''); return /pre[\s-]?chorus|build|lift/i.test(s) ? 'pre' : /chorus|hook|refrain|drop/i.test(s) ? 'chorus' : /bridge|break|middle/i.test(s) ? 'bridge' : /solo|instrumental/i.test(s) ? 'solo' : /intro/i.test(s) ? 'intro' : /outro|tag|coda|end/i.test(s) ? 'outro' : 'verse'; };

/* ---------- the band's drum hits, on the audio clock (called from drumStep in part 03) ---------- */
function lxHit(row, t, v) { LX.q.push({ t, row, v: v || 2 }); if (LX.q.length > 240) LX.q.splice(0, LX.q.length - 240); }
function lxFire(ev) {
  if (ev.type) return lxFireX(ev);
  const v = clamp((ev.v || 2) / 3, .3, 1), R = LX.R || LX_R1;
  if (ev.row === 0) LX.kick = Math.max(LX.kick, (.55 + .45 * v) * R.kick);
  else if (ev.row === 1) { LX.snare = Math.max(LX.snare, (.6 + .4 * v) * R.snare); if (R.snare > .2) LX.strobeReq = true; }
  else if (ev.row === 2 || ev.row === 3) { LX.hat = Math.max(LX.hat, (.5 + .5 * v) * R.hat); LX.chase += 1; }
  else if (ev.row === 4) LX.perc = 1;
  else { LX.tom = 1; LX.chase += 2; }
}
bus.on('onset', () => { LX.onset = 1; if (!(T.playing && S.band.drumsOn)) { LX.kick = Math.max(LX.kick, .5); LX.chase += 1; } });

/* ---------- harmony → colour, mood, roman numerals ---------- */
const LX_NUM_MAJ = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♯IV', 'V', '♭VI', 'VI', '♭VII', 'VII'], LX_NUM_MIN = ['I', '♭II', 'II', 'III', '♯III', 'IV', '♭V', 'V', 'VI', '♯VI', 'VII', '♯VII'];
function lxNumeral(sym) {
  const p = parseChord(sym); if (!p) return ''; const iv = ((p.root - S.key) % 12 + 12) % 12, set = S.minor ? LX_NUM_MIN : LX_NUM_MAJ; let n = set[iv];
  const minor = p.iv.includes(3) && !p.iv.includes(4), dim = p.iv.includes(3) && p.iv.includes(6), aug = p.iv.includes(4) && p.iv.includes(8);
  if (minor || dim) n = n.replace(/[IV]+/, m => m.toLowerCase());
  let suf = dim ? (p.iv.includes(9) ? '°7' : p.iv.includes(10) ? 'ø7' : '°') : aug ? '+' : ''; if (!suf) { if (p.iv.includes(11)) suf = 'maj7'; else if (p.iv.includes(10)) suf = '7'; else if (p.iv.includes(2) && !p.iv.includes(3) && !p.iv.includes(4)) suf = 'sus2'; else if (p.iv.includes(5) && !p.iv.includes(4) && !p.iv.includes(3)) suf = 'sus4'; }
  return n + suf;
}
/** valence (−1 sad … +1 bright) and tension (0..1) of one chord, from its notes */
function lxQual(p) {
  if (!p) return { val: 0, ten: 0 }; const iv = p.iv, has = x => iv.includes(x); let val = 0, ten = .08;
  if (has(3) && has(6)) { val = -.5; ten = has(9) ? .85 : .75; } else if (has(4) && has(8)) { val = .1; ten = .6; } else if (has(3)) { val = -.38; ten = .12; } else if (has(4)) { val = .32; ten = .1; } else { val = 0; ten = .38; }
  if (has(10) && has(4)) ten += .3; if (has(10) && has(3)) ten += .08; if (has(11)) { val += .12; ten += .08; } if (has(2) && !has(3) && !has(4)) ten += .1;
  return { val: clamp(val, -1, 1), ten: clamp(ten, 0, 1) };
}
/** steps round the circle of fifths from the song's home chord, −5…+6 (V is +1, IV is −1) */
function lxFifths(root) { const rel = ((root - S.key) % 12 + 12) % 12, fi = (rel * 7) % 12; return fi > 6 ? fi - 12 : fi; }
const lxHueOf = fs => (S.minor ? 262 : 38) + fs * 30;

/* ---------- what is coming: the next few chords from the playhead (or the cursor) ---------- */
function lxUpcoming(n) {
  const bars = barsCache(), sp = spb(); if (!bars.length) return []; const ph = T.playing && E.ctx ? playheadSlot() : T.cursor, bi0 = clamp(Math.floor(Math.max(0, ph) / sp), 0, bars.length - 1), sib = Math.max(0, ph) - bi0 * sp;
  const out = []; for (let k = 0; k < 10 && out.length < n; k++) {
    const bi = (bi0 + k) % bars.length, cs = barChords(bars[bi].bar), m = Math.max(1, cs.length); let from = 0; if (k === 0) from = Math.min(m - 1, Math.floor(sib / (sp / m)));
    for (let c = from; c < cs.length && out.length < n; c++) if (cs[c] && (!out.length || out[out.length - 1].sym !== cs[c] || k > 0)) out.push({ sym: cs[c], bars: k, section: bars[bi].sec.name });
  }
  return out;
}
/** one line of why the next chord pulls the way it does */
function lxCaption(cur, next) {
  const a = parseChord(cur), b = parseChord(next); if (!a || !b) return ''; const ia = ((a.root - S.key) % 12 + 12) % 12, ib = ((b.root - S.key) % 12 + 12) % 12, d = (ib - ia + 12) % 12, q = lxQual(a);
  if (ib === 0 && ia === 7) return 'Dominant → home: the strongest resolution';
  if (ib === 0 && ia === 5) return 'Plagal: the “amen” cadence';
  if (ib === 0 && ia === 11) return 'Leading tone → home';
  if (ib === 0) return 'Coming home';
  if (ia === 0 && ib === 7) return 'Leaving home for the dominant';
  if (ia === 0) return 'Stepping away from home';
  if (d === 5) return 'Falling fifth: the pull most songs are built on';
  if (d === 7) return 'Rising fifth: lifts the mood';
  if (q.ten > .5) return 'A tension chord: it wants to resolve';
  if (d === 3 || d === 9) return 'A third apart: the colour changes, the key does not';
  if (d === 2 || d === 10) return 'Step by step: a stepwise move';
  return 'A shift of ' + d + ' semitone' + (d === 1 ? '' : 's');
}

/* ---------- the per-frame brain is in part 56, the lasers in 57, the layers (stage, haze, wall, heads, sparks, strobe) in 58 ---------- */
function lxMeshCanvas(key, W, H, div) { const w = Math.max(48, Math.ceil(W / div)), h = Math.max(32, Math.ceil(H / div)); let c = LX[key]; if (!c || c.width !== w || c.height !== h) { c = LX[key] = document.createElement('canvas'); c.width = w; c.height = h; } return c; }

/* ---------- Teach lens: the circle of fifths as a lit floor ring, what is coming, and why ---------- */
function lxRing(g, W, H, cx, cy, rx) {
  const ry = rx * .4, pal = LX.pal, pc = LX.sym ? parseChord(LX.sym) : null, key = S.key, scl = SCALES[S.scale] || SCALES['Major (Ionian)'], inKey = new Set(scl.map(i => (key + i) % 12)), cur = pc ? new Set(pc.pcs) : new Set(), nx = LX.info && LX.info.next ? parseChord(LX.info.next) : null;
  const pos = k => { const a = -Math.PI / 2 + k * Math.PI / 6; return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, s: .78 + .22 * (Math.sin(a) + 1) / 2, a }; }, idxOf = r => (((r - key) % 12 + 12) % 12 * 7) % 12;
  g.save(); g.lineWidth = Math.max(1, H * .002); g.strokeStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.stroke(); g.beginPath(); g.ellipse(cx, cy, rx * 1.12, ry * 1.12, 0, 0, 7); g.strokeStyle = 'rgba(255,255,255,.06)'; g.stroke();
  const pl = g.createRadialGradient(cx, cy, 0, cx, cy, rx * 1.2); pl.addColorStop(0, lxHsl(pal.h[0], 70, 50, .16 + .1 * LX.kick)); pl.addColorStop(1, lxHsl(pal.h[0], 70, 50, 0)); g.fillStyle = pl; g.fillRect(cx - rx * 1.3, cy - ry * 1.6, rx * 2.6, ry * 3.2);
  if (pc) { const pts = pc.pcs.map(p => pos(idxOf(p))); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.fillStyle = lxHsl(pal.h[0], 80, 55, .2 + .15 * LX.kick); g.fill(); g.strokeStyle = lxHsl(pal.h[0], 80, 70, .55); g.lineWidth = Math.max(1.5, H * .003); g.stroke(); }
  if (pc) { const a = pos(idxOf(pc.root)), t0 = pos(0); g.strokeStyle = lxHsl(lerp(pal.h[0], 0, LX.tn), 90, 62, .15 + .5 * LX.tn); g.lineWidth = Math.max(1, H * .002) + LX.tn * H * .006; g.setLineDash([H * .01, H * .008]); g.beginPath(); g.moveTo(t0.x, t0.y); g.lineTo(a.x, a.y); g.stroke(); g.setLineDash([]); }
  if (pc && nx) { const a = pos(idxOf(pc.root)), b = pos(idxOf(nx.root)), mx = (a.x + b.x) / 2 * .55 + cx * .45, my = (a.y + b.y) / 2 * .55 + cy * .45, gr = g.createLinearGradient(a.x, a.y, b.x, b.y); gr.addColorStop(0, lxHsl(pal.h[0], 90, 70, .9)); gr.addColorStop(1, lxHsl(pal.h[2], 90, 70, .35)); g.strokeStyle = gr; g.lineWidth = Math.max(2, H * .0045); g.setLineDash([H * .022, H * .012]); g.lineDashOffset = -LX.ph * H * .1; g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo(mx, my, b.x, b.y); g.stroke(); g.setLineDash([]); }
  const live = AN.midi != null && AN.active ? AN.midi % 12 : -1, fz = Math.round(H * .03);
  for (let k = 0; k < 12; k++) {
    const p = pos(k), pcn = (key + k * 7) % 12, ink = inKey.has(pcn), on = cur.has(pcn), isRoot = pc && pc.root === pcn, r = H * .026 * p.s * (on ? 1.25 : 1) * (isRoot ? 1.18 : 1), hue = lxHueOf(k > 6 ? k - 12 : k);
    if (on) { const gl = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.2); gl.addColorStop(0, lxHsl(hue, 90, 60, .6 + .3 * LX.kick)); gl.addColorStop(1, lxHsl(hue, 90, 60, 0)); g.fillStyle = gl; g.fillRect(p.x - r * 3.2, p.y - r * 3.2, r * 6.4, r * 6.4); }
    g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fillStyle = on ? lxHsl(hue, 85, 58, .95) : ink ? lxHsl(hue, 55, 44, .95) : 'rgba(20,24,30,.7)'; g.fill(); g.lineWidth = Math.max(1.5, H * .0025); g.strokeStyle = on ? 'rgba(255,255,255,.9)' : ink ? lxHsl(hue, 60, 62, .7) : 'rgba(255,255,255,.14)'; g.stroke();
    if (pcn === live) { g.beginPath(); g.arc(p.x, p.y, r * 1.55, 0, 7); g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = Math.max(2, H * .004); g.stroke(); }
    g.font = `800 ${Math.round(fz * (on ? 1.02 : .9) * p.s)}px ui-monospace,Menlo,Consolas,monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = on ? '#fff' : ink ? 'rgba(255,255,255,.88)' : 'rgba(255,255,255,.38)'; g.fillText(pcName(pcn, keyUsesFlats(key, S.minor)), p.x, p.y + 1);
    if (k === 0) { g.font = `800 ${Math.round(H * .018)}px ui-monospace,Menlo,monospace`; g.fillStyle = lxHsl(hue, 80, 75, .9); g.fillText('HOME', p.x, p.y - r * 1.9); }
  }
  g.restore(); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}
function lxCard(g, W, H, x, y, w) {
  const up = lxUpcoming(5), pal = LX.pal, u = H, cur = up[0], mono = 'ui-monospace,Menlo,Consolas,monospace', pad = u * .02; if (!cur) return; const nxt = up[1], hue = lxHueOf(lxFifths((parseChord(cur.sym) || { root: S.key }).root));
  g.save(); g.fillStyle = 'rgba(8,10,16,.62)'; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, u * .62, u * .02) : g.rect(x, y, w, u * .62); g.fill(); g.fillStyle = lxHsl(hue, 85, 60, .95); g.fillRect(x, y + u * .02, u * .006, u * .58);
  g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.font = `800 ${Math.round(u * .015)}px ui-monospace,Menlo,monospace`; g.fillStyle = 'rgba(255,255,255,.55)'; const inf = LX.info || {}; g.fillText('NOW' + (inf.sec && inf.nBars ? '  ·  ' + inf.sec.toUpperCase() + ' ' + inf.barIn + '/' + inf.nBars : ''), x + pad * 1.4, y + u * .045, w - pad * 2.4);
  g.font = `800 ${Math.round(u * .115)}px ${mono}`; g.fillStyle = '#fff'; g.fillText(cur.sym, x + pad * 1.4, y + u * .15, w * .62); g.font = `800 ${Math.round(u * .05)}px ${mono}`; g.fillStyle = lxHsl(hue, 90, 72, 1); g.textAlign = 'right'; g.fillText(lxNumeral(cur.sym), x + w - pad, y + u * .15); g.textAlign = 'left';
  g.font = `700 ${Math.round(u * .015)}px ui-monospace,Menlo,monospace`; g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText('NEXT', x + pad * 1.4, y + u * .215);
  up.slice(1, 5).forEach((c, i) => { const cy = y + u * .235 + i * u * .062, h2 = lxHueOf(lxFifths((parseChord(c.sym) || { root: S.key }).root)); g.fillStyle = lxHsl(h2, 70, 45, .28 - i * .04); g.beginPath(); g.roundRect ? g.roundRect(x + pad * 1.4, cy, w - pad * 2.4, u * .052, u * .012) : g.rect(x + pad * 1.4, cy, w - pad * 2.4, u * .052); g.fill();
    g.font = `800 ${Math.round(u * .03)}px ${mono}`; g.fillStyle = `rgba(255,255,255,${(.95 - i * .13).toFixed(2)})`; g.fillText(c.sym, x + pad * 2.2, cy + u * .037); g.textAlign = 'right'; g.font = `700 ${Math.round(u * .022)}px ${mono}`; g.fillStyle = lxHsl(h2, 90, 74, .9 - i * .12); g.fillText(lxNumeral(c.sym) + (c.bars ? '  +' + c.bars : ''), x + w - pad * 1.6, cy + u * .035); g.textAlign = 'left'; });
  if (nxt) { const cap = lxCaption(cur.sym, nxt.sym); if (cap) { g.font = `700 ${Math.round(u * .0195)}px system-ui,-apple-system,Segoe UI,sans-serif`; g.fillStyle = 'rgba(255,255,255,.82)'; g.fillText(cap, x + pad * 1.4, y + u * .58, w - pad * 2.4); } }
  g.restore();
}
function lxMeters(g, W, H, x, y) {
  const u = H, rows = [['ENERGY', LX.e, 0], ['MOOD', (LX.v + 1) / 2, 1], ['TENSION', LX.tn, 0]], w = u * .22; g.save(); g.textBaseline = 'middle'; g.textAlign = 'left';
  g.font = `800 ${Math.round(u * .018)}px ui-monospace,Menlo,monospace`; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(pcName(S.key, keyUsesFlats(S.key, S.minor)).toUpperCase() + (S.minor ? ' MINOR' : ' MAJOR') + '  ·  ' + Math.round(S.bpm) + ' BPM', x, y);
  rows.forEach(([n, v, c], i) => { const yy = y + u * .04 + i * u * .034; g.font = `800 ${Math.round(u * .014)}px ui-monospace,Menlo,monospace`; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(n, x, yy); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x + u * .075, yy - u * .005, w, u * .01);
    const gr = g.createLinearGradient(x + u * .075, 0, x + u * .075 + w, 0); gr.addColorStop(0, lxHsl(c ? 215 : LX.pal.h[0], 80, 58, 1)); gr.addColorStop(1, lxHsl(c ? 38 : LX.pal.h[1], 90, 60, 1)); g.fillStyle = gr; g.fillRect(x + u * .075, yy - u * .005, w * clamp(v, 0, 1), u * .01); if (c) { g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(x + u * .075 + w / 2 - 1, yy - u * .008, 2, u * .016); } });
  g.restore();
}

/* ---------- Sky lens: the session as a constellation ---------- */
function lxSkyAdd(sym) {
  const sk = LX.sky, p = parseChord(sym); if (!p) return; let n = sk.nodes.get(sym); if (!n) sk.nodes.set(sym, n = { n: 0, born: performance.now() }); n.n++; n.t = performance.now();
  if (sk.last && sk.last !== sym) { const key = sk.last + '>' + sym; sk.edges.set(key, (sk.edges.get(key) || 0) + 1); sk.lastEdge = key; sk.moves++; sk.lastT = performance.now(); } sk.last = sym;
}
function lxSkyClear() { LX.sky.nodes.clear(); LX.sky.edges.clear(); LX.sky.last = null; LX.sky.moves = 0; LX.sky.lastEdge = ''; }
/** the part of the picture a lens may draw in: clear of the lower third and the lyric line (null = all of it) */
function lxBandOf(H) { const b = LX.band; return b ? [b[0], b[1]] : [0, H]; }
/** the sky's oval: as wide as the picture allows within the band, with the circle of fifths stretched to fit */
function lxSkyGeom(W, H) { const bd = lxBandOf(H), R = (bd[1] - bd[0]) * .46; return { cx: W / 2, cy: (bd[0] + bd[1]) / 2, R, xs: clamp(W * .46 / R, 1.25, 1.95) }; }
function lxSkyPos(sym, W, H) {
  const gm = lxSkyGeom(W, H), p = parseChord(sym), fi = ((p.root - S.key) % 12 + 12) % 12 * 7 % 12, minor = p.iv.includes(3) && !p.iv.includes(4), major = p.iv.includes(4) && !p.iv.includes(3), hs = (sym.length * 7 + sym.charCodeAt(sym.length - 1)) % 9;
  const a = -Math.PI / 2 + fi * Math.PI / 6 + (hs - 4) * .018, r = gm.R * ((major ? .8 : minor ? .5 : .66) + (hs % 3 - 1) * .045); return { x: gm.cx + Math.cos(a) * r * gm.xs, y: gm.cy + Math.sin(a) * r, fi };
}
function lxSky(g, W, H, t, still) {
  const sk = LX.sky, u = LX.U || H; if (!LX.sky.dust) { LX.sky.dust = Array.from({ length: 170 }, (_, i) => ({ x: ((i * 9301 + 49297) % 233280) / 233280, y: ((i * 7919 + 1237) % 104729) / 104729, s: .4 + ((i * 31) % 7) / 6, p: i })); }
  g.save(); sk.dust.forEach(d => { g.fillStyle = `rgba(255,255,255,${(.12 + .2 * (still ? .6 : Math.sin(t * .8 + d.p) * .5 + .5)).toFixed(2)})`; g.beginPath(); g.arc(d.x * W, d.y * H, d.s * (H / 900 + .3), 0, 7); g.fill(); });
  const gm = lxSkyGeom(W, H), bcy = gm.cy; g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; [.5, .66, .8].forEach(f => { g.beginPath(); g.ellipse(gm.cx, gm.cy, gm.R * f * gm.xs, gm.R * f, 0, 0, 7); g.stroke(); });
  g.globalCompositeOperation = 'lighter'; const now = performance.now();
  sk.edges.forEach((c, key) => { const [a, b] = key.split('>'), pa = lxSkyPos(a, W, H), pb = lxSkyPos(b, W, H), mx = (pa.x + pb.x) / 2 * .6 + W / 2 * .4, my = (pa.y + pb.y) / 2 * .6 + bcy * .4, hot = key === sk.lastEdge ? clamp(1 - (now - sk.lastT) / 2500, 0, 1) : 0, hue = lxHueOf(pa.fi > 6 ? pa.fi - 12 : pa.fi);
    g.strokeStyle = lxHsl(hue, 80, 68, clamp(.12 + .16 * c + hot * .5, 0, .9)); g.lineWidth = Math.max(1, u * (.0016 + .0012 * Math.min(c, 6))) + hot * u * .003; g.beginPath(); g.moveTo(pa.x, pa.y); g.quadraticCurveTo(mx, my, pb.x, pb.y); g.stroke(); });
  sk.nodes.forEach((n, sym) => { const p = lxSkyPos(sym, W, H), hue = lxHueOf(p.fi > 6 ? p.fi - 12 : p.fi), cur = sym === sk.last, r = u * (.016 + .007 * Math.sqrt(n.n)) * (cur ? 1.5 : 1) * (still ? 1 : .92 + .08 * Math.sin(t * 3 + p.fi)), gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 5);
    gr.addColorStop(0, lxHsl(hue, 90, 75, .95)); gr.addColorStop(.25, lxHsl(hue, 90, 60, .4)); gr.addColorStop(1, lxHsl(hue, 90, 55, 0)); g.fillStyle = gr; g.fillRect(p.x - r * 5, p.y - r * 5, r * 10, r * 10); g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(p.x, p.y, r * .5, 0, 7); g.fill(); });
  g.globalCompositeOperation = 'source-over'; g.textAlign = 'center'; sk.nodes.forEach((n, sym) => { const p = lxSkyPos(sym, W, H); g.font = `800 ${Math.round(u * (sym === sk.last ? .042 : .032))}px ui-monospace,Menlo,monospace`; g.fillStyle = sym === sk.last ? '#fff' : 'rgba(255,255,255,.78)'; g.fillText(sym, p.x, p.y - u * (sym === sk.last ? .05 : .042)); });
  g.textAlign = 'left'; g.font = `800 ${Math.round(u * .024)}px ui-monospace,Menlo,monospace`; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText('SESSION SKY', u * .03, u * .05); g.font = `600 ${Math.round(u * .02)}px system-ui,sans-serif`; g.fillStyle = 'rgba(255,255,255,.55)';
  g.fillText(sk.nodes.size ? sk.nodes.size + ' chords · ' + sk.moves + ' moves · lines that repeat glow brighter' : 'Play or press Play: every chord becomes a star and every move a line', u * .03, u * .078); g.restore();
}
/** save the sky as a poster (PNG) */
function lxSkySave() {
  const keepU = LX.U, keepB = LX.band; LX.U = 1200; LX.band = null; const c = document.createElement('canvas'); c.width = 1800; c.height = 1200; const g = c.getContext('2d'), pal = LX.pal || { h: [38, 10, 82, 190], sat: 70, lit: 52 };
  const bg = g.createLinearGradient(0, 0, 0, c.height); bg.addColorStop(0, lxHsl(pal.h[0] + 12, 55, 5)); bg.addColorStop(1, lxHsl(pal.h[2], 60, 10)); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  const hz = g.createRadialGradient(c.width / 2, c.height * .5, 0, c.width / 2, c.height * .5, c.width * .5); hz.addColorStop(0, lxHsl(pal.h[0], 70, 40, .22)); hz.addColorStop(1, lxHsl(pal.h[0], 70, 40, 0)); g.fillStyle = hz; g.fillRect(0, 0, c.width, c.height);
  lxSky(g, c.width, c.height, 0, true); LX.U = keepU; LX.band = keepB; g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '600 22px system-ui,sans-serif'; g.textAlign = 'right'; g.fillText((S.title || 'Untitled') + ' · ' + pcName(S.key) + (S.minor ? ' minor' : ' major') + ' · ' + new Date().toLocaleDateString(), c.width - 40, c.height - 36);
  c.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'the-daily-studio-sky.png'; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }, 'image/png');
}

/* ---------- the visual ---------- */
/** the band the Teach and Sky lenses draw in: below the top margin, above the lower third (or the one lyric line the HUD keeps) */
function lxMakeBand(W, H) {
  let y0 = H * .05, y1 = STG.hud === false && !pbOn() ? H * .95 : H * .9; const lr = pbLowerRect(W, H);
  if (lr) { if (lr.top) y0 = lr.y + lr.h + H * .025; else y1 = lr.y - H * .025; }
  return [y0, Math.max(y1, y0 + H * .3)];
}
function concertDraw(g, W, H, X) {
  LX.W = W; LX.H = H; LX.U = Math.max(H, Math.min(W * .42, H * 1.45)); LX.band = lxMakeBand(W, H); LX.D = lxResolve(X.o && X.o.show); lxUpdate(X.dt, X); const lens = CFG.lens || 'perform', dt = clamp(X.dt || .016, .001, .1), teach = lens === 'teach';
  if (lens === 'sky') { lxStage(g, W, H, .55, .5); lxHaze(g, W, H, .5, true); lxSky(g, W, H, VZ.t, false); lxVignette(g, W, H, .5); lxStrobe(g, W, H); if (!(X.o && X.o.stage)) lxGovMeasure(g.canvas, performance.now()); return; }
  lxPerform(g, W, H, X, dt, teach);
  if (teach) {
    const [y0, y1] = LX.band, bh = y1 - y0, tu = Math.min(LX.U, bh / .64), cw = Math.min(W * .28, tu * .62), rx = Math.min(W * .19, (bh * .5 - tu * .075) / .46);   // everything sized to the free band
    lxRing(g, W, tu, W * .235, y0 + bh * .52, rx); lxCard(g, W, tu, W - cw - W * .035, y0 + bh * .02, cw); lxMeters(g, W, tu, W * .03, y0 + tu * .02);
  }
  lxStrobe(g, W, H); lxVignette(g, W, H, .55); if (X.o && X.o.stage && STG.hud !== false && !teach) lxScrim(g, W, H);
  if (!(X.o && X.o.stage)) lxGovMeasure(g.canvas, performance.now());   // the stage measures its finished picture instead (part 13)
}
/** the lens switch (Visuals bar) */
function lxLensBar() {
  const bar = h('div', { class: 'seg', id: 'lxLens', role: 'group', 'aria-label': 'Concert lens', title: 'Perform: big and calm · Teach: the circle of fifths, roman numerals and what comes next · Sky: your session as a constellation' },
    LX_LENSES.map(([k, n]) => h('button', { 'data-lens': k, class: (CFG.lens || 'perform') === k ? 'on' : '', onclick: () => lxSetLens(k) }, n)));
  const save = h('button', { class: 'btn sm', id: 'lxSkySave', title: 'Save the session sky as a picture', style: { display: (CFG.lens === 'sky') ? '' : 'none' }, onclick: () => lxSkySave() }, '⤓ Save sky'), clr = h('button', { class: 'btn sm', id: 'lxSkyClear', title: 'Clear the sky and start a new one', style: { display: (CFG.lens === 'sky') ? '' : 'none' }, onclick: () => { lxSkyClear(); toast('Sky cleared.', 'ok'); } }, 'New sky');
  return h('div', { class: 'row', style: { gap: '6px' } }, bar, save, clr, sgdBarButton());
}
function lxSetLens(k) {
  CFG.lens = LX_LENSES.some(l => l[0] === k) ? k : 'perform'; saveCfg(); document.querySelectorAll('#lxLens [data-lens]').forEach(b => b.classList.toggle('on', b.dataset.lens === CFG.lens));
  ['lxSkySave', 'lxSkyClear'].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = CFG.lens === 'sky' ? '' : 'none'; }); const sel = document.getElementById('pb_lens'); if (sel) sel.value = CFG.lens;
}
