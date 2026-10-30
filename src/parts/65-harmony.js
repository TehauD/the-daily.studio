/* ============================================================
   Part 65 · Harmony state: what the ten harmony looks (part 66) all draw from.
   One place works out, once per frame: the chord that is sounding (the song's, or the one heard), how far every pitch class is from it
   (chord tone · colour · tension), what the voice and the guitar are playing and whether the line just resolved, when notes were struck and
   how far from the beat, and a record of the session (for the constellation and the painting).
   It is a simple model on purpose: "tension" is distance from the chord's own notes, with a small penalty for notes outside the key. In jazz
   a note the model calls tense can be a colour you want, so the looks call it tension, not wrong.
   Nothing here leaves the page; the session record is held in memory and lasts until the page closes or you press New session.
   ============================================================ */
const HM_MODES = new Set(['gravity', 'field', 'swarms', 'mood', 'dna', 'stars', 'fluid', 'paint']);
const HM = {
  on: 0, stamp: -1, now: 0, dt: .016,
  sym: null, chord: null, prevSym: null, chT: -99, q: { val: 0, ten: 0 }, d: new Float32Array(12), cls: new Array(12).fill('tone'),
  vm: null, vHold: 0, vc: 0, vOn: 0, vd: 0, gm: null, gd: 0, fd: 0, fPc: null, resT: -99, tenT: -99, tenNote: null,
  onsets: [], dev: 0, lastOn: -99, key: null, keyT: -99,
  stars: [], paint: [], t0: performance.now(), lastPt: 0, lastStar: 0, starOn: false, clearT: 0
};
HM.vmax = 0;
const hmHsl = (h, s, l, a) => `hsla(${((h % 360) + 360) % 360},${Math.round(s)}%,${Math.round(l)}%,${(a == null ? 1 : a).toFixed(3)})`;

