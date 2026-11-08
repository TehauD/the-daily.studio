/* ============================================================
   Part 25b · VERSIONS (2.56) — the moments of a song you choose to keep
   ✓ Mark this version keeps the song as it is now (every section, the band, the arrangement) and its takes as they are placed and
   trimmed, with a name and a note. Versions live with the song in this browser (the project record: rec.versions) and, if sync is on,
   in your folder or your GitHub repository with the song; the recordings a version uses are kept for as long as the version is.
   Go back to a version (what you had is kept as a version first, so nothing is lost), or open one as a song of its own.
   Writing together: a round that comes back for a song you already have can be added as a new version of it ("Round from Sam"), so the
   rounds stop piling up as copies. Shares, credits and the release package (later parts) name the version they are of.
   The song journey (the strip in the song bar) shows how far a song has come: words, chords, recorded, a version, shared, finished;
   and the 🛡 beside Saved says where your songs are kept: only in this browser, a folder, a backup or GitHub.
   ============================================================ */
const VER = { max: 60 };
const verList = (rec) => ((rec || PRJ.rec) && (rec || PRJ.rec).versions) || [];
const verClone = o => JSON.parse(JSON.stringify(o));
/** the song and its takes, as a version keeps them */
const verSnap = () => ({ song: verClone(S), takes: TAKES.filter(tkIsLead).length || TAKES.length ? TAKES.map(takeMeta) : [] });
const verKey = v => JSON.stringify([Object.assign({}, v.song, { collab: undefined }), (v.takes || []).map(t => [t.id, t.src, t.startSec, t.inS, t.outS, t.g, t.pan, t.mute, t.name])]);
/** has the song changed since its newest version? */
function verChanged() { const L = verList().slice(-1)[0]; return !L || verKey(L) !== verKey(verSnap()); }
/** what changed between two songs, in words ("Chorus: new words; added Bridge") */
function verDiff(a, b) {
  if (!a || !b) return ''; const pr = x => Object.fromEntries(x.sections.map(sec => [sec.name, [sec.bars.map(bb => bb.chord || '').join('|'), (sec.lyrics || '').trim()]])), pa = pr(a), pb = pr(b), out = [];
  b.sections.forEach(sec => { const n = sec.name; if (!(n in pa)) out.push('added ' + n); else { const [ca, la] = pa[n], [cb, lb] = pb[n], w = [ca !== cb ? 'chords' : '', la !== lb ? 'words' : ''].filter(Boolean); if (w.length) out.push(n + ': ' + w.join(' and ')); } });
  a.sections.forEach(sec => { if (!(sec.name in pb)) out.push('removed ' + sec.name); });
  if (a.bpm !== b.bpm) out.push('tempo ' + a.bpm + ' → ' + b.bpm); if (a.key !== b.key || !!a.minor !== !!b.minor) out.push('key changed');
  return out.slice(0, 6).join('; ');
}
/** keep the song as it is now as a version; returns it */
async function verMark(name, note, o) {
  o = o || {}; if (!PRJ.rec) await projSave(); const rec = PRJ.rec; if (!rec) return null;
  const list = verList(rec), s = verSnap(), v = { id: 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), n: String(name || '').trim().slice(0, 60) || 'Version ' + (list.length + 1), note: String(note || '').trim().slice(0, 400), at: Date.now(), by: CFG.slName || '', kind: o.kind || 'mine', from: o.from || '', song: s.song, takes: s.takes };
  rec.versions = list.concat(v).slice(-VER.max); await projSave(); bus.emit('versions'); return v;
}
/** go back to a version: what you have now is kept as a version first (if it differs), so nothing is lost */
async function verRestore(v) {
  const rec = PRJ.rec; if (!rec || !v) return; if (verChanged()) await verMark('Before going back to ' + v.n, '', { kind: 'auto' });
  await projSave(); rec.song = verClone(v.song); rec.takes = verClone(v.takes || []); rec.modified = Date.now(); await pdbPut('projects', rec);
  await projLoad(rec.id, { rec, keepZoom: true }); bus.emit('versions'); toast('Back to “' + v.n + '”. What you had is kept as a version too.', 'ok');
}
/** a version as a song of its own (its recordings copied with it) */
async function verCopy(v) {
  const from = PRJ.rec; if (!from || !v) return; await projSave(); const id = projId(), done = new Set();
  for (const m of v.takes || []) { const sid = m.src || m.id; if (done.has(sid)) continue; done.add(sid); for (const k of ['dry', 'wet', 'cam']) { const b = await pdbGet('blobs', from.id + '/take/' + sid + '/' + k); if (b != null) await pdbPut('blobs', b, id + '/take/' + sid + '/' + k); } }
  const song = verClone(v.song); song.title = (song.title || 'Untitled') + ' (' + v.n + ')';
  const rec = { id, v: 1, origin: 'version', created: Date.now(), modified: Date.now(), zoom: from.zoom || 'song', song, title: song.title, artist: song.artist || '', takes: verClone(v.takes || []), track: null, stemMix: null, versions: [], nTakes: (v.takes || []).length, size: 0 };
  await pdbPut('projects', rec); await projRefresh(); await projLoad(id); bus.emit('projects'); toast('“' + song.title + '” is open as a song of its own.', 'ok');
}
async function verDelete(v) { const rec = PRJ.rec; if (!rec) return; rec.versions = verList(rec).filter(x => x.id !== v.id); await projSave(); bus.emit('versions'); }
/** a round of Writing together, for a song you already have, as a new version of it (part 89 asks first) */
function verRoundOf(song) { const id = song && song.collab && song.collab.id; return id ? PRJ.list.find(r => r && r.song && r.song.collab && r.song.collab.id === id) || null : null; }
async function verAddRound(rec, song, takes) {
  if (PRJ.cur !== rec.id) await projLoad(rec.id); const from = (song.collab && song.collab.with) || 'someone';
  if (verChanged()) await verMark('Before ' + from + '’s round', '', { kind: 'auto' });
  { const seen = new Set(), all = (S.comments || []).concat(song.comments || []).filter(c => { const k = Math.round(c.at) + '|' + c.text; if (seen.has(k)) return false; seen.add(k); return true; }); song.comments = all.sort((x, y) => x.at - y.at); }      /* yours and theirs (2.58) */
  const keep = S.collab && S.collab.id ? S.collab : null; projUse(song); if (keep && S.collab) S.collab.id = keep.id;
  if (takes && takes.length) srxAdd(takes); commit(false); await projSave();
  return verMark('Round from ' + from, (song.collab && song.collab.note) || '', { kind: 'round', from });
}

