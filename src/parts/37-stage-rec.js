/* ============================================================
   Part 37 · RECORD THE STAGE
   A video of what the Visuals canvas shows (hexagons, Halo ring, you in front when the camera is on) with the song's
   sound (the master output, so live guitar is in it when monitoring is on). Made with the browser's own recorder and saved
   to this device as .webm or .mp4. Nothing is uploaded; the camera is never started by recording; Ctrl/Cmd+. discards it.
   SHAPE (2.19): Wide 16:9 (1920 × 1080, for YouTube, a website or a TV), Vertical 9:16 (1080 × 1920, for Reels, TikTok and Shorts), or as
   on screen. The video is drawn for its own frame, not copied from the screen: the look, your colours, the camera (cropped to fill, so you
   stay in the middle of a vertical video), the tip jar and, if you like, the words and the chord in large type at the bottom. The Visuals
   show a preview of it while it records, and it keeps going if you switch to another panel.
   ============================================================ */
const SREC = { on: false, mr: null, chunks: [], t0: 0, tick: 0, watch: 0, dest: null, stream: null, mime: '', whole: false, save: true, was: null, name: '', cv: null, cvEl: null, fmt: 'wide', words: false };
/* the shapes a video can have: width, height (0: the Visuals' own), the label, what it is for */
const SREC_FMTS = { wide: [1920, 1080, '▭ Wide 16:9', 'YouTube, a website or a TV'], tall: [1080, 1920, '▯ Vertical 9:16', 'Reels, TikTok and Shorts'], screen: [0, 0, '▢ As on screen', 'the shape the Visuals have on this screen'] };
const srecFmt = () => SREC_FMTS[CFG.recFmt] ? CFG.recFmt : 'wide';
/** quality (2.19.1): 1080p, or 720p, which a phone can draw and encode without dropping frames. Auto is 720p on phones and tablets */
const SREC_QS = [['auto', 'Auto'], ['1080', '1080p'], ['720', '720p']];
const srecQ = () => CFG.recQ === '1080' ? 1080 : CFG.recQ === '720' ? 720 : (document.body.dataset.form === 'phone' || document.body.dataset.form === 'tablet' ? 720 : 1080);
/** the size a shape records at, with the quality applied */
const srecSize = f => { const d = SREC_FMTS[f]; if (!d || !d[0]) return null; const k = srecQ() === 720 ? 2 / 3 : 1; return [Math.round(d[0] * k), Math.round(d[1] * k)]; };
/** the words and the chord on the video: on by default for vertical (a phone video is watched with the sound low), off for the others */
const srecWordsOn = f => { const w = CFG.recWords || {}; return w[f] != null ? !!w[f] : f === 'tall'; };
function srecWordsSet(f, on) { CFG.recWords = Object.assign({}, CFG.recWords || {}, { [f]: !!on }); saveCfg(); }
/** the canvas the video is drawn on: off the page, at the video's own size (even numbers, as video encoders want) */
function srecCanvas(f) {
  let W, H; if (f === 'screen') { const v = UI.vcv; W = (v && v.width) || 1280; H = (v && v.height) || 720; } else [W, H] = srecSize(f);
  W = Math.max(2, W - W % 2); H = Math.max(2, H - H % 2);
  const cv = SREC.cvEl || (SREC.cvEl = h('canvas', { id: 'srecCanvas', 'aria-hidden': 'true', style: { position: 'fixed', left: '-99999px', top: '0', width: '4px', height: '4px', pointerEvents: 'none' } }));
  cv.width = W; cv.height = H; if (!cv.isConnected) document.body.append(cv); return cv;
}
/** where the words go, so the tip jar can step around them */
const srecWordsRect = (W, H) => { const tall = H > W; return [0, H * (tall ? .62 : .64), W, H * (tall ? .38 : .36)]; };
/** one frame of the video (called by the frame loop while a video records): the visuals at the video's size, the words, and a preview on the Visuals */
function srecFrame() {
  const cv = SREC.cv; if (!cv) return;
  /* how steady the frames are: a gap of more than 50 ms (under 20 a second) while the tab is in front is a late frame */
  const now = performance.now(), F = SREC.fr; if (F && SREC.on && !document.hidden) { if (F.last) { F.n++; if (now - F.last > 50) F.late++; } F.last = now; } else if (F) F.last = 0; const W = cv.width, H = cv.height, g = cv.getContext('2d'), words = SREC.words;
  try { drawVis(cv, { main: true, noNeck: words, noText: words, avoid: words ? [srecWordsRect(W, H)] : null }); if (words) srecWords(g, W, H); }
  catch (e) { if (!SREC.err) { SREC.err = 1; console.warn('video frame', e); } }
  const v = UI.vcv; if (v && v.width && paneVisible('vis')) {
    const vg = v.getContext('2d'), k = Math.min(v.width / W, v.height / H), dw = Math.round(W * k), dh = Math.round(H * k);
    vg.fillStyle = '#000'; vg.fillRect(0, 0, v.width, v.height); vg.drawImage(cv, (v.width - dw) >> 1, (v.height - dh) >> 1, dw, dh);
  }
}
/** the words being sung (with their chords over them) and the chord, large, over a soft shade at the bottom; the next line under them, dimmer */
function srecWords(g, W, H) {
  const info = stageInfo(), tall = H > W, u = tall ? W : Math.min(W, H * 1.6), mono = 'ui-monospace,Menlo,Consolas,monospace';
  const ly = info.ly && (info.ly.text || info.ly.chords.length) ? info.ly : null, lyCh = !!(ly && ly.chords.length);
  if (!ly && !info.sym) return;
  const top = H * (tall ? .6 : .62), sh = g.createLinearGradient(0, top, 0, H); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(.45, 'rgba(0,0,0,.42)'); sh.addColorStop(1, 'rgba(0,0,0,.72)');
  g.save(); g.fillStyle = sh; g.fillRect(0, top, W, H - top); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = u * .015; g.textBaseline = 'alphabetic';
  if (!lyCh && info.sym) {
    const sz = u * (tall ? .17 : .1), y = H * (ly ? (tall ? .77 : .79) : (tall ? .86 : .88)); g.font = `800 ${Math.round(sz)}px ${mono}`; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(info.sym, W / 2, y);
    if (info.next && info.playing) { g.font = `700 ${Math.round(sz * .3)}px ${mono}`; g.fillStyle = 'rgba(255,255,255,.72)'; g.fillText('next  ' + info.next, W / 2, y + sz * .42); }
  }
  if (ly) {
    const px = Math.round(u * (tall ? .062 : .042)), y = H * (tall ? .87 : .885);
    lyDraw(g, { x: W / 2, y, w: W * .9, px, font: mono, ly, hi: '#ffd23f' });
    if (info.lyN && (info.lyN.text || info.lyN.chords.length)) lyDraw(g, { x: W / 2, y: y + px * .6 + Math.round(px * .62) * (info.lyN.chords.length ? 2.1 : 1.2), w: W * .9, px: Math.round(px * .62), weight: 600, font: mono, ly: info.lyN, dim: true });
  }
  g.restore(); g.textAlign = 'left';
}
/** the choice of shape and words, for the Record menu and Creator Studio */
function srecFmtBox() {
  const f = srecFmt(), words = h('input', { type: 'checkbox', id: 'srecWords', checked: srecWordsOn(f), onchange: e => srecWordsSet(srecFmt(), e.target.checked) });
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Video shape', id: 'srecFmt' }, Object.entries(SREC_FMTS).map(([k, d]) => h('button', { type: 'button', role: 'radio', class: k === f ? 'on' : '', 'aria-checked': String(k === f), 'data-fmt': k, title: d[3] + (d[0] ? ' · ' + d[0] + ' × ' + d[1] : ''), onclick: e => {
    CFG.recFmt = k; saveCfg(); $$('[data-fmt]', seg).forEach(b => { const on = b === e.currentTarget; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); words.checked = srecWordsOn(k); hint.textContent = sizeTxt(k); if (typeof goalSync === 'function') goalSync(); } }, d[2])));
  const hint = h('div', { class: 'tiny muted', id: 'srecHint' }), sizeTxt = k => { const z = srecSize(k); return SREC_FMTS[k][3] + (z ? ' · ' + z[0] + ' × ' + z[1] : ''); }; hint.textContent = sizeTxt(f);
  const qs = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Video quality', id: 'srecQ' }, SREC_QS.map(([k, t]) => h('button', { type: 'button', role: 'radio', class: (CFG.recQ || 'auto') === k ? 'on' : '', 'aria-checked': String((CFG.recQ || 'auto') === k), 'data-q': k, title: k === 'auto' ? 'Auto: ' + srecQ() + 'p on this device (720p on phones and tablets)' : k === '720' ? '720p: smoother on phones' : '1080p: the sharpest', onclick: e => { CFG.recQ = k; saveCfg(); $$('[data-q]', qs).forEach(b => { const on = b === e.currentTarget; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); hint.textContent = sizeTxt(srecFmt()); } }, t)));
  return h('div', { style: { display: 'grid', gap: '6px' } }, seg, h('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, h('span', { class: 'tiny muted' }, 'Quality'), qs), hint, h('label', { class: 'row', style: { gap: '6px', alignItems: 'center' }, title: 'The line being sung, with its chords over the words, and the chord, in large type at the bottom of the video' }, words, h('span', { class: 'tiny' }, 'Words and chord on the video')));
}
/** mp4: put MP4 first for a video (social sites take it as it is); otherwise WebM first, as before */
function srecMime(audio, mp4) {
  if (!window.MediaRecorder) return null;
  const wv = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'], mv = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4'];
  const c = audio ? ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'] : mp4 ? mv.concat(wv) : wv.concat(mv);
  return c.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || '';
}
const srecClock = () => { const s = Math.floor((performance.now() - SREC.t0) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function srecSync() {
  $$('[data-srec]').forEach(b => { b.classList.toggle('bad', SREC.on); b.classList.toggle('srec-on', SREC.on); const l = b.querySelector('.lbl'); const t = SREC.on ? '■ ' + srecClock() : '⏺ Record'; if (l) l.textContent = ' ' + t.replace(/^⏺ /, ''); else b.textContent = t; b.setAttribute('aria-pressed', String(SREC.on)); b.title = SREC.on ? 'Stop and save the video to this device' : 'Record the stage as a video with the song’s sound (saved on this device)'; });
}
function srecMenu(anchor) {
  if (SREC.on) return srecStop(true);
  const box = h('div', { style: { minWidth: '250px', display: 'grid', gap: '6px' } }, h('h5', {}, 'Record the stage'), srecFmtBox(),
    h('button', { class: 'btn', id: 'srecNow', onclick: () => { closePop(); srecStart(false); } }, '⏺ Record now'),
    h('button', { class: 'btn', id: 'srecWhole', onclick: () => { closePop(); srecStart(true); } }, '⏺ The whole song, from the top'),
    E.hasInput ? h('label', { class: 'row', style: { gap: '6px', alignItems: 'flex-start' }, title: 'The armed guitar and voice inputs are recorded as a lane in the arrangement, starting where the video starts' }, h('input', { type: 'checkbox', id: 'srecTake', checked: CFG.srecTake !== false, onchange: e => { CFG.srecTake = e.target.checked; saveCfg(); } }), h('span', { class: 'tiny' }, 'Also put what I play into the arrangement (a new lane, starting where the video starts)')) : h('div', { class: 'tiny muted' }, 'Connect your guitar or microphone (Inputs) and your playing can land in the arrangement as well.'),
    h('div', { class: 'tiny muted' }, 'Saved on this device as a video with sound. The camera is only in it if you already turned it on. Keep this tab in front while recording.'));
  popover(anchor, box);
}
/** o.audio: sound only (compressed audio, share page); o.mp4: prefer MP4 video; o.onBlob(blob): hand the result on instead of saving it */
async function srecStart(whole, o) {
  if (SREC.on) return; o = o || {}; const audio = !!o.audio;
  const cvOk = audio || (typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype.captureStream), mime = srecMime(audio, !!o.mp4);
  if (!cvOk || mime === null) return toast(audio ? 'This browser cannot record audio here. Try a recent Chrome, Edge, Firefox or Safari.' : 'This browser cannot record video here. Try a recent Chrome, Edge, Firefox or Safari.', 'warn');
  if (typeof AK !== 'undefined' && AK.killed) return toast('Audio is stopped. Open Audio to resume, then record.', 'warn');
  try { await startAudio(); } catch (e) { return toast('Audio could not start: ' + e.message, 'bad'); }
  let cv = null; if (!audio) {
    if (ZOOM.cur === 'canvas') zoomSet('song', true);
    try { dockGo('vis'); } catch (e) { }
    await new Promise(r => setTimeout(r, 250));
    if (!UI.vcv || !UI.vcv.width) return toast('Open the Visuals first.', 'warn');
    const f = srecFmt(); cv = srecCanvas(f); SREC.fmt = f; SREC.words = srecWordsOn(f); SREC.err = 0; SREC.fr = { n: 0, late: 0, last: 0, q: f === 'screen' ? 0 : srecQ() }; SREC.cv = cv; srecFrame();      /* the first frame is there before the recorder starts */
  }
  let ms;
  try {
    ms = audio ? new MediaStream() : cv.captureStream(30); SREC.dest = E.ctx.createMediaStreamDestination(); E.limiter.connect(SREC.dest); SREC.dest.stream.getAudioTracks().forEach(t => ms.addTrack(t));
    SREC.mr = new MediaRecorder(ms, Object.assign(audio ? { audioBitsPerSecond: 192e3 } : { videoBitsPerSecond: 8e6, audioBitsPerSecond: 192e3 }, mime ? { mimeType: mime } : {}));
  } catch (e) { try { E.limiter.disconnect(SREC.dest); } catch (x) { } SREC.dest = null; SREC.cv = null; return toast('Recording could not start: ' + (e.message || e.name), 'bad'); }
  SREC.stream = ms; SREC.mime = SREC.mr.mimeType || mime || 'video/webm'; SREC.chunks = []; SREC.whole = !!whole; SREC.save = true; SREC.name = (S.title || 'song').replace(/\W+/g, '_') + (audio ? '_audio' : SREC.fmt === 'tall' ? '_vertical' : '_stage'); SREC.audio = audio; SREC.onBlob = o.onBlob || null;
  SREC.mr.ondataavailable = e => { if (e.data && e.data.size) SREC.chunks.push(e.data); };
  SREC.mr.onstop = srecDone;
  SREC.was = { loop: T.loop, metro: T.metro };
  if (whole) { if (T.playing) stopPlay(true); T.loop = false; T.metro = false; T.cursor = 0; }
  SREC.mr.start(500); SREC.on = true; SREC.t0 = performance.now(); SREC.tick = setInterval(srecSync, 500); srecSync(); bus.emit('srec', true);
  if (!whole && typeof srecTakeBegin === 'function') srecTakeBegin(false);     /* your playing becomes a lane in the arrangement (part 67) */
  if (!audio) toast(whole ? 'Recording the whole song…' : 'Recording the stage… press ■ to stop and save.', 'ok');
  if (whole) {
    try { await play(); } catch (e) { }
    if (typeof srecTakeBegin === 'function') srecTakeBegin(true);
    const total = songSlots() * slotDur() + 1.8;
    SREC.watch = setInterval(() => { const el = (performance.now() - SREC.t0) / 1000; if (el >= total || (!T.playing && el > 2.5)) srecStop(true); }, 250);
  }
}
function srecStop(save) {
  if (!SREC.on) return; SREC.save = save !== false; SREC.on = false;
  if (typeof srecTakeEnd === 'function') srecTakeEnd(SREC.save);
  clearInterval(SREC.tick); clearInterval(SREC.watch);
  try { if (SREC.mr && SREC.mr.state !== 'inactive') SREC.mr.stop(); else srecDone(); } catch (e) { srecDone(); }
}
function srecDone() {
  const blob = SREC.chunks.length ? new Blob(SREC.chunks, { type: SREC.mime.split(';')[0] }) : null, save = SREC.save;
  try { E.limiter.disconnect(SREC.dest); } catch (e) { } try { SREC.stream && SREC.stream.getTracks().forEach(t => t.stop()); } catch (e) { }
  if (SREC.was) { T.loop = SREC.was.loop; T.metro = SREC.was.metro; if (SREC.whole) { try { stopPlay(true); } catch (e) { } } SREC.was = null; }
  SREC.mr = null; SREC.dest = null; SREC.stream = null; SREC.on = false; SREC.chunks = []; SREC.cv = null; srecSync(); bus.emit('srec', false);
  const F = SREC.fr; SREC.lastFr = F ? { n: F.n, late: F.late, q: F.q } : null; SREC.fr = null;
  if (save && F && F.n > 60 && F.late / F.n > .1) setTimeout(() => toast(F.q === 1080 ? 'This device could not keep up with every frame (' + Math.round(F.late / F.n * 100) + '% came late). For a smoother video, choose 720p in the Record menu.' : 'This device could not keep up with every frame (' + Math.round(F.late / F.n * 100) + '% came late). Closing other tabs and apps, or a simpler look, helps.', 'warn'), 600);
  const cb = SREC.onBlob; SREC.onBlob = null;
  if (save && blob && blob.size > 1000 && !SREC.audio) bus.emit('srec:blob', blob);   /* Studio Replay keeps the newest video (part 68) */
  if (save && blob && blob.size > 1000 && cb) cb(blob);
  else if (save && blob && blob.size > 1000) { download(SREC.name + (SREC.audio ? (/mp4/.test(blob.type) ? '.m4a' : '.webm') : (/mp4/.test(blob.type) ? '.mp4' : '.webm')), blob); toast('Saved ' + (SREC.audio ? 'the audio' : 'the stage video') + ' to this device (' + (blob.size / 1048576).toFixed(1) + ' MB)', 'ok'); }
  else if (save) toast('Nothing was recorded.', 'warn');
}
/** the kill switch: stop and throw the video away */
function srecAbort() { if (!SREC.on) return; srecStop(false); toast('Recording stopped. Nothing was kept.', 'warn'); }
