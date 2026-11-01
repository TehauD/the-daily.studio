/* ============================================================
   Part 70 · Behind you (2.12) — six integrated backdrops for the camera cut-out
   Light Ribbons · Aurora · Warp Stars · Pulse Rings · Nebula · Skyline
   They are made to sit behind the person: set Camera look to “Me in front (green screen)” and you stand inside the picture,
   the way a performer stands in front of a lit backdrop. Each one is plain 2D drawing on the visuals canvas, so it also works
   in full screen, in the stage designer and in a recorded video.
   · The colour follows the chord: it glides to a new hue over about a second when the harmony changes (the circle of fifths
     walks round the colour wheel), and rests on a calm blue when nothing is playing.
   · The movement follows the sound (a few frequency bands set the size and brightness of its parts) and the comfort setting
     (Calm moves at about half the speed and softens every pulse).
   · Nothing here flashes: brightness only ever changes by gliding, and rings and pulses fade over a second or more.
   ============================================================ */
const BK_MODES = new Set(['ribbons', 'aurora', 'warp', 'rings', 'nebula', 'skyline']);
const VBACK = [['ribbons', 'Light Ribbons'], ['aurora', 'Aurora'], ['warp', 'Warp Stars'], ['rings', 'Pulse Rings'], ['nebula', 'Nebula'], ['skyline', 'Skyline']];
VMODES.push(...VBACK);
const BK = { hue: 215, en: .2, bands: new Float32Array(8), t: 0, st: null, rings: [], lastRing: 0, held: false, chord: '', tgt: 215 };
const bkH = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const bkHsl = (h, s, l, a) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a.toFixed(3)})`;
const bkSmooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** hue for a chord root: C rests on blue, and every fifth moves 30° round the wheel */
function bkHueFor(sym) { const ch = sym ? parseChord(sym) : null; if (!ch) return 215; return (215 + ((ch.root * 7) % 12) * 30) % 360; }

/** per-frame shared state: eight log-spaced bands (smoothed, quick up and slow down), overall energy, the chord's hue, comfort */
function bkTick(X) {
  const dt = Math.min(.1, X.dt || .016), cm = hmCm(), im = (typeof lxComfort === 'function' && lxComfort().impulse) || .8;
  const edges = [70, 140, 250, 450, 800, 1500, 2800, 5200]; let k0 = X.bin(60);
  for (let i = 0; i < 8; i++) {
    const k1 = Math.max(k0 + 1, X.bin(edges[i] * 1.55)); let s = 0, n = 0; for (let k = k0; k <= k1; k++) { s += X.lvl(X.fd[k]); n++; } k0 = k1 + 1;
    const v = n ? s / n : 0, b = BK.bands[i]; BK.bands[i] = v > b ? lerp(b, v, Math.min(1, dt * 14)) : lerp(b, v, Math.min(1, dt * 3));
  }
  BK.en = lerp(BK.en, clamp(X.energy * 1.25, 0, 1), Math.min(1, dt * 3)); BK.t += dt * cm.motion;
  let sym = null; try { sym = hmChordSym(); } catch (e) { }
  const live = !!(AN.active || (typeof T !== 'undefined' && T.playing)); BK.tgt = live ? bkHueFor(sym) : 215;
  let d = ((BK.tgt - BK.hue + 540) % 360) - 180; BK.hue = (BK.hue + d * Math.min(1, dt * 1.6) + 360) % 360;
  return { dt, mo: cm.motion, gap: cm.gap, im, en: Math.max(.16, BK.en), b: BK.bands, hue: BK.hue, t: BK.t, pulse: (X.pulse || 0) * im, rawPulse: X.pulse || 0 };
}

/** what draws each of these looks (part 70b adds Your video) */
const BK_FN = { ribbons: bkRibbons, aurora: bkAurora, warp: bkWarp, rings: bkRings, nebula: bkNebula, skyline: bkSkyline };
function bkDraw(mode, g, W, H, X) {
  const B = bkTick(X); g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  (BK_FN[mode] || bkRibbons)(g, W, H, B);
  g.restore(); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
}
/** a deep tinted sky to sit under the light: the same hue, very dark, so the lights read against it */
function bkSky(g, W, H, hue, l0, l1) { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, bkHsl(hue, 70, l0, 1)); gr.addColorStop(1, bkHsl(hue + 25, 75, l1, 1)); g.fillStyle = gr; g.fillRect(0, 0, W, H); }

/* ----- Light Ribbons: long glowing ribbons that swim across the picture, as in a lit stage backdrop ----- */
function bkRibbons(g, W, H, B) {
  bkSky(g, W, H, B.hue, 4, 11); g.globalCompositeOperation = 'lighter';
  const n = 7, t = B.t, steps = 56;
  for (let i = 0; i < n; i++) {
    const bd = B.b[1 + (i % 6)], amp = H * (.06 + .15 * bd + .04 * B.en) * (1 - i * .05), base = H * (.26 + .5 * (i / (n - 1))), hue = B.hue + (i - 3) * 13, f1 = 1.7 + i * .33, f2 = 4.2 + i * .9;
    const pts = []; for (let s = 0; s <= steps; s++) { const u = s / steps, x = -W * .04 + u * W * 1.08, edge = Math.sin(u * Math.PI); pts.push([x, base + (Math.sin(u * f1 * 3 + t * (.45 + i * .09) + i * 1.9) * amp + Math.sin(u * f2 + t * (.8 + i * .06) + i) * amp * .33) * (.45 + .55 * edge)]); }
    const glow = .6 + .4 * bd + B.pulse * .25;
    [[H * .06, .05], [H * .026, .12], [H * .009, .45 * glow], [H * .0032, .8 * glow]].forEach(([w, a], k) => {
      g.beginPath(); pts.forEach((p, s) => g[s ? 'lineTo' : 'moveTo'](p[0], p[1])); g.lineWidth = w * (1 + .2 * Math.sin(t + i)); g.strokeStyle = bkHsl(hue, 92 - k * 6, 52 + k * 10, a * (1 - i * .06)); g.stroke();
    });
  }
}

/* ----- Aurora: slow curtains of light hung from the top, over a dark horizon ----- */
function bkAurora(g, W, H, B) {
  bkSky(g, W, H, B.hue + 40, 2, 7); const t = B.t;
  for (let s = 0; s < 70; s++) { const x = bkH(s) * W, y = bkH(s + 70) * H * .6, a = .3 + .3 * Math.sin(t * .5 + bkH(s + 9) * 9); g.fillStyle = `rgba(255,255,255,${(a * .5).toFixed(3)})`; g.fillRect(x, y, 1.4, 1.4); }
  g.globalCompositeOperation = 'lighter'; const cols = 84, cw = W / cols;
  for (let c = 0; c < cols; c++) {
    const u = c / cols, n = Math.sin(u * 6 + t * .4) + Math.sin(u * 11.3 - t * .27) * .6 + Math.sin(u * 2.1 + t * .15) * .5, bd = B.b[(c * 8 / cols) | 0], hgt = H * (.2 + .3 * clamp(.5 + n / 3.2, 0, 1) * (.55 + .8 * bd + .15 * B.en)), y0 = H * (.08 + .1 * Math.sin(u * 3.2 + t * .22));
    const gr = g.createLinearGradient(0, y0, 0, y0 + hgt), hue = B.hue + 20 + u * 90 + Math.sin(t * .2 + u * 4) * 14; gr.addColorStop(0, bkHsl(hue, 90, 60, 0)); gr.addColorStop(.28, bkHsl(hue, 90, 62, .3 + .2 * bd)); gr.addColorStop(1, bkHsl(hue + 30, 90, 55, 0)); g.fillStyle = gr; g.fillRect(c * cw, y0, cw + 1, hgt);
  }
  g.globalCompositeOperation = 'source-over'; g.fillStyle = bkHsl(B.hue, 40, 3, 1); g.beginPath(); g.moveTo(0, H); for (let s = 0; s <= 40; s++) { const u = s / 40; g.lineTo(u * W, H * (.9 - .06 * Math.sin(u * 5 + 1) - .035 * Math.sin(u * 13))); } g.lineTo(W, H); g.fill();
}

/* ----- Warp Stars: flying through a field of stars; louder is faster, but never more than a brisk drift ----- */
function bkWarp(g, W, H, B) {
  bkSky(g, W, H, B.hue + 10, 2, 6); const N = 320, cx = W / 2, cy = H / 2, maxR = Math.hypot(cx, cy);
  if (!BK.st || BK.st.length !== N) BK.st = Array.from({ length: N }, (_, i) => ({ a: bkH(i) * 6.2832, r: bkH(i + 300), z: .3 + bkH(i + 600) * .7 }));
  const gl = g.createRadialGradient(cx, cy, 0, cx, cy, maxR * .55); gl.addColorStop(0, bkHsl(B.hue, 85, 48, .26 + .14 * B.en)); gl.addColorStop(1, bkHsl(B.hue, 85, 48, 0)); g.fillStyle = gl; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter'; const sp = (.05 + .5 * B.en) * B.mo * B.dt;
  BK.st.forEach(s => {
    const v = sp * s.z * (.2 + s.r * 1.6); const r0 = s.r; s.r += v; if (s.r > 1.1) { s.r = .02 + bkH(s.a * 91) * .08; s.a = (s.a + 2.4) % 6.2832; return; }
    const tl = Math.max(v * 5, .002 + s.r * .02), ra = Math.max(0, s.r - tl); const x0 = cx + Math.cos(s.a) * ra * maxR, y0 = cy + Math.sin(s.a) * ra * maxR, x1 = cx + Math.cos(s.a) * s.r * maxR, y1 = cy + Math.sin(s.a) * s.r * maxR;
    g.strokeStyle = bkHsl(B.hue + s.z * 50, 70, 78, clamp(s.r * 1.6, 0, 1) * .9); g.lineWidth = (.6 + s.r * 2.2) * Math.max(1, H / 620); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  });
}

/* ----- Pulse Rings: a ring leaves the middle on a strong beat (and now and then on its own) and fades as it widens ----- */
function bkRings(g, W, H, B) {
  bkSky(g, W, H, B.hue, 3, 9); const cx = W / 2, cy = H * .5, R = Math.hypot(W, H) * .5, now = performance.now();
  const strong = B.rawPulse > .55; if (strong && !BK.held && now - BK.lastRing > Math.max(B.gap, 450)) { BK.rings.push({ t0: now, hue: B.hue, a: .8 }); BK.lastRing = now; }
  BK.held = strong; if (now - BK.lastRing > 2800 / Math.max(.5, B.mo)) { BK.rings.push({ t0: now, hue: B.hue, a: .45 }); BK.lastRing = now; }
  BK.rings = BK.rings.filter(r => now - r.t0 < 4200).slice(-14);
  const orb = g.createRadialGradient(cx, cy, 0, cx, cy, R * (.18 + .08 * B.en)); orb.addColorStop(0, bkHsl(B.hue, 90, 60, .32 + .12 * B.en)); orb.addColorStop(1, bkHsl(B.hue, 90, 60, 0)); g.fillStyle = orb; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  BK.rings.forEach(r => { const age = (now - r.t0) / (3800 / Math.max(.5, B.mo)); if (age >= 1) return; const rad = R * (.04 + age * .95), fade = Math.pow(1 - age, 1.6) * r.a; [[R * .05, .1], [R * .018, .3], [R * .005, .8]].forEach(([w, a]) => { g.beginPath(); g.arc(cx, cy, rad, 0, 6.2832); g.lineWidth = w * (1 - age * .5); g.strokeStyle = bkHsl(r.hue + age * 40, 92, 62, a * fade); g.stroke(); }); });
  for (let i = 0; i < 3; i++) { const bd = B.b[i * 2 + 1], rad = R * (.1 + i * .06 + .03 * bd); g.beginPath(); g.arc(cx, cy, rad, 0, 6.2832); g.lineWidth = R * .004; g.strokeStyle = bkHsl(B.hue + i * 30, 85, 66, .12 + .3 * bd); g.stroke(); }
}

/* ----- Nebula: big soft clouds of colour that drift and breathe, and a scatter of slowly twinkling stars ----- */
function bkNebula(g, W, H, B) {
  bkSky(g, W, H, B.hue + 15, 2, 6); const t = B.t, R = Math.min(W, H); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) {
    const bd = B.b[i % 8], x = W * (.5 + (bkH(i) - .5) * .8 + Math.sin(t * .07 + i * 1.7) * .1), y = H * (.5 + (bkH(i + 40) - .5) * .7 + Math.cos(t * .05 + i * 2.3) * .09), rad = R * (.34 + .2 * bkH(i + 80) + .1 * bd);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad), hue = B.hue + (i - 4) * 17; gr.addColorStop(0, bkHsl(hue, 85, 55, .26 + .18 * bd)); gr.addColorStop(.55, bkHsl(hue + 12, 80, 45, .09 + .05 * bd)); gr.addColorStop(1, bkHsl(hue, 80, 40, 0)); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let s = 0; s < 110; s++) { const a = .25 + .45 * (.5 + .5 * Math.sin(t * .7 + bkH(s + 5) * 20)); g.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; const z = 1 + bkH(s + 7) * 1.6; g.fillRect(bkH(s + 11) * W, bkH(s + 13) * H, z, z); }
}

/* ----- Skyline: a city at dusk; the windows glow and fade slowly with the music, and the sky takes the chord's colour ----- */
function bkSkyline(g, W, H, B) {
  bkSky(g, W, H, B.hue, 6, 26); const R = Math.min(W, H), t = B.t;
  for (let s = 0; s < 60; s++) { g.fillStyle = `rgba(255,255,255,${(.2 + .3 * (.5 + .5 * Math.sin(t * .5 + s))).toFixed(3)})`; g.fillRect(bkH(s) * W, bkH(s + 50) * H * .45, 1.3, 1.3); }
  const mx = W * .74, my = H * .26, mr = R * .07, mg = g.createRadialGradient(mx, my, mr * .5, mx, my, mr * 4); mg.addColorStop(0, bkHsl(B.hue + 30, 80, 80, .5)); mg.addColorStop(1, bkHsl(B.hue + 30, 80, 70, 0)); g.fillStyle = mg; g.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8); g.fillStyle = bkHsl(B.hue + 30, 60, 88, .95); g.beginPath(); g.arc(mx, my, mr, 0, 6.2832); g.fill();
  g.globalCompositeOperation = 'lighter';   /* two slow searchlight beams sweeping the sky */
  for (let k = 0; k < 2; k++) { const ox = W * (.26 + .48 * k), ang = -Math.PI / 2 + Math.sin(t * .22 + k * 2.4) * .55, len = H * 1.1, sp = .09 + .05 * B.b[2 + k * 3], x1 = ox + Math.cos(ang - sp) * len, y1 = H + Math.sin(ang - sp) * len, x2 = ox + Math.cos(ang + sp) * len, y2 = H + Math.sin(ang + sp) * len, gr = g.createLinearGradient(ox, H, (x1 + x2) / 2, (y1 + y2) / 2); gr.addColorStop(0, bkHsl(B.hue + 15, 80, 70, .22 + .12 * B.b[2 + k * 3])); gr.addColorStop(1, bkHsl(B.hue + 15, 80, 70, 0)); g.fillStyle = gr; g.beginPath(); g.moveTo(ox, H); g.lineTo(x1, y1); g.lineTo(x2, y2); g.closePath(); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  [[0, .52, 18, 'back'], [1, .66, 14, 'front']].forEach(([row, topFrac, count]) => {
    let x = -W * .02; const base = H, shade = row ? 3 : 10; for (let i = 0; i < count + 6 && x < W; i++) {
      const sd = i + row * 100, bw = (W / count) * (.75 + bkH(sd) * .7), bh = H * (row ? .12 + bkH(sd + 5) * .22 : .2 + bkH(sd + 5) * .3), y = base - bh;
      g.fillStyle = bkHsl(B.hue + 10, row ? 35 : 45, shade + (row ? 0 : 4), 1); g.fillRect(x, y, bw - 1, bh);
      const wc = Math.max(2, Math.floor(bw / (R * .028))), wr = Math.max(2, Math.floor(bh / (R * .04)));
      for (let a = 0; a < wc; a++) for (let b = 0; b < wr; b++) {
        const id = sd * 1000 + a * 31 + b, slow = .5 + .5 * Math.sin(t * .3 + bkH(id) * 40), lit = bkSmooth(.45 + .25 * (1 - B.b[(a + b + i) % 8]), .8, slow) * (row ? .55 : .8);
        if (lit < .04) continue; g.fillStyle = bkHsl(bkH(id + 3) > .6 ? 42 : B.hue + 25, 85, 68, lit * (.55 + .4 * B.b[(a + i) % 8])); g.fillRect(x + (a + .4) * bw / wc, y + (b + .4) * bh / wr, bw / wc * .5, bh / wr * .5);
      }
      x += bw + R * .004;
    }
  });
}

/** the first time one of these is chosen with the camera showing you dimmed behind the visuals, say how to stand inside the picture */
function backTip() {
  if (VZ.mode === 'video' && typeof vbgOpen === 'function' && !CFG.vbg.list.length) { vbgOpen(); return; }      /* Your video with no video yet: open the place to add one */
  if (!CAM.on || (CFG.camFx || 'over') === 'person' || store.get('backTip')) return;
  store.set('backTip', 1); toast('Tip: set Camera look to “Me in front (green screen)” and you stand inside this picture.', '');
}
