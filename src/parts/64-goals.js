/* ============================================================
   Part 64 · Goal workspaces: the studio arranged around what a musician wants to do, not around its features.
   Each goal is a complete workspace (a layout): which panels are on the strip and which is open, what the sidebars hold, how tall the
   arrangement is, which Monitor widgets show, and a row of the few tools that goal is about, one click each.
     🎸 Songwriter      lyrics, chords, progression building, idea capture
     🎤 Performer       recording, webcam, stage visuals, performance playback
     🎬 Creator Studio  Studio Replay, webcam, waveform views, overlays, thumbnails, export to MP4 for social sharing
     🎼 Practice        looping, tempo, metronome, scales, chord display
     🎓 Teacher         annotations, lesson notes, screen recording, educational overlays (fretboard, transcription)
     ⚙️ Full Rig        every panel and widget, for people who know their way around
   The goals run Create → Perform → Share: each workspace ends with the one button that takes you to the next step, so a
   musician gets from an idea to a shareable video in the fewest clicks. Nothing is removed: every panel is still one click away
   (☰ on the strip, ▦ in the header), and the goal only decides what shows first. The tools behind the buttons are in part 68.
   ============================================================ */
const GOAL_STEPS = [['create', 'Create', 'songwriter'], ['perform', 'Perform', 'performer'], ['share', 'Share', 'creator']];
const GOALS = [
  { id: 'songwriter', ico: '🎸', name: 'Songwriter', layout: 'Songwriter', step: 'create', next: ['performer', 'Perform it'],
    blurb: 'Lyrics, chords and progressions, and a quick way to catch an idea before it goes.',
    spec: { flip: true, left: true, right: true, tlh: 'minmax(120px,22%)', dock: 'tab', order: ['tab', 'band', 'song', 'rig', 'exp'], hidden: ['fret', 'vis', 'stage', 'neural', 'stems', 'tx', 'cam', 'lab'], cur: { left: 'theory', right: 'monitor' }, mon: ['tuner', 'live'] },
    tools: () => [
      ['gtCap', '● Capture idea', 'Play, and the notes and chords you play are written into the tab', () => { dockGo('tab'); capToggle(); }, () => !!CAP.on],
      ['gtWords', '✎ Lyrics & tab', 'The words and the tab side by side', () => { dockGo('tab'); wrMode('both'); }],
      ['gtTheory', '♯ Chords & scales', 'Build a progression from the key: chords, scales and what comes next', () => sideShow('theory')],
      ['gtRec', '⏺ Record idea', 'Arm a take: it records when you press play (R)', () => toggleRec(), () => !!T.rec]
    ] },
  { id: 'performer', ico: '🎤', name: 'Performer', layout: 'Performer', step: 'perform', next: ['creator', 'Share it'],
    blurb: 'Your tone, the band and the stage visuals, with the camera and the record button in reach.',
    spec: { flip: true, left: true, right: true, tlh: 'minmax(150px,30%)', dock: 'vis', order: ['vis', 'rig', 'band', 'stage', 'exp'], hidden: ['tab', 'song', 'fret', 'neural', 'stems', 'tx', 'cam', 'lab'], cur: { left: 'tones', right: 'monitor' }, mon: ['tuner', 'levels', 'audience'] },
    tools: () => [
      ['gtVideo', '⏺ Record video', 'Record the stage, you and the sound as a video; Studio Replay opens when you stop', b => kitRecord(b), () => !!SREC.on],
      ['gtCam', '📷 Camera', 'Put yourself centre stage, in front of the visuals', () => vzCamPress(), () => !!VZ.cam],
      ['gtPerf', '🎤 Perform view', 'Full screen: the chord huge, the lyrics scrolling, a count-in', b => perfOpen(b)],
      ['gtTake', '● Record take', 'Record your guitar and voice into the arrangement (R)', () => toggleRec(), () => !!T.rec],
      ['gtReplay', '▶ Replay', 'Watch the last video you recorded', () => kitReplay(), null, () => !KIT.last]
    ] },
  { id: 'creator', ico: '🎬', name: 'Creator Studio', layout: 'Creator Studio', step: 'share', next: ['songwriter', 'Write the next one'],
    blurb: 'Record, replay, add overlays and a thumbnail, and save an MP4 to post.',
    spec: { flip: true, left: false, right: true, tlh: '96px', dock: 'vis', order: ['vis', 'exp', 'stage', 'band', 'rig'], hidden: ['tab', 'song', 'fret', 'neural', 'stems', 'tx', 'cam', 'lab'], cur: { right: 'monitor' }, mon: ['levels', 'views', 'audience'] },
    tools: () => [
      ['gtVideo', '⏺ Record MP4', 'Record the stage, the camera and the sound; MP4 where this browser can make it', b => kitRecord(b), () => !!SREC.on],
      ['gtReplay', '▶ Studio Replay', 'Watch the last recording, then save it, share it or make a thumbnail from any frame', () => kitReplay(), null, () => !KIT.last],
      ['gtCam', '📷 Webcam', 'You in the picture, in front of or framed by the visuals', () => vzCamPress(), () => !!VZ.cam],
      ['gtFx', '✨ Overlays', 'How the camera sits with the visuals: dimmed behind, framed, or you in front', b => popover(b, h('div', { style: { display: 'grid', gap: '8px', minWidth: '240px' } }, h('h5', {}, 'Overlays'), camFxBox(), h('div', { class: 'tiny muted' }, 'Pick a look in the Visuals panel for what moves behind you.')))],
      ['gtThumb', '🖼 Thumbnail', 'Save a 1280 × 720 picture of the stage with the song title, for the post', () => kitThumb()],
      ['gtExp', '⇩ Export', 'Audio, the share page, the lyric sheet and more', () => dockGo('exp')]
    ] },
  { id: 'practice', ico: '🎼', name: 'Practice', layout: 'Practice', step: 'create', next: ['performer', 'Perform it'],
    blurb: 'Loop a part, slow it down, keep time with the click, and see the scale and the chord on the neck.',
    spec: { flip: true, left: true, right: true, tlh: 'minmax(170px,32%)', dock: 'tab', order: ['tab', 'stems', 'band', 'rig'], hidden: ['song', 'vis', 'stage', 'neural', 'tx', 'cam', 'lab', 'exp'], side: { fret: 'right' }, so: { left: [], right: ['fret', 'monitor', 'refine'] }, cur: { left: 'theory', right: 'fret' }, mon: ['tuner', 'levels'] },
    tools: () => [
      ['gtLoop', '⟲ Loop', 'Loop the song or the selected bars (L)', () => { T.loop = !T.loop; syncTransport(); }, () => !!T.loop],
      ['gtClick', '♩ Metronome', 'The click (M)', () => { T.metro = !T.metro; syncTransport(); }, () => !!T.metro],
      ['gtSlow', '− 5', 'Slower by 5 BPM', () => goalTempo(-5)],
      ['gtBpm', () => S.bpm + ' BPM', 'The tempo', () => { if (UI.bpm) UI.bpm.focus(); }],
      ['gtFast', '+ 5', 'Faster by 5 BPM', () => goalTempo(5)],
      ['gtScale', '♯ Scales', 'The scale for the key, on the theory panel', () => sideShow('theory')],
      ['gtChord', '▦ Chords', 'The chord that is playing, on the fretboard', () => sideShow('fret')]
    ] },
  { id: 'teacher', ico: '🎓', name: 'Teacher', layout: 'Teacher', step: 'share', next: null,
    blurb: 'Draw on the screen, keep lesson notes, and record the screen with your voice.',
    spec: { flip: true, left: false, right: true, tlh: 'minmax(130px,26%)', dock: 'tab', order: ['tab', 'tx', 'stems', 'vis', 'band'], hidden: ['rig', 'song', 'fret', 'stage', 'neural', 'cam', 'lab'], side: { fret: 'right' }, so: { left: [], right: ['fret', 'refine', 'monitor'] }, cur: { right: 'fret' }, mon: ['tuner', 'live'] },
    tools: () => [
      ['gtInk', '✎ Annotate', 'Draw over anything on the page; it stays until you clear it', () => kitInk(), () => !!KIT.inkOn],
      ['gtNotes', '📝 Lesson notes', 'Notes for this song, kept in this browser', () => kitNotes(), () => !!KIT.notesEl],
      ['gtScreen', '⏺ Record screen', 'Record this tab or your screen, with the studio’s sound and your voice', () => kitScreen(), () => !!KIT.scr],
      ['gtFret', '▦ Fretboard', 'Show the chord and scale on the neck', () => sideShow('fret')],
      ['gtTx', '♪ Transcribe', 'Turn a recording into notes and chords to teach from', () => dockGo('tx')]
    ] },
  { id: 'fullrig', ico: '⚙️', name: 'Full Rig', layout: 'Full Rig', step: null, next: null, all: true,
    blurb: 'Every panel, both sidebars and every Monitor widget.',
    spec: { flip: true, left: true, right: true, tlh: 'minmax(200px,38%)', dock: 'rig', order: [], hidden: [], cur: { left: 'io', right: 'monitor' }, mon: ['tuner', 'levels', 'live', 'spectrum', 'views', 'audience'] },
    tools: () => [
      ['gtLay', '▦ Workspace…', 'Sidebars, floating panels, which tabs show', b => layoutMenu(b)],
      ['gtPlace', '⇆ Where panels live…', 'Move any panel to either sidebar or the centre', b => placeMenu(b)]
    ] }
];
/* the goals that came before (2.9's journeys, and the guided sessions that still name them) */
const GOAL_ALIAS = { play: 'performer', create: 'songwriter', learn: 'practice', write: 'songwriter', perform: 'performer', share: 'creator' };
/* they are layouts too: after Studio in the layout list (the Practice goal replaces the old Practice layout) */
LAYOUTS.splice(1, 0, ...GOALS.map(g => [g.layout, g.blurb, g.spec]));
const goalById = id => GOALS.find(g => g.id === (GOAL_ALIAS[id] || id)) || null;
/** the goal whose workspace is showing (null when it is some other layout) */
const goalNow = () => GOALS.find(g => g.layout === LAY.name) || null;
/** tabs the goal in use needs, even when the experience level has not unlocked them (Full Rig needs them all) */
const goalShows = id => { const g = goalNow(); return !!g && (g.all || g.spec.order.includes(id)); };
function goalTempo(d) { S.bpm = clamp(S.bpm + d, 30, 260); commit(false); bus.emit('bpm'); syncTransport(); goalSync(); }
function goalGo(id) {
  const g = goalById(id); if (!g) return false; CFG.ws = g.id; saveCfg();
  applyPreset(g.spec, g.layout); if (typeof xpSignal === 'function') xpSignal(1);
  if (g.spec.side && g.spec.side.fret && typeof sideShow === 'function') { try { sideShow('fret'); } catch (e) { } }
  bus.emit('goal', g.id); goalBarBuild(); return true;
}
/* ---------- the goal bar: the six goals, Create → Perform → Share, the goal's tools and its next step ---------- */
function goalBar() { const box = h('div', { class: 'goalbar', id: 'goalbar' }); GOALBAR.el = box; goalBarBuild(); return box; }
const GOALBAR = { el: null };
function goalBarBuild() {
  const box = GOALBAR.el; if (!box) return; box.innerHTML = ''; const cur = goalNow();
  const pick = h('div', { class: 'gl-pick', role: 'group', 'aria-label': 'What do you want to do?' }, GOALS.map(g => h('button', { class: 'gl-b' + (cur === g ? ' on' : ''), 'data-goal': g.id, 'aria-pressed': String(cur === g), title: g.name + ': ' + g.blurb, onclick: () => goalGo(g.id) }, h('span', { class: 'gl-i', 'aria-hidden': 'true' }, g.ico), h('span', { class: 'gl-t' }, g.name))));
  const flow = h('ol', { class: 'gl-flow', 'aria-label': 'Create, perform, share' }, GOAL_STEPS.map(([k, n, gid]) => h('li', {}, h('button', { class: 'gl-st' + (cur && cur.step === k ? ' on' : ''), 'data-step': k, 'aria-current': cur && cur.step === k ? 'step' : null, title: n + ': open ' + goalById(gid).name, onclick: () => goalGo(gid) }, n))));
  box.append(h('div', { class: 'gl-row' }, pick, flow));
  if (!cur) { box.append(h('div', { class: 'gl-row gl-tools' }, h('span', { class: 'tiny muted' }, 'Pick what you want to do, and the studio arranges itself for it. Everything stays one click away.'))); return; }
  const tools = h('div', { class: 'gl-row gl-tools', role: 'toolbar', 'aria-label': cur.name + ' tools' });
  cur.tools().forEach(([id, label, title, fn, on, off]) => {
    const b = h('button', { class: 'btn sm gl-tool', id, type: 'button', title, onclick: e => { fn(e.currentTarget); setTimeout(goalSync, 60); } }, typeof label === 'function' ? label() : label);
    b._on = on; b._off = off; b._label = label; tools.append(b);
  });
  if (cur.next) { const n = goalById(cur.next[0]); tools.append(h('span', { class: 'grow' }), h('button', { class: 'btn sm primary gl-next', id: 'gtNext', title: 'Next: ' + n.name, onclick: () => goalGo(n.id) }, cur.next[1] + ' → ' + n.ico)); }
  box.append(tools); goalSync();
}
/** refresh the on/off state of the goal's tools (recording, camera, loop, click…) */
function goalSync() {
  if (!GOALBAR.el) return;
  $$('.gl-tool', GOALBAR.el).forEach(b => {
    if (b._on) { const on = !!b._on(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
    if (b._off) b.disabled = !!b._off();
    if (typeof b._label === 'function') b.textContent = b._label();
  });
}
['transport', 'srec', 'kit', 'bpm', 'song', 'cam'].forEach(e => bus.on(e, goalSync));
setInterval(() => { if (GOALBAR.el && !document.hidden) goalSync(); }, 1000);
/* a first visit on a computer opens the Performer: the shortest way to a performance you can share.
   Anyone who has been here before keeps the workspace they had, and a layout you chose is never replaced. */
const GOAL_FIRST = !store.get('started', false);
bus.on('booted', () => {
  if (CFG.ws !== undefined || !isDesk()) return;
  if (!GOAL_FIRST || LAY.name) { CFG.ws = (goalNow() || {}).id || null; saveCfg(); return; }
  goalGo(CFG.xpMode === 'pro' ? 'fullrig' : 'performer');
});
