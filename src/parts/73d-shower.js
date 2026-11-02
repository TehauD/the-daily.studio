/* ============================================================
   Part 73d · SHOWER MODE (2.25) — practise scales, arpeggios and your ear, where everyone sounds better
   Not responsible for damage to electronic devices. Three trainers in one room, each with a fretboard drawn for the song's tuning and capo:
     · Scales      a key, a scale, where on the neck, one or two octaves. ▶ Listen plays it; ● Play it follows you note by note,
                   up and back down, by the pitch the tuner already hears (a wrong note counts, a note still ringing does not)
     · Arpeggios   the chords of this song one note at a time, or one chord up and down
     · Your ear    an interval is played, you name it; a streak and a best
   Three of the seven secrets open treasures in here, but only one is found in here (the rest are out in the studio, to be explored):
     · Up and down     a scale up and back down, anywhere the tuner hears you (part 73b)   → modes and more scales
     · Broken chords   the band's chords broken into notes while the song plays (part 73b)  → seventh arpeggios
     · Golden ear      ten in a row by ear, in here, from six choices or more             → chord qualities by ear
   With hidden surprises off (Settings ▸ Workflow), the treasures are simply open: nobody has to hunt for practice.
   It listens to the input the tuner uses and records nothing; ▶ Listen plays through the studio's own lead voice.
   ============================================================ */
CFG.shed = Object.assign({ scale: 'Minor Pentatonic', key: null, at: null, oct: 1, src: 'song', root: null, type: '', arpAt: null, ear: 'more' }, CFG.shed && typeof CFG.shed === 'object' ? CFG.shed : {});
const WS = { run: null, tm: 0, play: [], ear: { q: null, streak: 0, best: 0, n: 0, ok: 0, lock: false }, r: {} };
const WS_CHEERS = ['The acoustics in here are incredible. 🚿', 'Squeaky clean. 🧼', 'Somebody hand this person a towel and a record deal.', 'Even the rubber duck is impressed. 🦆', 'Steam-powered. 💨'];
const WS_BASE = ['Major (Ionian)', 'Natural Minor (Aeolian)', 'Major Pentatonic', 'Minor Pentatonic', 'Blues'];
const WS_ARPS = [['', 'Major', [0, 4, 7]], ['m', 'Minor', [0, 3, 7]], ['dim', 'Diminished', [0, 3, 6]], ['aug', 'Augmented', [0, 4, 8]], ['maj7', 'Major 7', [0, 4, 7, 11], 1], ['7', 'Dominant 7', [0, 4, 7, 10], 1], ['m7', 'Minor 7', [0, 3, 7, 10], 1], ['m7b5', 'Half-diminished', [0, 3, 6, 10], 1], ['dim7', 'Diminished 7', [0, 3, 6, 9], 1]];
const WS_IV = [['m2', 'minor 2nd', 1], ['M2', 'major 2nd', 2], ['m3', 'minor 3rd', 3], ['M3', 'major 3rd', 4], ['P4', 'perfect 4th', 5], ['TT', 'tritone', 6], ['P5', 'perfect 5th', 7], ['m6', 'minor 6th', 8], ['M6', 'major 6th', 9], ['m7', 'minor 7th', 10], ['M7', 'major 7th', 11], ['P8', 'octave', 12]];
const WS_SETS = { easy: ['M3', 'P4', 'P5', 'P8'], more: ['m3', 'M3', 'P4', 'P5', 'M6', 'P8'], all: WS_IV.map(x => x[0]) };
const WS_CQ = [['Major', [0, 4, 7]], ['Minor', [0, 3, 7]], ['Diminished', [0, 3, 6]], ['Augmented', [0, 4, 8]], ['Major 7', [0, 4, 7, 11]], ['Dominant 7', [0, 4, 7, 10]], ['Minor 7', [0, 3, 7, 10]]];
/** a treasure is open once its secret is found, or when hidden surprises are off */
const wsOpen = id => !!CFG.secrets[id] || !secretsOn();
const wsKey = () => CFG.shed.key == null ? S.key : CFG.shed.key;
const wsFlats = () => keyUsesFlats(wsKey(), /min|Minor|Blues|Dorian|Phrygian|Locrian|Aeolian/.test(CFG.shed.scale));
const wsTune = () => (S.tuning && S.tuning.length ? S.tuning : [40, 45, 50, 55, 59, 64]);
const wsName = m => pcName(m, wsFlats());

