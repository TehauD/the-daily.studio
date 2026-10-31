/* ============================================================
   Part 09 · Fretboard, Visuals, Vision (webcam) and Research panes
   ============================================================ */

/* ---------------- FRETBOARD ---------------- */
/** What the SONG is playing right now (band, lead tab, chords). The fretboard, hexes and chroma wheel read this as well as the live input,
 *  so they move for playback too. Fed from the playhead in ngCapture(). */
const PB = { hits: [], seq: 0, chroma: new Float32Array(12), sym: '', at: 0 };
function pbHit(st, f, midi, v) {
  const now = performance.now(); PB.at = now; PB.seq++; if (st != null && st >= 0) { PB.hits.push({ st, f, t: now, v }); if (PB.hits.length > 28) PB.hits.shift(); }
  if (midi != null) { const pc = ((midi % 12) + 12) % 12; PB.chroma[pc] = Math.max(PB.chroma[pc], v || .8); }
}
const FB = { mode: 'scale', follow: true, nodes: [], W: 1180, H: 230, frets: 22 };
function buildFretPane() {
  const p = PANES.fret, sel = (opts, val, fn) => h('select', { class: 'in', style: { width: 'auto', fontFamily: 'var(--sans)' }, onchange: e => fn(e.target.value) }, opts.map(o => h('option', { value: o[0], selected: o[0] === val }, o[1])));
  UI.fbRoot = sel(NS.map((n, i) => [i, n]), S.key, v => { FB.root = +v; renderFret(); }); FB.root = S.key;
  UI.fbScale = sel(Object.keys(SCALES).map(n => [n, n]), S.scale, v => { S.scale = v; commit(false); renderFret(); });
  UI.fbMode = sel([['scale', 'Scale'], ['chord', 'Chord tones (current chord)'], ['both', 'Scale + chord'], ['none', 'Live only'], ['heat', 'Heatmap (where you play)']], FB.mode, v => { FB.mode = v; FB.key = null; renderFret(); });
  const lab = sel([['notes', 'Note names'], ['degrees', 'Scale degrees'], ['frets', 'Fret numbers']], CFG.fretNames, v => { CFG.fretNames = v; saveCfg(); renderFret(); });
  p.append(h('div', { class: 'card' }, h('h4', {}, 'Fretboard · tuning-, capo- and scale-aware'), h('div', { class: 'card-b' },
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', marginBottom: '8px' } }, h('span', { class: 'small muted' }, 'Root'), UI.fbRoot, UI.fbScale, UI.fbMode, lab,
      h('button', { class: 'btn sm' + (FB.follow ? ' on' : ''), onclick: e => { FB.follow = !FB.follow; e.target.classList.toggle('on', FB.follow); }, title: 'Chord tones follow the chord under the playhead' }, 'Follow song'),
      h('button', { class: 'btn sm', onclick: () => { CFG.left = !CFG.left; saveCfg(); renderFret(); } }, '⇄ Handedness'), h('span', { class: 'grow' }), h('span', { class: 'chip', id: 'fbinfo' })),
    UI.fbHeat = heatBar(), UI.fb = h('div', { class: 'fbscroll' }), h('div', { class: 'tiny muted', style: { marginTop: '6px' } }, 'Click any position to hear it. Orange ring = what you are playing right now (audio f0). Dashed ring = where the camera believes your fretting fingers are. Root = filled hexagon.'))));
  bus.on('song', () => { FB.root = S.key; UI.fbRoot.value = S.key; UI.fbScale.value = S.scale; renderFret(); }); bus.on('fret', renderFret); bus.on('scale', renderFret); bus.on('dock', id => { if (id === 'fret') renderFret(); }); renderFret();
}
function hexPts(cx, cy, r) { let s = ''; for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; s += (cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1) + ' '; } return s; }
function renderFret() {
  if (!UI.fb) return; const NF_ = FB.frets, left = !!CFG.left, W = FB.W, H = FB.H, padL = 34, padR = 14, top = 20, bot = 24, bw = W - padL - padR, sh = (H - top - bot) / 5;
  const posX = n => { const t = (1 - Math.pow(2, -n / 12)) / (1 - Math.pow(2, -NF_ / 12)); return padL + bw * (left ? 1 - t : t); };
  const svg = sv('svg', { id: 'fretsvg', viewBox: `0 0 ${W} ${H}`, class: 'fbsvg' }); FB.nodes = [];
  svg.append(sv('rect', { x: padL, y: top - 6, width: bw, height: 5 * sh + 12, rx: 6, fill: 'var(--panel2)', stroke: 'var(--line2)' }));
  for (let n = 0; n <= NF_; n++) { const x = posX(n); svg.append(sv('line', { x1: x, x2: x, y1: top - 6, y2: top + 5 * sh + 6, stroke: n === 0 ? 'var(--text)' : 'var(--line2)', 'stroke-width': n === 0 ? 4 : 1.4 })); if (n > 0) svg.append(sv('text', { x: (posX(n) + posX(n - 1)) / 2, y: H - 7, 'text-anchor': 'middle', 'font-size': 9.5, fill: 'var(--muted)', 'font-family': 'var(--mono)' }, n)); }
  [3, 5, 7, 9, 15, 17, 19, 21].forEach(n => { const x = (posX(n) + posX(n - 1)) / 2; svg.append(sv('circle', { cx: x, cy: top + 2.5 * sh, r: 4, fill: 'var(--line2)', opacity: .6 })); });
  [12].forEach(n => { const x = (posX(n) + posX(n - 1)) / 2; svg.append(sv('circle', { cx: x, cy: top + 1.5 * sh, r: 4, fill: 'var(--line2)', opacity: .7 }), sv('circle', { cx: x, cy: top + 3.5 * sh, r: 4, fill: 'var(--line2)', opacity: .7 })); });
  const root = FB.root == null ? S.key : FB.root, scl = SCALES[S.scale] || SCALES['Major (Ionian)'], scPcs = new Set(scl.map(i => (root + i) % 12));
  S.tuning.forEach((open, st) => {
    const y = top + (5 - st) * sh; svg.append(sv('line', { x1: padL, x2: padL + bw, y1: y, y2: y, stroke: 'var(--text)', 'stroke-opacity': .55, 'stroke-width': 0.8 + (5 - (5 - st)) * .0 + (st === 0 ? 2.6 : st === 1 ? 2.1 : st === 2 ? 1.7 : st === 3 ? 1.3 : st === 4 ? 1 : .8) }));
    svg.append(sv('text', { x: 6, y: y + 4, 'font-size': 11, 'font-weight': 800, fill: 'var(--muted)', 'font-family': 'var(--mono)' }, tunPc(open)));
    FB.nodes[st] = [];
    for (let n = 0; n <= NF_; n++) {
      const midi = open + S.capo + n, pc = midi % 12, x = n === 0 ? posX(0) + (left ? 14 : -14) : (posX(n) + posX(n - 1)) / 2;
      const g = sv('g', { class: 'fn', transform: `translate(${x.toFixed(1)},${y.toFixed(1)})`, style: 'cursor:pointer', 'data-st': st, 'data-f': n }), r = 9.5;
      const poly = sv('polygon', { points: hexPts(0, 0, r + 1), fill: 'var(--accent)', stroke: 'var(--accent)', 'stroke-width': 1.5 }), ring = sv('circle', { r: r + 4, fill: 'none', stroke: 'var(--accent2)', 'stroke-width': 3, opacity: 0 }), cam = sv('circle', { r: r + 6, fill: 'none', stroke: 'var(--cv3)', 'stroke-width': 2, 'stroke-dasharray': '3 3', opacity: 0 }), gh = sv('circle', { r: r + 5, fill: 'var(--accent2)', 'fill-opacity': .18, stroke: 'var(--accent2)', 'stroke-width': 2, 'stroke-dasharray': '4 3', opacity: 0 }), vo = sv('circle', { r: r + 6, fill: 'none', stroke: '#ff5fc8', 'stroke-width': 3.5, opacity: 0 });
      const txt = sv('text', { class: 'fnote', 'text-anchor': 'middle', y: 3.4, fill: '#fff' }, ''); g.append(cam, gh, vo, ring, poly, txt);
      g.addEventListener('pointerdown', async () => { await startAudio(); pluck('lead', E.ctx.currentTime + .01, midi, .85, { id: 'l' + st, pan: (st - 2.5) * .08 }); });
      svg.append(g); FB.nodes[st][n] = { g, poly, ring, cam, gh, vo, txt, midi, pc, st, n };
    }
  });
  UI.fb.innerHTML = ''; UI.fb.append(svg); FB.scPcs = scPcs; FB.root = root; paintFret(true);
}
function paintFret(force) {
  if (UI.fbHeat) UI.fbHeat.style.display = FB.mode === 'heat' ? '' : 'none';
  if (!FB.nodes.length) return; if (FB.mode === 'heat') return paintHeat(force); const root = FB.root, left = CFG.left; let chordPcs = new Set(), chordRoot = null, chName = '';
  if (FB.mode !== 'scale' && FB.mode !== 'none') {
    let sym = null; if (FB.follow) { const ph = playheadSlot(), sp = spb(), bi = Math.floor(ph / sp), cd = chordAt(Math.max(0, bi), Math.max(0, Math.floor(ph) - bi * sp)); sym = cd && cd.sym; }
    if (!sym) sym = (barChords((flatBars()[0] || { bar: { chord: '' } }).bar)[0]); const pc = sym && parseChord(sym); if (pc) { chordPcs = new Set(pc.pcs); chordRoot = pc.root; chName = sym; }
  }
  const nowT = performance.now(), mk = neckMarks(nowT), mkMap = new Map(); mk.forEach(m => { const q = m.st + ':' + m.f; const o = mkMap.get(q) || {}; o[m.k] = Math.max(o[m.k] || 0, m.a); mkMap.set(q, o); });
  const pbOn = mk.length > 0, key = [FB.mode, root, chName, CFG.fretNames, AN.midi, VIS.cands.length ? VIS.cands[VIS.cands.length - 1].t | 0 : 0, pbOn ? PB.seq + ':' + Math.floor(nowT / 70) + ':' + mk.length : 0].join();
  if (!force && key === FB.key) return; FB.key = key; const info = $('#fbinfo'); if (info) info.textContent = (FB.mode === 'chord' || FB.mode === 'both' ? chName + ' · ' : '') + pcName(root) + ' ' + S.scale;
  const now = performance.now(), cams = VIS.cands.filter(c => now - c.t < 500);
  FB.nodes.forEach(row => row.forEach(nd => {
    const inS = FB.scPcs.has(nd.pc), inC = chordPcs.has(nd.pc), show = FB.mode === 'scale' ? inS : FB.mode === 'chord' ? inC : FB.mode === 'both' ? (inS || inC) : false;
    const mm = mkMap.get(nd.st + ':' + nd.n) || {}, pbA = Math.max(mm.hit || 0, mm.pin || 0), live = (AN.midi != null && CFG.anSrc !== 'v' && AN.midi === nd.midi) || pbA > .02, camHit = cams.some(c => c.st === nd.st && c.fret === nd.n);
    const gA = mm.ghost || 0, vA = mm.voice || 0; nd.g.style.display = (show || live || camHit || gA || vA) ? '' : 'none'; nd.gh.setAttribute('opacity', gA); nd.vo.setAttribute('opacity', vA); if (!show && !live && !camHit && !gA && !vA) return;
    const isRoot = nd.pc === root, isChordRoot = chordRoot != null && nd.pc === chordRoot && FB.mode !== 'scale'; const hl = FB.mode === 'both' ? inC : (FB.mode === 'chord' ? inC : isRoot);
    nd.poly.setAttribute('fill', isRoot || isChordRoot ? 'var(--accent)' : 'var(--panel2)'); nd.poly.setAttribute('stroke', inC && FB.mode === 'both' ? 'var(--accent2)' : 'var(--accent)'); nd.poly.setAttribute('opacity', show ? 1 : .35); nd.poly.setAttribute('stroke-width', hl && !isRoot ? 2.5 : 1.5);
    nd.txt.setAttribute('fill', isRoot || isChordRoot ? '#fff' : 'var(--text)');
    nd.txt.textContent = CFG.fretNames === 'frets' ? nd.n : CFG.fretNames === 'degrees' ? (IVNAMES[(nd.pc - root + 12) % 12]) : pcName(nd.pc);
    nd.ring.setAttribute('opacity', pbA > .02 ? Math.max(.25, pbA) : live ? .95 : 0); nd.cam.setAttribute('opacity', camHit ? .95 : 0);
  }));
}

