/* ============================================================
   Part 06 · dock framework, left sidebar (Tones / I-O / Theory), Rig pane, right sidebar (tuner, meters, live analysis)
   ============================================================ */
const DOCK = [['rig', 'Rig'], ['tab', 'Write'], ['song', 'Song'], ['band', 'Band'], ['fret', 'Fretboard'], ['vis', 'Visuals'], ['stage', 'Stage'], ['neural', 'Neural'], ['stems', 'Stems'], ['tx', 'Transcribe'], ['cam', 'Vision'], ['lab', 'Research'], ['exp', 'Export']];
const paneVisible = id => DOCK.cur === id || (typeof FLOATS !== 'undefined' && FLOATS.has(id)) || (typeof sideVisible === 'function' && sideVisible(id));
/* Song and Fretboard are part of Write now (63-write.js); they stay as panels, reachable from Write, and join the strip only when asked for (CFG.sepTabs) */
const MERGED = ['song', 'fret'];
const dockVisible = () => DOCK.filter(d => !(typeof LAY !== 'undefined' && LAY.hidden.includes(d[0])) && !(MERGED.includes(d[0]) && !CFG.sepTabs && DOCK.cur !== d[0] && !(typeof FLOATS !== 'undefined' && FLOATS.has(d[0]))) && !(typeof sideHosted === 'function' && sideHosted(d[0])) && (typeof xpAllowed !== 'function' || xpAllowed(d[0])));
const PANES = {}, SEL = { sec: 0, bar: 0 };
function buildDock() {
  const dock = $('#dock'), tabs = h('div', { class: 'tabs' });
  DOCK.forEach(([id, name], i) => { tabs.append(h('button', { class: 'tab', 'data-id': id, onclick: () => dockGo(id) }, (i + 1) + ' · ' + name)); PANES[id] = h('div', { class: 'pane', id: 'pane-' + id }); });
  dock.append(tabs, ...Object.values(PANES));
}
function dockGo(id) { if (typeof sideHosted === 'function' && sideHosted(id)) { sideShow(id); return; } DOCK.cur = id; $$('#dock .tab').forEach(t => t.classList.toggle('on', t.dataset.id === id)); { const a = $('#dock .tab.on'); if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } Object.entries(PANES).forEach(([k, p]) => { if (typeof sideHosted === 'function' && sideHosted(k)) return; p.classList.toggle('on', k === id); }); bus.emit('dock', id); }
const allPresets = () => PRESETS.concat(store.get('presets', []).map(p => ({ ...p, c: 'User' })));
function usePreset(p) { if (!E.ready) { UI.pending = p; RIG.cur = p.n; toast('Preset “' + p.n + '” will load when audio starts'); return; } loadPreset(p); }
bus.on('audio:ready', () => { const p = UI.pending || PRESETS[0]; UI.pending = null; setTimeout(() => { loadPreset(p); syncPedals(); }, 30); });

