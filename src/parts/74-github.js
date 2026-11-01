/* ============================================================
   Part 74 · YOUR STUDIO ON GITHUB (2.21) — your settings, presets, looks, notes and songs in a repository of your own
   Nothing here runs until you connect. Then the studio keeps a private repository in YOUR GitHub account (my-daily-studio by default)
   in step with this browser, so another computer or phone that connects to the same repository gets the same studio.
     · what goes up: settings (not this device's own: its audio devices, input levels, layout, measured latency, monitoring, consent
       to downloads), rig presets, stage looks and scenes, lesson notes and the notebook, and songs as text (chords, words, tab,
       arrangement). Recordings, backing tracks, stems, pictures and videos stay on the device: the repository stays small, far
       inside GitHub's limits (files under 100 MB, repositories under about 1 GB), and every song has a history in Git.
     · how: one commit per sync through GitHub's Git Data API (read the head, write a tree with the changed files in it, a commit,
       move the branch), so a sync is a handful of requests however many files changed. Changes on both sides are merged:
       settings key by key (yours win where both changed), and a song changed in both places keeps both versions.
     · deletions are careful: a song deleted here is removed from the repository; a song deleted elsewhere is kept here (and its
       history stays in Git) until you remove it.
     · signing in: paste a fine-grained token for that one repository (no server involved), or Sign in with GitHub where the site
       has its GitHub App set up (worker/index.mjs swaps GitHub's sign-in code for a token; it never sees your songs).
     · sharing (optional): chosen looks and rigs go to a separate PUBLIC repository (daily-studio-shared) tagged the-daily-studio,
       and the community gallery lists everyone's, so a look can be tried and kept. Nothing from your private repository is shared.
   The browser talks to api.github.com directly; this site's server never sees your data. The token stays in this browser
   (fw.ghtok), is never written to the repository, and Disconnect removes it.
   ============================================================ */
const GH_API = 'https://api.github.com', GH_TOPIC = 'the-daily-studio', GH_SHARED = 'daily-studio-shared', GH_MAXFILE = 5e6;
CFG.gh = Object.assign({ owner: '', repo: 'my-daily-studio', login: '', auto: true, last: null, lastAt: 0, shared: '', gone: [] }, CFG.gh && typeof CFG.gh === 'object' ? CFG.gh : {});
const GH = { busy: null, again: false, timer: 0, status: '', err: '', rate: null, app: null, el: null, quiet: false };
/* settings that belong to this device, not to you: they are never sent, and never taken from the repository */
const GH_SKIP = new Set(['gh', 'inDev', 'outDev', 'camDev', 'rtt', 'sr', 'hint', 'autoIn', 'persistAsked', 'layout', 'lanes', 'zoom', 'form', 'vbg', 'mpOk', 'lastBackup', 'ioLeveled', 'gTrim', 'voxTrim', 'ch', 'vin', 'monitor', 'voxMon', 'recQ', 'vq', 'ui', 'kpad', 'show', 'stage', 'sync']);
const ghTok = () => store.get('ghtok', null);
const ghOn = () => !!(ghTok() && CFG.gh.owner && CFG.gh.repo);

/* ---------- small helpers ---------- */
const ghErr = (code, message, status) => Object.assign(new Error(message), { code, status });
const ghSort = v => Array.isArray(v) ? v.map(ghSort) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => { if (v[k] !== undefined) o[k] = ghSort(v[k]); return o; }, {}) : v;
/** the same data always gives the same text, on every device: sorted keys, one space of indent */
const ghJson = v => JSON.stringify(ghSort(v), null, 1) + '\n';
const ghB64 = s => { const u = new TextEncoder().encode(s); let b = ''; for (let i = 0; i < u.length; i += 0x8000) b += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(b); };
const ghUnb64 = b => { const s = atob(String(b || '').replace(/\s/g, '')), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new TextDecoder().decode(u); };
/** a file's Git blob id: SHA-1 of "blob <length>\0<bytes>", the id GitHub's tree lists, so a file can be compared without downloading it */
async function ghSha(text) {
  const u = new TextEncoder().encode(text), head = new TextEncoder().encode('blob ' + u.length + '\0'), all = new Uint8Array(head.length + u.length); all.set(head); all.set(u, head.length);
  const d = new Uint8Array(await crypto.subtle.digest('SHA-1', all)); return [...d].map(x => x.toString(16).padStart(2, '0')).join('');
}
const ghSame = (a, b) => JSON.stringify(ghSort(a)) === JSON.stringify(ghSort(b));

