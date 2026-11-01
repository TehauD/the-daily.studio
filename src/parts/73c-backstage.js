/* ============================================================
   Part 73c · BACKSTAGE (2.20; all-access in 2.23) — for people who opened the console
   The door is in the browser console (part 73b says hello there), and it is guest list only: dailyStudio.backstage() says how to get
   on it, and the password is the build this page is (the bottom-right corner, or dailyStudio.describe().build). This browser then
   has an all-access pass with a number of its own, and Backstage opens:
     · Your pass         the pass: its number, when and on which build it was issued
     · Engine room       the audio engine live, the master scope, the guitar's signal chain with what each unit adds, the worklets
     · Performance       frames a second over the last minute, long tasks, memory, the size of the page
     · Storage           what this browser keeps for the studio, where it syncs, and the studio exported as JSON
     · Event bus         every event the parts send each other, live, with a filter
     · Terminal          a small shell: studio commands, the agent tools, the rooms, the hidden pages (type help)
     · Labs              developer handles without ?debug, a performance overlay, the event bus in the console
     · Hidden pages      /backstage/ on the site: the lobby, the source map, your data raw, the API, the changelog (they check the pass too)
     · How it is made · Agent playground · Secrets
   #backstage (or #backstage/<room>) in the address opens it, and so does ↑ ↑ ↓ ↓ ← → ← → B A. Nothing here leaves the page.
   ============================================================ */
CFG.labs = Object.assign({ handles: false, perf: false, buslog: false }, CFG.labs && typeof CFG.labs === 'object' ? CFG.labs : {});
const BKS = { tm: 0, raf: 0, on: false, ev: [], evN: {}, evPause: false, fps: [], longs: 0, longMax: 0, po: null, ov: null, ovTm: 0, hist: [], hi: 0, tries: 0, k: 0, want: undefined, t0: Date.now() };
const BKS_ROOMS = ['pass', 'engine', 'perf', 'storage', 'bus', 'terminal', 'labs', 'pages', 'made', 'agent', 'secrets'];
/* the hidden pages on the site (scripts/backstage-pages.mjs writes them) */
const BKS_PAGES = [['', 'The lobby', 'Your pass, the rooms, and this build at a glance.'], ['source/', 'Source map', 'Every part of the page: what it does, how big it is, and its source.'], ['data/', 'Your data, raw', 'What this browser keeps for the studio, read straight from storage.'], ['api/', 'Console and agent API', 'window.dailyStudio, WebMCP, the tools, and this shell.'], ['changelog/', 'How it was built', 'Every release, as a timeline.']];
const bksBase = () => location.origin + location.pathname.replace(/[^/]*$/, '') + 'backstage/';

/** this browser's pass: a number of its own, the day and the build it was issued on */
function bksPass() { if (!CFG.bksPass || !CFG.bksPass.n) { CFG.bksPass = { n: 1000 + Math.floor(Math.random() * 9000), at: Date.now(), build: BUILD }; saveCfg(); } return CFG.bksPass; }
/** the door. Guest list only: the password is this page's build. Called as dailyStudio.backstage() from the console */
function backstage(word) {
  if (CFG.backstage) { const p = bksPass(); setTimeout(() => backstageOpen(), 30); return '🎭 Welcome back, pass #' + p.n + '. Backstage is open.'; }
  if (word == null || word === '') return '🎟 Backstage is guest list only. The password is the build you are running: it is in the bottom-right corner of the studio (and in dailyStudio.describe().build). Then:  dailyStudio.backstage(\'<build>\')';
  if (String(word).trim().toLowerCase() !== String(BUILD).toLowerCase()) { BKS.tries++; return '🚪 Not on the list. ' + (BKS.tries > 2 ? 'Psst: seven characters, after “build” in the bottom-right corner.' : 'Look again: the bottom-right corner.'); }
  CFG.backstage = true; const p = bksPass(); saveCfg(); secretFound('backstage', true); setTimeout(() => backstageOpen(), 30);
  return '🎭 You are on the list. All-access pass #' + p.n + ' issued to this browser. Come on in. ' + secretCount();
}

