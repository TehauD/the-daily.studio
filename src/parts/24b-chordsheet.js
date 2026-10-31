/* ============================================================
   Part 24b · CHORD SHEETS: paste a song's chords and words and it becomes a song the whole studio can use
   Reads the three ways chord sheets are written:
     · chords over the words (the usual tab-site layout): a line of chords, then the line they are played over
     · inline chords: "[Am]Salt wind on the [F]water" (and ChordPro: {title: …}, {c: Chorus}, {soc} … {eoc})
     · chord-only lines for intros and solos: "E  G#m  C#m", "| Am | F | C G |", "x2"
   plus [Verse] / (Chorus) / "Bridge:" headings and "Capo: 2", "Key: E", "Tempo: 120", "Title - Artist" lines.
   Each chord becomes a bar (or two, or half a bar) in a section named from the heading, the words keep each chord over the
   syllable it was over, and the key is read from the chords. From there the band plays it, Write shows the words with the
   chords and the tab, the Fretboard and Theory follow the chords, and Perform shows it full screen.
   It goes through the Import dialog in part 24: the dialog switches to this when the text has chords in it.
   ============================================================ */
const CS_SKIP = /^(\|+|:?\|\|?:?|-+|\/+|%|\*+|\.+|x\s?\d+|\(?x\s?\d+\)?|\(?\d+\s?x\)?|n\.?c\.?|\(|\)|→|->)$/i;
const CS_QLEFT = /maj|min|dim|aug|sus|add|dom|m|M|°|ø|Δ|\+|-|[0-9]|#|b/g;
/** a token that is written like a chord: { root, q, bass, raw } or null. "And", "Be", "Dim" are words, not chords. */
function csTok(t) {
  const s = String(t || '').replace(/^\(|\)$|\*+$/g, '');
  const m = /^([A-G][#b♯♭]?)([^/\s]{0,12})(?:\/([A-G][#b♯♭]?))?$/.exec(s); if (!m) return null;
  const q = m[2].replace(/[()]/g, ''); if (q.replace(CS_QLEFT, '') !== '') return null;
  if (/^b/.test(q) && m[1].length === 1 && !/^b\d/.test(q)) return null;   // "Cbb…" style noise
  const fix = x => x.replace('♯', '#').replace('♭', 'b');
  return { root: fix(m[1]), q, bass: m[3] ? fix(m[3]) : '', raw: s };
}
/** the chord the app can play for a token: the symbol as written when it is understood, otherwise the nearest simpler chord */
function csSym(tk) {
  const tail = tk.bass ? '/' + tk.bass : '', q0 = tk.q;
  const tries = [q0, q0.replace(/^min/, 'm').replace(/^-(?=\d|$)/, 'm').replace(/^maj$/, '').replace(/^M$/, '').replace(/^Maj/, 'maj').replace(/^mi(?=\d|$)/, 'm').replace(/^dom/, '')];
  for (const q of tries) { const c = parseChord(tk.root + q + tail); if (c) return { sym: q === q0 ? tk.root + q0 + tail : c.name, exact: q === q0 }; }
  const q = tries[1];
  for (let n = q.length - 1; n >= 0; n--) { if (/sus$/.test(q.slice(0, n))) continue;   // a cut-off 'sus2' must not turn into sus4
    const c = parseChord(tk.root + q.slice(0, n) + tail) || parseChord(tk.root + q.slice(0, n)); if (c) return { sym: c.name, exact: false }; }
  return { sym: tk.root, exact: false };
}
/** a line of chords: [{ col, tok, sym }] with '|' bar lines as { bar: true }, and the repeat count ("x2"); null for anything else */
function csChordLine(line) {
  const out = [], re = /\S+/g; let m, rep = 1, any = false;
  while ((m = re.exec(line))) {
    const w = m[0];
    const r = /^\(?x\s?(\d+)\)?$|^\(?(\d+)\s?x\)?$/i.exec(w); if (r) { rep = Math.max(1, Math.min(16, +(r[1] || r[2]))); continue; }
    if (/^:?\|+:?$/.test(w)) { out.push({ col: m.index, bar: true }); continue; }
    if (CS_SKIP.test(w)) continue;
    const parts = w.split('|'); let col = m.index, ok = true;
    for (let i = 0; i < parts.length; i++) {
      if (i) out.push({ col: col - 1, bar: true });
      if (parts[i]) { const tk = csTok(parts[i]); if (!tk) { ok = false; break; } out.push({ col, tok: tk, sym: csSym(tk).sym, exact: csSym(tk).exact }); any = true; }
      col += parts[i].length + 1;
    }
    if (!ok) return null;
  }
  return any ? { items: out, rep } : null;
}
/** ASCII tab ("e|--0--3--|") is recognised so it is not read as words */
const csTabLine = l => /^\s*[A-Ga-g][#b]?\s*[|:]?[-0-9hpbrxs\/\\~|()<>.^v*\s]{6,}\|?\s*$/.test(l) && /-{3,}/.test(l);
/** "Capo: 2", "Key: E", "Tempo: 96" … → { k, v } */
function csMeta(l) {
  const t = l.trim(), m = /^(?:\{\s*)?(subtitle|title|artist|tempo|tuning|capo|time|bpm|key|st|t|a)\b\s*[:=]?\s*(.+?)\s*\}?$/i.exec(t); if (!m) return null;
  const k = m[1].toLowerCase(), v = m[2].trim(); if (!v) return null;
  if (!/[:=]/.test(t.slice(0, m[1].length + 3)) && !/^\{/.test(t) && !/^(capo)$/i.test(m[1])) return null;   // a word, not a setting ("Key to my heart")
  if (k === 'capo') { const n = /(\d{1,2})/.exec(v) || (/^no|none/i.test(v) ? ['', '0'] : null); return n ? { k: 'capo', v: +n[1] } : null; }
  if (k === 'tempo' || k === 'bpm') { const n = /(\d{2,3})/.exec(v); return n ? { k: 'bpm', v: +n[1] } : null; }
  if (k === 'key') { const n = /^([A-G][#b♯♭]?)\s*(m(?!aj)|min(?:or)?|major|maj)?/i.exec(v); if (!n) return null; const pc = parsePc(n[1][0].toUpperCase() + n[1].slice(1).replace('♯', '#').replace('♭', 'b')); return pc == null ? null : { k: 'key', v: { root: pc, minor: !!n[2] && /^m(?!aj)|^min/i.test(n[2]) } }; }
  if (k === 't' || k === 'title') return { k: 'title', v };
  if (k === 'a' || k === 'artist') return { k: 'artist', v };
  if (k === 'time') { const n = /^(\d{1,2})\s*\/\s*(2|4|8)$/.exec(v); return n ? { k: 'ts', v: [+n[1], +n[2]] } : null; }
  return { k: 'skip', v };
}
/** ChordPro directives that are headings or noise */
function csDirective(l) {
  const m = /^\s*\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/i.exec(l); if (!m) return null;
  const d = m[1].toLowerCase(), v = (m[2] || '').trim();
  if (/^(c|comment|ci|comment_italic|cb|comment_box|h|highlight)$/.test(d)) return v ? { head: liName(v) } : { skip: 1 };
  if (/^(soc|start_of_chorus)$/.test(d)) return { head: v ? liName(v) : 'Chorus' };
  if (/^(sov|start_of_verse)$/.test(d)) return { head: v ? liName(v) : 'Verse' };
  if (/^(sob|start_of_bridge)$/.test(d)) return { head: v ? liName(v) : 'Bridge' };
  return { skip: 1 };
}
/** inline chords in a line of words: { text: words without chords, items: [{ sym }] } or null */
function csInline(l) {
  const re = /\[([^\]\s]{1,14})\]/g; let m, items = [], bad = 0;
  while ((m = re.exec(l))) { const tk = csTok(m[1]); if (tk) { const s = csSym(tk); items.push({ tok: tk, sym: s.sym, exact: s.exact }); } else bad++; }
  return items.length && !bad ? { items } : null;
}
/** put the chords of a chord line into the words under it: "[E]Ohh baby [B]I love…" (both lines lose the indent they share) */
function csMerge(chordLine, words, items) {
  const lead = Math.min((chordLine.match(/^\s*/) || [''])[0].length, words.trim() ? (words.match(/^\s*/) || [''])[0].length : 1e9);
  let w = words.slice(lead).replace(/\s+$/, ''); const cs = items.filter(x => !x.bar).map(x => ({ col: Math.max(0, x.col - lead), sym: x.sym }));
  const need = cs.length ? cs[cs.length - 1].col : 0; if (w.length < need) w = w + ' '.repeat(need - w.length);
  for (let i = cs.length - 1; i >= 0; i--) { const c = cs[i]; w = w.slice(0, c.col) + '[' + c.sym + ']' + w.slice(c.col); }
  return w.replace(/\](\s{2,})/g, '] ').replace(/(\S)\s{2,}(?=\[)/g, '$1 ').replace(/^\s+/, '').replace(/\s{3,}/g, ' ');
}
const csOnlyChords = items => items.filter(x => !x.bar).map(x => '[' + x.sym + ']').join(' ');

/** text → { sections: [{ name, lines: [lyrics with inline chords], rows: [{ items, rep }] }], meta, stats } */
function chordSheetParse(text) {
  const raw = String(text || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/ /g, ' ').split('\n').map(l => l.replace(/\s+$/, ''));
  const meta = {}, stats = { chordLines: 0, inline: 0, tab: 0, simplified: {}, used: [] }, secs = []; let cur = null, headed = 0, pre = [];
  const open = n => { cur = { name: n, lines: [], rows: [] }; secs.push(cur); };
  const ensure = () => { if (!cur) open('Intro'); };
  const note = items => items.forEach(x => { if (x.bar) return; if (!stats.used.includes(x.sym)) stats.used.push(x.sym); if (!x.exact && x.tok.raw !== x.sym) stats.simplified[x.tok.raw] = x.sym; });
  for (let i = 0; i < raw.length; i++) {
    const l = raw[i], t = l.trim();
    if (!t) { if (cur && cur.lines.length && cur.lines[cur.lines.length - 1] !== '') cur.lines.push(''); continue; }
    const dv = /^\s*\{/.test(l) ? csDirective(l) : null;
    if (dv) { const mt = csMeta(l); if (mt && mt.k !== 'skip') { meta[mt.k] = mt.v; continue; } if (dv.head) { headed++; open(dv.head); } continue; }
    const hn = liHeader(l); if (hn) { headed++; open(hn); continue; }
    const mt = csMeta(l); if (mt) { if (mt.k !== 'skip') meta[mt.k] = mt.v; continue; }
    if (csTabLine(l)) { stats.tab++; continue; }
    const cl = csChordLine(l);
    if (cl) {
      stats.chordLines++; ensure(); note(cl.items); cur.rows.push(cl);
      const nx = raw[i + 1], nxt = nx == null ? '' : nx.trim();
      const words = nxt && !liHeader(nx) && !csChordLine(nx) && !csTabLine(nx) && !csMeta(nx) && !/^\s*\{/.test(nx);
      if (words) { cur.lines.push(csMerge(l, nx, cl.items)); i++; }
      else cur.lines.push(csOnlyChords(cl.items) + (cl.rep > 1 ? ' (x' + cl.rep + ')' : ''));
      continue;
    }
    const il = csInline(l);
    if (il) { stats.inline++; ensure(); note(il.items); const rep = /\(?x\s?(\d+)\)?\s*$/i.exec(t); cur.rows.push({ items: il.items, rep: rep ? Math.min(16, +rep[1]) : 1 }); cur.lines.push(t); continue; }
    if (!cur && !headed && !secs.length) { pre.push(t); continue; }   // lines above the first heading or chord: a title, maybe
    ensure(); cur.lines.push(t);
  }
  /* a "Title - Artist" / "Title by Artist" line above everything else */
  if (pre.length && !meta.title) { const m = /^(.{1,80}?)\s+(?:[-–—]|by)\s+(.{1,60})$/i.exec(pre[0]); if (m && !/[.!?,]$/.test(m[1])) { meta.title = m[1].trim(); if (!meta.artist) meta.artist = m[2].replace(/\s*(chords|tabs?|lyrics)\s*$/i, '').trim(); pre.shift(); } }
  if (pre.length) { const s = { name: secs.length ? 'Intro' : 'Lyrics', lines: pre, rows: [] }; secs.unshift(s); }
  secs.forEach(s => { while (s.lines.length && !s.lines[s.lines.length - 1].trim()) s.lines.pop(); while (s.lines.length && !s.lines[0].trim()) s.lines.shift(); s.n = s.lines.filter(x => x.trim()).length; s.nChords = s.rows.reduce((a, r) => a + r.items.filter(x => !x.bar).length * r.rep, 0); });
  const out = secs.filter(s => s.lines.length || s.rows.length);
  stats.headed = headed; return { sections: out, meta, stats };
}
/** no title in the sheet: the first line of the chorus (the hook) is usually what people call the song */
function csTitleGuess(p) {
  const sec = p.sections.find(s => /^(chorus|refrain|hook)/i.test(s.name) && s.n) || p.sections.find(s => s.n && /^verse/i.test(s.name)); if (!sec) return '';
  const l = sec.lines.map(x => x.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim()).find(Boolean) || '';
  let t = l.split(/\.{2,}|…|[,;:!?(]|\s[-–—]\s/)[0].trim(); if (t.length > 42) t = t.slice(0, 42).replace(/\s+\S*$/, '');
  return t.length >= 3 ? t[0].toUpperCase() + t.slice(1) : '';
}
/** is this a chord sheet (chords in it), rather than words only? */
function chordSheetLike(text) { const p = chordSheetParse(text); return p.stats.chordLines + p.stats.inline >= 2 && p.stats.used.length >= 2 ? p : null; }

/** the bars of one section. per: 1 | 2 (bars a chord lasts) or 0.5 (two chords to a bar). A line with | bar lines keeps its bars. */
function csBars(rows, per) {
  const bars = [];
  rows.forEach(r => {
    const one = [];
    if (r.items.some(x => x.bar)) { let cur = []; r.items.forEach(x => { if (x.bar) { if (cur.length) one.push(cur.join(' ')); cur = []; } else cur.push(x.sym); }); if (cur.length) one.push(cur.join(' ')); }
    else { const cs = r.items.map(x => x.sym); if (per === 0.5) { for (let i = 0; i < cs.length; i += 2) one.push(cs.slice(i, i + 2).join(' ')); } else cs.forEach(c => { for (let k = 0; k < per; k++) one.push(c); }); }
    for (let k = 0; k < (r.rep || 1); k++) bars.push(...one);
  });
  return bars;
}
/** the key the chords are in: weighted by how long each chord lasts, with the first and last chord counted extra */
function csKey(secs, per) {
  const hst = new Array(12).fill(0); let first = null, last = null;
  secs.forEach(s => csBars(s.rows, per).forEach(b => b.split(' ').forEach(sym => { const c = parseChord(sym); if (!c) return; c.pcs.forEach(p => { hst[p] += p === c.root ? 1.4 : 1; }); if (first == null) first = c; last = c; })));
  if (!hst.some(Boolean)) return null;
  if (first) hst[first.root] += 3; if (last) hst[last.root] += 2;
  const k = detectKey(hst)[0]; return { root: k.root, minor: k.minor };
}
/** a section with no chords (a heading with only words) borrows the bars of the last section with the same name, or of the one before */
function csSections(p, o) {
  const per = o.per || 1, seen = {};
  return p.sections.map((s, i) => {
    let chords = csBars(s.rows, per); const base = s.name.toLowerCase().replace(/\s*\d+$/, '');
    if (!chords.length) chords = (seen[base] && seen[base].slice()) || (s.n ? Array.from({ length: clamp(s.n * 2, 2, 16) }, () => '') : ['', '']);
    else seen[base] = chords;
    const sec = mkSection(s.name, chords); sec.lyrics = s.lines.join('\n');
    if (o.fill && o.fill !== 'none') sec.bars.forEach(b => csFill(b, o.fill));
    return sec;
  });
}
/** write a guitar part for a bar from its chords (two chords: half a bar each) */
function csFill(bar, style) {
  const cs = barChords(bar).filter(c => parseChord(c)); if (!cs.length) return;
  if (cs.length === 1) { fillTab(bar, style, cs[0]); return; }
  const N = spb(), part = Math.floor(N / cs.length), notes = [];
  cs.forEach((c, i) => { const tmp = newBar(c); if (fillTab(tmp, style, c)) tmp.tab.forEach(n => { if (n.s >= i * part && n.s < (i + 1) * part) notes.push(n); }); });
  bar.tab = notes;
}
/** the whole song: a fresh song (band on), or new sections for the one you are on */
function chordSheetSong(p, o) {
  const k = o.key && o.key !== 'auto' ? { root: +o.key.split(':')[0], minor: o.key.split(':')[1] === 'm' } : (p.meta.key || csKey(p.sections, o.per || 1) || { root: 9, minor: true });
  const s = newSong(); s.title = (o.title || p.meta.title || csTitleGuess(p) || '').trim() || 'Untitled chord sheet'; s.artist = (o.artist != null ? o.artist : p.meta.artist || '').trim();
  s.key = k.root; s.minor = k.minor; s.scale = k.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)';
  if (p.meta.capo != null) s.capo = clamp(p.meta.capo, 0, 12); if (p.meta.bpm) s.bpm = clamp(p.meta.bpm, 30, 260); if (p.meta.ts) { s.ts = p.meta.ts; s.band.drumLen = Math.min(32, s.ts[0] * 16 / s.ts[1]); }
  s.band.leadOn = !!(o.fill && o.fill !== 'none');
  const Sv = S; S = s; try { s.sections = csSections(p, o); } finally { S = Sv; }   // spb() and fillTab read the song being built
  return s;
}
/** import it: o.mode 'N' (a new song), 'A' (replace this song's sections and key) or 'C' (add after this song's sections) */
async function chordSheetApply(p, o) {
  if (!p || !p.sections.length) { toast('Nothing to import: paste a chord sheet first.', 'warn'); return false; }
  const s = chordSheetSong(p, o), bars = s.sections.reduce((a, x) => a + x.bars.length, 0), kn = pcName(s.key, keyUsesFlats(s.key, s.minor)) + (s.minor ? ' minor' : ' major');
  if (o.mode === 'N') {
    await projCreate('import', { song: s, zoom: 'song' });   // the Song view: Write, with the words and the tab
    CFG.flats = keyUsesFlats(S.key, S.minor); saveCfg();
  } else {
    vhSnap('before chord sheet', true);
    if (o.mode === 'C') S.sections = S.sections.concat(s.sections);
    else { S.sections = s.sections; Object.assign(S, { key: s.key, minor: s.minor, scale: s.scale }); if (p.meta.capo != null) S.capo = s.capo; if (p.meta.bpm) S.bpm = s.bpm; if (p.meta.title && /^Untitled/.test(S.title || '')) { S.title = s.title; S.artist = s.artist; } }
    if (o.fill && o.fill !== 'none') S.band.leadOn = true;
    SEL.sec = 0; SEL.bar = 0; TE.sec = 0; TE.bi = 0; T.bars = null; TL.cache = null; commit(true);
  }
  CS.last = { sections: s.sections.length, bars, key: kn };
  try { dockGo('tab'); if (typeof wrMode === 'function') wrMode('both'); } catch (e) { console.warn(e); }   // Write: the tab with the words and chords beside it
  toast((o.mode === 'N' ? 'Loaded “' + s.title + '”: ' : 'Imported ') + s.sections.length + ' sections, ' + bars + ' bars, key of ' + kn + (s.capo ? ', capo ' + s.capo : '') + '. Press Space to hear the band play it. ' + (o.mode === 'N' ? 'Your previous song is in ☰ Songs.' : 'Undo (Ctrl+Z) puts the song back.'), 'ok');
  bus.emit('chordsheet', CS.last); return true;
}
const CS = { last: null };
/** the dialog's chord-sheet half: preview and options (part 24 calls this when the text has chords in it) */
function csPanel(p, st, onChange) {
  const box = h('div', { class: 'cs-prev' }), per = st.csPer || 1;
  const k = p.meta.key || csKey(p.sections, per), kAuto = k ? pcName(k.root, keyUsesFlats(k.root, k.minor)) + (k.minor ? 'm' : '') : '?';
  const sel = (v, opts, fn, lab) => h('select', { class: 'in', 'aria-label': lab, onchange: e => { fn(e.target.value); onChange(); } }, opts.map(([x, t]) => h('option', { value: x, selected: String(x) === String(v) }, t)));
  const keys = [['auto', 'From the chords: ' + kAuto + (p.meta.key ? ' (as written)' : '')]]; for (let r = 0; r < 12; r++) keys.push([r + ':M', pcName(r, keyUsesFlats(r, false)) + ' major']); for (let r = 0; r < 12; r++) keys.push([r + ':m', pcName(r, keyUsesFlats(r, true)) + ' minor']);
  const title = h('input', { class: 'in', id: 'csTitle', value: st.csTitle != null ? st.csTitle : (p.meta.title || csTitleGuess(p)), placeholder: 'Song title', title: p.meta.title ? 'From the sheet' : 'A guess from the first line of the chorus: change it if you like', oninput: e => { st.csTitle = e.target.value; } });
  const artist = h('input', { class: 'in', id: 'csArtist', value: st.csArtist != null ? st.csArtist : (p.meta.artist || ''), placeholder: 'Artist (optional)', oninput: e => { st.csArtist = e.target.value; } });
  const opts = h('div', { class: 'lyi-opts' },
    h('label', {}, 'Where it goes'), sel(st.csMode || 'N', [['N', 'A new song (this one is kept in ☰ Songs)'], ['A', 'Replace the sections of this song'], ['C', 'Add after this song’s sections']], v => { st.csMode = v; }, 'Where it goes'),
    h('label', {}, 'Title'), h('div', { class: 'row', style: { gap: '6px' } }, title, artist),
    h('label', {}, 'Each chord lasts'), sel(per, [[1, '1 bar'], [2, '2 bars'], [0.5, 'Half a bar (two chords to a bar)']], v => { st.csPer = +v; }, 'Each chord lasts'),
    h('label', {}, 'Key'), sel(st.csKey || 'auto', keys, v => { st.csKey = v; }, 'Key'),
    h('label', {}, 'Guitar part in the tab'), sel(st.csFill || 'Block strum', [['none', 'None (chords and words only)']].concat(FILLS.map(f => [f, f])), v => { st.csFill = v; }, 'Guitar part'));
  const secs = csSections(p, { per, fill: 'none' }), nb = secs.reduce((a, s) => a + s.bars.length, 0), meta = [];
  if (p.meta.capo) meta.push('capo ' + p.meta.capo); if (p.meta.bpm) meta.push(p.meta.bpm + ' BPM');
  box.append(h('div', { class: 'small', style: { fontWeight: 800, marginBottom: '4px' } }, '🎸 Chord sheet: ' + p.sections.length + ' sections · ' + nb + ' bars · ' + p.stats.used.length + ' chords · key ' + kAuto + (meta.length ? ' · ' + meta.join(' · ') : '')),
    h('div', { class: 'cs-chords' }, p.stats.used.map(c => h('span', { class: 'cs-ch' }, c))));
  const tb = h('div', { class: 'lyi-rows' });
  p.sections.forEach((x, i) => { const b = secs[i].bars; tb.append(h('div', { class: 'lyi-row' }, h('b', {}, x.name), h('span', { class: 'muted' }, x.n + ' lines · ' + b.length + ' bars'), h('span', { class: 'tiny muted mono cs-seq' }, b.slice(0, 8).map(y => y.chord || '·').join('  ') + (b.length > 8 ? '  …' : '')))); });
  box.append(tb);
  const simp = Object.entries(p.stats.simplified); if (simp.length) box.append(h('div', { class: 'tiny', style: { marginTop: '6px', color: 'var(--warn)' } }, 'Played as a simpler chord: ' + simp.map(([a, b]) => a + ' → ' + b).join(', ') + '. The words keep the chord as written.'));
  if (p.stats.tab) box.append(h('div', { class: 'tiny muted', style: { marginTop: '6px' } }, p.stats.tab + ' lines of ASCII tab were left out: the tab is written from the chords instead.'));
  return { opts, box, read: () => ({ mode: st.csMode || 'N', per, key: st.csKey || 'auto', fill: st.csFill || 'Block strum', title: title.value, artist: artist.value }) };
}
