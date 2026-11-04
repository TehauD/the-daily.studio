/* Speed & key, and Keys (2.35). The stretcher on its own (pitch, length, level, the join between chunks); the band, the click and a loaded
   track at a practice speed, still together; the key moved with the song; recording paused at a practice speed. The piano under Write and
   the Keys room: played by mouse, computer keys and MIDI into its own sounds, the bass or the lead; recorded into the song; the keys player
   in the band; its mixer channel. */
const { suite } = require('./lib.cjs');
const SHEET = '[Verse]\nAm      F\nLanterns on the harbour wall\nC       G\nCalling all the boats back in';

suite('e2e-speedkeys', async t => {
  const { ok, wait, poll } = t;
  const p = await t.open({ w: 1440, h: 900 }), ev = (f, a) => p.evaluate(f, a);
  await ev(async s => { const D = window.__daily; await D.startAudio(); await window.dailyStudio.call('load_chord_sheet', { text: s }); D.S.bpm = 120; D.S.key = 9; D.S.minor = true; D.commit(false); }, SHEET);

  /* ---- the stretcher ---- */
  const DSP = await ev(() => { const D = window.__daily, sr = 44100, n = sr * 3, src = new Int16Array(n); for (let i = 0; i < n; i++) src[i] = Math.round(12000 * Math.sin(2 * Math.PI * 440 * i / sr) + 6000 * Math.sin(2 * Math.PI * 660 * i / sr));
    const zc = o => { let z = 0; for (let i = 1; i < o.length; i++) if (o[i - 1] <= 0 && o[i] > 0) z++; return z / (o.length / sr); }, rms = a => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length), r0 = rms(Array.from(src.subarray(sr, 2 * sr), x => x / 32768)), f0 = zc(Array.from(src.subarray(0, sr), x => x / 32768)), out = {};
    for (const [rate, semi] of [[.5, 0], [.75, 0], [1, 12], [1, -5], [.6, 3]]) { const X = D.psDSPFactory(), q = Math.pow(2, semi / 12), len = Math.round(sr / rate) / 2 | 0, a = X.run({ chans: [src], off: 0, start: sr, len, alpha: q / rate, q, reset: true })[0], b = X.run({ chans: [src], off: 0, start: sr + len * rate, len, alpha: q / rate, q, reset: false })[0];
      const o = new Float32Array(2 * len); o.set(a); o.set(b, len); let step = 0; for (let i = 2000; i < 2400; i++) step = Math.max(step, Math.abs(o[i] - o[i - 1])); out[rate + '/' + semi] = { len: o.length / sr * rate, f: zc(o.subarray(4000)) / (f0 * q), level: rms(o.subarray(4000)) / r0, seam: Math.abs(a[len - 1] - b[0]) / step }; }
    return out; });
  ok(Object.values(DSP).every(x => Math.abs(x.len - 1) < .01 && Math.abs(x.f - 1) < .01 && Math.abs(x.level - 1) < .08), 'the stretcher: half speed is twice as long and the same pitch; +12 is an octave up at the same length; the level holds (' + JSON.stringify(DSP) + ')');
  ok(Object.values(DSP).every(x => x.seam < 1.2), 'and one two-second chunk runs into the next without a click');

  /* ---- the control ---- */
  ok(await ev(() => /⏱ 100%/.test(document.getElementById('psBtn').textContent) && !document.getElementById('psBtn').classList.contains('on')), '⏱ 100% sits in the transport');
  await ev(() => document.getElementById('psBtn').click()); await wait(200);
  await ev(() => document.querySelector('#psPop [data-rate="50"]').click()); await wait(300);
  ok(await ev(() => window.__daily.PS.rate === .5 && /⏱ 50%/.test(document.getElementById('psBtn').textContent) && document.getElementById('psBtn').classList.contains('on')), '50% is one press, and the button shows it');

  /* ---- the band and the click at half speed ---- */
  const B = await ev(async () => { const D = window.__daily; D.T.cursor = 0; D.T.loop = false; await D.play(); await new Promise(r => setTimeout(r, 900)); const q = D.T.q.slice(-6), gap = (q[q.length - 1].time - q[0].time) / (q.length - 1); const r = { gap, want: D.slotDur() * 2, bpm: D.S.bpm }; D.stopPlay(true); return r; });
  ok(Math.abs(B.gap - B.want) < 1e-6 && B.bpm === 120, 'the band plays at half speed (a 16th every ' + (B.gap * 1000).toFixed(1) + ' ms instead of ' + (B.want * 500).toFixed(1) + '), and the song is still 120 BPM');
  await ev(() => window.__daily.toggleRec()); await wait(300);
  ok(await ev(() => !window.__daily.T.rec && !window.__daily.T.playing && [...document.querySelectorAll('#toasts .toast')].some(x => /back to 100%/.test(x.textContent))), 'recording waits for 100%: takes are kept at the song’s own speed');

  /* ---- a loaded track, stretched as it plays ---- */
  await ev(async () => { const D = window.__daily, sr = 44100, n = sr * 8, l = new Float32Array(n); for (let i = 0; i < n; i++) { const b = (i % (sr / 2)) / sr; l[i] = .3 * Math.sin(2 * Math.PI * 220 * i / sr) + (b < .02 ? .5 * Math.exp(-b * 200) * (Math.random() * 2 - 1) : 0); }
    const w = D.encodeWav([l, l], sr, 16); await D.stemLoad(new File([w], 'pulse.wav', { type: 'audio/wav' })); });
  await poll(() => ev(() => !!window.__daily.STM.ch && !window.__daily.STM.busy), 30000);
  const TR = await ev(async () => { const D = window.__daily; D.spPlay(null, 1); await new Promise(r => setTimeout(r, 1600)); const segs = D.STP.segs.map(s => s.rate), a = D.spPos(); await new Promise(r => setTimeout(r, 1000)); const b = D.spPos(); D.spPause(); return { segs, adv: b - a }; });
  ok(TR.segs.length >= 1 && TR.segs.every(r => r === .5) && Math.abs(TR.adv - .5) < .12, 'the track plays stretched, in chunks made in a worker: one second of listening moves half a second through the track (' + TR.adv.toFixed(2) + ' s)');
  await ev(() => window.__daily.psSpeed(1)); await wait(200);
  const TR1 = await ev(async () => { const D = window.__daily; D.spPlay(null, 1); await new Promise(r => setTimeout(r, 700)); const a = D.spPos(); await new Promise(r => setTimeout(r, 1000)); const b = D.spPos(); const r = { segs: D.STP.segs.map(s => s.rate || 1), adv: b - a }; D.spPause(); return r; });
  ok(TR1.segs.every(r => r === 1) && Math.abs(TR1.adv - 1) < .12, 'back at 100% it plays the track as it was, untouched');

  /* ---- the key ---- */
  await ev(() => { const D = window.__daily; D.S.track = D.S.track || { name: 'pulse' }; D.commit(false); D.closePop(); }); await ev(() => document.getElementById('psBtn').click()); await wait(200);
  await ev(() => { document.getElementById('psUp').click(); document.getElementById('psUp').click(); }); await wait(300);
  const K = await ev(() => { const D = window.__daily; return { semi: D.PS.semi, saved: D.S.track.semi, key: D.S.key, first: D.S.sections[0].bars[0].chord, label: document.getElementById('psBtn').textContent }; });
  ok(K.semi === 2 && K.saved === 2 && K.key === 11 && /^Bm/.test(K.first) && /\+2/.test(K.label), 'up two: the track moves to +2, kept with the song, and the chords move with it (Am → ' + K.first + ', key B)');
  const K2 = await ev(async () => { const D = window.__daily; D.spPlay(null, 1); await new Promise(r => setTimeout(r, 900)); const r = { rate: D.STP.segs.map(s => s.rate) }; D.spPause(); return r; });
  ok(K2.rate.length && K2.rate.every(r => r === 1), 'a key change alone keeps the speed: the track still plays at 100%');
  await ev(() => { document.querySelector('#psPop .row .btn') && 0; const b = [...document.querySelectorAll('#psPop button')].find(x => x.textContent === 'Original'); b.click(); }); await wait(300);
  ok(await ev(() => window.__daily.PS.semi === 0 && window.__daily.S.key === 9 && /^Am/.test(window.__daily.S.sections[0].bars[0].chord)), 'Original puts the track and the song back');
  await ev(() => window.__daily.closePop());

  /* ---- keys: the piano under Write ---- */
  await ev(() => { const D = window.__daily; D.goalGo('songwriter'); D.T.cursor = 0; }); await wait(400);
  ok(await ev(() => !!document.getElementById('wrPianoBtn') && !!document.getElementById('gtKeys')), 'Songwriter: 🎹 Piano beside the fretboard, and 🎹 Keys in the tools');
  await ev(() => document.getElementById('wrPianoBtn').click()); await wait(300);
  const PI = await ev(() => { const s = document.querySelector('#wrPiano svg.ky-svg'), ch = [...s.querySelectorAll('.ch')].map(k => +k.dataset.m % 12), root = [...s.querySelectorAll('.root')].map(k => +k.dataset.m % 12); return { vis: s.getBoundingClientRect().width > 300, ch: [...new Set(ch)].sort((a, b) => a - b).join(','), root: [...new Set(root)].join(','), lab: [...s.querySelectorAll('.ky-l')].filter(x => x.textContent).map(x => x.textContent).slice(0, 3).join(' ') }; });
  ok(PI.vis && PI.ch === '0,4,9' && PI.root === '9', 'the piano shows the chord that is playing (Am: A, C, E), its root marked (' + PI.lab + ')');
  await ev(() => { const k = document.querySelector('#wrPiano [data-m="64"]'), r = k.getBoundingClientRect(); window.__pt = { x: r.left + r.width / 2, y: r.top + r.height * .85 }; });
  const pt = await ev(() => window.__pt); await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await wait(150);
  ok(await ev(() => window.__daily.KY.held.has(64) && document.querySelector('#wrPiano [data-m="64"]').classList.contains('on')), 'pressing a key plays it and lights it');
  await p.mouse.move(pt.x + 60, pt.y, { steps: 6 }); await wait(100);
  ok(await ev(() => !window.__daily.KY.held.has(64) && window.__daily.KY.held.size === 1), 'dragging along slides from key to key');
  await p.mouse.up(); await wait(100);
  ok(await ev(() => window.__daily.KY.held.size === 0), 'and letting go stops it');

  /* ---- the Keys room: computer keys, MIDI, sounds, into the bass or lead ---- */
  await ev(() => document.getElementById('gtKeys').click()); await wait(300);
  ok(await ev(() => document.getElementById('keysRoom').open && document.querySelectorAll('#keysRoom [data-t]').length === 3 && document.querySelectorAll('#kySound option').length === 6), 'the Keys room: plays into Keys, Bass or Lead guitar; six sounds');
  await ev(() => document.body.focus()); await p.keyboard.down('a'); await wait(80); const kA = await ev(() => [...window.__daily.KY.held.keys()]); await p.keyboard.up('a');
  await p.keyboard.press('x'); await p.keyboard.down('h'); await wait(80); const kH = await ev(() => [...window.__daily.KY.held.keys()]); await p.keyboard.up('h');
  ok(kA.join() === '60' && kH.join() === '81', 'the computer keys play it: A is middle C, X moves up an octave, H is then A5 (' + kA + ', ' + kH + ')');
  await ev(() => { window.__daily.onMidi({ data: [0x90, 67, 100] }); }); const mOn = await ev(() => window.__daily.KY.held.has(67)); await ev(() => window.__daily.onMidi({ data: [0x80, 67, 0] }));
  ok(mOn && await ev(() => !window.__daily.KY.held.has(67)), 'a MIDI keyboard plays it while the room is open (note on, note off)');
  const SND = await ev(() => { const D = window.__daily, c = D.E.ctx; return D.KEYS_SOUNDS.map(s => { try { const v = D.keysVoice(c.currentTime + .01, 60, .8, .2, s); return !!v; } catch (e) { return s + ': ' + e.message; } }); });
  ok(SND.every(x => x === true), 'all six sounds play: ' + String(SND));
  const LEV = await ev(async () => { const D = window.__daily, c = D.E.ctx, an = D.E.tr.keys.ana, buf = new Float32Array(an.fftSize); D.keysVoice(c.currentTime + .02, 57, .9, .5, 'Piano'); await new Promise(r => setTimeout(r, 150)); an.getFloatTimeDomainData(buf); return Math.max(...buf.map(Math.abs)); });
  ok(LEV > .01, 'and it comes out of its own Keys channel in the mixer (peak ' + LEV.toFixed(3) + ')');

  /* ---- record into the bass line ---- */
  await ev(() => document.querySelector('#keysRoom [data-t="bass"]').click()); await wait(200);
  await ev(() => { const D = window.__daily; D.S.bpm = 120; D.T.loop = false; D.T.cursor = 0; D.commit(false); document.getElementById('kyRec').click(); });
  await poll(() => ev(() => window.__daily.T.playing), 3000);
  await ev(async () => { const D = window.__daily, nap = ms => new Promise(r => setTimeout(r, ms)); while (D.playheadSlot() < 1) await nap(10); for (const m of [45, 45, 52, 48]) { D.kyNoteOn(m, .9); await nap(220); D.kyNoteOff(m); await nap(30); } });
  await ev(() => document.getElementById('kyRec').click()); await wait(300);
  const RB = await ev(() => { const D = window.__daily, b = D.S.sections[0].bars[0]; return { line: (b.bassLine || []).map(n => n.m + '@' + n.s), playing: D.T.playing, toast: [...document.querySelectorAll('#toasts .toast')].some(x => /written into the bass line/.test(x.textContent)) }; });
  ok(RB.line.length === 4 && RB.line[0].startsWith('45@') && RB.toast, 'played in time while it records, the notes are written into the bass line, on the 16th grid (' + RB.line.join(' ') + ')');
  await ev(() => window.__daily.stopPlay(true));
  ok(await ev(() => { const D = window.__daily; D.undo(); return !(D.S.sections[0].bars[0].bassLine || []).length; }), 'one undo takes them out');
  await ev(() => window.__daily.undo && window.__daily.histStack.r.length && window.__daily.redo && window.__daily.redo());

  /* ---- record into the lead tab ---- */
  await ev(() => { document.querySelector('#keysRoom [data-t="lead"]').click(); }); await wait(200);
  await ev(async () => { const D = window.__daily; D.S.sections[0].bars[1].tab = []; D.commit(false); D.T.cursor = 0; document.getElementById('kyRec').click(); const nap = ms => new Promise(r => setTimeout(r, ms)); await new Promise(r => { const t0 = performance.now(); const go = () => { if (D.T.playing && D.playheadSlot() >= 16.5) r(); else if (performance.now() - t0 > 6000) r(); else setTimeout(go, 10); }; go(); }); D.kyNoteOn(69, .8); await nap(200); D.kyNoteOff(69); await nap(50); document.getElementById('kyRec').click(); D.stopPlay(true); });
  const RL = await ev(() => { const D = window.__daily, tab = D.S.sections[0].bars[1].tab, n = tab[0]; return n ? { m: D.S.tuning[n.st] + D.S.capo + n.f, s: n.s, n: tab.length } : null; });
  ok(RL && RL.m === 69 && RL.n === 1, 'into the lead: the note is written as tab, string and fret chosen for you (' + JSON.stringify(RL) + ')');

  /* ---- the keys player in the band ---- */
  const KB = await ev(async () => { const D = window.__daily; D.S.band.keysOn = true; D.S.band.keysStyle = 'Block chords'; D.S.sections.forEach(s => s.bars.forEach(b => { b.keys = []; })); D.commit(false); D.KY.lit.clear(); D.T.cursor = 0; await D.play(); await new Promise(r => setTimeout(r, 1300)); const lit = [...D.KY.lit.keys()].map(m => m % 12); D.stopPlay(true); return [...new Set(lit)].sort((a, b) => a - b).join(','); });
  ok(KB === '0,4,9', 'Keys in the band (Block chords) plays the chords as they come: Am’s A, C and E (' + KB + ')');
  const VO = await ev(() => { const D = window.__daily; D.KY.voice = null; const a = D.kyVoicing('C').up, b = D.kyVoicing('F').up, c = D.kyVoicing('G').up; const move = (x, y) => x.reduce((s, m, i) => s + Math.abs(m - (y[i] || m)), 0); return { a, b, c, mb: move(a, b), mc: move(b, c) }; });
  ok(VO.mb <= 6 && VO.mc <= 6 && VO.a.every(m => m >= 55 && m <= 79), 'its chords move as little as possible from one to the next, around middle C (C ' + VO.a + ' → F ' + VO.b + ' → G ' + VO.c + ')');
  ok(await ev(() => document.querySelector('#bandMuteAll') && [...document.querySelectorAll('.bandstrip .bchip')].some(b => /Keys/.test(b.textContent))), 'and Keys has its own switch on the band strip');
  await ev(() => document.getElementById('keysRoom').close());

  /* ---- a phone ---- */
  const m = await t.open({ w: 390, h: 844, mobile: true }), mv = (f, a) => m.evaluate(f, a);
  await mv(() => window.__daily.keysOpen()); await wait(400);
  ok(await mv(() => { const d = document.getElementById('keysRoom'), r = d.getBoundingClientRect(), w = d.querySelector('.ky-wrap').getBoundingClientRect(); return r.right <= innerWidth + .5 && w.right <= innerWidth + .5 && document.documentElement.scrollWidth <= innerWidth + 1; }), 'on a phone the Keys room fits; the keyboard scrolls sideways inside it');
});
