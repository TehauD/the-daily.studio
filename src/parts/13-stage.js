/* ============================================================
   Part 13 · LIVE STAGE — show-ready visuals: 8 scenes (six looks, a prompter, you in front), post-FX (trails / kaleidoscope / glow / hue),
   song HUD (chord, section, lyric, beat), fullscreen + pop-out, MIDI out (clock, chord roots, onsets)
   ============================================================ */
VMODES.push(['bloom', 'Chord Bloom'], ['orbit', 'Harmonic Orrery'], ['joy', 'Ridgeline'], ['pulse', 'Beat Grid'], ['prompter', 'Prompter']);
const SCN0 = (name, mode, hue, o) => Object.assign({ name, mode, hue, drift: 0, trail: .5, kal: 0, glow: .5, sens: 1, cam: false, flash: 0, sect: '', ov: { chord: true, lyric: false, beat: false, tuner: false, info: false } }, o || {});
/** a scene that runs a starter show (a Concert design: palette, rig, lasers, motion; see part 56) */
const SHOWSC = (name, id, o) => SCN0(name, 'concert', 38, Object.assign({ trail: 0, glow: .45, show: { design: id, ovr: {} }, ov: { chord: true, lyric: true, beat: false, tuner: false, info: true } }, o || {}));
const starterScenes = () => [SHOWSC('Theatre', 'theatre'), SHOWSC('Backlight', 'backlight'), SHOWSC('Blades', 'blades'), SHOWSC('Pixel field', 'pixels'), SHOWSC('Horizon', 'horizon'), SHOWSC('Laser room', 'lasers'),
  SCN0('Lyric prompter', 'prompter', 175, { glow: .3, ov: { chord: true, lyric: true, beat: true, tuner: false, info: true } }), SHOWSC('Me in front', 'theatre', { cam: true, ov: { chord: true, lyric: false, beat: false, tuner: true, info: false } })];
