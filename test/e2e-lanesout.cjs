/* Lanes out (2.55): every lane as its own WAV for mixing and mastering in another app. Each file starts at the song's first beat and has the
   song's full length, so they line up when dropped at bar 1; the master section (tone, level, limiter) is left out; the lane's own level and
   pan stay; nothing of the song's state changes; one lane can be dragged out; Export all makes a premaster, the lanes and a README. */
const { suite } = require('./lib.cjs');
suite('e2e-lanesout', async t => {
  const { ok, wait, poll } = t, p = await t.open();
  const ev = (fn, a) => p.evaluate(fn, a);
  /* a short song (4 bars), the drums and bass on, and a take: a 1 kHz burst exactly 1.000 s after the first beat */
  const START = 1.0;
  await ev(START => {
    const D = window.__daily, S = D.S; let n = 0; S.sections.forEach(sec => { sec.bars = sec.bars.filter(() => n++ < 4); }); S.sections = S.sections.filter(s => s.bars.length);
    Object.assign(S.band, { drumsOn: true, bassOn: true, compOn: false, leadOn: false, keysOn: false }); D.CFG.master = .3; D.commit(false);
    const sr = 48000, dry = new Float32Array(sr); for (let i = 0; i < 2400; i++) dry[i] = .9 * Math.sin(2 * Math.PI * 1000 * i / sr);
    D.TAKES.push({ id: 'tkL', kind: 'gtr', name: 'Burst take', startSec: START, sr, g: 1, pan: 0, mode: 'dry', dur: 1, dry, wet: null, cam: [], peaks: D.peaksOf(dry) }); D.bus.emit('takes');
  }, START);
  const before = await ev(() => { const D = window.__daily; return JSON.stringify([D.S.band, D.S.mix, D.TAKES.map(t => [t.mute, t.solo]), D.CFG.monitor]); });

  /* one lane, rendered */
  const R = await ev(async () => { const D = window.__daily, x = D.lxLanes().find(l => l.kind === 'take'), o = await D.lxRender(x); let on = -1; for (let i = 0; i < o.l.length; i++) if (Math.abs(o.l[i]) > .01) { on = i; break; } return { n: o.l.length, sr: o.sr, on, peak: o.peak }; });
  ok(Math.abs(R.on - START * R.sr) <= 2, 'a take lane starts where it sits in the song: its first sound is at ' + (R.on / R.sr).toFixed(4) + ' s (placed at 1.0000 s)');
  ok(R.peak > .55 && R.peak < .75, 'the master section is left out: the master level is at 30 %, and the take still comes out at its own level through its pan (peak ' + R.peak.toFixed(3) + ', expected about 0.64)');
  const Dr = await ev(async () => { const D = window.__daily, o = await D.lxRender(D.lxLanes().find(l => l.id === 'drums')); return { n: o.l.length, peak: o.peak }; });
  ok(Dr.n === R.n && Dr.peak > .01, 'every lane has the same length, from the first beat to the song’s end plus its tail (' + (R.n / R.sr).toFixed(2) + ' s), so they line up when dropped at bar 1');
  ok(await ev(b => { const D = window.__daily; return JSON.stringify([D.S.band, D.S.mix, D.TAKES.map(t => [t.mute, t.solo]), D.CFG.monitor]) === b; }, before), 'afterwards the band, the mixer, the takes’ mute and solo, and monitoring are exactly as they were');
  ok(await ev(() => window.__daily.E.ctx.constructor.name === 'AudioContext' && !window.__daily.OFR.busy), 'and the live engine is back');

  /* ⤓ Save this lane: a dialog with a file to drag out, and Save */
  await ev(() => window.__daily.lxSaveLane({ id: 'bass', type: 'bass' }));
  ok(await poll(() => ev(() => !!document.querySelector('#lxDlg .lx-chip')), 30000), 'Save this lane renders it and offers the file');
  const chip = await ev(() => { const a = document.querySelector('#lxDlg .lx-chip'), dt = new DataTransfer(); a.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true })); return { name: a.getAttribute('download'), drag: a.draggable, url: dt.getData('DownloadURL'), files: dt.files.length, ft: dt.files[0] && dt.files[0].type }; });
  ok(chip.drag && /Bass\.wav$/.test(chip.name) && /^audio\/wav:.*Bass\.wav:blob:/.test(chip.url) && chip.files === 1 && chip.ft === 'audio/wav', 'it can be dragged: the drag carries the WAV as a file and as a download for the desktop (' + chip.name + ')');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), ev(() => document.getElementById('lxDl').click())]);
  const f = t.path.join(t.os.tmpdir(), 'daily-' + process.pid + '-bass.wav'); await dl.saveAs(f); const b = t.fs.readFileSync(f);
  ok(b.readUInt16LE(22) === 2 && b.readUInt16LE(34) === 24 && b.readUInt32LE(24) === R.sr && (b.length - 44) / 6 === R.n, '⤓ Save gives a stereo 24-bit WAV at the studio’s rate, as long as every other lane (' + dl.suggestedFilename() + ')');
  await ev(() => { const d = document.getElementById('lxDlg'); if (d) d.close(); });

  /* 📦 Export for mixing & mastering */
  await ev(() => window.__daily.lxExportOpen()); await wait(300);
  ok(await ev(() => { const d = document.getElementById('lxPick'); return !!d && d.querySelectorAll('.lx-lanes input:checked').length === 3 && /Drums/.test(d.textContent) && /Bass/.test(d.textContent) && /Burst take/.test(d.textContent) && document.getElementById('lxPm').checked; }), 'Export lists every lane that has something in it (Drums, Bass, the take), and the premaster');
  await ev(() => document.getElementById('lxPick').close());
  const X = await ev(async () => { const D = window.__daily, r = await D.lxExport({ where: 'zip', noDownload: true }), z = await D.zipRead(D.LXO.lastZip), sizes = {}; for (const [k, v] of z) sizes[k] = (await v.get()).length; const rd = new TextDecoder().decode(await z.get('README.txt').get()); return { files: r.files, sizes, rd }; });
  ok(X.files.join('|') === '00 Premaster (full mix, no master effects).wav|01 Drums.wav|02 Bass.wav|03 Burst take.wav|README.txt', 'the .zip holds the premaster, each lane numbered in order, and a README (' + X.files.join(', ') + ')');
  const lens = Object.entries(X.sizes).filter(([k]) => /\.wav$/.test(k)).map(([, v]) => v);
  ok(lens.length === 4 && lens.every(v => v === lens[0]), 'every WAV in it is exactly the same length');
  ok(/Tempo: \d+(\.\d+)? BPM/.test(X.rd) && /Time signature: 4\/4/.test(X.rd) && /drop every file at the very start \(bar 1, 0:00\)/.test(X.rd) && /none of the master section/.test(X.rd), 'the README gives the tempo, time signature and key, and says to drop everything at bar 1');
  ok(await ev(() => !!document.querySelector('#lxAll .lx-chip') && /in one \.zip/.test(document.getElementById('lxAllMsg').textContent)), 'and the finished window offers the .zip to drag or save');
  await ev(() => { const d = document.getElementById('lxAll'); if (d) d.close(); });
  ok(await ev(b => { const D = window.__daily; return JSON.stringify([D.S.band, D.S.mix, D.TAKES.map(t => [t.mute, t.solo]), D.CFG.monitor]) === b; }, before), 'and after a whole export, nothing in the song has changed');

});
