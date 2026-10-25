/* ============================================================
   Part 03 · backing band (KS pluck, drums, bass), transport/scheduler, recording / re-amp
   ============================================================ */
const INST = {
  Steel: { br: .9, s: .32, pp: .14, t60: 3.0 }, Nylon: { br: .45, s: .45, pp: .2, t60: 2.4 }, Electric: { br: .7, s: .28, pp: .12, t60: 3.4 },
  'Muted Pluck': { br: .35, s: .5, pp: .2, t60: .55 }, Round: { br: .3, s: .5, pp: .3, t60: 1.6 }, Pick: { br: .75, s: .38, pp: .25, t60: 1.2 }, Sub: { br: .18, s: .5, pp: .3, t60: 2.4 }
};
const instFor = tk => INST[tk === 'rhythm' ? S.band.compInst : tk === 'lead' ? S.band.leadInst : S.band.bassTone] || INST.Steel;

function buildBand() {
  const c = E.ctx; E.pl = {};
  [['rhythm', 70, 9500], ['lead', 90, 10500], ['bass', 35, 1400]].forEach(([id, hp, lp]) => {
    const body = bq('peaking', 220, .8, 2.5), h = bq('highpass', hp), l = bq('lowpass', lp), out = gn(1);
    chainN(h, body, l, out); out.connect(E.tr[id].in);
    if (E.worklet) { const n = new AudioWorkletNode(c, 'fw-pluck', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] }); n.connect(h); E.pl[id] = n; }
    else E.pl[id] = { in: h };
  });
  const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), d = nb.getChannelData(0); let sd = 7; for (let i = 0; i < d.length; i++) { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; d[i] = sd / 2147483648 - 1; }
  E.noise = nb;
}
bus.on('audio:ready', buildBand);

function pluck(track, time, midi, vel, o = {}) {
  const inst = instFor(track), f = mtof(midi), hum = (Math.random() * 2 - 1) * CFG.humanize * .12;
  vel = clamp(vel * (1 + hum), .05, 1);
  if (E.worklet) E.pl[track].port.postMessage({ t: 'on', at: time, f, vel, t60: inst.t60 * (o.t60m || 1), br: o.soft ? inst.br * .6 : inst.br, s: inst.s, pp: inst.pp, pan: o.pan || 0, id: o.id, g: o.g || 1, dead: o.dead });
  else {
    const c = E.ctx, osc = c.createOscillator(), lp = bq('lowpass', Math.min(f * 8, 9000)), g = gn(0), T60 = Math.min(inst.t60 * (o.t60m || 1), 2.2);
    osc.type = 'sawtooth'; osc.frequency.value = f; lp.frequency.setValueAtTime(Math.min(f * 8, 9000), time); lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.5, 200), time + .5);
    g.gain.setValueAtTime(vel * .22, time); g.gain.exponentialRampToValueAtTime(.0001, time + (o.dead ? .06 : T60)); chainN(osc, lp, g); g.connect(E.pl[track].in); osc.start(time); osc.stop(time + T60 + .05);
  }
}

