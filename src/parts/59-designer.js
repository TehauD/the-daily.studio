/* ============================================================
   Part 59 · SHOW SETUP — the console a stage or AV technician sets a show up with
   It lives in the Stage tab, under the picture it changes (beside it on a wide pane), so every change is seen as it is made:
     Looks (six built differently, your own saved looks, show files) · Rig (where the lights stand, the room, the backdrop, lasers, motion) ·
     Colour · Cues (each kind of section: how big, how many lights, which patterns, which lasers, with a silent band to rehearse it) ·
     Response (how strongly the kick, snare, hats, bass, strums and lead notes drive the lights, with live meters) · Pictures ·
     Output (master, blackout, freeze, mirror, flip, guides, test patterns, frame rate, light comfort, the flash meter) · Scene · MIDI.
   It edits the look of the Stage scene you are on, or the Visuals tab's look. Your changes are kept as differences from the look you started
   from (CFG.show.ovr, or a scene's show.ovr), so "Reset" always has somewhere to go back to.
   PICTURES: reduced here (longest edge 1920 px, JPEG unless it needs transparency) and stored as blobs in this browser's own database
   ('the-daily-songs', key stage/img/<id>). Nothing is uploaded or sent anywhere; they are not part of a song's .zip.
   ============================================================ */
const SHIMG = { map: new Map(), busy: new Set() }, SH_MAXIMGS = 24, SH_EDGE = 1920, SH_MAXFILE = 14e6, SH_MAXKB = 160000;
CFG.show.imgs = Array.isArray(CFG.show.imgs) ? CFG.show.imgs : [];