/* ---------- the versions window ---------- */
const verWhen = t => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
function verOpen() {
  const list = verList().slice().reverse(), nameIn = h('input', { class: 'in', id: 'verName', maxlength: 60, placeholder: 'Version ' + (verList().length + 1) + '  (e.g. “Demo 2”, “With Sam’s bridge”)' }), noteIn = h('input', { class: 'in', id: 'verNote', maxlength: 400, placeholder: 'A note (optional): what this one is' });
  const changed = verChanged(), since = list[0] ? verDiff(list[0].song, S) : '';
  const row = v => { const i = verList().indexOf(v), prev = verList()[i - 1], ch = prev ? verDiff(prev.song, v.song) : 'the first version';
    return h('li', { class: 'ver-item' + (v.kind === 'auto' ? ' auto' : ''), 'data-id': v.id },
      h('div', { class: 'ver-h' }, h('b', {}, (v.kind === 'round' ? '↩ ' : v.kind === 'auto' ? '⟲ ' : '✓ ') + v.n), h('span', { class: 'tiny muted' }, ' · ' + verWhen(v.at) + (v.by ? ' · ' + v.by : '') + ' · ' + (v.takes || []).length + ((v.takes || []).length === 1 ? ' take' : ' takes'))),
      v.note ? h('p', { class: 'small ver-note' }, v.note) : null, ch ? h('p', { class: 'tiny muted' }, 'Changed: ' + ch) : null,
      h('div', { class: 'row ver-acts' }, h('button', { class: 'btn sm', title: 'Make the song this version again (what you have now is kept as a version first)', onclick: () => { d.close(); verRestore(v); } }, '⟲ Go back to this'),
        h('button', { class: 'btn sm', title: 'Open this version as a song of its own', onclick: () => { d.close(); verCopy(v); } }, '⧉ Open as a copy'),
        h('button', { class: 'btn sm', title: 'Forget this version (the song as it is now does not change)', 'aria-label': 'Delete version ' + v.n, onclick: async e => { if (!confirm('Forget the version “' + v.n + '”?')) return; await verDelete(v); e.target.closest('li').remove(); } }, '✕')));
  };
  const d = pdlg('verDlg', '✓ Versions of “' + (S.title || 'Untitled') + '”', h('div', { class: 'ver' },
    h('div', { class: 'ver-mark' }, h('p', { class: 'small' }, changed ? (list.length ? 'Changed since “' + list[0].n + '”' + (since ? ': ' + since : '') + '.' : 'Keep this moment of the song: its sections, the band and your takes as they are now.') : 'Nothing has changed since “' + list[0].n + '”.'),
      nameIn, noteIn, h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '8px' } }, h('button', { class: 'btn primary', id: 'verMarkBtn', disabled: !changed, onclick: async () => { const v = await verMark(nameIn.value, noteIn.value); d.close(); if (v) toast('✓ Kept as “' + v.n + '”.', 'ok'); } }, '✓ Mark this version'))),
    list.length ? h('ol', { class: 'ver-list', id: 'verList' }, list.map(row)) : h('p', { class: 'muted small' }, 'No versions yet. A version is kept in this browser with the song, and in your folder or GitHub if sync is on.')), { wide: true });
  setTimeout(() => nameIn.focus(), 50);
}

