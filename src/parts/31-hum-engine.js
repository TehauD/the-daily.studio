/* ============================================================
   Part 31 · Hum to Song: engine. Everything here runs on the device.
   hear (pitch track) → notes → tempo → key → chords → sections → band
   ============================================================ */
const HUM_STYLES = {
  Folk: { kit: 'Acoustic', pat: 'Folk Backbeat', bass: 'Root–Fifth', comp: 'Folk D-DU-UDU', compInst: 'Steel', lead: 'Nylon', hint: 'Warm, strummed, backbeat' },
  Pop: { kit: 'Acoustic', pat: 'Pop Groove', bass: 'Eighths', comp: 'Pop 8ths', compInst: 'Steel', lead: 'Electric', hint: 'Bright, steady, radio-ready' },
  Rock: { kit: 'Rock Room', pat: 'Rock 8ths', bass: 'Eighths', comp: 'Power Chug 8ths', compInst: 'Electric', lead: 'Electric', hint: 'Driving, palm-muted power chords' },
  Ballad: { kit: 'Brush (soft)', pat: 'Folk Backbeat', bass: 'Root Whole', comp: 'Ballad Arpeggio', compInst: 'Nylon', lead: 'Nylon', hint: 'Soft brushes, rolling arpeggios' },
  Dance: { kit: '808', pat: 'Four on the Floor', bass: 'Syncopated', comp: 'Pop 16th shimmer', compInst: 'Steel', lead: 'Steel', hint: 'Four on the floor, shimmering chords' }
};
const HUM_FORMS = { full: 'Full song · intro, verses, choruses, bridge, outro', quick: 'Quick sketch · verse and chorus' };
const HUM_PROGS = {
  major: { chorus: ['I V vi IV', 'vi IV I V', 'I vi IV V', 'IV I V vi', 'I IV vi V'], bridge: ['vi ii IV V', 'ii V vi IV', 'IV V iii vi'], outro: 'IV I' },
  minor: { chorus: ['i VI III VII', 'i VII VI VII', 'VI VII i i', 'i iv VII III', 'III VII i VI'], bridge: ['iv i VI VII', 'VI VII III iv', 'iv VI VII i'], outro: 'VI i' }
};
/* how pleasing it is to move from one chord function to the next (scale degree → scale degree; 7 is the major V of a minor key) */
const HUM_TR = {
  major: { '0>3': .6, '0>4': .6, '0>5': .6, '0>1': .3, '0>2': .2, '1>4': .9, '1>5': .2, '2>5': .6, '2>3': .5, '3>4': .8, '3>0': .6, '3>1': .4, '4>0': .9, '4>5': .6, '4>3': .3, '5>3': .7, '5>1': .5, '5>4': .4 },
  minor: { '0>5': .6, '0>6': .6, '0>3': .5, '0>2': .4, '6>2': .6, '6>0': .7, '6>5': .4, '5>6': .7, '5>2': .4, '5>7': .5, '2>6': .5, '2>5': .6, '2>3': .4, '3>0': .5, '3>7': .8, '3>6': .4, '7>0': .9, '7>5': .5, '4>0': .6 }
};
const humYield = () => new Promise(r => setTimeout(r, 0));
const humNoteName = m => pcName(((Math.round(m) % 12) + 12) % 12, CFG.flats) + (Math.floor(Math.round(m) / 12) - 1);

