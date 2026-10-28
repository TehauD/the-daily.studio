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
  'Works offline after the first visit; songs and recordings stay on your device'
];

const NAV = [
  ['guide/', 'Guide'], ['guide/getting-started/', 'Start here'], ['guide/record-guitar-and-voice/', 'Record'], ['guide/split-song-into-stems/', 'Stems'],
  ['guide/chords-tab-and-lyrics/', 'Chords & tab'], ['guide/hum-to-song/', 'Hum to song'], ['guide/live-visuals-and-stage-show/', 'Stage & show']
];

/* ------------------------------------------------------------------ the pages */
export const PAGES = [
  {
    slug: 'guide', title: 'How it works: guide and answers',
    description: 'What the-daily.studio does, what it needs, what stays on your device and where its limits are: short answers on recording, stems, chords, tab and the show.',
    h1: 'How the-daily.studio works',
    lead: 'the-daily.studio is a guitar and voice studio that runs in one web page. You can record, split a song into parts to play along with, write the chords, tab and lyrics, and put on a light show. It is free and open source, it needs no account, and your songs and recordings stay on your device.',
    sections: [
      { h: 'Where to start, and what people use it for', topics: true },
      {
        h: 'What it is not', p: ['It is not a plugin host (there is no VST, AU or ASIO support; the effects are built in), and it is not a replacement for a full desktop DAW. The stem splitter is a light, private tool for practice, not studio-grade separation, and the tab and chord detectors are estimates you should review. Each guide below says where its limits are.']
      }
    ],
    faq: [
      ['Is it free?', 'Yes. It is free to use and open source under the MIT licence. There is no account, no subscription and no advert.'],
      ['Do I have to install anything?', 'No. Open the page in a current browser. After your first visit the page keeps a copy of itself, so it also opens without a connection, and you can add it to your home screen or dock like an app.'],
      ['Is my audio uploaded anywhere?', 'No. Recording, stem splitting, chord and tab detection and the show all run in your browser. Songs, takes and settings are kept in this browser on your device. The one optional download is a small camera cut-out model for the stage, which is only fetched if you say yes, and nothing of yours is sent in return.'],
      ['Which browser should I use?', 'A current Chrome or Edge on a computer is the one it is built and tested in. Core features should work in current Firefox and Safari but are less tested; choosing a separate output device and the backup-folder feature need Chromium. Phones and tablets get their own layout.'],
      ['Do I need an audio interface?', 'No. Any microphone works. To record a guitar and a voice at the same time, use a two-input interface (a Focusrite Scarlett Solo, 2i2 or 4i4, for example), which the browser sees as one device with two channels.'],
      ['How accurate are the chords and the tab?', 'They are estimates. Chords from a clear recording are usually good; dense mixes can fool them. On the built-in synthetic self-test the tab detector scores about 87 % F1, and real rooms and heavy distortion do worse, so the app shows how sure it is of each note and lets you accept or reject before anything is applied.'],
      ['Who makes it?', 'Tehau DeBarthe, as an open-source project. The source, the licence and the third-party notices are public.']
    ],
    related: ['record-guitar-and-voice', 'split-song-into-stems', 'chords-tab-and-lyrics', 'hum-to-song', 'live-visuals-and-stage-show']
  },
  {
    slug: 'getting-started', title: 'Getting started: your first song in two minutes',
    description: 'New here? Choose what you want to do (hum a song, record, learn a song or run a show) and a short guided session walks you through it. Free, in your browser.',
    h1: 'Getting started with the-daily.studio',
    lead: 'You do not need to know a studio from a stage. The first page asks what you want to do, not how good you are, and a small card then takes you through it one step at a time. Each step ticks off when the app sees you do it.',
    img: { src: 'start.webp', alt: 'The first page of the-daily.studio: four cards asking what you would like to do first: turn a hum into a song, record guitar and voice, learn a song, or run a show', w: 1280, h: 720 },
    sections: [
      { h: 'Pick what you want to do', ul: ['Turn a hum into a song: hum or sing a few seconds and a whole band plays it back, with chords.', 'Record guitar and voice: plug in or use your microphone and capture both in one take.', 'Learn a song: split it into drums, bass, vocals and guitar, mute your part and play along.', 'Run a show: lights, lasers and visuals for a room, with a preflight list for the output.'] },
      { h: 'How a guided session works', ol: ['A small card names one step and points at the control with a pulsing outline.', 'You do the step. The app notices (a hum recorded, a take stopped, a test pattern shown) and ticks it off.', 'Stuck? Press Show me to be taken there, or Skip. Leave at any time and come back to the same place.', 'Finishing a session adds tools to the tab strip, so the studio grows with you instead of starting crowded.'] },
      { h: 'Help that stays out of the way', p: ['The first time you open a tab, a short note says what it is and gives one thing to try. Press Got it and it folds into a small line. A list of studio words, explained in guitar terms (lane, clip, take, arm, stem, latency), is under Help. If you already know your way around, choose that on the first page and every tool is on from the start, with no notes.'] },
      { h: 'For a technician', p: ['The Show session is a preflight: pick a look, check the rig, open the output, run a test pattern, set the master level, try the blackout, then play the song once and watch the flash meter. The same checklist sits in the Output tab of Show setup. The lasers and lights are a screen simulation; there is no DMX or ILDA output.'] }
    ],
    faq: [
      ['Do I have to take the guided sessions?', 'No. Choose Begin in the studio, or I know my way around, and there is no coaching. You can start a session later from the Help button.'],
      ['Does it ask for the microphone straight away?', 'No. Nothing is requested until you press a button that needs it, and the guided session says so before it asks.'],
      ['Where is my work kept?', 'On your device, in this browser. Nothing is uploaded.']
    ],
    related: ['hum-to-song', 'record-guitar-and-voice', 'split-song-into-stems', 'live-visuals-and-stage-show']
  },
  {
    slug: 'record-guitar-and-voice', title: 'Record guitar and voice in your browser',
    description: 'Record guitar and microphone at once in your browser: two-input interfaces, count-in, punch-in, dry and wet takes, editable clips, WAV export. Free, private.',
    h1: 'Record guitar and voice in your browser',
    lead: 'Plug in a guitar, sing into a microphone, or do both at once. Every take goes into a multitrack arrangement that you can move, trim, fade and mix, and it stays on your device.',
    img: { src: 'record.webp', alt: 'The arrangement in the-daily.studio with a vocal take and a guitar take as clips on their own lanes, above the pedal rig', w: 1280, h: 720 },
    sections: [
      {
        h: 'What you need', p: ['Any microphone will do. For a guitar and a voice together, use an audio interface with two inputs (a Focusrite Scarlett Solo, 2i2 or 4i4, for example). The browser sees such an interface as one device with two channels, and the-daily.studio reads input 1 and input 2 separately: one as the guitar, one as the vocal.',
          'Nothing is switched on until you press connect. The browser then asks for the microphone, and that is how a web page reads an audio interface.']
      },
      {
        h: 'Record a take', ol: ['Choose your interface in the I/O panel and press Connect.', 'Press Set my level, play or sing as loud as you will, and the input trim is set for you.', 'Arm the guitar lane, the vocal lane or both, then press R. After the count-in, every armed lane records on the same clock, so the takes line up with each other and with the band.',
          'Press R again to stop. One press is one take, however long it is; the song grows to fit what you played.']
      },
      { h: 'Dry and wet, kept together', p: ['The guitar lane records the clean signal and the processed one, so you can re-amp the take through a different tone later or export either. The vocal lane records the microphone, with an optional high-pass and gentle compression.'] },
      { h: 'Fix it without starting again', p: ['Each recording is a clip. Move it, trim it, fade it, split it, or duplicate it. Punch in over a single mistake, delete a range and close the gap, and set per-clip gain and crossfades. One undo history covers the song, the takes and the mix.'] },
      { h: 'Mix and export', p: ['Each lane has volume, pan, mute, solo and send effects. Auto-balance sets starting levels from measured loudness. Export a master WAV that is rendered faster than real time with its loudness reported, each part as its own WAV, or all takes as dry and wet files.'] },
      { h: 'Honest limits', p: ['Latency is set by your computer, your interface and your browser; the app measures a real round-trip with a loopback test rather than guessing. A device that exposes only one channel (a webcam microphone, for example) cannot be split into guitar and vocal. Effects are built in; there is no VST, AU or ASIO support.'] }
    ],
    faq: [
      ['Can I record guitar and vocals at the same time?', 'Yes, with a two-input audio interface: one input as Guitar, the other as Vocal, both lanes armed. With a single microphone you can record one source at a time and layer the takes.'],
      ['Are my recordings uploaded?', 'No. Takes are stored in this browser on your device, in your song, and leave only when you export them.'],
      ['Can I hear myself while I record?', 'Yes. Hear myself plays the rig live. If your interface has its own direct monitoring, leave the app monitor off to avoid hearing everything twice, and wear headphones so a microphone cannot feed back.']
    ],
    related: ['split-song-into-stems', 'chords-tab-and-lyrics', 'hum-to-song']
  },
  {
    slug: 'split-song-into-stems', title: 'Split a song into stems in your browser',
    description: 'Separate a song into drums, bass, vocals and guitar/other in your browser and mute the part you play. Free, private and honest about its limits.',
    h1: 'Split a song into stems in your browser',
    lead: 'Load a song and it comes apart into drums, bass, vocals and a guitar / other part. Mute the one you play and jam over the rest, loop a hard bar, or sing over the backing. The audio is analysed on your device; nothing is uploaded.',
    img: { src: 'stems.webp', alt: 'The Stems panel: a waveform of the mix and four stems, drums, bass, vocals and guitar or other, each with mute, solo and level', w: 1280, h: 720 },
    sections: [
      {
        h: 'What you get', ul: ['Four stems: drums, bass, vocals, and guitar / keys / other. Each has mute, solo, a level and a WAV export, and a note of how present it is in the track.', 'Practice presets in one click: Play the guitar, Play the bass, Karaoke and Drummer\'s out.',
          'The tempo, key and the chord of every bar, with a drum groove you can copy to the band.', 'A loop: Shift-click the waveform to set where it starts and Alt-click to set where it ends.', 'The track and its stems also appear as lanes in the arrangement, on the bar grid, so you can record along with them.']
      },
      { h: 'How to use it', ol: ['Open the Stems tab and press Load backing track. Any audio file your browser can decode works.', 'Wait for the progress bar. The analysis runs in a worker on your computer.', 'Pick a practice preset or mute and solo the stems yourself.', 'Use Import chords as the song, or Track + band together, to carry the result into the rest of the studio.'] },
      {
        h: 'How it separates, honestly', p: ['This is classical signal processing, not a trained neural network: harmonic and percussive separation, a bass harmonic comb and a centre-channel vocal mask. That keeps everything on your device and makes it fast, and it means the result is for practice, not for a release. Drums, bass and vocals come out best; the guitar / other stem is whatever is left, and the app cannot tell whether a guitar is in the track at all. On a synthetic benchmark the drums, bass and vocals are recovered well to moderately, and the remainder poorly.',
          'If you need studio-grade stems, use a neural separator built for that. If you want a private, instant way to play along, this is for you.']
      },
      { h: 'Use music you have the right to use', p: ['The app ships with no songs. A file you load stays on your device and is not shared. Make sure you have the right to use any track you split, and do not publish stems of music you do not own.'] }
    ],
    faq: [
      ['Is it as good as an AI stem splitter?', 'No. AI separators use large trained models and give cleaner stems. This one uses lighter signal processing, so it is private, immediate and works offline, with rougher results, especially on the guitar / other part.'],
      ['Does it upload my song?', 'No. The file is decoded and analysed in your browser and is never sent anywhere.'],
      ['Which files can I load?', 'Any audio file your browser can decode, for example WAV, MP3 or M4A. A long file takes longer to analyse.']
    ],
    related: ['chords-tab-and-lyrics', 'record-guitar-and-voice', 'hum-to-song']
  },
  {
    slug: 'chords-tab-and-lyrics', title: 'Chords, tab and lyrics from audio',
    description: 'Detect the tempo, key and chords of a song, turn audio into guitar tab for your tuning, put lyrics under the chords and export ChordPro, MIDI or a print sheet.',
    h1: 'Chords, tab and lyrics from a song or your playing',
    lead: 'Load a song or record yourself and the studio writes down what it hears: the tempo, the key, the chord of every bar, and guitar tab placed on strings and frets for your tuning. Put lyrics underneath and print or export the sheet.',
    img: { src: 'tab.webp', alt: 'The tab editor with chords over a bar of notes, string names for the current tuning, and the lyric sheet below', w: 1280, h: 720 },
    sections: [
      { h: 'Chords from audio', p: ['Load a track in Stems and the app reports its tempo, key and the chord of every bar, with the drum groove it found. If it chose double- or half-time, one button halves or doubles the tempo; if the bar lines are a beat out, nudge the downbeat. Then import the chords as your song.'] },
      { h: 'Audio to tab', p: ['Transcribe turns a take, an imported file or a live recording into polyphonic tab. Notes are placed on strings and frets for your tuning and capo (standard, Drop D, Eb and the others the app supports) and coloured by how sure the detector is. Accept or reject notes, then apply them to the song, replacing bars or filling empty ones.'] },
      { h: 'Write and edit', p: ['The tab editor takes fret numbers from the keyboard or an on-screen keypad on a phone, with hammer-ons, pull-offs, slides, bends, vibrato and muted notes. Fill bar and Fill section offer fingerstyle and strumming patterns to start from.'] },
      { h: 'Lyrics under the chords', p: ['Type, paste or drop in a .txt or .lrc lyric file and the chords sit over the words, section by section.'] },
      { h: 'Share the sheet', p: ['Export Ultimate Guitar style text, ChordPro, MIDI, a master WAV, a one-file share page that plays in any browser, or a print sheet with chords over the words, which the browser can save as a PDF.'] },
      { h: 'Honest accuracy', p: ['Detection is an estimate. On the built-in self-test, which transcribes synthetic guitar with known notes, the tab detector scores about 87 % F1 in standard tuning, and that is an upper bound: a real room, a noisy interface or heavy distortion will do worse, and low tunings such as Drop B are less accurate. Chords are good on clear recordings and can be fooled by dense mixes. Review before you apply. It supports six-string guitars.'] }
    ],
    faq: [
      ['Can it write tab from any song?', 'It can try on any audio you load. Results are best on a clean, single-instrument recording of a guitar and weaker on a full mix, where the guitar has to be found among everything else.'],
      ['Does it support alternate tunings and a capo?', 'Yes. The string names, the fret placement and the transcriber follow the tuning and capo you choose.'],
      ['Which formats can I export?', 'Ultimate Guitar style text, ChordPro, MIDI, WAV, a one-file HTML share page, and a print sheet that can be saved as a PDF.']
    ],
    related: ['split-song-into-stems', 'hum-to-song', 'record-guitar-and-voice']
  },
  {
    slug: 'hum-to-song', title: 'Hum a melody and get a whole song',
    description: 'Hum or sing for 10 to 30 seconds and get a full song: your notes, key and tempo, chords and every section, played by a band. Free and private, in your browser.',
    h1: 'Hum a melody and get a whole song',
    lead: 'Press Hum or sing, hum for ten to thirty seconds, and the studio finds your notes, key and tempo, picks chords, builds the sections of a song and plays it back with a band. Then change anything you like.',
    img: { src: 'hum.webp', alt: 'The Hum to Song window over the studio: one button to hum or sing a few seconds of melody, and an Options section for style, tempo and key', w: 1280, h: 720 },
    sections: [
      { h: 'How it works', ol: ['Press Hum or sing. The browser asks for the microphone only now.', 'Hum or sing for 10 to 30 seconds. No words or instrument are needed. A big letter shows the note you are singing.', 'Press Stop. In a few seconds you have a song: intro, verse, chorus, verse, chorus, bridge, chorus and outro, played by a band with your melody on lead guitar.', 'Change the style (folk, pop, rock, ballad or dance), the tempo, the key and mode, or the song shape, or ask for different chords. Add lyrics, edit any chord, or open it in the full studio.'] },
      { h: 'What it can and cannot do', p: ['It follows one voice at a time, so hum single notes in a quiet room. It assumes 4/4. The song is arranged by rules from music theory and played by the app\'s own band; it is not an AI audio model, and nothing is sent anywhere. A voice memo or audio file can be used instead of the microphone.'] },
      { h: 'Where it goes next', p: ['The song is saved on your device automatically. From there you can record guitar and voice over it, split the chords into tab, write lyrics under them, and share a one-file player or a print sheet.'] }
    ],
    faq: [
      ['Do I need to sing words?', 'No. Hum or la-la. The app only needs the melody.'],
      ['Is the song generated by AI?', 'No. The notes, key and tempo are measured from your humming, and the arrangement is built from music-theory rules and played by the studio\'s own band, in your browser.'],
      ['Can I keep working on it?', 'Yes. Open the result in the studio to edit the chords, record over it, write lyrics and export it.']
    ],
    related: ['chords-tab-and-lyrics', 'record-guitar-and-voice', 'live-visuals-and-stage-show']
  },
  {
    slug: 'live-visuals-and-stage-show', title: 'Live visuals and light show for your music',
    description: 'A browser stage with moving lights, haze, an LED wall and simulated lasers that follow your song, a show designer, full-screen output and light comfort limits.',
    h1: 'Live visuals and a light show for your music',
    lead: 'The Show view turns a song into a stage: moving lights, haze and an LED wall that follow the chords and the drums, and laser patterns drawn on screen. Design the look like a lighting technician, send it full screen to a projector or screen, and keep it comfortable to watch.',
    img: { src: 'show.webp', alt: 'The stage in the-daily.studio: moving-head beams, haze, an LED wall and lasers over the band, with the show setup panel beside it', w: 1280, h: 720 },
    sections: [
      { h: 'A stage that plays with the song', p: ['Everything on the stage moves with the song\'s position in bars, not a timer, so the same moment always looks the same and a four-bar sweep comes back to where it started every four bars. Drum hits, bass notes, chords and lead notes arrive from the band, so the light lands where the music does. With no song playing, your own notes move the show.'] },
      { h: 'Set up the show', p: ['The show setup panel works like a lighting desk: choose a look, set the colours, the number and spread of the moving lights, the haze, the LED wall and the laser patterns, decide what each section does, and add your own pictures for a backdrop, the LED wall or a logo. Save looks and share them as a file.'] },
      { h: 'Output for a room', p: ['Go full screen on a second display or projector, or open a clean output window with nothing on it but the picture. A master level, blackout and freeze keys, mirror and flip for rear or ceiling projection, safe-frame guides and test patterns (bars, grid, ramp, grey, white, black) help you line the picture up. Record the stage as a video with the song\'s sound.'] },
      { h: 'Light comfort', p: ['Flashes are limited. Calm, Standard and Full set how much the lights may strobe and how hard they pulse, and a limiter watches the picture itself and eases off if it flashes too much. It is an engineering safeguard, not a medical guarantee. If you or your audience are sensitive to flashing light, choose Calm or turn the strobe off.'] },
      { h: 'What the lasers are', p: ['The lasers are drawn on the screen. Nothing in the app drives laser hardware.'] }
    ],
    faq: [
      ['Can it control real lights or lasers?', 'No. It is a visual simulation on a screen or projector. It does not send DMX, ILDA or any other control signal.'],
      ['Are my pictures uploaded?', 'No. Stage pictures are kept in this browser and are not part of song files.'],
      ['Can I use it for a live set?', 'Yes, as a screen or projector visual. Check it on the actual display and computer beforehand: how smooth it is depends on your graphics hardware, and the app lowers its detail on its own if it runs slowly.']
    ],
    related: ['hum-to-song', 'record-guitar-and-voice', 'chords-tab-and-lyrics']
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

const CSS = `:root{color-scheme:light dark;--bg:#f4f4f1;--fg:#16191a;--mute:#4f5a58;--line:#cfd3cf;--card:#fff;--acc:#264238;--accfg:#fff;--link:#1d5a43}
@media (prefers-color-scheme:dark){:root{--bg:#0d0f10;--fg:#e8e8e6;--mute:#a4aeab;--line:#2a3032;--card:#15191a;--acc:#7dbf9b;--accfg:#0d0f10;--link:#8fd1ac}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:var(--link);text-underline-offset:3px}a:focus-visible,summary:focus-visible{outline:3px solid var(--acc);outline-offset:2px;border-radius:4px}
header.top{border-bottom:1px solid var(--line)}header.top .in,main,footer .in{max-width:880px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left));padding-right:max(16px,env(safe-area-inset-right))}
header.top .in{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding-top:12px;padding-bottom:12px}
.brand{display:flex;align-items:center;gap:10px;color:inherit;text-decoration:none;font-weight:700;letter-spacing:-.01em}.brand svg{width:34px;height:34px}.brand .tld{color:var(--acc)}
nav.pages{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:15px;margin-left:auto}nav.pages a{color:var(--mute);text-decoration:none;padding:4px 0}nav.pages a:hover,nav.pages a[aria-current]{color:var(--fg);text-decoration:underline}
main{padding-top:30px;padding-bottom:56px}nav.crumbs{font-size:14px;color:var(--mute);margin-bottom:6px}nav.crumbs a{color:var(--mute)}
h1{font-size:clamp(28px,5vw,40px);line-height:1.15;letter-spacing:-.02em;margin:.1em 0 .4em}h2{font-size:23px;line-height:1.25;margin:1.7em 0 .4em;letter-spacing:-.01em}h3{font-size:18px;margin:1.2em 0 .25em}
p.lead{font-size:19px;color:var(--mute);margin:0 0 1.1em;max-width:62ch}p,li{max-width:68ch}li{margin:.3em 0}
.cta{display:inline-block;margin:.4em 0 1em;padding:12px 20px;border-radius:10px;background:var(--acc);color:var(--accfg);font-weight:700;text-decoration:none}.cta:hover{filter:brightness(1.08)}
figure{margin:1.4em 0}figure img{display:block;width:100%;height:auto;border-radius:12px;border:1px solid var(--line);background:var(--card)}figcaption{font-size:14px;color:var(--mute);margin-top:6px}
.topics{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;padding:0;list-style:none;margin:0}.topics li{margin:0;max-width:none}
.topics a{display:block;height:100%;padding:14px 16px;background:var(--card);border:1px solid var(--line);border-radius:12px;color:inherit;text-decoration:none}.topics a:hover{border-color:var(--acc)}.topics b{display:block;color:var(--link);margin-bottom:4px}.topics span{font-size:15px;color:var(--mute)}
dl.faq dt{font-weight:700;margin-top:1.1em}dl.faq dd{margin:.2em 0 0;max-width:68ch;color:var(--fg)}
footer{border-top:1px solid var(--line);color:var(--mute);font-size:14px}footer .in{padding-top:18px;padding-bottom:30px}footer a{color:var(--mute)}footer p{max-width:none}`;

const li = t => `<li>${esc(t)}</li>`;
function section(s) {
  let o = `<section><h2>${esc(s.h)}</h2>`;
  if (s.topics) o += `<ul class="topics">${PAGES.filter(p => p.slug !== 'guide').map(p => `<li><a href="${p.slug}/"><b>${esc(p.h1)}</b><span>${esc(p.description.split('. ')[0].replace(/\.$/, ''))}.</span></a></li>`).join('')}</ul>`;
  if (s.p) o += s.p.map(t => `<p>${esc(t)}</p>`).join('');
  if (s.ul) o += `<ul>${s.ul.map(li).join('')}</ul>`;
  if (s.ol) o += `<ol>${s.ol.map(li).join('')}</ol>`;
  return o + '</section>';
}
/** one complete static page (no script, its own strict policy) */
export function renderPage(p, { version, modified }) {
  const url = pageUrl(p), mark = markSvg({ hex: 'currentColor', ink: 'currentColor', bars: false, k: 1.5 }), depth = p.slug === 'guide' ? '../' : '../../';
  const nav = NAV.map(([h, t]) => `<a href="${depth}${h}"${(h === 'guide/' && p.slug === 'guide') || h.includes('/' + p.slug + '/') ? ' aria-current="page"' : ''}>${esc(t)}</a>`).join('');
  const related = (p.related || []).map(r => byRef(r)).filter(Boolean);
  const imgTag = p.img ? `<figure><img src="${depth}guide/img/${esc(p.img.src)}" width="${p.img.w}" height="${p.img.h}" alt="${esc(p.img.alt)}" fetchpriority="high" decoding="async"><figcaption>${esc(p.img.alt.split(':')[0])}.</figcaption></figure>` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'">
<title>${esc(p.title)} · ${SITE.name}</title><meta name="description" content="${esc(p.description)}"><link rel="canonical" href="${url}"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="theme-color" content="#0d0f10"><meta name="color-scheme" content="light dark"><meta name="author" content="${esc(SITE.author)}"><meta name="referrer" content="no-referrer">
<meta property="og:type" content="article"><meta property="og:site_name" content="${SITE.name}"><meta property="og:locale" content="en_US"><meta property="og:url" content="${url}"><meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.description)}"><meta property="og:image" content="${SITE.card}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="the-daily.studio: lyrics, chords, recording and stems in one browser page">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(p.title)}"><meta name="twitter:description" content="${esc(p.description)}"><meta name="twitter:image" content="${SITE.card}">
<link rel="icon" href="${depth}icons/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="${depth}icons/apple-touch-icon.png">
<script type="application/ld+json">${pageJsonLd(p, modified)}</script>
<style>${CSS}</style></head><body>
<header class="top"><div class="in"><a class="brand" href="${depth}" aria-label="${SITE.name}: open the studio">${mark}<span>the-daily<span class="tld">.studio</span></span></a><nav class="pages" aria-label="Guide pages">${nav}</nav></div></header>
<main>
<nav class="crumbs" aria-label="Breadcrumb"><a href="${depth}">${SITE.name}</a> › ${p.slug === 'guide' ? 'Guide' : `<a href="${depth}guide/">Guide</a> › ${esc(p.h1)}`}</nav>
<h1>${esc(p.h1)}</h1>
<p class="lead">${esc(p.lead)}</p>
<a class="cta" href="${depth}">Open the studio, free</a>
${imgTag}
${p.sections.map(section).join('\n')}
${p.faq ? `<section><h2>Questions</h2><dl class="faq">${p.faq.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join('')}</dl></section>` : ''}
${related.length ? `<section><h2>Keep reading</h2><ul class="topics">${related.map(r => `<li><a href="${p.slug === 'guide' ? '' : '../'}${r.slug}/"><b>${esc(r.h1)}</b><span>${esc(r.description.split('. ')[0].replace(/\.$/, ''))}.</span></a></li>`).join('')}</ul></section>` : ''}
<p><a class="cta" href="${depth}">Open the studio, free</a></p>
</main>
<footer><div class="in"><p>${SITE.name} v${esc(version)} · free and open source (MIT) · no account, no tracking, your audio stays on your device. <a href="${depth}legal/">Licences, notices and privacy</a> · <a href="${SITE.repo}" rel="noopener noreferrer">Source on GitHub</a> · by <a href="${SITE.authorUrl}" rel="noopener noreferrer">${esc(SITE.author)}</a></p></div></footer>
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
