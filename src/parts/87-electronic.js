/* ============================================================
   Part 87 · ELECTRONIC (2.37) — a piano roll, sidechain ducking and MIDI out
     · 🎛 Piano roll: draw the keys part or the bass line of a section on a grid of 16ths (click to add, drag to lengthen, click a note
       to remove it, Shift-click for loud/medium/soft), only the scale's notes if you like, and loop the section while you draw. It
       writes the same notes as recording in the Keys room does (part 86), so what you play and what you draw are one part.
     · Sidechain: every kick pushes the keys, the bass, the rhythm guitar or the loaded track down and lets them swell back, the pumping
       of dance music. Depth and release are yours; it is in bounces too, because the kick and the duck share the band's clock.
     · MIDI out: the keys part, the bass (played or made up) and the drums go to a MIDI device on their own channels (1, 2 and 10 by
       default; drums as General MIDI notes), timed to what you hear. "Also play the studio's own sound" off lets the hardware take over.
       Playing the Keys room sends too, so a controller can play a synth through the studio.
   ============================================================ */
CFG.midiOut = Object.assign({ on: false, out: '', keys: 1, bass: 2, drums: 10, local: true, parts: { keys: true, bass: true, drums: true } }, CFG.midiOut || {});
const RL = { part: 'keys', sec: 0, lo: { keys: 48, bass: 28 }, rows: 25, scaleOnly: false, drag: null };
const GM_DRUM = [36, 38, 42, 46, 39, 45];

/* ---------- sidechain ---------- */
const duckCfg = () => S.duck && typeof S.duck === 'object' ? S.duck : { on: false, amt: 9, rel: 180, to: ['keys', 'bass', 'track'] };
function duckNode(id) { return id === 'track' ? (typeof STP !== 'undefined' ? STP.duck : null) : (E.tr && E.tr[id] ? E.tr[id].duck : null); }
/** a kick at time t: the chosen tracks dip and swell back */
function duckAt(t) {
  const D = duckCfg(); if (!D.on) return; const lvl = Math.pow(10, -clamp(+D.amt || 9, 0, 24) / 20), rel = clamp(+D.rel || 180, 30, 800) / 1000;
  (D.to || []).forEach(id => { const g = duckNode(id); if (!g || g.context !== E.ctx) return; const p = g.gain; try { p.cancelScheduledValues(t); p.setTargetAtTime(lvl, t, .004); p.setTargetAtTime(1, t + .025, rel / 3); } catch (e) { } });
}
function duckSet(o) {
  S.duck = Object.assign({}, duckCfg(), o); commit(false);
  if (!S.duck.on || o.to) ['keys', 'bass', 'rhythm', 'lead', 'track'].forEach(id => { const g = duckNode(id); if (g) { try { g.gain.cancelScheduledValues(0); g.gain.value = 1; } catch (e) { } } });
}