/* ---------- drums ---------- */
const KITS = {
  'Acoustic': { k: [150, 48, .30, 1], s: [190, 3200, .2, .7], h: [7000, .035, .35], o: [7000, .28, .3], c: [1500, .18], t: [110, .3] },
  '808': { k: [110, 38, .6, 1.2], s: [230, 4500, .22, .6], h: [9000, .03, .3], o: [9000, .25, .25], c: [1300, .22], t: [90, .45] },
  'Brush (soft)': { k: [120, 50, .22, .6], s: [170, 2000, .30, .45], h: [5000, .06, .2], o: [5000, .35, .2], c: [1200, .2], t: [100, .3] },
  'Rock Room': { k: [170, 45, .34, 1.1], s: [200, 3800, .26, .8], h: [8000, .04, .35], o: [8000, .32, .3], c: [1600, .2], t: [120, .35] }
};
const DROWS = ['Kick', 'Snare', 'Hat', 'Open Hat', 'Clap / Rim', 'Tom / Perc'];
const DPATS = {
  'Folk Backbeat': ['X.......x.x.....', '....g.......g...', 'x.x.x.x.x.x.x.x.', '................', '................', '................'],
  'Rock 8ths': ['X.......x.x.....', '....X.......X...', 'x.x.x.x.x.x.x.x.', '..............x.', '................', '................'],
  'Four on the Floor': ['x...x...x...x...', '....x.......x...', '..x...x...x...x.', '................', '....x.......x...', '................'],
  'Pop Groove': ['X.....x...x.....', '....X.......X...', 'x.x.x.x.x.x.x.x.', '......x.......x.', '................', '................'],
  'Funk 16ths': ['X..x..x...x..x..', '....X..g.g..X..g', 'xxgxxxgxxxgxxxgx', '..............x.', '................', '................'],
  'Blues Shuffle': ['X.......x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.', '................', '................', '................'],
  'Reggae One-Drop': ['........X.......', '........x.......', 'x.x.x.x.x.x.x.x.', '................', '................', '..x...x...x...x.'],
  'Bossa Nova': ['X..x..X...x..X..', '................', 'x.x.x.x.x.x.x.x.', '................', 'x..x..x...x..x..', '................'],
  'Ballad Half-Time': ['X.......x.......', '........x.......', 'x...x...x...x...', '................', '................', '................'],
  'Island Groove': ['X.....x...x.....', '................', '..x...x...x...x.', '................', '....x.......x...', '..x.x...x..x....'],
  'Metal Double Kick': ['xxxxxxxxxxxxxxxx', '....X.......X...', 'x...x...x...x...', '................', 'X...............', '................'],
  'Hip-Hop Boom Bap': ['X.....x...x....x', '....X.......X...', 'x.x.x.x.x.x.x.xg', '................', '................', '................']
};
function dpat() { const b = S.band; if (!b.pat) b.pat = DPATS[b.patName].map(r => r.split('').map(ch => ({ '.': 0, g: 1, x: 2, X: 3 }[ch]))); return b.pat; }
function setDrumPattern(name) { S.band.patName = name; S.band.pat = DPATS[name].map(r => r.split('').map(ch => ({ '.': 0, g: 1, x: 2, X: 3 }[ch]))); commit(); }
function nz(t, dur, dest, off) { const s = E.ctx.createBufferSource(); s.buffer = E.noise; s.loop = true; s.connect(dest); s.start(t, off == null ? Math.random() * .8 : off); s.stop(t + dur + .02); return s; }
function drumHit(row, t, v) {
  if (!E.noise) return; const c = E.ctx, K = KITS[S.band.kit] || KITS.Acoustic, out = E.tr.drums.in, vol = [0, .5, .85, 1.1][v] || .8;
  const env = (g, dur, peak, start = t) => { g.gain.setValueAtTime(0.0001, start); g.gain.exponentialRampToValueAtTime(peak, start + .002); g.gain.exponentialRampToValueAtTime(.0001, start + dur); };
  if (row === 0) {
    const o = c.createOscillator(), g = gn(0); o.frequency.setValueAtTime(K.k[0], t); o.frequency.exponentialRampToValueAtTime(K.k[1], t + .07); env(g, K.k[2], .95 * vol * K.k[3]); o.connect(g); g.connect(out); o.start(t); o.stop(t + K.k[2] + .05);
    const ng = gn(0), nf = bq('lowpass', 3000); env(ng, .012, .25 * vol); nz(t, .012, nf); nf.connect(ng); ng.connect(out);
  } else if (row === 1) {
    const o = c.createOscillator(), g = gn(0); o.type = 'triangle'; o.frequency.setValueAtTime(K.s[0] * 1.3, t); o.frequency.exponentialRampToValueAtTime(K.s[0], t + .05); env(g, K.s[2] * .6, .45 * vol); o.connect(g); g.connect(out); o.start(t); o.stop(t + K.s[2]);
    const ng = gn(0), hp = bq('highpass', 1200), lp = bq('lowpass', K.s[1]); env(ng, K.s[2], .6 * vol * K.s[3]); const n = nz(t, K.s[2], hp); chainN(hp, lp, ng); ng.connect(out);
  } else if (row === 2 || row === 3) {
    const P = row === 2 ? K.h : K.o, ng = gn(0), hp = bq('highpass', P[0]); env(ng, P[1], P[2] * vol * (row === 3 ? .9 : 1)); nz(t, P[1], hp); hp.connect(ng); ng.connect(out);
  } else if (row === 4) {
    if (S.band.kit === '808' || S.band.patName === 'Four on the Floor') { for (let k = 0; k < 3; k++) { const ng = gn(0), bp = bq('bandpass', K.c[0], 1.2); env(ng, k === 2 ? K.c[1] : .012, .5 * vol, t + k * .011); nz(t + k * .011, .02, bp); bp.connect(ng); ng.connect(out); } }
    else { const o = c.createOscillator(), g = gn(0); o.frequency.value = 820; env(g, .03, .25 * vol); o.connect(g); g.connect(out); o.start(t); o.stop(t + .05); const ng = gn(0), bp = bq('bandpass', 1900, 2); env(ng, .04, .35 * vol); nz(t, .04, bp); bp.connect(ng); ng.connect(out); }
  } else {
    const o = c.createOscillator(), g = gn(0); o.frequency.setValueAtTime(K.t[0] * 1.5, t); o.frequency.exponentialRampToValueAtTime(K.t[0], t + .1); env(g, K.t[1], .5 * vol); o.connect(g); g.connect(out); o.start(t); o.stop(t + K.t[1] + .05);
  }
}
function drumStep(sib, t) { const pat = dpat(), L = Math.min(S.band.drumLen || 16, 32); const i = sib % L; pat.forEach((row, r) => { const v = row[i]; if (v) drumHit(r, t + (Math.random() * 2 - 1) * CFG.humanize * .006, v); }); }
function click(t, accent) {
  const c = E.ctx, o = c.createOscillator(), g = gn(0); o.frequency.value = accent ? 1700 : 1150; g.gain.setValueAtTime(CFG.metroVol * (accent ? 1 : .6), t); g.gain.exponentialRampToValueAtTime(.0001, t + .035);
  o.connect(g); g.connect(E.tr.click.in); o.start(t); o.stop(t + .05);
}

