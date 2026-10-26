/* ============================================================
   Part 21 · SONG BAR — the song's details live in one slim strip under the header, on every tab:
   title · artist · tuning · capo · scale · notes, plus the loaded backing track.
   Loading a track fills these in (title / artist from the file's tags or its name, tempo, key, time, chords).
   ============================================================ */
const SB = { el: null, f: {}, pop: null, trk: null };

/* ---------- names & tags ---------- */
/** "Untitled__Good_Morning.m4a" → "Good Morning";  "03 - Artist - Song_Name (Official Audio)" → "Song Name" */
function cleanTitle(raw) {
  let s = String(raw || ''); try { s = decodeURIComponent(s); } catch (e) { }
  s = s.replace(/\.(mp3|m4a|mp4|aac|wav|wave|flac|ogg|oga|opus|aif|aiff|weba|webm)$/i, '');
  s = s.replace(/^untitled[\s_\-–—.]*/i, '').replace(/^\d{1,3}[\s_.]*[-–—.][\s_]*(?=\D)/, '');
  s = s.replace(/_+/g, ' ').replace(/\s*[(\[](official|lyrics?|audio|video|remaster(ed)?|hd|demo mix|mix \d+)[^)\]]*[)\]]/ig, '').replace(/\s{2,}/g, ' ').trim();
  return s;
}
/** a file called "Artist - Title" gives both halves; anything else is just a title */
function nameParts(raw) {
  const s = cleanTitle(raw), m = s.match(/^(.{2,60}?)\s+[-–—]\s+(.{2,100})$/);
  return m ? { artist: m[1].trim(), title: m[2].trim() } : { artist: '', title: s };
}
function tagText(u, enc) {
  try {
    if (enc === 1 || enc === 2) { let le = enc === 1, i = 0; if (u[0] === 0xFF && u[1] === 0xFE) { le = true; i = 2; } else if (u[0] === 0xFE && u[1] === 0xFF) { le = false; i = 2; } return new TextDecoder(le ? 'utf-16le' : 'utf-16be').decode(u.subarray(i)); }
    return new TextDecoder(enc === 3 ? 'utf-8' : 'iso-8859-1').decode(u);
  } catch (e) { return ''; }
}
/** tiny tag reader: ID3v2 (mp3) and iTunes-style atoms (m4a / mp4). Returns {title, artist} — either may be missing. */
function readTags(ab) {
  const out = {}; let u; try { u = new Uint8Array(ab); } catch (e) { return out; } if (u.length < 16) return out;
  const clean = s => String(s || '').replace(/\0+$/g, '').replace(/\0/g, ' ').trim().slice(0, 140);
  try {
    if (u[0] === 0x49 && u[1] === 0x44 && u[2] === 0x33) {
      const ver = u[3], size = (u[6] << 21) | (u[7] << 14) | (u[8] << 7) | u[9], end = Math.min(u.length, 10 + size), idLen = ver === 2 ? 3 : 4, hdr = ver === 2 ? 6 : 10; let p = 10;
      if (ver > 2 && (u[5] & 0x40)) p += ver === 4 ? ((u[10] << 21) | (u[11] << 14) | (u[12] << 7) | u[13]) : (((u[10] << 24) | (u[11] << 16) | (u[12] << 8) | u[13]) + 4);
      while (p + hdr < end) {
        const id = String.fromCharCode(...u.subarray(p, p + idLen)); if (!/^[A-Z0-9]+$/.test(id)) break;
        const sz = ver === 2 ? ((u[p + 3] << 16) | (u[p + 4] << 8) | u[p + 5]) : ver === 4 ? ((u[p + 4] << 21) | (u[p + 5] << 14) | (u[p + 6] << 7) | u[p + 7]) : (u[p + 4] * 16777216 + ((u[p + 5] << 16) | (u[p + 6] << 8) | u[p + 7]));
        if (sz <= 0 || p + hdr + sz > end) break;
        const body = u.subarray(p + hdr, p + hdr + sz);
        if (id === 'TIT2' || id === 'TT2') out.title = clean(tagText(body.subarray(1), body[0])); else if (id === 'TPE1' || id === 'TP1') out.artist = clean(tagText(body.subarray(1), body[0]));
        p += hdr + sz;
      }
    }
    if (String.fromCharCode(u[4], u[5], u[6], u[7]) === 'ftyp') {
      for (let i = u.indexOf(0xA9); i >= 0 && i < u.length - 24; i = u.indexOf(0xA9, i + 1)) {
        const k = String.fromCharCode(u[i + 1], u[i + 2], u[i + 3]); if (k !== 'nam' && k !== 'ART') continue;
        const p = i + 4; if (String.fromCharCode(u[p + 4], u[p + 5], u[p + 6], u[p + 7]) !== 'data') continue;
        const sz = (u[p] << 24 | u[p + 1] << 16 | u[p + 2] << 8 | u[p + 3]) >>> 0; if (sz < 17 || sz > 400) continue;
        const t = clean(new TextDecoder('utf-8').decode(u.subarray(p + 16, p + sz))); if (t) out[k === 'nam' ? 'title' : 'artist'] = t;
      }
    }
  } catch (e) { console.warn('tag read', e); }
  return out;
}

