/* ============================================================
   Part 80b · COACH FEEDBACK (2.34) — after a go, the coach says what happened and what to do next
     · the notes that went wrong, on the neck: the note it wanted (green) beside where you probably were (red ✕), and in words
       ("one fret too high")
     · timing on a strip: every stroke or note against the beat, early above the line and late below, missed ones hollow
     · advice with a button: practise just the tricky notes, slow down by 10, try again
     · your take: the attempt is recorded from the input while the coach listens, so you can hear it right after the demo. It is kept
       in memory only, never saved, and is dropped when you move on or have another go.
   ============================================================ */
const TAKE = { rec: null, url: null, au: null, n: 0 };
function coTakeStart() {
  coTakeDrop(); if (!E.stream || typeof MediaRecorder === 'undefined' || CFG.learn.take === false) return;
  try {
    const r = new MediaRecorder(E.stream), chunks = [], n = ++TAKE.n;
    r.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    r.onstop = () => { if (n !== TAKE.n || !chunks.length) return; TAKE.url = URL.createObjectURL(new Blob(chunks, { type: r.mimeType || 'audio/webm' })); coPaint(); };
    r.start(); TAKE.rec = r;
  } catch (e) { TAKE.rec = null; }
}
function coTakeStop() { const r = TAKE.rec; TAKE.rec = null; if (r && r.state !== 'inactive') { try { r.stop(); } catch (e) { } } }
function coTakeDrop() { coTakeStop(); TAKE.n++; if (TAKE.au) { try { TAKE.au.pause(); } catch (e) { } TAKE.au = null; } if (TAKE.url) { try { URL.revokeObjectURL(TAKE.url); } catch (e) { } } TAKE.url = null; }
function coTakePlay() { if (!TAKE.url) return; if (TAKE.au) { try { TAKE.au.pause(); } catch (e) { } } TAKE.au = new Audio(TAKE.url); TAKE.au.play().catch(() => { }); }

