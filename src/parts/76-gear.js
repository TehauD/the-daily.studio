/* ============================================================
   Part 76 · GEAR (2.29) — a foot pedal for hands-free playing, and MIDI clock to keep other gear in time
   Foot pedal: Bluetooth page-turner pedals type keys (Page Down, Page Up, the arrows, Space, Enter); MIDI footswitches send a control
   change, a note or a program change. Settings ▸ Pedal & MIDI sync: switch it on, press Learn beside an action and step on the pedal.
   Actions: play / stop, next section, previous section, record, loop, the band on / off, tap tempo. Nothing is mapped until it is on.
   MIDI clock: Send puts out 24 clocks a quarter note on the band's own schedule (the same audio clock, timed by Web MIDI's timestamps),
   with Start (or Song Position and Continue) and Stop, so a drum machine, a synth or a DAW follows the studio. Follow does the reverse:
   the studio takes its tempo from incoming clock and starts and stops with it.
   ============================================================ */
CFG.pedal = Object.assign({ on: false, map: { play: ['k:PageDown', 'k:ArrowRight'], next: ['k:PageUp', 'k:ArrowLeft'] } }, CFG.pedal && typeof CFG.pedal === 'object' ? CFG.pedal : {});
CFG.mclock = Object.assign({ mode: 'off', out: '' }, CFG.mclock && typeof CFG.mclock === 'object' ? CFG.mclock : {});
const PEDAL_ACTS = [['play', 'Play / stop'], ['next', 'Next section'], ['prev', 'Previous section (or the top of this one)'], ['rec', 'Record'], ['loop', 'Loop on / off'], ['mute', 'The band on / off'], ['tap', 'Tap tempo']];
const PEDAL = { learn: null, last: {}, taps: [] };
const pedalName = c => { const [k, v] = [c.slice(0, c.indexOf(':')), c.slice(c.indexOf(':') + 1)]; return k === 'k' ? (v === ' ' ? 'Space' : v) : k === 'cc' ? 'MIDI CC ' + v : k === 'note' ? 'MIDI note ' + v : k === 'pc' ? 'MIDI program ' + v : c; };

/* ---------- the actions ---------- */
/** the first slot of each section, and which one the playhead is in */
function pedalSecs() { const sp = spb(), at = []; let s = 0; S.sections.forEach(sec => { at.push(s * sp); s += sec.bars.length; }); const cur = T.playing ? playheadSlot() : T.cursor; let i = 0; at.forEach((a, k) => { if (cur >= a) i = k; }); return { at, i, cur }; }
async function pedalJump(slot) { const was = T.playing; if (was) stopPlay(true); T.cursor = Math.max(0, slot); bus.emit('transport'); if (was) await play(); }
function pedalTap() {
  const now = performance.now(); if (PEDAL.taps.length && now - PEDAL.taps[PEDAL.taps.length - 1] > 2000) PEDAL.taps = []; PEDAL.taps.push(now); if (PEDAL.taps.length > 8) PEDAL.taps.shift(); if (PEDAL.taps.length < 4) return;
  const d = PEDAL.taps.slice(1).map((t, i) => t - PEDAL.taps[i]).sort((a, b) => a - b), bpm = Math.round(60000 / d[Math.floor(d.length / 2)]); if (bpm >= 40 && bpm <= 240 && bpm !== S.bpm) { S.bpm = bpm; commit(false); try { syncTransport(); } catch (e) { } toast('Tempo ' + bpm, 'ok'); }
}
function pedalDo(act) {
  const s = pedalSecs();
  switch (act) {
    case 'play': T.playing ? stopPlay(true) : play(); break;
    case 'next': if (s.i + 1 < s.at.length) pedalJump(s.at[s.i + 1]); break;
    case 'prev': pedalJump(s.cur - s.at[s.i] > spb() || s.i === 0 ? s.at[s.i] : s.at[s.i - 1]); break;
    case 'rec': toggleRec(); break;
    case 'loop': T.loop = !T.loop; syncTransport(); break;
    case 'mute': bandMute(); break;
    case 'tap': pedalTap(); break;
  }
  bus.emit('pedal', act);
}
/** a pedal press, whatever it came from (c: 'k:PageDown', 'cc:64', 'note:60', 'pc:3'); true when it was used */
function pedalPress(c) {
  if (PEDAL.learn) { const a = PEDAL.learn; PEDAL.learn = null; Object.keys(CFG.pedal.map).forEach(k => { CFG.pedal.map[k] = (CFG.pedal.map[k] || []).filter(x => x !== c); }); (CFG.pedal.map[a] = CFG.pedal.map[a] || []).push(c); CFG.pedal.on = true; saveCfg(); bus.emit('pedal:map'); toast(pedalName(c) + ' → ' + PEDAL_ACTS.find(x => x[0] === a)[1], 'ok'); return true; }
  if (!CFG.pedal.on) return false; const act = Object.keys(CFG.pedal.map).find(k => (CFG.pedal.map[k] || []).includes(c)); if (!act) return false;
  const now = performance.now(); if (now - (PEDAL.last[c] || 0) < 180) return true; PEDAL.last[c] = now;      /* a pedal that bounces is one press (each pedal on its own: two pedals can be pressed quickly) */
  pedalDo(act); return true;
}
window.addEventListener('keydown', e => {
  if (!CFG.pedal.on && !PEDAL.learn) return; const t = e.target; if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable))) return;
  if (['Shift', 'Control', 'Alt', 'Meta', 'Escape', 'Tab'].includes(e.key)) return;
  if (pedalPress('k:' + e.key)) { e.preventDefault(); e.stopImmediatePropagation(); }      /* the page does not scroll, and the key's usual job does not run as well */
}, true);

