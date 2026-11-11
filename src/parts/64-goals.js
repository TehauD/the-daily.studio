/* ============================================================
   Part 64 · Goal workspaces: the studio arranged around what a musician wants to do, not around its features.
   Each goal is a complete workspace with its own shape, so the four do not look alike (2.64: Performer and Creator Studio became
   Studio, Practice and Teacher became Practice; their old ids still open them):
     🎸 Songwriter  a notebook: the words and the tab together in the middle, theory beside it, no meters, the arrangement a strip
     🎤 Studio   a stage: the visuals large, your tones on the left, tuner, levels and the audience view on the right; play it
                    live (★ Showtime is in the song bar), record it, watch it back, make it postable
     🎼 Practice    a practice room: the fretboard large in the middle, scales on the left; loop, slow down and speed up; lessons
                    that listen; and for teaching someone else, draw, keep notes and record the screen
     ⚙️ Full Rig    everything: every panel, both sidebars, every Monitor widget
   Each has a colour, a one-line mission with three steps, a row of its tools (the main one highlighted), and a button to the next
   workspace. Nothing is removed: every panel is still under ☰ and ▦. The tools are in part 68.
   ============================================================ */
const GOALS = [
  { id: 'songwriter', ico: '🎸', name: 'Songwriter', layout: 'Songwriter', hue: '#d08a2e', next: ['performer', 'Into the Studio'],
    blurb: 'Lyrics, chords and progressions, and a quick way to catch an idea before it goes.',
    mission: 'Write the song', steps: ['Pick a key and a progression', 'Press ● Capture and play a riff', 'Put the words under the chords'],
    simple: { mission: 'Make a song', steps: ['Pick a beat', 'Play or sing over it, ● to record', 'Put the words under the chords'] },
    shape: 'Words and tab in the middle · Theory on the left · the arrangement a strip',
    spec: { flip: true, left: true, right: false, tlh: '84px', tlhOpen: null, dock: 'tab', order: ['tab', 'band', 'song', 'exp'], hidden: ['rig', 'fret', 'vis', 'stage', 'neural', 'stems', 'tx', 'cam', 'lab'], cur: { left: 'theory' }, mon: ['tuner', 'live'] },
    enter: () => { try { wrMode('both'); } catch (e) { } },
    tools: () => [
      ['gtBeats', '🥁 Beats', 'A ready band to play, sing or write over: tap a beat and it plays, in your song’s key', b => popover(b, h('div', { class: 'bt-pop' }, h('h5', {}, 'Beats'), h('p', { class: 'tiny muted' }, 'Tap one and it plays. Undo puts your band back.'), beatsShelf({ after: closePop }))), null, () => !!CFG.simple],
      ['gtSheet', '🎸 Paste chords', 'Paste a chord sheet (chords over the words): it becomes the song, with bars, key, words and a guitar part', () => liOpen(''), null, () => !CFG.simple],
      ['gtVox', '🎤 Vocal pedals', 'Scream, doubler, harmony, echo, reverb, de-esser and megaphone for your voice', () => vocalBoardOpen()],
      ['gtPads', '👆 Pads', 'Play the drums with your fingers, tap the tempo, record a groove or beatbox it', () => padsOpen()],
      ['gtKeys', '🎹 Keys', 'A piano to play with the mouse, the computer keys or a MIDI keyboard: its own sounds, or the band’s bass or lead; record what you play into the song', () => keysOpen()],
      ['gtLink', () => slSendLabel(), 'Send this song to a bandmate as a link: the chords, words, tab, beat, tempo and key ride inside it (your recordings too, if you choose)', () => slShare()],
      ['gtRoll', '🎛 Piano roll', 'Draw the keys part or the bass line on a grid, loop it, duck it to the kick', () => rollOpen()],


    ] },
  { id: 'performer', ico: '🎤', name: 'Studio', layout: 'Studio workspace', hue: '#d6355a', next: ['songwriter', 'Write the next one'],
    blurb: 'Play it live or record it: the stage visuals, your tone and camera, the record button, replay, and everything to make it postable.',
    mission: 'Play it, record it, share it', steps: ['Pick a look and a tone', 'Play it with ★ Showtime, or ⏺ record a video', 'Watch it back, then save or share it'],
    simple: { mission: 'Play it, record it, share it', steps: ['Pick a look', '⏺ Record a video', 'Watch it back and save it'] },
    shape: 'The stage large · Tones on the left · Tuner, levels and the audience view on the right · lanes for your takes',
    spec: { flip: true, left: true, right: true, tlh: '84px', tlhOpen: 'minmax(150px,30%)', dock: 'vis', order: ['vis', 'rig', 'band', 'stage', 'exp'], hidden: ['tab', 'song', 'fret', 'neural', 'stems', 'tx', 'cam', 'lab'], cur: { left: 'tones', right: 'monitor' }, mon: ['tuner', 'levels', 'audience'] },
    tools: () => [
      ['gtVideo', '⏺ Record video', 'Record the stage, the camera and the sound as a video (MP4 where this browser can make it); Studio Replay opens when you stop', b => kitRecord(b), () => !!SREC.on, 1],
      ['gtFmt', () => SREC_FMTS[srecFmt()][2], 'The shape of the video: wide 16:9 for YouTube, or vertical 9:16 for Reels, TikTok and Shorts; and whether the words and chord are on it', b => popover(b, h('div', { style: { display: 'grid', gap: '8px', minWidth: '250px' } }, h('h5', {}, 'Video shape'), srecFmtBox()))],
      ['gtCam', '📷 Camera', 'You in the picture, in front of or framed by the visuals', () => vzCamPress(), () => !!VZ.cam],
      ['gtFx', '✨ Overlays', 'How the camera sits with the visuals: dimmed behind, framed, or you in front', b => popover(b, h('div', { style: { display: 'grid', gap: '8px', minWidth: '240px' } }, h('h5', {}, 'Overlays'), camFxBox(), h('div', { class: 'tiny muted' }, 'Pick a look in the Visuals panel for what moves behind you.')))],
      ['gtVox', '🎤 Vocal pedals', 'Scream, doubler, harmony, echo, reverb, de-esser and megaphone for your voice', () => vocalBoardOpen()],
      ['gtReplay', '▶ Studio Replay', 'Watch the last recording, then save it, share it or make a thumbnail from any frame', () => kitReplay(), null, 0, () => !KIT.last],
      ['gtStream', '📺 Stream window', 'The words and the chord in a window of their own, for OBS or any streaming app', () => streamRoom()],
      ['gtThumb', '🖼 Thumbnail', 'Save a 1280 × 720 picture of the stage with the song title, for the post', () => kitThumb()],
      ['gtTip', '🎸 Tip jar', 'Let your audience tip you: your own tip link as a QR code on the stage, in your videos and on share pages. Off until you set it up', () => tipOpen(), () => tipReady()],
      ['gtPrint', '◎ Soundprint', 'Any sound becomes a fingerprint, moving worlds, a reading and an ambient piece, to save or share', () => prtOpen()],
      ['gtExp', '⇩ Export', 'Audio, the share page, the lyric sheet and more', () => dockGo('exp')]
    ] },
  { id: 'practice', ico: '🎼', name: 'Practice', layout: 'Practice', hue: '#1c9a63', next: ['performer', 'Into the Studio'],
    blurb: 'Learn it and get it under your fingers: lessons that listen, loop and slow down, the scale on the neck. Teaching someone? Draw, keep notes and record the screen.',
    mission: 'Learn it, then get it under your fingers', steps: ['Start 📅 Today, or 🎵 This song', 'Loop the hard bars and slow them down', 'Speed it up 5 at a time'],
    shape: 'The fretboard large in the middle · Theory (scales) on the left · Tuner and levels on the right',
    spec: { flip: true, left: true, right: true, tlh: '84px', tlhOpen: 'minmax(170px,32%)', dock: 'fret', order: ['fret', 'tab', 'stems', 'band', 'tx', 'rig'], hidden: ['song', 'vis', 'stage', 'neural', 'cam', 'lab', 'exp'], cur: { left: 'theory', right: 'monitor' }, mon: ['tuner', 'levels'] },
    tools: () => [
      ['gtLearn', '🎓 Learn', 'Lessons that show you, play it, then listen to you play it', () => learnOpen('lessons'), null, 1],
      ['gtToday', '📅 Today', 'Today’s fifteen minutes: a warm-up, a review, something new and a riff', () => learnOpen('today')],
      ['gtSong', '🎵 This song', 'The song you have open, as lessons: its strum, each section’s chords and riff, working up to its tempo', () => learnOpen('song')],
      ['gtEar', '👂 By ear', 'Hear a phrase, play it back: no tab', () => learnOpen('ear')],
      ['gtRiffs', '🎸 Riffs & licks', RIFFS.length + ' riffs in ' + RIFF_STYLES.length + ' styles, in any key; Riff Lab and the scale atlas are in Learn', () => learnOpen('riffs')],
      ['gtShed', '🎼 Scales & ear', 'Scales anywhere on the neck, this song’s arpeggios and ear training, followed note by note', () => trainOpen()],
      ['gtSlow', '− 5', 'Slower by 5 BPM', () => goalTempo(-5)],
      ['gtBpm', () => S.bpm + ' BPM', 'The tempo', () => { if (UI.bpm) UI.bpm.focus(); }],
      ['gtFast', '+ 5', 'Faster by 5 BPM', () => goalTempo(5)],
      ['gtSpeed', '⏱ Speed & key', 'Slow the song down without lowering it, or move it to another key', b => psPop(b)],
      ['gtInk', '✎ Annotate', 'Teaching: draw over anything on the page; it stays until you clear it', () => kitInk(), () => !!KIT.inkOn],
      ['gtNotes', '📝 Lesson notes', 'Teaching: notes for this song, kept in this browser', () => kitNotes(), () => !!KIT.notesEl],
      ['gtScreen', '⏺ Record screen', 'Teaching: record this tab or your screen, with the studio’s sound and your voice', () => kitScreen(), () => !!KIT.scr],
      ['gtTx', '♪ Transcribe', 'Turn a recording into notes and chords to learn or teach from', () => dockGo('tx')]
    ] },
  { id: 'fullrig', ico: '⚙️', name: 'Full Rig', layout: 'Full Rig', hue: '#5b6b79', next: null, all: true,
    blurb: 'Every panel, both sidebars and every Monitor widget.',
    mission: 'Everything, your way', steps: ['Every panel on the strip', 'Both sidebars', 'Every Monitor widget'],
    shape: 'The rig in the middle · I/O and the Monitor either side · every panel on the strip',
    spec: { flip: true, left: true, right: true, tlh: '84px', tlhOpen: 'minmax(200px,38%)', dock: 'rig', order: [], hidden: [], cur: { left: 'io', right: 'monitor' }, mon: ['tuner', 'levels', 'live', 'spectrum', 'views', 'audience'] },
    tools: () => [
      ['gtLay', '▦ Workspace…', 'Sidebars, floating panels, which tabs show', () => workspaceOpen('panels')],
      ['gtPlace', '⇆ Where panels live…', 'Move any panel to either sidebar or the centre', b => placeMenu(b)]
    ] }
];
/* the goals that came before (2.9's journeys, and the guided sessions that still name them) */
const GOAL_ALIAS = { play: 'performer', create: 'songwriter', learn: 'practice', write: 'songwriter', perform: 'performer', share: 'performer', creator: 'performer', teacher: 'practice', spotlight: 'performer', studio_ws: 'performer' };
/* 2.64: a studio last arranged as one of the workspaces that were merged opens as the one it became */
const GOAL_OLD_LAYOUTS = { Performer: 'Studio workspace', 'Creator Studio': 'Studio workspace', Spotlight: 'Studio workspace', Teacher: 'Practice' };      /* the layout key isn't shown; 'Studio' alone is the base layout */
if (GOAL_OLD_LAYOUTS[LAY.name]) { LAY.name = GOAL_OLD_LAYOUTS[LAY.name]; }
/* 2.64: the arrangement starts collapsed (a strip under the panels; ▴ Arrangement opens it). Once, for a studio already set up too,
   except in Arrange and Record, which are about the arrangement */
