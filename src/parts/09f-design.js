/* ============================================================
   Part 09f · The Visual Instrument (2.77) — worlds, a design drawer, and a hexagon field you can reshape
   The Visuals had grown to some thirty looks in two rows, each with its own controls. They now share one idea, taken from the Hex Resonance field:
       WHERE is the pitch (space is frequency: the middle is low, the edge is high — the way the ear lays frequency out along the cochlea)
       HOW BRIGHT is the energy (light is loudness)           WHEN is the beat (a ring of light is a pulse)           WHAT COLOUR is the harmony
   · Worlds: every look is kept, sorted into five families by what it shows you (frequency, harmony, time, life and space, you), each with a one-line meaning.
   · The design drawer: Shape and Sound → Sight reshape the hexagon field (the lattice, the layout of pitch, how it listens); Finish (glow, trails,
     mirror and kaleidoscope, speed, zoom) works on every world; Colour; saved Designs. Soundprint's controls live here too.
   Everything defaults to the original hexagon field, drawn by the original code, so nothing changes until you move something.
   ============================================================ */
const VD_DEF = { shape: 'hex', round: 0, gap: 0, twist: 0, spin: 0, layout: 'rings', sens: 1, memory: .86, pulse: 1, noteHue: 0, glow: 0, trails: 0, mirror: 1 };
const vdv = k => { const v = (CFG.vd || {})[k]; return v == null ? VD_DEF[k] : v; };
let vdSaveT = 0;
function vdSet(k, v) { const o = Object.assign({}, CFG.vd || {}); if (v === VD_DEF[k]) delete o[k]; else o[k] = v; CFG.vd = o; VZ.sm = null; clearTimeout(vdSaveT); vdSaveT = setTimeout(saveCfg, 300); vdMark(); }
const vdShapeDefault = () => ['shape', 'round', 'gap', 'twist', 'spin', 'layout', 'sens', 'memory', 'pulse', 'noteHue'].every(k => vdv(k) === VD_DEF[k]);
const vdPostOn = m => { const c = vsCaps(m || VZ.mode); return !!((c.glow && vdv('glow') > 0) || (c.trails && vdv('trails') > 0) || (c.mirror && vdv('mirror') !== 1)); };
const vdChanged = () => !vdShapeDefault() || vdPostOn() || vzAdjusted() || vlChanged();
function vdMark() { const b = document.getElementById('vzDesignBtn'); if (b) b.classList.toggle('on', vdChanged()); }