const STG_V = 4, STG_LEGACY = 'Concert|concert|38,Kaleido bloom|bloom|300,Resonance|hex|175,Orrery|orbit|40,Ridgeline|joy|150,Beat grid|pulse|20,Lyric prompter|prompter|175,Strings + cam|strings|175';
/** the eight scenes 2.5.0 shipped (six starter shows, the prompter, you in front), recognised by name, mode and design */
const STG_V25 = 'Arena|concert|arena,Neon Laser|concert|neon,Campfire|concert|campfire,Aurora|concert|aurora,Noir Club|concert|noir,Golden Hour|concert|golden,Lyric prompter|prompter|,Me in front|concert|golden';
const STG = Object.assign({ cur: 0, safe: true, q: 1, out: '', clock: false, roots: false, trig: false, ccs: false, ch: 0, auto: false, hud: true, scenes: starterScenes() }, CFG.stage || {});
STG.scenes.forEach(s => { if (s.mode === 'tunnel') { s.mode = 'concert'; if (s.name === 'Tunnel') s.name = 'Concert'; s.trail = 0; s.flash = 0; } });
/* scenes nobody has touched become the starter shows; scenes you made or changed are left exactly as they are (Stage ▸ Starter shows brings the new ones back) */
if ((STG.v || 0) < STG_V) { if (STG.scenes.map(s => [s.name, s.mode, s.hue].join('|')).join(',') === STG_LEGACY || STG.scenes.map(s => [s.name, s.mode, (s.show && s.show.design) || ''].join('|')).join(',') === STG_V25) STG.scenes = starterScenes(); STG.v = STG_V; }
while (STG.scenes.length < 8) STG.scenes.push(SCN0('Scene ' + (STG.scenes.length + 1), 'hex', 175));
const saveStg = () => { CFG.stage = STG; saveCfg(); };
const SG = { off: null, small: null, wrap: null, cv: null, flash: 0, lastFlash: 0, idleT: 0, pop: null, wl: null, tick: -1, lastSym: '', lastSec: '', playPrev: false, noteOn: null, ccT: 0, joy: [], lastPos: '', hudDirty: 1 };
const scn = () => STG.scenes[STG.cur];
const hex2 = n => ('0' + Math.round(n).toString(16)).slice(-2);
function hsl(hh, s, l) { hh = ((hh % 360) + 360) % 360; s /= 100; l /= 100; const k = n => (n + hh / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return '#' + hex2(f(0) * 255) + hex2(f(8) * 255) + hex2(f(4) * 255); }
function stagePal(sc, t) { const hh = sc.hue + (sc.drift || 0) * t * 12; return { a: hsl(hh, 90, 58), b: hsl(hh + 55, 95, 66), c: hsl(hh + 120, 80, 58), d: hsl(hh + 200, 80, 62) }; }
const stageOwnsKeys = () => !!(SG.cv && (paneVisible('stage') || document.fullscreenElement === SG.wrap));
function stageScene(i) { if (i < 0 || i > 7) return; STG.cur = i; SG.hudDirty = 1; VZ.spec = null; saveStg(); renderStageUI(); toast('Stage: ' + STG.scenes[i].name); }

/* ---------- song position → HUD info ---------- */
function stageInfo() {
  const o = { playing: T.playing, sym: null, next: null, sec: '', barIn: 0, nBars: 0, beat: 0, nBeats: S.ts[0], lyric: '', slot: 0 };
  const live = AN.active && AN.chord && AN.chord[0] ? AN.chord[0].sym : null;
  if (T.playing && E.ctx) {
    const sp = spb(), ph = playheadSlot(); o.slot = ph; if (ph < 0) { o.beat = Math.floor(((ph % sp) + sp) % sp / (16 / S.ts[1])); o.sec = 'Count-in'; return o; }
    const bi = Math.floor(ph / sp), sib = ph - bi * sp, fb = barsCache()[bi]; if (!fb) return o; const cd = chordAt(bi, Math.floor(sib));
    o.sym = cd && cd.sym; o.next = cd && cd.next; o.sec = fb.sec.name; o.barIn = fb.bi + 1; o.nBars = fb.sec.bars.length; o.beat = Math.floor(sib / (16 / S.ts[1]));
    const ls = (fb.sec.lyrics || '').split('\n').filter(l => l.trim()); if (ls.length) { const idx = Math.min(ls.length - 1, Math.floor(fb.bi / fb.sec.bars.length * ls.length)); o.lyric = parseLyricLine(ls[idx]).text; o.lyricNext = ls[idx + 1] ? parseLyricLine(ls[idx + 1]).text : ''; }
  } else { o.sym = live; o.sec = 'Listening'; }
  return o;
}

/* ---------- extra visual modes (dispatched from drawVis) ---------- */
function stageExtra(mode, g, W, H, X) {
  if (typeof HM_MODES !== 'undefined' && HM_MODES.has(mode)) return hmDraw(mode, g, W, H, X);
  if (mode === 'concert') return concertDraw(g, W, H, X);
  if (mode === 'neural') return ngStageDraw(g, W, H, X);
  if (mode === 'halo' || mode === 'kaleido') return vzExtra2(mode, g, W, H, X);
  const { fd, bin, lvl, C, pulse, energy, dt } = X, cx = W / 2, cy = H / 2, R = Math.min(W, H), ch = AN.chroma || new Array(12).fill(0), mx = Math.max(.001, ...ch), t = VZ.t;
  if (mode === 'bloom') {
    const rot = t * (.12 + energy * .5); g.save(); g.translate(cx, cy); g.globalCompositeOperation = 'lighter';
    for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 12; i++) {
      const pc = (i * 7) % 12, v = Math.pow(ch[pc] / mx, 1.3) * (AN.active ? 1 : .15) + .06, a = (i / 12) * Math.PI * 2 + rot * (layer % 2 ? -1 : 1) + layer * .26, len = R * (.1 + .36 * v) * (1 + layer * .22 + pulse * .25), w = R * .05 * (1 + v * 1.4);
      g.save(); g.rotate(a); g.beginPath(); g.moveTo(R * .035, 0); g.quadraticCurveTo(len * .5, -w, len, 0); g.quadraticCurveTo(len * .5, w, R * .035, 0); g.fillStyle = mixc(C.a, C.b, v, (.16 + .3 * v) / (1 + layer * .4)); g.fill(); g.strokeStyle = mixc(C.c, C.b, v, .22 * (1 + v)); g.lineWidth = 1.2; g.stroke(); g.restore();
    }
    g.rotate(-rot); hexPath(g, 0, 0, R * (.045 + energy * .06 + pulse * .04)); g.fillStyle = mixc(C.b, C.a, pulse, .85); g.fill(); g.restore();
  } else if (mode === 'orbit') {
    const key = AN.key && AN.key[0], chord = AN.active && AN.chord[0] ? parseChord(AN.chord[0].sym) : null, pts = [];
    g.save(); g.translate(cx, cy);
    for (let i = 0; i < 12; i++) {
      const pc = (i * 7) % 12, v = ch[pc] / mx, rr = R * (.1 + (i % 6) * .055 + (i >= 6 ? .02 : 0)) + R * .06, sp = (.08 + i * .012) * (1 + energy), a = t * sp * (i % 2 ? 1 : -1) + i * 0.52;
      g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, rr, 0, 7); g.stroke();
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr, inCh = chord && chord.pcs.includes(pc); if (inCh) pts.push([x, y]);
      const sz = R * (.008 + .028 * v) + (inCh ? R * .012 : 0) + pulse * R * .006; g.shadowColor = C.a; g.shadowBlur = 8 + v * 22; g.fillStyle = inCh ? C.b : mixc(C.a, C.c, v, .35 + .6 * v); g.beginPath(); g.arc(x, y, sz, 0, 7); g.fill(); g.shadowBlur = 0;
      g.fillStyle = 'rgba(255,255,255,' + (.35 + .5 * v) + ')'; g.font = `700 ${Math.round(R * .026)}px ui-monospace,monospace`; g.textAlign = 'center'; g.fillText(pcName(pc), x, y - sz - R * .01);
    }
    if (pts.length > 1) { g.beginPath(); pts.forEach((q, i) => g[i ? 'lineTo' : 'moveTo'](q[0], q[1])); g.closePath(); g.fillStyle = mixc(C.b, C.a, .5, .16); g.fill(); g.strokeStyle = mixc(C.b, C.a, .5, .8); g.lineWidth = 2; g.stroke(); }
    g.fillStyle = mixc(C.a, C.b, .5, .9); hexPath(g, 0, 0, R * (.02 + pulse * .02)); g.fill(); g.restore(); g.textAlign = 'left';
  } else if (mode === 'joy') {
    const N = 96, rows = 30, fmin = 70, fmax = 6000, lr = Math.log(fmax / fmin), row = new Float32Array(N); for (let i = 0; i < N; i++) { const f = fmin * Math.exp(i / (N - 1) * lr); row[i] = lvl(fd[bin(f)]); }
    SG.joy.unshift(row); if (SG.joy.length > rows) SG.joy.pop(); g.fillStyle = '#050b0c'; g.fillRect(0, 0, W, H);
    for (let r = SG.joy.length - 1; r >= 0; r--) {
      const rw = SG.joy[r], y0 = H * .34 + (r / rows) * H * .58, k = 1 - r / rows, amp = H * .2 * (.5 + k * .7); g.beginPath(); g.moveTo(W * .05, y0);
      for (let i = 0; i < N; i++) g.lineTo(W * .05 + i / (N - 1) * W * .9, y0 - Math.pow(rw[i], 1.6) * amp); g.lineTo(W * .95, y0); g.closePath(); g.fillStyle = 'rgba(5,11,12,.92)'; g.fill();
      g.lineWidth = 1 + k * 1.6; g.strokeStyle = mixc(C.c, C.a, k, .25 + .75 * k); g.stroke();
    }
  } else if (mode === 'pulse') {
    const sz = Math.max(26, R / 12), hw = sz * Math.sqrt(3), cols = Math.ceil(W / hw) + 2, rows = Math.ceil(H / (sz * 1.5)) + 2, info = SG.info || {}, beatP = (info.playing ? ((info.slot % (16 / S.ts[1])) / (16 / S.ts[1])) : (t * 1.5) % 1), dn = 1 - beatP;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = c * hw + (r % 2 ? hw / 2 : 0) - hw / 2, y = r * sz * 1.5, u = x / W, d = Math.hypot(x - cx, y - cy) / (Math.hypot(cx, cy)), band = lvl(fd[bin(80 * Math.pow(60, clamp(u, 0, 1)))]), ring = pulse * Math.max(0, 1 - Math.abs(d - (1 - pulse) * 1.1) * 7), downb = (info.beat === 0 && info.playing ? Math.max(0, 1 - d * 1.4) * dn * dn : 0), v = clamp(band * .9 + ring + downb * .8, 0, 1.2);
      hexPath(g, x, y, sz * .93 * (.55 + .45 * Math.min(1, v + .15))); g.fillStyle = mixc(C.c, C.b, clamp(v, 0, 1), .06 + .8 * clamp(v, 0, 1)); g.fill();
    }
  } else if (mode === 'prompter') {
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R * (.55 + energy * .4)); gr.addColorStop(0, mixc(C.a, C.b, .3, .16 + pulse * .2)); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
}

