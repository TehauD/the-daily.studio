/* ============================================================
   Part 58 · LIGHTS — the layers of the Perform lens, drawn from the show design and the musical clock
   Back to front: the room (the look's base colour: drifting colour fields, a quiet gradient, or a sky over a horizon) · your backdrop image ·
   haze and slow motes · the backdrop element (the spectrum as lit columns, tall blades, a pixel field, a horizon with a low sun, or your own
   picture as a pixel wall) · moving lights (from a truss over the stage, from the floor behind the band, from side towers, or as broad washes) and floor washes ·
   lasers (part 57) · sparks and confetti · your logo · the blinder (comfort-limited) · vignette.
   ============================================================ */
/** a light colour: never darker than a stage light would be */
const lxLt = (c, a, dl) => lxHsl(c[0], c[1], clamp(Math.max(c[2], 50) + (dl || 0), 0, 96), a);
const lxImpulse = () => LX.gov * lxComfort().impulse;

/** the gradient stage: the design's base colour, six drifting colour fields, a floor glow; rendered small and scaled up so it is silky and cheap */
function lxStage(g, W, H, dim, haze) {
  const c = lxMeshCanvas('mesh', W, H, 8), m = c.getContext('2d'), w = c.width, h = c.height, pal = LX.pal, e = LX.e, ph = LX.ph, a0 = dim == null ? 1 : dim, imp = lxImpulse(), B = pal.base, key = pal.key, R = LX.D && LX.D.rig || {}, fa = R.field == null ? 1 : R.field;
  m.globalCompositeOperation = 'source-over'; const bg = m.createLinearGradient(0, 0, 0, h);
  if (R.bg === 'sky') {   // a sky above a horizon at 62%: dark overhead, a glow where the sky meets the ground, a dark floor
    const gl = [pal.a[0], pal.a[1] * .75, 50]; bg.addColorStop(0, lxHsl(B[0], B[1] * .9, Math.max(1.5, B[2] * .5), 1)); bg.addColorStop(.4, lxHsl(B[0], B[1], B[2] + 2 + 3 * e, 1)); bg.addColorStop(.62, lxHsl(gl[0], gl[1] * .9, 22 + 14 * e + 5 * LX.build, 1)); bg.addColorStop(.635, lxHsl(B[0], B[1] * .8, B[2] * .35 + 1, 1)); bg.addColorStop(1, lxHsl(B[0], B[1], B[2] * .6 + 2 + 4 * e, 1));
  } else { bg.addColorStop(0, lxHsl(B[0], B[1] * .8, Math.max(1.5, B[2] * .35 + 2 * e), 1)); bg.addColorStop(.55, lxHsl(B[0], B[1], B[2] * .8 + 4 * e, 1)); bg.addColorStop(1, lxHsl(lxHueMix(B[0], key[0], .35), B[1] * .9 + 10, B[2] + 5 + 8 * e, 1)); }
  m.fillStyle = bg; m.fillRect(0, 0, w, h);
  m.globalCompositeOperation = 'lighter'; const cols = [key, pal.a, pal.b, pal.c, key, pal.b];
  for (let i = 0; i < 6; i++) {
    const x = w * (.5 + .44 * Math.sin(ph * (.17 + .05 * i) + i * 2.1)), y = h * (.42 + .34 * Math.sin(ph * (.13 + .06 * i) + i * 1.3)), r = w * (.36 + .13 * Math.sin(ph * .31 + i)) * (1 + (i === 0 ? LX.kick * .2 * imp : 0) + LX.drop * .25 * imp);
    const a = (.15 + .22 * e) * (i === 0 ? 1 + LX.kick * .7 * imp : 1) * (.75 + .25 * Math.sin(ph * .4 + i * 1.7)) * a0 * fa, col = cols[i], gr = m.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, lxAt(col, clamp(col[2], 40, 62), a)); gr.addColorStop(.5, lxAt(col, clamp(col[2], 40, 62) - 12, a * .4)); gr.addColorStop(1, lxAt(col, 40, 0)); m.fillStyle = gr; m.fillRect(0, 0, w, h);
  }
  const fl = m.createLinearGradient(0, h, 0, h * .5); fl.addColorStop(0, lxAt(key, clamp(key[2], 40, 60), (.1 + .2 * e + .16 * LX.kick * imp) * a0 * Math.max(.4, fa))); fl.addColorStop(1, lxAt(key, 50, 0)); m.fillStyle = fl; m.fillRect(0, h * .5, w, h * .5);
  if (haze > 0) lxHazeBlobs(m, w, h, haze);
  g.save(); g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'low'; g.drawImage(c, 0, 0, W, H); g.restore();
}
/** fog blobs the beams light up, drawn into any small canvas (the stage's own, when there is no backdrop picture, so the haze costs no extra full-frame pass) */
function lxHazeBlobs(f, w, h, amt) {
  const pal = LX.pal, imp = lxImpulse(), cols = [pal.b, pal.c, pal.key, pal.a]; f.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const x = w * (.5 + .55 * Math.sin(LX.ph * (.07 + .02 * i) + i * 1.9)), y = h * (.35 + .4 * Math.sin(LX.ph * (.05 + .03 * i) + i * 2.7)), r = w * (.28 + .12 * Math.sin(LX.ph * .2 + i * 1.1)), a = (.05 + .08 * LX.e + .05 * LX.kick * imp) * amt, col = cols[i % 4], gr = f.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, lxAt(col, 62, a, .8)); gr.addColorStop(1, lxAt(col, 62, 0, .8)); f.fillStyle = gr; f.fillRect(0, 0, w, h);
  }
}
/** haze: the fog (unless the stage already drew it) and a few motes drifting in it (positions come from the song's phase, not a random walk) */
function lxHaze(g, W, H, amt, motesOnly) {
  const pal = LX.pal, cols = [pal.b, pal.c, pal.key, pal.a];
  if (!motesOnly) { const c = lxMeshCanvas('fog', W, H, 10), f = c.getContext('2d'); f.clearRect(0, 0, c.width, c.height); lxHazeBlobs(f, c.width, c.height, amt); g.save(); g.globalCompositeOperation = 'lighter'; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'low'; g.drawImage(c, 0, 0, W, H); g.restore(); }
  if (amt > .15) { g.save(); g.globalCompositeOperation = 'lighter'; const dust = LX.D && LX.D.rig.dust ? 1 : 0, n = (LX.lite ? 20 : 46) * (dust ? 2 : 1), r0 = Math.max(1, H / 700) * (dust ? 1.5 : 1); for (let i = 0; i < n; i++) { const x = lxFrac(((i * 9301 + 49297) % 233280) / 233280 + LX.ph * .004 * (1 + i % 3)), y = lxFrac(((i * 7919 + 1237) % 104729) / 104729 - LX.ph * .003 * (1 + i % 2)), tw = .5 + .5 * Math.sin(LX.ph * .9 + i * 1.7); g.fillStyle = lxLt(cols[i % 4], (.05 + .1 * LX.e) * tw * amt * (dust ? 1.8 : 1), 22); g.beginPath(); g.arc(x * W, y * H, r0 * (1 + (i % 3) * .6), 0, 7); g.fill(); } g.restore(); }
}
/** an LED wall behind the band: the spectrum as lit columns, or your own picture as a pixel wall that the music plays across */
function lxWall(g, W, H, X, amt) {
  if (amt < .02) return; const cols = LX.eq.length, rows = 14, x0 = W * .16, x1 = W * .84, yt = H * .1, yb = H * .6, cw = (x1 - x0) / cols, ch = (yb - yt) / rows, pal = LX.pal, { fd, bin, lvl } = X, imp = lxImpulse();
  const lr = Math.log(8000 / 70); for (let i = 0; i < cols; i++) { const f = 70 * Math.exp(lr * i / (cols - 1)), b = bin(f), v = lvl(Math.max(fd[b], fd[Math.min(fd.length - 1, b + 1)])); LX.eq[i] = Math.max(v, LX.eq[i] * .9 - .006); }
  const wm = LX.D && LX.D.rig.wall;
  if (wm === 'blades') return lxWallBlades(g, W, H, amt); if (wm === 'field') return lxWallField(g, W, H, amt); if (wm === 'horizon') return lxWallHorizon(g, W, H, amt);
  if (lxWallImage(g, W, H, amt, x0, x1, yt, yb, cols, imp)) return;
  if (!LX.ghost || LX.ghost.width !== W || LX.ghost.height !== H) { const c = LX.ghost = document.createElement('canvas'); c.width = W; c.height = H; const q = c.getContext('2d'); q.fillStyle = 'rgba(255,255,255,.05)'; for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) q.fillRect(x0 + i * cw + cw * .14, yt + r * ch + ch * .14, cw * .72, ch * .72); }
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = amt * .8; g.drawImage(LX.ghost, 0, 0); g.globalAlpha = amt;
  for (let i = 0; i < cols; i++) {
    const n = Math.min(rows, Math.floor(LX.eq[i] * rows * 1.15)); if (n <= 0) continue; const col = lxMix3(pal.a, pal.b, i / (cols - 1)), tw = lxMix3(col, pal.c, LX.tn * .35);
    for (let r = 0; r < n; r++) { const top = r === n - 1; g.fillStyle = lxAt(tw, clamp(tw[2], 40, 62) - 6 + r * 2.5 + (top ? 14 : 0), top ? .95 : .55); g.fillRect(x0 + i * cw + cw * .14, yb - (r + 1) * ch + ch * .14, cw * .72, ch * .72); }
  }
  g.restore();
}
/** a faint, cached grid of unlit cells (the LED hardware you can see when it is dark) */
function lxGhost(key, W, H, draw) { const k = key + '|' + W + 'x' + H; LX.gh = LX.gh || {}; let c = LX.gh[key]; if (!c || c.k !== k) { c = LX.gh[key] = document.createElement('canvas'); c.width = W; c.height = H; c.k = k; draw(c.getContext('2d')); } return c; }
/** blades: tall, hard-edged bars of light across the stage that rise and fall with the spectrum */
function lxWallBlades(g, W, H, amt) {
  const n = LX.lite ? 24 : 40, x0 = W * .07, x1 = W * .93, pitch = (x1 - x0) / n, bw = pitch * .36, y0 = H * .05, y1 = H * .9, pal = LX.pal, imp = lxImpulse(), ne = LX.eq.length;
  const gh = lxGhost('bl' + n, W, H, q => { q.fillStyle = 'rgba(255,255,255,.045)'; for (let i = 0; i < n; i++) q.fillRect(x0 + i * pitch + (pitch - bw) / 2, y0, bw, y1 - y0); });
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = amt * .9; g.drawImage(gh, 0, 0); g.globalAlpha = amt;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), band = LX.eq[Math.min(ne - 1, Math.floor(t * ne))], v = clamp(band * 1.2 + LX.kick * .22 * imp * (i % 4 === 0 ? 1 : .35), 0, 1); if (v < .03) continue;
    const hh = (y1 - y0) * (.05 + .95 * Math.pow(v, 1.1)), x = x0 + i * pitch + (pitch - bw) / 2, col = lxMix3(lxMix3(pal.a, pal.b, t), pal.c, LX.tn * .3), top = y1 - hh, gr = g.createLinearGradient(0, top, 0, y1);
    gr.addColorStop(0, lxAt(col, 80, .96)); gr.addColorStop(.2, lxAt(col, 62, .8)); gr.addColorStop(1, lxAt(col, 46, .3)); g.fillStyle = gr; g.fillRect(x, top, bw, hh);
    g.fillStyle = lxAt(pal.l1, 92, Math.min(1, v * 1.1)); g.fillRect(x, top - bw * .55, bw, bw * .55);
    if (i % 8 === 3 && LX.snare > .1) { g.fillStyle = lxAt(pal.l2, 70, LX.snare * imp * .9); g.fillRect(x - bw * .3, y0, bw * 1.6, y1 - y0); }
  }
  g.restore();
}
/** a pixel field: the whole back of the stage as a grid. The spectrum climbs it, every hit rings out from a point, the kick pulses the centre. */
function lxWallField(g, W, H, amt) {
  const cols = LX.lite ? 32 : 48, rows = Math.max(8, Math.round(cols * H / W * .86)), x0 = W * .04, x1 = W * .96, y0 = H * .05, y1 = H * .9, cw = (x1 - x0) / cols, ch = (y1 - y0) / rows, sz = Math.min(cw, ch) * .72, pal = LX.pal, imp = lxImpulse(), ne = LX.eq.length, e = LX.e;
  const gh = lxGhost('fd' + cols, W, H, q => { q.fillStyle = 'rgba(255,255,255,.05)'; for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) q.fillRect(x0 + i * cw + (cw - sz) / 2, y0 + r * ch + (ch - sz) / 2, sz, sz); });
  /* ripples start on the band's hits: kick at the foot, snare off to a side, a lead note where its pitch sits, a strum from the middle */
  const R = LX.rip = LX.rip || [], P = LX.ripP = LX.ripP || {}, now = LX.pos, spawn = (k, cx, cy, sp, life, ci) => { if (R.length < 7) R.push({ cx, cy, t: 0, sp, life, ci, k }); };
  const edge = (k, on) => { const was = P[k]; P[k] = on; return on && !was; };
  if (edge('kick', LX.kick > .9)) spawn('kick', .5, .86, 17, 1.5, 0); if (edge('snare', LX.snare > .9)) spawn('snare', .25 + .5 * lxFrac(lxHash('s' + LX.noteN) / 4294967296 + now * .37), .45, 22, 1.2, 1);
  if (edge('lead', LX.lead > .95)) spawn('lead', clamp((LX.leadM - 48) / 40, .06, .94), .35, 15, 1.4, 2); if (edge('strum', LX.strum > .9)) spawn('strum', .5, .5, 12, 1.8, 0);
  const dt = clamp(LX.dtF || .016, .004, .08); for (let i = R.length - 1; i >= 0; i--) { R[i].t += dt; if (R[i].t > R[i].life) R.splice(i, 1); }
  const cs = [pal.a, pal.b, pal.c], Ls = [36, 48, 60, 74], As = [.2, .42, .7, .96], sty = cs.map(c => Ls.map((l, k) => lxAt(c, l, As[k]))), tip = lxAt(pal.l1, 92, .98), ph = LX.ph;
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = amt * .9; g.drawImage(gh, 0, 0); g.globalAlpha = amt; let last = '';
  for (let i = 0; i < cols; i++) {
    const lvl = LX.eq[Math.min(ne - 1, Math.floor(i / cols * ne))], top = lvl * rows * .92, ci0 = Math.min(2, Math.floor(i / cols * 3));
    for (let r = 0; r < rows; r++) {
      const fromBottom = rows - 1 - r; let v = fromBottom < top ? .3 + .3 * (fromBottom / Math.max(1, top)) + (top - fromBottom < 1.5 ? .35 : 0) : 0;
      v += (.5 + .5 * Math.sin(i * .33 + ph * .9) * Math.sin(r * .41 - ph * .7)) * .2 * (.3 + e);
      let ci = ci0; for (let k = 0; k < R.length; k++) { const q = R[k], dx = (i + .5) / cols - q.cx, dy = ((r + .5) / rows - q.cy) * (rows / cols) * (W / H) * .56, d = Math.hypot(dx * cols, dy * cols), rr = q.t * q.sp, ring = 1 - Math.abs(d - rr) / 1.7; if (ring > 0) { const f = ring * (1 - q.t / q.life) * (q.k === 'kick' ? 1 : .9); if (f > v) { v = f; ci = q.ci; } } }
      v += LX.kick * .35 * imp * Math.max(0, 1 - Math.hypot((i - cols / 2) / cols * 3, (r - rows * .8) / rows * 2.2));
      if (v < .06) continue; const li = v > .92 ? 4 : v > .62 ? 3 : v > .36 ? 2 : v > .16 ? 1 : 0, st = li === 4 ? tip : sty[ci][Math.max(0, li - (li === 4 ? 0 : 0))];
      if (st !== last) { g.fillStyle = st; last = st; } g.fillRect(x0 + i * cw + (cw - sz) / 2, y0 + r * ch + (ch - sz) / 2, sz, sz);
    }
  }
  g.restore();
}
/** a horizon: a low sun and the rays that fan out of it, and its reflection in the floor. The sun rises with the section's intensity. */
function lxWallHorizon(g, W, H, amt) {
  const pal = LX.pal, imp = lxImpulse(), e = LX.e, hy = H * .62, cx = W * .5, up = clamp(LX.int + LX.build * .4, 0, 1.1), r = H * (.07 + .04 * up + .025 * LX.build + .02 * LX.kick * imp), sy = hy - r * (.1 + .75 * up);
  g.save(); g.globalCompositeOperation = 'lighter';
  g.save(); g.beginPath(); g.rect(0, 0, W, hy); g.clip();
  const gl = g.createRadialGradient(cx, sy, r * .6, cx, sy, r * 4.2); gl.addColorStop(0, lxAt(pal.a, 58, .34 * amt + .1 * LX.kick * imp)); gl.addColorStop(1, lxAt(pal.a, 50, 0)); g.fillStyle = gl; g.fillRect(0, 0, W, hy);
  const n = LX.lite ? 12 : 22, rot = LX.pos / 40 * Math.PI * 2, len = Math.hypot(W, H);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI + (i + .5) / n * Math.PI + Math.sin(rot + i * .7) * .02, wd = (.012 + .008 * (i % 3) + .01 * e) * (1 + .5 * LX.snare * imp), col = i % 2 ? pal.b : pal.a, al = (.05 + .07 * e + .09 * LX.int * (i % 4 === 0 ? 1 : .5) + .08 * LX.kick * imp) * amt, ex = cx + Math.cos(a) * len, ey = sy + Math.sin(a) * len, nx = -Math.sin(a) * wd * len, ny = Math.cos(a) * wd * len, gr = g.createLinearGradient(cx, sy, ex, ey);
    gr.addColorStop(0, lxAt(col, 72, al)); gr.addColorStop(.6, lxAt(col, 62, al * .4)); gr.addColorStop(1, lxAt(col, 55, 0)); g.fillStyle = gr; g.beginPath(); g.moveTo(cx, sy); g.lineTo(ex + nx, ey + ny); g.lineTo(ex - nx, ey - ny); g.closePath(); g.fill();
  }
  g.globalCompositeOperation = 'source-over'; const dg = g.createLinearGradient(0, sy - r, 0, sy + r); dg.addColorStop(0, lxAt(pal.l1, 86, .96 * amt)); dg.addColorStop(.55, lxAt(pal.b, 70, .94 * amt)); dg.addColorStop(1, lxAt(pal.a, 58, .94 * amt)); g.fillStyle = dg; g.beginPath(); g.arc(cx, sy, r, 0, 7); g.fill();
  g.restore();
  const hl = g.createLinearGradient(0, 0, W, 0); hl.addColorStop(0, lxAt(pal.b, 78, 0)); hl.addColorStop(.5, lxAt(pal.b, 82, .55 * amt)); hl.addColorStop(1, lxAt(pal.b, 78, 0)); g.fillStyle = hl; g.fillRect(0, hy - 1, W, Math.max(2, H * .003));
  const rg = g.createLinearGradient(0, hy, 0, hy + H * .3); rg.addColorStop(0, lxAt(pal.a, 62, .34 * amt)); rg.addColorStop(1, lxAt(pal.a, 50, 0)); g.save(); g.translate(cx, hy); g.scale(1, .34); g.fillStyle = rg; g.beginPath(); g.arc(0, 0, r * 1.15, Math.PI, 0); g.fill(); g.restore();
  for (let k = 0; k < 9; k++) { const wv = .5 + .5 * Math.sin(LX.ph * 1.1 + k * 1.9), y = hy + H * (.012 + k * .026), w2 = r * (1.5 - k * .12) * (.45 + .55 * wv); g.fillStyle = lxAt(pal.b, 74, (.2 - k * .017) * amt * (.5 + .5 * e)); g.fillRect(cx - w2 / 2, y, w2, Math.max(1, H * .0036)); }
  g.restore();
}
/** the pixel wall: the picture reduced to a grid of lit squares (made once), then played over by the spectrum */
function lxWallImage(g, W, H, amt, x0, x1, yt, yb, cols, imp) {
  const D = LX.D, im = lxImgFor('wall'); if (!im || !D || D.rig.wall !== 'image') return false;
  const px = Math.max(5, Math.round(H * .0115)), ww = Math.floor((x1 - x0) / px) * px, wh = Math.floor((yb - yt) / px) * px, nc = ww / px, nr = wh / px, key = im.id + '|' + nc + 'x' + nr;
  if (LX.wallImgK !== key || !LX.wallC) {
    const tiny = document.createElement('canvas'); tiny.width = nc; tiny.height = nr; const t = tiny.getContext('2d', { willReadFrequently: true }), iw = im.im.width, ih = im.im.height, s = Math.max(nc / iw, nr / ih), dw = iw * s, dh = ih * s; t.drawImage(im.im, (nc - dw) / 2, (nr - dh) / 2, dw, dh);
    const d = t.getImageData(0, 0, nc, nr).data, c = LX.wallC = document.createElement('canvas'); c.width = ww; c.height = wh; const q = c.getContext('2d');
    for (let y = 0; y < nr; y++) for (let x = 0; x < nc; x++) { const o = (y * nc + x) * 4; q.fillStyle = 'rgb(' + d[o] + ',' + d[o + 1] + ',' + d[o + 2] + ')'; q.fillRect(x * px + px * .12, y * px + px * .12, px * .76, px * .76); }
    LX.wallImgK = key;
  }
  const c = LX.wallC, sx = x0 + (x1 - x0 - ww) / 2; g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = amt * (.4 + .3 * LX.e + .25 * LX.kick * imp); g.drawImage(c, sx, yt);
  const strips = 28, sw = ww / strips; for (let i = 0; i < strips; i++) { const v = LX.eq[Math.floor(i / strips * cols)]; g.globalAlpha = amt * (.05 + .5 * v + .2 * LX.snare * imp); g.drawImage(c, i * sw, 0, sw, wh, sx + i * sw, yt, sw, wh); }
  g.restore(); return true;
}