/* ---------- the token: pasted, or from Sign in with GitHub (which expires every few hours and is renewed through the site) ---------- */
async function ghToken() {
  const t = ghTok(); if (!t) return null;
  if (t.via === 'app' && t.exp && Date.now() > t.exp - 60000 && t.r) {
    try {
      const r = await fetch('/auth/github/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ r: t.r }), cache: 'no-store' }), j = await r.json();
      if (!r.ok || !j.t) throw new Error(j.error || 'refresh');
      store.set('ghtok', Object.assign({}, t, j, { via: 'app' }));
      return j.t;
    } catch (e) { throw ghErr('auth', 'Your GitHub sign-in has run out. Sign in again (Settings ▸ GitHub).'); }
  }
  return t.t;
}
/** one call to GitHub's API, with errors a person can act on */
async function ghApi(method, path, body, o = {}) {
  const tok = o.anon ? null : await ghToken(); if (!tok && !o.anon) throw ghErr('signin', 'Not connected to GitHub.');
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }; if (tok) headers.Authorization = 'Bearer ' + tok; if (body) headers['Content-Type'] = 'application/json';
  let r; try { r = await fetch(GH_API + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); } catch (e) { throw ghErr('offline', 'GitHub could not be reached. Are you online?'); }
  GH.rate = { left: +(r.headers.get('x-ratelimit-remaining') || -1), reset: +(r.headers.get('x-ratelimit-reset') || 0) };
  if (r.status === 204) return null;
  const j = await r.json().catch(() => null); if (r.ok) return j;
  const msg = (j && j.message) || r.statusText || ('HTTP ' + r.status);
  if (r.status === 401) throw ghErr('auth', 'GitHub did not accept the token: it may have expired or been revoked.', 401);
  if ((r.status === 403 || r.status === 429) && (GH.rate.left === 0 || /rate limit/i.test(msg))) throw ghErr('rate', 'GitHub’s limit for this hour is used up. Sync will work again after ' + (GH.rate.reset ? new Date(GH.rate.reset * 1000).toLocaleTimeString() : 'a while') + '.', r.status);
  throw ghErr(r.status === 404 ? 'missing' : r.status === 409 ? 'empty' : r.status === 422 ? 'conflict' : r.status === 403 ? 'denied' : 'http', msg, r.status);
}
const ghRepoPath = (o, r) => '/repos/' + encodeURIComponent(o || CFG.gh.owner) + '/' + encodeURIComponent(r || CFG.gh.repo);

/* ---------- the repository: read every file's id, read one file, write many in one commit ---------- */
async function ghHead(o, r) {
  const repo = await ghApi('GET', ghRepoPath(o, r)), br = repo.default_branch || 'main';
  let ref; try { ref = await ghApi('GET', ghRepoPath(o, r) + '/git/ref/heads/' + encodeURIComponent(br)); }
  catch (e) { if (e.code === 'empty' || e.code === 'missing') return { br, head: null, files: {}, repo }; throw e; }
  const head = ref.object.sha, c = await ghApi('GET', ghRepoPath(o, r) + '/git/commits/' + head), t = await ghApi('GET', ghRepoPath(o, r) + '/git/trees/' + c.tree.sha + '?recursive=1'), files = {};
  (t.tree || []).forEach(e => { if (e.type === 'blob') files[e.path] = { sha: e.sha, size: e.size || 0 }; });
  return { br, head, tree: c.tree.sha, files, repo, truncated: !!t.truncated };
}
async function ghBlob(sha, o, r) { const b = await ghApi('GET', ghRepoPath(o, r) + '/git/blobs/' + sha); return b.encoding === 'base64' ? ghUnb64(b.content) : String(b.content || ''); }
/** write files ({path: text, or null to delete}) as one commit on top of `at` (the head this sync read); an empty repository gets its first file first */
async function ghCommit(at, changes, message, o, r) {
  const P = ghRepoPath(o, r), list = Object.entries(changes); if (!list.length) return at.head;
  if (!at.head) {      /* a repository with no commit yet: the first file goes in through the contents API, which can start a history */
    const first = list.find(([, v]) => v != null) || ['README.md', '# the-daily.studio\n'];
    const res = await ghApi('PUT', P + '/contents/' + first[0].split('/').map(encodeURIComponent).join('/'), { message, content: ghB64(first[1]) });
    const rest = list.filter(([k]) => k !== first[0]); const nh = await ghHead(o, r); return rest.length ? ghCommit(nh, Object.fromEntries(rest), message, o, r) : (res && res.commit && res.commit.sha) || nh.head;
  }
  const tree = await ghApi('POST', P + '/git/trees', { base_tree: at.tree, tree: list.map(([path, txt]) => txt == null ? { path, mode: '100644', type: 'blob', sha: null } : { path, mode: '100644', type: 'blob', content: txt }) });
  const c = await ghApi('POST', P + '/git/commits', { message, tree: tree.sha, parents: [at.head] });
  await ghApi('PATCH', P + '/git/refs/heads/' + encodeURIComponent(at.br), { sha: c.sha, force: false });
  return c.sha;
}

