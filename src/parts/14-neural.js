/* ============================================================
   Part 14 · NEURAL MAP — an interactive 3-D network that learns the song as it plays.
   Spectrum bands → pitch classes → chords → harmonic function / sections → key & tension,
   plus a growing embedding cloud of every note, and a Markov "next chord" predictor learned online.
   ============================================================ */
VMODES.push(['neural', 'Neural Map']);
const NG = Object.assign({ layout: 'net', color: 'pc', edges: true, labels: true, links: true, floor: true, ghosts: true, rot: true, ev: true, trans: true, pulses: true, yaw: -.6, pit: .38, zoom: 1, px: 0, py: 0 }, CFG.neural || {});
const saveNG = () => { CFG.neural = { layout: NG.layout, color: NG.color, edges: NG.edges, labels: NG.labels, links: NG.links, floor: NG.floor, ghosts: NG.ghosts, rot: NG.rot, ev: NG.ev, trans: NG.trans, pulses: NG.pulses }; saveCfg(); };
const NR = { nodes: new Map(), edges: [], events: [], seq: [], trans: new Map(), pulses: [], lastSlot: null, sym: '', symT: 0, hover: null, sel: null, cut: 1, last: 0, tickAt: -1, sections: [], hit: 0, miss: 0, pred: null, key: { root: 9, minor: true }, tension: 0, curChord: null, curSec: null, nBands: 24, evSeq: 0, dirty: true, fd: null, t0: performance.now(), pos: [] };
const FIFTH = pc => (pc * 7) % 12;                    // position on the circle of fifths
const FANG = pc => FIFTH(pc) / 12 * Math.PI * 2 - Math.PI / 2;
const NGPROJ = [];

/* ---------- colour ---------- */
const light_ = () => CFG.theme === 'light';
const pcCol = (pc, a = 1, l) => `hsla(${(FIFTH(pc) * 30 + 200) % 360},${light_() ? 70 : 85}%,${l || (light_() ? 42 : 62)}%,${a})`;
const ramp = (u, a = 1) => { u = clamp(u, 0, 1); const hh = 52 + u * 238, l = light_() ? 42 : 60 - u * 8; return `hsla(${hh},85%,${l}%,${a})`; };   // yellow → purple, like the reference plates
const hashHue = s => { let x = 7; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) % 360; return x; };
function evColor(e, a = 1) {
  switch (NG.color) {
    case 'time': return ramp(1 - e.prog, a);
    case 'section': return `hsla(${hashHue(e.sec || '-')},75%,${light_() ? 42 : 62}%,${a})`;
    case 'loud': return ramp(1 - e.vel, a);
    case 'octave': return ramp(1 - clamp((e.midi - 38) / 40, 0, 1), a);
    case 'quality': { const q = (parseChord(e.chord) || {}).q || ''; return `hsla(${q === 'm' || q === 'm7' ? 280 : q === '7' ? 30 : q === '' ? 190 : q.includes('dim') ? 350 : 110},75%,${light_() ? 42 : 62}%,${a})`; }
    default: return pcCol(e.pc, a);
  }
}

/* ---------- harmonic function ---------- */
function funcOf(sym) {
  const c = parseChord(sym); if (!c) return 'O'; const d = (c.root - NR.key.root + 12) % 12;
  const T = NR.key.minor ? [0, 3, 8] : [0, 4, 9], Sd = NR.key.minor ? [5, 2] : [5, 2], D = NR.key.minor ? [7, 10, 11] : [7, 11];
  return T.includes(d) ? 'T' : Sd.includes(d) ? 'S' : D.includes(d) ? 'D' : 'O';
}
const FN = { T: 'Tonic', S: 'Subdominant', D: 'Dominant', O: 'Colour' };

/* ---------- graph construction (rebuilt when the song changes; existing node state is kept) ---------- */
function ngNode(id, layer, kind, label, o) { let n = NR.nodes.get(id); if (!n) { n = Object.assign({ id, layer, kind, label, p: [0, 0, 0], v: [0, 0, 0], tgt: [0, 0, 0], act: 0, seen: 0, firstIdx: -1, born: 0, count: 0, r: 1 }, o || {}); n.p = [(Math.random() - .5) * .5, (Math.random() - .5) * .5, (Math.random() - .5) * .5]; NR.nodes.set(id, n); } else { n.label = label; Object.assign(n, o || {}); } n.live = true; return n; }
function ngBuild() {
  NR.nodes.forEach(n => n.live = false); NR.edges = [];
  const key = AN.key && AN.key[0] && AN.key[0].r > .6 ? { root: AN.key[0].root, minor: AN.key[0].minor } : { root: S.key, minor: S.minor }; NR.key = key;
  for (let i = 0; i < NR.nBands; i++) { const f = 70 * Math.pow(6000 / 70, (i + .5) / NR.nBands); ngNode('b' + i, 0, 'band', f < 1000 ? Math.round(f) + ' Hz' : (f / 1000).toFixed(1) + 'k', { f, i, seen: 1, r: .55 }); }
  for (let pc = 0; pc < 12; pc++) ngNode('p' + pc, 1, 'pc', pcName(pc), { pc, r: 1.1 });
  const secs = [], chordSet = new Map(); S.sections.forEach(sec => { secs.push(sec); const seenHere = new Set(); sec.bars.forEach(b => barChords(b).forEach(sym => { if (!parseChord(sym)) return; if (!chordSet.has(sym)) chordSet.set(sym, new Map()); const m = chordSet.get(sym); m.set(sec.id, (m.get(sec.id) || 0) + 1); })); });
  NR.sections = secs;
  const liveSyms = new Set(); NR.nodes.forEach(n => { if (n.kind === 'chord' && n.seen) liveSyms.add(n.sym); });   // chords heard live that aren't in the song stay
  chordSet.forEach((m, sym) => ngNode('c:' + sym, 2, 'chord', sym, { sym, secs: m, r: 1.25 })); liveSyms.forEach(sym => { if (!chordSet.has(sym)) ngNode('c:' + sym, 2, 'chord', sym, { sym, secs: new Map(), r: 1.25 }); });
  ['T', 'S', 'D', 'O'].forEach(f => ngNode('f:' + f, 3, 'func', FN[f], { fn: f, seen: 1, r: 1.2 }));
  secs.forEach((sec, i) => ngNode('s:' + sec.id, 3, 'section', sec.name, { sec, si: i, r: 1.3 }));
  ngNode('k:key', 4, 'key', 'Key', { seen: 1, r: 1.7 }); ngNode('k:ten', 4, 'tension', 'Tension', { seen: 1, r: 1.2 });
  NR.nodes.forEach((n, id) => { if (!n.live) NR.nodes.delete(id); });
  const E_ = (a, b, w, kind) => { const A = NR.nodes.get(a), B = NR.nodes.get(b); if (A && B) NR.edges.push({ a: A, b: B, w, kind: kind || 'f' }); };
  for (let pc = 0; pc < 12; pc++) { const f0 = 440 * Math.pow(2, (pc - 9) / 12); for (let k = -3; k <= 5; k++) { const f = f0 * Math.pow(2, k); if (f < 70 || f > 6000) continue; const bi = clamp(Math.floor(Math.log(f / 70) / Math.log(6000 / 70) * NR.nBands), 0, NR.nBands - 1); if (!NR.edges.some(e => e.a.id === 'b' + bi && e.b.id === 'p' + pc)) E_('b' + bi, 'p' + pc, 1 / (1 + Math.abs(k) * .15)); } }
  NR.nodes.forEach(n => { if (n.kind !== 'chord') return; const c = parseChord(n.sym); if (!c) return; n.cp = c; n.fn = funcOf(n.sym); c.pcs.forEach(pc => E_('p' + pc, n.id, pc === c.root ? 1 : pc === c.bass ? .9 : .7)); E_(n.id, 'f:' + n.fn, 1); n.secs.forEach((cnt, sid) => E_(n.id, 's:' + sid, Math.min(1, .3 + cnt * .15))); });
  ['T', 'S', 'D', 'O'].forEach(f => E_('f:' + f, 'k:key', f === 'O' ? .4 : 1)); NR.nodes.forEach(n => { if (n.kind === 'chord') E_(n.id, 'k:ten', n.fn === 'D' ? 1 : n.fn === 'O' ? .8 : .35); });
  ngLayout(); NR.dirty = false;
}
bus.on('song', () => { NR.dirty = true; });