/* ---------- the event bus, tapped (only while Backstage is open, or the Labs log is on) ---------- */
const BKS_EMIT = bus.emit;
bus.emit = function (e, ...a) { if (BKS.on || CFG.labs.buslog) bksTap(e, a); return BKS_EMIT.call(this, e, ...a); };
const bksBrief = a => a.map(x => x == null ? String(x) : typeof x === 'object' ? (Array.isArray(x) ? '[' + x.length + ']' : '{' + Object.keys(x).slice(0, 4).join(',') + (Object.keys(x).length > 4 ? ',…' : '') + '}') : typeof x === 'function' ? 'ƒ' : String(x).slice(0, 40)).join(' ');
function bksTap(e, a) {
  if (CFG.labs.buslog) try { console.debug('%c[bus]%c ' + e, 'color:#7dbf9b', '', ...a); } catch (x) { }
  if (!BKS.on) return; BKS.evN[e] = (BKS.evN[e] || 0) + 1; if (BKS.evPause) return;
  BKS.ev.push({ t: performance.now(), e, a: bksBrief(a) }); if (BKS.ev.length > 300) BKS.ev.splice(0, BKS.ev.length - 300);
}
/* ---------- performance: frames a second (a sample a second), long tasks ---------- */
function bksLongTasks() { if (BKS.po || typeof PerformanceObserver !== 'function') return; try { BKS.po = new PerformanceObserver(l => l.getEntries().forEach(x => { BKS.longs++; BKS.longMax = Math.max(BKS.longMax, x.duration); })); BKS.po.observe({ type: 'longtask', buffered: true }); } catch (e) { BKS.po = null; } }
setInterval(() => { if (!BKS.on && !CFG.labs.perf) return; BKS.fps.push(FPS); if (BKS.fps.length > 60) BKS.fps.shift(); }, 1000);
const bksMem = () => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB of ' + Math.round(performance.memory.jsHeapSizeLimit / 1048576) + ' MB' : 'n/a (Chromium only)';
/* ---------- storage, and the studio as one JSON file ---------- */
async function bksStorage() {
  const o = {};
  try { const e = await navigator.storage.estimate(); o.usage = e.usage; o.quota = e.quota; } catch (x) { }
  try { o.persisted = await navigator.storage.persisted(); } catch (x) { }
  o.songs = PRJ.list.length; o.takes = PRJ.list.reduce((a, r) => a + (r.takes || []).length, 0); o.audio = PRJ.list.reduce((a, r) => a + (r.size || 0), 0);
  try { o.blobs = (await pdbKeys('blobs', '')).length; } catch (x) { o.blobs = null; }
  o.ls = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^fw\./.test(k)) o.ls.push([k, (localStorage.getItem(k) || '').length]); } } catch (x) { } o.ls.sort((a, b) => b[1] - a[1]);
  o.folder = SYNC.dir ? fsWhere() + (SYNC.perm === 'granted' ? '' : ' (needs permission)') : 'off'; o.github = ghOn() ? CFG.gh.owner + '/' + CFG.gh.repo : 'off';
  try { o.caches = typeof caches !== 'undefined' ? (await caches.keys()).join(', ') || 'none' : 'n/a'; } catch (x) { o.caches = 'n/a'; }
  o.sw = navigator.serviceWorker && navigator.serviceWorker.controller ? 'in control (works offline)' : 'not in control';
  return o;
}
async function bksExport() {
  const files = await ghLocal(), json = JSON.stringify({ format: 'the-daily-studio-export', version: 1, app: VERSION, build: BUILD, exported: new Date().toISOString(), note: 'Settings, presets, looks, scenes, notes and songs as text, the files a synced studio holds. Recordings are not in it.', files }, null, 1);
  download('the-daily-studio-' + new Date().toISOString().slice(0, 10) + '.json', json, 'application/json'); return Object.keys(files).length;
}
/* ---------- Labs ---------- */
const BKS_LABS = [['handles', 'Developer handles', 'window.__daily: every internal handle the tests use, without ?debug in the address. Poke around in the console.'], ['perf', 'Performance overlay', 'Frames a second, the frame time, the audio engine, memory and long tasks, in the bottom-left corner.'], ['buslog', 'Event bus in the console', 'Every event the parts send each other, as console.debug (turn on Verbose to see them).']];
function bksLab(k, on) {
  CFG.labs[k] = !!on; saveCfg();
  if (k === 'handles') { if (on) { if (DEV.make) DEV.make(); } else if (!/[?&]debug\b/.test(location.search)) { try { delete window.__daily; } catch (e) { window.__daily = undefined; } } }
  if (k === 'perf') bksOverlay();
  bus.emit('labs', k, !!on);
}
function bksOverlay() {
  if (!CFG.labs.perf) { if (BKS.ov) { BKS.ov.remove(); BKS.ov = null; } clearInterval(BKS.ovTm); BKS.ovTm = 0; return; }
  if (!BKS.ov) { BKS.ov = h('div', { class: 'bks-ov mono', 'aria-hidden': 'true', title: 'Backstage ▸ Labs ▸ Performance overlay' }); document.body.append(BKS.ov); }
  bksLongTasks(); clearInterval(BKS.ovTm);
  const tick = () => { if (!BKS.ov) return; const c = E.ctx, mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : '';
    BKS.ov.textContent = FPS + ' fps · ' + (FPS ? (1000 / FPS).toFixed(1) : '—') + ' ms · audio ' + (c ? c.state : 'off') + (mem ? ' · ' + mem : '') + ' · long tasks ' + BKS.longs; };
  tick(); BKS.ovTm = setInterval(tick, 500);
}

