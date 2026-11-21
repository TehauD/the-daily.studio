/* ============================================================
   Part 66c · Three worlds of sound made geometric (2.80), each with its own dials (Design ▸ This world)
     Pitch Spiral       the spectrum wound into a spiral, one turn to the octave, so the same note is always on the same spoke. Tip it and it is a
                        helix. Joins the first harmonics of the note you play, and shows the notes of the key. (The hexagon field has the same
                        layout: Design ▸ Sound → Sight ▸ Pitch spiral.)
     Rhythm Polygons    the song's drum groove as rings of steps, one ring per drum, the hits joined into polygons; a playhead sweeps; your own
                        hits land on an outer ring, coloured by how far they are from the beat; a ring that is a Euclidean rhythm is named.
     Overtone Series    the harmonics of the note you sing or play, measured from the spectrum: as a rose (each harmonic at its note, further out
                        by octave), as bars (with how far each is from a perfect multiple) or as the string's own standing waves.
   Everything shown is measured from the sound or counted from the pattern; the pictures say what they are. They read the harmony state of part 65
   and the options in part 09f, and draw wherever the visuals draw (the stage, full screen, videos).
   ============================================================ */
VMODES.push(['spiral', 'Pitch Spiral'], ['rhythm', 'Rhythm Polygons'], ['overtones', 'Overtone Series']);
const VLX = { sp: null, ot: new Float32Array(33), live: [] };
const vlMtof = m => 440 * Math.pow(2, (m - 69) / 12), vlFtom = f => 69 + 12 * Math.log2(f / 440), vlMod = x => ((x % 12) + 12) % 12;
const vlHue = pc => (vlMod(pc) * 30 + 205) % 360;                                   /* a smooth rainbow round the octave: one hue per note */
const vlLow = k => ({ E2: 82.41, A1: 55, C2: 65.41, C1: 32.7 })[k] || 82.41;
const vlNoteName = f => { const m = Math.round(vlFtom(f)); return pcName(vlMod(m)) + (Math.floor(m / 12) - 1); };

/** the note to show: your voice, else the lead note you play, else the root of the chord the song is playing; null when nothing sounds */
function vlFund() {
  hmUpdate(); if (HM.vm != null && HM.vOn) return { f: vlMtof(HM.vm), src: 'voice' };
  if (AN.active && AN.f0 > 30) return { f: AN.f0, src: 'played' };
  if (vzPlaying() && HM.chord) return { f: vlMtof(36 + HM.chord.root), src: 'chord' };
  return null;
}

/** the first n harmonics of f0 as measured in the spectrum fd (dB per bin, bin width bh): where each peak is, how loud, how far from a perfect multiple */
function vlHarmonics(fd, bh, f0, n, lvlFn) {
  const out = [], nyq = (fd.length - 1) * bh;
  for (let k = 1; k <= n; k++) {
    const fk = f0 * k; if (fk > nyq - bh) break;
    const lo = Math.max(1, Math.floor(fk * Math.pow(2, -1 / 28) / bh)), hi = Math.min(fd.length - 2, Math.max(lo, Math.ceil(fk * Math.pow(2, 1 / 28) / bh)));
    let bi = lo; for (let i = lo; i <= hi; i++) if (fd[i] > fd[bi]) bi = i;
    let fp = bi * bh; if (bi > 1 && bi < fd.length - 2) { const a = Math.max(-140, fd[bi - 1]), b = Math.max(-140, fd[bi]), c = Math.max(-140, fd[bi + 1]), den = a - 2 * b + c; if (den < 0) fp = (bi + clamp(.5 * (a - c) / den, -.5, .5)) * bh; }   /* (silent bins are -Infinity dB) */
    out.push({ k, f: fp, v: lvlFn(fd[bi]), cents: 1200 * Math.log2(fp / fk), ok: bh <= fk * .03 });
  }
  return out;
}
const VL_DEG = ['1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'];
/** what a harmonic is, as a scale degree above the fundamental ("≈" where the harmonic is more than a quarter-tone from it) */
function vlHarmName(k) { const s = 12 * Math.log2(k), r = Math.round(s); return (Math.abs(s - r) > .25 ? '≈' : '') + VL_DEG[vlMod(r)]; }

