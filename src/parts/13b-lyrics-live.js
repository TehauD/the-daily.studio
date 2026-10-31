/* ============================================================
   Part 13b · LYRICS IN TIME, WITH THEIR CHORDS OVER THE WORDS
   While the song plays, the stage, the lower third and Perform show the line being sung with its chords above the words,
   each one over the syllable it was written over (as on the chord sheet), and the chord being played lit up.
   Which line is "now" comes from the chords written in the lyrics: a line with [E]…[B]…[F#m]…[A] is on screen while the
   bars E, B, F#m and A play. A section whose lyrics carry no chords keeps the old way: its lines share its bars evenly.
   ============================================================ */
const LYT = new WeakMap();
const lyPlain = l => parseLyricLine(l).text.trim();
/** a lyric line laid out for display: { text, chords: [{ col, sym }] }. Each chord sits over the character it was written
    before; when two chords would touch, the words are spaced out so each chord still sits over its own syllable. */
function lyLayout(line) {
  const { text, chords } = parseLyricLine(line || ''); let t = text, shift = 0, end = -1; const out = [];
  chords.forEach(c => {
    let col = c.pos + shift; if (col > t.length) { t = t.padEnd(col); }
    if (end >= 0 && col < end + 1) { const add = end + 1 - col; t = t.slice(0, col) + ' '.repeat(add) + t.slice(col); shift += add; col += add; }
    out.push({ col, sym: c.sym }); end = col + c.sym.length;
  });
  const lead = Math.min((t.match(/^ */) || [''])[0].length, out.length ? out[0].col : 1e9);
  return { text: t.slice(lead).replace(/\s+$/, ''), chords: out.map(c => ({ col: c.col - lead, sym: c.sym })) };
}
const lySame = (a, b) => { if (a === b) return true; const x = parseChord(a), y = parseChord(b); return !!(x && y && x.name === y.name); };
/** when each lyric line of a section is sung: for every chord event of the section (a bar, or half a bar for "Am G"), the
    line on screen and which of its chords is playing. null when the lyrics carry no chords. Cached per section. */
function lyTimeline(sec) {
  const key = (sec.lyrics || '') + '\u0001' + sec.bars.map(b => b.chord || '').join('|'), hit = LYT.get(sec); if (hit && hit.key === key) return hit.v;
  const lines = (sec.lyrics || '').split('\n').filter(l => l.trim()), mk = [], ev = [], first = [];
  lines.forEach((l, li) => parseLyricLine(l).chords.forEach((c, mi) => mk.push({ li, mi, sym: c.sym })));
  sec.bars.forEach((b, bi) => { const cs = barChords(b), n = Math.max(1, cs.length); first[bi] = ev.length; for (let k = 0; k < n; k++) ev.push({ bi, sym: cs[k] || '' }); });
  let v = null;
  if (mk.length && ev.length) {
    /* walk the bars and the written chords together: a bar that plays the next written chord moves on to it; a bar that
       repeats it (a chord held for two bars) or has no chord stays where it is */
    let j = 0, got = 0; const at = ev.map(e => {
      if (e.sym && j < mk.length && lySame(e.sym, mk[j].sym)) { got++; return j++; }
      if (e.sym && j + 1 < mk.length && lySame(e.sym, mk[j + 1].sym) && !(j > 0 && lySame(e.sym, mk[j - 1].sym))) { got++; j += 2; return j - 1; }   // a written chord with no bar of its own
      return j - 1;
    });
    const m = got >= mk.length * .6 ? at : ev.map((e, i) => Math.floor(i * mk.length / ev.length));   // bars edited away from the words: spread them evenly
    const lineOf = m.map(x => x < 0 ? mk[0].li : mk[x].li), mkOf = m.map(x => x < 0 ? -1 : mk[x].mi), chorded = new Set(mk.map(x => x.li));
    /* lines without chords: those before the first chord take the bars before it; those after a line take turns with that
       line's last chord when it lasts long enough to share */
    const pre = []; for (let li = 0; li < mk[0].li; li++) pre.push(li);
    const lead = m.map((x, i) => x < 0 ? i : -1).filter(i => i >= 0); if (pre.length && lead.length) lead.forEach((i, k) => { lineOf[i] = pre[Math.min(pre.length - 1, Math.floor(k * pre.length / lead.length))]; mkOf[i] = -1; });
    lines.forEach((l, li) => {
      if (!chorded.has(li)) return; const after = []; for (let q = li + 1; q < lines.length && !chorded.has(q); q++) after.push(q); if (!after.length) return;
      const last = mk.reduce((a, x, gi) => x.li === li ? gi : a, -1), run = m.map((x, i) => x === last ? i : -1).filter(i => i >= 0); if (run.length < 2) return;
      const parts = Math.min(after.length + 1, run.length); run.forEach((i, k) => { const p = Math.floor(k * parts / run.length); if (p > 0) { lineOf[i] = after[p - 1]; mkOf[i] = -1; } });
    });
    v = { lineOf, mkOf, first };
  }
  LYT.set(sec, { key, v }); return v;
}
/** the line on screen at bar bi (of the section), slot sib within the bar: { lines, idx, mi } (mi: the playing chord in that line, -1 none) */
function lyAt(sec, bi, sib) {
  const lines = (sec.lyrics || '').split('\n').filter(l => l.trim()); if (!lines.length) return { lines, idx: -1, mi: -1 };
  const v = lyTimeline(sec);
  if (!v) return { lines, idx: Math.min(lines.length - 1, Math.floor(bi / sec.bars.length * lines.length)), mi: -1 };
  const cs = barChords(sec.bars[bi] || { chord: '' }), n = Math.max(1, cs.length), k = Math.min(n - 1, Math.floor((sib || 0) / (spb() / n))), e = (v.first[bi] || 0) + k;
  return { lines, idx: v.lineOf[e] != null ? v.lineOf[e] : 0, mi: v.mkOf[e] != null ? v.mkOf[e] : -1 };
}
/** draw a line with its chords above the words on a canvas. o: { x, y (baseline of the words), w (widest it may be), px (size of
    the words), font, weight, align ('center' | 'left'), ly (from lyLayout, with .cur = the playing chord), hi (colour of the
    playing chord), dim (true for the next line) }. Shrinks to fit. Returns the height it used above y. */
