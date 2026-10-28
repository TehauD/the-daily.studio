/* ============================================================
   Part 64 · Three journeys: Play, Create, Learn.
   The studio has a lot in it, and a person who just wants to play should not have to learn how it is divided. Each journey is a complete workspace
   (a layout) built around one job, with only the tabs that job uses, and the right one open:
     Play    plug in, pick a tone, play along with a backing track      (Guitar sound · Band · Backing track · Stage)
     Create  write, record, loop and layer, and save the song            (Write · Band · Guitar sound · Save)
     Learn   load a song, split it into parts, see the chords and tab   (Backing track · Transcribe · Write · Band, with the fretboard beside)
   They sit above the tab strip, are always one click away, and are also in the Layouts menu. Everything else is still there: pick Tools ▸ Everything.
   ============================================================ */
const JOURNEYS = [
  ['play', 'Play', 'Plug in, pick a tone and play along with a backing track', 'Play', 'Guitar sound, band and backing track, with the tones on the left and a tuner on the right.',
    { flip: true, left: true, right: true, tlh: 'minmax(110px,22%)', dock: 'rig', order: ['rig', 'band', 'stems', 'vis'], hidden: ['tab', 'song', 'fret', 'stage', 'neural', 'tx', 'cam', 'lab', 'exp'], cur: { left: 'tones', right: 'monitor' }, mon: ['tuner', 'levels'] }, ['rig', 'band', 'stems', 'vis']],
  ['create', 'Create', 'Write a song, record it, loop and layer it, and save it', 'Create', 'Write, record, loop and layer. The canvas for the tab, the words and the fretboard in the middle; your input on the left.',
    { flip: true, left: true, right: false, tlh: 'minmax(120px,24%)', dock: 'tab', order: ['tab', 'band', 'rig', 'exp'], hidden: ['song', 'fret', 'vis', 'stage', 'neural', 'stems', 'tx', 'cam', 'lab'], cur: { left: 'io' } }, ['tab', 'band', 'rig', 'exp']],
  ['learn', 'Learn', 'Load a song, split it into parts, see its chords and tab, and practise', 'Learn', 'Backing track and Transcribe first, the tab to read, and the fretboard beside it.',
    { flip: true, left: false, right: true, tlh: 'minmax(150px,28%)', dock: 'stems', order: ['stems', 'tx', 'tab', 'band'], hidden: ['rig', 'song', 'fret', 'vis', 'stage', 'neural', 'cam', 'lab', 'exp'], side: { fret: 'right' }, so: { left: [], right: ['fret', 'refine', 'monitor'] }, cur: { right: 'fret' } }, ['stems', 'tx', 'tab', 'band']]
];
/* they are layouts too: after Studio in the Layouts menu */
LAYOUTS.splice(1, 0, ...JOURNEYS.map(j => [j[3], j[4], j[5]]));
/** the journey whose workspace is showing (null when it is some other layout) */
const journeyNow = () => JOURNEYS.find(j => j[3] === LAY.name) || null;
/** tabs the journey in use needs, even when the experience level has not unlocked them */
const journeyShows = id => { const j = journeyNow(); return !!j && j[6].includes(id); };
function journeyGo(id) {
  const j = JOURNEYS.find(x => x[0] === id); if (!j) return false; CFG.journey = id; saveCfg();
  applyPreset(j[5], j[3]); if (typeof xpSignal === 'function') xpSignal(1);
  if (id === 'learn' && typeof sideShow === 'function') { try { sideShow('fret'); } catch (e) { } } bus.emit('journey', id); return true;
}
function journeyBar() {
  const cur = journeyNow(), box = h('div', { class: 'jny', role: 'group', 'aria-label': 'What do you want to do?' });
  JOURNEYS.forEach(j => box.append(h('button', { class: 'jny-b' + (cur && cur[0] === j[0] ? ' on' : ''), 'data-j': j[0], 'aria-pressed': String(!!cur && cur[0] === j[0]), title: j[2], onclick: () => journeyGo(j[0]) }, j[1])));
  return box;
}
