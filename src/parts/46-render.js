/* ============================================================
   Part 46 · Fast render — the song as audio, faster than it plays
   The same engine that plays the song is built a second time on an OfflineAudioContext, every note, take and backing-track stem is
   scheduled on it, and the browser renders it as fast as the processor allows (a few seconds for a song). What you hear and what you save are
   the same signal path: strips, effects, master tone and limiter. Plucked notes are posted a couple of seconds at a time and each batch is
   confirmed before the clock moves on, so timing stays sample-exact. If the browser cannot do it, Bounce falls back to real time.
   While it runs, the live engine is set aside and put back when it finishes (or when the kill switch is pressed).
   ============================================================ */
const OFR = { busy: false, aborted: false, saved: null, pre: .25, step: 2.5, id: 0 };

function ofrAvailable() { return !!(window.OfflineAudioContext || window.webkitOfflineAudioContext) && !!E.ready && !!E.ctx && !REC && !BOUNCE; }

/** set the live engine aside and put an offline one in its place */
function ofrSwapIn(oc) {
  OFR.saved = {
    E: Object.assign({}, E), units: RIG.units, order: RIG.order.slice(), STP: Object.assign({}, STP), srcs: T.srcs, bars: T.bars, metro: T.metro, loop: T.loop, cursor: T.cursor,
    takes: TAKES.map(t => [t, t._g, t._pn, t._fx])
  };
  const keep = OFR.saved.E; Object.keys(E).forEach(k => { delete E[k]; });
  Object.assign(E, { ctx: oc, worklet: keep.worklet, ready: true, stream: null, inSettings: null, src: null, hasInput: false, tr: {}, devs: keep.devs, recOn: { di: false, wet: false, master: false }, onTap: {} });
  Object.assign(STP, { bus: null, tfx: null, fx: null, sg: [], playing: false, segs: [] }); RIG.units = {}; T.srcs = []; T.bars = null;
  TAKES.forEach(t => { t._g = null; t._pn = null; t._fx = null; });
}
function ofrRestore() {
  const s = OFR.saved; if (!s) return; OFR.saved = null;
  Object.keys(E).forEach(k => { delete E[k]; }); Object.assign(E, s.E); Object.assign(STP, s.STP); RIG.units = s.units; RIG.order = s.order; T.srcs = s.srcs; T.bars = null; T.metro = s.metro; T.loop = s.loop; T.cursor = s.cursor;
  s.takes.forEach(([t, g, p, f]) => { t._g = g; t._pn = p; t._fx = f; });
}
/** stop the render at once (the kill switch calls this) */
function ofrAbort() { if (!OFR.busy) return; OFR.aborted = true; ofrRestore(); OFR.busy = false; bus.emit('render:state', false); try { if (OFR.rej) OFR.rej({ cancelled: true }); } catch (e) { } }

/** wait until every plucked-string voice has the notes that were just posted */
function ofrSync(n) {
  const nodes = Object.values(E.pl || {}).filter(x => x && x.port); if (!nodes.length) return Promise.resolve();
  return Promise.all(nodes.map(nd => new Promise(res => { const to = setTimeout(res, 2000); nd.port.onmessage = e => { if (e.data && e.data.sync === n) { clearTimeout(to); res(); } }; nd.port.postMessage({ t: 'sync', n }); })));
}
/** the backing track's stems for one slice of the song, as buffers that start at the right moment */
function ofrStems(a, b) {
  if (!STM.ch || CFG.trackSync === false) return; const c = E.ctx, sr = STM.sr, t0 = trkT0() + a, t1 = Math.min(STM.dur, trkT0() + b); if (t1 - t0 < .001 || t0 >= STM.dur - .1) return;
  const i0 = Math.floor(t0 * sr), i1 = Math.floor(t1 * sr), len = i1 - i0; if (len < 64) return;
  STMS.forEach((_, si) => { const d = spData(si), buf = c.createBuffer(2, len, sr); for (let ch = 0; ch < 2; ch++) { const o = buf.getChannelData(ch), s = d[ch]; for (let k = 0; k < len; k++) o[k] = s[i0 + k] / 32768; } const src = c.createBufferSource(); src.buffer = buf; src.connect(STP.sg[si]); src.start(OFR.pre + a); });
}

/**
 * Render the song (the same signal as pressing play from the top) and return { l, r, sr, seconds }.
 * opt.tail: seconds after the last bar (default 3.2) · opt.onProgress(0..1) · throws { cancelled: true } when aborted
 */