/* ---------- per-world options (2.80): a world can offer its own dials; they are drawn in Design ▸ This world, kept in CFG.vo, saved in designs ---------- */
const VLOOK = {};          /* mode → { title, opts: [{ k, label, type: 'range'|'choice'|'toggle', def, min, max, step, unit, opts: [[value, label, tip]], tip }] } (filled by the looks) */
const VL_DRAW = {};        /* mode → draw function (g, W, H, X) for the worlds that bring their own options */
const vlDef = (mode, k) => { const d = VLOOK[mode] && VLOOK[mode].opts.find(x => x.k === k); return d ? d.def : undefined; };
const vlv = (mode, k) => { const o = ((CFG.vo || {})[mode] || {})[k]; return o == null ? vlDef(mode, k) : o; };
function vlSet(mode, k, v) {
  const all = Object.assign({}, CFG.vo || {}), m = Object.assign({}, all[mode] || {}); if (v === vlDef(mode, k)) delete m[k]; else m[k] = v; if (Object.keys(m).length) all[mode] = m; else delete all[mode];
  CFG.vo = all; VDX.prevOk = false; clearTimeout(vdSaveT); vdSaveT = setTimeout(saveCfg, 300); vdMark();
}
const vlChanged = () => !!CFG.vo && Object.keys(CFG.vo).length > 0;
/** the dials of the world now showing, as controls */
function vlControls(mode) {
  const L = VLOOK[mode]; if (!L) return null; const rows = [];
  L.opts.forEach(o => {
    const cur = vlv(mode, o.k);
    if (o.type === 'range') { const fmt = v => o.unit === 'deg' ? Math.round(v) + '°' : o.unit === '%' ? Math.round(v * 100) + '%' : o.unit === 'x' ? (+v).toFixed(2) + '×' : String(Math.round(v * 100) / 100), val = h('b', { class: 'mono tiny vd-v' }, fmt(cur));
      rows.push(h('label', { class: 'vd-row', title: (o.tip || '') + ' (double-click to reset)' }, h('span', { class: 'vd-l' }, o.label), h('input', { type: 'range', min: o.min, max: o.max, step: o.step || 1, value: cur, 'data-vo': o.k, id: 'vo_' + mode + '_' + o.k, 'aria-label': o.label, title: o.tip || '', oninput: e => { vlSet(mode, o.k, +e.target.value); val.textContent = fmt(+e.target.value); }, ondblclick: e => { vlSet(mode, o.k, o.def); e.target.value = o.def; val.textContent = fmt(o.def); } }), val)); }
    else if (o.type === 'toggle') rows.push(h('label', { class: 'vd-row', title: o.tip || '' }, h('span', { class: 'vd-l' }, o.label), h('input', { type: 'checkbox', 'data-vo': o.k, id: 'vo_' + mode + '_' + o.k, checked: !!cur, 'aria-label': o.label, onchange: e => vlSet(mode, o.k, e.target.checked ? 1 : 0) })));
    else { const box = h('div', { class: 'vd-row', title: o.tip || '' }, h('span', { class: 'vd-l' }, o.label), h('div', { class: 'seg', role: 'radiogroup', 'aria-label': o.label }, o.opts.map(([v, n, t]) => h('button', { type: 'button', role: 'radio', 'data-vo': o.k, 'data-v': String(v), class: String(cur) === String(v) ? 'on' : '', 'aria-checked': String(String(cur) === String(v)), title: t || n,
        onclick: e => { vlSet(mode, o.k, v); box.querySelectorAll('button').forEach(b => { const on = b === e.currentTarget; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); } }, n)))); rows.push(box); }
  });
  rows.push(h('div', { class: 'row', style: { gap: '6px' } }, h('button', { class: 'btn sm', type: 'button', id: 'vlReset', onclick: () => { const all = Object.assign({}, CFG.vo || {}); delete all[mode]; CFG.vo = all; saveCfg(); vdPaint(); vdMark(); } }, 'Reset this world’s options')));
  return h('div', { class: 'vd-opts', id: 'vdOpts', 'data-mode': mode }, rows);
}

/* ---------- the families: what each world shows you ---------- */
const VFAMS = [
  ['sound', 'Sound', 'What the sound is doing: where the pitches are and how they move.', ['hex', 'spiral', 'cymatics', 'chladni', 'pulse']],
  ['harm', 'Harmony', 'What the music means: keys, chords and how they connect.', ['wheel', 'tonnetz', 'neural', 'halo', 'kaleido', 'mood']],
  ['air', 'Atmosphere', 'Cinematic backdrops that move with the song, for videos and for behind you.', ['aurora', 'nebula', 'arena', 'video']],
  ['perf', 'Performance', 'You in the picture: your voice, your words, your show.', ['concert', 'prompter', 'swarms', 'field', 'pitchtrace']]];
const VSAY = { chladni: 'A vibrating plate: the note you sing or play picks a pattern, and sand collects on the lines where the plate stays still. When it is quiet the sand settles.', pitchtrace: 'Your voice (and your lead guitar) as a line across the notes of the key, with the chord’s notes brightest, so you can see where you are in the song.', spiral: 'The spectrum wound into a spiral, one turn to the octave: the same note is always on the same spoke. Tip it into a helix; it joins the harmonics of the note you play.', rhythm: 'The groove as rings of steps, the hits joined into polygons, with your own hits landing on an outer ring coloured by how far from the beat they are.', overtones: 'The harmonics of the note you sing or play, measured from the sound: as a rose, as bars, or as the string’s standing waves.', wheel: 'The circle of fifths as a live network: the key lit, every chord change drawn from one chord to the next, the notes you play on the rim, and the chord likely to come next.', tonnetz: 'The lattice of music theory: fifths, major thirds and minor thirds, with every triangle a chord. The view follows the chord, and the line it draws is how little each chord moves.', hex: 'The original: a honeycomb that lights where the sound is. Reshape it in Settings.', spectrum: 'The spectrum as glowing bars behind you.', cymatics: 'Sound made into the patterns it draws on a vibrating plate.', ripple: 'A wave field: the bands and the beat disturb a surface.', wave: 'The waveform itself, large.',
  halo: 'The twelve notes on the circle of fifths, lit as you play.', neural: 'A 3D network that learns the song as it plays: bands, notes, chords and the chords that follow. Switch it to Fifths for the circle.', bloom: 'A flower that opens on each chord.', orbit: 'Chords as orbiting bodies around their key.', gravity: 'Notes pulled toward the chord that is home.', dna: 'The chords of the song as a double helix.', stars: 'Notes you play become a constellation.', kaleido: 'A kaleidoscope turned by the harmony.', mood: 'The colour of the mood: warm, cool, tense, open.',
  pulse: 'A grid that throbs on the beat.', fluid: 'Rhythm as flowing ink.', rings: 'Rings that leave the middle on each hit.', ribbons: 'Ribbons of light that follow the sound.', skyline: 'A city skyline the music builds.',
  life: 'Organisms that grow where you play loudest (reaction-diffusion).', stardust: 'A particle galaxy.', aurora: 'Curtains of northern light.', warp: 'Flying through stars at the speed of the song.', nebula: 'Clouds of gas lit by the sound.', arena: 'A 3D stage you stand inside.',
  concert: 'A show: lights, lasers and a crowd, for the camera.', prompter: 'Your words and chords, large, in time.', swarms: 'Your voice and guitar as two swarms.', field: 'A field that shows where in the key you are improvising.', paint: 'The session painted as you play.', sprint: 'A picture of the whole song, made once and kept with it.', video: 'Your own clips, behind you.' };
const VCORE = new Set(['hex', 'wheel', 'aurora', 'concert', 'prompter']);

/** the picker: five families, every look kept. Buttons keep data-m inside .seg so every other part still finds them */
function vzWorlds() {
  const all = new Map(); VMODES.filter(m => !VZ_MONITOR.has(m[0])).concat(VBACK).forEach(([k, n]) => { if (!all.has(k)) all.set(k, n); });
  const used = new Set(), btn = (k, n) => h('button', { type: 'button', class: (k === VZ.mode ? 'on' : '') + (VLOOK[k] ? ' has-opts' : ''), 'data-m': k, 'data-core': VCORE.has(k) ? '1' : null, title: (VSAY[k] || n) + (VLOOK[k] ? ' · has its own options in Settings' : ''), onclick: () => vzSetMode(k) }, n);
  const groups = VFAMS.map(([id, name, say, ids]) => ({ id, name, say, list: ids.filter(k => all.has(k)) })); groups.forEach(g => g.list.forEach(k => used.add(k)));
  const rest = [...all].filter(([k]) => !used.has(k)).map(([k]) => k); groups.push({ id: 'more', name: 'More looks', say: 'The rest of the library.', list: rest });
  const cur = vzFamOf(VZ.mode, true);
  const tabs = h('div', { class: 'vz-groups', role: 'tablist', 'aria-label': 'Looks, by what they show' }, groups.filter(g => g.list.length).map(g => h('button', { type: 'button', role: 'tab', 'data-grp': g.id, 'aria-selected': String(g.id === cur), class: g.id === cur ? 'on' : '', title: g.say, onclick: () => vzGroupShow(g.id) }, g.name)));
  const fams = h('div', { class: 'vz-fams', id: 'vzBack' }, groups.filter(g => g.list.length).map(g => h('section', { class: 'vz-fam' + (g.id === cur ? ' on' : ''), 'data-fam': g.id, 'aria-label': g.name }, h('div', { class: 'seg', role: 'group', 'aria-label': g.name }, g.list.map(k => btn(k, all.get(k))), g.id === 'air' && typeof vbgBtn === 'function' ? vbgBtn() : null))));
  return h('div', { class: 'vz-strip', id: 'vzLooks' }, tabs, fams, h('p', { class: 'vz-cap tiny', id: 'vzCap' }), h('button', { class: 'btn sm vz-more', id: 'vzMoreLooks', type: 'button', onclick: e => { const on = document.body.classList.toggle('vz-all'); e.currentTarget.textContent = on ? 'Fewer looks' : 'More looks…'; } }, 'More looks…'));
}
/** the group a look belongs to (its id, or its name); the looks no group names are in More looks */
const vzFamOf = (k, id) => { const f = VFAMS.find(x => x[3].includes(k)); return id ? (f ? f[0] : 'more') : (f ? f[1] : 'More looks'); };
/** show one group's looks under the tabs (this does not change the look) */
function vzGroupShow(id) { document.querySelectorAll('#vzLooks .vz-fam').forEach(f => f.classList.toggle('on', f.dataset.fam === id)); document.querySelectorAll('#vzLooks .vz-groups [data-grp]').forEach(b => { const on = b.dataset.grp === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }); }
/** the strip follows the look: its group, and a line saying what it shows */
function vzStripSync() { vzGroupShow(vzFamOf(VZ.mode, true)); const c = document.getElementById('vzCap'); if (c) c.textContent = (VSAY[VZ.mode] || '') + (VLOOK[VZ.mode] ? ' · options in Settings' : ''); }


/* ---------- the reshapeable lattice (Hex Resonance with the dials) ---------- */
function vdHue() { /* colour follows the note you sing, or the chord that is playing; neighbours on the circle of fifths are neighbours in colour */
  let pc = null; if (typeof PB !== 'undefined' && vzPlaying() && PB.sym) { const c = parseChord(PB.sym); if (c) pc = c.root; } else if (AN.active && AN.midi != null) pc = ((Math.round(AN.midi) % 12) + 12) % 12;
  const V = vdHue.s || (vdHue.s = { h: 140 }); if (pc != null) { const tgt = ((pc * 7) % 12) * 30 + 140; let d = ((tgt - V.h + 540) % 360) - 180; V.h = (V.h + d * .08 + 360) % 360; } return V.h;
}
function hslHex(hh, s, l) { s /= 100; l /= 100; const k = n => (n + hh / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); }
/** one cell's outline: hexagon, square, triangle or dot, with softened corners */
function vdCell(g, shape, x, y, r, rr, flip) {
  g.beginPath();
  if (shape === 'dot') { g.arc(x, y, r * .92, 0, Math.PI * 2); return; }
  const n = shape === 'square' ? 4 : shape === 'tri' ? 3 : 6, a0 = shape === 'square' ? Math.PI / 4 : shape === 'tri' ? (flip ? Math.PI / 2 : -Math.PI / 2) : Math.PI / 6, rad = shape === 'square' ? r * 1.12 : shape === 'tri' ? r * 1.1 : r, P = [];
  for (let i = 0; i < n; i++) { const a = a0 + Math.PI * 2 * i / n; P.push([x + rad * Math.cos(a), y + rad * Math.sin(a)]); }
  if (!rr) { P.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](p[0], p[1])); g.closePath(); return; }
  const t = clamp(rr, 0, 1) * .5, mid = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  P.forEach((p, i) => { const pv = P[(i + n - 1) % n], nx = P[(i + 1) % n], s = mid(p, pv), e = mid(p, nx); if (i) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]); g.quadraticCurveTo(p[0], p[1], e[0], e[1]); }); g.closePath();
}
/** Hex Resonance, with its dials. With every dial at its default the original drawHex is used instead, so nothing changes until you move one. */
function drawLattice(g, W, H, fd, bh, lvl, C, pulse, P) {
  const lt = P.lt, shape = vdv('shape'), lay = vdv('layout'), sens = vdv('sens'), mem = vdv('memory'), pg = vdv('pulse'), rr = vdv('round'), gap = vdv('gap'), tri = shape === 'tri', sq = shape === 'square';
  let CA = P.useC ? C.a : P.a, CB = P.useC ? C.b : P.b;
  if (vdv('noteHue')) { const hu = vdHue(); CA = hslHex(hu, 70, lt ? 36 : 58); CB = hslHex(hu + 40, 85, lt ? 44 : 66); }
  const R = Math.max(14, Math.min(W, H) / 15) * vzSize(), dx = sq ? R * 1.8 : tri ? R * 1.05 : R * Math.sqrt(3), dy = sq ? R * 1.8 : tri ? R * 1.82 : R * 1.5;
  const rot = vdv('twist') * Math.PI / 180 + vdv('spin') * VZ.t * .12, spin = rot !== 0, cx = W / 2, cy = H / 2, maxd = Math.hypot(cx, cy), span = spin ? Math.hypot(W, H) : 0, ox = spin ? cx - span / 2 : 0, oy = spin ? cy - span / 2 : 0;
  const cols = Math.ceil((spin ? span : W) / dx) + 2, rows = Math.ceil((spin ? span : H) / dy) + 2;
  if (!VZ.sm || VZ.sm.length !== cols * rows) VZ.sm = new Float32Array(cols * rows); const fmin = 70, fmax = 7000, lr = Math.log(fmax / fmin), now = performance.now();
  const bt = ((now / 1000) % 1.9) / 1.9, key = AN.active && AN.midi != null ? ((Math.round(AN.midi) % 12) + 12) % 12 : -1;
  { const gl = g.createRadialGradient(cx, cy * .92, 0, cx, cy * .92, Math.hypot(W, H) * .55); gl.addColorStop(0, `rgba(${P.glow},${lt ? .12 : .16})`); gl.addColorStop(.5, `rgba(${P.glow},.04)`); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, H); }
  if (spin) { g.save(); g.translate(cx, cy); g.rotate(rot); g.translate(-cx, -cy); }
  const warmRgb = '#' + P.warm.split(',').map(v => (+v).toString(16).padStart(2, '0')).join('');
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const flip = (r + c) % 2, x = ox + c * dx + (tri || sq ? 0 : (r % 2 ? dx / 2 : 0)) - dx / 2, y = oy + r * dy - R / 2 + (tri ? (flip ? dy / 3 : dy * 2 / 3) - dy / 2 : 0);
    const d = Math.hypot(x - cx, y - cy) / maxd, ang = (Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI), i = r * cols + c; let f, own = 0;
    if (lay === 'fifths') { const slot = Math.floor(ang * 12) % 12, pc = (slot * 7) % 12, oct = 3 + Math.floor(clamp(d, 0, .999) * 5), m = 12 * (oct + 1) + pc; f = 440 * Math.pow(2, (m - 69) / 12); own = key === pc ? 1 : 0; }
    else if (lay === 'spiral') { const u = clamp(d, 0, .999) * 5.2, fr = (ang - .25 + 1) % 1, k = Math.max(0, Math.round(u - fr));  /* C is at the top */ f = 65.4 * Math.pow(2, k + fr); own = key >= 0 && (((Math.round(fr * 12) % 12) + 12) % 12) === key ? 1 : 0; }
    else if (lay === 'sweep') f = fmin * Math.exp(lr * clamp((x - ox) / (spin ? span : W), 0, 1));
    else f = fmin * Math.exp(lr * clamp(d * .92 + ((ang * 5) % 1) * .08, 0, 1));
    const k = clamp(Math.round(f / bh), 1, fd.length - 1), v = clamp(lvl(Math.max(fd[k], fd[k + 1] || -120)) * sens, 0, 1.4);
    VZ.sm[i] = Math.max(v, VZ.sm[i] * mem - .004); const s = VZ.sm[i];
    let a, ring = 0;
    if (lay === 'sweep') { const yy = 1 - clamp((y - oy) / (spin ? span : H), 0, 1); a = clamp((s - yy * .95) * 5 + (s > .05 ? .35 : 0), 0, 1) * (s > .03 ? 1 : 0) + .04; }
    else { ring = pulse * pg * Math.max(0, 1 - Math.abs(d - (1 - pulse) * 1.05) * 6); const amb = .2 * Math.pow(Math.max(0, Math.sin(d * 11 - now / 780)), 2) * Math.max(0, 1 - d * .9), idle = .42 * Math.max(0, 1 - Math.abs(d - bt * 1.1) * 7) * Math.max(0, 1 - d * .9);
      a = clamp(s * 1.15 + ring * .8 + amb + idle + own * .5 * Math.max(0, 1 - d * .5), 0, 1); }
    if (a < .03) { g.strokeStyle = `rgba(${P.line},${lt ? .13 : .07})`; g.lineWidth = 1; vdCell(g, shape, x, y, R * .94 * (1 - gap * .4), rr, flip); g.stroke(); continue; }
    const warm = ((c * 7 + r * 13) % 11) === 0, rad = R * (.5 + .46 * Math.min(1, a)) * (1 - gap * .4);
    g.fillStyle = warm ? mixc(CB, warmRgb, .55, a * (lt ? .9 : .8)) : mixc(CA, CB, clamp(s * 1.4 - .15 + ring, 0, 1), a * .92);
    vdCell(g, shape, x, y, rad, rr, flip); g.fill(); g.strokeStyle = `rgba(${P.line},` + (.05 + a * (lt ? .4 : .45)).toFixed(3) + ')'; g.lineWidth = 1; g.stroke();
  }
  if (spin) g.restore();
}

