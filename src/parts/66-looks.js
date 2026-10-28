/* ============================================================
   Part 66 · Ten harmony looks (2.10). They sit beside Hex Resonance in the Visuals bar and in the stage designer's list of looks.
     Harmonic Gravity   chord tones glow in a golden cluster, extensions orbit it, clashing notes sit far out, resolving makes the picture converge
     Improv Field       the same idea as a map of what to play now: safe notes, character notes, tension notes around the chord
     Voice & Guitar     two swarms: blue guitar, gold voice; they merge when in harmony, repel when they clash, and bridge on extensions
     Chord Landscape    each chord is a place; playing a progression travels across the map
     Mood Colour        brightness, colour, density and speed follow the chord's feeling; suspended mist, dominant lightning, resolution bloom
     Chord DNA          every chord grows its own geometric flower
     Constellation      every sung note is a star; sharp drifts right, flat drifts left; a session draws a sky
     Rhythm Flow        beats as waves in a liquid; syncopation as whirlpools; a steady groove as a steady current
     Ecosystem          notes spawn creatures, chords make colonies, repeated phrases grow habitats, a key change changes the weather
     Session Painting   the whole session as one picture you can save
   All of them read the harmony state in part 65 and draw on the visuals canvas, so they also work in the stage designer and full screen.
   Lightning and bursts obey the comfort setting (Calm has none, and nothing is ever closer than the comfort gap).
   ============================================================ */
VMODES.push(['gravity', 'Harmonic Gravity'], ['field', 'Improv Field'], ['swarms', 'Voice & Guitar'], ['terrain', 'Chord Landscape'], ['mood', 'Mood Colour'], ['dna', 'Chord DNA'], ['stars', 'Constellation'], ['fluid', 'Rhythm Flow'], ['eco', 'Ecosystem'], ['paint', 'Session Painting']);
const HMX = {
  ripples: [], lastRip: 0, fpos: [], trail: [], sw: null, align: .6, terr: { sig: '', map: [], cam: 0, from: null, fromT: -99 }, bolts: [], lastBolt: -99, bloomT: -99, mood: { b: [], v: 0, s: 0, d: 0, sp: 0 },
  dnaHist: [], wave: null, vort: [], onsDone: 0, flow: [], eco: { cr: [], col: [], hab: {}, motif: [], lastPc: null, climate: 0 }, paintCv: null, paintN: -1, paintAt: 0, paintSpan: 0, err: 0, ctl: null,
  reset() { this.ripples = []; this.trail = []; this.bolts = []; this.dnaHist = []; this.vort = []; this.eco = { cr: [], col: [], hab: {}, motif: [], lastPc: null, climate: this.eco.climate }; this.paintCv = null; this.paintN = -1; if (this.wave) { this.wave.h.fill(0); this.wave.v.fill(0); } }
};
const hmCm = () => (typeof LX_COMFORT !== 'undefined' && LX_COMFORT[lxComfortKey()]) || { motion: 1, strobe: .2, gap: 340 };
const hmHash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hmNote = pc => pcName(((pc % 12) + 12) % 12);
const hmFz = (W, H, k) => Math.round(k * Math.min(W, H * 1.6) / 1700 + 6);
const hmY = (H, size) => Math.round(clamp(H * .075, 22, 56) + size);   /* below the full-screen bar */
const HM_TONE = 42, HM_COLOUR = 176, HM_TENSION = 348;     // gold, teal, crimson
/** a chord's feeling as a colour: bright chords gold, sad ones deep blue, open ones pale (never green by accident) */
const hmMoodHue = v => v >= 0 ? 42 : 222, hmMoodSat = v => .3 + .7 * Math.min(1, Math.abs(v) * 2.4);
const hmHue = d => d < .05 ? HM_TONE : d < .5 ? HM_COLOUR : HM_TENSION;
function hmText(g, s, x, y, size, col, al, w, font) { g.font = `${w || 700} ${size}px ${font || 'ui-monospace,Menlo,monospace'}`; g.textAlign = al || 'left'; g.fillStyle = col || 'rgba(255,255,255,.7)'; g.fillText(s, x, y); }
const hmGlow = (g, x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col.replace('A)', (a).toFixed(3) + ')')); gr.addColorStop(1, col.replace('A)', '0)')); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
const hmTone = (a, l) => `hsla(${HM_TONE},95%,${l || 62}%,A)`;
function hmFocusLine(W, H) {   // one plain line about the note in focus
  if (HM.fPc == null || performance.now() - Math.max(HM.vHold, HM.lastOn) > 1500) return '';
  const nm = hmNote(HM.fPc), c = HM.cls[HM.fPc]; return c === 'tone' ? `${nm} is a note of ${HM.sym}: stable` : c === 'colour' ? `${nm} over ${HM.sym}: a colour, not a clash` : `${nm} over ${HM.sym}: tension. Let it go to a chord note to resolve`;
}

/* ---------- 1 · Harmonic Gravity ---------- */
function hmGravity(g, W, H, X) {
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * .44, t = VZ.t, now = HM.now, mo = hmCm().motion, ch = HM.chord, stable = 1 - HM.fd, res = clamp(1 - (now - HM.resT) / 1500, 0, 1);
  g.save(); g.globalCompositeOperation = 'lighter'; hmGlow(g, cx, cy, R * (.5 + .25 * stable), hmTone(0, 60), .1 + .14 * stable * (HM.fPc != null ? 1 : .4));
  const mx = Math.max(.001, ...(AN.chroma || [0])), nodes = [];
  for (let pc = 0; pc < 12; pc++) {
    const d = HM.d[pc], ang = (((pc * 7) % 12) / 12) * Math.PI * 2 - Math.PI / 2, r = R * (.13 + .86 * Math.pow(d, .9)), x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
    const heard = (AN.active && AN.chroma ? AN.chroma[pc] / mx : 0) * .8 + (HM.vm != null && ((Math.round(HM.vm) % 12) + 12) % 12 === pc ? 1 : 0), cl = HM.cls[pc]; nodes.push({ pc, x, y, d, cl, heard });
  }
  nodes.forEach(n => {
    const base = n.cl === 'tone' ? .55 : n.cl === 'colour' ? .22 : .1, lit = clamp(base + n.heard, 0, 1.2), hue = hmHue(n.d), rr = R * (n.cl === 'tone' ? .09 : n.cl === 'colour' ? .055 : .04) * (1 + n.heard * .5);
    hmGlow(g, n.x, n.y, rr * 3.2, `hsla(${hue},90%,60%,A)`, .5 * lit); g.fillStyle = `hsla(${hue},92%,${58 + 14 * lit}%,${.35 + .5 * Math.min(1, lit)})`; g.beginPath(); g.arc(n.x, n.y, rr * .55, 0, 7); g.fill();
    if (n.cl === 'colour') for (let j = 0; j < 3; j++) { const a = t * (.7 + j * .25) * mo + n.pc * .9 + j * 2.1, orr = Math.hypot(n.x - cx, n.y - cy) + Math.sin(t + j) * R * .015; g.fillStyle = `hsla(${HM_COLOUR + j * 22},85%,70%,${.25 + .4 * lit})`; g.beginPath(); g.arc(cx + Math.cos(a) * orr, cy + Math.sin(a) * orr, R * .012 * (1 + n.heard), 0, 7); g.fill(); }
  });
  g.globalCompositeOperation = 'source-over'; const fs = hmFz(W, H, 11);
  nodes.forEach(n => { if (n.cl !== 'tone' || n.heard > .3) hmText(g, hmNote(n.pc), n.x, n.y - R * .07, fs, `rgba(255,255,255,${.35 + .5 * Math.min(1, n.heard)})`, 'center', 700); });
  nodes.filter(n => n.cl === 'tone').forEach((n, i, a) => hmText(g, hmNote(n.pc), n.x, n.y + fs * .35, fs, 'rgba(255,255,255,.9)', 'center', 800));
  // ripples while a tense note is held; they gather and collapse into a symmetric bloom when it resolves
  const f = HM.fPc != null ? nodes[HM.fPc] : null;
  if (f && HM.fd >= .5 && now - HMX.lastRip > 320 && now - Math.max(HM.vHold, HM.lastOn) < 700) { HMX.lastRip = now; HMX.ripples.push({ t0: now, x: f.x, y: f.y }); if (HMX.ripples.length > 14) HMX.ripples.shift(); }
  HMX.ripples = HMX.ripples.filter(r => now - r.t0 < 1800 && !(now - HM.resT < 200 && r.t0 < HM.resT));
  HMX.ripples.forEach(r => { const a = (now - r.t0) / 1800; g.strokeStyle = `hsla(${HM_TENSION},85%,62%,${(1 - a) * .55})`; g.lineWidth = 1.5; g.beginPath(); g.arc(r.x, r.y, R * (.03 + a * .42), 0, 7); g.stroke(); });
  if (res > 0) {
    const p = 1 - res; for (let k = 0; k < 4; k++) { g.strokeStyle = `hsla(${HM_TONE},95%,70%,${res * .45})`; g.lineWidth = 1.4; g.beginPath(); g.arc(cx, cy, Math.max(2, R * (.95 - p * .9) * (1 - k * .2)), 0, 7); g.stroke(); }
    g.save(); g.translate(cx, cy); g.globalCompositeOperation = 'lighter'; for (let k = 0; k < 6; k++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(R * .09, -R * .05, R * (.06 + .17 * p), 0); g.quadraticCurveTo(R * .09, R * .05, 0, 0); g.fillStyle = `hsla(${HM_TONE},95%,66%,${res * .5})`; g.fill(); } g.restore();
  }
  if (f) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.beginPath(); g.arc(f.x, f.y, R * .05 + Math.sin(t * 6) * 2, 0, 7); g.stroke(); }
  hmText(g, HM.sym || '', cx, cy - fs * .1, hmFz(W, H, 26), 'rgba(255,255,255,.18)', 'center', 800);
  g.restore(); hmText(g, 'Gold: notes of the chord · teal: colour notes that orbit · red, far out: tension', 14, H - 12, fs, 'rgba(255,255,255,.4)', 'left', 600);
  const line = hmFocusLine(W, H) || (res > 0 ? 'Resolved' : 'Sing or play a note over the chord'); hmText(g, line, 14, hmY(H, fs), hmFz(W, H, 14), 'rgba(255,255,255,.82)', 'left', 700);
}

