/* ============================================================
   Part 11 · workspace layout manager
   flipped workspace (tabs above arrangement), splitters, layout presets, tab order/visibility,
   floating panels, collapsible sidebar cards, always-on band strip
   ============================================================ */
const LAY = Object.assign({ flip: true, left: true, right: true, lw: 250, rw: 292, tlh: null, hidden: [], order: [], floats: {}, fl: [], rc: { order: [], col: {}, hide: {} } }, CFG.layout || {});
LAY.rc = Object.assign({ order: [], col: {}, hide: {} }, LAY.rc || {});
const FLOATS = new Map();
const saveLay = () => { CFG.layout = LAY; saveCfg(); };
const TLH_DEFAULT = 'minmax(200px,40%)';

/* ---------- apply ---------- */
function applyLayout() {
  const c = $('#center'), w = $('#work'); if (!c || !w) return;
  c.classList.toggle('flip', !!LAY.flip);
  w.classList.remove('collapsed-l', 'collapsed-r');
  w.style.setProperty('--lw', (LAY.left ? sideW('left') : 0) + 'px'); w.style.setProperty('--rw', (LAY.right ? sideW('right') : 0) + 'px');
  c.style.setProperty('--tlh', LAY.tlh || TLH_DEFAULT);
  { const dsk = !document.body.dataset.form || document.body.dataset.form === 'desktop'; $('#left').style.visibility = !dsk || LAY.left ? '' : 'hidden'; $('#right').style.visibility = !dsk || LAY.right ? '' : 'hidden'; }
  setTimeout(() => { if (typeof tlSize === 'function') tlSize(); window.dispatchEvent(new Event('resize')); }, 40);
}
function toggleSide(k) { if (document.body.dataset.form && document.body.dataset.form !== 'desktop') { mDrawer(k); return; } LAY[k] = !LAY[k]; saveLay(); applyLayout(); }

/* ---------- splitters ---------- */
function dragger(el, onMove, onEnd) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('drag'); const x0 = e.clientX, y0 = e.clientY; const mv = ev => onMove(ev.clientX - x0, ev.clientY - y0, ev); const up = () => { el.classList.remove('drag'); el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); onEnd && onEnd(); }; el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); onMove(0, 0, e); });
}
function buildSplitters() {
  const tl = $('#timeline'), sh = h('div', { class: 'split-h', title: 'Drag to resize the arrangement · double-click to reset' }); tl.append(sh);
  let h0 = 0; sh.addEventListener('pointerdown', () => { h0 = tl.offsetHeight; });
  dragger(sh, (dx, dy) => { if (!h0) return; const tot = $('#center').clientHeight, nh = clamp(LAY.flip ? h0 - dy : h0 + dy, 84, tot - 170); LAY.tlh = Math.round(nh) + 'px'; $('#center').style.setProperty('--tlh', LAY.tlh); if (typeof tlSize === 'function') tlSize(); }, saveLay);
  sh.addEventListener('dblclick', () => { LAY.tlh = null; saveLay(); applyLayout(); });
  [['left', 1], ['right', -1]].forEach(([side, dir]) => {
    const el = $('#' + side), sv = h('div', { class: 'split-v', title: 'Drag to resize · double-click to reset' }); el.append(sv); let w0 = 0; sv.addEventListener('pointerdown', () => { w0 = sideW(side); });
    dragger(sv, dx => { if (!w0) return; setSideW(side, w0 + dx * dir); }, () => { saveLay(); setTimeout(() => window.dispatchEvent(new Event('resize')), 30); });
    sv.addEventListener('dblclick', () => resetSideW(side));
  });
}

