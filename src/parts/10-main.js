/* ============================================================
   Part 10 · boot, frame loop, wiring
   ============================================================ */
const FOCUSRITE_RE = /focusrite|scarlett|clarett|vocaster|saffire|2i2|4i4|solo usb|18i/i;
let mfd = null;
function drawMini() {
  const cv = UI.mini; if (!cv || !E.ready || !E.anaRig) return; const d = window.devicePixelRatio || 1, w = cv.clientWidth, hh = 90;
  if (!w) return; if (cv.width !== Math.floor(w * d)) { cv.width = Math.floor(w * d); cv.height = Math.floor(hh * d); }
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, an = E.anaRig; if (!mfd || mfd.length !== an.frequencyBinCount) mfd = new Float32Array(an.frequencyBinCount); an.getFloatFrequencyData(mfd);
  g.fillStyle = '#050b0c'; g.fillRect(0, 0, W, H); const bh = E.ctx.sampleRate / an.fftSize, fmin = 30, fmax = 16000, lr = Math.log(fmax / fmin), C = vcol();
  g.beginPath(); g.moveTo(0, H); for (let x = 0; x < W; x += 2) { const f = fmin * Math.exp(lr * x / W), k = clamp(Math.round(f / bh), 1, mfd.length - 1); const v = clamp((mfd[k] + 100) / 80, 0, 1); g.lineTo(x, H - v * H); } g.lineTo(W, H); g.closePath();
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, C.b); gr.addColorStop(1, C.a); g.fillStyle = gr; g.globalAlpha = .85; g.fill(); g.globalAlpha = 1;
  g.fillStyle = 'rgba(255,255,255,.35)'; g.font = `${9 * d}px ui-monospace,monospace`; [100, 1000, 10000].forEach(f => { const x = Math.log(f / fmin) / lr * W; g.fillRect(x, 0, 1, H); g.fillText(f >= 1000 ? f / 1000 + 'k' : f, x + 3, 10 * d); });
}
let frameN = 0, lastLCD = '';
function frame(ts) {
  requestAnimationFrame(frame); frameN++; fpsN++; if (ts - fpsT >= 1000) { FPS = fpsN; fpsN = 0; fpsT = ts; }
  if (document.hidden) return;
  if (E.ready) {
    updateMeters(); updateTuner(); if (frameN % 6 === 0) updateLive(); if (frameN % 2 === 0) drawMini();
    if (AN.clip && UI.clip) UI.clip.className = 'led bad';
  }
  // transport LCD
  const ph = playheadSlot(), sp = spb(), p = barStr(ph); const txt = p + '|' + Math.floor(ph * slotDur() * 10);
  if (txt !== lastLCD) { lastLCD = txt; UI.pos.firstChild.textContent = p; UI.tim.firstChild.textContent = fmtTime(Math.max(0, ph) * slotDur()); }
  if (T.playing || TL.dirty || frameN % 15 === 0) { drawTL(); TL.dirty = false; }
  if (paneVisible('vis')) drawVis(); if (paneVisible('fret')) paintFret(false); if (paneVisible('cam') && frameN % 20 === 0) updateCamStats(); if (typeof neuralFrame === 'function') neuralFrame(); if (typeof stemFrame === 'function') stemFrame(); if (typeof stageFrame === 'function') stageFrame(ts);
  if (frameN % 30 === 0) updateStatus();
}

