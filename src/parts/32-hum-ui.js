/* ============================================================
   Part 32 · Hum to Song: the screens. Press, hum, hear a song.
   Microphone and camera are only requested when the person presses the button.
   ============================================================ */
const HUM = { first: false, cam0: null, ph: null, keep: false, g: null, o: { style: null, form: 'full', seed: 0, bpm: null, key: null, minor: null }, an: null, pcm: null, sr: 0, rec: null, bar: null, hear: null, r: null, busy: false };
/** the stage route (full-screen visuals + camera) is chosen on the start card or in Settings; the camera inside it can be switched off (CFG.humStage) */
const humStageOn = () => CFG.route === 'stage';
const humFmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

/** Put the person on stage: the camera behind the visuals, "me in front" (green screen) by default. One tap; asks the browser for the camera only now. */
/** the person pressed a camera button: remember the choice so the next start follows it */
function vzCamPress() { CFG.humStage = !VZ.cam; saveCfg(); return vzCenterStage(!VZ.cam); }
function vzCenterStage(on) {
  if (on && VZ.camP) return VZ.camP;   // two starts at once share one request
  const p = vzCenterStage0(on); if (on) { VZ.camP = p; p.then(() => { VZ.camP = null; }, () => { VZ.camP = null; }); } return p;
}
async function vzCenterStage0(on) {
  const bs = ['vzCamBtn', 'ioCamBtn'].map(id => document.getElementById(id)).filter(Boolean), mark = () => bs.forEach(b => b.classList.toggle('on', VZ.cam)); VZ.cam = !!on; mark();
  if (!on) { if (CAM.on) stopCam(); return; }
  if (CFG.camFx == null) { CFG.camFx = 'person'; saveCfg(); const s = document.querySelector('select[aria-label="Camera look"]'); if (s) { s.value = 'person'; s.dispatchEvent(new Event('change')); } }
  if (!CAM.on) { if (CAM.want !== 'motion' && !CAM.tracker) { CAM.want = 'motion'; if (UI.camMode) UI.camMode.value = 'motion'; } await startCam(); }
  if (!CAM.on) { VZ.cam = false; mark(); }
}
async function humStageGo() { try { dockGo('vis'); vzImmersive(true); if (CFG.humStage !== false) await vzCenterStage(true); } catch (e) { } }

/* ---------- the front screen ---------- */
function humOpen() {
  if (HUM.rec) return; humBarClose();
  const stage = h('input', { type: 'checkbox', checked: humStageOn(), id: 'humStage', onchange: e => setRoute(e.target.checked ? 'stage' : 'studio') });
  const pick = h('input', { type: 'file', accept: 'audio/*,.m4a,.mp3,.wav,.ogg,.webm,.flac', style: { display: 'none' }, onchange: e => { const f = e.target.files[0]; e.target.value = ''; if (f) { d.close(); humFromFile(f); } } });
  const devs = (E.devs.in || []).filter(d => d.deviceId !== 'communications' && d.deviceId !== 'default');
  const mic = h('select', { class: 'in', id: 'humMic', 'aria-label': 'Microphone', style: { fontFamily: 'var(--sans)', maxWidth: '100%' }, onchange: e => { CFG.inDev = e.target.value; saveCfg(); } },
    h('option', { value: '' }, 'Default microphone'), devs.map((d, i) => h('option', { value: d.deviceId, selected: d.deviceId === CFG.inDev }, d.label || ('Microphone ' + (i + 1)))));
  const body = h('div', { class: 'hum-in' },
    h('p', { class: 'hum-lead' }, 'Hum or sing a few seconds of any melody. You will hear it become a full song with a band.'),
    h('button', { class: 'btn primary hum-go', id: 'humGo', onclick: () => { d.close(); humRecord(); } }, '● Hum or sing'),
    h('div', { class: 'tiny muted' }, 'Your browser asks for the microphone only when you press the button. Nothing is uploaded.'),
    h('details', { class: 'boot-more' }, h('summary', {}, 'Options'), h('div', { class: 'hum-opts' },
      h('label', { class: 'row hum-stage', style: { gap: '8px' } }, stage, h('span', {}, 'Go on stage while I sing ', h('span', { class: 'muted' }, '(full-screen visuals with the camera; stays on this device)'))),
      h('label', { class: 'pd-f' }, h('span', {}, 'Microphone'), mic),
      h('div', {}, h('button', { class: 'btn sm', onclick: () => pick.click() }, '📂 Use a voice memo or audio file instead'), pick))));
  const d = pdlg('hum', 'HUM TO SONG', body, { cls: 'humdlg' }); setTimeout(() => { const g = document.getElementById('humGo'); if (g) g.focus(); }, 40); return d;
}

