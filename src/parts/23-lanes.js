/* ============================================================
   Part 23 · DAW LANES — the arrangement behaves like a regular DAW's track list
   Lanes (band instruments, the loaded backing track and its four stems, your Guitar and Vocal inputs, recorded takes)
   can be reordered by dragging their grip, resized by dragging their bottom edge, recoloured, hidden and re-added.
   Guitar and Vocal lanes have an arm button; R records every armed lane at once, sample-aligned.
   ============================================================ */
const LN = Object.assign({ order: [], h: {}, hide: {}, col: {}, scale: 1, hw: 216 }, CFG.lanes || {}); if (LN.hw === 188) LN.hw = 216;   // the old default made room for fewer controls
const LANE_SEL = { id: null };
const saveLn = () => { CFG.lanes = LN; saveCfg(); };
const VOX_COL = '#ff5fa2', LANE_COLS = ['#0a9aa6', '#e4572e', '#8a5cf5', '#e0a31a', '#2e9d57', '#ff5fa2', '#3b82f6', '#9aa5a6'];
STM.vol = 1; STM.mute = false;
const BANDMAP = { drums: 'drumsOn', bass: 'bassOn', rhythm: 'compOn', lead: 'leadOn' };
const STEM_SHORT = ['Drums', 'Bass', 'Vocals', 'Gtr · keys'];
const LANE_H = [['S', 30], ['M', 46], ['L', 72], ['XL', 112]];

/* ---------- which lanes exist, in what order, how tall ---------- */
function tlAll() {
  const c = TL.col.cv || LANE_COLS, L = {}, add = o => { L[o.id] = Object.assign(o, { c: LN.col[o.id] || o.c }); };
  if (STM.ch) { add({ id: 'trk', name: 'Track', type: 'trk', c: '#7f9a9c', dh: 46 }); STMS.forEach(([, , col], i) => add({ id: 'stem:' + i, name: '♪ ' + STEM_SHORT[i], type: 'stem', idx: i, c: col, dh: 34 })); }
  add({ id: 'rhythm', name: 'Rhythm Gtr', type: 'chords', c: c[0] }); add({ id: 'lead', name: 'Lead / Tab', type: 'tab', c: c[3] }); add({ id: 'bass', name: 'Bass', type: 'bass', c: c[2] }); add({ id: 'drums', name: 'Drums', type: 'drums', c: c[1] });
  add({ id: 'live', name: 'Guitar', type: 'live', c: c[4], dh: 52 }); add({ id: 'vox', name: 'Vocal', type: 'vox', c: VOX_COL, dh: 52 });
  TAKES.forEach(tk => add({ id: 'take:' + tk.id, name: tk.name, type: 'take', take: tk, c: tk.kind === 'vox' ? VOX_COL : c[4] }));
  return L;
}
function laneDefaultOrder(L) {
  const o = ['trk', 'stem:0', 'stem:1', 'stem:2', 'stem:3', 'rhythm', 'lead', 'bass', 'drums', 'live']; TAKES.filter(t => t.kind !== 'vox').forEach(t => o.push('take:' + t.id)); o.push('vox'); TAKES.filter(t => t.kind === 'vox').forEach(t => o.push('take:' + t.id));
  return o.filter(id => L[id]);
}
/** every lane (hidden ones too) in display order */
function tlOrder() {
  const L = tlAll(), def = laneDefaultOrder(L), ord = LN.order.filter(id => L[id]);
  def.forEach((id, i) => { if (ord.includes(id)) return; let at = 0; for (let j = i - 1; j >= 0; j--) { const k = ord.indexOf(def[j]); if (k >= 0) { at = k + 1; break; } } ord.splice(at, 0, id); });
  return ord.map(id => L[id]);
}
const tlLanes = () => tlOrder().filter(l => !LN.hide[l.id]);
const laneH = l => clamp(Math.round((LN.h[l.id] || l.dh || TL.lh) * LN.scale), 24, 300);
function tlLayout() {
  const ls = tlLanes(), top = TL.rh + TL.sh; let y = top; const out = ls.map(l => { const hh = laneH(l), o = { l, y, h: hh }; y += hh; return o; });
  return { top, ls: out, end: y };
}
function laneAt(y) { const LY = tlLayout(); return LY.ls.find(o => y >= o.y && y < o.y + o.h) || null; }