/** a Euclidean rhythm: k hits spread as evenly as possible over n steps; the row matches if some turning of it is that rhythm */
function vlEuclid(k, n) { const p = []; for (let i = 0; i < n; i++) p.push(Math.floor((i + 1) * k / n) - Math.floor(i * k / n)); return p; }
const VL_EUC = { '3,8': 'tresillo', '5,8': 'cinquillo', '4,16': 'four on the floor', '7,12': 'West African bell', '5,16': 'bossa nova', '7,16': 'samba' };
function vlEuclidOf(row, n) {
  const bits = []; for (let i = 0; i < n; i++) bits.push(row[i] ? 1 : 0); const k = bits.reduce((a, b) => a + b, 0); if (k < 2 || k >= n) return null;
  const e = vlEuclid(k, n); for (let r = 0; r < n; r++) { let ok = true; for (let i = 0; i < n && ok; i++) if (e[(i + r) % n] !== bits[i]) ok = false; if (ok) return { k, n, name: 'E(' + k + ',' + n + ')', say: VL_EUC[k + ',' + n] || null }; }
  return null;
}

/* ---------- Pitch Spiral ---------- */
VLOOK.spiral = { title: 'Pitch Spiral', opts: [
  { k: 'octaves', label: 'Octaves', type: 'range', min: 3, max: 8, step: 1, def: 6, tip: 'How many octaves the spiral holds' },
  { k: 'low', label: 'Lowest note', type: 'choice', def: 'E2', opts: [['E2', 'E2 · guitar'], ['A1', 'A1 · bass'], ['C2', 'C2'], ['C1', 'C1']], tip: 'Where the spiral starts' },
  { k: 'style', label: 'Style', type: 'choice', def: 'ribbon', opts: [['ribbon', 'Ribbon'], ['dots', 'Dots'], ['cells', 'Hex cells']], tip: 'A ribbon of light, dots, or hexagons, one for each semitone' },
  { k: 'colour', label: 'Colour', type: 'choice', def: 'pitch', opts: [['pitch', 'By note'], ['fifths', 'By fifths'], ['theme', 'Theme']], tip: 'By note: a rainbow round the octave. By fifths: neighbours on the circle of fifths share a colour. Theme: your accent colours' },
  { k: 'tilt', label: 'Tilt', type: 'range', min: 0, max: 70, step: 1, def: 0, unit: 'deg', tip: 'Tip the spiral over into a helix' },
  { k: 'spin', label: 'Spin', type: 'range', min: 0, max: 1, step: .05, def: 0, unit: 'x', tip: 'Turn it slowly (the notes turn with it)' },
  { k: 'harm', label: 'Show harmonics', type: 'toggle', def: 1, tip: 'Join the first harmonics of the note you play' },
  { k: 'hold', label: 'Peak hold', type: 'toggle', def: 1, tip: 'Let peaks fade rather than vanish' },
  { k: 'labels', label: 'Note names', type: 'toggle', def: 1, tip: 'Name the twelve notes round the rim' }] };
/** where a frequency sits on the spiral: u octaves above the lowest note, and the angle (radians, C at the top) of its note */
function vlSpiralPos(f, low) { const u = Math.log2(f / low), m = vlFtom(low) + 12 * u; return { u, pc: vlMod(m), ang: vlMod(m) / 12 * Math.PI * 2 - Math.PI / 2 }; }

