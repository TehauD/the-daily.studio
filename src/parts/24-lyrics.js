/* ============================================================
   Part 24 · LYRIC INTAKE
   Paste (or drop) a finished lyric sheet — "[Verse 1] … [Chorus] …" — and it becomes song sections, with the chords
   from your song placed over the words. Understands [Verse 1], (Chorus), "Verse 2:", ## Bridge, plain "Chorus" lines and
   .lrc timestamps; with no headings at all, blank-line stanzas become Verse / Chorus (a stanza that repeats = Chorus).
   Everything is one undoable step.
   ============================================================ */
const LI = { ov: null, st: { mode: 'A', bpl: 2, chords: true, text: '' } };
const LI_KEYS = 'intro|verse|pre[\\s-]?chorus|post[\\s-]?chorus|chorus|hook|refrain|bridge|outro|interlude|solo|instrumental|breakdown|tag|coda|drop|turnaround|middle\\s?8|vamp|ending';
const LI_PLAIN = new RegExp('^(' + LI_KEYS + ')\\s*\\d{0,2}$', 'i'), LI_LOOSE = new RegExp('^(' + LI_KEYS + ')\\b', 'i');
const liName = s => s.replace(/\s*[:\-–]\s*$/, '').replace(/\s+/g, ' ').trim().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
const liKey = lines => lines.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function liHeader(raw) {
  const t = raw.trim(); if (!t || t.length > 50) return null;
  const m = t.match(/^[\[\(\{]\s*(.+?)\s*[\]\)\}]\s*:?$/);
  if (m) {
    const inner = m[1]; if (/^\d{1,2}:\d{2}/.test(inner)) return null;
    if (LI_LOOSE.test(inner)) return liName(inner);
    if (t[0] === '[' && !parseChord(inner) && /[A-Za-z]{3,}/.test(inner)) return liName(inner);
    return null;
  }
  const bare = t.replace(/:$/, '').trim(), d = bare.replace(/^[#*_=~\-–—\s]+/, '').replace(/[#*_=~\-–—\s]+$/, '').trim();
  if (LI_PLAIN.test(d)) return liName(d);
  if ((d !== bare || /:$/.test(t)) && LI_LOOSE.test(d) && d.length <= 36) return liName(d);
  return null;
}
/** text → [{name, lines[], n}] ; result.headed = number of explicit headings found */
function lyricParse(text) {
  const raw = String(text || '').replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\s+$/, '').replace(/\t/g, ' ').replace(/^\s*\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]\s*/, ''));
  let secs = [], cur = null, headed = 0; const open = n => { cur = { name: n, lines: [] }; secs.push(cur); };
  raw.forEach(l => {
    if (/^\s*\[(ti|ar|al|by|offset|length|re|ve):[^\]]*\]\s*$/i.test(l)) return;
    const hn = liHeader(l); if (hn) { headed++; open(hn); return; }
    if (!cur) { if (!l.trim()) return; open('Lyrics'); } cur.lines.push(l);
  });
  if (!headed && secs[0]) {
    const blocks = []; let b = []; secs[0].lines.forEach(l => { if (!l.trim()) { if (b.length) blocks.push(b); b = []; } else b.push(l); }); if (b.length) blocks.push(b);
    const cnt = {}; blocks.forEach(x => { cnt[liKey(x)] = (cnt[liKey(x)] || 0) + 1; }); let v = 0;
    secs = blocks.map(x => ({ name: cnt[liKey(x)] > 1 ? 'Chorus' : 'Verse ' + (++v), lines: x }));
  }
  secs.forEach(s => {
    while (s.lines.length && !s.lines[0].trim()) s.lines.shift(); while (s.lines.length && !s.lines[s.lines.length - 1].trim()) s.lines.pop();
    s.lines = s.lines.filter((l, i, a) => l.trim() || (a[i - 1] || '').trim()); s.n = s.lines.filter(l => l.trim()).length;
  });
  secs.headed = headed; return secs;
}

