/* ============================================================
   Part 77 · STREAM WINDOW (2.29) — the words and the chord, alone in a window, for OBS or any streaming app
   A pop-out window with nothing in it but the line being sung, the next one, and the chord, in large type on one solid colour:
   in OBS (or Streamlabs, or any app that captures a window) add a Window Capture of it and a Chroma Key filter on that colour,
   and the words float over your camera. Green, blue and magenta are made for keying; black works with a Luma Key or a Blend mode.
   The stage visuals already have their own pop-out (Visuals ▸ Pop-out). The window runs its own timer, so it keeps up even when
   the studio's window is behind other windows. Nothing is sent anywhere: the streaming app captures the window on this computer.
   ============================================================ */
CFG.stream = Object.assign({ bg: 'green', size: 1, chord: true, next: true, at: 'bottom' }, CFG.stream && typeof CFG.stream === 'object' ? CFG.stream : {});
const STRM_BG = { green: ['#00b140', 'Green, for a Chroma Key'], blue: ['#0047bb', 'Blue, for a Chroma Key'], magenta: ['#ff00ff', 'Magenta, for a Chroma Key'], black: ['#000000', 'Black, for a Luma Key'] };
const STRM = { w: null, tm: 0, last: '' };
/** what the window shows now: the sung line, the next line, and the chord (the same reading Perform uses) */
function streamInfo() { const i = perfInfo(), cur = i.idx >= 0 ? i.lines[i.idx] : '', nx = i.idx >= 0 ? i.lines[i.idx + 1] || '' : i.lines[0] || ''; return { cur: cur || '', next: nx, sym: i.sym || '', title: S.title || '' }; }
function streamStyle(w) {
  const c = CFG.stream, bg = (STRM_BG[c.bg] || STRM_BG.green)[0], k = clamp(+c.size || 1, .6, 1.8);
  w.document.body.style.cssText = 'margin:0;height:100vh;overflow:hidden;background:' + bg + ';display:flex;flex-direction:column;justify-content:' + (c.at === 'center' ? 'center' : 'flex-end') + ';align-items:center;gap:1.2vh;padding:0 4vw ' + (c.at === 'center' ? '0' : '7vh') + ';box-sizing:border-box;font-family:Montserrat,Inter,"Segoe UI",system-ui,sans-serif;color:#fff;text-align:center';
  const sh = 'text-shadow:0 0 .12em #000,0 .06em .2em #000;-webkit-text-stroke:.02em rgba(0,0,0,.6)', F = 'Montserrat,Inter,"Segoe UI",system-ui,sans-serif';
  const set = (id, css) => { const e = w.document.getElementById(id); if (e) e.style.cssText = css; };
  set('sc', 'font:800 ' + (5.2 * k) + 'vh/1 ' + F + ';color:#ffd75e;' + sh + ';display:' + (c.chord ? '' : 'none'));
  set('sl', 'font:800 ' + (7.4 * k) + 'vh/1.12 ' + F + ';max-width:92vw;' + sh);
  set('sn', 'font:700 ' + (4 * k) + 'vh/1.2 ' + F + ';opacity:.85;max-width:92vw;' + sh + ';display:' + (c.next ? '' : 'none'));
}
function streamTick() {
  const w = STRM.w; if (!w || w.closed) { STRM.w = null; return; } const i = streamInfo(), key = i.cur + '\u0001' + i.next + '\u0001' + i.sym;
  if (key === STRM.last) return; STRM.last = key; const d = w.document;
  d.getElementById('sc').textContent = i.sym; d.getElementById('sl').textContent = i.cur || (T.playing ? '' : i.title); d.getElementById('sn').textContent = i.next;
}
/** open (or bring forward) the stream window */
function streamOpen() {
  if (STRM.w && !STRM.w.closed) { STRM.w.focus(); return STRM.w; }
  let w; try { w = window.open('', 'fw_stream', 'width=1280,height=720'); } catch (e) { w = null; }
  if (!w) { toast('The browser blocked the window. Allow pop-ups for this page, then try again.', 'warn'); return null; }
  const d = w.document; d.title = BRAND.short + ' · words for streaming'; d.body.innerHTML = '';
  ['sc', 'sl', 'sn'].forEach(id => { const e = d.createElement('div'); e.id = id; d.body.append(e); });
  streamStyle(w); STRM.w = w; STRM.last = ''; streamTick();
  clearInterval(STRM.tm); STRM.tm = w.setInterval(streamTick, 80);      /* the window's own timer: it keeps time while the studio's window is covered */
  w.addEventListener('pagehide', () => { STRM.w = null; });
  toast('Stream window open. In OBS: Window Capture of it, then a ' + (CFG.stream.bg === 'black' ? 'Luma Key' : 'Chroma Key (' + CFG.stream.bg + ')') + ' filter.', 'ok');
  return w;
}
/** the stream window's settings: where they appear (Perform's ⋯ and Creator Studio) */
function streamPanel() {
  const c = CFG.stream, upd = () => { saveCfg(); if (STRM.w && !STRM.w.closed) { streamStyle(STRM.w); STRM.last = ''; streamTick(); } };
  return h('div', { class: 'strm' },
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' } },
      h('label', { class: 'field' }, 'Background', h('select', { class: 'in', id: 'strmBg', onchange: e => { c.bg = e.target.value; upd(); } }, Object.entries(STRM_BG).map(([k, [, t]]) => h('option', { value: k, selected: c.bg === k }, t)))),
      h('label', { class: 'field' }, 'Size', h('input', { type: 'range', min: .6, max: 1.8, step: .1, value: c.size, oninput: e => { c.size = +e.target.value; upd(); } })),
      h('label', { class: 'field' }, 'Where', h('select', { class: 'in', onchange: e => { c.at = e.target.value; upd(); } }, h('option', { value: 'bottom', selected: c.at === 'bottom' }, 'Bottom (over a camera)'), h('option', { value: 'center', selected: c.at === 'center' }, 'Middle'))),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: c.chord, onchange: e => { c.chord = e.target.checked; upd(); } }), 'Chord'),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: c.next, onchange: e => { c.next = e.target.checked; upd(); } }), 'Next line')),
    h('button', { class: 'btn primary', id: 'strmOpen', onclick: () => streamOpen() }, '📺 Open the stream window'),
    h('p', { class: 'tiny muted' }, 'In OBS, Streamlabs or any streaming app: add a Window Capture of that window, then a Chroma Key filter on its colour (or a Luma Key on black). The words then float over your camera. The stage visuals have their own pop-out in Visuals.'));
}
/** a small room for it, from the Creator Studio and Performer tools */
function streamRoom() { return hubOpen('streamwin', { ico: '📺', title: 'Stream window', sub: 'The words and the chord in a window of their own, on a colour your streaming app keys out.', sections: [{ key: 'win', label: 'Stream window', ico: '📺', wide: true, body: () => [streamPanel()] }] }); }
