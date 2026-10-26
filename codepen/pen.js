(()=>{'use strict';
/* >>> parts/01-core.js */
/* ============================================================
   the-daily.studio  ·  MIT License
   Single-file vanilla JS · Web Audio · AudioWorklet · WebMIDI · getUserMedia
   Part 01 · core helpers, settings, music theory, chord voicing engine
   ============================================================ */
const VERSION = '1.7.0';
/* support: paste your tip-jar page here (Ko-fi, Buy Me a Coffee, GitHub Sponsors, PayPal.me...). Empty = no support link is shown anywhere. */
const BRAND = { support: '', supportLabel: 'Buy me a coffee', name: 'the-daily.studio', short: 'the-daily.studio', tag: 'Write. Play. Create.', domain: 'the-daily.studio', url: 'https://the-daily.studio/', author: 'Tehau DeBarthe', github: 'https://github.com/TehauD', linkedin: 'https://www.linkedin.com/in/tehau/', repo: 'https://github.com/TehauD/the-daily.studio', journal: 'https://the-daily.studio/journal/' };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const SVGNS = 'http://www.w3.org/2000/svg';
function h(tag, a, ...kids) {
  const e = document.createElement(tag);
  if (a) for (const k in a) {
    const v = a[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k === 'html') e.innerHTML = v;
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(9)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(c)); }
  return e;
}
function sv(tag, a, ...kids) {
  const e = document.createElementNS(SVGNS, tag);
  if (a) for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]);
  for (const c of kids.flat(9)) { if (c == null) continue; e.append(c.nodeType ? c : document.createTextNode(c)); }
  return e;
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const dB = x => 20 * Math.log10(Math.max(x, 1e-9));
const fromDB = d => Math.pow(10, d / 20);
const uid = () => Math.random().toString(36).slice(2, 9);
const pad = (n, w = 2) => String(n).padStart(w, '0');
const fmtTime = s => { s = Math.max(0, s); const m = Math.floor(s / 60); return pad(m) + ':' + pad(Math.floor(s % 60)) + '.' + pad(Math.floor((s % 1) * 100)); };
const median = a => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const sd = a => { if (a.length < 2) return NaN; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / (a.length - 1)); };
const pctl = (a, p) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); return b[clamp(Math.round(p * (b.length - 1)), 0, b.length - 1)]; };

/* persistent storage with in-memory fallback (CodePen iframes may block localStorage) */
const store = {
  mem: {},
  locked: false,   // set while a reset is running: nothing may be written back
  get(k, d) { try { const v = localStorage.getItem('fw.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return k in this.mem ? this.mem[k] : d; } },
  set(k, v) { if (this.locked) return; try { localStorage.setItem('fw.' + k, JSON.stringify(v)); } catch (e) { this.mem[k] = v; } }
};
const bus = {
  l: {},
  on(e, f) { (this.l[e] = this.l[e] || []).push(f); },
  off(e, f) { this.l[e] = (this.l[e] || []).filter(x => x !== f); },
  emit(e, ...a) { (this.l[e] || []).forEach(f => { try { f(...a); } catch (err) { console.error('[bus ' + e + ']', err); } }); }
};
function toast(msg, kind = '') {
  const box = $('#toasts'); if (!box) return console.log(msg);
  const t = h('div', { class: 'toast ' + kind }, msg); box.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3400);
}
function download(name, data, type = 'text/plain') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copied to clipboard', 'ok'); }
  catch (e) { const ta = h('textarea', { style: { position: 'fixed', opacity: 0 } }); ta.value = t; document.body.append(ta); ta.select(); try { document.execCommand('copy'); toast('Copied to clipboard', 'ok'); } catch (e2) { toast('Copy failed — select and copy manually', 'bad'); } ta.remove(); }
}

/* ---------- settings ---------- */
const CFG = Object.assign({
  theme: 'light', a4: 440, flats: false, left: false, fft: 8192, smooth: 0.8, accent: 'lagoon', reduce: false,
  monitor: false, autoIn: false, kpad: true, rtt: null, hint: 'interactive', sr: 'auto', inDev: '', outDev: '', camDev: '', mirror: true, ch: 'auto',
  countIn: 1, metroVol: 0.5, ugWidth: 72, ugTags: true, midimap: {}, ui: 1, vq: 1, humanize: 0.15, visMode: 'hex', hfrOn: true,
  rec: { dry: true, wet: true }, fretNames: 'notes',
  vin: 'off', armG: true, armV: true, voxMon: false, voxPolish: true, voxTrim: 0, trackSync: true, trackFill: 'all'
}, store.get('cfg', {}));
const saveCfg = () => store.set('cfg', CFG);

/* ---------- music theory ---------- */
const NS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NF = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
/* escape text before it goes into an HTML string (song titles, section names and imported data are untrusted) */
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pcName = (pc, fl = CFG.flats) => (fl ? NF : NS)[((Math.round(pc) % 12) + 12) % 12];
const midiName = (m, fl) => pcName(m, fl) + (Math.floor(m / 12) - 1);
const mtof = m => CFG.a4 * Math.pow(2, (m - 69) / 12);
const ftom = f => 69 + 12 * Math.log2(f / CFG.a4);
function parsePc(s) {
  const m = /^([A-Ga-g])([#b♯♭]?)$/.exec(s); if (!m) return null;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()];
  const acc = (m[2] === '#' || m[2] === '♯') ? 1 : (m[2] ? -1 : 0);
  return (base + acc + 12) % 12;
}
const FLAT_MAJORS = new Set([5, 10, 3, 8, 1, 6]);
const keyUsesFlats = (root, minor) => FLAT_MAJORS.has(minor ? (root + 3) % 12 : root);

const TUNINGS = {
  'Standard (E A D G B E)': [40, 45, 50, 55, 59, 64],
  'Half-step down (Eb)': [39, 44, 49, 54, 58, 63],
  'Whole-step down (D)': [38, 43, 48, 53, 57, 62],
  'C# standard (1½ steps down)': [37, 42, 47, 52, 56, 61],
  'C standard (2 steps down)': [36, 41, 46, 51, 55, 60],
  'B standard (2½ steps down)': [35, 40, 45, 50, 54, 59],
  'Drop D': [38, 45, 50, 55, 59, 64],
  'Drop C# (C# G# C# F# A# D#)': [37, 44, 49, 54, 58, 63],
  'Drop C': [36, 43, 48, 53, 57, 62],
  'Drop B': [35, 42, 47, 52, 56, 61],
  'Drop Bb (Bb F Bb Eb G C)': [34, 41, 46, 51, 55, 60],
  'Drop A': [33, 40, 45, 50, 54, 59],
  'Double Drop D': [38, 45, 50, 55, 59, 62],
  'DADGAD': [38, 45, 50, 55, 57, 62],
  'All fourths (E A D G C F)': [40, 45, 50, 55, 60, 65],
  'Open G · Slack-key Taro Patch (D G D G B D)': [38, 43, 50, 55, 59, 62],
  'Slack-key Wahine (D G D F# A D)': [38, 43, 50, 54, 57, 62],
  'Open D (D A D F# A D)': [38, 45, 50, 54, 57, 62],
  'Open Dm (D A D F A D)': [38, 45, 50, 53, 57, 62],
  'Open E (E B E G# B E)': [40, 47, 52, 56, 59, 64],
  'Open C (C G C G C E)': [36, 43, 48, 55, 60, 64],
  'Open A (E A E A C# E)': [40, 45, 52, 57, 61, 64]
};
const SCALES = {
  'Major (Ionian)': [0, 2, 4, 5, 7, 9, 11], 'Natural Minor (Aeolian)': [0, 2, 3, 5, 7, 8, 10],
  'Major Pentatonic': [0, 2, 4, 7, 9], 'Minor Pentatonic': [0, 3, 5, 7, 10], 'Blues': [0, 3, 5, 6, 7, 10],
  'Dorian': [0, 2, 3, 5, 7, 9, 10], 'Phrygian': [0, 1, 3, 5, 7, 8, 10], 'Lydian': [0, 2, 4, 6, 7, 9, 11],
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10], 'Locrian': [0, 1, 3, 5, 6, 8, 10], 'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
  'Melodic Minor': [0, 2, 3, 5, 7, 9, 11], 'Phrygian Dominant': [0, 1, 4, 5, 7, 8, 10], 'Whole Tone': [0, 2, 4, 6, 8, 10],
  'Diminished (W-H)': [0, 2, 3, 5, 6, 8, 9, 11], 'Hirajoshi': [0, 2, 3, 7, 8]
};
const IVNAMES = ['R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

const QUALS = [
  [['', 'maj', 'M'], [0, 4, 7], ''], [['m', 'min', '-'], [0, 3, 7], 'm'], [['5'], [0, 7], '5'], [['6'], [0, 4, 7, 9], '6'],
  [['m6'], [0, 3, 7, 9], 'm6'], [['7', 'dom7'], [0, 4, 7, 10], '7'], [['maj7', 'M7', 'Maj7', 'Δ', 'Δ7'], [0, 4, 7, 11], 'maj7'],
  [['m7', 'min7', '-7'], [0, 3, 7, 10], 'm7'], [['m7b5', 'ø', 'ø7'], [0, 3, 6, 10], 'm7b5'], [['dim', '°', 'o'], [0, 3, 6], 'dim'],
  [['dim7', '°7', 'o7'], [0, 3, 6, 9], 'dim7'], [['aug', '+'], [0, 4, 8], 'aug'], [['sus2'], [0, 2, 7], 'sus2'],
  [['sus4', 'sus'], [0, 5, 7], 'sus4'], [['7sus4', '7sus'], [0, 5, 7, 10], '7sus4'], [['add9', '2'], [0, 4, 7, 2], 'add9'],
  [['madd9'], [0, 3, 7, 2], 'madd9'], [['9'], [0, 4, 7, 10, 2], '9'], [['m9'], [0, 3, 7, 10, 2], 'm9'],
  [['maj9', 'M9'], [0, 4, 7, 11, 2], 'maj9'], [['11'], [0, 4, 7, 10, 2, 5], '11'], [['13'], [0, 4, 7, 10, 2, 9], '13'],
  [['mMaj7', 'mM7'], [0, 3, 7, 11], 'mMaj7'], [['7#9'], [0, 4, 7, 10, 3], '7#9'], [['7b9'], [0, 4, 7, 10, 1], '7b9']
];
const QMAP = {}; QUALS.forEach(([al, iv, c]) => al.forEach(a => QMAP[a] = { iv, c }));
function parseChord(sym) {
  if (!sym) return null;
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(sym.trim()); if (!m) return null;
  const root = parsePc(m[1]), q = QMAP[m[2]]; if (root == null || !q) return null;
  const bass = m[3] ? parsePc(m[3]) : root;
  const pcs = [...new Set(q.iv.map(i => (root + i) % 12))]; if (!pcs.includes(bass)) pcs.push(bass);
  return { root, bass, q: q.c, iv: q.iv, pcs, sym: sym.trim(), name: m[1] + q.c + (m[3] ? '/' + m[3] : '') };
}

/* diatonic harmony */
const QNAME3 = { '0,4,7': ['', 'maj'], '0,3,7': ['m', 'min'], '0,3,6': ['dim', 'dim'], '0,4,8': ['aug', 'aug'] };
const QNAME7 = { '0,4,7,11': 'maj7', '0,3,7,10': 'm7', '0,4,7,10': '7', '0,3,6,10': 'm7b5', '0,3,6,9': 'dim7', '0,3,7,11': 'mMaj7', '0,4,8,11': 'augMaj7' };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
function diatonic(root, scaleName) {
  const s = SCALES[scaleName]; if (!s || s.length !== 7) return [];
  const fl = keyUsesFlats(root, scaleName.startsWith('Natural Minor') || scaleName === 'Dorian' || scaleName === 'Phrygian' || scaleName === 'Locrian' || scaleName.includes('Minor'));
  return s.map((_, i) => {
    const n = k => (s[(i + k) % 7] + (i + k >= 7 ? 12 : 0)) - s[i];
    const t3 = [0, n(2), n(4)].join(), t7 = [0, n(2), n(4), n(6)].join();
    const r = (root + s[i]) % 12, q3 = QNAME3[t3] || ['?', '?'], q7 = QNAME7[t7] || '';
    const minorish = q3[0] === 'm' || q3[0] === 'dim';
    let rn = ROMAN[i]; if (minorish) rn = rn.toLowerCase(); if (q3[0] === 'dim') rn += '°'; if (q3[0] === 'aug') rn += '+';
    return { deg: i, roman: rn, root: r, triad: pcName(r, fl) + q3[0], seventh: q7 ? pcName(r, fl) + q7 : '' };
  });
}
const PROGS = [
  ['I–V–vi–IV  Pop', 'I V vi IV'], ['vi–IV–I–V', 'vi IV I V'], ['I–IV–V–IV  Three-chord', 'I IV V IV'], ['I–vi–IV–V  ’50s', 'I vi IV V'],
  ['12-bar blues', 'I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7'], ['ii–V–I  Jazz', 'ii7 V7 Imaj7 Imaj7'], ['i–VII–VI–VII  Aeolian rock', 'i VII VI VII'],
  ['i–VI–III–VII', 'i VI III VII'], ['i–iv–v  Minor loop', 'i iv v i'], ['Andalusian  i–VII–VI–V', 'i VII VI V'], ['Canon in D shape', 'I V vi iii IV I IV V'],
  ['Mixolydian vamp  I–bVII–IV', 'I bVII IV I'], ['I–V–vi–iii–IV–I–IV–V', 'I V vi iii IV I IV V']
];
function romanToChord(tok, keyRoot, minor) {
  const m = /^(b|#)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(°|dim|\+|aug)?(maj7|M7|7|9|sus4|sus2|add9)?$/.exec(tok); if (!m) return null;
  const deg = ROMAN.indexOf(m[2].toUpperCase()), lower = m[2] === m[2].toLowerCase();
  const sc = minor ? SCALES['Natural Minor (Aeolian)'] : SCALES['Major (Ionian)'];
  const r = (keyRoot + sc[deg] + (m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0) + 12) % 12;
  let q = lower ? 'm' : ''; if (m[3] === '°' || m[3] === 'dim') q = 'dim'; if (m[3] === '+' || m[3] === 'aug') q = 'aug';
  if (m[4]) { if (m[4] === 'maj7' || m[4] === 'M7') q = (lower ? 'mMaj7' : 'maj7'); else if (m[4] === '7') q = lower ? (q === 'dim' ? 'dim7' : 'm7') : '7'; else q += m[4]; }
  return pcName(r, keyUsesFlats(keyRoot, minor)) + q;
}

/* ---------- guitar chord voicing engine (tuning/capo aware, searched not looked up) ---------- */
const vcCache = new Map();
function voicings(sym, tuning, capo = 0, limit = 6) {
  const key = sym + '|' + tuning.join() + '|' + capo;
  if (vcCache.has(key)) return vcCache.get(key).slice(0, limit);
  const c = parseChord(sym); if (!c) return [];
  const open = tuning.map(t => t + capo), pcs = c.pcs;
  const fifth = (c.root + 7) % 12, req = new Set(pcs);
  if (c.iv.length >= 4 && !/dim|aug|b5/.test(c.q)) req.delete(fifth);
  const found = new Map();
  for (let b = 0; b <= 11; b++) {
    const lo = Math.max(1, b), hi = lo + 3;
    const opts = open.map(o => { const a = [null]; if (b <= 3 && pcs.includes(o % 12)) a.push(0); for (let f = lo; f <= hi; f++) if (pcs.includes((o + f) % 12)) a.push(f); return a; });
    const cur = new Array(6);
    const rec = i => {
      if (i === 6) return evalV(cur);
      for (const f of opts[i]) { cur[i] = f; rec(i + 1); }
    };
    const evalV = v => {
      const snd = []; v.forEach((f, i) => { if (f != null) snd.push(i); });
      if (snd.length < (c.q === '5' ? 2 : 3)) return;
      const first = snd[0], last = snd[snd.length - 1];
      let inner = 0; for (let i = first; i <= last; i++) if (v[i] == null) inner++;
      if (inner > 1) return;
      if ((open[first] + v[first]) % 12 !== c.bass) return;
      const have = new Set(snd.map(i => (open[i] + v[i]) % 12)); for (const p of req) if (!have.has(p)) return;
      const fr = v.filter(f => f > 0), minF = fr.length ? Math.min(...fr) : 0, maxF = fr.length ? Math.max(...fr) : 0;
      if (maxF - minF > 3) return;
      const atMin = []; v.forEach((f, i) => { if (f === minF && f > 0) atMin.push(i); });
      let barre = false, fingers = fr.filter(f => f > minF).length;
      if (atMin.length >= 2) {
        let ok = true; for (let i = atMin[0]; i <= atMin[atMin.length - 1]; i++) if (v[i] == null || v[i] < minF) ok = false;
        if (ok) { barre = true; fingers += 1; } else fingers += atMin.length;
      } else fingers += atMin.length;
      if (fingers > 4) return;
      const opens = v.filter(f => f === 0).length;
      let sc = -minF * 0.8 + opens * 1.4 + snd.length * 1.2 - inner * 2.5 - (maxF - minF) * 0.5 - fingers * 0.6 - (barre ? 1.2 : 0);
      if (c.q !== '5' && snd.length < 4) sc -= 3;
      const k = v.map(f => f == null ? 'x' : f).join(',');
      if (!found.has(k) || found.get(k).score < sc) found.set(k, { frets: v.slice(), score: sc, base: maxF > 4 ? minF : 1, fingers, barre });
    };
    rec(0);
  }
  const out = [...found.values()].sort((a, b) => b.score - a.score).slice(0, 12);
  vcCache.set(key, out); return out.slice(0, limit);
}
function chordSVG(v, o = {}) {
  const W = o.w || 78, H = o.h || 96, mx = 13, top = 22, cw = (W - 2 * mx) / 5, ch = (H - top - 6) / 5;
  const fr = v.frets, base = v.base || 1;
  const g = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'cdiag', width: W, height: H });
  g.append(sv('line', { x1: mx, x2: W - mx, y1: top, y2: top, stroke: 'currentColor', 'stroke-width': base === 1 ? 3 : 1 }));
  for (let i = 1; i <= 5; i++) g.append(sv('line', { x1: mx, x2: W - mx, y1: top + i * ch, y2: top + i * ch, stroke: 'currentColor', 'stroke-opacity': .35 }));
  for (let s = 0; s < 6; s++) g.append(sv('line', { x1: mx + s * cw, x2: mx + s * cw, y1: top, y2: top + 5 * ch, stroke: 'currentColor', 'stroke-opacity': .55 }));
  fr.forEach((f, s) => {
    const x = mx + s * cw;
    if (f == null) g.append(sv('text', { x, y: top - 8, 'text-anchor': 'middle', 'font-size': 9, fill: 'currentColor', opacity: .6 }, '×'));
    else if (f === 0) g.append(sv('circle', { cx: x, cy: top - 10, r: 3, fill: 'none', stroke: 'currentColor' }));
    else g.append(sv('circle', { cx: x, cy: top + (f - base) * ch + ch / 2, r: 4.6, fill: 'var(--accent)' }));
  });
  if (base > 1) g.append(sv('text', { x: 1, y: top + ch * .75, 'font-size': 8, fill: 'currentColor' }, base + 'fr'));
  return g;
}

/* ---------- song model ---------- */
let S = null;
const spb = () => S.ts[0] * 16 / S.ts[1];           // 16th-slots per bar
const slotDur = () => 15 / S.bpm;                    // seconds per 16th slot (bpm = quarter notes / min)
const newBar = (chord = '') => ({ chord, tab: [] });
function newSong() {
  return {
    v: 1, title: 'Untitled Idea', artist: '', key: 9, minor: true, scale: 'Natural Minor (Aeolian)', bpm: 92, ts: [4, 4], swing: 0,
    tuningName: 'Standard (E A D G B E)', tuning: TUNINGS['Standard (E A D G B E)'].slice(), capo: 0, notes: '',
    sections: [], voicePref: {},
    band: {
      drumsOn: true, kit: 'Acoustic', patName: 'Folk Backbeat', pat: null, bassOn: true, bassStyle: 'Root–Fifth', bassTone: 'Round',
      compOn: true, compStyle: 'Folk D-DU-UDU', compInst: 'Steel', leadOn: true, leadInst: 'Nylon', drumLen: 16
    },
    mix: { drums: { g: .8, p: 0, m: 0, s: 0 }, bass: { g: .8, p: 0, m: 0, s: 0 }, rhythm: { g: .75, p: -.15, m: 0, s: 0 }, lead: { g: .8, p: .15, m: 0, s: 0 }, live: { g: 1, p: 0, m: 0, s: 0 }, vox: { g: 1, p: 0, m: 0, s: 0 }, click: { g: .6, p: 0, m: 0, s: 0 } }
  };
}
function mkSection(name, chords) { return { id: uid(), name, bars: chords.map(c => newBar(c)), lyrics: '' }; }
function flatBars() { const out = []; S.sections.forEach((sec, si) => sec.bars.forEach((bar, bi) => out.push({ sec, si, bar, bi, idx: out.length }))); return out; }
const totalBars = () => S.sections.reduce((a, s) => a + s.bars.length, 0);
const barChords = bar => (bar.chord || '').split(/\s+/).filter(Boolean);
const histStack = { u: [], r: [] };
let saveT = 0;
function snap() { return JSON.stringify(S); }
function commit(push = true) {
  if (push && typeof xpEdit === 'function') xpEdit();
  if (push) { histStack.u.push(histStack.cur || snap()); if (histStack.u.length > 80) histStack.u.shift(); histStack.r.length = 0; }
  histStack.cur = snap();
  bus.emit('song');
  clearTimeout(saveT); saveT = setTimeout(() => { store.set('song', S); store.set('songAt', Date.now()); }, 600);
}
function undo() { if (!histStack.u.length) return; histStack.r.push(histStack.cur); const s = histStack.u.pop(); S = JSON.parse(s); histStack.cur = s; bus.emit('song', 'reload'); }
function redo() { if (!histStack.r.length) return; histStack.u.push(histStack.cur); const s = histStack.r.pop(); S = JSON.parse(s); histStack.cur = s; bus.emit('song', 'reload'); }
/* tuning spelling: flat tunings (Eb, Bb…) read with flats, everything else with sharps unless the user prefers flats */
const tunFlat = () => !!CFG.flats || (/(^|[^A-Za-z#])[A-G]b/.test(S.tuningName || '') && (S.tuningName || '').indexOf('#') < 0);
const tunPc = m => pcName(m, tunFlat());
function stringLabels() { return S.tuning.map(m => tunPc(m)).reverse(); }
const tunNote = m => tunPc(m) + (Math.floor(m / 12) - 1);
const tunShort = () => (/^Custom/.test(S.tuningName || '') ? S.tuning.map(m => tunPc(m)).join(' ') : (S.tuningName || '').split(' (')[0].split(' · ')[0]) + (S.capo ? ' · capo ' + S.capo : '');
function tunMatch(arr) { const k = Object.keys(TUNINGS).find(n => TUNINGS[n].every((m, i) => m === arr[i])); return k || 'Custom (' + arr.map(m => tunPc(m)).join(' ') + ')'; }
function setTuning(arr, name) { xpSignal(2); S.tuning = arr.map(m => clamp(Math.round(m), 24, 79)); S.tuningName = name || tunMatch(S.tuning); S.voicePref = {}; if (!name && !TUNINGS[S.tuningName]) S.tuningName = 'Custom (' + S.tuning.map(m => tunPc(m)).join(' ') + ')'; commit(); }

/* tab note helpers */
const noteMidi = n => S.tuning[n.st] + S.capo + (typeof n.f === 'number' ? n.f : 0);
function fretText(n) {
  if (n.f === 'x') return 'x';
  let t = String(n.f);
  if (n.t === '<>') t = '<' + t + '>';
  if (n.t === 'b') t += 'b' + (n.bend != null ? n.bend : n.f + 2);
  return t;
}
const connectorOf = n => ({ h: 'h', p: 'p', '/': '/', '\\': '\\', '~': '~' }[n.t] || '-');
function fillTab(bar, style, sym) {
  const vs = voicings(sym, S.tuning, S.capo, 1); if (!vs.length) return false;
  const v = S.voicePref[sym] != null ? (voicings(sym, S.tuning, S.capo, 12)[S.voicePref[sym]] || vs[0]) : vs[0];
  const str = []; v.frets.forEach((f, i) => { if (f != null) str.push({ st: i, f }); });
  const N = spb(), add = (s, o) => { if (s < N) bar.tab.push({ s, st: o.st, f: o.f, t: '' }); };
  bar.tab = [];
  if (style === 'Block strum') { for (let b = 0; b < N; b += 4) str.forEach(o => add(b, o)); }
  else if (style === 'Arpeggio ↑↓ 8ths') { const seq = [...str, ...str.slice(1, -1).reverse()]; for (let s = 0, i = 0; s < N; s += 2, i++) add(s, seq[i % seq.length]); }
  else if (style === 'Travis pick') { const lo = str[0], mid = str.slice(1); const pat = [lo, mid[mid.length - 1], mid[0], mid[mid.length - 1], str[1] || lo, mid[mid.length - 1], mid[Math.min(1, mid.length - 1)], mid[mid.length - 1]]; for (let s = 0, i = 0; s < N; s += 2, i++) add(s, pat[i % 8]); }
  else if (style === 'Power chug 8ths') { const p = str.slice(0, 2); for (let s = 0; s < N; s += 2) p.forEach(o => add(s, o)); }
  else if (style === 'Root pulse') { for (let s = 0; s < N; s += 2) add(s, str[0]); }
  else if (style === 'Fingerstyle pop') { const pat = [0, 3, 2, 3, 1, 3, 2, 3]; for (let s = 0, i = 0; s < N; s += 2, i++) add(s, str[pat[i % 8] % str.length]); }
  return true;
}

/* ---------- demo song ---------- */
function demoSong() {
  const s = newSong();
  s.title = 'Salt Wind (demo)'; s.artist = 'Your Name';
  s.sections = [mkSection('Intro', ['Am', 'F']), mkSection('Verse 1', ['Am', 'F', 'C', 'G']), mkSection('Chorus', ['F', 'C', 'G', 'Am']), mkSection('Outro', ['F', 'Am'])];
  s.sections[1].lyrics = "[Am]Salt wind on the [F]water, morning on my [C]skin\n[Am]Same old song I [F]carry, let the [G]day begin\n";
  s.sections[2].lyrics = "[F]Take me where the [C]current goes\n[G]Every road a [Am]river that I know\n";
  return s;
}

/* >>> parts/02-audio.js */
/* ============================================================
   Part 02 · audio engine: worklets, I/O, FX rig, amp/cab/reverb models, presets
   ============================================================ */
const WORKLET_SRC = `
class Gate extends AudioWorkletProcessor{
  constructor(){super();this.p={th:-58,rel:140,hold:40,range:-70};this.env=0;this.g=1;this.open=false;this.hn=0;this.cnt=0;this.port.onmessage=e=>Object.assign(this.p,e.data);}
  process(i,o){const x=i[0],y=o[0];if(!x.length||!y.length)return true;const n=y[0].length,sr=sampleRate,p=this.p;
    const th=Math.pow(10,p.th/20),hy=th*0.65,floor=Math.pow(10,p.range/20);
    const ac=Math.exp(-1/(0.002*sr)),rc=Math.exp(-1/(Math.max(5,p.rel)*0.001*sr)),ed=Math.exp(-1/(0.012*sr)),hs=p.hold*0.001*sr;
    for(let k=0;k<n;k++){let a=0;for(let c=0;c<x.length;c++){const v=Math.abs(x[c][k]);if(v>a)a=v;}
      this.env=a>this.env?a:this.env*ed;
      if(this.env>th){this.open=true;this.hn=hs;}else if(this.env<hy){if(this.hn>0)this.hn--;else this.open=false;}
      const t=this.open?1:floor;this.g=t+(this.g-t)*(this.open?ac:rc);
      for(let c=0;c<y.length;c++){const s=x[c]?x[c][k]:x[0][k];y[c][k]=s*this.g;}}
    return true;}}
registerProcessor('fw-gate',Gate);

class Pitch extends AudioWorkletProcessor{
  static get parameterDescriptors(){return[{name:'semi',defaultValue:0,minValue:-36,maxValue:36,automationRate:'k-rate'},{name:'mix',defaultValue:1,minValue:0,maxValue:1,automationRate:'k-rate'}];}
  constructor(){super();this.N=16384;this.b=new Float32Array(this.N);this.w=0;this.ph=0;this.win=0.06;this.port.onmessage=e=>{if(e.data.win)this.win=e.data.win;};}
  rd(pos){const N=this.N;let p=pos;while(p<0)p+=N;const i=Math.floor(p),f=p-i;const a=this.b[i%N],c=this.b[(i+1)%N];return a+(c-a)*f;}
  process(i,o,p){const x=i[0],y=o[0];if(!x.length||!y.length)return true;const n=y[0].length,ratio=Math.pow(2,p.semi[0]/12),mix=p.mix[0];
    const W=Math.min(this.N-8,Math.max(256,Math.floor(this.win*sampleRate))),N=this.N;
    for(let k=0;k<n;k++){const xin=x[0][k];this.b[this.w]=xin;const p1=this.ph,p2=(this.ph+0.5)%1;
      const g1=Math.sin(Math.PI*p1),g2=Math.sin(Math.PI*p2);
      const wet=this.rd(this.w-p1*W)*g1*g1+this.rd(this.w-p2*W)*g2*g2;
      this.ph+=(1-ratio)/W;if(this.ph>=1)this.ph-=1;else if(this.ph<0)this.ph+=1;
      const out=xin*(1-mix)+wet*mix;for(let c=0;c<y.length;c++)y[c][k]=out;this.w=(this.w+1)%N;}
    return true;}}
registerProcessor('fw-pitch',Pitch);

class Flange extends AudioWorkletProcessor{
  static get parameterDescriptors(){const d=(name,v,a,b)=>({name,defaultValue:v,minValue:a,maxValue:b,automationRate:'k-rate'});return[d('rate',.3,.02,10),d('depth',.7,0,1),d('manual',2,.2,8),d('fb',.5,-.95,.95),d('mix',.5,0,1)];}
  constructor(){super();this.N=4096;this.b=[new Float32Array(this.N),new Float32Array(this.N)];this.w=0;this.ph=0;}
  process(i,o,p){const x=i[0],y=o[0];if(!x.length||!y.length)return true;const n=y[0].length,sr=sampleRate,N=this.N;
    const rate=p.rate[0],dep=p.depth[0],man=p.manual[0],fb=p.fb[0],mix=p.mix[0];
    for(let k=0;k<n;k++){const xin=x[0][k];
      for(let c=0;c<2;c++){const l=Math.sin(2*Math.PI*(this.ph+c*0.25));let d=man*0.001*sr*(1+l*dep*0.9);if(d<1)d=1;
        let rp=this.w-d;if(rp<0)rp+=N;const i0=Math.floor(rp),f=rp-i0,ln=this.b[c];const r=ln[i0%N]+(ln[(i0+1)%N]-ln[i0%N])*f;
        ln[this.w]=xin+fb*r;if(y[c])y[c][k]=xin*(1-mix*0.5)+r*mix;}
      this.ph+=rate/sr;if(this.ph>=1)this.ph-=1;this.w=(this.w+1)%N;}
    return true;}}
registerProcessor('fw-flange',Flange);

class Pluck extends AudioWorkletProcessor{
  constructor(){super();this.v=[];this.q=[];this.seed=987654321;
    this.port.onmessage=e=>{const m=e.data;if(m.t==='on')this.q.push(m);else if(m.t==='kill'){this.v.length=0;this.q.length=0;}};}
  rnd(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/2147483648-1;}
  start(m,off){const sr=sampleRate,s=m.s,Lf=sr/m.f+s,N=Math.max(4,Math.floor(Lf)),d=Lf-N,c=(1-d)/(1+d);
    const buf=new Float32Array(N),ex=new Float32Array(N);let lp=0;const a=m.br;
    for(let j=0;j<N;j++){lp+=a*(this.rnd()-lp);ex[j]=lp;}
    const pp=Math.max(1,Math.floor(N*m.pp));let mean=0;
    for(let j=0;j<N;j++){buf[j]=ex[j]-ex[(j+N-pp)%N];mean+=buf[j];}mean/=N;
    let e=0;for(let j=0;j<N;j++){buf[j]-=mean;e+=buf[j]*buf[j];}
    const sc=(0.22*m.vel)/Math.sqrt(e/N+1e-12);for(let j=0;j<N;j++)buf[j]*=sc;
    for(const o of this.v)if(m.id!=null&&o.id===m.id)o.fade=0.985;
    if(this.v.length>=44)this.v.shift();
    const pan=Math.max(-1,Math.min(1,m.pan||0)),ang=(pan+1)*Math.PI/4,g=m.g==null?1:m.g;
    const dec=m.dead?0.93:Math.pow(10,-3/(m.t60*m.f));
    this.v.push({buf,N,pos:0,c,s,dec,x1:0,y1:0,gl:Math.cos(ang)*g,gr:Math.sin(ang)*g,id:m.id,fade:1,env:1,age:0,delay:off});}
  process(i,o){const out=o[0],L=out[0],R=out[1]||out[0],n=L.length;
    if(this.q.length){const now=currentTime;for(let k=this.q.length-1;k>=0;k--){const m=this.q[k],off=Math.round((m.at-now)*sampleRate);if(off<n){this.q.splice(k,1);this.start(m,Math.max(0,off));}}}
    for(let vi=this.v.length-1;vi>=0;vi--){const v=this.v[vi];let k=0;if(v.delay>0){k=Math.min(n,v.delay);v.delay-=k;}
      const buf=v.buf,N=v.N,c=v.c,s=v.s,dec=v.dec*v.fade,gl=v.gl,gr=v.gr;let pos=v.pos,x1=v.x1,y1=v.y1,env=v.env;
      for(;k<n;k++){const yo=buf[pos],p1=pos+1===N?0:pos+1,f=((1-s)*yo+s*buf[p1])*dec,a=c*f+x1-c*y1;x1=f;y1=a;buf[pos]=a;pos=p1;L[k]+=yo*gl;if(R!==L)R[k]+=yo*gr;env=env*0.999+Math.abs(yo)*0.001;}
      v.pos=pos;v.x1=x1;v.y1=y1;v.env=env;v.age+=n;
      if((v.age>6000&&env<2e-5)||(v.fade<1&&env<1e-4&&v.age>800))this.v.splice(vi,1);}
    for(let k=0;k<n;k++){L[k]=Math.tanh(L[k]);if(R!==L)R[k]=Math.tanh(R[k]);}
    return true;}}
registerProcessor('fw-pluck',Pluck);

class Tap extends AudioWorkletProcessor{
  constructor(o){super();const po=(o&&o.processorOptions)||{};this.st=!!po.stereo;this.ons=!!po.onset;this.on=false;this.n=0;this.B=2048;
    this.l=new Float32Array(this.B);this.r=this.st?new Float32Array(this.B):null;this.t0=0;this.slow=0;this.prev=0;this.last=-1;
    this.port.onmessage=e=>{if('on' in e.data){this.on=e.data.on;this.n=0;}};}
  process(i){const x=i[0];if(!x||!x.length)return true;const a=x[0],b=x[1]||x[0],n=a.length;
    if(this.ons){let pk=0;for(let k=0;k<n;k++){const v=Math.abs(a[k]);if(v>pk)pk=v;}
      if(pk>0.012&&pk>this.prev*1.8&&pk>this.slow*1.8&&currentTime-this.last>0.07){this.last=currentTime;this.port.postMessage({onset:true,t:currentTime,lvl:pk});}
      this.slow=this.slow*0.97+pk*0.03;this.prev=pk;}
    if(this.on){for(let k=0;k<n;k++){if(this.n===0)this.t0=currentTime+k/sampleRate;
      this.l[this.n]=this.st?a[k]:(a[k]+b[k])*(x[1]?0.5:1);if(this.st)this.r[this.n]=b[k];this.n++;
      if(this.n===this.B){this.port.postMessage({t:this.t0,l:this.l.slice(),r:this.st?this.r.slice():null});this.n=0;}}}
    return true;}}
registerProcessor('fw-tap',Tap);
`;

/* ---------- engine state ---------- */
const E = {
  ctx: null, worklet: false, ready: false, stream: null, inSettings: null, src: null, hasInput: false, tr: {},
  devs: { in: [], out: [], cam: [] }, recOn: { di: false, wet: false, master: false }, onTap: {}
};
const TRACKS = [['drums', 'Drums', '#e4572e'], ['bass', 'Bass', '#8a5cf5'], ['rhythm', 'Rhythm Gtr', '#0a9aa6'], ['lead', 'Lead / Tab', '#e0a31a'], ['live', 'Live Guitar', '#2e9d57'], ['vox', 'Vocal', '#ff5fa2'], ['click', 'Click', '#7b8a88']];
const gn = (v = 1) => { const n = E.ctx.createGain(); n.gain.value = v; return n; };
const bq = (type, f, q = 0.707, g = 0) => { const n = E.ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; n.gain.value = g; return n; };
const tc = (p, v, t = 0.025) => p.setTargetAtTime(v, E.ctx.currentTime, t);
const chainN = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n; };

function makeTap(src, opt, cb) {
  const c = E.ctx;
  if (E.worklet) {
    const n = new AudioWorkletNode(c, 'fw-tap', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: opt.stereo ? 2 : 1, channelCountMode: 'explicit', processorOptions: opt });
    n.port.onmessage = e => cb(e.data); src.connect(n);
    return { on(v) { n.port.postMessage({ on: v }); }, node: n };
  }
  const sp = c.createScriptProcessor(2048, 2, 1); let on = false;
  sp.onaudioprocess = e => {
    if (!on) return; const a = e.inputBuffer.getChannelData(0), b = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : a;
    const l = new Float32Array(a.length); for (let k = 0; k < a.length; k++) l[k] = opt.stereo ? a[k] : (a[k] + b[k]) / 2;
    cb({ t: e.playbackTime - 2048 / c.sampleRate, l, r: opt.stereo ? b.slice() : null });
  };
  const z = gn(0); src.connect(sp); sp.connect(z); z.connect(c.destination);
  return { on(v) { on = v; }, node: sp };
}

async function startAudio() {
  const gest = !navigator.userActivation || navigator.userActivation.hasBeenActive, kick = async c => { const r = c.resume(); if (gest) await r; else r.catch(() => { }); };
  if (E.ctx) { if (E.ctx.state === 'suspended') await kick(E.ctx); return; }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  const o = { latencyHint: CFG.hint === '0' ? 0 : CFG.hint }; if (CFG.sr !== 'auto') o.sampleRate = +CFG.sr;
  try { E.ctx = new Ctor(o); } catch (e) { E.ctx = new Ctor(); }
  const c = E.ctx;
  try {
    try { await c.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }))); }
    catch (e1) { await c.audioWorklet.addModule('data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(WORKLET_SRC)))); }
    E.worklet = true;
  } catch (e) { console.warn('AudioWorklet unavailable — using fallbacks', e); E.worklet = false; }
  buildGraph();
  if (c.state === 'suspended') await kick(c);
  E.ready = true; bus.emit('audio:ready');
}

function buildGraph() {
  const c = E.ctx;
  E.inTrim = gn(1); E.inSum = gn(1); E.rigIn = gn(1); E.rigOut = gn(1); E.mix = gn(1); E.master = gn(.9);
  E.limiter = c.createDynamicsCompressor(); Object.assign(E.limiter.threshold, { value: -1.5 }); E.limiter.knee.value = 0; E.limiter.ratio.value = 20; E.limiter.attack.value = 0.001; E.limiter.release.value = 0.08;
  const mkAna = (fft, sm) => { const a = c.createAnalyser(); a.fftSize = fft; a.smoothingTimeConstant = sm; a.minDecibels = -110; a.maxDecibels = -10; return a; };
  E.anaDI = mkAna(4096, 0); E.anaChroma = mkAna(16384, 0.5); E.anaRig = mkAna(CFG.fft, CFG.smooth); E.anaMaster = mkAna(CFG.fft, CFG.smooth);
  E.inSum.connect(E.inTrim); E.inTrim.connect(E.rigIn);
  /* what the note detector, tuner, chord/key finder, onset pulses and the Input meter listen to: the guitar, the vocal, or both (CFG.anSrc) */
  E.anSrc = gn(1); E.aG = gn(CFG.anSrc === 'v' ? 0 : 1); E.aV = gn(CFG.anSrc === 'v' || CFG.anSrc === 'b' ? 1 : 0); E.inTrim.connect(E.aG); E.aG.connect(E.anSrc); E.anSrc.connect(E.anaDI); E.anSrc.connect(E.anaChroma);
  E.rigOut.connect(E.anaRig);
  TRACKS.forEach(([id]) => {
    const t = { id, in: gn(1), g: gn(1), pan: c.createStereoPanner(), ana: mkAna(512, 0.4) };
    t.in.connect(t.g); t.g.connect(t.pan); t.pan.connect(t.ana); t.pan.connect(E.mix); E.tr[id] = t;
  });
  E.takesIn = gn(1); E.takesIn.connect(E.mix);
  /* vocal path: the second input channel → trim → (meter · recorder tap) and → monitor switch → polish strip → Vocal track */
  E.voxIn = gn(1); E.voxTrim = gn(fromDB(CFG.voxTrim || 0)); E.voxMon = gn(0); E.anaVox = mkAna(2048, 0.3);
  E.voxIn.connect(E.voxTrim); E.voxTrim.connect(E.anaVox); E.voxTrim.connect(E.aV); E.voxTrim.connect(E.voxMon);
  { const sIn = gn(1), sOut = gn(1), hp = bq('highpass', 90), cmp = c.createDynamicsCompressor(), mk = gn(1.35), pr = gn(1), by = gn(0);
    cmp.threshold.value = -24; cmp.knee.value = 14; cmp.ratio.value = 3; cmp.attack.value = .008; cmp.release.value = .2;
    chainN(sIn, hp, cmp, mk, pr, sOut); sIn.connect(by); by.connect(sOut); E.voxStrip = { in: sIn, out: sOut, proc: pr, byp: by }; sOut.connect(E.tr.vox.in); E.voxMon.connect(sIn); }
  voxPolishApply();
  E.rigOut.connect(E.tr.live.in);
  E.mix.connect(E.master); E.master.connect(E.limiter); E.limiter.connect(E.anaMaster); E.limiter.connect(c.destination);
  E.testOut = gn(.5); E.testOut.connect(c.destination);
  E.tapDI = makeTap(E.inTrim, { onset: true }, m => bus.emit('tap:di', m));
  E.tapWet = makeTap(E.rigOut, {}, m => bus.emit('tap:wet', m)); E.tapVox = makeTap(E.voxTrim, { onset: true }, m => bus.emit('tap:vox', m));
  E.tapMaster = makeTap(E.limiter, { stereo: true }, m => bus.emit('tap:master', m));
  rigBuild(); applyMix(); setMonitor(CFG.monitor);
}

function applyMix() {
  if (!E.ready && !E.tr.drums) return; if (!S.mix.vox) S.mix.vox = { g: 1, p: 0, m: 0, s: 0 }; const m = S.mix;
  const solo = Object.values(m).some(x => x.s);
  Object.keys(E.tr).forEach(id => {
    const x = m[id]; if (!x) return;
    const a = solo ? (x.s ? 1 : 0) : (x.m ? 0 : 1);
    tc(E.tr[id].g.gain, x.g * a * (id === 'live' && !CFG.monitor ? 0 : 1)); tc(E.tr[id].pan.pan, x.p);
  });
  if (E.voxMon) tc(E.voxMon.gain, CFG.voxMon && CFG.vin !== 'off' && E.hasInput ? 1 : 0);
}
function setMonitor(on) { CFG.monitor = on; saveCfg(); applyMix(); bus.emit('monitor', on); }

/* ---------- input device handling ---------- */
async function listDevices() {
  try {
    const d = await navigator.mediaDevices.enumerateDevices();
    E.devs.in = d.filter(x => x.kind === 'audioinput'); E.devs.out = d.filter(x => x.kind === 'audiooutput'); E.devs.cam = d.filter(x => x.kind === 'videoinput');
  } catch (e) { console.warn(e); }
  bus.emit('devices');
}
async function openInput(deviceId) {
  const md = navigator.mediaDevices; if (!md || !md.getUserMedia) { toast('getUserMedia not available (needs https and a modern browser)', 'bad'); return false; }
  if (E.stream) E.stream.getTracks().forEach(t => t.stop());
  if (E.src) try { E.src.disconnect(); } catch (e) { }
  const base = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 }, latency: { ideal: 0 } };
  const attempt = async id => {
    const dev = id ? { deviceId: { exact: id } } : {}; let last = null;
    for (const extra of [{ ...base, ...dev, sampleRate: { ideal: E.ctx.sampleRate } }, { ...base, ...dev }, { echoCancellation: false, noiseSuppression: false, autoGainControl: false, ...dev }, { ...dev }]) {
      try { return await md.getUserMedia({ audio: extra }); } catch (e) { last = e; console.warn('input constraint failed', e.name, e.message); if (e.name === 'NotAllowedError' || e.name === 'SecurityError') throw e; }
    }
    throw last;
  };
  let st = null, err = null;
  try { st = await attempt(deviceId); } catch (e) {
    err = e;
    if (deviceId && e.name !== 'NotAllowedError' && e.name !== 'SecurityError') { try { st = await attempt(''); err = null; CFG.inDev = ''; toast('That input is not available any more (device IDs change between sessions) — using the system default input instead', 'warn'); } catch (e2) { err = e2; } }
  }
  if (!st) {
    const m = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError') ? 'Microphone permission blocked. Click the camera/lock icon in the address bar and allow the microphone for this page (in CodePen use Change View → Full Page or Debug), then press ↻.' : 'Could not open audio input (' + (err ? err.name + ': ' + err.message : 'unknown') + '). Is another app using the interface exclusively?';
    E.lastInErr = m; toast(m, 'bad'); bus.emit('input', null); return false;
  }
  E.lastInErr = null;
  xpSignal(2); E.stream = st; const tr = st.getAudioTracks()[0]; E.inSettings = tr.getSettings(); CFG.inDev = E.inSettings.deviceId || deviceId || ''; saveCfg();
  E.src = E.ctx.createMediaStreamSource(st);
  if (!E.split) {
    E.split = E.ctx.createChannelSplitter(2); E.gL = gn(1); E.gR = gn(0);
    E.split.connect(E.gL, 0); E.split.connect(E.gR, 1); E.gL.connect(E.inSum); E.gR.connect(E.inSum);
    E.anaL = c0().createAnalyser(); E.anaR = c0().createAnalyser(); E.anaL.fftSize = E.anaR.fftSize = 1024; E.split.connect(E.anaL, 0); E.split.connect(E.anaR, 1);
    E.vL = gn(0); E.vR = gn(0); E.split.connect(E.vL, 0); E.split.connect(E.vR, 1); E.vL.connect(E.voxIn); E.vR.connect(E.voxIn);
  }
  E.src.connect(E.split); E.hasInput = true; setChannelMode(CFG.ch);
  await listDevices(); bus.emit('input', E.inSettings);
  return true;
}
/* Guitar channel (CFG.ch) and vocal channel (CFG.vin) share one 2-channel stream from the interface. A channel given to the
   vocal is taken away from the guitar, so the vocal never bleeds into the guitar's dry DI. */
function setChannelMode(m) {
  CFG.ch = m; saveCfg(); if (!E.gL) return;
  const nch = (E.inSettings && E.inSettings.channelCount) || 2;
  let l = 1, r = 0;
  if (m === 'R') { l = 0; r = 1; } else if (m === 'sum') { l = .5; r = .5; } else if (m === 'auto') { l = 1; r = nch > 1 ? 0 : 0; }
  if (CFG.vin === 'R') { l = 1; r = 0; } else if (CFG.vin === 'L') { l = 0; r = 1; }
  if (CFG.gOff) { l = 0; r = 0; }   // both inputs given to the vocal, or switched off: nothing goes to the guitar rig
  tc(E.gL.gain, l, .01); tc(E.gR.gain, r, .01);
  if (E.vL) { tc(E.vL.gain, CFG.vin === 'L' ? 1 : 0, .01); tc(E.vR.gain, CFG.vin === 'R' ? 1 : 0, .01); }
  applyMix(); bus.emit('route');
}
const c0 = () => E.ctx;
/** What each interface input is: ['g'|'v'|'o', 'g'|'v'|'o'] = Guitar (through the rig), Vocal (through the vocal strip) or Off. Derived from CFG.ch / CFG.vin / CFG.gOff. */
function chRoles() {
  const v = CFG.vin; let a = 'o', b = 'o';
  if (v === 'L') a = 'v'; else if (v === 'R') b = 'v';
  if (!CFG.gOff) { if (v === 'L') b = 'g'; else if (v === 'R') a = 'g'; else if (CFG.ch === 'sum') { a = 'g'; b = 'g'; } else if (CFG.ch === 'R') b = 'g'; else a = 'g'; }
  return [a, b];
}
/** Set both inputs at once. A second Vocal input is not possible, so choosing Vocal on one input hands the other back to the guitar. */
function chSetRoles(a, b) {
  if (a === 'v' && b === 'v') b = 'g';
  const wasOff = !!CFG.gOff;
  const g1 = a === 'g', g2 = b === 'g'; CFG.vin = a === 'v' ? 'L' : b === 'v' ? 'R' : 'off';
  CFG.gOff = !g1 && !g2; if (g1 && g2) CFG.ch = 'sum'; else if (g2) CFG.ch = 'R'; else if (g1) CFG.ch = 'L';
  if (CFG.vin !== 'off') CFG.armV = true;
  // the detector follows what is plugged in, unless the person already chose
  if (CFG.gOff && CFG.vin !== 'off') CFG.anSrc = 'v'; else if (CFG.vin === 'off' || wasOff || !CFG.anSrc) CFG.anSrc = 'g';
  saveCfg(); setChannelMode(CFG.ch); applyAnaSource();
}
function applyAnaSource() { const s = CFG.anSrc || 'g'; if (E.aG) { E.anTarget = [s === 'v' ? 0 : 1, s === 'g' ? 0 : 1]; tc(E.aG.gain, E.anTarget[0], .02); tc(E.aV.gain, E.anTarget[1], .02); } bus.emit('route'); }
function setAnaSource(s) { CFG.anSrc = s; saveCfg(); applyAnaSource(); }
/** vin: 'off' | 'L' (input 1) | 'R' (input 2) */
function setVoxInput(v) {
  if (v !== 'off' && E.hasInput && E.inSettings && E.inSettings.channelCount === 1) toast('This device exposes a single input channel, so a separate vocal channel is not possible. Pick a 2-channel input (e.g. the Focusrite) in I/O.', 'warn');
  CFG.vin = v; if (v !== 'off') CFG.armV = true; saveCfg(); setChannelMode(CFG.ch);
  if (v !== 'off') toast('Guitar on input ' + (v === 'R' ? '1' : '2') + ' · vocal on input ' + (v === 'R' ? '2' : '1') + ' — arm both lanes and press R to record them together', 'ok');
}
function setVoxTrim(db) { CFG.voxTrim = db; saveCfg(); if (E.voxTrim) tc(E.voxTrim.gain, fromDB(db), .02); }
function voxPolishApply() { if (!E.voxStrip) return; const on = CFG.voxPolish !== false; tc(E.voxStrip.proc.gain, on ? 1 : 0, .02); tc(E.voxStrip.byp.gain, on ? 0 : 1, .02); }
const armedG = () => CFG.armG !== false, armedV = () => CFG.armV !== false && !!CFG.vin && CFG.vin !== 'off';
async function autoDetectChannel() {
  if (!E.hasInput) return;
  const aL = E.ctx.createAnalyser(), aR = E.ctx.createAnalyser(); aL.fftSize = aR.fftSize = 2048; E.split.connect(aL, 0); E.split.connect(aR, 1);
  const bl = new Float32Array(2048), br = new Float32Array(2048); let pl = 0, pr = 0;
  toast('Strum the guitar for 2 seconds…');
  for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 50)); aL.getFloatTimeDomainData(bl); aR.getFloatTimeDomainData(br); for (let k = 0; k < 2048; k++) { pl = Math.max(pl, Math.abs(bl[k])); pr = Math.max(pr, Math.abs(br[k])); } }
  try { E.split.disconnect(aL); E.split.disconnect(aR); } catch (e) { }
  if (pl < .005 && pr < .005) { toast('No signal detected on either channel', 'warn'); return; }
  const pick = pr > pl * 1.5 ? 'R' : (pl > pr * 1.5 ? 'L' : 'sum');
  CFG.gOff = false; setChannelMode(pick); bus.emit('input', E.inSettings); toast('Input channel: ' + (pick === 'sum' ? 'both (summed)' : pick === 'L' ? 'Input 1 / Left' : 'Input 2 / Right'), 'ok');
}
async function setOutputDevice(id) {
  CFG.outDev = id; saveCfg();
  try { if (E.ctx.setSinkId) await E.ctx.setSinkId(id || ''); else toast('Output selection needs a recent Chromium browser', 'warn'); } catch (e) { toast('Could not switch output: ' + e.message, 'bad'); }
}
function latencyInfo() {
  const c = E.ctx; if (!c) return null;
  const out = (c.outputLatency || 0) * 1000, base = (c.baseLatency || 0) * 1000;
  const inp = E.inSettings && E.inSettings.latency != null ? E.inSettings.latency * 1000 : null;
  const est = base + out + (inp != null ? inp : base);
  return { sr: c.sampleRate, base, out, inp, est, block: 128 / c.sampleRate * 1000, rtt: CFG.rtt, state: c.state };
}
const rttMs = () => CFG.rtt != null ? CFG.rtt : (latencyInfo() ? latencyInfo().est : 20);

/* ---------- FX framework ---------- */
const FX = {};
const P = (k, label, min, max, def, step = .01, unit = '', o = {}) => ({ k, label, min, max, def, step, unit, type: 'knob', ...o });
const SELP = (k, label, opts, def) => ({ k, label, type: 'select', opts, def: def == null ? opts[0] : def });
const TOG = (k, label, def = 0) => ({ k, label, type: 'toggle', def });
const defFx = (id, name, cat, params, build, o = {}) => { FX[id] = { id, name, cat, params, build, ...o }; };
function satCurve(k, bias = 0, n = 2048, kind = 'tanh') {
  const a = new Float32Array(n), nb = kind === 'tanh' ? Math.tanh(bias) : Math.atan(bias);
  const f = kind === 'tanh' ? Math.tanh : Math.atan, sc = Math.abs(f(k + bias) - nb) || 1;
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; a[i] = (f(k * x + bias) - nb) / sc; }
  return a;
}
const LFO = (c, type = 'sine', f = 1) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
const passthru = () => { const g = gn(); return { in: g, out: g, set() { } }; };

defFx('gate', 'Noise Gate', 'Dynamics', [P('thresh', 'Thresh', -80, -20, -58, 1, ' dB'), P('rel', 'Release', 20, 600, 140, 1, ' ms', { log: 1 }), P('hold', 'Hold', 0, 300, 40, 1, ' ms'), P('range', 'Range', -90, -6, -70, 1, ' dB')], (c) => {
  if (!E.worklet) return passthru();
  const n = new AudioWorkletNode(c, 'fw-gate', { channelCount: 1, channelCountMode: 'explicit', outputChannelCount: [1] });
  const map = { thresh: 'th', rel: 'rel', hold: 'hold', range: 'range' };
  return { in: n, out: n, set(k, v) { n.port.postMessage({ [map[k]]: v }); } };
});
defFx('comp', 'Compressor', 'Dynamics', [P('thr', 'Thresh', -60, 0, -26, 1, ' dB'), P('ratio', 'Ratio', 1, 20, 4, .1, ':1'), P('atk', 'Attack', 1, 200, 12, 1, ' ms', { log: 1 }), P('rel', 'Release', 20, 1000, 220, 1, ' ms', { log: 1 }), P('knee', 'Knee', 0, 40, 14, 1, ' dB'), P('makeup', 'Makeup', 0, 24, 6, .5, ' dB'), P('mix', 'Blend', 0, 1, 1, .01)], (c) => {
  const i = gn(), cm = c.createDynamicsCompressor(), mk = gn(), dry = gn(0), wet = gn(1), o = gn();
  chainN(i, cm, mk, wet, o); i.connect(dry); dry.connect(o);
  return { in: i, out: o, set(k, v) { switch (k) { case 'thr': cm.threshold.value = v; break; case 'ratio': cm.ratio.value = v; break; case 'atk': cm.attack.value = v / 1000; break; case 'rel': cm.release.value = v / 1000; break; case 'knee': cm.knee.value = v; break; case 'makeup': tc(mk.gain, fromDB(v)); break; case 'mix': tc(wet.gain, v); tc(dry.gain, 1 - v); } } };
});
defFx('wah', 'Wah', 'Filter', [SELP('mode', 'Mode', ['Pedal', 'Auto LFO']), P('pos', 'Pedal', 0, 1, .5), P('q', 'Q', 1, 16, 6, .1), P('rate', 'Rate', .1, 8, 1.6, .01, ' Hz', { log: 1 }), P('depth', 'Depth', 0, 1, .8), P('mix', 'Mix', 0, 1, 1)], (c) => {
  const i = gn(), bp = bq('bandpass', 800, 6), lfo = LFO(c), lg = gn(0), lv = gn(1.8), dry = gn(0), wet = gn(1), o = gn();
  lfo.connect(lg); lg.connect(bp.frequency); chainN(i, bp, lv, wet, o); i.connect(dry); dry.connect(o);
  let mode = 'Pedal', pos = .5, dep = .8;
  const upd = () => { const f = 350 * Math.pow(2, pos * 3.2); tc(bp.frequency, f, .02); tc(lg.gain, mode === 'Pedal' ? 0 : f * dep * .7, .05); };
  return { in: i, out: o, set(k, v) { switch (k) { case 'mode': mode = v; upd(); break; case 'pos': pos = v; upd(); break; case 'depth': dep = v; upd(); break; case 'q': bp.Q.value = v; break; case 'rate': lfo.frequency.value = v; break; case 'mix': tc(wet.gain, v); tc(dry.gain, 1 - v); } } };
});
function driveUnit(c, o) {
  const i = gn(), hp = bq('highpass', o.hp), body = bq('peaking', 720, .9, 0), drv = gn(8), ws = c.createWaveShaper(), lp = bq('lowpass', 4500), lv = gn(.8);
  ws.oversample = '4x'; chainN(i, hp, body, drv, ws, lp, lv); return { i, hp, body, drv, ws, lp, lv };
}
defFx('od', 'Overdrive', 'Drive', [P('drive', 'Drive', 0, 1, .45), P('tone', 'Tone', 0, 1, .5), P('level', 'Level', 0, 1, .55), P('body', 'Mid Hump', 0, 12, 5, .5, ' dB')], (c) => {
  const u = driveUnit(c, { hp: 140 }); u.ws.curve = satCurve(3.2, .12);
  return { in: u.i, out: u.lv, set(k, v) { switch (k) { case 'drive': tc(u.drv.gain, 1 + v * v * 50); break; case 'tone': tc(u.lp.frequency, 1500 * Math.pow(6, v)); break; case 'level': tc(u.lv.gain, v * 1.6); break; case 'body': u.body.gain.value = v; } } };
});
defFx('ds', 'Distortion', 'Drive', [P('drive', 'Gain', 0, 1, .55), P('tone', 'Tone', 0, 1, .5), P('level', 'Level', 0, 1, .45), P('grit', 'Grit', 0, 1, .5)], (c) => {
  const u = driveUnit(c, { hp: 110 });
  return { in: u.i, out: u.lv, set(k, v) { switch (k) { case 'drive': tc(u.drv.gain, 1 + v * v * 260); break; case 'tone': tc(u.lp.frequency, 1100 * Math.pow(9, v)); break; case 'level': tc(u.lv.gain, v * 1.3); break; case 'grit': u.ws.curve = satCurve(6 + v * 30, 0, 2048, v > .5 ? 'atan' : 'tanh'); } } };
});
defFx('fuzz', 'Fuzz', 'Drive', [P('fuzz', 'Fuzz', 0, 1, .7), P('bias', 'Bias', 0, 1, .4), P('tone', 'Tone', 0, 1, .5), P('level', 'Level', 0, 1, .4)], (c) => {
  const u = driveUnit(c, { hp: 70 }); let k = 20, b = .3;
  const cv = () => { u.ws.curve = satCurve(k, b * 1.4, 2048, 'tanh'); };
  return { in: u.i, out: u.lv, set(n, v) { switch (n) { case 'fuzz': tc(u.drv.gain, 1 + v * 90); k = 10 + v * 50; cv(); break; case 'bias': b = v; cv(); break; case 'tone': tc(u.lp.frequency, 700 * Math.pow(10, v)); break; case 'level': tc(u.lv.gain, v * 1.2); } } };
});
defFx('pitch', 'Pitch / Harmony', 'Pitch', [P('semi', 'Shift', -24, 24, 12, .01, ' st'), P('mix', 'Mix', 0, 1, .5), P('win', 'Window', 20, 120, 60, 1, ' ms')], (c) => {
  if (!E.worklet) return passthru();
  const n = new AudioWorkletNode(c, 'fw-pitch', { channelCount: 1, channelCountMode: 'explicit', outputChannelCount: [1] });
  return { in: n, out: n, set(k, v) { if (k === 'win') n.port.postMessage({ win: v / 1000 }); else n.parameters.get(k).value = v; } };
});
const AMP = {
  'Clean': { a1: 3, a2: 2, k1: 1.4, k2: 1.2, b1: .05, b2: .04, tB: 110, tM: 520, tT: 3200, vB: 2, vM: -1, vT: 3, hp: 60, inter: 7500, mk: 1.0, sag: .1 },
  'Chime (Class-A)': { a1: 5, a2: 3, k1: 1.8, k2: 1.5, b1: .08, b2: .05, tB: 120, tM: 1000, tT: 4200, vB: -1, vM: -2, vT: 5, hp: 80, inter: 9000, mk: .95, sag: .3 },
  'Crunch': { a1: 14, a2: 9, k1: 2.2, k2: 2.6, b1: .18, b2: .15, tB: 100, tM: 700, tT: 3000, vB: 1, vM: 3, vT: 2, hp: 90, inter: 6500, mk: .8, sag: .4 },
  'Lead': { a1: 24, a2: 12, k1: 3.0, k2: 2.8, b1: .2, b2: .12, tB: 110, tM: 900, tT: 3400, vB: 0, vM: 4, vT: 0, hp: 110, inter: 5800, mk: .7, sag: .5 },
  'Hi-Gain': { a1: 38, a2: 22, k1: 3.8, k2: 4.5, b1: .25, b2: .2, tB: 90, tM: 620, tT: 2800, vB: 3, vM: -3, vT: 4, hp: 140, inter: 5200, mk: .55, sag: .2 }
};
defFx('amp', 'Amp', 'Amp', [SELP('model', 'Model', Object.keys(AMP)), P('gain', 'Gain', 0, 1, .35), P('bass', 'Bass', 0, 1, .5), P('mid', 'Mid', 0, 1, .5), P('treble', 'Treble', 0, 1, .5), P('pres', 'Presence', 0, 1, .45), P('master', 'Master', 0, 1, .5), TOG('bright', 'Bright'), P('tight', 'Tight', 0, 1, .2)], (c) => {
  const i = gn(), hp = bq('highpass', 90), br = bq('highshelf', 3500, .7, 0), g1 = gn(4), w1 = c.createWaveShaper(), lp1 = bq('lowpass', 7500), hp2 = bq('highpass', 60), g2 = gn(2), w2 = c.createWaveShaper(),
    lo = bq('lowshelf', 110), mi = bq('peaking', 650, .8), hi = bq('highshelf', 3000), pr = bq('highshelf', 5500), dc = bq('highpass', 28), sg = c.createDynamicsCompressor(), ms = gn(.7);
  w1.oversample = w2.oversample = '4x'; sg.threshold.value = -20; sg.knee.value = 20; sg.attack.value = .004; sg.release.value = .12;
  chainN(i, hp, br, g1, w1, lp1, hp2, g2, w2, lo, mi, hi, pr, dc, sg, ms);
  const st = { model: 'Clean', gain: .35, bass: .5, mid: .5, treble: .5, pres: .45, master: .5, tight: .2, bright: 0 };
  const M = () => AMP[st.model];
  const upd = () => {
    const m = M(); w1.curve = satCurve(m.k1, m.b1); w2.curve = satCurve(m.k2, m.b2);
    tc(g1.gain, 1 + st.gain * m.a1); tc(g2.gain, 1 + st.gain * m.a2 * .6); lp1.frequency.value = m.inter;
    lo.frequency.value = m.tB; mi.frequency.value = m.tM; hi.frequency.value = m.tT;
    lo.gain.value = (st.bass - .5) * 24 + m.vB; mi.gain.value = (st.mid - .5) * 24 + m.vM; hi.gain.value = (st.treble - .5) * 24 + m.vT; pr.gain.value = (st.pres - .5) * 20;
    hp.frequency.value = Math.max(m.hp * .6, 40) + st.tight * 380; sg.ratio.value = 1 + m.sag * 5; tc(ms.gain, st.master * 1.5 * m.mk); br.gain.value = st.bright ? 5 : 0;
  };
  return { in: i, out: ms, set(k, v) { st[k] = v; upd(); } };
});
const CABS = {
  '1x12 Open Back': { res: [[105, .9, .020], [260, .35, .012], [1800, .30, .004], [3300, .45, .003]], lp: 5600, hp: 90, len: .045 },
  '2x12 Combo': { res: [[95, 1, .022], [240, .4, .012], [1500, .35, .004], [2900, .5, .003]], lp: 5200, hp: 80, len: .05 },
  '4x12 Closed': { res: [[78, 1.1, .03], [190, .5, .015], [1100, .4, .005], [2600, .7, .003]], lp: 4700, hp: 70, len: .06 },
  '1x10 Vintage': { res: [[140, .8, .015], [400, .4, .01], [2100, .5, .004], [4100, .5, .003]], lp: 4300, hp: 110, len: .04 },
  'Studio Flat': { res: [[200, .15, .006]], lp: 16000, hp: 60, len: .012 },
  'Acoustic Body Sim': { res: [[98, .9, .03], [200, .8, .025], [400, .5, .015], [1100, .3, .006], [2700, .3, .004]], lp: 9000, hp: 60, len: .08 }
};
function makeCabIR(c, type, mic) {
  const d = CABS[type] || CABS['2x12 Combo'], sr = c.sampleRate, N = Math.floor(sr * Math.max(d.len, .03) * 2), b = c.createBuffer(1, N, sr), x = b.getChannelData(0);
  x[0] = 1; for (const [f, a, tau] of d.res) for (let n = 0; n < N; n++) { const t = n / sr; x[n] += a * .6 * Math.exp(-t / tau) * Math.sin(2 * Math.PI * f * t); }
  const k = Math.max(1, Math.round(sr / 16000)) + 2; for (let n = N - 1; n >= k; n--) x[n] -= .35 * mic * x[n - k];
  const lpf = d.lp * (.55 + .9 * (1 - mic)), a1 = 1 - Math.exp(-2 * Math.PI * lpf / sr), a2 = 1 - Math.exp(-2 * Math.PI * d.hp / sr);
  for (let pass = 0; pass < 2; pass++) { let y = 0; for (let n = 0; n < N; n++) { y += a1 * (x[n] - y); x[n] = y; } }
  { let y = 0; for (let n = 0; n < N; n++) { y += a2 * (x[n] - y); x[n] -= y; } }
  let e = 0; for (let n = 0; n < N; n++) e += x[n] * x[n]; const s = 1 / Math.sqrt(e + 1e-9); for (let n = 0; n < N; n++) x[n] *= s * 1.6;
  return b;
}
defFx('cab', 'Cabinet / IR', 'Amp', [SELP('type', 'Cabinet', Object.keys(CABS), '2x12 Combo'), P('mic', 'Mic Pos', 0, 1, .3), P('lo', 'Low Cut', 20, 300, 70, 1, ' Hz', { log: 1 }), P('hi', 'High Cut', 2000, 16000, 12000, 10, ' Hz', { log: 1 }), P('mix', 'Mix', 0, 1, 1)], (c, p, u) => {
  const i = gn(), cv = c.createConvolver(), lo = bq('highpass', 70), hi = bq('lowpass', 12000), wet = gn(1), dry = gn(0), o = gn();
  cv.normalize = false; i.connect(cv); cv.connect(lo); lo.connect(hi); hi.connect(wet); wet.connect(o); i.connect(dry); dry.connect(o);
  let ty = '2x12 Combo', mic = .3, custom = false, tm = 0;
  const rb = () => { if (custom) return; clearTimeout(tm); tm = setTimeout(() => { cv.buffer = makeCabIR(c, ty, mic); }, 60); };
  u.loadIR = async file => { try { const buf = await c.decodeAudioData(await file.arrayBuffer()); const m = c.createBuffer(1, buf.length, buf.sampleRate), d = m.getChannelData(0); let e = 0; for (let k = 0; k < buf.length; k++) { let s = 0; for (let ch = 0; ch < buf.numberOfChannels; ch++) s += buf.getChannelData(ch)[k]; d[k] = s / buf.numberOfChannels; e += d[k] * d[k]; } const sc = 1.6 / Math.sqrt(e + 1e-9); for (let k = 0; k < d.length; k++) d[k] *= sc; cv.buffer = m; custom = true; toast('Loaded IR: ' + file.name, 'ok'); bus.emit('rig:ir', file.name); } catch (e) { toast('IR load failed: ' + e.message, 'bad'); } };
  u.clearIR = () => { custom = false; rb(); };
  return { in: i, out: o, set(k, v) { switch (k) { case 'type': ty = v; custom = false; rb(); break; case 'mic': mic = v; rb(); break; case 'lo': lo.frequency.value = v; break; case 'hi': hi.frequency.value = v; break; case 'mix': tc(wet.gain, v); tc(dry.gain, 1 - v); } } };
});
defFx('eq', 'Parametric EQ', 'Filter', [P('hp', 'Low Cut', 20, 500, 40, 1, ' Hz', { log: 1 }), P('b1', '80 Hz', -15, 15, 0, .5, ' dB'), P('b2', '250 Hz', -15, 15, 0, .5, ' dB'), P('b3', '800 Hz', -15, 15, 0, .5, ' dB'), P('b4', '2.5 kHz', -15, 15, 0, .5, ' dB'), P('b5', '6 kHz', -15, 15, 0, .5, ' dB'), P('lp', 'High Cut', 2000, 20000, 18000, 10, ' Hz', { log: 1 })], (c) => {
  const i = gn(), hp = bq('highpass', 40), f = [80, 250, 800, 2500, 6000].map((hz, n) => bq(n === 0 ? 'lowshelf' : n === 4 ? 'highshelf' : 'peaking', hz, 1)), lp = bq('lowpass', 18000);
  chainN(i, hp, ...f, lp);
  return { in: i, out: lp, set(k, v) { if (k === 'hp') hp.frequency.value = v; else if (k === 'lp') lp.frequency.value = v; else f[+k[1] - 1].gain.value = v; } };
});
defFx('chorus', 'Chorus', 'Modulation', [P('rate', 'Rate', .1, 8, .8, .01, ' Hz', { log: 1 }), P('depth', 'Depth', 0, 1, .5), P('mix', 'Mix', 0, 1, .5), P('dry', 'Dry', 0, 1, 1), P('tone', 'Tone', 1500, 16000, 9000, 10, ' Hz', { log: 1 })], (c) => {
  const i = gn(), d1 = c.createDelay(.05), d2 = c.createDelay(.05), lfo = LFO(c), l1 = gn(.004), inv = gn(-1), l2 = gn(.004), mg = c.createChannelMerger(2), lp = bq('lowpass', 9000), wet = gn(.5), dry = gn(1), o = gn();
  d1.delayTime.value = .013; d2.delayTime.value = .017; lfo.connect(l1); l1.connect(d1.delayTime); lfo.connect(inv); inv.connect(l2); l2.connect(d2.delayTime);
  i.connect(d1); i.connect(d2); d1.connect(mg, 0, 0); d2.connect(mg, 0, 1); mg.connect(lp); lp.connect(wet); wet.connect(o); i.connect(dry); dry.connect(o);
  return { in: i, out: o, set(k, v) { switch (k) { case 'rate': lfo.frequency.value = v; break; case 'depth': tc(l1.gain, .0008 + v * .005); tc(l2.gain, .0008 + v * .005); break; case 'mix': tc(wet.gain, v); break; case 'dry': tc(dry.gain, v); break; case 'tone': lp.frequency.value = v; } } };
});
defFx('phaser', 'Phaser', 'Modulation', [P('rate', 'Rate', .05, 8, .45, .01, ' Hz', { log: 1 }), P('depth', 'Depth', 0, 1, .7), P('res', 'Resonance', .3, 10, 2, .1), P('center', 'Center', 0, 1, .5), P('mix', 'Mix', 0, 1, .6)], (c) => {
  const i = gn(), base = [160, 380, 780, 1500, 2800, 4800], ap = base.map(f => bq('allpass', f, 2)), lfo = LFO(c), lgs = ap.map(() => gn(0)), wet = gn(.6), dry = gn(1), o = gn();
  chainN(i, ...ap, wet, o); i.connect(dry); dry.connect(o); ap.forEach((a, n) => { lfo.connect(lgs[n]); lgs[n].connect(a.frequency); });
  let dep = .7, ctr = .5; const upd = () => ap.forEach((a, n) => { const f = base[n] * Math.pow(2, (ctr - .5) * 2); tc(a.frequency, f); tc(lgs[n].gain, f * dep * .85); });
  return { in: i, out: o, set(k, v) { switch (k) { case 'rate': lfo.frequency.value = v; break; case 'depth': dep = v; upd(); break; case 'center': ctr = v; upd(); break; case 'res': ap.forEach(a => a.Q.value = v); break; case 'mix': tc(wet.gain, v); } } };
});
defFx('flanger', 'Flanger', 'Modulation', [P('rate', 'Rate', .02, 10, .3, .01, ' Hz', { log: 1 }), P('depth', 'Depth', 0, 1, .7), P('manual', 'Manual', .2, 8, 2, .1, ' ms'), P('fb', 'Feedback', -.95, .95, .5), P('mix', 'Mix', 0, 1, .5)], (c) => {
  if (!E.worklet) return passthru();
  const n = new AudioWorkletNode(c, 'fw-flange', { channelCount: 1, channelCountMode: 'explicit', outputChannelCount: [2] });
  return { in: n, out: n, set(k, v) { n.parameters.get(k).value = v; } };
});
defFx('trem', 'Tremolo', 'Modulation', [P('rate', 'Rate', .3, 16, 5, .01, ' Hz', { log: 1 }), P('depth', 'Depth', 0, 1, .6), SELP('shape', 'Shape', ['sine', 'triangle', 'square', 'sawtooth'])], (c) => {
  const i = gn(), t = gn(.7), lfo = LFO(c), lg = gn(.3); i.connect(t); lfo.connect(lg); lg.connect(t.gain);
  return { in: i, out: t, set(k, v) { switch (k) { case 'rate': lfo.frequency.value = v; break; case 'depth': tc(t.gain, 1 - v / 2); tc(lg.gain, v / 2); break; case 'shape': lfo.type = v; } } };
});
const DIVS = { 'Free': null, '1/2': 2, '1/4': 1, '1/4 triplet': 2 / 3, '1/8 dotted': .75, '1/8': .5, '1/8 triplet': 1 / 3, '1/16': .25 };
defFx('delay', 'Delay', 'Time', [P('time', 'Time', 20, 1500, 380, 1, ' ms', { log: 1 }), SELP('sync', 'Sync', Object.keys(DIVS)), P('fb', 'Feedback', 0, .95, .38), P('tone', 'Tone', 600, 12000, 4800, 10, ' Hz', { log: 1 }), P('mix', 'Mix', 0, 1, .3), P('spread', 'Ping-Pong', 0, 1, .5), P('mod', 'Wobble', 0, 1, .15)], (c, p, u) => {
  const i = gn(), dL = c.createDelay(3), dR = c.createDelay(3), fL = gn(.3), fR = gn(.3), xL = gn(0), xR = gn(0), tL = bq('lowpass', 4800), tR = bq('lowpass', 4800), mg = c.createChannelMerger(2), wet = gn(.3), o = gn(), dry = gn(1), lfo = LFO(c, 'sine', .6), lg = gn(0), iR = gn(1);
  i.connect(dL); i.connect(iR); iR.connect(dR); dL.connect(tL); dR.connect(tR); tL.connect(fL); fL.connect(dL); tR.connect(fR); fR.connect(dR); tL.connect(xL); xL.connect(dR); tR.connect(xR); xR.connect(dL);
  tL.connect(mg, 0, 0); tR.connect(mg, 0, 1); mg.connect(wet); wet.connect(o); i.connect(dry); dry.connect(o); lfo.connect(lg); lg.connect(dL.delayTime); lg.connect(dR.delayTime);
  const st = { time: 380, sync: 'Free', fb: .38, spread: .5 };
  const ms = () => DIVS[st.sync] ? 60000 / S.bpm * DIVS[st.sync] : st.time;
  const upd = () => { const t = clamp(ms() / 1000, .005, 2.9); tc(dL.delayTime, t, .03); tc(dR.delayTime, t, .03); tc(fL.gain, st.fb * (1 - st.spread)); tc(fR.gain, st.fb * (1 - st.spread)); tc(xL.gain, st.fb * st.spread); tc(xR.gain, st.fb * st.spread); tc(iR.gain, 1 - st.spread * .85); };
  u.retime = upd; bus.on('bpm', () => { if (st.sync !== 'Free') upd(); });
  return { in: i, out: o, set(k, v) { switch (k) { case 'tone': tL.frequency.value = tR.frequency.value = v; break; case 'mix': tc(wet.gain, v); break; case 'mod': tc(lg.gain, v * .004); break; default: st[k] = v; upd(); } } };
});
const REVT = { 'Room': { att: .003, br: .55, er: [[7, .6], [13, .5], [19, .45], [27, .4], [33, .3]], dens: 1 }, 'Hall': { att: .035, br: .38, er: [[19, .5], [37, .4], [53, .35], [71, .3]], dens: 1 }, 'Plate': { att: .001, br: .85, er: [], dens: 1 }, 'Spring': { att: .002, br: .3, er: [], dens: .7, spring: 1 }, 'Cathedral': { att: .07, br: .25, er: [[41, .5], [83, .4], [131, .35]], dens: 1 }, 'Ethereal': { att: .28, br: .42, er: [], dens: 1 } };
function makeReverbIR(c, type, decay, pre, damp) {
  const sr = c.sampleRate, pn = Math.floor(sr * pre / 1000), len = Math.floor(sr * decay) + pn + 64, b = c.createBuffer(2, len, sr), pr = REVT[type] || REVT.Hall;
  for (let ch = 0; ch < 2; ch++) {
    const x = b.getChannelData(ch); let seed = 1234567 + ch * 7919 + type.length * 131; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; }; let lp = 0;
    for (let n = pn; n < len; n++) { const t = (n - pn) / sr, env = Math.exp(-6.91 * t / decay), at = 1 - Math.exp(-t / pr.att), a = lerp(pr.br, .04, damp * Math.sqrt(clamp(t / decay, 0, 1))); lp += a * (rnd() * pr.dens - lp); x[n] = lp * env * at; }
    for (const [ms, g] of pr.er) { const n = pn + Math.floor(ms * (1 + ch * .07) * sr / 1000); if (n < len) x[n] += g * (ch ? -1 : 1); }
    if (pr.spring) { const cl = Math.floor(sr * .025); for (let k = 0; k < 14; k++) { const s0 = pn + Math.floor(k * .036 * sr * (1 + ch * .03)), g = Math.pow(.78, k); let ph = 0; for (let j = 0; j < cl && s0 + j < len; j++) { const t = j / (cl / sr), f = 4500 * Math.pow(300 / 4500, t / .025); ph += 2 * Math.PI * f / sr; x[s0 + j] += g * .5 * Math.sin(ph) * (1 - j / cl); } } }
  }
  return b;
}
defFx('reverb', 'Reverb', 'Time', [SELP('type', 'Type', Object.keys(REVT), 'Hall'), P('decay', 'Decay', .2, 8, 2.2, .1, ' s'), P('pre', 'Pre-delay', 0, 120, 12, 1, ' ms'), P('damp', 'Damping', 0, 1, .5), P('lowcut', 'Low Cut', 20, 800, 140, 1, ' Hz', { log: 1 }), P('mix', 'Mix', 0, 1, .25)], (c) => {
  const i = gn(), cv = c.createConvolver(), hp = bq('highpass', 140), wet = gn(.25), o = gn(), dry = gn(1);
  i.connect(cv); cv.connect(hp); hp.connect(wet); wet.connect(o); i.connect(dry); dry.connect(o);
  const st = { type: 'Hall', decay: 2.2, pre: 12, damp: .5 }; let tm = 0;
  const rb = () => { clearTimeout(tm); tm = setTimeout(() => { cv.buffer = makeReverbIR(c, st.type, st.decay, st.pre, st.damp); }, 90); };
  return { in: i, out: o, set(k, v) { switch (k) { case 'mix': tc(wet.gain, v); break; case 'lowcut': hp.frequency.value = v; break; default: st[k] = v; rb(); } } };
});

class FxUnit {
  constructor(def) {
    this.def = def; this.id = def.id; this.p = {}; def.params.forEach(q => this.p[q.k] = q.def);
    this.inN = gn(); this.outN = gn(); this.dry = gn(1); this.wet = gn(0); this.on = false; this.conn = false;
    this.fx = def.build(E.ctx, this.p, this);
    this.inN.connect(this.dry); this.dry.connect(this.outN); this.fx.out.connect(this.wet); this.wet.connect(this.outN);
    def.params.forEach(q => this.fx.set(q.k, this.p[q.k]));
  }
  setActive(a) {
    a = !!a; if (a === this.on && this.conn === a) return; this.on = a; clearTimeout(this.tm);
    if (a) { if (!this.conn) { this.inN.connect(this.fx.in); this.conn = true; } tc(this.dry.gain, 0, .008); tc(this.wet.gain, 1, .008); }
    else { tc(this.dry.gain, 1, .008); tc(this.wet.gain, 0, .008); this.tm = setTimeout(() => { if (!this.on && this.conn) { try { this.inN.disconnect(this.fx.in); } catch (e) { } this.conn = false; } }, 160); }
  }
  set(k, v) { this.p[k] = v; this.fx.set(k, v); }
}
const RIG = { order: ['gate', 'comp', 'wah', 'od', 'ds', 'fuzz', 'pitch', 'amp', 'cab', 'eq', 'chorus', 'phaser', 'flanger', 'trem', 'delay', 'reverb'], units: {}, cur: '—' };
function rigBuild() { RIG.order.forEach(id => { RIG.units[id] = new FxUnit(FX[id]); }); rigConnect(); }
function rigConnect() {
  try { E.rigIn.disconnect(); } catch (e) { }
  RIG.order.forEach(id => { try { RIG.units[id].outN.disconnect(); } catch (e) { } });
  let prev = E.rigIn; RIG.order.forEach(id => { prev.connect(RIG.units[id].inN); prev = RIG.units[id].outN; }); prev.connect(E.rigOut);
}
function rigMove(id, toIdx) { const a = RIG.order.indexOf(id); if (a < 0) return; RIG.order.splice(a, 1); RIG.order.splice(clamp(toIdx, 0, RIG.order.length), 0, id); if (E.ready) rigConnect(); bus.emit('rig:order'); }
function rigSnapshot() { const u = {}; RIG.order.forEach(id => { const x = RIG.units[id]; if (x) u[id] = { on: x.on ? 1 : 0, ...x.p }; }); return { order: RIG.order.slice(), u }; }
function rigApply(s, opts = {}) {
  if (!E.ready) return;
  if (s.order && s.order.length === RIG.order.length) { RIG.order = s.order.slice(); rigConnect(); }
  RIG.order.forEach(id => {
    const x = RIG.units[id], d = (s.u || {})[id], def = x.def;
    def.params.forEach(q => { const v = d && d[q.k] != null ? d[q.k] : q.def; x.set(q.k, v); });
    x.setActive(d ? !!d.on : false);
  });
  bus.emit('rig:refresh');
}
function rigLerp(a, b, t) {
  const o = { order: b.order, u: {} };
  RIG.order.forEach(id => { const A = a.u[id] || {}, B = b.u[id] || {}, r = { on: t < .5 ? A.on : B.on }; FX[id].params.forEach(q => { const x = A[q.k], y = B[q.k]; r[q.k] = (q.type === 'knob' && typeof x === 'number' && typeof y === 'number') ? (q.log ? x * Math.pow(y / x, t) : lerp(x, y, t)) : (t < .5 ? x : y); }); if ((A.on || B.on)) r.on = 1; o.u[id] = r; });
  return o;
}
function rigMutate(amount = .15) {
  const s = rigSnapshot(); RIG.order.forEach(id => { if (!s.u[id].on) return; FX[id].params.forEach(q => { if (q.type !== 'knob') return; const span = q.max - q.min; s.u[id][q.k] = clamp(s.u[id][q.k] + (Math.random() * 2 - 1) * span * amount, q.min, q.max); }); }); return s;
}

/* ---------- factory presets ---------- */
const PRESETS = [
  { n: 'Crystal Clean', c: 'Clean', d: 'Glassy hi-fi clean, light plate', u: { comp: { on: 1, thr: -28, ratio: 3, makeup: 4, mix: .8 }, amp: { on: 1, model: 'Clean', gain: .16, treble: .58, master: .55 }, cab: { on: 1, type: '2x12 Combo', mic: .3 }, reverb: { on: 1, type: 'Plate', decay: 1.6, mix: .18 } } },
  { n: 'Lagoon Chorus', c: 'Clean', d: 'Wide chorus, dotted echo, hall air', u: { comp: { on: 1, thr: -30, ratio: 3 }, amp: { on: 1, model: 'Chime (Class-A)', gain: .22, treble: .6 }, cab: { on: 1, type: '2x12 Combo' }, chorus: { on: 1, rate: .6, depth: .6, mix: .55 }, delay: { on: 1, sync: '1/8 dotted', fb: .35, tone: 5000, mix: .22 }, reverb: { on: 1, type: 'Hall', decay: 2.8, mix: .25 } } },
  { n: 'Busker Corner', c: 'Acoustic', d: 'Street-corner acoustic: tight comp, bright body, small room', u: { comp: { on: 1, thr: -24, ratio: 3.5, atk: 8, makeup: 5 }, eq: { on: 1, hp: 90, b1: -2, b2: -3, b4: 2.5, b5: 3, lp: 13000 }, cab: { on: 1, type: 'Acoustic Body Sim', mix: .7 }, reverb: { on: 1, type: 'Room', decay: .9, mix: .14 } } },
  { n: 'Nylon Lullaby', c: 'Acoustic', d: 'Soft, dark and warm with long hall', u: { comp: { on: 1, thr: -26, ratio: 2.5, makeup: 3 }, eq: { on: 1, hp: 70, b3: -2, b4: -2, b5: -4, lp: 9000 }, reverb: { on: 1, type: 'Hall', decay: 3.2, damp: .65, mix: .3 } } },
  { n: 'Edge of Breakup', c: 'Crunch', d: 'Touch-sensitive; clean until you dig in', u: { amp: { on: 1, model: 'Crunch', gain: .3, mid: .55, master: .5 }, cab: { on: 1, type: '1x12 Open Back' }, reverb: { on: 1, type: 'Spring', decay: 1.4, mix: .15 } } },
  { n: 'Blues Singer', c: 'Crunch', d: 'Mid-hump overdrive into warm crunch, spring verb', u: { od: { on: 1, drive: .35, tone: .45, level: .5, body: 6 }, amp: { on: 1, model: 'Crunch', gain: .25, bass: .45, treble: .45 }, cab: { on: 1, type: '1x12 Open Back', mic: .4 }, reverb: { on: 1, type: 'Spring', decay: 1.8, mix: .2 } } },
  { n: 'Classic Crunch', c: 'Crunch', d: 'Roaring 4x12 rock rhythm', u: { gate: { on: 1, thresh: -60 }, amp: { on: 1, model: 'Crunch', gain: .55, mid: .6, pres: .55, master: .5, tight: .3 }, cab: { on: 1, type: '4x12 Closed' }, reverb: { on: 1, type: 'Room', decay: .8, mix: .1 } } },
  { n: 'Surf Rider', c: 'Clean', d: 'Drippy spring reverb and tremolo', u: { amp: { on: 1, model: 'Chime (Class-A)', gain: .2, treble: .65, bright: 1 }, cab: { on: 1, type: '1x12 Open Back' }, trem: { on: 1, rate: 5.5, depth: .55, shape: 'sine' }, reverb: { on: 1, type: 'Spring', decay: 2.4, mix: .5 } } },
  { n: 'Funk Quack', c: 'Funk', d: 'Compressed, bouncy pedal-wah rhythm', u: { comp: { on: 1, thr: -34, ratio: 6, atk: 4, makeup: 9 }, wah: { on: 1, mode: 'Pedal', pos: .5, q: 7, mix: 1 }, amp: { on: 1, model: 'Clean', gain: .15 }, cab: { on: 1, type: '2x12 Combo' } } },
  { n: 'Auto-Wah Groove', c: 'Funk', d: 'LFO wah locked to a slow groove', u: { comp: { on: 1, thr: -30, ratio: 4 }, wah: { on: 1, mode: 'Auto LFO', pos: .45, rate: 2.2, depth: .85, q: 8, mix: .9 }, amp: { on: 1, model: 'Clean', gain: .2 }, cab: { on: 1 } } },
  { n: 'Country Snap', c: 'Clean', d: 'Squash + slapback for chicken pickin', u: { comp: { on: 1, thr: -30, ratio: 6, atk: 3, makeup: 8 }, amp: { on: 1, model: 'Chime (Class-A)', gain: .22, treble: .62, bright: 1 }, cab: { on: 1, type: '1x12 Open Back' }, delay: { on: 1, time: 110, fb: .12, tone: 6000, mix: .25, spread: 0 }, reverb: { on: 1, type: 'Plate', decay: 1.1, mix: .12 } } },
  { n: 'Singing Lead', c: 'Lead', d: 'Boosted lead with sustain, echo and hall', u: { gate: { on: 1, thresh: -62 }, comp: { on: 1, thr: -30, ratio: 3, makeup: 4 }, od: { on: 1, drive: .4, tone: .55, level: .65, body: 7 }, amp: { on: 1, model: 'Lead', gain: .5, mid: .62, pres: .5, master: .45 }, cab: { on: 1, type: '4x12 Closed', mic: .25 }, delay: { on: 1, sync: '1/4', fb: .32, tone: 3800, mix: .25 }, reverb: { on: 1, type: 'Hall', decay: 2.6, mix: .22 } } },
  { n: 'Cosmic Lead', c: 'Lead', d: 'Heavy sustain, huge ambience', u: { comp: { on: 1, thr: -28, ratio: 4, makeup: 5 }, fuzz: { on: 1, fuzz: .5, bias: .35, tone: .55, level: .35 }, amp: { on: 1, model: 'Lead', gain: .38, mid: .55 }, cab: { on: 1, type: '2x12 Combo' }, delay: { on: 1, sync: '1/8 dotted', fb: .5, tone: 4200, mix: .35, spread: .7, mod: .3 }, reverb: { on: 1, type: 'Cathedral', decay: 5, mix: .3 } } },
  { n: 'Smooth Jazz', c: 'Clean', d: 'Dark neck pickup tone with soft verb', u: { comp: { on: 1, thr: -26, ratio: 2.5 }, amp: { on: 1, model: 'Clean', gain: .1, bass: .55, treble: .3, pres: .25 }, cab: { on: 1, type: '1x12 Open Back', mic: .7 }, reverb: { on: 1, type: 'Room', decay: 1.2, mix: .18 } } },
  { n: 'Tight Metal Rhythm', c: 'Heavy', d: 'Gated, tight, scooped hi-gain', u: { gate: { on: 1, thresh: -52, rel: 70, hold: 20 }, od: { on: 1, drive: .15, tone: .55, level: .8, body: 8 }, amp: { on: 1, model: 'Hi-Gain', gain: .62, mid: .38, treble: .58, pres: .55, master: .45, tight: .65 }, cab: { on: 1, type: '4x12 Closed', mic: .2 } } },
  { n: 'Doom Fuzz', c: 'Heavy', d: 'Thick, wall-of-sound sludge', u: { fuzz: { on: 1, fuzz: .85, bias: .5, tone: .4, level: .5 }, amp: { on: 1, model: 'Crunch', gain: .5, bass: .65, mid: .45 }, cab: { on: 1, type: '4x12 Closed', mic: .5 }, reverb: { on: 1, type: 'Room', decay: 1.4, mix: .15 } } },
  { n: 'Psych Haze', c: 'Psych', d: 'Phased fuzz, tape-ish echo, cloudy hall', u: { fuzz: { on: 1, fuzz: .55, bias: .45, tone: .5, level: .35 }, amp: { on: 1, model: 'Chime (Class-A)', gain: .3 }, cab: { on: 1 }, phaser: { on: 1, rate: .3, depth: .8, res: 3, mix: .7 }, delay: { on: 1, sync: '1/8 dotted', fb: .5, tone: 3500, mix: .35, mod: .5, spread: .6 }, reverb: { on: 1, type: 'Hall', decay: 3.8, mix: .35 } } },
  { n: 'Shimmer Cathedral', c: 'Ambient', d: 'Octave-up bloom into endless stone', u: { comp: { on: 1, thr: -26, ratio: 3 }, pitch: { on: 1, semi: 12, mix: .35, win: 70 }, amp: { on: 1, model: 'Clean', gain: .1 }, cab: { on: 1, type: 'Studio Flat' }, delay: { on: 1, sync: '1/4', fb: .4, tone: 5200, mix: .25 }, reverb: { on: 1, type: 'Ethereal', decay: 7, damp: .3, mix: .55 } } },
  { n: 'Octave-Down Pad', c: 'Ambient', d: 'Sub octave under swelling verb', u: { pitch: { on: 1, semi: -12, mix: .5 }, amp: { on: 1, model: 'Clean', gain: .12, bass: .6 }, cab: { on: 1, type: 'Studio Flat' }, chorus: { on: 1, rate: .3, depth: .7, mix: .5 }, reverb: { on: 1, type: 'Ethereal', decay: 6, mix: .5 } } },
  { n: 'Space Echo', c: 'Ambient', d: 'Long regenerating wobble echoes', u: { amp: { on: 1, model: 'Clean', gain: .18 }, cab: { on: 1 }, delay: { on: 1, time: 520, fb: .72, tone: 3200, mix: .5, mod: .6, spread: .5 }, reverb: { on: 1, type: 'Plate', decay: 3, mix: .3 } } },
  { n: 'Tape Wobble', c: 'Lo-Fi', d: 'Slow chorus drift and rolled-off highs', u: { comp: { on: 1, thr: -26, ratio: 3 }, eq: { on: 1, hp: 120, b5: -6, lp: 6500 }, chorus: { on: 1, rate: .25, depth: .8, mix: .8, dry: .3 }, amp: { on: 1, model: 'Clean', gain: .2 }, cab: { on: 1, type: '1x10 Vintage' }, reverb: { on: 1, type: 'Spring', decay: 1.6, mix: .2 } } },
  { n: 'Lo-Fi Radio', c: 'Lo-Fi', d: 'Band-limited transistor radio', u: { eq: { on: 1, hp: 380, lp: 3600, b3: 5 }, ds: { on: 1, drive: .2, tone: .4, level: .5, grit: .3 }, trem: { on: 1, rate: 3.5, depth: .25 } } },
  { n: 'Whammy Rise', c: 'Ambient', d: 'Octave-up with drive, sweep Shift with a MIDI pedal', u: { pitch: { on: 1, semi: 7, mix: .6 }, od: { on: 1, drive: .3, level: .5 }, amp: { on: 1, model: 'Crunch', gain: .3 }, cab: { on: 1 }, delay: { on: 1, sync: '1/4', fb: .3, mix: .2 } } },
  { n: 'Jet Flange', c: 'Psych', d: 'Through-zero style jet sweep', u: { amp: { on: 1, model: 'Crunch', gain: .4 }, cab: { on: 1, type: '4x12 Closed' }, flanger: { on: 1, rate: .12, depth: .9, manual: 2.5, fb: .7, mix: .7 }, reverb: { on: 1, type: 'Room', decay: 1, mix: .12 } } },
  { n: 'Skank Clean', c: 'Funk', d: 'Dry punchy clean for reggae offbeats', u: { comp: { on: 1, thr: -30, ratio: 4, atk: 3, makeup: 6 }, amp: { on: 1, model: 'Clean', gain: .12, treble: .55 }, cab: { on: 1, type: '1x12 Open Back' }, reverb: { on: 1, type: 'Spring', decay: .9, mix: .1 } } },
  { n: 'Island Strum', c: 'Acoustic', d: 'Shimmering open-tuned strum bed (try Taro Patch G)', u: { comp: { on: 1, thr: -28, ratio: 3, makeup: 4 }, eq: { on: 1, hp: 80, b2: -2, b4: 2, b5: 2.5 }, cab: { on: 1, type: 'Acoustic Body Sim', mix: .6 }, chorus: { on: 1, rate: .5, depth: .35, mix: .3 }, reverb: { on: 1, type: 'Hall', decay: 2.4, mix: .2 } } },
  { n: 'Direct (No FX)', c: 'Clean', d: 'Straight-through di signal', u: {} }
];
function loadPreset(p) {
  rigApply({ u: p.u }); RIG.cur = p.n; if (p.bpm) { S.bpm = p.bpm; commit(false); }
  bus.emit('preset', p.n);
}

/* >>> parts/03-band.js */
/* ============================================================
   Part 03 · backing band (KS pluck, drums, bass), transport/scheduler, recording / re-amp
   ============================================================ */
const INST = {
  Steel: { br: .9, s: .32, pp: .14, t60: 3.0 }, Nylon: { br: .45, s: .45, pp: .2, t60: 2.4 }, Electric: { br: .7, s: .28, pp: .12, t60: 3.4 },
  'Muted Pluck': { br: .35, s: .5, pp: .2, t60: .55 }, Round: { br: .3, s: .5, pp: .3, t60: 1.6 }, Pick: { br: .75, s: .38, pp: .25, t60: 1.2 }, Sub: { br: .18, s: .5, pp: .3, t60: 2.4 }
};
const instFor = tk => INST[tk === 'rhythm' ? S.band.compInst : tk === 'lead' ? S.band.leadInst : S.band.bassTone] || INST.Steel;

function buildBand() {
  const c = E.ctx; E.pl = {};
  [['rhythm', 70, 9500], ['lead', 90, 10500], ['bass', 35, 1400]].forEach(([id, hp, lp]) => {
    const body = bq('peaking', 220, .8, 2.5), h = bq('highpass', hp), l = bq('lowpass', lp), out = gn(1);
    chainN(h, body, l, out); out.connect(E.tr[id].in);
    if (E.worklet) { const n = new AudioWorkletNode(c, 'fw-pluck', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] }); n.connect(h); E.pl[id] = n; }
    else E.pl[id] = { in: h };
  });
  const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), d = nb.getChannelData(0); let sd = 7; for (let i = 0; i < d.length; i++) { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; d[i] = sd / 2147483648 - 1; }
  E.noise = nb;
}
bus.on('audio:ready', buildBand);

function pluck(track, time, midi, vel, o = {}) {
  const inst = instFor(track), f = mtof(midi), hum = (Math.random() * 2 - 1) * CFG.humanize * .12;
  vel = clamp(vel * (1 + hum), .05, 1);
  if (E.worklet) E.pl[track].port.postMessage({ t: 'on', at: time, f, vel, t60: inst.t60 * (o.t60m || 1), br: o.soft ? inst.br * .6 : inst.br, s: inst.s, pp: inst.pp, pan: o.pan || 0, id: o.id, g: o.g || 1, dead: o.dead });
  else {
    const c = E.ctx, osc = c.createOscillator(), lp = bq('lowpass', Math.min(f * 8, 9000)), g = gn(0), T60 = Math.min(inst.t60 * (o.t60m || 1), 2.2);
    osc.type = 'sawtooth'; osc.frequency.value = f; lp.frequency.setValueAtTime(Math.min(f * 8, 9000), time); lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.5, 200), time + .5);
    g.gain.setValueAtTime(vel * .22, time); g.gain.exponentialRampToValueAtTime(.0001, time + (o.dead ? .06 : T60)); chainN(osc, lp, g); g.connect(E.pl[track].in); osc.start(time); osc.stop(time + T60 + .05);
  }
}

/* ---------- drums ---------- */
const KITS = {
  'Acoustic': { k: [150, 48, .30, 1], s: [190, 3200, .2, .7], h: [7000, .035, .35], o: [7000, .28, .3], c: [1500, .18], t: [110, .3] },
  '808': { k: [110, 38, .6, 1.2], s: [230, 4500, .22, .6], h: [9000, .03, .3], o: [9000, .25, .25], c: [1300, .22], t: [90, .45] },
  'Brush (soft)': { k: [120, 50, .22, .6], s: [170, 2000, .30, .45], h: [5000, .06, .2], o: [5000, .35, .2], c: [1200, .2], t: [100, .3] },
  'Rock Room': { k: [170, 45, .34, 1.1], s: [200, 3800, .26, .8], h: [8000, .04, .35], o: [8000, .32, .3], c: [1600, .2], t: [120, .35] }
};
const DROWS = ['Kick', 'Snare', 'Hat', 'Open Hat', 'Clap / Rim', 'Tom / Perc'];
const DPATS = {
  'Folk Backbeat': ['X.......x.x.....', '....g.......g...', 'x.x.x.x.x.x.x.x.', '................', '................', '................'],
  'Rock 8ths': ['X.......x.x.....', '....X.......X...', 'x.x.x.x.x.x.x.x.', '..............x.', '................', '................'],
  'Four on the Floor': ['x...x...x...x...', '....x.......x...', '..x...x...x...x.', '................', '....x.......x...', '................'],
  'Pop Groove': ['X.....x...x.....', '....X.......X...', 'x.x.x.x.x.x.x.x.', '......x.......x.', '................', '................'],
  'Funk 16ths': ['X..x..x...x..x..', '....X..g.g..X..g', 'xxgxxxgxxxgxxxgx', '..............x.', '................', '................'],
  'Blues Shuffle': ['X.......x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.', '................', '................', '................'],
  'Reggae One-Drop': ['........X.......', '........x.......', 'x.x.x.x.x.x.x.x.', '................', '................', '..x...x...x...x.'],
  'Bossa Nova': ['X..x..X...x..X..', '................', 'x.x.x.x.x.x.x.x.', '................', 'x..x..x...x..x..', '................'],
  'Ballad Half-Time': ['X.......x.......', '........x.......', 'x...x...x...x...', '................', '................', '................'],
  'Island Groove': ['X.....x...x.....', '................', '..x...x...x...x.', '................', '....x.......x...', '..x.x...x..x....'],
  'Metal Double Kick': ['xxxxxxxxxxxxxxxx', '....X.......X...', 'x...x...x...x...', '................', 'X...............', '................'],
  'Hip-Hop Boom Bap': ['X.....x...x....x', '....X.......X...', 'x.x.x.x.x.x.x.xg', '................', '................', '................']
};
function dpat() { const b = S.band; if (!b.pat) b.pat = DPATS[b.patName].map(r => r.split('').map(ch => ({ '.': 0, g: 1, x: 2, X: 3 }[ch]))); return b.pat; }
function setDrumPattern(name) { S.band.patName = name; S.band.pat = DPATS[name].map(r => r.split('').map(ch => ({ '.': 0, g: 1, x: 2, X: 3 }[ch]))); commit(); }
function nz(t, dur, dest, off) { const s = E.ctx.createBufferSource(); s.buffer = E.noise; s.loop = true; s.connect(dest); s.start(t, off == null ? Math.random() * .8 : off); s.stop(t + dur + .02); return s; }
function drumHit(row, t, v) {
  if (!E.noise) return; const c = E.ctx, K = KITS[S.band.kit] || KITS.Acoustic, out = E.tr.drums.in, vol = [0, .5, .85, 1.1][v] || .8;
  const env = (g, dur, peak, start = t) => { g.gain.setValueAtTime(0.0001, start); g.gain.exponentialRampToValueAtTime(peak, start + .002); g.gain.exponentialRampToValueAtTime(.0001, start + dur); };
  if (row === 0) {
    const o = c.createOscillator(), g = gn(0); o.frequency.setValueAtTime(K.k[0], t); o.frequency.exponentialRampToValueAtTime(K.k[1], t + .07); env(g, K.k[2], .95 * vol * K.k[3]); o.connect(g); g.connect(out); o.start(t); o.stop(t + K.k[2] + .05);
    const ng = gn(0), nf = bq('lowpass', 3000); env(ng, .012, .25 * vol); nz(t, .012, nf); nf.connect(ng); ng.connect(out);
  } else if (row === 1) {
    const o = c.createOscillator(), g = gn(0); o.type = 'triangle'; o.frequency.setValueAtTime(K.s[0] * 1.3, t); o.frequency.exponentialRampToValueAtTime(K.s[0], t + .05); env(g, K.s[2] * .6, .45 * vol); o.connect(g); g.connect(out); o.start(t); o.stop(t + K.s[2]);
    const ng = gn(0), hp = bq('highpass', 1200), lp = bq('lowpass', K.s[1]); env(ng, K.s[2], .6 * vol * K.s[3]); const n = nz(t, K.s[2], hp); chainN(hp, lp, ng); ng.connect(out);
  } else if (row === 2 || row === 3) {
    const P = row === 2 ? K.h : K.o, ng = gn(0), hp = bq('highpass', P[0]); env(ng, P[1], P[2] * vol * (row === 3 ? .9 : 1)); nz(t, P[1], hp); hp.connect(ng); ng.connect(out);
  } else if (row === 4) {
    if (S.band.kit === '808' || S.band.patName === 'Four on the Floor') { for (let k = 0; k < 3; k++) { const ng = gn(0), bp = bq('bandpass', K.c[0], 1.2); env(ng, k === 2 ? K.c[1] : .012, .5 * vol, t + k * .011); nz(t + k * .011, .02, bp); bp.connect(ng); ng.connect(out); } }
    else { const o = c.createOscillator(), g = gn(0); o.frequency.value = 820; env(g, .03, .25 * vol); o.connect(g); g.connect(out); o.start(t); o.stop(t + .05); const ng = gn(0), bp = bq('bandpass', 1900, 2); env(ng, .04, .35 * vol); nz(t, .04, bp); bp.connect(ng); ng.connect(out); }
  } else {
    const o = c.createOscillator(), g = gn(0); o.frequency.setValueAtTime(K.t[0] * 1.5, t); o.frequency.exponentialRampToValueAtTime(K.t[0], t + .1); env(g, K.t[1], .5 * vol); o.connect(g); g.connect(out); o.start(t); o.stop(t + K.t[1] + .05);
  }
}
function drumStep(sib, t) { const pat = dpat(), L = Math.min(S.band.drumLen || 16, 32); const i = sib % L; pat.forEach((row, r) => { const v = row[i]; if (v) drumHit(r, t + (Math.random() * 2 - 1) * CFG.humanize * .006, v); }); }
function click(t, accent) {
  const c = E.ctx, o = c.createOscillator(), g = gn(0); o.frequency.value = accent ? 1700 : 1150; g.gain.setValueAtTime(CFG.metroVol * (accent ? 1 : .6), t); g.gain.exponentialRampToValueAtTime(.0001, t + .035);
  o.connect(g); g.connect(E.tr.click.in); o.start(t); o.stop(t + .05);
}

/* ---------- bass ---------- */
const BASS_STYLES = ['Root Whole', 'Root–Fifth', 'Eighths', 'Walking', 'Syncopated', 'Reggae Dub', 'Off', 'Octave Pump'];
const bassMidi = pc => { let m = 28 + ((pc - 28) % 12 + 12) % 12; return m; };
function bassEvent(style, ch, rel, cl, nextCh) {
  const c = parseChord(ch); if (!c || style === 'Off') return null;
  const r = bassMidi(c.bass), q3 = c.iv.includes(3) ? 3 : 4, fifth = r + 7, third = r + q3, sp4 = 4;
  switch (style) {
    case 'Root Whole': return rel === 0 ? { m: r, v: .85, len: cl } : null;
    case 'Root–Fifth': return rel === 0 ? { m: r, v: .9, len: cl / 2 } : (rel === Math.floor(cl / 2) ? { m: fifth, v: .7, len: cl / 2 } : null);
    case 'Eighths': return rel % 2 === 0 ? { m: (rel / 2) % 4 === 3 ? r + 12 : r, v: rel % 8 === 0 ? .95 : .7, len: 2 } : null;
    case 'Octave Pump': return rel % 2 === 0 ? { m: (rel % 4 === 2) ? r + 12 : r, v: rel % 4 === 0 ? .95 : .65, len: 2 } : null;
    case 'Walking': {
      if (rel % sp4) return null; const b = rel / sp4, n = nextCh ? parseChord(nextCh) : null, nr = n ? bassMidi(n.root) : r;
      const app = nr > r ? nr - 1 : nr + 1; return { m: [r, third, fifth, app][b % 4], v: .85, len: sp4 };
    }
    case 'Syncopated': { const m = { 0: r, 3: r, 6: fifth, 10: r + 12, 12: r }[rel]; return m == null ? null : { m, v: rel === 0 ? .95 : .75, len: 3 }; }
    case 'Reggae Dub': { const m = { 0: r, 6: r, 8: r + 7, 11: r + 5, 14: r }[rel]; return m == null ? null : { m, v: rel === 0 ? .6 : .9, len: 3 }; }
  }
  return null;
}

/* ---------- rhythm guitar strum / arpeggio patterns ---------- */
const STRUMS = {
  'Folk D-DU-UDU': { p: 'D...d.u...u.d.u.' }, 'Down 4s': { p: 'D...D...D...D...' }, 'Pop 8ths': { p: 'D...D.u.D...D.u.' },
  'Pop 16th shimmer': { p: 'D.dudu.uD.dudu.u' }, 'Reggae Skank': { p: '..u...u...u...u.' }, 'Funk Chuck': { p: 'D.m.D.m.D.m.D.mu' },
  'Power Chug 8ths': { p: 'D.d.D.d.D.d.D.d.', power: 1 }, 'Ballad Arpeggio': { p: '1.3.4.3.2.3.4.3.', arp: 1 }, 'Travis Roll': { p: '1.4.2.4.1.4.3.4.', arp: 1 },
  'Island Strum': { p: 'D..uD.u..u.uD.u.' }, 'Half-time Pad': { p: 'D...............' }, 'Waltz 3/4': { p: 'D.....d...d.....' }
};
const voicingFor = sym => {
  const vs = voicings(sym, S.tuning, S.capo, 12), i = S.voicePref[sym];
  return vs[i != null && vs[i] ? i : 0] || null;
};
function strumAt(t, sym, ch, style) {
  const p = parseChord(sym); if (!p) return; const useSym = style.power ? (pcName(p.root, false) + '5') : sym; const v = voicingFor(useSym) || voicingFor(sym); if (!v) return;
  const notes = []; v.frets.forEach((f, i) => { if (f != null) notes.push({ st: i, m: S.tuning[i] + S.capo + f }); });
  if (style.arp) { const d = +ch; if (!d) return; const n = notes[(d - 1) % notes.length]; pluck('rhythm', t, n.m, .62, { id: 'r' + n.st, pan: (n.st - 2.5) * .05 }); return; }
  if (ch === '.') return; const lc = ch.toLowerCase(), down = lc === 'd' || lc === 'm', acc = ch === ch.toUpperCase() ? 1 : 0;
  const order = down ? notes : notes.slice().reverse(), gap = .0105 + Math.random() * .003, take = down ? order : order.slice(0, Math.max(3, order.length - 2));
  take.forEach((n, k) => pluck('rhythm', t + k * gap, n.m, (lc === 'm' ? .55 : acc ? .85 : .6) * (down ? 1 : .8) * (.92 + Math.random() * .16), { id: 'r' + n.st, dead: lc === 'm' && k > 0 ? true : false, t60m: lc === 'm' ? .3 : 1, pan: (n.st - 2.5) * .06 }));
}
const LEGATO = new Set(['h', 'p', '/', '\\']);
function playTabNote(bar, n, t, dur) {
  const midi = n.f === 'x' ? S.tuning[n.st] + S.capo : noteMidi(n), id = 'l' + n.st;
  const prev = bar.tab.filter(o => o.st === n.st && o.s < n.s).sort((a, b) => b.s - a.s)[0], leg = prev && LEGATO.has(prev.t);
  const vel = (n.f === 'x' ? .5 : (leg ? .5 : .85)) * (n.t === '<>' ? .55 : 1);
  pluck('lead', t, n.t === '<>' ? midi + 12 : midi, vel, { id, soft: leg || n.t === '<>', dead: n.f === 'x', pan: (n.st - 2.5) * .08 });
  if (n.t === 'b') pluck('lead', t + dur * 1.5, midi + ((n.bend != null ? n.bend : n.f + 2) - n.f), .5, { id, soft: true, pan: (n.st - 2.5) * .08 });
}

/* ---------- transport ---------- */
const T = { playing: false, rec: false, cursor: 0, slot: 0, next: 0, loop: true, loopA: 0, loopB: null, metro: true, q: [], srcs: [], timer: 0, bars: null, wantRec: false, recFrom: 0, startCursor: 0, ending: false };
bus.on('song', () => { T.bars = null; });
const songSlots = () => totalBars() * spb();
const barsCache = () => T.bars || (T.bars = flatBars());
function chordAt(bi, sib) {
  const bars = barsCache(), fb = bars[bi]; if (!fb) return null; const cs = barChords(fb.bar), n = Math.max(1, cs.length), sp = spb(), ci = Math.min(n - 1, Math.floor(sib / (sp / n)));
  const start = Math.round(ci * sp / n), len = Math.round((ci + 1) * sp / n) - start; let nxt = cs[ci + 1]; if (!nxt) { const nb = bars[(bi + 1) % bars.length]; nxt = nb && barChords(nb.bar)[0]; }
  return { sym: cs[ci] || null, start, len, rel: sib - start, next: nxt };
}
function scheduleSlot(slot, time) {
  const sp = spb(), dur = slotDur(), sw = (slot % 2 !== 0) ? S.swing * dur : 0, tt = time + sw;
  const beatSlots = 16 / S.ts[1];
  if (slot < 0) { const sib = ((slot % sp) + sp) % sp; if (sib % beatSlots === 0) click(time, sib === 0); return; }
  const bi = Math.floor(slot / sp), sib = slot % sp, fb = barsCache()[bi]; if (!fb) return;
  if (T.metro && sib % beatSlots === 0) click(tt, sib === 0);
  if (S.band.drumsOn) drumStep(sib, tt);
  const cd = chordAt(bi, sib);
  if (cd && cd.sym) {
    if (S.band.bassOn) { const e = bassEvent(S.band.bassStyle, cd.sym, cd.rel, cd.len, cd.next); if (e) pluck('bass', tt, e.m, e.v, { id: 'b', pan: 0 }); }
    if (S.band.compOn) { const st = STRUMS[S.band.compStyle] || STRUMS['Down 4s'], L = Math.min(16, sp); strumAt(tt, cd.sym, st.p[sib % L], st); }
  }
  if (S.band.leadOn) fb.bar.tab.forEach(n => { if (n.s === sib) playTabNote(fb.bar, n, tt, dur); });
}
async function play(fromRec) {
  if (T.playing) return; try { bandHint(); } catch (e) { } await startAudio(); const c = E.ctx; applyMix(); if (!S.sections.length || !songSlots()) { toast('Add a section with at least one bar first', 'warn'); return; }
  T.rec = !!fromRec || T.rec; T.playing = true; T.ending = false; T.q = []; T.startCursor = T.cursor;
  const ci = T.rec && CFG.countIn > 0 ? CFG.countIn * spb() : 0; T.slot = T.cursor - ci; T.next = c.currentTime + .08; T.wantRec = T.rec; T.recFrom = T.cursor;
  if (!T.loopB) T.loopB = null; scheduleTakes(T.next + ci * slotDur(), T.cursor * slotDur()); trackStart(T.next + ci * slotDur(), T.cursor, true);
  clearInterval(T.timer); T.timer = setInterval(tick, 25); tick(); bus.emit('transport');
}
function tick() {
  if (!T.playing) return; const c = E.ctx, dur = slotDur(), ahead = c.currentTime + .15;
  while (T.next < ahead && T.playing && !T.ending) {
    const total = songSlots(), end = T.loop ? (T.loopB != null ? Math.min(T.loopB, total) : total) : total;
    if (T.slot >= end) {
      if (T.loop && end > 0) { if (T.loopA >= end) T.loopA = 0; if (REC) recEnd(); T.slot = T.loopA; stopTakes(); scheduleTakes(T.next, T.loopA * dur); trackStart(T.next, T.loopA); if (T.rec) { T.wantRec = true; T.recFrom = T.loopA; } if (T.slot >= end) { T.ending = true; T.endAt = T.next; break; } continue; }
      T.ending = true; T.endAt = T.next; break;
    }
    if (T.wantRec && T.slot === T.recFrom) { recBegin(T.slot, T.next); T.wantRec = false; }
    scheduleSlot(T.slot, T.next); T.q.push({ slot: T.slot, time: T.next }); if (T.q.length > 256) T.q.shift(); T.slot++; T.next += dur;
  }
}
function stopPlay(keep) {
  if (!T.playing) { if (!keep) { T.cursor = 0; bus.emit('transport'); } return; }
  T.playing = false; clearInterval(T.timer); stopTakes(); trackStop(); if (E.pl && E.worklet) Object.values(E.pl).forEach(n => n.port.postMessage({ t: 'kill' }));
  const was = T.rec; if (REC) recEnd(); T.rec = false; T.cursor = T.startCursor; bus.emit('transport'); if (was) bus.emit('rec:done');
}
const slotAtTime = time => {
  const q = T.q; if (!q.length) return T.cursor; let e = q[0]; for (let i = q.length - 1; i >= 0; i--) if (q[i].time <= time) { e = q[i]; break; }
  return e.slot + (time - e.time) / slotDur();
};
function playheadSlot() { if (!T.playing || !E.ctx) return T.cursor; return slotAtTime(E.ctx.currentTime - (E.ctx.outputLatency || E.ctx.baseLatency || 0)); }
function seek(slot) { slot = clamp(Math.round(slot), 0, Math.max(0, songSlots() - 1)); const was = T.playing; if (was) stopPlay(true); T.cursor = slot; bus.emit('transport'); if (was) play(); }
function nearestSlotTime(t) { let b = null, bd = 1e9; for (const e of T.q) { const d = Math.abs(e.time - t); if (d < bd) { bd = d; b = e; } } return b ? { e: b, d: bd } : null; }

/* ---------- takes: recording (dry DI + wet print), playback and re-amp ---------- */
const TAKES = []; let REC = null;
/* Recording captures whatever is armed, all on the same clock: the guitar (dry DI + wet print) and/or the vocal (input 2). */
function recBegin(slot, ctxTime) {
  if (!E.hasInput) { toast('No audio input is open — recording the backing/tab only', 'warn'); return; }
  const g = armedG(), v = armedV();
  if (!g && !v) { toast('Nothing is armed — arm the Guitar or Vocal lane (the ● button at the left of the arrangement) to record', 'warn'); return; }
  REC = { dry: [], wet: [], vox: [], g, v, t0: ctxTime, startSec: slot * slotDur(), bpm: S.bpm, preset: RIG.cur, n: 0, cam: [], pkG: [], pkV: [], perf0: performance.now() + (ctxTime - E.ctx.currentTime) * 1000 };
  if (g) { E.tapDI.on(true); if (CFG.rec.wet) E.tapWet.on(true); } if (v) E.tapVox.on(true); bus.emit('rec:state', true);
}
function pushBlock(arr, m, t0) {
  const sr = E.ctx.sampleRate; let l = m.l, off = Math.round((t0 - m.t) * sr); if (off < 0) off = 0; if (off >= l.length) return null; const b = off ? l.subarray(off) : l; arr.push(b); return b;
}
/* running min/max per 1024 samples, so the arrangement can draw a take while it is being recorded */
function livePeaks(pk, b) { for (let i = 0; i < b.length; i += 1024) { let mn = 1, mx = -1; for (let k = i, e = Math.min(b.length, i + 1024); k < e; k++) { const v = b[k]; if (v < mn) mn = v; if (v > mx) mx = v; } pk.push(mn, mx); } }
bus.on('tap:di', m => { if (m.onset || !REC || !REC.g) return; const b = pushBlock(REC.dry, m, REC.t0); if (b) livePeaks(REC.pkG, b); });
bus.on('tap:wet', m => { if (!REC || !REC.g) return; pushBlock(REC.wet, m, REC.t0); });
bus.on('tap:vox', m => { if (m.onset || !REC || !REC.v) return; const b = pushBlock(REC.vox, m, REC.t0); if (b) livePeaks(REC.pkV, b); });
function cat(parts) { let n = 0; parts.forEach(p => n += p.length); const o = new Float32Array(n); let k = 0; parts.forEach(p => { o.set(p, k); k += p.length; }); return o; }
function peaksOf(d, per = 256) { const n = Math.ceil(d.length / per), mn = new Float32Array(n), mx = new Float32Array(n); for (let i = 0; i < n; i++) { let a = 1e9, b = -1e9; for (let k = i * per, e = Math.min(d.length, k + per); k < e; k++) { const v = d[k]; if (v < a) a = v; if (v > b) b = v; } mn[i] = a; mx[i] = b; } return { mn, mx, per }; }
function recEnd() {
  const r = REC; REC = null; E.tapDI.on(false); E.tapWet.on(false); E.tapVox.on(false); bus.emit('rec:state', false);
  if (!r) return; const sr = E.ctx.sampleRate, start = r.startSec - rttMs() / 1000, made = [];
  const mk = (kind, parts, wetParts) => {
    if (!parts.length) return; const dry = cat(parts), wet = wetParts && wetParts.length ? cat(wetParts) : null; if (dry.length < sr * .25) return;
    let pk = 0, e = 0; for (let i = 0; i < dry.length; i++) { const a = Math.abs(dry[i]); if (a > pk) pk = a; e += dry[i] * dry[i]; }
    const vox = kind === 'vox', nth = TAKES.filter(t => (t.kind === 'vox') === vox).length + 1;
    const take = { id: uid(), kind, name: (vox ? 'Vocal ' : 'Take ') + nth, startSec: start, sr, dry, wet, peaks: peaksOf(dry), g: 1, pan: 0, mute: false, solo: false, mode: vox ? 'wet' : (wet && CFG.rec.dry ? 'reamp' : 'wet'), bpm: r.bpm, preset: r.preset, peak: dB(pk), rms: dB(Math.sqrt(e / dry.length)), dur: dry.length / sr, t: Date.now(), stats: vox ? null : statsSnapshot(), cam: vox ? [] : r.cam };
    if (!vox && !CFG.rec.dry && wet) take.mode = 'wet'; TAKES.push(take); made.push(take);
  };
  if (r.g) mk('gtr', r.dry, r.wet); if (r.v) mk('vox', r.vox, null);
  if (made.length) { xpSignal(3); bus.emit('takes'); toast(made.map(t => t.name + ' (' + t.dur.toFixed(1) + ' s, peak ' + t.peak.toFixed(1) + ' dBFS)').join('  +  ') + ' recorded', 'ok'); }
}
function takeBuffer(tk, which) { const d = which === 'wet' ? tk.wet : tk.dry; if (!d) return null; if (!tk['_b' + which]) { const b = E.ctx.createBuffer(1, d.length, tk.sr); b.copyToChannel(d, 0); tk['_b' + which] = b; } return tk['_b' + which]; }
const takeAudible = tk => TAKES.some(t => t.solo) ? !!tk.solo : !tk.mute;
/** live gain / mute / solo changes while the take is playing */
function takeLive(tk) { const anySolo = TAKES.some(t => t.solo); TAKES.forEach(t => { if (t._g) tc(t._g.gain, (anySolo ? t.solo : !t.mute) ? t.g : 0, .015); }); if (tk && tk._pn) tc(tk._pn.pan, tk.pan || 0, .02); }
function scheduleTakes(atTime, fromSec) {
  TAKES.forEach(tk => {
    tk._g = null; tk._pn = null; const vox = tk.kind === 'vox', which = tk.mode === 'reamp' ? 'dry' : 'wet', buf = takeBuffer(tk, which) || takeBuffer(tk, 'dry'); if (!buf) return;
    const end = tk.startSec + buf.duration; if (end <= fromSec) return; const when = Math.max(atTime, atTime + (tk.startSec - fromSec)), off = Math.max(0, fromSec - tk.startSec);
    const src = E.ctx.createBufferSource(), g = gn(takeAudible(tk) ? tk.g : 0), pn = E.ctx.createStereoPanner(); pn.pan.value = tk.pan || 0; src.buffer = buf; src.connect(g); g.connect(pn); tk._g = g; tk._pn = pn;
    if (vox) pn.connect(E.voxStrip.in); else if (which === 'dry' && tk.mode === 'reamp') pn.connect(E.rigIn); else pn.connect(E.takesIn);
    src.start(when, off); T.srcs.push(src);
  });
}
function stopTakes() { T.srcs.forEach(s => { try { s.stop(); } catch (e) { } }); T.srcs = []; }

/* ---------- WAV ---------- */
function encodeWav(chs, sr, bits = 24) {
  const n = chs[0].length, nc = chs.length, bps = bits / 8, buf = new ArrayBuffer(44 + n * nc * bps), v = new DataView(buf);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + n * nc * bps, true); ws(8, 'WAVE'); ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, bits === 32 ? 3 : 1, true); v.setUint16(22, nc, true); v.setUint32(24, sr, true); v.setUint32(28, sr * nc * bps, true); v.setUint16(32, nc * bps, true); v.setUint16(34, bits, true); ws(36, 'data'); v.setUint32(40, n * nc * bps, true);
  let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) { const s = clamp(chs[c][i], -1, 1); if (bits === 32) { v.setFloat32(o, s, true); o += 4; } else if (bits === 24) { const x = Math.round(s * 8388607); v.setUint8(o, x & 255); v.setUint8(o + 1, (x >> 8) & 255); v.setUint8(o + 2, (x >> 16) & 255); o += 3; } else { v.setInt16(o, Math.round(s * 32767), true); o += 2; } }
  return new Blob([buf], { type: 'audio/wav' });
}
let BOUNCE = null;
async function bounceMaster(tag) {
  if (BOUNCE) return toast('A bounce is already running', 'warn'); await startAudio(); if (T.playing) stopPlay(true);
  BOUNCE = { l: [], r: [], t0: 0 }; const was = { loop: T.loop, metro: T.metro }; T.loop = false; T.metro = false; T.cursor = 0;
  toast('Bouncing master in real time…'); await play(); BOUNCE.t0 = E.ctx.currentTime + .08; E.tapMaster.on(true);
  const total = songSlots() * slotDur();
  await new Promise(r => setTimeout(r, (total + 3.2) * 1000)); E.tapMaster.on(false); stopPlay(true); T.loop = was.loop; T.metro = was.metro;
  const B = BOUNCE; BOUNCE = null; if (!B.l.length) return toast('Nothing captured', 'bad');
  const l = cat(B.l), r = cat(B.r); download((S.title || 'song').replace(/\W+/g, '_') + '_' + (tag || 'master') + '.wav', encodeWav([l, r], E.ctx.sampleRate, 24)); toast((tag ? 'Saved ' + tag : 'Master bounce saved'), 'ok');
}
/** Save one band part (Drums, Bass, Rhythm Gtr or Lead) as its own stereo WAV: everything else is silenced for one real-time pass, then put back. */
async function bouncePart(id) {
  const key = BANDMAP[id]; if (!key) return; if (!S.band[key]) return toast('Switch this part on first (the ⏻ button on its lane)', 'warn');
  const keys = Object.values(BANDMAP), was = keys.map(k => S.band[k]), tm = TAKES.map(t => t.mute), sm = STM.mute;
  keys.forEach(k => { S.band[k] = k === key; }); TAKES.forEach(t => { t.mute = true; }); STM.mute = true; try { spBus(); } catch (e) { }
  try { await bounceMaster(({ drums: 'drums', bass: 'bass', rhythm: 'rhythm_guitar', lead: 'lead' })[id]); }
  finally { keys.forEach((k, i) => { S.band[k] = was[i]; }); TAKES.forEach((t, i) => { t.mute = tm[i]; }); STM.mute = sm; try { spBus(); } catch (e) { } bus.emit('song', 'band'); bus.emit('takes'); }
}
async function bounceAllParts() { for (const id of Object.keys(BANDMAP)) if (S.band[BANDMAP[id]]) await bouncePart(id); }
bus.on('tap:master', m => { if (!BOUNCE) return; const sr = E.ctx.sampleRate; let off = Math.round((BOUNCE.t0 - m.t) * sr); if (off < 0) off = 0; if (off >= m.l.length) return; BOUNCE.l.push(m.l.subarray(off)); BOUNCE.r.push((m.r || m.l).subarray(off)); });

/* >>> parts/04-analysis.js */
/* ============================================================
   Part 04 · analysis & research layer: YIN f0, chroma/chord, key, onsets, timing, stats, latency lab
   ============================================================ */
function yin(buf, sr, thresh = .12) {
  const dec = sr >= 32000 ? 2 : 1, n = Math.floor(buf.length / dec), x = new Float32Array(n), fs = sr / dec;
  for (let i = 0; i < n; i++) x[i] = dec === 2 ? (buf[2 * i] + buf[2 * i + 1]) * .5 : buf[i];
  const W = n >> 1, tauMax = Math.min(W - 2, Math.floor(fs / 45)), tauMin = Math.max(2, Math.floor(fs / 1400)), d = new Float32Array(tauMax + 2);
  for (let tau = 1; tau <= tauMax; tau++) { let s = 0; for (let i = 0; i < W; i++) { const t = x[i] - x[i + tau]; s += t * t; } d[tau] = s; }
  let run = 0; d[0] = 1; for (let tau = 1; tau <= tauMax; tau++) { run += d[tau]; d[tau] = d[tau] * tau / (run || 1); }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) if (d[t] < thresh) { while (t + 1 <= tauMax && d[t + 1] < d[t]) t++; tau = t; break; }
  if (tau < 0) { let mn = 1e9, mi = -1; for (let t = tauMin; t <= tauMax; t++) if (d[t] < mn) { mn = d[t]; mi = t; } if (mn > .3 || mi < 0) return null; tau = mi; }
  const a = d[tau - 1], b = d[tau], c = d[tau + 1], den = 2 * (a - 2 * b + c), sh = den ? clamp((a - c) / den, -1, 1) : 0;
  return { f: fs / (tau + sh), clarity: clamp(1 - d[tau], 0, 1) };
}
const KS_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], KS_MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
function corr(a, b) { const ma = mean(a), mb = mean(b); let n = 0, da = 0, db = 0; for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return n / Math.sqrt(da * db || 1); }
function detectKey(h) {
  const res = []; for (let r = 0; r < 12; r++) { const rot = i => h[(r + i) % 12]; const v = Array.from({ length: 12 }, (_, i) => rot(i)); res.push({ root: r, minor: false, r: corr(v, KS_MAJ) }, { root: r, minor: true, r: corr(v, KS_MIN) }); }
  res.sort((a, b) => b.r - a.r); return res;
}
const CT = [['', [0, 4, 7]], ['m', [0, 3, 7]], ['7', [0, 4, 7, 10]], ['maj7', [0, 4, 7, 11]], ['m7', [0, 3, 7, 10]], ['sus4', [0, 5, 7]], ['sus2', [0, 2, 7]], ['dim', [0, 3, 6]], ['5', [0, 7]]];
function detectChord(ch) {
  let tot = 0; for (let i = 0; i < 12; i++) tot += ch[i]; if (tot < 1e-9) return [];
  const out = [];
  for (let r = 0; r < 12; r++) for (const [q, iv] of CT) {
    let s = 0, tn = 0; for (let i = 0; i < 12; i++) { const t = iv.includes(((i - r) + 12) % 12) ? (i === r ? 1.25 : 1) : 0; s += ch[i] * t; tn += t * t; }
    let n2 = 0; for (let i = 0; i < 12; i++) n2 += ch[i] * ch[i];
    out.push({ sym: pcName(r) + q, root: r, q, score: s / (Math.sqrt(tn) * Math.sqrt(n2) || 1) - (q === '5' ? .06 : q === 'sus2' || q === 'sus4' ? .03 : 0) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}

const AN = { rms: -120, peak: -120, crest: 0, f0: 0, cents: 0, midi: null, clarity: 0, centroid: 0, rolloff: 0, flat: 0, hfr: null, chord: [], chroma: new Float32Array(12), key: null, vib: null, clip: false, onsetT: 0, noteStable: 0, active: false };
const STAT = { t0: performance.now(), activeS: 0, notes: 0, pcDur: new Array(12).fill(0), pcN: new Array(12).fill(0), oct: {}, noteCents: [], timing: [], rows: [], rmsHist: [], centsHist: [], noise: [], actRms: [], onsets: 0, clipF: 0, fuseT: 0, fuseA: 0, frames: [], hfr: [], vibN: 0 };
let tdBuf = null, fdBuf = null, CUR = null, cand = null, lostN = 0, f0q = [], centsRing = [], clipRun = 0, steadyRun = 0, anaN = 0;
const CAP = { on: false, count: 0, lastFret: 5, lastSt: 3 };
const VIS = { cands: [], active: false };

function anaTick() {
  if (!E.ready || !E.hasInput) return; const sr = E.ctx.sampleRate; anaN++;
  if (!tdBuf) { tdBuf = new Float32Array(E.anaDI.fftSize); fdBuf = new Float32Array(E.anaChroma.frequencyBinCount); }
  E.anaDI.getFloatTimeDomainData(tdBuf); let pk = 0, e = 0; for (let i = 0; i < tdBuf.length; i++) { const v = tdBuf[i], a = Math.abs(v); if (a > pk) pk = a; e += v * v; }
  const rms = Math.sqrt(e / tdBuf.length); AN.rms = dB(rms); AN.peak = dB(pk); AN.crest = pk / (rms || 1e-9); AN.clip = pk > .985;
  clipRun = AN.clip ? clipRun + 1 : 0; if (clipRun === 30) { toast('Input is clipping — reduce the interface gain or the trim', 'warn'); STAT.clipF++; }
  const act = AN.rms > (CFG.gateDb != null ? CFG.gateDb : -56); AN.active = act;
  let f = 0, cl = 0;
  if (act) { const r = yin(tdBuf, sr); if (r) { f = r.f; cl = r.clarity; } }
  AN.clarity = cl;
  if (f > 60 && f < 1400 && cl > .8) {
    f0q.push(f); if (f0q.length > 3) f0q.shift(); const fm = median(f0q); AN.f0 = fm; const m = ftom(fm), r = Math.round(m); AN.cents = (m - r) * 100; AN.midi = r;
    centsRing.push(AN.cents); if (centsRing.length > 48) centsRing.shift();
    if (cand && cand.midi === r) cand.n++; else cand = { midi: r, n: 1, t: E.ctx.currentTime }; lostN = 0;
    if (cand.n === 3 && (!CUR || CUR.midi !== r)) noteOn(r);
    if (CUR && CUR.midi === r) { CUR.cs.push(AN.cents); CUR.n++; }
    steadyRun = (CUR && cl > .93 && AN.rms > -14) ? steadyRun + 1 : 0;
    if (steadyRun === 60 && CFG.monitor && !T.playing) { setMonitor(false); toast('Sustained tone with monitoring on — monitor muted to stop possible feedback', 'warn'); steadyRun = 0; }
  } else { if (++lostN > 4) { AN.f0 = 0; AN.midi = null; f0q = []; if (CUR) noteOff(); cand = null; centsRing = []; AN.vib = null; } }
  if (!act && CUR) noteOff();
  if (AN.f0 && centsRing.length >= 24) vibrato();
  if (anaN % 3 === 0) spectral(sr);
  if (anaN % 3 === 0) sample();
}
function vibrato() {
  const a = centsRing, n = a.length, k = 12, hp = a.map((v, i) => { let s = 0, c = 0; for (let j = Math.max(0, i - k); j <= Math.min(n - 1, i + k); j++) { s += a[j]; c++; } return v - s / c; });
  let z = 0; for (let i = 1; i < n; i++) if ((hp[i - 1] < 0) !== (hp[i] < 0)) z++;
  const rate = z / 2 / (n / 30), ext = (Math.max(...hp) - Math.min(...hp)) / 2;
  AN.vib = (rate >= 3.5 && rate <= 9.5 && ext > 6) ? { rate, ext } : null; if (AN.vib) STAT.vibN++;
}
function noteOn(m) {
  if (CUR) noteOff(); const t = E.ctx.currentTime, onT = (t - AN.onsetT < .3 && AN.onsetT > 0) ? AN.onsetT : t - .05;
  CUR = { midi: m, t0: t, onT, cs: [], n: 0, rms: AN.rms }; STAT.notes++; STAT.pcN[m % 12]++; const o = Math.floor(m / 12) - 1; STAT.oct[o] = (STAT.oct[o] || 0) + 1;
  bus.emit('note', { midi: m, t: onT });
  if (VIS.active) { const rec = VIS.cands.filter(c => performance.now() - c.t < 500); STAT.fuseT++; const open = S.tuning.some(o => o + S.capo === m); if (rec.some(c => c.midi === m) || (open && !rec.some(c => c.st === S.tuning.findIndex(o => o + S.capo === m)))) STAT.fuseA++; }
  if (CAP.on && T.playing) captureNote(m, onT);
}
function noteOff() {
  const c = CUR; CUR = null; if (!c) return; const dur = E.ctx.currentTime - c.t0; STAT.pcDur[c.midi % 12] += dur;
  const cs = c.cs.slice(Math.floor(c.cs.length * .25)); if (cs.length > 4) STAT.noteCents.push({ midi: c.midi, mean: mean(cs), sd: sd(cs), abs: mean(cs.map(Math.abs)) });
  if (STAT.pcN.reduce((a, b) => a + b, 0) >= 8) { const k = detectKey(STAT.pcDur.map((d, i) => d + STAT.pcN[i] * .15)); AN.key = k.slice(0, 3); }
  bus.emit('noteoff', c);
}
function spectral(sr) {
  E.anaChroma.getFloatFrequencyData(fdBuf); const bh = sr / E.anaChroma.fftSize, ch = new Float32Array(12); let sw = 0, sm = 0, tot = 0, lg = 0, nb = 0;
  const k0 = Math.max(1, Math.floor(70 / bh)), k1 = Math.min(fdBuf.length - 1, Math.floor(6000 / bh)), mag = new Float32Array(k1 + 2);
  for (let k = k0; k <= k1; k++) { const dbv = fdBuf[k]; const m = dbv < -92 ? 0 : Math.pow(10, dbv / 20); mag[k] = m; const f = k * bh; sw += f * m; sm += m; if (f > 100) { lg += Math.log(m + 1e-9); nb++; } if (f < 2200 && m > 0) { const pc = ((Math.round(ftom(f)) % 12) + 12) % 12; ch[pc] += m * m; } tot += m; }
  if (sm > 0) { AN.centroid = sw / sm; let acc = 0; for (let k = k0; k <= k1; k++) { acc += mag[k]; if (acc >= .85 * sm) { AN.rolloff = k * bh; break; } } AN.flat = Math.exp(lg / Math.max(1, nb)) / (tot / Math.max(1, k1 - k0 + 1) + 1e-12); } else { AN.centroid = AN.rolloff = AN.flat = 0; }
  let en = 0; for (let i = 0; i < 12; i++) en += ch[i]; for (let i = 0; i < 12; i++) AN.chroma[i] = AN.chroma[i] * .65 + (en > 0 ? ch[i] / Math.sqrt(en) : 0) * .35;
  AN.chord = AN.active ? detectChord(AN.chroma) : [];
  if (AN.f0 && AN.clarity > .9) { const A = i => { const k = Math.round(AN.f0 * i / bh); let m = 0; for (let j = k - 2; j <= k + 2; j++) if (mag[j] > m) m = mag[j]; return m; }; const a1 = A(1); if (a1 > 0) { let s = 0; for (let i = 2; i <= 6; i++) { const a = A(i); s += a * a; } AN.hfr = 20 * Math.log10(Math.sqrt(s) / a1 + 1e-9); STAT.hfr.push(AN.hfr); if (STAT.hfr.length > 600) STAT.hfr.shift(); } } else AN.hfr = null;
}
function sample() {
  const t = (performance.now() - STAT.t0) / 1000; STAT.rows.push({ t, rms: AN.rms, peak: AN.peak, f0: AN.f0, cents: AN.cents, midi: AN.midi, centroid: AN.centroid, hfr: AN.hfr });
  if (STAT.rows.length > 12000) STAT.rows.shift(); STAT.rmsHist.push(AN.rms); if (STAT.rmsHist.length > 240) STAT.rmsHist.shift();
  STAT.centsHist.push(AN.f0 ? AN.cents : null); if (STAT.centsHist.length > 240) STAT.centsHist.shift();
  if (AN.active) { STAT.activeS += .1; STAT.actRms.push(AN.rms); if (STAT.actRms.length > 3000) STAT.actRms.shift(); } else if (AN.rms < -45) { STAT.noise.push(AN.rms); if (STAT.noise.length > 600) STAT.noise.shift(); }
}
bus.on('tap:di', m => anOnset(m, 'g'));
bus.on('tap:vox', m => anOnset(m, 'v'));
function anOnset(m, who) {
  if (!m.onset) return; const f = CFG.anSrc || 'g'; if (f !== 'b' && f !== who) return; AN.onsetT = m.t; STAT.onsets++; bus.emit('onset', m);
  if (T.playing && T.q.length) {
    const g = 16 / (CFG.timingGrid || 4) / 4 || 1, want = CFG.timingGrid || 2; /* grid: slots per grid step */
    const step = want === 4 ? 1 : want === 2 ? 2 : 4, tt = m.t - rttMs() / 1000; let best = null, bd = 1e9;
    for (const e of T.q) { if (e.slot < 0 || e.slot % step) continue; const d = tt - e.time; if (Math.abs(d) < Math.abs(bd)) { bd = d; best = e; } }
    if (best && Math.abs(bd) < slotDur() * step * .5) { STAT.timing.push(bd * 1000); if (STAT.timing.length > 800) STAT.timing.shift(); bus.emit('timing', bd * 1000); }
  }
}
function statsSnapshot() {
  const ca = STAT.noteCents.map(n => n.abs), tm = STAT.timing;
  return { notes: STAT.notes, centsAbs: ca.length ? +mean(ca).toFixed(1) : null, timingMean: tm.length ? +mean(tm).toFixed(1) : null, timingSD: tm.length > 2 ? +sd(tm).toFixed(1) : null, key: AN.key ? pcName(AN.key[0].root) + (AN.key[0].minor ? 'm' : '') : null };
}
function resetStats() { Object.assign(STAT, { t0: performance.now(), activeS: 0, notes: 0, pcDur: new Array(12).fill(0), pcN: new Array(12).fill(0), oct: {}, noteCents: [], timing: [], rows: [], rmsHist: [], centsHist: [], noise: [], actRms: [], onsets: 0, clipF: 0, fuseT: 0, fuseA: 0, hfr: [], vibN: 0 }); AN.key = null; bus.emit('stats:reset'); }
function statsCSV() {
  const L = ['t_s,rms_dbfs,peak_dbfs,f0_hz,cents,midi,centroid_hz,hfr_db']; STAT.rows.forEach(r => L.push([r.t.toFixed(2), r.rms.toFixed(1), r.peak.toFixed(1), r.f0 ? r.f0.toFixed(2) : '', r.f0 ? r.cents.toFixed(1) : '', r.midi == null ? '' : r.midi, r.centroid ? r.centroid.toFixed(0) : '', r.hfr == null ? '' : r.hfr.toFixed(1)].join(','))); return L.join('\n');
}

/* ---------- tab capture: audio (+ camera fusion) → string/fret assignment ---------- */
function assignFret(midi) {
  const cs = []; S.tuning.forEach((o, st) => { const f = midi - o - S.capo; if (f >= 0 && f <= 24) cs.push({ st, f }); });
  if (!cs.length) return null; const now = performance.now();
  cs.forEach(c => {
    c.cost = Math.abs(c.f - CAP.lastFret) * 1.0 + (c.f > 12 ? 3 : 0) + Math.abs(c.st - CAP.lastSt) * .35 - (c.f === 0 ? .6 : 0);
    if (VIS.active && VIS.cands.some(v => now - v.t < 450 && v.st === c.st && v.fret === c.f)) c.cost -= 6;
  });
  cs.sort((a, b) => a.cost - b.cost); return cs[0];
}
function captureNote(midi, onT) {
  const a = assignFret(midi); if (!a) return; const tt = onT - rttMs() / 1000, slot = Math.round(slotAtTime(tt)), sp = spb(), bi = Math.floor(slot / sp), sib = slot - bi * sp, fb = barsCache()[bi];
  if (!fb || slot < 0) return; fb.bar.tab = fb.bar.tab.filter(n => !(n.s === sib && n.st === a.st)); fb.bar.tab.push({ s: sib, st: a.st, f: a.f, t: '' });
  CAP.lastFret = a.f > 0 ? a.f : CAP.lastFret; CAP.lastSt = a.st; CAP.count++; commit(false);
}

/* ---------- latency lab: loopback round-trip measurement by chirp cross-correlation ---------- */
async function measureRTT() {
  await startAudio(); if (!E.hasInput) { toast('Open an audio input first', 'bad'); return null; }
  const c = E.ctx, sr = c.sampleRate, cn = Math.floor(sr * .008), buf = c.createBuffer(1, cn, sr), d = buf.getChannelData(0);
  for (let i = 0; i < cn; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * (800 * t + (7000 - 800) / (2 * .008) * t * t)) * (.5 - .5 * Math.cos(2 * Math.PI * i / (cn - 1))); }
  const blocks = []; const on = m => { if (!m.onset) blocks.push({ t: m.t, l: m.l }); }; LAB.fn = on; E.tapDI.on(true);
  const T0 = c.currentTime + .4, N = 6; for (let k = 0; k < N; k++) { const s = c.createBufferSource(); s.buffer = buf; s.connect(E.testOut); s.start(T0 + k * .5); }
  toast('Measuring round-trip latency… keep Line Out looped to Input (or a mic near the speaker)');
  await new Promise(r => setTimeout(r, 4600)); E.tapDI.on(false); LAB.fn = null;
  if (!blocks.length) { toast('No audio captured', 'bad'); return null; }
  const t0 = blocks[0].t, x = cat(blocks.map(b => b.l)), res = [];
  for (let k = 0; k < N; k++) {
    const tk = T0 + k * .5, s0 = Math.max(0, Math.floor((tk - t0 - .005) * sr)), s1 = Math.min(x.length - cn, Math.floor((tk - t0 + .25) * sr)); if (s1 <= s0) continue;
    let best = 0, bi = -1, sum = 0, cnt = 0;
    for (let i = s0; i < s1; i++) { let a = 0; for (let j = 0; j < cn; j += 1) a += x[i + j] * d[j]; const aa = Math.abs(a); sum += aa; cnt++; if (aa > best) { best = aa; bi = i; } }
    if (bi < 0 || best < 6 * (sum / cnt) || best < .02) continue;
    let sub = 0; { const a = Math.abs(corrAt(x, d, bi - 1, cn)), b = best, cc = Math.abs(corrAt(x, d, bi + 1, cn)), den = 2 * (a - 2 * b + cc); sub = den ? clamp((a - cc) / den, -.5, .5) : 0; }
    res.push(((t0 + (bi + sub) / sr) - tk) * 1000);
  }
  if (res.length < 3) { toast('Loopback not detected. Connect Line Out → Input 1 (or hold a mic near the speaker) and raise the input gain.', 'bad'); return null; }
  const m = median(res), s = sd(res); CFG.rtt = +m.toFixed(2); saveCfg(); bus.emit('latency', { m, s, n: res.length, all: res }); toast('Round-trip latency ' + m.toFixed(1) + ' ms (σ ' + s.toFixed(2) + ' ms) — applied to recording alignment', 'ok'); return { m, s, n: res.length };
}
const LAB = { fn: null }; bus.on('tap:di', m => { if (LAB.fn) LAB.fn(m); });
function corrAt(x, d, i, cn) { if (i < 0 || i + cn > x.length) return 0; let a = 0; for (let j = 0; j < cn; j++) a += x[i + j] * d[j]; return a; }

/* >>> parts/05-ui-core.js */
/* ============================================================
   Part 05 · UI core: knobs, MIDI learn, header / transport, settings, help, shortcuts, status
   ============================================================ */
const KNOBS = new Map(), LEARN = { key: null }, UI = {};
function arc(r, a0, a1) {
  const p = a => [24 + r * Math.cos(a * Math.PI / 180), 24 + r * Math.sin(a * Math.PI / 180)], [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${(a1 - a0) > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
function mkKnob(o) {
  const lg = !!o.log, toN = x => lg ? Math.log(x / o.min) / Math.log(o.max / o.min) : (x - o.min) / (o.max - o.min), fromN = n => lg ? o.min * Math.pow(o.max / o.min, n) : o.min + n * (o.max - o.min);
  const track = sv('path', { class: 'k-t', d: arc(19, 135, 405) }), val = sv('path', { class: 'k-a', d: arc(19, 135, 136) }), cap = sv('circle', { class: 'k-cap', cx: 24, cy: 24, r: 13 }), ptr = sv('line', { class: 'k-p', x1: 24, y1: 24, x2: 24, y2: 14 });
  const svg = sv('svg', { viewBox: '0 0 48 48', class: 'knob-svg' }, track, val, cap, ptr), vl = h('div', { class: 'k-v' }), lb = h('div', { class: 'k-l', title: o.label }, o.label);
  const el = h('div', { class: 'knob', title: (o.title || o.label) + ' — drag, wheel, double-click to reset, right-click for MIDI learn' }, svg, vl, lb);
  const dec = o.step >= 1 ? 0 : o.step >= .1 ? 1 : 2; let v = o.def;
  const fmt = x => o.fmt ? o.fmt(x) : ((Math.abs(x) >= 1000 ? (x / 1000).toFixed(2) + 'k' : (Math.abs(x) >= 100 && lg ? x.toFixed(0) : x.toFixed(dec))) + (o.unit || ''));
  const draw = () => { const n = clamp(toN(v), 0, 1), a = 135 + 270 * n; val.setAttribute('d', arc(19, 135, Math.max(136, a))); const r = a * Math.PI / 180; ptr.setAttribute('x2', 24 + 10 * Math.cos(r)); ptr.setAttribute('y2', 24 + 10 * Math.sin(r)); vl.textContent = fmt(v); };
  const set = (x, silent) => { x = clamp(x, o.min, o.max); if (o.step && !lg) x = Math.round(x / o.step) * o.step; v = x; draw(); if (!silent && o.onChange) o.onChange(v); };
  let sy = 0, n0 = 0, drag = false;
  el.addEventListener('pointerdown', e => { if (e.button) return; drag = true; sy = e.clientY; n0 = toN(v); el.setPointerCapture(e.pointerId); e.preventDefault(); });
  el.addEventListener('pointermove', e => { if (!drag) return; set(fromN(clamp(n0 + (sy - e.clientY) / (e.shiftKey ? 600 : 170), 0, 1))); });
  el.addEventListener('pointerup', () => { drag = false; }); el.addEventListener('pointercancel', () => { drag = false; });
  el.addEventListener('wheel', e => { e.preventDefault(); set(fromN(clamp(toN(v) - Math.sign(e.deltaY) * (e.shiftKey ? .004 : .025), 0, 1))); }, { passive: false });
  el.addEventListener('dblclick', () => set(o.def));
  el.addEventListener('contextmenu', e => { e.preventDefault(); if (!o.key) return; KNOBS.forEach(k => k.el.classList.remove('learn')); if (LEARN.key === o.key) { LEARN.key = null; return; } LEARN.key = o.key; el.classList.add('learn'); toast('MIDI learn: move a controller to bind “' + o.label + '”'); initMIDI(); });
  const api = { el, set, get: () => v, setNorm: n => set(fromN(clamp(n, 0, 1))), def: o.def }; draw(); if (o.key) KNOBS.set(o.key, api); return api;
}
const MIDI = { access: null };
const MIDIHOOKS = [];
async function initMIDI() {
  if (MIDI.access || !navigator.requestMIDIAccess) return;
  try { const a = await navigator.requestMIDIAccess(); MIDI.access = a; const hook = () => a.inputs.forEach(i => { i.onmidimessage = onMidi; }); hook(); a.onstatechange = () => { hook(); bus.emit('midi'); }; CFG.midi = true; saveCfg(); bus.emit('midi'); }
  catch (e) { if (document.body.dataset.form && document.body.dataset.form !== 'desktop') console.warn('MIDI unavailable: ' + e.message); else toast('MIDI unavailable: ' + e.message, 'warn'); }
}
function onMidi(e) {
  const [st, d1, d2] = e.data, cmd = st & 0xf0;
  if (cmd === 0xB0) {
    if (LEARN.key) { CFG.midimap[d1] = LEARN.key; saveCfg(); toast('CC ' + d1 + ' → ' + LEARN.key, 'ok'); const k = KNOBS.get(LEARN.key); if (k) k.el.classList.remove('learn'); LEARN.key = null; bus.emit('midi'); return; }
    const key = CFG.midimap[d1]; if (key && KNOBS.get(key)) KNOBS.get(key).setNorm(d2 / 127);
  } else if (cmd === 0x90 && d2 > 0) { MIDIHOOKS.forEach(f => { try { f(d1, d2, st & 15); } catch (er) { console.warn(er); } }); }
  else if (cmd === 0xC0) { const p = allPresets()[d1]; if (p) { loadPreset(p); toast('Program ' + d1 + ': ' + p.n); } }
}

/* ---------- theme / appearance ---------- */
/* applyAppearance() and setTheme() live in 05b-look.js */

/* ---------- header & transport ---------- */
const barStr = p => { const sp = spb(), bs = 16 / S.ts[1], b = Math.floor(p / sp), s = p - b * sp; return (b + 1) + '·' + (Math.floor(s / bs) + 1) + '·' + (Math.floor(s % bs) + 1); };
function buildHeader() {
  const tr = $('#transport');
  const B = (cls, txt, title, fn) => h('button', { class: 'btn icon ' + cls, title, onclick: fn }, txt);
  UI.rew = B('', '⏮', 'Return to start (Home)', () => { if (T.playing) { stopPlay(true); T.cursor = 0; play(); } else { T.cursor = 0; bus.emit('transport'); } });
  UI.play = B('play', '▶', 'Play / pause (Space)', () => T.playing ? stopPlay(true) : play());
  UI.stop = B('', '⏹', 'Stop (returns to start position)', () => stopPlay(false));
  UI.rec = B('rec', '●', 'Record guitar take (R)', toggleRec);
  UI.loop = h('button', { class: 'btn sm', title: 'Loop (L)', onclick: () => { T.loop = !T.loop; syncTransport(); } }, '⟲', h('span', { class: 'lbl' }, ' Loop'));
  UI.metro = h('button', { class: 'btn sm', title: 'Metronome (M)', onclick: () => { T.metro = !T.metro; syncTransport(); } }, '♩', h('span', { class: 'lbl' }, ' Click'));
  UI.pos = h('div', { class: 'lcd' }, h('b', {}, '1·1·1'), h('i', {}, 'BAR·BEAT·SLOT')); UI.tim = h('div', { class: 'lcd', style: { minWidth: '88px' } }, h('b', {}, '00:00.00'), h('i', {}, 'TIME'));
  UI.bpm = h('input', { type: 'number', min: 30, max: 260, step: 1, value: S.bpm, onchange: e => { S.bpm = clamp(+e.target.value || 90, 30, 260); e.target.value = S.bpm; commit(false); bus.emit('bpm'); } });
  UI.ts = h('select', { onchange: e => { const [n, d] = e.target.value.split('/').map(Number); S.ts = [n, d]; S.band.drumLen = Math.min(32, spb()); commit(); } }, ['4/4', '3/4', '2/4', '5/4', '6/8', '12/8', '7/8'].map(x => h('option', { value: x }, x)));
  UI.key = h('select', { onchange: () => keyChanged() }, NS.map((n, i) => h('option', { value: i }, n))); UI.mode = h('select', { onchange: () => keyChanged() }, [h('option', { value: 'maj' }, 'maj'), h('option', { value: 'min' }, 'min')]);
  tr.append(UI.rew, UI.play, UI.stop, UI.rec, UI.loop, UI.metro, UI.pos, UI.tim, h('label', { class: 'field', style: { width: '58px' } }, 'BPM', UI.bpm), h('label', { class: 'field', style: { width: '54px' } }, 'Sig', UI.ts), h('label', { class: 'field', style: { width: '56px' } }, 'Key', UI.key), h('label', { class: 'field', style: { width: '56px' } }, 'Mode', UI.mode));
  const R = $('#topR');
  UI.lat = h('span', { class: 'chip', title: 'Round-trip latency estimate. Run the Loopback Test in I/O for a measured value.' }, h('i', { class: 'led' }), h('span', {}, 'audio off'));
  UI.theme = h('button', { class: 'btn icon', title: 'Appearance: light / dark, palettes, accent, density…', onclick: () => lookOpen() }, '◐');
  R.append(audioButton(), UI.lat, UI.theme, h('button', { class: 'btn icon', title: 'Settings', onclick: openSettings }, '⚙'), h('button', { class: 'btn icon', title: 'Help & shortcuts (?)', onclick: openHelp }, '?'));
}
function keyChanged() {
  S.key = +UI.key.value; S.minor = UI.mode.value === 'min'; if (/Major|Minor/.test(S.scale) || S.scale.startsWith('Natural')) S.scale = S.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)'; CFG.flats = keyUsesFlats(S.key, S.minor) ? true : false; saveCfg(); commit();
}
function toggleRec() {
  if (T.rec && T.playing) { stopPlay(true); return; }
  T.rec = !T.rec; if (T.rec && !E.hasInput) toast('Arming without an input: only the count-in will run. Open an input in I/O.', 'warn'); syncTransport();
  if (T.rec && !T.playing) play(true);
}
function syncTransport() {
  if (!UI.play) return; UI.play.textContent = T.playing ? '⏸' : '▶'; UI.play.classList.toggle('on', T.playing);
  UI.rec.classList.toggle('armed', T.rec && !T.playing); UI.rec.classList.toggle('on', T.rec && T.playing); UI.loop.classList.toggle('on', T.loop); UI.metro.classList.toggle('on', T.metro);
  UI.bpm.value = S.bpm; UI.ts.value = S.ts.join('/'); UI.key.value = S.key; UI.mode.value = S.minor ? 'min' : 'maj';
}
bus.on('transport', syncTransport); bus.on('song', syncTransport); bus.on('rec:state', syncTransport);

/* ---------- settings / help ---------- */
function openSettings() {
  const d = $('#settings'); d.innerHTML = '';
  const F = (label, el) => h('label', { class: 'field' }, label, el);
  const sel = (key, opts, cb) => h('select', { onchange: e => { const v = e.target.value; CFG[key] = isNaN(+v) || v === '' ? v : (key === 'hint' ? v : +v); saveCfg(); cb && cb(); } }, opts.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: String(CFG[key]) === String(v) }, t); }));
  const chk = (label, key, cb) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!CFG[key], onchange: e => { CFG[key] = e.target.checked; saveCfg(); cb && cb(); } }), label);
  const num = (key, min, max, step, cb) => h('input', { type: 'number', min, max, step, value: CFG[key], onchange: e => { CFG[key] = +e.target.value; saveCfg(); cb && cb(); } });
  d.append(h('div', { class: 'dlg-h' }, 'SETTINGS', h('button', { class: 'btn sm', onclick: () => d.close() }, 'Close')),
    h('div', { class: 'dlg-b' },
      h('h5', {}, 'Appearance'),
      F('Theme', h('div', { class: 'seg' }, [['light', 'Light'], ['dark', 'Dark'], ['auto', 'System']].map(([t, n]) => h('button', { 'data-t': t, class: CFG.lookMode === t ? 'on' : '', onclick: () => setTheme(t) }, n)))),
      F('Palette, accent, density…', h('button', { class: 'btn', onclick: () => { d.close(); lookOpen(); } }, '🎨 Customize appearance…')),
      F('UI scale', h('input', { type: 'range', min: .85, max: 1.3, step: .05, value: CFG.ui, oninput: e => { CFG.ui = +e.target.value; saveCfg(); applyAppearance(); } })),
      F('Device layout', sel('form', [['auto', 'Auto (fit this device)'], ['phone', 'Phone'], ['tablet', 'Tablet'], ['desktop', 'Desktop']], () => applyForm())),
      chk('On-screen tab keypad on phones and tablets', 'kpad', () => mSync()),
      chk('Reduce motion', 'reduce', applyAppearance),
      h('h5', {}, 'Workflow'),
      F('Start in', routeControl()),
      h('h5', {}, 'Music'),
      F('Reference pitch A4 (Hz)', num('a4', 415, 466, .1, () => bus.emit('song'))), F('Accidentals', sel('flats', [[false, 'Sharps (C#)'], [true, 'Flats (Db)']], () => { CFG.flats = String(CFG.flats) === 'true'; saveCfg(); bus.emit('song'); })),
      chk('Left-handed fretboard', 'left', () => bus.emit('fret')), F('Fretboard labels', sel('fretNames', [['notes', 'Note names'], ['degrees', 'Scale degrees'], ['frets', 'Fret numbers']], () => bus.emit('fret'))),
      h('h5', {}, 'Audio engine (restart to apply)'),
      F('Latency hint', sel('hint', [['interactive', 'interactive (lowest)'], ['balanced', 'balanced'], ['playback', 'playback'], ['0', '0 (request minimum)']])), F('Sample rate', sel('sr', [['auto', 'Device default'], ['44100', '44.1 kHz'], ['48000', '48 kHz'], ['96000', '96 kHz']])),
      F('Analyzer FFT size', sel('fft', [2048, 4096, 8192, 16384, 32768], () => { if (E.ready) { E.anaRig.fftSize = E.anaMaster.fftSize = CFG.fft; } })), F('Analyzer smoothing', h('input', { type: 'range', min: 0, max: .95, step: .01, value: CFG.smooth, oninput: e => { CFG.smooth = +e.target.value; saveCfg(); if (E.ready) E.anaRig.smoothingTimeConstant = E.anaMaster.smoothingTimeConstant = CFG.smooth; } })),
      h('div', { class: 'row', style: { gridColumn: '1/-1' } }, h('button', { class: 'btn', onclick: () => { d.close(); restartAudio(); } }, '↻ Restart audio engine'), h('span', { class: 'muted small' }, 'Required after changing latency hint, sample rate or output routing.')),
      h('h5', {}, 'Recording & practice'),
      F('Count-in (bars)', sel('countIn', [0, 1, 2, 4])), F('Metronome level', h('input', { type: 'range', min: 0, max: 1, step: .05, value: CFG.metroVol, oninput: e => { CFG.metroVol = +e.target.value; saveCfg(); } })),
      F('Humanize (timing/velocity)', h('input', { type: 'range', min: 0, max: 1, step: .05, value: CFG.humanize, oninput: e => { CFG.humanize = +e.target.value; saveCfg(); } })), F('Timing analysis grid', sel('timingGrid', [[4, '16th notes'], [2, '8th notes'], [1, 'Quarter notes']])),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!CFG.rec.dry, onchange: e => { CFG.rec.dry = e.target.checked; saveCfg(); } }), 'Record dry DI (enables re-amping)'),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!CFG.rec.wet, onchange: e => { CFG.rec.wet = e.target.checked; saveCfg(); } }), 'Record wet print'),
      h('h5', {}, 'Ultimate Guitar export'),
      F('Max line width (chars)', num('ugWidth', 40, 120, 1, () => bus.emit('export'))), chk('Include [tab] / [ch] tags', 'ugTags', () => bus.emit('export')),
      h('h5', {}, 'Data'),
      h('div', { class: 'row', style: { gridColumn: '1/-1', gap: '8px', flexWrap: 'wrap' } }, h('button', { class: 'btn', onclick: () => { d.close(); libraryOpen(); } }, '☰ My songs'), h('button', { class: 'btn bad', title: 'Choose what to erase: layout, settings, songs, offline copy…', onclick: () => { d.close(); resetOpen(); } }, 'Reset…'), h('button', { class: 'btn', onclick: () => download('daily-songs-settings.json', JSON.stringify(CFG, null, 2), 'application/json') }, 'Export settings JSON')),
      F('Backing track when a song opens', sel('trackRestore', [['auto', 'Restore it automatically'], ['tap', 'Wait until I tap Restore']])), h('div', { class: 'tiny muted', style: { gridColumn: '1/-1' } }, 'Songs and recordings are kept in this browser (My songs). Stems are separated again when a song with a track opens; the song itself opens instantly.')
    ));
  d.showModal();
}
function openHelp() {
  const d = $('#help'); d.innerHTML = '';
  const K = [['Space', 'Play / stop'], ['Ctrl + .', 'KILL AUDIO: stop playback, monitor off, release the microphone, suspend audio'], ['R', 'Arm / start recording (count-in, dry DI + wet print)'], ['L / M', 'Loop / metronome'], ['D · B · G · T', 'Band on/off: drums · bass · rhythm guitar · lead tab'], ['1…8 · 0', 'Recall pedalboard scene (Stage scene when Stage is focused) · 0 = all pedals off'], ['Home', 'Return to start'], ['Ctrl/⌘ Z · Shift+Z', 'Undo / redo song edits'], ['Ctrl/⌘ S', 'Save project JSON'], ['Alt + 1…9, 0', 'Switch panel by position (tab order is yours to arrange)'], ['[ ]', 'Toggle left / right sidebars'],
    ['Tab editor', 'Click a cell · type fret (0–24) · ←→↑↓ move · Del clear · h p / \\ b ~ x < set technique · Shift+arrows select · Space plays from bar'], ['Knobs', 'Drag · wheel · Shift = fine · double-click reset · right-click = MIDI learn'], ['Rig', 'Drag pedal headers to reorder the signal chain · A/B + Morph to compare tones']];
  d.append(h('div', { class: 'dlg-h' }, 'HELP & SHORTCUTS', h('button', { class: 'btn sm', onclick: () => d.close() }, 'Close')), h('div', { class: 'dlg-b', style: { display: 'block' } }, h('div', { class: 'help-k' }, K.map(([a, b]) => [h('kbd', {}, a), h('span', {}, b)])),
    h('div', { class: 'row', style: { gap: '8px', margin: '2px 0 8px' } }, h('button', { class: 'btn primary', onclick: () => tourStart() }, '▶ Take the guided tour'), h('span', { class: 'tiny muted' }, 'A two-minute spotlight walkthrough of the key areas.')), h('div', { class: 'hr' }), h('p', { class: 'small muted' }, 'Everything runs locally in your browser. Nothing is uploaded. Browsers cannot talk to ASIO drivers, so achievable latency depends on your OS audio stack; use the Loopback Test (I/O panel) for a measured number, and your Focusrite’s Direct Monitor for latency-free headphone monitoring while recording.'),
    h('p', { class: 'small muted' }, 'Your work is autosaved to this browser. Use ☰ Songs → Save as bundle, or Export → Project JSON, for a copy you can keep anywhere. Songs, recordings and backing tracks are kept in this browser (☰ Songs). Save a song as a bundle (.zip) to move it to another device or keep a copy.'), h('div', { class: 'hr' }), aboutBlock()));
  d.showModal();
}

/* ---------- status bar ---------- */
function buildStatus() { const s = $('#status'); UI.st = { a: h('span'), i: h('span'), r: h('span'), m: h('span'), f: h('span') }; s.append(UI.st.a, UI.st.i, UI.st.r, h('span', { class: 'sp' }), UI.st.m, UI.st.f); }
let fpsN = 0, fpsT = 0, FPS = 0;
function updateStatus() {
  if (!UI.st) return; const L = latencyInfo();
  if (L) {
    UI.st.a.textContent = 'AUDIO ' + L.state + ' · ' + (L.sr / 1000).toFixed(1) + ' kHz · out ' + (L.base + L.out).toFixed(1) + ' ms' + (E.worklet ? ' · worklet' : ' · fallback');
    UI.st.i.textContent = E.hasInput ? 'IN ' + ((E.devs.in.find(d => d.deviceId === CFG.inDev) || {}).label || 'device').slice(0, 34) + ' · ' + ((E.inSettings && E.inSettings.channelCount) || '?') + 'ch' : 'IN none';
    const ch = UI.lat.firstChild; ch.className = 'led ' + (E.ctx.state === 'running' ? (L.est < 25 ? 'on' : 'warn') : 'bad'); UI.lat.lastChild.textContent = (CFG.rtt != null ? 'RTT ' + CFG.rtt.toFixed(1) + ' ms (measured)' : '≈' + L.est.toFixed(0) + ' ms est.');
  } else { UI.st.a.textContent = 'AUDIO off — press Power on'; UI.st.i.textContent = ''; }
  UI.st.r.textContent = 'RIG ' + RIG.cur; UI.st.m.textContent = (MIDI.access ? 'MIDI ' + MIDI.access.inputs.size + ' in' : 'MIDI off') + (LEARN.key ? ' · LEARN ' + LEARN.key : ''); UI.st.f.textContent = FPS + ' fps';
}

/* ---------- global shortcuts ---------- */
document.addEventListener('keydown', e => {
  const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); exportProject(); return; }
  if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
  if (e.altKey && /^[0-9]$/.test(e.key)) { e.preventDefault(); const t2 = dockVisible()[e.key === '0' ? 9 : +e.key - 1]; if (t2) { FLOATS.has(t2[0]) ? floatFront(t2[0]) : dockGo(t2[0]); } return; }
  if (typing || mod) return;
  if (t && t.classList && t.classList.contains('tcell')) return;
  switch (e.key) {
    case ' ': e.preventDefault(); T.playing ? stopPlay(true) : play(); break;
    case 'r': case 'R': toggleRec(); break; case 'l': case 'L': T.loop = !T.loop; syncTransport(); break; case 'm': case 'M': T.metro = !T.metro; syncTransport(); break;
    case 'Home': UI.rew.click(); break; case '?': openHelp(); break;
    case '[': toggleSide('left'); break; case ']': toggleSide('right'); break;
    case 'd': case 'D': toggleBand('drumsOn'); break; case 'b': case 'B': toggleBand('bassOn'); break; case 'g': case 'G': toggleBand('compOn'); break; case 't': case 'T': toggleBand('leadOn'); break;
    case '0': if (typeof boardKey === 'function') boardKey('0'); break; case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': if (typeof digitKey === 'function') digitKey(+e.key); break;
    default: if (typeof boardKey === 'function') boardKey(e.key);
  }
});

/* >>> parts/05b-look.js */
/* ============================================================
   Part 05b · LOOK — appearance system
   Light / dark / follow-system, 15 palettes, accent colours (and any colour you pick), density, corner style, surfaces,
   typeface, contrast and colour-blind-safe data colours, plus one-click "looks". Everything is computed here and written to
   CSS variables on <html>, so every canvas, meter and panel follows. Fonts are bundled (Inter and Montserrat, SIL OFL) or the ones already on the device.
   ============================================================ */
const LOOK_DEF = { lookMode: 'auto', palLight: 'dsday', palDark: 'dsnight', accent: 'auto', accentC: '', density: 'comfortable', corners: 'soft', surface: 'soft', font: 'brand', contrast: 'standard', data: 'standard' };
const PALETTES = [
  { id: 'dsday', mode: 'light', name: 'Daily Light', a2: '#b07a1e', cv: ['#b8741a', '#4a67c2', '#9a7d10', '#b5486a'], c: { bg: '#e9e9e6', bg2: '#dededa', panel: '#f4f4f1', panel2: '#fbfbf9', raise: '#ffffff', line: '#d6d8d3', line2: '#b8beb7', text: '#0d0f10', muted: '#4f5c56', accent: '#2f7a58' } },
  { id: 'porcelain', mode: 'light', name: 'Porcelain', c: { bg: '#eceff2', bg2: '#e2e7eb', panel: '#f6f8fa', panel2: '#ffffff', raise: '#ffffff', line: '#d5dce1', line2: '#b6c2c9', text: '#0c181c', muted: '#566b73', accent: '#0a8c97' } },
  { id: 'paper', mode: 'light', name: 'Paper', c: { bg: '#f0ebe1', bg2: '#e7e0d1', panel: '#f9f5ec', panel2: '#fffdf8', raise: '#ffffff', line: '#ddd3c0', line2: '#c2b59d', text: '#2a2218', muted: '#6a5d44', accent: '#b4532a' } },
  { id: 'sage', mode: 'light', name: 'Sage', c: { bg: '#e8eee7', bg2: '#dde6dc', panel: '#f3f7f2', panel2: '#fdfefd', raise: '#ffffff', line: '#cdd8ca', line2: '#acbca8', text: '#13231a', muted: '#566a5a', accent: '#2e7d55' } },
  { id: 'lilac', mode: 'light', name: 'Lilac', c: { bg: '#edeaf4', bg2: '#e3dfee', panel: '#f7f5fc', panel2: '#fefeff', raise: '#ffffff', line: '#d8d2e6', line2: '#b9b0d2', text: '#1c1730', muted: '#625980', accent: '#6a4fd1' } },
  { id: 'harbor', mode: 'light', name: 'Harbor', c: { bg: '#e6eef6', bg2: '#dae5f0', panel: '#f3f7fb', panel2: '#ffffff', raise: '#ffffff', line: '#cbd9e6', line2: '#a8bdd1', text: '#0d1b2a', muted: '#52677c', accent: '#1f6fd1' } },
  { id: 'blush', mode: 'light', name: 'Blush', c: { bg: '#f5ebeb', bg2: '#ecdcdc', panel: '#fcf6f6', panel2: '#fffdfd', raise: '#ffffff', line: '#e5d2d2', line2: '#cdaeb0', text: '#2b1a1c', muted: '#7a5a5e', accent: '#c2415a' } },
  { id: 'daylight', mode: 'light', name: 'Daylight HC', c: { bg: '#ffffff', bg2: '#f0f0f0', panel: '#ffffff', panel2: '#ffffff', raise: '#ffffff', line: '#6a777c', line2: '#1f2a2e', text: '#000000', muted: '#2f3f45', accent: '#005f73' } },
  { id: 'dsnight', mode: 'dark', name: 'Daily Night', a2: '#d4a25a', cv: ['#d4a25a', '#8da9e8', '#e9d27a', '#d98aa2'], c: { bg: '#0d0f10', bg2: '#111413', panel: '#151a18', panel2: '#1b221f', raise: '#232c28', line: '#222b27', line2: '#33423b', text: '#e8e8e6', muted: '#8fa497', accent: '#7dbf9b' } },
  { id: 'ink', mode: 'dark', name: 'Ink', c: { bg: '#070c0f', bg2: '#0a1114', panel: '#0e161a', panel2: '#121d22', raise: '#182429', line: '#1c2a30', line2: '#2c4149', text: '#e5eff1', muted: '#87a0a6', accent: '#3de0cf' } },
  { id: 'midnight', mode: 'dark', name: 'Midnight', c: { bg: '#080b14', bg2: '#0b1020', panel: '#0f1526', panel2: '#141b30', raise: '#1a2340', line: '#212b47', line2: '#34416a', text: '#e6ebf8', muted: '#8e9bc0', accent: '#6ea8ff' } },
  { id: 'graphite', mode: 'dark', name: 'Graphite', c: { bg: '#0d0e10', bg2: '#121316', panel: '#17181c', panel2: '#1d1f24', raise: '#24272d', line: '#2a2d34', line2: '#3d424b', text: '#ececf0', muted: '#9a9fab', accent: '#5fd4b8' } },
  { id: 'plum', mode: 'dark', name: 'Plum', c: { bg: '#0e0a12', bg2: '#130e19', panel: '#17101d', panel2: '#1d1526', raise: '#261c33', line: '#2d2139', line2: '#46345a', text: '#efe6f6', muted: '#a592b8', accent: '#d79bff' } },
  { id: 'forest', mode: 'dark', name: 'Forest', c: { bg: '#0a100c', bg2: '#0d1610', panel: '#101a13', panel2: '#15221a', raise: '#1b2c21', line: '#1f3326', line2: '#335040', text: '#e4f0e8', muted: '#86a692', accent: '#7be08f' } },
  { id: 'ember', mode: 'dark', name: 'Ember', c: { bg: '#110c0a', bg2: '#16100d', panel: '#1b1310', panel2: '#221815', raise: '#2c201b', line: '#33241e', line2: '#54392e', text: '#f3e8e2', muted: '#b09484', accent: '#ff9a52' } },
  { id: 'oled', mode: 'dark', name: 'OLED black', c: { bg: '#000000', bg2: '#000000', panel: '#060606', panel2: '#0b0b0b', raise: '#141414', line: '#202020', line2: '#353535', text: '#f2f2f2', muted: '#9a9a9a', accent: '#3de0cf' } },
  { id: 'nightHC', mode: 'dark', name: 'Night HC', c: { bg: '#000000', bg2: '#000000', panel: '#000000', panel2: '#0a0a0a', raise: '#141414', line: '#7d8d93', line2: '#b4c2c7', text: '#ffffff', muted: '#d0dadd', accent: '#5ff0e0' } }
];
const ACCENTS = [
  { id: 'auto', name: 'Palette default' }, { id: 'lagoon', name: 'Lagoon', c: '#0a8c97' }, { id: 'cobalt', name: 'Cobalt', c: '#2f64e0' }, { id: 'sky', name: 'Sky', c: '#0b84d8' },
  { id: 'violet', name: 'Violet', c: '#6a45e0' }, { id: 'magenta', name: 'Magenta', c: '#c0359a' }, { id: 'rose', name: 'Rose', c: '#d6355a' }, { id: 'coral', name: 'Coral', c: '#e0562f' },
  { id: 'amber', name: 'Amber', c: '#d99100' }, { id: 'lime', name: 'Lime', c: '#6f9d12' }, { id: 'emerald', name: 'Emerald', c: '#1c9a63' }, { id: 'slate', name: 'Slate', c: '#5b6b79' }
];
const LK_FONTS = {
  brand: ['the-daily.studio (Inter + Montserrat)', null],
  system: ['System UI', 'system-ui,"Segoe UI Variable Text","Segoe UI",-apple-system,Roboto,"Helvetica Neue",Arial,sans-serif'],
  humanist: ['Humanist', 'Seravek,"Gill Sans Nova","Avenir Next",Candara,Optima,"Trebuchet MS",system-ui,sans-serif'],
  rounded: ['Rounded', 'ui-rounded,"SF Pro Rounded",Nunito,"Varela Round","Hiragino Maru Gothic ProN","Arial Rounded MT Bold",system-ui,sans-serif'],
  editorial: ['Editorial serif', 'Charter,"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif'],
  legible: ['High legibility', '"Atkinson Hyperlegible",Verdana,Tahoma,"Segoe UI",system-ui,sans-serif'],
  mono: ['Instrument (mono)', 'ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace']
};
const LOOKS = [
  { id: 'signature', name: 'the-daily.studio', note: 'Sage and gold on charcoal', set: { lookMode: 'auto', palLight: 'dsday', palDark: 'dsnight', accent: 'auto', density: 'comfortable', corners: 'soft', surface: 'soft', font: 'brand', contrast: 'standard', data: 'standard', ui: 1 } },
  { id: 'clinical', name: 'Clinical', note: 'Cool, flat, precise', set: { lookMode: 'light', palLight: 'porcelain', accent: 'auto', density: 'compact', corners: 'soft', surface: 'flat', font: 'brand', contrast: 'standard', data: 'standard', ui: 1 } },
  { id: 'studio', name: 'Studio night', note: 'Ink teal, softly lit', set: { lookMode: 'dark', palDark: 'ink', accent: 'auto', density: 'comfortable', corners: 'soft', surface: 'soft', font: 'brand', contrast: 'standard', data: 'standard', ui: 1 } },
  { id: 'notebook', name: 'Notebook', note: 'Warm paper, serif', set: { lookMode: 'light', palLight: 'paper', accent: 'auto', density: 'comfortable', corners: 'round', surface: 'flat', font: 'editorial', contrast: 'standard', data: 'standard', ui: 1.05 } },
  { id: 'calm', name: 'Calm', note: 'Sage, rounded, airy', set: { lookMode: 'light', palLight: 'sage', accent: 'auto', density: 'spacious', corners: 'round', surface: 'soft', font: 'rounded', contrast: 'standard', data: 'standard', ui: 1.05 } },
  { id: 'midnightlook', name: 'Midnight', note: 'Deep blue, crisp', set: { lookMode: 'dark', palDark: 'midnight', accent: 'auto', density: 'comfortable', corners: 'soft', surface: 'soft', font: 'brand', contrast: 'standard', data: 'standard', ui: 1 } },
  { id: 'stage', name: 'Stage', note: 'OLED, large, high contrast', set: { lookMode: 'dark', palDark: 'oled', accent: 'amber', density: 'spacious', corners: 'sharp', surface: 'flat', font: 'legible', contrast: 'high', data: 'standard', ui: 1.2 } },
  { id: 'access', name: 'Accessible', note: 'High contrast, colour-blind safe', set: { lookMode: 'light', palLight: 'daylight', accent: 'cobalt', density: 'spacious', corners: 'soft', surface: 'flat', font: 'legible', contrast: 'high', data: 'cvd', ui: 1.15 } }
];

/* colour helpers */
const lkRgb = x => { const m = /^#?([0-9a-f]{6})$/i.exec(x || ''); const n = m ? parseInt(m[1], 16) : 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const lkHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const lkMix = (a, b, t) => { const x = lkRgb(a), y = lkRgb(b); return lkHex(x.map((v, i) => v + (y[i] - v) * t)); };
const lkLum = x => { const [r, g, b] = lkRgb(x).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
const lkContrast = (a, b) => { const x = lkLum(a), y = lkLum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
function lkFit(col, bg, dark, softT) {   // make the accent readable as TEXT (4.5:1) on both the surface and its own tint
  let c = col, i = 0; const ok = x => lkContrast(x, bg) >= 4.5 && lkContrast(x, lkMix(bg, x, softT || .15)) >= 4.5;
  while (!ok(c) && i++ < 60) c = lkMix(c, dark ? '#ffffff' : '#000000', .05); return c;
}
const lkInk = acc => lkContrast(acc, '#ffffff') >= lkContrast(acc, '#06100f') ? '#ffffff' : '#06100f';

function lookInit() {
  const raw = store.get('cfg', {});
  if (CFG.lookMode === undefined) CFG.lookMode = raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : LOOK_DEF.lookMode;
  Object.keys(LOOK_DEF).forEach(k => { if (CFG[k] === undefined) CFG[k] = LOOK_DEF[k]; });
  if (CFG.accent === 'lagoon') CFG.accent = 'auto';
}
const lkSys = () => { try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; } };
function applyAppearance() {
  lookInit();
  const r = document.documentElement, st = r.style, mode = CFG.lookMode === 'auto' ? (lkSys() ? 'dark' : 'light') : CFG.lookMode, dark = mode === 'dark';
  CFG.theme = mode;
  const pal = PALETTES.find(p => p.id === (dark ? CFG.palDark : CFG.palLight)) || PALETTES.find(p => p.mode === mode), P = Object.assign({}, pal.c);
  if (CFG.contrast === 'high') { P.text = lkMix(P.text, dark ? '#ffffff' : '#000000', .6); P.muted = lkMix(P.muted, P.text, .5); P.line = lkMix(P.line, P.text, .4); P.line2 = lkMix(P.line2, P.text, .6); }
  P.accent = lkFit(P.accent, P.panel2, dark, dark ? .18 : .15);
  const ac = ACCENTS.find(a => a.id === CFG.accent);
  if (CFG.accent === 'custom' && /^#[0-9a-f]{6}$/i.test(CFG.accentC || '')) P.accent = lkFit(CFG.accentC, P.panel2, dark, dark ? .18 : .15);
  else if (ac && ac.c) P.accent = lkFit(ac.c, P.panel2, dark, dark ? .18 : .15);
  const v = (n, val) => { if (val == null) st.removeProperty(n); else st.setProperty(n, val); };
  ['bg', 'bg2', 'panel', 'panel2', 'raise', 'line', 'line2', 'text', 'muted', 'accent'].forEach(k => v('--' + k, P[k]));
  v('--accent-ink', lkInk(P.accent)); v('--accent-soft', lkMix(P.panel2, P.accent, dark ? .18 : .15)); v('--wave', P.accent);
  v('--grid', lkMix(P.bg, P.line, .75)); v('--meter-bg', lkMix(P.panel2, P.line, dark ? .85 : .7));
  v('--shadow', CFG.surface === 'flat' ? '0 0 0 1px rgba(0,0,0,0)' : dark ? (CFG.surface === 'raised' ? '0 0 0 1px rgba(255,255,255,.05),0 2px 4px rgba(0,0,0,.6),0 16px 36px rgba(0,0,0,.5)' : null) : (CFG.surface === 'raised' ? '0 0 0 1px rgba(12,24,28,.05),0 2px 4px rgba(12,24,28,.12),0 14px 32px rgba(12,24,28,.12)' : null));
  if (CFG.data === 'cvd') {   // Okabe–Ito: distinguishable with every common kind of colour-blindness
    const cv = dark ? ['#56B4E9', '#F0E442', '#CC79A7', '#2FD0A0', '#E69F00'] : ['#0072B2', '#E69F00', '#CC79A7', '#009E73', '#D55E00'];
    cv.forEach((c, i) => v('--cv' + (i + 1), c)); v('--accent2', dark ? '#E69F00' : '#D55E00'); v('--ok', dark ? '#56B4E9' : '#0072B2'); v('--warn', dark ? '#F0E442' : '#B8860B');
  } else ['--cv1', '--cv2', '--cv3', '--cv4', '--cv5', '--accent2', '--ok', '--warn'].forEach(n => v(n, null));
  if (CFG.data !== 'cvd') { v('--cv1', P.accent); if (pal.a2) v('--accent2', pal.a2); if (pal.cv) pal.cv.forEach((c, i) => v('--cv' + (i + 2), c)); }
  const f = LK_FONTS[CFG.font]; v('--sans', f && f[1]); v('--display', CFG.font === 'brand' ? null : f && f[1]);
  st.setProperty('--ui', CFG.ui); st.colorScheme = mode;
  r.dataset.theme = mode; r.dataset.palette = pal.id; r.dataset.density = CFG.density; r.dataset.corners = CFG.corners; r.dataset.surface = CFG.surface; r.dataset.font = CFG.font; r.dataset.contrast = CFG.contrast; delete r.dataset.accent;
  document.body.classList.toggle('reduce', !!CFG.reduce);
  const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.setAttribute('content', P.panel2);
  bus.emit('theme');
}
function setTheme(t) { CFG.lookMode = t; saveCfg(); applyAppearance(); $$('.seg [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t)); bus.emit('look'); }
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (CFG.lookMode === 'auto') applyAppearance(); }); } catch (e) { }

/* ---------- the Appearance panel (a side drawer, so you watch the app change as you choose) ---------- */
function lookApply(set) { Object.assign(CFG, set); saveCfg(); applyAppearance(); bus.emit('look'); }
function lookReset() { const keep = { ui: 1 }; lookApply(Object.assign({}, LOOK_DEF, keep, { accentC: '', reduce: false })); }
function lookOpen() {
  lookInit();
  const body = h('div', { class: 'lk' });
  const sw = (p, on) => h('button', { class: 'lk-pal' + (on ? ' on' : ''), title: p.name, onclick: () => { lookApply(p.mode === 'dark' ? { palDark: p.id, lookMode: 'dark' } : { palLight: p.id, lookMode: 'light' }); draw(); } },
    h('span', { class: 'lk-prev', style: { background: p.c.bg } }, h('i', { style: { background: p.c.panel2, borderColor: p.c.line } }, h('b', { style: { background: p.c.accent } }), h('u', { style: { background: p.c.line2 } }), h('u', { style: { background: p.c.line2, width: '60%' } }))), h('span', { class: 'lk-n' }, p.name));
  const seg = (key, opts, extra) => h('div', { class: 'seg lk-seg' }, opts.map(([k, t]) => h('button', { class: CFG[key] === k ? 'on' : '', onclick: () => { lookApply(Object.assign({ [key]: k }, extra || {})); draw(); } }, t)));
  const row = (label, el, hint) => h('div', { class: 'lk-row' }, h('div', { class: 'lk-l' }, h('b', {}, label), hint ? h('span', {}, hint) : null), el);
  function draw() {
    const sc = body.parentElement ? body.parentElement.scrollTop : 0; body.innerHTML = '';
    const effLight = CFG.theme === 'light';
    body.append(
      h('div', { class: 'lk-sec' }, 'LOOKS'), h('div', { class: 'lk-looks' }, LOOKS.map(l => {
        const pl = PALETTES.find(p => p.id === (l.set.lookMode === 'dark' ? l.set.palDark : l.set.palLight)); const ac = ACCENTS.find(a => a.id === l.set.accent);
        return h('button', { class: 'lk-look', onclick: () => { lookApply(Object.assign({ accentC: '' }, l.set)); draw(); } }, h('span', { class: 'lk-prev sm', style: { background: pl.c.bg } }, h('i', { style: { background: pl.c.panel2, borderColor: pl.c.line } }, h('b', { style: { background: (ac && ac.c) || pl.c.accent } }), h('u', { style: { background: pl.c.line2 } }))), h('span', { class: 'lk-n' }, l.name), h('span', { class: 'lk-s' }, l.note));
      })),
      h('div', { class: 'lk-sec' }, 'MODE'), h('div', { class: 'lk-note' }, 'Match system uses your chosen light palette by day and dark palette by night.'), seg('lookMode', [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Match system']]),
      h('div', { class: 'lk-sec' }, 'LIGHT PALETTES' + (effLight ? ' · in use' : '')), h('div', { class: 'lk-pals' }, PALETTES.filter(p => p.mode === 'light').map(p => sw(p, CFG.palLight === p.id))),
      h('div', { class: 'lk-sec' }, 'DARK PALETTES' + (!effLight ? ' · in use' : '')), h('div', { class: 'lk-pals' }, PALETTES.filter(p => p.mode === 'dark').map(p => sw(p, CFG.palDark === p.id))),
      h('div', { class: 'lk-sec' }, 'ACCENT'),
      h('div', { class: 'lk-acc' }, ACCENTS.map(a => h('button', { class: 'lk-dot' + (CFG.accent === a.id ? ' on' : ''), title: a.name, style: a.c ? { background: a.c } : {}, onclick: () => { lookApply({ accent: a.id }); draw(); } }, a.c ? '' : 'A')),
        h('label', { class: 'lk-dot custom' + (CFG.accent === 'custom' ? ' on' : ''), title: 'Pick any colour' }, h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(CFG.accentC) ? CFG.accentC : '#0a8c97', oninput: e => { CFG.accent = 'custom'; CFG.accentC = e.target.value; saveCfg(); applyAppearance(); }, onchange: () => draw() }), '+')),
      h('div', { class: 'lk-note' }, 'Any colour works: it is automatically adjusted so text and controls stay readable on the palette you chose.'),
      h('div', { class: 'lk-sec' }, 'FEEL'),
      row('Density', seg('density', [['compact', 'Compact'], ['comfortable', 'Cosy'], ['spacious', 'Roomy']])),
      row('Corners', seg('corners', [['sharp', 'Sharp'], ['soft', 'Soft'], ['round', 'Round']])),
      row('Surfaces', seg('surface', [['flat', 'Flat'], ['soft', 'Soft'], ['raised', 'Raised']]), 'Shadows and depth'),
      row('Text size', h('input', { type: 'range', min: .85, max: 1.4, step: .05, value: CFG.ui, oninput: e => { CFG.ui = +e.target.value; saveCfg(); applyAppearance(); } })),
      h('div', { class: 'lk-sec' }, 'TYPE & ACCESSIBILITY'),
      row('Typeface', h('select', { class: 'in', onchange: e => { lookApply({ font: e.target.value }); } }, Object.entries(LK_FONTS).map(([k, [t]]) => h('option', { value: k, selected: CFG.font === k }, t))), 'Uses fonts already on your device'),
      row('Contrast', seg('contrast', [['standard', 'Standard'], ['high', 'High']])),
      row('Data colours', seg('data', [['standard', 'Standard'], ['cvd', 'Colour-blind safe']]), 'Charts, meters, visuals, status lights'),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!CFG.reduce, onchange: e => { CFG.reduce = e.target.checked; saveCfg(); applyAppearance(); } }), 'Reduce motion'),
      h('div', { class: 'lk-foot' }, h('button', { class: 'btn', onclick: () => { lookReset(); draw(); } }, 'Reset appearance'), h('span', { class: 'tiny muted' }, 'Saved on this device.')));
    if (body.parentElement) body.parentElement.scrollTop = sc;
  }
  const d = pdlg('look', 'APPEARANCE', body, { cls: 'lookdlg' }); draw(); return d;
}

/* >>> parts/06-ui-panels.js */
/* ============================================================
   Part 06 · dock framework, left sidebar (Tones / I-O / Theory), Rig pane, right sidebar (tuner, meters, live analysis)
   ============================================================ */
const DOCK = [['rig', 'Rig'], ['tab', 'Tab'], ['song', 'Song'], ['band', 'Band'], ['fret', 'Fretboard'], ['vis', 'Visuals'], ['stage', 'Stage'], ['neural', 'Neural'], ['stems', 'Stems'], ['tx', 'Transcribe'], ['cam', 'Vision'], ['lab', 'Research'], ['exp', 'Export']];
const paneVisible = id => DOCK.cur === id || (typeof FLOATS !== 'undefined' && FLOATS.has(id)) || (typeof sideVisible === 'function' && sideVisible(id));
const dockVisible = () => DOCK.filter(d => !(typeof LAY !== 'undefined' && LAY.hidden.includes(d[0])) && !(typeof sideHosted === 'function' && sideHosted(d[0])) && (typeof xpAllowed !== 'function' || xpAllowed(d[0])));
const PANES = {}, SEL = { sec: 0, bar: 0 };
function buildDock() {
  const dock = $('#dock'), tabs = h('div', { class: 'tabs' });
  DOCK.forEach(([id, name], i) => { tabs.append(h('button', { class: 'tab', 'data-id': id, onclick: () => dockGo(id) }, (i + 1) + ' · ' + name)); PANES[id] = h('div', { class: 'pane', id: 'pane-' + id }); });
  dock.append(tabs, ...Object.values(PANES));
}
function dockGo(id) { if (typeof sideHosted === 'function' && sideHosted(id)) { sideShow(id); return; } DOCK.cur = id; $$('#dock .tab').forEach(t => t.classList.toggle('on', t.dataset.id === id)); { const a = $('#dock .tab.on'); if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } Object.entries(PANES).forEach(([k, p]) => { if (typeof sideHosted === 'function' && sideHosted(k)) return; p.classList.toggle('on', k === id); }); bus.emit('dock', id); }
const allPresets = () => PRESETS.concat(store.get('presets', []).map(p => ({ ...p, c: 'User' })));
function usePreset(p) { if (!E.ready) { UI.pending = p; RIG.cur = p.n; toast('Preset “' + p.n + '” will load when audio starts'); return; } loadPreset(p); }
bus.on('audio:ready', () => { const p = UI.pending || PRESETS[0]; UI.pending = null; setTimeout(() => { loadPreset(p); syncPedals(); }, 30); });

/* ---------- left sidebar ---------- */
function buildLeft() {
  const L = $('#left'), names = [['tones', 'Tones'], ['io', 'I/O'], ['theory', 'Theory']], tabs = h('div', { class: 'side-tabs' }), panes = {};
  const first = 'io';   // input settings first: that is where sound and camera get switched on (the sidebar framework keeps your last choice)
  names.forEach(([id, n]) => { tabs.append(h('button', { class: 'tab' + (id === first ? ' on' : ''), 'data-id': id, onclick: () => { $$('.tab', tabs).forEach(t => t.classList.toggle('on', t.dataset.id === id)); Object.entries(panes).forEach(([k, p]) => p.classList.toggle('on', k === id)); } }, n)); panes[id] = h('div', { class: 'pane' + (id === first ? ' on' : '') }); });
  L.append(tabs, ...Object.values(panes));
  buildTones(panes.tones); buildIO(panes.io); buildTheory(panes.theory);
}
function buildTones(p) {
  UI.tcat = 'All'; UI.tq = h('input', { class: 'in', placeholder: 'Search tones…', oninput: renderTones, style: { fontFamily: 'var(--sans)' } });
  const cats = ['All', 'Clean', 'Acoustic', 'Crunch', 'Lead', 'Heavy', 'Funk', 'Psych', 'Ambient', 'Lo-Fi', 'User'], cw = h('div', { class: 'cats' });
  cats.forEach(c => cw.append(h('button', { class: 'cat' + (c === 'All' ? ' on' : ''), onclick: e => { UI.tcat = c; $$('.cat', cw).forEach(x => x.classList.remove('on')); e.target.classList.add('on'); renderTones(); } }, c)));
  UI.tlist = h('div', { class: 'plist' }); p.append(UI.tq, cw, UI.tlist); renderTones(); bus.on('preset', renderTones);
}
function renderTones() {
  const q = UI.tq.value.toLowerCase(), l = UI.tlist; l.innerHTML = '';
  allPresets().forEach((p, i) => {
    if (UI.tcat !== 'All' && p.c !== UI.tcat) return; if (q && !(p.n + ' ' + (p.d || '') + ' ' + p.c).toLowerCase().includes(q)) return;
    const it = h('button', { class: 'pitem' + (RIG.cur === p.n ? ' on' : ''), onclick: () => usePreset(p) }, h('b', {}, p.n, p.c === 'User' ? h('span', { style: { float: 'right', cursor: 'pointer', color: 'var(--bad)' }, title: 'Delete preset', onclick: e => { e.stopPropagation(); const a = store.get('presets', []).filter(x => x.n !== p.n); store.set('presets', a); renderTones(); } }, '✕') : null), h('span', {}, p.c + ' · ' + (p.d || '')));
    l.append(it);
  });
  if (!l.children.length) l.append(h('div', { class: 'muted small', style: { padding: '8px' } }, 'No tones match.'));
}
function buildIO(p) {
  UI.inSel = h('select', { class: 'in', 'aria-label': 'Audio input device', onchange: async e => { await startAudio(); const ok = await openInput(e.target.value); if (ok) await listDevices(); renderDevices(); } }); UI.outSel = h('select', { class: 'in', 'aria-label': 'Audio output device', onchange: e => setOutputDevice(e.target.value) });
  const chSeg = h('div', { class: 'seg' }, [['L', 'In 1 / L'], ['R', 'In 2 / R'], ['sum', 'Both']].map(([v, t]) => h('button', { 'data-v': v, class: CFG.ch === v ? 'on' : '', onclick: e => { setChannelMode(v); $$('button', chSeg).forEach(b => b.classList.toggle('on', b === e.target)); } }, t)));
  const trim = mkKnob({ key: 'trim', label: 'Input Trim', min: -24, max: 36, def: 0, step: .5, unit: ' dB', onChange: v => { if (E.ready) tc(E.inTrim.gain, fromDB(v), .02); } });
  const mon = h('button', { class: 'tog' + (CFG.monitor ? ' on' : ''), onclick: e => { setMonitor(!CFG.monitor); e.target.classList.toggle('on', CFG.monitor); } }, 'Monitor'); bus.on('monitor', on => mon.classList.toggle('on', on));
  UI.lat2 = h('div', { class: 'kv' }); UI.latRes = h('div', { class: 'small muted' }, 'Not measured yet.');
  const offs = h('input', { class: 'in', type: 'number', step: .1, style: { width: '80px' }, value: CFG.rtt != null ? CFG.rtt : '', placeholder: 'auto', onchange: e => { CFG.rtt = e.target.value === '' ? null : +e.target.value; saveCfg(); } });
  bus.on('latency', r => { UI.latRes.textContent = 'Measured ' + r.m.toFixed(2) + ' ms · σ ' + r.s.toFixed(2) + ' ms · n=' + r.n; offs.value = CFG.rtt; });
  UI.midiList = h('div', { class: 'small muted' }, 'MIDI not enabled.'); bus.on('midi', renderMidi);
  p.append(
    h('div', { class: 'card' }, h('h4', {}, 'Audio input ', h('button', { class: 'btn sm', title: 'Re-scan devices (asks for microphone permission if needed so device names appear)', onclick: refreshInputs }, '↻')), h('div', { class: 'card-b' }, UI.inSel, UI.inStat = h('div', { class: 'tiny', style: { marginTop: '4px', lineHeight: 1.4 } }), UI.diag = h('pre', { class: 'tiny', style: { whiteSpace: 'pre-wrap', margin: '6px 0 0', padding: '6px', border: '1px dashed var(--line2)', borderRadius: '6px', display: 'none', font: '600 10px/1.45 var(--mono)' } }), h('button', { class: 'btn sm', style: { marginTop: '6px' }, onclick: () => diagnoseInputs(true) }, '🩺 Diagnose devices'), h('div', { style: { height: '8px' } }), h('div', { class: 'row' }, h('button', { class: 'btn sm', title: 'Strum the guitar: finds which interface input it is on', onclick: autoDetectChannel }, '⚡ Auto-detect guitar channel'), mon), h('div', { class: 'row', style: { marginTop: '8px', justifyContent: 'center' } }, trim.el))),
    h('div', { class: 'card' }, h('h4', {}, 'Audio output'), h('div', { class: 'card-b' }, UI.outSel, h('div', { class: 'muted tiny', style: { marginTop: '6px' } }, 'Output device selection needs a recent Chromium browser (AudioContext.setSinkId).'))),
    h('div', { class: 'card' }, h('h4', {}, 'Latency lab'), h('div', { class: 'card-b' }, UI.lat2, h('div', { class: 'hr' }), h('button', { class: 'btn sm primary', onclick: measureRTT }, '⏱ Run loopback test'), h('div', { style: { height: '6px' } }), UI.latRes, h('div', { class: 'row', style: { marginTop: '6px' } }, h('span', { class: 'small' }, 'RTT used for alignment (ms):'), offs), h('p', { class: 'tiny muted' }, 'Patch a cable from the interface’s Line Out into an input (or hold a mic near a speaker). The test emits six 8 ms chirps and cross-correlates them to find the true round trip. That value shifts recorded takes so they land on the grid, and corrects timing statistics.'))),
    h('div', { class: 'card' }, h('h4', {}, 'MIDI controllers'), h('div', { class: 'card-b' }, UI.midiList, h('div', { class: 'row', style: { marginTop: '6px' } }, h('button', { class: 'btn sm', onclick: initMIDI }, 'Enable MIDI')), h('p', { class: 'tiny muted' }, 'Right-click any knob, then move a CC to bind it (wah pedal, whammy, faders…). Program Change selects tones.'))),
    h('div', { class: 'card' }, h('h4', {}, 'Focusrite / low-latency notes'), h('div', { class: 'card-b tiny muted' }, h('p', { style: { margin: '0 0 6px' } }, 'Browsers can’t use ASIO. Chrome/Edge on Windows use WASAPI, macOS uses CoreAudio. Set the smallest stable buffer in Focusrite Control (Windows) / the interface’s driver panel.'), h('p', { style: { margin: '0 0 6px' } }, 'Plug the guitar into the front Inst jack (Input 1 or 2). Run the Auto-detect. Keep the trim so peaks sit around −12 to −6 dBFS.'), h('p', { style: { margin: 0 } }, 'For zero-latency monitoring, turn on the interface’s Direct Monitor and switch off Monitor here — recording and analysis still work.'))));
  const camCard = h('div', { class: 'card' }, h('h4', {}, 'Camera'), h('div', { class: 'card-b' },
    UI.camSel2 = h('select', { class: 'in', 'aria-label': 'Camera', style: { fontFamily: 'var(--sans)' }, onchange: e => { CFG.camDev = e.target.value; saveCfg(); if (CAM.on) startCam(); } }),
    h('div', { class: 'row', style: { marginTop: '6px' } }, h('button', { class: 'btn sm' + (VZ.cam ? ' on' : ''), id: 'ioCamBtn', onclick: () => vzCamPress() }, '📷 Camera backdrop')),
    h('div', { class: 'tiny muted', style: { marginTop: '4px' } }, 'Puts you in front of the hexagons. The picture stays on this device.'),
    h('div', { class: 'row', style: { marginTop: '8px', gap: '8px', flexWrap: 'wrap' } }, h('span', { class: 'tiny muted' }, 'Start in'), routeControl())));
  p.insertBefore(camCard, p.children[1] || null); refreshCamList();
  bus.on('devices', renderDevices); bus.on('input', renderDevices); buildVoxCard(p);
}
function renderDevices() {
  refreshCamList();
  const fill = (sel, list, cur, none) => { sel.innerHTML = ''; if (!list.length) sel.append(h('option', { value: '' }, none)); list.forEach((d, i) => sel.append(h('option', { value: d.deviceId, selected: d.deviceId === cur }, d.label || ('Input ' + (i + 1) + (E.hasInput ? '' : ' (name hidden until mic allowed)'))))); };
  const cur = (E.inSettings && E.inSettings.deviceId) || CFG.inDev, seen = new Set(), ins0 = E.devs.in.slice(); if (E.hasInput && E.stream && cur && !ins0.some(d => d.deviceId === cur)) ins0.unshift({ deviceId: cur, label: (E.stream.getAudioTracks()[0] || {}).label || 'Active input', groupId: '' });
  const ins = ins0.filter(d => { if (d.deviceId === 'communications') return false; const k = (d.groupId || '') + '|' + (d.label || d.deviceId).replace(/^(Default|Communications) - /, ''); if (d.deviceId === 'default') return true; if (seen.has(k) && d.deviceId !== cur) return false; seen.add(k); return true; });
  fill(UI.inSel, ins, cur, 'No input devices (press ↻ and allow the microphone)');
  if (UI.inStat) { const dv = E.devs.in.find(d => d.deviceId === cur), blank = E.devs.in.length && E.devs.in.every(d => !d.label); UI.inStat.style.color = E.hasInput ? 'var(--ok)' : 'var(--muted)'; UI.inStat.textContent = E.hasInput ? '● Open: ' + ((dv && dv.label) || (E.stream && E.stream.getAudioTracks()[0] && E.stream.getAudioTracks()[0].label) || 'device') + ' · ' + ((E.inSettings && E.inSettings.channelCount) || '?') + ' ch · ' + (E.ctx ? E.ctx.sampleRate / 1000 : '?') + ' kHz' : (E.lastInErr || (blank ? 'Names are hidden until the microphone is allowed — press ↻.' : '○ No input open — choose one above.')); } fill(UI.outSel, E.devs.out, CFG.outDev, 'Default output');
  const L = latencyInfo(), s = E.inSettings;
  UI.lat2.innerHTML = ''; const kv = (a, b) => UI.lat2.append(h('span', {}, a), h('span', {}, b));
  if (L) { kv('Sample rate', (L.sr / 1000).toFixed(1) + ' kHz'); kv('Render block', L.block.toFixed(2) + ' ms'); kv('Base latency', L.base.toFixed(1) + ' ms'); kv('Output latency', L.out ? L.out.toFixed(1) + ' ms' : 'n/a'); kv('Input latency', L.inp != null ? L.inp.toFixed(1) + ' ms' : 'n/a'); kv('Estimated RTT', L.est.toFixed(1) + ' ms'); kv('Channels', s ? s.channelCount || '?' : '—'); kv('AEC/NS/AGC', s ? [s.echoCancellation, s.noiseSuppression, s.autoGainControl].map(x => x ? 'on' : 'off').join(' / ') : '—'); }
}
function renderMidi() {
  const l = UI.midiList; l.innerHTML = ''; if (!MIDI.access) return; const ins = [...MIDI.access.inputs.values()]; l.append(ins.length ? ins.map(i => h('div', {}, '● ' + i.name)) : 'No MIDI inputs found.');
  const m = Object.entries(CFG.midimap); if (m.length) l.append(h('div', { class: 'tiny', style: { marginTop: '6px' } }, m.map(([cc, k]) => h('div', {}, 'CC' + cc + ' → ' + k + ' ', h('a', { href: '#', onclick: e => { e.preventDefault(); delete CFG.midimap[cc]; saveCfg(); renderMidi(); } }, '✕')))));
}
async function diagnoseInputs(show) {
  const L = [], ok = (n, v, bad) => L.push((bad ? '✕ ' : '✓ ') + n + ': ' + v);
  const md = navigator.mediaDevices, framed = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  ok('Secure context (https/localhost)', window.isSecureContext ? 'yes' : 'NO', !window.isSecureContext); ok('Embedded in a frame', framed ? 'YES — browsers often block mic/camera here' : 'no', framed);
  try { const pp = document.permissionsPolicy || document.featurePolicy; if (pp && pp.allowsFeature) ok('Page allowed to use microphone', pp.allowsFeature('microphone') ? 'yes' : 'NO — the host frame blocks it', !pp.allowsFeature('microphone')); } catch (e) { }
  try { const q = await navigator.permissions.query({ name: 'microphone' }); ok('Microphone permission', q.state, q.state === 'denied'); } catch (e) { L.push('· microphone permission state not readable here'); }
  let probe = null;
  if (md && md.getUserMedia && !E.hasInput) { try { probe = await md.getUserMedia({ audio: true }); ok('Asking the browser for the microphone now', 'ALLOWED (' + ((probe.getAudioTracks()[0] || {}).label || 'device') + ')'); } catch (e) { ok('Asking the browser for the microphone now', e.name + (e.message ? ' — ' + e.message : ''), true); L.push(e.name === 'NotAllowedError' ? '→ Blocked or dismissed. Click the lock/tune icon left of the address bar → Microphone → Allow, then reload. Also check Windows Settings → Privacy & security → Microphone (apps + desktop apps allowed).' : e.name === 'NotFoundError' ? '→ The browser sees NO capture device. Check Windows Settings → System → Sound → Input (is the Focusrite listed and enabled?) and that no other app holds it exclusively.' : '→ ' + e.name); } }
  if (!md || !md.enumerateDevices) ok('mediaDevices API', 'MISSING', true);
  else { try { const d = await md.enumerateDevices(), a = d.filter(x => x.kind === 'audioinput'), o = d.filter(x => x.kind === 'audiooutput'); ok('Audio inputs / outputs listed', a.length + ' / ' + o.length, !a.length); if (a.length && a.every(x => !x.label)) L.push('✕ Device names hidden → microphone permission has not been granted to this page'); a.slice(0, 8).forEach(x => L.push('   · ' + (x.label || '(unnamed)'))); } catch (e) { ok('enumerateDevices', e.name + ' ' + e.message, true); } }
  if (probe) probe.getTracks().forEach(t => t.stop());
  if (E.lastInErr) L.push('✕ Last input error: ' + E.lastInErr);
  L.push('· ' + navigator.userAgent.replace(/\(.*?\)/, '').slice(0, 90));
  if (show !== false && UI.diag) { UI.diag.style.display = 'block'; UI.diag.textContent = L.join('\n'); }
  if (framed) toast('This page is running inside a frame, which usually blocks audio devices. Open it in its own browser tab (CodePen: Change View → Full Page / Debug).', 'warn');
  return L;
}
async function refreshInputs() {
  try { if (!E.hasInput) { const t = await navigator.mediaDevices.getUserMedia({ audio: true }); t.getTracks().forEach(x => x.stop()); } } catch (e) { toast('Microphone permission is blocked for this page — allow it in the address-bar site settings (CodePen: use Full Page view).', 'bad'); }
  await listDevices(); renderDevices(); if (!E.devs.in.length || E.devs.in.every(d => !d.label)) diagnoseInputs(true); const fr = E.devs.in.find(d => /focusrite|scarlett|clarett|vocaster/i.test(d.label || ''));
  if (!E.hasInput) { await startAudio(); await openInput(fr ? fr.deviceId : CFG.inDev || ''); await listDevices(); } renderDevices(); toast(E.devs.in.length + ' input device(s) found', 'ok');
}
async function restartAudio() {
  if (!E.ctx) return; toast('Restarting audio engine…'); stopPlay(true); const dev = CFG.inDev; UI.pending = { n: RIG.cur, u: rigSnapshot().u };
  try { if (E.stream) E.stream.getTracks().forEach(t => t.stop()); await E.ctx.close(); } catch (e) { }
  Object.assign(E, { ctx: null, ready: false, hasInput: false, src: null, split: null, tr: {}, pl: null }); RIG.units = {}; KNOBS.forEach((k, key) => { });
  await startAudio(); if (dev) await openInput(dev); if (CFG.outDev) setOutputDevice(CFG.outDev); toast('Audio engine restarted', 'ok');
}
function buildTheory(p) {
  const kSel = h('select', { class: 'in', onchange: e => { S.key = +e.target.value; commit(); } }, NS.map((n, i) => h('option', { value: i }, n)));
  const sSel = h('select', { class: 'in', onchange: e => { S.scale = e.target.value; commit(); } }, Object.keys(SCALES).map(n => h('option', { value: n }, n)));
  const tSel = h('select', { class: 'in', onchange: e => { const v = e.target.value; if (v === '__custom') { bus.emit('open-tuning-editor'); tSel.value = S.tuningName; return; } setTuning(TUNINGS[v], v); } });
  const tSelFill = () => { tSel.innerHTML = ''; const ns = Object.keys(TUNINGS); if (!TUNINGS[S.tuningName]) ns.unshift(S.tuningName); ns.forEach(n => tSel.append(h('option', { value: n }, n))); tSel.append(h('option', { value: '__custom' }, 'Custom tuning… (set each string)')); tSel.value = S.tuningName; }; tSelFill();
  const cap = h('input', { class: 'in', type: 'number', min: 0, max: 12, value: S.capo, style: { width: '60px' }, onchange: e => { S.capo = clamp(+e.target.value | 0, 0, 12); commit(); } });
  const info = h('div', { class: 'small', style: { marginTop: '6px' } }), pal = h('div', { class: 'pal' });
  const pr = h('select', { class: 'in' }, PROGS.map(([n], i) => h('option', { value: i }, n)));
  const cf = h('input', { class: 'in', placeholder: 'Chord finder: e.g. Cmaj7, F#m7b5, D/F#', style: { fontFamily: 'var(--sans)' } }), cres = h('div', { class: 'vcs', style: { marginTop: '8px' } });
  cf.oninput = () => { cres.innerHTML = ''; const c = parseChord(cf.value); if (!c) { cres.append(h('span', { class: 'muted small' }, cf.value ? 'Unrecognised chord symbol' : 'Type a chord to see playable voicings in the current tuning / capo')); return; } voicings(cf.value, S.tuning, S.capo, 6).forEach(v => cres.append(h('div', { class: 'vc', title: 'Add to selected bar', onclick: () => insertChord(cf.value) }, chordSVG(v), h('div', {}, c.name)))); if (!cres.children.length) cres.append(h('span', { class: 'muted small' }, 'No playable voicing found within 4 frets.')); };
  const render = () => {
    kSel.value = S.key; sSel.value = S.scale; tSelFill(); cap.value = S.capo; const sc = SCALES[S.scale] || []; const fl = keyUsesFlats(S.key, S.minor);
    info.innerHTML = '<span class="muted">Notes:</span> <b class="mono">' + sc.map(i => pcName(S.key + i, fl)).join(' ') + '</b>'; pal.innerHTML = '';
    diatonic(S.key, S.scale).forEach(d => { pal.append(h('button', { class: 'btn sm', title: d.roman + ' — click to place in selected bar; Shift for 7th', onclick: e => insertChord(e.shiftKey && d.seventh ? d.seventh : d.triad) }, d.roman + ' ', h('b', { class: 'mono' }, d.triad))); });
    if (!pal.children.length) pal.append(h('span', { class: 'muted small' }, 'Diatonic chords need a 7-note scale.'));
  };
  bus.on('song', render); render();
  p.append(h('div', { class: 'card' }, h('h4', {}, 'Key · Scale · Tuning'), h('div', { class: 'card-b' }, h('div', { class: 'row' }, kSel, sSel), h('div', { style: { height: '6px' } }), tSel, h('div', { class: 'row', style: { marginTop: '6px' } }, h('span', { class: 'small' }, 'Capo'), cap), info)),
    h('div', { class: 'card' }, h('h4', {}, 'Diatonic chord palette'), h('div', { class: 'card-b' }, pal)),
    h('div', { class: 'card' }, h('h4', {}, 'Progression builder'), h('div', { class: 'card-b' }, pr, h('div', { class: 'row', style: { marginTop: '6px' } }, h('button', { class: 'btn sm', onclick: () => applyProg(+pr.value, false) }, 'Replace section'), h('button', { class: 'btn sm', onclick: () => applyProg(+pr.value, true) }, 'Append bars')))),
    h('div', { class: 'card' }, h('h4', {}, 'Chord finder'), h('div', { class: 'card-b' }, cf, cres)));
}
function insertChord(sym) {
  const sec = S.sections[SEL.sec]; if (!sec) return toast('Add a section first', 'warn'); const bar = sec.bars[SEL.bar] || sec.bars[0]; if (!bar) return; bar.chord = sym; if (SEL.bar < sec.bars.length - 1) SEL.bar++; commit(); play0preview(sym);
}
function play0preview(sym) { if (!E.ready || T.playing) return; const v = voicingFor(sym); if (!v) return; const t = E.ctx.currentTime + .03; v.frets.forEach((f, i) => { if (f != null) pluck('rhythm', t + i * .018, S.tuning[i] + S.capo + f, .7, { id: 'r' + i }); }); }
function applyProg(i, append) {
  const toks = PROGS[i][1].split(' '), chords = toks.map(t => romanToChord(t, S.key, S.minor) || t); const sec = S.sections[SEL.sec]; if (!sec) return;
  if (append) chords.forEach(c => sec.bars.push(newBar(c))); else sec.bars = chords.map(c => newBar(c)); SEL.bar = 0; commit();
}

/* ---------- Rig pane ---------- */
const PED = {}, AB = { A: null, B: null };
function buildRig() {
  const p = PANES.rig, tb = h('div', { class: 'rigdeck' });
  UI.rigName = h('div', { class: 'dk-tone' }, h('div', { class: 'tiny muted' }, 'CURRENT TONE'), h('div', { class: 'dk-name' }, '—')); bus.on('preset', n => { UI.rigName.lastChild.textContent = n; }); UI.rigName.lastChild.textContent = RIG.cur;
  const trimK = mkKnob({ key: 'master', label: 'Master', min: 0, max: 1.2, def: .9, step: .01, fmt: v => dB(v).toFixed(1) + ' dB', onChange: v => { if (E.ready) tc(E.master.gain, v, .02); } });
  const mix = h('input', { type: 'range', min: 0, max: 1, step: .01, value: 0, title: 'Morph between stored A and B', style: { flex: '1 1 90px', minWidth: '70px' }, oninput: e => { if (AB.A && AB.B) rigApply(rigLerp(AB.A, AB.B, +e.target.value)); else toast('Store A and B first'); } });
  const abBtn = (k) => [h('button', { class: 'btn sm', onclick: () => { AB[k] = rigSnapshot(); toast('Stored ' + k, 'ok'); } }, 'Store ' + k), h('button', { class: 'btn sm', onclick: () => { if (AB[k]) rigApply(AB[k]); else toast('Nothing stored in ' + k); } }, k)];
  const nm = h('input', { class: 'in', placeholder: 'Preset name', style: { width: '130px', fontFamily: 'var(--sans)' } });
  const imp = h('input', { type: 'file', accept: '.json', style: { display: 'none' }, onchange: async e => { try { const j = JSON.parse(await e.target.files[0].text()); rigApply(j.rig || j); toast('Rig imported', 'ok'); } catch (err) { toast('Invalid rig JSON', 'bad'); } } });
  UI.deck = tb;
  nm.style.width = ''; nm.style.flex = '1 1 120px'; nm.style.minWidth = '90px';
  tb.append(h('div', { class: 'dk dk1' }, UI.rigName, h('div', { class: 'dk-ab' }, ...abBtn('A'), mix, ...abBtn('B')), trimK.el),
    h('div', { class: 'dk dk2' }, h('button', { class: 'btn sm', title: 'Randomly nudge active parameters', onclick: () => { rigApply(rigMutate(.12)); toast('Mutated active units'); } }, '🎲 Mutate'), h('button', { class: 'btn sm', onclick: () => { rigApply({ u: {} }); RIG.cur = 'Direct (No FX)'; bus.emit('preset', RIG.cur); } }, 'Reset all'), nm, h('button', { class: 'btn sm primary', onclick: () => { const n = nm.value.trim(); if (!n) return toast('Name your preset', 'warn'); const a = store.get('presets', []).filter(x => x.n !== n); a.push({ n, d: 'User preset ' + new Date().toLocaleDateString(), u: rigSnapshot().u }); store.set('presets', a); RIG.cur = n; renderTones(); toast('Saved “' + n + '”', 'ok'); } }, 'Save'), h('button', { class: 'btn sm', onclick: () => download('the-daily.studio-rig.json', JSON.stringify({ name: RIG.cur, rig: rigSnapshot() }, null, 2), 'application/json') }, 'Export'), h('button', { class: 'btn sm', onclick: () => imp.click() }, 'Import'), imp));
  UI.board = h('div', { class: 'board' }); p.append(tb, UI.board);
  RIG.order.forEach(id => UI.board.append(pedalEl(id))); bus.on('rig:refresh', syncPedals); bus.on('rig:order', () => RIG.order.forEach(id => UI.board.append(PED[id].el)));
}
function pedalEl(id) {
  const def = FX[id], card = h('div', { class: 'pedal', 'data-id': id }), ctr = {}, body = h('div', { class: 'pedal-b' });
  const stomp = h('button', { class: 'stomp', title: 'Engage / bypass', onclick: () => { if (!E.ready) return toast('Power on first'); const u = RIG.units[id]; u.setActive(!u.on); card.classList.toggle('on', u.on); } });
  const head = h('div', { class: 'pedal-h', draggable: 'true', title: 'Drag to reorder in the signal chain', ondragstart: e => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; } }, stomp, h('b', {}, def.name), h('small', {}, def.cat));
  card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('dragover'); }); card.addEventListener('dragleave', () => card.classList.remove('dragover'));
  card.addEventListener('drop', e => { e.preventDefault(); card.classList.remove('dragover'); const from = e.dataTransfer.getData('text/plain'); if (from && from !== id) rigMove(from, RIG.order.indexOf(id)); });
  def.params.forEach(q => {
    const key = id + '.' + q.k, setP = v => { if (E.ready && RIG.units[id]) RIG.units[id].set(q.k, v); };
    if (q.type === 'knob') { const k = mkKnob({ key, label: q.label, min: q.min, max: q.max, def: q.def, step: q.step, unit: q.unit, log: q.log, onChange: setP }); ctr[q.k] = { set: v => k.set(v, true) }; body.append(k.el); }
    else if (q.type === 'select') { const s = h('select', { class: 'in', 'aria-label': q.label, onchange: e => setP(e.target.value) }, q.opts.map(o => h('option', { value: o }, o))); s.value = q.def; ctr[q.k] = { set: v => { s.value = v; } }; body.append(h('div', { class: 'ctl' }, h('div', { class: 'k-l' }, q.label), s)); }
    else { const t = h('button', { class: 'tog', onclick: () => { const on = !t.classList.contains('on'); t.classList.toggle('on', on); setP(on ? 1 : 0); } }, q.label); ctr[q.k] = { set: v => t.classList.toggle('on', !!v) }; body.append(h('div', { class: 'ctl' }, h('div', { class: 'k-l' }, ' '), t)); }
  });
  if (id === 'cab') { const fi = h('input', { type: 'file', accept: 'audio/*', style: { display: 'none' }, onchange: e => e.target.files[0] && RIG.units.cab.loadIR(e.target.files[0]) }); body.append(h('div', { class: 'ctl' }, h('div', { class: 'k-l' }, 'Custom IR'), h('div', { class: 'row', style: { gap: '4px' } }, h('button', { class: 'btn sm', onclick: () => fi.click() }, 'Load…'), h('button', { class: 'btn sm', onclick: () => RIG.units.cab.clearIR() }, '↺')), fi)); }
  card.append(head, body); PED[id] = { el: card, ctr }; return card;
}
function syncPedals() {
  if (!E.ready) return;
  RIG.order.forEach(id => { const u = RIG.units[id], P = PED[id]; if (!u || !P) return; P.el.classList.toggle('on', u.on); FX[id].params.forEach(q => P.ctr[q.k] && P.ctr[q.k].set(u.p[q.k])); });
}

/* ---------- right sidebar: tuner, meters, live analysis ---------- */
function buildRight() {
  const R = $('#right'), p = UI.monPane = h('div', { class: 'pane on' }); R.append(p);
  UI.tuner = { note: h('div', { class: 'note' }, '–'), hz: h('div', { class: 'hz' }, 'play a note'), nd: h('i'), str: h('div', { class: 'strs' }) };
  const needle = h('div', { class: 'needle' }, h('u'), UI.tuner.nd);
  UI.tunerCard = h('div', { class: 'card' }, h('h4', {}, 'Tuner', h('span', { class: 'badge', id: 'tunName' }, 'Standard')), h('div', { class: 'card-b tuner' }, UI.tuner.note, UI.tuner.hz, needle, UI.tuner.str));
  const mt = (id, label) => { const i = h('i'), u = h('u'), v = h('span', { class: 'mono tiny' }, '–∞ dB'); UI[id] = { i, u, v, hold: -120 }; return h('div', { style: { marginBottom: '7px' } }, h('div', { class: 'row sp tiny muted' }, h('span', {}, label), v), h('div', { class: 'meter' }, i, u)); };
  UI.clip = h('i', { class: 'led', title: 'Input clip indicator (click to clear)', onclick: e => e.target.className = 'led' });
  const mc = h('div', { class: 'card' }, h('h4', {}, 'Levels (dBFS)', UI.clip), h('div', { class: 'card-b' }, mt('mIn', 'Input (DI, post-trim)'), mt('mRig', 'Rig output'), mt('mMaster', 'Master (post-limiter)'), h('div', { class: 'tiny muted', id: 'gainhint' }, 'Aim for DI peaks around −12…−6 dBFS.')));
  UI.live = h('div', { class: 'kv' }); const lc = h('div', { class: 'card' }, h('h4', {}, 'Live analysis'), h('div', { class: 'card-b' }, UI.live));
  UI.mini = h('canvas', { class: 'vcanvas', height: 90, style: { height: '90px' } }); const sp = h('div', { class: 'card' }, h('h4', {}, 'Spectrum (rig out)'), h('div', { class: 'card-b', style: { padding: '6px' } }, UI.mini));
  p.append(UI.tunerCard, mc, lc, sp); renderStrings(); bus.on('song', renderStrings);
}
function renderStrings() { if (!UI.tuner) return; const s = UI.tuner.str; s.innerHTML = ''; S.tuning.forEach((m, i) => s.append(h('span', { 'data-m': m + S.capo, title: 'Click to hear this string (reference tone)', style: { cursor: 'pointer' }, onclick: async () => { await startAudio(); if (E.ready) pluck('lead', E.ctx.currentTime + .01, m + S.capo, .8, { id: 'ref', pan: 0 }); } }, tunPc(m + S.capo)))); const b = $('#tunName'); if (b) b.textContent = tunShort(); }
const dbw = d => clamp((d + 60) / 60, 0, 1) * 100 + '%';
const bufs = {}; const getBuf = (a, k) => bufs[k] || (bufs[k] = new Float32Array(a.fftSize));
function peakOf(an, k, last = 2048) { const b = getBuf(an, k); if (b.length !== an.fftSize) bufs[k] = new Float32Array(an.fftSize); an.getFloatTimeDomainData(bufs[k]); let pk = 0, e = 0; const n = Math.min(last, bufs[k].length), s = bufs[k].length - n; for (let i = s; i < bufs[k].length; i++) { const v = bufs[k][i], a = Math.abs(v); if (a > pk) pk = a; e += v * v; } return { pk: dB(pk), rms: dB(Math.sqrt(e / n)) }; }
function updateMeters() {
  if (!E.ready) return; if (typeof chMeters === 'function') chMeters();
  [['mIn', E.anaDI], ['mRig', E.anaRig], ['mMaster', E.anaMaster]].forEach(([id, an]) => { const m = peakOf(an, id), u = UI[id]; u.i.style.width = dbw(m.rms); u.hold = Math.max(m.pk, u.hold - .6); u.u.style.left = dbw(Math.max(u.hold, -60)); u.v.textContent = 'pk ' + (m.pk < -90 ? '−∞' : m.pk.toFixed(1)) + ' · rms ' + (m.rms < -90 ? '−∞' : m.rms.toFixed(1)); if (id === 'mIn' && m.pk > -.5) UI.clip.className = 'led bad'; }); laneMeters();
  const g = $('#gainhint'); if (g && E.hasInput) g.textContent = AN.peak > -2 ? '⚠ Too hot — lower the interface gain or trim.' : AN.active && AN.peak < -30 ? 'Signal is low — raise gain (aim DI peaks around −12…−6 dBFS).' : 'Aim for DI peaks around −12…−6 dBFS.';
}
function updateTuner() {
  const t = UI.tuner; if (!t) return;
  if (AN.f0 && AN.midi != null) {
    t.note.textContent = tunNote(AN.midi); t.hz.textContent = AN.f0.toFixed(2) + ' Hz · ' + (AN.cents >= 0 ? '+' : '') + AN.cents.toFixed(1) + '¢ · clarity ' + AN.clarity.toFixed(2);
    t.nd.style.left = (50 + clamp(AN.cents, -50, 50)) + '%'; t.note.style.color = Math.abs(AN.cents) < 5 ? 'var(--ok)' : '';
    $$('span', t.str).forEach(s => { const m = +s.dataset.m; s.className = m === AN.midi ? (Math.abs(AN.cents) < 5 ? 'hit' : 'near') : ''; });
  } else { t.hz.textContent = AN.rms > -60 ? 'listening…' : 'play a note'; t.nd.style.left = '50%'; $$('span', t.str).forEach(s => s.className = ''); }
}
function updateLive() {
  const l = UI.live; if (!l) return; const ch = AN.chord[0], k = AN.key && AN.key[0];
  l.innerHTML = ''; const kv = (a, b) => l.append(h('span', {}, a), h('span', {}, b));
  kv('Chord', ch && AN.active ? ch.sym + ' (' + (ch.score * 100).toFixed(0) + '%)' : '—'); kv('Alt', AN.chord[1] && AN.active ? AN.chord.slice(1).map(c => c.sym).join(' · ') : '—');
  kv('Key (notes)', k ? pcName(k.root) + (k.minor ? ' minor' : ' major') + ' r=' + k.r.toFixed(2) : 'play ≥8 notes'); kv('f0', AN.f0 ? AN.f0.toFixed(1) + ' Hz' : '—');
  kv('Centroid', AN.centroid ? AN.centroid.toFixed(0) + ' Hz' : '—'); kv('Rolloff 85%', AN.rolloff ? AN.rolloff.toFixed(0) + ' Hz' : '—'); kv('HFR (h2–h6)', AN.hfr != null ? AN.hfr.toFixed(1) + ' dB' : '—'); kv('Vibrato', AN.vib ? AN.vib.rate.toFixed(1) + ' Hz · ±' + AN.vib.ext.toFixed(0) + '¢' : '—'); kv('Crest', AN.active ? AN.crest.toFixed(1) + '×' : '—');
}

/* >>> parts/07-ui-timeline-tab.js */
/* ============================================================
   Part 07 · DAW timeline (canvas, virtualized) and the tablature editor
   ============================================================ */
const TL = { bw: 150, lh: 46, rh: 22, sh: 20, follow: true, cache: null, dirty: true, col: {}, drag: null };
function tlColors() {
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  TL.col = { bg: g('--panel'), bg2: g('--bg2'), grid: g('--grid'), line: g('--line'), line2: g('--line2'), text: g('--text'), muted: g('--muted'), accent: g('--accent'), accent2: g('--accent2'), wave: g('--wave'), p2: g('--panel2'), cv: [g('--cv1'), g('--cv2'), g('--cv3'), g('--cv4'), g('--cv5')] }; TL.dirty = true;
}
bus.on('theme', tlColors); bus.on('song', () => { TL.cache = null; TL.dirty = true; });
function buildTimeline() {
  const el = $('#timeline'); tlColors();
  const bar = h('div', { class: 'tl-bar' });
  const zoom = h('input', { type: 'range', 'aria-label': 'Timeline zoom', min: 50, max: 420, step: 10, value: TL.bw, style: { width: '110px' }, oninput: e => { TL.bw = +e.target.value; TL.dirty = true; tlSize(); } });
  const sw = h('input', { type: 'range', min: 0, max: .5, step: .01, value: S.swing, style: { width: '90px' }, title: 'Swing (delays off-16ths)', oninput: e => { S.swing = +e.target.value; commit(false); } });
  UI.follow = h('button', { class: 'btn sm on', onclick: e => { TL.follow = !TL.follow; e.target.classList.toggle('on', TL.follow); } }, 'Follow');
  UI.tlinfo = h('span', { class: 'chip' });
  bar.append(h('b', { class: 'small', title: 'Click ruler = seek · Shift-drag = loop · Double-click ruler = clear loop · click section strip = select section' }, 'ARRANGEMENT'), UI.follow, h('span', { class: 'small muted' }, 'Zoom'), zoom, h('span', { class: 'small muted' }, 'Swing'), sw,
    h('button', { class: 'btn sm', title: 'Clear loop region (double-click ruler)', onclick: () => { T.loopA = 0; T.loopB = null; TL.dirty = true; } }, 'Clear loop'),
    h('button', { class: 'btn sm', onclick: () => { T.loop = true; T.loopA = Math.floor(playheadSlot() / spb()) * spb(); T.loopB = Math.min(songSlots(), T.loopA + spb() * 4); syncTransport(); TL.dirty = true; } }, 'Loop 4 bars here'), h('span', { class: 'grow' }), UI.tlinfo,
    h('span', { class: 'small muted' }, 'Lanes'), h('button', { class: 'btn sm', title: 'Shorter lanes', 'aria-label': 'Shorter lanes', onclick: () => laneScale(-.2) }, '−'), h('button', { class: 'btn sm', title: 'Taller lanes', 'aria-label': 'Taller lanes', onclick: () => laneScale(.2) }, '+'),
    h('button', { class: 'btn sm', title: 'Show / hide lanes, add a vocal or guitar lane, reorder', onclick: e => lanesMenu(e.currentTarget) }, 'Lanes ▾'),
    h('button', { class: 'btn sm', title: 'Cycle timeline height', onclick: () => { TL.hi = ((TL.hi || 0) + 1) % 4; $('#center').style.setProperty('--tlh', ['minmax(200px,40%)', 'minmax(200px,58%)', 'minmax(200px,82%)', '120px'][TL.hi]); setTimeout(tlSize, 30); } }, '↕'), h('button', { class: 'btn sm cmax', 'data-m': 'tl', title: 'Give the arrangement the whole centre (Esc to go back)', onclick: () => centerMax('tl') }, '⤢'));
  UI.heads = h('div', { class: 'tl-heads' }); UI.tlc = h('canvas'); UI.tlsp = h('div', { style: { position: 'relative' } }); UI.tlc.style.cssText = 'position:sticky;left:0;top:0;display:block'; UI.tlsp.append(UI.tlc);
  UI.tls = h('div', { class: 'tl-scroll', tabindex: '0', role: 'region', 'aria-label': 'Arrangement timeline (scrolls sideways)' }, UI.tlsp); const body = h('div', { class: 'tl-body' }, UI.heads, UI.tls); el.append(bar, body); UI.tlbody = body; body.style.setProperty('--hw', LN.hw + 'px');
  const hwh = h('div', { class: 'tl-hw', title: 'Drag to widen the track headers · double-click to reset' }); body.append(hwh);
  hwh.addEventListener('pointerdown', e => { e.preventDefault(); hwh.setPointerCapture(e.pointerId); const x0 = e.clientX, w0 = LN.hw; const mv = ev => { LN.hw = clamp(w0 + ev.clientX - x0, 120, 360); body.style.setProperty('--hw', LN.hw + 'px'); tlSize(); }; const up = () => { hwh.removeEventListener('pointermove', mv); hwh.removeEventListener('pointerup', up); saveLn(); renderHeads(); }; hwh.addEventListener('pointermove', mv); hwh.addEventListener('pointerup', up); });
  hwh.addEventListener('dblclick', () => { LN.hw = 188; body.style.setProperty('--hw', '188px'); saveLn(); renderHeads(); tlSize(); });
  UI.tls.addEventListener('scroll', () => { UI.heads.scrollTop = UI.tls.scrollTop; TL.dirty = true; });
  UI.tlc.addEventListener('pointerdown', tlDown); UI.tlc.addEventListener('pointermove', tlMove); UI.tlc.addEventListener('pointerup', tlUp); UI.tlc.addEventListener('dblclick', e => { const y = e.offsetY + UI.tls.scrollTop; if (y < TL.rh) { T.loopA = 0; T.loopB = null; TL.dirty = true; } });
  new ResizeObserver(() => { tlSize(); }).observe(UI.tls); bus.on('song', () => { tlSize(); renderHeads(); }); bus.on('takes', () => { renderHeads(); tlSize(); }); renderHeads(); tlSize();
}
function tlSize() {
  const sc = UI.tls; if (!sc) return; const vw = sc.clientWidth || 600, vh = sc.clientHeight || 200, bars = totalBars(), W = Math.max(vw, bars * TL.bw + 120), H = tlLayout().end;
  UI.tlsp.style.width = W + 'px'; UI.tlsp.style.height = Math.max(H, vh) + 'px'; const dpr = window.devicePixelRatio || 1; const cw = Math.floor(vw * dpr), ch = Math.floor(vh * dpr);
  if (UI.tlc.width !== cw || UI.tlc.height !== ch) { UI.tlc.width = cw; UI.tlc.height = ch; UI.tlc.style.width = vw + 'px'; UI.tlc.style.height = vh + 'px'; } TL.dirty = true;
}
function dlTake(tk) {
  const n = tk.name.replace(/\W+/g, '_'); if (tk.kind === 'vox') return download(n + '.wav', encodeWav([tk.dry], tk.sr, 24)); download(n + '_dry_DI.wav', encodeWav([tk.dry], tk.sr, 24)); if (tk.wet) setTimeout(() => download(n + '_wet.wav', encodeWav([tk.wet], tk.sr, 24)), 300);
}
function tlPoint(e) { return { x: e.offsetX + UI.tls.scrollLeft, y: e.offsetY + UI.tls.scrollTop }; }
function tlDown(e) {
  const { x, y } = tlPoint(e), sp = spb(), sw = TL.bw / sp, bs = 16 / S.ts[1], bars = totalBars();
  if (y < TL.rh) {
    const slot = Math.round(x / sw / bs) * bs; if (e.shiftKey) { TL.drag = { a: clamp(Math.round(x / TL.bw) * sp, 0, bars * sp) }; UI.tlc.setPointerCapture(e.pointerId); } else seek(clamp(slot, 0, bars * sp - 1)); return;
  }
  const bi = Math.floor(x / TL.bw); if (bi < 0 || bi >= bars) return; const fb = flatBars()[bi];
  if (y < TL.rh + TL.sh) { SEL.sec = fb.si; SEL.bar = 0; TL.dirty = true; dockGo('song'); bus.emit('sel'); return; }
  const lo = laneAt(y), lane = lo && lo.l; SEL.sec = fb.si; SEL.bar = fb.bi; if (lane && lane.type === 'tab') { TE.sec = fb.si; TE.bi = fb.bi; dockGo('tab'); renderTab(); } else if (lane && lane.type === 'chords') { dockGo('song'); bus.emit('sel'); }
  TL.dirty = true;
}
function tlMove(e) { if (!TL.drag) return; const { x } = tlPoint(e), sp = spb(), b = clamp(Math.round(x / TL.bw) * sp, 0, totalBars() * sp); T.loopA = Math.min(TL.drag.a, b); T.loopB = Math.max(TL.drag.a, b); if (T.loopB === T.loopA) T.loopB = null; TL.dirty = true; }
function tlUp() { if (TL.drag) { TL.drag = null; if (T.loopB != null) { T.loop = true; syncTransport(); } } }
function tlCache() {
  if (TL.cache) return TL.cache; const sp = spb(), n = totalBars(), bass = []; T.bars = null;
  for (let bi = 0; bi < n; bi++) for (let sib = 0; sib < sp; sib++) { const cd = chordAt(bi, sib); if (!cd || !cd.sym || !S.band.bassOn) continue; const e = bassEvent(S.band.bassStyle, cd.sym, cd.rel, cd.len, cd.next); if (e) bass.push({ s: bi * sp + sib, m: e.m, len: e.len }); }
  return TL.cache = { bass };
}
function drawTL() {
  const cv = UI.tlc, sc = UI.tls; if (!cv || !sc) return; const dpr = window.devicePixelRatio || 1, g = cv.getContext('2d'), C = TL.col, vw = cv.width / dpr, vh = cv.height / dpr;
  const sp = spb(), sw = TL.bw / sp, bs = 16 / S.ts[1], bars = totalBars(), ox = sc.scrollLeft, oy = sc.scrollTop, LY = tlLayout(), top = LY.top, end = LY.end, fb = flatBars();
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, vw, vh); g.fillStyle = C.bg; g.fillRect(0, 0, vw, vh); g.translate(-ox, -oy);
  const mono = '700 10px ui-monospace,Menlo,Consolas,monospace', sans = '700 11px system-ui,-apple-system,Segoe UI,sans-serif'; g.textBaseline = 'middle';
  const b0 = Math.max(0, Math.floor(ox / TL.bw) - 1), b1 = Math.min(bars - 1, Math.ceil((ox + vw) / TL.bw) + 1), V = { ox, vw, sw, sp, b0, b1, fb, C, sans, LY };
  laneBg(g, V);
  // ruler + bar grid
  g.fillStyle = C.bg2; g.fillRect(ox, 0, vw, TL.rh); g.fillStyle = C.line2; g.fillRect(ox, TL.rh - 1, vw, 1);
  fb.forEach(f => {
    if (f.idx < b0 || f.idx > b1) return; const x = f.idx * TL.bw;
    g.strokeStyle = C.line2; g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, end); g.stroke(); g.fillStyle = C.muted; g.font = mono; g.fillText(String(f.idx + 1), x + 4, TL.rh / 2);
    for (let b = 1; b * bs < sp; b++) { const xx = x + b * bs * sw; g.strokeStyle = C.grid; g.beginPath(); g.moveTo(xx + .5, TL.rh); g.lineTo(xx + .5, end); g.stroke(); g.fillStyle = C.line2; g.fillRect(xx, TL.rh - 5, 1, 5); }
  });
  // section strip
  S.sections.forEach((s, si) => {
    const start = S.sections.slice(0, si).reduce((a, q) => a + q.bars.length, 0), x = start * TL.bw, w = s.bars.length * TL.bw; if (x + w < ox || x > ox + vw) return;
    const col = C.cv[si % 5]; g.fillStyle = col; g.globalAlpha = SEL.sec === si ? .95 : .55; g.fillRect(x + 1, TL.rh + 1, w - 2, TL.sh - 2); g.globalAlpha = 1; g.fillStyle = '#fff'; g.font = sans; g.save(); g.beginPath(); g.rect(x + 1, TL.rh, w - 2, TL.sh); g.clip(); g.fillText(s.name, x + 6, TL.rh + TL.sh / 2 + .5); g.restore();
  });
  // lanes content (23-lanes.js)
  drawLanes(g, V);
  // loop region
  if (T.loopB != null) { const x = T.loopA * sw, w = (T.loopB - T.loopA) * sw; g.fillStyle = C.accent; g.globalAlpha = .13; g.fillRect(x, 0, w, end); g.globalAlpha = .9; g.fillRect(x, TL.rh - 4, w, 3); g.globalAlpha = 1; }
  // playhead
  const ph = playheadSlot(), px = ph * sw; g.strokeStyle = C.accent2; g.lineWidth = 2; g.beginPath(); g.moveTo(px, 0); g.lineTo(px, end); g.stroke(); g.lineWidth = 1; g.fillStyle = C.accent2; g.beginPath(); g.moveTo(px - 5, 0); g.lineTo(px + 5, 0); g.lineTo(px, 8); g.fill();
  if (T.playing && TL.follow && (px < ox + 30 || px > ox + vw - 80)) { sc.scrollLeft = Math.max(0, px - 60); }
  UI.tlinfo.textContent = bars + ' bars · ' + fmtTime(bars * spb() * slotDur()) + (T.loopB != null ? ' · loop ' + (T.loopA / sp + 1) + '–' + (T.loopB / sp) : '');
}

/* ============================================================
   TAB EDITOR
   ============================================================ */
const TE = { sec: 0, bi: 0, slot: 0, st: 5, buf: '', t: 0, clip: null };
const FILLS = ['Fingerstyle pop', 'Arpeggio ↑↓ 8ths', 'Travis pick', 'Block strum', 'Power chug 8ths', 'Root pulse'];
function buildTabPane() {
  const p = PANES.tab;
  UI.teSec = h('select', { class: 'in', style: { width: '170px', fontFamily: 'var(--sans)' }, onchange: e => { TE.sec = +e.target.value; TE.bi = 0; renderTab(); } });
  UI.teFill = h('select', { class: 'in', style: { width: '160px', fontFamily: 'var(--sans)' } }, FILLS.map(f => h('option', {}, f)));
  const T_ = (k, lab, t) => h('button', { class: 'btn sm tech', title: t, onclick: () => setTech(k) }, lab);
  UI.capBtn = h('button', { class: 'btn sm', title: 'Quantize what you play into the tab (audio pitch + onset, assisted by the camera if active). Start playback first.', onclick: e => { CAP.on = !CAP.on; e.target.classList.toggle('on', CAP.on); e.target.textContent = CAP.on ? '● Capturing…' : '○ Capture from playing'; if (CAP.on) toast('Capture ON: play along while the transport runs — notes are quantized to 16ths'); } }, '○ Capture from playing');
  p.append(h('div', { class: 'row', style: { marginBottom: '8px', gap: '6px' } }, UI.teSec,
    h('button', { class: 'btn sm', onclick: () => { const sec = S.sections[TE.sec]; if (sec) { sec.bars.push(newBar(sec.bars[sec.bars.length - 1] ? sec.bars[sec.bars.length - 1].chord : '')); commit(); } } }, '＋ Bar'), h('button', { class: 'btn sm', onclick: () => { const sec = S.sections[TE.sec]; if (sec && sec.bars.length > 1) { sec.bars.pop(); TE.bi = Math.min(TE.bi, sec.bars.length - 1); commit(); } } }, '－ Bar'),
    h('span', { class: 'muted small tech' }, 'Technique:'), T_('h', 'h', 'Hammer-on to next note'), T_('p', 'p', 'Pull-off to next note'), T_('/', '/', 'Slide up'), T_('\\', '\\', 'Slide down'), T_('b', 'b', 'Bend (whole step)'), T_('~', '~', 'Vibrato'), T_('x', 'x', 'Dead / muted note'), T_('<>', '<n>', 'Natural harmonic'),
    h('span', { class: 'grow' }), UI.teFill, h('button', { class: 'btn sm', onclick: () => fillBar(false) }, 'Fill bar'), h('button', { class: 'btn sm', onclick: () => fillBar(true) }, 'Fill section'),
    h('button', { class: 'btn sm', onclick: () => { const b = curBar(); if (b) TE.clip = JSON.stringify(b.tab); toast('Bar copied'); } }, 'Copy'), h('button', { class: 'btn sm', onclick: () => { const b = curBar(); if (b && TE.clip) { b.tab = JSON.parse(TE.clip); commit(); } } }, 'Paste'), h('button', { class: 'btn sm bad', onclick: () => { const b = curBar(); if (b) { b.tab = []; commit(); } } }, 'Clear bar'), UI.capBtn),
    h('div', { class: 'tiny muted', style: { marginBottom: '8px' } }, 'Click a cell, type a fret (0–24). Arrows move · Del clears · Alt+↑/↓ transposes · Space plays from this bar. Chord names above each bar come from the Song panel; click one to edit.'),
    UI.tabwrap = h('div', { class: 'tabwrap' }));
  bus.on('song', e => { if (paneVisible('tab') || e) renderTab(true); }); bus.on('dock', id => { if (id === 'tab') renderTab(); });
}
const curSec = () => S.sections[TE.sec], curBar = () => (curSec() || { bars: [] }).bars[TE.bi];
function renderTab(keepFocus) {
  if (!UI.tabwrap) return; const ae = document.activeElement, had = !ae || ae === document.body || (ae.classList && ae.classList.contains('tcell')); if (TE.sec >= S.sections.length) TE.sec = Math.max(0, S.sections.length - 1);
  const sec = curSec(), w = UI.tabwrap; w.innerHTML = ''; UI.teSec.innerHTML = ''; S.sections.forEach((s, i) => UI.teSec.append(h('option', { value: i, selected: i === TE.sec }, s.name)));
  if (!sec) { w.append(h('div', { class: 'muted' }, 'No sections yet — add one in the Song panel.')); return; }
  const sp = spb(), bs = 16 / S.ts[1], labels = stringLabels(); TE.bi = clamp(TE.bi, 0, sec.bars.length - 1);
  sec.bars.forEach((bar, bi) => {
    const grid = h('div', { class: 'tgrid', style: { gridTemplateColumns: '18px repeat(' + sp + ',var(--tcw,22px))' } }), cs = barChords(bar);
    grid.append(h('span'), ...Array.from({ length: sp }, (_, s) => h('div', { class: 'tbeat', style: { display: 'block', width: 'var(--tcw,22px)', textAlign: 'center', height: '11px', font: '600 8.5px var(--mono)', color: 'var(--muted)' } }, s % bs === 0 ? String(s / bs + 1) : (bs >= 4 && s % (bs / 2) === 0 ? '&' : ''))));
    for (let r = 0; r < 6; r++) {
      const st = 5 - r; grid.append(h('div', { style: { font: '700 10px var(--mono)', color: 'var(--muted)', alignSelf: 'center', textAlign: 'center' } }, labels[r]));
      for (let s = 0; s < sp; s++) {
        const n = bar.tab.find(o => o.s === s && o.st === st), sel = TE.bi === bi && TE.slot === s && TE.st === st;
        const c = h('div', { class: 'tcell' + (s === 0 ? ' b0' : s % bs === 0 ? ' b4' : '') + (sel ? ' sel' : ''), tabindex: sel ? 0 : -1, 'data-b': bi, 'data-s': s, 'data-st': st, onpointerdown: () => { TE.bi = bi; TE.slot = s; TE.st = st; markSel(); } }, n ? h('span', { class: 'n' }, fretText(n)) : null, n && n.t && n.t !== '<>' && n.t !== 'b' ? h('span', { class: 't' }, n.t) : null);
        c.addEventListener('keydown', e => tabKey(e)); grid.append(c);
      }
    }
    const chEl = h('div', { class: 'ch', title: 'Click to edit the chord for this bar', onclick: () => { const v = prompt('Chord(s) for bar ' + (bi + 1) + ' (space-separated):', bar.chord); if (v != null) { bar.chord = v.trim(); commit(); } } }, cs.length ? cs.join('   ') : '·');
    w.append(h('div', { class: 'tbar' }, chEl, h('span', { class: 'bn' }, 'bar ' + (bi + 1)), grid));
  });
  if (keepFocus && had && paneVisible('tab')) { const c = $('.tcell.sel', w); if (c) c.focus(); }
}
function markSel() {
  $$('#pane-tab .tcell.sel').forEach(c => { c.classList.remove('sel'); c.tabIndex = -1; }); const c = $(`#pane-tab .tcell[data-b="${TE.bi}"][data-s="${TE.slot}"][data-st="${TE.st}"]`); if (c) { c.classList.add('sel'); c.tabIndex = 0; c.focus(); }
}
function setNote(f) {
  const bar = curBar(); if (!bar) return; let n = bar.tab.find(o => o.s === TE.slot && o.st === TE.st);
  if (f == null) { if (n) bar.tab.splice(bar.tab.indexOf(n), 1); } else if (n) { n.f = f; if (n.t === 'b') n.bend = typeof f === 'number' ? f + 2 : undefined; } else { n = { s: TE.slot, st: TE.st, f, t: '' }; bar.tab.push(n); }
  if (n && f != null && E.ready && !T.playing) playTabNote(bar, n, E.ctx.currentTime + .02, slotDur()); commit(false); renderTab(true);
}
function setTech(k) {
  const bar = curBar(); if (!bar) return; const n = bar.tab.find(o => o.s === TE.slot && o.st === TE.st); if (!n) return toast('Select a note first', 'warn');
  if (k === 'x') { n.f = n.f === 'x' ? 0 : 'x'; n.t = ''; } else { n.t = n.t === k ? '' : k; if (k === 'b') n.bend = n.t === 'b' ? (typeof n.f === 'number' ? n.f + 2 : undefined) : undefined; }
  commit(true); renderTab(true); const c = $('#pane-tab .tcell.sel'); if (c) c.focus();
}
function tabKey(e) {
  const sec = curSec(); if (!sec) return; const sp = spb(); let handled = true;
  if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const now = performance.now(); let v = (now - TE.t < 800 && TE.buf) ? TE.buf + e.key : e.key; if (+v > 24) v = e.key; TE.buf = v; TE.t = now; setNote(+v);
  } else switch (e.key) {
    case 'ArrowRight': TE.slot++; if (TE.slot >= sp) { if (TE.bi < sec.bars.length - 1) { TE.bi++; TE.slot = 0; } else TE.slot = sp - 1; } markSel(); break;
    case 'ArrowLeft': TE.slot--; if (TE.slot < 0) { if (TE.bi > 0) { TE.bi--; TE.slot = sp - 1; } else TE.slot = 0; } markSel(); break;
    case 'ArrowUp': if (e.altKey) { transpose(1); } else { TE.st = Math.min(5, TE.st + 1); markSel(); } break;
    case 'ArrowDown': if (e.altKey) { transpose(-1); } else { TE.st = Math.max(0, TE.st - 1); markSel(); } break;
    case 'Delete': case 'Backspace': setNote(null); break;
    case 'Enter': case ' ': { T.cursor = (sec.bars.length ? S.sections.slice(0, TE.sec).reduce((a, q) => a + q.bars.length, 0) + TE.bi : 0) * sp; T.playing ? stopPlay(true) : play(); break; }
    case 'h': case 'p': case '/': case '\\': case 'b': case '~': case 'x': setTech(e.key); break; case '<': setTech('<>'); break;
    default: handled = false;
  }
  if (handled) { e.preventDefault(); e.stopPropagation(); }
}
function transpose(d) { const bar = curBar(); const n = bar && bar.tab.find(o => o.s === TE.slot && o.st === TE.st); if (n && typeof n.f === 'number') { n.f = clamp(n.f + d, 0, 24); commit(false); renderTab(true); if (E.ready && !T.playing) playTabNote(bar, n, E.ctx.currentTime + .02, slotDur()); } }
function fillBar(whole) {
  const style = UI.teFill.value, sec = curSec(); if (!sec) return; const list = whole ? sec.bars : [curBar()]; let miss = 0;
  list.forEach(bar => { const cs = barChords(bar); if (!cs.length) { miss++; return; } const ok = fillTab(bar, style, cs[0]); if (!ok) { miss++; return; } if (cs[1]) { const half = spb() >> 1, tmp = newBar(); if (fillTab(tmp, style, cs[1])) { bar.tab = bar.tab.filter(n => n.s < half).concat(tmp.tab.filter(n => n.s >= half)); } } });
  if (miss) toast(miss + ' bar(s) had no playable chord', 'warn'); commit(); renderTab();
}

/* >>> parts/08-ui-compose.js */
/* ============================================================
   Part 08 · Song / lyrics, Band, Export (Ultimate Guitar, ChordPro, MIDI, WAV, JSON) and lint
   ============================================================ */

/* ---------- lyric text analysis ---------- */
function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, ''); if (!w) return 0; if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); const m = w.match(/[aeiouy]{1,2}/g); return Math.max(1, m ? m.length : 1);
}
const lyricPlain = line => line.replace(/\[[^\]]*\]/g, '');
const lineSyl = line => (lyricPlain(line).match(/[A-Za-z']+/g) || []).reduce((a, w) => a + syllables(w), 0);
function rhymeKey(line) {
  const ws = lyricPlain(line).toLowerCase().match(/[a-z']+/g); if (!ws) return ''; let w = ws[ws.length - 1].replace(/'/g, '').replace(/(s|ed)$/, m => w2ok(m));
  const m = w.match(/[aeiouy]+[^aeiouy]+e$/) || w.match(/[aeiouy]+[^aeiouy]*$/); return m ? m[0] : w;
}
function w2ok(m) { return m === 's' ? '' : m; }
function rhymeScheme(lines) {
  const map = {}, out = []; let nx = 0, keys = lines.map(l => (l.trim() ? rhymeKey(l) : null));
  const count = {}; keys.forEach(k => { if (k) count[k] = (count[k] || 0) + 1; });
  keys.forEach(k => { if (!k) return out.push(''); if (count[k] < 2) return out.push('·'); if (!(k in map)) map[k] = String.fromCharCode(65 + (nx++ % 26)); out.push(map[k]); });
  return out;
}
/** Parse a lyric line with inline [Chord] markers into plain text and chord anchors. */
function parseLyricLine(line) {
  let text = '', chords = [], last = 0; const re = /\[([^\]]+)\]/g; let m;
  while ((m = re.exec(line))) { text += line.slice(last, m.index); last = re.lastIndex; if (parseChord(m[1])) chords.push({ pos: text.length, sym: m[1] }); else text += m[0]; }
  text += line.slice(last); return { text, chords };
}
/** Return {chordLine, text} using a monospaced layout; fmt(sym) wraps chord symbols (width counted on the plain symbol). */
function chordOverLine(line, fmt = s => s) {
  const { text, chords } = parseLyricLine(line); let cl = '', plainLen = 0;
  chords.forEach(c => { while (plainLen < c.pos) { cl += ' '; plainLen++; } if (plainLen > 0 && cl && !/ $/.test(cl)) { cl += ' '; plainLen++; } cl += fmt(c.sym); plainLen += c.sym.length; });
  return { chordLine: cl, text, hasChords: chords.length > 0 };
}
function stripCaretPad(s) { return s.replace(/\s+$/, ''); }

/* ---------- ASCII tablature renderer (Ultimate Guitar friendly) ---------- */
function slotText(n) { return fretText(n) + ({ h: 'h', p: 'p', '/': '/', '\\': '\\', '~': '~' }[n.t] || ''); }
function tabLabels() { return stringLabels().map((l, i) => (i === 0 && l === 'E' ? 'e' : l)); }
function renderBarTab(bar) {
  const sp = spb(), rows = Array.from({ length: 6 }, () => '');
  for (let s = 0; s < sp; s++) {
    const here = bar.tab.filter(n => n.s === s), w = Math.max(2, ...here.map(n => slotText(n).length + 1));
    for (let r = 0; r < 6; r++) { const n = here.find(o => o.st === 5 - r); rows[r] += n ? slotText(n).padEnd(w, '-') : '-'.repeat(w); }
  }
  return rows;
}
function renderTabBars(bars, width) {
  const lab = tabLabels(), blocks = bars.map(renderBarTab), out = []; let i = 0; width = width || CFG.ugWidth || 72;
  while (i < blocks.length) {
    let w = 2, j = i; const take = [];
    while (j < blocks.length && (take.length === 0 || w + blocks[j][0].length + 1 <= width)) { take.push(blocks[j]); w += blocks[j][0].length + 1; j++; }
    for (let r = 0; r < 6; r++) out.push(lab[r] + '|' + take.map(b => b[r]).join('|') + '|');
    out.push(''); i = j;
  }
  return out.join('\n').replace(/\n+$/, '');
}
const hasTab = sec => sec.bars.some(b => b.tab.length);

/* ---------- export builders ---------- */
const capoText = () => S.capo ? S.capo + ['th', 'st', 'nd', 'rd'][S.capo % 10 > 3 || (S.capo > 10 && S.capo < 14) ? 0 : S.capo % 10] + ' fret' : 'none';
const tuningNotes = () => S.tuning.map(m => tunPc(m)).join(' ');
const keyName = () => pcName(S.key, CFG.flats) + (S.minor ? 'm' : '');
function songHeader(style) {
  const l = []; if (style === 'ug') l.push((S.title || 'Untitled') + (S.artist ? ' - ' + S.artist : ''));
  l.push('Tuning: ' + tuningNotes() + (S.tuningName.startsWith('Standard') ? '' : '  (' + S.tuningName.replace(/\s*\(.*$/, '') + ')'));
  l.push('Capo: ' + capoText()); l.push('Key: ' + keyName() + (S.capo ? '  (sounding key; chords below are shapes relative to the capo)' : '')); l.push('Tempo: ' + S.bpm + ' bpm · ' + S.ts.join('/') + (S.swing > .05 ? ' · swing' : '')); if (S.notes) l.push('', S.notes.trim());
  return l.join('\n');
}
function buildUG(o = {}) {
  const o2 = Object.assign({ header: true, tabs: true, lyrics: true, tags: CFG.ugTags !== false, bars: true }, o), T_ = (a, b, x) => o2.tags ? a + x + b : x;
  const out = []; if (o2.header) out.push(songHeader('ug'), '');
  S.sections.forEach(sec => {
    out.push('[' + sec.name + ']'); const cl = sec.bars.map(b => barChords(b).map(c => T_('[ch]', '[/ch]', c)).join(' ') || '%').join(' | ');
    const lyl = (sec.lyrics || '').split('\n').filter(l => l.trim());
    const lyHasCh = lyl.some(l => parseLyricLine(l).chords.length);
    if (o2.bars && !(o2.lyrics && lyHasCh)) out.push(o2.tags ? cl.replace(/ \| /g, '  ') : cl.replace(/ \| /g, '  '));
    if (o2.lyrics && lyl.length) {
      const blk = []; (sec.lyrics || '').replace(/\s+$/, '').split('\n').forEach(l => { const r = chordOverLine(l, s => T_('[ch]', '[/ch]', s)); if (r.hasChords) blk.push(stripCaretPad(r.chordLine)); blk.push(r.text); });
      out.push(o2.tags ? '[tab]' + blk.join('\n') + '[/tab]' : blk.join('\n'));
    }
    if (o2.tabs && hasTab(sec)) { const tb = renderTabBars(sec.bars, S.ts[0] > 4 ? 78 : null); out.push(o2.tags ? '[tab]' + tb + '[/tab]' : tb); }
    out.push('');
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
function buildChordPro() {
  const o = ['{title: ' + (S.title || 'Untitled') + '}', '{artist: ' + (S.artist || '') + '}', '{key: ' + keyName() + '}', '{tempo: ' + S.bpm + '}', '{time: ' + S.ts.join('/') + '}'];
  if (S.capo) o.push('{capo: ' + S.capo + '}'); o.push('{comment: Tuning ' + tuningNotes() + '}'); if (S.notes) o.push('{comment: ' + S.notes.replace(/\n/g, ' ') + '}'); o.push('');
  S.sections.forEach(sec => {
    const kind = /chorus/i.test(sec.name) ? 'chorus' : /bridge/i.test(sec.name) ? 'bridge' : /verse/i.test(sec.name) ? 'verse' : null;
    o.push(kind ? '{start_of_' + kind + ': ' + sec.name + '}' : '{comment: ' + sec.name + '}');
    const ly = (sec.lyrics || '').trim(); if (ly) o.push(ly); else o.push(sec.bars.map(b => barChords(b).map(c => '[' + c + ']').join('')).join(' | '));
    if (hasTab(sec)) o.push('{start_of_tab}', renderTabBars(sec.bars), '{end_of_tab}');
    if (kind) o.push('{end_of_' + kind + '}'); o.push('');
  });
  return o.join('\n');
}
function buildLyricsOnly() { return S.sections.map(sec => '[' + sec.name + ']\n' + (sec.lyrics || '').split('\n').map(lyricPlain).join('\n').trim()).join('\n\n') + '\n'; }

/* ---------- Standard MIDI File ---------- */
function buildMidi() {
  const PPQ = 480, TPS = PPQ / 4, vlq = n => { const b = [n & 127]; while ((n >>= 7)) b.unshift((n & 127) | 128); return b; };
  const str = s => Array.from(new TextEncoder().encode(s)), u32 = n => [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255], u16 = n => [(n >> 8) & 255, n & 255];
  const track = (ev, name) => { ev.sort((a, b) => a.t - b.t || (a.o || 0) - (b.o || 0)); const d = [0, 0xFF, 3, name.length, ...str(name)]; let t = 0; ev.forEach(e => { d.push(...vlq(Math.max(0, e.t - t)), ...e.b); t = e.t; }); d.push(0, 0xFF, 0x2F, 0); return [...str('MTrk'), ...u32(d.length), ...d]; };
  const sp = spb(), total = totalBars() * sp, tracks = [];
  const us = Math.round(60e6 / S.bpm); const meta = [{ t: 0, b: [0xFF, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255] }, { t: 0, b: [0xFF, 0x58, 4, S.ts[0], Math.log2(S.ts[1]), 24, 8] }, { t: 0, b: [0xFF, 0x59, 2, 0, S.minor ? 1 : 0] }, { t: 0, b: [0xFF, 0x02, S.title.length + 12, ...str('(c) ' + (S.artist || 'composer'))].slice(0, 0) }];
  meta.length = 3; meta.push({ t: 0, b: [0xFF, 0x01, ...vlq(('Made with the-daily.studio · ' + S.title).length), ...str('Made with the-daily.studio · ' + S.title)] });
  tracks.push(track(meta, S.title || 'Song'));
  const on = (ev, ch, m, v, t, d) => { ev.push({ t: Math.round(t), b: [0x90 | ch, m, v], o: 1 }, { t: Math.round(t + d), b: [0x80 | ch, m, 0], o: 0 }); };
  // rhythm guitar (voicings), channel 0
  const rg = [{ t: 0, b: [0xC0, 25] }]; for (let bi = 0; bi < totalBars(); bi++) { for (let s = 0; s < sp;) { const cd = chordAt(bi, s); if (!cd) break; if (cd.sym) { const v = voicingFor(cd.sym); if (v) v.frets.forEach((f, i) => { if (f != null) on(rg, 0, clamp(S.tuning[i] + S.capo + f, 0, 127), 72, (bi * sp + s) * TPS + i * 6, cd.len * TPS - 10); }); } s += Math.max(1, cd.len - cd.rel); } }
  tracks.push(track(rg, 'Rhythm guitar'));
  // lead / tab, channel 1
  const ld = [{ t: 0, b: [0xC1, 26] }]; flatBars().forEach(fb => { fb.bar.tab.forEach(n => { const next = fb.bar.tab.filter(o => o.st === n.st && o.s > n.s).sort((a, b) => a.s - b.s)[0], len = Math.max(1, (next ? next.s : sp) - n.s); on(ld, 1, clamp(n.f === 'x' ? S.tuning[n.st] + S.capo : noteMidi(n) + (n.t === '<>' ? 12 : 0), 0, 127), n.f === 'x' ? 40 : 90, (fb.idx * sp + n.s) * TPS, len * TPS - 8); }); });
  tracks.push(track(ld, 'Lead / tab'));
  // bass, channel 2
  const bs = [{ t: 0, b: [0xC2, 33] }]; if (S.band.bassOn) for (let bi = 0; bi < totalBars(); bi++) for (let s = 0; s < sp; s++) { const cd = chordAt(bi, s); if (!cd || !cd.sym) continue; const e = bassEvent(S.band.bassStyle, cd.sym, cd.rel, cd.len, cd.next); if (e) on(bs, 2, clamp(e.m, 0, 127), Math.round(60 + 50 * (e.v || .8)), (bi * sp + s) * TPS, Math.max(1, e.len) * TPS - 8); }
  tracks.push(track(bs, 'Bass'));
  // drums, channel 9
  const dr = []; if (S.band.drumsOn) { const pat = dpat(), L = Math.min(S.band.drumLen || 16, 32), gm = [36, 38, 42, 46, 39, 45]; for (let s = 0; s < total; s++) pat.forEach((row, r) => { const v = row[s % L]; if (v) on(dr, 9, gm[r], [0, 50, 90, 118][v], s * TPS, 60); }); }
  tracks.push(track(dr, 'Drums'));
  const head = [...str('MThd'), ...u32(6), ...u16(1), ...u16(tracks.length), ...u16(PPQ)];
  return new Blob([new Uint8Array(head.concat(...tracks))], { type: 'audio/midi' });
}

/* ---------- project JSON ---------- */
function exportProject() {
  const doc = { format: 'the-daily.studio-project', version: 1, app: BRAND.name + ' ' + VERSION, saved: new Date().toISOString(), song: S, rig: rigSnapshot(), settings: { a4: CFG.a4, flats: CFG.flats, rttMs: rttMs() } };
  download(((S.title || 'song').replace(/\W+/g, '_')) + '.daily-song.json', JSON.stringify(doc, null, 1), 'application/json'); toast('Project saved as plain JSON — readable by any text editor', 'ok');
}
function importProject(file) {
  const r = new FileReader(); r.onload = () => {
    try {
      const d = JSON.parse(r.result), s = d.song || d; if (!s || !Array.isArray(s.sections)) throw new Error('no sections');
      S = Object.assign(newSong(), s); S.band = Object.assign(newSong().band, s.band); S.mix = Object.assign(newSong().mix, s.mix); S.tuning = (s.tuning || S.tuning).slice();
      if (d.rig) try { rigApply(d.rig); } catch (e) { }
      T.loopA = 0; T.loopB = null; SEL.sec = 0; SEL.bar = 0; TE.sec = 0; TE.bi = 0; commit(true); bus.emit('song', 'reload'); toast('Imported “' + S.title + '”', 'ok');
    } catch (e) { toast('Import failed: ' + e.message, 'bad'); }
  }; r.readAsText(file);
}

/* ---------- lint ---------- */
function lintSong() {
  const L = [], add = (sev, m) => L.push({ sev, m });
  if (!S.title || /^Untitled/.test(S.title)) add('warn', 'Give the song a real title.'); if (!S.artist) add('warn', 'Artist / author field is empty.');
  if (!S.sections.length) add('err', 'No sections yet.');
  const names = {}; S.sections.forEach(s => { names[s.name] = (names[s.name] || 0) + 1; });
  Object.entries(names).forEach(([n, c]) => { if (c > 1) add('info', 'Section name “' + n + '” is used ' + c + '×; Ultimate Guitar prefers numbered labels (Verse 1, Verse 2).'); });
  S.sections.forEach(sec => {
    const where = '[' + sec.name + '] '; const used = new Set();
    if (!sec.bars.length) add('warn', where + 'has no bars.');
    sec.bars.forEach((b, i) => {
      const cs = barChords(b); if (!cs.length) add('warn', where + 'bar ' + (i + 1) + ' has no chord.');
      cs.forEach(c => { used.add(c); const p = parseChord(c); if (!p) add('err', where + 'bar ' + (i + 1) + ': “' + c + '” is not a chord this app understands.'); else if (!voicings(c, S.tuning, S.capo, 1).length) add('warn', where + '“' + c + '” has no playable voicing in this tuning/capo.'); });
      b.tab.forEach(n => { if (typeof n.f === 'number' && (n.f < 0 || n.f > 24)) add('err', where + 'bar ' + (i + 1) + ': fret ' + n.f + ' out of range.'); if (n.s >= spb()) add('err', where + 'bar ' + (i + 1) + ': note beyond bar length.'); });
      const keys = b.tab.map(n => n.s + ':' + n.st); if (new Set(keys).size !== keys.length) add('err', where + 'bar ' + (i + 1) + ' has two notes on one string at one position.');
    });
    const ly = (sec.lyrics || '').split('\n'); const lc = new Set();
    ly.forEach((l, i) => { let m; const re = /\[([^\]]+)\]/g; while ((m = re.exec(l))) { if (!parseChord(m[1])) add('warn', where + 'lyric line ' + (i + 1) + ': “[' + m[1] + ']” is not a chord (treated as lyric text).'); else lc.add(m[1]); if (!used.has(m[1]) && parseChord(m[1])) add('info', where + 'lyric chord ' + m[1] + ' is not in the bar chords.'); } const w = lyricPlain(l).length; if (w > 70) add('info', where + 'lyric line ' + (i + 1) + ' is ' + w + ' characters; consider splitting for UG.'); });
    if (sec.lyrics && sec.lyrics.trim() && !lc.size && used.size) add('info', where + 'lyrics have no inline [Chord] markers, so chord changes will not appear over words.');
  });
  if (S.bpm < 40 || S.bpm > 220) add('info', 'Tempo ' + S.bpm + ' bpm is extreme.'); if (S.capo > 9) add('warn', 'Capo above fret 9 is unusual.');
  if (!L.some(x => x.sev === 'err')) add('ok', 'No blocking problems found.'); return L;
}

/* ============================================================
   SONG PANE
   ============================================================ */
const SP = { lock: false };
const TUNED = { open: false };
/* custom per-string tuning: six note pickers + quick shifts. Everything downstream reads S.tuning, so voicings, tab, transcription and the tuner follow instantly. */
function tuningEditor() {
  const isCustom = !TUNINGS[S.tuningName];
  const d = h('details', { class: 'tun-ed', open: TUNED.open || isCustom, ontoggle: e => { TUNED.open = e.target.open; } }, h('summary', {}, 'Custom tuning · set each string' + (isCustom ? '  —  active' : '')));
  const row = h('div', { class: 'tun-row' });
  const opts = []; for (let m = 24; m <= 79; m++) opts.push(m);
  for (let i = 0; i < 6; i++) {
    const sel = h('select', { class: 'in', title: 'String ' + (6 - i) + (i === 0 ? ' (lowest)' : i === 5 ? ' (highest)' : ''), onchange: () => { const arr = S.tuning.slice(); arr[i] = +sel.value; setTuning(arr); } }, opts.map(m => h('option', { value: m }, tunNote(m))));
    sel.value = S.tuning[i]; row.append(h('label', { class: 'field' }, 'String ' + (6 - i), sel));
  }
  const shift = (n) => () => setTuning(S.tuning.map(m => m + n));
  const dropLow = () => { const a = S.tuning.slice(); a[0] -= 2; setTuning(a); };
  d.append(row, h('div', { class: 'row', style: { gap: '6px', marginTop: '8px', flexWrap: 'wrap' } },
    h('button', { class: 'btn sm', title: 'Tune every string down a half step', onclick: shift(-1) }, '↓ ½ step'), h('button', { class: 'btn sm', title: 'Tune every string up a half step', onclick: shift(1) }, '↑ ½ step'),
    h('button', { class: 'btn sm', title: 'Lower the lowest string a whole step (drop tuning)', onclick: dropLow }, 'Drop low string'),
    h('button', { class: 'btn sm', onclick: () => setTuning(TUNINGS['Standard (E A D G B E)'], 'Standard (E A D G B E)') }, 'Reset to standard'),
    h('span', { class: 'tiny muted' }, 'Six strings, notes E1–G5. Voicings, tab playback, the tuner, chord detection and transcription all follow it.')));
  return d;
}
function songField(label, el) { return h('label', { class: 'field' }, label, el); }
const SECNAMES = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Solo', 'Interlude', 'Outro'];
const secStart = si => S.sections.slice(0, si).reduce((a, s) => a + s.bars.length, 0);
/* Song pane = the song's structure map + chord library. Chords and lyrics are edited in the Refine panel (right sidebar). */
function buildSongPane() {
  const p = PANES.song; UI.songHint = h('div', { class: 'card sg-hint' }); UI.songMap = h('div', { class: 'card' }); UI.songChords = h('div', { class: 'card' });
  UI.refineBox = h('div', { class: 'refine' }); p.append(UI.songHint, UI.songMap, UI.songChords);
  UI.songHint.append(h('div', { class: 'card-b row' }, h('span', { class: 'grow small' }, h('b', {}, 'Chords & lyrics live in the Refine panel'), ' on the right, so you can keep them open next to the tab, the rig or a loaded track. Song details (title, tuning, capo…) are in the strip above.'), h('button', { class: 'btn sm primary', onclick: () => sideShow('refine') }, 'Open Refine ▸')));
  bus.on('song', () => { if (SP.lock) return; renderSong(); }); bus.on('sel', () => renderSong()); renderSong();
}
function renderSong() { if (!UI.songMap) return; renderSongMap(); renderRefine(); renderChordLibrary(); }
function secActions(sec, si) {
  const mv = d => { const j = si + d; if (j < 0 || j >= S.sections.length) return; [S.sections[si], S.sections[j]] = [S.sections[j], S.sections[si]]; SEL.sec = j; commit(); };
  const b = (txt, title, fn, cls) => h('button', { class: 'btn sm ' + (cls || ''), title, onclick: fn }, txt);
  return h('span', { class: 'row', style: { gap: '4px', flexWrap: 'nowrap' } },
    b('▶', 'Play from this section', () => { T.cursor = secStart(si) * spb(); if (T.playing) stopPlay(true); play(); }), b('↑', 'Move up', () => mv(-1)), b('↓', 'Move down', () => mv(1)),
    b('⧉', 'Duplicate section', () => { const c = JSON.parse(JSON.stringify(sec)); c.id = uid(); c.name += ' (copy)'; S.sections.splice(si + 1, 0, c); commit(); }),
    b('✕', 'Delete section', () => { if (S.sections.length > 1 || confirm('Delete the last section?')) { S.sections.splice(si, 1); SEL.sec = 0; commit(); } }, 'bad'));
}
function addSectionRow(tip) {
  const ns = h('select', { class: 'in', 'aria-label': 'Section to add', style: { width: '140px', fontFamily: 'var(--sans)' } }, SECNAMES.map(n => h('option', {}, n)));
  return h('div', { class: 'row', style: { gap: '8px', margin: '2px 0 10px' } }, h('b', { class: 'small' }, 'Add section'), ns,
    h('button', { class: 'btn primary sm', onclick: () => { const base = ns.value, n = S.sections.filter(s => s.name.startsWith(base)).length; const nm = base === 'Verse' || base === 'Chorus' ? base + ' ' + (n + 1) : n ? base + ' ' + (n + 1) : base; S.sections.push(mkSection(nm, ['', '', '', ''])); SEL.sec = S.sections.length - 1; commit(); } }, '＋ Add'),
    tip ? h('span', { class: 'muted small' }, tip) : null);
}
function renderSongMap() {
  const m = UI.songMap; m.innerHTML = ''; const sp = spb();
  m.append(h('h4', {}, 'Structure', h('span', { class: 'badge' }, totalBars() + ' bars · ' + fmtTime(totalBars() * sp * slotDur()))));
  const body = h('div', { class: 'card-b' }); const col = TL.col && TL.col.cv ? TL.col.cv : ['#0a9aa6', '#e4572e', '#8a5cf5', '#e0a31a', '#2e9d57'];
  S.sections.forEach((sec, si) => {
    const chords = [...new Set(sec.bars.flatMap(barChords))].slice(0, 8).join(' '), ly = (sec.lyrics || '').split('\n').find(l => l.trim());
    body.append(h('div', { class: 'secrow' + (SEL.sec === si ? ' on' : ''), onclick: e => { if (e.target.closest('button')) return; SEL.sec = si; SEL.bar = 0; TL.dirty = true; bus.emit('sel'); sideShow('refine'); } },
      h('i', { class: 'sw', style: { background: col[si % col.length] } }), h('b', { class: 'sn' }, sec.name), h('span', { class: 'tiny muted' }, sec.bars.length + ' bars'),
      h('span', { class: 'mono small sc' }, chords || '—'), h('span', { class: 'tiny muted sl' }, ly ? lyricPlain(ly).slice(0, 48) : ''), secActions(sec, si)));
  });
  body.append(addSectionRow('Tip: Theory ▸ Progressions (left) fills a section with a progression in this key.')); m.append(body);
}
/* ---------- Refine: the chord + lyric canvas, shown in the right sidebar ---------- */
const RF = { acc: null };
function renderRefine() {
  const box = UI.refineBox; if (!box) return; box.innerHTML = ''; if (RF.acc == null) RF.acc = CFG.rfAcc !== false;
  const tb = h('div', { class: 'rf-bar' }, h('b', { class: 'small' }, 'REFINE'), h('span', { class: 'tiny muted grow' }, S.sections.length + ' sections · ' + totalBars() + ' bars'),
    h('button', { class: 'btn sm' + (RF.acc ? ' on' : ''), title: 'On: only the selected section is open. Off: every section open.', onclick: () => { RF.acc = !RF.acc; CFG.rfAcc = RF.acc; saveCfg(); renderRefine(); } }, RF.acc ? 'One at a time' : 'All open'));
  tb.insertBefore(h('button', { class: 'btn sm primary', title: 'Paste a finished lyric sheet: [Verse] / [Chorus] headings become sections, with your chords placed over the words', onclick: () => liOpen() }, '📋 Paste lyrics'), tb.querySelector('.grow').nextSibling);
  box.append(tb); if (!box._li) { box._li = 1; liWire(box); }
  if (!S.sections.some(s => (s.lyrics || '').trim())) box.append(h('div', { class: 'card', style: { padding: '12px', margin: '0 0 10px' } }, h('b', { class: 'small' }, 'Lyrics already written?'), h('div', { class: 'tiny muted', style: { margin: '4px 0 8px' } }, 'Paste the whole sheet (headings like [Verse 1] and [Chorus] become sections) or drop a .txt file here. Your chords are placed over the words.'), h('button', { class: 'btn primary sm', onclick: () => liOpen() }, '📋 Paste lyrics…')));
  S.sections.forEach((sec, si) => box.append(sectionCard(sec, si, RF.acc && SEL.sec !== si)));
  box.append(addSectionRow());
}
function sectionCard(sec, si, compact) {
  const card = h('div', { class: 'card sec' + (SEL.sec === si ? ' sel' : '') });
  if (compact) {
    const chords = [...new Set(sec.bars.flatMap(barChords))].slice(0, 6).join(' '), ly = (sec.lyrics || '').split('\n').find(l => l.trim());
    card.append(h('div', { class: 'card-h sec-c', title: 'Open this section', onclick: () => { SEL.sec = si; SEL.bar = 0; TL.dirty = true; bus.emit('sel'); } }, h('b', {}, '▸ ' + sec.name), h('span', { class: 'tiny muted grow', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, sec.bars.length + ' bars · ' + (chords || '—') + (ly ? ' · ' + lyricPlain(ly).slice(0, 30) : ''))));
    return card;
  }
  const nameIn = h('input', { class: 'in', 'aria-label': 'Section name', value: sec.name, style: { width: '150px', fontFamily: 'var(--sans)', fontWeight: 800 }, onfocus: () => { SEL.sec = si; }, oninput: e => { sec.name = e.target.value; SP.lock = true; commit(false); SP.lock = false; } });
  card.append(h('div', { class: 'card-h' }, nameIn, secActions(sec, si)));
  const body = h('div', { class: 'card-b' }), row = h('div', { class: 'barrow' });
  sec.bars.forEach((bar, bi) => {
    const inp = h('input', { value: bar.chord, placeholder: '—', spellcheck: false, class: bar.chord && barChords(bar).some(c => !parseChord(c)) ? 'bad' : '', onfocus: () => { SEL.sec = si; SEL.bar = bi; },
      oninput: e => { bar.chord = e.target.value; e.target.classList.toggle('bad', barChords(bar).some(c => !parseChord(c))); SP.lock = true; commit(false); SP.lock = false; renderChordLibrary(); }, onchange: () => commit(true) });
    const rn = barChords(bar).map(c => { const pc = parseChord(c); return pc ? ['I', '♭II', 'II', '♭III', 'III', 'IV', '♭V', 'V', '♭VI', 'VI', '♭VII', 'VII'][(pc.root - S.key + 12) % 12] : '?'; }).join(' ');
    row.append(h('div', { class: 'barc' }, h('label', {}, (bi + 1) + (rn ? ' · ' + rn : '')), inp, h('div', { class: 'row', style: { gap: '2px' } },
      h('button', { class: 'btn sm', style: { padding: '0 5px', height: '16px', fontSize: '10px' }, title: 'Insert bar after', onclick: () => { sec.bars.splice(bi + 1, 0, newBar(bar.chord)); commit(); } }, '＋'),
      h('button', { class: 'btn sm', style: { padding: '0 5px', height: '16px', fontSize: '10px' }, title: 'Edit this bar in the Tab editor', onclick: () => { TE.sec = si; TE.bi = bi; dockGo('tab'); } }, '𝄞'),
      h('button', { class: 'btn sm bad', style: { padding: '0 5px', height: '16px', fontSize: '10px' }, title: 'Delete bar', onclick: () => { if (sec.bars.length > 1) { sec.bars.splice(bi, 1); commit(); } } }, '✕'))));
  });
  body.append(row, h('div', { class: 'tiny muted', style: { margin: '4px 0 10px' } }, 'Two chords in one bar: type them with a space (“Am G”). Slash chords (“C/G”), sus, add9, 7ths, 9ths, 11ths and 13ths are all supported.'));
  // lyrics
  const used = [...new Set(sec.bars.flatMap(barChords))].filter(c => parseChord(c));
  const ta = h('textarea', { class: 'lyr in', spellcheck: true, onpaste: liPaste, placeholder: 'Type lyrics. Put chords inline in square brackets right before the syllable they land on:\n[Am]Salt wind on the [F]water…', style: { fontFamily: 'var(--mono)' }, oninput: () => { sec.lyrics = ta.value; SP.lock = true; commit(false); SP.lock = false; refresh(); } }, sec.lyrics || '');
  const prev = h('div', { class: 'lyr-prev' }), ana = h('div', { class: 'small' });
  const ins = c => { const s = ta.selectionStart, e = ta.selectionEnd; ta.setRangeText('[' + c + ']', s, e, 'end'); ta.focus(); ta.dispatchEvent(new Event('input')); };
  const refresh = () => {
    prev.innerHTML = ''; (ta.value || '').split('\n').forEach(l => { const r = chordOverLine(l); if (r.hasChords) prev.append(h('span', { class: 'c' }, r.chordLine + '\n')); prev.append(r.text + '\n'); });
    const lines = (ta.value || '').split('\n'), sch = rhymeScheme(lines); ana.innerHTML = '';
    const tb = h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, 'Line'), h('th', {}, 'Syl.'), h('th', {}, 'Rhyme'))); let tot = 0, n = 0;
    lines.forEach((l, i) => { if (!l.trim()) return; const sy = lineSyl(l); tot += sy; n++; tb.append(h('tr', {}, h('td', { style: { fontFamily: 'var(--sans)' } }, lyricPlain(l).slice(0, 52)), h('td', {}, String(sy)), h('td', {}, sch[i] || ''))); });
    ana.append(n ? tb : h('span', { class: 'muted' }, 'No lyric lines yet.'), n ? h('div', { class: 'tiny muted', style: { marginTop: '4px' } }, 'Scheme: ' + sch.filter(Boolean).join('') + ' · mean ' + (tot / n).toFixed(1) + ' syllables/line (heuristic count)') : '');
  };
  body.append(h('div', { class: 'row', style: { gap: '6px', marginBottom: '5px' } }, h('b', { class: 'small' }, 'Lyrics'), h('span', { class: 'muted tiny' }, 'insert chord at cursor:'), h('div', { class: 'pal' }, used.map(c => h('button', { class: 'btn sm', onclick: () => ins(c) }, c)))),
    h('div', { class: 'lyr-grid' }, ta, prev), h('details', { style: { marginTop: '8px' } }, h('summary', { class: 'small muted', style: { cursor: 'pointer' } }, 'Syllable & rhyme analysis'), ana));
  refresh(); card.append(body); return card;
}
function renderChordLibrary() {
  const c = UI.songChords; if (!c) return; c.innerHTML = ''; const all = [...new Set(S.sections.flatMap(s => s.bars.flatMap(barChords)))].filter(x => parseChord(x));
  c.append(h('h4', {}, 'Chord library · voicings for ' + S.tuningName.replace(/\s*\(.*$/, '') + (S.capo ? ', capo ' + S.capo : '')));
  const b = h('div', { class: 'card-b' }); if (!all.length) b.append(h('span', { class: 'muted' }, 'Add chords to bars to see voicings.'));
  all.forEach(sym => {
    const vs = voicings(sym, S.tuning, S.capo, 8); if (!vs.length) return b.append(h('div', { class: 'small', style: { marginBottom: '6px' } }, h('b', {}, sym), ' — no playable voicing in this tuning'));
    const cur = S.voicePref[sym] || 0, row = h('div', { class: 'vcs', style: { marginBottom: '8px', alignItems: 'center' } }, h('b', { style: { font: '800 15px var(--mono)', minWidth: '58px' } }, sym));
    vs.forEach((v, i) => row.append(h('div', { class: 'vc' + (i === cur ? ' on' : ''), title: 'Use this voicing for playback and the tab auto-fill (' + v.frets.map(f => f == null ? 'x' : f).join('-') + ')', onclick: () => { S.voicePref[sym] = i; commit(false); renderChordLibrary(); } }, chordSVG(v, { w: 64, h: 80 }), h('div', {}, v.frets.map(f => f == null ? 'x' : f).join(''))))); b.append(row);
  });
  c.append(b);
}

/* ============================================================
   BAND PANE
   ============================================================ */
function buildBandPane() {
  const p = PANES.band; UI.bandBox = h('div'); p.append(UI.bandBox); bus.on('song', e => { if (e === 'reload' || paneVisible('band')) renderBand(); }); bus.on('dock', id => { if (id === 'band') renderBand(); }); renderBand();
}
function renderBand() {
  const B = S.band, bx = UI.bandBox; if (!bx) return; const ae = document.activeElement; if (ae && ae.type === 'range' && bx.contains(ae)) return; bx.innerHTML = '';
  const sel = (label, opts, val, fn, w) => songField(label, h('select', { style: { width: (w || 150) + 'px' }, onchange: e => { fn(e.target.value); } }, opts.map(o => h('option', { selected: o === val }, o))));
  const tog = (label, k) => h('button', { class: 'btn sm' + (B[k] ? ' on' : ''), onclick: e => { B[k] = !B[k]; commit(false); e.target.classList.toggle('on', B[k]); } }, label);
  const drums = h('div', { class: 'card' }, h('h4', {}, 'Drums ', tog('Enabled', 'drumsOn')), h('div', { class: 'card-b' },
    h('div', { class: 'row', style: { gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '8px' } }, sel('Kit', Object.keys(KITS), B.kit, v => { B.kit = v; commit(false); }), sel('Pattern', Object.keys(DPATS), B.patName, v => { setDrumPattern(v); renderBand(); }, 170),
      songField('Length (steps)', h('select', { onchange: e => { B.drumLen = +e.target.value; commit(false); renderBand(); } }, [8, 12, 16, 24, 32].map(n => h('option', { selected: n === (B.drumLen || 16) }, n)))),
      h('button', { class: 'btn sm', onclick: () => { B.pat = DROWS.map(() => new Array(32).fill(0)); commit(false); renderBand(); } }, 'Clear'), h('button', { class: 'btn sm', onclick: () => { const pat = dpat(); pat.forEach(r => r.forEach((v, i) => { if (v && Math.random() < .25) r[i] = 0; else if (!v && Math.random() < .04) r[i] = 1; })); commit(false); renderBand(); } }, '🎲 Mutate'),
      h('span', { class: 'tiny muted' }, 'Click a step to cycle: off → ghost → normal → accent')),
    stepGrid()));
  const bass = h('div', { class: 'card' }, h('h4', {}, 'Bass ', tog('Enabled', 'bassOn')), h('div', { class: 'card-b row', style: { gap: '10px', flexWrap: 'wrap' } }, sel('Style', BASS_STYLES, B.bassStyle, v => { B.bassStyle = v; commit(false); }), sel('Tone', ['Round', 'Sub', 'Pick', 'Muted Pluck'], B.bassTone, v => { B.bassTone = v; commit(false); })));
  const comp = h('div', { class: 'card' }, h('h4', {}, 'Rhythm guitar ', tog('Enabled', 'compOn')), h('div', { class: 'card-b row', style: { gap: '10px', flexWrap: 'wrap' } }, sel('Strum / arpeggio pattern', Object.keys(STRUMS), B.compStyle, v => { B.compStyle = v; commit(false); }, 190), sel('Instrument', ['Steel', 'Nylon', 'Electric', 'Muted Pluck'], B.compInst, v => { B.compInst = v; commit(false); }),
    h('span', { class: 'tiny muted' }, 'Voicings come from the Chord library (Song panel) in the current tuning and capo.')));
  const lead = h('div', { class: 'card' }, h('h4', {}, 'Tab playback (lead) ', tog('Enabled', 'leadOn')), h('div', { class: 'card-b row', style: { gap: '10px', flexWrap: 'wrap' } }, sel('Instrument', ['Nylon', 'Steel', 'Electric', 'Muted Pluck'], B.leadInst, v => { B.leadInst = v; commit(false); }),
    songField('Humanize', h('input', { type: 'range', min: 0, max: 1, step: .05, value: CFG.humanize, oninput: e => { CFG.humanize = +e.target.value; saveCfg(); } })), songField('Swing', h('input', { type: 'range', min: 0, max: .5, step: .01, value: S.swing, oninput: e => { S.swing = +e.target.value; commit(false); } }))));
  bx.append(ensembleCard(), drums, bass, comp, lead);
}
function ensembleCard() {
  const B = S.band, info = {
    drums: ['🥁', 'Drums', 'drumsOn', () => B.kit + ' · ' + B.patName, () => Object.keys(DPATS), () => B.patName, v => { setDrumPattern(v); }],
    bass: ['〰', 'Bass', 'bassOn', () => B.bassStyle + ' · ' + B.bassTone, () => BASS_STYLES, () => B.bassStyle, v => { B.bassStyle = v; commit(false); }],
    rhythm: ['🎸', 'Rhythm guitar', 'compOn', () => B.compStyle + ' · ' + B.compInst, () => Object.keys(STRUMS), () => B.compStyle, v => { B.compStyle = v; commit(false); }],
    lead: ['✦', 'Lead (tab playback)', 'leadOn', () => 'plays your tab · ' + B.leadInst, () => ['Nylon', 'Steel', 'Electric', 'Muted Pluck'], () => B.leadInst, v => { B.leadInst = v; commit(false); }]
  };
  const tiles = h('div', { class: 'ens' });
  Object.keys(info).forEach(id => {
    const [ic, nm, key, sub, opts, cur, set] = info[id], m = S.mix[id], t = h('div', { class: 'etile' + (B[key] ? ' on' : '') });
    const pw = h('button', { class: 'epower', title: 'Enable / disable ' + nm, onclick: () => { toggleBand(key); } }, '⏻');
    const sl = h('input', { type: 'range', min: 0, max: 1.4, step: .01, value: m.g, title: 'Level', style: { flex: 1 }, oninput: e => { m.g = +e.target.value; applyMix(); commit(false); } });
    t.append(h('div', { class: 'eh' }, pw, h('b', {}, ic + ' ' + nm), h('button', { class: 'btn sm' + (m.m ? ' on' : ''), title: 'Mute (keeps it enabled)', onclick: e => { m.m = m.m ? 0 : 1; e.target.classList.toggle('on', !!m.m); applyMix(); commit(false); } }, 'M'), h('button', { class: 'btn sm' + (m.s ? ' on' : ''), title: 'Solo', onclick: e => { m.s = m.s ? 0 : 1; e.target.classList.toggle('on', !!m.s); applyMix(); commit(false); } }, 'S')),
      h('div', { class: 'ebody', style: { display: 'flex', flexDirection: 'column', gap: '7px' } }, h('div', { class: 'sub' }, sub()),
        h('select', { class: 'in', style: { fontFamily: 'var(--sans)' }, onchange: e => { set(e.target.value); renderBand(); } }, opts().map(o => h('option', { selected: o === cur() }, o))),
        h('div', { class: 'row', style: { gap: '6px', flexWrap: 'nowrap' } }, h('span', { class: 'tiny muted' }, 'LEVEL'), sl)));
    tiles.append(t);
  });
  const mixes = h('div', { class: 'row', style: { gap: '6px', margin: '0 0 10px' } }, h('span', { class: 'tiny muted', style: { fontWeight: 800, letterSpacing: '.1em' } }, 'REHEARSAL MIX'), REHEARSAL.map(([n, c]) => h('button', { class: 'btn sm', title: 'Set who plays with you', onclick: () => setRehearsal(c) }, n)));
  return h('div', {}, h('div', { class: 'small muted', style: { margin: '0 0 8px', lineHeight: 1.5 } }, 'The band is always one click away: the strip above the panels and the ⏻ on each arrangement lane switch the same instruments. Hotkeys: ', h('kbd', {}, 'D'), ' drums · ', h('kbd', {}, 'B'), ' bass · ', h('kbd', {}, 'G'), ' rhythm guitar · ', h('kbd', {}, 'T'), ' lead tab.'), tiles, mixes);
}
function stepGrid() {
  const B = S.band, L = Math.min(B.drumLen || 16, 32), pat = dpat(), g = h('div', { class: 'dgrid', style: { gridTemplateColumns: '78px repeat(' + L + ',minmax(14px,1fr))' } }); UI.steps = [];
  DROWS.forEach((name, r) => {
    g.append(h('div', { class: 'lab' }, name));
    for (let i = 0; i < L; i++) {
      if (!pat[r]) pat[r] = new Array(32).fill(0);
      const st = h('button', { class: 'step' + (i % 4 === 0 ? ' g4' : '') + ' v' + (pat[r][i] || 0), title: name + ' · step ' + (i + 1), onclick: () => {
        pat[r][i] = ((pat[r][i] || 0) + 1) % 4; st.className = 'step' + (i % 4 === 0 ? ' g4' : '') + ' v' + pat[r][i]; B.patName = B.patName.replace(/ \(edited\)$/, '') + ' (edited)'; commit(false);
        if (pat[r][i] && E.ready) drumHit(r, E.ctx.currentTime + .01, pat[r][i]);
      } }); g.append(st);
    }
  }); return g;
}

/* ============================================================
   EXPORT PANE
   ============================================================ */
const EX = { fmt: 'ug' };
function buildExportPane() {
  const p = PANES.exp; UI.exOut = h('textarea', { class: 'in', readOnly: true, spellcheck: false, style: { width: '100%', height: '340px', fontFamily: 'var(--mono)', fontSize: '12px', whiteSpace: 'pre', overflow: 'auto' } });
  UI.exLint = h('div', { class: 'small' }); const opts = { header: true, tabs: true, lyrics: true, tags: true, bars: true };
  const chk = (k, label) => h('label', { class: 'chk', style: { display: 'flex', gap: '5px', alignItems: 'center', fontSize: '12px', fontWeight: 600 } }, h('input', { type: 'checkbox', checked: opts[k], onchange: e => { opts[k] = e.target.checked; if (k === 'tags') { CFG.ugTags = opts[k]; saveCfg(); } gen(); } }), label);
  opts.tags = CFG.ugTags !== false;
  const seg = h('div', { class: 'seg' }, [['ug', 'Ultimate Guitar'], ['cp', 'ChordPro'], ['ly', 'Lyrics only'], ['tab', 'Tab only']].map(([k, n]) => h('button', { class: k === EX.fmt ? 'on' : '', onclick: e => { EX.fmt = k; $$('button', seg).forEach(b => b.classList.toggle('on', b === e.target)); gen(); } }, n)));
  const gen = () => { UI.exOut.value = EX.fmt === 'ug' ? buildUG(opts) : EX.fmt === 'cp' ? buildChordPro() : EX.fmt === 'ly' ? buildLyricsOnly() : S.sections.filter(hasTab).map(s => '[' + s.name + ']\n' + renderTabBars(s.bars)).join('\n\n') + '\n'; const L = lintSong(); UI.exLint.innerHTML = ''; L.forEach(x => UI.exLint.append(h('div', { style: { color: x.sev === 'err' ? 'var(--bad)' : x.sev === 'warn' ? 'var(--warn)' : x.sev === 'ok' ? 'var(--good)' : 'var(--muted)', padding: '1px 0' } }, (x.sev === 'err' ? '✕ ' : x.sev === 'warn' ? '⚠ ' : x.sev === 'ok' ? '✓ ' : 'ⓘ ') + x.m))); };
  const fn = ext => (S.title || 'song').replace(/\W+/g, '_') + ext;
  const imp = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, onchange: e => { if (e.target.files[0]) importProject(e.target.files[0]); e.target.value = ''; } });
  p.append(h('div', { class: 'card' }, h('h4', {}, 'Ultimate Guitar / chart export'), h('div', { class: 'card-b' },
    h('div', { class: 'row', style: { gap: '12px', marginBottom: '8px', flexWrap: 'wrap' } }, seg, chk('header', 'Header'), chk('bars', 'Chord line'), chk('lyrics', 'Lyrics'), chk('tabs', 'Tab'), chk('tags', '[ch] / [tab] tags'), h('span', { class: 'grow' }),
      h('button', { class: 'btn primary', onclick: () => copyText(UI.exOut.value) }, 'Copy'), h('button', { class: 'btn', onclick: () => download(fn(EX.fmt === 'cp' ? '.cho' : '.txt'), UI.exOut.value) }, 'Download')),
    UI.exOut, h('div', { class: 'tiny muted', style: { marginTop: '5px' } }, 'Paste into the Ultimate Guitar submission editor. Chords use [ch] tags and monospaced blocks use [tab] so alignment survives. Turn tags off for plain text.'))),
    h('div', { class: 'card' }, h('h4', {}, 'Submission lint'), h('div', { class: 'card-b' }, UI.exLint)),
    h('div', { class: 'card' }, h('h4', {}, 'Files'), h('div', { class: 'card-b row', style: { gap: '8px', flexWrap: 'wrap' } },
      h('button', { class: 'btn', onclick: () => { download(fn('.mid'), buildMidi()); toast('MIDI saved (rhythm, lead, bass, drums on separate tracks)', 'ok'); } }, '⤓ MIDI'),
      h('button', { class: 'btn', onclick: () => bounceMaster() }, '⤓ Bounce master WAV (real time)'),
      h('button', { class: 'btn', title: 'One WAV per band part (drums, bass, rhythm, lead). Plays the song once for each, in real time.', onclick: () => bounceAllParts() }, '⤓ Each band part (WAVs)'),
      h('button', { class: 'btn', onclick: () => { if (!TAKES.length) return toast('No takes recorded yet', 'warn'); TAKES.forEach((t, i) => setTimeout(() => dlTake(t), i * 700)); } }, '⤓ All takes (dry DI + wet)'),
      h('button', { class: 'btn', onclick: exportProject }, '⤓ Project JSON (Ctrl+S)'), h('button', { class: 'btn', onclick: () => imp.click() }, '⤒ Import project'), imp,
      h('button', { class: 'btn bad', onclick: () => { if (confirm('Replace the current song with the demo? (Undo with Ctrl+Z)')) { S = demoSong(); commit(true); bus.emit('song', 'reload'); } } }, 'Load demo song'),
      h('button', { class: 'btn bad', onclick: () => { if (confirm('Start a blank song? (Undo with Ctrl+Z)')) { S = newSong(); S.sections = [mkSection('Verse 1', ['', '', '', ''])]; commit(true); bus.emit('song', 'reload'); } } }, 'New blank song'))));
  bus.on('song', () => { if (paneVisible('exp')) gen(); }); bus.on('dock', id => { if (id === 'exp') gen(); }); gen();
}

/* >>> parts/09-ui-viz.js */
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
  UI.fbMode = sel([['scale', 'Scale'], ['chord', 'Chord tones (current chord)'], ['both', 'Scale + chord'], ['none', 'Live only']], FB.mode, v => { FB.mode = v; renderFret(); });
  const lab = sel([['notes', 'Note names'], ['degrees', 'Scale degrees'], ['frets', 'Fret numbers']], CFG.fretNames, v => { CFG.fretNames = v; saveCfg(); renderFret(); });
  p.append(h('div', { class: 'card' }, h('h4', {}, 'Fretboard · tuning-, capo- and scale-aware'), h('div', { class: 'card-b' },
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', marginBottom: '8px' } }, h('span', { class: 'small muted' }, 'Root'), UI.fbRoot, UI.fbScale, UI.fbMode, lab,
      h('button', { class: 'btn sm' + (FB.follow ? ' on' : ''), onclick: e => { FB.follow = !FB.follow; e.target.classList.toggle('on', FB.follow); }, title: 'Chord tones follow the chord under the playhead' }, 'Follow song'),
      h('button', { class: 'btn sm', onclick: () => { CFG.left = !CFG.left; saveCfg(); renderFret(); } }, '⇄ Handedness'), h('span', { class: 'grow' }), h('span', { class: 'chip', id: 'fbinfo' })),
    UI.fb = h('div', { class: 'fbscroll' }), h('div', { class: 'tiny muted', style: { marginTop: '6px' } }, 'Click any position to hear it. Orange ring = what you are playing right now (audio f0). Dashed ring = where the camera believes your fretting fingers are. Root = filled hexagon.'))));
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
  if (!FB.nodes.length) return; const root = FB.root, left = CFG.left; let chordPcs = new Set(), chordRoot = null, chName = '';
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
const VZ = { mode: CFG.visMode || 'hex', cam: false, spec: null, pulses: [], hexes: null, last: 0, fd: null, td: null, sm: null, t: 0, ring: [] };
const VMODES = [['hex', 'Hex Resonance'], ['tunnel', 'Hex Tunnel'], ['spectro', 'Spectrogram'], ['chroma', 'Chroma Wheel'], ['scope', 'Oscilloscope'], ['strings', 'String Field']];
function buildVisPane() {
  const p = PANES.vis; p.classList.add('flex');
  const bar = h('div', { class: 'row', style: { gap: '8px', marginBottom: '8px', flexWrap: 'wrap' } },
    h('div', { class: 'seg' }, VMODES.map(([k, n]) => h('button', { class: k === VZ.mode ? 'on' : '', 'data-m': k, onclick: e => { vzSetMode(k); $$('.seg [data-m]', bar).forEach(b => b.classList.toggle('on', b === e.target)); } }, n))),
    h('select', { class: 'in', style: { width: 'auto', fontFamily: 'var(--sans)' }, title: 'Analysis source', onchange: e => { VZ.src = e.target.value; } }, [['auto', 'Source: auto (follows playback)'], ['rig', 'Source: guitar after the rig'], ['master', 'Source: master mix'], ['di', 'Source: what the detector hears'], ['vox', 'Source: vocal microphone']].map(([v, n]) => h('option', { value: v }, n))),
    h('button', { class: 'btn sm', id: 'vzGoStage', title: 'Full-screen visuals with the camera: you in front of the hexagons', onclick: () => goOnStage() }, '🎥 Go on stage'),
    h('button', { class: 'btn sm' + (VZ.cam ? ' on' : ''), id: 'vzCamBtn', title: 'Put yourself center stage: turns the camera on behind the visuals', onclick: () => vzCamPress() }, '📷 Camera backdrop'), camFxBox(),
    h('button', { class: 'btn sm' + (CFG.vzNeck !== false ? ' on' : ''), id: 'vzNeckBtn', title: 'Show a small guitar neck on the visuals: what is playing, what is coming next, the note you are singing', onclick: e => { CFG.vzNeck = CFG.vzNeck === false; saveCfg(); e.currentTarget.classList.toggle('on', CFG.vzNeck !== false); } }, '🎸 Neck'),
    h('button', { class: 'btn sm', onclick: () => { const w = UI.vwrap; (document.fullscreenElement ? document.exitFullscreen() : w.requestFullscreen && w.requestFullscreen()); } }, '⛶ Stage mode'));
  UI.vwrap = h('div', { class: 'vwrap', style: { flex: 1, minHeight: '320px' } }, UI.vcv = h('canvas', { class: 'vcanvas', style: { height: '100%', minHeight: '320px' } }));
  p.append(bar, UI.vwrap); new ResizeObserver(() => { const d = (window.devicePixelRatio || 1) * (CFG.vq || 1), w = UI.vcv.clientWidth, hh = UI.vcv.clientHeight; if (w && (UI.vcv.width !== Math.floor(w * d) || UI.vcv.height !== Math.floor(hh * d))) { UI.vcv.width = Math.floor(w * d); UI.vcv.height = Math.floor(hh * d); VZ.spec = null; VZ.hexes = null; } }).observe(UI.vwrap);
  bus.on('onset', () => { VZ.pulses.push({ t: performance.now(), a: clamp((AN.rms + 50) / 40, .2, 1) }); if (VZ.pulses.length > 12) VZ.pulses.shift(); });
}
const vcol = () => { const cs = getComputedStyle(document.documentElement); return { a: cs.getPropertyValue('--accent').trim(), b: cs.getPropertyValue('--accent2').trim(), c: cs.getPropertyValue('--cv3').trim(), d: cs.getPropertyValue('--cv4').trim() }; };
/** 'auto' follows what is sounding: the mix while the song, a hum or a backing track plays, the guitar rig otherwise */
const vzPlaying = () => T.playing || (typeof STP !== 'undefined' && STP.playing);
function visAna() { const s = VZ.src || 'auto'; if (s === 'vox' && E.anaVox) return E.anaVox; return s === 'master' || (s === 'auto' && vzPlaying()) ? E.anaMaster : s === 'di' ? E.anaDI : E.anaRig; }
function drawVis(cvo, o) {
  o = o || {}; const cv = cvo || UI.vcv; if (!cv || !E.ready || (!cvo && !paneVisible('vis'))) return; const MODE = o.mode || VZ.mode; const g = cv.getContext('2d'), W = cv.width, H = cv.height, now = performance.now(), dt = Math.min(.1, (now - (VZ.last || now)) / 1000); VZ.last = now; VZ.t += dt;
  const an = visAna(); if (!an) return; if (!VZ.fd || VZ.fd.length !== an.frequencyBinCount) VZ.fd = new Float32Array(an.frequencyBinCount); an.getFloatFrequencyData(VZ.fd); const fd = VZ.fd, bh = E.ctx.sampleRate / an.fftSize;
  const light = CFG.theme === 'light', C = o.C || vcol();
  // background (always dark stage for contrast, tinted by theme)
  if (MODE !== 'spectro' && MODE !== 'kaleido') { g.globalAlpha = o.bgA == null ? 1 : o.bgA; g.fillStyle = light && !cvo ? '#0c1a1b' : '#050b0c'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  const camOn = !!((o.cam != null ? o.cam : VZ.cam) && CAM.video && CAM.video.readyState >= 2 && MODE !== 'spectro');
  if (camOn && (CFG.camFx || 'over') === 'over') { g.save(); g.globalAlpha = .32; if (CFG.mirror) { g.translate(W, 0); g.scale(-1, 1); } const vr = CAM.video.videoWidth / CAM.video.videoHeight, cr = W / H; let dw = W, dh = H, dx = 0, dy = 0; if (vr > cr) { dw = H * vr; dx = (W - dw) / 2; } else { dh = W / vr; dy = (H - dh) / 2; } g.drawImage(CAM.video, dx, dy, dw, dh); g.restore(); }
  const lvl = x => clamp((x + 88 + (o.gain || 0)) / 62, 0, 1), bin = f => clamp(Math.round(f / bh), 1, fd.length - 1);
  const energy = (() => { let s = 0, n = 0; for (let k = bin(80); k < bin(5000); k += 2) { s += lvl(fd[k]); n++; } return s / n; })();
  const pulse = VZ.pulses.reduce((a, p) => Math.max(a, (1 - (now - p.t) / 900) * p.a), 0);
  if (MODE === 'hex') drawHex(g, W, H, fd, bh, lvl, C, pulse);
  else if (MODE === 'tunnel') drawTunnel(g, W, H, energy, C, pulse, dt);
  else if (MODE === 'spectro') drawSpectro(g, W, H, fd, bin, lvl, C);
  else if (MODE === 'chroma') drawChroma(g, W, H, C);
  else if (MODE === 'scope') drawScope(g, W, H, C);
  else if (MODE === 'strings') drawStringField(g, W, H, fd, bin, lvl, C);
  else if (typeof stageExtra === 'function') stageExtra(MODE, g, W, H, { fd, bin, lvl, C, pulse, energy, dt, o });
  if (camOn && !cvo) camTop(g, W, H);
  if (MODE === 'halo' && !cvo) haloFront(g);   // stage draws its own camera layer after trails and kaleidoscope
  if (!cvo && CFG.vzNeck !== false) { const r = neckRect(W, H); drawMiniNeck(g, r[0], r[1], r[2], r[3], { C }); }
  if (o.noText) return;
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = `${Math.round(11 * H / 400 + 6)}px ui-monospace,Menlo,monospace`; g.textBaseline = 'top';
  if (AN.midi != null && AN.active) { g.fillStyle = 'rgba(255,255,255,.85)'; g.font = `800 ${Math.round(28 * Math.min(W, H * 2) / 900 + 10)}px ui-monospace,Menlo,monospace`; g.fillText(pcName(AN.midi) + (Math.floor(AN.midi / 12) - 1) + '  ' + (AN.cents >= 0 ? '+' : '') + AN.cents.toFixed(0) + '¢', 14, 12); }
  if (AN.chord && AN.chord[0] && AN.active) { g.fillStyle = C.b; g.font = `800 ${Math.round(20 * Math.min(W, H * 2) / 900 + 8)}px ui-monospace,Menlo,monospace`; g.fillText(AN.chord[0].sym, 14, H * .13 + 20); }
}
function drawHex(g, W, H, fd, bh, lvl, C, pulse) {
  const R = Math.max(14, Math.min(W, H) / 15), dx = R * Math.sqrt(3), dy = R * 1.5, cols = Math.ceil(W / dx) + 2, rows = Math.ceil(H / dy) + 2, cx = W / 2, cy = H / 2, maxd = Math.hypot(cx, cy);
  if (!VZ.sm || VZ.sm.length !== cols * rows) VZ.sm = new Float32Array(cols * rows); const fmin = 70, fmax = 7000, lr = Math.log(fmax / fmin);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c * dx + (r % 2 ? dx / 2 : 0) - dx / 2, y = r * dy - R / 2, d = Math.hypot(x - cx, y - cy) / maxd, ang = (Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI);
    const f = fmin * Math.exp(lr * clamp(d * .92 + ((ang * 5) % 1) * .08, 0, 1)), k = clamp(Math.round(f / bh), 1, fd.length - 1), v = lvl(Math.max(fd[k], fd[k + 1] || -120)), i = r * cols + c;
    VZ.sm[i] = Math.max(v, VZ.sm[i] * .86 - .004); const s = VZ.sm[i], ring = pulse * Math.max(0, 1 - Math.abs(d - (1 - pulse) * 1.05) * 6);
    const amb = .2 * Math.pow(Math.max(0, Math.sin(d * 11 - performance.now() / 780)), 2) * Math.max(0, 1 - d * .9), a = clamp(s * 1.15 + ring * .8 + amb, 0, 1); if (a < .03) { g.strokeStyle = 'rgba(120,170,170,.07)'; g.lineWidth = 1; hexPath(g, x, y, R * .94); g.stroke(); continue; }
    g.fillStyle = mixc(C.a, C.b, clamp(s * 1.4 - .15 + ring, 0, 1), a * .92); hexPath(g, x, y, R * (.5 + .46 * Math.min(1, a))); g.fill();
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
function drawStringField(g, W, H, fd, bin, lvl, C) {
  const n = 6, mh = H / (n + 1); S.tuning.forEach((open, st) => {
    const y = H - (st + 1) * mh, f0 = mtof(open + S.capo); let e = 0; for (let h_ = 1; h_ <= 4; h_++) e = Math.max(e, lvl(fd[bin(f0 * h_)]) / Math.sqrt(h_)); const live = AN.midi != null && AN.midi % 12 === (open + S.capo) % 12 ? 1 : 0;
    const amp = (6 + e * mh * .75) * (1 + live * .3), ph = VZ.t * (4 + st * 1.3) * Math.PI; g.lineWidth = 1.2 + (6 - st) * .45; g.strokeStyle = mixc(C.a, C.b, e, .35 + .6 * e); g.shadowColor = C.a; g.shadowBlur = e * 16; g.beginPath();
    for (let x = 0; x <= W; x += 6) { const u = x / W, yy = y + Math.sin(u * Math.PI) * Math.sin(u * Math.PI * (2 + (st % 3)) + ph) * amp * e; x ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke(); g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '700 12px ui-monospace,monospace'; g.fillText(pcName(open + S.capo), 8, y - 16);
  });
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
    UI.camWrap, h('div', { class: 'tiny muted', style: { marginTop: '6px', lineHeight: 1.5 } }, h('b', {}, 'Calibrate: '), 'frame the neck, press ⌖, then click (1) the nut on the LOW-E string, (2) the 12th-fret marker on the LOW-E string, (3) the nut on the HIGH-e string. Fret spacing uses the 12-TET rule d(n)=L·(1−2^(−n/12)) with L = 2·|nut→12|; strings are assumed parallel (perspective error grows with camera tilt — film head-on). Camera frames never leave this page; hand tracking downloads its model from a CDN only if you choose it.'))),
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
    await setupTracker(); if (!CAM.loopOn) { CAM.loopOn = true; requestAnimationFrame(camLoop); }
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
    } catch (e) { console.warn('MediaPipe unavailable', e); toast('Hand model could not load (offline or blocked) — using motion-energy mode', 'warn'); CAM.track = 'motion'; }
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
  else { const t = h('table', { class: 'tbl' }, h('tr', {}, ['Take', 'Dur', 'Peak', 'RMS', 'Tempo', 'Preset', '|Cents|', 'Timing σ'].map(x => h('th', {}, x)))); TAKES.forEach(x => t.append(h('tr', {}, [x.name, f(x.dur) + ' s', f(x.peak) + ' dB', f(x.rms) + ' dB', x.bpm, x.preset || '', x.stats && x.stats.centsAbs != null ? x.stats.centsAbs : '—', x.stats && x.stats.timingSD != null ? x.stats.timingSD : '—'].map(c => h('td', {}, String(c)))))); tk.append(t); }
}
function exportSession() {
  const doc = { format: 'the-daily.studio-session', version: 1, saved: new Date().toISOString(), app: BRAND.name + ' ' + VERSION, song: { title: S.title, bpm: S.bpm, tuning: S.tuningName, capo: S.capo, key: keyName() },
    engine: { sampleRate: E.ready ? E.ctx.sampleRate : null, baseLatency: E.ready ? E.ctx.baseLatency : null, outputLatency: E.ready ? E.ctx.outputLatency : null, rttMs: rttMs(), rttMeasured: CFG.rtt != null, worklet: E.worklet, a4: CFG.a4, inputSettings: E.inSettings || null },
    stats: { notes: STAT.notes, onsets: STAT.onsets, activeSeconds: STAT.activeS, pitchClassSeconds: STAT.pcDur, perNoteCents: STAT.noteCents, timingMs: STAT.timing, vibratoEvents: STAT.vibN, clipWarnings: STAT.clipF, key: AN.key, cameraAgreement: { compared: STAT.fuseT, agreed: STAT.fuseA }, fretUsage: CAM.fretHist },
    takes: TAKES.map(t => ({ name: t.name, durationS: t.dur, peakDb: t.peak, rmsDb: t.rms, bpm: t.bpm, preset: t.preset, stats: t.stats })), notebook: store.get('notebook', '') };
  download('the-daily.studio_session_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json', JSON.stringify(doc, null, 1), 'application/json'); toast('Session record saved (plain JSON + CSV keep the data readable without this app)', 'ok');
}

/* >>> parts/09b-tx-engine.js */
/* ============================================================
   Part 09b · Polyphonic transcription engine (pure DSP, no DOM)
   Audio → onsets → onset-synchronous spectral-difference multi-pitch (iterative estimate-and-cancel)
   → quantization → string/fret Viterbi with chord-voicing + camera priors → techniques.
   ============================================================ */
const TXP = {}, TXH = {};
function txPlan(n) {
  let p = TXP[n]; if (p) return p; const cos = new Float64Array(n >> 1), sin = new Float64Array(n >> 1), rev = new Uint32Array(n), bits = Math.round(Math.log2(n));
  for (let k = 0; k < n >> 1; k++) { const a = -2 * Math.PI * k / n; cos[k] = Math.cos(a); sin[k] = Math.sin(a); }
  for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b); rev[i] = r; }
  return TXP[n] = { cos, sin, rev, re: new Float64Array(n), im: new Float64Array(n) };
}
function txFFT(p) {
  const { re, im, cos, sin, rev } = p, n = re.length;
  for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let size = 2; size <= n; size <<= 1) { const half = size >> 1, step = n / size; for (let i = 0; i < n; i += size) for (let j = 0, k = 0; j < half; j++, k += step) { const a = i + j, b = a + half, tr = re[b] * cos[k] - im[b] * sin[k], ti = re[b] * sin[k] + im[b] * cos[k]; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; } }
}
function txHann(n) { let w = TXH[n]; if (w) return w; w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = .5 - .5 * Math.cos(2 * Math.PI * (i + .5) / n); return TXH[n] = w; }
/** magnitude spectrum (amplitude-calibrated) of x[start..start+len) Hann-windowed, zero-padded to N */
function txSpec(x, start, len, N, out) {
  const p = txPlan(N), w = txHann(len), re = p.re, im = p.im; re.fill(0); im.fill(0); let ws = 0, n = x.length;
  for (let i = 0; i < len; i++) { const idx = start + i; if (idx >= 0 && idx < n) re[i] = x[idx] * w[i]; ws += w[i]; }
  txFFT(p); const o = out || new Float32Array((N >> 1) + 1), sc = 2 / ws; for (let k = 0; k <= N >> 1; k++) o[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]) * sc; return o;
}
function txPrep(mono, sr) {
  const D = Math.max(1, Math.round(sr / 22050)), fs = sr / D; if (D === 1) return { x: mono, fs };
  const taps = 8 * D + 1, h = new Float32Array(taps), fc = .46 / D, mid = (taps - 1) / 2; let sum = 0;
  for (let i = 0; i < taps; i++) { const n = i - mid; h[i] = (n === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * n) / (Math.PI * n)) * (.54 + .46 * Math.cos(2 * Math.PI * n / (taps - 1))); sum += h[i]; }
  for (let i = 0; i < taps; i++) h[i] /= sum; const n = Math.floor(mono.length / D), out = new Float32Array(n);
  for (let j = 0; j < n; j++) { let a = 0; const c = j * D; for (let i = 0; i < taps; i++) { const idx = c + i - mid; if (idx >= 0 && idx < mono.length) a += mono[idx] * h[i]; } out[j] = a; }
  return { x: out, fs };
}

/* ---------- onsets ---------- */
function txOnsets(x, fs, sens, soft) {
  const win = 1024, hop = 128, N = 1024, frames = Math.max(0, Math.floor((x.length - win) / hop) + 1), kLo = Math.max(2, Math.floor(70 * N / fs)), kHi = Math.min((N >> 1) - 3, Math.floor(5000 * N / fs));
  let prev = new Float32Array((N >> 1) + 1), cur = new Float32Array((N >> 1) + 1); const flux = new Float32Array(frames), spec = new Float32Array((N >> 1) + 1);
  for (let f = 0; f < frames; f++) {
    txSpec(x, f * hop, win, N, spec); for (let k = kLo - 1; k <= kHi + 1; k++) cur[k] = Math.log(1 + spec[k] * 1e4);
    if (f > 0) { let s = 0; for (let k = kLo; k <= kHi; k++) { const m = Math.max(prev[k - 1], prev[k], prev[k + 1]), d = cur[k] - m; if (d > 0) s += d; } flux[f] = s; }
    const t = prev; prev = cur; cur = t;
  }
  const cs = new Float64Array(frames + 1), cs2 = new Float64Array(frames + 1); for (let i = 0; i < frames; i++) { cs[i + 1] = cs[i] + flux[i]; cs2[i + 1] = cs2[i] + flux[i] * flux[i]; }
  const W = Math.round(.4 * fs / hop), dS = 3.2 - 2.2 * sens, dW = dS * .62, pk = [];
  let gmax = 0; for (let i = 0; i < frames; i++) if (flux[i] > gmax) gmax = flux[i];
  const floor_ = gmax * .035;
  for (let f = 3; f < frames - 3; f++) {
    const a = Math.max(0, f - W), b = Math.min(frames, f + W + 1), n = b - a, mu = (cs[b] - cs[a]) / n, sd_ = Math.sqrt(Math.max(0, (cs2[b] - cs2[a]) / n - mu * mu)), v = flux[f];
    const thS = Math.max(mu + dS * sd_, floor_ * 2), thW = Math.max(mu + dW * sd_, floor_);
    if (v < thW) continue; let ismax = true; for (let j = -4; j <= 4; j++) { const q = flux[f + j]; if (f + j >= 0 && f + j < frames && q > v) { ismax = false; break; } else if (q === v && j < 0) { ismax = false; break; } } if (!ismax) continue;
    pk.push({ f, v, strength: v / thS, weak: v < thS });
  }
  const out = []; for (const p of pk) { const t = (p.f * hop + win / 2) / fs; if (out.length && t - out[out.length - 1].tc < .035) { if (p.v > out[out.length - 1].v) out[out.length - 1] = { tc: t, v: p.v, strength: p.strength, weak: p.weak }; } else out.push({ tc: t, v: p.v, strength: p.strength, weak: p.weak }); }
  return out.filter(o => soft || !o.weak).map(o => ({ t: txRefine(x, fs, o.tc), tc: o.tc, strength: o.strength, weak: o.weak }));
}
function txRefine(x, fs, t) {
  const B = 32, a = Math.max(2, Math.round((t - .06) * fs / B)), b = Math.min(Math.floor(x.length / B) - 2, Math.round((t + .02) * fs / B)); if (b <= a + 4) return t;
  const E = []; for (let i = a - 3; i <= b; i++) { let s = 0; for (let j = 0; j < B; j++) { const k = i * B + j, d = x[k] - x[k - 1]; s += d * d; } E.push(Math.log(s + 1e-12)); }
  let best = -1e9, bi = -1; for (let i = 3; i < E.length; i++) { const d = E[i] - E[i - 3]; if (d > best) { best = d; bi = i; } }
  return best > 1.2 ? ((a - 3 + bi) * B - B) / fs : t;
}

/* ---------- multi-pitch on the post-minus-pre spectral difference ---------- */
function txPitchTable(tuning, capo, maxFret, a4, tuneCents) {
  let lo = 1e9, hi = -1e9; tuning.forEach(o => { lo = Math.min(lo, o + capo); hi = Math.max(hi, o + capo + maxFret); });
  const t = []; for (let m = lo; m <= hi; m++) t.push({ midi: m, f: a4 * Math.pow(2, (m - 69) / 12 + (tuneCents || 0) / 1200) }); return t;
}
const TXN = 8192;
function txSmooth(a, r) { const n = a.length, cs = new Float64Array(n + 1); for (let i = 0; i < n; i++) cs[i + 1] = cs[i] + a[i]; const o = new Float32Array(n); for (let i = 0; i < n; i++) { const lo = Math.max(0, i - r), hi = Math.min(n, i + r + 1); o[i] = (cs[hi] - cs[lo]) / (hi - lo); } return o; }
function txSalience(D, nf, tbl, fs, B) {
  const bin = fs / TXN, K = D.length, out = new Array(tbl.length);
  for (let ci = 0; ci < tbl.length; ci++) {
    const f1 = tbl[ci].f; let raw = 0, present = 0, hEff = 0, hs = [];
    for (let h = 1; h <= 8; h++) {
      const fh = h * f1 * Math.sqrt(1 + B * h * h); if (fh > 5200 || fh > fs * .45) break; hEff++;
      const kc = fh / bin, kw = Math.max(2, Math.round(fh * .0145 / bin)); let pk = 0, pi = -1; for (let k = Math.max(1, Math.round(kc) - kw); k <= Math.min(K - 2, Math.round(kc) + kw); k++) if (D[k] > pk) { pk = D[k]; pi = k; }
      const pres = pi >= 0 && pk > 3.2 * nf[pi] + 1.5e-5; if (pres) { present++; raw += Math.pow(pk, .6) / Math.pow(h, .6); } hs.push({ pi, pk, pres, kw });
    }
    const need = 2; const frac = hEff ? present / hEff : 0;
    out[ci] = { sal: present >= need ? raw * Math.pow(frac, 1.15) : 0, present, hEff, hs };
  }
  return out;
}
function txCancel(D, c, partial) {
  const hs = c.hs;
  hs.forEach((h, i) => {
    if (h.pi < 0) return; let keep = .02;
    if (partial && i > 0 && h.pres) { const nb = []; if (hs[i - 1] && hs[i - 1].pres) nb.push(hs[i - 1].pk); if (hs[i + 1] && hs[i + 1].pres) nb.push(hs[i + 1].pk); const ref = nb.length ? Math.max(...nb) : h.pk, est = Math.min(h.pk, partial * ref); keep = Math.max(.02, 1 - est / h.pk); }
    const lo = Math.max(0, h.pi - h.kw - 2), hi = Math.min(D.length - 1, h.pi + h.kw + 2); for (let k = lo; k <= hi; k++) D[k] *= keep;
  });
}
function txParabolic(S, k) { if (k < 1 || k >= S.length - 1) return k; const a = Math.log(S[k - 1] + 1e-12), b = Math.log(S[k] + 1e-12), c = Math.log(S[k + 1] + 1e-12), den = a - 2 * b + c; return den ? k + .5 * (a - c) / den : k; }


/* ---------- analysis-by-synthesis: fit a hypothesised note set to the difference spectrum (non-negative least squares) ---------- */
const TXSHAPES = [[0, 0], [.8, 0], [0, .13], [.8, .13], [0, .2], [.8, .2]], TXNS = TXSHAPES.length;
function txHannK(d, len) { const x = d * len / TXN, ax = Math.abs(x); if (ax >= 3) return 0; if (ax < 1e-6) return 1; if (Math.abs(ax - 1) < 1e-4) return .5; return Math.abs(Math.sin(Math.PI * x) / (Math.PI * x) / (1 - x * x)); }
const TXCOL = new Map();
function txCol(f, shape, len, fs, B, K) {
  const key = Math.round(f * 20) + '|' + shape + '|' + len + '|' + fs; let c = TXCOL.get(key); if (c) return c; if (TXCOL.size > 3000) TXCOL.clear();
  const bin = fs / TXN, span = Math.ceil(3 * TXN / len), sh = TXSHAPES[shape], al = sh[0], be = sh[1], mp = new Map();
  for (let h = 1; h <= 10; h++) { const fh = h * f * Math.sqrt(1 + B * h * h); if (fh > 5200 || fh > fs * .45) break; const kc = fh / bin, w = Math.pow(h, -al) * (be ? Math.max(.12, Math.abs(Math.sin(Math.PI * h * be))) / Math.max(.3, Math.sin(Math.PI * be)) : 1); for (let k = Math.max(1, Math.floor(kc) - span); k <= Math.min(K - 2, Math.ceil(kc) + span); k++) { const v = w * txHannK(k - kc, len); if (v > 1e-3) mp.set(k, (mp.get(k) || 0) + v); } }
  const idx = [], val = []; mp.forEach((v, k) => { idx.push(k); val.push(v); }); c = { idx: Int32Array.from(idx), val: Float32Array.from(val) }; TXCOL.set(key, c); return c;
}
/** returns {amp:[per note], expl: explained energy fraction} */
function txFitSet(D, fs, len, B, freqs, yy) {
  const K = D.length, cols = []; freqs.forEach(f => TXSHAPES.forEach((_, si) => cols.push(txCol(f, si, len, fs, B, K)))); const n = cols.length, G = new Float64Array(n * n), b = new Float64Array(n), dense = new Float32Array(K);
  for (let j = 0; j < n; j++) { const cj = cols[j]; let a = 0; for (let t = 0; t < cj.idx.length; t++) { dense[cj.idx[t]] = cj.val[t]; a += cj.val[t] * D[cj.idx[t]]; } b[j] = a; for (let i = j; i < n; i++) { const ci = cols[i]; let g = 0; for (let t = 0; t < ci.idx.length; t++) g += ci.val[t] * dense[ci.idx[t]]; G[i * n + j] = G[j * n + i] = g; } for (let t = 0; t < cj.idx.length; t++) dense[cj.idx[t]] = 0; }
  const x = new Float64Array(n).fill(.003), gx = new Float64Array(n), lam = 1e-4;
  for (let it = 0; it < 140; it++) { for (let i = 0; i < n; i++) { let a = 0; const r = i * n; for (let j = 0; j < n; j++) a += G[r + j] * x[j]; gx[i] = a; } for (let i = 0; i < n; i++) x[i] *= b[i] / (gx[i] + lam + 1e-12); }
  let xb = 0, xgx = 0; for (let i = 0; i < n; i++) { xb += x[i] * b[i]; xgx += x[i] * gx[i]; }
  const amp = freqs.map((_, i) => { let a = 0; for (let q = 0; q < TXNS; q++) a += x[i * TXNS + q]; return a; }); return { amp, expl: yy > 0 ? clamp((2 * xb - xgx) / yy, 0, 1) : 0 };
}
const TXCH = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus2: [0, 2, 7], sus4: [0, 5, 7], 5: [0, 7] };
function txGuess(notes) {
  const w = new Array(12).fill(0); notes.forEach(n => w[n.midi % 12] += n.rel || 1); const tot = w.reduce((a, b) => a + b, 0) || 1, out = [];
  for (let r = 0; r < 12; r++) for (const q in TXCH) { const set = new Set(TXCH[q].map(i => (r + i) % 12)); let sc = 0; w.forEach((v, pc) => { sc += set.has(pc) ? v : -.7 * v; }); sc -= .04 * TXCH[q].length; out.push({ sym: NN_[r] + q, r, q, sc: sc / tot }); }
  return out.sort((a, b) => b.sc - a.sc).slice(0, 2).filter(o => o.sc > .55);
}
const NN_ = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** analyze one event: which pitches *start* at t0 (and which stop) */
function txEvent(x, fs, t0, tNext, cfg, wantStops) {
  const len = Math.round(clamp(tNext - t0 - .022, .09, .37) * fs), sPost = Math.round((t0 + .018) * fs), sPre = Math.round(t0 * fs - .004 * fs) - len;
  const post = txSpec(x, sPost, len, TXN), pre = txSpec(x, sPre, len, TXN), K = post.length, D = new Float32Array(K), Dn = new Float32Array(K);
  let nf = txSmooth(post, 30); { const cl = new Float32Array(K); for (let k = 0; k < K; k++) cl[k] = Math.min(post[k], nf[k] * 1.2); nf = txSmooth(cl, 30); const cl2 = new Float32Array(K); for (let k = 0; k < K; k++) cl2[k] = Math.min(post[k], nf[k] * 1.5); nf = txSmooth(cl2, 30); }
  for (let k = 0; k < K; k++) { const d = post[k] - .85 * pre[k]; D[k] = d > 0 ? d : 0; const e = pre[k] - post[k]; Dn[k] = e > 0 ? e : 0; }
  let rms = 0; for (let i = 0; i < len; i++) { const v = x[sPost + i] || 0; rms += v * v; } rms = Math.sqrt(rms / len);
  const salRaw = txSalience(D, nf, cfg.tbl, fs, cfg.B);
  const run = (Dd, maxPoly, minRel, sal0) => {
    const W = Float32Array.from(Dd), res = []; let s1 = 0, first = sal0, sal = sal0;
    for (let it = 0; it < maxPoly; it++) {
      if (it > 0) sal = txSalience(W, nf, cfg.tbl, fs, cfg.B);
      let bi = -1, bs = 0; for (let i = 0; i < sal.length; i++) if (sal[i].sal > bs) { bs = sal[i].sal; bi = i; }
      if (it === 0) s1 = bs; if (bi < 0 || bs < cfg.minSal || bs < minRel * s1) break;
      // sub-octave check: a partial series that is the even half of a lower series is that lower note
      for (const dn of [12, 19, 24]) { const L = bi - dn; if (L < 0 || !sal[L] || !sal[L].sal) continue; const q = sal[L], hs = q.hs; if (q.present < Math.max(3, .7 * q.hEff)) continue; let o = 0, on = 0, e = 0, en = 0; hs.forEach((h, i) => { const hh = i + 1; if (!h.pres) return; if (dn === 12 ? hh % 2 : dn === 19 ? hh % 3 : hh % 4) { o += h.pk; on++; } else { e += h.pk; en++; } }); if (on && en && o / on >= cfg.subOct * e / en && q.sal >= .35 * bs) { bi = L; bs = q.sal; break; } }
      const c = sal[bi], note = { midi: cfg.tbl[bi].midi, sal: bs, rel: bs / s1, present: c.present, hEff: c.hEff, dev: null };
      let dsum = 0, dw = 0; c.hs.forEach((h, i) => { if (!h.pres) return; const kk = txParabolic(Dd, h.pi), fobs = kk * fs / TXN, fexp = (i + 1) * cfg.tbl[bi].f * Math.sqrt(1 + cfg.B * (i + 1) * (i + 1)), cents = 1200 * Math.log2(fobs / fexp); if (Math.abs(cents) < 40) { dsum += cents * h.pk; dw += h.pk; } });
      note.dev = dw ? dsum / dw : null; res.push(note); txCancel(W, c, cfg.partial);
    }
    // partial-ghost filter: weak picks that sit on an integer harmonic of a stronger lower pick are that pick's overtones
    const keep = res.filter((n, i) => !(n.rel < cfg.ghostRel && res.some((L, j) => j !== i && L.midi < n.midi && L.rel > n.rel * 1.15 && (() => { const r = Math.pow(2, (n.midi - L.midi) / 12), hr = Math.round(r); return hr >= 2 && hr <= 12 && Math.abs(r / hr - 1) < .028; })())));
    return { notes: keep, s1, all: first };
  };
  const r = run(D, cfg.maxPoly, cfg.relSal, salRaw), out = { t: t0, notes: r.notes, s1: r.s1, rms, raw: r.all, D, len };
  if (wantStops) { const q = run(Dn, 2, .45, txSalience(Dn, nf, cfg.tbl, fs, cfg.B)); out.stops = q.notes; }
  return out;
}

/** how plucked is this onset? ratio of broadband (HF) energy and RMS after vs. before — hammer-ons / pull-offs barely raise either */
function txTransient(x, fs, t) {
  const a = (t0, t1, hf) => { let s = 0, n = 0; for (let i = Math.max(2, Math.round(t0 * fs)); i < Math.min(x.length, Math.round(t1 * fs)); i++) { const v = hf ? x[i] - 2 * x[i - 1] + x[i - 2] : x[i]; s += v * v; n++; } return n ? s / n : 0; };
  return { rms: Math.sqrt((a(t + .005, t + .045, false) + 1e-12) / (a(t - .045, t - .005, false) + 1e-12)), hf: (a(t + .003, t + .035, true) + 1e-14) / (a(t - .04, t - .005, true) + 1e-14) };
}
/* ---------- pitch trajectory (bend / vibrato / slide evidence) ---------- */
function txTrack(x, fs, t0, t1, f0) {
  const out = [], win = 2048, hop = 512, bin = fs / TXN, sp = new Float32Array((TXN >> 1) + 1); let a0 = 0;
  for (let s = Math.round(t0 * fs); s < t1 * fs; s += hop) {
    txSpec(x, s, win, TXN, sp); let sum = 0, wsum = 0, amp = 0;
    for (let h = 1; h <= 3; h++) { const fh = f0 * h * Math.sqrt(1 + 2e-4 * h * h), kc = Math.round(fh / bin), kw = Math.round(fh * (Math.pow(2, 200 / 1200) - 1) / bin); let pk = 0, pi = -1; for (let k = Math.max(1, kc - kw); k <= Math.min(sp.length - 2, kc + kw); k++) if (sp[k] > pk) { pk = sp[k]; pi = k; } if (pi < 0 || pk < 2e-4) continue; const fo = txParabolic(sp, pi) * bin; sum += 1200 * Math.log2(fo / fh) * pk; wsum += pk; if (h === 1) amp = pk; else if (!amp) amp = pk; }
    if (!wsum) { if (out.length > 2) break; continue; } if (!a0) a0 = amp; if (amp < .06 * a0 && out.length > 3) break; out.push({ t: s / fs, dev: sum / wsum, amp });
  }
  return out;
}
function txTechnique(series, fretNow) {
  if (series.length < 5) return null; const d = series.map(p => p.dev), base = median(d.slice(0, 3)); if (Math.abs(base) > 40) return null; for (let i = 1; i < d.length; i++) if (Math.abs(d[i] - d[i - 1]) > 110) return null; const rel = d.map(v => v - base), mx = Math.max(...rel.slice(2)), n = rel.length;
  const hp = rel.map((v, i) => { let s = 0, c = 0; for (let j = Math.max(0, i - 4); j <= Math.min(n - 1, i + 4); j++) { s += rel[j]; c++; } return v - s / c; }); let z = 0, ex = 0; for (let i = 1; i < n; i++) { if ((hp[i - 1] < 0) !== (hp[i] < 0)) z++; ex = Math.max(ex, Math.abs(hp[i])); }
  const dt = (series[n - 1].t - series[0].t) || 1, rate = z / 2 / dt;
  if (mx >= 55 && rel.slice(Math.floor(n * .4)).some(v => v >= 45)) return { t: 'b', bendTo: fretNow + Math.max(1, Math.round(mx / 100)) };
  if (z >= 4 && ex >= 11 && rate >= 3 && rate <= 9.5) return { t: '~' };
  return null;
}
function txGlide(x, fs, tA, tB, f1, f2) {
  const win = 1024, hop = 128, N = 4096, bin = fs / N, sp = new Float32Array((N >> 1) + 1), lo = Math.min(f1, f2) * .96, hi = Math.max(f1, f2) * 1.04; let inter = 0, mx = 0; const rows = [];
  for (let s = Math.round(tA * fs); s < tB * fs; s += hop) { txSpec(x, s, win, N, sp); let pk = 0, pi = -1; for (let k = Math.floor(lo / bin); k <= Math.ceil(hi / bin); k++) if (sp[k] > pk) { pk = sp[k]; pi = k; } if (pi < 0) continue; rows.push({ f: txParabolic(sp, pi) * bin, a: pk }); if (pk > mx) mx = pk; }
  rows.forEach(r => { if (r.a < .3 * mx) return; const c1 = Math.abs(1200 * Math.log2(r.f / f1)), c2 = Math.abs(1200 * Math.log2(r.f / f2)); if (c1 > 28 && c2 > 28 && r.f > lo && r.f < hi) inter++; }); return inter;
}

/* ---------- tempo / beat phase for imported audio ---------- */
function txTempo(onsets, minBpm = 60, maxBpm = 180) {
  if (onsets.length < 6) return null; const t = onsets.map(o => o.t), res = .01, len = Math.ceil((t[t.length - 1] + 1) / res), env = new Float32Array(len); t.forEach((v, i) => { env[Math.round(v / res)] += Math.min(3, onsets[i].strength || 1); });
  let best = null; for (let bpm = minBpm; bpm <= maxBpm; bpm += .25) { const p = 60 / bpm; let s = 0; for (let k = 1; k <= 3; k++) { const lag = Math.round(p * k / res); for (let i = 0; i + lag < len; i++) if (env[i]) s += env[i] * (env[i + lag] + .5 * (env[i + lag - 1] || 0) + .5 * (env[i + lag + 1] || 0)) / k; } const sc = s * (1 + .15 * Math.exp(-Math.pow(Math.log2(bpm / 100), 2))); if (!best || sc > best.sc) best = { bpm, sc }; }
  let bpm = best.bpm; const p = 60 / bpm; let bph = 0, bs = -1; for (let ph = 0; ph < p; ph += .005) { let s = 0; t.forEach(v => { const r = ((v - ph) % p + p) % p, d = Math.min(r, p - r); s += Math.exp(-d * d / (2 * .02 * .02)); }); if (s > bs) { bs = s; bph = ph; } }
  return { bpm, phase: bph };
}

/* ---------- quantization ---------- */
const txSlotTime = (k, dur, swing) => k * dur + (k & 1 ? swing * dur : 0);
function txQuant(tAbs, dur, swing, grid) {
  const k0 = Math.round(tAbs / dur); let bk = k0, bd = 1e9; for (let k = k0 - 2; k <= k0 + 2; k++) { if (grid === 2 && k % 2) continue; if (grid === 4 && k % 4) continue; const d = Math.abs(tAbs - txSlotTime(k, dur, swing)); if (d < bd) { bd = d; bk = k; } }
  return { k: bk, res: tAbs - txSlotTime(bk, dur, swing) };
}

/* ---------- string / fret assignment (Viterbi with musical priors) ---------- */
function txCandidates(m, tuning, capo, maxFret) { const c = []; tuning.forEach((o, st) => { const f = m - o - capo; if (f >= 0 && f <= maxFret) c.push({ st, f }); }); return c; }
function txAssign(events, cx) {
  const T = cx.tuning, capo = cx.capo, MF = cx.maxFret || 22, B = 28, vc = {}, vf = sym => { if (!sym) return []; return vc[sym] || (vc[sym] = (cx.voicings ? cx.voicings(sym) : []).slice(0, 8)); };
  const layers = [];
  events.forEach((ev, ei) => {
    ev.notes = ev.notes.filter(n => txCandidates(n.midi, T, capo, MF).length);
    const notes = ev.notes.slice().sort((a, b) => a.midi - b.midi), vs = vf(ev.sym), camNear = (cx.cam || []).filter(c => Math.abs(c.t - ev.t) < .35), camPos = camNear.length ? median(camNear.map(c => c.fret).filter(f => f > 0)) : NaN;
    const states = []; if (!notes.length) { layers.push([{ asg: [], cost: 0, pos: null }]); return; }
    const opts = notes.map(n => txCandidates(n.midi, T, capo, MF)), used = new Array(6).fill(false), cur = [];
    const dfs = (i, cost) => {
      if (states.length > 6000) return; if (i === notes.length) { states.push(txScoreSet(cur.slice(), notes, cost, vs, camNear, camPos, ev, cx)); return; }
      for (const c of opts[i]) { if (used[c.st]) continue; used[c.st] = true; cur.push({ st: c.st, f: c.f, midi: notes[i].midi }); dfs(i + 1, cost + (c.f === 0 ? 0 : .09 * c.f + (c.f > 12 ? .5 : 0))); cur.pop(); used[c.st] = false; }
    };
    dfs(0, 0); states.sort((a, b) => a.cost - b.cost); layers.push(states.length ? states.slice(0, B) : [{ asg: [], cost: 0, pos: null }]);
  });
  // viterbi
  const n = layers.length; if (!n) return; const best = layers.map(L => new Float64Array(L.length)), back = layers.map(L => new Int32Array(L.length).fill(-1));
  for (let i = 0; i < n; i++) for (let s = 0; s < layers[i].length; s++) {
    const st = layers[i][s]; if (i === 0) { best[i][s] = st.cost; continue; }
    let bv = 1e18, bj = 0; for (let j = 0; j < layers[i - 1].length; j++) { const v = best[i - 1][j] + txTrans(layers[i - 1][j], st, events[i], events[i - 1]); if (v < bv) { bv = v; bj = j; } } best[i][s] = bv + st.cost; back[i][s] = bj;
  }
  let bs = 0; for (let s = 1; s < layers[n - 1].length; s++) if (best[n - 1][s] < best[n - 1][bs]) bs = s;
  for (let i = n - 1; i >= 0; i--) { const L = layers[i][bs]; events[i].asg = L.asg; events[i].asgCost = L.cost; if (i > 0) bs = back[i][bs]; }
  events.forEach(ev => { ev.asg.forEach(a => { const nn = ev.notes.find(q => q.midi === a.midi); if (nn) { nn.st = a.st; nn.fret = a.f; nn.camHit = !!a.cam; } }); });
}
function txScoreSet(asg, notes, cost, vs, camNear, camPos, ev, cx) {
  const fretted = asg.filter(a => a.f > 0), fr = fretted.map(a => a.f); let pos = null;
  if (fr.length) { const mn = Math.min(...fr), mxf = Math.max(...fr); pos = mn; const span = mxf - mn; if (span > 4) cost += 6 + (span - 4) * 3; else if (span > 3) cost += .8;
    const fingers = new Set(fr.filter(f => f > mn)).size + (fr.some(f => f === mn) ? 1 : 0); const cnt = fretted.length; if (cnt >= 3 && fingers > 4) cost += 5 + (fingers - 4) * 2; }
  if (vs.length) { let best = 0; vs.forEach(v => { let m = 0; asg.forEach(a => { if (v.frets[a.st] === a.f) m++; }); const frac = m / asg.length; if (m === asg.length && asg.length >= 2) best = Math.max(best, 1); else best = Math.max(best, frac * .6); }); cost -= (cx.chordPrior == null ? 1 : cx.chordPrior) * (2.4 * best + (best === 1 ? 1.2 : 0)) * Math.min(asg.length, 3) / 2; }
  if (camNear.length) { asg.forEach(a => { const hit = camNear.some(c => c.st === a.st && c.fret === a.f); a.cam = hit; if (hit) cost -= 3.2 * (cx.camWeight == null ? 1 : cx.camWeight); else if (camNear.some(c => c.st === a.st)) cost += .6 * (cx.camWeight == null ? 1 : cx.camWeight); }); if (pos != null && !isNaN(camPos)) cost += Math.min(3, Math.abs(pos - camPos) * .18) * (cx.camWeight == null ? 1 : cx.camWeight); }
  return { asg, cost, pos };
}
function txTrans(a, b, evB, evA) {
  let c = 0; if (a.pos != null && b.pos != null) c += Math.min(6, Math.abs(a.pos - b.pos) * .32);
  if (a.asg.length === 1 && b.asg.length === 1 && a.asg[0].midi === b.asg[0].midi && (a.asg[0].st !== b.asg[0].st)) c += 1.4;
  if (evB.legato) { const prev = a.asg.find(q => q.midi === evB.legato.from), cur = b.asg.find(q => q.midi === evB.legato.to); if (prev && cur && prev.st !== cur.st) c += 9; else if (prev && cur) c -= 1.5; }
  if (a.asg.length === 1 && b.asg.length === 1 && Math.abs(a.asg[0].st - b.asg[0].st) > 2) c += .35 * (Math.abs(a.asg[0].st - b.asg[0].st) - 2);
  return c;
}

/* ---------- orchestrator ---------- */
async function txTranscribe(mono, sr, cx, progress) {
  const P = Object.assign({ sens: .5, relSal: .26, minSal: .1, subOct: .3, partial: 0, ghostRel: .7, legHF: 25, legRMS: 2.3, rawFrac: .6, rawMin: 8, fillFrac: .5, vBonus: .04, parsimony: .012, keepFrac: .15, maxPoly: 6, grid: 1, B: 2e-4, legato: true, techniques: true, autoOffset: true, offsetMs: 0, minConf: .0, chordPrior: 1, camWeight: 1, snapChord: true }, cx.params || {});
  const yield_ = () => new Promise(r => setTimeout(r, 0)), rep = (f, m) => { if (progress) progress(f, m); };
  rep(.02, 'Resampling…'); const { x, fs } = txPrep(mono, sr); await yield_();
  rep(.08, 'Finding onsets…'); const ons = txOnsets(x, fs, P.sens, P.legato); await yield_();
  const strong = ons.filter(o => !o.weak), weak = ons.filter(o => o.weak);
  // group strong onsets (strum clusters ≤ 50 ms) ; weak onsets stay separate candidates
  const evts = []; strong.forEach(o => { const l = evts[evts.length - 1]; if (l && o.t - l.last < .05) { l.last = o.t; l.times.push(o.t); l.strength = Math.max(l.strength, o.strength); } else evts.push({ t: o.t, last: o.t, times: [o.t], strength: o.strength, weak: false }); });
  if (P.legato) weak.forEach(o => evts.push({ t: o.t, last: o.t, times: [o.t], strength: o.strength, weak: true })); evts.sort((a, b) => a.t - b.t);
  const dur = cx.slotDur, swing = cx.swing || 0, base = { tbl: null, B: P.B, minSal: P.minSal, relSal: P.relSal, maxPoly: P.maxPoly, subOct: P.subOct, partial: P.partial, ghostRel: P.ghostRel };
  let tune = 0, res = [];
  for (let pass = 0; pass < 2; pass++) {
    base.tbl = txPitchTable(cx.tuning, cx.capo, cx.maxFret || 22, cx.a4 || 440, tune); res = [];
    for (let i = 0; i < evts.length; i++) {
      const e = evts[i], nxt = i + 1 < evts.length ? evts[i + 1].t : e.t + .5; const r = txEvent(x, fs, e.t, nxt, base, P.legato);
      res.push(Object.assign(r, { strength: e.strength, weak: e.weak, times: e.times, tNext: nxt, tr: txTransient(x, fs, e.t) })); if (i % 12 === 0) { rep(.1 + (pass * .25 + i / evts.length * .25) * 1, pass ? 'Re-tuning pass…' : 'Reading notes…'); await yield_(); }
    }
    if (pass === 0) { const devs = []; res.forEach(r => r.notes.forEach(n => { if (n.dev != null && n.rel > .5 && !r.weak) devs.push(n.dev); })); const md = devs.length > 4 ? median(devs) : 0; if (Math.abs(md) > 5) tune = md; else break; }
  }
  // legato classification: one new pitch + the previous pitch of the string stops + no pluck transient
  const events = []; let lastNotes = [];
  const soft = r => r.tr && r.tr.hf < P.legHF && r.tr.rms < P.legRMS;
  res.forEach((r, i) => {
    let leg = null;
    if (P.legato && r.notes.length === 1 && r.stops && r.stops.length) { const n = r.notes[0], st = r.stops.find(q => { const d = Math.abs(n.midi - q.midi); return d >= 1 && d <= 12; }), prevN = st && lastNotes.slice().reverse().find(q => q.midi === st.midi && r.t - q.t < 2); if (prevN && n.rel > .5 && (r.weak || soft(r))) leg = { from: st.midi, to: n.midi }; }
    if (cx.debugLeg) cx.debugLeg(r, leg);
    if (r.weak && !leg) return; if (!r.notes.length) return;
    events.push({ t: r.t, strength: r.strength, notes: r.notes, s1: r.s1, raw: r.raw, D: r.D, len: r.len, stops: r.stops, times: r.times, tNext: r.tNext, legato: leg });
    r.notes.forEach(n => lastNotes.push({ midi: n.midi, t: r.t })); if (lastNotes.length > 40) lastNotes.splice(0, lastNotes.length - 40);
  });
  rep(.55, 'Aligning to the grid…');
  // grid alignment with optional auto offset
  const t0abs = cx.startSec || 0; const resAt = off => events.map(e => txQuant(t0abs + e.t + off, dur, swing, P.grid).res);
  let off = (P.offsetMs || 0) / 1000, autoOff = 0;
  if (P.autoOffset && events.length >= 4) { let bo = 0, bm = 1e9; const med0 = median(resAt(off).map(Math.abs)); for (let o = -.07; o <= .07; o += .004) { const m = median(resAt(off + o).map(Math.abs)); if (m < bm) { bm = m; bo = o; } } if (bm < med0 * .85) { autoOff = bo; off += bo; } }
  events.forEach(e => { const q = txQuant(t0abs + e.t + off, dur, swing, P.grid); e.k = q.k; e.res = q.res; });
  // merge events landing on the same slot
  const byK = new Map(); events.forEach(e => { const m = byK.get(e.k); if (!m) byK.set(e.k, e); else { e.notes.forEach(n => { const d = m.notes.find(q => q.midi === n.midi); if (!d) m.notes.push(n); else if (n.sal > d.sal) Object.assign(d, n); }); m.strength = Math.max(m.strength, e.strength); if (e.legato && !m.legato) m.legato = e.legato; } });
  const merged = [...byK.values()].sort((a, b) => a.k - b.k);
  merged.forEach(e => { e.sym = cx.chordAt ? cx.chordAt(e.k) : null; });
  // model selection by synthesis: greedy hypothesis vs. every library voicing of the bar's chord (± melody extras), scored by explained spectral energy
  if (P.snapChord && cx.voicings) merged.forEach(e => {
    if (!e.D) return; const rawMax = e.raw ? Math.max(...e.raw.map(q => q.sal)) : 0, rawN = e.raw ? e.raw.filter(q => q.sal >= P.rawFrac * rawMax).length : 0; if (e.notes.length < 3 && rawN < P.rawMin) return; if (cx.debugChord) cx.debugChord(e.k, e.notes.length, rawN); const fsv = fs, f0 = m => cx.a4 * Math.pow(2, (m - 69) / 12 + tune / 1200); let yy = 0; const kmax = Math.min(e.D.length, Math.floor(5200 / (fs / TXN))); for (let k = 1; k < kmax; k++) yy += e.D[k] * e.D[k]; if (yy <= 0) return;
    const syms = e.sym ? [e.sym] : txGuess(e.notes).map(o => o.sym); if (!syms.length) return; const gset = e.notes.map(n => n.midi), hyps = [{ set: gset, tag: 'g' }];
    syms.forEach(sym => (cx.voicings(sym) || []).slice(0, 9).forEach(v => { const set = []; v.frets.forEach((f, st) => { if (f != null) set.push(cx.tuning[st] + cx.capo + f); }); if (set.length < 2) return; hyps.push({ set, tag: 'v' }); const ex = e.notes.filter(n => n.rel >= .7 && !set.includes(n.midi) && !set.some(m => m % 12 === n.midi % 12)).map(n => n.midi); if (ex.length && ex.length <= 2) hyps.push({ set: set.concat(ex), tag: 'v+' }); }));
    let best = null; const pen = P.parsimony; hyps.forEach(h => { const fit = txFitSet(e.D, fsv, e.len, P.B, h.set.map(f0), yy), sc = fit.expl - pen * h.set.length + (h.tag !== 'g' && e.sym ? P.vBonus : 0); if (!best || sc > best.sc) best = { sc, fit, h }; });
    if (cx.debug) cx.debug({ k: e.k, sym: e.sym, greedy: gset, pick: best && best.h.set, tag: best && best.h.tag, amps: best && best.fit.amp, expl: best && best.fit.expl, all: hyps.length });
    if (!best || best.h.tag === 'g') return; const mx = Math.max(...best.fit.amp), keep = []; best.h.set.forEach((m, i) => { if (best.fit.amp[i] >= P.keepFrac * mx) keep.push({ m, a: best.fit.amp[i] }); });
    const old = new Map(e.notes.map(n => [n.midi, n])); e.notes = keep.map(k => { const o = old.get(k.m); return o || { midi: k.m, sal: k.a, rel: k.a / mx, inferred: true, dev: null }; });
  });
  rep(.62, 'Assigning strings & frets…'); await yield_(); txAssign(merged, cx);
  // techniques: trajectories for bends / vibrato, glide test for slides, HO/PO tags
  rep(.78, 'Reading techniques…');
  if (P.techniques) { for (let i = 0; i < merged.length; i++) { const e = merged[i]; for (const n of e.notes) { if (n.fret == null || n.inferred || e.notes.length > 2) continue; const f0 = cx.a4 * Math.pow(2, (n.midi - 69) / 12 + tune / 1200), tEnd = Math.min(e.tNext ? e.tNext - .1 : e.t + .6, e.t + .7); if (tEnd - e.t < .28) continue; const series = txTrack(x, fs, e.t + .02, tEnd, f0), tech = txTechnique(series, n.fret); if (cx.debugTech) cx.debugTech(n.midi, e.k, series, tech); if (tech) { n.tech = tech.t; if (tech.bendTo != null) n.bendTo = tech.bendTo; } }
      if (e.legato) { const pe = merged[i - 1] ? null : null; const f1 = cx.a4 * Math.pow(2, (e.legato.from - 69) / 12 + tune / 1200), f2 = cx.a4 * Math.pow(2, (e.legato.to - 69) / 12 + tune / 1200); const glide = txGlide(x, fs, e.t - .1, e.t + .06, f1, f2); e.legato.slide = glide >= 4; e.legato.up = e.legato.to > e.legato.from; }
      if (i % 10 === 0) await yield_(); } }
  // attach legato technique to the source note (the previous note on the same string)
  merged.forEach((e, i) => { if (!e.legato) return; const to = e.notes.find(n => n.midi === e.legato.to); if (!to || to.st == null) return; for (let j = i - 1; j >= 0; j--) { const src = merged[j].notes.find(n => n.st === to.st); if (src) { if (!src.tech || src.tech === '~') src.tech = e.legato.slide ? (e.legato.up ? '/' : '\\') : (e.legato.up ? 'h' : 'p'); to.legato = true; break; } } });
  // confidence
  merged.forEach(e => e.notes.forEach(n => { const att = clamp((e.strength - .8) / 1.6, 0, 1), lvl = clamp(e.s1 / .5, 0, 1); n.conf = clamp(.5 * clamp(n.rel, 0, 1) + .3 * lvl + .2 * att - (n.inferred ? .25 : 0), 0, 1); }));
  const out = merged.filter(e => e.notes.length).map(e => ({ k: e.k, t: e.t, res: e.res, strength: e.strength, sym: e.sym, legato: e.legato || null, notes: e.notes.filter(n => n.st != null).map(n => ({ midi: n.midi, st: n.st, fret: n.fret, conf: n.conf, tech: n.tech || '', bendTo: n.bendTo, inferred: !!n.inferred, camHit: !!n.camHit, dev: n.dev })) })).filter(e => e.notes.length);
  const resid = out.map(e => e.res * 1000);
  rep(1, 'Done');
  return { events: out, stats: { onsets: ons.length, weak: weak.length, events: out.length, notes: out.reduce((a, e) => a + e.notes.length, 0), tuneCents: tune, autoOffsetMs: autoOff * 1000, offsetMs: off * 1000, residMean: resid.length ? mean(resid) : null, residSD: resid.length > 2 ? sd(resid) : null, residAbs: resid.length ? mean(resid.map(Math.abs)) : null, meanConf: out.length ? mean(out.flatMap(e => e.notes.map(n => n.conf))) : null, fs }, params: P };
}

/* ---------- multi-take consensus ---------- */
function txConsensus(results, minFrac) {
  const n = results.length, need = Math.max(1, Math.ceil(n * (minFrac == null ? .5 : minFrac))), votes = new Map();
  results.forEach(r => r.events.forEach(e => e.notes.forEach(nt => { const key = e.k + '|' + nt.midi; let v = votes.get(key); if (!v) votes.set(key, v = { k: e.k, midi: nt.midi, n: 0, st: {}, conf: 0, tech: {}, bend: {}, sym: e.sym, t: e.t }); v.n++; v.conf += nt.conf; const sk = nt.st + ':' + nt.fret; v.st[sk] = (v.st[sk] || 0) + 1; if (nt.tech) v.tech[nt.tech] = (v.tech[nt.tech] || 0) + 1; if (nt.bendTo != null) v.bend[nt.bendTo] = (v.bend[nt.bendTo] || 0) + 1; })));
  const byK = new Map(); votes.forEach(v => { if (v.n < need) return; let bk = null, bn = -1; for (const k in v.st) if (v.st[k] > bn) { bn = v.st[k]; bk = k; } const [st, fret] = bk.split(':').map(Number); let tech = '', tn = 0; for (const k in v.tech) if (v.tech[k] > tn && v.tech[k] >= need) { tn = v.tech[k]; tech = k; } let bend; if (tech === 'b') { let bb = -1; for (const k in v.bend) if (v.bend[k] > bb) { bb = v.bend[k]; bend = +k; } }
    const e = byK.get(v.k) || { k: v.k, t: v.t, res: 0, strength: 1, sym: v.sym, legato: null, notes: [] }; e.notes.push({ midi: v.midi, st, fret, conf: clamp(v.conf / n * (.6 + .4 * v.n / n), 0, 1), tech, bendTo: bend, inferred: false, camHit: false, dev: null }); byK.set(v.k, e); });
  return { events: [...byK.values()].sort((a, b) => a.k - b.k), stats: { takes: n, need, events: byK.size, notes: [...byK.values()].reduce((a, e) => a + e.notes.length, 0) }, params: results[0] ? results[0].params : {} };
}

/* ---------- synthetic guitar renderer (for the self-test benchmark) ---------- */
function txRng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function txPluck(out, sr, t, midi, vel, o, rnd) {
  const f = 440 * Math.pow(2, (midi - 69) / 12), D = sr / f, a = o.disp || .06, apDelay = (1 - a) / (1 + a) * (o.stages || 2), Ld = D - .5 - 1.0 - apDelay, L = Math.max(4, Math.floor(Ld)), d = Ld - L + 1.0, C = (1 - d) / (1 + d);
  const t60 = clamp(2.6 - (midi - 40) * .035, .7, 2.6) * (o.sustain || 1), g = Math.pow(10, -3 / (t60 * f)), buf = new Float32Array(L + 1);
  let lp = 0; const cut = .25 + .6 * vel; for (let i = 0; i < L; i++) { const w = rnd() * 2 - 1; lp += cut * (w - lp); buf[i] = lp; } const pp = Math.max(1, Math.round(L * (.12 + .15 * rnd()))); for (let i = L - 1; i >= pp; i--) buf[i] -= buf[i - pp] * .8; let pk = 0; for (let i = 0; i < L; i++) pk = Math.max(pk, Math.abs(buf[i])); const sc = vel * .35 / (pk || 1); for (let i = 0; i < L; i++) buf[i] *= sc;
  let xp = 0, yp = 0, ax1 = new Float64Array(o.stages || 2), ay1 = new Float64Array(o.stages || 2), idx = 0, s0 = Math.round(t * sr), n = Math.min(out.length - s0, Math.round(sr * Math.min(3.5, t60 * 1.3))), prevS = 0;
  for (let i = 0; i < n; i++) {
    const cur = buf[idx], nxt = buf[(idx + 1) % L], avg = .5 * (cur + nxt) * g; let y = C * avg + xp - C * yp; xp = avg; yp = y;
    for (let s = 0; s < ax1.length; s++) { const z = a * y + ax1[s] - a * ay1[s]; ax1[s] = y; ay1[s] = z; y = z; }
    buf[idx] = y; idx = (idx + 1) % L; if (s0 + i >= 0) out[s0 + i] += cur;
  }
}
function txSynth(notes, sr, dur, o) {
  o = o || {}; const rnd = txRng(o.seed || 7), out = new Float32Array(Math.round(sr * dur)); notes.forEach(n => txPluck(out, sr, n.t, n.midi, n.vel || .8, o, rnd));
  if (o.snr != null) { let e = 0; for (let i = 0; i < out.length; i++) e += out[i] * out[i]; const rms = Math.sqrt(e / out.length), nz = rms * Math.pow(10, -o.snr / 20); for (let i = 0; i < out.length; i++) out[i] += (rnd() * 2 - 1) * nz * 1.7; }
  return out;
}
/** F1 between truth [{k,st,fret,midi}] and detected events */
function txScore(truth, events) {
  const det = []; events.forEach(e => e.notes.forEach(n => det.push({ k: e.k, st: n.st, fret: n.fret, midi: n.midi, tech: n.tech })));
  const used = new Array(det.length).fill(false); let tpP = 0, tpS = 0; truth.forEach(t => { const i = det.findIndex((d, j) => !used[j] && d.k === t.k && d.midi === t.midi); if (i >= 0) { used[i] = true; tpP++; if (det[i].st === t.st && det[i].fret === t.fret) tpS++; } });
  const P = det.length ? tpP / det.length : 0, R = truth.length ? tpP / truth.length : 0; return { truth: truth.length, det: det.length, tp: tpP, precision: P, recall: R, f1: P + R ? 2 * P * R / (P + R) : 0, sfAcc: tpP ? tpS / tpP : 0 };
}

/* >>> parts/09c-tx-ui.js */
/* ============================================================
   Part 09c · Transcribe pane — audio → tab (polyphonic), review, apply, consensus, self-test
   ============================================================ */
const TX = {
  src: '', file: null, res: null, rej: new Set(), busy: false, startBar: 1, tempo: 'song', shift: 0, cons: new Set(), auto: false, apply: 'replace', fillChords: true, bench: null, snapFirst: true, hover: null, lastMs: 0,
  p: Object.assign({ sens: .5, maxPoly: 6, grid: 1, offsetMs: 0, autoOffset: true, chordPrior: 1, camWeight: 1, techniques: true, legato: true, snapChord: true, minConf: 0 }, CFG.tx || {})
};
const txSave = () => { CFG.tx = TX.p; saveCfg(); };
const TXG = { 1: '16th', 2: '8th', 4: 'quarter' };

function txSource(id) {
  id = id || TX.src;
  if (id === 'file' && TX.file) return { id: 'file', name: TX.file.name, mono: TX.file.mono, sr: TX.file.sr, startSec: 0, cam: null, file: true };
  const tk = TAKES.find(t => t.id === id) || (id ? null : TAKES[TAKES.length - 1]); if (!tk) return null;
  return { id: tk.id, name: tk.name, mono: tk.dry || tk.wet, sr: tk.sr, startSec: tk.startSec, cam: tk.cam && tk.cam.length ? tk.cam : null, take: tk };
}
async function txImport(file) {
  try {
    toast('Decoding ' + file.name + '…'); const buf = await file.arrayBuffer(), AC = window.OfflineAudioContext || window.webkitOfflineAudioContext, c = new AC(1, 1, 44100), ab = await new Promise((res, rej) => c.decodeAudioData(buf, res, rej));
    const n = ab.length, mono = new Float32Array(n); for (let ch = 0; ch < ab.numberOfChannels; ch++) { const d = ab.getChannelData(ch); for (let i = 0; i < n; i++) mono[i] += d[i] / ab.numberOfChannels; }
    TX.file = { name: file.name, mono, sr: ab.sampleRate, dur: ab.duration }; TX.src = 'file'; toast('Loaded ' + file.name + ' (' + ab.duration.toFixed(1) + ' s)', 'ok'); txRefreshSrc();
  } catch (e) { console.error(e); toast('Could not decode that audio file: ' + (e.message || e), 'bad'); }
}
function txChordAt(k) {
  const N = spb(), bi = Math.floor(k / N); if (k < 0) return null; const fb = flatBars(), b = fb[bi]; if (!b) return null; const cs = barChords(b.bar); if (!cs.length) return null;
  return cs[Math.min(cs.length - 1, Math.floor((k % N) / N * cs.length))];
}
function txCx(src, startSec, dur) {
  return { tuning: S.tuning.slice(), capo: S.capo, maxFret: 22, a4: CFG.a4, slotDur: dur, swing: S.swing || 0, startSec, cam: src.cam, params: Object.assign({}, TX.p), voicings: sym => voicings(sym, S.tuning, S.capo, 9), chordAt: txChordAt, chordPrior: TX.p.chordPrior, camWeight: TX.p.camWeight };
}
async function txRun(srcs) {
  if (TX.busy) return; srcs = srcs.filter(Boolean); if (!srcs.length) return toast('Choose or record something to transcribe first', 'warn');
  TX.busy = true; txBusyUI(true); const t0 = performance.now(), results = [];
  try {
    for (let i = 0; i < srcs.length; i++) {
      const src = srcs[i]; let startSec = src.startSec, dur = slotDur(), tempoNote = '';
      if (src.file) {
        if (TX.tempo === 'detect') {
          txProg((i + .02) / srcs.length, 'Detecting tempo…'); await new Promise(r => setTimeout(r, 0)); const pp = txPrep(src.mono, src.sr), ons = txOnsets(pp.x, pp.fs, .65, false), tp = txTempo(ons);
          if (tp) { S.bpm = Math.round(tp.bpm * 10) / 10; commit(true); dur = slotDur(); startSec = -tp.phase; tempoNote = ' · tempo ' + S.bpm + ' BPM'; } else toast('Not enough onsets to detect a tempo — using the song tempo', 'warn');
        }
        if (TX.tempo !== 'detect' && TX.snapFirst) { txProg((i + .02) / srcs.length, 'Finding the first note…'); await new Promise(r => setTimeout(r, 0)); const pp = txPrep(src.mono, src.sr), ons = txOnsets(pp.x, pp.fs, .7, false); if (ons.length) startSec = -ons[0].t; }
        startSec += (TX.startBar - 1) * spb() * dur + TX.shift * dur;
      }
      const cx = txCx(src, startSec, dur), r = await txTranscribe(src.mono, src.sr, cx, (f, m) => txProg((i + f) / srcs.length, (srcs.length > 1 ? 'Take ' + (i + 1) + '/' + srcs.length + ' · ' : '') + m));
      r.src = src.name + tempoNote; results.push(r);
    }
    TX.res = results.length > 1 ? txConsensus(results) : results[0]; if (results.length > 1) TX.res.stats = Object.assign({}, TX.res.stats, { fs: results[0].stats.fs, tuneCents: mean(results.map(r => r.stats.tuneCents)), residAbs: mean(results.map(r => r.stats.residAbs)), residMean: mean(results.map(r => r.stats.residMean)), residSD: mean(results.map(r => r.stats.residSD).filter(isFinite)), meanConf: mean(TX.res.events.flatMap(e => e.notes.map(n => n.conf))) });
    TX.res.srcName = results.map(r => r.src).join(' + '); TX.lastMs = performance.now() - t0; TX.rej.clear(); TX.hover = null; txRender();
    const st = TX.res.stats; toast('Transcribed ' + st.notes + ' notes in ' + st.events + ' events (' + (TX.lastMs / 1000).toFixed(1) + ' s)', 'ok');
  } catch (e) { console.error(e); toast('Transcription failed: ' + (e.message || e), 'bad'); }
  TX.busy = false; txBusyUI(false);
}
function txGo() {
  const picked = TAKES.filter(t => TX.cons.has(t.id));
  if (picked.length > 1) return txRun(picked.map(t => txSource(t.id)));
  txRun([txSource()]);
}

/* ---------- apply to the song ---------- */
function txAccepted() {
  if (!TX.res) return []; const minc = TX.p.minConf;
  return TX.res.events.map(e => Object.assign({}, e, { notes: e.notes.filter(n => !TX.rej.has(e.k + ':' + n.midi) && n.conf >= minc) })).filter(e => e.notes.length && e.k >= 0);
}
function txApply() {
  const evs = txAccepted(); if (!evs.length) return toast('Nothing to apply — every note is rejected or below the confidence floor', 'warn');
  const N = spb(), b0 = Math.floor(evs[0].k / N), b1 = Math.floor(evs[evs.length - 1].k / N);
  if (!S.sections.length) S.sections.push(mkSection('Transcribed', ['']));
  while (flatBars().length <= b1) S.sections[S.sections.length - 1].bars.push(newBar(''));
  const bars = flatBars(); if (TX.apply === 'replace') for (let b = b0; b <= b1; b++) bars[b].bar.tab = [];
  let added = 0;
  evs.forEach(e => {
    const bar = bars[Math.floor(e.k / N)].bar, s = e.k % N;
    e.notes.forEach(n => {
      if (TX.apply === 'merge' && bar.tab.some(t => t.s === s && t.st === n.st)) return; bar.tab = bar.tab.filter(t => !(t.s === s && t.st === n.st));
      const o = { s, st: n.st, f: n.fret, t: n.tech || '' }; if (n.tech === 'b') o.bend = n.bendTo != null ? n.bendTo : n.fret + 2; bar.tab.push(o); added++;
    });
  });
  let named = 0;
  if (TX.fillChords) for (let b = b0; b <= b1; b++) {
    const bar = bars[b].bar; if (bar.chord) continue; const ns = []; evs.forEach(e => { if (Math.floor(e.k / N) === b) e.notes.forEach(n => ns.push({ midi: n.midi, rel: n.conf })); }); if (ns.length < 2) continue;
    const g = txGuess(ns)[0]; if (g) { bar.chord = pcName(g.r, keyUsesFlats(S.key, S.minor)) + g.q; named++; }
  }
  for (let b = b0; b <= b1; b++) bars[b].bar.tab.sort((a, c) => a.s - c.s || a.st - c.st);
  commit(true); toast('Applied ' + added + ' notes to bars ' + (b0 + 1) + '–' + (b1 + 1) + (named ? ' · named ' + named + ' chords' : '') + ' (Ctrl+Z undoes)', 'ok'); dockGo('tab');
}
function txAscii() {
  const evs = txAccepted(); if (!evs.length) return ''; const N = spb(), b0 = Math.floor(evs[0].k / N), b1 = Math.floor(evs[evs.length - 1].k / N), bars = [];
  for (let b = b0; b <= b1; b++) bars.push({ chord: '', tab: [] });
  evs.forEach(e => e.notes.forEach(n => { const o = { s: e.k % N, st: n.st, f: n.fret, t: n.tech || '' }; if (n.tech === 'b') o.bend = n.bendTo != null ? n.bendTo : n.fret + 2; bars[Math.floor(e.k / N) - b0].tab.push(o); }));
  return renderTabBars(bars, 68);
}

/* ---------- review canvas: six string lanes ---------- */
const TXV = { cw: 24, lane: 26, head: 22, pad: 6 };
function txRender() {
  txStats(); txDraw(); const pre = UI.txAscii; if (pre) pre.textContent = txAscii() || '(nothing accepted)';
  if (UI.txApplyBtn) UI.txApplyBtn.disabled = !TX.res;
}
function txDraw() {
  const cv = UI.txCv; if (!cv) return; const d = window.devicePixelRatio || 1, wrap = UI.txScroll; const res = TX.res;
  if (!res || !res.events.length) { cv.width = Math.max(10, wrap.clientWidth) * d; cv.height = 90 * d; const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.fillStyle = TL.col.muted; g.font = `${12 * d}px sans-serif`; g.fillText(res ? 'No notes found. Raise the sensitivity or check the input level.' : 'Transcription appears here — each note is placed on its string and fret, coloured by confidence.', 14 * d, 40 * d); cv.style.width = '100%'; cv.style.height = '90px'; return; }
  const N = spb(), evs = res.events, kmin = Math.floor(evs[0].k / N) * N, kmax = (Math.floor(evs[evs.length - 1].k / N) + 1) * N, W = Math.max(wrap.clientWidth, (kmax - kmin) * TXV.cw + 40), H = TXV.head + 6 * TXV.lane + TXV.pad;
  cv.width = W * d; cv.height = H * d; cv.style.width = W + 'px'; cv.style.height = H + 'px'; const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, W, H);
  const C = TL.col, x0 = 28, lbl = tabLabels();
  g.font = '600 10px ui-monospace,monospace'; g.textBaseline = 'middle';
  for (let s = 0; s < 6; s++) { const y = TXV.head + (5 - s) * TXV.lane + TXV.lane / 2; g.fillStyle = s % 2 ? C.p2 : 'transparent'; g.fillRect(0, y - TXV.lane / 2, W, TXV.lane); g.strokeStyle = C.line2; g.beginPath(); g.moveTo(x0, y); g.lineTo(W, y); g.stroke(); g.fillStyle = C.muted; g.textAlign = 'left'; g.fillText(lbl[5 - s] || '', 6, y); }
  for (let k = kmin; k <= kmax; k++) { const x = x0 + (k - kmin) * TXV.cw, isBar = (k % N) === 0, isBeat = (k % 4) === 0; if (!isBar && !isBeat) continue; g.strokeStyle = isBar ? C.text : C.grid; g.globalAlpha = isBar ? .55 : 1; g.beginPath(); g.moveTo(x, TXV.head - 4); g.lineTo(x, H - TXV.pad); g.stroke(); g.globalAlpha = 1; if (isBar) { g.fillStyle = C.muted; g.textAlign = 'left'; g.fillText(String(k / N + 1), x + 3, 8); const ch = txChordAt(k); if (ch) { g.fillStyle = C.accent; g.font = '700 11px ui-monospace,monospace'; g.fillText(ch, x + 18, 9); g.font = '600 10px ui-monospace,monospace'; } } }
  TX.hits = [];
  evs.forEach(e => e.notes.forEach(n => {
    const x = x0 + (e.k - kmin) * TXV.cw + 1, y = TXV.head + (5 - n.st) * TXV.lane + 3, w = TXV.cw - 3, hh = TXV.lane - 6, rej = TX.rej.has(e.k + ':' + n.midi), hue = 8 + n.conf * 120;
    g.globalAlpha = rej ? .28 : .35 + .65 * n.conf; g.fillStyle = rej ? C.muted : `hsl(${hue} 62% 46%)`; g.beginPath(); (g.roundRect ? g.roundRect(x, y, w, hh, 5) : g.rect(x, y, w, hh)); g.fill();
    if (n.inferred) { g.setLineDash([3, 2]); g.strokeStyle = C.text; g.lineWidth = 1; g.stroke(); g.setLineDash([]); } g.globalAlpha = rej ? .5 : 1;
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '700 11px ui-monospace,monospace'; g.fillText(String(n.fret), x + w / 2 - (n.tech ? 3 : 0), y + hh / 2 + .5); if (n.tech) { g.font = '700 9px ui-monospace,monospace'; g.fillText(n.tech, x + w - 5, y + 5); }
    if (n.camHit) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 4, y + hh - 4, 2, 0, 7); g.fill(); } if (rej) { g.strokeStyle = C.text; g.beginPath(); g.moveTo(x + 2, y + hh - 2); g.lineTo(x + w - 2, y + 2); g.stroke(); }
    g.globalAlpha = 1; TX.hits.push({ x, y, w, h: hh, e, n });
  }));
  g.font = '600 10px ui-monospace,monospace';
}
function txHit(ev) { const r = UI.txCv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top; return (TX.hits || []).find(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h); }
function txInfoText(q) {
  if (!q) return 'Hover a note for details · click to accept / reject · rejected notes are ignored when applying';
  const n = q.n, e = q.e; return pcName(n.midi % 12) + (Math.floor(n.midi / 12) - 1) + ' · string ' + (6 - n.st) + ' fret ' + n.fret + ' · bar ' + (Math.floor(e.k / spb()) + 1) + ' slot ' + (e.k % spb() + 1) + ' · confidence ' + (n.conf * 100).toFixed(0) + '%' + (n.tech ? ' · ' + ({ h: 'hammer-on', p: 'pull-off', '/': 'slide up', '\\': 'slide down', '~': 'vibrato', b: 'bend' }[n.tech] || n.tech) : '') + (n.inferred ? ' · inferred from chord shape' : '') + (n.camHit ? ' · camera agrees' : '') + (e.res != null ? ' · timing ' + (e.res * 1000 >= 0 ? '+' : '') + (e.res * 1000).toFixed(0) + ' ms off grid' : '');
}
function txStats() {
  const box = UI.txStats; if (!box) return; box.innerHTML = ''; const r = TX.res; if (!r) return; const st = r.stats, sg = (l, v, s) => h('div', { class: 'stat' }, h('span', {}, l), h('b', {}, v), h('small', {}, s || ''));
  const acc = txAccepted(), nAcc = acc.reduce((a, e) => a + e.notes.length, 0), f = (v, d = 1) => v == null || !isFinite(v) ? '—' : v.toFixed(d);
  box.append(sg('Notes', String(st.notes), nAcc + ' accepted'), sg('Events', String(st.events), (st.onsets != null ? st.onsets + ' onsets' : (st.takes + ' takes · ≥' + st.need + ' agree'))),
    sg('Mean confidence', st.meanConf != null ? (st.meanConf * 100).toFixed(0) + '%' : '—', 'per-note average'), sg('Tuning offset', f(st.tuneCents) + ' ¢', 'estimated from partials'),
    sg('Timing', f(st.residAbs) + ' ms', 'mean |error|, σ ' + f(st.residSD) + ' ms'), sg('Grid offset', f(st.autoOffsetMs) + ' ms', 'auto-aligned'), sg('Analysis rate', f(st.fs ? st.fs / 1000 : null, 1) + ' kHz', 'decimated · ' + (TX.lastMs / 1000).toFixed(1) + ' s run'));
  if (UI.txHist && r.events.length) {
    const c = UI.txHist, d = window.devicePixelRatio || 1; c.width = c.clientWidth * d; c.height = c.clientHeight * d;
    const bins = new Array(13).fill(0); r.events.forEach(e => { if (e.res == null) return; const ms = e.res * 1000, i = clamp(Math.round(ms / 10) + 6, 0, 12); bins[i]++; });
    barChart(c, bins, bins.map((_, i) => ((i - 6) * 10) + ''), TL.col.accent2 || TL.col.accent);
  }
}
function txBusyUI(b) { if (UI.txGo) { UI.txGo.disabled = b; UI.txGo.textContent = b ? 'Transcribing…' : '✦ Transcribe'; } if (UI.txBar) UI.txBar.parentNode.parentNode.style.display = b ? '' : 'none'; if (UI.txBench) UI.txBench.disabled = b; }
function txProg(f, m) { if (UI.txBar) { UI.txBar.style.width = clamp(f * 100, 0, 100) + '%'; UI.txBarT.textContent = m || ''; } }
function txRefreshSrc() {
  const sel = UI.txSrc; if (!sel) return; const cur = TX.src; sel.innerHTML = '';
  if (!TAKES.length && !TX.file) sel.append(h('option', { value: '' }, 'No takes yet — record one or import audio'));
  TAKES.forEach(t => sel.append(h('option', { value: t.id, selected: t.id === cur }, (t.kind === 'vox' ? '🎤 ' : '') + t.name + ' · ' + t.dur.toFixed(1) + ' s' + (t.cam && t.cam.length ? ' · 📷 fret log' : ''))));
  if (TX.file) sel.append(h('option', { value: 'file', selected: cur === 'file' }, '📁 ' + TX.file.name + ' · ' + TX.file.dur.toFixed(1) + ' s'));
  if (!cur && TAKES.length) { TX.src = (TAKES.filter(x => x.kind !== 'vox').pop() || TAKES[TAKES.length - 1]).id; sel.value = TX.src; }
  const L = UI.txCons; if (L) { L.innerHTML = ''; if (TAKES.length < 2) L.append(h('div', { class: 'tiny muted' }, 'Record two or more takes of the same part to unlock consensus transcription — notes that most takes agree on survive; random misses and ghosts drop out.')); TAKES.forEach(t => L.append(h('label', { class: 'chk', style: { display: 'flex', gap: '5px', alignItems: 'center', fontSize: '12px', fontWeight: 600 } }, h('input', { type: 'checkbox', checked: TX.cons.has(t.id), onchange: e => { e.target.checked ? TX.cons.add(t.id) : TX.cons.delete(t.id); UI.txGo.textContent = TX.cons.size > 1 ? '✦ Transcribe ' + TX.cons.size + ' takes (consensus)' : '✦ Transcribe'; } }), t.name))); }
  if (UI.txFileBox) UI.txFileBox.style.display = cur === 'file' ? '' : 'none';
}

/* ---------- self-test: synthetic guitar with known ground truth ---------- */
function txSuite(rngSeed) {
  const rnd = txRng(rngSeed || 11), tun = S.tuning, capo = S.capo, cases = [], dur = slotDur();
  const pick = a => a[Math.floor(rnd() * a.length)], syms = ['C', 'G', 'Am', 'F', 'Em', 'D', 'Dm', 'E', 'A'];
  const mk = (name, bars, chordFn) => { const truth = [], notes = []; bars.forEach((b, bi) => b.forEach(([s, list]) => { const k = bi * spb() + s; list.forEach(([st, f], j) => { const midi = tun[st] + capo + f; truth.push({ k, st, fret: f, midi }); notes.push({ k, midi, j, vel: .55 + .35 * rnd() }); }); })); return { name, truth, notes, chordFn, bars: bars.length }; };
  const shape = sym => { const v = voicings(sym, tun, capo, 1)[0]; if (!v) return null; const out = []; v.frets.forEach((f, st) => { if (f != null) out.push([st, f]); }); return out; };
  const chs = []; for (let i = 0; i < 4; i++) { const s = pick(syms), sh = shape(s); if (sh) chs.push({ s, sh }); }
  cases.push(mk('Strummed chords', chs.map(c => [[0, c.sh], [8, c.sh.slice().reverse().slice(0, Math.max(3, c.sh.length - 1)).reverse()]]), k => chs[Math.floor(k / spb())] && chs[Math.floor(k / spb())].s));
  const arp = []; for (let i = 0; i < 3; i++) { const s = pick(syms), sh = shape(s); if (!sh) continue; const b = []; for (let j = 0; j < 8; j++) b.push([j * 2, [sh[[0, 2, 1, 3, 2, 3, 1, 3][j] % sh.length]]]); arp.push({ s, b }); }
  cases.push(mk('Fingerstyle arpeggios', arp.map(a => a.b), k => arp[Math.floor(k / spb())] && arp[Math.floor(k / spb())].s));
  const mel = []; for (let bar = 0; bar < 4; bar++) { const b = []; let f = pick([0, 2, 3, 5]); for (let s = 0; s < 16; s += pick([2, 2, 4, 4, 6])) { f = clamp(f + pick([-2, -1, 0, 1, 2, 3]), 0, 12); b.push([s, [[pick([3, 4, 5]), f]]]); } mel.push(b); }
  cases.push(mk('Single-note melody', mel, () => null));
  const bm = []; for (let i = 0; i < 4; i++) { const s = pick(syms), sh = shape(s); if (!sh) continue; const lo = sh[0], b = [[0, [lo]]]; let f = pick([1, 3, 5]); [4, 6, 8, 12].forEach(sl => { f = clamp(f + pick([-2, -1, 1, 2]), 0, 10); b.push([sl, [[pick([4, 5]), f]]]); }); bm.push({ s, b }); }
  cases.push(mk('Bass + melody', bm.map(a => a.b), k => bm[Math.floor(k / spb())] && bm[Math.floor(k / spb())].s));
  return cases;
}
async function txBench() {
  if (TX.busy) return; TX.busy = true; txBusyUI(true); const snr = +UI.txSnr.value || null, jit = +UI.txJit.value / 1000, rows = [], sr = 44100;
  try {
    const cases = txSuite(+UI.txSeed.value || 11); let tot = { tp: 0, det: 0, truth: 0, sf: 0 };
    for (let ci = 0; ci < cases.length; ci++) {
      const c = cases[ci], dur = slotDur(), lead = .5, rnd = txRng(100 + ci), notes = c.notes.map(n => ({ t: lead + n.k * dur + (n.k % 2 ? (S.swing || 0) * dur : 0) + n.j * .011 + (jit ? (rnd() - .5) * 2 * jit : 0), midi: n.midi, vel: n.vel }));
      const total = lead + c.bars * spb() * dur + 2, audio = txSynth(notes, sr, total, { seed: 3 + ci, snr: snr || undefined });
      txProg(ci / cases.length, 'Synthesising & transcribing: ' + c.name); await new Promise(r => setTimeout(r, 0));
      const cx = txCx({ cam: null }, -lead, dur); cx.chordAt = c.chordFn; cx.params = Object.assign({}, TX.p, { autoOffset: true }); const t0 = performance.now(), r = await txTranscribe(audio, sr, cx);
      const sc = txScore(c.truth, r.events); rows.push({ name: c.name, sc, ms: performance.now() - t0, audioSec: total, resid: r.stats.residAbs, fpTech: r.events.reduce((a, e) => a + e.notes.filter(n => n.tech).length, 0) }); tot.tp += sc.tp; tot.det += sc.det; tot.truth += sc.truth; tot.sf += sc.sfAcc * sc.tp;
    }
    const P = tot.det ? tot.tp / tot.det : 0, R = tot.truth ? tot.tp / tot.truth : 0; TX.bench = { rows, P, R, F1: P + R ? 2 * P * R / (P + R) : 0, sf: tot.tp ? tot.sf / tot.tp : 0, snr, jitMs: jit * 1000, when: new Date().toISOString(), tuning: S.tuning.slice(), capo: S.capo, bpm: S.bpm };
  } catch (e) { console.error(e); toast('Self-test failed: ' + e.message, 'bad'); }
  TX.busy = false; txBusyUI(false); txBenchRender();
}
function txBenchRender() {
  const box = UI.txBenchOut; if (!box) return; box.innerHTML = ''; const b = TX.bench; if (!b) { box.append(h('div', { class: 'tiny muted' }, 'Runs the engine on synthetic Karplus-Strong guitar with known ground truth, in this browser, with your current tuning, capo, tempo and settings.')); return; }
  const pc = v => (v * 100).toFixed(0) + '%', tb = h('table', { class: 'tbl', style: { width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)', fontSize: '11px' } });
  tb.append(h('tr', { style: { textAlign: 'left', color: 'var(--muted)' } }, ['Case', 'Precision', 'Recall', 'F1', 'String/fret', 'Timing', 'Speed', 'Spurious tech'].map(t => h('th', { style: { padding: '2px 6px' } }, t))));
  b.rows.forEach(r => tb.append(h('tr', {}, [r.name, pc(r.sc.precision), pc(r.sc.recall), pc(r.sc.f1), pc(r.sc.sfAcc), r.resid != null ? r.resid.toFixed(1) + ' ms' : '—', (r.audioSec / (r.ms / 1000)).toFixed(0) + '× real-time', String(r.fpTech)].map((t, i) => h('td', { style: { padding: '2px 6px', fontWeight: i === 0 ? 700 : 500 } }, t)))));
  tb.append(h('tr', { style: { borderTop: '1px solid var(--line2)', fontWeight: 800 } }, ['All cases', pc(b.P), pc(b.R), pc(b.F1), pc(b.sf), '', '', String(b.rows.reduce((a, r) => a + r.fpTech, 0))].map(t => h('td', { style: { padding: '3px 6px' } }, t))));
  box.append(tb, h('div', { class: 'tiny muted', style: { marginTop: '5px', lineHeight: 1.5 } }, 'Noise ' + (b.snr ? b.snr + ' dB SNR' : 'off') + ' · timing humanise ±' + b.jitMs.toFixed(0) + ' ms · F1 counts a note correct when slot and pitch both match; string/fret is scored on the correct-pitch notes. Synthetic audio is cleaner than a real room — treat these numbers as an upper bound.'));
}
function txReport() {
  const r = TX.res; if (!r && !TX.bench) return toast('Nothing to export yet', 'warn');
  const rep = { tool: BRAND.name + ' transcription report', when: new Date().toISOString(), song: { title: S.title, bpm: S.bpm, ts: S.ts, tuning: S.tuning, capo: S.capo, swing: S.swing }, settings: TX.p, source: r && r.srcName, stats: r && r.stats, events: r && r.events.map(e => ({ slot: e.k, bar: Math.floor(e.k / spb()) + 1, residMs: e.res != null ? +(e.res * 1000).toFixed(1) : null, chord: e.sym, notes: e.notes.map(n => ({ midi: n.midi, string: 6 - n.st, fret: n.fret, conf: +n.conf.toFixed(3), tech: n.tech || null, inferred: n.inferred, camera: n.camHit, rejected: TX.rej.has(e.k + ':' + n.midi) })) })), benchmark: TX.bench };
  download((S.title || 'song').replace(/\W+/g, '_') + '_transcription.json', JSON.stringify(rep, null, 1), 'application/json');
}

/* ---------- pane ---------- */
function buildTxPane() {
  const p = PANES.tx; if (!p) return;
  const lab = (t, w) => h('label', { style: { fontSize: '11px', fontWeight: 700, color: 'var(--muted)', display: 'block', margin: '8px 0 2px' } }, t, w || '');
  const rng = (key, min, max, step, fmt) => { const out = h('b', { class: 'mono', style: { marginLeft: '6px', color: 'var(--text)' } }, fmt(TX.p[key])); const inp = h('input', { type: 'range', min, max, step, value: TX.p[key], style: { width: '100%' }, oninput: e => { TX.p[key] = +e.target.value; out.textContent = fmt(TX.p[key]); txSave(); } }); return [out, inp]; };
  const chk = (key, label, tip) => h('label', { class: 'chk', title: tip || '', style: { display: 'flex', gap: '5px', alignItems: 'center', fontSize: '12px', fontWeight: 600 } }, h('input', { type: 'checkbox', checked: TX.p[key], onchange: e => { TX.p[key] = e.target.checked; txSave(); } }), label);
  const slider = (label, key, min, max, step, fmt) => { const [o, i] = rng(key, min, max, step, fmt); return h('div', {}, lab(label, o), i); };
  UI.txSrc = h('select', { class: 'in', style: { width: '100%', fontFamily: 'var(--sans)' }, onchange: e => { TX.src = e.target.value; txRefreshSrc(); } });
  UI.txCons = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' } });
  const fileIn = h('input', { type: 'file', accept: 'audio/*,.wav,.mp3,.m4a,.flac,.ogg', style: { display: 'none' }, onchange: e => { if (e.target.files[0]) txImport(e.target.files[0]); e.target.value = ''; } });
  UI.txFileBox = h('div', { style: { display: 'none', marginTop: '6px', padding: '6px 8px', border: '1px solid var(--line2)', borderRadius: '8px', background: 'var(--panel2)' } },
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, h('label', { class: 'small', style: { fontWeight: 700 } }, 'Starts at bar ', h('input', { class: 'in', type: 'number', min: 1, max: 999, value: TX.startBar, style: { width: '56px' }, onchange: e => { TX.startBar = Math.max(1, +e.target.value || 1); } })),
      h('label', { class: 'small', style: { fontWeight: 700 } }, 'Shift slots ', h('input', { class: 'in', type: 'number', min: -64, max: 64, value: TX.shift, style: { width: '56px' }, onchange: e => { TX.shift = +e.target.value || 0; } }))),
    h('label', { class: 'chk', style: { display: 'flex', gap: '5px', alignItems: 'center', fontSize: '12px', fontWeight: 600, marginTop: '6px' } }, h('input', { type: 'checkbox', checked: TX.snapFirst, onchange: e => { TX.snapFirst = e.target.checked; } }), 'Put the first note on the bar line'),
    h('div', { class: 'seg', style: { marginTop: '6px' } }, [['song', 'Use song tempo'], ['detect', 'Detect tempo']].map(([v, n]) => h('button', { class: TX.tempo === v ? 'on' : '', onclick: e => { TX.tempo = v; $$('button', e.target.parentNode).forEach(b => b.classList.toggle('on', b === e.target)); } }, n))),
    h('div', { class: 'tiny muted', style: { marginTop: '4px', lineHeight: 1.4 } }, 'For imported recordings: “Detect tempo” estimates BPM and the beat phase from the audio and sets the song tempo to match; otherwise your song’s tempo is used and bar 1 starts at the clip’s first beat.'));
  UI.txBar = h('div', { style: { height: '100%', width: '0%', background: 'var(--accent)', borderRadius: '4px', transition: 'width .15s' } }); UI.txBarT = h('div', { class: 'tiny mono muted', style: { marginTop: '3px' } }, '');
  UI.txGo = h('button', { class: 'btn primary', style: { flex: 1 }, onclick: txGo }, '✦ Transcribe');
  const left = h('div', { class: 'card', style: { flex: '0 0 330px', minWidth: '280px' } }, h('h4', {}, 'Source & detection'), h('div', { class: 'card-b' },
    lab('Take or imported audio'), UI.txSrc, h('div', { class: 'row', style: { gap: '6px', marginTop: '6px', flexWrap: 'wrap' } }, h('button', { class: 'btn sm', onclick: () => fileIn.click() }, '📁 Import audio…'), fileIn,
      h('button', { class: 'btn sm', title: 'Arms the recorder, plays the count-in and starts a take. Transcription runs automatically when you stop.', onclick: () => { TX.auto = true; toast('Recording — the take will be transcribed when you stop (Space)'); toggleRec(); } }, '● Record & transcribe')),
    samplesShelf(f => txImport(f), 'SAMPLES'), UI.txFileBox, UI.txCons,
    slider('Sensitivity', 'sens', 0, 1, .01, v => (v * 100).toFixed(0) + '%'),
    slider('Max simultaneous notes', 'maxPoly', 1, 6, 1, v => String(v)),
    h('div', {}, lab('Quantise to'), h('div', { class: 'seg' }, [[1, '16th'], [2, '8th'], [4, 'quarter']].map(([v, n]) => h('button', { class: TX.p.grid === v ? 'on' : '', onclick: e => { TX.p.grid = v; txSave(); $$('button', e.target.parentNode).forEach(b => b.classList.toggle('on', b === e.target)); } }, n)))),
    h('div', { class: 'row', style: { gap: '12px', flexWrap: 'wrap', marginTop: '8px' } }, chk('autoOffset', 'Auto-align timing', 'Searches ±70 ms for the grid offset that minimises timing error (latency, rushing or dragging)'), chk('techniques', 'Bends & vibrato'), chk('legato', 'Hammer-ons / pull-offs / slides', 'Reads soft attacks that change pitch without a new pluck')),
    slider('Manual timing offset', 'offsetMs', -120, 120, 1, v => (v > 0 ? '+' : '') + v + ' ms'),
    h('div', { style: { borderTop: '1px solid var(--line)', margin: '10px 0 2px' } }), h('div', { class: 'tiny', style: { fontWeight: 800, letterSpacing: '.08em', color: 'var(--muted)', textTransform: 'uppercase' } }, 'Musical priors'),
    h('div', { class: 'row', style: { marginTop: '6px' } }, chk('snapChord', 'Chord-shape repair', 'Tests the bar’s chord voicings against the spectrum and keeps the one that explains the audio best — recovers octave-doubled strings')),
    slider('Chord-shape influence on fretting', 'chordPrior', 0, 2, .05, v => v.toFixed(2)),
    slider('Camera-log influence', 'camWeight', 0, 2, .05, v => v.toFixed(2)),
    slider('Hide notes below confidence', 'minConf', 0, .9, .01, v => (v * 100).toFixed(0) + '%'),
    h('div', { class: 'row', style: { marginTop: '12px', gap: '6px' } }, UI.txGo),
    h('div', { style: { display: 'none', marginTop: '8px' } }, h('div', { style: { height: '7px', background: 'var(--panel2)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--line)' } }, UI.txBar), UI.txBarT)));
  UI.txCv = h('canvas', { style: { display: 'block', cursor: 'pointer' } }); UI.txScroll = h('div', { style: { overflowX: 'auto', overflowY: 'hidden', border: '1px solid var(--line)', borderRadius: '9px', background: 'var(--panel)' } }, UI.txCv);
  UI.txInfo = h('div', { class: 'tiny mono muted', style: { minHeight: '15px', marginTop: '5px' } }, txInfoText(null));
  UI.txCv.addEventListener('mousemove', ev => { const q = txHit(ev); UI.txInfo.textContent = txInfoText(q); UI.txCv.style.cursor = q ? 'pointer' : 'default'; });
  UI.txCv.addEventListener('click', ev => { const q = txHit(ev); if (!q) return; const key = q.e.k + ':' + q.n.midi; TX.rej.has(key) ? TX.rej.delete(key) : TX.rej.add(key); txRender(); });
  UI.txStats = h('div', { class: 'stat-grid', style: { marginTop: '8px' } }); UI.txHist = h('canvas', { style: { width: '100%', height: '70px', marginTop: '8px' } });
  UI.txAscii = h('pre', { class: 'mono', style: { margin: 0, padding: '8px 10px', background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: '8px', fontSize: '11.5px', overflow: 'auto', maxHeight: '220px', lineHeight: 1.25 } }, '');
  UI.txApplyBtn = h('button', { class: 'btn primary', disabled: true, onclick: txApply }, '⤵ Apply to song');
  const modeSeg = h('div', { class: 'seg' }, [['replace', 'Replace bars'], ['merge', 'Merge into empty slots']].map(([v, n]) => h('button', { class: TX.apply === v ? 'on' : '', onclick: e => { TX.apply = v; $$('button', e.target.parentNode).forEach(b => b.classList.toggle('on', b === e.target)); } }, n)));
  const right = h('div', { style: { flex: '1 1 480px', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '10px' } },
    h('div', { class: 'card' }, h('h4', {}, 'Review'), h('div', { class: 'card-b' }, UI.txScroll, UI.txInfo, UI.txStats,
      h('div', { class: 'tiny muted', style: { margin: '8px 0 2px', fontWeight: 700 } }, 'Timing error per event (ms off the grid)'), UI.txHist)),
    h('div', { class: 'card' }, h('h4', {}, 'Tab preview'), h('div', { class: 'card-b' }, UI.txAscii,
      h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', marginTop: '8px' } }, UI.txApplyBtn, modeSeg, h('label', { class: 'chk', style: { display: 'flex', gap: '5px', alignItems: 'center', fontSize: '12px', fontWeight: 600 } }, h('input', { type: 'checkbox', checked: TX.fillChords, onchange: e => { TX.fillChords = e.target.checked; } }), 'Name empty bars’ chords'),
        h('span', { class: 'grow' }), h('button', { class: 'btn sm', onclick: () => { const t = UI.txAscii.textContent; if (t) { copyText(t); toast('Tab copied', 'ok'); } } }, 'Copy tab'), h('button', { class: 'btn sm', onclick: txReport }, 'Export report (JSON)')))),
    h('div', { class: 'card' }, h('h4', {}, 'Self-test · synthetic ground truth'), h('div', { class: 'card-b' },
      h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', marginBottom: '8px' } },
        h('label', { class: 'small', style: { fontWeight: 700 } }, 'Noise ', (UI.txSnr = h('select', { class: 'in', style: { width: 'auto', fontFamily: 'var(--sans)' } }, [['0', 'none'], ['30', '30 dB SNR'], ['20', '20 dB SNR'], ['12', '12 dB SNR']].map(([v, n]) => h('option', { value: v }, n))))),
        h('label', { class: 'small', style: { fontWeight: 700 } }, 'Timing humanise ', (UI.txJit = h('select', { class: 'in', style: { width: 'auto', fontFamily: 'var(--sans)' } }, [['0', '±0 ms'], ['15', '±15 ms'], ['30', '±30 ms']].map(([v, n]) => h('option', { value: v }, n))))),
        h('label', { class: 'small', style: { fontWeight: 700 } }, 'Seed ', (UI.txSeed = h('input', { class: 'in', type: 'number', value: 11, style: { width: '58px' } }))),
        (UI.txBench = h('button', { class: 'btn sm primary', onclick: txBench }, '▶ Run self-test'))),
      (UI.txBenchOut = h('div', {})))));
  p.append(h('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' } }, left, right));
  txRefreshSrc(); txBenchRender(); txDraw();
  bus.on('takes', txRefreshSrc);
  bus.on('rec:done', () => { if (!TX.auto) return; TX.auto = false; const t = TAKES.filter(x => x.kind !== 'vox').pop(); if (!t) return; TX.src = t.id; txRefreshSrc(); dockGo('tx'); setTimeout(() => txRun([txSource(t.id)]), 120); });
  bus.on('dock', id => { if (id === 'tx') setTimeout(() => { txDraw(); txStats(); }, 30); });
  bus.on('theme', () => setTimeout(() => { txDraw(); txStats(); }, 30));
  new ResizeObserver(() => { if (paneVisible('tx')) txDraw(); }).observe(p);
}

/* >>> parts/09d-camfx.js */
/* ---------- camera look: dimmed backdrop · edges in · me in front (person cut-out) ----------
   'over'   the camera is a dim layer under the visuals (the original look)
   'edges'  the camera shows clearly in a soft oval in the middle; the visuals live around it
   'person' a green-screen cut-out: the visuals sit behind you. Uses MediaPipe's selfie segmenter, fetched only when this look is chosen
            (same hosts as hand tracking). If the model cannot load, the edges look is used instead. */
const CAMFX = [['over', 'Dimmed behind the visuals'], ['edges', 'Visuals frame me (edges in)'], ['person', 'Me in front (green screen)']];
const CF = { state: 'idle', seg: null, mask: null, acc: null, inv: null, t: 0, busy: false, fg: null, ed: null, mc: null, errN: 0 };
let mpCache = null;
function mpVision() {
  return mpCache || (mpCache = import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs')
    .then(async mod => ({ mod, fs: await mod.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm') }))
    .catch(e => { mpCache = null; throw e; }));
}
function camBox(W, H) { const v = CAM.video, vr = v.videoWidth / v.videoHeight, cr = W / H; let dw = W, dh = H, dx = 0, dy = 0; if (vr > cr) { dw = H * vr; dx = (W - dw) / 2; } else { dh = W / vr; dy = (H - dh) / 2; } return { dx, dy, dw, dh }; }
function camPaint(g, W, H, src) { const b = camBox(W, H); g.save(); if (CFG.mirror) { g.translate(W, 0); g.scale(-1, 1); } g.drawImage(src, b.dx, b.dy, b.dw, b.dh); g.restore(); }
/** draw the camera on top of the finished visuals, per the chosen look */
function camTop(g, W, H) {
  const v = CAM.video, fx = CFG.camFx || 'over'; if (!v || v.readyState < 2 || fx === 'over') return;
  if (fx === 'person' && CF.state === 'ready' && CF.mask) {
    const fc = CF.fg || (CF.fg = document.createElement('canvas')); if (fc.width !== W || fc.height !== H) { fc.width = W; fc.height = H; }
    const f = fc.getContext('2d'); f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, W, H);
    try { f.filter = 'blur(' + Math.max(1, Math.round(W / 800)) + 'px)'; } catch (e) { }
    camPaint(f, W, H, CF.mask); try { f.filter = 'none'; } catch (e) { }
    f.globalCompositeOperation = 'source-in'; camPaint(f, W, H, v); g.drawImage(fc, 0, 0); return;
  }
  const ec = CF.ed || (CF.ed = document.createElement('canvas')); if (ec.width !== W || ec.height !== H) { ec.width = W; ec.height = H; }
  const e = ec.getContext('2d'); e.globalCompositeOperation = 'source-over'; e.clearRect(0, 0, W, H); camPaint(e, W, H, v);
  const r = clamp(CFG.camClear == null ? .55 : CFG.camClear, .2, .95); e.globalCompositeOperation = 'destination-in'; e.save(); e.translate(W / 2, H / 2); e.scale(W / 2 * r, H / 2 * Math.min(1, r * 1.12));
  const gr = e.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.58, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); e.fillStyle = gr; e.fillRect(-1, -1, 2, 2); e.restore();
  g.save(); g.globalAlpha = .97; g.drawImage(ec, 0, 0); g.restore();
}
/** feed one segmentation mask (floats 0..1, w×h): works out which way round it is, smooths it, and keeps it as an alpha canvas */
function cfFeed(a, w, hh) {
  const sw = Math.min(w, 256), sh = Math.max(1, Math.round(sw * hh / w)), n = sw * sh; if (!CF.acc || CF.acc.length !== n) { CF.acc = new Float32Array(n).fill(-1); CF.mc = null; }
  const raw = new Float32Array(n); let cs = 0, cn = 0, es = 0, en = 0;
  for (let y = 0; y < sh; y++) { const sy = Math.min(hh - 1, Math.floor(y * hh / sh)) * w, fy = y / sh; for (let x = 0; x < sw; x++) {
    const v = a[sy + Math.min(w - 1, Math.floor(x * w / sw))]; raw[y * sw + x] = v; const fx = x / sw;
    if (fx > .35 && fx < .65 && fy > .3 && fy < .8) { cs += v; cn++; } else if (fx < .12 || fx > .88) { es += v; en++; } } }
  const d = cs / Math.max(1, cn) - es / Math.max(1, en);   // a person normally fills the middle and the room fills the sides
  if (Math.abs(d) > .3) CF.inv = d < 0;
  const inv = !!CF.inv, mc = CF.mc || (CF.mc = Object.assign(document.createElement('canvas'), { width: sw, height: sh })), mg = mc.getContext('2d'), im = mg.createImageData(sw, sh), D = im.data;
  for (let i = 0; i < n; i++) {
    let v = inv ? 1 - raw[i] : raw[i]; v = clamp((v - .3) / .4, 0, 1); v = v * v * (3 - 2 * v); const o = CF.acc[i] < 0 ? v : CF.acc[i] * .45 + v * .55; CF.acc[i] = o;
    D[i * 4] = D[i * 4 + 1] = D[i * 4 + 2] = 255; D[i * 4 + 3] = Math.round(o * 255);
  }
  mg.putImageData(im, 0, 0); CF.mask = mc;
}
async function cfSegInit() {
  if (CF.state !== 'idle') return; CF.state = 'loading'; if (UI.camInfo) UI.camInfo.textContent += ' · loading cut-out…';
  try {
    const { mod, fs } = await mpVision(), base = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
    const opt = d => ({ baseOptions: { modelAssetPath: base, delegate: d }, runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false });
    try { CF.seg = await mod.ImageSegmenter.createFromOptions(fs, opt('GPU')); } catch (e) { CF.seg = await mod.ImageSegmenter.createFromOptions(fs, opt('CPU')); }
    CF.state = 'ready'; CF.errN = 0; toast('Person cut-out ready', 'ok');
  } catch (e) { CF.state = 'failed'; console.warn('segmenter unavailable', e); toast('The person cut-out model could not load (offline or blocked), so the edges-in look is used instead', 'warn'); }
}
function cfWanted() { if ((CFG.camFx || 'over') !== 'person' || !CAM.on) return false; let st = false; try { st = !!(typeof scn === 'function' && scn() && scn().cam); } catch (e) { } return !!VZ.cam || st; }
function cfTick(ts) {
  if (!cfWanted()) return; if (CF.state === 'idle') { cfSegInit(); return; }
  if (CF.state !== 'ready' || CF.busy || ts - CF.t < (CFG.vq >= 1 ? 45 : 90)) return; CF.t = ts; CF.busy = true;
  try { CF.seg.segmentForVideo(CAM.video, performance.now(), r => { try { const ms = r && r.confidenceMasks; if (ms && ms.length) { const m = ms.length > 1 ? ms[1] : ms[0]; cfFeed(m.getAsFloat32Array(), m.width, m.height); } } finally { CF.busy = false; } }); }
  catch (e) { CF.busy = false; if (++CF.errN > 5) { CF.state = 'failed'; CF.mask = null; toast('Person cut-out stopped working, so the edges-in look is used instead', 'warn'); } }
}
/** the “Camera look” control, shared by the Visuals tab and Stage */
function camFxBox() {
  const clr = h('input', { type: 'range', min: .25, max: .9, step: .05, value: CFG.camClear == null ? .55 : CFG.camClear, title: 'Size of the clear centre', 'aria-label': 'Size of the clear centre', style: { width: '90px' }, oninput: e => { CFG.camClear = +e.target.value; }, onchange: () => saveCfg() });
  const sync = () => { clr.style.display = (CFG.camFx || 'over') === 'edges' ? '' : 'none'; };
  const sel = h('select', { class: 'in', style: { width: 'auto', fontFamily: 'var(--sans)' }, title: 'How the camera sits with the visuals', 'aria-label': 'Camera look', onchange: e => { CFG.camFx = e.target.value; saveCfg(); if (CF.state === 'failed') CF.state = 'idle'; sync(); } }, CAMFX.map(([v, n]) => h('option', { value: v, selected: (CFG.camFx || 'over') === v }, '📷 ' + n)));
  sync(); return h('span', { class: 'row camfx', style: { gap: '6px' } }, sel, clr);
}

/* >>> parts/10-main.js */
/* ============================================================
   Part 10 · boot, frame loop, wiring
   ============================================================ */
const FOCUSRITE_RE = /focusrite|scarlett|clarett|vocaster|saffire|2i2|4i4|solo usb|18i/i;
let mfd = null;
function drawMini() {
  const cv = UI.mini; if (!cv || !E.ready || !E.anaRig) return; const d = window.devicePixelRatio || 1, w = cv.clientWidth, hh = 90;
  if (!w) return; if (cv.width !== Math.floor(w * d)) { cv.width = Math.floor(w * d); cv.height = Math.floor(hh * d); }
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, an = E.anaRig; if (!mfd || mfd.length !== an.frequencyBinCount) mfd = new Float32Array(an.frequencyBinCount); an.getFloatFrequencyData(mfd);
  g.fillStyle = '#050b0c'; g.fillRect(0, 0, W, H); const bh = E.ctx.sampleRate / an.fftSize, fmin = 30, fmax = 16000, lr = Math.log(fmax / fmin), C = vcol();
  g.beginPath(); g.moveTo(0, H); for (let x = 0; x < W; x += 2) { const f = fmin * Math.exp(lr * x / W), k = clamp(Math.round(f / bh), 1, mfd.length - 1); const v = clamp((mfd[k] + 100) / 80, 0, 1); g.lineTo(x, H - v * H); } g.lineTo(W, H); g.closePath();
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, C.b); gr.addColorStop(1, C.a); g.fillStyle = gr; g.globalAlpha = .85; g.fill(); g.globalAlpha = 1;
  g.fillStyle = 'rgba(255,255,255,.35)'; g.font = `${9 * d}px ui-monospace,monospace`; [100, 1000, 10000].forEach(f => { const x = Math.log(f / fmin) / lr * W; g.fillRect(x, 0, 1, H); g.fillText(f >= 1000 ? f / 1000 + 'k' : f, x + 3, 10 * d); });
}
let frameN = 0, lastLCD = '';
function frame(ts) {
  requestAnimationFrame(frame); frameN++; fpsN++; if (ts - fpsT >= 1000) { FPS = fpsN; fpsN = 0; fpsT = ts; }
  if (document.hidden) return;
  if (E.ready) {
    updateMeters(); updateTuner(); if (frameN % 6 === 0) updateLive(); if (frameN % 2 === 0) drawMini();
    if (AN.clip && UI.clip) UI.clip.className = 'led bad';
  }
  // transport LCD
  const ph = playheadSlot(), sp = spb(), p = barStr(ph); const txt = p + '|' + Math.floor(ph * slotDur() * 10);
  if (txt !== lastLCD) { lastLCD = txt; UI.pos.firstChild.textContent = p; UI.tim.firstChild.textContent = fmtTime(Math.max(0, ph) * slotDur()); }
  if (T.playing || TL.dirty || frameN % 15 === 0) { drawTL(); TL.dirty = false; }
  if (paneVisible('vis')) drawVis(); if (paneVisible('fret')) paintFret(false); if (paneVisible('cam') && frameN % 20 === 0) updateCamStats(); if (typeof neuralFrame === 'function') neuralFrame(); if (typeof stemFrame === 'function') stemFrame(); if (typeof stageFrame === 'function') stageFrame(ts);
  if (frameN % 30 === 0) updateStatus();
}

function loadInitialSong() {
  let s = null; const saved = store.get('song', null);
  if (saved && Array.isArray(saved.sections) && saved.sections.length) { const d = newSong(); s = Object.assign(d, saved); s.band = Object.assign(d.band, saved.band || {}); s.mix = Object.assign(d.mix, saved.mix || {}); s.voicePref = saved.voicePref || {}; s.tuning = (saved.tuning || d.tuning).slice(); }
  S = s || demoSong(); if (!s) S.sections.forEach(sec => sec.bars.forEach(b => { const c = barChords(b)[0]; if (c) fillTab(b, 'Fingerstyle pop', c); })); histStack.cur = snap();
}
function runChecks() {
  const box = $('#bootChecks'); if (!box) return; const AC = window.AudioContext || window.webkitAudioContext;
  const items = [['Web Audio', !!AC], ['AudioWorklet', typeof AudioWorkletNode !== 'undefined'], ['Audio input', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)], ['Camera', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)], ['Web MIDI', !!navigator.requestMIDIAccess], ['Output select', !!(AC && AC.prototype.setSinkId)], ['Secure context', window.isSecureContext !== false]];
  items.forEach(([n, ok]) => box.append(h('span', { class: 'check', style: { color: ok ? 'var(--ok)' : 'var(--warn)', font: '700 11px var(--mono)' } }, (ok ? '✓ ' : '△ ') + n)));
}
async function pickInput() {
  const ok = await openInput(CFG.inDev || undefined); if (!ok) return false; await listDevices();
  const list = E.devs.in, current = (E.inSettings && E.inSettings.deviceId) || '', pref = CFG.inDev && list.find(d => d.deviceId === CFG.inDev), fr = list.find(d => FOCUSRITE_RE.test(d.label || ''));
  if (!pref && fr && fr.deviceId !== current) { await openInput(fr.deviceId); toast('Focusrite found: ' + fr.label, 'ok'); }
  else if (fr && (pref ? pref.deviceId === fr.deviceId : fr.deviceId === current)) toast('Using ' + fr.label, 'ok');
  if (FOCUSRITE_RE.test(((list.find(d => d.deviceId === ((E.inSettings || {}).deviceId)) || {}).label) || '') && CFG.ch === 'auto') setTimeout(() => toast('Tip: press “Auto-detect channel” in I/O and strum, or pick Input 1 / 2 manually.'), 1800);
  const o = E.devs.out.find(d => FOCUSRITE_RE.test(d.label || '')); if (o && !CFG.outDev && E.ctx.setSinkId) try { await setOutputDevice(o.deviceId); } catch (e) { }
  return true;
}
async function boot() {
  applyAppearance(); loadInitialSong();
  buildHeader(); buildDock(); buildLeft(); buildRig(); buildTabPane(); buildSongPane(); buildBandPane(); buildFretPane(); buildVisPane(); buildCamPane(); buildLabPane(); buildExportPane(); buildTxPane(); buildStagePane(); buildNeuralPane(); buildStemsPane(); buildVersionCard(); buildCalCard(); buildBoardExtras(); buildRight(); buildSongbar(); buildSides(); buildLayout(); buildTimeline(); buildStatus(); buildMobile(); if (typeof buildTouch === 'function') buildTouch();
  try { if (window.self !== window.top) { const w = h('div', { style: { background: 'color-mix(in srgb,var(--warn) 22%,transparent)', border: '1px solid var(--warn)', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', margin: '0 0 12px', fontWeight: 600 } }, '⚠ This page is embedded in a frame (editor preview). Browsers usually block the microphone, camera and MIDI there, so no audio devices will appear. Open it in its own tab: CodePen → Change View → Full Page (or Debug), or open the standalone file directly in Chrome/Edge.'); const c = $('#bootChecks'); c.parentNode.insertBefore(w, c); } } catch (e) { }
  dockGo(CFG.startTab || 'vis'); syncTransport(); try { runChecks(); } catch (e) { console.warn(e); }
  $$('#bootTheme button').forEach(b => { b.classList.toggle('on', b.dataset.t === CFG.theme); b.onclick = () => setTheme(b.dataset.t); });
  const hide = () => { const b = $('#boot'); if (!b) return; b.style.opacity = 0; setTimeout(() => { b.remove(); bus.emit('booted'); }, 350); };
  // boot overlay: live connection status + input picker
  const bstat = h('div', { id: 'bootStat', style: { font: '700 12px var(--mono)', margin: '0 0 8px' } }), bsel = h('select', { id: 'bootIn', class: 'in', style: { width: '100%', marginBottom: '10px', fontFamily: 'var(--sans)', display: 'none' }, onchange: async e => { await openInput(e.target.value); await listDevices(); fillBootIn(); say(); } });
  const bc = $('#bootChecks'); bc.parentNode.insertBefore(bsel, bc.nextSibling); bc.parentNode.insertBefore(bstat, bc.nextSibling);
  const say = (m, c) => { if (m) { bstat.textContent = m; bstat.style.color = c || ''; return; } const t = E.stream && E.stream.getAudioTracks()[0]; bstat.textContent = E.hasInput ? '● Audio input connected: ' + (t ? t.label : 'device') + ' — press Start' : '○ ' + (E.lastInErr || 'Microphone is off. Nothing is requested until you press a button.'); bstat.style.color = E.hasInput ? 'var(--ok)' : 'var(--warn)'; };
  const fillBootIn = () => { const cur = (E.inSettings && E.inSettings.deviceId) || ''; bsel.innerHTML = ''; const list = E.devs.in.filter(d => d.deviceId !== 'communications'); list.forEach((d, i) => bsel.append(h('option', { value: d.deviceId, selected: d.deviceId === cur }, d.label || ('Input ' + (i + 1))))); bsel.style.display = list.length ? '' : 'none'; };
  const startBtn = $('#bootGo'); startBtn.textContent = '🎙 Start and connect my input';
  const finish = async () => { startBtn.disabled = true; startBtn.textContent = 'Starting…'; CFG.route = 'studio'; saveCfg(); HUM.cam0 = false; try { await startAudio(); if (!E.hasInput) await pickInput(); initMIDI(); } catch (e) { console.error(e); toast('Startup problem: ' + e.message, 'bad'); } hide(); renderDevices && renderDevices(); };
  startBtn.onclick = finish;
  window.__fwAuto = (async () => {
    say();   // nothing is started or requested until you press a button (or tick “Reconnect my last input” in Audio)
    try { await listDevices(); fillBootIn(); if (CFG.autoIn && CFG.inDev) { say('Reconnecting your last input… allow the microphone when your browser asks.'); await startAudio(); await pickInput(); fillBootIn(); say(); renderDevices(); if (E.hasInput && E.ctx.state === 'running') hide(); } } catch (e) { console.warn(e); say('Could not connect: ' + e.message, 'var(--bad)'); }
  })();
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (E.ctx && E.ctx.state === 'suspended') E.ctx.resume().catch(() => { }); }, true));
  // two routes: the studio (no camera) or the stage (full-screen visuals with the camera). Nothing is requested until one is pressed.
  const bootStart = async route => { CFG.route = route; saveCfg(); HUM.cam0 = route === 'stage'; try { await startAudio(); listDevices(); } catch (e) { console.error(e); toast('Audio could not start: ' + e.message, 'bad'); } hide(); };
  $('#bootNoMic').onclick = () => bootStart('studio'); $('#bootStage').onclick = () => bootStart('stage');
  if (CFG.route === 'stage') { $('#bootStage').classList.add('primary'); $('#bootNoMic').classList.remove('primary'); }
  setInterval(anaTick, 33); requestAnimationFrame(frame);
  window.addEventListener('beforeunload', () => { try { store.set('song', S); saveCfg(); } catch (e) { } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && E.ctx && E.ctx.state === 'suspended') E.ctx.resume(); });
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', () => { listDevices(); });
  bus.emit('song');
  if (/[?&]debug\b/.test(location.search)) window.__daily = { get S() { return S; }, PB, FB, visAna, E, T, humPlay, dockGo, stopPlay, bouncePart, NK, neckMarks, vzSetMode, sideShow, chSetRoles, chRoles, setAnaSource, haloDraw, HL, KS, nkNext, nkPinChord, PRJ, TAKES, STM, ZOOM, CFG, store, commit, projSave, projLoad, projCreate, bus, CAM, CF, VZ, cfFeed, camTop, esc, humAnalyze, humSong, HUM, parseChord, humOpen, humApply, humNotes, AN, humGuitar, humGuitarTick, humStringHz, humStageFirst, vzImmersive };   // test hook, only with ?debug
  projInit().catch(e => { console.warn('library', e); PRJ.ready = true; if (PRJ.wantStart) startMaybe(); });
}

/* >>> parts/11-layout.js */
/* ============================================================
   Part 11 · workspace layout manager
   flipped workspace (tabs above arrangement), splitters, layout presets, tab order/visibility,
   floating panels, collapsible sidebar cards, always-on band strip
   ============================================================ */
const LAY = Object.assign({ flip: true, left: true, right: true, lw: 250, rw: 292, tlh: null, hidden: [], order: [], floats: {}, fl: [], rc: { order: [], col: {}, hide: {} } }, CFG.layout || {});
LAY.rc = Object.assign({ order: [], col: {}, hide: {} }, LAY.rc || {});
const FLOATS = new Map();
const saveLay = () => { CFG.layout = LAY; saveCfg(); };
const TLH_DEFAULT = 'minmax(200px,40%)';

/* ---------- apply ---------- */
function applyLayout() {
  const c = $('#center'), w = $('#work'); if (!c || !w) return;
  c.classList.toggle('flip', !!LAY.flip);
  w.classList.remove('collapsed-l', 'collapsed-r');
  w.style.setProperty('--lw', (LAY.left ? sideW('left') : 0) + 'px'); w.style.setProperty('--rw', (LAY.right ? sideW('right') : 0) + 'px');
  c.style.setProperty('--tlh', LAY.tlh || TLH_DEFAULT);
  { const dsk = !document.body.dataset.form || document.body.dataset.form === 'desktop'; $('#left').style.visibility = !dsk || LAY.left ? '' : 'hidden'; $('#right').style.visibility = !dsk || LAY.right ? '' : 'hidden'; }
  setTimeout(() => { if (typeof tlSize === 'function') tlSize(); window.dispatchEvent(new Event('resize')); }, 40);
}
function toggleSide(k) { if (document.body.dataset.form && document.body.dataset.form !== 'desktop') { mDrawer(k); return; } LAY[k] = !LAY[k]; saveLay(); applyLayout(); }

/* ---------- splitters ---------- */
function dragger(el, onMove, onEnd) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('drag'); const x0 = e.clientX, y0 = e.clientY; const mv = ev => onMove(ev.clientX - x0, ev.clientY - y0, ev); const up = () => { el.classList.remove('drag'); el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); onEnd && onEnd(); }; el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); onMove(0, 0, e); });
}
function buildSplitters() {
  const tl = $('#timeline'), sh = h('div', { class: 'split-h', title: 'Drag to resize the arrangement · double-click to reset' }); tl.append(sh);
  let h0 = 0; sh.addEventListener('pointerdown', () => { h0 = tl.offsetHeight; });
  dragger(sh, (dx, dy) => { if (!h0) return; const tot = $('#center').clientHeight, nh = clamp(LAY.flip ? h0 - dy : h0 + dy, 84, tot - 170); LAY.tlh = Math.round(nh) + 'px'; $('#center').style.setProperty('--tlh', LAY.tlh); if (typeof tlSize === 'function') tlSize(); }, saveLay);
  sh.addEventListener('dblclick', () => { LAY.tlh = null; saveLay(); applyLayout(); });
  [['left', 1], ['right', -1]].forEach(([side, dir]) => {
    const el = $('#' + side), sv = h('div', { class: 'split-v', title: 'Drag to resize · double-click to reset' }); el.append(sv); let w0 = 0; sv.addEventListener('pointerdown', () => { w0 = sideW(side); });
    dragger(sv, dx => { if (!w0) return; setSideW(side, w0 + dx * dir); }, () => { saveLay(); setTimeout(() => window.dispatchEvent(new Event('resize')), 30); });
    sv.addEventListener('dblclick', () => resetSideW(side));
  });
}

/* ---------- popover helper ---------- */
let POP = null;
function closePop() { if (POP) { POP.remove(); POP = null; } }
document.addEventListener('pointerdown', e => { if (POP && !POP.contains(e.target) && !(POP._anchor && POP._anchor.contains(e.target))) closePop(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
function popover(anchor, content, o = {}) {
  const was = POP && POP._anchor === anchor; closePop(); if (was) return null;
  const p = h('div', { class: 'pop', style: o.style || {} }, content); p._anchor = anchor; document.body.append(p); POP = p;
  const r = anchor.getBoundingClientRect(), pw = p.offsetWidth, ph = p.offsetHeight; let x = o.right ? r.right - pw : r.left, y = r.bottom + 6; if (x + pw > innerWidth - 8) x = innerWidth - pw - 8; if (x < 8) x = 8; if (y + ph > innerHeight - 8) y = Math.max(8, r.top - ph - 6);
  p.style.left = x + 'px'; p.style.top = y + 'px'; return p;
}

/* ---------- tabs: order, visibility, floating ---------- */
function applyTabOrder() { if (!LAY.order.length) return; const ix = id => { const i = LAY.order.indexOf(id); return i < 0 ? 999 : i; }; const cur = DOCK.cur, a = DOCK.slice().sort((p, q) => ix(p[0]) - ix(q[0])); DOCK.splice(0, DOCK.length, ...a); DOCK.cur = cur; }
function rebuildTabs() {
  const tabs = $('#dock .tabs'); if (!tabs) return; tabs.innerHTML = '';
  if (!tabs._drop) { tabs._drop = true; tabs.addEventListener('dragover', e => { e.preventDefault(); }); tabs.addEventListener('drop', e => { const t = e.dataTransfer.getData('text/plain'); if (t.startsWith('tab:') && sideHosted(t.slice(4))) { e.preventDefault(); movePanel(t.slice(4), 'dock'); } }); }
  if (!tabs._wheel) { tabs._wheel = true; tabs.addEventListener('wheel', e => { if (tabs.scrollWidth > tabs.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { tabs.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false }); }
  dockVisible().forEach(([id, name], i) => {
    const b = h('button', {
      class: 'tab' + (DOCK.cur === id ? ' on' : ''), 'data-id': id, draggable: 'true', title: 'Click: open · drag: reorder · double-click: float as a window',
      onclick: () => { if (!['vis', 'song', 'band', 'exp'].includes(id)) xpSignal(1); FLOATS.has(id) ? floatFront(id) : dockGo(id); }, ondblclick: () => FLOATS.has(id) ? unfloat(id) : floatPane(id),
      ondragstart: e => { e.dataTransfer.setData('text/plain', 'tab:' + id); e.dataTransfer.effectAllowed = 'move'; b.classList.add('dragging'); }, ondragend: () => b.classList.remove('dragging'),
      ondragover: e => { e.preventDefault(); b.classList.add('dropl'); }, ondragleave: () => b.classList.remove('dropl'),
      ondrop: e => { e.preventDefault(); b.classList.remove('dropl'); const t = e.dataTransfer.getData('text/plain'); if (t.startsWith('tab:')) { const from = t.slice(4); if (sideHosted(from)) { if (movePanel(from, 'dock')) moveTab(from, id); } else moveTab(from, id); } }
    }, xpTabText(id, name, i) + (FLOATS.has(id) ? ' ⧉' : '')); tabs.append(b);
  });
  tabs.append(xpToolsButton());
}
function moveTab(id, beforeId) { if (id === beforeId) return; const a = DOCK.findIndex(d => d[0] === id), it = DOCK.splice(a, 1)[0], b = DOCK.findIndex(d => d[0] === beforeId); DOCK.splice(b < 0 ? DOCK.length : b, 0, it); LAY.order = DOCK.map(d => d[0]); saveLay(); rebuildTabs(); }
function setTabHidden(id, hide) { const i = LAY.hidden.indexOf(id); if (hide && i < 0) { LAY.hidden.push(id); if (DOCK.cur === id) { const n = dockVisible().find(d => !FLOATS.has(d[0])); if (n) dockGo(n[0]); } } else if (!hide && i >= 0) LAY.hidden.splice(i, 1); saveLay(); rebuildTabs(); }
function floatPane(id, geo) {
  if (FLOATS.has(id)) return; const p = PANES[id]; if (!p) return; const def = DOCK.find(d => d[0] === id), n = FLOATS.size, g = geo || LAY.floats[id] || { x: 110 + n * 34, y: 96 + n * 30, w: Math.min(760, innerWidth - 160), h: Math.min(520, innerHeight - 180) };
  const win = h('div', { class: 'floatwin', 'data-id': id, style: { left: g.x + 'px', top: g.y + 'px', width: g.w + 'px', height: g.h + 'px' } });
  const head = h('div', { class: 'float-h' }, h('b', {}, def ? def[1] : id), h('span', { class: 'grow' }), h('button', { class: 'btn sm', title: 'Return to the dock', onclick: () => unfloat(id) }, '⤓ Dock'));
  win.append(head, p); $('#app').append(win); FLOATS.set(id, win); win._ro = new ResizeObserver(() => { const r = win.getBoundingClientRect(); LAY.floats[id] = { x: r.left, y: r.top, w: r.width, h: r.height }; saveLayLater(); }); win._ro.observe(win);
  let ox = 0, oy = 0; head.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; floatFront(id); const r = win.getBoundingClientRect(); ox = e.clientX - r.left; oy = e.clientY - r.top; head.setPointerCapture(e.pointerId); const mv = ev => { win.style.left = clamp(ev.clientX - ox, -win.offsetWidth + 80, innerWidth - 80) + 'px'; win.style.top = clamp(ev.clientY - oy, 0, innerHeight - 40) + 'px'; }, up = () => { head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); const r2 = win.getBoundingClientRect(); LAY.floats[id] = { x: r2.left, y: r2.top, w: r2.width, h: r2.height }; saveLay(); }; head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up); });
  win.addEventListener('pointerdown', () => floatFront(id), true); floatFront(id);
  if (DOCK.cur === id) { const n2 = dockVisible().find(d => !FLOATS.has(d[0])); if (n2) dockGo(n2[0]); }
  LAY.fl = [...FLOATS.keys()]; saveLay(); rebuildTabs(); bus.emit('dock', id); setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
}
let _slt = 0; const saveLayLater = () => { clearTimeout(_slt); _slt = setTimeout(saveLay, 400); };
let _zf = 41; function floatFront(id) { const w = FLOATS.get(id); if (w) w.style.zIndex = ++_zf; }
function unfloat(id) { const w = FLOATS.get(id); if (!w) return; w._ro.disconnect(); $('#dock').append(PANES[id]); w.remove(); FLOATS.delete(id); LAY.fl = [...FLOATS.keys()]; saveLay(); rebuildTabs(); dockGo(id); setTimeout(() => window.dispatchEvent(new Event('resize')), 50); }

/* ---------- sidebar cards: drag to reorder, click title to collapse ---------- */
const RCARDS = ['tuner', 'levels', 'live', 'spectrum'];
function setupCards() {
  const p = UI.monPane; if (!p) return; const cards = [...p.children]; cards.forEach((c, i) => { c.dataset.card = RCARDS[i] || ('c' + i); });
  const byName = n => cards.find(c => c.dataset.card === n);
  LAY.rc.order.concat(RCARDS).forEach(n => { const c = byName(n); if (c) p.append(c); });
  cards.forEach(c => {
    const n = c.dataset.card, hd = c.firstChild; c.classList.toggle('cc', !!LAY.rc.col[n]); c.style.display = LAY.rc.hide[n] ? 'none' : '';
    hd.setAttribute('draggable', 'true'); hd.title = 'Click: collapse · drag: reorder'; hd.addEventListener('click', e => { if (e.target.closest('button,select,input,.led')) return; c.classList.toggle('cc'); LAY.rc.col[n] = c.classList.contains('cc'); saveLay(); });
    hd.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', 'card:' + n); });
    c.addEventListener('dragover', e => { e.preventDefault(); c.classList.add('dropt'); }); c.addEventListener('dragleave', () => c.classList.remove('dropt'));
    c.addEventListener('drop', e => { e.preventDefault(); c.classList.remove('dropt'); const t = e.dataTransfer.getData('text/plain'); if (!t.startsWith('card:')) return; const f = byName(t.slice(5)); if (f && f !== c) { p.insertBefore(f, c); LAY.rc.order = [...p.children].map(x => x.dataset.card); saveLay(); } });
  });
}
function setCardHidden(n, hide) { LAY.rc.hide[n] = hide; const c = $('[data-card="' + n + '"]', UI.monPane); if (c) c.style.display = hide ? 'none' : ''; saveLay(); }

/* ---------- presets ---------- */
const LAYOUTS = [
  ['Compose', 'Tabs on top, arrangement below, both sidebars', { flip: true, left: true, right: true, tlh: null, dock: 'tab' }],
  ['Perform', 'Pedalboard stomps on top, slim arrangement, tuner & meters at right', { flip: true, left: false, right: true, tlh: '132px', dock: 'rig', board: 'stomp' }],
  ['Pedalboard', 'All the room for pedals — sidebars away, thin arrangement', { flip: true, left: false, right: false, tlh: '96px', dock: 'rig', board: 'board' }],
  ['Light show', 'Stage visuals with a thin arrangement', { flip: true, left: false, right: false, tlh: '104px', dock: 'stage' }],
  ['Studio (classic)', 'Original look: arrangement above, tabs below', { flip: false, left: true, right: true, tlh: null, dock: 'tab' }],
  ['Songwriting', 'Tab above, chords & lyrics (Refine) beside it', { flip: true, left: false, right: true, tlh: 'minmax(150px,30%)', dock: 'tab', cur: { right: 'refine' } }],
  ['Track study', 'Stems above, big arrangement showing the track lanes', { flip: true, left: false, right: true, tlh: 'minmax(260px,54%)', dock: 'stems', cur: { right: 'refine' } }],
  ['Record', 'I/O at left, big arrangement with guitar + vocal lanes', { flip: true, left: true, right: true, tlh: 'minmax(260px,56%)', dock: 'rig', cur: { left: 'io', right: 'monitor' } }],
  ['Focus', 'Just the panel — no sidebars, slim arrangement', { flip: true, left: false, right: false, tlh: '90px', dock: null }]
];
function applyPreset(s) {
  Object.assign(LAY, { flip: s.flip, left: s.left, right: s.right, tlh: s.tlh }); if (s.lw) LAY.lw = s.lw; if (s.rw) LAY.rw = s.rw;
  if (s.hidden) LAY.hidden = s.hidden.slice(); if (s.order) { LAY.order = s.order.slice(); applyTabOrder(); } if (s.rc) LAY.rc = JSON.parse(JSON.stringify(s.rc));
  if (s.side) LAY.side = JSON.parse(JSON.stringify(s.side)); if (s.cur) Object.assign(SD.cur, s.cur); if (typeof sideApply === 'function') sideApply();
  saveLay(); applyLayout(); setupCardsRefresh(); rebuildTabs(); if (s.dock) { if (FLOATS.has(s.dock)) floatFront(s.dock); else dockGo(s.dock); } if (s.board && typeof boardView === 'function') boardView(s.board);
}
function setupCardsRefresh() { $$('[data-card]', UI.monPane).forEach(c => { const n = c.dataset.card; c.classList.toggle('cc', !!LAY.rc.col[n]); c.style.display = LAY.rc.hide[n] ? 'none' : ''; }); const p = UI.monPane; LAY.rc.order.forEach(n => { const c = $('[data-card="' + n + '"]', p); if (c) p.append(c); }); }
function layoutMenu(btn) {
  const saved = store.get('layouts', []), box = h('div');
  box.append(h('h5', {}, 'Layouts'));
  LAYOUTS.forEach(([n, d, s]) => box.append(h('button', { class: 'pbtn', onclick: () => { applyPreset(s); closePop(); } }, h('b', {}, n), h('span', {}, d))));
  saved.forEach((l, i) => box.append(h('div', { class: 'lrow' }, h('button', { class: 'pbtn', style: { margin: 0, flex: 1 }, onclick: () => { applyPreset(l.s); closePop(); } }, h('b', {}, '★ ' + l.n), h('span', {}, 'your layout')), h('button', { class: 'btn sm bad', title: 'Delete', onclick: () => { saved.splice(i, 1); store.set('layouts', saved); closePop(); } }, '✕'))));
  const nm = h('input', { class: 'in', placeholder: 'Name this layout…', style: { flex: 1, fontFamily: 'var(--sans)' } });
  box.append(h('div', { class: 'lrow' }, nm, h('button', { class: 'btn sm primary', onclick: () => { const n = nm.value.trim(); if (!n) return toast('Name your layout', 'warn'); const s = { flip: LAY.flip, left: LAY.left, right: LAY.right, lw: LAY.lw, rw: LAY.rw, tlh: LAY.tlh, hidden: LAY.hidden.slice(), order: DOCK.map(d => d[0]), rc: JSON.parse(JSON.stringify(LAY.rc)), dock: DOCK.cur, side: JSON.parse(JSON.stringify(LAY.side)), cur: { left: SD.cur.left, right: SD.cur.right } }; const a = saved.filter(x => x.n !== n); a.push({ n, s }); store.set('layouts', a); toast('Layout “' + n + '” saved', 'ok'); closePop(); } }, 'Save current')));
  box.append(h('h5', {}, 'Workspace'));
  const chk = (label, get, set) => h('label', { class: 'lrow' }, h('input', { type: 'checkbox', checked: get(), onchange: e => set(e.target.checked) }), label);
  box.append(chk('Panels above the arrangement', () => LAY.flip, v => { LAY.flip = v; saveLay(); applyLayout(); }), chk('Left sidebar  [', () => LAY.left, v => { LAY.left = v; saveLay(); applyLayout(); }), chk('Right sidebar  ]', () => LAY.right, v => { LAY.right = v; saveLay(); applyLayout(); }));
  box.append(h('button', { class: 'pbtn', onclick: () => placeMenu(btn) }, h('b', {}, '⇆ Where panels live…'), h('span', {}, 'Move any panel to the left sidebar, the right sidebar or the centre · swap the sidebars')));
  box.append(h('h5', {}, 'Panels — show / hide · double-click a tab to float it'));
  DOCK.forEach(([id, name]) => box.append(h('div', { class: 'lrow' }, h('input', { type: 'checkbox', checked: !LAY.hidden.includes(id), onchange: e => setTabHidden(id, !e.target.checked) }), h('span', { class: 'grow' }, name), h('button', { class: 'btn sm', onclick: () => { FLOATS.has(id) ? unfloat(id) : floatPane(id); closePop(); } }, FLOATS.has(id) ? '⤓ dock' : '⧉ float'))));
  box.append(h('h5', {}, 'Right-sidebar cards'));
  RCARDS.forEach(n => box.append(h('label', { class: 'lrow' }, h('input', { type: 'checkbox', checked: !LAY.rc.hide[n], onchange: e => setCardHidden(n, !e.target.checked) }), n[0].toUpperCase() + n.slice(1))));
  box.append(h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn sm', onclick: () => { [...FLOATS.keys()].forEach(unfloat); LAY.hidden = []; LAY.order = []; LAY.rc = { order: [], col: {}, hide: {} }; LAY.floats = {}; sideReset(); DOCK.sort((a, b) => ['rig', 'tab', 'song', 'band', 'fret', 'vis', 'stage', 'neural', 'stems', 'tx', 'cam', 'lab', 'exp'].indexOf(a[0]) - ['rig', 'tab', 'song', 'band', 'fret', 'vis', 'stage', 'neural', 'stems', 'tx', 'cam', 'lab', 'exp'].indexOf(b[0])); applyPreset(LAYOUTS[0][2]); closePop(); } }, 'Reset layout')));
  popover(btn, box, { right: true });
}

/* ---------- band strip: always-visible instrument switches ---------- */
const BAND_KEYS = [['drums', 'Drums', 'drumsOn'], ['bass', 'Bass', 'bassOn'], ['rhythm', 'Rhythm', 'compOn'], ['lead', 'Lead tab', 'leadOn']];
const REHEARSAL = [['Full band', { drumsOn: 1, bassOn: 1, compOn: 1, leadOn: 1 }], ['Rhythm section (drums + bass)', { drumsOn: 1, bassOn: 1, compOn: 0, leadOn: 0 }], ['Acoustic duo (rhythm + bass)', { drumsOn: 0, bassOn: 1, compOn: 1, leadOn: 0 }], ['Drums only', { drumsOn: 1, bassOn: 0, compOn: 0, leadOn: 0 }], ['Bass only', { drumsOn: 0, bassOn: 1, compOn: 0, leadOn: 0 }], ['Rhythm guitar only', { drumsOn: 0, bassOn: 0, compOn: 1, leadOn: 0 }], ['Tab playback only', { drumsOn: 0, bassOn: 0, compOn: 0, leadOn: 1 }], ['Play over me (click only)', { drumsOn: 0, bassOn: 0, compOn: 0, leadOn: 0, click: 1 }]];
function toggleBand(key, val) { S.band[key] = val == null ? !S.band[key] : !!val; commit(false); syncBandStrip(); if (paneVisible('band') && typeof renderBand === 'function') renderBand(); }
function setRehearsal(cfg) { Object.keys(cfg).forEach(k => { if (k === 'click') { T.metro = !!cfg.click; } else S.band[k] = !!cfg[k]; }); if (!('click' in cfg)) { /* leave click alone */ } commit(false); syncTransport(); syncBandStrip(); if (paneVisible('band')) renderBand(); }
function syncBandStrip() {
  if (!UI.bchips) return; BAND_KEYS.forEach(([id, , key]) => UI.bchips[id].classList.toggle('on', !!S.band[key])); UI.bchips.click.classList.toggle('on', !!T.metro);
  const all = BAND_KEYS.every(([, , k]) => S.band[k]), none = BAND_KEYS.every(([, , k]) => !S.band[k]); UI.bmix.value = ''; UI.bmix.title = all ? 'Full band' : none ? 'Band silent' : 'Custom mix';
  $$('.tl-head .pw').forEach(b => b.classList.toggle('on', !!S.band[b.dataset.k]));
}
function bandPop(chip, id, key) {
  const m = S.mix[id], box = h('div'); box.append(h('h5', {}, BAND_KEYS.find(x => x[0] === id)[1]));
  box.append(h('label', { class: 'lrow' }, h('input', { type: 'checkbox', checked: !!S.band[key], onchange: e => toggleBand(key, e.target.checked) }), 'Enabled'));
  box.append(h('div', { class: 'lrow' }, h('span', {}, 'Level'), h('input', { type: 'range', min: 0, max: 1.4, step: .01, value: m.g, style: { flex: 1 }, oninput: e => { m.g = +e.target.value; applyMix(); commit(false); } })));
  box.append(h('div', { class: 'lrow' }, h('span', {}, 'Pan'), h('input', { type: 'range', min: -1, max: 1, step: .01, value: m.p, style: { flex: 1 }, oninput: e => { m.p = +e.target.value; applyMix(); commit(false); } })));
  box.append(h('div', { class: 'row' }, h('button', { class: 'btn sm' + (m.m ? ' on' : ''), onclick: e => { m.m = m.m ? 0 : 1; e.target.classList.toggle('on', !!m.m); applyMix(); commit(false); } }, 'Mute'), h('button', { class: 'btn sm' + (m.s ? ' on' : ''), onclick: e => { m.s = m.s ? 0 : 1; e.target.classList.toggle('on', !!m.s); applyMix(); commit(false); } }, 'Solo')));
  const sel = (label, opts, val, fn) => box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '66px' } }, label), h('select', { class: 'in', style: { flex: 1, fontFamily: 'var(--sans)' }, onchange: e => { fn(e.target.value); if (paneVisible('band')) renderBand(); } }, opts.map(o => h('option', { selected: o === val }, o)))));
  if (id === 'drums') { sel('Pattern', Object.keys(DPATS), S.band.patName, v => { setDrumPattern(v); }); sel('Kit', Object.keys(KITS), S.band.kit, v => { S.band.kit = v; commit(false); }); }
  if (id === 'bass') { sel('Style', BASS_STYLES, S.band.bassStyle, v => { S.band.bassStyle = v; commit(false); }); sel('Tone', ['Round', 'Sub', 'Pick', 'Muted Pluck'], S.band.bassTone, v => { S.band.bassTone = v; commit(false); }); }
  if (id === 'rhythm') { sel('Pattern', Object.keys(STRUMS), S.band.compStyle, v => { S.band.compStyle = v; commit(false); }); sel('Voice', ['Steel', 'Nylon', 'Electric', 'Muted Pluck'], S.band.compInst, v => { S.band.compInst = v; commit(false); }); }
  if (id === 'lead') sel('Voice', ['Nylon', 'Steel', 'Electric', 'Muted Pluck'], S.band.leadInst, v => { S.band.leadInst = v; commit(false); });
  popover(chip, box, { right: true });
}
function buildBandStrip() {
  const strip = h('div', { class: 'bandstrip' }); UI.bchips = {}; strip.append(h('span', { class: 'bs-l' }, 'BAND'));
  BAND_KEYS.forEach(([id, name, key]) => { const c = h('button', { class: 'bchip', title: name + ' — click: on/off · right-click: level, pan, style  (' + { drums: 'D', bass: 'B', rhythm: 'G', lead: 'T' }[id] + ')', onclick: () => toggleBand(key), oncontextmenu: e => { e.preventDefault(); bandPop(c, id, key); } }, h('i', { class: 'led' }), name); UI.bchips[id] = c; strip.append(c); });
  UI.bchips.click = h('button', { class: 'bchip warn', title: 'Metronome click (M)', onclick: () => { T.metro = !T.metro; syncTransport(); } }, h('i', { class: 'led' }), 'Click'); strip.append(UI.bchips.click);
  UI.bmix = h('select', { class: 'in', title: 'Rehearsal mixes — who plays with you', onchange: e => { const r = REHEARSAL[+e.target.value]; if (r) setRehearsal(r[1]); } }, h('option', { value: '' }, 'Mix…'), REHEARSAL.map((r, i) => h('option', { value: i }, r[0]))); strip.append(UI.bmix);
  return strip;
}

/* ---------- build ---------- */
function buildLayout() {
  const dock = $('#dock'), tabs = $('.tabs', dock), bar = h('div', { class: 'dockbar' }); dock.insertBefore(bar, tabs); bar.append(tabs, dockMore(), buildBandStrip());
  applyTabOrder(); rebuildTabs(); buildSplitters(); setupCards(); applyLayout();
  const btn = h('button', { class: 'btn icon', title: 'Layout — presets, panel order, floating windows', onclick: () => layoutMenu(btn) }, '▦'); const tr = $('#topR'); tr.insertBefore(btn, tr.firstChild);
  bus.on('song', syncBandStrip); bus.on('transport', syncBandStrip); bus.on('dock', () => { $$('#dock .tab').forEach(t => t.classList.toggle('on', t.dataset.id === DOCK.cur)); }); syncBandStrip();
  LAY.fl.slice().forEach(id => { try { floatPane(id, LAY.floats[id]); } catch (e) { console.warn(e); } });
}

/* >>> parts/12-board.js */
/* ============================================================
   Part 12 · pedalboard v2 — signal-chain strip, per-pedal size / colour / collapse / hide,
   footswitch keys + MIDI notes, 8 morphing scenes, big-footswitch stomp view
   ============================================================ */
const BRD = Object.assign({ view: 'board', items: {}, scenes: new Array(8).fill(null), morph: 250, incBand: false, live: true, midi: {}, dens: 250, cur: -1, storeArm: false, hidShow: false }, CFG.board || {});
while (BRD.scenes.length < 8) BRD.scenes.push(null);
const saveBrd = () => { CFG.board = BRD; saveCfg(); };
const BRD_COLORS = ['', '#e4572e', '#f2a900', '#3ddc84', '#35d3c2', '#4a90e2', '#a58bff', '#ff5fa2'];
const BRD_RESERVED = new Set([' ', 'r', 'l', 'm', 'd', 'b', 'g', 't', '?', '[', ']', 'home', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'escape', 'tab', 'enter', 'f']);
const bitem = id => BRD.items[id] || (BRD.items[id] = { size: 1, color: '', col: false, hid: false, key: '' });

function paintPedal(id) {
  const P = PED[id]; if (!P) return; const it = bitem(id), el = P.el;
  el.classList.toggle('s2', it.size === 2); el.classList.toggle('s3', it.size === 3); el.classList.toggle('cc', !!it.col); el.classList.toggle('hid', !!it.hid && !BRD.hidShow);
  if (it.color) el.style.setProperty('--pc', it.color); else el.style.removeProperty('--pc');
  const kb = el.querySelector('.kbadge'); if (kb) { kb.textContent = it.key ? it.key.toUpperCase() : ''; kb.style.display = it.key ? '' : 'none'; }
}
function boardView(v) {
  BRD.view = v; saveBrd(); const b = UI.board; if (!b) return; b.classList.toggle('stompmode', v === 'stomp');
  b.style.gridTemplateColumns = v === 'stomp' ? '' : 'repeat(auto-fill,minmax(' + BRD.dens + 'px,1fr))'; if (UI.chain) UI.chain.style.display = v === 'stomp' ? 'none' : '';
  $$('.bv button', UI.boardTools).forEach(x => x.classList.toggle('on', x.dataset.v === v));
}
function pedalState(id, on) { if (!E.ready) return toast('Power on first'); const u = RIG.units[id]; if (!u) return; u.setActive(on == null ? !u.on : on); PED[id].el.classList.toggle('on', u.on); bus.emit('rig:state'); }

/* ---------- signal chain strip ---------- */
function renderChain() {
  const c = UI.chain; if (!c) return; c.innerHTML = ''; c.append(h('span', { class: 'io' }, 'IN'));
  RIG.order.forEach(id => {
    const it = bitem(id), u = RIG.units[id], on = !!(u && u.on);
    const chip = h('div', { class: 'cchip' + (on ? ' on' : '') + (it.hid ? ' hid' : ''), draggable: 'true', title: FX[id].name + ' — click: engage · drag: reorder the chain', style: it.color ? { '--pc': it.color } : {},
      onclick: () => pedalState(id), ondragstart: e => { e.dataTransfer.setData('text/plain', id); }, ondragover: e => { e.preventDefault(); chip.classList.add('over'); }, ondragleave: () => chip.classList.remove('over'),
      ondrop: e => { e.preventDefault(); chip.classList.remove('over'); const f = e.dataTransfer.getData('text/plain'); if (f && f !== id && FX[f]) rigMove(f, RIG.order.indexOf(id)); } }, h('i'), FX[id].name);
    c.append(h('span', { class: 'arr' }, '›'), chip);
  });
  c.append(h('span', { class: 'arr' }, '›'), h('span', { class: 'io' }, 'OUT'));
}

/* ---------- per-pedal settings popover ---------- */
let BLEARN = null;
function pedalGear(id, btn) {
  const it = bitem(id), box = h('div'); box.append(h('h5', {}, FX[id].name));
  const seg = (label, opts, cur, fn) => box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '74px' } }, label), h('div', { class: 'seg' }, opts.map(([v, n]) => h('button', { class: cur === v ? 'on' : '', onclick: e => { fn(v); $$('button', e.target.parentNode).forEach(b => b.classList.toggle('on', b === e.target)); } }, n)))));
  seg('Width', [[1, 'S'], [2, 'M'], [3, 'L']], it.size, v => { it.size = v; paintPedal(id); saveBrd(); });
  box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '74px' } }, 'Colour'), h('div', { class: 'row', style: { gap: '5px' } }, BRD_COLORS.map(c => h('button', { class: 'swatch' + (it.color === c ? ' on' : ''), style: { background: c || 'var(--panel2)', border: c ? undefined : '2px dashed var(--line2)' }, onclick: e => { it.color = c; paintPedal(id); renderChain(); saveBrd(); $$('.swatch', e.target.parentNode).forEach(b => b.classList.toggle('on', b === e.target)); } })))));
  box.append(h('label', { class: 'lrow' }, h('input', { type: 'checkbox', checked: it.col, onchange: e => { it.col = e.target.checked; paintPedal(id); saveBrd(); } }), 'Collapse (stomp + title only)'), h('label', { class: 'lrow' }, h('input', { type: 'checkbox', checked: it.hid, onchange: e => { it.hid = e.target.checked; paintPedal(id); renderChain(); saveBrd(); } }), 'Hide from the board (stays in the chain)'));
  const kbtn = h('button', { class: 'btn sm', onclick: () => { kbtn.textContent = 'Press a key…'; const f = ev => { ev.preventDefault(); ev.stopPropagation(); document.removeEventListener('keydown', f, true); const k = ev.key.toLowerCase(); if (k === 'escape') { kbtn.textContent = it.key ? it.key.toUpperCase() : 'Assign key'; return; } if (k === 'backspace' || k === 'delete') it.key = ''; else if (BRD_RESERVED.has(k) || ev.ctrlKey || ev.metaKey || ev.altKey) { toast('“' + ev.key + '” is reserved for another shortcut', 'warn'); } else { Object.keys(BRD.items).forEach(o => { if (o !== id && BRD.items[o].key === k) BRD.items[o].key = ''; paintPedal(o); }); it.key = k; } saveBrd(); paintPedal(id); kbtn.textContent = it.key ? it.key.toUpperCase() : 'Assign key'; }; document.addEventListener('keydown', f, true); } }, it.key ? it.key.toUpperCase() : 'Assign key');
  const mn = Object.keys(BRD.midi).find(n => BRD.midi[n] === 'p:' + id);
  const mbtn = h('button', { class: 'btn sm', onclick: () => { BLEARN = id; mbtn.textContent = 'Hit a pad / footswitch…'; initMIDI(); } }, mn != null ? 'MIDI note ' + mn : 'Learn MIDI note');
  box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '74px' } }, 'Footswitch'), kbtn, mbtn));
  box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '74px' } }, 'Order'), h('button', { class: 'btn sm', title: 'Move this pedal one place earlier in the signal chain', onclick: () => { rigMove(id, RIG.order.indexOf(id) - 1); renderChain(); } }, '◀ Earlier'), h('button', { class: 'btn sm', title: 'Move this pedal one place later in the signal chain', onclick: () => { rigMove(id, RIG.order.indexOf(id) + 1); renderChain(); } }, 'Later ▶')));
  box.append(h('div', { class: 'tiny muted', style: { marginTop: '4px' } }, 'Backspace while assigning clears the key. Double-click a pedal title to collapse it.'));
  popover(btn, box, { right: true });
}

/* ---------- scenes ---------- */
let MORPH = 0;
function sceneSave(i) { const s = { rig: rigSnapshot(), n: (BRD.scenes[i] && BRD.scenes[i].n) || 'Scene ' + (i + 1) }; if (BRD.incBand) s.band = { drumsOn: S.band.drumsOn, bassOn: S.band.bassOn, compOn: S.band.compOn, leadOn: S.band.leadOn }; BRD.scenes[i] = s; BRD.cur = i; saveBrd(); renderScenes(); toast('Stored scene ' + (i + 1), 'ok'); }
function sceneRecall(i) {
  const s = BRD.scenes[i]; if (!s) return toast('Scene ' + (i + 1) + ' is empty — Shift+click to store the current rig', 'warn'); if (!E.ready) return toast('Power on first');
  if (s.band) { Object.assign(S.band, s.band); commit(false); syncBandStrip(); }
  cancelAnimationFrame(MORPH); BRD.cur = i; renderScenes();
  if (!BRD.morph) { rigApply(s.rig); bus.emit('rig:state'); return; }
  const from = rigSnapshot(), t0 = performance.now(), orderSame = from.order.join() === s.rig.order.join(); if (!orderSame) { rigApply(s.rig); bus.emit('rig:state'); return; }
  const step = () => { const t = clamp((performance.now() - t0) / BRD.morph, 0, 1); if (t >= 1) { rigApply(s.rig); bus.emit('rig:state'); return; } rigApply(rigLerp(from, s.rig, t)); MORPH = requestAnimationFrame(step); }; step();
}
function sceneMenu(i, btn) {
  const s = BRD.scenes[i], box = h('div'); box.append(h('h5', {}, 'Scene ' + (i + 1)));
  const nm = h('input', { class: 'in', value: s ? s.n : 'Scene ' + (i + 1), style: { flex: 1, fontFamily: 'var(--sans)' }, onchange: e => { if (BRD.scenes[i]) { BRD.scenes[i].n = e.target.value || 'Scene ' + (i + 1); saveBrd(); renderScenes(); } } });
  box.append(h('div', { class: 'lrow' }, nm), h('div', { class: 'row' }, h('button', { class: 'btn sm primary', onclick: () => { if (BRD.scenes[i]) BRD.scenes[i].n = nm.value || 'Scene ' + (i + 1); sceneSave(i); if (nm.value) BRD.scenes[i].n = nm.value; saveBrd(); renderScenes(); closePop(); } }, 'Store current rig here'), h('button', { class: 'btn sm bad', onclick: () => { BRD.scenes[i] = null; saveBrd(); renderScenes(); closePop(); } }, 'Clear')));
  popover(btn, box);
}
function renderScenes() {
  const b = UI.scenebar; if (!b) return; b.innerHTML = ''; b.append(h('span', { class: 'tiny muted', style: { fontWeight: 800, letterSpacing: '.1em' } }, 'SCENES'));
  BRD.scenes.forEach((s, i) => { const bt = h('button', { class: 'scn' + (s ? '' : ' empty') + (BRD.cur === i && s ? ' cur' : '') + (BRD.storeArm ? ' store' : ''), title: s ? 'Click: recall · Shift+click: overwrite with the current rig · right-click: rename / clear  (key ' + (i + 1) + ', MIDI note ' + (36 + i) + ')' : 'Empty — Shift+click (or arm Store) to save the current rig here', onclick: e => { if (BRD.storeArm || e.shiftKey || !s) { if (!s && !BRD.storeArm && !e.shiftKey) { sceneSave(i); } else sceneSave(i); BRD.storeArm = false; renderScenes(); } else sceneRecall(i); }, oncontextmenu: e => { e.preventDefault(); sceneMenu(i, bt); } }, s ? s.n : '— empty —', h('small', {}, (i + 1) + (s && s.band ? ' · +band' : ''))); b.append(bt); });
  b.append(h('button', { class: 'btn sm' + (BRD.storeArm ? ' on' : ''), title: 'Arm, then click a slot to store the current rig', onclick: () => { BRD.storeArm = !BRD.storeArm; renderScenes(); } }, '● Store')); b.append(h('button', { class: 'btn sm', title: 'Switch every pedal off (0)', onclick: () => boardKey('0') }, '⏻ All off'));
}
function digitKey(n) { if (stageOwnsKeys()) return stageScene(n - 1); if (BRD.live) sceneRecall(n - 1); }
function boardKey(k) {
  const lk = k.toLowerCase(); if (lk === '0' && BRD.live) { if (!E.ready) return; RIG.order.forEach(id => { if (RIG.units[id].on) RIG.units[id].setActive(false); }); syncPedals(); bus.emit('rig:state'); toast('All pedals off'); return; }
  if (!BRD.live) return; const id = Object.keys(BRD.items).find(o => BRD.items[o].key === lk); if (id) pedalState(id);
}

/* ---------- MIDI note bindings (pads / footswitch controllers) ---------- */
MIDIHOOKS.push((note, vel) => {
  if (BLEARN) { BRD.midi[note] = 'p:' + BLEARN; toast('MIDI note ' + note + ' → ' + FX[BLEARN].name, 'ok'); BLEARN = null; saveBrd(); return; }
  let a = BRD.midi[note]; if (!a) { if (note >= 36 && note <= 43) a = 's:' + (note - 36); else if (note >= 48 && note <= 55) a = 'g:' + (note - 48); }
  if (!a) return; const [t, v] = a.split(':'); if (t === 's') sceneRecall(+v); else if (t === 'p') pedalState(v); else if (t === 'g') stageScene(+v);
});

/* ---------- build ---------- */
function buildBoardExtras() {
  const p = PANES.rig; if (!p || !UI.board) return;
  UI.scenebar = h('div', { class: 'scenebar' }); UI.chain = h('div', { class: 'chainbar', tabindex: '0', role: 'region', 'aria-label': 'Signal chain (scrolls sideways)' });
  UI.boardTools = h('div', { class: 'dk dk4' },
    h('div', { class: 'seg bv' }, [['board', '▦ Board'], ['stomp', '◉ Stomp']].map(([v, n]) => h('button', { 'data-v': v, class: BRD.view === v ? 'on' : '', title: v === 'stomp' ? 'Big footswitch tiles for playing live' : 'Chain strip + full pedals', onclick: () => boardView(v) }, n))),
    h('label', { class: 'small', style: { fontWeight: 700 } }, 'Width ', h('input', { type: 'range', min: 190, max: 460, step: 10, value: BRD.dens, style: { width: '60px', verticalAlign: 'middle' }, oninput: e => { BRD.dens = +e.target.value; if (BRD.view !== 'stomp') UI.board.style.gridTemplateColumns = 'repeat(auto-fill,minmax(' + BRD.dens + 'px,1fr))'; saveBrd(); } })),
    h('label', { class: 'small', style: { fontWeight: 700 } }, 'Morph ', h('input', { type: 'range', min: 0, max: 3000, step: 50, value: BRD.morph, style: { width: '60px', verticalAlign: 'middle' }, oninput: e => { BRD.morph = +e.target.value; e.target.nextSibling.textContent = BRD.morph + ' ms'; saveBrd(); } }), h('span', { class: 'mono tiny' }, BRD.morph + ' ms')),
    h('label', { class: 'chk small', style: { display: 'flex', gap: '4px', alignItems: 'center', fontWeight: 700 }, title: 'Scenes also switch the band instruments' }, h('input', { type: 'checkbox', checked: BRD.incBand, onchange: e => { BRD.incBand = e.target.checked; saveBrd(); } }), 'Scenes + band'),
    h('label', { class: 'chk small', style: { display: 'flex', gap: '4px', alignItems: 'center', fontWeight: 700 }, title: 'Keys 1–8 recall scenes, 0 = all off, bound keys toggle pedals' }, h('input', { type: 'checkbox', checked: BRD.live, onchange: e => { BRD.live = e.target.checked; saveBrd(); } }), 'Live keys'),
    h('label', { class: 'chk small', style: { display: 'flex', gap: '4px', alignItems: 'center', fontWeight: 700 } }, h('input', { type: 'checkbox', checked: BRD.hidShow, onchange: e => { BRD.hidShow = e.target.checked; RIG.order.forEach(paintPedal); saveBrd(); } }), 'Show hidden'));
  UI.deck.append(UI.scenebar, UI.boardTools); p.insertBefore(UI.chain, UI.board);
  RIG.order.forEach(id => {
    const P = PED[id]; if (!P) return; const head = P.el.querySelector('.pedal-h'), it = bitem(id);
    const gear = h('button', { class: 'pgear', title: 'Pedal settings: width, colour, collapse, hide, footswitch key / MIDI', onclick: e => { e.stopPropagation(); pedalGear(id, gear); } }, '⚙'); head.append(h('span', { class: 'kbadge', style: { display: 'none' } }), gear);
    head.addEventListener('dblclick', e => { if (e.target.closest('.stomp,.pgear')) return; it.col = !it.col; paintPedal(id); saveBrd(); });
    head.addEventListener('click', e => { if (BRD.view === 'stomp' && !e.target.closest('.stomp,.pgear')) pedalState(id); });
    paintPedal(id);
  });
  renderScenes(); renderChain(); boardView(BRD.view);
  bus.on('rig:order', renderChain); bus.on('rig:refresh', renderChain); bus.on('rig:state', renderChain); bus.on('preset', () => { BRD.cur = -1; renderScenes(); });
}

/* >>> parts/13-stage.js */
/* ============================================================
   Part 13 · LIVE STAGE — show-ready visuals: 8 scenes, post-FX (trails / kaleidoscope / glow / hue),
   song HUD (chord, section, lyric, beat), fullscreen + pop-out, MIDI out (clock, chord roots, onsets)
   ============================================================ */
VMODES.push(['bloom', 'Chord Bloom'], ['orbit', 'Harmonic Orrery'], ['joy', 'Ridgeline'], ['pulse', 'Beat Grid'], ['prompter', 'Prompter']);
const SCN0 = (name, mode, hue, o) => Object.assign({ name, mode, hue, drift: 0, trail: .5, kal: 0, glow: .5, sens: 1, cam: false, flash: 0, sect: '', ov: { chord: true, lyric: false, beat: false, tuner: false, info: false } }, o || {});
const STG = Object.assign({
  cur: 0, safe: true, q: 1, out: '', clock: false, roots: false, trig: false, ccs: false, ch: 0, auto: false, hud: true,
  scenes: [SCN0('Resonance', 'hex', 175, { trail: .35, glow: .6 }), SCN0('Kaleido bloom', 'bloom', 300, { kal: 6, trail: .7, glow: .8, ov: { chord: true, lyric: false, beat: false, tuner: false, info: false } }),
    SCN0('Tunnel', 'tunnel', 200, { trail: .5, glow: .7, flash: .5 }), SCN0('Orrery', 'orbit', 40, { trail: .8, glow: .5, ov: { chord: true, lyric: false, beat: true, tuner: false, info: true } }),
    SCN0('Ridgeline', 'joy', 150, { trail: 0, glow: .4 }), SCN0('Beat grid', 'pulse', 20, { trail: .4, glow: .7, flash: .4, ov: { chord: true, lyric: false, beat: true, tuner: false, info: false } }),
    SCN0('Lyric prompter', 'prompter', 175, { glow: .3, ov: { chord: true, lyric: true, beat: true, tuner: false, info: true } }), SCN0('Strings + cam', 'strings', 175, { cam: true, glow: .5, ov: { chord: true, lyric: false, beat: false, tuner: true, info: false } })]
}, CFG.stage || {});
while (STG.scenes.length < 8) STG.scenes.push(SCN0('Scene ' + (STG.scenes.length + 1), 'hex', 175));
const saveStg = () => { CFG.stage = STG; saveCfg(); };
const SG = { off: null, small: null, wrap: null, cv: null, flash: 0, lastFlash: 0, idleT: 0, pop: null, wl: null, tick: -1, lastSym: '', lastSec: '', playPrev: false, noteOn: null, ccT: 0, joy: [], lastPos: '', hudDirty: 1 };
const scn = () => STG.scenes[STG.cur];
const hex2 = n => ('0' + Math.round(n).toString(16)).slice(-2);
function hsl(hh, s, l) { hh = ((hh % 360) + 360) % 360; s /= 100; l /= 100; const k = n => (n + hh / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return '#' + hex2(f(0) * 255) + hex2(f(8) * 255) + hex2(f(4) * 255); }
function stagePal(sc, t) { const hh = sc.hue + (sc.drift || 0) * t * 12; return { a: hsl(hh, 90, 58), b: hsl(hh + 55, 95, 66), c: hsl(hh + 120, 80, 58), d: hsl(hh + 200, 80, 62) }; }
const stageOwnsKeys = () => !!(SG.cv && (paneVisible('stage') || document.fullscreenElement === SG.wrap));
function stageScene(i) { if (i < 0 || i > 7) return; STG.cur = i; SG.hudDirty = 1; VZ.spec = null; saveStg(); renderStageUI(); toast('Stage: ' + STG.scenes[i].name); }

/* ---------- song position → HUD info ---------- */
function stageInfo() {
  const o = { playing: T.playing, sym: null, next: null, sec: '', barIn: 0, nBars: 0, beat: 0, nBeats: S.ts[0], lyric: '', slot: 0 };
  const live = AN.active && AN.chord && AN.chord[0] ? AN.chord[0].sym : null;
  if (T.playing && E.ctx) {
    const sp = spb(), ph = playheadSlot(); o.slot = ph; if (ph < 0) { o.beat = Math.floor(((ph % sp) + sp) % sp / (16 / S.ts[1])); o.sec = 'Count-in'; return o; }
    const bi = Math.floor(ph / sp), sib = ph - bi * sp, fb = barsCache()[bi]; if (!fb) return o; const cd = chordAt(bi, Math.floor(sib));
    o.sym = cd && cd.sym; o.next = cd && cd.next; o.sec = fb.sec.name; o.barIn = fb.bi + 1; o.nBars = fb.sec.bars.length; o.beat = Math.floor(sib / (16 / S.ts[1]));
    const ls = (fb.sec.lyrics || '').split('\n').filter(l => l.trim()); if (ls.length) { const idx = Math.min(ls.length - 1, Math.floor(fb.bi / fb.sec.bars.length * ls.length)); o.lyric = parseLyricLine(ls[idx]).text; o.lyricNext = ls[idx + 1] ? parseLyricLine(ls[idx + 1]).text : ''; }
  } else { o.sym = live; o.sec = 'Listening'; }
  return o;
}

/* ---------- extra visual modes (dispatched from drawVis) ---------- */
function stageExtra(mode, g, W, H, X) {
  if (mode === 'neural') return ngStageDraw(g, W, H, X);
  if (mode === 'halo' || mode === 'kaleido') return vzExtra2(mode, g, W, H, X);
  const { fd, bin, lvl, C, pulse, energy, dt } = X, cx = W / 2, cy = H / 2, R = Math.min(W, H), ch = AN.chroma || new Array(12).fill(0), mx = Math.max(.001, ...ch), t = VZ.t;
  if (mode === 'bloom') {
    const rot = t * (.12 + energy * .5); g.save(); g.translate(cx, cy); g.globalCompositeOperation = 'lighter';
    for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 12; i++) {
      const pc = (i * 7) % 12, v = Math.pow(ch[pc] / mx, 1.3) * (AN.active ? 1 : .15) + .06, a = (i / 12) * Math.PI * 2 + rot * (layer % 2 ? -1 : 1) + layer * .26, len = R * (.1 + .36 * v) * (1 + layer * .22 + pulse * .25), w = R * .05 * (1 + v * 1.4);
      g.save(); g.rotate(a); g.beginPath(); g.moveTo(R * .035, 0); g.quadraticCurveTo(len * .5, -w, len, 0); g.quadraticCurveTo(len * .5, w, R * .035, 0); g.fillStyle = mixc(C.a, C.b, v, (.16 + .3 * v) / (1 + layer * .4)); g.fill(); g.strokeStyle = mixc(C.c, C.b, v, .22 * (1 + v)); g.lineWidth = 1.2; g.stroke(); g.restore();
    }
    g.rotate(-rot); hexPath(g, 0, 0, R * (.045 + energy * .06 + pulse * .04)); g.fillStyle = mixc(C.b, C.a, pulse, .85); g.fill(); g.restore();
  } else if (mode === 'orbit') {
    const key = AN.key && AN.key[0], chord = AN.active && AN.chord[0] ? parseChord(AN.chord[0].sym) : null, pts = [];
    g.save(); g.translate(cx, cy);
    for (let i = 0; i < 12; i++) {
      const pc = (i * 7) % 12, v = ch[pc] / mx, rr = R * (.1 + (i % 6) * .055 + (i >= 6 ? .02 : 0)) + R * .06, sp = (.08 + i * .012) * (1 + energy), a = t * sp * (i % 2 ? 1 : -1) + i * 0.52;
      g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, rr, 0, 7); g.stroke();
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr, inCh = chord && chord.pcs.includes(pc); if (inCh) pts.push([x, y]);
      const sz = R * (.008 + .028 * v) + (inCh ? R * .012 : 0) + pulse * R * .006; g.shadowColor = C.a; g.shadowBlur = 8 + v * 22; g.fillStyle = inCh ? C.b : mixc(C.a, C.c, v, .35 + .6 * v); g.beginPath(); g.arc(x, y, sz, 0, 7); g.fill(); g.shadowBlur = 0;
      g.fillStyle = 'rgba(255,255,255,' + (.35 + .5 * v) + ')'; g.font = `700 ${Math.round(R * .026)}px ui-monospace,monospace`; g.textAlign = 'center'; g.fillText(pcName(pc), x, y - sz - R * .01);
    }
    if (pts.length > 1) { g.beginPath(); pts.forEach((q, i) => g[i ? 'lineTo' : 'moveTo'](q[0], q[1])); g.closePath(); g.fillStyle = mixc(C.b, C.a, .5, .16); g.fill(); g.strokeStyle = mixc(C.b, C.a, .5, .8); g.lineWidth = 2; g.stroke(); }
    g.fillStyle = mixc(C.a, C.b, .5, .9); hexPath(g, 0, 0, R * (.02 + pulse * .02)); g.fill(); g.restore(); g.textAlign = 'left';
  } else if (mode === 'joy') {
    const N = 96, rows = 30, fmin = 70, fmax = 6000, lr = Math.log(fmax / fmin), row = new Float32Array(N); for (let i = 0; i < N; i++) { const f = fmin * Math.exp(i / (N - 1) * lr); row[i] = lvl(fd[bin(f)]); }
    SG.joy.unshift(row); if (SG.joy.length > rows) SG.joy.pop(); g.fillStyle = '#050b0c'; g.fillRect(0, 0, W, H);
    for (let r = SG.joy.length - 1; r >= 0; r--) {
      const rw = SG.joy[r], y0 = H * .34 + (r / rows) * H * .58, k = 1 - r / rows, amp = H * .2 * (.5 + k * .7); g.beginPath(); g.moveTo(W * .05, y0);
      for (let i = 0; i < N; i++) g.lineTo(W * .05 + i / (N - 1) * W * .9, y0 - Math.pow(rw[i], 1.6) * amp); g.lineTo(W * .95, y0); g.closePath(); g.fillStyle = 'rgba(5,11,12,.92)'; g.fill();
      g.lineWidth = 1 + k * 1.6; g.strokeStyle = mixc(C.c, C.a, k, .25 + .75 * k); g.stroke();
    }
  } else if (mode === 'pulse') {
    const sz = Math.max(26, R / 12), hw = sz * Math.sqrt(3), cols = Math.ceil(W / hw) + 2, rows = Math.ceil(H / (sz * 1.5)) + 2, info = SG.info || {}, beatP = (info.playing ? ((info.slot % (16 / S.ts[1])) / (16 / S.ts[1])) : (t * 1.5) % 1), dn = 1 - beatP;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = c * hw + (r % 2 ? hw / 2 : 0) - hw / 2, y = r * sz * 1.5, u = x / W, d = Math.hypot(x - cx, y - cy) / (Math.hypot(cx, cy)), band = lvl(fd[bin(80 * Math.pow(60, clamp(u, 0, 1)))]), ring = pulse * Math.max(0, 1 - Math.abs(d - (1 - pulse) * 1.1) * 7), downb = (info.beat === 0 && info.playing ? Math.max(0, 1 - d * 1.4) * dn * dn : 0), v = clamp(band * .9 + ring + downb * .8, 0, 1.2);
      hexPath(g, x, y, sz * .93 * (.55 + .45 * Math.min(1, v + .15))); g.fillStyle = mixc(C.c, C.b, clamp(v, 0, 1), .06 + .8 * clamp(v, 0, 1)); g.fill();
    }
  } else if (mode === 'prompter') {
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R * (.55 + energy * .4)); gr.addColorStop(0, mixc(C.a, C.b, .3, .16 + pulse * .2)); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
}

/* ---------- stage frame: render, post-FX, HUD, MIDI out ---------- */
function stageFrame(ts) {
  stageMidiTick();
  if (!SG.cv || !E.ready || !(paneVisible('stage') || document.fullscreenElement === SG.wrap || SG.pop)) return;
  const sc = scn(), wrap = SG.wrap, d = (window.devicePixelRatio || 1) * STG.q, cw = wrap.clientWidth, chh = wrap.clientHeight; if (!cw || !chh) return;
  const w = Math.min(1920, Math.floor(cw * d)), hh = Math.min(1080 * 1.4, Math.floor(chh * d));
  if (SG.cv.width !== w || SG.cv.height !== hh) { SG.cv.width = w; SG.cv.height = hh; SG.off.width = w; SG.off.height = hh; SG.small.width = Math.max(2, w >> 2); SG.small.height = Math.max(2, hh >> 2); VZ.spec = null; SG.joy = []; }
  const info = SG.info = stageInfo(), t = VZ.t, C = stagePal(sc, t), off = SG.off, g = SG.cv.getContext('2d');
  drawVis(off, { mode: sc.mode, C, bgA: sc.mode === 'joy' || sc.mode === 'spectro' ? 1 : clamp(1 - sc.trail * .93, .05, 1), noText: true, cam: sc.cam, gain: (sc.sens - 1) * 20 });
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, 0, w, hh);
  if (sc.kal >= 3) {
    const n = sc.kal, cx = w / 2, cy = hh / 2, R = Math.hypot(cx, cy); for (let i = 0; i < n; i++) {
      g.save(); g.translate(cx, cy); g.rotate(i * 2 * Math.PI / n + t * .05 * (sc.drift || 0)); if (i % 2) g.scale(1, -1); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, -Math.PI / n, Math.PI / n); g.closePath(); g.clip(); g.drawImage(off, -cx, -cy); g.restore();
    }
  } else g.drawImage(off, 0, 0);
  if (sc.cam && sc.mode !== 'spectro') camTop(g, w, hh);
  if (sc.mode === 'halo') haloFront(g);
  if (sc.glow > .02) { const q = SG.small.getContext('2d'); q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, SG.small.width, SG.small.height); q.drawImage(SG.cv, 0, 0, SG.small.width, SG.small.height); g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = sc.glow * .9; g.imageSmoothingQuality = 'high'; g.drawImage(SG.small, 0, 0, w, hh); g.globalAlpha = sc.glow * .5; g.drawImage(SG.small, -w * .02, -hh * .02, w * 1.04, hh * 1.04); g.restore(); }
  if (sc.flash > 0 && SG.flash > .01) { g.fillStyle = 'rgba(255,255,255,' + (SG.flash * sc.flash * (STG.safe ? .22 : .6)).toFixed(3) + ')'; g.fillRect(0, 0, w, hh); SG.flash *= .88; }
  if (STG.hud !== false) drawStageHUD(g, w, hh, sc, info, C);
  if (SG.idle && ts - SG.idleT > 2800 && document.fullscreenElement === wrap) wrap.classList.add('idle');
}
function drawStageHUD(g, W, H, sc, info, C) {
  const ov = sc.ov, u = Math.min(W, H * 1.6), mono = 'ui-monospace,Menlo,monospace', pr = sc.mode === 'prompter', sh = 'rgba(0,0,0,.65)'; g.save(); g.shadowColor = sh; g.shadowBlur = u * .02; g.textBaseline = 'alphabetic';
  if (ov.chord) {
    const sym = info.sym || '', sz = u * (pr ? .26 : .14); g.font = `800 ${Math.round(sz)}px ${mono}`; g.textAlign = pr ? 'center' : 'left'; g.fillStyle = '#fff';
    const x = pr ? W / 2 : W * .04, y = pr ? H * .46 : H * .84; g.fillText(sym, x, y);
    if (info.next && info.playing) { g.font = `700 ${Math.round(sz * .34)}px ${mono}`; g.fillStyle = C.b; g.fillText('next  ' + info.next, x, y + (pr ? sz * .38 : -sz * .92)); }
  }
  if (ov.info || ov.beat) {
    g.textAlign = 'right'; g.font = `700 ${Math.round(u * .03)}px ${mono}`; g.fillStyle = 'rgba(255,255,255,.85)';
    if (ov.info) { const key = AN.key && AN.key[0]; g.fillText((info.sec ? info.sec.toUpperCase() + (info.nBars ? '  ' + info.barIn + '/' + info.nBars : '') : '') , W * .97, H * .07); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(Math.round(S.bpm) + ' BPM · ' + S.ts[0] + '/' + S.ts[1] + (key ? ' · ' + pcName(key.root) + (key.minor ? 'm' : '') : ''), W * .97, H * .07 + u * .042); }
    if (ov.beat) { const n = S.ts[0], r = u * .016, gap = r * 3.2, x0 = W * .97 - (n - 1) * gap - r; for (let i = 0; i < n; i++) { const on = info.playing && i === info.beat; g.beginPath(); g.arc(x0 + i * gap, H * (ov.info ? .07 + .09 : .07), r * (on ? 1.5 : 1), 0, 7); g.fillStyle = on ? (i === 0 ? C.b : '#fff') : 'rgba(255,255,255,.22)'; g.fill(); } }
  }
  if (ov.lyric && info.lyric) { g.textAlign = 'center'; g.font = `700 ${Math.round(u * (pr ? .06 : .045))}px ${mono}`; g.fillStyle = '#fff'; g.fillText(info.lyric, W / 2, H * (pr ? .72 : .76), W * .92); if (info.lyricNext) { g.font = `600 ${Math.round(u * .03)}px ${mono}`; g.fillStyle = 'rgba(255,255,255,.5)'; g.fillText(info.lyricNext, W / 2, H * (pr ? .72 : .76) + u * .065, W * .92); } }
  if (ov.tuner && AN.active && AN.midi != null) { g.textAlign = 'right'; g.font = `800 ${Math.round(u * .06)}px ${mono}`; g.fillStyle = Math.abs(AN.cents) < 6 ? '#3ddc84' : '#fff'; g.fillText(pcName(AN.midi) + ' ' + (AN.cents >= 0 ? '+' : '') + AN.cents.toFixed(0) + '¢', W * .97, H * .93); }
  g.restore(); g.textAlign = 'left';
}
bus.on('onset', () => { const now = performance.now(); if (now - SG.lastFlash > (STG.safe ? 340 : 80)) { SG.flash = 1; SG.lastFlash = now; } });

/* ---------- MIDI out ---------- */
function midiOut() { if (!MIDI.access) return null; const o = [...MIDI.access.outputs.values()]; return o.find(x => x.id === STG.out) || null; }
function stageMidiTick() {
  const o = midiOut(); if (!o) return; const ch = STG.ch & 15, ev = (a, b, c) => { try { o.send([a, b, c]); } catch (e) { } };
  if (STG.clock) {
    if (T.playing && E.ctx) {
      const ph = playheadSlot(); if (!SG.playPrev) { try { o.send([0xFA]); } catch (e) { } SG.tick = Math.floor(ph * 6); }
      const tk = Math.floor(ph * 6); let n = 0; while (SG.tick < tk && n < 24) { try { o.send([0xF8]); } catch (e) { } SG.tick++; n++; } if (tk - SG.tick > 24) SG.tick = tk;
    } else if (SG.playPrev) { try { o.send([0xFC]); } catch (e) { } }
  }
  SG.playPrev = T.playing;
  if (STG.roots) { const info = SG.info || stageInfo(), sym = info.sym || ''; if (sym !== SG.lastSym) { SG.lastSym = sym; if (SG.noteOn != null) ev(0x80 | ch, SG.noteOn, 0), SG.noteOn = null; const c = parseChord(sym); if (c) { SG.noteOn = 36 + c.root; ev(0x90 | ch, SG.noteOn, 96); } } }
  if (STG.ccs) { const n = performance.now(); if (n - SG.ccT > 40) { SG.ccT = n; ev(0xB0 | ch, 20, clamp(Math.round((AN.rms + 60) / 60 * 127), 0, 127)); ev(0xB0 | ch, 21, clamp(Math.round((AN.centroid || 0) / 6000 * 127), 0, 127)); } }
}
bus.on('onset', () => { const o = midiOut(); if (!o || !STG.trig) return; const ch = STG.ch & 15, v = clamp(Math.round((AN.rms + 50) / 40 * 127), 30, 127); try { o.send([0x90 | ch, 60, v]); setTimeout(() => { try { o.send([0x80 | ch, 60, 0]); } catch (e) { } }, 70); } catch (e) { } });
bus.on('transport', () => { if (!T.playing && SG.noteOn != null) { const o = midiOut(); if (o) try { o.send([0x80 | (STG.ch & 15), SG.noteOn, 0]); } catch (e) { } SG.noteOn = null; SG.lastSym = ''; } });
setInterval(() => { if (!STG.auto || !T.playing) return; const info = SG.info; if (!info || !info.sec || info.sec === SG.lastSec) return; SG.lastSec = info.sec; const i = STG.scenes.findIndex(s => s.sect && info.sec.toLowerCase().includes(s.sect.toLowerCase())); if (i >= 0 && i !== STG.cur) stageScene(i); }, 250);

/* ---------- fullscreen / pop-out ---------- */
async function stageFull() {
  if (SG.wrap.classList.contains('pfs')) { stagePfs(false); return; }
  try { if (document.fullscreenElement) { await document.exitFullscreen(); return; } if (!SG.wrap.requestFullscreen) throw new Error('no fullscreen'); await SG.wrap.requestFullscreen(); if (navigator.wakeLock) { SG.wl = await navigator.wakeLock.request('screen').catch(() => null); } SG.idleT = performance.now(); }
  catch (e) { if (document.body.dataset.form && document.body.dataset.form !== 'desktop') stagePfs(true); else toast('Fullscreen was blocked here — use the pop-out window instead', 'warn'); }
}
/* phones (notably iPhone Safari) cannot fullscreen an element: fill the viewport instead */
function stagePfs(on) {
  SG.wrap.classList.toggle('pfs', on); document.body.classList.toggle('pfs', on); SG.idleT = performance.now();
  if (on && navigator.wakeLock && !SG.wl) navigator.wakeLock.request('screen').then(w => { SG.wl = w; }).catch(() => { });
  if (!on && SG.wl) { try { SG.wl.release(); } catch (e) { } SG.wl = null; }
  if (typeof renderStageUI === 'function') renderStageUI(); setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) { SG.wrap && SG.wrap.classList.remove('idle'); if (SG.wl) { try { SG.wl.release(); } catch (e) { } SG.wl = null; } } });
function stagePop() {
  if (SG.pop && !SG.pop.closed) { SG.pop.focus(); return; }
  try {
    const w = window.open('', 'fw_stage', 'width=1024,height=576'); if (!w) throw 0; w.document.title = BRAND.short + ' Stage'; w.document.body.style.cssText = 'margin:0;background:#000;overflow:hidden;height:100vh';
    const v = w.document.createElement('video'); v.autoplay = true; v.muted = true; v.playsInline = true; v.style.cssText = 'width:100%;height:100%;object-fit:contain'; v.srcObject = SG.cv.captureStream(30); w.document.body.append(v); v.ondblclick = () => (w.document.fullscreenElement ? w.document.exitFullscreen() : v.requestFullscreen());
    w.document.body.title = 'Double-click for fullscreen'; SG.pop = w; w.addEventListener('pagehide', () => { SG.pop = null; }); toast('Pop-out ready — drag it to the projector, then double-click it for fullscreen', 'ok');
  } catch (e) { toast('The browser blocked the pop-out window — allow pop-ups for this page', 'warn'); }
}

/* ---------- pane UI ---------- */
function renderStageUI() {
  if (!SG.hudbar) return; const sc = scn();
  SG.hudbar.innerHTML = ''; STG.scenes.forEach((s, i) => SG.hudbar.append(h('button', { class: 'sbtn' + (i === STG.cur ? ' on' : ''), title: s.name + ' — key ' + (i + 1) + ' · MIDI note ' + (48 + i), onclick: () => stageScene(i) }, (i + 1) + ' ' + s.name)));
  SG.hudbar.append(h('span', { style: { flex: 1 } }), ...(document.body.dataset.form && document.body.dataset.form !== 'desktop' ? [h('button', { class: 'sbtn', title: 'Fill the screen', onclick: stageFull }, SG.wrap.classList.contains('pfs') ? '✕ Exit' : '⛶ Full')] : []), h('button', { class: 'sbtn', onclick: () => { STG.hud = !(STG.hud !== false); saveStg(); renderStageUI(); } }, STG.hud !== false ? 'HUD on' : 'HUD off'), h('button', { class: 'sbtn', title: 'Separate window for a projector / second screen', onclick: stagePop }, '⧉ Pop-out'), h('button', { class: 'sbtn', onclick: stageFull }, '⛶ Fullscreen'));
  const E_ = SG.editor; E_.innerHTML = '';
  const field = (label, ctl) => h('label', { class: 'small', style: { display: 'flex', flexDirection: 'column', gap: '3px', fontWeight: 700 } }, label, ctl);
  const rng = (k, min, max, step, fmt) => { const v = h('span', { class: 'mono tiny' }, (fmt || (x => x))(sc[k])); return h('div', { class: 'row', style: { gap: '6px' } }, h('input', { type: 'range', min, max, step, value: sc[k], style: { flex: 1 }, oninput: e => { sc[k] = +e.target.value; v.textContent = (fmt || (x => x))(sc[k]); saveStg(); } }), v); };
  const chk = (o, k, label) => h('label', { class: 'chk small', style: { display: 'flex', gap: '4px', alignItems: 'center', fontWeight: 700 } }, h('input', { type: 'checkbox', checked: o[k], onchange: e => { o[k] = e.target.checked; saveStg(); } }), label);
  E_.append(
    h('div', { class: 'card', style: { padding: '10px' } }, h('h4', { style: { margin: '0 0 8px' } }, 'Scene ' + (STG.cur + 1)),
      h('div', { class: 'sgrid', style: { marginTop: 0 } },
        field('Name', h('input', { class: 'in', value: sc.name, style: { fontFamily: 'var(--sans)' }, onchange: e => { sc.name = e.target.value || 'Scene'; saveStg(); renderStageUI(); } })),
        field('Visual', h('select', { class: 'in', style: { fontFamily: 'var(--sans)' }, onchange: e => { sc.mode = e.target.value; VZ.spec = null; SG.joy = []; saveStg(); } }, VMODES.map(([k, n]) => h('option', { value: k, selected: k === sc.mode }, n)))),
        field('Hue', rng('hue', 0, 359, 1, x => x + '°')), field('Hue drift', rng('drift', 0, 3, .05, x => x ? x.toFixed(2) : 'off')),
        field('Trails', rng('trail', 0, 1, .01, x => Math.round(x * 100) + '%')), field('Glow', rng('glow', 0, 1, .01, x => Math.round(x * 100) + '%')),
        field('Kaleidoscope', h('select', { class: 'in', style: { fontFamily: 'var(--sans)' }, onchange: e => { sc.kal = +e.target.value; saveStg(); } }, [[0, 'Off'], [3, '3 wedges'], [4, '4'], [6, '6'], [8, '8'], [12, '12']].map(([v, n]) => h('option', { value: v, selected: v === sc.kal }, n)))),
        field('Sensitivity', rng('sens', .4, 2.5, .05, x => '×' + x.toFixed(2))), field('Beat flash', rng('flash', 0, 1, .05, x => x ? Math.round(x * 100) + '%' : 'off')),
        field('Auto-switch on section', h('input', { class: 'in', value: sc.sect, placeholder: 'e.g. chorus', style: { fontFamily: 'var(--sans)' }, onchange: e => { sc.sect = e.target.value.trim(); saveStg(); } }))),
      h('div', { class: 'row', style: { gap: '14px', marginTop: '8px', flexWrap: 'wrap' } }, chk(sc, 'cam', '📷 Camera backdrop'), camFxBox(), chk(sc.ov, 'chord', 'Chord'), chk(sc.ov, 'lyric', 'Lyric line'), chk(sc.ov, 'beat', 'Beat dots'), chk(sc.ov, 'info', 'Section · BPM · key'), chk(sc.ov, 'tuner', 'Tuner'))),
    h('div', { class: 'card', style: { padding: '10px' } }, h('h4', { style: { margin: '0 0 8px' } }, 'Show settings'),
      h('div', { class: 'row', style: { gap: '14px', flexWrap: 'wrap', alignItems: 'center' } },
        chk(STG, 'safe', 'Reduce flashing (≤3 Hz, softer)'), chk(STG, 'auto', 'Auto-switch scenes by section name'),
        h('label', { class: 'small', style: { fontWeight: 700 } }, 'Render quality ', h('select', { class: 'in', style: { width: 'auto', fontFamily: 'var(--sans)' }, onchange: e => { STG.q = +e.target.value; saveStg(); } }, [[.5, 'Low (fast)'], [.75, 'Medium'], [1, 'High']].map(([v, n]) => h('option', { value: v, selected: v === STG.q }, n))))),
      h('div', { class: 'tiny muted', style: { marginTop: '6px' } }, 'Keys 1–8 pick scenes while this panel (or fullscreen) is showing · MIDI notes 48–55 pick scenes anywhere. Lyric lines advance with the bar position of the section.')),
    h('div', { class: 'card', style: { padding: '10px' } }, h('h4', { style: { margin: '0 0 8px' } }, 'MIDI out → lights, synths, DAW'),
      h('div', { class: 'row', style: { gap: '14px', flexWrap: 'wrap', alignItems: 'center' } },
        (() => { const sel = h('select', { class: 'in', style: { width: 'auto', fontFamily: 'var(--sans)' }, onchange: e => { STG.out = e.target.value; saveStg(); } }); const fill = () => { sel.innerHTML = ''; sel.append(h('option', { value: '' }, MIDI.access ? 'No output' : 'Enable MIDI first')); if (MIDI.access) MIDI.access.outputs.forEach(o => sel.append(h('option', { value: o.id, selected: o.id === STG.out }, o.name))); }; fill(); bus.on('midi', fill); return h('div', { class: 'row', style: { gap: '6px' } }, sel, h('button', { class: 'btn sm', onclick: () => { initMIDI(); } }, 'Enable MIDI')); })(),
        h('label', { class: 'small', style: { fontWeight: 700 } }, 'Channel ', h('input', { class: 'in', type: 'number', min: 1, max: 16, value: (STG.ch | 0) + 1, style: { width: '56px' }, onchange: e => { STG.ch = clamp((+e.target.value || 1) - 1, 0, 15); saveStg(); } })),
        chk(STG, 'clock', 'Clock + start/stop'), chk(STG, 'roots', 'Chord root notes'), chk(STG, 'trig', 'Note on every pick (note 60)'), chk(STG, 'ccs', 'CC20 loudness · CC21 brightness')),
      h('div', { class: 'tiny muted', style: { marginTop: '6px' } }, 'Clock is derived from the song playhead and sent per frame, so expect a little jitter — fine for lights and arpeggiators, not for tight audio sync.')));
}
function buildStagePane() {
  const p = PANES.stage; if (!p) return; SG.off = document.createElement('canvas'); SG.small = document.createElement('canvas');
  SG.cv = h('canvas'); SG.hudbar = h('div', { class: 'stagehud' }); SG.wrap = h('div', { class: 'stagewrap', style: { minHeight: '340px', aspectRatio: '16/8' } }, SG.cv, SG.hudbar);
  SG.editor = h('div', { style: { display: 'grid', gap: '10px', marginTop: '10px' } });
  const kick = () => { SG.idleT = performance.now(); SG.wrap.classList.remove('idle'); }; ['mousemove', 'mousedown', 'touchstart'].forEach(ev => SG.wrap.addEventListener(ev, kick, { passive: true })); SG.idle = true;
  SG.wrap.addEventListener('dblclick', e => { if (!e.target.closest('.sbtn')) stageFull(); });
  p.append(h('div', { class: 'row', style: { margin: '0 0 8px', gap: '10px' } }, h('div', { class: 'tiny muted' }, 'Show-ready visuals: pick a scene, go fullscreen (double-click), or pop it out to a projector. Play the song or just play — it follows both.')), SG.wrap, SG.editor);
  renderStageUI();
}

/* >>> parts/14-neural.js */
/* ============================================================
   Part 14 · NEURAL MAP — an interactive 3-D network that learns the song as it plays.
   Spectrum bands → pitch classes → chords → harmonic function / sections → key & tension,
   plus a growing embedding cloud of every note, and a Markov "next chord" predictor learned online.
   ============================================================ */
VMODES.push(['neural', 'Neural Map']);
const NG = Object.assign({ layout: 'net', color: 'pc', edges: true, labels: true, links: true, floor: true, ghosts: true, rot: true, ev: true, trans: true, pulses: true, yaw: -.6, pit: .38, zoom: 1, px: 0, py: 0 }, CFG.neural || {});
const saveNG = () => { CFG.neural = { layout: NG.layout, color: NG.color, edges: NG.edges, labels: NG.labels, links: NG.links, floor: NG.floor, ghosts: NG.ghosts, rot: NG.rot, ev: NG.ev, trans: NG.trans, pulses: NG.pulses }; saveCfg(); };
const NR = { nodes: new Map(), edges: [], events: [], seq: [], trans: new Map(), pulses: [], lastSlot: null, sym: '', symT: 0, hover: null, sel: null, cut: 1, last: 0, tickAt: -1, sections: [], hit: 0, miss: 0, pred: null, key: { root: 9, minor: true }, tension: 0, curChord: null, curSec: null, nBands: 24, evSeq: 0, dirty: true, fd: null, t0: performance.now(), pos: [] };
const FIFTH = pc => (pc * 7) % 12;                    // position on the circle of fifths
const FANG = pc => FIFTH(pc) / 12 * Math.PI * 2 - Math.PI / 2;
const NGPROJ = [];

/* ---------- colour ---------- */
const light_ = () => CFG.theme === 'light';
const pcCol = (pc, a = 1, l) => `hsla(${(FIFTH(pc) * 30 + 200) % 360},${light_() ? 70 : 85}%,${l || (light_() ? 42 : 62)}%,${a})`;
const ramp = (u, a = 1) => { u = clamp(u, 0, 1); const hh = 52 + u * 238, l = light_() ? 42 : 60 - u * 8; return `hsla(${hh},85%,${l}%,${a})`; };   // yellow → purple, like the reference plates
const hashHue = s => { let x = 7; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) % 360; return x; };
function evColor(e, a = 1) {
  switch (NG.color) {
    case 'time': return ramp(1 - e.prog, a);
    case 'section': return `hsla(${hashHue(e.sec || '-')},75%,${light_() ? 42 : 62}%,${a})`;
    case 'loud': return ramp(1 - e.vel, a);
    case 'octave': return ramp(1 - clamp((e.midi - 38) / 40, 0, 1), a);
    case 'quality': { const q = (parseChord(e.chord) || {}).q || ''; return `hsla(${q === 'm' || q === 'm7' ? 280 : q === '7' ? 30 : q === '' ? 190 : q.includes('dim') ? 350 : 110},75%,${light_() ? 42 : 62}%,${a})`; }
    default: return pcCol(e.pc, a);
  }
}

/* ---------- harmonic function ---------- */
function funcOf(sym) {
  const c = parseChord(sym); if (!c) return 'O'; const d = (c.root - NR.key.root + 12) % 12;
  const T = NR.key.minor ? [0, 3, 8] : [0, 4, 9], Sd = NR.key.minor ? [5, 2] : [5, 2], D = NR.key.minor ? [7, 10, 11] : [7, 11];
  return T.includes(d) ? 'T' : Sd.includes(d) ? 'S' : D.includes(d) ? 'D' : 'O';
}
const FN = { T: 'Tonic', S: 'Subdominant', D: 'Dominant', O: 'Colour' };

/* ---------- graph construction (rebuilt when the song changes; existing node state is kept) ---------- */
function ngNode(id, layer, kind, label, o) { let n = NR.nodes.get(id); if (!n) { n = Object.assign({ id, layer, kind, label, p: [0, 0, 0], v: [0, 0, 0], tgt: [0, 0, 0], act: 0, seen: 0, firstIdx: -1, born: 0, count: 0, r: 1 }, o || {}); n.p = [(Math.random() - .5) * .5, (Math.random() - .5) * .5, (Math.random() - .5) * .5]; NR.nodes.set(id, n); } else { n.label = label; Object.assign(n, o || {}); } n.live = true; return n; }
function ngBuild() {
  NR.nodes.forEach(n => n.live = false); NR.edges = [];
  const key = AN.key && AN.key[0] && AN.key[0].r > .6 ? { root: AN.key[0].root, minor: AN.key[0].minor } : { root: S.key, minor: S.minor }; NR.key = key;
  for (let i = 0; i < NR.nBands; i++) { const f = 70 * Math.pow(6000 / 70, (i + .5) / NR.nBands); ngNode('b' + i, 0, 'band', f < 1000 ? Math.round(f) + ' Hz' : (f / 1000).toFixed(1) + 'k', { f, i, seen: 1, r: .55 }); }
  for (let pc = 0; pc < 12; pc++) ngNode('p' + pc, 1, 'pc', pcName(pc), { pc, r: 1.1 });
  const secs = [], chordSet = new Map(); S.sections.forEach(sec => { secs.push(sec); const seenHere = new Set(); sec.bars.forEach(b => barChords(b).forEach(sym => { if (!parseChord(sym)) return; if (!chordSet.has(sym)) chordSet.set(sym, new Map()); const m = chordSet.get(sym); m.set(sec.id, (m.get(sec.id) || 0) + 1); })); });
  NR.sections = secs;
  const liveSyms = new Set(); NR.nodes.forEach(n => { if (n.kind === 'chord' && n.seen) liveSyms.add(n.sym); });   // chords heard live that aren't in the song stay
  chordSet.forEach((m, sym) => ngNode('c:' + sym, 2, 'chord', sym, { sym, secs: m, r: 1.25 })); liveSyms.forEach(sym => { if (!chordSet.has(sym)) ngNode('c:' + sym, 2, 'chord', sym, { sym, secs: new Map(), r: 1.25 }); });
  ['T', 'S', 'D', 'O'].forEach(f => ngNode('f:' + f, 3, 'func', FN[f], { fn: f, seen: 1, r: 1.2 }));
  secs.forEach((sec, i) => ngNode('s:' + sec.id, 3, 'section', sec.name, { sec, si: i, r: 1.3 }));
  ngNode('k:key', 4, 'key', 'Key', { seen: 1, r: 1.7 }); ngNode('k:ten', 4, 'tension', 'Tension', { seen: 1, r: 1.2 });
  NR.nodes.forEach((n, id) => { if (!n.live) NR.nodes.delete(id); });
  const E_ = (a, b, w, kind) => { const A = NR.nodes.get(a), B = NR.nodes.get(b); if (A && B) NR.edges.push({ a: A, b: B, w, kind: kind || 'f' }); };
  for (let pc = 0; pc < 12; pc++) { const f0 = 440 * Math.pow(2, (pc - 9) / 12); for (let k = -3; k <= 5; k++) { const f = f0 * Math.pow(2, k); if (f < 70 || f > 6000) continue; const bi = clamp(Math.floor(Math.log(f / 70) / Math.log(6000 / 70) * NR.nBands), 0, NR.nBands - 1); if (!NR.edges.some(e => e.a.id === 'b' + bi && e.b.id === 'p' + pc)) E_('b' + bi, 'p' + pc, 1 / (1 + Math.abs(k) * .15)); } }
  NR.nodes.forEach(n => { if (n.kind !== 'chord') return; const c = parseChord(n.sym); if (!c) return; n.cp = c; n.fn = funcOf(n.sym); c.pcs.forEach(pc => E_('p' + pc, n.id, pc === c.root ? 1 : pc === c.bass ? .9 : .7)); E_(n.id, 'f:' + n.fn, 1); n.secs.forEach((cnt, sid) => E_(n.id, 's:' + sid, Math.min(1, .3 + cnt * .15))); });
  ['T', 'S', 'D', 'O'].forEach(f => E_('f:' + f, 'k:key', f === 'O' ? .4 : 1)); NR.nodes.forEach(n => { if (n.kind === 'chord') E_(n.id, 'k:ten', n.fn === 'D' ? 1 : n.fn === 'O' ? .8 : .35); });
  ngLayout(); NR.dirty = false;
}
bus.on('song', () => { NR.dirty = true; });

/* ---------- layout targets ---------- */
const QH = q => /dim/.test(q) ? .9 : /7/.test(q) && !/maj7/.test(q) ? .75 : /sus|add|9|11|13/.test(q) ? .55 : /maj/.test(q) ? .3 : /m/.test(q) ? -.25 : 0;
function ngLayout() {
  const L = NG.layout, XS = 2.6; const nodes = [...NR.nodes.values()], by = k => nodes.filter(n => n.kind === k);
  by('band').forEach(n => { const u = n.i / (NR.nBands - 1); n.t_net = [-2 * XS, (u - .5) * 6.4, Math.sin(u * Math.PI) * 1.1]; n.t_fif = [Math.cos(u * 8.4) * .55, (u - .5) * 3.4, Math.sin(u * 8.4) * .55]; });
  by('pc').forEach(n => { const k = FIFTH(n.pc); n.t_net = [-XS, ((k / 11) - .5) * 5.6, (k % 2 ? .7 : -.7)]; n.t_fif = [Math.cos(FANG(n.pc)) * 2.5, -.2, Math.sin(FANG(n.pc)) * 2.5]; });
  const ch = by('chord'); ch.forEach((n, i) => { const c = n.cp; if (!c) return; const k = FIFTH(c.root), u = k / 11; n.t_net = [0, (u - .5) * 6.2, QH(c.q) * 2.2]; n.t_fif = [Math.cos(FANG(c.root)) * (1.45 + QH(c.q) * .4), QH(c.q) * 1.6 + .6, Math.sin(FANG(c.root)) * (1.45 + QH(c.q) * .4)]; });
  by('func').forEach((n, i) => { n.t_net = [XS, 2.5 - i * .75, 0]; n.t_fif = [Math.cos(i * 1.57) * .8, 2.6, Math.sin(i * 1.57) * .8]; });
  const ss = by('section'); ss.forEach((n, i) => { const u = ss.length > 1 ? i / (ss.length - 1) : .5; n.t_net = [XS, -.9 - u * 2.4, 0]; n.t_fif = [Math.cos(i / ss.length * 6.28) * 1.5, 3.4, Math.sin(i / ss.length * 6.28) * 1.5]; });
  const kk = NR.nodes.get('k:key'), kt = NR.nodes.get('k:ten'); if (kk) { kk.t_net = [2 * XS, .9, 0]; kk.t_fif = [0, 4.1, 0]; } if (kt) { kt.t_net = [2 * XS, -1.2, 0]; kt.t_fif = [.9, 3.8, .3]; }
  nodes.forEach(n => { n.tgt = L === 'net' ? n.t_net : n.t_fif; });
}
function ngForce(dt) {
  const ns = [...NR.nodes.values()].filter(n => n.kind !== 'band');
  ns.forEach(n => { n.f = [-n.p[0] * .09, -n.p[1] * .09, -n.p[2] * .09]; });
  for (let i = 0; i < ns.length; i++)for (let j = i + 1; j < ns.length; j++) { const a = ns[i], b = ns[j], dx = a.p[0] - b.p[0], dy = a.p[1] - b.p[1], dz = a.p[2] - b.p[2], d2 = dx * dx + dy * dy + dz * dz + .05, f = .9 / d2, d = Math.sqrt(d2); for (let q = 0; q < 3; q++) { const u = (a.p[q] - b.p[q]) / d * f; a.f[q] += u; b.f[q] -= u; } }
  const spring = (a, b, w, L0) => { if (!a.f || !b.f) return; const dx = b.p[0] - a.p[0], dy = b.p[1] - a.p[1], dz = b.p[2] - a.p[2], d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-3, f = (d - L0) * .06 * w; [dx, dy, dz].forEach((x, q) => { const u = x / d * f; a.f[q] += u; b.f[q] -= u; }); };
  NR.edges.forEach(e => { if (e.kind === 'f' && e.a.kind !== 'band') spring(e.a, e.b, e.w, 1.4); });
  NR.trans.forEach((c, key) => { const [a, b] = key.split('>'), A = NR.nodes.get('c:' + a), B = NR.nodes.get('c:' + b); if (A && B) spring(A, B, Math.min(2.5, .5 + c * .35), 1.1); });
  ns.forEach(n => { for (let q = 0; q < 3; q++) { n.v[q] = (n.v[q] + n.f[q] * dt * 30) * .86; n.v[q] = clamp(n.v[q], -.6, .6); n.p[q] += n.v[q] * dt * 30; } });
}

/* ---------- capture: song + live note events (always on, cheap) ---------- */
function ngAddEvent(midi, vel, src, chord, sec, prog) {
  const pc = ((midi % 12) + 12) % 12; NR.events.push({ midi, pc, vel: clamp(vel, .1, 1), src, chord: chord || '', sec: sec || '', prog: prog == null ? ((performance.now() - NR.t0) / 90000) % 1 : prog, i: NR.evSeq++, jx: Math.random() - .5, jy: Math.random() - .5, jz: Math.random() - .5, born: performance.now() });
  if (NR.events.length > 2600) NR.events.shift(); const n = NR.nodes.get('p' + pc); if (n) { n.act = Math.max(n.act, vel); n.count++; if (!n.seen) { n.seen = 1; n.firstIdx = NR.evSeq; n.born = performance.now(); } }
  if (NG.pulses && NR.curChord) ngPulse('p' + pc, 'c:' + NR.curChord, vel);
}
function ngPulse(a, b, v) { const A = NR.nodes.get(a), B = NR.nodes.get(b); if (!A || !B) return; const e = NR.edges.find(x => x.a === A && x.b === B); if (e && NR.pulses.length < 160) NR.pulses.push({ e, t: 0, v, s: .9 + Math.random() * .5 }); }
function ngChordChange(sym, src) {
  if (!sym || !parseChord(sym)) return; const prev = NR.curChord;
  if (prev === sym) return; NR.curChord = sym;
  let n = NR.nodes.get('c:' + sym); if (!n) { ngBuildSoft(sym); n = NR.nodes.get('c:' + sym); }
  if (n) { n.act = 1; n.count++; if (!n.seen) { n.seen = 1; n.firstIdx = NR.evSeq; n.born = performance.now(); } }
  if (prev) { if (NR.pred) { NR.pred.top === sym ? NR.hit++ : NR.miss++; } const k = prev + '>' + sym; NR.trans.set(k, (NR.trans.get(k) || 0) + 1); }
  NR.seq.push(sym); if (NR.seq.length > 4000) NR.seq.shift(); NR.pred = ngPredict(sym);
  if (n && NG.pulses) { ngPulse('c:' + sym, 'f:' + (n.fn || 'O'), 1); NR.edges.filter(e => e.a === n && e.b.kind === 'section').forEach(e => { if (NR.curSec && e.b.id === 's:' + NR.curSec) NR.pulses.push({ e, t: 0, v: 1, s: 1 }); }); }
}
function ngBuildSoft(sym) { if (NR.nodes.has('c:' + sym)) return; ngNode('c:' + sym, 2, 'chord', sym, { sym, secs: new Map(), r: 1.25, seen: 1, firstIdx: NR.evSeq, born: performance.now() }); ngBuild(); }
function ngPredict(sym) {
  const row = []; NR.trans.forEach((c, k) => { const [a, b] = k.split('>'); if (a === sym) row.push([b, c]); }); if (!row.length) return null; const tot = row.reduce((s, r) => s + r[1], 0); row.sort((x, y) => y[1] - x[1]);
  return { from: sym, top: row[0][0], list: row.map(r => ({ sym: r[0], p: r[1] / tot })) };
}
function ngEntropy() { const rows = new Map(); NR.trans.forEach((c, k) => { const a = k.split('>')[0]; rows.set(a, (rows.get(a) || 0) + c); }); let H = 0, W = 0; NR.trans.forEach((c, k) => { const a = k.split('>')[0], p = c / rows.get(a); H += -c * Math.log2(p); W += c; }); return W ? H / W : 0; }

function ngCapture() {
  if (!E.ready) return;
  for (let i = 0; i < 12; i++) PB.chroma[i] *= .94;
  if (T.playing && E.ctx) {
    const sp = spb(), ph = playheadSlot(), total = Math.max(1, songSlots()), cur = Math.floor(ph);
    if (NR.lastSlot == null || cur < NR.lastSlot || cur - NR.lastSlot > 96) NR.lastSlot = cur - 1;
    for (let s = NR.lastSlot + 1; s <= cur; s++) {
      if (s < 0) continue; const bi = Math.floor(s / sp), sib = s - bi * sp, fb = barsCache()[bi]; if (!fb) continue; const cd = chordAt(bi, sib), prog = s / total, sec = fb.sec.name; NR.curSec = fb.sec.id;
      if (cd && cd.sym) {
        if (cd.rel === 0) {
          ngChordChange(cd.sym, 'song'); PB.sym = cd.sym; const c = parseChord(cd.sym), v = voicingFor(cd.sym);
          if (S.band.compOn && v) v.frets.forEach((f, i) => { if (f != null) { ngAddEvent(S.tuning[i] + S.capo + f, .62, 'song', cd.sym, sec, prog); pbHit(i, f, S.tuning[i] + S.capo + f, .6); } });
          if (S.band.bassOn && c) { ngAddEvent(36 + c.root, .8, 'song', cd.sym, sec, prog); pbHit(null, null, 36 + c.root, .9); }
        }
        if (S.band.leadOn) fb.bar.tab.forEach(n => { if (n.s === sib) { const mm = n.f === 'x' ? S.tuning[n.st] + S.capo : noteMidi(n); ngAddEvent(mm, .85, 'song', cd.sym, sec, prog); if (n.f !== 'x') pbHit(n.st, +n.f, mm, 1); VZ.pulses.push({ t: performance.now(), a: .7 }); if (VZ.pulses.length > 12) VZ.pulses.shift(); } });
        if (S.band.drumsOn && sib % 4 === 0) { VZ.pulses.push({ t: performance.now(), a: sib === 0 ? .8 : .45 }); if (VZ.pulses.length > 12) VZ.pulses.shift(); }
      }
    }
    NR.lastSlot = cur;
  } else NR.lastSlot = null;
  if (typeof STP !== 'undefined' && STP.playing && STM.an && STM.an.chordBars.length) {
    const pos = spPos(), bars = STM.an.chordBars; let bi = -1; for (let i = bars.length - 1; i >= 0; i--) if (bars[i].t <= pos) { bi = i; break; }
    if (bi >= 0) { const parts = bars[bi].chord.split(' ').filter(Boolean), half = parts.length > 1 && pos >= bars[bi].t + 2 * STM.an.per / STM.an.fps ? 1 : 0, sym = parts[half] || parts[0];
      if (sym && sym !== NR.curChord) { ngChordChange(sym, 'track'); const c = parseChord(sym); if (c) c.pcs.forEach((pc, k) => ngAddEvent(48 + ((pc - 48) % 12 + 12) % 12 + (k > 2 ? 12 : 0), .6, 'track', sym, '', STM.dur ? pos / STM.dur : 0)); if (c) ngAddEvent(36 + c.root, .8, 'track', sym, '', STM.dur ? pos / STM.dur : 0); } }
  }
  if (!T.playing && AN.active && AN.chord && AN.chord[0] && AN.clarity != null) { const sym = AN.chord[0].sym; if (sym === NR.sym) { if (performance.now() - NR.symT > 280) ngChordChange(sym, 'live'); } else { NR.sym = sym; NR.symT = performance.now(); } }
}
bus.on('onset', () => { if (T.playing) return; setTimeout(() => { if (!AN.active) return; const ch = AN.chord && AN.chord[0] && parseChord(AN.chord[0].sym); const v = clamp((AN.rms + 50) / 40, .3, 1), sym = AN.chord && AN.chord[0] ? AN.chord[0].sym : ''; if (AN.midi != null && (!ch || AN.clarity > .9)) ngAddEvent(AN.midi, v, 'live', sym, '', null); else if (ch) ch.pcs.forEach(pc => ngAddEvent(48 + ((pc - 48) % 12 + 12) % 12, v * .8, 'live', sym, '', null)); }, 70); });

/* ---------- update (visible only) ---------- */
function ngUpdate(dt, vis) {
  const an = E.anaRig; if (an) { if (!NR.fd || NR.fd.length !== an.frequencyBinCount) NR.fd = new Float32Array(an.frequencyBinCount); an.getFloatFrequencyData(NR.fd); }
  const fd = NR.fd, bh = E.ctx.sampleRate / (an ? an.fftSize : 4096), ch = AN.chroma || [], mx = Math.max(.001, ...ch), live = AN.active;
  NR.nodes.forEach(n => { n.act *= Math.pow(.05, dt * (n.kind === 'chord' || n.kind === 'section' ? .35 : 1.1)); });
  if (fd) for (let i = 0; i < NR.nBands; i++) { const n = NR.nodes.get('b' + i); if (!n) continue; const k0 = Math.max(1, Math.floor(70 * Math.pow(6000 / 70, i / NR.nBands) / bh)), k1 = Math.max(k0 + 1, Math.ceil(70 * Math.pow(6000 / 70, (i + 1) / NR.nBands) / bh)); let m = -140; for (let k = k0; k < k1 && k < fd.length; k++) m = Math.max(m, fd[k]); n.act = Math.max(n.act * .7, clamp((m + 90) / 55, 0, 1)); }
  for (let pc = 0; pc < 12; pc++) { const n = NR.nodes.get('p' + pc); if (n && live && ch.length) n.act = Math.max(n.act, Math.pow(ch[pc] / mx, 1.6) * .9); }
  const cs = [...NR.nodes.values()].filter(n => n.kind === 'chord'), cur = NR.nodes.get('c:' + NR.curChord);
  let tot = 0; cs.forEach(n => { if (!n.cp) return; n.sim = n.cp.pcs.reduce((s, pc) => s + (NR.nodes.get('p' + pc) ? NR.nodes.get('p' + pc).act : 0), 0) / n.cp.pcs.length; tot += n.sim * n.sim; });
  cs.forEach(n => { if (n.cp) n.act = Math.max(n.act, n.sim * n.sim / (tot + .001) * .9); });
  if (cur) cur.act = Math.max(cur.act, .95);
  ['T', 'S', 'D', 'O'].forEach(f => { const n = NR.nodes.get('f:' + f); if (n) n.act = Math.max(...cs.filter(c => c.fn === f).map(c => c.act), 0) * (f === 'O' ? .8 : 1); });
  NR.nodes.forEach(n => { if (n.kind === 'section') { n.act = Math.max(n.act * .0, NR.curSec === n.sec.id ? 1 : 0); if (n.act > .5 && !n.seen) { n.seen = 1; n.firstIdx = NR.evSeq; n.born = performance.now(); } } });
  const kk = NR.nodes.get('k:key'); if (kk) kk.act = AN.key && AN.key[0] ? clamp(AN.key[0].r, 0, 1) : .35;
  const scl = NR.key.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]; let out = 0, all = .001; for (let pc = 0; pc < 12; pc++) { const a = NR.nodes.get('p' + pc).act; all += a; if (!scl.includes((pc - NR.key.root + 12) % 12)) out += a; } const kt = NR.nodes.get('k:ten'); NR.tension += (clamp(out / all * 2.2 + (cur && cur.fn === 'D' ? .25 : 0), 0, 1) - NR.tension) * .1; if (kt) kt.act = NR.tension;
  /* node motion */
  if (NG.layout === 'force') ngForce(dt); const kk_ = 1 - Math.pow(.0009, dt);
  NR.nodes.forEach(n => { if (NG.layout === 'force' && n.kind !== 'band') return; const g = n.tgt || n.t_net || [0, 0, 0]; for (let q = 0; q < 3; q++) n.p[q] += (g[q] - n.p[q]) * kk_; });
  NR.pulses.forEach(p => { p.t += dt * p.s; }); NR.pulses = NR.pulses.filter(p => p.t < 1);
  if (NG.rot && !NR.drag) { NR.spinT = (NR.spinT || 0) + dt * .3; NG.yaw += NG.layout === 'net' ? Math.cos(NR.spinT) * dt * .14 : dt * .09; }
  if (NR.pred === null && cur) NR.pred = ngPredict(cur.sym);
}

/* ---------- projection & render ---------- */
function ngCam(c, W, H) { const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pit), sp = Math.sin(c.pit), sc = Math.min(W * .6, H * 1.02) * .095 * c.zoom, D = 13; return p => { const x1 = cy * p[0] + sy * p[2], z1 = -sy * p[0] + cy * p[2], y2 = cp * p[1] - sp * z1, z2 = sp * p[1] + cp * z1, w = D / (D - z2); return [W / 2 + c.px + x1 * sc * w, H * .54 + c.py - y2 * sc * w, z2, w]; }; }
function evPos(e) {
  const L = NG.layout; const pn = NR.nodes.get('p' + e.pc); const oc = (e.midi - 36) / 12;
  if (L === 'fifths') { const r = 2.7 + oc * .42; return [Math.cos(FANG(e.pc) + e.prog * 2.2) * r, -1.9 + e.prog * 5.4 + e.jy * .25, Math.sin(FANG(e.pc) + e.prog * 2.2) * r]; }
  const b = pn ? pn.p : [0, 0, 0]; return [b[0] + (e.jx * .55 - .1) - oc * .1, b[1] + e.jy * .5 + (oc - 1.2) * .08, b[2] + e.jz * .55 + oc * .12];
}
const NCOL = n => n.kind === 'band' ? ramp(1 - n.i / 23) : n.kind === 'pc' ? pcCol(n.pc) : n.kind === 'chord' ? (n.cp ? pcCol(n.cp.root) : '#aaa') : n.kind === 'func' ? ({ T: '#35d3c2', S: '#f2a900', D: '#e4572e', O: '#a58bff' })[n.fn] : n.kind === 'section' ? `hsl(${hashHue(n.label)},70%,${light_() ? 42 : 62}%)` : n.kind === 'key' ? (light_() ? '#223' : '#ffffff') : '#ff5fa2';
function hsl2a(c, a) { return c.startsWith('hsla') ? c.replace(/,[^,]+\)$/, ',' + a + ')') : c.startsWith('hsl(') ? c.replace('hsl(', 'hsla(').replace(')', ',' + a + ')') : c.startsWith('#') ? (() => { const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); return `rgba(${r},${g},${b},${a})`; })() : c; }
function ngNodeVisible(n) { if (!n.seen && !NG.ghosts) return false; if (NR.cut < 1 && n.seen && n.firstIdx > NR.cut * NR.evSeq) return false; return true; }
function ngRender(g, W, H, cam, opt) {
  opt = opt || {}; const P = ngCam(cam, W, H), L_ = light_() && !opt.dark, now = performance.now(), cutIdx = NR.cut * NR.evSeq;
  if (!opt.noBg) { g.fillStyle = L_ ? '#f4f4f2' : '#050b0c'; g.fillRect(0, 0, W, H); }
  const items = [], sel = NR.sel, nb = new Set(); if (sel && !sel.e) { nb.add(sel.id); NR.edges.forEach(e => { if (e.a === sel) nb.add(e.b.id); if (e.b === sel) nb.add(e.a.id); }); NR.trans.forEach((c, k) => { const [a, b] = k.split('>'); if ('c:' + a === sel.id) nb.add('c:' + b); if ('c:' + b === sel.id) nb.add('c:' + a); }); }
  const dim = n => sel && !sel.e && !nb.has(n.id) ? .18 : 1;
  /* floor + shadow */
  if (NG.floor) {
    const fy = NG.layout === 'fifths' ? -2.1 : -3.9, fs = 5.2, cs = [[-fs, fy, -fs], [fs, fy, -fs], [fs, fy, fs], [-fs, fy, fs]].map(P); g.beginPath(); cs.forEach((q, i) => g[i ? 'lineTo' : 'moveTo'](q[0], q[1])); g.closePath(); g.fillStyle = L_ ? 'rgba(0,0,0,.055)' : 'rgba(255,255,255,.045)'; g.fill();
    if (NG.ev) { const stride = Math.max(1, Math.floor(NR.events.length / 500)); for (let i = 0; i < NR.events.length; i += stride) { const e = NR.events[i]; if (e.i > cutIdx && NR.cut < 1) continue; const q = evPos(e), s = P([q[0], fy, q[2]]), r = (6 + e.vel * 5) * s[3] * cam.zoom; const gr = g.createRadialGradient(s[0], s[1], 0, s[0], s[1], r); gr.addColorStop(0, L_ ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(s[0] - r, s[1] - r, r * 2, r * 2); } }
  }
  /* edges */
  const ew = L_ ? '30,40,45' : '190,235,235';
  if (NG.edges) NR.edges.forEach(e => { if (!ngNodeVisible(e.a) || !ngNodeVisible(e.b)) return; if (!e.a.seen && !e.b.seen && e.a.kind !== 'band' && e.a.kind !== 'pc') return; const act = e.a.act * e.b.act * e.w, d = Math.min(dim(e.a), dim(e.b)), a = e.a.p, b = e.b.p, s = P(a), t = P(b), hi = sel && (e.a === sel || e.b === sel); const al = (.035 + act * .9 + (hi ? .35 : 0)) * d * (e.a.seen && e.b.seen ? 1 : .35); if (al < .02) return; g.strokeStyle = act > .12 || hi ? hsl2a(NCOL(e.b), clamp(al, 0, 1)) : `rgba(${ew},${al.toFixed(3)})`; g.lineWidth = (.5 + act * 3.2 + (hi ? 1.2 : 0)) * Math.min(1.8, (s[3] + t[3]) / 2); g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(t[0], t[1]); g.stroke(); });
  /* transitions (learned) */
  const curN = NR.nodes.get('c:' + NR.curChord); let maxC = 1; NR.trans.forEach(c => { maxC = Math.max(maxC, c); });
  if (NG.trans) NR.trans.forEach((c, key) => { const [a, b] = key.split('>'), A = NR.nodes.get('c:' + a), B = NR.nodes.get('c:' + b); if (!A || !B || !ngNodeVisible(A) || !ngNodeVisible(B)) return; const s = P(A.p), t = P(B.p), mx = (s[0] + t[0]) / 2, my = (s[1] + t[1]) / 2, dx = t[0] - s[0], dy = t[1] - s[1], dl = Math.hypot(dx, dy) + 1, bump = Math.min(60, dl * .35) * cam.zoom; const hot = curN && A === curN; g.strokeStyle = hsl2a(NCOL(A), (hot ? .9 : .28 + .4 * c / maxC) * Math.min(dim(A), dim(B))); g.lineWidth = (.8 + 3.2 * c / maxC) * s[3]; g.beginPath(); g.moveTo(s[0], s[1]); g.quadraticCurveTo(mx - dy / dl * bump, my + dx / dl * bump, t[0], t[1]); g.stroke(); const ux = (t[0] - (mx - dy / dl * bump)) , uy = (t[1] - (my + dx / dl * bump)), ul = Math.hypot(ux, uy) + 1e-3; g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(t[0] - ux / ul * 9 * t[3], t[1] - uy / ul * 9 * t[3], 2.2 * t[3], 0, 7); g.fill(); });
  /* embedding links */
  if (NG.ev && NG.links && NR.events.length > 1) { g.lineWidth = 1; let last = null; const from = Math.max(0, NR.events.length - 140); for (let i = from; i < NR.events.length; i++) { const e = NR.events[i]; if (e.i > cutIdx && NR.cut < 1) break; const q = P(evPos(e)); if (last) { g.strokeStyle = evColor(e, .16 + .3 * (i - from) / (NR.events.length - from)); g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(q[0], q[1]); g.stroke(); } last = q; } }
  /* items */
  NR.nodes.forEach(n => { if (!ngNodeVisible(n)) return; const q = P(n.p); items.push({ t: 0, n, q, z: q[2] }); });
  if (NG.ev) NR.events.forEach(e => { if (NR.cut < 1 && e.i > cutIdx) return; const q = P(evPos(e)); items.push({ t: 1, e, q, z: q[2] }); });
  items.sort((a, b) => a.z - b.z); const hov = NR.hover, scr = opt.noHit ? null : (NR.pos = []);
  items.forEach(it => {
    const q = it.q, w = q[3];
    if (it.t === 1) { const e = it.e, age = (now - e.born) / 1000, r = (2.1 + e.vel * 2.2) * w * Math.sqrt(cam.zoom) * (1 + Math.max(0, 1 - age * 2) * 1.6), a = (sel && !sel.e ? (nb.has('p' + e.pc) || nb.has('c:' + e.chord) ? 1 : .15) : 1) * (.45 + .5 * Math.max(0, 1 - age / 40)); g.fillStyle = evColor(e, clamp(a, 0, 1)); g.beginPath(); g.arc(q[0], q[1], r, 0, 7); g.fill(); if (scr) scr.push({ e, x: q[0], y: q[1], r: r + 3, ev: true }); return; }
    const n = it.n, ghost = !n.seen, pop = clamp((now - n.born) / 600, 0, 1), eas = n.born && n.seen ? 1 + Math.sin(pop * Math.PI) * .6 : 1, base = (n.kind === 'band' ? 3.2 : n.kind === 'pc' ? 8 : n.kind === 'chord' ? 10 : n.kind === 'key' ? 14 : 9) * Math.sqrt(cam.zoom), r = base * w * (1 + n.act * .55) * eas * (ghost ? .8 : 1), d = dim(n), col = NCOL(n);
    if (!ghost && n.act > .15) { g.shadowColor = col; g.shadowBlur = 8 + n.act * 22; }
    g.beginPath(); n.kind === 'section' || n.kind === 'func' ? (() => { for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; g[i ? 'lineTo' : 'moveTo'](q[0] + r * 1.1 * Math.cos(a), q[1] + r * 1.1 * Math.sin(a)); } g.closePath(); })() : g.arc(q[0], q[1], r, 0, 7);
    if (ghost) { g.strokeStyle = hsl2a(col, .35 * d); g.lineWidth = 1.2; g.setLineDash([3, 3]); g.stroke(); g.setLineDash([]); } else { g.fillStyle = hsl2a(col, (.25 + n.act * .75) * d); g.fill(); g.strokeStyle = hsl2a(col, d); g.lineWidth = 1.4 + n.act * 1.5; g.stroke(); }
    g.shadowBlur = 0;
    if (n === curN && NR.pred && NG.trans) { g.strokeStyle = L_ ? '#111' : '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(q[0], q[1], r + 5 * w, 0, 7); g.stroke(); }
    if (NR.pred && n.sym && NR.pred.list) { const pr = NR.pred.list.find(x => x.sym === n.sym); if (pr && !opt.noPred) { g.strokeStyle = hsl2a(col, .95); g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.arc(q[0], q[1], r + (5 + 10 * pr.p) * w, 0, 7); g.stroke(); g.setLineDash([]); n.pp = pr.p; } else n.pp = 0; }
    if (scr) scr.push({ n, x: q[0], y: q[1], r: Math.max(8, r + 3) });
    const show = NG.labels && (n.kind !== 'band' || n.i % 4 === 0) && (!ghost || n.kind !== 'band'), big = n.kind !== 'band' || cam.zoom > 1.1;
    if (show && big && (w > .85 || n.act > .2 || n === sel || n === hov)) { g.font = `${n.kind === 'chord' ? 800 : 700} ${Math.round((n.kind === 'band' ? 9 : n.kind === 'chord' ? 12 : 11) * Math.min(1.4, w) * Math.sqrt(cam.zoom))}px ui-monospace,Menlo,monospace`; g.textAlign = 'center'; g.fillStyle = L_ ? `rgba(20,30,35,${(ghost ? .35 : .9) * d})` : `rgba(235,250,250,${(ghost ? .3 : .9) * d})`; g.fillText(n.label + (n.pp ? ' ' + Math.round(n.pp * 100) + '%' : ''), q[0], q[1] - r - 5 * w); }
  });
  /* pulses */
  if (NG.pulses) NR.pulses.forEach(p => { const s = P(p.e.a.p), t = P(p.e.b.p), x = s[0] + (t[0] - s[0]) * p.t, y = s[1] + (t[1] - s[1]) * p.t; g.fillStyle = hsl2a(NCOL(p.e.b), (1 - p.t * .5) * p.v); g.shadowColor = NCOL(p.e.b); g.shadowBlur = 12; g.beginPath(); g.arc(x, y, 2.6 + p.v * 2, 0, 7); g.fill(); g.shadowBlur = 0; });
  /* layer captions */
  if (NG.labels && NG.layout === 'net' && !opt.noCaps) { g.font = '700 10px ui-monospace,monospace'; g.textAlign = 'center'; g.fillStyle = L_ ? 'rgba(20,30,35,.5)' : 'rgba(220,245,245,.45)'; [['SPECTRUM', -2, 3.7], ['PITCH CLASS', -1, 3.6], ['CHORDS', 0, 3.7], ['FUNCTION · FORM', 1, 3.5], ['KEY · TENSION', 2, 2.2]].forEach(([t, k, y]) => { const q = P([k * 2.6, y, 0]); g.fillText(t, q[0], q[1]); }); }
  g.textAlign = 'left';
}

/* ---------- pane ---------- */
const NC = { yaw: .6, pit: .45, zoom: 1, px: 0, py: 0 };   // stage camera
function ngStageDraw(g, W, H, info) { ngFrameCommon(); NC.yaw += .0025; NC.pit = .38 + Math.sin(VZ.t * .12) * .12; NC.zoom = Math.max(1, Math.min(W, H) / 700 * 1.1); const was = NR.sel; NR.sel = null; ngRender(g, W, H, NC, { noBg: true, noHit: true, dark: true, noCaps: false }); NR.sel = was; }
function ngFrameCommon() { const now = performance.now(); if (NR.tickAt === now) return; const dt = Math.min(.1, (now - (NR.last || now)) / 1000); NR.last = now; NR.tickAt = now; if (NR.dirty) ngBuild(); if (NG.layout !== 'force') ngLayout(); ngUpdate(dt); }
function neuralFrame() { if (!E.ready) return; if (NR.dirty && S.sections) ngBuild(); ngCapture(); if (!paneVisible('neural')) return; ngFrameCommon(); if (!NR.cv) return; const cv = NR.cv, g = cv.getContext('2d'); NR.hudT = (NR.hudT || 0) + 1; ngRender(g, cv.width, cv.height, NG, {}); ngHud(g, cv.width, cv.height); if (CFG.vzNeck !== false && nkActive()) { const W = cv.width, H = cv.height, w = Math.min(W * .5, 520 * (W / 900 || 1)), hh = Math.max(50, w * .15); drawMiniNeck(g, W - w - 12, 12, w, hh, {}); } if (NR.hudT % 8 === 0) ngPanel(); }
function ngHud(g, W, H) {
  const L_ = light_(), u = Math.min(W, H * 1.5), mono = 'ui-monospace,Menlo,monospace'; g.font = `700 ${Math.round(u * .024)}px ${mono}`; g.fillStyle = L_ ? 'rgba(20,30,35,.75)' : 'rgba(225,248,248,.8)'; g.textAlign = 'left';
  const lines = [`events ${NR.events.length}   chords ${[...NR.nodes.values()].filter(n => n.kind === 'chord' && n.seen).length}/${[...NR.nodes.values()].filter(n => n.kind === 'chord').length}   transitions ${NR.trans.size}`, `entropy ${ngEntropy().toFixed(2)} bits   next-chord ${NR.hit + NR.miss ? Math.round(NR.hit / (NR.hit + NR.miss) * 100) + '% (' + NR.hit + '/' + (NR.hit + NR.miss) + ')' : '—'}`];
  const y0 = H - 14 - (NR.pred && NR.pred.list ? 2 : 1) * u * .03; lines.forEach((t, i) => g.fillText(t, 14, y0 + i * u * .03)); if (NR.pred && NR.pred.list) g.fillText('after ' + NR.pred.from + ' →  ' + NR.pred.list.slice(0, 3).map(x => x.sym + ' ' + Math.round(x.p * 100) + '%').join('   '), 14, y0 + 2 * u * .03);
}
function ngPick(x, y) { let best = null, bd = 1e9; (NR.pos || []).forEach(p => { const d = Math.hypot(p.x - x, p.y - y); if (d < p.r && d - (p.ev ? 0 : 6) < bd) { bd = d - (p.ev ? 0 : 6); best = p; } }); return best; }
function ngPanel() {
  const box = NR.panel; if (!box) return; const sel = NR.sel || NR.hover; let html = '';
  if (!sel) { box.innerHTML = '<div class="tiny muted">Hover a node or note for details. Click to pin and light up its connections. Drag to orbit · right-drag or Shift-drag to pan · wheel to zoom · double-click to reset.</div>'; return; }
  const row = (a, b) => `<div class="kv"><span>${esc(a)}</span><b>${esc(b)}</b></div>`;
  if (sel.e) { const e = sel.e; html += `<h5>Note ${pcName(e.pc)}${Math.floor(e.midi / 12) - 1}</h5>` + row('Source', e.src) + row('Chord', e.chord || '—') + row('Section', e.sec || '—') + row('Velocity', Math.round(e.vel * 100) + '%') + row('Song position', Math.round(e.prog * 100) + '%'); }
  else {
    const n = sel.n || sel; html += `<h5>${esc(n.label)}</h5>` + row('Layer', ['Spectrum', 'Pitch class', 'Chord', 'Function / form', 'Output'][n.layer]) + row('Activation', Math.round(n.act * 100) + '%') + row('Seen', n.seen ? (n.count || 1) + '×' : 'not yet');
    const ins = NR.edges.filter(e => e.b === n).length, outs = NR.edges.filter(e => e.a === n).length; html += row('In / out', ins + ' / ' + outs);
    if (n.kind === 'chord' && n.cp) { html += row('Notes', n.cp.pcs.map(pcName).join(' · ')) + row('Function', FN[n.fn]) + row('In sections', [...n.secs.keys()].map(id => { const s = NR.sections.find(q => q.id === id); return s ? s.name : ''; }).join(', ') || '—'); const pr = ngPredict(n.sym); if (pr) html += '<div class="tiny muted" style="margin-top:6px">LEARNED NEXT</div>' + pr.list.slice(0, 4).map(x => `<div class="bar"><i style="width:${x.p * 100}%"></i><span>${esc(x.sym)}</span><em>${Math.round(x.p * 100)}%</em></div>`).join(''); }
    if (n.kind === 'pc') { const cnt = NR.events.filter(e => e.pc === n.pc); html += row('Played', cnt.length + '×') + row('Fifths pos', FIFTH(n.pc)); const oc = {}; cnt.forEach(e => { const o = Math.floor(e.midi / 12) - 1; oc[o] = (oc[o] || 0) + 1; }); html += '<div class="tiny muted">OCTAVES ' + Object.keys(oc).map(o => o + ':' + oc[o]).join('  ') + '</div>'; }
    if (n.kind === 'section') html += row('Bars', n.sec.bars.length) + row('Chords', [...new Set(n.sec.bars.flatMap(barChords))].join(' '));
    if (n.kind === 'tension') html += row('Meaning', 'Energy outside the key + dominant pull');
    if (n.kind === 'key') html += row('Estimate', pcName(NR.key.root) + (NR.key.minor ? ' minor' : ' major'));
  }
  box.innerHTML = html;
}
function buildNeuralPane() {
  const p = PANES.neural; if (!p) return; p.classList.add('flex');
  const seg = (k, opts, fn) => h('div', { class: 'seg' }, opts.map(([v, n]) => h('button', { class: NG[k] === v ? 'on' : '', 'data-v': v, onclick: e => { NG[k] = v; saveNG(); $$('button', e.target.parentNode).forEach(b => b.classList.toggle('on', b === e.target)); fn && fn(v); } }, n)));
  const tg = (k, label, title) => h('label', { class: 'chk small', title, style: { display: 'flex', gap: '4px', alignItems: 'center', fontWeight: 700 } }, h('input', { type: 'checkbox', checked: NG[k], onchange: e => { NG[k] = e.target.checked; saveNG(); } }), label);
  const bar = h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', margin: '0 0 8px', alignItems: 'center' } },
    seg('layout', [['net', '◫ Layers'], ['fifths', '◎ Fifths'], ['force', '✺ Force']], v => { if (v !== 'force') { NR.nodes.forEach(n => { n.tgtF = null; }); ngLayout(); } }),
    h('label', { class: 'small', style: { fontWeight: 700 } }, 'Colour by ', h('select', { class: 'in', style: { width: 'auto', fontFamily: 'var(--sans)' }, onchange: e => { NG.color = e.target.value; saveNG(); } }, [['pc', 'Pitch class'], ['time', 'Time in song'], ['section', 'Section'], ['loud', 'Loudness'], ['octave', 'Octave'], ['quality', 'Chord quality']].map(([v, n]) => h('option', { value: v, selected: NG.color === v }, n)))),
    tg('edges', 'Edges'), tg('trans', 'Learned transitions'), tg('ev', 'Notes'), tg('links', 'Path'), tg('labels', 'Labels'), tg('ghosts', 'Unheard'), tg('floor', 'Floor'), tg('pulses', 'Pulses'), tg('rot', 'Spin'),
    h('button', { class: 'btn sm', title: 'Teach the network this song’s chord order right now', onclick: () => { const seq = []; S.sections.forEach(s => s.bars.forEach(b => barChords(b).forEach(c => seq.push(c)))); let pv = null; seq.forEach(c => { if (!parseChord(c)) return; const n = NR.nodes.get('c:' + c); if (n && !n.seen) { n.seen = 1; n.firstIdx = NR.evSeq; n.born = performance.now(); } if (pv && pv !== c) { const k = pv + '>' + c; NR.trans.set(k, (NR.trans.get(k) || 0) + 1); } pv = c; }); const cur = NR.curChord || seq[0]; NR.pred = ngPredict(cur); toast('Network pre-trained on the song', 'ok'); } }, '⚡ Pre-train'),
    h('button', { class: 'btn sm', onclick: () => { NR.events = []; NR.seq = []; NR.trans = new Map(); NR.hit = NR.miss = 0; NR.pred = null; NR.curChord = null; NR.evSeq = 0; NR.nodes.forEach(n => { if (n.kind === 'chord' || n.kind === 'pc' || n.kind === 'section') { n.seen = 0; n.count = 0; n.firstIdx = -1; } }); NR.cut = 1; NR.sel = null; if (NR.slider) NR.slider.value = 1000; } }, '↺ Forget'),
    h('label', { class: 'small', style: { fontWeight: 700, display: 'flex', gap: '6px', alignItems: 'center' }, title: 'Scrub back through what the network had learned' }, 'Replay ', NR.slider = h('input', { type: 'range', min: 0, max: 1000, value: 1000, style: { width: '140px' }, oninput: e => { NR.cut = +e.target.value / 1000; } })));
  NR.cv = h('canvas', { style: { width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: 'grab' } }); NR.tip = h('div', { class: 'ngtip' }); NR.panel = h('div', { class: 'ngpanel' });
  NR.wrap = h('div', { class: 'stagewrap', style: { flex: 1, minHeight: '340px', display: 'flex', background: 'transparent', border: '1px solid var(--line)' } }, h('div', { style: { position: 'relative', flex: 1, minWidth: 0 } }, NR.cv, NR.tip), NR.panel);
  p.append(bar, NR.wrap);
  new ResizeObserver(() => { const d = (window.devicePixelRatio || 1), w = NR.cv.clientWidth, hh = NR.cv.clientHeight; if (w && (NR.cv.width !== Math.floor(w * d) || NR.cv.height !== Math.floor(hh * d))) { NR.cv.width = Math.floor(w * d); NR.cv.height = Math.floor(hh * d); } }).observe(NR.cv);
  const cv = NR.cv, xy = e => { const r = cv.getBoundingClientRect(), d = cv.width / r.width; return [(e.clientX - r.left) * d, (e.clientY - r.top) * d, r]; };
  const pts = new Map(); let pin = null, down = null;
  const pinStat = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 }; };
  cv.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); cv.setPointerCapture(e.pointerId); if (pts.size === 2) { const st = pinStat(); pin = { d: st.d, z: NG.zoom, mx: st.mx, my: st.my }; if (down) down.moved = true; return; } down = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2, moved: false }; NR.drag = true; cv.style.cursor = 'grabbing'; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointermove', e => { if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]); if (pin && pts.size >= 2) { const st = pinStat(), k = cv.width / cv.getBoundingClientRect().width; NG.zoom = clamp(pin.z * st.d / pin.d, .35, 4); NG.px += (st.mx - pin.mx) * k; NG.py += (st.my - pin.my) * k; pin.mx = st.mx; pin.my = st.my; return; } const [x, y, r] = xy(e); if (down) { const dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.abs(dx) + Math.abs(dy) > 3) down.moved = true; if (down.pan) { NG.px += dx * (cv.width / r.width); NG.py += dy * (cv.width / r.width); } else { NG.yaw += dx * .007; NG.pit = clamp(NG.pit + dy * .006, -1.4, 1.4); } down.x = e.clientX; down.y = e.clientY; return; } const hit = ngPick(x, y); NR.hover = hit ? (hit.e ? hit : hit.n) : null; cv.style.cursor = hit ? 'pointer' : 'grab'; if (hit) { NR.tip.style.display = 'block'; NR.tip.style.left = (e.clientX - r.left + 14) + 'px'; NR.tip.style.top = (e.clientY - r.top + 10) + 'px'; NR.tip.textContent = hit.e ? pcName(hit.e.pc) + (Math.floor(hit.e.midi / 12) - 1) + ' · ' + (hit.e.chord || hit.e.src) : hit.n.label; } else NR.tip.style.display = 'none'; });
  cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); if (!pts.size) { pin = null; down = null; NR.drag = false; } });
  cv.addEventListener('pointerup', e => { pts.delete(e.pointerId); if (pin) { if (pts.size < 2) pin = null; if (down) down.moved = true; if (!pts.size) { down = null; NR.drag = false; cv.style.cursor = 'grab'; } return; } const [x, y] = xy(e); if (down && !down.moved) { const hit = ngPick(x, y); NR.sel = hit ? (hit.e ? hit : hit.n) : null; ngPanel(); if (hit && !hit.e && hit.n && hit.n.kind === 'chord' && hit.n.sym) nkPinChord(hit.n.sym); } down = null; NR.drag = false; cv.style.cursor = 'grab'; });
  cv.addEventListener('pointerleave', () => { NR.hover = null; NR.tip.style.display = 'none'; });
  cv.addEventListener('wheel', e => { e.preventDefault(); NG.zoom = clamp(NG.zoom * Math.exp(-e.deltaY * .0012), .35, 4); }, { passive: false });
  cv.addEventListener('dblclick', () => { NG.yaw = -.6; NG.pit = .38; NG.zoom = 1; NG.px = NG.py = 0; NR.sel = null; });
  ngPanel();
}

/* >>> parts/15-safety.js */
/* ============================================================
   Part 15 · version history (autosave snapshots) + "calibrate to my guitar" (noise gate & string check)
   ============================================================ */
const VH = { idx: store.get('vhist', []), last: '', lastT: 0 };
const vhHash = j => { let x = 5381; for (let i = 0; i < j.length; i++) x = ((x << 5) + x + j.charCodeAt(i)) | 0; return x; };
function vhSnap(label, force) {
  try {
    const j = JSON.stringify(S), hs = String(vhHash(j)); if (!force && hs === VH.last) return false; if (!S.sections.length) return false;
    VH.last = hs; VH.lastT = Date.now(); const id = Date.now().toString(36); store.set('vh.' + id, j);
    VH.idx.unshift({ id, t: Date.now(), title: S.title || 'Untitled', bars: totalBars(), label: label || 'auto', hs }); while (VH.idx.length > 30) { const o = VH.idx.pop(); store.set('vh.' + o.id, null); }
    store.set('vhist', VH.idx); bus.emit('vh'); return true;
  } catch (e) { return false; }
}
let vhTimer = 0; bus.on('song', () => { clearTimeout(vhTimer); vhTimer = setTimeout(() => { if (Date.now() - VH.lastT > 25000) vhSnap('auto'); }, 8000); });
bus.on('transport', () => { if (T.playing && Date.now() - VH.lastT > 5000) vhSnap('before play'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) vhSnap('on leave'); });
function vhRestore(id) { const j = store.get('vh.' + id, null); if (!j) return toast('Snapshot is gone', 'warn'); vhSnap('before restore', true); S = JSON.parse(j); commit(true); bus.emit('song', 'reload'); toast('Restored snapshot', 'ok'); }
function buildVersionCard() {
  const p = PANES.exp; if (!p) return; const list = h('div', { style: { display: 'grid', gap: '4px', maxHeight: '260px', overflow: 'auto' } });
  const fmt = t => { const d = new Date(t), n = Date.now() - t; return n < 6e4 ? 'just now' : n < 36e5 ? Math.round(n / 6e4) + ' min ago' : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  const render = () => { list.innerHTML = ''; if (!VH.idx.length) list.append(h('div', { class: 'tiny muted' }, 'No snapshots yet — they are taken as you work, before each play, and when you leave the page.')); VH.idx.forEach(v => list.append(h('div', { class: 'row', style: { gap: '8px', padding: '5px 8px', background: 'var(--panel2)', borderRadius: '8px', alignItems: 'center' } }, h('b', { style: { flex: 1, fontSize: '12px' } }, v.title, h('span', { class: 'muted', style: { fontWeight: 500 } }, '  ·  ' + v.bars + ' bars · ' + v.label)), h('span', { class: 'tiny muted' }, fmt(v.t)), h('button', { class: 'btn sm', onclick: () => vhRestore(v.id) }, 'Restore'), h('button', { class: 'btn sm bad', title: 'Delete this snapshot', onclick: () => { VH.idx = VH.idx.filter(x => x.id !== v.id); store.set('vh.' + v.id, null); store.set('vhist', VH.idx); render(); } }, '✕')))); };
  render(); bus.on('vh', render);
  p.append(h('div', { class: 'card', style: { padding: '12px', marginTop: '12px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '8px' } }, h('h4', { style: { margin: 0 } }, 'Version history'), h('button', { class: 'btn sm primary', onclick: () => { vhSnap('manual', true); toast('Snapshot saved', 'ok'); } }, '＋ Snapshot now')), list, h('div', { class: 'tiny muted', style: { marginTop: '6px' } }, 'Kept in this browser only (last 30). Restoring first snapshots your current song, so it is reversible.')));
}

/* ---------- guitar calibration ---------- */
const CAL = { busy: false };
function calWait(ms, fn) { return new Promise(res => { const t0 = performance.now(), iv = setInterval(() => { const el = performance.now() - t0; fn && fn(el); if (el >= ms) { clearInterval(iv); res(); } }, 30); }); }
async function calNoise(ui) {
  if (!E.ready) return toast('Power on first'); CAL.busy = true; ui.noise.textContent = 'Stay quiet — mute the strings… 3 s'; const r = []; await calWait(3000, () => r.push(AN.rms)); const v = r.filter(Number.isFinite).sort((a, b) => a - b), n = v[Math.floor(v.length * .9)] || -80;
  CFG.gateDb = clamp(Math.round(n + 10), -66, -38); CFG.noiseDb = Math.round(n); saveCfg(); CAL.busy = false; ui.noise.textContent = `Noise floor ${CFG.noiseDb} dB → note gate set to ${CFG.gateDb} dB`; ui.noise.className = 'chip ok';
}
async function calStrings(ui) {
  if (!E.ready) return toast('Power on first'); CAL.busy = true; const res = [], names = S.tuning.map(m => tunPc(m));
  for (let i = 0; i < 6; i++) {
    ui.str.textContent = `Pluck the open ${names[i]} string (string ${6 - i}) and let it ring…`; ui.dots.children[i].className = 'cdot now';
    let got = false, t0 = performance.now(); while (!got && performance.now() - t0 < 12000) { await calWait(60); if (AN.active && AN.rms > (CFG.gateDb || -56) + 12 && AN.midi != null) got = true; }
    if (!got) { ui.dots.children[i].className = 'cdot bad'; res.push(null); continue; }
    const rms = [], cents = [], cen = [], mid = []; let pk = -99; await calWait(1300, () => { rms.push(AN.rms); pk = Math.max(pk, AN.peak); if (AN.midi != null) { mid.push(AN.midi); cents.push(AN.cents); } cen.push(AN.centroid || 0); });
    const med = a => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; }, m = med(mid), off = ((med(cents) || 0)) + (m - S.tuning[i] - S.capo) * 100, hi = Math.max(...rms), dec = rms.length ? (rms.findIndex((x, k) => k > 3 && x < hi - 12) + 1) * 30 : 0;
    res.push({ str: i, name: names[i], peak: pk, level: hi, cents: off, centroid: med(cen), decay: dec || 1300, midi: m }); ui.dots.children[i].className = Math.abs(off) > 12 ? 'cdot warn' : 'cdot ok'; await calWait(900);
  }
  const ok = res.filter(Boolean); CFG.guitar = { t: Date.now(), strings: res }; saveCfg(); CAL.busy = false; const out = [];
  if (ok.length < 4) out.push('Only ' + ok.length + ' of 6 strings were heard — check the input and try again.');
  ok.forEach(r => { if (Math.abs(r.cents) > 12) out.push(`${r.name}: ${r.cents > 0 ? 'sharp' : 'flat'} by ${Math.abs(r.cents).toFixed(0)}¢ — tune it before transcribing.`); if (r.peak > -1.5) out.push(`${r.name}: clipping — lower the interface gain.`); });
  const lv = ok.length ? ok.reduce((a, r) => a + r.level, 0) / ok.length : -99; if (lv < -34) out.push(`Average level ${lv.toFixed(0)} dB is low — raise the gain so open strings land around −18 dB.`); if (lv > -8) out.push(`Average level ${lv.toFixed(0)} dB is hot — back it off a little.`);
  const sp = ok.length ? Math.max(...ok.map(r => r.level)) - Math.min(...ok.map(r => r.level)) : 0; if (sp > 12) out.push(`String-to-string level varies by ${sp.toFixed(0)} dB — check pickup height or pick attack.`);
  ui.str.textContent = ok.length ? 'Done. ' + (out.length ? '' : 'All strings in tune and at a healthy level.') : 'No strings heard.'; ui.out.innerHTML = ''; out.forEach(t => ui.out.append(h('div', { class: 'small', style: { color: 'var(--warn, #c77)' } }, '• ' + t)));
  if (ok.length) ui.out.append(h('div', { class: 'tiny muted', style: { marginTop: '4px' } }, `Avg brightness ${Math.round(ok.reduce((a, r) => a + r.centroid, 0) / ok.length)} Hz · avg sustain ${(ok.reduce((a, r) => a + r.decay, 0) / ok.length / 1000).toFixed(1)} s`));
}
function buildCalCard() {
  const p = PANES.tx; if (!p) return; const ui = { noise: h('span', { class: 'chip' }, CFG.gateDb != null ? `Noise floor ${CFG.noiseDb} dB → gate ${CFG.gateDb} dB` : 'not measured'), str: h('div', { class: 'small muted' }, CFG.guitar ? 'Last run ' + new Date(CFG.guitar.t).toLocaleString() : 'Not run yet'), dots: h('div', { class: 'row', style: { gap: '6px' } }, [0, 1, 2, 3, 4, 5].map(() => h('span', { class: 'cdot' }))), out: h('div') };
  p.append(h('div', { class: 'card', style: { padding: '12px', marginTop: '12px' } }, h('h4', { style: { margin: '0 0 4px' } }, 'Calibrate to my guitar'), h('div', { class: 'tiny muted', style: { marginBottom: '8px' } }, 'Measures your room noise and checks each open string. Sets the note gate used by the tuner, chord/key detection and live visuals, and flags tuning, level and clipping problems before you record.'),
    h('div', { class: 'row', style: { gap: '10px', alignItems: 'center', flexWrap: 'wrap' } }, h('button', { class: 'btn sm', onclick: () => { if (!CAL.busy) calNoise(ui); } }, '① Measure noise (3 s)'), ui.noise), h('div', { class: 'row', style: { gap: '10px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' } }, h('button', { class: 'btn sm', onclick: () => { if (!CAL.busy) calStrings(ui); } }, '② Check open strings'), ui.dots), ui.str, ui.out,
    h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn sm', onclick: () => { delete CFG.gateDb; delete CFG.noiseDb; delete CFG.guitar; saveCfg(); ui.noise.textContent = 'not measured'; ui.noise.className = 'chip'; ui.str.textContent = 'Reset'; toast('Calibration cleared'); } }, 'Reset to defaults'))));
}

/* >>> parts/16-stems.js */
/* ============================================================
   Part 16 · STEMS — load a backing track, separate it into drums / bass / vocals / guitar & keys (all offline,
   in a worker), identify which instruments are present and when, find tempo · key · chords · drum groove,
   play it back with per-stem mute / solo (jam along with a stem removed), and export the stems.
   ============================================================ */
const STMS = [['drums', 'Drums', '#e4572e'], ['bass', 'Bass', '#8a5cf5'], ['vox', 'Vocals', '#ff5fa2'], ['other', 'Guitar · keys · other', '#0a9aa6']];
const STM = { name: '', title: '', artist: '', n: 0, sr: 44100, dur: 0, ch: null, feat: null, an: null, env: null, busy: false, prog: 0, mix: STMS.map(() => ({ g: 1, m: false, s: false })), loop: { on: false, a: null, b: null }, beatShift: 0, tempoMul: 1 };
const STP = { bus: null, sg: [], playing: false, segs: [], cur: 0, curT: 0, timer: 0, pos: 0 };
const fmtT = s => { s = Math.max(0, s); return Math.floor(s / 60) + ':' + ('0' + Math.floor(s % 60)).slice(-2); };

/* ---------- separation (worker with main-thread fallback) ---------- */
async function stemSeparate(L, R, sr, onP) {
  const src = `const D=(${stemDSPFactory.toString()})();onmessage=async e=>{const d=e.data;const r=await D.run(d.L,d.R,d.sr,d.opt,p=>postMessage({p}));const tr=Object.values(r.stems).map(a=>a.buffer);tr.push(r.feat.chroma.buffer);for(const k in r.feat)if(r.feat[k] instanceof Float32Array&&k!=='chroma')tr.push(r.feat[k].buffer);postMessage({done:true,stems:r.stems,feat:r.feat},tr)};`;
  try {
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' })), w = new Worker(url);
    return await new Promise((res, rej) => { w.onmessage = e => { if (e.data.p != null) onP(e.data.p); else if (e.data.done) { w.terminate(); URL.revokeObjectURL(url); res({ stems: e.data.stems, feat: e.data.feat }); } }; w.onerror = e => { w.terminate(); rej(new Error(e.message || 'worker failed')); }; w.postMessage({ L, R, sr, opt: {} }, [L.buffer, R.buffer]); });
  } catch (err) { console.warn('[stems] worker unavailable, running on the main thread', err); return stemDSPFactory().run(L, R, sr, {}, onP); }
}

/* ---------- identification + tempo / key / chords / groove ---------- */
function stemAnalyze(feat, sr, dur) {
  const F = feat.F, fps = sr / feat.hop, W = Math.max(1, Math.round(fps * .5)), nW = Math.floor(F / W), db = x => 10 * Math.log10(x + 1e-12), sm = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const E4 = [feat.eD, feat.eB, feat.eV, feat.eO], winE = E4.map(e => { const o = new Float32Array(nW); for (let w = 0; w < nW; w++) { let s = 0; for (let f = w * W; f < (w + 1) * W; f++) s += e[f]; o[w] = s / W; } return o; });
  const winBS = new Float32Array(nW); for (let w = 0; w < nW; w++) { let a = 0; for (let f = w * W; f < (w + 1) * W; f++) a += feat.bS[f]; winBS[w] = a / W; }
  const winSV = new Float32Array(nW), winPK = new Float32Array(nW); for (let w = 0; w < nW; w++) { let a = 0, b = 0; for (let f = w * W; f < (w + 1) * W; f++) { a += feat.sV[f]; b += feat.pk[f]; } winSV[w] = a / W; winPK[w] = b / W; }
  const tot = winE.map(e => e.reduce((a, b) => a + b, 0)), grand = tot.reduce((a, b) => a + b, 1e-12);
  const dbs = winE.map(e => Array.from(e, v => db(v))), gref = Math.max(...dbs.map(d => [...d].sort((a, b) => a - b)[Math.floor(d.length * .95)] || -60));
  const pres = dbs.map((d, i) => Float32Array.from(d, (v, w) => { let p = sm(v - (gref - 21), 0, 10); if (i === 2) p *= sm(winSV[w], .14, .42); if (i === 1) p *= sm(winBS[w], .2, .32); return p; }));
  const info = STMS.map(([id, name], i) => {
    const p = pres[i], cov = p.filter(x => x > .5).length / Math.max(1, nW); let first = -1, run = 0; for (let w = 0; w < nW; w++) { run = p[w] > .5 ? run + 1 : 0; if (run >= 3) { first = (w - 2) * W / fps; break; } }
    const share = tot[i] / grand, mp = p.filter(x => x > .5); const conf = mp.length ? mp.reduce((a, b) => a + b, 0) / mp.length : 0;
    return { id, name, cov, first, share, level: db(tot[i] / Math.max(1, nW)), found: cov > .08 && share > .004, strength: cov > .6 && conf > .75 ? 'strong' : cov > .25 ? 'clear' : cov > .08 ? 'faint' : 'none' };
  });
  info[3].kind = '';
  /* tempo: onset envelope → comb-filter scan with a mild prior around 110 BPM */
  let oe = new Float32Array(F), dr = feat.eD.reduce((a, b) => a + b, 0) / (feat.eA.reduce((a, b) => a + b, 1e-12));
  for (let f = 1; f < F; f++) oe[f] = (dr > .04 ? feat.fk[f] * .8 + feat.fs[f] + feat.fh[f] * .6 : 0) + Math.max(0, Math.sqrt(feat.eA[f]) - Math.sqrt(feat.eA[f - 1])) * (dr > .04 ? .3 : 1);
  { const m = new Float32Array(F), hw = Math.round(fps * .5); let s = 0; for (let f = 0; f < F; f++) { s += oe[f]; if (f >= 2 * hw) s -= oe[f - 2 * hw]; m[f] = s / Math.min(f + 1, 2 * hw); } let mx = 1e-9; for (let f = 0; f < F; f++) { oe[f] = Math.max(0, oe[f] - m[f] * 1.1); mx = Math.max(mx, oe[f]); } for (let f = 0; f < F; f++) oe[f] /= mx; }
  const at = x => { const i = Math.floor(x), fr = x - i; return i < 0 || i + 1 >= F ? 0 : oe[i] * (1 - fr) + oe[i + 1] * fr; };
  let best = { s: -1 }, sum = 0, cnt = 0; const scores = [];
  for (let bpm = 60; bpm <= 190; bpm += .25) { const per = fps * 60 / bpm; let bs = 0, bph = 0; for (let ph = 0; ph < 16; ph++) { const p0 = per * ph / 16; let s = 0, c = 0; for (let x = p0; x < F - 2; x += per) { s += at(x) + .5 * (at(x - 1) + at(x + 1)) * .5; c++; } s /= Math.max(1, c); if (s > bs) { bs = s; bph = p0; } }
    const prior = Math.exp(-Math.pow(Math.log2(bpm / 110), 2) / (2 * .75 * .75)); const sc = bs * (.6 + .4 * prior); scores.push(sc); sum += sc; cnt++; if (sc > best.s) best = { s: sc, bpm, ph: bph }; }
  /* refine phase at best bpm */
  { const per = fps * 60 / best.bpm; let bs = -1; for (let ph = 0; ph < 64; ph++) { const p0 = per * ph / 64; let s = 0, c = 0; for (let x = p0; x < F - 2; x += per) { s += at(x) + .5 * (at(x - 1) + at(x + 1)) * .5; c++; } s /= Math.max(1, c); if (s > bs) { bs = s; best.ph = p0; } } }
  const tempo = { bpm: best.bpm, conf: clamp((best.s / (sum / cnt) - 1) / 2.5, 0, 1), phase: best.ph / fps, oe, fps };
  /* chroma timeline */
  const chroma = feat.chroma, chAt = (f0, f1) => { const o = new Float32Array(12); for (let f = Math.max(0, f0); f < Math.min(F, f1); f++) for (let i = 0; i < 12; i++) o[i] += chroma[f * 12 + i]; return o; };
  const out = { fps, F, W, nW, pres, info, tempo, winSV, dur, chordBars: [], key: null, groove: null, down: 0 };
  stemBeatGrid(out, feat, chAt); return out;
}
/* beat grid → downbeat → per-bar chords → key → drum groove. Re-run when tempo / downbeat is nudged. */
function stemBeatGrid(an, feat, chAt) {
  chAt = chAt || ((f0, f1) => { const o = new Float32Array(12), c = feat.chroma; for (let f = Math.max(0, f0); f < Math.min(an.F, f1); f++) for (let i = 0; i < 12; i++) o[i] += c[f * 12 + i]; return o; });
  const fps = an.fps, bpm = an.tempo.bpm * STM.tempoMul, per = fps * 60 / bpm, beats = []; for (let x = an.tempo.phase * fps; x < an.F - per * .5; x += per) beats.push(x); const nb = beats.length;
  const norm = v => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) + 1e-9; return v.map(x => x / s); };
  const bch = beats.map((x, i) => chAt(Math.round(x + per * .12), Math.round(x + per * .95))), nrm = bch.map(norm);
  const win2 = (i, d) => { const o = new Float32Array(12); for (let j = i; j < i + 2; j++) { const q = bch[j + (d < 0 ? -2 : 0)]; if (q) for (let k = 0; k < 12; k++) o[k] += q[k]; } return norm(o); }, nov = bch.map((_, i) => i < 2 || i + 1 >= bch.length ? 0 : 1 - win2(i, 1).reduce((a, v, k) => a + v * win2(i, -1)[k], 0));
  let bd = 0, bs = -1; const kS = [0, 0, 0, 0], nS = [0, 0, 0, 0]; for (let i = 0; i < nb; i++) { const x = Math.round(beats[i]); kS[i % 4] += (feat.fk[x] || 0) + (feat.fk[x + 1] || 0); nS[i % 4] += nov[i]; } const kT = kS.reduce((a, v) => a + v, 1e-9), nT = nS.reduce((a, v) => a + v, 1e-9);
  for (let d = 0; d < 4; d++) { const s = kS[d] / kT + 1.6 * nS[d] / nT; if (s > bs) { bs = s; bd = d; } }
  bd = (bd + STM.beatShift + 400) % 4; an.down = bd; an.beats = beats; an.per = per; an.bpmEff = bpm;
  const pickTri = (res, prefer) => { if (!res.length) return null; let b = res[0]; for (const r of res) if ((r.q === '' || r.q === 'm') && r.score > b.score - .045) { b = r; break; } return b; };
  const bars = []; for (let i = bd; i + 3 < nb; i += 4) {
    const h1 = bch[i].map((v, k) => v + bch[i + 1][k]), h2 = bch[i + 2].map((v, k) => v + bch[i + 3][k]), all = h1.map((v, k) => v + h2[k]), ca = pickTri(detectChord(all)), c1 = pickTri(detectChord(h1)), c2 = pickTri(detectChord(h2));
    const two = c1 && c2 && c1.sym !== c2.sym && c1.score > .8 && c2.score > .8 && ca && (c1.score + c2.score) / 2 > ca.score + .03;
    bars.push({ i, t: beats[i] / fps, chord: two ? c1.sym + ' ' + c2.sym : (ca ? ca.sym : ''), conf: ca ? ca.score : 0, chroma: all });
  }
  an.chordBars = bars; const kh = new Array(12).fill(0); bars.forEach(b => b.chroma.forEach((v, k) => kh[k] += v)); an.key = bars.length ? detectKey(kh)[0] : null;
  /* drum groove: fold onsets onto a 16-slot bar */
  const rows = [feat.fk, feat.fs, feat.fh], sl = per / 4; let nBars = 0; const hit = rows.map(() => new Float32Array(16)), amp = rows.map(() => new Float32Array(16)), top = rows.map(r => { const a = Array.from(r).sort((x, y) => x - y); return a[Math.floor(a.length * .97)] || 1; });
  bars.forEach(b => { const e0 = b.i * 0 + beats[b.i]; if (an.pres[0][Math.min(an.nW - 1, Math.floor(e0 / an.W))] < .5) return; nBars++; for (let s = 0; s < 16; s++) { const x = e0 + s * sl; rows.forEach((r, ri) => { let m = 0; for (let f = Math.round(x - sl * .4); f <= Math.round(x + sl * .4); f++) m = Math.max(m, r[f] || 0); const v = m / top[ri]; if (v > .22) { hit[ri][s]++; amp[ri][s] += v; } }); } });
  an.groove = nBars >= 2 ? { nBars, rows: rows.map((_, ri) => Array.from(hit[ri], (h, s) => { const p = h / nBars, a = h ? amp[ri][s] / h : 0; return p < .5 ? 0 : a > .85 ? 3 : a > .45 ? 2 : 1; })) } : null;
}

/* ---------- player ---------- */
function spEnsure() { if (STP.bus) return; STP.bus = gn(1); STP.bus.connect(E.mix); STP.sg = STMS.map(() => { const g = gn(1); g.connect(STP.bus); return g; }); spGains(); }
function spGains() { if (!STP.bus) return; const anyS = STM.mix.some(m => m.s); STM.mix.forEach((m, i) => { const aud = anyS ? m.s : !m.m; tc(STP.sg[i].gain, aud ? m.g : 0, .015); }); }
function spData(i) { const c = STM.ch; return i === 0 ? [c.drumsL, c.drumsR] : i === 1 ? [c.bass, c.bass] : i === 2 ? [c.vox, c.vox] : [c.otherL, c.otherR]; }
function spPos() { if (!STP.playing) return STP.pos; const now = E.ctx.currentTime; for (let i = STP.segs.length - 1; i >= 0; i--) { const s = STP.segs[i]; if (now >= s.t) return Math.min(s.from + (now - s.t), s.from + s.dur); } return STP.pos; }
function spStop() { STP.playing = false; clearInterval(STP.timer); STP.segs.forEach(s => s.srcs.forEach(o => { try { o.stop(); } catch (e) { } })); STP.segs = []; }
async function spPlay(when, from) {
  if (!STM.ch) return toast('Load a backing track first', 'warn'); await startAudio(); spEnsure(); if (STP.playing) spStop();
  const L = STM.loop.on && STM.loop.a != null && STM.loop.b != null; STP.cur = from != null ? from : (L && (STP.pos < STM.loop.a || STP.pos >= STM.loop.b) ? STM.loop.a : STP.pos); if (STP.cur >= STM.dur - .05) STP.cur = 0;
  { const now = E.ctx.currentTime; if (when && when < now + .01) { STP.cur += Math.max(0, now + .03 - when); when = now + .03; } STP.curT = when || now + .06; } STP.playing = true; spSched(); STP.timer = setInterval(spSched, 120); syncStemUI();
}
function spPause() { STP.pos = spPos(); spStop(); syncStemUI(); }
function spSeek(t) { t = clamp(t, 0, Math.max(0, STM.dur - .05)); const was = STP.playing; STP.pos = t; if (was) spPlay(null, t); else syncStemUI(); }
function spSched() {
  if (!STP.playing || !STM.ch) return; const c = E.ctx, sr = STM.sr, CH = 2.5; STP.segs = STP.segs.filter(s => s.t + s.dur > c.currentTime - 2);
  while (STP.curT < c.currentTime + 4.5) {
    const L = STM.loop.on && STM.loop.a != null && STM.loop.b != null && STM.loop.b - STM.loop.a > .2; let end = STP.cur + CH; if (L && STP.cur < STM.loop.b) end = Math.min(end, STM.loop.b); end = Math.min(end, STM.dur);
    const i0 = Math.floor(STP.cur * sr), i1 = Math.floor(end * sr), len = i1 - i0; if (len < 64) { if (L) { STP.cur = STM.loop.a; continue; } STP.playing = false; setTimeout(() => { if (!STP.playing) { STP.pos = 0; spStop(); syncStemUI(); } }, Math.max(0, (STP.curT - c.currentTime) * 1000)); return; }
    const seg = { t: STP.curT, from: STP.cur, dur: len / sr, srcs: [] };
    STMS.forEach((_, si) => { const d = spData(si), buf = c.createBuffer(2, len, sr); for (let ch = 0; ch < 2; ch++) { const o = buf.getChannelData(ch), s = d[ch]; for (let k = 0; k < len; k++) o[k] = s[i0 + k] / 32768; } const src = c.createBufferSource(); src.buffer = buf; src.connect(STP.sg[si]); src.start(STP.curT); seg.srcs.push(src); });
    STP.segs.push(seg); STP.curT += len / sr; STP.cur = end; if (L && STP.cur >= STM.loop.b - 1e-6) STP.cur = STM.loop.a; if (!L && STP.cur >= STM.dur - 1e-6) { STP.cur = STM.dur; }
  }
}

/* ---------- loading ---------- */
async function stemLoad(file, opt) {
  opt = opt || {}; if (STM.busy) return; if (!file) return; const tk = STM.ticket = (STM.ticket || 0) + 1; STM.file = file; STM._saved = !!opt.restore; STM.busy = true; if (STP.playing) spPause(); STM.ch = null; STM.an = null; STM.env = null; STM.beatShift = 0; STM.tempoMul = 1; setStemStatus('Decoding ' + file.name + '…', 0);
  try {
    await startAudio(); const ab = await file.arrayBuffer(), buf = await E.ctx.decodeAudioData(ab); if (tk !== STM.ticket) return; let n = buf.length, sr = buf.sampleRate; const cap = Math.floor(sr * 600); if (n > cap) { n = cap; toast('Only the first 10 minutes are analysed', 'warn'); }
    const L = new Float32Array(n), R = new Float32Array(n); L.set(buf.getChannelData(0).subarray(0, n)); R.set((buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)).subarray(0, n));
    STM.name = file.name.replace(/\.[^.]+$/, ''); { const tg = readTags(ab), np = nameParts(file.name); STM.title = cleanTitle(tg.title || '') || np.title || STM.name; STM.artist = tg.artist || np.artist || ''; } STM.sr = sr; STM.n = n; STM.dur = n / sr; const t0 = performance.now();
    const r = await stemSeparate(L, R, sr, p => setStemStatus('Separating stems… ' + Math.round(p * 100) + '%  (' + fmtT(p * STM.dur) + ' of ' + fmtT(STM.dur) + ')', p));
    if (tk !== STM.ticket) return; STM.ch = r.stems; STM.feat = r.feat; setStemStatus('Identifying instruments…', 1); await new Promise(res => setTimeout(res, 20));
    STM.an = stemAnalyze(r.feat, sr, STM.dur); STM.env = stemEnvelopes(); STP.pos = 0; STM.loop = { on: false, a: null, b: null };
    setStemStatus('Done in ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s', 1); toast('Stems ready — ' + STM.an.info.filter(i => i.found).map(i => i.name.split(' ')[0]).join(', ') + ' found', 'ok');
    STM.busy = false; bus.emit('track');
    const fr = opt.restore ? null : stemAutofill(); if (opt.restore) toast('Track restored: “' + (STM.title || STM.name) + '”', 'ok'); if (fr) toast('“' + S.title + '” — ' + S.bpm.toFixed(0) + ' BPM, ' + pcName(S.key) + (S.minor ? ' minor' : ' major') + (fr.doChords ? ', ' + totalBars() + ' bars of chords added to the song' : fr.keepWork ? ' · your chords, tab and lyrics were kept (use Import chords to replace them)' : ''), 'ok');
  } catch (e) { if (tk !== STM.ticket) return; console.error(e); STM.file = null; setStemStatus('Could not read that file: ' + (e.message || e), 0); toast('Could not decode that audio file', 'warn'); }
  if (tk !== STM.ticket) return; STM.busy = false; renderStems(); bus.emit('track');
}
function stemUnload() {
  if (STP.playing) spStop(); STM.ch = null; STM.an = null; STM.env = null; STM.feat = null; STM.name = ''; STM.title = ''; STM.artist = ''; STM.dur = 0; STP.pos = 0; STM.loop = { on: false, a: null, b: null }; STM.file = null; STM._saved = false;
  setStemStatus('Drop an audio file here, or choose one →', 0); renderStems(); bus.emit('track'); TL.dirty = true;
}
function stemEnvelopes() { const Wd = 1600, n = STM.n, step = Math.max(1, Math.floor(n / Wd)), out = []; const get = [[STM.ch.drumsL, STM.ch.drumsR], [STM.ch.bass], [STM.ch.vox], [STM.ch.otherL, STM.ch.otherR]]; const mix = new Float32Array(Wd); for (let i = 0; i < 4; i++) { const e = new Float32Array(Wd); for (let x = 0; x < Wd; x++) { let m = 0; const a = x * step, b = Math.min(n, a + step); for (const ch of get[i]) for (let k = a; k < b; k += 3) { const v = Math.abs(ch[k]); if (v > m) m = v; } e[x] = m / 32768; mix[x] += e[x]; } out.push(e); } out.push(mix); return out; }

/* ---------- actions on the analysis ---------- */
function stemApplyTempo() { const an = STM.an; if (!an) return; vhSnap('before tempo', true); S.bpm = Math.round(an.bpmEff * 100) / 100; if (an.key) { S.key = an.key.root; S.minor = an.key.minor; S.scale = an.key.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)'; } commit(true); toast('Song set to ' + S.bpm.toFixed(1) + ' BPM' + (an.key ? ' · ' + pcName(an.key.root) + (an.key.minor ? ' minor' : ' major') : ''), 'ok'); }
function stemImportChords() {
  const an = STM.an; if (!an || !an.chordBars.length) return toast('No chords found yet', 'warn'); vhSnap('before import', true); S.bpm = Math.round(an.bpmEff * 100) / 100; S.ts = [4, 4]; if (an.key) { S.key = an.key.root; S.minor = an.key.minor; S.scale = an.key.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)'; }
  stemWriteChords(); S.title = STM.title || S.title; if (STM.artist && !S.artist) S.artist = STM.artist; S.track = { name: STM.title || STM.name, dur: +STM.dur.toFixed(1), bpm: S.bpm, chords: true }; T.cursor = 0; commit(true); toast('Imported ' + totalBars() + ' bars of chords into the song', 'ok');
}
function stemImportGroove() { const g = STM.an && STM.an.groove; if (!g) return toast('No steady drum pattern found', 'warn'); vhSnap('before groove', true); const pat = [g.rows[0], g.rows[1], g.rows[2], new Array(16).fill(0), new Array(16).fill(0), new Array(16).fill(0)]; S.band.pat = pat; S.band.patName = 'From “' + (STM.name || 'track').slice(0, 18) + '”'; S.band.drumsOn = true; commit(true); toast('Drum groove copied to the band (' + g.nBars + ' bars averaged)', 'ok'); }
async function stemTogether() { const an = STM.an; if (!an) return; stemApplyTempo(); const t0 = an.beats[an.down] / an.fps; if (T.playing) stopPlay(true); if (STP.playing) spPause(); T.cursor = 0; await startAudio(); await play(); const st = T.q.length ? T.q[0].time : E.ctx.currentTime + .1; STP.pos = t0; await spPlay(st, t0); toast('Track and band started together', 'ok'); }
function wavBlob(chs, sr) { const n = chs[0].length, b = new ArrayBuffer(44 + n * 4), v = new DataView(b), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0))); w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true); for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, chs[0][i], true); v.setInt16(46 + i * 4, chs[1][i], true); } return new Blob([b], { type: 'audio/wav' }); }
function stemExport(i) { const d = spData(i), a = h('a', { href: URL.createObjectURL(wavBlob(d, STM.sr)), download: (STM.name || 'track') + ' - ' + STMS[i][1].split(' ')[0].toLowerCase() + '.wav' }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }

/* ---------- pane ---------- */
const SU = {};
function setStemStatus(t, p) { if (SU.status) SU.status.textContent = t; if (SU.bar) { SU.bar.style.width = Math.round((p || 0) * 100) + '%'; SU.barw.style.display = STM.busy && p < 1 ? '' : 'none'; } }
function syncStemUI() { if (SU.play) SU.play.textContent = STP.playing ? '⏸' : '▶'; }
function buildStemsPane() {
  const p = PANES.stems; if (!p) return; p.classList.add('flex');
  const file = h('input', { type: 'file', accept: 'audio/*,.mp3,.wav,.flac,.m4a,.ogg', style: { display: 'none' }, onchange: e => { stemLoad(e.target.files[0]); e.target.value = ''; } });
  SU.status = h('span', { class: 'small muted' }, 'Drop an audio file here, or choose one →'); SU.bar = h('i', { style: { display: 'block', height: '100%', width: '0%', background: 'var(--accent)', transition: 'width .2s' } }); SU.barw = h('div', { style: { height: '4px', background: 'var(--panel2)', borderRadius: '4px', overflow: 'hidden', flex: '1 1 160px', maxWidth: '260px', display: 'none' } }, SU.bar);
  SU.play = h('button', { class: 'btn primary', style: { width: '44px' }, onclick: () => STP.playing ? spPause() : spPlay() }, '▶');
  SU.time = h('span', { class: 'mono small', style: { minWidth: '92px' } }, '0:00 / 0:00');
  const preset = (mutes) => { STM.mix.forEach((m, i) => { m.m = mutes.includes(i); m.s = false; }); spGains(); renderStemStrips(); };
  SU.file = file; SU.top = h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', alignItems: 'center', margin: '0 0 8px' } }, h('button', { class: 'btn primary', onclick: () => file.click() }, '📂 Load backing track'), file, SU.barw, SU.status);
  SU.tr = h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'center', margin: '8px 0' } }, h('button', { class: 'btn', title: 'Back to start', onclick: () => spSeek(0) }, '⏮'), SU.play, SU.time,
    h('span', { class: 'tiny muted', style: { marginLeft: '6px', fontWeight: 800, letterSpacing: '.08em' } }, 'JAM'), h('button', { class: 'btn sm', title: 'Hear everything', onclick: () => preset([]) }, 'All'), h('button', { class: 'btn sm', title: 'Mute the guitar / keys stem so you can play that part', onclick: () => preset([3]) }, 'Play the guitar'), h('button', { class: 'btn sm', title: 'Mute the bass', onclick: () => preset([1]) }, 'Play the bass'), h('button', { class: 'btn sm', title: 'Mute the vocal (karaoke)', onclick: () => preset([2]) }, 'Karaoke'), h('button', { class: 'btn sm', title: 'Mute the drums', onclick: () => preset([0]) }, 'Drummer’s out'),
    h('span', { style: { flex: 1 } }), h('label', { class: 'chk small', style: { display: 'flex', gap: '4px', alignItems: 'center', fontWeight: 700 } }, h('input', { type: 'checkbox', onchange: e => { STM.loop.on = e.target.checked; if (STP.playing) spPlay(null, spPos()); } }), 'Loop'), h('button', { class: 'btn sm', title: 'Click lane to seek · Shift-click sets loop start · Alt-click sets loop end', onclick: () => { STM.loop = { on: STM.loop.on, a: null, b: null }; } }, 'Clear loop'));
  SU.cv = h('canvas', { style: { width: '100%', height: '100%', display: 'block', cursor: 'pointer' } }); SU.cvw = h('div', { style: { position: 'relative', height: 'clamp(150px,27vh,300px)', flex: 'none', background: '#050b0c', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--line)' } }, SU.cv);
  SU.strips = h('div', { style: { display: 'grid', gap: '6px', margin: '10px 0' } }); SU.info = h('div', { class: 'card', style: { padding: '12px', margin: '0 0 10px' } }); SU.music = h('div', { class: 'card', style: { padding: '12px' } });
  SU.empty = h('div', { class: 'card', style: { padding: '22px', textAlign: 'center', color: 'var(--muted)' } }, h('div', { style: { fontSize: '30px' } }, '🎚'), h('div', { style: { fontWeight: 800, margin: '4px 0' } }, 'Bring a song in'), h('div', { class: 'small' }, 'Load any audio file. It is split into drums, bass, vocals and guitar/keys on your machine — nothing is uploaded. You get which instruments are in it and when, the tempo, key and chords, the drum groove, and a player where you can mute a part and play it yourself.'));
  SU.samples = samplesShelf(f => stemLoad(f));
  p.append(h('div', { class: 'stm-wrap' }, SU.top, SU.samples, SU.empty, SU.tr, h('div', { class: 'stm-cols' }, h('div', { class: 'stm-l' }, SU.cvw, SU.strips), h('div', { class: 'stm-r' }, SU.info, SU.music)))); ['dragover', 'dragenter'].forEach(ev => p.addEventListener(ev, e => { e.preventDefault(); p.classList.add('dropt'); })); p.addEventListener('dragleave', () => p.classList.remove('dropt')); p.addEventListener('drop', e => { e.preventDefault(); p.classList.remove('dropt'); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) stemLoad(f); });
  new ResizeObserver(() => { const d = window.devicePixelRatio || 1, w = SU.cv.clientWidth, hh = SU.cv.clientHeight; if (w && (SU.cv.width !== Math.floor(w * d) || SU.cv.height !== Math.floor(hh * d))) { SU.cv.width = Math.floor(w * d); SU.cv.height = Math.floor(hh * d); } }).observe(SU.cv);
  SU.cv.addEventListener('pointerdown', e => { if (!STM.ch) return; const r = SU.cv.getBoundingClientRect(), t = clamp((e.clientX - r.left) / r.width, 0, 1) * STM.dur; if (e.shiftKey) { STM.loop.a = t; if (STM.loop.b == null || STM.loop.b <= t) STM.loop.b = Math.min(STM.dur, t + 8); STM.loop.on = true; } else if (e.altKey) { STM.loop.b = t; if (STM.loop.a == null || STM.loop.a >= t) STM.loop.a = Math.max(0, t - 8); STM.loop.on = true; } else spSeek(t); });
  renderStems();
}
function renderStems() {
  if (!SU.strips) return; const has = !!STM.ch; [SU.tr, SU.cvw, SU.strips, SU.info, SU.music].forEach(e => e.style.display = has ? '' : 'none'); SU.empty.style.display = has ? 'none' : ''; if (!has) return;
  SU.status.textContent = STM.name + '  ·  ' + fmtT(STM.dur) + '  ·  ' + (STM.sr / 1000).toFixed(1) + ' kHz'; renderStemStrips(); renderStemInfo();
}
function renderStemStrips() {
  const s = SU.strips; s.innerHTML = ''; const an = STM.an;
  STMS.forEach(([id, name, col], i) => {
    const m = STM.mix[i], inf = an && an.info[i], mb = (l, k, t) => h('button', { class: 'btn sm' + (m[k] ? ' on' : ''), style: { width: '30px', padding: '0' }, title: t, onclick: () => { m[k] = !m[k]; spGains(); renderStemStrips(); } }, l);
    s.append(h('div', { class: 'row', style: { gap: '10px', alignItems: 'center', padding: '6px 10px', background: 'var(--panel2)', borderRadius: '10px', opacity: (m.m && !STM.mix.some(x => x.s)) || (STM.mix.some(x => x.s) && !m.s) ? .5 : 1 } },
      h('i', { style: { width: '10px', height: '10px', borderRadius: '50%', background: col, flex: 'none' } }), h('b', { style: { width: '150px', fontSize: '13px' } }, name),
      h('span', { class: 'tiny', style: { width: '170px', color: inf && inf.found ? 'var(--text)' : 'var(--muted)' } }, inf ? (inf.found ? inf.strength + ' · ' + Math.round(inf.cov * 100) + '% of track' + (inf.first > 1 ? ' · enters ' + fmtT(inf.first) : '') : 'not detected') : ''),
      mb('M', 'm', 'Mute'), mb('S', 's', 'Solo'), h('input', { type: 'range', min: 0, max: 1.5, step: .01, value: m.g, style: { flex: 1, maxWidth: '260px' }, oninput: e => { m.g = +e.target.value; spGains(); } }), h('button', { class: 'btn sm', title: 'Download this stem as a WAV', onclick: () => stemExport(i) }, '⤓ WAV')));
  });
}
function renderStemInfo() {
  const an = STM.an; if (!an) return; const f = an.info, lines = f.filter(x => x.found).map(x => `<b style="color:${STMS.find(s => s[0] === x.id)[2]}">${x.name}</b> <span class="muted">${x.strength}${x.first > 1 ? ' · enters ' + fmtT(x.first) : ' · from the start'}${x.kind ? ' · ' + x.kind : ''}</span>`), miss = f.filter(x => !x.found).map(x => x.name);
  SU.info.innerHTML = '<h4 style="margin:0 0 6px">What’s in this track</h4>' + (lines.length ? lines.map(l => '<div class="small" style="padding:2px 0">' + l + '</div>').join('') : '<div class="small muted">Nothing clearly pitched or percussive was found.</div>') + (miss.length ? '<div class="tiny muted" style="margin-top:4px">Not detected: ' + miss.join(', ') + '</div>' : '') + '<div class="tiny muted" style="margin-top:6px">Separation is signal-processing based (percussive/harmonic split, bass harmonic comb, centred-voice mask). It’s good for finding and muting parts to play along; it is not studio-clean, and the vocal stem is a centre-channel voice estimate.</div>';
  const k = an.key, g = an.groove; SU.music.innerHTML = '';
  const kv = (a, b) => h('div', { class: 'kv', style: { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '3px 0', borderBottom: '1px solid var(--line)' } }, h('span', { class: 'muted' }, a), h('b', { class: 'mono' }, b));
  const cbar = h('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap', maxHeight: '140px', overflow: 'auto', margin: '8px 0' } }, an.chordBars.map((b, i) => h('button', { class: 'btn sm', style: { fontFamily: 'var(--mono)', minWidth: '52px' }, title: 'Bar ' + (i + 1) + ' · ' + fmtT(b.t), onclick: () => spSeek(b.t) }, b.chord || '—')));
  const nudge = (l, t, fn) => h('button', { class: 'btn sm', title: t, onclick: () => { fn(); stemBeatGrid(an, STM.feat); renderStemInfo(); } }, l);
  SU.music.append(h('h4', { style: { margin: '0 0 6px' } }, 'Tempo · key · chords · groove'),
    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '0 24px' } }, kv('Tempo', an.bpmEff.toFixed(1) + ' BPM  (' + Math.round(an.tempo.conf * 100) + '% sure)'), kv('Key', k ? pcName(k.root) + (k.minor ? ' minor' : ' major') + '  (r=' + k.r.toFixed(2) + ')' : '—'), kv('Bars found', an.chordBars.length + '  (assuming 4/4)'), kv('Drum groove', g ? g.nBars + ' bars averaged' : 'no steady pattern')),
    h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap', margin: '8px 0 0' } }, nudge('½ tempo', 'If it found double-time', () => { STM.tempoMul = clamp(STM.tempoMul / 2, .25, 4); }), nudge('2× tempo', 'If it found half-time', () => { STM.tempoMul = clamp(STM.tempoMul * 2, .25, 4); }), nudge('‹ downbeat', 'Move bar line one beat earlier', () => { STM.beatShift--; }), nudge('downbeat ›', 'Move bar line one beat later', () => { STM.beatShift++; }), nudge('reset', 'Back to the automatic result', () => { STM.beatShift = 0; STM.tempoMul = 1; })),
    cbar,
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, h('button', { class: 'btn sm primary', onclick: stemImportChords, title: 'Replace the song with this chord chart (a snapshot is saved first)' }, '⤵ Import chords as the song'), h('button', { class: 'btn sm', onclick: stemApplyTempo }, 'Use tempo + key only'), h('button', { class: 'btn sm', disabled: !g, onclick: stemImportGroove }, '🥁 Copy drum groove to the band'), h('button', { class: 'btn sm', onclick: stemTogether, title: 'Imports tempo, starts the track from bar 1 and the band together' }, '▶ Track + band together')));
}
function drawStemLanes() {
  if (!SU.cv || !STM.ch || !paneVisible('stems')) return; const cv = SU.cv, g = cv.getContext('2d'), W = cv.width, H = cv.height, an = STM.an, dpr = W / cv.clientWidth || 1; g.fillStyle = '#050b0c'; g.fillRect(0, 0, W, H);
  const lanes = [['Mix', '#9bb', STM.env[4], null], ...STMS.map(([id, nm, col], i) => [nm, col, STM.env[i], an && an.pres[i]])], top = 22 * dpr, lh = (H - top) / lanes.length, N = STM.env[0].length;
  g.font = `700 ${Math.round(10 * dpr)}px ui-monospace,monospace`; g.textBaseline = 'top';
  if (an) { g.fillStyle = 'rgba(255,255,255,.4)'; an.chordBars.forEach((b, i) => { const x = b.t / STM.dur * W; g.fillStyle = i % 4 === 0 ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.06)'; g.fillRect(x, top, 1, H - top); if (W / an.chordBars.length > 36 * dpr || i % 4 === 0) { g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText(b.chord.split(' ')[0], x + 3, 4); } }); }
  lanes.forEach(([nm, col, env, pr], li) => {
    const y0 = top + li * lh, mid = y0 + lh / 2, mx = Math.max(.02, ...env); if (pr) { const nw = pr.length; for (let w = 0; w < nw; w++) { const a = pr[w]; if (a < .05) continue; g.fillStyle = col; g.globalAlpha = .12 * a; g.fillRect(w * an.W / an.fps / STM.dur * W, y0 + 2, Math.ceil(an.W / an.fps / STM.dur * W) + 1, lh - 4); } g.globalAlpha = 1; }
    g.fillStyle = col; g.globalAlpha = .9; for (let x = 0; x < W; x++) { const v = env[Math.min(N - 1, Math.floor(x / W * N))] / mx * (lh * .46); g.fillRect(x, mid - v, 1, Math.max(1, v * 2)); } g.globalAlpha = 1; g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText(nm, 6, y0 + 4); g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, y0 + lh - 1, W, 1);
  });
  const L = STM.loop; if (L.a != null && L.b != null) { g.fillStyle = L.on ? 'rgba(53,211,194,.16)' : 'rgba(255,255,255,.06)'; g.fillRect(L.a / STM.dur * W, top, (L.b - L.a) / STM.dur * W, H - top); }
  const x = spPos() / STM.dur * W; g.fillStyle = '#fff'; g.fillRect(x - 1, 0, 2 * dpr / 1.5, H); if (SU.time) SU.time.textContent = fmtT(spPos()) + ' / ' + fmtT(STM.dur);
}
function stemFrame() { if (STM.ch && STM.env && !STM.busy) drawStemLanes(); }

/* >>> parts/16a-stem-dsp.js */
/* ============================================================
   Part 16a · stem separation DSP (pure — runs in a Web Worker, or on the main thread as a fallback)
   Harmonic/percussive median-filter separation + bass crossover + centre/pitched-voice mask.
   stems sum back to the original: drums + bass + vocals + other == input.
   ============================================================ */
function stemDSPFactory() {
  const N = 2048, HOP = 1024, NB = N / 2 + 1, TWO_PI = Math.PI * 2;
  const rev = new Uint16Array(N); { const l = Math.log2(N); for (let i = 0; i < N; i++) { let r = 0; for (let b = 0; b < l; b++) if (i & (1 << b)) r |= 1 << (l - 1 - b); rev[i] = r; } }
  const cs = new Float32Array(N / 2), sn = new Float32Array(N / 2); for (let i = 0; i < N / 2; i++) { cs[i] = Math.cos(TWO_PI * i / N); sn[i] = Math.sin(TWO_PI * i / N); }
  const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = Math.sqrt(.5 * (1 - Math.cos(TWO_PI * i / N)));
  function fft(re, im, inv) {
    for (let i = 0; i < N; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1, step = N / size;
      for (let i = 0; i < N; i += size) for (let j = 0, k = 0; j < half; j++, k += step) {
        const wr = cs[k], wi = inv ? sn[k] : -sn[k], a = i + j, b = a + half, tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
    if (inv) for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; }
  }
  /* 1-D sliding median (window 2h+1, clamped edges) over a strided float array */
  function slideMedian(src, off, stride, n, out, ooff, ostride, h) {
    const W = 2 * h + 1, w = new Float32Array(W); const at = i => src[off + (i < 0 ? 0 : i >= n ? n - 1 : i) * stride];
    for (let j = 0; j < W; j++) w[j] = at(j - h); w.sort();
    for (let i = 0; i < n; i++) {
      out[ooff + i * ostride] = w[h]; if (i === n - 1) break;
      const rem = at(i - h), add = at(i + h + 1); if (rem === add) continue;
      let p = 0; while (w[p] !== rem) p++; // remove
      if (add > rem) { while (p < W - 1 && w[p + 1] < add) { w[p] = w[p + 1]; p++; } } else { while (p > 0 && w[p - 1] > add) { w[p] = w[p - 1]; p--; } }
      w[p] = add;
    }
  }
  const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  async function run(L, R, sr, opt, progress) {
    opt = Object.assign({ bassHz: 170, bassMin: 0, combH: 6, combW: 1.1, B: 128, C: 8, vox: 1, beta: 2 }, opt || {});
    const n = L.length, F = Math.ceil(n / HOP) + 1, B = opt.B, C = opt.C, fb = f => f * N / sr;
    const out = { drumsL: new Int16Array(n), drumsR: new Int16Array(n), bass: new Int16Array(n), vox: new Int16Array(n) };
    const feat = { F, hop: HOP, sr, eD: new Float32Array(F), eB: new Float32Array(F), eV: new Float32Array(F), eO: new Float32Array(F), eA: new Float32Array(F), fk: new Float32Array(F), fs: new Float32Array(F), fh: new Float32Array(F), sV: new Float32Array(F), tO: new Float32Array(F), bS: new Float32Array(F), pk: new Float32Array(F), chroma: new Float32Array(F * 12) };
    const bk = (a, b) => [Math.max(1, Math.round(fb(a))), Math.min(NB - 1, Math.round(fb(b)))];
    const KO = bk(100, 2000), KK = bk(35, 130), KS = bk(170, 3500), KH = bk(6500, 14000), KV = bk(80, 3000), KCH = bk(60, 4000);
    const lpB = new Float32Array(NB), bw = new Float32Array(NB), chPc = new Int8Array(NB), chW = new Float32Array(NB);
    for (let k = 0; k < NB; k++) { const f = k * sr / N; lpB[k] = 1 / (1 + Math.pow(f / opt.bassHz, 8)); bw[k] = smooth(f, 140, 320) * (1 - smooth(f, 6500, 11000)); chPc[k] = f > 0 ? (((Math.round(12 * Math.log2(f / 440) + 69) % 12) + 12) % 12) : 0; chW[k] = (1 / (1 + f / 900)); }
    const kLow = Math.round(fb(210)); const f0s = [], bf0 = []; for (let f = 38; f <= 150; f *= 1.025) bf0.push(f); for (let f = 80; f <= 800; f *= 1.03) f0s.push(f);
    let prevD = [0, 0, 0], acc = [0, 1, 2, 3].map(() => new Float32Array((B + 1) * HOP));
    const re = new Float32Array(N), im = new Float32Array(N);
    const T0 = B + 2 * C;
    for (let b0 = 0; b0 < F; b0 += B) {
      const b1 = Math.min(F, b0 + B), f0 = Math.max(0, b0 - C), f1 = Math.min(F, b1 + C), T = f1 - f0;
      const Lr = new Float32Array(T * NB), Li = new Float32Array(T * NB), Rr = new Float32Array(T * NB), Ri = new Float32Array(T * NB), Mg = new Float32Array(T * NB);
      for (let t = 0; t < T; t++) {
        const s0 = (f0 + t - 1) * HOP; for (let i = 0; i < N; i++) { const s = s0 + i; re[i] = s >= 0 && s < n ? L[s] * win[i] : 0; im[i] = s >= 0 && s < n ? R[s] * win[i] : 0; }
        fft(re, im, false);
        for (let k = 0; k < NB; k++) {
          const k2 = (N - k) & (N - 1), ar = re[k], ai = im[k], br = re[k2], bi = im[k2], o = t * NB + k;
          Lr[o] = (ar + br) / 2; Li[o] = (ai - bi) / 2; Rr[o] = (ai + bi) / 2; Ri[o] = (br - ar) / 2;
          const mr = (Lr[o] + Rr[o]) / 2, mi = (Li[o] + Ri[o]) / 2; Mg[o] = Math.hypot(mr, mi);
        }
      }
      const Hh = new Float32Array(T * NB), Pp = new Float32Array(T * NB);
      for (let k = 0; k < NB; k++) slideMedian(Mg, k, NB, T, Hh, k, NB, 8);
      for (let t = 0; t < T; t++) slideMedian(Mg, t * NB, 1, NB, Pp, t * NB, 1, 8);
      for (let f = b0; f < b1; f++) {
        const t = f - f0, o0 = t * NB, aA = new Float32Array(NB * 2), aB = new Float32Array(NB * 2);
        // pass 1: masks & spectra
        const Dlr = new Float32Array(NB), Dli = new Float32Array(NB), Drr = new Float32Array(NB), Dri = new Float32Array(NB), Br = new Float32Array(NB), Bi = new Float32Array(NB), Vr = new Float32Array(NB), Vi = new Float32Array(NB);
        // vocal-likeness: harmonic-series salience of the centre mid-band spectrum
        const cen = new Float32Array(NB); let cTot = 0;
        for (let k = 0; k < NB; k++) { const o = o0 + k, l = Math.hypot(Lr[o], Li[o]), r = Math.hypot(Rr[o], Ri[o]), c = (Math.min(l, r) + 1e-9) / (Math.max(l, r) + 1e-9), h2 = Hh[o] * Hh[o], p2 = Pp[o] * Pp[o]; let mp = p2 / (h2 + p2 + 1e-12); if (k < kLow) { const tr = smooth(Mg[o] / (Hh[o] + 1e-9), 2.0, 4.5) * .92; if (tr > mp) mp = tr; } mp = Math.pow(mp, opt.beta) / (Math.pow(mp, opt.beta) + Math.pow(1 - mp, opt.beta)); Pp[o] = mp; Hh[o] = c; }
        // bass: harmonic comb of the strongest low fundamental (keeps bass harmonics up to 2 kHz, away from vocals)
        const wbF = new Float32Array(NB); for (let k = 0; k < NB; k++) wbF[k] = lpB[k];
        { let best = 0, bq = -1, lowE = 1e-9; const kb = Math.round(fb(1800)); for (let k = 1; k < kb; k++) { const v = Mg[o0 + k] * (1 - Pp[o0 + k]); lowE += v; }
          for (let q = 0; q < bf0.length; q++) { let sc = 0, m1 = 0, mm = 0; for (let hh = 1; hh <= 6; hh++) { const kk = Math.round(fb(bf0[q] * hh)); if (kk >= NB - 1) break; const v = Math.max(Mg[o0 + kk - 1] * (1 - Pp[o0 + kk - 1]), Mg[o0 + kk] * (1 - Pp[o0 + kk]), Mg[o0 + kk + 1] * (1 - Pp[o0 + kk + 1])); if (hh === 1) m1 = v; if (v > mm) mm = v; sc += v / Math.sqrt(hh); } if (m1 < .45 * mm) continue; if (sc > best) { best = sc; bq = q; } }
          feat.bS[f] = bq >= 0 ? best / lowE : 0; if (bq >= 0 && best / lowE > .22 + opt.bassMin) { const f0 = bf0[bq]; for (let hh = 1; hh <= opt.combH; hh++) { const kc = fb(f0 * hh); if (kc >= NB - 2 || f0 * hh > 2200) break; const wd = opt.combW + hh * .05; for (let k = Math.floor(kc - wd - 1); k <= Math.ceil(kc + wd + 1); k++) { if (k < 1 || k >= NB) continue; const d = Math.abs(k - kc) / wd; if (d < 1) { const w = (1 - d * d) * Math.max(.35, 1 - hh * .08); if (w > wbF[k]) wbF[k] = w; } } } } }
        for (let k = 0; k < NB; k++) { const o = o0 + k, l = Math.hypot(Lr[o], Li[o]), r = Math.hypot(Rr[o], Ri[o]), c = (Math.min(l, r) + 1e-9) / (Math.max(l, r) + 1e-9); cen[k] = Mg[o] * (1 - Pp[o]) * (1 - wbF[k]) * (1 - lpB[k]) * c * c; if (k >= KV[0] && k <= KV[1]) cTot += cen[k]; }
        let sal = 0; if (cTot > 1e-6) for (let q = 0; q < f0s.length; q++) { let s = 0; for (let hh = 1; hh <= 6; hh++) { const kk = Math.round(fb(f0s[q] * hh)); if (kk >= NB - 1) break; s += Math.max(cen[kk - 1], cen[kk], cen[kk + 1]); } if (s > sal) sal = s; }
        const sV = Math.min(1, sal / (cTot + 1e-9) * 1.6), vg = smooth(sV, .18, .5), vMix = opt.vox * (.04 + .96 * vg * vg);
        let eD = 0, eB = 0, eV = 0, eA = 0, dK = 0, dS = 0, dH = 0; const chr = feat.chroma, fo = f * 12, hm = new Float32Array(NB); let oSum = 0, oMax = 0;
        for (let k = 0; k < NB; k++) {
          const o = o0 + k, mp = Pp[o], c = Hh[o], mh = 1 - mp, mr = (Lr[o] + Rr[o]) / 2, mi = (Li[o] + Ri[o]) / 2, wb = wbF[k], wv = c * c * bw[k] * vMix;
          Dlr[k] = mp * Lr[o]; Dli[k] = mp * Li[o]; Drr[k] = mp * Rr[o]; Dri[k] = mp * Ri[o];
          Br[k] = mh * wb * mr; Bi[k] = mh * wb * mi; const mv = mh * (1 - wb) * wv; Vr[k] = mv * mr; Vi[k] = mv * mi;
          const mg2 = Mg[o] * Mg[o], lr2 = (Lr[o] * Lr[o] + Li[o] * Li[o] + Rr[o] * Rr[o] + Ri[o] * Ri[o]) / 2; eA += lr2; eD += mp * mp * lr2; eB += (mh * wb) * (mh * wb) * mg2; eV += mv * mv * mg2;
          const dm = mp * Mg[o]; if (k >= KK[0] && k <= KK[1]) dK += dm; if (k >= KS[0] && k <= KS[1]) dS += dm; if (k >= KH[0] && k <= KH[1]) dH += dm;
          hm[k] = mh * Mg[o] * (1 - (1 - wb) * Math.min(1, wv * 1.25));
          if (k >= KO[0] && k <= KO[1]) { const ho = mh * (1 - wb) * (1 - Math.min(1, wv * 1.25)) * Mg[o]; oSum += ho; if (ho > oMax) oMax = ho; }
        }
        { let hmx = 1e-9; for (let k = KCH[0]; k <= KCH[1]; k++) if (hm[k] > hmx) hmx = hm[k]; for (let k = KCH[0] + 1; k < KCH[1]; k++) { const b = hm[k]; if (b < .04 * hmx || b < hm[k - 1] || b <= hm[k + 1]) continue; const la = Math.log(hm[k - 1] + 1e-9), lb = Math.log(b + 1e-9), lc = Math.log(hm[k + 1] + 1e-9), d = .5 * (la - lc) / (la - 2 * lb + lc || -1), fr = (k + Math.max(-.5, Math.min(.5, d))) * sr / N, pcf = 12 * Math.log2(fr / 440) + 69, pc = ((Math.round(pcf) % 12) + 12) % 12, dev = Math.abs(pcf - Math.round(pcf)); chr[fo + pc] += Math.sqrt(b) * chW[k] * (1 - dev * .8); } }
        feat.tO[f] = oSum > 1e-6 ? oMax / (oSum / (KO[1] - KO[0] + 1)) : 0; feat.eA[f] = eA; feat.eD[f] = eD; feat.eB[f] = eB; feat.eV[f] = eV; feat.eO[f] = Math.max(0, eA - eD - eB - eV); feat.sV[f] = sV;
        feat.fk[f] = Math.max(0, dK - prevD[0]); feat.fs[f] = Math.max(0, dS - prevD[1]); feat.fh[f] = Math.max(0, dH - prevD[2]); prevD = [dK, dS, dH];
        // peak count in harmonic spectrum 100–2000 Hz (polyphony proxy)
        { let mx = 0; const lo = Math.round(fb(100)), hi = Math.round(fb(2000)); for (let k = lo; k <= hi; k++) mx = Math.max(mx, Hh[o0 + k] === undefined ? 0 : Mg[o0 + k] * (1 - Pp[o0 + k])); let c = 0; for (let k = lo + 1; k < hi; k++) { const v = Mg[o0 + k] * (1 - Pp[o0 + k]); if (v > .2 * mx && v > Mg[o0 + k - 1] * (1 - Pp[o0 + k - 1]) && v >= Mg[o0 + k + 1] * (1 - Pp[o0 + k + 1])) c++; } feat.pk[f] = c; }
        // pass 2: inverse (two packed IFFTs)
        const pack = (Ar, Ai, Brr, Bii, w) => { for (let k = 0; k < NB; k++) { const k2 = (N - k) & (N - 1); re[k] = Ar[k] - Bii[k]; im[k] = Ai[k] + Brr[k]; if (k > 0 && k < N / 2) { re[k2] = Ar[k] + Bii[k]; im[k2] = -Ai[k] + Brr[k]; } } fft(re, im, true); };
        const loc = (f - b0) * HOP;
        pack(Dlr, Dli, Drr, Dri); for (let i = 0; i < N; i++) { const p = loc + i; if (p < acc[0].length) { acc[0][p] += re[i] * win[i]; acc[1][p] += im[i] * win[i]; } }
        pack(Br, Bi, Vr, Vi); for (let i = 0; i < N; i++) { const p = loc + i; if (p < acc[2].length) { acc[2][p] += re[i] * win[i]; acc[3][p] += im[i] * win[i]; } }
      }
      // flush finalised region [ (b0-1)*HOP , +B*HOP )
      const base = (b0 - 1) * HOP, names = ['drumsL', 'drumsR', 'bass', 'vox'];
      for (let a = 0; a < 4; a++) { const dst = out[names[a]], src = acc[a]; for (let i = 0; i < B * HOP; i++) { const s = base + i; if (s < 0 || s >= n) continue; const v = src[i] * 32767; dst[s] = v > 32767 ? 32767 : v < -32768 ? -32768 : v; } src.copyWithin(0, B * HOP, (B + 1) * HOP); src.fill(0, HOP); }
      if (progress) progress(Math.min(1, b1 / F)); await new Promise(r => setTimeout(r, 0));
    }
    out.otherL = new Int16Array(n); out.otherR = new Int16Array(n);
    for (let i = 0; i < n; i++) { const a = Math.round(L[i] * 32767) - out.drumsL[i] - out.bass[i] - out.vox[i], b = Math.round(R[i] * 32767) - out.drumsR[i] - out.bass[i] - out.vox[i]; out.otherL[i] = a > 32767 ? 32767 : a < -32768 ? -32768 : a; out.otherR[i] = b > 32767 ? 32767 : b < -32768 ? -32768 : b; }
    return { stems: out, feat };
  }
  return { run, N, HOP };
}

/* >>> parts/17-tour.js */
/* =====================================================================
   Part 17 · guided tour: a spotlight walkthrough of the key areas.
   Opens from Help (?), offers itself once on first run, keyboard driven,
   and never touches your song or settings.
   ===================================================================== */
const TOUR = { on: false, i: 0, el: null, spot: null, card: null, steps: [], raf: 0, token: 0 };
const tq = sel => () => { const e = $(sel); return e && e.getClientRects().length ? e : null; };
const tqf = (root, re) => () => { const e = $$(root).find(x => re.test(x.textContent)); return e && e.getClientRects().length ? e : null; };
const tourSide = id => () => { const t = $('#left .side-tabs .tab[data-id="' + id + '"]'); if (t) t.click(); };
function tourSteps() { return document.body.dataset.form === 'phone' ? tourStepsPhone() : tourStepsDesk(); }
function tourStepsDesk() {
  const tab = document.body.dataset.form === 'tablet';
  return [
    { t: null, title: 'Welcome to the-daily.studio', b: 'A guitar workstation that runs entirely in this browser tab: a pedal rig, a backing band, a tab and chord composer, live analysis, a transcriber, stem separation and live visuals.<br><br>This tour takes about two minutes. Use <kbd>→</kbd> <kbd>←</kbd> to move and <kbd>Esc</kbd> to leave. It never changes your song. Reopen it any time from <b>?</b> in the top bar.' },
    { t: tq('#left'), pre: tourSide('io'), drawer: 'left', side: 'right', title: '1 · Connect your guitar', b: 'Open <b>I/O</b> and choose your audio interface (a Focusrite, say) or microphone. If the list is blank, allow microphone access in the browser and press the refresh button (⟳). The <b>Loopback test</b> measures your real round-trip latency.<br><br>Use headphones, or your interface\'s hardware Direct Monitor, to avoid feedback.', tip: 'Wired headphones give the lowest delay. Bluetooth adds a lot.' },
    { t: tq('#transport'), side: 'bottom', title: '2 · Transport', b: 'Play, stop, loop, click, <b>record</b> (with a count-in and dry plus wet takes), position, tempo, time signature and key. <kbd>Space</kbd> plays and stops. The latency chip at the top right shows the current round-trip estimate.' },
    { t: tq('#dock > .dockbar, #dock .tabs'), side: 'bottom', title: '3 · Panels are tabs', b: 'Everything lives in these tabs. <b>Drag</b> a tab to reorder, <b>double-click</b> to float it as a window, and use <b>▦</b> in the top bar for layout presets and show / hide. <kbd>Alt</kbd>+<kbd>1…9</kbd> jumps by position.' },
    { t: tq('.bandstrip'), side: 'bottom', title: '4 · Your band, always one click away', b: 'Switch the <b>drums, bass, rhythm guitar and lead tab</b> on or off while you play. Right-click a chip for level, pan and style. The <b>Mix</b> menu picks a rehearsal setup, such as everything but the lead you are practising.' },
    { t: tq('.rigdeck'), pane: 'rig', side: 'bottom', title: '5 · The Rig: tone, A/B and scenes', b: 'The current tone, <b>A/B morph</b> to compare two settings, <b>Mutate</b> to explore, and <b>save, export or import</b> your own presets. Eight <b>scenes</b> store a whole board setup so one key (<kbd>1</kbd>…<kbd>8</kbd>) switches between a clean verse and a lead tone.' },
    { t: tq('.chainbar'), pane: 'rig', side: 'bottom', title: '6 · Pedalboard and signal chain', b: 'This strip is your signal path, in order. <b>Drag</b> pedals to reorder, click one to scroll to it, and use each pedal\'s <b>⚙</b> to resize, recolour, collapse, hide or bind a footswitch key or MIDI note. <b>Stomp</b> view turns the board into big tiles for playing live.' },
    { t: tq('#left'), pre: tourSide('tones'), drawer: 'left', side: 'right', title: '7 · Tones', b: 'Search and filter the preset library: clean, crunch, lead, acoustic, ambient and more. Click one to load it. Your saved presets appear under <b>User</b>.' },
    { t: tq('#timeline'), side: 'top', title: '8 · Arrangement', b: 'The song as a DAW: lanes for chords, tab, bass, drums, your <b>Guitar</b> and <b>Vocal</b> inputs, the loaded backing track and its stems. Drag a lane\'s grip (⠿) to reorder, its bottom edge to resize, ⋯ for colour and hide, <b>Lanes ▾</b> to add or reset. Arm ● the guitar and vocal lanes and press <kbd>R</kbd> to record both at once. <b>Follow</b> keeps the playhead in view.' },
    { t: tq('#pane-tab'), pane: 'tab', side: 'left', title: '9 · Tab editor', b: 'Click a cell and type a fret number. Arrow keys move, and <kbd>h</kbd> <kbd>p</kbd> <kbd>/</kbd> <kbd>\\</kbd> <kbd>b</kbd> <kbd>~</kbd> <kbd>x</kbd> set hammer, pull, slides, bend, vibrato and mute. <kbd>Space</kbd> plays from the current bar.' },
    { t: tq('#songbar'), side: 'bottom', title: '10 · Song details, everywhere', b: 'Title, artist, <b>tuning</b>, capo and scale sit in this strip for every panel. Load a backing track and they fill themselves in: a cleaned-up title, tempo, key and chords. Open <b>Notes &amp; tuning</b> for per-string tuning. Voicings, tab playback, the tuner and transcription all follow it.' },
    { t: tq('#right'), pre: () => { const t = $('#right .side-tabs .tab[data-id="refine"]'); if (t) t.click(); }, drawer: 'right', side: 'left', title: '11 · Refine: lyrics and chords', b: 'The lyric and chord canvas lives in the right panel so you can keep any tab open in the centre while you write. Use <b>⇆</b> on a sidebar to move panels between the sides, or <b>☰</b> above the tabs to see every panel.' },
    { t: tq('#pane-fret'), pane: 'fret', side: 'left', title: '12 · Fretboard', b: 'A hexagon fretboard that knows your tuning, capo and scale. Highlight scales and chord tones, and click any note to hear it. When the Vision pane is tracking your hand, the fingers you play light up here too.' },
    { t: tq('#right'), pre: () => { const t = $('#right .side-tabs .tab[data-id="monitor"]'); if (t) t.click(); }, drawer: 'right', side: 'left', title: '13 · Tuner and live analysis', b: 'Play a note: the tuner shows the note and cents, then levels and live chord / key detection. Click a string circle to hear its reference pitch.' },
    { t: tq('#pane-tx'), pane: 'tx', side: 'left', title: '14 · Transcribe', b: 'Record yourself or load an audio file and get <b>polyphonic tab</b>: chords, bass and melody mapped to strings and frets for your tuning. Review, accept, then apply to the song. <b>Measure noise</b> and <b>Calibrate to my guitar</b> improve accuracy, and <b>Run self-test</b> scores the engine on synthetic guitar.' },
    { t: tq('#pane-stems'), pane: 'stems', side: 'left', title: '15 · Stems and backing tracks', b: 'Load a song and The app separates <b>drums, bass, vocals and guitar / other</b>, finds the tempo, key and chords, and lets you mute stems to play along. Send the chords or the drum groove to the band. Separation is DSP-based and runs on your machine; expect good drums and vocals, rougher guitar.' },
    { t: tq('#pane-neural'), pane: 'neural', side: 'left', title: '16 · Neural map', b: 'The music as a living network: notes become nodes and harmony forms the layers as the song progresses. Rotate, scrub through time and click nodes to inspect them.' },
    { t: tq('#pane-stage'), pane: 'stage', side: 'left', title: '17 · Stage', b: 'Full-screen, audio-reactive visuals for performing: hex resonance, tunnels, a prompter, and a neural mode. With Stage focused, <kbd>1</kbd>…<kbd>8</kbd> change scenes.' },
    { t: tq('#top #topR'), side: 'bottom', title: '18 · Settings, help and saving', b: '<b>⚙</b> Settings (A4 pitch, flats, input options), <b>◐</b> light / dark, <b>?</b> shortcuts. Your song autosaves in this browser. Use <b>Export</b> for Project JSON, tab text, ChordPro, MIDI or WAV so nothing is stuck in the page.' },
    { t: null, title: 'You are ready', b: 'A good first session: pick a tone, press <kbd>Space</kbd>, play along with the band, then try <b>Transcribe</b> or load a backing track in <b>Stems</b>.<br><br>Reopen this tour from <b>?</b> whenever you like.', last: true }
  ];
}
function tourEnd(done) {
  if (!TOUR.on) return; TOUR.on = false; TOUR.token++; cancelAnimationFrame(TOUR.raf);
  window.removeEventListener('resize', tourPlace, true); document.removeEventListener('keydown', tourKey, true);
  if (TOUR.el) TOUR.el.remove(); TOUR.el = TOUR.spot = TOUR.card = null; if (document.body.dataset.form && document.body.dataset.form !== 'desktop') mCloseOverlays();
  CFG.tourDone = true; CFG.tourAsked = true; saveCfg(); if (done) toast('Tour complete. Reopen it from ? any time.', 'ok');
}
function tourKey(e) {
  if (!TOUR.on) return;
  const k = e.key; if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); return tourEnd(false); }
  if (k === 'ArrowRight' || k === 'Enter' || k === ' ' || k === 'PageDown') { e.preventDefault(); e.stopPropagation(); return tourNext(); }
  if (k === 'ArrowLeft' || k === 'Backspace' || k === 'PageUp') { e.preventDefault(); e.stopPropagation(); return tourGo(TOUR.i - 1); }
  if (k === 'Tab') return;
  e.stopPropagation(); e.preventDefault();
}
const tourNext = () => TOUR.i >= TOUR.steps.length - 1 ? tourEnd(true) : tourGo(TOUR.i + 1);
function tourStart(from = 0) {
  if (TOUR.on) tourEnd(false); const d = $('#help'); if (d && d.open) d.close(); const s = $('#settings'); if (s && s.open) s.close();
  const b = $('#boot'); if (b) b.remove(); const of = $('#tourOffer'); if (of) of.remove();
  TOUR.on = true; TOUR.steps = tourSteps();
  TOUR.spot = h('div', { class: 'tour-spot' }); TOUR.card = h('div', { class: 'tour-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'the-daily.studio guided tour' });
  TOUR.el = h('div', { id: 'tour', class: 'tour' }, h('div', { class: 'tour-block', onclick: e => e.stopPropagation() }), TOUR.spot, TOUR.card); document.body.append(TOUR.el);
  window.addEventListener('resize', tourPlace, true); document.addEventListener('keydown', tourKey, true);
  tourGo(from);
}
async function tourGo(i) {
  if (!TOUR.on) return; i = clamp(i, 0, TOUR.steps.length - 1); TOUR.i = i; const tok = ++TOUR.token, st = TOUR.steps[i];
  try { if (document.body.dataset.form === 'tablet') { if (st.drawer) { if (M.drawer !== st.drawer) mDrawer(st.drawer); } else mCloseOverlays(); } if (st.pre) st.pre(); if (st.pane && !FLOATS.has(st.pane) && DOCK.cur !== st.pane) dockGo(st.pane); } catch (e) { console.warn('tour pre', e); }
  tourRender(st, i);
  await new Promise(r => setTimeout(r, 140)); if (tok !== TOUR.token || !TOUR.on) return;
  st._el = st.t ? st.t() : null; if (st._el) { try { st._el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { } }
  await new Promise(r => requestAnimationFrame(r)); if (tok !== TOUR.token || !TOUR.on) return;
  tourPlace();
}
function tourRender(st, i) {
  const n = TOUR.steps.length, c = TOUR.card; c.innerHTML = '';
  const dots = h('div', { class: 'tour-dots' }); for (let k = 0; k < n; k++) dots.append(h('i', { class: k === i ? 'on' : k < i ? 'done' : '', title: TOUR.steps[k].title, onclick: () => tourGo(k) }));
  c.append(h('div', { class: 'tour-n' }, i === 0 ? 'GUIDED TOUR' : i === n - 1 ? 'DONE' : 'STEP ' + i + ' OF ' + (n - 2)),
    h('h3', {}, st.title), h('div', { class: 'tour-b', html: st.b }), ...(st.tip ? [h('div', { class: 'tour-tip' }, '💡 ' + st.tip)] : []), dots,
    h('div', { class: 'tour-f' }, ...[h('button', { class: 'btn sm ghost', onclick: () => tourEnd(false) }, i === n - 1 ? 'Close' : 'Skip tour'), h('span', { class: 'grow' }),
      ...(i > 0 ? [h('button', { class: 'btn sm', onclick: () => tourGo(i - 1) }, '← Back')] : []), h('button', { class: 'btn sm primary', onclick: tourNext }, i === 0 ? 'Start the tour →' : i === n - 1 ? 'Finish ✓' : 'Next →')]));
  const nb = $('.btn.primary', c); if (nb) nb.focus({ preventScroll: true });
}
function tourPlace() {
  if (!TOUR.on || !TOUR.card) return; const st = TOUR.steps[TOUR.i], c = TOUR.card, sp = TOUR.spot, vw = innerWidth, vh = innerHeight, M = 12;
  const el = st._el && st._el.isConnected ? st._el : null, r = el ? el.getBoundingClientRect() : null;
  c.style.maxWidth = Math.min(380, vw - 2 * M) + 'px'; const cw = c.offsetWidth, ch = c.offsetHeight;
  if (!r || !r.width || !r.height) { sp.style.opacity = 0; c.style.left = Math.round((vw - cw) / 2) + 'px'; c.style.top = Math.round(Math.max(M, (vh - ch) / 2)) + 'px'; TOUR.el.classList.add('nospot'); return; }
  TOUR.el.classList.remove('nospot');
  const P = 6, x0 = Math.max(2, r.left - P), y0 = Math.max(2, r.top - P), x1 = Math.min(vw - 2, r.right + P), y1 = Math.min(vh - 2, r.bottom + P);
  Object.assign(sp.style, { opacity: 1, left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px' });
  const want = [st.side || 'bottom', 'right', 'left', 'bottom', 'top'], G = 14, cand = {
    right: [x1 + G, y0], left: [x0 - cw - G, y0], bottom: [x0, y1 + G], top: [x0, y0 - ch - G] };
  let pos = null;
  for (const s of want) { let [x, y] = cand[s]; x = clamp(x, M, vw - cw - M); y = clamp(y, M, vh - ch - M); const hit = !(x + cw < x0 || x > x1 || y + ch < y0 || y > y1); if (!hit) { pos = [x, y]; break; } }
  if (!pos) pos = [clamp(x1 - cw - 18, M, vw - cw - M), clamp(y1 - ch - 18, M, vh - ch - M)]; // large target: card sits inside its corner
  c.style.left = Math.round(pos[0]) + 'px'; c.style.top = Math.round(pos[1]) + 'px';
}
/* first-run offer: one small card, never again once answered */
function tourOffer() {
  if (CFG.tourAsked || CFG.tourDone || TOUR.on || $('#tourOffer') || $('#humbar') || $('#hum')) return;
  const close = () => { const o = $('#tourOffer'); if (o) o.remove(); CFG.tourAsked = true; saveCfg(); };
  const o = h('div', { id: 'tourOffer', class: 'tour-offer' }, h('div', {}, h('b', {}, 'New here?'), h('span', { class: 'muted' }, ' A two-minute tour shows where everything is.')),
    h('div', { class: 'row', style: { gap: '6px' } }, h('button', { class: 'btn sm primary', onclick: () => { close(); tourStart(); } }, 'Take the tour'), h('button', { class: 'btn sm', onclick: close }, 'Not now')));
  document.body.append(o); setTimeout(() => { if (o.isConnected) close(); }, 30000);
}
bus.on('booted', () => setTimeout(tourOffer, 900));

/* phone walkthrough: same story, told through the bottom navigation */
function tourStepsPhone() {
  const go = (g, sid) => () => { mCloseOverlays(); if (M.g !== g || M.s !== sid) mGo(g, sid); };
  const tl = () => { mCloseOverlays(); if (document.body.dataset.tl === 'off') { M.tl[document.body.dataset.land === '1' ? 'l' : 'p'] = 'mini'; mSync(); } };
  return [
    { t: null, title: 'Welcome to the-daily.studio', b: 'A guitar workstation that runs entirely in this browser tab: a pedal rig, a backing band, a tab composer, live analysis, a transcriber, stem separation and live visuals. Everything stays on your phone.<br><br>This tour takes a minute and never changes your song. Tap <b>Next</b> to move on.' },
    { t: tq('#top'), pre: go('play', 'rig'), side: 'bottom', title: '1 · Tempo, signature and key', b: 'The song\'s <b>BPM</b>, time signature, key and mode live up here and drive the band, the fretboard and the tab.' },
    { t: tq('#mtrans'), side: 'top', title: '2 · Transport', b: 'Rewind, <b>play</b>, stop, <b>record</b> (with a count-in, dry plus wet takes), <b>loop</b> and the <b>click</b>. The readout shows bar · beat · slot.', tip: 'Use headphones when recording so the speaker does not feed back into the mic.' },
    { t: tq('#mnav'), side: 'top', title: '3 · Five sections', b: '<b>Play</b> (rig, tones, tuner, I/O), <b>Write</b> (tab, song, band, fretboard, theory), <b>See</b> (visuals, stage, neural map, vision), <b>Stems</b> and <b>More</b> (research, export). The chips at the top switch between the panels of a section.' },
    { t: tq('#left'), pre: go('play', 'io'), side: 'bottom', title: '4 · Connect your guitar', b: 'Open <b>I/O</b> and choose your audio interface or the phone\'s input. Allow microphone access when asked, and press the refresh button (⟳) if the list is empty.<br><br>On iPhone and iPad an interface works through the Lightning / USB-C port; Web MIDI is not available there.' },
    { t: tq('.rigdeck'), pre: go('play', 'rig'), side: 'bottom', title: '5 · The rig', b: 'The current tone, <b>A/B morph</b>, <b>Mutate</b>, and eight <b>scenes</b>. Scroll down for the pedalboard; open a pedal\'s <b>⚙</b> to move it earlier or later in the chain.' },
    { t: tq('.bandstrip'), pre: go('play', 'rig'), side: 'bottom', title: '6 · Your band', b: 'Switch <b>drums, bass, rhythm guitar and lead tab</b> on or off while you play. Press and hold a chip for level, pan and style.' },
    { t: tq('#left'), pre: go('play', 'tones'), side: 'bottom', title: '7 · Tones', b: 'Search and filter the preset library. Tap one to load it; saved presets appear under <b>User</b>.' },
    { t: tq('#kpad'), pre: go('write', 'tab'), side: 'top', title: '8 · Write tab with the keypad', b: 'Tap a cell in the grid, then tap a fret on the keypad. <b>10s</b> and <b>20s</b> make two-digit frets, <b>Auto ▶</b> moves on after each note, and the technique keys set hammer, pull, slides, bend, vibrato and mute.' },
    { t: tq('#timeline'), pre: () => { go('write', 'tab')(); tl(); }, side: 'top', title: '9 · Arrangement', b: 'The song as lanes. Tap the ruler to seek, press and drag for a loop, and use <b>Tracks</b> in the chip row to make the arrangement mini, tall or hidden.' },
    { t: tq('#songbar'), pre: () => { go('write', 'song')(); document.body.classList.add('song-open'); }, side: 'top', title: '10 · Song details', b: 'The <b>♪ Song</b> chip opens this sheet: title, artist, tuning, capo and scale. Load a backing track and it fills in for you. Voicings, the tuner, chord detection and transcription all follow the tuning.' },
    { t: tq('#pane-neural'), pre: go('see', 'neural'), side: 'bottom', title: '11 · Neural map', b: 'The music as a living network. Drag to orbit, <b>pinch</b> to zoom, two fingers to pan, tap a node to inspect it.' },
    { t: tq('#pane-stage'), pre: go('see', 'stage'), side: 'bottom', title: '12 · Stage', b: 'Audio-reactive visuals for performing. <b>⛶ Full</b> fills the screen, ideal in landscape; keep the phone on a stand and play.' },
    { t: tq('#pane-stems'), pre: go('stems', 'stems'), side: 'bottom', title: '13 · Stems and backing tracks', b: 'Load a song and The app separates drums, bass, vocals and guitar / other, finds tempo, key and chords, and lets you mute stems to play along. Long files take a while on a phone; short clips are quickest.' },
    { t: tq('#pane-tx'), pre: go('stems', 'tx'), side: 'bottom', title: '14 · Transcribe', b: 'Record yourself or load audio and get polyphonic tab for your tuning. Review it, then apply it to the song.' },
    { t: tq('.mmore'), pre: go('play', 'rig'), side: 'bottom', title: '15 · More', b: 'Theme, <b>Monitor</b>, screen-awake, settings, help, saving the project, sharing the link, installing the-daily.studio as an app, and the <b>Device layout</b> switch (Auto, Phone, Tablet, Desktop).' },
    { t: null, title: 'You are ready', b: 'A good first session: pick a tone, tap <b>▶</b>, play along with the band, then try <b>Write ▸ Tab</b> or load a backing track in <b>Stems</b>.<br><br>Reopen this tour from <b>⋯ More ▸ Guided tour</b>.', last: true }
  ];
}
bus.on('form', () => { if (TOUR.on) tourEnd(false); });

/* >>> parts/18-mobile.js */
/* ============================================================
   Part 18 · responsive shell: phone / tablet / desktop form factors
   - detects the form factor (or honours Settings → Device layout) and sets body[data-form|data-land|data-touch]
   - phone: compact top bar, bottom transport, section chips + bottom navigation, "More" sheet, collapsible arrangement
   - tablet: two-row header, sidebars become slide-in drawers
   - desktop: untouched (this part only toggles attributes and moves nothing)
   ============================================================ */
const M = { form: 'desktop', g: 'play', s: 'rig', view: 'center', tl: { p: 'mini', l: 'off' }, last: {}, sheet: null, drawer: null };
const MGROUPS = [
  { id: 'play', name: 'Play', ico: '<rect x="4" y="5" width="16" height="14" rx="2.4"/><circle cx="9" cy="12" r="2.2"/><path d="M14.5 10h3M14.5 14h3"/>', subs: [['rig', 'Rig'], ['tones', 'Tones', 'left'], ['tuner', 'Tuner', 'right'], ['io', 'I/O', 'left']] },
  { id: 'write', name: 'Write', ico: '<path d="M4 20l1-4.2L16.2 4.6a1.6 1.6 0 012.2 0l1 1a1.6 1.6 0 010 2.2L8.2 19z"/><path d="M14 7l3 3"/>', subs: [['tab', 'Tab'], ['song', 'Song'], ['refine', 'Refine', 'right'], ['band', 'Band'], ['fret', 'Fretboard'], ['theory', 'Theory', 'left']] },
  { id: 'see', name: 'See', ico: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><circle cx="12" cy="12" r="2.6"/>', subs: [['vis', 'Visuals'], ['stage', 'Stage'], ['neural', 'Neural'], ['cam', 'Vision']] },
  { id: 'stems', name: 'Stems', ico: '<path d="M4 9v6M8 5v14M12 8v8M16 4v16M20 9v6"/>', subs: [['stems', 'Stems'], ['tx', 'Transcribe']] },
  { id: 'more', name: 'More', ico: '<circle cx="5.5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18.5" cy="12" r="1.5"/>', subs: [['lab', 'Research'], ['exp', 'Export']] }
];
const msvg = (inner, sz) => { const s = document.createElement('span'); s.className = 'ico'; s.innerHTML = '<svg viewBox="0 0 24 24" width="' + (sz || 22) + '" height="' + (sz || 22) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>'; return s; };
const mGroupOf = sid => MGROUPS.find(g => g.subs.some(s => s[0] === sid));

function detectForm() {
  const pref = CFG.form; if (pref === 'phone' || pref === 'tablet' || pref === 'desktop') return pref;
  const w = innerWidth, hh = innerHeight, coarse = matchMedia('(pointer:coarse)').matches;
  if (w <= 600 || (hh <= 500 && w <= 960)) return 'phone';
  if (w <= 1024 || (coarse && w <= 1400)) return 'tablet';
  return 'desktop';
}

/* the transport row lives in the header on desktop/tablet; on phones the playing buttons move to a bottom bar */
function mMoveTransport(phone) {
  const tr = $('#transport'); if (!tr || !M.trans) return;
  if (!M.kids) M.kids = [...tr.children];
  if (phone) { const k = M.kids; M.trans.append(k[0], k[1], k[2], k[3], k[4], k[5], k[6], k[7]); tr.append(k[8], k[9], k[10], k[11]); }
  else tr.append(...M.kids);
}

function applyForm() {
  const f = detectForm(), land = innerWidth > innerHeight, b = document.body, was = M.form;
  b.dataset.form = f; b.dataset.land = land ? '1' : '0'; b.dataset.touch = matchMedia('(pointer:coarse)').matches ? '1' : '0';
  document.documentElement.style.setProperty('--app-h', innerHeight + 'px');
  if (f !== was) {
    M.form = f; mCloseOverlays();
    mMoveTransport(f === 'phone');
    if (f !== 'desktop' && typeof FLOATS !== 'undefined') [...FLOATS.keys()].forEach(id => { try { unfloat(id); } catch (e) { } });
    const l = $('#left'), r = $('#right'); if (l) l.style.visibility = ''; if (r) r.style.visibility = '';
    if (f === 'desktop') { M.view = 'center'; applyLayout(); } else mSync();
    bus.emit('form', f);
  } else if (f !== 'desktop') mSync();
  setTimeout(() => { if (typeof tlSize === 'function') tlSize(); window.dispatchEvent(new Event('fw:fit')); }, 60);
}

/* ---------- navigation model (phone) ---------- */
function mSetView(v) { M.view = v; mSync(); }
function mGo(gid, sid) {
  const g = MGROUPS.find(x => x.id === gid) || MGROUPS[0], s = g.subs.find(x => x[0] === sid) || g.subs.find(x => x[0] === M.last[g.id]) || g.subs[0];
  M.g = g.id; M.s = s[0]; M.last[g.id] = s[0]; CFG.mlast = M.last;
  mCloseOverlays(true);
  if (s[2] === 'left') { M.view = 'left'; const t = $('#left .side-tabs .tab[data-id="' + s[0] + '"]'); if (t) t.click(); }
  else if (s[2] === 'right') { M.view = 'right'; const t = $('#right .side-tabs .tab[data-id="' + (s[0] === 'tuner' ? 'monitor' : s[0]) + '"]'); if (t) t.click(); }
  else { M.view = 'center'; if (DOCK.cur !== s[0]) dockGo(s[0]); }
  mSync();
}
function mSync() {
  const b = document.body; if (!b.dataset.form) return;
  b.dataset.view = M.view; b.dataset.g = M.g; b.dataset.s = M.s; b.dataset.kpad = CFG.kpad === false ? '0' : '1';
  const tlv = mTl();
  b.dataset.tl = (M.view !== 'center' || M.g === 'see') ? 'off' : tlv;
  if (!M.nav) return;
  $$('.mnb', M.nav).forEach(x => x.classList.toggle('on', x.dataset.g === M.g));
  const g = MGROUPS.find(x => x.id === M.g); if (!g) return;
  if (M.subFor !== g.id) { M.subFor = g.id; M.chips.innerHTML = ''; g.subs.forEach(([id, name, tgt]) => M.chips.append(h('button', { class: 'msc', 'data-s': id, role: 'tab', onclick: () => mGo(g.id, id) }, name))); }
  $$('.msc', M.chips).forEach(x => x.classList.toggle('on', x.dataset.s === M.s));
  const on = M.chips.querySelector('.msc.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (M.songBtn) M.songBtn.textContent = '♪ ' + ((S && S.title) || 'Song').slice(0, 14);
  M.tlBtn.textContent = tlv === 'full' ? '▾ Panel' : tlv === 'off' ? '▴ Tracks' : '⤢ Tracks'; M.tlBtn.title = tlv === 'mini' ? 'Give the tracks the whole screen' : tlv === 'full' ? 'Back to the panel (tracks hidden)' : 'Show the tracks';
  M.tlBtn.style.display = M.view === 'center' && M.g !== 'see' ? '' : 'none';
  setTimeout(() => { if (typeof tlSize === 'function') tlSize(); window.dispatchEvent(new Event('fw:fit')); }, 50);
}
const mTl = () => M.tl[document.body.dataset.land === '1' ? 'l' : 'p'];
function mCycleTl() { const k = document.body.dataset.land === '1' ? 'l' : 'p', v = M.tl[k]; M.tl[k] = v === 'mini' ? 'full' : v === 'full' ? 'off' : 'mini'; CFG.mtl = M.tl; saveCfg(); mSync(); }

/* ---------- overlays: More sheet, tablet drawers ---------- */
function mCloseOverlays(keepBack) {
  if (M.sheet) { M.sheet.remove(); M.sheet = null; }
  document.body.classList.remove('d-left', 'd-right', 'sheet-open', 'song-open');
  M.drawer = null;
}
function mDrawer(side) {
  const open = M.drawer === side; mCloseOverlays();
  if (!open) { M.drawer = side; document.body.classList.add('d-' + side); }
}
function mShare() {
  const url = location.href.split('#')[0];
  if (navigator.share) navigator.share({ title: BRAND.name, text: 'A guitar workstation that runs entirely in the browser.', url }).catch(() => { });
  else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => toast('Link copied'), () => toast(url));
  else toast(url);
}
function mSheet() {
  if (M.sheet) { mCloseOverlays(); return; }
  mCloseOverlays();
  const tile = (ico, label, fn, on) => h('button', { class: 'mtile' + (on ? ' on' : ''), onclick: e => { fn(e); } }, ico, h('span', {}, label));
  const stat = h('div', { class: 'mstat' }, (UI.st && UI.st.a.textContent) || '', UI.lat ? h('span', {}, UI.lat.textContent) : null);
  const mon = tile(msvg('<path d="M4 14v-2a8 8 0 0116 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>'), 'Monitor ' + (CFG.monitor ? 'on' : 'off'), e => { setMonitor(!CFG.monitor); mSheetRefresh(); }, CFG.monitor);
  const wake = tile(msvg('<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>'), 'Screen awake ' + (CFG.wake !== false ? 'on' : 'off'), () => { CFG.wake = CFG.wake === false; saveCfg(); wakeSync(); mSheetRefresh(); }, CFG.wake !== false);
  const seg = h('div', { class: 'seg mseg' }, [['auto', 'Auto'], ['phone', 'Phone'], ['tablet', 'Tablet'], ['desktop', 'Desktop']].map(([v, t]) => h('button', { class: (CFG.form || 'auto') === v ? 'on' : '', onclick: () => { CFG.form = v; saveCfg(); applyForm(); mSheetRefresh(); } }, t)));
  const sh = h('div', { class: 'msheet', role: 'dialog', 'aria-label': 'More' },
    h('div', { class: 'mgrab', onclick: () => mCloseOverlays() }),
    stat,
    h('div', { class: 'mgrid' },
      tile(msvg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>'), 'Hum or sing a song', () => { mCloseOverlays(); humOpen(); }),
      tile(msvg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>'), 'Audio · kill switch', () => { mCloseOverlays(); audioOpen(); }),
      tile(msvg('<path d="M21 14.5A8.5 8.5 0 119.5 3a6.7 6.7 0 0011.5 11.5z"/>'), CFG.theme === 'light' ? 'Dark theme' : 'Light theme', () => { setTheme(CFG.theme === 'light' ? 'dark' : 'light'); mSheetRefresh(); }),
      tile(msvg('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 000 18z" fill="currentColor"/>'), 'Appearance', () => { mCloseOverlays(); lookOpen(); }),
      mon, wake,
      tile(msvg('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 00-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 00-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 002 1.2l.4 2.7h4l.4-2.7a7 7 0 002-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>'), 'Settings', () => { mCloseOverlays(); openSettings(); }),
      tile(msvg('<path d="M12 3a9 9 0 100 18 9 9 0 000-18zM9.5 9.5a2.5 2.5 0 115 0c0 1.7-2.5 2-2.5 4M12 17h.01"/>'), 'Help', () => { mCloseOverlays(); openHelp(); }),
      tile(msvg('<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>'), 'Guided tour', () => { mCloseOverlays(); tourStart(); }),
      tile(msvg('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'), 'Save project', () => { exportProject(); }),
      tile(msvg('<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.8l7.4-4.4M8.3 13.2l7.4 4.4"/>'), 'Share link', mShare),
      M.installEvt ? tile(msvg('<rect x="7" y="2.5" width="10" height="19" rx="2.4"/><path d="M12 8v7M9 12.5l3 3 3-3"/>'), 'Install app', () => { mInstall(); }) : null,
      document.fullscreenEnabled ? tile(msvg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'), 'Full screen', () => { mCloseOverlays(); mFullscreen(); }) : null
    ),
    h('div', { class: 'mrow' }, h('span', {}, 'Device layout'), seg),
    h('div', { class: 'mfoot' }, BRAND.name + ' v' + VERSION + ' · everything stays on this device')
  );
  M.sheet = sh; document.body.classList.add('sheet-open'); document.body.append(sh);
}
function mSheetRefresh() { if (!M.sheet) return; M.sheet.remove(); M.sheet = null; mSheet(); }
function mFullscreen() { const e = document.documentElement; try { if (document.fullscreenElement) document.exitFullscreen(); else if (e.requestFullscreen) e.requestFullscreen({ navigationUI: 'hide' }).catch(() => toast('Full screen is not available here')); } catch (err) { } }
function mInstall() { const ev = M.installEvt; if (!ev) return; M.installEvt = null; ev.prompt(); ev.userChoice && ev.userChoice.finally(() => { }); mCloseOverlays(); }

/* ---------- build ---------- */
function buildMobile() {
  const app = $('#app'), top = $('#top'); if (!app || !top) return;
  M.trans = h('div', { id: 'mtrans', role: 'group', 'aria-label': 'Transport' });
  M.chips = h('div', { class: 'mchips', role: 'tablist' });
  M.tlBtn = h('button', { class: 'msc tl', title: 'Arrangement: mini → full → hidden', onclick: mCycleTl }, '▴ Tracks');
  M.songBtn = h('button', { class: 'msc song', title: 'Song details: title, artist, tuning, capo, loaded track', onclick: () => { const o = document.body.classList.contains('song-open'); mCloseOverlays(); if (!o) { document.body.classList.add('song-open'); } } }, '♪ Song');
  M.sub = h('div', { id: 'msub' }, M.songBtn, M.chips, M.tlBtn);
  M.nav = h('nav', { id: 'mnav', 'aria-label': 'Sections' }, MGROUPS.map(g => h('button', { class: 'mnb', 'data-g': g.id, onclick: () => mGo(g.id) }, msvg(g.ico), h('span', {}, g.name))));
  M.back = h('div', { id: 'mback', onclick: () => mCloseOverlays() });
  const more = h('button', { class: 'btn icon mmore', title: 'More: theme, settings, help, share', 'aria-label': 'More', onclick: mSheet }, msvg('<circle cx="5.5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor"/>', 20));
  $('#topR').append(more);
  const dl = h('button', { class: 'btn icon mdraw l', title: 'Tones, I/O and theory ([)', 'aria-label': 'Open the Tones panel', onclick: () => mDrawer('left') }, msvg('<path d="M4 6h16M4 12h16M4 18h16"/>', 18));
  const dr = h('button', { class: 'btn icon mdraw r', title: 'Tuner and levels (])', 'aria-label': 'Open the Tuner panel', onclick: () => mDrawer('right') }, msvg('<path d="M12 3v7M8 7l4 4 4-4M5 14h14M7 18h10"/>', 18));
  top.insertBefore(dl, top.firstChild); $('#topR').insertBefore(dr, $('#topR').firstChild);
  app.append(M.trans, M.sub, M.nav, M.back);
  M.tl = Object.assign(M.tl, CFG.mtl && typeof CFG.mtl === 'object' ? CFG.mtl : {}); M.last = CFG.mlast || {};
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && (M.sheet || M.drawer)) mCloseOverlays(); });
  let rt = 0; const fit = () => { clearTimeout(rt); rt = setTimeout(applyForm, 90); };
  window.addEventListener('resize', fit); window.addEventListener('orientationchange', fit);
  bus.on('dock', id => {
    if (M.form === 'desktop' || (typeof SD !== 'undefined' && SD.nat[id])) return; const g = mGroupOf(id); if (!g) return;
    M.g = g.id; M.s = id; M.last[g.id] = id; M.view = 'center'; mSync();
  });
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); M.installEvt = e; });
  applyForm();
  if (M.form !== 'desktop') { const init = mGroupOf(DOCK.cur || 'rig'); M.g = init ? init.id : 'play'; M.s = DOCK.cur || 'rig'; mSync(); }
}

/* >>> parts/19-touch.js */
/* ============================================================
   Part 19 · touch-first extras
   on-screen tab keypad, long-press = right-click, screen wake lock while playing,
   first-run phone defaults, installable app (manifest + service worker), Esc / back for the stage
   Everything here is inert on desktop.
   ============================================================ */
const TK = { arm: '' };
const touchUI = () => !!document.body.dataset.form && document.body.dataset.form !== 'desktop';
const coarsePtr = () => matchMedia('(pointer:coarse)').matches;

/* ---------- on-screen tab keypad ---------- */
function kpSend(key) { tabKey({ key, ctrlKey: false, metaKey: false, altKey: false, preventDefault() { }, stopPropagation() { } }); kpSync(); }
function kpDigit(d) {
  let v = +d; if (TK.arm) { const w = +(TK.arm + d); if (w <= 24) v = w; TK.arm = ''; }
  TE.buf = ''; TE.t = 0; setNote(v); kpSync();
  if (CFG.kpAuto !== false) kpSend('ArrowRight');
}
function kpArm(a) { TK.arm = TK.arm === a ? '' : a; kpSync(); }
function kpSync() {
  if (!TK.el) return;
  $$('.kp.arm', TK.el).forEach(b => b.classList.toggle('on', b.dataset.a === TK.arm));
  TK.auto.classList.toggle('on', CFG.kpAuto !== false);
  const n = curBar() && curBar().tab.find(o => o.s === TE.slot && o.st === TE.st);
  TK.info.textContent = 'bar ' + (TE.bi + 1) + ' · string ' + (stringLabels()[5 - TE.st] || '') + ' · ' + (n ? 'fret ' + n.f + (n.t ? ' ' + n.t : '') : 'empty') + (TK.arm ? ' · +' + TK.arm + 'x' : '');
}
function buildKeypad() {
  const dock = $('#dock'); if (!dock || !PANES.tab) return;
  const k = (label, fn, cls, title, extra) => h('button', Object.assign({ class: 'kp ' + (cls || ''), type: 'button', title: title || '', 'aria-label': title || label, onpointerdown: e => e.preventDefault(), onclick: fn }, extra || {}), label);
  const nums = [...'0123456789'].map(d => k(d, () => kpDigit(d), 'num', 'Fret ' + d));
  TK.auto = k('Auto ▶', () => { CFG.kpAuto = CFG.kpAuto === false; saveCfg(); kpSync(); }, 'tog', 'Move to the next slot after each fret');
  TK.info = h('span', { class: 'kp-info' });
  const tech = [['h', 'h', 'Hammer-on'], ['p', 'p', 'Pull-off'], ['/', '/', 'Slide up'], ['\\', '\\', 'Slide down'], ['b', 'b', 'Bend'], ['~', '~', 'Vibrato'], ['x', 'x', 'Muted note'], ['<', '‹n›', 'Natural harmonic']].map(([key, lab, t]) => k(lab, () => kpSend(key), 'tech', t));
  const tools = h('div', { class: 'kp-row kp-tools' },
    k('10s', () => kpArm('1'), 'arm', 'Next digit makes a fret 10–19', { 'data-a': '1' }), k('20s', () => kpArm('2'), 'arm', 'Next digit makes a fret 20–24', { 'data-a': '2' }),
    k('◀', () => kpSend('ArrowLeft'), 'nav', 'Previous slot'), k('▶', () => kpSend('ArrowRight'), 'nav', 'Next slot'), k('▲', () => kpSend('ArrowUp'), 'nav', 'Higher string'), k('▼', () => kpSend('ArrowDown'), 'nav', 'Lower string'),
    k('⌫', () => kpSend('Delete'), 'nav bad', 'Clear this note'), TK.auto, ...tech,
    k('⏵ bar', () => kpSend('Enter'), 'nav', 'Play from this bar'));
  TK.el = h('div', { id: 'kpad', role: 'group', 'aria-label': 'Tab keypad' }, h('div', { class: 'kp-row kp-nums' }, ...nums), tools, TK.info);
  dock.append(TK.el);
  bus.on('song', kpSync); bus.on('dock', () => setTimeout(kpSync, 0));
  document.addEventListener('pointerup', () => { if (document.body.dataset.s === 'tab') setTimeout(kpSync, 0); }, true);
  kpSync();
}

/* ---------- long-press = right-click (knob MIDI-learn, band chip menus, …) ---------- */
function initLongPress() {
  let tm = 0, sx = 0, sy = 0, tgt = null, native = false;
  const stop = () => { clearTimeout(tm); tm = 0; };
  document.addEventListener('pointerdown', e => {
    stop(); native = false; if (e.pointerType !== 'touch' || !e.isPrimary || !touchUI()) return;
    if (e.target.closest('input,select,textarea,.tcell,#kpad,.msheet')) return;
    sx = e.clientX; sy = e.clientY; tgt = e.target;
    tm = setTimeout(() => {
      tm = 0; if (native || !tgt || !tgt.isConnected) return;
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: sx, clientY: sy, view: window, button: 2 });
      if (!tgt.dispatchEvent(ev) && navigator.vibrate) { try { navigator.vibrate(12); } catch (er) { } }
    }, 650);
  }, true);
  document.addEventListener('pointermove', e => { if (tm && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) stop(); }, true);
  ['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, stop, true));
  document.addEventListener('contextmenu', e => { if (e.isTrusted) { native = true; stop(); } }, true);
}

/* ---------- keep the screen on while it matters ---------- */
const WK = { lock: null };
async function wakeSync() {
  const want = touchUI() && CFG.wake !== false && !document.hidden && !!(T.playing || T.rec || (E.hasInput && CFG.monitor));
  if (want && !WK.lock && navigator.wakeLock) {
    try { WK.lock = await navigator.wakeLock.request('screen'); WK.lock.addEventListener('release', () => { WK.lock = null; }); } catch (e) { WK.lock = null; }
  } else if (!want && WK.lock) { try { await WK.lock.release(); } catch (e) { } WK.lock = null; }
}

/* ---------- installable app: manifest + offline cache (https / localhost only) ---------- */
function initPwa() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  document.body.dataset.pwa = standalone ? '1' : '0';
  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (secure && window.self === window.top && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  window.addEventListener('appinstalled', () => { M.installEvt = null; toast(BRAND.name + ' installed', 'ok'); });
}

/* ---------- build ---------- */
function buildTouch() {
  buildKeypad(); initLongPress(); initPwa();
  setInterval(wakeSync, 2000); document.addEventListener('visibilitychange', wakeSync);
  if (!CFG.touchInit && touchUI() && coarsePtr()) {
    CFG.touchInit = 1; CFG.monitor = false; saveCfg();
    bus.on('booted', () => setTimeout(() => toast('In-app monitoring starts OFF on touch devices to avoid speaker feedback. Plug in headphones, then switch Monitor on in ⋯ More.', 'ok'), 1200));
  }
  bus.on('form', () => { if (typeof renderStageUI === 'function') renderStageUI(); const w = SG && SG.wrap; if (w && w.classList.contains('pfs') && !touchUI()) stagePfs(false); kpSync(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && SG && SG.wrap && SG.wrap.classList.contains('pfs')) stagePfs(false); });
}

/* >>> parts/20-samples.js */
/* ============================================================
   Part 20 · sample tracks
   Audio files in /samples (listed in samples/manifest.json by the build) appear as one-tap shelves in Stems and
   Transcribe. They are fetched from the same site only when tapped; nothing is uploaded anywhere.
   Hidden when the page is opened from disk or the folder is absent (CodePen, a single emailed file).
   ============================================================ */
const SMP = { list: null, shelves: [] };
async function samplesList() {
  if (SMP.list) return SMP.list;
  try {
    if (typeof fetch !== 'function' || location.protocol === 'file:') throw new Error('no fetch');
    const r = await fetch('samples/manifest.json', { cache: 'no-cache' }); if (!r.ok) throw new Error('none');
    const j = await r.json(); SMP.list = Array.isArray(j.tracks) ? j.tracks : [];
  } catch (e) { SMP.list = []; }
  return SMP.list;
}
async function samplePick(t, handler) {
  try {
    toast('Loading “' + t.title + '”…');
    const r = await fetch('samples/' + encodeURIComponent(t.file)); if (!r.ok) throw new Error('HTTP ' + r.status);
    const blob = await r.blob(), ext = (t.file.match(/\.[^.]+$/) || [''])[0];
    await handler(new File([blob], t.title + ext, { type: blob.type || 'audio/mp4' }));
  } catch (e) { console.warn(e); toast('Could not load that sample: ' + (e.message || e), 'bad'); }
}
function samplesShelf(handler, label) {
  const box = h('div', { class: 'smp-shelf', style: { display: 'none' } }, h('span', { class: 'smp-l' }, label || 'SAMPLE TRACKS'));
  samplesList().then(list => {
    if (!list.length) return;
    list.forEach(t => box.append(h('button', { class: 'btn sm smp', title: (t.note ? t.note + ' · ' : '') + (t.mb ? t.mb + ' MB, downloaded when you tap it' : 'Tap to load'), onclick: () => samplePick(t, handler) }, '▶ ', t.title)));
    box.style.display = '';
  });
  return box;
}

/* >>> parts/21-songbar.js */
/* ============================================================
   Part 21 · SONG BAR — the song's details live in one slim strip under the header, on every tab:
   title · artist · tuning · capo · scale · notes, plus the loaded backing track.
   Loading a track fills these in (title / artist from the file's tags or its name, tempo, key, time, chords).
   ============================================================ */
const SB = { el: null, f: {}, pop: null, trk: null };

/* ---------- names & tags ---------- */
/** "Untitled__Good_Morning.m4a" → "Good Morning";  "03 - Artist - Song_Name (Official Audio)" → "Song Name" */
function cleanTitle(raw) {
  let s = String(raw || ''); try { s = decodeURIComponent(s); } catch (e) { }
  s = s.replace(/\.(mp3|m4a|mp4|aac|wav|wave|flac|ogg|oga|opus|aif|aiff|weba|webm)$/i, '');
  s = s.replace(/^untitled[\s_\-–—.]*/i, '').replace(/^\d{1,3}[\s_.]*[-–—.][\s_]*(?=\D)/, '');
  s = s.replace(/_+/g, ' ').replace(/\s*[(\[](official|lyrics?|audio|video|remaster(ed)?|hd|demo mix|mix \d+)[^)\]]*[)\]]/ig, '').replace(/\s{2,}/g, ' ').trim();
  return s;
}
/** a file called "Artist - Title" gives both halves; anything else is just a title */
function nameParts(raw) {
  const s = cleanTitle(raw), m = s.match(/^(.{2,60}?)\s+[-–—]\s+(.{2,100})$/);
  return m ? { artist: m[1].trim(), title: m[2].trim() } : { artist: '', title: s };
}
function tagText(u, enc) {
  try {
    if (enc === 1 || enc === 2) { let le = enc === 1, i = 0; if (u[0] === 0xFF && u[1] === 0xFE) { le = true; i = 2; } else if (u[0] === 0xFE && u[1] === 0xFF) { le = false; i = 2; } return new TextDecoder(le ? 'utf-16le' : 'utf-16be').decode(u.subarray(i)); }
    return new TextDecoder(enc === 3 ? 'utf-8' : 'iso-8859-1').decode(u);
  } catch (e) { return ''; }
}
/** tiny tag reader: ID3v2 (mp3) and iTunes-style atoms (m4a / mp4). Returns {title, artist} — either may be missing. */
function readTags(ab) {
  const out = {}; let u; try { u = new Uint8Array(ab); } catch (e) { return out; } if (u.length < 16) return out;
  const clean = s => String(s || '').replace(/\0+$/g, '').replace(/\0/g, ' ').trim().slice(0, 140);
  try {
    if (u[0] === 0x49 && u[1] === 0x44 && u[2] === 0x33) {
      const ver = u[3], size = (u[6] << 21) | (u[7] << 14) | (u[8] << 7) | u[9], end = Math.min(u.length, 10 + size), idLen = ver === 2 ? 3 : 4, hdr = ver === 2 ? 6 : 10; let p = 10;
      if (ver > 2 && (u[5] & 0x40)) p += ver === 4 ? ((u[10] << 21) | (u[11] << 14) | (u[12] << 7) | u[13]) : (((u[10] << 24) | (u[11] << 16) | (u[12] << 8) | u[13]) + 4);
      while (p + hdr < end) {
        const id = String.fromCharCode(...u.subarray(p, p + idLen)); if (!/^[A-Z0-9]+$/.test(id)) break;
        const sz = ver === 2 ? ((u[p + 3] << 16) | (u[p + 4] << 8) | u[p + 5]) : ver === 4 ? ((u[p + 4] << 21) | (u[p + 5] << 14) | (u[p + 6] << 7) | u[p + 7]) : (u[p + 4] * 16777216 + ((u[p + 5] << 16) | (u[p + 6] << 8) | u[p + 7]));
        if (sz <= 0 || p + hdr + sz > end) break;
        const body = u.subarray(p + hdr, p + hdr + sz);
        if (id === 'TIT2' || id === 'TT2') out.title = clean(tagText(body.subarray(1), body[0])); else if (id === 'TPE1' || id === 'TP1') out.artist = clean(tagText(body.subarray(1), body[0]));
        p += hdr + sz;
      }
    }
    if (String.fromCharCode(u[4], u[5], u[6], u[7]) === 'ftyp') {
      for (let i = u.indexOf(0xA9); i >= 0 && i < u.length - 24; i = u.indexOf(0xA9, i + 1)) {
        const k = String.fromCharCode(u[i + 1], u[i + 2], u[i + 3]); if (k !== 'nam' && k !== 'ART') continue;
        const p = i + 4; if (String.fromCharCode(u[p + 4], u[p + 5], u[p + 6], u[p + 7]) !== 'data') continue;
        const sz = (u[p] << 24 | u[p + 1] << 16 | u[p + 2] << 8 | u[p + 3]) >>> 0; if (sz < 17 || sz > 400) continue;
        const t = clean(new TextDecoder('utf-8').decode(u.subarray(p + 16, p + sz))); if (t) out[k === 'nam' ? 'title' : 'artist'] = t;
      }
    }
  } catch (e) { console.warn('tag read', e); }
  return out;
}

/* ---------- loading a track fills the song in ---------- */
function songIsPristine() {
  try {
    const d = demoSong(); d.sections.forEach(sec => sec.bars.forEach(b => { const c = barChords(b)[0]; if (c) fillTab(b, 'Fingerstyle pop', c); }));
    const sig = s => JSON.stringify(s.sections.map(x => [x.name, x.bars.map(b => [b.chord, b.tab.length]), (x.lyrics || '').trim()]));
    return sig(d) === sig(S);
  } catch (e) { return false; }
}
const songHasWork = () => S.sections.some(sec => (sec.lyrics || '').trim() || sec.bars.some(b => b.tab.length));
/** Called when a track has been analysed. mode: 'all' (details + chords) · 'details' · 'off' */
function stemAutofill(mode) {
  const an = STM.an; if (!an) return null; mode = mode || CFG.trackFill || 'all'; if (mode === 'off') return null;
  vhSnap('before loading “' + (STM.title || STM.name) + '”', true);
  const keepWork = songHasWork() && !songIsPristine(), doChords = mode === 'all' && !keepWork && an.chordBars.length >= 2;
  S.title = STM.title || S.title; S.artist = STM.artist || ''; S.bpm = Math.round(an.bpmEff * 100) / 100; S.ts = [4, 4];
  if (an.key) { S.key = an.key.root; S.minor = an.key.minor; S.scale = an.key.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)'; CFG.flats = keepFlats(S.key, S.minor); }
  if (doChords) stemWriteChords();
  S.track = { name: STM.title || STM.name, dur: +STM.dur.toFixed(1), bpm: S.bpm, chords: doChords };
  T.cursor = 0; T.loopA = 0; T.loopB = null; commit(true);
  return { doChords, keepWork };
}
const keepFlats = (k, minor) => { try { return !!keyUsesFlats(k, minor); } catch (e) { return false; } };
function stemWriteChords() {
  const an = STM.an, bars = an.chordBars.map(b => b.chord || '%'); let prev = ''; const clean = bars.map(c => { if (c === '%') return prev || ''; prev = c; return c; });
  S.sections = []; for (let i = 0; i < clean.length; i += 8) S.sections.push(mkSection(i === 0 && an.info[2].first > 12 ? 'Intro' : 'Part ' + (Math.floor(i / 8) + 1), clean.slice(i, i + 8)));
  SEL.sec = 0; SEL.bar = 0; TE.sec = 0; TE.bi = 0;
}

/* ---------- the strip ---------- */
function sbField(label, el, cls) { return h('label', { class: 'sbf ' + (cls || '') }, h('span', {}, label), el); }
function buildSongbar() {
  const el = SB.el = $('#songbar'); if (!el) return;
  const txt = (k, ph, cls, label) => (SB.f[k] = h('input', { class: 'in sb-' + k, placeholder: ph, spellcheck: false, 'aria-label': label, oninput: e => { S[k] = e.target.value; SP.lock = true; commit(false); SP.lock = false; sbChip(); } }));
  SB.f.tun = h('select', { class: 'in sb-tun', 'aria-label': 'Tuning', onchange: e => { const nm = e.target.value; if (nm === '__custom') { sbDetails(SB.f.more, true); sbSync(); return; } setTuning(TUNINGS[nm], nm); } });
  SB.f.capo = h('input', { class: 'in sb-capo', type: 'number', min: 0, max: 12, 'aria-label': 'Capo', onchange: e => { S.capo = clamp(+e.target.value || 0, 0, 12); S.voicePref = {}; commit(); } });
  SB.f.scale = h('select', { class: 'in sb-scale', 'aria-label': 'Scale for overlays', title: 'Scale used for the fretboard and tab overlays', onchange: e => { S.scale = e.target.value; commit(false); bus.emit('scale'); } }, Object.keys(SCALES).map(n => h('option', {}, n)));
  SB.f.more = h('button', { class: 'btn sm', title: 'Notes, custom tuning, per-string tuning…', onclick: () => sbDetails(SB.f.more) }, 'Notes & tuning ▾');
  SB.trk = h('div', { class: 'sb-trk' });
  SB.f.refine = h('button', { class: 'btn sm sb-ref', title: 'Open the Refine panel — chords & lyrics beside whatever you are doing', onclick: () => sideShow('refine') }, '✎ Refine');
  el.append(h('div', { class: 'sb-hex', 'aria-hidden': 'true' }, sv('svg', { viewBox: '0 0 24 24', width: 18, height: 18 }, sv('path', { d: 'M12 2l9 5v10l-9 5-9-5V7z', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }))), sbProject(),
    sbField('Song', txt('title', 'Title', '', 'Song title'), 'f-title'), sbField('Artist', txt('artist', 'Artist / author', '', 'Artist or author'), 'f-artist'),
    sbField('Tuning', SB.f.tun, 'f-tun'), sbField('Capo', SB.f.capo, 'f-capo'), sbField('Scale', SB.f.scale, 'f-scale'), SB.f.more,
    h('span', { class: 'grow' }), SB.trk, zoomCtl(), SB.f.refine);
  bus.on('song', () => { if (SP.lock) return; sbSync(); }); bus.on('track', sbChip); bus.on('scale', sbSync); bus.on('projects', sbChip);
  sbSync();
}
function sbSync() {
  if (!SB.el) return; const act = document.activeElement, set = (el, v) => { if (el && el !== act && el.value !== String(v)) el.value = v; };
  set(SB.f.title, S.title || ''); set(SB.f.artist, S.artist || ''); set(SB.f.capo, S.capo); set(SB.f.scale, S.scale);
  const tn = Object.keys(TUNINGS), names = (TUNINGS[S.tuningName] ? tn : [S.tuningName].concat(tn)), sel = SB.f.tun;
  if (sel !== act) { sel.innerHTML = ''; names.forEach(n => sel.append(h('option', { value: n, selected: n === S.tuningName }, n))); sel.append(h('option', { value: '__custom' }, 'Custom tuning… (set each string)')); sel.value = S.tuningName; }
  if (SB.pop && SB.pop.isConnected && !SP.lock) { const keep = SB.pop.querySelector('textarea') === act; if (!keep) sbDetailsFill(SB.pop); } else SB.pop = null;
  sbChip();
}

/* ---------- details popover: notes + per-string tuning ---------- */
function sbDetailsFill(p) {
  p.innerHTML = '';
  p.append(h('h5', { style: { margin: '0 0 6px' } }, 'Song details'),
    songField('Notes (appear in the export header)', h('textarea', { class: 'in', rows: 3, style: { width: '100%', fontFamily: 'var(--sans)' }, oninput: e => { S.notes = e.target.value; SP.lock = true; commit(false); SP.lock = false; } }, S.notes || '')),
    h('div', { style: { height: '8px' } }), tuningEditor(),
    h('div', { class: 'tiny muted', style: { marginTop: '8px' } }, 'Tempo, key and time signature live in the transport bar above. Title, artist, tuning and capo are used by every export.'));
}
function sbDetails(anchor, openTuning) {
  if (openTuning) TUNED.open = true;
  if (SB.pop && SB.pop.isConnected && openTuning) { sbDetailsFill(SB.pop); return; }
  const box = h('div'); sbDetailsFill(box);
  const p = popover(anchor || SB.f.more, box, { style: { width: '430px', maxWidth: '92vw' }, right: true }); SB.pop = p ? box : null;
}
bus.on('open-tuning-editor', () => sbDetails(SB.f.more, true));

/* ---------- the loaded-track chip ---------- */
function sbChip() {
  if (!SB.trk) return; const t = SB.trk; t.innerHTML = '';
  if (STM.ch) {
    const an = STM.an, k = an && an.key;
    t.append(h('button', { class: 'sb-chip on', title: 'A backing track is loaded and analysed — click for what to do with it', onclick: e => sbTrackPop(e.currentTarget) },
      h('i', { class: 'led' }), h('b', {}, '♪ ' + (STM.title || STM.name)), h('span', { class: 'muted' }, fmtT(STM.dur) + (an ? ' · ' + an.bpmEff.toFixed(0) + ' BPM' + (k ? ' · ' + pcName(k.root) + (k.minor ? 'm' : '') : '') : '')), ' ▾'));
  } else if (STM.busy) {
    t.append(h('span', { class: 'sb-chip busy' }, h('i', { class: 'led warn' }), STM.restoring ? 'Restoring track…' : 'Analysing track…'));
  } else if (PRJ.pending) {
    t.append(h('button', { class: 'sb-chip', title: 'This song has a backing track saved on this device. Tap to split it into stems again (takes a moment).', onclick: () => projRestoreTrack() }, '♪ Restore “' + (PRJ.pending.title || PRJ.pending.name || 'track') + '”'));
  } else {
    t.append(h('button', { class: 'sb-chip', title: 'Load a backing track — it is split into stems and fills in this song (title, tempo, key, chords)', onclick: () => { dockGo('stems'); const f = SU && SU.file; if (f) f.click(); } }, '♪ Load a track…'));
    if (S.track) t.append(h('span', { class: 'tiny muted', title: 'This song was built from a track. Load it again to play along with it.' }, 'from “' + S.track.name + '”'));
  }
}
function sbTrackPop(anchor) {
  const an = STM.an, box = h('div', { style: { display: 'grid', gap: '6px' } });
  box.append(h('h5', { style: { margin: 0 } }, STM.title || STM.name), h('div', { class: 'tiny muted' }, fmtT(STM.dur) + ' · ' + (STM.sr / 1000).toFixed(1) + ' kHz' + (an ? ' · ' + an.info.filter(i => i.found).map(i => i.name.split(' ')[0]).join(', ') + ' found' : '')));
  const row = (label, fn, cls, title) => h('button', { class: 'btn sm ' + (cls || ''), title: title || '', style: { justifyContent: 'flex-start' }, onclick: () => { closePop(); fn(); } }, label);
  box.append(row('⤵ Import chords as the song', stemImportChords, 'primary', 'Replace the song with this chord chart (a snapshot is saved first)'), row('♩ Use tempo + key only', stemApplyTempo, '', 'Set BPM, key and scale from the track'),
    row('▶ Play the band with the track', stemTogether, '', 'Start the band and the track together from bar 1'), row('🎚 Open Stems', () => dockGo('stems')), row('✕ Unload track', stemUnload, 'bad', 'Remove the track from memory'));
  const syncT = h('label', { class: 'lrow' }, h('input', { type: 'checkbox', checked: CFG.trackSync !== false, onchange: e => { CFG.trackSync = e.target.checked; saveCfg(); } }), 'Track follows the transport (play, stop, seek, loop)');
  const fill = h('div', { class: 'lrow' }, h('span', {}, 'When a track loads'), h('select', { class: 'in', style: { flex: 1 }, onchange: e => { CFG.trackFill = e.target.value; saveCfg(); } }, [['all', 'Fill details + chords'], ['details', 'Fill details only'], ['off', 'Do nothing']].map(([v, t]) => h('option', { value: v, selected: (CFG.trackFill || 'all') === v }, t))));
  box.append(h('div', { class: 'hr' }), syncT, fill, h('div', { class: 'tiny muted' }, 'Your own chords, tab and lyrics are never replaced automatically — use “Import chords” when you want that.'));
  popover(anchor, box, { right: true, style: { width: '330px' } });
}

/* >>> parts/22-sides.js */
/* ============================================================
   Part 22 · SIDEBARS AS TAB HOSTS — panels are interchangeable
   Each sidebar is a set of tabs. Tones · I/O · Theory (left) and Monitor · Refine (right) are the defaults, but any of
   them — and any of the 13 centre panels — can live in either sidebar or in the centre. Drag a tab to the other sidebar
   or onto the centre tab strip, right-click it for a menu, or use ⇆ → "Where panels live". Desktop only; phones and
   tablets always use the default homes (their drawers and chips already do the same job).
   ============================================================ */
const SD = { reg: {}, cur: { left: 'io', right: 'monitor' }, nat: { tones: 'left', io: 'left', theory: 'left', monitor: 'right', refine: 'right' }, ready: false };
const SIDE_NAME = { tones: 'Tones', io: 'I/O', theory: 'Theory', monitor: 'Monitor', refine: 'Refine' };
const SIDE_DEFW = { refine: 430, tones: 250, io: 250, theory: 250, monitor: 292 };
LAY.side = LAY.side || {}; LAY.sw = LAY.sw || {}; LAY.so = LAY.so || { left: [], right: [] }; LAY.cc = LAY.cc || {}; if (LAY.sc) Object.assign(SD.cur, LAY.sc);

const isDesk = () => !document.body.dataset.form || document.body.dataset.form === 'desktop';
const natHome = id => SD.nat[id] || 'dock';
function homeOf(id) { if (!isDesk()) return natHome(id); const v = LAY.side[id]; return v === 'left' || v === 'right' || v === 'dock' ? v : natHome(id); }
const sideHosted = id => { const hm = homeOf(id); return hm === 'left' || hm === 'right'; };
const sideVisible = id => { const hm = homeOf(id); return (hm === 'left' || hm === 'right') && SD.cur[hm] === id && (LAY[hm] || !isDesk()); };
const panelName = id => SIDE_NAME[id] || ((DOCK.find(d => d[0] === id) || [0, id])[1]);
const allPanelIds = () => Object.keys(SD.nat).concat(DOCK.map(d => d[0]));

/* ---------- widths: remembered per tab ---------- */
function sideW(side) {
  const id = SD.cur[side]; let w;
  if (id === 'tones' || id === 'io' || id === 'theory') w = LAY.lw; else if (id === 'monitor') w = LAY.rw; else w = LAY.sw[id] || SIDE_DEFW[id] || 460;
  return clamp(w || 250, 170, Math.max(260, Math.min(820, innerWidth - 430)));
}
function setSideW(side, w) {
  const id = SD.cur[side]; w = clamp(Math.round(w), 170, 820);
  if (id === 'tones' || id === 'io' || id === 'theory') LAY.lw = w; else if (id === 'monitor') LAY.rw = w; else LAY.sw[id] = w;
  $('#work').style.setProperty(side === 'left' ? '--lw' : '--rw', sideW(side) + 'px');
}
function resetSideW(side) {
  const id = SD.cur[side]; if (id === 'tones' || id === 'io' || id === 'theory') LAY.lw = 250; else if (id === 'monitor') LAY.rw = 292; else delete LAY.sw[id]; saveLay(); applyLayout();
}

/* ---------- which panels are where ---------- */
function sideIds(side) {
  const all = allPanelIds(), ord = LAY.so[side] || [];
  return all.filter(id => homeOf(id) === side).sort((a, b) => { const ia = ord.indexOf(a), ib = ord.indexOf(b); return (ia < 0 ? 999 + all.indexOf(a) : ia) - (ib < 0 ? 999 + all.indexOf(b) : ib); });
}
function sideTabs(side, ids) {
  const bar = h('div', { class: 'side-tabs', 'data-side': side, role: 'toolbar', 'aria-label': 'Panels' });
  const dropOn = (e, before) => { const t = e.dataTransfer.getData('text/plain'); if (!t.startsWith('tab:')) return; e.preventDefault(); e.stopPropagation(); bar.classList.remove('dropz'); movePanel(t.slice(4), side, before); };
  ids.forEach(id => {
    const b = h('button', {
      class: 'tab' + (id === SD.cur[side] ? ' on' : ''), 'data-id': id, draggable: 'true', title: 'Click: open · drag: move to the other sidebar or the centre · right-click: where does this panel live?',
      onclick: () => sideShow(id), oncontextmenu: e => { e.preventDefault(); placeMenu(b, id); },
      ondragstart: e => { e.dataTransfer.setData('text/plain', 'tab:' + id); e.dataTransfer.effectAllowed = 'move'; b.classList.add('dragging'); }, ondragend: () => b.classList.remove('dragging'),
      ondragover: e => { e.preventDefault(); b.classList.add('dropl'); }, ondragleave: () => b.classList.remove('dropl'), ondrop: e => { b.classList.remove('dropl'); dropOn(e, id); }
    }, panelName(id));
    bar.append(b);
  });
  bar.append(h('span', { class: 'grow' }), h('button', { class: 'tab sidemenu', title: 'Where panels live — move them between the sidebars and the centre', 'aria-label': 'Panel placement', onclick: e => placeMenu(e.currentTarget) }, '⇆'));
  bar.addEventListener('dragover', e => { e.preventDefault(); bar.classList.add('dropz'); }); bar.addEventListener('dragleave', e => { if (!bar.contains(e.relatedTarget)) bar.classList.remove('dropz'); }); bar.addEventListener('drop', e => dropOn(e, null));
  return bar;
}
function sideApply() {
  if (!SD.ready) return;
  ['left', 'right'].forEach(side => {
    const box = $('#' + side); if (!box) return; const ids = sideIds(side); if (!ids.includes(SD.cur[side])) SD.cur[side] = ids[0];
    const bar = sideTabs(side, ids), old = $(':scope > .side-tabs', box); if (old) old.replaceWith(bar); else box.insertBefore(bar, box.firstChild);
    ids.forEach(id => { const r = SD.reg[id]; if (!r) return; if (r.el.parentNode !== box) box.append(r.el); r.el.classList.toggle('on', id === SD.cur[side]); });
    box.dataset.cur = SD.cur[side] || '';
  });
  const dock = $('#dock'); DOCK.forEach(([id]) => { if (homeOf(id) !== 'dock') return; const p = PANES[id]; if (p && !FLOATS.has(id) && p.parentNode !== dock) { dock.append(p); p.classList.toggle('on', DOCK.cur === id); } });
  LAY.sc = { left: SD.cur.left, right: SD.cur.right };
}
function sideShow(id) {
  const hm = homeOf(id); if (hm === 'dock') { dockGo(id); return; }
  if (isDesk() && !LAY[hm]) { LAY[hm] = true; }
  SD.cur[hm] = id; sideApply(); saveLay(); applyLayout(); bus.emit('dock', id); setTimeout(() => window.dispatchEvent(new Event('resize')), 30);
  if (hm === 'right' && isDesk()) rightPeek(true);
}
/* a desktop-form window narrower than 1180px has no room for the right sidebar; open it as an overlay on demand */
function rightPeek(on) { const narrow = innerWidth <= 1180; document.body.classList.toggle('right-open', !!on && narrow); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('right-open') && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) rightPeek(false); });
document.addEventListener('pointerdown', e => { if (document.body.classList.contains('right-open') && !e.target.closest('#right,#songbar,.pop')) rightPeek(false); }, true);
function movePanel(id, to, before) {
  if (!SD.reg[id] && !PANES[id]) return false;
  if (!isDesk()) { toast('Panels can be rearranged in a desktop-size window. Phones and tablets keep the default places.', 'warn'); return false; }
  if (to === 'dock' && SD.nat[id]) { toast(panelName(id) + ' lives in the sidebars — move it to the other side instead.', 'warn'); return false; }
  if (FLOATS.has(id)) unfloat(id);
  const was = homeOf(id); if (to === natHome(id)) delete LAY.side[id]; else LAY.side[id] = to;
  ['left', 'right'].forEach(sd => { LAY.so[sd] = (LAY.so[sd] || []).filter(x => x !== id); });
  if (to === 'left' || to === 'right') { const arr = sideIds(to).filter(x => x !== id); const i = before ? arr.indexOf(before) : -1; if (i >= 0) arr.splice(i, 0, id); else arr.push(id); LAY.so[to] = arr; SD.cur[to] = id; if (!LAY[to]) LAY[to] = true; }
  if (was === 'left' || was === 'right') { const rest = sideIds(was); if (SD.cur[was] === id) SD.cur[was] = rest[0]; }
  sideApply(); rebuildTabs();
  if (DOCK.cur === id && to !== 'dock') { const nx = dockVisible().find(d => !FLOATS.has(d[0])); if (nx) dockGo(nx[0]); }
  if (to === 'dock') dockGo(id);
  saveLay(); applyLayout(); bus.emit('dock', id); setTimeout(() => window.dispatchEvent(new Event('resize')), 40); return true;
}
function swapSides() {
  if (!isDesk()) return;
  const flip = id => { const hm = homeOf(id); if (hm === 'left' || hm === 'right') { const nw = hm === 'left' ? 'right' : 'left'; if (nw === natHome(id)) delete LAY.side[id]; else LAY.side[id] = nw; } };
  const lo = sideIds('left'), ro = sideIds('right'); allPanelIds().forEach(flip); LAY.so = { left: ro.slice(), right: lo.slice() };
  const c = SD.cur.left; SD.cur.left = SD.cur.right; SD.cur.right = c; const a = LAY.left; LAY.left = LAY.right; LAY.right = a;
  sideApply(); rebuildTabs(); saveLay(); applyLayout(); setTimeout(() => window.dispatchEvent(new Event('resize')), 40);
}
function sideReset() { LAY.side = {}; LAY.sw = {}; LAY.so = { left: [], right: [] }; LAY.cc = {}; SD.cur = { left: 'io', right: 'monitor' }; sideApply(); $$('#left .card, #right .card').forEach(c => c.classList.remove('cc')); }

/* ---------- "where panels live" menu ---------- */
function placeMenu(anchor, focusId) {
  const box = h('div', { style: { minWidth: '300px' } }); box.append(h('h5', {}, 'Where panels live'));
  const row = id => {
    const hm = homeOf(id), nat = !!SD.nat[id], seg = h('div', { class: 'seg place' }, [['left', 'Left'], ['dock', 'Centre'], ['right', 'Right']].map(([v, t]) => h('button', { class: hm === v ? 'on' : '', disabled: nat && v === 'dock', title: nat && v === 'dock' ? 'Sidebar-only panel' : 'Move ' + panelName(id) + ' here', onclick: () => { movePanel(id, v); closePop(); } }, t)));
    return h('div', { class: 'lrow place-row' + (id === focusId ? ' hl' : '') }, h('span', { class: 'grow' }, panelName(id)), seg);
  };
  box.append(h('div', { class: 'tiny muted', style: { margin: '0 0 6px' } }, 'Sidebar panels'), ...Object.keys(SD.nat).map(row), h('div', { class: 'tiny muted', style: { margin: '8px 0 4px' } }, 'Centre panels'), ...DOCK.map(d => row(d[0])));
  box.append(h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn sm', onclick: () => { swapSides(); closePop(); } }, '⇄ Swap the sidebars'), h('button', { class: 'btn sm', onclick: () => { cardsAll(true); closePop(); } }, 'Collapse cards'), h('button', { class: 'btn sm', onclick: () => { cardsAll(false); closePop(); } }, 'Expand cards'),
    h('button', { class: 'btn sm', onclick: () => { [...allPanelIds()].forEach(id => { if (LAY.side[id]) delete LAY.side[id]; }); LAY.so = { left: [], right: [] }; sideReset(); rebuildTabs(); saveLay(); applyLayout(); closePop(); } }, 'Reset places')));
  popover(anchor, box, { style: { maxWidth: '380px' }, right: true });
}

/* ---------- collapsible config cards in the sidebars (so every option can be reached) ---------- */
function cardify(pane, pid) {
  [...pane.children].filter(c => c.classList && c.classList.contains('card')).forEach((c, i) => {
    const hd = c.firstElementChild; if (!hd || hd.tagName !== 'H4' || c._cardified) return; c._cardified = true; const key = pid + ':' + i;
    c.classList.toggle('cc', !!LAY.cc[key]); hd.classList.add('collap'); hd.title = 'Click to collapse / expand this card';
    hd.addEventListener('click', e => { if (e.target.closest('button,select,input,a,.led')) return; c.classList.toggle('cc'); LAY.cc[key] = c.classList.contains('cc'); saveLay(); });
  });
}
function cardsAll(collapse) {
  $$('#left .pane .card, #right .pane .card').forEach(c => { if (!c._cardified && !c.dataset.card) return; c.classList.toggle('cc', collapse); });
  Object.keys(LAY.cc).forEach(k => { LAY.cc[k] = collapse; }); ['io', 'theory'].forEach(pid => { const p = SD.reg[pid] && SD.reg[pid].el; if (p) [...p.children].filter(c => c.classList.contains('card')).forEach((c, i) => { LAY.cc[pid + ':' + i] = collapse; }); });
  RCARDS.forEach(n => { LAY.rc.col[n] = collapse; }); saveLay();
}

/* ---------- build ---------- */
function buildSides() {
  const lp = $$('#left > .pane'); ['tones', 'io', 'theory'].forEach((id, i) => { if (lp[i]) { lp[i].dataset.pane = id; SD.reg[id] = { id, el: lp[i], native: true }; } });
  if (UI.monPane) { UI.monPane.dataset.pane = 'monitor'; SD.reg.monitor = { id: 'monitor', el: UI.monPane, native: true }; }
  UI.refinePane = h('div', { class: 'pane', 'data-pane': 'refine' }, UI.refineBox); SD.reg.refine = { id: 'refine', el: UI.refinePane, native: true };
  DOCK.forEach(([id]) => { if (PANES[id]) SD.reg[id] = { id, el: PANES[id], native: false }; });
  cardify(SD.reg.io.el, 'io'); cardify(SD.reg.theory.el, 'theory');
  SD.ready = true; sideApply();
  // drop a tab anywhere on a sidebar to move it there; drop on the centre tab strip to bring it back
  [['left', $('#left')], ['right', $('#right')]].forEach(([side, el]) => {
    el.addEventListener('dragover', e => { if (!isDesk() || ![...e.dataTransfer.types].includes('text/plain')) return; e.preventDefault(); el.classList.add('dropzone'); }); el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('dropzone'); });
    el.addEventListener('drop', e => { el.classList.remove('dropzone'); const t = e.dataTransfer.getData('text/plain'); if (t.startsWith('tab:')) { e.preventDefault(); movePanel(t.slice(4), side); } });
  });
  bus.on('form', () => { sideApply(); rebuildTabs(); applyLayout(); });
}

/* >>> parts/23-lanes.js */
/* ============================================================
   Part 23 · DAW LANES — the arrangement behaves like a regular DAW's track list
   Lanes (band instruments, the loaded backing track and its four stems, your Guitar and Vocal inputs, recorded takes)
   can be reordered by dragging their grip, resized by dragging their bottom edge, recoloured, hidden and re-added.
   Guitar and Vocal lanes have an arm button; R records every armed lane at once, sample-aligned.
   ============================================================ */
const LN = Object.assign({ order: [], h: {}, hide: {}, col: {}, scale: 1, hw: 188 }, CFG.lanes || {});
const saveLn = () => { CFG.lanes = LN; saveCfg(); };
const VOX_COL = '#ff5fa2', LANE_COLS = ['#0a9aa6', '#e4572e', '#8a5cf5', '#e0a31a', '#2e9d57', '#ff5fa2', '#3b82f6', '#9aa5a6'];
STM.vol = 1; STM.mute = false;
const BANDMAP = { drums: 'drumsOn', bass: 'bassOn', rhythm: 'compOn', lead: 'leadOn' };
const STEM_SHORT = ['Drums', 'Bass', 'Vocals', 'Gtr · keys'];
const LANE_H = [['S', 30], ['M', 46], ['L', 72], ['XL', 112]];

/* ---------- which lanes exist, in what order, how tall ---------- */
function tlAll() {
  const c = TL.col.cv || LANE_COLS, L = {}, add = o => { L[o.id] = Object.assign(o, { c: LN.col[o.id] || o.c }); };
  if (STM.ch) { add({ id: 'trk', name: 'Track', type: 'trk', c: '#7f9a9c', dh: 46 }); STMS.forEach(([, , col], i) => add({ id: 'stem:' + i, name: '♪ ' + STEM_SHORT[i], type: 'stem', idx: i, c: col, dh: 34 })); }
  add({ id: 'rhythm', name: 'Rhythm Gtr', type: 'chords', c: c[0] }); add({ id: 'lead', name: 'Lead / Tab', type: 'tab', c: c[3] }); add({ id: 'bass', name: 'Bass', type: 'bass', c: c[2] }); add({ id: 'drums', name: 'Drums', type: 'drums', c: c[1] });
  add({ id: 'live', name: 'Guitar', type: 'live', c: c[4], dh: 52 }); add({ id: 'vox', name: 'Vocal', type: 'vox', c: VOX_COL, dh: 52 });
  TAKES.forEach(tk => add({ id: 'take:' + tk.id, name: tk.name, type: 'take', take: tk, c: tk.kind === 'vox' ? VOX_COL : c[4] }));
  return L;
}
function laneDefaultOrder(L) {
  const o = ['trk', 'stem:0', 'stem:1', 'stem:2', 'stem:3', 'rhythm', 'lead', 'bass', 'drums', 'live']; TAKES.filter(t => t.kind !== 'vox').forEach(t => o.push('take:' + t.id)); o.push('vox'); TAKES.filter(t => t.kind === 'vox').forEach(t => o.push('take:' + t.id));
  return o.filter(id => L[id]);
}
/** every lane (hidden ones too) in display order */
function tlOrder() {
  const L = tlAll(), def = laneDefaultOrder(L), ord = LN.order.filter(id => L[id]);
  def.forEach((id, i) => { if (ord.includes(id)) return; let at = 0; for (let j = i - 1; j >= 0; j--) { const k = ord.indexOf(def[j]); if (k >= 0) { at = k + 1; break; } } ord.splice(at, 0, id); });
  return ord.map(id => L[id]);
}
const tlLanes = () => tlOrder().filter(l => !LN.hide[l.id]);
const laneH = l => clamp(Math.round((LN.h[l.id] || l.dh || TL.lh) * LN.scale), 24, 300);
function tlLayout() {
  const ls = tlLanes(), top = TL.rh + TL.sh; let y = top; const out = ls.map(l => { const hh = laneH(l), o = { l, y, h: hh }; y += hh; return o; });
  return { top, ls: out, end: y };
}
function laneAt(y) { const LY = tlLayout(); return LY.ls.find(o => y >= o.y && y < o.y + o.h) || null; }

/* ---------- lane head (the track header) ---------- */
function bt(label, cls, title, fn) { return h('button', { class: cls || '', title: title || '', onclick: fn }, label); }
function laneMove(id, beforeId, after) {
  const ids = tlOrder().map(l => l.id).filter(x => x !== id); let i = beforeId ? ids.indexOf(beforeId) : ids.length; if (i < 0) i = ids.length; if (after) i++; ids.splice(i, 0, id); LN.order = ids; saveLn(); renderHeads(); TL.dirty = true;
}
function laneStep(id, d) { const ids = tlOrder().map(l => l.id), i = ids.indexOf(id), j = i + d; if (i < 0 || j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; LN.order = ids; saveLn(); renderHeads(); TL.dirty = true; }
function laneSetH(id, px) { LN.h[id] = clamp(Math.round(px / LN.scale), 24, 300); saveLn(); }
function renderHeads() {
  if (!UI.heads) return; const hd = UI.heads, keep = hd.scrollTop; hd.innerHTML = ''; UI.lm = {};
  hd.append(h('div', { class: 'tl-corner', style: { height: (TL.rh + TL.sh) + 'px' } }, tunShort() + ' · ' + S.ts.join('/')));
  tlLayout().ls.forEach(({ l, h: hh }) => {
    const cmp = hh < 40, box = h('div', { class: 'tl-head ' + l.type + (cmp ? ' cmp' : ''), 'data-id': l.id, style: { height: hh + 'px' } });
    const grip = h('span', { class: 'grip', draggable: 'true', title: 'Drag to reorder this lane', ondragstart: e => { e.dataTransfer.setData('text/plain', 'lane:' + l.id); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setDragImage(box, 12, 12); } catch (er) { } box.classList.add('dragging'); }, ondragend: () => box.classList.remove('dragging') }, '⠿');
    box.addEventListener('dragover', e => { if (![...e.dataTransfer.types].includes('text/plain')) return; e.preventDefault(); const r = box.getBoundingClientRect(); box.classList.toggle('dropa', e.clientY < r.top + r.height / 2); box.classList.toggle('dropb', e.clientY >= r.top + r.height / 2); });
    box.addEventListener('dragleave', () => box.classList.remove('dropa', 'dropb'));
    box.addEventListener('drop', e => { const t = e.dataTransfer.getData('text/plain'); box.classList.remove('dropa', 'dropb'); if (!t.startsWith('lane:')) return; e.preventDefault(); const r = box.getBoundingClientRect(); laneMove(t.slice(5), l.id, e.clientY >= r.top + r.height / 2); });
    const more = bt('⋯', 'more', 'Lane options: height, colour, order, hide', e => laneMenu(e.currentTarget, l));
    const name = h('span', { class: 'nm', title: l.name, ondblclick: () => { if (l.type === 'take') return laneRename(l, name); LN.h[l.id] = hh <= 34 ? (l.dh || 46) : 28; saveLn(); renderHeads(); TL.dirty = true; } }, l.name);
    const t = h('div', { class: 't' }, grip, h('span', { class: 'sw', style: { background: l.c } }), name);
    const b = h('div', { class: 'b' }); const m = l.type === 'trk' || l.type === 'stem' || l.type === 'take' ? null : (S.mix[l.id] || (S.mix[l.id] = { g: 1, p: 0, m: 0, s: 0 }));
    const lm = () => { const el = h('div', { class: 'lmeter', title: 'Input level' }, h('i')); UI.lm[l.id] = el.firstChild; return el; };
    const mute = (get, set) => bt('M', 'mute' + (get() ? ' on' : ''), 'Mute', e => { set(!get()); e.target.classList.toggle('on', !!get()); });
    const solo = (get, set) => bt('S', get() ? 'on' : '', 'Solo', e => { set(!get()); e.target.classList.toggle('on', !!get()); });
    const vol = (get, set, max, def, title) => h('input', { type: 'range', min: 0, max: max || 1.4, step: .01, value: get(), title: title || 'Volume (double-click: reset)', oninput: e => set(+e.target.value), ondblclick: e => { set(def == null ? .8 : def); e.target.value = def == null ? .8 : def; } });
    if (l.type === 'live') {
      t.append(h('span', { class: 'tag', title: 'Which interface input feeds the guitar (change it in I/O ▸ Channels)' }, (() => { const r = chRoles(); return r[0] === 'g' && r[1] === 'g' ? 'In 1+2' : r[0] === 'g' ? 'In 1' : r[1] === 'g' ? 'In 2' : 'Off'; })()), more);
      b.append(bt('●', 'arm' + (armedG() ? ' on' : ''), 'Arm the guitar for recording (dry DI + wet print)', e => { CFG.armG = !armedG(); saveCfg(); e.currentTarget.classList.toggle('on', armedG()); TL.dirty = true; }),
        bt('🎧', CFG.monitor ? 'on' : '', 'Hear the guitar through the app (use headphones; or use the interface’s Direct Monitor)', e => { setMonitor(!CFG.monitor); e.currentTarget.classList.toggle('on', CFG.monitor); }), lm(), vol(() => m.g, v => { m.g = v; applyMix(); }, 1.4, 1, 'Guitar monitor level'));
    } else if (l.type === 'vox') {
      const sel = h('select', { class: 'vin', title: 'Which interface input is the vocal microphone', onchange: e => { setVoxInput(e.target.value); } }, [['off', 'Off'], ['R', 'In 2'], ['L', 'In 1']].map(([v, tx]) => h('option', { value: v, selected: CFG.vin === v }, tx)));
      t.append(sel, more);
      b.append(bt('●', 'arm' + (armedV() ? ' on' : ''), 'Arm the vocal for recording', e => { if (CFG.vin === 'off') { setVoxInput('R'); } else { CFG.armV = !armedV(); saveCfg(); } e.currentTarget.classList.toggle('on', armedV()); TL.dirty = true; }),
        bt('🎧', CFG.voxMon ? 'on' : '', 'Hear the vocal through the app — headphones only, or the microphone will feed back', e => { CFG.voxMon = !CFG.voxMon; saveCfg(); applyMix(); e.currentTarget.classList.toggle('on', CFG.voxMon); }), lm(),
        mute(() => m.m, v => { m.m = v ? 1 : 0; applyMix(); commit(false); }), solo(() => m.s, v => { m.s = v ? 1 : 0; applyMix(); commit(false); }), vol(() => m.g, v => { m.g = v; applyMix(); }, 1.4, 1, 'Vocal track level'));
    } else if (l.type === 'take') {
      const tk = l.take; const vx = tk.kind === 'vox'; t.append(more);
      b.append(bt('⤓', 'dl', 'Save this recording as a WAV file on your device', () => dlTake(tk)), mute(() => tk.mute, v => { tk.mute = v; takeLive(tk); }), solo(() => tk.solo, v => { tk.solo = v; takeLive(tk); }),
        vx ? null : bt('RE-AMP', tk.mode === 'reamp' ? 'on' : '', 'Re-amp: play the dry DI through the CURRENT rig. Off: the wet print as recorded.', e => { tk.mode = tk.mode === 'reamp' ? 'wet' : 'reamp'; e.currentTarget.classList.toggle('on', tk.mode === 'reamp'); if (tk.mode === 'reamp' && !tk.dry) tk.mode = 'wet'; toast(tk.mode === 'reamp' ? 'Re-amp: playing dry DI through the live rig' : 'Playing the wet print as recorded'); }),
        vol(() => tk.g, v => { tk.g = v; takeLive(tk); }, 1.5, 1, 'Take volume'), h('input', { type: 'range', min: -1, max: 1, step: .05, value: tk.pan || 0, title: 'Pan', style: { width: '40px', flex: 'none' }, oninput: e => { tk.pan = +e.target.value; takeLive(tk); } }));
    } else if (l.type === 'trk') {
      t.append(h('span', { class: 'tag', title: 'The loaded backing track' }, fmtT(STM.dur)), more);
      b.append(mute(() => STM.mute, v => { STM.mute = v; spBus(); }), bt('⟲ sync', CFG.trackSync !== false ? 'on' : '', 'Track follows the transport: play / stop / seek / loop move the track with the arrangement', e => { CFG.trackSync = CFG.trackSync === false; saveCfg(); e.currentTarget.classList.toggle('on', CFG.trackSync !== false); }),
        vol(() => STM.vol, v => { STM.vol = v; spBus(); }, 1.5, 1, 'Whole-track level'));
    } else if (l.type === 'stem') {
      const sm = STM.mix[l.idx]; t.append(more);
      b.append(bt('⤓', 'dl', 'Save this stem as a WAV file', () => stemExport(l.idx)), mute(() => sm.m, v => { sm.m = v; spGains(); renderStemStrips(); TL.dirty = true; }), solo(() => sm.s, v => { sm.s = v; spGains(); renderStemStrips(); TL.dirty = true; }), vol(() => sm.g, v => { sm.g = v; spGains(); }, 1.5, 1, 'Stem level'));
    } else {
      t.append(more); const key = BANDMAP[l.id];
      b.append(key ? bt('⤓', 'dl', 'Save just this part as a WAV (plays the song once in real time)', () => bouncePart(l.id)) : null, key ? h('button', { class: 'pw' + (S.band[key] ? ' on' : ''), 'data-k': key, title: 'Enable / disable this instrument in the band', onclick: () => toggleBand(key) }, '⏻') : null,
        mute(() => m.m, v => { m.m = v ? 1 : 0; applyMix(); commit(false); }), solo(() => m.s, v => { m.s = v ? 1 : 0; applyMix(); commit(false); }), vol(() => m.g, v => { m.g = v; applyMix(); }),
        h('input', { type: 'range', min: -1, max: 1, step: .05, value: m.p, title: 'Pan', style: { width: '40px', flex: 'none' }, oninput: e => { m.p = +e.target.value; applyMix(); } }));
    }
    if (cmp && l.type !== 'live' && l.type !== 'vox') { box.append(t); [...b.children].filter(x => x && (x.classList.contains('mute') || x.title === 'Solo' || x.classList.contains('pw'))).forEach(x => t.insertBefore(x, t.lastChild)); }
    else if (cmp) { box.append(t); [...b.children].filter(x => x && x.classList.contains('arm')).forEach(x => t.insertBefore(x, t.lastChild)); }
    else box.append(t, b);
    const rs = h('div', { class: 'lgrip', title: 'Drag to resize this lane · double-click to reset' });
    rs.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); rs.setPointerCapture(e.pointerId); const y0 = e.clientY, h0 = hh; const mv = ev => { const nh = clamp(h0 + ev.clientY - y0, 24, 300); LN.h[l.id] = Math.round(nh / LN.scale); box.style.height = nh + 'px'; TL.dirty = true; tlSize(); }; const up = () => { rs.removeEventListener('pointermove', mv); rs.removeEventListener('pointerup', up); saveLn(); renderHeads(); }; rs.addEventListener('pointermove', mv); rs.addEventListener('pointerup', up); });
    rs.addEventListener('dblclick', () => { delete LN.h[l.id]; saveLn(); renderHeads(); tlSize(); });
    box.append(rs); hd.append(box);
  });
  hd.scrollTop = keep;
}
function laneRename(l, el) {
  const tk = l.take, inp = h('input', { class: 'in', value: tk.name, style: { width: '100%', height: '18px', fontSize: '11px' }, onblur: () => { tk.name = inp.value.trim() || tk.name; renderHeads(); TL.dirty = true; }, onkeydown: e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = tk.name; inp.blur(); } } });
  el.replaceWith(inp); inp.focus(); inp.select();
}
function laneMenu(anchor, l) {
  const box = h('div', { style: { minWidth: '230px' } }); box.append(h('h5', {}, l.name));
  const hh = laneH(l);
  box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '54px' } }, 'Height'), h('div', { class: 'seg' }, LANE_H.map(([n, px]) => h('button', { class: Math.abs(hh - px * LN.scale) < 8 ? 'on' : '', onclick: () => { laneSetH(l.id, px * LN.scale); closePop(); renderHeads(); tlSize(); } }, n)))));
  box.append(h('div', { class: 'lrow' }, h('span', { style: { width: '54px' } }, 'Colour'), h('div', { class: 'swatches' }, LANE_COLS.map(c => h('button', { class: 'swatch' + (c === l.c ? ' on' : ''), style: { background: c }, 'aria-label': c, onclick: () => { LN.col[l.id] = c; saveLn(); closePop(); renderHeads(); TL.dirty = true; } })))));
  box.append(h('div', { class: 'row', style: { gap: '6px', margin: '4px 0' } }, h('button', { class: 'btn sm', onclick: () => { laneStep(l.id, -1); closePop(); } }, '↑ Up'), h('button', { class: 'btn sm', onclick: () => { laneStep(l.id, 1); closePop(); } }, '↓ Down'),
    h('button', { class: 'btn sm', onclick: () => { LN.hide[l.id] = true; saveLn(); closePop(); renderHeads(); tlSize(); } }, 'Hide')));
  if (BANDMAP[l.id]) box.append(h('div', { class: 'row', style: { gap: '6px', marginTop: '4px' } }, h('button', { class: 'btn sm', title: 'Plays the song once in real time with only this part on, and saves it', onclick: () => { closePop(); bouncePart(l.id); } }, '⤓ Save this part (WAV)')));
  if (l.type === 'stem') box.append(h('div', { class: 'row', style: { gap: '6px', marginTop: '4px' } }, h('button', { class: 'btn sm', onclick: () => { closePop(); stemExport(l.idx); } }, '⤓ Save this stem (WAV)')));
  if (l.type === 'take') box.append(h('div', { class: 'row', style: { gap: '6px' } }, h('button', { class: 'btn sm', onclick: () => { closePop(); dlTake(l.take); } }, '⤓ WAV'), h('button', { class: 'btn sm', onclick: () => { closePop(); const i = TAKES.indexOf(l.take); if (i >= 0) TAKES.splice(i, 1); bus.emit('takes'); } }, '✕ Delete take'), h('button', { class: 'btn sm', onclick: () => { closePop(); dockGo('tx'); TX.src = l.take.id; txRefreshSrc(); } }, '♬ Transcribe')));
  if (l.type === 'trk') box.append(h('div', { class: 'row', style: { gap: '6px' } }, h('button', { class: 'btn sm', onclick: () => { closePop(); dockGo('stems'); } }, 'Open Stems'), h('button', { class: 'btn sm bad', onclick: () => { closePop(); stemUnload(); } }, '✕ Unload')));
  if (l.type === 'live' || l.type === 'vox') box.append(h('div', { class: 'tiny muted', style: { marginTop: '4px' } }, 'Input routing and the vocal strip are in the I/O panel (left).'), h('button', { class: 'btn sm', style: { marginTop: '4px' }, onclick: () => { closePop(); sideShow('io'); } }, 'Open I/O'));
  popover(anchor, box, { style: { maxWidth: '320px' } });
}
/** + Track / Lanes manager: show hidden lanes, re-order, reset */
function lanesMenu(anchor) {
  const box = h('div', { style: { minWidth: '290px' } }); box.append(h('h5', {}, 'Lanes'));
  const quick = h('div', { class: 'row', style: { gap: '6px', marginBottom: '8px' } },
    h('button', { class: 'btn sm primary', title: 'Show the vocal lane and route the second input to it', onclick: () => { delete LN.hide.vox; delete LN.hide.live; saveLn(); if (CFG.vin === 'off') setVoxInput('R'); closePop(); renderHeads(); tlSize(); } }, '🎤 Add vocal'),
    h('button', { class: 'btn sm', onclick: () => { delete LN.hide.live; saveLn(); closePop(); renderHeads(); tlSize(); } }, '🎸 Add guitar'),
    h('button', { class: 'btn sm', onclick: () => { closePop(); dockGo('stems'); if (SU.file) SU.file.click(); } }, '♪ Load track…'));
  box.append(quick);
  tlOrder().forEach(l => box.append(h('div', { class: 'lrow' }, h('input', { type: 'checkbox', checked: !LN.hide[l.id], onchange: e => { if (e.target.checked) delete LN.hide[l.id]; else LN.hide[l.id] = true; saveLn(); renderHeads(); tlSize(); } }), h('i', { class: 'sw', style: { background: l.c, width: '8px', height: '14px', borderRadius: '2px' } }), h('span', { class: 'grow' }, l.name),
    h('button', { class: 'btn sm', style: { padding: '0 6px' }, onclick: () => { laneStep(l.id, -1); lanesMenu(anchor); lanesMenu(anchor); } }, '↑'), h('button', { class: 'btn sm', style: { padding: '0 6px' }, onclick: () => { laneStep(l.id, 1); lanesMenu(anchor); lanesMenu(anchor); } }, '↓'))));
  box.append(h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn sm', onclick: () => { LN.order = []; LN.h = {}; LN.hide = {}; LN.col = {}; LN.scale = 1; saveLn(); closePop(); renderHeads(); tlSize(); } }, 'Reset lanes')));
  popover(anchor, box, { right: true, style: { maxHeight: '70vh' } });
}
function laneScale(d) { LN.scale = clamp(+(LN.scale + d).toFixed(2), .6, 2.4); saveLn(); renderHeads(); tlSize(); }

/* ---------- loaded-track lanes: high-resolution envelopes aligned to the bar grid ---------- */
const trkT0 = () => (STM.an && STM.an.beats && STM.an.beats.length ? STM.an.beats[STM.an.down] / STM.an.fps : 0);
function stemLaneEnv() {
  if (STM.envL || !STM.ch) return STM.envL; const dt = .02, n = Math.max(1, Math.ceil(STM.dur / dt)), sr = STM.sr, win = Math.max(1, Math.floor(sr * dt)), step = Math.max(1, Math.floor(win / 24)), mix = new Float32Array(n);
  const a = STMS.map((_, i) => { const d = spData(i), o = new Float32Array(n); for (let w = 0; w < n; w++) { let m = 0; const a0 = w * win; for (let c = 0; c < d.length; c++) { if (c && d[c] === d[0]) break; const x = d[c], b1 = Math.min(x.length, a0 + win); for (let k = a0; k < b1; k += step) { const v = x[k] < 0 ? -x[k] : x[k]; if (v > m) m = v; } } o[w] = m / 32768; if (o[w] > mix[w]) mix[w] = o[w]; } return o; });
  const nrm = arr => { const s = Float32Array.from(arr).sort(); const p = s[Math.floor(s.length * .995)] || 1e-4; return Math.max(p, 1e-3); };
  return STM.envL = { dt, n, a, mix, sc: a.map(nrm), scm: nrm(mix) };
}
bus.on('track', () => { STM.envL = null; renderHeads(); tlSize(); });
/** the two per-input level meters in I/O ▸ Channels */
function chMeters() {
  if (!UI.chM || !E.anaL) return;
  [E.anaL, E.anaR].forEach((an, i) => { const bar = UI.chM[i]; if (!bar || !bar.isConnected) return; const b = (UI.chBuf || (UI.chBuf = new Float32Array(1024))); an.getFloatTimeDomainData(b); let e = 0; for (let k = 0; k < b.length; k++) e += b[k] * b[k]; bar.style.width = dbw(dB(Math.sqrt(e / b.length))); });
}
function spBus() { if (!STP.bus) return; tc(STP.bus.gain, STM.mute ? 0 : (STM.vol == null ? 1 : STM.vol), .015); }

/* ---------- drawing ---------- */
function laneBg(g, V) {
  const { ox, vw, C, LY } = V;
  LY.ls.forEach(({ y, h: hh }, i) => { g.fillStyle = i % 2 ? C.bg2 : C.bg; g.globalAlpha = i % 2 ? .45 : 1; g.fillRect(ox, y, vw, hh); g.globalAlpha = 1; g.fillStyle = C.line; g.fillRect(ox, y + hh - 1, vw, 1); });
}
function drawLanes(g, V) {
  const { ox, vw, sw, sp, b0, b1, fb, C, sans, LY } = V, cache = tlCache(), hasRec = !!REC;
  LY.ls.forEach(({ l, y, h: hh }) => {
    const ph = hh - 8, mid = y + hh / 2;
    if (l.type === 'chords') fb.forEach(f => {
      if (f.idx < b0 || f.idx > b1) return; const cs = barChords(f.bar), n = Math.max(1, cs.length), x = f.idx * TL.bw;
      cs.forEach((c, k) => { const cx = x + k * TL.bw / n; g.fillStyle = l.c; g.globalAlpha = .22; g.fillRect(cx + 2, y + 4, TL.bw / n - 4, ph); g.globalAlpha = 1; g.strokeStyle = l.c; g.strokeRect(cx + 2.5, y + 4.5, TL.bw / n - 5, ph - 1); if (hh >= 30) { g.fillStyle = C.text; g.font = '800 ' + (hh >= 40 ? 13 : 11) + 'px ui-monospace,Menlo,Consolas,monospace'; g.fillText(c, cx + 8, mid); } });
      if (SEL.sec === f.si && SEL.bar === f.bi) { g.strokeStyle = C.accent2; g.lineWidth = 2; g.strokeRect(x + 1, y + 2, TL.bw - 2, hh - 5); g.lineWidth = 1; }
    });
    else if (l.type === 'tab') fb.forEach(f => { if (f.idx < b0 || f.idx > b1) return; f.bar.tab.forEach(n => { const m = n.f === 'x' ? S.tuning[n.st] : noteMidi(n), yy = y + hh - 6 - clamp((m - 38) / 40, 0, 1) * (hh - 12); g.fillStyle = l.c; g.fillRect(f.idx * TL.bw + n.s * sw + 1, yy, Math.max(3, sw * 1.8), 3.5); }); });
    else if (l.type === 'bass') cache.bass.forEach(n => { const b = Math.floor(n.s / sp); if (b < b0 || b > b1) return; const yy = y + hh - 7 - clamp((n.m - 28) / 24, 0, 1) * (hh - 14); g.fillStyle = l.c; g.fillRect(n.s * sw + 1, yy, Math.max(3, n.len * sw - 2), 4); });
    else if (l.type === 'drums' && S.band.drumsOn) { const pat = dpat(), L = Math.min(S.band.drumLen || 16, 32), rowsY = [.78, .5, .22, .22, .36, .6]; for (let bi = b0; bi <= b1; bi++) for (let s = 0; s < sp; s++) pat.forEach((row, r) => { const v = row[s % L]; if (!v) return; g.fillStyle = l.c; g.globalAlpha = .35 + .2 * v; g.fillRect(bi * TL.bw + s * sw + 1, y + hh * rowsY[r] - 2, Math.max(2, sw - 2), 4); g.globalAlpha = 1; }); }
    else if (l.type === 'live' || l.type === 'vox') {
      const vox = l.type === 'vox', armed = vox ? armedV() : armedG(), rec = hasRec && (vox ? REC.v : REC.g);
      if (armed) { g.fillStyle = '#e5484d'; g.globalAlpha = rec ? .1 : .045; g.fillRect(ox, y, vw, hh - 1); g.globalAlpha = 1; g.fillStyle = '#e5484d'; g.fillRect(ox, y, 3, hh - 1); }
      if (rec) {
        const pk = vox ? REC.pkV : REC.pkG, x0 = REC.startSec / slotDur() * sw, cw = 1024 / E.ctx.sampleRate / slotDur() * sw, amp = hh / 2 - 4, n = pk.length / 2; g.fillStyle = '#e5484d'; g.globalAlpha = .85;
        for (let k = Math.max(0, Math.floor((ox - x0) / cw)); k < n; k++) { const x = x0 + k * cw; if (x > ox + vw) break; const mn = pk[k * 2], mx = pk[k * 2 + 1]; g.fillRect(x, mid - mx * amp * 2.2, Math.max(1, cw), Math.max(1, (mx - mn) * amp * 2.2)); } g.globalAlpha = 1;
      }
      if (hh >= 30 || !rec) {
        g.fillStyle = C.muted; g.font = sans; const msg = !E.hasInput ? 'no input open — choose one in I/O' : vox ? (CFG.vin === 'off' ? 'vocal input is off — pick In 2 (or arm ●) to record vocals with the guitar' : rec ? '● recording vocal…' : armed ? 'armed · input ' + (CFG.vin === 'R' ? '2' : '1') + ' · press R to record' : 'not armed')
          : (rec ? '● recording dry DI + wet print…' : armed ? 'armed · press R to record (count-in ' + CFG.countIn + ' bar)' : 'not armed — click ● to arm'); g.fillText(msg, ox + 12, y + (hh >= 40 ? hh - 12 : hh / 2));
      }
    }
    else if (l.type === 'take') {
      const tk = l.take, pk = tk.peaks, x0 = tk.startSec / slotDur() * sw, wpx = tk.dur / slotDur() * sw, mute = !takeAudible(tk); g.fillStyle = l.c; g.globalAlpha = mute ? .2 : .85; const amp = hh / 2 - 4, xa = Math.max(x0, ox), xb = Math.min(x0 + wpx, ox + vw);
      for (let x = Math.floor(xa); x < xb; x++) { const t = (x - x0) / wpx, i0 = Math.floor(t * pk.mn.length), i1 = Math.max(i0 + 1, Math.floor((t + 1 / wpx) * pk.mn.length)); let mn = 1, mx = -1; for (let k = i0; k < Math.min(i1, pk.mn.length); k++) { if (pk.mn[k] < mn) mn = pk.mn[k]; if (pk.mx[k] > mx) mx = pk.mx[k]; } if (mx >= mn) g.fillRect(x, mid - mx * amp * 2.2, 1, Math.max(1, (mx - mn) * amp * 2.2)); }
      g.globalAlpha = 1; g.strokeStyle = l.c; g.strokeRect(x0 + .5, y + 3.5, wpx, hh - 7); if (hh >= 40 && wpx > 60) { g.fillStyle = l.c; g.font = sans; g.fillText(tk.name, Math.max(x0, ox) + 6, y + 12); }
    }
    else if (l.type === 'trk' || l.type === 'stem') {
      const env = stemLaneEnv(); if (!env) return; const idx = l.type === 'stem' ? l.idx : -1, arr = idx < 0 ? env.mix : env.a[idx], scl = idx < 0 ? env.scm : env.sc[idx], t0 = trkT0(), sd = slotDur(), amp = hh / 2 - 3, an = STM.an;
      const sm = idx >= 0 ? STM.mix[idx] : null, aud = idx < 0 ? !STM.mute : (STM.mix.some(x => x.s) ? sm.s : !sm.m);
      if (idx >= 0 && an) { const pr = an.pres[idx], wsec = an.W / an.fps; g.fillStyle = l.c; for (let w = 0; w < pr.length; w++) { const a = pr[w]; if (a < .05) continue; const xx = ((w * wsec - t0) / sd) * sw; if (xx > ox + vw || xx + wsec / sd * sw < ox) continue; g.globalAlpha = .1 * a; g.fillRect(xx, y + 2, Math.ceil(wsec / sd * sw) + 1, hh - 4); } }
      g.fillStyle = l.c; g.globalAlpha = aud ? .9 : .28; const px = sd / sw;
      for (let x = Math.floor(ox); x < ox + vw; x++) { const t = t0 + x * px; if (t < 0) continue; if (t > STM.dur) break; const i0 = Math.floor(t / env.dt), i1 = Math.max(i0, Math.floor((t + px) / env.dt)); let m = 0; for (let k = i0; k <= i1 && k < env.n; k++) if (arr[k] > m) m = arr[k]; const v = Math.min(1, m / scl) * amp; g.fillRect(x, mid - v, 1, Math.max(1, v * 2)); }
      g.globalAlpha = 1; if (hh >= 36 && ox < 200) { g.fillStyle = C.muted; g.font = sans; g.fillText(idx < 0 ? (STM.title || STM.name) : STEM_SHORT[idx], ox + 8, y + 11); }
      if (idx < 0 && t0 > 0) { const x0 = -t0 / sd * sw; if (x0 > ox - 40) { g.fillStyle = C.muted; g.fillRect(Math.round(x0), y, 1, hh); } }
    }
  });
}

/* ---------- I/O → "Guitar + vocal" card: which interface input is which, vocal trim, monitoring, polish ---------- */
function buildVoxCard(p) {
  const route = h('div', { class: 'chmx' }), follow = h('div', { class: 'seg' }), note = h('div', { class: 'tiny muted', style: { marginTop: '6px', lineHeight: 1.45 } });
  const mt = () => { const i = h('i'), u = h('u'), v = h('span', { class: 'mono tiny' }, '–∞ dB'); UI.mVox = { i, u, v, hold: -120 }; return h('div', { style: { margin: '8px 0 4px' } }, h('div', { class: 'row sp tiny muted' }, h('span', {}, 'Vocal level (post-trim)'), v), h('div', { class: 'meter' }, i, u)); };
  const trim = mkKnob({ key: 'voxTrim', label: 'Vocal Trim', min: -24, max: 36, def: 0, step: .5, unit: ' dB', onChange: v => setVoxTrim(v) });
  const tog = (label, get, set, title) => { const b = h('button', { class: 'tog' + (get() ? ' on' : ''), title, onclick: () => { set(!get()); b.classList.toggle('on', get()); } }, label); return b; };
  const sync = () => {
    route.innerHTML = ''; follow.innerHTML = ''; const roles = chRoles(), nch0 = E.inSettings && E.inSettings.channelCount; UI.chM = [];
    [0, 1].forEach(i => {
      const sel = h('select', { class: 'in', 'aria-label': 'What input ' + (i + 1) + ' is', disabled: nch0 === 1 && i === 1, onchange: e => { const v = e.target.value; const r = chRoles(); r[i] = v; if (v === 'v') r[1 - i] = r[1 - i] === 'v' ? 'g' : r[1 - i]; chSetRoles(r[0], r[1]); if (v === 'v' && CFG.vin !== 'off') toast('Input ' + (i + 1) + ' is the vocal. Use headphones, or the interface’s Direct Monitor, to avoid feedback.', 'ok'); } },
        [['g', '🎸 Guitar'], ['v', '🎤 Vocal'], ['o', 'Off']].map(([v, t]) => h('option', { value: v, selected: roles[i] === v }, t)));
      const bar = h('i'); UI.chM[i] = bar;
      route.append(h('div', { class: 'chrow', title: 'Guitar goes through the rig; Vocal goes through the vocal strip' }, h('b', {}, 'Input ' + (i + 1)), sel, h('div', { class: 'meter chm', 'aria-hidden': 'true' }, bar)));
    });
    [['g', 'Guitar'], ['v', 'Vocal'], ['b', 'Both']].forEach(([v, t]) => follow.append(h('button', { class: (CFG.anSrc || 'g') === v ? 'on' : '', title: v === 'g' ? 'Note detection, tuner, chords, neck and visuals follow the guitar' : v === 'v' ? 'They follow the singing voice: the neck shows the note you sing, the visuals move with your voice' : 'They follow both (works best for visuals; note detection is best with one source)', onclick: () => setAnaSource(v) }, t)));
    const nch = E.inSettings && E.inSettings.channelCount;
    note.textContent = !E.hasInput ? 'Open an input above first. A 2-channel interface (Focusrite Scarlett/Solo/2i2 and similar) shows up here as one device with two channels.'
      : nch === 1 ? 'This device is mono, so it only has one channel: the vocal can’t be split from the guitar. Choose the interface itself (not “default” or a webcam mic) in the list above.'
        : CFG.vin === 'off' ? 'Set each input to what is plugged into it. A guitar on one input and a mic on the other gives each its own lane and take; “Guitar” on both sums them into one guitar.'
          : 'Guitar and vocal are on separate inputs. Arm both lanes (●) and press R: both record on the same clock. Use headphones, or the interface’s Direct Monitor, to avoid feedback.';
  };
  const card = h('div', { class: 'card' }, h('h4', {}, 'Channels'), h('div', { class: 'card-b' }, route, h('div', { class: 'row sp', style: { margin: '8px 0 4px' } }, h('span', { class: 'tiny muted', title: 'Which channel the note detector, tuner, chord finder, neck and visuals listen to' }, 'Detect & visualise'), follow), note, mt(),
    h('div', { class: 'row', style: { gap: '6px', margin: '6px 0', flexWrap: 'wrap' } }, tog('Hear vocal', () => !!CFG.voxMon, v => { CFG.voxMon = v; saveCfg(); applyMix(); renderHeads(); }, 'Monitor the vocal through the app (headphones only)'), tog('Vocal polish', () => CFG.voxPolish !== false, v => { CFG.voxPolish = v; saveCfg(); voxPolishApply(); }, 'High-pass at 90 Hz and gentle compression on the vocal track')),
    h('div', { class: 'row', style: { justifyContent: 'center' } }, trim.el)));
  UI.chSync = sync; trim.set(CFG.voxTrim || 0); sync(); bus.on('route', sync); bus.on('input', sync); bus.on('route', renderHeads);
  const first = p.firstElementChild; if (first) first.after(card); else p.append(card);
}
/** live level meters in the Guitar and Vocal lane headers, and the Vocal card */
function laneMeters() {
  if (!E.ready) return; const put = (el, an, key, ui) => { if (!el && !ui) return; const m = peakOf(an, key); if (el) el.style.width = dbw(m.rms); if (ui) { ui.i.style.width = dbw(m.rms); ui.hold = Math.max(m.pk, ui.hold - .6); ui.u.style.left = dbw(Math.max(ui.hold, -60)); ui.v.textContent = 'pk ' + (m.pk < -90 ? '−∞' : m.pk.toFixed(1)) + ' · rms ' + (m.rms < -90 ? '−∞' : m.rms.toFixed(1)); } };
  if (UI.lm) { if (UI.lm.live) put(UI.lm.live, E.anaDI, 'lmG'); if (UI.lm.vox || UI.mVox) put(UI.lm.vox, E.anaVox, 'lmV', UI.mVox); } else if (UI.mVox) put(null, E.anaVox, 'lmV', UI.mVox);
}

/* ---------- see everything: the panel menu and "expand" modes for the centre ---------- */
const CMAX = { mode: '' };
function centerMax(mode) {
  CMAX.mode = CMAX.mode === mode ? '' : mode; const c = $('#center'); if (!c) return; c.classList.toggle('max-dock', CMAX.mode === 'dock'); c.classList.toggle('max-tl', CMAX.mode === 'tl');
  $$('.cmax').forEach(b => b.classList.toggle('on', b.dataset.m === CMAX.mode)); setTimeout(() => { tlSize(); window.dispatchEvent(new Event('resize')); }, 40);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && CMAX.mode && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) centerMax(CMAX.mode); });
function dockMore() {
  const b = h('button', { class: 'dock-more', title: 'All panels, expand the panel, move panels between the centre and the sidebars', 'aria-label': 'All panels', onclick: e => dockMenu(e.currentTarget) }, '☰'), x = h('button', { class: 'dock-more cmax', 'data-m': 'dock', title: 'Expand this panel to the whole centre (Esc to go back)', 'aria-label': 'Expand panel', onclick: () => centerMax('dock') }, '⤢');
  return h('div', { class: 'dock-tools' }, x, b);
}
function dockMenu(anchor) {
  const box = h('div', { style: { minWidth: '260px' } }); box.append(h('h5', {}, 'All panels'));
  const g = h('div', { class: 'pgrid' }); DOCK.forEach(([id, name], i) => { const hosted = typeof sideHosted === 'function' && sideHosted(id); g.append(h('button', { class: 'btn sm' + (paneVisible(id) ? ' primary' : ''), title: hosted ? 'Lives in a sidebar — click to show it there' : 'Show this panel', onclick: () => { closePop(); dockGo(id); } }, (i + 1) + ' · ' + name + (hosted ? ' ›' : ''))); });
  box.append(g, h('div', { class: 'row', style: { gap: '6px', marginTop: '8px', flexWrap: 'wrap' } },
    h('button', { class: 'btn sm', onclick: () => { closePop(); centerMax('dock'); } }, '⤢ Expand panel'), h('button', { class: 'btn sm', onclick: () => { closePop(); centerMax('tl'); } }, '⤢ Expand arrangement'),
    h('button', { class: 'btn sm', onclick: e => { closePop(); placeMenu(anchor); } }, '⇆ Where panels live…')));
  popover(anchor, box, { right: true, style: { maxWidth: '360px' } });
}

/* ---------- the loaded track rides the transport: play / stop / seek / loop move the band and the track together ---------- */
const TRK = { own: false, warned: 0 };
function trackStart(when, slot, first) {
  if (!STM.ch || CFG.trackSync === false) return; const t = slot * slotDur() + trkT0();
  if (first && STM.an && Math.abs(STM.an.bpmEff - S.bpm) > 1 && Date.now() - TRK.warned > 20000) { TRK.warned = Date.now(); toast('The track is ' + STM.an.bpmEff.toFixed(1) + ' BPM but the song is ' + S.bpm + ' — they will drift. Use “Use tempo + key” in the track menu (top bar).', 'warn'); }
  if (t >= STM.dur - .1) { if (STP.playing) spPause(); TRK.own = false; return; }
  if (STM.loop.on) { STM.loop.on = false; } TRK.own = true; spPlay(when, t).then(() => { spBus(); }).catch(() => { });
}
function trackStop() { if (TRK.own && STP.playing) spPause(); TRK.own = false; }

/* >>> parts/24-lyrics.js */
/* ============================================================
   Part 24 · LYRIC INTAKE
   Paste (or drop) a finished lyric sheet — "[Verse 1] … [Chorus] …" — and it becomes song sections, with the chords
   from your song placed over the words. Understands [Verse 1], (Chorus), "Verse 2:", ## Bridge, plain "Chorus" lines and
   .lrc timestamps; with no headings at all, blank-line stanzas become Verse / Chorus (a stanza that repeats = Chorus).
   Everything is one undoable step.
   ============================================================ */
const LI = { ov: null, st: { mode: 'A', bpl: 2, chords: true, text: '' } };
const LI_KEYS = 'intro|verse|pre[\\s-]?chorus|post[\\s-]?chorus|chorus|hook|refrain|bridge|outro|interlude|solo|instrumental|breakdown|tag|coda|drop|turnaround|middle\\s?8|vamp|ending';
const LI_PLAIN = new RegExp('^(' + LI_KEYS + ')\\s*\\d{0,2}$', 'i'), LI_LOOSE = new RegExp('^(' + LI_KEYS + ')\\b', 'i');
const liName = s => s.replace(/\s*[:\-–]\s*$/, '').replace(/\s+/g, ' ').trim().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
const liKey = lines => lines.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function liHeader(raw) {
  const t = raw.trim(); if (!t || t.length > 50) return null;
  const m = t.match(/^[\[\(\{]\s*(.+?)\s*[\]\)\}]\s*:?$/);
  if (m) {
    const inner = m[1]; if (/^\d{1,2}:\d{2}/.test(inner)) return null;
    if (LI_LOOSE.test(inner)) return liName(inner);
    if (t[0] === '[' && !parseChord(inner) && /[A-Za-z]{3,}/.test(inner)) return liName(inner);
    return null;
  }
  const bare = t.replace(/:$/, '').trim(), d = bare.replace(/^[#*_=~\-–—\s]+/, '').replace(/[#*_=~\-–—\s]+$/, '').trim();
  if (LI_PLAIN.test(d)) return liName(d);
  if ((d !== bare || /:$/.test(t)) && LI_LOOSE.test(d) && d.length <= 36) return liName(d);
  return null;
}
/** text → [{name, lines[], n}] ; result.headed = number of explicit headings found */
function lyricParse(text) {
  const raw = String(text || '').replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\s+$/, '').replace(/\t/g, ' ').replace(/^\s*\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]\s*/, ''));
  let secs = [], cur = null, headed = 0; const open = n => { cur = { name: n, lines: [] }; secs.push(cur); };
  raw.forEach(l => {
    if (/^\s*\[(ti|ar|al|by|offset|length|re|ve):[^\]]*\]\s*$/i.test(l)) return;
    const hn = liHeader(l); if (hn) { headed++; open(hn); return; }
    if (!cur) { if (!l.trim()) return; open('Lyrics'); } cur.lines.push(l);
  });
  if (!headed && secs[0]) {
    const blocks = []; let b = []; secs[0].lines.forEach(l => { if (!l.trim()) { if (b.length) blocks.push(b); b = []; } else b.push(l); }); if (b.length) blocks.push(b);
    const cnt = {}; blocks.forEach(x => { cnt[liKey(x)] = (cnt[liKey(x)] || 0) + 1; }); let v = 0;
    secs = blocks.map(x => ({ name: cnt[liKey(x)] > 1 ? 'Chorus' : 'Verse ' + (++v), lines: x }));
  }
  secs.forEach(s => {
    while (s.lines.length && !s.lines[0].trim()) s.lines.shift(); while (s.lines.length && !s.lines[s.lines.length - 1].trim()) s.lines.pop();
    s.lines = s.lines.filter((l, i, a) => l.trim() || (a[i - 1] || '').trim()); s.n = s.lines.filter(l => l.trim()).length;
  });
  secs.headed = headed; return secs;
}

/* ---------- chords over words ---------- */
function liPlace(lines, bars) {
  const idx = []; lines.forEach((l, i) => { if (l.trim()) idx.push(i); }); const n = idx.length, nb = bars.length; if (!n || !nb) return lines.join('\n');
  const out = lines.slice();
  idx.forEach((li, k) => {
    const text = lines[li]; if (/\[[^\]]+\]/.test(text)) return;
    const b0 = Math.floor(k * nb / n), b1 = Math.max(b0 + 1, Math.floor((k + 1) * nb / n)), ch = [];
    for (let b = b0; b < b1; b++) barChords(bars[b % nb]).forEach(c => { if (parseChord(c)) ch.push(c); });
    if (!ch.length) return; const lead = (text.match(/^\s*/) || [''])[0], toks = text.trim().match(/\S+\s*/g) || [], at = {};
    ch.forEach((c, j) => { const ti = Math.min(toks.length - 1, Math.round(j * toks.length / ch.length)); if (!(ti in at) && at[ti - 1] !== c) at[ti] = c; });
    out[li] = lead + toks.map((t, ti) => (at[ti] ? '[' + at[ti] + ']' : '') + t).join('');
  });
  return out.join('\n');
}
function liProgression(old) {
  const src = old.find(s => s.bars.some(b => barChords(b).some(parseChord)));
  if (src) { const p = src.bars.slice(0, 4).map(b => b.chord || ''); if (p.some(Boolean)) return p; }
  const r = S.key, nm = x => pcName((r + x) % 12);
  return S.minor ? [nm(0) + 'm', nm(8), nm(3), nm(10)] : [nm(0), nm(7), nm(9) + 'm', nm(5)];
}
/** Pure: where would these sections go? Works on a copy; returns {sections, rows, dropped}. */
function liBuild(secsP, o) {
  const old = JSON.parse(JSON.stringify(S.sections)), prog = liProgression(old), used = new Set(), first = {}, rows = [];
  const find = nm => { const l = nm.toLowerCase(), base = l.replace(/\s*\d+$/, ''); return old.find(s => !used.has(s) && s.name.toLowerCase() === l) || old.find(s => !used.has(s) && s.name.toLowerCase().replace(/\s*\d+$/, '') === base); };
  const fresh = p => { const nb = p.n ? clamp(p.n * o.bpl, 2, 32) : 4; return mkSection(p.name, Array.from({ length: nb }, (_, i) => prog[i % prog.length])); };
  const put = (p, sec, how) => { sec.name = p.name; sec.lyrics = o.chords ? liPlace(p.lines, sec.bars) : p.lines.join('\n'); rows.push({ p, sec, how, bars: sec.bars.length }); return sec; };
  let out;
  if (o.mode === 'B') {
    out = secsP.map((p, i) => old[i] ? (used.add(old[i]), put(p, old[i], 'fills your “' + old[i].name + '”')) : put(p, fresh(p), 'new'));
    out = out.concat(old.filter(s => !used.has(s)));
  } else {
    out = secsP.map(p => {
      const lk = p.name.toLowerCase(); let sec, how;
      if (first[lk]) { sec = JSON.parse(JSON.stringify(first[lk])); sec.id = uid(); how = 'repeat of the first ' + p.name; }
      else if (o.mode === 'A' && (sec = find(p.name))) { used.add(sec); how = 'keeps your “' + sec.name + '” bars'; }
      else { sec = fresh(p); how = 'new'; }
      put(p, sec, how); if (!first[lk]) first[lk] = sec; return sec;
    });
    out = o.mode === 'C' ? old.concat(out) : out;
  }
  const dropped = o.mode === 'A' ? old.filter(s => !used.has(s)) : [];
  return { sections: out, rows, dropped };
}
function liApply(secsP, o) {
  if (!secsP.length) return toast('Nothing to import: paste some lyrics first.', 'warn');
  const r = liBuild(secsP, o); vhSnap('before lyric import', true);
  S.sections = r.sections; SEL.sec = 0; SEL.bar = 0; TE.sec = 0; TE.bi = 0; T.bars = null; TL.cache = null; RF.acc = true; commit(true);
  toast('Imported ' + secsP.length + ' sections, ' + secsP.reduce((a, p) => a + p.n, 0) + ' lines' + (o.chords ? ' with chords over the words' : '') + '. Undo (Ctrl+Z) puts the song back.', 'ok');
}

/* ---------- the dialog ---------- */
function liClose() { if (LI.ov) { LI.ov.remove(); LI.ov = null; } document.removeEventListener('keydown', liKeys, true); }
function liKeys(e) { if (e.key === 'Escape') { e.stopPropagation(); liClose(); } }
function liOpen(text) {
  liClose(); if (typeof text === 'string') LI.st.text = text;
  const st = LI.st, prev = h('div', { class: 'lyi-prev' });
  const ta = h('textarea', { class: 'in lyi-ta', spellcheck: false, placeholder: '[Verse 1]\nLate night, city lights…\n\n[Chorus]\nI just wanna be right here with you…', oninput: () => { st.text = ta.value; draw(); } }, st.text);
  const file = h('input', { type: 'file', accept: '.txt,.md,.lrc,.rtf,text/plain', style: { display: 'none' }, onchange: async e => { const f = e.target.files[0]; if (!f) return; st.text = await f.text(); ta.value = st.text; draw(); } });
  const sel = (v, opts, fn) => h('select', { class: 'in', onchange: e => fn(e.target.value) }, opts.map(([k, t]) => h('option', { value: k, selected: String(k) === String(v) }, t)));
  const modeSel = sel(st.mode, [['A', 'Make a section for each block (keep my bars where the name matches)'], ['B', 'Fill the sections I already have, in order'], ['C', 'Add them after my existing sections']], v => { st.mode = v; draw(); });
  const bplSel = sel(st.bpl, [[1, '1 bar per line'], [2, '2 bars per line'], [4, '4 bars per line']], v => { st.bpl = +v; draw(); });
  const chk = h('input', { type: 'checkbox', checked: st.chords, onchange: e => { st.chords = e.target.checked; draw(); } });
  const go = h('button', { class: 'btn primary', onclick: () => { const p = lyricParse(st.text); if (!p.length) return; liApply(p, st); liClose(); } }, 'Import lyrics');
  function draw() {
    const p = lyricParse(st.text); prev.innerHTML = ''; go.disabled = !p.length;
    if (!p.length) { prev.append(h('div', { class: 'muted small' }, 'Paste the lyrics above. Headings like [Verse 1], [Chorus], (Bridge) or “Verse 2:” split them into sections. Chords you already have in the song are placed over the words.')); return; }
    const r = liBuild(p, st), lines = p.reduce((a, x) => a + x.n, 0);
    prev.append(h('div', { class: 'small', style: { fontWeight: 800, marginBottom: '4px' } }, p.length + ' sections · ' + lines + ' lines' + (p.headed ? '' : ' (no headings found: split into stanzas)')));
    const tb = h('div', { class: 'lyi-rows' }); r.rows.forEach(({ p: x, how, bars }) => tb.append(h('div', { class: 'lyi-row' }, h('b', {}, x.name), h('span', { class: 'muted' }, x.n + ' lines · ' + bars + ' bars'), h('span', { class: 'tiny muted' }, how)))); prev.append(tb);
    if (r.dropped.length) { const tab = r.dropped.some(s => s.bars.some(b => b.tab.length)); prev.append(h('div', { class: 'tiny', style: { color: 'var(--warn)', marginTop: '6px' } }, 'Replaces: ' + r.dropped.map(s => s.name + ' (' + s.bars.length + ' bars)').join(', ') + (tab ? ' — including tab notes' : '') + '. Undo brings them back; choose “Add them after…” to keep them.')); }
  }
  const box = h('div', { class: 'lyi-box', role: 'dialog', 'aria-label': 'Import lyrics' },
    h('div', { class: 'lyi-h' }, h('b', {}, '📋 Import lyrics'), h('span', { class: 'grow' }), h('button', { class: 'btn sm', title: 'Close (Esc)', onclick: liClose }, '✕')),
    h('div', { class: 'lyi-b' }, ta,
      h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', margin: '8px 0' } },
        h('button', { class: 'btn sm', onclick: async () => { try { const t = await navigator.clipboard.readText(); if (t) { st.text = t; ta.value = t; draw(); } } catch (e) { toast('Your browser blocked clipboard access: press Ctrl+V in the box instead.', 'warn'); } } }, 'Paste from clipboard'),
        h('button', { class: 'btn sm', onclick: () => file.click() }, 'Open a .txt / .lrc file…'), file, h('button', { class: 'btn sm', onclick: () => { st.text = ''; ta.value = ''; draw(); ta.focus(); } }, 'Clear')),
      h('div', { class: 'lyi-opts' }, h('label', {}, 'Where it goes'), modeSel, h('label', {}, 'New sections'), bplSel, h('label', { class: 'lyi-chk' }, chk, ' Put the chords over the words')),
      prev),
    h('div', { class: 'lyi-f' }, h('span', { class: 'tiny muted grow' }, 'Lyrics stay on this device. Nothing is uploaded.'), h('button', { class: 'btn', onclick: liClose }, 'Cancel'), go));
  LI.ov = h('div', { class: 'lyi', onpointerdown: e => { if (e.target === LI.ov) liClose(); } }, box); document.body.append(LI.ov); document.addEventListener('keydown', liKeys, true); draw(); setTimeout(() => ta.focus(), 30);
}
/** pasting a whole lyric sheet into any section box offers to split it */
function liPaste(e) {
  const t = ((e.clipboardData || window.clipboardData) || { getData: () => '' }).getData('text'); if (!t || t.length < 40) return;
  const p = lyricParse(t); if (p.headed >= 2 || (!p.headed && p.length >= 3)) { e.preventDefault(); liOpen(t); }
}
/** drop a .txt / .lrc onto the Refine panel */
function liWire(box) {
  box.addEventListener('dragover', e => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); box.classList.add('dropt'); } });
  box.addEventListener('dragleave', () => box.classList.remove('dropt'));
  box.addEventListener('drop', async e => { box.classList.remove('dropt'); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (!f || !/\.(txt|md|lrc)$|^text\//i.test(f.name + ' ' + f.type)) return; e.preventDefault(); liOpen(await f.text()); });
}

/* >>> parts/25-projects.js */
/* ============================================================
   Part 25 · PROJECTS — a library of songs, kept on this device
   Every song is a project: the song model, its recorded takes, and the backing track you loaded. They live in this
   browser's IndexedDB (no account, no server). Switching, duplicating and deleting never touch another song.
   A project also exports as a plain .zip "song folder": song.md (readable anywhere, Obsidian-friendly),
   arrangement.json (the full model) and audio/*.wav — the same layout a GitHub repo will use later.
   ============================================================ */
const PRJ = { db: null, ok: false, cur: null, rec: null, list: [], loading: false, timer: 0, saving: null, again: false, ready: false, pending: null, warned: false, wantStart: false };
const PDB_NAME = 'the-daily-songs';

/* ---------- IndexedDB, in a few lines ---------- */
function pdbOpen() {
  return new Promise(res => {
    if (!window.indexedDB) return res(null);
    let r; try { r = indexedDB.open(PDB_NAME, 1); } catch (e) { return res(null); }
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' }); if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs'); };
    r.onsuccess = () => { r.result.onversionchange = () => { try { r.result.close(); } catch (e) { } }; res(r.result); };
    r.onerror = r.onblocked = () => res(null);
  });
}
const pdbReq = (st, mode, fn) => new Promise((res, rej) => { try { const tx = PRJ.db.transaction(st, mode), q = fn(tx.objectStore(st)); tx.oncomplete = () => res(q && q.result); tx.onerror = tx.onabort = () => rej(tx.error || new Error('storage error')); } catch (e) { rej(e); } });
const pdbGet = (st, k) => pdbReq(st, 'readonly', s => s.get(k));
const pdbPut = (st, v, k) => pdbReq(st, 'readwrite', s => k === undefined ? s.put(v) : s.put(v, k));
const pdbDel = (st, k) => pdbReq(st, 'readwrite', s => s.delete(k));
const pdbAll = st => pdbReq(st, 'readonly', s => s.getAll());
const pdbDelPrefix = (st, p) => pdbReq(st, 'readwrite', s => s.delete(IDBKeyRange.bound(p, p + '￿')));
const pdbKeys = (st, p) => pdbReq(st, 'readonly', s => s.getAllKeys(IDBKeyRange.bound(p, p + '￿')));

/* ---------- audio storage: 16-bit PCM keeps a 3-minute mono take near 17 MB instead of 34 ---------- */
function toI16(f) { const o = new Int16Array(f.length); for (let i = 0; i < f.length; i++) { const v = f[i]; o[i] = v <= -1 ? -32768 : v >= 1 ? 32767 : Math.round(v * 32767); } return o; }
function fromI16(a) { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] / 32768; return o; }
function wavI16(a, sr) {
  const n = a.length, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  new Int16Array(b, 44, n).set(a); return new Uint8Array(b);
}
/** first channel of a PCM16 / PCM24 / float32 WAV as Int16 */
function wavParse(u) {
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength); if (u.length < 44 || dv.getUint32(0) !== 0x52494646) throw new Error('not a WAV file');
  let p = 12, fmt = null, data = null;
  while (p + 8 <= u.length) { const id = dv.getUint32(p), sz = dv.getUint32(p + 4, true); if (id === 0x666d7420) fmt = { tag: dv.getUint16(p + 8, true), ch: dv.getUint16(p + 10, true), sr: dv.getUint32(p + 12, true), bits: dv.getUint16(p + 22, true) }; else if (id === 0x64617461) { data = { p: p + 8, n: Math.min(sz, u.length - p - 8) }; break; } p += 8 + sz + (sz & 1); }
  if (!fmt || !data) throw new Error('unreadable WAV'); const bp = fmt.bits / 8, fr = Math.floor(data.n / (bp * fmt.ch)), out = new Int16Array(fr);
  for (let i = 0; i < fr; i++) { const o = data.p + i * bp * fmt.ch; out[i] = fmt.bits === 16 ? dv.getInt16(o, true) : fmt.bits === 24 ? ((u[o] | (u[o + 1] << 8) | (u[o + 2] << 16)) << 8) >> 16 : fmt.bits === 32 && fmt.tag === 3 ? clamp(Math.round(dv.getFloat32(o, true) * 32767), -32768, 32767) : (dv.getInt32(o, true) >> 16); }
  return { i16: out, sr: fmt.sr };
}

/* ---------- a minimal .zip (stored, no compression) ---------- */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u) { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC_T[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipBuild(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0; const now = new Date();
  const dt = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate(), tm = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  for (const f of files) {
    const nm = enc.encode(f.name), d = f.data, crc = crc32(d), lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(10, tm, true); lh.setUint16(12, dt, true); lh.setUint32(14, crc, true); lh.setUint32(18, d.length, true); lh.setUint32(22, d.length, true); lh.setUint16(26, nm.length, true);
    parts.push(lh.buffer, nm, d);
    const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(12, tm, true); ch.setUint16(14, dt, true); ch.setUint32(16, crc, true); ch.setUint32(20, d.length, true); ch.setUint32(24, d.length, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
    central.push(ch.buffer, nm); off += 30 + nm.length + d.length;
  }
  let csz = 0; central.forEach(b => { csz += b.byteLength; });
  const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csz, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}
async function zipRead(file) {
  const u = new Uint8Array(await file.arrayBuffer()), dv = new DataView(u.buffer); let e = u.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw new Error('this is not a .zip file');
  const n = dv.getUint16(e + 10, true), dec = new TextDecoder(), out = new Map(); let p = dv.getUint32(e + 16, true);
  for (let i = 0; i < n; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const meth = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true), name = dec.decode(u.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    out.set(name, {
      async get() {
        const s = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), raw = u.subarray(s, s + csz); if (meth === 0) return raw;
        if (meth === 8 && typeof DecompressionStream !== 'undefined') return new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
        throw new Error('this zip uses a compression this browser cannot read');
      }
    });
  }
  return out;
}

/* ---------- small helpers ---------- */
const projId = () => 'p' + Date.now().toString(36) + uid();
const projBytes = n => n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(n >= 1.05e7 ? 0 : 1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' kB' : (n || 0) + ' B';
const projAgo = t => { const s = (Date.now() - t) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago'; if (s < 604800) return Math.floor(s / 86400) + ' d ago'; return new Date(t).toLocaleDateString(); };
const slug = s => (String(s || 'song').normalize('NFKD').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'song');
/** a saved song, completed with any fields this version added since it was written */
function normSong(saved) {
  const d = newSong(), s = Object.assign(d, saved || {}); s.band = Object.assign(d.band, (saved && saved.band) || {}); s.mix = Object.assign(d.mix, (saved && saved.mix) || {}); s.voicePref = (saved && saved.voicePref) || {};
  s.tuning = ((saved && saved.tuning) || d.tuning).slice(); if (!Array.isArray(s.sections)) s.sections = []; if (!Array.isArray(s.ts) || s.ts.length < 2) s.ts = [4, 4]; return s;
}
const takeMeta = t => { const m = { hum: !!t.hum, id: t.id, kind: t.kind || 'gtr', name: t.name, startSec: t.startSec, sr: t.sr, g: t.g, pan: t.pan || 0, mute: !!t.mute, solo: !!t.solo, mode: t.mode, bpm: t.bpm, preset: t.preset || '', peak: t.peak, rms: t.rms, dur: t.dur, t: t.t, hasWet: !!t.wet, hasCam: !!(t.cam && t.cam.length) }; try { m.stats = t.stats ? JSON.parse(JSON.stringify(t.stats)) : null; } catch (e) { m.stats = null; } return m; };

/* ---------- save ---------- */
function projDirty() {
  if (!PRJ.ok || PRJ.loading || store.locked) return;
  if (!PRJ.cur) { if (PRJ.ready && !document.getElementById('origins') && (songHasWork() || TAKES.length || STM.ch)) projAdoptCurrent(); return; }   // work done before any song was chosen is kept as a song
  clearTimeout(PRJ.timer); PRJ.timer = setTimeout(projSave, 1200);
}
function projSave() {
  clearTimeout(PRJ.timer); if (!PRJ.ok || !PRJ.cur || PRJ.loading || store.locked) return Promise.resolve();
  if (PRJ.saving) { PRJ.again = true; return PRJ.saving; }
  PRJ.saving = (async () => {
    try { await projSaveNow(); projPersist(); } catch (e) { console.warn('project save', e); if (!PRJ.warned) { PRJ.warned = true; toast('This browser would not store your work (storage full or private window?). Export a song bundle from ☰ Songs to keep it.', 'warn'); } }
    finally { PRJ.saving = null; if (PRJ.again) { PRJ.again = false; projDirty(); } }
  })();
  return PRJ.saving;
}
/** ask the browser not to evict the library when disk space is low (asked once; some browsers decide silently, others show a prompt) */
async function projPersist() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return; PRJ.persisted = await navigator.storage.persisted();
    if (!PRJ.persisted && !CFG.persistAsked) { CFG.persistAsked = true; saveCfg(); PRJ.persisted = await navigator.storage.persist(); }
  } catch (e) { }
}
/** a gentle, rare reminder to keep a copy: only when there is real work and no recent backup */
function projNudge() {
  setTimeout(() => {
    try {
      const real = PRJ.list.some(r => r.nTakes || r.track) || PRJ.list.length > 2, day = 864e5, now = Date.now();
      if (real && (!CFG.lastBackup || now - CFG.lastBackup > 30 * day) && (!CFG.nudgeAt || now - CFG.nudgeAt > 7 * day)) { CFG.nudgeAt = now; saveCfg(); toast('Tip: keep a copy of your songs. ☰ Songs ▸ Back up all songs saves one zip.'); }
    } catch (e) { }
  }, 25000);
}
async function projSaveNow() {
  const id = PRJ.cur, rec = PRJ.rec || (PRJ.rec = { id, created: Date.now(), origin: 'blank' });
  rec.song = JSON.parse(JSON.stringify(S)); rec.title = S.title || 'Untitled'; rec.artist = S.artist || ''; rec.modified = Date.now(); rec.v = 1; rec.zoom = typeof ZOOM !== 'undefined' ? ZOOM.cur : 'studio';
  let bytes = 0; const live = new Set(TAKES.map(t => t.id));
  for (const old of (rec.takes || []).map(t => t.id).filter(x => !live.has(x))) await pdbDelPrefix('blobs', id + '/take/' + old + '/');
  for (const t of TAKES) {
    if (!t._saved) { const k = id + '/take/' + t.id + '/'; await pdbPut('blobs', toI16(t.dry), k + 'dry'); if (t.wet) await pdbPut('blobs', toI16(t.wet), k + 'wet'); if (t.cam && t.cam.length) { try { await pdbPut('blobs', JSON.stringify(t.cam), k + 'cam'); } catch (e) { } } t._saved = true; }
    bytes += (t.dry.length + (t.wet ? t.wet.length : 0)) * 2;
  }
  rec.takes = TAKES.map(takeMeta);
  if (STM.ch && STM.file && !STM._saved && !STM.busy) {
    const buf = await STM.file.arrayBuffer(); await pdbPut('blobs', { buf, type: STM.file.type || 'audio/mp4', name: STM.file.name || 'track' }, id + '/track'); STM._saved = true;
    rec.track = { name: STM.name, title: STM.title, artist: STM.artist, dur: STM.dur, fileName: STM.file.name || 'track', type: STM.file.type || 'audio/mp4', bytes: buf.byteLength }; PRJ.pending = null;
  } else if (!STM.ch && !STM.busy && !STM.restoring && !PRJ.pending && rec.track) { await pdbDel('blobs', id + '/track'); rec.track = null; }
  if (rec.track) bytes += rec.track.bytes || 0; rec.size = bytes; rec.nTakes = TAKES.length;
  await pdbPut('projects', rec);
  const i = PRJ.list.findIndex(r => r.id === id); if (i >= 0) PRJ.list[i] = rec; else PRJ.list.unshift(rec); PRJ.list.sort((a, b) => b.modified - a.modified); bus.emit('projects');
}
async function projRefresh() { try { PRJ.list = (await pdbAll('projects')).sort((a, b) => b.modified - a.modified); } catch (e) { PRJ.list = []; } }

/* ---------- switching: put a project's song, takes and track into the live app ---------- */
function projQuiet() {
  try { if (T.playing) stopPlay(true); } catch (e) { }
  try { if (STP.playing) spPause(); } catch (e) { }
  STM.ticket = (STM.ticket || 0) + 1; STM.busy = false; STM.restoring = false; TAKES.length = 0; PRJ.pending = null;
  if (STM.ch) stemUnload(); STM.file = null; STM._saved = false;
}
function projUse(song) {
  S = normSong(song); histStack.u.length = 0; histStack.r.length = 0; histStack.cur = snap();
  SEL.sec = 0; SEL.bar = 0; TE.sec = 0; TE.bi = 0; T.cursor = 0; T.loopA = 0; T.loopB = null; store.set('song', S); store.set('songAt', Date.now());
  bus.emit('song', 'reload'); bus.emit('takes');
}
async function projLoad(id, o = {}) {
  const rec = o.rec || await pdbGet('projects', id); if (!rec) return false;
  if (PRJ.cur && PRJ.cur !== id) await projSave();
  PRJ.loading = true;
  try {
    projQuiet(); PRJ.cur = id; PRJ.rec = rec; store.set('cur', id);
    for (const m of rec.takes || []) {
      const k = id + '/take/' + m.id + '/', dry = await pdbGet('blobs', k + 'dry'); if (!dry) continue;
      const wet = m.hasWet ? await pdbGet('blobs', k + 'wet') : null, cam = m.hasCam ? await pdbGet('blobs', k + 'cam') : null; let cm = []; try { cm = cam ? JSON.parse(cam) : []; } catch (e) { }
      const t = Object.assign({}, m, { dry: fromI16(dry), wet: wet ? fromI16(wet) : null, cam: cm, _saved: true }); t.peaks = peaksOf(t.dry); TAKES.push(t);
    }
    projUse(rec.song);
    if (rec.zoom && typeof zoomSet === 'function' && !o.keepZoom) zoomSet(rec.zoom, true);
  } finally { PRJ.loading = false; }
  if (rec.track) { PRJ.pending = rec.track; if ((CFG.trackRestore || (document.body.dataset.form === 'phone' ? 'tap' : 'auto')) === 'auto') projRestoreTrack(); else bus.emit('track'); }
  bus.emit('projects'); return true;
}
/** the backing track is stored as the original file; its stems are separated again on open (the song itself opens instantly) */
async function projRestoreTrack() {
  const id = PRJ.cur, tm = PRJ.pending; if (!id || !tm || STM.busy) return;
  const b = await pdbGet('blobs', id + '/track'); if (!b || PRJ.cur !== id) { PRJ.pending = null; bus.emit('track'); return; }
  STM.restoring = true; try { await stemLoad(new File([b.buf], b.name || tm.fileName || 'track', { type: b.type }), { restore: true }); } finally { STM.restoring = false; }
  if (STM.ch) PRJ.pending = null; bus.emit('track');
}

/* ---------- creating ---------- */
const FORMS = { empty: ['Verse 1'], vc: ['Verse 1', 'Chorus'], vcb: ['Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Bridge', 'Chorus'] };
/* a new, blank song starts with the band off, so playback is only what the person records or writes; Hum to Song turns it on for the song it builds */
function blankSong(o = {}) {
  const s = newSong(); Object.assign(s.band, { drumsOn: false, bassOn: false, compOn: false, leadOn: false }); s.title = String(o.title || '').trim() || 'Untitled Idea'; s.artist = o.artist || ''; s.bpm = clamp(+o.bpm || 92, 30, 260); s.ts = o.ts || [4, 4]; s.band.drumLen = Math.min(32, s.ts[0] * 16 / s.ts[1]);
  s.key = o.key == null ? 9 : +o.key; s.minor = o.minor == null ? true : !!o.minor; s.scale = s.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)';
  if (o.tuning && TUNINGS[o.tuning]) { s.tuningName = o.tuning; s.tuning = TUNINGS[o.tuning].slice(); }
  s.sections = (FORMS[o.form] || FORMS.empty).map(n => mkSection(n, ['', '', '', ''])); return s;
}
/** kind: 'blank' | 'track' | 'demo' | 'import'.  Everything about the song you were on is saved first. */
async function projCreate(kind, o = {}) {
  try { if (T.playing) stopPlay(true); } catch (e) { }
  if (PRJ.fresh) PRJ.fresh = false;   // the very first start card: the song on screen is only the built-in demo, not the person's work
  else if (!PRJ.cur && PRJ.ok && (songHasWork() || TAKES.length || STM.ch)) await projAdoptCurrent(); else await projSave();
  const id = projId(); PRJ.loading = true;
  try {
    projQuiet(); PRJ.cur = id; PRJ.rec = { id, created: Date.now(), origin: kind, v: 1 }; store.set('cur', id);
    const song = o.song || (kind === 'demo' ? (() => { const d = demoSong(); d.sections.forEach(sec => sec.bars.forEach(b => { const c = barChords(b)[0]; if (c) fillTab(b, 'Fingerstyle pop', c); })); return d; })() : blankSong(o));
    projUse(song); if (kind === 'blank') { CFG.flats = keyUsesFlats(S.key, S.minor); saveCfg(); }
    store.set('started', true);
  } finally { PRJ.loading = false; }
  if (typeof zoomSet === 'function') zoomSet(o.zoom || (kind === 'track' ? 'studio' : 'song'), true);
  await projSave(); bus.emit('projects'); return id;
}
/** Start from a song: a new project, then the file is split into stems and fills the song in */
async function projFromTrack(file) {
  await projCreate('track', { form: 'empty', title: cleanTitle(file.name) || 'Untitled Idea', zoom: 'studio' });
  dockGo('stems'); stemLoad(file);
}
async function projAdoptCurrent(kind) { // keep the song that is already on screen as a project (upgrades from a single autosaved song)
  const id = projId(); PRJ.cur = id; PRJ.rec = { id, created: Date.now(), origin: S.track ? 'track' : kind || 'blank', v: 1 }; store.set('cur', id); store.set('started', true); await projSave();
}
async function projDuplicate(id) {
  if (id === PRJ.cur) await projSave(); const rec = await pdbGet('projects', id); if (!rec) return null;
  const nid = projId(), cp = JSON.parse(JSON.stringify(rec)); cp.id = nid; cp.title = (rec.title || 'Untitled') + ' (copy)'; cp.song.title = cp.title; cp.created = cp.modified = Date.now();
  for (const k of await pdbKeys('blobs', id + '/')) await pdbPut('blobs', await pdbGet('blobs', k), nid + k.slice(id.length)); await pdbPut('projects', cp); await projRefresh(); bus.emit('projects'); return nid;
}
async function projDelete(id) {
  await pdbDel('projects', id); await pdbDelPrefix('blobs', id + '/'); await projRefresh();
  if (id === PRJ.cur) { PRJ.rec = null; PRJ.cur = null; clearTimeout(PRJ.timer); if (PRJ.list.length) await projLoad(PRJ.list[0].id); else await projCreate('blank', { form: 'empty' }); }
  bus.emit('projects');
}
async function projRename(id, title) {
  title = String(title || '').trim(); if (!title) return;
  if (id === PRJ.cur) { S.title = title; commit(false); bus.emit('song'); await projSave(); return; }
  const rec = await pdbGet('projects', id); if (!rec) return; rec.title = title; rec.song.title = title; rec.modified = Date.now(); await pdbPut('projects', rec); await projRefresh(); bus.emit('projects');
}

/* ---------- the song folder: song.md + arrangement.json + audio/ ---------- */
function songMarkdown(s, rec) {
  const fl = keyUsesFlats(s.key, s.minor), key = pcName(s.key, fl) + (s.minor ? ' minor' : ' major'), q = x => JSON.stringify(String(x == null ? '' : x)), L = ['---', 'title: ' + q(s.title), 'artist: ' + q(s.artist), 'key: ' + q(key), 'bpm: ' + (Math.round(s.bpm * 100) / 100), 'time: ' + q(s.ts[0] + '/' + s.ts[1]), 'tuning: ' + q(s.tuningName), 'capo: ' + (s.capo || 0),
    'created: ' + new Date((rec && rec.created) || Date.now()).toISOString(), 'modified: ' + new Date((rec && rec.modified) || Date.now()).toISOString(), 'origin: ' + ((rec && rec.origin) || 'blank'), 'tags: [song]', 'app: ' + q(BRAND.name + ' ' + VERSION), '---', '', '# ' + (s.title || 'Untitled'), s.artist ? '*' + s.artist + '*' : '', ''];
  s.sections.forEach(sec => { L.push('## ' + sec.name); const ch = sec.bars.map(b => b.chord || '·'); if (ch.some(c => c !== '·')) L.push('`| ' + ch.join(' | ') + ' |`', ''); if ((sec.lyrics || '').trim()) L.push(sec.lyrics.trim(), ''); else L.push(''); });
  if ((s.notes || '').trim()) L.push('## Notes', s.notes.trim(), ''); return L.filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n') + '\n';
}
/** every file of a project, read back from storage: [{name, data}] under the given folder */
async function projEntries(id, dir) {
  const rec = await pdbGet('projects', id); if (!rec) throw new Error('song not found'); const enc = new TextEncoder(), files = [], arr = { format: 'the-daily-song', version: 1, app: BRAND.name + ' ' + VERSION, exported: new Date().toISOString(), id, origin: rec.origin || 'blank', created: rec.created, modified: rec.modified, zoom: rec.zoom || 'song', song: rec.song, takes: [], track: null, lanes: CFG.lanes || null };
  for (const m of rec.takes || []) {
    const k = id + '/take/' + m.id + '/', dry = await pdbGet('blobs', k + 'dry'); if (!dry) continue; const base = slug(m.name), e = Object.assign({}, m, { files: { dry: 'audio/' + base + (m.hasWet ? '-dry' : '') + '.wav' } });
    files.push({ name: dir + e.files.dry, data: wavI16(dry, m.sr) });
    if (m.hasWet) { const wet = await pdbGet('blobs', k + 'wet'); if (wet) { e.files.wet = 'audio/' + base + '-wet.wav'; files.push({ name: dir + e.files.wet, data: wavI16(wet, m.sr) }); } }
    if (m.hasCam) { const cam = await pdbGet('blobs', k + 'cam'); if (cam) { e.files.cam = 'audio/' + base + '-fret-log.json'; files.push({ name: dir + e.files.cam, data: enc.encode(cam) }); } }
    arr.takes.push(e);
  }
  if (rec.track) { const b = await pdbGet('blobs', id + '/track'); if (b) { const ext = (String(b.name).match(/\.[A-Za-z0-9]+$/) || ['.m4a'])[0], fn = 'audio/track' + ext; files.push({ name: dir + fn, data: new Uint8Array(b.buf) }); arr.track = Object.assign({}, rec.track, { file: fn }); } }
  files.unshift({ name: dir + 'song.md', data: enc.encode(songMarkdown(rec.song, rec)) }, { name: dir + 'arrangement.json', data: enc.encode(JSON.stringify(arr, null, 1)) });
  return files;
}
async function projExport(id) {
  try {
    if (id === PRJ.cur) await projSave(); const rec = await pdbGet('projects', id); toast('Packing “' + (rec.title || 'song') + '”…');
    const blob = zipBuild(await projEntries(id, '')); download(slug(rec.title) + '.daily-song.zip', blob, 'application/zip'); toast('Song bundle saved (' + projBytes(blob.size) + ')', 'ok'); CFG.lastBackup = Date.now(); saveCfg();
  } catch (e) { console.warn(e); toast('Could not export: ' + (e.message || e), 'bad'); }
}
async function projExportAll() {
  try {
    await projSave(); toast('Packing ' + PRJ.list.length + ' songs…'); let files = []; const seen = {};
    for (const r of PRJ.list) { let d = slug(r.title); if (seen[d]) d += '-' + r.id.slice(-4); seen[d] = 1; files = files.concat(await projEntries(r.id, 'songs/' + d + '/')); }
    const blob = zipBuild(files); download('the-daily.studio-backup-' + new Date().toISOString().slice(0, 10) + '.zip', blob, 'application/zip'); toast('Backup saved (' + projBytes(blob.size) + ')', 'ok'); CFG.lastBackup = Date.now(); saveCfg(); return true;
  } catch (e) { console.warn(e); toast('Could not back up: ' + (e.message || e), 'bad'); return false; }
}
/** a .daily-song.zip (or a backup of several), a lyric sheet (.txt/.md/.lrc) or an older project .json */
async function projImport(file) {
  try {
    const nm = file.name || '';
    if (/\.(txt|md|lrc)$/i.test(nm)) { liOpen(await file.text()); return; }
    if (/\.json$/i.test(nm)) {
      const d = JSON.parse(await file.text()), s = d.song || d; if (!s || !Array.isArray(s.sections)) throw new Error('this JSON has no song in it');
      await projCreate('import', { song: s, zoom: 'song' }); if (d.rig) try { rigApply(d.rig); } catch (e) { } toast('Imported “' + S.title + '”', 'ok'); return;
    }
    const z = await zipRead(file), arrs = [...z.keys()].filter(k => /(^|\/)arrangement\.json$/.test(k)); if (!arrs.length) throw new Error('no song found in this zip');
    let last = null; const dec = new TextDecoder();
    for (const ak of arrs) {
      const pre = ak.slice(0, ak.length - 'arrangement.json'.length), arr = JSON.parse(dec.decode(await z.get(ak).get())), id = projId(); if (!arr.song) continue;
      const rec = { id, v: 1, origin: 'import', created: Date.now(), modified: Date.now(), zoom: arr.zoom || 'song', song: normSong(arr.song), takes: [], track: null }; let bytes = 0;
      for (const m of arr.takes || []) {
        const f = m.files && z.get(pre + m.files.dry); if (!f) continue; const w = wavParse(await f.get()), k = id + '/take/' + m.id + '/', meta = Object.assign({}, m); delete meta.files; meta.sr = w.sr; meta.hasWet = false;
        await pdbPut('blobs', w.i16, k + 'dry'); bytes += w.i16.length * 2;
        if (m.files.wet && z.get(pre + m.files.wet)) { const ww = wavParse(await z.get(pre + m.files.wet).get()); await pdbPut('blobs', ww.i16, k + 'wet'); meta.hasWet = true; bytes += ww.i16.length * 2; }
        if (m.files.cam && z.get(pre + m.files.cam)) { await pdbPut('blobs', dec.decode(await z.get(pre + m.files.cam).get()), k + 'cam'); meta.hasCam = true; } else meta.hasCam = false;
        rec.takes.push(meta);
      }
      if (arr.track && arr.track.file && z.get(pre + arr.track.file)) { const u = await z.get(pre + arr.track.file).get(), buf = u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength); await pdbPut('blobs', { buf, type: arr.track.type || 'audio/mp4', name: arr.track.fileName || 'track' }, id + '/track'); rec.track = { name: arr.track.name, title: arr.track.title, artist: arr.track.artist, dur: arr.track.dur, fileName: arr.track.fileName || 'track', type: arr.track.type || 'audio/mp4', bytes: buf.byteLength }; bytes += buf.byteLength; }
      rec.title = rec.song.title || 'Untitled'; rec.artist = rec.song.artist || ''; rec.size = bytes; rec.nTakes = rec.takes.length; await pdbPut('projects', rec); last = id;
    }
    await projRefresh(); bus.emit('projects'); if (last) { await projLoad(last); toast('Imported “' + S.title + '”' + (arrs.length > 1 ? ' (and ' + (arrs.length - 1) + ' more in the library)' : ''), 'ok'); }
  } catch (e) { console.warn(e); toast('Import failed: ' + (e.message || e), 'bad'); }
}

/* ---------- start-up ---------- */
async function projInit() {
  PRJ.db = await pdbOpen(); PRJ.ok = !!PRJ.db;
  if (!PRJ.ok) { PRJ.ready = true; bus.emit('projects'); if (PRJ.wantStart) startMaybe(); return; }
  await projRefresh();
  const cur = store.get('cur', null), loc = store.get('song', null), locAt = store.get('songAt', 0), hasLoc = loc && Array.isArray(loc.sections) && loc.sections.length;
  let rec = cur && PRJ.list.find(r => r.id === cur);
  if (!rec && !PRJ.list.length && hasLoc) await projAdoptCurrent();              // upgrade: the single autosaved song becomes the first project
  else if (!rec && PRJ.list.length) await projLoad(PRJ.list[0].id, { keepZoom: true });
  else if (rec) { if (hasLoc && locAt > rec.modified + 1500) rec = Object.assign({}, rec, { song: loc }); await projLoad(rec.id, { rec, keepZoom: true }); }
  PRJ.ready = true; bus.emit('projects'); if (PRJ.wantStart) startMaybe(); projPersist(); projNudge();
}
bus.on('song', projDirty); bus.on('takes', projDirty); bus.on('track', projDirty);
document.addEventListener('visibilitychange', () => { if (document.hidden && !store.locked) { try { store.set('song', S); store.set('songAt', Date.now()); } catch (e) { } projSave(); } });
window.addEventListener('pagehide', () => { if (!store.locked) projSave(); });

/* >>> parts/26-origins.js */
/* ============================================================
   Part 26 · ORIGINS, LIBRARY & ZOOM
   Two ways to begin — a clean canvas for a brand-new song, or "start from a song" (load a track → stems, tempo, key and
   chords fill in) — plus the song library and three zoom levels on the same document:
     Canvas  just the page: chords & lyrics, everything else out of the way
     Song    tab + chords & lyrics side by side
     Studio  arrangement, stems, takes, rig
   ============================================================ */
const ZOOM = { cur: CFG.zoom || 'studio' };
const ZOOMS = [['canvas', 'Canvas', 'Just the page: chords & lyrics, nothing else'], ['song', 'Song', 'Tab, chords & lyrics side by side'], ['studio', 'Studio', 'Arrangement, stems, takes and rig']];
const layoutPreset = n => (LAYOUTS.find(l => l[0] === n) || LAYOUTS[0])[2];
function zoomSet(z, quiet) {
  if (!quiet && z === 'studio') xpSignal(3);
  if (!ZOOMS.some(x => x[0] === z)) z = 'studio'; ZOOM.cur = z; CFG.zoom = z; saveCfg(); document.body.classList.toggle('zoom-canvas', z === 'canvas');
  if (isDesk()) {
    if (z === 'canvas') { LAY.right = true; saveLay(); applyLayout(); sideShow('refine'); }
    else if (z === 'song') applyPreset(layoutPreset('Songwriting'));
    else applyPreset(layoutPreset(STM.ch ? 'Track study' : 'Record'));
  }
  zoomSync(); if (!quiet) toast(ZOOMS.find(x => x[0] === z)[1] + ' view', ''); setTimeout(() => { try { tlSize(); } catch (e) { } window.dispatchEvent(new Event('resize')); }, 60);
}
function zoomSync() { $$('.sb-zoom button').forEach(b => b.classList.toggle('on', b.dataset.z === ZOOM.cur)); }
function zoomCtl() {
  const seg = h('div', { class: 'seg sb-zoom', role: 'group', 'aria-label': 'View: how much of the studio to show' }, ZOOMS.map(([k, n, t]) => h('button', { 'data-z': k, title: t, class: k === ZOOM.cur ? 'on' : '', onclick: () => zoomSet(k) }, n)));
  document.body.classList.toggle('zoom-canvas', ZOOM.cur === 'canvas'); return seg;
}

/* ---------- dialog helper ---------- */
function pdlg(id, title, body, o = {}) {
  const old = document.getElementById(id); if (old) { try { old.close(); } catch (e) { } old.remove(); }
  const d = h('dialog', { id, class: 'pdlg' + (o.wide ? ' wide' : '') + (o.cls ? ' ' + o.cls : '') }, h('div', { class: 'dlg-h' }, title, h('button', { class: 'btn sm', onclick: () => d.close() }, 'Close')), h('div', { class: 'dlg-b pd-b', style: { display: 'block' } }, body));
  d.addEventListener('close', () => { d.remove(); if (o.onclose) o.onclose(); }); document.body.append(d); if (d.showModal) d.showModal(); else d.setAttribute('open', ''); return d;
}
const pField = (label, el) => h('label', { class: 'pd-f' }, h('span', {}, label), el);
const pSel = (opts, v, fn) => h('select', { class: 'in', onchange: e => fn(e.target.value) }, opts.map(([k, t]) => h('option', { value: k, selected: String(k) === String(v) }, t)));

/* ---------- two origins ---------- */
function originsOpen(o = {}) {
  const f = { title: '', bpm: 92, key: 9, minor: true, ts: '4/4', tuning: 'Standard (E A D G B E)', form: 'empty' };
  let chosen = false; if (o.first && !PRJ.cur) PRJ.fresh = true;
  const close = () => { chosen = true; const d = document.getElementById('origins'); if (d) d.close(); };
  const startBlank = async () => { close(); await projCreate('blank', Object.assign({}, f, { ts: f.ts.split('/').map(Number), zoom: 'song' })); sideShow('refine'); setTimeout(() => { if (SB.f.title) { SB.f.title.focus(); SB.f.title.select(); } }, 80); };
  const pick = h('input', { type: 'file', accept: 'audio/*,.mp3,.wav,.flac,.m4a,.ogg', style: { display: 'none' }, onchange: e => { const fl = e.target.files[0]; e.target.value = ''; if (fl) { close(); projFromTrack(fl); } } });
  const opt = h('details', { class: 'pd-opt' }, h('summary', {}, 'Set it up first (optional)'), h('div', { class: 'pd-form' },
    pField('Tempo', h('input', { class: 'in', type: 'number', min: 30, max: 260, value: f.bpm, onchange: e => { f.bpm = +e.target.value || 92; } })), pField('Key', pSel(NS.map((n, i) => [i, n]), f.key, v => { f.key = +v; })), pField('Mode', pSel([['min', 'minor'], ['maj', 'major']], 'min', v => { f.minor = v === 'min'; })),
    pField('Time', pSel(['4/4', '3/4', '2/4', '5/4', '6/8', '12/8', '7/8'].map(x => [x, x]), f.ts, v => { f.ts = v; })), pField('Tuning', pSel(Object.keys(TUNINGS).map(k => [k, k]), f.tuning, v => { f.tuning = v; })),
    pField('Shape', pSel([['empty', 'An empty page (one section)'], ['vc', 'Verse · Chorus'], ['vcb', 'Verse · Chorus · Bridge']], f.form, v => { f.form = v; }))));
  const blank = h('section', { class: 'pd-card' }, h('div', { class: 'pd-ic' }, '✎'), h('h3', {}, 'Clean canvas'), h('p', { class: 'muted' }, 'A blank page for a brand-new song. Write lyrics and chords, hum an idea, record a take — nothing is pre-filled.'),
    pField('Working title', h('input', { class: 'in', placeholder: 'Untitled Idea', oninput: e => { f.title = e.target.value; }, onkeydown: e => { if (e.key === 'Enter') startBlank(); } })), opt, h('button', { class: 'btn primary pd-go', onclick: startBlank }, 'Start writing →'));
  const track = h('section', { class: 'pd-card pd-drop' }, h('div', { class: 'pd-ic' }, '♪'), h('h3', {}, 'Start from a song'), h('p', { class: 'muted' }, 'Load a track (a demo, a recording, a song you want to learn). It is split into stems and the title, tempo, key and chords fill the song in.'),
    h('button', { class: 'btn primary pd-go', onclick: () => pick.click() }, '📂 Choose an audio file…'), pick, h('div', { class: 'tiny muted', style: { margin: '6px 0 8px' } }, 'or drop a file here · stays on this device'), samplesShelf(fl => { close(); projFromTrack(fl); }, 'TRY A SAMPLE'));
  ['dragover', 'dragenter'].forEach(ev => track.addEventListener(ev, e => { e.preventDefault(); track.classList.add('over'); })); ['dragleave', 'drop'].forEach(ev => track.addEventListener(ev, () => track.classList.remove('over')));
  track.addEventListener('drop', e => { e.preventDefault(); const fl = e.dataTransfer.files[0]; if (fl) { close(); projFromTrack(fl); } });
  const hero = h('section', { class: 'pd-card pd-hero' }, h('div', { class: 'pd-ic' }, '🎤'), h('h3', {}, 'Hum or sing an idea'), h('p', {}, 'No instrument or experience needed. Hum a few seconds and hear a whole song.'),
    h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap' } }, h('button', { class: 'btn primary pd-go', id: 'originsHum', onclick: () => { close(); humOpen(); } }, '● Hum or sing'), h('span', { class: 'tiny muted' }, 'Everything stays on this device.')));
  const bund = h('input', { type: 'file', accept: '.zip,.json,.txt,.md,.lrc', style: { display: 'none' }, onchange: e => { const fl = e.target.files[0]; e.target.value = ''; if (fl) { close(); projImport(fl); } } });
  const more = h('div', { class: 'pd-more' }, PRJ.list.length ? h('button', { class: 'btn', onclick: () => { close(); libraryOpen(); } }, '☰ My songs (' + PRJ.list.length + ')') : null, h('button', { class: 'btn', title: 'A song bundle (.zip), a lyric sheet (.txt/.md) or an older project .json', onclick: () => bund.click() }, '⤒ Open a bundle or lyrics…'), bund,
    h('button', { class: 'btn', onclick: () => { close(); projCreate('demo', { zoom: 'song' }); } }, '♫ Try the demo song'));
  const d = pdlg('origins', o.first ? 'WELCOME — WHAT DO YOU WANT TO MAKE?' : 'NEW SONG — WHAT DO YOU WANT TO MAKE?', h('div', {}, hero, h('div', { class: 'pd-grid' }, blank, track), more,
    h('p', { class: 'tiny muted', style: { margin: '10px 0 0' } }, PRJ.cur ? 'Your current song is saved in My songs before the new one opens.' : 'Everything is saved on this device. Nothing is uploaded.')), {
    wide: true, onclose: () => { if (o.first && !chosen && !PRJ.cur) projCreate('demo', { zoom: 'song' }); }
  });
  setTimeout(() => { const i = $('input.in', blank); if (i) i.focus(); }, 40); return d;
}
function startMaybe() { if (PRJ.cur || store.get('started', false) || /[?&]start=0/.test(location.search) || document.getElementById('origins')) return; PRJ.fresh = true; if (CFG.route === 'stage') humStageFirst(); else humCanvasFirst(); }   // (the song on screen is only the built-in demo until the person picks something) the first thing anyone sees is the stage with one panel: hum, guitar, or a song file / blank page / demo
bus.on('booted', () => { if (PRJ.ready) startMaybe(); else PRJ.wantStart = true; });
/* a library that is unavailable (private window) still lets you begin */
function newSongGo() { originsOpen({}); }

/* ---------- library ---------- */
function libraryOpen() {
  const box = h('div', { class: 'pd-lib' }), arm = { id: null, t: 0 };
  async function draw() {
    box.innerHTML = ''; await projRefresh(); const tot = PRJ.list.reduce((a, r) => a + (r.size || 0), 0);
    box.append(h('div', { class: 'pd-head' }, h('span', { class: 'muted small' }, PRJ.ok ? PRJ.list.length + (PRJ.list.length === 1 ? ' song' : ' songs') + ' · ' + projBytes(tot) + ' on this device' : 'This browser is not keeping a library (private window?). Export bundles to keep your work.'), h('span', { class: 'grow' }),
      h('button', { class: 'btn sm primary', onclick: () => { d.close(); newSongGo(); } }, '＋ New song'), h('button', { class: 'btn sm', onclick: () => { d.close(); resetOpen(); } }, 'Reset…')));
    box.append(h('div', { class: 'tiny muted', style: { margin: '-2px 0 8px' } }, (PRJ.persisted ? '🛡 Your browser keeps this library' : 'Your browser may clear this if disk space runs low') + ' · Last backup: ' + (CFG.lastBackup ? new Date(CFG.lastBackup).toLocaleDateString() : 'never')));
    if (!PRJ.list.length) box.append(h('div', { class: 'muted', style: { padding: '18px 4px' } }, 'No songs yet.'));
    PRJ.list.forEach(r => {
      const cur = r.id === PRJ.cur, name = h('b', { class: 'pd-name' }, r.title || 'Untitled'), row = h('div', { class: 'pd-row' + (cur ? ' cur' : '') });
      const ren = () => { const inp = h('input', { class: 'in', value: r.title || '', style: { width: '100%' } }); name.replaceWith(inp); inp.focus(); inp.select(); const fin = async ok => { inp.onblur = null; if (ok) await projRename(r.id, inp.value); draw(); }; inp.onkeydown = e => { if (e.key === 'Enter') fin(true); if (e.key === 'Escape') fin(false); }; inp.onblur = () => fin(true); };
      const badge = (t, ti) => h('span', { class: 'pd-b', title: ti || '' }, t);
      const del = h('button', { class: 'btn sm bad', title: 'Delete this song and its recordings from this browser', onclick: async e => { if (arm.id !== r.id || Date.now() - arm.t > 4000) { arm.id = r.id; arm.t = Date.now(); e.target.textContent = 'Click again to delete'; return; } await projDelete(r.id); draw(); } }, 'Delete');
      row.append(h('div', { class: 'pd-main' }, name, h('div', { class: 'tiny muted' }, (r.artist ? r.artist + ' · ' : '') + (cur ? 'open now · ' : '') + projAgo(r.modified))),
        h('div', { class: 'pd-badges' }, r.origin === 'track' || r.track ? badge('♪ track', r.track ? r.track.title || r.track.name : '') : badge('✎'), r.nTakes ? badge('🎙 ' + r.nTakes, r.nTakes + ' recorded takes') : null, badge(projBytes(r.size || 0))),
        h('div', { class: 'pd-acts' }, cur ? h('button', { class: 'btn sm', disabled: true }, 'Open') : h('button', { class: 'btn sm primary', onclick: async () => { d.close(); await projLoad(r.id); } }, 'Open'),
          h('button', { class: 'btn sm', onclick: ren }, 'Rename'), h('button', { class: 'btn sm', onclick: async () => { await projDuplicate(r.id); toast('Duplicated', 'ok'); draw(); } }, 'Duplicate'), h('button', { class: 'btn sm', title: 'Download a .zip song folder: song.md, arrangement.json, audio/', onclick: () => projExport(r.id) }, '⤓ Bundle'), del));
      box.append(row);
    });
    const imp = h('input', { type: 'file', accept: '.zip,.json,.txt,.md,.lrc', style: { display: 'none' }, onchange: e => { const fl = e.target.files[0]; e.target.value = ''; if (fl) { d.close(); projImport(fl); } } });
    box.append(h('div', { class: 'pd-foot' }, h('button', { class: 'btn sm', onclick: () => imp.click() }, '⤒ Open a bundle…'), imp, PRJ.list.length > 1 ? h('button', { class: 'btn sm', title: 'One .zip with every song in its own folder', onclick: projExportAll }, '⤓ Back up all songs') : null,
      h('span', { class: 'tiny muted' }, 'A bundle is a plain folder of files — song.md opens in any text editor or Obsidian.')));
  }
  const d = pdlg('library', 'MY SONGS', box, { wide: true }); draw(); return d;
}

/* ---------- the song bar: ☰ Songs menu + zoom ---------- */
function songsMenu(anchor) {
  const box = h('div', { class: 'pd-menu' }), go = fn => () => { closePop(); fn(); };
  box.append(h('h5', {}, 'Songs'), h('button', { class: 'btn sm primary', onclick: go(newSongGo) }, '＋ New song…'), h('button', { class: 'btn sm', onclick: go(humOpen) }, '🎤 Hum or sing a song…'));
  if (PRJ.list.length) { box.append(h('div', { class: 'tiny muted', style: { margin: '8px 0 2px', fontWeight: 800, letterSpacing: '.06em' } }, 'RECENT')); PRJ.list.slice(0, 6).forEach(r => box.append(h('button', { class: 'btn sm pd-rec' + (r.id === PRJ.cur ? ' on' : ''), onclick: go(() => { if (r.id !== PRJ.cur) projLoad(r.id); }) }, h('span', {}, (r.origin === 'track' || r.track ? '♪ ' : '✎ ') + (r.title || 'Untitled')), h('i', {}, projAgo(r.modified))))); }
  box.append(h('div', { class: 'hr' }), h('button', { class: 'btn sm', onclick: go(libraryOpen) }, '☰ All songs…'), h('button', { class: 'btn sm', disabled: !PRJ.cur || !PRJ.ok, onclick: go(() => projExport(PRJ.cur)) }, '⤓ Save this song as a bundle'), h('button', { class: 'btn sm', onclick: go(() => liOpen()) }, '📋 Paste lyrics…'), h('button', { class: 'btn sm', onclick: go(resetOpen) }, 'Reset…'));
  popover(anchor, box, { style: { width: '290px', maxWidth: '92vw' } });
}
function sbProject() {
  const b = h('button', { class: 'btn sm sb-songs', title: 'Songs: new, open, bundles', 'aria-label': 'Songs', onclick: e => songsMenu(e.currentTarget) }, h('span', { class: 'sb-ic' }, '☰'), h('span', { class: 'sb-tx' }, ' Songs'));
  const n = h('button', { class: 'btn sm sb-new', title: 'New song — clean canvas, or start from a track', 'aria-label': 'New song', onclick: newSongGo }, '＋', h('span', { class: 'sb-tx' }, ' New'));
  return h('div', { class: 'sb-proj' }, b, n);
}

/* >>> parts/27-reset.js */
/* ============================================================
   Part 27 · RESET — choose exactly what to erase, and it really is erased
   The old "Reset everything" cleared storage and reloaded, but the page's save-on-exit handler then wrote the song and the
   settings straight back. Now a reset first LOCKS all writes (store.locked), tells other open tabs to do the same,
   clears the chosen parts (settings, layout, presets, history, songs + recordings, offline cache), and reloads.
   ============================================================ */
const RESET_ITEMS = [
  ['layout', 'Layout & arrangement lanes', 'Panel places, sidebar widths, lane order/colours/heights, view (Canvas / Song / Studio).'],
  ['settings', 'Settings & calibration', 'Appearance, audio and MIDI settings, input choices, camera calibration, tour progress.'],
  ['presets', 'My presets & saved layouts', 'Rig presets and layouts you saved.'],
  ['notes', 'Notebook & version history', 'Your lab notebook and the automatic song snapshots.'],
  ['songs', 'All songs & recordings', 'Every song in My songs, its takes and backing tracks. Back them up first if you want to keep any.'],
  ['cache', 'Offline copy of the app', 'The saved copy that lets the app open offline; it downloads again next visit.']
];
const rstHome = () => location.pathname + (/[?&]debug\b/.test(location.search) ? '?debug' : '');   // a clean address: no leftover parameters
let rstChan = null; try { rstChan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('the-daily-songs') : null; } catch (e) { }
if (rstChan) rstChan.onmessage = ev => { if (ev.data && ev.data.reset) { store.locked = true; clearTimeout(PRJ.timer); setTimeout(() => location.replace(rstHome()), 400); } };

async function resetRun(sel) {
  store.locked = true; clearTimeout(PRJ.timer); try { if (rstChan) rstChan.postMessage({ reset: true }); } catch (e) { }
  try { if (T.playing) stopPlay(true); } catch (e) { }
  const ls = localStorage, fw = () => Object.keys(ls).filter(k => k.startsWith('fw.')), all = sel.size === RESET_ITEMS.length;
  const cfgRaw = () => { try { return JSON.parse(ls.getItem('fw.cfg') || '{}') || {}; } catch (e) { return {}; } };
  try {
    if (all) { fw().forEach(k => ls.removeItem(k)); try { Object.keys(sessionStorage).filter(k => k.startsWith('fw.')).forEach(k => sessionStorage.removeItem(k)); } catch (e) { } }
    else {
      const c = cfgRaw();
      if (sel.has('settings')) { const keep = {}; if (!sel.has('layout')) { if (c.layout) keep.layout = c.layout; if (c.lanes) keep.lanes = c.lanes; if (c.zoom) keep.zoom = c.zoom; } ls.setItem('fw.cfg', JSON.stringify(keep)); ls.removeItem('fw.cal'); ls.removeItem('fw.tour'); ls.removeItem('fw.toured'); }
      else if (sel.has('layout')) { delete c.layout; delete c.lanes; delete c.zoom; ls.setItem('fw.cfg', JSON.stringify(c)); }
      if (sel.has('presets')) ['presets', 'layouts'].forEach(k => ls.removeItem('fw.' + k));
      if (sel.has('notes')) ['notebook', 'vhist'].forEach(k => ls.removeItem('fw.' + k));
      if (sel.has('songs')) ['song', 'songAt', 'cur', 'started'].forEach(k => ls.removeItem('fw.' + k));
    }
  } catch (e) { console.warn('reset: storage', e); }
  if (sel.has('songs')) await new Promise(res => { try { if (PRJ.db) PRJ.db.close(); } catch (e) { } let r; try { r = indexedDB.deleteDatabase(PDB_NAME); } catch (e) { return res(); } r.onsuccess = r.onerror = r.onblocked = () => res(); setTimeout(res, 1800); });
  if (sel.has('cache')) {
    try { if (window.caches) for (const k of await caches.keys()) if (/^(daily-songs-|fretwork-)/.test(k)) await caches.delete(k); } catch (e) { }
    try { if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch (e) { }
  }
  location.replace(rstHome());
}

async function resetSizes() {
  const o = { songs: PRJ.list.reduce((a, r) => a + (r.size || 0), 0), n: PRJ.list.length };
  try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); o.total = e.usage || 0; o.quota = e.quota || 0; } } catch (e) { } return o;
}
function resetOpen(preset) {
  const sel = new Set(preset || []), body = h('div', { class: 'rs-wrap' }); let armed = 0, sizes = { songs: 0, n: 0 };
  const quick = (label, items, tip) => h('button', { class: 'btn sm', title: tip, onclick: () => { sel.clear(); items.forEach(i => sel.add(i)); armed = 0; draw(); } }, label);
  function draw() {
    body.innerHTML = '';
    body.append(h('p', { class: 'small muted', style: { margin: '0 0 8px' } }, 'Choose what to erase. This only clears this browser; nothing is sent anywhere. The app restarts when it is done.'),
      h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap', margin: '0 0 8px' } }, h('span', { class: 'tiny muted', style: { fontWeight: 800 } }, 'QUICK'), quick('Layout only', ['layout'], 'Put the panels back where they started'), quick('Settings & layout', ['layout', 'settings'], 'Back to a fresh look and default audio settings; songs kept'), quick('Everything', RESET_ITEMS.map(i => i[0]), 'A factory reset: like opening the app for the first time')));
    const list = h('div', { class: 'rs-list' });
    RESET_ITEMS.forEach(([k, name, desc]) => {
      const on = sel.has(k), extra = k === 'songs' ? ' · ' + sizes.n + (sizes.n === 1 ? ' song' : ' songs') + ', ' + projBytes(sizes.songs) : '';
      list.append(h('label', { class: 'rs-it' + (on ? ' on' : '') + (k === 'songs' ? ' danger' : '') }, h('input', { type: 'checkbox', checked: on, onchange: e => { e.target.checked ? sel.add(k) : sel.delete(k); armed = 0; draw(); } }), h('span', {}, h('b', {}, name + extra), h('i', {}, desc))));
    });
    body.append(list);
    const foot = h('div', { class: 'rs-foot' });
    if (sel.has('songs') && sizes.n) foot.append(h('button', { class: 'btn sm', title: 'One .zip with every song in its own folder', onclick: async e => { e.target.disabled = true; await projExportAll(); e.target.disabled = false; } }, '⤓ Back up all songs first'));
    const go = h('button', { class: 'btn ' + (armed ? 'bad' : 'primary'), disabled: !sel.size, onclick: () => { if (!armed) { armed = 1; draw(); return; } go.disabled = true; go.textContent = 'Erasing…'; resetRun(sel); } }, !sel.size ? 'Nothing selected' : armed ? 'Click again to erase ' + sel.size + (sel.size === 1 ? ' item' : ' items') + ' and restart' : 'Reset ' + sel.size + (sel.size === 1 ? ' item…' : ' items…'));
    foot.append(h('span', { class: 'grow' }), h('button', { class: 'btn', onclick: () => $('#reset').close() }, 'Cancel'), go); body.append(foot);
  }
  pdlg('reset', 'RESET', body); draw(); resetSizes().then(s => { sizes = s; if (document.getElementById('reset')) draw(); });
}

/* >>> parts/28-about.js */
/* ============================================================
   Part 28 · ABOUT & CREDITS — shown at the end of Help & shortcuts (not a main touch point)
   Who made it, where to find the source, what it builds on, and the licences that apply.
   Edit the copy here; the links come from BRAND in 01-core.js.
   ============================================================ */
function aboutBlock() {
  const link = (label, href, cls) => h('a', { class: 'btn sm ' + (cls || ''), href, target: '_blank', rel: 'noopener noreferrer' }, label + ' ↗');
  const li = (...kids) => h('li', {}, ...kids);
  const ext = (t, href) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, t);
  const mark = () => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 100 100'); s.setAttribute('width', 42); s.setAttribute('height', 42); s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<path d="M50 6L88.11 28L88.11 72L50 94L11.89 72L11.89 28Z" fill="none" stroke="var(--accent)" stroke-width="3.3" stroke-linejoin="miter"/><path d="M11.89 28L50 50L88.11 28M50 50L50 94" fill="none" stroke="var(--accent)" stroke-width="2.1" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M35 83.29V77.29M40 86.18V76.18M45 89.06V75.06M55 89.06V75.06M60 86.18V76.18M65 83.29V77.29" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="butt"/><path transform="translate(50 29.5)" d="M-6.4 -6.8H6.4M0 -6.8V7.6" fill="none" stroke="var(--text)" stroke-width="3" stroke-linejoin="miter" stroke-linecap="butt"/><path transform="translate(29.6 55.4)" d="M-3.8 -7.6H.4A7.8 7.6 0 0 1 .4 7.6H-3.8Z" fill="none" stroke="var(--text)" stroke-width="3" stroke-linejoin="miter" stroke-linecap="butt"/><path transform="translate(68.4 55.4)" d="M5 -4.6C4.1 -6.8 2.3 -7.8 0 -7.8C-3.2 -7.8 -5 -6.3 -5 -4C-5 -1.8 -3 -.9 0 0C3 .9 5 1.8 5 4.1C5 6.4 3.2 7.8 0 7.8C-2.3 7.8 -4.1 6.9 -5 4.9" fill="none" stroke="var(--text)" stroke-width="3" stroke-linejoin="miter" stroke-linecap="butt"/>'; return s; };
  return h('section', { class: 'ab', 'aria-label': 'About' },
    h('div', { class: 'ab-top' }, mark(), h('div', {}, h('b', { class: 'ab-name' }, h('span', {}, 'the-daily'), h('span', { class: 'tld' }, '.studio')), h('div', { class: 'tiny muted' }, 'MVP 1 · v' + VERSION + ' · MIT licence'))),
    h('div', { class: 'ab-me ab-story' },
      h('h4', {}, 'Made for creators.'),
      h('p', {}, 'My mom put a guitar in my hands when I was five. It changed my life.'),
      h('p', {}, 'I didn’t grow up surrounded by instruments, studios, or technology. What I had was curiosity, persistence, and a desire to make music anyway.'),
      h('p', {}, 'the-daily.studio is built around that same idea.'),
      h('p', {}, 'It’s a place to explore sounds, understand songs, develop your ear, and capture ideas while inspiration is still fresh. The tools are simple, practical, and designed for people who want to create more than they want to learn software.'),
      h('p', {}, 'Built by a musician, software engineer, and dad who still believes great ideas can start with a guitar and a little curiosity.'),
      h('p', {}, 'Because sometimes all it takes is one spark, one melody, or one small breakthrough to change the direction of a day, a song, or even a life.'),
      h('p', {}, 'May this bring you joy!'),
      h('p', {}, 'Welcome to the-daily.studio'),
      h('p', { class: 'ab-sig' }, '— Tehau.'),
      h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, BRAND.support ? link('☕ ' + BRAND.supportLabel, BRAND.support, 'primary') : '', link('GitHub', BRAND.github), link('LinkedIn', BRAND.linkedin), link('The Daily', BRAND.journal), link('Source & issues', BRAND.repo))),
    h('details', { class: 'ab-cr' }, h('summary', {}, 'Credits & licences'),
      h('ul', {},
        li(h('b', {}, 'Code: '), 'MIT licence, © 2026 ' + BRAND.author + '. Free to use, copy, change and share; keep the licence notice.'),
        li(h('b', {}, 'Built with: '), 'the Web Audio API, AudioWorklet, Canvas, SVG and IndexedDB. No frameworks, no tracking, no analytics.'),
        li(h('b', {}, 'Hand tracking and person cut-out (optional): '), 'use ', ext('MediaPipe Tasks Vision', 'https://developers.google.com/mediapipe'), ' with its hand-landmarker and selfie-segmenter models by Google, Apache-2.0, fetched from jsDelivr and Google Storage only when you switch hand tracking on, or choose “Me in front” for the camera. Motion-only mode and the edges-in look stay offline.'),
        li(h('b', {}, 'Methods: '), 'YIN pitch estimation (de Cheveigné & Kawahara, 2002); harmonic / percussive separation by median filtering (Fitzgerald, 2010); Karplus–Strong string synthesis (1983). Re-implemented here from the published papers.'),
        li(h('b', {}, 'Type: '), 'Inter and Montserrat (SIL Open Font Licence 1.1) are built into the page; nothing is downloaded. Other typefaces in Appearance use fonts already on your device.'),
        li(h('b', {}, 'Names: '), 'Ultimate Guitar, Focusrite, Scarlett, MIDI, Google and other names are used only to describe compatibility. This project is independent and not affiliated with or endorsed by them.'),
        li(h('b', {}, 'Made with AI assistance: '), 'developed with Claude (Anthropic) under my direction. The design choices, the music and any mistakes are mine.')),
      h('p', { class: 'tiny muted' }, 'Full notices: THIRD_PARTY_NOTICES.md and PRIVACY.md in the repository.')),
    h('p', { class: 'tiny muted', style: { marginBottom: 0 } }, 'Your songs, recordings and settings stay in this browser. The only requests this page can make are the optional hand-tracking and cut-out files above.'));
}

/* >>> parts/29-guard.js */
/* ============================================================
   Part 29 · GUARD — a last line of defence: an unexpected error tells you plainly, once in a while, that your songs are safe
   (they are saved on every change). Browser noise that is not a real fault is ignored.
   ============================================================ */
const GUARD = { at: 0, n: 0 };
function guardReport(err) {
  const msg = String((err && err.message) || err || ''); GUARD.n++;
  if (!msg || /ResizeObserver|AbortError|NotAllowedError|The play\(\) request|Script error|Non-Error promise rejection/i.test(msg)) return;
  console.warn('[the-daily.studio]', err);
  if (Date.now() - GUARD.at < 20000) return; GUARD.at = Date.now();
  try { toast('Something went wrong. Your songs are saved on this device. If it keeps happening, reload the page or report it on GitHub.', 'warn'); } catch (e) { }
}
window.addEventListener('error', e => guardReport(e.error || e.message));
window.addEventListener('unhandledrejection', e => guardReport(e.reason));

/* >>> parts/30-audio-control.js */
/* ---------- Audio control: nothing is switched on until you choose, and one kill switch turns it all off ----------
   Header button (always visible) → this panel: start the engine, pick an input, connect / release the microphone, monitoring,
   and KILL AUDIO (also Ctrl + .). The app never asks for the microphone by itself unless you tick "Reconnect my last input". */
const AK = { killed: false };
function closeInput() {
  try { if (E.stream) E.stream.getTracks().forEach(t => t.stop()); } catch (e) { }
  try { if (E.src) E.src.disconnect(); } catch (e) { }
  E.stream = null; E.src = null; E.hasInput = false; bus.emit('input', null);
}
function audioKill(quiet) {
  try { if (typeof humAbort === 'function') humAbort(); } catch (e) { }
  try { if (T.rec || T.playing) stopPlay(false); } catch (e) { }
  try { if (CFG.monitor) setMonitor(false); } catch (e) { }
  closeInput(); try { if (E.ctx && E.ctx.state === 'running') E.ctx.suspend(); } catch (e) { }
  AK.killed = true; bus.emit('audiostate'); if (!quiet) toast('Audio killed: playback stopped, monitor off, microphone released. Open Audio to resume.', 'warn');
}
async function audioResume() { AK.killed = false; try { await startAudio(); } catch (e) { toast('Audio could not restart: ' + e.message, 'bad'); } bus.emit('audiostate'); }
function audioState() {
  if (AK.killed) return ['bad', 'Audio killed']; if (!E.ctx || E.ctx.state !== 'running') return ['', 'Audio off'];
  return E.hasInput ? ['on', 'Input live'] : ['warn', 'No input'];
}
function audioButton() {
  const led = h('i', { class: 'led' }), txt = h('span', { class: 'lbl' }, 'Audio off');
  UI.aud = h('button', { class: 'btn sm aud', title: 'Audio: start, choose an input, monitoring and the kill switch (Ctrl + .)', 'aria-haspopup': 'dialog', onclick: audioOpen }, led, txt);
  const sync = () => { const [c, t] = audioState(); led.className = 'led ' + c; txt.textContent = t; UI.aud.classList.toggle('killed', AK.killed); };
  ['audio:ready', 'input', 'monitor', 'audiostate', 'devices'].forEach(ev => bus.on(ev, sync)); setInterval(sync, 1000); sync(); return UI.aud;
}
function audioOpen() {
  const body = h('div', { class: 'aud-b' });
  async function connect(id) {
    AK.killed = false; try { await startAudio(); } catch (e) { toast('Audio could not start: ' + e.message, 'bad'); return; }
    const ok = id ? await openInput(id) : await pickInput(); await listDevices(); bus.emit('audiostate'); if (ok && !CFG.monitor) toast('Input connected. Monitoring is off; use headphones, then tick “Hear myself”.', 'ok');
  }
  function draw() {
    const [c, t] = audioState(), on = E.ctx && E.ctx.state === 'running', cur = (E.inSettings && E.inSettings.deviceId) || CFG.inDev || '', list = (E.devs.in || []).filter(d => d.deviceId !== 'communications');
    const sel = h('select', { class: 'in', 'aria-label': 'Input device', style: { fontFamily: 'var(--sans)', width: '100%' } }, h('option', { value: '' }, list.length ? 'Choose an input…' : 'Default input'), list.map((d, i) => h('option', { value: d.deviceId, selected: d.deviceId === cur && E.hasInput }, d.label || ('Input ' + (i + 1)))));
    body.innerHTML = ''; body.append(
      h('div', { class: 'aud-st ' + c }, h('i', { class: 'led ' + c }), h('b', {}, t), h('span', { class: 'muted' }, AK.killed ? ' Everything is stopped and the microphone is released.' : !on ? ' Nothing is running and nothing has been asked of your microphone.' : E.hasInput ? ' ' + ((E.stream && E.stream.getAudioTracks()[0] || {}).label || 'Your input is on.') : ' The engine is on; your microphone is still off.')),
      AK.killed ? h('button', { class: 'btn primary', onclick: async () => { await audioResume(); draw(); } }, '▶ Resume audio (microphone stays off)') : '',
      !on && !AK.killed ? h('button', { class: 'btn primary', onclick: async () => { try { await startAudio(); } catch (e) { toast(e.message, 'bad'); } bus.emit('audiostate'); draw(); } }, '▶ Start audio engine (no microphone)') : '',
      h('div', { class: 'lk-sec' }, 'INPUT'),
      h('div', { class: 'row', style: { gap: '8px' } }, sel, E.hasInput
        ? h('button', { class: 'btn', onclick: () => { closeInput(); bus.emit('audiostate'); draw(); } }, 'Disconnect')
        : h('button', { class: 'btn primary', onclick: async () => { await connect(sel.value); draw(); } }, '🎙 Connect')),
      E.hasInput ? h('div', { class: 'row', style: { gap: '8px', marginTop: '6px' } }, h('button', { class: 'btn sm', onclick: async () => { await connect(sel.value); draw(); } }, 'Use the selected input')) : '',
      h('div', { class: 'tiny muted' }, 'Your browser will ask for permission the first time. Guitar and vocal channel routing, trim and the loopback test are in the I/O panel.'),
      h('div', { class: 'lk-sec' }, 'MONITORING'),
      h('label', { class: 'row', style: { gap: '8px' } }, h('input', { type: 'checkbox', checked: !!CFG.monitor, onchange: e => { setMonitor(e.target.checked); } }), h('span', {}, 'Hear myself through the app (use headphones)')),
      h('label', { class: 'row', style: { gap: '8px' } }, h('input', { type: 'checkbox', checked: !!CFG.autoIn, onchange: e => { CFG.autoIn = e.target.checked; saveCfg(); } }), h('span', {}, 'Reconnect my last input when the app opens (off by default)')),
      h('div', { class: 'lk-sec' }, 'KILL SWITCH'),
      h('button', { class: 'btn aud-kill', onclick: () => { audioKill(); draw(); } }, '⏹ KILL AUDIO · Ctrl + .'),
      h('div', { class: 'tiny muted' }, 'Stops playback and recording, turns monitoring off, releases the microphone and suspends the audio engine. Use it for feedback or a runaway sound.'));
  }
  const d = pdlg('audio', 'AUDIO', body, { cls: 'auddlg' }); draw(); const redraw = () => { if (document.getElementById('audio')) draw(); }; ['input', 'monitor', 'audiostate', 'devices'].forEach(ev => bus.on(ev, redraw)); d.addEventListener('close', () => ['input', 'monitor', 'audiostate', 'devices'].forEach(ev => bus.off && bus.off(ev, redraw)));
}
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === '.') { e.preventDefault(); audioKill(); } }, true);

/* >>> parts/31-hum-engine.js */
/* ============================================================
   Part 31 · Hum to Song: engine. Everything here runs on the device.
   hear (pitch track) → notes → tempo → key → chords → sections → band
   ============================================================ */
const HUM_STYLES = {
  Folk: { kit: 'Acoustic', pat: 'Folk Backbeat', bass: 'Root–Fifth', comp: 'Folk D-DU-UDU', compInst: 'Steel', lead: 'Nylon', hint: 'Warm, strummed, backbeat' },
  Pop: { kit: 'Acoustic', pat: 'Pop Groove', bass: 'Eighths', comp: 'Pop 8ths', compInst: 'Steel', lead: 'Electric', hint: 'Bright, steady, radio-ready' },
  Rock: { kit: 'Rock Room', pat: 'Rock 8ths', bass: 'Eighths', comp: 'Power Chug 8ths', compInst: 'Electric', lead: 'Electric', hint: 'Driving, palm-muted power chords' },
  Ballad: { kit: 'Brush (soft)', pat: 'Folk Backbeat', bass: 'Root Whole', comp: 'Ballad Arpeggio', compInst: 'Nylon', lead: 'Nylon', hint: 'Soft brushes, rolling arpeggios' },
  Dance: { kit: '808', pat: 'Four on the Floor', bass: 'Syncopated', comp: 'Pop 16th shimmer', compInst: 'Steel', lead: 'Steel', hint: 'Four on the floor, shimmering chords' }
};
const HUM_FORMS = { full: 'Full song · intro, verses, choruses, bridge, outro', quick: 'Quick sketch · verse and chorus' };
const HUM_PROGS = {
  major: { chorus: ['I V vi IV', 'vi IV I V', 'I vi IV V', 'IV I V vi', 'I IV vi V'], bridge: ['vi ii IV V', 'ii V vi IV', 'IV V iii vi'], outro: 'IV I' },
  minor: { chorus: ['i VI III VII', 'i VII VI VII', 'VI VII i i', 'i iv VII III', 'III VII i VI'], bridge: ['iv i VI VII', 'VI VII III iv', 'iv VI VII i'], outro: 'VI i' }
};
/* how pleasing it is to move from one chord function to the next (scale degree → scale degree; 7 is the major V of a minor key) */
const HUM_TR = {
  major: { '0>3': .6, '0>4': .6, '0>5': .6, '0>1': .3, '0>2': .2, '1>4': .9, '1>5': .2, '2>5': .6, '2>3': .5, '3>4': .8, '3>0': .6, '3>1': .4, '4>0': .9, '4>5': .6, '4>3': .3, '5>3': .7, '5>1': .5, '5>4': .4 },
  minor: { '0>5': .6, '0>6': .6, '0>3': .5, '0>2': .4, '6>2': .6, '6>0': .7, '6>5': .4, '5>6': .7, '5>2': .4, '5>7': .5, '2>6': .5, '2>5': .6, '2>3': .4, '3>0': .5, '3>7': .8, '3>6': .4, '7>0': .9, '7>5': .5, '4>0': .6 }
};
const humYield = () => new Promise(r => setTimeout(r, 0));
const humNoteName = m => pcName(((Math.round(m) % 12) + 12) % 12, CFG.flats) + (Math.floor(Math.round(m) / 12) - 1);

/** Mono pitch tracker (YIN) over a whole recording. Returns per-frame f0, clarity and loudness. */
async function humPitch(x, sr, onProg) {
  const f = Math.max(1, Math.round(sr / 16000)), fs = sr / f, n = Math.floor(x.length / f), y = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < f; k++) s += x[i * f + k] || 0; y[i] = s / f; }
  let pi = 0, po = 0; for (let i = 0; i < n; i++) { const v = y[i]; po = .98 * (po + v - pi); pi = v; y[i] = po; }   // drop rumble below ~50 Hz
  const W = 640, hop = 256, tMin = Math.max(2, Math.floor(fs / 1000)), tMax = Math.floor(fs / 75), nF = Math.max(0, Math.floor((n - W - tMax) / hop));
  const f0 = new Float32Array(nF), clar = new Float32Array(nF), rms = new Float32Array(nF), d = new Float32Array(tMax + 2);
  for (let fi = 0; fi < nF; fi++) {
    const p = fi * hop; let e = 0; for (let i = 0; i < W; i++) e += y[p + i] * y[p + i]; rms[fi] = Math.sqrt(e / W);
    if (rms[fi] > 1e-4) {
      for (let tau = 1; tau <= tMax; tau++) { let s = 0; for (let i = 0; i < W; i++) { const t = y[p + i] - y[p + i + tau]; s += t * t; } d[tau] = s; }
      let run = 0; d[0] = 1; for (let tau = 1; tau <= tMax; tau++) { run += d[tau]; d[tau] = d[tau] * tau / (run || 1); }
      let tau = -1; for (let t = tMin; t <= tMax; t++) if (d[t] < .15) { while (t + 1 <= tMax && d[t + 1] < d[t]) t++; tau = t; break; }
      if (tau < 0) { let mn = 1e9, mi = -1; for (let t = tMin; t <= tMax; t++) if (d[t] < mn) { mn = d[t]; mi = t; } if (mn < .3) tau = mi; }
      if (tau > 1 && tau < tMax) { const a = d[tau - 1], b = d[tau], c = d[tau + 1], den = 2 * (a - 2 * b + c), sh = den ? clamp((a - c) / den, -1, 1) : 0; f0[fi] = fs / (tau + sh); clar[fi] = clamp(1 - b, 0, 1); }
    }
    if (fi % 120 === 119) { if (onProg) onProg(fi / nF); await humYield(); }
  }
  return { f0, clar, rms, hop, fs, W, dt: hop / fs, lead: W / 2 / fs };
}

/** Pitch track → a list of sung notes {t, d, m} (seconds, MIDI), with the singer's tuning drift removed. */
function humNotes(P) {
  const nF = P.f0.length, rs = Array.from(P.rms).sort((a, b) => a - b), ref = rs[Math.floor(rs.length * .9)] || 0, gate = Math.max(.004, ref * .12);
  const midi = new Float32Array(nF).fill(NaN);
  for (let i = 0; i < nF; i++) {
    let lm = 0; for (let k = Math.max(0, i - 12); k <= Math.min(nF - 1, i + 12); k++) if (P.rms[k] > lm) lm = P.rms[k];
    if (P.f0[i] > 0 && P.clar[i] > .55 && P.rms[i] > gate && P.rms[i] > .3 * lm) midi[i] = 69 + 12 * Math.log2(P.f0[i] / 440);
  }
  let sx = 0, sy = 0, cnt = 0; for (let i = 0; i < nF; i++) if (!isNaN(midi[i])) { sx += Math.cos(2 * Math.PI * midi[i]); sy += Math.sin(2 * Math.PI * midi[i]); cnt++; }
  const off = cnt ? Math.atan2(sy, sx) / (2 * Math.PI) : 0;       // −.5…+.5 semitone: how flat or sharp the whole hum sat
  const m = new Float32Array(nF); for (let i = 0; i < nF; i++) m[i] = isNaN(midi[i]) ? NaN : midi[i] - off;
  const med = (a, i, r) => { const v = []; for (let k = Math.max(0, i - r); k <= Math.min(a.length - 1, i + r); k++) if (!isNaN(a[k])) v.push(a[k]); if (!v.length) return NaN; v.sort((p, q) => p - q); return v[v.length >> 1]; };
  const sm = new Float32Array(nF); for (let i = 0; i < nF; i++) sm[i] = isNaN(m[i]) ? NaN : med(m, i, 2);
  const notes = []; let cur = null, gap = 0;
  const close = () => { if (!cur) return; const dur = (cur.e - cur.s + 1) * P.dt; if (dur >= .09) { const v = cur.v.slice().sort((a, b) => a - b); notes.push({ t: cur.s * P.dt + P.lead, d: dur, m: Math.round(v[v.length >> 1]) }); } cur = null; };
  for (let i = 0; i < nF; i++) {
    const v = sm[i];
    if (isNaN(v)) { gap++; if (gap > 2) close(); continue; }
    const mean = cur ? cur.v.slice(-8).reduce((a, b) => a + b, 0) / Math.min(8, cur.v.length) : 0;
    if (cur && Math.abs(v - mean) < .75) { cur.e = i; cur.v.push(v); gap = 0; } else { close(); cur = { s: i, e: i, v: [v] }; gap = 0; }
  }
  close(); return { notes, tune: off };
}

/** Tempo from where the notes start and how long they last (beat and eighth-note comb), nudged toward everyday tempos. */
function humTempo(notes) {
  if (notes.length < 4) return 90;
  const t0 = notes[0].t; let best = 90, bs = -1e9;
  for (let b = 60; b <= 168; b += .5) {
    const beat = 60 / b; let so = 0, sd = 0;
    notes.forEach(n => { const u = (n.t - t0) / beat; so += Math.cos(2 * Math.PI * u) + .6 * Math.cos(4 * Math.PI * u); sd += Math.cos(4 * Math.PI * n.d / beat); });
    const s = so / notes.length + .4 * sd / notes.length - .6 * Math.pow(Math.log2(b / 100), 2);
    if (s > bs) { bs = s; best = b; }
  }
  return Math.round(best);
}

/** Snap the notes onto a grid of 16th-note slots. First note = bar 1, beat 1. */
function humQuant(notes, bpm) {
  if (!notes.length) return [];
  const sd = 15 / bpm, t0 = notes[0].t, g = bpm > 100 ? 2 : 1, out = [];
  for (const n of notes) {
    const s = Math.round((n.t - t0) / sd / g) * g; let e = Math.round((n.t + n.d - t0) / sd / g) * g; if (e <= s) e = s + g;
    const p = out[out.length - 1];
    if (p && s < p.s + p.l) { if (s <= p.s) { if (e - s > p.l) { p.l = e - s; p.m = n.m; } continue; } p.l = s - p.s; }
    out.push({ s, l: e - s, m: n.m });
  }
  return out;
}

/** Key by weighting pitch classes with how long they were held; the last note counts extra (songs come home). */
function humKey(q) {
  const hist = new Array(12).fill(0); q.forEach((n, i) => { hist[((n.m % 12) + 12) % 12] += n.l * (i === q.length - 1 ? 1.8 : 1) * (i === 0 ? 1.25 : 1); });
  if (!hist.some(v => v > 0)) return { root: 9, minor: true, r: 0 };
  const r = detectKey(hist), a = r[0], last = ((q[q.length - 1].m % 12) + 12) % 12;
  const b = r.find(k => k.minor !== a.minor && ((k.root - a.root + 12) % 12 === (a.minor ? 3 : 9)));      // the relative major / minor
  if (b && a.r - b.r < .04 && b.root === last && a.root !== last) return { root: b.root, minor: b.minor, r: b.r };
  return { root: a.root, minor: a.minor, r: a.r };
}

function humCands(root, minor) {
  const sn = minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)', fl = keyUsesFlats(root, minor), c = [];
  diatonic(root, sn).forEach(x => { if (/dim$/.test(x.triad)) return; const mi = /m$/.test(x.triad); c.push({ deg: x.deg, sym: x.triad, pcs: [x.root, (x.root + (mi ? 3 : 4)) % 12, (x.root + 7) % 12], rt: x.root }); });
  if (minor) { const v = (root + 7) % 12; c.push({ deg: 7, sym: pcName(v, fl), pcs: [v, (v + 4) % 12, (v + 7) % 12], rt: v }); }
  return c;
}

/** Choose a chord for every half bar: fit to the melody, favour natural chord movement, avoid fussy changes (Viterbi). Returns one string per bar. */
function humHarmonize(q, bars, key, seed) {
  const cands = humCands(key.root, key.minor), TR = HUM_TR[key.minor ? 'minor' : 'major'], sc = SCALES[key.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)'], inKey = new Set(sc.map(i => (key.root + i) % 12));
  const U = bars * 2, us = 8, score = [];
  for (let u = 0; u < U; u++) {
    const row = cands.map(() => 0); let tot = 0;
    q.forEach(n => {
      const a = Math.max(n.s, u * us), b = Math.min(n.s + n.l, (u + 1) * us), ov = b - a; if (ov <= 0) return; tot += ov; const pc = ((n.m % 12) + 12) % 12, acc = n.s >= u * us && n.s % 4 === 0 ? 1.3 : 1;
      cands.forEach((c, ci) => { const i = c.pcs.indexOf(pc); row[ci] += ov * acc * (i === 0 ? 1 : i === 1 ? .85 : i === 2 ? .7 : (inKey.has(pc) ? -.15 : -.5)); });
    });
    score.push(row.map((v, ci) => (tot ? v / tot : 0) + (seed ? (((seed * 7919 + u * 131 + ci * 31) % 97) / 97) * .25 : 0)));
  }
  const V = [], B = [];
  for (let u = 0; u < U; u++) {
    const v = [], bp = [];
    cands.forEach((c, ci) => {
      let best = -1e9, bi = 0;
      if (u === 0) best = (c.deg === 0 ? .8 : 0); else cands.forEach((p, pi) => {
        let t = p === c ? (u % 2 === 0 ? -.1 : .1) : (TR[p.deg + '>' + c.deg] || 0) - (u % 2 ? .5 : 0); const s = V[u - 1][pi] + t; if (s > best) { best = s; bi = pi; }
      });
      v.push(best + score[u][ci] + (u === U - 1 ? (c.deg === 0 ? .5 : c.deg === 4 || c.deg === 7 ? .25 : 0) : 0)); bp.push(bi);
    });
    V.push(v); B.push(bp);
  }
  let ci = V[U - 1].indexOf(Math.max(...V[U - 1])); const path = new Array(U);
  for (let u = U - 1; u >= 0; u--) { path[u] = ci; ci = B[u][ci]; }
  const out = []; for (let b = 0; b < bars; b++) { const x = cands[path[b * 2]].sym, y = cands[path[b * 2 + 1]].sym; out.push(x === y ? x : x + ' ' + y); }
  return out;
}

/* melody helpers: move notes by scale steps so they stay in key */
function humSteps(key) {
  const sc = SCALES[key.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)'];
  return {
    to: m => { const rel = m - key.root, o = Math.floor(rel / 12), p = ((rel % 12) + 12) % 12; let di = 0, bd = 99; sc.forEach((s, i) => { const dd = Math.abs(s - p); if (dd < bd) { bd = dd; di = i; } }); return o * 7 + di; },
    from: st => key.root + 12 * Math.floor(st / 7) + sc[((st % 7) + 7) % 7]
  };
}
/** Nudge notes that land on a strong beat onto the nearest chord tone (one scale step at most). */
function humSnapToChords(mel, chords, key) {
  const { to, from } = humSteps(key), cm = {}; const pcsOf = sym => { if (!cm[sym]) { const c = parseChord(sym); cm[sym] = c ? c.pcs : []; } return cm[sym]; };
  return mel.map(n => {
    if (n.s % 4 !== 0) return n; const bar = Math.floor(n.s / 16), cs = (chords[bar] || '').split(' ').filter(Boolean); if (!cs.length) return n;
    const sym = cs[Math.min(cs.length - 1, Math.floor((n.s % 16) / (16 / cs.length)))], pcs = pcsOf(sym); if (pcs.includes(((n.m % 12) + 12) % 12)) return n;
    const st = to(n.m); for (const dlt of [1, -1]) { const m2 = from(st + dlt); if (pcs.includes(((m2 % 12) + 12) % 12)) return Object.assign({}, n, { m: m2 }); } return n;
  });
}
const humCutBars = (mel, bars) => mel.filter(n => n.s < bars * 16);

/** Guitar fingering for a melody note: stay near the previous one, stay low on the neck. */
function humFret(m, prev) {
  let best = null, bc = 1e9;
  for (let st = 0; st < S.tuning.length; st++) {
    const f = m - (S.tuning[st] + S.capo); if (f < 0 || f > 14) continue;
    const c = (prev ? Math.abs(st - prev.st) * .6 + Math.abs(f - prev.f) * .25 : st * .05) + (f > 9 ? .5 : 0) + (f === 0 ? -.2 : 0);
    if (c < bc) { bc = c; best = { st, f }; }
  }
  return best;
}
function humPlaceMelody(sec, mel) {
  let prev = null; mel.slice().sort((a, b) => a.s - b.s).forEach(n => {
    const bi = Math.floor(n.s / 16); if (bi >= sec.bars.length) return; let m = n.m; while (m < S.tuning[0] + S.capo) m += 12; while (m > S.tuning[0] + S.capo + 38) m -= 12;
    const p = humFret(m, prev); if (!p) return; prev = p; sec.bars[bi].tab.push({ s: n.s % 16, st: p.st, f: p.f, t: '' });
  });
}

/** Everything the app needs from a recording, computed once. */
async function humAnalyze(pcm, sr, onProg) {
  const P = await humPitch(pcm, sr, onProg), { notes, tune } = humNotes(P);
  return { notes, tune, dur: pcm.length / sr, bpm: humTempo(notes), key: notes.length ? humKey(humQuant(notes, humTempo(notes))) : { root: 9, minor: true, r: 0 } };
}

/** Build a complete song object from the analysis and the person's choices (style, form, tempo, key, seed). */
function humSong(an, o = {}) {
  const style = HUM_STYLES[o.style] ? o.style : humPickStyle(an), st = HUM_STYLES[style], bpm = clamp(Math.round(o.bpm || an.bpm), 50, 200), form = o.form || 'full', seed = o.seed | 0;
  const key = { root: o.key != null ? o.key : an.key.root, minor: o.minor != null ? o.minor : an.key.minor };
  let mel = humQuant(an.notes, bpm); if (!mel.length) mel = [{ s: 0, l: 4, m: 60 + key.root }];
  const ms = mel.map(n => n.m).sort((a, b) => a - b), shift = 12 * Math.round((62 - ms[ms.length >> 1]) / 12); mel = mel.map(n => Object.assign({}, n, { m: n.m + shift }));
  let bars = o.verse ? o.verse.length : Math.ceil(Math.max(...mel.map(n => n.s + n.l)) / 16); bars = clamp(bars, 2, 16); if (bars % 2 && bars > 2) bars++; mel = humCutBars(mel, bars);
  const verse = o.verse || humHarmonize(mel, bars, key, seed), prog = HUM_PROGS[key.minor ? 'minor' : 'major'], tok = s => s.split(' ').map(t => romanToChord(t, key.root, key.minor));
  const choose = (list, k) => list[(seed + k) % list.length];
  const chorusP = tok(choose(prog.chorus, 0)), chorusC = bars >= 8 ? chorusP.concat(chorusP) : chorusP, bridgeC = tok(choose(prog.bridge, 1)), outroC = tok(prog.outro), introC = chorusP.slice(0, 2);
  const { to, from } = humSteps(key), cm = humCutBars(mel, 4);
  const lift = humSnapToChords(cm.map(n => Object.assign({}, n, { m: from(to(n.m) + 2) })), chorusC, key);
  const chMel = chorusC.length > 4 ? lift.concat(lift.map(n => Object.assign({}, n, { s: n.s + 64 }))) : lift;
  const piv = (() => { const a = cm.map(n => to(n.m)).sort((x, y) => x - y); return a.length ? a[a.length >> 1] : 0; })();
  const brMel = humSnapToChords(cm.map(n => Object.assign({}, n, { m: from(2 * piv - to(n.m)) })), bridgeC, key);
  const key0 = key, s = blankSong({ title: o.title || 'Hum idea', bpm, key: key0.root, minor: key0.minor, form: 'empty' });
  const secs = [], add = (name, chords, mel2) => { const sec = mkSection(name, chords); if (mel2) humPlaceMelody(sec, mel2); secs.push(sec); };
  if (form === 'full') { add('Intro', introC, null); add('Verse 1', verse, mel); add('Chorus', chorusC, chMel); add('Verse 2', verse, mel); add('Chorus', chorusC, chMel); add('Bridge', bridgeC, brMel); add('Chorus', chorusC, chMel); add('Outro', outroC, null); }
  else { add('Verse 1', verse, mel); add('Chorus', chorusC, chMel); add('Verse 2', verse, mel); add('Chorus', chorusC, chMel); }
  s.sections = secs; s.swing = 0;
  Object.assign(s.band, { drumsOn: true, kit: st.kit, patName: st.pat, pat: null, bassOn: true, bassStyle: st.bass, bassTone: style === 'Rock' ? 'Pick' : 'Round', compOn: true, compStyle: st.comp, compInst: st.compInst, leadOn: true, leadInst: st.lead });
  s.notes = 'Made from a hum with Hum to Song (' + style + ' · ' + pcName(key.root, keyUsesFlats(key.root, key.minor)) + (key.minor ? ' minor' : ' major') + ' · ' + bpm + ' BPM). The melody is yours; chords, sections and band were arranged from it.';
  return { song: s, style, bpm, key, bars, form, melody: mel };
}
function humPickStyle(an) { return an.bpm < 78 ? 'Ballad' : an.bpm > 128 ? 'Dance' : an.key.minor && an.bpm > 108 ? 'Rock' : an.bpm > 100 ? 'Pop' : 'Folk'; }

/* >>> parts/32-hum-ui.js */
/* ============================================================
   Part 32 · Hum to Song: the screens. Press, hum, hear a song.
   Microphone and camera are only requested when the person presses the button.
   ============================================================ */
const HUM = { first: false, cam0: null, ph: null, keep: false, g: null, o: { style: null, form: 'full', seed: 0, bpm: null, key: null, minor: null }, an: null, pcm: null, sr: 0, rec: null, bar: null, hear: null, r: null, busy: false };
/** the stage route (full-screen visuals + camera) is chosen on the start card or in Settings; the camera inside it can be switched off (CFG.humStage) */
const humStageOn = () => CFG.route === 'stage';
const humFmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

/** Put the person on stage: the camera behind the visuals, "me in front" (green screen) by default. One tap; asks the browser for the camera only now. */
/** the person pressed a camera button: remember the choice so the next start follows it */
function vzCamPress() { CFG.humStage = !VZ.cam; saveCfg(); return vzCenterStage(!VZ.cam); }
function vzCenterStage(on) {
  if (on && VZ.camP) return VZ.camP;   // two starts at once share one request
  const p = vzCenterStage0(on); if (on) { VZ.camP = p; p.then(() => { VZ.camP = null; }, () => { VZ.camP = null; }); } return p;
}
async function vzCenterStage0(on) {
  const bs = ['vzCamBtn', 'ioCamBtn'].map(id => document.getElementById(id)).filter(Boolean), mark = () => bs.forEach(b => b.classList.toggle('on', VZ.cam)); VZ.cam = !!on; mark();
  if (!on) { if (CAM.on) stopCam(); return; }
  if (CFG.camFx == null) { CFG.camFx = 'person'; saveCfg(); const s = document.querySelector('select[aria-label="Camera look"]'); if (s) { s.value = 'person'; s.dispatchEvent(new Event('change')); } }
  if (!CAM.on) { if (CAM.want !== 'motion' && !CAM.tracker) { CAM.want = 'motion'; if (UI.camMode) UI.camMode.value = 'motion'; } await startCam(); }
  if (!CAM.on) { VZ.cam = false; mark(); }
}
async function humStageGo() { try { dockGo('vis'); vzImmersive(true); if (CFG.humStage !== false) await vzCenterStage(true); } catch (e) { } }

/* ---------- the front screen ---------- */
function humOpen() {
  if (HUM.rec) return; humBarClose();
  const stage = h('input', { type: 'checkbox', checked: humStageOn(), id: 'humStage', onchange: e => setRoute(e.target.checked ? 'stage' : 'studio') });
  const pick = h('input', { type: 'file', accept: 'audio/*,.m4a,.mp3,.wav,.ogg,.webm,.flac', style: { display: 'none' }, onchange: e => { const f = e.target.files[0]; e.target.value = ''; if (f) { d.close(); humFromFile(f); } } });
  const devs = (E.devs.in || []).filter(d => d.deviceId !== 'communications' && d.deviceId !== 'default');
  const mic = h('select', { class: 'in', id: 'humMic', 'aria-label': 'Microphone', style: { fontFamily: 'var(--sans)', maxWidth: '100%' }, onchange: e => { CFG.inDev = e.target.value; saveCfg(); } },
    h('option', { value: '' }, 'Default microphone'), devs.map((d, i) => h('option', { value: d.deviceId, selected: d.deviceId === CFG.inDev }, d.label || ('Microphone ' + (i + 1)))));
  const body = h('div', { class: 'hum-in' },
    h('p', { class: 'hum-lead' }, 'Hum or sing a few seconds of any melody. You will hear it become a full song with a band.'),
    h('button', { class: 'btn primary hum-go', id: 'humGo', onclick: () => { d.close(); humRecord(); } }, '● Hum or sing'),
    h('div', { class: 'tiny muted' }, 'Your browser asks for the microphone only when you press the button. Nothing is uploaded.'),
    h('details', { class: 'boot-more' }, h('summary', {}, 'Options'), h('div', { class: 'hum-opts' },
      h('label', { class: 'row hum-stage', style: { gap: '8px' } }, stage, h('span', {}, 'Go on stage while I sing ', h('span', { class: 'muted' }, '(full-screen visuals with the camera; stays on this device)'))),
      h('label', { class: 'pd-f' }, h('span', {}, 'Microphone'), mic),
      h('div', {}, h('button', { class: 'btn sm', onclick: () => pick.click() }, '📂 Use a voice memo or audio file instead'), pick))));
  const d = pdlg('hum', 'HUM TO SONG', body, { cls: 'humdlg' }); setTimeout(() => { const g = document.getElementById('humGo'); if (g) g.focus(); }, 40); return d;
}

/** The very first interaction: straight to the stage (camera behind the hexagons) with two big choices. */
/** the empty "Hum idea" page made for a start panel, still untouched: reuse it instead of making another */
const humPlaceholder = () => !!HUM.ph && HUM.ph === PRJ.cur && !songHasWork() && !TAKES.length;
async function humStageFirst() {
  if (HUM.busy) return; HUM.busy = true; humBarClose();
  try { if (humPlaceholder()) dockGo('vis'); else await humNewProject(); HUM.keep = true; if (HUM.cam0 !== false && humStageOn()) await humStageGo(); } finally { HUM.busy = false; }
  humBar('start'); setTimeout(() => { const g = document.getElementById('humGo2'); if (g) g.focus(); }, 60);
}

/** The studio route's first screen: a clean canvas (the page, nothing else) with the cursor in the lyrics, and a slim bar to sing, hum or play instead. No camera, no full screen. */
async function humCanvasFirst() {
  if (HUM.busy) return; HUM.busy = true; humBarClose();
  try { await projCreate('blank', { form: 'empty', title: 'Untitled idea', zoom: 'canvas' }); HUM.ph = PRJ.cur; HUM.keep = true; zoomSet('canvas', true); sideShow('refine'); } finally { HUM.busy = false; }
  humBar('canvas'); setTimeout(() => { const t = document.querySelector('textarea.lyr'); if (t) t.focus({ preventScroll: true }); }, 120);
}

/* ---------- capture ---------- */
async function humNewProject() { await projCreate('blank', { form: 'empty', title: 'Hum idea', zoom: 'song' }); HUM.ph = PRJ.cur; dockGo('vis'); }
/** a start option other than humming: leave the empty placeholder page behind, then do it */
async function humInstead(fn) { const ph = humPlaceholder() ? HUM.ph : null; HUM.ph = null; humBarClose(); vzImmersive(false); await fn(); if (ph && ph !== PRJ.cur) { try { await projDelete(ph); } catch (e) { } } }
async function humRecord() {
  if (HUM.rec || HUM.busy) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { toast('This browser cannot record here. Choose “a voice memo or audio file” instead.', 'warn'); return humOpen(); }
  let stream; const raw = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
  try { try { stream = await navigator.mediaDevices.getUserMedia({ audio: CFG.inDev ? Object.assign({ deviceId: { exact: CFG.inDev } }, raw) : raw }); } catch (e) { if (CFG.inDev && e.name !== 'NotAllowedError' && e.name !== 'SecurityError') { stream = await navigator.mediaDevices.getUserMedia({ audio: raw }); toast('Your saved microphone is not available, so the default one is used.', 'warn'); } else throw e; } }
  catch (e) { toast('Microphone permission was not given. Allow it in the address bar, or choose a voice memo.', 'warn'); return humOpen(); }
  HUM.busy = true; try { if (HUM.keep) HUM.keep = false; else await humNewProject(); if (humStageOn()) await humStageGo(); } finally { HUM.busy = false; }
  const AC = window.AudioContext || window.webkitAudioContext, actx = new AC(), src = actx.createMediaStreamSource(stream), an = actx.createAnalyser(); an.fftSize = 2048; src.connect(an);
  const chunks = [], mr = new MediaRecorder(stream), r = { stream, actx, an, mr, chunks, t0: performance.now(), raf: 0, buf: new Float32Array(2048) };
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  mr.onstop = () => { const keep = r.keep; humRecCleanup(); if (keep) humRecDone(new Blob(chunks, { type: mr.mimeType || 'audio/webm' })); };
  try { const t = stream.getAudioTracks()[0], id = t && t.getSettings && t.getSettings().deviceId; r.label = (t && t.label) || ''; if (id && CFG.inDev !== id && CFG.inDev) { /* keep the person's choice */ } listDevices(); } catch (e) { }
  HUM.rec = r; mr.start(250); humBar('rec'); r.raf = requestAnimationFrame(humRecTick);
}
function humRecTick() {
  const r = HUM.rec; if (!r) return; r.an.getFloatTimeDomainData(r.buf); let e = 0; for (let i = 0; i < r.buf.length; i++) e += r.buf[i] * r.buf[i]; const rms = Math.sqrt(e / r.buf.length), sec = (performance.now() - r.t0) / 1000;
  const lv = document.getElementById('humLv'), nt = document.getElementById('humNote'), tm = document.getElementById('humTime');
  if (lv) lv.style.width = Math.min(100, Math.round(rms * 600)) + '%'; if (tm) tm.textContent = humFmt(sec);
  if (nt) { let t = '·'; if (rms > .01) { const y = yin(r.buf, r.actx.sampleRate); if (y && y.clarity > .6 && y.f > 70 && y.f < 1100) { const mf = 69 + 12 * Math.log2(y.f / 440); t = humNoteName(mf); HUM.live = { m: Math.round(mf), t: performance.now() }; } } nt.textContent = t; }
  if (sec > 90) { humRecStop(true); return; } r.raf = requestAnimationFrame(humRecTick);
}
function humRecStop(keep) { const r = HUM.rec; if (!r) return; r.keep = keep; cancelAnimationFrame(r.raf); try { if (r.mr.state !== 'inactive') r.mr.stop(); else { humRecCleanup(); } } catch (e) { humRecCleanup(); } }
function humRecCleanup() { const r = HUM.rec; if (!r) return; HUM.rec = null; cancelAnimationFrame(r.raf); try { r.stream.getTracks().forEach(t => t.stop()); } catch (e) { } try { r.actx.close(); } catch (e) { } }
/** called by the Audio kill switch (Ctrl + .): stop listening, stop playing the original, discard an unfinished recording */
function humAbort() {
  if (HUM.hear) { try { HUM.hear.stop(); } catch (e) { } HUM.hear = null; }
  if (HUM.rec) { humRecStop(false); humBarClose(); toast('Hum recording stopped. Nothing was kept.', 'warn'); }
}
async function humDecode(ab) {
  const O = window.OfflineAudioContext || window.webkitOfflineAudioContext, oc = new O(1, 44100, 44100), b = await oc.decodeAudioData(ab), n = Math.min(b.length, Math.floor(b.sampleRate * 90)), out = new Float32Array(n), ch = b.numberOfChannels;
  for (let c = 0; c < ch; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i] / ch; } return { pcm: out, sr: b.sampleRate };
}
async function humRecDone(blob) { try { const { pcm, sr } = await humDecode(await blob.arrayBuffer()); await humRun(pcm, sr); } catch (e) { humBar('err', 'I could not read that recording (' + (e.message || e.name) + '). Try again, or choose an audio file.'); } }
async function humFromFile(f) {
  if (HUM.busy) return; HUM.busy = true;
  try { const { pcm, sr } = await humDecode(await f.arrayBuffer()); await humNewProject(); if (humStageOn()) humStageGo(); await humRun(pcm, sr, cleanTitle(f.name)); }
  catch (e) { humBar('err', 'I could not read that file (' + (e.message || e.name) + '). Try a WAV, MP3 or M4A voice memo.'); } finally { HUM.busy = false; }
}
async function humRun(pcm, sr, title) {
  HUM.pcm = pcm; HUM.sr = sr; HUM.o = { style: null, form: 'full', seed: 0, bpm: null, key: null, minor: null, title: title || 'Hum idea' }; humBar('work', 0);
  HUM.an = await humAnalyze(pcm, sr, p => humBar('work', p));
  if (HUM.an.notes.length < 3) return humBar('few'); await humApply(true);
}

/* ---------- build, play, tweak ---------- */
async function humApply(play) {
  if (!HUM.an) return; if (T.playing) stopPlay(true);
  const r = humSong(HUM.an, HUM.o); HUM.r = r; HUM.o.style = r.style; r.song.title = HUM.o.title || 'Hum idea';
  xpQuiet(() => projUse(r.song)); if (ZOOM.cur === 'canvas') zoomSet('song', true); humAddTake(); try { if (PRJ.cur) await projSave(); } catch (e) { }
  humBar('res'); if (play) await humPlay();
}
/** Put the recording itself in the arrangement: a Vocal take whose first note lands on the first melody note of Verse 1,
 *  so the hum, the lead tab and the band are all in one timeline and play together. Re-arranging replaces it. */
function humAddTake() {
  for (let i = TAKES.length - 1; i >= 0; i--) if (TAKES[i].hum) TAKES.splice(i, 1);
  if (!HUM.pcm || !HUM.an || !HUM.an.notes.length) { bus.emit('takes'); return null; }
  const si = Math.max(0, S.sections.findIndex(x => /^Verse/.test(x.name))), sr = HUM.sr;
  let start = secStart(si) * spb() * slotDur() - HUM.an.notes[0].t, d = HUM.pcm;
  if (start < 0) { d = d.subarray(Math.min(d.length, Math.round(-start * sr))); start = 0; }
  d = new Float32Array(d); let pk = 0, e = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; e += d[i] * d[i]; }
  const tk = { id: uid(), kind: 'vox', hum: true, name: 'My hum', startSec: start, sr, dry: d, wet: null, peaks: peaksOf(d), g: 1, pan: 0, mute: false, solo: false, mode: 'wet', bpm: S.bpm, preset: '', peak: dB(pk), rms: dB(Math.sqrt(e / Math.max(1, d.length))), dur: d.length / sr, t: Date.now(), stats: null, cam: [] };
  TAKES.push(tk); bus.emit('takes'); return tk;
}
function humSaveMenu(anchor) {
  const tk = TAKES.find(t => t.hum), box = h('div', { style: { minWidth: '240px', display: 'grid', gap: '6px' } }, h('h5', {}, 'Save to this device'),
    h('button', { class: 'btn', onclick: () => { closePop(); bounceMaster(); } }, '⤓ The whole song (WAV)'),
    tk ? h('button', { class: 'btn', onclick: () => { closePop(); dlTake(tk); } }, '⤓ My hum (WAV)') : '',
    h('button', { class: 'btn', onclick: () => { closePop(); bounceAllParts(); } }, '⤓ Each band part (WAVs)'),
    h('button', { class: 'btn', onclick: () => { closePop(); download((S.title || 'song').replace(/\W+/g, '_') + '.mid', buildMidi()); toast('MIDI saved', 'ok'); } }, '⤓ MIDI (to open in any music app)'),
    h('div', { class: 'tiny muted' }, 'Everything is made and saved here. Nothing is uploaded. WAV saves play the song once in real time.'));
  popover(anchor, box);
}
async function humPlay() {
  if (HUM.hear) { try { HUM.hear.stop(); } catch (e) { } HUM.hear = null; }
  try { if (typeof AK !== 'undefined' && AK.killed) await audioResume(); } catch (e) { }
  T.metro = false; T.cursor = 0; await play(); bus.emit('transport');
}
function humHear() {
  if (HUM.hear) { try { HUM.hear.stop(); } catch (e) { } HUM.hear = null; return humBar('res'); } if (!HUM.pcm) return; if (T.playing) stopPlay(true);
  const AC = window.AudioContext || window.webkitAudioContext, c = new AC(), b = c.createBuffer(1, HUM.pcm.length, HUM.sr); b.copyToChannel(HUM.pcm, 0); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination);
  s.onended = () => { if (HUM.hear === s) HUM.hear = null; try { c.close(); } catch (e) { } if (HUM.bar) humBar('res'); }; s.start(); HUM.hear = s; HUM.hearT0 = performance.now(); humBar('res');
}

/* ---------- the bottom panel (not a modal, so you still see yourself on stage) ---------- */
function humBarClose() { const d = document.getElementById('humbar'); if (d) { try { d.close(); } catch (e) { } d.remove(); } HUM.bar = null; }
function humBar(mode, arg) {
  let d = document.getElementById('humbar'); if (!d) { d = document.createElement('dialog'); d.id = 'humbar'; d.className = 'humbar'; d.setAttribute('aria-label', 'Hum to Song'); document.body.append(d); try { d.show(); } catch (e) { d.setAttribute('open', ''); } }
  if (mode === 'start' && CFG.route !== 'stage') mode = 'canvas';
  HUM.bar = d; d.innerHTML = ''; d.dataset.mode = mode;
  const x = h('button', { class: 'btn sm hum-x', title: 'Close this panel', 'aria-label': 'Close', onclick: () => { humAbort(); humBarClose(); } }, '✕');
  if (mode === 'rec') {
    d.append(h('div', { class: 'hum-row' }, h('button', { class: 'btn primary hum-stop', id: 'humStop', onclick: () => humRecStop(true) }, '■ Stop'), h('b', { id: 'humTime', class: 'hum-t' }, '0:00'),
      h('div', { class: 'hum-lvw', 'aria-hidden': 'true' }, h('i', { id: 'humLv' })), h('b', { id: 'humNote', class: 'hum-note', 'aria-live': 'off' }, '·'), h('span', { class: 'grow' }), x),
      h('div', { class: 'hum-msg' }, h('b', {}, 'Listening… '), 'hum or sing your idea. 10–30 seconds is plenty. Tap Stop when you are done.' + (HUM.rec && HUM.rec.label ? ' Using: ' + HUM.rec.label + '.' : '')));
  } else if (mode === 'canvas') {
    const pick = h('input', { type: 'file', accept: 'audio/*,.mp3,.wav,.flac,.m4a,.ogg', style: { display: 'none' }, 'aria-label': 'Choose a song file', onchange: e => { const fl = e.target.files[0]; e.target.value = ''; if (fl) humInstead(() => projFromTrack(fl)); } });
    d.append(h('div', { class: 'hum-row' }, h('b', { class: 'hum-hi' }, 'A clean page.'), h('span', { class: 'hum-sub muted' }, 'Write lyrics, chords or thoughts above, or sing it:'), h('span', { class: 'grow' }), x),
      h('div', { class: 'hum-row hum-big2' }, h('button', { class: 'btn primary hum-go', id: 'humGo2', onclick: () => humRecord() }, '● Sing or hum an idea'), h('button', { class: 'btn hum-go', id: 'humGuitar', onclick: () => humGuitar() }, '🎸 I have a guitar')),
      h('div', { class: 'hum-alt' }, h('span', { class: 'tiny muted' }, 'Or start from'),
        h('button', { class: 'btn sm', id: 'humAltFile', onclick: () => pick.click() }, '📂 a song file'),
        h('button', { class: 'btn sm', id: 'humAltDemo', onclick: () => humInstead(() => projCreate('demo', { zoom: 'song' })) }, '♫ the demo song'),
        h('button', { class: 'btn sm', id: 'humAltStage', title: 'Full-screen visuals with the camera', onclick: () => { humBarClose(); goOnStage(); } }, '🎥 the stage'),
        h('span', { class: 'tiny muted' }, 'Everything stays on this device.'), pick));
  } else if (mode === 'start') {
    const pick = h('input', { type: 'file', accept: 'audio/*,.mp3,.wav,.flac,.m4a,.ogg', style: { display: 'none' }, 'aria-label': 'Choose a song file', onchange: e => { const fl = e.target.files[0]; e.target.value = ''; if (fl) humInstead(() => projFromTrack(fl)); } });
    d.append(h('div', { class: 'hum-row' }, h('b', { class: 'hum-hi' }, 'Let’s make a song.'), h('span', { class: 'grow' }), x),
      h('div', { class: 'hum-msg' }, 'Hum a tune, or pick up your guitar. Either way you will hear a whole band play your song in a minute.'),
      h('div', { class: 'hum-row hum-big2' }, h('button', { class: 'btn primary hum-go', id: 'humGo2', onclick: () => humRecord() }, '● Hum or sing'), h('button', { class: 'btn hum-go', id: 'humGuitar', onclick: () => humGuitar() }, '🎸 I have a guitar')),
      h('div', { class: 'hum-alt' }, h('span', { class: 'tiny muted' }, 'Or start from'),
        h('button', { class: 'btn sm', id: 'humAltFile', onclick: () => pick.click() }, '📂 a song file'),
        h('button', { class: 'btn sm', id: 'humAltBlank', onclick: () => { HUM.ph = null; humBarClose(); vzImmersive(false); zoomSet('song', true); sideShow('refine'); setTimeout(() => { if (SB.f && SB.f.title) { SB.f.title.focus(); SB.f.title.select(); } }, 120); } }, '✎ a blank page'),
        h('button', { class: 'btn sm', id: 'humAltDemo', onclick: () => humInstead(() => projCreate('demo', { zoom: 'song' })) }, '♫ the demo song'),
        h('span', { class: 'tiny muted' }, 'Everything stays on this device.'), pick));
  } else if (mode === 'g') { humGuitarBar(d, x);
  } else if (mode === 'work') {
    d.append(h('div', { class: 'hum-row' }, h('b', {}, 'Listening back…'), h('div', { class: 'hum-lvw' }, h('i', { style: { width: Math.round((arg || 0) * 100) + '%' } })), h('span', { class: 'grow' }), x), h('div', { class: 'hum-msg' }, 'Finding your notes, tempo and key. Then the chords and the band.'));
  } else if (mode === 'few') {
    d.append(h('div', { class: 'hum-row' }, h('b', {}, 'I only caught ' + (HUM.an ? HUM.an.notes.length : 0) + ' note' + (HUM.an && HUM.an.notes.length === 1 ? '' : 's') + '.'), h('span', { class: 'grow' }), x),
      h('div', { class: 'hum-msg' }, 'Try humming a little louder and closer to the microphone, in a quiet room, holding each note for a moment.'), h('div', { class: 'hum-row' }, h('button', { class: 'btn primary', onclick: () => { humBarClose(); humRecord(); } }, '● Try again'), h('button', { class: 'btn', onclick: () => { humBarClose(); humOpen(); } }, 'Other options')));
  } else if (mode === 'err') {
    d.append(h('div', { class: 'hum-row' }, h('b', {}, 'Something went wrong'), h('span', { class: 'grow' }), x), h('div', { class: 'hum-msg' }, arg || ''), h('div', { class: 'hum-row' }, h('button', { class: 'btn primary', onclick: () => { humBarClose(); humOpen(); } }, 'Try again')));
  } else { humResult(d, x); }
}
function humResult(d, x) {
  const r = HUM.r, o = HUM.o, an = HUM.an, kn = pcName(r.key.root, keyUsesFlats(r.key.root, r.key.minor)) + (r.key.minor ? ' minor' : ' major');
  const again = () => humApply(T.playing || true);
  const chips = h('div', { class: 'hum-chips', role: 'group', 'aria-label': 'Band style' }, Object.keys(HUM_STYLES).map(k => h('button', { class: 'btn sm' + (o.style === k ? ' on' : ''), title: HUM_STYLES[k].hint, 'aria-pressed': String(o.style === k), onclick: () => { o.style = k; again(); } }, k)));
  const tempo = h('input', { class: 'in hum-bpm', type: 'number', min: 50, max: 200, value: r.bpm, 'aria-label': 'Tempo in BPM', onchange: e => { o.bpm = clamp(+e.target.value || r.bpm, 50, 200); again(); } });
  const keySel = pSel(NS.map((n, i) => [i, n]), r.key.root, v => { o.key = +v; again(); }), modeSel = pSel([['maj', 'major'], ['min', 'minor']], r.key.minor ? 'min' : 'maj', v => { o.minor = v === 'min'; again(); });
  keySel.setAttribute('aria-label', 'Key'); modeSel.setAttribute('aria-label', 'Mode');
  const form = pSel(Object.entries(HUM_FORMS), o.form, v => { o.form = v; again(); }); form.setAttribute('aria-label', 'Song shape');
  const cv = h('canvas', { class: 'hum-roll', width: 600, height: 56, 'aria-label': 'The notes I heard', role: 'img' });
  d.append(
    h('div', { class: 'hum-row' }, h('button', { class: 'btn primary hum-play', id: 'humPlay', onclick: () => { if (T.playing) { stopPlay(true); } else humPlay(); } }, T.playing ? '■ Stop' : '▶ Play my song'),
      h('button', { class: 'btn', id: 'humHear', onclick: humHear }, HUM.hear ? '■ Stop' : '👂 Hear my hum'),
      h('button', { class: 'btn', id: 'humSave', title: 'Save your song, your hum or the parts to this device', onclick: e => humSaveMenu(e.currentTarget) }, '⤓ Save'),
      h('button', { class: 'btn', id: 'humVoice', title: 'Play your own recording along with the band, lined up with the melody. Turn it off to hear just the arrangement.', onclick: e => { const tk = TAKES.find(t => t.hum); if (!tk) return; tk.mute = !tk.mute; takeLive(tk); bus.emit('takes'); try { projSave(); } catch (x) { } e.currentTarget.textContent = tk.mute ? '🎤 My hum: off' : '🎤 My hum: on'; } }, (() => { const tk = TAKES.find(t => t.hum); return tk && tk.mute ? '🎤 My hum: off' : '🎤 My hum: on'; })()),
      h('button', { class: 'btn', id: 'humBand', title: 'Turn the drums, bass and rhythm guitar on or off. Your melody keeps playing.', onclick: e => { const on = !(S.band.drumsOn || S.band.bassOn || S.band.compOn); setRehearsal({ drumsOn: on, bassOn: on, compOn: on }); e.currentTarget.textContent = on ? '🥁 Band: on' : '🥁 Band: off'; } }, (S.band.drumsOn || S.band.bassOn || S.band.compOn) ? '🥁 Band: on' : '🥁 Band: off'),
      h('span', { class: 'hum-sum' }, h('b', {}, an.notes.length + ' notes'), ' · ', h('b', {}, kn), ' · ', h('b', {}, r.bpm + ' BPM'), ' · ', h('b', {}, totalBars() + ' bars')), h('span', { class: 'grow' }), x),
    h('div', { class: 'hum-msg' }, 'Your melody plays as the lead guitar. Chords, sections and the band were arranged from it. Change anything below and it re-builds right away.'),
    cv,
    h('div', { class: 'hum-grid' }, h('div', {}, h('div', { class: 'hum-l' }, 'STYLE'), chips), h('div', {}, h('div', { class: 'hum-l' }, 'TEMPO'), h('div', { class: 'row', style: { gap: '6px' } }, tempo, h('span', { class: 'muted small' }, 'BPM'))),
      h('div', {}, h('div', { class: 'hum-l' }, 'KEY'), h('div', { class: 'row', style: { gap: '6px' } }, keySel, modeSel)), h('div', {}, h('div', { class: 'hum-l' }, 'SONG SHAPE'), form)),
    h('div', { class: 'hum-row hum-acts' }, h('button', { class: 'btn', title: 'Same melody, different chords and a different chorus', onclick: () => { o.seed++; again(); } }, '🎲 Try different chords'),
      h('button', { class: 'btn', onclick: () => { humStageToggle(); } }, CAM.on ? '📷 Camera off' : '📷 Center stage'), h('span', { class: 'grow' }),
      h('button', { class: 'btn', onclick: () => { humBarClose(); sideShow('refine'); } }, '✎ Add lyrics'), h('button', { class: 'btn', onclick: () => { humBarClose(); vzImmersive(false); zoomSet('studio'); } }, '🎛 Open in the studio'),
      h('button', { class: 'btn primary', onclick: () => { humBarClose(); toast('Saved in My songs. Keep going: edit any chord, add lyrics, or record real guitar over it.', 'ok'); } }, 'Done')));
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, mel = r.melody, end = Math.max(16, ...mel.map(n => n.s + n.l)), lo = Math.min(...mel.map(n => n.m)), hi = Math.max(...mel.map(n => n.m)), span = Math.max(7, hi - lo + 1);
  g.fillStyle = getComputedStyle(document.body).getPropertyValue('--accent') || '#6fcf97'; g.globalAlpha = .9; mel.forEach(n => { const x0 = n.s / end * W, w = Math.max(3, n.l / end * W - 1), y = H - 6 - (n.m - lo) / span * (H - 12); g.fillRect(x0, y - 3, w, 6); });
}
async function humStageToggle() { await vzCenterStage(!CAM.on); if (HUM.bar && HUM.bar.dataset.mode === 'res') humBar('res'); }
bus.on('transport', () => { const b = document.getElementById('humPlay'); if (b) b.textContent = T.playing ? '■ Stop' : '▶ Play my song'; });
/* the studio opens on the stage (Visuals) the first time, then on whichever tab you used last */
bus.on('dock', id => { const c = typeof id === 'string' ? id : DOCK.cur; if (c && c !== CFG.startTab && document.getElementById('app') && !document.getElementById('boot')) { CFG.startTab = c; saveCfg(); } });

/* ============================================================
   Novice guitar coach: tune each string, learn the chords of the song one at a time, then play along.
   Listens through the audio engine (needs the guitar input). The song comes from the hum, or a friendly starter.
   ============================================================ */
const HUM_STARTER = ['G', 'Em', 'C', 'D'];
const fcents = (f, t) => 1200 * Math.log2(f / t);
const humStringHz = st => (CFG.a4 || 440) * Math.pow(2, (S.tuning[st] + S.capo - 69) / 12);
async function humGuitar() {
  try { if (typeof AK !== 'undefined') AK.killed = false; await startAudio(); const ok = CFG.inDev ? await openInput(CFG.inDev) : await pickInput(); await listDevices(); bus.emit('audiostate'); if (!ok) throw new Error('no input'); }
  catch (e) { return humBar('err', 'I could not hear a guitar input (' + (e.message || e.name) + '). Allow the microphone or plug in your interface, then try again. You can also hum instead.'); }
  if (!HUM.r) { const an = { notes: [{ t: 0, d: .4, m: 67 }], bpm: 84, key: { root: 7, minor: false }, dur: 1 }; HUM.an = an; HUM.o = { style: 'Folk', form: 'full', seed: 0, bpm: 84, key: 7, minor: false, title: 'My first song', verse: HUM_STARTER }; await humApply(false); }
  HUM.g = { step: 'tune', si: 0, ci: 0, hold: 0, done: [], seen: '', chords: humCoachChords() }; if (HUM.g.t) clearInterval(HUM.g.t); HUM.g.t = setInterval(humGuitarTick, 60); humBar('g');
}
function humCoachChords() { const sec = S.sections.find(s => /Verse/.test(s.name)) || S.sections[0], seen = [], out = []; sec.bars.forEach(b => b.chord.split(' ').filter(Boolean).forEach(c => { if (!seen.includes(c)) { seen.push(c); out.push(c); } })); return out.slice(0, 4); }
function humGuitarTick() {
  const g = HUM.g; if (!g || !HUM.bar || HUM.bar.dataset.mode !== 'g') { if (g) { clearInterval(g.t); } return; }
  const live = document.getElementById('gLive'), need = document.getElementById('gNeed'), fill = document.getElementById('gHold');
  if (g.step === 'tune') {
    const st = g.si, tf = humStringHz(st), f = AN.f0, ok = f > 0 && AN.clarity > .5 && AN.rms > -50, c = ok ? fcents(f, tf) : null, near = c != null && Math.abs(c) < 60;
    if (live) live.textContent = ok ? (humNoteName(AN.midi) + (near ? (c > 8 ? '  a bit high ▼' : c < -8 ? '  a bit low ▲' : '  ✓ in tune') : '  (not this string)')) : 'pluck the open string…';
    if (near && Math.abs(c) < 10) g.hold++; else g.hold = Math.max(0, g.hold - 1);
    if (fill) fill.style.width = Math.min(100, g.hold / 10 * 100) + '%';
    if (g.hold >= 10) { g.done[st] = true; g.hold = 0; if (g.si >= S.tuning.length - 1) { g.step = 'chords'; g.ci = 0; } else g.si++; toast('✓ ' + humNoteName(S.tuning[st] + S.capo), 'ok'); humBar('g'); }
  } else if (g.step === 'chords') {
    const sym = g.chords[g.ci], tc = parseChord(sym), top = (AN.chord || []).slice(0, 2), heard = top[0] ? top[0].sym : '', hit = AN.active && AN.rms > -45 && top.some(x => tc && x.root === tc.root && (x.q === tc.q || (x.q === '' && tc.q === 'maj') || (tc.q === '' && x.q === 'maj')));
    if (live) live.textContent = AN.active ? (heard ? 'I hear ' + heard : '…') : 'strum all the strings…';
    if (hit) g.hold++; else g.hold = Math.max(0, g.hold - 1); if (fill) fill.style.width = Math.min(100, g.hold / 8 * 100) + '%';
    if (g.hold >= 8) { g.hold = 0; toast('✓ ' + sym + '! Nice.', 'ok'); if (g.ci >= g.chords.length - 1) g.step = 'play'; else g.ci++; humBar('g'); }
  }
}
function humChordCanvas(sym) {
  const cv = h('canvas', { width: 150, height: 170, class: 'hum-chord', role: 'img', 'aria-label': 'How to play ' + sym }), g = cv.getContext('2d'), v = voicings(sym, S.tuning, S.capo, 1)[0]; if (!v) return cv;
  const col = getComputedStyle(document.body).getPropertyValue('--text') || '#ddd', acc = getComputedStyle(document.body).getPropertyValue('--accent') || '#6fcf97', fr = v.frets, fs = fr.filter(f => f > 0), lo = fs.length ? Math.min(...fs) : 1, base = Math.max(...fs, 0) > 4 ? lo : 1;
  const x0 = 24, y0 = 34, dx = 20, dy = 24; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.5; g.font = '12px sans-serif'; g.textAlign = 'center';
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x0 + i * dx, y0); g.lineTo(x0 + i * dx, y0 + 5 * dy); g.stroke(); }
  for (let j = 0; j <= 5; j++) { g.lineWidth = j === 0 && base === 1 ? 4 : 1.2; g.beginPath(); g.moveTo(x0, y0 + j * dy); g.lineTo(x0 + 5 * dx, y0 + j * dy); g.stroke(); }
  if (base > 1) { g.textAlign = 'left'; g.fillText(base + 'fr', x0 + 5 * dx + 6, y0 + dy * .7); g.textAlign = 'center'; }
  fr.forEach((f, i) => { const x = x0 + i * dx; if (f == null) g.fillText('×', x, y0 - 10); else if (f === 0) { g.beginPath(); g.arc(x, y0 - 13, 5, 0, 7); g.stroke(); } else { g.fillStyle = acc; g.beginPath(); g.arc(x, y0 + (f - base + .5) * dy, 8, 0, 7); g.fill(); g.fillStyle = col; } });
  return cv;
}
function humGuitarBar(d, x) {
  const g = HUM.g; if (!g) return;
  const head = (t) => h('div', { class: 'hum-row' }, h('b', { class: 'hum-hi' }, t), h('span', { class: 'grow' }), h('button', { class: 'btn sm', onclick: () => { clearInterval(g.t); humBar('start'); } }, 'Back'), x);
  if (g.step === 'tune') {
    const names = S.tuning.map((m, i) => humNoteName(m + S.capo));
    d.append(head('Step 1 · Tune your guitar'), h('div', { class: 'hum-msg' }, 'Pluck the ', h('b', {}, ['lowest (thickest)', '2nd', '3rd', '4th', '5th', 'highest (thinnest)'][g.si] + ' string, open'), '. Turn the tuning peg until it says in tune.'),
      h('div', { class: 'hum-strs' }, names.map((n, i) => h('span', { class: 'hum-str' + (i === g.si ? ' on' : '') + (g.done[i] ? ' ok' : '') }, g.done[i] ? '✓ ' + n : n))),
      h('div', { class: 'hum-row' }, h('b', { id: 'gNeed', class: 'hum-note' }, names[g.si]), h('div', { class: 'hum-lvw' }, h('i', { id: 'gHold' })), h('b', { id: 'gLive', class: 'hum-live' }, 'pluck the open string…'), h('span', { class: 'grow' }), h('button', { class: 'btn sm', onclick: () => { g.step = 'chords'; g.ci = 0; humBar('g'); } }, 'Skip tuning')));
  } else if (g.step === 'chords') {
    const sym = g.chords[g.ci];
    d.append(head('Step 2 · Learn your song’s chords (' + (g.ci + 1) + ' of ' + g.chords.length + ')'),
      h('div', { class: 'hum-row hum-chordrow' }, humChordCanvas(sym), h('div', { class: 'hum-ch' }, h('b', { class: 'hum-note', style: { fontSize: '44px' } }, sym), h('div', { class: 'hum-msg' }, 'Put your fingers on the dots, strum from the thickest string down to the thinnest, and let it ring. A × means skip that string; ○ means play it open.'),
        h('div', { class: 'hum-lvw' }, h('i', { id: 'gHold' })), h('b', { id: 'gLive', class: 'hum-live' }, 'strum all the strings…'))),
      h('div', { class: 'hum-row' }, h('button', { class: 'btn sm', onclick: () => { g.hold = 0; g.ci = Math.min(g.chords.length - 1, g.ci + 1); if (g.ci === g.chords.length - 1 && g.chords.length === 1) g.step = 'play'; humBar('g'); } }, 'Skip this chord'), h('button', { class: 'btn sm', onclick: () => { g.step = 'play'; humBar('g'); } }, 'I know these, play along')));
  } else {
    d.append(head('Step 3 · Play along'), h('div', { class: 'hum-msg' }, 'You know the chords: ', h('b', {}, g.chords.join('  ·  ')), '. The band will play your song. Strum one chord per bar and watch the chord name on the stage.'),
      h('div', { class: 'hum-row' }, h('button', { class: 'btn primary hum-play', onclick: () => { if (T.playing) stopPlay(true); else humPlay(); } }, T.playing ? '■ Stop' : '▶ Play the band'), h('button', { class: 'btn', onclick: () => { g.step = 'chords'; g.ci = 0; humBar('g'); } }, 'Practise the chords again'), h('span', { class: 'grow' }),
        h('button', { class: 'btn', onclick: () => { clearInterval(g.t); humBar('res'); } }, 'Change the song style'), h('button', { class: 'btn primary', onclick: () => { clearInterval(g.t); humBarClose(); } }, 'Done')));
  }
}

/* >>> parts/33-adapt.js */
/* ============================================================
   Part 33 · Adaptive studio: the studio shows what you have shown you need.
   Nobody is asked their level. Actions add to a private score kept in this browser (CFG.xp);
   the score picks Simple, More tools or Everything. "Tools" in the tab strip overrides it.
   ============================================================ */
var XP = { quiet: 0, last: null };
var XP_TABS = { new: ['vis', 'song', 'band', 'exp'], some: ['vis', 'song', 'tab', 'band', 'rig', 'fret', 'stems', 'exp'], pro: null };
var XP_NAMES = { rig: 'Guitar sound', tab: 'Guitar tab', vis: 'Stage', song: 'Song', band: 'Band', exp: 'Save & export', fret: 'Fretboard', stems: 'Backing track' };
var XP_LABEL = { new: 'Simple', some: 'More tools', pro: 'Everything' };
if (CFG.xp == null) { CFG.xp = (store.get('started', false) || store.get('song', null)) ? 40 : 0; saveCfg(); }   // people who already use the app keep the full studio
function xpLevel() { const m = CFG.xpMode || 'auto'; if (XP_TABS[m] !== undefined) return m; const s = CFG.xp || 0; return s >= 12 ? 'pro' : s >= 4 ? 'some' : 'new'; }
function xpAllowed(id) { const l = XP_TABS[xpLevel()]; return !l || l.includes(id) || id === DOCK.cur; }
function xpTabText(id, name, i) { return xpLevel() === 'pro' ? (i + 1) + ' · ' + name : (XP_NAMES[id] || name); }
function xpSignal(pts) {
  if (XP.quiet || (CFG.xpMode && CFG.xpMode !== 'auto')) return; const before = xpLevel(); CFG.xp = Math.min(40, (CFG.xp || 0) + pts); clearTimeout(XP.t); XP.t = setTimeout(saveCfg, 800);
  const now = xpLevel(); if (now !== before) { try { rebuildTabs(); } catch (e) { } toast(now === 'some' ? 'More tools are now on the tab strip. Find the rest under “Tools”.' : 'Everything is unlocked. Welcome to the full studio.', 'ok'); }
}
const xpEdit = () => { if (!XP.quiet) xpSignal(.25); };
/** run a generator (like Hum to Song) without counting its changes as the person's own edits */
function xpQuiet(fn) { XP.quiet++; try { return fn(); } finally { XP.quiet--; } }
function xpToolsButton() {
  const l = xpLevel(), b = h('button', { class: 'btn sm xp-tools', id: 'xpTools', title: 'Choose how much of the studio to show', 'aria-haspopup': 'dialog', onclick: () => {
    const m = CFG.xpMode || 'auto', opt = (k, t, d) => h('button', { class: 'btn sm xp-opt' + (m === k ? ' on' : ''), 'aria-pressed': String(m === k), onclick: () => { CFG.xpMode = k; saveCfg(); closePop(); rebuildTabs(); if (k !== 'auto') toast((XP_LABEL[k]) + ' tools', ''); } }, h('b', {}, t), h('span', { class: 'muted' }, d));
    popover(b, h('div', { class: 'xp-pop' }, h('h5', {}, 'How much of the studio?'), opt('auto', 'Automatic', 'Starts simple and adds tools as you use them'), opt('new', 'Simple', 'Hum, Song, Band, Stage, Save'), opt('some', 'More tools', 'Adds guitar sound, tab, fretboard, backing track'), opt('pro', 'Everything', 'All tabs, technical labels, numbered shortcuts')), { style: { width: '320px', maxWidth: '92vw' } });
  } }, l === 'pro' ? 'Tools' : '＋ More tools'); return b;
}

/* >>> parts/34-launch.js */
/* ============================================================
   First impression: a living hexagon field behind the front screen, and a full-screen "center stage"
   (camera + hexagons) that the first song starts on. Nothing here touches the microphone or camera;
   those are requested only by the buttons that say so.
   ============================================================ */
(function bootHexInit() {
  const cv = document.getElementById('bootHex'); if (!cv) return;
  const g = cv.getContext('2d'), still = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let W = 0, H = 0, dpr = 1, t0 = performance.now(), last = 0;
  const size = () => { dpr = Math.min(1.5, window.devicePixelRatio || 1); W = cv.width = Math.floor(innerWidth * dpr); H = cv.height = Math.floor(innerHeight * dpr); };
  size(); addEventListener('resize', size);
  const hexPath = (x, y, r) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); } g.closePath(); };
  function frame(now) {
    if (!document.getElementById('bootHex')) return;
    requestAnimationFrame(frame); if (now - last < 33 && !still) return; last = now;
    try { paint(now); } catch (e) { last = Infinity; }
  }
  function paint(now) {
    const t = (now - t0) / 1000, R = Math.max(26, Math.min(W, H) / 15) * (dpr > 1 ? 1 : 1), dx = R * Math.sqrt(3), dy = R * 1.5, cx = W / 2, cy = H * .46, maxd = Math.hypot(W, H) * .55;
    g.fillStyle = '#04090a'; g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(cx, cy, 0, cx, cy, maxd); glow.addColorStop(0, 'rgba(61,220,132,.16)'); glow.addColorStop(.5, 'rgba(61,220,132,.04)'); glow.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = glow; g.fillRect(0, 0, W, H);
    const beat = (t % 1.9) / 1.9;
    for (let row = -1; row * dy < H + R; row++) for (let col = -1; col * dx < W + dx; col++) {
      const x = col * dx + (row & 1 ? dx / 2 : 0), y = row * dy, d = Math.hypot(x - cx, y - cy), fall = Math.max(0, 1 - d / maxd);
      const ring = Math.max(0, 1 - Math.abs(d / maxd - beat * 1.1) * 7), wave = .5 + .5 * Math.sin(d * .011 - t * 1.4 + Math.sin(x * .004 + t * .3) * 2), a = Math.min(1, fall * fall * (.2 + wave * .55) + ring * .85 * fall);
      const warm = ((col * 7 + row * 13) % 11) === 0;
      g.fillStyle = (warm ? 'rgba(242,182,50,' : 'rgba(61,220,132,') + (a * (warm ? .5 : .42)).toFixed(3) + ')'; hexPath(x, y, R * (.9 + ring * .08)); g.fill();
      g.strokeStyle = 'rgba(125,191,155,' + (.05 + a * .5).toFixed(3) + ')'; g.lineWidth = 1; g.stroke();
    }
  }
  requestAnimationFrame(frame);
})();

/* full-screen center stage */
function vzImmersive(on) {
  const b = document.body; if (!!on === b.classList.contains('vz-imm')) return;
  if (on) { try { dockGo('vis'); } catch (e) { } }
  b.classList.toggle('vz-imm', !!on);
  let hud = document.getElementById('vzHud');
  if (on && !hud) {
    hud = h('div', { id: 'vzHud', role: 'toolbar', 'aria-label': 'Stage controls' },
      h('span', { class: 'vzh-brand' }, h('i', { 'aria-hidden': 'true' }, '⬡'), 'the-daily.studio'),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn sm', id: 'vzhNew', title: 'Start a new song: hum, guitar, a song file or a blank page', onclick: () => humStageFirst() }, '＋', h('span', { class: 'lbl' }, ' New song')),
      h('button', { class: 'btn sm', id: 'vzhLook', title: 'Change the look: Hex Resonance, Fifths Halo, Prism, Tunnel', onclick: () => vzCycleLook() }, '✦', h('span', { class: 'lbl' }, ' Look')),
      h('button', { class: 'btn sm', id: 'vzhIo', title: 'Microphone, camera and other inputs', onclick: () => { vzImmersive(false); try { sideShow('io'); } catch (e) { } } }, '⚙', h('span', { class: 'lbl' }, ' Inputs')),
      h('button', { class: 'btn sm vzh-kill', id: 'vzhKill', title: 'Stop all sound and release the microphone (Ctrl + .)', onclick: () => { try { audioKill(); } catch (e) { } } }, '■', h('span', { class: 'lbl' }, ' Stop audio')),
      h('button', { class: 'btn sm', id: 'vzhFull', title: 'Full screen', 'aria-label': 'Full screen', onclick: () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => { }); } catch (e) { } } }, '⛶'),
      h('button', { class: 'btn sm', id: 'vzhExit', title: 'Back to the studio', onclick: () => vzImmersive(false) }, '✕ Studio'));
    document.body.append(hud);
  }
  if (on) setTimeout(() => { try { window.dispatchEvent(new Event('resize')); } catch (e) { } }, 30);
  else { try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { } try { window.dispatchEvent(new Event('resize')); } catch (e) { } }
}
bus.on('dock', id => { const c = typeof id === 'string' ? id : DOCK.cur; if (c && c !== 'vis' && document.body.classList.contains('vz-imm')) vzImmersive(false); });

/* Pressing Begin or "Start and connect my input" also starts the camera backdrop on the visuals (unless you turned it off earlier).
   "Start with camera and mic off" never does. */
bus.on('booted', () => { if (HUM.cam0 !== true) return; if (CFG.humStage !== false && !CAM.on && DOCK.cur === 'vis') vzCenterStage(true); });

/* ---------- the two routes: the studio, or the stage (full-screen visuals with the camera) ---------- */
function setRoute(r) { CFG.route = r === 'stage' ? 'stage' : 'studio'; saveCfg(); bus.emit('route-pref', CFG.route); }
/** go on stage now, from anywhere in the studio: full-screen visuals, and the camera unless you turned it off there */
async function goOnStage() { setRoute('stage'); HUM.cam0 = true; if (ZOOM.cur === 'canvas') zoomSet('song', true); try { await humStageGo(); } catch (e) { } }
/** the same two-way switch wherever it is shown (Settings, I/O ▸ Camera) */
function routeControl() {
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Where to start' }), sync = () => { seg.innerHTML = ''; [['studio', '🎛 Studio'], ['stage', '🎥 Stage']].forEach(([v, t]) => { const on = (CFG.route === 'stage') === (v === 'stage'); seg.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(on), class: on ? 'on' : '', title: v === 'stage' ? 'Start on the stage: full-screen visuals with the camera (asked for when you start)' : 'Start in the studio: no camera', onclick: () => setRoute(v) }, t)); }); };
  sync(); bus.on('route-pref', sync); return seg;
}
/** a new song starts with the band off: say so once, the first time someone presses Play on chords with nothing else to hear */
var BAND_HINT_DONE = false;
function bandHint() {
  if (BAND_HINT_DONE || S.band.drumsOn || S.band.bassOn || S.band.compOn || S.band.leadOn || TAKES.length || (typeof STM !== 'undefined' && STM.ch) || !songHasWork()) return;
  BAND_HINT_DONE = true; toast('The band is off in this song. Turn on Drums, Bass or Rhythm in the BAND row to hear it.', 'ok');
}

/* >>> parts/35-neck.js */
/* =====================================================================
   Part 35 · The neck, wired to everything
   One list of "marks" on the neck (what is sounding, what is coming, what you are singing, a chord you picked in the
   neural graph) feeds the Fretboard pane AND a small neck drawn on top of the Visuals and the Neural graph, so the
   three stay in step and you still see the neck when the dock is hidden (full-screen stage).
   ===================================================================== */
const NK = { pin: null, ghost: null, ghostSlot: -9, voiceAt: 0 };
var NECK_FRETS = 22;

/** The next lead-guitar note (and the next chord change) after the playhead, with how long until it arrives. */
function nkNext() {
  if (!T.playing || !E.ctx) { NK.ghost = null; return null; }
  const ph = playheadSlot(), s0 = Math.floor(ph) + 1;
  if (NK.ghost && NK.ghostSlot === s0) { NK.ghost.eta = (NK.ghost.slot - ph) * slotDur(); NK.ghost.cEta = NK.ghost.cslot != null ? (NK.ghost.cslot - ph) * slotDur() : null; return NK.ghost; }
  const sp = spb(), bc = barsCache(), g = { lead: null, chord: null, slot: 0, cslot: null, eta: 9 }; let ln = null, ch = null;
  for (let s = s0; s < s0 + sp * 2 && !(ln && ch); s++) {
    const bi = Math.floor(s / sp), sib = s - bi * sp, fb = bc[bi]; if (!fb) break;
    if (!ln && S.band.leadOn) { const n = fb.bar.tab.find(x => x.s === sib && x.f !== 'x'); if (n) ln = { st: n.st, f: n.f, slot: s }; }
    if (!ch && s < s0 + sp) { const cd = chordAt(bi, sib); if (cd && cd.sym && cd.rel === 0 && (S.band.compOn || !S.band.leadOn)) ch = { sym: cd.sym, slot: s }; }
  }
  if (ln) { g.lead = { st: ln.st, f: ln.f }; g.slot = ln.slot; }
  if (ch) { const v = voicingFor(ch.sym); g.chord = v ? { sym: ch.sym, frets: v.frets } : null; g.cslot = ch.slot; }
  NK.ghost = g; NK.ghostSlot = s0; g.eta = (g.slot - ph) * slotDur(); g.cEta = g.cslot != null ? (g.cslot - ph) * slotDur() : null; return g;
}

/** Where the note you are singing (or hearing back) can be played on the neck. */
function nkVoice(now) {
  let m = null;
  if (HUM.rec && HUM.live && now - HUM.live.t < 350) m = HUM.live.m;
  else if (CFG.anSrc === 'v' && AN.active && AN.midi != null && !T.playing) m = AN.midi;   // singing live, with the detector following the vocal
  else if (HUM.hear && HUM.hearT0 && HUM.an) { const tt = (now - HUM.hearT0) / 1000, n = HUM.an.notes.find(x => tt >= x.t && tt < x.t + x.d); if (n) m = n.m; }
  if (m == null) return [];
  const lo = S.tuning[0] + S.capo; while (m < lo) m += 12; while (m > lo + 38) m -= 12;
  const out = []; S.tuning.forEach((open, st) => { const f = m - (open + S.capo); if (f >= 0 && f <= 15) out.push({ st, f, k: 'voice', a: 1 }); });
  return out;
}

/** Everything lit on the neck right now: [{st, f, k: hit|ghost|voice|pin, a}] */
function neckMarks(now) {
  now = now || performance.now(); const out = [];
  PB.hits.forEach(p => { const a = 1 - (now - p.t) / 420; if (a > .02) out.push({ st: p.st, f: p.f, k: 'hit', a }); });
  const g = nkNext(); if (g) {
    if (g.lead && g.eta < 2.2) out.push({ st: g.lead.st, f: g.lead.f, k: 'ghost', a: clamp(1.15 - g.eta / 1.6, .3, 1) });
    if (g.chord && g.cEta != null && g.cEta < 1.6) g.chord.frets.forEach((f, st) => { if (f != null) out.push({ st, f, k: 'ghost', a: clamp(.9 - g.cEta / 2, .2, .55) }); });
  }
  nkVoice(now).forEach(x => out.push(x));
  if (NK.pin) { const left = NK.pin.until - now; if (left <= -900) NK.pin = null; else NK.pin.frets.forEach((f, st) => { if (f != null) out.push({ st, f, k: 'pin', a: clamp(1 + left / 900, 0, 1) }); }); }
  return out;
}
const nkActive = () => !!(NK.pin || T.playing || HUM.rec || HUM.hear);

/** Pick a chord (from the neural graph, say): show its shape on every neck and strum it. */
async function nkPinChord(sym) {
  const v = voicingFor(sym); if (!v) return; NK.pin = { sym, frets: v.frets.slice(), until: performance.now() + 5200 };
  try { await startAudio(); const t = E.ctx.currentTime + .02; let k = 0; v.frets.forEach((f, st) => { if (f != null) pluck('lead', t + (k++) * .028, S.tuning[st] + S.capo + f, .62, { id: 'p' + st, pan: (st - 2.5) * .08 }); }); } catch (e) { }
  toast(sym + ' is on the fretboard', 'ok');
}

/** A small neck drawn into any canvas. */
function drawMiniNeck(g, x, y, w, h, o) {
  o = o || {}; const marks = neckMarks(), on = nkActive(); NK.fade = clamp((NK.fade || 0) + (on ? .08 : -.05), 0, 1); if (NK.fade <= 0.01) return;
  const maxF = clamp(Math.max(12, ...marks.map(m => m.f + 1)), 12, NECK_FRETS), left = !!CFG.left, ns = S.tuning.length, pad = h * .12, gx = x + w * .05, gw = w * .9, top = y + pad, sh = (h - pad * 2) / (ns - 1);
  const px = n => { const t = (1 - Math.pow(2, -n / 12)) / (1 - Math.pow(2, -maxF / 12)); return gx + gw * (left ? 1 - t : t); };
  const rr = Math.min(sh * .46, w / maxF * .3), C = o.C || vcol();
  g.save(); g.globalAlpha = NK.fade * .96; g.fillStyle = 'rgba(5,11,12,.72)'; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, h * .18) : g.rect(x, y, w, h); g.fill(); g.strokeStyle = 'rgba(160,210,210,.22)'; g.lineWidth = 1; g.stroke();
  g.strokeStyle = 'rgba(200,230,230,.2)'; for (let n = 0; n <= maxF; n++) { g.lineWidth = n === 0 ? 3 : 1; g.beginPath(); g.moveTo(px(n), top - sh * .25); g.lineTo(px(n), top + sh * (ns - 1) + sh * .25); g.stroke(); }
  g.fillStyle = 'rgba(200,230,230,.28)'; [3, 5, 7, 9, 12, 15, 17, 19, 21].forEach(n => { if (n <= maxF) { g.beginPath(); g.arc((px(n) + px(n - 1)) / 2, y + h - pad * .45, rr * .22, 0, 6.3); g.fill(); } });
  for (let st = 0; st < ns; st++) { const yy = top + (ns - 1 - st) * sh; g.strokeStyle = 'rgba(225,245,245,.5)'; g.lineWidth = .8 + (ns - 1 - st) * .0 + (st < 2 ? 1.8 : st < 4 ? 1.1 : .6); g.beginPath(); g.moveTo(gx, yy); g.lineTo(gx + gw, yy); g.stroke(); }
  const KC = { hit: C.b, ghost: C.a, voice: '#ff5fc8', pin: '#ffd23f' };
  marks.sort((p, q) => (p.k === 'ghost') - (q.k === 'ghost')).forEach(m => {
    if (m.st >= ns || m.f > maxF) return; const cx = m.f === 0 ? px(0) + (left ? 1 : -1) * rr * 1.3 : (px(m.f) + px(m.f - 1)) / 2, cy = top + (ns - 1 - m.st) * sh, col = KC[m.k] || '#fff';
    g.globalAlpha = NK.fade * clamp(m.a, 0, 1);
    if (m.k === 'ghost') { g.setLineDash([rr * .5, rr * .4]); g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, rr * (1.1 + (1 - m.a) * .5), 0, 6.3); g.stroke(); g.setLineDash([]); g.fillStyle = col; g.globalAlpha *= .22; g.beginPath(); g.arc(cx, cy, rr, 0, 6.3); g.fill(); }
    else { g.fillStyle = col; g.shadowColor = col; g.shadowBlur = rr * 1.6; g.beginPath(); g.arc(cx, cy, rr * (m.k === 'hit' ? 1 + m.a * .25 : 1), 0, 6.3); g.fill(); g.shadowBlur = 0; }
  });
  g.globalAlpha = NK.fade * .8; g.fillStyle = 'rgba(235,250,250,.85)'; g.font = `700 ${Math.round(h * .17)}px ui-monospace,Menlo,monospace`; g.textAlign = 'left'; g.textBaseline = 'top';
  const lab = NK.pin ? NK.pin.sym : marks.some(m => m.k === 'voice') ? 'you' : ''; if (lab) g.fillText(lab, x + 8, y + 4);
  g.restore();
}
/** where the neck sits on a canvas: bottom centre, never wider than the stage */
function neckRect(W, H) { const u = Math.min(W, H * 2.2), w = Math.min(W * .94, u * .78), h = clamp(w * .15, 56, H * .3); return [(W - w) / 2, H - h - Math.max(10, H * .03), w, h]; }

/* >>> parts/36-halo.js */
/* =====================================================================
   Part 36 · Two new looks for the center stage
   · Fifths Halo: the circle of fifths from the Neural map, laid out as a tilted ring AROUND the player. The player (camera
     cut-out) stands in the middle; the pitch classes, the song's chords and the progression arcs orbit them, and every
     note you play (or the song plays) spirals in toward you. Back half of the ring is drawn behind the player, the front
     half in front, so you are inside it.
   · Prism: a feedback kaleidoscope that accents the off-beat. The mirror count, hue and spin change on the "and" of the
     beat (or on your own onsets), with a zoom-tunnel feedback loop. Flash and spin are limited when Stage ▸ safe is on.
   ===================================================================== */
VMODES.push(['halo', 'Fifths Halo'], ['kaleido', 'Prism']);
const HL = { rot: 0, kick: 0, pv: 0, hi: false, parts: [], dirty: true, chords: [], pairs: [], items: [], t: 0 };
bus.on('song', () => { HL.dirty = true; });
/** a note flies in from its place on the circle of fifths toward the player */
function haloSpark(midi, v, kind) {
  if (midi == null) return; HL.parts.push({ pc: ((midi % 12) + 12) % 12, v: v || .8, k: kind || 'song', t0: performance.now(), spin: (Math.random() - .5) * .6, oct: clamp((midi - 36) / 48, 0, 1) });
  if (HL.parts.length > 140) HL.parts.splice(0, HL.parts.length - 140);
}
bus.on('onset', () => { if (!T.playing && AN.midi != null && AN.active) haloSpark(AN.midi, clamp((AN.rms + 50) / 40, .3, 1), CFG.anSrc === 'v' ? 'voice' : 'live'); });
function haloChords() {
  if (!HL.dirty) return; HL.dirty = false; const seen = new Map(), seq = [];
  (S.sections || []).forEach(sec => sec.bars.forEach(b => barChords(b).forEach(sym => { const c = parseChord(sym); if (!c) return; if (!seen.has(sym)) seen.set(sym, { sym, c }); seq.push(sym); })));
  HL.chords = [...seen.values()]; const pr = new Map(); for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) { const k = seq[i - 1] + '>' + seq[i]; pr.set(k, (pr.get(k) || 0) + 1); }
  HL.pairs = [...pr].map(([k, n]) => { const [a, b] = k.split('>'); return { a, b, n }; });
}
const haloEase = u => u * u * (3 - 2 * u);
function haloDraw(g, W, H, X) {
  const { C, pulse, energy, dt } = X, camOn = !!(VZ.cam && CAM.video && CAM.video.readyState >= 2), t = VZ.t;
  haloChords(); HL.t = t;
  // rotation: slow drift + a kick on every beat / onset, so the ring moves in rhythm
  if (pulse > HL.pv + .25) HL.kick = Math.min(1.4, HL.kick + .5 + pulse * .4); HL.pv = pulse; HL.kick *= Math.pow(.04, dt || .016);
  HL.rot += (dt || .016) * (.16 + energy * .5 + HL.kick * (STG.safe ? 1.2 : 2.2));
  const Rx = Math.min(W * .47, H * .95), tilt = .3 + .05 * Math.sin(t * .23), Ry = Rx * tilt, cx = W / 2, cy = H * .5, rot = HL.rot, now = performance.now();
  const P = (a, rad, lift) => { const s = Math.sin(a); return { x: cx + Math.cos(a) * rad * Rx, y: cy + s * rad * Ry - (lift || 0) * Rx * .8, z: s, k: 1 + .24 * s }; };
  const ch = AN.chroma || [], cm = Math.max(.001, ...ch), live = AN.active, playing = T.playing;
  const curSym = playing ? PB.sym : live && AN.chord && AN.chord[0] ? AN.chord[0].sym : '', cur = curSym && parseChord(curSym), curPcs = cur ? cur.pcs : [];
  const nx = playing ? nkNext() : null, nextSym = nx && nx.chord ? nx.chord.sym : '';
  const items = HL.items = [];   // {z, draw(g)} collected once, drawn in two passes
  const add = (z, fn) => items.push({ z, fn });
  // guide rings (halves)
  [[.92, .16], [.62, .10], [.3, .07]].forEach(([rad, al]) => add(0, (g, pass) => { g.strokeStyle = 'rgba(160,220,225,' + (pass ? al * 1.4 : al) + ')'; g.lineWidth = pass ? 1.6 : 1; g.beginPath(); g.ellipse(cx, cy, rad * Rx, rad * Ry, 0, pass ? 0 : Math.PI, pass ? Math.PI : Math.PI * 2); g.stroke(); }));
  // the spiral of fifths: twelve steps, centre to ring
  { const N = 96; let prev = null; for (let i = 0; i <= N; i++) { const u = i / N, a = rot * -.6 - Math.PI / 2 + u * Math.PI * 2, p = P(a, .22 + .7 * haloEase(u), u * .1); if (prev) { const pp = prev, z = (p.z + pp.z) / 2, uu = u; add(z, (g, pass) => { if ((z > 0) !== !!pass) return; g.strokeStyle = mixc(C.a, C.b, uu, (.2 + .6 * uu) * (pass ? 1 : .7) * (.8 + energy)); g.lineWidth = (1 + uu * 2.4) * p.k; g.beginPath(); g.moveTo(pp.x, pp.y); g.lineTo(p.x, p.y); g.stroke(); }); } prev = p; } }
  // pitch classes on the ring
  const pcPos = [];
  for (let pc = 0; pc < 12; pc++) {
    const a = FANG(pc) + rot, p = P(a, .92, 0), v = Math.max(PB.chroma[pc] || 0, live ? (ch[pc] || 0) / cm * .9 : 0), inC = curPcs.includes(pc), r0 = Rx * (.016 + .034 * v + (inC ? .012 : 0)) * p.k; pcPos[pc] = p;
    add(p.z, (g, pass) => { if ((p.z > 0) !== !!pass) return; const a2 = (.55 + .45 * Math.min(1, v + (inC ? .4 : 0))) * (pass ? 1 : .8); g.shadowColor = pcCol(pc, 1); g.shadowBlur = 6 + v * 26; g.fillStyle = pcCol(pc, a2); hexPath(g, p.x, p.y, r0 + Rx * .008); g.fill(); g.shadowBlur = 0;
      g.fillStyle = 'rgba(235,250,250,' + (.45 + .5 * v + (inC ? .3 : 0)).toFixed(2) + ')'; g.font = `700 ${Math.round(Rx * .03 * p.k)}px ui-monospace,Menlo,monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; const o = pcOut(a); g.fillText(pcName(pc), p.x + o[0] * (r0 + Rx * .034), p.y + o[1] * (r0 + Rx * .034) * .6); });
  }
  // chords of the song: major outside, minor inside, extended chords float higher
  const cp = {}; HL.chords.forEach(({ sym, c }) => { const q = QH(c.q), p = P(FANG(c.root) + rot, .6 + q * .2, q * .12); cp[sym] = p; });
  // progression arcs, bending over the player
  HL.pairs.forEach(({ a, b, n }) => {
    const A = cp[a], B = cp[b]; if (!A || !B) return; const hot = a === curSym && (b === nextSym || !nextSym), z = (A.z + B.z) / 2, mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 - Rx * .1 + (cy - (A.y + B.y) / 2) * .35;
    add(z, (g, pass) => { if ((z > 0) !== !!pass) return; g.strokeStyle = hot ? mixc(C.b, C.a, .3, .9) : mixc(C.a, C.c, .5, Math.min(.5, .1 + n * .06) * (pass ? 1 : .6)); g.lineWidth = (hot ? 3 : 1 + Math.min(2, n * .3)) * (pass ? 1.15 : 1); g.beginPath(); g.moveTo(A.x, A.y); g.quadraticCurveTo(mx, my, B.x, B.y); g.stroke(); });
  });
  HL.chords.forEach(({ sym, c }) => {
    const p = cp[sym], isCur = sym === curSym, isNext = sym === nextSym, r0 = Rx * (isCur ? .05 : .034) * p.k;
    add(p.z + .001, (g, pass) => { if ((p.z > 0) !== !!pass) return;
      if (isCur) c.pcs.forEach(pc => { const q = pcPos[pc]; if (!q) return; g.strokeStyle = pcCol(pc, .75); g.lineWidth = 2 * p.k; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); });
      g.shadowColor = pcCol(c.root, 1); g.shadowBlur = isCur ? 30 : 8; g.fillStyle = isCur ? pcCol(c.root, .95, 70) : pcCol(c.root, pass ? .55 : .38, 52); hexPath(g, p.x, p.y, r0); g.fill(); g.shadowBlur = 0;
      if (isNext) { g.setLineDash([5, 4]); g.strokeStyle = mixc(C.b, C.a, .5, .95); g.lineWidth = 2; hexPath(g, p.x, p.y, r0 * 1.5); g.stroke(); g.setLineDash([]); }
      g.fillStyle = isCur ? '#06100f' : 'rgba(240,252,252,.88)'; g.font = `800 ${Math.round(Rx * (isCur ? .034 : .026) * p.k)}px ui-monospace,Menlo,monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sym, p.x, p.y + 1); });
  });
  // notes spiral in toward the player
  HL.parts = HL.parts.filter(q => now - q.t0 < 2300);
  HL.parts.forEach(q => { const u = (now - q.t0) / 2300, e = haloEase(u), a = FANG(q.pc) + rot + q.spin * u * 5 + u * u * 3.2, rad = .92 - .74 * e, p = P(a, rad, q.oct * .16 * (1 - e)), r0 = Rx * (.008 + .016 * q.v) * (1 - u * .6) * p.k;
    add(p.z, (g, pass) => { if ((p.z > 0) !== !!pass) return; g.globalAlpha = Math.max(0, 1 - u * u) * (pass ? 1 : .75); g.fillStyle = q.k === 'voice' ? '#ff5fc8' : pcCol(q.pc, 1, 70); g.shadowColor = g.fillStyle; g.shadowBlur = 12; g.beginPath(); g.arc(p.x, p.y, r0, 0, 6.3); g.fill(); g.shadowBlur = 0; g.globalAlpha = 1; }); });
  // a beat ring that breathes out from the player
  if (pulse > .02) add(0, (g, pass) => { const rr = (1 - pulse) * .95; g.strokeStyle = mixc(C.b, C.a, 1 - pulse, pulse * .55); g.lineWidth = 2 + pulse * 3; g.beginPath(); g.ellipse(cx, cy, rr * Rx, rr * Ry, 0, pass ? 0 : Math.PI, pass ? Math.PI : Math.PI * 2); g.stroke(); });
  items.sort((p, q) => p.z - q.z);
  if (!camOn) { const r0 = Rx * (.07 + pulse * .02); g.save(); g.strokeStyle = mixc(C.a, C.b, .5, .5); g.lineWidth = 2; g.shadowColor = C.a; g.shadowBlur = 18; hexPath(g, cx, cy - Rx * .08, r0); g.stroke(); g.restore(); }
  g.save(); items.forEach(it => it.fn(g, 0)); g.restore();
  HL.drawn = true;
}
/** second pass, after the camera cut-out: the near half of the ring passes in front of the player */
function haloFront(g) { if (!HL.drawn) return; g.save(); HL.items.forEach(it => it.fn(g, 1)); g.restore(); HL.drawn = false; }
const pcOut = a => [Math.cos(a), Math.sin(a)];

/* ---------------- Prism: syncopated feedback kaleidoscope ---------------- */
const KS = { out: null, src: null, ow: 0, oh: 0, n: 8, ni: 0, folds: [6, 8, 12, 10, 6, 16], rot: 0, dir: 1, hue: 0, zoom: 0, rings: [], step: -9, acc: 0, lastAcc: 0, pv: 0, glints: [] };
function ksAccent(strong, now) {
  const gap = STG.safe ? 340 : 110; if (now - KS.lastAcc < gap) return; KS.lastAcc = now;
  if (strong) { KS.ni = (KS.ni + 1) % KS.folds.length; KS.n = KS.folds[KS.ni]; KS.hue += 34 + Math.random() * 40; if (Math.random() < .35) KS.dir *= -1; KS.zoom = STG.safe ? .035 : .09; }
  KS.rings.push({ r: 0, v: strong ? 1 : .55, n: 3 + ((Math.random() * 3) | 0) });
  if (KS.rings.length > 8) KS.rings.shift();
}
function kaleidoDraw(g, W, H, X) {
  const { fd, bin, lvl, C, pulse, energy, dt } = X, now = performance.now(), t = VZ.t, sc = Math.min(1, 860 / W), ow = Math.max(160, Math.round(W * sc)), oh = Math.max(90, Math.round(H * sc)), L = Math.round(Math.hypot(ow, oh));
  if (!KS.out || KS.ow !== ow || KS.oh !== oh) { KS.out = document.createElement('canvas'); KS.out.width = ow; KS.out.height = oh; KS.src = document.createElement('canvas'); KS.src.width = L; KS.src.height = L; KS.ow = ow; KS.oh = oh; KS.out.getContext('2d').fillStyle = '#050b0c'; KS.out.getContext('2d').fillRect(0, 0, ow, oh); }
  const o = KS.out.getContext('2d'), s = KS.src.getContext('2d'), cx = L / 2, cy = L / 2, filt = (() => { try { return 'filter' in s; } catch (e) { return false; } })();
  // --- syncopation: the "and" of the beat (or your own onsets) changes the fold, hue and spin; the downbeat only breathes
  if (T.playing && E.ctx) { const ph = playheadSlot(), st = Math.floor(ph); if (st !== KS.step) { KS.step = st; const m = ((st % 4) + 4) % 4; if (m === 2) ksAccent(true, now); else if (m === 0) ksAccent(false, now); else if (S.band.drumsOn || S.band.leadOn) KS.glints.push({ a: Math.random() * 6.3, r: .2 + Math.random() * .5, t: now }); } }
  else if (pulse > KS.pv + .25) ksAccent(pulse > .6, now); KS.pv = pulse;
  KS.glints = KS.glints.filter(q => now - q.t < 600);
  const spin = (.07 + energy * .5 + pulse * .6) * (STG.safe ? .6 : 1) * KS.dir; KS.rot += (dt || .016) * spin; KS.zoom *= Math.pow(.05, dt || .016);
  // --- feedback: last frame, zoomed in and turned a little, becomes the new canvas (the infinite tunnel)
  s.save(); s.globalCompositeOperation = 'copy'; s.globalAlpha = 1; s.translate(cx + Math.sin(t * .7) * L * .006, cy + Math.cos(t * .5) * L * .006); s.rotate(spin * .06 + .004 * KS.dir); const z = 1.012 + energy * .02 + KS.zoom; s.scale(z, z);
  if (filt) s.filter = 'hue-rotate(' + (2 + energy * 9) + 'deg) saturate(1.05) brightness(.95)'; s.drawImage(KS.out, -ow / 2, -oh / 2); s.restore(); if (filt) s.filter = 'none';
  s.fillStyle = 'rgba(2,6,8,' + (STG.safe ? .16 : .11) + ')'; s.fillRect(0, 0, L, L);
  // --- new light, drawn once into the wedge that gets mirrored
  const n = KS.n, wedge = Math.PI / n; s.save(); s.translate(cx, cy); s.globalCompositeOperation = 'source-over';
  const hueC = k => 'hsla(' + ((KS.hue + k) % 360).toFixed(0) + ',90%,' + (58 + (k % 3) * 4) + '%,';
  for (let i = 0; i < 28; i++) { const u = i / 27, f = 70 * Math.pow(86, u), v = lvl(fd[bin(f)]); if (v < .08) continue; const a = (.04 + u * .92) * wedge, r0 = L * (.05 + .46 * u), r1 = r0 + L * (.02 + .16 * v);
    s.strokeStyle = hueC(u * 120) + (.25 + .55 * v).toFixed(2) + ')'; s.lineWidth = 1 + v * L * .006; s.beginPath(); s.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); s.lineTo(Math.cos(a + .06 * v) * r1, Math.sin(a + .06 * v) * r1); s.stroke(); }
  { const cr = L * (.014 + energy * .04 + pulse * .035); const gr = s.createRadialGradient(0, 0, 0, 0, 0, cr * 2.4); gr.addColorStop(0, hueC(20) + '.85)'); gr.addColorStop(.45, hueC(80) + '.45)'); gr.addColorStop(1, hueC(140) + '0)'); s.fillStyle = gr; s.beginPath(); s.arc(0, 0, cr * 2.4, 0, 6.3); s.fill(); s.fillStyle = hueC(10) + '.9)'; hexPath(s, 0, 0, cr); s.fill(); }
  KS.rings.forEach(q => { q.r += (dt || .016) * (.42 + q.v * .3); const rr = q.r * L * .55; if (q.r > 1) return; s.strokeStyle = hueC(q.n * 40) + ((1 - q.r) * .8 * q.v).toFixed(2) + ')'; s.lineWidth = 1.5 + (1 - q.r) * 5; hexPath(s, 0, 0, rr); s.stroke(); }); KS.rings = KS.rings.filter(q => q.r <= 1);
  KS.glints.forEach(q => { const u = (now - q.t) / 600, a = (q.a % wedge), r = (q.r + u * .25) * L * .5; s.fillStyle = hueC(200) + (1 - u).toFixed(2) + ')'; s.beginPath(); s.arc(Math.cos(a) * r, Math.sin(a) * r, L * .006 * (1 - u * .5) + 1, 0, 6.3); s.fill(); });
  // notes: a blob whose angle in the wedge is its place on the circle of fifths, radius its octave
  PB.hits.forEach(p => { const age = now - p.t; if (age > 500) return; const midi = S.tuning[p.st] + S.capo + (typeof p.f === 'number' ? p.f : 0), pc = midi % 12, a = (.08 + FIFTH(pc) / 11 * .84) * wedge, r = L * (.1 + (midi - 36) / 60 * .34), k = 1 - age / 500;
    s.fillStyle = pcCol(pc, .9 * k, 66); s.shadowColor = s.fillStyle; s.shadowBlur = 16; s.beginPath(); s.arc(Math.cos(a) * r, Math.sin(a) * r, L * (.008 + .012 * p.v) * (1 + k), 0, 6.3); s.fill(); s.shadowBlur = 0; });
  if (!T.playing && AN.midi != null && AN.active) { const pc = AN.midi % 12, a = (.08 + FIFTH(pc) / 11 * .84) * wedge, r = L * (.1 + (AN.midi - 36) / 60 * .34); s.fillStyle = pcCol(pc, .95, 68); s.shadowColor = s.fillStyle; s.shadowBlur = 20; s.beginPath(); s.arc(Math.cos(a) * r, Math.sin(a) * r, L * .018, 0, 6.3); s.fill(); s.shadowBlur = 0; }
  s.restore();
  // --- mirror the wedge n times (alternate copies flipped, so the seams are invisible)
  const R = L * .72; o.save(); o.globalCompositeOperation = 'source-over'; o.fillStyle = '#030708'; o.fillRect(0, 0, ow, oh);
  for (let k = 0; k < n; k++) for (let f = 0; f < 2; f++) { o.save(); o.translate(ow / 2, oh / 2); o.rotate(KS.rot + k * 2 * wedge); if (f) o.scale(1, -1); o.beginPath(); o.moveTo(0, 0); o.arc(0, 0, R, 0, wedge); o.closePath(); o.clip(); o.drawImage(KS.src, -cx, -cy); o.restore(); }
  o.restore();
  // --- to the screen, with a soft fringe of colour on the edges
  g.save(); g.globalCompositeOperation = 'source-over'; g.drawImage(KS.out, 0, 0, W, H);
  const ab = 1 + .004 + pulse * .006; g.globalCompositeOperation = 'lighter'; g.globalAlpha = .16 + pulse * .1;
  try { if (filt) { g.filter = 'hue-rotate(70deg)'; g.drawImage(KS.out, -W * (ab - 1) / 2, -H * (ab - 1) / 2, W * ab, H * ab); g.filter = 'hue-rotate(-70deg)'; g.drawImage(KS.out, W * (ab - 1) / 2, H * (ab - 1) / 2, W / ab, H / ab); g.filter = 'none'; } else g.drawImage(KS.out, -W * (ab - 1) / 2, -H * (ab - 1) / 2, W * ab, H * ab); } catch (e) { }
  g.restore();
}
function vzExtra2(mode, g, W, H, X) { if (mode === 'halo') return haloDraw(g, W, H, X); return kaleidoDraw(g, W, H, X); }

/** change the visual look from anywhere (the full-screen ✦ button, keys) and keep the Visuals buttons in step */
const VZ_FAVS = ['hex', 'halo', 'kaleido', 'tunnel'];
function vzSetMode(k) { VZ.mode = k; CFG.visMode = k; saveCfg(); VZ.spec = null; VZ.hexes = null; document.querySelectorAll('#pane-vis .seg [data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === k)); const n = (VMODES.find(m => m[0] === k) || [0, k])[1]; toast(n, 'ok'); }
function vzCycleLook() { const i = VZ_FAVS.indexOf(VZ.mode); vzSetMode(VZ_FAVS[(i + 1) % VZ_FAVS.length]); }

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
