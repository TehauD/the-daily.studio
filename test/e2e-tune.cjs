/* Vocal tuning (2.43, part 90, a room): synthetic voices with known pitch problems go in, and the result is measured: a flat note lands on the
   key's note, a note between two is pulled to the nearest, Hard flattens vibrato while Natural keeps it, timing and length do not move, and
   Off gives back the exact original. Then the controls: Sing on a phone, and a take's menu on a computer. */
const { suite } = require('./lib.cjs');

suite('e2e-tune', async t => {
  const { ok, wait } = t;
  const p = await t.open({ w: 1280, h: 800 }), ev = (f, a) => p.evaluate(f, a);
  ok(await ev(() => !window.__daily.ROOM.files || !window.__daily.ROOM.done.tune), 'tuning is not loaded until someone tunes');
  /* make a vocal take from a pitch curve f(t) (Hz, or 0 for silence): eight harmonics with a vowel-ish tilt */
  const make = (spec, mode) => ev(async ([spec, mode]) => {
    const D = window.__daily, sr = 48000, n = Math.round(sr * spec.dur), x = new Float32Array(n); let ph = 0;
    const fAt = s => { const tt = s / sr; if (tt < spec.on || tt > spec.off) return 0; return spec.f * Math.pow(2, (spec.vib || 0) / 1200 * Math.sin(2 * Math.PI * 5.5 * tt)); };
    for (let i = 0; i < n; i++) { const f = fAt(i); if (!f) { ph = 0; continue; } ph += 2 * Math.PI * f / sr; let s = 0; for (let k = 1; k <= 8; k++) s += Math.sin(k * ph) / (k * (k < 3 ? 1 : 1.6)); x[i] = .3 * s; }
    D.S.key = 9; D.S.minor = true; D.S.scale = 'Natural Minor (Aeolian)'; D.commit(false);
    const tk = { id: 'tt' + Math.random().toString(36).slice(2, 7), kind: 'vox', name: 'Test vocal', startSec: 0, sr, dry: x, wet: null, peaks: D.peaksOf(x), g: 1, pan: 0, mute: true, solo: false, mode: 'wet', bpm: D.S.bpm, preset: '', dur: n / sr, t: Date.now() };
    D.TAKES.push(tk); const before = x.slice(); await D.room('tune'); await D.tuneTake(tk, mode); const y = tk.dry;
    const pitch = (arr, a, b) => { const out = []; for (let s = Math.round(a * sr); s + 2208 < Math.round(b * sr); s += 480) { const r = D.yin(arr.subarray(s, s + 2208), sr, .15, 70); if (r && r.clarity > .8) out.push(r.f); } return out; };
    const cents = (arr, ref) => arr.map(f => 1200 * Math.log2(f / ref));
    const ps = pitch(y, spec.on + .3, spec.off - .3), pin = pitch(before, spec.on + .3, spec.off - .3), med = a => a.slice().sort((p, q) => p - q)[a.length >> 1];
    const sd = a => { const m = a.reduce((s, v) => s + v, 0) / a.length; return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length); };
    const onset = arr => { for (let i = 0; i < arr.length; i++) if (Math.abs(arr[i]) > .02) return i / sr; return -1; };
    const res = { fin: med(pin), fout: med(ps), sdIn: sd(cents(pin, med(pin))), sdOut: sd(cents(ps, med(ps))), len: y.length === before.length, onIn: onset(before), onOut: onset(y), tune: tk.tune, loaded: !!D.ROOM.done.tune || !D.ROOM.files };
    await D.tuneTake(tk, 'off'); res.back = tk.dry.every((v, i) => v === before[i]); res.offTune = tk.tune; D.TAKES.splice(D.TAKES.indexOf(tk), 1); return res;
  }, [spec, mode]);
  const c = (a, b) => 1200 * Math.log2(a / b);

  const A = await make({ dur: 3, on: .5, off: 2.6, f: 432 }, 'hard');
  ok(A.loaded && Math.abs(c(A.fin, 440)) > 25 && Math.abs(c(A.fout, 440)) < 8, 'Hard: a flat A (' + A.fin.toFixed(1) + ' Hz, ' + c(A.fin, 440).toFixed(0) + ' cents) lands on A (' + A.fout.toFixed(1) + ' Hz, ' + c(A.fout, 440).toFixed(0) + ' cents)');
  ok(A.len && Math.abs(A.onOut - A.onIn) < .012, 'the take keeps its length, and the note still starts where it did (' + ((A.onOut - A.onIn) * 1000).toFixed(1) + ' ms)');
  ok(A.back && A.offTune === 'off', 'Off gives back the exact original, sample for sample');
  const B = await make({ dur: 2.5, on: .3, off: 2.2, f: 455 }, 'tight');
  ok(Math.abs(c(B.fout, 440)) < 15, 'Tight: a note between A and B (' + B.fin.toFixed(0) + ' Hz) is pulled to the nearer one, A (' + B.fout.toFixed(1) + ' Hz)');
  const N = await make({ dur: 3, on: .5, off: 2.6, f: 432 }, 'natural');
  ok(Math.abs(c(N.fout, 440)) < Math.abs(c(N.fin, 440)) * .45, 'Natural: most of the way to A, gently (' + c(N.fin, 440).toFixed(0) + ' → ' + c(N.fout, 440).toFixed(0) + ' cents)');
  const VH = await make({ dur: 3, on: .4, off: 2.7, f: 440, vib: 45 }, 'hard'), VN = await make({ dur: 3, on: .4, off: 2.7, f: 440, vib: 45 }, 'natural');
  ok(VH.sdOut < VH.sdIn * .4, 'Hard flattens vibrato (it wobbled ' + VH.sdIn.toFixed(0) + ' cents; now ' + VH.sdOut.toFixed(0) + ')');
  ok(VN.sdOut > VN.sdIn * .6, 'Natural keeps it (' + VN.sdIn.toFixed(0) + ' → ' + VN.sdOut.toFixed(0) + ' cents)');

  /* the controls */
  await ev(() => { const D = window.__daily, sr = 48000, x = new Float32Array(sr); for (let i = 0; i < sr; i++) x[i] = .2 * Math.sin(2 * Math.PI * 436 * i / sr); D.TAKES.push({ id: 'uiv', kind: 'vox', name: 'Vocal 1', startSec: 0, sr, dry: x, wet: null, peaks: D.peaksOf(x), g: 1, pan: 0, mute: false, solo: false, mode: 'wet', bpm: D.S.bpm, preset: '', dur: 1, t: Date.now() }); D.bus.emit('takes'); });
  ok(await ev(() => { const D = window.__daily, tk = D.TAKES.find(x => x.id === 'uiv'); const box = D.tuneSelect(tk); return [...box.querySelectorAll('option')].map(o => o.textContent).join() === 'Off,Natural,Tight,Hard'; }), 'a vocal take offers 🎯 Tune: Off, Natural, Tight, Hard');
  const m = await t.open({ w: 390, h: 844, mobile: true }), mv = (f, a) => m.evaluate(f, a);
  await mv(() => { const D = window.__daily, sr = 48000, x = new Float32Array(sr); for (let i = 0; i < sr; i++) x[i] = .2 * Math.sin(2 * Math.PI * 436 * i / sr); D.TAKES.push({ id: 'ph1', kind: 'vox', name: 'Vocal 1', startSec: 0, sr, dry: x, wet: null, peaks: D.peaksOf(x), g: 1, pan: 0, mute: false, solo: false, mode: 'wet', bpm: D.S.bpm, preset: '', dur: 1, t: Date.now() }); D.bus.emit('takes'); D.mGo('sing'); });
  await wait(400);
  await m.selectOption('.ms-take select[data-tune="ph1"]', 'tight'); await wait(2500);
  ok(await mv(() => window.__daily.TAKES.find(x => x.id === 'ph1').tune === 'tight' && document.querySelector('.ms-take select[data-tune="ph1"]').value === 'tight'), 'Sing on a phone: each vocal take has the Tune menu, and Tight is applied and shown');
});
