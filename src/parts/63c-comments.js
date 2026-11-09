/* ============================================================
   Part 63c · COMMENTS PINNED TO A MOMENT (2.58) — "bar 12: rush here?"
   💬 Comment (the arrangement's bar, or C) pins a note to the playhead's place in the song: a bar and beat, not a time in seconds, so it
   stays on the beat if the tempo changes. Comments show on the arrangement's ruler, are listed in 💬 Comments (jump to one, mark it done,
   remove it), are part of the song (and so of its versions and sync), and travel in song links with the song: the open ones, up to 20,
   with who wrote them. Writing together becomes a conversation about the song, at the place it's about.
   ============================================================ */
const CMT = { max: 60, len: 280, link: 20 };
const cmtAll = () => (Array.isArray(S.comments) ? S.comments : (S.comments = []));
/** the section and bar.beat of a slot */
function cmtWhere(slot) {
  const sp = spb(), bar = Math.floor(slot / sp); let si = S.sections.findIndex((_, i) => bar >= secStart(i) && bar < secStart(i) + S.sections[i].bars.length); if (si < 0) si = S.sections.length - 1;
  const beat = Math.floor((slot % sp) / Math.max(1, sp / (S.ts[0] || 4))) + 1;
  return { si, sec: S.sections[si] ? S.sections[si].name : '', bar: bar + 1, beat, label: 'bar ' + (bar + 1) + (beat > 1 ? '.' + beat : '') };
}
function cmtAdd(text, slot) {
  text = String(text || '').trim().slice(0, CMT.len); if (!text) return null; const at = Math.max(0, slot == null ? playheadSlot() : slot), w = cmtWhere(at);
  const c = { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: Math.round(at * 100) / 100, sec: w.sec, text, who: CFG.slName || '', day: slcDay(), done: false };
  const a = cmtAll(); a.push(c); a.sort((x, y) => x.at - y.at); if (a.length > CMT.max) a.splice(0, a.length - CMT.max); commit(false); TL.dirty = true; bus.emit('comments'); return c;
}
function cmtJump(c) { if (T.playing) stopPlay(true); T.cursor = c.at; try { syncTransport(); } catch (e) { } TL.dirty = true; const w = cmtWhere(c.at); if (w.si >= 0) { SEL.sec = w.si; bus.emit('song', 'sel'); } }
/** the comments a link carries, and reading them back (untrusted: lengths capped, numbers clamped) */
const cmtPack = s => { const a = (s.comments || []).filter(c => c && !c.done).slice(0, CMT.link); return a.length ? a.map(c => [c.at, c.text, c.who || '', c.day || 0, c.sec || '']) : undefined; };
function cmtUnpack(a, str) {
  if (!Array.isArray(a)) return []; return a.slice(0, CMT.link).map((x, i) => Array.isArray(x) && Number.isFinite(+x[0]) ? { id: 'm' + i + Math.random().toString(36).slice(2, 6), at: clamp(+x[0], 0, 1e5), text: str(x[1], CMT.len).trim(), who: str(x[2], 40).trim(), day: Number.isFinite(+x[3]) ? Math.round(+x[3]) : 0, sec: str(x[4], 40), done: false } : null).filter(c => c && c.text);
}
/** a comment as a line: "bar 12 · Verse 1 · Sam: rush here?" */
const cmtLine = c => cmtWhere(c.at).label + (c.sec ? ' · ' + c.sec : '') + (c.who ? ' · ' + c.who : '') + ': ' + c.text;
function cmtOpen(focusNew) {
  const ta = h('textarea', { class: 'in', id: 'cmtText', rows: 2, maxlength: CMT.len, placeholder: 'A note for this moment: “rush here?”, “double the vocal”, “new chord?”' }), here = cmtWhere(playheadSlot());
  const list = h('ol', { class: 'cmt-list', id: 'cmtList' }), paint = () => {
    const a = cmtAll(); list.replaceChildren(...(a.length ? a.map(c => h('li', { class: c.done ? 'done' : '' },
      h('button', { class: 'linkish', title: 'Go there', onclick: () => cmtJump(c) }, cmtWhere(c.at).label), h('span', { class: 'tiny muted' }, (c.sec ? ' · ' + c.sec : '') + (c.who ? ' · ' + c.who : '')), h('div', { class: 'cmt-t' }, c.text),
      h('div', { class: 'row', style: { gap: '6px' } }, h('button', { class: 'btn sm', onclick: () => { c.done = !c.done; commit(false); TL.dirty = true; paint(); bus.emit('comments'); } }, c.done ? '↺ Open again' : '✓ Done'),
        h('button', { class: 'btn sm', 'aria-label': 'Remove comment', onclick: () => { const i = a.indexOf(c); if (i >= 0) a.splice(i, 1); commit(false); TL.dirty = true; paint(); bus.emit('comments'); } }, '✕'))))
      : [h('li', { class: 'muted small' }, 'No comments yet.')]));
  };
  paint();
  pdlg('cmtDlg', '💬 Comments on “' + (S.title || 'Untitled') + '”', h('div', { class: 'cmt' },
    h('p', { class: 'small' }, 'Pinned to ', h('b', {}, here.label + (here.sec ? ' · ' + here.sec : '')), ' (where the playhead is). Comments go with the song when you send it, so whoever you write with sees them at the same place.'),
    ta, h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '8px' } }, h('button', { class: 'btn primary', id: 'cmtAdd', onclick: () => { if (cmtAdd(ta.value)) { ta.value = ''; paint(); } } }, '💬 Add here')), list), {});
  if (focusNew !== false) setTimeout(() => ta.focus(), 50);
}
/** the ruler's markers (drawn by drawTL in part 07) */
function cmtDraw(g, sw, end, C) {
  const a = S.comments; if (!a || !a.length) return;
  a.forEach(c => { const x = c.at * sw; g.globalAlpha = c.done ? .35 : 1; g.fillStyle = '#e0a31a'; g.beginPath(); g.moveTo(x, 2); g.lineTo(x + 9, 2); g.lineTo(x + 9, 10); g.lineTo(x + 4, 10); g.lineTo(x, 14); g.closePath(); g.fill(); g.strokeStyle = '#e0a31a'; g.globalAlpha = c.done ? .15 : .35; g.beginPath(); g.moveTo(x + .5, 14); g.lineTo(x + .5, end); g.stroke(); g.globalAlpha = 1; });
}
document.addEventListener('keydown', e => { if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') && !(e.target && e.target.isContentEditable) && !document.querySelector('dialog[open]')) { e.preventDefault(); cmtOpen(); } });