/** "bar 2, beat 3&" for a place in 16ths */
const coBeat = at => { const bar = Math.floor(at / 16) + 1, r = ((at % 16) + 16) % 16; return 'bar ' + bar + ', beat ' + (Math.floor(r / 4) + 1) + ['', 'e', '&', 'a'][r % 4]; };
/** what to say and offer after a go (R is the run that just finished) */
function coFeedback(R, ok, bpm0) {
  const p = CO.p, ns = (p.notes || []).filter(n => !n.r), fb = { ok, tips: [], acts: [] }, mOf = n => n.ch ? n.ch[0].m : n.m;
  if (R.log && R.log.length && ns.length) {
    fb.wrong = R.log.filter(x => ns[x.i]).map(x => ({ i: x.i, want: ns[x.i], got: x.got }));
    if (fb.wrong.length) {
      const by = {}; fb.wrong.forEach(x => { by[x.i] = (by[x.i] || 0) + 1; }); const k = +Object.keys(by).sort((a, b) => by[b] - by[a] || a - b)[0], w = fb.wrong.find(x => x.i === k), wm = mOf(w.want), d = w.got - wm;
      const how = Math.abs(d) === 1 ? ' That is one fret too ' + (d > 0 ? 'high' : 'low') + '.' : Math.abs(d) === 2 ? ' That is two frets too ' + (d > 0 ? 'high' : 'low') + '.' : '';
      fb.tips.push((Object.keys(by).length > 1 ? 'The trickiest spot is note ' : 'The slip was at note ') + (k + 1) + ': it wants ' + coName(wm) + ' (string ' + (wsTune().length - w.want.s) + ', ' + (w.want.f ? 'fret ' + w.want.f : 'open') + '), and you played ' + coName(w.got) + '.' + how);
      const a = Math.max(0, k - 1), b = Math.min(ns.length, a + 4);
      if (ns.length > 4) fb.acts.push(['coFbPart', '🔁 Practise notes ' + (a + 1) + '–' + b, () => coPractise(a, b)]);
    }
  }
  if (R.timing && R.timing.items.length) {
    const it = R.timing.items, got = it.filter(x => x.d != null), miss = it.length - got.length, avg = got.length ? got.reduce((s, x) => s + Math.abs(x.d), 0) / got.length : 0, lean = got.length ? got.reduce((s, x) => s + x.d, 0) / got.length : 0;
    const worst = got.slice().sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0]; fb.timing = R.timing;
    if (miss) fb.tips.push(miss + ' of ' + it.length + (p.kind === 'rhythm' ? ' strokes' : ' notes') + ' were not heard near the beat (the hollow ones).');
    if (Math.abs(lean) > 12) fb.tips.push(lean < 0 ? 'You are rushing, about ' + Math.round(-lean) + ' ms ahead of the click. Let the click land first, and count out loud.' : 'You are dragging, about ' + Math.round(lean) + ' ms behind the click. Play on the click, not after it.');
    if (worst && Math.abs(worst.d) > 30) fb.tips.push('Furthest out: ' + coBeat(worst.at) + ', ' + Math.round(Math.abs(worst.d)) + ' ms ' + (worst.d < 0 ? 'early' : 'late') + '.');
    if (!ok && (avg > 35 || miss > it.length * .2)) fb.acts.push(['coFbSlow', '🐢 Slower: ' + Math.max(40, bpm0 - 10) + ' BPM', () => { CO.bpm = Math.max(40, bpm0 - 10); CO.fb = null; coListen(); }]);
  }
  if (!ok && p.kind === 'landing') fb.tips.push('Aim for the root of each new chord first: it is always a chord tone. Then try its third.');
  if (!ok && p.kind === 'changes') { fb.tips.push('Look ahead: start moving to the next chord on beat 4, not on beat 1. Lift only the fingers that have to move.'); if (!fb.acts.some(a => a[0] === 'coFbSlow')) fb.acts.push(['coFbSlow', '🐢 Slower: ' + Math.max(40, bpm0 - 10) + ' BPM', () => { CO.bpm = Math.max(40, bpm0 - 10); CO.fb = null; coListen(); }]); }
  if (ok && !fb.tips.length) fb.tips.push(CO.bpm > bpm0 ? 'Clean. The next go is ' + CO.bpm + ' BPM: same feel, a little quicker.' : 'Clean.');
  if (ok && p.ear) fb.tips.push(CO.reveal ? 'Next time try it before you look.' : 'All by ear. The next one is a note longer.');
  fb.acts.unshift(['coFbAgain', ok ? '↻ Again' : '↻ Try again', () => { CO.fb = null; coListen(); }]);
  return fb;
}
/** a short piece of just the tricky notes, slower, put in after this one */
function coPractise(a, b) {
  const p = CO.p, ns = (p.notes || []).filter(n => !n.r).slice(a, b); if (!ns.length) return; const t0 = ns[0].at;
  const notes = ns.map(n => Object.assign({}, n, { at: n.at - t0 })), len = Math.max(8, Math.ceil((notes[notes.length - 1].at + 4) / 4) * 4);
  const q = { kind: 'notes', id: (p.id || 'piece') + '.part' + a, title: p.title + ' · notes ' + (a + 1) + '–' + b, text: 'Just the tricky part, slower. Play it until it is clean twice, then go back to the whole thing.', notes, len, bpm: Math.max(40, CO.bpm - 10), keyed: false, ear: false };
  CO.list.splice(CO.idx + 1, 0, q); coSetPiece(CO.idx + 1);
}
/** the timing strip: the beats, each stroke or note early (up) or late (down) */
function coTimeline(t) {
  const W = 600, H = 74, cy = 37, x = at => 14 + at / Math.max(1, t.len) * (W - 28), ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  const el = (tag, a, txt) => { const e = document.createElementNS(ns, tag); Object.entries(a).forEach(([k, v]) => e.setAttribute(k, v)); if (txt != null) e.textContent = txt; svg.append(e); return e; };
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('class', 'co-tl'); svg.setAttribute('role', 'img');
  const got = t.items.filter(i => i.d != null); svg.setAttribute('aria-label', 'Timing: ' + got.length + ' of ' + t.items.length + ' on the beat; ' + got.filter(i => i.d < -20).length + ' early, ' + got.filter(i => i.d > 20).length + ' late');
  for (let b = 0; b <= t.len; b += 4) el('line', { x1: x(b), x2: x(b), y1: 8, y2: H - 8, class: b % 16 === 0 ? 'tl-bar' : 'tl-beat' });
  el('line', { x1: 14, x2: W - 14, y1: cy, y2: cy, class: 'tl-mid' }); el('text', { x: 16, y: 13, class: 'tl-lab' }, 'early'); el('text', { x: 16, y: H - 4, class: 'tl-lab' }, 'late');
  t.items.forEach(i => { const xx = x(i.at); if (i.d == null) { el('circle', { cx: xx, cy, r: 5, class: 'tl-miss' }); return; } const y = cy + Math.max(-30, Math.min(30, i.d * .3)), a = Math.abs(i.d); el('line', { x1: xx, x2: xx, y1: cy, y2: y, class: 'tl-stem' }); el('circle', { cx: xx, cy: y, r: 4.5, class: 'tl-dot ' + (a <= 20 ? 'good' : a <= 45 ? 'meh' : 'bad') }); });
  return svg;
}
/** the feedback block under the result */
function coFbView(fb) {
  const box = h('div', { class: 'co-fbv' + (fb.ok ? ' ok' : '') });
  if (fb.wrong && fb.wrong.length) {
    const marks = []; const seen = new Set();
    fb.wrong.forEach(x => { const w = x.want.ch ? x.want.ch[0] : x.want, k = x.i; if (seen.has(k)) return; seen.add(k); marks.push({ s: w.s, f: w.f, m: w.m, deg: coName(w.m), cls: 'want' }); const pl = wsPlace(x.got, w.f); marks.push({ s: pl.s, f: pl.f, m: x.got, deg: '✕', cls: 'wrong' }); });
    const fs = marks.map(q => q.f);
    box.append(h('div', { class: 'co-fb-neck' }, h('small', {}, 'Wanted (green) and where you probably were (✕)'), h('div', { class: 'co-board' }, wsFret({ title: 'Your slips', st: Math.min(...fs), notes: marks }, null, innerWidth < 640))));
  }
  if (fb.timing) box.append(h('div', { class: 'co-fb-time' }, h('small', {}, 'Timing: each dot is a ' + (CO.p && CO.p.kind === 'rhythm' ? 'stroke' : 'note') + ', on the line is on the beat'), coTimeline(fb.timing)));
  box.append(h('ul', { class: 'co-tips' }, fb.tips.map(t => h('li', {}, t))));
  box.append(h('div', { class: 'co-fb-acts' }, fb.acts.map(([id, label, fn]) => h('button', { class: 'btn sm', id, type: 'button', onclick: fn }, label)),
    TAKE.url ? h('button', { class: 'btn sm', id: 'coTake', type: 'button', onclick: coTakePlay }, '🎧 Hear my take') : null,
    TAKE.url && CO.p && CO.p.kind !== 'info' ? h('button', { class: 'btn sm', id: 'coDemoAgain', type: 'button', onclick: () => coDemo() }, '▶ Hear the coach') : null));
  return box;
}