/* ---------- the terminal: a small shell for the studio ---------- */
const BKS_FUN = { sudo: 'You are already backstage. 🎸 No sudo needed here.', rm: 'Nice try. Your songs are safe (and Ctrl/⌘+Z undoes what the tools change).', hello: 'Hey 👋 Type help to see what this shell can do.', hi: 'Hey 👋 Type help.', '42': 'The answer. Now, what was the question?', coffee: '☕ This is a guitar studio. Try: play', vim: 'To exit vim, close the tab. (Kidding. This is not vim.)', make: 'make: Nothing to be done for “music”. Try: play' };
const BKS_CMDS = {
  help: ['help', 'this list'],
  clear: ['clear', 'clear the screen'],
  whoami: ['whoami', 'your pass'],
  version: ['version', 'the version, the build and what it is made of'],
  status: ['status', 'the song, the transport and the audio engine'],
  play: ['play [bar]', 'play the song (from a bar)'],
  stop: ['stop', 'stop, back to the start'],
  bpm: ['bpm <30–260>', 'set the tempo'],
  transpose: ['transpose <-11…11>', 'move the whole song'],
  look: ['look [name]', 'the visuals: list the looks, or switch'],
  theme: ['theme dark|light', 'the studio’s theme'],
  songs: ['songs', 'the songs in this browser'],
  tools: ['tools', 'the agent tools'],
  call: ['call <tool> [json]', 'call an agent tool, e.g. call get_song'],
  describe: ['describe', 'dailyStudio.describe()'],
  fps: ['fps', 'frames a second now, and over the last minute'],
  bus: ['bus [filter]', 'the latest events on the event bus'],
  storage: ['storage', 'what this browser keeps'],
  sync: ['sync [now]', 'folder and GitHub sync: where, and sync now'],
  export: ['export', 'download the studio as JSON'],
  quote: ['quote [tomorrow]', 'the quote of the day (or a peek at tomorrow’s)'],
  secrets: ['secrets', 'what you have found'],
  labs: ['labs [name on|off]', 'list the labs, or switch one'],
  room: ['room <name>', 'go to a room (ls lists them)'],
  ls: ['ls', 'the rooms and the hidden pages'],
  pages: ['pages', 'the hidden pages on the site'],
  open: ['open <page>', 'open a hidden page in a new tab'],
  history: ['history', 'what you typed'],
  uptime: ['uptime', 'how long this page has been open'],
  exit: ['exit', 'leave Backstage']
};
const bksJson = (v, n = 1600) => { const s = JSON.stringify(v, null, 1); return s.length > n ? s.slice(0, n) + '\n… (' + s.length + ' characters; the Agent playground shows it all)' : s; };
async function bksTool(name, input) { const r = await window.dailyStudio.call(name, input || {}); return r && (r.structuredContent || r); }
async function bksRun(line, out) {
  const raw = String(line || '').trim(); if (!raw) return; const [cmd, ...rest] = raw.split(/\s+/), arg = rest.join(' '), c = cmd.toLowerCase();
  if (BKS_FUN[c] != null || /^rm$|^sudo$/.test(c)) return out(BKS_FUN[c] || BKS_FUN.rm, 'fun');
  switch (c) {
    case 'help': return out(Object.values(BKS_CMDS).map(([u, d]) => u.padEnd(22) + d).join('\n') + '\n\n↑ ↓ for history, Tab to complete. A few other words work too.');
    case 'clear': return out(null, 'clear');
    case 'whoami': { const p = bksPass(); return out('All-access pass #' + p.n + ' · issued ' + new Date(p.at).toLocaleString() + ' on build ' + (p.build || BUILD) + ' · this browser'); }
    case 'version': return out('the-daily.studio v' + VERSION + ' · build ' + BUILD + '\n' + PARTS_N + ' parts · ' + LINES_N.toLocaleString('en') + ' lines · no framework · 0 runtime dependencies');
    case 'status': return out('song      ' + (S.title || 'Untitled') + (S.artist ? ' · ' + S.artist : '') + '\ntempo     ' + S.bpm + ' bpm · ' + S.ts.join('/') + '\nbars      ' + flatBars().length + ' · takes ' + TAKES.length + '\ntransport ' + (T.playing ? 'playing' : 'stopped') + (T.loop ? ' · loop' : '') + (T.metro ? ' · click' : '') + '\naudio     ' + (E.ctx ? E.ctx.state + ' · ' + E.ctx.sampleRate + ' Hz' : 'not started') + ' · input ' + (E.hasInput ? 'open' : 'none') + '\nrig       ' + (RIG.cur || '—'));
    case 'play': { const r = await bksTool('transport', Object.assign({ action: 'play' }, +arg > 0 ? { from_bar: +arg } : {})); return out(r && r.ok === false ? '✗ ' + (r.error && r.error.message || 'could not play') : '▶ playing' + (+arg > 0 ? ' from bar ' + +arg : '')); }
    case 'stop': await bksTool('transport', { action: 'stop' }); return out('■ stopped');
    case 'bpm': { if (!(+arg >= 30 && +arg <= 260)) return out('bpm takes a number from 30 to 260 (now ' + S.bpm + ')', 'err'); const r = await bksTool('set_song_details', { bpm: +arg }); return out(r && r.ok === false ? '✗ ' + r.error.message : 'tempo ' + S.bpm + ' bpm'); }
    case 'transpose': { const n = parseInt(arg, 10); if (!(n >= -11 && n <= 11) || !n) return out('transpose takes -11 to 11 semitones', 'err'); const r = await bksTool('transpose_song', { semitones: n }); return out(r && r.ok === false ? '✗ ' + r.error.message : 'moved ' + (n > 0 ? 'up ' : 'down ') + Math.abs(n) + ' · key ' + (r && r.key ? r.key : '')); }
    case 'look': { if (!arg) return out('looks: ' + VMODES.map(m => m[0]).join(' · ') + '\nnow: ' + (VZ.mode || CFG.vmode || '—')); if (!VMODES.some(m => m[0] === arg)) return out('no look called “' + arg + '”. Type look to list them.', 'err'); vzSetMode(arg); saveCfg(); return out('look: ' + (VMODES.find(m => m[0] === arg) || [])[1]); }
    case 'theme': if (!/^(dark|light)$/.test(arg)) return out('theme dark or theme light', 'err'); setTheme(arg); return out('theme: ' + arg);
    case 'songs': return out(PRJ.list.map((r, i) => String(i + 1).padStart(3) + '  ' + (r.title || 'Untitled') + ((r.takes || []).length ? ' · ' + r.takes.length + ' take' + (r.takes.length === 1 ? '' : 's') : '') + (r.id === PRJ.cur ? '   ← open' : '')).join('\n') || 'no songs yet');
    case 'tools': return out(AGT.tools.map(t => t.name.padEnd(20) + (t.annotations && t.annotations.readOnlyHint ? 'reads' : 'changes')).join('\n') + '\n\ncall <tool> [json] runs one. The Agent playground room has a form.');
    case 'call': { const m = /^(\S+)\s*([\s\S]*)$/.exec(arg); if (!m) return out('call <tool> [json], e.g. call get_key_chords', 'err'); let input = {}; if (m[2]) { try { input = JSON.parse(m[2]); } catch (e) { return out('that is not JSON: ' + e.message, 'err'); } } return out(bksJson(await bksTool(m[1], input))); }
    case 'describe': return out(bksJson(window.dailyStudio.describe()));
    case 'fps': { const a = BKS.fps.length ? BKS.fps : [FPS]; return out(FPS + ' fps now · last minute: min ' + Math.min(...a) + ', average ' + Math.round(a.reduce((x, y) => x + y, 0) / a.length) + ', max ' + Math.max(...a) + ' · long tasks ' + BKS.longs + (BKS.longMax ? ' (longest ' + Math.round(BKS.longMax) + ' ms)' : '')); }
    case 'bus': { const f = arg.toLowerCase(), list = BKS.ev.filter(x => !f || x.e.toLowerCase().includes(f)).slice(-15); return out((list.map(x => (x.t / 1000).toFixed(2).padStart(9) + 's  ' + x.e.padEnd(14) + x.a).join('\n') || 'nothing yet' + (f ? ' for “' + f + '”' : '')) + '\n\nmost sent: ' + Object.entries(BKS.evN).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => k + ' ×' + n).join(' · ')); }
    case 'storage': { const o = await bksStorage(); return out('used      ' + projBytes(o.usage || 0) + ' of ' + projBytes(o.quota || 0) + (o.persisted ? ' · kept (persistent)' : ' · may be cleared by the browser') + '\nsongs     ' + o.songs + ' · takes ' + o.takes + ' · audio about ' + projBytes(o.audio) + ' · ' + (o.blobs == null ? '?' : o.blobs) + ' stored blobs\nfolder    ' + o.folder + '\ngithub    ' + o.github + '\noffline   ' + o.sw + ' · cache ' + o.caches + '\nkeys      ' + o.ls.slice(0, 6).map(([k, n]) => k + ' ' + projBytes(n)).join(' · ')); }
    case 'sync': {
      if (arg === 'now') { const r = []; if (SYNC.dir && CFG.sync) { await fsSync('now'); r.push('folder: ' + (FS.status || 'done')); } if (ghOn()) { await ghSync('now'); r.push('github: ' + (GH.status || 'done')); } return out(r.join('\n') || 'nothing to sync with: Settings ▸ Folder sync or Settings ▸ GitHub');
      }
      return out('folder    ' + (SYNC.dir ? fsWhere() + ' · ' + (FS.status || 'ready') : 'off (Settings ▸ Folder sync)') + '\ngithub    ' + (ghOn() ? CFG.gh.owner + '/' + CFG.gh.repo + ' · ' + (GH.status || 'ready') : 'off (Settings ▸ GitHub)') + '\n\nsync now syncs both.');
    }
    case 'export': { const n = await bksExport(); return out('⤓ the studio as JSON: ' + n + ' files in one download'); }
    case 'quote': return out(eggText(eggFor(eggDay() + (arg === 'tomorrow' ? 1 : 0))) + (arg === 'tomorrow' ? '\n(tomorrow’s, for your eyes only)' : ''));
    case 'secrets': return out(SECRETS.map(([id, name, hint]) => (CFG.secrets[id] ? '✓ ' + name : '· ' + hint)).join('\n') + '\n' + secretN() + ' of ' + SECRETS.length + ' found');
    case 'labs': {
      const [k, v] = rest; if (!k) return out(BKS_LABS.map(([id, name]) => (CFG.labs[id] ? 'on   ' : 'off  ') + id.padEnd(9) + name).join('\n') + '\n\nlabs <name> on|off');
      if (!BKS_LABS.some(x => x[0] === k) || !/^(on|off)$/.test(v || '')) return out('labs <' + BKS_LABS.map(x => x[0]).join('|') + '> on|off', 'err');
      bksLab(k, v === 'on'); return out(k + ' ' + v);
    }
    case 'room': case 'cd': { const r = (arg || '').replace(/\/$/, ''); if (!BKS_ROOMS.includes(r)) return out('rooms: ' + BKS_ROOMS.join(' · '), 'err'); const d = document.getElementById('backstage'); if (d) hubGo(d, r, true); return out('→ ' + r); }
    case 'ls': return out(BKS_ROOMS.map(r => r + '/').join('  ') + '\n\npages/  (type pages)');
    case 'pages': return out(BKS_PAGES.map(([p, n, d]) => ('/backstage/' + p).padEnd(22) + n + ' · ' + d).join('\n') + '\n/humans.txt            who made this\n\nopen <page> opens one, e.g. open source');
    case 'open': { const p = BKS_PAGES.find(([x, n]) => x.replace(/\/$/, '') === arg.replace(/\/$/, '') || n.toLowerCase().startsWith(arg.toLowerCase())) || (arg === 'lobby' ? BKS_PAGES[0] : null); if (!p) return out('open ' + BKS_PAGES.map(x => x[0].replace(/\/$/, '') || 'lobby').join(' | '), 'err'); window.open(bksBase() + p[0], '_blank', 'noopener'); return out('↗ ' + bksBase() + p[0]); }
    case 'history': return out(BKS.hist.map((x, i) => String(i + 1).padStart(4) + '  ' + x).join('\n') || 'nothing yet');
    case 'uptime': { const s = Math.round((Date.now() - BKS.t0) / 1000); return out('up ' + (s >= 3600 ? Math.floor(s / 3600) + ' h ' : '') + Math.floor(s % 3600 / 60) + ' min ' + s % 60 + ' s · ' + (frameN || 0).toLocaleString('en') + ' frames drawn'); }
    case 'exit': case 'quit': case 'logout': { const d = document.getElementById('backstage'); if (d) setTimeout(() => d.close(), 350); return out('See you at soundcheck. 🎸'); }
  }
  return out('command not found: ' + cmd + ' · type help', 'err');
}
function bksTerminal() {
  const pre = h('pre', { class: 'bks-term-out mono', id: 'bksTermOut', 'aria-live': 'polite' }), inp = h('input', { class: 'bks-term-in mono', id: 'bksTermIn', autocomplete: 'off', spellcheck: false, 'aria-label': 'Backstage shell command' });
  const out = (t, cls) => { if (cls === 'clear') { pre.textContent = ''; return; } if (t == null) return; const s = h('span', { class: 'bks-t-' + (cls || 'out') }, t + '\n'); pre.append(s); while (pre.childNodes.length > 400) pre.firstChild.remove(); pre.scrollTop = pre.scrollHeight; };
  const run = async () => {
    const v = inp.value; inp.value = ''; if (!v.trim()) return; BKS.hist.push(v); if (BKS.hist.length > 100) BKS.hist.shift(); BKS.hi = BKS.hist.length;
    out('studio $ ' + v, 'cmd'); try { await bksRun(v, out); } catch (e) { out('error: ' + (e && e.message || e), 'err'); }
  };
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); run(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); BKS.hi = clamp(BKS.hi + (e.key === 'ArrowUp' ? -1 : 1), 0, BKS.hist.length); inp.value = BKS.hist[BKS.hi] || ''; }
    else if (e.key === 'Tab') { e.preventDefault(); const w = inp.value.trim(); if (!w || /\s/.test(w)) return; const all = Object.keys(BKS_CMDS).filter(k => k.startsWith(w)); if (all.length === 1) inp.value = all[0] + ' '; else if (all.length) out(all.join('  '), 'dim'); }
    e.stopPropagation();      /* the studio's own keys stay out of the shell */
  });
  out('Backstage shell · pass #' + bksPass().n + ' · v' + VERSION + ' · type help', 'dim');
  return h('div', { class: 'bks-term', onclick: e => { if (e.target === pre || e.target.closest('.bks-term')) inp.focus(); } }, pre, h('div', { class: 'bks-term-line' }, h('span', { class: 'mono bks-term-p', 'aria-hidden': 'true' }, 'studio $'), inp));
}

