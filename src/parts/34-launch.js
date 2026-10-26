/* ============================================================
   First impression: a living hexagon field behind the front screen, and a full-screen "center stage"
   (camera + hexagons) that the first song starts on. Nothing here touches the microphone or camera;
   those are requested only by the buttons that say so.
   ============================================================ */
(function bootHexInit() {
  const cv = document.getElementById('bootHex'); if (!cv) return;
  const g = cv.getContext('2d'), still = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let W = 0, H = 0, dpr = 1, t0 = performance.now(), last = 0;
  const size = () => { dpr = Math.min(1.5, window.devicePixelRatio || 1); W = cv.width = Math.floor(innerWidth * dpr); H = cv.height = Math.floor(innerHeight * dpr); };
  size(); addEventListener('resize', size);
  const hexPath = (x, y, r) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); } g.closePath(); };
  function frame(now) {
    if (!document.getElementById('bootHex')) return;
    requestAnimationFrame(frame); if (now - last < 33 && !still) return; last = now;
    try { paint(now); } catch (e) { last = Infinity; }
  }
  function paint(now) {
    const t = (now - t0) / 1000, R = Math.max(26, Math.min(W, H) / 15) * (dpr > 1 ? 1 : 1), dx = R * Math.sqrt(3), dy = R * 1.5, cx = W / 2, cy = H * .46, maxd = Math.hypot(W, H) * .55;
    g.fillStyle = '#04090a'; g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(cx, cy, 0, cx, cy, maxd); glow.addColorStop(0, 'rgba(61,220,132,.16)'); glow.addColorStop(.5, 'rgba(61,220,132,.04)'); glow.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = glow; g.fillRect(0, 0, W, H);
    const beat = (t % 1.9) / 1.9;
    for (let row = -1; row * dy < H + R; row++) for (let col = -1; col * dx < W + dx; col++) {
      const x = col * dx + (row & 1 ? dx / 2 : 0), y = row * dy, d = Math.hypot(x - cx, y - cy), fall = Math.max(0, 1 - d / maxd);
      const ring = Math.max(0, 1 - Math.abs(d / maxd - beat * 1.1) * 7), wave = .5 + .5 * Math.sin(d * .011 - t * 1.4 + Math.sin(x * .004 + t * .3) * 2), a = Math.min(1, fall * fall * (.2 + wave * .55) + ring * .85 * fall);
      const warm = ((col * 7 + row * 13) % 11) === 0;
      g.fillStyle = (warm ? 'rgba(242,182,50,' : 'rgba(61,220,132,') + (a * (warm ? .5 : .42)).toFixed(3) + ')'; hexPath(x, y, R * (.9 + ring * .08)); g.fill();
      g.strokeStyle = 'rgba(125,191,155,' + (.05 + a * .5).toFixed(3) + ')'; g.lineWidth = 1; g.stroke();
    }
  }
  requestAnimationFrame(frame);
})();

/* full-screen center stage */
function vzImmersive(on) {
  const b = document.body; if (!!on === b.classList.contains('vz-imm')) return;
  if (on) { try { dockGo('vis'); } catch (e) { } }
  b.classList.toggle('vz-imm', !!on);
  let hud = document.getElementById('vzHud');
  if (on && !hud) {
    hud = h('div', { id: 'vzHud', role: 'toolbar', 'aria-label': 'Stage controls' },
      h('span', { class: 'vzh-brand' }, h('i', { 'aria-hidden': 'true' }, '⬡'), 'the-daily.studio'),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn sm', id: 'vzhNew', title: 'Start a new song: hum, guitar, a song file or a blank page', onclick: () => humStageFirst() }, '＋', h('span', { class: 'lbl' }, ' New song')),
      h('button', { class: 'btn sm', id: 'vzhLook', title: 'Change the look: Hex Resonance, Fifths Halo, Prism, Tunnel', onclick: () => vzCycleLook() }, '✦', h('span', { class: 'lbl' }, ' Look')),
      h('button', { class: 'btn sm', id: 'vzhIo', title: 'Microphone, camera and other inputs', onclick: () => { vzImmersive(false); try { sideShow('io'); } catch (e) { } } }, '⚙', h('span', { class: 'lbl' }, ' Inputs')),
      h('button', { class: 'btn sm vzh-kill', id: 'vzhKill', title: 'Stop all sound and release the microphone (Ctrl + .)', onclick: () => { try { audioKill(); } catch (e) { } } }, '■', h('span', { class: 'lbl' }, ' Stop audio')),
      h('button', { class: 'btn sm', id: 'vzhFull', title: 'Full screen', 'aria-label': 'Full screen', onclick: () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => { }); } catch (e) { } } }, '⛶'),
      h('button', { class: 'btn sm', id: 'vzhExit', title: 'Back to the studio', onclick: () => vzImmersive(false) }, '✕ Studio'));
    document.body.append(hud);
  }
  if (on) setTimeout(() => { try { window.dispatchEvent(new Event('resize')); } catch (e) { } }, 30);
  else { try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { } try { window.dispatchEvent(new Event('resize')); } catch (e) { } }
}
bus.on('dock', id => { const c = typeof id === 'string' ? id : DOCK.cur; if (c && c !== 'vis' && document.body.classList.contains('vz-imm')) vzImmersive(false); });

/* Pressing Begin or "Start and connect my input" also starts the camera backdrop on the visuals (unless you turned it off earlier).
   "Start with camera and mic off" never does. */
bus.on('booted', () => { if (HUM.cam0 !== true) return; if (CFG.humStage !== false && !CAM.on && DOCK.cur === 'vis') vzCenterStage(true); });

/* ---------- the two routes: the studio, or the stage (full-screen visuals with the camera) ---------- */
function setRoute(r) { CFG.route = r === 'stage' ? 'stage' : 'studio'; saveCfg(); bus.emit('route-pref', CFG.route); }
/** go on stage now, from anywhere in the studio: full-screen visuals, and the camera unless you turned it off there */
async function goOnStage() { setRoute('stage'); HUM.cam0 = true; if (ZOOM.cur === 'canvas') zoomSet('song', true); try { await humStageGo(); } catch (e) { } }
/** the same two-way switch wherever it is shown (Settings, I/O ▸ Camera) */
function routeControl() {
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Where to start' }), sync = () => { seg.innerHTML = ''; [['studio', '🎛 Studio'], ['stage', '🎥 Stage']].forEach(([v, t]) => { const on = (CFG.route === 'stage') === (v === 'stage'); seg.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(on), class: on ? 'on' : '', title: v === 'stage' ? 'Start on the stage: full-screen visuals with the camera (asked for when you start)' : 'Start in the studio: no camera', onclick: () => setRoute(v) }, t)); }); };
  sync(); bus.on('route-pref', sync); return seg;
}
/** a new song starts with the band off: say so once, the first time someone presses Play on chords with nothing else to hear */
var BAND_HINT_DONE = false;
function bandHint() {
  if (BAND_HINT_DONE || S.band.drumsOn || S.band.bassOn || S.band.compOn || S.band.leadOn || TAKES.length || (typeof STM !== 'undefined' && STM.ch) || !songHasWork()) return;
  BAND_HINT_DONE = true; toast('The band is off in this song. Turn on Drums, Bass or Rhythm in the BAND row to hear it.', 'ok');
}
