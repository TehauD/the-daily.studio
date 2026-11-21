/* ============================================================
   Part 73d · BACKSTAGE, EVERYWHERE (2.84)
   Backstage (part 73c) was a room you went to. Once you are on the list it now comes with you:
     · The console toolkit    `studio` in the browser's DevTools console: every Backstage command as a function (studio.status(), studio.bpm(96)),
                              plus the ones made for the console (studio.sketch(), studio.render(), studio.listen(), studio.song(), studio.perf()).
     · The command palette    Ctrl/⌘ + K, from anywhere in the studio: jump to a panel, switch a look, load a beat or a song, run a command.
     · The terminal drawer    Ctrl + ` slides the Backstage shell up from the bottom of whatever you are doing.
     · Agent activity         what an AI agent changes, one quiet line in the console.
   All of it is off until you have found Backstage (the pass), and one switch turns it all off again: Settings ▸ Backstage (which is itself
   only there once you are on the list), with a switch for each piece. Nothing here leaves the page.
   ============================================================ */
CFG.bks = Object.assign({ on: true, palette: true, drawer: true, console: true, agentlog: true }, CFG.bks && typeof CFG.bks === 'object' ? CFG.bks : {});
const BKS_PIECES = [['palette', 'Command palette', 'Ctrl/⌘ K from anywhere: jump to a panel, switch a look, load a beat or a song, run a command.'], ['drawer', 'Terminal drawer', 'Ctrl + ` slides the Backstage shell up from the bottom, over whatever you are doing.'], ['console', 'Console toolkit', '`studio` in the browser’s DevTools console: every Backstage command as a function, and more.'], ['agentlog', 'Agent activity in the console', 'One quiet line for each change an AI agent makes.']];
const bksSay = (t, cls) => { if (cls === 'clear') return console.clear(); if (t == null) return; console.log('%c' + t, cls === 'err' ? 'color:#ff8a7a' : cls === 'dim' ? 'color:#7e9288' : cls === 'fun' ? 'color:#f7c95a' : 'color:inherit'); };
const bksWait = ms => new Promise(r => setTimeout(r, ms));
const bksKV = s => { const o = {}; const body = String(s || '').replace(/\b(\w+)=("[^"]*"|\S+)/g, (_, k, v) => { o[k] = v.replace(/^"|"$/g, ''); return ''; }).trim(); return { o, body }; };
const bksFail = r => r && r.error ? r.error.message || String(r.error) : null;

/* ---------- commands made for the console and the palette (the shell in part 73c finds them here first) ---------- */
const BKS_X = {
  guide: async (a, out) => { const g = await bksTool('get_music_guide'); out(['beats       ' + g.beats.map(b => b.id).join(' · '), 'patterns    ' + g.drum_patterns.join(' · '), 'kits        ' + g.drum_kits.join(' · '), 'bass        ' + g.bass_styles.join(' · '), 'keys        ' + g.keys_sounds.join(' · '), '', g.how_to.join('\n')].join('\n')); },
  sketch: async (a, out) => {
    const { o, body } = bksKV(a); if (!body) return out('sketch <chords> [| more chords…] [bpm=96] [beat=lofi] [title="…"]\ne.g.  sketch Am F C G | F C G Am bpm=96 beat=lofi', 'err');
    const names = ['Verse', 'Chorus', 'Bridge', 'Outro'], text = body.split('|').map(s => s.trim()).filter(Boolean).map((p, i) => '[' + (names[i] || 'Part ' + (i + 1)) + ']\n' + p).join('\n');
    let r = await bksTool('load_chord_sheet', Object.assign({ text }, o.title ? { title: o.title } : {})); if (bksFail(r)) return out('✗ ' + bksFail(r), 'err');
    if (o.beat) { r = await bksTool('set_band', { beat: o.beat }); if (bksFail(r)) out('✗ ' + bksFail(r), 'err'); } if (o.bpm) { r = await bksTool('set_song_details', { bpm: +o.bpm }); if (bksFail(r)) out('✗ ' + bksFail(r), 'err'); }
    out('♪ ' + S.sections.length + ' section' + (S.sections.length === 1 ? '' : 's') + ', ' + totalBars() + ' bars at ' + S.bpm + ' bpm in ' + agKeyName(S.key, S.minor) + '. play to hear it.');
  },
  drums: async (a, out) => {
    const { o, body } = bksKV(a); if (!body && !Object.keys(o).length) return out('drums <pattern name> | drums kick=X...x... snare=....X... hat=x.x.x.x. [kit=Rock Room]\npatterns: ' + Object.keys(DPATS).join(' · '), 'err');
    const grid = {}, inp = {}; Object.entries(o).forEach(([k, v]) => { if (k === 'kit') inp.kit = v; else grid[k] = v; }); if (Object.keys(grid).length) inp.grid = grid; if (body) inp.pattern = Object.keys(DPATS).find(n => n.toLowerCase() === body.toLowerCase()) || body;
    const r = await bksTool('write_drums', inp); if (bksFail(r)) return out('✗ ' + bksFail(r), 'err'); out(Object.entries(r.grid).map(([k, v]) => k.padEnd(9) + v).join('\n') + '\nkit       ' + r.kit);
  },
  render: async (a, out) => {
    out('rendering…', 'dim'); const r = await bksTool('render_audio', { tail: 1 }); if (bksFail(r)) return out('✗ ' + bksFail(r), 'err');
    out([r.duration_s + ' s · ' + r.loudness_lufs + ' LUFS · true peak ' + r.true_peak_dbfs + ' dBFS · crest ' + r.crest_db + ' dB', 'balance   low ' + r.balance_percent.low_under_250hz + '% · mid ' + r.balance_percent.mid + '% · high ' + r.balance_percent.high_over_4khz + '%'].concat((r.sections || []).map(s => ('  ' + s.name).padEnd(16) + (s.loudness_lufs == null ? '—' : s.loudness_lufs + ' LUFS') + '  energy ' + s.energy), r.hints.length ? ['', ...r.hints.map(h => '• ' + h)] : ['', '• no problems found']).join('\n'));
    return r;
  },
  save: async (a, out) => {
    out('rendering the WAV…', 'dim'); const o = await window.dailyStudio.render({ bits: /24/.test(a) ? 24 : 16 }), bin = atob(o.wav_base64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    download((S.title || 'song').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-') + '.wav', new Blob([u], { type: 'audio/wav' })); out('⤓ ' + (o.bytes / 1e6).toFixed(1) + ' MB, ' + o.seconds + ' s, ' + o.bits + '-bit');
  },
  listen: async (a, out) => {
    const sec = clamp(+a || 20, 3, 120); if (!(AN && AN.active)) out('Nothing is connected to listen to: connect an input (or play the song) first.', 'dim'); let last = '', end = performance.now() + sec * 1000; out('listening for ' + sec + ' s…', 'dim');
    while (performance.now() < end) { await bksWait(350); const pc = AN.active && AN.midi != null ? agNoteName(Math.round(AN.midi)) : '—', ch = AN.chord && AN.chord[0] ? AN.chord[0].sym : '—', k = AN.key && AN.key[0] ? pcName(AN.key[0].root) + (AN.key[0].minor ? 'm' : '') : '—', line = 'note ' + pc.padEnd(4) + ' chord ' + ch.padEnd(7) + ' key ' + k; if (line !== last) { out(line); last = line; } }
    out('done.', 'dim');
  },
  perf: async (a, out) => { const f = BKS.fps.length ? BKS.fps : [FPS]; out(['frames      ' + FPS + ' fps (min ' + Math.min(...f) + ', max ' + Math.max(...f) + ')', 'long tasks  ' + BKS.longs + ' (worst ' + Math.round(BKS.longMax) + ' ms)', 'audio       ' + (E.ctx ? E.ctx.state + ' · ' + E.ctx.sampleRate + ' Hz · ' + Math.round((E.ctx.baseLatency || 0) * 1000) + ' ms base latency' : 'off'), 'memory      ' + bksMem()].join('\n')); },
  song: async (a, out) => { out(S.sections.map((s, i) => ((i + 1) + ' ' + s.name).padEnd(16) + s.bars.map(b => b.chord || '·').join(' ') + '   energy ' + secEnergy(s)).join('\n') + '\n\n' + (S.title || 'Untitled') + ' · ' + agKeyName(S.key, S.minor) + ' · ' + S.bpm + ' bpm · ' + totalBars() + ' bars'); }
};
Object.assign(BKS_CMDS, {
  guide: ['guide', 'everything you can choose from when making music: beats, patterns, kits, sounds'],
  sketch: ['sketch <chords> [| …]', 'a song from chords in one line: sketch Am F C G | F C G Am bpm=96 beat=lofi'],
  drums: ['drums <pattern> | kick=…', 'a drum pattern, or your own grid: drums kick=X...x... snare=....X...'],
  render: ['render', 'mix the song faster than it plays and measure it: loudness, balance, sections, advice'],
  save: ['save [24]', 'download the mix as a WAV'],
  listen: ['listen [seconds]', 'what the studio hears: note, chord, key'],
  perf: ['perf', 'frames, long tasks, audio and memory at a glance'],
  song: ['song', 'the sections, the chords and their energy']
});

/* ---------- the console toolkit: `studio` ---------- */
function bksConsoleSync() {
  const on = bksOn('console'); try { if (!on) { delete window.studio; return; } } catch (e) { return; }
  if (window.studio) return;
  const T_ = {}, run = async (line) => { try { return await bksRun(line, bksSay); } catch (e) { bksSay('error: ' + (e && e.message || e), 'err'); } };
  Object.keys(BKS_CMDS).forEach(c => { if (!/^(clear|exit|history|whoami|room|ls)$/.test(c)) T_[c] = (...a) => run(c + ' ' + a.join(' ')); });
  T_.help = () => { console.log('%c studio %c  the Backstage toolkit', 'background:#f7c95a;color:#1b130d;font:700 12px ui-monospace,monospace;padding:2px 6px;border-radius:4px 0 0 4px', 'color:#7e9288;font:12px system-ui'); console.table(Object.fromEntries(Object.entries(BKS_CMDS).filter(([c]) => T_[c]).map(([c, [u, d]]) => ['studio.' + c.padEnd(10) + '()', { 'what it does': d, usage: u }]))); console.log('%cArguments are plain text: studio.bpm(96) · studio.sketch("Am F C G", "bpm=96") · studio.call("get_song") · studio.run("labs perf on").  Ctrl/⌘ K is the palette, Ctrl + ` the terminal.', 'color:#7e9288'); };
  T_.run = line => run(String(line || ''));
  T_.sketch = (...a) => run('sketch ' + a.join(' '));
  T_.render = async () => { const r = await BKS_X.render('', bksSay); if (r) console.table(r.sections || []); return r; };
  T_.call = (n, i) => bksTool(n, i); T_.song = () => run('song'); T_.state = () => ({ song: agSong(false), band: S.band, cfg: CFG });
  T_.off = () => { CFG.bks.on = false; saveCfg(); bksSync(); return 'Backstage everywhere is off (Settings ▸ Backstage turns it back on).'; };
  T_.toString = () => 'studio: the Backstage toolkit. studio.help()';
  try { Object.defineProperty(window, 'studio', { configurable: true, enumerable: false, writable: false, value: Object.freeze(T_) }); } catch (e) { }
}

/* ---------- the command palette: Ctrl/⌘ K ---------- */
const BKP = { el: null, items: [], sel: 0, hits: [] };
function bkpItems() {
  const a = [], go = (label, hint, fn) => a.push({ label, hint, run: fn });
  DOCK.forEach(([id, name]) => go('Go to ' + name, 'panel', () => dockGo(id)));
  VMODES.forEach(([id, name]) => go('Look: ' + name, 'visuals', () => { dockGo('vis'); vzSetMode(id); }));
  BEATS.forEach(b => go('Beat: ' + b.name, b.bpm + ' bpm · ' + b.feel, () => bksRun('call set_band {"beat":"' + b.id + '"}', bksSay)));
  PRJ.list.forEach(r => go('Open: ' + (r.title || 'Untitled'), 'song', () => projLoad(r.id)));
  go('Play / stop', 'transport', () => (T.playing ? bksRun('stop', bksSay) : bksRun('play', bksSay))); go('Undo', 'edit', () => { try { undo(); } catch (e) { } });
  go('Theme: dark', 'appearance', () => setTheme('dark')); go('Theme: light', 'appearance', () => setTheme('light'));
  Object.entries(BKS_CMDS).forEach(([c, [u, d]]) => go('> ' + u, d, null)); a.forEach(x => { x.k = (x.label + ' ' + x.hint).toLowerCase(); }); return a;
}
function bkpOpen() {
  if (!bksOn('palette')) return; if (BKP.el) return bkpClose();
  BKP.items = bkpItems(); BKP.sel = 0;
  const inp = h('input', { class: 'bkp-in mono', id: 'bkpIn', placeholder: 'Jump to a panel, a look, a beat, a song, or type a command…', autocomplete: 'off', spellcheck: false, 'aria-label': 'Backstage command palette', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'bkpList' }), list = h('div', { class: 'bkp-list', id: 'bkpList', role: 'listbox' }), outp = h('pre', { class: 'bkp-out mono', role: 'log', 'aria-live': 'polite' });
  const draw = () => {
    const q = inp.value.trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean); BKP.hits = (q ? BKP.items.filter(x => words.every(w => x.k.includes(w))) : BKP.items.slice(0, 40)).slice(0, 40); BKP.sel = clamp(BKP.sel, 0, Math.max(0, BKP.hits.length - 1));
    list.replaceChildren(...BKP.hits.map((x, i) => h('div', { class: 'bkp-it' + (i === BKP.sel ? ' on' : ''), role: 'option', 'aria-selected': String(i === BKP.sel), onmousedown: e => { e.preventDefault(); BKP.sel = i; go(); } }, h('span', {}, x.label), h('em', {}, x.hint))));
    if (!BKP.hits.length && q) list.replaceChildren(h('div', { class: 'bkp-it on' }, h('span', {}, 'Run “' + q + '” as a command'), h('em', {}, 'Enter')));
    const on = list.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  };
  const go = async () => {
    const x = BKP.hits[BKP.sel], q = inp.value.trim(); outp.textContent = '';
    const out = (t, cls) => { if (cls === 'clear') { outp.textContent = ''; return; } if (t != null) outp.textContent += t + '\n'; };
    if (x && x.run) { bkpClose(); try { await x.run(); } catch (e) { toast('Could not: ' + (e.message || e), 'bad'); } return; }
    const line = x && !x.run ? x.label.slice(2).split(/[ <\[|]/)[0] + (q.includes(' ') ? ' ' + q.split(/\s+/).slice(1).join(' ') : '') : q; if (!line) return;
    try { await bksRun(line, out); } catch (e) { out('error: ' + (e.message || e), 'err'); }
  };
  inp.addEventListener('input', () => { BKP.sel = 0; draw(); });
  inp.addEventListener('keydown', e => {
    e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); bkpClose(); } else if (e.key === 'ArrowDown') { e.preventDefault(); BKP.sel = Math.min(BKP.hits.length - 1, BKP.sel + 1); draw(); } else if (e.key === 'ArrowUp') { e.preventDefault(); BKP.sel = Math.max(0, BKP.sel - 1); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); go(); } else if (e.key === 'Tab') { e.preventDefault(); const x = BKP.hits[BKP.sel]; if (x && !x.run) inp.value = x.label.slice(2).split(/[<\[|]/)[0].trim() + ' '; draw(); }
  });
  BKP.el = h('div', { class: 'bkp', id: 'bkp', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette', onmousedown: e => { if (e.target === BKP.el) bkpClose(); } }, h('div', { class: 'bkp-box' }, h('div', { class: 'bkp-top mono' }, '🎭 Backstage', h('span', { class: 'muted' }, '  Esc to close · ↑ ↓ · Enter')), inp, list, outp));
  document.body.append(BKP.el); draw(); inp.focus();
}
function bkpClose() { if (BKP.el) { BKP.el.remove(); BKP.el = null; } }

/* ---------- the terminal drawer: Ctrl + ` ---------- */
const BKD = { el: null };
function bkdToggle(open) {
  if (!bksOn('drawer')) return; const want = open == null ? !BKD.el : !!open;
  if (!want) { if (BKD.el) { BKD.el.remove(); BKD.el = null; document.body.classList.remove('bkd-open'); } return; } if (BKD.el) return;
  BKD.el = h('section', { class: 'bkd', id: 'bkd', 'aria-label': 'Backstage terminal' }, h('div', { class: 'bkd-bar mono' }, h('b', {}, '🎭 studio $'), h('span', { class: 'muted' }, 'Ctrl + ` closes'), h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Close the terminal', onclick: () => bkdToggle(false) }, '✕')), bksTerminal('bkdTerm'));
  document.body.append(BKD.el); document.body.classList.add('bkd-open'); const i = BKD.el.querySelector('input'); if (i) i.focus();
}
const bksTyping = e => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); };
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k' && bksOn('palette')) { e.preventDefault(); e.stopPropagation(); bkpOpen(); }
  else if (e.ctrlKey && !e.metaKey && !e.altKey && (e.key === '`' || e.code === 'Backquote') && bksOn('drawer')) { e.preventDefault(); e.stopPropagation(); bkdToggle(); }
}, true);

/* ---------- agent activity: one quiet line in the console ---------- */
function bksAgentLog(name, input, res) { if (!bksOn('agentlog')) return; try { const bad = res && res.isError, ro = (AGT.tools.find(t => t.name === name) || { annotations: {} }).annotations.readOnlyHint; if (ro && !bad) return; console.info('%c🤖 agent%c ' + name + (bad ? ' ✗ ' + ((res.structuredContent || {}).error || {}).message : '') + ' ' + JSON.stringify(input || {}).slice(0, 120), 'background:#1b2a24;color:#7dbf9b;font:600 11px ui-monospace,monospace;padding:1px 5px;border-radius:3px', 'color:#9db3a5;font:11px ui-monospace,monospace'); } catch (e) { } }

/** everything that depends on the settings, set again whenever they change */
function bksSync() { bksConsoleSync(); if (!bksOn('palette')) bkpClose(); if (!bksOn('drawer')) bkdToggle(false); bus.emit('bks'); }
/** the body of Settings ▸ Backstage (once you are on the list): the master switch, and a switch for each piece */
function bksSettings() {
  const chk = (id, label, on, fn, tip) => h('label', { class: 'chk', title: tip || '' }, h('input', { type: 'checkbox', id, checked: !!on, onchange: e => fn(e.target.checked) }), label);
  const box = h('div', { class: 'bks-set' });
  const draw = () => {
    box.replaceChildren(h('div', { class: 'hub-acts' }, h('button', { class: 'btn primary', id: 'bksGo', type: 'button', onclick: () => backstageOpen() }, '🎭 Go backstage'), h('button', { class: 'btn', id: 'bksPaletteBtn', type: 'button', onclick: () => bkpOpen() }, 'Command palette  Ctrl/⌘ K'), h('button', { class: 'btn', id: 'bksDrawerBtn', type: 'button', onclick: () => bkdToggle() }, 'Terminal  Ctrl + `')),
      chk('bksOnMaster', 'Backstage everywhere', CFG.bks.on !== false, v => { CFG.bks.on = v; saveCfg(); bksSync(); draw(); }, 'One switch for everything below. Off: Backstage is only the room you go to.'),
      ...BKS_PIECES.map(([k, n, t]) => h('div', { class: 'bks-set-r' + (CFG.bks.on === false ? ' off' : '') }, chk('bksPiece_' + k, n, CFG.bks[k] !== false, v => { CFG.bks[k] = v; saveCfg(); bksSync(); }, t), h('span', { class: 'small muted' }, t))),
      h('p', { class: 'small muted' }, 'These are only here because you found Backstage. Nothing here leaves the page.'));
  }; draw(); return box;
}
bksSync();