/* ---------- where on the neck ---------- */
/** frets on the lowest string where a scale note lies (from the capo up an octave): the places a box can start */
function wsStarts(pcs) { const t0 = wsTune()[0], c = S.capo || 0, out = []; for (let f = c; f <= c + 12; f++) if (pcs.includes(((t0 + f) % 12 + 12) % 12)) out.push(f); return out; }
/** the string and fret for a note, as near the box as it can be */
function wsPlace(m, st) {
  const tu = wsTune(), c = S.capo || 0; let best = null;
  tu.forEach((o, s) => { const f = m - o; if (f < c || f > 22) return; const cost = Math.abs(f - (st + 1.5)) + (f < st - 1 || f > st + 4 ? 3 : 0) + s * .01; if (!best || cost < best.cost) best = { s, f, cost }; });
  return best || { s: 0, f: Math.max(c, m - tu[0]) };
}
/** the lowest note of a pitch class at or above the box's lowest fret */
const wsRootAt = (pc, st) => { const t0 = wsTune()[0], lo = t0 + Math.max(S.capo || 0, st - 1); let m = lo + (((pc - lo) % 12) + 12) % 12; return m; };

/* ---------- the runs ---------- */
function wsScaleRun() {
  const sc = SCALES[CFG.shed.scale] || SCALES['Minor Pentatonic'], key = wsKey(), pcs = sc.map(i => (key + i) % 12), starts = wsStarts(pcs);
  const st = starts.includes(CFG.shed.at) ? CFG.shed.at : starts.find(f => ((wsTune()[0] + f) % 12) === key % 12) ?? starts[0] ?? 0, r0 = wsRootAt(key, st), up = [];
  for (let o = 0; o < (CFG.shed.oct || 1); o++) sc.forEach(iv => up.push(r0 + 12 * o + iv)); up.push(r0 + 12 * (CFG.shed.oct || 1));
  const seq = up.concat(up.slice(0, -1).reverse()).map(m => Object.assign({ m, deg: IVNAMES[((m - key) % 12 + 12) % 12] }, wsPlace(m, st)));
  return { kind: 'scale', title: wsName(key) + ' ' + CFG.shed.scale, notes: seq, st, pcs, root: key, starts };
}
function wsChordTones(sym) {      /* triads always; with the treasure, the seventh too */
  const c = parseChord(sym); if (!c) return null; const iv = [...new Set(c.iv.map(i => i % 12))];
  const third = iv.find(i => i === 3 || i === 4) ?? iv.find(i => i === 2 || i === 5), fifth = iv.find(i => i === 7) ?? iv.find(i => i === 6 || i === 8) ?? 7, t = [0, third ?? 4, fifth];
  if (wsOpen('arp')) { const sev = iv.find(i => i === 10 || i === 11) ?? (iv.includes(9) && third === 3 && fifth === 6 ? 9 : undefined); if (sev != null) t.push(sev); }
  return { root: c.root, iv: t.sort((a, b) => a - b), sym };
}
function wsArpRun() {
  let chords = [];
  if (CFG.shed.src === 'song') { let last = ''; flatBars().forEach(b => { const s = b.bar.chord; if (s && s !== last) { last = s; const t = wsChordTones(s); if (t) chords.push(t); } }); chords = chords.slice(0, 8); }
  else { const a = WS_ARPS.find(x => x[0] === CFG.shed.type) || WS_ARPS[0], root = CFG.shed.root == null ? S.key : CFG.shed.root; chords = [{ root, iv: a[2].slice(), sym: pcName(root, wsFlats()) + a[0] }]; }
  if (!chords.length) return { kind: 'arp', title: 'No chords yet', notes: [], chords: [], st: 0 };
  const st = CFG.shed.arpAt != null ? CFG.shed.arpAt : (() => { const t0 = wsTune()[0], c = S.capo || 0; let f = ((chords[0].root - t0) % 12 + 12) % 12; while (f < c) f += 12; return f; })();
  const notes = []; chords.forEach((ch, ci) => {
    const rm = wsRootAt(ch.root, st), run = ch.iv.map(i => rm + i).concat(rm + 12), seq = CFG.shed.src === 'song' ? run : run.concat(run.slice(0, -1).reverse());
    seq.forEach(m => { if (notes.length && notes[notes.length - 1].m % 12 === m % 12) return; notes.push(Object.assign({ m, ci, deg: IVNAMES[((m - ch.root) % 12 + 12) % 12] }, wsPlace(m, st))); });
  });
  return { kind: 'arp', title: chords.map(c => c.sym).join(' · '), notes, chords, st };
}