/* ---------- what this studio is, as files ---------- */
function ghSettingsOut() { const o = {}; Object.keys(CFG).forEach(k => { if (!GH_SKIP.has(k) && typeof CFG[k] !== 'function') o[k] = CFG[k]; }); return o; }
const ghLooksOut = () => { const s = Object.assign({}, CFG.show || {}); delete s.imgs; return s; };       /* the stage's pictures stay on the device */
/* no save time in the file: saving a song that did not change would make it look changed, and send it again */
const ghSongOut = rec => ({ format: 'the-daily-song-text', version: 1, id: rec.id, title: rec.title || 'Untitled', artist: rec.artist || '', created: rec.created || 0, origin: rec.origin || 'blank', zoom: rec.zoom || 'song', song: rec.song, recordings: (rec.takes || []).length });
/** a song worth keeping: something written or recorded in it, or a name of its own; never the built-in demo */
const ghSongKeep = rec => {
  if (!rec || !rec.song || /\(demo\)\s*$/i.test(rec.song.title || rec.title || '')) return false;
  const s = rec.song; return (rec.takes || []).length > 0 || !/^(untitled( idea)?|new song|)$/i.test(String(s.title || '').trim()) || (s.sections || []).some(x => (x.lyrics || '').trim() || (x.bars || []).some(b => b.chord || (b.tab && b.tab.length)));
};
async function ghLocal() {
  try { await projSave(); } catch (e) { }
  const f = {}, songs = [];
  f['studio.json'] = ghJson({ format: 'the-daily-studio', schema: 1, about: 'This repository is a the-daily.studio studio: settings, presets, looks, notes and songs as text. It is kept in step by the app; edit with care.' });
  f['settings.json'] = ghJson({ format: 'the-daily-studio-settings', version: 1, settings: ghSettingsOut() });
  f['rig/presets.json'] = ghJson({ format: 'the-daily-studio-presets', version: 1, presets: store.get('presets', []) });
  f['stage/looks.json'] = ghJson({ format: 'the-daily-studio-looks', version: 1, show: ghLooksOut() });
  f['stage/scenes.json'] = ghJson({ format: 'the-daily-studio-scenes', version: 1, stage: CFG.stage || STG });
  f['notes.json'] = ghJson({ format: 'the-daily-studio-notes', version: 1, lessons: store.get('lessons', {}), notebook: store.get('notebook', null) });
  const gone = new Set(CFG.gh.gone || []);
  for (const r of PRJ.list) { let rec = r; if (!rec.song) { try { rec = await pdbGet('projects', r.id); } catch (e) { continue; } } if (!ghSongKeep(rec) || gone.has(rec.id)) continue; const t = ghJson(ghSongOut(rec)); if (t.length > GH_MAXFILE) continue; f['songs/' + rec.id + '.json'] = t; songs.push(rec); }
  songs.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  f['README.md'] = '# My the-daily.studio\n\nKept in step by [the-daily.studio](https://the-daily.studio/) (Settings ▸ GitHub). Recordings and backing tracks stay on the devices that made them; everything else is here, with its history.\n\n## Songs\n\n' + (songs.length ? songs.map(s => '- **' + String(s.title || 'Untitled').replace(/[*_`<>[\]]/g, '') + '**' + (s.artist ? ' · ' + String(s.artist).replace(/[*_`<>[\]]/g, '') : '') + ' — `songs/' + s.id + '.json`').join('\n') : '_None yet._') + '\n';
  return f;
}
/* ---------- taking files in ---------- */
const ghParse = t => { try { return JSON.parse(t); } catch (e) { return null; } };
/** key by key: where this device did not change a setting since the last sync, the repository's wins; where it did, it stays */
function ghMerge3(local, remote, base) {
  const out = {}; new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]).forEach(k => {
    const l = (local || {})[k], r = (remote || {})[k], b = base ? base[k] : undefined;
    out[k] = !base ? (k in (remote || {}) ? r : l) : ghSame(l, b) ? r : ghSame(r, b) ? l : l; if (out[k] === undefined) delete out[k];
  }); return out;
}
async function ghTakeSettings(remote, baseTxt) {
  const R = (ghParse(remote) || {}).settings || {}, B = baseTxt ? (ghParse(baseTxt) || {}).settings : null, L = ghSettingsOut(), M = ghMerge3(L, R, B);
  let changed = false; Object.keys(M).forEach(k => { if (GH_SKIP.has(k)) return; if (!ghSame(CFG[k], M[k])) { CFG[k] = M[k]; changed = true; } });
  if (changed) { saveCfg(); try { applyAppearance(); } catch (e) { } bus.emit('look'); }
  return changed;
}
async function ghTakeLooks(remote, baseTxt) {
  const R = (ghParse(remote) || {}).show || {}, B = baseTxt ? (ghParse(baseTxt) || {}).show : null, M = ghMerge3(ghLooksOut(), R, B), imgs = (CFG.show && CFG.show.imgs) || [];
  if (!ghSame(ghLooksOut(), M)) { CFG.show = Object.assign({}, M, { imgs }); if (Array.isArray(CFG.show.saved)) CFG.show.saved = CFG.show.saved.map(l => { const c = shClean(l); if (c && typeof l.id === 'string' && /^[\w-]{1,40}$/.test(l.id)) c.id = l.id; return c; }).filter(Boolean); saveCfg(); bus.emit('show'); return true; } return false;      /* a look keeps its id, or two devices would trade the same looks back and forth */
}
async function ghTakeScenes(remote) { const R = (ghParse(remote) || {}).stage; if (R && Array.isArray(R.scenes) && !ghSame(CFG.stage, R)) { CFG.stage = R; Object.assign(STG, R); saveCfg(); try { renderStageUI(); } catch (e) { } return true; } return false; }
async function ghTakePresets(remote) { const R = (ghParse(remote) || {}).presets; if (Array.isArray(R)) { const clean = R.map(rigClean).filter(Boolean); if (!ghSame(store.get('presets', []), clean)) { store.set('presets', clean); try { renderTones(); } catch (e) { } return true; } } return false; }
async function ghTakeNotes(remote) { const R = ghParse(remote) || {}; let ch = false; if (R.lessons && typeof R.lessons === 'object' && !ghSame(store.get('lessons', {}), R.lessons)) { store.set('lessons', R.lessons); ch = true; } if (R.notebook != null && !ghSame(store.get('notebook', null), R.notebook)) { store.set('notebook', R.notebook); ch = true; } return ch; }
/** a song from the repository into this browser's library (its recordings, if this device has any, are kept) */
async function ghTakeSong(text, asCopy) {
  const d = ghParse(text); if (!d || !d.song || !Array.isArray(d.song.sections)) return null;
  const id = asCopy ? projId() : String(d.id || '').replace(/[^\w-]/g, '') || projId(), old = asCopy ? null : await pdbGet('projects', id);
  const rec = Object.assign({ takes: [], track: null, stemMix: null, size: 0, nTakes: 0 }, old || {}, { id, v: 1, origin: d.origin || 'github', created: d.created || Date.now(), modified: Date.now(), zoom: d.zoom || 'song', song: normSong(d.song) });
  if (asCopy) { rec.song.title = (d.title || 'Untitled') + ' (from another device)'; }
  rec.title = rec.song.title || d.title || 'Untitled'; rec.artist = rec.song.artist || d.artist || '';
  await pdbPut('projects', rec);
  if (!asCopy && PRJ.cur === id) { try { await projLoad(id); } catch (e) { } }
  return rec;
}