/* ---------- MIDI: pedals, and clock in ---------- */
const MCLK = { ticks: [], last: 0, run: false, sent: false, follow: 0 };
MIDIRAW.push((data, ev) => {
  const st = data[0], cmd = st & 0xf0;
  if (CFG.mclock.mode === 'follow' && st >= 0xF8) {
    if (st === 0xF8) { const t = ev && ev.timeStamp ? ev.timeStamp : performance.now(); MCLK.ticks.push(t); if (MCLK.ticks.length > 49) MCLK.ticks.shift();
      if (MCLK.ticks.length >= 25 && t - MCLK.follow > 500) { const n = MCLK.ticks.length - 1, per = (MCLK.ticks[n] - MCLK.ticks[0]) / n, bpm = Math.round(600000 / (per * 24)) / 10; MCLK.follow = t; if (bpm >= 30 && bpm <= 300 && Math.abs(bpm - S.bpm) >= .5) { S.bpm = Math.round(bpm); commit(false); try { syncTransport(); } catch (e) { } } } }
    else if (st === 0xFA) { MCLK.ticks = []; if (T.playing) stopPlay(true); T.cursor = 0; play(); }
    else if (st === 0xFB) { if (!T.playing) play(); }
    else if (st === 0xFC) { if (T.playing) stopPlay(true); }
    return true;
  }
  if (CFG.mclock.mode === 'follow' && st === 0xF2) { const pos = data[1] | (data[2] << 7); T.cursor = clamp(pos, 0, Math.max(0, songSlots() - 1)); bus.emit('transport'); return true; }      /* Song Position: in 16ths, as a slot is */
  if (st >= 0xF8) return true;      /* clock we are not following: not a note, not a control */
  if (cmd === 0xB0 && data[2] >= 64 && (PEDAL.learn || (CFG.pedal.on && Object.values(CFG.pedal.map).some(a => a.includes('cc:' + data[1]))))) return pedalPress('cc:' + data[1]);
  if (cmd === 0xB0 && data[2] < 64 && CFG.pedal.on && Object.values(CFG.pedal.map).some(a => a.includes('cc:' + data[1]))) return true;      /* the pedal coming back up */
  if (cmd === 0x90 && data[2] > 0 && (PEDAL.learn || (CFG.pedal.on && Object.values(CFG.pedal.map).some(a => a.includes('note:' + data[1]))))) return pedalPress('note:' + data[1]);
  if (cmd === 0xC0 && (PEDAL.learn || (CFG.pedal.on && Object.values(CFG.pedal.map).some(a => a.includes('pc:' + data[1]))))) return pedalPress('pc:' + data[1]);
  return false;
});

