/* ============================================================
   Part 63b · THE SONG MAP AND ITS SECTIONS (2.48)
   The whole song at a glance: one block per section, as wide as its bars, coloured by what it is (intro, verse, pre-chorus, chorus,
   interlude, bridge, solo, outro), the one playing lit, with how far through it the song is. Click a block to go there. It is in
   Write (above the section chips, and at the top of the Whole song view) and in Perform.
   Adding a section names it for you: Intro, Verse 1, Verse 2, Pre-chorus, Chorus, Interlude, Bridge, Solo, Outro, numbered when there
   is more than one, and a second verse or chorus starts with the first one's chords (no words or tab), as songs usually go.
   ============================================================ */
const SEC_KINDS = [
  ['intro', 'Intro', /^intro/i, 200], ['verse', 'Verse', /^verse/i, 150], ['pre', 'Pre-chorus', /^pre/i, 95], ['chorus', 'Chorus', /^(chorus|hook|refrain)/i, 25],
  ['inter', 'Interlude', /^(interlude|instrumental|break|turnaround)/i, 270], ['bridge', 'Bridge', /^(bridge|middle)/i, 305], ['solo', 'Solo', /^solo/i, 340], ['outro', 'Outro', /^(outro|ending|coda|tag)/i, 220]
];
/** what a section is, from its name: one of SEC_KINDS' ids, or 'other' */
function secKind(name) { const k = SEC_KINDS.find(x => x[2].test(String(name || '').trim())); return k ? k[0] : 'other'; }
const secHue = name => { const k = SEC_KINDS.find(x => x[0] === secKind(name)); return k ? k[3] : 180; };
/** where the song is: the section and the bar in it (while playing, the playhead; otherwise the cursor), or null */
function smWhere() {
  const fb = barsCache(); if (!fb.length) return null; const sp = spb(), at = Math.max(0, T.playing && E.ctx ? playheadSlot() : T.cursor), b = fb[Math.min(fb.length - 1, Math.floor(at / sp))];
  if (!b || b.si == null) return null; return { si: b.si, bi: b.bi, frac: clamp((b.bi + (at / sp - Math.floor(at / sp))) / Math.max(1, b.sec.bars.length), 0, 1) };
}
/** go to a section: the cursor moves there, and if the song is playing it plays on from there */
function smGo(si) {
  si = clamp(si, 0, S.sections.length - 1); const was = T.playing; if (was) stopPlay(true); T.cursor = secStart(si) * spb();
  SEL.sec = si; SEL.bar = 0; if (typeof TE !== 'undefined') { TE.sec = si; TE.bi = 0; } TL.dirty = true; bus.emit('sel'); if (was) play();
}
/**
 * the song map element. o.onPick(si) when a block is clicked (default: go there); o.big for Perform; o.cls an extra class.
 * Call el._paint() to light the section playing; it is cheap and does nothing when nothing changed.
 */