/* ---------- lane head (the track header) ---------- */
function bt(label, cls, title, fn) { return h('button', { class: cls || '', title: title || '', onclick: fn }, label); }
function laneMove(id, beforeId, after) {
  const ids = tlOrder().map(l => l.id).filter(x => x !== id); let i = beforeId ? ids.indexOf(beforeId) : ids.length; if (i < 0) i = ids.length; if (after) i++; ids.splice(i, 0, id); LN.order = ids; saveLn(); renderHeads(); TL.dirty = true;
}
function laneStep(id, d) { const ids = tlOrder().map(l => l.id), i = ids.indexOf(id), j = i + d; if (i < 0 || j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; LN.order = ids; saveLn(); renderHeads(); TL.dirty = true; }
function laneSetH(id, px) { LN.h[id] = clamp(Math.round(px / LN.scale), 24, 300); saveLn(); }
function renderHeads() {
  if (!UI.heads) return; const hd = UI.heads, keep = hd.scrollTop; hd.innerHTML = ''; UI.lm = {};
  hd.append(h('div', { class: 'tl-corner', style: { height: (TL.rh + TL.sh) + 'px' } }, tunShort() + ' · ' + S.ts.join('/')));
  tlLayout().ls.forEach(({ l, h: hh }) => {
    const cmp = hh < 40, box = h('div', { class: 'tl-head ' + l.type + (cmp ? ' cmp' : '') + (LANE_SEL.id === l.id ? ' sel' : ''), 'data-id': l.id, style: { height: hh + 'px' } });
    box.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('button,input,select,.grip,.lgrip')) return; laneSelect(l.id); });
    const grip = h('span', { class: 'grip', draggable: 'true', title: 'Drag to reorder this lane', ondragstart: e => { e.dataTransfer.setData('text/plain', 'lane:' + l.id); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setDragImage(box, 12, 12); } catch (er) { } box.classList.add('dragging'); }, ondragend: () => box.classList.remove('dragging') }, '⠿');
    box.addEventListener('dragover', e => { if (![...e.dataTransfer.types].includes('text/plain')) return; e.preventDefault(); const r = box.getBoundingClientRect(); box.classList.toggle('dropa', e.clientY < r.top + r.height / 2); box.classList.toggle('dropb', e.clientY >= r.top + r.height / 2); });
    box.addEventListener('dragleave', () => box.classList.remove('dropa', 'dropb'));
    box.addEventListener('drop', e => { const t = e.dataTransfer.getData('text/plain'); box.classList.remove('dropa', 'dropb'); if (!t.startsWith('lane:')) return; e.preventDefault(); const r = box.getBoundingClientRect(); laneMove(t.slice(5), l.id, e.clientY >= r.top + r.height / 2); });
    const more = bt('⋯', 'more', 'Lane options: height, colour, order, hide', e => laneMenu(e.currentTarget, l));
    const name = h('span', { class: 'nm', title: l.name, ondblclick: () => { if (l.type === 'take') return laneRename(l, name); LN.h[l.id] = hh <= 34 ? (l.dh || 46) : 28; saveLn(); renderHeads(); TL.dirty = true; } }, l.name);
    const t = h('div', { class: 't' }, grip, h('span', { class: 'sw', style: { background: l.c } }), name);
    const b = h('div', { class: 'b' }); const m = l.type === 'trk' || l.type === 'stem' || l.type === 'take' ? null : (S.mix[l.id] || (S.mix[l.id] = { g: 1, p: 0, m: 0, s: 0 }));
    const lm = () => { const el = h('div', { class: 'lmeter', title: 'Input level' }, h('i')); UI.lm[l.id] = el.firstChild; return el; };
    const mute = (get, set) => bt('M', 'mute' + (get() ? ' on' : ''), 'Mute', e => { set(!get()); e.target.classList.toggle('on', !!get()); });
    const solo = (get, set) => bt('S', get() ? 'on' : '', 'Solo', e => { set(!get()); e.target.classList.toggle('on', !!get()); });
    const vol = (get, set, max, def, title) => h('input', { type: 'range', min: 0, max: max || 1.4, step: .01, value: get(), title: title || 'Volume (double-click: reset)', oninput: e => set(+e.target.value), ondblclick: e => { set(def == null ? .8 : def); e.target.value = def == null ? .8 : def; } });
    if (l.type === 'live') {
      t.append(h('span', { class: 'tag', title: 'Which interface input feeds the guitar (change it in I/O ▸ Channels)' }, (() => { const r = chRoles(); return r[0] === 'g' && r[1] === 'g' ? 'In 1+2' : r[0] === 'g' ? 'In 1' : r[1] === 'g' ? 'In 2' : 'Off'; })()), more);
      b.append(bt('●', 'arm' + (armedG() ? ' on' : ''), 'Arm the guitar for recording (dry DI + wet print)', e => { CFG.armG = !armedG(); saveCfg(); e.currentTarget.classList.toggle('on', armedG()); TL.dirty = true; }),
        bt('🎧', CFG.monitor ? 'on' : '', 'Hear the guitar through the app (use headphones; or use the interface’s Direct Monitor)', e => { setMonitor(!CFG.monitor); e.currentTarget.classList.toggle('on', CFG.monitor); }), lm(), vol(() => m.g, v => { m.g = v; applyMix(); }, 1.4, 1, 'Guitar monitor level'));
    } else if (l.type === 'vox') {
      const sel = h('select', { class: 'vin', title: 'Which interface input is the vocal microphone', onchange: e => { setVoxInput(e.target.value); } }, [['off', 'Off'], ['R', 'In 2'], ['L', 'In 1']].map(([v, tx]) => h('option', { value: v, selected: CFG.vin === v }, tx)));
      t.append(sel, more);
      b.append(bt('●', 'arm' + (armedV() ? ' on' : ''), 'Arm the vocal for recording', e => { if (CFG.vin === 'off') { setVoxInput('R'); } else { CFG.armV = !armedV(); saveCfg(); } e.currentTarget.classList.toggle('on', armedV()); TL.dirty = true; }),
        bt('🎧', CFG.voxMon ? 'on' : '', 'Hear the vocal through the app — headphones only, or the microphone will feed back', e => { CFG.voxMon = !CFG.voxMon; saveCfg(); applyMix(); e.currentTarget.classList.toggle('on', CFG.voxMon); }), lm(),
        mute(() => m.m, v => { m.m = v ? 1 : 0; applyMix(); commit(false); }), solo(() => m.s, v => { m.s = v ? 1 : 0; applyMix(); commit(false); }), vol(() => m.g, v => { m.g = v; applyMix(); }, 1.4, 1, 'Vocal track level'), fxPan(() => m.p || 0, v => { m.p = v; applyMix(); }), fxChip(() => m, () => applyMix(), 'Vocal', true));
    } else if (l.type === 'take') {
      const tk = l.take; const vx = tk.kind === 'vox'; t.append(more);
      b.append(mute(() => tk.mute, v => { tk.mute = v; takeLive(tk); }), solo(() => tk.solo, v => { tk.solo = v; takeLive(tk); }),
        vx ? null : bt('RE-AMP', tk.mode === 'reamp' ? 'on' : '', 'Re-amp: play the dry DI through the CURRENT rig. Off: the wet print as recorded.', e => { tk.mode = tk.mode === 'reamp' ? 'wet' : 'reamp'; e.currentTarget.classList.toggle('on', tk.mode === 'reamp'); if (tk.mode === 'reamp' && !tk.dry) tk.mode = 'wet'; toast(tk.mode === 'reamp' ? 'Re-amp: playing dry DI through the live rig' : 'Playing the wet print as recorded'); }),
        vol(() => Math.sqrt(tk.g == null ? 1 : tk.g), v => { tk.g = v * v; takeLive(tk); }, 2, 1, 'Take volume (up to +12 dB)'), h('input', { type: 'range', min: -1, max: 1, step: .05, value: tk.pan || 0, title: 'Pan', style: { width: '40px', flex: 'none' }, oninput: e => { tk.pan = +e.target.value; takeLive(tk); } }), vx ? fxChip(() => S.mix.vox || (S.mix.vox = { g: 1, p: 0, m: 0, s: 0 }), () => applyMix(), 'Vocal', true) : fxChip(() => tk, () => takeLive(tk), tk.name, true));
    } else if (l.type === 'trk') {
      t.append(h('span', { class: 'tag', title: 'The loaded backing track' }, fmtT(STM.dur)), more);
      b.append(mute(() => STM.mute, v => { STM.mute = v; spBus(); }), bt('⟲ sync', CFG.trackSync !== false ? 'on' : '', 'Track follows the transport: play / stop / seek / loop move the track with the arrangement', e => { CFG.trackSync = CFG.trackSync === false; saveCfg(); e.currentTarget.classList.toggle('on', CFG.trackSync !== false); }),
        vol(() => STM.vol, v => { STM.vol = v; spBus(); }, 1.5, 1, 'Whole-track level'), fxChip(() => STM, () => spFx(), 'Backing track', false));
    } else if (l.type === 'stem') {
      const sm = STM.mix[l.idx]; t.append(more);
      b.append(mute(() => sm.m, v => { sm.m = v; spGains(); renderStemStrips(); TL.dirty = true; }), solo(() => sm.s, v => { sm.s = v; spGains(); renderStemStrips(); TL.dirty = true; }), vol(() => sm.g, v => { sm.g = v; spGains(); }, 1.5, 1, 'Stem level'), fxPan(() => sm.p || 0, v => { sm.p = v; spFx(); }), fxChip(() => sm, () => spFx(), l.name, false));
    } else {
      t.append(more); const key = BANDMAP[l.id];
      b.append(key ? h('button', { class: 'pw' + (S.band[key] ? ' on' : ''), 'data-k': key, title: 'Enable / disable this instrument in the band', onclick: () => toggleBand(key) }, '⏻') : null,
        mute(() => m.m, v => { m.m = v ? 1 : 0; applyMix(); commit(false); }), solo(() => m.s, v => { m.s = v ? 1 : 0; applyMix(); commit(false); }), vol(() => m.g, v => { m.g = v; applyMix(); }),
        h('input', { type: 'range', min: -1, max: 1, step: .05, value: m.p, title: 'Pan', style: { width: '40px', flex: 'none' }, oninput: e => { m.p = +e.target.value; applyMix(); } }), FX_TRACKS.includes(l.id) ? fxChip(() => m, () => applyMix(), l.name, true) : null);
    }
    if (cmp && l.type !== 'live' && l.type !== 'vox') { box.append(t); [...b.children].filter(x => x && (x.classList.contains('mute') || x.title === 'Solo' || x.classList.contains('pw'))).forEach(x => t.insertBefore(x, t.lastChild)); }
    else if (cmp) { box.append(t); [...b.children].filter(x => x && x.classList.contains('arm')).forEach(x => t.insertBefore(x, t.lastChild)); }
    else box.append(t, b);
    const rs = h('div', { class: 'lgrip', title: 'Drag to resize this lane · double-click to reset' });
    rs.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); rs.setPointerCapture(e.pointerId); const y0 = e.clientY, h0 = hh; const mv = ev => { const nh = clamp(h0 + ev.clientY - y0, 24, 300); LN.h[l.id] = Math.round(nh / LN.scale); box.style.height = nh + 'px'; TL.dirty = true; tlSize(); }; const up = () => { rs.removeEventListener('pointermove', mv); rs.removeEventListener('pointerup', up); saveLn(); renderHeads(); }; rs.addEventListener('pointermove', mv); rs.addEventListener('pointerup', up); });
    rs.addEventListener('dblclick', () => { delete LN.h[l.id]; saveLn(); renderHeads(); tlSize(); });
    box.append(rs); hd.append(box);
  });
  hd.scrollTop = keep;
}
function laneRename(l, el) {
  const tk = l.take, inp = h('input', { class: 'in', value: tk.name, style: { width: '100%', height: '18px', fontSize: '11px' }, onblur: () => { tk.name = inp.value.trim() || tk.name; renderHeads(); TL.dirty = true; }, onkeydown: e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = tk.name; inp.blur(); } } });
  el.replaceWith(inp); inp.focus(); inp.select();
}
/** click a lane header to select it: the lane is tinted in the arrangement */
function laneSelect(id) { LANE_SEL.id = LANE_SEL.id === id ? null : id; $$('.tl-head').forEach(x => x.classList.toggle('sel', x.dataset.id === LANE_SEL.id)); TL.dirty = true; bus.emit('lanesel', LANE_SEL.id); }
/** the strip settings object, apply function and name for a lane (null when the lane has none) */
function laneFx(l) {
  if (l.type === 'take') { const tk = l.take; return tk.kind === 'vox' ? [() => S.mix.vox || (S.mix.vox = { g: 1, p: 0, m: 0, s: 0 }), () => applyMix(), 'Vocal', true] : [() => tk, () => takeLive(tk), tk.name, true]; }
  if (l.type === 'trk') return [() => STM, () => spFx(), 'Backing track', false]; if (l.type === 'stem') { const sm = STM.mix[l.idx]; return [() => sm, () => spFx(), l.name, false]; }
  if (l.type === 'vox') return [() => S.mix.vox, () => applyMix(), 'Vocal', true]; if (FX_TRACKS.includes(l.id)) return [() => S.mix[l.id] || (S.mix[l.id] = { g: 1, p: 0, m: 0, s: 0 }), () => applyMix(), l.name, true]; return null;
}
function laneMenu(anchor, l) {
  const box = h('div', { style: { minWidth: '230px' } }); box.append(h('h5', {}, l.name));
  const hh = laneH(l);
  box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '54px' } }, 'Height'), h('div', { class: 'seg' }, LANE_H.map(([n, px]) => h('button', { class: Math.abs(hh - px * LN.scale) < 8 ? 'on' : '', onclick: () => { laneSetH(l.id, px * LN.scale); closePop(); renderHeads(); tlSize(); } }, n)))));
  box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '54px' } }, 'Colour'), h('div', { class: 'swatches' }, LANE_COLS.map(c => h('button', { class: 'swatch' + (c === l.c ? ' on' : ''), style: { background: c }, 'aria-label': c, onclick: () => { LN.col[l.id] = c; saveLn(); closePop(); renderHeads(); TL.dirty = true; } })))));
  box.append(h('div', { class: 'row', style: { gap: '6px', margin: '4px 0' } }, h('button', { class: 'btn sm', onclick: () => { laneStep(l.id, -1); closePop(); } }, '↑ Up'), h('button', { class: 'btn sm', onclick: () => { laneStep(l.id, 1); closePop(); } }, '↓ Down'),
    h('button', { class: 'btn sm', onclick: () => { LN.hide[l.id] = true; saveLn(); closePop(); renderHeads(); tlSize(); } }, 'Hide')));
  if (BANDMAP[l.id]) box.append(h('div', { class: 'row', style: { gap: '6px', marginTop: '4px' } }, h('button', { class: 'btn sm', title: 'Plays the song once in real time with only this part on, and saves it', onclick: () => { closePop(); bouncePart(l.id); } }, '⤓ Save this part (WAV)')));
  if (l.type === 'stem') box.append(h('div', { class: 'row', style: { gap: '6px', marginTop: '4px' } }, h('button', { class: 'btn sm', onclick: () => { closePop(); stemExport(l.idx); } }, '⤓ Save this stem (WAV)')));
  if (l.type === 'take') box.append(h('div', { class: 'row', style: { gap: '6px' } }, h('button', { class: 'btn sm', onclick: () => { closePop(); dlTake(l.take); } }, '⤓ WAV'), h('button', { class: 'btn sm', onclick: () => { closePop(); const i = TAKES.indexOf(l.take); if (i >= 0) TAKES.splice(i, 1); bus.emit('takes'); } }, '✕ Delete take'), h('button', { class: 'btn sm', onclick: () => { closePop(); dockGo('tx'); TX.src = l.take.id; txRefreshSrc(); } }, '♬ Transcribe')));
  if (l.type === 'trk') box.append(h('div', { class: 'row', style: { gap: '6px' } }, h('button', { class: 'btn sm', onclick: () => { closePop(); dockGo('stems'); } }, 'Open Stems'), h('button', { class: 'btn sm bad', onclick: () => { closePop(); stemUnload(); } }, '✕ Unload')));
  if (l.type === 'live' || l.type === 'vox') box.append(h('div', { class: 'tiny muted', style: { marginTop: '4px' } }, 'Input routing and the vocal strip are in the I/O panel (left).'), h('button', { class: 'btn sm', style: { marginTop: '4px' }, onclick: () => { closePop(); sideShow('io'); } }, 'Open I/O'));
  { const fx = laneFx(l); if (fx) box.append(h('div', { class: 'row', style: { gap: '6px', marginTop: '4px' } }, h('button', { class: 'btn sm', onclick: () => { closePop(); setTimeout(() => fxPanel(anchor, fx[0], fx[1], fx[2], fx[3], () => { }), 0); } }, '🎛 Effects…'))); }
  popover(anchor, box, { style: { maxWidth: '320px' } });
}
/** + Track / Lanes manager: show hidden lanes, re-order, reset */
function lanesMenu(anchor) {
  const box = h('div', { style: { minWidth: '290px' } }); box.append(h('h5', {}, 'Lanes'));
  const quick = h('div', { class: 'row', style: { gap: '6px', marginBottom: '8px' } },
    h('button', { class: 'btn sm primary', title: 'Show the vocal lane and route the second input to it', onclick: () => { delete LN.hide.vox; delete LN.hide.live; saveLn(); if (CFG.vin === 'off') setVoxInput('R'); closePop(); renderHeads(); tlSize(); } }, '🎤 Add vocal'),
    h('button', { class: 'btn sm', onclick: () => { delete LN.hide.live; saveLn(); closePop(); renderHeads(); tlSize(); } }, '🎸 Add guitar'),
    h('button', { class: 'btn sm', onclick: () => { closePop(); dockGo('stems'); if (SU.file) SU.file.click(); } }, '♪ Load track…'),
    h('button', { class: 'btn sm', id: 'lanesBal', title: 'Measure your recordings and set every lane’s level and pan so they sit together', onclick: () => { closePop(); autoBalance(); } }, '⚖ Auto-balance'));
  box.append(quick);
  tlOrder().forEach(l => box.append(h('div', { class: 'lrow' }, h('input', { type: 'checkbox', checked: !LN.hide[l.id], onchange: e => { if (e.target.checked) delete LN.hide[l.id]; else LN.hide[l.id] = true; saveLn(); renderHeads(); tlSize(); } }), h('i', { class: 'sw', style: { background: l.c, width: '8px', height: '14px', borderRadius: '2px' } }), h('span', { class: 'grow' }, l.name),
    h('button', { class: 'btn sm', style: { padding: '0 6px' }, onclick: () => { laneStep(l.id, -1); lanesMenu(anchor); lanesMenu(anchor); } }, '↑'), h('button', { class: 'btn sm', style: { padding: '0 6px' }, onclick: () => { laneStep(l.id, 1); lanesMenu(anchor); lanesMenu(anchor); } }, '↓'))));
  box.append(h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn sm', onclick: () => { LN.order = []; LN.h = {}; LN.hide = {}; LN.col = {}; LN.scale = 1; saveLn(); closePop(); renderHeads(); tlSize(); } }, 'Reset lanes')));
  popover(anchor, box, { right: true, style: { maxHeight: '70vh' } });
}
function laneScale(d) { LN.scale = clamp(+(LN.scale + d).toFixed(2), .6, 2.4); saveLn(); renderHeads(); tlSize(); }

/* ---------- loaded-track lanes: high-resolution envelopes aligned to the bar grid ---------- */
const trkT0 = () => (STM.an && STM.an.beats && STM.an.beats.length ? STM.an.beats[STM.an.down] / STM.an.fps : 0);
function stemLaneEnv() {
  if (STM.envL || !STM.ch) return STM.envL; const dt = .02, n = Math.max(1, Math.ceil(STM.dur / dt)), sr = STM.sr, win = Math.max(1, Math.floor(sr * dt)), step = Math.max(1, Math.floor(win / 24)), mix = new Float32Array(n);
  const a = STMS.map((_, i) => { const d = spData(i), o = new Float32Array(n); for (let w = 0; w < n; w++) { let m = 0; const a0 = w * win; for (let c = 0; c < d.length; c++) { if (c && d[c] === d[0]) break; const x = d[c], b1 = Math.min(x.length, a0 + win); for (let k = a0; k < b1; k += step) { const v = x[k] < 0 ? -x[k] : x[k]; if (v > m) m = v; } } o[w] = m / 32768; if (o[w] > mix[w]) mix[w] = o[w]; } return o; });
  const nrm = arr => { const s = Float32Array.from(arr).sort(); const p = s[Math.floor(s.length * .995)] || 1e-4; return Math.max(p, 1e-3); };
  return STM.envL = { dt, n, a, mix, sc: a.map(nrm), scm: nrm(mix) };
}
bus.on('track', () => { STM.envL = null; renderHeads(); tlSize(); });
/** the two per-input level meters in I/O ▸ Channels */
function chMeters() {
  if (!UI.chM || !E.anaL) return;
  [E.anaL, E.anaR].forEach((an, i) => { const bar = UI.chM[i]; if (!bar || !bar.isConnected) return; const b = (UI.chBuf || (UI.chBuf = new Float32Array(1024))); an.getFloatTimeDomainData(b); let e = 0; for (let k = 0; k < b.length; k++) e += b[k] * b[k]; bar.style.width = dbw(dB(Math.sqrt(e / b.length))); });
}
function spBus() { if (!STP.bus) return; tc(STP.bus.gain, STM.mute ? 0 : (STM.vol == null ? 1 : STM.vol), .015); }

/* ---------- drawing ---------- */
function laneBg(g, V) {
  const { ox, vw, C, LY } = V;
  LY.ls.forEach(({ l, y, h: hh }, i) => { g.fillStyle = i % 2 ? C.bg2 : C.bg; g.globalAlpha = i % 2 ? .45 : 1; g.fillRect(ox, y, vw, hh); g.globalAlpha = 1; if (l && LANE_SEL.id === l.id) { g.fillStyle = C.accent; g.globalAlpha = .1; g.fillRect(ox, y, vw, hh - 1); g.globalAlpha = 1; } g.fillStyle = C.line; g.fillRect(ox, y + hh - 1, vw, 1); });
}
function drawLanes(g, V) {
  const { ox, vw, sw, sp, b0, b1, fb, C, sans, LY } = V, cache = tlCache(), hasRec = !!REC;
  LY.ls.forEach(({ l, y, h: hh }) => {
    const ph = hh - 8, mid = y + hh / 2;
    if (l.type === 'chords') fb.forEach(f => {
      if (f.idx < b0 || f.idx > b1) return; const cs = barChords(f.bar), n = Math.max(1, cs.length), x = f.idx * TL.bw;
      cs.forEach((c, k) => { const cx = x + k * TL.bw / n; g.fillStyle = l.c; g.globalAlpha = .22; g.fillRect(cx + 2, y + 4, TL.bw / n - 4, ph); g.globalAlpha = 1; g.strokeStyle = l.c; g.strokeRect(cx + 2.5, y + 4.5, TL.bw / n - 5, ph - 1); if (hh >= 30) { g.fillStyle = C.text; g.font = '800 ' + (hh >= 40 ? 13 : 11) + 'px ui-monospace,Menlo,Consolas,monospace'; g.fillText(c, cx + 8, mid); } });
      if (SEL.sec === f.si && SEL.bar === f.bi) { g.strokeStyle = C.accent2; g.lineWidth = 2; g.strokeRect(x + 1, y + 2, TL.bw - 2, hh - 5); g.lineWidth = 1; }
    });
    else if (l.type === 'tab') fb.forEach(f => { if (f.idx < b0 || f.idx > b1) return; f.bar.tab.forEach(n => { const m = n.f === 'x' ? S.tuning[n.st] : noteMidi(n), yy = y + hh - 6 - clamp((m - 38) / 40, 0, 1) * (hh - 12); g.fillStyle = l.c; g.fillRect(f.idx * TL.bw + n.s * sw + 1, yy, Math.max(3, sw * 1.8), 3.5); }); });
    else if (l.type === 'bass') cache.bass.forEach(n => { const b = Math.floor(n.s / sp); if (b < b0 || b > b1) return; const yy = y + hh - 7 - clamp((n.m - 28) / 24, 0, 1) * (hh - 14); g.fillStyle = l.c; g.fillRect(n.s * sw + 1, yy, Math.max(3, n.len * sw - 2), 4); });
    else if (l.type === 'drums' && S.band.drumsOn) { const pat = dpat(), L = Math.min(S.band.drumLen || 16, 32), rowsY = [.78, .5, .22, .22, .36, .6]; for (let bi = b0; bi <= b1; bi++) for (let s = 0; s < sp; s++) pat.forEach((row, r) => { const v = row[s % L]; if (!v) return; g.fillStyle = l.c; g.globalAlpha = .35 + .2 * v; g.fillRect(bi * TL.bw + s * sw + 1, y + hh * rowsY[r] - 2, Math.max(2, sw - 2), 4); g.globalAlpha = 1; }); }
    else if (l.type === 'live' || l.type === 'vox') {
      const vox = l.type === 'vox', armed = vox ? armedV() : armedG(), rec = hasRec && (vox ? REC.v : REC.g);
      if (armed) { g.fillStyle = '#e5484d'; g.globalAlpha = rec ? .1 : .045; g.fillRect(ox, y, vw, hh - 1); g.globalAlpha = 1; g.fillStyle = '#e5484d'; g.fillRect(ox, y, 3, hh - 1); }
      if (rec) {
        const pk = vox ? REC.pkV : REC.pkG, x0 = REC.startSec / slotDur() * sw, cw = 1024 / E.ctx.sampleRate / slotDur() * sw, amp = hh / 2 - 4, n = pk.length / 2; g.fillStyle = '#e5484d'; g.globalAlpha = .85;
        for (let k = Math.max(0, Math.floor((ox - x0) / cw)); k < n; k++) { const x = x0 + k * cw; if (x > ox + vw) break; const mn = pk[k * 2], mx = pk[k * 2 + 1]; g.fillRect(x, mid - mx * amp * 2.2, Math.max(1, cw), Math.max(1, (mx - mn) * amp * 2.2)); } g.globalAlpha = 1;
      }
      if (hh >= 30 || !rec) {
        g.fillStyle = C.muted; g.font = sans; const msg = !E.hasInput ? 'no input open — choose one in I/O' : vox ? (CFG.vin === 'off' ? 'vocal input is off — pick In 2 (or arm ●) to record vocals with the guitar' : rec ? '● recording vocal…' : armed ? 'armed · input ' + (CFG.vin === 'R' ? '2' : '1') + ' · press R to record' : 'not armed')
          : (rec ? '● recording dry DI + wet print…' : armed ? 'armed · press R to record (count-in ' + CFG.countIn + ' bar)' : 'not armed — click ● to arm'); g.fillText(msg, ox + 12, y + (hh >= 40 ? hh - 12 : hh / 2));
      }
    }
    else if (l.type === 'take') {
      const tk = l.take, pk = tk.peaks, x0 = tk.startSec / slotDur() * sw, wpx = tk.dur / slotDur() * sw, mute = !takeAudible(tk); g.fillStyle = l.c; g.globalAlpha = mute ? .2 : .85; const amp = hh / 2 - 4, xa = Math.max(x0, ox), xb = Math.min(x0 + wpx, ox + vw);
      for (let x = Math.floor(xa); x < xb; x++) { const t = (x - x0) / wpx, i0 = Math.floor(t * pk.mn.length), i1 = Math.max(i0 + 1, Math.floor((t + 1 / wpx) * pk.mn.length)); let mn = 1, mx = -1; for (let k = i0; k < Math.min(i1, pk.mn.length); k++) { if (pk.mn[k] < mn) mn = pk.mn[k]; if (pk.mx[k] > mx) mx = pk.mx[k]; } if (mx >= mn) g.fillRect(x, mid - mx * amp * 2.2, 1, Math.max(1, (mx - mn) * amp * 2.2)); }
      g.globalAlpha = 1; g.strokeStyle = l.c; g.strokeRect(x0 + .5, y + 3.5, wpx, hh - 7); if (hh >= 40 && wpx > 60) { g.fillStyle = l.c; g.font = sans; g.fillText(tk.name, Math.max(x0, ox) + 6, y + 12); }
    }
    else if (l.type === 'trk' || l.type === 'stem') {
      const env = stemLaneEnv(); if (!env) return; const idx = l.type === 'stem' ? l.idx : -1, arr = idx < 0 ? env.mix : env.a[idx], scl = idx < 0 ? env.scm : env.sc[idx], t0 = trkT0(), sd = slotDur(), amp = hh / 2 - 3, an = STM.an;
      const sm = idx >= 0 ? STM.mix[idx] : null, aud = idx < 0 ? !STM.mute : (STM.mix.some(x => x.s) ? sm.s : !sm.m);
      if (idx >= 0 && an) { const pr = an.pres[idx], wsec = an.W / an.fps; g.fillStyle = l.c; for (let w = 0; w < pr.length; w++) { const a = pr[w]; if (a < .05) continue; const xx = ((w * wsec - t0) / sd) * sw; if (xx > ox + vw || xx + wsec / sd * sw < ox) continue; g.globalAlpha = .1 * a; g.fillRect(xx, y + 2, Math.ceil(wsec / sd * sw) + 1, hh - 4); } }
      g.fillStyle = l.c; g.globalAlpha = aud ? .9 : .28; const px = sd / sw;
      for (let x = Math.floor(ox); x < ox + vw; x++) { const t = t0 + x * px; if (t < 0) continue; if (t > STM.dur) break; const i0 = Math.floor(t / env.dt), i1 = Math.max(i0, Math.floor((t + px) / env.dt)); let m = 0; for (let k = i0; k <= i1 && k < env.n; k++) if (arr[k] > m) m = arr[k]; const v = Math.min(1, m / scl) * amp; g.fillRect(x, mid - v, 1, Math.max(1, v * 2)); }
      g.globalAlpha = 1; if (hh >= 36 && ox < 200) { g.fillStyle = C.muted; g.font = sans; g.fillText(idx < 0 ? (STM.title || STM.name) : STEM_SHORT[idx], ox + 8, y + 11); }
      if (idx < 0 && t0 > 0) { const x0 = -t0 / sd * sw; if (x0 > ox - 40) { g.fillStyle = C.muted; g.fillRect(Math.round(x0), y, 1, hh); } }
    }
  });
}

/* ---------- I/O → "Guitar + vocal" card: which interface input is which, vocal trim, monitoring, polish ---------- */
function buildVoxCard(p) {
  const route = h('div', { class: 'chmx' }), follow = h('div', { class: 'seg' }), note = h('div', { class: 'tiny muted', style: { marginTop: '6px', lineHeight: 1.45 } });
  const mt = () => { const i = h('i'), u = h('u'), v = h('span', { class: 'mono tiny' }, '–∞ dB'); UI.mVox = { i, u, v, hold: -120 }; return h('div', { style: { margin: '8px 0 4px' } }, h('div', { class: 'row sp tiny muted' }, h('span', {}, 'Vocal level (post-trim)'), v), h('div', { class: 'meter' }, i, u)); };
  const trim = mkKnob({ key: 'voxTrim', label: 'Vocal Trim', min: -24, max: 36, def: 0, step: .5, unit: ' dB', onChange: v => setVoxTrim(v) });
  const tog = (label, get, set, title) => { const b = h('button', { class: 'tog' + (get() ? ' on' : ''), title, onclick: () => { set(!get()); b.classList.toggle('on', get()); } }, label); return b; };
  const presets = h('div', { class: 'row io-presets', style: { gap: '6px', flexWrap: 'wrap', margin: '0 0 6px' } });
  const sync = () => {
    route.innerHTML = ''; follow.innerHTML = ''; presets.innerHTML = ''; const roles = chRoles(), nch0 = ioNch(), mono = nch0 === 1; UI.chM = [];
    (mono ? [0] : [0, 1]).forEach(i => {
      const sel = h('select', { class: 'in', 'aria-label': 'What input ' + (i + 1) + ' is', onchange: e => { const v = e.target.value; if (mono) { chSetRoles(v, 'o'); return; } const r = chRoles(); r[i] = v; if (v === 'v') r[1 - i] = r[1 - i] === 'v' ? 'g' : r[1 - i]; chSetRoles(r[0], r[1]); if (v === 'v' && CFG.vin !== 'off') toast('Input ' + (i + 1) + ' is the vocal. Use headphones, or the interface’s Direct Monitor, to avoid feedback.', 'ok'); } },
        [['g', '🎸 Guitar'], ['v', '🎤 Vocal'], ['o', 'Off']].map(([v, t]) => h('option', { value: v, selected: roles[i] === v }, t)));
      const bar = h('i'); UI.chM[i] = bar;
      route.append(h('div', { class: 'chrow', title: 'Guitar goes through the rig; Vocal goes through the vocal strip' }, h('b', {}, mono ? 'Input' : 'Input ' + (i + 1)), sel, h('div', { class: 'meter chm', 'aria-hidden': 'true' }, bar)));
    });
    ioChannelPresets().forEach(b => presets.append(b));
    if (E.hasInput && !mono) presets.append(h('button', { class: 'btn sm', title: 'Strum the guitar: finds which interface input it is on', onclick: autoDetectChannel }, '⚡ Find my guitar'));
    if (mono && roles[1] !== 'o') presets.append(h('button', { class: 'btn sm io-mono1', onclick: () => chSetRoles(roles[0] !== 'o' ? roles[0] : roles[1], 'o') }, 'Use input 1 only'));
    if (!mono) [['g', 'Guitar'], ['v', 'Vocal'], ['b', 'Both']].forEach(([v, t]) => follow.append(h('button', { class: (CFG.anSrc || 'g') === v ? 'on' : '', title: v === 'g' ? 'Note detection, tuner, chords, neck and visuals follow the guitar' : v === 'v' ? 'They follow the singing voice: the neck shows the note you sing, the visuals move with your voice' : 'They follow both (works best for visuals; note detection is best with one source)', onclick: () => setAnaSource(v) }, t)));
    else [['g', 'Guitar'], ['v', 'Vocal']].forEach(([v, t]) => follow.append(h('button', { class: (CFG.anSrc || 'g') === v ? 'on' : '', onclick: () => setAnaSource(v) }, t)));
    note.textContent = ioChannelNote();
  };
  const card = h('div', { class: 'card' }, h('h4', {}, 'Channels'), h('div', { class: 'card-b' }, presets, route, h('div', { class: 'row sp', style: { margin: '8px 0 4px' } }, h('span', { class: 'tiny muted', title: 'Which channel the note detector, tuner, chord finder, neck and visuals listen to' }, 'Detect & visualise'), follow), note, mt(),
    h('div', { class: 'row', style: { gap: '6px', margin: '6px 0', flexWrap: 'wrap' } }, tog('Hear vocal', () => !!CFG.voxMon, v => { CFG.voxMon = v; saveCfg(); applyMix(); renderHeads(); }, 'Monitor the vocal through the app (headphones only)'), tog('Vocal polish', () => CFG.voxPolish !== false, v => { CFG.voxPolish = v; saveCfg(); voxPolishApply(); }, 'High-pass at 90 Hz and gentle compression on the vocal track')),
    h('div', { class: 'row', style: { justifyContent: 'center' } }, trim.el)));
  UI.chSync = sync; trim.set(CFG.voxTrim || 0); sync(); bus.on('route', sync); bus.on('input', sync); bus.on('route', renderHeads);
  const first = p.firstElementChild; if (first) first.after(card); else p.append(card);
}
/** live level meters in the Guitar and Vocal lane headers, and the Vocal card */
function laneMeters() {
  if (!E.ready) return; const put = (el, an, key, ui) => { if (!el && !ui) return; const m = peakOf(an, key); if (el) el.style.width = dbw(m.rms); if (ui) { ui.i.style.width = dbw(m.rms); ui.hold = Math.max(m.pk, ui.hold - .6); ui.u.style.left = dbw(Math.max(ui.hold, -60)); ui.v.textContent = 'pk ' + (m.pk < -90 ? '−∞' : m.pk.toFixed(1)) + ' · rms ' + (m.rms < -90 ? '−∞' : m.rms.toFixed(1)); } };
  if (UI.lm) { if (UI.lm.live) put(UI.lm.live, E.anaDI, 'lmG'); if (UI.lm.vox || UI.mVox) put(UI.lm.vox, E.anaVox, 'lmV', UI.mVox); } else if (UI.mVox) put(null, E.anaVox, 'lmV', UI.mVox);
}

/* ---------- see everything: the panel menu and "expand" modes for the centre ---------- */
const CMAX = { mode: '' };
function centerMax(mode) {
  CMAX.mode = CMAX.mode === mode ? '' : mode; const c = $('#center'); if (!c) return; c.classList.toggle('max-dock', CMAX.mode === 'dock'); c.classList.toggle('max-tl', CMAX.mode === 'tl');
  $$('.cmax').forEach(b => b.classList.toggle('on', b.dataset.m === CMAX.mode)); setTimeout(() => { tlSize(); window.dispatchEvent(new Event('resize')); }, 40);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && CMAX.mode && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) centerMax(CMAX.mode); });