/* ---------------- VISUALS ---------------- */
const VZ_RETIRED = { tunnel: 'concert', strings: 'hex', joy: 'hex', v86: 'hex', terrain: 'hex', eco: 'hex' }; if (VZ_RETIRED[CFG.visMode]) CFG.visMode = VZ_RETIRED[CFG.visMode];
/* 2.10: the hexagon field is the default look again (it matches the start screen); a one-time reset for people who had Concert chosen by default */
if ((CFG.visV || 0) < 210) { CFG.visV = 210; CFG.visMode = 'hex'; try { saveCfg(); } catch (e) { } }
const VZ = { mode: CFG.visMode || 'hex', cam: false, spec: null, pulses: [], hexes: null, last: 0, fd: null, td: null, sm: null, t: 0, ring: [] };
const VMODES = [['hex', 'Hex Resonance'], ['spectro', 'Spectrogram'], ['chroma', 'Chroma Wheel'], ['scope', 'Oscilloscope']];
/** the readout views live on the Monitor tab now; they stay available as Stage scenes */
const VZ_MONITOR = new Set(['spectro', 'chroma', 'scope']);
function buildVisPane() {
  const p = PANES.vis; p.classList.add('flex');
  const bar = h('div', { class: 'row', style: { gap: '8px', marginBottom: '8px', flexWrap: 'wrap' } },
    h('div', { class: 'seg' }, VMODES.filter(m => !VZ_MONITOR.has(m[0]) && !BK_MODES.has(m[0])).map(([k, n]) => h('button', { class: k === VZ.mode ? 'on' : '', 'data-m': k, onclick: e => { vzSetMode(k); $$('.seg [data-m]', bar).forEach(b => b.classList.toggle('on', b === e.target)); } }, n))),
    h('div', { class: 'vz-back', id: 'vzBack' }, h('span', { class: 'hx-l', title: 'Looks made to sit behind you: set Camera look to “Me in front (green screen)” and you stand inside the picture' }, 'Behind you'), h('div', { class: 'seg', role: 'group', 'aria-label': 'Looks that sit behind you' }, VBACK.map(([k, n]) => h('button', { class: k === VZ.mode ? 'on' : '', 'data-m': k, onclick: e => { vzSetMode(k); $$('.seg [data-m]', bar).forEach(b => b.classList.toggle('on', b === e.currentTarget)); try { backTip(); } catch (er) { } } }, n)))),
    lxLensBar(), vzAdjustBtn(),
    hexSwatches(),
    h('select', { class: 'in', style: { width: 'auto', fontFamily: 'var(--sans)' }, title: 'Analysis source', onchange: e => { VZ.src = e.target.value; } }, [['auto', 'Source: auto (follows playback)'], ['rig', 'Source: guitar after the rig'], ['master', 'Source: master mix'], ['di', 'Source: what the detector hears'], ['vox', 'Source: vocal microphone']].map(([v, n]) => h('option', { value: v }, n))),
    h('button', { class: 'btn sm', id: 'vzRecBtn', 'data-srec': '1', title: 'Record the stage as a video with the song’s sound (saved on this device)', onclick: e => srecMenu(e.currentTarget) }, '⏺ Record'),
    h('button', { class: 'btn sm' + (CFG.vzAuto ? ' on' : ''), id: 'vzAutoBtn', 'aria-pressed': String(!!CFG.vzAuto), title: 'Auto look: while the song plays, the look follows the section (verse calm, chorus wide, bridge strange)', onclick: e => { CFG.vzAuto = !CFG.vzAuto; saveCfg(); e.currentTarget.classList.toggle('on', !!CFG.vzAuto); e.currentTarget.setAttribute('aria-pressed', String(!!CFG.vzAuto)); toast('Auto look ' + (CFG.vzAuto ? 'on: the look follows the song’s sections' : 'off'), 'ok'); } }, '🎬 Auto look'),
    h('button', { class: 'btn sm', id: 'vzGoStage', title: 'Full-screen visuals with the camera: you in front of the hexagons', onclick: () => goOnStage() }, '🎥 Go on stage'),
    h('button', { class: 'btn sm' + (VZ.cam ? ' on' : ''), id: 'vzCamBtn', title: 'Put yourself center stage: turns the camera on behind the visuals', onclick: () => vzCamPress() }, '📷 Camera backdrop'), camFxBox(),
    h('button', { class: 'btn sm' + (CFG.vzNeck !== false ? ' on' : ''), id: 'vzNeckBtn', title: 'Show a small guitar neck on the visuals: what is playing, what is coming next, the note you are singing', onclick: e => { CFG.vzNeck = CFG.vzNeck === false; saveCfg(); e.currentTarget.classList.toggle('on', CFG.vzNeck !== false); } }, '🎸 Neck'),
    h('button', { class: 'btn sm' + (CFG.vzRibbon ? ' on' : ''), id: 'vzRibbonBtn', 'aria-pressed': String(!!CFG.vzRibbon), title: 'Show your pitch on the visuals: the note you sing against the notes of the key and the chord that is playing', onclick: e => { CFG.vzRibbon = !CFG.vzRibbon; saveCfg(); e.currentTarget.classList.toggle('on', !!CFG.vzRibbon); e.currentTarget.setAttribute('aria-pressed', String(!!CFG.vzRibbon)); if (CFG.vzRibbon) voxReset(); } }, '〰 Pitch'),
    h('button', { class: 'btn sm', onclick: () => { const w = UI.vwrap; (document.fullscreenElement ? document.exitFullscreen() : w.requestFullscreen && w.requestFullscreen()); } }, '⛶ Stage mode'));
  UI.vwrap = h('div', { class: 'vwrap', style: { flex: 1, minHeight: '320px' } }, UI.vcv = h('canvas', { class: 'vcanvas', style: { height: '100%', minHeight: '320px' } }));
  p.append(bar, UI.vwrap); new ResizeObserver(() => { const d = (window.devicePixelRatio || 1) * (CFG.vq || 1), w = UI.vcv.clientWidth, hh = UI.vcv.clientHeight; if (w && (UI.vcv.width !== Math.floor(w * d) || UI.vcv.height !== Math.floor(hh * d))) { UI.vcv.width = Math.floor(w * d); UI.vcv.height = Math.floor(hh * d); VZ.spec = null; VZ.hexes = null; } }).observe(UI.vwrap);
  bus.on('onset', () => { VZ.pulses.push({ t: performance.now(), a: clamp((AN.rms + 50) / 40, .2, 1) }); if (VZ.pulses.length > 12) VZ.pulses.shift(); });
}
const vcol = () => { const cs = getComputedStyle(document.documentElement); return { a: cs.getPropertyValue('--accent').trim(), b: cs.getPropertyValue('--accent2').trim(), c: cs.getPropertyValue('--cv3').trim(), d: cs.getPropertyValue('--cv4').trim() }; };
/** 'auto' follows what is sounding: the mix while the song, a hum or a backing track plays, the guitar rig otherwise */
const vzPlaying = () => T.playing || (typeof STP !== 'undefined' && STP.playing);
function visAna() { const s = VZ.src || 'auto'; if (s === 'vox' && E.anaVox) return E.anaVox; return s === 'master' || (s === 'auto' && vzPlaying()) ? E.anaMaster : s === 'di' ? E.anaDI : E.anaRig; }
/** looks that draw their whole picture themselves: no pitch read-out or mini fretboard on top */
const vzBare = m => m === 'concert' || HM_MODES.has(m) || (typeof BK_MODES !== 'undefined' && BK_MODES.has(m));
function drawVis(cvo, o) {
  o = o || {}; const cv = cvo || UI.vcv; if (!cv || !E.ready || (!cvo && !paneVisible('vis'))) return; const MODE = o.mode || VZ.mode; const g = cv.getContext('2d'), W = cv.width, H = cv.height, now = performance.now(), dt = Math.min(.1, (now - (VZ.last || now)) / 1000) * vzSpeed(); VZ.last = now; VZ.t += dt;
  const an = visAna(); if (!an) return; if (!VZ.fd || VZ.fd.length !== an.frequencyBinCount) VZ.fd = new Float32Array(an.frequencyBinCount); an.getFloatFrequencyData(VZ.fd); const fd = VZ.fd, bh = E.ctx.sampleRate / an.fftSize;
  const light = CFG.theme === 'light', C = o.C || vcol(), HP = MODE === 'hex' && !cvo ? hexPal() : null, HEXL = !!(HP && HP.lt);
  // background (always dark stage for contrast, tinted by theme)
  if (MODE !== 'spectro' && MODE !== 'kaleido') { g.globalAlpha = o.bgA == null ? 1 : o.bgA; g.fillStyle = HP ? HP.bg : light && !cvo ? '#0c1a1b' : '#050b0c'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  const camOn = !!((o.cam != null ? o.cam : VZ.cam) && CAM.video && CAM.video.readyState >= 2 && MODE !== 'spectro');
  if (camOn && (CFG.camFx || 'over') === 'over') { g.save(); g.globalAlpha = .32; if (CFG.mirror) { g.translate(W, 0); g.scale(-1, 1); } const vr = CAM.video.videoWidth / CAM.video.videoHeight, cr = W / H; let dw = W, dh = H, dx = 0, dy = 0; if (vr > cr) { dw = H * vr; dx = (W - dw) / 2; } else { dh = W / vr; dy = (H - dh) / 2; } g.drawImage(CAM.video, dx, dy, dw, dh); g.restore(); }
  const lvl = x => clamp((x + 88 + (o.gain || 0)) / 62, 0, 1), bin = f => clamp(Math.round(f / bh), 1, fd.length - 1);
  const energy = (() => { let s = 0, n = 0; for (let k = bin(80); k < bin(5000); k += 2) { s += lvl(fd[k]); n++; } return s / n; })();
  const pulse = VZ.pulses.reduce((a, p) => Math.max(a, (1 - (now - p.t) / 900) * p.a), 0);
  /* zoom (part 09e): the look is pushed in from the middle of the picture; size is applied by the looks made of tiles (drawHex, the pulse grid) */
  const vk = vzZoom(), tf = vk !== 1, VW = W, VH = H;
  if (tf) { g.save(); g.translate(W / 2, H / 2); g.scale(vk, vk); g.translate(-W / 2, -H / 2); }
  try {
    if (MODE === 'hex') drawHex(g, VW, VH, fd, bh, lvl, C, pulse, HP || hexPal(true));
    else if (MODE === 'tunnel') drawTunnel(g, VW, VH, energy, C, pulse, dt);
    else if (MODE === 'spectro') drawSpectro(g, VW, VH, fd, bin, lvl, C);
    else if (MODE === 'chroma') drawChroma(g, VW, VH, C);
    else if (MODE === 'scope') drawScope(g, VW, VH, C);
    else if (typeof stageExtra === 'function') stageExtra(MODE, g, VW, VH, { fd, bin, lvl, C, pulse, energy, dt, o });
  } finally { if (tf) g.restore(); }
  if (camOn && !cvo) camTop(g, W, H);
  if (MODE === 'halo' && !cvo) haloFront(g);   // stage draws its own camera layer after trails and kaleidoscope
  if (!cvo && CFG.vzNeck !== false && !document.body.classList.contains('perform-on') && !vzBare(MODE)) { const r = neckRect(W, H); drawMiniNeck(g, r[0], r[1], r[2], r[3], { C }); }
  if (!cvo && CFG.vzRibbon && !document.body.classList.contains('perform-on') && typeof voxDraw === 'function') { const r = voxRect(W, H); voxDraw(g, r[0], r[1], r[2], r[3], { C, labels: H > 260 }); }
  if (o.noText || vzBare(MODE)) return;
  const ink = HP ? HP.ink : '255,255,255'; g.fillStyle = `rgba(${ink},.55)`; g.font = `${Math.round(11 * H / 400 + 6)}px ui-monospace,Menlo,monospace`; g.textBaseline = 'top';
  if (AN.midi != null && AN.active) { g.fillStyle = `rgba(${ink},.85)`; g.font = `800 ${Math.round(28 * Math.min(W, H * 2) / 900 + 10)}px ui-monospace,Menlo,monospace`; g.fillText(pcName(AN.midi) + (Math.floor(AN.midi / 12) - 1) + '  ' + (AN.cents >= 0 ? '+' : '') + AN.cents.toFixed(0) + '¢', 14, 12); }
  if (AN.chord && AN.chord[0] && AN.active) { g.fillStyle = C.b; g.font = `800 ${Math.round(20 * Math.min(W, H * 2) / 900 + 8)}px ui-monospace,Menlo,monospace`; g.fillText(AN.chord[0].sym, 14, H * .13 + 20); }
}
/** The hexagon field is one design in many colourings: dark green and white are the original two; the others, and any three colours you pick, use the same drawing.
    “Match the theme” (the default) follows the app's light/dark choice and its accent colours. Only the main and full-screen canvases take the choice; a stage scene keeps its own palette. */
const HEX_PALS = [   /* id, name, background, cells, gold cells, outline (optional; otherwise worked out) */
  ['green', 'Dark green', '#04090a', '#3ddc84', '#f2b632', '#7dbf9b'], ['white', 'White', '#f4f8f3', '#1f8a56', '#e0a21a', '#2d6e50'],
  ['ocean', 'Ocean', '#041018', '#3db8ff', '#ffd166'], ['ember', 'Ember', '#120804', '#ff7a3d', '#ffd166'], ['violet', 'Violet', '#0a0614', '#a07bff', '#ff8fd0'],
  ['mono', 'Mono', '#0b0b0b', '#d8d8d8', '#ffffff'], ['blush', 'Blush', '#fbf1f3', '#d9487a', '#e0a21a'], ['sky', 'Daylight', '#eef6fb', '#2b7fd0', '#e0a21a']];
const hexRgbS = c => rgbOf(c).join(',');
function hexPalBuild(row, useC) {
  const [id, name, bg, cell, warm, line] = row, B = rgbOf(bg), lum = (.2126 * B[0] + .7152 * B[1] + .0722 * B[2]) / 255, lt = lum > .55;
  const mx = (a, b, t) => { const A = rgbOf(a), Z = rgbOf(b); return A.map((v, i) => Math.round(lerp(v, Z[i], t))).join(','); };
  return { id, name, bg, lt, useC: !!useC, a: cell, b: mixHex(cell, warm, .35), cell: hexRgbS(cell), warm: hexRgbS(warm), glow: hexRgbS(cell), line: line ? hexRgbS(line) : (lt ? mx(cell, '#000000', .3) : mx(cell, '#ffffff', .45)), ink: lt ? '20,45,32' : '255,255,255' };
}
function mixHex(a, b, t) { const A = rgbOf(a), Z = rgbOf(b); return '#' + A.map((v, i) => Math.round(lerp(v, Z[i], t)).toString(16).padStart(2, '0')).join(''); }
const _hp = {};
/** the palette in force. hexPal(true) is the plain dark-green design (what a stage scene uses) */
function hexPal(plain) {
  let t = CFG.hexTone || 'auto'; if (t === 'light') t = 'white'; else if (t === 'dark') t = 'green';
  if (plain) t = 'green';
  let row, useC = false;
  if (t === 'custom') { const c = CFG.hexCol || {}; row = ['custom', 'Your colours', c.bg || '#04090a', c.cell || '#3ddc84', c.warm || '#f2b632']; }
  else if (t === 'auto') { row = CFG.theme === 'light' ? HEX_PALS[1] : HEX_PALS[0]; useC = true; }
  else row = HEX_PALS.find(r => r[0] === t) || (CFG.theme === 'light' ? HEX_PALS[1] : HEX_PALS[0]);
  if (plain) useC = true;
  const key = row.join('|') + useC; return _hp[key] || (_hp[key] = hexPalBuild(row, useC));
}
function hexLight() { return hexPal().lt; }
function hexSet(k) {
  if (k === 'auto') delete CFG.hexTone; else CFG.hexTone = k;
  if (k === 'custom' && !CFG.hexCol) { const P = hexPal(); CFG.hexCol = { bg: P.bg, cell: P.a, warm: '#' + P.warm.split(',').map(v => (+v).toString(16).padStart(2, '0')).join('') }; }
  saveCfg(); hexToneSync();
}
function hexSwatches() {
  const dot = (k, name, bg, cell, extra) => h('button', { type: 'button', class: 'hx-sw', 'data-k': k, role: 'radio', title: name, 'aria-label': 'Hexagon colours: ' + name, onclick: () => hexSet(k), style: { background: bg } }, h('i', { style: { background: cell } }), extra || null);
  const cur = () => CFG.hexTone === 'light' ? 'white' : CFG.hexTone === 'dark' ? 'green' : (CFG.hexTone || 'auto');
  const box = h('div', { class: 'hx-pal', id: 'hexTone', role: 'radiogroup', 'aria-label': 'Hexagon colours', style: { display: VZ.mode === 'hex' ? '' : 'none' } });
  box.append(h('span', { class: 'hx-l' }, 'Hexagons'), dot('auto', 'Match the theme', 'linear-gradient(135deg,#f4f8f3 50%,#04090a 50%)', '#3ddc84'));
  HEX_PALS.forEach(([id, name, bg, cell]) => box.append(dot(id, name, bg, cell)));
  box.append(dot('custom', 'Pick your own colours', 'conic-gradient(#ff5d5d,#ffd24d,#4dff88,#4dc3ff,#b36bff,#ff5d5d)', 'transparent'));
  const mk = (key, label) => h('label', { class: 'hx-c', title: label }, h('span', {}, label), h('input', { type: 'color', 'aria-label': 'Hexagon ' + label.toLowerCase() + ' colour', 'data-c': key, value: (CFG.hexCol || {})[key] || '#3ddc84', oninput: e => { CFG.hexCol = Object.assign({}, CFG.hexCol || {}, { [key]: e.target.value }); saveCfg(); } }));
  box.append(h('span', { class: 'hx-custom' }, mk('bg', 'Background'), mk('cell', 'Cells'), mk('warm', 'Gold cells')));
  box._cur = cur; return box;
}
function hexToneSync() {
  const box = document.getElementById('hexTone'); if (!box) return; box.style.display = VZ.mode === 'hex' ? '' : 'none';
  const cur = box._cur ? box._cur() : (CFG.hexTone || 'auto'), P = hexPal();
  box.querySelectorAll('.hx-sw').forEach(b => { const on = b.dataset.k === cur; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  const cu = box.querySelector('.hx-custom'); if (cu) { cu.style.display = cur === 'custom' ? '' : 'none'; const c = CFG.hexCol || {}; cu.querySelectorAll('input').forEach(i => { i.value = c[i.dataset.c] || (i.dataset.c === 'bg' ? P.bg : i.dataset.c === 'cell' ? P.a : '#f2b632'); }); }
}
function drawHex(g, W, H, fd, bh, lvl, C, pulse, P) {
  const lt = P.lt, CA = P.useC ? C.a : P.a, CB = P.useC ? C.b : P.b;
  const R = Math.max(14, Math.min(W, H) / 15) * vzSize(), dx = R * Math.sqrt(3), dy = R * 1.5, cols = Math.ceil(W / dx) + 2, rows = Math.ceil(H / dy) + 2, cx = W / 2, cy = H / 2, maxd = Math.hypot(cx, cy);
  if (!VZ.sm || VZ.sm.length !== cols * rows) VZ.sm = new Float32Array(cols * rows); const fmin = 70, fmax = 7000, lr = Math.log(fmax / fmin);
  const bt = ((performance.now() / 1000) % 1.9) / 1.9;   /* a slow ring even when nothing is playing, like the start screen */
  { const gl = g.createRadialGradient(cx, cy * .92, 0, cx, cy * .92, Math.hypot(W, H) * .55); gl.addColorStop(0, `rgba(${P.glow},${lt ? .12 : .16})`); gl.addColorStop(.5, `rgba(${P.glow},.04)`); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, H); }   /* the start screen's glow */
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c * dx + (r % 2 ? dx / 2 : 0) - dx / 2, y = r * dy - R / 2, d = Math.hypot(x - cx, y - cy) / maxd, ang = (Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI);
    const f = fmin * Math.exp(lr * clamp(d * .92 + ((ang * 5) % 1) * .08, 0, 1)), k = clamp(Math.round(f / bh), 1, fd.length - 1), v = lvl(Math.max(fd[k], fd[k + 1] || -120)), i = r * cols + c;
    VZ.sm[i] = Math.max(v, VZ.sm[i] * .86 - .004); const s = VZ.sm[i], ring = pulse * Math.max(0, 1 - Math.abs(d - (1 - pulse) * 1.05) * 6);
    const amb = .2 * Math.pow(Math.max(0, Math.sin(d * 11 - performance.now() / 780)), 2) * Math.max(0, 1 - d * .9), idle = .42 * Math.max(0, 1 - Math.abs(d - bt * 1.1) * 7) * Math.max(0, 1 - d * .9), a = clamp(s * 1.15 + ring * .8 + amb + idle, 0, 1); if (a < .03) { g.strokeStyle = `rgba(${P.line},${lt ? .13 : .07})`; g.lineWidth = 1; hexPath(g, x, y, R * .94); g.stroke(); continue; }
    const warm = ((c * 7 + r * 13) % 11) === 0; g.fillStyle = warm ? mixc(CB, '#' + P.warm.split(',').map(v => (+v).toString(16).padStart(2, '0')).join(''), .55, a * (lt ? .9 : .8)) : mixc(CA, CB, clamp(s * 1.4 - .15 + ring, 0, 1), a * .92); hexPath(g, x, y, R * (.5 + .46 * Math.min(1, a))); g.fill(); g.strokeStyle = `rgba(${P.line},` + (.05 + a * (lt ? .4 : .45)).toFixed(3) + ')'; g.lineWidth = 1; g.stroke();   /* gold cells and outlines, as on the start screen */
  }
}
function hexPath(g, x, y, r) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; g[i ? 'lineTo' : 'moveTo'](x + r * Math.cos(a), y + r * Math.sin(a)); } g.closePath(); }
const _cc = {}; function rgbOf(c) { if (_cc[c]) return _cc[c]; let m; if ((m = /^#([0-9a-f]{3})$/i.exec(c))) return _cc[c] = m[1].split('').map(x => parseInt(x + x, 16)); if ((m = /^#([0-9a-f]{6})$/i.exec(c))) return _cc[c] = [0, 2, 4].map(i => parseInt(m[1].substr(i, 2), 16)); return _cc[c] = [11, 127, 138]; }
function mixc(a, b, t, al) { const A = rgbOf(a), B = rgbOf(b); return `rgba(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))},${al.toFixed(3)})`; }
function drawTunnel(g, W, H, en, C, pulse, dt) {
  const cx = W / 2, cy = H / 2, maxR = Math.hypot(cx, cy) * 1.1; VZ.ring = VZ.ring || []; VZ.zacc = (VZ.zacc || 0) + dt * (.35 + en * 2.2 + pulse * 1.5);
  if (VZ.zacc > .22) { VZ.zacc = 0; VZ.ring.push({ r: 0, e: en, rot: VZ.t * .4 }); }
  VZ.ring.forEach(q => { q.r += dt * maxR * (.34 + en * .9); }); VZ.ring = VZ.ring.filter(q => q.r < maxR);
  VZ.ring.forEach(q => { const t = q.r / maxR, rad = q.r * .9 + 4; g.lineWidth = 1 + t * 5 * (.4 + q.e); g.strokeStyle = mixc(C.a, C.b, t, (1 - t) * .9); g.beginPath(); for (let i = 0; i <= 6; i++) { const a = Math.PI / 3 * i + q.rot + t * .8; g[i ? 'lineTo' : 'moveTo'](cx + rad * Math.cos(a), cy + rad * Math.sin(a)); } g.stroke(); });
  g.fillStyle = mixc(C.b, C.a, .5, .25 + en * .5 + pulse * .3); hexPath(g, cx, cy, 10 + en * 80 + pulse * 40); g.fill();
}
function drawSpectro(g, W, H, fd, bin, lvl, C) {
  if (!VZ.spec || VZ.spec.width !== W || VZ.spec.height !== H) { VZ.spec = document.createElement('canvas'); VZ.spec.width = W; VZ.spec.height = H; const q = VZ.spec.getContext('2d'); q.fillStyle = '#050b0c'; q.fillRect(0, 0, W, H); }
  const q = VZ.spec.getContext('2d'), sp = Math.max(1, Math.round(2 * (W / 900))); q.drawImage(VZ.spec, -sp, 0); const fmin = 60, fmax = 9000, lr = Math.log(fmax / fmin);
  for (let y = 0; y < H; y += 1) { const f = fmin * Math.exp(lr * (1 - y / H)), v = lvl(fd[bin(f)]); q.fillStyle = v < .04 ? '#050b0c' : mixc('#12303a', v > .6 ? C.b : C.a, clamp(v * 1.2, 0, 1), clamp(.2 + v, 0, 1)); q.fillRect(W - sp, y, sp, 1); }
  g.drawImage(VZ.spec, 0, 0); g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '11px ui-monospace,monospace'; [110, 220, 440, 880, 1760, 3520, 7040].forEach(f => { const y = (1 - Math.log(f / fmin) / lr) * H; g.fillRect(W - 8, y, 8, 1); g.fillText(f < 1000 ? f : (f / 1000) + 'k', W - 34, y - 12); });
}
function drawChroma(g, W, H, C) {
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * .42, ch0 = AN.chroma, m0 = Math.max(.001, ...ch0), play = T.playing, ch = play ? Array.from(ch0, (x, i) => Math.max(x / m0 * (AN.active ? 1 : 0), PB.chroma[i])) : ch0, mx = Math.max(.001, ...ch), key = AN.key && AN.key[0];
  for (let i = 0; i < 12; i++) {
    const pc = (i * 7) % 12, a0 = (i / 12) * Math.PI * 2 - Math.PI / 2 - Math.PI / 12, a1 = a0 + Math.PI / 6, v = ch[pc] / mx, inKey = key && SCALES[key.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)'].includes(((pc - key.root) + 12) % 12);
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R * (.28 + .72 * v), a0, a1); g.closePath(); g.fillStyle = mixc(C.a, C.b, v, .25 + .7 * v); g.fill(); g.strokeStyle = 'rgba(255,255,255,.18)'; g.stroke();
    const am = (a0 + a1) / 2; g.fillStyle = (AN.midi != null && AN.midi % 12 === pc) ? C.b : inKey ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.45)'; g.font = `800 ${Math.round(R * .1)}px ui-monospace,monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(pcName(pc), cx + Math.cos(am) * R * 1.12, cy + Math.sin(am) * R * 1.12);
  }
  g.fillStyle = 'rgba(255,255,255,.9)'; g.font = `800 ${Math.round(R * .22)}px ui-monospace,monospace`; g.fillText(play && PB.sym ? PB.sym : AN.active && AN.chord[0] ? AN.chord[0].sym : '—', cx, cy - R * .04); g.font = `600 ${Math.round(R * .085)}px ui-monospace,monospace`; g.fillStyle = 'rgba(255,255,255,.55)';
  g.fillText(key ? 'key ' + pcName(key.root) + (key.minor ? 'm' : '') + '  r=' + key.r.toFixed(2) : 'circle of fifths · play to estimate key', cx, cy + R * .16); g.textAlign = 'left';
}
function drawScope(g, W, H, C) {
  const an = E.anaDI; if (!VZ.td || VZ.td.length !== an.fftSize) VZ.td = new Float32Array(an.fftSize); an.getFloatTimeDomainData(VZ.td); const d = VZ.td; let s = 0; for (let i = 1; i < d.length / 2; i++) if (d[i - 1] < 0 && d[i] >= 0) { s = i; break; }
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(0, H * i / 8); g.lineTo(W, H * i / 8); g.stroke(); g.beginPath(); g.moveTo(W * i / 8, 0); g.lineTo(W * i / 8, H); g.stroke(); }
  const len = Math.min(d.length - s, 1600); g.lineWidth = 2.2; g.strokeStyle = C.a; g.shadowColor = C.a; g.shadowBlur = 12; g.beginPath(); for (let i = 0; i < len; i++) { const x = i / len * W, y = H / 2 - d[s + i] * H * .45 * 2.2; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.shadowBlur = 0;
}
/* ---------------- VISION (webcam fretting-hand lab) ---------------- */
const CAM = { video: null, stream: null, on: false, cal: store.get('cal', null), pts: [], calMode: false, hands: null, tracker: null, track: 'off', fps: 0, frames: 0, handFrames: 0, fretHist: new Array(25).fill(0), stringHist: new Array(6).fill(0), lastT: 0, prevGray: null, motion: new Array(13).fill(0), vel: {}, loopOn: false, fingerLast: {} };
function buildCamPane() {
  const p = PANES.cam;
  UI.camSel = h('select', { class: 'in', style: { width: '220px', fontFamily: 'var(--sans)' }, onchange: e => { CFG.camDev = e.target.value; saveCfg(); if (CAM.on) startCam(); } });
  UI.camMode = h('select', { class: 'in', style: { width: 'auto', fontFamily: 'var(--sans)' }, onchange: e => { CAM.want = e.target.value; if (CAM.on) setupTracker(); } }, [['hand', 'Hand tracking (MediaPipe via CDN)'], ['motion', 'Motion energy only (offline)']].map(([v, n]) => h('option', { value: v }, n)));
  UI.camInfo = h('span', { class: 'chip' }, 'camera off'); UI.camCal = h('button', { class: 'btn sm', onclick: startCal }, '⌖ Calibrate neck');
  CAM.video = h('video', { autoplay: true, playsinline: true, muted: true, class: CFG.mirror ? 'mirror' : '' }); UI.camOv = h('canvas', { class: CFG.mirror ? 'mirror' : '' });
  UI.camWrap = h('div', { class: 'camwrap' }, CAM.video, UI.camOv); UI.camOv.addEventListener('pointerdown', camClick);
  p.append(h('div', { class: 'card' }, h('h4', {}, 'Fretting-hand vision lab'), h('div', { class: 'card-b' },
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', marginBottom: '8px' } }, UI.camSel, h('button', { class: 'btn primary sm', onclick: () => CAM.on ? stopCam() : startCam() }, '⏻ Camera on/off'), UI.camMode, UI.camCal,
      h('button', { class: 'btn sm', onclick: e => { CFG.mirror = !CFG.mirror; saveCfg(); CAM.video.classList.toggle('mirror', CFG.mirror); UI.camOv.classList.toggle('mirror', CFG.mirror); if (CAM.cal) { toast('Mirror changed — recalibrate the neck', 'warn'); } } }, '⇋ Mirror'),
      h('button', { class: 'btn sm', onclick: () => { CAM.cal = null; store.set('cal', null); VIS.active = false; toast('Calibration cleared'); } }, 'Clear calibration'), h('span', { class: 'grow' }), UI.camInfo),
    UI.camWrap, h('div', { class: 'tiny muted', style: { marginTop: '6px', lineHeight: 1.5 } }, h('b', {}, 'Calibrate: '), 'frame the neck, press ⌖, then click (1) the nut on the LOW-E string, (2) the 12th-fret marker on the LOW-E string, (3) the nut on the HIGH-e string. Fret spacing uses the 12-TET rule d(n)=L·(1−2^(−n/12)) with L = 2·|nut→12|; strings are assumed parallel (perspective error grows with camera tilt — film head-on). Camera frames never leave this page; hand tracking downloads its model from a CDN only if you choose it and agree to a one-time download.'))),
    h('div', { class: 'card' }, h('h4', {}, 'Fusion statistics'), h('div', { class: 'card-b' }, UI.camStats = h('div', { class: 'stat-grid' }), h('div', { style: { marginTop: '8px' } }, h('div', { class: 'small muted' }, 'Fretting-hand usage by fret (frames)'), UI.camChart = h('canvas', { class: 'chart' })))));
  CAM.want = 'hand'; refreshCamList(); bus.on('devices', refreshCamList);
}
function refreshCamList() { [UI.camSel, UI.camSel2].forEach(sel => { if (!sel) return; sel.innerHTML = ''; sel.append(h('option', { value: '' }, 'Default camera')); (E.devs.cam || []).forEach((d, i) => sel.append(h('option', { value: d.deviceId, selected: d.deviceId === CFG.camDev }, d.label || 'Camera ' + (i + 1)))); }); }
async function startCam() {
  stopCam(true);
  try {
    const dev = CFG.camDev ? { deviceId: { exact: CFG.camDev } } : {}, tries = [CFG.vq >= 1 ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60 } } : { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } }, { width: { ideal: 640 }, height: { ideal: 480 } }, {}];
    let lastErr = null; CAM.stream = null;
    for (const t of tries) { try { CAM.stream = await navigator.mediaDevices.getUserMedia({ video: Object.assign({}, dev, t), audio: false }); break; } catch (e) { lastErr = e; if (e.name === 'NotAllowedError') break; } }
    if (!CAM.stream) throw lastErr || new Error('no camera');
    CAM.video.srcObject = CAM.stream; await CAM.video.play().catch(() => { }); CAM.on = true; const st = CAM.stream.getVideoTracks()[0].getSettings(); UI.camInfo.textContent = (st.width || '?') + '×' + (st.height || '?') + ' @ ' + Math.round(st.frameRate || 0) + ' fps'; bus.emit('devices');
    try { const d = await navigator.mediaDevices.enumerateDevices(); E.devs.cam = d.filter(x => x.kind === 'videoinput'); refreshCamList(); } catch (e) { }
    if (!CAM.loopOn) { CAM.loopOn = true; requestAnimationFrame(camLoop); }   // the picture runs in motion mode at once; the hand model (and the question before it downloads) may take a while
    await setupTracker();
  } catch (e) { toast('Camera unavailable: ' + (e.message || e.name) + '. In CodePen, use Full Page view and allow camera access.', 'bad'); UI.camInfo.textContent = 'camera error'; }
}
function stopCam(keep) { if (CAM.stream) CAM.stream.getTracks().forEach(t => t.stop()); CAM.stream = null; CAM.on = false; VIS.active = false; if (!keep && UI.camInfo) UI.camInfo.textContent = 'camera off'; }
async function setupTracker() {
  CAM.tracker = null; CAM.track = 'motion';
  if (CAM.want !== 'motion') {
    try {
      UI.camInfo.textContent += ' · loading hand model…'; const { mod, fs } = await mpVision();
      CAM.tracker = await mod.HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: .5, minTrackingConfidence: .5 });
      CAM.track = 'hand'; toast('Hand tracking ready', 'ok');
    } catch (e) { CAM.track = 'motion'; if (e && e.declined) toast('Staying offline: using motion-energy mode', 'ok'); else { console.warn('MediaPipe unavailable', e); toast('Hand model could not load (offline or blocked) — using motion-energy mode', 'warn'); } }
  }
  VIS.active = !!(CAM.cal && CAM.track === 'hand'); const st = CAM.stream && CAM.stream.getVideoTracks()[0].getSettings(); UI.camInfo.textContent = (st ? st.width + '×' + st.height + ' · ' : '') + 'tracker: ' + CAM.track;
}
function startCal() { if (!CAM.on) return toast('Start the camera first', 'warn'); CAM.pts = []; CAM.calMode = true; toast('Click 1/3: the nut on the LOW-E string'); }
function camClick(e) {
  if (!CAM.calMode) return; const r = UI.camOv.getBoundingClientRect(), vw = CAM.video.videoWidth || 1280, vh = CAM.video.videoHeight || 720;
  const x = e.offsetX / UI.camOv.clientWidth * vw, y = e.offsetY / UI.camOv.clientHeight * vh; CAM.pts.push({ x, y });
  if (CAM.pts.length < 3) toast(['', 'Click 2/3: the 12th-fret marker on the LOW-E string', 'Click 3/3: the nut on the HIGH-e string'][CAM.pts.length]);
  else { CAM.calMode = false; const [p0, p12, p3] = CAM.pts, ax = { x: p12.x - p0.x, y: p12.y - p0.y }, L = 2 * Math.hypot(ax.x, ax.y); CAM.cal = { p0, p12, p3, L, vw, vh }; store.set('cal', CAM.cal); VIS.active = CAM.track === 'hand'; toast('Neck calibrated (scale length ≈ ' + Math.round(L) + ' px)', 'ok'); }
}
/** map image point → {fret (float, ≥0), string (float, 0 = low string)} using the calibration frame */
function neckCoords(px, py) {
  const c = CAM.cal; if (!c) return null; const ax = { x: c.p12.x - c.p0.x, y: c.p12.y - c.p0.y }, al = Math.hypot(ax.x, ax.y), au = { x: ax.x / al, y: ax.y / al }, w = { x: c.p3.x - c.p0.x, y: c.p3.y - c.p0.y };
  const det = au.x * w.y - au.y * w.x; if (Math.abs(det) < 1e-6) return null; const dx = px - c.p0.x, dy = py - c.p0.y, u = (dx * w.y - dy * w.x) / det, l = (au.x * dy - au.y * dx) / det;
  const fr = u <= 0 ? 0 : (u / c.L >= .999 ? 24 : -12 * Math.log2(1 - u / c.L)); return { fret: fr, string: l * 5, u, l };
}
function fretPoint(fret, strIdx) { const c = CAM.cal, d = c.L * (1 - Math.pow(2, -fret / 12)), ax = { x: c.p12.x - c.p0.x, y: c.p12.y - c.p0.y }, al = Math.hypot(ax.x, ax.y); return { x: c.p0.x + ax.x / al * d + (c.p3.x - c.p0.x) * strIdx / 5, y: c.p0.y + ax.y / al * d + (c.p3.y - c.p0.y) * strIdx / 5 }; }
function camLoop(ts) {
  if (!CAM.on) { CAM.loopOn = false; return; } requestAnimationFrame(camLoop); const v = CAM.video; if (v.readyState < 2) return;
  if (UI.camOv.width !== v.videoWidth) { UI.camOv.width = v.videoWidth; UI.camOv.height = v.videoHeight; }
  const dt = ts - CAM.lastT; if (dt < (CFG.vq >= 1 ? 14 : 33)) return; CAM.lastT = ts; CAM.frames++; CAM.fps = CAM.fps * .9 + (1000 / dt) * .1; cfTick(ts);
  const g = UI.camOv.getContext('2d'), W = UI.camOv.width, H = UI.camOv.height; g.clearRect(0, 0, W, H); const cs = vcol(), c = CAM.cal;
  if (c) { g.lineWidth = Math.max(1, W / 900); g.strokeStyle = cs.a; g.globalAlpha = .75; for (let f = 0; f <= 22; f++) { const a = fretPoint(f, 0), b = fretPoint(f, 5); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); } for (let s = 0; s < 6; s++) { const a = fretPoint(0, s), b = fretPoint(22, s); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); } g.globalAlpha = 1; }
  CAM.pts.forEach((p, i) => { g.fillStyle = cs.b; g.beginPath(); g.arc(p.x, p.y, 7, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = `${Math.round(W / 50)}px sans-serif`; g.fillText(String(i + 1), p.x + 10, p.y - 8); });
  let seen = false; const nowp = performance.now();
  if (CAM.track === 'hand' && CAM.tracker) {
    try {
      const res = CAM.tracker.detectForVideo(v, nowp); const hs = res && res.landmarks || [];
      if (hs.length) {
        seen = true; hs.forEach(lm => {
          g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = Math.max(1, W / 700); [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [0, 17, 18, 19, 20], [5, 9, 13, 17]].forEach(ch => { g.beginPath(); ch.forEach((i, k) => g[k ? 'lineTo' : 'moveTo'](lm[i].x * W, lm[i].y * H)); g.stroke(); });
          if (!c) return; const tips = [8, 12, 16, 20], names = ['1', '2', '3', '4'];
          tips.forEach((ti, k) => {
            const px = lm[ti].x * W, py = lm[ti].y * H, nc = neckCoords(px, py); if (!nc) return; const prev = CAM.fingerLast[ti], vel = prev ? Math.hypot(px - prev.x, py - prev.y) / (W / 100) : 9; CAM.fingerLast[ti] = { x: px, y: py };
            const inside = nc.string > -.6 && nc.string < 5.6 && nc.fret > .2 && nc.fret < 22.5, st = clamp(Math.round(nc.string), 0, 5), fr = Math.max(1, Math.ceil(nc.fret - 1e-6));
            g.fillStyle = inside ? cs.b : 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(px, py, Math.max(5, W / 130), 0, 7); g.fill();
            if (inside && vel < 1.4) { VIS.cands.push({ t: nowp, st, fret: fr, finger: names[k] }); if (REC && REC.cam) REC.cam.push({ t: (nowp - REC.perf0) / 1000, st, fret: fr }); g.fillStyle = '#fff'; g.font = `700 ${Math.round(W / 55)}px ui-monospace,monospace`; g.fillText(names[k] + ':' + fr, px + 8, py - 8); if (k === 0 || true) { CAM.fretHist[fr]++; CAM.stringHist[st]++; } }
          });
        }); if (VIS.cands.length > 40) VIS.cands.splice(0, VIS.cands.length - 40);
      }
    } catch (e) { CAM.track = 'motion'; toast('Hand tracker failed — falling back to motion energy', 'warn'); }
  } else if (c && CAM.frames % 2 === 0) motionEnergy(g, W, H, cs);
  if (seen) CAM.handFrames++;
}
function motionEnergy(g, W, H, cs) {
  const sw = 160, sh = Math.round(160 * H / W); if (!CAM.tmp) { CAM.tmp = document.createElement('canvas'); } CAM.tmp.width = sw; CAM.tmp.height = sh; const q = CAM.tmp.getContext('2d', { willReadFrequently: true }); q.drawImage(CAM.video, 0, 0, sw, sh); const d = q.getImageData(0, 0, sw, sh).data, gray = new Uint8Array(sw * sh);
  for (let i = 0; i < gray.length; i++) gray[i] = (d[i * 4] * 3 + d[i * 4 + 1] * 6 + d[i * 4 + 2]) / 10; const m = new Array(13).fill(0), cnt = new Array(13).fill(0);
  if (CAM.prevGray && CAM.prevGray.length === gray.length) { const sc = sw / W; for (let y = 0; y < sh; y += 2) for (let x = 0; x < sw; x += 2) { const nc = neckCoords(x / sc, y / sc); if (!nc || nc.string < -.6 || nc.string > 5.6 || nc.fret > 12) continue; const z = Math.min(12, Math.floor(nc.fret)); m[z] += Math.abs(gray[y * sw + x] - CAM.prevGray[y * sw + x]); cnt[z]++; } }
  CAM.prevGray = gray; let best = 0, bz = -1; m.forEach((v, i) => { const e = cnt[i] ? v / cnt[i] : 0; CAM.motion[i] = CAM.motion[i] * .8 + e * .2; if (CAM.motion[i] > best) { best = CAM.motion[i]; bz = i; } });
  if (bz >= 0 && best > 3) { CAM.handFrames++; CAM.fretHist[Math.max(1, bz)]++; } g.fillStyle = cs.b; CAM.motion.forEach((e, i) => { const a = fretPoint(i, 5), b = fretPoint(i + 1, 5); g.globalAlpha = clamp(e / 25, 0, .6); g.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y) - 20, Math.abs(b.x - a.x) + 2, 40); }); g.globalAlpha = 1;
}
function updateCamStats() {
  if (!UI.camStats || !paneVisible('cam')) return; const st = (l, v, s) => h('div', { class: 'stat' }, h('span', {}, l), h('b', {}, v), h('small', {}, s || ''));
  const agree = STAT.fuseT ? (100 * STAT.fuseA / STAT.fuseT).toFixed(0) + '%' : '—', tr = CAM.frames ? (100 * CAM.handFrames / CAM.frames).toFixed(0) + '%' : '—';
  UI.camStats.innerHTML = ''; UI.camStats.append(st('Camera fps', CAM.on ? CAM.fps.toFixed(0) : '—', 'processing rate'), st('Hand found', tr, 'of processed frames'), st('Calibrated', CAM.cal ? 'yes' : 'no', CAM.track), st('Audio↔camera agree', agree, STAT.fuseT + ' notes compared'), st('Tracker', CAM.track === 'hand' ? 'MediaPipe' : CAM.track === 'motion' ? 'motion' : '—', ''));
  const c = UI.camChart, d = window.devicePixelRatio || 1; c.width = c.clientWidth * d; c.height = c.clientHeight * d; barChart(c, CAM.fretHist.slice(0, 23).map((v, i) => v), Array.from({ length: 23 }, (_, i) => i ? String(i) : ''), TL.col.accent);
}

