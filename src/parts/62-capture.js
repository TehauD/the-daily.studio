/* ============================================================
   Part 62 · Capture: play, and the notes and chords land in the tab.
   The first capture heard one note at a time (a pitch tracker), so a strummed chord gave nothing, a repeated note was swallowed, soft playing was missed,
   and it only worked if the transport was already running with no sign of what it heard. This replaces it:
     - every attack (the input's onset detector, with an energy-jump fallback for soft playing) opens a short listening window;
     - ~100 ms later the new energy in that window (what rose compared with just before it, so ringing notes are not written again) is searched for notes
       by harmonic summation, picking one string's note at a time and removing its harmonics, so a strummed chord comes out as the notes of the chord;
     - one note is written with the same fingering logic as before; several notes become a chord: the library shape when it matches what was heard
       (and the bar's chord name when it is empty), otherwise the nearest playable fingering;
     - the single-note pitch tracker stays as a fallback when no attack was seen;
     - starting it from a stopped transport counts you in, loops the section you are in, and says what it hears and what it wrote.
   Everything is local. Nothing is uploaded.
   ============================================================ */
Object.assign(CAP, { countIn: true, loop: true, replace: true, nameChords: true });
const CX = { before: null, started: false, prevLoop: null, pass: 0, touched: new Set(), pend: null, lastOn: -9, evalT: -9, heard: false, t0: 0, warned: false, say: '', saySt: '', log: [], rmsRing: [], writes: 0, chords: 0, lastNotes: [], flux: 0 };

/* ---------- a small FFT, and the notes in a window of audio ---------- */
function capFFT(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < half; k++) { const a = i + k, b = a + half, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
  }
}
/** magnitude spectrum (M/2 bins) of x under a Hann window, zero-padded to M */
function capSpec(x, M) {
  const re = new Float32Array(M), im = new Float32Array(M), n = Math.min(x.length, M);
  for (let i = 0; i < n; i++) re[i] = x[i] * (.5 - .5 * Math.cos(2 * Math.PI * i / Math.max(1, n - 1)));
  capFFT(re, im); const out = new Float32Array(M >> 1); for (let k = 0; k < out.length; k++) out[k] = Math.hypot(re[k], im[k]); return out;
}
/** the MIDI notes this guitar can sound (open strings plus frets 0–22, capo included) */
function capPlayable(tuning = S.tuning, capo = S.capo) { const set = new Set(); tuning.forEach(o => { for (let f = 0; f <= 22; f++) set.add(o + capo + f); }); return [...set].sort((a, b) => a - b); }
/**
 * Notes that started in `post` (audio just after an attack). `pre` is the audio just before it: whatever was already sounding there is not new.
 * Returns [{ midi, sal }], lowest first. Pure: it reads only its arguments (and the tuning, to know which notes are possible).
 */
