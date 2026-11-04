/* ============================================================
   Part 82 · LEARN (2.32) — the Teacher workspace's front door: a place to be taught
     · Lessons      paths (Foundations, Lead, Rhythm, Technique) whose steps demonstrate, then listen (part 80, 81)
     · Warm-ups     five minutes before you play
     · Riffs & licks  the library, by style and level: listen, play it, in time, in any key, put it in your song
     · Riff Lab     new riffs from a scale, a feel and a length; then vary them (shift, reverse, major ↔ minor, bends, higher,
                    sequence) and keep the ones you like
     · Scale atlas  the five pentatonic boxes, three-notes-per-string shapes, arpeggios in five positions, the modes over a band vamp
                    that shows their colour, and target notes over changes
     · For teachers annotate, lesson notes, record the screen; turn bars of the song into an exercise; share or open lesson files
   ============================================================ */
/* ---------- putting a riff in the song ---------- */
/** the piece's notes into a new section after the one you are in (undoable), the lead switched on so it plays */
function learnToSong(p) {
  const ns = coNotes().filter(n => !n.r); if (!ns.length) return false; const sp = spb(), bars = Math.max(1, Math.ceil((p.len || 16) / sp)), cap = S.capo || 0, bf = snap();
  const sec = mkSection(String(p.title || 'Riff').slice(0, 40), Array.from({ length: bars }, () => ''));
  ns.forEach(n => { const b = sec.bars[Math.floor(n.at / sp)]; if (!b) return; (n.ch || [n]).forEach(x => { const f = x.f - cap; if (f < 0) return; const t = n.t === 'b' ? 'b' : n.t === 'h' || n.t === 'p' || n.t === '/' || n.t === '~' ? n.t : ''; const o = { s: n.at % sp, st: x.s, f: n.t === 'x' ? 'x' : f, t }; if (t === 'b') o.bend = f + (n.b || 2); b.tab.push(o); }); });
  const at = Math.min(S.sections.length, pedalSecs().i + 1); S.sections.splice(at, 0, sec); S.band.leadOn = true; T.cursor = S.sections.slice(0, at).reduce((a, x) => a + x.bars.length, 0) * sp;
  histPush(bf); bus.emit('transport'); toast('“' + sec.name + '” is in your song as a new section (' + bars + ' bar' + (bars > 1 ? 's' : '') + '), with the lead playing its tab. Undo takes it out.', 'ok'); return true;
}
/** a lesson or riff file to give to a student: the pieces as they are (notes, words, tempo) */
function learnFileText(pieces, title) {
  const clean = pieces.map(p => { const o = {}; ['kind', 'title', 'text', 'tip', 'bpm', 'len', 'keyPc', 'lift', 'near', 'src', 'notes', 'back', 'pattern', 'chords', 'bars', 'secs', 'goal', 'keyed'].forEach(k => { if (p[k] != null) o[k] = p[k]; }); if (o.src) delete o.notes; return o; });
  return JSON.stringify({ daily: 'lesson', v: 1, title: title || '', pieces: clean }, null, 1);
}
function learnFile(pieces, title) { download((title || 'lesson').replace(/\W+/g, '_') + '.daily-lesson.json', learnFileText(pieces, title), 'application/json'); }
/** a file from a teacher: checked piece by piece; anything it does not understand is left out */
function learnOpenFile(text) {
  let o; try { o = JSON.parse(text); } catch (e) { toast('That is not a lesson file.', 'warn'); return false; }
  if (!o || o.daily !== 'lesson' || !Array.isArray(o.pieces)) { toast('That is not a lesson file.', 'warn'); return false; }
  const num = (v, a, b, d) => { v = +v; return isFinite(v) ? Math.max(a, Math.min(b, v)) : d; }, str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
  const okNote = n => n && typeof n === 'object' && isFinite(+n.at) && isFinite(+n.len), cleanNote = n => { const q = { at: num(n.at, 0, 64, 0), len: num(n.len, 1, 32, 2) }; if (n.r) q.r = true; else { if (n.i != null) q.i = num(n.i, -24, 48, 0); if (n.m != null) q.m = num(n.m, 24, 108, 60); if (n.s != null) q.s = num(n.s, 0, 7, 0); if (n.f != null) q.f = num(n.f, 0, 24, 0); if (Array.isArray(n.ch)) q.ch = n.ch.slice(0, 6).map(x => typeof x === 'object' ? { m: num(x.m, 24, 108, 60), s: num(x.s, 0, 7, 0), f: num(x.f, 0, 24, 0) } : num(x, -24, 48, 0)); if (/^[bhp\/~x]$/.test(n.t || '')) q.t = n.t; if (n.b) q.b = num(n.b, 1, 3, 2); if (n.to != null) q.to = num(n.to, 24, 110, 62); } return q; };
  const ps = o.pieces.slice(0, 40).filter(p => p && CO_KINDS.includes(p.kind)).map((p, i) => { const q = { kind: p.kind, id: 'file.' + i + '.' + str(o.title, 40), title: str(p.title, 80) || 'Step ' + (i + 1), text: str(p.text, 600), tip: str(p.tip, 300), bpm: num(p.bpm, 40, 240, 80), len: num(p.len, 4, 64, 16) };
    if (Array.isArray(p.src)) { q.src = p.src.filter(okNote).slice(0, 128).map(cleanNote); q.keyPc = num(p.keyPc, 0, 11, 9); q.lift = num(p.lift, 0, 24, 0); q.near = num(p.near, 0, 15, 5); }
    else if (Array.isArray(p.notes)) q.notes = p.notes.filter(okNote).slice(0, 128).map(cleanNote);
    if (Array.isArray(p.chords)) q.chords = p.chords.slice(0, 8).map(c => str(c, 8)).filter(c => parseChord(c)); if (typeof p.pattern === 'string') q.pattern = p.pattern.replace(/[^Ddumx.]/g, '').slice(0, 32);
    if (p.back && typeof p.back === 'object') q.back = { drums: !!p.back.drums, bass: p.back.bass !== false, chords: Array.isArray(p.back.chords) ? p.back.chords.slice(0, 8).map(c => str(c, 8)).filter(c => parseChord(c)) : undefined };
    ['bars', 'secs', 'goal'].forEach(k => { if (p[k] != null) q[k] = num(p[k], 1, 120, 8); }); if (p.keyed === false) q.keyed = false;
    if (['chord', 'minute'].includes(q.kind) && !(q.chords && q.chords.length)) return null; if (['changes', 'landing'].includes(q.kind) && !(q.back && q.back.chords && q.back.chords.length)) return null; if (q.kind === 'rhythm' && !q.pattern) return null; if (['notes', 'timed', 'bend', 'vib'].includes(q.kind) && !(q.src || q.notes || []).length) return null;
    return q; }).filter(Boolean);
  if (!ps.length) { toast('Nothing in that file could be played.', 'warn'); return false; }
  coachOpen(ps, 0, { title: str(o.title, 80) || 'A lesson from a file' }); return true;
}
/** the bars of the section you are in (or the selected ones) as an exercise: the tab's notes, at the song's tempo */
function learnFromSong() {
  const si = pedalSecs().i, sec = S.sections[si]; if (!sec) return null; const sp = spb(), cap = S.capo || 0, notes = [];
  sec.bars.forEach((b, bi) => (b.tab || []).filter(n => typeof n.f === 'number').forEach(n => notes.push({ at: bi * sp + n.s, len: 2, m: S.tuning[n.st] + cap + n.f, s: n.st, f: n.f + cap, t: n.t === 'b' ? 'b' : '' })));
  if (!notes.length) { toast('This section has no tab notes yet. Write some in Write, or use ● Capture.', 'warn'); return null; }
  notes.sort((a, b) => a.at - b.at || a.s - b.s); const merged = []; notes.forEach(n => { const l = merged[merged.length - 1]; if (l && l.at === n.at) (l.ch = l.ch || [{ m: l.m, s: l.s, f: l.f }]).push({ m: n.m, s: n.s, f: n.f }); else merged.push(n); });
  return { kind: 'notes', id: 'song.' + (sec.id || si), title: (S.title || 'Song') + ' · ' + sec.name, text: 'The tab of this section, note by note. Teachers: share it as a file for your student.', bpm: Math.round(S.bpm), notes: merged, len: Math.max(16, sec.bars.length * sp), keyed: false };
}

