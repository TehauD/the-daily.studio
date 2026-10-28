/* ============================================================
   Part 57 · LASERS — thin, hard-edged beams through the haze, built from the music's own phase
   Eight patterns that combine (a chorus runs two to five at once) and that the show design chooses per section:
     fan · cone · zipper · curtain (sheet) · lattice (grid) · scribble (a Lissajous figure) · tunnel (hexagon rings) · starburst (on the drop)
   Every angle is a function of the bar position (LX.pos) or the beat (LX.beat), never of time, so the picture cannot drift off the grid.
   Designs with snap = 1 move in steps that land on the beat. The beams brighten on the band's real hits (kick, snare, hats, strums,
   lead notes), so a syncopated groove draws a syncopated show. A pattern fades in and out over half a beat when the kit changes.
   These are pictures of lasers on the screen. Nothing here drives a real laser.
   ============================================================ */
const LZ = { amp: {} };
const LZ_RATIO = [[3, 2], [5, 4], [3, 4], [2, 3], [5, 6], [1, 2]];
const lxTri = x => 1 - Math.abs(2 * lxFrac(x) - 1);
/** one beam: a faint wide halo (skipped in lite mode), a brighter body and a near-white core */
function lxLB(g, x0, y0, x1, y1, col, a, w) {
  if (a < .015) return; a = Math.min(a, 1); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1);
  if (!LX.lite) { g.strokeStyle = lxCl(col, a * .1); g.lineWidth = w * 4.5; g.stroke(); }
  g.strokeStyle = lxCl(col, a * .32, 8); g.lineWidth = w * 2.1; g.stroke();
  g.strokeStyle = lxCl(col, a * .9, 30, -30); g.lineWidth = w; g.stroke();
}
/** a path (Path2D), stroked as a halo, a body and a core */
function lxStroke3(g, P, col, a, w) {
  if (a < .015) return; a = Math.min(a, 1);
  if (!LX.lite) { g.strokeStyle = lxCl(col, a * .1); g.lineWidth = w * 4.5; g.stroke(P); }
  g.strokeStyle = lxCl(col, a * .32, 8); g.lineWidth = w * 2.1; g.stroke(P);
  g.strokeStyle = lxCl(col, a * .9, 30, -30); g.lineWidth = w; g.stroke(P);
}
function lzFan(c, a) {
  const { g, W, H } = c, n = 7, sw = (c.snap ? lxStep(LX.pos / 4, 8) : LX.pos / 4) * Math.PI * 2, open = .055 + .045 * a + .1 * LX.kick * c.imp, mir = (LX.fb ? Math.floor(LX.fb.bi / 4) : 0) % 2 === 0, s = Math.sin(sw) * .4, len = H * 2.4;
  [[.17, 1], [.83, -1]].forEach(([fx, sg], bi) => {
    const ox = W * fx, oy = -H * .02, base = mir ? sg * (.28 + s) : sg * .28 + s;
    for (let i = 0; i < n; i++) { const ang = base + (i - (n - 1) / 2) * open; lxLB(g, ox, oy, ox + Math.sin(ang) * len, oy + Math.cos(ang) * len, (i + bi) % 2 ? c.l2 : c.l1, c.gate * a * c.amt, c.lw); }
  });
}
function lzZipper(c, a) {
  const { g, W, H } = c, n = 4, ph = c.snap ? lxStep(LX.beat / 4, 8) : LX.beat / 4, len = H * 2.4;
  [[.03, 1], [.97, -1]].forEach(([fx, sg], bi) => {
    for (let i = 0; i < n; i++) { const t = lxTri(ph + i / n * .5 + bi * .08), ang = sg * lerp(-.12, 1.12, t), ox = W * fx; lxLB(g, ox, 0, ox + Math.sin(ang) * len, Math.cos(ang) * len, (i + bi) % 2 ? c.l1 : c.l2, c.gate * a * c.amt * (.55 + .45 * t), c.lw); }
  });
}
function lzCone(c, a) {
  const { g, W, H } = c, n = 14, cx = W / 2, oy = -H * .02, rot = (c.snap ? lxStep(LX.beat / 2, 2) : LX.beat / 2) * (Math.PI * 2 / n), R = W * (.32 + .1 * LX.beatP * c.imp + .06 * a), RY = H * .34;
  for (let i = 0; i < n; i++) { const th = i * 2 * Math.PI / n + rot, ex = cx + Math.cos(th) * R, ey = H * .42 + Math.sin(th) * RY, dx = ex - cx, dy = ey - oy; lxLB(g, cx, oy, cx + dx * 1.9, oy + dy * 1.9, i % 2 ? c.l2 : c.l1, c.gate * a * c.amt * .9, c.lw); }
}
function lzSheet(c, a) {
  const { g, W, H } = c, K = 3, N = Math.max(40, Math.round(W / 17)), ph = LX.pos * Math.PI * 2 / 4, pulse = .55 + .45 * Math.max(c.gate, LX.beatP * c.imp);
  g.lineCap = 'butt';
  for (let k = 0; k < K; k++) {
    const col = k % 2 ? c.l2 : c.l1, base = H * (.3 + .13 * k), amp = H * (.045 + .015 * k), fq = 1.3 + .45 * k, sp = ph * (k % 2 ? -1 : 1) * (1 + k * .3) + k * 1.9, hmax = H * (.2 + .06 * k), al = a * c.amt * pulse * (1 - k * .18), xs = [], ys = [];
    const gr = g.createLinearGradient(0, base - amp - hmax, 0, base + amp); gr.addColorStop(0, lxCl(col, 0)); gr.addColorStop(.7, lxCl(col, al * .3)); gr.addColorStop(1, lxCl(col, al * .8, 14, -10));
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const u = i / N, x = W * (.02 + .96 * u), env = Math.pow(Math.sin(Math.PI * u), .6), y = base + Math.sin(u * 6.283 * fq + sp) * amp + Math.sin(u * 15.7 + sp * 1.7) * amp * .25, hh = hmax * env * (.55 + .45 * Math.sin(u * 23 + sp * 2.3 + k));
      g.moveTo(x, y - hh); g.lineTo(x, y); xs.push(x); ys.push(y);
    }
    g.strokeStyle = gr; g.lineWidth = Math.max(1.2, W / N * .58); g.stroke();
    const P = new Path2D(); for (let i = 0; i <= N; i++) { if (i) P.lineTo(xs[i], ys[i]); else P.moveTo(xs[i], ys[i]); } g.lineCap = 'round'; lxStroke3(g, P, col, al, c.lw * .8); g.lineCap = 'butt';
  }
}
function lzGrid(c, a) {
  const { g, W, H } = c, n = 6, sw = Math.sin((c.snap ? lxStep(LX.pos / 2, 8) : LX.pos / 2) * Math.PI * 2) * .1, len = H * 2.4;
  [[0, 1], [W, -1]].forEach(([ox, sg], bi) => { for (let i = 0; i < n; i++) { const ang = sg * (.2 + i * .13 + sw + LX.kick * .04 * c.imp); lxLB(g, ox, 0, ox + Math.sin(ang) * len, Math.cos(ang) * len, bi ? c.l2 : c.l1, c.gate * a * c.amt * .85, c.lw); } });
}
function lzLissa(c, a) {
  const { g, W, H } = c, r = LZ_RATIO[(LX.seed + LX.occ + (LX.fb ? Math.floor(LX.fb.bi / 2) : 0)) % LZ_RATIO.length], cx = W / 2, cy = H * .4, R = Math.min(W * .3, H * .46) * (.78 + .22 * a + .16 * LX.kick * c.imp);
  const del = (c.snap ? lxStep(LX.pos / 4, 8) : LX.pos / 4) * Math.PI * 2, rot = LX.pos / 16 * Math.PI * 2, cr = Math.cos(rot), sr = Math.sin(rot);
  for (let pass = 0; pass < 2; pass++) {
    const P = new Path2D(), N = 200; for (let i = 0; i <= N; i++) { const u = i / N * Math.PI * 2, x0 = Math.sin(r[0] * u + del + pass * .9) * R, y0 = Math.sin(r[1] * u) * R * .72, x = cx + x0 * cr - y0 * sr, y = cy + x0 * sr + y0 * cr; if (i) P.lineTo(x, y); else P.moveTo(x, y); }
    lxStroke3(g, P, pass ? c.l2 : c.l1, c.gate * a * c.amt * .8, c.lw * .9);
  }
}
function lzTunnel(c, a) {
  const { g, W, H } = c, K = 9, cx = W / 2, cy = H * .42, Rm = Math.hypot(W, H) * .5, f = lxFrac(c.snap ? lxStep(LX.beat, 1) : LX.beat);
  for (let k = 0; k < K; k++) {
    const t = (k + f) / K, r = Rm * t * t, rot = LX.pos / 24 * Math.PI * 2 + k * .05, al = Math.sin(Math.PI * t) * a * c.amt * (.5 + .5 * Math.max(c.gate, LX.beatP * c.imp)); if (al < .02 || r < 4) continue;
    const P = new Path2D(); for (let i = 0; i <= 6; i++) { const th = rot + i * Math.PI / 3; if (i) P.lineTo(cx + Math.cos(th) * r, cy + Math.sin(th) * r * .8); else P.moveTo(cx + Math.cos(th) * r, cy + Math.sin(th) * r * .8); }
    lxStroke3(g, P, k % 2 ? c.l2 : c.l1, al, c.lw * (.6 + 1.2 * t));
  }
}
function lzBurst(c, b) {
  const { g, W, H } = c, n = 28, cx = W / 2, cy = H * .4, Rm = Math.hypot(W, H) * .55, len = Rm * (.15 + 1.1 * (1 - b)), inner = len * .12 * (1 - b);
  for (let i = 0; i < n; i++) { const ang = i / n * Math.PI * 2 + LX.pos * .05, ca = Math.cos(ang), sa = Math.sin(ang); lxLB(g, cx + ca * inner, cy + sa * inner * .8, cx + ca * len, cy + sa * len * .8, i % 2 ? c.l2 : c.l1, Math.pow(b, 1.2) * c.amt, c.lw * 1.2); }
}
function lxLasers(g, W, H, dt) {
  const D = LX.D, kit = LX.laserKit || [], amt = LX.laserAmt || 0, barSec = spb() * slotDur(), kk = 1 - Math.exp(-dt / Math.max(.15, barSec / 8)); let any = false;
  SHOW_PATS.forEach(p => { const want = (LX.mode !== 'idle' && LX.e > .2 && kit.includes(p) && amt > 0) ? 1 : 0, a = LZ.amp[p] || 0; LZ.amp[p] = a + (want - a) * kk; if (LZ.amp[p] > .02) any = true; });
  const bz = (amt > 0 && !D.noBurst && !(D.allow && !D.allow.includes('burst'))) ? LX.burst : 0; if (!any && bz < .02) return;
  const pal = LX.pal, c = { g, W, H, snap: !!(D.mot && D.mot.snap), imp: LX.gov * lxComfort().impulse, amt: Math.min(1.1, amt), l1: pal.l1, l2: pal.l2, lw: Math.max(1.3, H * .0022), gate: 1 };
  /* the beams swell with each hit, but how deep that swell goes belongs to the comfort level and the governor: the lasers never blink on and off with every 16th note */
  c.gate = 1 - (1 - clamp(.3 + .7 * Math.max(LX.snare, LX.kick * .85, LX.hat * .35, LX.strum * .6, LX.lead * .6), 0, 1)) * clamp(c.imp, 0, 1);
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
  const A = LZ.amp; if (A.sheet > .02) lzSheet(c, A.sheet); if (A.tunnel > .02) lzTunnel(c, A.tunnel); if (A.lissa > .02) lzLissa(c, A.lissa); if (A.grid > .02) lzGrid(c, A.grid);
  if (A.cone > .02) lzCone(c, A.cone); if (A.zipper > .02) lzZipper(c, A.zipper); if (A.fan > .02) lzFan(c, A.fan); if (bz > .02) lzBurst(c, bz);
  g.restore();
}