/* ---------- MIDI clock out ---------- */
function mclkOut() { if (CFG.mclock.mode !== 'send' || !MIDI.access) return null; const outs = [...MIDI.access.outputs.values()]; return outs.find(o => o.id === CFG.mclock.out) || (CFG.mclock.out ? null : outs[0]) || null; }
/** the audio clock in the page's own milliseconds (what Web MIDI times by), as heard: getOutputTimestamp already counts the output's delay */
function mclkMs(t) { const c = E.ctx; let ts = null; try { ts = c.getOutputTimestamp && c.getOutputTimestamp(); } catch (e) { } if (ts && ts.performanceTime) return ts.performanceTime + (t - ts.contextTime) * 1000; return performance.now() + (t - c.currentTime + (c.outputLatency || c.baseLatency || 0)) * 1000; }
/** called for every slot the band schedules (part 03): six clocks a 16th; Start at the song's first slot, or Song Position + Continue */
function mclkSlot(slot, time) {
  const o = mclkOut(); if (!o) return; const d = slotDur() / 6;
  try {
    if (slot >= 0 && !MCLK.sent) { MCLK.sent = true; const at = mclkMs(time); if (slot === 0) o.send([0xFA], at); else { o.send([0xF2, slot & 127, (slot >> 7) & 127], at); o.send([0xFB], at); } }
    if (slot >= 0) for (let k = 0; k < 6; k++) o.send([0xF8], mclkMs(time + k * d));
  } catch (e) { console.warn('[midi clock]', e); }
}
bus.on('transport', () => { if (T.playing) return; if (MCLK.sent) { const o = mclkOut(); try { o && o.send([0xFC]); } catch (e) { } } MCLK.sent = false; });

/* ---------- Settings ▸ Pedal & MIDI sync ---------- */
function gearSettings() {
  const box = h('div', { class: 'gear' }), draw = () => {
    box.innerHTML = ''; const outs = MIDI.access ? [...MIDI.access.outputs.values()] : [];
    box.append(h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'pedalOn', checked: !!CFG.pedal.on, onchange: e => { CFG.pedal.on = e.target.checked; saveCfg(); } }), 'Foot pedal: use the presses below'),
      h('p', { class: 'hub-note' }, 'A Bluetooth page-turner pedal types a key; a MIDI footswitch sends a control, a note or a program change. Press Learn, then step on the pedal. Out of the box, Page Down or → plays and stops, Page Up or ← goes to the next section.'),
      h('div', { class: 'gear-map' }, PEDAL_ACTS.map(([a, label]) => h('div', { class: 'gear-row' }, h('span', { class: 'gear-act' }, label), h('span', { class: 'gear-keys mono', 'data-act': a }, (CFG.pedal.map[a] || []).map(pedalName).join(' · ') || '—'),
        h('button', { class: 'btn sm' + (PEDAL.learn === a ? ' on' : ''), 'data-learn': a, onclick: () => { PEDAL.learn = PEDAL.learn === a ? null : a; if (PEDAL.learn && !MIDI.access && CFG.midi !== false) initMIDI(); draw(); } }, PEDAL.learn === a ? 'Step on it…' : 'Learn'),
        h('button', { class: 'btn sm', 'aria-label': 'Clear ' + label, onclick: () => { CFG.pedal.map[a] = []; saveCfg(); draw(); } }, '✕')))),
      h('h4', { class: 'gear-h' }, 'MIDI clock'),
      h('label', { class: 'field' }, h('span', {}, 'Clock'), h('select', { class: 'in', id: 'mclkMode', onchange: async e => { CFG.mclock.mode = e.target.value; saveCfg(); if (e.target.value !== 'off' && !MIDI.access) { await initMIDI(); } draw(); } }, [['off', 'Off'], ['send', 'Send: other gear follows the studio'], ['follow', 'Follow: the studio follows other gear']].map(([v, t]) => h('option', { value: v, selected: CFG.mclock.mode === v }, t)))),
      ...(CFG.mclock.mode !== 'send' ? [] : [h('label', { class: 'field' }, h('span', {}, 'Send to'), outs.length ? h('select', { class: 'in', id: 'mclkOut', onchange: e => { CFG.mclock.out = e.target.value; saveCfg(); } }, outs.map(o => h('option', { value: o.id, selected: o.id === CFG.mclock.out }, o.name))) : h('span', { class: 'small muted' }, MIDI.access ? 'No MIDI outputs. Connect the gear, or a virtual MIDI port to reach music software on this computer.' : 'MIDI is not on yet.'))]),
      h('p', { class: 'hub-note' }, 'Clock is 24 pulses a quarter note, with Start, Stop and Song Position, timed to the band’s own audio clock. It needs Chrome or Edge (Web MIDI). Gear that follows smooths it out; a computer program may want a few milliseconds of offset set in its own MIDI settings.'));
  };
  draw(); box._draw = draw; return box;
}
bus.on('pedal:map', () => { const g = document.querySelector('#settings .gear'); if (g && g._draw) g._draw(); });
bus.on('midi', () => { const g = document.querySelector('#settings .gear'); if (g && g._draw) g._draw(); });
