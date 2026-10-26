/* ---------- Audio control: nothing is switched on until you choose, and one kill switch turns it all off ----------
   Header button (always visible) → this panel: start the engine, pick an input, connect / release the microphone, monitoring,
   and KILL AUDIO (also Ctrl + .). The app never asks for the microphone by itself unless you tick "Reconnect my last input". */
const AK = { killed: false };
function closeInput() {
  try { if (E.stream) E.stream.getTracks().forEach(t => t.stop()); } catch (e) { }
  try { if (E.src) E.src.disconnect(); } catch (e) { }
  E.stream = null; E.src = null; E.hasInput = false; bus.emit('input', null);
}
function audioKill(quiet) {
  try { if (typeof humAbort === 'function') humAbort(); } catch (e) { }
  try { if (typeof srecAbort === 'function') srecAbort(); } catch (e) { }
  try { if (T.rec || T.playing) stopPlay(false); } catch (e) { }
  try { if (CFG.monitor) setMonitor(false); } catch (e) { }
  closeInput(); try { if (E.ctx && E.ctx.state === 'running') E.ctx.suspend(); } catch (e) { }
  AK.killed = true; bus.emit('audiostate'); if (!quiet) toast('Audio killed: playback stopped, monitor off, microphone released. Open Audio to resume.', 'warn');
}
async function audioResume() { AK.killed = false; try { await startAudio(); } catch (e) { toast('Audio could not restart: ' + e.message, 'bad'); } bus.emit('audiostate'); }
function audioState() {
  if (AK.killed) return ['bad', 'Audio killed']; if (!E.ctx || E.ctx.state !== 'running') return ['', 'Audio off'];
  return E.hasInput ? ['on', 'Input live'] : ['warn', 'No input'];
}
function audioButton() {
  const led = h('i', { class: 'led' }), txt = h('span', { class: 'lbl' }, 'Audio off');
  UI.aud = h('button', { class: 'btn sm aud', title: 'Audio: start, choose an input, set your level, monitoring and the kill switch (Ctrl + .)', 'aria-haspopup': 'dialog', onclick: audioOpen }, led, txt, ioPillLevel());
  const sync = () => { const [c, t] = audioState(); led.className = 'led ' + c; txt.textContent = t; UI.aud.classList.toggle('killed', AK.killed); };
  ['audio:ready', 'input', 'monitor', 'audiostate', 'devices'].forEach(ev => bus.on(ev, sync)); setInterval(sync, 1000); sync(); return UI.aud;
}
function audioOpen() {
  const body = h('div', { class: 'aud-b' });
  function draw() {
    const [c, t] = audioState(), on = E.ctx && E.ctx.state === 'running';
    body.innerHTML = ''; body.append(
      h('div', { class: 'aud-st ' + c }, h('i', { class: 'led ' + c }), h('b', {}, t), h('span', { class: 'muted' }, AK.killed ? ' Everything is stopped and the microphone is released.' : !on ? ' Nothing is running and nothing has been asked of your microphone.' : E.hasInput ? ' Your input is on.' : ' The engine is on; your microphone is still off.')),
      AK.killed ? h('button', { class: 'btn primary', onclick: async () => { await audioResume(); draw(); } }, '▶ Resume audio (microphone stays off)') : '',
      !on && !AK.killed ? h('button', { class: 'btn primary', onclick: async () => { try { await startAudio(); } catch (e) { toast(e.message, 'bad'); } bus.emit('audiostate'); draw(); } }, '▶ Start audio engine (no microphone)') : '',
      h('div', { class: 'lk-sec' }, 'INPUT'),
      ioConnectEl(),
      h('label', { class: 'row', style: { gap: '8px' } }, h('input', { type: 'checkbox', checked: !!CFG.autoIn, onchange: e => { CFG.autoIn = e.target.checked; saveCfg(); } }), h('span', {}, 'Reconnect my last input when the app opens (off by default)')),
      h('div', { class: 'tiny muted' }, 'Your browser asks for permission the first time. What each input is (guitar or voice), the camera and the latency test are in the I/O panel. ', h('a', { href: '#', onclick: e => { e.preventDefault(); const d = document.getElementById('audio'); if (d) d.close(); try { if (typeof vzImmersive === 'function') vzImmersive(false); sideShow('io'); } catch (er) { } } }, 'Open I/O ›')),
      h('div', { class: 'lk-sec' }, 'KILL SWITCH'),
      h('button', { class: 'btn aud-kill', onclick: () => { audioKill(); draw(); } }, '⏹ KILL AUDIO · Ctrl + .'),
      h('div', { class: 'tiny muted' }, 'Stops playback and recording, turns monitoring off, releases the microphone and suspends the audio engine. Use it for feedback or a runaway sound.'));
  }
  const d = pdlg('audio', 'AUDIO', body, { cls: 'auddlg' }); draw(); const redraw = () => { if (document.getElementById('audio')) draw(); }; ['audiostate'].forEach(ev => bus.on(ev, redraw)); d.addEventListener('close', () => ['audiostate'].forEach(ev => bus.off && bus.off(ev, redraw)));
}
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === '.') { e.preventDefault(); audioKill(); } }, true);