/* ---------- layout targets ---------- */
const QH = q => /dim/.test(q) ? .9 : /7/.test(q) && !/maj7/.test(q) ? .75 : /sus|add|9|11|13/.test(q) ? .55 : /maj/.test(q) ? .3 : /m/.test(q) ? -.25 : 0;
function ngLayout() {
  const L = NG.layout, XS = 2.6; const nodes = [...NR.nodes.values()], by = k => nodes.filter(n => n.kind === k);
  by('band').forEach(n => { const u = n.i / (NR.nBands - 1); n.t_net = [-2 * XS, (u - .5) * 6.4, Math.sin(u * Math.PI) * 1.1]; n.t_fif = [Math.cos(u * 8.4) * .55, (u - .5) * 3.4, Math.sin(u * 8.4) * .55]; });
  by('pc').forEach(n => { const k = FIFTH(n.pc); n.t_net = [-XS, ((k / 11) - .5) * 5.6, (k % 2 ? .7 : -.7)]; n.t_fif = [Math.cos(FANG(n.pc)) * 2.5, -.2, Math.sin(FANG(n.pc)) * 2.5]; });
  const ch = by('chord'); ch.forEach((n, i) => { const c = n.cp; if (!c) return; const k = FIFTH(c.root), u = k / 11; n.t_net = [0, (u - .5) * 6.2, QH(c.q) * 2.2]; n.t_fif = [Math.cos(FANG(c.root)) * (1.45 + QH(c.q) * .4), QH(c.q) * 1.6 + .6, Math.sin(FANG(c.root)) * (1.45 + QH(c.q) * .4)]; });
  by('func').forEach((n, i) => { n.t_net = [XS, 2.5 - i * .75, 0]; n.t_fif = [Math.cos(i * 1.57) * .8, 2.6, Math.sin(i * 1.57) * .8]; });
  const ss = by('section'); ss.forEach((n, i) => { const u = ss.length > 1 ? i / (ss.length - 1) : .5; n.t_net = [XS, -.9 - u * 2.4, 0]; n.t_fif = [Math.cos(i / ss.length * 6.28) * 1.5, 3.4, Math.sin(i / ss.length * 6.28) * 1.5]; });
  const kk = NR.nodes.get('k:key'), kt = NR.nodes.get('k:ten'); if (kk) { kk.t_net = [2 * XS, .9, 0]; kk.t_fif = [0, 4.1, 0]; } if (kt) { kt.t_net = [2 * XS, -1.2, 0]; kt.t_fif = [.9, 3.8, .3]; }
  nodes.forEach(n => { n.tgt = L === 'net' ? n.t_net : n.t_fif; });
}
function ngForce(dt) {
  const ns = [...NR.nodes.values()].filter(n => n.kind !== 'band');
  ns.forEach(n => { n.f = [-n.p[0] * .09, -n.p[1] * .09, -n.p[2] * .09]; });
  for (let i = 0; i < ns.length; i++)for (let j = i + 1; j < ns.length; j++) { const a = ns[i], b = ns[j], dx = a.p[0] - b.p[0], dy = a.p[1] - b.p[1], dz = a.p[2] - b.p[2], d2 = dx * dx + dy * dy + dz * dz + .05, f = .9 / d2, d = Math.sqrt(d2); for (let q = 0; q < 3; q++) { const u = (a.p[q] - b.p[q]) / d * f; a.f[q] += u; b.f[q] -= u; } }
  const spring = (a, b, w, L0) => { if (!a.f || !b.f) return; const dx = b.p[0] - a.p[0], dy = b.p[1] - a.p[1], dz = b.p[2] - a.p[2], d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-3, f = (d - L0) * .06 * w; [dx, dy, dz].forEach((x, q) => { const u = x / d * f; a.f[q] += u; b.f[q] -= u; }); };
  NR.edges.forEach(e => { if (e.kind === 'f' && e.a.kind !== 'band') spring(e.a, e.b, e.w, 1.4); });
  NR.trans.forEach((c, key) => { const [a, b] = key.split('>'), A = NR.nodes.get('c:' + a), B = NR.nodes.get('c:' + b); if (A && B) spring(A, B, Math.min(2.5, .5 + c * .35), 1.1); });
  ns.forEach(n => { for (let q = 0; q < 3; q++) { n.v[q] = (n.v[q] + n.f[q] * dt * 30) * .86; n.v[q] = clamp(n.v[q], -.6, .6); n.p[q] += n.v[q] * dt * 30; } });
}

