/* Load your copy, and Make it ours (2.59). A made-up record (drums with accents that vary from bar to bar, a bass line and chords, 48 s)
   is the song's backing track. Its link names it and carries a fingerprint (never the audio); "someone else's copy" (the same record
   with 2.5 s more at the start and quieter) is loaded with the song left as it is, and the song's first downbeat lands at the same
   place in the music. Then Make it ours: chords, tempo, groove and the band; the record muted; nothing of it in the next link. */
const { suite } = require('./lib.cjs');
suite('e2e-yourcopy', async t => {
  const { ok, wait, poll } = t, p = await t.open(); const ev = (fn, a) => p.evaluate(fn, a);
  const make = async (lead, gain, name, sd, tempo, prog) => ev(async ({ lead, gain, name, sd, tempo, prog }) => {
    const sr = 44100, secs = 48, n = Math.round((secs + lead) * sr), L = new Float32Array(n), off = Math.round(lead * sr), bpm = tempo || 120, beat = 60 / bpm; let seed = sd || 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const chords = prog || [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], root = 48;
    for (let b = 0; b * beat < secs; b++) {
      const at = off + Math.round(b * beat * sr), bar = Math.floor(b / 4), acc = .4 + .6 * rnd(), fill = rnd() > .8;
      for (let i = 0; i < sr * .18 && at + i < n; i++) L[at + i] += acc * .8 * Math.sin(2 * Math.PI * 55 * i / sr) * Math.exp(-i / (sr * .05));      /* kick, its loudness different every beat */
      const hh = at + Math.round(beat * sr / 2); for (let i = 0; i < sr * .04 && hh + i < n; i++) L[hh + i] += (fill ? .5 : .15) * (rnd() * 2 - 1) * Math.exp(-i / (sr * .01));
      const ch = chords[bar % 4], f0 = 440 * Math.pow(2, (root + ch[0] - 69) / 12); for (let i = 0; i < beat * sr && at + i < n; i++) { const tt = i / sr; let v = .12 * Math.sin(2 * Math.PI * f0 / 2 * tt); ch.forEach(k => { v += .05 * Math.sin(2 * Math.PI * 440 * Math.pow(2, (root + 12 + k - 69) / 12) * tt); }); L[at + i] += v * Math.min(1, i / 400); }
    }
    for (let i = 0; i < n; i++) L[i] *= gain;
    const blob = window.__daily.encodeWav ? window.__daily.encodeWav([L, L], sr, 16) : null; window.__yc = window.__yc || {}; window.__yc[name] = new File([blob], name + '.wav', { type: 'audio/wav' }); return n / sr;
  }, { lead, gain, name, sd, tempo, prog });
  const hasEnc = await ev(() => typeof window.__daily.encodeWav === 'function'); ok(hasEnc, 'the test can make WAV files in the page'); if (!hasEnc) return;
  await make(0, 1, 'orig'); await make(2.5, .7, 'copy'); await make(0, 1, 'other', 12345, 112, [[2, 5, 9], [10, 14, 17], [7, 10, 14], [0, 3, 7]]);

  /* the sender: a song over the record */
  await ev(async () => { const D = window.__daily; await D.projCreate('blank', { form: 'empty' }); await D.stemLoad(window.__yc.orig); });
  ok(await poll(() => ev(() => !!(window.__daily.STM.an && window.__daily.STM.ch)), 120000), 'the record loads and is split into stems');
  const A = await ev(() => { const D = window.__daily, fp = D.ycPrint(); D.S.title = 'Over the record'; D.commit(false); const t0 = D.STM.an.beats[D.STM.an.down] / D.STM.an.fps; return { fp, t0, bpm: D.S.bpm }; });
  ok(A.fp && A.fp.fp.length > 300 && A.fp.fp.length < 700 && A.fp.t === 'orig', 'the fingerprint is small (' + A.fp.fp.length + ' characters) and names the record; no audio');
  const back = await ev(async () => { const D = window.__daily, url = await D.slLink(), s = await D.slRead(url.slice(url.indexOf('#'))); return { ref: s.trackRef, len: url.length, title: s.title }; });
  ok(back.ref && back.ref.fp === A.fp.fp && back.ref.t === 'orig' && back.ref.d === 48, 'the song link carries it (the link is ' + back.len + ' characters)');

  /* the receiver: their own copy, 2.5 s later and quieter */
  await ev(async ref => { const D = window.__daily; D.stemUnload ? D.stemUnload() : null; await D.projCreate('import', { song: Object.assign(JSON.parse(JSON.stringify(D.S)), { trackRef: ref, title: 'Over the record' }) }); }, back.ref);
  ok(await ev(() => !!document.getElementById('sbYourCopy') && /Load your copy of “orig”/.test(document.getElementById('sbYourCopy').textContent)), 'the song bar offers ♪ Load your copy of “orig”');
  const before = await ev(() => JSON.stringify([window.__daily.S.title, window.__daily.S.bpm, window.__daily.S.sections.length]));
  await ev(async () => { const D = window.__daily; await D.stemLoad(window.__yc.copy, { noFill: true }); });
  await poll(() => ev(() => !!window.__daily.STM.an), 120000);
  const M = await ev(() => { const D = window.__daily, m = D.ycMatch(D.S.trackRef); const t0 = D.ycSetStart(m.t); return { t: m.t, score: m.score, t0 }; });
  ok(Math.abs(M.t0 - (A.t0 + 2.5)) < .08 && M.score > .6, 'their copy lines up: the song starts ' + M.t0.toFixed(3) + ' s in (the original’s first downbeat ' + A.t0.toFixed(3) + ' s + 2.5 s), match ' + Math.round(M.score * 100) + '%');
  ok(await ev(b => JSON.stringify([window.__daily.S.title, window.__daily.S.bpm, window.__daily.S.sections.length]) === b, before), 'and loading their copy didn’t change the song (title, tempo, sections)');

  const X = await ev(async () => { const D = window.__daily, keep = D.STM.file; await D.stemLoad(window.__yc.other, { noFill: true }); const m = D.ycMatch(D.S.trackRef); await D.stemLoad(window.__yc.copy, { noFill: true }); return m.score; });
  ok(X < .45, 'a different record (another tempo, other chords and drums) does not pass as a match (' + Math.round(X * 100) + '%), so the studio would say so instead of lining up the wrong thing');
  /* make it ours */
  const O = await ev(() => { const D = window.__daily; D.ycMakeOurs(); const S = D.S; return { band: [S.band.drumsOn, S.band.bassOn, S.band.compOn], chords: S.sections.some(s => s.bars.some(b => b.chord)), ours: !!(S.track && S.track.ours), mute: D.STM.mute, ref: !!S.trackRef }; });
  ok(O.band.every(Boolean) && O.chords && O.ours && O.mute && !O.ref, '✦ Make it ours: the band (drums, bass, rhythm) plays the song’s chords, the record is muted, and the song is marked as its own');
  ok(await ev(async () => { const D = window.__daily, url = await D.slLink(), s = await D.slRead(url.slice(url.indexOf('#'))); return !s.trackRef; }), 'and its next link no longer names a record');
  ok(await ev(() => { window.__daily.undo(); return !(window.__daily.S.track && window.__daily.S.track.ours); }), 'Undo takes it back');
});