/* ---------- the rooms ---------- */
const bksRow = (k, v) => h('div', { class: 'bks-r' }, h('span', {}, k), h('b', { class: 'mono' }, v));
const BKS_WORKLETS = () => (String(typeof WORKLET_SRC === 'string' ? WORKLET_SRC : '').match(/registerProcessor\('([\w-]+)'/g) || []).map(m => m.slice(19, -1));
function bksChain() {
  return h('div', { class: 'bks-chain', id: 'bksChain' }, h('span', { class: 'bks-unit io' }, h('b', {}, 'Input'), h('i', { class: 'mono' }, E.hasInput ? 'open' : 'none')),
    RIG.order.map(id => { const u = RIG.units[id], name = (FX[id] && FX[id].name) || id, on = !!(u && u.on), lat = u ? u.lat() : 0;
      return h('span', { class: 'bks-unit' + (on ? ' on' : ''), title: name + (on ? ' · on' : ' · off') + ' · adds ' + (lat * 1000).toFixed(2) + ' ms' }, h('b', {}, name), h('i', { class: 'mono' }, on ? (lat * 1000).toFixed(lat ? 2 : 0) + ' ms' : 'off')); }),
    h('span', { class: 'bks-unit io' }, h('b', {}, 'Master'), h('i', { class: 'mono' }, E.ctx ? E.ctx.state : 'off')));
}
function backstageOpen(at) {
  if (!CFG.backstage) return toast('🎟 Backstage is guest list only. Developers know where to look.', '');
  const pass = bksPass(); BKS.on = true; bksLongTasks();
  const live = h('div', { class: 'bks-grid', id: 'bksLive' }), scope = h('canvas', { class: 'bks-scope', id: 'bksScope', width: 640, height: 180, role: 'img', 'aria-label': 'The master output as a waveform and a spectrum' });
  const chainBox = h('div', {}, bksChain()), perfBox = h('div', { class: 'bks-grid', id: 'bksPerf' }), spark = h('canvas', { class: 'bks-spark', id: 'bksSpark', width: 640, height: 90, role: 'img', 'aria-label': 'Frames a second over the last minute' });
  const store = h('div', { class: 'bks-grid', id: 'bksStore' }, bksRow('Reading', '…')), keys = h('div', { class: 'bks-keys mono', id: 'bksKeys' });
  const fillStore = async () => { const o = await bksStorage(); store.innerHTML = ''; keys.innerHTML = '';
    [['Used by this site', projBytes(o.usage || 0) + ' of ' + projBytes(o.quota || 0)], ['Kept when space is short', o.persisted ? 'yes (persistent)' : 'up to the browser'], ['Songs', String(o.songs)], ['Takes', o.takes + ' (about ' + projBytes(o.audio) + ' of audio)'], ['Stored blobs', o.blobs == null ? '?' : String(o.blobs)], ['Folder sync', o.folder], ['GitHub', o.github], ['Offline copy', o.sw], ['Caches', o.caches]].forEach(([k, v]) => store.append(bksRow(k, v)));
    o.ls.slice(0, 12).forEach(([k, n]) => keys.append(h('span', {}, k + ' · ' + projBytes(n)))); };
  const evList = h('div', { class: 'bks-ev mono', id: 'bksEv', 'aria-live': 'off' }), evTop = h('div', { class: 'bks-keys mono', id: 'bksEvTop' }), evFilter = h('input', { class: 'in', id: 'bksEvFilter', placeholder: 'Filter: an event name', 'aria-label': 'Filter events' });
  const evPause = h('button', { class: 'btn', id: 'bksEvPause', onclick: () => { BKS.evPause = !BKS.evPause; evPause.textContent = BKS.evPause ? '▶ Resume' : '⏸ Pause'; } }, BKS.evPause ? '▶ Resume' : '⏸ Pause');
  const tools = (window.dailyStudio && window.dailyStudio.tools()) || [], sel = h('select', { class: 'in', id: 'bksTool' }, tools.map(t => h('option', { value: t.name }, t.name)));
  const inp = h('textarea', { class: 'in mono', id: 'bksIn', rows: 4, spellcheck: false, 'aria-label': 'Input (JSON)' }), outp = h('pre', { class: 'bks-out', id: 'bksOut', 'aria-live': 'polite' }, '—');
  const example = () => { const t = tools.find(x => x.name === sel.value), s = t && t.inputSchema, o = {}; ((s && s.required) || []).forEach(k => { const p = s.properties[k] || {}; o[k] = p.enum ? p.enum[0] : p.type === 'number' || p.type === 'integer' ? 0 : p.type === 'array' ? [] : p.type === 'boolean' ? false : ''; }); inp.value = JSON.stringify(o, null, 1); };
  sel.onchange = example; example();
  const run = h('button', { class: 'btn primary', id: 'bksRun', onclick: async () => {
    let input; try { input = JSON.parse(inp.value || '{}'); } catch (e) { outp.textContent = 'That is not JSON: ' + e.message; return; }
    outp.textContent = '…'; const r = await window.dailyStudio.call(sel.value, input); outp.textContent = JSON.stringify(r.structuredContent || r, null, 2).slice(0, 20000);
  } }, '▶ Run');
  const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0], kb = v => v ? Math.round(v / 1024) + ' kB' : '?', link = (href, t) => h('a', { class: 'btn', href, target: '_blank', rel: 'noopener noreferrer' }, t);
  const d = hubOpen('backstage', { ico: '🎭', title: 'Backstage', sub: 'All access, pass #' + pass.n + '. How the studio works, live.', at, sections: [
    { key: 'pass', label: 'Your pass', ico: '🎟', wide: true, body: () => [h('div', { class: 'bks-pass', id: 'bksPass' },
      h('div', { class: 'bks-pass-top' }, h('span', { class: 'bks-pass-k' }, 'ALL ACCESS'), h('span', { class: 'bks-pass-no mono' }, '#' + pass.n)),
      h('div', { class: 'bks-pass-name' }, 'the-daily.studio · Backstage'),
      h('div', { class: 'bks-pass-m mono' }, 'Issued ' + new Date(pass.at).toLocaleDateString() + ' · build ' + (pass.build || BUILD) + ' · this browser only'),
      h('div', { class: 'bks-pass-rooms' }, BKS_ROOMS.filter(r => r !== 'pass').map(r => h('button', { type: 'button', class: 'bks-pass-room', onclick: () => hubGo(d, r, true) }, r)))),
      h('p', { class: 'small muted' }, 'Tip: the Terminal has a shell (type help), #backstage/terminal in the address opens it, and so does ↑ ↑ ↓ ↓ ← → ← → B A.')] },
    { key: 'engine', label: 'Engine room', ico: '◉', sub: 'The audio engine, live twice a second, and the guitar’s signal chain with what each unit adds.', wide: true, body: () => [live, scope, h('h4', { class: 'bks-h' }, 'Signal chain'), chainBox,
      h('p', { class: 'small muted' }, 'AudioWorklet processors: ' + BKS_WORKLETS().join(' · ') + '. With zero-delay effects on, the compressor and the shapers run in them and add no lookahead.')] },
    { key: 'perf', label: 'Performance', ico: '⏱', sub: 'Frames a second over the last minute, long tasks (over 50 ms on the main thread) and memory.', wide: true, body: () => [spark, perfBox] },
    { key: 'storage', label: 'Storage', ico: '🗄', sub: 'What this browser keeps for the studio, and where it syncs.', wide: true, body: () => [store, h('h4', { class: 'bks-h' }, 'Largest keys in local storage'), keys,
      h('div', { class: 'hub-acts' }, h('button', { class: 'btn', id: 'bksStoreRefresh', onclick: fillStore }, '⟳ Refresh'), h('button', { class: 'btn', id: 'bksExport', onclick: async () => { const n = await bksExport(); toast('The studio as JSON: ' + n + ' files.', 'ok'); } }, '⤓ Export the studio as JSON'))] },
    { key: 'bus', label: 'Event bus', ico: '⇄', sub: 'Every event the parts send each other while Backstage is open, newest first.', wide: true, body: () => [h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, evFilter, evPause, h('button', { class: 'btn', onclick: () => { BKS.ev.length = 0; BKS.evN = {}; } }, 'Clear')), evTop, evList] },
    { key: 'terminal', label: 'Terminal', ico: '›_', sub: 'A small shell for the studio. Type help.', wide: true, body: () => [bksTerminal()] },
    { key: 'labs', label: 'Labs', ico: '⚗', sub: 'Switches for developers. They stay on in this browser until you switch them off.', wide: true, body: () => BKS_LABS.map(([k, name, what]) => h('label', { class: 'chk bks-lab' }, h('input', { type: 'checkbox', id: 'bksLab-' + k, checked: !!CFG.labs[k], onchange: e => bksLab(k, e.target.checked) }), h('span', {}, h('b', {}, name), h('span', { class: 'tiny muted', style: { display: 'block' } }, what)))) },
    { key: 'pages', label: 'Hidden pages', ico: '🗝', sub: 'Pages on the site that are not linked anywhere, and check for your pass.', wide: true, body: () => [h('div', { class: 'bks-pages' }, BKS_PAGES.map(([p, n, what]) => h('a', { class: 'bks-page', href: bksBase() + p, target: '_blank', rel: 'noopener', 'data-page': p || 'lobby' }, h('b', {}, n), h('span', { class: 'tiny muted' }, what), h('span', { class: 'mono tiny' }, '/backstage/' + p))),
      h('a', { class: 'bks-page', href: location.origin + location.pathname.replace(/[^/]*$/, '') + 'humans.txt', target: '_blank', rel: 'noopener' }, h('b', {}, 'humans.txt'), h('span', { class: 'tiny muted' }, 'Who made this, and with what.'), h('span', { class: 'mono tiny' }, '/humans.txt')))] },
    { key: 'made', label: 'How it is made', ico: '⚙', wide: true, body: () => [h('div', { class: 'bks-grid' },
      bksRow('Version', 'v' + VERSION + ' · build ' + BUILD), bksRow('Made from', PARTS_N + ' parts · ' + LINES_N.toLocaleString('en') + ' lines'), bksRow('This page arrived as', nav ? kb(nav.transferSize || nav.encodedBodySize) + ' (' + kb(nav.decodedBodySize) + ' unpacked)' : '?'),
      bksRow('Framework', 'none'), bksRow('Runtime dependencies', '0'), bksRow('Requests to other sites', '0 (unless you say yes to MediaPipe, or connect GitHub)'), bksRow('Script policy', 'one inline script, allowed by its SHA-256 hash'), bksRow('Audio', 'Web Audio + ' + BKS_WORKLETS().length + ' AudioWorklet processors')),
      h('p', { class: 'small muted' }, 'The parts are plain JavaScript files concatenated in name order into one closure, minified by a dependency-free minifier that the build proves changed nothing but whitespace. The QR codes, the zero-delay compressors and the oversampling filters are written here too.'),
      h('div', { class: 'hub-acts' }, link(BRAND.repo, 'Source ↗'), link(BRAND.repo + '/blob/main/docs/ARCHITECTURE.md', 'Architecture ↗'), link(BRAND.repo + '/blob/main/docs/AGENT_API.md', 'Agent API ↗'), link(bksBase() + 'source/', 'Source map ↗'))] },
    { key: 'agent', label: 'Agent playground', ico: '🤖', sub: 'Call the same tools an AI agent gets (WebMCP and window.dailyStudio). Changes are real, and Ctrl/⌘+Z undoes them.', wide: true, body: () => [
      CFG.agents === false ? h('p', { class: 'small' }, 'Agent access is off in Settings ▸ Workflow, so calls are answered “disabled”.') : null,
      h('div', { class: 'row', style: { gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, sel, run), inp, outp].filter(Boolean) },
    { key: 'secrets', label: 'Secrets', ico: '🗝', wide: true, body: () => [secretList()] }
  ] });
  d.classList.add('bks-hub'); fillStore();
  d.addEventListener('close', () => { BKS.on = false; }, { once: true });
  /* the live numbers, the chain, performance and the event bus, twice a second */
  const paint = () => {
    if (!live.isConnected) { clearInterval(BKS.tm); BKS.tm = 0; BKS.on = false; return; }
    const c = E.ctx, ms = v => v == null ? '—' : (v * 1000).toFixed(1) + ' ms';
    live.innerHTML = '';
    [['Audio engine', c ? c.state + ' · ' + c.sampleRate + ' Hz' : 'not started'], ['One render quantum', c ? '128 frames · ' + (128 / c.sampleRate * 1000).toFixed(2) + ' ms' : '—'], ['Browser base / output latency', c ? ms(c.baseLatency) + ' / ' + ms(c.outputLatency) : '—'],
      ['Zero-delay effects', E.worklet && CFG.lowLat !== false ? 'on' : 'off'], ['Delay the rig adds', ms(rigLat())], ['Delay the vocal strip adds', ms(voxLat())], ['Measured round trip', CFG.rtt != null ? CFG.rtt + ' ms' : 'not measured'],
      ['Input', E.hasInput ? 'open' : 'none'], ['Frames a second', String(FPS)], ['JS memory', bksMem()], ['Takes in memory', String(TAKES.length)], ['Secrets found', secretN() + ' of ' + SECRETS.length]].forEach(([k, v]) => live.append(bksRow(k, v)));
    chainBox.innerHTML = ''; chainBox.append(bksChain());
    const a = BKS.fps.length ? BKS.fps : [FPS]; perfBox.innerHTML = '';
    [['Frames a second', FPS + ' now · min ' + Math.min(...a) + ' · average ' + Math.round(a.reduce((x, y) => x + y, 0) / a.length)], ['Frame time', FPS ? (1000 / FPS).toFixed(1) + ' ms (16.7 ms is 60 fps)' : '—'], ['Long tasks', BKS.po ? BKS.longs + (BKS.longMax ? ' · longest ' + Math.round(BKS.longMax) + ' ms' : '') : 'not reported by this browser'],
      ['JS memory', bksMem()], ['Elements on the page', document.getElementsByTagName('*').length.toLocaleString('en')], ['Visuals', (VMODES.find(m => m[0] === VZ.mode) || [, VZ.mode || '—'])[1]], ['Page open for', Math.round((Date.now() - BKS.t0) / 60000) + ' min']].forEach(([k, v]) => perfBox.append(bksRow(k, v)));
    const g = spark.getContext('2d'), W = spark.width, H = spark.height; g.fillStyle = '#050b0c'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(157,179,165,.25)'; g.beginPath(); g.moveTo(0, H - 60 / 75 * H); g.lineTo(W, H - 60 / 75 * H); g.stroke();
    g.strokeStyle = '#f7c95a'; g.lineWidth = 2; g.beginPath(); a.forEach((v, i) => { const x = (i + 60 - a.length) / 59 * W, y = H - clamp(v, 0, 75) / 75 * H; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    g.fillStyle = 'rgba(157,179,165,.8)'; g.font = '11px ui-monospace,Menlo,monospace'; g.fillText('fps · last minute · line at 60', 8, 14);
    const f = evFilter.value.trim().toLowerCase(), evs = BKS.ev.filter(x => !f || x.e.toLowerCase().includes(f)).slice(-60).reverse();
    evList.innerHTML = ''; evs.forEach(x => evList.append(h('div', { class: 'bks-e' }, h('span', {}, (x.t / 1000).toFixed(2) + 's'), h('b', {}, x.e), h('span', {}, x.a)))); if (!evs.length) evList.append(h('div', { class: 'tiny muted' }, 'Nothing yet. Play a song, change a setting or open a panel.'));
    evTop.innerHTML = ''; Object.entries(BKS.evN).sort((p, q) => q[1] - p[1]).slice(0, 8).forEach(([k, n]) => evTop.append(h('span', {}, k + ' ×' + n)));
  };
  const draw = () => {
    if (!scope.isConnected) { cancelAnimationFrame(BKS.raf); BKS.raf = 0; return; }
    BKS.raf = requestAnimationFrame(draw); const g = scope.getContext('2d'), W = scope.width, H = scope.height; g.fillStyle = '#050b0c'; g.fillRect(0, 0, W, H);
    const an = E.anaMaster; if (!an) return; const n = an.fftSize, td = BKS.td && BKS.td.length === n ? BKS.td : (BKS.td = new Float32Array(n)), fd = BKS.fd && BKS.fd.length === an.frequencyBinCount ? BKS.fd : (BKS.fd = new Float32Array(an.frequencyBinCount));
    an.getFloatTimeDomainData(td); an.getFloatFrequencyData(fd);
    g.fillStyle = 'rgba(61,220,132,.28)'; const bins = 96; for (let i = 0; i < bins; i++) { const k = Math.floor(Math.pow(i / bins, 2) * fd.length * .5) + 1, v = clamp((fd[k] + 100) / 80, 0, 1); g.fillRect(i * W / bins, H - v * H * .9, W / bins - 1, v * H * .9); }
    g.strokeStyle = '#3ddc84'; g.lineWidth = 1.5; g.beginPath(); const step = Math.max(1, Math.floor(n / W)); for (let x = 0; x < W; x++) { const v = td[Math.min(n - 1, x * step)] || 0; const y = H / 2 - v * H * .45; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    g.fillStyle = 'rgba(157,179,165,.8)'; g.font = '11px ui-monospace,Menlo,monospace'; g.fillText('master · ' + (E.ctx ? E.ctx.sampleRate : '') + ' Hz', 8, 14);
  };
  clearInterval(BKS.tm); paint(); BKS.tm = setInterval(paint, 500); cancelAnimationFrame(BKS.raf); draw();
  if (at === 'terminal') setTimeout(() => { const i = document.getElementById('bksTermIn'); if (i) i.focus(); }, 300);
  return d;
}

/* ---------- other ways in: the address (#backstage, #backstage/<room>) and ↑↑↓↓←→←→BA ---------- */
function bksFromHash() {
  const m = /^#backstage(?:\/([\w-]+))?$/.exec(location.hash || ''); if (!m) return false;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
  BKS.want = m[1] && BKS_ROOMS.includes(m[1]) ? m[1] : null;
  const go = () => { const w = BKS.want; if (w === undefined) return; BKS.want = undefined; if (CFG.backstage) backstageOpen(w || undefined); else toast('🎟 Backstage is guest list only. The door is in the browser console.', ''); };
  if (document.getElementById('boot')) bus.on('booted', () => setTimeout(go, 400)); else setTimeout(go, 600);
  return true;
}
/** part 10 calls this at start-up */
function bksBoot() { if (CFG.labs.perf) bksOverlay(); bksFromHash(); }
window.addEventListener('hashchange', () => { bksFromHash(); });
const BKS_KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
document.addEventListener('keydown', e => {
  const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) { BKS.k = 0; return; }
  const key = e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key, near = BKS.k >= 8;
  BKS.k = key === BKS_KONAMI[BKS.k] ? BKS.k + 1 : key === BKS_KONAMI[0] ? 1 : 0;
  if (near && (key === 'b' || key === 'a')) { e.preventDefault(); e.stopPropagation(); }      /* B and A finish the code here, not the bass and the rest */
  if (BKS.k === BKS_KONAMI.length) { BKS.k = 0; if (CFG.backstage) backstageOpen('terminal'); else toast('🎟 Nice moves. Backstage is guest list only, and the door is in the browser console.', ''); }
}, true);
