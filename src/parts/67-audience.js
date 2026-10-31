/* ============================================================
   Part 67 · Audience view, and the video take (2.11)
   AUDIENCE VIEW  A Monitor widget that shows the show the way the room sees it: the visuals, with you in front of them (the camera, not mirrored), so
   you can watch your own expression while you record. It draws its own copy of the show, small, so it works while you are on the Tab or Write
   panels. When the Visuals tab is open it copies that picture instead, so nothing is drawn twice. Nothing is recorded or sent anywhere.
   VIDEO TAKE     When you record the stage as a video, the take recorder runs beside it: what comes in on the armed guitar and voice inputs becomes a
   lane in the arrangement, starting where the video started (what you play, not the band, which is already in the arrangement). Undo removes it.
   ============================================================ */
const AUD = { cv: null, off: null, sm: null, live: false, cam: null, note: null, last: 0, seen: 0 };

function audienceCard() {
  AUD.cv = h('canvas', { class: 'vcanvas', id: 'audCanvas', style: { width: '100%', aspectRatio: '16 / 9', height: 'auto' }, role: 'img', 'aria-label': 'You and the show, as the audience sees them' });
  AUD.cam = h('button', { class: 'btn sm', id: 'audCam', title: 'Start or stop the camera (it stays on this device)', onclick: async () => { if (CAM.on) stopCam(); else await startCam(); audSync(); } }, '📷 Camera on');
  AUD.note = h('div', { class: 'tiny muted', id: 'audNote', style: { marginTop: '4px', lineHeight: 1.45 } });
  return h('div', { class: 'card', id: 'audCard' }, h('h4', {}, 'Audience view', h('span', { class: 'badge' }, 'as they see you')),
    h('div', { class: 'card-b', style: { padding: '6px' } }, AUD.cv, h('div', { class: 'row', style: { gap: '6px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'center' } }, AUD.cam, camFxBox()), AUD.note));
}
function audSync() {
  if (!AUD.cam) return; AUD.cam.textContent = CAM.on ? '📷 Camera off' : '📷 Camera on'; AUD.cam.classList.toggle('on', !!CAM.on);
  const copy = typeof paneVisible === 'function' && paneVisible('vis');
  AUD.note.textContent = !CAM.on ? 'The camera is off, so you are not in the picture yet. Turn it on and pick “Me in front” to stand in front of the show.'
    : copy && CFG.mirror ? 'Mirrored here because the Visuals tab is open. On other tabs the audience’s side is shown, unmirrored.' : 'Not mirrored: this is the side the audience sees.';
}
function audDraw() {
  const cv = AUD.cv; if (!cv || !cv.isConnected || !E.ready) return; const w = cv.clientWidth; if (!w) return;
  const nowp = performance.now(); if (nowp - AUD.seen > 400) { AUD.seen = nowp; audSync(); }
  AUD.live = !!CAM.on;
  const d = Math.min(2, window.devicePixelRatio || 1), W = Math.round(w * d), H = Math.round(w * 9 / 16 * d);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d'), copy = typeof paneVisible === 'function' && paneVisible('vis') && UI.vcv && UI.vcv.width > 8;      // the Visuals tab is already drawing the show
  let src = UI.vcv;
  if (!copy) {
    const off = AUD.off || (AUD.off = document.createElement('canvas')); if (off.width !== W || off.height !== H) { off.width = W; off.height = H; }
    const cam = !!(CAM.on && CAM.video && CAM.video.readyState >= 2), mir = CFG.mirror, keep = VZ.sm; src = off;
    CFG.mirror = false; VZ.sm = AUD.sm;           // the audience is not looking in a mirror; the hexagon field keeps its own smoothing
    try { drawVis(off, { mode: VZ.mode, cam, bgA: 1, noText: false }); if (cam && (CFG.camFx || 'over') !== 'over') camTop(off.getContext('2d'), W, H); }
    catch (e) { if (!AUD.err) { AUD.err = 1; console.warn('audience view', e); } } finally { CFG.mirror = mir; AUD.sm = VZ.sm; VZ.sm = keep; }
  }
  g.globalAlpha = 1; g.fillStyle = '#04030a'; g.fillRect(0, 0, W, H);
  try { g.drawImage(src, 0, 0, W, H); } catch (er) { }
  if (!copy) tipDraw(g, W, H, 'aud', tipVisAvoid(W, H, VZ.mode));   /* its own copy of the show: the tip jar as on the Visuals (a copy of the Visuals already has it) */
  if (!CAM.on) { g.font = `600 ${Math.max(10, Math.round(H * .045))}px system-ui,sans-serif`; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText('Camera off · you are not in the picture', W / 2, H * .92); g.textAlign = 'left'; }
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