/* ---------- capture: song + live note events (always on, cheap) ---------- */
function ngAddEvent(midi, vel, src, chord, sec, prog) {
  const pc = ((midi % 12) + 12) % 12; NR.events.push({ midi, pc, vel: clamp(vel, .1, 1), src, chord: chord || '', sec: sec || '', prog: prog == null ? ((performance.now() - NR.t0) / 90000) % 1 : prog, i: NR.evSeq++, jx: Math.random() - .5, jy: Math.random() - .5, jz: Math.random() - .5, born: performance.now() });
  if (NR.events.length > 2600) NR.events.shift(); const n = NR.nodes.get('p' + pc); if (n) { n.act = Math.max(n.act, vel); n.count++; if (!n.seen) { n.seen = 1; n.firstIdx = NR.evSeq; n.born = performance.now(); } }
  if (NG.pulses && NR.curChord) ngPulse('p' + pc, 'c:' + NR.curChord, vel);
}
function ngPulse(a, b, v) { const A = NR.nodes.get(a), B = NR.nodes.get(b); if (!A || !B) return; const e = NR.edges.find(x => x.a === A && x.b === B); if (e && NR.pulses.length < 160) NR.pulses.push({ e, t: 0, v, s: .9 + Math.random() * .5 }); }
function ngChordChange(sym, src) {
  if (!sym || !parseChord(sym)) return; const prev = NR.curChord;
  if (prev === sym) return; NR.curChord = sym;
  let n = NR.nodes.get('c:' + sym); if (!n) { ngBuildSoft(sym); n = NR.nodes.get('c:' + sym); }
  if (n) { n.act = 1; n.count++; if (!n.seen) { n.seen = 1; n.firstIdx = NR.evSeq; n.born = performance.now(); } }
  if (prev) { if (NR.pred) { NR.pred.top === sym ? NR.hit++ : NR.miss++; } const k = prev + '>' + sym; NR.trans.set(k, (NR.trans.get(k) || 0) + 1); }
  NR.seq.push(sym); if (NR.seq.length > 4000) NR.seq.shift(); NR.pred = ngPredict(sym);
  if (n && NG.pulses) { ngPulse('c:' + sym, 'f:' + (n.fn || 'O'), 1); NR.edges.filter(e => e.a === n && e.b.kind === 'section').forEach(e => { if (NR.curSec && e.b.id === 's:' + NR.curSec) NR.pulses.push({ e, t: 0, v: 1, s: 1 }); }); }
}
function ngBuildSoft(sym) { if (NR.nodes.has('c:' + sym)) return; ngNode('c:' + sym, 2, 'chord', sym, { sym, secs: new Map(), r: 1.25, seen: 1, firstIdx: NR.evSeq, born: performance.now() }); ngBuild(); }
function ngPredict(sym) {
  const row = []; NR.trans.forEach((c, k) => { const [a, b] = k.split('>'); if (a === sym) row.push([b, c]); }); if (!row.length) return null; const tot = row.reduce((s, r) => s + r[1], 0); row.sort((x, y) => y[1] - x[1]);
  return { from: sym, top: row[0][0], list: row.map(r => ({ sym: r[0], p: r[1] / tot })) };
}
function ngEntropy() { const rows = new Map(); NR.trans.forEach((c, k) => { const a = k.split('>')[0]; rows.set(a, (rows.get(a) || 0) + c); }); let H = 0, W = 0; NR.trans.forEach((c, k) => { const a = k.split('>')[0], p = c / rows.get(a); H += -c * Math.log2(p); W += c; }); return W ? H / W : 0; }

function ngCapture() {
  if (!E.ready) return;
  if (T.playing && E.ctx) {
    const sp = spb(), ph = playheadSlot(), total = Math.max(1, songSlots()), cur = Math.floor(ph);
    if (NR.lastSlot == null || cur < NR.lastSlot || cur - NR.lastSlot > 96) NR.lastSlot = cur - 1;
    for (let s = NR.lastSlot + 1; s <= cur; s++) {
      if (s < 0) continue; const bi = Math.floor(s / sp), sib = s - bi * sp, fb = barsCache()[bi]; if (!fb) continue; const cd = chordAt(bi, sib), prog = s / total, sec = fb.sec.name; NR.curSec = fb.sec.id;
      if (cd && cd.sym) {
        if (cd.rel === 0) {
          ngChordChange(cd.sym, 'song'); const c = parseChord(cd.sym), v = voicingFor(cd.sym);
          if (S.band.compOn && v) v.frets.forEach((f, i) => { if (f != null) ngAddEvent(S.tuning[i] + S.capo + f, .62, 'song', cd.sym, sec, prog); });
          if (S.band.bassOn && c) ngAddEvent(36 + c.root, .8, 'song', cd.sym, sec, prog);
        }
        if (S.band.leadOn) fb.bar.tab.forEach(n => { if (n.s === sib) ngAddEvent(n.f === 'x' ? S.tuning[n.st] + S.capo : noteMidi(n), .85, 'song', cd.sym, sec, prog); });
      }
    }
    NR.lastSlot = cur;
  } else NR.lastSlot = null;
  if (typeof STP !== 'undefined' && STP.playing && STM.an && STM.an.chordBars.length) {
    const pos = spPos(), bars = STM.an.chordBars; let bi = -1; for (let i = bars.length - 1; i >= 0; i--) if (bars[i].t <= pos) { bi = i; break; }
    if (bi >= 0) { const parts = bars[bi].chord.split(' ').filter(Boolean), half = parts.length > 1 && pos >= bars[bi].t + 2 * STM.an.per / STM.an.fps ? 1 : 0, sym = parts[half] || parts[0];
      if (sym && sym !== NR.curChord) { ngChordChange(sym, 'track'); const c = parseChord(sym); if (c) c.pcs.forEach((pc, k) => ngAddEvent(48 + ((pc - 48) % 12 + 12) % 12 + (k > 2 ? 12 : 0), .6, 'track', sym, '', STM.dur ? pos / STM.dur : 0)); if (c) ngAddEvent(36 + c.root, .8, 'track', sym, '', STM.dur ? pos / STM.dur : 0); } }
  }
  if (!T.playing && AN.active && AN.chord && AN.chord[0] && AN.clarity != null) { const sym = AN.chord[0].sym; if (sym === NR.sym) { if (performance.now() - NR.symT > 280) ngChordChange(sym, 'live'); } else { NR.sym = sym; NR.symT = performance.now(); } }
}
bus.on('onset', () => { if (T.playing) return; setTimeout(() => { if (!AN.active) return; const ch = AN.chord && AN.chord[0] && parseChord(AN.chord[0].sym); const v = clamp((AN.rms + 50) / 40, .3, 1), sym = AN.chord && AN.chord[0] ? AN.chord[0].sym : ''; if (AN.midi != null && (!ch || AN.clarity > .9)) ngAddEvent(AN.midi, v, 'live', sym, '', null); else if (ch) ch.pcs.forEach(pc => ngAddEvent(48 + ((pc - 48) % 12 + 12) % 12, v * .8, 'live', sym, '', null)); }, 70); });