/* ---------------- RESEARCH ---------------- */
function barChart(c, vals, labels, col, o = {}) {
  const g = c.getContext('2d'), W = c.width, H = c.height, d = window.devicePixelRatio || 1, mx = Math.max(o.max || 0, ...vals, 1e-9), n = vals.length, bw = W / n, padB = 14 * d; g.clearRect(0, 0, W, H);
  g.fillStyle = TL.col.grid; if (o.zero != null) g.fillRect(0, H - padB - (o.zero / mx) * (H - padB - 4 * d), W, 1);
  vals.forEach((v, i) => { const hh = (v / mx) * (H - padB - 4 * d); g.fillStyle = (o.colors && o.colors[i]) || col; g.globalAlpha = .85; g.fillRect(i * bw + 1, H - padB - hh, Math.max(1, bw - 2), hh); g.globalAlpha = 1; if (labels && labels[i] != null && (n <= 26 || i % 5 === 0)) { g.fillStyle = TL.col.muted; g.font = `${9 * d}px ui-monospace,monospace`; g.textAlign = 'center'; g.fillText(labels[i], i * bw + bw / 2, H - 3 * d); } });
}
function lineChart(c, series, o = {}) {
  const g = c.getContext('2d'), W = c.width, H = c.height, d = window.devicePixelRatio || 1; g.clearRect(0, 0, W, H); const lo = o.min, hi = o.max;
  g.strokeStyle = TL.col.grid; g.lineWidth = 1; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, H * i / 4); g.lineTo(W, H * i / 4); g.stroke(); }
  if (o.zero) { g.strokeStyle = TL.col.line2; g.beginPath(); g.moveTo(0, H * (hi) / (hi - lo)); g.lineTo(W, H * hi / (hi - lo)); g.stroke(); }
  series.forEach(s => { g.strokeStyle = s.col; g.lineWidth = 1.6 * d; g.beginPath(); let pen = false; s.v.forEach((v, i) => { if (v == null || !isFinite(v)) { pen = false; return; } const x = i / Math.max(1, s.v.length - 1) * W, y = H - (clamp(v, lo, hi) - lo) / (hi - lo) * H; pen ? g.lineTo(x, y) : g.moveTo(x, y); pen = true; }); g.stroke(); });
  g.fillStyle = TL.col.muted; g.font = `${9 * d}px ui-monospace,monospace`; g.textAlign = 'left'; g.fillText(hi + (o.unit || ''), 3, 10 * d); g.fillText(lo + (o.unit || ''), 3, H - 3 * d);
}
const LABS = {};
function buildLabPane() {
  const p = PANES.lab; LABS.grid = h('div', { class: 'stat-grid' }); const ch = (t, k) => { const c = h('canvas', { class: 'chart', style: { height: '112px' } }); LABS[k] = c; return h('div', {}, h('div', { class: 'small muted', style: { marginBottom: '2px' } }, t), c); };
  LABS.take = h('div'); LABS.nb = h('textarea', { class: 'in', rows: 4, placeholder: 'Lab notebook: hypothesis, setup (guitar, strings, pickups, interface gain/buffer), conditions, observations… Saved locally and included in the session export.', style: { width: '100%', fontFamily: 'var(--sans)' }, oninput: e => store.set('notebook', e.target.value) }, store.get('notebook', ''));
  p.append(h('div', { class: 'card' }, h('h4', {}, 'Session measurements ', h('span', { class: 'row', style: { gap: '5px' } },
    h('button', { class: 'btn sm', onclick: () => measureRTT().then(() => updateLab(true)) }, '⏱ Loopback latency test'), h('button', { class: 'btn sm', onclick: () => download('the-daily.studio_session_' + Date.now() + '.csv', statsCSV(), 'text/csv') }, '⤓ CSV'), h('button', { class: 'btn sm', onclick: exportSession }, '⤓ Session JSON'), h('button', { class: 'btn sm bad', onclick: () => { if (confirm('Reset all session statistics?')) resetStats(); } }, 'Reset'))),
    h('div', { class: 'card-b' }, LABS.grid)),
    h('div', { class: 'card' }, h('h4', {}, 'Distributions'), h('div', { class: 'card-b', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '10px' } },
      ch('Pitch-class usage (time-weighted)', 'cPc'), ch('Mean cents deviation by pitch class (−50…+50 ¢)', 'cDev'), ch('Timing vs click (ms; − early, + late)', 'cTim'), ch('Pitch deviation, last 24 s (¢)', 'cCents'), ch('Level, last 24 s (dBFS)', 'cRms'), ch('Notes per octave', 'cOct'))),
    h('div', { class: 'card' }, h('h4', {}, 'Takes'), h('div', { class: 'card-b' }, LABS.take)),
    h('div', { class: 'card' }, h('h4', {}, 'Lab notebook'), h('div', { class: 'card-b' }, LABS.nb)),
    h('div', { class: 'card' }, h('h4', {}, 'Methods & definitions'), h('div', { class: 'card-b small', style: { lineHeight: 1.55 } }, METHODS_HTML())));
  setInterval(() => updateLab(), 400);
}
function METHODS_HTML() {
  const li = (a, b) => h('li', {}, h('b', {}, a + ' '), b);
  return h('ul', { style: { margin: 0, paddingLeft: '18px' } },
    li('f0:', 'YIN difference function with cumulative-mean normalization (de Cheveigné & Kawahara 2002), absolute threshold 0.12, parabolic interpolation, 2× decimation, 3-frame median; accepted when clarity (1−d′) > 0.8 and 60–1400 Hz. Sampled every ~33 ms from the dry DI so amp tone cannot bias pitch.'),
    li('Cents:', '100·(12·log₂(f0/A4)+69 − round(·)); A4 per Settings. Intonation = mean |cents| over the last 75% of each note (attack transient dropped), reported with σ across notes.'),
    li('Vibrato:', 'cents trace detrended with a 25-frame moving average; rate from zero-crossings, extent = half peak-to-peak; accepted for 3.5–9.5 Hz and > 6 ¢.'),
    li('HFR:', 'RMS of harmonics 2–6 relative to the fundamental in a 16384-pt FFT (dB). Higher = brighter/harsher attack; a pick-position and technique proxy, not a calibrated loudness measure.'),
    li('Key & chord:', 'Krumhansl–Schmuckler correlation over duration-weighted pitch classes; chords by cosine similarity between smoothed chroma and 9 chord templates (root weighted ×1.25).'),
    li('Timing:', 'onsets from a spectral-flux-like detector in the AudioWorklet tap, shifted by the measured round-trip latency, compared with the nearest scheduled click grid slot (default 8th notes). SD is the “tightness” figure; mean is your lead/lag.'),
    li('Latency:', 'loopback test plays six 8 ms chirps and finds each in the returned signal by cross-correlation with sub-sample parabolic refinement; median and σ are reported. Browsers add buffering you cannot see, so only this measured value should be trusted for alignment.'),
    li('Noise floor / SNR:', 'median dBFS of input when below the activity gate; SNR = median active level − noise floor.'),
    li('Audio↔camera agreement:', 'fraction of detected notes whose pitch matches a camera-derived (string, fret) candidate from the previous 500 ms (or an open string with no fretting finger visible).'),
    li('Limits:', 'monophonic pitch tracking; polyphonic passages are handled by chroma only. Statistics are descriptive, single-session and single-instrument; they are not a substitute for controlled measurement.'));
}
function updateLab(force) {
  if (!LABS.grid || (!paneVisible('lab') && !force)) return; const st = (l, v, s) => h('div', { class: 'stat' }, h('span', {}, l), h('b', {}, v), h('small', {}, s || ''));
  const tm = STAT.timing, ca = STAT.noteCents, now = (performance.now() - STAT.t0) / 1000, f = (x, n = 1) => (x == null || !isFinite(x)) ? '—' : x.toFixed(n);
  const noiseRaw = STAT.noise.length ? median(STAT.noise) : null, noise = noiseRaw != null && noiseRaw > -110 ? noiseRaw : null, act = STAT.actRms.length ? median(STAT.actRms) : null, hf = STAT.rows.filter(r => r.hfr != null).map(r => r.hfr), lat = rttMs(), L_ = latencyInfo();
  LABS.grid.innerHTML = ''; LABS.grid.append(
    st('Session time', fmtTime(now).slice(0, 5), 'active ' + (100 * STAT.activeS / Math.max(1, now)).toFixed(0) + '%'), st('Notes detected', String(STAT.notes), STAT.onsets + ' onsets'),
    st('Intonation', ca.length ? f(mean(ca.map(n => n.abs))) + ' ¢' : '—', 'mean |dev|, σ ' + f(ca.length > 2 ? sd(ca.map(n => n.mean)) : null) + ' ¢'), st('Timing mean', tm.length ? f(mean(tm)) + ' ms' : '—', tm.length + ' hits'), st('Timing SD', tm.length > 2 ? f(sd(tm)) + ' ms' : '—', 'tightness vs click'),
    st('Timing 95th |Δ|', tm.length > 4 ? f(pctl(tm.map(Math.abs), .95)) + ' ms' : '—', 'worst-case'), st('Vibrato events', String(STAT.vibN), AN.vib ? 'now ' + f(AN.vib.rate) + ' Hz / ±' + f(AN.vib.ext, 0) + '¢' : ''), st('Attack harshness HFR', hf.length ? f(median(hf)) + ' dB' : '—', 'h2–h6 vs fundamental'),
    st('Noise floor', noise == null ? '—' : f(noise) + ' dBFS', noiseRaw != null && noise == null ? 'digital silence (no analog noise)' : 'idle input'), st('SNR', noise != null && act != null ? f(act - noise) + ' dB' : '—', 'active vs idle'), st('Crest factor', AN.crest ? f(20 * Math.log10(AN.crest)) + ' dB' : '—', 'peak/RMS now'), st('Clip warnings', String(STAT.clipF), 'sustained clipping'),
    st('Key estimate', AN.key ? pcName(AN.key[0].root) + (AN.key[0].minor ? ' minor' : ' major') : '—', AN.key ? 'r = ' + f(AN.key[0].r, 2) + ' · next ' + pcName(AN.key[1].root) + (AN.key[1].minor ? 'm' : '') : 'needs ≥ 8 notes'),
    st('Round-trip latency', f(lat) + ' ms', CFG.rtt != null ? 'measured' : 'estimated'), st('Sample rate', E.ready ? E.ctx.sampleRate / 1000 + ' kHz' : '—', L_ ? 'out ' + (L_.base + L_.out).toFixed(1) + ' ms' : ''), st('Camera agree', STAT.fuseT ? (100 * STAT.fuseA / STAT.fuseT).toFixed(0) + '%' : '—', STAT.fuseT + ' compared'));
  const g = Array.from({ length: 12 }, (_, i) => STAT.pcDur[i] + STAT.pcN[i] * .15), dev = Array.from({ length: 12 }, (_, i) => { const a = ca.filter(n => n.midi % 12 === i).map(n => n.mean); return a.length ? mean(a) : 0; });
  const d = window.devicePixelRatio || 1; const fit = c => { c.width = c.clientWidth * d; c.height = c.clientHeight * d; };
  ['cPc', 'cDev', 'cTim', 'cCents', 'cRms', 'cOct'].forEach(k => fit(LABS[k])); const pcl = Array.from({ length: 12 }, (_, i) => pcName(i));
  barChart(LABS.cPc, g, pcl, TL.col.accent); barChart(LABS.cDev, dev.map(v => Math.abs(v)), pcl, TL.col.accent, { max: 50, colors: dev.map(v => v >= 0 ? TL.col.cv[3] : TL.col.cv[2]) });
  const bins = new Array(25).fill(0); tm.forEach(v => { const b = Math.round((clamp(v, -60, 60) + 60) / 5); bins[b]++; }); barChart(LABS.cTim, bins, bins.map((_, i) => (i * 5 - 60) % 20 === 0 ? String(i * 5 - 60) : ''), TL.col.accent, { colors: bins.map((_, i) => Math.abs(i * 5 - 60) <= 10 ? TL.col.cv[4] : TL.col.accent) });
  lineChart(LABS.cCents, [{ v: STAT.centsHist, col: TL.col.accent }], { min: -50, max: 50, unit: '¢', zero: 1 }); lineChart(LABS.cRms, [{ v: STAT.rmsHist, col: TL.col.cv[1] }], { min: -80, max: 0, unit: ' dB' });
  const oc = []; for (let o = 1; o <= 6; o++) oc.push(STAT.oct[o] || 0); barChart(LABS.cOct, oc, ['1', '2', '3', '4', '5', '6'], TL.col.cv[2]);
  const tk = LABS.take; tk.innerHTML = ''; if (!TAKES.length) tk.append(h('span', { class: 'muted' }, 'No takes yet. Arm the record button and play; each take stores the dry DI (for re-amping) and the wet print.'));
  else { const t = h('table', { class: 'tbl' }, h('tr', {}, ['Take', 'Dur', 'Peak', 'RMS', 'Tempo', 'Preset', '|Cents|', 'Timing σ'].map(x => h('th', {}, x)))); tkLeads().forEach(x => t.append(h('tr', {}, [x.name, f(x.dur) + ' s', f(x.peak) + ' dB', f(x.rms) + ' dB', x.bpm, x.preset || '', x.stats && x.stats.centsAbs != null ? x.stats.centsAbs : '—', x.stats && x.stats.timingSD != null ? x.stats.timingSD : '—'].map(c => h('td', {}, String(c)))))); tk.append(t); }
}
function exportSession() {
  const doc = { format: 'the-daily.studio-session', version: 1, saved: new Date().toISOString(), app: BRAND.name + ' ' + VERSION, song: { title: S.title, bpm: S.bpm, tuning: S.tuningName, capo: S.capo, key: keyName() },
    engine: { sampleRate: E.ready ? E.ctx.sampleRate : null, baseLatency: E.ready ? E.ctx.baseLatency : null, outputLatency: E.ready ? E.ctx.outputLatency : null, rttMs: rttMs(), rttMeasured: CFG.rtt != null, worklet: E.worklet, a4: CFG.a4, inputSettings: E.inSettings || null },
    stats: { notes: STAT.notes, onsets: STAT.onsets, activeSeconds: STAT.activeS, pitchClassSeconds: STAT.pcDur, perNoteCents: STAT.noteCents, timingMs: STAT.timing, vibratoEvents: STAT.vibN, clipWarnings: STAT.clipF, key: AN.key, cameraAgreement: { compared: STAT.fuseT, agreed: STAT.fuseA }, fretUsage: CAM.fretHist },
    takes: tkLeads().map(t => ({ name: t.name, durationS: t.dur, peakDb: t.peak, rmsDb: t.rms, bpm: t.bpm, preset: t.preset, stats: t.stats })), notebook: store.get('notebook', '') };
  download('the-daily.studio_session_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json', JSON.stringify(doc, null, 1), 'application/json'); toast('Session record saved (plain JSON + CSV keep the data readable without this app)', 'ok');
}