/* ---------- Finish: glow, trails and mirror, on every world ---------- */
const VDX = { tmp: null, sm: null, sm2: null, prev: null };
const vdCv = (k, w, h2) => { let c = VDX[k]; if (!c) c = VDX[k] = document.createElement('canvas'); if (c.width !== w || c.height !== h2) { c.width = w; c.height = h2; } return c; };
/** after a world is drawn (and before the camera goes on top): fold it into a mirror or kaleidoscope, leave trails behind it, and let it glow */
function vdPost(g, W, H, lt, mode) {
  const cp = vsCaps(mode || VZ.mode), mir = cp.mirror ? vdv('mirror') : 1, glow = cp.glow ? vdv('glow') : 0, tr = cp.trails ? vdv('trails') : 0; if (mir === 1 && !glow && !tr) { VDX.prevOk = false; return; }
  const tmp = vdCv('tmp', W, H), t = tmp.getContext('2d'); t.globalCompositeOperation = 'copy'; t.drawImage(g.canvas, 0, 0); t.globalCompositeOperation = 'source-over';
  if (mir === 2) { g.save(); g.beginPath(); g.rect(W / 2, 0, W / 2, H); g.clip(); g.translate(W, 0); g.scale(-1, 1); g.drawImage(tmp, 0, 0); g.restore(); }
  else if (mir > 2) { const N = mir, cx = W / 2, cy = H / 2, Rr = Math.hypot(W, H) / 2 + 4;
    for (let j = 0; j < 2 * N; j++) { g.save(); g.translate(cx, cy); if (j % 2) { g.rotate((j + 1) * Math.PI / N); g.scale(1, -1); } else g.rotate(j * Math.PI / N); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, Rr, 0, Math.PI / N); g.closePath(); g.clip(); g.drawImage(tmp, -cx, -cy); g.restore(); } }
  if (tr > 0 && VDX.prevOk && VDX.prev && VDX.prev.width === W && VDX.prev.height === H) { g.save(); g.globalCompositeOperation = lt ? 'darken' : 'lighten'; g.globalAlpha = clamp(tr, 0, .96); g.drawImage(VDX.prev, 0, 0); g.restore(); }
  if (glow > 0) { const sw = Math.max(16, W >> 3), sh = Math.max(9, H >> 3), s1 = vdCv('sm', sw, sh), q = s1.getContext('2d'); q.imageSmoothingEnabled = true; q.globalCompositeOperation = 'copy'; q.drawImage(g.canvas, 0, 0, sw, sh);
    const s2 = vdCv('sm2', sw >> 1, sh >> 1), q2 = s2.getContext('2d'); q2.imageSmoothingEnabled = true; q2.globalCompositeOperation = 'copy'; q2.drawImage(s1, 0, 0, s2.width, s2.height);
    g.save(); g.imageSmoothingEnabled = true; g.globalCompositeOperation = lt ? 'multiply' : 'lighter'; g.globalAlpha = clamp(glow * .9, 0, 1); g.drawImage(s1, 0, 0, W, H); g.globalAlpha = clamp(glow * .7, 0, 1); g.drawImage(s2, 0, 0, W, H); g.restore(); }
  if (tr > 0) { const pv = vdCv('prev', W, H), p = pv.getContext('2d'); p.globalCompositeOperation = 'copy'; p.drawImage(g.canvas, 0, 0); p.globalCompositeOperation = 'source-over'; VDX.prevOk = true; } else VDX.prevOk = false;
}