/* ---------- one sync: read both sides, decide file by file, take what came in, send what changed, remember where we are ---------- */
const GH_KIND = p => p === 'settings.json' ? 'settings' : p === 'stage/looks.json' ? 'looks' : p === 'stage/scenes.json' ? 'scenes' : p === 'rig/presets.json' ? 'presets' : p === 'notes.json' ? 'notes' : /^songs\/[\w-]+\.json$/.test(p) ? 'song' : p === 'README.md' || p === 'studio.json' ? 'generated' : 'other';
const ghBaseGet = async p => { try { return await pdbGet('blobs', 'gh/base/' + p); } catch (e) { return null; } };
const ghBaseSet = async (p, t) => { try { if (t == null) await pdbDel('blobs', 'gh/base/' + p); else await pdbPut('blobs', t, 'gh/base/' + p); } catch (e) { } };
async function ghSync(why) {
  if (!ghOn()) return null;
  if (GH.busy) { GH.again = true; return GH.busy; }
  GH.busy = (async () => {
    ghStatus('Syncing…'); let report = null;
    try { report = await ghSyncOnce(why); }
    catch (e) {
      if (e.code === 'conflict') { try { report = await ghSyncOnce(why); } catch (e2) { GH.err = e2.message; } }      /* someone pushed while we did: read again and retry once */
      else GH.err = e.message;
      if (GH.err) { ghStatus('Not synced: ' + GH.err, true); console.warn('[github]', GH.err); }
    }
    finally { GH.busy = null; if (GH.again) { GH.again = false; setTimeout(() => ghSync('again'), 50); } }
    return report;
  })();
  return GH.busy;
}
async function ghSyncOnce(why) {
  GH.err = ''; for (let i = 0; i < 60 && !PRJ.ready; i++) await new Promise(r => setTimeout(r, 250));      /* the library first */
  if (why === 'auto' && CFG.gh.last && CFG.gh.last.files) {      /* a change here that changed nothing GitHub holds: no need to ask */
    const lf = await ghLocal(), last = CFG.gh.last.files; let same = true;
    for (const [p, t] of Object.entries(lf)) { if (GH_KIND(p) === 'generated') continue; if (last[p] !== await ghSha(t)) { same = false; break; } }
    if (same && !Object.keys(last).some(p => GH_KIND(p) === 'song' && !lf[p])) { ghStatus('In step with GitHub · ' + new Date().toLocaleTimeString()); return { took: [], sent: 0, copies: 0, gone: 0, skipped: true }; }
  }
  const at = await ghHead(), last = (CFG.gh.last && CFG.gh.last.files) || {}, local = await ghLocal(), rep = { took: [], sent: 0, copies: 0, gone: 0 };
  const lsha = {}; for (const [p, t] of Object.entries(local)) lsha[p] = await ghSha(t);
  const paths = new Set([...Object.keys(local), ...Object.keys(at.files), ...Object.keys(last)]);
  const gone = new Set(CFG.gh.gone || []);
  for (const p of paths) {
    const k = GH_KIND(p); if (k === 'other' || k === 'generated') continue;
    const r = at.files[p] && at.files[p].sha, l = lsha[p], b = last[p];
    if (r === l || !r || r === b) continue;                     /* in step; or only this side changed (sent below) */
    if (at.files[p].size > GH_MAXFILE) continue;
    const rt = await ghBlob(r);
    if (k === 'song') {
      const id = p.slice(6, -5);
      if (!l || l === b) { if (gone.has(id)) { gone.delete(id); } await ghTakeSong(rt); rep.took.push(p); }       /* changed only there (or new there): take it */
      else { await ghTakeSong(rt, true); rep.copies++; rep.took.push(p); }                                          /* changed on both sides: keep both */
      continue;
    }
    const bt = l === b || b ? await ghBaseGet(p) : null;
    const ch = k === 'settings' ? await ghTakeSettings(rt, b ? bt : null) : k === 'looks' ? await ghTakeLooks(rt, b ? bt : null) : k === 'scenes' ? (l === b || !b ? await ghTakeScenes(rt) : false) : k === 'presets' ? (l === b || !b ? await ghTakePresets(rt) : false) : k === 'notes' ? (l === b || !b ? await ghTakeNotes(rt) : false) : false;
    if (ch) rep.took.push(p);
  }
  /* songs deleted elsewhere: kept here, not sent back, until changed or removed here */
  for (const p of Object.keys(last)) if (GH_KIND(p) === 'song' && !at.files[p] && local[p] && lsha[p] === last[p]) { gone.add(p.slice(6, -5)); rep.gone++; }
  CFG.gh.gone = [...gone];
  if (rep.took.length) await projRefresh();
  /* what this side now holds, against the repository */
  const now = await ghLocal(), send = {}, nsha = {};
  for (const [p, t] of Object.entries(now)) { nsha[p] = await ghSha(t); if (!at.files[p] || at.files[p].sha !== nsha[p]) send[p] = t; }
  for (const p of Object.keys(last)) if (GH_KIND(p) === 'song' && !now[p] && at.files[p] && at.files[p].sha === last[p] && !gone.has(p.slice(6, -5))) send[p] = null;     /* deleted here, unchanged there */
  /* only README changing on its own is not worth a commit */
  const real = Object.keys(send).filter(p => p !== 'README.md' && p !== 'studio.json');
  let head = at.head;
  if (real.length || !at.head || !at.files['studio.json']) { head = await ghCommit(at, send, 'the-daily.studio: ' + (why === 'connect' ? 'first sync' : 'sync') + ' (' + real.length + ' file' + (real.length === 1 ? '' : 's') + ')'); rep.sent = real.length; }
  const files = {}; for (const [p, s] of Object.entries(nsha)) if (send[p] !== null) files[p] = s;
  for (const p of Object.keys(files)) { const k = GH_KIND(p); if (k !== 'generated') await ghBaseSet(p, now[p]); }
  for (const p of Object.keys(last)) if (!files[p]) await ghBaseSet(p, null);
  CFG.gh.last = { head, files }; CFG.gh.lastAt = Date.now(); GH.quiet = true; try { saveCfg(); } finally { GH.quiet = false; }
  ghStatus('In step with GitHub · ' + new Date().toLocaleTimeString() + (rep.took.length ? ' · ' + rep.took.length + ' came in' : '') + (rep.sent ? ' · ' + rep.sent + ' sent' : '') + (rep.copies ? ' · ' + rep.copies + ' song' + (rep.copies === 1 ? '' : 's') + ' kept in both versions' : ''));
  if (rep.copies) toast(rep.copies + (rep.copies === 1 ? ' song was' : ' songs were') + ' changed here and on another device, so both versions are kept (“… (from another device)”).', 'warn');
  bus.emit('github', rep); return rep;
}
/** after a change, sync in a little while (many quick changes become one commit); a settings change waits a little longer */
function ghKick(ms) { if (!ghOn() || CFG.gh.auto === false || GH.quiet) return; if (GH.timer && !ms) clearTimeout(GH.timer); else if (GH.timer) return; GH.timer = setTimeout(() => { GH.timer = 0; ghSync('auto'); }, ms || 20000); }
/** saveCfg calls this: settings changed */
function ghCfgKick() { if (!GH.quiet && !GH.busy) ghKick(45000); }
/** at start-up: back from Sign in with GitHub, or a sync once the library is loaded */
function ghBoot() { if (ghReturn()) return; if (ghOn() && CFG.gh.auto !== false) setTimeout(() => ghSync('open'), 1500); }
bus.on('projects', ghKick);
document.addEventListener('visibilitychange', () => { if (!document.hidden && ghOn() && CFG.gh.auto !== false && Date.now() - (CFG.gh.lastAt || 0) > 120000) ghSync('back'); });
function ghStatus(t, bad) { GH.status = t; GH.bad = !!bad; const s = document.getElementById('ghStatus'); if (s) { s.textContent = t; s.style.color = bad ? 'var(--bad)' : ''; } }