/** The very first interaction: straight to the stage (camera behind the hexagons) with two big choices. */
/** the empty "Hum idea" page made for a start panel, still untouched: reuse it instead of making another */
const humPlaceholder = () => !!HUM.ph && HUM.ph === PRJ.cur && !songHasWork() && !TAKES.length;
async function humStageFirst() {
  if (HUM.busy) return; HUM.busy = true; humBarClose();
  try { if (humPlaceholder()) dockGo('vis'); else await humNewProject(); HUM.keep = true; if (HUM.cam0 !== false && humStageOn()) await humStageGo(); } finally { HUM.busy = false; }
  humBar('start'); setTimeout(() => { const g = document.getElementById('humGo2'); if (g) g.focus(); }, 60);
}

/** The studio route's first screen: a clean canvas (the page, nothing else) with the cursor in the lyrics, and a slim bar to sing, hum or play instead. No camera, no full screen. */
async function humCanvasFirst() {
  if (HUM.busy) return; HUM.busy = true; humBarClose();
  try { await projCreate('blank', { form: 'empty', title: 'Untitled idea', zoom: 'canvas' }); HUM.ph = PRJ.cur; HUM.keep = true; zoomSet('canvas', true); sideShow('refine'); } finally { HUM.busy = false; }
  humBar('canvas'); setTimeout(() => { const t = document.querySelector('textarea.lyr'); if (t) t.focus({ preventScroll: true }); }, 120);
}

/* ---------- capture ---------- */
async function humNewProject() { await projCreate('blank', { form: 'empty', title: 'Hum idea', zoom: 'song' }); HUM.ph = PRJ.cur; dockGo('vis'); }
/** a start option other than humming: leave the empty placeholder page behind, then do it */
async function humInstead(fn) { const ph = humPlaceholder() ? HUM.ph : null; HUM.ph = null; humBarClose(); vzImmersive(false); await fn(); if (ph && ph !== PRJ.cur) { try { await projDelete(ph); } catch (e) { } } }
async function humRecord() {
  if (HUM.rec || HUM.busy) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { toast('This browser cannot record here. Choose “a voice memo or audio file” instead.', 'warn'); return humOpen(); }
  let stream; const raw = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
  try { try { stream = await navigator.mediaDevices.getUserMedia({ audio: CFG.inDev ? Object.assign({ deviceId: { exact: CFG.inDev } }, raw) : raw }); } catch (e) { if (CFG.inDev && e.name !== 'NotAllowedError' && e.name !== 'SecurityError') { stream = await navigator.mediaDevices.getUserMedia({ audio: raw }); toast('Your saved microphone is not available, so the default one is used.', 'warn'); } else throw e; } }
  catch (e) { toast('Microphone permission was not given. Allow it in the address bar, or choose a voice memo.', 'warn'); return humOpen(); }
  HUM.busy = true; try { if (HUM.keep) HUM.keep = false; else await humNewProject(); if (humStageOn()) await humStageGo(); } finally { HUM.busy = false; }
  const AC = window.AudioContext || window.webkitAudioContext, actx = new AC(), src = actx.createMediaStreamSource(stream), an = actx.createAnalyser(); an.fftSize = 2048; src.connect(an);
  const chunks = [], mr = new MediaRecorder(stream), r = { stream, actx, an, mr, chunks, t0: performance.now(), raf: 0, buf: new Float32Array(2048) };
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  mr.onstop = () => { const keep = r.keep; humRecCleanup(); if (keep) humRecDone(new Blob(chunks, { type: mr.mimeType || 'audio/webm' })); };
  try { const t = stream.getAudioTracks()[0], id = t && t.getSettings && t.getSettings().deviceId; r.label = (t && t.label) || ''; if (id && CFG.inDev !== id && CFG.inDev) { /* keep the person's choice */ } listDevices(); } catch (e) { }
  HUM.rec = r; mr.start(250); humBar('rec'); r.raf = requestAnimationFrame(humRecTick);
}
function humRecTick() {
  const r = HUM.rec; if (!r) return; r.an.getFloatTimeDomainData(r.buf); let e = 0; for (let i = 0; i < r.buf.length; i++) e += r.buf[i] * r.buf[i]; const rms = Math.sqrt(e / r.buf.length), sec = (performance.now() - r.t0) / 1000;
  const lv = document.getElementById('humLv'), nt = document.getElementById('humNote'), tm = document.getElementById('humTime');
  if (lv) lv.style.width = Math.min(100, Math.round(rms * 600)) + '%'; if (tm) tm.textContent = humFmt(sec);
  if (nt) { let t = '·'; if (rms > .01) { const y = yin(r.buf, r.actx.sampleRate); if (y && y.clarity > .6 && y.f > 70 && y.f < 1100) { const mf = 69 + 12 * Math.log2(y.f / 440); t = humNoteName(mf); HUM.live = { m: Math.round(mf), t: performance.now() }; } } nt.textContent = t; }
  if (sec > 90) { humRecStop(true); return; } r.raf = requestAnimationFrame(humRecTick);
}
function humRecStop(keep) { const r = HUM.rec; if (!r) return; r.keep = keep; cancelAnimationFrame(r.raf); try { if (r.mr.state !== 'inactive') r.mr.stop(); else { humRecCleanup(); } } catch (e) { humRecCleanup(); } }
function humRecCleanup() { const r = HUM.rec; if (!r) return; HUM.rec = null; cancelAnimationFrame(r.raf); try { r.stream.getTracks().forEach(t => t.stop()); } catch (e) { } try { r.actx.close(); } catch (e) { } }
/** called by the Audio kill switch (Ctrl + .): stop listening, stop playing the original, discard an unfinished recording */
function humAbort() {
  if (HUM.hear) { try { HUM.hear.stop(); } catch (e) { } HUM.hear = null; }
  if (HUM.rec) { humRecStop(false); humBarClose(); toast('Hum recording stopped. Nothing was kept.', 'warn'); }
}
async function humDecode(ab) {
  const O = window.OfflineAudioContext || window.webkitOfflineAudioContext, oc = new O(1, 44100, 44100), b = await oc.decodeAudioData(ab), n = Math.min(b.length, Math.floor(b.sampleRate * 90)), out = new Float32Array(n), ch = b.numberOfChannels;
  for (let c = 0; c < ch; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i] / ch; } return { pcm: out, sr: b.sampleRate };
}
async function humRecDone(blob) { try { const { pcm, sr } = await humDecode(await blob.arrayBuffer()); await humRun(pcm, sr); } catch (e) { humBar('err', 'I could not read that recording (' + (e.message || e.name) + '). Try again, or choose an audio file.'); } }
async function humFromFile(f) {
  if (HUM.busy) return; HUM.busy = true;
  try { const { pcm, sr } = await humDecode(await f.arrayBuffer()); await humNewProject(); if (humStageOn()) humStageGo(); await humRun(pcm, sr, cleanTitle(f.name)); }
  catch (e) { humBar('err', 'I could not read that file (' + (e.message || e.name) + '). Try a WAV, MP3 or M4A voice memo.'); } finally { HUM.busy = false; }
}
async function humRun(pcm, sr, title) {
  HUM.pcm = pcm; HUM.sr = sr; HUM.o = { style: null, form: 'full', seed: 0, bpm: null, key: null, minor: null, title: title || 'Hum idea' }; humBar('work', 0);
  HUM.an = await humAnalyze(pcm, sr, p => humBar('work', p));
  if (HUM.an.notes.length < 3) return humBar('few'); await humApply(true);
}