/* ---------- the fretboard ---------- */
/* the fretboard: 15 frets on a wide screen; on a narrow one (a phone) only the frets the run uses, a little either side, so the dots stay big enough to read */
function wsFretSpan(run, narrow) {
  if (!narrow || !run || !run.notes.length) return [0, 15];
  const fs = run.notes.map(q => q.f), lo = Math.min(...fs), hi = Math.max(...fs), a = Math.max(0, lo - 1), b = Math.min(17, Math.max(hi + 1, a + 5));
  return [a, b];
}
function wsFret(run, cur, narrow) {
  const tu = wsTune(), n = tu.length, [fa, fb] = wsFretSpan(run, narrow), F = fb - fa, x0 = 34, fw = narrow ? 46 : (820 - x0 - 10) / 15, W = x0 + F * fw + 10, H = 26 + n * 22 + (fa ? 12 : 0);
  const y = s => 16 + (n - 1 - s) * 22, xf = f => f === 0 ? x0 - 12 : x0 + (f - fa - .5) * fw, by = 26 + n * 22;
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), el = (t, a, txt) => { const e = document.createElementNS(ns, t); Object.entries(a).forEach(([k, v]) => e.setAttribute(k, v)); if (txt != null) e.textContent = txt; svg.append(e); return e; };
  const want = run && cur != null ? run.notes[cur] : null, strN = s => n - s;
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('class', 'ws-fret' + (narrow ? ' narrow' : '')); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', run ? 'Fretboard, ' + run.title + ', ' + (fa ? 'frets ' + fa + ' to ' + fb : 'open strings to fret ' + fb) + (want ? '. Next: ' + wsName(want.m) + ' on string ' + strN(want.s) + ', ' + (want.f ? 'fret ' + want.f : 'open') : '') + '.' : 'Fretboard');
  [3, 5, 7, 9, 15, 17].forEach(f => { if (f > fa && f <= fb) el('circle', { cx: x0 + (f - fa - .5) * fw, cy: by - 6, r: 3, class: 'ws-mk' }); });
  if (12 > fa && 12 <= fb) { el('circle', { cx: x0 + (12 - fa - .5) * fw - 5, cy: by - 6, r: 3, class: 'ws-mk' }); el('circle', { cx: x0 + (12 - fa - .5) * fw + 5, cy: by - 6, r: 3, class: 'ws-mk' }); }
  for (let f = fa; f <= fb; f++) el('line', { x1: x0 + (f - fa) * fw, y1: y(n - 1), x2: x0 + (f - fa) * fw, y2: y(0), class: f === 0 ? 'ws-nut' : 'ws-fw' });
  if (fa) el('text', { x: x0 + .5 * fw, y: H - 2, class: 'ws-fn' }, 'fret ' + (fa + 1));
  if (S.capo && S.capo > fa && S.capo <= fb) el('rect', { x: x0 + (S.capo - fa - .62) * fw, y: y(n - 1) - 6, width: 6, height: y(0) - y(n - 1) + 12, rx: 3, class: 'ws-capo' });
  for (let s = 0; s < n; s++) { el('line', { x1: x0, y1: y(s), x2: W - 10, y2: y(s), class: 'ws-str', 'stroke-width': 1 + (n - 1 - s) * .25 }); el('text', { x: 8, y: y(s) + 4, class: 'ws-sn' }, pcName(tu[s], false)); }
  if (!run) return svg;
  if (run.pcs) for (let s = 0; s < n; s++) for (let f = Math.max(fa, run.st - 1); f <= Math.min(fb, run.st + 4); f++) { const m = tu[s] + f; if (run.pcs.includes(m % 12) && !run.notes.some(q => q.s === s && q.f === f)) el('circle', { cx: xf(f), cy: y(s), r: 6, class: 'ws-ghost' }); }
  const seen = new Set(); run.notes.forEach((q, i) => {
    const k = q.s + ':' + q.f; if (seen.has(k) && i !== cur) return; seen.add(k); const isCur = i === cur, done = cur != null && run.notes.slice(0, cur).some(x => x.s === q.s && x.f === q.f) && !isCur;
    el('circle', { cx: xf(q.f), cy: y(q.s), r: isCur ? 11 : 9.5, class: 'ws-dot' + (q.deg === 'R' ? ' root' : '') + (isCur ? ' cur' : '') + (done ? ' done' : '') });
    el('text', { x: xf(q.f), y: y(q.s) + 3.6, class: 'ws-dl' + (isCur ? ' cur' : '') }, q.deg);
  });
  return svg;
}

