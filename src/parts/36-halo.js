/* =====================================================================
   Part 36 · Two new looks for the center stage
   · Fifths Halo: the circle of fifths from the Neural map, laid out as a tilted ring AROUND the player. The player (camera
     cut-out) stands in the middle; the pitch classes, the song's chords and the progression arcs orbit them, and every
     note you play (or the song plays) spirals in toward you. Back half of the ring is drawn behind the player, the front
     half in front, so you are inside it.
   · Prism: a feedback kaleidoscope that accents the off-beat. The mirror count, hue and spin change on the "and" of the
     beat (or on your own onsets), with a zoom-tunnel feedback loop. Flash and spin are limited when Stage ▸ safe is on.
   ===================================================================== */
VMODES.push(['halo', 'Fifths Halo'], ['kaleido', 'Prism']);
const HL = { rot: 0, kick: 0, pv: 0, hi: false, parts: [], dirty: true, chords: [], pairs: [], items: [], t: 0 };
bus.on('song', () => { HL.dirty = true; });
/** a note flies in from its place on the circle of fifths toward the player */
function haloSpark(midi, v, kind) {
  if (midi == null) return; HL.parts.push({ pc: ((midi % 12) + 12) % 12, v: v || .8, k: kind || 'song', t0: performance.now(), spin: (Math.random() - .5) * .6, oct: clamp((midi - 36) / 48, 0, 1) });
  if (HL.parts.length > 140) HL.parts.splice(0, HL.parts.length - 140);
}
bus.on('onset', () => { if (!T.playing && AN.midi != null && AN.active) haloSpark(AN.midi, clamp((AN.rms + 50) / 40, .3, 1), CFG.anSrc === 'v' ? 'voice' : 'live'); });
function haloChords() {
  if (!HL.dirty) return; HL.dirty = false; const seen = new Map(), seq = [];
  (S.sections || []).forEach(sec => sec.bars.forEach(b => barChords(b).forEach(sym => { const c = parseChord(sym); if (!c) return; if (!seen.has(sym)) seen.set(sym, { sym, c }); seq.push(sym); })));
  HL.chords = [...seen.values()]; const pr = new Map(); for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) { const k = seq[i - 1] + '>' + seq[i]; pr.set(k, (pr.get(k) || 0) + 1); }
  HL.pairs = [...pr].map(([k, n]) => { const [a, b] = k.split('>'); return { a, b, n }; });
}
const haloEase = u => u * u * (3 - 2 * u);
function haloDraw(g, W, H, X) {
  const { C, pulse, energy, dt } = X, camOn = !!(VZ.cam && CAM.video && CAM.video.readyState >= 2), t = VZ.t;
  haloChords(); HL.t = t;
  // rotation: slow drift + a kick on every beat / onset, so the ring moves in rhythm
  if (pulse > HL.pv + .25) HL.kick = Math.min(1.4, HL.kick + .5 + pulse * .4); HL.pv = pulse; HL.kick *= Math.pow(.04, dt || .016);
  HL.rot += (dt || .016) * (.16 + energy * .5 + HL.kick * (STG.safe ? 1.2 : 2.2));
  const Rx = Math.min(W * .47, H * .95), tilt = .3 + .05 * Math.sin(t * .23), Ry = Rx * tilt, cx = W / 2, cy = H * .5, rot = HL.rot, now = performance.now();
  const P = (a, rad, lift) => { const s = Math.sin(a); return { x: cx + Math.cos(a) * rad * Rx, y: cy + s * rad * Ry - (lift || 0) * Rx * .8, z: s, k: 1 + .24 * s }; };
  const ch = AN.chroma || [], cm = Math.max(.001, ...ch), live = AN.active, playing = T.playing;
  const curSym = playing ? PB.sym : live && AN.chord && AN.chord[0] ? AN.chord[0].sym : '', cur = curSym && parseChord(curSym), curPcs = cur ? cur.pcs : [];
  const nx = playing ? nkNext() : null, nextSym = nx && nx.chord ? nx.chord.sym : '';
  const items = HL.items = [];   // {z, draw(g)} collected once, drawn in two passes
  const add = (z, fn) => items.push({ z, fn });
  // guide rings (halves)
  [[.92, .16], [.62, .10], [.3, .07]].forEach(([rad, al]) => add(0, (g, pass) => { g.strokeStyle = 'rgba(160,220,225,' + (pass ? al * 1.4 : al) + ')'; g.lineWidth = pass ? 1.6 : 1; g.beginPath(); g.ellipse(cx, cy, rad * Rx, rad * Ry, 0, pass ? 0 : Math.PI, pass ? Math.PI : Math.PI * 2); g.stroke(); }));
  // the spiral of fifths: twelve steps, centre to ring
  { const N = 96; let prev = null; for (let i = 0; i <= N; i++) { const u = i / N, a = rot * -.6 - Math.PI / 2 + u * Math.PI * 2, p = P(a, .22 + .7 * haloEase(u), u * .1); if (prev) { const pp = prev, z = (p.z + pp.z) / 2, uu = u; add(z, (g, pass) => { if ((z > 0) !== !!pass) return; g.strokeStyle = mixc(C.a, C.b, uu, (.2 + .6 * uu) * (pass ? 1 : .7) * (.8 + energy)); g.lineWidth = (1 + uu * 2.4) * p.k; g.beginPath(); g.moveTo(pp.x, pp.y); g.lineTo(p.x, p.y); g.stroke(); }); } prev = p; } }
  // pitch classes on the ring
  const pcPos = [];
  for (let pc = 0; pc < 12; pc++) {
    const a = FANG(pc) + rot, p = P(a, .92, 0), v = Math.max(PB.chroma[pc] || 0, live ? (ch[pc] || 0) / cm * .9 : 0), inC = curPcs.includes(pc), r0 = Rx * (.016 + .034 * v + (inC ? .012 : 0)) * p.k; pcPos[pc] = p;
    add(p.z, (g, pass) => { if ((p.z > 0) !== !!pass) return; const a2 = (.55 + .45 * Math.min(1, v + (inC ? .4 : 0))) * (pass ? 1 : .8); g.shadowColor = pcCol(pc, 1); g.shadowBlur = 6 + v * 26; g.fillStyle = pcCol(pc, a2); hexPath(g, p.x, p.y, r0 + Rx * .008); g.fill(); g.shadowBlur = 0;
      g.fillStyle = 'rgba(235,250,250,' + (.45 + .5 * v + (inC ? .3 : 0)).toFixed(2) + ')'; g.font = `700 ${Math.round(Rx * .03 * p.k)}px ui-monospace,Menlo,monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; const o = pcOut(a); g.fillText(pcName(pc), p.x + o[0] * (r0 + Rx * .034), p.y + o[1] * (r0 + Rx * .034) * .6); });
  }
  // chords of the song: major outside, minor inside, extended chords float higher
  const cp = {}; HL.chords.forEach(({ sym, c }) => { const q = QH(c.q), p = P(FANG(c.root) + rot, .6 + q * .2, q * .12); cp[sym] = p; });
  // progression arcs, bending over the player
  HL.pairs.forEach(({ a, b, n }) => {
    const A = cp[a], B = cp[b]; if (!A || !B) return; const hot = a === curSym && (b === nextSym || !nextSym), z = (A.z + B.z) / 2, mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 - Rx * .1 + (cy - (A.y + B.y) / 2) * .35;
    add(z, (g, pass) => { if ((z > 0) !== !!pass) return; g.strokeStyle = hot ? mixc(C.b, C.a, .3, .9) : mixc(C.a, C.c, .5, Math.min(.5, .1 + n * .06) * (pass ? 1 : .6)); g.lineWidth = (hot ? 3 : 1 + Math.min(2, n * .3)) * (pass ? 1.15 : 1); g.beginPath(); g.moveTo(A.x, A.y); g.quadraticCurveTo(mx, my, B.x, B.y); g.stroke(); });
  });
  HL.chords.forEach(({ sym, c }) => {
    const p = cp[sym], isCur = sym === curSym, isNext = sym === nextSym, r0 = Rx * (isCur ? .05 : .034) * p.k;
    add(p.z + .001, (g, pass) => { if ((p.z > 0) !== !!pass) return;
      if (isCur) c.pcs.forEach(pc => { const q = pcPos[pc]; if (!q) return; g.strokeStyle = pcCol(pc, .75); g.lineWidth = 2 * p.k; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); });
      g.shadowColor = pcCol(c.root, 1); g.shadowBlur = isCur ? 30 : 8; g.fillStyle = isCur ? pcCol(c.root, .95, 70) : pcCol(c.root, pass ? .55 : .38, 52); hexPath(g, p.x, p.y, r0); g.fill(); g.shadowBlur = 0;
      if (isNext) { g.setLineDash([5, 4]); g.strokeStyle = mixc(C.b, C.a, .5, .95); g.lineWidth = 2; hexPath(g, p.x, p.y, r0 * 1.5); g.stroke(); g.setLineDash([]); }
      g.fillStyle = isCur ? '#06100f' : 'rgba(240,252,252,.88)'; g.font = `800 ${Math.round(Rx * (isCur ? .034 : .026) * p.k)}px ui-monospace,Menlo,monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sym, p.x, p.y + 1); });
  });
  // notes spiral in toward the player
  HL.parts = HL.parts.filter(q => now - q.t0 < 2300);
  HL.parts.forEach(q => { const u = (now - q.t0) / 2300, e = haloEase(u), a = FANG(q.pc) + rot + q.spin * u * 5 + u * u * 3.2, rad = .92 - .74 * e, p = P(a, rad, q.oct * .16 * (1 - e)), r0 = Rx * (.008 + .016 * q.v) * (1 - u * .6) * p.k;
    add(p.z, (g, pass) => { if ((p.z > 0) !== !!pass) return; g.globalAlpha = Math.max(0, 1 - u * u) * (pass ? 1 : .75); g.fillStyle = q.k === 'voice' ? '#ff5fc8' : pcCol(q.pc, 1, 70); g.shadowColor = g.fillStyle; g.shadowBlur = 12; g.beginPath(); g.arc(p.x, p.y, r0, 0, 6.3); g.fill(); g.shadowBlur = 0; g.globalAlpha = 1; }); });
  // a beat ring that breathes out from the player
  if (pulse > .02) add(0, (g, pass) => { const rr = (1 - pulse) * .95; g.strokeStyle = mixc(C.b, C.a, 1 - pulse, pulse * .55); g.lineWidth = 2 + pulse * 3; g.beginPath(); g.ellipse(cx, cy, rr * Rx, rr * Ry, 0, pass ? 0 : Math.PI, pass ? Math.PI : Math.PI * 2); g.stroke(); });
  items.sort((p, q) => p.z - q.z);
  if (!camOn) { const r0 = Rx * (.07 + pulse * .02); g.save(); g.strokeStyle = mixc(C.a, C.b, .5, .5); g.lineWidth = 2; g.shadowColor = C.a; g.shadowBlur = 18; hexPath(g, cx, cy - Rx * .08, r0); g.stroke(); g.restore(); }
  g.save(); items.forEach(it => it.fn(g, 0)); g.restore();
  HL.drawn = true;
}
/** second pass, after the camera cut-out: the near half of the ring passes in front of the player */
function haloFront(g) { if (!HL.drawn) return; g.save(); HL.items.forEach(it => it.fn(g, 1)); g.restore(); HL.drawn = false; }
const pcOut = a => [Math.cos(a), Math.sin(a)];

