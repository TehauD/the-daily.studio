/* Compare takes (2.75): made-up takes with known faults, measured by the studio. A click exactly on the grid reads as on the grid and steady;
   the same click 30 ms late reads as behind the beat; a jittered one as less steady. A sung note 30 cents flat reads as flat; one in tune
   as in tune. The best figure in each column is marked, every number is labelled measured or estimated, and no take is changed. */
const { suite } = require('./lib.cjs');
suite('e2e-takecheck', async t => {
  const { ok, wait } = t, p = await t.open({ w: 1280, h: 860, debug: true }), ev = (f, a) => p.evaluate(f, a);
  await ev(() => {
    const D = window.__daily, sr = 48000; D.S.bpm = 120; D.S.key = 0; D.S.minor = false; D.S.scale = 'Major (Ionian)'; D.TAKES.length = 0;
    const clicks = (shiftMs, jitMs) => { const d = new Float32Array(sr * 8); for (let b = 0; b < 15; b++) { const j = jitMs ? ((b * 7919) % 13 - 6) / 6 * jitMs : 0, o = Math.round((0.5 * b + 0.25 + (shiftMs + j) / 1000) * sr); for (let k = 0; k < 2400; k++) d[o + k] = .7 * Math.sin(2 * Math.PI * 900 * k / sr) * Math.exp(-k / 500); } return d; };
    const sing = cents => { const d = new Float32Array(sr * 6), f = 440 * Math.pow(2, cents / 1200); for (let i = 0; i < d.length; i++) { const seg = Math.floor(i / (sr * 1.5)), ph = i - seg * sr * 1.5, env = Math.min(1, ph / 2400, (sr * 1.4 - ph) / 2400); d[i] = env > 0 ? .3 * env * (Math.sin(2 * Math.PI * f * i / sr) + .3 * Math.sin(4 * Math.PI * f * i / sr)) : 0; } return d; };
    const mk = (name, kind, dry) => { const tk = { id: D.uid(), kind, name, startSec: 0, sr, dry, wet: null, peaks: D.peaksOf(dry), g: 1, pan: 0, mute: false, solo: false, mode: 'wet', bpm: 120, peak: -3, rms: -20, dur: dry.length / sr, t: Date.now(), stats: null, cam: [] }; D.TAKES.push(tk); return tk; };
    mk('Tight', 'gtr', clicks(0, 0)); mk('Late', 'gtr', clicks(30, 0)); mk('Loose', 'gtr', clicks(0, 28));
    mk('In tune', 'vox', sing(0)); mk('Flat', 'vox', sing(-30)); window.__before = D.TAKES.map(x => x.dry.length + ':' + x.startSec).join();
  });
  const G = await ev(async () => { const D = window.__daily, o = {}; for (const tk of D.TAKES) o[tk.name] = await D.takeCheck(tk); return o; });
  ok(Math.abs(G.Tight.timing.mean) < 6 && G.Tight.timing.spread < 6 && G.Tight.timing.hits >= 12, 'a click on the grid reads as on the grid and steady (' + G.Tight.timing.mean.toFixed(1) + ' ms, ±' + G.Tight.timing.spread.toFixed(1) + ', ' + G.Tight.timing.hits + ' attacks)');
  ok(G.Late.timing.mean > 22 && G.Late.timing.mean < 38 && G.Late.timing.spread < 6, 'the same click 30 ms late reads as behind the beat, and just as steady (' + G.Late.timing.mean.toFixed(1) + ' ms)');
  ok(G.Loose.timing.spread > G.Tight.timing.spread + 8, 'a jittered take reads as less steady (±' + G.Loose.timing.spread.toFixed(1) + ' ms against ±' + G.Tight.timing.spread.toFixed(1) + ')');
  ok(G.Tight.pitch === null, 'pitch is only read for voices');
  ok(G['In tune'].pitch && G['In tune'].pitch.off < 8 && G['In tune'].pitch.inTune > .9, 'a sung note in tune reads as in tune (' + G['In tune'].pitch.off.toFixed(1) + ' cents, ' + Math.round(G['In tune'].pitch.inTune * 100) + '%)');
  ok(G.Flat.pitch && G.Flat.pitch.off > 22 && G.Flat.pitch.off < 38 && G.Flat.pitch.bias < -20, 'one 30 cents flat reads as flat (' + G.Flat.pitch.off.toFixed(1) + ' cents, bias ' + G.Flat.pitch.bias.toFixed(1) + ')');
  ok(G.Tight.level && G.Tight.level.clip === 0 && G.Tight.noise.floor < -60, 'level and noise are read, and nothing clipped');
  // the window
  await ev(() => window.__daily.takeCheckOpen(window.__daily.TAKES[0])); await ev(() => window.__daily.TKC.done); await wait(200);
  const W = await ev(() => { const rows = [...document.querySelectorAll('#tkcTable tbody tr')]; return { n: rows.length, names: rows.map(r => r.querySelector('th').firstChild.textContent).join(), best: document.querySelector('#tkcTable tbody tr td.tkc-best') ? [...document.querySelectorAll('#tkcTable td.tkc-best')].map(c => c.parentNode.querySelector('th').firstChild.textContent).join() : '', say: document.getElementById('tkcSay').textContent, m: document.querySelectorAll('#tkcTable .tkc-m').length, e: document.querySelectorAll('#tkcTable .tkc-e').length }; });
  ok(W.n === 3 && W.names === 'Tight,Late,Loose', 'the window compares takes of the same kind: the three instrument takes, not the voices (' + W.names + ')');
  ok(/Tight/.test(W.best) && /Tight is the steadiest in time/.test(W.say), 'the best figure in each column is marked and a sentence says what stands out (“' + W.say + '”)');
  ok(W.m >= 5 && W.e >= 1, 'every column says whether it is measured or estimated');
  await ev(() => window.__daily.takeCheckOpen(window.__daily.TAKES[4])); await ev(() => window.__daily.TKC.done); await wait(150);
  ok(await ev(() => /In tune is the most in tune/.test(document.getElementById('tkcSay').textContent) && document.querySelectorAll('#tkcTable tbody tr').length === 2), 'for voices it compares the vocal takes and names the one most in tune');
  ok(await ev(() => window.__daily.TAKES.map(x => x.dry.length + ':' + x.startSec).join() === window.__before && window.__daily.TAKES.length === 5), 'no take is changed or removed');
  ok(t.errs.length === 0, 'no errors (' + t.errs.length + ')');
});
