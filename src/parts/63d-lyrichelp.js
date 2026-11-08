/* ============================================================
   Part 63d · LYRIC HELPER (2.58) — rhymes, syllables and the rhyme scheme, beside the words you're writing
   ✎ Rhymes & syllables opens a small panel that follows whichever lyrics box you're typing in (Write, the phone's Words, Paste lyrics):
     · each line's syllable count, and the rhyme scheme from the line endings (A B A B), so uneven lines and broken rhymes stand out;
     · rhymes for a word (the last word you typed, or any you enter): perfect rhymes by syllables, common words first, then near rhymes
       (the same vowel); click one to put it in at the cursor.
   The words come from data/rhymes.txt on this site, fetched once and then kept offline: 31,000 common English words (SCOWL levels 10–35)
   with their pronunciations from the CMU Pronouncing Dictionary, grouped by rhyme (scripts/make-rhymes.mjs; licences in
   THIRD_PARTY_NOTICES.md). Without it (the single-file app, or offline before the first use), syllables are counted by spelling rules and
   rhymes come from the song's own words. Nothing you write is sent anywhere.
   ============================================================ */
const LH = { idx: null, groups: null, loading: null, ta: null, el: null, url: 'data/rhymes.txt' };
async function lhLoad() {
  if (LH.idx) return true; if (LH.loading) return LH.loading;
  return (LH.loading = (async () => {
    try {
      const r = await fetch(LH.url); if (!r.ok) throw new Error(r.status); const t = await r.text(), idx = new Map(), groups = new Map();
      t.split('\n').forEach(line => { const p = line.indexOf('|'); if (p < 0) return; const key = line.slice(0, p), ws = line.slice(p + 1).split(' ').map((x, i) => { const m = /^([a-z]+)(\d+)$/.exec(x); return m ? [m[1], +m[2], i] : null; }).filter(Boolean); groups.set(key, ws); ws.forEach(([w, s]) => { if (!idx.has(w)) idx.set(w, { key, syl: s }); }); });
      LH.idx = idx; LH.groups = groups; return true;
    } catch (e) { LH.loading = null; return false; }
  })());
}
const lhWord = w => String(w || '').toLowerCase().replace(/[^a-z']/g, '').replace(/^'+|'+$/g, '').replace(/'s$/, '').replace(/in'$/, 'ing');
/** syllables by spelling, when the dictionary doesn't know the word (part 08's rules) */
const lhSylGuess = w => syllables(lhWord(w).replace(/'/g, ''));
const lhSyl = w => { const k = lhWord(w), e = LH.idx && LH.idx.get(k); return e ? e.syl : lhSylGuess(k); };
/** a rhyme key: the dictionary's (last stressed vowel onward), or one from spelling */
function lhKey(w) {
  const k = lhWord(w), e = LH.idx && LH.idx.get(k); if (e) return e.key; if (!k) return '';
  const m = /([aeiouy]+[^aeiouy]*e?)$/.exec(k.replace(/(.)\1$/, '$1')); return 'sp:' + (m ? m[1] : k.slice(-2)).replace(/igh/, 'i').replace(/ight$/, 'ite').replace(/ey$|ay$/, 'ay');
}
const lhLines = text => String(text || '').split('\n').map(l => l.replace(/\[[^\]]*\]/g, '').replace(/[^\p{L}\p{N}'’ -]/gu, ' ').trim());
/** syllable counts and the rhyme scheme (A, B, …) for the lines of a verse */
function lhScheme(text) {
  const out = [], seen = new Map(); let next = 0;
  lhLines(text).forEach(l => { if (!l) { out.push(null); return; } const ws = l.split(/\s+/).filter(Boolean), last = ws[ws.length - 1], key = lhKey(last); let letter = seen.get(key); if (letter == null) { letter = String.fromCharCode(65 + (next++ % 26)); seen.set(key, letter); } out.push({ syl: ws.reduce((a, w) => a + lhSyl(w), 0), last, letter }); });
  return out;
}
/** rhymes for a word: perfect ones by syllables (common words first), then near ones (same vowel); with no dictionary, the song's own words */
function lhRhymes(word, max) {
  const w = lhWord(word), key = lhKey(w); max = max || 60; if (!w) return { perfect: [], near: [] };
  if (!LH.groups) { const own = new Set(); S.sections.forEach(s => lhLines(s.lyrics).forEach(l => l.split(/\s+/).forEach(x => { const y = lhWord(x); if (y && y !== w && lhKey(y) === key) own.add(y); }))); return { perfect: [...own].slice(0, max).map(x => [x, lhSylGuess(x)]), near: [], own: true }; }
  const perfect = (LH.groups.get(key) || []).filter(x => x[0] !== w).slice(0, max).map(x => [x[0], x[1]]), vowel = key.split(' ')[0], near = [];
  for (const [k, ws] of LH.groups) { if (k === key || k.split(' ')[0] !== vowel || k.split(' ').length > key.split(' ').length + 1) continue; for (const x of ws) { if (x[2] > 6) break; near.push([x[0], x[1]]); } if (near.length >= max) break; }
  return { perfect, near: near.slice(0, max) };
}
/** put a word in at the cursor of the lyrics box the panel follows */
function lhInsert(word) {
  const ta = LH.ta; if (!ta || !ta.isConnected) return toast('Click into the words first, then choose a rhyme.', 'warn');
  const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value, pre = v.slice(0, a), sp = pre && !/\s$/.test(pre) ? ' ' : '';
  ta.value = pre + sp + word + v.slice(b); const c = a + sp.length + word.length; ta.focus(); ta.setSelectionRange(c, c); ta.dispatchEvent(new Event('input', { bubbles: true }));
}
const lhLastWord = ta => { const pre = ta.value.slice(0, ta.selectionStart).replace(/[^\p{L}'’]+$/u, ''), m = /([\p{L}'’]+)$/u.exec(pre); return m ? m[1] : ''; };
function lhPaint() {
  const el = LH.el; if (!el || !el.isConnected) return; const ta = LH.ta, text = ta && ta.isConnected ? ta.value : (S.sections[SEL.sec] || {}).lyrics || '';
  const sch = lhScheme(text), rows = el.querySelector('#lhRows'), q = el.querySelector('#lhWord'), res = el.querySelector('#lhRes');
  const counts = sch.filter(Boolean).map(x => x.syl), avg = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
  rows.replaceChildren(...(sch.some(Boolean) ? sch.map(x => x ? h('div', { class: 'lh-row' + (Math.abs(x.syl - avg) > Math.max(2, avg * .3) ? ' odd' : '') }, h('b', { class: 'lh-l' }, x.letter), h('span', { class: 'lh-n' }, String(x.syl)), h('span', { class: 'lh-w' }, x.last)) : h('div', { class: 'lh-gap' })) : [h('p', { class: 'tiny muted' }, 'Type some lines: each one’s syllables and the rhyme scheme show here.')]));
  const word = q.value.trim(); if (!word) { res.replaceChildren(h('p', { class: 'tiny muted' }, 'Rhymes for the last word you typed show here, or type a word above.')); return; }
  const R = lhRhymes(word), chip = ([w, s]) => h('button', { class: 'lh-chip', type: 'button', title: s + (s === 1 ? ' syllable' : ' syllables') + ' · click to put it in', onclick: () => lhInsert(w) }, w);
  const by = n => R.perfect.filter(x => (n < 3 ? x[1] === n : x[1] >= 3));
  res.replaceChildren(
    R.perfect.length ? h('div', {}, ...[1, 2, 3].map(n => by(n).length ? h('div', { class: 'lh-grp' }, h('span', { class: 'tiny muted' }, n < 3 ? n + ' syl' : '3+ syl'), ...by(n).map(chip)) : null).filter(Boolean)) : h('p', { class: 'tiny muted' }, 'No perfect rhymes for “' + word + '”' + (R.own ? ' among this song’s words (the full list loads on the site).' : '.')),
    R.near.length ? h('div', { class: 'lh-grp near' }, h('span', { class: 'tiny muted' }, 'near'), ...R.near.slice(0, 30).map(chip)) : null);
}
async function lhOpen(ta) {
  if (ta && ta.tagName === 'TEXTAREA') LH.ta = ta; if (LH.el && LH.el.isConnected) { LH.el.remove(); LH.el = null; return; }
  const q = h('input', { class: 'in', id: 'lhWord', placeholder: 'A word to rhyme', autocomplete: 'off', oninput: () => lhPaint() });
  LH.el = h('aside', { class: 'lh-panel', id: 'lhPanel', role: 'complementary', 'aria-label': 'Rhymes and syllables' },
    h('div', { class: 'lh-h' }, h('b', {}, '✎ Rhymes & syllables'), h('span', { class: 'tiny muted', id: 'lhSrc' }, ' loading…'), h('span', { class: 'grow' }), h('button', { class: 'btn sm', 'aria-label': 'Close', onclick: () => { LH.el.remove(); LH.el = null; } }, '✕')),
    h('div', { class: 'lh-rows', id: 'lhRows' }), q, h('div', { class: 'lh-res', id: 'lhRes' }));
  document.body.append(LH.el); lhPaint();
  const ok = await lhLoad(); const src = document.getElementById('lhSrc'); if (src) src.textContent = ok ? ' 31,000 words' : ' this song’s words (offline)'; lhPaint();
}
/* the panel follows the lyrics box you're in, and the last word you typed */
const LH_SEL = 'textarea.lyr, textarea.mw-ta, textarea.lyi-ta';
document.addEventListener('focusin', e => { if (e.target && e.target.matches && e.target.matches(LH_SEL)) { LH.ta = e.target; lhPaint(); } });
document.addEventListener('input', e => { if (!LH.el || !e.target || !e.target.matches || !e.target.matches(LH_SEL)) return; LH.ta = e.target; const w = lhLastWord(e.target), q = document.getElementById('lhWord'); if (q && w && document.activeElement !== q) q.value = w; lhPaint(); });