/* ---------- pictures: a stored picture as something canvas can draw, or null while it loads (the show asks every frame and never waits) ---------- */
function shImg(id) {
  if (SHIMG.map.has(id)) return SHIMG.map.get(id);
  if (!SHIMG.busy.has(id)) { SHIMG.busy.add(id); shLoad(id).then(c => { SHIMG.map.set(id, c || null); SHIMG.busy.delete(id); bus.emit('shimg', id); }).catch(() => { SHIMG.busy.delete(id); }); }
  return null;
}
async function shLoad(id) { if (!PRJ.db) return null; const blob = await pdbGet('blobs', 'stage/img/' + id); return blob ? await createImageBitmap(blob) : null; }
const shHasAlpha = cv => { try { const t = document.createElement('canvas'); t.width = t.height = 40; const q = t.getContext('2d', { willReadFrequently: true }); q.drawImage(cv, 0, 0, 40, 40); const d = q.getImageData(0, 0, 40, 40).data; for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true; } catch (e) { } return false; };
async function shAdd(files) {
  if (!PRJ.db) return toast('This browser is not keeping files for this site (a private window, or storage turned off), so pictures cannot be stored.', 'warn');
  const list = [...files].filter(f => /^image\//.test(f.type) && !/svg/.test(f.type)); if (!list.length) return toast('Choose pictures: JPEG, PNG, WebP or GIF.', 'warn');
  let n = 0;
  for (const f of list) {
    if (CFG.show.imgs.length >= SH_MAXIMGS) { toast('Up to ' + SH_MAXIMGS + ' pictures. Remove one to add another.', 'warn'); break; }
    if (f.size > SH_MAXFILE) { toast('“' + f.name + '” is over 14 MB. Pick a smaller one.', 'warn'); continue; }
    if (CFG.show.imgs.reduce((a, i) => a + (i.kb || 0), 0) > SH_MAXKB) { toast('That is a lot of pictures already. Remove some first.', 'warn'); break; }
    try {
      const bmp = await createImageBitmap(f), k = Math.min(1, SH_EDGE / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k)), hh = Math.max(1, Math.round(bmp.height * k)), cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
      cv.getContext('2d').drawImage(bmp, 0, 0, w, hh); if (bmp.close) bmp.close();
      const png = /png|webp|gif/.test(f.type) && shHasAlpha(cv), blob = await new Promise(r => cv.toBlob(r, png ? 'image/png' : 'image/jpeg', .88)); if (!blob) throw new Error('encode');
      const id = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); await pdbPut('blobs', blob, 'stage/img/' + id);
      CFG.show.imgs.push({ id, name: f.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Picture', w, h: hh, kb: Math.round(blob.size / 1024), alpha: png }); n++;
    } catch (e) { toast('“' + f.name + '” could not be read as a picture.', 'warn'); }
  }
  if (n) { saveCfg(); bus.emit('show'); toast(n + (n === 1 ? ' picture' : ' pictures') + ' added. They stay on this device.', 'ok'); }
}
function shUseOf(spec) { const o = spec.ovr || (spec.ovr = {}); return o.use || (o.use = { back: [], wall: [], logo: null }); }
async function shRemove(id) {
  CFG.show.imgs = CFG.show.imgs.filter(i => i.id !== id); SHIMG.map.delete(id); try { await pdbDel('blobs', 'stage/img/' + id); } catch (e) { }
  [CFG.show].concat(STG.scenes.map(s => s.show).filter(Boolean)).forEach(sp => { const u = sp.ovr && sp.ovr.use; if (!u) return; u.back = (u.back || []).filter(x => x !== id); u.wall = (u.wall || []).filter(x => x !== id); if (u.logo === id) u.logo = null; if (!u.wall.length && sp.ovr.rig && sp.ovr.rig.wall === 'image') sp.ovr.rig.wall = 'spectrum'; });
  saveCfg(); saveStg(); bus.emit('show');
}
/** drop pictures whose file is gone (for example after a reset that cleared the songs database) */
async function shPrune() { try { if (!PRJ.db || !CFG.show.imgs.length) return; const keys = new Set(await pdbKeys('blobs', 'stage/img/')); const gone = CFG.show.imgs.filter(i => !keys.has('stage/img/' + i.id)); for (const i of gone) await shRemove(i.id); } catch (e) { } }

/* ---------- which look a song wants, when nobody has chosen ---------- */
function lxAutoDesign() {
  const b = S.band || {}, bpm = S.bpm || 100, kit = b.kit || '', pat = b.patName || '', cs = b.compStyle || '';
  if (S.show && (SHOW_DESIGNS.some(d => d.id === S.show) || SHOW_ALIAS[S.show])) return lxDesign(S.show).id;
  const soft = !b.drumsOn || kit === 'Brush (soft)' || pat === 'Ballad Half-Time' || bpm < 80;
  if (soft) return (S.minor && bpm < 84) || /Arpeggio|Pad/.test(cs) ? 'horizon' : 'theatre';
  if (kit === '808' || pat === 'Four on the Floor' || (S.minor && bpm >= 118 && kit !== 'Rock Room')) return 'lasers';
  if (/Funk|Boom Bap/.test(pat) || cs === 'Funk Chuck') return 'blades';
  if (kit === 'Rock Room' || /Chug|Metal/.test(cs + pat)) return 'backlight';
  if (pat === 'Folk Backbeat' || /Folk/.test(cs)) return 'theatre';
  return S.minor ? 'pixels' : 'horizon';
}

/* ---------- a poster for each look, painted from how it is built (where its lights stand, what is behind the band), not only from its colours ---------- */
function shPoster(cv, d) {
  const w = cv.width = 320, hh = cv.height = 180, g = cv.getContext('2d'), P = d.pal, R = d.rig, c = k => lxHexHsl(P[k]), B = c('base'), L = R.layout || 'top', hz = hh * .62, rnd = i => lxFrac(Math.sin(i * 127.1 + 311.7) * 43758.5453);
  const bg = g.createLinearGradient(0, 0, 0, hh);
  if (R.bg === 'sky') { const gl = c('a'); bg.addColorStop(0, lxHsl(B[0], B[1], Math.max(2, B[2] * .6), 1)); bg.addColorStop(.4, lxHsl(B[0], B[1], B[2] + 5, 1)); bg.addColorStop(.62, lxHsl(gl[0], gl[1] * .8, 30, 1)); bg.addColorStop(.621, lxHsl(B[0], B[1], B[2] * .7 + 1, 1)); bg.addColorStop(1, lxHsl(B[0], B[1], Math.max(2, B[2] * .45), 1)); }
  else { bg.addColorStop(0, lxHsl(B[0], B[1], Math.max(1.5, B[2] * .55), 1)); bg.addColorStop(1, lxHsl(B[0], B[1], B[2] * 1.4 + 3, 1)); }
  g.fillStyle = bg; g.fillRect(0, 0, w, hh); g.globalCompositeOperation = 'lighter';
  const fa = R.field == null ? 1 : R.field;
  if (fa > .02) [['a', .25, .55], ['b', .8, .42], ['c', .5, .9]].forEach(([k, x, y]) => { const col = c(k), gr = g.createRadialGradient(w * x, hh * y, 0, w * x, hh * y, w * .5); gr.addColorStop(0, lxAt(col, 48, .42 * fa)); gr.addColorStop(1, lxAt(col, 48, 0)); g.fillStyle = gr; g.fillRect(0, 0, w, hh); });
  if (R.wall === 'blades') { const n = 15, x0 = w * .1, cw = w * .8 / n; for (let i = 0; i < n; i++) { const v = .3 + .62 * Math.abs(Math.sin(i * 1.9 + 1)); g.fillStyle = lxAt(i % 5 === 2 ? c('l2') : c('a'), 76, .8); g.fillRect(x0 + i * cw + 1.5, hh * .92 - v * hh * .8, cw - 3, v * hh * .8); } }
  else if (R.wall === 'field') { const nx = 26, ny = 12, x0 = w * .06, cw = w * .88 / nx, ch = hh * .78 / ny; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const v = .5 + .5 * Math.sin(i * .7 + j * .5 + 1.3 * Math.sin(j * .9)), col = lxMix3(c('a'), lxMix3(c('b'), c('c'), i / nx), j / ny); g.fillStyle = lxAt(col, 30 + v * 36, .16 + .7 * v * v); g.beginPath(); g.arc(x0 + (i + .5) * cw, hh * .1 + (j + .5) * ch, Math.min(cw, ch) * (.2 + .22 * v), 0, 7); g.fill(); } }
  else if (R.wall === 'horizon') {
    const sx = w * .5, r = hh * .15;
    for (let i = 0; i < 17; i++) { const a = -Math.PI * (.04 + .92 * i / 16), len = hh * (1.1 + .5 * rnd(i)), gr = g.createLinearGradient(sx, hz, sx + Math.cos(a) * len, hz + Math.sin(a) * len); gr.addColorStop(0, lxAt(c('b'), 70, .3)); gr.addColorStop(1, lxAt(c('b'), 60, 0)); g.fillStyle = gr; g.beginPath(); g.moveTo(sx, hz); g.lineTo(sx + Math.cos(a - .025) * len, hz + Math.sin(a - .025) * len); g.lineTo(sx + Math.cos(a + .025) * len, hz + Math.sin(a + .025) * len); g.closePath(); g.fill(); }
    g.save(); g.beginPath(); g.rect(0, 0, w, hz); g.clip(); const sg = g.createRadialGradient(sx, hz, 0, sx, hz, r * 1.6); sg.addColorStop(0, lxAt(c('l1'), 92, 1)); sg.addColorStop(.45, lxAt(c('b'), 72, .9)); sg.addColorStop(1, lxAt(c('a'), 55, 0)); g.fillStyle = sg; g.fillRect(sx - r * 2, hz - r * 2, r * 4, r * 2); g.restore();
  } else if (R.wall === 'spectrum') { const n = 18, x0 = w * .2, cw = w * .6 / n; for (let i = 0; i < n; i++) { const rows = Math.round((.25 + .6 * Math.abs(Math.sin(i * 1.7 + 2))) * 8), col = lxMix3(c('a'), c('b'), i / n); for (let r = 0; r < rows; r++) { g.fillStyle = lxAt(col, 52 + r * 2, .55); g.fillRect(x0 + i * cw + 1, hh * .62 - r * 6, cw - 2, 4.5); } } }
  const beam = (ox, oy, tx, ty, wd, col, a) => { const gr = g.createLinearGradient(ox, oy, tx, ty), dx = tx - ox, dy = ty - oy, len = Math.hypot(dx, dy) || 1, nx = -dy / len * wd, ny = dx / len * wd; gr.addColorStop(0, lxAt(col, 68, a)); gr.addColorStop(1, lxAt(col, 55, 0)); g.fillStyle = gr; g.beginPath(); g.moveTo(ox - nx * .08, oy - ny * .08); g.lineTo(tx + nx, ty + ny); g.lineTo(tx - nx, ty - ny); g.lineTo(ox + nx * .08, oy + ny * .08); g.closePath(); g.fill(); };
  const nb = Math.min(R.heads || 0, 10), sp = R.spread == null ? 1 : R.spread, bw = R.beam === 'hard' ? .03 : R.beam === 'wash' ? .17 : .06, ba = R.beam === 'hard' ? .6 : R.beam === 'wash' ? .2 : .42;
  for (let i = 0; i < nb && L !== 'none'; i++) {
    const t = nb > 1 ? i / (nb - 1) : .5, col = c(i % 3 === 2 ? 'c' : i % 2 ? 'b' : 'a');
    if (L === 'floor') beam(w * (.08 + .84 * t), hh * 1.03, w * (.5 + (t - .5) * 1.6 * sp), -hh * .2, hh * bw, col, ba);
    else if (L === 'sides') { const j = i >> 1, left = i % 2 === 0; beam(left ? 0 : w, hh * (.3 + .1 * j), left ? w * (.9 - .12 * j) : w * (.1 + .12 * j), hh * (.02 + .15 * j), hh * bw, col, ba); }
    else beam(w * (.1 + .8 * t), -2, w * (.5 + (t - .5) * (L === 'wash' ? .7 : .9) * sp), hh * 1.05, hh * bw, col, ba);
  }
  if (R.pars) for (let i = 0; i < 5; i++) { const x = w * (.14 + .18 * i), gr = g.createRadialGradient(x, hh * .98, 0, x, hh * .98, w * .16); gr.addColorStop(0, lxAt(c(i % 2 ? 'b' : 'a'), 55, .4)); gr.addColorStop(1, lxAt(c('a'), 55, 0)); g.fillStyle = gr; g.fillRect(x - w * .17, hh * .6, w * .34, hh * .45); }
  const la = d.laser.amt || 0; if (la > 0) { const n = Math.round(4 + la * 12); g.lineWidth = 1; for (let i = 0; i < n; i++) { const left = i % 2 === 0; g.strokeStyle = lxAt(c(i % 3 ? 'l1' : 'l2'), 66, .5 + .4 * la); g.beginPath(); g.moveTo(left ? 0 : w, hh * (.04 + .1 * (i % 3))); g.lineTo(left ? w * (.35 + .65 * rnd(i + 9)) : w * (.65 - .65 * rnd(i + 9)), hh * (.5 + .6 * rnd(i + 5))); g.stroke(); } }
  if (R.dust) for (let i = 0; i < 40; i++) { g.fillStyle = lxAt(c('l1'), 80, .22); g.beginPath(); g.arc(w * rnd(i), hh * rnd(i + 50), .7 + rnd(i + 90) * 1.1, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'source-over'; const vg = g.createRadialGradient(w / 2, hh / 2, hh * .3, w / 2, hh / 2, w * .62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = vg; g.fillRect(0, 0, w, hh);
}

/* ---------- the options the console offers (every one of them is a value the show engine already understands) ---------- */
const SH_LAYOUTS = [['top', 'Truss', 'A truss of moving lights over the stage'], ['floor', 'Floor', 'Lights upstage on the floor, shining at the audience (contre-jour)'], ['sides', 'Towers', 'Two towers, one on each side of the stage'], ['wash', 'Wash', 'Broad soft fixtures over the stage'], ['none', 'None', 'No moving lights: the backdrop and the lasers carry the show']];
const SH_BEAMS = [['soft', 'Soft'], ['hard', 'Hard'], ['wash', 'Wash']], SH_GRADES = [['full', 'Full colour', 'All the colours of the look'], ['duo', 'Two colours', 'The third light takes the first light’s colour'], ['mono', 'One colour', 'Every light is the first colour, in different lightness']];
const SH_WALLS = [['off', 'Nothing'], ['spectrum', 'Spectrum (lit columns)'], ['blades', 'Blades (tall bars)'], ['field', 'Pixel field'], ['horizon', 'Horizon and sun'], ['image', 'Your picture, as a pixel wall']];
const SH_HEADS = [['converge', 'Converge'], ['fan', 'Fan'], ['sweep', 'Sweep'], ['cross', 'Cross'], ['chase', 'Chase'], ['spot', 'Spot']];
const SH_RESP = [['kick', 'Kick', 'Floor lights, the room’s glow, the lasers’ pulse'], ['snare', 'Snare', 'The blinder, side sparks, the backdrop’s flashes'], ['hat', 'Hi-hat', 'The chase running across the lights'], ['bass', 'Bass note', 'The floor lights nearest the note'], ['strum', 'Guitar strum', 'Glints and colour on the wall'], ['lead', 'Lead note', 'A bright point that follows the melody']];
const SH_TESTS = [['', 'Off'], ['bars', 'Bars'], ['grid', 'Grid'], ['ramp', 'Ramp'], ['grey', 'Grey'], ['white', 'White'], ['black', 'Black']];

/* ---------- reading and writing a look's changes ---------- */
const SHC = { tab: 'looks', target: 'scene', kind: 'chorus', final: false, root: null, head: null, tabsEl: null, body: null };
const SHC_TABS = [['looks', 'Looks'], ['rig', 'Rig'], ['col', 'Colour'], ['cues', 'Cues'], ['resp', 'Response'], ['pics', 'Pictures'], ['out', 'Output'], ['scene', 'Scene'], ['midi', 'MIDI']];
/** the spec being edited, created on first change (a scene that follows the Visuals tab gets a look of its own the moment you change it) */
function shcSpec() {
  if (SHC.target === 'scene') { const sc = scn(); if (!sc.show) sc.show = { design: lxResolve(null).id, ovr: {} }; if (!sc.show.design) sc.show.design = lxResolve(null).id; if (!sc.show.ovr) sc.show.ovr = {}; return sc.show; }
  if (!CFG.show.ovr) CFG.show.ovr = {}; return CFG.show;
}
const shcSave = () => { if (SHC.target === 'scene') saveStg(); else saveCfg(); bus.emit('show'); };
function shcSet(group, key, v) { const o = shcSpec().ovr, g = o[group] || (o[group] = {}); if (v === undefined) delete g[key]; else g[key] = v; if (!Object.keys(g).length) delete o[group]; shcSave(); }
function shcCueSet(kind, key, v) { const o = shcSpec().ovr, cu = o.cue || (o.cue = {}), g = cu[kind] || (cu[kind] = {}); if (v === undefined) delete g[key]; else g[key] = v; if (!Object.keys(g).length) delete cu[kind]; if (!Object.keys(cu).length) delete o.cue; shcSave(); }
function shcPick(id) { GD.pf.look = 1; const spec = shcSpec(), u = spec.ovr && spec.ovr.use; spec.design = id; spec.ovr = u ? { use: u } : {}; if (SHC.target !== 'scene') CFG.show.auto = false; shcSave(); shcDraw(); }

/* ---------- saved looks, and look files you can carry to another device ---------- */
/** a look from a file or from storage, with only values the engine understands (numbers clamped, colours checked, names from the lists) */
function shClean(l) {
  if (!l || typeof l !== 'object') return null;
  const design = SHOW_DESIGNS.some(x => x.id === l.design) ? l.design : SHOW_ALIAS[l.design]; if (!design) return null;
  const num = (v, a, b) => typeof v === 'number' && isFinite(v) ? clamp(v, a, b) : null, hex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null, pick = (v, list) => list.includes(v) ? v : null, toks = (v, list) => typeof v === 'string' ? v.split(/\s+/).filter(x => list.includes(x)).join(' ') : null;
  const o = l.ovr && typeof l.ovr === 'object' ? l.ovr : {}, out = {}, put = (grp, key, v) => { if (v != null) (out[grp] || (out[grp] = {}))[key] = v; };
  const RN = { heads: [0, 12], pars: [0, 1], haze: [0, 1.2], conf: [0, 1.5], flash: [0, 1], int: [.3, 1.15], embers: [0, 1], field: [0, 1], dust: [0, 1], spread: [.3, 1.2] };
  ['base', 'a', 'b', 'c', 'l1', 'l2'].forEach(k => put('pal', k, o.pal && hex(o.pal[k])));
  Object.keys(RN).forEach(k => put('rig', k, o.rig && num(o.rig[k], RN[k][0], RN[k][1])));
  put('rig', 'layout', o.rig && pick(o.rig.layout, SH_LAYOUTS.map(x => x[0]))); put('rig', 'wall', o.rig && pick(o.rig.wall, SH_WALLS.map(x => x[0]).filter(x => x !== 'image')));
  put('rig', 'bg', o.rig && pick(o.rig.bg, ['flat', 'sky'])); put('rig', 'beam', o.rig && pick(o.rig.beam, SH_BEAMS.map(x => x[0]))); put('rig', 'grade', o.rig && pick(o.rig.grade, SH_GRADES.map(x => x[0])));
  put('mot', 'sweep', o.mot && pick(o.mot.sweep, [2, 4, 8])); put('mot', 'snap', o.mot && num(o.mot.snap, 0, 1));
  put('laser', 'amt', o.laser && num(o.laser.amt, 0, 1)); put('laser', 'burst', o.laser && num(o.laser.burst, 0, 1)); LX_SECS.forEach(k => { put('laser', k, o.laser && toks(o.laser[k], SHOW_PATS)); put('heads', k, o.heads && toks(o.heads[k], SH_HEADS.map(x => x[0]))); });
  const CN = { int: [0, 1.15], n: [0, 12], haze: [0, 1.2], wall: [0, 1], pars: [0, 1], conf: [0, 1], strobe: [0, 1] };
  LX_SECS.forEach(k => Object.keys(CN).forEach(f => { const v = o.cue && o.cue[k] && num(o.cue[k][f], CN[f][0], CN[f][1]); if (v != null) { const cu = out.cue || (out.cue = {}); (cu[k] || (cu[k] = {}))[f] = v; } }));
  Object.keys(LX_R1).forEach(k => put('resp', k, o.resp && num(o.resp[k], 0, 1.5)));
  return { id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: String(l.name || SHOW_DESIGNS.find(x => x.id === design).name).replace(/[\u0000-\u001f<>]/g, '').slice(0, 40) || 'Look', design, ovr: out };
}
function shSaveLook(name) {
  if (CFG.show.saved.length >= 24) return toast('Up to 24 saved looks. Delete one to save another.', 'warn');
  const spec = shcSpec(), D = lxResolve(SHC.target === 'scene' ? spec : null), o = JSON.parse(JSON.stringify(spec.ovr || {})); delete o.use;
  const l = shClean({ name: String(name || '').trim() || D.name + ' (mine)', design: D.id, ovr: o }); CFG.show.saved.push(l); saveCfg(); toast('Saved “' + l.name + '”.', 'ok'); shcDraw();
}
function shUseLook(id) { GD.pf.look = 1;
  const l = CFG.show.saved.find(x => x.id === id); if (!l) return; const spec = shcSpec(), u = spec.ovr && spec.ovr.use, o = JSON.parse(JSON.stringify(l.ovr || {})); if (u) o.use = u;
  spec.design = lxDesign(l.design).id; spec.ovr = o; if (SHC.target !== 'scene') CFG.show.auto = false; shcSave(); shcDraw();
}
function shDelLook(id) { CFG.show.saved = CFG.show.saved.filter(x => x.id !== id); saveCfg(); shcDraw(); }
function shExportLooks(ids) { const looks = CFG.show.saved.filter(l => !ids || ids.includes(l.id)).map(l => ({ name: l.name, design: l.design, ovr: l.ovr })); download('the-daily-studio-looks.json', JSON.stringify({ app: BRAND.name, kind: 'show-looks', v: 1, looks }, null, 1), 'application/json'); }
async function shImportLooks(file) {
  try {
    if (!file || file.size > 2e6) throw new Error('size'); const j = JSON.parse(await file.text()), arr = Array.isArray(j.looks) ? j.looks : j && j.design ? [j] : []; let n = 0;
    arr.slice(0, 24).forEach(l => { const c = shClean(l); if (c && CFG.show.saved.length < 24) { CFG.show.saved.push(c); n++; } }); if (!n) throw new Error('empty');
    saveCfg(); toast(n + (n === 1 ? ' look' : ' looks') + ' added.', 'ok'); shcDraw();
  } catch (e) { toast('That is not a look file from this app.', 'warn'); }
}

/* ---------- output: master, blackout, freeze, mirror, flip, test patterns (called from the Stage's frame, part 13) ---------- */
function shBlackout(on) { SG.boOn = on == null ? !SG.boOn : !!on; if (SG.boOn) GD.pf.bo = 1; if (SHC.root && SHC.tab === 'out') shcDraw(); }
function shFreeze(on) { const to = on == null ? !(SG.freeze || SG.freezeReq) : !!on; if (to) { if (!SG.freeze) SG.freezeReq = true; } else { SG.freeze = false; SG.freezeReq = false; SG.frz = null; } if (SHC.root && SHC.tab === 'out') shcDraw(); }
function shTestPattern(g, w, hh, k) {
  g.save(); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.shadowBlur = 0;
  if (k === 'bars') { const cols = ['#ffffff', '#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff', '#000000']; cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(Math.round(i * w / 8), 0, Math.ceil(w / 8), hh * .8); }); const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#000'); gr.addColorStop(1, '#fff'); g.fillStyle = gr; g.fillRect(0, hh * .8, w, hh * .2); }
  else if (k === 'grid') { g.fillStyle = '#000'; g.fillRect(0, 0, w, hh); g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, hh / 540); const n = 16; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * w / n, 0); g.lineTo(i * w / n, hh); g.stroke(); } for (let j = 0; j <= 9; j++) { g.beginPath(); g.moveTo(0, j * hh / 9); g.lineTo(w, j * hh / 9); g.stroke(); } g.beginPath(); g.arc(w / 2, hh / 2, hh * .45, 0, 7); g.stroke(); g.beginPath(); g.moveTo(0, 0); g.lineTo(w, hh); g.moveTo(w, 0); g.lineTo(0, hh); g.stroke(); g.strokeRect(w * .05, hh * .05, w * .9, hh * .9); }
  else if (k === 'ramp') { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#000'); gr.addColorStop(1, '#fff'); g.fillStyle = gr; g.fillRect(0, 0, w, hh); }
  else g.fillStyle = k === 'white' ? '#fff' : k === 'grey' ? '#808080' : '#000', g.fillRect(0, 0, w, hh);
  if (k === 'bars' || k === 'grid') { g.fillStyle = k === 'grid' ? '#000' : '#fff'; g.fillRect(w / 2 - hh * .17, hh / 2 - hh * .035, hh * .34, hh * .07); g.fillStyle = k === 'grid' ? '#fff' : '#000'; g.font = '700 ' + Math.round(hh * .04) + 'px ui-monospace,monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(w + ' × ' + hh, w / 2, hh / 2); }
  g.restore();
}
/** master level, blackout (eased over a quarter of a second) and the mirror and flip, applied to the finished picture */
function shOutFrame(g, w, hh) {
  const O = CFG.show.out, now = performance.now(), dt = clamp((now - (SG.boT0 || now)) / 1000, 0, .1); SG.boT0 = now; SG.bo = clamp((SG.bo || 0) + (SG.boOn ? 1 : -1) * dt * 4, 0, 1);
  const m = clamp(O.master == null ? 1 : O.master, 0, 1) * (1 - SG.bo);
  if (m < .998) { g.save(); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1 - m; g.fillStyle = '#000'; g.fillRect(0, 0, w, hh); g.restore(); }
  if (O.mirror || O.flip) { const t = SG.mir || (SG.mir = document.createElement('canvas')); if (t.width !== w || t.height !== hh) { t.width = w; t.height = hh; } t.getContext('2d').drawImage(SG.cv, 0, 0); g.save(); g.setTransform(O.mirror ? -1 : 1, 0, 0, O.flip ? -1 : 1, O.mirror ? w : 0, O.flip ? hh : 0); g.drawImage(t, 0, 0); g.restore(); }
}

/* ---------- the console ---------- */
function shOpen(target, tab) { SHC.target = target === 'vis' ? 'vis' : 'scene'; if (tab) SHC.tab = tab; dockGo('stage'); if (SHC.root) { shcDraw(); try { SHC.root.scrollIntoView({ block: 'nearest' }); } catch (e) { } } }
function shcRoot() {
  if (!SHC.root) {
    SHC.tabsEl = h('div', { class: 'shc-tabs', role: 'tablist', 'aria-label': 'Show setup' }, SHC_TABS.map(([k, n]) => h('button', { class: 'shc-tab', role: 'tab', 'data-t': k, onclick: () => { SHC.tab = k; shcDraw(); }, onkeydown: e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const i = SHC_TABS.findIndex(t => t[0] === SHC.tab), j = (i + (e.key === 'ArrowRight' ? 1 : SHC_TABS.length - 1)) % SHC_TABS.length; SHC.tab = SHC_TABS[j][0]; shcDraw(); const b = SHC.tabsEl.querySelector('[data-t="' + SHC.tab + '"]'); if (b) b.focus(); } } }, n)));
    SHC.head = h('div', { class: 'shc-head' }); SHC.body = h('div', { class: 'shc-body lk sg', role: 'tabpanel' });
    SHC.root = h('div', { class: 'shc', id: 'shc' }, h('h4', { class: 'shc-title' }, 'Show setup'), SHC.head, SHC.tabsEl, SHC.body);
  }
  shcDraw(); return SHC.root;
}
function shcHead() {
  const el = SHC.head, sc = scn(); if (!el) return; el.innerHTML = '';
  el.append(h('div', { class: 'seg', role: 'group', 'aria-label': 'What the setup changes' }, [['scene', 'Scene ' + (STG.cur + 1) + ' · ' + sc.name], ['vis', 'Visuals tab']].map(([k, n]) => h('button', { class: SHC.target === k ? 'on' : '', 'aria-pressed': String(SHC.target === k), title: k === 'scene' ? 'Change the look of the scene on the screen above' : 'Change the look the Visuals tab uses (and the Stage scenes that follow it)', onclick: () => { SHC.target = k; shcDraw(); } }, n))),
    h('span', { class: 'shc-flash mono tiny', id: 'shcFl', title: 'Flashes per second, measured on the finished picture. The limit is three.' }), h('span', { style: { flex: 1 } }),
    h('button', { class: 'btn sm', id: 'sgdPlay', onclick: () => { if (T.playing) stopPlay(true); else play(); setTimeout(shcHead, 90); } }, T.playing ? '■ Stop' : '▶ Play song'));
}
function shcCtx() {
  const scene = SHC.target === 'scene', sc = scn(), follows = scene && !(sc.show && sc.show.design), D = lxResolve(scene ? sc.show : null), ov = (scene ? (sc.show && sc.show.ovr) : CFG.show.ovr) || {};
  const sec = t => h('div', { class: 'lk-sec' }, t), note = (t, cls) => h('div', { class: 'lk-note' + (cls ? ' ' + cls : '') }, t), pct = x => Math.round(x * 100) + '%';
  const slider = (label, val, min, max, step, fmt, on, tip) => { const v = h('span', { class: 'mono tiny' }, fmt(val)); return h('label', { class: 'sg-sl', title: tip || '' }, h('span', {}, label), h('div', { class: 'row', style: { gap: '6px' } }, h('input', { type: 'range', min, max, step, value: val, style: { flex: 1 }, oninput: e => { const x = +e.target.value; v.textContent = fmt(x); on(x); } }), v)); };
  const chk = (label, on, fn, tip) => h('label', { class: 'chk small', title: tip || '', style: { display: 'flex', gap: '5px', alignItems: 'center', fontWeight: 700 } }, h('input', { type: 'checkbox', checked: on, onchange: e => fn(e.target.checked) }), label);
  const seg = (opts, cur, fn, label) => h('div', { class: 'seg lk-seg shc-seg', role: 'group', 'aria-label': label || '' }, opts.map(([k, n, tip]) => h('button', { class: String(k) === String(cur) ? 'on' : '', 'aria-pressed': String(String(k) === String(cur)), title: tip || '', onclick: () => fn(k) }, n)));
  const sel = (label, opts, cur, fn) => h('label', { class: 'sg-sl' }, h('span', {}, label), h('select', { class: 'in', onchange: e => fn(e.target.value) }, opts.map(([k, n, dis]) => h('option', { value: k, selected: String(k) === String(cur), disabled: !!dis }, n))));
  return { scene, sc, follows, D, ov, sec, note, pct, slider, chk, seg, sel };
}
const SHC_TAB = { looks: c => shcLooks(c), rig: c => shcRig(c), col: c => shcColour(c), cues: c => shcCues(c), resp: c => shcResp(c), pics: c => shcPics(c), out: c => shcOut(c), scene: c => shcScene(c), midi: c => shcMidi(c) };
function shcDraw() {
  if (!SHC.body) return; const pane = SHC.root.closest ? SHC.root.closest('.pane') : null, st = pane ? pane.scrollTop : 0;
  SHC.tabsEl.querySelectorAll('.shc-tab').forEach(b => { const on = b.dataset.t === SHC.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
  shcHead(); const c = shcCtx(); SHC.body.innerHTML = ''; SHC.body.append(...(SHC_TAB[SHC.tab] || SHC_TAB.looks)(c).filter(Boolean)); if (pane) pane.scrollTop = st; shcMeters();
}
/** the live readouts: flashes per second, the governor, and the six band sources */
function shcMeters() {
  const r = SHC.root; if (!r || !r.isConnected) return; const fl = r.querySelector('#shcFl'), n = LXG.n | 0;
  if (fl) { fl.textContent = n + (n === 1 ? ' flash' : ' flashes') + '/s · limit 3 · governor ' + Math.round(LX.gov * 100) + '%'; fl.classList.toggle('warn', n >= 3 || LX.gov < .8); }
  r.querySelectorAll('[data-meter]').forEach(m => { const k = m.dataset.meter, v = k === 'flash' ? n / 3 : k === 'gov' ? LX.gov : LX[k] || 0; m.firstChild.style.width = Math.round(clamp(v, 0, 1) * 100) + '%'; m.classList.toggle('hot', k === 'flash' && n >= 3); });
  const pk = r.querySelector('#shcPeak'); if (pk) pk.textContent = LXG.maxN + ' per second';
}
setInterval(() => { const r = SHC.root; if (!r || document.hidden || !r.isConnected || !r.offsetParent) return; shcMeters(); }, 160);

/* ---------- Looks ---------- */
function shcLooks(c) {
  const { D, scene, sc, follows, note, sec } = c, out = [];
  if (scene && sc.mode !== 'concert') out.push(h('div', { class: 'lk-note shc-warn' }, 'Scene “' + sc.name + '” is not a Concert scene, so no show is drawn there. ', h('button', { class: 'btn sm', onclick: () => { sc.mode = 'concert'; VZ.spec = null; saveStg(); shcDraw(); } }, 'Make it a Concert scene')));
  if (!scene) out.push(c.chk('Match the look to the song (feel, tempo, band)', CFG.show.auto !== false, v => { CFG.show.auto = v; saveCfg(); shcDraw(); }), (CFG.show.auto !== false ? note('Now matched to this song: ' + D.name + '.') : null));
  if (scene && follows) out.push(note('This scene follows the Visuals tab’s look. Choosing or changing a look here gives it one of its own.'));
  else if (scene) out.push(h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, note('This scene has its own look.'), h('button', { class: 'btn sm', onclick: () => { delete sc.show; saveStg(); shcDraw(); } }, 'Follow the Visuals tab instead')));
  if (!scene && scn().show && scn().show.design) out.push(note('The scene on the screen has its own look, so changes to the Visuals tab’s look show on the Visuals tab, not here.'));
  out.push(sec('LOOKS'), note('Six finished looks, built differently: where the lights stand, what is behind the band, how it all moves. Pick one, then change anything.'),
    h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, h('button', { class: 'btn sm', disabled: !!T.playing, title: T.playing ? 'Stop the song to rehearse with the silent band' : 'The look at chorus strength, with a silent band', onclick: () => { lxPreview('chorus', { sec: 60 }); } }, '▶ Preview a chorus'), h('button', { class: 'btn sm', onclick: () => lxPreviewStop() }, '■ Stop preview')),
    h('div', { class: 'sg-cards' }, SHOW_DESIGNS.map(d => {
      const cv = h('canvas', { width: 320, height: 180, 'aria-hidden': 'true' }); shPoster(cv, d); const on = d.id === D.id;
      return h('div', { class: 'sg-card' + (on ? ' on' : ''), role: 'group', 'aria-label': d.name }, h('button', { class: 'sg-pick', title: 'Use ' + d.name + ' (keeps your pictures, clears other changes)', onclick: () => shcPick(d.id) }, cv), h('b', {}, d.name), h('span', { class: 't' }, d.tag.toUpperCase()), h('p', {}, d.blurb),
        h('div', { class: 'sg-row' }, h('button', { class: 'btn sm' + (on ? ' on' : ''), onclick: () => shcPick(d.id) }, on ? '✓ In use' : 'Use')));
    })));
  const nm = h('input', { class: 'in', placeholder: 'Name this look…', maxlength: 40, 'aria-label': 'Name for the saved look', style: { fontFamily: 'var(--sans)' } }), pick = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, onchange: async e => { const f = e.target.files[0]; e.target.value = ''; await shImportLooks(f); } });
  out.push(sec('YOUR LOOKS'), note('Save the look as it is now, with all your changes (not your pictures), then bring it back on any scene, or carry it to another device as a file.'),
    h('div', { class: 'row', style: { gap: '6px' } }, nm, h('button', { class: 'btn sm', id: 'shSaveLook', onclick: () => shSaveLook(nm.value) }, 'Save look')),
    CFG.show.saved.length ? h('div', { class: 'shc-saved' }, CFG.show.saved.map(l => h('div', { class: 'shc-sv' }, h('b', { title: l.name }, l.name), h('span', { class: 'tiny muted' }, lxDesign(l.design).name), h('span', { style: { flex: 1 } }),
      h('button', { class: 'btn sm', onclick: () => shUseLook(l.id) }, 'Use'), h('button', { class: 'btn sm', title: 'Save this look as a file', onclick: () => shExportLooks([l.id]) }, '⤓'), h('button', { class: 'btn sm', title: 'Delete this saved look', 'aria-label': 'Delete ' + l.name, onclick: () => shDelLook(l.id) }, '✕')))) : note('Nothing saved yet.'),
    h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, h('button', { class: 'btn sm', onclick: () => pick.click() }, '⤒ Open a looks file'), CFG.show.saved.length ? h('button', { class: 'btn sm', onclick: () => shExportLooks() }, '⤓ Save all as a file') : null, pick));
  out.push(h('div', { class: 'lk-foot' }, h('button', { class: 'btn', title: 'Back to the look as it started (your pictures stay)', onclick: () => { const spec = shcSpec(), u = spec.ovr && spec.ovr.use; spec.ovr = u ? { use: u } : {}; shcSave(); shcDraw(); } }, 'Reset all changes'),
    scene ? h('button', { class: 'btn', title: 'Give every other Concert scene this look, with its changes', onclick: () => { const src = shcSpec(), copy = JSON.parse(JSON.stringify({ design: src.design, ovr: src.ovr || {} })); let n = 0; STG.scenes.forEach(s => { if (s !== sc && s.mode === 'concert') { s.show = JSON.parse(JSON.stringify(copy)); n++; } }); saveStg(); toast('Look copied to ' + n + ' other Concert ' + (n === 1 ? 'scene' : 'scenes') + '.', 'ok'); } }, 'Copy to all Concert scenes') : null));
  return out;
}