/** Mono pitch tracker (YIN) over a whole recording. Returns per-frame f0, clarity and loudness. */
async function humPitch(x, sr, onProg) {
  const f = Math.max(1, Math.round(sr / 16000)), fs = sr / f, n = Math.floor(x.length / f), y = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < f; k++) s += x[i * f + k] || 0; y[i] = s / f; }
  let pi = 0, po = 0; for (let i = 0; i < n; i++) { const v = y[i]; po = .98 * (po + v - pi); pi = v; y[i] = po; }   // drop rumble below ~50 Hz
  const W = 640, hop = 256, tMin = Math.max(2, Math.floor(fs / 1000)), tMax = Math.floor(fs / 75), nF = Math.max(0, Math.floor((n - W - tMax) / hop));
  const f0 = new Float32Array(nF), clar = new Float32Array(nF), rms = new Float32Array(nF), d = new Float32Array(tMax + 2);
  for (let fi = 0; fi < nF; fi++) {
    const p = fi * hop; let e = 0; for (let i = 0; i < W; i++) e += y[p + i] * y[p + i]; rms[fi] = Math.sqrt(e / W);
    if (rms[fi] > 1e-4) {
      for (let tau = 1; tau <= tMax; tau++) { let s = 0; for (let i = 0; i < W; i++) { const t = y[p + i] - y[p + i + tau]; s += t * t; } d[tau] = s; }
      let run = 0; d[0] = 1; for (let tau = 1; tau <= tMax; tau++) { run += d[tau]; d[tau] = d[tau] * tau / (run || 1); }
      let tau = -1; for (let t = tMin; t <= tMax; t++) if (d[t] < .15) { while (t + 1 <= tMax && d[t + 1] < d[t]) t++; tau = t; break; }
      if (tau < 0) { let mn = 1e9, mi = -1; for (let t = tMin; t <= tMax; t++) if (d[t] < mn) { mn = d[t]; mi = t; } if (mn < .3) tau = mi; }
      if (tau > 1 && tau < tMax) { const a = d[tau - 1], b = d[tau], c = d[tau + 1], den = 2 * (a - 2 * b + c), sh = den ? clamp((a - c) / den, -1, 1) : 0; f0[fi] = fs / (tau + sh); clar[fi] = clamp(1 - b, 0, 1); }
    }
    if (fi % 120 === 119) { if (onProg) onProg(fi / nF); await humYield(); }
  }
  return { f0, clar, rms, hop, fs, W, dt: hop / fs, lead: W / 2 / fs };
}

/** Pitch track → a list of sung notes {t, d, m} (seconds, MIDI), with the singer's tuning drift removed. */
function humNotes(P) {
  const nF = P.f0.length, rs = Array.from(P.rms).sort((a, b) => a - b), ref = rs[Math.floor(rs.length * .9)] || 0, gate = Math.max(.004, ref * .12);
  const midi = new Float32Array(nF).fill(NaN);
  for (let i = 0; i < nF; i++) {
    let lm = 0; for (let k = Math.max(0, i - 12); k <= Math.min(nF - 1, i + 12); k++) if (P.rms[k] > lm) lm = P.rms[k];
    if (P.f0[i] > 0 && P.clar[i] > .55 && P.rms[i] > gate && P.rms[i] > .3 * lm) midi[i] = 69 + 12 * Math.log2(P.f0[i] / 440);
  }
  let sx = 0, sy = 0, cnt = 0; for (let i = 0; i < nF; i++) if (!isNaN(midi[i])) { sx += Math.cos(2 * Math.PI * midi[i]); sy += Math.sin(2 * Math.PI * midi[i]); cnt++; }
  const off = cnt ? Math.atan2(sy, sx) / (2 * Math.PI) : 0;       // −.5…+.5 semitone: how flat or sharp the whole hum sat
  const m = new Float32Array(nF); for (let i = 0; i < nF; i++) m[i] = isNaN(midi[i]) ? NaN : midi[i] - off;
  const med = (a, i, r) => { const v = []; for (let k = Math.max(0, i - r); k <= Math.min(a.length - 1, i + r); k++) if (!isNaN(a[k])) v.push(a[k]); if (!v.length) return NaN; v.sort((p, q) => p - q); return v[v.length >> 1]; };
  const sm = new Float32Array(nF); for (let i = 0; i < nF; i++) sm[i] = isNaN(m[i]) ? NaN : med(m, i, 2);
  const notes = []; let cur = null, gap = 0;
  const close = () => { if (!cur) return; const dur = (cur.e - cur.s + 1) * P.dt; if (dur >= .09) { const v = cur.v.slice().sort((a, b) => a - b); notes.push({ t: cur.s * P.dt + P.lead, d: dur, m: Math.round(v[v.length >> 1]) }); } cur = null; };
  for (let i = 0; i < nF; i++) {
    const v = sm[i];
    if (isNaN(v)) { gap++; if (gap > 2) close(); continue; }
    const mean = cur ? cur.v.slice(-8).reduce((a, b) => a + b, 0) / Math.min(8, cur.v.length) : 0;
    if (cur && Math.abs(v - mean) < .75) { cur.e = i; cur.v.push(v); gap = 0; } else { close(); cur = { s: i, e: i, v: [v] }; gap = 0; }
  }
  close(); return { notes, tune: off };
}

