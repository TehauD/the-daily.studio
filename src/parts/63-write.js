/* ============================================================
   Part 63 · Write: one canvas for the tab, the words and the neck.
   Tab, Song and Fretboard were three tabs, and writing a song meant going between them. This is one place, and the canvas shifts to how you write:
     Tab    the tab grid, on its own
     Words  the lyrics with the chords over them, and the chord of every bar
     Both   the tab with the words beside it (under it on a narrow screen)
   Under the canvas a fretboard shows the chord's notes, the notes already in this bar, and the string and fret of what you are playing now. Click it to
   put a note into the selected tab cell. Capture (62-capture.js) writes what you play into the tab as you play, and this canvas follows it: it shows the
   section being played into, marks the beat, flashes each note as it lands, and says what it heard.
   The Tab panel stays the tab editor; the Song panel's structure map and chord library, and the full Fretboard, are one click away (More under the canvas).
   ============================================================ */
/** the fretboard strip: on for desktop; on a phone it shows while capturing (there is little room) unless the person chose */
const wrFretOn = () => WR.fret != null ? WR.fret : (typeof isDesk === 'function' ? isDesk() : true) || !!CAP.on;
const WR = { mode: CFG.wrMode || 'both', fret: CFG.wrFret == null ? null : !!CFG.wrFret, nf: CFG.wrNf === 22 ? 22 : 15, nodes: null, key: '', flash: new Map(), ph: [], sayAt: 0 };
if (!['tab', 'words', 'both'].includes(WR.mode)) WR.mode = 'tab';
if (CFG.capOpt) Object.assign(CAP, CFG.capOpt);

