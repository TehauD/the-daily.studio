/* The agent tools for making music (2.84): the guide, drums written step by step, keys, bass and lead notes written and read back, sections rearranged,
   and the song rendered and measured. Everything is called the way an agent calls it: window.dailyStudio.call(name, input). */
const { suite } = require('./lib.cjs');
suite('e2e-agent-music', async t => {
  const { ok, wait } = t, p = await t.open({ w: 1300, h: 820, debug: true }), call = async (n, i) => { await wait(70); return p.evaluate(([n, i]) => window.dailyStudio.call(n, i || {}), [n, i]); }, sc = r => r.structuredContent;
  await wait(500);
  // ---- the guide
  const G = sc(await call('get_music_guide')), d = await p.evaluate(() => window.dailyStudio.describe());
  ok(G.beats.some(b => b.id === 'folk' && b.bpm) && G.drum_patterns.includes('Rock 8ths') && G.drum_kits.length >= 3 && G.bass_styles.length && G.keys_sounds.length && G.progressions.length > 5, 'get_music_guide lists the beats, patterns, kits, sounds and progressions (' + G.beats.length + ' beats, ' + G.drum_patterns.length + ' patterns)');
  ok(G.how_to.length >= 5 && /step 0/.test(G.notes.keys_and_bass) && d.start_here[0].call === 'get_music_guide' && d.tools.includes('write_notes'), 'it says how to write notes and in what order to work, and describe() sends an agent there first');
  // ---- a small song to work on
  await call('write_song', { lyrics: '[Verse]\nSalt wind on the water\nLights along the harbour\n[Chorus]\nHold on, hold on', key: 'A', progression: 'i VI III VII', bpm: 96, title: 'Agent Music Test' });
  const S0 = sc(await call('get_song', { include_lyrics: false })), nb = S0.sections[0].bars.length;
  ok(S0.sections.length === 2 && nb >= 4, 'a song with two sections to write into (' + S0.sections.map(s => s.name + ' ' + s.bars.length).join(', ') + ')');
  // ---- keys: written, read back
  const kw = sc(await call('write_notes', { part: 'keys', section: 'Verse', notes: [{ bar: 1, step: 0, note: 'A3', length: 8, velocity: .7 }, { bar: 1, step: 0, note: 'C4', length: 8 }, { bar: 1, step: 8, note: 'E4', length: 4, velocity: .9 }, { bar: 2, note: 60, length: 16 }] }));
  const kr = sc(await call('read_notes', { part: 'keys', section: 1 }));
  ok(kw.done && kw.written === 4 && kr.notes.length === 4 && kr.notes[0].note === 'A3' && kr.notes[1].note === 'C4' && kr.notes[2].note === 'E4' && kr.notes[2].step === 8 && kr.notes[2].velocity === .9 && kr.notes[3].bar === 2 && kr.notes[3].note === 'C4' && kr.notes[3].length === 16 && kr.steps_per_bar === 16, 'keys notes are written and read back: names, steps, lengths and velocities (' + kr.notes.map(n => n.bar + ':' + n.step + ' ' + n.note).join(', ') + ')');
  const kadd = sc(await call('write_notes', { part: 'keys', section: 'Verse', replace: false, notes: [{ bar: 3, note: 'G3' }] })), kn = sc(await call('read_notes', { part: 'keys', section: 'Verse' }));
  ok(kn.notes.length === 5, 'replace:false adds to what is there (' + kn.notes.length + ' notes)');
  const kre = sc(await call('write_notes', { part: 'keys', section: 'Verse', notes: [{ bar: 1, note: 'D4' }] }));
  ok(sc(await call('read_notes', { part: 'keys', section: 'Verse' })).notes.length === 1, 'by default a part is replaced');
  // ---- bass and lead
  const bw = sc(await call('write_notes', { part: 'bass', section: 'Chorus', notes: [{ bar: 1, step: 0, note: 'A1', length: 4 }, { bar: 1, step: 8, note: 'E2', length: 4 }] }));
  ok(bw.done && sc(await call('read_notes', { part: 'bass', section: 'Chorus' })).notes.map(n => n.note).join() === 'A1,E2', 'a bass line is written (A1, E2)');
  const lw = sc(await call('write_notes', { part: 'lead', section: 'Chorus', notes: [{ bar: 1, step: 0, note: 'E4' }, { bar: 1, step: 4, note: 'G4' }, { bar: 1, step: 8, note: 'A4' }, { bar: 1, step: 8, note: 'C5' }] }));
  const lr = sc(await call('read_notes', { part: 'lead', section: 'Chorus' }));
  ok(lw.done && lr.notes.length === 4 && lr.notes.map(n => n.note).join() === 'E4,G4,A4,C5' && lr.notes.every(n => n.fret >= 0 && n.fret <= 22 && n.string >= 1 && n.string <= 6), 'a lead melody is fretted on the guitar: each note has a string and a fret (' + lr.notes.map(n => n.note + ' s' + n.string + ' f' + n.fret).join(', ') + ')');
  ok(new Set(lr.notes.filter(n => n.step === 8).map(n => n.string)).size === 2, 'two notes at the same moment go on different strings');
  const band = sc(await call('get_studio_state')).band;
  ok(band.bass === true && band.lead_tab === true, 'writing a part switches it on');
  // ---- refusals say what is wrong
  const bad = async (i) => { const r = await call('write_notes', i); return r.isError ? r.structuredContent.error.message : ''; };
  const e1 = await bad({ part: 'keys', section: 'Verse', notes: [{ bar: 99, note: 'C4' }] }), e2 = await bad({ part: 'keys', section: 'Verse', notes: [{ bar: 1, step: 16, note: 'C4' }] }), e3 = await bad({ part: 'keys', section: 'Verse', notes: [{ bar: 1, note: 'H9' }] }), e4 = await bad({ part: 'bass', section: 'Verse', notes: [{ bar: 1, note: 'C0' }] }), e5 = await bad({ part: 'keys', section: 'Nowhere', notes: [{ bar: 1, note: 'C4' }] }), e6 = await bad({ part: 'keys', section: 'Verse', notes: [{ bar: 1, note: 'C4', velocity: 2 }] });
  ok(/bar must be 1–/.test(e1) && /step must be 0–15/.test(e2) && /not a note/.test(e3) && /bass notes go from/.test(e4) && /No section/.test(e5) && /velocity/.test(e6), 'a wrong bar, step, note, range, section or velocity is refused with the reason');
  ok(sc(await call('read_notes', { part: 'keys', section: 'Verse' })).notes.length === 1, 'and a refused write changes nothing');
  // ---- drums
  const dw = sc(await call('write_drums', { grid: { kick: 'X...x...X...x...', snare: '....X.......X...', hat: 'x.x.x.x.' }, kit: 'Rock Room' }));
  ok(dw.done && dw.grid.kick === 'X...x...X...x...' && dw.grid.snare === '....X.......X...' && dw.grid.hat === 'x.x.x.x.x.x.x.x.' && dw.kit === 'Rock Room' && dw.drums_on, 'a drum grid is written (a short row repeats), with a kit');
  const dp = sc(await call('write_drums', { pattern: 'Four on the Floor' })), dg = sc(await call('write_drums', { grid: { clap: '....x.......x...' } }));
  ok(dp.grid.kick === 'x...x...x...x...' && dg.grid.kick === 'x...x...x...x...' && dg.grid.clap === '....x.......x...', 'a ready pattern applies, and a row can then be changed alone');
  const d1 = await call('write_drums', { grid: { kick: 'X..' } }), d2 = await call('write_drums', { grid: { kick: 'X...x...X...x..q' } }), d3 = await call('write_drums', { grid: { cowbell: 'X...' } }), d4 = await call('write_drums', {});
  ok([d1, d2, d3, d4].every(r => r.isError), 'a row of the wrong length, a wrong character, an unknown drum, or nothing at all is refused');
  // ---- arrange
  const a = sc(await call('arrange_sections', { order: ['Verse', 'Chorus', 'Verse', 'Chorus'] }));
  ok(a.done && a.sections.length === 4 && a.sections[2] === '3 Verse 2' && a.sections[3] === '4 Chorus 2' && a.total_bars === 2 * (S0.sections[0].bars.length + S0.sections[1].bars.length), 'sections are repeated and put in a new order, the copies named (' + a.sections.join(', ') + ')');
  const copied = sc(await call('read_notes', { part: 'bass', section: 'Chorus 2' }));
  ok(copied.notes.map(n => n.note).join() === 'A1,E2', 'a repeated section carries its notes');
  await call('undo'); ok(sc(await call('get_song', { include_lyrics: false })).sections.length === 2, 'undo puts the sections back');
  const a2 = await call('arrange_sections', { order: ['Chorus', 'Intro'] }); ok(a2.isError && /No section/.test(a2.structuredContent.error.message), 'an unknown section is refused');
  const a3 = sc(await call('arrange_sections', { order: ['Chorus'] })); ok(a3.sections.length === 1, 'a section left out is removed'); await call('undo');
  // ---- hear it
  await p.evaluate(() => { document.body.click(); }); await wait(300);
  const R = await call('render_audio', { tail: 1 }), rm = sc(R);
  ok(!R.isError && rm.done && rm.duration_s > 8 && rm.bpm === 96 && rm.key === 'A major', 'render_audio mixes the song faster than it plays (' + (rm.duration_s || R.content[0].text.slice(0, 120)) + ' s)');
  ok(rm.loudness_lufs < -3 && rm.loudness_lufs > -60 && rm.peak_dbfs <= 0.1 && rm.true_peak_dbfs <= 3 && rm.clipped_samples >= 0, 'it measures loudness, peak and true peak (' + rm.loudness_lufs + ' LUFS, ' + rm.peak_dbfs + ' dBFS)');
  const b = rm.balance_percent; ok(Math.abs(b.low_under_250hz + b.mid + b.high_over_4khz - 100) <= 2 && b.low_under_250hz > 0, 'the tone balance adds up (' + JSON.stringify(b) + ')');
  ok(rm.sections.length === 2 && rm.sections.every(s => s.name && s.bars > 0 && s.energy >= 1 && (s.loudness_lufs == null || s.loudness_lufs < 0)) && Array.isArray(rm.hints) && rm.silence_s.start >= 0, 'each section is measured, with advice (' + rm.sections.map(s => s.name + ' ' + s.loudness_lufs).join(', ') + '; hints: ' + rm.hints.length + ')');
  ok(!(await call('transport', {})).isError && sc(await call('get_studio_state')).band.drums, 'rendering leaves the studio ready to play');
  const W = await p.evaluate(async () => { const r = await window.dailyStudio.render({ tail: 0.5, bits: 16 }); const bin = atob(r.wav_base64.slice(0, 48)); return { riff: bin.slice(0, 4), wave: bin.slice(8, 12), bytes: r.bytes, b64: r.wav_base64.length, sr: r.sample_rate, secs: r.seconds, bits: r.bits, lufs: r.metrics.loudness_lufs }; });
  ok(W.riff === 'RIFF' && W.wave === 'WAVE' && W.bits === 16 && Math.abs(W.bytes - (44 + Math.round(W.secs * W.sr) * 4)) < W.sr * 4 * .2 && W.b64 > W.bytes, 'dailyStudio.render() returns the mix as a WAV (' + (W.bytes / 1e6).toFixed(1) + ' MB, ' + W.secs + ' s)');
  // ---- agents off
  await p.evaluate(() => { window.__daily.CFG.agents = false; }); const off = await call('render_audio'), off2 = await p.evaluate(() => window.dailyStudio.render().then(() => 'ok', e => e.message));
  ok(off.isError && off.structuredContent.error.code === 'disabled' && /turned off/.test(off2), 'with agent access off, the new tools and render() are refused'); await p.evaluate(() => { window.__daily.CFG.agents = true; });
  ok(t.errs.length === 0, 'no errors (' + t.errs.length + ')');
});