/* ---------- Rig ---------- */
function shcRig(c) {
  const { D, ov, sec, note, slider, chk, seg, sel, pct } = c, R = D.rig, set = (k, v) => shcSet('rig', k, v), lay = SH_LAYOUTS.find(x => x[0] === (R.layout || 'top')) || SH_LAYOUTS[0], hasWall = !!((D.use && D.use.wall) || []).length;
  return [
    sec('MOVING LIGHTS'), note('Where the lights stand decides what the show looks like.'),
    seg(SH_LAYOUTS, R.layout || 'top', k => { set('layout', k); if (k !== 'none' && !(R.heads > 0)) set('heads', 6); shcDraw(); }, 'Where the moving lights stand'), note(lay[2]),
    slider('How many', R.heads == null ? 12 : R.heads, 0, 12, 1, String, x => set('heads', x), 'The number of moving lights'),
    seg(SH_BEAMS, R.beam || (R.layout === 'wash' ? 'wash' : 'soft'), k => { set('beam', k); shcDraw(); }, 'Beam style'),
    slider('Spread', R.spread == null ? 1 : R.spread, .3, 1.2, .02, pct, x => set('spread', x), 'How wide the fan of beams opens'),
    chk('Floor lights', R.pars !== 0, v => set('pars', v ? 1 : 0), 'The soft pools of light along the floor'),
    sec('ROOM'), seg([['flat', 'Quiet'], ['sky', 'Sky and horizon']], R.bg === 'sky' ? 'sky' : 'flat', k => { set('bg', k); shcDraw(); }, 'How the room is lit'),
    slider('Drifting colour fields', R.field == null ? 1 : R.field, 0, 1, .05, x => x ? pct(x) : 'off', x => set('field', x)),
    slider('Haze', R.haze == null ? 1 : R.haze, 0, 1.2, .05, pct, x => set('haze', x)),
    h('div', { class: 'row', style: { gap: '14px', flexWrap: 'wrap' } }, chk('Dust in the light', !!R.dust, v => set('dust', v ? 1 : 0)), chk('Drifting embers', !!R.embers, v => set('embers', v ? 1 : 0))),
    sec('BACKDROP'), sel('Behind the band', SH_WALLS.map(([k, n]) => [k, n, k === 'image' && !hasWall]), R.wall || 'spectrum', v => { set('wall', v); shcDraw(); }), hasWall ? null : note('“Your picture” appears here once you give a picture the Wall role on the Pictures tab.'),
    sec('LASERS'), note('Lasers are drawn on the screen and follow the band: brighter on the kick, snare and strums, every angle locked to the bar. Which patterns play in which section is set on the Cues tab.'),
    slider('Amount', D.laser.amt == null ? 0 : D.laser.amt, 0, 1, .05, x => x ? pct(x) : 'off', x => shcSet('laser', 'amt', x)),
    chk('Starburst on the drop', !D.noBurst, v => { shcSet('laser', 'burst', v ? undefined : 0); }),
    sec('BRIGHTNESS AND PUNCH'),
    slider('Overall brightness', R.int == null ? 1 : R.int, .4, 1.15, .05, pct, x => set('int', x)),
    slider('Blinder on big moments', R.flash == null ? .5 : R.flash, 0, 1, .05, x => x ? pct(x) : 'off', x => set('flash', x), 'Never more than three flashes a second, and none at all in Calm'),
    slider('Confetti on the chorus', R.conf == null ? 1 : R.conf, 0, 1.5, .05, x => x ? pct(x) : 'off', x => set('conf', x)),
    sec('MOTION'), sel('How long one sweep takes', [[2, 'Two bars (lively)'], [4, 'Four bars'], [8, 'Eight bars (slow)']], D.mot.sweep || 4, v => shcSet('mot', 'sweep', +v)),
    chk('Move in steps that land on the beat', !!D.mot.snap, v => shcSet('mot', 'snap', v ? 1 : 0)),
    h('div', { class: 'lk-foot' }, h('button', { class: 'btn', onclick: () => { delete ov.rig; delete ov.mot; if (ov.laser) { delete ov.laser.amt; delete ov.laser.burst; if (!Object.keys(ov.laser).length) delete ov.laser; } shcSave(); shcDraw(); } }, 'Reset the rig'))
  ];
}

