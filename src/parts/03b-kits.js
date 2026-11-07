/* ============================================================
   Part 03b · DRUM MACHINES AND THE 808 SUB (2.42) — the modern kits, synthesised the way the classic machines made their sounds
   No samples: every hit is built from oscillators and the band's noise buffer, so nothing is downloaded or licensed, and it costs
   a few kilobytes. Each kit with an `engine` is played here instead of by the plain kit in part 03:
     808       a long sub kick (a sine falling from about 150 to 48 Hz, held, then saturated so phones can hear it), a snare of two
               tuned tones and a burst of noise, hats from six square waves at inharmonic pitches through a band-pass (the metallic
               "tss" comes from that, not from noise), an open hat that the closed one chokes, a clap of four quick bursts and a tail
     909       a short punchy kick with a click, a brighter snare with more noise, hats of metal and noise together
     Boom Bap  a round, dusty kick and a fat snare, both through a soft saturator, rounded-off hats
   The 808 sub is a bass sound for the band's bass ("808 Sub"): a sine with a short pitch drop, saturated, held for the note,
   one note at a time; when a note starts while the last one still sounds it slides up or down to it, as 808 basslines do.
   ============================================================ */
Object.assign(KITS, {
  '808': { engine: 1, k: { f0: 150, f1: 48, pt: .07, dec: 1.15, drive: 2.4, click: .18, lvl: 1 }, s: { t: [185, 330], td: .11, n: 1800, nd: .17, nl: .55, clap: .35 }, h: { tune: 1, cd: .05, od: .42, noise: 0 }, c: { f: 1100, tail: .2 }, t: { f0: 150, f1: 95, dec: .38 } },
  '909': { engine: 1, k: { f0: 240, f1: 52, pt: .035, dec: .48, drive: 3, click: .45, lvl: 1 }, s: { t: [195, 290], td: .1, n: 4200, nd: .24, nl: .8, clap: 0 }, h: { tune: 1.3, cd: .045, od: .32, noise: .5 }, c: { f: 1300, tail: .16 }, t: { f0: 200, f1: 120, dec: .28 } },
  'Boom Bap': { engine: 1, k: { f0: 125, f1: 50, pt: .05, dec: .42, drive: 1.9, click: .3, lvl: 1.05, dusty: 1 }, s: { t: [205, 340], td: .09, n: 2600, nd: .2, nl: .7, clap: .15, dusty: 1 }, h: { tune: .85, cd: .06, od: .3, noise: .35, dusty: 1 }, c: { f: 1000, tail: .14 }, t: { f0: 180, f1: 140, dec: .2 } }
});
INST['808 Sub'] = INST.Sub;      /* a pluck stands in where the 808 cannot play (a quick preview) */
const BASS_TONES = ['Round', 'Sub', '808 Sub', 'Pick', 'Muted Pluck'];
const KIT_HAT = [205.3, 304.4, 369.6, 522.7, 540, 800];      /* the six square-wave pitches of the classic metallic hat, in Hz */
const DMK = { open: null, curve: null };
/** a soft-clip curve (tanh), made once */
function kitCurve() { if (DMK.curve) return DMK.curve; const n = 2048, cu = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; cu[i] = Math.tanh(x * 2.6) / Math.tanh(2.6); } return DMK.curve = cu; }
function kitShaper(drive) { const c = E.ctx, pre = gn(drive), ws = c.createWaveShaper(), post = gn(1 / Math.sqrt(drive)); ws.curve = kitCurve(); ws.oversample = '2x'; pre.connect(ws); ws.connect(post); return { in: pre, out: post }; }
/** an envelope: up in a.. seconds, down to silence over dec */
function kitEnv(g, t, peak, dec, a) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + (a || .002)); g.gain.exponentialRampToValueAtTime(.0001, t + dec); }
function kitNoise(t, dur, dest) { return nz(t, dur, dest); }
/** a hit from a kit with an engine (part 03's drumHit hands it over) */
function kitHit(K, row, t, v) {
  const c = E.ctx, vol = [0, .45, .82, 1.08][v] || .8, out = E.tr.drums.in, dusty = (x, f) => { if (!x.dusty) return null; const lp = bq('lowpass', f || 7000, .5); return lp; };
  if (row === 0) {      /* kick */
    const P = K.k, o = c.createOscillator(), g = gn(0), sh = kitShaper(P.drive); o.type = 'sine';
    o.frequency.setValueAtTime(P.f0, t); o.frequency.exponentialRampToValueAtTime(P.f1, t + P.pt); o.frequency.exponentialRampToValueAtTime(P.f1 * .94, t + P.dec);
    kitEnv(g, t, .9 * vol * P.lvl, P.dec, .003); o.connect(g); g.connect(sh.in);
    const lp = dusty(P, 3200); if (lp) { sh.out.connect(lp); lp.connect(out); } else sh.out.connect(out);
    o.start(t); o.stop(t + P.dec + .05);
    const cg = gn(0), hp = bq('highpass', 1800); kitEnv(cg, t, P.click * vol, .012, .0008); kitNoise(t, .015, hp); hp.connect(cg); cg.connect(out);
  } else if (row === 1) {      /* snare */
    const P = K.s, sh = kitShaper(P.dusty ? 2.2 : 1.4), bus = gn(1); bus.connect(sh.in); const lp = dusty(P, 6500); if (lp) { sh.out.connect(lp); lp.connect(out); } else sh.out.connect(out);
    P.t.forEach((f, i) => { const o = c.createOscillator(), g = gn(0); o.type = i ? 'triangle' : 'sine'; o.frequency.setValueAtTime(f * 1.08, t); o.frequency.exponentialRampToValueAtTime(f, t + .02); kitEnv(g, t, (i ? .22 : .38) * vol, P.td); o.connect(g); g.connect(bus); o.start(t); o.stop(t + P.td + .03); });
    const ng = gn(0), hp = bq('highpass', P.n * .6), bp = bq('bandpass', P.n, .6); kitEnv(ng, t, P.nl * vol, P.nd); kitNoise(t, P.nd, hp); chainN(hp, bp, ng); ng.connect(bus);
    if (P.clap) kitClap(K, t + .004, vol * P.clap, out);
  } else if (row === 2 || row === 3) {      /* hats: closed chokes open */
    const P = K.h, open = row === 3, dec = open ? P.od : P.cd, g = gn(0), bp = bq('bandpass', 10000 * Math.min(1.1, P.tune), .9), hp = bq('highpass', 7000), hp2 = bq('highpass', 6000), mix = gn(.3);      /* two high-passes: no clank from the squares' low tones */
    if (DMK.open && !open && DMK.open.t < t) { try { DMK.open.g.gain.cancelScheduledValues(t); DMK.open.g.gain.setTargetAtTime(.0001, t, .008); } catch (e) { } DMK.open = null; }
    KIT_HAT.forEach(f => { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f * P.tune; o.connect(mix); o.start(t); o.stop(t + dec + .03); });
    mix.connect(bp); if (P.noise) { const ng = gn(P.noise); kitNoise(t, dec, ng); ng.connect(bp); }
    kitEnv(g, t, (open ? .5 : .42) * vol, dec, .001); chainN(bp, hp, hp2, g);
    const lp = dusty(P, 9000); if (lp) { g.connect(lp); lp.connect(out); } else g.connect(out);
    if (open) DMK.open = { g, t };
  } else if (row === 4) kitClap(K, t, vol, out);      /* clap */
  else {      /* tom / perc */
    const P = K.t, o = c.createOscillator(), g = gn(0); o.frequency.setValueAtTime(P.f0, t); o.frequency.exponentialRampToValueAtTime(P.f1, t + P.dec * .6); kitEnv(g, t, .6 * vol, P.dec); o.connect(g); g.connect(out); o.start(t); o.stop(t + P.dec + .05);
  }
}
/** a clap: four bursts of band-passed noise a hand's width apart, then the room */
function kitClap(K, t, vol, out) {
  const P = K.c, g = gn(0), bp = bq('bandpass', P.f, 1.1), hp = bq('highpass', 600); kitNoise(t, .06 + P.tail, hp); chainN(hp, bp, g); g.connect(out);
  g.gain.setValueAtTime(.0001, t);
  [0, .011, .023, .034].forEach((d, i) => { g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.75 * vol, t + d + .001); g.gain.exponentialRampToValueAtTime(i < 3 ? .05 : .4 * vol, t + d + .009); });
  g.gain.exponentialRampToValueAtTime(.0001, t + .045 + P.tail);
}
/* ---------- the 808 sub ---------- */
/** one 808 bass note at time t: midi m, velocity v, held about `dur` seconds; slides from the last note if that one is still ringing */
function sub808(t, m, v, dur) {
  const c = E.ctx; if (!c) return; if (m >= 40) m -= 12;      /* down where an 808 lives */
  const f = mtof(m), len = clamp((dur || .5) + .3, .4, 2.6), prev = E.sub808, slide = prev && prev.end > t + .02 && t - prev.t > .04 && Math.abs(prev.m - m) <= 12;
  if (prev && prev.end > t) { try { prev.g.gain.cancelScheduledValues(t); prev.g.gain.setTargetAtTime(.0001, t, slide ? .02 : .008); prev.o.stop(t + .2); } catch (e) { } }
  const o = c.createOscillator(), o2 = c.createOscillator(), g = gn(0), g2 = gn(.1), sh = kitShaper(2.8), lp = bq('lowpass', 2400, .6);
  o.type = 'sine'; o2.type = 'triangle';
  if (slide) { o.frequency.setValueAtTime(mtof(prev.m), t); o.frequency.exponentialRampToValueAtTime(f, t + .09); } else { o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + .035); }
  o2.frequency.setValueAtTime(f * 2, t); o.connect(g); o2.connect(g2); g2.connect(g);
  const pk = .85 * clamp(v, .2, 1); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(pk, t + (slide ? .02 : .004)); g.gain.setValueAtTime(pk, t + Math.max(.05, len * .45)); g.gain.exponentialRampToValueAtTime(.0001, t + len);
  const lvl = gn(.36); g.connect(sh.in); sh.out.connect(lp); lp.connect(lvl); lvl.connect(E.tr.bass.in);      /* a held, saturated sine is dense: sit it with the kit, under a voice */ o.start(t); o2.start(t); o.stop(t + len + .05); o2.stop(t + len + .05);
  E.sub808 = { o, g, t, m, end: t + len };
}
