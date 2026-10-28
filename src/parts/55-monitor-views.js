/* ============================================================
   Part 55 · Monitor views — the instrument readouts, moved off the show
   The pitch wheel (chroma), a scrolling spectrogram and the oscilloscope are for looking at your sound, not for projecting it, so they live on the
   Monitor tab under the tuner. They are still available as Stage scenes.
   ============================================================ */
const MV = { mode: 'chroma', cv: null, spec: null, fd: null, btns: [] };
function monitorViewsCard() {
  const modes = [['chroma', 'Pitch wheel'], ['spectro', 'Spectrogram'], ['scope', 'Scope']];
  MV.cv = h('canvas', { class: 'vcanvas', id: 'mvCanvas', height: 150, style: { height: '150px', width: '100%' }, role: 'img', 'aria-label': 'Sound readout' });
  const seg = h('div', { class: 'seg', style: { marginBottom: '6px' } }, modes.map(([k, n]) => h('button', { class: k === MV.mode ? 'on' : '', 'data-mv': k, onclick: e => { MV.mode = k; MV.spec = null; seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }, n)));
  return h('div', { class: 'card', id: 'mvCard' }, h('h4', {}, 'Views'), h('div', { class: 'card-b', style: { padding: '6px' } }, seg, MV.cv));
}
function drawMonView() {
  const cv = MV.cv; if (!cv || !E.ready || !cv.clientWidth || !cv.isConnected) return; const d = window.devicePixelRatio || 1, w = cv.clientWidth, hh = 150;
  if (cv.width !== Math.floor(w * d) || cv.height !== Math.floor(hh * d)) { cv.width = Math.floor(w * d); cv.height = Math.floor(hh * d); MV.spec = null; }
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, C = vcol(); g.globalAlpha = 1; g.textAlign = 'left';
  if (MV.mode === 'chroma') { g.fillStyle = '#050b0c'; g.fillRect(0, 0, W, H); drawChroma(g, W, H, C); }
  else if (MV.mode === 'scope') { if (!E.anaDI) return; g.fillStyle = '#050b0c'; g.fillRect(0, 0, W, H); drawScope(g, W, H, C); g.shadowBlur = 0; }
  else {
    const an = visAna(); if (!an) return; if (!MV.fd || MV.fd.length !== an.frequencyBinCount) MV.fd = new Float32Array(an.frequencyBinCount); an.getFloatFrequencyData(MV.fd); const fd = MV.fd, bh = E.ctx.sampleRate / an.fftSize;
    if (!MV.spec || MV.spec.width !== W || MV.spec.height !== H) { MV.spec = document.createElement('canvas'); MV.spec.width = W; MV.spec.height = H; const q = MV.spec.getContext('2d'); q.fillStyle = '#050b0c'; q.fillRect(0, 0, W, H); }
    const q = MV.spec.getContext('2d'), sp = Math.max(1, Math.round(2 * d)), fmin = 60, fmax = 9000, lr = Math.log(fmax / fmin); q.drawImage(MV.spec, -sp, 0);
    for (let y = 0; y < H; y++) { const f = fmin * Math.exp(lr * (1 - y / H)), k = clamp(Math.round(f / bh), 1, fd.length - 1), v = clamp((fd[k] + 88) / 62, 0, 1); q.fillStyle = v < .04 ? '#050b0c' : mixc('#12303a', v > .6 ? C.b : C.a, clamp(v * 1.2, 0, 1), clamp(.25 + v * .9, 0, 1)); q.fillRect(W - sp, y, sp, 1); }
    g.drawImage(MV.spec, 0, 0); g.fillStyle = 'rgba(255,255,255,.5)'; g.font = `${Math.round(9 * d)}px ui-monospace,monospace`; [110, 440, 1760, 7040].forEach(f => { const y = (1 - Math.log(f / fmin) / lr) * H; g.fillText(f >= 1000 ? f / 1000 + 'k' : String(f), 3, y - 2); });
  }
}