/* ---------- Colour ---------- */
function shcColour(c) {
  const { D, ov, sec, note, seg } = c, base = Object.assign({}, lxDesign(D.id).pal, ov.pal), set = (k, v) => shcSet('pal', k, v);
  return [
    sec('COLOURS'), note('Six colours make the whole show: the room, three stage lights and two laser colours. Near-white and steel colours stay that way.'),
    h('div', { class: 'sg-cols' }, [['base', 'Room'], ['a', 'Light 1'], ['b', 'Light 2'], ['c', 'Light 3'], ['l1', 'Laser 1'], ['l2', 'Laser 2']].map(([k, n]) => h('label', { class: 'sg-col' }, n, h('input', { type: 'color', value: base[k], 'aria-label': n + ' colour', oninput: e => set(k, e.target.value) })))),
    sec('COLOUR TREATMENT'), seg(SH_GRADES, D.rig.grade || 'full', k => { shcSet('rig', 'grade', k === 'full' ? undefined : k); shcDraw(); }, 'Colour treatment'), note('Two or one colour keeps a show disciplined: the same palette, fewer hues on stage at once.'),
    sec('PALETTES'), note('Borrow the colours of another look. Your lights and rig stay as they are.'),
    h('div', { class: 'shc-pals' }, SHOW_DESIGNS.map(d => h('button', { class: 'shc-pal', title: 'Use the colours of ' + d.name, onclick: () => { const o = shcSpec().ovr; o.pal = Object.assign({}, d.pal); shcSave(); shcDraw(); } }, h('span', { class: 'sw' }, ['base', 'a', 'b', 'c', 'l1', 'l2'].map(k => h('i', { style: { background: d.pal[k] } }))), h('span', {}, d.name)))),
    h('div', { class: 'lk-foot' }, h('button', { class: 'btn', onclick: () => { delete ov.pal; shcSave(); shcDraw(); } }, 'Reset the colours'))
  ];
}

