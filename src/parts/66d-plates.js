/* ============================================================
   Part 66d · Two more worlds, in the directions the library is growing (2.81)
     Chladni Plate   a square plate that sings. The note you sing or play picks one of the plate's own vibration patterns (higher note, finer pattern);
                     sand jitters wherever the plate moves and sticks where it stays still, so it collects on the nodal lines, the real figures a
                     Chladni plate draws: the plate's shape is  cos(nπx)·cos(mπy) − cos(mπx)·cos(nπy). Loud shakes it; quiet lets it settle.
     Pitch Trace     your voice (and your lead guitar) as a line across the notes of the key, scrolling like a score, with the notes of the chord
                     lit, so you can see where you are in the song: for a take, a rehearsal or a video. Gold where it is in tune, warmer as it drifts.
   Each has its own options (Settings), reads the harmony state of part 65, and draws wherever the visuals draw.
   ============================================================ */

/* ---------- Chladni Plate ---------- */
VLOOK.chladni = { title: 'Chladni Plate', opts: [
  { k: 'follow', label: 'Pattern follows', type: 'choice', def: 'note', opts: [['note', 'The note you play'], ['chord', 'The chord root'], ['manual', 'A mode I choose']], tip: 'What picks the vibration pattern' },
  { k: 'mode', label: 'Mode', type: 'range', min: 1, max: 40, step: 1, def: 8, tip: 'For “a mode I choose”: higher is a finer pattern' },
  { k: 'style', label: 'Style', type: 'choice', def: 'sand', opts: [['sand', 'Sand'], ['lines', 'Glowing lines'], ['both', 'Both']], tip: 'Sand on the plate, the nodal lines glowing, or both' },
  { k: 'sand', label: 'Sand', type: 'range', min: 500, max: 6000, step: 100, def: 2800, tip: 'How many grains' },
  { k: 'shake', label: 'Shake', type: 'range', min: .3, max: 2.5, step: .05, def: 1, unit: 'x', tip: 'How hard loudness drives the plate' },
  { k: 'colour', label: 'Colour', type: 'choice', def: 'note', opts: [['note', 'By note'], ['theme', 'Theme']], tip: 'By note: the colour of the note that picked the pattern' }] };
/** the plate's vibration patterns, from the simplest to the finest (pitch rises with n² + m²) */
const CH_MODES = (() => { const a = []; for (let n = 0; n <= 8; n++) for (let m = n + 1; m <= 8; m++) a.push([n, m]); return a.sort((x, y) => (x[0] * x[0] + x[1] * x[1]) - (y[0] * y[0] + y[1] * y[1]) || x[0] - y[0]); })();
/** how far the plate moves at (x, y) in 0..1, for the pattern (n, m): zero on the nodal lines */
const chPsi = (n, m, x, y) => Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y) - Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y);
/** which pattern a frequency drives: a low note a simple pattern, a high note a fine one */
const chModeFor = f => clamp(Math.floor(clamp(Math.log2(f / 82) / Math.log2(2400 / 82), 0, 1) * (CH_MODES.length - 1) + .5), 0, CH_MODES.length - 1);
const CHX = { idx: -1, want: -1, wantT: 0, sand: null, fld: null, fldIdx: -1, hue: 140, randn: () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15 };

