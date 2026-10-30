/* ============================================================
   Part 05 · UI core: knobs, MIDI learn, header / transport, settings, help, shortcuts, status
   ============================================================ */
const KNOBS = new Map(), LEARN = { key: null }, UI = {};
function arc(r, a0, a1) {
  const p = a => [24 + r * Math.cos(a * Math.PI / 180), 24 + r * Math.sin(a * Math.PI / 180)], [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${(a1 - a0) > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
function mkKnob(o) {
  const lg = !!o.log, toN = x => lg ? Math.log(x / o.min) / Math.log(o.max / o.min) : (x - o.min) / (o.max - o.min), fromN = n => lg ? o.min * Math.pow(o.max / o.min, n) : o.min + n * (o.max - o.min);
  const track = sv('path', { class: 'k-t', d: arc(19, 135, 405) }), val = sv('path', { class: 'k-a', d: arc(19, 135, 136) }), cap = sv('circle', { class: 'k-cap', cx: 24, cy: 24, r: 13 }), ptr = sv('line', { class: 'k-p', x1: 24, y1: 24, x2: 24, y2: 14 });
  const svg = sv('svg', { viewBox: '0 0 48 48', class: 'knob-svg' }, track, val, cap, ptr), vl = h('div', { class: 'k-v' }), lb = h('div', { class: 'k-l', title: o.label }, o.label);
  const el = h('div', { class: 'knob', title: (o.title || o.label) + ' — drag, wheel, double-click to reset, right-click for MIDI learn' }, svg, vl, lb);
  const dec = o.step >= 1 ? 0 : o.step >= .1 ? 1 : 2; let v = o.def;
  const fmt = x => o.fmt ? o.fmt(x) : ((Math.abs(x) >= 1000 ? (x / 1000).toFixed(2) + 'k' : (Math.abs(x) >= 100 && lg ? x.toFixed(0) : x.toFixed(dec))) + (o.unit || ''));
  const draw = () => { const n = clamp(toN(v), 0, 1), a = 135 + 270 * n; val.setAttribute('d', arc(19, 135, Math.max(136, a))); const r = a * Math.PI / 180; ptr.setAttribute('x2', 24 + 10 * Math.cos(r)); ptr.setAttribute('y2', 24 + 10 * Math.sin(r)); vl.textContent = fmt(v); };
  const set = (x, silent) => { x = clamp(x, o.min, o.max); if (o.step && !lg) x = Math.round(x / o.step) * o.step; v = x; draw(); if (!silent && o.onChange) o.onChange(v); };
  let sy = 0, n0 = 0, drag = false;
  el.addEventListener('pointerdown', e => { if (e.button) return; drag = true; sy = e.clientY; n0 = toN(v); el.setPointerCapture(e.pointerId); e.preventDefault(); });
  el.addEventListener('pointermove', e => { if (!drag) return; set(fromN(clamp(n0 + (sy - e.clientY) / (e.shiftKey ? 600 : 170), 0, 1))); });
  el.addEventListener('pointerup', () => { drag = false; }); el.addEventListener('pointercancel', () => { drag = false; });
  el.addEventListener('wheel', e => { e.preventDefault(); set(fromN(clamp(toN(v) - Math.sign(e.deltaY) * (e.shiftKey ? .004 : .025), 0, 1))); }, { passive: false });
  el.addEventListener('dblclick', () => set(o.def));
  el.addEventListener('contextmenu', e => { e.preventDefault(); if (!o.key) return; KNOBS.forEach(k => k.el.classList.remove('learn')); if (LEARN.key === o.key) { LEARN.key = null; return; } LEARN.key = o.key; el.classList.add('learn'); toast('MIDI learn: move a controller to bind “' + o.label + '”'); initMIDI(); });
  const api = { el, set, get: () => v, setNorm: n => set(fromN(clamp(n, 0, 1))), def: o.def }; draw(); if (o.key) KNOBS.set(o.key, api); return api;
}
const MIDI = { access: null };
const MIDIHOOKS = [];
async function initMIDI() {
  if (MIDI.access || !navigator.requestMIDIAccess) return;
  try { const a = await navigator.requestMIDIAccess(); MIDI.access = a; const hook = () => a.inputs.forEach(i => { i.onmidimessage = onMidi; }); hook(); a.onstatechange = () => { hook(); bus.emit('midi'); }; CFG.midi = true; saveCfg(); bus.emit('midi'); }
  catch (e) { if (document.body.dataset.form && document.body.dataset.form !== 'desktop') console.warn('MIDI unavailable: ' + e.message); else toast('MIDI unavailable: ' + e.message, 'warn'); }
}
function onMidi(e) {
  const [st, d1, d2] = e.data, cmd = st & 0xf0;
  if (cmd === 0xB0) {
    if (LEARN.key) { CFG.midimap[d1] = LEARN.key; saveCfg(); toast('CC ' + d1 + ' → ' + LEARN.key, 'ok'); const k = KNOBS.get(LEARN.key); if (k) k.el.classList.remove('learn'); LEARN.key = null; bus.emit('midi'); return; }
    const key = CFG.midimap[d1]; if (key && KNOBS.get(key)) KNOBS.get(key).setNorm(d2 / 127);
  } else if (cmd === 0x90 && d2 > 0) { MIDIHOOKS.forEach(f => { try { f(d1, d2, st & 15); } catch (er) { console.warn(er); } }); }
  else if (cmd === 0xC0) { const p = allPresets()[d1]; if (p) { loadPreset(p); toast('Program ' + d1 + ': ' + p.n); } }
}

/* ---------- theme / appearance ---------- */
/* applyAppearance() and setTheme() live in 05b-look.js */

/* ---------- header & transport ---------- */
const barStr = p => { const sp = spb(), bs = 16 / S.ts[1], b = Math.floor(p / sp), s = p - b * sp; return (b + 1) + '·' + (Math.floor(s / bs) + 1) + '·' + (Math.floor(s % bs) + 1); };
function buildHeader() {
  const tr = $('#transport');
  const B = (cls, txt, title, fn) => h('button', { class: 'btn icon ' + cls, title, onclick: fn }, txt);
  UI.rew = B('', '⏮', 'Return to start (Home)', () => { if (T.playing) { stopPlay(true); T.cursor = 0; play(); } else { T.cursor = 0; bus.emit('transport'); } });
  UI.play = B('play', '▶', 'Play / pause (Space)', () => T.playing ? stopPlay(true) : play());
  UI.stop = B('', '⏹', 'Stop (returns to start position)', () => stopPlay(false));
  UI.rec = B('rec', '●', 'Record guitar take (R)', toggleRec);
  UI.loop = h('button', { class: 'btn sm', title: 'Loop (L)', onclick: () => { T.loop = !T.loop; syncTransport(); } }, '⟲', h('span', { class: 'lbl' }, ' Loop'));
  UI.metro = h('button', { class: 'btn sm', title: 'Metronome (M)', onclick: () => { T.metro = !T.metro; syncTransport(); } }, '♩', h('span', { class: 'lbl' }, ' Click'));
  UI.metroMore = h('button', { class: 'btn sm metro-more', title: 'Count-in and click volume', 'aria-label': 'Count-in and click volume', 'aria-haspopup': 'dialog', onclick: e => clickMenu(e.currentTarget) }, '▾');
  UI.pos = h('div', { class: 'lcd' }, h('b', {}, '1·1·1'), h('i', {}, 'BAR·BEAT·SLOT')); UI.tim = h('div', { class: 'lcd', style: { minWidth: '88px' } }, h('b', {}, '00:00.00'), h('i', {}, 'TIME'));
  UI.bpm = h('input', { type: 'number', min: 30, max: 260, step: 1, value: S.bpm, onchange: e => { S.bpm = clamp(+e.target.value || 90, 30, 260); e.target.value = S.bpm; commit(false); bus.emit('bpm'); } });
  UI.ts = h('select', { onchange: e => { const [n, d] = e.target.value.split('/').map(Number); S.ts = [n, d]; S.band.drumLen = Math.min(32, spb()); commit(); } }, ['4/4', '3/4', '2/4', '5/4', '6/8', '12/8', '7/8'].map(x => h('option', { value: x }, x)));
  UI.key = h('select', { onchange: () => keyChanged() }, NS.map((n, i) => h('option', { value: i }, n))); UI.mode = h('select', { onchange: () => keyChanged() }, [h('option', { value: 'maj' }, 'maj'), h('option', { value: 'min' }, 'min')]);
  tr.append(UI.rew, UI.play, UI.stop, UI.rec, UI.loop, UI.metro, UI.metroMore, UI.pos, UI.tim, h('label', { class: 'field', style: { width: '58px' } }, 'BPM', UI.bpm), h('label', { class: 'field', style: { width: '54px' } }, 'Sig', UI.ts), h('label', { class: 'field', style: { width: '56px' } }, 'Key', UI.key), h('label', { class: 'field', style: { width: '56px' } }, 'Mode', UI.mode));
  const R = $('#topR');
  UI.lat = h('span', { class: 'chip', title: 'Round-trip latency estimate. Run the Loopback Test in I/O for a measured value.' }, h('i', { class: 'led' }), h('span', {}, 'audio off'));
  UI.theme = h('button', { class: 'btn icon', title: 'Appearance: light / dark, palettes, accent, density…', 'aria-haspopup': 'dialog', onclick: () => lookOpen() }, '◐');
  R.append(mstChip(), audioButton(), UI.lat, UI.theme, h('button', { class: 'btn icon', title: 'Settings', 'aria-haspopup': 'dialog', onclick: () => openSettings() }, '⚙'), h('button', { class: 'btn icon', title: 'Help & shortcuts (?)', 'aria-haspopup': 'dialog', onclick: () => openHelp() }, '?'));
}
/** count-in and click volume, next to the Click button */
function clickMenu(anchor) {
  const box = h('div', { class: 'clkm' }, h('h5', {}, 'Click'), h('div', { class: 'lrow' }, h('span', { style: { width: '66px' } }, 'Count-in'), h('div', { class: 'seg', role: 'group', 'aria-label': 'Count-in bars' }, [[0, 'None'], [1, '1 bar'], [2, '2 bars'], [4, '4 bars']].map(([n, t]) => h('button', { class: CFG.countIn === n ? 'on' : '', onclick: e => { CFG.countIn = n; saveCfg(); $$('button', e.target.parentNode).forEach(b => b.classList.toggle('on', b === e.target)); } }, t)))),
    h('div', { class: 'lrow' }, h('span', { style: { width: '66px' } }, 'Volume'), h('input', { type: 'range', min: 0, max: 1, step: .05, value: CFG.metroVol == null ? .5 : CFG.metroVol, 'aria-label': 'Click volume', style: { flex: 1 }, oninput: e => { CFG.metroVol = +e.target.value; saveCfg(); } })),
    h('div', { class: 'tiny muted' }, 'The count-in plays before recording starts, so you can get your hands ready.'));
  popover(anchor, box, { style: { width: '270px' } });
}
function keyChanged() {
  S.key = +UI.key.value; S.minor = UI.mode.value === 'min'; if (/Major|Minor/.test(S.scale) || S.scale.startsWith('Natural')) S.scale = S.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)'; CFG.flats = keyUsesFlats(S.key, S.minor) ? true : false; saveCfg(); commit();
}
function toggleRec() {
  if (T.rec && T.playing) { stopPlay(true); return; }
  T.rec = !T.rec; if (T.rec && !E.hasInput) toast('Arming without an input: only the count-in will run. Open an input in I/O.', 'warn'); syncTransport();
  if (T.rec && !T.playing) play(true);
}
function syncTransport() {
  if (!UI.play) return; UI.play.textContent = T.playing ? '⏸' : '▶'; UI.play.classList.toggle('on', T.playing);
  UI.rec.classList.toggle('armed', T.rec && !T.playing); UI.rec.classList.toggle('on', T.rec && T.playing); UI.loop.classList.toggle('on', T.loop); UI.metro.classList.toggle('on', T.metro);
  UI.bpm.value = S.bpm; UI.ts.value = S.ts.join('/'); UI.key.value = S.key; UI.mode.value = S.minor ? 'min' : 'maj';
  if (UI.undo) { UI.undo.disabled = !histStack.u.length; UI.redo.disabled = !histStack.r.length; }
}
bus.on('transport', syncTransport); bus.on('song', syncTransport); bus.on('rec:state', syncTransport);

/* ---------- settings / help ---------- */
/** ⚙ Settings (part 05c's dialog). at: the section to open on */
function openSettings(at) {
  const close = () => { const d = $('#settings'); if (d) d.close(); };
  const F = (label, el) => h('label', { class: 'field' }, h('span', {}, label), el);
  const sel = (key, opts, cb) => h('select', { class: 'in', onchange: e => { const v = e.target.value; CFG[key] = isNaN(+v) || v === '' ? v : (key === 'hint' ? v : +v); saveCfg(); cb && cb(); } }, opts.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: String(CFG[key]) === String(v) }, t); }));
  const chk = (label, key, cb) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!CFG[key], onchange: e => { CFG[key] = e.target.checked; saveCfg(); cb && cb(); } }), label);
  const num = (key, min, max, step, cb) => h('input', { class: 'in', type: 'number', min, max, step, value: CFG[key], onchange: e => { CFG[key] = +e.target.value; saveCfg(); cb && cb(); } });
  const range = (key, min, max, step, cb) => h('input', { type: 'range', min, max, step, value: CFG[key], oninput: e => { CFG[key] = +e.target.value; saveCfg(); cb && cb(); } });
  const note = t => h('p', { class: 'hub-note' }, t);
  return hubOpen('settings', { ico: '⚙', title: 'Settings', sub: 'How the studio looks, sounds, records and keeps your work.', at, sections: [
    { key: 'look', label: 'Appearance', ico: '🎨', sub: 'Light or dark first, then a palette made for it.', body: () => [lookQuick(), h('button', { class: 'btn', id: 'setLook', onclick: () => { close(); lookOpen(); } }, '🎨 Looks, accent, density and type…')] },
    { key: 'work', label: 'Workflow', ico: '▦', sub: 'Where the studio starts and how it fits this device.', body: () => [
      F('Start in', routeControl()),
      F('Workspace', h('button', { class: 'btn', onclick: () => { close(); workspaceOpen(); } }, (goalNow() ? goalNow().ico + ' ' + goalNow().name : 'Choose a goal') + ' ▸')),
      F('Device layout', sel('form', [['auto', 'Auto (fit this device)'], ['phone', 'Phone'], ['tablet', 'Tablet'], ['desktop', 'Desktop']], () => applyForm())),
      chk('On-screen tab keypad on phones and tablets', 'kpad', () => mSync())] },
    { key: 'music', label: 'Music', ico: '♪', sub: 'Tuning reference, note names and the fretboard.', body: () => [
      F('Reference pitch A4 (Hz)', num('a4', 415, 466, .1, () => bus.emit('song'))),
      F('Accidentals', sel('flats', [[false, 'Sharps (C#)'], [true, 'Flats (Db)']], () => { CFG.flats = String(CFG.flats) === 'true'; saveCfg(); bus.emit('song'); })),
      F('Fretboard labels', sel('fretNames', [['notes', 'Note names'], ['degrees', 'Scale degrees'], ['frets', 'Fret numbers']], () => bus.emit('fret'))),
      chk('Left-handed fretboard', 'left', () => bus.emit('fret'))] },
    { key: 'audio', label: 'Audio engine', ico: '🔊', sub: 'Latency and analysis. Restart the engine to apply the first two.', body: () => [
      F('Latency hint', sel('hint', [['interactive', 'interactive (lowest)'], ['balanced', 'balanced'], ['playback', 'playback'], ['0', '0 (request minimum)']])),
      F('Sample rate', sel('sr', [['auto', 'Device default'], ['44100', '44.1 kHz'], ['48000', '48 kHz'], ['96000', '96 kHz']])),
      F('Analyzer FFT size', sel('fft', [2048, 4096, 8192, 16384, 32768], () => { if (E.ready) { E.anaRig.fftSize = E.anaMaster.fftSize = CFG.fft; } })),
      F('Analyzer smoothing', range('smooth', 0, .95, .01, () => { if (E.ready) E.anaRig.smoothingTimeConstant = E.anaMaster.smoothingTimeConstant = CFG.smooth; })),
      h('div', { class: 'hub-acts' }, h('button', { class: 'btn', onclick: () => { close(); restartAudio(); } }, '↻ Restart audio engine'), note('Needed after changing the latency hint, sample rate or output routing.'))] },
    { key: 'rec', label: 'Recording & practice', ico: '●', sub: 'Count-in, the click and what a take keeps.', body: () => [
      F('Count-in (bars)', sel('countIn', [0, 1, 2, 4])),
      F('Metronome level', range('metroVol', 0, 1, .05)),
      F('Humanize (timing/velocity)', range('humanize', 0, 1, .05)),
      F('Timing analysis grid', sel('timingGrid', [[4, '16th notes'], [2, '8th notes'], [1, 'Quarter notes']])),
      F('When recording reaches the end of the song', sel('recEnd', [['grow', 'Keep going (the song grows to fit)'], ['stop', 'Stop at the end'], ['loop', 'Loop back, one take per pass']])),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!CFG.rec.dry, onchange: e => { CFG.rec.dry = e.target.checked; saveCfg(); } }), 'Record dry DI (enables re-amping)'),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!CFG.rec.wet, onchange: e => { CFG.rec.wet = e.target.checked; saveCfg(); } }), 'Record wet print')] },
    { key: 'export', label: 'Export', ico: '⇩', sub: 'Song bounces, tab text and an automatic backup folder.', body: () => [
      F('Loudness target for song WAVs', sel('lufsTarget', LOUD_TARGETS)),
      chk('Render WAVs faster than real time', 'renderFast'), note('Mixes the song in a few seconds instead of playing it through. Turn this off if a render ever sounds different from playback.'),
      F('Ultimate Guitar line width (chars)', num('ugWidth', 40, 120, 1, () => bus.emit('export'))), chk('Include [tab] / [ch] tags in Ultimate Guitar text', 'ugTags', () => bus.emit('export')),
      F('Backup folder', syncControl())] },
    { key: 'data', label: 'Songs & data', ico: '☰', sub: 'Everything stays in this browser. Nothing is uploaded.', body: () => [
      F('Backing track when a song opens', sel('trackRestore', [['auto', 'Restore it automatically'], ['tap', 'Wait until I tap Restore']])),
      note('Songs and recordings are kept in this browser (My songs). Stems are separated again when a song with a track opens; the song itself opens instantly.'),
      h('div', { class: 'hub-acts' }, h('button', { class: 'btn', onclick: () => { close(); libraryOpen(); } }, '☰ My songs'), h('button', { class: 'btn', onclick: () => { close(); progressOpen(); } }, '📈 My progress'), h('button', { class: 'btn', onclick: () => download('daily-songs-settings.json', JSON.stringify(CFG, null, 2), 'application/json') }, 'Export settings JSON'), h('button', { class: 'btn bad', title: 'Choose what to erase: layout, settings, songs, offline copy…', onclick: () => { close(); resetOpen(); } }, 'Reset…'))] }
  ] });
}
/** ? Help (part 05c's dialog) */
function openHelp(at) {
  const K = [['Space', 'Play / stop'], ['Ctrl + .', 'KILL AUDIO: stop playback, monitor off, release the microphone, suspend audio'], ['R', 'Record: one press, one take. It keeps going past the end of the song until you press R or Stop again'], ['L / M', 'Loop / metronome'], ['D · B · G · T', 'Band on/off: drums · bass · rhythm guitar · lead tab'], ['1…8 · 0', 'Recall pedalboard scene (Stage scene when Stage is focused) · 0 = all pedals off'], ['Home', 'Return to start'], ['Ctrl/⌘ Z · Shift+Z', 'Undo / redo: song edits, clips and the stem mix share one history'], ['Ctrl/⌘ E · D · Del', 'Selected clip: split at the playhead · duplicate · delete. ← → nudge a beat (Shift = a bar). Hold Alt while dragging for no snapping'], ['Drop a file', 'Audio, lyrics, MIDI (.mid, .kar) or a song file anywhere on the page'], ['Ctrl/⌘ S', 'Save project JSON'], ['Alt + 1…9, 0', 'Switch panel by position (tab order is yours to arrange)'], ['[ ]', 'Toggle left / right sidebars'],
    ['Tab editor', 'Click a cell · type fret (0–24) · ←→↑↓ move · Del clear · h p / \\ b ~ x < set technique · Shift+arrows select · Space plays from bar'], ['Knobs', 'Drag · wheel · Shift = fine · double-click reset · right-click = MIDI learn'], ['Rig', 'Drag pedal headers to reorder the signal chain · A/B + Morph to compare tones']];
  const close = () => { const d = $('#help'); if (d) d.close(); };
  return hubOpen('help', { ico: '?', title: 'Help', sub: 'Get going, find a shortcut, or read how the studio treats your work.', at, sections: [
    { key: 'start', label: 'Get started', ico: '✦', sub: 'Short tasks that teach by doing, or a two-minute spotlight walkthrough.', wide: true, body: () => [
      h('div', { class: 'hub-tiles' },
        h('button', { class: 'hub-tile primary', id: 'helpSessions', onclick: () => { close(); guideMenu(); } }, h('b', {}, '✦ Guided sessions'), h('span', {}, 'Play with a band, write a riff down, hum a song, loop and layer…')),
        h('button', { class: 'hub-tile', id: 'helpTour', onclick: () => { close(); tourStart(); } }, h('b', {}, '▶ Take the guided tour'), h('span', {}, 'A spotlight on each part of the screen.')),
        h('button', { class: 'hub-tile', onclick: () => { close(); workspaceOpen(); } }, h('b', {}, '▦ Pick a workspace'), h('span', {}, 'Songwriter, Performer, Creator Studio, Practice, Teacher or Full Rig.')))] },
    { key: 'keys', label: 'Shortcuts', ico: '⌨', wide: true, body: () => [h('div', { class: 'help-k' }, K.map(([a, b]) => [h('kbd', {}, a), h('span', {}, b)]))] },
    { key: 'data', label: 'Your work', ico: '🔒', sub: 'Local, private, kept on this device.', wide: true, body: () => [
      h('p', { class: 'small' }, 'Everything runs locally in your browser. Nothing is uploaded. Your work is autosaved to this browser: songs, recordings and backing tracks stay on this device (☰ Songs).'),
      h('p', { class: 'small muted' }, 'For a copy you can keep anywhere, use ☰ Songs → All songs → Back up all songs (one zip with everything, which Open a file brings back), or save one song as a bundle. On an iPhone or iPad, add the site to the Home Screen so Safari keeps your songs.')] },
    { key: 'audio', label: 'Latency', ico: '⏱', wide: true, body: () => [h('p', { class: 'small muted' }, 'Browsers cannot talk to ASIO drivers, so achievable latency depends on your OS audio stack. Use the Loopback Test (I/O panel) for a measured number, and your interface’s direct monitor for latency-free headphone monitoring while recording.')] },
    { key: 'about', label: 'About', ico: '♥', wide: true, body: () => [aboutBlock()] }
  ] });
}