/* ---------- connecting ---------- */
/** the token is checked, the repository found (or made, private), and the first sync run */
async function ghConnect(token, repo) {
  repo = String(repo || CFG.gh.repo || 'my-daily-studio').trim().replace(/[^\w.-]/g, '-').slice(0, 90) || 'my-daily-studio';
  if (token) store.set('ghtok', { t: String(token).trim(), via: 'token' });
  if (!ghTok()) throw ghErr('signin', 'Paste a token, or sign in with GitHub.');
  const me = await ghApi('GET', '/user'); CFG.gh.login = me.login; CFG.gh.owner = me.login; CFG.gh.repo = repo;
  try { await ghApi('GET', ghRepoPath()); }
  catch (e) {
    if (e.code !== 'missing') throw e;
    try { await ghApi('POST', '/user/repos', { name: repo, private: true, auto_init: true, description: 'My the-daily.studio: settings, presets, looks, notes and songs (kept in step by the app)' }); }
    catch (e2) { throw ghErr('create', 'The repository “' + repo + '” is not there and this sign-in cannot create it. Create it on GitHub (private), give the token or the app access to it, then press Connect again.'); }
  }
  CFG.gh.last = null; CFG.gh.gone = []; saveCfg(); return ghSync('connect');
}
function ghDisconnect() { store.set('ghtok', null); try { localStorage.removeItem('fw.ghtok'); } catch (e) { } CFG.gh.last = null; CFG.gh.owner = ''; CFG.gh.login = ''; saveCfg(); ghStatus('Not connected.'); bus.emit('github', null); }
/** is Sign in with GitHub set up on this site? BRAND.ghApp holds the GitHub App's public client id (part 01); the secret stays in the site's worker */
const ghApp = () => BRAND.ghApp && BRAND.ghApp.clientId ? BRAND.ghApp : null;
function ghSignIn() {
  const app = ghApp(); if (!app) return; const st = [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, '0')).join('');
  try { sessionStorage.setItem('fw.ghState', st); sessionStorage.setItem('fw.ghRepo', CFG.gh.repo || 'my-daily-studio'); } catch (e) { }
  location.href = 'https://github.com/login/oauth/authorize?client_id=' + encodeURIComponent(app.clientId) + '&redirect_uri=' + encodeURIComponent(location.origin + '/auth/github/callback') + '&state=' + st;
}
/** back from GitHub: the site's worker put the sign-in in the address after # (never sent to any server); it is checked and cleared at once */
function ghReturn() {
  const m = /^#gh(-error)?=([^&]*)/.exec(location.hash || ''); if (!m) return false;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
  if (m[1]) { setTimeout(() => toast('GitHub sign-in did not finish (' + decodeURIComponent(m[2]) + ').', 'warn'), 400); return true; }
  let d = null, st = null; try { d = JSON.parse(ghUnb64(m[2].replace(/-/g, '+').replace(/_/g, '/'))); st = sessionStorage.getItem('fw.ghState'); sessionStorage.removeItem('fw.ghState'); } catch (e) { }
  if (!d || !d.t || !st || d.state !== st) { setTimeout(() => toast('That GitHub sign-in could not be checked, so it was not used. Try again from Settings ▸ GitHub.', 'warn'), 400); return true; }
  store.set('ghtok', { t: d.t, r: d.r || '', exp: d.exp || 0, rexp: d.rexp || 0, via: 'app' });
  let repo = null; try { repo = sessionStorage.getItem('fw.ghRepo'); } catch (e) { }
  setTimeout(() => ghConnect(null, repo).then(() => toast('Signed in with GitHub. Your studio is in step.', 'ok')).catch(e => { ghStatus(e.message, true); try { openSettings('github'); } catch (x) { } }), 300);
  return true;
}