/* ---------- left sidebar ---------- */
function buildLeft() {
  const L = $('#left'), names = [['tones', 'Tones'], ['io', 'I/O'], ['theory', 'Theory']], tabs = h('div', { class: 'side-tabs' }), panes = {};
  const first = 'io';   // input settings first: that is where sound and camera get switched on (the sidebar framework keeps your last choice)
  names.forEach(([id, n]) => { tabs.append(h('button', { class: 'tab' + (id === first ? ' on' : ''), 'data-id': id, onclick: () => { $$('.tab', tabs).forEach(t => t.classList.toggle('on', t.dataset.id === id)); Object.entries(panes).forEach(([k, p]) => p.classList.toggle('on', k === id)); } }, n)); panes[id] = h('div', { class: 'pane' + (id === first ? ' on' : '') }); });
  L.append(tabs, ...Object.values(panes));
  buildTones(panes.tones); buildIO(panes.io); buildTheory(panes.theory);
}
function buildTones(p) {
  UI.tcat = 'All'; UI.tq = h('input', { class: 'in', placeholder: 'Search tones…', oninput: renderTones, style: { fontFamily: 'var(--sans)' } });
  const cats = ['All', 'Clean', 'Acoustic', 'Crunch', 'Lead', 'Heavy', 'Funk', 'Psych', 'Ambient', 'Lo-Fi', 'User'], cw = h('div', { class: 'cats' });
  cats.forEach(c => cw.append(h('button', { class: 'cat' + (c === 'All' ? ' on' : ''), onclick: e => { UI.tcat = c; $$('.cat', cw).forEach(x => x.classList.remove('on')); e.target.classList.add('on'); renderTones(); } }, c)));
  UI.tlist = h('div', { class: 'plist' }); p.append(UI.tq, cw, UI.tlist); renderTones(); bus.on('preset', renderTones);
}
function renderTones() {
  const q = UI.tq.value.toLowerCase(), l = UI.tlist; l.innerHTML = '';
  allPresets().forEach((p, i) => {
    if (UI.tcat !== 'All' && p.c !== UI.tcat) return; if (q && !(p.n + ' ' + (p.d || '') + ' ' + p.c).toLowerCase().includes(q)) return;
    const it = h('button', { class: 'pitem' + (RIG.cur === p.n ? ' on' : ''), onclick: () => usePreset(p) }, h('b', {}, p.n, p.c === 'User' ? h('span', { style: { float: 'right', cursor: 'pointer', color: 'var(--bad)' }, title: 'Delete preset', onclick: e => { e.stopPropagation(); const a = store.get('presets', []).filter(x => x.n !== p.n); store.set('presets', a); renderTones(); } }, '✕') : null), h('span', {}, p.c + ' · ' + (p.d || '')));
    l.append(it);
  });
  if (!l.children.length) l.append(h('div', { class: 'muted small', style: { padding: '8px' } }, 'No tones match.'));
}
function buildIO(p) {
  UI.outSel = h('select', { class: 'in', 'aria-label': 'Audio output device', onchange: e => setOutputDevice(e.target.value) });
  const trim = mkKnob({ key: 'trim', label: 'Input Trim', min: -24, max: 36, def: 0, step: .5, unit: ' dB', onChange: v => { CFG.gTrim = v; saveCfg(); if (E.ready) tc(E.inTrim.gain, fromDB(v), .02); } }); trim.set(CFG.gTrim || 0, true);
  UI.lat2 = h('div', { class: 'kv' }); UI.latRes = h('div', { class: 'small muted' }, 'Not measured yet.');
  const offs = h('input', { class: 'in', type: 'number', step: .1, style: { width: '80px' }, value: CFG.rtt != null ? CFG.rtt : '', placeholder: 'auto', onchange: e => { CFG.rtt = e.target.value === '' ? null : +e.target.value; saveCfg(); } });
  bus.on('latency', r => { UI.latRes.textContent = 'Measured ' + r.m.toFixed(2) + ' ms · σ ' + r.s.toFixed(2) + ' ms · n=' + r.n; offs.value = CFG.rtt; });
  UI.midiList = h('div', { class: 'small muted' }, 'MIDI not enabled.'); bus.on('midi', renderMidi);
  // 1 · connect (device, level, signal path) — the same component the header Audio panel, Perform and Stage use
  const conn = h('div', { class: 'card io-card', id: 'ioConn' }, h('h4', {}, 'Audio input'), h('div', { class: 'card-b' }, ioConnectEl(), h('div', { class: 'row', style: { marginTop: '8px', justifyContent: 'center' } }, trim.el)));
  const outCard = h('div', { class: 'card' }, h('h4', {}, 'Audio output'), h('div', { class: 'card-b' }, UI.outSel, h('div', { class: 'row', style: { marginTop: '6px', gap: '8px' } }, h('button', { class: 'btn sm', onclick: () => ioTestSound() }, '🔊 Test sound')), h('div', { class: 'muted tiny', style: { marginTop: '6px' } }, 'Choosing an output device needs a recent Chromium browser (Chrome, Edge); other browsers use the system output.')));
  const midiCard = h('div', { class: 'card' }, h('h4', {}, 'MIDI controllers'), h('div', { class: 'card-b' }, UI.midiList, h('div', { class: 'row', style: { marginTop: '6px' } }, h('button', { class: 'btn sm', onclick: initMIDI }, 'Enable MIDI')), h('p', { class: 'tiny muted' }, 'Right-click any knob, then move a CC to bind it (wah pedal, whammy, faders…). Program Change selects tones.')));
  // 2 · everything you only need when something is wrong or you want to measure
  const adv = h('details', { class: 'io-adv', id: 'ioAdv' }, h('summary', {}, 'Advanced & troubleshooting'),
    h('div', { class: 'card' }, h('h4', {}, 'Diagnose devices'), h('div', { class: 'card-b' }, h('p', { class: 'tiny muted', style: { margin: '0 0 6px' } }, 'Checks the secure context, permissions and what the browser can see. Use it when no input shows up.'), UI.diag = h('pre', { class: 'tiny', style: { whiteSpace: 'pre-wrap', margin: '0 0 6px', padding: '6px', border: '1px dashed var(--line2)', borderRadius: '6px', display: 'none', font: '600 10px/1.45 var(--mono)' } }), h('button', { class: 'btn sm', onclick: () => diagnoseInputs(true) }, '🩺 Diagnose devices'))),
    h('div', { class: 'card' }, h('h4', {}, 'Latency lab'), h('div', { class: 'card-b' }, UI.lat2, h('div', { class: 'hr' }), h('button', { class: 'btn sm primary', onclick: measureRTT }, '⏱ Run loopback test'), h('div', { style: { height: '6px' } }), UI.latRes, h('div', { class: 'row', style: { marginTop: '6px' } }, h('span', { class: 'small' }, 'RTT used for alignment (ms):'), offs), h('p', { class: 'tiny muted' }, 'Patch a cable from the interface’s Line Out into an input (or hold a mic near a speaker). The test emits six 8 ms chirps and cross-correlates them to find the true round trip. That value shifts recorded takes so they land on the grid, and corrects timing statistics.'))),
    h('div', { class: 'card' }, h('h4', {}, 'Focusrite / low-latency notes'), h('div', { class: 'card-b tiny muted' }, h('p', { style: { margin: '0 0 6px' } }, 'Browsers can’t use ASIO. Chrome/Edge on Windows use WASAPI, macOS uses CoreAudio. Set the smallest stable buffer in Focusrite Control (Windows) / the interface’s driver panel.'), h('p', { style: { margin: '0 0 6px' } }, 'Plug the guitar into the front Inst jack (Input 1 or 2). Press Set my level and play. Keep the peaks around −12 to −6 dBFS.'), h('p', { style: { margin: 0 } }, 'For zero-latency monitoring, turn on the interface’s Direct Monitor and leave Hear myself off here: recording and analysis still work.'))));
  p.append(conn, outCard, midiCard, adv);
  const camCard = h('div', { class: 'card' }, h('h4', {}, 'Camera'), h('div', { class: 'card-b' },
    UI.camSel2 = h('select', { class: 'in', 'aria-label': 'Camera', style: { fontFamily: 'var(--sans)' }, onchange: e => { CFG.camDev = e.target.value; saveCfg(); if (CAM.on) startCam(); } }),
    h('div', { class: 'row', style: { marginTop: '6px' } }, h('button', { class: 'btn sm' + (VZ.cam ? ' on' : ''), id: 'ioCamBtn', onclick: () => vzCamPress() }, '📷 Camera backdrop')),
    h('div', { class: 'tiny muted', style: { marginTop: '4px' } }, 'Puts you in front of the hexagons. The picture stays on this device.'),
    h('div', { class: 'row', style: { marginTop: '8px', gap: '8px', flexWrap: 'wrap' } }, h('span', { class: 'tiny muted' }, 'Start in'), routeControl())));
  p.insertBefore(camCard, outCard); refreshCamList();
  bus.on('devices', renderDevices); bus.on('input', renderDevices); buildVoxCard(p);
}
function renderDevices() {
  refreshCamList();
  const fill = (sel, list, cur, none) => { if (!sel) return; sel.innerHTML = ''; if (!list.length) sel.append(h('option', { value: '' }, none)); list.forEach((d, i) => sel.append(h('option', { value: d.deviceId, selected: d.deviceId === cur }, d.label || ('Output ' + (i + 1))))); };
  fill(UI.outSel, E.devs.out, CFG.outDev, 'Default output');
  const L = latencyInfo(), s = E.inSettings;
  if (!UI.lat2) return; UI.lat2.innerHTML = ''; const kv = (a, b) => UI.lat2.append(h('span', {}, a), h('span', {}, b));
  if (L) { kv('Sample rate', (L.sr / 1000).toFixed(1) + ' kHz'); kv('Render block', L.block.toFixed(2) + ' ms'); kv('Base latency', L.base.toFixed(1) + ' ms'); kv('Output latency', L.out ? L.out.toFixed(1) + ' ms' : 'n/a'); kv('Input latency', L.inp != null ? L.inp.toFixed(1) + ' ms' : 'n/a'); kv('Estimated RTT', L.est.toFixed(1) + ' ms'); kv('Channels', s ? s.channelCount || '?' : '—'); kv('AEC/NS/AGC', s ? [s.echoCancellation, s.noiseSuppression, s.autoGainControl].map(x => x ? 'on' : 'off').join(' / ') : '—'); }
}
function renderMidi() {
  const l = UI.midiList; l.innerHTML = ''; if (!MIDI.access) return; const ins = [...MIDI.access.inputs.values()]; l.append(ins.length ? ins.map(i => h('div', {}, '● ' + i.name)) : 'No MIDI inputs found.');
  const m = Object.entries(CFG.midimap); if (m.length) l.append(h('div', { class: 'tiny', style: { marginTop: '6px' } }, m.map(([cc, k]) => h('div', {}, 'CC' + cc + ' → ' + k + ' ', h('a', { href: '#', onclick: e => { e.preventDefault(); delete CFG.midimap[cc]; saveCfg(); renderMidi(); } }, '✕')))));
}
async function diagnoseInputs(show) {
  const L = [], ok = (n, v, bad) => L.push((bad ? '✕ ' : '✓ ') + n + ': ' + v);
  const md = navigator.mediaDevices, framed = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  ok('Secure context (https/localhost)', window.isSecureContext ? 'yes' : 'NO', !window.isSecureContext); ok('Embedded in a frame', framed ? 'YES — browsers often block mic/camera here' : 'no', framed);
  try { const pp = document.permissionsPolicy || document.featurePolicy; if (pp && pp.allowsFeature) ok('Page allowed to use microphone', pp.allowsFeature('microphone') ? 'yes' : 'NO — the host frame blocks it', !pp.allowsFeature('microphone')); } catch (e) { }
  try { const q = await navigator.permissions.query({ name: 'microphone' }); ok('Microphone permission', q.state, q.state === 'denied'); } catch (e) { L.push('· microphone permission state not readable here'); }
  let probe = null;
  if (md && md.getUserMedia && !E.hasInput) { try { probe = await md.getUserMedia({ audio: true }); ok('Asking the browser for the microphone now', 'ALLOWED (' + ((probe.getAudioTracks()[0] || {}).label || 'device') + ')'); } catch (e) { ok('Asking the browser for the microphone now', e.name + (e.message ? ' — ' + e.message : ''), true); L.push(e.name === 'NotAllowedError' ? '→ Blocked or dismissed. Click the lock/tune icon left of the address bar → Microphone → Allow, then reload. Also check Windows Settings → Privacy & security → Microphone (apps + desktop apps allowed).' : e.name === 'NotFoundError' ? '→ The browser sees NO capture device. Check Windows Settings → System → Sound → Input (is the Focusrite listed and enabled?) and that no other app holds it exclusively.' : '→ ' + e.name); } }
  if (!md || !md.enumerateDevices) ok('mediaDevices API', 'MISSING', true);
  else { try { const d = await md.enumerateDevices(), a = d.filter(x => x.kind === 'audioinput'), o = d.filter(x => x.kind === 'audiooutput'); ok('Audio inputs / outputs listed', a.length + ' / ' + o.length, !a.length); if (a.length && a.every(x => !x.label)) L.push('✕ Device names hidden → microphone permission has not been granted to this page'); a.slice(0, 8).forEach(x => L.push('   · ' + (x.label || '(unnamed)'))); } catch (e) { ok('enumerateDevices', e.name + ' ' + e.message, true); } }
  if (probe) probe.getTracks().forEach(t => t.stop());
  if (E.lastInErr) L.push('✕ Last input error: ' + E.lastInErr);
  L.push('· ' + navigator.userAgent.replace(/\(.*?\)/, '').slice(0, 90));
  if (show !== false && UI.diag) { UI.diag.style.display = 'block'; UI.diag.textContent = L.join('\n'); }
  if (framed) toast('This page is running inside a frame, which usually blocks audio devices. Open it in its own browser tab (CodePen: Change View → Full Page / Debug).', 'warn');
  return L;
}
async function refreshInputs() {
  try { if (!E.hasInput) { const t = await navigator.mediaDevices.getUserMedia({ audio: true }); t.getTracks().forEach(x => x.stop()); } } catch (e) { toast('Microphone permission is blocked for this page — allow it in the address-bar site settings (CodePen: use Full Page view).', 'bad'); }
  await listDevices(); renderDevices(); if (!E.devs.in.length || E.devs.in.every(d => !d.label)) diagnoseInputs(true); const fr = E.devs.in.find(d => /focusrite|scarlett|clarett|vocaster/i.test(d.label || ''));
  if (!E.hasInput) { await startAudio(); await openInput(fr ? fr.deviceId : CFG.inDev || ''); await listDevices(); } renderDevices(); toast(E.devs.in.length + ' input device(s) found', 'ok');
}
async function restartAudio() {
  if (!E.ctx) return; toast('Restarting audio engine…'); stopPlay(true); const dev = CFG.inDev; UI.pending = { n: RIG.cur, u: rigSnapshot().u };
  try { if (E.stream) E.stream.getTracks().forEach(t => t.stop()); await E.ctx.close(); } catch (e) { }
  Object.assign(E, { ctx: null, ready: false, hasInput: false, src: null, split: null, tr: {}, pl: null }); RIG.units = {}; KNOBS.forEach((k, key) => { });
  await startAudio(); if (dev) await openInput(dev); if (CFG.outDev) setOutputDevice(CFG.outDev); toast('Audio engine restarted', 'ok');
}
function buildTheory(p) {
  const kSel = h('select', { class: 'in', onchange: e => { S.key = +e.target.value; commit(); } }, NS.map((n, i) => h('option', { value: i }, n)));
  const sSel = h('select', { class: 'in', onchange: e => { S.scale = e.target.value; commit(); } }, Object.keys(SCALES).map(n => h('option', { value: n }, n)));
  const tSel = h('select', { class: 'in', onchange: e => { const v = e.target.value; if (v === '__custom') { bus.emit('open-tuning-editor'); tSel.value = S.tuningName; return; } setTuning(TUNINGS[v], v); } });
  const tSelFill = () => { tSel.innerHTML = ''; const ns = Object.keys(TUNINGS); if (!TUNINGS[S.tuningName]) ns.unshift(S.tuningName); ns.forEach(n => tSel.append(h('option', { value: n }, n))); tSel.append(h('option', { value: '__custom' }, 'Custom tuning… (set each string)')); tSel.value = S.tuningName; }; tSelFill();
  const cap = h('input', { class: 'in', type: 'number', min: 0, max: 12, value: S.capo, style: { width: '60px' }, onchange: e => { S.capo = clamp(+e.target.value | 0, 0, 12); commit(); } });
  const info = h('div', { class: 'small', style: { marginTop: '6px' } }), pal = h('div', { class: 'pal' });
  const pr = h('select', { class: 'in' }, PROGS.map(([n], i) => h('option', { value: i }, n)));
  const cf = h('input', { class: 'in', placeholder: 'Chord finder: e.g. Cmaj7, F#m7b5, D/F#', style: { fontFamily: 'var(--sans)' } }), cres = h('div', { class: 'vcs', style: { marginTop: '8px' } });
  cf.oninput = () => { cres.innerHTML = ''; const c = parseChord(cf.value); if (!c) { cres.append(h('span', { class: 'muted small' }, cf.value ? 'Unrecognised chord symbol' : 'Type a chord to see playable voicings in the current tuning / capo')); return; } voicings(cf.value, S.tuning, S.capo, 6).forEach(v => cres.append(h('div', { class: 'vc', title: 'Add to selected bar', onclick: () => insertChord(cf.value) }, chordSVG(v), h('div', {}, c.name)))); if (!cres.children.length) cres.append(h('span', { class: 'muted small' }, 'No playable voicing found within 4 frets.')); };
  const render = () => {
    kSel.value = S.key; sSel.value = S.scale; tSelFill(); cap.value = S.capo; const sc = SCALES[S.scale] || []; const fl = keyUsesFlats(S.key, S.minor);
    info.innerHTML = '<span class="muted">Notes:</span> <b class="mono">' + sc.map(i => pcName(S.key + i, fl)).join(' ') + '</b>'; pal.innerHTML = '';
    diatonic(S.key, S.scale).forEach(d => { pal.append(h('button', { class: 'btn sm', title: d.roman + ' — click to place in selected bar; Shift for 7th', onclick: e => insertChord(e.shiftKey && d.seventh ? d.seventh : d.triad) }, d.roman + ' ', h('b', { class: 'mono' }, d.triad))); });
    if (!pal.children.length) pal.append(h('span', { class: 'muted small' }, 'Diatonic chords need a 7-note scale.'));
  };
  bus.on('song', render); render();
  p.append(h('button', { class: 'btn sm ws-door', id: 'theoryShed', title: 'Practise this key and scale in the Woodshed: scales, arpeggios and your ear', onclick: () => { CFG.shed.key = S.key; if (WS_BASE.includes(S.scale) || wsOpen('scale')) CFG.shed.scale = S.scale; CFG.shed.at = null; saveCfg(); woodshedOpen('scales'); } }, '🪵 Practise it in the Woodshed'));
  p.append(h('div', { class: 'card' }, h('h4', {}, 'Key · Scale · Tuning'), h('div', { class: 'card-b' }, h('div', { class: 'row' }, kSel, sSel), h('div', { style: { height: '6px' } }), tSel, h('div', { class: 'row', style: { marginTop: '6px' } }, h('span', { class: 'small' }, 'Capo'), cap), info)),
    h('div', { class: 'card' }, h('h4', {}, 'Diatonic chord palette'), h('div', { class: 'card-b' }, pal)),
    h('div', { class: 'card' }, h('h4', {}, 'Progression builder'), h('div', { class: 'card-b' }, pr, h('div', { class: 'row', style: { marginTop: '6px' } }, h('button', { class: 'btn sm', onclick: () => applyProg(+pr.value, false) }, 'Replace section'), h('button', { class: 'btn sm', onclick: () => applyProg(+pr.value, true) }, 'Append bars')))),
    h('div', { class: 'card' }, h('h4', {}, 'Chord finder'), h('div', { class: 'card-b' }, cf, cres)));
}
function insertChord(sym) {
  const sec = S.sections[SEL.sec]; if (!sec) return toast('Add a section first', 'warn'); const bar = sec.bars[SEL.bar] || sec.bars[0]; if (!bar) return; bar.chord = sym; if (SEL.bar < sec.bars.length - 1) SEL.bar++; commit(); play0preview(sym);
}
function play0preview(sym) { if (!E.ready || T.playing) return; const v = voicingFor(sym); if (!v) return; const t = E.ctx.currentTime + .03; v.frets.forEach((f, i) => { if (f != null) pluck('rhythm', t + i * .018, S.tuning[i] + S.capo + f, .7, { id: 'r' + i }); }); }
function applyProg(i, append) {
  const toks = PROGS[i][1].split(' '), chords = toks.map(t => romanToChord(t, S.key, S.minor) || t); const sec = S.sections[SEL.sec]; if (!sec) return;
  if (append) chords.forEach(c => sec.bars.push(newBar(c))); else sec.bars = chords.map(c => newBar(c)); SEL.bar = 0; commit();
}

