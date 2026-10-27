/* ============================================================
   the-daily.studio  ·  MIT License
   Single-file vanilla JS · Web Audio · AudioWorklet · WebMIDI · getUserMedia
   Part 01 · core helpers, settings, music theory, chord voicing engine
   ============================================================ */
const VERSION = '2.3.0';
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
  rec: { dry: true, wet: true }, fretNames: 'notes', lufsTarget: 0, gTrim: 0, ioLeveled: false, dropKind: 'track',
  vin: 'off', armG: true, armV: true, voxMon: false, voxPolish: true, voxTrim: 0, trackSync: true, trackFill: 'all', renderFast: true, recEnd: 'grow', vzRibbon: false, vrange: null
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
/* One undo history for the whole song: the song itself, plus the levels, pans, effects and clips of recorded lanes and the backing track.
   A snapshot is the JSON of { s: song, t: lane/clip state, m: backing-track mix } (tkHistGet / stmHistGet live in part 45). */
function snap() { let t = null, m = null; try { t = tkHistGet(); m = stmHistGet(); } catch (e) { } return JSON.stringify({ s: S, t, m }); }
function histApply(str) {
  const o = JSON.parse(str);
  if (o && o.s && Array.isArray(o.s.sections)) { S = o.s; try { if (o.t) tkHistSet(o.t); if (o.m) stmHistSet(o.m); applyMix(); } catch (e) { console.warn(e); } } else S = o;   // (a plain song, from an older snapshot)
}
function commit(push = true) {
  if (push && typeof xpEdit === 'function') xpEdit();
  if (push) { histStack.u.push(histStack.cur || snap()); if (histStack.u.length > 80) histStack.u.shift(); histStack.r.length = 0; }
  histStack.cur = snap();
  bus.emit('song');
  clearTimeout(saveT); saveT = setTimeout(() => { store.set('song', S); store.set('songAt', Date.now()); }, 600);
}
/** record one undo step for a change that has just been made. `before` is a snap() taken just before it. */
function histPush(before) { if (before == null || before === snap()) return false; histStack.cur = before; commit(true); return true; }
/** a gesture (dragging a fader) is one undo step: histBegin() on the first movement, histEnd() when it is released */
let histGest = null;
function histBegin() { if (histGest == null) histGest = snap(); }
function histEnd() { if (histGest == null) return false; const b = histGest; histGest = null; return histPush(b); }
function undo() { if (!histStack.u.length) return; histGest = null; histStack.r.push(histStack.cur); const s = histStack.u.pop(); histApply(s); histStack.cur = s; bus.emit('song', 'reload'); }
function redo() { if (!histStack.r.length) return; histGest = null; histStack.u.push(histStack.cur); const s = histStack.r.pop(); histApply(s); histStack.cur = s; bus.emit('song', 'reload'); }
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
