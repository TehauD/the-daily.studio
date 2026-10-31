/* ============================================================
   Part 64 · Goal workspaces: the studio arranged around what a musician wants to do, not around its features.
   Each goal is a complete workspace with its own shape, so the six do not look alike:
     🎸 Songwriter      a notebook: the words and the tab together in the middle, theory beside it, no meters, the arrangement a strip
     🎤 Performer       a stage: the visuals large, your tones on the left, tuner and levels on the right, lanes for your takes below
     🎬 Creator Studio  an edit bay: the stage as the picture, the audience view and waveform views beside it, record → replay → post
     🎼 Practice        a practice room: the fretboard large in the middle, scales on the left, the loop and the click in reach
     🎓 Teacher         a whiteboard: the arrangement on top, the tab below to point at, the fretboard beside, notes open
     ⚙️ Full Rig        everything: every panel, both sidebars, every Monitor widget
   Each has a colour, a one-line mission with three steps, a row of its tools (the main one highlighted), and the button to
   the next step of Create → Perform → Share. Nothing is removed: every panel is still under ☰ and ▦. The tools are in part 68.
   ============================================================ */
const GOAL_STEPS = [['create', 'Create', 'songwriter'], ['perform', 'Perform', 'performer'], ['share', 'Share', 'creator']];
const GOALS = [
  { id: 'songwriter', ico: '🎸', name: 'Songwriter', layout: 'Songwriter', step: 'create', hue: '#d08a2e', next: ['performer', 'Perform it'],
    blurb: 'Lyrics, chords and progressions, and a quick way to catch an idea before it goes.',
    mission: 'Write the song', steps: ['Pick a key and a progression', 'Capture the riff', 'Put the words under the chords'],
    shape: 'Words and tab in the middle · Theory on the left · the arrangement a strip',
    spec: { flip: true, left: true, right: false, tlh: '84px', dock: 'tab', order: ['tab', 'band', 'song', 'exp'], hidden: ['rig', 'fret', 'vis', 'stage', 'neural', 'stems', 'tx', 'cam', 'lab'], cur: { left: 'theory' }, mon: ['tuner', 'live'] },
    enter: () => { try { wrMode('both'); } catch (e) { } },
    tools: () => [
      ['gtCap', '● Capture idea', 'Play, and the notes and chords you play are written into the tab', () => { dockGo('tab'); capToggle(); }, () => !!CAP.on, 1],
      ['gtSheet', '🎸 Paste chords', 'Paste a chord sheet (chords over the words): it becomes the song, with bars, key, words and a guitar part', () => liOpen('')],
      ['gtWords', '✎ Lyrics & tab', 'The words and the tab side by side', () => { dockGo('tab'); wrMode('both'); }],
      ['gtTheory', '♯ Chords & scales', 'Build a progression from the key: chords, scales and what comes next', () => sideShow('theory')],
      ['gtRec', '⏺ Record idea', 'Arm a take: it records when you press play (R)', () => toggleRec(), () => !!T.rec]
    ] },
  { id: 'performer', ico: '🎤', name: 'Performer', layout: 'Performer', step: 'perform', hue: '#d6355a', next: ['creator', 'Share it'],
    blurb: 'Your tone, the band and the stage visuals, with the camera and the record button in reach.',
    mission: 'Play it for real', steps: ['Pick a tone', 'Turn the camera on', 'Record the take'],
    shape: 'The stage large · Tones on the left · Tuner and levels on the right · lanes for your takes',
    spec: { flip: true, left: true, right: true, tlh: 'minmax(150px,30%)', dock: 'vis', order: ['vis', 'rig', 'band', 'stage', 'exp'], hidden: ['tab', 'song', 'fret', 'neural', 'stems', 'tx', 'cam', 'lab'], cur: { left: 'tones', right: 'monitor' }, mon: ['tuner', 'levels'] },
    tools: () => [
      ['gtVideo', '⏺ Record video', 'Record the stage, you and the sound as a video; Studio Replay opens when you stop', b => kitRecord(b), () => !!SREC.on, 1],
      ['gtCam', '📷 Camera', 'Put yourself centre stage, in front of the visuals', () => vzCamPress(), () => !!VZ.cam],
      ['gtPerf', '🎤 Perform view', 'Full screen: the chord huge, the lyrics scrolling, a count-in', b => perfOpen(b)],
      ['gtTake', '● Record take', 'Record your guitar and voice into the arrangement (R)', () => toggleRec(), () => !!T.rec],
      ['gtReplay', '▶ Replay', 'Watch the last video you recorded', () => kitReplay(), null, 0, () => !KIT.last]
    ] },
  { id: 'creator', ico: '🎬', name: 'Creator Studio', layout: 'Creator Studio', step: 'share', hue: '#6a45e0', next: ['songwriter', 'Write the next one'],
    blurb: 'Record, replay, add overlays and a thumbnail, and save an MP4 to post.',
    mission: 'Make it postable', steps: ['Record an MP4', 'Watch it in Studio Replay', 'Save it with a thumbnail'],
    shape: 'The stage as the picture · the audience view and waveforms beside it · no left sidebar',
    spec: { flip: true, left: false, right: true, tlh: '96px', dock: 'vis', order: ['vis', 'exp', 'stage', 'band'], hidden: ['rig', 'tab', 'song', 'fret', 'neural', 'stems', 'tx', 'cam', 'lab'], cur: { right: 'monitor' }, mon: ['audience', 'views', 'levels'] },
    tools: () => [
      ['gtVideo', '⏺ Record MP4', 'Record the stage, the camera and the sound; MP4 where this browser can make it', b => kitRecord(b), () => !!SREC.on, 1],
      ['gtReplay', '▶ Studio Replay', 'Watch the last recording, then save it, share it or make a thumbnail from any frame', () => kitReplay(), null, 0, () => !KIT.last],
      ['gtCam', '📷 Webcam', 'You in the picture, in front of or framed by the visuals', () => vzCamPress(), () => !!VZ.cam],
      ['gtFx', '✨ Overlays', 'How the camera sits with the visuals: dimmed behind, framed, or you in front', b => popover(b, h('div', { style: { display: 'grid', gap: '8px', minWidth: '240px' } }, h('h5', {}, 'Overlays'), camFxBox(), h('div', { class: 'tiny muted' }, 'Pick a look in the Visuals panel for what moves behind you.')))],
      ['gtThumb', '🖼 Thumbnail', 'Save a 1280 × 720 picture of the stage with the song title, for the post', () => kitThumb()],
      ['gtExp', '⇩ Export', 'Audio, the share page, the lyric sheet and more', () => dockGo('exp')]
    ] },
  { id: 'practice', ico: '🎼', name: 'Practice', layout: 'Practice', step: 'create', hue: '#1c9a63', next: ['performer', 'Perform it'],
    blurb: 'Loop a part, slow it down, keep time with the click, and see the scale and the chord on the neck.',
    mission: 'Get it under your fingers', steps: ['Loop the hard bars', 'Slow it down, add the click', 'Speed it up 5 at a time'],
    shape: 'The fretboard large in the middle · Theory (scales) on the left · Tuner and levels on the right',
    spec: { flip: true, left: true, right: true, tlh: 'minmax(170px,32%)', dock: 'fret', order: ['fret', 'tab', 'stems', 'band', 'rig'], hidden: ['song', 'vis', 'stage', 'neural', 'tx', 'cam', 'lab', 'exp'], cur: { left: 'theory', right: 'monitor' }, mon: ['tuner', 'levels'] },
    tools: () => [
      ['gtLoop', '⟲ Loop', 'Loop the song or the selected bars (L)', () => { T.loop = !T.loop; syncTransport(); }, () => !!T.loop, 1],
      ['gtClick', '♩ Metronome', 'The click (M)', () => { T.metro = !T.metro; syncTransport(); }, () => !!T.metro],
      ['gtSlow', '− 5', 'Slower by 5 BPM', () => goalTempo(-5)],
      ['gtBpm', () => S.bpm + ' BPM', 'The tempo', () => { if (UI.bpm) UI.bpm.focus(); }],
      ['gtFast', '+ 5', 'Faster by 5 BPM', () => goalTempo(5)],
      ['gtScale', '♯ Scales', 'The scale for the key, on the theory panel', () => sideShow('theory')],
      ['gtChord', '▦ Chords', 'The chord that is playing, on the fretboard', () => dockGo('fret')]
    ] },
  { id: 'teacher', ico: '🎓', name: 'Teacher', layout: 'Teacher', step: 'share', hue: '#0b84d8', next: null,
    blurb: 'Draw on the screen, keep lesson notes, and record the screen with your voice.',
    mission: 'Show someone how', steps: ['Open the lesson notes', 'Draw on what you explain', 'Record the screen'],
    shape: 'The arrangement on top · the tab below to point at · the fretboard on the right · notes open',
    spec: { flip: false, left: false, right: true, tlh: 'minmax(200px,40%)', dock: 'tab', order: ['tab', 'tx', 'stems', 'vis', 'band'], hidden: ['rig', 'song', 'fret', 'stage', 'neural', 'cam', 'lab'], side: { fret: 'right' }, so: { left: [], right: ['fret', 'refine', 'monitor'] }, cur: { right: 'fret' }, mon: ['tuner', 'live'] },
    enter: () => { if (typeof KIT !== 'undefined' && !KIT.notesEl) kitNotes(); },
    tools: () => [
      ['gtInk', '✎ Annotate', 'Draw over anything on the page; it stays until you clear it', () => kitInk(), () => !!KIT.inkOn, 1],
      ['gtNotes', '📝 Lesson notes', 'Notes for this song, kept in this browser', () => kitNotes(), () => !!KIT.notesEl],
      ['gtScreen', '⏺ Record screen', 'Record this tab or your screen, with the studio’s sound and your voice', () => kitScreen(), () => !!KIT.scr],
      ['gtFret', '▦ Fretboard', 'Show the chord and scale on the neck', () => sideShow('fret')],
      ['gtTx', '♪ Transcribe', 'Turn a recording into notes and chords to teach from', () => dockGo('tx')]
    ] },
  { id: 'fullrig', ico: '⚙️', name: 'Full Rig', layout: 'Full Rig', step: null, hue: '#5b6b79', next: null, all: true,
    blurb: 'Every panel, both sidebars and every Monitor widget.',
    mission: 'Everything, your way', steps: ['Every panel on the strip', 'Both sidebars', 'Every Monitor widget'],
    shape: 'The rig in the middle · I/O and the Monitor either side · every panel on the strip',
    spec: { flip: true, left: true, right: true, tlh: 'minmax(200px,38%)', dock: 'rig', order: [], hidden: [], cur: { left: 'io', right: 'monitor' }, mon: ['tuner', 'levels', 'live', 'spectrum', 'views', 'audience'] },
    tools: () => [
      ['gtLay', '▦ Workspace…', 'Sidebars, floating panels, which tabs show', () => workspaceOpen('panels')],
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
/** o.keepZoom: leave the Canvas view as it is (the first-visit default); a goal you pick always shows the studio */
function goalGo(id, o) {
  const g = goalById(id); if (!g) return false; CFG.ws = g.id; saveCfg();
  if (!(o && o.keepZoom) && typeof ZOOM !== 'undefined' && ZOOM.cur === 'canvas') { ZOOM.cur = CFG.zoom = 'studio'; saveCfg(); document.body.classList.remove('zoom-canvas'); try { zoomSync(); } catch (e) { } }
  applyPreset(g.spec, g.layout); if (typeof xpSignal === 'function') xpSignal(1);
  if (g.spec.side && g.spec.side.fret && typeof sideShow === 'function') { try { sideShow('fret'); } catch (e) { } }
  if (g.enter) { try { g.enter(); } catch (e) { console.warn('goal', e); } }
  goalMark(); bus.emit('goal', g.id); goalBarBuild(); return true;
}
/** the goal's colour, on the page (the goal bar, the open tab) */
function goalMark() { const g = goalNow(); document.body.dataset.goal = g ? g.id : ''; document.documentElement.style.setProperty('--goal', g ? g.hue : 'var(--accent)'); }
bus.on('dock', () => { if (document.body.dataset.goal !== ((goalNow() || {}).id || '')) { goalMark(); goalBarBuild(); } });
/* ---------- the goal bar: the six goals, Create → Perform → Share, the mission, the goal's tools and its next step ---------- */
function goalBar() { const box = h('div', { class: 'goalbar', id: 'goalbar' }); GOALBAR.el = box; goalBarBuild(); return box; }
const GOALBAR = { el: null };
/** the bar sits at the top of the centre, whichever of the panels or the arrangement is on top */
function goalPlace() { const el = GOALBAR.el, top = LAY.flip === false ? $('#timeline') : $('#dock'); if (el && top && (el.parentNode !== top || top.firstChild !== el)) top.insertBefore(el, top.firstChild); }
function goalBarBuild() {
  const box = GOALBAR.el; if (!box) return; box.innerHTML = ''; const cur = goalNow(); goalMark();
  const pick = h('div', { class: 'gl-pick', role: 'group', 'aria-label': 'What do you want to do?' }, GOALS.map(g => h('button', { class: 'gl-b' + (cur === g ? ' on' : ''), 'data-goal': g.id, style: '--gh:' + g.hue, 'aria-pressed': String(cur === g), title: g.name + ': ' + g.blurb, onclick: () => goalGo(g.id) }, h('span', { class: 'gl-i', 'aria-hidden': 'true' }, g.ico), h('span', { class: 'gl-t' }, g.name))));
  const flow = h('ol', { class: 'gl-flow', 'aria-label': 'Create, perform, share' }, GOAL_STEPS.map(([k, n, gid]) => h('li', {}, h('button', { class: 'gl-st' + (cur && cur.step === k ? ' on' : ''), 'data-step': k, 'aria-current': cur && cur.step === k ? 'step' : null, title: n + ': open ' + goalById(gid).name, onclick: () => goalGo(gid) }, n))));
  box.append(h('div', { class: 'gl-row' }, pick, flow));
  if (!cur) { box.append(h('div', { class: 'gl-row gl-tools' }, h('span', { class: 'tiny muted' }, 'Pick what you want to do, and the studio arranges itself for it. Everything stays one click away.'))); return; }
  const tools = h('div', { class: 'gl-row gl-tools', role: 'toolbar', 'aria-label': cur.name + ' tools' });
  tools.append(h('div', { class: 'gl-mis', title: cur.shape }, h('b', {}, cur.mission), h('span', { class: 'gl-steps' }, cur.steps.map((s, i) => h('span', {}, h('i', {}, i + 1), s)))));
  cur.tools().forEach(([id, label, title, fn, on, main, off]) => {
    const b = h('button', { class: 'btn sm gl-tool' + (main ? ' gl-main' : ''), id, type: 'button', title, onclick: e => { fn(e.currentTarget); setTimeout(goalSync, 60); } }, typeof label === 'function' ? label() : label);
    b._on = on; b._off = off; b._label = label; tools.append(b);
  });
  if (cur.next) { const n = goalById(cur.next[0]); tools.append(h('span', { class: 'grow' }), h('button', { class: 'btn sm gl-next', id: 'gtNext', style: '--gh:' + n.hue, title: 'Next: ' + n.name, onclick: () => goalGo(n.id) }, cur.next[1] + ' → ' + n.ico)); }
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

/* ---------- ▦ Workspace (part 05c's dialog): the six goals as cards, then where the panels go ---------- */
function workspaceOpen(at) {
  const close = () => { const d = $('#workspace'); if (d) d.close(); }, cur = goalNow();
  const card = g => h('button', { type: 'button', class: 'ws-card' + (cur === g ? ' on' : ''), 'data-goal': g.id, style: '--gh:' + g.hue, 'aria-pressed': String(cur === g), onclick: () => { goalGo(g.id); close(); } },
    h('span', { class: 'ws-top' }, h('span', { class: 'ws-ico', 'aria-hidden': 'true' }, g.ico), h('span', { class: 'ws-nm' }, h('b', {}, g.name), h('small', {}, g.step ? GOAL_STEPS.find(s => s[0] === g.step)[1] : 'Advanced')), cur === g ? h('span', { class: 'ws-on' }, 'In use') : null),
    h('span', { class: 'ws-mis' }, g.mission), h('span', { class: 'ws-blurb' }, g.blurb),
    goalThumb(g), h('span', { class: 'ws-shape' }, g.shape));
  const chk = (label, get, set) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: get(), onchange: e => set(e.target.checked) }), label);
  const hub = $('#wsBtn');
  return hubOpen('workspace', { ico: '▦', title: 'Workspace', sub: 'Pick what you are here to do, and the studio arranges itself for it. Nothing is ever taken away.', at, sections: [
    { key: 'goal', label: 'Goal', ico: '◎', sub: 'Create → Perform → Share. Each goal shows the panels and tools for one job.', wide: true, body: () => [h('div', { class: 'ws-grid' }, GOALS.map(card))] },
    { key: 'panels', label: 'Panels', ico: '▤', sub: 'Fine-tune the workspace you are in. Every panel area also has a labelled tab on its edge.', body: () => [
      chk('Panels above the arrangement', () => LAY.flip, v => { LAY.flip = v; saveLay(); applyLayout(); }),
      chk('Left sidebar  [', () => LAY.left, v => { LAY.left = v; saveLay(); applyLayout(); }),
      chk('Right sidebar  ]', () => LAY.right, v => { LAY.right = v; saveLay(); applyLayout(); }),
      h('div', { class: 'hub-acts' }, h('button', { class: 'btn', onclick: () => { close(); placeMenu(hub || document.body); } }, '⇆ Where panels live…'), h('span', { class: 'hub-note' }, 'Move any panel to the left sidebar, the right sidebar or the centre, or swap the sidebars.'))] },
    { key: 'list', label: 'Show & float', ico: '⧉', sub: 'Which panels are on the tab strip, and which float as a window.', wide: true, body: () => [h('div', { class: 'ws-list' }, DOCK.map(([id, name]) => h('div', { class: 'ws-li' },
      h('label', { class: 'chk grow' }, h('input', { type: 'checkbox', checked: !LAY.hidden.includes(id), 'aria-label': 'Show ' + name, onchange: e => setTabHidden(id, !e.target.checked) }), name),
      h('button', { class: 'btn sm', onclick: () => { FLOATS.has(id) ? unfloat(id) : floatPane(id); close(); } }, FLOATS.has(id) ? '⤓ dock' : '⧉ float')))),
      h('p', { class: 'hub-note' }, 'The Monitor’s widgets (Tuner, Levels, Analysis, Spectrum, Views, Audience) are chosen on the Monitor itself.')] },
    { key: 'reset', label: 'Reset', ico: '↺', body: () => [h('div', { class: 'hub-acts' }, h('button', { class: 'btn', id: 'wsReset', onclick: () => { [...FLOATS.keys()].forEach(unfloat); LAY.rc = { order: [], col: {}, hide: {}, v: 2 }; RCARDS.forEach(n => { LAY.rc.hide[n] = !MON_DEFAULT.includes(n); }); LAY.floats = {}; sideReset(); applyPreset(LAYOUTS[0][2], LAYOUTS[0][0]); goalMark(); goalBarBuild(); close(); } }, 'Reset layout'), h('span', { class: 'hub-note' }, 'Back to the Studio layout: panels above the arrangement, a sidebar each side, every float docked.'))] }
  ] });
}
/** a small picture of a goal's shape: the sidebars, the open panel, the arrangement above or below */
function goalThumb(g) { const t = layThumb(g.spec); t.classList.add('ws-th'); return t; }

/* a first visit on a computer opens the Performer: the shortest way to a performance you can share.
   Anyone who has been here before keeps the workspace they had, and a layout you chose is never replaced. */
const GOAL_FIRST = !store.get('started', false);
bus.on('booted', () => {
  goalMark();
  if (CFG.ws !== undefined || !isDesk()) return;
  if (!GOAL_FIRST || LAY.name) { CFG.ws = (goalNow() || {}).id || null; saveCfg(); return; }
  goalGo(CFG.xpMode === 'pro' ? 'fullrig' : 'performer', { keepZoom: true });
});
