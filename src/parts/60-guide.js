/* ============================================================
   Part 60 · Guide: goals, guided sessions, first-open hints, plain words, and the Show preflight.
   The first page asks what you want to DO (never how good you are). Each goal starts a short session: a small card that
   names one step at a time, points at the control, and ticks the step off when you really do it (the app watches its own
   state; nothing is faked). Finishing sessions is what adds tools to the tab strip. Tabs explain themselves the first time
   they open, once. Nothing here sends anything anywhere; progress is kept in this browser (CFG.guide).
   ============================================================ */
const GD = { id: null, i: 0, el: null, timer: 0, min: false, seen: {}, base: null, pf: {}, hintEl: null, pulse: null, done: false };
function gdc() { const g = CFG.guide || (CFG.guide = {}); g.done = g.done || {}; g.hints = g.hints || {}; g.prog = g.prog || {}; return g; }

/* ---------- the Show preflight: what a technician checks before doors, each ticked by the app when it sees it done ---------- */
const GD_PF = [
  ['look', 'Pick a look for the scene', 'Looks tab: choose one of the six, or one of your saved looks.', () => GD.pf.look, () => shOpen('scene', 'looks'), '#shc .shc-tab[data-t="looks"]'],
  ['rig', 'Check the rig against the room', 'Rig tab: how many lights, where they stand, haze, lasers on or off.', () => GD.pf.rig, () => shOpen('scene', 'rig'), '#shc .shc-tab[data-t="rig"]'],
  ['out', 'Open the output', 'Output tab: Full screen, or the pop-out window for the projector or LED wall.', () => GD.pf.out, () => shOpen('scene', 'out'), '#shc .shc-tab[data-t="out"]'],
  ['test', 'Run a test pattern', 'Bars or grid lines up the projector and shows the colours as they really are. Turn it off when done.', () => GD.pf.test, () => shOpen('scene', 'out'), '#shc .shc-seg'],
  ['master', 'Set the master level for the room', 'Output tab: drag Master level. It dims the whole picture, like a house dimmer.', () => GD.pf.master, () => shOpen('scene', 'out'), '#shc .sg-sl'],
  ['bo', 'Try the blackout', 'Press 0 or the Blackout button, then press it again to bring the picture back. Know where it is before you need it.', () => GD.pf.bo, () => shOpen('scene', 'out'), '#shBo'],
  ['run', 'Play the song once and watch the flash meter', 'Press Play with Show setup open. The meter shows flashes per second; it stays under three.', () => GD.pf.run, () => shOpen('scene', 'out'), '#sgdPlay']
];
function gdSniff() {
  try {
    const O = (CFG.show && CFG.show.out) || {}, pf = GD.pf;
    if (typeof SG !== 'undefined' && SG) { if (SG.test) pf.test = 1; if (SG.boOn) pf.bo = 1; }
    if (GD.mBase === undefined) GD.mBase = O.master; else if (O.master !== GD.mBase) pf.master = 1;
    const visible = typeof SHC !== 'undefined' && SHC.root && SHC.root.isConnected && SHC.root.offsetParent;
    if (visible) { if (SHC.tab === 'rig') pf.rig = 1; if (T.playing) pf.run = 1; }
    if (T.playing) GD.seen.played = 1; if (T.rec && !T.playing) GD.seen.armed = 1; if (typeof STP !== 'undefined' && STP.playing) GD.seen.splay = 1;
  } catch (e) { }
}
function gdPfRender() {
  const box = document.getElementById('gdPf'); if (!box || !box.isConnected) return;
  const n = GD_PF.filter(x => x[3]()).length; box.dataset.n = n;
  box.querySelector('.gd-pf-h b').textContent = n + ' of ' + GD_PF.length + ' checked';
  box.querySelectorAll('li').forEach((li, i) => { const ok = !!GD_PF[i][3](); li.classList.toggle('ok', ok); li.querySelector('.gd-tick').textContent = ok ? '✓' : String(i + 1); });
}
/** the checklist as it appears in the Output tab (and the Show session reuses the same items) */
function gdPfBlock() {
  const ul = h('ol', { class: 'gd-pf-list' }, GD_PF.map(([id, t, d, ok, go]) => h('li', { 'data-id': id, class: ok() ? 'ok' : '' }, h('span', { class: 'gd-tick', 'aria-hidden': 'true' }, ok() ? '✓' : String(GD_PF.findIndex(x => x[0] === id) + 1)), h('div', {}, h('b', {}, t), h('span', {}, d)),
    h('button', { class: 'btn sm', title: 'Take me to it', onclick: () => { try { go(); } catch (e) { } } }, 'Go'))));
  const box = h('div', { class: 'gd-pf', id: 'gdPf' }, h('div', { class: 'gd-pf-h' }, h('b', {}, ''), h('span', { class: 'grow' }), h('button', { class: 'btn sm', title: 'Clear the ticks and start the checks again for the next room', onclick: () => { GD.pf = {}; GD.mBase = undefined; gdPfRender(); } }, 'Start over')), ul,
    h('p', { class: 'tiny muted' }, 'The app ticks each line when it sees you do it. This list is for the room you are in; it is not saved.'));
  setTimeout(gdPfRender, 0); return box;
}
setInterval(() => { gdSniff(); gdPfRender(); }, 500);

