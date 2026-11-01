/* =====================================================================
   Part 17 · guided tour: a spotlight walkthrough of the key areas.
   Opens from Help (?), offers itself once on first run, keyboard driven,
   and never touches your song or settings.
   ===================================================================== */
const TOUR = { on: false, i: 0, el: null, spot: null, card: null, steps: [], raf: 0, token: 0 };
const tq = sel => () => { const e = $(sel); return e && e.getClientRects().length ? e : null; };
const tqf = (root, re) => () => { const e = $$(root).find(x => re.test(x.textContent)); return e && e.getClientRects().length ? e : null; };
const tourSide = id => () => { const t = $('#left .side-tabs .tab[data-id="' + id + '"]'); if (t) t.click(); };
function tourSteps() { return document.body.dataset.form === 'phone' ? tourStepsPhone() : tourStepsDesk(); }
function tourStepsDesk() {
  const tab = document.body.dataset.form === 'tablet';
  return [
    { t: null, title: 'Welcome to the-daily.studio', b: 'A guitar and voice studio that runs entirely in this browser tab. <b>Record</b> your guitar and mic, <b>split</b> any song into stems to play along with, and <b>write it down</b> as chords, tab and lyrics. Around that: a pedal rig with presets, a backing band, and a neural map and light show of your music.<br><br>This tour takes about two minutes. Use <kbd>→</kbd> <kbd>←</kbd> to move and <kbd>Esc</kbd> to leave. It never changes your song. Reopen it any time from <b>?</b> in the top bar.' },
    { t: tq('#left'), pre: tourSide('io'), drawer: 'left', side: 'right', title: '1 · Connect your guitar', b: 'Open <b>I/O</b> and choose your audio interface (a Focusrite, say) or microphone. If the list is blank, allow microphone access in the browser and press the refresh button (⟳). The <b>Loopback test</b> measures your real round-trip latency.<br><br>Use headphones, or your interface\'s hardware Direct Monitor, to avoid feedback.', tip: 'Wired headphones give the lowest delay. Bluetooth adds a lot.' },
    { t: tq('#transport'), side: 'bottom', title: '2 · Transport', b: 'Play, stop, loop, click, <b>record</b> (with a count-in and dry plus wet takes), position, tempo, time signature and key. <kbd>Space</kbd> plays and stops. The latency chip at the top right shows the current round-trip estimate.' },
    { t: tq('#dock > .dockbar, #dock .tabs'), side: 'bottom', title: '3 · Panels are tabs', b: 'Everything lives in these tabs. <b>Drag</b> a tab to reorder, <b>double-click</b> to float it as a window, and use <b>▦</b> in the top bar for layout presets and show / hide. <kbd>Alt</kbd>+<kbd>1…9</kbd> jumps by position.' },
    { t: tq('.bandstrip'), side: 'bottom', title: '4 · Your band, always one click away', b: 'Switch the <b>drums, bass, rhythm guitar and lead tab</b> on or off while you play. Right-click a chip for level, pan and style. The <b>Mix</b> menu picks a rehearsal setup, such as everything but the lead you are practising.' },
    { t: tq('.rigdeck'), pane: 'rig', side: 'bottom', title: '5 · The Rig: tone, A/B and scenes', b: 'The current tone, <b>A/B morph</b> to compare two settings, <b>Mutate</b> to explore, and <b>save, export or import</b> your own presets. Eight <b>scenes</b> store a whole board setup so one key (<kbd>1</kbd>…<kbd>8</kbd>) switches between a clean verse and a lead tone.' },
    { t: tq('.chainbar'), pane: 'rig', side: 'bottom', title: '6 · Pedalboard and signal chain', b: 'This strip is your signal path, in order. <b>Drag</b> pedals to reorder, click one to scroll to it, and use each pedal\'s <b>⚙</b> to resize, recolour, collapse, hide or bind a footswitch key or MIDI note. <b>Stomp</b> view turns the board into big tiles for playing live.' },
    { t: tq('#left'), pre: tourSide('tones'), drawer: 'left', side: 'right', title: '7 · Tones', b: 'Search and filter the preset library: clean, crunch, lead, acoustic, ambient and more. Click one to load it. Your saved presets appear under <b>User</b>.' },
    { t: tq('#timeline'), side: 'top', title: '8 · Arrangement', b: 'The song as a DAW: lanes for chords, tab, bass, drums, your <b>Guitar</b> and <b>Vocal</b> inputs, the loaded backing track and its stems. Drag a lane\'s grip (⠿) to reorder, its bottom edge to resize, ⋯ for colour and hide, <b>Lanes ▾</b> to add or reset. Arm ● the guitar and vocal lanes and press <kbd>R</kbd> to record both at once. <b>Follow</b> keeps the playhead in view.' },
    { t: tq('#timeline'), side: 'top', title: '9 · Drop things in, edit them as clips', b: 'Drag an audio file, lyrics (<b>.txt .md .lrc</b>), a <b>MIDI</b> file or a song file (<b>.zip</b>) anywhere on the page. Audio asks what it is (backing track, vocal, guitar or hum); MIDI opens as a song with chords and a lead tab. Your recordings are <b>clips</b>: click one, drag it to move (it snaps to the beat), drag its edges to <b>trim</b>, drag the corner squares for <b>fades</b>, and press <kbd>Ctrl</kbd>+<kbd>E</kbd> to split at the playhead. Nothing is cut away for good, and <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes it all, including levels and stems.', tip: 'Auto-balance (in the master menu) measures your lanes and proposes levels, and you can undo it.' },
    { t: tq('#pane-tab'), pane: 'tab', side: 'left', title: '10 · Tab editor', b: 'Click a cell and type a fret number. Arrow keys move, and <kbd>h</kbd> <kbd>p</kbd> <kbd>/</kbd> <kbd>\\</kbd> <kbd>b</kbd> <kbd>~</kbd> <kbd>x</kbd> set hammer, pull, slides, bend, vibrato and mute. <kbd>Space</kbd> plays from the current bar.' },
    { t: tq('#songbar'), side: 'bottom', title: '11 · Song details, everywhere', b: 'Title, artist, <b>tuning</b>, capo and scale sit in this strip for every panel. Load a backing track and they fill themselves in: a cleaned-up title, tempo, key and chords. Open <b>Notes &amp; tuning</b> for per-string tuning. Voicings, tab playback, the tuner and transcription all follow it.' },
    { t: tq('#right'), pre: () => { const t = $('#right .side-tabs .tab[data-id="refine"]'); if (t) t.click(); }, drawer: 'right', side: 'left', title: '12 · Refine: lyrics and chords', b: 'The lyric and chord canvas lives in the right panel so you can keep any tab open in the centre while you write. Use <b>⇆</b> on a sidebar to move panels between the sides, or <b>☰</b> above the tabs to see every panel.' },
    { t: tq('#pane-fret'), pane: 'fret', side: 'left', title: '13 · Fretboard', b: 'A hexagon fretboard that knows your tuning, capo and scale. Highlight scales and chord tones, and click any note to hear it. When the Vision pane is tracking your hand, the fingers you play light up here too.' },
    { t: tq('#right'), pre: () => { const t = $('#right .side-tabs .tab[data-id="monitor"]'); if (t) t.click(); }, drawer: 'right', side: 'left', title: '14 · Tuner and live analysis', b: 'Play a note: the tuner shows the note and cents, then levels and live chord / key detection. Click a string circle to hear its reference pitch.' },
    { t: tq('#pane-tx'), pane: 'tx', side: 'left', title: '15 · Transcribe', b: 'Record yourself or load an audio file and get <b>polyphonic tab</b>: chords, bass and melody mapped to strings and frets for your tuning. Review, accept, then apply to the song. <b>Measure noise</b> and <b>Calibrate to my guitar</b> improve accuracy, and <b>Run self-test</b> scores the engine on synthetic guitar.' },
    { t: tq('#pane-stems'), pane: 'stems', side: 'left', title: '16 · Stems and backing tracks', b: 'Load a song and The app separates <b>drums, bass, vocals and guitar / other</b>, finds the tempo, key and chords, and lets you mute stems to play along. Send the chords or the drum groove to the band. Separation is DSP-based and runs on your machine; expect good drums and vocals, rougher guitar.' },
    { t: tq('#pane-neural'), pane: 'neural', side: 'left', title: '17 · Neural map', b: 'The music as a living network: notes become nodes and harmony forms the layers as the song progresses. Rotate, scrub through time and click nodes to inspect them.' },
    { t: tq('#pane-stage'), pane: 'stage', side: 'left', title: '18 · Stage', b: 'Full-screen, audio-reactive visuals for performing: the Concert light show, hex resonance, a prompter, and a neural mode. Your camera is optional and stays off unless you turn it on. With Stage focused, <kbd>1</kbd>…<kbd>8</kbd> change scenes. <b>⏺ Record the stage</b> saves a wide 16:9 or vertical 9:16 video, and <b>🎤 Perform</b> shows the chord huge with the lyrics scrolling.' },
    { t: tq('#top #topR'), side: 'bottom', title: '19 · Settings, help and saving', b: '<b>⚙</b> Settings (A4 pitch, flats, input options), <b>◐</b> light / dark, <b>?</b> shortcuts. Your song autosaves in this browser. Use <b>Export</b> for Project JSON, tab text, ChordPro, MIDI or WAV (rendered faster than the song plays) so nothing is stuck in the page. Press <b>Back up all songs</b> (in <b>☰ Songs</b>) now and then: browsers can clear a site\'s storage, and on an iPhone, Add to Home Screen keeps it. In Chrome or Edge, <b>Settings ▸ Folder sync</b> keeps your whole studio, recordings too, in a folder (a cloud drive keeps it the same on every computer).' },
    { t: null, title: 'You are ready', b: 'A good first session: pick a tone, press <kbd>Space</kbd>, play along with the band, then try <b>Transcribe</b> or load a backing track in <b>Stems</b>.<br><br>Reopen this tour from <b>?</b> whenever you like.', last: true }
  ];
}
function tourEnd(done) {
  if (!TOUR.on) return; TOUR.on = false; TOUR.token++; cancelAnimationFrame(TOUR.raf);
  window.removeEventListener('resize', tourPlace, true); document.removeEventListener('keydown', tourKey, true);
  if (TOUR.el) TOUR.el.remove(); TOUR.el = TOUR.spot = TOUR.card = null; if (document.body.dataset.form && document.body.dataset.form !== 'desktop') mCloseOverlays();
  CFG.tourDone = true; CFG.tourAsked = true; saveCfg(); if (done) toast('Tour complete. Reopen it from ? any time.', 'ok');
}
function tourKey(e) {
  if (!TOUR.on) return;
  const k = e.key; if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); return tourEnd(false); }
  if (k === 'ArrowRight' || k === 'Enter' || k === ' ' || k === 'PageDown') { e.preventDefault(); e.stopPropagation(); return tourNext(); }
  if (k === 'ArrowLeft' || k === 'Backspace' || k === 'PageUp') { e.preventDefault(); e.stopPropagation(); return tourGo(TOUR.i - 1); }
  if (k === 'Tab') return;
  e.stopPropagation(); e.preventDefault();
}
const tourNext = () => TOUR.i >= TOUR.steps.length - 1 ? tourEnd(true) : tourGo(TOUR.i + 1);
function tourStart(from = 0) {
  if (TOUR.on) tourEnd(false); const d = $('#help'); if (d && d.open) d.close(); const s = $('#settings'); if (s && s.open) s.close();
  const b = $('#boot'); if (b) b.remove(); const of = $('#tourOffer'); if (of) of.remove();
  TOUR.on = true; TOUR.steps = tourSteps();
  TOUR.spot = h('div', { class: 'tour-spot' }); TOUR.card = h('div', { class: 'tour-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'the-daily.studio guided tour' });
  TOUR.el = h('div', { id: 'tour', class: 'tour' }, h('div', { class: 'tour-block', onclick: e => e.stopPropagation() }), TOUR.spot, TOUR.card); document.body.append(TOUR.el);
  window.addEventListener('resize', tourPlace, true); document.addEventListener('keydown', tourKey, true);
  tourGo(from);
}
async function tourGo(i) {
  if (!TOUR.on) return; i = clamp(i, 0, TOUR.steps.length - 1); TOUR.i = i; const tok = ++TOUR.token, st = TOUR.steps[i];
  try { if (document.body.dataset.form === 'tablet') { if (st.drawer) { if (M.drawer !== st.drawer) mDrawer(st.drawer); } else mCloseOverlays(); } if (st.pre) st.pre(); if (st.pane && !FLOATS.has(st.pane) && DOCK.cur !== st.pane) dockGo(st.pane); } catch (e) { console.warn('tour pre', e); }
  tourRender(st, i);
  await new Promise(r => setTimeout(r, 140)); if (tok !== TOUR.token || !TOUR.on) return;
  st._el = st.t ? st.t() : null; if (st._el) { try { st._el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { } }
  await new Promise(r => requestAnimationFrame(r)); if (tok !== TOUR.token || !TOUR.on) return;
  tourPlace();
}
function tourRender(st, i) {
  const n = TOUR.steps.length, c = TOUR.card; c.innerHTML = '';
  const dots = h('div', { class: 'tour-dots' }); for (let k = 0; k < n; k++) dots.append(h('i', { class: k === i ? 'on' : k < i ? 'done' : '', title: TOUR.steps[k].title, onclick: () => tourGo(k) }));
  c.append(h('div', { class: 'tour-n' }, i === 0 ? 'GUIDED TOUR' : i === n - 1 ? 'DONE' : 'STEP ' + i + ' OF ' + (n - 2)),
    h('h3', {}, st.title), h('div', { class: 'tour-b', html: st.b }), ...(st.tip ? [h('div', { class: 'tour-tip' }, '💡 ' + st.tip)] : []), dots,
    h('div', { class: 'tour-f' }, ...[h('button', { class: 'btn sm ghost', onclick: () => tourEnd(false) }, i === n - 1 ? 'Close' : 'Skip tour'), h('span', { class: 'grow' }),
      ...(i > 0 ? [h('button', { class: 'btn sm', onclick: () => tourGo(i - 1) }, '← Back')] : []), h('button', { class: 'btn sm primary', onclick: tourNext }, i === 0 ? 'Start the tour →' : i === n - 1 ? 'Finish ✓' : 'Next →')]));
  const nb = $('.btn.primary', c); if (nb) nb.focus({ preventScroll: true });
}
function tourPlace() {
  if (!TOUR.on || !TOUR.card) return; const st = TOUR.steps[TOUR.i], c = TOUR.card, sp = TOUR.spot, vw = innerWidth, vh = innerHeight, M = 12;
  const el = st._el && st._el.isConnected ? st._el : null, r = el ? el.getBoundingClientRect() : null;
  c.style.maxWidth = Math.min(380, vw - 2 * M) + 'px'; const cw = c.offsetWidth, ch = c.offsetHeight;
  if (!r || !r.width || !r.height) { sp.style.opacity = 0; c.style.left = Math.round((vw - cw) / 2) + 'px'; c.style.top = Math.round(Math.max(M, (vh - ch) / 2)) + 'px'; TOUR.el.classList.add('nospot'); return; }
  TOUR.el.classList.remove('nospot');
  const P = 6, x0 = Math.max(2, r.left - P), y0 = Math.max(2, r.top - P), x1 = Math.min(vw - 2, r.right + P), y1 = Math.min(vh - 2, r.bottom + P);
  Object.assign(sp.style, { opacity: 1, left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px' });
  const want = [st.side || 'bottom', 'right', 'left', 'bottom', 'top'], G = 14, cand = {
    right: [x1 + G, y0], left: [x0 - cw - G, y0], bottom: [x0, y1 + G], top: [x0, y0 - ch - G] };
  let pos = null;
  for (const s of want) { let [x, y] = cand[s]; x = clamp(x, M, vw - cw - M); y = clamp(y, M, vh - ch - M); const hit = !(x + cw < x0 || x > x1 || y + ch < y0 || y > y1); if (!hit) { pos = [x, y]; break; } }
  if (!pos) pos = [clamp(x1 - cw - 18, M, vw - cw - M), clamp(y1 - ch - 18, M, vh - ch - M)]; // large target: card sits inside its corner
  c.style.left = Math.round(pos[0]) + 'px'; c.style.top = Math.round(pos[1]) + 'px';
}
/* first-run offer: one small card, never again once answered */
function tourOffer() {
  if (CFG.tourAsked || CFG.tourDone || TOUR.on || $('#tourOffer') || $('#humbar') || $('#hum') || (typeof GD !== 'undefined' && (GD.id || gdc().sess))) return;
  const close = () => { const o = $('#tourOffer'); if (o) o.remove(); CFG.tourAsked = true; saveCfg(); };
  const o = h('div', { id: 'tourOffer', class: 'tour-offer' }, h('div', {}, h('b', {}, 'New here?'), h('span', { class: 'muted' }, ' A two-minute tour shows where everything is.')),
    h('div', { class: 'row', style: { gap: '6px' } }, h('button', { class: 'btn sm primary', onclick: () => { close(); tourStart(); } }, 'Take the tour'), h('button', { class: 'btn sm', onclick: close }, 'Not now')));
  document.body.append(o); setTimeout(() => { if (o.isConnected) close(); }, 30000);
}
bus.on('booted', () => setTimeout(tourOffer, 900));

/* phone walkthrough: same story, told through the bottom navigation */
function tourStepsPhone() {
  const go = (g, sid) => () => { mCloseOverlays(); if (M.g !== g || M.s !== sid) mGo(g, sid); };
  const tl = () => { mCloseOverlays(); if (document.body.dataset.tl === 'off') { M.tl[document.body.dataset.land === '1' ? 'l' : 'p'] = 'mini'; mSync(); } };
  return [
    { t: null, title: 'Welcome to the-daily.studio', b: 'A guitar and voice studio that runs entirely in this browser tab: record guitar and mic, split a song into stems, get the chords and tab, with a pedal rig and live visuals. Everything stays on your phone.<br><br>This tour takes a minute and never changes your song. Tap <b>Next</b> to move on.' },
    { t: tq('#top'), pre: go('play', 'rig'), side: 'bottom', title: '1 · Tempo, signature and key', b: 'The song\'s <b>BPM</b>, time signature, key and mode live up here and drive the band, the fretboard and the tab.' },
    { t: tq('#mtrans'), side: 'top', title: '2 · Transport', b: 'Rewind, <b>play</b>, stop, <b>record</b> (with a count-in, dry plus wet takes), <b>loop</b> and the <b>click</b>. The readout shows bar · beat · slot.', tip: 'Use headphones when recording so the speaker does not feed back into the mic.' },
    { t: tq('#mnav'), side: 'top', title: '3 · Five sections', b: '<b>Play</b> (rig, tones, tuner, I/O), <b>Write</b> (tab, song, band, fretboard, theory), <b>See</b> (visuals, stage, neural map, vision), <b>Stems</b> and <b>More</b> (research, export). The chips at the top switch between the panels of a section.' },
    { t: tq('#left'), pre: go('play', 'io'), side: 'bottom', title: '4 · Connect your guitar', b: 'Open <b>I/O</b> and choose your audio interface or the phone\'s input. Allow microphone access when asked, and press the refresh button (⟳) if the list is empty.<br><br>On iPhone and iPad an interface works through the Lightning / USB-C port; Web MIDI is not available there.' },
    { t: tq('.rigdeck'), pre: go('play', 'rig'), side: 'bottom', title: '5 · The rig', b: 'The current tone, <b>A/B morph</b>, <b>Mutate</b>, and eight <b>scenes</b>. Scroll down for the pedalboard; open a pedal\'s <b>⚙</b> to move it earlier or later in the chain.' },
    { t: tq('.bandstrip'), pre: go('play', 'rig'), side: 'bottom', title: '6 · Your band', b: 'Switch <b>drums, bass, rhythm guitar and lead tab</b> on or off while you play. Press and hold a chip for level, pan and style.' },
    { t: tq('#left'), pre: go('play', 'tones'), side: 'bottom', title: '7 · Tones', b: 'Search and filter the preset library. Tap one to load it; saved presets appear under <b>User</b>.' },
    { t: tq('#kpad'), pre: go('write', 'tab'), side: 'top', title: '8 · Write tab with the keypad', b: 'Tap a cell in the grid, then tap a fret on the keypad. <b>10s</b> and <b>20s</b> make two-digit frets, <b>Auto ▶</b> moves on after each note, and the technique keys set hammer, pull, slides, bend, vibrato and mute.' },
    { t: tq('#timeline'), pre: () => { go('write', 'tab')(); tl(); }, side: 'top', title: '9 · Arrangement', b: 'The song as lanes. Tap the ruler to seek, press and drag for a loop, and use <b>Tracks</b> in the chip row to make the arrangement mini, tall or hidden. Tap a recording to select it as a clip, then use the bar above the lanes to <b>split, duplicate or delete</b> it, and the arrows to nudge it a beat.' },
    { t: tq('#songbar'), pre: () => { go('write', 'song')(); document.body.classList.add('song-open'); }, side: 'top', title: '10 · Song details', b: 'The <b>♪ Song</b> chip opens this sheet: title, artist, tuning, capo and scale. Load a backing track and it fills in for you. Voicings, the tuner, chord detection and transcription all follow the tuning.' },
    { t: tq('#pane-neural'), pre: go('see', 'neural'), side: 'bottom', title: '11 · Neural map', b: 'The music as a living network. Drag to orbit, <b>pinch</b> to zoom, two fingers to pan, tap a node to inspect it.' },
    { t: tq('#pane-stage'), pre: go('see', 'stage'), side: 'bottom', title: '12 · Stage', b: 'Audio-reactive visuals for performing. <b>⛶ Full</b> fills the screen, ideal in landscape; keep the phone on a stand and play.' },
    { t: tq('#pane-stems'), pre: go('stems', 'stems'), side: 'bottom', title: '13 · Stems and backing tracks', b: 'Load a song and The app separates drums, bass, vocals and guitar / other, finds tempo, key and chords, and lets you mute stems to play along. Long files take a while on a phone; short clips are quickest.' },
    { t: tq('#pane-tx'), pre: go('stems', 'tx'), side: 'bottom', title: '14 · Transcribe', b: 'Record yourself or load audio and get polyphonic tab for your tuning. Review it, then apply it to the song.' },
    { t: tq('.mmore'), pre: go('play', 'rig'), side: 'bottom', title: '15 · More', b: 'Theme, <b>Monitor</b>, screen-awake, settings, help, saving the project, sharing the link, installing the-daily.studio as an app (the best way to keep your songs safe on iPhone), <b>Open a file</b> (audio, lyrics, MIDI or a song file), and the <b>Device layout</b> switch (Auto, Phone, Tablet, Desktop).' },
    { t: null, title: 'You are ready', b: 'A good first session: pick a tone, tap <b>▶</b>, play along with the band, then try <b>Write ▸ Tab</b> or load a backing track in <b>Stems</b>.<br><br>Reopen this tour from <b>⋯ More ▸ Guided tour</b>.', last: true }
  ];
}
bus.on('form', () => { if (TOUR.on) tourEnd(false); });