/* ---------- 6 · Improv Field ---------- */
function hmField(g, W, H, X) {
  const cx = W / 2, cy = H / 2 + H * .02, R = Math.min(W, H) * .43, ch = HM.chord, root = ch ? ch.root : S.key, fs = hmFz(W, H, 12), sc = (() => { try { return voxScale(); } catch (e) { return new Set(); } })();
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let pc = 0; pc < 12; pc++) {
    const cl = HM.cls[pc], rel = ((pc - root) % 12 + 12) % 12, ang = rel / 12 * Math.PI * 2 - Math.PI / 2, rr = R * (cl === 'tone' ? .22 : cl === 'colour' ? .56 : .86), tx = cx + Math.cos(ang) * rr, ty = cy + Math.sin(ang) * rr;
    const p = HMX.fpos[pc] || (HMX.fpos[pc] = { x: tx, y: ty }); const k = 1 - Math.exp(-6 * HM.dt); p.x += (tx - p.x) * k; p.y += (ty - p.y) * k; const heard = (AN.active && AN.chroma ? AN.chroma[pc] / Math.max(.001, ...AN.chroma) : 0) * .6 + (HM.vm != null && ((Math.round(HM.vm) % 12) + 12) % 12 === pc ? .6 : 0);
    const hue = hmHue(HM.d[pc]), size = R * (cl === 'tone' ? .2 : cl === 'colour' ? .15 : .13);
    hmGlow(g, p.x, p.y, size * (1 + heard), `hsla(${hue},90%,58%,A)`, (cl === 'tone' ? .5 : cl === 'colour' ? .3 : .26) + heard * .3);
  }
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; [.22, .56, .86].forEach(f => { g.beginPath(); g.arc(cx, cy, R * f, 0, 7); g.stroke(); });
  for (let pc = 0; pc < 12; pc++) {
    const p = HMX.fpos[pc]; if (!p) continue; const cl = HM.cls[pc], inK = sc.has(pc), heard = (HM.vm != null && ((Math.round(HM.vm) % 12) + 12) % 12 === pc) || (AN.active && AN.midi != null && ((Math.round(AN.midi) % 12) + 12) % 12 === pc), r = R * (cl === 'tone' ? .052 : cl === 'colour' ? .04 : .03);
    g.fillStyle = `hsla(${hmHue(HM.d[pc])},85%,${cl === 'tone' ? 62 : 50}%,${cl === 'tension' ? .75 : .95})`; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill();
    if (inK) { g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, r + 3, 0, 7); g.stroke(); }
    if (heard) { g.strokeStyle = '#fff'; g.lineWidth = 2.2; g.beginPath(); g.arc(p.x, p.y, r + 6 + Math.sin(VZ.t * 7) * 1.5, 0, 7); g.stroke(); HMX.trail.push({ x: p.x, y: p.y, t: HM.now }); }
    hmText(g, hmNote(pc), p.x, p.y + fs * .36, fs, cl === 'tone' ? '#201808' : '#fff', 'center', 800);
  }
  HMX.trail = HMX.trail.filter(q => HM.now - q.t < 1500).slice(-60); HMX.trail.forEach(q => { g.fillStyle = `rgba(255,255,255,${.22 * (1 - (HM.now - q.t) / 1500)})`; g.beginPath(); g.arc(q.x, q.y, 3, 0, 7); g.fill(); });
  hmText(g, HM.sym || '', 14, hmY(H, hmFz(W, H, 22)), hmFz(W, H, 26), '#fff', 'left', 800); hmText(g, ch ? 'Chord notes: ' + ch.pcs.map(hmNote).join(' ') : '', 14, hmY(H, hmFz(W, H, 22)) + 8 + fs, fs, 'rgba(255,255,255,.55)', 'left', 600);
  const ly = H - 14; [['Safe: chord notes', HM_TONE], ['Character: colour notes', HM_COLOUR], ['Tension: use it, then resolve', HM_TENSION]].forEach(([s, hu], i) => { const x = 16 + i * Math.min(W * .3, 260); g.fillStyle = `hsl(${hu},85%,58%)`; g.beginPath(); g.arc(x, ly - fs * .3, 5, 0, 7); g.fill(); hmText(g, s, x + 12, ly, fs, 'rgba(255,255,255,.62)', 'left', 600); });
  const line = hmFocusLine(W, H); if (line) hmText(g, line, W - 190, hmY(H, fs), hmFz(W, H, 13), 'rgba(255,255,255,.82)', 'right', 700);   /* clear of the look-name chip */
  hmText(g, 'Rings: notes in the key', W - 14, H - 14, fs, 'rgba(255,255,255,.4)', 'right', 600);
}