function capNotes(post, pre, sr, o = {}) {
  const M = 16384, n2 = M >> 1, bh = sr / M, P = capSpec(post, M), Q = pre && pre.length > 512 ? capSpec(pre, M) : null, qs = Q ? post.length / pre.length : 0;
  const k0 = Math.ceil(90 / bh), k1 = Math.min(n2 - 2, Math.floor(3500 / bh)), samp = []; for (let k = k0; k < k1; k += 3) samp.push(P[k]); samp.sort((a, b) => a - b);
  let mx = 0; for (let k = k0; k < k1; k++) if (P[k] > mx) mx = P[k]; const nf = Math.max((samp[samp.length >> 1] || 0) + 1e-6, .012 * mx);       // the floor is the noise, but never below the window's own leakage (−38 dB under the loudest partial)
  const B = new Float32Array(n2); for (let k = 0; k < n2; k++) B[k] = Math.max(0, P[k] - (Q ? .9 * qs * Q[k] : 0));
  const cand = capPlayable(o.tuning || S.tuning, o.capo != null ? o.capo : S.capo), wts = [1, 1, .8, .6, .5, .4];
  const wl = Math.ceil(2 * M / Math.max(512, post.length)) + 1;            // the window's main lobe, in bins: nothing closer than this can be told apart
  const sal = m => {
    const f0 = mtof(m); let s = 0, hit = 0, low = 0;
    for (let h = 1; h <= 6; h++) {
      const f = f0 * h; if (f > 5200) break; const kc = f / bh, wn = Math.max(wl, Math.round(kc * .02)); let pk = 0, kp = -1;
      for (let k = Math.max(1, Math.round(kc) - wn); k <= Math.min(n2 - 2, Math.round(kc) + wn); k++) if (B[k] > pk) { pk = B[k]; kp = k; }
      if (kp < 1) continue; const a = Math.log(B[kp - 1] + 1e-9), b = Math.log(pk + 1e-9), c = Math.log(B[kp + 1] + 1e-9), den = a - 2 * b + c, d = den ? .5 * (a - c) / den : 0, cents = Math.abs(1200 * Math.log2(((kp + d) * bh) / f));
      if (cents > 32) continue; const r = pk / (nf * 5); if (r > 1) { hit++; if (h <= 2) low++; } s += wts[h - 1] * Math.log2(1 + r) * (1 - cents / 80);
    }
    return { s, hit, low };
  };
  /* the pitch classes of the new energy, for naming a chord when the notes alone are too few (partials make this blurry, which is why it is only a second opinion) */
  const chroma = new Float32Array(12); for (let k = Math.ceil(70 / bh); k < Math.min(n2 - 1, Math.floor(1800 / bh)); k++) { const m = ftom(k * bh), pc = (((Math.round(m)) % 12) + 12) % 12, w = B[k] * B[k] * (1 / (1 + k * bh / 900)); chroma[pc] += w; }
  const out = []; let first = 0; if (o.probe) o.probeOut = o.probe.map(m => ({ m, ...sal(m) }));
  for (let it = 0; it < (o.max || 6); it++) {
    let best = null; for (const m of cand) { const r = sal(m); if (r.hit >= 2 && r.low >= 1 && (!best || r.s > best.s)) best = { m, s: r.s }; }
    if (!best || best.s < (o.minSal || 3.4)) break;
    if (it === 0) first = best.s; else if (best.s < (o.rel || .3) * first) break;
    out.push({ midi: best.m, sal: best.s });
    /* take that note's partials out of the spectrum (the shape of one window's main lobe at each), so what is left is the other notes */
    const f0 = mtof(best.m); for (let h = 1; h <= 12; h++) {
      const kc = f0 * h / bh; if (kc > n2 - 3) break; const wn = Math.max(wl, Math.round(kc * .025)); let pk = 0, kp = -1;
      for (let k = Math.max(1, Math.round(kc) - wn); k <= Math.min(n2 - 2, Math.round(kc) + wn); k++) if (B[k] > pk) { pk = B[k]; kp = k; }
      if (kp < 0) continue; for (let k = Math.max(0, kp - wl); k <= Math.min(n2 - 1, kp + wl); k++) { const c = Math.cos(Math.PI * (k - kp) / (2 * wl)); B[k] = Math.max(0, B[k] - pk * c * c); }
    }
  }
  out.sort((a, b) => a.midi - b.midi); out.chroma = chroma; return out;
}
/** several notes → distinct strings, frets close together, low notes on low strings: [{ st, f, midi }] */
function capAssign(midis) {
  const ms = [...new Set(midis)].sort((a, b) => a - b).slice(0, 6), opts = [], keep = [];
  ms.forEach(m => { const c = []; S.tuning.forEach((o, st) => { const f = m - o - S.capo; if (f >= 0 && f <= 22) c.push({ st, f, midi: m, k: Math.abs(f - CAP.lastFret) + (f > 12 ? 3 : 0) }); }); if (c.length) { c.sort((a, b) => a.k - b.k); opts.push(c.slice(0, 4)); keep.push(m); } });
  const n = opts.length; if (!n) return []; let best = null, bc = 1e9; const used = new Array(S.tuning.length).fill(false), pick = [];
  const cost = () => {
    const fr = pick.filter(p => p.f > 0).map(p => p.f), span = fr.length ? Math.max(...fr) - Math.min(...fr) : 0; let c = span * 2 + (span > 4 ? 25 : 0);
    const mean = fr.length ? fr.reduce((a, b) => a + b, 0) / fr.length : 0; c += Math.abs(mean - CAP.lastFret) * .2 + mean * .1 - pick.filter(p => p.f === 0).length * .6;
    for (let i = 0; i < pick.length; i++) for (let j = i + 1; j < pick.length; j++) if (pick[i].midi < pick[j].midi && pick[i].st > pick[j].st) c += 4; return c;
  };
  const go = i => { if (i === n) { const c = cost(); if (c < bc) { bc = c; best = pick.map(p => ({ ...p })); } return; } for (const o of opts[i]) { if (used[o.st]) continue; used[o.st] = true; pick.push(o); go(i + 1); pick.pop(); used[o.st] = false; } };
  go(0); return best || [];
}
/** a chord name for these notes, or null when they do not make a clear chord */
function capName(midis) {
  const pcs = [...new Set(midis.map(m => ((m % 12) + 12) % 12))]; if (pcs.length < 3) return null; const low = ((Math.min(...midis) % 12) + 12) % 12, ch = new Float32Array(12); pcs.forEach(p => { ch[p] = p === low ? 1.25 : 1; });
  const d = detectChord(ch); return d.length && d[0].score > .88 ? d[0].sym : null;
}
/** the library shape for that chord when most of what was heard is in it, at the same pitches */
function capShape(midis, sym) {
  if (!sym) return null; const det = new Set(midis); let best = null, bs = -1e9; const pref = S.voicePref && S.voicePref[sym] || 0;
  voicings(sym, S.tuning, S.capo, 12).forEach((v, idx) => {
    const vm = v.frets.map((f, i) => f == null ? null : S.tuning[i] + S.capo + f).filter(x => x != null), ov = vm.filter(m => det.has(m)).length, need = Math.max(2, Math.min(3, det.size), Math.ceil(.75 * det.size));
    if (ov < need || vm.length > det.size + 3) return; const sc = ov * 10 - idx * .5 + (idx === pref ? 3 : 0); if (sc > bs) { bs = sc; best = v; }          // most of what was heard first, then the shape the song already prefers, then the library's order
  });
  return best ? best.frets.map((f, i) => f == null ? null : { st: i, f, midi: S.tuning[i] + S.capo + f }).filter(Boolean) : null;
}