/* ---------- status bar ---------- */
function buildStatus() { const s = $('#status'); UI.st = { a: h('span'), i: h('span'), r: h('span'), m: h('span'), f: h('span') }; s.append(UI.st.a, UI.st.i, UI.st.r, h('span', { class: 'sp' }), UI.st.m, UI.st.f); }
let fpsN = 0, fpsT = 0, FPS = 0;
function updateStatus() {
  if (!UI.st) return; const L = latencyInfo();
  if (L) {
    UI.st.a.textContent = 'AUDIO ' + L.state + ' · ' + (L.sr / 1000).toFixed(1) + ' kHz · out ' + (L.base + L.out).toFixed(1) + ' ms' + (E.worklet ? ' · worklet' : ' · fallback');
    UI.st.i.textContent = E.hasInput ? 'IN ' + ((E.devs.in.find(d => d.deviceId === CFG.inDev) || {}).label || 'device').slice(0, 34) + ' · ' + ((E.inSettings && E.inSettings.channelCount) || '?') + 'ch' : 'IN none';
    const ch = UI.lat.firstChild; ch.className = 'led ' + (E.ctx.state === 'running' ? (L.est < 25 ? 'on' : 'warn') : 'bad'); UI.lat.lastChild.textContent = (CFG.rtt != null ? 'RTT ' + CFG.rtt.toFixed(1) + ' ms (measured)' : '≈' + L.est.toFixed(0) + ' ms est.');
  } else { UI.st.a.textContent = 'AUDIO off — press Power on'; UI.st.i.textContent = ''; }
  UI.st.r.textContent = 'RIG ' + RIG.cur; UI.st.m.textContent = (MIDI.access ? 'MIDI ' + MIDI.access.inputs.size + ' in' : 'MIDI off') + (LEARN.key ? ' · LEARN ' + LEARN.key : ''); UI.st.f.textContent = FPS + ' fps';
}