if (CFG.arrFold !== 1) { CFG.arrFold = 1; if (!/^(Arrange|Record)$/.test(LAY.name || '') && LAY.tlh !== '84px') { LAY.tlhPrev = LAY.tlh == null ? null : LAY.tlh; LAY.tlh = '84px'; try { saveLay(); } catch (e) { } } saveCfg(); }
if (CFG.ws === 'creator') CFG.ws = 'performer'; if (CFG.ws === 'teacher') CFG.ws = 'practice'; if (CFG.lastGoal === 'creator') CFG.lastGoal = 'performer'; if (CFG.lastGoal === 'teacher') CFG.lastGoal = 'practice';
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
  const g = goalById(id); if (!g) return false; const was = goalNow(); if (was && was !== g && was.leave) { try { was.leave(); } catch (e) { } }
  CFG.ws = g.id; if (g.id !== 'fullrig') CFG.lastGoal = g.id; saveCfg();
  if (g.id === 'fullrig' && CFG.simple) { CFG.preSimple = null; simpleSet(false, true); toast('Full Rig has every tool, so Simple is off here. ✦ Simple takes you back to the essentials.', ''); }      /* 2.46: Full Rig is everything */
  if (!(o && o.keepZoom) && typeof ZOOM !== 'undefined' && ZOOM.cur === 'canvas') { ZOOM.cur = CFG.zoom = 'studio'; saveCfg(); document.body.classList.remove('zoom-canvas'); try { zoomSync(); } catch (e) { } }
  applyPreset(g.spec, g.layout); if (typeof xpSignal === 'function') xpSignal(1);
  if (g.spec.side && g.spec.side.fret && typeof sideShow === 'function') { try { sideShow('fret'); } catch (e) { } }
  if (g.enter) { try { g.enter(); } catch (e) { console.warn('goal', e); } }
  goalAudioFirst();
  goalMark(); bus.emit('goal', g.id); goalBarBuild(); try { rebuildTabs(); } catch (e) { } return true;
}
/** 2.46: until an input is connected, every workspace opens its sidebar on the audio input (you connect before anything else works) */
function goalAudioFirst() { try { if (isDesk() && !E.hasInput && typeof sideShow === 'function') sideShow('io'); } catch (e) { } }
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
  box.append(h('div', { class: 'gl-row' }, pick));
  if (!cur) { box.append(h('div', { class: 'gl-row gl-tools' }, h('span', { class: 'tiny muted' }, 'Pick what you want to do, and the studio arranges itself for it. Everything stays one click away.'))); return; }
  const tools = h('div', { class: 'gl-row gl-tools', role: 'toolbar', 'aria-label': cur.name + ' tools' });
  const ms = CFG.simple && cur.simple || cur, few = CFG.simple && SIMPLE_GOAL_TOOLS[cur.id];      /* ✦ Simple: each workspace keeps its few tools (part 33b) */      /* ✦ Simple: Songwriter's own words and fewer tools (part 33b) */
  tools.append(h('div', { class: 'gl-mis', title: cur.shape }, h('b', {}, ms.mission), h('span', { class: 'gl-steps' }, ms.steps.map((s, i) => h('span', {}, h('i', {}, i + 1), s)))));
  cur.tools().forEach(([id, label, title, fn, on, main, off]) => {
    if (few && !few.includes(id)) return; if (typeof main === 'function') main = main();
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

/* ---------- ▦ Workspace (part 05c's dialog): the four goals as cards, then where the panels go ---------- */
function workspaceOpen(at) {
  const close = () => { const d = $('#workspace'); if (d) d.close(); }, cur = goalNow();
  const card = g => h('button', { type: 'button', class: 'ws-card' + (cur === g ? ' on' : ''), 'data-goal': g.id, style: '--gh:' + g.hue, 'aria-pressed': String(cur === g), onclick: () => { goalGo(g.id); close(); } },
    h('span', { class: 'ws-top' }, h('span', { class: 'ws-ico', 'aria-hidden': 'true' }, g.ico), h('span', { class: 'ws-nm' }, h('b', {}, g.name), h('small', {}, g.all ? 'Advanced' : g.mission)), cur === g ? h('span', { class: 'ws-on' }, 'In use') : null),
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

/* a first visit on a computer opens in ✦ Simple, which is the Songwriter (2.39; it was the Performer before): a beat, the chords and the words.
   Anyone who has been here before keeps the workspace they had, and a layout you chose is never replaced. */
const GOAL_FIRST = !store.get('started', false);
bus.on('booted', () => {
  goalMark();
  if (CFG.ws !== undefined || !isDesk()) return;
  if (!GOAL_FIRST || LAY.name) { CFG.ws = (goalNow() || {}).id || null; saveCfg(); return; }
  goalGo(CFG.xpMode === 'pro' ? 'fullrig' : CFG.simple ? 'songwriter' : 'performer', { keepZoom: true });      /* ✦ Simple (a first visit) is the Songwriter */
});
