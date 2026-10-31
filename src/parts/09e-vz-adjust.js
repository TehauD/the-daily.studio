/* ============================================================
   Part 09e · SPEED, SIZE AND ZOOM FOR THE VISUALS
   Three settings for every look, wherever the visuals are drawn (the Visuals tab, the Stage, Perform's backdrop, the
   Audience view): Speed (how fast things move: ¼× to 3×), Size (how big the tiles are in the looks made of tiles, Hex
   Resonance and the pulse grid: fewer and larger, or more and smaller) and Zoom (push in on the middle of any look). The camera,
   the chord, the words and the small neck are not changed. Remembered in this browser.
   ============================================================ */
const VZA = [['vzSpeed', 'Speed', .25, 3, 'How fast the visuals move'], ['vzSize', 'Size', .5, 2.5, 'How big the hexagons are in Hex Resonance and the pulse grid: bigger means fewer, larger tiles'], ['vzZoom', 'Zoom', 1, 3, 'Push in on the middle of the picture']];
const vzSet = k => { const d = VZA.find(x => x[0] === k), v = +CFG[k]; return d && isFinite(v) && v > 0 ? clamp(v, d[2], d[3]) : 1; };
const vzSpeed = () => vzSet('vzSpeed'), vzSize = () => vzSet('vzSize'), vzZoom = () => vzSet('vzZoom');
const vzAdjusted = () => VZA.some(([k]) => vzSet(k) !== 1);
/** the button that opens the three sliders; cls: the bar's button class */
function vzAdjustBtn(cls) {
  const b = h('button', { class: (cls || 'btn sm') + (vzAdjusted() ? ' on' : ''), 'data-vza': '1', title: 'Speed, size and zoom of the visuals', onclick: e => vzAdjustOpen(e.currentTarget) }, '🎚 Speed · size · zoom');
  return b;
}
function vzAdjustOpen(anchor) {
  let saveT = 0; const rows = {}, mark = () => $$('[data-vza]').forEach(x => x.classList.toggle('on', vzAdjusted()));
  const box = h('div', { class: 'vza', style: { display: 'grid', gap: '8px', minWidth: '250px' } }, h('h5', {}, 'Visuals: speed, size, zoom'));
  VZA.forEach(([k, label, lo, hi, tip]) => {
    const val = h('b', { class: 'mono tiny', style: { minWidth: '44px', textAlign: 'right' } }, vzSet(k).toFixed(2) + '×');
    const r = h('input', { type: 'range', id: k + 'In', min: lo, max: hi, step: .05, value: vzSet(k), 'aria-label': label, title: tip, style: { flex: 1 },
      oninput: e => { CFG[k] = +e.target.value; val.textContent = vzSet(k).toFixed(2) + '×'; VZ.spec = null; clearTimeout(saveT); saveT = setTimeout(saveCfg, 300); mark(); },
      ondblclick: e => { CFG[k] = 1; e.target.value = 1; val.textContent = '1.00×'; saveCfg(); mark(); } });
    rows[k] = { r, val }; box.append(h('label', { class: 'lrow', style: { gap: '8px', alignItems: 'center' }, title: tip }, h('span', { style: { width: '44px' } }, label), r, val));
  });
  box.append(h('div', { class: 'row', style: { gap: '8px', alignItems: 'center' } },
    h('button', { class: 'btn sm', id: 'vzaReset', onclick: () => { VZA.forEach(([k]) => { CFG[k] = 1; rows[k].r.value = 1; rows[k].val.textContent = '1.00×'; }); VZ.spec = null; saveCfg(); mark(); } }, 'Reset'),
    h('span', { class: 'tiny muted' }, 'Double-click a slider to reset it.')),
    h('div', { class: 'tiny muted', style: { lineHeight: 1.45 } }, 'Speed and Zoom work on every look; Size sets the hexagons of Hex Resonance and the pulse grid. On the Visuals tab, the Stage and in Perform. The camera, the chord, the words and the small neck stay as they are.'));
  popover(anchor, box);
}
