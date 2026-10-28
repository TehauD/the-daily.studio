/* ============================================================
   Part 61 · Loop & layer: a looper-pedal way of working on top of the recording engine.
   The engine already records one take per pass of a loop region and plays the earlier takes back while it records the next
   (03-band: tick / recBegin / recEnd). This part adds what a looper player expects around it: one button that sets the loop,
   arms the guitar, clears the band away and starts; layers that are named and counted; a way to stop recording but keep the
   loop playing; a way to take back the last layer; and a pass on which nobody played is never kept.
   Nothing is uploaded. Layers are ordinary takes: move, trim, mute, solo and export them like any other.
   ============================================================ */
const LP = { on: false, bars: 4, pass: 1, finish: false, arm: false, n0: 0, band: false, timer: 0, el: null, starting: false };

/** called by the transport each time the loop comes round (see tick in 03-band) */
function lpWrap() {
  if (!LP.on) return; LP.pass++;
  if (LP.finish) { LP.finish = false; T.rec = false; bus.emit('transport'); }
  else if (LP.arm) { LP.arm = false; T.rec = true; bus.emit('transport'); }
}
/** layers recorded since the loop was started */
const lpLayers = () => TAKES.slice(LP.n0);

async function looperStart(o = {}) {
  const bars = [1, 2, 4, 8].includes(+o.bars) ? +o.bars : (CFG.loopBars || 4), band = o.band != null ? !!o.band : !!CFG.loopBand;
  CFG.loopBars = bars; CFG.loopBand = band; saveCfg();
  try { await startAudio(); } catch (e) { toast('Audio could not start: ' + e.message, 'bad'); return false; }
  if (!E.hasInput) { toast('Connect your guitar or microphone first (Audio at the top right), then start the loop.', 'warn'); try { audioOpen(); } catch (e) { } return false; }
  if (T.playing) stopPlay(true);
  const A = Math.floor(playheadSlot() / spb()) * spb(), need = A / spb() + bars; let guard = 0;
  while (totalBars() < need && guard++ < 64) S.sections[S.sections.length - 1].bars.push(newBar('')); T.bars = null;
  T.loop = true; T.loopA = A; T.loopB = A + bars * spb(); T.cursor = A; T.metro = true; CFG.armG = true;
  if (!band) setRehearsal({ drumsOn: false, bassOn: false, compOn: false, leadOn: false, click: true });
  else setRehearsal({ drumsOn: true, bassOn: true, compOn: true, click: true });
  if (CFG.countIn < 1) CFG.countIn = 1;
  commit(false); LP.on = true; LP.bars = bars; LP.band = band; LP.pass = 1; LP.silent = 0; LP.finish = false; LP.arm = false; LP.n0 = TAKES.length; T.rec = true;
  syncTransport(); TL.dirty = true; lpHud(true); LP.starting = true; try { await play(true); } finally { LP.starting = false; } return true;
}
function looperKeep() { if (!LP.on || !T.rec) return; LP.finish = true; LP.arm = false; lpHudDraw(); }          // stop recording at the end of this pass; the loop keeps playing
function looperMore() { if (!LP.on || T.rec) return; LP.arm = true; LP.finish = false; lpHudDraw(); }          // the next pass records another layer
function looperUndo() {
  const l = lpLayers(), last = l[l.length - 1]; if (!last) { toast('No layer to take back yet.', 'warn'); return false; }
  const ok = tkDelete(last); lpHudDraw(); return ok;
}
function looperEnd() { if (T.playing) stopPlay(true); LP.on = false; lpHud(false); }
bus.on('transport', () => { if (LP.on && !T.playing && !LP.starting) { LP.on = false; lpHud(false); } });

