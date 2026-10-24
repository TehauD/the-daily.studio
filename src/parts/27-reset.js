/* ============================================================
   Part 27 · RESET — choose exactly what to erase, and it really is erased
   The old "Reset everything" cleared storage and reloaded, but the page's save-on-exit handler then wrote the song and the
   settings straight back. Now a reset first LOCKS all writes (store.locked), tells other open tabs to do the same,
   clears the chosen parts (settings, layout, presets, history, songs + recordings, offline cache), and reloads.
   ============================================================ */
const RESET_ITEMS = [
  ['layout', 'Layout & arrangement lanes', 'Panel places, sidebar widths, lane order/colours/heights, view (Canvas / Song / Studio).'],
  ['settings', 'Settings & calibration', 'Appearance, audio and MIDI settings, input choices, camera calibration, tour progress.'],
  ['presets', 'My presets & saved layouts', 'Rig presets and layouts you saved.'],
  ['notes', 'Notebook & version history', 'Your lab notebook and the automatic song snapshots.'],
  ['songs', 'All songs & recordings', 'Every song in My songs, its takes and backing tracks. Back them up first if you want to keep any.'],
  ['cache', 'Offline copy of the app', 'The saved copy that lets the app open offline; it downloads again next visit.']
];
const rstHome = () => location.pathname + (/[?&]debug\b/.test(location.search) ? '?debug' : '');   // a clean address: no leftover parameters
let rstChan = null; try { rstChan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('the-daily-songs') : null; } catch (e) { }
if (rstChan) rstChan.onmessage = ev => { if (ev.data && ev.data.reset) { store.locked = true; clearTimeout(PRJ.timer); setTimeout(() => location.replace(rstHome()), 400); } };

async function resetRun(sel) {
  store.locked = true; clearTimeout(PRJ.timer); try { if (rstChan) rstChan.postMessage({ reset: true }); } catch (e) { }
  try { if (T.playing) stopPlay(true); } catch (e) { }
  const ls = localStorage, fw = () => Object.keys(ls).filter(k => k.startsWith('fw.')), all = sel.size === RESET_ITEMS.length;
  const cfgRaw = () => { try { return JSON.parse(ls.getItem('fw.cfg') || '{}') || {}; } catch (e) { return {}; } };
  try {
    if (all) { fw().forEach(k => ls.removeItem(k)); try { Object.keys(sessionStorage).filter(k => k.startsWith('fw.')).forEach(k => sessionStorage.removeItem(k)); } catch (e) { } }
    else {
      const c = cfgRaw();
      if (sel.has('settings')) { const keep = {}; if (!sel.has('layout')) { if (c.layout) keep.layout = c.layout; if (c.lanes) keep.lanes = c.lanes; if (c.zoom) keep.zoom = c.zoom; } ls.setItem('fw.cfg', JSON.stringify(keep)); ls.removeItem('fw.cal'); ls.removeItem('fw.tour'); ls.removeItem('fw.toured'); }
      else if (sel.has('layout')) { delete c.layout; delete c.lanes; delete c.zoom; ls.setItem('fw.cfg', JSON.stringify(c)); }
      if (sel.has('presets')) ['presets', 'layouts'].forEach(k => ls.removeItem('fw.' + k));
      if (sel.has('notes')) ['notebook', 'vhist'].forEach(k => ls.removeItem('fw.' + k));
      if (sel.has('songs')) ['song', 'songAt', 'cur', 'started'].forEach(k => ls.removeItem('fw.' + k));
    }
  } catch (e) { console.warn('reset: storage', e); }
  if (sel.has('songs')) await new Promise(res => { try { if (PRJ.db) PRJ.db.close(); } catch (e) { } let r; try { r = indexedDB.deleteDatabase(PDB_NAME); } catch (e) { return res(); } r.onsuccess = r.onerror = r.onblocked = () => res(); setTimeout(res, 1800); });
  if (sel.has('cache')) {
    try { if (window.caches) for (const k of await caches.keys()) if (/^(daily-songs-|fretwork-)/.test(k)) await caches.delete(k); } catch (e) { }
    try { if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch (e) { }
  }
  location.replace(rstHome());
}

async function resetSizes() {
  const o = { songs: PRJ.list.reduce((a, r) => a + (r.size || 0), 0), n: PRJ.list.length };
  try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); o.total = e.usage || 0; o.quota = e.quota || 0; } } catch (e) { } return o;
}
function resetOpen(preset) {
  const sel = new Set(preset || []), body = h('div', { class: 'rs-wrap' }); let armed = 0, sizes = { songs: 0, n: 0 };
  const quick = (label, items, tip) => h('button', { class: 'btn sm', title: tip, onclick: () => { sel.clear(); items.forEach(i => sel.add(i)); armed = 0; draw(); } }, label);
  function draw() {
    body.innerHTML = '';
    body.append(h('p', { class: 'small muted', style: { margin: '0 0 8px' } }, 'Choose what to erase. This only clears this browser; nothing is sent anywhere. The app restarts when it is done.'),
      h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap', margin: '0 0 8px' } }, h('span', { class: 'tiny muted', style: { fontWeight: 800 } }, 'QUICK'), quick('Layout only', ['layout'], 'Put the panels back where they started'), quick('Settings & layout', ['layout', 'settings'], 'Back to a fresh look and default audio settings; songs kept'), quick('Everything', RESET_ITEMS.map(i => i[0]), 'A factory reset: like opening the app for the first time')));
    const list = h('div', { class: 'rs-list' });
    RESET_ITEMS.forEach(([k, name, desc]) => {
      const on = sel.has(k), extra = k === 'songs' ? ' · ' + sizes.n + (sizes.n === 1 ? ' song' : ' songs') + ', ' + projBytes(sizes.songs) : '';
      list.append(h('label', { class: 'rs-it' + (on ? ' on' : '') + (k === 'songs' ? ' danger' : '') }, h('input', { type: 'checkbox', checked: on, onchange: e => { e.target.checked ? sel.add(k) : sel.delete(k); armed = 0; draw(); } }), h('span', {}, h('b', {}, name + extra), h('i', {}, desc))));
    });
    body.append(list);
    const foot = h('div', { class: 'rs-foot' });
    if (sel.has('songs') && sizes.n) foot.append(h('button', { class: 'btn sm', title: 'One .zip with every song in its own folder', onclick: async e => { e.target.disabled = true; await projExportAll(); e.target.disabled = false; } }, '⤓ Back up all songs first'));
    const go = h('button', { class: 'btn ' + (armed ? 'bad' : 'primary'), disabled: !sel.size, onclick: () => { if (!armed) { armed = 1; draw(); return; } go.disabled = true; go.textContent = 'Erasing…'; resetRun(sel); } }, !sel.size ? 'Nothing selected' : armed ? 'Click again to erase ' + sel.size + (sel.size === 1 ? ' item' : ' items') + ' and restart' : 'Reset ' + sel.size + (sel.size === 1 ? ' item…' : ' items…'));
    foot.append(h('span', { class: 'grow' }), h('button', { class: 'btn', onclick: () => $('#reset').close() }, 'Cancel'), go); body.append(foot);
  }
  pdlg('reset', 'RESET', body); draw(); resetSizes().then(s => { sizes = s; if (document.getElementById('reset')) draw(); });
}