/* ---------- Designs: built-in and your own ---------- */
const VD_PRESETS = [
  { id: 'original', name: 'Original hexagons', say: 'The field you know. Everything at its default.', mode: 'hex', vd: {}, speed: 1, size: 1, zoom: 1 },
  { id: 'fifths', name: 'Circle of fifths', say: 'Each spoke is a note, each ring an octave. Your voice lights its own spoke, and the colour follows the note.', mode: 'hex', vd: { layout: 'fifths', noteHue: 1, glow: .3 }, size: 1.3 },
  { id: 'spiralcells', name: 'Spiral of cells', say: 'The hexagon field laid out as a pitch spiral: each turn an octave, each spoke a note.', mode: 'hex', vd: { layout: 'spiral', noteHue: 1, glow: .25 }, size: 1.1 },
  { id: 'wall', name: 'Spectrum wall', say: 'Left to right is low to high pitch; the cells rise like an equaliser.', mode: 'hex', vd: { layout: 'sweep', shape: 'square', gap: .25, round: .3 }, size: .8 },
  { id: 'kaleido', name: 'Kaleidoscope', say: 'The hexagon field folded six ways, slowly turning.', mode: 'hex', vd: { mirror: 6, spin: .5, glow: .35, noteHue: 1 }, size: 1.2 },
  { id: 'helix', name: 'Pitch helix', say: 'The spectrum as a helix of hexagons, tipped and turning slowly.', mode: 'spiral', vd: { glow: .3 }, vo: { spiral: { style: 'cells', tilt: 52, spin: .35 } } },
  { id: 'plate', name: 'Cymatic plate', say: 'A vibrating plate, folded four ways.', mode: 'cymatics', vd: { mirror: 4, trails: .35, glow: .3 } },
  { id: 'sand', name: 'Chladni sand', say: 'Sand on a plate that sings: it settles on the lines where the plate is still.', mode: 'chladni', vd: { glow: .25 }, vo: { chladni: { style: 'both' } } },
  { id: 'wheelglow', name: 'Wheel, glowing', say: 'The circle of fifths as a network, with a soft glow.', mode: 'wheel', vd: { glow: .35 } },
  { id: 'tonnetz', name: 'Tonnetz with a trail', say: 'The chord lattice, leaving a trail as the song moves.', mode: 'tonnetz', vd: { trails: .3, glow: .25 } },
  { id: 'aurora', name: 'Aurora, soft', say: 'Northern light behind you, with a gentle glow.', mode: 'aurora', vd: { glow: .35 } },
  { id: 'trace', name: 'Singing line', say: 'Your voice as a line across the notes of the key, for a take or a video.', mode: 'pitchtrace', vd: {}, vo: { pitchtrace: { window: 10 } } }];

