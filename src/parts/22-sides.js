/* ============================================================
   Part 22 · SIDEBARS AS TAB HOSTS — panels are interchangeable
   Each sidebar is a set of tabs. Tones · I/O · Theory (left) and Monitor · Refine (right) are the defaults, but any of
   them — and any of the 13 centre panels — can live in either sidebar or in the centre. Drag a tab to the other sidebar
   or onto the centre tab strip, right-click it for a menu, or use ⇆ → "Where panels live". Desktop only; phones and
   tablets always use the default homes (their drawers and chips already do the same job).
   ============================================================ */
const SD = { reg: {}, cur: { left: 'io', right: 'monitor' }, nat: { tones: 'left', io: 'left', theory: 'left', monitor: 'right', refine: 'right' }, ready: false };
const SIDE_NAME = { tones: 'Tones', io: 'I/O', theory: 'Theory', monitor: 'Monitor', refine: 'Refine' };
const SIDE_DEFW = { refine: 430, tones: 250, io: 250, theory: 250, monitor: 292 };
LAY.side = LAY.side || {}; LAY.sw = LAY.sw || {}; LAY.so = LAY.so || { left: [], right: [] }; LAY.cc = LAY.cc || {}; if (LAY.sc) Object.assign(SD.cur, LAY.sc);

const isDesk = () => !document.body.dataset.form || document.body.dataset.form === 'desktop';
const natHome = id => SD.nat[id] || 'dock';
function homeOf(id) { if (!isDesk()) return natHome(id); const v = LAY.side[id]; return v === 'left' || v === 'right' || v === 'dock' ? v : natHome(id); }
const sideHosted = id => { const hm = homeOf(id); return hm === 'left' || hm === 'right'; };
const sideVisible = id => { const hm = homeOf(id); return (hm === 'left' || hm === 'right') && SD.cur[hm] === id && (LAY[hm] || !isDesk()); };
const panelName = id => SIDE_NAME[id] || ((DOCK.find(d => d[0] === id) || [0, id])[1]);
const allPanelIds = () => Object.keys(SD.nat).concat(DOCK.map(d => d[0]));

/* ---------- widths: remembered per tab ---------- */
function sideW(side) {
  const id = SD.cur[side]; let w;
  if (id === 'tones' || id === 'io' || id === 'theory') w = LAY.lw; else if (id === 'monitor') w = LAY.rw; else w = LAY.sw[id] || SIDE_DEFW[id] || 460;
  return clamp(w || 250, 170, Math.max(260, Math.min(820, innerWidth - 430)));
}
function setSideW(side, w) {
  const id = SD.cur[side]; w = clamp(Math.round(w), 170, 820);
  if (id === 'tones' || id === 'io' || id === 'theory') LAY.lw = w; else if (id === 'monitor') LAY.rw = w; else LAY.sw[id] = w;
  $('#work').style.setProperty(side === 'left' ? '--lw' : '--rw', sideW(side) + 'px');
}
function resetSideW(side) {
  const id = SD.cur[side]; if (id === 'tones' || id === 'io' || id === 'theory') LAY.lw = 250; else if (id === 'monitor') LAY.rw = 292; else delete LAY.sw[id]; saveLay(); applyLayout();
}