/* ---------- 2 · Voice & Guitar swarms ---------- */
function hmSwarms(g, W, H, X) {
  const N = 80, t = VZ.t, mo = hmCm().motion, dt = HM.dt; if (!HMX.sw || HMX.sw.length !== N) HMX.sw = Array.from({ length: N }, (_, i) => ({ g: { x: W * .3 + hmHash(i) * 40, y: H / 2, rho: 10 + hmHash(i + 9) * 70, th: hmHash(i + 3) * 7, w: (.4 + hmHash(i + 5)) * (i % 2 ? 1 : -1) }, v: { x: W * .7 + hmHash(i + 1) * 40, y: H / 2, rho: 10 + hmHash(i + 19) * 70, th: hmHash(i + 13) * 7, w: (.4 + hmHash(i + 15)) * (i % 2 ? -1 : 1) } }));
  const sc = Math.min(W, H) / 560, hasV = HM.vm != null, tgt = hasV ? 1 - HM.vd : .62; HMX.align = lerp(HMX.align, tgt, 1 - Math.exp(-2.2 * dt)); const a = HMX.align, clash = hasV && HM.vd >= .5, bridge = hasV && HM.vd >= .12 && HM.vd < .5;
  const sep = W * (clash ? .4 : bridge ? .16 : .02 + (1 - a) * .3), gl = clamp(AN.active ? (AN.rms + 60) / 45 : (T.playing ? X.energy * 1.1 : .22), .15, 1), vl = hasV ? clamp(((VOX.db != null ? VOX.db : -40) + 60) / 45, .3, 1) : .12;
  const gy = H / 2 + Math.sin(t * .3) * H * .04 - (HM.gm != null ? (clamp(HM.gm, 40, 84) - 62) / 22 * H * .2 : 0), vy = H / 2 - (hasV ? (clamp(HM.vm, 48, 84) - 66) / 18 * H * .3 : 0);
  HMX.gy = lerp(HMX.gy == null ? gy : HMX.gy, gy, .08); HMX.vy = lerp(HMX.vy == null ? vy : HMX.vy, vy, .1);
  const gcx = W / 2 - sep / 2, vcx = W / 2 + sep / 2, jit = clash ? 22 * sc : 4 * sc;
  g.save(); g.globalCompositeOperation = 'lighter'; const gP = [], vP = [];
  HMX.sw.forEach((p, i) => {
    [['g', gcx, HMX.gy, gl, 214], ['v', vcx, HMX.vy, vl, 44]].forEach(([k, bx, by, lv, hue]) => {
      const q = p[k]; q.th += q.w * dt * mo * (.5 + lv); const spread = (.55 + lv * .7) * (clash ? 1.35 : 1), tx = bx + Math.cos(q.th) * q.rho * sc * 1.9 * spread, ty = by + Math.sin(q.th * 1.3) * q.rho * sc * 1.2 * spread;
      q.x = lerp(q.x, tx + (hmHash(i * 7 + Math.floor(t * 9)) - .5) * jit, 1 - Math.exp(-5 * dt)); q.y = lerp(q.y, ty + (hmHash(i * 3 + Math.floor(t * 8)) - .5) * jit, 1 - Math.exp(-5 * dt));
      const mixh = lerp(hue, k === 'g' ? 160 : 150, clamp((a - .65) * 2.4, 0, 1) * (sep < W * .08 ? 1 : .4)), s = (1.6 + hmHash(i) * 2.2) * sc * (.7 + lv * .8); g.fillStyle = `hsla(${mixh},85%,${58 + lv * 14}%,${.35 + lv * .45})`; g.beginPath(); g.arc(q.x, q.y, s, 0, 7); g.fill(); (k === 'g' ? gP : vP).push(q);
    });
  });
  if (bridge) { const hue = 270 + ((((Math.round(HM.vm) - (HM.chord ? HM.chord.root : 0)) % 12) + 12) % 12) * 8; for (let j = 0; j < 22; j++) { const A = gP[(j * 7 + Math.floor(t * 2)) % N], B = vP[(j * 11 + Math.floor(t * 2)) % N]; g.strokeStyle = `hsla(${hue},85%,66%,${.14 + .22 * Math.abs(Math.sin(t * 2 + j))})`; g.lineWidth = 1.3; g.beginPath(); g.moveTo(A.x, A.y); g.quadraticCurveTo((A.x + B.x) / 2, (A.y + B.y) / 2 - H * .05 * Math.sin(t + j), B.x, B.y); g.stroke(); } }
  g.restore(); const fs = hmFz(W, H, 12), state = !hasV ? 'Sing or hum to bring in the gold swarm' : clash ? 'Clashing: the swarms push apart' : bridge ? 'A colour note: bridges form between the swarms' : a > .8 ? 'In harmony: the swarms merge' : 'Close';
  hmText(g, 'guitar', gcx, H - 14, fs, 'hsla(214,85%,70%,.8)', 'center', 700); hmText(g, 'voice', vcx, H - 14, fs, 'hsla(44,95%,70%,.85)', 'center', 700); hmText(g, state, 14, hmY(H, hmFz(W, H, 14)), hmFz(W, H, 14), 'rgba(255,255,255,.85)', 'left', 700); hmText(g, HM.sym || '', W - 14, hmY(H, hmFz(W, H, 22)), hmFz(W, H, 24), 'rgba(255,255,255,.35)', 'right', 800);
  if (!CFG.vin || CFG.vin === 'off') hmText(g, 'One input: the line you sing or play is the voice. Choose a voice input in I/O to keep them apart.', 14, H - 14 - fs * 1.6, fs * .9, 'rgba(255,255,255,.35)', 'left', 600);
}