/* ---------- stage frame: render, post-FX, HUD, MIDI out ---------- */
function stageFrame(ts) {
  stageMidiTick();
  if (!SG.cv || !E.ready || !(paneVisible('stage') || document.fullscreenElement === SG.wrap || SG.pop)) return;
  const sc0 = scn(), wrap = SG.wrap, d = (window.devicePixelRatio || 1) * STG.q, cw = wrap.clientWidth, chh = wrap.clientHeight; if (!cw || !chh) return;
  const w = Math.min(1920, Math.floor(cw * d)), hh = Math.min(1080 * 1.4, Math.floor(chh * d));
  if (SG.cv.width !== w || SG.cv.height !== hh) { SG.cv.width = w; SG.cv.height = hh; SG.off.width = w; SG.off.height = hh; SG.small.width = Math.max(2, w >> 2); SG.small.height = Math.max(2, hh >> 2); VZ.spec = null; SG.joy = []; }
  /* output: a frame-rate cap, a frozen picture and the test patterns are decided before anything is drawn (Show setup ▸ Output, part 59) */
  const OUT = CFG.show.out, g0 = SG.cv.getContext('2d');
  if (OUT.fps > 0 && OUT.fps < 60 && SG.drawT && ts - SG.drawT < 1000 / OUT.fps - 4) return; SG.drawT = ts;
  if (SG.freeze && SG.frz) { g0.drawImage(SG.frz, 0, 0, w, hh); shOutFrame(g0, w, hh); return; }
  if (SG.test) { shTestPattern(g0, w, hh, SG.test); shOutFrame(g0, w, hh); return; }
  const info = SG.info = stageInfo(), sc = pbScene(sc0, info), t = VZ.t, C = sc.mode === 'concert' ? lxHudPal(sc) : stagePal(sc, t), off = SG.off, g = SG.cv.getContext('2d');
  if (pbSolid()) pbFill(off); else drawVis(off, { mode: sc.mode, C, bgA: sc.mode === 'joy' || sc.mode === 'spectro' ? 1 : clamp(1 - sc.trail * .93, .05, 1), noText: true, cam: sc.cam, gain: (sc.sens - 1) * 20, show: sc.show, stage: true });
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, 0, w, hh);
  if (sc.kal >= 3) {
    const n = sc.kal, cx = w / 2, cy = hh / 2, R = Math.hypot(cx, cy); for (let i = 0; i < n; i++) {
      g.save(); g.translate(cx, cy); g.rotate(i * 2 * Math.PI / n + t * .05 * (sc.drift || 0)); if (i % 2) g.scale(1, -1); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, -Math.PI / n, Math.PI / n); g.closePath(); g.clip(); g.drawImage(off, -cx, -cy); g.restore();
    }
  } else g.drawImage(off, 0, 0);
  if (sc.cam && sc.mode !== 'spectro') camTop(g, w, hh);
  if (sc.mode === 'halo' && !pbSolid()) haloFront(g);
  if (sc.glow > .02) { const q = SG.small.getContext('2d'); q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, SG.small.width, SG.small.height); q.drawImage(SG.cv, 0, 0, SG.small.width, SG.small.height); g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = sc.glow * .9; g.imageSmoothingQuality = 'high'; g.drawImage(SG.small, 0, 0, w, hh); g.globalAlpha = sc.glow * .5; g.drawImage(SG.small, -w * .02, -hh * .02, w * 1.04, hh * 1.04); g.restore(); }
  pbDim(g, w, hh);
  if (sc.flash > 0 && SG.flash > .01) { g.fillStyle = 'rgba(255,255,255,' + (SG.flash * sc.flash * lxComfort().flash * LX.gov).toFixed(3) + ')'; g.fillRect(0, 0, w, hh); SG.flash *= .88; }
  if (sc.mode === 'concert' && !pbSolid()) lxGovMeasure(SG.cv, performance.now());   // the governor looks at the finished picture
  if (pbOn()) { if (STG.pb.lower) drawLowerThird(g, w, hh, info, C); } else if (STG.hud !== false) drawStageHUD(g, w, hh, sc, info, C);
  if (SG.freezeReq) { const f = SG.frz || (SG.frz = document.createElement('canvas')); f.width = w; f.height = hh; f.getContext('2d').drawImage(SG.cv, 0, 0); SG.freeze = true; SG.freezeReq = false; }
  shOutFrame(g, w, hh);   // master level, blackout, mirror, flip
  if (SG.idle && ts - SG.idleT > 2800 && document.fullscreenElement === wrap) wrap.classList.add('idle');
}
function drawStageHUD(g, W, H, sc, info, C) {
  const lens = sc.mode === 'concert' ? (CFG.lens || 'perform') : '', teach = lens === 'teach'; if (lens === 'sky') return;       // the Sky lens is a picture; the Teach lens carries its own chord card, so only the lyric stays
  const ov = sc.ov, u = Math.min(W, H * 1.6), mono = 'ui-monospace,Menlo,monospace', pr = sc.mode === 'prompter', sh = 'rgba(0,0,0,.65)'; g.save(); g.shadowColor = sh; g.shadowBlur = u * .02; g.textBaseline = 'alphabetic';
  if (ov.chord && !teach) {
    const sym = info.sym || '', sz = u * (pr ? .26 : .14); g.font = `800 ${Math.round(sz)}px ${mono}`; g.textAlign = pr ? 'center' : 'left'; g.fillStyle = '#fff';
    const x = pr ? W / 2 : W * .04, y = pr ? H * .46 : H * .84; g.fillText(sym, x, y);
    if (info.next && info.playing) { g.font = `700 ${Math.round(sz * .34)}px ${mono}`; g.fillStyle = C.b; g.fillText('next  ' + info.next, x, y + (pr ? sz * .38 : -sz * .92)); }
  }
  if ((ov.info || ov.beat) && !teach) {
    g.textAlign = 'right'; g.font = `700 ${Math.round(u * .03)}px ${mono}`; g.fillStyle = 'rgba(255,255,255,.85)';
    if (ov.info) { const key = AN.key && AN.key[0]; g.fillText((info.sec ? info.sec.toUpperCase() + (info.nBars ? '  ' + info.barIn + '/' + info.nBars : '') : '') , W * .97, H * .07); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(Math.round(S.bpm) + ' BPM · ' + S.ts[0] + '/' + S.ts[1] + (key ? ' · ' + pcName(key.root) + (key.minor ? 'm' : '') : ''), W * .97, H * .07 + u * .042); }
    if (ov.beat) { const n = S.ts[0], r = u * .016, gap = r * 3.2, x0 = W * .97 - (n - 1) * gap - r; for (let i = 0; i < n; i++) { const on = info.playing && i === info.beat; g.beginPath(); g.arc(x0 + i * gap, H * (ov.info ? .07 + .09 : .07), r * (on ? 1.5 : 1), 0, 7); g.fillStyle = on ? (i === 0 ? C.b : '#fff') : 'rgba(255,255,255,.22)'; g.fill(); } }
  }
  if (ov.lyric && info.lyric && teach) { g.textAlign = 'center'; g.font = `700 ${Math.round(u * .04)}px ${mono}`; g.fillStyle = '#fff'; g.fillText(info.lyric, W / 2, H * .955, W * .92); }
  else if (ov.lyric && info.lyric) { g.textAlign = 'center'; g.font = `700 ${Math.round(u * (pr ? .06 : .045))}px ${mono}`; g.fillStyle = '#fff'; g.fillText(info.lyric, W / 2, H * (pr ? .72 : .76), W * .92); if (info.lyricNext) { g.font = `600 ${Math.round(u * .03)}px ${mono}`; g.fillStyle = 'rgba(255,255,255,.5)'; g.fillText(info.lyricNext, W / 2, H * (pr ? .72 : .76) + u * .065, W * .92); } }
  if (ov.tuner && AN.active && AN.midi != null) { g.textAlign = 'right'; g.font = `800 ${Math.round(u * .06)}px ${mono}`; g.fillStyle = Math.abs(AN.cents) < 6 ? '#3ddc84' : '#fff'; g.fillText(pcName(AN.midi) + ' ' + (AN.cents >= 0 ? '+' : '') + AN.cents.toFixed(0) + '¢', W * .97, H * .93); }
  g.restore(); g.textAlign = 'left';
}
bus.on('onset', () => { const now = performance.now(); if (now - SG.lastFlash > lxComfort().gap) { SG.flash = 1; SG.lastFlash = now; } });

