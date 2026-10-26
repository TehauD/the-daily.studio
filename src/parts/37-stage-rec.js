/* ============================================================
   Part 37 · RECORD THE STAGE
   A video of what the Visuals canvas shows (hexagons, Halo ring, you in front when the camera is on) with the song's
   sound (the master output, so live guitar is in it when monitoring is on). Made with the browser's own recorder and saved
   to this device as .webm or .mp4. Nothing is uploaded; the camera is never started by recording; Ctrl/Cmd+. discards it.
   ============================================================ */
const SREC = { on: false, mr: null, chunks: [], t0: 0, tick: 0, watch: 0, dest: null, stream: null, mime: '', whole: false, save: true, was: null, name: '' };
function srecMime() {
  if (!window.MediaRecorder) return null;
  const c = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4'];
  return c.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || '';
}
const srecClock = () => { const s = Math.floor((performance.now() - SREC.t0) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function srecSync() {
  $$('[data-srec]').forEach(b => { b.classList.toggle('bad', SREC.on); b.classList.toggle('srec-on', SREC.on); const l = b.querySelector('.lbl'); const t = SREC.on ? '■ ' + srecClock() : '⏺ Record'; if (l) l.textContent = ' ' + t.replace(/^⏺ /, ''); else b.textContent = t; b.setAttribute('aria-pressed', String(SREC.on)); b.title = SREC.on ? 'Stop and save the video to this device' : 'Record the stage as a video with the song’s sound (saved on this device)'; });
}
function srecMenu(anchor) {
  if (SREC.on) return srecStop(true);
  const box = h('div', { style: { minWidth: '250px', display: 'grid', gap: '6px' } }, h('h5', {}, 'Record the stage'),
    h('button', { class: 'btn', id: 'srecNow', onclick: () => { closePop(); srecStart(false); } }, '⏺ Record now'),
    h('button', { class: 'btn', id: 'srecWhole', onclick: () => { closePop(); srecStart(true); } }, '⏺ The whole song, from the top'),
    h('div', { class: 'tiny muted' }, 'Saved on this device as a video with sound. The camera is only in it if you already turned it on. Keep this tab in front while recording.'));
  popover(anchor, box);
}
async function srecStart(whole) {
  if (SREC.on) return;
  const cvOk = typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype.captureStream, mime = srecMime();
  if (!cvOk || mime === null) return toast('This browser cannot record video here. Try a recent Chrome, Edge, Firefox or Safari.', 'warn');
  if (typeof AK !== 'undefined' && AK.killed) return toast('Audio is stopped. Open Audio to resume, then record.', 'warn');
  try { await startAudio(); } catch (e) { return toast('Audio could not start: ' + e.message, 'bad'); }
  if (ZOOM.cur === 'canvas') zoomSet('song', true);
  try { dockGo('vis'); } catch (e) { }
  await new Promise(r => setTimeout(r, 250));
  const cv = UI.vcv; if (!cv || !cv.width) return toast('Open the Visuals first.', 'warn');
  let ms;
  try {
    ms = cv.captureStream(30); SREC.dest = E.ctx.createMediaStreamDestination(); E.limiter.connect(SREC.dest); SREC.dest.stream.getAudioTracks().forEach(t => ms.addTrack(t));
    SREC.mr = new MediaRecorder(ms, Object.assign({ videoBitsPerSecond: 8e6, audioBitsPerSecond: 192e3 }, mime ? { mimeType: mime } : {}));
  } catch (e) { try { E.limiter.disconnect(SREC.dest); } catch (x) { } SREC.dest = null; return toast('Recording could not start: ' + (e.message || e.name), 'bad'); }
  SREC.stream = ms; SREC.mime = SREC.mr.mimeType || mime || 'video/webm'; SREC.chunks = []; SREC.whole = !!whole; SREC.save = true; SREC.name = (S.title || 'song').replace(/\W+/g, '_') + '_stage';
  SREC.mr.ondataavailable = e => { if (e.data && e.data.size) SREC.chunks.push(e.data); };
  SREC.mr.onstop = srecDone;
  SREC.was = { loop: T.loop, metro: T.metro };
  if (whole) { if (T.playing) stopPlay(true); T.loop = false; T.metro = false; T.cursor = 0; }
  SREC.mr.start(500); SREC.on = true; SREC.t0 = performance.now(); SREC.tick = setInterval(srecSync, 500); srecSync(); bus.emit('srec', true);
  toast(whole ? 'Recording the whole song…' : 'Recording the stage… press ■ to stop and save.', 'ok');
  if (whole) {
    try { await play(); } catch (e) { }
    const total = songSlots() * slotDur() + 1.8;
    SREC.watch = setInterval(() => { const el = (performance.now() - SREC.t0) / 1000; if (el >= total || (!T.playing && el > 2.5)) srecStop(true); }, 250);
  }
}
function srecStop(save) {
  if (!SREC.on) return; SREC.save = save !== false; SREC.on = false;
  clearInterval(SREC.tick); clearInterval(SREC.watch);
  try { if (SREC.mr && SREC.mr.state !== 'inactive') SREC.mr.stop(); else srecDone(); } catch (e) { srecDone(); }
}
function srecDone() {
  const blob = SREC.chunks.length ? new Blob(SREC.chunks, { type: SREC.mime.split(';')[0] }) : null, save = SREC.save;
  try { E.limiter.disconnect(SREC.dest); } catch (e) { } try { SREC.stream && SREC.stream.getTracks().forEach(t => t.stop()); } catch (e) { }
  if (SREC.was) { T.loop = SREC.was.loop; T.metro = SREC.was.metro; if (SREC.whole) { try { stopPlay(true); } catch (e) { } } SREC.was = null; }
  SREC.mr = null; SREC.dest = null; SREC.stream = null; SREC.on = false; SREC.chunks = []; srecSync(); bus.emit('srec', false);
  if (save && blob && blob.size > 1000) { download(SREC.name + (/mp4/.test(blob.type) ? '.mp4' : '.webm'), blob); toast('Saved the stage video to this device (' + (blob.size / 1048576).toFixed(1) + ' MB)', 'ok'); }
  else if (save) toast('Nothing was recorded.', 'warn');
}
/** the kill switch: stop and throw the video away */
function srecAbort() { if (!SREC.on) return; srecStop(false); toast('Recording stopped. Nothing was kept.', 'warn'); }
