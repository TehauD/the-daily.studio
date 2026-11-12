/* ============================================================
   Part 80 · THE COACH (2.32) — the teacher's ears and hands
   Every lesson step, warm-up, riff, Riff Lab idea and atlas shape is a "piece": notes on the neck, chords to play, a rhythm to keep,
   a bend or a vibrato to make. The coach window shows it (the fretboard, a line of tab, what to do), plays it (▶ Listen, through the
   studio's own lead voice, with a click and, where it helps, a small band: drums, bass and chords of its own, so your song is never
   touched), and listens while you play it (● Play it), through the input the tuner uses:
     · notes     each note in turn, as the Scales & ear trainer does (a wrong note counts; the last one still ringing does not)
     · timed     the same over the click, and how early or late your picking was against the beat (onsets from the input tap)
     · chord     a chord held, as the chord finder hears it
     · changes   a chord each bar over the click
     · minute    one-minute changes: how many times you can switch between two chords in a minute
     · rhythm    a strumming or picking pattern: each stroke against where it should land
     · bend      a note bent up to its target pitch, and held there
     · vib       a note held with vibrato (rate and width, from the analysis)
     · landing   over a backing vamp, land on a chord tone each time the chord changes
     · info      something to read and hear
     · hold      (2.68, sung) one note held in tune for a few seconds
   2.68: a piece marked `voice` is sung, not played. The coach hears it through the voice's own pitch reading (part 50: the vocal
   channel if there is one, else the main input), shows a keyboard and the note names where a guitar piece shows the neck and tab,
   plays it on a piano, and places it at the bottom of your comfortable range (Voice ▸ Find my range), or around C3 until that is
   known; any octave counts. A voice slides between notes, so a wrong note counts only when it is held.
   A clean run can raise the tempo by 5 (the tempo ladder).
   ============================================================ */
CFG.learn = Object.assign({ done: {}, best: {}, ladder: true, back: true, click: true, mine: [] }, CFG.learn && typeof CFG.learn === 'object' ? CFG.learn : {});
const CO = { el: null, p: null, list: null, idx: 0, run: null, seq: null, tm: 0, bpm: 80, key: null, onAct: null, res: '' };
const CO_KINDS = ['notes', 'timed', 'chord', 'changes', 'minute', 'rhythm', 'bend', 'vib', 'landing', 'info'];

/* ---------- pieces: notes from intervals onto the neck ---------- */
/** notes of a piece in this tuning: `root` the MIDI note intervals count from, `near` the fret the hand sits around */
function coPlace(notes, root, near) {
  let st = near == null ? 5 : near; return notes.map(n => {
    if (n.r) return Object.assign({}, n);
    const ms = (n.ch || [n.i]).map(i => root + i), out = ms.map(m => { const p = wsPlace(m, st); return { m, s: p.s, f: p.f }; });
    if (out.length === 1) st = Math.max(0, Math.min(17, out[0].f - 1.5 + (st - (out[0].f - 1.5)) * .6));
    return Object.assign({}, n, { m: out[0].m, s: out[0].s, f: out[0].f, ch: n.ch ? out : null, to: n.t === 'b' ? out[0].m + (n.b || 2) : null });
  });
}
/** the lowest root at or above the low string's open note (+ capo), for a key's pitch class */
const coRoot = (pc, lift) => { const lo = wsTune()[0] + (S.capo || 0); return lo + (((pc - lo) % 12) + 12) % 12 + (lift || 0); };
/** where a sung piece sits: the key's root at the bottom of the comfortable range, or from C3 until the range is known */
const coVoiceRoot = pc => { const rg = CFG.vrange, lo = rg && isFinite(rg.c0) ? Math.round(rg.c0) : 48; return lo + (((pc - lo) % 12) + 12) % 12; };
/** the pitch the coach hears: the voice's for a sung piece (a whole number of semitones), the tuner's otherwise */
const coHeard = p => (p && p.voice ? (VOX.m != null ? Math.round(VOX.m) : null) : (AN.active && AN.midi != null ? AN.midi : null));
const coName = m => pcName(m, keyUsesFlats((CO.key == null ? S.key : CO.key), false));
/** a line of ASCII tab for the notes (strings high to low), the note `cur` marked */
function coTab(notes, cur) {
  const tu = wsTune(), n = tu.length, cols = notes.map((q, i) => { const w = q.r ? 1 : Math.max(...(q.ch || [q]).map(x => String(x.f).length)) + (q.t && q.t !== 'x' ? 1 : 0); return { q, i, w }; });
  return Array.from({ length: n }, (_, k) => { const s = n - 1 - k; return pcName(tu[s] + (S.capo || 0), false).padEnd(2) + '|' + cols.map(({ q, i, w }) => {
    const hit = !q.r && (q.ch || [q]).find(x => x.s === s); let txt = hit ? String(hit.f) + (q.t === 'b' ? 'b' : q.t === 'h' ? 'h' : q.t === 'p' ? 'p' : q.t === '/' ? '/' : q.t === '~' ? '~' : '') : '';
    if (hit && q.t === 'x') txt = 'x'; txt = txt.padEnd(w, '-'); return (i === cur && hit ? '[' + txt + ']' : '-' + txt + '-'); }).join('') + '|'; }).join('\n');
}