function vlSpiral(g, W, H, X) {
  hmUpdate(); const { fd, bin, lvl, C } = X, bh = X.bh || (fd.length > 1 ? (E.ctx.sampleRate / 2) / (fd.length - 1) : 21);
  const oc = vlv('spiral', 'octaves'), low = vlLow(vlv('spiral', 'low')), style = vlv('spiral', 'style'), colour = vlv('spiral', 'colour'), tilt = vlv('spiral', 'tilt') * Math.PI / 180, spin = vlv('spiral', 'spin'), harm = vlv('spiral', 'harm'), hold = vlv('spiral', 'hold'), labels = vlv('spiral', 'labels');
  const sc = clamp(Math.min(W, H * 1.25) / 700, .55, 1.6), cx = W / 2, cy = H * .53 + Math.sin(tilt) * H * .05, R = Math.min(W * .44, H * (.45 - Math.sin(tilt) * .07)), rot = VZ.t * spin * .12, dt = HM.dt || .016;
  const N = oc * 96, Hh = R * 1.1 * Math.sin(tilt), lowM = vlFtom(low), ct = Math.cos(tilt);
  const hue = pc => colour === 'fifths' ? (thFif(Math.round(pc)) * 30 + 200) % 360 : vlHue(pc), col = (pc, l, a) => colour === 'theme' ? (l > 62 ? C.b : C.a) : `hsla(${hue(pc)},85%,${l}%,${a})`;
  const P = (u, ang) => { const r = R * (.1 + .9 * u / oc), a = ang + rot, x = r * Math.cos(a), y = r * Math.sin(a), z = Hh * (u / oc); return [cx + x, cy + y * ct - (z - Hh / 2), y / (R || 1)]; };
  const A = u => { const m = lowM + 12 * u; return vlMod(m) / 12 * Math.PI * 2 - Math.PI / 2; };
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, W, H);
  const scale = (S.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]).map(x => vlMod(x + S.key));
  // the twelve notes as spokes (flat only: tipped over, the rim carries the names instead)
  if (tilt < .35) { g.lineWidth = 1; for (let pc = 0; pc < 12; pc++) { const a = pc / 12 * Math.PI * 2 - Math.PI / 2 + rot, inK = scale.includes(pc); g.strokeStyle = `rgba(255,255,255,${inK ? .1 : .04})`; g.beginPath(); g.moveTo(cx + Math.cos(a) * R * .1, cy + Math.sin(a) * R * .1 * ct); g.lineTo(cx + Math.cos(a) * R * 1.02, cy + Math.sin(a) * R * 1.02 * ct); g.stroke(); } }
  // the spiral's path
  g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i <= N; i++) { const u = i / 96, p = P(u, A(u)); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke();
  // the sound along it
  if (!VLX.sp || VLX.sp.length !== N + 1) VLX.sp = new Float32Array(N + 1); const sp = VLX.sp, dec = Math.pow(.18, dt), vs = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) { const f = low * Math.pow(2, i / 96), b = f / bh, i0 = Math.floor(b); let v = 0; if (i0 >= 1 && i0 < fd.length - 1) { const t = b - i0; v = lvl(fd[i0]) * (1 - t) + lvl(fd[i0 + 1]) * t; }   /* (silent bins are -Infinity dB: blend the levels, not the decibels) */
    if (!(v >= 0)) v = 0; sp[i] = hold ? Math.max(v, sp[i] * dec) : v; vs[i] = sp[i]; }
  if (style === 'ribbon') {
    g.lineCap = 'round'; for (let i = 1; i <= N; i++) { const v = vs[i]; if (v < .05) continue; const u0 = (i - 1) / 96, u1 = i / 96, a = P(u0, A(u0)), b = P(u1, A(u1)), pc = vlMod(lowM + 12 * u1), back = tilt > .05 ? .6 + .4 * ((a[2] + 1) / 2) : 1;
      g.strokeStyle = col(pc, 38 + 44 * v, clamp(.12 + v * 1.1, 0, 1) * back); g.lineWidth = (1.2 + 15 * v * v + 4 * v) * sc * (tilt > .05 ? .7 + .3 * back : 1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    g.lineCap = 'butt';
  } else {
    for (let n = 0; n <= oc * 12; n++) { const u = n / 12, f = low * Math.pow(2, u), b = f / bh, b0 = Math.max(1, Math.floor(f * Math.pow(2, -1 / 24) / bh)), b1 = Math.min(fd.length - 1, Math.max(b0, Math.ceil(f * Math.pow(2, 1 / 24) / bh)));
      let v = 0; for (let i = b0; i <= b1; i++) v = Math.max(v, lvl(fd[i])); const key = n; VLX.cell = VLX.cell || []; VLX.cell[key] = hold ? Math.max(v, (VLX.cell[key] || 0) * dec) : v; v = VLX.cell[key];
      const p = P(u, A(u)), pc = vlMod(lowM + 12 * u), back = tilt > .05 ? .6 + .4 * ((p[2] + 1) / 2) : 1, rr = clamp(Math.min(R / oc * .5, 2 * Math.PI * R * (.1 + .9 * u / oc) / 12 * .52), 4 * sc, 40 * sc);
      if (style === 'dots') { if (v < .06) { g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.arc(p[0], p[1], 2 * sc, 0, 7); g.fill(); continue; } g.fillStyle = col(pc, 40 + 40 * v, clamp(.2 + v, 0, 1) * back); g.beginPath(); g.arc(p[0], p[1], (2 + v * 11) * sc * (.8 + .2 * back), 0, 7); g.fill(); }
      else { hexPath(g, p[0], p[1], rr * (.5 + .5 * v)); g.fillStyle = col(pc, 34 + 40 * v, clamp(.07 + v * .95, 0, 1) * back); g.fill(); g.strokeStyle = col(pc, 70, (.12 + .6 * v) * back); g.lineWidth = 1; g.stroke(); }
    }
  }
  // the note, and the harmonics that build on it
  const nt = vlFund(); let label = '';
  if (nt && nt.f >= low * .97) {
    const sp0 = vlSpiralPos(nt.f, low), pts = [];
    if (harm) for (let k = 1; k <= 10; k++) { const u = Math.log2(k * nt.f / low); if (u < 0 || u > oc) continue; const p = P(u, A(u)); pts.push({ k, p, u }); }
    if (pts.length > 1) { g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1 * sc; g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q.p[0], q.p[1]) : g.moveTo(q.p[0], q.p[1])); g.stroke(); }
    pts.forEach(q => { const first = q.k === 1; g.fillStyle = first ? '#fff' : 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(q.p[0], q.p[1], (first ? 7 : 4.4) * sc, 0, 7); g.fill(); if (labels || first) hmText(g, String(q.k), q.p[0], q.p[1] - 9 * sc, Math.round(11 * sc), 'rgba(255,255,255,.8)', 'center', 700); });
    if (!harm && sp0.u >= 0 && sp0.u <= oc) { const p = P(sp0.u, A(sp0.u)); g.strokeStyle = '#fff'; g.lineWidth = 2.2 * sc; g.beginPath(); g.arc(p[0], p[1], 8 * sc, 0, 7); g.stroke(); }
    label = (nt.src === 'chord' ? HM.sym + ' · root ' : '') + vlNoteName(nt.f) + (nt.src !== 'chord' ? ' · ' + Math.round(nt.f) + ' Hz' : '');
  }
  // the rim: the notes' names (the key's own brighter)
  if (labels) for (let pc = 0; pc < 12; pc++) { const a = pc / 12 * Math.PI * 2 - Math.PI / 2 + rot, x = cx + Math.cos(a) * R * 1.1, y = cy + Math.sin(a) * R * 1.1 * ct - Hh / 2; hmText(g, pcName(pc), x, y + 4 * sc, Math.round(13 * sc), scale.includes(pc) ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.3)', 'center', 700); }
  hmText(g, label || (vzPlaying() ? '' : 'sing or play a note'), cx, cy + 5 * sc, Math.round(16 * sc), 'rgba(255,255,255,.9)', 'center', 800);
  if (H > 260) hmText(g, 'each turn is an octave · the same note is always on the same spoke · lit by what is sounding', 14, H - 12, hmFz(W, H, 13), 'rgba(255,255,255,.3)', 'left', 500);
}