function loadInitialSong() {
  let s = null; const saved = store.get('song', null);
  if (saved && Array.isArray(saved.sections) && saved.sections.length) { const d = newSong(); s = Object.assign(d, saved); s.band = Object.assign(d.band, saved.band || {}); s.mix = Object.assign(d.mix, saved.mix || {}); s.voicePref = saved.voicePref || {}; s.tuning = (saved.tuning || d.tuning).slice(); }
  S = s || demoSong(); if (!s) S.sections.forEach(sec => sec.bars.forEach(b => { const c = barChords(b)[0]; if (c) fillTab(b, 'Fingerstyle pop', c); })); histStack.cur = snap();
}
function runChecks() {
  const box = $('#bootChecks'); if (!box) return; const AC = window.AudioContext || window.webkitAudioContext;
  const items = [['Web Audio', !!AC], ['AudioWorklet', typeof AudioWorkletNode !== 'undefined'], ['Audio input', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)], ['Camera', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)], ['Web MIDI', !!navigator.requestMIDIAccess], ['Output select', !!(AC && AC.prototype.setSinkId)], ['Secure context', window.isSecureContext !== false]];
  items.forEach(([n, ok]) => box.append(h('span', { class: 'check', style: { color: ok ? 'var(--ok)' : 'var(--warn)', font: '700 11px var(--mono)' } }, (ok ? '✓ ' : '△ ') + n)));
}
async function pickInput() {
  const ok = await openInput(CFG.inDev || undefined); if (!ok) return false; await listDevices();
  const list = E.devs.in, current = (E.inSettings && E.inSettings.deviceId) || '', pref = CFG.inDev && list.find(d => d.deviceId === CFG.inDev), fr = list.find(d => FOCUSRITE_RE.test(d.label || ''));
  if (!pref && fr && fr.deviceId !== current) { await openInput(fr.deviceId); toast('Focusrite found: ' + fr.label, 'ok'); }
  else if (fr && (pref ? pref.deviceId === fr.deviceId : fr.deviceId === current)) toast('Using ' + fr.label, 'ok');
  if (FOCUSRITE_RE.test(((list.find(d => d.deviceId === ((E.inSettings || {}).deviceId)) || {}).label) || '') && CFG.ch === 'auto') setTimeout(() => toast('Tip: press “Auto-detect channel” in I/O and strum, or pick Input 1 / 2 manually.'), 1800);
  const o = E.devs.out.find(d => FOCUSRITE_RE.test(d.label || '')); if (o && !CFG.outDev && E.ctx.setSinkId) try { await setOutputDevice(o.deviceId); } catch (e) { }
  return true;
}
async function boot() {
  applyAppearance(); loadInitialSong();
  buildHeader(); buildDock(); buildLeft(); buildRig(); buildTabPane(); buildSongPane(); buildBandPane(); buildFretPane(); buildVisPane(); buildCamPane(); buildLabPane(); buildExportPane(); buildTxPane(); buildStagePane(); buildNeuralPane(); buildStemsPane(); buildVersionCard(); buildCalCard(); buildBoardExtras(); buildRight(); buildSongbar(); buildSides(); buildLayout(); buildTimeline(); buildStatus(); buildMobile(); if (typeof buildTouch === 'function') buildTouch();
  try { if (window.self !== window.top) { const w = h('div', { style: { background: 'color-mix(in srgb,var(--warn) 22%,transparent)', border: '1px solid var(--warn)', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', margin: '0 0 12px', fontWeight: 600 } }, '⚠ This page is embedded in a frame (editor preview). Browsers usually block the microphone, camera and MIDI there, so no audio devices will appear. Open it in its own tab: CodePen → Change View → Full Page (or Debug), or open the standalone file directly in Chrome/Edge.'); const c = $('#bootChecks'); c.parentNode.insertBefore(w, c); } } catch (e) { }
  dockGo(CFG.startTab || 'vis'); syncTransport(); try { runChecks(); } catch (e) { console.warn(e); }
  $$('#bootTheme button').forEach(b => { b.classList.toggle('on', b.dataset.t === CFG.theme); b.onclick = () => setTheme(b.dataset.t); });
  const hide = () => { const b = $('#boot'); if (!b) return; b.style.opacity = 0; setTimeout(() => { b.remove(); bus.emit('booted'); }, 350); };
  // boot overlay: live connection status + input picker
  const bstat = h('div', { id: 'bootStat', style: { font: '700 12px var(--mono)', margin: '0 0 8px' } }), bsel = h('select', { id: 'bootIn', class: 'in', style: { width: '100%', marginBottom: '10px', fontFamily: 'var(--sans)', display: 'none' }, onchange: async e => { await openInput(e.target.value); await listDevices(); fillBootIn(); say(); } });
  const bc = $('#bootChecks'); bc.parentNode.insertBefore(bsel, bc.nextSibling); bc.parentNode.insertBefore(bstat, bc.nextSibling);
  const say = (m, c) => { if (m) { bstat.textContent = m; bstat.style.color = c || ''; return; } const t = E.stream && E.stream.getAudioTracks()[0]; bstat.textContent = E.hasInput ? '● Audio input connected: ' + (t ? t.label : 'device') + ' — press Start' : '○ ' + (E.lastInErr || 'Microphone is off. Nothing is requested until you press a button.'); bstat.style.color = E.hasInput ? 'var(--ok)' : 'var(--warn)'; };
  const fillBootIn = () => { const cur = (E.inSettings && E.inSettings.deviceId) || ''; bsel.innerHTML = ''; const list = E.devs.in.filter(d => d.deviceId !== 'communications'); list.forEach((d, i) => bsel.append(h('option', { value: d.deviceId, selected: d.deviceId === cur }, d.label || ('Input ' + (i + 1))))); bsel.style.display = list.length ? '' : 'none'; };
  const startBtn = $('#bootGo'); startBtn.textContent = '🎙 Start and connect my input';
  const finish = async () => { startBtn.disabled = true; startBtn.textContent = 'Starting…'; CFG.route = 'studio'; saveCfg(); HUM.cam0 = false; try { await startAudio(); if (!E.hasInput) await pickInput(); initMIDI(); } catch (e) { console.error(e); toast('Startup problem: ' + e.message, 'bad'); } hide(); renderDevices && renderDevices(); };
  startBtn.onclick = finish;
  window.__fwAuto = (async () => {
    say();   // nothing is started or requested until you press a button (or tick “Reconnect my last input” in Audio)
    try { await listDevices(); fillBootIn(); if (CFG.autoIn && CFG.inDev) { say('Reconnecting your last input… allow the microphone when your browser asks.'); await startAudio(); await pickInput(); fillBootIn(); say(); renderDevices(); if (E.hasInput && E.ctx.state === 'running') hide(); } } catch (e) { console.warn(e); say('Could not connect: ' + e.message, 'var(--bad)'); }
  })();
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (E.ctx && !OFR.busy && E.ctx.state === 'suspended') E.ctx.resume().catch(() => { }); }, true));
  // two routes: the studio (no camera) or the stage (full-screen visuals with the camera). Nothing is requested until one is pressed.
  const bootStart = async route => { CFG.route = route; saveCfg(); HUM.cam0 = route === 'stage'; try { await startAudio(); listDevices(); } catch (e) { console.error(e); toast('Audio could not start: ' + e.message, 'bad'); } hide(); };
  $('#bootNoMic').onclick = () => bootStart('studio'); $('#bootStage').onclick = () => bootStart('stage');
  if (CFG.route === 'stage') { $('#bootStage').classList.add('primary'); $('#bootNoMic').classList.remove('primary'); }
  setInterval(anaTick, 33); requestAnimationFrame(frame);
  window.addEventListener('beforeunload', () => { try { store.set('song', S); saveCfg(); } catch (e) { } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && E.ctx && !OFR.busy && E.ctx.state === 'suspended') E.ctx.resume(); });
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', () => { ioDeviceChange().catch(e => console.warn(e)); });
  bus.emit('song');
  if (/[?&]debug\b/.test(location.search)) window.__daily = { projExportAll, projNudge, keepToast, keepRisk, keepCard, keepOpen, keepText, smfParse, smfParts, smfBuild, smfOpen, bounceFast, ofrRender, ofrAbort, OFR, bounceMaster, stemLoad, scheduleTakes, stopTakes, takeLive, projEntries, projImport, zipBuild, tkSplit, tkDup, tkDelete, tkDeleteLane, tkReset, tkSelect, tkSel, tkLeads, tkClips, tkLead, tkLen, tkEnd, tkIn, tkOut, tkRender, tkRenderClip, tkHistGet, tkHistSet, stmHistGet, stmHistSet, stmReset, TKSEL, TK_BIN, snap, histPush, histBegin, histEnd, histStack, tkResched, tkHit, tkPps, tkNowSec, tkMenu, tkFades, tkSetFade, tkDownload, autoBalance, abMeasure, abApply, abUndo, BAL, dropKind, dropFiles, dropTake, rigSnapshot, undo, redo, MST_PRE, mstSet, fxOn, applyMix, laneSelect, IO, ioBrowser, ioPermHelp, ioErrMsg, ioDiagnose, ioPlan, ioNewInputs, ioOffer, ioLevelWizard, ioTestSound, ioConnectEl, ioConnect, ioLevels, closeInput, ioApplyTrim, ioTrimOf, KNOBS, play, SYNC, syncNow, syncChoose, lufsMeasure, loudAfterBounce, shareHtml, shareData, printSheetHtml, printSheet, songSlots, slotDur, get PF() { return PF; }, perfOpen, perfClose, get SREC() { return SREC; }, srecStart, srecStop, get S() { return S; }, PB, FB, visAna, E, T, humPlay, dockGo, stopPlay, bouncePart, NK, neckMarks, vzSetMode, sideShow, chSetRoles, chRoles, setAnaSource, haloDraw, HL, KS, nkNext, nkPinChord, PRJ, TAKES, STM, ZOOM, CFG, store, commit, projSave, projLoad, projCreate, bus, CAM, CF, VZ, cfFeed, camTop, esc, humAnalyze, humSong, HUM, parseChord, humOpen, humApply, humNotes, AN, humGuitar, humGuitarTick, humStringHz, humStageFirst, vzImmersive };   // test hook, only with ?debug
  projInit().catch(e => { console.warn('library', e); PRJ.ready = true; if (PRJ.wantStart) startMaybe(); });
}