/* ---------- the coach's own little band ---------- */
const coSd = () => 60 / CO.bpm / 4;      /* a 16th, in seconds */
/** play a loop of `len` 16ths: the click, drums, chords (one per bar) and bass from `back`, and the piece's notes if `demo` */
async function coSeq(o) {
  coSeqStop(); await startAudio(); if (T.playing) stopPlay(true);
  const c = E.ctx, sd = coSd(), bar = 16, len = o.len || 16, ci = o.countIn === false ? 0 : bar, t0 = c.currentTime + .12 + ci * sd;
  const q = { t0, len, k: -ci, sd, o, loops: 0, tm: 0 };
  const step = (k, t) => {
    const pos = ((k % len) + len) % len, beat = pos % 4 === 0;
    if (o.click !== false && beat) click(t, pos % bar === 0);
    if (k < 0) return;
    const b = o.back; if (b && b.drums) { if (pos % 8 === 0) drumHit(0, t, pos % 16 === 0 ? 3 : 2); if (pos % 8 === 4) drumHit(1, t, 2); if (pos % 2 === 0) drumHit(2, t, 1); }
    if (b && b.chords && b.chords.length) { const sym = b.chords[Math.floor(pos / bar) % b.chords.length]; if (pos % 8 === 0) { try { strumAt(t, sym, 'D', STRUMS['Down 4s']); } catch (e) { } } if (b.bass !== false && pos % 8 === 0) { const ch = parseChord(sym); if (ch) pluck('bass', t, bassMidi(ch.bass), .8, { id: 'cb' }); } }
    if (o.demo && o.notes && CO.p && CO.p.voice) o.notes.forEach(n => { if (n.r || n.at !== pos) return; try { keysVoice(t, n.m, .8, Math.max(.25, (n.len || 2) * sd * .95), 'piano'); } catch (e) { pluck('lead', t, n.m, .8, { id: 'cov' }); } });
    else if (o.demo && o.notes) o.notes.forEach(n => { if (n.r || n.at !== pos) return; (n.ch || [n]).forEach((x, j) => pluck('lead', t + j * .012, x.m, .8, { id: 'co' + x.s })); if (n.to != null) pluck('lead', t + Math.min(n.len || 2, 4) * sd * .45, n.to, .55, { id: 'co' + n.s, soft: true }); });
    if (pos === len - 1) q.loops++;
  };
  q.tm = setInterval(() => { const now = c.currentTime; while (q.t0 + q.k * sd < now + .15) { step(q.k, q.t0 + q.k * sd); q.k++; if (!o.loop && q.k >= len) { break; } } if (!o.loop && q.k >= len && now > q.t0 + len * sd + .3) { coSeqStop(); o.onEnd && o.onEnd(); } }, 40);
  CO.seq = q; return q;
}
function coSeqStop() { if (CO.seq) { clearInterval(CO.seq.tm); CO.seq = null; } }
/** where in the loop the audio clock is (in 16ths, fractional), as heard */
const coPos = () => { const q = CO.seq; if (!q) return -1; const heard = E.ctx.currentTime - (E.ctx.outputLatency || E.ctx.baseLatency || 0); return (heard - q.t0) / q.sd; };

