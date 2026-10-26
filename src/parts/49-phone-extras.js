/* ============================================================
   Part 49 · Phone and tablet extras
   Things the desktop header carries but a small screen does not: count-in and click, the master level and mastering preset, Auto-balance,
   My songs, Open a file, and the backup. They live in one tap from the More sheet.
   ============================================================ */
/** count-in, click, master and balance in one window */
function mixOpen() {
  const body = h('div', { class: 'mixdlg' });
  const draw = () => {
    body.innerHTML = '';
    body.append(h('h5', {}, 'Master'), mstChip(),
      h('div', { class: 'mst-list', role: 'radiogroup', 'aria-label': 'Mastering preset' }, MST_PRE.map(([id, name, desc]) => { const on = (CFG.mstPre || 'off') === id; return h('button', { class: 'mst-opt' + (on ? ' on' : ''), role: 'radio', 'aria-checked': String(on), onclick: () => { mstSet(id); draw(); } }, h('b', {}, name), h('span', { class: 'tiny muted' }, desc)); })),
      h('button', { class: 'btn', id: 'mixBal', onclick: () => { const d = document.getElementById('mixDlg'); if (d) d.close(); autoBalance(); } }, '⚖ Auto-balance the lanes…'),
      h('h5', {}, 'Click and count-in'),
      h('div', { class: 'lrow' }, h('span', { style: { width: '72px' } }, 'Count-in'), h('div', { class: 'seg', role: 'group', 'aria-label': 'Count-in bars' }, [[0, 'None'], [1, '1 bar'], [2, '2 bars'], [4, '4 bars']].map(([n, t]) => h('button', { class: CFG.countIn === n ? 'on' : '', onclick: () => { CFG.countIn = n; saveCfg(); draw(); } }, t)))),
      h('div', { class: 'lrow' }, h('span', { style: { width: '72px' } }, 'Click level'), h('input', { type: 'range', min: 0, max: 1, step: .05, value: CFG.metroVol == null ? .5 : CFG.metroVol, 'aria-label': 'Click volume', style: { flex: 1 }, oninput: e => { CFG.metroVol = +e.target.value; saveCfg(); } })));
  };
  draw(); return pdlg('mixDlg', 'Master, balance and click', body, {});
}
/** choose files from the device: the same router the drop zone uses */
function filesOpen() {
  const inp = h('input', { type: 'file', multiple: true, accept: 'audio/*,video/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.opus,.aif,.aiff,.txt,.md,.lrc,.mid,.midi,.kar,.zip,.json', style: { display: 'none' }, 'aria-label': 'Choose files to open', onchange: e => { const fl = [...e.target.files]; e.target.value = ''; inp.remove(); if (fl.length) dropFiles(fl); } });
  document.body.append(inp); inp.click(); setTimeout(() => { try { inp.remove(); } catch (e) { } }, 120000);
}