function songMapEl(o = {}) {
  const el = h('div', { class: 'smap' + (o.big ? ' smap-big' : '') + (o.cls ? ' ' + o.cls : ''), role: 'list', 'aria-label': 'The song, section by section' });
  el._build = () => {
    el.innerHTML = ''; el._k = S.sections.map(s => s.name + ':' + s.bars.length).join('|');
    S.sections.forEach((s, si) => el.append(h('button', { class: 'smap-b', role: 'listitem', type: 'button', 'data-si': si, 'data-kind': secKind(s.name), style: 'flex-grow:' + Math.max(1, s.bars.length) + ';--sh:' + secHue(s.name),
      title: s.name + ' · ' + s.bars.length + ' bar' + (s.bars.length === 1 ? '' : 's') + ' · go there', onclick: () => (o.onPick || smGo)(si) }, h('i', { class: 'smap-f', 'aria-hidden': 'true' }), h('span', { class: 'smap-n' }, s.name))));
    el._w = '';
  };
  el._paint = () => {
    if (el._k !== S.sections.map(s => s.name + ':' + s.bars.length).join('|')) el._build();
    const w = smWhere(), key = w ? w.si + ':' + Math.round(w.frac * 40) : ''; if (key === el._w) return; el._w = key;
    [...el.children].forEach((b, si) => { const cur = !!w && si === w.si; b.classList.toggle('cur', cur); b.classList.toggle('past', !!w && si < w.si); b.setAttribute('aria-current', cur ? 'true' : 'false'); b.firstChild.style.width = cur ? (w.frac * 100).toFixed(1) + '%' : (w && si < w.si ? '100%' : '0'); });
  };
  el._build(); el._paint(); return el;
}
/** the name for a new section of this kind: "Verse 2" after "Verse 1" (and the first "Verse" becomes "Verse 1") */
function secNameFor(kind) {
  const k = SEC_KINDS.find(x => x[0] === kind), base = k ? k[1] : 'Section', same = S.sections.filter(s => secKind(s.name) === kind || (!k && s.name.startsWith(base)));
  if (!same.length) return base;
  const plain = same.find(s => s.name.trim().toLowerCase() === base.toLowerCase()); if (plain) plain.name = base + ' 1';      /* the first one gets its number when a second arrives */
  let n = same.length + 1; while (S.sections.some(s => s.name === base + ' ' + n)) n++; return base + ' ' + n;
}
/** add a section of this kind after section `after` (default: the selected one); a second verse or chorus takes the first one's chords */
function secAdd(kind, after) {
  const at = clamp((after == null ? (SEL.sec != null ? SEL.sec : S.sections.length - 1) : after) + 1, 0, S.sections.length), like = S.sections.find(s => secKind(s.name) === kind);
  const chords = like ? like.bars.map(b => b.chord) : (kind === 'intro' || kind === 'outro' || kind === 'inter' ? ['', ''] : ['', '', '', '']);
  const s = mkSection(secNameFor(kind), chords.length ? chords : ['', '', '', '']); S.sections.splice(at, 0, s); T.bars = null; commit();
  SEL.sec = at; SEL.bar = 0; if (typeof TE !== 'undefined') { TE.sec = at; TE.bi = 0; } bus.emit('sel'); return at;
}
/** the menu behind ＋: every kind of section, and a copy of one already in the song */
function secAddMenu(anchor, done) {
  const go = fn => () => { closePop(); const i = fn(); if (done) done(i); };
  popover(anchor, h('div', { class: 'sm-add', role: 'menu', 'aria-label': 'Add a section' },
    h('div', { class: 'tiny muted' }, 'Add after ' + ((S.sections[SEL.sec] || {}).name || 'the last section')),
    h('div', { class: 'sm-add-g' }, SEC_KINDS.map(([id, name, , hue]) => h('button', { class: 'btn sm sm-k', role: 'menuitem', 'data-kind': id, style: '--sh:' + hue, onclick: go(() => secAdd(id)) }, name))),
    S.sections.length ? h('div', { class: 'tiny muted', style: { marginTop: '6px' } }, 'Or repeat one, words and all:') : '',
    S.sections.length ? h('div', { class: 'sm-add-g' }, S.sections.map((s, si) => h('button', { class: 'btn sm', role: 'menuitem', onclick: go(() => { const c = JSON.parse(JSON.stringify(s)); c.id = uid(); const at = clamp((SEL.sec != null ? SEL.sec : S.sections.length - 1) + 1, 0, S.sections.length); S.sections.splice(at, 0, c); T.bars = null; commit(); SEL.sec = at; if (typeof TE !== 'undefined') { TE.sec = at; TE.bi = 0; } bus.emit('sel'); return at; }) }, '⧉ ' + s.name))) : ''));
}
/* Write's Whole song view (2.48). Two ways to see it:
     Sheet (2.48.1, the default)  the song as a chord sheet, the way it was pasted: each section's name, then its words with the chords
                                 over them (or its bars of chords, if it has no words), flowing into as many columns as the screen
                                 holds. A section that repeats an earlier one word for word and chord for chord is one line. Click a
                                 section to edit it where it is; the section playing is lit and kept in view.
     Edit                        every section's full editor card, one under another. */