/* ---------- your pictures ---------- */
function lxImgFor(role) {
  const D = LX.D, u = D && D.use; if (!u) return null; const ids = role === 'back' ? u.back : role === 'wall' ? u.wall : (u.logo ? [u.logo] : null); if (!ids || !ids.length) return null;
  const id = ids[(LX.slide || 0) % ids.length], im = typeof shImg === 'function' ? shImg(id) : null; return im ? { im, id } : null;
}
function lxCover(g, im, W, H, sc, ox, oy, a) { const s = Math.max(W / im.width, H / im.height) * sc, dw = im.width * s, dh = im.height * s; g.globalAlpha = a; g.drawImage(im, (W - dw) / 2 + ox, (H - dh) / 2 + oy, dw, dh); g.globalAlpha = 1; }
/** a full-frame picture behind the lights, drifting very slowly with the song and cross-fading when the section changes */
function lxBackdrop(g, W, H, dt) {
  const D = LX.D, im = lxImgFor('back'); if (!im) { LX.bkId = null; return; } const u = D.use || {}, amt = clamp(u.backAmt == null ? .6 : u.backAmt, 0, 1), tint = clamp(u.backTint == null ? .35 : u.backTint, 0, 1);
  if (LX.bkId !== im.id) { LX.bkPrev = LX.bkIm || null; LX.bkIm = im.im; LX.bkId = im.id; LX.bkT = LX.bkPrev ? 0 : 1; }
  LX.bkT = Math.min(1, LX.bkT + dt / Math.max(.4, spb() * slotDur()));
  const ph = LX.pos / 16 * Math.PI * 2, sc = 1.05 + .035 * Math.sin(ph), ox = Math.sin(ph * .5) * W * .012, oy = Math.cos(ph * .7) * H * .01 - LX.kick * H * .002 * lxImpulse();
  g.save(); g.globalCompositeOperation = 'source-over'; if (LX.bkPrev && LX.bkT < 1) lxCover(g, LX.bkPrev, W, H, sc, ox, oy, amt * (1 - LX.bkT)); lxCover(g, LX.bkIm, W, H, sc, ox, oy, amt * lxSmooth(LX.bkT));
  if (tint > .01) { g.globalCompositeOperation = 'multiply'; g.fillStyle = lxHsl(LX.pal.key[0], Math.min(LX.pal.key[1], 85), 46, tint); g.fillRect(0, 0, W, H); }
  g.restore();
}
/** a logo, lit by the band */
function lxLogo(g, W, H) {
  const im = lxImgFor('logo'); if (!im) return; const u = LX.D.use || {}, sz = clamp(u.logoSize == null ? .16 : u.logoSize, .05, .5) * H, s = Math.min(sz / im.im.height, sz * 2 / im.im.width), dw = im.im.width * s, dh = im.im.height * s, pos = u.logoPos || 'tr', m = H * .04;
  const x = /l/.test(pos) ? m : /r/.test(pos) ? W - dw - m : (W - dw) / 2, y = /^t/.test(pos) ? m : /^b/.test(pos) ? H - dh - m : pos === 'c' ? (H - dh) / 2 : m;
  g.save(); g.shadowColor = lxLt(LX.pal.key, .8, 10); g.shadowBlur = H * (.012 + .02 * LX.kick * lxImpulse()); g.globalAlpha = clamp(.82 + .18 * LX.kick * lxImpulse(), 0, 1); g.drawImage(im.im, x, y, dw, dh); g.restore();
}