/* ---------- 3 · Chord Landscape ---------- */
const HM_PLACES = { dom: ['canyon', 'dunes'], min: ['forest', 'pines'], dim: ['crater'], maj7: ['mountain', 'lake', 'glacier', 'mountain'], maj: ['lake', 'meadow', 'hills'], sus: ['mist', 'plateau'], other: ['dunes', 'hills'] };
function hmKind(ch) { const h = x => ch.iv.includes(x); return h(3) && h(6) ? 'dim' : h(4) && h(10) ? 'dom' : h(3) ? 'min' : h(4) && h(11) ? 'maj7' : h(4) ? 'maj' : (h(2) || h(5)) ? 'sus' : 'other'; }
function hmTerrainMap() {
  const syms = []; try { barsCache().forEach(b => barChords(b.bar).forEach(c => { if (c && !syms.includes(c) && parseChord(c)) syms.push(c); })); } catch (e) { }
  if (HM.sym && !syms.includes(HM.sym) && HM.chord) syms.push(HM.sym); const sig = syms.join('|'); if (sig === HMX.terr.sig) return HMX.terr.map;
  const used = {}; HMX.terr.sig = sig; HMX.terr.map = syms.map((sym, i) => { const ch = parseChord(sym), k = hmKind(ch), list = HM_PLACES[k], n = used[k] = (used[k] || 0) + 1; return { sym, kind: list[(n - 1) % list.length], ch, i, seed: hmHash(i * 5.7 + 1) }; }); return HMX.terr.map;
}
function hmLand(g, p, x, base, s, t, on) {
  const al = on ? 1 : .72; g.save(); g.translate(x, base); const sd = p.seed, k = p.kind;
  if (k === 'mountain' || k === 'glacier') { const pale = k === 'glacier'; [[-.55, .55, .6], [.1, .8, 1], [.62, .5, .62]].forEach(([dx, h, w], j) => { const bx = dx * s, hh = h * s * (.85 + sd * .3), ww = w * s * .65; g.fillStyle = pale ? `hsla(200,35%,${72 - j * 5}%,${al})` : `hsla(${222 + j * 5},22%,${30 + j * 6}%,${al})`; g.beginPath(); g.moveTo(bx - ww, 0); g.lineTo(bx, -hh); g.lineTo(bx + ww, 0); g.closePath(); g.fill(); g.fillStyle = `rgba(255,255,255,${.85 * al})`; g.beginPath(); g.moveTo(bx - ww * .3, -hh * .7); g.lineTo(bx, -hh); g.lineTo(bx + ww * .3, -hh * .7); g.lineTo(bx + ww * .1, -hh * .76); g.lineTo(bx - ww * .05, -hh * .66); g.closePath(); g.fill(); }); }
  else if (k === 'forest' || k === 'pines') { for (let j = 0; j < 34; j++) { const tx = (hmHash(j * 3 + sd * 9) - .5) * s * 1.7, th = s * (.16 + hmHash(j + sd) * .22), ty = -hmHash(j * 7 + 2) * s * .1; g.fillStyle = `hsla(${130 + hmHash(j) * 30},${k === 'pines' ? 30 : 45}%,${16 + hmHash(j + 4) * 14}%,${al})`; g.beginPath(); g.moveTo(tx - th * .28, ty); g.lineTo(tx, ty - th); g.lineTo(tx + th * .28, ty); g.closePath(); g.fill(); g.fillRect(tx - 1.5, ty, 3, th * .1); } }
  else if (k === 'lake') { const w = s * 1.05, hgt = s * .2; const gr = g.createLinearGradient(0, -hgt, 0, hgt); gr.addColorStop(0, `rgba(120,200,235,${.85 * al})`); gr.addColorStop(1, `rgba(20,70,110,${.9 * al})`); g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, w, hgt, 0, 0, 7); g.fill(); for (let j = 0; j < 4; j++) { const q = ((t * .25 + j / 4 + sd) % 1); g.strokeStyle = `rgba(255,255,255,${(1 - q) * .28 * al})`; g.lineWidth = 1; g.beginPath(); g.ellipse((hmHash(j + sd * 3) - .5) * w * .8, (hmHash(j + 8) - .5) * hgt, q * w * .35, q * hgt * .35, 0, 0, 7); g.stroke(); } }
  else if (k === 'canyon') { const w = s * .95; [[-1, 1], [1, 1]].forEach(([sg]) => { for (let j = 0; j < 6; j++) { g.fillStyle = `hsla(${14 + j * 5},${55 - j * 4}%,${30 + j * 4}%,${al})`; const top = -s * (.55 - j * .03) + j * s * .04, off = sg * (s * .1 + j * s * .05 + (hmHash(j + sd * 4) * s * .04)); g.beginPath(); g.moveTo(sg * w, 0); g.lineTo(sg * w, top); g.lineTo(off + sg * s * .25, top + s * .02); g.lineTo(off, -s * .1 * j * .2); g.lineTo(off * .6, 0); g.closePath(); g.fill(); } }); g.fillStyle = `rgba(10,5,5,${.45 * al})`; g.fillRect(-s * .08, -s * .25, s * .16, s * .25); }
  else if (k === 'dunes') { for (let j = 0; j < 3; j++) { g.fillStyle = `hsla(${34 - j * 4},${60 - j * 6}%,${52 - j * 8}%,${al})`; g.beginPath(); g.moveTo(-s, 0); for (let u = -s; u <= s; u += 12) g.lineTo(u, -s * (.12 + j * .05) * (1 + Math.sin(u / (s * .35) + j * 1.7 + sd * 5) * .6)); g.lineTo(s, 0); g.closePath(); g.fill(); } }
  else if (k === 'mist' || k === 'plateau') { if (k === 'plateau') { g.fillStyle = `hsla(260,15%,34%,${al})`; g.fillRect(-s * .7, -s * .32, s * 1.4, s * .32); } for (let j = 0; j < 6; j++) { const mx = (hmHash(j + sd * 5) - .5) * s * 1.6 + Math.sin(t * .15 + j) * 30, my = -hmHash(j + 3) * s * .26; hmGlow(g, mx, my, s * .45, 'hsla(215,40%,82%,A)', .2 * al); } }
  else if (k === 'crater') { g.fillStyle = `hsla(18,30%,26%,${al})`; g.beginPath(); g.ellipse(0, 0, s * .85, s * .24, 0, 0, 7); g.fill(); g.fillStyle = `rgba(8,4,8,${.85 * al})`; g.beginPath(); g.ellipse(0, s * .01, s * .6, s * .15, 0, 0, 7); g.fill(); for (let j = 0; j < 5; j++) { g.strokeStyle = `rgba(150,200,255,${.4 * al})`; g.beginPath(); g.moveTo((hmHash(j) - .5) * s * .6, -s * .02); g.lineTo((hmHash(j) - .5) * s * .6 + 6, -s * (.18 + hmHash(j + 5) * .2)); g.stroke(); } }
  else { for (let j = 0; j < 3; j++) { g.fillStyle = `hsla(${96 + j * 12},40%,${34 - j * 4}%,${al})`; g.beginPath(); g.ellipse((j - 1) * s * .5, 0, s * .6, s * (.2 + sd * .1 + j * .03), 0, Math.PI, 0); g.fill(); } if (k === 'meadow') for (let j = 0; j < 28; j++) { g.fillStyle = `hsla(${hmHash(j) * 360},80%,70%,${.8 * al})`; g.beginPath(); g.arc((hmHash(j + 1) - .5) * s * 1.4, -hmHash(j + 2) * s * .1, 2, 0, 7); g.fill(); } }
  g.restore();
}
function hmTerrain(g, W, H, X) {
  const map = hmTerrainMap(), t = VZ.t, now = HM.now, sp = W * .6, idx = Math.max(0, map.findIndex(m => m.sym === HM.sym)), T0 = HMX.terr;
  if (T0.last !== idx) { T0.from = T0.last == null ? null : map[T0.last] || null; T0.fromT = now; T0.last = idx; }
  T0.cam = lerp(T0.cam, idx * sp, 1 - Math.exp(-1.8 * HM.dt)); const cam = T0.cam, hor = H * .6, val = (HM.q.val + 1) / 2, sh = hmMoodHue(HM.q.val), ms = hmMoodSat(HM.q.val), s = Math.min(W * .7, H * .62);
  const sky = g.createLinearGradient(0, 0, 0, hor); sky.addColorStop(0, `hsl(${sh},${(35 + HM.q.ten * 30) * ms}%,${10 + val * 8}%)`); sky.addColorStop(1, `hsl(${sh + 14},${45 * ms}%,${24 + val * 18}%)`); g.fillStyle = sky; g.fillRect(0, 0, W, hor);
  hmGlow(g, W * .5, hor, W * .5, `hsla(${sh + 10},80%,65%,A)`, .22);
  [[.25, .2, 214], [.55, .3, 226]].forEach(([par, hh, hue]) => { g.fillStyle = `hsla(${hue},25%,${14 + par * 14}%,.9)`; g.beginPath(); g.moveTo(0, hor); for (let x = 0; x <= W; x += 14) { const wx = x + cam * par; g.lineTo(x, hor - H * hh * (.4 + .6 * Math.abs(Math.sin(wx / (W * .23) + par * 8)) * (.6 + .4 * Math.sin(wx / (W * .07))))); } g.lineTo(W, hor); g.closePath(); g.fill(); });
  const gr = g.createLinearGradient(0, hor, 0, H); gr.addColorStop(0, `hsl(${sh + 70},22%,16%)`); gr.addColorStop(1, `hsl(${sh + 90},20%,7%)`); g.fillStyle = gr; g.fillRect(0, hor, W, H - hor);
  // the path between places
  g.strokeStyle = 'rgba(255,230,170,.35)'; g.lineWidth = 3; g.setLineDash([2, 9]); g.beginPath(); map.forEach((m, i) => { const x = W / 2 + i * sp - cam, y = hor + H * .17 + Math.sin(i * 1.7) * H * .03; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.setLineDash([]);
  map.forEach((m, i) => { const x = W / 2 + i * sp - cam; if (x < -s * 1.4 || x > W + s * 1.4) return; const on = i === idx; hmLand(g, m, x, hor + H * .13, s * (on ? 1 : .9), t, on); hmText(g, m.sym, x, hor + H * .27, hmFz(W, H, on ? 22 : 15), on ? '#fff' : 'rgba(255,255,255,.5)', 'center', 800); hmText(g, m.kind, x, hor + H * .27 + hmFz(W, H, 14), hmFz(W, H, 11), `rgba(255,255,255,${on ? .6 : .32})`, 'center', 600); });
  const px = W / 2, py = hor + H * .17 + Math.sin(idx * 1.7) * H * .03; g.save(); g.globalCompositeOperation = 'lighter'; hmGlow(g, px, py - 6, 26, 'hsla(48,100%,70%,A)', .7); g.restore(); g.fillStyle = '#fff'; g.beginPath(); g.arc(px, py - 6, 4, 0, 7); g.fill();
  const cur = map[idx]; if (cur) { const trip = T0.from && T0.from.sym !== cur.sym && now - T0.fromT < 6000; hmText(g, trip ? `You travelled from ${T0.from.sym} to ${cur.sym}` : `You are in ${cur.sym}`, 14, hmY(H, hmFz(W, H, 16)), hmFz(W, H, 16), 'rgba(255,255,255,.9)', 'left', 800); hmText(g, trip ? `${T0.from.kind} → ${cur.kind}` : cur.kind, 14, hmY(H, hmFz(W, H, 16)) + hmFz(W, H, 16) + 6, hmFz(W, H, 12), 'rgba(255,255,255,.55)', 'left', 600); }
  if (!map.length) hmText(g, 'Add chords to the song and each one becomes a place', W / 2, H / 2, hmFz(W, H, 16), 'rgba(255,255,255,.6)', 'center', 700);
}

/* ---------- 4 · Mood Colour ---------- */
function hmMood(g, W, H, X) {
  const M = HMX.mood, now = HM.now, t = VZ.t, cm = hmCm(), ch = HM.chord, val = HM.q.val, ten = HM.q.ten, en = clamp(AN.active ? (AN.rms + 60) / 45 : (T.playing ? X.energy * 1.1 : .18), .08, 1), dt = HM.dt;
  const sus = ch && !ch.iv.includes(3) && !ch.iv.includes(4) && (ch.iv.includes(2) || ch.iv.includes(5)), dom = ch && ch.iv.includes(4) && ch.iv.includes(10);
  const hue = hmMoodHue(val), sat = ((sus ? 28 : 52) + ten * 36) * hmMoodSat(val), bright = .2 + en * .55, density = .25 + en * .75, speed = (.18 + en * .8 + ten * .3) * cm.motion;
  M.v = lerp(M.v, bright, 1 - Math.exp(-3 * dt)); M.s = lerp(M.s, sat, 1 - Math.exp(-3 * dt)); M.d = lerp(M.d, density, 1 - Math.exp(-3 * dt)); M.sp = lerp(M.sp, speed, 1 - Math.exp(-3 * dt));
  if (M.b.length < 18) for (let i = M.b.length; i < 18; i++) M.b.push({ x: hmHash(i) * W, y: hmHash(i + 40) * H, a: hmHash(i + 9) * 7, r: .18 + hmHash(i + 3) * .3 });
  g.save(); g.globalCompositeOperation = 'lighter'; const n = Math.round(6 + M.d * 12);
  for (let i = 0; i < n; i++) { const b = M.b[i]; b.a += dt * M.sp * (.3 + hmHash(i + 2)); b.x += Math.cos(b.a) * dt * M.sp * W * .06; b.y += Math.sin(b.a * .8) * dt * M.sp * H * .06; b.x = (b.x + W) % W; b.y = (b.y + H) % H; hmGlow(g, b.x, b.y, Math.min(W, H) * (b.r + M.d * .15) * (sus ? 1.5 : 1), `hsla(${hue + (hmHash(i) - .5) * 40},${M.s}%,${34 + M.v * 34}%,A)`, (.12 + M.v * .32) * (sus ? .7 : 1)); }
  if (sus) for (let i = 0; i < 5; i++) hmGlow(g, ((i * .27 + t * .02 * cm.motion) % 1) * W, H * (.35 + .3 * Math.sin(t * .2 + i)), Math.min(W, H) * .45, 'hsla(210,25%,85%,A)', .08);   // floating mist
  g.restore();
  // dominant chords crackle: thin bolts, never a full-screen flash, never closer than the comfort gap, none in Calm
  if (dom && cm.strobe > 0 && now - HMX.lastBolt > Math.max(cm.gap, 700) + hmHash(Math.floor(now / 1000)) * 900 && T.playing !== false) { HMX.lastBolt = now; const pts = []; let x = W * (.2 + Math.random() * .6), y = 0; while (y < H * (.45 + Math.random() * .3)) { pts.push([x, y]); x += (Math.random() - .5) * W * .06; y += H * (.03 + Math.random() * .04); } HMX.bolts.push({ t0: now, pts }); }
  HMX.bolts = HMX.bolts.filter(b => now - b.t0 < 260); HMX.bolts.forEach(b => { const a = 1 - (now - b.t0) / 260; g.strokeStyle = `rgba(230,235,255,${a * .55})`; g.lineWidth = 1.6; g.shadowColor = 'rgba(160,190,255,.8)'; g.shadowBlur = 8; g.beginPath(); b.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.shadowBlur = 0; });
  // resolution blooms (tension chord to a calm one, or a held tense note let go)
  if (HM.prevSym && now - HM.chT < 80 && HM.q.ten < .35 && lxQual(parseChord(HM.prevSym)).ten > .45) HMX.bloomT = now; if (now - HM.resT < 80) HMX.bloomT = now;
  const bp = (now - HMX.bloomT) / 2200; if (bp >= 0 && bp < 1) { g.save(); g.globalCompositeOperation = 'lighter'; hmGlow(g, W / 2, H / 2, Math.max(W, H) * (.1 + bp * .7), `hsla(${HM_TONE},95%,66%,A)`, (1 - bp) * .38 * (cm.flash == null ? 1 : Math.max(.3, cm.flash * 3))); g.strokeStyle = `hsla(${HM_TONE},95%,76%,${(1 - bp) * .5})`; g.lineWidth = 2; g.beginPath(); g.arc(W / 2, H / 2, Math.min(W, H) * (.05 + bp * .6), 0, 7); g.stroke(); g.restore(); }
  const fs = hmFz(W, H, 11), bars = [['Brightness', M.v], ['Saturation', M.s / 100], ['Density', M.d], ['Speed', M.sp]]; bars.forEach(([s, v], i) => { const y = H - 14 - (3 - i) * (fs + 8); hmText(g, s, 14, y, fs, 'rgba(255,255,255,.55)', 'left', 600); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(14 + fs * 7, y - fs * .8, 70, 5); g.fillStyle = `hsl(${hue},${Math.round(M.s)}%,62%)`; g.fillRect(14 + fs * 7, y - fs * .8, 70 * clamp(v, 0, 1), 5); });
  hmText(g, `${HM.sym || ''}  ·  ${sus ? 'suspended: mist' : dom ? 'dominant: lightning' : val > .1 ? 'major: warm gold' : val < -.1 ? 'minor: deep blue' : 'open'}`, 14, hmY(H, hmFz(W, H, 14)), hmFz(W, H, 14), 'rgba(255,255,255,.85)', 'left', 700);
}

/* ---------- 5 · Chord DNA ---------- */
function hmFlower(g, ch, cx, cy, size, rot, hue, al, detail) {
  const h = x => ch.iv.includes(x), q = h(3) && h(6) ? 'dim' : h(4) && h(8) ? 'aug' : (!h(3) && !h(4) && (h(2) || h(5))) ? 'sus' : h(3) ? 'min' : 'maj', ivs = [...new Set(ch.iv)].sort((a, b) => a - b);
  g.save(); g.translate(cx, cy); g.rotate(rot); g.lineJoin = 'round'; const layers = h(11) ? 2 : 1;
  for (let L = 0; L < layers; L++) {
    const sc = L ? .62 : 1, rr = L ? Math.PI / 12 : 0;
    ivs.forEach((iv, i) => {
      const a = iv / 12 * Math.PI * 2 - Math.PI / 2 + rr + (q === 'min' ? (i % 2 ? .12 : -.08) : 0), len = size * sc * (iv === 0 ? 1 : iv === 7 ? .92 : iv === 10 ? 1.12 : iv === 11 ? 1.04 : .8) * (q === 'min' && iv === 3 ? .86 : 1), wd = size * sc * (q === 'dim' ? .1 : q === 'aug' ? .13 : .2);
      g.save(); g.rotate(a + Math.PI / 2); g.beginPath();
      if (q === 'dim') { g.moveTo(0, 0); g.lineTo(wd, -len * .35); g.lineTo(0, -len); g.lineTo(-wd * .6, -len * .4); g.closePath(); }
      else if (q === 'aug') { g.moveTo(0, 0); g.lineTo(wd * .5, -len * .5); g.lineTo(0, -len * 1.1); g.lineTo(-wd * .5, -len * .5); g.closePath(); }
      else if (q === 'sus') { g.moveTo(0, -len * .1); g.quadraticCurveTo(wd * 1.5, -len * .5, 0, -len); g.quadraticCurveTo(-wd * 1.5, -len * .5, 0, -len * .1); }
      else if (iv === 10 && !h(11)) { g.moveTo(-wd * .25, 0); g.lineTo(0, -len * 1.18); g.lineTo(wd * .25, 0); g.closePath(); }
      else { g.moveTo(0, 0); g.lineTo(wd * 1.1, -len * .62); g.lineTo(0, -len); g.lineTo(-wd * 1.1, -len * .62); g.closePath(); if (q === 'min') { } }
      g.fillStyle = `hsla(${hue + (L ? 24 : 0) + i * 6},${q === 'dim' ? 45 : 80}%,${q === 'dim' ? 76 : 58 + L * 8}%,${al * (q === 'sus' ? .12 : .34) * (L ? .85 : 1)})`; g.fill(); g.strokeStyle = `hsla(${hue + (L ? 24 : 0)},90%,${q === 'dim' ? 86 : 72}%,${al * .9})`; g.lineWidth = detail ? 1.6 : 1; g.stroke();
      if (q === 'dim' && detail) { g.beginPath(); g.moveTo(0, -len * .35); g.lineTo(wd, -len * .35); g.moveTo(0, -len * .6); g.lineTo(-wd * .5, -len * .62); g.strokeStyle = `rgba(220,240,255,${al * .5})`; g.lineWidth = 1; g.stroke(); }
      g.restore();
    });
  }
  g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * size * .09, Math.sin(a) * size * .09); } g.closePath(); g.fillStyle = `hsla(${hue},95%,76%,${al})`; g.fill(); g.restore(); return q;
}
function hmDna(g, W, H, X) {
  const ch = HM.chord, cx = W / 2, cy = H * .47, size = Math.min(W, H * 1.3) * .3, now = HM.now, fs = hmFz(W, H, 12), q0 = ch ? lxQual(ch) : { val: 0, ten: 0 };
  if (HM.sym && ch && (!HMX.dnaHist.length || HMX.dnaHist[HMX.dnaHist.length - 1].sym !== HM.sym)) { HMX.dnaHist.push({ sym: HM.sym, ch }); if (HMX.dnaHist.length > 9) HMX.dnaHist.shift(); }
  const since = clamp((now - HM.chT) / 700, 0, 1), grow = 1 - Math.pow(1 - since, 3), fifths = ch ? lxFifths(ch.root) : 0, hue = lxHueOf(fifths);
  g.save(); g.globalCompositeOperation = 'lighter'; hmGlow(g, cx, cy, size * 1.6, `hsla(${hue},80%,55%,A)`, .16 + .1 * grow);
  if (ch) { const breathe = 1 + Math.sin(VZ.t * .9 * hmCm().motion) * .02 + (HM.fd >= .5 ? .02 : 0); const q = hmFlower(g, ch, cx, cy, size * grow * breathe, VZ.t * .06 * hmCm().motion, hue, 1, true); g.restore(); const nm = { maj: 'major: triangle symmetry', min: 'minor: rotated asymmetry', dim: 'diminished: crystalline shards', aug: 'augmented: even star points', sus: 'suspended: open petals' }[q] + (ch.iv.includes(11) ? ', layered for the maj7' : ch.iv.includes(10) ? ', one long spike for the b7' : ''); hmText(g, HM.sym, 14, hmY(H, hmFz(W, H, 26)), hmFz(W, H, 28), '#fff', 'left', 800); hmText(g, nm, 14, hmY(H, hmFz(W, H, 26)) + 8 + fs, fs * 1.1, 'rgba(255,255,255,.6)', 'left', 600); } else g.restore();
  const n = HMX.dnaHist.length, sz = Math.min(W / (n + 1) * .5, H * .075), y = H - sz * 1.9; HMX.dnaHist.forEach((e, i) => { const x = W / 2 + (i - (n - 1) / 2) * sz * 2.6; g.save(); g.globalCompositeOperation = 'lighter'; hmFlower(g, e.ch, x, y, sz, 0, lxHueOf(lxFifths(e.ch.root)), i === n - 1 ? 1 : .6, false); g.restore(); hmText(g, e.sym, x, y + sz * 1.55, fs * .9, i === n - 1 ? '#fff' : 'rgba(255,255,255,.5)', 'center', 700); });
}

