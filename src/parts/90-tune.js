/* ============================================================
   Part 90 · VOCAL TUNING (2.43) — pitch correction for a vocal take, done on this device
   A room on the hosted site (scripts/rooms.mjs): it loads the first time someone tunes a take.
     1 · pitch: YIN (part 04) every 10 ms on the dry recording, with a level gate and clarity check; one-frame octave slips and short
         gaps are smoothed over
     2 · target: the nearest note of the song's key and scale, held until the voice is clearly on another note (no flicker between two)
     3 · correction: Natural moves the average pitch most of the way to the note slowly, so slides and vibrato stay;
         Tight moves it nearly all the way quickly; Hard snaps every frame to the note (the modern "tuned" sound, vibrato gone)
     4 · shifting: TD-PSOLA. Grains two periods long, cut where the voice repeats, are laid down closer together or further apart; the
         grains keep their own shape, so the voice keeps its character, and every grain stays where it was in time, so nothing drifts
   The take keeps its length and its place. The original is kept (in memory, and in the song's own storage) so Off brings it back.
   ============================================================ */
const TUNE_MODES = { natural: { speed: .14, amt: .75, vib: true }, tight: { speed: .045, amt: .95, vib: false }, hard: { speed: 0, amt: 1, vib: false } };
const TUNE = { orig: new Map(), busy: false };
/** the voice's pitch every hop: Float32Array of Hz (0 = no clear pitch) */
async function tunePitch(x, sr, onProg) {
  const hop = Math.round(sr * .01), win = Math.round(sr * .046), n = Math.max(0, Math.floor((x.length - win) / hop) + 1), f = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = i * hop, fr = x.subarray(a, a + win); let e = 0; for (let k = 0; k < fr.length; k += 4) e += fr[k] * fr[k];
    if (Math.sqrt(e / (fr.length / 4)) > .006) { const r = yin(fr, sr, .15, 70); if (r && r.clarity > .7 && r.f > 70 && r.f < 1100) f[i] = r.f; }
    if (i % 150 === 149) { if (onProg) onProg(.7 * i / n); await new Promise(r => setTimeout(r, 0)); }
  }
  for (let i = 1; i < n - 1; i++) {      /* a single frame an octave off its neighbours is an error, not a note */
    const p = f[i - 1], q = f[i + 1]; if (f[i] && p && q && Math.abs(Math.log2(p / q)) < .1) { const o = Math.log2(f[i] / p); if (Math.abs(Math.abs(o) - 1) < .1) f[i] = (p + q) / 2; }
  }
  for (let i = 1; i < n; i++) if (!f[i]) { let j = i; while (j < n && !f[j] && j - i < 3) j++; if (j < n && f[j] && f[i - 1] && j - i < 3) for (let k = i; k < j; k++) f[k] = f[i - 1] + (f[j] - f[i - 1]) * (k - i + 1) / (j - i + 1); }
  return { f, hop };
}
/** semitone corrections per hop toward the song's scale */
function tuneCurve(f, hop, sr, mode) {
  const M = TUNE_MODES[mode] || TUNE_MODES.natural, pcs = new Set((SCALES[S.scale] || SCALES['Natural Minor (Aeolian)']).map(i => (i + S.key) % 12)), n = f.length, c = new Float32Array(n);
  const nearest = m => { let best = Math.round(m), bd = 9; for (let k = Math.floor(m) - 2; k <= Math.ceil(m) + 2; k++) if (pcs.has(((k % 12) + 12) % 12) && Math.abs(k - m) < bd) { bd = Math.abs(k - m); best = k; } return best; };
  const alpha = M.speed > 0 ? 1 - Math.exp(-(hop / sr) / M.speed) : 1, W = 12; let tgt = null, cur = 0;
  for (let i = 0; i < n; i++) {
    if (!f[i]) { tgt = null; cur *= .8; c[i] = 0; continue; }
    const m = 69 + 12 * Math.log2(f[i] / 440); let avg = m;
    if (M.vib) { let s = 0, k = 0; for (let j = Math.max(0, i - W); j <= Math.min(n - 1, i + W); j++) if (f[j]) { s += 69 + 12 * Math.log2(f[j] / 440); k++; } avg = s / k; }
    const nt = nearest(avg); if (tgt == null || Math.abs(avg - tgt) > .65) tgt = nt;      /* stay on a note until the voice has clearly left it */
    const want = (tgt - (M.vib ? avg : m)) * M.amt; cur = M.speed > 0 ? cur + (want - cur) * alpha : want; c[i] = cur;
  }
  return c;
}
/** TD-PSOLA: x shifted by `semis` (per hop) without changing its timing */
function tunePsola(x, sr, f, semis, hop) {
  const N = x.length, out = new Float32Array(N), ws = new Float32Array(N), fr = i => Math.min(f.length - 1, Math.max(0, Math.floor(i / hop))), P0 = Math.round(sr / 150);
  const per = i => { const v = f[fr(i)]; return v ? Math.max(16, Math.round(sr / v)) : P0; }, rat = i => f[fr(i)] ? Math.pow(2, semis[fr(i)] / 12) : 1;
  /* pitch marks one period apart, each on the same positive peak of the cycle as the one before (a loudest-sample search can jump
     between two peaks of one cycle, and grains cut there come back an octave low) */
  const marks = []; let prevV = false;
  for (let t = 0; t < N;) {
    const P = per(t), v = !!f[fr(t)]; let m = t;
    if (v) { const w = prevV ? Math.max(2, Math.round(P / 6)) : P >> 1, a = Math.max(0, t - w), b = Math.min(N, t + w); let bv = -Infinity; for (let k = a; k < b; k++) if (x[k] > bv) { bv = x[k]; m = k; } if (marks.length) m = Math.max(m, marks[marks.length - 1] + (P >> 1)); }
    marks.push(m); prevV = v; t = m + P;
  }
  let mi = 0; const perF = i => { const v = f[fr(i)]; return v ? sr / v : P0; };
  for (let tf = 0; tf < N;) {      /* the grains' spacing is kept in fractions of a sample: a whole-sample step is several cents off at a sung pitch */
    const ts = Math.round(tf); while (mi + 1 < marks.length && Math.abs(marks[mi + 1] - ts) <= Math.abs(marks[mi] - ts)) mi++;
    const ta = marks[mi], P = per(ta), r = rat(ta);
    for (let k = -P; k < P; k++) { const a = ta + k, b = ts + k; if (a < 0 || a >= N || b < 0 || b >= N) continue; const w = .5 - .5 * Math.cos(Math.PI * (k + P) / P); out[b] += x[a] * w; ws[b] += w; }
    tf += Math.max(1, perF(ta) / r);
  }
  for (let i = 0; i < N; i++) out[i] = ws[i] > .1 ? out[i] / ws[i] : out[i];
  return out;
}
/** tune a vocal take: mode 'off' | 'natural' | 'tight' | 'hard'. Clips cut from the same recording share its audio, so they change together. */
async function tuneTake(tk, mode, onProg) {
  if (!tk || TUNE.busy) return false; const sid = tkSrc(tk), grp = TAKES.filter(x => tkSrc(x) === sid), key = PRJ.cur ? PRJ.cur + '/take/' + sid + '/orig' : null;
  TUNE.busy = true;
  try {
    let orig = TUNE.orig.get(sid);
    if (!orig && tk.tune && tk.tune !== 'off' && key) { try { const o = await pdbGet('blobs', key); if (o && o.dry) orig = { dry: new Float32Array(o.dry), wet: o.wet ? new Float32Array(o.wet) : null }; } catch (e) { } }
    if (!orig) { orig = { dry: tk.dry.slice(), wet: tk.wet ? tk.wet.slice() : null }; if (key) { try { await pdbPut('blobs', { dry: orig.dry, wet: orig.wet }, key); } catch (e) { } } }
    TUNE.orig.set(sid, orig);
    if (mode === 'off') { tk.dry.set(orig.dry); if (tk.wet && orig.wet) tk.wet.set(orig.wet); }
    else {
      const { f, hop } = await tunePitch(orig.dry, tk.sr, onProg), semis = tuneCurve(f, hop, tk.sr, mode); if (onProg) onProg(.8);
      tk.dry.set(tunePsola(orig.dry, tk.sr, f, semis, hop)); if (tk.wet && orig.wet) tk.wet.set(tunePsola(orig.wet, tk.sr, f, semis, hop));
    }
    grp.forEach(x => { x.tune = mode; x._saved = false; x.peaks = peaksOf(x.dry); }); if (onProg) onProg(1);
    bus.emit('takes'); try { tkResched(); } catch (e) { } try { await projSave(); } catch (e) { }
    return true;
  } finally { TUNE.busy = false; }
}