/* ---------- Rhythm Polygons ---------- */
VLOOK.rhythm = { title: 'Rhythm Polygons', opts: [
  { k: 'rows', label: 'Drums', type: 'choice', def: 'active', opts: [['active', 'Those in the groove'], ['main', 'Kick · snare · hat'], ['all', 'All six']], tip: 'Which drums get a ring' },
  { k: 'polygons', label: 'Polygons', type: 'toggle', def: 1, tip: 'Join each ring’s hits into a shape' },
  { k: 'euclid', label: 'Name the rhythm', type: 'toggle', def: 1, tip: 'Label a ring that is a Euclidean rhythm (hits spread as evenly as possible), like E(3,8)' },
  { k: 'sweep', label: 'Playhead', type: 'toggle', def: 1, tip: 'A sweep that follows the song' },
  { k: 'live', label: 'Your hits', type: 'toggle', def: 1, tip: 'Show where your playing lands against the beat, on an outer ring' },
  { k: 'follow', label: 'Turn with the beat', type: 'toggle', def: 0, tip: 'Keep the playhead at the top and let the rings turn' }] };
const VL_RHUE = [18, 48, 175, 205, 300, 265];
function vlRhythm(g, W, H, X) {
  hmUpdate(); const pat = dpat(), L = Math.max(4, Math.min(S.band.drumLen || 16, 32)), now = HM.now, mo = hmCm().motion, sc = clamp(Math.min(W, H * 1.25) / 700, .55, 1.6);
  const mode = vlv('rhythm', 'rows'), poly = vlv('rhythm', 'polygons'), eu = vlv('rhythm', 'euclid'), sweep = vlv('rhythm', 'sweep'), live = vlv('rhythm', 'live'), follow = vlv('rhythm', 'follow');
  let rows = DROWS.map((n, i) => i); if (mode === 'main') rows = [0, 1, 2]; else if (mode === 'active') { rows = rows.filter(r => pat[r] && pat[r].slice(0, L).some(v => v)); if (!rows.length) rows = [0, 1, 2]; }
  const cx = W / 2, cy = H * .52, Rmax = Math.min(W * .4, H * .37) , n = rows.length, rIn = Rmax * .46, ring = j => Rmax - j * ((Rmax - rIn) / Math.max(1, n - 1 + (n === 1 ? 1 : 0)));
  const ph = T.playing ? (playheadSlot() % L + L) % L : -1, turn = follow && ph >= 0 ? ph / L * Math.PI * 2 : 0, ang = i => i / L * Math.PI * 2 - Math.PI / 2 - turn;
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, W, H);
  // the beats round the outside
  const perBeat = Math.max(1, Math.round(spb() / S.ts[0])), outer = Rmax * 1.08;
  for (let i = 0; i < L; i++) { const a = ang(i), strong = i % spb() === 0, beat = i % perBeat === 0, r0 = Rmax * 1.02, r1 = r0 + (strong ? 16 : beat ? 9 : 4) * sc; g.strokeStyle = `rgba(255,255,255,${strong ? .55 : beat ? .3 : .12})`; g.lineWidth = (strong ? 2.4 : 1) * sc; g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke(); }
  // the rings, the hits, the polygons
  const names = [];
  rows.forEach((row, j) => {
    const r = n === 1 ? Rmax * .7 : ring(j), hue = VL_RHUE[row] || 200, hits = []; for (let i = 0; i < L; i++) { const v = pat[row][i] || 0; if (v) hits.push({ i, v }); }
    g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    for (let i = 0; i < L; i++) { const a = ang(i); g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.6 * sc, 0, 7); g.fill(); }
    if (poly && hits.length > 1) { g.beginPath(); hits.forEach((h, q) => { const a = ang(h.i), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; q ? g.lineTo(x, y) : g.moveTo(x, y); }); if (hits.length > 2) g.closePath(); g.fillStyle = `hsla(${hue},80%,55%,.09)`; if (hits.length > 2) g.fill(); g.strokeStyle = `hsla(${hue},85%,62%,.65)`; g.lineWidth = 1.6 * sc; g.stroke(); }
    hits.forEach(hh => { const a = ang(hh.i), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, age = ph >= 0 ? ((ph - hh.i) % L + L) % L : 99, fl = ph >= 0 && age < 1.5 ? 1 - age / 1.5 : 0, rr = (hh.v === 1 ? 4 : hh.v === 2 ? 6.5 : 8.5) * sc * (1 + fl * .7 * mo);
      if (fl > 0 && mo > 0) hmGlow(g, x, y, rr * 4, `hsla(${hue},90%,62%,A)`, .6 * fl); g.fillStyle = `hsla(${hue},85%,${58 + 22 * fl}%,${hh.v === 1 ? .7 : .95})`; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); });
    const e = eu ? vlEuclidOf(pat[row], L) : null; names.push({ row, r, hits: hits.length, e, hue });
  });
  // the ring names, at the top of each ring
  names.forEach(nm => { const lab = DROWS[nm.row] + ' · ' + nm.hits + '/' + L + (nm.e ? ' · ' + nm.e.name + (nm.e.say ? ' ' + nm.e.say : '') : ''); hmText(g, lab, cx + 6 * sc, cy - nm.r - 5 * sc, Math.round(11 * sc), `hsla(${nm.hue},80%,72%,.9)`, 'left', 700); });
  // the playhead
  if (sweep && ph >= 0) { const a = ang(ph); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.6 * sc; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer); g.stroke(); }
  // your hits: on the outer ring, coloured by how far from the beat
  let meanMs = null; const sd = slotDur() * 1000;
  if (live) { const rl = Rmax * 1.2, recent = HM.onsets.filter(o => o.slot >= 0 && now - o.t < 6000); g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, rl, 0, 7); g.stroke();
    recent.forEach(o => { const age = (now - o.t) / 6000, a = ((((o.slot % L) + L) % L) / L) * Math.PI * 2 - Math.PI / 2 - turn, ms = o.dev * sd, ab = Math.abs(ms), c = ab < 12 ? '48,95%,64%' : ms > 0 ? '22,95%,60%' : '195,90%,62%';
      g.fillStyle = `hsla(${c},${clamp(1 - age, .1, 1)})`; g.beginPath(); g.arc(cx + Math.cos(a) * rl, cy + Math.sin(a) * rl, (3 + o.a * 5) * sc, 0, 7); g.fill(); });
    if (recent.length) meanMs = HM.dev * sd; }
  // the middle
  const bpm = Math.round(S.bpm * 10) / 10, fs = Math.round(clamp(rIn * .38, 15, 36)); hmText(g, bpm + ' BPM', cx, cy + fs * .1, fs, '#fff', 'center', 800); hmText(g, S.ts[0] + '/' + S.ts[1] + ' · ' + (S.band.patName || 'groove'), cx, cy + fs * .55, Math.round(fs * .34), 'rgba(255,255,255,.55)', 'center', 600);
  if (meanMs != null) { const ab = Math.abs(meanMs); hmText(g, ab < 8 ? 'on the beat' : Math.round(ab) + ' ms ' + (meanMs > 0 ? 'behind' : 'ahead'), cx, cy + fs * 1.05, Math.round(fs * .4), ab < 8 ? 'hsl(48,95%,66%)' : meanMs > 0 ? 'hsl(22,95%,66%)' : 'hsl(195,90%,68%)', 'center', 700); }
  else if (live && H > 260) hmText(g, T.playing ? 'play along: your hits land on the outer ring' : 'press play, then play along', cx, cy + fs * 1.05, Math.round(fs * .34), 'rgba(255,255,255,.35)', 'center', 500);
  if (H > 260) hmText(g, 'a ring per drum · hits joined into a shape · gold: on the beat, orange: behind, blue: ahead', 14, H - 12, hmFz(W, H, 13), 'rgba(255,255,255,.3)', 'left', 500);
}

