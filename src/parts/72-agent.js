/* ============================================================
   Part 72 · AI AGENT TOOLS (WebMCP): an AI agent in this browser can use the studio
   The studio's main actions are offered as tools through WebMCP (navigator.modelContext), so an assistant built into
   the browser, or one the person runs, can read the song, load a chord sheet, change the key or tempo, edit sections,
   set the band, play and stop, and export, by calling the same functions the buttons call. The same tools are on
   window.dailyStudio for agents that drive the page with scripts.
   · Everything runs here, in this page. Nothing is sent anywhere and nothing new is fetched; the agent's own AI is the agent's.
   · Never offered: the microphone, the camera, recording, deleting songs, or anything in Settings.
   · Every change an agent makes shows a 🤖 note and is one undo step (Ctrl+Z); a new song keeps the old one in ☰ Songs.
   · Settings ▸ Workflow ▸ “Let AI agents in this browser use the studio” turns it all off (on by default).
   ============================================================ */
const AGT = { tools: [], reg: null, log: [], via: '', names: [], mc: null, q: Promise.resolve(), calls: [], note: null, noteT: 0, noteN: 0 };
const agentOn = () => CFG.agents !== false;
/** a tool's answer: text for every client, and the same data as structuredContent (an object) for clients that read it */
const agTxt = o => { const r = { content: [{ type: 'text', text: typeof o === 'string' ? o : JSON.stringify(o, null, 1) }] }; if (o && typeof o === 'object' && !Array.isArray(o)) r.structuredContent = o; return r; };
function agentSay(msg) {
  const now = Date.now(); AGT.log.unshift({ t: now, msg }); AGT.log.length = Math.min(AGT.log.length, 40);
  const el = AGT.note; if (el && el.isConnected && now - AGT.noteT < 1500) { AGT.noteN++; el.textContent = '🤖 AI agent: ' + msg + ' (and ' + AGT.noteN + ' more)'; }   /* a burst of changes is one note */
  else { toast('🤖 AI agent: ' + msg, 'ok'); const box = document.getElementById('toasts'); AGT.note = box && box.lastElementChild; AGT.noteN = 0; }
  AGT.noteT = now; bus.emit('agent', msg);
}
const agKeyName = (root, minor) => pcName(root, (minor ? root === 3 : root === 6) ? !!CFG.flats : keyUsesFlats(root, minor)) + (minor ? ' minor' : ' major');   /* F#/Gb, D#/Eb: as the song spells them */
/** "E", "E major", "C#m", "Bb minor", "f# min" → { root, minor } (minor from the text, or from `mode`) */
function agKey(s, mode) {
  const m = /^\s*([A-Ga-g])([#b♯♭]?)\s*(m(?!aj)|min(?:or)?|maj(?:or)?)?\s*$/.exec(String(s || '')); if (!m) return null;
  const root = parsePc(m[1].toUpperCase() + m[2].replace('♯', '#').replace('♭', 'b')); if (root == null) return null;
  const minor = m[3] ? /^m(?!aj)|^min/i.test(m[3]) : mode ? /^min/i.test(mode) : false; return { root, minor };
}
/** a section by its number (1 = the first) or its name ("Chorus", "chorus 2", "verse") */
function agSec(ref) {
  if (typeof ref === 'number' || /^\d+$/.test(String(ref || ''))) { const i = +ref - 1; return S.sections[i] ? i : -1; }
  const l = String(ref || '').trim().toLowerCase(); if (!l) return -1;
  let i = S.sections.findIndex(s => s.name.toLowerCase() === l); if (i < 0) i = S.sections.findIndex(s => s.name.toLowerCase().startsWith(l)); return i;
}
/** a bar's chords: "Am", "Am G", "" (no chord). Throws on a chord the app cannot play, naming it. */
function agBar(c) {
  const s = String(c == null ? '' : c).trim(); if (!s || s === '-' || s === '%') return '';
  s.split(/\s+/).forEach(x => { if (!parseChord(x)) throw new Error('“' + x + '” is not a chord the studio can play (try e.g. Am, F#m7, Bb/D, Csus4, G7)'); });
  return s.split(/\s+/).join(' ');
}
function agSong(withLyrics) {
  const secs = S.sections.map((s, i) => { const o = { number: i + 1, name: s.name, bars: s.bars.map(b => b.chord || '') }; if (withLyrics !== false) o.lyrics = s.lyrics || ''; return o; });
  return { title: S.title || '', artist: S.artist || '', key: agKeyName(S.key, S.minor), scale: S.scale, bpm: S.bpm, time_signature: S.ts.join('/'), capo: S.capo || 0, tuning: S.tuningName,
    total_bars: totalBars(), length_seconds: Math.round(songSlots() * slotDur()), sections: secs,
    lyrics_format: 'Chords sit inline in square brackets before the syllable they land on: "[Am]Salt wind on the [F]water".' };
}
/* ---------- song-wide transpose (chords, inline lyric chords, key and tab) ---------- */
function agTrChord(sym, d, fl) {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(sym); if (!m || !parseChord(sym)) return sym;
  const t = x => pcName((parsePc(x) + d + 120) % 12, fl); return t(m[1]) + m[2] + (m[3] ? '/' + t(m[3]) : '');
}
function songTranspose(d) {
  d = Math.round(d) % 12; if (!d) return; const key = (S.key + d + 12) % 12;
  /* F#/Gb major and D#/Eb minor can be spelled either way: keep the sharps or flats the song already uses */
  const either = S.minor ? key === 3 : key === 6, sharp = S.sections.some(s => s.bars.some(b => /#/.test(b.chord || '')));
  const fl = either ? !sharp : keyUsesFlats(key, S.minor);
  S.sections.forEach(sec => {
    sec.bars.forEach(b => { b.chord = barChords(b).map(c => agTrChord(c, d, fl)).join(' '); b.tab.forEach(n => { if (typeof n.f === 'number') { let f = n.f + d; while (f < 0) f += 12; while (f > 24) f -= 12; n.f = f; } }); });
    sec.lyrics = (sec.lyrics || '').replace(/\[([^\]\s]+)\]/g, (all, c) => parseChord(c) ? '[' + agTrChord(c, d, fl) + ']' : all);
  });
  S.key = key; S.voicePref = {}; CFG.flats = fl; saveCfg();
}

/* ---------- the tools ---------- */
const AG_GOALS = ['songwriter', 'performer', 'creator', 'practice', 'teacher', 'fullrig'];
const agStr = (d, o) => Object.assign({ type: 'string', description: d }, o || {});
const agNum = (d, o) => Object.assign({ type: 'number', description: d }, o || {});
const agBool = d => ({ type: 'boolean', description: d });
const agSecP = d => ({ type: ['string', 'number'], description: d });
const agObj = (props, req) => ({ type: 'object', properties: props || {}, required: req || [], additionalProperties: false });
function agTool(name, description, inputSchema, run, ann) { AGT.tools.push({ name, description, inputSchema, run, annotations: Object.assign({ readOnlyHint: false }, ann || {}) }); }
/** a change: one undo step, a 🤖 note, and the song as it is now */
function agChange(what, fn) { const before = snap(); fn(); if (!histPush(before)) bus.emit('song'); agentSay(what); return what; }

agTool('get_song', 'Read the song that is open in the studio: title, artist, key, tempo (BPM), time signature, capo, tuning, and every section with the chord of each bar and its lyrics (chords inline in [brackets]). Call this first to see what you are working with.',
  agObj({ include_lyrics: agBool('Include the words of each section (default true).') }), i => agTxt(agSong(i.include_lyrics)), { readOnlyHint: true });

agTool('get_studio_state', 'What the studio is doing: playing or stopped, the bar the playhead is on, loop and metronome, whether sound is running, whether an input is connected, which band parts are on, the open workspace and panel, and the songs saved in this browser.',
  agObj(), () => {
    const fb = flatBars(), bar = Math.min(fb.length, Math.floor(playheadSlot() / spb()) + 1), g = typeof goalNow === 'function' ? goalNow() : null;
    return agTxt({ playing: !!T.playing, bar, loop: !!T.loop, metronome: !!T.metro, audio: E.ctx ? E.ctx.state : 'off', input_connected: !!E.hasInput, recording: !!T.rec,
      band: { drums: !!S.band.drumsOn, bass: !!S.band.bassOn, rhythm_guitar: !!S.band.compOn, lead_tab: !!S.band.leadOn, drum_pattern: S.band.patName, bass_style: S.band.bassStyle, strum_pattern: S.band.compStyle },
      workspace: g ? g.id : null, panel: DOCK.cur, song: S.title, saved_songs: PRJ.list.map(r => r.title || 'Untitled'),
      visuals: agVisuals(), perform: { open: !!PF.on, display: pfView() }, api: AG_API, app_version: VERSION, build: BUILD });
  }, { readOnlyHint: true });

agTool('get_key_chords', 'The chords that belong to a key (with Roman numerals, triads and sevenths) and common progressions spelled in that key. Use it to suggest or write chord progressions. Defaults to the song\'s key.',
  agObj({ key: agStr('A key such as "E", "C#m", "Bb minor". Default: the song\'s key.') }), i => {
    const k = i.key ? agKey(i.key) : { root: S.key, minor: S.minor }; if (!k) throw new Error('Key not understood: ' + i.key);
    const dia = diatonic(k.root, k.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)').map(d => ({ roman: d.roman, triad: d.triad, seventh: d.seventh }));
    const progs = PROGS.filter(([, r]) => (r.split(' ')[0] === 'i') === !!k.minor).map(([n, r]) => ({ name: n.replace(/\s{2,}/g, ' · '), chords: r.split(' ').map(t => romanToChord(t, k.root, k.minor)).join(' ') }));
    return agTxt({ key: agKeyName(k.root, k.minor), chords: dia, progressions: progs });
  }, { readOnlyHint: true });

agTool('load_chord_sheet', 'Turn a chord sheet into a song the studio plays: section headings like [Verse 1] / [Chorus], a line of chords over each line of words (or [Am] inline, or ChordPro), and optional "Capo: 2", "Key: E", "Tempo: 96" lines. Each chord becomes a bar; the key is read from the chords; a guitar part is written into the tab; the band plays it. By default it makes a new song and keeps the current one in the song list.',
  agObj({ text: agStr('The chord sheet, with its line breaks and spacing kept (chords line up with the words by column).'),
    where: agStr('new_song (default), replace (this song\'s sections and key; undoable), or append (after this song\'s sections).', { enum: ['new_song', 'replace', 'append'] }),
    chord_length: agNum('How long each chord lasts: 1 bar (default), 2 bars, or 0.5 (two chords of a line share a bar).', { enum: [0.5, 1, 2] }),
    key: agStr('Override the key, e.g. "E" or "C#m". Default: read from the chords (or the sheet\'s Key: line).'),
    guitar_part: agStr('Pattern written into the tab, or "none". Default "Block strum".', { enum: ['none'].concat(FILLS) }),
    title: agStr('Song title (default: from the sheet, or the first line of the chorus).'), artist: agStr('Artist.') }, ['text']),
  async i => {
    const p = chordSheetParse(i.text); if (!p.sections.length || !p.stats.used.length) throw new Error('No chords found in that text. Put each line of chords above its line of words, or use [Am] inline.');
    const k = i.key ? agKey(i.key) : null; if (i.key && !k) throw new Error('Key not understood: ' + i.key);
    const o = { mode: { replace: 'A', append: 'C' }[i.where] || 'N', per: [0.5, 1, 2].includes(+i.chord_length) ? +i.chord_length : 1, key: k ? k.root + ':' + (k.minor ? 'm' : 'M') : 'auto', fill: i.guitar_part || 'Block strum', title: i.title || '', artist: i.artist };
    await chordSheetApply(p, o); agentSay('loaded a chord sheet' + (o.mode === 'N' ? ' as a new song' : ''));
    return agTxt({ done: true, song: agSong(false), simplified_chords: p.stats.simplified, note: 'Use transport {action:"play"} to hear it.' });
  }, { destructiveHint: false });

agTool('set_song_details', 'Change the song\'s title, artist, tempo, key (this only relabels the key; use transpose_song to move the chords), time signature or capo.',
  agObj({ title: agStr('Title.'), artist: agStr('Artist.'), bpm: agNum('Tempo in beats per minute, 30–260.'), key: agStr('Key such as "G", "Em", "F# minor".'),
    time_signature: agStr('e.g. "4/4", "3/4", "6/8".', { pattern: '^\\d{1,2}/(2|4|8)$' }), capo: agNum('Capo fret, 0–12.') }),
  i => {
    const k = i.key != null ? agKey(i.key) : null; if (i.key != null && !k) throw new Error('Key not understood: ' + i.key);
    const ts = i.time_signature ? i.time_signature.split('/').map(Number) : null; if (ts && !(ts[0] >= 1 && ts[0] <= 16)) throw new Error('Time signature not understood: ' + i.time_signature);
    const what = agChange('changed the song details', () => {
      if (i.title != null) S.title = String(i.title).slice(0, 120); if (i.artist != null) S.artist = String(i.artist).slice(0, 120);
      if (i.bpm != null) S.bpm = clamp(Math.round(+i.bpm) || S.bpm, 30, 260); if (i.capo != null) S.capo = clamp(Math.round(+i.capo) || 0, 0, 12);
      if (k) { S.key = k.root; S.minor = k.minor; S.scale = k.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)'; CFG.flats = keyUsesFlats(k.root, k.minor); saveCfg(); }
      if (ts) { S.ts = ts; S.band.drumLen = Math.min(32, ts[0] * 16 / ts[1]); T.bars = null; }
    });
    return agTxt({ done: what, title: S.title, artist: S.artist, key: agKeyName(S.key, S.minor), bpm: S.bpm, time_signature: S.ts.join('/'), capo: S.capo });
  });

agTool('transpose_song', 'Move the whole song up or down: every chord in the bars and in the lyrics, the key, and the tab notes.',
  agObj({ semitones: agNum('Semitones, -11 to 11 (e.g. 2 = up a whole step, -1 = down a half step).') }, ['semitones']),
  i => { const d = Math.round(+i.semitones); if (!d || Math.abs(d) > 11) throw new Error('semitones must be a whole number from -11 to 11, not 0'); agChange('transposed the song ' + (d > 0 ? 'up ' : 'down ') + Math.abs(d), () => songTranspose(d)); return agTxt({ done: true, key: agKeyName(S.key, S.minor), sections: agSong(false).sections }); });

agTool('edit_section', 'Change one section: rename it, replace its bars\' chords, and/or replace its lyrics. Bars: one entry per bar, "Am" or "Am G" (two chords in the bar) or "" (no chord). Lyrics: chords inline in [brackets] before the syllable.',
  agObj({ section: agSecP('Section number (1 = first) or name, e.g. "Chorus".'), name: agStr('New name.'), chords: { type: 'array', items: { type: 'string' }, description: 'The chord of each bar, in order. Replaces all bars.', maxItems: 128 }, lyrics: agStr('The words, with [Chord] marks inline.') }, ['section']),
  i => {
    const si = agSec(i.section); if (si < 0) throw new Error('No section “' + i.section + '”. Sections: ' + S.sections.map((s, n) => (n + 1) + ' ' + s.name).join(', '));
    const bars = i.chords ? i.chords.map(agBar) : null; if (bars && !bars.length) throw new Error('chords needs at least one bar');
    agChange('edited ' + S.sections[si].name, () => { const s = S.sections[si]; if (i.name) s.name = String(i.name).slice(0, 40); if (bars) { s.bars = bars.map((c, n) => { const b = newBar(c); const old = s.bars[n]; if (old && old.chord === c) b.tab = old.tab; return b; }); T.bars = null; } if (i.lyrics != null) s.lyrics = String(i.lyrics); });
    return agTxt({ done: true, section: agSong(true).sections[si] });
  });

agTool('add_section', 'Add a section with its chords (one per bar) and optional lyrics.',
  agObj({ name: agStr('Section name, e.g. "Bridge".'), chords: { type: 'array', items: { type: 'string' }, description: 'The chord of each bar.', minItems: 1, maxItems: 128 }, lyrics: agStr('Words with [Chord] marks inline.'), position: agNum('Where it goes: 1 = first. Default: at the end.') }, ['name', 'chords']),
  i => {
    const bars = i.chords.map(agBar), at = i.position != null ? clamp(Math.round(+i.position) - 1, 0, S.sections.length) : S.sections.length;
    agChange('added ' + i.name, () => { const s = mkSection(String(i.name).slice(0, 40), bars); s.lyrics = i.lyrics || ''; S.sections.splice(at, 0, s); T.bars = null; });
    return agTxt({ done: true, sections: agSong(false).sections.map(s => s.number + ' ' + s.name) });
  });

agTool('remove_section', 'Remove one section (undoable with undo).',
  agObj({ section: agSecP('Section number (1 = first) or name.') }, ['section']),
  i => { const si = agSec(i.section); if (si < 0) throw new Error('No section “' + i.section + '”'); if (S.sections.length < 2) throw new Error('A song needs at least one section'); const nm = S.sections[si].name; agChange('removed ' + nm, () => { S.sections.splice(si, 1); SEL.sec = 0; SEL.bar = 0; TE.sec = 0; TE.bi = 0; T.bars = null; }); return agTxt({ done: true, sections: agSong(false).sections.map(s => s.number + ' ' + s.name) }); },
  { destructiveHint: true });

agTool('set_band', 'Turn the backing band\'s parts on or off and choose their styles.',
  agObj({ drums: agBool('Drums on/off.'), bass: agBool('Bass on/off.'), rhythm_guitar: agBool('Rhythm guitar (strums the chords) on/off.'), lead_tab: agBool('Lead guitar playing the tab on/off.'),
    drum_pattern: agStr('Drum pattern.', { enum: Object.keys(DPATS) }), bass_style: agStr('Bass style.', { enum: BASS_STYLES }), strum_pattern: agStr('Rhythm guitar pattern.', { enum: Object.keys(STRUMS) }) }),
  i => {
    if (i.drum_pattern && !DPATS[i.drum_pattern]) throw new Error('Unknown drum pattern'); if (i.bass_style && !BASS_STYLES.includes(i.bass_style)) throw new Error('Unknown bass style'); if (i.strum_pattern && !STRUMS[i.strum_pattern]) throw new Error('Unknown strum pattern');
    agChange('changed the band', () => { [['drums', 'drumsOn'], ['bass', 'bassOn'], ['rhythm_guitar', 'compOn'], ['lead_tab', 'leadOn']].forEach(([a, b]) => { if (i[a] != null) S.band[b] = !!i[a]; }); if (i.drum_pattern) setDrumPattern(i.drum_pattern); if (i.bass_style) S.band.bassStyle = i.bass_style; if (i.strum_pattern) S.band.compStyle = i.strum_pattern; });
    try { syncBandStrip(); if (paneVisible('band')) renderBand(); } catch (e) { }
    return agTxt({ done: true, band: { drums: !!S.band.drumsOn, bass: !!S.band.bassOn, rhythm_guitar: !!S.band.compOn, lead_tab: !!S.band.leadOn, drum_pattern: S.band.patName, bass_style: S.band.bassStyle, strum_pattern: S.band.compStyle } });
  });

agTool('transport', 'Play or stop the song (the band plays the chords), start from a bar, and switch the loop or the metronome. It never records.',
  agObj({ action: agStr('play, stop (back to the start) or pause (stay where it is). Omit to only change loop/metronome.', { enum: ['play', 'stop', 'pause'] }), from_bar: agNum('Start playing from this bar (1 = first).'), loop: agBool('Loop the song.'), metronome: agBool('Metronome click.') }),
  async i => {
    if (i.loop != null) T.loop = !!i.loop; if (i.metronome != null) T.metro = !!i.metronome; syncTransport();
    if (i.action === 'stop' || i.action === 'pause') { stopPlay(i.action === 'pause'); agentSay(i.action === 'stop' ? 'stopped' : 'paused'); }
    if (i.action === 'play') {
      if (T.rec) throw new Error('The studio is recording; the person has to stop it.');
      if (typeof AK !== 'undefined' && AK.killed) throw new Error('Audio was switched off with the kill switch (Ctrl + .). The person has to resume it in the Audio panel.');
      if (i.from_bar != null) { const b = clamp(Math.round(+i.from_bar) - 1, 0, Math.max(0, totalBars() - 1)); if (T.playing) stopPlay(true); T.cursor = b * spb(); }
      if (!T.playing) await play(); agentSay('pressed play');
    }
    const st = { playing: !!T.playing, loop: !!T.loop, metronome: !!T.metro, audio: E.ctx ? E.ctx.state : 'off' };
    if (T.playing && E.ctx && E.ctx.state !== 'running') st.note = 'The browser only lets a page make sound after the person has clicked or tapped on it once. Ask them to click anywhere on the studio (or press ▶), and it will be heard.';
    return agTxt(st);
  });

agTool('open_workspace', 'Arrange the studio for a goal: songwriter (words, chords and tab), performer (stage visuals, tones, tuner), creator (record and post a video), practice (fretboard, loop, metronome), teacher (whiteboard, notes, screen recording) or fullrig (everything).',
  agObj({ workspace: agStr('Which workspace.', { enum: AG_GOALS }) }, ['workspace']),
  i => { if (!goalGo(i.workspace)) throw new Error('Unknown workspace'); agentSay('opened the ' + goalNow().name + ' workspace'); return agTxt({ done: true, workspace: i.workspace, panel: DOCK.cur }); });

agTool('list_songs', 'The songs saved in this browser (title and id), newest first.', agObj(), () => agTxt(PRJ.list.map(r => ({ id: r.id, title: r.title || 'Untitled', open: r.id === PRJ.cur }))), { readOnlyHint: true });
agTool('open_song', 'Open another saved song (the current one is saved first).', agObj({ song: agStr('The song\'s id from list_songs, or its exact title.') }, ['song']),
  async i => { const r = PRJ.list.find(x => x.id === i.song) || PRJ.list.find(x => (x.title || '').toLowerCase() === String(i.song).toLowerCase()); if (!r) throw new Error('No saved song “' + i.song + '”'); if (T.playing) stopPlay(true); await projLoad(r.id); agentSay('opened “' + (S.title || 'Untitled') + '”'); return agTxt(agSong(false)); });

agTool('export_song', 'The song as text: ultimate_guitar (chords over words, with tab), chordpro, lyrics (words only) or tab (ASCII tab only). Nothing is downloaded; the text is returned.',
  agObj({ format: agStr('Which format.', { enum: ['ultimate_guitar', 'chordpro', 'lyrics', 'tab'] }) }, ['format']),
  i => agTxt(i.format === 'chordpro' ? buildChordPro() : i.format === 'lyrics' ? buildLyricsOnly() : i.format === 'tab' ? S.sections.filter(hasTab).map(s => '[' + s.name + ']\n' + renderTabBars(s.bars)).join('\n\n') : buildUG({ tags: false })), { readOnlyHint: true });

agTool('undo', 'Undo or redo the last change to the song (yours or the person\'s).', agObj({ redo: agBool('Redo instead of undo.') }),
  i => { const n = i.redo ? histStack.r.length : histStack.u.length; if (!n) return agTxt('Nothing to ' + (i.redo ? 'redo' : 'undo') + '.'); i.redo ? redo() : undo(); agentSay(i.redo ? 'redid a change' : 'undid a change'); return agTxt({ done: true, song: agSong(false) }); });

/* ---------- 2.16: the visuals, Perform and chord shapes ---------- */
const AG_LOOKS = VMODES.map(m => m[0]);
const agVisuals = () => ({ look: VZ.mode, look_name: (VMODES.find(m => m[0] === VZ.mode) || [, VZ.mode])[1], speed: vzSpeed(), size: vzSize(), zoom: vzZoom(), looks: VMODES.map(([id, name]) => ({ id, name })) });
agTool('set_visuals', 'Change the visuals: the look, how fast it moves (speed 0.25–3), how big the hexagons of Hex Resonance and the pulse grid are (size 0.5–2.5) and how far it is pushed in (zoom 1–3). Applies on the Visuals tab, the Stage and in Perform. It never turns the camera on. get_studio_state lists the looks.',
  agObj({ look: agStr('Which look (an id from get_studio_state.visuals.looks, e.g. "hex", "concert", "halo", "aurora").', { enum: AG_LOOKS }), speed: agNum('0.25 to 3 (1 = normal).'), size: agNum('0.5 to 2.5 (1 = normal).'), zoom: agNum('1 to 3 (1 = the whole picture).'), reset: agBool('Put speed, size and zoom back to 1 first.') }),
  i => {
    if (i.reset) VZA.forEach(([k]) => { CFG[k] = 1; });
    [['speed', 'vzSpeed'], ['size', 'vzSize'], ['zoom', 'vzZoom']].forEach(([a, k]) => { if (i[a] == null) return; const d = VZA.find(x => x[0] === k); if (i[a] < d[2] || i[a] > d[3]) throw agErr('invalid_input', '“' + a + '” must be from ' + d[2] + ' to ' + d[3]); CFG[k] = i[a]; });
    if (i.look) vzSetMode(i.look); saveCfg(); VZ.spec = null; $$('[data-vza]').forEach(x => x.classList.toggle('on', vzAdjusted()));
    agentSay('changed the visuals'); return agTxt({ done: true, visuals: agVisuals() });
  }, { idempotentHint: true });
agTool('perform', 'Open or close the full-screen Perform view, and choose its display: shapes (the big chord, the lyrics and the chord shapes beside them), big (the big chord and the lyrics) or sheet (the lyrics large, like a songbook). It opens on a short readiness check; it never turns the microphone or the camera on, and never records.',
  agObj({ action: agStr('open or close (omit to only change the display).', { enum: ['open', 'close'] }), display: agStr('Which display.', { enum: ['shapes', 'big', 'sheet'] }) }),
  i => {
    if (i.display) perfViewSet(i.display);
    if (i.action === 'open' && !PF.on) perfOpen(); if (i.action === 'close' && PF.on) perfClose();
    agentSay(i.action === 'open' ? 'opened Perform' : i.action === 'close' ? 'closed Perform' : 'changed the Perform display'); return agTxt({ done: true, open: !!PF.on, display: pfView() });
  }, { idempotentHint: true });
agTool('get_chord_shape', 'How to play a chord on the guitar in this song\'s tuning and capo: the fret for each string from the lowest to the highest (x = not played, 0 = open), the lowest fret used and whether it is a barre, with other ways to play it. The first shape is the one the song uses.',
  agObj({ chord: agStr('A chord such as "Am", "F#m7", "B/D#", "Csus4".'), count: agNum('How many shapes to list, 1 to 6 (default 3).') }, ['chord']),
  i => {
    const c = parseChord(String(i.chord).trim()); if (!c) throw agErr('invalid_input', '“' + i.chord + '” is not a chord the studio knows (try e.g. Am, F#m7, Bb/D, Csus4, G7)');
    const sym = String(i.chord).trim(), all = voicings(sym, S.tuning, S.capo, 12), pick = S.voicePref[sym] || 0, n = clamp(Math.round(i.count || 3), 1, 6);
    const order = [all[pick]].concat(all.filter((v, k) => k !== pick)).filter(Boolean).slice(0, n);
    return agTxt({ chord: c.name, tuning: S.tuningName, strings_low_to_high: S.tuning.map(m => tunPc(m)).join(' '), capo: S.capo || 0,
      shapes: order.map(v => ({ frets: v.frets.map(f => f == null ? 'x' : f).join(' '), lowest_fret: v.base, barre: !!v.barre, fingers: v.fingers })), note: order.length ? undefined : 'No playable shape was found in this tuning.' });
  }, { readOnlyHint: true });

/* ---------- running a tool, and offering them ---------- */
/* The contract. AG_API changes only when a tool is removed or renamed, or a required input changes; new tools and new optional
   inputs keep it. A renamed tool keeps its old name here, so an agent written for an earlier version still works.
   test/agent-contract.json holds the published tools and their required inputs; the tests fail if one disappears or changes. */
const AG_API = '2';
const AG_ALIAS = {};
const AG_LIMIT = { change: 20, read: 40, timeout: 20000, maxOut: 250000 };   /* calls per second (changes / reads), ms per call, characters per answer */
/** an error an agent can act on: code is one of unknown_tool, disabled, loading, invalid_input, busy, timeout, rejected (the studio refused, with the reason) */
function agErr(code, msg) { const e = new Error(msg); e.code = code; return e; }
const agFail = (code, msg) => ({ content: [{ type: 'text', text: 'Error (' + code + '): ' + msg }], structuredContent: { error: { code, message: msg } }, isError: true });
/** check the input against the tool's schema (types, enums, required), so a wrong call gets a clear answer naming the problem */
function agCheck(t, raw) {
  let input; try { input = raw == null ? {} : JSON.parse(JSON.stringify(raw)); } catch (e) { throw agErr('invalid_input', 'The input must be plain JSON'); }   /* a copy: nothing the agent holds can change it mid-call */
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw agErr('invalid_input', 'The input must be an object');
  const sc = t.inputSchema, p = sc.properties || {}, bad = m => { throw agErr('invalid_input', m); };
  (sc.required || []).forEach(k => { if (input[k] == null || input[k] === '') bad('Missing “' + k + '”'); });
  Object.keys(input).forEach(k => {
    const d = p[k], v = input[k]; if (!d) bad('Unknown parameter “' + k + '”. Parameters: ' + (Object.keys(p).join(', ') || 'none')); if (v == null) return;
    const ty = [].concat(d.type);
    if (ty.includes('number') && ty.length === 1 && (typeof v !== 'number' || !isFinite(v))) { if (typeof v === 'string' && v.trim() && isFinite(+v)) input[k] = +v; else bad('“' + k + '” must be a number'); }
    if (ty.includes('boolean') && typeof v !== 'boolean') bad('“' + k + '” must be true or false');
    if (ty.includes('string') && !(typeof v === 'string' || (ty.includes('number') && typeof v === 'number' && isFinite(v)))) bad('“' + k + '” must be ' + (ty.includes('number') ? 'a number or text' : 'text'));
    if (typeof input[k] === 'string' && input[k].length > (k === 'text' ? 200000 : 20000)) bad('“' + k + '” is too long');
    if (d.type === 'array') { if (!Array.isArray(v) || (d.maxItems && v.length > d.maxItems)) bad('“' + k + '” must be a list' + (d.maxItems ? ' of up to ' + d.maxItems : '')); if (d.minItems && v.length < d.minItems) bad('“' + k + '” needs at least ' + d.minItems); if (d.items && d.items.type === 'string' && v.some(x => typeof x !== 'string')) bad('“' + k + '” must be a list of text'); }
    if (d.enum && !d.enum.includes(input[k])) bad('“' + k + '” must be one of: ' + d.enum.join(', '));
  });
  return input;
}
/** run one tool: checked, rate-limited, timed out, changes one at a time, answers capped */
async function agentCall(name, input) {
  const t = AGT.tools.find(x => x.name === (AG_ALIAS[name] || name)); if (!t) return agFail('unknown_tool', 'Unknown tool “' + name + '”. Tools: ' + AGT.tools.map(x => x.name).join(', '));
  if (!agentOn()) return agFail('disabled', 'The person has turned off AI agent access in Settings ▸ Workflow.');
  if (!S || !E) return agFail('loading', 'The studio is still loading. Try again in a moment.');
  const ro = !!t.annotations.readOnlyHint, now = performance.now(); AGT.calls = AGT.calls.filter(c => now - c.t < 1000);
  if (AGT.calls.filter(c => c.ro === ro).length >= (ro ? AG_LIMIT.read : AG_LIMIT.change)) return agFail('busy', 'Too many calls in a second. Wait a moment and try again.');
  AGT.calls.push({ t: now, ro });
  let inp; try { inp = agCheck(t, input); } catch (e) { return agFail(e.code || 'invalid_input', e.message); }
  const go = async () => {
    let tm; const limit = new Promise((_, no) => { tm = setTimeout(() => no(agErr('timeout', 'The studio took too long to answer. The change may still finish; check with get_song.')), AG_LIMIT.timeout); });
    try { return await Promise.race([Promise.resolve().then(() => t.run(inp)), limit]); } finally { clearTimeout(tm); }
  };
  try {
    let r; if (ro) r = await go(); else { const job = AGT.q.then(go, go); AGT.q = job.catch(() => { }); r = await job; }   /* changes wait their turn */
    const txt = r && r.content && r.content[0] && r.content[0].text;
    if (txt && txt.length > AG_LIMIT.maxOut) return { content: [{ type: 'text', text: txt.slice(0, AG_LIMIT.maxOut) + '\n… (cut: the answer was longer than ' + AG_LIMIT.maxOut + ' characters)' }] };
    return r;
  } catch (e) { return agFail(e && e.code || 'rejected', (e && e.message) || String(e)); }
}
const agWebTool = t => ({ name: t.name, title: t.title || t.name.replace(/_/g, ' '), description: t.description, inputSchema: t.inputSchema, annotations: Object.assign({ title: t.name.replace(/_/g, ' '), openWorldHint: false }, t.annotations), execute: input => agentCall(t.name, input) });
function agentUnregister() {
  const mc = AGT.mc || navigator.modelContext; if (!mc || !AGT.reg) { AGT.reg = null; return; }
  try {
    if (AGT.via === 'registerTool') AGT.names.forEach((n, k) => { const r = AGT.reg[k]; try { if (r && typeof r.unregister === 'function') r.unregister(); else if (typeof mc.unregisterTool === 'function') mc.unregisterTool(n); } catch (e) { } });
    else if (typeof mc.clearContext === 'function') mc.clearContext(); else if (typeof mc.provideContext === 'function') mc.provideContext({ tools: [] });
  } catch (e) { console.warn('webmcp', e); }
  AGT.reg = null; AGT.via = ''; AGT.names = [];
}
/** offer the tools through WebMCP: registerTool (current drafts), or provideContext (earlier ones). Each tool on its own, so one
    refusal does not lose the rest; a name the browser already holds is taken back and offered again. */
function agentRegister() {
  agentUnregister(); const mc = typeof navigator !== 'undefined' && navigator.modelContext; AGT.mc = mc || null; if (!mc || !agentOn()) return false;
  try {
    if (typeof mc.registerTool === 'function') {
      AGT.reg = []; AGT.names = []; AGT.via = 'registerTool';
      AGT.tools.forEach(t => {
        const w = agWebTool(t); let r;
        try { r = mc.registerTool(w); } catch (e) { try { if (typeof mc.unregisterTool === 'function') mc.unregisterTool(t.name); r = mc.registerTool(w); } catch (e2) { console.warn('webmcp: ' + t.name, e2); return; } }
        if (r && typeof r.then === 'function') r.catch(e => console.warn('webmcp: ' + t.name, e));
        AGT.reg.push(r && typeof r.then !== 'function' ? r : null); AGT.names.push(t.name);
      });
    } else if (typeof mc.provideContext === 'function') { mc.provideContext({ tools: AGT.tools.map(agWebTool) }); AGT.reg = 'ctx'; AGT.via = 'provideContext'; AGT.names = AGT.tools.map(t => t.name); }
  } catch (e) { console.warn('webmcp', e); AGT.reg = null; AGT.via = ''; return false; }
  return !!AGT.reg && AGT.names.length > 0;
}
/** WebMCP can arrive after the page (a browser extension adds it, or the browser turns it on later): look again a few times,
    and offer the tools again if a different navigator.modelContext shows up */
function agentWatch() {
  [0, 600, 2000, 5000, 15000].forEach(ms => setTimeout(() => { const mc = navigator.modelContext; if (agentOn() && mc && (mc !== AGT.mc || !AGT.reg)) agentRegister(); }, ms));
}
/* the same tools for agents that drive the page with scripts (and for the tests): window.dailyStudio.call('get_song', {}) */
try {
  Object.defineProperty(window, 'dailyStudio', { configurable: true, value: Object.freeze({
    version: AG_API, app: VERSION, build: BUILD,
    about: 'the-daily.studio agent tools: the same tools this page offers through WebMCP (navigator.modelContext). Everything runs locally in this page.',
    tools: () => AGT.tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations })),
    describe: () => ({ api: AG_API, app: VERSION, build: BUILD, webmcp: AGT.via || null, enabled: agentOn(), aliases: Object.assign({}, AG_ALIAS), limits: Object.assign({}, AG_LIMIT), tools: AGT.tools.map(t => t.name) }),
    call: (name, input) => agentCall(name, input) }) });
} catch (e) { }
agentWatch();
