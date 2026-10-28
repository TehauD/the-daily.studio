/* ============================================================
   Part 56 · SHOW — the brain of Concert's Perform lens
   Everything the lights do has a musical reason, and nothing moves on a timer of its own:
     · ONE CLOCK. While the song plays, every angle, step and pulse is a function of the bar position, and every hit comes from the band
       on the audio clock: kick, snare and hats, the bass note, each guitar strum, each lead note, each beat and bar line. Playing live with
       no song, the lights step on your notes. With nothing playing they only breathe, very slowly.
     · A LOOK is a finished way of lighting: a palette, a rig (where the lights stand and what they are), a backdrop element, a laser kit per
       section, a way of moving. Six ship, and they differ in how the stage is built, not only in colour: a warm theatre wash, floor backlight,
       architectural blades, a pixel field, a horizon, and a laser room. Section names pick the programme (and the setup panel can change any
       cue); repeats escalate (the last chorus is the biggest); patterns change on phrase boundaries, never mid-bar; the same song always gets the same show.
     · A PREVIEW plays a section's cue with a silent synthetic band (kick, snare, hats, bass, strums), so a technician can set the lights without a song.
     · COLOUR is designed, not rainbow: the harmony chooses between the design's own colours (home = the key light, the dominant side
       leans to the second colour, the subdominant side to the third, tension to the accent).
     · COMFORT is a hard limit, not a hope: never more than three flashes a second in any mode. A governor measures the real picture and
       pulls the light back when it gets near the limit. Calm removes the strobe and slows the motion.
   Nothing is loaded from anywhere and nothing leaves the device.
   ============================================================ */

