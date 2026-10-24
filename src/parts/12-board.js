/* ============================================================
   Part 12 · pedalboard v2 — signal-chain strip, per-pedal size / colour / collapse / hide,
   footswitch keys + MIDI notes, 8 morphing scenes, big-footswitch stomp view
   ============================================================ */
const BRD = Object.assign({ view: 'board', items: {}, scenes: new Array(8).fill(null), morph: 250, incBand: false, live: true, midi: {}, dens: 250, cur: -1, storeArm: false, hidShow: false }, CFG.board || {});
while (BRD.scenes.length < 8) BRD.scenes.push(null);
const saveBrd = () => { CFG.board = BRD; saveCfg(); };
const BRD_COLORS = ['', '#e4572e', '#f2a900', '#3ddc84', '#35d3c2', '#4a90e2', '#a58bff', '#ff5fa2'];
const BRD_RESERVED = new Set([' ', 'r', 'l', 'm', 'd', 'b', 'g', 't', '?', '[', ']', 'home', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'escape', 'tab', 'enter', 'f']);
const bitem = id => BRD.items[id] || (BRD.items[id] = { size: 1, color: '', col: false, hid: false, key: '' });

function paintPedal(id) {
  const P = PED[id]; if (!P) return; const it = bitem(id), el = P.el;
  el.classList.toggle('s2', it.size === 2); el.classList.toggle('s3', it.size === 3); el.classList.toggle('cc', !!it.col); el.classList.toggle('hid', !!it.hid && !BRD.hidShow);
  if (it.color) el.style.setProperty('--pc', it.color); else el.style.removeProperty('--pc');
  const kb = el.querySelector('.kbadge'); if (kb) { kb.textContent = it.key ? it.key.toUpperCase() : ''; kb.style.display = it.key ? '' : 'none'; }
}
function boardView(v) {
  BRD.view = v; saveBrd(); const b = UI.board; if (!b) return; b.classList.toggle('stompmode', v === 'stomp');
  b.style.gridTemplateColumns = v === 'stomp' ? '' : 'repeat(auto-fill,minmax(' + BRD.dens + 'px,1fr))'; if (UI.chain) UI.chain.style.display = v === 'stomp' ? 'none' : '';
  $$('.bv button', UI.boardTools).forEach(x => x.classList.toggle('on', x.dataset.v === v));
}
function pedalState(id, on) { if (!E.ready) return toast('Power on first'); const u = RIG.units[id]; if (!u) return; u.setActive(on == null ? !u.on : on); PED[id].el.classList.toggle('on', u.on); bus.emit('rig:state'); }

/* ---------- signal chain strip ---------- */
function renderChain() {
  const c = UI.chain; if (!c) return; c.innerHTML = ''; c.append(h('span', { class: 'io' }, 'IN'));
  RIG.order.forEach(id => {
    const it = bitem(id), u = RIG.units[id], on = !!(u && u.on);
    const chip = h('div', { class: 'cchip' + (on ? ' on' : '') + (it.hid ? ' hid' : ''), draggable: 'true', title: FX[id].name + ' — click: engage · drag: reorder the chain', style: it.color ? { '--pc': it.color } : {},
      onclick: () => pedalState(id), ondragstart: e => { e.dataTransfer.setData('text/plain', id); }, ondragover: e => { e.preventDefault(); chip.classList.add('over'); }, ondragleave: () => chip.classList.remove('over'),
      ondrop: e => { e.preventDefault(); chip.classList.remove('over'); const f = e.dataTransfer.getData('text/plain'); if (f && f !== id && FX[f]) rigMove(f, RIG.order.indexOf(id)); } }, h('i'), FX[id].name);
    c.append(h('span', { class: 'arr' }, '›'), chip);
  });
  c.append(h('span', { class: 'arr' }, '›'), h('span', { class: 'io' }, 'OUT'));
}