/* ---------- listening ---------- */
const coChordIs = (want) => { const c = AN.active && AN.chord && AN.chord[0]; if (!c) return false; const a = parseChord(c.sym), b = parseChord(want); if (!a || !b) return false; const third = x => x.iv.includes(3) && !x.iv.includes(4) ? 'm' : 'M'; return a.root === b.root && third(a) === third(b); };
const coPitch = () => AN.active && AN.midi != null ? AN.midi + (AN.cents || 0) / 100 : null;
/** start listening for the current piece; result to CO.res and a call to `done(ok, msg)` */
function coListen(done) {
  coStopListen(); const p = CO.p, R = CO.run = { kind: p.kind, i: 0, miss: 0, held: null, judged: false, prev: null, t0: performance.now(), on: [], ok: 0, n: 0, best: 0, done, hold: 0, last: null, sw: 0, log: [], timing: null, max: 0 }; CO.fb = null; coTakeStart();
  if (!E.hasInput) toast(p.voice ? 'Connect your microphone (Audio, top right) so the coach can hear you sing.' : 'Connect your guitar (Audio, top right) so the coach can hear you.', 'warn');
  const tapOn = m => { if (m && m.onset && CO.run === R) R.on.push(m.t); }; bus.on('tap:di', tapOn); R.off = () => bus.off('tap:di', tapOn);
  const need = { timed: 1, changes: 1, minute: 0, rhythm: 1, landing: 1 }[p.kind] || (p.back && p.back.chords && p.kind === 'notes');      /* a scale over a vamp plays the vamp while you play */
  if (!need) coSeqStop();      /* the demo stops: the coach must hear you, not itself */
  if (need) coSeq({ len: p.len || 16, loop: true, notes: p.notes, demo: false, back: CFG.learn.back ? p.back : (p.kind === 'landing' || p.kind === 'changes' ? { chords: p.back && p.back.chords, bass: false } : null), click: CFG.learn.click || p.kind !== 'landing' });
  CO.tm = setInterval(() => coTick(R), 30); coPaint();
}
function coStopListen() { const R = CO.run; if (R) { clearInterval(CO.tm); if (R.off) R.off(); CO.run = null; coTakeStop(); } }
function coFinish(R, ok, msg) { if (CO.run !== R) return; const at = CO.seq ? { t0: CO.seq.t0, sd: CO.seq.sd } : null; coStopListen(); coSeqStop(); CO.res = msg; const p = CO.p, bpm0 = CO.bpm; if (ok) { CFG.learn.done[p.id] = Date.now(); learnPassed(p); saveCfg(); } if (ok && CFG.learn.ladder && p.ladder !== false && ['notes', 'timed', 'rhythm', 'changes'].includes(p.kind)) { const cap = p.target || (p.bpm || 80) + 60; CO.bpm = Math.max(CO.bpm, Math.min(cap, CO.bpm + 5)); if (CO.bpm > bpm0) msg += ' Tempo up: ' + CO.bpm + ' BPM.'; else if (p.target && CO.bpm >= p.target) msg += ' That is the song’s own tempo.'; CO.res = msg; } CO.fb = p.voice ? null : coFeedback(R, ok, bpm0, at); bus.emit('coach:done', { id: p.id, ok }); if (ok) { const dot = document.querySelectorAll('#coach .co-dot')[CO.idx]; if (dot) dot.classList.add('done'); } if (R.done) R.done(ok, msg); coPaint(); }
function coTick(R) {
  const p = CO.p, now = performance.now(), m = coHeard(p);
  switch (p.kind) {
    case 'hold': {      /* one note, held in tune (any octave) */
      const want = p.notes.find(n => !n.r), v = VOX.m, secs = p.secs || 3; if (v != null && want) { const d = ((v - want.m) % 12 + 18) % 12 - 6; R.cents = Math.round(d * 100); if (Math.abs(d) <= .4) { R.hold += 30; R.max = Math.max(R.max, R.hold); } else R.hold = Math.max(0, R.hold - 90); } else { R.cents = null; R.hold = Math.max(0, R.hold - 45); }
      if (R.hold >= secs * 1000) return coFinish(R, true, '✓ Held ' + coName(want.m) + ' for ' + secs + ' seconds, in tune.');
      if (now - R.t0 > 30000) return coFinish(R, false, 'Longest in tune: ' + (R.max / 1000).toFixed(1) + ' of ' + secs + ' seconds. Listen again, start a little quieter, and keep the breath steady.');
      break;
    }
    case 'notes': case 'timed': {
      const ns = p.notes.filter(n => !n.r); if (m == null) { R.held = null; R.judged = false; } else if (!R.held || R.held.m !== m) { R.held = { m, t: now }; R.judged = false; }
      else if (!R.judged && now - R.held.t >= (p.voice ? 160 : 110)) { const want = ns[R.i], pcs = (want.ch || [want]).map(x => ((x.m % 12) + 12) % 12), pc = ((m % 12) + 12) % 12;
        if (pcs.includes(pc)) { R.judged = true; R.prev = m; R.i++; if (R.i >= ns.length) return coNotesDone(R); } else if (R.prev != null && pc === ((R.prev % 12) + 12) % 12) { R.judged = true; }
        else if (!p.voice || now - R.held.t >= 480) { R.judged = true; R.miss++; R.log.push({ i: R.i, got: m }); }      /* a voice slides between notes: a wrong one counts only when it is held */
        coPaint(); }
      if (p.kind === 'timed' && CO.seq && coPos() > (p.len || 16) * 2 + 2 && R.i < ns.length) { coNotesDone(R); }
      break;
    }
    case 'chord': { if (coChordIs(p.chords[0])) { R.hold += 30; if (R.hold >= 800) coFinish(R, true, '✓ That is ' + p.chords[0] + '. Clean.'); } else R.hold = Math.max(0, R.hold - 15); break; }
    case 'changes': case 'landing': {
      const pos = coPos(); if (pos < 0) break; const bar = Math.floor(pos / 16), inBar = pos - bar * 16, want = p.back.chords[((bar % p.back.chords.length) + p.back.chords.length) % p.back.chords.length];
      if (p.kind === 'changes') { if (inBar > 8 && R.last !== bar && coChordIs(p.chords ? p.chords[bar % p.chords.length] : want)) { R.last = bar; R.ok++; } if (bar >= (p.bars || 8)) coFinish(R, R.ok >= Math.ceil((p.bars || 8) * .75), (R.ok >= Math.ceil((p.bars || 8) * .75) ? '✓ ' : '') + R.ok + ' of ' + (p.bars || 8) + ' bars on the right chord.'); }
      else { if (bar >= 0 && bar < (p.bars || 8) && R.last !== bar && inBar < 6 && m != null && m !== R.prevM) { const ch = parseChord(want); R.last = bar; R.n++; if (ch && ch.pcs.includes(((m % 12) + 12) % 12)) R.ok++; } R.prevM = m; if (bar >= (p.bars || 8)) coFinish(R, R.ok >= Math.ceil((p.bars || 8) * .6), 'Landed on a chord tone ' + R.ok + ' of ' + (p.bars || 8) + ' changes.'); }
      break;
    }
    case 'minute': {
      const a = coChordIs(p.chords[0]) ? 0 : coChordIs(p.chords[1]) ? 1 : -1; if (a >= 0) { if (R.cur !== a) { R.cand = a; R.ct = (R.ct || 0) + 30; if (R.ct >= 250) { if (R.cur != null) R.sw++; R.cur = a; R.ct = 0; } } else R.ct = 0; }
      if (now - R.t0 >= (p.secs || 60) * 1000) { const best = CFG.learn.best[p.id] || 0; if (R.sw > best) { CFG.learn.best[p.id] = R.sw; saveCfg(); } coFinish(R, R.sw >= (p.goal || 20), R.sw + ' changes in a minute' + (R.sw > best ? ' (a new best)' : ' (best ' + best + ')') + '.'); }
      break;
    }
    case 'rhythm': {
      const pos = coPos(), len = p.len || 16, bars = p.bars || 4; if (pos < len * bars + 1) break;
      const q = CO.seq, lat = (rttMs() || 20) / 1000, exp = []; for (let b = 0; b < bars; b++) [...p.pattern].forEach((c, i) => { if (c !== '.') exp.push(q.t0 + (b * len + i) * q.sd); });
      const on = R.on.map(t => t - lat), errs = []; let hit = 0; R.timing = { items: [], len: len * bars };
      /* each stroke counts for one beat at most: the closest pairs first, so a late stroke is never also an early one for the next beat */
      const pairs = []; exp.forEach((e, ei) => on.forEach((t, oi) => { const d = t - e; if (Math.abs(d) <= .1) pairs.push([Math.abs(d), ei, oi, d]); })); pairs.sort((x, y) => x[0] - y[0]); const ue = new Map(), uo = new Set(); pairs.forEach(([, ei, oi, d]) => { if (ue.has(ei) || uo.has(oi)) return; ue.set(ei, d); uo.add(oi); });
      exp.forEach((e, ei) => { const best = ue.has(ei) ? ue.get(ei) : null; R.timing.items.push({ at: Math.round((e - q.t0) / q.sd), d: best == null ? null : best * 1000 }); if (best != null) { hit++; errs.push(best * 1000); } });
      const avg = errs.length ? errs.reduce((x, y) => x + Math.abs(y), 0) / errs.length : 999, lean = errs.length ? errs.reduce((x, y) => x + y, 0) / errs.length : 0, extra = Math.max(0, on.filter(t => t > q.t0 - .05 && t < q.t0 + len * bars * q.sd).length - hit);
      const ok = hit >= exp.length * .8 && avg <= 35; coFinish(R, ok, (ok ? '✓ ' : '') + hit + ' of ' + exp.length + ' strokes on the beat, ' + Math.round(avg) + ' ms off on average' + (Math.abs(lean) > 8 ? ', a little ' + (lean < 0 ? 'early (rushing)' : 'late (dragging)') : '') + (extra ? ', ' + extra + ' extra' : '') + '.');
      break;
    }
    case 'bend': {
      const f = coPitch(), b = p.notes.find(n => !n.r); if (f == null) { R.hold = 0; break; } R.cur = f - b.m; R.max = Math.max(R.max, R.cur); if (Math.abs(f - b.to) <= .3) { R.hold += 30; if (R.hold >= 300) coFinish(R, true, '✓ Bent up ' + (b.to - b.m) + ' semitone' + (b.to - b.m === 1 ? '' : 's') + ', in tune.'); } else R.hold = 0;
      if (f > b.to + .5) R.over = (R.over || 0) + 1; break;
    }
    case 'vib': {
      const v = AN.vib, n = p.notes.find(q => !q.r), on = m != null && ((m % 12) + 12) % 12 === n.m % 12; R.v = v; if (on && v && v.ext >= 12) { R.hold += 30; if (R.hold >= 800) coFinish(R, true, '✓ Vibrato: ' + v.rate.toFixed(1) + ' times a second, ' + Math.round(v.ext * 2) + ' cents wide.'); } else R.hold = Math.max(0, R.hold - 10); break;
    }
  }
}
function coNotesDone(R) {
  const p = CO.p, ns = p.notes.filter(n => !n.r), secs = (performance.now() - R.t0) / 1000; let msg = '', ok = R.i >= ns.length && R.miss <= Math.max(1, Math.floor(ns.length / (p.voice ? 3 : 8)));
  if (p.kind === 'timed' && CO.seq) { const q = CO.seq, lat = (rttMs() || 20) / 1000, len = p.len || 16, errs = [];
    ns.forEach(n => { const e = q.t0 + n.at * q.sd; let best = null; R.on.forEach(t => { const d = (t - lat) - e; if (Math.abs(d) <= .12 && (best == null || Math.abs(d) < Math.abs(best))) best = d; }); if (best == null) R.on.forEach(t => { const d = (t - lat) - (e + len * q.sd); if (Math.abs(d) <= .12 && (best == null || Math.abs(d) < Math.abs(best))) best = d; }); R.timing = R.timing || { items: [], len }; R.timing.items.push({ at: n.at, d: best == null ? null : best * 1000 }); if (best != null) errs.push(best * 1000); });
    const avg = errs.length ? errs.reduce((x, y) => x + Math.abs(y), 0) / errs.length : null; if (avg != null && avg > 40) ok = false; msg = (avg != null ? ', ' + Math.round(avg) + ' ms from the beat on average' : ''); }
  coFinish(R, ok, (ok ? '✓ ' : '') + (R.i >= ns.length ? 'All ' + ns.length + ' notes' : R.i + ' of ' + ns.length + ' notes') + (R.miss ? ', ' + R.miss + ' wrong' : ', clean') + msg + ' (' + secs.toFixed(1) + ' s).');
}