/* ---------- MIDI out ---------- */
function midiOut() { if (!MIDI.access) return null; const o = [...MIDI.access.outputs.values()]; return o.find(x => x.id === STG.out) || null; }
function stageMidiTick() {
  const o = midiOut(); if (!o) return; const ch = STG.ch & 15, ev = (a, b, c) => { try { o.send([a, b, c]); } catch (e) { } };
  if (STG.clock) {
    if (T.playing && E.ctx) {
      const ph = playheadSlot(); if (!SG.playPrev) { try { o.send([0xFA]); } catch (e) { } SG.tick = Math.floor(ph * 6); }
      const tk = Math.floor(ph * 6); let n = 0; while (SG.tick < tk && n < 24) { try { o.send([0xF8]); } catch (e) { } SG.tick++; n++; } if (tk - SG.tick > 24) SG.tick = tk;
    } else if (SG.playPrev) { try { o.send([0xFC]); } catch (e) { } }
  }
  SG.playPrev = T.playing;
  if (STG.roots) { const info = SG.info || stageInfo(), sym = info.sym || ''; if (sym !== SG.lastSym) { SG.lastSym = sym; if (SG.noteOn != null) ev(0x80 | ch, SG.noteOn, 0), SG.noteOn = null; const c = parseChord(sym); if (c) { SG.noteOn = 36 + c.root; ev(0x90 | ch, SG.noteOn, 96); } } }
  if (STG.ccs) { const n = performance.now(); if (n - SG.ccT > 40) { SG.ccT = n; ev(0xB0 | ch, 20, clamp(Math.round((AN.rms + 60) / 60 * 127), 0, 127)); ev(0xB0 | ch, 21, clamp(Math.round((AN.centroid || 0) / 6000 * 127), 0, 127)); } }
}
bus.on('onset', () => { const o = midiOut(); if (!o || !STG.trig) return; const ch = STG.ch & 15, v = clamp(Math.round((AN.rms + 50) / 40 * 127), 30, 127); try { o.send([0x90 | ch, 60, v]); setTimeout(() => { try { o.send([0x80 | ch, 60, 0]); } catch (e) { } }, 70); } catch (e) { } });
bus.on('transport', () => { if (!T.playing && SG.noteOn != null) { const o = midiOut(); if (o) try { o.send([0x80 | (STG.ch & 15), SG.noteOn, 0]); } catch (e) { } SG.noteOn = null; SG.lastSym = ''; } });
setInterval(() => { if (!STG.auto || !T.playing) return; const info = SG.info; if (!info || !info.sec || info.sec === SG.lastSec) return; SG.lastSec = info.sec; const i = STG.scenes.findIndex(s => s.sect && info.sec.toLowerCase().includes(s.sect.toLowerCase())); if (i >= 0 && i !== STG.cur) stageScene(i); }, 250);