/* ---------- writing into the tab ---------- */
function capSlotAt(onT) { return Math.round(slotAtTime(onT - rttMs() / 1000)); }
/** put `items` [{st, f}] at an absolute slot; what was already in that slot is replaced by what was heard */
function capPut(slot, items, o = {}) {
  const sp = spb(), gi = Math.floor(slot / sp), sib = slot - gi * sp, fb = flatBars()[gi]; if (!fb || slot < 0 || !items.length) return false;
  const tk = gi + ':' + CX.pass; if (CAP.replace && !CX.touched.has(tk)) { CX.touched.add(tk); fb.bar.tab = []; }
  fb.bar.tab = fb.bar.tab.filter(n => n.s !== sib); items.forEach(it => fb.bar.tab.push({ s: sib, st: it.st, f: it.f, t: '' }));
  if (o.sym && CAP.nameChords && !fb.bar.chord) fb.bar.chord = o.sym;
  const fr = items.filter(i => i.f > 0); if (fr.length) CAP.lastFret = Math.round(fr.reduce((a, i) => a + i.f, 0) / fr.length); CAP.lastSt = items[0].st;
  CAP.count += items.length; CX.writes++; if (items.length > 1) CX.chords++;
  commit(false); bus.emit('capnote', { gi, si: fb.si, bi: fb.bi, sib, items }); return true;
}
const capLabel = m => tunPc(m) + (Math.floor(m / 12) - 1);
function capSay(txt, st) { CX.say = txt; CX.saySt = st || ''; CX.sayAt = performance.now(); CX.log.push(txt); if (CX.log.length > 8) CX.log.shift(); bus.emit('capsay'); }
/** what to write for these notes: one note, a library chord shape that matches what was heard, or the nearest playable fingering (pure: writes nothing) */
function capInterpret(midis, chroma) {
  if (!midis.length) return null;
  if (midis.length === 1) { const a = assignFret(midis[0]); return a ? { items: [{ st: a.st, f: a.f, midi: midis[0] }], sym: null, shape: false } : null; }
  let sym = capName(midis);
  if (!sym && chroma) { const t = chroma.reduce((a, b) => a + b, 0) || 1, ch = Array.from(chroma, v => v / t), d = detectChord(ch); if (d.length && d[0].score > .9) sym = d[0].sym; }
  const shape = capShape(midis, sym), items = shape || capAssign(midis); return items.length ? { items, sym, shape: !!shape } : null;
}
/** one analysed attack → written to the tab */
function capCommit(notes, onT) {
  CX.evalT = onT; if (!notes.length) { capSay('Heard something, but no clear note', 'dim'); return false; }
  const slot = capSlotAt(onT); if (slot < 0) return false; const midis = notes.map(n => n.midi);
  /* the same single note, found again right after it was written, is a note still ringing (or its second bump), not a new one */
  if (midis.length === 1 && CX.lastNotes && CX.lastNotes.length === 1 && CX.lastNotes[0] === midis[0] && onT - (CX.lastT || -9) < .3) return false;
  CX.lastNotes = midis; CX.lastT = onT; CX.recent = (CX.recent || []).filter(r => onT - r.t < 1.2).concat(midis.map(m => ({ m, t: onT }))); const r = capInterpret(midis, notes.chroma);
  if (!r) { capSay(capLabel(midis[0]) + ' is outside this guitar', 'dim'); return false; }
  capPut(slot, r.items, { sym: r.sym });
  capSay(r.items.length === 1 ? capLabel(midis[0]) + ' → string ' + (r.items[0].st + 1) + ', fret ' + r.items[0].f : (r.sym ? r.sym + ': ' : '') + r.items.map(i => capLabel(i.midi)).join(' '), 'ok'); return true;
}

