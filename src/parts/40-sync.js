/* ============================================================
   Part 40 · BACKUP FOLDER (File System Access API, Chromium browsers)
   Pick a folder once (a cloud-drive folder works too) and each song is saved there as a .daily-song.zip after you change it.
   No account, no server: the browser writes the files directly. The folder choice is remembered on this device only.
   ============================================================ */
const SYNC = { dir: null, name: '', busy: false, timer: 0, at: 0, perm: '', err: '' };
const syncSupported = () => typeof window.showDirectoryPicker === 'function';
async function syncPerm(ask) {
  const d = SYNC.dir; if (!d) return SYNC.perm = 'none';
  try { if (d.queryPermission) { let p = await d.queryPermission({ mode: 'readwrite' }); if (p !== 'granted' && ask && d.requestPermission) p = await d.requestPermission({ mode: 'readwrite' }); return SYNC.perm = p; } return SYNC.perm = 'granted'; } catch (e) { return SYNC.perm = 'denied'; }
}
async function syncLoad() {
  if (!CFG.sync || !PRJ.db) return; try { const d = await pdbGet('blobs', 'sync/dir'); if (d) { SYNC.dir = d; SYNC.name = d.name || 'folder'; await syncPerm(false); bus.emit('sync'); } } catch (e) { }
}
async function syncChoose() {
  if (!syncSupported()) return toast('Folder backup needs Chrome or Edge on a computer.', 'warn');
  let d; try { d = await window.showDirectoryPicker({ id: 'daily-backup', mode: 'readwrite' }); } catch (e) { return; }
  SYNC.dir = d; SYNC.name = d.name || 'folder'; CFG.sync = true; saveCfg(); try { await pdbPut('blobs', d, 'sync/dir'); } catch (e) { }
  await syncPerm(true); bus.emit('sync'); if (SYNC.perm === 'granted') syncNow(true);
}
async function syncOff() { SYNC.dir = null; SYNC.name = ''; SYNC.perm = ''; CFG.sync = false; saveCfg(); try { await pdbDel('blobs', 'sync/dir'); } catch (e) { } bus.emit('sync'); toast('Folder backup is off. Files already in the folder stay there.', 'ok'); }
function syncFile(rec, dup) { return slug(rec.title || 'song') + (dup ? '-' + rec.id.slice(-4) : '') + '.daily-song.zip'; }
/** write the current song, or every song when `all` */
async function syncNow(all) {
  if (!SYNC.dir || SYNC.busy || store.locked) return; if (await syncPerm(false) !== 'granted') { bus.emit('sync'); return; }
  SYNC.busy = true; SYNC.err = ''; bus.emit('sync');
  try {
    if (PRJ.cur) await projSave(); const list = all ? PRJ.list.slice() : PRJ.list.filter(r => r.id === PRJ.cur);
    for (const r of list) {
      const dup = PRJ.list.some(o => o.id !== r.id && slug(o.title || 'song') === slug(r.title || 'song')), blob = zipBuild(await projEntries(r.id, ''));
      const fh = await SYNC.dir.getFileHandle(syncFile(r, dup), { create: true }), w = await fh.createWritable(); await w.write(blob); await w.close();
    }
    SYNC.at = Date.now(); CFG.syncAt = SYNC.at; saveCfg(); if (all) toast('Saved ' + list.length + ' song' + (list.length === 1 ? '' : 's') + ' to “' + SYNC.name + '”.', 'ok');
  } catch (e) { SYNC.err = e.message || String(e); console.warn('folder backup', e); if (all) toast('Could not write to the folder: ' + SYNC.err, 'bad'); }
  SYNC.busy = false; bus.emit('sync');
}
/** after a song is saved: write it to the folder at most once a minute */
function syncKick() { if (!SYNC.dir || !CFG.sync) return; if (SYNC.timer) return; SYNC.timer = setTimeout(() => { SYNC.timer = 0; syncNow(false); }, window.__syncDelay != null ? window.__syncDelay : 45000); }
function syncControl() {
  const box = h('div', { class: 'sync-ctl', style: { display: 'grid', gap: '6px' } }), draw = () => {
    box.innerHTML = ''; if (!syncSupported()) { box.append(h('span', { class: 'tiny muted' }, 'Not available in this browser. It works in Chrome and Edge on a computer.')); return; }
    if (!SYNC.dir) { box.append(h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, h('button', { class: 'btn', id: 'syncChoose', onclick: syncChoose }, '📁 Choose a folder…'), h('span', { class: 'tiny muted' }, 'Each song is saved there as a .daily-song.zip after you change it.'))); return; }
    const need = SYNC.perm !== 'granted';
    box.append(h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, h('b', {}, '📁 ' + SYNC.name),
      need ? h('button', { class: 'btn primary', id: 'syncAllow', onclick: async () => { await syncPerm(true); bus.emit('sync'); if (SYNC.perm === 'granted') syncNow(true); } }, 'Allow access again') : h('button', { class: 'btn', id: 'syncNow', onclick: () => syncNow(true) }, 'Save all songs now'),
      h('button', { class: 'btn', id: 'syncChange', onclick: syncChoose }, 'Change…'), h('button', { class: 'btn', id: 'syncOff', onclick: syncOff }, 'Turn off')),
      h('span', { class: 'tiny muted' }, SYNC.busy ? 'Saving…' : SYNC.err ? 'Last try failed: ' + SYNC.err : need ? 'The browser needs your permission again after a restart.' : (CFG.syncAt ? 'Last saved ' + new Date(CFG.syncAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.' : 'Ready.') + ' Renaming a song leaves its old file in the folder.'));
  };
  draw(); bus.on('sync', draw); return box;
}
