/* ---------- Lane mixer: a small strip on every lane, and a master chip ----------
   Each lane (band parts, vocal, takes, stems, the backing track) can have a strip: 3-band EQ, a one-knob compressor, and sends
   to a shared reverb and a tempo-synced delay. The strip sits after the lane's fader and pan, so mute / solo / level still rule.
   The master has a preset chain (tone + glue compressor) and a loudness target for exports. Everything is local Web Audio. */
const FX_KEYS = ['lo', 'mid', 'hi', 'comp', 'rev', 'dly'];
const FX_DEF = { lo: 0, mid: 0, hi: 0, comp: 0, rev: 0, dly: 0 };
const FX_PRE = [['Flat', {}], ['Warm', { lo: 2, mid: -1, hi: -2, comp: .2 }], ['Bright', { lo: -1, hi: 3, comp: .15 }], ['Punch', { lo: 1.5, hi: 1, comp: .55 }], ['Room', { rev: .22 }], ['Hall', { hi: -1, rev: .5 }], ['Echo', { dly: .3, rev: .12 }]];
const FX_TRACKS = ['drums', 'bass', 'rhythm', 'lead', 'vox'];
/** the strip settings of an object (a lane's mix entry, a take, a stem), filled in with zeros */
function fxOf(o) { if (!o.fx || typeof o.fx !== 'object') o.fx = {}; FX_KEYS.forEach(k => { const v = +o.fx[k]; o.fx[k] = isFinite(v) ? v : 0; }); return o.fx; }
const fxOn = f => !!f && FX_KEYS.some(k => +f[k]);

function fxImpulse(c, sec, decay) {
  let s = 20260101; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate), pre = Math.floor(c.sampleRate * .012);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) { const t = i / n; d[i] = rnd() * Math.pow(1 - t, decay) * (i < pre ? i / pre : 1); } }
  return b;
}
/** the shared returns: one reverb and one delay for the whole mix */
function fxBuses() {
  if (E.fxB && E.fxB.ctx === E.ctx) return E.fxB; const c = E.ctx;
  const rIn = gn(1), rHp = bq('highpass', 170), cv = c.createConvolver(), rLp = bq('lowpass', 6500), rOut = gn(.85); cv.buffer = fxImpulse(c, 2.1, 3.4); chainN(rIn, rHp, cv, rLp, rOut); rOut.connect(E.mix);
  const dIn = gn(1), dl = c.createDelay(2), fb = gn(.36), dLp = bq('lowpass', 3400), dOut = gn(.8); dIn.connect(dl); dl.connect(dLp); dLp.connect(fb); fb.connect(dl); dLp.connect(dOut); dOut.connect(E.mix);
  E.fxB = { ctx: c, rIn, dIn, dl }; fxTempo(); return E.fxB;
}
/** the delay is a dotted eighth of the song tempo */
function fxTempo() { if (E.fxB && E.ctx) E.fxB.dl.delayTime.setTargetAtTime(clamp(60 / (S.bpm || 90) * .75, .05, 1.9), E.ctx.currentTime, .05); }
bus.on('bpm', fxTempo); bus.on('song', fxTempo);

function fxStrip(dest, o = {}) {
  const c = E.ctx, B = fxBuses(), inN = gn(1), lo = bq('lowshelf', 110, .7), mid = bq('peaking', 1200, .8), hi = bq('highshelf', 7000, .7), cmp = c.createDynamicsCompressor();
  const mk = gn(1), cP = gn(0), cB = gn(1), sum = gn(1), out = gn(1), sR = gn(0), sD = gn(0); cmp.knee.value = 10; cmp.attack.value = .012; cmp.release.value = .2;
  chainN(inN, lo, mid, hi); hi.connect(cB); cB.connect(sum); hi.connect(cmp); cmp.connect(mk); mk.connect(cP); cP.connect(sum);
  let pn = null; if (o.pan) { pn = c.createStereoPanner(); sum.connect(pn); pn.connect(out); } else sum.connect(out);
  out.connect(dest); out.connect(sR); sR.connect(B.rIn); out.connect(sD); sD.connect(B.dIn);
  return {
    in: inN, out,
    set(f) {
      f = f || FX_DEF; tc(lo.gain, +f.lo || 0, .02); tc(mid.gain, +f.mid || 0, .02); tc(hi.gain, +f.hi || 0, .02);
      const a = clamp(+f.comp || 0, 0, 1); tc(cmp.threshold, -10 - 26 * a, .02); cmp.ratio.value = 2 + 6 * a; tc(mk.gain, 1 + .9 * a, .02); tc(cP.gain, a > 0 ? 1 : 0, .02); tc(cB.gain, a > 0 ? 0 : 1, .02);
      tc(sR.gain, clamp(+f.rev || 0, 0, 1) * .9, .02); tc(sD.gain, clamp(+f.dly || 0, 0, 1) * .8, .02);
    },
    pan(v) { if (pn) tc(pn.pan, clamp(+v || 0, -1, 1), .02); },
    dispose() { try { out.disconnect(); } catch (e) { } }
  };
}
/** apply every strip that exists (band lanes, the backing track and its stems) */
function fxApplyAll() {
  if (!E.ready && !E.tr.drums) return;
  Object.keys(E.tr).forEach(id => { const t = E.tr[id]; if (t.fx) t.fx.set(S.mix[id] && S.mix[id].fx); });
  if (typeof spFx === 'function') spFx();
}