/* ---------------- Prism: syncopated feedback kaleidoscope ---------------- */
const KS = { out: null, src: null, ow: 0, oh: 0, n: 8, ni: 0, folds: [6, 8, 12, 10, 6, 16], rot: 0, dir: 1, hue: 0, zoom: 0, rings: [], step: -9, acc: 0, lastAcc: 0, pv: 0, glints: [] };
function ksAccent(strong, now) {
  const gap = STG.safe ? 340 : 110; if (now - KS.lastAcc < gap) return; KS.lastAcc = now;
  if (strong) { KS.ni = (KS.ni + 1) % KS.folds.length; KS.n = KS.folds[KS.ni]; KS.hue += 34 + Math.random() * 40; if (Math.random() < .35) KS.dir *= -1; KS.zoom = STG.safe ? .035 : .09; }
  KS.rings.push({ r: 0, v: strong ? 1 : .55, n: 3 + ((Math.random() * 3) | 0) });
  if (KS.rings.length > 8) KS.rings.shift();
}
function kaleidoDraw(g, W, H, X) {
  const { fd, bin, lvl, C, pulse, energy, dt } = X, now = performance.now(), t = VZ.t, sc = Math.min(1, 860 / W), ow = Math.max(160, Math.round(W * sc)), oh = Math.max(90, Math.round(H * sc)), L = Math.round(Math.hypot(ow, oh));
  if (!KS.out || KS.ow !== ow || KS.oh !== oh) { KS.out = document.createElement('canvas'); KS.out.width = ow; KS.out.height = oh; KS.src = document.createElement('canvas'); KS.src.width = L; KS.src.height = L; KS.ow = ow; KS.oh = oh; KS.out.getContext('2d').fillStyle = '#050b0c'; KS.out.getContext('2d').fillRect(0, 0, ow, oh); }
  const o = KS.out.getContext('2d'), s = KS.src.getContext('2d'), cx = L / 2, cy = L / 2, filt = (() => { try { return 'filter' in s; } catch (e) { return false; } })();
  // --- syncopation: the "and" of the beat (or your own onsets) changes the fold, hue and spin; the downbeat only breathes
  if (T.playing && E.ctx) { const ph = playheadSlot(), st = Math.floor(ph); if (st !== KS.step) { KS.step = st; const m = ((st % 4) + 4) % 4; if (m === 2) ksAccent(true, now); else if (m === 0) ksAccent(false, now); else if (S.band.drumsOn || S.band.leadOn) KS.glints.push({ a: Math.random() * 6.3, r: .2 + Math.random() * .5, t: now }); } }
  else if (pulse > KS.pv + .25) ksAccent(pulse > .6, now); KS.pv = pulse;
  KS.glints = KS.glints.filter(q => now - q.t < 600);
  const spin = (.07 + energy * .5 + pulse * .6) * (STG.safe ? .6 : 1) * KS.dir; KS.rot += (dt || .016) * spin; KS.zoom *= Math.pow(.05, dt || .016);
  // --- feedback: last frame, zoomed in and turned a little, becomes the new canvas (the infinite tunnel)
  s.save(); s.globalCompositeOperation = 'copy'; s.globalAlpha = 1; s.translate(cx + Math.sin(t * .7) * L * .006, cy + Math.cos(t * .5) * L * .006); s.rotate(spin * .06 + .004 * KS.dir); const z = 1.012 + energy * .02 + KS.zoom; s.scale(z, z);
  if (filt) s.filter = 'hue-rotate(' + (2 + energy * 9) + 'deg) saturate(1.05) brightness(.95)'; s.drawImage(KS.out, -ow / 2, -oh / 2); s.restore(); if (filt) s.filter = 'none';
  s.fillStyle = 'rgba(2,6,8,' + (STG.safe ? .16 : .11) + ')'; s.fillRect(0, 0, L, L);
  // --- new light, drawn once into the wedge that gets mirrored
  const n = KS.n, wedge = Math.PI / n; s.save(); s.translate(cx, cy); s.globalCompositeOperation = 'source-over';
  const hueC = k => 'hsla(' + ((KS.hue + k) % 360).toFixed(0) + ',90%,' + (58 + (k % 3) * 4) + '%,';
  for (let i = 0; i < 28; i++) { const u = i / 27, f = 70 * Math.pow(86, u), v = lvl(fd[bin(f)]); if (v < .08) continue; const a = (.04 + u * .92) * wedge, r0 = L * (.05 + .46 * u), r1 = r0 + L * (.02 + .16 * v);
    s.strokeStyle = hueC(u * 120) + (.25 + .55 * v).toFixed(2) + ')'; s.lineWidth = 1 + v * L * .006; s.beginPath(); s.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); s.lineTo(Math.cos(a + .06 * v) * r1, Math.sin(a + .06 * v) * r1); s.stroke(); }
  { const cr = L * (.014 + energy * .04 + pulse * .035); const gr = s.createRadialGradient(0, 0, 0, 0, 0, cr * 2.4); gr.addColorStop(0, hueC(20) + '.85)'); gr.addColorStop(.45, hueC(80) + '.45)'); gr.addColorStop(1, hueC(140) + '0)'); s.fillStyle = gr; s.beginPath(); s.arc(0, 0, cr * 2.4, 0, 6.3); s.fill(); s.fillStyle = hueC(10) + '.9)'; hexPath(s, 0, 0, cr); s.fill(); }
  KS.rings.forEach(q => { q.r += (dt || .016) * (.42 + q.v * .3); const rr = q.r * L * .55; if (q.r > 1) return; s.strokeStyle = hueC(q.n * 40) + ((1 - q.r) * .8 * q.v).toFixed(2) + ')'; s.lineWidth = 1.5 + (1 - q.r) * 5; hexPath(s, 0, 0, rr); s.stroke(); }); KS.rings = KS.rings.filter(q => q.r <= 1);
  KS.glints.forEach(q => { const u = (now - q.t) / 600, a = (q.a % wedge), r = (q.r + u * .25) * L * .5; s.fillStyle = hueC(200) + (1 - u).toFixed(2) + ')'; s.beginPath(); s.arc(Math.cos(a) * r, Math.sin(a) * r, L * .006 * (1 - u * .5) + 1, 0, 6.3); s.fill(); });
  // notes: a blob whose angle in the wedge is its place on the circle of fifths, radius its octave
  PB.hits.forEach(p => { const age = now - p.t; if (age > 500) return; const midi = S.tuning[p.st] + S.capo + (typeof p.f === 'number' ? p.f : 0), pc = midi % 12, a = (.08 + FIFTH(pc) / 11 * .84) * wedge, r = L * (.1 + (midi - 36) / 60 * .34), k = 1 - age / 500;
    s.fillStyle = pcCol(pc, .9 * k, 66); s.shadowColor = s.fillStyle; s.shadowBlur = 16; s.beginPath(); s.arc(Math.cos(a) * r, Math.sin(a) * r, L * (.008 + .012 * p.v) * (1 + k), 0, 6.3); s.fill(); s.shadowBlur = 0; });
  if (!T.playing && AN.midi != null && AN.active) { const pc = AN.midi % 12, a = (.08 + FIFTH(pc) / 11 * .84) * wedge, r = L * (.1 + (AN.midi - 36) / 60 * .34); s.fillStyle = pcCol(pc, .95, 68); s.shadowColor = s.fillStyle; s.shadowBlur = 20; s.beginPath(); s.arc(Math.cos(a) * r, Math.sin(a) * r, L * .018, 0, 6.3); s.fill(); s.shadowBlur = 0; }
  s.restore();
  // --- mirror the wedge n times (alternate copies flipped, so the seams are invisible)
  const R = L * .72; o.save(); o.globalCompositeOperation = 'source-over'; o.fillStyle = '#030708'; o.fillRect(0, 0, ow, oh);
  for (let k = 0; k < n; k++) for (let f = 0; f < 2; f++) { o.save(); o.translate(ow / 2, oh / 2); o.rotate(KS.rot + k * 2 * wedge); if (f) o.scale(1, -1); o.beginPath(); o.moveTo(0, 0); o.arc(0, 0, R, 0, wedge); o.closePath(); o.clip(); o.drawImage(KS.src, -cx, -cy); o.restore(); }
  o.restore();
  // --- to the screen, with a soft fringe of colour on the edges
  g.save(); g.globalCompositeOperation = 'source-over'; g.drawImage(KS.out, 0, 0, W, H);
  const ab = 1 + .004 + pulse * .006; g.globalCompositeOperation = 'lighter'; g.globalAlpha = .16 + pulse * .1;
  try { if (filt) { g.filter = 'hue-rotate(70deg)'; g.drawImage(KS.out, -W * (ab - 1) / 2, -H * (ab - 1) / 2, W * ab, H * ab); g.filter = 'hue-rotate(-70deg)'; g.drawImage(KS.out, W * (ab - 1) / 2, H * (ab - 1) / 2, W / ab, H / ab); g.filter = 'none'; } else g.drawImage(KS.out, -W * (ab - 1) / 2, -H * (ab - 1) / 2, W * ab, H * ab); } catch (e) { }
  g.restore();
}
function vzExtra2(mode, g, W, H, X) { if (mode === 'halo') return haloDraw(g, W, H, X); return kaleidoDraw(g, W, H, X); }