/* ---------- global shortcuts ---------- */
document.addEventListener('keydown', e => {
  const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); exportProject(); return; }
  if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
  if (e.altKey && /^[0-9]$/.test(e.key)) { e.preventDefault(); const t2 = dockVisible()[e.key === '0' ? 9 : +e.key - 1]; if (t2) { FLOATS.has(t2[0]) ? floatFront(t2[0]) : dockGo(t2[0]); } return; }
  if (!typing && (TKSEL.id || TKR.on) && !(t && t.closest && t.closest('dialog,.pop')) && (document.activeElement === document.body || (UI.tls && UI.tls.contains(document.activeElement)) || (document.activeElement && document.activeElement.closest && document.activeElement.closest('.clipbar')))) {
    if (TKR.on && !mod && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); tkrApply(true); return; }
    if (TKR.on && e.key === 'Escape') { e.preventDefault(); tkrClear(); return; }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); tkDup(); return; }
    if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); tkSplit(); return; }
    if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); tkDelete(); return; }
    if (!mod && !e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && UI.tls && document.activeElement === UI.tls) { e.preventDefault(); tkNudge(null, (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? S.ts[0] : 1)); return; }
  }
  if (typing || mod) return;
  if (t && t.classList && t.classList.contains('tcell')) return;
  switch (e.key) {
    case ' ': e.preventDefault(); T.playing ? stopPlay(true) : play(); break;
    case 'r': case 'R': toggleRec(); break; case 'l': case 'L': T.loop = !T.loop; syncTransport(); break; case 'm': case 'M': T.metro = !T.metro; syncTransport(); break;
    case 'Home': UI.rew.click(); break; case '?': openHelp(); break;
    case '[': toggleSide('left'); break; case ']': toggleSide('right'); break;
    case 'd': case 'D': toggleBand('drumsOn'); break; case 'b': case 'B': toggleBand('bassOn'); break; case 'g': case 'G': toggleBand('compOn'); break; case 't': case 'T': toggleBand('leadOn'); break;
    case '0': if (typeof stageOwnsKeys === 'function' && stageOwnsKeys()) { shBlackout(); break; } if (typeof boardKey === 'function') boardKey('0'); break; case '9': if (typeof stageOwnsKeys === 'function' && stageOwnsKeys()) { shFreeze(); break; } if (typeof boardKey === 'function') boardKey('9'); break; case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': if (typeof digitKey === 'function') digitKey(+e.key); break;
    default: if (typeof boardKey === 'function') boardKey(e.key);
  }
});