const WSH = { edit: -1, open: new Set() };
const wsView = () => CFG.wsView === 'edit' ? 'edit' : 'sheet', wsSize = () => clamp(+CFG.wsSize || 2, 1, 4);
const wsSame = (a, b) => a.lyrics.trim() === b.lyrics.trim() && a.bars.map(x => x.chord).join('|') === b.bars.map(x => x.chord).join('|');
/** one section of the sheet. o.onEdit(si): what a tap does instead of opening the editor in place (the phone opens it in its own editor) */
function wsSheetSec(sec, si, o = {}) {
  const chords = [...new Set(sec.bars.flatMap(barChords))], rep = S.sections.slice(0, si).find(x => wsSame(x, sec) && (x.lyrics.trim() || x.bars.some(b => b.chord))), edit = !o.onEdit && WSH.edit === si, go = () => { if (o.onEdit) return o.onEdit(si); WSH.edit = WSH.edit === si ? -1 : si; SEL.sec = si; renderWords(); };
  const head = h('div', { class: 'wsh-h' }, h('b', { class: 'wsh-n' }, sec.name), h('span', { class: 'wsh-m' }, sec.bars.length + ' bar' + (sec.bars.length === 1 ? '' : 's') + (chords.length ? ' · ' + chords.slice(0, 6).join(' ') : '')),
    h('span', { class: 'grow' }), h('button', { class: 'btn sm wsh-b', title: 'Play from ' + sec.name, 'aria-label': 'Play from ' + sec.name, onclick: e => { e.stopPropagation(); T.cursor = secStart(si) * spb(); if (T.playing) stopPlay(true); play(); } }, '▶'),
    h('button', { class: 'btn sm wsh-b' + (edit ? ' on' : ''), title: edit ? 'Done editing' : 'Edit ' + sec.name, onclick: e => { e.stopPropagation(); go(); } }, edit ? '✓ Done' : '✎'));
  const el = h('section', { class: 'wsh-sec' + (edit ? ' editing' : ''), 'data-si': si, 'data-kind': secKind(sec.name), style: '--sh:' + secHue(sec.name), title: edit ? '' : 'Click to edit ' + sec.name, onclick: () => { if (o.onEdit || WSH.edit !== si) go(); } }, head);
  if (edit) { const c = sectionCard(sec, si, false, {}); c.onclick = e => e.stopPropagation(); el.append(c); return el; }
  if (rep && !WSH.open.has(si)) { el.classList.add('rep'); el.append(h('div', { class: 'wsh-rep' }, 'Same words and chords as ' + rep.name + ' above. ', h('button', { class: 'linkish', onclick: e => { e.stopPropagation(); WSH.open.add(si); if (o.onEdit) mScreenDraw(); else renderWords(); } }, 'Show'))); return el; }
  const lines = (sec.lyrics || '').replace(/\s+$/, '').split('\n'), words = lines.some(l => lyPlain(l));
  if (words) lines.forEach(l => el.append(l.trim() ? h('div', { class: 'wsh-l' }, ...lyNodes(l, -1)) : h('div', { class: 'wsh-gap' })));
  else el.append(h('div', { class: 'wsh-bars' }, sec.bars.map(b => h('span', { class: 'wsh-bar' }, b.chord || '—'))));
  return el;
}
function renderWholeSong(box) {
  const bars = S.sections.reduce((a, s) => a + s.bars.length, 0), view = wsView(), size = wsSize(), find = si => box.querySelector('[data-si="' + si + '"]:not(.smap-b)');
  const map = songMapEl({ onPick: si => { SEL.sec = si; if (typeof TE !== 'undefined') TE.sec = si; const c = find(si); if (c) c.scrollIntoView({ block: 'start', behavior: 'smooth' }); bus.emit('sel'); } });
  const seg = h('div', { class: 'seg ws-view', role: 'group', 'aria-label': 'How the whole song is shown' }, [['sheet', '📄 Sheet', 'The song as a chord sheet: every word with its chords over it, in columns'], ['edit', '✎ Edit all', 'Every section\'s editor, one under another']].map(([k, t, d]) => h('button', { class: view === k ? 'on' : '', 'aria-pressed': String(view === k), 'data-ws': k, title: d, onclick: () => { CFG.wsView = k; WSH.edit = -1; saveCfg(); renderWords(); } }, t)));
  const sz = d => () => { CFG.wsSize = clamp(size + d, 1, 4); saveCfg(); renderWords(); };
  box.append(h('div', { class: 'wr-wh' }, h('b', { class: 'small' }, 'WHOLE SONG · ' + S.sections.length + ' section' + (S.sections.length === 1 ? '' : 's') + ' · ' + bars + ' bars'), h('span', { class: 'grow' }), seg,
    view === 'sheet' ? h('span', { class: 'row', style: 'gap:4px' }, h('button', { class: 'btn sm', id: 'wsSmaller', title: 'Smaller text, more columns', 'aria-label': 'Smaller text', disabled: size <= 1, onclick: sz(-1) }, 'A−'), h('button', { class: 'btn sm', id: 'wsBigger', title: 'Larger text', 'aria-label': 'Larger text', disabled: size >= 4, onclick: sz(1) }, 'A+')) : '',
    h('button', { class: 'btn sm' + (document.body.classList.contains('ws-full') ? ' on' : ''), id: 'wsFull', title: 'Fill the window with the whole song (Esc to come back)', 'aria-pressed': String(document.body.classList.contains('ws-full')), onclick: () => wsFullSet(!document.body.classList.contains('ws-full')) }, document.body.classList.contains('ws-full') ? '✕ Exit full screen' : '⛶ Full screen'),
    h('button', { class: 'btn sm', id: 'wsAdd', title: 'Add a section: intro, verse, chorus, interlude…', onclick: e => secAddMenu(e.currentTarget, () => renderWords()) }, '＋ Section'),
    h('button', { class: 'btn sm', title: 'Paste a finished lyric sheet: [Verse] and [Chorus] headings become sections, with your chords placed over the words', onclick: () => liOpen() }, '📋 Paste lyrics')), map);
  if (view === 'sheet') box.append(wsEmpty(false), h('div', { class: 'wsh', id: 'wsSheet', 'data-size': size }, S.sections.map((sec, si) => wsSheetSec(sec, si))));
  else S.sections.forEach((sec, si) => box.append(h('div', { class: 'ws-sec', 'data-si': si, 'data-kind': secKind(sec.name), style: '--sh:' + secHue(sec.name) }, sectionCard(sec, si, false, {}))));
  box._map = map; if (view === 'sheet') box.append(wsNext(false));
}
/** the whole song filling the window: the Write panel over everything else, until Esc or the button again */
function wsFullSet(on) { document.body.classList.toggle('ws-full', !!on); renderWords(); setTimeout(() => window.dispatchEvent(new Event('resize')), 30); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('ws-full') && !document.querySelector('dialog[open]') && !document.getElementById('perform')) { e.preventDefault(); wsFullSet(false); } });
bus.on('dock', id => { if (id !== 'tab' && document.body.classList.contains('ws-full')) wsFullSet(false); });
/** the sheet follows the song: the section playing is lit and scrolled into view */
function wsheetFollow() {
  const sh = document.querySelector('#wsSheet, #mwSheet'); if (!sh || !sh.offsetParent) return; const w = smWhere(), si = w && T.playing ? w.si : -1; if (sh._si === si) return; sh._si = si;
  sh.querySelectorAll('.wsh-sec').forEach(x => x.classList.toggle('cur', +x.dataset.si === si)); const c = sh.querySelector('.wsh-sec.cur'); if (c && WSH.edit < 0) try { c.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); } catch (e) { }
}
/* keep every song map on the page in step with the playhead, a few times a second (only the ones that are showing) */
setInterval(() => { document.querySelectorAll('.smap').forEach(m => { if (m._paint && m.offsetParent) try { m._paint(); } catch (e) { } }); try { wsheetFollow(); } catch (e) { } }, 250);