/* ---------- sharing looks and rigs, and the community gallery ---------- */
/** a rig preset from anywhere, kept to what a preset can hold: a name, a line about it, and known units with known settings in range */
function rigClean(p) {
  if (!p || typeof p !== 'object') return null; const n = String(p.n || '').trim().slice(0, 40); if (!n) return null; const u = {};
  Object.keys(FX).forEach(id => { const x = p.u && p.u[id]; if (!x || typeof x !== 'object') return; const o = { on: x.on ? 1 : 0 };
    FX[id].params.forEach(q => { const v = x[q.k]; if (q.type === 'select') { if (q.opts.includes(v)) o[q.k] = v; } else if (q.type === 'toggle') { if (v != null) o[q.k] = v ? 1 : 0; } else if (typeof v === 'number' && isFinite(v)) o[q.k] = clamp(v, q.min, q.max); }); u[id] = o; });
  return { n, d: String(p.d || '').slice(0, 80), u };
}
/** put chosen looks and rigs in a public repository of their own, tagged so the gallery finds it */
async function ghShare(lookIds, presetNames) {
  if (!ghOn()) throw ghErr('signin', 'Connect GitHub first.');
  const name = CFG.gh.shared || GH_SHARED, owner = CFG.gh.login;
  try { await ghApi('GET', ghRepoPath(owner, name)); }
  catch (e) { if (e.code !== 'missing') throw e; try { await ghApi('POST', '/user/repos', { name, private: false, auto_init: true, description: 'Looks and rigs for the-daily.studio, shared by @' + owner }); } catch (e2) { throw ghErr('create', 'Create a PUBLIC repository named “' + name + '” on GitHub, give the token or the app access to it, then press Share again.'); } }
  const looks = ((CFG.show && CFG.show.saved) || []).filter(l => lookIds.includes(l.id)).map(l => ({ name: l.name, design: l.design, ovr: l.ovr })), rigs = store.get('presets', []).filter(p => presetNames.includes(p.n)).map(p => ({ n: p.n, d: p.d, u: p.u }));
  const at = await ghHead(owner, name);
  await ghCommit(at, { 'looks.json': ghJson({ format: 'the-daily-studio-looks', version: 1, looks }), 'rigs.json': ghJson({ format: 'the-daily-studio-presets', version: 1, presets: rigs }), 'README.md': '# Looks and rigs for the-daily.studio\n\nShared by @' + owner + ' from [the-daily.studio](https://the-daily.studio/). Anyone may try them and keep them in their own studio (Visuals ▸ Show setup, or Settings ▸ GitHub ▸ Community).\n\n' + looks.map(l => '- Look: **' + String(l.name).replace(/[*_`<>[\]]/g, '') + '**').concat(rigs.map(p => '- Rig: **' + String(p.n).replace(/[*_`<>[\]]/g, '') + '**')).join('\n') + '\n' }, 'the-daily.studio: shared ' + looks.length + ' looks and ' + rigs.length + ' rigs', owner, name);
  try { await ghApi('PUT', ghRepoPath(owner, name) + '/topics', { names: [GH_TOPIC] }); } catch (e) { }
  CFG.gh.shared = name; saveCfg(); return { looks: looks.length, rigs: rigs.length, url: 'https://github.com/' + owner + '/' + name };
}
/** studios that share: GitHub's search for the topic (works without signing in, a few times a minute) */
async function ghGallery() {
  const j = await ghApi('GET', '/search/repositories?q=' + encodeURIComponent('topic:' + GH_TOPIC + ' fork:false') + '&sort=updated&per_page=30', null, { anon: !ghTok() });
  return { total: j.total_count || 0, items: (j.items || []).filter(x => x && x.owner && !x.private).map(x => ({ owner: String(x.owner.login), repo: String(x.name), desc: String(x.description || '').slice(0, 160), stars: x.stargazers_count || 0, updated: x.updated_at })) };
}
/** one shared studio's looks and rigs, made safe (only what a look or a preset can hold) */
async function ghGalleryOpen(owner, repo) {
  const get = async p => { try { const c = await ghApi('GET', ghRepoPath(owner, repo) + '/contents/' + p, null, { anon: !ghTok() }); return c && c.size <= 1e6 && c.content ? ghParse(ghUnb64(c.content)) : null; } catch (e) { return null; } };
  const L = await get('looks.json'), R = await get('rigs.json');
  return { looks: ((L && L.looks) || []).slice(0, 24).map(shClean).filter(Boolean), rigs: ((R && R.presets) || []).slice(0, 24).map(rigClean).filter(Boolean) };
}
function ghKeepLook(l, owner) { if (CFG.show.saved.length >= 24) return toast('Up to 24 saved looks. Delete one to keep another.', 'warn'); const tag = ' · @' + String(owner).slice(0, 39), c = shClean(Object.assign({}, l, { name: String(l.name).slice(0, Math.max(4, 40 - tag.length)) + tag })); if (!c) return; CFG.show.saved.push(c); saveCfg(); bus.emit('show'); toast('Kept the look “' + c.name + '” (Visuals ▸ Show setup ▸ Looks).', 'ok'); }
function ghKeepRig(p, owner) { const c = rigClean(Object.assign({}, p, { n: String(p.n).slice(0, 28) + ' · @' + owner })); if (!c) return; const a = store.get('presets', []).filter(x => x.n !== c.n); a.push(c); store.set('presets', a); try { renderTones(); } catch (e) { } toast('Kept the rig “' + c.n + '” (Tones ▸ presets).', 'ok'); }

