/* Finish it (2.57): master the song on this device and make the release package.
   The limiter never lets a sample over its ceiling; the master reaches the chosen loudness with true peaks under −1 dBTP; Before / After
   plays both at the same loudness; matching a reference moves the tone toward it; credits come from the song's history; the package holds
   the masters (24-bit, and 16-bit 44.1 kHz), lyrics, chord sheet, credits, splits, the song and a README, and the song is marked finished. */
const { suite } = require('./lib.cjs');
suite('e2e-finish', async t => {
  const { ok, wait, poll } = t, p = await t.open(); const ev = (fn, a) => p.evaluate(fn, a);
  await ev(() => {
    const D = window.__daily, S = D.S; let n = 0; S.sections.forEach(sec => { sec.bars = sec.bars.filter(() => n++ < 8); }); S.sections = S.sections.filter(s => s.bars.length);
    S.title = 'Harbour Song'; S.sections[0].lyrics = 'Lanterns on the harbour wall\nCalling all the boats back in'; Object.assign(S.band, { drumsOn: true, bassOn: true, compOn: true }); D.CFG.slName = 'Tehau';
    S.collab = { id: 'c1', with: 'Sam', note: '', hist: [['Tehau', 1, 'started the song'], ['Sam', 2, 'wrote words for Chorus']] }; D.commit(false);
  });

  /* the limiter on its own */
  const LIM = await ev(() => { const D = window.__daily, n = 96000, l = new Float32Array(n), r = new Float32Array(n); for (let i = 0; i < n; i++) { l[i] = .5 * Math.sin(i / 7); r[i] = l[i]; } for (let k = 0; k < 20; k++) { const at = 1000 + k * 2300; l[at] = 1.9; r[at + 3] = -1.7; } const c = Math.pow(10, -1.5 / 20), gr = D.finLimit(l, r, 48000, c, .08); let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(l[i]), Math.abs(r[i])); let quiet = 0; for (let i = 80000; i < 81000; i++) quiet = Math.max(quiet, Math.abs(l[i]));      /* well after the last spike (at 44 700) and the limiter's release */ return { mx, c, gr, quiet }; });
  ok(LIM.mx <= LIM.c + 1e-6 && LIM.gr < -5, 'the look-ahead limiter never lets a sample over its ceiling (' + LIM.mx.toFixed(4) + ' ≤ ' + LIM.c.toFixed(4) + '; it took ' + (-LIM.gr).toFixed(1) + ' dB off the spikes)');
  ok(LIM.quiet > .49 && LIM.quiet <= .5001, 'and once the spikes have passed, the sound is back at its own level (' + LIM.quiet.toFixed(3) + ' of 0.5)');

  /* matching a reference's tone */
  const EQ = await ev(() => { const D = window.__daily, n = 48000 * 2, noise = (bright) => { const l = new Float32Array(n); let y = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; y = bright ? w - .9 * y : .97 * y + .03 * w * 6; l[i] = y * .2; } return l; }; const dark = noise(false), bright = noise(true), eq = D.finMatchEq(D.finTone(dark, dark, 48000), D.finTone(bright, bright, 48000), 1); return eq.map(v => +v.toFixed(1)); });
  ok(EQ[EQ.length - 2] > 2 && EQ[1] < -2 && EQ.every(v => Math.abs(v) <= 6), 'matching a brighter reference lifts the highs and lowers the lows, never more than 6 dB (' + EQ.join(' ') + ')');

  /* the window: master to −14 LUFS */
  await ev(() => window.__daily.finOpen()); await wait(400);
  ok(await ev(() => !!document.getElementById('finDlg') && document.getElementById('finTarget').value === '-14'), 'Finish it opens on −14 LUFS (streaming)');
  await ev(() => document.getElementById('finGo').click());
  ok(await poll(() => ev(() => /^✓ Mastered/.test(document.getElementById('finSay').textContent)), 60000), 'Master it renders and masters the song: ' + await ev(() => document.getElementById('finSay').textContent.slice(0, 90)));
  const M = await ev(() => { const F = window.__daily.FIN; return { lufs: F.out.m.lufs, tp: F.out.m.tp, pre: F.pre.m.lufs, n: F.out.l.length, sr: F.out.sr }; });
  ok(Math.abs(M.lufs + 14) < .5 && M.tp <= -0.95, 'the master is at the target: ' + M.lufs.toFixed(2) + ' LUFS, true peak ' + M.tp.toFixed(2) + ' dBTP (was ' + M.pre.toFixed(1) + ' LUFS)');
  await ev(() => document.getElementById('finPlay').click()); await wait(300);
  const AB = await ev(() => { const F = window.__daily.FIN, p = F.play; const a1 = p && p.ga.gain.value, b1 = p && p.gb.gain.value; const want = Math.pow(10, Math.min(0, F.pre.m.lufs - F.out.m.lufs) / 20); return { playing: !!p, a1, b1, want }; });
  ok(AB.playing && AB.a1 === 0 && Math.abs(AB.b1 - AB.want) < 1e-3, 'After plays turned down to the mix’s loudness, so Before / After is a fair comparison');
  await ev(() => { window.__daily.finAB ? window.__daily.finAB('a') : document.querySelector('#finAB [data-w=a]').click(); }); await wait(150);
  ok(await ev(() => { const p = window.__daily.FIN.play; return !!p && p.ga.gain.value > 0; }), 'Before switches over at once, at the same point');
  await ev(() => document.getElementById('finPlay').click());

  /* credits and splits */
  const PE = await ev(() => window.__daily.finPeople().map(x => ({ n: x.n, words: x.words, share: x.share })));
  ok(PE.some(x => x.n === 'Tehau' && x.words) && PE.some(x => x.n === 'Sam' && x.words) && Math.abs(PE.reduce((a, x) => a + (x.share || 0), 0) - 100) < .2, 'credits come from the song’s history: Tehau and Sam, both on the words, with writing shares that add up to 100 % (' + PE.map(x => x.n + ' ' + x.share + '%').join(', ') + ')');
  ok(await ev(() => !document.getElementById('finStep2').hidden && document.querySelectorAll('#finStep2 tbody tr').length === 2 && /add up to 100 % ✓/.test(document.getElementById('finSum').textContent)), 'the window shows them as a table to adjust');

  /* the release package */
  const R = await ev(async () => { const D = window.__daily, r = await D.finPackage({ noDownload: true }), z = await D.zipRead(D.FIN.zip), out = { files: r.files }; const w16 = [...z.keys()].find(k => /16-bit/.test(k)), b = await z.get(w16).get(), dv = new DataView(b.buffer, b.byteOffset); out.sr16 = dv.getUint32(24, true); out.bits16 = dv.getUint16(34, true); out.readme = new TextDecoder().decode(await z.get('README.txt').get()); out.credits = new TextDecoder().decode(await z.get('credits.txt').get()); out.lyrics = new TextDecoder().decode(await z.get('lyrics.txt').get()); out.csv = new TextDecoder().decode(await z.get('splits.csv').get()); return out; });
  const want = ['master (24-bit', 'master (16-bit 44.1 kHz, for distributors)', 'lyrics.txt', 'chord sheet.html', 'credits.txt', 'splits.csv', '.daily-song.zip', 'README.txt'];
  ok(want.every(w => R.files.some(f => f.includes(w))), 'the release package holds both masters, the lyrics, the chord sheet, credits, splits, the song and a README (' + R.files.length + ' files)');
  ok(R.sr16 === 44100 && R.bits16 === 16, 'the distributor master is 16-bit 44.1 kHz');
  ok(/LUFS integrated, true peak/.test(R.readme) && /Lanterns on the harbour wall/.test(R.lyrics) && /Sam: words/.test(R.credits) && /^name,words,music,performance,production,writing_share_percent/.test(R.csv), 'the README gives the loudness, the lyrics are there, and the credits and splits name Sam for the words');
  ok(await ev(() => { const D = window.__daily; return !!D.PRJ.rec.done && D.jrSteps().find(s => s.k === 'done').on && /^Release /.test(D.verList().slice(-1)[0].n); }), 'the song is marked finished on its journey, and the release is kept as a version');
});