const vdPersonal = () => Array.isArray(CFG.vdPresets) ? CFG.vdPresets : [];
function vdApply(pr) {
  CFG.vd = Object.assign({}, pr.vd || {}); CFG.vo = JSON.parse(JSON.stringify(pr.vo || {})); ['Speed', 'Size', 'Zoom'].forEach(k => { CFG['vz' + k] = pr[k.toLowerCase()] || 1; }); if (pr.tone) { if (pr.tone === 'auto') delete CFG.hexTone; else CFG.hexTone = pr.tone; }
  VZ.sm = null; VZ.spec = null; VDX.prevOk = false; saveCfg(); if (pr.mode && pr.mode !== VZ.mode) vzSetMode(pr.mode, true); if (pr.mode) { CFG.visMode = pr.mode; saveCfg(); } if (typeof hexToneSync === 'function') hexToneSync(); vzLookSync(); vdPaint(); vdMark(); toast('Design: ' + pr.name, 'ok');
}
function vdSave(name) {
  name = (name || '').trim().slice(0, 40); if (!name) return toast('Name the design first', 'warn');
  const list = vdPersonal().filter(p => p.name !== name); list.push({ id: 'u' + Date.now().toString(36), name, mode: VZ.mode, vd: Object.assign({}, CFG.vd || {}), vo: JSON.parse(JSON.stringify(CFG.vo || {})), speed: vzSpeed(), size: vzSize(), zoom: vzZoom(), tone: CFG.hexTone || 'auto' });
  CFG.vdPresets = list.slice(-24); saveCfg(); vdPaint(); toast('Saved “' + name + '”', 'ok');
}
function vdDelete(id) { CFG.vdPresets = vdPersonal().filter(p => p.id !== id); saveCfg(); vdPaint(); }
function vdReset() { CFG.vd = {}; CFG.vo = {}; ['vzSpeed', 'vzSize', 'vzZoom'].forEach(k => { CFG[k] = 1; }); VZ.sm = null; VZ.spec = null; VDX.prevOk = false; saveCfg(); vdPaint(); vdMark(); }

