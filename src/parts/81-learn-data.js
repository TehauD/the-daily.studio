/* ============================================================
   Part 81 · WHAT THE TEACHER TEACHES (2.32) — lessons, warm-ups and the riff library
   Pieces are written as intervals from the key's root, so they play in any key and any tuning (part 80 places them on the neck):
     "12:2 15b:4 r:2 10~:4"   12 semitones up for an 8th; 15 bent up a whole step for a quarter; an 8th's rest; 10 with vibrato
     lengths in 16ths (default 2) · b bend a whole step (b1 a half) · h hammer-on · p pull-off · / slide · ~ vibrato · x muted
     "0+7+12:2"               notes together (a power chord)
   Every riff here was written for this studio: idioms of each style, not copies of anyone's song.
   ============================================================ */
function rfParse(txt) {
  let at = 0; return String(txt).trim().split(/\s+/).map(tok => {
    const [a, l] = tok.split(':'), len = l ? +l : 2; const n = { at, len }; at += len; if (a === 'r') { n.r = true; return n; }
    const m = /^(-?\d+(?:\+-?\d+)*)(b1|b|h|p|\/|~|x)?$/.exec(a); if (!m) return Object.assign(n, { r: true });
    const iv = m[1].split('+').map(Number); if (iv.length > 1) n.ch = iv; n.i = iv[0];
    if (m[2]) { n.t = m[2][0] === 'b' ? 'b' : m[2]; if (n.t === 'b') n.b = m[2] === 'b1' ? 1 : 2; }
    return n;
  });
}
const rfLen = notes => { const e = notes.reduce((a, n) => Math.max(a, n.at + n.len), 0); return Math.max(16, Math.ceil(e / 16) * 16); };