/* ---------- update (visible only) ---------- */
function ngUpdate(dt, vis) {
  const an = E.anaRig; if (an) { if (!NR.fd || NR.fd.length !== an.frequencyBinCount) NR.fd = new Float32Array(an.frequencyBinCount); an.getFloatFrequencyData(NR.fd); }
  const fd = NR.fd, bh = E.ctx.sampleRate / (an ? an.fftSize : 4096), ch = AN.chroma || [], mx = Math.max(.001, ...ch), live = AN.active;
  NR.nodes.forEach(n => { n.act *= Math.pow(.05, dt * (n.kind === 'chord' || n.kind === 'section' ? .35 : 1.1)); });
  if (fd) for (let i = 0; i < NR.nBands; i++) { const n = NR.nodes.get('b' + i); if (!n) continue; const k0 = Math.max(1, Math.floor(70 * Math.pow(6000 / 70, i / NR.nBands) / bh)), k1 = Math.max(k0 + 1, Math.ceil(70 * Math.pow(6000 / 70, (i + 1) / NR.nBands) / bh)); let m = -140; for (let k = k0; k < k1 && k < fd.length; k++) m = Math.max(m, fd[k]); n.act = Math.max(n.act * .7, clamp((m + 90) / 55, 0, 1)); }
  for (let pc = 0; pc < 12; pc++) { const n = NR.nodes.get('p' + pc); if (n && live && ch.length) n.act = Math.max(n.act, Math.pow(ch[pc] / mx, 1.6) * .9); }
  const cs = [...NR.nodes.values()].filter(n => n.kind === 'chord'), cur = NR.nodes.get('c:' + NR.curChord);
  let tot = 0; cs.forEach(n => { if (!n.cp) return; n.sim = n.cp.pcs.reduce((s, pc) => s + (NR.nodes.get('p' + pc) ? NR.nodes.get('p' + pc).act : 0), 0) / n.cp.pcs.length; tot += n.sim * n.sim; });
  cs.forEach(n => { if (n.cp) n.act = Math.max(n.act, n.sim * n.sim / (tot + .001) * .9); });
  if (cur) cur.act = Math.max(cur.act, .95);
  ['T', 'S', 'D', 'O'].forEach(f => { const n = NR.nodes.get('f:' + f); if (n) n.act = Math.max(...cs.filter(c => c.fn === f).map(c => c.act), 0) * (f === 'O' ? .8 : 1); });
  NR.nodes.forEach(n => { if (n.kind === 'section') { n.act = Math.max(n.act * .0, NR.curSec === n.sec.id ? 1 : 0); if (n.act > .5 && !n.seen) { n.seen = 1; n.firstIdx = NR.evSeq; n.born = performance.now(); } } });
  const kk = NR.nodes.get('k:key'); if (kk) kk.act = AN.key && AN.key[0] ? clamp(AN.key[0].r, 0, 1) : .35;
  const scl = NR.key.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]; let out = 0, all = .001; for (let pc = 0; pc < 12; pc++) { const a = NR.nodes.get('p' + pc).act; all += a; if (!scl.includes((pc - NR.key.root + 12) % 12)) out += a; } const kt = NR.nodes.get('k:ten'); NR.tension += (clamp(out / all * 2.2 + (cur && cur.fn === 'D' ? .25 : 0), 0, 1) - NR.tension) * .1; if (kt) kt.act = NR.tension;
  /* node motion */
  if (NG.layout === 'force') ngForce(dt); const kk_ = 1 - Math.pow(.0009, dt);
  NR.nodes.forEach(n => { if (NG.layout === 'force' && n.kind !== 'band') return; const g = n.tgt || n.t_net || [0, 0, 0]; for (let q = 0; q < 3; q++) n.p[q] += (g[q] - n.p[q]) * kk_; });
  NR.pulses.forEach(p => { p.t += dt * p.s; }); NR.pulses = NR.pulses.filter(p => p.t < 1);
  if (NG.rot && !NR.drag) { NR.spinT = (NR.spinT || 0) + dt * .3; NG.yaw += NG.layout === 'net' ? Math.cos(NR.spinT) * dt * .14 : dt * .09; }
  if (NR.pred === null && cur) NR.pred = ngPredict(cur.sym);
}