function vlChladni(g, W, H, X) {
  hmUpdate(); const follow = vlv('chladni', 'follow'), style = vlv('chladni', 'style'), nSand = vlv('chladni', 'sand'), shake = vlv('chladni', 'shake'), colour = vlv('chladni', 'colour'), now = HM.now, dt = HM.dt || .016, mo = hmCm().motion;
  const nt = follow === 'note' ? vlFund() : follow === 'chord' && HM.chord ? { f: vlMtof(36 + HM.chord.root), src: 'chord' } : null;
  let idx = follow === 'manual' ? clamp(vlv('chladni', 'mode') - 1, 0, CH_MODES.length - 1) : nt ? chModeFor(nt.f) : (CHX.idx >= 0 ? CHX.idx : 6);
  if (!nt && follow !== 'manual') idx = (Math.floor(VZ.t * .12) % 14) + 4;           /* nothing sounding: the plate wanders slowly through its patterns */
  if (idx !== CHX.want) { CHX.want = idx; CHX.wantT = now; } if (CHX.idx < 0 || (now - CHX.wantT > 140 && idx !== CHX.idx)) { CHX.idx = idx; CHX.fldIdx = -1; }
  const [n, m] = CH_MODES[CHX.idx], S0 = Math.min(W * .9, H * .84), px = (W - S0) / 2, py = (H - S0) / 2 + H * .015, sc = clamp(Math.min(W, H * 1.25) / 700, .55, 1.6);
  const hue = nt ? vlHue(Math.round(vlFtom(nt.f))) : 175; CHX.hue += (((hue - CHX.hue + 540) % 360) - 180) * .08; const hu = (CHX.hue + 360) % 360, col = (l, a) => colour === 'theme' ? (l > 62 ? X.C.b : X.C.a) : `hsla(${hu},85%,${l}%,${a})`;
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 0, W, H);
  // the plate
  g.fillStyle = 'rgba(255,255,255,.035)'; g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.4 * sc; g.beginPath(); g.roundRect ? g.roundRect(px, py, S0, S0, 14 * sc) : g.rect(px, py, S0, S0); g.fill(); g.stroke();
  // the nodal lines, glowing (a small picture of where the plate is still, drawn once per pattern)
  if (style !== 'sand') { const R = 96; if (!CHX.fld) { CHX.fld = document.createElement('canvas'); CHX.fld.width = CHX.fld.height = R; }
    if (CHX.fldIdx !== CHX.idx) { const q = CHX.fld.getContext('2d'), im = q.createImageData(R, R), sig = .09; for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) { const v = chPsi(n, m, i / (R - 1), j / (R - 1)), a = Math.exp(-(v * v) / (sig * sig * 2)); const o = (j * R + i) * 4; im.data[o] = 255; im.data[o + 1] = 255; im.data[o + 2] = 255; im.data[o + 3] = Math.round(a * 255); } q.putImageData(im, 0, 0); CHX.fldIdx = CHX.idx; CHX.tint = null; }
    const key = CHX.idx + ':' + Math.round(hu / 6) + ':' + colour; if (CHX.tintKey !== key || !CHX.tintC) { const t = CHX.tintC || (CHX.tintC = document.createElement('canvas')); t.width = t.height = R; const tq = t.getContext('2d'); tq.clearRect(0, 0, R, R); tq.drawImage(CHX.fld, 0, 0); tq.globalCompositeOperation = 'source-in'; tq.fillStyle = colour === 'theme' ? X.C.a : `hsl(${hu},85%,62%)`; tq.fillRect(0, 0, R, R); CHX.tintKey = key; }
    g.save(); g.imageSmoothingEnabled = true; g.globalAlpha = style === 'both' ? .5 : .9; g.globalCompositeOperation = 'lighter'; g.drawImage(CHX.tintC, px, py, S0, S0); g.restore(); }
  // the sand: it jitters where the plate moves (louder: harder) and sticks where it is still
  if (style !== 'lines') {
    if (!CHX.sand || CHX.sand.length !== nSand * 2) { CHX.sand = new Float32Array(nSand * 2); for (let i = 0; i < nSand * 2; i++) CHX.sand[i] = Math.random(); }
    const sd = CHX.sand, drive = shake * (.35 + 3.2 * clamp(X.energy || 0, 0, 1)) * (mo > 0 ? 1 : .4), step = .028 * Math.min(1, dt * 60);
    for (let i = 0; i < nSand; i++) { let x = sd[2 * i], y = sd[2 * i + 1]; const a = Math.abs(chPsi(n, m, x, y)); if (a * drive > .004 || Math.random() < .002) { x += CHX.randn() * a * drive * step * 2; y += CHX.randn() * a * drive * step * 2; if (x < 0) x = -x; if (x > 1) x = 2 - x; if (y < 0) y = -y; if (y > 1) y = 2 - y; sd[2 * i] = x; sd[2 * i + 1] = y; } }
    g.fillStyle = colour === 'theme' ? X.C.b : `hsla(${hu},75%,80%,.95)`; const gs = Math.max(1.9, S0 / 250); g.beginPath(); for (let i = 0; i < nSand; i++) g.rect(px + sd[2 * i] * S0, py + sd[2 * i + 1] * S0, gs, gs); g.fill();
  }
  hmText(g, 'mode (' + n + ', ' + m + ')' + (nt ? ' · ' + (nt.src === 'chord' ? 'chord root ' : '') + vlNoteName(nt.f) : follow === 'manual' ? ' · chosen' : ' · wandering'), px, py - 8 * sc, Math.round(15 * sc), 'rgba(255,255,255,.75)', 'left', 700);
  if (H > 260) hmText(g, 'a note picks the pattern · sand collects where the plate stays still · loud shakes it, quiet lets it settle', 14, H - 12, hmFz(W, H, 13), 'rgba(255,255,255,.3)', 'left', 500);
}

