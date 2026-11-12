/* ============================================================
   Part 12 · pedalboard v3 (2.66) — your board, not every unit at once:
     · the board: the pedals on it, in chain order (IN › … › OUT). A pedal is on the board while it is on, or once you have put it
       there (＋ Pedal, or bypassing one that was on); ✕ in its ⚙ takes it off. Click a pedal to edit it; its LED stomps it.
     · three views: ◎ Edit (the board, and the pedal you picked, large), ▦ All (every pedal on the board, open) and ◉ Stomp (big
       footswitches for playing live)
     · per pedal (⚙): a label, colour, width, collapse, hide, a footswitch key and a MIDI note, order, off the board
     · 8 morphing scenes, keys 1–8 and MIDI notes 36–43
   ============================================================ */
const BRD = Object.assign({ view: 'focus', sel: '', items: {}, scenes: new Array(8).fill(null), morph: 250, incBand: false, live: true, midi: {}, dens: 250, cur: -1, storeArm: false, hidShow: false }, CFG.board || {});
while (BRD.scenes.length < 8) BRD.scenes.push(null);
const saveBrd = () => { CFG.board = BRD; saveCfg(); };
const BRD_COLORS = ['', '#e4572e', '#f2a900', '#3ddc84', '#35d3c2', '#4a90e2', '#a58bff', '#ff5fa2'];
const BRD_RESERVED = new Set([' ', 'r', 'l', 'm', 'd', 'b', 'g', 't', '?', '[', ']', 'home', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'escape', 'tab', 'enter', 'f']);
const bitem = id => BRD.items[id] || (BRD.items[id] = { size: 1, color: '', col: false, hid: false, key: '' });
if (CFG.boardV3 !== 1) { CFG.boardV3 = 1; if (BRD.view === 'board') BRD.view = 'focus'; saveBrd(); }      /* 2.66: the board opens on ◎ Edit once */
/** the tone's own settings, for before the audio starts (the units are made when it does) */
const brdPresetU = () => { const p = (UI.pending && UI.pending.u ? UI.pending : null) || allPresets().find(x => x.n === RIG.cur) || null; return (p && p.u) || {}; };
const unitOn = id => E.ready && RIG.units[id] ? !!RIG.units[id].on : !!(brdPresetU()[id] && brdPresetU()[id].on);
/** on the board: on, or put there (and kept, bypassed, until taken off) */
const onBoard = id => unitOn(id) || !!(BRD.items[id] && BRD.items[id].keep);
const brdLabel = id => (BRD.items[id] && BRD.items[id].label) || FX[id].name;
const BRD_CATS = [['Dynamics', 'Dynamics'], ['Filter', 'Filter & EQ'], ['Drive', 'Drive'], ['Pitch', 'Pitch'], ['Amp', 'Amp & cab'], ['Modulation', 'Modulation'], ['Time', 'Delay & reverb']];

function paintPedal(id) {
  const P = PED[id]; if (!P) return; const it = bitem(id), el = P.el;
  el.classList.toggle('s2', it.size === 2); el.classList.toggle('s3', it.size === 3); el.classList.toggle('cc', !!it.col); el.classList.toggle('hid', !!it.hid && !BRD.hidShow);
  el.classList.toggle('offb', !onBoard(id) && !BRD.hidShow); el.classList.toggle('sel', id === BRD.sel); el.classList.toggle('on', unitOn(id)); const t = el.querySelector('.pedal-h b'); if (t) t.textContent = brdLabel(id);
  if (it.color) el.style.setProperty('--pc', it.color); else el.style.removeProperty('--pc');
  const kb = el.querySelector('.kbadge'); if (kb) { kb.textContent = it.key ? it.key.toUpperCase() : ''; kb.style.display = it.key ? '' : 'none'; }
}
function boardView(v) {
  if (!['focus', 'board', 'stomp'].includes(v)) v = 'focus'; BRD.view = v; saveBrd(); const b = UI.board; if (!b) return;
  b.classList.toggle('stompmode', v === 'stomp'); b.classList.toggle('focusmode', v === 'focus'); PANES.rig.classList.toggle('v-stomp', v === 'stomp');
  b.style.gridTemplateColumns = v === 'board' ? 'repeat(auto-fill,minmax(' + BRD.dens + 'px,1fr))' : '';
  $$('.bv button', PANES.rig).forEach(x => { const on = x.dataset.v === v; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); }); brdPaint();
}
/** the pedal being edited: the one picked, or the first on the board */
function brdSel(id) {
  if (id) BRD.sel = id; if (!BRD.sel || !onBoard(BRD.sel)) BRD.sel = RIG.order.find(onBoard) || ''; saveBrd(); brdPaint();
}
function brdPaint() { RIG.order.forEach(id => { if (PED[id]) paintPedal(id); }); renderChain(); const e = document.getElementById('brdEmpty'); if (e) e.hidden = RIG.order.some(onBoard) || BRD.hidShow; }

