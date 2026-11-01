/* ============================================================
   Part 73b · SECRETS (2.20) — small surprises for people who look, and a door backstage for developers
   · Tuned to perfection   all six open strings within ±2 cents of true, one after another (the tuner the studio already has)
   · In the pocket         sixteen notes in a row within 10 ms of the beat while the song plays (the timing analysis already there)
   · The hidden line       triple-click the version tag (part 73)
   · Up and down           any scale up and back down, anywhere the tuner hears it: opens modes and more scales in Shower mode (part 73d)
   · Broken chords         three of the band's chords in a row broken into notes (root, third, fifth) while the song plays: opens seventh arpeggios
   · Golden ear            ten intervals in a row by ear in Shower mode, from six choices or more: opens chord qualities by ear
   · Backstage pass        the browser console says hello to developers and points at dailyStudio.backstage(): guest list only,
                           and the password is the build (part 73c has the door, the pass and the rooms)
   A small 🗝 counter next to the version shows how many have been found, once the first one has. The rules: nothing fires while a take
   or a video is recording, nothing flashes (Calm and reduced motion get no glow), nothing loads or leaves the page, and Settings ▸
   Workflow ▸ Hidden surprises turns the musical ones off. Found secrets are remembered in this browser (CFG.secrets).
   ============================================================ */
const SECRETS = [
  ['line', 'The hidden line', 'Some numbers want to be clicked three times.', 'Triple-click the version tag: a quote of the day from someone in history wakes up at the bottom of the page.'],
  ['tuned', 'Tuned to perfection', 'Six strings, two cents.', 'All six open strings within ±2 cents of true, one after another.'],
  ['pocket', 'In the pocket', 'Sixteen notes, right on time.', 'Sixteen notes in a row within 10 ms of the beat while the song plays.'],
  ['scale', 'Up and down', 'Every note, there and back. Anywhere I can hear you.', 'Played a whole scale up and back down.', 'Modes and more scales are open in Shower mode. 🚿'],
  ['arp', 'Broken chords', 'The band plays the chords. You take them apart.', 'Broke three of the band’s chords in a row into their notes while the song played.', 'Seventh arpeggios are open in Shower mode. 🚿'],
  ['ear', 'Golden ear', 'Ten in a row, by ear, somewhere steamy.', 'Named ten intervals in a row by ear in Shower mode.', 'Chord qualities by ear are open in Shower mode. 🚿'],
  ['backstage', 'Backstage pass', 'Developers know where to look.', 'Read the note in the browser console, knocked, and knew the password.']
];
CFG.secrets = CFG.secrets && typeof CFG.secrets === 'object' ? CFG.secrets : {};
const SEC = { tuned: {}, tunedT0: 0, hold: { i: -1, t: 0 }, pocket: 0, chips: [] };
const secretsOn = () => CFG.eggs !== false;
const secretBusy = () => !!(REC || (typeof SREC !== 'undefined' && SREC.on));      /* never while a take or a video records */
const secretN = () => SECRETS.filter(s => CFG.secrets[s[0]]).length;
const secretCount = () => '(Secret ' + secretN() + ' of ' + SECRETS.length + '.)';
const secretCalm = () => CFG.reduce || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || (typeof lxComfort === 'function' && lxComfort().calm);
/** mark a secret found; true the first time. quiet: the caller says so itself */
function secretFound(id, quiet) {
  if (CFG.secrets[id] || (!secretsOn() && id !== 'backstage')) return false;
  const s = SECRETS.find(x => x[0] === id); if (!s) return false;
  CFG.secrets[id] = Date.now(); saveCfg(); secretSync(); bus.emit('secret', id);
  if (!quiet) { toast(h('span', { class: 'egg-toast' }, ({ tuned: '🎯 ', pocket: '🥁 ', scale: '🎼 ', arp: '🎸 ', ear: '👂 ' }[id] || '🗝 ') + s[1] + '. ', h('span', { class: 'muted' }, (s[4] || s[2]) + ' ' + secretCount())), 'ok'); secretGlow(); }      /* a secret that opens a treasure says what it opened */
  return true;
}
/** a soft gold glow from the edges, for two seconds (not with Calm or reduced motion) */
function secretGlow() {
  if (secretCalm()) return; const g = h('div', { class: 'egg-glow', 'aria-hidden': 'true' }); document.body.append(g); setTimeout(() => g.remove(), 2400);
}
/** the 🗝 counter beside the version tags (hidden until the first secret is found, and when hidden surprises are off) */
function secretChip(cls) {
  const c = h('button', { type: 'button', class: 'secret-chip ' + (cls || ''), title: 'Secrets found', onclick: () => secretsOpen() }); SEC.chips.push(c); secretSync(); return c;
}
function secretSync() {
  const n = secretN(); SEC.chips = SEC.chips.filter(c => c.isConnected || !c.parentNode);
  SEC.chips.forEach(c => { c.textContent = '🗝 ' + n + '/' + SECRETS.length; c.hidden = !n || !secretsOn(); c.setAttribute('aria-label', n + ' of ' + SECRETS.length + ' secrets found'); });
}
/** the list: what has been found, and a hint for the rest */
function secretList() {
  return h('div', { class: 'secret-list' }, SECRETS.map(([id, name, hint, how]) => { const at = CFG.secrets[id];
    return h('div', { class: 'secret-row' + (at ? ' found' : ''), 'data-secret': id }, h('span', { class: 'secret-i', 'aria-hidden': 'true' }, at ? '🗝' : '?'),
      h('div', {}, h('b', {}, at ? name : '???'), h('div', { class: 'tiny muted' }, at ? how + ' Found ' + new Date(at).toLocaleDateString() + '.' : hint))); }));
}
function secretsOpen() { pdlg('secretsDlg', 'SECRETS · ' + secretN() + ' OF ' + SECRETS.length, h('div', {}, secretList(), h('p', { class: 'tiny muted', style: { marginTop: '10px' } }, 'Settings ▸ Workflow ▸ Hidden surprises turns these off.'))); }

