/* ============================================================
   Part 67 · Audience view, and the video take (2.11)
   AUDIENCE VIEW  A Monitor widget that shows the show the way the room sees it: the visuals on a screen, you in front of them (the camera, not mirrored),
   and a crowd's silhouettes at the bottom lit by the screen. It draws its own copy of the show, small, so it works while you are on the Tab or Write
   panels. When the Visuals tab is open it copies that picture instead, so nothing is drawn twice. Nothing is recorded or sent anywhere.
   VIDEO TAKE     When you record the stage as a video, the take recorder runs beside it: what comes in on the armed guitar and voice inputs becomes a
   lane in the arrangement, starting where the video started (what you play, not the band, which is already in the arrangement). Undo removes it.
   ============================================================ */
const mtRnd = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };      // a steady pseudo-random number for a seed
const AUD = { cv: null, off: null, sm: null, big: false, live: false, cam: null, note: null, last: 0, seen: 0 };

function audienceCard() {
  AUD.cv = h('canvas', { class: 'vcanvas', id: 'audCanvas', style: { width: '100%', aspectRatio: '16 / 9', height: 'auto' }, role: 'img', 'aria-label': 'You and the show, as the audience sees them' });
  AUD.cam = h('button', { class: 'btn sm', id: 'audCam', title: 'Start or stop the camera (it stays on this device)', onclick: async () => { if (CAM.on) stopCam(); else await startCam(); audSync(); } }, '📷 Camera on');
  const big = h('button', { class: 'btn sm', id: 'audBig', 'aria-pressed': 'false', title: 'Make the picture taller', onclick: e => { AUD.big = !AUD.big; e.currentTarget.setAttribute('aria-pressed', AUD.big ? 'true' : 'false'); AUD.cv.style.aspectRatio = AUD.big ? '4 / 3' : '16 / 9'; } }, '⤢ Taller');
  AUD.note = h('div', { class: 'tiny muted', id: 'audNote', style: { marginTop: '4px', lineHeight: 1.45 } });
  return h('div', { class: 'card', id: 'audCard' }, h('h4', {}, 'Audience view', h('span', { class: 'badge' }, 'as they see you')),
    h('div', { class: 'card-b', style: { padding: '6px' } }, AUD.cv, h('div', { class: 'row', style: { gap: '6px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'center' } }, AUD.cam, big, camFxBox()), AUD.note));
}
function audSync() {
  if (!AUD.cam) return; AUD.cam.textContent = CAM.on ? '📷 Camera off' : '📷 Camera on'; AUD.cam.classList.toggle('on', !!CAM.on);
  const copy = typeof paneVisible === 'function' && paneVisible('vis');
  AUD.note.textContent = !CAM.on ? 'The camera is off, so you are not in the picture yet. Turn it on and pick “Me in front” to stand in front of the show.'
    : copy && CFG.mirror ? 'Mirrored here because the Visuals tab is open. On other tabs the audience’s side is shown, unmirrored.' : 'Not mirrored: this is the side the audience sees.';
}
/** a crowd: rows of heads and shoulders, a few with an arm up or a phone, swaying a little with the music, lit from the screen */
function audCrowd(g, W, H, t, e, hue) {
  const y0 = H * .70; g.save();
  const sp = g.createLinearGradient(0, y0 - H * .06, 0, H); sp.addColorStop(0, hmHsl(hue, 85, 55, .42 + e * .22)); sp.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sp; g.fillRect(0, y0 - H * .06, W, H - y0 + H * .06);
  for (let row = 0; row < 3; row++) {
    const n = 15 + row * 4, base = y0 + H * (.1 + row * .075), sc = .72 + row * .26, shade = row === 0 ? '#2a1d3d' : row === 1 ? '#190f29' : '#0c0716';
    for (let i = 0; i < n; i++) {
      const r1 = mtRnd(row * 97 + i * 3.1), r2 = mtRnd(row * 53 + i * 7.7), x = ((i + .5 + (r1 - .5) * .6) / n) * W, sway = Math.sin(t * (1 + r2) * 1.6 + i) * e * H * .012, hr = H * .036 * sc * (.9 + r2 * .2), y = base - hr * 1.2 + sway - (r2 > .8 ? H * .02 : 0);
      g.fillStyle = shade; g.beginPath(); g.ellipse(x, y + hr * 2.4, hr * 2.1, hr * 1.9, 0, Math.PI, 0); g.fill(); g.beginPath(); g.arc(x, y, hr, 0, 7); g.fill();
      g.strokeStyle = hmHsl(hue + r1 * 40, 90, 66, .75 - row * .18); g.lineWidth = Math.max(1, H * .004); g.beginPath(); g.arc(x, y, hr, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      if (r1 > .78) { const ax = x + (r2 > .5 ? 1 : -1) * hr * 1.5, ay = y - hr * (2.4 + Math.sin(t * 3 + i) * e * .5); g.strokeStyle = shade; g.lineWidth = hr * .7; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + (ax - x) * .5, y + hr * 1.6); g.lineTo(ax, ay); g.stroke();
        if (r1 > .93) { g.fillStyle = 'rgba(210,235,255,.85)'; g.fillRect(ax - hr * .4, ay - hr * .9, hr * .8, hr * 1.2); } }
    }
  }
  g.restore();
}
function audDraw() {
  const cv = AUD.cv; if (!cv || !cv.isConnected || !E.ready) return; const w = cv.clientWidth; if (!w) return;
  const nowp = performance.now(); if (nowp - AUD.seen > 400) { AUD.seen = nowp; audSync(); }
  AUD.live = !!CAM.on;
  const d = Math.min(2, window.devicePixelRatio || 1), W = Math.round(w * d), H = Math.round(w * (AUD.big ? 3 / 4 : 9 / 16) * d);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d'), sx = Math.round(W * .07), sy = Math.round(H * .05), sw = Math.round(W * .86), sh = Math.round(H * (AUD.big ? .62 : .64)), t = performance.now() / 1000;
  const copy = typeof paneVisible === 'function' && paneVisible('vis') && UI.vcv && UI.vcv.width > 8;      // the Visuals tab is already drawing the show
  let src = UI.vcv;
  if (!copy) {
    const off = AUD.off || (AUD.off = document.createElement('canvas')); if (off.width !== sw || off.height !== sh) { off.width = sw; off.height = sh; }
    const cam = !!(CAM.on && CAM.video && CAM.video.readyState >= 2), mir = CFG.mirror, keep = VZ.sm; src = off;
    CFG.mirror = false; VZ.sm = AUD.sm;           // the audience is not looking in a mirror; the hexagon field keeps its own smoothing
    try { drawVis(off, { mode: VZ.mode, cam, bgA: 1, noText: false }); if (cam && (CFG.camFx || 'over') !== 'over') camTop(off.getContext('2d'), sw, sh); }
    catch (e) { if (!AUD.err) { AUD.err = 1; console.warn('audience view', e); } } finally { CFG.mirror = mir; AUD.sm = VZ.sm; VZ.sm = keep; }
  }
  const C = vcol(), hue = (typeof HM !== 'undefined' && HM.chord ? lxHueOf(lxFifths(HM.chord.root)) : 38), e = clamp((AN.rms + 60) / 50, 0, 1) * (AN.active ? 1 : .3) + (T.playing ? .25 : 0);
  g.globalAlpha = 1; g.fillStyle = '#04030a'; g.fillRect(0, 0, W, H);
  const hz = g.createRadialGradient(W / 2, sy + sh * .5, sh * .2, W / 2, sy + sh * .5, W * .62); hz.addColorStop(0, hmHsl(hue, 80, 45, .22)); hz.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = hz; g.fillRect(0, 0, W, H);
  g.fillStyle = '#16121f'; g.fillRect(sx - 5, sy - 5, sw + 10, sh + 10);                      // the screen's frame
  try { g.drawImage(src, sx, sy, sw, sh); } catch (er) { }
  g.save(); g.globalAlpha = .16; g.translate(0, sy + sh * 2 + 2); g.scale(1, -1); try { g.drawImage(src, sx, sy + sh - Math.round(sh * .14), sw, Math.round(sh * .14), sx, sy + sh, sw, Math.round(sh * .14)); } catch (er) { } g.restore();   // its reflection on the floor
  audCrowd(g, W, H, t, e, hue);
  if (!CAM.on) { g.font = `600 ${Math.max(10, Math.round(H * .036))}px system-ui,sans-serif`; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText('Camera off · you are not in the picture', W / 2, sy + sh - H * .03); g.textAlign = 'left'; }
  const vg = g.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, W * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
}

/* ---------- the video take: your playing goes into the arrangement while the stage is recorded ---------- */
/** called as the stage recording starts (after the band, if the whole song is being recorded) */
function srecTakeBegin(whole) {
  SREC.take = null;
  if (CFG.srecTake === false || SREC.audio || !E.hasInput || REC || T.rec) return;
  if (!armedG() && !armedV()) { CFG.armG = true; try { saveCfg(); } catch (e) { } }       // nothing armed: keep the guitar, the usual lane
  let slot = T.playing ? playheadSlot() : T.cursor, tm = E.ctx.currentTime;
  if (whole && T.q && T.q.length) { slot = T.q[0].slot; tm = T.q[0].time; }                 // the count-in is not part of the take
  const before = snap(); recBegin(slot, tm); if (REC) SREC.take = { before, n0: TAKES.length };
}
/** called as the recording stops; keep=false throws the take away with the video */
function srecTakeEnd(keep) {
  const k = SREC.take; SREC.take = null; if (!k) return;
  if (!REC) return;
  if (!keep) { REC = null; try { E.tapDI.on(false); E.tapWet.on(false); E.tapVox.on(false); } catch (e) { } bus.emit('rec:state', false); return; }
  recEnd();
  if (TAKES.length > k.n0) { tkDone(k.before); toast('Your playing from the video is in the arrangement, starting where the video started. Undo (Ctrl/⌘+Z) takes it out.', 'ok'); }
}