/* ---------- Riff Lab ---------- */
const LAB_SCALES = ['Minor Pentatonic', 'Blues', 'Major Pentatonic', 'Natural Minor (Aeolian)', 'Dorian', 'Mixolydian', 'Major (Ionian)'];
const LAB_FEELS = { 'Straight eighths': { step: 2, low: false }, 'Funky sixteenths': { step: 1, low: false }, 'Shuffle': { step: 0, low: false }, 'Heavy half-time': { step: 2, low: true } };
CFG.learn.lab = Object.assign({ scale: 'Minor Pentatonic', feel: 'Straight eighths', bars: 1, dens: .6, key: null, seed: 1 }, CFG.learn.lab || {});
const labRng = seed => { let a = seed >>> 0 || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
/** a new riff: a motif of 3–6 notes on the scale, answered or sequenced, ending on a chord tone; bends and vibrato where the style likes them */
function labMake(o) {
  o = Object.assign({}, CFG.learn.lab, o || {}); const R = labRng(o.seed), iv = SCALES[o.scale] || SCALES['Minor Pentatonic'], F = LAB_FEELS[o.feel] || LAB_FEELS['Straight eighths'], L = 16 * (o.bars || 1);
  const pool = []; for (let oc = 0; oc < 2; oc++) iv.forEach(x => pool.push(x + 12 * oc)); pool.push(24); const home = F.low ? 0 : pool.indexOf(12);
  let grid = []; if (F.step === 0) { for (let b = 0; b < 4; b++) grid.push(b * 4, b * 4 + 3); } else for (let k = 0; k < 16; k += F.step) grid.push(k);
  const bar1 = grid.filter((k, j) => j === 0 || R() < o.dens), motifN = Math.max(3, Math.min(6, bar1.length)), rhythm = bar1.slice(0, motifN);
  let idx = home, motif = rhythm.map((k, j) => { if (j) { const r = R(), step = r < .55 ? 1 : r < .85 ? 2 : 3; idx = Math.max(0, Math.min(pool.length - 1, idx + (R() < .5 ? -step : step))); } return pool[idx]; });
  const notes = []; const push = (at, i, len) => notes.push({ at, len, i });
  rhythm.forEach((k, j) => push(k, motif[j], (rhythm[j + 1] != null ? rhythm[j + 1] : 16) - k));
  if (L > 16) { const seq = R() < .5; rhythm.forEach((k, j) => { let i = motif[j]; if (seq) { const d = pool.indexOf(i); i = pool[Math.min(pool.length - 1, d + 1)]; } push(16 + k, i, (rhythm[j + 1] != null ? rhythm[j + 1] : 16) - k); }); }
  const last = notes[notes.length - 1], tones = [0, 12, 7, 19, 24, 3, 4, 15, 16].filter(x => pool.includes(x)); let bestT = tones[0]; tones.forEach(x => { if (Math.abs(x - last.i) < Math.abs(bestT - last.i)) bestT = x; }); last.i = bestT; last.len = Math.max(last.len, 4); last.t = '~';
  const bendy = /Pentatonic|Blues/.test(o.scale); notes.forEach((n, j) => { if (j === notes.length - 1) return; if (bendy && n.len >= 3 && [3, 5, 10, 15, 17, 22].includes(n.i) && R() < .5) { n.t = 'b'; n.b = 2; } else if (j && notes[j - 1].i + 2 === n.i && R() < .25) n.t = '/'; });
  if (F.low) notes.forEach(n => { if (n.at % 8 === 0 && R() < .5 && iv.includes((n.i + 7) % 12)) n.ch = [n.i, n.i + 7]; });      /* a power chord, when its fifth is in the scale */
  notes.forEach(n => { n.len = Math.max(1, Math.min(n.len, L - n.at)); });
  return labPiece(notes, o, 'Idea #' + o.seed);
}
function labPiece(src, o, name) { const key = o.key != null ? o.key : S.key, F = LAB_FEELS[o.feel] || LAB_FEELS['Straight eighths']; return { kind: 'notes', id: 'lab.' + (o.seed || 0), title: name, name, src, len: rfLen(src), keyPc: key, lift: 0, near: F.low ? 0 : 5, bpm: o.bpm || (F.step === 1 ? 92 : 96), lab: Object.assign({}, o), text: o.scale + ' · ' + o.feel + ' · ' + (o.bars > 1 ? '2 bars' : '1 bar') + '. Vary it until it is yours, then keep it or put it in your song.' }; }
/** the variations: each a new piece from the one in the coach */
function labVary(p, how) {
  let src = (p.src || []).map(n => Object.assign({}, n)); const o = Object.assign({}, p.lab || { scale: 'Minor Pentatonic', feel: 'Straight eighths', bars: 1 }), L = p.len || 16, ns = src.filter(n => !n.r);
  const deg = (i, iv) => { const oc = Math.floor(i / 12), r = ((i % 12) + 12) % 12; let k = 0; iv.forEach((x, j) => { if (Math.abs(x - r) < Math.abs(iv[k] - r)) k = j; }); return [oc, k]; };
  switch (how) {
    case 'shift': src.forEach(n => { n.at = (n.at + 2) % L; }); src.sort((a, b) => a.at - b.at); src.forEach((n, j) => { const nx = src[j + 1]; n.len = Math.max(1, (nx ? nx.at : L) - n.at); }); break;
    case 'reverse': { const is = ns.map(n => n.i).reverse(); ns.forEach((n, j) => { n.i = is[j]; if (n.ch) n.ch = [n.i, n.i + (n.ch[1] - n.ch[0])]; n.t = j === ns.length - 1 ? '~' : ''; }); break; }
    case 'flip': { const minor = /Minor|Blues|Dorian|Aeolian/.test(o.scale), from = SCALES[o.scale] || SCALES['Minor Pentatonic'], toName = minor ? (o.scale === 'Natural Minor (Aeolian)' || o.scale === 'Dorian' ? 'Major (Ionian)' : 'Major Pentatonic') : (o.scale === 'Major (Ionian)' || o.scale === 'Mixolydian' ? 'Natural Minor (Aeolian)' : 'Minor Pentatonic'), to = SCALES[toName];
      ns.forEach(n => { const [oc, k] = deg(n.i, from); const j = Math.min(to.length - 1, Math.round(k * (to.length - 1) / Math.max(1, from.length - 1))); n.i = oc * 12 + to[j]; if (n.ch) { if (to.includes((n.i + 7) % 12)) n.ch = [n.i, n.i + 7]; else delete n.ch; } }); o.scale = toName; break; }
    case 'bends': ns.forEach((n, j) => { if (j < ns.length - 1 && n.len >= 2 && !n.t && j % 2 === 0) { n.t = 'b'; n.b = 2; } }); break;
    case 'higher': return Object.assign({}, p, { src, lift: (p.lift || 0) + 12 > 24 ? 0 : (p.lift || 0) + 12, near: (p.near || 5) + 5 > 14 ? 3 : (p.near || 5) + 5, title: p.title + ' (moved)', id: p.id + '.h' });
    case 'sequence': { if (L >= 32) { toast('Already two bars: try Shift or Reverse.', 'warn'); return p; } const iv = SCALES[o.scale] || SCALES['Minor Pentatonic']; ns.forEach(n => { const [oc, k] = deg(n.i, iv), k2 = k + 1, i2 = (oc + Math.floor(k2 / iv.length)) * 12 + iv[k2 % iv.length]; src.push(Object.assign({}, n, { at: n.at + 16, i: i2, ch: n.ch && iv.includes((i2 + 7) % 12) ? [i2, i2 + 7] : undefined })); }); o.bars = 2; break; }
  }
  const q = Object.assign({}, p, { src, len: rfLen(src), lab: o, id: p.id + '.' + how, title: p.title.replace(/ \(.*\)$/, '') + ' (' + how + ')' }); return q;
}
function labKeep(p) { const mine = CFG.learn.mine; if (mine.some(m => m.id === p.id)) { toast('Already kept.', 'ok'); return; } mine.unshift({ id: p.id, title: p.title, src: p.src, len: p.len, keyPc: CO.key != null ? CO.key : p.keyPc, lift: p.lift, near: p.near, bpm: CO.bpm, lab: p.lab, at: Date.now() }); if (mine.length > 60) mine.pop(); saveCfg(); toast('Kept in My riffs (Riffs & licks).', 'ok'); learnPaint(); }
/** the buttons under a riff or a lab idea in the coach */
function learnActions(p) {
  const mk = (id, label, fn, cls) => h('button', { class: 'btn sm' + (cls ? ' ' + cls : ''), id, onclick: fn }, label);
  const out = [mk('coTimed', p.kind === 'timed' ? '♪ Note by note' : '⏱ In time', () => { CO.p = Object.assign({}, p, { kind: p.kind === 'timed' ? 'notes' : 'timed', back: { drums: true } }); CO.list[CO.idx] = CO.p; coBuild(); }), mk('coSong', '➕ Put it in my song', () => learnToSong(CO.p), 'primary')];
  if (p.src && p.lab) ['shift', 'reverse', 'flip', 'bends', 'higher', 'sequence'].forEach(v => out.push(mk('coVar-' + v, { shift: '⇥ Shift', reverse: '⇄ Reverse', flip: '☯ Major ↔ minor', bends: '⤴ Add bends', higher: '⬆ Higher', sequence: '⧉ Sequence' }[v], () => { const q = labVary(CO.p, v); CO.list[CO.idx] = q; CO.p = q; coBuild(); })));
  if (p.src && p.lab) out.push(mk('coKeep', '★ Keep', () => labKeep(CO.p)), mk('coAgain', '🎲 Another', () => { CFG.learn.lab.seed = (CFG.learn.lab.seed || 1) + 1; saveCfg(); const q = labMake(); CO.list[CO.idx] = q; CO.p = q; coBuild(); learnPaint(); }));
  out.push(mk('coShare', '⇩ Share as a file', () => learnFile([Object.assign({}, CO.p, { keyPc: CO.key != null ? CO.key : CO.p.keyPc, bpm: CO.bpm })], CO.p.title)));
  return out;
}

/* ---------- the scale atlas ---------- */
const MODE_VAMP = { 'Major (Ionian)': [[0, ''], [5, '']], 'Dorian': [[0, 'm'], [5, '']], 'Phrygian': [[0, 'm'], [1, '']], 'Lydian': [[0, ''], [2, '']], 'Mixolydian': [[0, ''], [10, '']], 'Natural Minor (Aeolian)': [[0, 'm'], [8, '']], 'Locrian': [[0, 'dim'], [1, '']] };
const MODE_COLOUR = { 'Major (Ionian)': [11, 'the major seventh'], 'Dorian': [9, 'the major sixth'], 'Phrygian': [1, 'the flat second'], 'Lydian': [6, 'the sharp fourth'], 'Mixolydian': [10, 'the flat seventh'], 'Natural Minor (Aeolian)': [8, 'the flat sixth'], 'Locrian': [6, 'the flat fifth'] };
CFG.learn.atlas = Object.assign({ type: 'Pentatonic boxes', key: null, minor: true, pos: 1, mode: 'Dorian', chord: 'm7' }, CFG.learn.atlas || {});
/** notes of a shape, ascending: per string, up to `per` scale notes in the fret window that starts at `f0` */
function atShape(pcs, f0, per, span) {
  const tu = wsTune(), cap = S.capo || 0, out = []; let last = -1;
  tu.forEach((o, s) => { let n = 0; for (let f = Math.max(cap, f0 - 1); f <= f0 + span && n < per; f++) { const m = o + f; if (m <= last || !pcs.includes(((m % 12) + 12) % 12)) continue; out.push({ m, s, f }); last = m; n++; } });
  return out;
}
/** the five (or seven) starting frets: each scale note on the low string, from the nut (or the capo) up an octave */
/** the starting frets of the shapes: each scale note on the low string, from the key's root up an octave (shape 1 starts on the root, as guitarists count them) */
function atStarts(pcs, key) { const o = wsTune()[0], cap = S.capo || 0, rf = cap + ((((key != null ? key : pcs[0]) - o - cap) % 12) + 12) % 12, fs = []; for (let f = rf; f < rf + 12; f++) if (pcs.includes(((o + f) % 12 + 12) % 12)) fs.push(f > cap + 14 ? f - 12 : f); return fs; }
function atUpDown(ns) { const up = ns.slice(), seq = up.concat(up.slice(0, -1).reverse()); return seq.map((n, k) => ({ at: k * 2, len: 2, m: n.m, s: n.s, f: n.f })); }
function atlasPieces() {
  const A = CFG.learn.atlas, key = A.key != null ? A.key : S.key, kn = pcName(key, keyUsesFlats(key, A.minor)), pcsOf = name => (SCALES[name] || []).map(x => (key + x) % 12), t = A.type;
  if (t === 'Pentatonic boxes' || t === 'Three notes per string') {
    const name = t === 'Pentatonic boxes' ? (A.minor ? 'Minor Pentatonic' : 'Major Pentatonic') : (A.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)'), pcs = pcsOf(name), starts = atStarts(pcs, key), per = t === 'Pentatonic boxes' ? 2 : 3;
    return starts.map((f0, k) => { const ns = atShape(pcs, f0, per, per === 2 ? 4 : 6), notes = atUpDown(ns); return { kind: 'notes', id: 'atlas.' + t + '.' + name + '.' + key + '.' + k, title: kn + ' ' + name.replace(/ \(.*\)/, '') + ' · ' + (per === 2 ? 'box ' : 'position ') + (k + 1), text: (per === 2 ? 'Box ' + (k + 1) + ' of 5, from fret ' + f0 + '. Two notes on every string. ' : 'Position ' + (k + 1) + ' of ' + starts.length + ': three notes on every string, for speed and legato. ') + 'Up and back down; the roots (R) are home.', bpm: 76, notes, len: rfLen(notes), keyed: false, pcs }; });
  }
  if (t === 'Arpeggios') {
    const Q = { '': [0, 4, 7], 'm': [0, 3, 7], 'maj7': [0, 4, 7, 11], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 'm7b5': [0, 3, 6, 10] }, cq = Q[A.chord] ? A.chord : 'm7', pcs = Q[cq].map(x => (key + x) % 12), starts = atStarts(pcsOf(/m/.test(cq) && cq !== 'maj7' ? 'Minor Pentatonic' : 'Major Pentatonic'), key);
    return starts.map((f0, k) => { const ns = atShape(pcs, f0, 3, 4), notes = atUpDown(ns); return { kind: 'notes', id: 'atlas.arp.' + cq + '.' + key + '.' + k, title: kn + cq + ' arpeggio · position ' + (k + 1), text: 'Only the chord’s notes, in one area of the neck (the five positions are the CAGED shapes). Play it up and down; then hear how each note sits over the chord.', bpm: 72, notes, len: rfLen(notes), keyed: false, pcs, back: { chords: [kn + cq], bass: true, drums: false } }; });
  }
  if (t === 'Modes over a vamp') {
    const mode = MODE_VAMP[A.mode] ? A.mode : 'Dorian', pcs = pcsOf(mode), vamp = MODE_VAMP[mode].map(([iv, q]) => pcName((key + iv) % 12, keyUsesFlats(key, /m|dim/.test(MODE_VAMP[mode][0][1]))) + q), starts = atStarts(pcs, key), f0 = starts[Math.min(starts.length - 1, (A.pos || 1) - 1)];
    const ns = atShape(pcs, f0, 3, 6), notes = atUpDown(ns), [civ, cname] = MODE_COLOUR[mode]; notes.forEach(n => { if (((n.m - key) % 12 + 12) % 12 === civ) n.lab = '★'; });
    const m = mode.replace(/ \(.*\)/, '');
    return [{ kind: 'notes', id: 'atlas.mode.' + mode + '.' + key, title: kn + ' ' + m + ' over ' + vamp.join(' – '), text: 'The band plays ' + vamp.join(' and ') + ' over and over; play the ' + m + ' scale over it. The ★ is ' + cname + ': the note that makes ' + m + ' sound like itself. Lean on it.', bpm: 84, notes, len: rfLen(notes), keyed: false, pcs, back: { drums: true, bass: true, chords: vamp } },
      { kind: 'landing', id: 'atlas.modeland.' + mode + '.' + key, title: 'Improvise in ' + m, text: 'Now make it up: each time the chord changes, land on one of its notes.', bpm: 84, notes, len: 32, bars: 8, keyed: false, pcs, back: { drums: true, bass: true, chords: vamp } }];
  }
  /* target notes over changes */
  const minor = A.minor, prog = minor ? [[0, 'm'], [8, ''], [3, ''], [10, '']] : [[0, ''], [7, ''], [9, 'm'], [5, '']], chords = prog.map(([iv, q]) => pcName((key + iv) % 12, keyUsesFlats(key, minor)) + q), pcs = pcsOf(minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)'), f0 = atStarts(pcs, key)[0];
  const ns = atShape(pcs, f0, 3, 6);
  return [{ kind: 'landing', id: 'atlas.target.' + key + (minor ? 'm' : ''), title: 'Target notes over ' + chords.join(' – '), text: 'The band plays ' + chords.join(', ') + '. Your scale is on the neck; at every change, land on a note of the new chord. That is what makes a solo follow the song.', bpm: 84, notes: atUpDown(ns), len: 64, bars: 8, keyed: false, pcs, back: { drums: true, bass: true, chords } }];
}

/* ---------- the hub ---------- */
const lsDone = ls => ls.steps.filter(s => CFG.learn.done[s.id]).length;
/** redraw the hub (progress, My riffs). Never while the coach is open: redrawing reopens the hub, which would put it in front of the
    coach and hide it; the redraw waits for the coach to close */
let LRN_DIRTY = false;
function learnPaint() { const c = document.getElementById('coach'); if (c && c.open) { LRN_DIRTY = true; return; } LRN_DIRTY = false; const d = document.getElementById('learn'); if (!d || !d.open) return; const on = d.querySelector('.hub-nb.on'); learnOpen(on ? on.dataset.sec : undefined); }
function learnLessons(paths) {
  return h('div', { class: 'ln-paths' }, paths.map(path => h('div', { class: 'ln-path' }, h('div', { class: 'ln-ph' }, h('span', { class: 'ln-ico', 'aria-hidden': 'true' }, path.ico), h('div', {}, h('b', {}, path.name), h('small', {}, path.blurb))),
    h('ol', { class: 'ln-list' }, path.lessons.map(ls => { const n = lsDone(ls), all = ls.steps.length; return h('li', {}, h('button', { class: 'ln-ls' + (n === all ? ' done' : ''), 'data-lesson': ls.id, onclick: () => coachOpen(ls.steps, Math.min(n, all - 1), { title: path.name + ' · ' + ls.name }) },
      h('span', {}, ls.name), h('small', { class: 'mono' }, n === all ? '✓' : n + '/' + all))); })))));
}
function learnRiffs() {
  const f = CFG.learn.rf = CFG.learn.rf || { style: '', lvl: 0 }, box = h('div', { class: 'ln-riffs' });
  const list = RIFFS.filter(r => (!f.style || r.style === f.style) && (!f.lvl || r.lvl === f.lvl)), mine = CFG.learn.mine || [];
  box.append(h('div', { class: 'ln-filt' }, h('label', { class: 'field' }, 'Style', h('select', { class: 'in', id: 'rfStyle', onchange: e => { f.style = e.target.value; saveCfg(); learnPaint(); } }, [h('option', { value: '' }, 'All styles')].concat(RIFF_STYLES.map(s => h('option', { value: s, selected: f.style === s }, s))))),
    h('label', { class: 'field' }, 'Level', h('select', { class: 'in', id: 'rfLvl', onchange: e => { f.lvl = +e.target.value; saveCfg(); learnPaint(); } }, [[0, 'Any'], [1, '1 · first steps'], [2, '2 · getting there'], [3, '3 · stretch']].map(([v, t]) => h('option', { value: v, selected: f.lvl === v }, t)))), h('small', { class: 'muted' }, list.length + ' riffs')),
    h('div', { class: 'ln-grid' }, list.map(r => h('button', { class: 'ln-card' + (CFG.learn.done[r.id] ? ' done' : ''), 'data-riff': r.id, onclick: () => coachOpen(list.map(x => Object.assign({}, x)), list.indexOf(r), { title: 'Riffs & licks', actions: learnActions }) }, h('b', {}, r.name), h('small', {}, r.style + ' · level ' + r.lvl + ' · ' + r.bpm + ' BPM'), h('span', { class: 'tiny muted' }, r.tip)))));
  if (mine.length) box.append(h('h4', { class: 'ln-h' }, '★ My riffs'), h('div', { class: 'ln-grid' }, mine.map((r, k) => h('div', { class: 'ln-card mine' }, h('button', { class: 'ln-open', onclick: () => coachOpen(mine.map(m => Object.assign({ kind: 'notes', text: 'One of yours, from Riff Lab.' }, m)), k, { title: 'My riffs', actions: learnActions }) }, h('b', {}, r.title), h('small', {}, (r.lab ? r.lab.scale + ' · ' + r.lab.feel : '') + ' · ' + pcName(r.keyPc, false))), h('button', { class: 'btn sm', 'aria-label': 'Remove ' + r.title, onclick: () => { CFG.learn.mine.splice(k, 1); saveCfg(); learnPaint(); } }, '✕')))));
  return box;
}
function learnLab() {
  const o = CFG.learn.lab, set = (k, v) => { o[k] = v; saveCfg(); }, sel = (k, label, opts, id) => h('label', { class: 'field' }, label, h('select', { class: 'in', id, onchange: e => set(k, isNaN(+e.target.value) || k === 'scale' || k === 'feel' ? e.target.value : +e.target.value) }, opts.map(([v, t]) => h('option', { value: v, selected: String(o[k]) === String(v) }, t))));
  return h('div', { class: 'ln-lab' }, h('p', { class: 'small' }, 'Pick a scale, a feel and a length, and the lab writes a riff you have never played. Vary it (shift it, reverse it, swap major and minor, add bends, move it up the neck, sequence it) until it sounds like you; keep it, or put it straight into your song.'),
    h('div', { class: 'ln-filt' }, sel('scale', 'Scale', LAB_SCALES.map(s => [s, s]), 'labScale'), sel('feel', 'Feel', Object.keys(LAB_FEELS).map(s => [s, s]), 'labFeel'), sel('bars', 'Length', [[1, '1 bar'], [2, '2 bars']], 'labBars'),
      h('label', { class: 'field' }, 'Key', h('select', { class: 'in', id: 'labKey', onchange: e => set('key', e.target.value === '' ? null : +e.target.value) }, [h('option', { value: '' }, 'The song’s (' + pcName(S.key, false) + ')')].concat(NS.map((_, k) => h('option', { value: k, selected: o.key === k }, pcName(k, false)))))),
      h('label', { class: 'field' }, 'Busy', h('input', { type: 'range', min: .2, max: 1, step: .05, value: o.dens, oninput: e => set('dens', +e.target.value) }))),
    h('button', { class: 'btn primary', id: 'labGo', onclick: () => { o.seed = (o.seed || 1) + 1; saveCfg(); coachOpen(labMake(), 0, { title: 'Riff Lab', actions: learnActions, key: o.key != null ? o.key : S.key }); } }, '🎲 Make a riff'));
}
function learnAtlas() {
  const A = CFG.learn.atlas, set = (k, v) => { A[k] = v; saveCfg(); learnPaint(); };
  const types = ['Pentatonic boxes', 'Three notes per string', 'Arpeggios', 'Modes over a vamp', 'Target notes'], sel = (k, label, opts, id) => h('label', { class: 'field' }, label, h('select', { class: 'in', id, onchange: e => set(k, typeof A[k] === 'boolean' ? e.target.value === 'true' : isNaN(+e.target.value) || e.target.value === '' ? e.target.value : +e.target.value) }, opts.map(([v, t]) => h('option', { value: v, selected: String(A[k]) === String(v) }, t))));
  const ctl = [sel('type', 'Show', types.map(x => [x, x]), 'atType'), h('label', { class: 'field' }, 'Key', h('select', { class: 'in', id: 'atKey', onchange: e => { A.key = e.target.value === '' ? null : +e.target.value; saveCfg(); learnPaint(); } }, [h('option', { value: '' }, 'The song’s (' + pcName(S.key, false) + ')')].concat(NS.map((_, k) => h('option', { value: k, selected: A.key === k }, pcName(k, false))))))];
  if (A.type === 'Pentatonic boxes' || A.type === 'Three notes per string' || A.type === 'Target notes') ctl.push(sel('minor', 'Flavour', [[true, 'Minor'], [false, 'Major']], 'atMinor'));
  if (A.type === 'Arpeggios') ctl.push(sel('chord', 'Chord', [['', 'Major'], ['m', 'Minor'], ['maj7', 'Major 7'], ['7', 'Dominant 7'], ['m7', 'Minor 7'], ['m7b5', 'Half-diminished']], 'atChord'));
  if (A.type === 'Modes over a vamp') ctl.push(sel('mode', 'Mode', Object.keys(MODE_VAMP).map(m => [m, m]), 'atMode'), sel('pos', 'Position', [1, 2, 3, 4, 5, 6, 7].map(k => [k, String(k)]), 'atPos'));
  const ps = atlasPieces();
  return h('div', { class: 'ln-atlas' }, h('div', { class: 'ln-filt' }, ctl), h('div', { class: 'ln-grid' }, ps.map((p, k) => h('button', { class: 'ln-card' + (CFG.learn.done[p.id] ? ' done' : ''), 'data-atlas': k, onclick: () => coachOpen(atlasPieces(), k, { title: 'Scale atlas' }) }, h('b', {}, p.title), h('small', {}, p.notes.length + ' notes' + (p.back && p.back.chords ? ' · with a band' : ''))))));
}
function learnTeach() {
  const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async e => { const f = e.target.files[0]; e.target.value = ''; if (f) learnOpenFile(await f.text()); } });
  const b = (id, label, sub, fn) => h('button', { class: 'ln-card', id, onclick: fn }, h('b', {}, label), h('small', {}, sub));
  return h('div', { class: 'ln-grid' }, file,
    b('lnInk', '✎ Annotate', 'Draw over anything on the page while you explain.', () => { document.getElementById('learn').close(); kitInk(); }),
    b('lnNotes', '📝 Lesson notes', 'Notes for this song, kept in this browser.', () => { document.getElementById('learn').close(); kitNotes(); }),
    b('lnScreen', '⏺ Record the screen', 'Your screen, the studio’s sound and your voice.', () => { document.getElementById('learn').close(); kitScreen(); }),
    b('lnFromSong', '🎯 This section as an exercise', 'The tab of the section you are in, note by note, ready to share.', () => { const p = learnFromSong(); if (p) coachOpen(p, 0, { title: 'From your song', actions: q => [h('button', { class: 'btn sm', id: 'coShare', onclick: () => learnFile([q], q.title) }, '⇩ Share as a file')] }); }),
    b('lnOpen', '📂 Open a lesson file', 'A lesson or riff a teacher shared (.daily-lesson.json).', () => file.click()));
}
/** the Teacher's front door */
function learnOpen(at) {
  const paths = LESSONS.filter(p => p.id !== 'warm'), warm = LESSONS.filter(p => p.id === 'warm'), all = LESSONS.reduce((a, p) => a + p.lessons.reduce((b, l) => b + l.steps.length, 0), 0), done = LESSONS.reduce((a, p) => a + p.lessons.reduce((b, l) => b + lsDone(l), 0), 0);
  return hubOpen('learn', { ico: '🎓', title: 'Learn', sub: 'Lessons that listen while you play, warm-ups, riffs and licks, a riff lab for new ideas and an atlas of the neck. ' + done + ' of ' + all + ' lesson steps done.', at, sections: [
    { key: 'lessons', label: 'Lessons', ico: '🎓', sub: 'Each step shows it, plays it, then listens to you play it (through the input the tuner uses).', wide: true, body: () => [learnLessons(paths)] },
    { key: 'warm', label: 'Warm-ups', ico: '🔥', sub: 'Five minutes before you play.', wide: true, body: () => [learnLessons(warm)] },
    { key: 'riffs', label: 'Riffs & licks', ico: '🎸', sub: RIFFS.length + ' riffs, written for this studio, in ' + RIFF_STYLES.length + ' styles. Any key; note by note or in time; straight into your song.', wide: true, body: () => [learnRiffs()] },
    { key: 'lab', label: 'Riff Lab', ico: '🧪', sub: 'New ideas, on tap.', wide: true, body: () => [learnLab()] },
    { key: 'atlas', label: 'Scale atlas', ico: '🗺', sub: 'The neck, mapped: boxes, positions, arpeggios, modes over a band, target notes.', wide: true, body: () => [learnAtlas()] },
    { key: 'teach', label: 'For teachers', ico: '🍎', sub: 'Teaching someone else: draw, take notes, record, and hand out exercises as files.', wide: true, body: () => [learnTeach()] }
  ] });
}
bus.on('coach:done', () => learnPaint());
bus.on('coach:close', () => { if (LRN_DIRTY) learnPaint(); });