/* ---------- bass ---------- */
const BASS_STYLES = ['Root Whole', 'Root–Fifth', 'Eighths', 'Walking', 'Syncopated', 'Reggae Dub', 'Off', 'Octave Pump'];
const bassMidi = pc => { let m = 28 + ((pc - 28) % 12 + 12) % 12; return m; };
function bassEvent(style, ch, rel, cl, nextCh) {
  const c = parseChord(ch); if (!c || style === 'Off') return null;
  const r = bassMidi(c.bass), q3 = c.iv.includes(3) ? 3 : 4, fifth = r + 7, third = r + q3, sp4 = 4;
  switch (style) {
    case 'Root Whole': return rel === 0 ? { m: r, v: .85, len: cl } : null;
    case 'Root–Fifth': return rel === 0 ? { m: r, v: .9, len: cl / 2 } : (rel === Math.floor(cl / 2) ? { m: fifth, v: .7, len: cl / 2 } : null);
    case 'Eighths': return rel % 2 === 0 ? { m: (rel / 2) % 4 === 3 ? r + 12 : r, v: rel % 8 === 0 ? .95 : .7, len: 2 } : null;
    case 'Octave Pump': return rel % 2 === 0 ? { m: (rel % 4 === 2) ? r + 12 : r, v: rel % 4 === 0 ? .95 : .65, len: 2 } : null;
    case 'Walking': {
      if (rel % sp4) return null; const b = rel / sp4, n = nextCh ? parseChord(nextCh) : null, nr = n ? bassMidi(n.root) : r;
      const app = nr > r ? nr - 1 : nr + 1; return { m: [r, third, fifth, app][b % 4], v: .85, len: sp4 };
    }
    case 'Syncopated': { const m = { 0: r, 3: r, 6: fifth, 10: r + 12, 12: r }[rel]; return m == null ? null : { m, v: rel === 0 ? .95 : .75, len: 3 }; }
    case 'Reggae Dub': { const m = { 0: r, 6: r, 8: r + 7, 11: r + 5, 14: r }[rel]; return m == null ? null : { m, v: rel === 0 ? .6 : .9, len: 3 }; }
  }
  return null;
}

