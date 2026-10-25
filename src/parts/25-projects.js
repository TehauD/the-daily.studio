/* ============================================================
   Part 25 · PROJECTS — a library of songs, kept on this device
   Every song is a project: the song model, its recorded takes, and the backing track you loaded. They live in this
   browser's IndexedDB (no account, no server). Switching, duplicating and deleting never touch another song.
   A project also exports as a plain .zip "song folder": song.md (readable anywhere, Obsidian-friendly),
   arrangement.json (the full model) and audio/*.wav — the same layout a GitHub repo will use later.
   ============================================================ */
const PRJ = { db: null, ok: false, cur: null, rec: null, list: [], loading: false, timer: 0, saving: null, again: false, ready: false, pending: null, warned: false, wantStart: false };
const PDB_NAME = 'the-daily-songs';

/* ---------- IndexedDB, in a few lines ---------- */
function pdbOpen() {
  return new Promise(res => {
    if (!window.indexedDB) return res(null);
    let r; try { r = indexedDB.open(PDB_NAME, 1); } catch (e) { return res(null); }
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' }); if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs'); };
    r.onsuccess = () => { r.result.onversionchange = () => { try { r.result.close(); } catch (e) { } }; res(r.result); };
    r.onerror = r.onblocked = () => res(null);
  });
}
const pdbReq = (st, mode, fn) => new Promise((res, rej) => { try { const tx = PRJ.db.transaction(st, mode), q = fn(tx.objectStore(st)); tx.oncomplete = () => res(q && q.result); tx.onerror = tx.onabort = () => rej(tx.error || new Error('storage error')); } catch (e) { rej(e); } });
const pdbGet = (st, k) => pdbReq(st, 'readonly', s => s.get(k));
const pdbPut = (st, v, k) => pdbReq(st, 'readwrite', s => k === undefined ? s.put(v) : s.put(v, k));
const pdbDel = (st, k) => pdbReq(st, 'readwrite', s => s.delete(k));
const pdbAll = st => pdbReq(st, 'readonly', s => s.getAll());
const pdbDelPrefix = (st, p) => pdbReq(st, 'readwrite', s => s.delete(IDBKeyRange.bound(p, p + '￿')));
const pdbKeys = (st, p) => pdbReq(st, 'readonly', s => s.getAllKeys(IDBKeyRange.bound(p, p + '￿')));

/* ---------- audio storage: 16-bit PCM keeps a 3-minute mono take near 17 MB instead of 34 ---------- */
function toI16(f) { const o = new Int16Array(f.length); for (let i = 0; i < f.length; i++) { const v = f[i]; o[i] = v <= -1 ? -32768 : v >= 1 ? 32767 : Math.round(v * 32767); } return o; }
function fromI16(a) { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] / 32768; return o; }
function wavI16(a, sr) {
  const n = a.length, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  new Int16Array(b, 44, n).set(a); return new Uint8Array(b);
}
/** first channel of a PCM16 / PCM24 / float32 WAV as Int16 */
function wavParse(u) {
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength); if (u.length < 44 || dv.getUint32(0) !== 0x52494646) throw new Error('not a WAV file');
  let p = 12, fmt = null, data = null;
  while (p + 8 <= u.length) { const id = dv.getUint32(p), sz = dv.getUint32(p + 4, true); if (id === 0x666d7420) fmt = { tag: dv.getUint16(p + 8, true), ch: dv.getUint16(p + 10, true), sr: dv.getUint32(p + 12, true), bits: dv.getUint16(p + 22, true) }; else if (id === 0x64617461) { data = { p: p + 8, n: Math.min(sz, u.length - p - 8) }; break; } p += 8 + sz + (sz & 1); }
  if (!fmt || !data) throw new Error('unreadable WAV'); const bp = fmt.bits / 8, fr = Math.floor(data.n / (bp * fmt.ch)), out = new Int16Array(fr);
  for (let i = 0; i < fr; i++) { const o = data.p + i * bp * fmt.ch; out[i] = fmt.bits === 16 ? dv.getInt16(o, true) : fmt.bits === 24 ? ((u[o] | (u[o + 1] << 8) | (u[o + 2] << 16)) << 8) >> 16 : fmt.bits === 32 && fmt.tag === 3 ? clamp(Math.round(dv.getFloat32(o, true) * 32767), -32768, 32767) : (dv.getInt32(o, true) >> 16); }
  return { i16: out, sr: fmt.sr };
}