/* ---------- build, play, tweak ---------- */
async function humApply(play) {
  if (!HUM.an) return; if (T.playing) stopPlay(true);
  const r = humSong(HUM.an, HUM.o); HUM.r = r; HUM.o.style = r.style; r.song.title = HUM.o.title || 'Hum idea';
  xpQuiet(() => projUse(r.song)); if (ZOOM.cur === 'canvas') zoomSet('song', true); humAddTake(); try { if (PRJ.cur) await projSave(); } catch (e) { }
  humBar('res'); if (play) await humPlay();
}
/** Put the recording itself in the arrangement: a Vocal take whose first note lands on the first melody note of Verse 1,
 *  so the hum, the lead tab and the band are all in one timeline and play together. Re-arranging replaces it. */
function humAddTake() {
  for (let i = TAKES.length - 1; i >= 0; i--) if (TAKES[i].hum) TAKES.splice(i, 1);
  if (!HUM.pcm || !HUM.an || !HUM.an.notes.length) { bus.emit('takes'); return null; }
  const si = Math.max(0, S.sections.findIndex(x => /^Verse/.test(x.name))), sr = HUM.sr;
  let start = secStart(si) * spb() * slotDur() - HUM.an.notes[0].t, d = HUM.pcm;
  if (start < 0) { d = d.subarray(Math.min(d.length, Math.round(-start * sr))); start = 0; }
  d = new Float32Array(d); let pk = 0, e = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; e += d[i] * d[i]; }
  const tk = { id: uid(), kind: 'vox', hum: true, name: 'My hum', startSec: start, sr, dry: d, wet: null, peaks: peaksOf(d), g: 1, pan: 0, mute: false, solo: false, mode: 'wet', bpm: S.bpm, preset: '', peak: dB(pk), rms: dB(Math.sqrt(e / Math.max(1, d.length))), dur: d.length / sr, t: Date.now(), stats: null, cam: [] };
  TAKES.push(tk); bus.emit('takes'); return tk;
}
function humSaveMenu(anchor) {
  const tk = TAKES.find(t => t.hum), box = h('div', { style: { minWidth: '240px', display: 'grid', gap: '6px' } }, h('h5', {}, 'Save to this device'),
    h('button', { class: 'btn', onclick: () => { closePop(); bounceMaster(); } }, '⤓ The whole song (WAV)'),
    tk ? h('button', { class: 'btn', onclick: () => { closePop(); dlTake(tk); } }, '⤓ My hum (WAV)') : '',
    h('button', { class: 'btn', onclick: () => { closePop(); bounceAllParts(); } }, '⤓ Each band part (WAVs)'),
    h('button', { class: 'btn', onclick: () => { closePop(); download((S.title || 'song').replace(/\W+/g, '_') + '.mid', buildMidi()); toast('MIDI saved', 'ok'); } }, '⤓ MIDI (to open in any music app)'),
    h('div', { class: 'tiny muted' }, 'Everything is made and saved here. Nothing is uploaded. WAV saves play the song once in real time.'));
  popover(anchor, box);
}
async function humPlay() {
  if (HUM.hear) { try { HUM.hear.stop(); } catch (e) { } HUM.hear = null; }
  try { if (typeof AK !== 'undefined' && AK.killed) await audioResume(); } catch (e) { }
  T.metro = false; T.cursor = 0; await play(); bus.emit('transport');
}
function humHear() {
  if (HUM.hear) { try { HUM.hear.stop(); } catch (e) { } HUM.hear = null; return humBar('res'); } if (!HUM.pcm) return; if (T.playing) stopPlay(true);
  const AC = window.AudioContext || window.webkitAudioContext, c = new AC(), b = c.createBuffer(1, HUM.pcm.length, HUM.sr); b.copyToChannel(HUM.pcm, 0); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination);
  s.onended = () => { if (HUM.hear === s) HUM.hear = null; try { c.close(); } catch (e) { } if (HUM.bar) humBar('res'); }; s.start(); HUM.hear = s; HUM.hearT0 = performance.now(); humBar('res');
}

