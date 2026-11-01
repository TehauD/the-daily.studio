/* ============================================================
   Part 73b · SECRETS (2.20) — small surprises for people who look, and a door backstage for developers
   · Tuned to perfection   all six open strings within ±2 cents of true, one after another (the tuner the studio already has)
   · In the pocket         sixteen notes in a row within 10 ms of the beat while the song plays (the timing analysis already there)
   · The hidden line       triple-click the version tag (part 73)
   · Up and down           a whole scale up and back down in the Woodshed without a wrong note (part 73d): opens modes and more scales
   · Broken chords         the arpeggios of a progression of three chords or more, no wrong note: opens seventh arpeggios
   · Golden ear            ten intervals in a row by ear, from six choices or more: opens chord qualities by ear
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
  ['scale', 'Up and down', 'In the Woodshed: every note, there and back.', 'Ran a whole scale up and back down in the Woodshed without a wrong note.', 'Modes and more scales are open in the Woodshed.'],
  ['arp', 'Broken chords', 'In the Woodshed: three chords or more, one note at a time.', 'Played the arpeggios of a whole progression in the Woodshed without a wrong note.', 'Seventh arpeggios are open in the Woodshed.'],
  ['ear', 'Golden ear', 'In the Woodshed: ten in a row, by ear.', 'Named ten intervals in a row by ear in the Woodshed.', 'Chord qualities by ear are open in the Woodshed.'],
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
bus.on('transport', () => { if (!T.playing) SEC.pocket = 0; });

/* ---------- a word for developers, in the console ---------- */
try {
  console.log('%c the-daily.studio %c v' + VERSION + ' · build ' + BUILD + ' ', 'background:#1f8a56;color:#fff;font:700 14px system-ui,sans-serif;padding:4px 8px;border-radius:6px 0 0 6px', 'background:#0b100e;color:#7dbf9b;font:600 12px ui-monospace,Menlo,monospace;padding:5px 8px;border-radius:0 6px 6px 0');
  console.log('%cHey, you opened the console. 🎸 Respect.\n%cNo framework, no tracking, nothing kept on a server: one HTML file made from ' + PARTS_N + ' plain JavaScript parts (' + LINES_N.toLocaleString('en') + ' lines), a hand-made minifier, a QR encoder and a lot of Web Audio. The source is at ' + BRAND.repo + '\n\nThere is a door backstage for people like you. Knock:  %cdailyStudio.backstage()',
    'font:700 13px system-ui,sans-serif', 'font:12px/1.5 system-ui,sans-serif;color:#9db3a5', 'font:700 12px ui-monospace,Menlo,monospace;color:#f7c95a;background:#1b130d;padding:2px 6px;border-radius:4px');
} catch (e) { }
/* Backstage itself (the door, the pass and its rooms) is part 73c. */
