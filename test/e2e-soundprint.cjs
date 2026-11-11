/* Soundprint (2.61): a sound becomes a print (about 1 kB), four worlds drawn from it, a reading of its music and an ambient piece
   grown from it. A made-up song (A minor: Am F C G, 100 BPM, kick on the beat) goes in as a file; the print, its reading and its piece
   are checked, then each world, the exports, the link (the print only: the receiver sees the same worlds and the same reading, with
   no sound), Your soundprints, Start a song from it, the microphone, and that a link with markup in its title shows it as text.
   SHOTS=dir saves a picture of each world there. */
const { suite } = require('./lib.cjs');
const fs = require('node:fs'), path = require('node:path');
suite('e2e-soundprint', async t => {
  const { ok, wait, poll } = t, p = await t.open({ w: 1440, h: 960 }), ev = (fn, a) => p.evaluate(fn, a), shots = process.env.SHOTS;
  const req = []; p.on('request', r => { const u = new URL(r.url()); if (u.origin !== new URL(t.BASE).origin) req.push(u.href); });

  /* the song: 16 s of A minor, Am F C G two bars each at 100 BPM, a kick on every beat */
  const sr = 44100, secs = 19.2, n = Math.round(secs * sr), L = new Float32Array(n), beat = .6, prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], hz = m => 440 * Math.pow(2, (m - 69) / 12);
  for (let b = 0; b * beat < secs; b++) {
    const at = Math.round(b * beat * sr), ch = prog[Math.floor(b / 8) % 4];
    for (let i = 0; i < sr * beat && at + i < n; i++) { const tt = i / sr, env = Math.exp(-tt * 2.2); let v = .5 * Math.sin(2 * Math.PI * 50 * tt) * Math.exp(-tt * 22); ch.forEach(m => { v += .1 * env * (Math.sin(2 * Math.PI * hz(m) * tt) + .3 * Math.sin(4 * Math.PI * hz(m) * tt)); }); v += .12 * env * Math.sin(2 * Math.PI * hz(ch[0] - 12) * tt); L[at + i] += v; }
  }
  const song = t.tmp('soundprint-song.wav', t.wav(L, sr));
  const R0 = await ev(() => ({ done: !!window.__daily.ROOM.done.print, files: Object.keys(window.__daily.ROOM.files || {}).includes('print') }));
  ok(R0.files && !R0.done, 'Soundprint is a room: the studio starts without it');

  /* the door: Export ▸ Soundprint… (here: the function the button calls) */
  await ev(() => window.__daily.prtOpen()); await poll(() => ev(() => !!document.getElementById('prtRec')), 15000);
  const C = await ev(() => ({ room: !!window.__daily.ROOM.done.print, btns: ['prtRec', 'prtFile', 'prtSong'].map(id => !!document.getElementById(id)), lede: document.querySelector('.prt-lede').textContent }));
  ok(C.room && C.btns.every(Boolean), 'it opens (and loads, once): record a sound, an audio file, this song');
  ok(/sound stays on this device/.test(C.lede), 'and says the sound stays on this device');

  /* a file → the print */
  await p.setInputFiles('#prtDlg input[type=file]', song);
  ok(await poll(() => ev(() => !!document.getElementById('prtCv') && !!window.__daily.PRT.cur), 30000), 'an audio file becomes a print');
  const A = await ev(() => { const D = window.__daily, P = D.PRT.cur, R = D.PRT.read; return { id: P.id, bytes: P.bytes.length, key: R.key, bpm: P.bpm, chords: R.chords.map(c => c.sym), line: R.line, dur: P.dur, on: P.on.length, title: P.title, tonal: P.tonal, ids: document.querySelector('.prt-id').textContent }; });
  ok(A.bytes > 900 && A.bytes < 1400, 'the print is small: ' + A.bytes + ' bytes for ' + A.dur + ' s of sound');
  ok(A.key === 'A minor', 'it hears the key: ' + A.key);
  ok(Math.abs(A.bpm - 100) <= 3, 'and the pulse: ' + A.bpm + ' BPM (100 played)');
  ok(A.chords.join(' ') === 'Am F C G', 'and the harmony, in order: ' + A.chords.join(' – '));
  ok(A.on >= 24 && A.on <= 40, 'its onsets are the beats (' + A.on + ' found, 32 played)');
  ok(/^A .+ sound, .+: .+ in A minor, moving at about \d+ BPM\. Its strongest colour is [A-G]#?b?\.$/.test(A.line), 'its reading in one line: “' + A.line + '”');
  ok(/soundprint-song$/.test(A.title) && /◎ [0-9A-F]{4}·[0-9A-F]{4} · 0:19/.test(A.ids), 'it is named after the file, with its ID and length (' + A.ids + ')');

  /* the same sound, the same print; a different sound, a different one */
  const D1 = await ev(async () => {
    const D = window.__daily, x = D.PRT.src.x, sr = D.PRT.src.sr, a = D.prtPack(D.prtAnalyze(x, sr)), b = D.prtPack(D.prtAnalyze(x, sr)), same = a.length === b.length && a.every((v, i) => v === b[i]);
    const nz = new Float32Array(sr * 8); let s = 3; for (let i = 0; i < nz.length; i++) { s = (s * 16807) % 2147483647; nz[i] = (s / 2147483647 - .5) * .4 * (.6 + .4 * Math.sin(i / sr * 2)); }
    const N = D.prtUnpack(D.prtPack(D.prtAnalyze(nz, sr))), RN = D.prtRead(N); return { same, id: D.prtUnpack(a).id, nid: N.id, ntonal: N.tonal, nkind: RN.kind, nbpm: N.bpm, npc: N.pconf, pc: D.PRT.cur.pconf };
  });
  ok(D1.same && D1.id === A.id, 'the same sound makes the same print (' + A.id + ')');
  ok(D1.nid !== A.id && D1.ntonal < .35 && /texture/.test(D1.nkind) && D1.nbpm === 0, 'noise makes another: texture, no pulse (tonal ' + D1.ntonal.toFixed(2) + ', “' + D1.nkind + '”; pulse ' + D1.nbpm + ' at ' + D1.npc.toFixed(2) + ', the song’s ' + D1.pc.toFixed(2) + ')');

  /* the sound decides the kind of picture: a calm pad, rain and fast drums get different classes, grounds and colours, at any sample rate */
  const V = await ev(() => {
    const D = window.__daily, hz = m => 440 * Math.pow(2, (m - 69) / 12); let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const mk = (sr, sec, fn) => { const n = Math.round(sec * sr), x = new Float32Array(n); fn(x, n, sr); let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(x[i])); for (let i = 0; i < n; i++) x[i] /= pk * 1.1 || 1; return x; };
    const pad = (x, n, sr) => { const prog = [[48, 60, 64, 67], [45, 57, 60, 64], [41, 57, 60, 65], [43, 55, 59, 62]]; for (let i = 0; i < n; i++) { const t = i / sr, ch = prog[Math.floor(t / 6) % 4], sw = .3 + .7 * Math.pow(Math.sin(Math.PI * ((t % 6) / 6)), 2); let v = 0; ch.forEach(m => { v += Math.sin(2 * Math.PI * hz(m) * t) * .2; }); x[i] = v * sw; } };
    const rain = (x, n, sr) => { sd = 11; let lp = 0; for (let i = 0; i < n; i++) { lp = .7 * lp + .3 * (rnd() * 2 - 1); x[i] = lp * .25; } for (let k = 0; k < 120; k++) { const at = Math.floor(rnd() * (n - 2000)), f = 2000 + rnd() * 3000; for (let i = 0; i < Math.round(sr * .04); i++) x[at + i] += .5 * rnd() * Math.sin(2 * Math.PI * f * i / sr) * Math.exp(-i / (sr * .005)); } };
    const drums = (x, n, sr) => { sd = 5; const b8 = 60 / 150 / 2; for (let b = 0; b * b8 < n / sr; b++) { const at = Math.round(b * b8 * sr); if (b % 4 === 0) for (let i = 0; i < sr * .2 && at + i < n; i++) x[at + i] += .9 * Math.sin(2 * Math.PI * 55 * i / sr) * Math.exp(-i / (sr * .06)); if (b % 4 === 2) for (let i = 0; i < sr * .15 && at + i < n; i++) x[at + i] += .6 * (rnd() * 2 - 1) * Math.exp(-i / (sr * .04)); for (let i = 0; i < sr * .04 && at + i < n; i++) x[at + i] += .25 * (rnd() * 2 - 1) * Math.exp(-i / (sr * .008)); const bm = [40, 40, 47, 45][Math.floor(b / 8) % 4]; for (let i = 0; i < sr * b8 * .9 && at + i < n; i++) x[at + i] += .3 * Math.sign(Math.sin(2 * Math.PI * hz(bm) * i / sr)) * Math.exp(-i / (sr * .2)); } };
    const gen = (fn, sr, sec) => { const P = D.prtUnpack(D.prtPack(Object.assign(D.prtAnalyze(mk(sr, sec, fn), sr), { title: '', by: '', day: 1 }))), G = D.prtGenome(P), c = document.createElement('canvas'); c.width = c.height = 160; D.prtDraw(c.getContext('2d'), 160, 160, P, 'print', 1, { still: true }); return { cls: G.cls, ground: G.ground, notes: G.notes.join(), key: G.R.key, bpm: P.bpm, px: c.getContext('2d').getImageData(0, 0, 160, 160).data }; };
    const A = gen(pad, 22050, 24), B = gen(rain, 22050, 16), C = gen(drums, 22050, 14), A2 = gen(pad, 44100, 24), C2 = gen(drums, 48000, 14);
    const diff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i += 4) d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return d / (a.length / 4) / 765; };
    return { k: [A, B, C].map(x => x.cls + ' on ' + x.ground + ' (' + x.notes + ')'), cls: new Set([A, B, C].map(x => x.cls)).size, gr: new Set([A, B, C].map(x => x.ground)).size, d: [diff(A.px, B.px), diff(A.px, C.px), diff(B.px, C.px)], same: [A.cls === A2.cls && A.ground === A2.ground && A.key === A2.key, C.cls === C2.cls && C.ground === C2.ground && C.key === C2.key && Math.abs(C.bpm - C2.bpm) <= 2], sr: [A2.cls + ' ' + A2.ground + ' ' + A2.key, C2.cls + ' ' + C2.ground + ' ' + C2.key + ' ' + C2.bpm] };
  });
  ok(V.cls === 3 && V.gr >= 2 && V.d.every(x => x > .08), 'a calm pad, rain and fast drums make different kinds of print: ' + V.k.join(' · ') + ' (pictures ' + V.d.map(x => Math.round(x * 100) + '%').join(', ') + ' apart)');
  ok(V.same.every(Boolean), 'and a sound reads the same at 22.05, 44.1 and 48 kHz (' + V.sr.join(' · ') + ')');

  /* the worlds */
  const sig = [];
  for (const w of ['print', 'flow', 'terrain', 'bloom', 'harmono']) {
    await p.click('.prt-worlds button[data-w="' + w + '"]'); await wait(700);
    const s = await ev(() => { const cv = document.getElementById('prtCv'), g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height).data; let lit = 0, hue = new Set(), sum = 0; for (let i = 0; i < d.length; i += 4 * 7) { const v = d[i] + d[i + 1] + d[i + 2]; sum += v; if (Math.abs(d[i] - d[i + 1]) + Math.abs(d[i + 1] - d[i + 2]) > 60) { lit++; hue.add(Math.round(Math.atan2(Math.sqrt(3) * (d[i + 1] - d[i + 2]), 2 * d[i] - d[i + 1] - d[i + 2]) * 3)); } } return { lit, hues: hue.size, sum, w: cv.width, sel: document.querySelector('.prt-worlds .on').dataset.w }; });
    sig.push(s.sum); ok(s.sel === w && s.lit > 150 && s.hues >= 4, 'the ' + w + ' world draws in colour (' + s.lit + ' coloured samples, ' + s.hues + ' hues, ' + s.w + ' px)');
    if (shots) await p.locator('#prtCv').screenshot({ path: path.join(shots, 'soundprint-' + w + '.png') });
  }
  ok(new Set(sig).size === 5, 'and each world is its own picture');
  if (shots) { await p.click('.prt-worlds button[data-w="print"]'); await wait(500); await p.locator('#prtDlg').screenshot({ path: path.join(shots, 'soundprint-dialog.png') }); }

  /* the piece */
  await p.click('#prtPlay');
  ok(await poll(() => ev(() => !!window.__daily.PRT.play), 60000), 'Play the piece grows it and plays it: ' + await ev(() => document.getElementById('prtSay').textContent));
  const PC = await ev(async () => {
    const D = window.__daily, P = D.PRT.piece, sec = i => { let s = 0; for (let k = i * P.sr; k < (i + 1) * P.sr; k++) s += P.l[k] * P.l[k]; return Math.sqrt(s / P.sr); };
    let pk = 0; for (let i = 0; i < P.l.length; i++) pk = Math.max(pk, Math.abs(P.l[i]), Math.abs(P.r[i]));
    const quiet = [2, Math.floor(P.len / 2), P.len - 8].map(sec), Q = await D.prtCompose(D.PRT.cur, null), R2 = await D.prtCompose(D.PRT.cur, null); let same = Q.l.length === R2.l.length, md = 0; for (let i = 0; i < Q.l.length; i += 97) md = Math.max(md, Math.abs(Q.l[i] - R2.l[i])); same = same && md < 1e-3;
    let diff = 0; for (let i = 0; i < Math.min(P.l.length, Q.l.length); i += 997) diff += Math.abs(P.l[i] - Q.l[i]);
    return { md, len: P.len, pk, quiet, woven: P.woven, same, diff, stereo: P.l[P.sr * 10] !== P.r[P.sr * 10] };
  });
  ok(PC.len >= 36 && PC.len <= 96 && Math.abs(PC.pk - .89) < .02, 'the piece is ' + PC.len + ' s long, its peaks at −1 dBFS');
  ok(PC.quiet.every(v => v > .005) && PC.stereo, 'it sounds all the way through, in stereo (RMS ' + PC.quiet.map(v => v.toFixed(3)).join(', ') + ')');
  ok(PC.woven && PC.diff > 1, 'here it weaves in the recording itself; without it, the piece is grown from the print alone');
  ok(PC.same, 'and from the print alone it is the same piece every time, on any device (largest difference ' + PC.md.toExponential(1) + ')');
  await wait(1200); const moving = await ev(() => { const D = window.__daily; return { t: D.PRT.play && (D.E.ctx.currentTime - D.PRT.play.t0) / D.PRT.play.len, btn: document.getElementById('prtPlay').textContent }; });
  ok(moving.t > 0 && moving.btn === '■ Stop', 'the print draws itself as the piece plays');
  await ev(() => window.__daily.audioKill(true)); ok(await ev(() => !window.__daily.PRT.play && document.getElementById('prtPlay').textContent === '▶ Play the piece'), 'the Audio kill switch stops it');
  await ev(() => window.__daily.audioResume());

  /* exports */
  const art = await ev(() => { const c = window.__daily.prtArtwork(512); return { w: c.width, h: c.height }; }); ok(art.w === 512 && art.h === 512 + Math.round(512 * .13), 'the artwork is square, with its title and reading underneath (' + art.w + ' × ' + art.h + ' at 512)');
  const [dl1] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('#prtPng')]); const png = fs.readFileSync(await dl1.path());
  ok(/\.png$/.test(dl1.suggestedFilename()) && png.readUInt32BE(16) === 2048 && png.readUInt32BE(20) === 2048 + Math.round(2048 * .13), '⤓ Artwork saves a 2048-pixel PNG (' + dl1.suggestedFilename() + ', ' + Math.round(png.length / 1024) + ' kB)');
  const [dl2] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('#prtWav')]); const wv = fs.readFileSync(await dl2.path());
  ok(/\.wav$/.test(dl2.suggestedFilename()) && wv.toString('ascii', 0, 4) === 'RIFF' && wv.length > PC.len * 44100 * 4 - 1000, '⤓ The piece saves as a WAV (' + (wv.length / 1048576).toFixed(1) + ' MB)');
  const vidOk = await ev(() => !!(HTMLCanvasElement.prototype.captureStream && window.MediaRecorder));
  if (vidOk) {
    const dlv = p.waitForEvent('download', { timeout: 30000 }); await p.click('#prtVid'); await wait(2500);
    ok(await ev(() => document.getElementById('prtVid').textContent === '■ Stop recording' && !!window.__daily.PRT.play), '⏺ Video records the world while the piece plays');
    await p.click('#prtVid'); const v = await dlv; const vb = fs.readFileSync(await v.path()); ok(/\.(webm|mp4)$/.test(v.suggestedFilename()) && vb.length > 20000, 'stopping it saves the video (' + v.suggestedFilename() + ', ' + Math.round(vb.length / 1024) + ' kB)');
  }

  /* the link carries the print, not the sound */
  await p.fill('#prtTitle', 'Harbour at dusk'); await p.press('#prtTitle', 'Tab');
  const url = await ev(() => window.__daily.prtCopyLink());
  ok(/#p=1z[A-Za-z0-9_-]+$/.test(url) && url.length < 2200, 'Copy link: the print in a link of ' + url.length + ' characters (' + await ev(() => document.getElementById('prtSay').textContent) + ')');
  const B = await t.open({ w: 1280, h: 900, boot: false }); await B.goto(url); await wait(4000);
  const BR = await B.evaluate(() => { const D = window.__daily, P = D.PRT && D.PRT.cur; return P && { id: P.id, title: document.getElementById('prtTitle').value, line: document.getElementById('prtLine').textContent, from: !!document.querySelector('.prt-from'), hear: !!document.getElementById('prtHear'), weave: !!document.getElementById('prtWeave'), hash: location.hash, kept: !!document.getElementById('prtKeepBtn') }; });
  ok(BR && BR.id === A.id && BR.title === 'Harbour at dusk' && BR.line === A.line, 'opening the link shows the same print (◎ ' + (BR && BR.id) + '), title and reading');
  ok(BR && BR.from && !BR.hear && !BR.weave && BR.hash === '', 'it says the sound stayed with the sender; there is no sound to play, and the address is cleaned');
  const BP = await B.evaluate(async () => { const D = window.__daily, Q = await D.prtCompose(D.PRT.cur, null), h = []; for (let i = 0; i < Q.l.length; i += 997) h.push(Q.l[i]); return { h, kept: D.prtShelfRead().length }; });
  const AP = await ev(async () => { const D = window.__daily, Q = await D.prtCompose(D.PRT.cur, null), h = []; for (let i = 0; i < Q.l.length; i += 997) h.push(Q.l[i]); return h; });
  ok(BP.h.length === AP.length && BP.h.every((v, i) => Math.abs(v - AP[i]) < 1e-3) && BP.kept === 0, 'the receiver grows the same piece from it; it is not kept until they choose');
  /* on a phone, it is one column that fits */
  const Ph = await t.open({ w: 390, h: 844, boot: false }); await Ph.goto(url); await wait(4000);
  const PF = await Ph.evaluate(() => { const d = document.getElementById('prtDlg'), cv = document.getElementById('prtCv'); return d && { fits: d.getBoundingClientRect().right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1, cv: Math.round(cv.getBoundingClientRect().width), side: document.querySelector('.prt-side').getBoundingClientRect().top > cv.getBoundingClientRect().bottom }; });
  ok(PF && PF.fits && PF.cv > 300 && PF.side, 'on a phone it fits the screen, the world on top (' + (PF && PF.cv) + ' px) and the reading below');
  if (shots) await Ph.screenshot({ path: path.join(shots, 'soundprint-phone.png') }); await Ph.ctx.close();
  await B.click('#prtKeepBtn'); ok(await B.evaluate(() => window.__daily.prtShelfRead().length === 1 && !document.getElementById('prtKeepBtn')), '☆ Keep puts it in their soundprints');
  await B.ctx.close();

  /* Your soundprints */
  await p.click('#prtBack'); await wait(400);
  const SH = await ev(() => [...document.querySelectorAll('.prt-card .prt-open span')].map(s => s.textContent)); ok(SH.length >= 1 && SH[0] === 'Harbour at dusk', 'Your soundprints keeps it, newest first, renamed (' + SH.join(', ') + ')');
  await p.click('.prt-card .prt-open'); ok(await poll(() => ev(() => !!document.getElementById('prtCv') && window.__daily.PRT.cur.id === document.querySelector('.prt-id').textContent.replace(/[^0-9A-F]/g, '').slice(0, 8).toLowerCase()), 5000), 'and opens it again');

  /* a link with markup in its title */
  const evil = await ev(async () => { const D = window.__daily, P = D.prtUnpack(D.PRT.cur.bytes.slice()); P.title = '<img src=x onerror=alert(1)>Hi'; const Q = D.prtUnpack(D.prtPack(P)); return D.prtCode(Q); });
  await ev(c => { location.hash = '#p=' + c; }, evil); await wait(1500);
  ok(await ev(() => !document.querySelector('#prtDlg img') && /^img src=x onerror=alert\(1\)Hi$/.test(document.getElementById('prtTitle').value)), 'a title with markup arrives as plain text');
  await ev(() => { location.hash = '#p=1zAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; }); await wait(1200);
  ok(await ev(() => /could not be opened/.test((document.getElementById('prtSay') || {}).textContent || '')), 'a broken link says so');

  /* the microphone (Chromium's test tone) */
  if (t.engine === 'chromium') {
    await ev(() => window.__daily.prtOpen()); await wait(400); await p.click('#prtRec'); await wait(2600);
    ok(await ev(() => !document.getElementById('prtRecBox').hidden && /^0:0[1-3] \/ 1:00$/.test(document.getElementById('prtRecT').textContent)), '● Record a sound records from the microphone, up to a minute');
    await p.click('#prtRecGo'); ok(await poll(() => ev(() => !!document.getElementById('prtCv') && /^A sound · /.test(window.__daily.PRT.cur.title)), 20000), 'and stopping makes its print (' + await ev(() => window.__daily.PRT.cur && window.__daily.PRT.cur.title) + ')');
  }

  /* a look in the Visuals: the open song's own print, moving with it */
  await ev(() => { const d = document.getElementById('prtDlg'); if (d) d.close(); const D = window.__daily; D.dockGo('vis'); D.vzSetMode('sprint', true); });
  ok(await poll(() => ev(() => !!(window.__daily.S.sprint && window.__daily.S.sprint.c)), 90000), 'Soundprint is a look in the Visuals: choosing it makes the open song’s print and keeps it with the song');
  await wait(1700);
  const LK = await ev(() => { const D = window.__daily, list = [...document.querySelectorAll('#pane-vis .seg [data-m]')].map(b => b.dataset.m), bar = document.getElementById('prtBar'), cv = D.UI.vcv, d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let lit = 0; for (let i = 0; i < d.length; i += 4 * 13) if (Math.abs(d[i] - d[i + 1]) + Math.abs(d[i + 1] - d[i + 2]) > 40) lit++; return { third: list[2], bar: !!bar && bar.style.display !== 'none', worlds: bar ? bar.querySelectorAll('[data-pw]').length : 0, say: (document.getElementById('prtBarSay') || {}).textContent || '', lit, bytes: D.S.sprint.c.length }; });
  ok(LK.third === 'sprint' && LK.bar && LK.worlds === 5 && /^Its print is /.test(LK.say) && LK.lit > 30, 'it sits beside Hex Resonance and Concert, with its five worlds under it, and draws the song (“' + LK.say + '”, ' + LK.bytes + ' characters kept with the song)');
  for (const w of ['flow', 'terrain', 'bloom', 'harmono', 'print']) { await p.click('#prtBar [data-pw="' + w + '"]'); await wait(500); }
  ok(await ev(() => window.__daily.CFG.prtWorld === 'print' && document.querySelector('#prtBar [data-pw="print"]').classList.contains('on')), 'its worlds switch from the row, and the choice is remembered');
  await ev(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('Space'); await wait(2500);
  const PL = await ev(() => { const D = window.__daily; return { playing: D.T.playing, sig: D.S.sprint.sig }; });
  ok(PL.playing, 'it plays with the song (the print grows from its core as the song goes)');
  await ev(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('Space'); await wait(500);
  await ev(() => { const D = window.__daily; D.S.bpm += 7; D.commit(false); }); await wait(2600);
  ok(/has changed/.test(await ev(() => document.getElementById('prtBarSay').textContent)), 'when the song changes, the row says its print is from before');
  await p.click('#prtAgain'); ok(await poll(() => ev(sig => { const D = window.__daily; return D.S.sprint.sig !== sig && !/has changed|Listening/.test(document.getElementById('prtBarSay').textContent); }, PL.sig), 90000), '⟳ Listen again makes it again from the song as it is now');
  await ev(() => window.__daily.vzSetMode('hex', true));

  /* start a song from it */
  await ev(async () => { const D = window.__daily; D.PRT.src = null; D.prtOpen(); }); await wait(300);
  await p.click('.prt-card .prt-open:has-text("Harbour at dusk")'); await wait(500); await p.click('#prtSongGo');
  ok(await poll(() => ev(() => { const S = window.__daily.S; return S.title === 'Harbour at dusk' && !document.getElementById('prtDlg'); }), 15000), 'Start a song from it makes a new song');
  const SG = await ev(() => { const S = window.__daily.S; return { key: S.key, minor: S.minor, bpm: S.bpm, chords: S.sections[0].bars.map(b => b.chord).join(' ') }; });
  ok(SG.key === 9 && SG.minor && Math.abs(SG.bpm - 100) <= 3 && /^Am F C G Am F C G$/.test(SG.chords), 'in its key and tempo, with its chords: A minor, ' + SG.bpm + ' BPM, ' + SG.chords);

  ok(req.length === 0, 'nothing was fetched from anywhere else (' + (req.join(', ') || 'none') + ')');
});