function dockMore() {
  const b = h('button', { class: 'dock-more', title: 'All panels, expand the panel, move panels between the centre and the sidebars', 'aria-label': 'All panels', onclick: e => dockMenu(e.currentTarget) }, '☰'), x = h('button', { class: 'dock-more cmax', 'data-m': 'dock', title: 'Expand this panel to the whole centre (Esc to go back)', 'aria-label': 'Expand panel', onclick: () => centerMax('dock') }, '⤢');
  return h('div', { class: 'dock-tools' }, x, b);
}
function dockMenu(anchor) {
  const box = h('div', { style: { minWidth: '260px' } }); box.append(h('h5', {}, 'All panels'));
  const g = h('div', { class: 'pgrid' }); DOCK.forEach(([id, name], i) => { const hosted = typeof sideHosted === 'function' && sideHosted(id); g.append(h('button', { class: 'btn sm' + (paneVisible(id) ? ' primary' : ''), title: hosted ? 'Lives in a sidebar — click to show it there' : 'Show this panel', onclick: () => { closePop(); dockGo(id); } }, (i + 1) + ' · ' + name + (hosted ? ' ›' : ''))); });
  box.append(g, h('div', { class: 'row', style: { gap: '6px', marginTop: '8px', flexWrap: 'wrap' } },
    h('button', { class: 'btn sm', onclick: () => { closePop(); centerMax('dock'); } }, '⤢ Expand panel'), h('button', { class: 'btn sm', onclick: () => { closePop(); centerMax('tl'); } }, '⤢ Expand arrangement'),
    h('button', { class: 'btn sm', onclick: e => { closePop(); placeMenu(anchor); } }, '⇆ Where panels live…')));
  popover(anchor, box, { right: true, style: { maxWidth: '360px' } });
}

/* ---------- the loaded track rides the transport: play / stop / seek / loop move the band and the track together ---------- */
const TRK = { own: false, warned: 0 };
function trackStart(when, slot, first) {
  if (!STM.ch || CFG.trackSync === false) return; const t = slot * slotDur() + trkT0();
  if (first && STM.an && Math.abs(STM.an.bpmEff - S.bpm) > 1 && Date.now() - TRK.warned > 20000) { TRK.warned = Date.now(); toast('The track is ' + STM.an.bpmEff.toFixed(1) + ' BPM but the song is ' + S.bpm + ' — they will drift. Use “Use tempo + key” in the track menu (top bar).', 'warn'); }
  if (t >= STM.dur - .1) { if (STP.playing) spPause(); TRK.own = false; return; }
  if (STM.loop.on) { STM.loop.on = false; } TRK.own = true; spPlay(when, t).then(() => { spBus(); }).catch(() => { });
}
function trackStop() { if (TRK.own && STP.playing) spPause(); TRK.own = false; }