/* ---------- which panels are where ---------- */
function sideIds(side) {
  const all = allPanelIds(), ord = LAY.so[side] || [];
  return all.filter(id => homeOf(id) === side).sort((a, b) => { const ia = ord.indexOf(a), ib = ord.indexOf(b); return (ia < 0 ? 999 + all.indexOf(a) : ia) - (ib < 0 ? 999 + all.indexOf(b) : ib); });
}
function sideTabs(side, ids) {
  const bar = h('div', { class: 'side-tabs', 'data-side': side, role: 'toolbar', 'aria-label': 'Panels' });
  const dropOn = (e, before) => { const t = e.dataTransfer.getData('text/plain'); if (!t.startsWith('tab:')) return; e.preventDefault(); e.stopPropagation(); bar.classList.remove('dropz'); movePanel(t.slice(4), side, before); };
  ids.forEach(id => {
    const b = h('button', {
      class: 'tab' + (id === SD.cur[side] ? ' on' : ''), 'data-id': id, draggable: 'true', title: 'Click: open · drag: move to the other sidebar or the centre · right-click: where does this panel live?',
      onclick: () => sideShow(id), oncontextmenu: e => { e.preventDefault(); placeMenu(b, id); },
      ondragstart: e => { e.dataTransfer.setData('text/plain', 'tab:' + id); e.dataTransfer.effectAllowed = 'move'; b.classList.add('dragging'); }, ondragend: () => b.classList.remove('dragging'),
      ondragover: e => { e.preventDefault(); b.classList.add('dropl'); }, ondragleave: () => b.classList.remove('dropl'), ondrop: e => { b.classList.remove('dropl'); dropOn(e, id); }
    }, panelName(id));
    bar.append(b);
  });
  bar.append(h('span', { class: 'grow' }), h('button', { class: 'tab sidemenu', title: 'Where panels live — move them between the sidebars and the centre', 'aria-label': 'Panel placement', onclick: e => placeMenu(e.currentTarget) }, '⇆'));
  bar.addEventListener('dragover', e => { e.preventDefault(); bar.classList.add('dropz'); }); bar.addEventListener('dragleave', e => { if (!bar.contains(e.relatedTarget)) bar.classList.remove('dropz'); }); bar.addEventListener('drop', e => dropOn(e, null));
  return bar;
}
function sideApply() {
  if (!SD.ready) return;
  ['left', 'right'].forEach(side => {
    const box = $('#' + side); if (!box) return; const ids = sideIds(side); if (!ids.includes(SD.cur[side])) SD.cur[side] = ids[0];
    const bar = sideTabs(side, ids), old = $(':scope > .side-tabs', box); if (old) old.replaceWith(bar); else box.insertBefore(bar, box.firstChild);
    ids.forEach(id => { const r = SD.reg[id]; if (!r) return; if (r.el.parentNode !== box) box.append(r.el); r.el.classList.toggle('on', id === SD.cur[side]); });
    box.dataset.cur = SD.cur[side] || '';
  });
  const dock = $('#dock'); DOCK.forEach(([id]) => { if (homeOf(id) !== 'dock') return; const p = PANES[id]; if (p && !FLOATS.has(id) && p.parentNode !== dock) { dock.append(p); p.classList.toggle('on', DOCK.cur === id); } });
  LAY.sc = { left: SD.cur.left, right: SD.cur.right }; if (typeof edgeSync === 'function') edgeSync();
}
function sideShow(id) {
  const hm = homeOf(id); if (hm === 'dock') { dockGo(id); return; }
  if (isDesk() && !LAY[hm]) { LAY[hm] = true; }
  SD.cur[hm] = id; sideApply(); saveLay(); applyLayout(); bus.emit('dock', id); setTimeout(() => window.dispatchEvent(new Event('resize')), 30);
  if (hm === 'right' && isDesk()) rightPeek(true);
}
/* a desktop-form window narrower than 1180px has no room for the right sidebar; open it as an overlay on demand */
function rightPeek(on) { const narrow = innerWidth <= 1180; document.body.classList.toggle('right-open', !!on && narrow); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('right-open') && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) rightPeek(false); });
document.addEventListener('pointerdown', e => { if (document.body.classList.contains('right-open') && !e.target.closest('#right,#songbar,.pop')) rightPeek(false); }, true);
function movePanel(id, to, before) {
  if (!SD.reg[id] && !PANES[id]) return false;
  if (!isDesk()) { toast('Panels can be rearranged in a desktop-size window. Phones and tablets keep the default places.', 'warn'); return false; }
  if (to === 'dock' && SD.nat[id]) { toast(panelName(id) + ' lives in the sidebars — move it to the other side instead.', 'warn'); return false; }
  if (FLOATS.has(id)) unfloat(id);
  const was = homeOf(id); if (to === natHome(id)) delete LAY.side[id]; else LAY.side[id] = to;
  ['left', 'right'].forEach(sd => { LAY.so[sd] = (LAY.so[sd] || []).filter(x => x !== id); });
  if (to === 'left' || to === 'right') { const arr = sideIds(to).filter(x => x !== id); const i = before ? arr.indexOf(before) : -1; if (i >= 0) arr.splice(i, 0, id); else arr.push(id); LAY.so[to] = arr; SD.cur[to] = id; if (!LAY[to]) LAY[to] = true; }
  if (was === 'left' || was === 'right') { const rest = sideIds(was); if (SD.cur[was] === id) SD.cur[was] = rest[0]; }
  sideApply(); rebuildTabs();
  if (DOCK.cur === id && to !== 'dock') { const nx = dockVisible().find(d => !FLOATS.has(d[0])); if (nx) dockGo(nx[0]); }
  if (to === 'dock') dockGo(id);
  saveLay(); applyLayout(); bus.emit('dock', id); setTimeout(() => window.dispatchEvent(new Event('resize')), 40); return true;
}
function swapSides() {
  if (!isDesk()) return;
  const flip = id => { const hm = homeOf(id); if (hm === 'left' || hm === 'right') { const nw = hm === 'left' ? 'right' : 'left'; if (nw === natHome(id)) delete LAY.side[id]; else LAY.side[id] = nw; } };
  const lo = sideIds('left'), ro = sideIds('right'); allPanelIds().forEach(flip); LAY.so = { left: ro.slice(), right: lo.slice() };
  const c = SD.cur.left; SD.cur.left = SD.cur.right; SD.cur.right = c; const a = LAY.left; LAY.left = LAY.right; LAY.right = a;
  sideApply(); rebuildTabs(); saveLay(); applyLayout(); setTimeout(() => window.dispatchEvent(new Event('resize')), 40);
}
function sideReset() { LAY.side = {}; LAY.sw = {}; LAY.so = { left: [], right: [] }; LAY.cc = {}; SD.cur = { left: 'io', right: 'monitor' }; sideApply(); $$('#left .card, #right .card').forEach(c => c.classList.remove('cc')); }