/* ---------- Pitch Trace ---------- */
VLOOK.pitchtrace = { title: 'Pitch Trace', opts: [
  { k: 'window', label: 'Seconds shown', type: 'range', min: 4, max: 20, step: 1, def: 10, tip: 'How much of your line stays on the screen' },
  { k: 'range', label: 'Range', type: 'choice', def: 'auto', opts: [['auto', 'Follows you'], ['fixed', 'Two octaves, fixed']], tip: 'Follow your voice up and down, or keep the same two octaves' },
  { k: 'chord', label: 'Chord notes', type: 'toggle', def: 1, tip: 'Light the lanes of the notes in the chord that is playing' },
  { k: 'cents', label: 'Tuning', type: 'toggle', def: 1, tip: 'Say how far from the note you are, in cents' },
  { k: 'guitar', label: 'Lead guitar', type: 'toggle', def: 1, tip: 'Draw the lead guitar’s line too, in blue' }] };
const PTX = { v: [], gt: [], c: 60, last: -1 };
/** keep a line of (time, note) for the voice and the lead: a gap breaks the line */
function vlPtPush(now) {
  const v = HM.vm != null && HM.vOn ? { t: now, m: HM.vm, a: clamp((AN.rms + 60) / 45, .15, 1) } : null, gm = AN.active && AN.midi != null ? { t: now, m: AN.midi + AN.cents / 100, a: clamp((AN.rms + 60) / 45, .15, 1) } : null;
  const put = (arr, s) => { const l = arr[arr.length - 1]; if (s) arr.push(s); else if (l) arr.push(null); if (arr.length > 1800) arr.splice(0, 600); };
  put(PTX.v, v); put(PTX.gt, gm);
}
function vlPitchTrace(g, W, H, X) {
  hmUpdate(); const now = HM.now, win = vlv('pitchtrace', 'window') * 1000, fixed = vlv('pitchtrace', 'range') === 'fixed', showCh = vlv('pitchtrace', 'chord'), showC = vlv('pitchtrace', 'cents'), showG = vlv('pitchtrace', 'guitar'), sc = clamp(Math.min(W, H * 1.25) / 700, .55, 1.6);
  if (PTX.last !== VZ.t) { PTX.last = VZ.t; vlPtPush(now); }
  const live = HM.vm != null && HM.vOn ? HM.vm : AN.active && AN.midi != null ? AN.midi : null; if (live != null) PTX.c += (live - PTX.c) * .04;
  const centre = fixed ? 60 : PTX.c, lo = Math.round(centre) - 12, hi = lo + 24, x0 = W * .09, x1 = W * .94, y0 = H * .1, y1 = H * .9, Y = m => y1 - (m - lo) / (hi - lo) * (y1 - y0), X_ = t => x1 - (now - t) / win * (x1 - x0);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 0, W, H);
  const scale = (S.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]).map(x => vlMod(x + S.key));
  // the notes of the key as lanes; the chord's brightest
  for (let mm = lo; mm <= hi; mm++) { const pc = vlMod(mm); if (!scale.includes(pc)) continue; const cls = showCh ? HM.cls[pc] : null, tone = cls === 'tone', colr = cls === 'colour', y = Y(mm);
    g.strokeStyle = tone ? 'rgba(255,205,90,.55)' : colr ? 'rgba(90,210,200,.28)' : 'rgba(255,255,255,.1)'; g.lineWidth = (tone ? 2.2 : 1) * sc; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    hmText(g, pcName(pc) + (pc === vlMod(S.key) || pc === 0 ? Math.floor(mm / 12) - 1 : ''), x0 - 8 * sc, y + 4 * sc, Math.round(12 * sc), tone ? 'rgba(255,215,120,.95)' : pc === vlMod(S.key) ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.4)', 'right', tone || pc === vlMod(S.key) ? 800 : 600); }
  // now
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x1, y0 - 6 * sc); g.lineTo(x1, y1 + 6 * sc); g.stroke();
  const trace = (arr, rgb, wide) => { g.lineCap = 'round'; g.lineJoin = 'round'; let prev = null;
    for (const s of arr) { if (!s || now - s.t > win) { prev = null; continue; } if (prev) { const x = X_(s.t), y = Y(s.m), age = 1 - (now - s.t) / win, off = Math.abs(s.m - Math.round(s.m)) * 100, hot = rgb ? 0 : clamp((off - 12) / 40, 0, 1);
        g.strokeStyle = rgb ? `rgba(${rgb},${.15 + .8 * age})` : `hsla(${48 - 40 * hot},95%,${62 - 6 * hot}%,${.15 + .85 * age})`; g.lineWidth = (wide ? (2 + 7 * s.a) : (1.5 + 3 * s.a)) * sc * (.5 + .5 * age); g.beginPath(); g.moveTo(X_(prev.t), Y(prev.m)); g.lineTo(x, y); g.stroke(); } prev = s; } g.lineCap = 'butt'; };
  if (showG) trace(PTX.gt, '120,180,255', false); trace(PTX.v, null, true);
  // the head: where you are now
  const hv = live != null ? live : null; if (hv != null) { const y = Y(hv), cents = (hv - Math.round(hv)) * 100, ok = Math.abs(cents) < 12; hmGlow(g, x1, y, 26 * sc, ok ? 'rgba(255,214,102,A)' : 'rgba(255,140,80,A)', .7); g.fillStyle = '#fff'; g.beginPath(); g.arc(x1, y, 5 * sc, 0, 7); g.fill();
    hmText(g, pcName(vlMod(Math.round(hv))) + (Math.floor(Math.round(hv) / 12) - 1) + (showC ? '  ' + (cents >= 0 ? '+' : '−') + Math.abs(Math.round(cents)) + '¢' : ''), x1 - 12 * sc, y - 14 * sc, Math.round(15 * sc), ok ? 'rgb(255,222,130)' : 'rgb(255,170,120)', 'right', 800); }
  else hmText(g, vzPlaying() ? 'listening…' : 'sing or play a note', x1 - 12 * sc, (y0 + y1) / 2, Math.round(16 * sc), 'rgba(255,255,255,.4)', 'right', 600);
  hmText(g, HM.sym ? HM.sym : '', x0, y0 - 14 * sc, Math.round(22 * sc), 'rgba(255,255,255,.85)', 'left', 800);
  if (H > 260) hmText(g, 'the lanes are the notes of the key · gold: the chord’s notes · the line is gold where you are in tune, warmer as it drifts', 14, H - 12, hmFz(W, H, 13), 'rgba(255,255,255,.3)', 'left', 500);
}
VL_DRAW.chladni = vlChladni; VL_DRAW.pitchtrace = vlPitchTrace;
