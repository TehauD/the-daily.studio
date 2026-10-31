/* AI agent tools (2.15): the studio's actions offered to an AI agent in the browser through WebMCP (navigator.modelContext)
   and window.dailyStudio. Chromium here has no WebMCP yet, so a stand-in navigator.modelContext records what the page registers. */
const { suite } = require('./lib.cjs');
const SHEET = '[Verse]\nE               B/D#           C#m\nLanterns swing along the harbour wall\n[Chorus]\n[A]Hold on, the [E]tide is turning';
function fakeMCsrc(kind) {
  window.__mc = { tools: new Map(), calls: [], cleared: 0 };
  const mc = kind === 'ctx'
    ? { provideContext(o) { window.__mc.tools = new Map(o.tools.map(t => [t.name, t])); window.__mc.calls.push('provide'); }, clearContext() { window.__mc.tools.clear(); window.__mc.cleared++; } }
    : { registerTool(t) { window.__mc.tools.set(t.name, t); window.__mc.calls.push('register'); return { unregister() { window.__mc.tools.delete(t.name); window.__mc.cleared++; } }; } };
  Object.defineProperty(navigator, 'modelContext', { value: mc, configurable: true });
}
/* the page gets the source text only, so the choice goes in as an argument */
const fakeMC = kind => '(' + fakeMCsrc.toString() + ')(' + JSON.stringify(kind) + ')';