/* ---------- MIDI out ---------- */
function moDev() { const M = CFG.midiOut; if (!M.on || typeof MIDI === 'undefined' || !MIDI.access) return null; const outs = [...MIDI.access.outputs.values()]; return outs.find(o => o.id === M.out) || null; }
/** one note out, at audio-clock time t, for `part` (keys, bass, drums); true if it went */
function moNote(part, t, m, v, dur) {
  const M = CFG.midiOut; if (!M.on || !M.parts[part] || !E.ctx) return false; const d = moDev(); if (!d) return false;
  const c = E.ctx, ch = clamp((M[part] || 1) - 1, 0, 15), ts = performance.now() + (t - c.currentTime + (c.outputLatency || c.baseLatency || 0)) * 1000, vel = clamp(Math.round((v || .8) * 127), 1, 127);
  try { d.send([0x90 | ch, m, vel], Math.max(performance.now(), ts)); d.send([0x80 | ch, m, 0], Math.max(performance.now(), ts) + Math.max(20, (dur || .2) * 1000)); MO.used.add(ch); MO.n++; return true; } catch (e) { return false; }
}
const MO = { used: new Set(), n: 0, live: new Map() };
function moLive(on, m, v) {
  const M = CFG.midiOut; if (!M.on || !M.parts.keys) return false; const d = moDev(); if (!d) return false; const ch = clamp((M.keys || 1) - 1, 0, 15);
  try { if (on) d.send([0x90 | ch, m, clamp(Math.round((v || .8) * 127), 1, 127)]); else d.send([0x80 | ch, m, 0]); MO.used.add(ch); return true; } catch (e) { return false; }
}
/** all notes off on the channels used, when the studio stops */
function moPanic() { const d = moDev(); if (!d) return; MO.used.forEach(ch => { try { d.send([0xB0 | ch, 123, 0]); } catch (e) { } }); }
bus.on('transport', () => { if (!T.playing && MO.n) moPanic(); });
const moLocal = part => { const M = CFG.midiOut; return !(M.on && M.parts[part] && moDev()) || M.local; };
/** the keys player and the keys part go through here: out to MIDI and/or the studio's own sound */
function kyOut(t, m, v, dur, sound) { moNote('keys', t, m, v, dur); if (moLocal('keys')) return keysVoice(t, m, v, dur, sound); return null; }
function bassOut(t, m, v, dur) { moNote('bass', t, m, v, dur); if (moLocal('bass')) pluck('bass', t, m, v, { id: 'b', pan: 0 }); }
/** drums: out as General MIDI notes; true when the studio's own drum should stay quiet */
function moDrum(row, t, v) { const sent = moNote('drums', t, GM_DRUM[row] || 37, [0, .5, .8, 1][v] || .8, .08); return sent && !CFG.midiOut.local; }
function moSettings() {
  const M = CFG.midiOut, outs = typeof MIDI !== 'undefined' && MIDI.access ? [...MIDI.access.outputs.values()] : [], box = h('div', { class: 'gear mo' });
  const draw = () => {
    box.innerHTML = ''; const outsNow = typeof MIDI !== 'undefined' && MIDI.access ? [...MIDI.access.outputs.values()] : [];
    box.append(h('h4', { class: 'gear-h' }, 'MIDI out'),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'moOn', checked: !!M.on, onchange: async e => { M.on = e.target.checked; saveCfg(); if (M.on && !MIDI.access) { try { await initMIDI(); } catch (er) { } } draw(); } }), 'Send the keys, the bass and the drums to a MIDI device'),
      !M.on ? null : h('label', { class: 'field' }, h('span', {}, 'Send to'), outsNow.length ? h('select', { class: 'in', id: 'moOut', onchange: e => { M.out = e.target.value; saveCfg(); } }, [h('option', { value: '' }, 'Choose…')].concat(outsNow.map(o => h('option', { value: o.id, selected: o.id === M.out }, o.name)))) : h('span', { class: 'small muted' }, 'No MIDI output found. Connect a synth or a drum machine (Chrome or Edge).')),
      !M.on ? null : h('div', { class: 'mo-parts' }, [['keys', 'Keys'], ['bass', 'Bass'], ['drums', 'Drums']].map(([k, t]) => h('span', { class: 'mo-part' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', 'data-mo': k, checked: !!M.parts[k], onchange: e => { M.parts[k] = e.target.checked; saveCfg(); } }), t),
        h('select', { class: 'in', 'aria-label': t + ' MIDI channel', 'data-moch': k, onchange: e => { M[k] = +e.target.value; saveCfg(); } }, Array.from({ length: 16 }, (_, i) => h('option', { value: i + 1, selected: M[k] === i + 1 }, 'ch ' + (i + 1))))))),
      !M.on ? null : h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'moLocal', checked: !!M.local, onchange: e => { M.local = e.target.checked; saveCfg(); } }), 'Also play the studio’s own sound'),
      h('p', { class: 'hub-note' }, 'Timed to what you hear. Drums go as General MIDI notes (kick 36, snare 38, hats 42 and 46, clap 39, tom 45). Playing the Keys room sends too, so a keyboard can play your synth through the studio.'));
  }; draw(); return box;
}