/* ---------- listening: attacks, the window after each, the fallbacks ---------- */
function capOnset(t, src) {
  if (!CAP.on || !T.playing) return; const min = src === 'flux' ? .22 : .09; if (t - CX.lastOn < min) return; CX.lastOn = t;
  if (CX.pend) { const p = CX.pend; CX.pend = null; try { capEval(p, t - .004); } catch (e) { console.warn(e); } }         // the next attack closes the last one's window
  CX.pend = { t, due: performance.now() + 140 };
}
/** read the window from just after the attack (`p.t`) to now, or to `endT` when another attack came first, and write what is in it */
function capEval(p, endT) {
  if (!E.anaPoly || !E.ctx) return; const sr = E.ctx.sampleRate, len = E.anaPoly.fftSize, buf = new Float32Array(len); E.anaPoly.getFloatTimeDomainData(buf); const now = E.ctx.currentTime;
  const on = len - Math.round(Math.max(0, now - p.t) * sr), a = on + Math.round(.012 * sr), end = endT == null ? len : len - Math.round(Math.max(0, now - endT) * sr);
  if (end - a < Math.round(.045 * sr)) return; const post = buf.subarray(Math.max(0, a), Math.min(len, end)), pre = buf.subarray(Math.max(0, on - Math.round(.1 * sr)), Math.max(0, on - Math.round(.006 * sr)));
  let e = 0; for (let i = 0; i < post.length; i++) e += post[i] * post[i]; const rms = dB(Math.sqrt(e / post.length)); if (rms < (CFG.gateDb != null ? CFG.gateDb : -56)) { capSay('Too quiet to read: raise your input level', 'dim'); return; }
  capCommit(capNotes(post, pre, sr), p.t);
}
/** called on every analysis frame (33 ms) while capturing */
function capTick() {
  if (!CAP.on) return; const now = performance.now();
  if (CX.pend && now >= CX.pend.due) { const p = CX.pend; CX.pend = null; try { capEval(p); } catch (e) { console.warn(e); } }
  // an energy jump counts as an attack too (soft playing, or a note over a ring), when the input's own detector missed it
  const r = CX.rmsRing; if (AN.active && r.length >= 4) { const base = Math.min(...r.slice(-5)); if (AN.rms - base >= 4.5 && E.ctx) capOnset(E.ctx.currentTime - .03, 'flux'); } r.push(AN.rms); if (r.length > 8) r.shift();
  if (AN.active) CX.heard = true;
  if (!CX.heard && !CX.warned && now - CX.t0 > 5000 && T.playing) { CX.warned = true; capSay('Nothing is coming in. Is your guitar plugged in and the input level up?', 'bad'); toast('Capture is on but nothing is coming in. Check your guitar and the input level (Audio, top right).', 'warn'); }
}
/** the single-note tracker found a note; used only when no attack opened a window for it */
function capHeardNote(midi, onT) { if (Math.abs(onT - CX.evalT) < .2 || (CX.pend && Math.abs(CX.pend.t - onT) < .2)) return; if ((CX.recent || []).some(r => r.m === midi && onT - r.t < .9)) return; /* already written from its attack: the tracker is just late */ CX.evalT = onT; capCommit([{ midi }], onT); }
function capWrap() { if (!CAP.on) return; CX.pass++; }