/** Tempo from where the notes start and how long they last (beat and eighth-note comb), nudged toward everyday tempos. */
function humTempo(notes) {
  if (notes.length < 4) return 90;
  const t0 = notes[0].t; let best = 90, bs = -1e9;
  for (let b = 60; b <= 168; b += .5) {
    const beat = 60 / b; let so = 0, sd = 0;
    notes.forEach(n => { const u = (n.t - t0) / beat; so += Math.cos(2 * Math.PI * u) + .6 * Math.cos(4 * Math.PI * u); sd += Math.cos(4 * Math.PI * n.d / beat); });
    const s = so / notes.length + .4 * sd / notes.length - .6 * Math.pow(Math.log2(b / 100), 2);
    if (s > bs) { bs = s; best = b; }
  }
  return Math.round(best);
}

/** Snap the notes onto a grid of 16th-note slots. First note = bar 1, beat 1. */
function humQuant(notes, bpm) {
  if (!notes.length) return [];
  const sd = 15 / bpm, t0 = notes[0].t, g = bpm > 100 ? 2 : 1, out = [];
  for (const n of notes) {
    const s = Math.round((n.t - t0) / sd / g) * g; let e = Math.round((n.t + n.d - t0) / sd / g) * g; if (e <= s) e = s + g;
    const p = out[out.length - 1];
    if (p && s < p.s + p.l) { if (s <= p.s) { if (e - s > p.l) { p.l = e - s; p.m = n.m; } continue; } p.l = s - p.s; }
    out.push({ s, l: e - s, m: n.m });
  }
  return out;
}

/** Key by weighting pitch classes with how long they were held; the last note counts extra (songs come home). */
function humKey(q) {
  const hist = new Array(12).fill(0); q.forEach((n, i) => { hist[((n.m % 12) + 12) % 12] += n.l * (i === q.length - 1 ? 1.8 : 1) * (i === 0 ? 1.25 : 1); });
  if (!hist.some(v => v > 0)) return { root: 9, minor: true, r: 0 };
  const r = detectKey(hist), a = r[0], last = ((q[q.length - 1].m % 12) + 12) % 12;
  const b = r.find(k => k.minor !== a.minor && ((k.root - a.root + 12) % 12 === (a.minor ? 3 : 9)));      // the relative major / minor
  if (b && a.r - b.r < .04 && b.root === last && a.root !== last) return { root: b.root, minor: b.minor, r: b.r };
  return { root: a.root, minor: a.minor, r: a.r };
}

function humCands(root, minor) {
  const sn = minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)', fl = keyUsesFlats(root, minor), c = [];
  diatonic(root, sn).forEach(x => { if (/dim$/.test(x.triad)) return; const mi = /m$/.test(x.triad); c.push({ deg: x.deg, sym: x.triad, pcs: [x.root, (x.root + (mi ? 3 : 4)) % 12, (x.root + 7) % 12], rt: x.root }); });
  if (minor) { const v = (root + 7) % 12; c.push({ deg: 7, sym: pcName(v, fl), pcs: [v, (v + 4) % 12, (v + 7) % 12], rt: v }); }
  return c;
}