/* ---------- moving heads and floor washes ---------- */
/** where head i stands, and which way is "straight ahead" for it (θ from straight down, so 0 = down, π = up, π/2 = to the right); sg mirrors the right-hand tower */
function lxHeadGeom(i, lay, W, H) {
  switch (lay) {
    case 'floor': return { ox: W * (.07 + .86 * i / 11), oy: H * 1.03, base: Math.PI, sg: 1, up: 1 };
    case 'sides': { const L = i < 6, k = L ? i : i - 6; return { ox: L ? -W * .02 : W * 1.02, oy: H * (.1 + .13 * k), base: L ? Math.PI / 2 - .1 : -Math.PI / 2 + .1, sg: L ? 1 : -1, up: 0 }; }
    case 'wash': return { ox: W * (.1 + .8 * i / 11), oy: -H * .05, base: 0, sg: 1, up: 0 };
    default: return { ox: (i + .5) / 12 * W, oy: -H * .02, base: 0, sg: 1, up: 0 };
  }
}
const LX_ORDER = { top: [5, 6, 4, 7, 3, 8, 2, 9, 1, 10, 0, 11], floor: [5, 6, 4, 7, 3, 8, 2, 9, 1, 10, 0, 11], sides: [0, 6, 1, 7, 2, 8, 3, 9, 4, 10, 5, 11], wash: [1, 10, 4, 7, 5, 6, 2, 9, 3, 8, 0, 11] };
const lxNorm = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
/** the angle (relative to the head's own straight-ahead) the head should take for a movement pattern */
function lxTarget(i, pat, W, H, spread, G) {
  const D = LX.D, sw = Math.max(1, (D.mot && D.mot.sweep) || 4), snap = D.mot && D.mot.snap, s = (snap ? lxStep(LX.pos / sw, sw * S.ts[0]) : LX.pos / sw) * Math.PI * 2;
  const fx = i / 11 - .5, aim = (px, py) => lxNorm(Math.atan2(px - G.ox, py - G.oy) - G.base) * G.sg, ty = G.up ? .3 : .66;
  switch (pat) {
    case 'sweep': return Math.sin(s) * .75 + fx * .5;
    case 'cross': return (i < 6 ? 1 : -1) * (.12 + .6 * (.5 + .5 * Math.sin(s))) * (1 - Math.abs(fx) * .3);
    case 'converge': return aim(W / 2 + Math.sin(s) * W * .03, H * ty);
    case 'spot': return aim(W / 2 + (i % 2 ? 1 : -1) * W * (.03 + .04 * Math.sin(s * 2)), H * (ty + .04));
    case 'chase': return fx * (.9 + .4 * LX.e) + .1 * Math.sin(s * 2);
    case 'wave': return Math.sin(s * 2 + i * .55) * (.38 + .3 * LX.e) + fx * .25;
    default: return fx * spread * 2 + .22 * Math.sin(s + i * .5);
  }
}
function lxBeams(g, W, H, dt) {
  const P = LX.prog, D = LX.D, pal = LX.pal, e = LX.e, imp = lxImpulse(), mot = lxComfort().motion, R = D.rig, lay = R.layout || 'top', order = LX_ORDER[lay] || LX_ORDER.top, pat = LX.pat, style = R.beam || (lay === 'wash' ? 'wash' : 'soft'), sp0 = R.spread == null ? 1 : R.spread;
  const spread = (.42 + .3 * e + (.55 * LX.drop + .12 * LX.kick) * imp) * sp0, floorY = H * .93, Lb = lay === 'sides' ? W * 1.25 : H * 1.6, maxH = lay === 'none' ? 0 : LX.lite ? Math.min(8, R.heads == null ? 12 : R.heads) : (R.heads == null ? 12 : R.heads);
  const cols = [LX.key, pal.b, pal.a, pal.c], lpos = clamp((LX.leadM - 40) / 48, 0, 1), wk = (style === 'hard' ? .55 : style === 'wash' ? 1.9 : 1) * (lay === 'sides' ? .5 : 1);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12 && maxH > 0; i++) {
    const b = LX.beams[i], rank = order.indexOf(i), on = rank < maxH ? clamp(LX.n - rank, 0, 1) : 0, G = lxHeadGeom(i, lay, W, H), ox = G.ox, oy = G.oy; b.on += (on - b.on) * Math.min(1, dt * 3);
    const tgt = lxTarget(i, pat, W, H, spread, G), rate = (5 + e * 7 + LX.kick * 4) * mot * (lay === 'wash' ? .7 : 1); b.ang += (tgt - b.ang) * Math.min(1, dt * rate);
    const odd = i % 2, hit = ((odd ? LX.snare : LX.kick) * .9 + LX.hat * .25 * ((i + (LX.chase | 0)) % 3 === 0 ? 1 : 0) + LX.perc * .3 * (i % 4 === 0 ? 1 : 0) + LX.tom * .5 * (i % 3 === 0 ? 1 : 0)) * imp;
    let ch = 0; if (pat === 'chase') { const df = Math.abs(i - (LX.chase % 12)), cd = Math.min(df, 12 - df); ch = clamp(1 - cd * .5, 0, 1) * .9; }
    const lead = LX.lead * .9 * clamp(1 - Math.abs(i / 11 - lpos) * 6, 0, 1), strum = LX.strum * .4 * (i % 3 === 1 ? 1 : 0);
    b.I = clamp((.3 + .45 * e) * (.45 + .55 * LX.int) + hit * .7 + ch * .6 * imp + LX.drop * .5 * imp + LX.onset * .15 * (i % 5 === 0 ? 1 : 0) + (lead + strum) * imp, 0, 1.5) * b.on;
    if (b.I < .03) continue; const th = G.base + b.ang * G.sg, col = cols[i % 4], hue = col[0] + (i - 5.5) * 2, w = (.02 + .02 * (1 - (pat === 'spot' || pat === 'converge' ? .6 : 0)) + .02 * e + .02 * LX.snare * imp + .015 * LX.drop * imp) * wk, tx = ox + Math.sin(th) * Lb, ty = oy + Math.cos(th) * Lb, nx = Math.cos(th) * Math.tan(w) * Lb, ny = -Math.sin(th) * Math.tan(w) * Lb, L0 = clamp(Math.max(col[2], 50), 50, 80), cc = [hue, col[1], col[2], lxCh(col)], bl = (dl, a, k) => lxAt(cc, L0 + dl, a, k);
    const a0 = clamp(b.I * (.3 + .22 * e) * (style === 'hard' ? 1.15 : style === 'wash' ? .7 : 1), 0, .85);
    if (style === 'wash') {   // broad, soft: three nested cones, each fading further than the one inside it
      [[1, .42], [.62, .5], [.3, .55]].forEach(([k, am]) => { const gr = g.createLinearGradient(ox, oy, tx, ty); gr.addColorStop(0, bl(8, a0 * am)); gr.addColorStop(.5, bl(0, a0 * am * .5)); gr.addColorStop(1, bl(-6, 0)); g.fillStyle = gr; g.beginPath(); g.moveTo(ox, oy); g.lineTo(tx + nx * k, ty + ny * k); g.lineTo(tx - nx * k, ty - ny * k); g.closePath(); g.fill(); });
    } else {
      const gr = g.createLinearGradient(ox, oy, tx, ty); gr.addColorStop(0, bl(8, a0)); gr.addColorStop(style === 'hard' ? .7 : .45, bl(0, a0 * (style === 'hard' ? .6 : .42))); gr.addColorStop(1, bl(-6, 0));
      g.fillStyle = gr; g.beginPath(); g.moveTo(ox, oy); g.lineTo(tx + nx, ty + ny); g.lineTo(tx - nx, ty - ny); g.closePath(); g.fill();
      const gc = g.createLinearGradient(ox, oy, tx, ty); gc.addColorStop(0, lxAt(cc, 88, a0 * .95, .35)); gc.addColorStop(.5, lxAt(cc, 75, a0 * (style === 'hard' ? .5 : .25), .6)); gc.addColorStop(1, lxAt(cc, 70, 0, .6)); g.fillStyle = gc; g.beginPath(); g.moveTo(ox, oy); g.lineTo(tx + nx * .3, ty + ny * .3); g.lineTo(tx - nx * .3, ty - ny * .3); g.closePath(); g.fill();
    }
    const lr = H * (G.up ? .1 : .07), lcx = clamp(ox, 0, W), lcy = clamp(oy, 0, H), lg = g.createRadialGradient(lcx, lcy, 0, lcx, lcy, lr); lg.addColorStop(0, lxAt(cc, 92, (G.up ? 1 : .9) * Math.min(1, b.I), .3)); lg.addColorStop(1, lxAt(cc, 60, 0, .6)); g.fillStyle = lg; g.fillRect(lcx - lr, lcy - lr, lr * 2, lr * 2);
    const dy = floorY - oy, px = ox + Math.tan(th) * dy; if (!LX.lite && !G.up && lay !== 'sides' && Math.abs(th) < 1.15 && px > -W * .1 && px < W * 1.1) { const rx = H * (.1 + w * 5), pg = g.createRadialGradient(px, floorY, 0, px, floorY, rx); pg.addColorStop(0, bl(8, a0 * .8)); pg.addColorStop(1, bl(0, 0)); g.save(); g.translate(px, floorY); g.scale(1, .22); g.translate(-px, -floorY); g.fillStyle = pg; g.fillRect(px - rx, floorY - rx, rx * 2, rx * 2); g.restore(); }
  }
  if (R.pars !== 0) {
    const bp = (LX.bassM % 12) / 12 * 7;
    for (let i = 0; i < 8; i++) {
      const p = LX.pars[i], x = (i + .5) / 8 * W, col = [pal.a, pal.b, pal.c, LX.key][(i + 1) % 4], bassNear = LX.bass * .7 * clamp(1 - Math.abs(i - bp) * .55, 0, 1);
      p.I = clamp(((.12 + .3 * e) * P.pars + LX.kick * .9 * P.pars + LX.note * .15 * (i % 2) + LX.drop * .6 + bassNear + LX.beatP * .1) * (.6 + .4 * imp), 0, 1.3);
      const a = clamp(p.I * .38, 0, .6), rr = H * (.4 + .18 * LX.kick * imp), rx = W * .1, gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, lxLt(col, a, 4)); gr.addColorStop(.55, lxLt(col, a * .35, 2)); gr.addColorStop(1, lxLt(col, 0, 0)); g.save(); g.translate(x, H); g.scale(1, rr / rx); g.fillStyle = gr; g.fillRect(-rx, -rx, rx * 2, rx); g.restore();
    }
  }
  g.restore();
}
function lxParticles(g, W, H) {
  if (!LX.parts.length) return; g.save(); g.globalCompositeOperation = 'lighter'; LX.parts.forEach(p => {
    const a = clamp(p.life / p.max * 1.6, 0, 1) * (p.c ? .9 : .6); g.fillStyle = lxLt(p.c3 || LX.pal.key, a, p.c ? 6 : 24);
    if (p.c) { g.save(); g.translate(p.x, p.y); g.rotate(p.rot + p.life * 4); g.fillRect(-p.s, -p.s * .5, p.s * 2, p.s); g.restore(); } else { g.beginPath(); g.arc(p.x, p.y, p.s * (H / 900 + .4), 0, 7); g.fill(); }
  }); g.restore();
}
/** the blinder: at most once a bar, never closer than the comfort gap, scaled by the design, the comfort setting and the governor */
function lxStrobe(g, W, H) {
  if (LX.strobe < .03) return; const D = LX.D, a = LX.strobe * lxComfort().strobe * (D && D.rig.flash != null ? D.rig.flash : .5) * LX.gov * 1.4; if (a < .01) return;
  g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = lxHsl(LX.key[0], 25, 92, Math.min(a, .5)); g.fillRect(0, 0, W, H); g.restore();
}
/** a soft dark floor under the lower third, so the chord and the lyric stay readable through the lasers */
function lxScrim(g, W, H) { const y = H * .52, gr = g.createLinearGradient(0, y, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.52)'); g.fillStyle = gr; g.fillRect(0, y, W, H - y); }
function lxVignette(g, W, H, k) { const gr = g.createRadialGradient(W / 2, H * .5, Math.min(W, H) * .25, W / 2, H * .5, Math.hypot(W, H) * .6); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${k})`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
/** the whole Perform picture */
function lxPerform(g, W, H, X, dt, teach) {
  const P = LX.prog, D = LX.D; LX.dtF = dt;
  const hz = P.haze * (D.rig.haze == null ? 1 : D.rig.haze), merged = !lxImgFor('back');   // with no backdrop picture the fog is painted into the stage itself
  lxStage(g, W, H, 1, merged ? hz : 0); lxBackdrop(g, W, H, dt); lxHaze(g, W, H, hz, merged);
  lxWall(g, W, H, X, P.wall * (D.rig.wall === 'off' ? 0 : 1) * (teach ? .55 : 1) * (.4 + .6 * LX.e) * (1 - .4 * Math.min(1, LX.laserAmt) * (LX.laserKit.length ? 1 : 0)));
  lxBeams(g, W, H, dt); lxLasers(g, W, H, dt); lxParticles(g, W, H); lxLogo(g, W, H);
}