/* ---------- loading a track fills the song in ---------- */
function songIsPristine() {
  try {
    const d = demoSong(); d.sections.forEach(sec => sec.bars.forEach(b => { const c = barChords(b)[0]; if (c) fillTab(b, 'Fingerstyle pop', c); }));
    const sig = s => JSON.stringify(s.sections.map(x => [x.name, x.bars.map(b => [b.chord, b.tab.length]), (x.lyrics || '').trim()]));
    return sig(d) === sig(S);
  } catch (e) { return false; }
}
const songHasWork = () => S.sections.some(sec => (sec.lyrics || '').trim() || sec.bars.some(b => b.tab.length));
/** Called when a track has been analysed. mode: 'all' (details + chords) · 'details' · 'off' */
function stemAutofill(mode) {
  const an = STM.an; if (!an) return null; mode = mode || CFG.trackFill || 'all'; if (mode === 'off') return null;
  vhSnap('before loading “' + (STM.title || STM.name) + '”', true);
  const keepWork = songHasWork() && !songIsPristine(), doChords = mode === 'all' && !keepWork && an.chordBars.length >= 2;
  S.title = STM.title || S.title; S.artist = STM.artist || ''; S.bpm = Math.round(an.bpmEff * 100) / 100; S.ts = [4, 4];
  if (an.key) { S.key = an.key.root; S.minor = an.key.minor; S.scale = an.key.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)'; CFG.flats = keepFlats(S.key, S.minor); }
  if (doChords) stemWriteChords();
  S.track = { name: STM.title || STM.name, dur: +STM.dur.toFixed(1), bpm: S.bpm, chords: doChords };
  T.cursor = 0; T.loopA = 0; T.loopB = null; commit(true);
  return { doChords, keepWork };
}
const keepFlats = (k, minor) => { try { return !!keyUsesFlats(k, minor); } catch (e) { return false; } };
function stemWriteChords() {
  const an = STM.an, bars = an.chordBars.map(b => b.chord || '%'); let prev = ''; const clean = bars.map(c => { if (c === '%') return prev || ''; prev = c; return c; });
  S.sections = []; for (let i = 0; i < clean.length; i += 8) S.sections.push(mkSection(i === 0 && an.info[2].first > 12 ? 'Intro' : 'Part ' + (Math.floor(i / 8) + 1), clean.slice(i, i + 8)));
  SEL.sec = 0; SEL.bar = 0; TE.sec = 0; TE.bi = 0;
}