/* ---------- 7 · Intonation Constellation ---------- */
function hmStars(g, W, H, X) {
  const cx = W / 2, fs = hmFz(W, H, 11), lo = (VOX.vlo || 48) - 2, hi = Math.max(lo + 12, (VOX.vhi || 76) + 2), now = HM.now, t = VZ.t, st = HM.stars, span = W * .44;
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(200,215,255,${.08 + hmHash(i + 5) * .18 + Math.sin(t * (.4 + hmHash(i)) + i) * .04})`; g.fillRect(hmHash(i) * W, hmHash(i + 60) * H, 1.2, 1.2); }
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.setLineDash([3, 8]); g.beginPath(); g.moveTo(cx, H * .08); g.lineTo(cx, H * .92); g.stroke(); g.setLineDash([]);
  hmText(g, 'flat', cx - span, H - 14, fs, 'rgba(120,170,255,.55)', 'center', 700); hmText(g, 'in tune', cx, H - 14, fs, 'rgba(255,255,255,.55)', 'center', 700); hmText(g, 'sharp', cx + span, H - 14, fs, 'rgba(255,170,100,.55)', 'center', 700);
  const pos = s => [cx + clamp(s.c, -50, 50) / 50 * span + (s.k - .5) * 10, H * .9 - clamp((s.m - lo) / (hi - lo), 0, 1) * H * .78 + (hmHash(s.k * 99) - .5) * H * .02], elapsed = (now - HM.t0);
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineWidth = 1; let prev = null;
  st.forEach((s, i) => {
    const [x, y] = pos(s), acc = 1 - Math.min(1, Math.abs(s.c) / 40), age = (elapsed - s.t) / 1000, al = Math.max(.32, 1 - age / 900), hue = s.c > 6 ? 28 : s.c < -6 ? 214 : 55, sat = Math.abs(s.c) < 8 ? 0 : 80, tw = .8 + .2 * Math.sin(t * 3 + i), r = (1.6 + acc * 3.2) * tw;
    if (prev && s.t - prev.t < 1600 && (() => { const [px, py] = pos(prev); return Math.hypot(px - x, py - y) < W * .14; })()) { const [px, py] = pos(prev); g.strokeStyle = `rgba(190,205,255,${.1 * al})`; g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke(); }
    hmGlow(g, x, y, r * 4, `hsla(${hue},${sat}%,${acc > .8 ? 92 : 72}%,A)`, .5 * al); g.fillStyle = `hsla(${hue},${sat}%,${acc > .8 ? 96 : 80}%,${al})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); prev = s;
  });
  if (HM.vm != null) { const c = (HM.vm - Math.round(HM.vm)) * 100, [x, y] = pos({ c, m: Math.round(HM.vm), k: .5 }); g.strokeStyle = `hsla(${Math.abs(c) < 8 ? 55 : c > 0 ? 28 : 214},85%,80%,.9)`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 9 + Math.sin(t * 8) * 2, 0, 7); g.stroke(); }
  g.restore(); const good = st.filter(s => Math.abs(s.c) <= 15).length, pct = st.length ? Math.round(good / st.length * 100) : 0;
  hmText(g, st.length ? `${st.length} stars · ${pct}% within 15 cents` : 'Sing a note and hold it: it becomes a star', 14, hmY(H, hmFz(W, H, 14)), hmFz(W, H, 14), 'rgba(255,255,255,.85)', 'left', 700);
  hmText(g, HM.vm != null ? `${voxNote(Math.round(HM.vm))}  ${(HM.vc >= 0 ? '+' : '') + Math.round(HM.vc)}¢` : '', W - 14, hmY(H, hmFz(W, H, 22)), hmFz(W, H, 24), 'rgba(255,255,255,.6)', 'right', 800);
}