suite('e2e-agent', async t => {
  const { ok, wait } = t;
  const p = await t.open({ init: fakeMC('reg') });
  const call = (name, input) => p.evaluate(([n, i]) => window.dailyStudio.call(n, i).then(r => ({ err: !!r.isError, text: r.content[0].text })), [name, input || {}]);
  const json = async (name, input) => { const r = await call(name, input); try { return Object.assign({ _err: r.err }, JSON.parse(r.text)); } catch (e) { return { _err: r.err, _text: r.text }; } };

  /* ---- offered to agents ---- */
  const reg = await p.evaluate(() => ({ names: [...window.__mc.tools.keys()], api: window.dailyStudio.tools().map(x => x.name), schemas: window.dailyStudio.tools().every(x => x.inputSchema.type === 'object' && x.description.length > 30), ro: window.dailyStudio.tools().filter(x => x.annotations.readOnlyHint).map(x => x.name) }));
  ok(reg.names.length === 16 && reg.names.join() === reg.api.join(), 'WebMCP: all 16 tools are registered with navigator.modelContext (' + reg.names.join(', ') + ')');
  ok(reg.schemas, 'every tool has a description and a JSON input schema');
  ok(['get_song', 'get_studio_state', 'get_key_chords', 'list_songs', 'export_song'].every(n => reg.ro.includes(n)) && !reg.ro.includes('transport'), 'reading tools are marked read-only (' + reg.ro.join(', ') + ')');
  ok(!reg.names.some(n => /record|mic|camera|input|delete|setting/i.test(n)), 'no tool reaches the microphone, the camera, recording, deleting songs or Settings');
  const viaMC = await p.evaluate(() => window.__mc.tools.get('get_song').execute({ include_lyrics: false }).then(r => JSON.parse(r.content[0].text)));
  ok(viaMC.title && Array.isArray(viaMC.sections) && !('lyrics' in viaMC.sections[0]), 'a tool called through WebMCP answers with the song (' + viaMC.title + ', ' + viaMC.sections.length + ' sections)');

  /* ---- reading ---- */
  const st = await json('get_studio_state');
  ok(st.playing === false && 'band' in st && Array.isArray(st.saved_songs), 'get_studio_state: playing, band, workspace and saved songs');
  const kc = await json('get_key_chords', { key: 'E' });
  ok(kc.key === 'E major' && kc.chords.map(c => c.triad).join(' ') === 'E F#m G#m A B C#m D#dim' && kc.progressions.some(x => x.chords === 'E B C#m A'), 'get_key_chords: the chords of E major and I–V–vi–IV spelled E B C#m A');
  const km = await json('get_key_chords', { key: 'Am' });
  ok(km.key === 'A minor' && km.progressions.length > 0 && km.progressions.every(x => /^Am/.test(x.chords)), 'minor keys get the minor progressions (' + km.progressions.length + ')');

  /* ---- loading a chord sheet ---- */
  const ld = await json('load_chord_sheet', { text: SHEET, title: 'Harbour Lights' });
  ok(!ld._err && ld.song.title === 'Harbour Lights' && ld.song.key === 'E major' && ld.song.sections.map(s => s.bars.join(' ')).join(' | ') === 'E B/D# C#m | A E', 'load_chord_sheet makes a new song from the sheet (' + JSON.stringify(ld.song && ld.song.sections) + ')');
  ok(await p.evaluate(() => [...document.querySelectorAll('#toasts .toast')].some(x => /🤖 AI agent/.test(x.textContent))), 'the person sees a 🤖 note for what the agent did');
  ok((await json('load_chord_sheet', { text: 'Just some words\nwith no chords' }))._err, 'a text with no chords is refused with a reason');

  /* ---- changing the song ---- */
  const sd = await json('set_song_details', { bpm: 104, time_signature: '3/4', artist: 'The Test Band' });
  ok(sd.bpm === 104 && sd.time_signature === '3/4' && sd.artist === 'The Test Band', 'set_song_details: tempo, time signature, artist');
  ok((await call('set_song_details', { key: 'H#' })).err && (await call('set_song_details', { bpm: 'fast' })).err, 'a key or tempo it cannot understand is refused');
  const tr = await json('transpose_song', { semitones: 2 });
  const lyr = (await json('get_song')).sections[1].lyrics;
  ok(tr.key === 'F# major' && tr.sections[0].bars.join(' ') === 'F# C#/F D#m' && /\[B\]Hold on, the \[F#\]tide/.test(lyr), 'transpose_song +2: chords, slash basses, lyric chords and key move up (' + tr.sections[0].bars.join(' ') + ')');
  await call('undo'); const back = await json('get_song');
  ok(back.key === 'E major' && back.sections[0].bars.join(' ') === 'E B/D# C#m', 'undo puts the key and chords back');
  const bad = await call('edit_section', { section: 'Verse', chords: ['E', 'Hmaj'] });
  ok(bad.err && /Hmaj/.test(bad.text), 'a chord the studio cannot play is refused, naming it (' + bad.text.slice(0, 70) + ')');
  const es = await json('edit_section', { section: 'verse', name: 'Verse 1', chords: ['E', 'A E', '', 'B7'], lyrics: '[E]New words [A]here' });
  ok(es.section.name === 'Verse 1' && es.section.bars.join('|') === 'E|A E||B7' && es.section.lyrics === '[E]New words [A]here', 'edit_section: name, bars (two chords, an empty bar) and lyrics');
  const as = await json('add_section', { name: 'Bridge', chords: ['C#m', 'A', 'E', 'B'], position: 2 });
  ok(as.sections.join() === '1 Verse 1,2 Bridge,3 Chorus', 'add_section puts it where asked (' + as.sections.join(', ') + ')');
  const rs = await json('remove_section', { section: 2 });
  ok(rs.sections.join() === '1 Verse 1,2 Chorus', 'remove_section by number');
  ok((await call('remove_section', { section: 'Outro' })).err, 'a section that is not there is reported');
  ok(/Unknown parameter/.test((await call('get_song', { colour: 'red' })).text) && /must be one of/.test((await call('export_song', { format: 'pdf' })).text), 'unknown parameters and values outside the choices are reported');

  /* ---- band, transport, workspace, export ---- */
  const bd = await json('set_band', { drums: false, bass: true, strum_pattern: 'Folk D-DU-UDU' });
  ok(bd.band.drums === false && bd.band.bass === true && bd.band.strum_pattern === 'Folk D-DU-UDU', 'set_band: parts on/off and a strum pattern');
  const pl = await json('transport', { action: 'play', from_bar: 2, metronome: true }); await wait(900);
  const playing = await p.evaluate(() => ({ on: window.__daily.T.playing, bar: Math.floor(window.__daily.playheadSlot() / window.__daily.spb()) + 1 }));
  ok(pl.playing && pl.metronome && playing.on && playing.bar >= 2, 'transport: plays from bar 2 with the click (bar ' + playing.bar + ', audio ' + pl.audio + ')');
  const sp = await json('transport', { action: 'stop' });
  ok(!sp.playing && (await p.evaluate(() => !window.__daily.T.playing && !window.__daily.T.rec)), 'transport: stop (and nothing was recorded)');
  const ws = await json('open_workspace', { workspace: 'practice' });
  ok(ws.workspace === 'practice' && (await p.evaluate(() => window.__daily.goalNow().id)) === 'practice', 'open_workspace: practice');
  const cp = await call('export_song', { format: 'chordpro' });
  ok(/\{title: Harbour Lights\}/.test(cp.text) && /\[E\]New words/.test(cp.text), 'export_song returns ChordPro text (nothing downloaded)');
  const arr = JSON.parse((await call('list_songs')).text);
  ok(Array.isArray(arr) && arr.length >= 2 && arr.some(x => x.open), 'list_songs: the saved songs, with the open one marked (' + arr.length + ')');
  const other = arr.find(x => !x.open); const os = await json('open_song', { song: other.id });
  ok(os.title === other.title, 'open_song opens another saved song (' + os.title + ')');

  /* ---- the person can turn it off ---- */
  await p.evaluate(() => { window.__daily.CFG.agents = false; window.__daily.agentRegister(); });
  const off = await call('get_song');
  ok(off.err && /turned off/.test(off.text) && (await p.evaluate(() => window.__mc.tools.size)) === 0, 'Settings off: tools are withdrawn from WebMCP and calls are refused');
  await p.evaluate(() => { window.__daily.CFG.agents = true; window.__daily.agentRegister(); });
  ok((await p.evaluate(() => window.__mc.tools.size)) === 16, 'turned back on: offered again');
  await p.evaluate(() => window.__daily.openSettings('work')); await wait(300);
  ok(await p.evaluate(() => [...document.querySelectorAll('label.chk')].some(l => /AI agents/.test(l.textContent) && l.querySelector('input').checked)), 'Settings ▸ Workflow has the switch, on by default');

  /* ---- an earlier WebMCP draft: provideContext ---- */
  const q = await t.open({ init: fakeMC('ctx') });
  const q1 = await q.evaluate(() => ({ calls: window.__mc.calls, n: window.__mc.tools.size }));
  ok(q1.calls.includes('provide') && q1.n === 16, 'browsers with provideContext get all the tools in one call');
  ok(!t.errs.length, 'no console / page / network errors' + (t.errs.length ? ': ' + t.errs.join(' | ') : ''));
});
