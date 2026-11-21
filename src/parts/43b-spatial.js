/* ============================================================
   Part 43b · Spatial audio (2.74) — the band placed around you
   Off by default. When on, each band part is routed through a 3D panner (HRTF) at a fixed place on a circle around you — drums and
   vocal ahead, bass just off-centre, the guitars to the sides, keys behind — so on headphones the band surrounds you. A gentle Spin
   turns the whole circle. It only re-routes the live mix (pan → a panner → the mix); the dry recording and the fast bounce are untouched,
   so takes and exports are unchanged. It heals itself if the audio engine restarts (it notices the panners belong to an old context).
   ============================================================ */
const SPAT = { on: false, spin: 0, t: 0, R: 2.2, p: {}, az: { drums: 0, bass: -18, rhythm: -78, lead: 78, keys: -140, live: 140, vox: 0 } };
CFG.spatial = !!CFG.spatial;

function spatPanner() { const c = E.ctx, n = c.createPanner(); try { n.panningModel = 'HRTF'; } catch (e) { } n.distanceModel = 'inverse'; n.refDistance = 1; n.rolloffFactor = .25; n.coneInnerAngle = 360; return n; }
/** point the listener forward and set every source on its circle (the Spin offset uses SPAT.t); `imm` places them at once, else it glides */
function spatPlace(imm) {
  const c = E.ctx; if (!c) return; const L = c.listener;
  try { if (L.positionX) { L.positionX.value = 0; L.positionY.value = 0; L.positionZ.value = 0; L.forwardX.value = 0; L.forwardY.value = 0; L.forwardZ.value = -1; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; } else if (L.setPosition) { L.setPosition(0, 0, 0); L.setOrientation(0, 0, -1, 0, 1, 0); } } catch (e) { }
  Object.keys(SPAT.p).forEach(id => { const p = SPAT.p[id]; if (!p) return; const a = (SPAT.az[id] || 0) * Math.PI / 180 + SPAT.t, x = Math.sin(a) * SPAT.R, z = -Math.cos(a) * SPAT.R; try { if (p.positionX) { if (imm) { p.positionX.value = x; p.positionZ.value = z; } else { tc(p.positionX, x, .06); tc(p.positionZ, z, .06); } p.positionY.value = 0; } else p.setPosition(x, 0, z); } catch (e) { } });
}
/** turn spatial audio on or off by re-routing each band track's pan → (panner) → its mix destination (t.dst, part 02) */
function spatToggle(on) {
  if (!E.ctx || !E.tr) return false; on = on == null ? !SPAT.on : !!on;
  if (on) {
    SPAT.p = {};      /* fresh panners on the current context */
    Object.keys(SPAT.az).forEach(id => { const t = E.tr[id]; if (!t || !t.dst) return; const p = SPAT.p[id] = spatPanner(); try { t.pan.disconnect(t.dst); } catch (e) { } try { t.pan.connect(p); p.connect(t.dst); } catch (e) { } });
    SPAT.on = true; spatPlace(true);
  } else {
    Object.keys(SPAT.p).forEach(id => { const t = E.tr[id], p = SPAT.p[id]; if (t) { try { t.pan.disconnect(p); } catch (e) { } try { t.pan.connect(t.dst); } catch (e) { } } try { p.disconnect(); } catch (e) { } });
    SPAT.p = {}; SPAT.on = false;
  }
  CFG.spatial = SPAT.on; saveCfg(); bus.emit('spatial', SPAT.on); return SPAT.on;
}
function spatSet(k, v) { if (k === 'spin') SPAT.spin = clamp(v, 0, 1); saveCfg(); }
/** every 80 ms: advance the Spin, keep the sources placed, and heal after an audio restart (the panners would belong to an old context) */
setInterval(() => {
  if (!SPAT.on || !E.ctx) return; const any = SPAT.p[Object.keys(SPAT.p)[0]];
  if (any && any.context !== E.ctx) { SPAT.on = false; spatToggle(true); return; }      /* engine restarted: rebuild on the new context */
  SPAT.t += SPAT.spin * .09; spatPlace();
}, 80);

/** the control in the visuals ⋯ More panel (referenced at runtime by part 09) */
function spatControl() {
  const wrap = h('span', { class: 'vz-spat', style: { display: 'inline-flex', gap: '4px', alignItems: 'center' } });
  const btn = h('button', { class: 'btn sm' + (SPAT.on ? ' on' : ''), id: 'spatBtn', 'aria-pressed': String(!!SPAT.on), title: 'Spatial audio: on headphones, place the band in a circle around you (drums and vocal ahead, guitars to the sides, keys behind)', onclick: () => { const on = spatToggle(); btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', String(on)); spin.style.display = on ? '' : 'none'; toast(on ? '🎧 Spatial audio on — best on headphones' : 'Spatial audio off', 'ok'); } }, '🎧 Spatial');
  const spin = h('label', { class: 'vz-spin', title: 'Spin: turn the band slowly around you', style: { display: SPAT.on ? '' : 'none', alignItems: 'center', gap: '2px' } }, h('span', { class: 'small muted' }, 'Spin'), h('input', { type: 'range', min: 0, max: 1, step: .01, value: SPAT.spin, 'aria-label': 'Spatial spin', style: { width: '54px' }, oninput: e => spatSet('spin', +e.target.value) }));
  wrap.append(btn, spin); return wrap;
}
bus.on('song', () => { });