/* ---------- 8 · Rhythm Flow ---------- */
function hmFlow(g, W, H, X) {
  const gw = 120, gh = clamp(Math.round(gw * H / W), 36, 84), now = HM.now, sp = spb(), cm = hmCm();
  if (!HMX.wave || HMX.wave.gw !== gw || HMX.wave.gh !== gh) { const c = document.createElement('canvas'); c.width = gw; c.height = gh; HMX.wave = { gw, gh, h: new Float32Array(gw * gh), v: new Float32Array(gw * gh), cv: c, id: c.getContext('2d').createImageData(gw, gh) }; HMX.flow = Array.from({ length: 160 }, (_, i) => ({ x: hmHash(i) * W, y: hmHash(i + 77) * H, s: .6 + hmHash(i + 9) })); }
  const Wv = HMX.wave, h = Wv.h, v = Wv.v, on = HM.onsets;
  // new onsets: where in the bar they fell decides where the wave starts; the downbeat is the biggest
  for (const o of on) { if (o.t <= HMX.onsDone) continue; HMX.onsDone = o.t; const bar = o.slot >= 0 ? ((o.slot % sp) + sp) / sp % 1 : .5, x = Math.round(clamp(bar, .02, .98) * (gw - 1)), y = Math.round(gh * (o.m != null ? 1 - clamp((o.m - 36) / 50, .1, .9) : .5)), down = o.slot >= 0 && Math.round(o.slot) % sp === 0, beat = o.slot >= 0 && Math.round(o.slot) % 4 === 0, sync = o.slot >= 0 && Math.round(o.slot) % 4 === 2, amp = o.a * (down ? 2.4 : beat ? 1.5 : 1) * 2.4;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < gw && yy >= 0 && yy < gh) h[yy * gw + xx] += amp * Math.exp(-(dx * dx + dy * dy) / 3); }
    if (sync) HMX.vort.push({ x, y, t0: now, s: o.a }); }
  HMX.vort = HMX.vort.filter(q => now - q.t0 < 1500);
  HMX.vort.forEach(q => { const age = (now - q.t0) / 1500, rad = 7 + age * 5; for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) { const xx = q.x + dx, yy = q.y + dy; if (xx < 1 || xx >= gw - 1 || yy < 1 || yy >= gh - 1) continue; const r = Math.hypot(dx, dy); if (r > rad) continue; h[yy * gw + xx] += .09 * q.s * (1 - age) * Math.sin(Math.atan2(dy, dx) * 3 - now / 140) * (1 - r / rad); } });
  if (Math.abs(HM.dev) > .2) for (let k = 0; k < 14; k++) h[(Math.random() * h.length) | 0] += (Math.random() - .5) * .2 * clamp((Math.abs(HM.dev) - .15) * 4, 0, 1);   // rushing or dragging disturbs the flow
  for (let it = 0; it < 2; it++) { for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) { const i = y * gw + x; v[i] += ((h[i - 1] + h[i + 1] + h[i - gw] + h[i + gw]) * .25 - h[i]) * .5; } for (let i = 0; i < h.length; i++) { v[i] *= .985; h[i] += v[i]; h[i] *= .995; } }
  const id = Wv.id.data, steady = 1 - clamp(Math.abs(HM.dev) * 4, 0, 1), warm = 1 - steady; for (let i = 0; i < h.length; i++) { const a = clamp(Math.abs(h[i]) * 2.6, 0, 1), k = i * 4; id[k] = 6 + 235 * a * (.25 + warm * .75) + 30 * warm; id[k + 1] = 28 + 210 * a * (.85 - warm * .4); id[k + 2] = 46 + 205 * a * (1 - warm * .55) + 24 * (1 - a); id[k + 3] = 255; }
  Wv.cv.getContext('2d').putImageData(Wv.id, 0, 0); g.imageSmoothingEnabled = true; g.globalAlpha = .95; g.drawImage(Wv.cv, 0, 0, W, H); g.globalAlpha = 1;
  // the bar laid out left to right: beat lines and the playhead, so a steady groove draws the same shape each bar
  const nb = S.ts[0]; g.strokeStyle = 'rgba(255,255,255,.08)'; for (let b = 0; b < nb; b++) { const x = b / nb * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } if (T.playing && E.ctx) { const ph = playheadSlot(); if (ph >= 0) { const x = ((ph % sp) / sp) * W; g.strokeStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } }
  g.save(); g.globalCompositeOperation = 'lighter'; const spd = (T.playing ? 40 + S.bpm * .8 : 24) * W / 900 * cm.motion; HMX.flow.forEach(p => { const jit = warm * 40; p.x += spd * p.s * HM.dt; p.y += (Math.sin(p.x * .01 + now / 900 + p.s * 6) * 14 + (Math.random() - .5) * jit) * HM.dt; if (p.x > W) { p.x = 0; p.y = Math.random() * H; } g.strokeStyle = `hsla(${200 - warm * 170},80%,70%,${.12 + steady * .16})`; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x - 14 * p.s, p.y); g.lineTo(p.x, p.y); g.stroke(); }); g.restore();
  const fs = hmFz(W, H, 12), dev = HM.dev; hmText(g, T.playing ? (Math.abs(dev) < .12 ? 'Steady groove: a stable current' : dev < 0 ? 'Rushing: the flow is disturbed' : 'Dragging: the flow is disturbed') : 'Press play and strike notes: each one is a wave', 14, hmY(H, hmFz(W, H, 14)), hmFz(W, H, 14), 'rgba(255,255,255,.85)', 'left', 700); hmText(g, 'Downbeat: big wave · beat: wave · off-beat: whirlpool', 14, H - 12, fs, 'rgba(255,255,255,.45)', 'left', 600);
}