/* ---------- Overtone Series ---------- */
VLOOK.overtones = { title: 'Overtone Series', opts: [
  { k: 'view', label: 'View', type: 'choice', def: 'rose', opts: [['rose', 'Rose', 'Each harmonic at its note, further out by octave'], ['bars', 'Bars', 'Loudness of each harmonic, with its tuning offset'], ['string', 'String', 'The string’s own standing waves, built from what is measured']], tip: 'How to look at the harmonics' },
  { k: 'count', label: 'Harmonics', type: 'range', min: 6, max: 24, step: 1, def: 12, tip: 'How many harmonics to measure' },
  { k: 'scale', label: 'Loudness', type: 'choice', def: 'db', opts: [['db', 'Decibels'], ['lin', 'Linear']], tip: 'Decibels show quiet harmonics too; linear shows only the strong ones' },
  { k: 'labels', label: 'Labels', type: 'choice', def: 'interval', opts: [['interval', 'Interval'], ['number', 'Number'], ['note', 'Note'], ['none', 'None']], tip: 'Interval: what each harmonic is above the note (the 3rd is a fifth, the 5th a major third)' },
  { k: 'cents', label: 'Tuning offsets', type: 'toggle', def: 1, tip: 'How far each harmonic is from a perfect multiple, in cents (where the spectrum is fine enough to tell)' },
  { k: 'hold', label: 'Peak hold', type: 'toggle', def: 1, tip: 'Let peaks fade rather than vanish' }] };