/* ---------- Cues: what each kind of section gets ---------- */
function shcCues(c) {
  const { D, ov, sec, note, slider, chk, pct } = c, k = SHC.kind, P = lxProg(D, k), nH = D.rig.heads == null ? 12 : D.rig.heads, nm = LX_SEC_NAMES[k], cue = (key, v) => shcCueSet(k, key, v), playing = !!T.playing, pv = !!(LX.pv && LX.pv.kind === k);
  const patName = x => (SH_HEADS.find(y => y[0] === x) || [0, x])[1], kitOf = s => String(D.laser[s] != null ? D.laser[s] : (LX_KIT[s] || '')).split(/\s+/).filter(Boolean);
  const rows = LX_SECS.map(s => { const p = lxProg(D, s), hp = (D.heads && D.heads[s] ? D.heads[s] : p.pats.join(' ')).split(' ').map(patName).join(' · '), kit = D.laser.amt > 0 ? kitOf(s).map(x => SHOW_PAT_NAMES[x] || x).join(' · ') : '';
    return h('tr', { class: s === k ? 'on' : '', tabindex: 0, 'aria-label': LX_SEC_NAMES[s] + ' cue', onclick: () => { SHC.kind = s; shcDraw(); }, onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); SHC.kind = s; shcDraw(); } } },
      h('td', {}, LX_SEC_NAMES[s]), h('td', {}, h('span', { class: 'shc-bar' }, h('i', { style: { width: Math.round(clamp(p.int, 0, 1) * 100) + '%' } }))), h('td', { class: 'mono' }, nH ? String(Math.round(Math.min(nH, p.n * nH / 12))) : '–'), h('td', {}, nH ? hp : '–'), h('td', {}, kit || '–')); });
  const heads = (D.heads && D.heads[k] ? D.heads[k] : P.pats.join(' ')).split(' '), kit = kitOf(k);
  return [
    sec('CUE SHEET'), note('What each kind of section gets. A section takes its kind from its name (Verse, Chorus, Bridge…). Choose a row to change it.'),
    h('table', { class: 'shc-tbl' }, h('thead', {}, h('tr', {}, ['Section', 'Level', 'Lights', 'Pattern', 'Lasers'].map(t => h('th', { scope: 'col' }, t)))), h('tbody', {}, rows)),
    sec(nm.toUpperCase() + ' CUE'),
    h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap', alignItems: 'center' } },
      h('button', { class: 'btn' + (pv ? ' on' : ''), id: 'shPv', disabled: playing, onclick: () => { lxPreview(k, { final: SHC.final, sec: 60 }); shcDraw(); } }, '▶ Preview ' + nm), h('button', { class: 'btn sm', onclick: () => { lxPreviewStop(); shcDraw(); } }, '■ Stop'),
      chk('As the last time through', !!SHC.final, v => { SHC.final = v; if (LX.pv && LX.pv.kind === k) lxPreview(k, { final: v, sec: 60 }); }, 'The last chorus is the biggest')),
    note(playing ? 'Stop the song to rehearse a cue: the preview plays a silent band (kick, snare, hats, bass, strums) so the lights can be set without a song.' : 'The preview plays a silent band for this kind of section, so the lights can be set without a song. Watch the picture above.'),
    slider('Level', P.int, 0, 1.15, .01, pct, x => cue('int', x), 'How bright and busy this kind of section is'),
    slider('Lights on', Math.min(12, P.n), 0, 12, 1, x => nH ? Math.round(Math.min(nH, x * nH / 12)) + ' of ' + nH : 'no moving lights', x => cue('n', x)),
    slider('Haze', P.haze, 0, 1.2, .05, pct, x => cue('haze', x)), slider('Floor lights', P.pars, 0, 1, .05, pct, x => cue('pars', x)), slider('Backdrop level', P.wall, 0, 1, .05, pct, x => cue('wall', x)),
    h('div', { class: 'row', style: { gap: '14px', flexWrap: 'wrap' } }, chk('Confetti when it starts', !!P.conf, v => cue('conf', v ? 1 : 0)), chk('Blinder when it starts', !!P.strobe, v => cue('strobe', v ? 1 : 0))),
    note('The blinder and confetti also need an amount on the Rig tab, and Calm turns the blinder off.'),
    h('div', { class: 'lk-sec' }, 'LIGHT PATTERNS'), note('The patterns the moving lights take in this section. With several chosen it moves on to the next one every four bars.'),
    h('div', { class: 'sg-chips' }, SH_HEADS.map(([p, n]) => { const on = heads.includes(p); return h('button', { class: 'btn sm' + (on ? ' on' : ''), 'aria-pressed': String(on), onclick: () => { const nx = on ? heads.filter(x => x !== p) : heads.concat(p); shcSet('heads', k, nx.length ? nx.join(' ') : undefined); shcDraw(); } }, n); })),
    h('div', { class: 'lk-sec' }, 'LASER PATTERNS'),
    D.laser.amt > 0 ? [note('Which laser patterns run in this section. They combine, and the second phrase of a section drops one so the mix keeps changing.'), h('div', { class: 'sg-chips' }, SHOW_PATS.filter(p => p !== 'burst').map(p => { const on = kit.includes(p); return h('button', { class: 'btn sm' + (on ? ' on' : ''), 'aria-pressed': String(on), onclick: () => { const nx = on ? kit.filter(x => x !== p) : kit.concat(p); shcSet('laser', k, nx.join(' ')); shcDraw(); } }, SHOW_PAT_NAMES[p]); }))]
      : [note('Lasers are off in this look. '), h('button', { class: 'btn sm', onclick: () => { shcSet('laser', 'amt', .6); shcDraw(); } }, 'Turn lasers on')],
    h('div', { class: 'lk-foot' }, h('button', { class: 'btn', onclick: () => { if (ov.cue) delete ov.cue[k]; if (ov.heads) delete ov.heads[k]; if (ov.laser) delete ov.laser[k]; shcSave(); shcDraw(); } }, 'Reset ' + nm.toLowerCase() + ' cue'), h('button', { class: 'btn', onclick: () => { delete ov.cue; delete ov.heads; if (ov.laser) LX_SECS.forEach(s => delete ov.laser[s]); shcSave(); shcDraw(); } }, 'Reset all cues'))
  ].flat();
}