function writeBuild() {
  const p = PANES.tab; if (!p || UI.wrBar) return;
  if (UI.capBtn) UI.capBtn.remove(); if (UI.teSec) UI.teSec.classList.add('wr-hide');
  const old = [...p.children]; UI.wrTabCol = h('div', { class: 'wr-tabcol' }, ...old); UI.wrWords = h('div', { class: 'wr-words' });
  UI.wrMain = h('div', { class: 'wr-main' }, UI.wrTabCol, UI.wrWords);
  UI.wrSecs = h('div', { class: 'wr-secs', role: 'tablist', 'aria-label': 'Sections' });
  UI.wrModeSeg = h('div', { class: 'seg wr-mode', role: 'group', 'aria-label': 'What the canvas shows' });
  [['tab', '𝄞', 'Tab', 'Just the tab'], ['words', '✎', 'Words', 'Lyrics with the chords over them'], ['both', '▥', 'Both', 'The tab with the words beside it']].forEach(([k, i, t, d]) => UI.wrModeSeg.append(h('button', { 'data-wm': k, title: d, onclick: () => wrMode(k) }, h('span', { class: 'wr-ic', 'aria-hidden': 'true' }, i), t)));
  UI.wrFretBtn = h('button', { class: 'btn sm wr-fb', title: 'Show or hide the fretboard under the canvas', onclick: () => { WR.fret = !wrFretOn(); CFG.wrFret = WR.fret; saveCfg(); wrLayout(); } }, h('span', { class: 'wr-fl' }, 'Fretboard'), h('span', { class: 'wr-fs', 'aria-hidden': 'true' }, '🎸'));
  UI.wrCapBtn = h('button', { class: 'btn wr-cb', id: 'wrCap', title: 'Play your guitar and the notes and chords are written into the tab as you play. It counts you in and loops this section.', onclick: () => { capToggle(); } }, '● Capture');
  UI.wrOpt = h('button', { class: 'btn sm', title: 'Capture options', 'aria-haspopup': 'dialog', onclick: e => wrOptions(e.currentTarget) }, '⚙');
  UI.wrBar = h('div', { class: 'wr-bar' }, UI.wrSecs, h('span', { class: 'wr-sp' }), UI.wrModeSeg, UI.wrFretBtn, h('span', { class: 'wr-capg' }, UI.wrCapBtn, UI.wrOpt));
  UI.wrLvl = h('i', { class: 'wr-lvl' }, h('b')); UI.wrSay = h('span', { class: 'wr-say', id: 'wrSay', 'aria-live': 'polite' }); UI.wrN = h('span', { class: 'wr-n' });
  UI.wrStrip = h('div', { class: 'wr-strip' }, UI.wrLvl, UI.wrSay, UI.wrN);
  UI.wrFretBox = h('div', { class: 'wr-fret' }); UI.wrFretSvg = h('div', { class: 'wr-fbs' });
  UI.wrFretHead = h('div', { class: 'wr-fh' }, h('b', { class: 'small', title: 'Click a position to put that note in the selected cell of the tab. Dots: the chord’s notes. Filled: in this bar. Orange ring: what you are playing now.' }, 'FRETBOARD'), h('span', { class: 'tiny muted grow', id: 'wrFInfo' }), h('button', { class: 'btn sm', title: 'How many frets to show', onclick: () => { WR.nf = WR.nf === 15 ? 22 : 15; CFG.wrNf = WR.nf; saveCfg(); wrFretBuild(); } }, '⟷ frets'), h('button', { class: 'btn sm', title: 'The full fretboard, with scales and the heatmap', onclick: () => dockGo('fret') }, 'More ▸'));
  UI.wrFretBox.append(UI.wrFretHead, UI.wrFretSvg);
  p.append(UI.wrBar, UI.wrStrip, UI.wrMain, UI.wrFretBox);
  bus.on('song', () => { wrBarDraw(); if (WR.mode !== 'tab' && !SP.lock) renderWords(); if (WR.nodes && WR.tun !== S.tuning.join() + ':' + S.capo) wrFretBuild(); });
  bus.on('sel', () => { if (SEL.sec !== TE.sec && SEL.sec < S.sections.length) { TE.sec = SEL.sec; TE.bi = clamp(SEL.bar || 0, 0, Math.max(0, S.sections[TE.sec].bars.length - 1)); renderTab(); } wrBarDraw(); if (WR.mode !== 'tab') renderWords(); });
  bus.on('dock', id => { if (id === 'tab') { wrBarDraw(); if (WR.mode !== 'tab') renderWords(); wrFretPaint(true); } });
  bus.on('capture', wrCapUI); bus.on('capsay', () => { WR.sayAt = performance.now(); wrCapUI(); });
  bus.on('capnote', e => wrCapNote(e));
  wrLayout(); wrBarDraw(); wrCapUI();
}
function wrMode(k) { WR.mode = k; CFG.wrMode = k; saveCfg(); wrLayout(); if (k !== 'tab') renderWords(); try { if (typeof xpSignal === 'function') xpSignal(.5); } catch (e) { } }
function wrLayout() {
  const p = PANES.tab; if (!p) return; p.dataset.wr = WR.mode; const fo = wrFretOn(); p.classList.toggle('wr-nofret', !fo);
  $$('button', UI.wrModeSeg).forEach(b => { const on = b.dataset.wm === WR.mode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  UI.wrFretBtn.classList.toggle('on', fo); UI.wrFretBtn.setAttribute('aria-pressed', String(fo));
  UI.wrFretBox.style.display = fo ? '' : 'none'; UI.wrStrip.style.display = WR.mode === 'words' ? 'none' : '';
  if (fo && !WR.nodes) wrFretBuild(); if (WR.mode !== 'tab') renderWords();
}
/** the section chips */
function wrSel(i) { i = clamp(i, 0, S.sections.length - 1); TE.sec = SEL.sec = i; TE.bi = 0; SEL.bar = 0; TE.slot = 0; renderTab(); TL.dirty = true; bus.emit('sel'); }
function wrBarDraw() {
  const box = UI.wrSecs; if (!box) return; const key = S.sections.map(s => s.name).join('|') + '#' + TE.sec; if (box._k === key) return; box._k = key; box.innerHTML = '';
  S.sections.forEach((s, i) => box.append(h('button', { class: 'wr-sec' + (i === TE.sec ? ' on' : ''), role: 'tab', 'aria-selected': String(i === TE.sec), title: s.bars.length + ' bars', onclick: () => wrSel(i) }, s.name)));
  box.append(h('button', { class: 'wr-sec add', title: 'Add a section', 'aria-label': 'Add a section', onclick: () => {
    const hasV = S.sections.some(s => /^Verse/.test(s.name)), hasC = S.sections.some(s => /^Chorus/.test(s.name)), base = hasV && !hasC ? 'Chorus' : 'Verse', n = S.sections.filter(s => s.name.startsWith(base)).length + 1;
    S.sections.push(mkSection(base + ' ' + n, ['', '', '', ''])); commit(); wrSel(S.sections.length - 1);
  } }, '＋'));
}
/* ---------- words ---------- */
function renderWords() {
  const box = UI.wrWords; if (!box) return; box.innerHTML = ''; if (!S.sections.length) return; const si = clamp(TE.sec, 0, S.sections.length - 1), sec = S.sections[si];
  const head = h('div', { class: 'wr-wh' }, h('b', { class: 'small' }, 'WORDS · ' + sec.name), h('span', { class: 'grow' }), h('button', { class: 'btn sm', title: 'Paste a finished lyric sheet: [Verse] and [Chorus] headings become sections, with your chords placed over the words', onclick: () => liOpen() }, '📋 Paste lyrics'));
  box.append(head, sectionCard(sec, si, false, { lean: WR.mode === 'both' })); if (!box._li) { box._li = 1; try { liWire(box); } catch (e) { } }
}
/* ---------- capture: the strip, the options, following the playing ---------- */
function wrCapUI() {
  const b = UI.wrCapBtn; if (!b) return; b.classList.toggle('on', !!CAP.on); b.textContent = CAP.on ? '■ Stop capture' : '● Capture'; b.setAttribute('aria-pressed', String(!!CAP.on)); PANES.tab.classList.toggle('wr-capturing', !!CAP.on); if (WR.fret == null && !isDesk() && WR.shown !== wrFretOn()) { WR.shown = wrFretOn(); wrLayout(); }
  const i = capInfo(); UI.wrSay.textContent = CAP.on ? (i.text || 'Listening…') : (i.text && performance.now() - WR.sayAt < 9000 ? i.text : 'Press Capture, play, and your notes and chords are written into the tab.'); UI.wrSay.dataset.st = CAP.on || performance.now() - WR.sayAt < 9000 ? i.st : '';
  UI.wrN.textContent = CAP.on ? i.count + ' written' : '';
}
function wrOptions(anchor) {
  const chk = (label, k, tip) => h('label', { class: 'lrow', title: tip }, h('input', { type: 'checkbox', checked: !!CAP[k], onchange: e => { CAP[k] = e.target.checked; CFG.capOpt = { loop: CAP.loop, countIn: CAP.countIn, replace: CAP.replace, nameChords: CAP.nameChords }; saveCfg(); } }), label);
  popover(anchor, h('div', { class: 'wr-opt' }, h('h5', {}, 'Capture options'), chk('Loop this section', 'loop', 'Keeps playing round the section so you can play it again'), chk('Count me in', 'countIn', 'One bar of clicks first'), chk('Write over the bar I play in', 'replace', 'The first note in a bar clears what was there; one Undo takes the whole capture back'),
    chk('Name the chords', 'nameChords', 'Fills the chord of a bar that has none, from what you play'), h('div', { class: 'tiny muted', style: { marginTop: '6px' } }, 'It listens for each attack, reads the notes in it, and writes one note or a chord. It reads best from a clean guitar signal, one voice at a time.')), { style: { width: '300px', maxWidth: '92vw' } });
}
/** a note landed: follow it, and flash it */
function wrCapNote(e) {
  if (!CAP.on) return; if (e.si !== TE.sec) { TE.sec = SEL.sec = e.si; TE.bi = e.bi; renderTab(); if (WR.mode !== 'tab') renderWords(); wrBarDraw(); } else if (e.bi !== TE.bi) TE.bi = e.bi;
  const now = performance.now(); e.items.forEach(it => WR.flash.set(it.st + ':' + it.f, now));
  $$('#pane-tab .tcell.capflash').forEach(c => c.classList.remove('capflash')); e.items.forEach(it => { const c = $(`#pane-tab .tcell[data-b="${e.bi}"][data-s="${e.sib}"][data-st="${it.st}"]`); if (c) { c.classList.add('capflash'); setTimeout(() => c.classList.remove('capflash'), 900); } });
}
/* ---------- the fretboard ---------- */
function wrFretBuild() {
  if (!UI.wrFretSvg) return; const NF = WR.nf, left = !!CFG.left, W = NF === 15 ? 960 : 1240, H = 142, padL = 30, padR = 12, top = 14, bot = 18, bw = W - padL - padR, sh = (H - top - bot) / 5;
  const posX = n => { const t = (1 - Math.pow(2, -n / 12)) / (1 - Math.pow(2, -NF / 12)); return padL + bw * (left ? 1 - t : t); };
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'wr-svg', role: 'img', 'aria-label': 'Fretboard', style: 'min-width:' + (NF === 15 ? 640 : 860) + 'px' });
  svg.append(sv('rect', { x: padL, y: top - 6, width: bw, height: 5 * sh + 12, rx: 6, fill: 'var(--panel2)', stroke: 'var(--line2)' }));
  for (let n = 0; n <= NF; n++) { const x = posX(n); svg.append(sv('line', { x1: x, x2: x, y1: top - 6, y2: top + 5 * sh + 6, stroke: n === 0 ? 'var(--text)' : 'var(--line2)', 'stroke-width': n === 0 ? 4 : 1.2 })); if (n > 0) svg.append(sv('text', { x: (posX(n) + posX(n - 1)) / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': 9, fill: 'var(--muted)', 'font-family': 'var(--mono)' }, n)); }
  [3, 5, 7, 9, 15, 17, 19, 21].filter(n => n <= NF).forEach(n => svg.append(sv('circle', { cx: (posX(n) + posX(n - 1)) / 2, cy: top + 2.5 * sh, r: 3.6, fill: 'var(--line2)', opacity: .6 })));
  if (NF >= 12) { const x = (posX(12) + posX(11)) / 2; svg.append(sv('circle', { cx: x, cy: top + 1.5 * sh, r: 3.6, fill: 'var(--line2)', opacity: .7 }), sv('circle', { cx: x, cy: top + 3.5 * sh, r: 3.6, fill: 'var(--line2)', opacity: .7 })); }
  WR.nodes = []; WR.tun = S.tuning.join() + ':' + S.capo;
  S.tuning.forEach((open, st) => {
    const y = top + (5 - st) * sh; svg.append(sv('line', { x1: padL, x2: padL + bw, y1: y, y2: y, stroke: 'var(--text)', 'stroke-opacity': .5, 'stroke-width': .8 + (st === 0 ? 2.4 : st === 1 ? 1.9 : st === 2 ? 1.5 : st === 3 ? 1.2 : st === 4 ? .9 : .7) }));
    svg.append(sv('text', { x: 6, y: y + 4, 'font-size': 10.5, 'font-weight': 800, fill: 'var(--muted)', 'font-family': 'var(--mono)' }, tunPc(open))); WR.nodes[st] = [];
    for (let n = 0; n <= NF; n++) {
      const midi = open + S.capo + n, x = n === 0 ? posX(0) + (left ? 13 : -13) : (posX(n) + posX(n - 1)) / 2;
      const g = sv('g', { class: 'wf', transform: `translate(${x.toFixed(1)},${y.toFixed(1)})`, 'data-st': st, 'data-f': n }), bg = sv('circle', { class: 'wf-bg', r: 8.6 }), ring = sv('circle', { class: 'wf-ring', r: 11.5, fill: 'none' }), txt = sv('text', { class: 'wf-t', 'text-anchor': 'middle', y: 3.4 }, '');
      const hit = sv('rect', { x: -12, y: -sh / 2, width: 24, height: sh, fill: 'transparent' });
      g.append(ring, bg, txt, hit); g.addEventListener('pointerdown', ev => { ev.preventDefault(); wrFretPlace(st, n, midi); }); svg.append(g); WR.nodes[st][n] = { g, txt, st, n, midi, pc: ((midi % 12) + 12) % 12 };
    }
  });
  UI.wrFretSvg.innerHTML = ''; UI.wrFretSvg.append(svg); WR.key = ''; wrFretPaint(true);
}
/** a click on the neck writes that note into the selected cell (a second click on the same note takes it out) */
async function wrFretPlace(st, f, midi) {
  const bar = curBar(); if (!bar) return; try { await startAudio(); } catch (e) { } TE.st = st; const n = bar.tab.find(o => o.s === TE.slot && o.st === st);
  if (n && n.f === f) { setNote(null); return; } setNote(f); if (T.playing && E.ready) pluck('lead', E.ctx.currentTime + .01, midi, .85, { id: 'l' + st, pan: (st - 2.5) * .08 });
}
function wrFretPaint(force) {
  if (!WR.nodes || !PANES.tab) return; const bar = curBar(), sec = curSec(); if (!bar) return;
  const sp = spb(), ph = T.playing ? playheadSlot() : -1, gb = S.sections.slice(0, TE.sec).reduce((a, s) => a + s.bars.length, 0) + TE.bi, nowSlot = T.playing && Math.floor(ph / sp) === gb ? Math.floor(ph) - gb * sp : -1;
  let sym = barChords(bar)[0]; if (T.playing && Math.floor(ph / sp) === gb) { const cd = chordAt(gb, Math.max(0, nowSlot)); if (cd && cd.sym) sym = cd.sym; }
  const pc = parseChord(sym), pcs = pc ? new Set(pc.pcs) : new Set(), now = performance.now(), fl = [...WR.flash].filter(([, t]) => now - t < 800);
  if (WR.flash.size > fl.length) WR.flash = new Map(fl);
  const live = AN.midi != null && AN.active && CFG.anSrc !== 'v' ? AN.midi : null, pick = live != null && CAP.on ? assignFret(live) : null;
  const sig = bar.tab.map(n => n.s + '.' + n.st + '.' + n.f).join(','), key = [sym, TE.sec, TE.bi, TE.slot, TE.st, sig, live, pick ? pick.st + ':' + pick.f : '', nowSlot, fl.length ? Math.floor(now / 90) : 0, CFG.fretNames].join('|');
  if (!force && key === WR.key) return; WR.key = key;
  const info = $('#wrFInfo'); if (info) info.textContent = (sec ? sec.name : '') + ' · bar ' + (TE.bi + 1) + (sym ? ' · ' + sym : '') + ' · ' + tunShort();
  const written = new Map(); bar.tab.forEach(n => { if (typeof n.f === 'number') written.set(n.st + ':' + n.f, n.s); }); const sel = bar.tab.find(o => o.s === TE.slot && o.st === TE.st), fls = new Map(fl);
  WR.nodes.forEach(row => row.forEach(nd => {
    const k = nd.st + ':' + nd.n, w = written.has(k), tone = pcs.has(nd.pc), isNow = w && nowSlot >= 0 && bar.tab.some(o => o.st === nd.st && o.f === nd.n && o.s === nowSlot), isSel = !!sel && sel.st === nd.st && sel.f === nd.n, isLive = live != null && live === nd.midi, isPick = !!pick && pick.st === nd.st && pick.f === nd.n, fa = fls.has(k);
    const c = nd.g.classList; c.toggle('tn', tone && !w); c.toggle('wn', w); c.toggle('now', isNow); c.toggle('sl', isSel); c.toggle('lv', isLive); c.toggle('pk', isPick); c.toggle('cf', fa);
    const show = tone || w || isLive || fa; nd.txt.textContent = show ? (w || fa ? (CFG.fretNames === 'notes' ? pcName(nd.pc) : nd.n) : pcName(nd.pc)) : '';
  }));
}
/** called every frame while the Write panel is showing */
function writeFrame(n) {
  if (!UI.wrBar) return;
  if (n % 3 === 0) {
    wrFretPaint(false);
    if (UI.wrLvl) { const a = AN.active ? clamp((AN.rms + 60) / 54, 0, 1) : clamp((AN.rms + 60) / 54, 0, 1) * .5; UI.wrLvl.firstChild.style.width = Math.round((E.hasInput ? a : 0) * 100) + '%'; UI.wrLvl.classList.toggle('hot', !!AN.clip); UI.wrLvl.title = E.hasInput ? 'Input level' : 'No input connected. Open Audio at the top right.'; }
    if (CAP.on && T.playing) wrPlayhead();
    if (!CAP.on && WR.sayAt && performance.now() - WR.sayAt > 9000 && UI.wrSay.dataset.st) wrCapUI();
  }
}
/** the beat being played, marked in the tab (and the bar followed when capture is writing into a section other than the one on screen) */
function wrPlayhead() {
  const sp = spb(), ph = playheadSlot(); if (ph < 0) { WR.ph.forEach(c => c.classList.remove('wph')); WR.ph = []; return; } const gi = Math.floor(ph / sp), fb = flatBars()[gi]; if (!fb) return; const sib = Math.floor(ph - gi * sp);
  if (fb.si !== TE.sec) { TE.sec = SEL.sec = fb.si; TE.bi = fb.bi; renderTab(); if (WR.mode !== 'tab') renderWords(); wrBarDraw(); }
  WR.ph.forEach(c => c.classList.remove('wph')); WR.ph = $$(`#pane-tab .tcell[data-b="${fb.bi}"][data-s="${sib}"]`); WR.ph.forEach(c => c.classList.add('wph'));
}