function pedalState(id, on) { if (!E.ready) return toast('Power on first'); const u = RIG.units[id]; if (!u) return; const was = onBoard(id); u.setActive(on == null ? !u.on : on); if (!u.on && was) { bitem(id).keep = true; saveBrd(); } PED[id].el.classList.toggle('on', u.on); bus.emit('rig:state'); }
/** move a pedal past the next one on the board, before (d −1) or after (d +1) it: the units not on the board don't count */
function brdStep(id, d) { const vis = RIG.order.filter(x => x === id || onBoard(x) || BRD.hidShow), k = vis.indexOf(id), o = vis[k + d]; if (!o) return; rigMove(id, RIG.order.indexOf(o) + (d > 0 ? 1 : 0) - (d > 0 && RIG.order.indexOf(o) > RIG.order.indexOf(id) ? 1 : 0)); renderChain(); }
/** put a pedal on the board (on), or take it off (bypassed, and off the board) */
function brdAdd(id) { bitem(id).keep = true; saveBrd(); if (E.ready) pedalState(id, true); brdSel(id); }
function brdRemove(id) { const it = bitem(id); it.keep = false; saveBrd(); if (E.ready && RIG.units[id] && RIG.units[id].on) { RIG.units[id].setActive(false); bus.emit('rig:state'); } if (BRD.sel === id) BRD.sel = ''; brdSel(); }

/* ---------- signal chain strip ---------- */
function renderChain() {
  const c = UI.chain; if (!c) return; c.innerHTML = ''; c.append(h('span', { class: 'io' }, 'IN'));
  RIG.order.forEach(id => {
    if (!onBoard(id) && !BRD.hidShow) return; const it = bitem(id), on = unitOn(id);
    const led = h('button', { class: 'bp-led', type: 'button', 'aria-label': (on ? 'Bypass ' : 'Engage ') + brdLabel(id), 'aria-pressed': String(on), title: 'Stomp: on / bypass' + (it.key ? ' (key ' + it.key.toUpperCase() + ')' : ''), onclick: e => { e.stopPropagation(); pedalState(id); } });
    const chip = h('div', { class: 'cchip bp' + (on ? ' on' : '') + (id === BRD.sel ? ' sel' : '') + (it.hid ? ' hid' : '') + (onBoard(id) ? '' : ' offb'), 'data-id': id, draggable: 'true', role: 'button', tabindex: '0', title: brdLabel(id) + ': click to edit · LED: on / bypass · drag to reorder', style: it.color ? { '--pc': it.color } : {},
      onclick: () => { if (BRD.view === 'stomp') pedalState(id); else { if (!onBoard(id)) brdAdd(id); else brdSel(id); } }, onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chip.click(); } },
      ondragstart: e => { e.dataTransfer.setData('text/plain', id); }, ondragover: e => { e.preventDefault(); chip.classList.add('over'); }, ondragleave: () => chip.classList.remove('over'),
      ondrop: e => { e.preventDefault(); chip.classList.remove('over'); const f = e.dataTransfer.getData('text/plain'); if (f && f !== id && FX[f]) rigMove(f, RIG.order.indexOf(id)); } }, led, h('span', { class: 'bp-n' }, brdLabel(id)), h('small', {}, FX[id].cat));
    c.append(h('span', { class: 'arr' }, '›'), chip);
  });
  c.append(h('span', { class: 'arr' }, '›'), h('span', { class: 'io' }, 'OUT'), h('button', { class: 'btn sm bp-add', id: 'brdAdd', type: 'button', title: 'Put a pedal on the board', onclick: e => brdLibrary(e.currentTarget) }, '＋ Pedal'));
}
/** the pedals not on the board, by kind */
function brdLibrary(btn) {
  const off = RIG.order.filter(id => !onBoard(id)), box = h('div', { class: 'bp-lib' }, h('h5', {}, 'Put a pedal on the board'));
  if (!off.length) box.append(h('p', { class: 'small muted' }, 'Every pedal is on the board.'));
  BRD_CATS.forEach(([k, n]) => { const ids = off.filter(id => FX[id].cat === k); if (!ids.length) return; box.append(h('div', { class: 'bp-libc' }, h('small', {}, n), h('div', { class: 'row', style: { gap: '5px', flexWrap: 'wrap' } }, ids.map(id => h('button', { class: 'btn sm', 'data-add': id, onclick: () => { closePop(); brdAdd(id); } }, FX[id].name))))); });
  const rest = off.filter(id => !BRD_CATS.some(([k]) => FX[id].cat === k)); if (rest.length) box.append(h('div', { class: 'row', style: { gap: '5px', flexWrap: 'wrap' } }, rest.map(id => h('button', { class: 'btn sm', 'data-add': id, onclick: () => { closePop(); brdAdd(id); } }, FX[id].name))));
  popover(btn, box);
}


