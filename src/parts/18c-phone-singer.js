/* ============================================================
   Part 18c · THE PHONE, FOR SINGERS AND SONGWRITERS (2.41)
   On a phone the studio is built around the words and the voice, not the guitar (part 18 holds the shell):
     Words   a lyric notebook: the section's words in one big text box, then "Chords" to tap a chord onto a word;
             a syllable count for every line, the chords of your key one tap away, paste a whole lyric sheet
     Sing    your phone's microphone as the voice, ● to record over the beat, your takes, one-tap vocal sounds,
             pitch and range, hum to song and a voice memo
     Beats   the beats and who plays (part 88)
   Chords in the words are the studio's own [Am] markers (ChordPro style), so the desktop Write canvas, the chord sheet,
   exports and song links all see the same thing. A chord sits on a word, so rewriting a line keeps its chords on the
   words where they were (by position) and a line that is moved keeps its own.
   ============================================================ */
const MW = { sec: -1, mode: 'write', pick: null, t: 0, text: '', cm: [], syms: [], lines: [], marks: [], starts: [] };
/* The section's words as plain text (MW.text, lines joined by line breaks) and its chords as character positions in it (MW.cm: { o, sym }).
   An edit moves every chord after it by the same amount, so a chord stays on its word however the words around it change. */