/* ---------- the "+Fx" chip and its strip panel ---------- */
let fxSaveT = 0;
const fxPersist = () => { clearTimeout(fxSaveT); fxSaveT = setTimeout(() => { try { commit(false); } catch (e) { } }, 500); };
/** getO() → the object that owns the settings (mix entry / take / STM); apply() pushes them to the audio; persist? saves the song */
function fxChip(getO, apply, name, persist) {
  const b = h('button', { class: 'fxchip' + (fxOn(getO().fx) ? ' on' : ''), title: 'Effects for this lane: EQ, compressor, reverb and delay', 'aria-haspopup': 'dialog', 'aria-label': 'Effects for ' + name, onclick: e => { e.stopPropagation(); fxPanel(e.currentTarget, getO, apply, name, persist, () => { b.classList.toggle('on', fxOn(getO().fx)); b.textContent = fxOn(getO().fx) ? 'Fx' : '+Fx'; }); } }, fxOn(getO().fx) ? 'Fx' : '+Fx');
  return b;
}
function fxPanel(anchor, getO, apply, name, persist, done) {
  const o = getO(), f = fxOf(o), knobs = {}, set = () => { apply(); if (persist) fxPersist(); done && done(); };
  const K = (k, label, min, max, step, unit, fmt) => { const kn = mkKnob({ label, min, max, def: 0, step, unit, fmt, onChange: v => { fxOf(getO())[k] = v; set(); } }); kn.set(f[k], true); knobs[k] = kn; return kn.el; };
  const box = h('div', { class: 'fxp' }, h('h5', {}, name + ' · effects'),
    h('div', { class: 'fxpre', role: 'group', 'aria-label': 'Quick looks' }, FX_PRE.map(([n, p]) => h('button', { class: 'btn sm', title: 'Start from “' + n + '”', onclick: () => { const x = fxOf(getO()); FX_KEYS.forEach(k => { x[k] = p[k] || 0; knobs[k].set(x[k], true); }); set(); } }, n))),
    h('div', { class: 'fxgrid' }, K('lo', 'Low', -12, 12, .5, ' dB'), K('mid', 'Mid', -12, 12, .5, ' dB'), K('hi', 'High', -12, 12, .5, ' dB'), K('comp', 'Squeeze', 0, 1, .01, '', v => Math.round(v * 100) + '%'), K('rev', 'Reverb', 0, 1, .01, '', v => Math.round(v * 100) + '%'), K('dly', 'Echo', 0, 1, .01, '', v => Math.round(v * 100) + '%')),
    h('div', { class: 'tiny muted', style: { marginTop: '8px' } }, 'Reverb is one shared room; echo is a dotted eighth of the song tempo. Double-click a knob to zero it.'),
    h('div', { class: 'row', style: { gap: '6px', marginTop: '6px' } }, h('button', { class: 'btn sm', onclick: () => { const x = fxOf(getO()); FX_KEYS.forEach(k => { x[k] = 0; knobs[k].set(0, true); }); set(); } }, 'Reset'), h('button', { class: 'btn sm primary', onclick: () => closePop() }, 'Done')));
  return popover(anchor, box, { style: { width: '292px' } });
}
/** pan for lanes that did not have one (stems, vocal) */
const fxPan = (get, set) => h('input', { type: 'range', min: -1, max: 1, step: .05, value: get(), title: 'Pan (double-click: centre)', 'aria-label': 'Pan', style: { width: '40px', flex: 'none' }, oninput: e => set(+e.target.value), ondblclick: e => { e.target.value = 0; set(0); } });

/* ---------- master chip: level with a dB readout, and a mastering preset ---------- */
const MST_PRE = [
  ['off', 'Off', 'As played, no loudness target', { lo: 0, hi: 0, comp: 0, tgt: 0 }],
  ['clean', 'Clean', 'Transparent, a touch of glue · −14 LUFS', { lo: 0, hi: 0, comp: .25, tgt: -14 }],
  ['warm', 'Warm', 'Softer top, fuller low end · −14 LUFS', { lo: 1.8, hi: -2, comp: .35, tgt: -14 }],
  ['bright', 'Bright', 'Open top end · −14 LUFS', { lo: -.5, hi: 2.5, comp: .3, tgt: -14 }],
  ['loud', 'Loud', 'Tight and dense · −10 LUFS', { lo: 1, hi: 1.5, comp: .7, tgt: -10 }]];
