/* ============================================================
   Part 38 · PERFORM
   One full-screen view for a take or a run-through: the chord huge, the lyrics scrolling with the song, a count-in, record and
   play in reach, and a readiness check first (audio, input and its level, camera, lyrics). With "visuals behind" the stage
   shows through; without, a plain dark page. The microphone and camera stay off until you press their buttons here.
   ============================================================ */
const PF = { on: false, el: null, raf: 0, ready: false, bd: false, imm: false, key: '', opener: null, lv: 0, f: {} };
const pfDb = v => (v < 1e-5 ? -99 : 20 * Math.log10(v));
function perfLevel() {
  if (!E.ready || !E.hasInput || !E.anaDI) return -99;
  const n = E.anaDI.fftSize; if (!PF.buf || PF.buf.length !== n) PF.buf = new Float32Array(n); E.anaDI.getFloatTimeDomainData(PF.buf); let pk = 0; for (let i = 0; i < n; i++) { const a = Math.abs(PF.buf[i]); if (a > pk) pk = a; } return pfDb(pk);
}
/** what to show now: while playing, the bar under the playhead; otherwise the bar at the cursor */
function perfInfo() {
  const i = stageInfo(), sp = spb(); let bi = Math.floor((T.playing && E.ctx ? playheadSlot() : T.cursor) / sp); if (bi < 0) bi = 0;
  const fb = barsCache()[Math.min(bi, barsCache().length - 1)]; i.lines = []; i.idx = -1; i.secName = i.sec;
  if (fb) { const sib = T.playing && E.ctx ? Math.max(0, playheadSlot() - bi * sp) : 0, L = lyAt(fb.sec, fb.bi, sib); i.raw = L.lines; i.lines = L.lines.map(lyPlain); i.idx = T.playing ? L.idx : (L.lines.length ? 0 : -1); i.mi = T.playing ? L.mi : -1; i.secName = fb.sec.name; if (!T.playing) { const c = chordAt(bi, 0); i.sym = c && c.sym; i.next = c && c.next; i.barIn = fb.bi + 1; i.nBars = fb.sec.bars.length; } }
  return i;
}
function perfReady() {
  const row = (id, ok, label, extra) => h('div', { class: 'pf-r ' + (ok === true ? 'ok' : ok === false ? 'bad' : 'info'), id }, h('i', { 'aria-hidden': 'true' }, ok === true ? '✓' : ok === false ? '!' : '–'), h('span', { class: 'pf-rl' }, label), extra || '');
  const lyr = S.sections.reduce((a, s) => a + (s.lyrics || '').split('\n').filter(l => l.trim()).length, 0), run = !!(E.ctx && E.ctx.state === 'running' && !(typeof AK !== 'undefined' && AK.killed));
  const camNeeded = CFG.route === 'stage' || PF.bd;
  const box = h('div', { class: 'pf-card', id: 'pfReady' },
    h('h2', {}, 'Ready to perform?'),
    row('pfRAudio', run, run ? 'Audio is running' : 'Audio is off', run ? '' : h('button', { class: 'btn sm', id: 'pfStartAudio', onclick: async () => { try { if (typeof AK !== 'undefined') AK.killed = false; await startAudio(); } catch (e) { toast('Audio could not start: ' + e.message, 'bad'); } perfRefresh(); } }, 'Start audio')),
    row('pfRIn', E.hasInput ? true : null, E.hasInput ? 'Input connected' : 'No input yet (you can still play along, but nothing will be recorded)', E.hasInput ? [h('span', { class: 'pf-meter', 'aria-hidden': 'true' }, h('b', { id: 'pfLv' })), h('button', { class: 'btn sm', id: 'pfLevel', title: 'Play for five seconds and the level is set for you', onclick: () => ioLevelWizard() }, 'Set level')] : h('button', { class: 'btn sm', id: 'pfConnect', onclick: async () => { try { await ioConnectFlow(); } catch (e) { toast('No input: ' + (e.message || e.name) + '. Allow the microphone or plug in your interface.', 'warn'); } perfRefresh(); } }, 'Connect input')),
    camNeeded ? row('pfRCam', CAM.on ? true : null, CAM.on ? 'Camera is on' : 'Camera is off (optional)', CAM.on ? '' : h('button', { class: 'btn sm', id: 'pfCam', onclick: async () => { try { await vzCenterStage(true); } catch (e) { } perfRefresh(); } }, 'Turn camera on')) : '',
    row('pfRSong', lyr > 0 ? true : null, lyr > 0 ? lyr + ' lyric line' + (lyr === 1 ? '' : 's') + ' to follow' : 'No lyrics yet: the chords will still show'),
    h('div', { class: 'pf-rr' }, h('label', { for: 'pfCount' }, 'Count-in'), h('select', { class: 'in', id: 'pfCount', 'aria-label': 'Count-in bars', onchange: e => { CFG.countIn = +e.target.value; saveCfg(); } }, [0, 1, 2, 4].map(n => h('option', { value: n, selected: n === CFG.countIn }, n ? n + (n === 1 ? ' bar' : ' bars') : 'None'))),
      h('label', { class: 'pf-chk' }, h('input', { type: 'checkbox', id: 'pfBackChk', checked: PF.bd, onchange: e => perfBackdrop(e.target.checked) }), 'Show the visuals behind')),
    h('div', { class: 'tiny muted' }, 'Ctrl/Cmd + . stops everything at any time. Nothing is uploaded.'),
    h('div', { class: 'row', style: { gap: '10px', marginTop: '10px' } }, h('button', { class: 'btn primary pf-go', id: 'pfGo', onclick: () => { PF.ready = true; perfRefresh(); const p = document.getElementById('pfPlay'); if (p) p.focus(); } }, '▶ Start performing'), h('button', { class: 'btn', id: 'pfExit2', onclick: () => perfClose() }, 'Not now')));
  return box;
}
async function perfBackdrop(on) {
  PF.bd = !!on; const el = PF.el; if (!el) return; el.classList.toggle('pf-solid', !PF.bd);
  if (PF.bd) { if (ZOOM.cur === 'canvas') zoomSet('song', true); try { dockGo('vis'); } catch (e) { } if (!document.body.classList.contains('vz-imm')) { PF.imm = true; vzImmersive(true); } }
  else if (PF.imm) { PF.imm = false; vzImmersive(false); }
  const c = document.getElementById('pfBackChk'); if (c) c.checked = PF.bd;
}
function perfRefresh() {
  if (!PF.el) return; const old = document.getElementById('pfReady'); if (old) old.remove();
  PF.el.classList.toggle('pf-pre', !PF.ready);
  if (!PF.ready) PF.el.querySelector('.pf-stage').append(perfReady());
  PF.key = '';
}
function perfOpen(opener) {
  if (PF.on) return; PF.on = true; PF.ready = false; PF.opener = opener || document.activeElement; PF.bd = CFG.route === 'stage'; PF.imm = false;
  const dots = h('span', { class: 'pf-dots', id: 'pfDots', 'aria-hidden': 'true' });
  const ctl = (id, t, title, fn) => h('button', { class: 'btn pf-b', id, title, onclick: fn }, t);
  PF.el = h('div', { id: 'perform', class: 'perform pf-pre' + (PF.bd ? '' : ' pf-solid'), role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Perform' },
    h('div', { class: 'pf-top' }, h('b', { class: 'pf-song', id: 'pfSong' }), h('span', { class: 'pf-sec', id: 'pfSec' }), h('span', { class: 'grow' }), h('span', { class: 'pf-meta', id: 'pfMeta' }), dots,
      h('button', { class: 'btn sm vzh-kill', id: 'pfKill', title: 'Stop all sound and release the microphone (Ctrl + .)', onclick: () => { try { audioKill(); } catch (e) { } } }, '■ Stop audio'), h('button', { class: 'btn sm', id: 'pfExit', onclick: () => perfClose() }, '✕ Exit')),
    h('div', { class: 'pf-stage' }, h('div', { class: 'pf-chord', id: 'pfChord', 'aria-live': 'off' }, '·'), h('div', { class: 'pf-next', id: 'pfNext' }), h('div', { class: 'pf-lyr', id: 'pfLyr' })),
    h('div', { class: 'pf-bar' }, ctl('pfPlay', '▶ Play', 'Play or stop (Space)', () => { T.playing ? stopPlay(true) : play(); }), ctl('pfRec', '● Record', 'Record a take with a count-in (R)', () => { if (!E.hasInput) toast('No input is connected, so only the count-in will run.', 'warn'); toggleRec(); }),
      ctl('pfLoop', '⟲ Loop', 'Loop the song (L)', () => { T.loop = !T.loop; syncTransport(); perfSync(); }), ctl('pfMetro', '♩ Click', 'Metronome (M)', () => { T.metro = !T.metro; syncTransport(); perfSync(); }),
      ctl('pfSlow', '−', 'Slower by 5 BPM', () => { S.bpm = clamp(S.bpm - 5, 30, 260); commit(false); bus.emit('bpm'); perfSync(); }), h('b', { class: 'pf-bpm', id: 'pfBpm' }), ctl('pfFast', '+', 'Faster by 5 BPM', () => { S.bpm = clamp(S.bpm + 5, 30, 260); commit(false); bus.emit('bpm'); perfSync(); }),
      h('span', { class: 'grow' }), h('span', { class: 'pf-takes', id: 'pfTakes' })));
  document.body.append(PF.el); document.body.classList.add('perform-on');
  if (PF.bd) perfBackdrop(true);
  perfRefresh(); perfSync(); const g = document.getElementById('pfGo'); if (g) g.focus();
  PF.raf = requestAnimationFrame(perfTick);
}
function perfClose() {
  if (!PF.on) return; PF.on = false; cancelAnimationFrame(PF.raf); try { if (T.rec && T.playing) stopPlay(true); } catch (e) { }
  if (PF.el) PF.el.remove(); PF.el = null; document.body.classList.remove('perform-on'); if (PF.imm) { PF.imm = false; try { vzImmersive(false); } catch (e) { } }
  try { if (PF.opener && PF.opener.isConnected) PF.opener.focus(); } catch (e) { }
}
function perfSync() {
  if (!PF.el) return; const q = id => document.getElementById(id), on = (id, v) => { const b = q(id); if (b) b.classList.toggle('on', !!v); };
  const p = q('pfPlay'); if (p) p.textContent = T.playing ? '■ Stop' : '▶ Play'; const r = q('pfRec'); if (r) { r.classList.toggle('on', T.rec && T.playing); r.classList.toggle('armed', T.rec && !T.playing); r.textContent = T.rec && T.playing ? '● Recording' : '● Record'; }
  on('pfLoop', T.loop); on('pfMetro', T.metro); const b = q('pfBpm'); if (b) b.textContent = Math.round(S.bpm) + ' BPM';
  const tk = q('pfTakes'); if (tk) { const n = tkLeads().length; tk.textContent = n ? n + ' take' + (n === 1 ? '' : 's') + ' in this song' : ''; }
}
function perfTick() {
  if (!PF.on || !PF.el) return; PF.raf = requestAnimationFrame(perfTick);
  const q = id => document.getElementById(id), set = (id, t) => { const el = q(id); if (el && el.textContent !== t) el.textContent = t; };
  if (!PF.ready) {
    const lv = q('pfLv'); if (lv) lv.style.width = Math.max(0, Math.min(100, (perfLevel() + 60) / 60 * 100)).toFixed(0) + '%';
    const st = [!!E.hasInput, !!CAM.on, !!(E.ctx && E.ctx.state === 'running')].join(); if (st !== PF.st) { if (PF.st) perfRefresh(); PF.st = st; }
  }
  const i = perfInfo(), cnt = T.playing && i.sec === 'Count-in', key = [T.playing, i.sym, i.next, i.secName, i.barIn, i.beat, i.idx, i.lines.length, cnt, S.title, S.ts[0], S.bpm, TAKES.length].join('|');
  if (key === PF.key) return; PF.key = key;
  set('pfSong', S.title || 'Untitled'); set('pfSec', i.secName ? i.secName + (i.nBars ? ' · bar ' + i.barIn + '/' + i.nBars : '') : ''); set('pfMeta', Math.round(S.bpm) + ' BPM · ' + S.ts[0] + '/' + S.ts[1]);
  const dots = q('pfDots'); if (dots) { const n = S.ts[0]; if (dots.children.length !== n) { dots.innerHTML = ''; for (let k = 0; k < n; k++) dots.append(h('i', {})); } [...dots.children].forEach((d, k) => d.classList.toggle('on', T.playing && k === i.beat)); }
  set('pfChord', cnt ? String(i.beat + 1) : (i.sym || '·')); q('pfChord').classList.toggle('pf-count', !!cnt); set('pfNext', cnt ? 'count-in' : (i.next && T.playing ? 'next  ' + i.next : (T.playing ? '' : 'press Play when you are ready')));
  const L = q('pfLyr'); if (L) { L.innerHTML = ''; if (i.lines.length) { const a = Math.max(0, i.idx - 1), z = Math.min(i.lines.length, Math.max(i.idx, 0) + 4); for (let k = a; k < z; k++) L.append(h('div', { class: 'pf-l' + (k === i.idx ? ' cur' : k < i.idx ? ' past' : '') }, ...lyNodes(i.raw[k], k === i.idx ? i.mi : k < i.idx ? 1e9 : -1))); } else L.append(h('div', { class: 'pf-l past' }, 'No lyrics in this section')); }
  perfSync();
}
bus.on('transport', () => { PF.key = ''; perfSync(); }); bus.on('song', () => { PF.key = ''; }); bus.on('takes', () => { PF.key = ''; });
bus.on('rec:done', () => { if (PF.on) { setTimeout(() => { perfSync(); toast('Take saved. It is in your arrangement.', 'ok'); }, 50); } });
document.addEventListener('keydown', e => { if (PF.on && e.key === 'Escape' && !document.querySelector('dialog[open]')) { e.preventDefault(); perfClose(); } });
