/* ============================================================
   Part 08 · Song / lyrics, Band, Export (Ultimate Guitar, ChordPro, MIDI, WAV, JSON) and lint
   ============================================================ */

/* ---------- lyric text analysis ---------- */
function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, ''); if (!w) return 0; if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); const m = w.match(/[aeiouy]{1,2}/g); return Math.max(1, m ? m.length : 1);
}
const lyricPlain = line => line.replace(/\[[^\]]*\]/g, '');
const lineSyl = line => (lyricPlain(line).match(/[A-Za-z']+/g) || []).reduce((a, w) => a + syllables(w), 0);
function rhymeKey(line) {
  const ws = lyricPlain(line).toLowerCase().match(/[a-z']+/g); if (!ws) return ''; let w = ws[ws.length - 1].replace(/'/g, '').replace(/(s|ed)$/, m => w2ok(m));
  const m = w.match(/[aeiouy]+[^aeiouy]+e$/) || w.match(/[aeiouy]+[^aeiouy]*$/); return m ? m[0] : w;
}
function w2ok(m) { return m === 's' ? '' : m; }
function rhymeScheme(lines) {
  const map = {}, out = []; let nx = 0, keys = lines.map(l => (l.trim() ? rhymeKey(l) : null));
  const count = {}; keys.forEach(k => { if (k) count[k] = (count[k] || 0) + 1; });
  keys.forEach(k => { if (!k) return out.push(''); if (count[k] < 2) return out.push('·'); if (!(k in map)) map[k] = String.fromCharCode(65 + (nx++ % 26)); out.push(map[k]); });
  return out;
}
/** Parse a lyric line with inline [Chord] markers into plain text and chord anchors. */
function parseLyricLine(line) {
  let text = '', chords = [], last = 0; const re = /\[([^\]]+)\]/g; let m;
  while ((m = re.exec(line))) { text += line.slice(last, m.index); last = re.lastIndex; if (parseChord(m[1])) chords.push({ pos: text.length, sym: m[1] }); else text += m[0]; }
  text += line.slice(last); return { text, chords };
}
/** Return {chordLine, text} using a monospaced layout; fmt(sym) wraps chord symbols (width counted on the plain symbol). */
function chordOverLine(line, fmt = s => s) {
  const { text, chords } = parseLyricLine(line); let cl = '', plainLen = 0;
  chords.forEach(c => { while (plainLen < c.pos) { cl += ' '; plainLen++; } if (plainLen > 0 && cl && !/ $/.test(cl)) { cl += ' '; plainLen++; } cl += fmt(c.sym); plainLen += c.sym.length; });
  return { chordLine: cl, text, hasChords: chords.length > 0 };
}
function stripCaretPad(s) { return s.replace(/\s+$/, ''); }

/* ---------- ASCII tablature renderer (Ultimate Guitar friendly) ---------- */
function slotText(n) { return fretText(n) + ({ h: 'h', p: 'p', '/': '/', '\\': '\\', '~': '~' }[n.t] || ''); }
function tabLabels() { return stringLabels().map((l, i) => (i === 0 && l === 'E' ? 'e' : l)); }
function renderBarTab(bar) {
  const sp = spb(), rows = Array.from({ length: 6 }, () => '');
  for (let s = 0; s < sp; s++) {
    const here = bar.tab.filter(n => n.s === s), w = Math.max(2, ...here.map(n => slotText(n).length + 1));
    for (let r = 0; r < 6; r++) { const n = here.find(o => o.st === 5 - r); rows[r] += n ? slotText(n).padEnd(w, '-') : '-'.repeat(w); }
  }
  return rows;
}
function renderTabBars(bars, width) {
  const lab = tabLabels(), blocks = bars.map(renderBarTab), out = []; let i = 0; width = width || CFG.ugWidth || 72;
  while (i < blocks.length) {
    let w = 2, j = i; const take = [];
    while (j < blocks.length && (take.length === 0 || w + blocks[j][0].length + 1 <= width)) { take.push(blocks[j]); w += blocks[j][0].length + 1; j++; }
    for (let r = 0; r < 6; r++) out.push(lab[r] + '|' + take.map(b => b[r]).join('|') + '|');
    out.push(''); i = j;
  }
  return out.join('\n').replace(/\n+$/, '');
}
const hasTab = sec => sec.bars.some(b => b.tab.length);

/* ---------- export builders ---------- */
const capoText = () => S.capo ? S.capo + ['th', 'st', 'nd', 'rd'][S.capo % 10 > 3 || (S.capo > 10 && S.capo < 14) ? 0 : S.capo % 10] + ' fret' : 'none';
const tuningNotes = () => S.tuning.map(m => tunPc(m)).join(' ');
const keyName = () => pcName(S.key, CFG.flats) + (S.minor ? 'm' : '');
function songHeader(style) {
  const l = []; if (style === 'ug') l.push((S.title || 'Untitled') + (S.artist ? ' - ' + S.artist : ''));
  l.push('Tuning: ' + tuningNotes() + (S.tuningName.startsWith('Standard') ? '' : '  (' + S.tuningName.replace(/\s*\(.*$/, '') + ')'));
  l.push('Capo: ' + capoText()); l.push('Key: ' + keyName() + (S.capo ? '  (sounding key; chords below are shapes relative to the capo)' : '')); l.push('Tempo: ' + S.bpm + ' bpm · ' + S.ts.join('/') + (S.swing > .05 ? ' · swing' : '')); if (S.notes) l.push('', S.notes.trim());
  return l.join('\n');
}
function buildUG(o = {}) {
  const o2 = Object.assign({ header: true, tabs: true, lyrics: true, tags: CFG.ugTags !== false, bars: true }, o), T_ = (a, b, x) => o2.tags ? a + x + b : x;
  const out = []; if (o2.header) out.push(songHeader('ug'), '');
  S.sections.forEach(sec => {
    out.push('[' + sec.name + ']'); const cl = sec.bars.map(b => barChords(b).map(c => T_('[ch]', '[/ch]', c)).join(' ') || '%').join(' | ');
    const lyl = (sec.lyrics || '').split('\n').filter(l => l.trim());
    const lyHasCh = lyl.some(l => parseLyricLine(l).chords.length);
    if (o2.bars && !(o2.lyrics && lyHasCh)) out.push(o2.tags ? cl.replace(/ \| /g, '  ') : cl.replace(/ \| /g, '  '));
    if (o2.lyrics && lyl.length) {
      const blk = []; (sec.lyrics || '').replace(/\s+$/, '').split('\n').forEach(l => { const r = chordOverLine(l, s => T_('[ch]', '[/ch]', s)); if (r.hasChords) blk.push(stripCaretPad(r.chordLine)); blk.push(r.text); });
      out.push(o2.tags ? '[tab]' + blk.join('\n') + '[/tab]' : blk.join('\n'));
    }
    if (o2.tabs && hasTab(sec)) { const tb = renderTabBars(sec.bars, S.ts[0] > 4 ? 78 : null); out.push(o2.tags ? '[tab]' + tb + '[/tab]' : tb); }
    out.push('');
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
function buildChordPro() {
  const o = ['{title: ' + (S.title || 'Untitled') + '}', '{artist: ' + (S.artist || '') + '}', '{key: ' + keyName() + '}', '{tempo: ' + S.bpm + '}', '{time: ' + S.ts.join('/') + '}'];
  if (S.capo) o.push('{capo: ' + S.capo + '}'); o.push('{comment: Tuning ' + tuningNotes() + '}'); if (S.notes) o.push('{comment: ' + S.notes.replace(/\n/g, ' ') + '}'); o.push('');
  S.sections.forEach(sec => {
    const kind = /chorus/i.test(sec.name) ? 'chorus' : /bridge/i.test(sec.name) ? 'bridge' : /verse/i.test(sec.name) ? 'verse' : null;
    o.push(kind ? '{start_of_' + kind + ': ' + sec.name + '}' : '{comment: ' + sec.name + '}');
    const ly = (sec.lyrics || '').trim(); if (ly) o.push(ly); else o.push(sec.bars.map(b => barChords(b).map(c => '[' + c + ']').join('')).join(' | '));
    if (hasTab(sec)) o.push('{start_of_tab}', renderTabBars(sec.bars), '{end_of_tab}');
    if (kind) o.push('{end_of_' + kind + '}'); o.push('');
  });
  return o.join('\n');
}
function buildLyricsOnly() { return S.sections.map(sec => '[' + sec.name + ']\n' + (sec.lyrics || '').split('\n').map(lyricPlain).join('\n').trim()).join('\n\n') + '\n'; }

/* ---------- Standard MIDI File ---------- */
function buildMidi() {
  const PPQ = 480, TPS = PPQ / 4, vlq = n => { const b = [n & 127]; while ((n >>= 7)) b.unshift((n & 127) | 128); return b; };
  const str = s => Array.from(new TextEncoder().encode(s)), u32 = n => [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255], u16 = n => [(n >> 8) & 255, n & 255];
  const track = (ev, name) => { ev.sort((a, b) => a.t - b.t || (a.o || 0) - (b.o || 0)); const d = [0, 0xFF, 3, name.length, ...str(name)]; let t = 0; ev.forEach(e => { d.push(...vlq(Math.max(0, e.t - t)), ...e.b); t = e.t; }); d.push(0, 0xFF, 0x2F, 0); return [...str('MTrk'), ...u32(d.length), ...d]; };
  const sp = spb(), total = totalBars() * sp, tracks = [];
  const us = Math.round(60e6 / S.bpm); const meta = [{ t: 0, b: [0xFF, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255] }, { t: 0, b: [0xFF, 0x58, 4, S.ts[0], Math.log2(S.ts[1]), 24, 8] }, { t: 0, b: [0xFF, 0x59, 2, 0, S.minor ? 1 : 0] }, { t: 0, b: [0xFF, 0x02, S.title.length + 12, ...str('(c) ' + (S.artist || 'composer'))].slice(0, 0) }];
  meta.length = 3; meta.push({ t: 0, b: [0xFF, 0x01, ...vlq(('Made with the-daily.studio · ' + S.title).length), ...str('Made with the-daily.studio · ' + S.title)] });
  tracks.push(track(meta, S.title || 'Song'));
  const on = (ev, ch, m, v, t, d) => { ev.push({ t: Math.round(t), b: [0x90 | ch, m, v], o: 1 }, { t: Math.round(t + d), b: [0x80 | ch, m, 0], o: 0 }); };
  // rhythm guitar (voicings), channel 0
  const rg = [{ t: 0, b: [0xC0, 25] }]; for (let bi = 0; bi < totalBars(); bi++) { for (let s = 0; s < sp;) { const cd = chordAt(bi, s); if (!cd) break; if (cd.sym) { const v = voicingFor(cd.sym); if (v) v.frets.forEach((f, i) => { if (f != null) on(rg, 0, clamp(S.tuning[i] + S.capo + f, 0, 127), 72, (bi * sp + s) * TPS + i * 6, cd.len * TPS - 10); }); } s += Math.max(1, cd.len - cd.rel); } }
  tracks.push(track(rg, 'Rhythm guitar'));
  // lead / tab, channel 1
  const ld = [{ t: 0, b: [0xC1, 26] }]; flatBars().forEach(fb => { fb.bar.tab.forEach(n => { const next = fb.bar.tab.filter(o => o.st === n.st && o.s > n.s).sort((a, b) => a.s - b.s)[0], len = Math.max(1, (next ? next.s : sp) - n.s); on(ld, 1, clamp(n.f === 'x' ? S.tuning[n.st] + S.capo : noteMidi(n) + (n.t === '<>' ? 12 : 0), 0, 127), n.f === 'x' ? 40 : 90, (fb.idx * sp + n.s) * TPS, len * TPS - 8); }); });
  tracks.push(track(ld, 'Lead / tab'));
  // bass, channel 2
  const bs = [{ t: 0, b: [0xC2, 33] }]; if (S.band.bassOn) for (let bi = 0; bi < totalBars(); bi++) for (let s = 0; s < sp; s++) { const cd = chordAt(bi, s); if (!cd || !cd.sym) continue; const e = bassEvent(S.band.bassStyle, cd.sym, cd.rel, cd.len, cd.next); if (e) on(bs, 2, clamp(e.m, 0, 127), Math.round(60 + 50 * (e.v || .8)), (bi * sp + s) * TPS, Math.max(1, e.len) * TPS - 8); }
  tracks.push(track(bs, 'Bass'));
  // drums, channel 9
  const dr = []; if (S.band.drumsOn) { const pat = dpat(), L = Math.min(S.band.drumLen || 16, 32), gm = [36, 38, 42, 46, 39, 45]; for (let s = 0; s < total; s++) pat.forEach((row, r) => { const v = row[s % L]; if (v) on(dr, 9, gm[r], [0, 50, 90, 118][v], s * TPS, 60); }); }
  tracks.push(track(dr, 'Drums'));
  const head = [...str('MThd'), ...u32(6), ...u16(1), ...u16(tracks.length), ...u16(PPQ)];
  return new Blob([new Uint8Array(head.concat(...tracks))], { type: 'audio/midi' });
}

/* ---------- project JSON ---------- */
function exportProject() {
  const doc = { format: 'the-daily.studio-project', version: 1, app: BRAND.name + ' ' + VERSION, saved: new Date().toISOString(), song: S, rig: rigSnapshot(), settings: { a4: CFG.a4, flats: CFG.flats, rttMs: rttMs() } };
  download(((S.title || 'song').replace(/\W+/g, '_')) + '.daily-song.json', JSON.stringify(doc, null, 1), 'application/json'); toast('Project saved as plain JSON — readable by any text editor', 'ok');
}
function importProject(file) {
  const r = new FileReader(); r.onload = () => {
    try {
      const d = JSON.parse(r.result), s = d.song || d; if (!s || !Array.isArray(s.sections)) throw new Error('no sections');
      S = Object.assign(newSong(), s); S.band = Object.assign(newSong().band, s.band); S.mix = Object.assign(newSong().mix, s.mix); S.tuning = (s.tuning || S.tuning).slice();
      if (d.rig) try { rigApply(d.rig); } catch (e) { }
      T.loopA = 0; T.loopB = null; SEL.sec = 0; SEL.bar = 0; TE.sec = 0; TE.bi = 0; commit(true); bus.emit('song', 'reload'); toast('Imported “' + S.title + '”', 'ok');
    } catch (e) { toast('Import failed: ' + e.message, 'bad'); }
  }; r.readAsText(file);
}

/* ---------- lint ---------- */
function lintSong() {
  const L = [], add = (sev, m) => L.push({ sev, m });
  if (!S.title || /^Untitled/.test(S.title)) add('warn', 'Give the song a real title.'); if (!S.artist) add('warn', 'Artist / author field is empty.');
  if (!S.sections.length) add('err', 'No sections yet.');
  const names = {}; S.sections.forEach(s => { names[s.name] = (names[s.name] || 0) + 1; });
  Object.entries(names).forEach(([n, c]) => { if (c > 1) add('info', 'Section name “' + n + '” is used ' + c + '×; Ultimate Guitar prefers numbered labels (Verse 1, Verse 2).'); });
  S.sections.forEach(sec => {
    const where = '[' + sec.name + '] '; const used = new Set();
    if (!sec.bars.length) add('warn', where + 'has no bars.');
    sec.bars.forEach((b, i) => {
      const cs = barChords(b); if (!cs.length) add('warn', where + 'bar ' + (i + 1) + ' has no chord.');
      cs.forEach(c => { used.add(c); const p = parseChord(c); if (!p) add('err', where + 'bar ' + (i + 1) + ': “' + c + '” is not a chord this app understands.'); else if (!voicings(c, S.tuning, S.capo, 1).length) add('warn', where + '“' + c + '” has no playable voicing in this tuning/capo.'); });
      b.tab.forEach(n => { if (typeof n.f === 'number' && (n.f < 0 || n.f > 24)) add('err', where + 'bar ' + (i + 1) + ': fret ' + n.f + ' out of range.'); if (n.s >= spb()) add('err', where + 'bar ' + (i + 1) + ': note beyond bar length.'); });
      const keys = b.tab.map(n => n.s + ':' + n.st); if (new Set(keys).size !== keys.length) add('err', where + 'bar ' + (i + 1) + ' has two notes on one string at one position.');
    });
    const ly = (sec.lyrics || '').split('\n'); const lc = new Set();
    ly.forEach((l, i) => { let m; const re = /\[([^\]]+)\]/g; while ((m = re.exec(l))) { if (!parseChord(m[1])) add('warn', where + 'lyric line ' + (i + 1) + ': “[' + m[1] + ']” is not a chord (treated as lyric text).'); else lc.add(m[1]); if (!used.has(m[1]) && parseChord(m[1])) add('info', where + 'lyric chord ' + m[1] + ' is not in the bar chords.'); } const w = lyricPlain(l).length; if (w > 70) add('info', where + 'lyric line ' + (i + 1) + ' is ' + w + ' characters; consider splitting for UG.'); });
    if (sec.lyrics && sec.lyrics.trim() && !lc.size && used.size) add('info', where + 'lyrics have no inline [Chord] markers, so chord changes will not appear over words.');
  });
  if (S.bpm < 40 || S.bpm > 220) add('info', 'Tempo ' + S.bpm + ' bpm is extreme.'); if (S.capo > 9) add('warn', 'Capo above fret 9 is unusual.');
  if (!L.some(x => x.sev === 'err')) add('ok', 'No blocking problems found.'); return L;
}

/* ============================================================
   SONG PANE
   ============================================================ */
const SP = { lock: false };
const TUNED = { open: false };
/* custom per-string tuning: six note pickers + quick shifts. Everything downstream reads S.tuning, so voicings, tab, transcription and the tuner follow instantly. */
function tuningEditor() {
  const isCustom = !TUNINGS[S.tuningName];
  const d = h('details', { class: 'tun-ed', open: TUNED.open || isCustom, ontoggle: e => { TUNED.open = e.target.open; } }, h('summary', {}, 'Custom tuning · set each string' + (isCustom ? '  —  active' : '')));
  const row = h('div', { class: 'tun-row' });
  const opts = []; for (let m = 24; m <= 79; m++) opts.push(m);
  for (let i = 0; i < 6; i++) {
    const sel = h('select', { class: 'in', title: 'String ' + (6 - i) + (i === 0 ? ' (lowest)' : i === 5 ? ' (highest)' : ''), onchange: () => { const arr = S.tuning.slice(); arr[i] = +sel.value; setTuning(arr); } }, opts.map(m => h('option', { value: m }, tunNote(m))));
    sel.value = S.tuning[i]; row.append(h('label', { class: 'field' }, 'String ' + (6 - i), sel));
  }
  const shift = (n) => () => setTuning(S.tuning.map(m => m + n));
  const dropLow = () => { const a = S.tuning.slice(); a[0] -= 2; setTuning(a); };
  d.append(row, h('div', { class: 'row', style: { gap: '6px', marginTop: '8px', flexWrap: 'wrap' } },
    h('button', { class: 'btn sm', title: 'Tune every string down a half step', onclick: shift(-1) }, '↓ ½ step'), h('button', { class: 'btn sm', title: 'Tune every string up a half step', onclick: shift(1) }, '↑ ½ step'),
    h('button', { class: 'btn sm', title: 'Lower the lowest string a whole step (drop tuning)', onclick: dropLow }, 'Drop low string'),
    h('button', { class: 'btn sm', onclick: () => setTuning(TUNINGS['Standard (E A D G B E)'], 'Standard (E A D G B E)') }, 'Reset to standard'),
    h('span', { class: 'tiny muted' }, 'Six strings, notes E1–G5. Voicings, tab playback, the tuner, chord detection and transcription all follow it.')));
  return d;
}
function songField(label, el) { return h('label', { class: 'field' }, label, el); }
const SECNAMES = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Solo', 'Interlude', 'Outro'];
const secStart = si => S.sections.slice(0, si).reduce((a, s) => a + s.bars.length, 0);
/* Song pane = the song's structure map + chord library. Chords and lyrics are edited in the Refine panel (right sidebar). */
function buildSongPane() {
  const p = PANES.song; UI.songHint = h('div', { class: 'card sg-hint' }); UI.songMap = h('div', { class: 'card' }); UI.songChords = h('div', { class: 'card' });
  UI.refineBox = h('div', { class: 'refine' }); p.append(UI.songHint, UI.songMap, UI.songChords);
  UI.songHint.append(h('div', { class: 'card-b row' }, h('span', { class: 'grow small' }, h('b', {}, 'Chords & lyrics live in the Refine panel'), ' on the right, so you can keep them open next to the tab, the rig or a loaded track. Song details (title, tuning, capo…) are in the strip above.'), h('button', { class: 'btn sm primary', onclick: () => sideShow('refine') }, 'Open Refine ▸')));
  bus.on('song', () => { if (SP.lock) return; renderSong(); }); bus.on('sel', () => renderSong()); renderSong();
}
function renderSong() { if (!UI.songMap) return; renderSongMap(); renderRefine(); renderChordLibrary(); }
function secActions(sec, si) {
  const mv = d => { const j = si + d; if (j < 0 || j >= S.sections.length) return; [S.sections[si], S.sections[j]] = [S.sections[j], S.sections[si]]; SEL.sec = j; commit(); };
  const b = (txt, title, fn, cls) => h('button', { class: 'btn sm ' + (cls || ''), title, onclick: fn }, txt);
  return h('span', { class: 'row', style: { gap: '4px', flexWrap: 'nowrap' } },
    b('▶', 'Play from this section', () => { T.cursor = secStart(si) * spb(); if (T.playing) stopPlay(true); play(); }), b('↑', 'Move up', () => mv(-1)), b('↓', 'Move down', () => mv(1)),
    b('⧉', 'Duplicate section', () => { const c = JSON.parse(JSON.stringify(sec)); c.id = uid(); c.name += ' (copy)'; S.sections.splice(si + 1, 0, c); commit(); }),
    b('✕', 'Delete section', () => { if (S.sections.length > 1 || confirm('Delete the last section?')) { S.sections.splice(si, 1); SEL.sec = 0; commit(); } }, 'bad'));
}
function addSectionRow(tip) {
  const ns = h('select', { class: 'in', 'aria-label': 'Section to add', style: { width: '140px', fontFamily: 'var(--sans)' } }, SECNAMES.map(n => h('option', {}, n)));
  return h('div', { class: 'row', style: { gap: '8px', margin: '2px 0 10px' } }, h('b', { class: 'small' }, 'Add section'), ns,
    h('button', { class: 'btn primary sm', onclick: () => { const base = ns.value, n = S.sections.filter(s => s.name.startsWith(base)).length; const nm = base === 'Verse' || base === 'Chorus' ? base + ' ' + (n + 1) : n ? base + ' ' + (n + 1) : base; S.sections.push(mkSection(nm, ['', '', '', ''])); SEL.sec = S.sections.length - 1; commit(); } }, '＋ Add'),
    tip ? h('span', { class: 'muted small' }, tip) : null);
}
function renderSongMap() {
  const m = UI.songMap; m.innerHTML = ''; const sp = spb();
  m.append(h('h4', {}, 'Structure', h('span', { class: 'badge' }, totalBars() + ' bars · ' + fmtTime(totalBars() * sp * slotDur()))));
  const body = h('div', { class: 'card-b' }); const col = TL.col && TL.col.cv ? TL.col.cv : ['#0a9aa6', '#e4572e', '#8a5cf5', '#e0a31a', '#2e9d57'];
  S.sections.forEach((sec, si) => {
    const chords = [...new Set(sec.bars.flatMap(barChords))].slice(0, 8).join(' '), ly = (sec.lyrics || '').split('\n').find(l => l.trim());
    body.append(h('div', { class: 'secrow' + (SEL.sec === si ? ' on' : ''), onclick: e => { if (e.target.closest('button')) return; SEL.sec = si; SEL.bar = 0; TL.dirty = true; bus.emit('sel'); sideShow('refine'); } },
      h('i', { class: 'sw', style: { background: col[si % col.length] } }), h('b', { class: 'sn' }, sec.name), h('span', { class: 'tiny muted' }, sec.bars.length + ' bars'),
      h('span', { class: 'mono small sc' }, chords || '—'), h('span', { class: 'tiny muted sl' }, ly ? lyricPlain(ly).slice(0, 48) : ''), secActions(sec, si)));
  });
  body.append(addSectionRow('Tip: Theory ▸ Progressions (left) fills a section with a progression in this key.')); m.append(body);
}
/* ---------- Refine: the chord + lyric canvas, shown in the right sidebar ---------- */
const RF = { acc: null };
function renderRefine() {
  const box = UI.refineBox; if (!box) return; box.innerHTML = ''; if (RF.acc == null) RF.acc = CFG.rfAcc !== false;
  const tb = h('div', { class: 'rf-bar' }, h('b', { class: 'small' }, 'REFINE'), h('span', { class: 'tiny muted grow' }, S.sections.length + ' sections · ' + totalBars() + ' bars'),
    h('button', { class: 'btn sm' + (RF.acc ? ' on' : ''), title: 'On: only the selected section is open. Off: every section open.', onclick: () => { RF.acc = !RF.acc; CFG.rfAcc = RF.acc; saveCfg(); renderRefine(); } }, RF.acc ? 'One at a time' : 'All open'));
  tb.insertBefore(h('button', { class: 'btn sm primary', title: 'Paste a finished lyric sheet: [Verse] / [Chorus] headings become sections, with your chords placed over the words', onclick: () => liOpen() }, '📋 Paste lyrics'), tb.querySelector('.grow').nextSibling);
  box.append(tb); if (!box._li) { box._li = 1; liWire(box); }
  if (!S.sections.some(s => (s.lyrics || '').trim())) box.append(h('div', { class: 'card', style: { padding: '12px', margin: '0 0 10px' } }, h('b', { class: 'small' }, 'Lyrics already written?'), h('div', { class: 'tiny muted', style: { margin: '4px 0 8px' } }, 'Paste the whole sheet (headings like [Verse 1] and [Chorus] become sections) or drop a .txt file here. Your chords are placed over the words.'), h('button', { class: 'btn primary sm', onclick: () => liOpen() }, '📋 Paste lyrics…')));
  S.sections.forEach((sec, si) => box.append(sectionCard(sec, si, RF.acc && SEL.sec !== si)));
  box.append(addSectionRow());
}
function sectionCard(sec, si, compact, opt) {
  const lean = !!(opt && opt.lean);                 // lean: only the words (the Write canvas shows the bars and chords itself, in the tab)
  const card = h('div', { class: 'card sec' + (SEL.sec === si ? ' sel' : '') });
  if (compact) {
    const chords = [...new Set(sec.bars.flatMap(barChords))].slice(0, 6).join(' '), ly = (sec.lyrics || '').split('\n').find(l => l.trim());
    card.append(h('div', { class: 'card-h sec-c', title: 'Open this section', onclick: () => { SEL.sec = si; SEL.bar = 0; TL.dirty = true; bus.emit('sel'); } }, h('b', {}, '▸ ' + sec.name), h('span', { class: 'tiny muted grow', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, sec.bars.length + ' bars · ' + (chords || '—') + (ly ? ' · ' + lyricPlain(ly).slice(0, 30) : ''))));
    return card;
  }
  const nameIn = lean ? null : h('input', { class: 'in', 'aria-label': 'Section name', value: sec.name, style: { width: '150px', fontFamily: 'var(--sans)', fontWeight: 800 }, onfocus: () => { SEL.sec = si; }, oninput: e => { sec.name = e.target.value; SP.lock = true; commit(false); SP.lock = false; } });
  if (!lean) card.append(h('div', { class: 'card-h' }, nameIn, secActions(sec, si)));
  const body = h('div', { class: 'card-b' }), row = h('div', { class: 'barrow' });
  if (!lean) sec.bars.forEach((bar, bi) => {
    const inp = h('input', { value: bar.chord, placeholder: '—', spellcheck: false, class: bar.chord && barChords(bar).some(c => !parseChord(c)) ? 'bad' : '', onfocus: () => { SEL.sec = si; SEL.bar = bi; },
      oninput: e => { bar.chord = e.target.value; e.target.classList.toggle('bad', barChords(bar).some(c => !parseChord(c))); SP.lock = true; commit(false); SP.lock = false; renderChordLibrary(); }, onchange: () => commit(true) });
    const rn = barChords(bar).map(c => { const pc = parseChord(c); return pc ? ['I', '♭II', 'II', '♭III', 'III', 'IV', '♭V', 'V', '♭VI', 'VI', '♭VII', 'VII'][(pc.root - S.key + 12) % 12] : '?'; }).join(' ');
    row.append(h('div', { class: 'barc' }, h('label', {}, (bi + 1) + (rn ? ' · ' + rn : '')), inp, h('div', { class: 'row', style: { gap: '2px' } },
      h('button', { class: 'btn sm', style: { padding: '0 5px', height: '16px', fontSize: '10px' }, title: 'Insert bar after', onclick: () => { sec.bars.splice(bi + 1, 0, newBar(bar.chord)); commit(); } }, '＋'),
      h('button', { class: 'btn sm', style: { padding: '0 5px', height: '16px', fontSize: '10px' }, title: 'Edit this bar in the Tab editor', onclick: () => { TE.sec = si; TE.bi = bi; dockGo('tab'); } }, '𝄞'),
      h('button', { class: 'btn sm bad', style: { padding: '0 5px', height: '16px', fontSize: '10px' }, title: 'Delete bar', onclick: () => { if (sec.bars.length > 1) { sec.bars.splice(bi, 1); commit(); } } }, '✕'))));
  });
  if (!lean) body.append(row, h('div', { class: 'tiny muted', style: { margin: '4px 0 10px' } }, 'Two chords in one bar: type them with a space (“Am G”). Slash chords (“C/G”), sus, add9, 7ths, 9ths, 11ths and 13ths are all supported.'));
  // lyrics
  const used = [...new Set(sec.bars.flatMap(barChords))].filter(c => parseChord(c));
  const ta = h('textarea', { class: 'lyr in', spellcheck: true, onpaste: liPaste, placeholder: 'Type lyrics. Put chords inline in square brackets right before the syllable they land on:\n[Am]Salt wind on the [F]water…', style: { fontFamily: 'var(--mono)' }, oninput: () => { sec.lyrics = ta.value; SP.lock = true; commit(false); SP.lock = false; refresh(); } }, sec.lyrics || '');
  const prev = h('div', { class: 'lyr-prev' }), ana = h('div', { class: 'small' });
  const ins = c => { const s = ta.selectionStart, e = ta.selectionEnd; ta.setRangeText('[' + c + ']', s, e, 'end'); ta.focus(); ta.dispatchEvent(new Event('input')); };
  const refresh = () => {
    prev.innerHTML = ''; (ta.value || '').split('\n').forEach(l => { const r = chordOverLine(l); if (r.hasChords) prev.append(h('span', { class: 'c' }, r.chordLine + '\n')); prev.append(r.text + '\n'); });
    const lines = (ta.value || '').split('\n'), sch = rhymeScheme(lines); ana.innerHTML = '';
    const tb = h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, 'Line'), h('th', {}, 'Syl.'), h('th', {}, 'Rhyme'))); let tot = 0, n = 0;
    lines.forEach((l, i) => { if (!l.trim()) return; const sy = lineSyl(l); tot += sy; n++; tb.append(h('tr', {}, h('td', { style: { fontFamily: 'var(--sans)' } }, lyricPlain(l).slice(0, 52)), h('td', {}, String(sy)), h('td', {}, sch[i] || ''))); });
    ana.append(n ? tb : h('span', { class: 'muted' }, 'No lyric lines yet.'), n ? h('div', { class: 'tiny muted', style: { marginTop: '4px' } }, 'Scheme: ' + sch.filter(Boolean).join('') + ' · mean ' + (tot / n).toFixed(1) + ' syllables/line (heuristic count)') : '');
  };
  body.append(h('div', { class: 'row', style: { gap: '6px', marginBottom: '5px' } }, h('b', { class: 'small' }, 'Lyrics'), h('span', { class: 'muted tiny' }, 'insert chord at cursor:'), h('div', { class: 'pal' }, used.map(c => h('button', { class: 'btn sm', onclick: () => ins(c) }, c)))),
    h('div', { class: 'lyr-grid' }, ta, prev), h('details', { style: { marginTop: '8px' } }, h('summary', { class: 'small muted', style: { cursor: 'pointer' } }, 'Syllable & rhyme analysis'), ana));
  refresh(); card.append(body); return card;
}
function renderChordLibrary() {
  const c = UI.songChords; if (!c) return; c.innerHTML = ''; const all = [...new Set(S.sections.flatMap(s => s.bars.flatMap(barChords)))].filter(x => parseChord(x));
  c.append(h('h4', {}, 'Chord library · voicings for ' + S.tuningName.replace(/\s*\(.*$/, '') + (S.capo ? ', capo ' + S.capo : '')));
  const b = h('div', { class: 'card-b' }); if (!all.length) b.append(h('span', { class: 'muted' }, 'Add chords to bars to see voicings.'));
  all.forEach(sym => {
    const vs = voicings(sym, S.tuning, S.capo, 8); if (!vs.length) return b.append(h('div', { class: 'small', style: { marginBottom: '6px' } }, h('b', {}, sym), ' — no playable voicing in this tuning'));
    const cur = S.voicePref[sym] || 0, row = h('div', { class: 'vcs', style: { marginBottom: '8px', alignItems: 'center' } }, h('b', { style: { font: '800 15px var(--mono)', minWidth: '58px' } }, sym));
    vs.forEach((v, i) => row.append(h('div', { class: 'vc' + (i === cur ? ' on' : ''), title: 'Use this voicing for playback and the tab auto-fill (' + v.frets.map(f => f == null ? 'x' : f).join('-') + ')', onclick: () => { S.voicePref[sym] = i; commit(false); renderChordLibrary(); } }, chordSVG(v, { w: 64, h: 80 }), h('div', {}, v.frets.map(f => f == null ? 'x' : f).join(''))))); b.append(row);
  });
  c.append(b);
}

/* ============================================================
   BAND PANE
   ============================================================ */
function buildBandPane() {
  const p = PANES.band; UI.bandBox = h('div'); p.append(UI.bandBox); bus.on('song', e => { if (e === 'reload' || paneVisible('band')) renderBand(); }); bus.on('dock', id => { if (id === 'band') renderBand(); }); renderBand();
}
function renderBand() {
  const B = S.band, bx = UI.bandBox; if (!bx) return; const ae = document.activeElement; if (ae && ae.type === 'range' && bx.contains(ae)) return; bx.innerHTML = '';
  const sel = (label, opts, val, fn, w) => songField(label, h('select', { style: { width: (w || 150) + 'px' }, onchange: e => { fn(e.target.value); } }, opts.map(o => h('option', { selected: o === val }, o))));
  const tog = (label, k) => h('button', { class: 'btn sm' + (B[k] ? ' on' : ''), onclick: e => { B[k] = !B[k]; commit(false); e.target.classList.toggle('on', B[k]); } }, label);
  const drums = h('div', { class: 'card' }, h('h4', {}, 'Drums ', tog('Enabled', 'drumsOn')), h('div', { class: 'card-b' },
    h('div', { class: 'row', style: { gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '8px' } }, sel('Kit', Object.keys(KITS), B.kit, v => { B.kit = v; commit(false); }), sel('Pattern', Object.keys(DPATS), B.patName, v => { setDrumPattern(v); renderBand(); }, 170),
      songField('Length (steps)', h('select', { onchange: e => { B.drumLen = +e.target.value; commit(false); renderBand(); } }, [8, 12, 16, 24, 32].map(n => h('option', { selected: n === (B.drumLen || 16) }, n)))),
      h('button', { class: 'btn sm', onclick: () => { B.pat = DROWS.map(() => new Array(32).fill(0)); commit(false); renderBand(); } }, 'Clear'), h('button', { class: 'btn sm', onclick: () => { const pat = dpat(); pat.forEach(r => r.forEach((v, i) => { if (v && Math.random() < .25) r[i] = 0; else if (!v && Math.random() < .04) r[i] = 1; })); commit(false); renderBand(); } }, '🎲 Mutate'),
      h('span', { class: 'tiny muted' }, 'Click a step to cycle: off → ghost → normal → accent')),
    stepGrid()));
  const bass = h('div', { class: 'card' }, h('h4', {}, 'Bass ', tog('Enabled', 'bassOn')), h('div', { class: 'card-b row', style: { gap: '10px', flexWrap: 'wrap' } }, sel('Style', BASS_STYLES, B.bassStyle, v => { B.bassStyle = v; commit(false); }), sel('Tone', ['Round', 'Sub', 'Pick', 'Muted Pluck'], B.bassTone, v => { B.bassTone = v; commit(false); })));
  const comp = h('div', { class: 'card' }, h('h4', {}, 'Rhythm guitar ', tog('Enabled', 'compOn')), h('div', { class: 'card-b row', style: { gap: '10px', flexWrap: 'wrap' } }, sel('Strum / arpeggio pattern', Object.keys(STRUMS), B.compStyle, v => { B.compStyle = v; commit(false); }, 190), sel('Instrument', ['Steel', 'Nylon', 'Electric', 'Muted Pluck'], B.compInst, v => { B.compInst = v; commit(false); }),
    h('span', { class: 'tiny muted' }, 'Voicings come from the Chord library (Song panel) in the current tuning and capo.')));
  const lead = h('div', { class: 'card' }, h('h4', {}, 'Tab playback (lead) ', tog('Enabled', 'leadOn')), h('div', { class: 'card-b row', style: { gap: '10px', flexWrap: 'wrap' } }, sel('Instrument', ['Nylon', 'Steel', 'Electric', 'Muted Pluck'], B.leadInst, v => { B.leadInst = v; commit(false); }),
    songField('Humanize', h('input', { type: 'range', min: 0, max: 1, step: .05, value: CFG.humanize, oninput: e => { CFG.humanize = +e.target.value; saveCfg(); } })), songField('Swing', h('input', { type: 'range', min: 0, max: .5, step: .01, value: S.swing, oninput: e => { S.swing = +e.target.value; commit(false); } }))));
  bx.append(ensembleCard(), drums, bass, comp, lead);
}
function ensembleCard() {
  const B = S.band, info = {
    drums: ['🥁', 'Drums', 'drumsOn', () => B.kit + ' · ' + B.patName, () => Object.keys(DPATS), () => B.patName, v => { setDrumPattern(v); }],
    bass: ['〰', 'Bass', 'bassOn', () => B.bassStyle + ' · ' + B.bassTone, () => BASS_STYLES, () => B.bassStyle, v => { B.bassStyle = v; commit(false); }],
    rhythm: ['🎸', 'Rhythm guitar', 'compOn', () => B.compStyle + ' · ' + B.compInst, () => Object.keys(STRUMS), () => B.compStyle, v => { B.compStyle = v; commit(false); }],
    lead: ['✦', 'Lead (tab playback)', 'leadOn', () => 'plays your tab · ' + B.leadInst, () => ['Nylon', 'Steel', 'Electric', 'Muted Pluck'], () => B.leadInst, v => { B.leadInst = v; commit(false); }]
  };
  const tiles = h('div', { class: 'ens' });
  Object.keys(info).forEach(id => {
    const [ic, nm, key, sub, opts, cur, set] = info[id], m = S.mix[id], t = h('div', { class: 'etile' + (B[key] ? ' on' : '') });
    const pw = h('button', { class: 'epower', title: 'Enable / disable ' + nm, onclick: () => { toggleBand(key); } }, '⏻');
    const sl = h('input', { type: 'range', min: 0, max: 1.4, step: .01, value: m.g, title: 'Level', style: { flex: 1 }, oninput: e => { m.g = +e.target.value; applyMix(); commit(false); } });
    t.append(h('div', { class: 'eh' }, pw, h('b', {}, ic + ' ' + nm), h('button', { class: 'btn sm' + (m.m ? ' on' : ''), title: 'Mute (keeps it enabled)', onclick: e => { m.m = m.m ? 0 : 1; e.target.classList.toggle('on', !!m.m); applyMix(); commit(false); } }, 'M'), h('button', { class: 'btn sm' + (m.s ? ' on' : ''), title: 'Solo', onclick: e => { m.s = m.s ? 0 : 1; e.target.classList.toggle('on', !!m.s); applyMix(); commit(false); } }, 'S')),
      h('div', { class: 'ebody', style: { display: 'flex', flexDirection: 'column', gap: '7px' } }, h('div', { class: 'sub' }, sub()),
        h('select', { class: 'in', style: { fontFamily: 'var(--sans)' }, onchange: e => { set(e.target.value); renderBand(); } }, opts().map(o => h('option', { selected: o === cur() }, o))),
        h('div', { class: 'row', style: { gap: '6px', flexWrap: 'nowrap' } }, h('span', { class: 'tiny muted' }, 'LEVEL'), sl)));
    tiles.append(t);
  });
  const mixes = h('div', { class: 'row', style: { gap: '6px', margin: '0 0 10px' } }, h('span', { class: 'tiny muted', style: { fontWeight: 800, letterSpacing: '.1em' } }, 'REHEARSAL MIX'), REHEARSAL.map(([n, c]) => h('button', { class: 'btn sm', title: 'Set who plays with you', onclick: () => setRehearsal(c) }, n)));
  return h('div', {}, h('div', { class: 'small muted', style: { margin: '0 0 8px', lineHeight: 1.5 } }, 'The band is always one click away: the strip above the panels and the ⏻ on each arrangement lane switch the same instruments. Hotkeys: ', h('kbd', {}, 'D'), ' drums · ', h('kbd', {}, 'B'), ' bass · ', h('kbd', {}, 'G'), ' rhythm guitar · ', h('kbd', {}, 'T'), ' lead tab.'), tiles, mixes);
}
function stepGrid() {
  const B = S.band, L = Math.min(B.drumLen || 16, 32), pat = dpat(), g = h('div', { class: 'dgrid', style: { gridTemplateColumns: '78px repeat(' + L + ',minmax(14px,1fr))' } }); UI.steps = [];
  DROWS.forEach((name, r) => {
    g.append(h('div', { class: 'lab' }, name));
    for (let i = 0; i < L; i++) {
      if (!pat[r]) pat[r] = new Array(32).fill(0);
      const st = h('button', { class: 'step' + (i % 4 === 0 ? ' g4' : '') + ' v' + (pat[r][i] || 0), title: name + ' · step ' + (i + 1), onclick: () => {
        pat[r][i] = ((pat[r][i] || 0) + 1) % 4; st.className = 'step' + (i % 4 === 0 ? ' g4' : '') + ' v' + pat[r][i]; B.patName = B.patName.replace(/ \(edited\)$/, '') + ' (edited)'; commit(false);
        if (pat[r][i] && E.ready) drumHit(r, E.ctx.currentTime + .01, pat[r][i]);
      } }); g.append(st);
    }
  }); return g;
}

/* ============================================================
   EXPORT PANE
   ============================================================ */
const EX = { fmt: 'ug' };
function buildExportPane() {
  const p = PANES.exp; UI.exOut = h('textarea', { class: 'in', readOnly: true, spellcheck: false, style: { width: '100%', height: '340px', fontFamily: 'var(--mono)', fontSize: '12px', whiteSpace: 'pre', overflow: 'auto' } });
  UI.exLint = h('div', { class: 'small' }); const opts = { header: true, tabs: true, lyrics: true, tags: true, bars: true };
  const chk = (k, label) => h('label', { class: 'chk', style: { display: 'flex', gap: '5px', alignItems: 'center', fontSize: '12px', fontWeight: 600 } }, h('input', { type: 'checkbox', checked: opts[k], onchange: e => { opts[k] = e.target.checked; if (k === 'tags') { CFG.ugTags = opts[k]; saveCfg(); } gen(); } }), label);
  opts.tags = CFG.ugTags !== false;
  const seg = h('div', { class: 'seg' }, [['ug', 'Ultimate Guitar'], ['cp', 'ChordPro'], ['ly', 'Lyrics only'], ['tab', 'Tab only']].map(([k, n]) => h('button', { class: k === EX.fmt ? 'on' : '', onclick: e => { EX.fmt = k; $$('button', seg).forEach(b => b.classList.toggle('on', b === e.target)); gen(); } }, n)));
  const gen = () => { UI.exOut.value = EX.fmt === 'ug' ? buildUG(opts) : EX.fmt === 'cp' ? buildChordPro() : EX.fmt === 'ly' ? buildLyricsOnly() : S.sections.filter(hasTab).map(s => '[' + s.name + ']\n' + renderTabBars(s.bars)).join('\n\n') + '\n'; const L = lintSong(); UI.exLint.innerHTML = ''; L.forEach(x => UI.exLint.append(h('div', { style: { color: x.sev === 'err' ? 'var(--bad)' : x.sev === 'warn' ? 'var(--warn)' : x.sev === 'ok' ? 'var(--good)' : 'var(--muted)', padding: '1px 0' } }, (x.sev === 'err' ? '✕ ' : x.sev === 'warn' ? '⚠ ' : x.sev === 'ok' ? '✓ ' : 'ⓘ ') + x.m))); };
  const fn = ext => (S.title || 'song').replace(/\W+/g, '_') + ext;
  const imp = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, onchange: e => { if (e.target.files[0]) importProject(e.target.files[0]); e.target.value = ''; } });
  p.append(h('div', { class: 'card' }, h('h4', {}, 'Ultimate Guitar / chart export'), h('div', { class: 'card-b' },
    h('div', { class: 'row', style: { gap: '12px', marginBottom: '8px', flexWrap: 'wrap' } }, seg, chk('header', 'Header'), chk('bars', 'Chord line'), chk('lyrics', 'Lyrics'), chk('tabs', 'Tab'), chk('tags', '[ch] / [tab] tags'), h('span', { class: 'grow' }),
      h('button', { class: 'btn primary', onclick: () => copyText(UI.exOut.value) }, 'Copy'), h('button', { class: 'btn', onclick: () => download(fn(EX.fmt === 'cp' ? '.cho' : '.txt'), UI.exOut.value) }, 'Download')),
    UI.exOut, h('div', { class: 'tiny muted', style: { marginTop: '5px' } }, 'Paste into the Ultimate Guitar submission editor. Chords use [ch] tags and monospaced blocks use [tab] so alignment survives. Turn tags off for plain text. Your own song: share it freely. A chart, lyrics or tab of someone else’s song is based on their work, so check the rules of the site you post to, and the rights holder, first.'))),
    h('div', { class: 'card' }, h('h4', {}, 'Submission lint'), h('div', { class: 'card-b' }, UI.exLint)),
    h('div', { class: 'card' }, h('h4', {}, 'Files'), h('div', { class: 'card-b row', style: { gap: '8px', flexWrap: 'wrap' } }, h('div', { class: 'tiny muted', style: { flexBasis: '100%' } }, 'Audio, share pages and project files carry your words and sound, and anything you brought in. Send them only where you have the right to.'),
      h('button', { class: 'btn', onclick: () => { download(fn('.mid'), buildMidi()); toast('MIDI saved (rhythm, lead, bass, drums on separate tracks)', 'ok'); } }, '⤓ MIDI'),
      h('button', { class: 'btn', onclick: () => bounceMaster() }, '⤓ Bounce master WAV'), exportExtras(),
      h('button', { class: 'btn', title: 'One WAV per band part (drums, bass, rhythm, lead). Each one is rendered faster than it plays, with the other parts silenced.', onclick: () => bounceAllParts() }, '⤓ Each band part (WAVs)'),
      h('button', { class: 'btn', onclick: () => { if (!TAKES.length) return toast('No takes recorded yet', 'warn'); tkLeads().forEach((t, i) => setTimeout(() => dlTake(t), i * 700)); } }, '⤓ All takes (dry DI + wet)'),
      h('button', { class: 'btn', onclick: exportProject }, '⤓ Project JSON (Ctrl+S)'), h('button', { class: 'btn', onclick: () => imp.click() }, '⤒ Import project'), imp,
      h('button', { class: 'btn bad', onclick: () => { if (confirm('Replace the current song with the demo? (Undo with Ctrl+Z)')) { S = demoSong(); commit(true); bus.emit('song', 'reload'); } } }, 'Load demo song'),
      h('button', { class: 'btn bad', onclick: () => { if (confirm('Start a blank song? (Undo with Ctrl+Z)')) { S = newSong(); S.sections = [mkSection('Verse 1', ['', '', '', ''])]; commit(true); bus.emit('song', 'reload'); } } }, 'New blank song'))));
  bus.on('song', () => { if (paneVisible('exp')) gen(); }); bus.on('dock', id => { if (id === 'exp') gen(); }); gen();
}