function lyDraw(g, o) {
  const ly = o.ly, cs = ly.chords, mx = cs.reduce((a, c) => Math.max(a, c.col), 0), pad = ly.text.padEnd(mx);
  let px = o.px, cpx, xs, tw;
  const lay = () => {
    cpx = Math.round(px * .78); g.font = `${o.weight || 700} ${px}px ${o.font}`; tw = g.measureText(ly.text).width; xs = cs.map(c => g.measureText(pad.slice(0, c.col)).width);
    g.font = `800 ${cpx}px ${o.font}`; return cs.reduce((a, c, i) => Math.max(a, xs[i] + g.measureText(c.sym).width * 1.12), tw);
  };
  let full = lay(); if (full > o.w) { px = Math.max(8, Math.floor(px * o.w / full)); full = lay(); }
  const x0 = o.align === 'left' ? o.x : o.x - full / 2, cy = o.y - px * (cs.length ? 1.02 : 0), a = o.dim ? .5 : 1;
  g.save(); g.textAlign = 'left';
  if (ly.text) { g.font = `${o.weight || 700} ${px}px ${o.font}`; g.fillStyle = 'rgba(255,255,255,' + a + ')'; g.fillText(ly.text, x0, o.y); }
  cs.forEach((c, i) => {
    const now = !o.dim && i === ly.cur, past = !o.dim && ly.cur != null && ly.cur >= 0 && i < ly.cur;
    g.font = `800 ${Math.round(cpx * (now ? 1.12 : 1))}px ${o.font}`; g.fillStyle = now ? (o.hi || '#ffd166') : 'rgba(255,255,255,' + (o.dim ? .45 : past ? .42 : .9) + ')';
    g.fillText(c.sym, x0 + xs[i], cy);
    if (now) { const wd = g.measureText(c.sym).width; g.fillRect(x0 + xs[i], cy + px * .1, wd, Math.max(2, px * .06)); }
  });
  g.restore(); return cs.length ? px * 2.05 : px * 1.1;
}
/** the same line for the page (Perform): segments with the chord above the words; the playing chord gets the class "cur" */
function lyNodes(line, cur) {
  const ly = lyLayout(line); if (!ly.chords.length) return [ly.text || ' '];
  const out = [], cols = ly.chords.map(c => c.col);
  if (cols[0] > 0) out.push(h('span', { class: 'ly-seg' }, h('b', { class: 'ly-c' }, ' '), h('span', { class: 'ly-w' }, ly.text.slice(0, cols[0]))));
  ly.chords.forEach((c, i) => {
    const w = ly.text.slice(c.col, i + 1 < cols.length ? cols[i + 1] : undefined);
    out.push(h('span', { class: 'ly-seg' }, h('b', { class: 'ly-c' + (i === cur ? ' cur' : cur != null && cur >= 0 && i < cur ? ' past' : '') }, c.sym), h('span', { class: 'ly-w' }, w || ' ')));
  });
  return out;
}