/* ---------- the window ---------- */
/** open the coach on a piece, or on a list of pieces (a lesson's steps) at `at` */
function coachOpen(pieces, at, o) {
  pieces = Array.isArray(pieces) ? pieces : [pieces]; coStopListen(); coSeqStop(); o = o || {};
  CO.list = pieces; CO.idx = Math.max(0, Math.min(pieces.length - 1, at || 0)); CO.title = o.title || ''; CO.onAct = o.actions || null; CO.key = o.key != null ? o.key : null;
  const host = typeof learnHost === 'function' ? learnHost() : null; let d = document.getElementById('coach');
  if (d && !!host !== !!d._inline) { try { if (d.open) d.close(); } catch (e) { } d.remove(); d = null; }      /* 2.66: in the Learn panel on a computer, a window on a phone */
  if (!d) { d = host ? hubInline(h('div', { class: 'coach co-inline', id: 'coach', role: 'region', 'aria-labelledby': 'coachT' })) : h('dialog', { class: 'coach', id: 'coach', 'aria-labelledby': 'coachT' }); (host || document.body).append(d); d.addEventListener('close', () => { if (d.open) return; coStopListen(); coSeqStop(); bus.emit('coach:close'); });      /* the close event comes late: if the coach was opened again since, leave it be */ }
  if (host) { if (d.parentNode !== host) host.append(d); learnShow(); }
  coSetPiece(CO.idx); if (d._inline) { d.showModal(); d.scrollTop = 0; return d; } if (d.open) d.close(); d.showModal(); return d;      /* reopened, so it is always in front (of the Learn hub too) */
}
function coSetPiece(i) { coStopListen(); coSeqStop(); CO.idx = i; const raw = CO.list[i]; CO.p = typeof raw === 'function' ? raw() : raw; CO.bpm = CO.p.bpm || 80; CO.res = ''; CO.fb = null; CO.reveal = false; coTakeDrop(); if (CO.p.kind === 'info' && CO.p.id && !CFG.learn.done[CO.p.id]) { CFG.learn.done[CO.p.id] = Date.now(); saveCfg(); bus.emit('coach:done', { id: CO.p.id, ok: true }); } coBuild(); }
/** the piece's notes placed in this tuning (re-placed when the key or the tuning changes) */
function coNotes() { const p = CO.p; if (!p.src) return p.notes || []; const pc = CO.key != null ? CO.key : (p.keyPc != null ? p.keyPc : 9);
  if (p.voice) { const root = coVoiceRoot(pc); p.notes = p.src.map(n => n.r ? Object.assign({}, n) : Object.assign({}, n, { m: root + n.i, s: 0, f: 0, ch: null, to: null })); return p.notes; }      /* sung: no strings or frets */
  p.notes = coPlace(p.src, coRoot(pc, p.lift || 0), p.near); return p.notes; }
