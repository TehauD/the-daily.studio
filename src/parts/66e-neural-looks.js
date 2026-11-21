/* ============================================================
   Part 66e · The Neural Map, with dials, and three more looks on the same network (2.82)
     Neural Map     the network of bands, notes, chords, harmonic function and sections that learns the song as it plays (part 14), now with its own
                    Settings: layout, what colours it, which layers and parts to show, sizes, camera (spin, tilt, sway, zoom, depth, follow the chord),
                    how much of what you played stays on screen, and Pre-train / Forget.
     Fifths Tower   the circle of fifths in 3D: chords stand on their note's spoke, taller as they get more tense, coloured by their quality.
     Chord Web      only the chords, pulled together by the paths the song actually takes: chords that follow each other end up close.
     Song Journey   the song as a spiral staircase round the circle of fifths: every note you play climbs one step higher as the song goes on, coloured by time.
   All four draw the same learning network, so what one has learned the others show; each keeps its own settings. The Neural pane (the tab) is untouched:
   the settings are applied for the one frame the look is drawn and put back after. */
VMODES.push(['nxtower', 'Fifths Tower'], ['nxweb', 'Chord Web'], ['nxjourney', 'Song Journey']);

const NXKEYS = ['layout', 'color', 'edges', 'labels', 'links', 'floor', 'ghosts', 'ev', 'trans', 'pulses', 'nodeS', 'lineW', 'labelS', 'evMax', 'depth', 'pred', 'lBand', 'lPc', 'lForm'];
const nxT = (k, label, tip, def) => ({ k, label, type: 'toggle', def: def == null ? 1 : def, tip });
const nxR = (k, label, min, max, step, def, tip, unit) => ({ k, label, type: 'range', min, max, step, def, tip, unit });
/** the dials every look on the network has; d holds what this look starts with */
function nxOpts(title, d) {
  d = Object.assign({ layout: 'net', color: 'pc', bands: 1, pcs: 1, form: 1, edges: 1, trans: 1, pulses: 1, ev: 1, links: 1, labels: 1, pred: 1, floor: 1, ghosts: 1, tilt: 'auto', follow: 0, memory: 2600 }, d || {});
  return { title, opts: [
    { type: 'head', label: 'View' },
    { k: 'layout', label: 'Layout', type: 'choice', def: d.layout, opts: [['net', 'Layers', 'Spectrum, notes, chords, function and key in columns'], ['fifths', 'Fifths', 'The circle of fifths, with chords standing on their note'], ['force', 'Web', 'The parts pull together by how often one follows another']], tip: 'How the network is laid out' },
    { k: 'color', label: 'Colour by', type: 'choice', def: d.color, opts: [['pc', 'Note'], ['time', 'Time'], ['section', 'Section'], ['loud', 'Loudness'], ['octave', 'Octave'], ['quality', 'Chord']], tip: 'Note: a colour for each of the twelve notes. Time: the song’s course, yellow to purple. Section: each part of the song. Loudness, octave, or the chord’s quality (major, minor, seventh…)' },
    { type: 'head', label: 'Layers' },
    nxT('lBand', 'Spectrum', 'The frequency bands the sound is split into', d.bands), nxT('lPc', 'Notes', 'The twelve notes', d.pcs), nxT('lForm', 'Function · form · key', 'Home, away and tension; the sections; the key', d.form),
    { type: 'head', label: 'Show' },
    nxT('edges', 'Connections', 'The lines between the layers', d.edges), nxT('trans', 'Learned paths', 'Arrows between chords that followed each other; thicker the more often', d.trans), nxT('pulses', 'Light pulses', 'A spark runs along a connection when a note or chord arrives', d.pulses),
    nxT('ev', 'Notes you play', 'Each note as a point, rising as the song goes on', d.ev), nxT('links', 'Note trail', 'A thread through the last notes you played', d.links), nxT('labels', 'Labels', 'Names of the chords, notes and parts', d.labels),
    nxT('pred', 'Next-chord rings', 'A ring round the chords the network expects next; wider the likelier', d.pred), nxT('floor', 'Floor glow', 'A soft shadow of the notes on the floor', d.floor), nxT('ghosts', 'Chords not heard yet', 'Faint outlines for chords in the song that have not played', d.ghosts),
    { type: 'head', label: 'Size' },
    nxR('nodeS', 'Nodes', .5, 2, .05, 1, 'How big the dots and chords are', 'x'), nxR('lineW', 'Lines', .4, 3, .05, 1, 'How thick the connections are', 'x'), nxR('labelS', 'Text', .6, 2, .05, 1, 'How big the labels are', 'x'),
    { type: 'head', label: 'Camera' },
    nxR('spin', 'Turn', 0, 3, .05, 1, 'How fast it slowly turns (none: it stays still)', 'x'),
    { k: 'tilt', label: 'Angle', type: 'choice', def: d.tilt, opts: [['auto', 'Auto'], ['0.1', 'Level'], ['0.38', 'Slight'], ['0.8', 'High'], ['1.3', 'Top-down']], tip: 'Auto: slightly above for the layers, high up for the circle' },
    nxR('sway', 'Sway', 0, .4, .01, .12, 'How much the angle rocks up and down', 'x'), nxR('zoom', 'Zoom', .5, 2.5, .05, 1, 'How close', 'x'), nxR('depth', 'Depth', 6, 30, 1, 13, 'Perspective: low is dramatic and close, high is flat'),
    nxR('follow', 'Follow the chord', 0, 1, .05, d.follow, 'Slide the picture so the chord that is playing stays in the middle', '%'),
    { type: 'head', label: 'Memory' },
    nxR('memory', 'Notes kept', 60, 2600, 20, d.memory, 'How many of the notes you played stay on screen: few shows only the recent past, all of them draws the whole performance'),
    { k: 'pretrain', label: 'Learn the song', type: 'action', btn: '⚡ Pre-train', tip: 'Teach the network this song’s chord order now', run: () => ngPretrain() },
    { k: 'forget', label: 'Start again', type: 'action', btn: '↺ Forget', tip: 'Wipe what it has learned', run: () => ngForget() }] };
}
VLOOK.neural = nxOpts('Neural Map');
VLOOK.nxtower = nxOpts('Fifths Tower', { layout: 'fifths', color: 'quality', bands: 0, form: 0, edges: 0, labels: 1, ghosts: 0, tilt: '0.8' });
VLOOK.nxweb = nxOpts('Chord Web', { layout: 'force', color: 'quality', bands: 0, pcs: 0, form: 0, edges: 0, ev: 0, links: 0, floor: 0, ghosts: 1 });
VLOOK.nxjourney = nxOpts('Song Journey', { layout: 'fifths', color: 'time', bands: 0, form: 0, edges: 0, trans: 0, labels: 1, ghosts: 0, links: 1, follow: .45, tilt: '0.38' });
VLOOK.nxtower.opts.find(o => o.k === 'spin').def = .7;

