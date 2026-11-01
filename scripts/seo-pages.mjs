/* the-daily.studio: the public guide pages and the structured data (schema.org JSON-LD) that describe the app to search engines.
   One page is one question a person might type into a search box. Every claim here is one the app keeps (see docs/USER_GUIDE.md and
   README "Accuracy and honest limits"); where a feature has a limit, the page says so.
   Used by scripts/assemble.mjs (writes dist/guide/**), scripts/build.mjs (JSON-LD in index.html, sitemap.xml) and scripts/verify-site.mjs. */
import { markSvg } from './brand-mark.mjs';

export const SITE = {
  origin: 'https://the-daily.studio', name: 'the-daily.studio', author: 'Tehau DeBarthe', authorUrl: 'https://github.com/TehauD',
  repo: 'https://github.com/TehauD/the-daily.studio', card: 'https://the-daily.studio/icons/social-card.png',
  tagline: 'a guitar and voice studio in your browser',
  title: 'the-daily.studio — free guitar and voice studio in your browser',
  description: 'Record guitar and voice, split a song into stems, get chords, tab and lyrics, and run a live light show. Free, private, in your browser: no account, no uploads.'
};

/** the things the app does, in the words people search with (also the JSON-LD featureList) */
export const FEATURES = [
  'Record guitar and microphone at the same time, with a count-in, punch-in and editable takes',
  'Split a song into drums, bass, vocals and guitar/other stems to practise along with',
  'Get the tempo, key and chords of a song, and polyphonic guitar tab from audio',
  'Write lyrics under chords, and export ChordPro, Ultimate Guitar text, MIDI, WAV or a print sheet',
  'Hum or sing a melody and get a whole song with a band',
  'Pedal rig, amps and tones for live guitar',
  'A live light-show stage that follows the chords and drums, with a show designer for technicians',
  'Perform with big chords and scrolling lyrics, and record wide or vertical videos of the stage',
  'Keep your whole studio in step on every computer through a folder you choose or your own GitHub repository',
  'Works offline after the first visit; songs and recordings stay on your device'
];

const NAV = [
  ['guide/', 'Guide'], ['guide/getting-started/', 'Start'], ['guide/record-guitar-and-voice/', 'Record'], ['guide/guitar-tones-and-rig/', 'Tones'], ['guide/split-song-into-stems/', 'Stems'],
  ['guide/chords-tab-and-lyrics/', 'Chords & tab'], ['guide/hum-to-song/', 'Hum'], ['guide/live-visuals-and-stage-show/', 'Stage'], ['guide/perform-and-share/', 'Perform'], ['guide/keep-your-studio-in-sync/', 'Sync']
];

/* ------------------------------------------------------------------ the pages
   A page: title, description, h1, ico (its card), eyebrow, lead, img, glance (cards: [icon, title, one line]), sections ({h, p, ul, ol (steps), topics}),
   limits (the "Good to know" box: what it does not do, honestly), faq, related. Short sentences; one idea a card. */