/* ---------- a minimal .zip (stored, no compression) ---------- */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u) { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC_T[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipBuild(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0; const now = new Date();
  const dt = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate(), tm = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  for (const f of files) {
    const nm = enc.encode(f.name), d = f.data, crc = crc32(d), lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(10, tm, true); lh.setUint16(12, dt, true); lh.setUint32(14, crc, true); lh.setUint32(18, d.length, true); lh.setUint32(22, d.length, true); lh.setUint16(26, nm.length, true);
    parts.push(lh.buffer, nm, d);
    const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(12, tm, true); ch.setUint16(14, dt, true); ch.setUint32(16, crc, true); ch.setUint32(20, d.length, true); ch.setUint32(24, d.length, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
    central.push(ch.buffer, nm); off += 30 + nm.length + d.length;
  }
  let csz = 0; central.forEach(b => { csz += b.byteLength; });
  const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csz, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}
async function zipRead(file) {
  const u = new Uint8Array(await file.arrayBuffer()), dv = new DataView(u.buffer); let e = u.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw new Error('this is not a .zip file');
  const n = dv.getUint16(e + 10, true), dec = new TextDecoder(), out = new Map(); let p = dv.getUint32(e + 16, true);
  for (let i = 0; i < n; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const meth = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true), name = dec.decode(u.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    out.set(name, {
      async get() {
        const s = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), raw = u.subarray(s, s + csz); if (meth === 0) return raw;
        if (meth === 8 && typeof DecompressionStream !== 'undefined') return new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
        throw new Error('this zip uses a compression this browser cannot read');
      }
    });
  }
  return out;
}

/* ---------- small helpers ---------- */
const projId = () => 'p' + Date.now().toString(36) + uid();
const projBytes = n => n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(n >= 1.05e7 ? 0 : 1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' kB' : (n || 0) + ' B';
const projAgo = t => { const s = (Date.now() - t) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago'; if (s < 604800) return Math.floor(s / 86400) + ' d ago'; return new Date(t).toLocaleDateString(); };
const slug = s => (String(s || 'song').normalize('NFKD').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'song');
/** a saved song, completed with any fields this version added since it was written */
function normSong(saved) {
  const d = newSong(), s = Object.assign(d, saved || {}); s.band = Object.assign(d.band, (saved && saved.band) || {}); s.mix = Object.assign(d.mix, (saved && saved.mix) || {}); s.voicePref = (saved && saved.voicePref) || {};
  s.tuning = ((saved && saved.tuning) || d.tuning).slice(); if (!Array.isArray(s.sections)) s.sections = []; if (!Array.isArray(s.ts) || s.ts.length < 2) s.ts = [4, 4]; return s;
}
const takeMeta = t => { const m = { id: t.id, kind: t.kind || 'gtr', name: t.name, startSec: t.startSec, sr: t.sr, g: t.g, pan: t.pan || 0, mute: !!t.mute, solo: !!t.solo, mode: t.mode, bpm: t.bpm, preset: t.preset || '', peak: t.peak, rms: t.rms, dur: t.dur, t: t.t, hasWet: !!t.wet, hasCam: !!(t.cam && t.cam.length) }; try { m.stats = t.stats ? JSON.parse(JSON.stringify(t.stats)) : null; } catch (e) { m.stats = null; } return m; };

/* ---------- save ---------- */
function projDirty() {
  if (!PRJ.ok || PRJ.loading || store.locked) return;
  if (!PRJ.cur) { if (PRJ.ready && !document.getElementById('origins') && (songHasWork() || TAKES.length || STM.ch)) projAdoptCurrent(); return; }   // work done before any song was chosen is kept as a song
  clearTimeout(PRJ.timer); PRJ.timer = setTimeout(projSave, 1200);
}
function projSave() {
  clearTimeout(PRJ.timer); if (!PRJ.ok || !PRJ.cur || PRJ.loading || store.locked) return Promise.resolve();
  if (PRJ.saving) { PRJ.again = true; return PRJ.saving; }
  PRJ.saving = (async () => {
    try { await projSaveNow(); projPersist(); } catch (e) { console.warn('project save', e); if (!PRJ.warned) { PRJ.warned = true; toast('This browser would not store your work (storage full or private window?). Export a song bundle from ☰ Songs to keep it.', 'warn'); } }
    finally { PRJ.saving = null; if (PRJ.again) { PRJ.again = false; projDirty(); } }
  })();
  return PRJ.saving;
}
/** ask the browser not to evict the library when disk space is low (asked once; some browsers decide silently, others show a prompt) */
async function projPersist() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return; PRJ.persisted = await navigator.storage.persisted();
    if (!PRJ.persisted && !CFG.persistAsked) { CFG.persistAsked = true; saveCfg(); PRJ.persisted = await navigator.storage.persist(); }
  } catch (e) { }
}
/** a gentle, rare reminder to keep a copy: only when there is real work and no recent backup */
function projNudge() {
  setTimeout(() => {
    try {
      const real = PRJ.list.some(r => r.nTakes || r.track) || PRJ.list.length > 2, day = 864e5, now = Date.now();
      if (real && (!CFG.lastBackup || now - CFG.lastBackup > 30 * day) && (!CFG.nudgeAt || now - CFG.nudgeAt > 7 * day)) { CFG.nudgeAt = now; saveCfg(); toast('Tip: keep a copy of your songs. ☰ Songs ▸ Back up all songs saves one zip.'); }
    } catch (e) { }
  }, 25000);
}
async function projSaveNow() {
  const id = PRJ.cur, rec = PRJ.rec || (PRJ.rec = { id, created: Date.now(), origin: 'blank' });
  rec.song = JSON.parse(JSON.stringify(S)); rec.title = S.title || 'Untitled'; rec.artist = S.artist || ''; rec.modified = Date.now(); rec.v = 1; rec.zoom = typeof ZOOM !== 'undefined' ? ZOOM.cur : 'studio';
  let bytes = 0; const live = new Set(TAKES.map(t => t.id));
  for (const old of (rec.takes || []).map(t => t.id).filter(x => !live.has(x))) await pdbDelPrefix('blobs', id + '/take/' + old + '/');
  for (const t of TAKES) {
    if (!t._saved) { const k = id + '/take/' + t.id + '/'; await pdbPut('blobs', toI16(t.dry), k + 'dry'); if (t.wet) await pdbPut('blobs', toI16(t.wet), k + 'wet'); if (t.cam && t.cam.length) { try { await pdbPut('blobs', JSON.stringify(t.cam), k + 'cam'); } catch (e) { } } t._saved = true; }
    bytes += (t.dry.length + (t.wet ? t.wet.length : 0)) * 2;
  }
  rec.takes = TAKES.map(takeMeta);
  if (STM.ch && STM.file && !STM._saved && !STM.busy) {
    const buf = await STM.file.arrayBuffer(); await pdbPut('blobs', { buf, type: STM.file.type || 'audio/mp4', name: STM.file.name || 'track' }, id + '/track'); STM._saved = true;
    rec.track = { name: STM.name, title: STM.title, artist: STM.artist, dur: STM.dur, fileName: STM.file.name || 'track', type: STM.file.type || 'audio/mp4', bytes: buf.byteLength }; PRJ.pending = null;
  } else if (!STM.ch && !STM.busy && !STM.restoring && !PRJ.pending && rec.track) { await pdbDel('blobs', id + '/track'); rec.track = null; }
  if (rec.track) bytes += rec.track.bytes || 0; rec.size = bytes; rec.nTakes = TAKES.length;
  await pdbPut('projects', rec);
  const i = PRJ.list.findIndex(r => r.id === id); if (i >= 0) PRJ.list[i] = rec; else PRJ.list.unshift(rec); PRJ.list.sort((a, b) => b.modified - a.modified); bus.emit('projects');
}
async function projRefresh() { try { PRJ.list = (await pdbAll('projects')).sort((a, b) => b.modified - a.modified); } catch (e) { PRJ.list = []; } }

/* ---------- switching: put a project's song, takes and track into the live app ---------- */
function projQuiet() {
  try { if (T.playing) stopPlay(true); } catch (e) { }
  try { if (STP.playing) spPause(); } catch (e) { }
  STM.ticket = (STM.ticket || 0) + 1; STM.busy = false; STM.restoring = false; TAKES.length = 0; PRJ.pending = null;
  if (STM.ch) stemUnload(); STM.file = null; STM._saved = false;
}
function projUse(song) {
  S = normSong(song); histStack.u.length = 0; histStack.r.length = 0; histStack.cur = snap();
  SEL.sec = 0; SEL.bar = 0; TE.sec = 0; TE.bi = 0; T.cursor = 0; T.loopA = 0; T.loopB = null; store.set('song', S); store.set('songAt', Date.now());
  bus.emit('song', 'reload'); bus.emit('takes');
}
async function projLoad(id, o = {}) {
  const rec = o.rec || await pdbGet('projects', id); if (!rec) return false;
  if (PRJ.cur && PRJ.cur !== id) await projSave();
  PRJ.loading = true;
  try {
    projQuiet(); PRJ.cur = id; PRJ.rec = rec; store.set('cur', id);
    for (const m of rec.takes || []) {
      const k = id + '/take/' + m.id + '/', dry = await pdbGet('blobs', k + 'dry'); if (!dry) continue;
      const wet = m.hasWet ? await pdbGet('blobs', k + 'wet') : null, cam = m.hasCam ? await pdbGet('blobs', k + 'cam') : null; let cm = []; try { cm = cam ? JSON.parse(cam) : []; } catch (e) { }
      const t = Object.assign({}, m, { dry: fromI16(dry), wet: wet ? fromI16(wet) : null, cam: cm, _saved: true }); t.peaks = peaksOf(t.dry); TAKES.push(t);
    }
    projUse(rec.song);
    if (rec.zoom && typeof zoomSet === 'function' && !o.keepZoom) zoomSet(rec.zoom, true);
  } finally { PRJ.loading = false; }
  if (rec.track) { PRJ.pending = rec.track; if ((CFG.trackRestore || (document.body.dataset.form === 'phone' ? 'tap' : 'auto')) === 'auto') projRestoreTrack(); else bus.emit('track'); }
  bus.emit('projects'); return true;
}
/** the backing track is stored as the original file; its stems are separated again on open (the song itself opens instantly) */
async function projRestoreTrack() {
  const id = PRJ.cur, tm = PRJ.pending; if (!id || !tm || STM.busy) return;
  const b = await pdbGet('blobs', id + '/track'); if (!b || PRJ.cur !== id) { PRJ.pending = null; bus.emit('track'); return; }
  STM.restoring = true; try { await stemLoad(new File([b.buf], b.name || tm.fileName || 'track', { type: b.type }), { restore: true }); } finally { STM.restoring = false; }
  if (STM.ch) PRJ.pending = null; bus.emit('track');
}

/* ---------- creating ---------- */
const FORMS = { empty: ['Verse 1'], vc: ['Verse 1', 'Chorus'], vcb: ['Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Bridge', 'Chorus'] };
/* a new, blank song starts with the band off, so playback is only what the person records or writes; Hum to Song turns it on for the song it builds */
function blankSong(o = {}) {
  const s = newSong(); Object.assign(s.band, { drumsOn: false, bassOn: false, compOn: false, leadOn: false }); s.title = String(o.title || '').trim() || 'Untitled Idea'; s.artist = o.artist || ''; s.bpm = clamp(+o.bpm || 92, 30, 260); s.ts = o.ts || [4, 4]; s.band.drumLen = Math.min(32, s.ts[0] * 16 / s.ts[1]);
  s.key = o.key == null ? 9 : +o.key; s.minor = o.minor == null ? true : !!o.minor; s.scale = s.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)';
  if (o.tuning && TUNINGS[o.tuning]) { s.tuningName = o.tuning; s.tuning = TUNINGS[o.tuning].slice(); }
  s.sections = (FORMS[o.form] || FORMS.empty).map(n => mkSection(n, ['', '', '', ''])); return s;
}
/** kind: 'blank' | 'track' | 'demo' | 'import'.  Everything about the song you were on is saved first. */
async function projCreate(kind, o = {}) {
  try { if (T.playing) stopPlay(true); } catch (e) { }
  if (PRJ.fresh) PRJ.fresh = false;   // the very first start card: the song on screen is only the built-in demo, not the person's work
  else if (!PRJ.cur && PRJ.ok && (songHasWork() || TAKES.length || STM.ch)) await projAdoptCurrent(); else await projSave();
  const id = projId(); PRJ.loading = true;
  try {
    projQuiet(); PRJ.cur = id; PRJ.rec = { id, created: Date.now(), origin: kind, v: 1 }; store.set('cur', id);
    const song = o.song || (kind === 'demo' ? (() => { const d = demoSong(); d.sections.forEach(sec => sec.bars.forEach(b => { const c = barChords(b)[0]; if (c) fillTab(b, 'Fingerstyle pop', c); })); return d; })() : blankSong(o));
    projUse(song); if (kind === 'blank') { CFG.flats = keyUsesFlats(S.key, S.minor); saveCfg(); }
    store.set('started', true);
  } finally { PRJ.loading = false; }
  if (typeof zoomSet === 'function') zoomSet(o.zoom || (kind === 'track' ? 'studio' : 'song'), true);
  await projSave(); bus.emit('projects'); return id;
}
/** Start from a song: a new project, then the file is split into stems and fills the song in */
async function projFromTrack(file) {
  await projCreate('track', { form: 'empty', title: cleanTitle(file.name) || 'Untitled Idea', zoom: 'studio' });
  dockGo('stems'); stemLoad(file);
}
async function projAdoptCurrent(kind) { // keep the song that is already on screen as a project (upgrades from a single autosaved song)
  const id = projId(); PRJ.cur = id; PRJ.rec = { id, created: Date.now(), origin: S.track ? 'track' : kind || 'blank', v: 1 }; store.set('cur', id); store.set('started', true); await projSave();
}
async function projDuplicate(id) {
  if (id === PRJ.cur) await projSave(); const rec = await pdbGet('projects', id); if (!rec) return null;
  const nid = projId(), cp = JSON.parse(JSON.stringify(rec)); cp.id = nid; cp.title = (rec.title || 'Untitled') + ' (copy)'; cp.song.title = cp.title; cp.created = cp.modified = Date.now();
  for (const k of await pdbKeys('blobs', id + '/')) await pdbPut('blobs', await pdbGet('blobs', k), nid + k.slice(id.length)); await pdbPut('projects', cp); await projRefresh(); bus.emit('projects'); return nid;
}
async function projDelete(id) {
  await pdbDel('projects', id); await pdbDelPrefix('blobs', id + '/'); await projRefresh();
  if (id === PRJ.cur) { PRJ.rec = null; PRJ.cur = null; clearTimeout(PRJ.timer); if (PRJ.list.length) await projLoad(PRJ.list[0].id); else await projCreate('blank', { form: 'empty' }); }
  bus.emit('projects');
}
async function projRename(id, title) {
  title = String(title || '').trim(); if (!title) return;
  if (id === PRJ.cur) { S.title = title; commit(false); bus.emit('song'); await projSave(); return; }
  const rec = await pdbGet('projects', id); if (!rec) return; rec.title = title; rec.song.title = title; rec.modified = Date.now(); await pdbPut('projects', rec); await projRefresh(); bus.emit('projects');
}

/* ---------- the song folder: song.md + arrangement.json + audio/ ---------- */
function songMarkdown(s, rec) {
  const fl = keyUsesFlats(s.key, s.minor), key = pcName(s.key, fl) + (s.minor ? ' minor' : ' major'), q = x => JSON.stringify(String(x == null ? '' : x)), L = ['---', 'title: ' + q(s.title), 'artist: ' + q(s.artist), 'key: ' + q(key), 'bpm: ' + (Math.round(s.bpm * 100) / 100), 'time: ' + q(s.ts[0] + '/' + s.ts[1]), 'tuning: ' + q(s.tuningName), 'capo: ' + (s.capo || 0),
    'created: ' + new Date((rec && rec.created) || Date.now()).toISOString(), 'modified: ' + new Date((rec && rec.modified) || Date.now()).toISOString(), 'origin: ' + ((rec && rec.origin) || 'blank'), 'tags: [song]', 'app: ' + q(BRAND.name + ' ' + VERSION), '---', '', '# ' + (s.title || 'Untitled'), s.artist ? '*' + s.artist + '*' : '', ''];
  s.sections.forEach(sec => { L.push('## ' + sec.name); const ch = sec.bars.map(b => b.chord || '·'); if (ch.some(c => c !== '·')) L.push('`| ' + ch.join(' | ') + ' |`', ''); if ((sec.lyrics || '').trim()) L.push(sec.lyrics.trim(), ''); else L.push(''); });
  if ((s.notes || '').trim()) L.push('## Notes', s.notes.trim(), ''); return L.filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n') + '\n';
}
/** every file of a project, read back from storage: [{name, data}] under the given folder */
async function projEntries(id, dir) {
  const rec = await pdbGet('projects', id); if (!rec) throw new Error('song not found'); const enc = new TextEncoder(), files = [], arr = { format: 'the-daily-song', version: 1, app: BRAND.name + ' ' + VERSION, exported: new Date().toISOString(), id, origin: rec.origin || 'blank', created: rec.created, modified: rec.modified, zoom: rec.zoom || 'song', song: rec.song, takes: [], track: null, lanes: CFG.lanes || null };
  for (const m of rec.takes || []) {
    const k = id + '/take/' + m.id + '/', dry = await pdbGet('blobs', k + 'dry'); if (!dry) continue; const base = slug(m.name), e = Object.assign({}, m, { files: { dry: 'audio/' + base + (m.hasWet ? '-dry' : '') + '.wav' } });
    files.push({ name: dir + e.files.dry, data: wavI16(dry, m.sr) });
    if (m.hasWet) { const wet = await pdbGet('blobs', k + 'wet'); if (wet) { e.files.wet = 'audio/' + base + '-wet.wav'; files.push({ name: dir + e.files.wet, data: wavI16(wet, m.sr) }); } }
    if (m.hasCam) { const cam = await pdbGet('blobs', k + 'cam'); if (cam) { e.files.cam = 'audio/' + base + '-fret-log.json'; files.push({ name: dir + e.files.cam, data: enc.encode(cam) }); } }
    arr.takes.push(e);
  }
  if (rec.track) { const b = await pdbGet('blobs', id + '/track'); if (b) { const ext = (String(b.name).match(/\.[A-Za-z0-9]+$/) || ['.m4a'])[0], fn = 'audio/track' + ext; files.push({ name: dir + fn, data: new Uint8Array(b.buf) }); arr.track = Object.assign({}, rec.track, { file: fn }); } }
  files.unshift({ name: dir + 'song.md', data: enc.encode(songMarkdown(rec.song, rec)) }, { name: dir + 'arrangement.json', data: enc.encode(JSON.stringify(arr, null, 1)) });
  return files;
}
async function projExport(id) {
  try {
    if (id === PRJ.cur) await projSave(); const rec = await pdbGet('projects', id); toast('Packing “' + (rec.title || 'song') + '”…');
    const blob = zipBuild(await projEntries(id, '')); download(slug(rec.title) + '.daily-song.zip', blob, 'application/zip'); toast('Song bundle saved (' + projBytes(blob.size) + ')', 'ok'); CFG.lastBackup = Date.now(); saveCfg();
  } catch (e) { console.warn(e); toast('Could not export: ' + (e.message || e), 'bad'); }
}
async function projExportAll() {
  try {
    await projSave(); toast('Packing ' + PRJ.list.length + ' songs…'); let files = []; const seen = {};
    for (const r of PRJ.list) { let d = slug(r.title); if (seen[d]) d += '-' + r.id.slice(-4); seen[d] = 1; files = files.concat(await projEntries(r.id, 'songs/' + d + '/')); }
    const blob = zipBuild(files); download('the-daily.studio-backup-' + new Date().toISOString().slice(0, 10) + '.zip', blob, 'application/zip'); toast('Backup saved (' + projBytes(blob.size) + ')', 'ok'); CFG.lastBackup = Date.now(); saveCfg(); return true;
  } catch (e) { console.warn(e); toast('Could not back up: ' + (e.message || e), 'bad'); return false; }
}
/** a .daily-song.zip (or a backup of several), a lyric sheet (.txt/.md/.lrc) or an older project .json */
async function projImport(file) {
  try {
    const nm = file.name || '';
    if (/\.(txt|md|lrc)$/i.test(nm)) { liOpen(await file.text()); return; }
    if (/\.json$/i.test(nm)) {
      const d = JSON.parse(await file.text()), s = d.song || d; if (!s || !Array.isArray(s.sections)) throw new Error('this JSON has no song in it');
      await projCreate('import', { song: s, zoom: 'song' }); if (d.rig) try { rigApply(d.rig); } catch (e) { } toast('Imported “' + S.title + '”', 'ok'); return;
    }
    const z = await zipRead(file), arrs = [...z.keys()].filter(k => /(^|\/)arrangement\.json$/.test(k)); if (!arrs.length) throw new Error('no song found in this zip');
    let last = null; const dec = new TextDecoder();
    for (const ak of arrs) {
      const pre = ak.slice(0, ak.length - 'arrangement.json'.length), arr = JSON.parse(dec.decode(await z.get(ak).get())), id = projId(); if (!arr.song) continue;
      const rec = { id, v: 1, origin: 'import', created: Date.now(), modified: Date.now(), zoom: arr.zoom || 'song', song: normSong(arr.song), takes: [], track: null }; let bytes = 0;
      for (const m of arr.takes || []) {
        const f = m.files && z.get(pre + m.files.dry); if (!f) continue; const w = wavParse(await f.get()), k = id + '/take/' + m.id + '/', meta = Object.assign({}, m); delete meta.files; meta.sr = w.sr; meta.hasWet = false;
        await pdbPut('blobs', w.i16, k + 'dry'); bytes += w.i16.length * 2;
        if (m.files.wet && z.get(pre + m.files.wet)) { const ww = wavParse(await z.get(pre + m.files.wet).get()); await pdbPut('blobs', ww.i16, k + 'wet'); meta.hasWet = true; bytes += ww.i16.length * 2; }
        if (m.files.cam && z.get(pre + m.files.cam)) { await pdbPut('blobs', dec.decode(await z.get(pre + m.files.cam).get()), k + 'cam'); meta.hasCam = true; } else meta.hasCam = false;
        rec.takes.push(meta);
      }
      if (arr.track && arr.track.file && z.get(pre + arr.track.file)) { const u = await z.get(pre + arr.track.file).get(), buf = u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength); await pdbPut('blobs', { buf, type: arr.track.type || 'audio/mp4', name: arr.track.fileName || 'track' }, id + '/track'); rec.track = { name: arr.track.name, title: arr.track.title, artist: arr.track.artist, dur: arr.track.dur, fileName: arr.track.fileName || 'track', type: arr.track.type || 'audio/mp4', bytes: buf.byteLength }; bytes += buf.byteLength; }
      rec.title = rec.song.title || 'Untitled'; rec.artist = rec.song.artist || ''; rec.size = bytes; rec.nTakes = rec.takes.length; await pdbPut('projects', rec); last = id;
    }
    await projRefresh(); bus.emit('projects'); if (last) { await projLoad(last); toast('Imported “' + S.title + '”' + (arrs.length > 1 ? ' (and ' + (arrs.length - 1) + ' more in the library)' : ''), 'ok'); }
  } catch (e) { console.warn(e); toast('Import failed: ' + (e.message || e), 'bad'); }
}