/** change the visual look from anywhere (the full-screen ✦ button, keys) and keep the Visuals buttons in step */
const VZ_FAVS = ['hex', 'halo', 'kaleido', 'tunnel'];
function vzSetMode(k, quiet) { VZ.mode = k; if (!quiet) { CFG.visMode = k; saveCfg(); } VZ.spec = null; VZ.hexes = null; document.querySelectorAll('#pane-vis .seg [data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === k)); const n = (VMODES.find(m => m[0] === k) || [0, k])[1]; if (!quiet) toast(n, 'ok'); }
/** Auto look: while the song plays, the look follows the section: calm in verses, wide in choruses, strange in bridges. Your own look comes back when it stops. */
const VZ_BY_SECTION = [[/chorus|hook|refrain/i, 'halo'], [/bridge|break|solo/i, 'kaleido'], [/intro|outro|tag|coda/i, 'tunnel']];
let vzSecLast = '';
function vzSectionLook() {
  if (!CFG.vzAuto || !T.playing || !E.ctx) { if (vzSecLast) { vzSecLast = ''; if (VZ.mode !== CFG.visMode) vzSetMode(CFG.visMode || 'hex', true); } return; }
  const fb = barsCache()[Math.max(0, Math.floor(playheadSlot() / spb()))]; if (!fb) return; const id = fb.sec.id || fb.sec.name; if (id === vzSecLast) return; vzSecLast = id;
  const hit = VZ_BY_SECTION.find(([re]) => re.test(fb.sec.name)), m = hit ? hit[1] : (CFG.visMode && !/^(halo|kaleido|tunnel)$/.test(CFG.visMode) ? CFG.visMode : 'hex'); if (m !== VZ.mode) vzSetMode(m, true);
}
setInterval(() => { try { vzSectionLook(); } catch (e) { } }, 250);
function vzCycleLook() { const i = VZ_FAVS.indexOf(VZ.mode); vzSetMode(VZ_FAVS[(i + 1) % VZ_FAVS.length]); }
