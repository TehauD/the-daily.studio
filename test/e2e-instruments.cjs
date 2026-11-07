/* Better instruments (2.45), measured from the studio's own render with one note or one chord and nothing else playing: the piano starts
   bright and mellows as it rings, strings swell in with vibrato arriving after the bow, the pad is wide, the rhythm guitar is double-tracked
   (a copy on the other side, about 14 ms later), and an acoustic guitar has more wooden body than an electric. */
const { suite } = require('./lib.cjs');

suite('e2e-instruments', async t => {
  const { ok } = t;
  const p = await t.open({ w: 1280, h: 800 }), ev = (f, a) => p.evaluate(f, a);
  const go = o => ev(async o => {
    const D = window.__daily; await D.startAudio(); D.T.metro = false; D.mstSet('off'); const B = D.S.band;
    D.S.sections = [{ id: 'x', name: 'Verse', lyrics: '', bars: [{ chord: o.chord || 'C', tab: [], keys: o.note ? [{ s: 0, m: o.note, d: 16, v: .85 }] : undefined }] }]; D.S.bpm = 60; D.S.swing = 0;
    Object.assign(B, { build: false, drumsOn: false, bassOn: false, leadOn: false, compOn: !!o.comp, compStyle: 'Down 4s', compInst: o.inst || 'Steel', keysOn: !!o.sound, keysSound: o.sound || 'Piano', keysStyle: 'Pad (held)' }); D.T.loop = false; D.T.bars = null; D.commit(false);
    const r = await D.ofrRender({ tail: 1 }), sr = r.sr, L = r.l, R = r.r; let st = 0; while (st < L.length && Math.abs(L[st]) + Math.abs(R[st]) < .002) st++;
    const band = (x, a, b, lo, hi) => { let e = 0, all = 0, l1 = 0, l2 = 0; const k1 = Math.exp(-2 * Math.PI * lo / sr), k2 = hi ? Math.exp(-2 * Math.PI * hi / sr) : 0; for (let i = st + Math.floor(a * sr); i < Math.min(x.length, st + Math.floor(b * sr)); i++) { l1 = k1 * l1 + (1 - k1) * x[i]; const hp = x[i] - l1; l2 = hi ? k2 * l2 + (1 - k2) * hp : hp; e += l2 * l2; all += x[i] * x[i]; } return { e, all, frac: e / Math.max(all, 1e-12) }; };
    const en = (a, b) => band(L, a, b, 1).all;
    const corr = (a, b) => { let xy = 0, xx = 0, yy = 0; for (let i = st + Math.floor(a * sr); i < Math.min(L.length, st + Math.floor(b * sr)); i++) { xy += L[i] * R[i]; xx += L[i] * L[i]; yy += R[i] * R[i]; } return xy / Math.sqrt(xx * yy || 1); };
    const lag = () => { const on = x => { let pk = 0; for (let i = st; i < st + .2 * sr; i++) pk = Math.max(pk, Math.abs(x[i])); for (let i = st; i < st + .2 * sr; i++) if (Math.abs(x[i]) > pk * .5) return i; return st; }; return (on(R) - on(L)) / sr * 1000; };      /* where each side's strum starts: the second take is on the right */
    const pitchSd = (a, b) => { const fs = []; for (let s = st + Math.floor(a * sr); s + 2208 < st + Math.floor(b * sr); s += 480) { const q = D.yin(L.subarray(s, s + 2208), sr, .2, 70); if (q && q.clarity > .6) fs.push(1200 * Math.log2(q.f)); } const m = fs.reduce((x, y) => x + y, 0) / Math.max(1, fs.length); return Math.sqrt(fs.reduce((x, y) => x + (y - m) * (y - m), 0) / Math.max(1, fs.length)); };
    return { ok: st < L.length, hiEarly: band(L, 0, .15, 1500).frac, hiLate: band(L, 1.5, 2.2, 1500).frac, e0: en(0, .04), e3: en(.3, .4), e1: en(1, 1.2), eE: en(0, .2), c: corr(0, 1.5), lag: lag(), sdEarly: pitchSd(.05, .35), sdLate: pitchSd(.7, 1.6), body: band(L, 0, .5, 80, 450).frac };
  }, o);
  const pi = await go({ sound: 'Piano', note: 60 });
  ok(pi.ok && pi.hiEarly > pi.hiLate * 1.5 && pi.e1 < pi.eE * 2, 'piano: bright on the hammer, mellower as it rings (' + (pi.hiEarly * 100).toFixed(1) + '% → ' + (pi.hiLate * 100).toFixed(1) + '% of it above 1.5 kHz)');
  const s = await go({ sound: 'Strings', note: 60 });
  ok(s.ok && s.e3 > s.e0 * 3, 'strings: the bow swells in (' + (10 * Math.log10(s.e3 / Math.max(s.e0, 1e-12))).toFixed(0) + ' dB louder at 0.3 s than in the first 40 ms)');
  ok(s.sdLate > s.sdEarly + 2 && s.sdLate > 3, 'and vibrato comes in after the bow (pitch wobble ' + s.sdEarly.toFixed(1) + ' → ' + s.sdLate.toFixed(1) + ' cents)');
  const pd = await go({ sound: 'Pad', chord: 'C' }), pn = await go({ sound: 'Organ', chord: 'C' });
  ok(pd.c < .9 && pd.c < pn.c - .05, 'pad: wide across the stereo field (left–right correlation ' + pd.c.toFixed(2) + ', against ' + pn.c.toFixed(2) + ' for the organ)');
  const gs = await go({ comp: true, inst: 'Steel', chord: 'G' }), ge = await go({ comp: true, inst: 'Electric', chord: 'G' });
  ok(gs.ok && gs.c < .95 && Math.abs(gs.lag) > 3 && Math.abs(gs.lag) < 26, 'rhythm guitar: double-tracked, a second performance on the other side ' + Math.abs(gs.lag).toFixed(0) + ' ms behind (correlation ' + gs.c.toFixed(2) + ')');
  /* 2.46.1: a guitar, not a harpsichord: highs that fade, no comb from a copied double, a softer pick, and in tune */
  const GH = await ev(async () => { const D = window.__daily, B = D.S.band, out = {};
    for (const inst of ['Steel', 'Nylon']) {
      D.S.sections = [{ id: 'x', name: 'V', lyrics: '', bars: [{ chord: 'G', tab: [] }] }]; D.S.bpm = 60; Object.assign(B, { build: false, drumsOn: false, bassOn: false, leadOn: false, keysOn: false, compOn: true, compStyle: 'Down 4s', compInst: inst }); D.T.loop = false; D.T.bars = null; D.commit(false);
      const r = await D.ofrRender({ tail: .5 }), sr = r.sr, m = i => (r.l[i] + r.r[i]) / 2; let st = 0; while (st < r.l.length && Math.abs(m(st)) < .002) st++;
      const hi = (a, b) => { let lp = 0, e = 0, all = 0; const k = Math.exp(-2 * Math.PI * 2500 / sr); for (let i = st + Math.floor(a * sr); i < st + Math.floor(b * sr); i++) { lp = k * lp + (1 - k) * m(i); const h = m(i) - lp; e += h * h; all += m(i) * m(i); } return e / all; };
      let xy = 0, xx = 0, yy = 0; const d = Math.round(.014 * sr); for (let i = st + Math.floor(.05 * sr); i < st + Math.floor(.8 * sr); i++) { xy += m(i) * m(i + d); xx += m(i) * m(i); yy += m(i + d) * m(i + d); }
      out[inst] = { early: hi(0, .08), late: hi(.3, .8), comb: xy / Math.sqrt(xx * yy) };
    }
    const tun = []; for (const [st, fr] of [[1, 0], [4, 10]]) { D.S.sections = [{ id: 'x', name: 'V', lyrics: '', bars: [{ chord: '', tab: [{ s: 0, st, f: fr, t: '' }] }] }]; D.S.capo = 0; Object.assign(B, { compOn: false, leadOn: true, leadInst: 'Nylon' }); D.T.bars = null; D.commit(false);
      const want = 440 * Math.pow(2, (D.S.tuning[st] + fr - 69) / 12), r = await D.ofrRender({ tail: .5 }), sr = r.sr, L = r.l; let s0 = 0; while (s0 < L.length && Math.abs(L[s0]) < .002) s0++;
      const fs = []; for (let s = s0 + Math.floor(.1 * sr); s < s0 + Math.floor(.8 * sr); s += 2400) { const q = D.yin(L.subarray(s, s + 4096), sr, .15, 60); if (q && q.clarity > .8) fs.push(q.f); } fs.sort((a, b) => a - b); tun.push(1200 * Math.log2(fs[fs.length >> 1] / want)); }
    out.tune = tun; return out; });
  ok(GH.Steel.late < .07 && GH.Nylon.late < .04, 'the strings lose their highs as they ring, as a guitar does and a harpsichord does not (above 2.5 kHz half a second on: steel ' + (GH.Steel.late * 100).toFixed(1) + '%, nylon ' + (GH.Nylon.late * 100).toFixed(1) + '%)');
  ok(GH.Steel.comb < .3 && GH.Nylon.comb < .3, 'no comb filter from a copied double (a copy shows as a strong positive correlation 14 ms on; here ' + GH.Steel.comb.toFixed(2) + ', ' + GH.Nylon.comb.toFixed(2) + ')');
  ok(GH.Nylon.early < .15 && GH.Steel.early < .3, 'a softer pick: nylon ' + (GH.Nylon.early * 100).toFixed(0) + '%, steel ' + (GH.Steel.early * 100).toFixed(0) + '% above 2.5 kHz in the attack');
  ok(GH.tune.every(c => Math.abs(c) < 3), 'and in tune, low and high (' + GH.tune.map(c => c.toFixed(1) + ' cents').join(', ') + ')');
  const BD = await ev(async () => {      /* the body itself: an impulse through it, and how much it lifts its resonances over the treble */
    const D = window.__daily, oc = new OfflineAudioContext(1, 48000, 48000), src = oc.createBufferSource(), b = oc.createBuffer(1, 48000, 48000); b.getChannelData(0)[0] = 1; src.buffer = b;
    const cv = oc.createConvolver(); cv.normalize = false; cv.buffer = D.guitarBody(oc); src.connect(cv); cv.connect(oc.destination); src.start(); const y = (await oc.startRendering()).getChannelData(0);
    const mag = f => { let re = 0, im = 0; for (let i = 0; i < 4800; i++) { re += y[i] * Math.cos(2 * Math.PI * f * i / 48000); im -= y[i] * Math.sin(2 * Math.PI * f * i / 48000); } return 20 * Math.log10(Math.hypot(re, im) + 1e-9); };
    D.S.band.compInst = 'Electric'; D.pluck('rhythm', D.E.ctx.currentTime + .05, 55, .01); const el = D.E.plBody.rhythm.gain.value; D.S.band.compInst = 'Steel'; D.pluck('rhythm', D.E.ctx.currentTime + .05, 55, .01); const st = D.E.plBody.rhythm.gain.value;
    return { lo: Math.max(mag(98), mag(196)), hi: mag(3000), el, st };
  });
  ok(BD.lo > BD.hi + 15, 'a guitar body: its resonances (around 100–200 Hz) ring ' + (BD.lo - BD.hi).toFixed(0) + ' dB above the treble');
  ok(BD.st > .5 && BD.el < .2, 'acoustic guitars play through it, an electric hardly (body ' + BD.st + ' against ' + BD.el + ')');
  ok(await ev(() => window.__daily.KEYS_SOUNDS.includes('Strings')), 'Strings is a new keys sound');
});