/* ---------- the drawer ---------- */
const VDUI = { tab: 'sound' };
function vdRange(key, label, lo, hi, step, tip, unit, store) {
  const get = () => store ? vzSet(key) : vdv(key), def = store ? 1 : VD_DEF[key], fmt = v => unit === 'x' ? (+v).toFixed(2) + '×' : unit === 'deg' ? Math.round(v) + '°' : unit === '%' ? Math.round(v * 100) + '%' : (+v).toFixed(2);
  const val = h('b', { class: 'mono tiny vd-v' }, fmt(get())), put = v => { if (store) { CFG[key] = v; VZ.spec = null; clearTimeout(vdSaveT); vdSaveT = setTimeout(saveCfg, 300); vdMark(); } else vdSet(key, v); };
  const r = h('input', { type: 'range', min: lo, max: hi, step, value: get(), 'data-vd': key, id: store ? key + 'In' : 'vd_' + key, 'aria-label': label, title: tip, oninput: e => { put(+e.target.value); val.textContent = fmt(+e.target.value); }, ondblclick: e => { put(def); e.target.value = def; val.textContent = fmt(def); } });
  return h('label', { class: 'vd-row', title: tip + ' (double-click to reset)' }, h('span', { class: 'vd-l' }, label), r, val);
}
function vdChoice(key, label, opts, tip) {
  const box = h('div', { class: 'vd-row', title: tip }, h('span', { class: 'vd-l' }, label), h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label }, opts.map(([v, n, t]) => h('button', { type: 'button', role: 'radio', 'data-vd': key, 'data-v': String(v), class: String(vdv(key)) === String(v) ? 'on' : '', 'aria-checked': String(vdv(key)) === String(v), title: t || n,
    onclick: e => { vdSet(key, typeof VD_DEF[key] === 'number' ? +v : v); box.querySelectorAll('button').forEach(b => { const on = b === e.currentTarget; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); } }, n))));
  return box;
}
/** which controls make sense for a look: one that does not is not shown, and is not applied to it (a prompter is not mirrored, a 3D stage is not zoomed) */
const VCAPS = { prompter: { trails: 0, mirror: 0, speed: 0, zoom: 0, source: 0 }, neural: { trails: 0, mirror: 0, speed: 0, zoom: 0, source: 0 }, video: { trails: 0, mirror: 0, source: 0 }, concert: { mirror: 0 }, arena: { mirror: 0, zoom: 0 }, pitchtrace: { mirror: 0, trails: 0, zoom: 0 }, sprint: { glow: 0, trails: 0, mirror: 0, speed: 0, zoom: 0, source: 0 } };
const vsCaps = m => Object.assign({ glow: 1, trails: 1, mirror: 1, speed: 1, zoom: 1, source: 1 }, VCAPS[m] || {});
const vsG = (title, kids) => { kids = kids.filter(Boolean); return kids.length ? h('section', { class: 'vs-g' }, h('h6', {}, title), ...kids) : null; };
/** the settings of the look now showing: only what applies to it, in the order you reach for it */
function vsSections() {
  const m = VZ.mode, caps = vsCaps(m), out = [h('p', { class: 'small vs-what' }, h('b', {}, vzLookName()), ' · ', vzFamOf(m), ' — ', VSAY[m] || '')];
  if (m === 'hex') {
    out.push(vsG('Cells', [vdChoice('shape', 'Lattice', [['hex', '⬢ Hexagon'], ['square', '■ Square'], ['tri', '▲ Triangle'], ['dot', '● Dot']], 'The shape of each cell'), vdRange('vzSize', 'Size', .5, 2.5, .05, 'How big the cells are: bigger means fewer', 'x', true), vdRange('round', 'Roundness', 0, 1, .05, 'Soften the corners', '%'), vdRange('gap', 'Spacing', 0, 1, .05, 'Space between the cells', '%'), vdRange('twist', 'Turn', -90, 90, 1, 'Turn the whole field', 'deg'), vdRange('spin', 'Spin', 0, 3, .05, 'Let the field turn slowly by itself', 'x')]));
    out.push(vsG('How it listens', [vdChoice('layout', 'Layout of pitch', [['rings', 'Rings', 'Space is frequency: low in the middle, high at the edge (the original)'], ['fifths', 'Circle of fifths', 'Each spoke is a note, each ring an octave: your note lights its own spoke'], ['spiral', 'Pitch spiral', 'Each turn is an octave and each spoke a note: the same note is always on the same spoke'], ['sweep', 'Sweep', 'Low to high from left to right, rising like an equaliser']], 'Where pitch lives in the picture'),
      vdRange('sens', 'Sensitivity', .4, 2.5, .05, 'How strongly the cells answer', 'x'), vdRange('memory', 'Memory', .5, .97, .01, 'How long a cell stays lit after the sound: short is crisp, long is smeared'), vdRange('pulse', 'Beat pulse', 0, 2.5, .05, 'How strongly the ring of light follows each beat', 'x'),
      h('label', { class: 'vd-row' }, h('span', { class: 'vd-l' }, 'Colour follows the note'), h('input', { type: 'checkbox', id: 'vd_noteHue', checked: !!vdv('noteHue'), title: 'Hue follows the note you sing or the chord that plays; notes a fifth apart are neighbours in colour', onchange: e => vdSet('noteHue', e.target.checked ? 1 : 0) }))]));
    out.push(vsG('Colour', [hexSwatches()]));
  } else if (VLOOK[m]) out.push(vsG('This look', [vlControls(m)]));
  if (m === 'sprint') out.push(vsG('Soundprint', [prtBar()]));
  out.push(vsG('Frame', [caps.glow ? vdRange('glow', 'Glow', 0, 1, .05, 'A soft bloom around everything bright', '%') : null, caps.trails ? vdRange('trails', 'Trails', 0, .95, .05, 'Let moving light leave a trail', '%') : null,
    caps.mirror ? vdChoice('mirror', 'Mirror', [[1, 'Off'], [2, '↔ Mirror'], [4, '4-fold'], [6, '6-fold'], [8, '8-fold']], 'Fold the picture into a mirror or a kaleidoscope') : null, caps.speed ? vdRange('vzSpeed', 'Speed', .25, 3, .05, 'How fast everything moves', 'x', true) : null, caps.zoom ? vdRange('vzZoom', 'Zoom', 1, 3, .05, 'Push in on the middle', 'x', true) : null]));
  out.push(vsG('Listens to', [caps.source ? h('label', { class: 'vd-row' }, h('span', { class: 'vd-l' }, 'Source'), h('select', { class: 'in', id: 'vd_src', title: 'What the visuals listen to', onchange: e => { VZ.src = e.target.value; } }, [['auto', 'Auto (follows playback)'], ['rig', 'The guitar after the rig'], ['master', 'The master mix'], ['di', 'What the detector hears'], ['vox', 'The vocal microphone']].map(([v, n]) => h('option', { value: v, selected: (VZ.src || 'auto') === v }, n)))) : null]));
  out.push(h('div', { class: 'row vs-foot', style: { gap: '6px' } }, h('button', { class: 'btn sm', type: 'button', id: 'vdReset', onclick: () => vdReset() }, 'Reset all settings'), h('span', { class: 'tiny muted' }, 'Controls that do not apply to a look are not shown.')));
  return out;
}
function vdPaint() { const b = document.getElementById('vdBody'); if (!b) return; b.replaceChildren(...vsSections().filter(Boolean)); if (typeof hexToneSync === 'function') hexToneSync(); if (typeof prtBarSync === 'function') prtBarSync(); }
function vdDrawer() { return h('div', { class: 'vz-design', id: 'vzDesign' }, h('div', { class: 'vd-body', id: 'vdBody' }, vsSections().filter(Boolean))); }
function vzDesignOpen(open) { const bar = document.querySelector('#pane-vis .vz-bar'); if (!bar) return; const on = bar.classList.toggle('design-open', open == null ? undefined : !!open); if (on) vdPaint(); const b = document.getElementById('vzDesignBtn'); if (b) b.setAttribute('aria-expanded', String(on)); vzPanelIntoView(on ? 'vzDesign' : null); }
/** on a phone a panel opens under the (now small) picture: bring it into view */
function vzPanelIntoView(id) { if (!id || document.body.dataset.form !== 'phone') return; setTimeout(() => { const e = document.getElementById(id); if (e && e.offsetParent) e.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 80); }
/** the settings follow the look; Soundprint opens them, so its controls are never hunted for */
function vdOnLook(k) { if (k === 'sprint') vzDesignOpen(true); else if (document.querySelector('#pane-vis .vz-bar.design-open')) vdPaint(); vzStripSync(); }

/* ---------- Saved looks: a menu for switching quickly (a take, a rehearsal, a video) ---------- */
function vzSavedOpen(anchor) {
  const inp = h('input', { class: 'in', id: 'vdName', placeholder: 'Name this look', maxlength: 40, 'aria-label': 'Name this look', onkeydown: e => { if (e.key === 'Enter') { vdSave(e.target.value); closePop(); } } });
  const row = (p, mine) => h('div', { class: 'vd-pre', 'data-pre': p.id }, h('button', { class: 'btn sm', type: 'button', onclick: () => { vdApply(p); closePop(); } }, p.name), h('span', { class: 'tiny muted grow' }, p.say || (VMODES.find(m => m[0] === p.mode) || [0, p.mode])[1]), mine ? h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Delete ' + p.name, title: 'Delete', onclick: e => { vdDelete(p.id); e.currentTarget.closest('.vd-pre').remove(); } }, '✕') : null);
  const mine = vdPersonal();
  popover(anchor, h('div', { class: 'vd-saved', id: 'vdSaved' }, h('h5', {}, 'Saved looks'), mine.length ? h('h6', {}, 'Yours') : null, ...mine.map(p => row(p, true)), h('h6', {}, 'Starting points'), ...VD_PRESETS.map(p => row(p, false)),
    h('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } }, inp, h('button', { class: 'btn sm primary', type: 'button', id: 'vdSave', onclick: () => { vdSave(inp.value); closePop(); } }, 'Save this look'))), { style: { maxWidth: '380px' } });
}
