/* ============================================================
   Part 40 · FOLDER SYNC (File System Access API: Chrome, Edge and other Chromium browsers on a computer)
   Pick a folder once (one inside iCloud Drive, Dropbox, Google Drive or OneDrive is best) and your whole studio is kept in step
   with it: songs, their recordings and backing tracks, settings, rig presets, stage looks and scenes, lesson notes and the notebook.
   Pick the same folder on another computer and it gets the same studio; the cloud drive's own app carries the files between them.
   No account and no server: this page asks the network for nothing, the browser reads and writes the folder directly.
     · the files are a GitHub studio's (part 74: studio.json, settings.json, songs/<id>.json …), in "the-daily.studio" inside the
       folder you pick (or the folder itself, if it already is one). A song here also lists its recordings, and media/<song id>/
       holds them: each recording as a WAV (dry, and the amp print if there is one), each backing track as the file you loaded.
       A recording never changes once it is made, so its file is only ever copied to the side that lacks it.
     · merges are GitHub's (part 74's engine): settings key by key, a song changed in both places keeps both versions, a song
       deleted here is removed there and one deleted elsewhere is kept here. A song whose recordings are still on their way keeps
       them (part 25 never drops them on a save), and they come in when the cloud drive has brought them.
     · when: a few seconds after a change, when the page opens or comes back, and once a minute while it is open (another computer
       may have changed something). Never while playing or recording.
     · tidy: a recording no song uses any more is removed from the folder once nothing has used it for a day, so a cloud drive still
       copying a song from another computer never loses one. Only the app's own files are ever removed.
     · optional: also save each song as a .daily-song.zip in the folder you picked (this part's whole job before 2.22; kept on for
       folders chosen then).
   The folder (a handle the browser keeps) is remembered on this device only; the browser may ask again for access after a restart.
   ============================================================ */