/* ---------- pieces for lessons ---------- */
let LPN = 0;
const lp = (kind, title, text, o) => Object.assign({ kind, title, text, id: 'lp' + (LPN++) }, o || {});
const lpN = (kind, title, text, txt, o) => { const src = rfParse(txt); return lp(kind, title, text, Object.assign({ src, len: rfLen(src), keyed: false }, o || {})); };
const LPC = {
  info: (t, x, o) => lp('info', t, x, o),
  notes: (t, x, txt, o) => lpN('notes', t, x, txt, o),
  timed: (t, x, txt, o) => lpN('timed', t, x, txt, Object.assign({ back: { drums: true } }, o || {})),
  chord: (t, x, c, o) => lp('chord', t, x, Object.assign({ chords: [c] }, o || {})),
  changes: (t, x, cs, o) => lp('changes', t, x, Object.assign({ chords: cs, back: { drums: true, chords: cs, bass: true }, bars: 8, len: 16 * cs.length }, o || {})),
  minute: (t, x, cs, o) => lp('minute', t, x, Object.assign({ chords: cs, secs: 60, goal: 20, ladder: false }, o || {})),
  rhythm: (t, x, pat, o) => lp('rhythm', t, x, Object.assign({ pattern: pat, bars: 4, len: 16, back: { drums: true } }, o || {})),
  bend: (t, x, txt, o) => lpN('bend', t, x, txt, o),
  vib: (t, x, txt, o) => lpN('vib', t, x, txt, o),
  /* 2.68: sung pieces (part 80): each note in turn, or one note held in tune; the Key menu moves them to where a voice sits */
  sing: (t, x, txt, o) => lpN('notes', t, x, txt, Object.assign({ voice: true, keyed: true, keyPc: 0, bpm: 66 }, o || {})),
  hold: (t, x, txt, o) => lpN('hold', t, x, txt, Object.assign({ voice: true, keyed: true, keyPc: 0, bpm: 66, secs: 3, ladder: false }, o || {})),
  landing: (t, x, cs, o) => lp('landing', t, x, Object.assign({ back: { drums: true, chords: cs, bass: true }, bars: 8, len: 16 * cs.length }, o || {}))
};
/* open strings, E2 A2 D3 G3 B3 E4 from E */
const LESSONS = [
  { id: 'found', ico: '🌱', name: 'Foundations', blurb: 'Tune, first notes, first chords, changing in time, strumming, your first song.', lessons: [
    { id: 'f1', name: 'Tune up and find the strings', steps: [
      LPC.info('Six strings, low to high', 'From the thickest string to the thinnest: E A D G B E. The tuner (top right) shows how far each one is from its note. Tune each until the needle sits in the middle.'),
      LPC.notes('Play each open string', 'Pick each string once, thickest first. The coach moves on when it hears the right note.', '0:4 5:4 10:4 15:4 19:4 24:4', { keyPc: 4, near: 0 }),
      LPC.notes('Your first fretted notes', 'Press just behind the fret, with your fingertip. Second fret on the D, G and B strings.', '12:4 17:4 21:4', { keyPc: 4, near: 1 })] },
    { id: 'f2', name: 'First chords: Em, G, C, D', steps: [
      LPC.chord('E minor', 'Two fingers, second fret, A and D strings. Strum all six.', 'Em'),
      LPC.chord('G major', 'Third fret on the low E and the high E, second fret on the A.', 'G'),
      LPC.chord('C major', 'A staircase: A string 3rd fret, D 2nd, B 1st. Skip the low E.', 'C'),
      LPC.chord('D major', 'A small triangle on the top three strings. Strum from the D string down.', 'D')] },
    { id: 'f3', name: 'Changing in time', steps: [
      LPC.info('Move all the fingers together', 'Lift the whole shape at once and land it at once. Slow and clean beats fast and messy. Look for a finger that can stay put (a "pivot").'),
      LPC.changes('Em to C, a bar each', 'One strum on the first beat of each bar, with the click. The coach checks each bar.', ['Em', 'C'], { bpm: 60 }),
      LPC.changes('G to D', 'G for a bar, D for a bar.', ['G', 'D'], { bpm: 60 }),
      LPC.minute('One-minute changes: G and C', 'Switch between G and C as many times as you can in a minute. Twenty is a great start; your best is kept.', ['G', 'C'])] },
    { id: 'f4', name: 'Strumming patterns', steps: [
      LPC.rhythm('Four down-strums a bar', 'One down-strum on each click. Keep your wrist loose.', 'D...D...D...D...', { bpm: 70 }),
      LPC.rhythm('Down and up eighths', 'Down on the beat, up between. Your hand never stops moving.', 'D.u.D.u.D.u.D.u.', { bpm: 70 }),
      LPC.rhythm('The folk pattern', 'Down, down-up, up-down-up. Keep the hand moving even where it misses the strings.', 'D...d.u...u.d.u.', { bpm: 72 })] },
    { id: 'f5', name: 'Your first song', steps: [
      LPC.changes('G – D – Em – C', 'The four chords under countless songs. A bar each, with the band.', ['G', 'D', 'Em', 'C'], { bpm: 72, bars: 8 }),
      LPC.info('Now make it yours', 'Open Songwriter and put these four chords in a section: the band will play them while you hum a melody on top.')] }
  ] },
  { id: 'lead', ico: '🎸', name: 'Lead', blurb: 'The pentatonic box, bends, vibrato, your first licks, playing them in time, soloing over a band.', lessons: [
    { id: 'l1', name: 'The minor pentatonic, box one', steps: [
      LPC.info('The most useful shape on the guitar', 'Five notes, two on each string, starting at the fifth fret for A. Roots (R) are the home notes: start and end there.'),
      LPC.notes('Up the box', 'Low string to high, one note at a time.', '0 3 5 7 10 12 15 17 19 22 24 27', { keyPc: 9, near: 5, keyed: true }),
      LPC.notes('And back down', 'High to low.', '27 24 22 19 17 15 12 10 7 5 3 0', { keyPc: 9, near: 5, keyed: true }),
      LPC.timed('Up and down in time', 'Eighth notes with the click and the drums. Even and relaxed.', '0 3 5 7 10 12 15 17 19 22 24 22 19 17 15 12', { keyPc: 9, near: 5, bpm: 70, keyed: true })] },
    { id: 'l2', name: 'Bends', steps: [
      LPC.info('Push the string with three fingers', 'Ring, middle and index all push together; turn from the wrist, like a door handle. Aim for the note two frets up.'),
      LPC.bend('A whole-step bend', 'Seventh fret on the G string (in A): bend it up until it sounds like the ninth fret.', '10b:8', { keyPc: 9, near: 5, lift: 12 }),
      LPC.bend('A bend on the B string', 'Eighth fret, B string: bend up a whole step.', '15b:8', { keyPc: 9, near: 6, lift: 12 }),
      LPC.bend('A half-step bend', 'Small and sweet: the eighth fret on the high E, up a half step.', '22b1:8', { keyPc: 9, near: 6, lift: 12 })] },
    { id: 'l3', name: 'Vibrato', steps: [
      LPC.info('Shake the note', 'Bend a little and let go, over and over, steadily. Five or six times a second sounds human.'),
      LPC.vib('Vibrato on the root', 'Tenth fret, B string (an A): hold it and shake it.', '24~:16', { keyPc: 9, near: 9, lift: 0 })] },
    { id: 'l4', name: 'Your first licks', steps: [
      LPC.notes('Down the box', 'A classic shape: three notes on the top string, falling to the root.', '24 22 19 22 19 17 15 12', { keyPc: 9, near: 5, keyed: true }),
      LPC.notes('The bend and release', 'Bend, let it down, then two notes home.', '15b:4 15 12 10 12:4', { keyPc: 9, near: 5, keyed: true }),
      LPC.notes('Call and answer', 'A question that rises, an answer that comes home.', '12 15 17 19:4 17 15 12 10 12:4', { keyPc: 9, near: 5, keyed: true })] },
    { id: 'l5', name: 'Licks in time', steps: [
      LPC.timed('Lick over the drums', 'The first lick again, now with the click and the drums: land each note on its eighth.', '24 22 19 22 19 17 15 12', { keyPc: 9, near: 5, bpm: 76, keyed: true }),
      LPC.timed('Bend lick in time', 'Bend on the beat, release, and resolve.', '15b:4 15 12 10 12:4 r:2', { keyPc: 9, near: 5, bpm: 76, keyed: true })] },
    { id: 'l6', name: 'Solo over the band', steps: [
      LPC.info('Aim for the chord', 'When the chord changes, land on one of its notes. The fretboard shows the box; the chord tones are where the band agrees with you.'),
      LPC.landing('A minor to G', 'Play in box one. Each time the chord changes, make your first note one of its notes.', ['Am', 'G'], { bpm: 84 }),
      LPC.landing('Am – F – C – G', 'Four chords; the same idea.', ['Am', 'F', 'C', 'G'], { bpm: 84 })] }
  ] },
  { id: 'rhythm', ico: '🥁', name: 'Rhythm', blurb: 'Steady down-strums, eighths, muted chugs, syncopation, and sitting in the pocket with a drummer.', lessons: [
    { id: 'r1', name: 'On the beat', steps: [LPC.rhythm('Quarter notes', 'One stroke per click. Nothing early, nothing late.', 'D...D...D...D...', { bpm: 80 }), LPC.rhythm('Faster quarters', 'The same at a brisker tempo.', 'D...D...D...D...', { bpm: 104 })] },
    { id: 'r2', name: 'Eighths and accents', steps: [LPC.rhythm('Straight eighths', 'Down-up, evenly.', 'D.u.D.u.D.u.D.u.', { bpm: 84 }), LPC.rhythm('Accents on 2 and 4', 'All eighths, but hit beats two and four harder: that is the backbeat.', 'D.u.D.u.D.u.D.u.', { bpm: 84, tip: 'The coach checks the timing; the accents are for your ears.' })] },
    { id: 'r3', name: 'Muted chugs', steps: [LPC.info('Palm mute', 'Rest the edge of your picking hand on the strings just by the bridge. The notes go short and punchy.'), LPC.rhythm('Chugged eighths', 'Muted low-string eighths, all down-strokes.', 'D.D.D.D.D.D.D.D.', { bpm: 100 }), LPC.rhythm('Gallop', 'One-two-three, one-two-three: an eighth and two sixteenths.', 'D.DDD.DDD.DDD.DD', { bpm: 90 })] },
    { id: 'r4', name: 'Syncopation', steps: [LPC.rhythm('Off-beat pushes', 'Hit the "and"s: the strokes between the clicks.', '..u...u...u...u.', { bpm: 80 }), LPC.rhythm('The push into the bar', 'Down on one, then anticipate beat three by an eighth.', 'D.....u...u.D...', { bpm: 84 })] },
    { id: 'r5', name: 'In the pocket', steps: [LPC.rhythm('Lock with the drums', 'Eighths with the drummer. Listen to the hi-hat and sit right on it.', 'D.u.D.u.D.u.D.u.', { bpm: 92, bars: 8 })] }
  ] },
  { id: 'tech', ico: '⚙', name: 'Technique', blurb: 'Alternate picking, hammer-ons and pull-offs, slides, string skipping, legato runs.', lessons: [
    { id: 't1', name: 'Alternate picking', steps: [LPC.info('Down, up, down, up', 'Every note alternates, even when you change strings. Small movements from the wrist.'), LPC.timed('One string, sixteenths', 'Fifth fret, high E: four notes per click.', '24:1 24:1 24:1 24:1 24:1 24:1 24:1 24:1 24:1 24:1 24:1 24:1 24:1 24:1 24:1 24:1', { keyPc: 9, near: 5, bpm: 70 }), LPC.timed('Across two strings', 'Alternate as you cross from B to E.', '19:1 22:1 24:1 22:1 19:1 22:1 24:1 22:1 19:1 22:1 24:1 22:1 19:1 22:1 24:1 22:1', { keyPc: 9, near: 5, bpm: 70 })] },
    { id: 't2', name: 'Hammer-ons and pull-offs', steps: [LPC.info('Notes without the pick', 'Pick the first note, then hammer the next finger down hard enough to sound it. Pull-offs flick the finger off sideways. The coach follows the notes; how you sound them is up to you.'), LPC.notes('Hammer, pull', 'Fifth fret, hammer to seventh, pull back to fifth, on the G string.', '10 12h 10p 10 12h 10p', { keyPc: 9, near: 5, lift: 12 }), LPC.notes('Trill', 'Hammer and pull as fast as is even.', '10 12h 10p 12h 10p 12h 10p 12h 10p:4', { keyPc: 9, near: 5, lift: 12 })] },
    { id: 't3', name: 'Slides', steps: [LPC.notes('Slide up a step', 'Seventh fret to ninth on the G string, keeping the pressure on.', '10 12/ 10 12/', { keyPc: 9, near: 5, lift: 12 }), LPC.notes('Slide into the box', 'Slide up into the seventh fret on the D string, then play the box.', '5 7/ 10 12 15 17', { keyPc: 9, near: 5, lift: 12 })] },
    { id: 't4', name: 'String skipping', steps: [LPC.notes('Skip a string', 'Jump from the D string to the B and back.', '7 19 10 22 7 19 10 22', { keyPc: 9, near: 5 }), LPC.timed('Skips in time', 'The same, eighths with the click.', '7 19 10 22 7 19 10 22', { keyPc: 9, near: 5, bpm: 70 })] },
    { id: 't5', name: 'Legato runs', steps: [LPC.notes('Three notes a string', 'A major-scale run, three notes per string, picking only the first of each three.', '0 2h 4h 5 7h 9h 11 12h 14h', { keyPc: 0, near: 8 })] }
  ] },
  { id: 'voice', ico: '🎤', name: 'Singing', blurb: 'Warm up, match a note, sing scales and arpeggios in tune, hold a note, and find where your voice sits.', lessons: [
    { id: 'v1', name: 'Warm up and match a note', steps: [
      LPC.info('Before you sing', 'Stand or sit tall, drop your shoulders, and breathe low: the belly moves, not the chest. Hum on “mmm” for a few seconds, then slide from low to high and back on “ng”, like a siren. The coach cannot follow a slide: that part is for you.'),
      LPC.hold('Match one note', 'Press ▶ Listen, then sing the note on “ah” and hold it. The keyboard shows the note you are singing in orange; move until it sits on the one asked for. Use the Key menu to put it where your voice is comfortable.', '0:8', { secs: 3 }),
      LPC.sing('Three notes up and back', 'Do, re, mi, re, do: on “ah”, or on the names. One clear note at a time; the coach moves on when it hears each one.', '0:4 2:4 4:4 2:4 0:4')] },
    { id: 'v2', name: 'Five notes, and thirds', steps: [
      LPC.info('Why five notes', 'Most melodies live inside five notes. Singing them up and down, slowly and in tune, is the warm-up singers have always used. Move the key up a step each time it feels easy.'),
      LPC.sing('Five up, five down', 'Do re mi fa sol, and back. Keep every note the same loudness.', '0:4 2:4 4:4 5:4 7:4 5:4 4:4 2:4 0:4'),
      LPC.sing('Thirds', 'Skip a note each time: do mi, re fa, mi sol. Hear the jump before you sing it.', '0:4 4:4 2:4 5:4 4:4 7:4 4:8'),
      LPC.hold('Hold the fifth', 'Sing “sol”, the top of the five, and hold it steady for four seconds. Start gently: a held note goes flat when the breath runs out.', '7:8', { secs: 4 })] },
    { id: 'v3', name: 'Arpeggios and the octave', steps: [
      LPC.sing('The major arpeggio', 'Do, mi, sol, and the do above; then back down. These are the notes of a major chord.', '0:4 4:4 7:4 12:4 7:4 4:4 0:4'),
      LPC.sing('The octave jump', 'Low do, high do, and again. Think of the high note before you leave the low one.', '0:4 12:4 0:4 12:4'),
      LPC.sing('The minor arpeggio', 'The same shape with a lowered third: darker. Sing it, then sing the major one again and hear the difference.', '0:4 3:4 7:4 12:4 7:4 3:4 0:4')] },
    { id: 'v4', name: 'The whole scale, in tune', steps: [
      LPC.sing('The major scale', 'All eight notes, up. The seventh wants to go flat: reach for it.', '0:4 2:4 4:4 5:4 7:4 9:4 11:4 12:4'),
      LPC.sing('And back down', 'Coming down, the notes want to sag. Keep each one up where it belongs.', '12:4 11:4 9:4 7:4 5:4 4:4 2:4 0:4'),
      LPC.hold('Hold the top note', 'The high do, steady, for four seconds.', '12:8', { secs: 4 }),
      LPC.info('Your range and your key', 'Open 〰 Voice (in the tools) and press Find my range: sing your lowest and highest comfortable notes. From then on these exercises start where your voice sits, and Find my key says which key suits the song you have open. ⏱ Speed & key moves the song there.')] }
  ] },
  { id: 'warm', ico: '🔥', name: 'Warm-ups', blurb: 'Five minutes before you play: the spider, finger permutations, the chromatic walk, trills, changes, a scale sprint.', lessons: [
    { id: 'w1', name: 'The spider', steps: [LPC.notes('One finger a fret', 'Frets 1-2-3-4 on every string, low to high: one finger per fret, fingers stay down close to the strings.', '0 1 2 3 5 6 7 8 10 11 12 13 15 16 17 18 19 20 21 22 24 25 26 27', { keyPc: 5, near: 1 })] },
    { id: 'w2', name: 'Finger permutations', steps: [LPC.notes('1-3-2-4', 'The awkward order on purpose: frets 1, 3, 2, 4 on each string.', '0 2 1 3 5 7 6 8 10 12 11 13 15 17 16 18 19 21 20 22 24 26 25 27', { keyPc: 5, near: 1 }), LPC.notes('4-3-2-1', 'Backwards, from the little finger.', '3 2 1 0 8 7 6 5 13 12 11 10 18 17 16 15 22 21 20 19 27 26 25 24', { keyPc: 5, near: 1 })] },
    { id: 'w3', name: 'The chromatic walk', steps: [LPC.timed('Up the neck', 'Four notes on the high E, then shift up a fret and again: slow and even.', '0:2 1:2 2:2 3:2 1:2 2:2 3:2 4:2 2:2 3:2 4:2 5:2 3:2 4:2 5:2 6:2', { keyPc: 5, near: 1, lift: 24, bpm: 66 })] },
    { id: 'w4', name: 'Trills', steps: [LPC.timed('A minute of trills', 'Hammer and pull between two frets, in time.', '10:1 12h:1 10p:1 12h:1 10p:1 12h:1 10p:1 12h:1 10p:1 12h:1 10p:1 12h:1 10p:1 12h:1 10p:1 12h:1', { keyPc: 9, near: 5, lift: 12, bpm: 60 })] },
    { id: 'w5', name: 'One-minute changes', steps: [LPC.minute('Em and C', 'As many clean changes as you can in a minute.', ['Em', 'C']), LPC.minute('D and A', 'The same with D and A.', ['D', 'A'])] },
    { id: 'w6', name: 'Scale sprint', steps: [LPC.timed('The box, up and down, faster each time', 'With the tempo ladder on, each clean run adds 5 BPM.', '0 3 5 7 10 12 15 17 19 22 24 22 19 17 15 12', { keyPc: 9, near: 5, bpm: 80, keyed: true })] }
  ] }
];