/* ---------- Tuned to perfection: each open string held within ±2 cents for a moment, all six inside three minutes ---------- */
setInterval(() => {
  if (!secretsOn() || CFG.secrets.tuned || !E.ready || secretBusy() || !AN.active || AN.midi == null || (CFG.anSrc || 'g') === 'v') { SEC.hold.i = -1; return; }
  const now = performance.now(), open = S.tuning || [];
  if (SEC.tunedT0 && now - SEC.tunedT0 > 180000) { SEC.tuned = {}; SEC.tunedT0 = 0; }
  const i = open.indexOf(AN.midi);
  if (i < 0 || Math.abs(AN.cents) > 2) { SEC.hold.i = -1; return; }
  if (SEC.hold.i !== i) { SEC.hold = { i, t: now }; return; }
  if (now - SEC.hold.t < 350 || SEC.tuned[i]) return;
  SEC.tuned[i] = 1; if (!SEC.tunedT0) SEC.tunedT0 = now;
  if (open.every((_, k) => SEC.tuned[k])) { secretFound('tuned'); SEC.tuned = {}; SEC.tunedT0 = 0; }
}, 100);
/* ---------- In the pocket: sixteen notes in a row within 10 ms of the beat ---------- */
function secretTiming(ms) {
  if (!secretsOn() || CFG.secrets.pocket || !T.playing || secretBusy()) { SEC.pocket = 0; return; }
  SEC.pocket = Math.abs(ms) <= 10 ? SEC.pocket + 1 : 0;
  if (SEC.pocket >= 16) { SEC.pocket = 0; secretFound('pocket'); }
}
bus.on('timing', secretTiming);
/* ---------- Up and down, and Broken chords: out in the studio, by the notes the tuner hears (2.25) ---------- */
/** each note, once, when it has been held a moment: the last twenty */
setInterval(() => {
  if (!secretsOn() || !E.ready || secretBusy()) { SEC.held = null; return; }
  const m = AN.active && AN.midi != null ? AN.midi : null, now = performance.now();
  if (m == null) { SEC.held = null; return; }
  if (!SEC.held || SEC.held.m !== m) { SEC.held = { m, t: now, done: false }; return; }
  if (SEC.held.done || now - SEC.held.t < 110) return; SEC.held.done = true; secretNote(m);
}, 40);
/** a note heard: is it the end of a scale up and back down, or a chord of the band's broken into notes? */
function secretNote(m) {
  const L = SEC.notes = (SEC.notes || []).concat(m).slice(-20);
  if (!CFG.secrets.scale) for (const name of (typeof WS_BASE !== 'undefined' ? WS_BASE : [])) {      /* the scale, up from its root to the octave and back, exactly */
    const iv = SCALES[name], n = iv.length * 2 + 1; if (L.length < n) continue; const w = L.slice(-n), up = w.slice(0, iv.length + 1), down = w.slice(iv.length);
    if (up.every((x, i) => x - up[0] === (i < iv.length ? iv[i] : 12)) && down.every((x, i) => x === up[up.length - 1 - i])) { secretFound('scale'); SEC.notes = []; break; }
  }
  if (!CFG.secrets.arp && T.playing) secretArp(m);
}
/** the chord playing now: the bar's chord, or the last one before it */
function secretChordNow() { const bars = flatBars(), i = Math.floor(playheadSlot() / spb()); for (let k = Math.min(i, bars.length - 1); k >= 0; k--) if (bars[k].bar.chord) return bars[k].bar.chord; return null; }
function secretArp(m, sym) {
  sym = sym || secretChordNow(); const a = SEC.arp || (SEC.arp = { sym: null, k: 0, n: 0 });
  if (sym !== a.sym) { a.n = a.k >= 3 ? a.n + 1 : 0; a.sym = sym; a.k = 0; }      /* a new chord: the last one counts only if it was broken whole */
  const c = sym && parseChord(sym); if (!c) return;
  const third = c.iv.find(i => i === 3 || i === 4) ?? c.iv.find(i => i === 2 || i === 5) ?? 4, fifth = c.iv.find(i => i === 7) ?? c.iv.find(i => i === 6 || i === 8) ?? 7, want = [c.root, (c.root + third) % 12, (c.root + fifth) % 12];
  if (a.k < 3 && ((m % 12) + 12) % 12 === want[a.k]) a.k++;
  if (a.k >= 3 && a.n + 1 >= 3) { secretFound('arp'); SEC.arp = null; }
}
bus.on('transport', () => { if (!T.playing) SEC.pocket = 0; });