/** Choose a chord for every half bar: fit to the melody, favour natural chord movement, avoid fussy changes (Viterbi). Returns one string per bar. */
function humHarmonize(q, bars, key, seed) {
  const cands = humCands(key.root, key.minor), TR = HUM_TR[key.minor ? 'minor' : 'major'], sc = SCALES[key.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)'], inKey = new Set(sc.map(i => (key.root + i) % 12));
  const U = bars * 2, us = 8, score = [];
  for (let u = 0; u < U; u++) {
    const row = cands.map(() => 0); let tot = 0;
    q.forEach(n => {
      const a = Math.max(n.s, u * us), b = Math.min(n.s + n.l, (u + 1) * us), ov = b - a; if (ov <= 0) return; tot += ov; const pc = ((n.m % 12) + 12) % 12, acc = n.s >= u * us && n.s % 4 === 0 ? 1.3 : 1;
      cands.forEach((c, ci) => { const i = c.pcs.indexOf(pc); row[ci] += ov * acc * (i === 0 ? 1 : i === 1 ? .85 : i === 2 ? .7 : (inKey.has(pc) ? -.15 : -.5)); });
    });
    score.push(row.map((v, ci) => (tot ? v / tot : 0) + (seed ? (((seed * 7919 + u * 131 + ci * 31) % 97) / 97) * .25 : 0)));
  }
  const V = [], B = [];
  for (let u = 0; u < U; u++) {
    const v = [], bp = [];
    cands.forEach((c, ci) => {
      let best = -1e9, bi = 0;
      if (u === 0) best = (c.deg === 0 ? .8 : 0); else cands.forEach((p, pi) => {
        let t = p === c ? (u % 2 === 0 ? -.1 : .1) : (TR[p.deg + '>' + c.deg] || 0) - (u % 2 ? .5 : 0); const s = V[u - 1][pi] + t; if (s > best) { best = s; bi = pi; }
      });
      v.push(best + score[u][ci] + (u === U - 1 ? (c.deg === 0 ? .5 : c.deg === 4 || c.deg === 7 ? .25 : 0) : 0)); bp.push(bi);
    });
    V.push(v); B.push(bp);
  }
  let ci = V[U - 1].indexOf(Math.max(...V[U - 1])); const path = new Array(U);
  for (let u = U - 1; u >= 0; u--) { path[u] = ci; ci = B[u][ci]; }
  const out = []; for (let b = 0; b < bars; b++) { const x = cands[path[b * 2]].sym, y = cands[path[b * 2 + 1]].sym; out.push(x === y ? x : x + ' ' + y); }
  return out;
}

/* melody helpers: move notes by scale steps so they stay in key */
function humSteps(key) {
  const sc = SCALES[key.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)'];
  return {
    to: m => { const rel = m - key.root, o = Math.floor(rel / 12), p = ((rel % 12) + 12) % 12; let di = 0, bd = 99; sc.forEach((s, i) => { const dd = Math.abs(s - p); if (dd < bd) { bd = dd; di = i; } }); return o * 7 + di; },
    from: st => key.root + 12 * Math.floor(st / 7) + sc[((st % 7) + 7) % 7]
  };
}
/** Nudge notes that land on a strong beat onto the nearest chord tone (one scale step at most). */
function humSnapToChords(mel, chords, key) {
  const { to, from } = humSteps(key), cm = {}; const pcsOf = sym => { if (!cm[sym]) { const c = parseChord(sym); cm[sym] = c ? c.pcs : []; } return cm[sym]; };
  return mel.map(n => {
    if (n.s % 4 !== 0) return n; const bar = Math.floor(n.s / 16), cs = (chords[bar] || '').split(' ').filter(Boolean); if (!cs.length) return n;
    const sym = cs[Math.min(cs.length - 1, Math.floor((n.s % 16) / (16 / cs.length)))], pcs = pcsOf(sym); if (pcs.includes(((n.m % 12) + 12) % 12)) return n;
    const st = to(n.m); for (const dlt of [1, -1]) { const m2 = from(st + dlt); if (pcs.includes(((m2 % 12) + 12) % 12)) return Object.assign({}, n, { m: m2 }); } return n;
  });
}
const humCutBars = (mel, bars) => mel.filter(n => n.s < bars * 16);

/** Guitar fingering for a melody note: stay near the previous one, stay low on the neck. */
function humFret(m, prev) {
  let best = null, bc = 1e9;
  for (let st = 0; st < S.tuning.length; st++) {
    const f = m - (S.tuning[st] + S.capo); if (f < 0 || f > 14) continue;
    const c = (prev ? Math.abs(st - prev.st) * .6 + Math.abs(f - prev.f) * .25 : st * .05) + (f > 9 ? .5 : 0) + (f === 0 ? -.2 : 0);
    if (c < bc) { bc = c; best = { st, f }; }
  }
  return best;
}
function humPlaceMelody(sec, mel) {
  let prev = null; mel.slice().sort((a, b) => a.s - b.s).forEach(n => {
    const bi = Math.floor(n.s / 16); if (bi >= sec.bars.length) return; let m = n.m; while (m < S.tuning[0] + S.capo) m += 12; while (m > S.tuning[0] + S.capo + 38) m -= 12;
    const p = humFret(m, prev); if (!p) return; prev = p; sec.bars[bi].tab.push({ s: n.s % 16, st: p.st, f: p.f, t: '' });
  });
}

/** Everything the app needs from a recording, computed once. */
async function humAnalyze(pcm, sr, onProg) {
  const P = await humPitch(pcm, sr, onProg), { notes, tune } = humNotes(P);
  return { notes, tune, dur: pcm.length / sr, bpm: humTempo(notes), key: notes.length ? humKey(humQuant(notes, humTempo(notes))) : { root: 9, minor: true, r: 0 } };
}

