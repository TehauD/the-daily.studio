/* ---------- camera look: dimmed backdrop · edges in · me in front (person cut-out) ----------
   'over'   the camera is a dim layer under the visuals (the original look)
   'edges'  the camera shows clearly in a soft oval in the middle; the visuals live around it
   'person' a green-screen cut-out: the visuals sit behind you. Uses MediaPipe's selfie segmenter, fetched only when this look is chosen
            and the person has said yes to the one-time download (mpConsent; same hosts as hand tracking). If the model cannot load, the edges look is used instead. */
const CAMFX = [['over', 'Dimmed behind the visuals'], ['edges', 'Visuals frame me (edges in)'], ['person', 'Me in front (green screen)']];
const CF = { state: 'idle', seg: null, mask: null, acc: null, inv: null, t: 0, busy: false, fg: null, ed: null, mc: null, errN: 0 };
let mpCache = null;
/** The one place this page can reach another site, and only after a yes. Until then: no request to jsDelivr or Google, nothing at all.
    A yes is remembered (CFG.mpOk). A no lasts until the feature is asked for again (Camera look, or the hand-tracking choice). */
const MPC = { p: null };
function mpConsent() {
  if (CFG.mpOk === true) return Promise.resolve(true);
  if (MPC.p) return MPC.p;
  const box = $('#toasts'); if (!box) return Promise.resolve(false);
  return MPC.p = new Promise(res => {
    const done = v => { MPC.p = null; card.remove(); if (v) { CFG.mpOk = true; saveCfg(); } res(v); };
    const card = h('div', { class: 'toast warn keep-toast mp-ask', id: 'mpAsk', role: 'alertdialog', 'aria-label': 'One-time download' },
      h('span', {}, h('b', {}, 'One-time download. '), 'This uses MediaPipe, Google’s open-source vision library. Your browser fetches its code (cdn.jsdelivr.net) and a small model (storage.googleapis.com), about 10 MB. Those two sites see your IP address, as with any web page. Your camera picture is never sent anywhere.'),
      h('button', { class: 'btn sm primary', id: 'mpAskYes', onclick: () => done(true) }, 'Download and turn it on'),
      h('button', { class: 'btn sm', id: 'mpAskNo', onclick: () => done(false) }, 'Not now, stay offline'));
    box.append(card);
  });
}
function mpVision() {
  return mpCache || (mpCache = mpConsent().then(ok => { if (!ok) throw Object.assign(new Error('declined'), { declined: true }); return import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'); })
    .then(async mod => ({ mod, fs: await mod.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm') }))
    .catch(e => { mpCache = null; throw e; }));
}
function camBox(W, H) { const v = CAM.video, vr = v.videoWidth / v.videoHeight, cr = W / H; let dw = W, dh = H, dx = 0, dy = 0; if (vr > cr) { dw = H * vr; dx = (W - dw) / 2; } else { dh = W / vr; dy = (H - dh) / 2; } return { dx, dy, dw, dh }; }
function camPaint(g, W, H, src) { const b = camBox(W, H); g.save(); if (CFG.mirror) { g.translate(W, 0); g.scale(-1, 1); } g.drawImage(src, b.dx, b.dy, b.dw, b.dh); g.restore(); }
/** draw the camera on top of the finished visuals, per the chosen look */
function camTop(g, W, H) {
  const v = CAM.video, fx = CFG.camFx || 'over'; if (!v || v.readyState < 2 || fx === 'over') return;
  if (fx === 'person' && CF.state === 'ready' && CF.mask) {
    const fc = CF.fg || (CF.fg = document.createElement('canvas')); if (fc.width !== W || fc.height !== H) { fc.width = W; fc.height = H; }
    const f = fc.getContext('2d'); f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, W, H);
    try { f.filter = 'blur(' + Math.max(1, Math.round(W / 800)) + 'px)'; } catch (e) { }
    camPaint(f, W, H, CF.mask); try { f.filter = 'none'; } catch (e) { }
    f.globalCompositeOperation = 'source-in'; camPaint(f, W, H, v); g.drawImage(fc, 0, 0); return;
  }
  const ec = CF.ed || (CF.ed = document.createElement('canvas')); if (ec.width !== W || ec.height !== H) { ec.width = W; ec.height = H; }
  const e = ec.getContext('2d'); e.globalCompositeOperation = 'source-over'; e.clearRect(0, 0, W, H); camPaint(e, W, H, v);
  const r = clamp(CFG.camClear == null ? .55 : CFG.camClear, .2, .95); e.globalCompositeOperation = 'destination-in'; e.save(); e.translate(W / 2, H / 2); e.scale(W / 2 * r, H / 2 * Math.min(1, r * 1.12));
  const gr = e.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.58, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); e.fillStyle = gr; e.fillRect(-1, -1, 2, 2); e.restore();
  g.save(); g.globalAlpha = .97; g.drawImage(ec, 0, 0); g.restore();
}
/** feed one segmentation mask (floats 0..1, w×h): works out which way round it is, smooths it, and keeps it as an alpha canvas */
function cfFeed(a, w, hh) {
  const sw = Math.min(w, 256), sh = Math.max(1, Math.round(sw * hh / w)), n = sw * sh; if (!CF.acc || CF.acc.length !== n) { CF.acc = new Float32Array(n).fill(-1); CF.mc = null; }
  const raw = new Float32Array(n); let cs = 0, cn = 0, es = 0, en = 0;
  for (let y = 0; y < sh; y++) { const sy = Math.min(hh - 1, Math.floor(y * hh / sh)) * w, fy = y / sh; for (let x = 0; x < sw; x++) {
    const v = a[sy + Math.min(w - 1, Math.floor(x * w / sw))]; raw[y * sw + x] = v; const fx = x / sw;
    if (fx > .35 && fx < .65 && fy > .3 && fy < .8) { cs += v; cn++; } else if (fx < .12 || fx > .88) { es += v; en++; } } }
  const d = cs / Math.max(1, cn) - es / Math.max(1, en);   // a person normally fills the middle and the room fills the sides
  if (Math.abs(d) > .3) CF.inv = d < 0;
  const inv = !!CF.inv, mc = CF.mc || (CF.mc = Object.assign(document.createElement('canvas'), { width: sw, height: sh })), mg = mc.getContext('2d'), im = mg.createImageData(sw, sh), D = im.data;
  for (let i = 0; i < n; i++) {
    let v = inv ? 1 - raw[i] : raw[i]; v = clamp((v - .3) / .4, 0, 1); v = v * v * (3 - 2 * v); const o = CF.acc[i] < 0 ? v : CF.acc[i] * .45 + v * .55; CF.acc[i] = o;
    D[i * 4] = D[i * 4 + 1] = D[i * 4 + 2] = 255; D[i * 4 + 3] = Math.round(o * 255);
  }
  mg.putImageData(im, 0, 0); CF.mask = mc;
}
async function cfSegInit() {
  if (CF.state !== 'idle') return; CF.state = 'loading'; if (UI.camInfo) UI.camInfo.textContent += ' · loading cut-out…';
  try {
    const { mod, fs } = await mpVision(), base = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
    const opt = d => ({ baseOptions: { modelAssetPath: base, delegate: d }, runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false });
    try { CF.seg = await mod.ImageSegmenter.createFromOptions(fs, opt('GPU')); } catch (e) { CF.seg = await mod.ImageSegmenter.createFromOptions(fs, opt('CPU')); }
    CF.state = 'ready'; CF.errN = 0; toast('Person cut-out ready', 'ok');
  } catch (e) { CF.state = 'failed'; if (e && e.declined) toast('Staying offline: the edges-in look is used instead', 'ok'); else { console.warn('segmenter unavailable', e); toast('The person cut-out model could not load (offline or blocked), so the edges-in look is used instead', 'warn'); } if (UI.camInfo) UI.camInfo.textContent = UI.camInfo.textContent.replace(' · loading cut-out…', ''); }
}
function cfWanted() { if ((CFG.camFx || 'over') !== 'person' || !CAM.on) return false; let st = false; try { st = !!(typeof scn === 'function' && scn() && scn().cam); } catch (e) { } return !!VZ.cam || st; }
function cfTick(ts) {
  if (!cfWanted()) return; if (CF.state === 'idle') { cfSegInit(); return; }
  if (CF.state !== 'ready' || CF.busy || ts - CF.t < (CFG.vq >= 1 ? 45 : 90)) return; CF.t = ts; CF.busy = true;
  try { CF.seg.segmentForVideo(CAM.video, performance.now(), r => { try { const ms = r && r.confidenceMasks; if (ms && ms.length) { const m = ms.length > 1 ? ms[1] : ms[0]; cfFeed(m.getAsFloat32Array(), m.width, m.height); } } finally { CF.busy = false; } }); }
  catch (e) { CF.busy = false; if (++CF.errN > 5) { CF.state = 'failed'; CF.mask = null; toast('Person cut-out stopped working, so the edges-in look is used instead', 'warn'); } }
}
/** the “Camera look” control, shared by the Visuals tab and Stage */
function camFxBox() {
  const clr = h('input', { type: 'range', min: .25, max: .9, step: .05, value: CFG.camClear == null ? .55 : CFG.camClear, title: 'Size of the clear centre', 'aria-label': 'Size of the clear centre', style: { width: '90px' }, oninput: e => { CFG.camClear = +e.target.value; }, onchange: () => saveCfg() });
  const sync = () => { clr.style.display = (CFG.camFx || 'over') === 'edges' ? '' : 'none'; };
  const sel = h('select', { class: 'in', style: { width: 'auto', fontFamily: 'var(--sans)' }, title: 'How the camera sits with the visuals', 'aria-label': 'Camera look', onchange: e => { CFG.camFx = e.target.value; saveCfg(); if (CF.state === 'failed') CF.state = 'idle'; sync(); } }, CAMFX.map(([v, n]) => h('option', { value: v, selected: (CFG.camFx || 'over') === v }, '📷 ' + n)));
  sync(); return h('span', { class: 'row camfx', style: { gap: '6px' } }, sel, clr);
}