/* ---------- per-pedal settings popover ---------- */
let BLEARN = null;
function pedalGear(id, btn) {
  const it = bitem(id), box = h('div'); box.append(h('h5', {}, FX[id].name));
  const seg = (label, opts, cur, fn) => box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '74px' } }, label), h('div', { class: 'seg' }, opts.map(([v, n]) => h('button', { class: cur === v ? 'on' : '', onclick: e => { fn(v); $$('button', e.target.parentNode).forEach(b => b.classList.toggle('on', b === e.target)); } }, n)))));
  seg('Width', [[1, 'S'], [2, 'M'], [3, 'L']], it.size, v => { it.size = v; paintPedal(id); saveBrd(); });
  box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '74px' } }, 'Colour'), h('div', { class: 'row', style: { gap: '5px' } }, BRD_COLORS.map(c => h('button', { class: 'swatch' + (it.color === c ? ' on' : ''), style: { background: c || 'var(--panel2)', border: c ? undefined : '2px dashed var(--line2)' }, onclick: e => { it.color = c; paintPedal(id); renderChain(); saveBrd(); $$('.swatch', e.target.parentNode).forEach(b => b.classList.toggle('on', b === e.target)); } })))));
  box.append(h('label', { class: 'lrow' }, h('input', { type: 'checkbox', checked: it.col, onchange: e => { it.col = e.target.checked; paintPedal(id); saveBrd(); } }), 'Collapse (stomp + title only)'), h('label', { class: 'lrow' }, h('input', { type: 'checkbox', checked: it.hid, onchange: e => { it.hid = e.target.checked; paintPedal(id); renderChain(); saveBrd(); } }), 'Hide from the board (stays in the chain)'));
  const kbtn = h('button', { class: 'btn sm', onclick: () => { kbtn.textContent = 'Press a key…'; const f = ev => { ev.preventDefault(); ev.stopPropagation(); document.removeEventListener('keydown', f, true); const k = ev.key.toLowerCase(); if (k === 'escape') { kbtn.textContent = it.key ? it.key.toUpperCase() : 'Assign key'; return; } if (k === 'backspace' || k === 'delete') it.key = ''; else if (BRD_RESERVED.has(k) || ev.ctrlKey || ev.metaKey || ev.altKey) { toast('“' + ev.key + '” is reserved for another shortcut', 'warn'); } else { Object.keys(BRD.items).forEach(o => { if (o !== id && BRD.items[o].key === k) BRD.items[o].key = ''; paintPedal(o); }); it.key = k; } saveBrd(); paintPedal(id); kbtn.textContent = it.key ? it.key.toUpperCase() : 'Assign key'; }; document.addEventListener('keydown', f, true); } }, it.key ? it.key.toUpperCase() : 'Assign key');
  const mn = Object.keys(BRD.midi).find(n => BRD.midi[n] === 'p:' + id);
  const mbtn = h('button', { class: 'btn sm', onclick: () => { BLEARN = id; mbtn.textContent = 'Hit a pad / footswitch…'; initMIDI(); } }, mn != null ? 'MIDI note ' + mn : 'Learn MIDI note');
  box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '74px' } }, 'Footswitch'), kbtn, mbtn));
  box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '74px' } }, 'Order'), h('button', { class: 'btn sm', title: 'Move this pedal one place earlier in the signal chain', onclick: () => { rigMove(id, RIG.order.indexOf(id) - 1); renderChain(); } }, '◀ Earlier'), h('button', { class: 'btn sm', title: 'Move this pedal one place later in the signal chain', onclick: () => { rigMove(id, RIG.order.indexOf(id) + 1); renderChain(); } }, 'Later ▶')));
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
  BRD.scenes.forEach((s, i) => { const bt = h('button', { class: 'scn' + (s ? '' : ' empty') + (BRD.cur === i && s ? ' cur' : '') + (BRD.storeArm ? ' store' : ''), title: s ? 'Click: recall · Shift+click: overwrite with the current rig · right-click: rename / clear  (key ' + (i + 1) + ', MIDI note ' + (36 + i) + ')' : 'Empty — Shift+click (or arm Store) to save the current rig here', onclick: e => { if (BRD.storeArm || e.shiftKey || !s) { if (!s && !BRD.storeArm && !e.shiftKey) { sceneSave(i); } else sceneSave(i); BRD.storeArm = false; renderScenes(); } else sceneRecall(i); }, oncontextmenu: e => { e.preventDefault(); sceneMenu(i, bt); } }, s ? s.n : '— empty —', h('small', {}, (i + 1) + (s && s.band ? ' · +band' : ''))); b.append(bt); });
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
function buildBoardExtras() {
  const p = PANES.rig; if (!p || !UI.board) return;
  UI.scenebar = h('div', { class: 'scenebar' }); UI.chain = h('div', { class: 'chainbar', tabindex: '0', role: 'region', 'aria-label': 'Signal chain (scrolls sideways)' });
  UI.boardTools = h('div', { class: 'dk dk4' },
    h('div', { class: 'seg bv' }, [['board', '▦ Board'], ['stomp', '◉ Stomp']].map(([v, n]) => h('button', { 'data-v': v, class: BRD.view === v ? 'on' : '', title: v === 'stomp' ? 'Big footswitch tiles for playing live' : 'Chain strip + full pedals', onclick: () => boardView(v) }, n))),
    h('label', { class: 'small', style: { fontWeight: 700 } }, 'Width ', h('input', { type: 'range', min: 190, max: 460, step: 10, value: BRD.dens, style: { width: '60px', verticalAlign: 'middle' }, oninput: e => { BRD.dens = +e.target.value; if (BRD.view !== 'stomp') UI.board.style.gridTemplateColumns = 'repeat(auto-fill,minmax(' + BRD.dens + 'px,1fr))'; saveBrd(); } })),
    h('label', { class: 'small', style: { fontWeight: 700 } }, 'Morph ', h('input', { type: 'range', min: 0, max: 3000, step: 50, value: BRD.morph, style: { width: '60px', verticalAlign: 'middle' }, oninput: e => { BRD.morph = +e.target.value; e.target.nextSibling.textContent = BRD.morph + ' ms'; saveBrd(); } }), h('span', { class: 'mono tiny' }, BRD.morph + ' ms')),
    h('label', { class: 'chk small', style: { display: 'flex', gap: '4px', alignItems: 'center', fontWeight: 700 }, title: 'Scenes also switch the band instruments' }, h('input', { type: 'checkbox', checked: BRD.incBand, onchange: e => { BRD.incBand = e.target.checked; saveBrd(); } }), 'Scenes + band'),
    h('label', { class: 'chk small', style: { display: 'flex', gap: '4px', alignItems: 'center', fontWeight: 700 }, title: 'Keys 1–8 recall scenes, 0 = all off, bound keys toggle pedals' }, h('input', { type: 'checkbox', checked: BRD.live, onchange: e => { BRD.live = e.target.checked; saveBrd(); } }), 'Live keys'),
    h('label', { class: 'chk small', style: { display: 'flex', gap: '4px', alignItems: 'center', fontWeight: 700 } }, h('input', { type: 'checkbox', checked: BRD.hidShow, onchange: e => { BRD.hidShow = e.target.checked; RIG.order.forEach(paintPedal); saveBrd(); } }), 'Show hidden'));
  UI.deck.append(UI.scenebar, UI.boardTools); p.insertBefore(UI.chain, UI.board);
  RIG.order.forEach(id => {
    const P = PED[id]; if (!P) return; const head = P.el.querySelector('.pedal-h'), it = bitem(id);
    const gear = h('button', { class: 'pgear', title: 'Pedal settings: width, colour, collapse, hide, footswitch key / MIDI', onclick: e => { e.stopPropagation(); pedalGear(id, gear); } }, '⚙'); head.append(h('span', { class: 'kbadge', style: { display: 'none' } }), gear);
    head.addEventListener('dblclick', e => { if (e.target.closest('.stomp,.pgear')) return; it.col = !it.col; paintPedal(id); saveBrd(); });
    head.addEventListener('click', e => { if (BRD.view === 'stomp' && !e.target.closest('.stomp,.pgear')) pedalState(id); });
    paintPedal(id);
  });
  renderScenes(); renderChain(); boardView(BRD.view);
  bus.on('rig:order', renderChain); bus.on('rig:refresh', renderChain); bus.on('rig:state', renderChain); bus.on('preset', () => { BRD.cur = -1; renderScenes(); });
}
