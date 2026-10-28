/* ============================================================
   Part 07 · DAW timeline (canvas, virtualized) and the tablature editor
   ============================================================ */
const TL = { bw: 150, lh: 46, rh: 22, sh: 20, follow: true, cache: null, dirty: true, col: {}, drag: null, clip: null };
function tlColors() {
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  TL.col = { bg: g('--panel'), bg2: g('--bg2'), grid: g('--grid'), line: g('--line'), line2: g('--line2'), text: g('--text'), muted: g('--muted'), accent: g('--accent'), accent2: g('--accent2'), wave: g('--wave'), p2: g('--panel2'), cv: [g('--cv1'), g('--cv2'), g('--cv3'), g('--cv4'), g('--cv5')] }; TL.dirty = true;
}
bus.on('theme', tlColors); bus.on('song', () => { TL.cache = null; TL.dirty = true; });
function buildTimeline() {
  const el = $('#timeline'); tlColors();
  const bar = h('div', { class: 'tl-bar' });
  const zoom = h('input', { type: 'range', 'aria-label': 'Timeline zoom', min: 50, max: 420, step: 10, value: TL.bw, style: { width: '110px' }, oninput: e => { TL.bw = +e.target.value; TL.dirty = true; tlSize(); } });
  const sw = h('input', { type: 'range', min: 0, max: .5, step: .01, value: S.swing, style: { width: '90px' }, title: 'Swing (delays off-16ths)', oninput: e => { S.swing = +e.target.value; commit(false); } });
  UI.follow = h('button', { class: 'btn sm on', onclick: e => { TL.follow = !TL.follow; e.target.classList.toggle('on', TL.follow); } }, 'Follow');
  UI.tlinfo = h('span', { class: 'chip' });
  bar.append(h('b', { class: 'small', title: 'Click ruler = seek · Shift-drag = loop · Double-click ruler = clear loop · click section strip = select section' }, 'ARRANGEMENT'), UI.follow, h('span', { class: 'small muted' }, 'Zoom'), zoom, h('span', { class: 'small muted' }, 'Swing'), sw,
    h('button', { class: 'btn sm', title: 'Clear loop region (double-click ruler)', onclick: () => { T.loopA = 0; T.loopB = null; TL.dirty = true; } }, 'Clear loop'),
    h('button', { class: 'btn sm lp-btn', id: 'lpBtn', title: 'Record a part, loop it, and play the next part on top, like a looper pedal', onclick: () => looperOpen() }, '⟲ Loop & layer'),
    h('button', { class: 'btn sm', onclick: () => { T.loop = true; T.loopA = Math.floor(playheadSlot() / spb()) * spb(); T.loopB = Math.min(songSlots(), T.loopA + spb() * 4); syncTransport(); TL.dirty = true; } }, 'Loop 4 bars here'), clipBarMake(), h('span', { class: 'grow' }), UI.tlinfo,
    h('span', { class: 'small muted' }, 'Lanes'), h('button', { class: 'btn sm', title: 'Shorter lanes', 'aria-label': 'Shorter lanes', onclick: () => laneScale(-.2) }, '−'), h('button', { class: 'btn sm', title: 'Taller lanes', 'aria-label': 'Taller lanes', onclick: () => laneScale(.2) }, '+'),
    h('button', { class: 'btn sm', title: 'Show / hide lanes, add a vocal or guitar lane, reorder', onclick: e => lanesMenu(e.currentTarget) }, 'Lanes ▾'),
    h('button', { class: 'btn sm', title: 'Cycle timeline height', onclick: () => { TL.hi = ((TL.hi || 0) + 1) % 4; $('#center').style.setProperty('--tlh', ['minmax(200px,40%)', 'minmax(200px,58%)', 'minmax(200px,82%)', '120px'][TL.hi]); setTimeout(tlSize, 30); } }, '↕'), h('button', { class: 'btn sm cmax', 'data-m': 'tl', title: 'Give the arrangement the whole centre (Esc to go back)', onclick: () => centerMax('tl') }, '⤢'));
  UI.heads = h('div', { class: 'tl-heads' }); UI.tlc = h('canvas'); UI.tlsp = h('div', { style: { position: 'relative' } }); UI.tlc.style.cssText = 'position:sticky;left:0;top:0;display:block'; UI.tlsp.append(UI.tlc);
  UI.tls = h('div', { class: 'tl-scroll', tabindex: '0', role: 'region', 'aria-label': 'Arrangement timeline (scrolls sideways)' }, UI.tlsp); const body = h('div', { class: 'tl-body' }, UI.heads, UI.tls); el.append(bar, body, dropRowMake()); UI.tlbody = body; body.style.setProperty('--hw', LN.hw + 'px');
  const hwh = h('div', { class: 'tl-hw', title: 'Drag to widen the track headers · double-click to reset' }); body.append(hwh);
  hwh.addEventListener('pointerdown', e => { e.preventDefault(); hwh.setPointerCapture(e.pointerId); const x0 = e.clientX, w0 = LN.hw; const mv = ev => { LN.hw = clamp(w0 + ev.clientX - x0, 120, 360); body.style.setProperty('--hw', LN.hw + 'px'); tlSize(); }; const up = () => { hwh.removeEventListener('pointermove', mv); hwh.removeEventListener('pointerup', up); saveLn(); renderHeads(); }; hwh.addEventListener('pointermove', mv); hwh.addEventListener('pointerup', up); });
  hwh.addEventListener('dblclick', () => { LN.hw = 216; body.style.setProperty('--hw', '216px'); saveLn(); renderHeads(); tlSize(); });
  UI.tls.addEventListener('scroll', () => { UI.heads.scrollTop = UI.tls.scrollTop; TL.dirty = true; });
  UI.tlc.addEventListener('pointerdown', tlDown); UI.tlc.addEventListener('pointermove', tlMove); UI.tlc.addEventListener('pointerup', tlUp); UI.tlc.addEventListener('pointercancel', tlUp); UI.tlc.addEventListener('contextmenu', tkContext); UI.tlc.addEventListener('dblclick', e => { const y = e.offsetY + UI.tls.scrollTop; if (y < TL.rh) { T.loopA = 0; T.loopB = null; TL.dirty = true; } });
  new ResizeObserver(() => { tlSize(); }).observe(UI.tls); bus.on('song', () => { tlSize(); renderHeads(); }); bus.on('takes', () => { renderHeads(); tlSize(); }); renderHeads(); tlSize();
}
function tlSize() {
  const sc = UI.tls; if (!sc) return; const vw = sc.clientWidth || 600, vh = sc.clientHeight || 200, bars = totalBars(), W = Math.max(vw, bars * TL.bw + 120), H = tlLayout().end;
  UI.tlsp.style.width = W + 'px'; UI.tlsp.style.height = Math.max(H, vh) + 'px'; const dpr = window.devicePixelRatio || 1; const cw = Math.floor(vw * dpr), ch = Math.floor(vh * dpr);
  if (UI.tlc.width !== cw || UI.tlc.height !== ch) { UI.tlc.width = cw; UI.tlc.height = ch; UI.tlc.style.width = vw + 'px'; UI.tlc.style.height = vh + 'px'; } TL.dirty = true;
}
function dlTake(tk) { tkDownload(tkLead(tk)); }
function tlPoint(e) { return { x: e.offsetX + UI.tls.scrollLeft, y: e.offsetY + UI.tls.scrollTop }; }
function tlDown(e) {
  const { x, y } = tlPoint(e), sp = spb(), sw = TL.bw / sp, bs = 16 / S.ts[1], bars = totalBars();
  if (y < TL.rh) {
    const slot = Math.round(x / sw / bs) * bs; if (e.shiftKey) { TL.drag = { a: clamp(Math.round(x / TL.bw) * sp, 0, bars * sp) }; UI.tlc.setPointerCapture(e.pointerId); } else seek(clamp(slot, 0, bars * sp - 1)); return;
  }
  const bi = Math.floor(x / TL.bw); if (bi < 0 || bi >= bars) return; const fb = flatBars()[bi];
  if (y < TL.rh + TL.sh) { SEL.sec = fb.si; SEL.bar = 0; TL.dirty = true; dockGo('tab'); bus.emit('sel'); return; }
  const lo = laneAt(y), lane = lo && lo.l; SEL.sec = fb.si; SEL.bar = fb.bi; if (lane && lane.type === 'take' && e.shiftKey && tkrDown(e, lo, x)) return; if (TKR.on) tkrClear();
  if (lane && lane.type === 'take' && tkDown(e, lo, x, y)) { TL.dirty = true; return; } tkSelect(null);
  if (lane && lane.type === 'tab') { TE.sec = fb.si; TE.bi = fb.bi; dockGo('tab'); renderTab(); } else if (lane && lane.type === 'chords') { dockGo('tab'); bus.emit('sel'); }
  TL.dirty = true;
}
function tlMove(e) { if (TKR.drag) { tkrMove(e); return; } if (TL.clip) { tkMove(e); return; } if (!TL.drag) { tkHover(e); return; } const { x } = tlPoint(e), sp = spb(), b = clamp(Math.round(x / TL.bw) * sp, 0, totalBars() * sp); T.loopA = Math.min(TL.drag.a, b); T.loopB = Math.max(TL.drag.a, b); if (T.loopB === T.loopA) T.loopB = null; TL.dirty = true; }
function tlUp() { if (TKR.drag) { tkrUp(); return; } if (TL.clip) { tkUp(); return; } if (TL.drag) { TL.drag = null; if (T.loopB != null) { T.loop = true; syncTransport(); } } }
function tlCache() {
  if (TL.cache) return TL.cache; const sp = spb(), n = totalBars(), bass = []; T.bars = null;
  for (let bi = 0; bi < n; bi++) for (let sib = 0; sib < sp; sib++) { const cd = chordAt(bi, sib); if (!cd || !cd.sym || !S.band.bassOn) continue; const e = bassEvent(S.band.bassStyle, cd.sym, cd.rel, cd.len, cd.next); if (e) bass.push({ s: bi * sp + sib, m: e.m, len: e.len }); }
  return TL.cache = { bass };
}
function drawTL() {
  const cv = UI.tlc, sc = UI.tls; if (!cv || !sc) return; const dpr = window.devicePixelRatio || 1, g = cv.getContext('2d'), C = TL.col, vw = cv.width / dpr, vh = cv.height / dpr;
  const sp = spb(), sw = TL.bw / sp, bs = 16 / S.ts[1], bars = totalBars(), ox = sc.scrollLeft, oy = sc.scrollTop, LY = tlLayout(), top = LY.top, end = LY.end, fb = flatBars();
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, vw, vh); g.fillStyle = C.bg; g.fillRect(0, 0, vw, vh); g.translate(-ox, -oy);
  const mono = '700 10px ui-monospace,Menlo,Consolas,monospace', sans = '700 11px system-ui,-apple-system,Segoe UI,sans-serif'; g.textBaseline = 'middle';
  const b0 = Math.max(0, Math.floor(ox / TL.bw) - 1), b1 = Math.min(bars - 1, Math.ceil((ox + vw) / TL.bw) + 1), V = { ox, vw, sw, sp, b0, b1, fb, C, sans, LY };
  laneBg(g, V);
  // ruler + bar grid
  g.fillStyle = C.bg2; g.fillRect(ox, 0, vw, TL.rh); g.fillStyle = C.line2; g.fillRect(ox, TL.rh - 1, vw, 1);
  fb.forEach(f => {
    if (f.idx < b0 || f.idx > b1) return; const x = f.idx * TL.bw;
    g.strokeStyle = C.line2; g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, end); g.stroke(); g.fillStyle = C.muted; g.font = mono; g.fillText(String(f.idx + 1), x + 4, TL.rh / 2);
    for (let b = 1; b * bs < sp; b++) { const xx = x + b * bs * sw; g.strokeStyle = C.grid; g.beginPath(); g.moveTo(xx + .5, TL.rh); g.lineTo(xx + .5, end); g.stroke(); g.fillStyle = C.line2; g.fillRect(xx, TL.rh - 5, 1, 5); }
  });
  // section strip
  S.sections.forEach((s, si) => {
    const start = S.sections.slice(0, si).reduce((a, q) => a + q.bars.length, 0), x = start * TL.bw, w = s.bars.length * TL.bw; if (x + w < ox || x > ox + vw) return;
    const col = C.cv[si % 5]; g.fillStyle = col; g.globalAlpha = SEL.sec === si ? .95 : .55; g.fillRect(x + 1, TL.rh + 1, w - 2, TL.sh - 2); g.globalAlpha = 1; g.fillStyle = '#fff'; g.font = sans; g.save(); g.beginPath(); g.rect(x + 1, TL.rh, w - 2, TL.sh); g.clip(); g.fillText(s.name, x + 6, TL.rh + TL.sh / 2 + .5); g.restore();
  });
  // lanes content (23-lanes.js)
  drawLanes(g, V);
  // loop region
  if (T.loopB != null) { const x = T.loopA * sw, w = (T.loopB - T.loopA) * sw; g.fillStyle = C.accent; g.globalAlpha = .13; g.fillRect(x, 0, w, end); g.globalAlpha = .9; g.fillRect(x, TL.rh - 4, w, 3); g.globalAlpha = 1; }
  // playhead
  const ph = playheadSlot(), px = ph * sw; g.strokeStyle = C.accent2; g.lineWidth = 2; g.beginPath(); g.moveTo(px, 0); g.lineTo(px, end); g.stroke(); g.lineWidth = 1; g.fillStyle = C.accent2; g.beginPath(); g.moveTo(px - 5, 0); g.lineTo(px + 5, 0); g.lineTo(px, 8); g.fill();
  if (T.playing && TL.follow && (px < ox + 30 || px > ox + vw - 80)) { sc.scrollLeft = Math.max(0, px - 60); }
  UI.tlinfo.textContent = bars + ' bars · ' + fmtTime(bars * spb() * slotDur()) + (T.loopB != null ? ' · loop ' + (T.loopA / sp + 1) + '–' + (T.loopB / sp) : '');
}