/* ---------- the GitHub section in Settings, and its dialogs ---------- */
function ghSection() {
  const box = h('div', { class: 'gh-sec', id: 'ghSec' }); GH.el = box; ghPaint(); return box;
}
function ghPaint() {
  const box = GH.el; if (!box || !box.isConnected && box.parentNode) return; box.innerHTML = ''; const on = ghOn();
  box.append(h('div', { class: 'tiny', id: 'ghStatus', style: { color: GH.bad ? 'var(--bad)' : '' } }, GH.status || (on ? 'Connected as @' + CFG.gh.login + ' · ' + CFG.gh.owner + '/' + CFG.gh.repo + (CFG.gh.lastAt ? ' · last in step ' + new Date(CFG.gh.lastAt).toLocaleString() : '') : 'Not connected. Nothing goes to GitHub until you connect.')));
  const add = (...xs) => box.append(...xs.filter(Boolean));      /* an optional line that is not there adds nothing (append would write "null") */
  if (on) add(h('div', { class: 'hub-acts' },
    h('button', { class: 'btn primary', id: 'ghSyncNow', onclick: async () => { await ghSync('button'); ghPaint(); } }, '⟳ Sync now'),
    h('a', { class: 'btn', href: 'https://github.com/' + CFG.gh.owner + '/' + CFG.gh.repo, target: '_blank', rel: 'noopener noreferrer' }, 'Open on GitHub ↗'),
    h('button', { class: 'btn', id: 'ghShareBtn', onclick: () => ghShareOpen() }, '⇪ Share looks and rigs'),
    h('button', { class: 'btn', id: 'ghOff', onclick: () => { ghDisconnect(); ghPaint(); } }, 'Disconnect')),
    h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'ghAuto', checked: CFG.gh.auto !== false, onchange: e => { CFG.gh.auto = e.target.checked; saveCfg(); } }), ' Keep in step by itself (a little after each change, and when you come back to the page)'),
    (CFG.gh.gone || []).length ? h('p', { class: 'tiny muted' }, (CFG.gh.gone.length === 1 ? 'One song' : CFG.gh.gone.length + ' songs') + ' removed on another device ' + (CFG.gh.gone.length === 1 ? 'is' : 'are') + ' still here and not sent back. Delete ' + (CFG.gh.gone.length === 1 ? 'it' : 'them') + ' here too, or change ' + (CFG.gh.gone.length === 1 ? 'it' : 'them') + ' to send ' + (CFG.gh.gone.length === 1 ? 'it' : 'them') + ' again.') : null);
  else add(h('div', { class: 'hub-acts' }, ghApp() ? h('button', { class: 'btn primary', id: 'ghSignIn', onclick: ghSignIn }, 'Sign in with GitHub') : null, h('button', { class: ghApp() ? 'btn' : 'btn primary', id: 'ghConnectBtn', onclick: () => ghConnectOpen() }, 'Connect with a token…')), ghApp() && ghApp().slug ? h('p', { class: 'tiny muted' }, 'After signing in, the app needs access to your studio repository: ', h('a', { href: 'https://github.com/apps/' + encodeURIComponent(ghApp().slug) + '/installations/new', target: '_blank', rel: 'noopener noreferrer' }, 'give it access on GitHub'), ' (choose only that repository).') : null);
  box.append(h('div', { class: 'hub-acts' }, h('button', { class: 'btn', id: 'ghGalleryBtn', onclick: () => ghGalleryShow() }, '◎ Community looks and rigs')));
  box.append(h('p', { class: 'hub-note' }, 'Your settings, rig presets, stage looks and scenes, notes and songs (as text) go to a private repository in your own GitHub account. Recordings, backing tracks, pictures and videos stay on this device. This device’s audio devices, levels and layout stay here too. Your browser talks to GitHub directly; this site never sees your data.'));
}
function ghConnectOpen() {
  const tok = h('input', { class: 'in', id: 'ghToken', type: 'password', autocomplete: 'off', spellcheck: false, placeholder: 'github_pat_…' }), repo = h('input', { class: 'in', id: 'ghRepo', value: CFG.gh.repo || 'my-daily-studio', maxlength: 90 });
  const msg = h('div', { class: 'tiny', id: 'ghConnectMsg', 'aria-live': 'polite' });
  const go = h('button', { class: 'btn primary', id: 'ghConnectGo', onclick: async () => { go.disabled = true; msg.textContent = 'Connecting…'; msg.style.color = ''; try { await ghConnect(tok.value, repo.value); if (GH.err) throw new Error(GH.err); d.close(); toast('Connected. Your studio is in step with GitHub.', 'ok'); ghPaint(); } catch (e) { msg.textContent = e.message; msg.style.color = 'var(--bad)'; if (e.code === 'auth') { ghDisconnect(); } } finally { go.disabled = false; } } }, 'Connect');
  const d = pdlg('ghConnect', 'CONNECT GITHUB', h('div', { class: 'gh-connect' },
    h('ol', { class: 'small', style: { lineHeight: 1.5, paddingLeft: '18px' } },
      h('li', {}, 'On GitHub, make a ', h('a', { href: 'https://github.com/new?name=my-daily-studio&visibility=private&description=My%20the-daily.studio', target: '_blank', rel: 'noopener noreferrer' }, 'private repository'), ' (my-daily-studio), or let the app make it if your token allows.'),
      h('li', {}, 'Make a ', h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener noreferrer' }, 'fine-grained token'), ' for just that repository, with Contents: Read and write.'),
      h('li', {}, 'Paste it here. It stays in this browser and is never put in the repository.')),
    pField('Token', tok), pField('Repository name', repo), msg, h('div', { class: 'row', style: { gap: '8px', justifyContent: 'flex-end' } }, h('button', { class: 'btn', onclick: () => d.close() }, 'Cancel'), go)));
}
function ghShareOpen() {
  const looks = (CFG.show && CFG.show.saved) || [], rigs = store.get('presets', []), pickL = new Set(), pickR = new Set();
  const row = (label, set, key) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', onchange: e => { if (e.target.checked) set.add(key); else set.delete(key); } }), ' ' + label);
  const msg = h('div', { class: 'tiny', 'aria-live': 'polite', id: 'ghShareMsg' });
  const go = h('button', { class: 'btn primary', id: 'ghShareGo', onclick: async () => { if (!pickL.size && !pickR.size) { msg.textContent = 'Choose at least one look or rig.'; return; } go.disabled = true; msg.textContent = 'Sharing…'; try { const r = await ghShare([...pickL], [...pickR]); msg.innerHTML = ''; msg.append('Shared ' + r.looks + ' looks and ' + r.rigs + ' rigs at ', h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, r.url.replace('https://', '')), '.'); } catch (e) { msg.textContent = e.message; msg.style.color = 'var(--bad)'; } finally { go.disabled = false; } } }, '⇪ Share in public');
  pdlg('ghShare', 'SHARE LOOKS AND RIGS', h('div', {},
    h('p', { class: 'small' }, 'The ones you choose go to a PUBLIC repository in your account (' + (CFG.gh.shared || GH_SHARED) + '), tagged so the community gallery finds it. Nothing else from your studio is shared, and you can delete that repository at any time.'),
    h('h5', {}, 'Looks'), looks.length ? h('div', { class: 'gh-picks' }, looks.map(l => row(l.name, pickL, l.id))) : h('p', { class: 'tiny muted' }, 'No saved looks yet (Visuals ▸ Show setup ▸ Looks ▸ Save).'),
    h('h5', {}, 'Rigs'), rigs.length ? h('div', { class: 'gh-picks' }, rigs.map(p => row(p.n, pickR, p.n))) : h('p', { class: 'tiny muted' }, 'No saved rig presets yet (Tones ▸ Save).'),
    h('p', { class: 'tiny muted' }, 'You are sharing them in public under your GitHub name, for anyone to try and keep. Share only what you made or may share.'), msg,
    h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, go)));
}
async function ghGalleryShow() {
  const list = h('div', { class: 'gh-gallery', id: 'ghGallery' }, h('p', { class: 'tiny muted' }, 'Asking GitHub…'));
  pdlg('ghGalleryDlg', 'COMMUNITY LOOKS AND RIGS', h('div', {}, h('p', { class: 'tiny muted' }, 'Studios that share their looks and rigs in public on GitHub (tagged ' + GH_TOPIC + '). Opening this asks GitHub’s search; nothing about you is sent' + (ghTok() ? ' beyond your sign-in' : '') + '.'), list), { wide: true });
  let g; try { g = await ghGallery(); } catch (e) { list.innerHTML = ''; list.append(h('p', { class: 'small', style: { color: 'var(--bad)' } }, e.message)); return; }
  list.innerHTML = ''; list.append(h('p', { class: 'small', id: 'ghGalleryCount' }, h('b', {}, String(g.total)), g.total === 1 ? ' studio is sharing.' : ' studios are sharing.'));
  if (!g.items.length) list.append(h('p', { class: 'tiny muted' }, 'None yet. Be the first: Settings ▸ GitHub ▸ Share looks and rigs.'));
  g.items.forEach(it => {
    const body = h('div', { class: 'gh-items' }), open = h('button', { class: 'btn sm', onclick: async () => {
      open.disabled = true; body.textContent = 'Opening…'; const x = await ghGalleryOpen(it.owner, it.repo); body.innerHTML = '';
      if (!x.looks.length && !x.rigs.length) body.append(h('span', { class: 'tiny muted' }, 'Nothing usable in it.'));
      x.looks.forEach(l => body.append(h('div', { class: 'gh-item' }, h('span', {}, '◐ ', h('b', {}, l.name)), h('button', { class: 'btn sm', 'data-keep': 'look', onclick: () => ghKeepLook(l, it.owner) }, '＋ Keep look'))));
      x.rigs.forEach(p => body.append(h('div', { class: 'gh-item' }, h('span', {}, '🎛 ', h('b', {}, p.n)), h('button', { class: 'btn sm', 'data-keep': 'rig', onclick: () => ghKeepRig(p, it.owner) }, '＋ Keep rig'))));
    } }, 'Open');
    list.append(h('div', { class: 'gh-studio', 'data-repo': it.owner + '/' + it.repo }, h('div', { class: 'row', style: { gap: '8px', alignItems: 'center' } }, h('b', {}, '@' + it.owner), h('span', { class: 'tiny muted', style: { flex: 1 } }, it.desc), open), body));
  });
}