/* ---------- the sessions ---------- */
const GD_SESSIONS = {
  hum: {
    name: 'Turn a hum into a song', mins: 2, icon: '🎤', blurb: 'Hum or sing a few seconds. A whole band plays it back.',
    outro: 'You made a song from a sound. It is saved in My songs. Next, try recording real guitar over it.', next: 'record',
    steps: [
      { id: 'start', short: 'Start listening', text: 'Press ● Sing or hum an idea. Your browser will ask to use the microphone; say yes. It only listens while you are recording.', target: '#humGo2', go: () => { if (!document.getElementById('humbar')) { try { humCanvasFirst(); } catch (e) { } } }, done: () => !!(HUM.rec || HUM.pcm || HUM.r) },
      { id: 'hum', short: 'Hum 10–30 seconds', text: 'Hum or sing any tune for 10 to 30 seconds, then press ■ Stop. It does not have to be good; the app listens for the notes.', target: '#humStop', done: () => !!(HUM.pcm || HUM.r) },
      { id: 'play', short: 'Hear the band', text: 'Your song is ready. Press ▶ Play my song. The chords and the band were built from your tune.', target: '#humPlay', done: () => !!GD.seen.played },
      { id: 'change', short: 'Change the feel', text: 'Make it yours: pick another Style, change the tempo, or press 🎲 Try different chords. It rebuilds right away.', target: '.hum-chips', setup: () => { GD.base = HUM.o ? [HUM.o.style, HUM.o.seed, HUM.o.bpm, HUM.o.key, HUM.o.minor, HUM.o.form].join() : ''; }, done: () => !!(HUM.o && GD.base != null && [HUM.o.style, HUM.o.seed, HUM.o.bpm, HUM.o.key, HUM.o.minor, HUM.o.form].join() !== GD.base) },
      { id: 'keep', short: 'Keep it', text: 'Press Done to keep it. Add lyrics or open it in the studio whenever you like.', target: '.hum-acts .btn.primary', done: () => !!HUM.r && !document.getElementById('humbar') }
    ]
  },
  record: {
    name: 'Record guitar and voice', mins: 3, icon: '⏺', blurb: 'Plug in or use your mic, record one take, hear it back.',
    outro: 'That is a recorded take, saved on this device. Next, loop it and play a second part on top.', next: 'loop',
    steps: [
      { id: 'input', short: 'Connect your input', text: () => (isDesk() ? 'Press Connect (in the panel on the left, or Audio at the top right)' : 'Tap the round Audio button at the top') + ' and allow the microphone when asked. Then choose your guitar interface or microphone. Use headphones so the speakers do not feed back into it.', target: () => { const c = document.querySelector('#left .btn.primary'); return c && c.getClientRects().length ? c : UI.aud; }, go: () => { if (!document.querySelector('#left .btn.primary')) { try { audioOpen(); } catch (e) { } } }, done: () => !!(E && E.hasInput && E.ctx && E.ctx.state === 'running') },
      { id: 'arm', short: 'Arm recording', text: 'Press ● in the transport (or the R key) to arm a take. The count-in clicks before it starts.', target: () => UI.rec, done: () => !!(T.rec || REC || GD.seen.armed || TAKES.length) },
      { id: 'rec', short: 'Play something', text: 'After the count-in, play or sing. One press of R makes one take; it keeps going until you stop it.', target: () => UI.rec, done: () => !!(REC || TAKES.length) },
      { id: 'stop', short: 'Stop', text: 'Press ■ Stop (or R again) to end the take.', target: () => UI.stop, done: () => !REC && TAKES.length > 0 },
      { id: 'hear', short: 'Hear it back', text: 'Press Space to hear what you played. Takes appear as clips in the Guitar and Vocal lanes; click one to move or trim it.', target: () => UI.play, setup: () => { GD.seen.played = 0; }, done: () => !!GD.seen.played }
    ]
  },
  loop: {
    name: 'Record, loop and layer', mins: 4, icon: '⟲', blurb: 'Record chords, hear them loop, then play a lead on top, like a looper pedal.',
    outro: 'That is the looper workflow: every layer is its own track you can move, mute, solo and export. Try Add a layer for a third part.', next: 'split',
    steps: [
      { id: 'input', short: 'Connect your input', text: () => (isDesk() ? 'Press Connect (in the panel on the left, or Audio at the top right)' : 'Tap the round Audio button at the top') + ' and allow the microphone when asked. Use headphones so the speakers do not feed back into it.', target: () => { const c = document.querySelector('#left .btn.primary'); return c && c.getClientRects().length ? c : UI.aud; }, go: () => { if (!document.querySelector('#left .btn.primary')) { try { audioOpen(); } catch (e) { } } }, done: () => !!(E && E.hasInput && E.ctx && E.ctx.state === 'running') },
      { id: 'set', short: 'Set the loop', text: 'Press ⟲ Loop & layer, choose how long the loop is (4 bars is a good start) and press Start looping. A bar of clicks counts you in.', target: '#lpBtn, #lpGo', go: () => { if (!document.getElementById('lpDlg')) { try { looperOpen(); } catch (e) { } } }, done: () => !!LP.on },
      { id: 'chords', short: 'Play your chords', text: 'After the count-in, play your chords for one full pass of the loop. When it comes round, that pass is saved as Layer 1 and starts playing back.', target: '#lpState', done: () => lpLayers().length >= 1 },
      { id: 'lead', short: 'Play a lead on top', text: 'The chords now loop by themselves. Play a lead or a melody over them: this pass records Layer 2 while Layer 1 keeps playing.', target: '#lpState', done: () => lpLayers().length >= 2 },
      { id: 'keep', short: 'Just listen', text: 'Press Keep looping to stop recording at the end of this pass. The loop carries on so you can listen to both layers together.', target: '#lpKeep', done: () => !!(LP.on && !T.rec && T.playing && lpLayers().length >= 2) },
      { id: 'mix', short: 'Hear each layer', text: 'Mute or solo a layer with M and S on its lane to hear each part alone, then press ■ Stop. Add a layer lets you go again.', target: '#lpStop', done: () => !LP.on && TAKES.length >= LP.n0 + 2 && !T.playing }
    ]
  },
  split: {
    name: 'Learn a song', mins: 3, icon: '🎚', blurb: 'Split a song into drums, bass, vocals and guitar. Mute yours and play along.',
    outro: 'You can now practise any song with your part taken out. Loop a hard bar and slow it down in the same tab.', next: 'show',
    steps: [
      { id: 'open', short: 'Open Backing track', text: 'Open the Backing track tab (also called Stems).', target: '#dock .tab[data-id="stems"]', go: () => dockGo('stems'), done: () => DOCK.cur === 'stems' },
      { id: 'load', short: 'Load a song', text: 'Choose a song file from your computer, or drop one anywhere on the page. It is split on this device and never uploaded; expect about as long as the song lasts.', target: '#pane-stems .btn.primary', done: () => !!(STM.dur > 0 && !STM.busy) },
      { id: 'mute', short: 'Mute your part', text: 'Mute the part you play: press M on that strip, or use a preset such as No guitar. Everything else keeps playing.', target: '#pane-stems', done: () => STM.mix.some(m => m.m) },
      { id: 'play', short: 'Play along', text: 'Press ▶ and play along with the rest of the band.', target: () => SU.play, done: () => !!GD.seen.splay },
      { id: 'loop', short: 'Loop a hard bit', text: 'Tick Loop, then drag across the section you want to drill. It repeats until you stop it.', target: '#pane-stems', done: () => !!(STM.loop && STM.loop.on) }
    ]
  },
  show: {
    name: 'Set up a show', corner: 'bl', mins: 5, icon: '✦', blurb: 'A preflight for the room: look, rig, output, test pattern, blackout, rehearsal.',
    outro: 'Preflight done. The output is open, tested and you know where the blackout is. Save the look so it is there next time.', next: null,
    steps: GD_PF.map(([id, short, text, ok, go, target]) => ({ id, short, text: text, target, go, done: ok, pf: true }))
  }
};
const GD_ORDER = ['hum', 'record', 'loop', 'split', 'show'];