/* ---------- per-pedal settings popover ---------- */
let BLEARN = null;
function pedalGear(id, btn) {
  const it = bitem(id), box = h('div'); box.append(h('h5', {}, FX[id].name));
  box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '74px' } }, 'Label'), h('input', { class: 'in', id: 'pgLabel', value: it.label || '', placeholder: FX[id].name, maxLength: 24, style: { flex: 1, fontFamily: 'var(--sans)' }, onchange: e => { it.label = e.target.value.trim().slice(0, 24); saveBrd(); brdPaint(); } })));      /* 2.66: your name for it ("Klon", "Lead boost") */
  const seg = (label, opts, cur, fn) => box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '74px' } }, label), h('div', { class: 'seg' }, opts.map(([v, n]) => h('button', { class: cur === v ? 'on' : '', onclick: e => { fn(v); $$('button', e.target.parentNode).forEach(b => b.classList.toggle('on', b === e.target)); } }, n)))));
  seg('Width', [[1, 'S'], [2, 'M'], [3, 'L']], it.size, v => { it.size = v; paintPedal(id); saveBrd(); });
  box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '74px' } }, 'Colour'), h('div', { class: 'row', style: { gap: '5px' } }, BRD_COLORS.map(c => h('button', { class: 'swatch' + (it.color === c ? ' on' : ''), style: { background: c || 'var(--panel2)', border: c ? undefined : '2px dashed var(--line2)' }, onclick: e => { it.color = c; paintPedal(id); renderChain(); saveBrd(); $$('.swatch', e.target.parentNode).forEach(b => b.classList.toggle('on', b === e.target)); } })))));
  box.append(h('label', { class: 'lrow' }, h('input', { type: 'checkbox', checked: it.col, onchange: e => { it.col = e.target.checked; paintPedal(id); saveBrd(); } }), 'Collapse (stomp + title only)'), h('label', { class: 'lrow' }, h('input', { type: 'checkbox', checked: it.hid, onchange: e => { it.hid = e.target.checked; paintPedal(id); renderChain(); saveBrd(); } }), 'Hide from the board (stays in the chain)'));
  const kbtn = h('button', { class: 'btn sm', onclick: () => { kbtn.textContent = 'Press a key…'; const f = ev => { ev.preventDefault(); ev.stopPropagation(); document.removeEventListener('keydown', f, true); const k = ev.key.toLowerCase(); if (k === 'escape') { kbtn.textContent = it.key ? it.key.toUpperCase() : 'Assign key'; return; } if (k === 'backspace' || k === 'delete') it.key = ''; else if (BRD_RESERVED.has(k) || ev.ctrlKey || ev.metaKey || ev.altKey) { toast('“' + ev.key + '” is reserved for another shortcut', 'warn'); } else { Object.keys(BRD.items).forEach(o => { if (o !== id && BRD.items[o].key === k) BRD.items[o].key = ''; paintPedal(o); }); it.key = k; } saveBrd(); paintPedal(id); kbtn.textContent = it.key ? it.key.toUpperCase() : 'Assign key'; }; document.addEventListener('keydown', f, true); } }, it.key ? it.key.toUpperCase() : 'Assign key');
  const mn = Object.keys(BRD.midi).find(n => BRD.midi[n] === 'p:' + id);
  const mbtn = h('button', { class: 'btn sm', onclick: () => { BLEARN = id; mbtn.textContent = 'Hit a pad / footswitch…'; initMIDI(); } }, mn != null ? 'MIDI note ' + mn : 'Learn MIDI note');
  box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '74px' } }, 'Footswitch'), kbtn, mbtn));
  box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '74px' } }, 'Order'), h('button', { class: 'btn sm', title: 'Move this pedal one place earlier in the signal chain', onclick: () => { brdStep(id, -1); } }, '◀ Earlier'), h('button', { class: 'btn sm', title: 'Move this pedal one place later in the signal chain', onclick: () => { brdStep(id, 1); } }, 'Later ▶')));
  box.append(h('div', { class: 'lrow' }, h('button', { class: 'btn sm bad', id: 'pgRemove', title: 'Bypass it and take it off the board (＋ Pedal puts it back)', onclick: () => { closePop(); brdRemove(id); } }, '✕ Off the board')));
  box.append(h('div', { class: 'tiny muted', style: { marginTop: '4px' } }, 'Backspace while assigning clears the key. Double-click a pedal title to collapse it.'));
  popover(btn, box, { right: true });
}

