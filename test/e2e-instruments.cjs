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
    const lag = () => { let best = 0, bv = -1; const a = st, n = Math.floor(.25 * sr); for (let d = -Math.floor(.03 * sr); d <= Math.floor(.03 * sr); d++) { let s = 0; for (let i = a; i < a + n; i += 2) s += Math.abs(L[i]) * Math.abs(R[i + d] || 0); if (s > bv) { bv = s; best = d; } } return best / sr * 1000; };
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
  ok(gs.ok && gs.c < .95 && Math.abs(Math.abs(gs.lag) - 14) < 4, 'rhythm guitar: double-tracked, a copy on the other side ' + Math.abs(gs.lag).toFixed(0) + ' ms later (correlation ' + gs.c.toFixed(2) + ')');
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
