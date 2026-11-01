/* ============================================================
   Part 68 · The creator's and the teacher's kit, behind the goal workspaces' buttons (part 64).
     Studio Replay   the last stage video (or screen recording, or a track made small to share) plays back in place: save it, share it,
                     make a one-file share page of it, or make a thumbnail from any frame
     Record video    the stage recorder (part 37), asking for MP4 where the browser can make it, opening Studio Replay when it stops
     Thumbnail       a 1280 × 720 PNG of the stage (or of the replay's frame) with the song's title on it
     Screen record   this tab or the screen (the browser asks which), with the studio's sound and, if you like, your microphone
     Lesson notes    a small note card per song, kept in this browser
     Annotate        draw over the page; the ink stays (and shows in a screen recording) until you clear it
   Everything is made and kept on this device. Share hands the file to your device's own share sheet only when you press it.
   ============================================================ */
const KIT = { last: null, lastKind: '', meta: {}, sync: null, enc: null, url: '', scr: null, notesEl: null, ink: null, inkOn: false, strokes: [], pen: '#ffd23f' };
const kitMb = b => b.size < 1048576 ? Math.max(1, Math.round(b.size / 1024)) + ' KB' : (b.size / 1048576).toFixed(1) + ' MB';
const kitExt = b => /^audio\/mp4/.test(b.type) ? '.m4a' : /mp4/.test(b.type) ? '.mp4' : /ogg/.test(b.type) ? '.ogg' : '.webm';
const kitAudio = b => /^audio\//.test(b.type);
const kitName = kind => (S.title || 'song').replace(/\W+/g, '_') + '_' + (kind || 'stage');
/** keep a recording for Studio Replay (only the newest one is kept, in memory) */
function kitKeep(blob, kind, meta) {
  if (!blob || blob === KIT.last) return; if (KIT.url) { try { URL.revokeObjectURL(KIT.url); } catch (e) { } }
  KIT.last = blob; KIT.lastKind = kind || 'stage'; KIT.meta = meta || {}; KIT.url = URL.createObjectURL(blob); bus.emit('kit');
}
/* where the song was when a stage video started, so its share page can follow the words (meta.off: song seconds at the video's start) */
bus.on('srec', on => { KIT.sync = on && T.playing ? { m: 0, s: playheadSlot() * slotDur() } : null; });
bus.on('transport', () => { if (SREC.on && !SREC.audio && T.playing && !KIT.sync) KIT.sync = { m: (performance.now() - SREC.t0) / 1000, s: T.cursor * slotDur() }; });
bus.on('srec:blob', b => kitKeep(b, 'stage', { off: KIT.sync ? KIT.sync.s - KIT.sync.m : null }));
/** one button: start the stage video; press again to stop, and Studio Replay opens with it */
function kitRecord() {
  if (SREC.on) { srecStop(true); return; }
  srecStart(false, { mp4: true, onBlob: b => { kitKeep(b, SREC.fmt === 'tall' ? 'vertical' : 'stage'); kitReplay(); } });
}
const kitFile = b => (KIT.meta.name || kitName(KIT.lastKind)) + kitExt(b);
function kitSave() { const b = KIT.last; if (!b) return; download(kitFile(b), b); toast('Saved the ' + (kitAudio(b) ? 'audio' : 'video') + ' to this device (' + kitMb(b) + ')', 'ok'); }
async function kitShare() {
  if (CFG.shareOk !== SHARE_TERMS) return shareGate(kitShare);
  const b = KIT.last; if (!b) return; const f = new File([b], kitFile(b), { type: b.type });
  try { if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: S.title || 'My performance' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  kitSave(); toast('This browser has no share sheet for this file here, so it was saved instead: send or post it from your files.', 'warn');
}
/** one file with this recording, a player and the words and chords in time (the share page of part 39, for one recording) */
function kitPage() {
  if (CFG.shareOk !== SHARE_TERMS) return shareGate(kitPage);
  const b = KIT.last; if (!b) return; const m = KIT.meta || {}, fr = new FileReader();
  fr.onload = () => {
    const d = shareData(m.off == null ? 0 : m.off, m.len); if (m.off == null) d.nosync = true;
    const html = shareHtml(fr.result, d, kitAudio(b) ? 'audio' : 'video'); download((m.name || kitName(KIT.lastKind)) + '_share.html', new Blob([html], { type: 'text/html' }));
    toast('Saved the share page (' + (html.length / 1048576).toFixed(1) + ' MB). Send it as a file, or put it on any web host and embed it with an iframe.', 'ok');
  };
  fr.readAsDataURL(b);
}
/** a track made small to share: the lane (or one clip) as M4A where the browser can (else Opus), made silently in real time */
function kitEncode(r, tick) {
  return new Promise(async (res, rej) => {
    try { await startAudio(); } catch (e) { return rej(e); }
    const c = E.ctx, mime = srecMime(true); if (mime === null || !c.createMediaStreamDestination) return rej(new Error('this browser cannot make compressed audio here'));
    const buf = c.createBuffer(1, r.data.length, r.sr); buf.copyToChannel(r.data, 0);
    const src = c.createBufferSource(), dst = c.createMediaStreamDestination(), parts = []; src.buffer = buf; src.connect(dst);
    let mr; try { mr = new MediaRecorder(dst.stream, Object.assign({ audioBitsPerSecond: 160e3 }, mime ? { mimeType: mime } : {})); } catch (e) { return rej(e); }
    let tm = 0, stopped = false; const t0 = c.currentTime + .1;
    const end = () => { if (mr.state !== 'inactive') mr.stop(); };
    mr.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
    mr.onstop = () => { clearInterval(tm); try { src.disconnect(); } catch (e) { } KIT.enc = null; if (stopped) rej(new Error('cancelled')); else res(new Blob(parts, { type: (mr.mimeType || mime || 'audio/webm').split(';')[0] })); };
    src.onended = () => setTimeout(end, 300);
    KIT.enc = { cancel: () => { stopped = true; try { src.stop(); } catch (e) { } end(); } };
    mr.start(500); src.start(t0); tm = setInterval(() => tick && tick(Math.max(0, c.currentTime - t0), buf.duration), 200);
  });
}
async function kitTake(tk, one) {
  if (KIT.enc) return toast('A track is already being made. Wait for it, or cancel it.', 'warn');
  if (typeof AK !== 'undefined' && AK.killed) return toast('Audio is stopped. Open Audio to resume, then share.', 'warn');
  const lead = tkLead(tk), r = one ? (tkRenderClip(tk, 'wet') || tkRenderClip(tk, 'dry')) : (tkRender(lead, 'wet') || tkRender(lead, 'dry')); if (!r) return toast('There is no audio in this ' + (one ? 'clip' : 'lane') + '.', 'warn');
  const name = ((S.title || 'song') + '_' + (one ? tk.name + '_clip' : lead.name)).replace(/\W+/g, '_'), fmt = x => Math.floor(x / 60) + ':' + String(Math.floor(x % 60)).padStart(2, '0');
  const bar = h('i'), txt = h('span', { class: 'mono tiny' }, '0:00 / ' + fmt(r.dur));
  const dlg = pdlg('kitEnc', 'MAKING A SMALL AUDIO FILE', h('div', { style: { display: 'grid', gap: '8px' } },
    h('div', { class: 'small' }, 'Turning “' + (one ? tk.name : lead.name) + '” into a small file to share. It plays through once, silently, so it takes as long as the recording.'),
    h('div', { class: 'meter' }, bar), txt), { onclose: () => { if (KIT.enc) KIT.enc.cancel(); } });
  try {
    const b = await kitEncode(r, (t, d) => { bar.style.width = Math.min(100, t / d * 100).toFixed(1) + '%'; txt.textContent = fmt(Math.min(t, d)) + ' / ' + fmt(d); });
    try { dlg.close(); } catch (e) { } if (!b || b.size < 200) return toast('The audio came out empty. Try again.', 'warn');
    kitKeep(b, 'take', { off: r.startSec, len: r.dur, name }); kitReplay();
  } catch (e) { try { dlg.close(); } catch (x) { } if (!/cancel/.test(e && e.message || '')) toast('Could not make the audio file: ' + (e && e.message || e), 'bad'); }
}
function kitReplay() {
  if (!KIT.last) return toast('Record a video first: ⏺ Record video, then ■ to stop.', 'warn');
  const b = KIT.last, mp4 = /mp4/.test(b.type), aud = kitAudio(b);
  const v = aud ? h('audio', { class: 'kit-a', id: 'kitAudio', src: KIT.url, controls: true }) : h('video', { class: 'kit-v', id: 'kitVideo', src: KIT.url, controls: true, playsinline: true, autoplay: true });
  const canShare = (() => { try { return !!(navigator.canShare && navigator.canShare({ files: [new File([b], 'x' + kitExt(b), { type: b.type })] })); } catch (e) { return false; } })();
  const body = h('div', { class: 'kit-replay' }, v,
    h('div', { class: 'tiny muted kit-meta' }, (aud ? (KIT.meta.name || 'Track') + ' · ' + (mp4 ? 'M4A' : kitExt(b).slice(1).toUpperCase()) + ' · ' + kitMb(b) : (mp4 ? 'MP4' : 'WebM') + ' · ' + kitMb(b) + (mp4 ? ' · ready for social posts' : ' · this browser records WebM; most sites take it, or convert it to MP4'))),
    h('div', { class: 'row kit-acts' },
      h('button', { class: 'btn primary', id: 'kitSave', onclick: kitSave }, '⇩ Save ' + (aud ? (mp4 ? 'M4A' : 'audio') : mp4 ? 'MP4' : 'video')),
      canShare ? h('button', { class: 'btn', id: 'kitShare', onclick: kitShare }, '↗ Share…') : null,
      h('button', { class: 'btn', id: 'kitPage', title: 'One HTML file with this recording, a player and the words and chords in time. Send it, or put it on any web host and embed it.', onclick: kitPage }, '🔗 Share page'),
      aud ? null : h('button', { class: 'btn', id: 'kitThumbFrame', title: 'Pause on the frame you want first', onclick: () => kitThumb(v) }, '🖼 Thumbnail from this frame'),
      KIT.lastKind === 'stage' ? h('button', { class: 'btn', id: 'kitAgain', onclick: () => { d.close(); kitRecord(); } }, '⏺ Record again') : null));
  body.append(shareNotice());
  const d = pdlg('kitReplayDlg', aud ? 'Share a track' : 'Studio Replay', body, { wide: true, onclose: () => { try { v.pause(); } catch (e) { } } });
  return d;
}
/** a 1280 × 720 picture: the stage (or a video frame), darkened at the foot, with the title and the key and tempo */
function kitThumb(src) {
  src = src || UI.vcv; const sw = src && (src.videoWidth || src.width), sh = src && (src.videoHeight || src.height);
  /* the thumbnail takes the video's shape: a vertical video (or a vertical choice, from the stage) gets a 1080 × 1920 cover */
  const tall = src && src.videoWidth ? sh > sw : srecFmt() === 'tall', W = tall ? 1080 : 1280, H = tall ? 1920 : 720, c = h('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#0d0f10'; g.fillRect(0, 0, W, H);
  if (sw && sh) { const k = Math.max(W / sw, H / sh), dw = sw * k, dh = sh * k; try { g.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch (e) { } }
  const gr = g.createLinearGradient(0, H * .45, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.78)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const title = S.title || 'New song', sub = [NS[S.key] + (S.minor ? ' minor' : ' major'), S.bpm + ' BPM'].filter(Boolean).join(' · ');
  g.fillStyle = '#fff'; g.textBaseline = 'alphabetic'; let fs = 92; g.font = '800 ' + fs + 'px "DS Montserrat", system-ui, sans-serif'; while (g.measureText(title).width > W - 120 && fs > 40) { fs -= 4; g.font = '800 ' + fs + 'px "DS Montserrat", system-ui, sans-serif'; }
  const by = tall ? H - 240 : H - 92; g.fillText(title, 60, by); g.font = '600 34px "DS Inter", system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.82)'; g.fillText(sub, 62, by + 48);
  c.toBlob(bl => { if (!bl) return toast('The thumbnail could not be made here.', 'bad'); download(kitName('thumbnail') + '.png', bl); toast('Saved a ' + W + ' × ' + H + ' thumbnail', 'ok'); }, 'image/png');
  return c;
}
/* ---------- screen recording ---------- */
async function kitScreen() {
  if (KIT.scr) { try { KIT.scr.mr.stop(); } catch (e) { kitScreenDone(); } return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || !window.MediaRecorder) return toast('This browser cannot record the screen. Try a recent Chrome, Edge or Firefox on a computer.', 'warn');
  let disp; try { disp = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true }); } catch (e) { return toast(e && e.name === 'NotAllowedError' ? 'Screen recording was not started.' : 'Screen recording could not start: ' + (e.message || e.name), 'warn'); }
  const out = new MediaStream(disp.getVideoTracks()), r = { disp, mic: null, dest: null, chunks: [], mr: null, links: [] };
  try {
    await startAudio(); r.dest = E.ctx.createMediaStreamDestination(); E.limiter.connect(r.dest); r.links.push(E.limiter);
    if (disp.getAudioTracks().length) { const s = E.ctx.createMediaStreamSource(new MediaStream(disp.getAudioTracks())); s.connect(r.dest); r.links.push(s); }
    if (CFG.kitMic !== false) { try { r.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); const m = E.ctx.createMediaStreamSource(r.mic); m.connect(r.dest); r.links.push(m); } catch (e) { toast('Recording without your voice: the microphone was not allowed.', 'warn'); } }
    r.dest.stream.getAudioTracks().forEach(t => out.addTrack(t));
  } catch (e) { console.warn('screen audio', e); }
  const mime = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(t => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || '';
  try { r.mr = new MediaRecorder(out, Object.assign({ videoBitsPerSecond: 6e6, audioBitsPerSecond: 160e3 }, mime ? { mimeType: mime } : {})); } catch (e) { disp.getTracks().forEach(t => t.stop()); return toast('Screen recording could not start: ' + (e.message || e.name), 'bad'); }
  r.mime = r.mr.mimeType || mime || 'video/webm'; r.mr.ondataavailable = e => { if (e.data && e.data.size) r.chunks.push(e.data); }; r.mr.onstop = kitScreenDone;
  disp.getVideoTracks().forEach(t => t.addEventListener('ended', () => { if (KIT.scr === r && r.mr.state !== 'inactive') r.mr.stop(); }));
  KIT.scr = r; r.mr.start(500); bus.emit('kit'); toast('Recording the screen… press ⏺ Record screen again (or the browser’s Stop sharing) to finish.', 'ok');
}
function kitScreenDone() {
  const r = KIT.scr; if (!r) return; KIT.scr = null;
  r.links.forEach(n => { try { n.disconnect(r.dest); } catch (e) { } }); [r.disp, r.mic].forEach(s => { try { s && s.getTracks().forEach(t => t.stop()); } catch (e) { } });
  const blob = r.chunks.length ? new Blob(r.chunks, { type: r.mime.split(';')[0] }) : null; bus.emit('kit');
  if (blob && blob.size > 1000) { kitKeep(blob, 'lesson'); kitReplay(); } else toast('Nothing was recorded.', 'warn');
}
/* ---------- lesson notes: one card per song, kept in this browser ---------- */
const kitNoteKey = () => (S.title || 'Untitled').slice(0, 80);
function kitNotes() {
  if (KIT.notesEl) { KIT.notesEl.remove(); KIT.notesEl = null; bus.emit('kit'); return; }
  const all = store.get('lessons', {}), ta = h('textarea', { class: 'in kit-ta', id: 'kitNotesText', 'aria-label': 'Lesson notes', placeholder: 'What to practise, the bars that need work, the next lesson…' });
  ta.value = all[kitNoteKey()] || '';
  ta.addEventListener('input', () => { const a = store.get('lessons', {}); if (ta.value.trim()) a[kitNoteKey()] = ta.value; else delete a[kitNoteKey()]; store.set('lessons', a); });
  const el = h('div', { class: 'kit-notes', id: 'kitNotes', role: 'dialog', 'aria-label': 'Lesson notes' },
    h('div', { class: 'kit-nh' }, h('b', {}, '📝 Lesson notes · ', h('span', { class: 'muted' }, kitNoteKey())), h('span', { class: 'grow' }),
      h('button', { class: 'btn sm', title: 'Copy the notes', onclick: () => copyText(ta.value) }, 'Copy'),
      h('button', { class: 'btn sm', title: 'Save the notes as a text file', onclick: () => download(kitName('lesson_notes') + '.txt', ta.value) }, '⇩ .txt'),
      h('button', { class: 'btn sm', 'aria-label': 'Close the lesson notes', onclick: kitNotes }, '✕')), ta);
  document.body.append(el); KIT.notesEl = el; ta.focus(); bus.emit('kit');
}
/* ---------- annotate: ink over the whole page ---------- */
const KIT_PENS = ['#ffd23f', '#ff5a5f', '#3ddc97', '#4cc9f0', '#ffffff'];
function kitInkDraw() {
  const c = KIT.ink && KIT.ink.cv; if (!c) return; const dpr = devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); g.lineCap = g.lineJoin = 'round';
  KIT.strokes.forEach(s => { g.strokeStyle = s.c; g.lineWidth = s.w; g.beginPath(); s.p.forEach(([x, y], i) => i ? g.lineTo(x * W, y * H) : g.moveTo(x * W, y * H)); if (s.p.length === 1) g.lineTo(s.p[0][0] * W + .1, s.p[0][1] * H); g.stroke(); });
}
function kitInkBuild() {
  if (KIT.ink) return KIT.ink; const cv = h('canvas', { class: 'kit-ink', id: 'kitInk', 'aria-hidden': 'true' });
  let cur = null;
  cv.addEventListener('pointerdown', e => { if (!KIT.inkOn) return; cv.setPointerCapture(e.pointerId); cur = { c: KIT.pen, w: 4, p: [[e.clientX / innerWidth, e.clientY / innerHeight]] }; KIT.strokes.push(cur); kitInkDraw(); e.preventDefault(); });
  cv.addEventListener('pointermove', e => { if (!cur) return; cur.p.push([e.clientX / innerWidth, e.clientY / innerHeight]); kitInkDraw(); });
  ['pointerup', 'pointercancel'].forEach(t => cv.addEventListener(t, () => { cur = null; }));
  const pens = h('div', { class: 'kit-pens', role: 'group', 'aria-label': 'Pen colour' }, KIT_PENS.map(c => h('button', { class: 'kit-pen' + (c === KIT.pen ? ' on' : ''), style: { background: c }, 'aria-label': 'Pen ' + c, onclick: e => { KIT.pen = c; $$('.kit-pen', bar).forEach(b => b.classList.toggle('on', b === e.currentTarget)); } })));
  const bar = h('div', { class: 'kit-inkbar', id: 'kitInkBar', role: 'toolbar', 'aria-label': 'Annotate' }, h('b', {}, '✎'), pens,
    h('button', { class: 'btn sm', id: 'kitUndo', onclick: () => { KIT.strokes.pop(); kitInkDraw(); } }, '↶ Undo'),
    h('button', { class: 'btn sm', id: 'kitClear', onclick: () => { KIT.strokes = []; kitInkDraw(); } }, 'Clear'),
    h('button', { class: 'btn sm primary', id: 'kitInkDone', onclick: () => kitInk(false) }, 'Done'));
  document.body.append(cv, bar); addEventListener('resize', kitInkDraw);
  return (KIT.ink = { cv, bar });
}
addEventListener('keydown', e => { if (e.key === 'Escape' && KIT.inkOn) kitInk(false); });
/** on: draw (the page underneath does not get the clicks); off: the ink stays where it is and the page works again */
function kitInk(on) {
  const k = kitInkBuild(); KIT.inkOn = on == null ? !KIT.inkOn : !!on;
  k.cv.classList.toggle('drawing', KIT.inkOn); k.bar.hidden = !KIT.inkOn; kitInkDraw();
  if (!KIT.inkOn && !KIT.strokes.length) { k.cv.remove(); k.bar.remove(); removeEventListener('resize', kitInkDraw); KIT.ink = null; }
  bus.emit('kit');
}