/* ---------- 9 · Harmonic Ecosystem ---------- */
function hmEco(g, W, H, X) {
  const E0 = HMX.eco, now = HM.now, dt = HM.dt, mo = hmCm().motion, t = VZ.t, minor = S.minor ? 1 : 0;
  E0.climate = lerp(E0.climate, minor, 1 - Math.exp(-.5 * dt)); const warm = 1 - E0.climate;
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, `hsl(${lerp(228, 24, warm)},${lerp(40, 55, warm)}%,${lerp(9, 16, warm)}%)`); sky.addColorStop(1, `hsl(${lerp(215, 160, warm)},35%,${lerp(6, 10, warm)}%)`); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // weather: warm pollen drifts up in a major key, cool rain falls in a minor one; a key change shows as a few seconds of both
  g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 36; i++) { const x = hmHash(i) * W, ph = (t * (.04 + hmHash(i + 3) * .05) * mo + hmHash(i + 8)) % 1; if (warm > .1) { g.fillStyle = `hsla(46,90%,70%,${.18 * warm})`; g.fillRect((x + Math.sin(t + i) * 12) % W, H * (1 - ph), 2, 2); } if (E0.climate > .1) { g.strokeStyle = `hsla(210,70%,75%,${.16 * E0.climate})`; g.beginPath(); g.moveTo(x, H * ph); g.lineTo(x - 3, H * ph + 14); g.stroke(); } } g.restore();
  // a note is a creature: kind by how it sits in the chord
  const spawn = (pc, m, kind, hue, big) => { const c = E0.col[E0.col.length - 1]; E0.cr.push({ x: clamp((m - 36) / 60, .03, .97) * W, y: H * (.12 + Math.random() * .6), vx: 0, vy: 0, a: Math.random() * 7, hue, kind, sz: (big ? 7 : 4.5) * Math.min(W, H) / 500, born: now, life: 16 + Math.random() * 14, col: c ? c.id : 0, ph: Math.random() * 6 }); if (E0.cr.length > 220) E0.cr.shift(); };
  for (const o of HM.onsets) { if (o.t <= (E0.lastOn || 0)) continue; E0.lastOn = o.t; if (o.m != null) { const pc = ((Math.round(o.m) % 12) + 12) % 12, cl = HM.cls[pc]; spawn(pc, o.m, cl, hmHue(HM.d[pc]), o.a > .6); E0.motif.push(pc); if (E0.motif.length > 4) E0.motif.shift(); if (E0.motif.length === 4) { const key = E0.motif.join('-'), hb = E0.hab[key] || (E0.hab[key] = { n: 0, x: hmHash(key.length * 7 + E0.motif[0] * 13 + E0.motif[1]) * W * .9 + W * .05, hue: lxHueOf(HM.chord ? lxFifths(HM.chord.root) : 0), grow: 0 }); hb.n++; if (hb.n >= 2) hb.grow = Math.min(1, hb.grow + .18); } } }
  if (HM.vm != null) { const pc = ((Math.round(HM.vm) % 12) + 12) % 12; if (pc !== E0.lastPc) { E0.lastPc = pc; spawn(pc, HM.vm, HM.cls[pc], hmHue(HM.d[pc]), true); } } else E0.lastPc = null;
  if (HM.sym && (!E0.col.length || E0.col[E0.col.length - 1].sym !== HM.sym)) { E0.col.push({ id: (E0.colId = (E0.colId || 0) + 1), sym: HM.sym, x: W * (.15 + Math.random() * .7), y: H * (.25 + Math.random() * .4), born: now, hue: lxHueOf(HM.chord ? lxFifths(HM.chord.root) : 0) }); if (E0.col.length > 6) E0.col.shift(); }
  E0.col.forEach(c => { const age = (now - c.born) / 1000, al = clamp(1 - age / 40, .15, 1); g.save(); g.globalCompositeOperation = 'lighter'; hmGlow(g, c.x, c.y, Math.min(W, H) * .2, `hsla(${c.hue},70%,55%,A)`, .1 * al); g.restore(); });
  // habitats: a repeated phrase grows a plant at the bottom
  Object.values(E0.hab).forEach((hb, i) => { const hh = H * (.06 + hb.grow * .26), sw = Math.sin(t * .7 * mo + i) * 8 * hb.grow; g.strokeStyle = `hsla(${hb.hue},55%,${35 + hb.grow * 22}%,.85)`; g.lineWidth = 2 + hb.grow * 2; g.beginPath(); g.moveTo(hb.x, H); g.quadraticCurveTo(hb.x + sw, H - hh * .5, hb.x + sw * 1.6, H - hh); g.stroke(); for (let k = 1; k <= 3 + Math.floor(hb.grow * 5); k++) { const f = k / (4 + hb.grow * 5), lx = hb.x + sw * (f * 1.6), ly = H - hh * f; g.fillStyle = `hsla(${hb.hue + 20},70%,${50 + k * 2}%,.8)`; g.beginPath(); g.ellipse(lx + (k % 2 ? 9 : -9), ly, 7 + hb.grow * 4, 3 + hb.grow * 2, k % 2 ? -.5 : .5, 0, 7); g.fill(); } });
  E0.cr = E0.cr.filter(c => (now - c.born) / 1000 < c.life);
  g.save(); g.globalCompositeOperation = 'lighter';
  E0.cr.forEach(c => { const age = (now - c.born) / 1000, al = clamp(Math.min(age * 2, 1) * (1 - age / c.life) * 1.4, 0, 1), col = E0.col.find(k => k.id === c.col); c.a += (Math.sin(t * .8 + c.ph) * .6) * dt * 2; c.vx += (Math.cos(c.a) * 12 + (col ? (col.x - c.x) * .04 : 0)) * dt * mo; c.vy += (Math.sin(c.a) * 12 + (col ? (col.y - c.y) * .04 : 0)) * dt * mo; c.vx *= .96; c.vy *= .96; c.x = clamp(c.x + c.vx * dt, 4, W - 4); c.y = clamp(c.y + c.vy * dt, 4, H * .9);
    const s = c.sz, fl = Math.sin(t * 5 + c.ph);
    if (c.kind === 'tone') { hmGlow(g, c.x, c.y, s * 4.5, `hsla(${c.hue},95%,62%,A)`, .5 * al); g.fillStyle = `hsla(${c.hue},95%,78%,${al})`; g.beginPath(); g.arc(c.x, c.y, s * .7, 0, 7); g.fill(); }
    else if (c.kind === 'colour') { g.fillStyle = `hsla(${c.hue},80%,66%,${al * .6})`; g.beginPath(); g.ellipse(c.x, c.y, s * 1.4, s * (1 + fl * .15), 0, Math.PI, 0); g.fill(); g.strokeStyle = `hsla(${c.hue},80%,76%,${al * .45})`; g.lineWidth = 1; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(c.x + k * s * .5, c.y); g.quadraticCurveTo(c.x + k * s * .5 + fl * 3, c.y + s * 1.6, c.x + k * s * .5 - fl * 2, c.y + s * 2.8); g.stroke(); } }
    else { g.fillStyle = `hsla(${c.hue},85%,58%,${al * .8})`; g.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + c.a, r = k % 2 ? s * .8 : s * 1.9; g[k ? 'lineTo' : 'moveTo'](c.x + Math.cos(a) * r, c.y + Math.sin(a) * r); } g.closePath(); g.fill(); } });
  g.restore();
  const fs = hmFz(W, H, 12), hab = Object.values(E0.hab).filter(x => x.n >= 2).length; hmText(g, `${E0.cr.length} creatures · ${E0.col.length} colonies · ${hab} habitats · ${warm > .5 ? 'major: warm' : 'minor: cool, rainy'}`, 14, hmY(H, hmFz(W, H, 14)), hmFz(W, H, 14), 'rgba(255,255,255,.82)', 'left', 700); hmText(g, E0.cr.length ? 'Gold lights: chord notes · teal jellyfish: colour notes · red thorns: tension. Repeat a phrase and a plant grows.' : 'Play or sing: every note becomes a creature', 14, H - 12, fs, 'rgba(255,255,255,.45)', 'left', 600);
}