export const PAGES = [
  {
    slug: 'guide', ico: '📖', title: 'How it works: guide and answers',
    description: 'What the-daily.studio does, what it needs, what stays on your device and where its limits are: short answers on recording, stems, chords, tab and the show.',
    h1: 'How the-daily.studio works', eyebrow: 'Guide',
    lead: 'A guitar and voice studio in one web page. Record, play along with any song, write chords, tab and lyrics, shape your tone and put on a light show. It is free and open source, there is no account, and your audio never leaves your device.',
    sections: [
      { h: 'Pick a topic', topics: true },
      { h: 'New lately', ul: ['Folder sync (2.22): your whole studio, recordings too, in a folder you choose. Put it in iCloud Drive, Dropbox, Google Drive or OneDrive and every computer has the same studio.', 'Your studio on GitHub (2.21): settings, presets, looks and songs in a private repository of your own, with a gallery of looks and rigs others share.', 'Wide and vertical videos (2.19): record the stage in 16:9 for YouTube or 9:16 for Reels, TikTok and Shorts, with your own video loops behind you.', 'Zero-delay effects (2.18): the guitar rig adds almost no delay, and every take lines up with the band.', 'A tip jar (2.17): your own tip link as a QR code on the stage, in videos and on share pages.'] }
    ],
    limits: ['It is not a plugin host: there is no VST, AU or ASIO support, and the effects are built in.', 'It is not a full desktop DAW. It is a fast, private sketchpad and practice room that also records, mixes and exports.', 'The stem splitter, the chord finder and the tab transcriber are light, private tools that give good estimates, not studio-grade results.'],
    faq: [
      ['Is it free?', 'Yes. It is free to use and open source under the MIT licence. There is no account, no subscription and no advert.'],
      ['Do I have to install anything?', 'No. Open the page in a current browser. After your first visit the page keeps a copy of itself, so it also opens without a connection, and you can add it to your home screen or dock like an app.'],
      ['Is my audio uploaded anywhere?', 'No. Recording, stem splitting, chord and tab detection and the show all run in your browser. Songs, takes and settings are kept in this browser on your device. The one optional download is a small camera cut-out model, and only if you say yes to it.'],
      ['Which browser should I use?', 'A current Chrome or Edge on a computer is the one it is built and tested in. Core features also work in current Firefox and Safari; choosing a separate output device and folder sync need Chrome or Edge on a computer.'],
      ['Do I need an audio interface?', 'No. Any microphone works. To record a guitar and a voice at the same time, use a two-input interface (a Focusrite Scarlett Solo, 2i2 or 4i4, for example), which the browser sees as one device with two channels.'],
      ['How accurate are the chords and the tab?', 'They are estimates. Chords from a clear recording are usually good; dense mixes can fool them. On the built-in synthetic self-test the tab detector scores about 87 % F1, and real rooms and heavy distortion do worse.'],
      ['Who makes it?', 'Tehau DeBarthe, as an open-source project. The source, the licence and the third-party notices are public.']
    ],
    related: ['getting-started', 'record-guitar-and-voice', 'keep-your-studio-in-sync']
  },
  {
    slug: 'getting-started', blurb: 'Pick what you want to do; a short guided session shows you how.', ico: '🧭', title: 'Getting started: your first song in two minutes',
    description: 'New here? Choose what you want to do (hum a song, record, learn a song or run a show) and a short guided session walks you through it. Free, in your browser.',
    h1: 'Getting started with the-daily.studio', eyebrow: 'Start here',
    lead: 'You do not need to know a studio from a stage. The first page asks what you want to do, not how good you are, and a small card then takes you through it one step at a time. Each step ticks off when the app sees you do it.',
    img: { src: 'start.webp', alt: 'The first page of the-daily.studio: four cards asking what you would like to do first: turn a hum into a song, record guitar and voice, learn a song, or run a show', w: 1280, h: 720 },
    glance: [['🎵', 'Turn a hum into a song', 'Hum or sing a few seconds and a whole band plays it back, with chords.'], ['🎙', 'Record, loop and layer', 'Plug in or use your microphone, loop a few bars and play a lead on top.'], ['🎧', 'Learn a song', 'Load a track, mute your part and play along, looping the hard bit.'], ['💡', 'Run a show', 'A preflight for the stage: look, rig, output, test pattern, levels, blackout.']],
    sections: [
      { h: 'How a guided session works', ol: ['A small card names one step and outlines the control it means.', 'You do the step. The app notices (a hum recorded, a take stopped, a test pattern shown) and ticks it off. Nothing is faked.', 'Show me takes you to the control, Skip moves on, and you can fold the card or drag it out of the way.', 'At the end, the tools you used stay in your tab strip. Start, resume or repeat any session from Help ▸ Guided sessions.'] },
      { h: 'Help that stays out of the way', p: ['The first time you open a tab, a short note says what it is and gives one thing to try. Press Got it and it folds into a small line. DAW words, in guitar terms explains lane, clip, take, arm, dry and wet, latency and the rest in a sentence a guitarist would use.'] },
      { h: 'Coming back', p: ['When you return, the first page says where you are: when you last practised, your streak, what you are working on, your latest recording and your progress this year. Pick up where I left off opens the song you were on. My progress shows the chords you have learned and how often your chord changes land in time. It is counts and dates only, kept on your device.'] }
    ],
    limits: ['Choose I know my way around on the first page to open every tool with no coaching; you can start a session later.', 'Nothing asks for the microphone or camera until you press a button that needs it.'],
    faq: [
      ['Do I have to take the guided sessions?', 'No. Choose I know my way around, and there is no coaching. You can start a session later from the Help button.'],
      ['Does it ask for the microphone straight away?', 'No. Nothing is requested until you press a button that needs it, and the guided session says so before it asks.'],
      ['Where is my work kept?', 'On your device, in this browser. Nothing is uploaded. To have it on another computer too, use folder sync or your own GitHub repository.']
    ],
    related: ['hum-to-song', 'record-guitar-and-voice', 'live-visuals-and-stage-show']
  },
  {
    slug: 'record-guitar-and-voice', blurb: 'Guitar and voice at once, zero-delay effects, takes you can edit.', ico: '🎙', title: 'Record guitar and voice in your browser',
    description: 'Record guitar and microphone at once in your browser: two-input interfaces, zero-delay effects, count-in, punch-in, loops, editable clips, WAV export. Free.',
    h1: 'Record guitar and voice in your browser', eyebrow: 'Record',
    lead: 'Plug in a guitar, sing into a microphone, or do both at once. Every take goes into a multitrack arrangement that you can move, trim, fade and mix, and it stays on your device.',
    img: { src: 'record.webp', alt: 'The arrangement in the-daily.studio with a vocal take and a guitar take as clips on their own lanes, above the pedal rig', w: 1280, h: 720 },
    glance: [['🎚', 'Two inputs at once', 'A two-input interface records guitar and voice together, each on its own lane.'], ['⚡', 'Zero-delay effects', 'The rig adds almost no delay, and takes line up with the band by themselves.'], ['✂', 'Takes are clips', 'Move, trim, fade, split and duplicate; punch in over one mistake.'], ['⟲', 'Loop and layer', 'Loop 1 to 8 bars and stack layers like a looper pedal.'], ['🎛', 'Dry and wet', 'The clean guitar is kept beside the processed one, to re-amp later.'], ['⤓', 'Mix and export', 'Volume, pan, sends, auto-balance, and a WAV rendered in seconds.']],
    sections: [
      { h: 'Record a take', ol: ['Choose your interface in the I/O panel and press Connect. The browser asks for the microphone now, which is how a web page reads an audio interface.', 'Press Set my level, play or sing as loud as you will, and the input trim is set for you.', 'Arm the guitar lane, the vocal lane, or both, and press R. A count-in plays first.', 'Press R again to stop. One press is one take, however long; the song grows to fit what you played.'] },
      { h: 'Loop and layer', p: ['Loop & layer works like a looper pedal: choose 1, 2, 4 or 8 bars, play chords for one pass, and the loop comes round while you play a lead on top. Each pass is another layer. Layers are ordinary takes afterwards, so you can trim, mute and mix them.'] },
      { h: 'Mix and export', p: ['Each lane has volume, pan, mute, solo and send effects. Auto-balance sets starting levels from measured loudness. A master WAV is rendered faster than real time and reports its loudness (LUFS) and true peak, or save compressed audio, stems and single clips.'] }
    ],
    limits: ['Latency is set by your computer, interface and browser. The app measures a real round trip with a loopback test, and compensates for it, rather than guessing.', 'A device that offers only one input records one source at a time.', 'Use headphones when you play along through speakers, or the band can be recorded with you.'],
    faq: [
      ['Can I record guitar and vocals at the same time?', 'Yes, with a two-input audio interface: one input as Guitar, the other as Vocal, both lanes armed. With a single microphone you can record one after the other.'],
      ['Are my recordings uploaded?', 'No. Takes are stored in this browser on your device, in your song, and leave only when you export them or keep them in a folder you chose.'],
      ['Can I hear myself while I record?', 'Yes. Hear myself plays the rig live with almost no added delay. If your interface has its own direct monitoring, leave the app monitor off to avoid hearing yourself twice.']
    ],
    related: ['guitar-tones-and-rig', 'split-song-into-stems', 'perform-and-share']
  },
  {
    slug: 'guitar-tones-and-rig', blurb: 'A full pedalboard, amps and 27 tones, with scenes for live use.', ico: '🎛', title: 'Guitar amps, pedals and tones in your browser',
    description: 'Play through a pedalboard and amps in your browser: 27 starting tones, scenes for live switching, zero-delay effects, your own impulse responses. Free.',
    h1: 'Guitar amps, pedals and tones in your browser', eyebrow: 'Tones',
    lead: 'Plug in and play through a full pedalboard: gate, compressor, drive, amps, cabinets, modulation, delay and reverb, all computed in the page. Start from a preset, shape it with real knobs, and switch whole boards mid-song.',
    img: { src: 'tones.webp', alt: 'The Rig panel in the-daily.studio: the tone presets on the left and a pedalboard of drive, amp, cabinet, delay and reverb pedals with knobs', w: 1280, h: 720 },
    glance: [['🎚', 'A full pedalboard', 'Gate, compressor, wah, drive, fuzz, pitch, EQ, chorus, phaser, flanger, tremolo, delay, reverb.'], ['🔊', 'Amps and cabinets', 'Clean, Chime, Crunch, Lead and Hi-Gain amps; six cabinets, or your own impulse response.'], ['🎨', '27 starting tones', 'From Crystal Clean to heavy and ambient. Search, filter, click to load.'], ['🎬', 'Scenes', 'Eight snapshots of the whole board, recalled with a smooth morph, by key or MIDI.'], ['⚡', 'Zero-delay effects', 'The compressor and drives run in audio worklets that add almost no delay.'], ['↺', 'Re-amp later', 'The clean guitar is recorded too, so a take can go through another tone afterwards.']],
    sections: [
      { h: 'Get a sound in two minutes', ol: ['Connect your input (Audio at the top right) and turn on Hear myself.', 'Pick a starting tone in Tones on the left.', 'Shape it on the Rig: drag a knob, hold Shift for fine moves, double-click to reset. Drag a pedal’s header to change its place in the chain.', 'Store two snapshots as A and B and morph between them, or press Mutate for a happy accident.', 'Save it as your own preset, or export it as a file.'] },
      { h: 'Play it live', p: ['Stomp view turns the board into big footswitch tiles. Number keys recall scenes when Live keys is on and 0 switches every pedal off. Bind a footswitch to a key or a MIDI note, right-click any knob to MIDI-learn it, and let Scenes + band switch the band with the board.'] }
    ],
    limits: ['The effects are built in, not plugins: there is no VST, AU or ASIO support.', 'The amps are models computed in the browser, voiced by ear. They are good for practice, writing and recording ideas, not a copy of a particular amplifier.', 'MIDI control needs a browser with Web MIDI (Chrome and Edge; Firefox asks permission; Safari has none).'],
    faq: [
      ['Does the rig add latency?', 'Almost none. With zero-delay effects (on by default) the rig adds a fraction of a millisecond; turning it off uses the browser’s own compressor and oversampling, about 20 ms more. What remains is your interface and browser, which the app measures and compensates.'],
      ['Can I use my own cabinet impulse response?', 'Yes. The Cabinet / IR pedal loads an impulse response file, as well as its six built-in cabinets.'],
      ['Can I use a MIDI foot controller?', 'Yes, in a browser with Web MIDI: bind footswitches to MIDI notes, MIDI-learn any knob, and recall scenes.']
    ],
    related: ['record-guitar-and-voice', 'perform-and-share', 'split-song-into-stems']
  },
  {
    slug: 'split-song-into-stems', blurb: 'Drums, bass, vocals and the rest: mute your part and play along.', ico: '🎚', title: 'Split a song into stems in your browser',
    description: 'Separate a song into drums, bass, vocals and guitar/other in your browser and mute the part you play. Free, private and honest about its limits.',
    h1: 'Split a song into stems in your browser', eyebrow: 'Stems',
    lead: 'Load a song and it comes apart into drums, bass, vocals and a guitar / other part. Mute the one you play and jam over the rest, loop a hard bar, or sing over the backing. The audio is analysed on your device and never uploaded.',
    img: { src: 'stems.webp', alt: 'The Stems panel: a waveform of the mix and four stems, drums, bass, vocals and guitar or other, each with mute, solo and level', w: 1280, h: 720 },
    glance: [['🥁', 'Four stems', 'Drums, bass, vocals, and guitar / keys / other, each with mute, solo, level and WAV export.'], ['🎯', 'Practice presets', 'Play the guitar, Play the bass, Karaoke and Drummer’s out, in one click.'], ['🎼', 'Tempo, key and chords', 'The chord of every bar, and a drum groove you can copy to the band.'], ['⟲', 'Loop the hard bit', 'Shift-click the waveform to set where a loop starts, Alt-click where it ends.'], ['🎛', 'On the bar grid', 'The track and its stems appear as lanes, so you can record along with them.']],
    sections: [
      { h: 'How to use it', ol: ['Open the Stems tab and press Load backing track. Any audio file your browser can decode works.', 'Wait for the progress bar. The analysis runs in a worker on your computer.', 'Pick a practice preset, or mute and solo the stems yourself, and loop the bar you are learning.', 'Use Import chords as the song, or Track + band together, to carry the result into the rest of the studio.'] },
      { h: 'Use music you have the right to use', p: ['The app ships with no songs. A file you load stays on your device and is not shared. Make sure you have the right to use any track you split, and do not publish stems of music that is not yours.'] }
    ],
    limits: ['This is classical signal processing, not a trained neural network: harmonic and percussive separation, a bass comb and a centre-channel vocal mask. Expect some bleed between stems.', 'It is meant for practice: private, instant and offline. For studio-grade stems, use a neural separator built for that.'],
    faq: [
      ['Is it as good as an AI stem splitter?', 'No. AI separators use large trained models and give cleaner stems. This one uses lighter signal processing, so it is private, immediate and works offline.'],
      ['Does it upload my song?', 'No. The file is decoded and analysed in your browser and is never sent anywhere.'],
      ['Which files can I load?', 'Any audio file your browser can decode, for example WAV, MP3 or M4A. A long file takes longer to analyse.']
    ],
    related: ['chords-tab-and-lyrics', 'record-guitar-and-voice', 'guitar-tones-and-rig']
  },
  {
    slug: 'chords-tab-and-lyrics', blurb: 'Chords, key and tempo from audio, tab for your tuning, lyric sheets.', ico: '🎼', title: 'Chords, tab and lyrics from audio',
    description: 'Detect the tempo, key and chords of a song, turn audio into guitar tab for your tuning, put lyrics under the chords and export ChordPro, MIDI or a print sheet.',
    h1: 'Chords, tab and lyrics from a song or your playing', eyebrow: 'Chords & tab',
    lead: 'Load a song or record yourself and the studio writes down what it hears: the tempo, the key, the chord of every bar, and guitar tab placed on strings and frets for your tuning. Put lyrics under the chords and share a clean sheet.',
    img: { src: 'tab.webp', alt: 'The tab editor with chords over a bar of notes, string names for the current tuning, and the lyric sheet below', w: 1280, h: 720 },
    glance: [['🎼', 'Chords from audio', 'Tempo, key and the chord of every bar, with a half- or double-time fix.'], ['🎸', 'Audio to tab', 'Polyphonic tab on strings and frets for your tuning and capo.'], ['⌨', 'Tab editor', 'Hammer-ons, pull-offs, slides, bends, vibrato and muted notes, from the keyboard or a keypad.'], ['📝', 'Lyrics under chords', 'Type, paste or drop a .txt or .lrc file; chords sit over the words.'], ['⇪', 'Share the sheet', 'Ultimate Guitar text, ChordPro, MIDI, a print or PDF sheet, a one-file share page.']],
    sections: [
      { h: 'From sound to sheet', ol: ['Load a track in Stems, or record a take.', 'Read the tempo, key and chords it found, and change any chord you hear differently.', 'Open Transcribe to turn a take or a file into tab for your tuning.', 'Write or paste the lyrics, then export the sheet you need.'] },
      { h: 'Tunings and capo', p: ['Standard, Drop D, Eb, open tunings and your own: the string names, the fret placement, the chord shapes and the transcriber all follow the tuning and capo you choose.'] }
    ],
    limits: ['Detection is an estimate. On the built-in self-test, which transcribes synthetic guitar with known notes, the tab detector scores about 87 % F1 in standard tuning; real rooms and heavy distortion score lower.', 'Results are best on a clean recording of one guitar, and weaker on a full mix where the guitar has to be found first.'],
    faq: [
      ['Can it write tab from any song?', 'It can try on any audio you load. Results are best on a clean, single-instrument recording of a guitar and weaker on a full mix.'],
      ['Does it support alternate tunings and a capo?', 'Yes. The string names, the fret placement and the transcriber follow the tuning and capo you choose.'],
      ['Which formats can I export?', 'Ultimate Guitar style text, ChordPro, MIDI, WAV, a one-file HTML share page, and a print sheet that can be saved as a PDF.']
    ],
    related: ['split-song-into-stems', 'hum-to-song', 'perform-and-share']
  },
  {
    slug: 'hum-to-song', blurb: 'Hum ten seconds and a band plays it back as a whole song.', ico: '🎵', title: 'Hum a melody and get a whole song',
    description: 'Hum or sing for 10 to 30 seconds and get a full song: your notes, key and tempo, chords and every section, played by a band. Free and private, in your browser.',
    h1: 'Hum a melody and get a whole song', eyebrow: 'Hum to song',
    lead: 'Press Hum or sing, hum for ten to thirty seconds, and the studio finds your notes, key and tempo, picks chords, builds the sections of a song and plays it back with a band. Then change anything you like.',
    img: { src: 'hum.webp', alt: 'The Hum to Song window over the studio: one button to hum or sing a few seconds of melody, and an Options section for style, tempo and key', w: 1280, h: 720 },
    glance: [['👂', 'Your notes, measured', 'Pitch, key and tempo come from your voice, not a guess.'], ['🎹', 'Chords that fit', 'Chosen by music-theory rules to sit under your melody.'], ['🧱', 'A whole song', 'Intro, verses, choruses and an ending, built around your idea.'], ['🥁', 'A band plays it', 'Drums, bass and rhythm guitar in the style you pick.']],
    sections: [
      { h: 'How it works', ol: ['Press Hum or sing. The browser asks for the microphone only now.', 'Hum or sing for 10 to 30 seconds. No words or instrument needed. A big letter shows the note you are on.', 'The studio finds the melody, picks chords and builds a song, then plays it with the band.', 'Change the feel, the tempo or the key, and keep it.'] },
      { h: 'Where it goes next', p: ['The song is saved on your device. From there you can record guitar and voice over it, turn the chords into tab, write lyrics under them, perform it, and share it.'] }
    ],
    limits: ['It follows one voice at a time, so hum single notes in a quiet room.', 'It assumes 4/4. The arrangement is built by rules and played by the studio’s own band; it is not a generated recording.'],
    faq: [
      ['Do I need to sing words?', 'No. Hum or la-la. The app only needs the melody.'],
      ['Is the song generated by AI?', 'No. The notes, key and tempo are measured from your humming, and the arrangement is built from music-theory rules and played by the studio’s own band, in your browser.'],
      ['Can I keep working on it?', 'Yes. Open the result in the studio to edit the chords, record over it, write lyrics and export it.']
    ],
    related: ['chords-tab-and-lyrics', 'record-guitar-and-voice', 'getting-started']
  },
  {
    slug: 'live-visuals-and-stage-show', blurb: 'Lights, lasers and an LED wall that follow the music.', ico: '💡', title: 'Live visuals and light show for your music',
    description: 'A browser stage with moving lights, haze, an LED wall and simulated lasers that follow your song, a show designer, full-screen output and light comfort limits.',
    h1: 'Live visuals and a light show for your music', eyebrow: 'Stage',
    lead: 'The Show view turns a song into a stage: moving lights, haze and an LED wall that follow the chords and the drums, and laser patterns drawn on screen. Design the look like a lighting technician, then send it to a projector or a second screen.',
    img: { src: 'show.webp', alt: 'The stage in the-daily.studio: moving-head beams, haze, an LED wall and lasers over the band, with the show setup panel beside it', w: 1280, h: 720 },
    glance: [['🎶', 'Plays with the song', 'Moves by bars and beats, so the same moment always looks the same.'], ['🎛', 'A show designer', 'Looks, colours, moving lights, haze, the LED wall and laser patterns, like a lighting desk.'], ['🖥', 'Output for a room', 'Full screen or a clean output window, with blackout, freeze, mirror and test patterns.'], ['🎞', 'Your own video', 'Your own video loops behind you, at the song’s speed, tinted to the chord.'], ['🛡', 'Light comfort', 'Calm, Standard and Full limit flashing, and a limiter watches the picture itself.']],
    sections: [
      { h: 'Set up a show', ol: ['Open the Stage and pick a look.', 'Open the output on the projector or second screen and run a test pattern.', 'Set the master level and try the blackout.', 'Play the song once and watch the flash meter. The preflight ticks each step as you do it.'] },
      { h: 'Pictures and video', p: ['Drop a band photo, a poster or a logo onto the stage as a backdrop, an LED pixel wall or a logo. Add your own video loops behind you; they change with the sections and breathe with the music. Pictures and videos stay in this browser.'] }
    ],
    limits: ['The lasers are drawn on the screen. Nothing in the app sends DMX, ILDA or any other control signal to real lights or lasers.', 'Light comfort is an engineering safeguard, not a medical guarantee. If you or your audience are sensitive to flashing light, choose Calm or turn the strobe off.', 'How smooth it is depends on your graphics hardware; the app lowers its detail on its own if it runs slowly.'],
    faq: [
      ['Can it control real lights or lasers?', 'No. It is a visual simulation on a screen or projector. It does not send DMX, ILDA or any other control signal.'],
      ['Are my pictures uploaded?', 'No. Stage pictures and videos are kept in this browser and are not part of song files.'],
      ['Can I use it for a live set?', 'Yes, as a screen or projector visual. Check it on the actual display and computer beforehand.']
    ],
    related: ['perform-and-share', 'hum-to-song', 'guitar-tones-and-rig']
  },
  {
    slug: 'perform-and-share', blurb: 'Big chords on stage, videos for every screen, share pages, tips.', ico: '🎤', title: 'Perform live and share your songs from the browser',
    description: 'Perform with big chords and scrolling lyrics, record wide or vertical videos of your stage, save one-file share pages, and add a tip jar QR code.',
    h1: 'Perform live and share what you make', eyebrow: 'Perform & share',
    lead: 'Play a song with the chord huge on screen and the lyrics scrolling with you. Record the stage as a video shaped for YouTube or for Reels, send a song as one file that plays anywhere, and let the room tip you by scanning a code.',
    img: { src: 'perform.webp', alt: 'Perform in the-daily.studio: the current chord in large type, the next chord under it, the chord shapes beside them and the lyrics scrolling with the song', w: 1280, h: 720 },
    glance: [['🎤', 'Perform', 'The chord huge, the next one under it, lyrics scrolling, a big count-in.'], ['◫', 'Three displays', 'Chords and shapes, a big chord, or a lyric sheet like a songbook.'], ['▯', 'Wide and vertical video', '1920 × 1080 or 1080 × 1920, with the words and chord in large type if you like.'], ['📄', 'A one-file share page', 'The sound, the lyrics and the chords in one HTML file that loads nothing.'], ['🔊', 'Audio and print', 'A WAV with its loudness measured, M4A, and a print or PDF sheet.'], ['🎸', 'A tip jar', 'Your own tip link as a QR code on the stage, in videos and on share pages.']],
    sections: [
      { h: 'Play a song live', ol: ['Press 🎤 Perform in the song bar.', 'The readiness check looks at your audio, input level, camera and lyrics, and sets the count-in.', 'Press Start performing. Space plays or stops, R records, Esc leaves.', 'A take you record goes straight into your song.'] },
      { h: 'Record the stage', p: ['⏺ Record the stage saves a video of the visuals with the song’s sound. Wide 16:9 suits YouTube, a website or a TV; Vertical 9:16 suits Reels, TikTok and Shorts, with the camera cropped to keep you in the middle. Quality is 1080p on a computer and 720p on a phone or tablet, and you can choose either.'] },
      { h: 'A tip jar, if you want one', p: ['In Creator Studio, paste your Ko-fi, PayPal.me, Venmo, Cash App or other link, and it appears as a QR code in a small open guitar case: on the stage, in your videos and on share pages, or printed as a sign for a real case. It is off unless you set it up.'] }
    ],
    limits: ['How smooth a video is depends on your device; 720p is smoother on a phone, and the app suggests it if frames arrive late.', 'The studio never opens your tip link or sees a payment: that is between you, your audience and the service you chose.', 'A share page carries the sound you put in it. Share only music you have the right to share.'],
    faq: [
      ['Can I post a vertical video to Reels, TikTok or Shorts?', 'Yes. Vertical 9:16 records at 1080 × 1920, with the line being sung and the chord in large type at the bottom if you like.'],
      ['Does a share page need the internet?', 'No. It is one HTML file with the sound inside it. It opens in any browser and loads nothing from anywhere.'],
      ['Does the app take a cut of tips?', 'No. The code points straight at your own link. The studio is not part of the payment.']
    ],
    related: ['live-visuals-and-stage-show', 'record-guitar-and-voice', 'keep-your-studio-in-sync']
  },
  {
    slug: 'keep-your-studio-in-sync', blurb: 'Your whole studio on every computer, through a folder or GitHub.', ico: '🔄', title: 'Keep your music studio in sync on every computer',
    description: 'Keep songs, recordings and settings the same on every computer with folder sync (iCloud Drive, Dropbox, Google Drive, OneDrive) or GitHub. No account.',
    h1: 'Your studio, on every computer', eyebrow: 'Sync & backup',
    lead: 'Your work lives in your browser. Choose a folder in a cloud drive and the whole studio, recordings too, stays the same on every computer that chooses it. Or keep it in a private GitHub repository, or in one backup file you hold yourself.',
    img: { src: 'sync.webp', alt: 'Settings, Folder sync in the-daily.studio: the chosen folder, in step, with Sync now, Change and Turn off', w: 1280, h: 720 },
    glance: [['📁', 'Folder sync', 'Songs with their recordings, settings, presets and looks, in a folder you choose.'], ['☁', 'Any cloud drive', 'iCloud Drive, Dropbox, Google Drive or OneDrive carries the folder between computers.'], ['⑂', 'GitHub', 'A private repository of your own, with every change in its history.'], ['🗜', 'A backup you hold', 'One zip with every song, take and backing track, to keep anywhere.']],
    sections: [
      { h: 'Set up folder sync', ol: ['Open Settings ▸ Folder sync and press Choose a folder.', 'Pick a folder inside your cloud drive. The studio is kept in a folder named the-daily.studio inside it.', 'On your other computer, choose the same folder. Its studio becomes the same.', 'From then on it syncs a few seconds after a change, when the page opens, and every minute while it is open; never while a song plays or records.'] },
      { h: 'When two computers change the same song', p: ['Both versions are kept: the other one arrives as “… (from another device)”. If both saved before the cloud drive caught up, the drive keeps a second file, and the studio keeps that version as a song too. A song deleted on one computer stays on the other until you delete it there as well, and a song can arrive before its recordings; it opens without them until they land, and saving it never drops them.'] },
      { h: 'GitHub, for people who live there', p: ['Settings ▸ GitHub keeps your settings, presets, looks, notes and songs (as text) in a private repository of your own, one commit per sync, so every change has a history. You can also share chosen looks and rigs in public and browse what others share.'] }
    ],
    limits: ['Folder sync needs Chrome or Edge on a computer. After a browser restart, the browser may ask once to allow access again.', 'GitHub keeps text, not recordings: takes and backing tracks stay on the devices that made them.', 'On iPhone and iPad, Safari clears a website’s data after about a week without a visit unless you add it to the Home Screen. The app tells you, and Back up all songs makes one file to keep.'],
    faq: [
      ['Do you keep my songs on a server?', 'No. The page asks no server to keep anything. With folder sync the browser writes a folder on your own computer, and your cloud drive’s app carries it under that drive’s terms. With GitHub, your browser talks to GitHub directly.'],
      ['Does folder sync work on a phone?', 'No. It needs Chrome or Edge on a computer, where the browser can open a folder. GitHub sync works wherever the studio does, for everything but recordings.'],
      ['What happens if two computers change the same song?', 'Both versions are kept, so neither edit is lost. Delete the one you do not want.']
    ],
    related: ['getting-started', 'record-guitar-and-voice', 'perform-and-share']
  }
];