/* ---------- the strip ---------- */
function sbField(label, el, cls) { return h('label', { class: 'sbf ' + (cls || '') }, h('span', {}, label), el); }
function buildSongbar() {
  const el = SB.el = $('#songbar'); if (!el) return;
  const txt = (k, ph, cls, label) => (SB.f[k] = h('input', { class: 'in sb-' + k, placeholder: ph, spellcheck: false, 'aria-label': label, oninput: e => { S[k] = e.target.value; SP.lock = true; commit(false); SP.lock = false; sbChip(); } }));
  SB.f.tun = h('select', { class: 'in sb-tun', 'aria-label': 'Tuning', onchange: e => { const nm = e.target.value; if (nm === '__custom') { sbDetails(SB.f.more, true); sbSync(); return; } setTuning(TUNINGS[nm], nm); } });
  SB.f.capo = h('input', { class: 'in sb-capo', type: 'number', min: 0, max: 12, 'aria-label': 'Capo', onchange: e => { S.capo = clamp(+e.target.value || 0, 0, 12); S.voicePref = {}; commit(); } });
  SB.f.scale = h('select', { class: 'in sb-scale', 'aria-label': 'Scale for overlays', title: 'Scale used for the fretboard and tab overlays', onchange: e => { S.scale = e.target.value; commit(false); bus.emit('scale'); } }, Object.keys(SCALES).map(n => h('option', {}, n)));
  SB.f.more = h('button', { class: 'btn sm', title: 'Notes, custom tuning, per-string tuning…', onclick: () => sbDetails(SB.f.more) }, 'Notes & tuning ▾');
  SB.trk = h('div', { class: 'sb-trk' });
  SB.saved = h('span', { class: 'sb-saved', role: 'status', 'aria-live': 'polite', title: 'Your work is saved in this browser as you go' });
  UI.undo = h('button', { class: 'btn sm sb-hist', title: 'Undo (Ctrl/Cmd + Z)', 'aria-label': 'Undo', onclick: () => undo() }, '↶'); UI.redo = h('button', { class: 'btn sm sb-hist', title: 'Redo (Shift + Ctrl/Cmd + Z)', 'aria-label': 'Redo', onclick: () => redo() }, '↷'); SB.hist = h('span', { class: 'sb-histg' }, UI.undo, UI.redo, SB.saved);
  bus.on('savestate', (k, t) => sbSaved(k, t)); sbSaved('ok', null);
  SB.f.refine = h('button', { class: 'btn sm sb-ref', title: 'Open the Refine panel — chords & lyrics beside whatever you are doing', onclick: () => sideShow('refine') }, '✎ Refine');
  el.append(h('div', { class: 'sb-hex', 'aria-hidden': 'true' }, sv('svg', { viewBox: '0 0 24 24', width: 18, height: 18 }, sv('path', { d: 'M12 2l9 5v10l-9 5-9-5V7z', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }))), sbProject(),
    sbField('Song', txt('title', 'Title', '', 'Song title'), 'f-title'), sbField('Artist', txt('artist', 'Artist / author', '', 'Artist or author'), 'f-artist'),
    sbField('Tuning', SB.f.tun, 'f-tun'), sbField('Capo', SB.f.capo, 'f-capo'), sbField('Scale', SB.f.scale, 'f-scale'), SB.f.more,
    h('span', { class: 'grow' }), SB.hist, SB.trk, zoomCtl(), SB.f.refine);
  bus.on('song', () => { if (SP.lock) return; sbSync(); }); bus.on('track', sbChip); bus.on('scale', sbSync); bus.on('projects', sbChip);
  sbSync();
}
/** “Saved ✓ 14:02” beside the song details: autosave is quiet, so show that it happened */
function sbSaved(k, t) {
  const el = SB.saved; if (!el) return; el.dataset.k = k;
  el.innerHTML = ''; if (k === 'dirty') el.append(h('b', {}, '…'), h('span', { class: 'sb-st' }, ' Saving')); else if (k === 'err') el.append(h('b', {}, '⚠'), h('span', { class: 'sb-st' }, ' Not saved')); else { if (t) SB.savedAt = t; el.append(h('b', {}, '✓'), h('span', { class: 'sb-st' }, ' Saved')); }
  el.title = k === 'err' ? 'This browser would not store your work. Export a song bundle from ☰ Songs to keep it.' : SB.savedAt ? 'Saved in this browser at ' + new Date(SB.savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '. Autosave keeps it up to date.' : 'Your work is saved in this browser as you go';
}
function sbSync() {
  if (!SB.el) return; const act = document.activeElement, set = (el, v) => { if (el && el !== act && el.value !== String(v)) el.value = v; };
  set(SB.f.title, S.title || ''); set(SB.f.artist, S.artist || ''); set(SB.f.capo, S.capo); set(SB.f.scale, S.scale);
  const tn = Object.keys(TUNINGS), names = (TUNINGS[S.tuningName] ? tn : [S.tuningName].concat(tn)), sel = SB.f.tun;
  if (sel !== act) { sel.innerHTML = ''; names.forEach(n => sel.append(h('option', { value: n, selected: n === S.tuningName }, n))); sel.append(h('option', { value: '__custom' }, 'Custom tuning… (set each string)')); sel.value = S.tuningName; }
  if (SB.pop && SB.pop.isConnected && !SP.lock) { const keep = SB.pop.querySelector('textarea') === act; if (!keep) sbDetailsFill(SB.pop); } else SB.pop = null;
  sbChip();
}

/* ---------- details popover: notes + per-string tuning ---------- */
function sbDetailsFill(p) {
  p.innerHTML = '';
  p.append(h('h5', { style: { margin: '0 0 6px' } }, 'Song details'),
    songField('Notes (appear in the export header)', h('textarea', { class: 'in', rows: 3, style: { width: '100%', fontFamily: 'var(--sans)' }, oninput: e => { S.notes = e.target.value; SP.lock = true; commit(false); SP.lock = false; } }, S.notes || '')),
    h('div', { style: { height: '8px' } }), tuningEditor(),
    h('div', { class: 'tiny muted', style: { marginTop: '8px' } }, 'Tempo, key and time signature live in the transport bar above. Title, artist, tuning and capo are used by every export.'));
}
function sbDetails(anchor, openTuning) {
  if (openTuning) TUNED.open = true;
  if (SB.pop && SB.pop.isConnected && openTuning) { sbDetailsFill(SB.pop); return; }
  const box = h('div'); sbDetailsFill(box);
  const p = popover(anchor || SB.f.more, box, { style: { width: '430px', maxWidth: '92vw' }, right: true }); SB.pop = p ? box : null;
}
bus.on('open-tuning-editor', () => sbDetails(SB.f.more, true));

/* ---------- the loaded-track chip ---------- */
function sbChip() {
  if (!SB.trk) return; const t = SB.trk; t.innerHTML = '';
  if (STM.ch) {
    const an = STM.an, k = an && an.key;
    t.append(h('button', { class: 'sb-chip on', title: 'A backing track is loaded and analysed — click for what to do with it', onclick: e => sbTrackPop(e.currentTarget) },
      h('i', { class: 'led' }), h('b', {}, '♪ ' + (STM.title || STM.name)), h('span', { class: 'muted' }, fmtT(STM.dur) + (an ? ' · ' + an.bpmEff.toFixed(0) + ' BPM' + (k ? ' · ' + pcName(k.root) + (k.minor ? 'm' : '') : '') : '')), ' ▾'));
  } else if (STM.busy) {
    t.append(h('span', { class: 'sb-chip busy' }, h('i', { class: 'led warn' }), STM.restoring ? 'Restoring track…' : 'Analysing track…'));
  } else if (PRJ.pending) {
    t.append(h('button', { class: 'sb-chip', title: 'This song has a backing track saved on this device. Tap to split it into stems again (takes a moment).', onclick: () => projRestoreTrack() }, '♪ Restore “' + (PRJ.pending.title || PRJ.pending.name || 'track') + '”'));
  } else {
    t.append(h('button', { class: 'sb-chip', title: 'Load a backing track — it is split into stems and fills in this song (title, tempo, key, chords)', onclick: () => { dockGo('stems'); const f = SU && SU.file; if (f) f.click(); } }, '♪ Load a track…'));
    if (S.track) t.append(h('span', { class: 'tiny muted', title: 'This song was built from a track. Load it again to play along with it.' }, 'from “' + S.track.name + '”'));
  }
  t.append(h('button', { class: 'sb-chip', id: 'sbPerform', title: 'Perform: full-screen chords and lyrics with a count-in, record and play', onclick: e => perfOpen(e.currentTarget) }, '🎤 Perform'));
}
function sbTrackPop(anchor) {
  const an = STM.an, box = h('div', { style: { display: 'grid', gap: '6px' } });
  box.append(h('h5', { style: { margin: 0 } }, STM.title || STM.name), h('div', { class: 'tiny muted' }, fmtT(STM.dur) + ' · ' + (STM.sr / 1000).toFixed(1) + ' kHz' + (an ? ' · ' + an.info.filter(i => i.found).map(i => i.name.split(' ')[0]).join(', ') + ' found' : '')));
  const row = (label, fn, cls, title) => h('button', { class: 'btn sm ' + (cls || ''), title: title || '', style: { justifyContent: 'flex-start' }, onclick: () => { closePop(); fn(); } }, label);
  box.append(row('⤵ Import chords as the song', stemImportChords, 'primary', 'Replace the song with this chord chart (a snapshot is saved first)'), row('♩ Use tempo + key only', stemApplyTempo, '', 'Set BPM, key and scale from the track'),
    row('▶ Play the band with the track', stemTogether, '', 'Start the band and the track together from bar 1'), row('🎚 Open Stems', () => dockGo('stems')), row('✕ Unload track', stemUnload, 'bad', 'Remove the track from memory'));
  const syncT = h('label', { class: 'lrow' }, h('input', { type: 'checkbox', checked: CFG.trackSync !== false, onchange: e => { CFG.trackSync = e.target.checked; saveCfg(); } }), 'Track follows the transport (play, stop, seek, loop)');
  const fill = h('div', { class: 'lrow' }, h('span', {}, 'When a track loads'), h('select', { class: 'in', style: { flex: 1 }, onchange: e => { CFG.trackFill = e.target.value; saveCfg(); } }, [['all', 'Fill details + chords'], ['details', 'Fill details only'], ['off', 'Do nothing']].map(([v, t]) => h('option', { value: v, selected: (CFG.trackFill || 'all') === v }, t))));
  box.append(h('div', { class: 'hr' }), syncT, fill, h('div', { class: 'tiny muted' }, 'Your own chords, tab and lyrics are never replaced automatically — use “Import chords” when you want that.'));
  popover(anchor, box, { right: true, style: { width: '330px' } });
}