/* ---------- fullscreen / pop-out ---------- */
async function stageFull() {
  if (SG.wrap.classList.contains('pfs')) { stagePfs(false); return; }
  try { if (document.fullscreenElement) { await document.exitFullscreen(); return; } if (!SG.wrap.requestFullscreen) throw new Error('no fullscreen'); await SG.wrap.requestFullscreen(); if (navigator.wakeLock) { SG.wl = await navigator.wakeLock.request('screen').catch(() => null); } SG.idleT = performance.now(); }
  catch (e) { if (document.body.dataset.form && document.body.dataset.form !== 'desktop') stagePfs(true); else toast('Fullscreen was blocked here — use the pop-out window instead', 'warn'); }
}
/* phones (notably iPhone Safari) cannot fullscreen an element: fill the viewport instead */
function stagePfs(on) {
  SG.wrap.classList.toggle('pfs', on); document.body.classList.toggle('pfs', on); SG.idleT = performance.now();
  if (on && navigator.wakeLock && !SG.wl) navigator.wakeLock.request('screen').then(w => { SG.wl = w; }).catch(() => { });
  if (!on && SG.wl) { try { SG.wl.release(); } catch (e) { } SG.wl = null; }
  if (typeof renderStageUI === 'function') renderStageUI(); setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) { SG.wrap && SG.wrap.classList.remove('idle'); if (SG.wl) { try { SG.wl.release(); } catch (e) { } SG.wl = null; } } });