async function ofrRender(opt) {
  opt = opt || {}; if (OFR.busy) throw new Error('A render is already running'); if (!ofrAvailable()) throw new Error('Fast render is not available in this browser');
  const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, sr = E.ctx.sampleRate, dur = slotDur(), slots = songSlots(), total = slots * dur, tail = opt.tail == null ? 3.2 : opt.tail, pre = OFR.pre;
  const quantum = 128, step = Math.ceil(OFR.step * sr / quantum) * quantum / sr, frames = Math.ceil((pre + total + tail) * sr / quantum) * quantum, nSl = Math.ceil((pre + total + tail) / step);
  const rig = rigSnapshot(), metro = T.metro; if (T.playing) stopPlay(true); try { stopTakes(); } catch (e) { }
  OFR.busy = true; OFR.aborted = false; const rid = ++OFR.id; bus.emit('render:state', true);
  try {
    const oc = new OC(2, frames, sr);
    if (E.worklet) { const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' })); try { await oc.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); } }
    if (OFR.aborted) throw { cancelled: true };
    ofrSwapIn(oc); T.metro = false; T.loop = false; T.cursor = 0;
    buildGraph(); buildBand(); try { rigApply(rig); } catch (e) { console.warn(e); }
    if (STM.ch && CFG.trackSync !== false) { spEnsure(); spGains(); spFx(); spBus(); }
    let nSync = 0; const slotsIn = (a, b) => { const s0 = Math.max(0, Math.ceil((a - pre) / dur - 1e-9)), s1 = Math.min(slots, Math.ceil((b - pre) / dur - 1e-9)); return [s0, s1]; };
    const schedule = j => {
      const a = j * step, b = (j + 1) * step; const [s0, s1] = slotsIn(a, b);
      for (let s = s0; s < s1; s++) scheduleSlot(s, pre + s * dur);
      if (j === 0) scheduleTakes(pre, 0);
      ofrStems(Math.max(0, a - pre), Math.max(0, b - pre));
    };
    const done = new Promise((res, rej) => { OFR.rej = rej; });
    for (let j = 1; j < nSl; j++) oc.suspend(j * step).then(async () => {
      if (OFR.aborted || OFR.id !== rid) return; try { schedule(j); await ofrSync(++nSync); } catch (e) { OFR.aborted = true; return; }
      if (OFR.aborted || OFR.id !== rid) return; if (opt.onProgress) opt.onProgress(j / nSl); oc.resume();
    }).catch(() => { });
    schedule(0); await ofrSync(++nSync);
    const out = await Promise.race([oc.startRendering(), done]); if (OFR.aborted) throw { cancelled: true };
    const skip = Math.round(pre * sr), L = out.getChannelData(0), R = out.numberOfChannels > 1 ? out.getChannelData(1) : L;
    const l = L.slice(skip), r = R.slice(skip); if (opt.onProgress) opt.onProgress(1);
    return { l, r, sr, seconds: total + tail };
  } finally {
    if (!OFR.aborted) { try { stopTakes(); } catch (e) { } }
    ofrRestore(); T.metro = metro; OFR.busy = false; bus.emit('render:state', false);
  }
}

/**
 * Bounce through the fast renderer with a progress window and a Cancel button, then save the WAV like the real-time bounce does.
 * Resolves true (saved), 'cancelled', or false when it could not run, so the caller can fall back to real time.
 */
async function bounceFast(tag) {
  if (!ofrAvailable() || OFR.busy) return false;
  const nm = tag ? String(tag).replace(/_/g, ' ') : 'the whole song';
  const fill = h('i'), bar = h('div', { class: 'rnd-bar', role: 'progressbar', 'aria-label': 'Render progress', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, fill), msg = h('p', { class: 'muted', id: 'rndMsg', role: 'status' }, 'Starting…');
  let closed = false; const t0 = performance.now();
  const d = pdlg('rndDlg', 'Rendering ' + nm, h('div', { class: 'rnd' }, msg, bar, h('div', { class: 'tiny muted' }, 'The song is mixed faster than it plays, with the same strips, effects and limiter. Nothing is uploaded.'),
    h('div', { class: 'row' }, h('span', { class: 'grow' }), h('button', { class: 'btn', id: 'rndCancel', onclick: () => d.close() }, 'Cancel'))), { onclose: () => { closed = true; if (OFR.busy) ofrAbort(); } });
  const prog = x => { const p = Math.round(clamp(x, 0, 1) * 100); fill.style.width = p + '%'; bar.setAttribute('aria-valuenow', String(p)); msg.textContent = p >= 100 ? 'Finishing…' : 'Rendering… ' + p + '%'; };
  try {
    if (T.playing) stopPlay(true);
    const out = await ofrRender({ onProgress: prog });
    if (closed) return 'cancelled';
    const { l, r, sr } = out, note = tag ? '' : (typeof loudAfterBounce === 'function' ? loudAfterBounce(l, r, sr) : '');
    download((S.title || 'song').replace(/\W+/g, '_') + '_' + (tag || 'master') + '.wav', encodeWav([l, r], sr, 24));
    const secs = (performance.now() - t0) / 1000; toast((tag ? 'Saved ' + tag : 'Master bounce saved' + note) + ' · rendered in ' + secs.toFixed(1) + ' s', 'ok');
    closed = true; try { d.close(); } catch (e) { } return true;
  } catch (e) {
    closed = true; try { d.close(); } catch (x) { }
    if (e && e.cancelled) { toast('Render cancelled', 'ok'); return 'cancelled'; }
    console.warn('fast render failed', e); return false;
  }
}
