/* The Visual Instrument (2.77): the Visuals are five families of worlds with one design drawer. With every dial at its default the original hexagon
   drawing is used, and the reshapeable lattice draws exactly the same picture; the shapes, the three layouts of pitch, glow, trails and mirror are read
   from pixels; designs save, apply and delete; Soundprint's controls open with it; and every world still draws with Finish switched on. */
const { suite } = require('./lib.cjs');
suite('e2e-design', async t => {
  const { ok, wait } = t, p = await t.open({ w: 1400, h: 860, debug: true }), ev = (f, a) => p.evaluate(f, a);
  await ev(() => window.__daily.dockGo('vis')); await wait(900);
  // ---- the picker
  const P = await ev(() => { const D = window.__daily, ids = [...document.querySelectorAll('#vzLooks [data-m]')].map(b => b.dataset.m), want = new Set(D.VMODES.filter(m => !['spectro', 'chroma', 'scope'].includes(m[0])).map(m => m[0]).concat(D.VBACK.map(m => m[0])));
    return { ids, dup: ids.length !== new Set(ids).size, missing: [...want].filter(k => !ids.includes(k)), fams: [...document.querySelectorAll('#vzLooks .vz-fam')].map(f => f.querySelector('h6').textContent + ':' + f.querySelectorAll('[data-m]').length), says: [...document.querySelectorAll('#vzLooks .vz-fam p')].length }; });
  ok(P.fams.length === 5 && !P.dup && P.missing.length === 0, 'the looks are five families, every look kept once (' + P.fams.join(', ') + '); missing: ' + (P.missing.join() || 'none'));
  ok(P.says === 5, 'each family says what it shows you');
  const bar = await ev(() => [...document.querySelectorAll('#pane-vis .vz-bar > *')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 60).map(e => (e.textContent || '').trim()).filter(Boolean).join('|'));
  ok(/Hex Resonance/.test(bar) && /Design/.test(bar) && /Record/.test(bar) && /Go on stage/.test(bar) && /Stage mode/.test(bar) && !/Hexagons/.test(bar), 'the bar is one clean row: the world, Design, Record, Go on stage, Stage mode, More (' + bar + ')');
  await p.click('#vzLookBtn'); await p.click('#vzLooks [data-m="life"]'); await wait(200);
  ok(await ev(() => window.__daily.VZ.mode === 'life' && /Life/.test(document.getElementById('vzLookBtn').textContent)), 'choosing a world changes the picture and the World button');
  await ev(() => window.__daily.vzSetMode('hex'));
  // ---- the original is untouched
  const same = await ev(() => { const D = window.__daily, pn = performance.now; performance.now = () => 1000;
    const mk = () => { const c = document.createElement('canvas'); c.width = 480; c.height = 300; return c; }, fd = new Float32Array(1024).map((_, i) => -90 + 55 * Math.exp(-i / 60) * (1 + Math.sin(i / 3) * .3)), lvl = d => Math.max(0, Math.min(1, (d + 90) / 60)), C = { a: '#3ddc84', b: '#f2b632' }, P0 = D.hexPal(true);
    D.CFG.vd = {}; const a = mk(), b = mk(); D.VZ.sm = null; D.drawHex(a.getContext('2d'), 480, 300, fd, 43, lvl, C, .3, P0); D.VZ.sm = null; D.drawLattice(b.getContext('2d'), 480, 300, fd, 43, lvl, C, .3, P0);
    const x = a.getContext('2d').getImageData(0, 0, 480, 300).data, y = b.getContext('2d').getImageData(0, 0, 480, 300).data; let n = 0, mx = 0; for (let i = 0; i < x.length; i++) { const d = Math.abs(x[i] - y[i]); if (d > 2) n++; if (d > mx) mx = d; } performance.now = pn; return { n, mx, def: D.vdShapeDefault() }; });
  ok(same.def && same.n === 0, 'with every dial at its default the lattice draws exactly what the original hexagon field draws (' + same.n + ' pixels differ, at most ' + same.mx + ')');
  // ---- shapes, layouts
  const R = await ev(() => { const D = window.__daily, pn = performance.now; performance.now = () => 1000;
    const fd = new Float32Array(1024).fill(-120), low = new Float32Array(1024).fill(-120); for (let i = 1; i < 12; i++) low[i] = -30; for (let i = 0; i < 1024; i++) fd[i] = -90 + 55 * Math.exp(-i / 60);
    const lvl = d => Math.max(0, Math.min(1, (d + 90) / 60)), C = { a: '#3ddc84', b: '#f2b632' }, P0 = D.hexPal(true), draw = (o, f, extra) => { D.CFG.vd = o; D.VZ.sm = null; if (extra) extra(); const c = document.createElement('canvas'); c.width = 480; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#04090a'; g.fillRect(0, 0, 480, 300); D.drawLattice(g, 480, 300, f || fd, 43, lvl, C, .2, P0); return c; };
    const hash = c => { const d = c.getContext('2d').getImageData(0, 0, 480, 300).data; let s = 0; for (let i = 0; i < d.length; i += 17) s = (s * 31 + d[i]) | 0; return s; }, half = (c, left) => { const d = c.getContext('2d').getImageData(left ? 0 : 240, 0, 240, 300).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i + 1]; return s; };
    const out = { base: hash(draw({})) }; ['square', 'tri', 'dot'].forEach(s => { out[s] = hash(draw({ shape: s })); }); out.round = hash(draw({ round: .8 })); out.gap = hash(draw({ gap: .6 })); out.turn = hash(draw({ twist: 30 })); out.fifths = hash(draw({ layout: 'fifths' }));
    D.AN.active = true; D.AN.midi = 69; const f1 = hash(draw({ layout: 'fifths' })); D.AN.midi = 66; const f2 = hash(draw({ layout: 'fifths' })); D.AN.active = false; out.own = f1 !== f2;
    const sw = draw({ layout: 'sweep' }, low); out.sweepL = half(sw, true); out.sweepR = half(sw, false); out.sens = hash(draw({ sens: 2 })); performance.now = pn; D.CFG.vd = {}; return out; });
  ok(['square', 'tri', 'dot', 'round', 'gap', 'turn', 'fifths'].every(k => R[k] !== R.base), 'every shape and dial changes the picture (hexagon, square, triangle, dot, roundness, spacing, turn, the circle of fifths)');
  ok(R.own, 'in the circle-of-fifths layout the note you sing lights its own spoke (a different note, a different picture)');
  ok(R.sweepL > R.sweepR * 1.5, 'in the sweep layout bass lights the left and not the right (' + R.sweepL + ' against ' + R.sweepR + ')');
  // ---- Finish
  const F = await ev(() => { const D = window.__daily, mk = () => { const c = document.createElement('canvas'); c.width = 400; c.height = 240; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 400, 240); g.fillStyle = '#ff8844'; g.fillRect(250, 40, 60, 50); g.fillStyle = '#44aaff'; g.fillRect(90, 150, 40, 40); return c; };
    const px = (c, x, y) => { const d = c.getContext('2d').getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; }, lum = c => { const d = c.getContext('2d').getImageData(0, 0, 400, 240).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s; };
    const o = {}; D.CFG.vd = { mirror: 2 }; let c = mk(); D.vdPost(c.getContext('2d'), 400, 240, false);     D.CFG.vd = { mirror: 2 }; c = mk(); D.vdPost(c.getContext('2d'), 400, 240, false); o.mirrorOK = px(c, 400 - 110, 170).join() === px(c, 110, 170).join() && px(c, 110, 170)[2] > 150;
    D.CFG.vd = { mirror: 4 }; c = mk(); D.vdPost(c.getContext('2d'), 400, 240, false); o.k4 = px(c, 110, 170).join() === px(c, 110, 70).join();     /* the picture is symmetric about the middle line */
    D.CFG.vd = {}; c = mk(); const l0 = lum(c); D.CFG.vd = { glow: .8 }; c = mk(); D.vdPost(c.getContext('2d'), 400, 240, false); o.glow = lum(c) > l0 * 1.1;
    D.CFG.vd = { trails: .8 }; D.VDX.prevOk = false; c = mk(); D.vdPost(c.getContext('2d'), 400, 240, false); const e = document.createElement('canvas'); e.width = 400; e.height = 240; const g = e.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 400, 240); D.vdPost(g, 400, 240, false); o.trail = px(e, 280, 60)[0] > 60; D.CFG.vd = { trails: 0 }; D.vdPost(g, 400, 240, false); D.CFG.vd = {}; D.VDX.prevOk = false; return o; });
  ok(F.mirrorOK, 'Mirror copies one half onto the other');
  ok(F.k4, '4-fold folds the picture so it is symmetric');
  ok(F.glow, 'Glow brightens the bright parts');
  ok(F.trail, 'Trails leave the last frame behind it as it fades');
  // ---- the drawer and designs
  await p.click('#vzDesignBtn'); await wait(200);
  ok(await ev(() => document.getElementById('vzDesign').offsetParent !== null && !document.querySelector('#pane-vis .vz-bar').classList.contains('looks-open')), 'Design opens a drawer (and closes the worlds)');
  ok(await ev(() => ['Sound → Sight', 'Shape', 'Finish', 'Colour', 'Designs', 'This world'].every(n => [...document.querySelectorAll('#vzDesign [data-tab]')].some(b => b.textContent === n))), 'the drawer has its six tabs');
  ok(await ev(() => document.querySelectorAll('#vd_src').length === 1 && !document.querySelector('#pane-vis [data-vza]') && !document.querySelector('#pane-vis select[title="Analysis source"]')), 'the source and speed · size · zoom controls live once, in the drawer');
  await p.click('#vzDesign [data-tab=shape]'); await p.click('#vzDesign [data-vd=shape][data-v=square]'); await wait(150);
  ok(await ev(() => window.__daily.CFG.vd.shape === 'square' && !window.__daily.vdShapeDefault()), 'a shape chosen in the drawer is the design');
  await p.click('#vzDesign [data-tab=pre]'); await p.fill('#vdName', 'My night'); await p.click('#vdSave'); await wait(200);
  ok(await ev(() => window.__daily.vdPersonal().some(d => d.name === 'My night' && d.vd.shape === 'square') && JSON.parse(localStorage.getItem('fw.cfg') || '{}').vdPresets.length === 1), 'a design can be named and kept (in this browser)');
  await ev(() => window.__daily.vdApply(window.__daily.VD_PRESETS.find(x => x.id === 'fifths'))); await wait(200);
  ok(await ev(() => { const D = window.__daily; return D.CFG.vd.layout === 'fifths' && D.CFG.vd.noteHue === 1 && D.VZ.mode === 'hex'; }), 'a built-in design sets the layout, the colour and the world');
  await ev(() => window.__daily.vdApply(window.__daily.vdPersonal()[0])); await wait(150);
  ok(await ev(() => window.__daily.CFG.vd.shape === 'square' && window.__daily.CFG.vd.layout == null), 'a saved design comes back exactly');
  await ev(() => window.__daily.vdDelete(window.__daily.vdPersonal()[0].id)); await ev(() => window.__daily.vdReset()); await wait(100);
  ok(await ev(() => window.__daily.vdPersonal().length === 0 && window.__daily.vdShapeDefault() && Object.keys(window.__daily.CFG.vd).length === 0), 'a design can be deleted, and Reset all returns the original');
  // ---- Soundprint
  await ev(() => window.__daily.vzSetMode('sprint')); await wait(500);
  ok(await ev(() => { const d = document.getElementById('vzDesign'); const b = document.getElementById('prtBar'); return d.offsetParent !== null && b && b.offsetParent !== null && !!document.querySelector('#prtBar [data-pw]'); }), 'choosing Soundprint opens its controls (worlds, listen again, save and share) in the drawer');
  // ---- every world still draws with Finish on
  const E0 = t.errs.length; const drawn = await ev(async () => { const D = window.__daily; D.CFG.vd = { glow: .5, trails: .4, mirror: 6 }; const ks = [...document.querySelectorAll('#vzLooks [data-m]')].map(b => b.dataset.m).filter(k => k !== 'video'); for (const k of ks) { D.vzSetMode(k, true); await new Promise(r => setTimeout(r, 120)); } D.CFG.vd = {}; D.vzSetMode('hex', true); return ks.length; });
  ok(drawn >= 28 && t.errs.length === E0, 'all ' + drawn + ' worlds still draw with glow, trails and a six-fold mirror on, without an error');
  await ev(() => { window.__daily.CFG.vd = {}; });
  ok(t.errs.length === 0, 'no errors (' + t.errs.length + ')');
});
