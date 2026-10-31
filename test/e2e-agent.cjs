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
  const { ok, wait, fs, path } = t;
  const CONTRACT = JSON.parse(fs.readFileSync(path.join(__dirname, 'agent-contract.json'), 'utf8')), N = Object.keys(CONTRACT.tools).length;
  const p = await t.open({ init: fakeMC('reg') });
  const call = (name, input) => p.evaluate(([n, i]) => window.dailyStudio.call(n, i).then(r => ({ err: !!r.isError, text: r.content[0].text })), [name, input || {}]);
  const json = async (name, input) => { const r = await call(name, input); try { return Object.assign({ _err: r.err }, JSON.parse(r.text)); } catch (e) { return { _err: r.err, _text: r.text }; } };

  /* ---- offered to agents ---- */
  const reg = await p.evaluate(() => ({ names: [...window.__mc.tools.keys()], api: window.dailyStudio.tools().map(x => x.name), schemas: window.dailyStudio.tools().every(x => x.inputSchema.type === 'object' && x.description.length > 30), ro: window.dailyStudio.tools().filter(x => x.annotations.readOnlyHint).map(x => x.name) }));
  ok(reg.names.length === N && reg.names.join() === reg.api.join(), 'WebMCP: all ' + N + ' tools are registered with navigator.modelContext (' + reg.names.join(', ') + ')');
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
  ok((await p.evaluate(() => window.__mc.tools.size)) === N, 'turned back on: offered again');
  await p.evaluate(() => window.__daily.openSettings('work')); await wait(300);
  ok(await p.evaluate(() => [...document.querySelectorAll('label.chk')].some(l => /AI agents/.test(l.textContent) && l.querySelector('input').checked)), 'Settings ▸ Workflow has the switch, on by default');

  /* ---- 2.16: the contract ---- */
  const live = await p.evaluate(() => ({ api: window.dailyStudio.version, d: window.dailyStudio.describe(), tools: Object.fromEntries(window.dailyStudio.tools().map(x => [x.name, (x.inputSchema.required || []).slice().sort()])) }));
  const broken = Object.entries(CONTRACT.tools).filter(([n, req]) => !live.tools[n] || live.tools[n].join() !== req.join()).map(([n]) => n);
  ok(live.api === CONTRACT.api && !broken.length, 'the published tools and their required inputs match test/agent-contract.json (API ' + live.api + (broken.length ? '; changed: ' + broken.join(', ') : '') + ')');
  ok(live.d.api === live.api && /^\d+\.\d+\.\d+$/.test(live.d.app) && /^[0-9a-f]{7}$/.test(live.d.build) && live.d.tools.length === N, 'describe() gives the API version, the app version and build, and the tools');

  /* ---- 2.16: structured answers and error codes ---- */
  const raw = (n, i) => p.evaluate(([n, i]) => window.dailyStudio.call(n, i), [n, i || {}]);
  const st2 = await raw('get_studio_state');
  ok(st2.structuredContent && st2.structuredContent.api === CONTRACT.api && st2.structuredContent.visuals && st2.structuredContent.perform && JSON.parse(st2.content[0].text).api === CONTRACT.api, 'answers come as text and as structured data, and the state includes the visuals, Perform and the versions');
  const codes = [await raw('no_such_tool'), await raw('transpose_song', { semitones: 'up' }), await raw('remove_section', { section: 'Nowhere' })].map(r => r.isError && r.structuredContent && r.structuredContent.error.code);
  ok(codes.join() === 'unknown_tool,invalid_input,rejected', 'errors carry a code an agent can act on (' + codes.join(', ') + ')');
  ok((await raw('get_song', [1, 2])).structuredContent.error.code === 'invalid_input', 'an input that is not an object is refused');

  /* ---- 2.16: the visuals, Perform and chord shapes ---- */
  const sv = await json('set_visuals', { look: 'concert', speed: 2, zoom: 1.5 });
  ok(sv.visuals.look === 'concert' && sv.visuals.speed === 2 && sv.visuals.zoom === 1.5 && (await p.evaluate(() => window.__daily.VZ.mode === 'concert' && window.__daily.CFG.vzSpeed === 2)), 'set_visuals: the look, the speed and the zoom');
  ok((await raw('set_visuals', { zoom: 9 })).structuredContent.error.code === 'invalid_input' && (await raw('set_visuals', { look: 'disco' })).isError, 'set_visuals refuses a zoom out of range and a look that does not exist');
  ok((await json('set_visuals', { reset: true, look: 'hex' })).visuals.speed === 1, 'set_visuals reset puts speed, size and zoom back to 1');
  const pf = await json('perform', { action: 'open', display: 'sheet' });
  ok(pf.open && pf.display === 'sheet' && (await p.evaluate(() => !!document.getElementById('perform') && document.getElementById('perform').classList.contains('pf-v-sheet') && !window.__daily.E.hasInput)), 'perform opens the Perform view on the lyric sheet, without the microphone');
  ok(!(await json('perform', { action: 'close' })).open, 'perform closes it');
  const cs = await json('get_chord_shape', { chord: 'E', count: 2 });
  ok(cs.chord === 'E' && cs.shapes[0].frets === '0 2 2 1 0 0' && cs.shapes.length === 2 && cs.strings_low_to_high === 'E A D G B E', 'get_chord_shape: E in standard tuning is 0 2 2 1 0 0, with another way to play it');
  ok((await raw('get_chord_shape', { chord: 'Q7' })).structuredContent.error.code === 'invalid_input', 'get_chord_shape refuses something that is not a chord');

  /* ---- 2.16: changes in order, a burst is one note, and a runaway agent is slowed down ---- */
  await p.evaluate(() => document.querySelectorAll('#toasts .toast').forEach(x => x.remove()));
  const order = await p.evaluate(async () => { const c = n => window.dailyStudio.call('add_section', { name: n, chords: ['C'] }); await Promise.all([c('Order A'), c('Order B'), c('Order C')]); return window.__daily.S.sections.map(s => s.name).filter(n => /^Order/.test(n)).join(); });
  ok(order === 'Order A,Order B,Order C', 'changes sent at once are made one at a time, in the order they came (' + order + ')');
  ok(await p.evaluate(() => { const ts = [...document.querySelectorAll('#toasts .toast')].filter(x => /🤖/.test(x.textContent)); return ts.length === 1 && /and 2 more/.test(ts[0].textContent); }), 'a burst of agent changes shows as one note (“… and 2 more”)');
  await wait(1100);
  const burst = await p.evaluate(async () => { const rs = await Promise.all(Array.from({ length: 45 }, () => window.dailyStudio.call('get_song', { include_lyrics: false }))); return rs.filter(r => r.isError && r.structuredContent.error.code === 'busy').length; });
  ok(burst >= 10 && burst < 45, 'more than 30 reads in a second: the extra ones are told to wait (' + burst + ' of 45 were “busy”)');
  await wait(1100); ok(!(await raw('get_song')).isError, 'a moment later it answers again');

  /* ---- 2.16: WebMCP that arrives late, or refuses a name it already has ---- */
  const late = await t.open({ init: () => { setTimeout(() => { window.__late = new Map(); Object.defineProperty(navigator, 'modelContext', { configurable: true, value: { registerTool(x) { if (window.__late.has(x.name)) throw new Error('duplicate'); window.__late.set(x.name, x); }, unregisterTool(n) { window.__late.delete(n); } } }); }, 1200); } });
  const lt = await t.poll(() => late.evaluate(() => window.__late && window.__late.size), 6000);
  ok(lt === N, 'WebMCP that shows up after the page (an extension, say) still gets every tool (' + lt + ')');
  const again = await late.evaluate(() => { window.__daily.agentRegister(); window.__daily.agentRegister(); return window.__late.size; });
  ok(again === N, 'offering the tools again over names the browser already holds works (it takes them back first, through unregisterTool)');

  /* ---- an earlier WebMCP draft: provideContext ---- */
  const q = await t.open({ init: fakeMC('ctx') });
  const q1 = await q.evaluate(() => ({ calls: window.__mc.calls, n: window.__mc.tools.size }));
  ok(q1.calls.includes('provide') && q1.n === N, 'browsers with provideContext get all the tools in one call');
  ok(!t.errs.length, 'no console / page / network errors' + (t.errs.length ? ': ' + t.errs.join(' | ') : ''));
});