/* ---------- colour ---------- */
const LXC = new Map();
/** '#rrggbb' → [hue 0..360, sat 0..100, light 0..100, chroma 0..100] (cached). Chroma is how coloured it really is: near white or steel it stays small however the lightness is changed. */
function lxHexHsl(hex) {
  let v = LXC.get(hex); if (v) return v; const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '')), n = m ? parseInt(m[1], 16) : 0x808080;
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2; let hh = 0, s = 0;
  if (d > 1e-6) { s = d / (1 - Math.abs(2 * l - 1)); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; }
  v = [hh, s * 100, l * 100, d * 100]; LXC.set(hex, v); return v;
}
const lxHueMix = (a, b, t) => a + (((b - a + 540) % 360) - 180) * t;
const lxCh = c => c[3] != null ? c[3] : c[1] * (1 - Math.abs(2 * c[2] / 100 - 1));
const lxMix3 = (A, B, t) => [lxHueMix(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t), lerp(lxCh(A), lxCh(B), t)];
/** a palette colour as a css colour: alpha, lightness offset, saturation offset */
const lxCl = (c, a, dl, ds) => lxHsl(c[0], c[1] + (ds || 0), c[2] + (dl || 0), a);
/** the same colour at another lightness, keeping how coloured it is (a steel white stays steel white when it is dimmed to a light's mid-tone) */
const lxAt = (c, l, a, k) => lxHsl(c[0], Math.min(100, lxCh(c) * (k == null ? 1 : k) / Math.max(.06, 1 - Math.abs(2 * l / 100 - 1))), l, a);
const lxHash = s => { let x = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
const lxFrac = x => x - Math.floor(x);
const lxSmooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
/** quantised phase: x advances in n steps per unit, each step eased in over its first third (motion that lands on the grid) */
const lxStep = (x, n) => { const f = x * n, i = Math.floor(f), r = f - i; return (i + lxSmooth(r / .34)) / n; };

/* ---------- the patterns the laser engine knows (part 57) and what each section gets by default ---------- */
const SHOW_PATS = ['fan', 'cone', 'zipper', 'sheet', 'grid', 'lissa', 'tunnel', 'burst'];
const SHOW_PAT_NAMES = { fan: 'Fan', cone: 'Cone', zipper: 'Zipper', sheet: 'Curtain', grid: 'Lattice', lissa: 'Scribble', tunnel: 'Tunnel', burst: 'Starburst' };
const LX_KIT = { intro: '', verse: '', pre: 'sheet', chorus: 'fan zipper', bridge: '', solo: 'fan', outro: '', ambient: '' };

/* ---------- the looks ---------- */
/* rig.layout: where the moving lights stand: top (a truss over the stage) · floor (upstage, shining at the audience: contre-jour) · sides (two towers) · wash (broad soft fixtures over the stage) · none.
   rig.wall: the backdrop element: off · spectrum (lit columns) · blades (tall architectural bars) · field (a pixel field) · horizon (a low sun and its rays) · image (your picture as a pixel wall).
   rig.bg: how the room itself is lit: fields (drifting colour) · flat (a quiet gradient) · sky (a sky above a horizon).  rig.beam: soft · hard · wash.  rig.grade: full · duo · mono. */
const SHOW_DESIGNS = [
  { id: 'theatre', name: 'Theatre', tag: 'Warm front light', blurb: 'Tungsten washes and pools of light on the stage, haze with dust in it, no strobe and no lasers. For voice, acoustic guitar and quiet rooms.',
    pal: { base: '#120b07', a: '#ffb866', b: '#ffe2b8', c: '#e8964a', l1: '#fff0d6', l2: '#ffd199' },
    rig: { layout: 'wash', heads: 5, pars: 0, haze: .55, wall: 'off', conf: 0, flash: 0, int: .8, embers: 0, bg: 'flat', field: .3, beam: 'wash', dust: 1, spread: .8 }, mot: { sweep: 8, snap: 0 },
    laser: { amt: 0, intro: '', verse: '', pre: '', chorus: '', bridge: '', solo: '', outro: '' },
    heads: { intro: 'converge', verse: 'spot', pre: 'converge', chorus: 'fan', solo: 'spot', bridge: 'converge', outro: 'converge' } },
  { id: 'backlight', name: 'Backlight', tag: 'Contre-jour beams', blurb: 'Hard beams from the floor behind the band, pointing at the audience through heavy haze. One saturated colour against white, a blinder on the big moments.',
    pal: { base: '#06080e', a: '#ff4b2b', b: '#ffffff', c: '#ffb12b', l1: '#ffffff', l2: '#ff4b2b' },
    rig: { layout: 'floor', heads: 10, pars: 0, haze: 1.1, wall: 'off', conf: 0, flash: .6, int: 1, embers: 0, bg: 'flat', field: .25, beam: 'soft', dust: 0, spread: .62 }, mot: { sweep: 4, snap: 0 },
    laser: { amt: 0, intro: '', verse: '', pre: '', chorus: '', bridge: '', solo: '', outro: '' },
    heads: { intro: 'converge', verse: 'fan', pre: 'chase', chorus: 'fan cross sweep', solo: 'spot converge', bridge: 'converge', outro: 'fan' } },
  { id: 'blades', name: 'Blades', tag: 'Architectural LED', blurb: 'Tall hard-edged bars of light across the stage that rise and fall with the spectrum, in cool white and steel with a single accent. Clean, graphic, precise.',
    pal: { base: '#05070b', a: '#e8f1ff', b: '#8aa4c8', c: '#5b7bb0', l1: '#ffffff', l2: '#7fd4ff' },
    rig: { layout: 'none', heads: 0, pars: 0, haze: .3, wall: 'blades', conf: 0, flash: .4, int: 1, embers: 0, bg: 'flat', field: .12, beam: 'hard', dust: 0, spread: 1 }, mot: { sweep: 2, snap: 1 },
    laser: { amt: .5, intro: '', verse: '', pre: 'zipper', chorus: 'zipper grid', bridge: '', solo: 'grid cone', outro: '' },
    heads: { verse: 'chase', chorus: 'cross chase', solo: 'cross' } },
  { id: 'pixels', name: 'Pixel field', tag: 'Generative LED wall', blurb: 'The whole back of the stage is a pixel field: the spectrum climbs it, every note ripples out from a point, and the kick pulses its centre. Teal, amber and indigo.',
    pal: { base: '#07060f', a: '#2ee6c8', b: '#ffb454', c: '#6a7bff', l1: '#c8fff3', l2: '#ffd9a0' },
    rig: { layout: 'none', heads: 0, pars: 0, haze: .2, wall: 'field', conf: 0, flash: 0, int: 1, embers: 0, bg: 'flat', field: .1, beam: 'soft', dust: 0, spread: 1 }, mot: { sweep: 4, snap: 1 },
    laser: { amt: 0, intro: '', verse: '', pre: '', chorus: '', bridge: '', solo: '', outro: '' },
    heads: {} },
  { id: 'horizon', name: 'Horizon', tag: 'Cinematic sun and rays', blurb: 'A low sun on a long horizon with rays that fan out over the haze. It rises into the chorus and sinks in the outro. Orange, apricot and dusk violet.',
    pal: { base: '#0a1020', a: '#ff9a5a', b: '#ffcf8a', c: '#8a7bff', l1: '#ffe9c4', l2: '#9ad0ff' },
    rig: { layout: 'wash', heads: 4, pars: 1, haze: .9, wall: 'horizon', conf: 0, flash: .15, int: .9, embers: 0, bg: 'sky', field: .25, beam: 'wash', dust: 1, spread: 1 }, mot: { sweep: 8, snap: 0 },
    laser: { amt: .35, intro: '', verse: '', pre: 'sheet', chorus: 'sheet fan', bridge: '', solo: 'sheet', outro: '' },
    heads: { intro: 'converge', verse: 'converge', pre: 'fan', chorus: 'fan sweep', solo: 'spot', bridge: 'converge', outro: 'converge' } },
  { id: 'lasers', name: 'Laser room', tag: 'Haze and beams', blurb: 'A black room with thick haze and nothing but lasers and a few narrow searchlights from the side towers. Green, cyan and white. Every section calls a different kit.',
    pal: { base: '#010403', a: '#35ff9a', b: '#2ee6ff', c: '#ffffff', l1: '#35ff9a', l2: '#2ee6ff' },
    rig: { layout: 'sides', heads: 6, pars: 0, haze: 1.2, wall: 'off', conf: 0, flash: .3, int: .75, embers: 0, bg: 'flat', field: 0, beam: 'hard', dust: 0, spread: 1 }, mot: { sweep: 4, snap: 1 },
    laser: { amt: 1, intro: 'sheet', verse: 'sheet', pre: 'tunnel', chorus: 'fan zipper cone', bridge: 'lissa', solo: 'grid zipper', outro: 'sheet' },
    heads: { intro: 'converge', verse: 'cross', pre: 'cross chase', chorus: 'cross sweep', solo: 'cross chase', bridge: 'converge', outro: 'cross' } }
];
/** the names the 2.5 starter shows had, so a song or a Stage scene that named one still gets a look */
const SHOW_ALIAS = { arena: 'backlight', neon: 'lasers', campfire: 'theatre', aurora: 'horizon', noir: 'blades', golden: 'horizon' };
const lxDesign = id => SHOW_DESIGNS.find(d => d.id === id) || SHOW_DESIGNS.find(d => d.id === SHOW_ALIAS[id]) || SHOW_DESIGNS[0];
CFG.show = Object.assign({ design: 'backlight', auto: true, ovr: {}, imgs: [], saved: [], out: {} }, CFG.show || {});
if (SHOW_ALIAS[CFG.show.design]) CFG.show.design = SHOW_ALIAS[CFG.show.design];
CFG.show.saved = Array.isArray(CFG.show.saved) ? CFG.show.saved : []; CFG.show.out = Object.assign({ master: 1, mirror: false, flip: false, safe: false, fps: 60 }, CFG.show.out || {});
const LX_SECS = ['intro', 'verse', 'pre', 'chorus', 'bridge', 'solo', 'outro'], LX_SEC_NAMES = { intro: 'Intro', verse: 'Verse', pre: 'Pre-chorus', chorus: 'Chorus', bridge: 'Bridge', solo: 'Solo', outro: 'Outro' };
const LX_R1 = { kick: 1, snare: 1, hat: 1, bass: 1, strum: 1, lead: 1 };
/** a palette's colours with the colour treatment applied: full keeps them, duo gives the third light the first light's colour, mono makes every light one colour in different lightness */
function lxGrade(pal, grade) {
  if (!grade || grade === 'full') return pal; const A = lxHexHsl(pal.a), f = (h, s, l) => hsl(h, s, l), o = Object.assign({}, pal);
  if (grade === 'duo') { o.c = pal.a; o.l1 = pal.l1; return o; }
  o.b = f(A[0], Math.min(A[1], 45), Math.min(92, A[2] + 22)); o.c = f(A[0], A[1], Math.max(24, A[2] - 16)); o.l1 = f(A[0], Math.min(A[1], 30), 90); o.l2 = pal.a; return o;
}
/** the cue for a kind of section: the programme (part 54) with this design's changes laid over it */
function lxProg(D, kind) { const P = LX_PROG[kind] || LX_PROG.verse, c = D.cue && D.cue[kind]; return c ? Object.assign({}, P, c) : P; }
/** the look in force for a scene (or the Visuals tab when spec is null), with the person's changes laid over it */
function lxResolve(spec) {
  const sh = CFG.show, vis = !spec || spec === sh || !spec.design, s = vis ? sh : spec, id = vis && sh.auto !== false ? lxAutoDesign() : (s.design || sh.design), base = lxDesign(id), o = s.ovr || {}, ol = o.laser || {}, kits = {};
  Object.keys(ol).forEach(k => { if (typeof ol[k] === 'string') kits[k] = ol[k]; });
  const rig = Object.assign({}, base.rig, o.rig), D = Object.assign({}, base, { pal: lxGrade(Object.assign({}, base.pal, o.pal), rig.grade), rig, mot: Object.assign({}, base.mot, o.mot), laser: Object.assign({}, base.laser, kits, ol.amt != null ? { amt: ol.amt } : null), heads: Object.assign({}, base.heads, o.heads) });
  D.allow = ol.allow || null; D.noBurst = ol.burst === 0 || ol.burst === false; D.use = o.use || null; D.cue = o.cue || null; D.resp = o.resp || null; D.spec = s; return D;
}

/** the colours the stage's chord / lyric overlay uses, taken from the show design so the text belongs to the picture */
function lxHudPal(sc) { const D = lxResolve(sc && sc.show); return { a: D.pal.a, b: D.pal.l2, c: D.pal.b, d: D.pal.c }; }

/* ---------- comfort ---------- */
const lxReduced = () => { try { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
const LX_COMFORT = {
  calm: { name: 'Calm', blurb: 'No strobe. Slower, softer movement and gentler pulses. The choice if flashing or fast motion bothers you.', strobe: 0, flash: .05, impulse: .45, motion: .55, laser: .7, gap: 1000 },
  standard: { name: 'Standard', blurb: 'Soft pulses on the beat and a gentle flash at the top of a chorus.', strobe: .2, flash: .2, impulse: .8, motion: .85, laser: 1, gap: 340 },
  full: { name: 'Full show', blurb: 'The whole production, at full strength. Still never more than three flashes a second.', strobe: .42, flash: .45, impulse: 1, motion: 1, laser: 1, gap: 340 }
};
function lxComfortKey() { const c = STG.comfort; return LX_COMFORT[c] ? c : STG.safe === false ? 'full' : lxReduced() ? 'calm' : 'standard'; }
const lxComfort = () => LX_COMFORT[lxComfortKey()];
function lxSetComfort(k) { if (!LX_COMFORT[k]) return; STG.comfort = k; STG.safe = k !== 'full'; saveStg(); }

/** the governor: looks at the picture itself (a 24×14 sample, 25 times a second), counts how often the brightness swings by 7% or more
    (whole picture and each quarter, and the amount of red), and when that gets near three a second it pulls every pulse and flash back.
    Three flashes a second is the line the web accessibility guidelines draw for photosensitive viewers. */
const LXG = { c: null, x: null, t: 0, s: [], tgt: 1, n: 0, maxN: 0, lum: 0, lut: null };
function lxGovMeasure(cv, now) {
  const G = LXG; if (now - G.t < 40 || !cv || !cv.width || !cv.height) return; G.t = now;
  if (!G.x) { G.c = document.createElement('canvas'); G.c.width = 24; G.c.height = 14; G.x = G.c.getContext('2d', { willReadFrequently: true }); G.lut = new Float32Array(256); for (let i = 0; i < 256; i++) { const v = i / 255; G.lut[i] = v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); } for (let i = 0; i < 6; i++) G.s.push({ ref: 0, dir: 0, ts: [], init: false }); }
  let d; try { G.x.drawImage(cv, 0, 0, 24, 14); d = G.x.getImageData(0, 0, 24, 14).data; } catch (e) { return; }
  const q = [0, 0, 0, 0, 0], lut = G.lut; let red = 0;
  for (let y = 0; y < 14; y++) for (let x = 0; x < 24; x++) {
    const o = (y * 24 + x) * 4, r = lut[d[o]], g = lut[d[o + 1]], b = lut[d[o + 2]], Y = .2126 * r + .7152 * g + .0722 * b; q[0] += Y; q[1 + (y >= 7 ? 2 : 0) + (x >= 12 ? 1 : 0)] += Y;
    const sum = r + g + b; if (sum > .01 && r / sum >= .8) red += Math.max(0, r - g - b);
  }
  const v = [q[0] / 336, q[1] / 84, q[2] / 84, q[3] / 84, q[4] / 84, red / 336]; G.lum = v[0]; let n = 0;
  for (let i = 0; i < 6; i++) {
    const s = G.s[i], x = v[i], thr = i === 5 ? .1 : .07; if (!s.init) { s.ref = x; s.init = true; }
    if (s.dir === 0) { if (Math.abs(x - s.ref) >= thr) { s.dir = x > s.ref ? 1 : -1; s.ref = x; } }
    else if (s.dir === 1) { if (x >= s.ref) s.ref = x; else if (s.ref - x >= thr) { s.dir = -1; s.ref = x; s.ts.push(now); } }
    else { if (x <= s.ref) s.ref = x; else if (x - s.ref >= thr) { s.dir = 1; s.ref = x; s.ts.push(now); } }
    while (s.ts.length && now - s.ts[0] > 1000) s.ts.shift(); n = Math.max(n, s.ts.length);
  }
  G.n = n; if (n > G.maxN) G.maxN = n; G.tgt = n <= 2 ? 1 : clamp(1 - (n - 2) * .3, .1, 1);
}

/* ---------- events from the band, on the audio clock (called from part 03) ---------- */
Object.assign(LX, {
  bass: 0, bassM: 40, strum: 0, lead: 0, leadM: 64, beatP: 0, down: 0, mode: 'idle', pos: 0, lastPos: 0, phAcc: 0, noteN: 0, onsetAt: 0, gov: 1, occ: 0, occTot: 1, occSec: -1, occN: -1, seed: 1,
  D: null, palD: null, key: [38, 70, 55, 63], ft: null, slowT: 0, fastT: 0, lite: 0, laserKit: [], laserAmt: 0, lastStrobeBar: -1, fb: null, burst: 0, wallImgK: ''
});
function lxEvt(type, t, a, b) { LX.q.push({ t, type, a, b }); if (LX.q.length > 400) LX.q.splice(0, LX.q.length - 400); }
function lxFireX(ev) {
  const v = clamp(ev.b == null ? .8 : ev.b, .2, 1), R = LX.R || LX_R1;
  if (ev.type === 'beat') { LX.beatP = 1; if (ev.a === 1) LX.down = 1; }
  else if (ev.type === 'bass') { LX.bass = Math.max(LX.bass, (.45 + .55 * v) * R.bass); LX.bassM = ev.a; }
  else if (ev.type === 'chord') { LX.strum = Math.max(LX.strum, (.5 + .5 * v) * R.strum); if (R.strum > .2) lxSpark(2 + Math.round(v * 3), 0); }
  else if (ev.type === 'lead') { LX.lead = Math.min(1, R.lead); LX.leadM = ev.a; if (R.lead > .2) lxSpark(2, 1); }
}
bus.on('onset', () => { LX.noteN++; LX.onsetAt = performance.now(); });

/* ---------- the per-frame brain ---------- */
function lxUpdate(dt, X) {
  dt = clamp(dt || .016, .001, .1); const now = performance.now(), ctx = E.ctx, ct = ctx ? ctx.currentTime : 0, lat = ctx ? (ctx.outputLatency || ctx.baseLatency || 0) : 0, k = x => Math.exp(-dt * x), CM = lxComfort();
  const D = LX.D || (LX.D = lxResolve(null)); LX.R = D.resp ? Object.assign({}, LX_R1, D.resp) : LX_R1;
  /* a slow machine gets a lighter picture (no laser halos, fewer moving lights) instead of a slideshow; it comes back by itself once frames are quick again */
  LX.ft = LX.ft == null ? dt : LX.ft + (dt - LX.ft) * Math.min(1, dt * .8); if (document.hidden) { LX.slowT = 0; } else if (LX.ft > .045) LX.slowT += dt; else LX.slowT = Math.max(0, LX.slowT - dt * 2);
  if (!LX.lite && LX.slowT > 2.5) { LX.lite = 1; LX.fastT = 0; } else if (LX.lite) { LX.fastT = LX.ft < .026 ? LX.fastT + dt : 0; if (LX.fastT > 8) { LX.lite = 0; LX.slowT = 0; } }
  for (let i = 0; i < LX.q.length;) { const ev = LX.q[i]; if (ev.t <= ct - lat + .016) { lxFire(ev); LX.q.splice(i, 1); } else if (ev.t < ct - 2) LX.q.splice(i, 1); else i++; }
  if (PB.seq !== LX.pbSeq) { LX.pbSeq = PB.seq; LX.note = 1; }
  ['kick', 'snare', 'perc', 'tom'].forEach(n => { LX[n] *= k(n === 'snare' ? 9 : n === 'kick' ? 7 : 6); }); LX.hat *= k(14); LX.onset *= k(8); LX.note *= k(5); LX.strobe *= k(22); LX.drop *= k(1.5);
  LX.bass *= k(5); LX.strum *= k(9); LX.lead *= k(4); LX.beatP *= k(6); LX.down *= k(3); LX.burst = Math.max(0, LX.burst - dt / Math.max(.8, spb() * slotDur()));
  /* the governor eases: fast down, slow up */
  const G = LXG; LX.gov += (G.tgt - LX.gov) * (1 - k(G.tgt < LX.gov ? 14 : 1.1));
  const info = LX.info = stageInfo(), bars = barsCache(), playing = !!(T.playing && ctx), sp = spb(), slotNow = playing ? playheadSlot() : T.cursor;
  if (playing && LX.pv) LX.pv = null; else if (LX.pv && now > LX.pv.until) LX.pv = null;
  const sim = !playing && !!LX.pv, loud = AN.active ? clamp((AN.rms + 60) / 50, 0, 1) : 0; LX.mode = playing || sim ? 'song' : (AN.active && (now - LX.onsetAt < 5000 || loud > .25)) ? 'live' : 'idle';
  /* one position, in bars: the playhead, or (in a preview) the silent band's clock, or one eighth of a bar per note you play, or a barely perceptible drift */
  if (playing) LX.pos = Math.max(0, slotNow / sp); else if (sim) { LX.pos += dt * (S.bpm / 60) / S.ts[0]; lxPreviewBand(); } else if (LX.mode === 'live') LX.pos += (LX.noteN / 8 - LX.pos) * (1 - k(7)); else LX.pos += dt * .006;
  const dp = LX.pos - LX.lastPos; LX.lastPos = LX.pos; if (dp > 0 && dp < .5) LX.phAcc += dp; LX.ph = LX.phAcc * 2.2 * CM.motion;
  LX.beat = LX.pos * S.ts[0]; LX.bar = LX.pos - Math.floor(LX.pos);
  /* where we are in the song */
  const bi = clamp(Math.floor(slotNow / sp), 0, Math.max(0, bars.length - 1)), fb = bars.length ? bars[bi] : null; LX.fb = fb;
  const kind = sim ? LX.pv.kind : playing && fb ? lxKind(fb.sec.name) : 'ambient'; LX.kind = kind; const secId = sim ? 'pv' + LX.pv.n + kind : playing && fb ? (fb.sec.id || fb.sec.name) : '';
  if ((playing || sim) && secId !== LX.sec) { const first = LX.sec === ''; LX.sec = secId; if (sim || !first || playheadSlot() > 1) { const P0 = lxProg(D, kind); LX.drop = Math.max(LX.drop, kind === 'chorus' ? 1 : kind === 'solo' ? .8 : .35); if (P0.conf && LX.W && D.rig.conf > 0) lxBurst(Math.round((kind === 'chorus' ? 150 : 60) * D.rig.conf)); if (P0.strobe) LX.strobeReq = true; if (kind === 'chorus' || kind === 'solo') LX.burst = 1; lxSlide(); } } else if (!playing && !sim) LX.sec = '';
  const barsLeft = playing && fb ? fb.sec.bars.length - fb.bi - 1 : 9, nxt = playing && fb && bars[bi + barsLeft + 1] ? lxKind(bars[bi + barsLeft + 1].sec.name) : '', bt = (playing && barsLeft <= 1 && /chorus|solo/.test(nxt) && !/chorus|solo/.test(kind)) ? 1 - barsLeft * .45 : 0; LX.build += (bt - LX.build) * (1 - k(2.5));
  if (sim) { LX.occ = LX.pv.final ? 1 : 0; LX.occTot = 2; LX.occSec = -1; LX.seed = lxHash('pv' + kind); }
  else if (playing && fb) { if (LX.occSec !== fb.si || LX.occN !== S.sections.length) { LX.occSec = fb.si; LX.occN = S.sections.length; let n = 0, tot = 0; S.sections.forEach((s, j) => { if (lxKind(s.name) === kind) { if (j < fb.si) n++; tot++; } }); LX.occ = n; LX.occTot = Math.max(1, tot); LX.seed = lxHash((S.title || '') + '|' + fb.si); } } else { LX.occ = 0; LX.occTot = 1; LX.occSec = -1; }
  const P = LX.prog = lxProg(D, kind), ph4 = fb ? Math.floor(fb.bi / 4) : sim ? Math.floor(LX.pos / 4) : 0, finalCh = kind === 'chorus' && LX.occTot > 1 && LX.occ === LX.occTot - 1, idx = fb ? fb.idx : sim ? Math.floor(LX.pos) : 0; LX.barIdx = idx;
  /* the cue: which head pattern, which lasers, how big, for this section on this pass */
  const pats = D.heads && D.heads[kind] ? D.heads[kind].split(' ') : P.pats; LX.pat = pats[(ph4 + LX.occ + (LX.seed & 3)) % pats.length];
  let kit = String(D.laser && D.laser[kind] != null ? D.laser[kind] : (LX_KIT[kind] || '')).split(/\s+/).filter(Boolean);
  if (D.allow) { const own = new Set(SHOW_PATS.filter(p => Object.keys(D.laser).some(kk => kk !== 'amt' && String(D.laser[kk]).split(/\s+/).includes(p)))); kit = kit.filter(p => D.allow.includes(p)); if (/^(pre|chorus|solo)$/.test(kind)) D.allow.forEach(p => { if (!own.has(p) && p !== 'burst' && !kit.includes(p)) kit.push(p); }); }
  if (kit.length >= 3 && ph4 % 2 === 1) kit = kit.filter((_, i) => i !== (ph4 + LX.occ) % kit.length);   // the second phrase of a section drops one, so the combination keeps changing
  LX.laserKit = kit; LX.laserAmt = (D.laser && D.laser.amt || 0) * CM.laser * (1 + (finalCh ? .15 : 0)); LX.finalCh = finalCh;
  const intT = clamp((P.int + Math.min(LX.occ, 2) * .06 + (finalCh ? .06 : 0) + .3 * LX.build) * (D.rig.int == null ? 1 : D.rig.int), 0, 1.15), nT = Math.min(12, P.n * (D.rig.heads || 12) / 12) + 3 * LX.build * (D.rig.heads || 12) / 12;
  LX.int += (intT - LX.int) * (1 - k(1.8)); LX.n += (nT - LX.n) * (1 - k(1.4));
  /* harmony picks between the design's own colours */
  const sym = sim ? lxPreviewChord() : playing ? info.sym : (AN.active && AN.chord && AN.chord[0] ? AN.chord[0].sym : null); if (sym) { if (sym !== LX.sym && !sim) lxSkyAdd(sym); LX.sym = sym; LX.symT = now; } else if (now - LX.symT > 4000) LX.sym = null;
  const pc = LX.sym ? parseChord(LX.sym) : null, ql = lxQual(pc), fs = pc ? lxFifths(pc.root) : 0, PD = LX.palD = { base: lxHexHsl(D.pal.base), a: lxHexHsl(D.pal.a), b: lxHexHsl(D.pal.b), c: lxHexHsl(D.pal.c), l1: lxHexHsl(D.pal.l1), l2: lxHexHsl(D.pal.l2) };
  const side = clamp(fs / 3, -1, 1), tk = side >= 0 ? lxMix3(PD.a, PD.b, side) : lxMix3(PD.a, PD.c, -side), kt = lxMix3(tk, PD.c, ql.ten * .3), kk = 1 - k(3.2);
  LX.key = [lxHueMix(LX.key[0], kt[0], kk), lerp(LX.key[1], kt[1], kk), lerp(LX.key[2], kt[2], kk), lerp(lxCh(LX.key), lxCh(kt), kk)];
  const tv = clamp((S.minor ? -.45 : .45) + ql.val, -1, 1), tt = clamp(ql.ten * .62 + Math.min(Math.abs(fs), 6) / 6 * .38, 0, 1); LX.v += (tv - LX.v) * (1 - k(1.1)); LX.tn += (tt - LX.tn) * (1 - k(1.6)); LX.hue = LX.key[0];
  const src = sim ? .8 : playing ? clamp(X.energy * 1.7, 0, 1) : Math.max(loud, clamp(X.energy * 1.4, 0, 1)), et = clamp(.6 * src + .4 * LX.int + .18 * LX.kick, 0, 1) * (LX.mode === 'idle' ? .55 : 1);
  LX.e += (et - LX.e) * (1 - k(et > LX.e ? 6 : 1.1)); const bt2 = AN.active && AN.centroid > 0 ? clamp(Math.log(AN.centroid / 300) / Math.log(5000 / 300), 0, 1) : .4; LX.br += (bt2 - LX.br) * (1 - k(1.2));
  const e = LX.e, mood = (LX.v + 1) / 2; LX.pal = { key: LX.key, a: PD.a, b: PD.b, c: PD.c, base: PD.base, l1: PD.l1, l2: PD.l2, h: [LX.key[0], PD.b[0], PD.c[0], PD.l1[0]], sat: 62 + 30 * e, lit: 50 + 10 * LX.br, mood };
  /* flashes: at most one blinder per bar, never closer together than the comfort gap, none at all in Calm */
  const flashOk = D.rig.flash > 0 && CM.strobe > 0 && now - LX.lastStrobe > CM.gap;
  if (LX.strobeReq) { LX.strobeReq = false; if (P.strobe && flashOk && LX.lastStrobeBar !== idx) { LX.strobe = 1; LX.lastStrobe = now; LX.lastStrobeBar = idx; } }
  if (LX.drop > .6 && LX.strobe < .5 && flashOk && LX.lastStrobeBar !== idx) { LX.strobe = .9; LX.lastStrobe = now; LX.lastStrobeBar = idx; }
  for (let i = LX.parts.length - 1; i >= 0; i--) { const p = LX.parts[i]; p.life -= dt; if (p.life <= 0) { LX.parts.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= k(.4); }
  if (D.rig.embers && LX.parts.length < 90 && LX.mode !== 'idle' && LX.strum > .5 && Math.random() < .5) lxSpark(1, 2);
  LX.fb = fb;
}
/** a few sparks; kind 0 = bright glints (strum), 1 = lead-note glints, 2 = embers that drift up */
function lxSpark(n, kind) {
  const W = LX.W, H = LX.H, pal = LX.pal; if (!pal || !W || LX.parts.length > 260) return;
  for (let i = 0; i < n; i++) {
    const c = [pal.key, pal.a, pal.b, pal.c][(Math.random() * 4) | 0], ember = kind === 2, x = ember ? W * (.2 + Math.random() * .6) : W * (.1 + Math.random() * .8), y = ember ? H * (.82 + Math.random() * .15) : H * (.25 + Math.random() * .5);
    LX.parts.push({ x, y, vx: (Math.random() - .5) * (ember ? 14 : 22), vy: ember ? -(H * .05 + Math.random() * H * .08) : -(Math.random() * 14), g: ember ? -H * .004 : 0, life: ember ? 2.6 + Math.random() * 3 : .5 + Math.random() * .7, max: ember ? 5 : 1.1, s: ember ? .9 + Math.random() * 1.4 : .8 + Math.random() * 1.6, c3: c, c: false });
  }
}
/** confetti, in the design's colours */
function lxBurst(n) {
  const W = LX.W, H = LX.H, pal = LX.pal; if (!pal) return; for (let i = 0; i < n && LX.parts.length < 420; i++) {
    const a = -Math.PI / 2 + (Math.random() - .5) * 2.1, sp = H * (.5 + Math.random() * .9), c = [pal.key, pal.a, pal.b, pal.c, pal.l1][(Math.random() * 5) | 0];
    LX.parts.push({ x: W * (.15 + Math.random() * .7), y: H * (.95 + Math.random() * .06), vx: Math.cos(a) * sp * .6, vy: Math.sin(a) * sp, g: H * .8, life: 2.2 + Math.random() * 2, max: 4, s: 2 + Math.random() * 4, c3: c, c: true, rot: Math.random() * 6 });
  }
}
/** the images, if any, move on to the next one at each new section */
function lxSlide() { LX.slide = (LX.slide || 0) + 1; }

/* ---------- preview: a silent band that plays one section's cue, so the lights can be set without a song ---------- */
const LX_PVB = { intro: [1, 0, 0, 0, 1], verse: [1, 1, 0, 1, 1], pre: [1, 1, 1, 1, 1], chorus: [1, 1, 1, 1, 1], bridge: [1, 0, 0, 1, 0], solo: [1, 1, 1, 1, 1], outro: [1, 0, 0, 0, 0] };   // kick, snare, hats, bass, strum
function lxPreview(kind, o) { LX.pv = { kind: LX_SECS.includes(kind) ? kind : 'chorus', until: performance.now() + ((o && o.sec) || 30) * 1000, n: (LX.pv ? LX.pv.n : (LX.pvN || 0)) + 1, final: !!(o && o.final) }; LX.pvN = LX.pv.n; LX.pvB = -1; LX.pos = Math.max(0, Math.floor(LX.pos / 4) * 4); bus.emit('show'); }
function lxPreviewStop() { LX.pv = null; bus.emit('show'); }
/** the chord of the bar being previewed: the usual four in the song's key */
function lxPreviewChord() { const bar = Math.floor(LX.pos) % 4, deg = S.minor ? [0, 8, 3, 10] : [0, 7, 9, 5], q = S.minor ? ['m', '', '', ''] : ['', '', 'm', '']; return pcName((S.key + deg[bar]) % 12) + q[bar]; }
/** the synthetic hits on each new eighth of a bar */
function lxPreviewBand() {
  const pv = LX.pv, ts = S.ts[0], eighth = Math.floor(LX.pos * ts * 2); if (eighth === LX.pvB) return; const from = LX.pvB < 0 ? eighth : LX.pvB + 1; LX.pvB = eighth;
  const m = LX_PVB[pv.kind] || LX_PVB.verse;
  for (let e = from; e <= eighth; e++) {
    const pos = ((e % (ts * 2)) + ts * 2) % (ts * 2), beat = pos / 2, on = pos % 2 === 0;
    if (on) { LX.beatP = 1; if (pos === 0) LX.down = 1; }
    if (on && m[0] && (beat === 0 || (ts === 4 && beat === 2))) lxFire({ row: 0, v: 3 });
    if (on && m[1] && (ts === 4 ? beat === 1 || beat === 3 : beat === 1)) lxFire({ row: 1, v: 3 });
    if (m[2] && (on || pv.kind === 'chorus' || pv.kind === 'solo')) lxFire({ row: 2, v: on ? 3 : 1 });
    if (m[3] && on && (beat === 0 || beat === 2)) lxFireX({ type: 'bass', a: 36 + S.key, b: .85 });
    if (m[4] && on && beat === 0) lxFireX({ type: 'chord', b: .9 });
    if ((pv.kind === 'chorus' || pv.kind === 'solo') && e % 3 === 0) lxFireX({ type: 'lead', a: 62 + ((e >> 1) * 5) % 12, b: .8 });
  }
}