/* ---------- 🎛 Piano roll ---------- */
const rlNotes = (bar, part) => part === 'bass' ? (bar.bassLine = bar.bassLine || []) : (bar.keys = bar.keys || []);
function rollOpen(part, sec) {
  if (part) RL.part = part; RL.sec = sec != null ? sec : pedalSecs().i;
  let d = document.getElementById('rollRoom'); if (!d) { d = h('dialog', { class: 'keys-room roll-room', id: 'rollRoom', 'aria-labelledby': 'rollT' }); document.body.append(d); d.addEventListener('close', () => { if (RL.looping && T.playing) stopPlay(true); RL.looping = false; }); }
  rollBuild(); if (!d.open) d.showModal(); startAudio(); return d;
}
function rollRows() { const lo = RL.lo[RL.part], scale = (SCALES[S.scale] || SCALES['Major (Ionian)']).map(i => (S.key + i) % 12), out = []; for (let m = lo + RL.rows - 1; m >= lo; m--) if (!RL.scaleOnly || scale.includes(m % 12)) out.push(m); return { rows: out, scale }; }
function rollBuild() {
  const d = document.getElementById('rollRoom'); if (!d) return; d.innerHTML = ''; const sec = S.sections[RL.sec]; if (!sec) return; const sp = spb();
  const { rows, scale } = rollRows(), cols = sec.bars.length * sp, CW = 20, RH = 16, LW = 36, W = LW + cols * CW, H = rows.length * RH;
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), el = (t, a, txt) => { const e = document.createElementNS(ns, t); Object.entries(a).forEach(([k, v]) => e.setAttribute(k, v)); if (txt != null) e.textContent = txt; svg.append(e); return e; };
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('class', 'rl-svg'); svg.setAttribute('role', 'grid'); svg.setAttribute('aria-label', 'Piano roll: ' + (RL.part === 'bass' ? 'bass line' : 'keys part') + ' of ' + sec.name);
  rows.forEach((m, r) => { const pc = m % 12; el('rect', { x: LW, y: r * RH, width: cols * CW, height: RH, class: 'rl-row' + (KY_BLACK.includes(pc) ? ' bl' : '') + (scale.includes(pc) ? ' sc' : '') + (pc === S.key ? ' root' : '') }); el('text', { x: LW - 4, y: r * RH + RH - 4, class: 'rl-lab' + (pc === S.key ? ' root' : '') }, pcName(pc, CFG.flats) + (pc === 0 || m === rows[rows.length - 1] ? Math.floor(m / 12 - 1) : '')); });
  for (let c = 0; c <= cols; c++) el('line', { x1: LW + c * CW, x2: LW + c * CW, y1: 0, y2: H, class: c % sp === 0 ? 'rl-bar' : c % 4 === 0 ? 'rl-beat' : 'rl-step' });
  sec.bars.forEach((bar, bi) => rlNotes(bar, RL.part).forEach((n, k) => { const r = rows.indexOf(n.m); if (r < 0) return; el('rect', { x: LW + (bi * sp + n.s) * CW + 1, y: r * RH + 1, width: Math.max(4, (n.d || 1) * CW - 2), height: RH - 2, rx: 3, class: 'rl-note', 'data-bi': bi, 'data-k': k, style: 'opacity:' + (.45 + .55 * (n.v || .8)) }); }));
  RL.ph = el('line', { x1: -10, x2: -10, y1: 0, y2: H, class: 'rl-ph' }); svg._g = { LW, CW, RH, rows, sp, cols };
  const at = e => { const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height; return { c: Math.floor((x - LW) / CW), r: Math.floor(y / RH) }; };
  svg.addEventListener('pointerdown', e => {
    const t = e.target, bf = snap();
    if (t.classList && t.classList.contains('rl-note')) { const bar = sec.bars[+t.dataset.bi], arr = rlNotes(bar, RL.part), n = arr[+t.dataset.k]; if (!n) return; if (e.shiftKey) n.v = n.v >= .95 ? .5 : n.v >= .75 ? 1 : .8; else arr.splice(+t.dataset.k, 1); T.bars = null; histPush(bf); rollBuild(); return; }
    const p = at(e); if (p.c < 0 || p.c >= cols || p.r < 0 || p.r >= rows.length) return; const bi = Math.floor(p.c / sp), n = { s: p.c % sp, m: rows[p.r], d: 1, v: .8 };
    rlNotes(sec.bars[bi], RL.part).push(n); if (RL.part === 'keys') S.band.keysOn = true; else S.band.bassOn = true; T.bars = null;
    try { startAudio(); if (RL.part === 'bass') pluck('bass', E.ctx.currentTime + .01, n.m, .8, { id: 'rl' }); else keysVoice(E.ctx.currentTime + .01, n.m, .8, .25); } catch (er) { }
    RL.drag = { n, c0: p.c, bf, bi }; try { svg.setPointerCapture(e.pointerId); } catch (er) { } rollPaintNotes(svg, sec);
  });
  svg.addEventListener('pointermove', e => { if (!RL.drag) return; const p = at(e), dd = Math.max(1, Math.min(sp * 4 - RL.drag.n.s, p.c - RL.drag.c0 + 1)); if (dd !== RL.drag.n.d) { RL.drag.n.d = dd; rollPaintNotes(svg, sec); } });
  const up = () => { if (!RL.drag) return; const g = RL.drag; RL.drag = null; histPush(g.bf); try { syncBandStrip(); } catch (er) { } rollBuild(); }; svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  const head = h('div', { class: 'co-top' }, h('div', { class: 'co-tt' }, h('small', {}, 'Draw it'), h('b', { id: 'rollT' }, '🎛 Piano roll')), h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Close the piano roll', onclick: () => d.close() }, '✕'));
  const ctl = h('div', { class: 'ky-ctl' },
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Part', id: 'rlPart' }, [['keys', '🎹 Keys'], ['bass', 'Bass']].map(([v, t]) => h('button', { type: 'button', class: RL.part === v ? 'on' : '', 'aria-pressed': String(RL.part === v), 'data-p': v, onclick: () => { RL.part = v; rollBuild(); } }, t))),
    h('label', { class: 'field' }, 'Section', h('select', { class: 'in', id: 'rlSec', onchange: e => { RL.sec = +e.target.value; rollBuild(); } }, S.sections.map((s, i) => h('option', { value: i, selected: i === RL.sec }, s.name)))),
    h('span', { class: 'ky-oct' }, h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Lower', onclick: () => { RL.lo[RL.part] = Math.max(21, RL.lo[RL.part] - 12); rollBuild(); } }, '▼'), h('b', { class: 'mono' }, pcName(RL.lo[RL.part] % 12, false) + Math.floor(RL.lo[RL.part] / 12 - 1)), h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Higher', onclick: () => { RL.lo[RL.part] = Math.min(96, RL.lo[RL.part] + 12); rollBuild(); } }, '▲')),
    h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'rlScale', checked: RL.scaleOnly, onchange: e => { RL.scaleOnly = e.target.checked; rollBuild(); } }), 'Only the scale’s notes'),
    h('button', { class: 'btn' + (RL.looping && T.playing ? ' on' : ' primary'), id: 'rlPlay', type: 'button', onclick: rollLoop }, RL.looping && T.playing ? '■ Stop' : '▶ Loop this section'),
    h('button', { class: 'btn sm', id: 'rlClear', type: 'button', onclick: () => { const bf = snap(); sec.bars.forEach(b => { if (RL.part === 'bass') b.bassLine = []; else b.keys = []; }); T.bars = null; histPush(bf); rollBuild(); } }, 'Clear'));
  d.append(head, ctl, h('div', { class: 'rl-wrap' }, svg), h('p', { class: 'tiny muted' }, 'Click a square to add a note, drag right to make it longer; click a note to remove it, Shift-click to make it loud, medium or soft. It is the same part the Keys room records into' + (RL.part === 'bass' ? ': in these bars it replaces the made-up bass.' : '.')), duckView());
}
function rollPaintNotes(svg, sec) { svg.querySelectorAll('.rl-note').forEach(n => n.remove()); const { LW, CW, RH, rows, sp } = svg._g, ns = 'http://www.w3.org/2000/svg'; sec.bars.forEach((bar, bi) => rlNotes(bar, RL.part).forEach((n, k) => { const r = rows.indexOf(n.m); if (r < 0) return; const e = document.createElementNS(ns, 'rect'); Object.entries({ x: LW + (bi * sp + n.s) * CW + 1, y: r * RH + 1, width: Math.max(4, (n.d || 1) * CW - 2), height: RH - 2, rx: 3, class: 'rl-note', 'data-bi': bi, 'data-k': k }).forEach(([a, v]) => e.setAttribute(a, v)); svg.insertBefore(e, RL.ph); })); }
async function rollLoop() {
  if (RL.looping && T.playing) { RL.looping = false; stopPlay(true); rollBuild(); return; }
  const sp = spb(), start = S.sections.slice(0, RL.sec).reduce((a, s) => a + s.bars.length, 0) * sp, len = S.sections[RL.sec].bars.length * sp;
  if (T.playing) stopPlay(true); T.loop = true; T.loopA = start; T.loopB = start + len; T.cursor = start; syncTransport(); RL.looping = true; await play(); rollBuild();
}
/* the playhead moves across the roll while it plays */
(function rlLoop() { requestAnimationFrame(rlLoop); const d = document.getElementById('rollRoom'); if (!d || !d.open || !RL.ph || !T.playing) return; const svg = RL.ph.ownerSVGElement; if (!svg || !svg._g) return; const { LW, CW, sp } = svg._g, start = S.sections.slice(0, RL.sec).reduce((a, s) => a + s.bars.length, 0) * sp, x = LW + (playheadSlot() - start) * CW; RL.ph.setAttribute('x1', x); RL.ph.setAttribute('x2', x); })();

/* ---------- the sidechain block (in the piano roll and the Keys room) ---------- */
function duckView() {
  const D = duckCfg(), tgt = (k, t) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', 'data-duck': k, checked: (D.to || []).includes(k), onchange: e => { const to = new Set(duckCfg().to || []); if (e.target.checked) to.add(k); else to.delete(k); duckSet({ to: [...to] }); } }), t);
  return h('div', { class: 'ky-band duck' },
    h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'duckOn', checked: !!D.on, onchange: e => duckSet({ on: e.target.checked }) }), h('b', {}, 'Sidechain: duck to the kick')),
    h('label', { class: 'field' }, 'Depth', h('input', { type: 'range', id: 'duckAmt', min: 0, max: 18, step: 1, value: D.amt || 9, onchange: e => duckSet({ amt: +e.target.value }) })),
    h('label', { class: 'field' }, 'Release', h('input', { type: 'range', id: 'duckRel', min: 60, max: 500, step: 10, value: D.rel || 180, onchange: e => duckSet({ rel: +e.target.value }) })),
    h('span', { class: 'duck-to' }, tgt('keys', 'Keys'), tgt('bass', 'Bass'), tgt('rhythm', 'Rhythm gtr'), tgt('track', 'Track')));
}