/** syllables in a line of English, near enough to compare one line with another */
function mwSyl(line) {
  return (String(line || '').toLowerCase().match(/[a-z']+/g) || []).reduce((n, w) => {
    w = w.replace(/'/g, ''); if (!w) return n; if (w.length <= 3) return n + 1;
    w = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    const v = w.match(/[aeiouy]{1,2}/g); return n + Math.max(1, v ? v.length : 1);
  }, 0);
}
const mwSec = () => S.sections[clamp(MW.sec, 0, Math.max(0, S.sections.length - 1))];
/** the open section's words and chords */
function mwRead() {
  const sec = mwSec(); let off = 0; const texts = [], cm = [];
  String((sec && sec.lyrics) || '').split('\n').forEach(line => { const { text, chords } = parseLyricLine(line); chords.forEach(c => cm.push({ o: off + c.pos, sym: c.sym })); texts.push(text); off += text.length + 1; });
  MW.text = texts.join('\n'); MW.cm = cm; MW.syms = cm.map(c => c.sym); mwView();
}
/** the lines, where each starts, and each line's chords as [word, chord] (a chord between words belongs to the next one; after the last, to the last) */
function mwView() {
  MW.lines = MW.text.split('\n'); MW.starts = []; let off = 0; MW.lines.forEach(t => { MW.starts.push(off); off += t.length + 1; }); MW.marks = MW.lines.map(() => []);
  MW.cm.forEach(c => { let li = MW.starts.length - 1; while (li > 0 && MW.starts[li] > c.o) li--; const words = [...MW.lines[li].matchAll(/\S+/g)], p = c.o - MW.starts[li]; c.li = li; c.wi = -1; if (!words.length) return;
    let w = words.findIndex(x => p < x.index + x[0].length); if (w < 0) w = words.length - 1; c.wi = w; MW.marks[li].push([w, c.sym]); });
}
/** the words with their [chord] markers, as the song keeps them */
function mwLyrics() { let out = '', last = 0; MW.cm.slice().sort((a, b) => a.o - b.o).forEach(c => { const o = clamp(c.o, last, MW.text.length); out += MW.text.slice(last, o) + '[' + c.sym + ']'; last = o; }); return out + MW.text.slice(last); }
/** keep the song in step; while the band's bars still follow the words' chords (or are empty), they keep following, one bar each */
function mwWrite(final) {
  const sec = mwSec(); if (!sec) return; sec.lyrics = mwLyrics().replace(/\s+$/, '');
  const syms = MW.cm.slice().sort((a, b) => a.o - b.o).map(c => c.sym), cur = sec.bars.map(b => (b.chord || '').trim());
  if (syms.join() !== MW.syms.join() && (syms.length || MW.syms.length) && cur.every((c, i) => !c || c === MW.syms[i])) { while (sec.bars.length < syms.length) sec.bars.push(newBar('')); sec.bars.forEach((b, i) => { b.chord = syms[i] || ''; }); T.bars = null; }
  MW.syms = syms;
  if (final) { histEnd(); commit(false); bus.emit('song', 'words'); } else commit(false);
}
/** the text box changed: chords before the change stay, chords after it move with their words, chords inside it go to where it starts */
function mwEdited(value) {
  const a = MW.text, b = String(value); let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let e = 0; while (e < a.length - p && e < b.length - p && a[a.length - 1 - e] === b[b.length - 1 - e]) e++;
  const end = a.length - e, d = b.length - a.length;
  MW.cm = MW.cm.map(c => c.o < p ? c : c.o >= end ? { o: c.o + d, sym: c.sym } : { o: p, sym: c.sym }); MW.text = b; mwView();
}
/* ---------- Words ---------- */
function mWords(box) {
  if (!S.sections.length) S.sections.push(mkSection('Verse 1', ['', '', '', '']));
  if (MW.sec < 0 || MW.song !== (PRJ.cur || '')) { MW.song = PRJ.cur || ''; MW.sec = Math.max(0, S.sections.findIndex(x => (x.lyrics || '').trim())); }      /* a song opens on its first section with words */
  MW.sec = clamp(MW.sec, 0, S.sections.length - 1); mwRead();
  const secs = h('div', { class: 'mw-secs', role: 'tablist', 'aria-label': 'Sections' }, S.sections.map((s, i) => h('button', { class: 'msc' + (i === MW.sec ? ' on' : ''), role: 'tab', 'aria-selected': String(i === MW.sec), onclick: () => { MW.sec = i; mScreenDraw(); } }, s.name)),
    h('button', { class: 'msc mw-add', 'aria-label': 'Add a section', onclick: e => popover(e.currentTarget, h('div', { class: 'mw-addm' }, ['Verse', 'Pre-chorus', 'Chorus', 'Bridge', 'Outro'].map(n => h('button', { class: 'btn', onclick: () => { closePop(); const k = S.sections.filter(s => s.name.startsWith(n)).length, nm = n === 'Verse' || k ? n + ' ' + (k + 1) : n; S.sections.push(mkSection(nm, ['', '', '', ''])); commit(true); MW.sec = S.sections.length - 1; bus.emit('song', 'reload'); mScreenDraw(); } }, n)))) }, '＋'));
  const mode = h('div', { class: 'seg mw-mode' }, [['write', '✎ Write'], ['chords', '♪ Chords']].map(([k, n]) => h('button', { class: MW.mode === k ? 'on' : '', 'data-mode': k, onclick: () => { MW.mode = k; mScreenDraw(); } }, n)));
  const tools = h('div', { class: 'mw-tools' }, mode, h('span', { class: 'grow' }), h('button', { class: 'btn sm', title: 'Paste a whole lyric sheet: [Verse] and [Chorus] headings become sections', onclick: () => liOpen('') }, '⧉ Paste'));
  box.append(secs, tools);
  if (MW.mode === 'write') {
    const hint = h('div', { class: 'mw-hint', 'aria-live': 'polite' }), ta = h('textarea', { class: 'mw-ta', id: 'mwText', rows: 10, spellcheck: true, autocapitalize: 'sentences', 'aria-label': 'Words of ' + mwSec().name, placeholder: 'Write the words of ' + mwSec().name + ' here, a line at a time.\nPress ♪ Chords when you want to put chords on them.' });
    ta.value = MW.text;
    const line = () => { const i = ta.value.slice(0, ta.selectionStart).split('\n').length - 1, t = ta.value.split('\n')[i] || '', n = mwSyl(t), prev = i > 0 ? mwSyl(ta.value.split('\n')[i - 1]) : null; hint.textContent = t.trim() ? 'Line ' + (i + 1) + ': ' + n + (n === 1 ? ' syllable' : ' syllables') + (prev ? ' · the line before has ' + prev : '') : ''; };
    ta.addEventListener('focus', () => histBegin());
    ta.addEventListener('input', () => { mwEdited(ta.value); clearTimeout(MW.t); MW.t = setTimeout(() => mwWrite(false), 400); line(); });
    ta.addEventListener('keyup', line); ta.addEventListener('click', line);
    ta.addEventListener('blur', () => { clearTimeout(MW.t); mwEdited(ta.value); mwWrite(true); });
    box.append(ta, hint);
  } else {
    const pal = diatonic(S.key, S.scale).map(d => d.triad).filter(Boolean), list = h('div', { class: 'mw-lines' });
    if (!MW.lines.some(t => t.trim())) list.append(h('p', { class: 'muted mw-empty' }, 'No words in ' + mwSec().name + ' yet. Write them first, then come back to put chords on them.'));
    MW.lines.forEach((t, li) => {
      if (!t.trim()) { list.append(h('div', { class: 'mw-gap' })); return; }
      const words = t.match(/\S+/g) || [], row = h('div', { class: 'mw-line' });
      row.append(h('div', { class: 'mw-words' }, words.map((w, wi) => { const ch = (MW.marks[li] || []).filter(m => m[0] === wi).map(m => m[1]).join(' ');
        return h('button', { class: 'mw-w' + (ch ? ' has' : ''), type: 'button', 'data-l': li, 'data-w': wi, 'aria-label': w + (ch ? ', chord ' + ch : ''), onclick: () => mwPut(li, wi) }, h('i', {}, ch || ' '), h('span', {}, w)); })),
        h('span', { class: 'mw-syl', title: 'syllables' }, String(mwSyl(t))));
      list.append(row);
    });
    const chip = (sym, label) => h('button', { class: 'msc mw-pk' + (MW.pick === sym ? ' on' : ''), 'data-sym': sym, onclick: () => { MW.pick = MW.pick === sym ? null : sym; mScreenDraw(); } }, label || sym);
    const palette = h('div', { class: 'mw-pal', role: 'toolbar', 'aria-label': 'Chords in ' + keyName() }, pal.map(s => chip(s)), chip('✕', '✕ Remove'),
      h('button', { class: 'msc', onclick: () => { const v = (prompt('Any chord (for example D/F#, Gsus4, Bbmaj7):', '') || '').trim(); if (!v) return; if (!parseChord(v)) return toast('“' + v + '” is not a chord the studio knows', 'warn'); MW.pick = v; mScreenDraw(); } }, 'Other…'));
    const syncB = mwSec().bars.some(b => (b.chord || '').trim()) && MW.marks.flat().length ? h('button', { class: 'btn sm mw-sync', title: 'The band plays these chords, one bar each, in the order they are in the words', onclick: () => { const sec = mwSec(), syms = MW.marks.flat().map(m => m[1]); histBegin(); sec.bars = syms.map(s => newBar(s)); T.bars = null; histEnd(); commit(false); bus.emit('song', 'reload'); toast('The band now plays ' + syms.length + ' bars: ' + syms.join(' '), 'ok'); } }, '↻ Band plays these chords') : null;
    box.append(...[h('p', { class: 'tiny muted mw-how' }, MW.pick ? (MW.pick === '✕' ? 'Tap a chord in the words to take it off.' : 'Tap a word to put ' + MW.pick + ' on it.') : 'Pick a chord below, then tap the word it lands on.'), list, syncB, palette].filter(Boolean));
  }
}
function mwPut(li, wi) {
  if (!MW.pick) { toast('Pick a chord below first, then tap the word.', ''); return; }
  const w = [...(MW.lines[li] || '').matchAll(/\S+/g)][wi]; if (!w) return;
  histBegin(); MW.cm = MW.cm.filter(c => !(c.li === li && c.wi === wi)); if (MW.pick !== '✕') MW.cm.push({ o: MW.starts[li] + w.index, sym: MW.pick });
  mwView(); mwWrite(true); mScreenDraw();
}
/* ---------- Sing ---------- */
function mSing(box) {
  const voice = !!CFG.vin && CFG.vin !== 'off', ready = voice && E.hasInput, rec = !!(T.rec && T.playing);
  const vtakes = TAKES.filter(t => t.kind === 'vox').slice(-6).reverse();
  MW.hex = h('canvas', { class: 'ms-hex', id: 'msHex', 'aria-hidden': 'true' });
  box.append(h('h3', { class: 'ms-h' }, '🎤 Sing'), MW.hex,
    ready ? h('p', { class: 'ms-ok' }, '● Microphone ready: your voice goes on its own lane.') : h('button', { class: 'btn primary ms-mic', id: 'msMic', onclick: async () => { try { chSetRoles('v', 'o'); await ioConnect(CFG.inDev || ''); } catch (e) { } mScreenDraw();      /* a phone has one microphone: connect it, no chooser */ } }, voice ? '🎤 Connect the microphone' : '🎤 Sing into this phone'),
    h('p', { class: 'tiny muted' }, '🎧 With headphones, the beat stays out of your recording.'),
    h('div', { class: 'ms-big' },
      h('button', { class: 'btn ms-rec' + (rec ? ' on' : ''), id: 'msRec', 'aria-pressed': String(rec), onclick: () => { if (!ready && !rec) toast('Connect the microphone first (the button above).', 'warn'); toggleRec(); setTimeout(mScreenDraw, 300); } }, rec ? '■ Stop' : '● Record over the beat'),
      h('button', { class: 'btn ms-back', id: 'msBack', onclick: () => { if (T.playing) { stopPlay(true); setTimeout(mScreenDraw, 200); return; } T.cursor = 0; syncTransport(); play(); setTimeout(mScreenDraw, 300); } }, T.playing && !rec ? '■ Stop' : '▶ Hear it back')),
    h('h4', { class: 'ms-sub' }, 'Your takes'),
    vtakes.length ? h('div', { class: 'ms-takes' }, vtakes.map(t => h('div', { class: 'ms-take' }, h('b', {}, t.name || 'Vocal take'), h('span', { class: 'muted' }, (t.dur || 0).toFixed(1) + ' s'), h('span', { class: 'grow' }),
      h('button', { class: 'btn sm', 'aria-label': 'Delete ' + (t.name || 'take'), onclick: () => { if (confirm('Delete “' + (t.name || 'this take') + '”? (Undo brings it back)')) { tkDelete(t); setTimeout(mScreenDraw, 100); } } }, '✕'))))
      : h('p', { class: 'tiny muted' }, 'None yet. Press ● and sing: the count-in gives you a bar to get ready.'),
    h('h4', { class: 'ms-sub' }, 'Your voice sound'),
    h('div', { class: 'ms-vb' }, Object.keys(VB_PRESETS).map(k => h('button', { class: 'msc' + ((CFG.vb && CFG.vb.preset) === k ? ' on' : ''), 'data-vb': k, onclick: () => { vbPreset(k); mScreenDraw(); } }, k)), h('button', { class: 'msc', onclick: () => vocalBoardOpen() }, 'All vocal pedals…')),
    h('h4', { class: 'ms-sub' }, 'More for your voice'),
    h('div', { class: 'ms-more' },
      h('button', { class: 'btn', onclick: () => voxOpen() }, '〰 Pitch and my range'),
      h('button', { class: 'btn', onclick: () => humOpen() }, '✨ Hum it into a song'),
      h('button', { class: 'btn', onclick: () => humRecord(true) }, '🎙 Voice memo')));
}
/** the hexagons on the Sing screen: what you sing lights them, and the whole mix while the song plays (2.41) */
function msHexLoop() {
  if (MW.hexRaf) return;
  const step = () => {
    const cv = MW.hex; if (!cv || !cv.isConnected || M.view !== 'm' || M.s !== 'sing' || document.hidden) { MW.hexRaf = 0; return; }
    MW.hexRaf = requestAnimationFrame(step); if (!E.ready) return;
    const d = Math.min(2, window.devicePixelRatio || 1), w = Math.floor(cv.clientWidth * d), hh = Math.floor(cv.clientHeight * d); if (!w || !hh) return;
    if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
    try { drawVis(cv, { mode: 'hex', main: true, noText: true, noNeck: true, an: T.playing ? E.anaMaster : (E.anaVox || E.anaMaster) }); } catch (e) { MW.hexRaf && cancelAnimationFrame(MW.hexRaf); MW.hexRaf = 0; }
  };
  MW.hexRaf = requestAnimationFrame(step);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && M.view === 'm' && M.s === 'sing') msHexLoop(); });