/* ---------- rhythm guitar strum / arpeggio patterns ---------- */
const STRUMS = {
  'Folk D-DU-UDU': { p: 'D...d.u...u.d.u.' }, 'Down 4s': { p: 'D...D...D...D...' }, 'Pop 8ths': { p: 'D...D.u.D...D.u.' },
  'Pop 16th shimmer': { p: 'D.dudu.uD.dudu.u' }, 'Reggae Skank': { p: '..u...u...u...u.' }, 'Funk Chuck': { p: 'D.m.D.m.D.m.D.mu' },
  'Power Chug 8ths': { p: 'D.d.D.d.D.d.D.d.', power: 1 }, 'Ballad Arpeggio': { p: '1.3.4.3.2.3.4.3.', arp: 1 }, 'Travis Roll': { p: '1.4.2.4.1.4.3.4.', arp: 1 },
  'Island Strum': { p: 'D..uD.u..u.uD.u.' }, 'Half-time Pad': { p: 'D...............' }, 'Waltz 3/4': { p: 'D.....d...d.....' }
};
const voicingFor = sym => {
  const vs = voicings(sym, S.tuning, S.capo, 12), i = S.voicePref[sym];
  return vs[i != null && vs[i] ? i : 0] || null;
};
function strumAt(t, sym, ch, style) {
  const p = parseChord(sym); if (!p) return; const useSym = style.power ? (pcName(p.root, false) + '5') : sym; const v = voicingFor(useSym) || voicingFor(sym); if (!v) return;
  const notes = []; v.frets.forEach((f, i) => { if (f != null) notes.push({ st: i, m: S.tuning[i] + S.capo + f }); });
  if (style.arp) { const d = +ch; if (!d) return; const n = notes[(d - 1) % notes.length]; pluck('rhythm', t, n.m, .62, { id: 'r' + n.st, pan: (n.st - 2.5) * .05 }); return; }
  if (ch === '.') return; const lc = ch.toLowerCase(), down = lc === 'd' || lc === 'm', acc = ch === ch.toUpperCase() ? 1 : 0;
  const order = down ? notes : notes.slice().reverse(), gap = .0105 + Math.random() * .003, take = down ? order : order.slice(0, Math.max(3, order.length - 2));
  take.forEach((n, k) => pluck('rhythm', t + k * gap, n.m, (lc === 'm' ? .55 : acc ? .85 : .6) * (down ? 1 : .8) * (.92 + Math.random() * .16), { id: 'r' + n.st, dead: lc === 'm' && k > 0 ? true : false, t60m: lc === 'm' ? .3 : 1, pan: (n.st - 2.5) * .06 }));
}
const LEGATO = new Set(['h', 'p', '/', '\\']);
function playTabNote(bar, n, t, dur) {
  const midi = n.f === 'x' ? S.tuning[n.st] + S.capo : noteMidi(n), id = 'l' + n.st;
  const prev = bar.tab.filter(o => o.st === n.st && o.s < n.s).sort((a, b) => b.s - a.s)[0], leg = prev && LEGATO.has(prev.t);
  const vel = (n.f === 'x' ? .5 : (leg ? .5 : .85)) * (n.t === '<>' ? .55 : 1);
  pluck('lead', t, n.t === '<>' ? midi + 12 : midi, vel, { id, soft: leg || n.t === '<>', dead: n.f === 'x', pan: (n.st - 2.5) * .08 });
  if (n.t === 'b') pluck('lead', t + dur * 1.5, midi + ((n.bend != null ? n.bend : n.f + 2) - n.f), .5, { id, soft: true, pan: (n.st - 2.5) * .08 });
}