/* ---------- a section's own actions, as a menu (the phone's ⋯; part 18c) ---------- */
/** rename, move, duplicate or delete section si; done(newIndex) after each */
function secMenu(anchor, si, done) {
  const sec = S.sections[si]; if (!sec) return; const fin = i => { closePop(); T.bars = null; commit(); bus.emit('song', 'reload'); if (done) done(i); };
  const mv = d => () => { const j = si + d; if (j < 0 || j >= S.sections.length) return closePop(); [S.sections[si], S.sections[j]] = [S.sections[j], S.sections[si]]; fin(j); };
  popover(anchor, h('div', { class: 'sm-add sm-menu', role: 'menu', 'aria-label': sec.name },
    h('b', {}, sec.name),
    h('button', { class: 'btn', role: 'menuitem', onclick: () => { const v = (prompt('Name this section:', sec.name) || '').trim(); if (!v) return closePop(); sec.name = v.slice(0, 40); fin(si); } }, '✎ Rename'),
    h('div', { class: 'sm-add-g' }, h('button', { class: 'btn', role: 'menuitem', disabled: si === 0, onclick: mv(-1) }, '↑ Earlier'), h('button', { class: 'btn', role: 'menuitem', disabled: si === S.sections.length - 1, onclick: mv(1) }, '↓ Later')),
    h('button', { class: 'btn', role: 'menuitem', onclick: () => { const c = JSON.parse(JSON.stringify(sec)); c.id = uid(); S.sections.splice(si + 1, 0, c); fin(si + 1); } }, '⧉ Repeat it after itself'),
    h('button', { class: 'btn', role: 'menuitem', onclick: () => { closePop(); T.cursor = secStart(si) * spb(); if (T.playing) stopPlay(true); play(); } }, '▶ Play from here'),
    h('button', { class: 'btn bad', role: 'menuitem', disabled: S.sections.length < 2, onclick: () => { if (!confirm('Delete ' + sec.name + '? Undo brings it back.')) return closePop(); S.sections.splice(si, 1); fin(Math.max(0, si - 1)); } }, '✕ Delete')), { right: true });
}