/* ---------- Response: how the lights follow the band ---------- */
function shcResp(c) {
  const { D, ov, sec, note, slider, pct } = c, R = Object.assign({}, LX_R1, D.resp);
  return [
    sec('RESPONSE'), note('How strongly each part of the band drives the lights. 100% is how the look was made. Zero cuts that part off; more makes it lead. The bars show what is arriving now.'),
    h('div', { class: 'shc-resp' }, SH_RESP.map(([k, n, what]) => h('div', { class: 'shc-rrow' }, h('div', { class: 'shc-rn' }, h('b', {}, n), h('span', { class: 'tiny muted' }, what)), h('div', { class: 'shc-meter', 'data-meter': k, 'aria-hidden': 'true' }, h('i')),
      slider('', R[k], 0, 1.5, .05, x => Math.round(x * 100) + '%', x => shcSet('resp', k, x === 1 ? undefined : x), n + ' strength'),
      h('button', { class: 'btn sm', title: 'Fire one ' + n.toLowerCase() + ' now', onclick: () => { if (k === 'kick') lxFire({ row: 0, v: 3 }); else if (k === 'snare') lxFire({ row: 1, v: 3 }); else if (k === 'hat') lxFire({ row: 2, v: 3 }); else if (k === 'bass') lxFireX({ type: 'bass', a: 36 + S.key, b: .9 }); else if (k === 'strum') lxFireX({ type: 'chord', b: .9 }); else lxFireX({ type: 'lead', a: 62 + S.key % 12, b: .9 }); } }, 'Fire')))),
    note('With no song playing, the band is silent. “Fire” sends one hit, and Cues ▸ Preview plays a whole silent band.'),
    h('div', { class: 'lk-foot' }, h('button', { class: 'btn', onclick: () => { delete ov.resp; shcSave(); shcDraw(); } }, 'Reset the response'))
  ];
}