/* ---------- starting and stopping ---------- */
const capBarStart = (si, bi) => (S.sections.slice(0, si).reduce((a, s) => a + s.bars.length, 0) + bi) * spb();
async function capStart() {
  if (CAP.on) return true;
  try { await startAudio(); } catch (e) { toast('Audio could not start: ' + e.message, 'bad'); return false; }
  if (!E.hasInput) { toast('Connect your guitar or microphone first (Audio at the top right), then press Capture.', 'warn'); try { audioOpen(); } catch (e) { } return false; }
  if (!S.sections.length) { toast('Add a section first', 'warn'); return false; }
  CX.before = snap(); CX.touched = new Set(); CX.pass = 0; CX.pend = null; CX.lastOn = -9; CX.heard = false; CX.warned = false; CX.t0 = performance.now(); CX.writes = 0; CX.chords = 0; CX.log = []; CX.rmsRing = []; CX.recent = []; CX.lastNotes = null; CX.lastT = -9; CAP.count0 = CAP.count;
  CX.prevLoop = [T.loop, T.loopA, T.loopB]; CX.started = !T.playing; CAP.on = true;
  if (!T.playing) {
    const si = clamp(TE.sec, 0, S.sections.length - 1), bi = clamp(TE.bi, 0, S.sections[si].bars.length - 1), a = capBarStart(si, 0), b = a + S.sections[si].bars.length * spb();
    T.cursor = capBarStart(si, bi);
    if (CAP.loop) { T.loop = true; T.loopA = a; T.loopB = b; }
    if (CFG.countIn < 1) CX.cin = CFG.countIn, CFG.countIn = 1; T.metro = true;
  }
  capSay(CX.started ? 'Counting you in…' : 'Listening…', 'ok'); bus.emit('capture');
  if (CX.started) { try { await play(); } catch (e) { console.warn(e); } if (!T.playing) { CAP.on = false; bus.emit('capture'); return false; } }
  return true;
}
function capStop(why) {
  if (!CAP.on) return false; CAP.on = false; CX.pend = null; const n = CAP.count - (CAP.count0 || 0), ch = CX.chords;
  if (CX.cin != null) { CFG.countIn = CX.cin; CX.cin = null; }
  if (CX.prevLoop) { [T.loop, T.loopA, T.loopB] = CX.prevLoop; CX.prevLoop = null; }
  if (CX.started && T.playing && why !== 'transport') stopPlay(true);
  CX.started = false; let undo = false; try { undo = n > 0 && histPush(CX.before); } catch (e) { console.warn(e); } CX.before = null;
  capSay(n ? n + ' note' + (n === 1 ? '' : 's') + ' written' + (ch ? ' (' + ch + ' chord' + (ch === 1 ? '' : 's') + ')' : '') : 'Nothing was written', n ? 'ok' : 'dim');
  toast(n ? 'Capture stopped: ' + n + ' note' + (n === 1 ? '' : 's') + ' in the tab. Undo (Ctrl/⌘+Z) takes the whole capture back.' : 'Capture stopped. Nothing was heard clearly enough to write. Is the input level up?', n ? 'ok' : 'warn');
  TL.dirty = true; bus.emit('capture'); return true;
}
const capToggle = () => CAP.on ? capStop() : capStart();
bus.on('transport', () => { if (CAP.on && !T.playing) capStop('transport'); });
/** for the screen: is it on, what it just did, how loud the input is */
function capInfo() { return { on: !!CAP.on, text: CX.say, st: CX.saySt, count: CAP.count - (CAP.count0 || 0), level: AN.rms, active: !!AN.active, midi: AN.midi, heard: CX.heard }; }