/* ============================================================
   TAB EDITOR
   ============================================================ */
const TE = { sec: 0, bi: 0, slot: 0, st: 5, buf: '', t: 0, clip: null };
const FILLS = ['Fingerstyle pop', 'Arpeggio ↑↓ 8ths', 'Travis pick', 'Block strum', 'Power chug 8ths', 'Root pulse'];
function buildTabPane() {
  const p = PANES.tab;
  UI.teSec = h('select', { class: 'in', style: { width: '170px', fontFamily: 'var(--sans)' }, onchange: e => { TE.sec = +e.target.value; TE.bi = 0; renderTab(); } });
  UI.teFill = h('select', { class: 'in', style: { width: '160px', fontFamily: 'var(--sans)' } }, FILLS.map(f => h('option', {}, f)));
  const T_ = (k, lab, t) => h('button', { class: 'btn sm tech', title: t, onclick: () => setTech(k) }, lab);
  UI.capBtn = h('button', { class: 'btn sm', title: 'Quantize what you play into the tab (audio pitch + onset, assisted by the camera if active). Start playback first.', onclick: e => { CAP.on = !CAP.on; e.target.classList.toggle('on', CAP.on); e.target.textContent = CAP.on ? '● Capturing…' : '○ Capture from playing'; if (CAP.on) toast('Capture ON: play along while the transport runs — notes are quantized to 16ths'); } }, '○ Capture from playing');
  p.append(h('div', { class: 'row', style: { marginBottom: '8px', gap: '6px' } }, UI.teSec,
    h('button', { class: 'btn sm', onclick: () => { const sec = S.sections[TE.sec]; if (sec) { sec.bars.push(newBar(sec.bars[sec.bars.length - 1] ? sec.bars[sec.bars.length - 1].chord : '')); commit(); } } }, '＋ Bar'), h('button', { class: 'btn sm', onclick: () => { const sec = S.sections[TE.sec]; if (sec && sec.bars.length > 1) { sec.bars.pop(); TE.bi = Math.min(TE.bi, sec.bars.length - 1); commit(); } } }, '－ Bar'),
    h('span', { class: 'muted small tech' }, 'Technique:'), T_('h', 'h', 'Hammer-on to next note'), T_('p', 'p', 'Pull-off to next note'), T_('/', '/', 'Slide up'), T_('\\', '\\', 'Slide down'), T_('b', 'b', 'Bend (whole step)'), T_('~', '~', 'Vibrato'), T_('x', 'x', 'Dead / muted note'), T_('<>', '<n>', 'Natural harmonic'),
    h('span', { class: 'grow' }), UI.teFill, h('button', { class: 'btn sm', onclick: () => fillBar(false) }, 'Fill bar'), h('button', { class: 'btn sm', onclick: () => fillBar(true) }, 'Fill section'),
    h('button', { class: 'btn sm', onclick: () => { const b = curBar(); if (b) TE.clip = JSON.stringify(b.tab); toast('Bar copied'); } }, 'Copy'), h('button', { class: 'btn sm', onclick: () => { const b = curBar(); if (b && TE.clip) { b.tab = JSON.parse(TE.clip); commit(); } } }, 'Paste'), h('button', { class: 'btn sm bad', onclick: () => { const b = curBar(); if (b) { b.tab = []; commit(); } } }, 'Clear bar'), UI.capBtn),
    h('div', { class: 'tiny muted', style: { marginBottom: '8px' } }, 'Click a cell and type a fret (0–24) · arrows move · Del clears · Space plays from this bar · click a chord name to change it'),
    UI.tabwrap = h('div', { class: 'tabwrap' }));
  bus.on('song', e => { if (paneVisible('tab') || e) renderTab(true); }); bus.on('dock', id => { if (id === 'tab') renderTab(); });
}
const curSec = () => S.sections[TE.sec], curBar = () => (curSec() || { bars: [] }).bars[TE.bi];
function renderTab(keepFocus) {
  if (!UI.tabwrap) return; const ae = document.activeElement, had = !ae || ae === document.body || (ae.classList && ae.classList.contains('tcell')); if (TE.sec >= S.sections.length) TE.sec = Math.max(0, S.sections.length - 1);
  const sec = curSec(), w = UI.tabwrap; w.innerHTML = ''; UI.teSec.innerHTML = ''; S.sections.forEach((s, i) => UI.teSec.append(h('option', { value: i, selected: i === TE.sec }, s.name)));
  if (!sec) { w.append(h('div', { class: 'muted' }, 'No sections yet — add one in the Song panel.')); return; }
  const sp = spb(), bs = 16 / S.ts[1], labels = stringLabels(); TE.bi = clamp(TE.bi, 0, sec.bars.length - 1);
  sec.bars.forEach((bar, bi) => {
    const grid = h('div', { class: 'tgrid', style: { gridTemplateColumns: '18px repeat(' + sp + ',var(--tcw,22px))' } }), cs = barChords(bar);
    grid.append(h('span'), ...Array.from({ length: sp }, (_, s) => h('div', { class: 'tbeat', style: { display: 'block', width: 'var(--tcw,22px)', textAlign: 'center', height: '11px', font: '600 8.5px var(--mono)', color: 'var(--muted)' } }, s % bs === 0 ? String(s / bs + 1) : (bs >= 4 && s % (bs / 2) === 0 ? '&' : ''))));
    for (let r = 0; r < 6; r++) {
      const st = 5 - r; grid.append(h('div', { style: { font: '700 10px var(--mono)', color: 'var(--muted)', alignSelf: 'center', textAlign: 'center' } }, labels[r]));
      for (let s = 0; s < sp; s++) {
        const n = bar.tab.find(o => o.s === s && o.st === st), sel = TE.bi === bi && TE.slot === s && TE.st === st;
        const c = h('div', { class: 'tcell' + (s === 0 ? ' b0' : s % bs === 0 ? ' b4' : '') + (sel ? ' sel' : ''), tabindex: sel ? 0 : -1, 'data-b': bi, 'data-s': s, 'data-st': st, onpointerdown: () => { TE.bi = bi; TE.slot = s; TE.st = st; markSel(); } }, n ? h('span', { class: 'n' }, fretText(n)) : null, n && n.t && n.t !== '<>' && n.t !== 'b' ? h('span', { class: 't' }, n.t) : null);
        c.addEventListener('keydown', e => tabKey(e)); grid.append(c);
      }
    }
    const chEl = h('div', { class: 'ch', title: 'Click to edit the chord for this bar', onclick: () => { const v = prompt('Chord(s) for bar ' + (bi + 1) + ' (space-separated):', bar.chord); if (v != null) { bar.chord = v.trim(); commit(); } } }, cs.length ? cs.join('   ') : '·');
    w.append(h('div', { class: 'tbar' }, chEl, h('span', { class: 'bn' }, 'bar ' + (bi + 1)), grid));
  });
  if (keepFocus && had && paneVisible('tab')) { const c = $('.tcell.sel', w); if (c) c.focus(); }
}
function markSel() {
  $$('#pane-tab .tcell.sel').forEach(c => { c.classList.remove('sel'); c.tabIndex = -1; }); const c = $(`#pane-tab .tcell[data-b="${TE.bi}"][data-s="${TE.slot}"][data-st="${TE.st}"]`); if (c) { c.classList.add('sel'); c.tabIndex = 0; c.focus(); }
}
function setNote(f) {
  const bar = curBar(); if (!bar) return; let n = bar.tab.find(o => o.s === TE.slot && o.st === TE.st);
  if (f == null) { if (n) bar.tab.splice(bar.tab.indexOf(n), 1); } else if (n) { n.f = f; if (n.t === 'b') n.bend = typeof f === 'number' ? f + 2 : undefined; } else { n = { s: TE.slot, st: TE.st, f, t: '' }; bar.tab.push(n); }
  if (n && f != null && E.ready && !T.playing) playTabNote(bar, n, E.ctx.currentTime + .02, slotDur()); commit(false); renderTab(true);
}
function setTech(k) {
  const bar = curBar(); if (!bar) return; const n = bar.tab.find(o => o.s === TE.slot && o.st === TE.st); if (!n) return toast('Select a note first', 'warn');
  if (k === 'x') { n.f = n.f === 'x' ? 0 : 'x'; n.t = ''; } else { n.t = n.t === k ? '' : k; if (k === 'b') n.bend = n.t === 'b' ? (typeof n.f === 'number' ? n.f + 2 : undefined) : undefined; }
  commit(true); renderTab(true); const c = $('#pane-tab .tcell.sel'); if (c) c.focus();
}
function tabKey(e) {
  const sec = curSec(); if (!sec) return; const sp = spb(); let handled = true;
  if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const now = performance.now(); let v = (now - TE.t < 800 && TE.buf) ? TE.buf + e.key : e.key; if (+v > 24) v = e.key; TE.buf = v; TE.t = now; setNote(+v);
  } else switch (e.key) {
    case 'ArrowRight': TE.slot++; if (TE.slot >= sp) { if (TE.bi < sec.bars.length - 1) { TE.bi++; TE.slot = 0; } else TE.slot = sp - 1; } markSel(); break;
    case 'ArrowLeft': TE.slot--; if (TE.slot < 0) { if (TE.bi > 0) { TE.bi--; TE.slot = sp - 1; } else TE.slot = 0; } markSel(); break;
    case 'ArrowUp': if (e.altKey) { transpose(1); } else { TE.st = Math.min(5, TE.st + 1); markSel(); } break;
    case 'ArrowDown': if (e.altKey) { transpose(-1); } else { TE.st = Math.max(0, TE.st - 1); markSel(); } break;
    case 'Delete': case 'Backspace': setNote(null); break;
    case 'Enter': case ' ': { T.cursor = (sec.bars.length ? S.sections.slice(0, TE.sec).reduce((a, q) => a + q.bars.length, 0) + TE.bi : 0) * sp; T.playing ? stopPlay(true) : play(); break; }
    case 'h': case 'p': case '/': case '\\': case 'b': case '~': case 'x': setTech(e.key); break; case '<': setTech('<>'); break;
    default: handled = false;
  }
  if (handled) { e.preventDefault(); e.stopPropagation(); }
}
function transpose(d) { const bar = curBar(); const n = bar && bar.tab.find(o => o.s === TE.slot && o.st === TE.st); if (n && typeof n.f === 'number') { n.f = clamp(n.f + d, 0, 24); commit(false); renderTab(true); if (E.ready && !T.playing) playTabNote(bar, n, E.ctx.currentTime + .02, slotDur()); } }
function fillBar(whole) {
  const style = UI.teFill.value, sec = curSec(); if (!sec) return; const list = whole ? sec.bars : [curBar()]; let miss = 0;
  list.forEach(bar => { const cs = barChords(bar); if (!cs.length) { miss++; return; } const ok = fillTab(bar, style, cs[0]); if (!ok) { miss++; return; } if (cs[1]) { const half = spb() >> 1, tmp = newBar(); if (fillTab(tmp, style, cs[1])) { bar.tab = bar.tab.filter(n => n.s < half).concat(tmp.tab.filter(n => n.s >= half)); } } });
  if (miss) toast(miss + ' bar(s) had no playable chord', 'warn'); commit(); renderTab();
}