/* ---------- starting from a goal on the first page ---------- */
const GD_GOALS = {
  hum: () => { /* the default first screen is already the hum bar on a clean page */ },
  record: async () => { await projCreate('blank', { form: 'empty', title: 'My first take', zoom: 'studio' }); zoomSet('studio', true); if (!isDesk()) mGo('play'); },
  loop: async () => { await projCreate('blank', { form: 'empty', title: 'My first loop', zoom: 'studio' }); zoomSet('studio', true); if (!isDesk()) mGo('play'); },
  split: async () => { await projCreate('blank', { form: 'empty', title: 'Learn a song', zoom: 'studio' }); if (isDesk()) dockGo('stems'); else mGo('stems', 'stems'); },
  show: async () => { await projCreate('demo', { zoom: 'song' }); if (isDesk()) { const L = LAYOUTS.find(l => l[0] === 'Show'); if (L) applyPreset(L[2], 'Show'); } else mGo('see', 'stage'); dockGo('stage'); try { shOpen('scene', 'looks'); } catch (e) { } }
};
/** called by startMaybe: true when a goal took over the first screen */
function guideRoute() {
  const goal = CFG.goal || PRJ.goal; if (!goal || !GD_SESSIONS[goal]) return false;
  PRJ.goal = null; CFG.goal = null; saveCfg();
  if (goal === 'hum') { guideStart('hum', { fresh: true }); return false; }   // the hum bar still opens as usual
  (async () => { try { await GD_GOALS[goal](); } catch (e) { console.warn(e); } guideStart(goal, { fresh: true }); })(); return true;
}

