/* =====================================================================
   Part 17 · guided tour: a spotlight walkthrough of the key areas.
   Opens from Help (?), offers itself once on first run, keyboard driven,
   and never touches your song or settings.
   ===================================================================== */
const TOUR = { on: false, i: 0, el: null, spot: null, card: null, steps: [], raf: 0, token: 0 };
const tq = sel => () => { const e = $(sel); return e && e.getClientRects().length ? e : null; };
const tourSide = id => () => { const t = $('#left .side-tabs .tab[data-id="' + id + '"]'); if (t) t.click(); };
/* 2.47: the tour tells the studio as it is now: workspaces and ✦ Simple first, then connecting, the beats and the band, writing,
   recording and tuning, and sending the song. Steps marked full are about the full studio and are left out while ✦ Simple is on. */
function tourSteps() { const all = document.body.dataset.form === 'phone' ? tourStepsPhone() : tourStepsDesk(); return CFG.simple ? all.filter(s => !s.full) : all; }
function tourStepsDesk() {
  return [
    { t: null, title: 'Welcome to the-daily.studio', b: 'A studio for writing, singing and playing that runs entirely in this browser tab. <b>Write</b> the words and chords, put a <b>beat</b> under them, <b>record</b> your voice and guitar, tune the vocal, and <b>send</b> the song to someone. Nothing is uploaded: your songs stay on this device.<br><br>This tour takes about two minutes and never changes your song. Use <kbd>→</kbd> and <kbd>←</kbd>, or <kbd>Esc</kbd> to leave.' },
    { t: tq('#goalbar .gl-pick'), side: 'bottom', title: 'Pick what you want to do', b: 'Six workspaces: <b>Songwriter</b>, <b>Performer</b>, <b>Creator Studio</b>, <b>Practice</b>, <b>Teacher</b> and <b>Full Rig</b>. Each arranges the studio for that job and brings its own tools. Nothing is ever removed: every panel is still under <b>☰</b>.' },
    { t: tq('#simpleBtn'), side: 'bottom', title: '✦ Simple', b: '<b>✦ Simple</b> keeps each workspace to the few panels and tools it needs, for anyone new to a studio. Press it again for everything. <b>Full Rig</b> is the one workspace with it all, so choosing it turns Simple off.' },
    { t: tq('#left'), pre: tourSide('io'), drawer: 'left', side: 'right', title: 'Connect your input', b: '<b>Audio input</b> opens first until something is connected: choose your microphone or audio interface and check the level moves when you sing or play. If the list is empty, allow microphone access in the browser and press ⟳.', tip: 'Wired headphones give the lowest delay and stop the speakers feeding back into the mic. Bluetooth adds a lot of delay.' },
    { t: tq('#transport'), side: 'bottom', title: 'Play, record and the tempo', b: '<kbd>Space</kbd> plays and stops. <b>●</b> records with a count-in. <b>Loop</b>, <b>Click</b>, the tempo and the key are here too. <kbd>Ctrl</kbd> + <kbd>.</kbd> turns all audio input off at once.' },
    { t: tq('#goalbar .gl-tools'), side: 'bottom', title: 'The workspace\'s tools', b: 'Each workspace has a row of tools. In Songwriter: <b>🥁 Beats</b>, <b>Paste chords</b>, Pads, Keys and <b>🔗 Send as a link</b>. In Performer: record a video and the vocal pedals. The main one is highlighted, and the button at the end takes you to the next step.' },
    { t: tq('#dock > .dockbar, #dock .tabs'), side: 'bottom', title: 'Panels are tabs', b: 'Each workspace shows the tabs it needs. <b>Drag</b> a tab to reorder it, <b>double-click</b> it to float it as a window, and use <b>▦</b> in the top bar to rearrange. <kbd>Alt</kbd>+<kbd>1…9</kbd> jumps by position.' },
    { t: tq('#pane-band'), pane: 'band', side: 'left', title: 'Beats and the band', b: 'Tap a <b>beat</b> and a band plays it in your key: drums, bass, and guitar or keys. Choose <b>who plays</b> and how loud. With <b>Song build</b> on, each section plays at its own energy: quiet verses, big choruses, and fills and risers between them.' },
    { t: tq('#pane-tab'), pane: 'tab', side: 'left', title: 'Write: words, chords and tab', b: 'Type the words with chords over them, or paste a chord sheet. For tab, click a cell and type a fret number; <kbd>h</kbd> <kbd>p</kbd> <kbd>/</kbd> <kbd>\\</kbd> <kbd>b</kbd> <kbd>~</kbd> <kbd>x</kbd> set hammer-ons, pull-offs, slides, bends, vibrato and mutes.' },
    { t: tq('#timeline'), side: 'top', title: 'Record, edit and tune', b: 'The song as lanes: chords, the band, and your <b>Guitar</b> and <b>Vocal</b> takes. Arm ● a lane and press <kbd>R</kbd>. Click a take to move, trim or split it. A vocal take\'s menu has <b>🎯 Tune</b>: Natural, Tight or Hard, in the song\'s key, and Off gives back the original.' },
    { t: tq('.rigdeck'), pane: 'rig', side: 'bottom', full: 1, title: 'The Rig and pedalboard', b: 'The current tone, <b>A/B morph</b>, <b>Mutate</b>, and eight <b>scenes</b> (<kbd>1</kbd>…<kbd>8</kbd>). Below it, the pedalboard in signal order: drag pedals to reorder, and use each pedal\'s <b>⚙</b> to bind a footswitch key or MIDI note.' },
    { t: tq('#left'), pre: tourSide('tones'), drawer: 'left', side: 'right', full: 1, title: 'Tones', b: 'Search and filter the preset library: clean, crunch, lead, acoustic, ambient and more. Click one to load it. Your saved presets appear under <b>User</b>.' },
    { t: tq('#songbar'), side: 'bottom', title: 'Song details', b: 'The title, and in the full studio the artist, <b>tuning</b>, capo and scale, for every panel. Load a backing track and they fill themselves in. Voicings, tab playback, the tuner and transcription all follow the tuning.' },
    { t: tq('#pane-fret'), pane: 'fret', side: 'left', full: 1, title: 'Fretboard', b: 'A fretboard that knows your tuning, capo and scale. Highlight scales and chord tones, and click any note to hear it.' },
    { t: tq('#right'), pre: () => { const t = $('#right .side-tabs .tab[data-id="monitor"]'); if (t) t.click(); }, drawer: 'right', side: 'left', full: 1, title: 'Tuner and live analysis', b: 'Play a note: the tuner shows the note and cents, then levels and live chord and key detection.' },
    { t: tq('#pane-stems'), pane: 'stems', side: 'left', full: 1, title: 'Stems and backing tracks', b: 'Load a song and the studio separates <b>drums, bass, vocals and the rest</b>, finds the tempo, key and chords, and lets you mute a part to play or sing it yourself. It all runs on this device. Use music you made or have the right to use.' },
    { t: tq('#pane-tx'), pane: 'tx', side: 'left', full: 1, title: 'Transcribe', b: 'Record yourself or load audio and get <b>tab</b>: chords, bass and melody mapped to strings and frets for your tuning. Review it, then apply it to the song.' },
    { t: tq('#pane-stage'), pane: 'stage', side: 'left', full: 1, title: 'Visuals and Stage', b: 'Audio-reactive visuals for performing: the Concert light show, hex resonance, a prompter for the words, and your camera if you turn it on. <b>⏺ Record the stage</b> saves a wide or vertical video.' },
    { t: tq('#pane-exp'), pane: 'exp', side: 'left', title: 'Save, send and share', b: '<b>🔗 Send as a link</b> puts the chords, words, tab and beat inside a link, with nothing uploaded. Export a WAV, MIDI, a chord chart or a one-file share page with the recording inside. <b>Back up all songs</b> (in ☰ Songs) makes one zip of everything.' },
    { t: tq('#top #topR'), side: 'bottom', title: 'Settings and help', b: '<b>⚙</b> Settings, <b>◐</b> light or dark, <b>?</b> shortcuts and help, where this tour lives. Your song saves itself in this browser as you work.' },
    { t: null, title: 'You are ready', b: 'A good first song: tap a <b>🥁 beat</b>, write a verse and a chorus over it, press <b>●</b> and sing, then <b>🎯 Tune</b> the take and <b>🔗 send</b> it to someone.<br><br>Reopen this tour from <b>?</b> whenever you like.', last: true }
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

/* phone walkthrough (2.47): the phone is for singers and songwriters (2.41), so the tour follows its bottom bar: Words, Sing, Beats,
   Tracks and More. The guitar and the visuals open from More. */
function tourStepsPhone() {
  const go = (g, sid) => () => { mCloseOverlays(); if (M.g !== g || (sid && M.s !== sid)) mGo(g, sid); };
  return [
    { t: null, title: 'Welcome to the-daily.studio', b: 'A songwriting and singing studio in your phone\'s browser: write the words and chords, sing over a beat, tune your voice and send the song to someone. Everything stays on your phone.<br><br>This tour takes a minute and never changes your song. Tap <b>Next</b> to move on.' },
    { t: tq('#mnav'), pre: go('words'), side: 'top', title: 'Five sections', b: '<b>Words</b>, <b>Sing</b>, <b>Beats</b>, <b>Tracks</b> and <b>More</b>. The chips at the top switch between the screens of a section. Your guitar, the tuner, the visuals and the full studio are under More.' },
    { t: tq('#mscreen'), pre: go('words'), side: 'top', title: 'Words', b: 'Write the song section by section, with the chords over the words. <b>Chords &amp; key</b> suggests chords that fit, and <b>⧉ Paste</b> takes a whole lyric sheet, its [Verse] and [Chorus] headings becoming sections.' },
    { t: tq('#mscreen'), pre: go('beats', 'beats'), side: 'top', title: 'Beats', b: 'Tap a <b>beat</b> and a band plays it in your key. With <b>Song build</b> on, quiet verses and big choruses: tap the dots to set each section\'s energy. The <b>Band</b> chip chooses who plays.' },
    { t: tq('#mscreen'), pre: go('sing'), side: 'top', title: 'Sing', b: 'Press <b>●</b> and sing: the count-in gives you a bar to get ready. Each take is listed here, with <b>🎯 Tune</b> to put it in key (Natural, Tight or Hard; Off gives back the original).', tip: 'Use headphones so the beat does not end up in your vocal.' },
    { t: tq('#mtrans'), pre: go('sing'), side: 'top', title: 'Play and record', b: '<b>▶</b> plays the song with the band, <b>●</b> records, and <b>Loop</b> and the <b>click</b> are next to them.' },
    { t: tq('#pane-stems'), pre: go('tracks', 'stems'), side: 'bottom', title: 'Tracks', b: 'Load a backing track and the studio splits it into drums, bass, vocals and the rest, and finds the tempo, key and chords. Mute the vocal to sing it yourself. <b>Transcribe</b> turns a recording into tab.' },
    { t: tq('#mnav .mnb[data-g="more"]'), pre: go('words'), side: 'top', title: 'More', b: '<b>🔗 Send as a link</b>, Save &amp; export, <b>🎸 Guitar</b> (rig, tones, tuner, tab), the <b>visuals and Stage</b>, settings, help and <b>Add to Home Screen</b>, the best way to keep your songs safe on an iPhone.' },
    { t: tq('.rigdeck'), pre: go('guitar', 'rig'), side: 'bottom', title: 'Playing guitar?', b: 'Plug in through an interface, then the <b>rig</b>: the current tone, <b>A/B morph</b>, <b>Mutate</b> and eight <b>scenes</b>. Scroll down for the pedalboard. The tuner and tab are in the same section.' },
    { t: tq('#pane-stage'), pre: go('see', 'stage'), side: 'bottom', title: 'Stage', b: 'Audio-reactive visuals and a prompter for the words. <b>⛶ Full</b> fills the screen; turn the phone sideways on a stand and sing.' },
    { t: null, title: 'You are ready', b: 'A good first song: tap a <b>beat</b>, write a verse over it in <b>Words</b>, then <b>Sing</b> it and <b>🎯 Tune</b> the take.<br><br>Reopen this tour from <b>⋯ More ▸ Guided tour</b>.', last: true }
  ];
}
bus.on('form', () => { if (TOUR.on) tourEnd(false); });