/** the look's settings, as the values the network reads */
const nxSettings = mode => { const o = k => vlv(mode, k); return { layout: o('layout'), color: o('color'), edges: !!o('edges'), labels: !!o('labels'), links: !!o('links'), floor: !!o('floor'), ghosts: !!o('ghosts'), ev: !!o('ev'), trans: !!o('trans'), pulses: !!o('pulses'),
  nodeS: +o('nodeS'), lineW: +o('lineW'), labelS: +o('labelS'), evMax: +o('memory') >= 2600 ? 0 : +o('memory'), depth: +o('depth'), pred: !!o('pred'), lBand: !!o('lBand'), lPc: !!o('lPc'), lForm: !!o('lForm') }; };
const NXC = { yaw: .6, pit: .45, zoom: 1, px: 0, py: 0 };
/** the picture is drawn with this look's settings laid over the network's, then the network's own are put back */
function nxDraw(mode, g, W, H) {
  const keep = {}; NXKEYS.forEach(k => { keep[k] = NG[k]; }); Object.assign(NG, nxSettings(mode));
  try {
    const o = k => vlv(mode, k), tl = o('tilt'), base = tl === 'auto' ? (NG.layout === 'fifths' ? .8 : .38) : +tl;
    ngFrameCommon(); NXC.yaw += .0025 * o('spin'); NXC.pit = base + Math.sin(VZ.t * .12) * o('sway'); NXC.zoom = Math.max(1, Math.min(W, H) / 700 * 1.1) * o('zoom');
    const cur = NR.nodes.get('c:' + NR.curChord), f = +o('follow');
    if (f > 0 && cur) { const q = ngCam(NXC, W, H)(cur.p); NXC.px += (-(q[0] - W / 2 - NXC.px) * f - NXC.px) * .04; NXC.py += (-(q[1] - H * .54 - NXC.py) * f - NXC.py) * .04; }
    else { NXC.px *= .96; NXC.py *= .96; }
    const was = NR.sel; NR.sel = null; ngRender(g, W, H, NXC, { noBg: true, noHit: true, dark: true, noCaps: false }); NR.sel = was;
  } finally { Object.assign(NG, keep); }
}
['neural', 'nxtower', 'nxweb', 'nxjourney'].forEach(m => { VL_DRAW[m] = (g, W, H) => nxDraw(m, g, W, H); });