function stagePop() {
  if (SG.pop && !SG.pop.closed) { SG.pop.focus(); return; }
  try {
    const w = window.open('', 'fw_stage', 'width=1024,height=576'); if (!w) throw 0; w.document.title = BRAND.short + ' Stage'; w.document.body.style.cssText = 'margin:0;background:#000;overflow:hidden;height:100vh';
    const v = w.document.createElement('video'); v.autoplay = true; v.muted = true; v.playsInline = true; v.style.cssText = 'width:100%;height:100%;object-fit:contain'; v.srcObject = SG.cv.captureStream(30); w.document.body.append(v); v.ondblclick = () => (w.document.fullscreenElement ? w.document.exitFullscreen() : v.requestFullscreen());
    w.document.body.title = 'Double-click for fullscreen'; SG.pop = w; pbPopSetup(w); w.addEventListener('pagehide', () => { SG.pop = null; }); toast('Pop-out ready — drag it to the projector, then double-click it for fullscreen', 'ok');
  } catch (e) { toast('The browser blocked the pop-out window — allow pop-ups for this page', 'warn'); }
}

/* ---------- pane UI ---------- */
function renderStageUI() {
  if (!SG.hudbar) return; const sc = scn();
  SG.hudbar.innerHTML = ''; STG.scenes.forEach((s, i) => SG.hudbar.append(h('button', { class: 'sbtn' + (i === STG.cur ? ' on' : ''), title: s.name + ' — key ' + (i + 1) + ' · MIDI note ' + (48 + i), onclick: () => stageScene(i) }, (i + 1) + ' ' + s.name)));
  SG.hudbar.append(h('span', { style: { flex: 1 } }), ...(document.body.dataset.form && document.body.dataset.form !== 'desktop' ? [h('button', { class: 'sbtn', title: 'Fill the screen', onclick: stageFull }, SG.wrap.classList.contains('pfs') ? '✕ Exit' : '⛶ Full')] : []), h('button', { class: 'sbtn' + (SG.boOn ? ' on' : ''), id: 'stgBo', title: 'Fade the output to black and back (key 0)', 'aria-pressed': String(!!SG.boOn), onclick: () => { shBlackout(); renderStageUI(); } }, '■ Blackout'), h('button', { class: 'sbtn', onclick: () => { STG.hud = !(STG.hud !== false); saveStg(); renderStageUI(); } }, STG.hud !== false ? 'HUD on' : 'HUD off'), h('button', { class: 'sbtn', title: 'Separate window for a projector / second screen', onclick: stagePop }, '⧉ Pop-out'), h('button', { class: 'sbtn', onclick: stageFull }, '⛶ Fullscreen'));
  const E_ = SG.editor; E_.innerHTML = ''; E_.append(shcRoot());   // the Show setup console (part 59)
}
function buildStagePane() {
  const p = PANES.stage; if (!p) return; SG.off = document.createElement('canvas'); SG.small = document.createElement('canvas');
  SG.cv = h('canvas'); SG.hudbar = h('div', { class: 'stagehud' }); SG.guides = h('div', { class: 'sg-guides', 'aria-hidden': 'true' }, h('i', { class: 'a' }), h('i', { class: 't' }), h('b'));
  SG.wrap = h('div', { class: 'stagewrap' + (CFG.show.out.safe ? ' guides' : ''), style: { minHeight: '340px', aspectRatio: '16/8' } }, SG.cv, SG.guides, SG.hudbar);
  SG.editor = h('div', { class: 'stg-ed' });
  const kick = () => { SG.idleT = performance.now(); SG.wrap.classList.remove('idle'); }; ['mousemove', 'mousedown', 'touchstart'].forEach(ev => SG.wrap.addEventListener(ev, kick, { passive: true })); SG.idle = true;
  SG.wrap.addEventListener('dblclick', e => { if (!e.target.closest('.sbtn')) stageFull(); });
  const grid = h('div', { class: 'stg-grid' }, SG.wrap, SG.editor);
  p.append(h('div', { class: 'row', style: { margin: '0 0 8px', gap: '10px' } }, h('div', { class: 'tiny muted' }, 'Show-ready visuals: pick a scene, go fullscreen (double-click), or pop it out to a projector. Play the song or just play — it follows both. Set the show up below.')), grid);
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => grid.classList.toggle('wide', p.clientWidth >= 1000)).observe(p);
  renderStageUI();
}
