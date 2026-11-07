/* ============================================================
   Part 88 · BEATS (2.39) — a ready band to play, sing or write over, in one tap
   Each beat is a groove, a tempo and a band: the studio's own drums, bass, rhythm guitar and keys (parts 03 and 86), so there are
   no audio files to download, nothing to license, and the beat follows the song's key, chords and tempo like the band always has.
   Tapping a beat sets the band and the tempo and starts it looping; a song with no chords yet gets the beat's progression in its key.
   One undo puts the band back. The grooves are written for this studio; none is copied from a record.
   In ✦ Simple the Band panel is just this: the beats, and a switch and a level for each player (Show every band setting for the rest).
   ============================================================ */
const BEATS = [
  { id: 'folk', name: 'Easy Folk', feel: 'Acoustic', bpm: 92, kit: 'Acoustic', pat: 'Folk Backbeat', bass: 'Root–Fifth', tone: 'Round', comp: 'Folk D-DU-UDU', inst: 'Steel', prog: 'I V vi IV' },
  { id: 'pop', name: 'Pop Drive', feel: 'Pop', bpm: 108, kit: 'Club Machine', pat: 'Pop Groove', bass: 'Eighths', tone: 'Pick', comp: 'Pop 8ths', inst: 'Electric', keys: 'Pad (held)', sound: 'Pad', prog: 'vi IV I V' },
  { id: 'rock', name: 'Garage Rock', feel: 'Rock', bpm: 126, kit: 'Rock Room', pat: 'Rock 8ths', bass: 'Eighths', tone: 'Pick', comp: 'Power Chug 8ths', inst: 'Electric', prog: 'i VI III VII', minor: 1 },
  { id: 'lofi', name: 'Lo-fi Nod', feel: 'Lo-fi hip-hop', bpm: 82, swing: .22, kit: 'Boom Bap', bass: 'Syncopated', tone: 'Sub', keys: 'Broken chords', sound: 'Electric piano', prog: 'ii7 V7 Imaj7 vi7',
    rows: ['X......x..X.....', '....X.......X..g', 'x.x.x.x.x.x.x.xg', '................', '................', '................'] },
  { id: 'night', name: 'Night Drive', feel: 'Dance', bpm: 122, kit: 'Club Machine', pat: 'Four on the Floor', bass: 'Octave Pump', tone: 'Glide Sub', keys: 'Off-beat stabs', sound: 'Synth lead', prog: 'i VI III VII', minor: 1 },
  { id: 'trap', name: 'Trap Glide', feel: 'Trap', bpm: 140, kit: 'Deep Machine', bass: 'Follow the Kick', tone: 'Glide Sub', keys: 'Pad (held)', sound: 'Pad', prog: 'i VI iv V', minor: 1,
    rows: ['X.....x...x.....X.......x..x....', '........X...............X.......', 'x.x.x.x.xxx.x.x.x.x.x.x.x.xxxxxx', '..............x...............x.', '........x...............x.......', '................................'] },
  { id: 'island', name: 'Island Sway', feel: 'Reggae', bpm: 76, kit: 'Acoustic', pat: 'Reggae One-Drop', bass: 'Reggae Dub', tone: 'Round', comp: 'Reggae Skank', inst: 'Electric', keys: 'Off-beat stabs', sound: 'Organ', prog: 'I IV V IV' },
  { id: 'blues', name: 'Slow Burn', feel: 'Blues shuffle', bpm: 96, swing: .33, kit: 'Acoustic', pat: 'Blues Shuffle', bass: 'Walking', tone: 'Round', comp: 'Down 4s', inst: 'Electric', prog: 'I7 IV7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7' },
  { id: 'ballad', name: 'Quiet Ballad', feel: 'Ballad', bpm: 70, kit: 'Brush (soft)', pat: 'Ballad Half-Time', bass: 'Root Whole', tone: 'Round', comp: 'Ballad Arpeggio', inst: 'Nylon', keys: 'Pad (held)', sound: 'Piano', prog: 'I vi IV V' },
  { id: 'funk', name: 'Funk Pocket', feel: 'Funk', bpm: 100, kit: 'Acoustic', pat: 'Funk 16ths', bass: 'Syncopated', tone: 'Pick', comp: 'Funk Chuck', inst: 'Electric', keys: 'Off-beat stabs', sound: 'Electric piano', prog: 'i7 IV7 i7 IV7', minor: 1 },
  { id: 'drill', name: 'Drill Night', feel: 'Drill', bpm: 142, kit: 'Deep Machine', bass: 'Follow the Kick', tone: 'Glide Sub', keys: 'Pad (held)', sound: 'Pad', prog: 'i iv VI v', minor: 1,
    rows: ['X......x..x.....X.....x...x.x...', '........X...............X..g....', 'x..x..x.x..x..x.x..x..x.x.x.xxxx', '................................', '........x...............x.......', '................................'] },
  { id: 'afro', name: 'Golden Hour', feel: 'Afrobeats', bpm: 104, kit: 'Club Machine', bass: 'Syncopated', tone: 'Round', keys: 'Off-beat stabs', sound: 'Electric piano', prog: 'I V vi IV',
    rows: ['X...x...X...x...', '................', 'x.xxx.xxx.xxx.xx', '...............x', '......x.....x...', '..x....x..x...x.'] },
  { id: 'rnb', name: 'Late R&B', feel: 'R&B', bpm: 68, kit: 'Deep Machine', bass: 'Syncopated', tone: 'Glide Sub', keys: 'Broken chords', sound: 'Electric piano', prog: 'Imaj7 vi7 ii7 V7',
    rows: ['X......x.X......', '....X.......X...', 'x.x.x.x.x.x.xxx.', '................', '....x.......x...', '................'] },
  { id: 'bossa', name: 'Bossa Evening', feel: 'Bossa nova', bpm: 128, kit: 'Brush (soft)', pat: 'Bossa Nova', bass: 'Root–Fifth', tone: 'Round', comp: 'Travis Roll', inst: 'Nylon', prog: 'ii7 V7 Imaj7 Imaj7' }
];
const BEAT_CH = { '.': 0, g: 1, x: 2, X: 3 };
/** a beat's drum pattern as the band's grid (rows of 32 steps) and its length in 16ths */
function beatRows(b) { const src = b.rows || DPATS[b.pat], L = Math.min(src[0].length, 32); return { L, pat: src.map(r => Array.from({ length: 32 }, (_, i) => i < L ? BEAT_CH[r[i]] || 0 : 0)) }; }
/** a song with no chords yet takes the beat's progression, in the song's key; a song that has chords keeps them */
function beatChords(b) {
  if (S.sections.some(s => s.bars.some(x => (x.chord || '').trim()))) return false;
  const minor = !!b.minor, ch = b.prog.split(' ').map(t => romanToChord(t, S.key, minor) || '');
  S.minor = minor; S.scale = minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)';
  if (!S.sections.length) S.sections.push(mkSection('Verse 1', ch));
  else { const sec = S.sections[0]; while (sec.bars.length < ch.length) sec.bars.push(newBar()); sec.bars.forEach((x, i) => { x.chord = ch[i % ch.length]; }); }
  return true;
}
/** use beat `id`: the band and the tempo, then (unless o.play is false) loop it; one undo puts everything back */
function beatUse(id, o = {}) {
  const b = BEATS.find(x => x.id === id); if (!b) return false; const B = S.band, { L, pat } = beatRows(b);
  Object.assign(B, { beat: b.id, build: true, drumsOn: true, kit: b.kit, patName: b.pat || b.name, pat, drumLen: L, bassOn: !isBass(), bassStyle: b.bass, bassTone: b.tone, compOn: !!b.comp, keysOn: !!b.keys });
  if (b.comp) { B.compStyle = b.comp; B.compInst = b.inst; } if (b.keys) { B.keysStyle = b.keys; B.keysSound = b.sound; }
  if (!S.mix.keys) S.mix.keys = { g: .7, p: .1, m: 0, s: 0 };
  S.bpm = b.bpm; S.swing = b.swing || 0; const fresh = beatChords(b); T.bars = null;
  commit(true); bus.emit('song', fresh ? 'reload' : 'band'); bus.emit('bpm'); syncTransport(); try { syncBandStrip(); } catch (e) { }
  if (o.play !== false && !T.playing) { T.loop = true; syncTransport(); play(); }
  if (!o.quiet) toast('🥁 ' + b.name + ' · ' + b.bpm + ' BPM' + (fresh ? ', with chords to start from' : '') + '. Play or sing over it; ● records. Undo puts your band back.', 'ok');
  return true;
}
/** the beats as a row of cards (the Band panel, and 🥁 Beats in the Songwriter tools) */
function beatsShelf(o = {}) {
  const cur = S.band.beat;
  return h('div', { class: 'bt-shelf', role: 'group', 'aria-label': 'Beats' }, BEATS.map(b => h('button', { class: 'bt-card' + (cur === b.id ? ' on' : ''), type: 'button', 'data-beat': b.id, 'aria-pressed': String(cur === b.id),
    title: b.name + ': ' + b.feel + ', ' + b.bpm + ' BPM. Tap to play it', onclick: () => { beatUse(b.id); if (o.after) o.after(); } }, h('b', {}, b.name), h('span', {}, b.feel + ' · ' + b.bpm))));
}
/** who plays, as four switches with a level each (Simple's band) */
function beatsMixer() {
  const B = S.band, parts = [['drums', '🥁', 'Drums', 'drumsOn'], ['bass', '〰', 'Bass', 'bassOn'], ['rhythm', '🎸', 'Guitar', 'compOn'], ['keys', '🎹', 'Keys', 'keysOn']];
  return h('div', { class: 'bt-mix' }, parts.map(([id, ic, nm, key]) => {
    const m = S.mix[id] || (S.mix[id] = { g: .7, p: 0, m: 0, s: 0 });
    return h('div', { class: 'bt-ch' + (B[key] ? ' on' : ''), 'data-part': id },
      h('button', { class: 'btn sm bt-pw' + (B[key] ? ' on' : ''), type: 'button', 'aria-pressed': String(!!B[key]), title: (B[key] ? 'Turn off the ' : 'Bring in the ') + nm.toLowerCase(), onclick: () => { toggleBand(key); renderBand(); } }, ic + ' ' + nm),
      h('input', { type: 'range', min: 0, max: 1.4, step: .01, value: m.g, 'aria-label': nm + ' level', oninput: e => { m.g = +e.target.value; applyMix(); commit(false); } }));
  }));
}
/** Simple's Band panel: the beats and who plays; everything else one press away */
function bandSimple(bx) {
  bx.append(h('div', { class: 'card' }, h('h4', {}, 'Pick a beat'), h('div', { class: 'card-b' }, h('p', { class: 'tiny muted bt-how' }, 'Tap one and it plays: drums, bass and chords, in your song’s key. Play or sing over it, and press ● to record. Undo puts your band back.'), beatsShelf())),
    h('div', { class: 'card' }, h('h4', {}, 'Who plays'), h('div', { class: 'card-b' }, beatsMixer())), buildCard(),
    h('button', { class: 'btn sm', id: 'bandAll', type: 'button', onclick: () => { UI.bAll = true; renderBand(); } }, 'Show every band setting'));
}