/* ---------- listening: the next note, by the pitch the tuner hears ---------- */
function wsStop(quiet) {
  clearInterval(WS.tm); WS.tm = 0; WS.play.forEach(clearTimeout); WS.play = []; const r = WS.run; WS.run = null;
  if (r && !quiet) { const b = WS.r[r.kind]; if (b) b.paint(); }
}
function wsFollow(kind) {
  wsStop(true); const run = kind === 'scale' ? wsScaleRun() : wsArpRun(); if (!run.notes.length) { toast('This song has no chords yet. Write some, or choose One chord. (Humming in the shower does not count as writing.)', 'warn'); return; }
  WS.run = Object.assign(run, { mode: 'follow', i: 0, miss: 0, held: null, judged: false, prev: null, t0: performance.now(), wrong: 0 });
  if (!E.hasInput) toast('Connect your input (Audio, top right) so Shower mode can hear you. Or press Listen first. The actual shower is optional.', 'warn');
  WS.tm = setInterval(wsTick, 40); WS.r[kind].paint();
}
function wsTick() {
  const r = WS.run; if (!r || r.mode !== 'follow') return;
  const m = AN.active && AN.midi != null ? AN.midi : null, now = performance.now();
  if (m == null) { r.held = null; r.judged = false; return; }
  if (!r.held || r.held.m !== m) { r.held = { m, t: now }; r.judged = false; return; }
  if (r.judged || now - r.held.t < 110) return; r.judged = true;
  const want = r.notes[r.i], pc = ((m % 12) + 12) % 12;
  if (pc === want.m % 12) { r.prev = want.m; r.i++; if (r.i >= r.notes.length) return wsDone(r); }
  else if (r.prev != null && pc === r.prev % 12) { /* the last note, still ringing */ }
  else { r.miss++; r.wrong = now; }
  WS.r[r.kind].paint();
}
function wsDone(r) {
  clearInterval(WS.tm); WS.tm = 0; r.mode = 'done'; r.secs = (performance.now() - r.t0) / 1000;
  const clean = r.miss === 0, what = r.kind === 'scale' ? 'Up and back down' : (r.chords.length > 1 ? r.chords.length + ' chords' : 'The arpeggio');
  toast(what + ' in ' + r.secs.toFixed(1) + ' s' + (clean ? ', no wrong notes. ' + WS_CHEERS[Math.floor(Math.random() * WS_CHEERS.length)] : ', ' + r.miss + ' wrong note' + (r.miss === 1 ? '' : 's') + '. Blame the tiles. Again?'), clean ? 'ok' : '');      /* the secrets are found out in the studio (part 73b hears a scale wherever you play it) */
  WS.r[r.kind].paint();
}
/** ▶ Listen: the run played by the studio's lead voice, the fretboard following */
async function wsListen(kind) {
  wsStop(true); const run = kind === 'scale' ? wsScaleRun() : wsArpRun(); if (!run.notes.length) { toast('This song has no chords yet.', 'warn'); return; }
  if (!E.ready) { try { await startAudio(); } catch (e) { } } if (!E.ctx || !E.pl) return;
  WS.run = Object.assign(run, { mode: 'listen', i: 0, miss: 0 }); const dt = 60 / clamp(S.bpm || 90, 50, 160) / 2, t0 = E.ctx.currentTime + .12;
  run.notes.forEach((q, i) => { try { pluck('lead', t0 + i * dt, q.m, .72, { id: 'ws' + (i % 2) }); } catch (e) { } WS.play.push(setTimeout(() => { if (WS.run === run) { run.i = i; WS.r[kind].paint(); } }, 120 + i * dt * 1000)); });
  WS.play.push(setTimeout(() => { if (WS.run === run) { run.mode = 'heard'; run.i = run.notes.length; WS.r[kind].paint(); } }, 200 + run.notes.length * dt * 1000));
  WS.r[kind].paint();
}