/* ---------- the strip while the loop runs ---------- */
function lpState() {
  if (!LP.on) return null; const n = lpLayers().length;
  if (!T.playing) return { t: 'Starting…', rec: true, n };
  if (T.rec && !REC && T.slot < T.loopA) return { t: 'Count-in…', rec: true, n };
  if (REC && REC.cycle) return { t: 'Recording layer ' + (n + 1), rec: true, n };
  if (T.rec) return { t: 'Recording starts on the next pass', rec: true, n };
  if (LP.arm) return { t: 'Next pass records a layer', rec: false, n };
  if (LP.silent && !n) return { t: 'Nothing heard yet · check your input', rec: !!T.rec, n };
  return { t: n ? 'Looping ' + n + ' layer' + (n === 1 ? '' : 's') : 'Looping', rec: false, n };
}
function lpHud(on) {
  clearInterval(LP.timer); LP.timer = 0; if (!on) { if (LP.el) { LP.el.remove(); LP.el = null; } return; }
  if (!LP.el || !LP.el.isConnected) { LP.el = h('div', { id: 'lpHud', class: 'lp-hud', role: 'group', 'aria-label': 'Loop and layer' }); document.body.append(LP.el); }
  lpHudDraw(true); LP.timer = setInterval(lpHudDraw, 250);
}
function lpHudDraw(force) {
  const el = LP.el; if (!el || !el.isConnected) return; const s = lpState(); if (!s) return;
  const key = [s.t, s.rec, s.n, LP.pass, LP.finish, LP.arm].join('|'); if (!force && el.dataset.key === key) return; el.dataset.key = key; el.classList.toggle('rec', !!s.rec); el.innerHTML = '';
  el.append(h('span', { class: 'lp-dot', 'aria-hidden': 'true' }), h('b', { class: 'lp-t', id: 'lpState' }, s.t), h('span', { class: 'lp-m' }, '⟲ ' + LP.bars + ' bar' + (LP.bars === 1 ? '' : 's') + ' · pass ' + LP.pass),
    T.rec ? h('button', { class: 'btn sm', id: 'lpKeep', disabled: LP.finish, title: 'Stop recording at the end of this pass. The loop keeps playing so you can listen.', onclick: looperKeep }, LP.finish ? 'Stops after this pass' : 'Keep looping') : h('button', { class: 'btn sm', id: 'lpMore', disabled: LP.arm, title: 'Record another layer on the next pass', onclick: looperMore }, LP.arm ? 'Records next pass' : '● Add a layer'),
    h('button', { class: 'btn sm', id: 'lpUndo', disabled: !s.n, title: 'Take back the last layer', onclick: looperUndo }, '↶ Undo layer'),
    h('button', { class: 'btn sm', id: 'lpStop', title: 'Stop everything. Your layers stay in the arrangement.', onclick: looperEnd }, '■ Stop'));
}

/* ---------- the window that starts it ---------- */
function looperOpen() {
  const st = { bars: CFG.loopBars || 4, band: !!CFG.loopBand };
  const seg = (opts, get, set) => { const row = h('div', { class: 'seg', role: 'group' }); const draw = () => { row.innerHTML = ''; opts.forEach(([k, n]) => row.append(h('button', { class: String(get()) === String(k) ? 'on' : '', 'aria-pressed': String(String(get()) === String(k)), onclick: () => { set(k); draw(); } }, n))); }; draw(); return row; };
  const body = h('div', { class: 'lp-dlg' },
    h('p', { class: 'muted small' }, 'Record a part, hear it come round, and play the next part on top, the way a looper pedal works. Each pass of the loop records one layer and the earlier layers keep playing. Layers are ordinary tracks, so you can move, trim, mute and export them afterwards.'),
    h('div', { class: 'pd-form' }, pField('Loop length', seg([[1, '1 bar'], [2, '2 bars'], [4, '4 bars'], [8, '8 bars']], () => st.bars, v => { st.bars = +v; })),
      pField('Backing band', seg([[false, 'Off · click only'], [true, 'On']], () => st.band, v => { st.band = v === true || v === 'true'; }))),
    h('ol', { class: 'lp-how small' }, h('li', {}, 'Press Start. A bar of clicks counts you in.'), h('li', {}, 'Play your chords for one pass. That is layer 1.'), h('li', {}, 'It loops back by itself. Play a lead on top. That is layer 2, and so on.'), h('li', {}, 'Press Keep looping to stop recording and just listen. Undo layer takes the last one back.')),
    h('div', { class: 'row', style: { gap: '8px' } }, h('button', { class: 'btn primary', id: 'lpGo', onclick: async () => { d.close(); await looperStart({ bars: st.bars, band: st.band }); } }, '● Start looping'), h('span', { class: 'tiny muted' }, 'Use headphones if you play through speakers.')));
  const d = pdlg('lpDlg', 'LOOP & LAYER', body); return d;
}