/* ------------------------------------------------------------------ rendering */
export const esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** JSON for a <script type="application/ld+json"> block: "</" and "<!--" can never close or open anything */
export const ldJson = o => JSON.stringify(o).replace(/</g, '\\u003c');
export const pageUrl = p => `${SITE.origin}/guide/${p.slug === 'guide' ? '' : p.slug + '/'}`;
export const byRef = s => PAGES.find(p => p.slug === s);

/** the structured data for the app's own page: the site, the web application and its author */
export function appJsonLd(version, modified) {
  return ldJson({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': SITE.origin + '/#site', url: SITE.origin + '/', name: SITE.name, description: SITE.description, inLanguage: 'en', publisher: { '@id': SITE.origin + '/#author' } },
      {
        '@type': 'WebApplication', '@id': SITE.origin + '/#app', url: SITE.origin + '/', name: SITE.name, alternateName: 'The Daily', description: SITE.description, applicationCategory: 'MultimediaApplication', applicationSubCategory: 'Music',
        operatingSystem: 'Any operating system with a current web browser', browserRequirements: 'Requires JavaScript and the Web Audio API. Chrome or Edge recommended.', softwareVersion: version, dateModified: modified, inLanguage: 'en', isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, license: 'https://opensource.org/licenses/MIT', image: SITE.card, featureList: FEATURES, author: { '@id': SITE.origin + '/#author' }, isPartOf: { '@id': SITE.origin + '/#site' }, sameAs: [SITE.repo], mainEntityOfPage: SITE.origin + '/'
      },
      { '@type': 'Person', '@id': SITE.origin + '/#author', name: SITE.author, url: SITE.authorUrl }
    ]
  });
}
function pageJsonLd(p, modified) {
  const url = pageUrl(p), crumbs = [{ '@type': 'ListItem', position: 1, name: SITE.name, item: SITE.origin + '/' }, { '@type': 'ListItem', position: 2, name: 'Guide', item: SITE.origin + '/guide/' }];
  if (p.slug !== 'guide') crumbs.push({ '@type': 'ListItem', position: 3, name: p.h1, item: url });
  const g = [
    { '@type': 'WebPage', '@id': url, url, name: p.title, description: p.description, inLanguage: 'en', dateModified: modified, isPartOf: { '@id': SITE.origin + '/#site' }, about: { '@id': SITE.origin + '/#app' }, breadcrumb: { '@id': url + '#crumbs' }, ...(p.img ? { primaryImageOfPage: { '@type': 'ImageObject', url: SITE.origin + '/guide/img/' + p.img.src, width: p.img.w, height: p.img.h } } : {}) },
    { '@type': 'BreadcrumbList', '@id': url + '#crumbs', itemListElement: crumbs }
  ];
  if (p.faq) g.push({ '@type': 'FAQPage', '@id': url + '#faq', mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
  return ldJson({ '@context': 'https://schema.org', '@graph': g });
}

/* the look: the studio's own colours, Inter and Montserrat (the same files, served beside the pages), one column for words and pictures */
const CSS = d => `@font-face{font-family:"DS Inter";src:url(${d}fonts/inter-latin-wght.woff2) format("woff2");font-weight:100 900;font-display:swap}
@font-face{font-family:"DS Montserrat";src:url(${d}fonts/montserrat-latin-wght.woff2) format("woff2");font-weight:100 900;font-display:swap}
:root{color-scheme:light dark;--bg:#e9e9e6;--panel:#f4f4f1;--raise:#fff;--line:#d6d8d3;--text:#0d0f10;--muted:#4f5c56;--accent:#2f7a58;--ink:#fff;--gold:#9a6512;--soft:#e0ebe4;--link:#1d6a49;
--sans:"DS Inter",Inter,"Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif;--display:"DS Montserrat",Montserrat,var(--sans);--shadow:0 1px 2px rgba(13,15,16,.07),0 8px 24px rgba(13,15,16,.06);--col:760px}
@media (prefers-color-scheme:dark){:root{--bg:#0d0f10;--panel:#151a18;--raise:#1b221f;--line:#26302b;--text:#e8e8e6;--muted:#9fb3a7;--accent:#7dbf9b;--ink:#06100b;--gold:#d4a25a;--soft:#1d2a24;--link:#8fd1ac;--shadow:0 1px 2px rgba(0,0,0,.5),0 12px 32px rgba(0,0,0,.35)}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--text);font:17px/1.65 var(--sans);-webkit-font-smoothing:antialiased}
a{color:var(--link);text-underline-offset:3px}a:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:2px;border-radius:6px}
.wrap{width:100%;max-width:calc(var(--col) + 32px);margin:0 auto;padding-left:max(16px,env(safe-area-inset-left));padding-right:max(16px,env(safe-area-inset-right))}
header.top{position:sticky;top:0;z-index:2;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
header.top .bar{max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:18px;padding:10px max(16px,env(safe-area-inset-right)) 10px max(16px,env(safe-area-inset-left))}
.brand{display:flex;align-items:center;gap:10px;color:inherit;text-decoration:none;font:800 16px var(--display);letter-spacing:-.01em;flex:none}.brand svg{width:30px;height:30px}.brand .tld{color:var(--accent)}
nav.pages{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;margin-left:auto;font-size:14px;font-weight:600}nav.pages::-webkit-scrollbar{display:none}
nav.pages a{color:var(--muted);text-decoration:none;padding:6px 10px;border-radius:99px;white-space:nowrap}nav.pages a:hover{color:var(--text);background:var(--panel)}nav.pages a[aria-current]{color:var(--ink);background:var(--accent)}
main{padding-top:28px;padding-bottom:56px}nav.crumbs{font-size:13px;color:var(--muted);margin-bottom:14px}nav.crumbs a{color:var(--muted)}
.eyebrow{display:inline-block;font:700 12px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin:0 0 8px}
h1{font:800 clamp(30px,5.4vw,46px)/1.08 var(--display);letter-spacing:-.025em;margin:0 0 14px}h2{font:800 24px/1.25 var(--display);letter-spacing:-.015em;margin:44px 0 12px}
p{margin:0 0 14px}p.lead{font-size:19px;line-height:1.6;color:var(--muted);margin:0 0 20px}
.ctas{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 26px}.cta,.cta2{display:inline-flex;align-items:center;gap:8px;padding:12px 20px;border-radius:12px;font-weight:700;text-decoration:none}
.cta{background:var(--accent);color:var(--ink);box-shadow:var(--shadow)}.cta:hover{filter:brightness(1.07)}.cta2{border:1px solid var(--line);color:var(--text);background:var(--raise)}.cta2:hover{border-color:var(--accent)}
figure{margin:0 0 8px}figure img{display:block;width:100%;height:auto;border-radius:14px;border:1px solid var(--line);background:var(--panel);box-shadow:var(--shadow)}figcaption{font-size:13px;color:var(--muted);margin-top:8px}
ul,ol{margin:0 0 14px;padding-left:1.3em}li{margin:.35em 0}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;list-style:none;padding:0;margin:0}.cards li{margin:0}
.card{height:100%;padding:16px;border:1px solid var(--line);border-radius:14px;background:var(--raise)}.card .ico{display:block;font-size:22px;line-height:1;margin-bottom:10px}.card b{display:block;font:700 16px/1.3 var(--sans);margin-bottom:4px}.card span.t{display:block;font-size:15px;line-height:1.5;color:var(--muted)}
a.card{display:block;color:inherit;text-decoration:none;transition:border-color .15s,transform .15s}a.card:hover{border-color:var(--accent);transform:translateY(-1px)}
ol.steps{list-style:none;counter-reset:s;padding:0}ol.steps li{counter-increment:s;position:relative;padding:2px 0 10px 48px;margin:0}
ol.steps li::before{content:counter(s);position:absolute;left:0;top:0;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font:800 15px var(--display);color:var(--ink);background:var(--accent)}
ol.steps li:not(:last-child)::after{content:"";position:absolute;left:15.5px;top:36px;bottom:2px;width:1px;background:var(--line)}
aside.good{margin:40px 0 0;padding:18px 20px;border-radius:14px;background:var(--soft);border:1px solid var(--line)}aside.good h2{margin:0 0 8px;font-size:19px}aside.good ul{margin:0}aside.good li{color:var(--text)}
details{border:1px solid var(--line);border-radius:12px;background:var(--raise);margin:0 0 8px}summary{cursor:pointer;padding:14px 44px 14px 16px;font-weight:700;list-style:none;position:relative}summary::-webkit-details-marker{display:none}
summary::after{content:"+";position:absolute;right:16px;top:50%;transform:translateY(-50%);font:400 22px var(--sans);color:var(--muted)}details[open] summary::after{content:"–"}details p{margin:0;padding:0 16px 16px;color:var(--muted)}
.end{margin-top:40px;padding:22px;border-radius:16px;background:var(--panel);border:1px solid var(--line);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}.end p{margin:0;font-weight:600}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:13px}footer .wrap{padding-top:18px;padding-bottom:30px}footer a{color:var(--muted)}
@media (max-width:560px){body{font-size:16px}p.lead{font-size:17px}h2{margin-top:36px}.cards{grid-template-columns:1fr 1fr}.card{padding:13px}.card span.t{font-size:14px}}
@media (max-width:380px){.cards{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){a.card{transition:none}a.card:hover{transform:none}}`;

const li = t => `<li>${esc(t)}</li>`;
const card = (ico, t, d) => `<div class="card"><span class="ico" aria-hidden="true">${esc(ico)}</span><b>${esc(t)}</b><span class="t">${esc(d)}</span></div>`;
const firstLine = p => p.blurb || p.description.split('. ')[0].replace(/\.$/, '') + '.';
const topicCards = (list, pre) => `<ul class="cards">${list.map(p => `<li><a class="card" href="${pre}${p.slug}/"><span class="ico" aria-hidden="true">${esc(p.ico)}</span><b>${esc(p.h1)}</b><span class="t">${esc(firstLine(p))}</span></a></li>`).join('')}</ul>`;
function section(s, p) {
  let o = `<section><h2>${esc(s.h)}</h2>`;
  if (s.topics) o += topicCards(PAGES.filter(x => x.slug !== 'guide'), '');
  if (s.p) o += s.p.map(t => `<p>${esc(t)}</p>`).join('');
  if (s.ul) o += `<ul>${s.ul.map(li).join('')}</ul>`;
  if (s.ol) o += `<ol class="steps">${s.ol.map(li).join('')}</ol>`;
  return o + '</section>';
}
/** one complete static page (no script, its own strict policy) */
export function renderPage(p, { version, modified }) {
  const url = pageUrl(p), mark = markSvg({ hex: 'currentColor', ink: 'currentColor', bars: false, k: 1.5 }), depth = p.slug === 'guide' ? '../' : '../../';
  const nav = NAV.map(([h, t]) => `<a href="${depth}${h}"${(h === 'guide/' && p.slug === 'guide') || h.includes('/' + p.slug + '/') ? ' aria-current="page"' : ''}>${esc(t)}</a>`).join('');
  const related = (p.related || []).map(r => byRef(r)).filter(Boolean);
  const imgTag = p.img ? `<figure><img src="${depth}guide/img/${esc(p.img.src)}" width="${p.img.w}" height="${p.img.h}" alt="${esc(p.img.alt)}" fetchpriority="high" decoding="async"><figcaption>${esc(p.img.alt.split(':')[0])}.</figcaption></figure>` : '';
  const glance = p.glance ? `<section><h2>At a glance</h2><ul class="cards">${p.glance.map(g => `<li>${card(...g)}</li>`).join('')}</ul></section>` : '';
  const second = p.slug === 'guide' ? `<a class="cta2" href="getting-started/">New here? Start here →</a>` : `<a class="cta2" href="${p.slug === 'guide' ? '' : '../'}">All topics</a>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'">
<title>${esc(p.title)} · ${SITE.name}</title><meta name="description" content="${esc(p.description)}"><link rel="canonical" href="${url}"><meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="article"><meta property="og:site_name" content="${SITE.name}"><meta property="og:locale" content="en_US"><meta property="og:url" content="${url}"><meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.description)}"><meta property="og:image" content="${p.img ? SITE.origin + '/guide/img/' + p.img.src : SITE.card}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(p.title)}"><meta name="twitter:description" content="${esc(p.description)}"><meta name="twitter:image" content="${p.img ? SITE.origin + '/guide/img/' + p.img.src : SITE.card}">
<link rel="icon" href="${depth}icons/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="${depth}icons/apple-touch-icon.png">
<link rel="preload" href="${depth}fonts/inter-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
<script type="application/ld+json">${pageJsonLd(p, modified)}</script>
<style>${CSS(depth)}</style></head><body>
<header class="top"><div class="bar"><a class="brand" href="${depth}" aria-label="${SITE.name}: open the studio">${mark}<span>the-daily<span class="tld">.studio</span></span></a><nav class="pages" aria-label="Guide topics">${nav}</nav></div></header>
<main class="wrap">
<nav class="crumbs" aria-label="Breadcrumb"><a href="${depth}">${SITE.name}</a> › ${p.slug === 'guide' ? 'Guide' : `<a href="${depth}guide/">Guide</a> › ${esc(p.eyebrow || p.h1)}`}</nav>
<p class="eyebrow">${esc(p.eyebrow || 'Guide')}</p>
<h1>${esc(p.h1)}</h1>
<p class="lead">${esc(p.lead)}</p>
<div class="ctas"><a class="cta" href="${depth}">Open the studio, free</a>${second}</div>
${imgTag}
${glance}
${p.sections.map(s => section(s, p)).join('\n')}
${p.limits ? `<aside class="good" aria-labelledby="good-${p.slug}"><h2 id="good-${p.slug}">Good to know</h2><ul>${p.limits.map(li).join('')}</ul></aside>` : ''}
${p.faq ? `<section><h2>Questions</h2>${p.faq.map(([q, a], i) => `<details${i ? '' : ' open'}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section>` : ''}
${related.length ? `<section><h2>Keep reading</h2>${topicCards(related, p.slug === 'guide' ? '' : '../')}</section>` : ''}
<div class="end"><p>Free, private, in your browser. Nothing to install.</p><a class="cta" href="${depth}">Open the studio</a></div>
</main>
<footer><div class="wrap">${SITE.name} v${esc(version)} · free and open source (MIT) · no account, no tracking, your audio stays on your device · <a href="${depth}legal/">Licences, notices and privacy</a> · <a href="${SITE.repo}" rel="noopener noreferrer">Source on GitHub</a> · by <a href="${SITE.authorUrl}" rel="noopener noreferrer">${esc(SITE.author)}</a></div></footer>
</body></html>
`;
}

/** sitemap.xml: the app, the guide and the pages under it, the journal; lastmod from the newest CHANGELOG entry */
export function sitemap(modified) {
  const urls = [[SITE.origin + '/', '1.0'], ...PAGES.map(p => [pageUrl(p), p.slug === 'guide' ? '0.8' : '0.7']), [SITE.origin + '/journal/', '0.4']];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, pr]) => `  <url><loc>${u}</loc><lastmod>${modified}</lastmod><priority>${pr}</priority></url>`).join('\n')}\n</urlset>\n`;
}
/** the links under the first page's buttons (also in <noscript>), so every guide is one crawlable link away from the app */
export function guideLinks(prefix = '') {
  return NAV.map(([h, t]) => `<a href="${prefix}${h}">${esc(t)}</a>`).join(' · ');
}