/* ---------- scenes ---------- */
let MORPH = 0;
function sceneSave(i) { const s = { rig: rigSnapshot(), n: (BRD.scenes[i] && BRD.scenes[i].n) || 'Scene ' + (i + 1) }; if (BRD.incBand) s.band = { drumsOn: S.band.drumsOn, bassOn: S.band.bassOn, compOn: S.band.compOn, leadOn: S.band.leadOn }; BRD.scenes[i] = s; BRD.cur = i; saveBrd(); renderScenes(); toast('Stored scene ' + (i + 1), 'ok'); }
function sceneRecall(i) {
  const s = BRD.scenes[i]; if (!s) return toast('Scene ' + (i + 1) + ' is empty — Shift+click to store the current rig', 'warn'); if (!E.ready) return toast('Power on first');
  if (s.band) { Object.assign(S.band, s.band); commit(false); syncBandStrip(); }
  cancelAnimationFrame(MORPH); BRD.cur = i; renderScenes();
  if (!BRD.morph) { rigApply(s.rig); bus.emit('rig:state'); return; }
  const from = rigSnapshot(), t0 = performance.now(), orderSame = from.order.join() === s.rig.order.join(); if (!orderSame) { rigApply(s.rig); bus.emit('rig:state'); return; }
  const step = () => { const t = clamp((performance.now() - t0) / BRD.morph, 0, 1); if (t >= 1) { rigApply(s.rig); bus.emit('rig:state'); return; } rigApply(rigLerp(from, s.rig, t)); MORPH = requestAnimationFrame(step); }; step();
}
function sceneMenu(i, btn) {
  const s = BRD.scenes[i], box = h('div'); box.append(h('h5', {}, 'Scene ' + (i + 1)));
  const nm = h('input', { class: 'in', value: s ? s.n : 'Scene ' + (i + 1), style: { flex: 1, fontFamily: 'var(--sans)' }, onchange: e => { if (BRD.scenes[i]) { BRD.scenes[i].n = e.target.value || 'Scene ' + (i + 1); saveBrd(); renderScenes(); } } });
  box.append(h('div', { class: 'lrow' }, nm), h('div', { class: 'row' }, h('button', { class: 'btn sm primary', onclick: () => { if (BRD.scenes[i]) BRD.scenes[i].n = nm.value || 'Scene ' + (i + 1); sceneSave(i); if (nm.value) BRD.scenes[i].n = nm.value; saveBrd(); renderScenes(); closePop(); } }, 'Store current rig here'), h('button', { class: 'btn sm bad', onclick: () => { BRD.scenes[i] = null; saveBrd(); renderScenes(); closePop(); } }, 'Clear')));
  popover(btn, box);
}
function renderScenes() {
  const b = UI.scenebar; if (!b) return; b.innerHTML = ''; b.append(h('span', { class: 'tiny muted', style: { fontWeight: 800, letterSpacing: '.1em' } }, 'SCENES'));
  BRD.scenes.forEach((s, i) => { const bt = h('button', { class: 'scn' + (s ? '' : ' empty') + (BRD.cur === i && s ? ' cur' : '') + (BRD.storeArm ? ' store' : ''), title: s ? 'Click: recall · Shift+click: overwrite with the current rig · right-click: rename / clear  (key ' + (i + 1) + ', MIDI note ' + (36 + i) + ')' : 'Empty — Shift+click (or arm Store) to save the current rig here', onclick: e => { if (BRD.storeArm || e.shiftKey || !s) { if (!s && !BRD.storeArm && !e.shiftKey) { sceneSave(i); } else sceneSave(i); BRD.storeArm = false; renderScenes(); } else sceneRecall(i); }, oncontextmenu: e => { e.preventDefault(); sceneMenu(i, bt); } }, s ? s.n : '＋', h('small', {}, (i + 1) + (s && s.band ? ' · +band' : ''))); if (!s) bt.setAttribute('aria-label', 'Scene ' + (i + 1) + ', empty: store the current rig here'); b.append(bt); });      /* 2.66: an empty slot is just its number */
  b.append(h('button', { class: 'btn sm' + (BRD.storeArm ? ' on' : ''), title: 'Arm, then click a slot to store the current rig', onclick: () => { BRD.storeArm = !BRD.storeArm; renderScenes(); } }, '● Store')); b.append(h('button', { class: 'btn sm', title: 'Switch every pedal off (0)', onclick: () => boardKey('0') }, '⏻ All off'));
}
function digitKey(n) { if (stageOwnsKeys()) return stageScene(n - 1); if (BRD.live) sceneRecall(n - 1); }
function boardKey(k) {
  const lk = k.toLowerCase(); if (lk === '0' && BRD.live) { if (!E.ready) return; RIG.order.forEach(id => { if (RIG.units[id].on) RIG.units[id].setActive(false); }); syncPedals(); bus.emit('rig:state'); toast('All pedals off'); return; }
  if (!BRD.live) return; const id = Object.keys(BRD.items).find(o => BRD.items[o].key === lk); if (id) pedalState(id);
}

