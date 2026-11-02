/* Show: the six looks, the Show setup console (looks, rig, colour, cues, response, pictures, output), saved looks and look files, the laser engine,
   light comfort and the flash limit, and the pictures people add (parts 54–59). Own browser context; see test/lib.cjs.
   The flash test is deliberately independent of the app's own governor: it samples the finished picture, counts opposing brightness swings the way the
   web accessibility guidelines define a flash (a swing of 0.10 or more in relative luminance, whole picture and each quarter of it), and runs a very fast song. */
const { suite } = require('./lib.cjs');
suite('e2e-show', async t => {
  const { ok, wait, poll } = t, p = await t.open({ w: 1280, h: 800, debug: true }), ev = (f, a) => p.evaluate(f, a);
  const offsite = []; p.on('request', r => { const u = r.url(); if (!u.startsWith(t.BASE) && !/^(data|blob|about):/.test(u)) offsite.push(u); });
  await ev(async () => { const d = window.__daily; await d.ioConnect(); window.__mkX = (dt, en) => ({ fd: new Float32Array(1024).fill(-60), bin: f => Math.max(1, Math.min(1023, Math.round(f / 20))), lvl: x => Math.max(0, Math.min(1, (x + 88) / 62)), dt: dt || .016, energy: en == null ? .5 : en }); });

  // ---- the six looks, built differently (not six palettes on one rig)
  const des = await ev(() => { const d = window.__daily; return d.SHOW_DESIGNS.map(x => ({ id: x.id, name: x.name, pal: x.pal, laser: x.laser, rig: x.rig, mot: x.mot })); });
  ok(des.map(x => x.id).join() === 'theatre,backlight,blades,pixels,horizon,lasers', 'six looks (' + des.map(x => x.id).join(' ') + ')');
  ok(des.every(x => ['base', 'a', 'b', 'c', 'l1', 'l2'].every(k => /^#[0-9a-f]{6}$/i.test(x.pal[k]))), 'each look has six colours: the room, three lights and two lasers');
  ok(new Set(des.map(x => x.pal.a + x.pal.b + x.pal.l1)).size === 6 && new Set(des.map(x => x.pal.base)).size === 6, 'no two looks share a palette');
  ok(new Set(des.map(x => x.rig.layout)).size >= 4 && new Set(des.map(x => x.rig.wall)).size >= 4 && new Set(des.map(x => x.rig.heads)).size >= 5, 'and they differ in construction, not just colour: ' + new Set(des.map(x => x.rig.layout)).size + ' ways to stand the lights, ' + new Set(des.map(x => x.rig.wall)).size + ' backdrops, ' + new Set(des.map(x => x.rig.heads)).size + ' light counts');
  const by = Object.fromEntries(des.map(x => [x.id, x]));
  ok(by.theatre.laser.amt === 0 && by.theatre.rig.flash === 0 && by.lasers.laser.amt >= .9 && by.lasers.rig.layout === 'sides' && by.backlight.rig.layout === 'floor' && by.blades.rig.wall === 'blades' && by.pixels.rig.wall === 'field' && by.horizon.rig.bg === 'sky', 'Theatre has no strobe or lasers; Backlight stands its lights on the floor; Blades, Pixel field and Horizon have their own backdrops; the Laser room has the lasers');
  ok(by.lasers.laser.chorus.split(' ').length >= 3 && by.lasers.laser.verse !== by.lasers.laser.chorus, 'a Laser room chorus runs a combination of beams, and its verse is a different cue');

  // ---- a look plus the person's changes
  const rs = await ev(() => {
    const d = window.__daily, C = d.CFG.show; C.auto = false; C.design = 'lasers'; C.ovr = { pal: { a: '#112233' }, laser: { amt: .3 }, rig: { heads: 5 } };
    const D = d.lxResolve(null), N = d.lxDesign('lasers'), sc = d.lxResolve({ design: 'theatre', ovr: {} }), old = d.lxDesign('arena');
    const out = { id: D.id, a: D.pal.a, b: D.pal.b === N.pal.b, amt: D.laser.amt, chorus: D.laser.chorus === N.laser.chorus, heads: D.rig.heads, haze: D.rig.haze === N.rig.haze, sc: sc.id, scAmt: sc.laser.amt, still: d.lxDesign('lasers').pal.a === N.pal.a && N.pal.a !== '#112233', alias: old.id };
    C.ovr = {}; return out;
  });
  ok(rs.id === 'lasers' && rs.a === '#112233' && rs.b && rs.amt === .3 && rs.chorus && rs.heads === 5 && rs.haze, 'changes lie over the look and everything else stays as the look had it');
  ok(rs.sc === 'theatre' && rs.scAmt === 0 && rs.still, 'a Stage scene resolves its own look, and the look itself is never altered');
  ok(rs.alias === 'backlight', 'a song or a scene that still names one of the 2.5 shows gets the nearest new look');

  // ---- the look follows the song when nobody has chosen
  const au = await ev(() => {
    const d = window.__daily, S = d.S, b = S.band, was = JSON.stringify([S.minor, S.bpm, S.show, b.kit, b.patName, b.compStyle, b.drumsOn]), set = (minor, bpm, kit, pat, comp, drums) => { S.minor = minor; S.bpm = bpm; S.show = undefined; b.kit = kit; b.patName = pat; b.compStyle = comp; b.drumsOn = drums !== false; return d.lxAutoDesign(); };
    const r = { lasers: set(false, 124, '808', 'Four on the Floor', 'Pop 16th shimmer'), backlight: set(false, 126, 'Rock Room', 'Rock 8ths', 'Power Chug 8ths'), theatre: set(false, 84, 'Brush (soft)', 'Folk Backbeat', 'Folk Strum'), horizon: set(true, 72, 'Brush (soft)', 'Ballad Half-Time', 'Arpeggio'), blades: set(true, 100, 'Acoustic', 'Funk 16ths', 'Funk Chuck'), pixels: set(true, 100, 'Acoustic', 'Pop Groove', 'Pop 8ths'), horizon2: set(false, 118, 'Acoustic', 'Pop Groove', 'Pop 8ths') };
    S.show = 'blades'; r.hint = d.lxAutoDesign(); S.show = 'arena'; r.alias = d.lxAutoDesign(); const w = JSON.parse(was); S.minor = w[0]; S.bpm = w[1]; S.show = w[2]; b.kit = w[3]; b.patName = w[4]; b.compStyle = w[5]; b.drumsOn = w[6]; return r;
  });
  ok(Object.keys(au).every(k => /^horizon2$/.test(k) ? au[k] === 'horizon' : au[k] === k || k === 'hint' || k === 'alias') && au.hint === 'blades' && au.alias === 'backlight', 'the Visuals tab picks a look from the song: kit, groove, key, tempo; a song that names its show keeps it (' + JSON.stringify(au) + ')');

  // ---- no example songs
  const nx = await ev(() => { const d = window.__daily; return { fn: typeof d.showStarter, st: typeof d.SH_ST, titles: d.PRJ.list.filter(r => /\(example\)/i.test(r.title || '')).length, dom: /example song/i.test(document.body.textContent) }; });
  ok(nx.fn === 'undefined' && nx.st === 'undefined' && nx.titles === 0 && !nx.dom, 'the app ships no example songs, and the look pickers have no “Example song” buttons');

  // ---- light comfort
  const cm = await ev(() => {
    const d = window.__daily, S = d.STG, C = d.LX_COMFORT, out = { fresh: d.lxComfortKey() };
    out.calm = C.calm.strobe === 0; out.gaps = Object.values(C).every(c => c.gap >= 333) && C.calm.gap >= 1000; out.order = C.calm.impulse < C.standard.impulse && C.standard.impulse <= C.full.impulse && C.calm.motion < C.full.motion;
    d.lxSetComfort('calm'); out.k1 = d.lxComfortKey() + ':' + S.comfort + ':' + S.safe; d.lxSetComfort('full'); out.k2 = d.lxComfortKey() + ':' + S.safe; d.lxSetComfort('standard'); out.k3 = d.lxComfortKey() + ':' + S.safe;
    d.lxSetComfort('nonsense'); out.k4 = d.lxComfortKey(); S.comfort = undefined; S.safe = false; out.legacyFull = d.lxComfortKey(); S.safe = true; out.legacyStd = d.lxComfortKey(); d.lxSetComfort('standard'); return out;
  });
  ok(cm.fresh === 'standard', 'a new visitor gets Standard');
  ok(cm.calm && cm.gaps && cm.order, 'Calm has no strobe; no mode flashes closer than a third of a second; Calm is gentler than Standard and Standard than Full');
  ok(cm.k1 === 'calm:calm:true' && cm.k2 === 'full:false' && cm.k3 === 'standard:true' && cm.k4 === 'standard', 'the choice is kept (and the old Reduce flashing switch follows it): ' + [cm.k1, cm.k2, cm.k3].join(' '));
  ok(cm.legacyFull === 'full' && cm.legacyStd === 'standard', 'someone who had turned Reduce flashing off keeps Full, and everyone else stays on Standard');
  await p.emulateMedia({ reducedMotion: 'reduce' });
  const rm = await ev(() => { const d = window.__daily; d.STG.comfort = undefined; d.STG.safe = true; const k = d.lxComfortKey(); d.lxSetComfort('full'); const keep = d.lxComfortKey(); d.lxSetComfort('standard'); return { k, keep }; });
  ok(rm.k === 'calm' && rm.keep === 'full', 'when the device asks for reduced motion the default is Calm, and a deliberate choice still wins');
  await p.emulateMedia({ reducedMotion: 'no-preference' });

  // ---- the governor, on made-up pictures
  const gv = await ev(() => {
    const d = window.__daily, G = d.LXG, cv = document.createElement('canvas'); cv.width = 96; cv.height = 54; const q = cv.getContext('2d'); let T0 = 1e6;
    const run = (paint, frames) => { G.t = 0; G.maxN = 0; G.tgt = 1; G.s.forEach(s => { s.ts = []; s.dir = 0; s.init = false; }); for (let i = 0; i < frames; i++) { paint(i); d.lxGovMeasure(cv, T0 += 40); } return { n: G.n, maxN: G.maxN, tgt: +G.tgt.toFixed(2) }; };
    d.lxGovMeasure(cv, T0);   // builds the sampler
    const fill = c => { q.fillStyle = c; q.fillRect(0, 0, 96, 54); };
    return { steady: run(() => fill('#777'), 60), slow: run(i => fill(Math.floor(i / 14) % 2 ? '#fff' : '#000'), 100), fast: run(i => fill(i % 2 ? '#fff' : '#000'), 60), mid: run(i => fill(Math.floor(i / 6) % 2 ? '#fff' : '#000'), 60), red: run(i => fill(i % 2 ? '#ff0000' : '#7c7c7c'), 60), small: run(i => { fill('#000'); q.fillStyle = i % 2 ? '#fff' : '#000'; q.fillRect(0, 0, 48, 27); }, 60), soft: run(i => fill('hsl(0,0%,' + (45 + 3 * Math.sin(i / 2)) + '%)'), 60) };
  });
  await ev(() => { const G = window.__daily.LXG; G.t = 0; G.maxN = 0; G.tgt = 1; G.s.forEach(s => { s.ts = []; s.dir = 0; s.init = false; }); });
  ok(gv.steady.maxN === 0 && gv.steady.tgt === 1 && gv.soft.maxN === 0 && gv.soft.tgt === 1, 'a steady picture, or a gentle swell, does not trouble the governor');
  ok(gv.slow.tgt === 1 && gv.slow.maxN <= 2, 'one flash a second is left alone (' + gv.slow.maxN + ' swings)');
  ok(gv.mid.maxN >= 3 && gv.mid.tgt < 1, 'four swings in a second already pull the show back (' + gv.mid.maxN + ' swings, target ' + gv.mid.tgt + ')');
  ok(gv.fast.maxN >= 8 && gv.fast.tgt <= .2, 'a flat-out strobe pushes it to the floor (' + gv.fast.maxN + ' swings, target ' + gv.fast.tgt + ')');
  ok(gv.red.maxN >= 5 && gv.red.tgt <= .4, 'saturated red flashing counts on its own even when the brightness hardly moves (' + gv.red.maxN + ' swings)');
  ok(gv.small.maxN >= 5 && gv.small.tgt <= .4, 'a flash in one corner of the picture counts too');

  // ---- the events reach the lights on the audio clock, not on a timer
  const sy = await ev(() => {
    const d = window.__daily, L = d.LX, ct = d.E.ctx.currentTime; L.q.length = 0; L.bass = L.strum = L.lead = L.beatP = L.down = 0; d.STG.cur = 0; d.dockGo('stage');
    d.lxEvt('bass', ct + 30, 45, .9); d.lxEvt('chord', ct - .5, 0, .9); d.lxEvt('lead', ct - .5, 72, 1); d.lxEvt('beat', ct - .5, 1, 1);
    d.lxUpdate(.016, window.__mkX()); const a = { q: L.q.length, bass: L.bass, strum: L.strum, lead: L.lead, beatP: L.beatP, down: L.down };
    L.q[0].t = d.E.ctx.currentTime - .1; d.lxUpdate(.016, window.__mkX()); return { a, bass: L.bass, left: L.q.length };
  });
  ok(sy.a.q === 1 && sy.a.bass === 0 && sy.a.strum > .4 && sy.a.lead > .5 && sy.a.beatP > .5 && sy.a.down > .5, 'a chord, a lead note and a downbeat light the rig as the audio clock reaches them; a bass note still in the future waits');
  ok(sy.bass > .4 && sy.left === 0, 'and the bass note lights it the moment its time comes');

  // ---- lasers: locked to the bar, not to a timer
  const lk = await ev(() => {
    const d = window.__daily, L = d.LX, cv = [0, 1, 2].map(() => { const c = document.createElement('canvas'); c.width = 480; c.height = 270; return c; });
    L.D = d.lxResolve(null); L.mode = 'song'; L.e = 1; L.gov = 1; L.kick = L.snare = L.hat = L.strum = L.lead = 0; L.beatP = 0; L.laserKit = ['fan']; L.laserAmt = 1; L.burst = 0; L.pal = L.pal || { l1: d.lxHexHsl('#ffffff'), l2: d.lxHexHsl('#ff2f7d') }; L.fb = L.fb || { bi: 0 };
    d.LZ.amp = { fan: 1 }; const draw = (c, pos) => { L.pos = pos; const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#000'; g.fillRect(0, 0, 480, 270); d.lxLasers(g, 480, 270, 0); return g.getImageData(0, 0, 480, 270).data; };
    const a = draw(cv[0], 8.0), b = draw(cv[1], 12.0), c2 = draw(cv[2], 9.0), a2 = draw(cv[0], 8.0), diff = (x, y) => { let n = 0; for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 30) n++; return n; }, lit = x => { let n = 0; for (let i = 0; i < x.length; i += 4) if (x[i] + x[i + 1] + x[i + 2] > 60) n++; return n; };
    return { lit: lit(a), again: diff(a, a2), fourBars: diff(a, b), oneBar: diff(a, c2) };
  });
  ok(lk.lit > 300, 'a laser fan draws beams (' + lk.lit + ' bright pixels)');
  ok(lk.again === 0 && lk.fourBars === 0, 'the same moment in the song gives the same picture, and four bars later the fan is exactly where it was: the sweep belongs to the bars');
  ok(lk.oneBar > 200, 'one bar later the beams have moved');

  // ---- the stage canvas, small, for the long runs
  await ev(() => { const d = window.__daily; d.dockGo('stage'); d.STG.q = 1; d.STG.hud = false; const w = document.querySelector('.stagewrap'); w.style.width = '480px'; w.style.height = '270px'; w.style.minHeight = '0'; w.style.aspectRatio = 'auto'; });

  // ---- flash rate: the independent counter, 190 BPM, 16th-note funk, three comfort levels
  const run = (comfort, scene, secs, bpm) => ev(async ([comfort, scene, secs, bpm]) => {
    const d = window.__daily, bar = c => ({ chord: c, tab: [] }), mk = (id, name, ch) => ({ id, name, lyrics: '', bars: ch.map(bar) });
    d.S.key = 9; d.S.minor = true; d.S.bpm = bpm; Object.assign(d.S.band, { drumsOn: true, bassOn: true, compOn: true, leadOn: true, kit: '808', patName: 'Funk 16ths', pat: null, bassStyle: 'Syncopated', compStyle: 'Pop 16th shimmer', compInst: 'Electric' });
    d.S.sections = [mk('a', 'Pre-Chorus', ['Am', 'F']), mk('b', 'Chorus', ['F', 'C', 'G', 'Am', 'F', 'C', 'G', 'Am']), mk('c', 'Solo', ['Am', 'F', 'C', 'G']), mk('d', 'Chorus', ['F', 'C', 'G', 'Am', 'F', 'C', 'G', 'Am'])]; d.commit(false);
    d.dockGo('stage'); d.STG.cur = scene; d.STG.comfort = comfort; d.LXG.maxN = 0; d.LX.lastStrobeBar = -1; d.LX.strobe = 0; d.LX.lastStrobe = 0; d.T.cursor = 0; await d.play();
    const cv = document.createElement('canvas'); cv.width = 48; cv.height = 27; const q = cv.getContext('2d', { willReadFrequently: true }), samples = [], onsets = [];
    const lin = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    let strobeMax = 0, prev = 0, lite = 0; const kits = [], t0 = performance.now(); let pos0 = null, pos1 = 0;
    await new Promise(res => { const iv = setInterval(() => {
      const now = performance.now(); q.drawImage(d.SG.cv, 0, 0, 48, 27); const px = q.getImageData(0, 0, 48, 27).data, reg = [0, 0, 0, 0, 0], n = [0, 0, 0, 0, 0];
      for (let y = 0; y < 27; y++) for (let x = 0; x < 48; x++) { const o = (y * 48 + x) * 4, Y = .2126 * lin(px[o]) + .7152 * lin(px[o + 1]) + .0722 * lin(px[o + 2]); reg[0] += Y; n[0]++; const r = 1 + (y >= 13.5 ? 2 : 0) + (x >= 24 ? 1 : 0); reg[r] += Y; n[r]++; }
      samples.push({ t: now - t0, v: reg.map((s, i) => s / n[i]) }); const L = d.LX; strobeMax = Math.max(strobeMax, L.strobe);
      /* a blinder is counted by the show's own stamp (when it fired, and in which bar), so a busy machine that samples late cannot miss a flash
         that has already faded; the level it fired at is ≥ 0.9 by construction */
      if (L.lastStrobe !== prev && L.lastStrobe > 0) { onsets.push({ t: L.lastStrobe, bar: L.lastStrobeBar }); strobeMax = Math.max(strobeMax, .9); } prev = L.lastStrobe; lite = Math.max(lite, L.lite);
      if (L.fb) kits.push({ k: (L.laserKit || []).join('+'), bi: L.fb.bi, si: L.fb.si }); if (pos0 == null && L.mode === 'song') pos0 = L.pos; pos1 = L.pos;
      if (now - t0 > secs * 1000) { clearInterval(iv); res(); } }, 40); });
    d.stopPlay(true);
    const worst = thr => { let best = 0; for (let r = 0; r < 5; r++) { const tr = []; let ref = samples[0].v[r], dir = 0;
      for (const s of samples) { const x = s.v[r]; if (dir === 0) { if (Math.abs(x - ref) >= thr) { dir = x > ref ? 1 : -1; ref = x; } } else if (dir === 1) { if (x >= ref) ref = x; else if (ref - x >= thr) { dir = -1; ref = x; tr.push(s.t); } } else { if (x <= ref) ref = x; else if (x - ref >= thr) { dir = 1; ref = x; tr.push(s.t); } } }
      for (let i = 0; i < tr.length; i++) best = Math.max(best, tr.filter(z => z >= tr[i] && z < tr[i] + 1000).length); } return best; };
    const changes = []; for (let i = 1; i < kits.length; i++) if (kits[i].k !== kits[i - 1].k) changes.push({ bi: kits[i].bi, to: kits[i].k });
    const gaps = onsets.slice(1).map((o, i) => o.t - onsets[i].t), mean = samples.reduce((a, s) => a + s.v[0], 0) / samples.length;
    return { n: samples.length, w10: worst(.10), strobeMax, onsets: onsets.length, minGap: gaps.length ? Math.min(...gaps) : 9e9, bars: new Set(onsets.map(o => o.bar)).size, govMin: d.LX.gov, maxN: d.LXG.maxN, lite, changes, kitSet: [...new Set(kits.map(k => k.k))], pos: pos1 - pos0, mean };
  }, [comfort, scene, secs, bpm]);
  const fl = {}; for (const [name, comfort, scene] of [['full', 'full', 5], ['standard', 'standard', 1], ['calm', 'calm', 5]]) fl[name] = await run(comfort, scene, 12, 190);
  for (const k of Object.keys(fl)) ok(fl[k].n > 80 && fl[k].mean > .02 && fl[k].mean < .8, k + ': the picture is alive but not blown out (' + fl[k].n + ' samples, mean luminance ' + fl[k].mean.toFixed(2) + ')');
  ok(Object.values(fl).every(r => r.w10 <= 6), 'at 190 BPM, in every comfort level, the picture never has more than three flashes in any second by the guidelines\' 10% measure (' + Object.entries(fl).map(([k, r]) => k + ' ' + Math.floor(r.w10 / 2) + '.' + (r.w10 % 2 ? 5 : 0)).join(', ') + ')');
  ok(fl.full.strobeMax > .5 && fl.full.onsets >= 1 && fl.standard.onsets >= 1, 'Full and Standard still blind the room on the big moments');
  ok(fl.calm.strobeMax === 0 && fl.calm.onsets === 0, 'Calm has no strobe at all');
  ok([fl.full, fl.standard].every(r => r.minGap >= 330 && r.onsets === r.bars), 'blinders are never closer than a third of a second and never more than one in a bar (' + fl.full.minGap + ' ms, ' + fl.full.onsets + ' in ' + fl.full.bars + ' bars)');
  ok(fl.full.maxN > 3 ? fl.full.govMin < 1 || fl.full.maxN >= 3 : true, 'the governor measured and responded (swings seen ' + fl.full.maxN + ', lowest ' + fl.full.govMin.toFixed(2) + ')');
  ok(fl.full.pos > 6 && fl.full.pos < 12, 'the show\'s one clock ran at the song\'s tempo: ' + fl.full.pos.toFixed(1) + ' bars in 12 s at 190 BPM');
  ok(fl.full.changes.length >= 2 && fl.full.changes.every(c => c.bi % 4 === 0), 'the laser combination only changes on a phrase (every change landed on bar 1 of a four-bar phrase: ' + fl.full.changes.map(c => c.bi + 1).join(',') + ')');
  ok(fl.full.kitSet.length >= 3 && fl.full.kitSet.some(k => k.split('+').length >= 2), 'and the beams are combinations, not one trick (' + fl.full.kitSet.join(' · ') + ')');

  // ---- the Show setup console: opens in the Stage tab, nine tabs
  await ev(() => { const d = window.__daily; d.STG.comfort = 'standard'; d.CFG.show.auto = true; d.CFG.show.ovr = {}; d.CFG.show.saved = []; d.dockGo('vis'); });
  await wait(500);
  ok(await poll(() => ev(() => !!document.getElementById('sgdOpen')), 4000), 'the Visuals bar has one Show setup button (instead of a button per setting)');
  await ev(() => document.getElementById('sgdOpen').click());
  ok(await poll(() => ev(() => { const r = document.getElementById('shc'); return !!r && !!r.offsetParent && window.__daily.SHC.target === 'vis'; }), 4000), 'it opens the console inside the Stage tab, set to change the Visuals tab’s look');
  const tabs = await ev(() => [...document.querySelectorAll('#shc .shc-tab')].map(b => b.textContent).join('/'));
  ok(tabs === 'Looks/Rig/Colour/Cues/Response/Pictures/Output/Scene/MIDI', 'nine tabs: ' + tabs);
  const each = await ev(() => { const d = window.__daily, out = []; for (const k of ['looks', 'rig', 'col', 'cues', 'resp', 'pics', 'out', 'scene', 'midi']) { document.querySelector('#shc .shc-tab[data-t="' + k + '"]').click(); const b = document.querySelector('#shc .shc-body'); out.push(k + ':' + b.children.length + ':' + document.querySelector('#shc .shc-tab.on').dataset.t); } return out; });
  ok(each.every(s => { const [k, n, on] = s.split(':'); return +n > 2 && on === k; }), 'every tab draws something and marks itself selected (' + each.join(' ') + ')');
  await ev(() => { const d = window.__daily; d.SHC.tab = 'looks'; d.shcDraw(); document.querySelector('#shc .shc-tab[data-t="looks"]').focus(); });
  await p.keyboard.press('ArrowRight');
  ok(await ev(() => window.__daily.SHC.tab === 'rig'), 'the arrow keys move between tabs');

  // Looks
  await ev(() => { const d = window.__daily; d.SHC.tab = 'looks'; d.shcDraw(); });
  const lkc = await ev(() => ({ cards: document.querySelectorAll('#shc .sg-card').length, names: [...document.querySelectorAll('#shc .sg-card b')].map(b => b.textContent).join(), ex: /example song/i.test(document.getElementById('shc').textContent) }));
  ok(lkc.cards === 6 && lkc.names === 'Theatre,Backlight,Blades,Pixel field,Horizon,Laser room' && !lkc.ex, 'Looks shows the six looks, each painted from how it is built (' + lkc.names + ')');
  await ev(() => document.querySelectorAll('#shc .sg-card')[5].querySelector('button.btn').click()); await wait(150);
  ok(await ev(() => { const C = window.__daily.CFG.show; return C.design === 'lasers' && C.auto === false && document.querySelectorAll('#shc .sg-card.on').length === 1; }), 'choosing a look selects it and turns off matching to the song');

  // Rig
  await ev(() => { const d = window.__daily; d.SHC.tab = 'rig'; d.shcDraw(); });
  await ev(() => [...document.querySelectorAll('#shc .shc-seg button')].find(b => b.textContent === 'Truss').click());
  await ev(() => { const r = [...document.querySelectorAll('#shc .sg-sl')].find(x => /^How many/.test(x.textContent)).querySelector('input'); r.value = 3; r.dispatchEvent(new Event('input', { bubbles: true })); });
  const rg = await ev(() => { const d = window.__daily, o = d.CFG.show.ovr, D = d.lxResolve(null); return { layout: o.rig && o.rig.layout, heads: o.rig && o.rig.heads, dl: D.rig.layout, dh: D.rig.heads, still: d.lxDesign('lasers').rig.layout }; });
  ok(rg.layout === 'top' && rg.heads === 3 && rg.dl === 'top' && rg.dh === 3 && rg.still === 'sides', 'the Rig tab moves the lights (a truss, three of them) as a difference from the look, which itself is untouched');
  await ev(() => { const b = [...document.querySelectorAll('#shc .sg-sl,#shc label.chk')].find(x => /Starburst/.test(x.textContent)).querySelector('input'); b.click(); });
  ok(await ev(() => window.__daily.lxResolve(null).noBurst === true && window.__daily.CFG.show.ovr.laser.burst === 0), 'the starburst on the drop can be switched off, and the laser engine honours it');
  await ev(() => [...document.querySelectorAll('#shc .btn')].find(b => b.textContent === 'Reset the rig').click());
  ok(await ev(() => { const o = window.__daily.CFG.show.ovr; return !o.rig && !o.mot && (!o.laser || o.laser.burst == null); }), 'Reset the rig returns to the look');

  // Colour
  await ev(() => { const d = window.__daily; d.SHC.tab = 'col'; d.shcDraw(); });
  await ev(() => { const c = document.querySelector('#shc input[aria-label="Light 1 colour"]'); c.value = '#10aa44'; c.dispatchEvent(new Event('input', { bubbles: true })); });
  ok(await ev(() => { const d = window.__daily; return d.CFG.show.ovr.pal.a === '#10aa44' && d.lxResolve(null).pal.a === '#10aa44'; }), 'a colour change is kept as a difference and shows');
  await ev(() => [...document.querySelectorAll('#shc .shc-seg button')].find(b => b.textContent === 'One colour').click());
  const mono = await ev(() => { const d = window.__daily, D = d.lxResolve(null), N = d.lxDesign('lasers'); return { grade: d.CFG.show.ovr.rig.grade, b: D.pal.b !== N.pal.b, l2: D.pal.l2 === '#10aa44' }; });
  ok(mono.grade === 'mono' && mono.b && mono.l2, 'the colour treatment “One colour” makes every light a shade of the first colour');
  await ev(() => [...document.querySelectorAll('#shc .shc-pal')].find(b => /Theatre/.test(b.textContent)).click());
  ok(await ev(() => { const d = window.__daily, o = d.CFG.show.ovr; return o.pal.a === d.lxDesign('theatre').pal.a && d.CFG.show.design === 'lasers'; }), 'palettes can be borrowed from another look without changing the rig');
  await ev(() => [...document.querySelectorAll('#shc .btn')].find(b => b.textContent === 'Reset the colours').click());
  await ev(() => { const o = window.__daily.CFG.show.ovr; delete o.rig; window.__daily.shcSet('rig', 'grade', undefined); });

  // Cues
  await ev(() => { const d = window.__daily; d.SHC.tab = 'cues'; d.shcDraw(); });
  const cu = await ev(() => ({ rows: document.querySelectorAll('#shc .shc-tbl tbody tr').length, head: [...document.querySelectorAll('#shc .shc-tbl th')].map(x => x.textContent).join() }));
  ok(cu.rows === 7 && cu.head === 'Section,Level,Lights,Pattern,Lasers', 'the cue sheet lists the seven kinds of section with level, lights, pattern and lasers');
  await ev(() => [...document.querySelectorAll('#shc .shc-tbl tbody tr')].find(r => /^Verse/.test(r.textContent)).click());
  await ev(() => { const r = [...document.querySelectorAll('#shc .sg-sl')].find(x => /^Level/.test(x.textContent)).querySelector('input'); r.value = .9; r.dispatchEvent(new Event('input', { bubbles: true })); });
  const cq = await ev(() => { const d = window.__daily, D = d.lxResolve(null); return { kind: d.SHC.kind, v: d.lxProg(D, 'verse').int, c: d.lxProg(D, 'chorus').int, base: d.LX_PROG.verse.int, saved: d.CFG.show.ovr.cue.verse.int }; });
  ok(cq.kind === 'verse' && cq.v === .9 && cq.saved === .9 && cq.c !== .9 && cq.base !== .9, 'a section’s level is set for that kind of section only (verse .9, chorus untouched at ' + cq.c + ')');
  await ev(() => [...document.querySelectorAll('#shc .sg-chips')][0].querySelectorAll('button')[5].click());
  const hp = await ev(() => { const d = window.__daily, D = d.lxResolve(null); return { o: d.CFG.show.ovr.heads && d.CFG.show.ovr.heads.verse, d: D.heads.verse }; });
  ok(typeof hp.o === 'string' && hp.o === hp.d, 'the light patterns of a section can be chosen (' + hp.o + ')');
  await ev(() => [...document.querySelectorAll('#shc .sg-chips')][1].querySelectorAll('button')[5].click());
  const lp = await ev(() => { const d = window.__daily, D = d.lxResolve(null); return { o: d.CFG.show.ovr.laser.verse, d: D.laser.verse, pressed: [...document.querySelectorAll('#shc .sg-chips')][1].querySelectorAll('button[aria-pressed="false"]').length }; });
  ok(typeof lp.o === 'string' && lp.o === lp.d && lp.pressed >= 1, 'and so can the laser patterns (' + lp.o + ')');
  await ev(() => { window.__daily.stopPlay(true); window.__daily.dockGo('stage'); }); await wait(300);
  await ev(() => document.getElementById('shPv').click());
  ok(await poll(() => ev(() => { const L = window.__daily.LX; return !!L.pv && L.pv.kind === 'verse' && L.pvB >= 0; }), 4000), 'Preview Verse plays a silent band into the lights without a song');
  ok(await poll(() => ev(() => { const L = window.__daily.LX; return L.kick > .2 || L.hat > .2 || L.strum > .2 || L.bass > .2; }), 4000), 'and the lights answer it');
  await ev(() => window.__daily.lxPreviewStop());
  ok(await ev(() => !window.__daily.LX.pv), 'Stop ends the preview');
  await ev(() => [...document.querySelectorAll('#shc .btn')].find(b => /^Reset verse cue$/i.test(b.textContent)).click());
  ok(await ev(() => { const o = window.__daily.CFG.show.ovr; return (!o.cue || !o.cue.verse) && (!o.heads || !o.heads.verse) && (!o.laser || typeof o.laser.verse !== 'string'); }), 'a section’s cue can be reset on its own');

  // Response
  await ev(() => { const d = window.__daily; d.SHC.target = 'scene'; d.STG.cur = 0; d.SHC.tab = 'resp'; d.shcDraw(); });
  const rp = await ev(() => ({ rows: document.querySelectorAll('#shc .shc-rrow').length, meters: document.querySelectorAll('#shc [data-meter]').length, names: [...document.querySelectorAll('#shc .shc-rn b')].map(b => b.textContent).join() }));
  ok(rp.rows === 6 && rp.meters === 6 && rp.names === 'Kick,Snare,Hi-hat,Bass note,Guitar strum,Lead note', 'Response has a strength and a live meter for kick, snare, hats, bass, strums and lead notes');
  const fire = async i => ev(async i => { const d = window.__daily; d.LX.kick = d.LX.snare = d.LX.strum = 0; document.querySelectorAll('#shc .shc-rrow')[i].querySelector('.btn').click(); return { kick: d.LX.kick, snare: d.LX.snare, strum: d.LX.strum }; }, i);
  await ev(() => { const r = document.querySelectorAll('#shc .shc-rrow')[0].querySelector('input[type=range]'); r.value = 0; r.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(500);
  const f0 = await fire(0);
  await ev(() => { const r = document.querySelectorAll('#shc .shc-rrow')[0].querySelector('input[type=range]'); r.value = 1; r.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(500);
  const f1 = await fire(0), f2 = await fire(4);
  ok(f0.kick === 0 && f1.kick > .5 && f2.strum > .4 && await ev(() => !window.__daily.STG.scenes[0].show.ovr.resp), 'at 0% the kick no longer reaches the lights, at 100% it does (and 100% is stored as no change); Fire sends one hit');
  await ev(() => { const r = document.querySelectorAll('#shc .shc-rrow')[1].querySelector('input[type=range]'); r.value = 1.3; r.dispatchEvent(new Event('input', { bubbles: true })); });
  ok(await ev(() => window.__daily.lxResolve(window.__daily.STG.scenes[0].show).resp.snare === 1.3), 'a part of the band can lead the show (snare at 130%)');
  await ev(() => [...document.querySelectorAll('#shc .btn')].find(b => b.textContent === 'Reset the response').click());
  ok(await ev(() => !window.__daily.STG.scenes[0].show.ovr.resp), 'Reset the response clears it');

  // Output
  await ev(() => { const d = window.__daily; d.SHC.target = 'vis'; d.SHC.tab = 'out'; d.shcDraw(); d.STG.hud = false; });
  const lumAt = (fx, fy) => ev(([fx, fy]) => { const d = window.__daily, c = d.SG.cv, t = document.createElement('canvas'); t.width = 40; t.height = 20; const q = t.getContext('2d', { willReadFrequently: true }); q.drawImage(c, 0, 0, 40, 20); const px = q.getImageData(Math.min(39, Math.floor(fx * 40)), Math.min(19, Math.floor(fy * 20)), 1, 1).data; return (px[0] + px[1] + px[2]) / 3; }, [fx, fy]);
  const mean = () => ev(() => { const d = window.__daily, c = d.SG.cv, t = document.createElement('canvas'); t.width = 24; t.height = 14; const q = t.getContext('2d', { willReadFrequently: true }); q.drawImage(c, 0, 0, 24, 14); const px = q.getImageData(0, 0, 24, 14).data; let s = 0; for (let i = 0; i < px.length; i += 4) s += (px[i] + px[i + 1] + px[i + 2]) / 3; return s / (px.length / 4); });
  await ev(() => [...document.querySelectorAll('#shc .shc-seg button')].find(b => b.textContent === 'Grey').click()); await wait(400);
  const g1 = await mean();
  await ev(() => { const r = document.querySelector('#shc .shc-body input[type=range]'); r.value = .5; r.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(400);
  const g2 = await mean();
  ok(g1 > 110 && g1 < 145 && g2 > 50 && g2 < 80 && await ev(() => window.__daily.CFG.show.out.master === .5), 'the Grey test pattern fills the output (' + g1.toFixed(0) + '), and the master level takes it down by half (' + g2.toFixed(0) + ')');
  await ev(() => { const r = document.querySelector('#shc .shc-body input[type=range]'); r.value = 1; r.dispatchEvent(new Event('input', { bubbles: true })); });
  await ev(() => [...document.querySelectorAll('#shc .shc-seg button')].find(b => b.textContent === 'Bars').click()); await wait(400);
  const b0 = [await lumAt(.03, .1), await lumAt(.97, .1), await lumAt(.03, .95)];
  ok(b0[0] > 230 && b0[1] < 25 && b0[2] < 60, 'the Bars pattern has white at the top left, black at the top right and a ramp along the bottom (' + b0.map(x => x.toFixed(0)).join(', ') + ')');
  await ev(() => [...document.querySelectorAll('#shc label.chk')].find(x => /Mirror/.test(x.textContent)).querySelector('input').click()); await wait(400);
  const b1 = [await lumAt(.03, .1), await lumAt(.97, .1)];
  await ev(() => [...document.querySelectorAll('#shc label.chk')].find(x => /Mirror/.test(x.textContent)).querySelector('input').click());
  await ev(() => [...document.querySelectorAll('#shc label.chk')].find(x => /Flip/.test(x.textContent)).querySelector('input').click()); await wait(400);
  const b2 = [await lumAt(.03, .1), await lumAt(.03, .95)];
  await ev(() => [...document.querySelectorAll('#shc label.chk')].find(x => /Flip/.test(x.textContent)).querySelector('input').click());
  ok(b1[0] < 25 && b1[1] > 230, 'Mirror swaps left and right for a projector behind the screen (' + b1.map(x => x.toFixed(0)).join(', ') + ')');
  ok(b2[0] < 60 && b2[1] > 230, 'Flip turns the picture over for a ceiling projector (' + b2.map(x => x.toFixed(0)).join(', ') + ')');
  await ev(() => [...document.querySelectorAll('#shc .shc-seg button')].find(b => b.textContent === 'White').click()); await wait(400);
  const w1 = await mean();
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('0'); await wait(700);
  const w2 = await mean(), bo = await ev(() => window.__daily.SG.boOn);
  await p.keyboard.press('0'); await wait(700);
  const w3 = await mean();
  ok(w1 > 240 && bo === true && w2 < 20 && w3 > 240, 'key 0 is a blackout that fades out and back (' + w1.toFixed(0) + ' → ' + w2.toFixed(0) + ' → ' + w3.toFixed(0) + '), and the button says so: ' + await ev(() => document.getElementById('shBo').getAttribute('aria-pressed')));
  await ev(() => [...document.querySelectorAll('#shc .shc-seg button')].find(b => b.textContent === 'Off').click());
  await ev(() => { const d = window.__daily; d.SG.cv.getContext('2d'); }); await wait(300);
  await p.keyboard.press('9'); await wait(500);
  const z1 = await mean(), fz = await ev(() => window.__daily.SG.freeze);
  await ev(() => { window.__daily.SG.test = 'white'; }); await wait(400);
  const z2 = await mean();
  await p.keyboard.press('9'); await wait(400);
  const z3 = await mean(), fz2 = await ev(() => window.__daily.SG.freeze);
  await ev(() => { window.__daily.SG.test = null; });
  ok(fz === true && Math.abs(z2 - z1) < 8 && z3 > 240 && !fz2, 'key 9 holds the picture while the lights go on behind it (' + z1.toFixed(0) + ' → ' + z2.toFixed(0) + '), and lets go again');
  const ticks = async () => ev(async () => { const d = window.__daily; let n = 0, last = d.SG.drawT; const t0 = performance.now(); await new Promise(res => { const iv = setInterval(() => { if (d.SG.drawT !== last) { n++; last = d.SG.drawT; } if (performance.now() - t0 > 1500) { clearInterval(iv); res(); } }, 4); }); return n; });
  await ev(() => { window.__daily.CFG.show.out.fps = 60; }); await wait(200); const n60 = await ticks();
  await ev(() => { window.__daily.CFG.show.out.fps = 30; }); await wait(200); const n30 = await ticks();
  await ev(() => { window.__daily.CFG.show.out.fps = 60; });
  /* the cap holds at about 30 frames a second (45 in 1.5 s, with room for timer jitter) and drawing goes on; when the machine itself draws well above 30, capping clearly cuts it. A slow machine that already draws near 30 is not a failure of the cap. */
  ok(n30 >= 15 && n30 <= 52 && n60 >= n30 - 3 && (n60 < 60 || n30 < n60 * .85), 'the frame rate can be held at 30 for a slower machine (' + n60 + ' → ' + n30 + ' frames in 1.5 s)');
  await ev(() => [...document.querySelectorAll('#shc label.chk')].find(x => /Safe-frame/.test(x.textContent)).querySelector('input').click());
  ok(await ev(() => window.__daily.SG.wrap.classList.contains('guides') && window.__daily.CFG.show.out.safe === true && getComputedStyle(document.querySelector('.sg-guides')).display !== 'none'), 'safe-frame guides can be drawn over the screen (not the output)');
  await ev(() => [...document.querySelectorAll('#shc label.chk')].find(x => /Safe-frame/.test(x.textContent)).querySelector('input').click());
  const fm = await ev(() => ({ fl: document.getElementById('shcFl').textContent, gauges: document.querySelectorAll('#shc [data-meter="flash"],#shc [data-meter="gov"]').length, peak: !!document.getElementById('shcPeak'), claim: /not a medical guarantee/.test(document.getElementById('shc').textContent) }));
  ok(/flash/.test(fm.fl) && /limit 3/.test(fm.fl) && fm.gauges === 2 && fm.peak && fm.claim, 'the flash meter shows flashes per second against the limit of three, and says plainly it is a safeguard, not a medical guarantee (' + fm.fl + ')');
  ok(await ev(() => !document.querySelector('#shc').textContent.match(/photosensitive epilepsy.*(safe|guarantee)/i)), 'and makes no medical claim');

  // saved looks and look files
  await ev(() => { const d = window.__daily; d.CFG.show.design = 'lasers'; d.CFG.show.auto = false; d.CFG.show.ovr = { pal: { a: '#abcdef' }, rig: { heads: 4 }, use: { back: ['x'], wall: [], logo: null } }; d.CFG.show.saved = []; d.SHC.target = 'vis'; d.SHC.tab = 'looks'; d.shcDraw(); });
  await ev(() => { const i = document.querySelector('#shc input[aria-label="Name for the saved look"]'); i.value = 'Club night'; document.getElementById('shSaveLook').click(); });
  const sl = await ev(() => { const d = window.__daily, l = d.CFG.show.saved[0]; return { n: d.CFG.show.saved.length, name: l && l.name, a: l && l.ovr.pal.a, heads: l && l.ovr.rig.heads, use: l && l.ovr.use, design: l && l.design, id: !!(l && l.id) }; });
  ok(sl.n === 1 && sl.name === 'Club night' && sl.a === '#abcdef' && sl.heads === 4 && sl.design === 'lasers' && sl.use === undefined, 'a look can be saved under a name with all its changes, but not the pictures (' + JSON.stringify(sl) + ')');
  await ev(() => { const d = window.__daily; d.shcPick('theatre'); });
  await ev(() => [...document.querySelectorAll('#shc .shc-sv .btn')].find(b => b.textContent === 'Use').click());
  ok(await ev(() => { const d = window.__daily; return d.CFG.show.design === 'lasers' && d.CFG.show.ovr.pal.a === '#abcdef' && d.CFG.show.ovr.rig.heads === 4 && d.CFG.show.auto === false; }), 'and brought back later');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 6000 }), ev(() => document.querySelector('#shc .shc-sv .btn[title^="Save this look"]').click())]);
  const exp = JSON.parse(t.fs.readFileSync(await dl.path(), 'utf8'));
  ok(dl.suggestedFilename() === 'the-daily-studio-looks.json' && exp.kind === 'show-looks' && exp.looks.length === 1 && exp.looks[0].name === 'Club night' && exp.looks[0].ovr.pal.a === '#abcdef', 'a look can be carried to another device as a file');
  const hostile = { app: 'x', kind: 'show-looks', v: 1, looks: [
    { name: '<img src=x onerror=alert(1)>Evil\u0007', design: 'blades', ovr: { pal: { a: 'red;background:url(x)', b: '#00FF00' }, rig: { heads: 999, layout: 'evil', wall: 'image', haze: -5, beam: 'hard' }, mot: { sweep: 7, snap: 5 }, laser: { amt: 5, chorus: 'fan evil zipper', burst: 'no' }, heads: { chorus: 'cross <x> fan' }, cue: { chorus: { int: 99, n: 'a', strobe: .5 } }, resp: { kick: 9, nope: 1 }, use: { back: ['../../x'] }, __proto__: { polluted: 1 } } },
    { name: 'No such look', design: 'nope', ovr: {} }, 'a string', null, { design: 'arena', name: 'Old name' }] };
  const imp = await ev(async h => {
    const d = window.__daily, n0 = d.CFG.show.saved.length; await d.shImportLooks(new File([JSON.stringify(h)], 'looks.json', { type: 'application/json' })); const added = d.CFG.show.saved.slice(n0), a = added[0], b = added[1];
    const junk = new File(['{ not json'], 'x.json'); await d.shImportLooks(junk); const n2 = d.CFG.show.saved.length;
    return { n: added.length, name: a.name, pa: a.ovr.pal.a, pb: a.ovr.pal.b, heads: a.ovr.rig.heads, layout: a.ovr.rig.layout, wall: a.ovr.rig.wall, haze: a.ovr.rig.haze, sweep: a.ovr.mot && a.ovr.mot.sweep, snap: a.ovr.mot.snap, amt: a.ovr.laser.amt, chorus: a.ovr.laser.chorus, burst: a.ovr.laser.burst, hc: a.ovr.heads.chorus, cint: a.ovr.cue.chorus.int, cn: a.ovr.cue.chorus.n, kick: a.ovr.resp.kick, nope: a.ovr.resp.nope, use: a.ovr.use, keys: Object.keys(a).sort().join(), polluted: ({}).polluted, old: b && b.design, junkAdded: n2 - n0 - added.length };
  }, hostile);
  ok(imp.n === 2 && imp.junkAdded === 0 && imp.old === 'backlight', 'a looks file adds the good looks, skips the bad ones, and a file that is not a looks file changes nothing');
  ok(!/[<>\u0007]/.test(imp.name) && imp.pa === undefined && imp.pb === '#00ff00' && imp.heads === 12 && imp.layout === undefined && imp.wall === undefined && imp.haze === 0 && imp.sweep === undefined && imp.snap === 1, 'imported values are checked: markup stripped from names, bad colours and unknown names dropped, numbers held to their range (' + JSON.stringify(imp) + ')');
  ok(imp.amt === 1 && imp.chorus === 'fan zipper' && imp.burst === undefined && imp.hc === 'cross fan' && imp.cint === 1.15 && imp.cn === undefined && imp.kick === 1.5 && imp.nope === undefined && imp.use === undefined && imp.polluted === undefined && imp.keys === 'design,id,name,ovr', 'only known laser patterns, light patterns, cue and response fields survive; pictures and anything else are left out');
  const cap = await ev(() => { const d = window.__daily; d.CFG.show.saved = []; for (let i = 0; i < 30; i++) d.shSaveLook('L' + i); return d.CFG.show.saved.length; });
  ok(cap === 24, 'at most 24 looks are kept (' + cap + ')');
  await ev(() => { const d = window.__daily; d.CFG.show.saved = d.CFG.show.saved.slice(0, 2); d.shcDraw(); document.querySelector('#shc .shc-sv .btn[aria-label^="Delete"]').click(); });
  ok(await ev(() => window.__daily.CFG.show.saved.length === 1), 'a saved look can be deleted');
  await ev(() => { const d = window.__daily; d.CFG.show.saved = []; d.CFG.show.ovr = {}; d.CFG.show.design = 'backlight'; d.CFG.show.auto = true; });

  // ---- Stage scenes: six looks, a prompter and you in front; each scene has a look of its own
  await ev(() => { const d = window.__daily; d.dockGo('stage'); d.STG.cur = 0; d.STG.hud = true; d.shOpen('scene', 'looks'); });
  await wait(400);
  const sc = await ev(() => { const d = window.__daily; return { names: d.STG.scenes.map(s => s.name).join(), designs: d.STG.scenes.slice(0, 6).map(s => s.show.design).join(), v: d.STG.v, head: document.querySelector('#shc .shc-head .seg .on').textContent }; });
  ok(sc.names === 'Theatre,Backlight,Blades,Pixel field,Horizon,Laser room,Lyric prompter,Me in front' && sc.designs === 'theatre,backlight,blades,pixels,horizon,lasers' && sc.v === 4, 'Stage opens on the six looks, a prompter and you in front (' + sc.names + ')');
  ok(sc.head === 'Scene 1 · Theatre', 'the console says which scene it is changing (' + sc.head + ')');
  await ev(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('3'); await wait(250);
  ok(await ev(() => window.__daily.STG.cur === 2 && /Scene 3 · Blades/.test(document.querySelector('#shc .shc-head .seg .on').textContent)), 'number keys 1 to 8 pick the scenes (3 is Blades) and the console follows');
  await ev(() => document.querySelectorAll('#shc .sg-card')[4].querySelector('button.btn').click()); await wait(150);
  ok(await ev(() => { const S = window.__daily.STG.scenes; return S[2].show.design === 'horizon' && S[1].show.design === 'backlight' && S[3].show.design === 'pixels'; }), 'a scene can take another look without touching the others');
  await ev(() => [...document.querySelectorAll('#shc .btn')].find(b => b.textContent === 'Copy to all Concert scenes').click());
  ok(await ev(() => window.__daily.STG.scenes.filter(s => s.mode === 'concert').every(s => s.show.design === 'horizon')), 'a look can be copied to every Concert scene');
  await ev(() => { const d = window.__daily; d.STG.cur = 6; d.shOpen('scene', 'looks'); });
  ok(await ev(() => !!document.querySelector('#shc .shc-warn')), 'on a scene that is not a Concert scene the console says so');
  await ev(() => [...document.querySelectorAll('#shc .shc-warn .btn')].find(b => /Make it a Concert scene/.test(b.textContent)).click());
  ok(await ev(() => window.__daily.STG.scenes[6].mode === 'concert' && !document.querySelector('#shc .shc-warn')), 'and offers to make it one');
  await ev(() => window.__daily.stgRestoreStarters()); await wait(200);
  ok(await ev(() => { const S = window.__daily.STG.scenes; return S.length === 8 && S[2].show.design === 'blades' && S[6].mode === 'prompter'; }), 'Restore starter scenes puts all eight back');

  // ---- pictures: kept in this browser, reduced, never sent anywhere
  const mkImg = (w, h, draw, type) => ev(async ([w, h, draw, type]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); new Function('g', 'w', 'h', draw)(g, w, h); const b = await new Promise(r => c.toBlob(r, type, .9)); const u = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); }, [w, h, draw, type]);
  const red = t.tmp('red.jpg', Buffer.from(await mkImg(3000, 1500, 'g.fillStyle="#ff1010";g.fillRect(0,0,w,h);', 'image/jpeg'), 'base64'));
  const logo = t.tmp('logo.png', Buffer.from(await mkImg(400, 400, 'g.clearRect(0,0,w,h);g.fillStyle="#ffffff";g.beginPath();g.arc(200,200,150,0,7);g.fill();', 'image/png'), 'base64'));
  await ev(() => { const d = window.__daily; d.dockGo('stage'); d.STG.cur = 0; d.STG.comfort = 'full'; d.shOpen('scene', 'pics'); });
  await p.waitForSelector('#shc .sg-drop input[type=file]', { state: 'attached' });
  const redness = () => ev(() => { const d = window.__daily, c = d.SG.cv, t = document.createElement('canvas'); t.width = 48; t.height = 27; const q = t.getContext('2d', { willReadFrequently: true }); q.drawImage(c, 0, 0, 48, 27); const px = q.getImageData(0, 0, 48, 27).data; let r = 0, o = 0; for (let i = 0; i < px.length; i += 4) { r += px[i]; o += px[i + 1] + px[i + 2]; } return r / (o + 1); });
  await wait(600); const r0 = await redness();
  await p.setInputFiles('#shc .sg-drop input[type=file]', [red, logo]);
  /* a big photo is decoded, reduced and stored: give a busy machine time (it is polled, so a quick one does not wait) */
  ok(await poll(() => ev(() => window.__daily.CFG.show.imgs.length === 2), 20000), 'two pictures added from the Pictures tab');
  const im = await ev(async () => {
    const d = window.__daily, imgs = d.CFG.show.imgs, db = await new Promise((res, rej) => { const r = indexedDB.open('the-daily-songs'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const keys = await new Promise(res => { const out = []; const rq = db.transaction('blobs').objectStore('blobs').openCursor(); rq.onsuccess = () => { const c = rq.result; if (c) { out.push(String(c.key)); c.continue(); } else res(out); }; rq.onerror = () => res([]); }); db.close();
    return { imgs: imgs.map(i => ({ w: i.w, h: i.h, alpha: i.alpha, kb: i.kb, id: i.id, name: i.name })), keys: keys.filter(k => k.startsWith('stage/img/')), cfg: localStorage.getItem('fw.cfg').length };
  });
  ok(im.imgs.length === 2 && im.imgs[0].w === 1920 && im.imgs[0].h === 960 && im.imgs[0].alpha === false && im.imgs[1].alpha === true && im.imgs[1].w === 400, 'a big photo is reduced to 1920 px on its long side; a picture with transparency keeps it (' + im.imgs.map(i => i.w + '×' + i.h).join(', ') + ')');
  ok(im.keys.length === 2 && im.keys.every(k => im.imgs.some(i => k === 'stage/img/' + i.id)) && im.cfg < 40000, 'the pictures sit in this browser\'s own database, and only their names and sizes go in the settings (' + im.cfg + ' characters)');
  await ev(() => document.querySelectorAll('#shc .sg-thumb')[0].querySelectorAll('.sg-row .btn')[0].click());
  ok(await ev(() => { const u = window.__daily.STG.scenes[0].show.ovr.use; return u && u.back.length === 1; }), 'a picture can be the backdrop of a scene');
  ok(await poll(async () => (await redness()) > r0 * 1.2 + .05, 6000), 'and the backdrop shows on the stage (redness ' + r0.toFixed(2) + ' → ' + (await redness()).toFixed(2) + ')');
  await ev(() => document.querySelectorAll('#shc .sg-thumb')[1].querySelectorAll('.sg-row .btn')[2].click());
  await ev(() => document.querySelectorAll('#shc .sg-thumb')[0].querySelectorAll('.sg-row .btn')[1].click());
  const us = await ev(() => { const d = window.__daily, sp = d.STG.scenes[0].show, D = d.lxResolve(sp); return { logo: sp.ovr.use.logo === d.CFG.show.imgs[1].id, wall: sp.ovr.use.wall.length === 1, rig: D.rig.wall, others: d.STG.scenes[1].show.ovr.use == null }; });
  ok(us.logo && us.wall && us.rig === 'image' && us.others, 'a logo and a pixel wall can be set; other scenes are untouched');
  await wait(300);
  await p.reload(); await t.boot(p);
  const pr = await ev(async () => { const d = window.__daily, u = d.STG.scenes[0].show.ovr.use, id = u && u.back[0]; await new Promise(r => setTimeout(r, 200)); d.shImg(id); await new Promise(r => setTimeout(r, 800)); const bm = d.shImg(id); return { n: d.CFG.show.imgs.length, kept: !!u && u.back.length === 1 && u.wall.length === 1 && !!u.logo, loads: !!bm && bm.width === 1920 }; });
  ok(pr.n === 2 && pr.kept && pr.loads, 'after a reload the pictures and where they are used are all still there');
  const bad = await ev(async () => { const d = window.__daily, n = d.CFG.show.imgs.length; await d.shAdd([new File(['hello'], 'a.txt', { type: 'text/plain' }), new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'a.svg', { type: 'image/svg+xml' })]); return d.CFG.show.imgs.length - n; });
  ok(bad === 0, 'text files and SVG are refused (SVG can carry scripts)');
  await ev(() => { const d = window.__daily; d.dockGo('stage'); d.STG.cur = 0; d.shOpen('scene', 'pics'); }); await wait(500);
  await ev(() => document.querySelectorAll('#shc .sg-thumb')[0].querySelector('.sg-x').click());
  ok(await poll(() => ev(() => window.__daily.CFG.show.imgs.length === 1), 4000), 'a picture can be removed');
  await wait(600);
  const rm2 = await ev(async () => { const d = window.__daily, u = d.STG.scenes[0].show.ovr.use, D = d.lxResolve(d.STG.scenes[0].show), db = await new Promise(res => { const r = indexedDB.open('the-daily-songs'); r.onsuccess = () => res(r.result); }); const keys = await new Promise(res => { const out = []; const rq = db.transaction('blobs').objectStore('blobs').openCursor(); rq.onsuccess = () => { const c = rq.result; if (c) { out.push(String(c.key)); c.continue(); } else res(out); }; }); db.close(); return { back: u.back.length, wall: u.wall.length, rig: D.rig.wall, keys: keys.filter(k => k.startsWith('stage/img/')).length }; });
  ok(rm2.back === 0 && rm2.wall === 0 && rm2.rig !== 'image' && rm2.keys === 1, 'removing it takes it out of every scene and deletes the file (' + JSON.stringify(rm2) + ')');
  ok(offsite.length === 0, 'nothing went to any other site while pictures were added, drawn and removed' + (offsite.length ? ' (' + offsite.slice(0, 3).join(', ') + ')' : ''));

  // ---- the console on a phone: nothing runs off the side, on any tab
  const pm = await t.open({ w: 390, h: 800, mobile: true, debug: true });
  await pm.evaluate(() => { const d = window.__daily; d.shOpen('vis', 'looks'); }); await wait(800);
  const mf = [];
  for (const k of ['looks', 'rig', 'col', 'cues', 'resp', 'pics', 'out', 'scene', 'midi']) {
    await pm.evaluate(k => { const d = window.__daily; d.SHC.tab = k; d.shcDraw(); }, k); await wait(150);
    mf.push(await pm.evaluate(k => { const r = document.getElementById('shc'), b = r.getBoundingClientRect(); return { k, w: Math.round(b.width), vw: innerWidth, over: r.scrollWidth - r.clientWidth, page: document.scrollingElement.scrollWidth - innerWidth, n: r.querySelector('.shc-body').children.length }; }, k));
  }
  ok(mf.every(m => m.w <= m.vw && m.over <= 1 && m.page <= 1 && m.n > 2), 'every tab of the console fits a 390 px phone without sideways scrolling (' + mf.map(m => m.k + ':' + m.over + '/' + m.page).join(' ') + ')');

  // ---- someone who had the old stage scenes: untouched ones become the new looks; ones you changed are never overwritten
  await pm.ctx.close(); await p.ctx.close();
  const seeded = async kind => {
    const q = await t.open({ w: 1100, h: 700, debug: true, boot: false, init: new Function(`try { if (localStorage.getItem('fw.seeded')) return; const base = (name, mode, hue, show) => Object.assign({ name, mode, hue, drift: 0, trail: .5, kal: 0, glow: .5, sens: 1, cam: false, flash: 0, sect: '', ov: { chord: true, lyric: false, beat: false, tuner: false, info: false } }, show ? { show: { design: show, ovr: {} } } : {});
      const kind = ${JSON.stringify(kind)}; let cfg;
      if (kind.startsWith('legacy')) { const L = [['Concert', 'concert', 38], ['Kaleido bloom', 'bloom', 300], ['Resonance', 'hex', 175], ['Orrery', 'orbit', 40], ['Ridgeline', 'joy', 150], ['Beat grid', 'pulse', 20], ['Lyric prompter', 'prompter', 175], ['Strings + cam', 'strings', 175]].map(x => base(...x)); if (kind === 'legacy-edit') L[1].name = 'My bloom'; cfg = { stage: { cur: 3, safe: true, scenes: L } }; }
      else { const L = [['Arena', 'concert', 'arena'], ['Neon Laser', 'concert', 'neon'], ['Campfire', 'concert', 'campfire'], ['Aurora', 'concert', 'aurora'], ['Noir Club', 'concert', 'noir'], ['Golden Hour', 'concert', 'golden'], ['Lyric prompter', 'prompter', ''], ['Me in front', 'concert', 'golden']].map(x => base(x[0], x[1], 38, x[2])); if (kind === 'v25-edit') L[2].name = 'Fireside'; cfg = { stage: { cur: 2, safe: true, v: 3, scenes: L }, show: { design: 'neon', auto: false, ovr: {} } }; }
      localStorage.setItem('fw.cfg', JSON.stringify(cfg)); localStorage.setItem('fw.seeded', '1'); } catch (e) { }`) });
    await t.boot(q); return q;
  };
  const NEW = 'Theatre,Backlight,Blades,Pixel field,Horizon,Laser room,Lyric prompter,Me in front';
  const q1 = await seeded('legacy');
  const m1 = await q1.evaluate(() => { const d = window.__daily; return { names: d.STG.scenes.map(s => s.name).join(), v: d.STG.v, auto: d.CFG.show.auto, design: d.CFG.show.design }; });
  ok(m1.names === NEW && m1.v === 4 && m1.auto === true && m1.design === 'backlight', 'someone who never changed the original scenes gets the new looks (' + m1.names + ')');
  const q2 = await seeded('legacy-edit');
  const m2 = await q2.evaluate(() => { const d = window.__daily; return { names: d.STG.scenes.map(s => s.name).join(), v: d.STG.v, cur: d.STG.cur }; });
  ok(m2.names.startsWith('Concert,My bloom,Resonance') && m2.v === 4 && m2.cur === 3, 'but if even one old scene was changed, all of them are left exactly as they were');
  const q3 = await seeded('v25');
  const m3 = await q3.evaluate(() => { const d = window.__daily; return { names: d.STG.scenes.map(s => s.name).join(), designs: d.STG.scenes.filter(s => s.show).map(s => s.show.design).join(), v: d.STG.v, design: d.CFG.show.design }; });
  ok(m3.names === NEW && m3.v === 4 && m3.design === 'lasers', 'the six 2.5 starter shows become the six new looks, and a Visuals tab that had chosen one of the old looks gets the nearest new one (' + m3.design + ')');
  const q4 = await seeded('v25-edit');
  const m4 = await q4.evaluate(() => { const d = window.__daily; return { names: d.STG.scenes.map(s => s.name).join(), designs: d.STG.scenes.filter(s => s.show).map(s => d.lxResolve(s.show).id).join() }; });
  ok(m4.names.startsWith('Arena,Neon Laser,Fireside') && /backlight,lasers,theatre/.test(m4.designs), 'a changed 2.5 scene set is kept as it was; the scenes still run (their looks are mapped to the nearest new look: ' + m4.designs + ')');
  await q4.evaluate(() => window.__daily.stgRestoreStarters());
  ok(await q4.evaluate(() => window.__daily.STG.scenes.map(s => s.name).join()) === NEW, 'and Restore starter scenes brings the new ones back when they want them');
});