/* ---------- projection & render ---------- */
function ngCam(c, W, H) { const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pit), sp = Math.sin(c.pit), sc = Math.min(W * .6, H * 1.02) * .095 * c.zoom, D = 13; return p => { const x1 = cy * p[0] + sy * p[2], z1 = -sy * p[0] + cy * p[2], y2 = cp * p[1] - sp * z1, z2 = sp * p[1] + cp * z1, w = D / (D - z2); return [W / 2 + c.px + x1 * sc * w, H * .54 + c.py - y2 * sc * w, z2, w]; }; }
function evPos(e) {
  const L = NG.layout; const pn = NR.nodes.get('p' + e.pc); const oc = (e.midi - 36) / 12;
  if (L === 'fifths') { const r = 2.7 + oc * .42; return [Math.cos(FANG(e.pc) + e.prog * 2.2) * r, -1.9 + e.prog * 5.4 + e.jy * .25, Math.sin(FANG(e.pc) + e.prog * 2.2) * r]; }
  const b = pn ? pn.p : [0, 0, 0]; return [b[0] + (e.jx * .55 - .1) - oc * .1, b[1] + e.jy * .5 + (oc - 1.2) * .08, b[2] + e.jz * .55 + oc * .12];
}
const NCOL = n => n.kind === 'band' ? ramp(1 - n.i / 23) : n.kind === 'pc' ? pcCol(n.pc) : n.kind === 'chord' ? (n.cp ? pcCol(n.cp.root) : '#aaa') : n.kind === 'func' ? ({ T: '#35d3c2', S: '#f2a900', D: '#e4572e', O: '#a58bff' })[n.fn] : n.kind === 'section' ? `hsl(${hashHue(n.label)},70%,${light_() ? 42 : 62}%)` : n.kind === 'key' ? (light_() ? '#223' : '#ffffff') : '#ff5fa2';
function hsl2a(c, a) { return c.startsWith('hsla') ? c.replace(/,[^,]+\)$/, ',' + a + ')') : c.startsWith('hsl(') ? c.replace('hsl(', 'hsla(').replace(')', ',' + a + ')') : c.startsWith('#') ? (() => { const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); return `rgba(${r},${g},${b},${a})`; })() : c; }
function ngNodeVisible(n) { if (!n.seen && !NG.ghosts) return false; if (NR.cut < 1 && n.seen && n.firstIdx > NR.cut * NR.evSeq) return false; return true; }
function ngRender(g, W, H, cam, opt) {
  opt = opt || {}; const P = ngCam(cam, W, H), L_ = light_() && !opt.dark, now = performance.now(), cutIdx = NR.cut * NR.evSeq;
  if (!opt.noBg) { g.fillStyle = L_ ? '#f4f4f2' : '#050b0c'; g.fillRect(0, 0, W, H); }
  const items = [], sel = NR.sel, nb = new Set(); if (sel && !sel.e) { nb.add(sel.id); NR.edges.forEach(e => { if (e.a === sel) nb.add(e.b.id); if (e.b === sel) nb.add(e.a.id); }); NR.trans.forEach((c, k) => { const [a, b] = k.split('>'); if ('c:' + a === sel.id) nb.add('c:' + b); if ('c:' + b === sel.id) nb.add('c:' + a); }); }
  const dim = n => sel && !sel.e && !nb.has(n.id) ? .18 : 1;
  /* floor + shadow */
  if (NG.floor) {
    const fy = NG.layout === 'fifths' ? -2.1 : -3.9, fs = 5.2, cs = [[-fs, fy, -fs], [fs, fy, -fs], [fs, fy, fs], [-fs, fy, fs]].map(P); g.beginPath(); cs.forEach((q, i) => g[i ? 'lineTo' : 'moveTo'](q[0], q[1])); g.closePath(); g.fillStyle = L_ ? 'rgba(0,0,0,.055)' : 'rgba(255,255,255,.045)'; g.fill();
    if (NG.ev) { const stride = Math.max(1, Math.floor(NR.events.length / 500)); for (let i = 0; i < NR.events.length; i += stride) { const e = NR.events[i]; if (e.i > cutIdx && NR.cut < 1) continue; const q = evPos(e), s = P([q[0], fy, q[2]]), r = (6 + e.vel * 5) * s[3] * cam.zoom; const gr = g.createRadialGradient(s[0], s[1], 0, s[0], s[1], r); gr.addColorStop(0, L_ ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(s[0] - r, s[1] - r, r * 2, r * 2); } }
  }
  /* edges */
  const ew = L_ ? '30,40,45' : '190,235,235';
  if (NG.edges) NR.edges.forEach(e => { if (!ngNodeVisible(e.a) || !ngNodeVisible(e.b)) return; if (!e.a.seen && !e.b.seen && e.a.kind !== 'band' && e.a.kind !== 'pc') return; const act = e.a.act * e.b.act * e.w, d = Math.min(dim(e.a), dim(e.b)), a = e.a.p, b = e.b.p, s = P(a), t = P(b), hi = sel && (e.a === sel || e.b === sel); const al = (.035 + act * .9 + (hi ? .35 : 0)) * d * (e.a.seen && e.b.seen ? 1 : .35); if (al < .02) return; g.strokeStyle = act > .12 || hi ? hsl2a(NCOL(e.b), clamp(al, 0, 1)) : `rgba(${ew},${al.toFixed(3)})`; g.lineWidth = (.5 + act * 3.2 + (hi ? 1.2 : 0)) * Math.min(1.8, (s[3] + t[3]) / 2); g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(t[0], t[1]); g.stroke(); });
  /* transitions (learned) */
  const curN = NR.nodes.get('c:' + NR.curChord); let maxC = 1; NR.trans.forEach(c => { maxC = Math.max(maxC, c); });
  if (NG.trans) NR.trans.forEach((c, key) => { const [a, b] = key.split('>'), A = NR.nodes.get('c:' + a), B = NR.nodes.get('c:' + b); if (!A || !B || !ngNodeVisible(A) || !ngNodeVisible(B)) return; const s = P(A.p), t = P(B.p), mx = (s[0] + t[0]) / 2, my = (s[1] + t[1]) / 2, dx = t[0] - s[0], dy = t[1] - s[1], dl = Math.hypot(dx, dy) + 1, bump = Math.min(60, dl * .35) * cam.zoom; const hot = curN && A === curN; g.strokeStyle = hsl2a(NCOL(A), (hot ? .9 : .28 + .4 * c / maxC) * Math.min(dim(A), dim(B))); g.lineWidth = (.8 + 3.2 * c / maxC) * s[3]; g.beginPath(); g.moveTo(s[0], s[1]); g.quadraticCurveTo(mx - dy / dl * bump, my + dx / dl * bump, t[0], t[1]); g.stroke(); const ux = (t[0] - (mx - dy / dl * bump)) , uy = (t[1] - (my + dx / dl * bump)), ul = Math.hypot(ux, uy) + 1e-3; g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(t[0] - ux / ul * 9 * t[3], t[1] - uy / ul * 9 * t[3], 2.2 * t[3], 0, 7); g.fill(); });
  /* embedding links */
  if (NG.ev && NG.links && NR.events.length > 1) { g.lineWidth = 1; let last = null; const from = Math.max(0, NR.events.length - 140); for (let i = from; i < NR.events.length; i++) { const e = NR.events[i]; if (e.i > cutIdx && NR.cut < 1) break; const q = P(evPos(e)); if (last) { g.strokeStyle = evColor(e, .16 + .3 * (i - from) / (NR.events.length - from)); g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(q[0], q[1]); g.stroke(); } last = q; } }
  /* items */
  NR.nodes.forEach(n => { if (!ngNodeVisible(n)) return; const q = P(n.p); items.push({ t: 0, n, q, z: q[2] }); });
  if (NG.ev) NR.events.forEach(e => { if (NR.cut < 1 && e.i > cutIdx) return; const q = P(evPos(e)); items.push({ t: 1, e, q, z: q[2] }); });
  items.sort((a, b) => a.z - b.z); const hov = NR.hover, scr = opt.noHit ? null : (NR.pos = []);
  items.forEach(it => {
    const q = it.q, w = q[3];
    if (it.t === 1) { const e = it.e, age = (now - e.born) / 1000, r = (2.1 + e.vel * 2.2) * w * Math.sqrt(cam.zoom) * (1 + Math.max(0, 1 - age * 2) * 1.6), a = (sel && !sel.e ? (nb.has('p' + e.pc) || nb.has('c:' + e.chord) ? 1 : .15) : 1) * (.45 + .5 * Math.max(0, 1 - age / 40)); g.fillStyle = evColor(e, clamp(a, 0, 1)); g.beginPath(); g.arc(q[0], q[1], r, 0, 7); g.fill(); if (scr) scr.push({ e, x: q[0], y: q[1], r: r + 3, ev: true }); return; }
    const n = it.n, ghost = !n.seen, pop = clamp((now - n.born) / 600, 0, 1), eas = n.born && n.seen ? 1 + Math.sin(pop * Math.PI) * .6 : 1, base = (n.kind === 'band' ? 3.2 : n.kind === 'pc' ? 8 : n.kind === 'chord' ? 10 : n.kind === 'key' ? 14 : 9) * Math.sqrt(cam.zoom), r = base * w * (1 + n.act * .55) * eas * (ghost ? .8 : 1), d = dim(n), col = NCOL(n);
    if (!ghost && n.act > .15) { g.shadowColor = col; g.shadowBlur = 8 + n.act * 22; }
    g.beginPath(); n.kind === 'section' || n.kind === 'func' ? (() => { for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; g[i ? 'lineTo' : 'moveTo'](q[0] + r * 1.1 * Math.cos(a), q[1] + r * 1.1 * Math.sin(a)); } g.closePath(); })() : g.arc(q[0], q[1], r, 0, 7);
    if (ghost) { g.strokeStyle = hsl2a(col, .35 * d); g.lineWidth = 1.2; g.setLineDash([3, 3]); g.stroke(); g.setLineDash([]); } else { g.fillStyle = hsl2a(col, (.25 + n.act * .75) * d); g.fill(); g.strokeStyle = hsl2a(col, d); g.lineWidth = 1.4 + n.act * 1.5; g.stroke(); }
    g.shadowBlur = 0;
    if (n === curN && NR.pred && NG.trans) { g.strokeStyle = L_ ? '#111' : '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(q[0], q[1], r + 5 * w, 0, 7); g.stroke(); }
    if (NR.pred && n.sym && NR.pred.list) { const pr = NR.pred.list.find(x => x.sym === n.sym); if (pr && !opt.noPred) { g.strokeStyle = hsl2a(col, .95); g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.arc(q[0], q[1], r + (5 + 10 * pr.p) * w, 0, 7); g.stroke(); g.setLineDash([]); n.pp = pr.p; } else n.pp = 0; }
    if (scr) scr.push({ n, x: q[0], y: q[1], r: Math.max(8, r + 3) });
    const show = NG.labels && (n.kind !== 'band' || n.i % 4 === 0) && (!ghost || n.kind !== 'band'), big = n.kind !== 'band' || cam.zoom > 1.1;
    if (show && big && (w > .85 || n.act > .2 || n === sel || n === hov)) { g.font = `${n.kind === 'chord' ? 800 : 700} ${Math.round((n.kind === 'band' ? 9 : n.kind === 'chord' ? 12 : 11) * Math.min(1.4, w) * Math.sqrt(cam.zoom))}px ui-monospace,Menlo,monospace`; g.textAlign = 'center'; g.fillStyle = L_ ? `rgba(20,30,35,${(ghost ? .35 : .9) * d})` : `rgba(235,250,250,${(ghost ? .3 : .9) * d})`; g.fillText(n.label + (n.pp ? ' ' + Math.round(n.pp * 100) + '%' : ''), q[0], q[1] - r - 5 * w); }
  });
  /* pulses */
  if (NG.pulses) NR.pulses.forEach(p => { const s = P(p.e.a.p), t = P(p.e.b.p), x = s[0] + (t[0] - s[0]) * p.t, y = s[1] + (t[1] - s[1]) * p.t; g.fillStyle = hsl2a(NCOL(p.e.b), (1 - p.t * .5) * p.v); g.shadowColor = NCOL(p.e.b); g.shadowBlur = 12; g.beginPath(); g.arc(x, y, 2.6 + p.v * 2, 0, 7); g.fill(); g.shadowBlur = 0; });
  /* layer captions */
  if (NG.labels && NG.layout === 'net' && !opt.noCaps) { g.font = '700 10px ui-monospace,monospace'; g.textAlign = 'center'; g.fillStyle = L_ ? 'rgba(20,30,35,.5)' : 'rgba(220,245,245,.45)'; [['SPECTRUM', -2, 3.7], ['PITCH CLASS', -1, 3.6], ['CHORDS', 0, 3.7], ['FUNCTION · FORM', 1, 3.5], ['KEY · TENSION', 2, 2.2]].forEach(([t, k, y]) => { const q = P([k * 2.6, y, 0]); g.fillText(t, q[0], q[1]); }); }
  g.textAlign = 'left';
}

/* ---------- pane ---------- */
const NC = { yaw: .6, pit: .45, zoom: 1, px: 0, py: 0 };   // stage camera
function ngStageDraw(g, W, H, info) { ngFrameCommon(); NC.yaw += .0025; NC.pit = .38 + Math.sin(VZ.t * .12) * .12; NC.zoom = Math.max(1, Math.min(W, H) / 700 * 1.1); const was = NR.sel; NR.sel = null; ngRender(g, W, H, NC, { noBg: true, noHit: true, dark: true, noCaps: false }); NR.sel = was; }
function ngFrameCommon() { const now = performance.now(); if (NR.tickAt === now) return; const dt = Math.min(.1, (now - (NR.last || now)) / 1000); NR.last = now; NR.tickAt = now; if (NR.dirty) ngBuild(); if (NG.layout !== 'force') ngLayout(); ngUpdate(dt); }
function neuralFrame() { if (!E.ready) return; if (NR.dirty && S.sections) ngBuild(); ngCapture(); if (!paneVisible('neural')) return; ngFrameCommon(); if (!NR.cv) return; const cv = NR.cv, g = cv.getContext('2d'); NR.hudT = (NR.hudT || 0) + 1; ngRender(g, cv.width, cv.height, NG, {}); ngHud(g, cv.width, cv.height); if (NR.hudT % 8 === 0) ngPanel(); }
function ngHud(g, W, H) {
  const L_ = light_(), u = Math.min(W, H * 1.5), mono = 'ui-monospace,Menlo,monospace'; g.font = `700 ${Math.round(u * .024)}px ${mono}`; g.fillStyle = L_ ? 'rgba(20,30,35,.75)' : 'rgba(225,248,248,.8)'; g.textAlign = 'left';
  const lines = [`events ${NR.events.length}   chords ${[...NR.nodes.values()].filter(n => n.kind === 'chord' && n.seen).length}/${[...NR.nodes.values()].filter(n => n.kind === 'chord').length}   transitions ${NR.trans.size}`, `entropy ${ngEntropy().toFixed(2)} bits   next-chord ${NR.hit + NR.miss ? Math.round(NR.hit / (NR.hit + NR.miss) * 100) + '% (' + NR.hit + '/' + (NR.hit + NR.miss) + ')' : '—'}`];
  const y0 = H - 14 - (NR.pred && NR.pred.list ? 2 : 1) * u * .03; lines.forEach((t, i) => g.fillText(t, 14, y0 + i * u * .03)); if (NR.pred && NR.pred.list) g.fillText('after ' + NR.pred.from + ' →  ' + NR.pred.list.slice(0, 3).map(x => x.sym + ' ' + Math.round(x.p * 100) + '%').join('   '), 14, y0 + 2 * u * .03);
}
function ngPick(x, y) { let best = null, bd = 1e9; (NR.pos || []).forEach(p => { const d = Math.hypot(p.x - x, p.y - y); if (d < p.r && d - (p.ev ? 0 : 6) < bd) { bd = d - (p.ev ? 0 : 6); best = p; } }); return best; }
function ngPanel() {
  const box = NR.panel; if (!box) return; const sel = NR.sel || NR.hover; let html = '';
  if (!sel) { box.innerHTML = '<div class="tiny muted">Hover a node or note for details. Click to pin and light up its connections. Drag to orbit · right-drag or Shift-drag to pan · wheel to zoom · double-click to reset.</div>'; return; }
  const row = (a, b) => `<div class="kv"><span>${esc(a)}</span><b>${esc(b)}</b></div>`;
  if (sel.e) { const e = sel.e; html += `<h5>Note ${pcName(e.pc)}${Math.floor(e.midi / 12) - 1}</h5>` + row('Source', e.src) + row('Chord', e.chord || '—') + row('Section', e.sec || '—') + row('Velocity', Math.round(e.vel * 100) + '%') + row('Song position', Math.round(e.prog * 100) + '%'); }
  else {
    const n = sel.n || sel; html += `<h5>${esc(n.label)}</h5>` + row('Layer', ['Spectrum', 'Pitch class', 'Chord', 'Function / form', 'Output'][n.layer]) + row('Activation', Math.round(n.act * 100) + '%') + row('Seen', n.seen ? (n.count || 1) + '×' : 'not yet');
    const ins = NR.edges.filter(e => e.b === n).length, outs = NR.edges.filter(e => e.a === n).length; html += row('In / out', ins + ' / ' + outs);
    if (n.kind === 'chord' && n.cp) { html += row('Notes', n.cp.pcs.map(pcName).join(' · ')) + row('Function', FN[n.fn]) + row('In sections', [...n.secs.keys()].map(id => { const s = NR.sections.find(q => q.id === id); return s ? s.name : ''; }).join(', ') || '—'); const pr = ngPredict(n.sym); if (pr) html += '<div class="tiny muted" style="margin-top:6px">LEARNED NEXT</div>' + pr.list.slice(0, 4).map(x => `<div class="bar"><i style="width:${x.p * 100}%"></i><span>${esc(x.sym)}</span><em>${Math.round(x.p * 100)}%</em></div>`).join(''); }
    if (n.kind === 'pc') { const cnt = NR.events.filter(e => e.pc === n.pc); html += row('Played', cnt.length + '×') + row('Fifths pos', FIFTH(n.pc)); const oc = {}; cnt.forEach(e => { const o = Math.floor(e.midi / 12) - 1; oc[o] = (oc[o] || 0) + 1; }); html += '<div class="tiny muted">OCTAVES ' + Object.keys(oc).map(o => o + ':' + oc[o]).join('  ') + '</div>'; }
    if (n.kind === 'section') html += row('Bars', n.sec.bars.length) + row('Chords', [...new Set(n.sec.bars.flatMap(barChords))].join(' '));
    if (n.kind === 'tension') html += row('Meaning', 'Energy outside the key + dominant pull');
    if (n.kind === 'key') html += row('Estimate', pcName(NR.key.root) + (NR.key.minor ? ' minor' : ' major'));
  }
  box.innerHTML = html;
}
function buildNeuralPane() {
  const p = PANES.neural; if (!p) return; p.classList.add('flex');
  const seg = (k, opts, fn) => h('div', { class: 'seg' }, opts.map(([v, n]) => h('button', { class: NG[k] === v ? 'on' : '', 'data-v': v, onclick: e => { NG[k] = v; saveNG(); $$('button', e.target.parentNode).forEach(b => b.classList.toggle('on', b === e.target)); fn && fn(v); } }, n)));
  const tg = (k, label, title) => h('label', { class: 'chk small', title, style: { display: 'flex', gap: '4px', alignItems: 'center', fontWeight: 700 } }, h('input', { type: 'checkbox', checked: NG[k], onchange: e => { NG[k] = e.target.checked; saveNG(); } }), label);
  const bar = h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', margin: '0 0 8px', alignItems: 'center' } },
    seg('layout', [['net', '◫ Layers'], ['fifths', '◎ Fifths'], ['force', '✺ Force']], v => { if (v !== 'force') { NR.nodes.forEach(n => { n.tgtF = null; }); ngLayout(); } }),
    h('label', { class: 'small', style: { fontWeight: 700 } }, 'Colour by ', h('select', { class: 'in', style: { width: 'auto', fontFamily: 'var(--sans)' }, onchange: e => { NG.color = e.target.value; saveNG(); } }, [['pc', 'Pitch class'], ['time', 'Time in song'], ['section', 'Section'], ['loud', 'Loudness'], ['octave', 'Octave'], ['quality', 'Chord quality']].map(([v, n]) => h('option', { value: v, selected: NG.color === v }, n)))),
    tg('edges', 'Edges'), tg('trans', 'Learned transitions'), tg('ev', 'Notes'), tg('links', 'Path'), tg('labels', 'Labels'), tg('ghosts', 'Unheard'), tg('floor', 'Floor'), tg('pulses', 'Pulses'), tg('rot', 'Spin'),
    h('button', { class: 'btn sm', title: 'Teach the network this song’s chord order right now', onclick: () => { const seq = []; S.sections.forEach(s => s.bars.forEach(b => barChords(b).forEach(c => seq.push(c)))); let pv = null; seq.forEach(c => { if (!parseChord(c)) return; const n = NR.nodes.get('c:' + c); if (n && !n.seen) { n.seen = 1; n.firstIdx = NR.evSeq; n.born = performance.now(); } if (pv && pv !== c) { const k = pv + '>' + c; NR.trans.set(k, (NR.trans.get(k) || 0) + 1); } pv = c; }); const cur = NR.curChord || seq[0]; NR.pred = ngPredict(cur); toast('Network pre-trained on the song', 'ok'); } }, '⚡ Pre-train'),
    h('button', { class: 'btn sm', onclick: () => { NR.events = []; NR.seq = []; NR.trans = new Map(); NR.hit = NR.miss = 0; NR.pred = null; NR.curChord = null; NR.evSeq = 0; NR.nodes.forEach(n => { if (n.kind === 'chord' || n.kind === 'pc' || n.kind === 'section') { n.seen = 0; n.count = 0; n.firstIdx = -1; } }); NR.cut = 1; NR.sel = null; if (NR.slider) NR.slider.value = 1000; } }, '↺ Forget'),
    h('label', { class: 'small', style: { fontWeight: 700, display: 'flex', gap: '6px', alignItems: 'center' }, title: 'Scrub back through what the network had learned' }, 'Replay ', NR.slider = h('input', { type: 'range', min: 0, max: 1000, value: 1000, style: { width: '140px' }, oninput: e => { NR.cut = +e.target.value / 1000; } })));
  NR.cv = h('canvas', { style: { width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: 'grab' } }); NR.tip = h('div', { class: 'ngtip' }); NR.panel = h('div', { class: 'ngpanel' });
  NR.wrap = h('div', { class: 'stagewrap', style: { flex: 1, minHeight: '340px', display: 'flex', background: 'transparent', border: '1px solid var(--line)' } }, h('div', { style: { position: 'relative', flex: 1, minWidth: 0 } }, NR.cv, NR.tip), NR.panel);
  p.append(bar, NR.wrap);
  new ResizeObserver(() => { const d = (window.devicePixelRatio || 1), w = NR.cv.clientWidth, hh = NR.cv.clientHeight; if (w && (NR.cv.width !== Math.floor(w * d) || NR.cv.height !== Math.floor(hh * d))) { NR.cv.width = Math.floor(w * d); NR.cv.height = Math.floor(hh * d); } }).observe(NR.cv);
  const cv = NR.cv, xy = e => { const r = cv.getBoundingClientRect(), d = cv.width / r.width; return [(e.clientX - r.left) * d, (e.clientY - r.top) * d, r]; };
  const pts = new Map(); let pin = null, down = null;
  const pinStat = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 }; };
  cv.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); cv.setPointerCapture(e.pointerId); if (pts.size === 2) { const st = pinStat(); pin = { d: st.d, z: NG.zoom, mx: st.mx, my: st.my }; if (down) down.moved = true; return; } down = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2, moved: false }; NR.drag = true; cv.style.cursor = 'grabbing'; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointermove', e => { if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]); if (pin && pts.size >= 2) { const st = pinStat(), k = cv.width / cv.getBoundingClientRect().width; NG.zoom = clamp(pin.z * st.d / pin.d, .35, 4); NG.px += (st.mx - pin.mx) * k; NG.py += (st.my - pin.my) * k; pin.mx = st.mx; pin.my = st.my; return; } const [x, y, r] = xy(e); if (down) { const dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.abs(dx) + Math.abs(dy) > 3) down.moved = true; if (down.pan) { NG.px += dx * (cv.width / r.width); NG.py += dy * (cv.width / r.width); } else { NG.yaw += dx * .007; NG.pit = clamp(NG.pit + dy * .006, -1.4, 1.4); } down.x = e.clientX; down.y = e.clientY; return; } const hit = ngPick(x, y); NR.hover = hit ? (hit.e ? hit : hit.n) : null; cv.style.cursor = hit ? 'pointer' : 'grab'; if (hit) { NR.tip.style.display = 'block'; NR.tip.style.left = (e.clientX - r.left + 14) + 'px'; NR.tip.style.top = (e.clientY - r.top + 10) + 'px'; NR.tip.textContent = hit.e ? pcName(hit.e.pc) + (Math.floor(hit.e.midi / 12) - 1) + ' · ' + (hit.e.chord || hit.e.src) : hit.n.label; } else NR.tip.style.display = 'none'; });
  cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); if (!pts.size) { pin = null; down = null; NR.drag = false; } });
  cv.addEventListener('pointerup', e => { pts.delete(e.pointerId); if (pin) { if (pts.size < 2) pin = null; if (down) down.moved = true; if (!pts.size) { down = null; NR.drag = false; cv.style.cursor = 'grab'; } return; } const [x, y] = xy(e); if (down && !down.moved) { const hit = ngPick(x, y); NR.sel = hit ? (hit.e ? hit : hit.n) : null; ngPanel(); } down = null; NR.drag = false; cv.style.cursor = 'grab'; });
  cv.addEventListener('pointerleave', () => { NR.hover = null; NR.tip.style.display = 'none'; });
  cv.addEventListener('wheel', e => { e.preventDefault(); NG.zoom = clamp(NG.zoom * Math.exp(-e.deltaY * .0012), .35, 4); }, { passive: false });
  cv.addEventListener('dblclick', () => { NG.yaw = -.6; NG.pit = .38; NG.zoom = 1; NG.px = NG.py = 0; NR.sel = null; });
  ngPanel();
}