/** the chord to show: the song's while it plays, else the one heard, else the song's first, else the key's own chord */
function hmChordSym() {
  if (HM.force) return HM.force;   /* a test hook: pin the chord */
  let sym = null; try { const i = stageInfo(); sym = i && i.sym; } catch (e) { }
  if (!sym && AN.active && AN.chord && AN.chord[0]) sym = AN.chord[0].sym;
  if (!sym) { try { const b = barsCache()[0]; sym = b && barChords(b.bar)[0]; } catch (e) { } }
  if (!sym) sym = pcName(S.key) + (S.minor ? 'm' : '');
  return sym;
}
/** how far a pitch class is from the chord: 0 on a chord tone, up to 1 for a harsh clash; with its class */
function hmDiss(pc, ch, inKey) {
  if (!ch) return { d: 0, c: 'tone' };
  if (ch.pcs.includes(pc)) return { d: 0, c: 'tone' };
  let near = 12; ch.pcs.forEach(t => { const x = Math.abs(((pc - t) % 12 + 12) % 12); near = Math.min(near, x, 12 - x); });
  let d = near === 1 ? .88 : near === 2 ? .3 : near === 3 ? .22 : .12;
  const rel = ((pc - ch.root) % 12 + 12) % 12, major = ch.iv.includes(4), minor = ch.iv.includes(3);
  if (rel === 5 && major && !ch.iv.includes(5)) d = Math.max(d, .62);          // the plain fourth over a major chord leans on its third
  if (rel === 6 && !ch.iv.includes(6)) d = Math.max(d, near === 1 ? d : .5);   // a tritone from the root, unless the chord has it
  if (rel === 1 || (rel === 8 && major)) d = Math.max(d, .72);
  if (!inKey) d += .14;
  d = clamp(d, 0, 1); return { d, c: d >= .5 ? 'tension' : 'colour' };
}
/** per frame: the one call every harmony look makes first */
function hmUpdate() {
  if (HM.stamp === VZ.t) return HM; HM.stamp = VZ.t; const now = performance.now(); HM.dt = Math.min(.1, (now - (HM.now || now)) / 1000); HM.now = now; HM.on = now;
  const sym = hmChordSym(), ch = parseChord(sym);
  if (sym !== HM.sym) { HM.prevSym = HM.sym; HM.sym = sym; HM.chord = ch; HM.chT = now; HM.q = ch ? lxQual(ch) : { val: 0, ten: 0 }; }
  const sc = (() => { try { return voxScale(); } catch (e) { return new Set(); } })();
  for (let pc = 0; pc < 12; pc++) { const r = hmDiss(pc, ch, sc.has(pc)); HM.d[pc] = r.d; HM.cls[pc] = r.c; }
  // the voice: held for a moment so a breath between notes does not break the picture
  if (VOX.m != null) { HM.vm = HM.vm == null ? VOX.m : lerp(HM.vm, VOX.m, .4); HM.vHold = now; HM.vc = VOX.cents; HM.vOn = 1; } else if (now - HM.vHold > 260) { HM.vm = null; HM.vOn = Math.max(0, HM.vOn - HM.dt * 4); }
  const live = AN.active && AN.midi != null ? AN.midi : null; HM.gm = live;
  HM.vd = HM.vm != null ? HM.d[((Math.round(HM.vm) % 12) + 12) % 12] : 0; HM.gd = live != null ? HM.d[((Math.round(live) % 12) + 12) % 12] : 0;
  // the note in focus: the voice when it sounds, else the lead note
  const fm = HM.vm != null ? HM.vm : live, fd = fm != null ? HM.d[((Math.round(fm) % 12) + 12) % 12] : 0, pc = fm != null ? ((Math.round(fm) % 12) + 12) % 12 : null;
  if (pc != null && fd >= .5) { HM.tenT = now; HM.tenNote = pc; }
  if (pc != null && HM.fPc != null && pc !== HM.fPc && HM.fd >= .5 && fd <= .2 && now - HM.tenT < 2500) HM.resT = now;      // a tense note let go to a stable one
  if (pc != null) { HM.fPc = pc; HM.fd = fd; } else if (now - Math.max(HM.vHold, HM.lastOn) > 1200) { HM.fPc = null; HM.fd = 0; }
  // the key, for the climate of the ecosystem
  const kk = S.key + ':' + (S.minor ? 1 : 0); if (HM.key !== kk) { if (HM.key != null) HM.keyT = now; HM.key = kk; }
  // the session record (a point about ten times a second while something sounds)
  if (now - HM.lastPt > 100 && (fm != null)) {
    HM.lastPt = now; const rootFifth = ch ? lxFifths(ch.root) : 0;
    HM.paint.push({ t: now - HM.t0, m: fm, h: lxHueOf(rootFifth), lv: clamp((AN.rms + 60) / 45, .1, 1), v: HM.vm != null ? 1 : 0, ten: ch ? HM.q.ten : 0, d: fd }); if (HM.paint.length > 9000) HM.paint.splice(0, 1500);
  }
  if (HM.vm != null) {   // a star for each sung note that holds still for a moment
    const m = HM.vm, r = Math.round(m), steady = VOX.f && VOX.f.length >= 2;
    if (steady && now - HM.lastStar > 170) { HM.lastStar = now; HM.stars.push({ t: now - HM.t0, m: r, c: (m - r) * 100, k: Math.random(), d: HM.vd }); if (HM.stars.length > 900) HM.stars.splice(0, 150); }
  }
  return HM;
}
bus.on('onset', () => {
  const now = performance.now(); HM.lastOn = now; let dev = 0, slot = -1;
  if (T.playing && E.ctx) { const ph = playheadSlot(); if (ph >= 0) { slot = ph; dev = ph - Math.round(ph); } }
  HM.onsets.push({ t: now, a: clamp((AN.rms + 55) / 40, .15, 1), slot, dev, m: AN.midi }); while (HM.onsets.length > 64) HM.onsets.shift();
  if (slot >= 0) HM.dev = lerp(HM.dev, dev, .18);
});
/** a fresh session: the sky, the painting, the creatures start again */
function hmClear() { HM.stars = []; HM.paint = []; HM.t0 = performance.now(); HM.clearT = performance.now(); HM.onsets = []; if (typeof HMX !== 'undefined') HMX.reset(); bus.emit('hm-clear'); }