/* ---------- Beats ---------- */
function mBeats(box) {
  box.append(h('h3', { class: 'ms-h' }, '🥁 Beats'), h('p', { class: 'tiny muted' }, 'Tap one and it plays in your song’s key. Write or sing over it.'), beatsShelf(), h('h4', { class: 'ms-sub' }, 'Who plays'), beatsMixer(),
    h('button', { class: 'btn sm mb-all', onclick: () => mGo('beats', 'band') }, 'Every band setting…'));
}
/* ---------- the screen ---------- */
const M_SCREENS = { words: mWords, sing: mSing, beats: mBeats };
function mScreenDraw() {
  const box = M.scr; if (!box || M.view !== 'm') return; const id = M.s, fn = M_SCREENS[id]; if (!fn) return;
  const ae = document.activeElement, same = box.dataset.screen === id; if (same && ae && box.contains(ae) && (ae.tagName === 'TEXTAREA' || ae.type === 'range')) return; if (!same && ae && box.contains(ae)) ae.blur();      /* never under someone's typing or a fader they hold */
  const top = box.scrollTop; box.innerHTML = ''; box.dataset.screen = id; try { fn(box); } catch (e) { console.warn('phone screen', e); } box.scrollTop = top; if (id === 'sing') msHexLoop();
}
['song', 'takes', 'audiostate', 'rec:state', 'transport', 'route'].forEach(e => bus.on(e, () => { if (M.view === 'm') { clearTimeout(MW.redraw); MW.redraw = setTimeout(mScreenDraw, 80); } }));