/* ---------- a word for developers, in the console ---------- */
try {
  console.log('%c the-daily.studio %c v' + VERSION + ' · build ' + BUILD + ' ', 'background:#1f8a56;color:#fff;font:700 14px system-ui,sans-serif;padding:4px 8px;border-radius:6px 0 0 6px', 'background:#0b100e;color:#7dbf9b;font:600 12px ui-monospace,Menlo,monospace;padding:5px 8px;border-radius:0 6px 6px 0');
  console.log('%cHey, you opened the console. 🎸 Respect.\n%cNo framework, no tracking, nothing kept on a server: one HTML file made from ' + PARTS_N + ' plain JavaScript parts (' + LINES_N.toLocaleString('en') + ' lines), a hand-made minifier, a QR encoder and a lot of Web Audio. The source is at ' + BRAND.repo + '\n\nThere is a door backstage for people like you. Knock:  %cdailyStudio.backstage()',
    'font:700 13px system-ui,sans-serif', 'font:12px/1.5 system-ui,sans-serif;color:#9db3a5', 'font:700 12px ui-monospace,Menlo,monospace;color:#f7c95a;background:#1b130d;padding:2px 6px;border-radius:4px');
} catch (e) { }
/* Backstage itself (the door, the pass and its rooms) is part 73c. */