/* ---------- Rig pane ---------- */
const PED = {}, AB = { A: null, B: null };
function buildRig() {
  const p = PANES.rig, tb = h('div', { class: 'rigdeck' });
  UI.rigName = h('div', { class: 'dk-tone' }, h('div', { class: 'tiny muted' }, 'CURRENT TONE'), h('div', { class: 'dk-name' }, '—')); bus.on('preset', n => { UI.rigName.lastChild.textContent = n; }); UI.rigName.lastChild.textContent = RIG.cur;
  const trimK = mkKnob({ key: 'master', label: 'Master', min: 0, max: 1.2, def: .9, step: .01, fmt: v => dB(v).toFixed(1) + ' dB', onChange: v => { CFG.master = v; saveCfg(); bus.emit('master'); if (E.ready) tc(E.master.gain, v, .02); } }); if (CFG.master != null) trimK.set(CFG.master, true);
  const mix = h('input', { type: 'range', min: 0, max: 1, step: .01, value: 0, title: 'Morph between stored A and B', style: { flex: '1 1 90px', minWidth: '70px' }, oninput: e => { if (AB.A && AB.B) rigApply(rigLerp(AB.A, AB.B, +e.target.value)); else toast('Store A and B first'); } });
  const abBtn = (k) => [h('button', { class: 'btn sm', onclick: () => { AB[k] = rigSnapshot(); toast('Stored ' + k, 'ok'); } }, 'Store ' + k), h('button', { class: 'btn sm', onclick: () => { if (AB[k]) rigApply(AB[k]); else toast('Nothing stored in ' + k); } }, k)];
  const nm = h('input', { class: 'in', placeholder: 'Preset name', style: { width: '130px', fontFamily: 'var(--sans)' } });
  const imp = h('input', { type: 'file', accept: '.json', style: { display: 'none' }, onchange: async e => { try { const j = JSON.parse(await e.target.files[0].text()); rigApply(j.rig || j); toast('Rig imported', 'ok'); } catch (err) { toast('Invalid rig JSON', 'bad'); } } });
  UI.deck = tb;
  nm.style.width = ''; nm.style.flex = '1 1 120px'; nm.style.minWidth = '90px';
  tb.append(h('div', { class: 'dk dk1' }, UI.rigName, h('div', { class: 'dk-ab' }, ...abBtn('A'), mix, ...abBtn('B')), trimK.el),
    h('div', { class: 'dk dk2' }, h('button', { class: 'btn sm', title: 'Randomly nudge active parameters', onclick: () => { rigApply(rigMutate(.12)); toast('Mutated active units'); } }, '🎲 Mutate'), h('button', { class: 'btn sm', onclick: () => { rigApply({ u: {} }); RIG.cur = 'Direct (No FX)'; bus.emit('preset', RIG.cur); } }, 'Reset all'), nm, h('button', { class: 'btn sm primary', onclick: () => { const n = nm.value.trim(); if (!n) return toast('Name your preset', 'warn'); const a = store.get('presets', []).filter(x => x.n !== n); a.push({ n, d: 'User preset ' + new Date().toLocaleDateString(), u: rigSnapshot().u }); store.set('presets', a); RIG.cur = n; renderTones(); toast('Saved “' + n + '”', 'ok'); } }, 'Save'), h('button', { class: 'btn sm', onclick: () => download('the-daily.studio-rig.json', JSON.stringify({ name: RIG.cur, rig: rigSnapshot() }, null, 2), 'application/json') }, 'Export'), h('button', { class: 'btn sm', onclick: () => imp.click() }, 'Import'), imp));
  UI.board = h('div', { class: 'board' }); p.append(tb, UI.board);
  RIG.order.forEach(id => UI.board.append(pedalEl(id))); bus.on('rig:refresh', syncPedals); bus.on('rig:order', () => RIG.order.forEach(id => UI.board.append(PED[id].el)));
}
function pedalEl(id) {
  const def = FX[id], card = h('div', { class: 'pedal', 'data-id': id }), ctr = {}, body = h('div', { class: 'pedal-b' });
  const stomp = h('button', { class: 'stomp', title: 'Engage / bypass', onclick: () => { if (!E.ready) return toast('Power on first'); const u = RIG.units[id]; u.setActive(!u.on); card.classList.toggle('on', u.on); } });
  const head = h('div', { class: 'pedal-h', draggable: 'true', title: 'Drag to reorder in the signal chain', ondragstart: e => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; } }, stomp, h('b', {}, def.name), h('small', {}, def.cat));
  card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('dragover'); }); card.addEventListener('dragleave', () => card.classList.remove('dragover'));
  card.addEventListener('drop', e => { e.preventDefault(); card.classList.remove('dragover'); const from = e.dataTransfer.getData('text/plain'); if (from && from !== id) rigMove(from, RIG.order.indexOf(id)); });
  def.params.forEach(q => {
    const key = id + '.' + q.k, setP = v => { if (E.ready && RIG.units[id]) RIG.units[id].set(q.k, v); };
    if (q.type === 'knob') { const k = mkKnob({ key, label: q.label, min: q.min, max: q.max, def: q.def, step: q.step, unit: q.unit, log: q.log, onChange: setP }); ctr[q.k] = { set: v => k.set(v, true) }; body.append(k.el); }
    else if (q.type === 'select') { const s = h('select', { class: 'in', 'aria-label': q.label, onchange: e => setP(e.target.value) }, q.opts.map(o => h('option', { value: o }, o))); s.value = q.def; ctr[q.k] = { set: v => { s.value = v; } }; body.append(h('div', { class: 'ctl' }, h('div', { class: 'k-l' }, q.label), s)); }
    else { const t = h('button', { class: 'tog', onclick: () => { const on = !t.classList.contains('on'); t.classList.toggle('on', on); setP(on ? 1 : 0); } }, q.label); ctr[q.k] = { set: v => t.classList.toggle('on', !!v) }; body.append(h('div', { class: 'ctl' }, h('div', { class: 'k-l' }, ' '), t)); }
  });
  if (id === 'cab') { const fi = h('input', { type: 'file', accept: 'audio/*', style: { display: 'none' }, onchange: e => e.target.files[0] && RIG.units.cab.loadIR(e.target.files[0]) }); body.append(h('div', { class: 'ctl' }, h('div', { class: 'k-l' }, 'Custom IR'), h('div', { class: 'row', style: { gap: '4px' } }, h('button', { class: 'btn sm', onclick: () => fi.click() }, 'Load…'), h('button', { class: 'btn sm', onclick: () => RIG.units.cab.clearIR() }, '↺')), fi)); }
  card.append(head, body); PED[id] = { el: card, ctr }; return card;
}
function syncPedals() {
  if (!E.ready) return;
  RIG.order.forEach(id => { const u = RIG.units[id], P = PED[id]; if (!u || !P) return; P.el.classList.toggle('on', u.on); FX[id].params.forEach(q => P.ctr[q.k] && P.ctr[q.k].set(u.p[q.k])); });
}