function vlOvertones(g, W, H, X) {
  hmUpdate(); const { fd, lvl, C } = X, bh = X.bh || (E.ctx.sampleRate / 2) / (fd.length - 1), dt = HM.dt || .016;
  const view = vlv('overtones', 'view'), n = vlv('overtones', 'count'), scl = vlv('overtones', 'scale'), lab = vlv('overtones', 'labels'), cents = vlv('overtones', 'cents'), hold = vlv('overtones', 'hold');
  const sc = clamp(Math.min(W, H * 1.25) / 700, .55, 1.6), nt = vlFund(); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, W, H);
  if (!nt) { hmText(g, 'sing or play a note to see its overtones', W / 2, H / 2, Math.round(18 * sc), 'rgba(255,255,255,.45)', 'center', 600); return; }
  const hs = vlHarmonics(fd, bh, nt.f, n, lvl), dec = Math.pow(.2, dt), rv = v => scl === 'lin' ? v * v : v;
  hs.forEach(h => { const vv = rv(h.v); VLX.ot[h.k] = hold ? Math.max(vv, VLX.ot[h.k] * dec) : vv; h.s = VLX.ot[h.k]; });
  const f0m = vlFtom(nt.f), lblOf = h => lab === 'interval' ? vlHarmName(h.k) : lab === 'number' ? String(h.k) : lab === 'note' ? pcName(vlMod(Math.round(vlFtom(nt.f * h.k)))) : '';
  const head = (nt.src === 'chord' ? 'following the chord root · ' : '') + vlNoteName(nt.f) + ' · ' + nt.f.toFixed(1) + ' Hz'; hmText(g, head, 16, hmY(H, 14), hmFz(W, H, 22), '#fff', 'left', 800);
  if (view === 'bars') {
    const x0 = W * .06, x1 = W * .94, bw = (x1 - x0) / n, base = H * .78, mh = H * .6;
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, base); g.lineTo(x1, base); g.stroke();
    hs.forEach((h, i) => { const x = x0 + i * bw, bhh = h.s * mh, pc = vlMod(f0m + 12 * Math.log2(h.k)); g.fillStyle = `hsla(${vlHue(pc)},80%,${40 + 25 * h.s}%,${.3 + .65 * h.s})`; g.fillRect(x + bw * .16, base - bhh, bw * .68, bhh); g.strokeStyle = `hsla(${vlHue(pc)},90%,70%,.8)`; g.strokeRect(x + bw * .16, base - bhh, bw * .68, bhh);
      hmText(g, String(h.k), x + bw / 2, base + 16 * sc, Math.round(12 * sc), 'rgba(255,255,255,.55)', 'center', 700); if (lab !== 'none' && lab !== 'number') hmText(g, lblOf(h), x + bw / 2, base + 32 * sc, Math.round(12 * sc), 'rgba(255,255,255,.8)', 'center', 700);
      if (cents && h.ok && h.s > .15) { const c = clamp(h.cents, -50, 50), y = base - bhh - 8 * sc; g.strokeStyle = Math.abs(c) < 8 ? 'hsl(48,90%,64%)' : 'hsl(22,90%,62%)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + bw / 2, y); g.lineTo(x + bw / 2 + c / 50 * bw * .4, y); g.stroke(); hmText(g, (c > 0 ? '+' : '') + Math.round(h.cents), x + bw / 2, y - 6 * sc, Math.round(10 * sc), 'rgba(255,255,255,.55)', 'center', 600); } });
    if (H > 260) hmText(g, 'harmonic number, and what it is above the note · tick: how far from a perfect multiple, in cents', 14, H - 12, hmFz(W, H, 13), 'rgba(255,255,255,.3)', 'left', 500);
  } else if (view === 'string') {
    const x0 = W * .08, x1 = W * .92, cy = H * .55, amp = H * .26, t = VZ.t * .8, pts = 240; let tot = 0; hs.forEach(h => { tot += h.s; }); const norm = tot > .05 ? 1 / Math.max(1, tot * .6) : 1;
    g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, cy); g.lineTo(x1, cy); g.stroke();
    hs.slice(0, 5).forEach(h => { if (h.s < .08) return; g.strokeStyle = `hsla(${vlHue(vlMod(f0m + 12 * Math.log2(h.k)))},80%,62%,${.2 + .3 * h.s})`; g.lineWidth = 1.2 * sc; g.beginPath(); for (let i = 0; i <= pts; i++) { const x = i / pts, y = Math.sin(h.k * Math.PI * x) * Math.cos(t * h.k * 1.7) * h.s * amp * .8 * norm; const px = lerp(x0, x1, x), py = cy + y; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); });
    g.strokeStyle = '#fff'; g.lineWidth = 3 * sc; g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i <= pts; i++) { const x = i / pts; let y = 0; hs.forEach(h => { y += Math.sin(h.k * Math.PI * x) * Math.cos(t * h.k * 1.7) * h.s * norm; }); const px = lerp(x0, x1, x), py = cy + y * amp; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
    g.fillStyle = '#fff'; [x0, x1].forEach(x => { g.beginPath(); g.arc(x, cy, 6 * sc, 0, 7); g.fill(); });
    if (H > 260) hmText(g, 'the string’s standing waves, built from the harmonics measured in the sound (slowed down so you can see them)', 14, H - 12, hmFz(W, H, 13), 'rgba(255,255,255,.3)', 'left', 500);
  } else {
    const cx = W / 2, cy = H * .54, R = Math.min(W * .42, H * .4), rad = k => R * (.16 + .84 * Math.log2(k) / Math.log2(Math.max(2, n)));
    // the note itself is always at the top: each harmonic's place is its note measured from the fundamental
    const A = k => (12 * Math.log2(k) % 12 + 12) % 12 / 12 * Math.PI * 2 - Math.PI / 2;
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; for (let o = 1; o <= Math.floor(Math.log2(n)); o++) { g.beginPath(); g.arc(cx, cy, rad(Math.pow(2, o)), 0, 7); g.stroke(); } for (let s = 0; s < 12; s++) { const a = s / 12 * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * R * .12, cy + Math.sin(a) * R * .12); g.lineTo(cx + Math.cos(a) * R * 1.02, cy + Math.sin(a) * R * 1.02); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1.2 * sc; g.beginPath(); hs.forEach((h, i) => { const a = A(h.k), r = rad(h.k), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    hs.forEach(h => { const a = A(h.k), r = rad(h.k), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, pc = vlMod(f0m + 12 * Math.log2(h.k)), rr = (4 + 20 * h.s) * sc; hmGlow(g, x, y, rr * 3, `hsla(${vlHue(pc)},90%,62%,A)`, .15 + .5 * h.s); g.fillStyle = `hsla(${vlHue(pc)},85%,${45 + 30 * h.s}%,${.35 + .6 * h.s})`; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1; g.stroke();
      hmText(g, String(h.k), x, y + 4 * sc, Math.round(Math.max(9, rr * .9)), '#0a0f10', 'center', 800); const t = lab !== 'number' && lab !== 'none' ? lblOf(h) : ''; const tt = (t ? t : '') + (cents && h.ok && h.s > .15 && lab !== 'none' ? (t ? ' ' : '') + (h.cents > 0 ? '+' : '') + Math.round(h.cents) + '¢' : ''); if (tt) hmText(g, tt, x, y - rr - 5 * sc, Math.round(11 * sc), 'rgba(255,255,255,.75)', 'center', 700); });
    if (H > 260) hmText(g, 'each harmonic at its note, further out by octave · 1 at the top is the note itself · the size is how loud it is', 14, H - 12, hmFz(W, H, 13), 'rgba(255,255,255,.3)', 'left', 500);
  }
}
VL_DRAW.spiral = vlSpiral; VL_DRAW.rhythm = vlRhythm; VL_DRAW.overtones = vlOvertones;