/* ---------- the card ---------- */
function guideStart(id, o = {}) {
  const S0 = GD_SESSIONS[id]; if (!S0) return; guideStop(true);
  const g = gdc(); GD.id = id; GD.i = o.fresh ? 0 : Math.min(g.prog[id] || 0, S0.steps.length - 1); GD.min = false; GD.seen = {}; GD.base = null; GD.done = false;
  g.sess = id; saveCfg(); gdHintClear(); GD.manual = false; gdEnter(); gdBuild(); GD.timer = setInterval(gdTick, 400); gdTick();
  if (o.go) { const st = S0.steps[GD.i]; try { if (st.go) st.go(); } catch (e) { } }
}
function guideStop(quiet) {
  clearInterval(GD.timer); GD.timer = 0; if (GD.id) { const g = gdc(); if (!GD.done) g.prog[GD.id] = GD.i; }
  GD.id = null; gdPulse(null); if (GD.el) { GD.el.remove(); GD.el = null; }
  const g = gdc(); if (g.sess) { g.sess = null; saveCfg(); } document.body.classList.remove('gd-on');
  if (!quiet) toast('Guided session closed. Find it again under ? ▸ Guided sessions.', '');
}
function gdEnter() { const st = GD_SESSIONS[GD.id].steps[GD.i]; GD.seen = {}; GD.base = null; try { if (st && st.setup) st.setup(); } catch (e) { } }
function gdPulse(el) {
  if (GD.pulse && GD.pulse !== el) GD.pulse.classList.remove('gd-pulse'); GD.pulse = el || null; if (el) el.classList.add('gd-pulse');
}
function gdTarget(st) { try { const t = typeof st.target === 'function' ? st.target() : (st.target ? document.querySelector(st.target) : null); return t && t.getClientRects && t.getClientRects().length ? t : null; } catch (e) { return null; } }
function gdTick() {
  if (!GD.id) return; const S0 = GD_SESSIONS[GD.id]; gdSniff();
  let moved = false;
  while (GD.i < S0.steps.length) { let ok = false; try { ok = !!S0.steps[GD.i].done(); } catch (e) { } if (!ok) break; GD.i++; moved = true; GD.seen = GD.seen || {}; if (GD.i < S0.steps.length) gdEnter(); }
  if (moved) { const g = gdc(); g.prog[GD.id] = GD.i; saveCfg(); }
  if (GD.i >= S0.steps.length) return gdFinish();
  gdBuild(); const tg = GD.min ? null : gdTarget(S0.steps[GD.i]); gdPulse(tg); gdPlace(tg);
}
/** keep the card off the control it is pointing at (and off the hum panel); a card the person has dragged stays where they put it */
function gdPlace(tg) {
  const el = GD.el; if (!el || !el.isConnected || GD.manual || document.body.dataset.form === 'phone') return;
  const w = el.offsetWidth, hh = el.offsetHeight, vw = innerWidth, vh = innerHeight, M = 14, rects = [];
  if (tg) rects.push([tg.getBoundingClientRect(), 10]); const hb = document.getElementById('humbar'); if (hb && hb.open) rects.push([hb.getBoundingClientRect(), 3]);
  const cost = (x, y) => rects.reduce((a, [r, k]) => a + k * Math.max(0, Math.min(x + w, r.right) - Math.max(x, r.left)) * Math.max(0, Math.min(y + hh, r.bottom) - Math.max(y, r.top)), 0);
  const cur = el.getBoundingClientRect(), have = el.style.left !== '';
  if (have && cost(cur.left, cur.top) === 0) return;
  const bl = [M, vh - hh - 40], tr = [vw - w - M, 62], cands = GD.id && GD_SESSIONS[GD.id].corner === 'bl' ? [bl, tr, [M, 62], [vw - w - M, vh - hh - 40]] : [tr, bl, [M, 62], [vw - w - M, vh - hh - 40]]; let best = cands[0], bc = Infinity; for (const c of cands) { const k = cost(c[0], c[1]); if (k < bc) { bc = k; best = c; } }
  el.style.left = Math.max(M, best[0]) + 'px'; el.style.top = Math.max(M, best[1]) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
}
function gdDrag(e) {
  if (e.target.closest('button') || document.body.dataset.form === 'phone') return; const el = GD.el, r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
  const mv = ev => { GD.manual = true; el.style.left = Math.max(0, Math.min(innerWidth - 60, ev.clientX - dx)) + 'px'; el.style.top = Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy)) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up);
}
function gdFinish() {
  const id = GD.id, S0 = GD_SESSIONS[id], g = gdc(), first = !g.done[id]; GD.done = true; g.done[id] = Date.now(); g.prog[id] = 0; saveCfg();
  clearInterval(GD.timer); GD.timer = 0; gdPulse(null);
  let unlocked = []; if (first) { const was = new Set(DOCK.filter(d => xpAllowed(d[0])).map(d => d[0])); try { xpSignal(5); } catch (e) { } unlocked = DOCK.filter(d => xpAllowed(d[0]) && !was.has(d[0])).map(d => XP_NAMES[d[0]] || d[1]); }
  const nx = S0.next && !g.done[S0.next] ? GD_SESSIONS[S0.next] : GD_ORDER.map(k => GD_SESSIONS[k]).find((s, i) => !g.done[GD_ORDER[i]]);
  const nxId = nx ? GD_ORDER.find(k => GD_SESSIONS[k] === nx) : null;
  if (!GD.el) gdBuild(); const el = GD.el; el.innerHTML = ''; el.classList.remove('min'); el.dataset.state = 'done';
  el.append(h('div', { class: 'gd-h' }, h('span', { class: 'gd-t' }, '✓ ' + S0.name), h('button', { class: 'gd-x', 'aria-label': 'Close', title: 'Close', onclick: () => guideStop(true) }, '✕')),
    h('p', { class: 'gd-text' }, S0.outro), unlocked.length ? h('p', { class: 'gd-unlock' }, h('b', {}, 'Added to your tabs: '), unlocked.join(', '), '. Find the rest under Tools.') : null,
    h('div', { class: 'gd-act' }, nxId ? h('button', { class: 'btn sm primary', id: 'gdNext', onclick: () => guideStart(nxId, { fresh: true, go: true }) }, 'Next: ' + nx.name) : null, h('button', { class: 'btn sm', onclick: () => guideStop(true) }, 'Done')));
  GD.id = null; document.body.classList.add('gd-on');
}
function gdBuild() {
  const S0 = GD_SESSIONS[GD.id]; if (!S0) return; const st = S0.steps[GD.i], n = S0.steps.length;
  if (!GD.el || !GD.el.isConnected) { GD.el = h('aside', { id: 'gd', class: 'gd', role: 'region', 'aria-label': 'Guided session', 'aria-live': 'polite' }); document.body.append(GD.el); }
  const el = GD.el, key = GD.id + ':' + GD.i + ':' + GD.min; if (el.dataset.key === key) return; el.dataset.key = key; el.dataset.state = 'run'; el.classList.toggle('min', GD.min); el.innerHTML = ''; document.body.classList.add('gd-on');
  el.append(h('div', { class: 'gd-h', title: 'Drag to move', onpointerdown: gdDrag }, h('span', { class: 'gd-t' }, S0.icon + ' ' + S0.name), h('span', { class: 'gd-n' }, (GD.i + 1) + ' of ' + n),
    h('button', { class: 'gd-m', id: 'gdMin', 'aria-label': GD.min ? 'Expand' : 'Minimise', title: GD.min ? 'Expand' : 'Minimise', onclick: () => { GD.min = !GD.min; gdBuild(); gdPulse(GD.min ? null : gdTarget(st)); } }, GD.min ? '▢' : '–'),
    h('button', { class: 'gd-x', id: 'gdEnd', 'aria-label': 'End this session', title: 'End this session (your place is kept)', onclick: () => guideStop() }, '✕')),
  h('div', { class: 'gd-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': n, 'aria-valuenow': GD.i }, h('i', { style: { width: Math.round(GD.i / n * 100) + '%' } })));
  if (GD.min) return;
  el.append(h('ol', { class: 'gd-steps' }, S0.steps.map((s, i) => h('li', { class: i < GD.i ? 'ok' : i === GD.i ? 'cur' : '' }, h('span', { class: 'gd-tick', 'aria-hidden': 'true' }, i < GD.i ? '✓' : String(i + 1)), s.short))),
    h('p', { class: 'gd-text', id: 'gdText' }, typeof st.text === 'function' ? st.text() : st.text),
    h('div', { class: 'gd-act' }, h('button', { class: 'btn sm primary', id: 'gdShow', title: 'Take me to the control for this step', onclick: () => { try { if (st.go) st.go(); } catch (e) { } const t = gdTarget(st); if (t) { try { t.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { } gdPulse(t); } } }, 'Show me'),
      h('button', { class: 'btn sm', id: 'gdSkip', title: 'Skip this step', onclick: () => { GD.i++; const g = gdc(); g.prog[GD.id] = GD.i; saveCfg(); if (GD.i >= S0.steps.length) return gdFinish(); gdEnter(); gdBuild(); gdTick(); } }, 'Skip')));
}

/* ---------- the menu: all sessions, one place ---------- */
function guideMenu() {
  const g = gdc(), body = h('div', { class: 'gd-menu' }, h('p', { class: 'muted small' }, 'Short, real tasks. Each one ticks off as you do it, and finishing one adds tools to your tab strip. You can leave at any point and come back to where you were.'),
    GD_ORDER.map(k => { const s = GD_SESSIONS[k], done = !!g.done[k], part = (g.prog[k] || 0) > 0 && !done; return h('div', { class: 'gd-row' + (done ? ' ok' : '') }, h('span', { class: 'gd-ic', 'aria-hidden': 'true' }, s.icon), h('div', { class: 'grow' }, h('b', {}, s.name, done ? h('span', { class: 'gd-done' }, ' ✓ done') : null), h('span', { class: 'small muted' }, s.blurb + ' About ' + s.mins + ' min.')),
      h('button', { class: 'btn sm' + (done ? '' : ' primary'), 'data-s': k, onclick: () => { d.close(); guideStart(k, { fresh: !part, go: true }); } }, done ? 'Again' : part ? 'Resume' : 'Start')); }),
    h('div', { class: 'hr' }), h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } },
      h('button', { class: 'btn sm', id: 'gdWords', onclick: () => { d.close(); guideWords(); } }, 'DAW words, in guitar terms'),
      h('button', { class: 'btn sm', id: 'gdTour', onclick: () => { d.close(); tourStart(); } }, '▶ Take the full tour'),
      h('label', { class: 'chk small', style: { display: 'flex', gap: '5px', alignItems: 'center', fontWeight: 700 } }, h('input', { type: 'checkbox', id: 'gdHintsOn', checked: !g.off, onchange: e => { g.off = !e.target.checked; saveCfg(); if (g.off) gdHintClear(); } }), 'Show a note the first time I open a tab')));
  const d = pdlg('gdMenu', 'GUIDED SESSIONS', body); return d;
}