/* ---------- start-up ---------- */
async function projInit() {
  PRJ.db = await pdbOpen(); PRJ.ok = !!PRJ.db;
  if (!PRJ.ok) { PRJ.ready = true; bus.emit('projects'); if (PRJ.wantStart) startMaybe(); return; }
  await projRefresh();
  const cur = store.get('cur', null), loc = store.get('song', null), locAt = store.get('songAt', 0), hasLoc = loc && Array.isArray(loc.sections) && loc.sections.length;
  let rec = cur && PRJ.list.find(r => r.id === cur);
  if (!rec && !PRJ.list.length && hasLoc) await projAdoptCurrent();              // upgrade: the single autosaved song becomes the first project
  else if (!rec && PRJ.list.length) await projLoad(PRJ.list[0].id, { keepZoom: true });
  else if (rec) { if (hasLoc && locAt > rec.modified + 1500) rec = Object.assign({}, rec, { song: loc }); await projLoad(rec.id, { rec, keepZoom: true }); }
  PRJ.ready = true; bus.emit('projects'); if (PRJ.wantStart) startMaybe(); projPersist(); projNudge();
}
bus.on('song', projDirty); bus.on('takes', projDirty); bus.on('track', projDirty);
document.addEventListener('visibilitychange', () => { if (document.hidden && !store.locked) { try { store.set('song', S); store.set('songAt', Date.now()); } catch (e) { } projSave(); } });
window.addEventListener('pagehide', () => { if (!store.locked) projSave(); });