/* ---------- the bottom panel (not a modal, so you still see yourself on stage) ---------- */
function humBarClose() { const d = document.getElementById('humbar'); if (d) { try { d.close(); } catch (e) { } d.remove(); } HUM.bar = null; }
function humBar(mode, arg) {
  let d = document.getElementById('humbar'); if (!d) { d = document.createElement('dialog'); d.id = 'humbar'; d.className = 'humbar'; d.setAttribute('aria-label', 'Hum to Song'); document.body.append(d); try { d.show(); } catch (e) { d.setAttribute('open', ''); } }
  if (mode === 'start' && CFG.route !== 'stage') mode = 'canvas';
  HUM.bar = d; d.innerHTML = ''; d.dataset.mode = mode;
  const x = h('button', { class: 'btn sm hum-x', title: 'Close this panel', 'aria-label': 'Close', onclick: () => { humAbort(); humBarClose(); } }, '✕');
  if (mode === 'rec') {
    d.append(h('div', { class: 'hum-row' }, h('button', { class: 'btn primary hum-stop', id: 'humStop', onclick: () => humRecStop(true) }, '■ Stop'), h('b', { id: 'humTime', class: 'hum-t' }, '0:00'),
      h('div', { class: 'hum-lvw', 'aria-hidden': 'true' }, h('i', { id: 'humLv' })), h('b', { id: 'humNote', class: 'hum-note', 'aria-live': 'off' }, '·'), h('span', { class: 'grow' }), x),
      h('div', { class: 'hum-msg' }, h('b', {}, 'Listening… '), 'hum or sing your idea. 10–30 seconds is plenty. Tap Stop when you are done.' + (HUM.rec && HUM.rec.label ? ' Using: ' + HUM.rec.label + '.' : '')));
  } else if (mode === 'canvas') {
    const pick = h('input', { type: 'file', accept: 'audio/*,.mp3,.wav,.flac,.m4a,.ogg', style: { display: 'none' }, 'aria-label': 'Choose a song file', onchange: e => { const fl = e.target.files[0]; e.target.value = ''; if (fl) humInstead(() => projFromTrack(fl)); } });
    d.append(h('div', { class: 'hum-row' }, h('b', { class: 'hum-hi' }, 'A clean page.'), h('span', { class: 'hum-sub muted' }, 'Write lyrics, chords or thoughts above, or sing it:'), h('span', { class: 'grow' }), x),
      h('div', { class: 'hum-row hum-big2' }, h('button', { class: 'btn primary hum-go', id: 'humGo2', onclick: () => humRecord() }, '● Sing or hum an idea'), h('button', { class: 'btn hum-go', id: 'humGuitar', onclick: () => humGuitar() }, '🎸 I have a guitar')),
      h('div', { class: 'hum-alt' }, h('span', { class: 'tiny muted' }, 'Or start from'),
        h('button', { class: 'btn sm', id: 'humAltFile', onclick: () => pick.click() }, '📂 a song file'),
        h('button', { class: 'btn sm', id: 'humAltDemo', onclick: () => humInstead(() => projCreate('demo', { zoom: 'song' })) }, '♫ the demo song'),
        h('button', { class: 'btn sm', id: 'humAltStage', title: 'Full-screen visuals with the camera', onclick: () => { humBarClose(); goOnStage(); } }, '🎥 the stage'),
        h('span', { class: 'tiny muted' }, 'Everything stays on this device.'), pick));
  } else if (mode === 'start') {
    const pick = h('input', { type: 'file', accept: 'audio/*,.mp3,.wav,.flac,.m4a,.ogg', style: { display: 'none' }, 'aria-label': 'Choose a song file', onchange: e => { const fl = e.target.files[0]; e.target.value = ''; if (fl) humInstead(() => projFromTrack(fl)); } });
    d.append(h('div', { class: 'hum-row' }, h('b', { class: 'hum-hi' }, 'Let’s make a song.'), h('span', { class: 'grow' }), x),
      h('div', { class: 'hum-msg' }, 'Hum a tune, or pick up your guitar. Either way you will hear a whole band play your song in a minute.'),
      h('div', { class: 'hum-row hum-big2' }, h('button', { class: 'btn primary hum-go', id: 'humGo2', onclick: () => humRecord() }, '● Hum or sing'), h('button', { class: 'btn hum-go', id: 'humGuitar', onclick: () => humGuitar() }, '🎸 I have a guitar')),
      h('div', { class: 'hum-alt' }, h('span', { class: 'tiny muted' }, 'Or start from'),
        h('button', { class: 'btn sm', id: 'humAltFile', onclick: () => pick.click() }, '📂 a song file'),
        h('button', { class: 'btn sm', id: 'humAltBlank', onclick: () => { HUM.ph = null; humBarClose(); vzImmersive(false); zoomSet('song', true); sideShow('refine'); setTimeout(() => { if (SB.f && SB.f.title) { SB.f.title.focus(); SB.f.title.select(); } }, 120); } }, '✎ a blank page'),
        h('button', { class: 'btn sm', id: 'humAltDemo', onclick: () => humInstead(() => projCreate('demo', { zoom: 'song' })) }, '♫ the demo song'),
        h('span', { class: 'tiny muted' }, 'Everything stays on this device.'), pick));
  } else if (mode === 'g') { humGuitarBar(d, x);
  } else if (mode === 'work') {
    d.append(h('div', { class: 'hum-row' }, h('b', {}, 'Listening back…'), h('div', { class: 'hum-lvw' }, h('i', { style: { width: Math.round((arg || 0) * 100) + '%' } })), h('span', { class: 'grow' }), x), h('div', { class: 'hum-msg' }, 'Finding your notes, tempo and key. Then the chords and the band.'));
  } else if (mode === 'few') {
    d.append(h('div', { class: 'hum-row' }, h('b', {}, 'I only caught ' + (HUM.an ? HUM.an.notes.length : 0) + ' note' + (HUM.an && HUM.an.notes.length === 1 ? '' : 's') + '.'), h('span', { class: 'grow' }), x),
      h('div', { class: 'hum-msg' }, 'Try humming a little louder and closer to the microphone, in a quiet room, holding each note for a moment.'), h('div', { class: 'hum-row' }, h('button', { class: 'btn primary', onclick: () => { humBarClose(); humRecord(); } }, '● Try again'), h('button', { class: 'btn', onclick: () => { humBarClose(); humOpen(); } }, 'Other options')));
  } else if (mode === 'err') {
    d.append(h('div', { class: 'hum-row' }, h('b', {}, 'Something went wrong'), h('span', { class: 'grow' }), x), h('div', { class: 'hum-msg' }, arg || ''), h('div', { class: 'hum-row' }, h('button', { class: 'btn primary', onclick: () => { humBarClose(); humOpen(); } }, 'Try again')));
  } else { humResult(d, x); }
}
function humResult(d, x) {
  const r = HUM.r, o = HUM.o, an = HUM.an, kn = pcName(r.key.root, keyUsesFlats(r.key.root, r.key.minor)) + (r.key.minor ? ' minor' : ' major');
  const again = () => humApply(T.playing || true);
  const chips = h('div', { class: 'hum-chips', role: 'group', 'aria-label': 'Band style' }, Object.keys(HUM_STYLES).map(k => h('button', { class: 'btn sm' + (o.style === k ? ' on' : ''), title: HUM_STYLES[k].hint, 'aria-pressed': String(o.style === k), onclick: () => { o.style = k; again(); } }, k)));
  const tempo = h('input', { class: 'in hum-bpm', type: 'number', min: 50, max: 200, value: r.bpm, 'aria-label': 'Tempo in BPM', onchange: e => { o.bpm = clamp(+e.target.value || r.bpm, 50, 200); again(); } });
  const keySel = pSel(NS.map((n, i) => [i, n]), r.key.root, v => { o.key = +v; again(); }), modeSel = pSel([['maj', 'major'], ['min', 'minor']], r.key.minor ? 'min' : 'maj', v => { o.minor = v === 'min'; again(); });
  keySel.setAttribute('aria-label', 'Key'); modeSel.setAttribute('aria-label', 'Mode');
  const form = pSel(Object.entries(HUM_FORMS), o.form, v => { o.form = v; again(); }); form.setAttribute('aria-label', 'Song shape');
  const cv = h('canvas', { class: 'hum-roll', width: 600, height: 56, 'aria-label': 'The notes I heard', role: 'img' });
  d.append(
    h('div', { class: 'hum-row' }, h('button', { class: 'btn primary hum-play', id: 'humPlay', onclick: () => { if (T.playing) { stopPlay(true); } else humPlay(); } }, T.playing ? '■ Stop' : '▶ Play my song'),
      h('button', { class: 'btn', id: 'humHear', onclick: humHear }, HUM.hear ? '■ Stop' : '👂 Hear my hum'),
      h('button', { class: 'btn', id: 'humSave', title: 'Save your song, your hum or the parts to this device', onclick: e => humSaveMenu(e.currentTarget) }, '⤓ Save'),
      h('button', { class: 'btn', id: 'humVoice', title: 'Play your own recording along with the band, lined up with the melody. Turn it off to hear just the arrangement.', onclick: e => { const tk = TAKES.find(t => t.hum); if (!tk) return; tk.mute = !tk.mute; takeLive(tk); bus.emit('takes'); try { projSave(); } catch (x) { } e.currentTarget.textContent = tk.mute ? '🎤 My hum: off' : '🎤 My hum: on'; } }, (() => { const tk = TAKES.find(t => t.hum); return tk && tk.mute ? '🎤 My hum: off' : '🎤 My hum: on'; })()),
      h('button', { class: 'btn', id: 'humBand', title: 'Turn the drums, bass and rhythm guitar on or off. Your melody keeps playing.', onclick: e => { const on = !(S.band.drumsOn || S.band.bassOn || S.band.compOn); setRehearsal({ drumsOn: on, bassOn: on, compOn: on }); e.currentTarget.textContent = on ? '🥁 Band: on' : '🥁 Band: off'; } }, (S.band.drumsOn || S.band.bassOn || S.band.compOn) ? '🥁 Band: on' : '🥁 Band: off'),
      h('span', { class: 'hum-sum' }, h('b', {}, an.notes.length + ' notes'), ' · ', h('b', {}, kn), ' · ', h('b', {}, r.bpm + ' BPM'), ' · ', h('b', {}, totalBars() + ' bars')), h('span', { class: 'grow' }), x),
    h('div', { class: 'hum-msg' }, 'Your melody plays as the lead guitar. Chords, sections and the band were arranged from it. Change anything below and it re-builds right away.'),
    cv,
    h('div', { class: 'hum-grid' }, h('div', {}, h('div', { class: 'hum-l' }, 'STYLE'), chips), h('div', {}, h('div', { class: 'hum-l' }, 'TEMPO'), h('div', { class: 'row', style: { gap: '6px' } }, tempo, h('span', { class: 'muted small' }, 'BPM'))),
      h('div', {}, h('div', { class: 'hum-l' }, 'KEY'), h('div', { class: 'row', style: { gap: '6px' } }, keySel, modeSel)), h('div', {}, h('div', { class: 'hum-l' }, 'SONG SHAPE'), form)),
    h('div', { class: 'hum-row hum-acts' }, h('button', { class: 'btn', title: 'Same melody, different chords and a different chorus', onclick: () => { o.seed++; again(); } }, '🎲 Try different chords'),
      h('button', { class: 'btn', onclick: () => { humStageToggle(); } }, CAM.on ? '📷 Camera off' : '📷 Center stage'), h('span', { class: 'grow' }),
      h('button', { class: 'btn', onclick: () => { humBarClose(); sideShow('refine'); } }, '✎ Add lyrics'), h('button', { class: 'btn', onclick: () => { humBarClose(); vzImmersive(false); zoomSet('studio'); } }, '🎛 Open in the studio'),
      h('button', { class: 'btn primary', onclick: () => { humBarClose(); toast('Saved in My songs. Keep going: edit any chord, add lyrics, or record real guitar over it.', 'ok'); } }, 'Done')));
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, mel = r.melody, end = Math.max(16, ...mel.map(n => n.s + n.l)), lo = Math.min(...mel.map(n => n.m)), hi = Math.max(...mel.map(n => n.m)), span = Math.max(7, hi - lo + 1);
  g.fillStyle = getComputedStyle(document.body).getPropertyValue('--accent') || '#6fcf97'; g.globalAlpha = .9; mel.forEach(n => { const x0 = n.s / end * W, w = Math.max(3, n.l / end * W - 1), y = H - 6 - (n.m - lo) / span * (H - 12); g.fillRect(x0, y - 3, w, 6); });
}
async function humStageToggle() { await vzCenterStage(!CAM.on); if (HUM.bar && HUM.bar.dataset.mode === 'res') humBar('res'); }
bus.on('transport', () => { const b = document.getElementById('humPlay'); if (b) b.textContent = T.playing ? '■ Stop' : '▶ Play my song'; });
/* the studio opens on the stage (Visuals) the first time, then on whichever tab you used last */
bus.on('dock', id => { const c = typeof id === 'string' ? id : DOCK.cur; if (c && c !== CFG.startTab && document.getElementById('app') && !document.getElementById('boot')) { CFG.startTab = c; saveCfg(); } });

