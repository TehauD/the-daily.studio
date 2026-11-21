/* ============================================================
   Part 66a · The looks that live in the "worlds" room (2.85)
   The music-theory, spectral, plate and network looks (parts 66b–66f: Harmonic Wheel, Tonnetz, Pitch Spiral, Rhythm Polygons, Overtone Series, Chladni
   Plate, Pitch Trace, Fifths Tower, Chord Web, Song Journey, Voice-Leading Web, and the Neural Map's own settings) are about a third of what the studio
   draws. On the hosted site they load the first time one is chosen (scripts/rooms.mjs: room "worlds"); in the single-file app they are simply here.
   This part is what the core needs to know without them: their names (so the look strip is complete before the room arrives), which have options of
   their own, and how to ask for the room. Until it has arrived, a look draws a quiet veil (the Neural Map draws its default network).
   ============================================================ */
const WORLD_LOOKS = [['wheel', 'Harmonic Wheel'], ['tonnetz', 'Tonnetz'], ['spiral', 'Pitch Spiral'], ['rhythm', 'Rhythm Polygons'], ['overtones', 'Overtone Series'], ['chladni', 'Chladni Plate'], ['pitchtrace', 'Pitch Trace'], ['nxtower', 'Fifths Tower'], ['nxweb', 'Chord Web'], ['nxjourney', 'Song Journey'], ['vlweb', 'Voice-Leading Web']];
VMODES.push(...WORLD_LOOKS);
const WORLD_SET = new Set(WORLD_LOOKS.map(x => x[0]).concat('neural')), WORLD_OPTS = new Set(['neural', 'spiral', 'rhythm', 'overtones', 'chladni', 'pitchtrace', 'nxtower', 'nxweb', 'nxjourney', 'vlweb']);
/** a look whose drawing and options come from the worlds room */
const worldLook = k => WORLD_SET.has(k);
/** a look with options of its own (known before the room has loaded) */
const lookHasOpts = k => !!VLOOK[k] || WORLD_OPTS.has(k);
const worldsLoaded = () => !ROOM.files || !ROOM.files.worlds || !!ROOM.done.worlds;
/** load the room (once); then the settings and the strip are drawn again for the look now showing */
function worldsEnsure() {
  if (worldsLoaded()) return Promise.resolve();
  return room('worlds').then(() => { try { if (typeof vdPaint === 'function') vdPaint(); if (typeof vzStripSync === 'function') vzStripSync(); } catch (e) { } }, () => { });
}
