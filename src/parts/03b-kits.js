/* ============================================================
   Part 03b · DRUM MACHINES AND THE 808 SUB (2.42) — the modern kits, synthesised the way the classic machines made their sounds
   2.42 also rebuilds the acoustic kits (Acoustic, Rock Room, Brush) the same way, with a small room around them.
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
  /* 2.42: the acoustic kits, played the same way: a beater, a head and a shell; tuned shell tones and snare wires; hats of metal and noise;
     a rim click; toms with a stick; every drum into a small room; and hits that are never quite the same twice */
  'Acoustic': { engine: 1, human: 1, k: { f0: 112, f1: 54, pt: .045, dec: .42, drive: 1.5, click: .32, lvl: 1, body: .32, room: .1 }, s: { t: [188, 322], td: .12, n: 3800, nd: .24, nl: .72, clap: 0, room: .2 }, h: { tune: 1.45, cd: .05, od: .55, noise: .9, room: .05 }, c: { f: 1100, tail: .12, rim: 1, room: .12 }, t: { f0: 150, f1: 98, dec: .5, stick: .12, room: .18 } },
  'Rock Room': { engine: 1, human: 1, k: { f0: 122, f1: 50, pt: .04, dec: .52, drive: 2.2, click: .5, lvl: 1.05, body: .4, room: .28 }, s: { t: [178, 300], td: .14, n: 3400, nd: .3, nl: .88, clap: 0, room: .45, drive: 2 }, h: { tune: 1.35, cd: .06, od: .7, noise: 1, room: .12 }, c: { f: 1100, tail: .12, rim: 1, room: .3 }, t: { f0: 135, f1: 82, dec: .62, stick: .18, room: .4 } },
  'Brush (soft)': { engine: 1, human: 1, k: { f0: 96, f1: 55, pt: .05, dec: .3, drive: 1.1, click: .07, lvl: .9, body: .25, room: .08 }, s: { t: [200, 330], td: .08, n: 2400, nd: .34, nl: .5, clap: 0, brush: 1, room: .14 }, h: { tune: 1.5, cd: .08, od: .45, noise: 1, dark: 7500, lvl: .6, room: .06 }, c: { f: 1100, tail: .1, rim: 1, soft: 1, room: .1 }, t: { f0: 160, f1: 120, dec: .4, stick: .05, room: .12 } },
  '808': { engine: 1, k: { f0: 150, f1: 48, pt: .07, dec: 1.15, drive: 2.4, click: .18, lvl: 1 }, s: { t: [185, 330], td: .11, n: 1800, nd: .17, nl: .55, clap: .35 }, h: { tune: 1, cd: .05, od: .42, noise: 0 }, c: { f: 1100, tail: .2 }, t: { f0: 150, f1: 95, dec: .38 } },
  '909': { engine: 1, k: { f0: 240, f1: 52, pt: .035, dec: .48, drive: 3, click: .45, lvl: 1 }, s: { t: [195, 290], td: .1, n: 4200, nd: .24, nl: .8, clap: 0 }, h: { tune: 1.3, cd: .045, od: .32, noise: .5 }, c: { f: 1300, tail: .16 }, t: { f0: 200, f1: 120, dec: .28 } },
  'Boom Bap': { engine: 1, k: { f0: 125, f1: 50, pt: .05, dec: .42, drive: 1.9, click: .3, lvl: 1.05, dusty: 1 }, s: { t: [205, 340], td: .09, n: 2600, nd: .2, nl: .7, clap: .15, dusty: 1 }, h: { tune: .85, cd: .06, od: .3, noise: .35, dusty: 1 }, c: { f: 1000, tail: .14 }, t: { f0: 180, f1: 140, dec: .2 } }
});
INST['808 Sub'] = INST.Sub;      /* a pluck stands in where the 808 cannot play (a quick preview) */
const BASS_TONES = ['Round', 'Sub', '808 Sub', 'Pick', 'Muted Pluck'];
const KIT_HAT = [205.3, 304.4, 369.6, 522.7, 540, 800];      /* the six square-wave pitches of the classic metallic hat, in Hz */
const DMK = { open: null, curve: null, room: null };
/** a soft-clip curve (tanh), made once */
function kitCurve() { if (DMK.curve) return DMK.curve; const n = 2048, cu = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; cu[i] = Math.tanh(x * 2.6) / Math.tanh(2.6); } return DMK.curve = cu; }
function kitShaper(drive) { const c = E.ctx, pre = gn(drive), ws = c.createWaveShaper(), post = gn(1 / Math.sqrt(drive)); ws.curve = kitCurve(); ws.oversample = '2x'; pre.connect(ws); ws.connect(post); return { in: pre, out: post }; }
/** an envelope: up in a.. seconds, down to silence over dec */
function kitEnv(g, t, peak, dec, a) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + (a || .002)); g.gain.exponentialRampToValueAtTime(.0001, t + dec); }
function kitNoise(t, dur, dest) { return nz(t, dur, dest); }
/** the drums' room: a short reverb made in the page (decaying noise with a few early reflections), one per audio context */
function kitRoom(c) {
  if (DMK.room && DMK.room.ctx === c) return DMK.room.in;
  const sr = c.sampleRate, len = Math.floor(sr * .9), ir = c.createBuffer(2, len, sr); let seed = 11;
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const w = seed / 2147483648 - 1; lp += (w - lp) * (.55 - .4 * i / len); d[i] = lp * Math.exp(-i / (sr * .22)); }
    [.011, .019, .027, .041].forEach((e, k) => { const n = Math.floor(e * sr * (1 + ch * .07)); if (n < len) d[n] += (.5 - k * .1) * (ch ? -1 : 1); }); }
  const cv = c.createConvolver(), inG = gn(.55); cv.buffer = ir; inG.connect(cv); cv.connect(E.tr.drums.in); DMK.room = { ctx: c, in: inG }; return inG;
}
/** send a sound to the room as well */
const kitSend = (node, amt) => { if (!amt) return; const g = gn(amt); node.connect(g); g.connect(kitRoom(E.ctx)); };
/** a hit from a kit with an engine (part 03's drumHit hands it over) */
function kitHit(K, row, t, v) {
  const c = E.ctx, out = E.tr.drums.in; let vol = [0, .45, .82, 1.08][v] || .8;
  if (K.human) { vol *= 1 + (Math.random() - .5) * .14; t += (Math.random() - .5) * .004; }      /* a drummer never hits twice the same */
  const dusty = (x, f) => x.dusty ? bq('lowpass', f || 7000, .5) : null;
  if (row === 0) {      /* kick: beater, head and shell */
    const P = K.k, o = c.createOscillator(), g = gn(0), sh = kitShaper(P.drive); o.type = 'sine';
    o.frequency.setValueAtTime(P.f0, t); o.frequency.exponentialRampToValueAtTime(P.f1, t + P.pt); o.frequency.exponentialRampToValueAtTime(P.f1 * .94, t + P.dec);
    kitEnv(g, t, .9 * vol * P.lvl, P.dec, .003); o.connect(g); g.connect(sh.in);
    const lp = dusty(P, 3200); if (lp) { sh.out.connect(lp); lp.connect(out); } else sh.out.connect(out);
    o.start(t); o.stop(t + P.dec + .05);
    if (P.body) { const b = c.createOscillator(), bg = gn(0); b.frequency.setValueAtTime(P.f1 * 1.62, t); b.frequency.exponentialRampToValueAtTime(P.f1 * 1.45, t + .2); kitEnv(bg, t, P.body * vol, .2); b.connect(bg); bg.connect(sh.in); b.start(t); b.stop(t + .25); }
    const cg = gn(0), hp = bq('highpass', 1800); kitEnv(cg, t, P.click * vol, .012, .0008); kitNoise(t, .015, hp); hp.connect(cg); cg.connect(out);
    kitSend(sh.out, P.room);
  } else if (row === 1) {      /* snare: shell tones and wires (or a brush) */
    const P = K.s, sh = kitShaper(P.drive || (P.dusty ? 2.2 : 1.4)), bus = gn(1); bus.connect(sh.in); const lp = dusty(P, 6500); if (lp) { sh.out.connect(lp); lp.connect(out); } else sh.out.connect(out);
    const ghost = v === 1, td = P.td * (ghost ? .7 : 1);
    P.t.forEach((f, i) => { const o = c.createOscillator(), g = gn(0); o.type = i ? 'triangle' : 'sine'; o.frequency.setValueAtTime(f * 1.08, t); o.frequency.exponentialRampToValueAtTime(f, t + .02); kitEnv(g, t, (i ? .22 : .38) * vol * (P.brush ? .35 : 1), td); o.connect(g); g.connect(bus); o.start(t); o.stop(t + td + .03); });
    const ng = gn(0), hp = bq('highpass', P.brush ? 900 : P.n * .6), bp = bq('bandpass', P.n, P.brush ? .5 : .6), nd = P.nd * (ghost ? .6 : 1);
    kitEnv(ng, t, P.nl * vol, nd, P.brush ? .018 : .002); kitNoise(t, nd, hp); chainN(hp, bp, ng); ng.connect(bus);
    if (P.clap) kitClap(K, t + .004, vol * P.clap, out);
    kitSend(sh.out, P.room);
  } else if (row === 2 || row === 3) {      /* hats: metal (and noise); the closed one chokes the open one */
    const P = K.h, open = row === 3, dec = (open ? P.od : P.cd) * (v === 1 ? .7 : 1), g = gn(0), bp = bq('bandpass', 10000 * Math.min(1.1, P.tune), .9), hp = bq('highpass', 7000), hp2 = bq('highpass', 6000), mix = gn(.3);      /* two high-passes: no clank from the squares' low tones */
    if (DMK.open && !open && DMK.open.t < t) { try { DMK.open.g.gain.cancelScheduledValues(t); DMK.open.g.gain.setTargetAtTime(.0001, t, .008); } catch (e) { } DMK.open = null; }
    KIT_HAT.forEach(f => { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f * P.tune; o.connect(mix); o.start(t); o.stop(t + dec + .03); });
    mix.connect(bp); if (P.noise) { const ng = gn(P.noise); kitNoise(t, dec, ng); ng.connect(bp); }
    kitEnv(g, t, (open ? .5 : .42) * vol * (P.lvl || 1), dec, .001); chainN(bp, hp, hp2, g);
    const lp = P.dark ? bq('lowpass', P.dark, .5) : dusty(P, 9000); if (lp) { g.connect(lp); lp.connect(out); } else g.connect(out);
    kitSend(g, P.room); if (open) DMK.open = { g, t };
  } else if (row === 4) { if (K.c.rim) kitRim(K, t, vol, out); else kitClap(K, t, vol, out); }      /* clap, or a rim click on a real kit */
  else {      /* tom (with a stick on the head) */
    const P = K.t, o = c.createOscillator(), g = gn(0); o.frequency.setValueAtTime(P.f0, t); o.frequency.exponentialRampToValueAtTime(P.f1, t + P.dec * .6); kitEnv(g, t, .6 * vol, P.dec); o.connect(g); g.connect(out); o.start(t); o.stop(t + P.dec + .05);
    if (P.stick) { const sg = gn(0), bp = bq('bandpass', 2600, .8); kitEnv(sg, t, P.stick * vol, .03, .0008); kitNoise(t, .035, bp); bp.connect(sg); sg.connect(out); }
    kitSend(g, P.room);
  }
}
/** a clap: four bursts of band-passed noise a hand's width apart, then the room */
function kitClap(K, t, vol, out) {
  const P = K.c, g = gn(0), bp = bq('bandpass', P.f, 1.1), hp = bq('highpass', 600); kitNoise(t, .06 + P.tail, hp); chainN(hp, bp, g); g.connect(out);
  g.gain.setValueAtTime(.0001, t);
  [0, .011, .023, .034].forEach((d, i) => { g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.75 * vol, t + d + .001); g.gain.exponentialRampToValueAtTime(i < 3 ? .05 : .4 * vol, t + d + .009); });
  g.gain.exponentialRampToValueAtTime(.0001, t + .045 + P.tail);
}
/** a rim click (cross-stick): a hard, short knock of wood and metal */
function kitRim(K, t, vol, out) {
  const P = K.c, s = P.soft ? .55 : 1, o = c0 => { const x = E.ctx.createOscillator(); x.type = 'triangle'; x.frequency.setValueAtTime(c0, t); return x; };
  const a = o(1650), b = o(480), g = gn(0), g2 = gn(0); kitEnv(g, t, .28 * vol * s, .025, .0005); kitEnv(g2, t, .32 * vol * s, .045, .0008); a.connect(g); b.connect(g2); g.connect(out); g2.connect(out); a.start(t); b.start(t); a.stop(t + .05); b.stop(t + .07);
  const ng = gn(0), bp = bq('bandpass', 2300, 1.4); kitEnv(ng, t, .3 * vol * s, .035, .0005); kitNoise(t, .04, bp); bp.connect(ng); ng.connect(out); kitSend(g2, P.room);
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