/* ---------- transport ---------- */
const T = { playing: false, rec: false, cursor: 0, slot: 0, next: 0, loop: true, loopA: 0, loopB: null, metro: true, q: [], srcs: [], timer: 0, bars: null, wantRec: false, recFrom: 0, startCursor: 0, ending: false };
bus.on('song', () => { T.bars = null; });
const songSlots = () => totalBars() * spb();
const barsCache = () => T.bars || (T.bars = flatBars());
function chordAt(bi, sib) {
  const bars = barsCache(), fb = bars[bi]; if (!fb) return null; const cs = barChords(fb.bar), n = Math.max(1, cs.length), sp = spb(), ci = Math.min(n - 1, Math.floor(sib / (sp / n)));
  const start = Math.round(ci * sp / n), len = Math.round((ci + 1) * sp / n) - start; let nxt = cs[ci + 1]; if (!nxt) { const nb = bars[(bi + 1) % bars.length]; nxt = nb && barChords(nb.bar)[0]; }
  return { sym: cs[ci] || null, start, len, rel: sib - start, next: nxt };
}
function scheduleSlot(slot, time) {
  const sp = spb(), dur = slotDur(), sw = (slot % 2 !== 0) ? S.swing * dur : 0, tt = time + sw;
  const beatSlots = 16 / S.ts[1];
  if (slot < 0) { const sib = ((slot % sp) + sp) % sp; if (sib % beatSlots === 0) click(time, sib === 0); return; }
  const bi = Math.floor(slot / sp), sib = slot % sp, fb = barsCache()[bi]; if (!fb) return;
  if (T.metro && sib % beatSlots === 0) click(tt, sib === 0);
  if (S.band.drumsOn) drumStep(sib, tt);
  const cd = chordAt(bi, sib);
  if (cd && cd.sym) {
    if (S.band.bassOn) { const e = bassEvent(S.band.bassStyle, cd.sym, cd.rel, cd.len, cd.next); if (e) pluck('bass', tt, e.m, e.v, { id: 'b', pan: 0 }); }
    if (S.band.compOn) { const st = STRUMS[S.band.compStyle] || STRUMS['Down 4s'], L = Math.min(16, sp); strumAt(tt, cd.sym, st.p[sib % L], st); }
  }
  if (S.band.leadOn) fb.bar.tab.forEach(n => { if (n.s === sib) playTabNote(fb.bar, n, tt, dur); });
}
async function play(fromRec) {
  if (T.playing) return; try { bandHint(); } catch (e) { } await startAudio(); const c = E.ctx; applyMix(); if (!S.sections.length || !songSlots()) { toast('Add a section with at least one bar first', 'warn'); return; }
  T.rec = !!fromRec || T.rec; T.playing = true; T.ending = false; T.q = []; T.startCursor = T.cursor;
  const ci = T.rec && CFG.countIn > 0 ? CFG.countIn * spb() : 0; T.slot = T.cursor - ci; T.next = c.currentTime + .08; T.wantRec = T.rec; T.recFrom = T.cursor;
  if (!T.loopB) T.loopB = null; scheduleTakes(T.next + ci * slotDur(), T.cursor * slotDur()); trackStart(T.next + ci * slotDur(), T.cursor, true);
  clearInterval(T.timer); T.timer = setInterval(tick, 25); tick(); bus.emit('transport');
}
function tick() {
  if (!T.playing) return; const c = E.ctx, dur = slotDur(), ahead = c.currentTime + .15;
  while (T.next < ahead && T.playing && !T.ending) {
    const total = songSlots(), end = T.loop ? (T.loopB != null ? Math.min(T.loopB, total) : total) : total;
    if (T.slot >= end) {
      if (T.loop && end > 0) { if (T.loopA >= end) T.loopA = 0; if (REC) recEnd(); T.slot = T.loopA; stopTakes(); scheduleTakes(T.next, T.loopA * dur); trackStart(T.next, T.loopA); if (T.rec) { T.wantRec = true; T.recFrom = T.loopA; } if (T.slot >= end) { T.ending = true; T.endAt = T.next; break; } continue; }
      T.ending = true; T.endAt = T.next; break;
    }
    if (T.wantRec && T.slot === T.recFrom) { recBegin(T.slot, T.next); T.wantRec = false; }
    scheduleSlot(T.slot, T.next); T.q.push({ slot: T.slot, time: T.next }); if (T.q.length > 256) T.q.shift(); T.slot++; T.next += dur;
  }
}
function stopPlay(keep) {
  if (!T.playing) { if (!keep) { T.cursor = 0; bus.emit('transport'); } return; }
  T.playing = false; clearInterval(T.timer); stopTakes(); trackStop(); if (E.pl && E.worklet) Object.values(E.pl).forEach(n => n.port.postMessage({ t: 'kill' }));
  const was = T.rec; if (REC) recEnd(); T.rec = false; T.cursor = T.startCursor; bus.emit('transport'); if (was) bus.emit('rec:done');
}
const slotAtTime = time => {
  const q = T.q; if (!q.length) return T.cursor; let e = q[0]; for (let i = q.length - 1; i >= 0; i--) if (q[i].time <= time) { e = q[i]; break; }
  return e.slot + (time - e.time) / slotDur();
};
function playheadSlot() { if (!T.playing || !E.ctx) return T.cursor; return slotAtTime(E.ctx.currentTime - (E.ctx.outputLatency || E.ctx.baseLatency || 0)); }
function seek(slot) { slot = clamp(Math.round(slot), 0, Math.max(0, songSlots() - 1)); const was = T.playing; if (was) stopPlay(true); T.cursor = slot; bus.emit('transport'); if (was) play(); }
function nearestSlotTime(t) { let b = null, bd = 1e9; for (const e of T.q) { const d = Math.abs(e.time - t); if (d < bd) { bd = d; b = e; } } return b ? { e: b, d: bd } : null; }