function mstBuild() {
  if (E.mst && E.mst.ctx === E.ctx) return E.mst; const c = E.ctx, lo = bq('lowshelf', 120, .7), hi = bq('highshelf', 6500, .7), cmp = c.createDynamicsCompressor(), mk = gn(1), cP = gn(0), cB = gn(1), sum = gn(1), inN = gn(1);
  cmp.knee.value = 12; cmp.attack.value = .02; cmp.release.value = .25; chainN(inN, lo, hi); hi.connect(cB); cB.connect(sum); hi.connect(cmp); cmp.connect(mk); mk.connect(cP); cP.connect(sum);
  return (E.mst = { ctx: c, in: inN, out: sum, lo, hi, cmp, mk, cP, cB });
}
function mstApply() {
  if (!E.mst) return; const p = (MST_PRE.find(x => x[0] === (CFG.mstPre || 'off')) || MST_PRE[0])[3], m = E.mst, a = p.comp;
  tc(m.lo.gain, p.lo, .03); tc(m.hi.gain, p.hi, .03); tc(m.cmp.threshold, -8 - 14 * a, .03); m.cmp.ratio.value = 1.6 + 2.4 * a; tc(m.mk.gain, 1 + .5 * a, .03); tc(m.cP.gain, a > 0 ? 1 : 0, .03); tc(m.cB.gain, a > 0 ? 0 : 1, .03);
}
function mstSet(id) {
  const p = MST_PRE.find(x => x[0] === id) || MST_PRE[0]; CFG.mstPre = p[0]; CFG.lufsTarget = p[3].tgt; saveCfg(); mstApply(); bus.emit('master'); toast('Master: ' + p[1] + (p[3].tgt ? ' · exports aim for ' + p[3].tgt + ' LUFS' : ''), 'ok');
}
function mstChip() {
  const dbT = h('span', { class: 'mono mst-db' }, '0.0 dB'), led = h('i', { class: 'led', title: 'Master clip light (click to clear)', onclick: e => { e.target.className = 'led'; } });
  const sl = h('input', { type: 'range', min: 0, max: 1.2, step: .01, value: .9, class: 'mst-sl', 'aria-label': 'Master level', title: 'Master level (the same control as the Master knob in the Rig tab)', oninput: e => { const k = KNOBS.get('master'); if (k) k.set(+e.target.value); else if (E.ready) tc(E.master.gain, +e.target.value, .02); show(); } });
  const preBtn = h('button', { class: 'btn sm mst-pre', 'aria-haspopup': 'menu', title: 'Mastering preset: tone, glue and a loudness target for exports', onclick: e => mstMenu(e.currentTarget) });
  const show = () => { const k = KNOBS.get('master'), v = k ? k.get() : .9; sl.value = v; dbT.textContent = (v <= .001 ? '−∞' : dB(v).toFixed(1)) + ' dB'; const p = MST_PRE.find(x => x[0] === (CFG.mstPre || 'off')) || MST_PRE[0]; preBtn.textContent = ''; preBtn.append('🎚', h('span', { class: 'mst-lab' }, ' ' + (p[0] === 'off' ? 'Master' : p[1])), ' ▾'); };
  bus.on('master', show); bus.on('song', show); show(); let clipAt = 0;
  setInterval(() => { if (!E.ready || document.hidden) return; const k = KNOBS.get('master'); if (k && Math.abs(+sl.value - k.get()) > .004) show(); const L = typeof ioLevels === 'function' ? ioLevels() : null; if (L && L.master >= -1.2) clipAt = performance.now(); led.className = 'led' + (performance.now() - clipAt < 1500 ? ' bad' : ''); }, 250);
  return h('div', { class: 'mst-chip', role: 'group', 'aria-label': 'Master' }, preBtn, sl, dbT, led);
}
function mstMenu(anchor) {
  const cur = CFG.mstPre || 'off', box = h('div', { class: 'mstm', role: 'menu' }, h('h5', {}, 'Mastering preset'),
    MST_PRE.map(([id, name, desc]) => h('button', { class: 'mst-opt' + (id === cur ? ' on' : ''), role: 'menuitemradio', 'aria-checked': id === cur ? 'true' : 'false', onclick: () => { closePop(); mstSet(id); } }, h('b', {}, name), h('span', { class: 'tiny muted' }, desc))),
    h('button', { class: 'btn sm', id: 'mstBal', style: { marginTop: '8px', width: '100%' }, title: 'Measure your recordings and set every lane’s level and pan so they sit together', onclick: () => { closePop(); autoBalance(); } }, '⚖ Auto-balance the lanes…'),
    h('div', { class: 'tiny muted', style: { marginTop: '6px' } }, 'Applies to everything you hear and export. The loudness target is used when you save a song as audio.'));
  popover(anchor, box, { style: { width: '270px' }, right: true });
}