/* ---------- your ear ---------- */
const wsEarChords = () => CFG.shed.ear === 'chords' && wsOpen('ear');
function wsEarNext() {
  const e = WS.ear; e.lock = false;
  if (wsEarChords()) { const q = WS_CQ[Math.floor(Math.random() * WS_CQ.length)]; e.q = { kind: 'chord', root: 48 + Math.floor(Math.random() * 12), ans: q[0], iv: q[1] }; }
  else { const set = WS_SETS[CFG.shed.ear] || WS_SETS.more, a = set[Math.floor(Math.random() * set.length)], iv = WS_IV.find(x => x[0] === a); e.q = { kind: 'iv', root: 52 + Math.floor(Math.random() * 16), ans: a, semi: iv[2] }; }
  wsEarPlay(); WS.r.ear.paint();
}
async function wsEarPlay() {
  const q = WS.ear.q; if (!q) return; if (!E.ready) { try { await startAudio(); } catch (e) { } } if (!E.ctx || !E.pl) return; const t = E.ctx.currentTime + .08;
  try { if (q.kind === 'chord') q.iv.forEach((i, k) => pluck('lead', t + k * .03, q.root + i, .62, { id: 'we' + k })); else { pluck('lead', t, q.root, .8, { id: 'we0' }); pluck('lead', t + .7, q.root + q.semi, .8, { id: 'we1' }); } } catch (e) { }
}
function wsEarAnswer(a) {
  const e = WS.ear, q = e.q; if (!q || e.lock) return; e.lock = true; e.n++;
  const right = a === q.ans; if (right) { e.ok++; e.streak++; e.best = Math.max(e.best, e.streak); } else e.streak = 0; e.last = { a, right, ans: q.ans };
  const choices = wsEarChords() ? WS_CQ.length : (WS_SETS[CFG.shed.ear] || WS_SETS.more).length;
  if (right && e.streak >= 10 && choices >= 6 && !wsEarChords() && !secretBusy()) secretFound('ear');
  WS.r.ear.paint(); clearTimeout(e.tm); e.tm = setTimeout(wsEarNext, right ? 900 : 1700);
}