/* ============================================================
   Novice guitar coach: tune each string, learn the chords of the song one at a time, then play along.
   Listens through the audio engine (needs the guitar input). The song comes from the hum, or a friendly starter.
   ============================================================ */
const HUM_STARTER = ['G', 'Em', 'C', 'D'];
const fcents = (f, t) => 1200 * Math.log2(f / t);
const humStringHz = st => (CFG.a4 || 440) * Math.pow(2, (S.tuning[st] + S.capo - 69) / 12);
async function humGuitar() {
  try { if (typeof AK !== 'undefined') AK.killed = false; await startAudio(); const ok = CFG.inDev ? await openInput(CFG.inDev) : await pickInput(); await listDevices(); bus.emit('audiostate'); if (!ok) throw new Error('no input'); }
  catch (e) { return humBar('err', 'I could not hear a guitar input (' + (e.message || e.name) + '). Allow the microphone or plug in your interface, then try again. You can also hum instead.'); }
  if (!HUM.r) { const an = { notes: [{ t: 0, d: .4, m: 67 }], bpm: 84, key: { root: 7, minor: false }, dur: 1 }; HUM.an = an; HUM.o = { style: 'Folk', form: 'full', seed: 0, bpm: 84, key: 7, minor: false, title: 'My first song', verse: HUM_STARTER }; await humApply(false); }
  HUM.g = { step: 'tune', si: 0, ci: 0, hold: 0, done: [], seen: '', chords: humCoachChords() }; if (HUM.g.t) clearInterval(HUM.g.t); HUM.g.t = setInterval(humGuitarTick, 60); humBar('g');
}
function humCoachChords() { const sec = S.sections.find(s => /Verse/.test(s.name)) || S.sections[0], seen = [], out = []; sec.bars.forEach(b => b.chord.split(' ').filter(Boolean).forEach(c => { if (!seen.includes(c)) { seen.push(c); out.push(c); } })); return out.slice(0, 4); }
function humGuitarTick() {
  const g = HUM.g; if (!g || !HUM.bar || HUM.bar.dataset.mode !== 'g') { if (g) { clearInterval(g.t); } return; }
  const live = document.getElementById('gLive'), need = document.getElementById('gNeed'), fill = document.getElementById('gHold');
  if (g.step === 'tune') {
    const st = g.si, tf = humStringHz(st), f = AN.f0, ok = f > 0 && AN.clarity > .5 && AN.rms > -50, c = ok ? fcents(f, tf) : null, near = c != null && Math.abs(c) < 60;
    if (live) live.textContent = ok ? (humNoteName(AN.midi) + (near ? (c > 8 ? '  a bit high ▼' : c < -8 ? '  a bit low ▲' : '  ✓ in tune') : '  (not this string)')) : 'pluck the open string…';
    if (near && Math.abs(c) < 10) g.hold++; else g.hold = Math.max(0, g.hold - 1);
    if (fill) fill.style.width = Math.min(100, g.hold / 10 * 100) + '%';
    if (g.hold >= 10) { g.done[st] = true; g.hold = 0; if (g.si >= S.tuning.length - 1) { g.step = 'chords'; g.ci = 0; } else g.si++; toast('✓ ' + humNoteName(S.tuning[st] + S.capo), 'ok'); humBar('g'); }
  } else if (g.step === 'chords') {
    const sym = g.chords[g.ci], tc = parseChord(sym), top = (AN.chord || []).slice(0, 2), heard = top[0] ? top[0].sym : '', hit = AN.active && AN.rms > -45 && top.some(x => tc && x.root === tc.root && (x.q === tc.q || (x.q === '' && tc.q === 'maj') || (tc.q === '' && x.q === 'maj')));
    if (live) live.textContent = AN.active ? (heard ? 'I hear ' + heard : '…') : 'strum all the strings…';
    if (hit) g.hold++; else g.hold = Math.max(0, g.hold - 1); if (fill) fill.style.width = Math.min(100, g.hold / 8 * 100) + '%';
    if (g.hold >= 8) { g.hold = 0; toast('✓ ' + sym + '! Nice.', 'ok'); if (g.ci >= g.chords.length - 1) g.step = 'play'; else g.ci++; humBar('g'); }
  }
}
function humChordCanvas(sym) {
  const cv = h('canvas', { width: 150, height: 170, class: 'hum-chord', role: 'img', 'aria-label': 'How to play ' + sym }), g = cv.getContext('2d'), v = voicings(sym, S.tuning, S.capo, 1)[0]; if (!v) return cv;
  const col = getComputedStyle(document.body).getPropertyValue('--text') || '#ddd', acc = getComputedStyle(document.body).getPropertyValue('--accent') || '#6fcf97', fr = v.frets, fs = fr.filter(f => f > 0), lo = fs.length ? Math.min(...fs) : 1, base = Math.max(...fs, 0) > 4 ? lo : 1;
  const x0 = 24, y0 = 34, dx = 20, dy = 24; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.5; g.font = '12px sans-serif'; g.textAlign = 'center';
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x0 + i * dx, y0); g.lineTo(x0 + i * dx, y0 + 5 * dy); g.stroke(); }
  for (let j = 0; j <= 5; j++) { g.lineWidth = j === 0 && base === 1 ? 4 : 1.2; g.beginPath(); g.moveTo(x0, y0 + j * dy); g.lineTo(x0 + 5 * dx, y0 + j * dy); g.stroke(); }
  if (base > 1) { g.textAlign = 'left'; g.fillText(base + 'fr', x0 + 5 * dx + 6, y0 + dy * .7); g.textAlign = 'center'; }
  fr.forEach((f, i) => { const x = x0 + i * dx; if (f == null) g.fillText('×', x, y0 - 10); else if (f === 0) { g.beginPath(); g.arc(x, y0 - 13, 5, 0, 7); g.stroke(); } else { g.fillStyle = acc; g.beginPath(); g.arc(x, y0 + (f - base + .5) * dy, 8, 0, 7); g.fill(); g.fillStyle = col; } });
  return cv;
}
function humGuitarBar(d, x) {
  const g = HUM.g; if (!g) return;
  const head = (t) => h('div', { class: 'hum-row' }, h('b', { class: 'hum-hi' }, t), h('span', { class: 'grow' }), h('button', { class: 'btn sm', onclick: () => { clearInterval(g.t); humBar('start'); } }, 'Back'), x);
  if (g.step === 'tune') {
    const names = S.tuning.map((m, i) => humNoteName(m + S.capo));
    d.append(head('Step 1 · Tune your guitar'), h('div', { class: 'hum-msg' }, 'Pluck the ', h('b', {}, ['lowest (thickest)', '2nd', '3rd', '4th', '5th', 'highest (thinnest)'][g.si] + ' string, open'), '. Turn the tuning peg until it says in tune.'),
      h('div', { class: 'hum-strs' }, names.map((n, i) => h('span', { class: 'hum-str' + (i === g.si ? ' on' : '') + (g.done[i] ? ' ok' : '') }, g.done[i] ? '✓ ' + n : n))),
      h('div', { class: 'hum-row' }, h('b', { id: 'gNeed', class: 'hum-note' }, names[g.si]), h('div', { class: 'hum-lvw' }, h('i', { id: 'gHold' })), h('b', { id: 'gLive', class: 'hum-live' }, 'pluck the open string…'), h('span', { class: 'grow' }), h('button', { class: 'btn sm', onclick: () => { g.step = 'chords'; g.ci = 0; humBar('g'); } }, 'Skip tuning')));
  } else if (g.step === 'chords') {
    const sym = g.chords[g.ci];
    d.append(head('Step 2 · Learn your song’s chords (' + (g.ci + 1) + ' of ' + g.chords.length + ')'),
      h('div', { class: 'hum-row hum-chordrow' }, humChordCanvas(sym), h('div', { class: 'hum-ch' }, h('b', { class: 'hum-note', style: { fontSize: '44px' } }, sym), h('div', { class: 'hum-msg' }, 'Put your fingers on the dots, strum from the thickest string down to the thinnest, and let it ring. A × means skip that string; ○ means play it open.'),
        h('div', { class: 'hum-lvw' }, h('i', { id: 'gHold' })), h('b', { id: 'gLive', class: 'hum-live' }, 'strum all the strings…'))),
      h('div', { class: 'hum-row' }, h('button', { class: 'btn sm', onclick: () => { g.hold = 0; g.ci = Math.min(g.chords.length - 1, g.ci + 1); if (g.ci === g.chords.length - 1 && g.chords.length === 1) g.step = 'play'; humBar('g'); } }, 'Skip this chord'), h('button', { class: 'btn sm', onclick: () => { g.step = 'play'; humBar('g'); } }, 'I know these, play along')));
  } else {
    d.append(head('Step 3 · Play along'), h('div', { class: 'hum-msg' }, 'You know the chords: ', h('b', {}, g.chords.join('  ·  ')), '. The band will play your song. Strum one chord per bar and watch the chord name on the stage.'),
      h('div', { class: 'hum-row' }, h('button', { class: 'btn primary hum-play', onclick: () => { if (T.playing) stopPlay(true); else humPlay(); } }, T.playing ? '■ Stop' : '▶ Play the band'), h('button', { class: 'btn', onclick: () => { g.step = 'chords'; g.ci = 0; humBar('g'); } }, 'Practise the chords again'), h('span', { class: 'grow' }),
        h('button', { class: 'btn', onclick: () => { clearInterval(g.t); humBar('res'); } }, 'Change the song style'), h('button', { class: 'btn primary', onclick: () => { clearInterval(g.t); humBarClose(); } }, 'Done')));
  }
}