function coBuild() {
  const d = document.getElementById('coach'); if (!d) return; const p = CO.p; coNotes(); d.innerHTML = '';
  const steps = CO.list.length > 12 ? h('span', { class: 'co-count mono', id: 'coCount' }, (CO.idx + 1) + ' / ' + CO.list.length) : CO.list.length > 1 ? h('div', { class: 'co-steps', role: 'list' }, CO.list.map((q, k) => { const qq = typeof q === 'function' ? null : q; return h('button', { role: 'listitem', class: 'co-dot' + (k === CO.idx ? ' on' : '') + (qq && CFG.learn.done[qq.id] ? ' done' : ''), 'aria-label': 'Step ' + (k + 1) + (qq && CFG.learn.done[qq.id] ? ', done' : ''), onclick: () => coSetPiece(k) }); })) : null;
  const playable = p.kind !== 'info' || (p.notes && p.notes.length);
  d.append(...[h('div', { class: 'co-top' }, h('div', { class: 'co-tt' }, h('small', {}, CO.title || ''), h('b', { id: 'coachT' }, p.title)), steps, d._inline ? h('button', { class: 'btn sm co-back', 'aria-label': 'Close the coach', title: 'Back to the list', onclick: () => d.close() }, '◀ Back') : h('button', { class: 'btn icon', 'aria-label': 'Close the coach', onclick: () => d.close() }, '✕')),
    h('p', { class: 'co-text' }, p.text || ''),
    p.notes && p.notes.length && !['chord', 'changes', 'minute'].includes(p.kind) && !(p.ear && !CO.reveal) ? h('div', { class: 'co-board' + (p.voice ? ' co-keys' : '') }) : null,
    p.notes && p.notes.length && !['chord', 'changes', 'minute'].includes(p.kind) && !(p.ear && !CO.reveal) ? h('pre', { class: 'co-tab mono', 'aria-label': 'Tab' }) : null,
    p.ear && !CO.reveal ? h('div', { class: 'co-hidden', id: 'coHidden' }, h('span', { class: 'co-hid-ic', 'aria-hidden': 'true' }, '👂'), h('div', {}, h('b', {}, 'No tab this time: use your ears.'), h('span', {}, 'Hear it, then play it back. ' + (p.notes || []).filter(n => !n.r).length + ' notes, starting on ' + (p.hint || 'the root') + '.'))) : null,
    ['chord', 'changes', 'minute'].includes(p.kind) ? h('div', { class: 'co-chords' }, (p.chords || p.back.chords).map(c => h('div', { class: 'co-chord' }, h('b', {}, c), h('pre', { class: 'mono co-shape' }, coShape(c))))) : null,
    h('div', { class: 'co-live', role: 'status', 'aria-live': 'polite' }),
    h('div', { class: 'co-fb', id: 'coFb' }),
    h('div', { class: 'co-ctl' },
      p.ear ? h('button', { class: 'btn primary', id: 'coEarGo', onclick: () => coDemo(true) }, '🎧 Hear it, then play it back') : null,
      p.ear && !CO.reveal ? h('button', { class: 'btn', id: 'coReveal', onclick: () => { CO.reveal = true; coBuild(); } }, '👁 Show me') : null,
      playable ? h('button', { class: 'btn', id: 'coListen', onclick: () => coDemo() }, p.ear ? '▶ Hear it again' : '▶ Listen') : null,
      p.kind !== 'info' ? h('button', { class: 'btn' + (p.ear ? '' : ' primary'), id: 'coGo', onclick: () => CO.run ? (coStopListen(), coSeqStop(), coPaint()) : coListen() }, p.voice ? '● Sing it' : '● Play it') : null,
      h('span', { class: 'co-bpm' }, h('button', { class: 'btn sm', 'aria-label': 'Slower', onclick: () => { CO.bpm = Math.max(40, CO.bpm - 5); coPaint(); } }, '−'), h('b', { class: 'mono' }), h('button', { class: 'btn sm', 'aria-label': 'Faster', onclick: () => { CO.bpm = Math.min(240, CO.bpm + 5); coPaint(); } }, '+')),
      p.ladder === false ? null : h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'coLadder', checked: !!CFG.learn.ladder, onchange: e => { CFG.learn.ladder = e.target.checked; saveCfg(); } }), 'Tempo ladder'),
      p.back ? h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!CFG.learn.back, onchange: e => { CFG.learn.back = e.target.checked; saveCfg(); } }), 'Backing') : null,
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!CFG.learn.click, onchange: e => { CFG.learn.click = e.target.checked; saveCfg(); } }), 'Click'),
      p.src && p.keyed !== false ? h('label', { class: 'field co-key' }, 'Key', h('select', { class: 'in', id: 'coKey', onchange: e => { CO.key = +e.target.value; coBuild(); } }, NS.map((_, k) => h('option', { value: k, selected: k === (CO.key != null ? CO.key : (p.keyPc != null ? p.keyPc : 9)) }, pcName(k, false))))) : null),
    CO.onAct ? h('div', { class: 'co-act' }, CO.onAct(p).filter(Boolean)) : null,
    p.tip ? h('p', { class: 'tiny muted co-tip' }, '💡 ' + p.tip) : null,
    CO.list.length > 1 ? h('div', { class: 'co-nav' }, h('button', { class: 'btn', disabled: CO.idx === 0, onclick: () => coSetPiece(CO.idx - 1) }, '◀ Back'), h('span', { style: { flex: 1 } }), h('button', { class: 'btn primary', id: 'coNext', disabled: CO.idx >= CO.list.length - 1, onclick: () => coSetPiece(CO.idx + 1) }, 'Next ▶')) : null].filter(Boolean));
  coPaint();
}
function coShape(sym) { try { const v = voicingFor(sym); if (!v) return ''; return v.frets.map(f => f == null ? 'x' : String(f)).join(' '); } catch (e) { return ''; } }
function coDemo(then) { coStopListen(); const p = CO.p; coSeq({ len: p.len || 16, loop: false, notes: coNotes(), demo: true, back: CFG.learn.back ? p.back : null, click: CFG.learn.click, onEnd: () => { coPaint(); if (then) coListen(); } }); coPaint(); }
function coPaint() {
  const d = document.getElementById('coach'); if (!d || !CO.p) return; const p = CO.p, R = CO.run, q = s => d.querySelector(s), ns = (p.notes || []).filter(n => !n.r);
  const b = q('.co-bpm b'); if (b) b.textContent = CO.bpm + ' BPM';
  const go = q('#coGo'); if (go) go.textContent = R ? '■ Stop' : p.voice ? '● Sing it' : '● Play it';
  const cur = R && (R.kind === 'notes' || R.kind === 'timed') ? R.i : null;
  const bd = q('.co-board'); if (bd && p.voice) coKeys(bd, p, ns, cur == null && R && R.kind === 'hold' ? 0 : cur);
  else if (bd) { bd.innerHTML = ''; const pcs = p.pcs || null, ref = coRoot(CO.key != null ? CO.key : (p.keyPc != null ? p.keyPc : 9)); const run = { title: p.title, st: ns.length ? Math.min(...ns.map(n => n.f)) : 0, pcs, notes: ns.map(n => ({ s: n.s, f: n.f, m: n.m, deg: n.lab || degName(((n.m - ref) % 12 + 12) % 12) })) }; bd.append(wsFret(run, cur, innerWidth < 640)); }
  const tb = q('.co-tab'); if (tb) tb.textContent = p.voice ? ns.map((n, i) => (i === cur ? '[' + coName(n.m) + ']' : ' ' + coName(n.m) + ' ')).join(' ') : coTab(p.notes || [], cur == null ? -1 : (p.notes || []).indexOf(ns[cur]));
  const fbx = q('#coFb'); if (fbx) { fbx.innerHTML = ''; if (!R && CO.fb) fbx.append(coFbView(CO.fb)); }
  const lv = q('.co-live'); if (!lv) return; lv.innerHTML = '';
  if (R) {
    const want = ns[R.i]; lv.append(h('b', {}, R.kind === 'hold' ? 'Hold ' + (ns[0] ? coName(ns[0].m) : '') + ': ' + (R.hold / 1000).toFixed(1) + ' of ' + (p.secs || 3) + ' s' + (R.cents == null ? ' · sing…' : Math.abs(R.cents) <= 40 ? ' · in tune' : R.cents > 0 ? ' · a little high' : ' · a little low')
      : p.voice && (R.kind === 'notes' || R.kind === 'timed') ? (want ? 'Sing ' + coName(want.m) : '') + ' · ' + R.i + ' of ' + ns.length + (R.miss ? ' · ' + R.miss + ' off' : '')
      : R.kind === 'notes' || R.kind === 'timed' ? (want ? 'Next: ' + (want.ch ? want.ch.map(x => coName(x.m)).join(' + ') : coName(want.m)) + ' (string ' + (wsTune().length - want.s) + ', ' + (want.f ? 'fret ' + want.f : 'open') + ')' : '') + ' · ' + R.i + ' of ' + ns.length + (R.miss ? ' · ' + R.miss + ' wrong' : '')
      : R.kind === 'chord' ? 'Play ' + p.chords[0] + ' and let it ring…' : R.kind === 'changes' ? 'A chord a bar, with the click: ' + R.ok + ' right so far'
      : R.kind === 'minute' ? Math.max(0, 60 - Math.floor((performance.now() - R.t0) / 1000)) + ' s · ' + R.sw + ' changes' : R.kind === 'rhythm' ? 'Play the pattern with the click (four bars)…'
      : R.kind === 'bend' ? 'Bend: ' + (R.cur != null ? (R.cur >= 0 ? '+' : '') + R.cur.toFixed(2) : '–') + ' of +' + (ns[0] ? ns[0].to - ns[0].m : 2) + ' semitones' : R.kind === 'vib' ? (R.v ? 'Vibrato ' + R.v.rate.toFixed(1) + '/s, ' + Math.round(R.v.ext * 2) + ' cents' : 'Hold it and shake it…') : R.kind === 'landing' ? 'Land on a chord tone at each change: ' + R.ok + ' so far' : ''));
    if (!CO.tmP) CO.tmP = setInterval(() => { if (!CO.run) { clearInterval(CO.tmP); CO.tmP = 0; return; } coPaint(); }, 250);
  } else if (CO.res) lv.append(h('b', { class: /^✓/.test(CO.res) ? 'co-good' : '' }, CO.res));
  else lv.append(h('span', { class: 'muted' }, p.kind === 'info' ? '' : p.ear ? 'Press 🎧 to hear it, then play it back.' : p.voice ? 'Press ▶ Listen to hear it, then ● Sing it. Key moves it to where your voice is comfortable.' : 'Press ▶ Listen to hear it, then ● Play it.'));
}
/** a sung piece on a keyboard: its notes lit, the one to sing now, and the note you are singing (in the nearest octave shown) */
function coKeys(box, p, ns, cur) {
  const ms = ns.map(n => n.m); if (!ms.length) return; const lo = Math.floor(Math.min(...ms) / 12) * 12, hi0 = Math.max(lo + 16, Math.max(...ms) + 2), hi = [1, 3, 6, 8, 10].includes(hi0 % 12) ? hi0 + 1 : hi0;
  let svg = box.querySelector('svg'); if (!svg || svg._lo !== lo || svg._hi !== hi) { box.innerHTML = ''; svg = kyPiano(lo, hi, { h: 84 }); svg.setAttribute('class', 'ky-svg co-ky'); box.append(h('div', { class: 'ky-wrap' }, svg)); }      /* co-ky: the Keys painter (part 86) leaves it alone */
  const root = ms[0] - (p.src.find(n => !n.r) || { i: 0 }).i, v = VOX.m != null ? Math.round(VOX.m) : null; let me = null;
  if (v != null && (CO.run || VOX.panel)) { for (let m = lo; m <= hi; m++) if ((m - v) % 12 === 0 && (me == null || Math.abs(m - ms[Math.max(0, cur || 0)]) < Math.abs(me - ms[Math.max(0, cur || 0)]))) me = m; }
  svg.querySelectorAll('[data-m]').forEach(k => { const m = +k.dataset.m; k.classList.toggle('ch', ms.includes(m)); k.classList.toggle('root', ms.includes(m) && (m - root) % 12 === 0); k.classList.toggle('on', cur != null && cur >= 0 && ns[cur] && ns[cur].m === m); k.classList.toggle('me', me === m); });
  svg.querySelectorAll('[data-l]').forEach(t => { const m = +t.dataset.l; t.textContent = ms.includes(m) ? coName(m) : ''; });
}
const degName = iv => ['R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'][iv];