/* ---------- the room ---------- */
const wsNarrow = () => innerWidth < 640;
const WS_WHERE = { scale: 'Hint: play any scale up and back down, anywhere the tuner can hear you.', arp: 'Hint: not in here. Try it with the band.', ear: 'Hint: this one is in here.' };
const wsLock = (id, what) => h('p', { class: 'tiny ws-lock' + (wsOpen(id) ? ' open' : '') }, wsOpen(id) ? '🗝 Open: ' + what + '.' : '🔒 ' + what + ' are behind the curtain until you find a secret. ' + WS_WHERE[id]);
const wsSel = (opts, val, on, attrs) => h('select', Object.assign({ class: 'in', onchange: e => on(e.target.value) }, attrs || {}), opts.map(([v, t, dis]) => h('option', { value: v, selected: String(v) === String(val), disabled: !!dis }, t)));
function wsRoom(kind) {
  const box = h('div', { class: 'ws-room', id: 'ws-room-' + kind }), ctl = h('div', { class: 'ws-ctl' }), board = h('div', { class: 'ws-board' }), stat = h('div', { class: 'ws-stat', 'aria-live': 'polite' }), chips = h('div', { class: 'ws-chips mono', role: 'list', 'aria-label': 'The notes, in order' });
  const btns = h('div', { class: 'ws-btns' }, h('button', { class: 'btn', id: 'ws-' + kind + '-listen', 'aria-label': 'Listen: the studio plays the run', onclick: () => wsListen(kind) }, '▶ Listen'), h('button', { class: 'btn primary', id: 'ws-' + kind + '-go', 'aria-label': 'Play it: the studio follows you note by note', onclick: () => wsFollow(kind) }, '● Play it'), h('button', { class: 'btn', id: 'ws-' + kind + '-stop', 'aria-label': 'Stop', onclick: () => wsStop() }, '■ Stop'));
  const fl = () => wsFlats(), keys = NS.map((_, i) => [i, pcName(i, fl())]);
  const build = () => {
    ctl.innerHTML = '';
    if (kind === 'scale') {
      const sc = Object.keys(SCALES).map(n => [n, (WS_BASE.includes(n) || wsOpen('scale') ? '' : '🔒 ') + n, !WS_BASE.includes(n) && !wsOpen('scale')]), run = wsScaleRun();
      ctl.append(h('label', { class: 'field' }, 'Key', wsSel(keys, wsKey(), v => { CFG.shed.key = +v; CFG.shed.at = null; saveCfg(); wsStop(true); build(); }, { id: 'ws-key' })),
        h('label', { class: 'field' }, 'Scale', wsSel(sc, CFG.shed.scale, v => { CFG.shed.scale = v; CFG.shed.at = null; saveCfg(); wsStop(true); build(); }, { id: 'ws-scale' })),
        h('label', { class: 'field' }, 'Start at', wsSel(run.starts.map(f => [f, f === 0 ? 'Open strings' : 'Fret ' + f]), run.st, v => { CFG.shed.at = +v; saveCfg(); wsStop(true); build(); }, { id: 'ws-at' })),
        h('label', { class: 'field' }, 'Octaves', wsSel([[1, 'One'], [2, 'Two']], CFG.shed.oct, v => { CFG.shed.oct = +v; saveCfg(); wsStop(true); build(); }, { id: 'ws-oct' })));
    } else {
      const types = WS_ARPS.map(([v, t, , bonus]) => [v, (bonus && !wsOpen('arp') ? '🔒 ' : '') + t, bonus && !wsOpen('arp')]);
      ctl.append(h('label', { class: 'field' }, 'Play', wsSel([['song', 'This song’s chords'], ['one', 'One chord']], CFG.shed.src, v => { CFG.shed.src = v; CFG.shed.arpAt = null; saveCfg(); wsStop(true); build(); }, { id: 'ws-src' })));
      if (CFG.shed.src === 'one') ctl.append(h('label', { class: 'field' }, 'Root', wsSel(keys, CFG.shed.root == null ? S.key : CFG.shed.root, v => { CFG.shed.root = +v; CFG.shed.arpAt = null; saveCfg(); wsStop(true); build(); }, { id: 'ws-root' })),
        h('label', { class: 'field' }, 'Chord', wsSel(types, CFG.shed.type, v => { CFG.shed.type = v; saveCfg(); wsStop(true); build(); }, { id: 'ws-type' })));
      const t0 = wsTune()[0], c = S.capo || 0; ctl.append(h('label', { class: 'field' }, 'Around fret', wsSel(Array.from({ length: 13 }, (_, i) => [c + i, c + i === 0 ? 'Open' : 'Fret ' + (c + i)]), wsArpRun().st, v => { CFG.shed.arpAt = +v; saveCfg(); wsStop(true); build(); }, { id: 'ws-arpat' })));
    }
    paint();
  };
  const paint = () => {
    const r = WS.run && WS.run.kind === kind ? WS.run : null, run = r || (kind === 'scale' ? wsScaleRun() : wsArpRun()), cur = r ? Math.min(r.i, run.notes.length - 1) : null;
    board.innerHTML = ''; board.append(wsFret(run, r && r.mode !== 'done' && r.mode !== 'heard' ? cur : null, wsNarrow()));
    chips.innerHTML = ''; run.notes.forEach((q, i) => chips.append(h('span', { role: 'listitem', class: 'ws-chip' + (r && i < r.i ? ' ok' : '') + (r && i === r.i && r.mode === 'follow' ? ' cur' : '') + (kind === 'arp' && i && q.ci !== run.notes[i - 1].ci ? ' gap' : '') }, wsName(q.m))));
    const want = r && r.mode === 'follow' ? run.notes[r.i] : null;
    stat.innerHTML = ''; stat.append(...[h('b', {}, run.title), ' · ' + run.notes.length + ' notes',
      want ? h('span', { class: 'ws-next' }, ' · next: ', h('b', {}, wsName(want.m)), ' (string ' + (wsTune().length - want.s) + ', ' + (want.f ? 'fret ' + want.f : 'open') + ') · ' + r.i + ' of ' + run.notes.length + (r.miss ? ' · ' + r.miss + ' wrong' : '')) : null,
      r && r.mode === 'listen' ? h('span', {}, ' · listening to it…') : null, r && r.mode === 'done' ? h('span', { class: r.miss ? '' : 'ws-good' }, ' · done in ' + r.secs.toFixed(1) + ' s' + (r.miss ? ', ' + r.miss + ' wrong' : ', clean')) : null].filter(x => x != null));
    if (r && r.wrong && performance.now() - r.wrong < 500) board.classList.add('ws-oops'); else board.classList.remove('ws-oops');
  };
  WS.r[kind] = { paint, build };
  box.append(ctl, btns, board, chips, stat, kind === 'scale' ? wsLock('scale', 'Modes and more scales (Dorian to Hirajoshi)') : wsLock('arp', 'Seventh arpeggios'));
  build(); return box;
}
function wsEarRoom() {
  const box = h('div', { class: 'ws-room', id: 'ws-room-ear' }), top = h('div', { class: 'ws-ctl' }), ans = h('div', { class: 'ws-ans', role: 'group', 'aria-label': 'Your answer' }), stat = h('div', { class: 'ws-stat', 'aria-live': 'polite' });
  const modes = [['easy', 'Intervals: 4 to choose from'], ['more', 'Intervals: 6'], ['all', 'Intervals: all 12'], ['chords', (wsOpen('ear') ? '' : '🔒 ') + 'Chord qualities', !wsOpen('ear')]];
  const paint = () => {
    const e = WS.ear, list = wsEarChords() ? WS_CQ.map(x => [x[0], x[0]]) : (WS_SETS[CFG.shed.ear] || WS_SETS.more).map(a => { const iv = WS_IV.find(x => x[0] === a); return [a, iv[1]]; });
    ans.innerHTML = ''; list.forEach(([a, t]) => ans.append(h('button', { 'aria-pressed': String(!!(e.last && e.lock && a === e.last.a)), class: 'btn ws-a' + (e.last && e.lock && a === e.last.ans ? ' right' : '') + (e.last && e.lock && !e.last.right && a === e.last.a ? ' wrong' : ''), 'data-a': a, disabled: !e.q, onclick: () => wsEarAnswer(a) }, t)));
    stat.innerHTML = ''; stat.append(e.q ? (e.lock ? h('b', { class: e.last.right ? 'ws-good' : '' }, e.last.right ? '✓ ' + ['Yes', 'Nailed it', 'Golden', 'Correct, and very hydrated'][e.n % 4] + ': ' : '✗ It was: ', h('span', {}, (wsEarChords() ? e.last.ans : WS_IV.find(x => x[0] === e.last.ans)[1]))) : h('span', {}, 'What did you hear?')) : h('span', {}, 'Press ▶ Play a question.'),
      h('span', { class: 'ws-streak' }, ' · streak ' + e.streak + ' · best ' + e.best + (e.n ? ' · ' + Math.round(e.ok / e.n * 100) + '% of ' + e.n : '')));
  };
  top.append(h('label', { class: 'field' }, 'Train', wsSel(modes, CFG.shed.ear, v => { CFG.shed.ear = v; saveCfg(); Object.assign(WS.ear, { q: null, streak: 0, lock: false }); paint(); }, { id: 'ws-ear-mode' })),
    h('button', { class: 'btn primary', id: 'ws-ear-go', 'aria-label': 'Play a question', onclick: () => wsEarNext() }, '▶ Play a question'), h('button', { class: 'btn', id: 'ws-ear-again', 'aria-label': 'Play the question again', onclick: () => wsEarPlay() }, '↻ Again'));
  WS.r.ear = { paint, build: paint }; box.append(top, ans, stat, wsLock('ear', 'Chord qualities by ear')); paint(); return box;
}
/** the room itself */
function showerOpen(at) {
  wsStop(true);
  const d = hubOpen('shower', { ico: '🚿', title: 'Shower mode', sub: 'Everyone sounds better in here. Scales, arpeggios and your ear. Not responsible for damage to electronic devices.', at, sections: [
    { key: 'scales', label: 'Scales', ico: '♯', sub: 'The warm-up. Choose a key, a scale and where on the neck. ● Play it follows you note by note, up and back down.', wide: true, body: () => [wsRoom('scale')] },
    { key: 'arps', label: 'Arpeggios', ico: '🎸', sub: 'Lather, rinse, repeat: this song’s chords one note at a time, or one chord up and down.', wide: true, body: () => [wsRoom('arp')] },
    { key: 'ear', label: 'Your ear', ico: '👂', sub: 'Two notes through the steam. Name the gap between them. Build a streak.', wide: true, body: () => [wsEarRoom()] },
    { key: 'how', label: 'The fine print', ico: '🧴', wide: true, body: () => [h('p', { class: 'small' }, 'Shower mode does not need a shower. Please keep phones, laptops, amps, pedals and guitars out of the water. Not responsible for damage to electronic devices, rubber ducks, or your neighbours’ patience.'), h('p', { class: 'small' }, 'It listens to the input the tuner uses (Audio, top right): play each note when it is the next one. A wrong note counts; the note you just played, still ringing, does not. Octaves do not matter, the note does. Nothing is recorded, not even that high note. ▶ Listen plays the run through the studio’s own lead voice, at half the song’s beat.'), h('p', { class: 'small muted' }, 'Some of this room is behind the curtain until you find what the studio hides, and most of it is hidden out there, not in here. With Settings ▸ Workflow ▸ Hidden surprises off, it is all open.')] }
  ] });
  d.classList.add('ws-hub'); d.addEventListener('close', () => { wsStop(true); clearTimeout(WS.ear.tm); }, { once: true });
  return d;
}
/* a secret found here opens its treasure in place: the room is drawn again where you are, a moment later */
bus.on('secret', id => { if (!['scale', 'arp', 'ear'].includes(id)) return; setTimeout(() => { const d = document.getElementById('shower'); if (!d || !d.open || WS.run && WS.run.mode === 'follow') return; const on = d.querySelector('.hub-nb.on'); const e = Object.assign({}, WS.ear); showerOpen(on ? on.dataset.sec : undefined); Object.assign(WS.ear, { streak: e.streak, best: e.best, n: e.n, ok: e.ok }); if (WS.r.ear) WS.r.ear.paint(); }, 1400); });
bus.on('song', () => { const d = document.getElementById('shower'); if (d && d.open && !WS.run) Object.values(WS.r).forEach(r => r.build()); });
/* turning a phone round redraws the fretboard at the size that fits */
{ let wasN = null; addEventListener('resize', () => { const n = wsNarrow(); if (n === wasN) return; wasN = n; const d = document.getElementById('shower'); if (d && d.open) ['scale', 'arp'].forEach(k => WS.r[k] && WS.r[k].paint()); }); }