/* ---------- right sidebar: tuner, meters, live analysis ---------- */
function buildRight() {
  const R = $('#right'), p = UI.monPane = h('div', { class: 'pane on' }); R.append(p);
  UI.tuner = { note: h('div', { class: 'note' }, '–'), hz: h('div', { class: 'hz' }, 'play a note'), nd: h('i'), str: h('div', { class: 'strs' }) };
  const needle = h('div', { class: 'needle' }, h('u'), UI.tuner.nd);
  UI.tunerCard = h('div', { class: 'card' }, h('h4', {}, 'Tuner', h('span', { class: 'badge', id: 'tunName' }, 'Standard')), h('div', { class: 'card-b tuner' }, UI.tuner.note, UI.tuner.hz, needle, UI.tuner.str));
  const mt = (id, label) => { const i = h('i'), u = h('u'), v = h('span', { class: 'mono tiny' }, '–∞ dB'); UI[id] = { i, u, v, hold: -120 }; return h('div', { style: { marginBottom: '7px' } }, h('div', { class: 'row sp tiny muted' }, h('span', {}, label), v), h('div', { class: 'meter' }, i, u)); };
  UI.clip = h('i', { class: 'led', title: 'Input clip indicator (click to clear)', onclick: e => e.target.className = 'led' });
  const mc = h('div', { class: 'card' }, h('h4', {}, 'Levels (dBFS)', UI.clip), h('div', { class: 'card-b' }, mt('mIn', 'Input (DI, post-trim)'), mt('mRig', 'Rig output'), mt('mMaster', 'Master (post-limiter)'), h('div', { class: 'tiny muted', id: 'gainhint' }, 'Aim for DI peaks around −12…−6 dBFS.')));
  UI.live = h('div', { class: 'kv' }); const lc = h('div', { class: 'card' }, h('h4', {}, 'Live analysis'), h('div', { class: 'card-b' }, UI.live));
  UI.mini = h('canvas', { class: 'vcanvas', height: 90, style: { height: '90px' } }); const sp = h('div', { class: 'card' }, h('h4', {}, 'Spectrum (rig out)'), h('div', { class: 'card-b', style: { padding: '6px' } }, UI.mini));
  p.append(UI.tunerCard, mc, lc, sp, monitorViewsCard(), audienceCard()); renderStrings(); bus.on('song', renderStrings);
}
function renderStrings() { if (!UI.tuner) return; const s = UI.tuner.str; s.innerHTML = ''; S.tuning.forEach((m, i) => s.append(h('span', { 'data-m': m + S.capo, title: 'Click to hear this string (reference tone)', style: { cursor: 'pointer' }, onclick: async () => { await startAudio(); if (E.ready) pluck('lead', E.ctx.currentTime + .01, m + S.capo, .8, { id: 'ref', pan: 0 }); } }, tunPc(m + S.capo)))); const b = $('#tunName'); if (b) b.textContent = tunShort(); }
const dbw = d => clamp((d + 60) / 60, 0, 1) * 100 + '%';
const bufs = {}; const getBuf = (a, k) => bufs[k] || (bufs[k] = new Float32Array(a.fftSize));
function peakOf(an, k, last = 2048) { const b = getBuf(an, k); if (b.length !== an.fftSize) bufs[k] = new Float32Array(an.fftSize); an.getFloatTimeDomainData(bufs[k]); let pk = 0, e = 0; const n = Math.min(last, bufs[k].length), s = bufs[k].length - n; for (let i = s; i < bufs[k].length; i++) { const v = bufs[k][i], a = Math.abs(v); if (a > pk) pk = a; e += v * v; } return { pk: dB(pk), rms: dB(Math.sqrt(e / n)) }; }
function updateMeters() {
  if (!E.ready) return; if (typeof chMeters === 'function') chMeters(); if (frameN % 2 === 0) ioTick();
  [['mIn', E.anaDI], ['mRig', E.anaRig], ['mMaster', E.anaMaster]].forEach(([id, an]) => { const m = peakOf(an, id), u = UI[id]; u.i.style.width = dbw(m.rms); u.hold = Math.max(m.pk, u.hold - .6); u.u.style.left = dbw(Math.max(u.hold, -60)); u.v.textContent = 'pk ' + (m.pk < -90 ? '−∞' : m.pk.toFixed(1)) + ' · rms ' + (m.rms < -90 ? '−∞' : m.rms.toFixed(1)); if (id === 'mIn' && m.pk > -.5) UI.clip.className = 'led bad'; }); laneMeters();
  const g = $('#gainhint'); if (g && E.hasInput) g.textContent = AN.peak > -2 ? '⚠ Too hot — lower the interface gain or trim.' : AN.active && AN.peak < -30 ? 'Signal is low — raise gain (aim DI peaks around −12…−6 dBFS).' : 'Aim for DI peaks around −12…−6 dBFS.';
}
function updateTuner() {
  const t = UI.tuner; if (!t) return;
  if (AN.f0 && AN.midi != null) {
    t.note.textContent = tunNote(AN.midi); t.hz.textContent = AN.f0.toFixed(2) + ' Hz · ' + (AN.cents >= 0 ? '+' : '') + AN.cents.toFixed(1) + '¢ · clarity ' + AN.clarity.toFixed(2);
    t.nd.style.left = (50 + clamp(AN.cents, -50, 50)) + '%'; t.note.style.color = Math.abs(AN.cents) < 5 ? 'var(--ok)' : '';
    $$('span', t.str).forEach(s => { const m = +s.dataset.m; s.className = m === AN.midi ? (Math.abs(AN.cents) < 5 ? 'hit' : 'near') : ''; });
  } else { t.hz.textContent = AN.rms > -60 ? 'listening…' : 'play a note'; t.nd.style.left = '50%'; $$('span', t.str).forEach(s => s.className = ''); }
}
function updateLive() {
  const l = UI.live; if (!l) return; const ch = AN.chord[0], k = AN.key && AN.key[0];
  l.innerHTML = ''; const kv = (a, b) => l.append(h('span', {}, a), h('span', {}, b));
  kv('Chord', ch && AN.active ? ch.sym + ' (' + (ch.score * 100).toFixed(0) + '%)' : '—'); kv('Alt', AN.chord[1] && AN.active ? AN.chord.slice(1).map(c => c.sym).join(' · ') : '—');
  kv('Key (notes)', k ? pcName(k.root) + (k.minor ? ' minor' : ' major') + ' r=' + k.r.toFixed(2) : 'play ≥8 notes'); kv('f0', AN.f0 ? AN.f0.toFixed(1) + ' Hz' : '—');
  kv('Centroid', AN.centroid ? AN.centroid.toFixed(0) + ' Hz' : '—'); kv('Rolloff 85%', AN.rolloff ? AN.rolloff.toFixed(0) + ' Hz' : '—'); kv('HFR (h2–h6)', AN.hfr != null ? AN.hfr.toFixed(1) + ' dB' : '—'); kv('Vibrato', AN.vib ? AN.vib.rate.toFixed(1) + ' Hz · ±' + AN.vib.ext.toFixed(0) + '¢' : '—'); kv('Crest', AN.active ? AN.crest.toFixed(1) + '×' : '—');
}