/* ---------- takes: recording (dry DI + wet print), playback and re-amp ---------- */
const TAKES = []; let REC = null;
/* Recording captures whatever is armed, all on the same clock: the guitar (dry DI + wet print) and/or the vocal (input 2). */
function recBegin(slot, ctxTime) {
  if (!E.hasInput) { toast('No audio input is open — recording the backing/tab only', 'warn'); return; }
  const g = armedG(), v = armedV();
  if (!g && !v) { toast('Nothing is armed — arm the Guitar or Vocal lane (the ● button at the left of the arrangement) to record', 'warn'); return; }
  REC = { dry: [], wet: [], vox: [], g, v, t0: ctxTime, startSec: slot * slotDur(), bpm: S.bpm, preset: RIG.cur, n: 0, cam: [], pkG: [], pkV: [], perf0: performance.now() + (ctxTime - E.ctx.currentTime) * 1000 };
  if (g) { E.tapDI.on(true); if (CFG.rec.wet) E.tapWet.on(true); } if (v) E.tapVox.on(true); bus.emit('rec:state', true);
}
function pushBlock(arr, m, t0) {
  const sr = E.ctx.sampleRate; let l = m.l, off = Math.round((t0 - m.t) * sr); if (off < 0) off = 0; if (off >= l.length) return null; const b = off ? l.subarray(off) : l; arr.push(b); return b;
}
/* running min/max per 1024 samples, so the arrangement can draw a take while it is being recorded */
function livePeaks(pk, b) { for (let i = 0; i < b.length; i += 1024) { let mn = 1, mx = -1; for (let k = i, e = Math.min(b.length, i + 1024); k < e; k++) { const v = b[k]; if (v < mn) mn = v; if (v > mx) mx = v; } pk.push(mn, mx); } }
bus.on('tap:di', m => { if (m.onset || !REC || !REC.g) return; const b = pushBlock(REC.dry, m, REC.t0); if (b) livePeaks(REC.pkG, b); });
bus.on('tap:wet', m => { if (!REC || !REC.g) return; pushBlock(REC.wet, m, REC.t0); });
bus.on('tap:vox', m => { if (!REC || !REC.v) return; const b = pushBlock(REC.vox, m, REC.t0); if (b) livePeaks(REC.pkV, b); });
function cat(parts) { let n = 0; parts.forEach(p => n += p.length); const o = new Float32Array(n); let k = 0; parts.forEach(p => { o.set(p, k); k += p.length; }); return o; }
function peaksOf(d, per = 256) { const n = Math.ceil(d.length / per), mn = new Float32Array(n), mx = new Float32Array(n); for (let i = 0; i < n; i++) { let a = 1e9, b = -1e9; for (let k = i * per, e = Math.min(d.length, k + per); k < e; k++) { const v = d[k]; if (v < a) a = v; if (v > b) b = v; } mn[i] = a; mx[i] = b; } return { mn, mx, per }; }
function recEnd() {
  const r = REC; REC = null; E.tapDI.on(false); E.tapWet.on(false); E.tapVox.on(false); bus.emit('rec:state', false);
  if (!r) return; const sr = E.ctx.sampleRate, start = r.startSec - rttMs() / 1000, made = [];
  const mk = (kind, parts, wetParts) => {
    if (!parts.length) return; const dry = cat(parts), wet = wetParts && wetParts.length ? cat(wetParts) : null; if (dry.length < sr * .25) return;
    let pk = 0, e = 0; for (let i = 0; i < dry.length; i++) { const a = Math.abs(dry[i]); if (a > pk) pk = a; e += dry[i] * dry[i]; }
    const vox = kind === 'vox', nth = TAKES.filter(t => (t.kind === 'vox') === vox).length + 1;
    const take = { id: uid(), kind, name: (vox ? 'Vocal ' : 'Take ') + nth, startSec: start, sr, dry, wet, peaks: peaksOf(dry), g: 1, pan: 0, mute: false, solo: false, mode: vox ? 'wet' : (wet && CFG.rec.dry ? 'reamp' : 'wet'), bpm: r.bpm, preset: r.preset, peak: dB(pk), rms: dB(Math.sqrt(e / dry.length)), dur: dry.length / sr, t: Date.now(), stats: vox ? null : statsSnapshot(), cam: vox ? [] : r.cam };
    if (!vox && !CFG.rec.dry && wet) take.mode = 'wet'; TAKES.push(take); made.push(take);
  };
  if (r.g) mk('gtr', r.dry, r.wet); if (r.v) mk('vox', r.vox, null);
  if (made.length) { xpSignal(3); bus.emit('takes'); toast(made.map(t => t.name + ' (' + t.dur.toFixed(1) + ' s, peak ' + t.peak.toFixed(1) + ' dBFS)').join('  +  ') + ' recorded', 'ok'); }
}
function takeBuffer(tk, which) { const d = which === 'wet' ? tk.wet : tk.dry; if (!d) return null; if (!tk['_b' + which]) { const b = E.ctx.createBuffer(1, d.length, tk.sr); b.copyToChannel(d, 0); tk['_b' + which] = b; } return tk['_b' + which]; }
const takeAudible = tk => TAKES.some(t => t.solo) ? !!tk.solo : !tk.mute;
/** live gain / mute / solo changes while the take is playing */
function takeLive(tk) { const anySolo = TAKES.some(t => t.solo); TAKES.forEach(t => { if (t._g) tc(t._g.gain, (anySolo ? t.solo : !t.mute) ? t.g : 0, .015); }); if (tk && tk._pn) tc(tk._pn.pan, tk.pan || 0, .02); }
function scheduleTakes(atTime, fromSec) {
  TAKES.forEach(tk => {
    tk._g = null; tk._pn = null; const vox = tk.kind === 'vox', which = tk.mode === 'reamp' ? 'dry' : 'wet', buf = takeBuffer(tk, which) || takeBuffer(tk, 'dry'); if (!buf) return;
    const end = tk.startSec + buf.duration; if (end <= fromSec) return; const when = Math.max(atTime, atTime + (tk.startSec - fromSec)), off = Math.max(0, fromSec - tk.startSec);
    const src = E.ctx.createBufferSource(), g = gn(takeAudible(tk) ? tk.g : 0), pn = E.ctx.createStereoPanner(); pn.pan.value = tk.pan || 0; src.buffer = buf; src.connect(g); g.connect(pn); tk._g = g; tk._pn = pn;
    if (vox) pn.connect(E.voxStrip.in); else if (which === 'dry' && tk.mode === 'reamp') pn.connect(E.rigIn); else pn.connect(E.takesIn);
    src.start(when, off); T.srcs.push(src);
  });
}
function stopTakes() { T.srcs.forEach(s => { try { s.stop(); } catch (e) { } }); T.srcs = []; }