/* ---------- MIDI note bindings (pads / footswitch controllers) ---------- */
MIDIHOOKS.push((note, vel) => {
  if (BLEARN) { BRD.midi[note] = 'p:' + BLEARN; toast('MIDI note ' + note + ' → ' + FX[BLEARN].name, 'ok'); BLEARN = null; saveBrd(); return; }
  let a = BRD.midi[note]; if (!a) { if (note >= 36 && note <= 43) a = 's:' + (note - 36); else if (note >= 48 && note <= 55) a = 'g:' + (note - 48); }
  if (!a) return; const [t, v] = a.split(':'); if (t === 's') sceneRecall(+v); else if (t === 'p') pedalState(v); else if (t === 'g') stageScene(+v);
});

/* ---------- build ---------- */
function brdOptions(btn) {
  const box = h('div', { class: 'bp-opts' }, h('h5', {}, 'Board'));
  const row = (label, el) => box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '110px' } }, label), el));
  row('Pedal width (▦ All)', h('input', { type: 'range', min: 190, max: 460, step: 10, value: BRD.dens, oninput: e => { BRD.dens = +e.target.value; if (BRD.view === 'board') UI.board.style.gridTemplateColumns = 'repeat(auto-fill,minmax(' + BRD.dens + 'px,1fr))'; saveBrd(); } }));
  const mv = h('span', { class: 'mono tiny' }, BRD.morph + ' ms'); row('Scene morph', h('span', { class: 'row', style: { gap: '6px' } }, h('input', { type: 'range', min: 0, max: 3000, step: 50, value: BRD.morph, oninput: e => { BRD.morph = +e.target.value; mv.textContent = BRD.morph + ' ms'; saveBrd(); } }), mv));
  const chk = (label, title, k, fn) => box.append(h('label', { class: 'lrow chk', title }, h('input', { type: 'checkbox', checked: !!BRD[k], onchange: e => { BRD[k] = e.target.checked; saveBrd(); if (fn) fn(); } }), label));
  chk('Scenes switch the band too', 'A scene also stores which band instruments play', 'incBand');
  chk('Live keys', 'Keys 1–8 recall scenes, 0 = all off, a pedal’s key stomps it', 'live');
  chk('Show every unit', 'Every pedal in the chain, on the board or not, and hidden ones', 'hidShow', () => brdPaint());
  box.append(h('p', { class: 'tiny muted' }, 'Footswitch keys and MIDI notes are set per pedal (its ⚙). MIDI notes 36–43 recall scenes 1–8.'));
  popover(btn, box, { right: true });
}
function buildBoardExtras() {
  const p = PANES.rig; if (!p || !UI.board) return;
  UI.scenebar = h('div', { class: 'scenebar' }); UI.chain = h('div', { class: 'chainbar', tabindex: '0', role: 'region', 'aria-label': 'Your pedalboard, in signal order (scrolls sideways)' });
  UI.boardTools = h('div', { class: 'bp-tools' },
    h('div', { class: 'seg bv', role: 'group', 'aria-label': 'Board view' }, [['focus', '◎ Edit', 'The board, and the pedal you click, large'], ['board', '▦ All', 'Every pedal on the board, open'], ['stomp', '◉ Stomp', 'Big footswitches for playing live']].map(([v, n, t]) => h('button', { 'data-v': v, type: 'button', title: t, class: BRD.view === v ? 'on' : '', onclick: () => boardView(v) }, n))),
    h('button', { class: 'btn sm', id: 'brdOpts', type: 'button', title: 'Board options: pedal width, scene morph, scenes and the band, live keys, every unit', onclick: e => brdOptions(e.currentTarget) }, '⚙'));
  UI.deck.append(UI.scenebar); p.insertBefore(h('div', { class: 'pbar' }, UI.chain, UI.boardTools), UI.board);
  p.insertBefore(h('p', { class: 'small muted bp-empty', id: 'brdEmpty', hidden: true }, 'No pedals on the board: a straight signal. ＋ Pedal puts one on, or pick a tone.'), UI.board);
  RIG.order.forEach(id => {
    const P = PED[id]; if (!P) return; const head = P.el.querySelector('.pedal-h'), it = bitem(id);
    const gear = h('button', { class: 'pgear', title: 'Pedal settings: label, width, colour, collapse, hide, footswitch key / MIDI, off the board', onclick: e => { e.stopPropagation(); pedalGear(id, gear); } }, '⚙'); head.append(h('span', { class: 'kbadge', style: { display: 'none' } }), gear);
    head.addEventListener('dblclick', e => { if (e.target.closest('.stomp,.pgear')) return; it.col = !it.col; paintPedal(id); saveBrd(); });
    head.addEventListener('click', e => { if (BRD.view === 'stomp' && !e.target.closest('.stomp,.pgear')) pedalState(id); });
    P.el.addEventListener('pointerdown', () => { if (BRD.view === 'board' && BRD.sel !== id) { BRD.sel = id; saveBrd(); brdPaint(); } });
    paintPedal(id);
  });
  renderScenes(); boardView(BRD.view); brdSel();
  const again = () => { brdSel(); }; bus.on('rig:order', again); bus.on('rig:refresh', again); bus.on('rig:state', again); bus.on('audio:ready', () => setTimeout(again, 80)); bus.on('preset', () => { BRD.cur = -1; renderScenes(); setTimeout(again, 0); });
}