/* ---------- the song journey (in the song bar) ---------- */
function jrSteps() {
  const s = S, words = s.sections.some(x => (x.lyrics || '').trim()), chords = s.sections.some(x => x.bars.some(b => b.chord)), rec = TAKES.length > 0, vs = verList(), shared = !!(s.collab && s.collab.hist && s.collab.hist.length), done = !!(PRJ.rec && PRJ.rec.done);
  return [
    { k: 'words', on: words, t: 'Words', go: () => dockGo('tab'), how: 'Write the words in Write (or paste them).' },
    { k: 'chords', on: chords, t: 'Chords', go: () => dockGo('tab'), how: 'Add chords to the bars, or paste a chord sheet.' },
    { k: 'rec', on: rec, t: 'Recorded', go: null, how: 'Arm the Guitar or Vocal lane and press ● (or R).' },
    { k: 'ver', on: vs.length > 0, t: vs.length ? vs[vs.length - 1].n : 'A version', go: verOpen, how: 'Mark this version when it’s worth keeping.' },
    { k: 'shared', on: shared, t: 'Shared', go: () => slShare(), how: '🔗 Send it to someone to hear or write with.' },
    { k: 'done', on: done, t: 'Finished', go: () => (typeof finOpen === 'function' ? finOpen() : lxExportOpen()), how: 'Finish it: master it and make the release package.' }];
}
function jrPaint() {
  const b = SB.jr; if (!b) return; const st = jrSteps(), n = st.filter(x => x.on).length, next = st.find(x => !x.on);
  b.replaceChildren(h('span', { class: 'jr-dots', 'aria-hidden': 'true' }, st.map(x => h('i', { class: x.on ? 'on' : '' }))), h('span', { class: 'jr-t' }, next ? 'Next: ' + next.t.toLowerCase() : 'Finished'));
  b.title = 'Song journey: ' + n + ' of ' + st.length + ' · ' + st.map(x => (x.on ? '✓ ' : '○ ') + x.t).join(' · '); b.setAttribute('aria-label', b.title);
}
function jrOpen(anchor) {
  const st = jrSteps(), box = h('div', { class: 'jr-pop', id: 'jrPop' }, h('h5', {}, 'Song journey'));
  st.forEach(x => box.append(h('div', { class: 'jr-row' + (x.on ? ' on' : '') }, h('span', { class: 'jr-ck' }, x.on ? '✓' : '○'), h('div', { class: 'grow' }, h('b', {}, x.t), x.on ? null : h('div', { class: 'tiny muted' }, x.how)), x.go ? h('button', { class: 'btn sm', onclick: () => { closePop(); x.go(); } }, x.k === 'ver' ? 'Versions…' : x.k === 'shared' ? 'Send…' : x.k === 'done' ? 'Finish…' : 'Open') : null)));
  popover(anchor, box, { style: { maxWidth: '340px' } });
}

/* ---------- 🛡 where your songs are kept ---------- */
function safeState() {
  if (typeof ghOn === 'function' && ghOn() && !CFG.gh.need && CFG.gh.lastAt) return { k: 'gh', ok: true, t: 'In step with GitHub', at: CFG.gh.lastAt };
  if (CFG.sync && CFG.fsync && CFG.fsync.lastAt) return { k: 'folder', ok: true, t: 'Kept in your folder', at: CFG.fsync.lastAt };
  if (CFG.lastBackup && Date.now() - CFG.lastBackup < 14 * 864e5) return { k: 'backup', ok: true, t: 'Backed up ' + new Date(CFG.lastBackup).toLocaleDateString(), at: CFG.lastBackup };
  return { k: 'local', ok: false, t: 'Only in this browser' };
}
function safePaint() {
  const b = SB.safe; if (!b) return; const s = safeState(), r = typeof keepRisk === 'function' ? keepRisk() : { level: 'ok' };
  b.dataset.k = s.ok ? 'ok' : r.level === 'high' || r.level === 'med' ? 'risk' : 'local'; b.replaceChildren(h('b', {}, s.ok ? '🛡' : '⚠'), h('span', { class: 'sb-st' }, ' ' + s.t));
  b.title = s.ok ? s.t + '. Your songs are in this browser and kept somewhere else as well.' : 'Your songs are only in this browser. If its data is cleared, they are gone: keep a copy (a backup, a folder, or GitHub).';
  /* a gentle nudge, once a week, once there's real work and it's kept nowhere else */
  if (!s.ok && (songHasWork() || TAKES.length) && Date.now() - (CFG.safeNudge || 0) > 7 * 864e5 && !document.getElementById('boot')?.getClientRects().length) { CFG.safeNudge = Date.now(); saveCfg(); setTimeout(() => toast('Your songs are only in this browser. Press ⚠ Only in this browser (beside Saved) to keep a copy.', 'warn'), 1500); }
}
bus.on('projects', () => { jrPaint(); safePaint(); }); bus.on('song', () => jrPaint()); bus.on('takes', () => jrPaint()); bus.on('versions', () => jrPaint()); bus.on('github', () => safePaint());