/* ---------- WAV ---------- */
function encodeWav(chs, sr, bits = 24) {
  const n = chs[0].length, nc = chs.length, bps = bits / 8, buf = new ArrayBuffer(44 + n * nc * bps), v = new DataView(buf);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + n * nc * bps, true); ws(8, 'WAVE'); ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, bits === 32 ? 3 : 1, true); v.setUint16(22, nc, true); v.setUint32(24, sr, true); v.setUint32(28, sr * nc * bps, true); v.setUint16(32, nc * bps, true); v.setUint16(34, bits, true); ws(36, 'data'); v.setUint32(40, n * nc * bps, true);
  let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) { const s = clamp(chs[c][i], -1, 1); if (bits === 32) { v.setFloat32(o, s, true); o += 4; } else if (bits === 24) { const x = Math.round(s * 8388607); v.setUint8(o, x & 255); v.setUint8(o + 1, (x >> 8) & 255); v.setUint8(o + 2, (x >> 16) & 255); o += 3; } else { v.setInt16(o, Math.round(s * 32767), true); o += 2; } }
  return new Blob([buf], { type: 'audio/wav' });
}
let BOUNCE = null;
async function bounceMaster() {
  await startAudio(); if (T.playing) stopPlay(true);
  BOUNCE = { l: [], r: [], t0: 0 }; const was = { loop: T.loop, metro: T.metro }; T.loop = false; T.metro = false; T.cursor = 0;
  toast('Bouncing master in real time…'); await play(); BOUNCE.t0 = E.ctx.currentTime + .08; E.tapMaster.on(true);
  const total = songSlots() * slotDur();
  await new Promise(r => setTimeout(r, (total + 3.2) * 1000)); E.tapMaster.on(false); stopPlay(true); T.loop = was.loop; T.metro = was.metro;
  const B = BOUNCE; BOUNCE = null; if (!B.l.length) return toast('Nothing captured', 'bad');
  const l = cat(B.l), r = cat(B.r); download((S.title || 'song').replace(/\W+/g, '_') + '_master.wav', encodeWav([l, r], E.ctx.sampleRate, 24)); toast('Master bounce saved', 'ok');
}
bus.on('tap:master', m => { if (!BOUNCE) return; const sr = E.ctx.sampleRate; let off = Math.round((BOUNCE.t0 - m.t) * sr); if (off < 0) off = 0; if (off >= m.l.length) return; BOUNCE.l.push(m.l.subarray(off)); BOUNCE.r.push((m.r || m.l).subarray(off)); });