/** what comes after writing, from the sheet: sing it in Perform, send it as a link, print it */
function wsNext(phone) {
  return h('div', { class: 'ws-next' + (phone ? ' ws-next-m' : '') },
    h('button', { class: 'btn sm', id: phone ? 'mwPerform' : 'wsPerform', title: 'Sing or play it through: the words in time with the band, as a sing-along', onclick: () => { try { perfOpen(); } catch (e) { } } }, '🎤 Perform'),
    h('button', { class: 'btn sm', id: phone ? 'mwSend' : 'wsSend', title: 'Send the song as a link: the chords, words and beat ride inside it, and nothing is uploaded', onclick: () => { try { slShare(); } catch (e) { } } }, '🔗 Send'),
    phone ? '' : h('button', { class: 'btn sm', id: 'wsPrint', title: 'Print the chord sheet, or save it as a PDF', onclick: () => { try { printSheet(); } catch (e) { } } }, '🖨 Print'));
}
/** a song with nothing in it yet: how to begin */
function wsEmpty(phone) {
  const any = S.sections.some(s => (s.lyrics || '').trim() || s.bars.some(b => (b.chord || '').trim())); if (any) return '';
  return h('div', { class: 'ws-empty' }, h('b', {}, 'A blank page.'), ' ', phone ? 'Tap ＋ for an intro, a verse and a chorus, or ⧉ Paste a lyric sheet you already have.' : 'Press ＋ Section for an intro, a verse and a chorus, or 📋 Paste lyrics you already have. 🥁 Beats gives you a groove to write over.');
}
