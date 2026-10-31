/* Sharing one recording (2.15): a lane or a clip made into a small M4A for the share sheet, a one-file share page for a track
   or a video with the words and chords in time, and the notice and the one-time "I have the right to share this". */
const { suite } = require('./lib.cjs');
const SHEET = '[Intro]\nE        B        F#m        A\n\n[Verse 1]\nE              B/D#              C#m\nLanterns swing along the harbour wall\nA                  D9\nAnd the gulls are calling out\n\n[Chorus]\nA        E\nHold on, the tide is turning slow';
const mkTake = (sec, start, name) => () => {
  const D = window.__daily, sr = 48000, n = Math.round(sec * sr), d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = .3 * Math.sin(2 * Math.PI * 220 * i / sr) * (1 - (i % sr) / sr);
  const tk = { id: D.uid(), kind: 'gtr', name, startSec: start, sr, dry: d, wet: null, peaks: D.peaksOf(d), g: 1, pan: 0, mute: false, solo: false, mode: 'wet', bpm: D.S.bpm, preset: '', peak: -10, rms: -20, dur: n / sr, t: Date.now(), stats: null, cam: [] };
  D.TAKES.push(tk); D.bus.emit('takes'); return tk.id;
};
suite('e2e-share', async t => {
  const { ok, wait, fs } = t;
  const p = await t.open({});
  await p.evaluate(async txt => { const D = window.__daily; await D.chordSheetApply(D.chordSheetParse(txt), { mode: 'N', per: 1, fill: 'none' }); }, SHEET);
  const bar = await p.evaluate(() => 16 * 15 / window.__daily.S.bpm);   // seconds per bar in 4/4
  const id = await p.evaluate(`(${mkTake.toString()})(3, ${bar * 4}, 'Guitar take')()`);   // starts at the verse (bar 5)
  await wait(300);

  /* ---- the lane menu offers it ---- */
  await p.evaluate(() => window.__daily.dockGo('tab')); await wait(200);
  await p.evaluate(tid => { const hd = document.querySelector('.tl-head[data-id="take:' + tid + '"] .more') || [...document.querySelectorAll('.tl-head[data-id^="take:"] .more')][0]; hd && hd.click(); }, id); await wait(300);
  ok(!!(await p.$('#lmShare')), 'the lane menu has ↗ Share…');
  await p.keyboard.press('Escape');

  /* ---- a track made small: progress, then Studio Replay with the notice ---- */
  await p.evaluate(tid => { const D = window.__daily; D.kitTake(D.TAKES.find(x => x.id === tid), false); }, id); await wait(400);
  ok(await p.evaluate(() => !!document.getElementById('kitEnc')), 'making the small file shows its progress');
  await t.poll(() => p.evaluate(() => !!document.getElementById('kitReplayDlg')), 9000);
  const rp = await p.evaluate(() => { const D = window.__daily, b = D.KIT.last, d = document.getElementById('kitReplayDlg'); return { type: b && b.type, size: b && b.size, kind: D.KIT.lastKind, off: D.KIT.meta.off, len: D.KIT.meta.len, audio: !!d.querySelector('audio#kitAudio'), video: !!d.querySelector('video'), page: !!d.querySelector('#kitPage'), thumb: !!d.querySelector('#kitThumbFrame'), note: (d.querySelector('.share-note') || {}).textContent || '', head: d.querySelector('.dlg-h').textContent }; });
  ok(/^audio\//.test(rp.type) && rp.size > 2000 && rp.kind === 'take', 'the lane becomes a small audio file (' + rp.type + ', ' + rp.size + ' bytes)');
  ok(Math.abs(rp.off - bar * 4) < .01 && Math.abs(rp.len - 3) < .05, 'it remembers where in the song it starts and how long it is');
  ok(rp.audio && !rp.video && rp.page && !rp.thumb && /Share a track/.test(rp.head), 'Studio Replay plays it as audio, with Save, Share page and no thumbnail');
  ok(/responsible for what you share/i.test(rp.note) && /permission/.test(rp.note) && /does not upload/.test(rp.note), 'the notice is on screen: you are responsible, get permission, nothing is uploaded');

  /* ---- the first share asks once ---- */
  ok(await p.evaluate(() => window.__daily.CFG.shareOk == null), 'nothing has been acknowledged yet');
  await p.click('#kitPage'); await wait(300);
  const gate = await p.evaluate(() => { const d = document.getElementById('shareOk'); return d && { text: d.textContent, dis: document.getElementById('shareOkGo').disabled, link: !!d.querySelector('a[href="legal/#terms"]') }; });
  ok(gate && gate.dis && /permission/.test(gate.text) && /not responsible/.test(gate.text) && gate.link, 'before the first share: a notice, a box to tick, Continue disabled until it is ticked, and the terms linked');
  await p.click('#shareOkChk');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }), p.click('#shareOkGo')]);
  const html = fs.readFileSync(await dl.path(), 'utf8');
  ok(/_share\.html$/.test(dl.suggestedFilename()) && (await p.evaluate(() => window.__daily.CFG.shareOk)) === 1, 'ticking it and Continue makes the share page, and it is remembered (' + dl.suggestedFilename() + ')');
  const data = JSON.parse(html.match(/<script type="application\/json" id="d">([\s\S]*?)<\/script>/)[1]);
  ok(/<audio id="au"[^>]*src="data:audio\//.test(html) && data.kind === 'audio', 'the page holds the track itself (one file, nothing to fetch)');
  ok(data.secs.map(s => s.name).join() === 'Verse 1' && Math.abs(data.secs[0].t) < .01 && Math.abs(data.dur - 3) < .05, 'only the sections the track covers, timed from the start of the track (' + data.secs.map(s => s.name + '@' + s.t.toFixed(2)).join(', ') + ')');
  ok(data.secs[0].lines[0].chords.trim().split(/\s+/).join(' ') === 'E B/D# C#m' && data.secs[0].lines[0].text.startsWith('Lanterns'), 'the words with their chords over them, as on the sheet');
  ok(/<span class="sg"><b>E<\/b>Lanterns swing <\/span><span class="sg"><b>B\/D#<\/b>along the harbour <\/span><span class="sg"><b>C#m<\/b>wall<\/span>/.test(html), 'each chord is set over its own word (a chord-and-words segment each), so it lines up in any font');
  ok(/responsible for having the right to share/.test(html) && /does not host, publish or review/.test(html), 'the page itself says who is responsible for sharing it');

  /* ---- after that: no question, straight to the file ---- */
  const [dl2] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }), p.click('#kitPage')]);
  ok(!!dl2 && !(await p.$('#shareOk')), 'the next share page is made at once');
  await p.evaluate(() => { const d = document.getElementById('kitReplayDlg'); if (d) d.close(); });

  /* ---- a video's share page ---- */
  const vid = await p.evaluate(async () => {
    const D = window.__daily, blob = new Blob([new Uint8Array(4000)], { type: 'video/webm' }); D.kitKeep(blob, 'stage', { off: 2 }); D.kitReplay(); await new Promise(r => setTimeout(r, 200));
    return { thumb: !!document.querySelector('#kitReplayDlg #kitThumbFrame'), video: !!document.querySelector('#kitReplayDlg video'), note: !!document.querySelector('#kitReplayDlg .share-note') };
  });
  ok(vid.video && vid.thumb && vid.note, 'a stage video opens in Studio Replay with the notice');
  const [dl3] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }), p.click('#kitPage')]);
  const vh = fs.readFileSync(await dl3.path(), 'utf8'), vd = JSON.parse(vh.match(/<script type="application\/json" id="d">([\s\S]*?)<\/script>/)[1]);
  ok(/<video id="au" playsinline[^>]*src="data:video\/webm/.test(vh) && vd.kind === 'video' && !vd.nosync && Math.abs(vd.secs[0].t + 2) < .01, 'a video share page plays the video, with the words timed from where the song was when it started');
  await p.evaluate(() => { const D = window.__daily; document.getElementById('kitReplayDlg').close(); D.kitKeep(new Blob([new Uint8Array(3000)], { type: 'video/webm' }), 'screen'); D.kitReplay(); });
  const [dl4] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }), p.click('#kitPage')]);
  ok(JSON.parse(fs.readFileSync(await dl4.path(), 'utf8').match(/id="d">([\s\S]*?)<\/script>/)[1]).nosync === true, 'a recording that did not follow the song (a screen recording) gets the words without timing');
  await p.evaluate(() => document.getElementById('kitReplayDlg').close());

  /* ---- cancelling, and the song's own share page ---- */
  const id2 = await p.evaluate(`(${mkTake.toString()})(8, 0, 'Long take')()`);
  await p.evaluate(tid => { const D = window.__daily; D.kitTake(D.TAKES.find(x => x.id === tid), true); }, id2); await wait(700);
  await p.evaluate(() => document.getElementById('kitEnc').close()); await wait(900);
  ok(await p.evaluate(() => !window.__daily.KIT.enc && !document.getElementById('kitReplayDlg') && window.__daily.KIT.lastKind === 'screen'), 'closing the progress cancels it: nothing is kept and nothing opens');
  await p.evaluate(() => { const D = window.__daily; delete D.CFG.shareOk; D.shareMake(); }); await wait(300);
  ok(await p.evaluate(() => !!document.getElementById('shareOk') && !window.__daily.SREC.on), 'the song’s share page (Export) asks first too, and nothing starts until you agree');
  await p.evaluate(() => document.getElementById('shareOk').close());

  /* ---- the terms ---- */
  const dist = t.path.join(__dirname, '..', 'dist', 'legal', 'index.html');
  const terms = fs.readFileSync(t.path.join(__dirname, '..', 'TERMS.md'), 'utf8');
  ok(/You are the publisher/.test(terms) && /Share only what you have the right to share/.test(terms) && /not liable/.test(terms), 'TERMS.md says who publishes, what may be shared and who is responsible');
  if (fs.existsSync(dist)) ok(/<section id="terms">/.test(fs.readFileSync(dist, 'utf8')), 'the legal page carries the terms of use (#terms)');
  ok(!t.errs.length, 'no console / page / network errors' + (t.errs.length ? ': ' + t.errs.join(' | ') : ''));
});