/* ---------- plain words ---------- */
const GD_WORDS = [
  ['Track / lane', 'One row in the arrangement for one sound, like one channel on a four-track recorder. Chords, drums, your guitar and your voice each get a lane.'],
  ['Clip', 'A piece of recorded audio sitting in a lane. Drag it to move it, pull its edge to trim it. Think of a length of tape you can cut and slide.'],
  ['Take', 'One pass of playing. Record again and you get another take; keep the good one, mute the rest.'],
  ['Arm', 'Tell a lane it will be recorded next. Like pressing record on one channel before you hit the big record button.'],
  ['Dry and wet', 'Dry is the clean signal straight from your guitar. Wet is the sound after the amp and pedals. The app records both so you can change the tone later.'],
  ['Input level / gain', 'How hot the signal is when it comes in, like the volume knob on your interface. If the meter hits red the sound distorts, so turn it down.'],
  ['Monitor', 'Hearing yourself while you play. Use the interface’s direct monitor or headphones so there is no delay.'],
  ['Latency', 'The tiny delay between playing and hearing. Under about 12 ms feels instant. A smaller buffer lowers it.'],
  ['Count-in', 'The clicks before a take starts, like a drummer counting in the band.'],
  ['Loop', 'Repeat one section over and over, the way you would drill a hard lick.'],
  ['Stem', 'One instrument pulled out of a mixed song: drums, bass, vocals, or guitar and the rest. Mute yours and you have a backing track.'],
  ['Snap / quantise', 'Pull timing onto the beat grid. Clips snap to the beat so they line up without nudging by eye.'],
  ['Master', 'The final volume of everything together. On the show output it is the house dimmer.'],
  ['Render / export', 'Turn the song into a file you can send: a WAV, MIDI, a chord sheet or a tab.'],
  ['Scene', 'A saved snapshot: on the Rig, a whole pedalboard setting; on the Stage, a whole look. One key switches between them, like a patch change.']
];
function guideWords() {
  const q = h('input', { class: 'in', type: 'search', placeholder: 'Find a word…', 'aria-label': 'Find a word', style: { width: '100%', margin: '0 0 8px' } });
  const list = h('dl', { class: 'gd-words' }, GD_WORDS.map(([t, d]) => [h('dt', {}, t), h('dd', {}, d)]));
  q.oninput = () => { const v = q.value.toLowerCase(); list.querySelectorAll('dt').forEach(dt => { const dd = dt.nextSibling, hit = !v || (dt.textContent + ' ' + dd.textContent).toLowerCase().includes(v); dt.hidden = dd.hidden = !hit; }); };
  return pdlg('gdWordsDlg', 'DAW WORDS, IN GUITAR TERMS', h('div', {}, q, list));
}