/* ---------- Pictures ---------- */
function shcPics(c) {
  const { D, sec, note, slider, pct, scene } = c, imgs = CFG.show.imgs, use = D.use || { back: [], wall: [], logo: null }, u = () => shUseOf(shcSpec());
  const toggle = (role, id) => { const x = u(); if (role === 'logo') x.logo = x.logo === id ? null : id; else { const a = x[role] || (x[role] = []); x[role] = a.includes(id) ? a.filter(v => v !== id) : a.concat(id); if (role === 'wall') { const o = shcSpec().ovr, g = o.rig || (o.rig = {}); if (x.wall.length) g.wall = 'image'; else if (D.rig.wall === 'image') g.wall = 'spectrum'; } } shcSave(); shcDraw(); };
  const pick = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', multiple: true, style: { display: 'none' }, onchange: async e => { const f = [...e.target.files]; e.target.value = ''; await shAdd(f); shcDraw(); } });
  const drop = h('div', { class: 'sg-drop', tabindex: 0, role: 'button', 'aria-label': 'Add pictures', onclick: () => pick.click(), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick.click(); } },
    ondragover: e => { e.preventDefault(); e.stopPropagation(); drop.classList.add('over'); }, ondragleave: () => drop.classList.remove('over'), ondrop: async e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); await shAdd(e.dataTransfer.files || []); shcDraw(); } }, 'Drop pictures here, or click to choose them', pick);
  const thumbs = h('div', { class: 'sg-thumbs' }, imgs.map(m => {
    const cv = h('canvas', { width: 160, height: 90, 'aria-label': m.name }), paint = () => { const im = shImg(m.id); if (!im) return false; const g = cv.getContext('2d'), s = Math.max(160 / im.width, 90 / im.height); g.fillStyle = '#111'; g.fillRect(0, 0, 160, 90); g.drawImage(im, (160 - im.width * s) / 2, (90 - im.height * s) / 2, im.width * s, im.height * s); return true; };
    if (!paint()) { let tries = 0; const again = () => { if (!paint() && ++tries < 12 && cv.isConnected) setTimeout(again, 250); }; setTimeout(again, 250); }
    const role = (r, label, on, title) => h('button', { class: 'btn sm' + (on ? ' on' : ''), 'aria-pressed': String(on), title, onclick: () => toggle(r, m.id) }, label);
    return h('div', { class: 'sg-thumb' }, cv, h('div', { class: 'sg-tn', title: m.name }, m.name), h('div', { class: 'sg-row' }, role('back', 'Back', (use.back || []).includes(m.id), 'Behind the lights. Several pictures change at each new section.'), role('wall', 'Wall', (use.wall || []).includes(m.id), 'On the light wall, as a pixel picture the music plays across'), role('logo', 'Logo', use.logo === m.id, 'A logo, lit by the band')),
      h('button', { class: 'sg-x', title: 'Remove this picture from this device', 'aria-label': 'Remove ' + m.name, onclick: () => shRemove(m.id).then(() => shcDraw()) }, '✕'));
  }));
  return [sec('YOUR PICTURES'), note('Add your own pictures: a band photo, a poster, a logo, a venue. They are reduced and kept in this browser only, never uploaded, and they are not part of a song’s .zip. Only use pictures you have the right to show.'), drop, imgs.length ? thumbs : null,
    (use.back || []).length ? h('div', { class: 'lk' }, slider('Backdrop strength', use.backAmt == null ? .6 : use.backAmt, 0, 1, .05, pct, x => { u().backAmt = x; shcSave(); }), slider('Colour wash over the backdrop', use.backTint == null ? .35 : use.backTint, 0, 1, .05, x => x ? pct(x) : 'off', x => { u().backTint = x; shcSave(); })) : null,
    use.logo ? h('div', { class: 'lk' }, slider('Logo size', use.logoSize == null ? .16 : use.logoSize, .05, .4, .01, x => pct(x / .4), x => { u().logoSize = x; shcSave(); }),
      h('label', { class: 'sg-sl' }, h('span', {}, 'Logo position'), h('select', { class: 'in', onchange: e => { u().logoPos = e.target.value; shcSave(); } }, [['tl', 'Top left'], ['tc', 'Top centre'], ['tr', 'Top right'], ['bl', 'Bottom left'], ['bc', 'Bottom centre'], ['br', 'Bottom right'], ['c', 'Centre']].map(([k, n]) => h('option', { value: k, selected: (use.logoPos || 'tr') === k }, n))))) : null];
}

/* ---------- Output ---------- */
function shcOut(c) {
  const { sec, note, slider, chk, seg, pct } = c, O = CFG.show.out, save = () => saveCfg(), frozen = !!(SG.freeze || SG.freezeReq), cur = lxComfortKey();
  return [
    sec('PREFLIGHT'), gdPfBlock(),
    sec('OUTPUT'), note('What goes to the screen, the full-screen view and the pop-out window. These belong to this device, not to a scene.'),
    slider('Master level', O.master == null ? 1 : O.master, 0, 1, .01, pct, x => { O.master = x; save(); }),
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } },
      h('button', { class: 'btn' + (SG.boOn ? ' on' : ''), id: 'shBo', 'aria-pressed': String(!!SG.boOn), title: 'Fade the whole output to black and back (key 0 while the Stage is showing)', onclick: () => shBlackout() }, '■ Blackout · 0'),
      h('button', { class: 'btn' + (frozen ? ' on' : ''), id: 'shFreeze', 'aria-pressed': String(frozen), title: 'Hold the picture as it is, for the output (key 9 while the Stage is showing)', onclick: () => shFreeze() }, '❄ Freeze · 9')),
    h('div', { class: 'row', style: { gap: '14px', flexWrap: 'wrap' } }, chk('Mirror left–right', !!O.mirror, v => { O.mirror = v; save(); }, 'For a projector behind the screen'), chk('Flip upside down', !!O.flip, v => { O.flip = v; save(); }, 'For a projector hung from the ceiling')),
    chk('Safe-frame guides on this screen', !!O.safe, v => { O.safe = v; save(); if (SG.wrap) SG.wrap.classList.toggle('guides', v); }, 'Dashed lines at 90% (action) and 80% (titles). Not drawn in full screen or in the pop-out window.'),
    c.sel('Frame rate', [[60, '60 frames a second'], [30, '30 frames a second (lighter on the computer)']], O.fps || 60, v => { O.fps = +v; save(); }),
    sec('TEST PATTERNS'), note('Fills the output with a pattern so the projector can be lined up and the colours checked. The show goes on behind it once you turn it off. White is very bright.'), seg(SH_TESTS, SG.test || '', k => { SG.test = k || null; if (k) GD.pf.test = 1; shcDraw(); }, 'Test pattern'),
    sec('SCREEN'), h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, h('button', { class: 'btn sm', id: 'shFull', onclick: () => { GD.pf.out = 1; stageFull(); } }, '⛶ Full screen'), h('button', { class: 'btn sm', id: 'shPop', onclick: () => { GD.pf.out = 1; stagePop(); } }, '⧉ Pop-out window'), h('button', { class: 'btn sm' + (STG.hud !== false ? ' on' : ''), onclick: () => { STG.hud = !(STG.hud !== false); saveStg(); renderStageUI(); } }, STG.hud !== false ? 'Chord and lyric on' : 'Chord and lyric off'),
      c.sel('Render quality', [[.5, 'Low (fast)'], [.75, 'Medium'], [1, 'High']], STG.q, v => { STG.q = +v; saveStg(); })),
    sec('LIGHT COMFORT'), seg(Object.entries(LX_COMFORT).map(([k, m]) => [k, m.name, m.blurb]), cur, k => { lxSetComfort(k); shcDraw(); }, 'Light comfort'),
    note(LX_COMFORT[cur].blurb + (lxReduced() && !STG.comfort ? ' Your device asks for less motion, so Calm is the default.' : '')),
    sec('FLASH METER'),
    h('div', { class: 'shc-gauge' }, h('span', {}, 'Flashes per second'), h('div', { class: 'shc-meter lim', 'data-meter': 'flash', 'aria-hidden': 'true' }, h('i')), h('span', { class: 'tiny muted' }, 'the line is 3'), h('span', {}, 'Governor'), h('div', { class: 'shc-meter', 'data-meter': 'gov', 'aria-hidden': 'true' }, h('i')), h('span', { class: 'tiny muted' }, '100% = untouched')),
    h('div', { class: 'row', style: { gap: '8px', alignItems: 'center' } }, h('span', { class: 'small' }, 'Highest this session: '), h('b', { id: 'shcPeak', class: 'mono' }, LXG.maxN + ' per second'), h('button', { class: 'btn sm', onclick: () => { LXG.maxN = 0; shcMeters(); } }, 'Reset')),
    note('However you set the show, it never flashes more than three times a second: the engine limits itself, and a governor watches the finished picture and eases the lights off if it gets close. This is a safeguard built into the app, not a medical guarantee. If lights or motion ever bother you, choose Calm or stop the show.')
  ];
}