/* ---------- the riff library ---------- */
const RIFFS = [
  /* blues: A minor pentatonic / blues, box one, lead register */
  ['bl1', 'Box-one turnaround', 'Blues', 1, 80, 9, 0, 5, '24 22 19 22 19 17 15 12:4 r:2', 'Let the last note ring.'],
  ['bl2', 'Bend and resolve', 'Blues', 1, 72, 9, 12, 5, '15b:4 15 12 10 12:6', 'Bend on the beat; let the bend ring before the release.'],
  ['bl3', 'Blue note slide', 'Blues', 2, 76, 9, 12, 5, '12 15 16/ 17 15 12 10:4 7~:6', 'The flat five passes through on the way up: do not stop on it.'],
  ['bl4', 'Shuffle double-stop', 'Blues', 2, 84, 9, 0, 5, '19+24:2 r:2 19+24:2 17+22:2 15+19:2 12:2 10:2 12:4', 'Two strings together, barred with one finger.'],
  ['bl5', 'Slow-blues cry', 'Blues', 3, 60, 9, 0, 7, '22b:6 22 19 17b1:4 15 12~:8', 'Hold the first bend and add vibrato on the top.'],
  ['bl6', 'Low walk-up', 'Blues', 1, 90, 9, 0, 3, '0 3 4 7:4 5 3 0:4 r:2', 'A low shuffle walk on the A and low E.'],
  ['bl7', 'The answering phrase', 'Blues', 2, 80, 9, 12, 5, '10 12 15b:4 12 10 7 10:4 12:2', 'Play it right after a sung line, like a reply.'],
  ['bl8', 'Repeat and push', 'Blues', 3, 92, 9, 0, 8, '24 27 24 22 24 27 24 22 24 27 29b:4 27~:4', 'Same three notes three times, then over the top.'],
  /* rock: E, low strings, power chords and pentatonic */
  ['rk1', 'Power-chord climb', 'Rock', 1, 100, 4, 0, 0, '0+7+12:4 3+10+15:4 5+12+17:4 3+10+15:2 0+7+12:2', 'Move one shape; keep the palm light.'],
  ['rk2', 'Open-E drive', 'Rock', 1, 110, 4, 0, 0, '0:1 0:1 0:2 3:2 0:1 0:1 0:2 5:2 3:2 0:2', 'Chug the open string, punch the fretted notes.'],
  ['rk3', 'Pentatonic hook', 'Rock', 2, 104, 4, 0, 2, '0 3 5 3 7:4 5 3 0 3:4', 'A low hook on the bottom two strings.'],
  ['rk4', 'Pedal-tone run', 'Rock', 2, 112, 4, 12, 12, '0:1 12:1 0:1 10:1 0:1 7:1 0:1 10:1 0:1 12:1 0:1 15:1 0:1 12:1 0:1 10:1', 'Every other note returns to the open string.'],
  ['rk5', 'Stop-time stabs', 'Rock', 1, 96, 4, 0, 0, '0+7+12:2 r:6 5+12+17:2 r:2 3+10+15:2 r:2', 'Silence is part of the riff: stop the strings dead.'],
  ['rk6', 'Arena bend lick', 'Rock', 2, 108, 4, 12, 12, '15b:4 12 15 12 10 12:4 r:4', 'High on the neck at the twelfth fret.'],
  ['rk7', 'Riff with a turn', 'Rock', 3, 120, 4, 0, 0, '0 0 3 0 5 3 0 3:2 0 7 6 5 3 0 3:4', 'The chromatic step from 7 to 5 is the hook.'],
  ['rk8', 'Octave melody', 'Rock', 2, 100, 4, 12, 7, '0+12:4 3+15:4 5+17:4 7+19:2 5+17:2', 'Octave shape: mute the string in between.'],
  /* funk: sixteenths, E and A */
  ['fk1', 'Sixteenth scratch', 'Funk', 1, 96, 4, 12, 7, '0:1 r:1 0x:1 0:1 r:1 3:1 0x:1 5:1 r:2 7:1 5:1 3:1 0:1 r:2', 'Muted strokes keep the hand moving.'],
  ['fk2', 'Ninth-chord stab', 'Funk', 2, 100, 4, 12, 7, '10+14+19:1 r:3 10+14+19:1 r:1 10+14+19:1 r:5 12+16+21:1 r:1 10+14+19:2 r:2', 'Short and percussive; release the pressure right after.'],
  ['fk3', 'Octave pop', 'Funk', 2, 104, 9, 0, 5, '0:1 r:1 12:1 r:1 0:1 0:1 12:1 r:1 3:1 r:1 15:1 r:1 5:1 7:1 r:2', 'Octaves, pecked like a bass player.'],
  ['fk4', 'The one-and', 'Funk', 1, 96, 4, 12, 7, '0:3 0:1 r:2 3:1 5:1 r:4 7:1 5:1 r:2', 'Everything leans on the first beat.'],
  ['fk5', 'Chicken-pick line', 'Funk', 3, 108, 9, 12, 7, '12:1 12x:1 15:1 12x:1 17:1 15:1 12:1 12x:1 10:1 12:1 10x:1 7:1 r:4', 'Alternate the real notes with dead ones.'],
  /* metal: E and D-ish, low and tight */
  ['mt1', 'Gallop chug', 'Metal', 1, 140, 4, 0, 0, '0:2 0:1 0:1 0:2 0:1 0:1 3:2 0:1 0:1 5:2 0:1 0:1', 'All down-strokes on the eighths if you can.'],
  ['mt2', 'Tritone grind', 'Metal', 2, 120, 4, 0, 0, '0:1 0:1 6:2 0:1 0:1 5:2 0:1 0:1 3:2 1:4', 'The flat five gives the menace.'],
  ['mt3', 'Phrygian run', 'Metal', 2, 132, 4, 0, 0, '0:1 1:1 0:1 3:1 0:1 5:1 0:1 3:1 0:1 1:1 0:1 3:1 0:1 6:1 5:1 3:1', 'Open string pedal against the half step.'],
  ['mt4', 'Breakdown stops', 'Metal', 1, 100, 4, 0, 0, '0+7:2 r:2 0+7:1 0+7:1 r:2 0+7:2 r:4 1+8:4', 'Lock the stops to the kick drum.'],
  ['mt5', 'Twin-lead line', 'Metal', 3, 126, 4, 12, 12, '12 14 15 17 19 17 15 14 12 10 12:4', 'Natural minor: picture a harmony a third above.'],
  /* country: G major pentatonic */
  ['cn1', 'Major pentatonic run', 'Country', 1, 100, 7, 12, 2, '0 2 4 7 9 12 9 7 4 2 0:4', 'Bright and open, near the nut.'],
  ['cn2', 'Bend into the third', 'Country', 2, 96, 7, 12, 3, '2b:4 4 2 0 -3:4 0:4', 'Bend the second up to the third, the country sweet spot.'],
  ['cn3', 'Chicken pickin\' lick', 'Country', 3, 112, 7, 12, 3, '9x:1 9:1 7:1 4:1 7x:1 7:1 4:1 2:1 4x:1 4:1 2:1 0:1 r:4', 'Snap the note after each muted one.'],
  ['cn4', 'Walk-down fill', 'Country', 1, 92, 7, 0, 0, '12 11 9 7 4 2 0:4', 'A bass-line walk between chords.'],
  /* pop: major, arpeggios and hooks */
  ['pp1', 'Arpeggio hook', 'Pop', 1, 96, 0, 12, 5, '0 4 7 12 7 4 0:4', 'The chord, one note at a time.'],
  ['pp2', 'Suspended shimmer', 'Pop', 2, 104, 2, 12, 7, '0 5 7 12 7 5 0 2:4 r:2', 'Sus4 resolving to the root.'],
  ['pp3', 'Octave melody', 'Pop', 1, 92, 0, 12, 5, '12:4 11 9 7:4 9 11 12:4', 'Sing it while you play it.'],
  ['pp4', 'Upbeat pluck', 'Pop', 2, 112, 7, 12, 5, 'r:2 4 r:2 7 r:2 9 7 4 2:4', 'Everything on the off-beats.'],
  /* jazz-ish: Dorian, arpeggios */
  ['jz1', 'Dorian line', 'Jazz', 2, 100, 2, 12, 5, '0 2 3 5 7 9 10 9 7 5 3 2 0:4', 'The major sixth is the Dorian colour.'],
  ['jz2', 'Seventh-chord arpeggio', 'Jazz', 2, 96, 2, 12, 5, '0 3 7 10 12 10 7 3 0:4', 'Minor seventh, up and down.'],
  ['jz3', 'Enclosure', 'Jazz', 3, 108, 7, 12, 7, '5 3 4 7 9 8 7 4 2 3 4:4', 'Circle the target note from above and below.'],
  /* reggae and latin */
  ['rg1', 'One-drop bass riff', 'Reggae', 1, 76, 9, 0, 5, 'r:2 0 r:2 0 3 5 r:2 7 5 3 0:2 r:4', 'Leave the first beat empty.'],
  ['rg2', 'Skank melody', 'Reggae', 2, 80, 9, 12, 5, 'r:2 12 r:2 15 r:2 17 r:2 15 r:2 12 r:2 10', 'Upstrokes on the off-beats.'],
  ['lt1', 'Montuno pattern', 'Latin', 3, 100, 0, 12, 5, '0 4 7 4 0 4 7 9 7 4 0 4 7 4 2 4', 'A repeating figure that pushes ahead of the beat.']
].map(([id, name, style, lvl, bpm, keyPc, lift, near, txt, tip]) => { const src = rfParse(txt); return { id: 'rf-' + id, kind: 'notes', name, title: name, style, lvl, bpm, keyPc, lift, near, src, len: rfLen(src), tip, text: style + ' · level ' + lvl + ' · ' + bpm + ' BPM. Listen, then play it note by note; Timed checks it against the click.' }; });
const RIFF_STYLES = [...new Set(RIFFS.map(r => r.style))];
/* progress is kept by step: a lesson's id and the step's place in it, so it survives new lessons being added */
LESSONS.forEach(path => path.lessons.forEach(ls => ls.steps.forEach((s, i) => { s.id = ls.id + '.' + i; })));
