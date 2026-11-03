/* Megaphone pedal (2.30): a vocal effects pedal with no MIDI (a TC-Helicon VoiceTone X1) heard in the vocal input, and the show reacting.
   The voices are synthesised: a low and a high voice, clean and through a megaphone-like band limit and drive. */
const { suite } = require('./lib.cjs');

suite('e2e-megaphone', async t => {
  const { ok, wait } = t;
  const p = await t.open({ w: 1280, h: 860 }), ev = (f, a) => p.evaluate(f, a);
  await ev(() => { const sr = 48000, n = 2048, D = window.__daily;
    const voice = (f0, seed) => { let s = seed; const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff * 2 - 1; }; const x = new Float32Array(sr); for (let i = 0; i < sr; i++) { let v = 0; const vib = 1 + .01 * Math.sin(2 * Math.PI * 5 * i / sr); for (let h = 1; h * f0 < 8000; h++) v += Math.sin(2 * Math.PI * f0 * h * vib * i / sr) / h * (h * f0 < 3500 ? 1 : .5); x[i] = .15 * v + .01 * r(); } return x; };
    const bp = (x, lo, hi) => { const y = new Float32Array(x.length), a1 = Math.exp(-2 * Math.PI * lo / sr), a2 = Math.exp(-2 * Math.PI * hi / sr); let l1 = 0, l2 = 0; for (let i = 0; i < x.length; i++) { l1 = (1 - a1) * x[i] + a1 * l1; const hp = x[i] - l1; l2 = (1 - a2) * hp + a2 * l2; y[i] = l2; } return y; };
    const mega = x => { let y = bp(bp(x, 500, 3000), 500, 3000); y = y.map(v => Math.tanh(v * 25) * .3); return bp(bp(y, 450, 3200), 450, 3200); };
    const feats = x => { const out = []; for (let o = 4096; o + n < x.length; o += 2048) { const b = x.subarray(o, o + n); let e = 0; for (const v of b) e += v * v; out.push(D.megFeatures(D.megSpectrum(b), sr / n, Math.sqrt(e / n))); } return out; };
    window.__F = { low: feats(voice(130, 1)), high: feats(voice(260, 2)), lowM: feats(mega(voice(130, 1))), highM: feats(mega(voice(260, 2))), quiet: D.megFeatures(D.megSpectrum(new Float32Array(n)), sr / n, 0) };
  });

  /* ---- telling the sounds apart ---- */
  const S = await ev(() => { const D = window.__daily, F = window.__F, med = a => { const v = a.map(f => D.megScore(f)).sort((x, y) => x - y); return +v[Math.floor(v.length / 2)].toFixed(2); }; return { low: med(F.low), high: med(F.high), lowM: med(F.lowM), highM: med(F.highM), quiet: F.quiet }; });
  ok(S.low < .35 && S.high < .35, 'a clean voice, low or high, does not sound like the pedal (' + S.low + ', ' + S.high + ')');
  ok(S.lowM > .7 && S.highM > .7, 'the same voices through a megaphone do, out of the box (' + S.lowM + ', ' + S.highM + ')');
  ok(S.quiet === null, 'silence is not a reading at all');
  const T = await ev(() => { const D = window.__daily, F = window.__F, m = D.megLearn(F.low.slice(0, 12), F.lowM.slice(0, 12)), sc = a => a.map(f => D.megScore(f, m)), avg = a => a.reduce((x, y) => x + y, 0) / a.length; return { ok: !!m, clean: +avg(sc(F.low)).toFixed(2), meg: +avg(sc(F.lowM)).toFixed(2), same: D.megLearn(F.low.slice(0, 12), F.low.slice(12, 24)) }; });
  ok(T.ok && T.clean < .2 && T.meg > .8, 'taught your voice (three seconds clean, three with the pedal), the two are told apart clearly (' + T.clean + ' and ' + T.meg + ')');
  ok(T.same === null && await ev(() => /too alike/.test(document.getElementById('toasts').textContent)), 'teaching it two of the same sound is refused, and it says why');
  await ev(() => { window.__daily.CFG.mega.model = null; });

  /* ---- on and off, steadily ---- */
  const H = await ev(() => {
    const D = window.__daily, F = window.__F, M = D.MEG; let t = 1000; const feed = (arr, ms) => { const out = []; for (let k = 0; k * 60 < ms; k++) { D.megStep(arr ? arr[k % arr.length] : null, t); t += 60; out.push(M.on); } return out; };
    D.megSet(false); M.score = 0; M.last = t;
    const a = feed(F.low, 1200), b = feed(F.lowM, 600), on1 = M.on, gap = feed(null, 3000), held = M.on, c = feed(F.low, 1500), off = M.on, d = feed(F.highM, 800), e = feed(null, 4500);
    return { a: a.some(Boolean), firstOn: b.indexOf(true) * 60, on1, held, off, again: d.some(Boolean), offAfter: !M.on };
  });
  ok(!H.a, 'singing clean never sets it off');
  ok(H.on1 && H.firstOn >= 250 && H.firstOn <= 500, 'stomp the pedal: on within a third of a second of singing through it (' + H.firstOn + ' ms)');
  ok(H.held, 'a breath between lines (three seconds) keeps it on');
  ok(!H.off, 'pedal off, sing clean: off again');
  ok(H.again && H.offAfter, 'and after four seconds of silence with no pedal sound, it lets go');

  /* ---- the show ---- */
  const V = await ev(() => {
    const D = window.__daily; D.CFG.mega.words = true; D.CFG.mega.lights = true; D.CFG.mega.stage = true; D.LX.strobeReq = false;
    const c = document.createElement('canvas'); c.width = 64; c.height = 36; const g = c.getContext('2d'); g.fillStyle = 'rgb(140,140,140)'; g.fillRect(0, 0, 64, 36);
    D.megSet(true); D.megDraw(g, 64, 36); const px = g.getImageData(32, 18, 1, 1).data, on = { body: document.body.classList.contains('mega'), strobe: D.LX.strobeReq, red: px[0] > px[1] + 30 && px[0] > px[2] + 30 };
    D.megSet(false); const g2 = c.getContext('2d'); g2.fillStyle = 'rgb(140,140,140)'; g2.fillRect(0, 0, 64, 36); D.megDraw(g2, 64, 36); const q = g2.getImageData(32, 18, 1, 1).data;
    return { on, offBody: document.body.classList.contains('mega'), offSame: q[0] === 140 && q[1] === 140 };
  });
  ok(V.on.red && V.on.strobe && V.on.body, 'on: the stage picture turns red-hot, the lights get a flash (within the light comfort), and the words go red');
  ok(!V.offBody && V.offSame, 'off: the picture and the words are left as they were');
  ok(await ev(() => { const D = window.__daily; D.CFG.mega.stage = false; const c = document.createElement('canvas'); c.width = 8; c.height = 8; const g = c.getContext('2d'); g.fillStyle = 'rgb(140,140,140)'; g.fillRect(0, 0, 8, 8); D.megSet(true); D.megDraw(g, 8, 8); const px = g.getImageData(4, 4, 1, 1).data; D.megSet(false); D.CFG.mega.stage = true; return px[0] === 140; }), 'each reaction can be switched off (here, the stage)');

  /* ---- Settings ---- */
  await ev(() => window.__daily.openSettings('mega')); await wait(400);
  ok(await ev(() => !!document.getElementById('meg-on') && !!document.getElementById('megLive') && !!document.getElementById('megTeach') && /VoiceTone X1/.test(document.querySelector('#settings .meg').textContent)), 'Settings ▸ Megaphone pedal: a switch, a live meter, Teach it my voice, and what reacts');
  await p.click('#megTeach'); await wait(300);
  ok(await ev(() => /Connect your vocal input/.test(document.getElementById('toasts').textContent)), 'teaching without an input connected says what to do first');
  await p.click('#meg-on'); await wait(300);
  ok(await ev(() => window.__daily.CFG.mega.on && !!window.__daily.MEG.tm && /No input connected/.test(document.getElementById('megLive').textContent)), 'switched on, it listens, and says when there is no input to listen to');
  await p.click('#meg-on');
});