/* ---------- chords over words ---------- */
function liPlace(lines, bars) {
  const idx = []; lines.forEach((l, i) => { if (l.trim()) idx.push(i); }); const n = idx.length, nb = bars.length; if (!n || !nb) return lines.join('\n');
  const out = lines.slice();
  idx.forEach((li, k) => {
    const text = lines[li]; if (/\[[^\]]+\]/.test(text)) return;
    const b0 = Math.floor(k * nb / n), b1 = Math.max(b0 + 1, Math.floor((k + 1) * nb / n)), ch = [];
    for (let b = b0; b < b1; b++) barChords(bars[b % nb]).forEach(c => { if (parseChord(c)) ch.push(c); });
    if (!ch.length) return; const lead = (text.match(/^\s*/) || [''])[0], toks = text.trim().match(/\S+\s*/g) || [], at = {};
    ch.forEach((c, j) => { const ti = Math.min(toks.length - 1, Math.round(j * toks.length / ch.length)); if (!(ti in at) && at[ti - 1] !== c) at[ti] = c; });
    out[li] = lead + toks.map((t, ti) => (at[ti] ? '[' + at[ti] + ']' : '') + t).join('');
  });
  return out.join('\n');
}
function liProgression(old) {
  const src = old.find(s => s.bars.some(b => barChords(b).some(parseChord)));
  if (src) { const p = src.bars.slice(0, 4).map(b => b.chord || ''); if (p.some(Boolean)) return p; }
  const r = S.key, nm = x => pcName((r + x) % 12);
  return S.minor ? [nm(0) + 'm', nm(8), nm(3), nm(10)] : [nm(0), nm(7), nm(9) + 'm', nm(5)];
}
/** Pure: where would these sections go? Works on a copy; returns {sections, rows, dropped}. */
function liBuild(secsP, o) {
  const old = JSON.parse(JSON.stringify(S.sections)), prog = liProgression(old), used = new Set(), first = {}, rows = [];
  const find = nm => { const l = nm.toLowerCase(), base = l.replace(/\s*\d+$/, ''); return old.find(s => !used.has(s) && s.name.toLowerCase() === l) || old.find(s => !used.has(s) && s.name.toLowerCase().replace(/\s*\d+$/, '') === base); };
  const fresh = p => { const nb = p.n ? clamp(p.n * o.bpl, 2, 32) : 4; return mkSection(p.name, Array.from({ length: nb }, (_, i) => prog[i % prog.length])); };
  const put = (p, sec, how) => { sec.name = p.name; sec.lyrics = o.chords ? liPlace(p.lines, sec.bars) : p.lines.join('\n'); rows.push({ p, sec, how, bars: sec.bars.length }); return sec; };
  let out;
  if (o.mode === 'B') {
    out = secsP.map((p, i) => old[i] ? (used.add(old[i]), put(p, old[i], 'fills your “' + old[i].name + '”')) : put(p, fresh(p), 'new'));
    out = out.concat(old.filter(s => !used.has(s)));
  } else {
    out = secsP.map(p => {
      const lk = p.name.toLowerCase(); let sec, how;
      if (first[lk]) { sec = JSON.parse(JSON.stringify(first[lk])); sec.id = uid(); how = 'repeat of the first ' + p.name; }
      else if (o.mode === 'A' && (sec = find(p.name))) { used.add(sec); how = 'keeps your “' + sec.name + '” bars'; }
      else { sec = fresh(p); how = 'new'; }
      put(p, sec, how); if (!first[lk]) first[lk] = sec; return sec;
    });
    out = o.mode === 'C' ? old.concat(out) : out;
  }
  const dropped = o.mode === 'A' ? old.filter(s => !used.has(s)) : [];
  return { sections: out, rows, dropped };
}
function liApply(secsP, o) {
  if (!secsP.length) return toast('Nothing to import: paste some lyrics first.', 'warn');
  const r = liBuild(secsP, o); vhSnap('before lyric import', true);
  S.sections = r.sections; SEL.sec = 0; SEL.bar = 0; TE.sec = 0; TE.bi = 0; T.bars = null; TL.cache = null; RF.acc = true; commit(true);
  toast('Imported ' + secsP.length + ' sections, ' + secsP.reduce((a, p) => a + p.n, 0) + ' lines' + (o.chords ? ' with chords over the words' : '') + '. Undo (Ctrl+Z) puts the song back.', 'ok');
}