const SYNC = { dir: null, name: '', busy: false, timer: 0, at: 0, perm: '', err: '' };
const FS_UP = !!CFG.sync && !CFG.fsync;      /* a backup folder chosen before 2.22: it keeps its .daily-song.zip copies, and is told what is new */
CFG.fsync = Object.assign({ last: null, lastAt: 0, gone: [], zips: FS_UP, orph: {}, sub: '', told: !FS_UP }, CFG.fsync && typeof CFG.fsync === 'object' ? CFG.fsync : {});
const FS = { root: null, rootOf: null, clashes: 0, due: 0, cache: new Map(), quiet: false, busy: null, again: false, timer: 0, kick0: 0, status: '', bad: false, mediaAt: 0, mediaDue: true, zipAt: 0, zipT: 0 };
const FS_SUB = 'the-daily.studio', FS_MAX = 20e6, FS_DAY = 864e5;
const FS_MEDIA_RE = /^[\w-]{1,48}\.(dry|wet)\.wav$|^[\w-]{1,48}\.cam\.json$|^track-\d{1,12}\.[a-z0-9]{1,8}$/;
const syncSupported = () => typeof window.showDirectoryPicker === 'function';
async function syncPerm(ask) {
  const d = SYNC.dir; if (!d) return SYNC.perm = 'none';
  try { if (d.queryPermission) { let p = await d.queryPermission({ mode: 'readwrite' }); if (p !== 'granted' && ask && d.requestPermission) p = await d.requestPermission({ mode: 'readwrite' }); return SYNC.perm = p; } return SYNC.perm = 'granted'; } catch (e) { return SYNC.perm = 'denied'; }
}
/** the folder as people see it: the one picked, and the studio inside it */
const fsWhere = () => SYNC.name + (CFG.fsync.sub ? ' ▸ ' + CFG.fsync.sub : '');
/** never while playing, recording or looping: a sync can wait for the song to stop */
const fsAudioBusy = () => !!(T.playing || T.rec || REC || (typeof SREC !== 'undefined' && SREC.on) || (typeof LP !== 'undefined' && LP.on));
async function syncLoad() {
  if (!CFG.sync || !PRJ.db) return; try { const d = typeof window.__fsDir === 'function' ? await window.__fsDir() : await pdbGet('blobs', 'sync/dir');      /* (tests hand the folder in: a headless browser cannot read a stored one back) */ if (d) { SYNC.dir = d; SYNC.name = d.name || 'folder'; await syncPerm(false); bus.emit('sync'); if (SYNC.perm === 'granted') setTimeout(() => fsSync('open'), 1200); } } catch (e) { }
}
async function syncChoose() {
  if (!syncSupported()) return toast('Folder sync needs Chrome or Edge on a computer.', 'warn');
  let d; try { d = await window.showDirectoryPicker({ id: 'daily-backup', mode: 'readwrite' }); } catch (e) { return; }
  return fsUse(d);
}
/** start keeping the studio in step with this folder (the picker's answer; tests hand one in directly) */
async function fsUse(d) {
  SYNC.dir = d; SYNC.name = d.name || 'folder'; CFG.sync = true; FS.root = null; CFG.fsync.last = null; CFG.fsync.gone = []; CFG.fsync.orph = {}; CFG.fsync.told = true; FS.mediaDue = true; saveCfg();
  try { await pdbPut('blobs', d, 'sync/dir'); } catch (e) { }
  await syncPerm(true); bus.emit('sync'); if (SYNC.perm !== 'granted') return null;
  const rep = await fsSync('connect'); if (!rep) return null; const n = rep.took.filter(p => /^songs\//.test(p)).length;
  toast('Your studio is kept in “' + fsWhere() + '”.' + (n ? ' ' + n + ' song' + (n === 1 ? '' : 's') + ' came in from it.' : '') + ' Choose the same folder on another computer to have the same studio there.', 'ok');
  return rep;
}
async function syncOff() { clearTimeout(FS.timer); FS.timer = 0; SYNC.dir = null; SYNC.name = ''; SYNC.perm = ''; FS.root = null; CFG.sync = false; CFG.fsync.last = null; CFG.fsync.sub = ''; saveCfg(); try { await pdbDel('blobs', 'sync/dir'); } catch (e) { } bus.emit('sync'); toast('Folder sync is off. Everything already in the folder stays there.', 'ok'); }

/* ---------- the folder, by path ---------- */
const fsHas = async (d, n) => { try { await d.getFileHandle(n); return true; } catch (e) { return false; } };
/** the studio's own folder: the one picked if it already holds a studio (or is named for one), otherwise "the-daily.studio" inside it */
async function fsOpen() {
  const d = SYNC.dir; if (!d) throw new Error('no folder chosen');
  if (FS.root && FS.rootOf === d) return FS.root;
  let root = d, sub = '';
  if (d.name !== FS_SUB && !(await fsHas(d, 'studio.json'))) { root = await d.getDirectoryHandle(FS_SUB, { create: true }); sub = FS_SUB; }
  FS.root = root; FS.rootOf = d; FS.cache.clear(); if (CFG.fsync.sub !== sub) { CFG.fsync.sub = sub; FS_B.quiet(saveCfg); } return root;
}
async function fsDirOf(path, create) { let d = FS.root; const parts = path.split('/'); parts.pop(); for (const p of parts) d = await d.getDirectoryHandle(p, { create: !!create }); return d; }
async function fsGet(path) { try { return await (await (await fsDirOf(path)).getFileHandle(path.split('/').pop())).getFile(); } catch (e) { return null; } }
async function fsPut(path, data) {      /* the browser writes beside the file and swaps it in on close, so a file is never left half-written */
  const w = await (await (await fsDirOf(path, true)).getFileHandle(path.split('/').pop(), { create: true })).createWritable();
  try { await w.write(data); await w.close(); } catch (e) { try { await w.abort(); } catch (x) { } throw e; }
}
async function fsDel(path) { try { await (await fsDirOf(path)).removeEntry(path.split('/').pop()); return true; } catch (e) { return false; } }
async function fsLs(path) { const out = []; try { let d = FS.root; for (const p of path.split('/').filter(Boolean)) d = await d.getDirectoryHandle(p); for await (const [n, h] of d.entries()) out.push({ n, h }); } catch (e) { } return out; }

/* ---------- the studio's text files: what part 74's engine reads and writes ---------- */
const FS_TEXT = ['studio.json', 'settings.json', 'notes.json', 'README.md', 'rig/presets.json', 'stage/looks.json', 'stage/scenes.json'];
/** every file's Git blob id, as GitHub's tree would list it; a file whose time and size have not changed is not read again */
async function fsHead() {
  await fsOpen(); const files = {}, texts = new Map(), paths = FS_TEXT.slice();
  for (const e of await fsLs('songs')) if (e.h.kind === 'file' && /^[\w-]{1,80}\.json$/.test(e.n)) paths.push('songs/' + e.n);
  for (const p of paths) {
    const f = await fsGet(p); if (!f) continue; const c = FS.cache.get(p);
    if (c && c.lm === f.lastModified && c.size === f.size) { files[p] = { sha: c.sha, size: f.size }; continue; }
    if (f.size > FS_MAX) { files[p] = { sha: 'big', size: f.size }; continue; }
    const t = await f.text(), sha = await ghSha(t); FS.cache.set(p, { lm: f.lastModified, size: f.size, sha }); texts.set(p, t); files[p] = { sha, size: f.size };
  }
  return { head: files['studio.json'] ? 'folder' : null, files, texts };
}
async function fsCommit(at, send) {
  for (const [p, t] of Object.entries(send)) {
    if (t == null) { await fsDel(p); FS.cache.delete(p); continue; }
    await fsPut(p, t); const f = await fsGet(p); if (f) FS.cache.set(p, { lm: f.lastModified, size: f.size, sha: await ghSha(t) });
  }
  return 'folder';
}
/** a song as a file here: the GitHub text, and the recordings it has (their settings; the audio is in media/) */
const fsSongOut = rec => Object.assign(ghSongOut(rec), { format: 'the-daily-song-folder', takes: (rec.takes || []).map(m => Object.assign({}, m)), track: rec.track ? Object.assign({}, rec.track) : null, stemMix: rec.stemMix || null });
const FS_ABOUT = 'This folder is a the-daily.studio studio: settings, presets, looks, notes, songs as text, and their recordings in media/. It is kept in step by the app; edit with care.';
const FS_README = '# My the-daily.studio\n\nKept in step by [the-daily.studio](https://the-daily.studio/) (Settings ▸ Folder sync) on every computer that uses this folder. `songs/` holds each song as text, `media/<song id>/` its recordings (WAV) and backing track, and the rest your settings, rig presets, stage looks and scenes, and notes.\n';
const fsLocal = () => ghLocal({ songOut: fsSongOut, st: CFG.fsync, max: FS_MAX, about: FS_ABOUT, readme: FS_README });

/* ---------- recordings and backing tracks ---------- */
const fsId = v => typeof v === 'string' && /^[\w-]{1,48}$/.test(v);
const fsTakeOk = m => !!m && typeof m === 'object' && fsId(m.id) && (m.src == null || fsId(m.src)) && m.sr >= 8000 && m.sr <= 384000;
const fsTrackOk = t => !!t && typeof t === 'object' && t.bytes > 0 && t.bytes < 4e9;
const fsExt = t => ((/\.[A-Za-z0-9]{1,8}$/.exec(String(t.fileName || '')) || ['.m4a'])[0]).toLowerCase();
/** the files a song's recordings make: where each lives in the folder (under pathId) and in this browser (under keyId) */
function fsNeeds(pathId, keyId, takes, track) {
  const out = [], seen = new Set(), dir = 'media/' + pathId + '/';
  for (const m of takes) {
    const sid = m.src || m.id; if (seen.has(sid)) continue; seen.add(sid); const k = keyId + '/take/' + sid + '/';
    out.push({ kind: 'dry', path: dir + sid + '.dry.wav', key: k + 'dry', sr: m.sr });
    if (m.hasWet) out.push({ kind: 'wet', path: dir + sid + '.wet.wav', key: k + 'wet', sr: m.sr });
    if (m.hasCam) out.push({ kind: 'cam', path: dir + sid + '.cam.json', key: k + 'cam' });
  }
  if (track) out.push({ kind: 'track', path: dir + 'track-' + Math.round(track.bytes) + fsExt(track), key: keyId + '/track', track });
  return out;
}
/** bring a song's recordings in from the folder (only those this browser lacks); a file a cloud drive has not finished is left for later */
async function fsMediaIn(fromId, toId, takes, track) {
  const have = new Set(await pdbKeys('blobs', toId + '/')), r = { got: 0, missing: 0 };
  for (const n of fsNeeds(fromId, toId, takes, track)) {
    try {
      if (n.kind === 'track') { if (have.has(n.key)) { const b = await pdbGet('blobs', n.key); if (b && b.buf && b.buf.byteLength === n.track.bytes) continue; } }
      else if (have.has(n.key)) continue;
      const f = await fsGet(n.path); if (!f) { r.missing++; continue; }
      if (n.kind === 'cam') await pdbPut('blobs', await f.text(), n.key);
      else if (n.kind === 'track') { if (f.size !== n.track.bytes) { r.missing++; continue; } const buf = await f.arrayBuffer(); await pdbPut('blobs', { buf, type: n.track.type || f.type || 'audio/mp4', name: n.track.fileName || 'track' }, n.key); }
      else { const u = new Uint8Array(await f.arrayBuffer()); if (u.length < 44 || new DataView(u.buffer).getUint32(4, true) + 8 !== u.length) { r.missing++; continue; } await pdbPut('blobs', wavParse(u).i16, n.key); }
      r.got++; fsStatus('Bringing recordings in… ' + r.got);
    } catch (e) { r.missing++; console.warn('[folder] could not read', n.path, e); }
  }
  return r;
}
/** copy a song's recordings to the folder (only those it lacks) */
async function fsMediaOut(id, takes, track, names) {
  const have = new Set(await pdbKeys('blobs', id + '/')); let n = 0;
  for (const x of fsNeeds(id, id, takes, track)) {
    if (!have.has(x.key) || names.has(x.path.split('/').pop())) continue;
    const v = await pdbGet('blobs', x.key); if (v == null) continue;
    await fsPut(x.path, x.kind === 'cam' ? String(v) : x.kind === 'track' ? v.buf : wavI16(v, x.sr)); n++; fsStatus('Copying recordings to the folder… ' + n);
  }
  return n;
}
/** after the songs are in step: every song's recordings, both ways; then tidy what no song uses (part 74 calls this) */
async function fsMedia(at, now, rep, files) {
  if (!(FS.mediaDue || rep.took.length || rep.sent || Date.now() - FS.mediaAt > 36e5)) return;      /* nothing new on either side: an hour between looks */
  FS.mediaDue = false; FS.mediaAt = Date.now();
  const ids = new Set(Object.keys(files).filter(p => GH_KIND(p) === 'song').map(p => p.slice(6, -5))), ref = new Map(); let wrote = 0, got = 0, missing = 0;
  for (const id of ids) {
    const rec = await pdbGet('projects', id); if (!rec) continue;
    const takes = (rec.takes || []).filter(fsTakeOk), track = fsTrackOk(rec.track) ? rec.track : null, need = fsNeeds(id, id, takes, track);
    ref.set(id, new Set(need.map(x => x.path.split('/').pop()))); if (!need.length) continue;
    wrote += await fsMediaOut(id, takes, track, new Set((await fsLs('media/' + id)).map(e => e.n)));
    const r = await fsMediaIn(id, id, takes, track); got += r.got; missing += r.missing;
    if (r.got && PRJ.cur === id && PRJ.wait && PRJ.wait.id === id && PRJ.wait.list.length && !fsAudioBusy()) { try { await projSave(); await projLoad(id, { keepZoom: true }); } catch (e) { } }      /* the open song's recordings arrived */
  }
  const inFolder = new Set(Object.keys(at.files).filter(p => GH_KIND(p) === 'song').map(p => p.slice(6, -5))), tidied = await fsTidy(ref, inFolder);
  if (missing) FS.mediaDue = true;
  rep.media = { wrote, got, missing, tidied };
  rep.note = [wrote ? wrote + ' recording file' + (wrote === 1 ? '' : 's') + ' copied' : '', got ? got + ' recording file' + (got === 1 ? '' : 's') + ' came in' : '', missing ? missing + ' still on the way' : ''].filter(Boolean).join(' · ');
  if (got) bus.emit('projects');
}
/** remove the app's own files that no song uses, once that has been so for a day (by this device's count and by the file's age) */
async function fsTidy(ref, inFolder) {
  const orph = CFG.fsync.orph || {}, now = Date.now(), seen = new Set(); let n = 0;
  for (const d of await fsLs('media')) {
    if (d.h.kind !== 'directory' || !fsId(d.n)) continue;
    const want = ref.get(d.n); if (!want && inFolder.has(d.n)) continue;      /* a song in the folder this device could not read: its recordings are left alone */
    for (const e of await fsLs('media/' + d.n)) {
      if (e.h.kind !== 'file' || !FS_MEDIA_RE.test(e.n) || (want && want.has(e.n))) continue;
      const p = 'media/' + d.n + '/' + e.n; seen.add(p); const first = orph[p] || (orph[p] = now); let lm = now; try { lm = (await e.h.getFile()).lastModified; } catch (x) { }
      if (now - first >= FS_DAY && now - lm >= FS_DAY && await fsDel(p)) { n++; delete orph[p]; seen.delete(p); }
    }
    if (!want) try { await (await FS.root.getDirectoryHandle('media')).removeEntry(d.n); } catch (e) { }      /* only goes if it is empty */
  }
  Object.keys(orph).forEach(p => { if (!seen.has(p)) delete orph[p]; }); CFG.fsync.orph = orph; FS_B.quiet(saveCfg);
  return n;
}
/** a song from the folder into this browser's library: its recordings first, so it opens whole. `cid` names a kept second version */
async function fsTakeSong(text, asCopy, at, path, cid) {
  const d = ghParse(text); if (!d || !d.song || !Array.isArray(d.song.sections)) return null;
  const from = fsId(d.id) ? d.id : '';
  if (path && from && path !== 'songs/' + from + '.json') { const r = await fsClash(text, d); await fsDel(path); FS.cache.delete(path); return r; }      /* a file named for another song: a cloud drive's second version */
  const id = cid || (asCopy || !from ? projId() : from), old = asCopy ? null : await pdbGet('projects', id);
  const takes = Array.isArray(d.takes) ? d.takes.filter(fsTakeOk) : (old && old.takes) || [], track = fsTrackOk(d.track) ? d.track : null;
  if (from) { const r = await fsMediaIn(from, id, takes, track); if (r.missing) FS.mediaDue = true; }
  const rec = Object.assign({ takes: [], track: null, stemMix: null, size: 0, nTakes: 0 }, old || {}, { id, v: 1, origin: d.origin || 'folder', created: d.created || Date.now(), modified: Date.now(), zoom: d.zoom || 'song', song: normSong(d.song), takes, track, stemMix: d.stemMix || null });
  if (asCopy) rec.song.title = (d.title || 'Untitled') + ' (from another device)';
  rec.title = rec.song.title || d.title || 'Untitled'; rec.artist = rec.song.artist || d.artist || ''; rec.nTakes = takes.length;
  const sids = new Set(takes.map(m => m.src || m.id)); rec.size = takes.filter(m => sids.delete(m.src || m.id)).reduce((a, m) => a + (m.dur || 0) * m.sr * 2 * (m.hasWet ? 2 : 1), 0) + (track ? track.bytes : 0);
  if (old) {      /* recordings removed on the other computer go here too */
    const keep = new Set(takes.map(m => m.src || m.id)); for (const k of await pdbKeys('blobs', id + '/take/')) if (!keep.has(k.split('/')[2])) await pdbDel('blobs', k);
    if (!track && old.track) await pdbDel('blobs', id + '/track');
  }
  await pdbPut('projects', rec);
  if (!asCopy && PRJ.cur === id) { try { await projLoad(id, { keepZoom: true }); } catch (e) { } }
  return rec;
}

/* ---------- two computers saving the same song before the cloud drive caught up ----------
   A cloud drive keeps both: one as the song's file, the other as a second file beside it ("<id> (Sam's conflicted copy …).json" in
   Dropbox, "<id> (1).json", "<id> 2.json", "<id>-LAPTOP.json" in OneDrive). The second is kept as a song of its own, "… (from another
   device)", unless it is the same as the song, and its file goes. The kept song's id comes from its content, so two computers doing
   this at once make the same song, not two. */
async function fsClash(text, d) {
  const main = await fsGet('songs/' + d.id + '.json'); if (main && await main.text() === text) return null;
  const cid = (d.id.slice(0, 30) + '-v' + (await ghSha(text)).slice(0, 10)).replace(/[^\w-]/g, '');
  if (await pdbGet('projects', cid)) return null; FS.clashes++;
  return fsTakeSong(text, true, null, null, cid);
}
async function fsAbsorb() {
  FS.clashes = 0;
  for (const e of await fsLs('songs')) {
    if (e.h.kind !== 'file' || !/\.json$/i.test(e.n) || /^[\w-]{1,80}\.json$/.test(e.n)) continue;      /* a plain "<id>.json" is the engine's (a misnamed one is caught as it is taken) */
    let t; try { const f = await e.h.getFile(); if (f.size > FS_MAX) continue; t = await f.text(); } catch (x) { continue; }
    const d = ghParse(t); if (!d || !fsId(d.id) || !d.song || !Array.isArray(d.song.sections) || !/^the-daily-song/.test(String(d.format || ''))) continue;      /* not one of ours: left alone */
    await fsClash(t, d); await fsDel('songs/' + e.n);
  }
  if (FS.clashes) await projRefresh();
  return FS.clashes;
}

/* ---------- the folder as one of the places part 74's engine keeps a studio in step with ---------- */
const FS_B = { get st() { return CFG.fsync; }, base: 'fs/base/', label: 'the folder', event: 'fsync', maxFile: FS_MAX,
  local: fsLocal, head: fsHead, read: async (p, at) => at.texts.has(p) ? at.texts.get(p) : (await fsGet(p) || { text: async () => null }).text(), commit: fsCommit,
  takeSong: fsTakeSong, status: (t, bad) => fsStatus(t, bad), quiet: fn => { FS.quiet = true; PRJ.quiet++; try { fn(); } finally { FS.quiet = false; PRJ.quiet--; } }, after: fsMedia };
function fsStatus(t, bad) { FS.status = t; FS.bad = !!bad; const s = document.getElementById('fsStatus'); if (s) { s.textContent = t; s.style.color = bad ? 'var(--bad)' : ''; } }
/** one sync with the folder (another waits its turn) */
async function fsSync(why) {
  if (!SYNC.dir || !CFG.sync) return null;
  if (FS.busy) { FS.again = true; return FS.busy; }
  if (await syncPerm(false) !== 'granted') { bus.emit('sync'); return null; }
  if (why !== 'now' && why !== 'connect' && fsAudioBusy()) { fsKick(10000); return null; }
  FS.busy = (async () => {
    SYNC.busy = true; SYNC.err = ''; fsStatus('Syncing…'); bus.emit('sync'); let rep = null;
    try {
      await fsOpen(); await fsAbsorb();      /* the cloud drive's second versions first, then the engine (which may find more) */
      rep = await studioSync(FS_B, why); SYNC.at = Date.now(); CFG.syncAt = SYNC.at; FS_B.quiet(saveCfg);
      const clash = FS.clashes; if (rep) rep.clash = clash; if (clash) toast(clash + (clash === 1 ? ' song was' : ' songs were') + ' saved on two computers before the cloud drive caught up, so both versions are kept (“… (from another device)”).', 'warn');
      if (CFG.fsync.zips) await syncZips(why === 'now' || why === 'connect');
      if (!CFG.fsync.told) { CFG.fsync.told = true; FS_B.quiet(saveCfg); toast('Your backup folder now keeps your whole studio in step (songs, recordings, settings and looks) in “' + fsWhere() + '”. Choose the same folder on another computer to have the same studio there. Each song’s .daily-song.zip is still saved too.', 'ok'); }
    } catch (e) {
      SYNC.err = e && e.name === 'NotFoundError' ? 'the folder is not there any more (moved or deleted?). Choose it again.' : e && e.name === 'NotAllowedError' ? 'the browser needs your permission again.' : (e && e.message) || String(e);
      if (e && e.name === 'NotAllowedError') await syncPerm(false); FS.root = null; fsStatus('Not synced: ' + SYNC.err, true); console.warn('[folder]', e);
    } finally { SYNC.busy = false; FS.busy = null; bus.emit('sync'); if (FS.again) { FS.again = false; setTimeout(() => fsSync('again'), 50); } }
    return rep;
  })();
  return FS.busy;
}
/** the button, and older callers: every song now, or just what changed */
const syncNow = all => fsSync(all ? 'now' : 'auto');
/** after a change: sync once things have been quiet for a few seconds (and at least every half minute while they are not) */
function fsKick(ms) {
  if (!SYNC.dir || !CFG.sync || FS.quiet || PRJ.flushing) return; const now = Date.now(), d = ms != null ? ms : window.__syncDelay != null ? window.__syncDelay : 6000;
  if (FS.timer) { if (FS.due <= now + d && now - FS.kick0 > 30000) return; clearTimeout(FS.timer); } else FS.kick0 = now;      /* one already due sooner, after half a minute of changes: let it run */
  FS.due = now + d; FS.timer = setTimeout(() => { FS.timer = 0; fsSync('auto'); }, d);
}
/** part 25 calls this after a song is saved; saveCfg after a setting changes */
function syncKick() { fsKick(); }
function syncCfgKick() { if (!FS.quiet && !FS.busy && !PRJ.quiet) fsKick(window.__syncDelay != null ? window.__syncDelay : 15000); }
bus.on('projects', () => { if (!FS.busy && !PRJ.flushing) fsKick(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && SYNC.dir && CFG.sync && SYNC.perm === 'granted' && Date.now() - (SYNC.at || 0) > 30000) fsSync('back'); });
setInterval(() => { if (SYNC.dir && CFG.sync && SYNC.perm === 'granted' && !document.hidden && !FS.busy && Date.now() - (SYNC.at || 0) > 55000) fsSync('poll'); }, 60000);
/** each song as a .daily-song.zip in the folder you picked: the current song at most once in 45 seconds, or every song */
async function syncZips(all) {
  const since = Date.now() - FS.zipAt;
  if (!all && since < 45000) { clearTimeout(FS.zipT); FS.zipT = setTimeout(() => { if (fsAudioBusy()) FS.zipAt = 0; else syncZips(false); }, 45000 - since); return; }
  const list = all ? PRJ.list.slice() : PRJ.list.filter(r => r.id === PRJ.cur); if (!list.length) return; FS.zipAt = Date.now();
  try {
    for (const r of list) {
      const dup = PRJ.list.some(o => o.id !== r.id && slug(o.title || 'song') === slug(r.title || 'song')), blob = zipBuild(await projEntries(r.id, ''));
      const w = await (await SYNC.dir.getFileHandle(syncFile(r, dup), { create: true })).createWritable(); await w.write(blob); await w.close();
    }
  } catch (e) { console.warn('[folder] zip', e); }
}
function syncFile(rec, dup) { return slug(rec.title || 'song') + (dup ? '-' + rec.id.slice(-4) : '') + '.daily-song.zip'; }

/* ---------- Settings ▸ Folder sync ---------- */
function syncControl() {
  const box = h('div', { class: 'sync-ctl', style: { display: 'grid', gap: '8px' } }), draw = () => {
    box.innerHTML = '';
    if (!syncSupported()) { box.append(h('p', { class: 'small muted' }, 'Folder sync needs Chrome or Edge on a computer (this browser cannot open a folder). Here, ☰ Songs → All songs → Back up all songs makes one file with everything, to keep anywhere.')); return; }
    if (!SYNC.dir) {
      box.append(h('p', { class: 'small' }, 'Choose a folder and your whole studio is kept in step with it: songs, recordings and backing tracks, settings, rig presets, stage looks and notes. Choose a folder inside iCloud Drive, Dropbox, Google Drive or OneDrive, then the same folder on your other computers, and they all have the same studio.'),
        h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, h('button', { class: 'btn primary', id: 'syncChoose', onclick: syncChoose }, '📁 Choose a folder…'), h('span', { class: 'tiny muted' }, 'No account. The browser reads and writes the folder itself; nothing is sent anywhere.')));
      return;
    }
    const need = SYNC.perm !== 'granted';
    box.append(h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, h('b', {}, '📁 ' + fsWhere()),
      need ? h('button', { class: 'btn primary', id: 'syncAllow', onclick: async () => { await syncPerm(true); bus.emit('sync'); if (SYNC.perm === 'granted') fsSync('now'); } }, 'Allow access again') : h('button', { class: 'btn', id: 'syncNow', disabled: SYNC.busy, onclick: () => syncNow(true) }, '⟳ Sync now'),
      h('button', { class: 'btn', id: 'syncChange', onclick: syncChoose }, 'Change…'), h('button', { class: 'btn', id: 'syncOff', onclick: syncOff }, 'Turn off')),
      h('span', { class: 'tiny muted', id: 'fsStatus', style: { color: FS.bad && !SYNC.busy ? 'var(--bad)' : '' } }, SYNC.busy ? FS.status || 'Syncing…' : SYNC.err ? 'Not synced: ' + SYNC.err : need ? 'The browser needs your permission again after a restart.' : FS.status || (CFG.syncAt ? 'Last synced ' + new Date(CFG.syncAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.' : 'Ready.')),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'syncZips', checked: !!CFG.fsync.zips, onchange: e => { CFG.fsync.zips = e.target.checked; saveCfg(); if (e.target.checked) syncZips(true); } }), 'Also save each song as a .daily-song.zip in “' + SYNC.name + '” (one file per song, to open or send on its own)'),
      h('p', { class: 'tiny muted' }, 'It syncs a few seconds after a change, when the page opens, and every minute while it is open; never while playing or recording. A song changed here and on another computer keeps both versions. Recordings no song uses are tidied away after a day.'));
  };
  draw(); bus.on('sync', draw); return box;
}