/* ---------- 10 · Session Painting ---------- */
function hmPaintRender(c, w, h, pts, span, o) {
  o = o || {}; c.fillStyle = '#0b0e12'; c.fillRect(0, 0, w, h); const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(40,60,70,.35)'); gr.addColorStop(1, 'rgba(70,40,60,.25)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
  const X = t => t / span * w * .96 + w * .02, Y = m => h * .92 - clamp((m - 36) / 60, 0, 1) * h * .84; let prev = null; c.lineCap = 'round';
  pts.forEach((p, i) => {
    if (p.o) { const x = X(p.t), y = p.m != null ? Y(p.m) : h * .5, loose = Math.abs(p.dev || 0), n = 4 + Math.round(p.a * 6); for (let k = 0; k < n; k++) { const ang = hmHash(p.t * .01 + k) * 6.28, r = (hmHash(p.t * .02 + k * 3) * (3 + loose * 40)) * h / 600; c.fillStyle = `hsla(${p.h},70%,${70}%,${.35 * p.a})`; c.beginPath(); c.ellipse(x + Math.cos(ang) * r, y + Math.sin(ang) * r, (1 + p.a * 1.6) * h / 600, (1 + loose * 4) * h / 600, ang, 0, 7); c.fill(); } prev = null; return; }
    const x = X(p.t), y = Y(p.m); if (prev && p.t - prev.t < 350 && Math.abs(p.m - prev.m) < 2.6) { c.strokeStyle = `hsla(${p.h},${60 + p.ten * 30}%,${p.v ? 62 : 52}%,${p.v ? .6 : .5})`; c.lineWidth = (1.2 + p.lv * 6.5) * h / 560; c.beginPath(); c.moveTo(X(prev.t), Y(prev.m)); c.lineTo(x, y); c.stroke(); } prev = p;
  });
  if (o.now != null) { c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1; const x = X(o.now); c.beginPath(); c.moveTo(x, h * .04); c.lineTo(x, h * .96); c.stroke(); }
}
function hmPaint(g, W, H, X) {
  const now = HM.now, el = now - HM.t0, span = Math.max(90000, el * 1.04), pts = HM.paint;
  if (!HMX.paintCv || HMX.paintCv.width !== W || HMX.paintCv.height !== H) { HMX.paintCv = document.createElement('canvas'); HMX.paintCv.width = W; HMX.paintCv.height = H; HMX.paintN = -1; }
  if (now - HMX.paintAt > 450 && (pts.length !== HMX.paintN || Math.abs(span - HMX.paintSpan) > 1)) { HMX.paintAt = now; HMX.paintN = pts.length; HMX.paintSpan = span; hmPaintRender(HMX.paintCv.getContext('2d'), W, H, pts, span, {}); }
  g.drawImage(HMX.paintCv, 0, 0); g.strokeStyle = 'rgba(255,255,255,.22)'; const x = el / span * W * .96 + W * .02; g.beginPath(); g.moveTo(x, H * .04); g.lineTo(x, H * .96); g.stroke();
  const fs = hmFz(W, H, 12), mm = Math.floor(el / 60000), ss = String(Math.floor(el / 1000) % 60).padStart(2, '0');
  hmText(g, `This session · ${mm}:${ss}`, 14, hmY(H, hmFz(W, H, 14)), hmFz(W, H, 14), 'rgba(255,255,255,.85)', 'left', 700); hmText(g, 'Height: pitch · colour: harmony · speckle: rhythm (loose timing smears) · stroke weight: how hard you played', 14, H - 12, fs, 'rgba(255,255,255,.45)', 'left', 600);
  if (!pts.length) hmText(g, 'Play or sing and the session paints itself', W / 2, H / 2, hmFz(W, H, 16), 'rgba(255,255,255,.55)', 'center', 700);
}
bus.on('onset', () => { const o = HM.onsets[HM.onsets.length - 1]; if (!o || o.m == null) return; HM.paint.push({ t: o.t - HM.t0, m: o.m, h: lxHueOf(HM.chord ? lxFifths(HM.chord.root) : 0), o: 1, a: o.a, dev: o.dev }); if (HM.paint.length > 9000) HM.paint.splice(0, 1500); });

/* ---------- saving the picture, and the small controls over the canvas ---------- */
function hmSave() {
  const m = VZ.mode; let cv;
  if (m === 'paint') { cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080; const c = cv.getContext('2d'); hmPaintRender(c, 1920, 1080, HM.paint, Math.max(90000, (performance.now() - HM.t0) * 1.04), {}); c.font = '600 28px ui-sans-serif,system-ui,sans-serif'; c.fillStyle = 'rgba(255,255,255,.7)'; c.fillText(`${S.title || 'Practice'} · ${new Date().toLocaleDateString()} · the-daily.studio`, 40, 1050); }
  else cv = UI.vcv; if (!cv) return;
  cv.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${m === 'paint' ? 'practice' : m}-${new Date().toISOString().slice(0, 10)}.png`; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); toast('Picture saved', ''); }, 'image/png');
}
function hmCtl(mode, g) {
  if (g.canvas !== UI.vcv || !UI.vwrap) return; let c = HMX.ctl;
  if (!c || !c.isConnected) { c = HMX.ctl = h('div', { class: 'hm-ctl', role: 'group', 'aria-label': 'Session' }, h('button', { class: 'btn sm', id: 'hmNew', title: 'Start again: a clear sky, a blank painting, an empty world', onclick: () => hmClear() }, '↺ New session'), h('button', { class: 'btn sm', id: 'hmSave', title: 'Save this picture as an image on this device', onclick: () => hmSave() }, '⬇ Save picture')); UI.vwrap.style.position = 'relative'; UI.vwrap.append(c); }
  const show = mode === 'stars' || mode === 'paint' || mode === 'eco'; if (c.hidden === show) c.hidden = !show;
}
const HM_DRAW = { gravity: hmGravity, field: hmField, swarms: hmSwarms, terrain: hmTerrain, mood: hmMood, dna: hmDna, stars: hmStars, fluid: hmFlow, eco: hmEco, paint: hmPaint };
function hmDraw(mode, g, W, H, X) {
  hmUpdate(); hmCtl(mode, g); g.save(); g.textBaseline = 'alphabetic';
  try { HM_DRAW[mode](g, W, H, X); } catch (e) { if (!HMX.err) { HMX.err = 1; console.warn('harmony look', mode, e); } } g.restore(); g.textAlign = 'left'; g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
}
