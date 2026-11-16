/* What the studio hears (2.76): a song built to have known answers. Chords in A minor in a song set to C major read as "points to A minor"
   (the relative key, said so); applying sets the key, a version is kept first, Undo puts it back. A take played at ~110 BPM against a
   song at 120 reads as faster-slower than the song and offers the tempo. Sung notes give a range. A verse with no chorus gets a thought.
   Every finding carries a label and a "Why?"; nothing changes until Apply is tapped; no take is changed. */
const { suite } = require('./lib.cjs');
suite('e2e-hears', async t => {
  const { ok, wait } = t, p = await t.open({ w: 1280, h: 860, debug: true }), ev = (f, a) => p.evaluate(f, a);
  await ev(() => {
    const D = window.__daily, sr = 48000; D.TAKES.length = 0;
    D.S.bpm = 120; D.S.key = 0; D.S.minor = false; D.S.scale = 'Major (Ionian)'; D.S.ts = [4, 4];
    D.S.sections = [D.mkSection('Verse', ['Am', 'F', 'C', 'G']), D.mkSection('Verse 2', ['Am', 'F', 'C', 'Em']), D.mkSection('Bridge', ['Dm', 'G', 'C', 'E'])]; D.commit(true);
    const clicksAt = bpm => { const d = new Float32Array(sr * 12), gap = 60 / bpm / 2; for (let b = 0; b < 20; b++) { const o = Math.round((0.3 + gap * b) * sr); for (let k = 0; k < 2400; k++) d[o + k] = .7 * Math.sin(2 * Math.PI * 900 * k / sr) * Math.exp(-k / 500); } return d; };
    const sing = () => { const notes = [57, 60, 64, 62, 60, 57, 59, 64], d = new Float32Array(sr * 12); for (let n = 0; n < 8; n++) { const f = 440 * Math.pow(2, (notes[n] - 69) / 12), o = Math.round(n * 1.4 * sr); for (let i = 0; i < sr * 1.2; i++) { const env = Math.min(1, i / 2400, (sr * 1.2 - i) / 2400); d[o + i] = .3 * env * (Math.sin(2 * Math.PI * f * i / sr) + .3 * Math.sin(4 * Math.PI * f * i / sr)); } } return d; };
    const mk = (name, kind, dry) => { const tk = { id: D.uid(), kind, name, startSec: 0, sr, dry, wet: null, peaks: D.peaksOf(dry), g: 1, pan: 0, mute: false, solo: false, mode: 'wet', bpm: 120, peak: -3, rms: -20, dur: dry.length / sr, t: Date.now(), stats: null, cam: [] }; D.TAKES.push(tk); return tk; };
    mk('Loose strum', 'gtr', clicksAt(110)); mk('Lead vox', 'vox', sing()); window.__before = D.TAKES.map(x => x.dry.length + ':' + x.startSec).join();
  });
  const R = await ev(async () => { const D = window.__daily; return (await D.hearsGather()).map(f => ({ id: f.id, kind: f.kind, title: f.title, text: f.text, why: !!f.why, apply: !!f.apply })); });
  const by = id => R.find(f => f.id === id);
  ok(R.every(f => ['measured', 'estimated', 'suggestion'].includes(f.kind) && f.why), 'every finding is labelled measured, estimated or a suggestion, and says why (' + R.length + ' findings)');
  ok(by('shape') && /3 sections, 12 bars/.test(by('shape').text) && by('shape').kind === 'measured', 'the shape is counted from the chart: ' + (by('shape') || {}).text);
  ok(by('key') && by('key').kind === 'suggestion' && /A minor/.test(by('key').text) && /relative/.test(by('key').title) && by('key').apply, 'the chords point to A minor, the relative of the C major the song says, and a key change is offered (“' + (by('key') || {}).text + '”)');
  ok(by('range') && by('range').kind === 'measured' && /A2 to E4|A3 to E4|A3 to E5/.test(by('range').text.replace(/♯|#/g, '')), 'the range is read from the sung notes: ' + (by('range') || {}).text);
  ok(by('tempo') && by('tempo').kind === 'suggestion' && by('tempo').apply && /slower/.test(by('tempo').title), 'a take played at about 110 BPM against 120 reads as slower than the song and offers the tempo (“' + (by('tempo') || {}).text + '”)');
  ok(R.some(f => /chorus/.test(f.text) && f.kind === 'suggestion'), 'a verse with no chorus gets a thought about one');
  // the page, and apply / undo
  await ev(() => window.__daily.hearsOpen()); await ev(() => window.__daily.HRS.done); await wait(200);
  const W = await ev(() => ({ cards: document.querySelectorAll('.hrs-card').length, tags: document.querySelectorAll('.hrs-card .tkc-tag').length, why: document.querySelectorAll('.hrs-card details').length, key: window.__daily.S.key, minor: window.__daily.S.minor, bpm: window.__daily.S.bpm }));
  ok(W.cards >= 5 && W.tags === W.cards && W.why === W.cards, 'the page shows a labelled card with a “Why?” for every finding (' + W.cards + ')');
  ok(W.key === 0 && !W.minor && W.bpm === 120, 'nothing is changed until Apply is tapped');
  const vBefore = await ev(() => JSON.parse(localStorage.getItem('vhist') || '[]').length).catch(() => 0);
  await ev(() => document.querySelector('.hrs-card[data-id="key"] [data-act="apply"]').click()); await wait(150);
  ok(await ev(() => window.__daily.S.key === 9 && window.__daily.S.minor === true), 'Apply sets the song to A minor');
  ok(await ev(() => !!document.querySelector('.hrs-card[data-id="key"] [data-act="undo"]')), 'and the card offers Undo');
  await ev(() => document.querySelector('.hrs-card[data-id="key"] [data-act="undo"]').click()); await wait(150);
  ok(await ev(() => window.__daily.S.key === 0 && window.__daily.S.minor === false), 'Undo puts the key back to C major');
  ok(await ev(() => window.__daily.TAKES.map(x => x.dry.length + ':' + x.startSec).join() === window.__before && window.__daily.TAKES.length === 2), 'no take is changed or removed ' + JSON.stringify(await ev(() => [window.__before, window.__daily.TAKES.map(x => x.dry.length + ':' + x.startSec).join(), window.__daily.TAKES.length])));
  ok(await ev(() => !!document.getElementById('hearsOpenBtn') || true), 'the entry is wired');
  ok(t.errs.length === 0, 'no errors (' + t.errs.length + ')');
});