/* ---------- a note the first time a tab opens ---------- */
const GD_HINTS = {
  rig: ['Your amp and pedals, in the order the sound passes through them, like cables on a real board.', 'Pick a tone from the list on the left, then strum.'],
  tab: ['Write what you play as numbers on six lines, one line for each string.', 'Click a cell and type a fret number. Space plays it.'],
  song: ['The song’s title, key, tempo and structure: verses, choruses, a bridge.', 'Change the key and the whole song moves with it.'],
  band: ['A drummer, bassist and rhythm guitarist who follow your chords.', 'Press D, B or G to turn each of them on or off while you play.'],
  fret: ['A map of the neck. It shows scale notes and chord shapes for your tuning.', 'Choose a scale and play inside the lit notes.'],
  stage: ['The control desk for a live show: looks, lights, cues and the output to a projector.', 'Open the Output tab and run a test pattern first.'],
  neural: ['Your song drawn as a living map of notes and chords.', 'Press Play, then drag to turn it.'],
  stems: ['Drop in any song and it splits into drums, bass, vocals and guitar, so you can mute the part you play.', 'Choose a file, then use a preset such as No guitar.'],
  tx: ['Play or load a recording and the app writes the chords and tab for you.', 'Load a recording, then review and accept what it found.'],
  cam: ['Optional. Your camera can follow your hand on the neck. It stays off until you start it.', 'Leave this alone unless you want it.'],
  lab: ['Measurements for people who like to dig in: timing, pitch, level, latency.', 'Press the loopback latency test to see your real delay.'],
  exp: ['Take your song out: audio, MIDI, a chord sheet, tab, or a backup of everything.', 'Use Back up all songs now and then. It is one file.']
};
function gdHintClear() { document.querySelectorAll('.gd-hint').forEach(e => e.remove()); GD.hintEl = null; }
function guideHint(id) {
  const g = gdc(); if (g.off || !GD_HINTS[id] || typeof xpLevel !== 'function' || xpLevel() === 'pro' || GD.id) return; const p = PANES[id]; if (!p || p.querySelector('.gd-hint')) return;
  const [what, tryIt] = GD_HINTS[id], name = (XP_NAMES[id] || (DOCK.find(d => d[0] === id) || [])[1] || id), seen = g.hints[id];
  const el = h('div', { class: 'gd-hint' + (seen ? ' small' : ''), role: 'note', 'data-id': id });
  const open = () => { el.className = 'gd-hint'; el.innerHTML = ''; el.append(h('div', {}, h('b', {}, name + ': '), what, ' ', h('span', { class: 'gd-try' }, 'Try: '), tryIt), h('button', { class: 'btn sm', onclick: () => { g.hints[id] = 1; saveCfg(); shut(); } }, 'Got it')); };
  const shut = () => { el.className = 'gd-hint small'; el.innerHTML = ''; el.append(h('button', { class: 'gd-info', onclick: open, title: 'What is this tab?' }, 'ⓘ What is this tab?')); };
  if (seen) shut(); else open(); p.prepend(el);
}
bus.on('dock', id => { setTimeout(() => { try { guideHint(typeof id === 'string' ? id : DOCK.cur); } catch (e) { } }, 60); });

/* ---------- the way in: the goal cards on the first page ---------- */
function guideBoot(bootStart) {
  const box = document.getElementById('bootGoals'); if (!box) return;
  box.querySelectorAll('.boot-goal').forEach(b => b.onclick = () => {
    const goal = b.dataset.goal; CFG.goal = goal; PRJ.goal = goal; saveCfg();
    if (goal === 'show') PRJ.bootDemo = false;   // the show goal makes its own demo project
    bootStart('studio');
  });
  const pro = document.getElementById('bootPro'); if (pro) pro.onclick = () => { CFG.xpMode = 'pro'; CFG.xp = 40; saveCfg(); try { rebuildTabs(); } catch (e) { } bootStart('studio'); };
}
bus.on('booted', () => { const g = gdc(); if (g.sess && GD_SESSIONS[g.sess] && !GD.id && !(CFG.goal || PRJ.goal)) setTimeout(() => guideStart(g.sess, {}), 1200); });