/* ---------- Scene: the Stage scene's own settings ---------- */
function stgRestoreStarters() { STG.scenes = starterScenes(); STG.cur = Math.min(STG.cur, STG.scenes.length - 1); VZ.spec = null; saveStg(); renderStageUI(); toast('The starter scenes are back.', 'ok'); }
function shcScene(c) {
  const { sc, sec, note } = c, field = (label, ctl) => h('label', { class: 'small', style: { display: 'flex', flexDirection: 'column', gap: '3px', fontWeight: 700 } }, label, ctl);
  const rng = (k, min, max, step, fmt) => { const v = h('span', { class: 'mono tiny' }, (fmt || (x => x))(sc[k])); return h('div', { class: 'row', style: { gap: '6px' } }, h('input', { type: 'range', min, max, step, value: sc[k], style: { flex: 1 }, oninput: e => { sc[k] = +e.target.value; v.textContent = (fmt || (x => x))(sc[k]); saveStg(); } }), v); };
  const chk = (o, k, label) => h('label', { class: 'chk small', style: { display: 'flex', gap: '4px', alignItems: 'center', fontWeight: 700 } }, h('input', { type: 'checkbox', checked: o[k], onchange: e => { o[k] = e.target.checked; saveStg(); } }), label);
  return [
    sec('SCENE ' + (STG.cur + 1)),
    h('div', { class: 'sgrid', style: { marginTop: 0 } },
      field('Name', h('input', { class: 'in', value: sc.name, style: { fontFamily: 'var(--sans)' }, onchange: e => { sc.name = e.target.value || 'Scene'; saveStg(); renderStageUI(); } })),
      field('Visual', h('select', { class: 'in', style: { fontFamily: 'var(--sans)' }, onchange: e => { sc.mode = e.target.value; VZ.spec = null; SG.joy = []; saveStg(); shcDraw(); } }, VMODES.map(([k, n]) => h('option', { value: k, selected: k === sc.mode }, n)))),
      field('Hue', rng('hue', 0, 359, 1, x => x + '°')), field('Hue drift', rng('drift', 0, 3, .05, x => x ? x.toFixed(2) : 'off')),
      field('Trails', rng('trail', 0, 1, .01, x => Math.round(x * 100) + '%')), field('Glow', rng('glow', 0, 1, .01, x => Math.round(x * 100) + '%')),
      field('Kaleidoscope', h('select', { class: 'in', style: { fontFamily: 'var(--sans)' }, onchange: e => { sc.kal = +e.target.value; saveStg(); } }, [[0, 'Off'], [3, '3 wedges'], [4, '4'], [6, '6'], [8, '8'], [12, '12']].map(([v, n]) => h('option', { value: v, selected: v === sc.kal }, n)))),
      field('Sensitivity', rng('sens', .4, 2.5, .05, x => '×' + x.toFixed(2))), field('Beat flash', rng('flash', 0, 1, .05, x => x ? Math.round(x * 100) + '%' : 'off')),
      field('Switch to this scene on section', h('input', { class: 'in', value: sc.sect, placeholder: 'e.g. chorus', style: { fontFamily: 'var(--sans)' }, onchange: e => { sc.sect = e.target.value.trim(); saveStg(); } }))),
    h('div', { class: 'row', style: { gap: '14px', marginTop: '8px', flexWrap: 'wrap' } }, chk(sc, 'cam', '📷 Camera backdrop'), camFxBox(), chk(sc.ov, 'chord', 'Chord'), chk(sc.ov, 'lyric', 'Lyric line'), chk(sc.ov, 'beat', 'Beat dots'), chk(sc.ov, 'info', 'Section · BPM · key'), chk(sc.ov, 'tuner', 'Tuner')),
    sec('SWITCHING'), chk(STG, 'auto', 'Switch scenes by section name'), note('Keys 1–8 pick scenes, 0 is blackout and 9 freezes the picture, while this tab (or full screen) is showing. MIDI notes 48–55 pick scenes anywhere. Lyric lines advance with the bar position of the section.'),
    pbCard(),
    h('div', { class: 'lk-foot' }, h('button', { class: 'btn', title: 'Put the eight scenes back as they shipped', onclick: e => { if (SHC.arm && Date.now() - SHC.arm < 4000) { SHC.arm = 0; stgRestoreStarters(); } else { SHC.arm = Date.now(); e.currentTarget.textContent = 'Click again to replace all 8'; } } }, 'Restore starter scenes'))
  ];
}

/* ---------- MIDI out ---------- */
function shcMidi(c) {
  const { sec, note } = c, chk = (o, k, label) => h('label', { class: 'chk small', style: { display: 'flex', gap: '4px', alignItems: 'center', fontWeight: 700 } }, h('input', { type: 'checkbox', checked: o[k], onchange: e => { o[k] = e.target.checked; saveStg(); } }), label);
  const sel = h('select', { class: 'in', style: { width: 'auto', fontFamily: 'var(--sans)' }, onchange: e => { STG.out = e.target.value; saveStg(); } }), fill = () => { sel.innerHTML = ''; sel.append(h('option', { value: '' }, MIDI.access ? 'No output' : 'Enable MIDI first')); if (MIDI.access) MIDI.access.outputs.forEach(o => sel.append(h('option', { value: o.id, selected: o.id === STG.out }, o.name))); }; fill();
  const again = () => { if (sel.isConnected) fill(); else bus.off('midi', again); }; bus.on('midi', again);
  return [sec('MIDI OUT → LIGHTS, SYNTHS, DAW'),
    h('div', { class: 'row', style: { gap: '14px', flexWrap: 'wrap', alignItems: 'center' } }, h('div', { class: 'row', style: { gap: '6px' } }, sel, h('button', { class: 'btn sm', onclick: () => { initMIDI(); } }, 'Enable MIDI')),
      h('label', { class: 'small', style: { fontWeight: 700 } }, 'Channel ', h('input', { class: 'in', type: 'number', min: 1, max: 16, value: (STG.ch | 0) + 1, style: { width: '56px' }, onchange: e => { STG.ch = clamp((+e.target.value || 1) - 1, 0, 15); saveStg(); } })),
      chk(STG, 'clock', 'Clock + start/stop'), chk(STG, 'roots', 'Chord root notes'), chk(STG, 'trig', 'Note on every pick (note 60)'), chk(STG, 'ccs', 'CC20 loudness · CC21 brightness')),
    note('Clock is derived from the song playhead and sent per frame, so expect a little jitter: fine for lights and arpeggiators, not for tight audio sync.')];
}

/* ---------- the Visuals bar ---------- */
function sgdBarButton() {
  return h('button', { class: 'btn sm', id: 'sgdOpen', title: 'Show setup: looks, rig, colours, cues, lasers, your pictures, output', onclick: () => shOpen('vis', 'looks') }, '🎛 Show setup');
}