/* ---------- popover helper ---------- */
let POP = null;
function closePop() { if (POP) { POP.remove(); POP = null; } }
document.addEventListener('pointerdown', e => { if (POP && !POP.contains(e.target) && !(POP._anchor && POP._anchor.contains(e.target))) closePop(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
function popover(anchor, content, o = {}) {
  const was = POP && POP._anchor === anchor; closePop(); if (was) return null;
  const p = h('div', { class: 'pop', style: o.style || {} }, content); p._anchor = anchor; document.body.append(p); POP = p;
  const r = anchor.getBoundingClientRect(), pw = p.offsetWidth, ph = p.offsetHeight; let x = o.right ? r.right - pw : r.left, y = r.bottom + 6; if (x + pw > innerWidth - 8) x = innerWidth - pw - 8; if (x < 8) x = 8; if (y + ph > innerHeight - 8) y = Math.max(8, r.top - ph - 6);
  p.style.left = x + 'px'; p.style.top = y + 'px'; return p;
}

/* ---------- tabs: order, visibility, floating ---------- */
function applyTabOrder() { if (!LAY.order.length) return; const ix = id => { const i = LAY.order.indexOf(id); return i < 0 ? 999 : i; }; const cur = DOCK.cur, a = DOCK.slice().sort((p, q) => ix(p[0]) - ix(q[0])); DOCK.splice(0, DOCK.length, ...a); DOCK.cur = cur; }
function rebuildTabs() {
  const tabs = $('#dock .tabs'); if (!tabs) return; tabs.innerHTML = '';
  if (!tabs._drop) { tabs._drop = true; tabs.addEventListener('dragover', e => { e.preventDefault(); }); tabs.addEventListener('drop', e => { const t = e.dataTransfer.getData('text/plain'); if (t.startsWith('tab:') && sideHosted(t.slice(4))) { e.preventDefault(); movePanel(t.slice(4), 'dock'); } }); }
  if (!tabs._wheel) { tabs._wheel = true; tabs.addEventListener('wheel', e => { if (tabs.scrollWidth > tabs.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { tabs.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false }); }
  dockVisible().forEach(([id, name], i) => {
    const b = h('button', {
      class: 'tab' + (DOCK.cur === id ? ' on' : ''), 'data-id': id, draggable: 'true', title: 'Click: open · drag: reorder · double-click: float as a window',
      onclick: () => { if (!['vis', 'song', 'band', 'exp'].includes(id)) xpSignal(1); FLOATS.has(id) ? floatFront(id) : dockGo(id); }, ondblclick: () => FLOATS.has(id) ? unfloat(id) : floatPane(id),
      ondragstart: e => { e.dataTransfer.setData('text/plain', 'tab:' + id); e.dataTransfer.effectAllowed = 'move'; b.classList.add('dragging'); }, ondragend: () => b.classList.remove('dragging'),
      ondragover: e => { e.preventDefault(); b.classList.add('dropl'); }, ondragleave: () => b.classList.remove('dropl'),
      ondrop: e => { e.preventDefault(); b.classList.remove('dropl'); const t = e.dataTransfer.getData('text/plain'); if (t.startsWith('tab:')) { const from = t.slice(4); if (sideHosted(from)) { if (movePanel(from, 'dock')) moveTab(from, id); } else moveTab(from, id); } }
    }, xpTabText(id, name, i) + (FLOATS.has(id) ? ' ⧉' : '')); tabs.append(b);
  });
  tabs.append(xpToolsButton());
}
function moveTab(id, beforeId) { if (id === beforeId) return; const a = DOCK.findIndex(d => d[0] === id), it = DOCK.splice(a, 1)[0], b = DOCK.findIndex(d => d[0] === beforeId); DOCK.splice(b < 0 ? DOCK.length : b, 0, it); LAY.order = DOCK.map(d => d[0]); saveLay(); rebuildTabs(); }
function setTabHidden(id, hide) { const i = LAY.hidden.indexOf(id); if (hide && i < 0) { LAY.hidden.push(id); if (DOCK.cur === id) { const n = dockVisible().find(d => !FLOATS.has(d[0])); if (n) dockGo(n[0]); } } else if (!hide && i >= 0) LAY.hidden.splice(i, 1); saveLay(); rebuildTabs(); }
function floatPane(id, geo) {
  if (FLOATS.has(id)) return; const p = PANES[id]; if (!p) return; const def = DOCK.find(d => d[0] === id), n = FLOATS.size, g = geo || LAY.floats[id] || { x: 110 + n * 34, y: 96 + n * 30, w: Math.min(760, innerWidth - 160), h: Math.min(520, innerHeight - 180) };
  const win = h('div', { class: 'floatwin', 'data-id': id, style: { left: g.x + 'px', top: g.y + 'px', width: g.w + 'px', height: g.h + 'px' } });
  const head = h('div', { class: 'float-h' }, h('b', {}, def ? def[1] : id), h('span', { class: 'grow' }), h('button', { class: 'btn sm', title: 'Return to the dock', onclick: () => unfloat(id) }, '⤓ Dock'));
  win.append(head, p); $('#app').append(win); FLOATS.set(id, win); win._ro = new ResizeObserver(() => { const r = win.getBoundingClientRect(); LAY.floats[id] = { x: r.left, y: r.top, w: r.width, h: r.height }; saveLayLater(); }); win._ro.observe(win);
  let ox = 0, oy = 0; head.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; floatFront(id); const r = win.getBoundingClientRect(); ox = e.clientX - r.left; oy = e.clientY - r.top; head.setPointerCapture(e.pointerId); const mv = ev => { win.style.left = clamp(ev.clientX - ox, -win.offsetWidth + 80, innerWidth - 80) + 'px'; win.style.top = clamp(ev.clientY - oy, 0, innerHeight - 40) + 'px'; }, up = () => { head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); const r2 = win.getBoundingClientRect(); LAY.floats[id] = { x: r2.left, y: r2.top, w: r2.width, h: r2.height }; saveLay(); }; head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up); });
  win.addEventListener('pointerdown', () => floatFront(id), true); floatFront(id);
  if (DOCK.cur === id) { const n2 = dockVisible().find(d => !FLOATS.has(d[0])); if (n2) dockGo(n2[0]); }
  LAY.fl = [...FLOATS.keys()]; saveLay(); rebuildTabs(); bus.emit('dock', id); setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
}
let _slt = 0; const saveLayLater = () => { clearTimeout(_slt); _slt = setTimeout(saveLay, 400); };
let _zf = 41; function floatFront(id) { const w = FLOATS.get(id); if (w) w.style.zIndex = ++_zf; }
function unfloat(id) { const w = FLOATS.get(id); if (!w) return; w._ro.disconnect(); $('#dock').append(PANES[id]); w.remove(); FLOATS.delete(id); LAY.fl = [...FLOATS.keys()]; saveLay(); rebuildTabs(); dockGo(id); setTimeout(() => window.dispatchEvent(new Event('resize')), 50); }

/* ---------- sidebar cards: drag to reorder, click title to collapse ---------- */
const RCARDS = ['tuner', 'levels', 'live', 'spectrum'];
function setupCards() {
  const p = UI.monPane; if (!p) return; const cards = [...p.children]; cards.forEach((c, i) => { c.dataset.card = RCARDS[i] || ('c' + i); });
  const byName = n => cards.find(c => c.dataset.card === n);
  LAY.rc.order.concat(RCARDS).forEach(n => { const c = byName(n); if (c) p.append(c); });
  cards.forEach(c => {
    const n = c.dataset.card, hd = c.firstChild; c.classList.toggle('cc', !!LAY.rc.col[n]); c.style.display = LAY.rc.hide[n] ? 'none' : '';
    hd.setAttribute('draggable', 'true'); hd.title = 'Click: collapse · drag: reorder'; hd.addEventListener('click', e => { if (e.target.closest('button,select,input,.led')) return; c.classList.toggle('cc'); LAY.rc.col[n] = c.classList.contains('cc'); saveLay(); });
    hd.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', 'card:' + n); });
    c.addEventListener('dragover', e => { e.preventDefault(); c.classList.add('dropt'); }); c.addEventListener('dragleave', () => c.classList.remove('dropt'));
    c.addEventListener('drop', e => { e.preventDefault(); c.classList.remove('dropt'); const t = e.dataTransfer.getData('text/plain'); if (!t.startsWith('card:')) return; const f = byName(t.slice(5)); if (f && f !== c) { p.insertBefore(f, c); LAY.rc.order = [...p.children].map(x => x.dataset.card); saveLay(); } });
  });
}
function setCardHidden(n, hide) { LAY.rc.hide[n] = hide; const c = $('[data-card="' + n + '"]', UI.monPane); if (c) c.style.display = hide ? 'none' : ''; saveLay(); }

/* ---------- presets ---------- */
const LAYOUTS = [
  ['Compose', 'Tabs on top, arrangement below, both sidebars', { flip: true, left: true, right: true, tlh: null, dock: 'tab' }],
  ['Perform', 'Pedalboard stomps on top, slim arrangement, tuner & meters at right', { flip: true, left: false, right: true, tlh: '132px', dock: 'rig', board: 'stomp' }],
  ['Pedalboard', 'All the room for pedals — sidebars away, thin arrangement', { flip: true, left: false, right: false, tlh: '96px', dock: 'rig', board: 'board' }],
  ['Light show', 'Stage visuals with a thin arrangement', { flip: true, left: false, right: false, tlh: '104px', dock: 'stage' }],
  ['Studio (classic)', 'Original look: arrangement above, tabs below', { flip: false, left: true, right: true, tlh: null, dock: 'tab' }],
  ['Songwriting', 'Tab above, chords & lyrics (Refine) beside it', { flip: true, left: false, right: true, tlh: 'minmax(150px,30%)', dock: 'tab', cur: { right: 'refine' } }],
  ['Track study', 'Stems above, big arrangement showing the track lanes', { flip: true, left: false, right: true, tlh: 'minmax(260px,54%)', dock: 'stems', cur: { right: 'refine' } }],
  ['Record', 'I/O at left, big arrangement with guitar + vocal lanes', { flip: true, left: true, right: true, tlh: 'minmax(260px,56%)', dock: 'rig', cur: { left: 'io', right: 'monitor' } }],
  ['Focus', 'Just the panel — no sidebars, slim arrangement', { flip: true, left: false, right: false, tlh: '90px', dock: null }]
];
function applyPreset(s) {
  Object.assign(LAY, { flip: s.flip, left: s.left, right: s.right, tlh: s.tlh }); if (s.lw) LAY.lw = s.lw; if (s.rw) LAY.rw = s.rw;
  if (s.hidden) LAY.hidden = s.hidden.slice(); if (s.order) { LAY.order = s.order.slice(); applyTabOrder(); } if (s.rc) LAY.rc = JSON.parse(JSON.stringify(s.rc));
  if (s.side) LAY.side = JSON.parse(JSON.stringify(s.side)); if (s.cur) Object.assign(SD.cur, s.cur); if (typeof sideApply === 'function') sideApply();
  saveLay(); applyLayout(); setupCardsRefresh(); rebuildTabs(); if (s.dock) { if (FLOATS.has(s.dock)) floatFront(s.dock); else dockGo(s.dock); } if (s.board && typeof boardView === 'function') boardView(s.board);
}
function setupCardsRefresh() { $$('[data-card]', UI.monPane).forEach(c => { const n = c.dataset.card; c.classList.toggle('cc', !!LAY.rc.col[n]); c.style.display = LAY.rc.hide[n] ? 'none' : ''; }); const p = UI.monPane; LAY.rc.order.forEach(n => { const c = $('[data-card="' + n + '"]', p); if (c) p.append(c); }); }
function layoutMenu(btn) {
  const saved = store.get('layouts', []), box = h('div');
  box.append(h('h5', {}, 'Layouts'));
  LAYOUTS.forEach(([n, d, s]) => box.append(h('button', { class: 'pbtn', onclick: () => { applyPreset(s); closePop(); } }, h('b', {}, n), h('span', {}, d))));
  saved.forEach((l, i) => box.append(h('div', { class: 'lrow' }, h('button', { class: 'pbtn', style: { margin: 0, flex: 1 }, onclick: () => { applyPreset(l.s); closePop(); } }, h('b', {}, '★ ' + l.n), h('span', {}, 'your layout')), h('button', { class: 'btn sm bad', title: 'Delete', onclick: () => { saved.splice(i, 1); store.set('layouts', saved); closePop(); } }, '✕'))));
  const nm = h('input', { class: 'in', placeholder: 'Name this layout…', style: { flex: 1, fontFamily: 'var(--sans)' } });
  box.append(h('div', { class: 'lrow' }, nm, h('button', { class: 'btn sm primary', onclick: () => { const n = nm.value.trim(); if (!n) return toast('Name your layout', 'warn'); const s = { flip: LAY.flip, left: LAY.left, right: LAY.right, lw: LAY.lw, rw: LAY.rw, tlh: LAY.tlh, hidden: LAY.hidden.slice(), order: DOCK.map(d => d[0]), rc: JSON.parse(JSON.stringify(LAY.rc)), dock: DOCK.cur, side: JSON.parse(JSON.stringify(LAY.side)), cur: { left: SD.cur.left, right: SD.cur.right } }; const a = saved.filter(x => x.n !== n); a.push({ n, s }); store.set('layouts', a); toast('Layout “' + n + '” saved', 'ok'); closePop(); } }, 'Save current')));
  box.append(h('h5', {}, 'Workspace'));
  const chk = (label, get, set) => h('label', { class: 'lrow' }, h('input', { type: 'checkbox', checked: get(), onchange: e => set(e.target.checked) }), label);
  box.append(chk('Panels above the arrangement', () => LAY.flip, v => { LAY.flip = v; saveLay(); applyLayout(); }), chk('Left sidebar  [', () => LAY.left, v => { LAY.left = v; saveLay(); applyLayout(); }), chk('Right sidebar  ]', () => LAY.right, v => { LAY.right = v; saveLay(); applyLayout(); }));
  box.append(h('button', { class: 'pbtn', onclick: () => placeMenu(btn) }, h('b', {}, '⇆ Where panels live…'), h('span', {}, 'Move any panel to the left sidebar, the right sidebar or the centre · swap the sidebars')));
  box.append(h('h5', {}, 'Panels — show / hide · double-click a tab to float it'));
  DOCK.forEach(([id, name]) => box.append(h('div', { class: 'lrow' }, h('input', { type: 'checkbox', checked: !LAY.hidden.includes(id), onchange: e => setTabHidden(id, !e.target.checked) }), h('span', { class: 'grow' }, name), h('button', { class: 'btn sm', onclick: () => { FLOATS.has(id) ? unfloat(id) : floatPane(id); closePop(); } }, FLOATS.has(id) ? '⤓ dock' : '⧉ float'))));
  box.append(h('h5', {}, 'Right-sidebar cards'));
  RCARDS.forEach(n => box.append(h('label', { class: 'lrow' }, h('input', { type: 'checkbox', checked: !LAY.rc.hide[n], onchange: e => setCardHidden(n, !e.target.checked) }), n[0].toUpperCase() + n.slice(1))));
  box.append(h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn sm', onclick: () => { [...FLOATS.keys()].forEach(unfloat); LAY.hidden = []; LAY.order = []; LAY.rc = { order: [], col: {}, hide: {} }; LAY.floats = {}; sideReset(); DOCK.sort((a, b) => ['rig', 'tab', 'song', 'band', 'fret', 'vis', 'stage', 'neural', 'stems', 'tx', 'cam', 'lab', 'exp'].indexOf(a[0]) - ['rig', 'tab', 'song', 'band', 'fret', 'vis', 'stage', 'neural', 'stems', 'tx', 'cam', 'lab', 'exp'].indexOf(b[0])); applyPreset(LAYOUTS[0][2]); closePop(); } }, 'Reset layout')));
  popover(btn, box, { right: true });
}

/* ---------- band strip: always-visible instrument switches ---------- */
const BAND_KEYS = [['drums', 'Drums', 'drumsOn'], ['bass', 'Bass', 'bassOn'], ['rhythm', 'Rhythm', 'compOn'], ['lead', 'Lead tab', 'leadOn']];
const REHEARSAL = [['Full band', { drumsOn: 1, bassOn: 1, compOn: 1, leadOn: 1 }], ['Rhythm section (drums + bass)', { drumsOn: 1, bassOn: 1, compOn: 0, leadOn: 0 }], ['Acoustic duo (rhythm + bass)', { drumsOn: 0, bassOn: 1, compOn: 1, leadOn: 0 }], ['Drums only', { drumsOn: 1, bassOn: 0, compOn: 0, leadOn: 0 }], ['Bass only', { drumsOn: 0, bassOn: 1, compOn: 0, leadOn: 0 }], ['Rhythm guitar only', { drumsOn: 0, bassOn: 0, compOn: 1, leadOn: 0 }], ['Tab playback only', { drumsOn: 0, bassOn: 0, compOn: 0, leadOn: 1 }], ['Play over me (click only)', { drumsOn: 0, bassOn: 0, compOn: 0, leadOn: 0, click: 1 }]];
function toggleBand(key, val) { S.band[key] = val == null ? !S.band[key] : !!val; commit(false); syncBandStrip(); if (paneVisible('band') && typeof renderBand === 'function') renderBand(); }
function setRehearsal(cfg) { Object.keys(cfg).forEach(k => { if (k === 'click') { T.metro = !!cfg.click; } else S.band[k] = !!cfg[k]; }); if (!('click' in cfg)) { /* leave click alone */ } commit(false); syncTransport(); syncBandStrip(); if (paneVisible('band')) renderBand(); }
function syncBandStrip() {
  if (!UI.bchips) return; BAND_KEYS.forEach(([id, , key]) => UI.bchips[id].classList.toggle('on', !!S.band[key])); UI.bchips.click.classList.toggle('on', !!T.metro);
  const all = BAND_KEYS.every(([, , k]) => S.band[k]), none = BAND_KEYS.every(([, , k]) => !S.band[k]); UI.bmix.value = ''; UI.bmix.title = all ? 'Full band' : none ? 'Band silent' : 'Custom mix';
  $$('.tl-head .pw').forEach(b => b.classList.toggle('on', !!S.band[b.dataset.k]));
}
function bandPop(chip, id, key) {
  const m = S.mix[id], box = h('div'); box.append(h('h5', {}, BAND_KEYS.find(x => x[0] === id)[1]));
  box.append(h('label', { class: 'lrow' }, h('input', { type: 'checkbox', checked: !!S.band[key], onchange: e => toggleBand(key, e.target.checked) }), 'Enabled'));
  box.append(h('div', { class: 'lrow' }, h('span', {}, 'Level'), h('input', { type: 'range', min: 0, max: 1.4, step: .01, value: m.g, style: { flex: 1 }, oninput: e => { m.g = +e.target.value; applyMix(); commit(false); } })));
  box.append(h('div', { class: 'lrow' }, h('span', {}, 'Pan'), h('input', { type: 'range', min: -1, max: 1, step: .01, value: m.p, style: { flex: 1 }, oninput: e => { m.p = +e.target.value; applyMix(); commit(false); } })));
  box.append(h('div', { class: 'row' }, h('button', { class: 'btn sm' + (m.m ? ' on' : ''), onclick: e => { m.m = m.m ? 0 : 1; e.target.classList.toggle('on', !!m.m); applyMix(); commit(false); } }, 'Mute'), h('button', { class: 'btn sm' + (m.s ? ' on' : ''), onclick: e => { m.s = m.s ? 0 : 1; e.target.classList.toggle('on', !!m.s); applyMix(); commit(false); } }, 'Solo')));
  const sel = (label, opts, val, fn) => box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '66px' } }, label), h('select', { class: 'in', style: { flex: 1, fontFamily: 'var(--sans)' }, onchange: e => { fn(e.target.value); if (paneVisible('band')) renderBand(); } }, opts.map(o => h('option', { selected: o === val }, o)))));
  if (id === 'drums') { sel('Pattern', Object.keys(DPATS), S.band.patName, v => { setDrumPattern(v); }); sel('Kit', Object.keys(KITS), S.band.kit, v => { S.band.kit = v; commit(false); }); }
  if (id === 'bass') { sel('Style', BASS_STYLES, S.band.bassStyle, v => { S.band.bassStyle = v; commit(false); }); sel('Tone', ['Round', 'Sub', 'Pick', 'Muted Pluck'], S.band.bassTone, v => { S.band.bassTone = v; commit(false); }); }
  if (id === 'rhythm') { sel('Pattern', Object.keys(STRUMS), S.band.compStyle, v => { S.band.compStyle = v; commit(false); }); sel('Voice', ['Steel', 'Nylon', 'Electric', 'Muted Pluck'], S.band.compInst, v => { S.band.compInst = v; commit(false); }); }
  if (id === 'lead') sel('Voice', ['Nylon', 'Steel', 'Electric', 'Muted Pluck'], S.band.leadInst, v => { S.band.leadInst = v; commit(false); });
  popover(chip, box, { right: true });
}
function buildBandStrip() {
  const strip = h('div', { class: 'bandstrip' }); UI.bchips = {}; strip.append(h('span', { class: 'bs-l' }, 'BAND'));
  BAND_KEYS.forEach(([id, name, key]) => { const c = h('button', { class: 'bchip', title: name + ' — click: on/off · right-click: level, pan, style  (' + { drums: 'D', bass: 'B', rhythm: 'G', lead: 'T' }[id] + ')', onclick: () => toggleBand(key), oncontextmenu: e => { e.preventDefault(); bandPop(c, id, key); } }, h('i', { class: 'led' }), name); UI.bchips[id] = c; strip.append(c); });
  UI.bchips.click = h('button', { class: 'bchip warn', title: 'Metronome click (M)', onclick: () => { T.metro = !T.metro; syncTransport(); } }, h('i', { class: 'led' }), 'Click'); strip.append(UI.bchips.click);
  UI.bmix = h('select', { class: 'in', title: 'Rehearsal mixes — who plays with you', onchange: e => { const r = REHEARSAL[+e.target.value]; if (r) setRehearsal(r[1]); } }, h('option', { value: '' }, 'Mix…'), REHEARSAL.map((r, i) => h('option', { value: i }, r[0]))); strip.append(UI.bmix);
  return strip;
}

/* ---------- build ---------- */
function buildLayout() {
  const dock = $('#dock'), tabs = $('.tabs', dock), bar = h('div', { class: 'dockbar' }); dock.insertBefore(bar, tabs); bar.append(tabs, dockMore(), buildBandStrip());
  applyTabOrder(); rebuildTabs(); buildSplitters(); setupCards(); applyLayout();
  const btn = h('button', { class: 'btn icon', title: 'Layout — presets, panel order, floating windows', onclick: () => layoutMenu(btn) }, '▦'); const tr = $('#topR'); tr.insertBefore(btn, tr.firstChild);
  bus.on('song', syncBandStrip); bus.on('transport', syncBandStrip); bus.on('dock', () => { $$('#dock .tab').forEach(t => t.classList.toggle('on', t.dataset.id === DOCK.cur)); }); syncBandStrip();
  LAY.fl.slice().forEach(id => { try { floatPane(id, LAY.floats[id]); } catch (e) { console.warn(e); } });
}