/* ---------- the dialog ---------- */
function liClose() { if (LI.ov) { LI.ov.remove(); LI.ov = null; } document.removeEventListener('keydown', liKeys, true); }
function liKeys(e) { if (e.key === 'Escape') { e.stopPropagation(); liClose(); } }
function liOpen(text) {
  liClose(); if (typeof text === 'string') LI.st.text = text;
  const st = LI.st, prev = h('div', { class: 'lyi-prev' });
  const ta = h('textarea', { class: 'in lyi-ta', spellcheck: false, placeholder: '[Verse 1]\nLate night, city lights…\n\n[Chorus]\nI just wanna be right here with you…', oninput: () => { st.text = ta.value; draw(); } }, st.text);
  const file = h('input', { type: 'file', accept: '.txt,.md,.lrc,.rtf,text/plain', style: { display: 'none' }, onchange: async e => { const f = e.target.files[0]; if (!f) return; st.text = await f.text(); ta.value = st.text; draw(); } });
  const sel = (v, opts, fn) => h('select', { class: 'in', onchange: e => fn(e.target.value) }, opts.map(([k, t]) => h('option', { value: k, selected: String(k) === String(v) }, t)));
  const modeSel = sel(st.mode, [['A', 'Make a section for each block (keep my bars where the name matches)'], ['B', 'Fill the sections I already have, in order'], ['C', 'Add them after my existing sections']], v => { st.mode = v; draw(); });
  const bplSel = sel(st.bpl, [[1, '1 bar per line'], [2, '2 bars per line'], [4, '4 bars per line']], v => { st.bpl = +v; draw(); });
  const chk = h('input', { type: 'checkbox', checked: st.chords, onchange: e => { st.chords = e.target.checked; draw(); } });
  const go = h('button', { class: 'btn primary', onclick: () => { const p = lyricParse(st.text); if (!p.length) return; liApply(p, st); liClose(); } }, 'Import lyrics');
  function draw() {
    const p = lyricParse(st.text); prev.innerHTML = ''; go.disabled = !p.length;
    if (!p.length) { prev.append(h('div', { class: 'muted small' }, 'Paste the lyrics above. Headings like [Verse 1], [Chorus], (Bridge) or “Verse 2:” split them into sections. Chords you already have in the song are placed over the words.')); return; }
    const r = liBuild(p, st), lines = p.reduce((a, x) => a + x.n, 0);
    prev.append(h('div', { class: 'small', style: { fontWeight: 800, marginBottom: '4px' } }, p.length + ' sections · ' + lines + ' lines' + (p.headed ? '' : ' (no headings found: split into stanzas)')));
    const tb = h('div', { class: 'lyi-rows' }); r.rows.forEach(({ p: x, how, bars }) => tb.append(h('div', { class: 'lyi-row' }, h('b', {}, x.name), h('span', { class: 'muted' }, x.n + ' lines · ' + bars + ' bars'), h('span', { class: 'tiny muted' }, how)))); prev.append(tb);
    if (r.dropped.length) { const tab = r.dropped.some(s => s.bars.some(b => b.tab.length)); prev.append(h('div', { class: 'tiny', style: { color: 'var(--warn)', marginTop: '6px' } }, 'Replaces: ' + r.dropped.map(s => s.name + ' (' + s.bars.length + ' bars)').join(', ') + (tab ? ' — including tab notes' : '') + '. Undo brings them back; choose “Add them after…” to keep them.')); }
  }
  const box = h('div', { class: 'lyi-box', role: 'dialog', 'aria-label': 'Import lyrics' },
    h('div', { class: 'lyi-h' }, h('b', {}, '📋 Import lyrics'), h('span', { class: 'grow' }), h('button', { class: 'btn sm', title: 'Close (Esc)', onclick: liClose }, '✕')),
    h('div', { class: 'lyi-b' }, ta,
      h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', margin: '8px 0' } },
        h('button', { class: 'btn sm', onclick: async () => { try { const t = await navigator.clipboard.readText(); if (t) { st.text = t; ta.value = t; draw(); } } catch (e) { toast('Your browser blocked clipboard access: press Ctrl+V in the box instead.', 'warn'); } } }, 'Paste from clipboard'),
        h('button', { class: 'btn sm', onclick: () => file.click() }, 'Open a .txt / .lrc file…'), file, h('button', { class: 'btn sm', onclick: () => { st.text = ''; ta.value = ''; draw(); ta.focus(); } }, 'Clear')),
      h('div', { class: 'lyi-opts' }, h('label', {}, 'Where it goes'), modeSel, h('label', {}, 'New sections'), bplSel, h('label', { class: 'lyi-chk' }, chk, ' Put the chords over the words')),
      prev),
    h('div', { class: 'lyi-f' }, h('span', { class: 'tiny muted grow' }, 'Lyrics stay on this device. Nothing is uploaded.'), h('button', { class: 'btn', onclick: liClose }, 'Cancel'), go));
  LI.ov = h('div', { class: 'lyi', onpointerdown: e => { if (e.target === LI.ov) liClose(); } }, box); document.body.append(LI.ov); document.addEventListener('keydown', liKeys, true); draw(); setTimeout(() => ta.focus(), 30);
}
/** pasting a whole lyric sheet into any section box offers to split it */
function liPaste(e) {
  const t = ((e.clipboardData || window.clipboardData) || { getData: () => '' }).getData('text'); if (!t || t.length < 40) return;
  const p = lyricParse(t); if (p.headed >= 2 || (!p.headed && p.length >= 3)) { e.preventDefault(); liOpen(t); }
}
/** drop a .txt / .lrc onto the Refine panel */
function liWire(box) {
  box.addEventListener('dragover', e => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); box.classList.add('dropt'); } });
  box.addEventListener('dragleave', () => box.classList.remove('dropt'));
  box.addEventListener('drop', async e => { box.classList.remove('dropt'); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (!f || !/\.(txt|md|lrc)$|^text\//i.test(f.name + ' ' + f.type)) return; e.preventDefault(); liOpen(await f.text()); });
}