/* ---------- "where panels live" menu ---------- */
function placeMenu(anchor, focusId) {
  const box = h('div', { style: { minWidth: '300px' } }); box.append(h('h5', {}, 'Where panels live'));
  const row = id => {
    const hm = homeOf(id), nat = !!SD.nat[id], seg = h('div', { class: 'seg place' }, [['left', 'Left'], ['dock', 'Centre'], ['right', 'Right']].map(([v, t]) => h('button', { class: hm === v ? 'on' : '', disabled: nat && v === 'dock', title: nat && v === 'dock' ? 'Sidebar-only panel' : 'Move ' + panelName(id) + ' here', onclick: () => { movePanel(id, v); closePop(); } }, t)));
    return h('div', { class: 'lrow place-row' + (id === focusId ? ' hl' : '') }, h('span', { class: 'grow' }, panelName(id)), seg);
  };
  box.append(h('div', { class: 'tiny muted', style: { margin: '0 0 6px' } }, 'Sidebar panels'), ...Object.keys(SD.nat).map(row), h('div', { class: 'tiny muted', style: { margin: '8px 0 4px' } }, 'Centre panels'), ...DOCK.map(d => row(d[0])));
  box.append(h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn sm', onclick: () => { swapSides(); closePop(); } }, '⇄ Swap the sidebars'), h('button', { class: 'btn sm', onclick: () => { cardsAll(true); closePop(); } }, 'Collapse cards'), h('button', { class: 'btn sm', onclick: () => { cardsAll(false); closePop(); } }, 'Expand cards'),
    h('button', { class: 'btn sm', onclick: () => { [...allPanelIds()].forEach(id => { if (LAY.side[id]) delete LAY.side[id]; }); LAY.so = { left: [], right: [] }; sideReset(); rebuildTabs(); saveLay(); applyLayout(); closePop(); } }, 'Reset places')));
  popover(anchor, box, { style: { maxWidth: '380px' }, right: true });
}

/* ---------- collapsible config cards in the sidebars (so every option can be reached) ---------- */
function cardify(pane, pid) {
  [...pane.children].filter(c => c.classList && c.classList.contains('card')).forEach((c, i) => {
    const hd = c.firstElementChild; if (!hd || hd.tagName !== 'H4' || c._cardified) return; c._cardified = true; const key = pid + ':' + i;
    c.classList.toggle('cc', !!LAY.cc[key]); hd.classList.add('collap'); hd.title = 'Click to collapse / expand this card';
    hd.addEventListener('click', e => { if (e.target.closest('button,select,input,a,.led')) return; c.classList.toggle('cc'); LAY.cc[key] = c.classList.contains('cc'); saveLay(); });
  });
}
function cardsAll(collapse) {
  $$('#left .pane .card, #right .pane .card').forEach(c => { if (!c._cardified && !c.dataset.card) return; c.classList.toggle('cc', collapse); });
  Object.keys(LAY.cc).forEach(k => { LAY.cc[k] = collapse; }); ['io', 'theory'].forEach(pid => { const p = SD.reg[pid] && SD.reg[pid].el; if (p) [...p.children].filter(c => c.classList.contains('card')).forEach((c, i) => { LAY.cc[pid + ':' + i] = collapse; }); });
  RCARDS.forEach(n => { LAY.rc.col[n] = collapse; }); saveLay();
}

/* ---------- build ---------- */
function buildSides() {
  const lp = $$('#left > .pane'); ['tones', 'io', 'theory'].forEach((id, i) => { if (lp[i]) { lp[i].dataset.pane = id; SD.reg[id] = { id, el: lp[i], native: true }; } });
  if (UI.monPane) { UI.monPane.dataset.pane = 'monitor'; SD.reg.monitor = { id: 'monitor', el: UI.monPane, native: true }; }
  UI.refinePane = h('div', { class: 'pane', 'data-pane': 'refine' }, UI.refineBox); SD.reg.refine = { id: 'refine', el: UI.refinePane, native: true };
  DOCK.forEach(([id]) => { if (PANES[id]) SD.reg[id] = { id, el: PANES[id], native: false }; });
  cardify(SD.reg.io.el, 'io'); cardify(SD.reg.theory.el, 'theory');
  SD.ready = true; sideApply();
  // drop a tab anywhere on a sidebar to move it there; drop on the centre tab strip to bring it back
  [['left', $('#left')], ['right', $('#right')]].forEach(([side, el]) => {
    el.addEventListener('dragover', e => { if (!isDesk() || ![...e.dataTransfer.types].includes('text/plain')) return; e.preventDefault(); el.classList.add('dropzone'); }); el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('dropzone'); });
    el.addEventListener('drop', e => { el.classList.remove('dropzone'); const t = e.dataTransfer.getData('text/plain'); if (t.startsWith('tab:')) { e.preventDefault(); movePanel(t.slice(4), side); } });
  });
  bus.on('form', () => { sideApply(); rebuildTabs(); applyLayout(); });
}