/** Build a complete song object from the analysis and the person's choices (style, form, tempo, key, seed). */
function humSong(an, o = {}) {
  const style = HUM_STYLES[o.style] ? o.style : humPickStyle(an), st = HUM_STYLES[style], bpm = clamp(Math.round(o.bpm || an.bpm), 50, 200), form = o.form || 'full', seed = o.seed | 0;
  const key = { root: o.key != null ? o.key : an.key.root, minor: o.minor != null ? o.minor : an.key.minor };
  let mel = humQuant(an.notes, bpm); if (!mel.length) mel = [{ s: 0, l: 4, m: 60 + key.root }];
  const ms = mel.map(n => n.m).sort((a, b) => a - b), shift = 12 * Math.round((62 - ms[ms.length >> 1]) / 12); mel = mel.map(n => Object.assign({}, n, { m: n.m + shift }));
  let bars = o.verse ? o.verse.length : Math.ceil(Math.max(...mel.map(n => n.s + n.l)) / 16); bars = clamp(bars, 2, 16); if (bars % 2 && bars > 2) bars++; mel = humCutBars(mel, bars);
  const verse = o.verse || humHarmonize(mel, bars, key, seed), prog = HUM_PROGS[key.minor ? 'minor' : 'major'], tok = s => s.split(' ').map(t => romanToChord(t, key.root, key.minor));
  const choose = (list, k) => list[(seed + k) % list.length];
  const chorusP = tok(choose(prog.chorus, 0)), chorusC = bars >= 8 ? chorusP.concat(chorusP) : chorusP, bridgeC = tok(choose(prog.bridge, 1)), outroC = tok(prog.outro), introC = chorusP.slice(0, 2);
  const { to, from } = humSteps(key), cm = humCutBars(mel, 4);
  const lift = humSnapToChords(cm.map(n => Object.assign({}, n, { m: from(to(n.m) + 2) })), chorusC, key);
  const chMel = chorusC.length > 4 ? lift.concat(lift.map(n => Object.assign({}, n, { s: n.s + 64 }))) : lift;
  const piv = (() => { const a = cm.map(n => to(n.m)).sort((x, y) => x - y); return a.length ? a[a.length >> 1] : 0; })();
  const brMel = humSnapToChords(cm.map(n => Object.assign({}, n, { m: from(2 * piv - to(n.m)) })), bridgeC, key);
  const key0 = key, s = blankSong({ title: o.title || 'Hum idea', bpm, key: key0.root, minor: key0.minor, form: 'empty' });
  const secs = [], add = (name, chords, mel2) => { const sec = mkSection(name, chords); if (mel2) humPlaceMelody(sec, mel2); secs.push(sec); };
  if (form === 'full') { add('Intro', introC, null); add('Verse 1', verse, mel); add('Chorus', chorusC, chMel); add('Verse 2', verse, mel); add('Chorus', chorusC, chMel); add('Bridge', bridgeC, brMel); add('Chorus', chorusC, chMel); add('Outro', outroC, null); }
  else { add('Verse 1', verse, mel); add('Chorus', chorusC, chMel); add('Verse 2', verse, mel); add('Chorus', chorusC, chMel); }
  s.sections = secs; s.swing = 0;
  Object.assign(s.band, { drumsOn: true, kit: st.kit, patName: st.pat, pat: null, bassOn: true, bassStyle: st.bass, bassTone: style === 'Rock' ? 'Pick' : 'Round', compOn: true, compStyle: st.comp, compInst: st.compInst, leadOn: true, leadInst: st.lead });
  s.notes = 'Made from a hum with Hum to Song (' + style + ' · ' + pcName(key.root, keyUsesFlats(key.root, key.minor)) + (key.minor ? ' minor' : ' major') + ' · ' + bpm + ' BPM). The melody is yours; chords, sections and band were arranged from it.';
  return { song: s, style, bpm, key, bars, form, melody: mel };
}
function humPickStyle(an) { return an.bpm < 78 ? 'Ballad' : an.bpm > 128 ? 'Dance' : an.key.minor && an.bpm > 108 ? 'Rock' : an.bpm > 100 ? 'Pop' : 'Folk'; }
