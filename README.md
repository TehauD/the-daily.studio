<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/mark-dark.svg"><img src="docs/brand/mark-light.svg" alt="the-daily.studio mark: a hexagon drawn as a cube with the letters T, D and S on its faces" width="96"></picture>
</p>

<h1 align="center">the-daily.studio</h1>
<p align="center"><b>Record it. Split it. Write it down.</b><br>
A guitar and voice studio in one web page: record your guitar and mic · split any song into stems to play along with · get the chords, tab and lyrics · pedals, presets and live visuals</p>
<p align="center"><sub>v2.13.0 · free, open source (MIT) · no account, no upload, no tracking</sub></p>

<p align="center">
  <a href="https://the-daily.studio/"><b>▶ Open the live app</b></a> ·
  <a href="docs/USER_GUIDE.md">User guide</a> ·
  <a href="CHANGELOG.md">What's new</a> ·
  <a href="docs/HOSTING.md">Host it yourself</a> ·
  <a href="docs/ARCHITECTURE.md">Architecture</a> ·
  <a href="docs/OPERATIONS.md">Operations</a> ·
  <a href="docs/SECURITY_MODEL.md">Security model</a> ·
  <a href="docs/README.md">All docs</a> ·
  <a href="CONTRIBUTING.md">Contribute</a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-17b3a3"></a>
  <img alt="No build step needed to run" src="https://img.shields.io/badge/runtime-vanilla%20JS%20·%20zero%20dependencies-0e2a30">
  <img alt="Local first" src="https://img.shields.io/badge/privacy-local--first%20·%20nothing%20uploaded-17b3a3">
  <a href="https://github.com/TehauD/the-daily.studio/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/TehauD/the-daily.studio/actions/workflows/ci.yml/badge.svg"></a>
</p>

<p align="center">
  <img src="docs/screenshots/01-rig-dark.png" alt="the-daily.studio: the pedalboard, and the arrangement with a vocal take and a guitar take as clips" width="920">
</p>

---

## Contents

[What it is](#what-it-is) · [Highlights](#highlights) · [What's new in 2.12](#whats-new-in-212) · [2.11](#whats-new-in-211) · [2.10](#whats-new-in-210) · [2.4](#whats-new-in-24) · [2.3](#whats-new-in-23) · [2.2](#whats-new-in-22) · [Quick start](#quick-start) · [Your first five minutes](#your-first-five-minutes) · [Tour of the panels](#tour-of-the-panels) · [Tunings](#tunings) · [Phone and tablet](#phone-and-tablet) · [Keyboard shortcuts](#keyboard-shortcuts) · [Audio setup](#audio-setup) · [Privacy](#privacy-and-data) · [Accuracy and honest limits](#accuracy-and-honest-limits) · [Browser support](#browser-support) · [Project layout](#project-layout) · [Develop](#develop) · [Host it](#host-it-on-your-github) · [Roadmap](#roadmap-ideas) · [License](#license-and-credits)

## What it is

the-daily.studio is a guitar and voice studio that runs **entirely in your browser**. Three things come first:

| | |
|---|---|
| **Record your guitar and your voice** | Plug in an audio interface (a Focusrite, say) or use any microphone. Guitar and mic at once on a two-channel interface, dry and wet takes, a count-in, punch-in over a mistake. Your instrument, your sound, kept on your device. |
| **Split any song into stems** | Load a track: **drums, bass, vocals and guitar / other** come apart. Mute the part you play and jam over the rest, loop the hard bar, copy the drum groove to the band. Backing tracks you can practise with, isolate and experiment on. |
| **Get the chords, tab and lyrics** | The tempo, key and chords of a song, and **polyphonic tab** from audio (a track or your own playing), placed on strings and frets for your tuning. A lyric sheet that you type, paste or drop in (.txt, .lrc) keeps the chords over the words. Export to Ultimate Guitar text, ChordPro, MIDI or a print sheet. |

Around that: **presets and effects** (a pedalboard, five amps, 27 tones, A/B morph and mutate to experiment), a **neural graph and live visuals** (your song as a living map, and the Concert light show that moves with it), a backing band, and a performer view. If you like, there is also a **camera on stage**, an optional extra that stays off unless you choose it.

<p align="center"><img src="docs/screenshots/20-boot.png" alt="The first page: Record it. Split it. Write it down. Three features, then Begin in the studio and Try the demo song" width="860"></p>
<p align="center"><img src="docs/screenshots/40-concert-perform.png" alt="Concert: beams, an LED wall and a gradient stage that follow the chord and the drums" width="860"></p>
<p align="center"><img src="docs/screenshots/41-concert-teach.png" alt="Concert, Teach lens: the circle of fifths as a lit ring, roman numerals and the next four chords" width="860"></p>
<p align="center"><img src="docs/screenshots/22-guitar-coach.png" alt="The guitar coach teaching the first chord" width="860"></p>

It began as a guitar lab and grew into a place to turn an idea into a song. **Hum a melody and get a song**: press **● Hum or sing**, hum 10–30 seconds, and the app finds your notes, key and tempo, writes the chords, builds intro, verses, choruses, bridge and outro, and plays it back with a band. The numbers behind your playing (pitch to the cent, timing against a click, vibrato, attack harshness, latency) are visible, exportable and honest about their uncertainty.

* **One page, no install, no account, no server.** Open `index.html` or the hosted page and play.
* **Local first.** Audio, video, projects and settings never leave your machine. See [Privacy](#privacy-and-data).
* **Vanilla JavaScript**, Web Audio, AudioWorklet and Canvas/SVG. No framework, no bundler required to *run* it.
* **Any screen.** The layout adapts to phone, tablet and desktop, so you can record or write a song on the device in your hand.
* **Your tuning, your band.** Standard, Eb, C#, Drop D / C# / C / B and more, plus a custom per-string tuning editor, drive every part of the app.

## Highlights

| Area | What you get |
|---|---|
| **Show setup, layouts, Monitor widgets (2.6)** | A **Show setup console** in the Stage tab for the person who sets up a show: six **looks** built differently (Theatre, Backlight, Blades, Pixel field, Horizon, Laser room) that you can save and carry as files; the **rig** (where the lights stand, the room, the backdrop, lasers, motion); **colour**; a **cue sheet** for each kind of section with a silent band to rehearse it; **response** to kick, snare, hats, bass, strums and lead notes with live meters; **your own pictures**; and **output** controls: master level, blackout and freeze keys, mirror and flip, safe-frame guides, test patterns, a frame-rate limit and a live flash meter. **Nine layouts** (Studio, Write, Arrange, Record, Tone, Practice, Show, Focus, Classic), each a whole workspace for one job, and **optional Monitor widgets**. Plain **guide pages and structured data** so the app can be found. The show is a picture on a screen; the flash limit is an engineering safeguard, not a medical guarantee. |
| **Lasers and light comfort (2.5)** | **Lasers** in eight patterns that play in combinations and change on the phrase, locked to the song's bars and brightening on the band's real hits, and **Calm, Standard and Full** light comfort with a governor that holds the show to three flashes a second. |
| **Concert, Teach and Sky (2.4)** | A **Concert** light show (the default until 2.10): colour from the harmony (every step round the circle of fifths moves the hue), mood from loudness, major / minor and tension, and lights on the band's real drum hits, with a cue list from your section names. **Teach** shows the circle of fifths, roman numerals and what comes next; **Sky** turns a session into a constellation you can save as a poster. The pitch wheel, spectrogram and scope moved to **Monitor ▸ Views** (an optional widget since 2.6). |
| **Rig** | 16 reorderable effect units (gate, compressor, wah, overdrive, distortion, fuzz, pitch / harmony, amp, cabinet / IR, parametric EQ, chorus, phaser, flanger, tremolo, delay, reverb), 5 amp models, procedural cabinets and impulse-response loading, 6 reverbs, 27 presets, A/B morph, mutate, scenes, per-pedal footswitch keys and MIDI bindings, Stomp view for live use. |
| **Voice, editing, heatmap, backdrop (2.3)** | A **Voice** window with a live **pitch ribbon** against the key, **Find my range** and **Find my key** (then transpose the whole song in one step). **Cut out**, **Silence** or **Punch in** over a marked stretch of a take, and a level for each clip. A **fretboard heatmap** of where you play, how in tune each spot is and which notes belong to the key. A **performer backdrop** that dims and calms the visuals, adds a chord-and-lyric lower third, and gives you plain black or chroma-key green and a clean output window for a projector or OBS. |
| **Clips, fast render, MIDI (2.2)** | A recording is a **clip**: drag it, trim its edges, fade it, **split** (<kbd>Ctrl/⌘</kbd>+<kbd>E</kbd>), duplicate, delete, with one undo history shared with song edits and the stem mix. **WAV bounces render faster than the song plays**, with a progress window. **Drop a MIDI file** and get a song with chords, key, tempo and a lead tab. **Keep songs safe** explains Add to Home Screen on iPhone and iPad and backs everything up in one tap. |
| **I/O and lanes (2.1)** | One **Connect** card with **Set my level** and a live **signal path**, channels that follow your interface, and permission help that names the exact steps for your browser. A mixer strip on every lane (**M S**, volume, pan, **+Fx**: EQ, compressor, reverb and delay sends), **drop-anywhere import** for audio, lyrics, song files and rigs, **⚖ Auto-balance**, a **master chip** with presets, visible undo / redo and a **Saved** mark. |
| **Perform and share (2.0)** | **Perform** (full-screen chords, lyrics and a count-in with a readiness check), **Voice memo**, **Auto look** per section, **Record the stage** as a video, loudness (LUFS) with a target, compressed audio, a one-file **share page**, a **print or PDF sheet**, and a **backup folder** that saves your songs as you work. |
| **Arrangement** | A DAW-style track list: chord, tab, bass and drum lanes, your **Guitar** and **Vocal** inputs, recorded takes, and a loaded track with its four stems, all on one bar grid. Reorder, resize, recolour and hide lanes; arm guitar and vocals and **record both at once** from a two-input interface (guitar on input 1, microphone on input 2). |
| **Song strip** | Title, artist, tuning, capo and scale in one strip above every panel. Load a track and it fills in the title, tempo, key and chords for you. **Refine** (right sidebar) is the shared lyric and chord canvas, and any panel can be moved between the centre and either sidebar. |
| **Band** | Drums, bass, rhythm guitar and lead-tab playback in many styles, always one click away in the band strip. Rehearsal mixes mute whoever you are replacing. |
| **Compose** | Tab editor with techniques (hammer, pull, slides, bends, vibrato, mutes), chord and lyric lanes, automatic voicings for any tuning and capo, Ultimate Guitar-ready text, ChordPro, MIDI, WAV and project JSON export with a submission lint report. |
| **Transcribe** | Record or load audio and get **polyphonic tab** placed on strings and frets for your tuning, with per-note confidence, review and accept / reject, timing auto-align and a built-in self-test. |
| **Stems** | Load a backing track: separate **drums, bass, vocals and guitar / other**, estimate tempo, key and chords, import the chords into your song, copy the drum groove to the band, and mute stems to play along. |
| **Neural map** | An interactive node graph of the music: notes and harmony take shape as the song progresses. |
| **Stage and visuals** | Audio-reactive full-screen visuals (Concert, hex resonance, orrery, ridgeline, prompter, spectrogram and chroma wheel as scenes) with scenes you can switch from the keyboard or a MIDI controller. |
| **Camera look** | Put yourself in the visuals: dimmed behind them, framed by them (visuals grow in from the edges) or a green-screen style cut-out with the visuals playing behind you. |
| **Research** | YIN pitch tracking with cents, vibrato rate and extent, attack harshness, key and chord detection, timing jitter against the click, loopback latency measurement, session CSV / JSON. |
| **Vision** | Calibrate the neck with your webcam and track the fretting hand (optional MediaPipe), then cross-check finger positions against the notes you actually played. |
| **Safety nets** | Version history with automatic snapshots, calibration to *your* guitar, undo / redo, autosave. |
| **Guided sessions and tour (2.7)** | Seven short sessions that tick off as you do each step (play with a band, write down what you play, hum a song, record, loop and layer, learn a song, run a show), a note the first time each tab opens, studio words in guitar terms, and the spotlight tour from **?**. |
| **Write and Capture (2.9)** | One canvas for the tab, the words and a fretboard that follows the bar; ● Capture writes what you play, notes and chords, as you play. Its three journeys became the six goal workspaces in 2.13. |
| **Goal workspaces (2.13)** | 🎸 Songwriter · 🎤 Performer · 🎬 Creator Studio · 🎼 Practice · 🎓 Teacher · ⚙️ Full Rig. Each one arranges the panels, sidebars and Monitor for that goal and puts its few tools in one row, with Create → Perform → Share leading to the next step. Creator Studio adds Studio Replay, MP4 recording and thumbnails; Teacher adds annotations, lesson notes and screen recording. |
| **Loop & layer (2.8)** | Record a track of chords, hear it loop, and play a lead on top in a new track on each pass. Keep looping, add a layer, undo a layer. Layers are ordinary tracks. |
| **Phone, tablet, desktop** | One responsive app. On a phone: bottom transport, five-section navigation, an on-screen tab keypad, pinch-to-zoom Neural map and a wake lock while you play. Installable as an app (PWA). See [Phone and tablet](#phone-and-tablet). |

## What's new in 2.13

**Workspaces built around what you want to do.** A row at the top of the panels asks one question: *what are you here for?* **🎸 Songwriter** (lyrics, chords, progressions, ● Capture an idea), **🎤 Performer** (the stage, your tone, the camera, a take, a video), **🎬 Creator Studio** (record an MP4, watch it in **Studio Replay**, add overlays, save a thumbnail, export), **🎼 Practice** (loop, metronome, ±5 BPM, scales, the chord on the neck), **🎓 Teacher** (draw on the screen, lesson notes, record the screen with your voice) and **⚙️ Full Rig** (every panel and widget). Each one shows, hides and arranges the panels for that goal; nothing is taken away, it is all under ☰. The goals run **Create → Perform → Share**, and each ends with the button for the next step. A first visit on a computer opens the Performer: **⏺ Record video**, play, **■**, and Studio Replay is open with **Save MP4** and **Share**.

MP4 depends on the browser: recent Chrome and Edge, and Safari, record MP4; Firefox records WebM, and Replay says so.

## What's new in 2.12

**Welcome Back, and the white or dark-green hexagons.** Come back after a week or after ninety days and the first page tells you where you are: when you last practiced, your streak (gently, after a long gap), what you are working on, your latest recording, how a chord change you have been practicing is going, and the year in one line: *Played 87 sessions · Learned 14 chords · Recorded 23 ideas · Completed 4 songs*. **Pick up where I left off** opens the song you were on. **My progress** (Songs menu) has the twelve-week strip and the details. It is a small journal of counts and dates kept only on this device, never sound.

<p align="center"><img src="docs/screenshots/74-welcome-back-light.png" width="720" alt="Welcome Back after three months away, on the white hexagon start screen"></p>

The hexagon field is back in both of its looks, **white** and **dark green**, on the start screen and in Hex Resonance, and now in **any colours you like**: Visuals ▸ the Hexagons swatches (Ocean, Ember, Violet, Mono, Blush, Daylight, or pick your own three).

<p align="center"><img src="docs/screenshots/84-hex-colours.png" width="720" alt="Hex Resonance in colours picked by the user"></p>

**Behind you.** Six backdrops made to sit behind the camera cut-out: **Light Ribbons**, **Aurora**, **Warp Stars**, **Pulse Rings**, **Nebula** and **Skyline**. Set Camera look to *Me in front (green screen)* and you stand inside the picture. The colour follows the chord, the movement follows the sound, and none of it flashes.

<p align="center"><img src="docs/screenshots/78-behind-ribbons.png" width="720" alt="Light Ribbons, a Behind you look"></p>

<p align="center"><img src="docs/screenshots/75-my-progress.png" width="720" alt="My progress: four counts, a twelve-week strip, chord changes and the chords learned"></p>

Checked with invented history and simulated chords, not months of real use. Chord detection is a guide; see the CHANGELOG for the limits.

**Simpler to move around.** The twelve preset layouts are gone, and the ▦ menu is only about where panels go (light / dark is in Appearance; Experience is on the Tools button). Every panel area has a **labelled tab on its own edge**, like the journal's: each sidebar's tab is named for the panel that is open (click it to collapse), a collapsed sidebar lists its panels so one click opens the one you want, and the divider carries **Arrangement** and **Panels** tabs. **Video 2086, String Field, Ridgeline, Chord Landscape and Ecosystem were taken out**; a saved choice of one opens as Hex Resonance.

<p align="center"><img src="docs/screenshots/76-view-menu.png" width="720" alt="The ▦ menu: workspace only, with labelled tabs on the edges"></p>

## What's new in 2.11

**An Audience view, and your playing from the video in the arrangement.** (Video 2086 was tried in 2.11 and taken out in 2.12.)

A new **Audience view** on the Monitor shows you in front of the show as the room sees it (not mirrored), with a crowd lit by the screen. And when you record the stage as a video, **what you play also becomes a lane in the arrangement**, starting where the video started.

<p align="center"><img src="docs/screenshots/72-audience-view.png" width="720" alt="The Audience view widget on the Monitor, with the camera on"></p>

Checked with a fake camera, a fake microphone and simulated notes, not real hardware; see the CHANGELOG for the limits.

## What's new in 2.10

**The hexagon is the default again, and ten ways to see harmony (eight since 2.12: Chord Landscape and Ecosystem were taken out).** Hex Resonance opens first, in the same glow as the start screen, with **Concert** next to it. Then ten looks that turn the chord, your voice and your playing into pictures: **Harmonic Gravity**, **Improv Field**, **Voice & Guitar** swarms, **Chord Landscape**, **Mood Colour**, **Chord DNA**, a **Constellation** of sung notes, **Rhythm Flow**, an **Ecosystem** and a **Session Painting** you can save.

<p align="center"><img src="docs/screenshots/70-harmony-looks.png" width="720" alt="The ten harmony looks, drawn from simulated notes over Gmaj7"></p>

They were checked on simulated notes, not a real voice or guitar, and "tension" is a simple model (distance from the chord's notes), not a rule. See the CHANGELOG for the limits.

## What's new in 2.9

**One page to write on, and three journeys.** *Write* is the tab, the words and a fretboard in one canvas: choose Tab, Words or Both, see the neck light up as you play, and press **● Capture** to have the notes and chords you play written into the bar that is playing. **Play**, **Create** and **Learn** sit above the tabs and set the studio up for one job each, so a first-time guitarist sees only what that job needs. Two new guided sessions, *Play with a band* and *Write down what you play*, walk through a first task on the real controls.

<p align="center"><img src="docs/screenshots/67-write-canvas.png" width="720" alt="The Write canvas in the Create journey: tab, lyrics, the fretboard strip and a capture in progress"></p>

Capture was measured on synthetic string-like audio, not a real guitar; see the CHANGELOG for its limits.

## What was new in 2.8

**Loop & layer.** Record a track of chords on the guitar, let it loop, and play an instrumental part on top in another track, the way a looper pedal works. One button sets the loop, counts you in and records a layer on every pass; the earlier layers keep playing. *Keep looping* stops recording and keeps the loop going, *Add a layer* records another, *Undo layer* takes the last one back. Layers are ordinary tracks you can mix and export afterwards, and a first guided session walks you through it. Details are in the [user guide](docs/USER_GUIDE.md#loop--layer-28) and the [changelog](CHANGELOG.md).

<p align="center"><img src="docs/screenshots/66-loop-layer.png" width="720" alt="Loop and layer: Layer 1 and Layer 2 as lanes while the strip shows Recording layer 3"></p>

## What was new in 2.7

The first page now asks what you want to **do** (hum a song, record, learn a song, run a show) and a short **guided session** takes you through it on the real controls, ticking each step when the app sees it done. Tabs explain themselves the first time they open, the studio's words are explained in guitar terms, and Show setup has a seven-line **preflight** for a technician. People who know the studio choose **I know my way around** and get every tool and no coaching. Details are in the [user guide](docs/USER_GUIDE.md#getting-started-and-guided-sessions-27).

<p align="center"><img src="docs/screenshots/59-goals.png" width="720" alt="The first page: four cards asking what you would like to do first"></p>

## What was new in 2.6

A **Show setup** console in the Stage tab, six looks that are built differently, a collapse-and-open tab on every panel, optional Monitor widgets, and pages a search engine can read. Details are in the [user guide](docs/USER_GUIDE.md#show-setup-26) and the [changelog](CHANGELOG.md). The lasers and lights are drawn on the screen; nothing here drives lighting or laser hardware, and the flash limit is an engineering safeguard, not a medical guarantee.

<table>
  <tr>
    <td width="33%"><img src="docs/screenshots/46-look-theatre.png" alt="Theatre: warm front light and haze with dust in it"><br><sub><b>Theatre</b> · warm front light</sub></td>
    <td width="33%"><img src="docs/screenshots/47-look-backlight.png" alt="Backlight: hard beams from the floor behind the band through haze"><br><sub><b>Backlight</b> · contre-jour beams</sub></td>
    <td width="33%"><img src="docs/screenshots/48-look-blades.png" alt="Blades: tall hard-edged bars of light that follow the spectrum"><br><sub><b>Blades</b> · architectural LED</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/49-look-pixels.png" alt="Pixel field: a generative LED wall behind the band"><br><sub><b>Pixel field</b> · generative LED wall</sub></td>
    <td><img src="docs/screenshots/50-look-horizon.png" alt="Horizon: a low sun and rays over a long horizon"><br><sub><b>Horizon</b> · cinematic sun and rays</sub></td>
    <td><img src="docs/screenshots/51-look-lasers.png" alt="Laser room: haze and a laser kit for every section"><br><sub><b>Laser room</b> · haze and beams</sub></td>
  </tr>
</table>

<p align="center"><img src="docs/screenshots/52-show-setup.png" alt="The Show setup console: looks, rig, colour, cues, response, pictures, output, scene and MIDI" width="860"></p>
<p align="center"><img src="docs/screenshots/53-show-cues.png" alt="The cue sheet: level, lights, pattern and lasers for each kind of section, with a silent band to rehearse it" width="860"></p>
<p align="center"><img src="docs/screenshots/54-show-output.png" alt="Output: master level, blackout, freeze, mirror, flip, test patterns, frame rate, light comfort and the flash meter" width="860"></p>
<p align="center"><img src="docs/screenshots/76-view-menu.png" alt="The ▦ menu: workspace only, with labelled tabs on the edges" width="860"></p>

## What's new in 2.4

A first page that says what the app is for, a **Concert** visual with three lenses (Perform, Teach, Sky), and the instrument readouts moved to the Monitor tab. The camera is now an optional extra at the bottom of the first page. Details are in the [user guide](docs/USER_GUIDE.md) and the [changelog](CHANGELOG.md).

<p align="center"><img src="docs/screenshots/42-concert-sky.png" alt="Concert, Sky lens: every chord you play is a star and every move a line" width="860"></p>
<p align="center"><img src="docs/screenshots/43-monitor-views.png" alt="Monitor tab: the tuner, levels and the optional Views widget with the pitch wheel, spectrogram and scope" width="520"></p>

## What's new in 2.3

Voice (pitch ribbon, your range, Find my key), cutting and punching in over a stretch of a take, a fretboard heatmap, and a performer backdrop with a lower third and a clean output window. Details are in the [user guide](docs/USER_GUIDE.md) and the [changelog](CHANGELOG.md).

<p align="center"><img src="docs/screenshots/35-voice.png" alt="The Voice window: the pitch ribbon against the notes of the key, Find my range and Find my key" width="860"></p>
<p align="center"><img src="docs/screenshots/36-range.png" alt="A marked stretch of a take, with Cut out, Silence and Punch in in the clip bar" width="860"></p>
<p align="center"><img src="docs/screenshots/37-heatmap.png" alt="The fretboard heatmap: where you play" width="860"></p>
<p align="center"><img src="docs/screenshots/39-backdrop.png" alt="The performer backdrop: dimmed visuals with the chord and the lyric in a lower third" width="860"></p>
## What's new in 2.2

<p align="center"><img src="docs/screenshots/24-clips.png" alt="The arrangement with a vocal take split into two clips; the clip bar names the selected clip" width="920"><br><sub><b>Clips</b> · every take is a clip: move, trim, fade, split, duplicate, delete, and undo any of it</sub></p>

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/25-clip-menu.png" alt="The clip menu: split, duplicate, fades, nudge, reset trim, save clip, delete"><br><sub><b>Clip menu</b> · right-click a clip: fades, nudge, reset trim, save the clip as a WAV</sub></td>
    <td width="50%"><img src="docs/screenshots/34-lane-fx.png" alt="The effects strip for a take lane: EQ, squeeze, reverb and echo"><br><sub><b>Lane effects</b> · a strip on every lane: EQ, compressor, reverb and delay, saved with the song</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/30-render.png" alt="The render window: a progress bar and a Cancel button"><br><sub><b>Fast render</b> · WAVs are mixed faster than the song plays, with the same effects and limiter</sub></td>
    <td><img src="docs/screenshots/31-midi.png" alt="Open MIDI file: tracks, melody choice and the chord tracks"><br><sub><b>MIDI import</b> · pick the melody, tick the chord tracks, <b>Create song</b></sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/28-balance.png" alt="Auto-balance: measured loudness and the proposed level and pan for each lane"><br><sub><b>Auto-balance</b> · measure, review, apply, undo (2.1)</sub></td>
    <td><img src="docs/screenshots/27-drop.png" alt="Drop anywhere: what is this recording?"><br><sub><b>Drop anywhere</b> · audio, lyrics, MIDI or a song file (2.1, MIDI in 2.2)</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/26-io.png" alt="The I/O card: connect, set my level, channels and the signal path"><br><sub><b>I/O</b> · one Connect card, Set my level and the signal path (2.1)</sub></td>
    <td><img src="docs/screenshots/29-master.png" alt="The master menu: presets and Auto-balance"><br><sub><b>Master</b> · presets for tone, glue and the loudness target (2.1)</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/32-keep.png" alt="Keep my songs safe: Add to Home Screen steps and a Back up all songs button"><br><sub><b>Keep songs safe</b> · what Safari does to a site's storage, the steps, and one backup button</sub></td>
    <td><img src="docs/screenshots/33-phone-new.png" alt="On a phone: the clip bar, the MIDI window and the Keep songs safe sheet"><br><sub><b>On a phone</b> · the clip bar, the MIDI window and the backup sheet</sub></td>
  </tr>
</table>

## Screenshots

<p align="center"><img src="docs/screenshots/11-mobile.png" alt="the-daily.studio on a phone: Play with the clip bar, Write with the tab keypad, and the More sheet" width="900"><br><sub><b>On a phone</b> · Play (rig, scenes, clip bar) · Write (tab with keypad while the song plays) · More (Open a file, Master · balance · click, Keep songs safe)</sub></p>

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/02-rig-light.png" alt="Studio view, light theme"><br><sub><b>Studio</b> · tone, scenes, signal chain, arrangement and transport (Daily Light)</sub></td>
    <td width="50%"><img src="docs/screenshots/15-appearance.png" alt="Appearance drawer with looks, palettes and accents"><br><sub><b>Appearance</b> · eight looks, seventeen palettes, accents, type, density and high contrast</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/13-canvas.png" alt="Canvas zoom: the song as a timeline of sections"><br><sub><b>Canvas</b> · just the page: lyrics and chords, nothing else</sub></td>
    <td><img src="docs/screenshots/14-songs.png" alt="My songs: the library and the backup card"><br><sub><b>My songs</b> · every song lives on your device; back them all up with one button</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/17-hum-start.png" alt="New song: hum or sing an idea, a clean canvas, or start from a song"><br><sub><b>New song</b> · hum an idea, start on a clean canvas, or start from a song (audio or MIDI)</sub></td>
    <td><img src="docs/screenshots/12-start.png" alt="The clean canvas on first run"><br><sub><b>First run</b> · the clean canvas: write lyrics and chords, sing, or load a song</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/18-hum-screen.png" alt="Hum to song: three steps and one button"><br><sub><b>Hum to song</b> · hum 10 to 30 seconds and get a whole song</sub></td>
    <td><img src="docs/screenshots/16-about.png" alt="About, credits and licences in Help"><br><sub><b>About &amp; credits</b> · in Help &amp; shortcuts: who made it, what it uses, which licences apply</sub></td>
  </tr>
</table>

Every picture is made by `npm run shots`, which drives the real app with a fake microphone and the same two synthetic recordings, so they stay true to the version they sit beside.

## Quick start

**Use it online (recommended).** Open **<https://the-daily.studio/>** in Chrome or Edge, press **Start**, and allow microphone access when asked. The page is served over HTTPS, which browsers require for microphone, camera and MIDI.

**Run it locally.**

```bash
git clone https://github.com/TehauD/the-daily.studio.git
cd the-daily.studio
npm start            # zero-dependency static server → http://localhost:8080
```

Downloaded the zip instead? Unzip it, open a terminal **inside the unzipped folder** (the one containing `index.html` and `package.json`) and run `npm start`. It needs [Node.js](https://nodejs.org/) 18 or newer and nothing else (no `npm install`). It opens your browser; if port 8080 is busy it moves to the next free port and prints the address. Without Node, `py -m http.server 8080` (Windows) or `python3 -m http.server 8080` works too.

If the page looks like an older version or shows the wrong name, a previous copy is cached on that address: hold <kbd>Shift</kbd> and reload once, or in the browser's developer tools choose Application ▸ Storage ▸ Clear site data for `localhost`.

`localhost` counts as a secure context, so microphone and MIDI work. You can also just double-click `index.html`, though some browsers ask for microphone permission every time on `file://` pages. Python users can run `python3 -m http.server 8080` instead.

**Use it on CodePen.** Paste `codepen/pen.html`, `codepen/pen.css` and `codepen/pen.js` into the HTML, CSS and JS panels, then choose **Change View → Full Page** (or Debug) for best audio performance.

## Songs, two origins and zoom (new in 1.4)

- **Begin two ways.** **＋ New** offers a *Clean canvas* (blank page, optional title, tempo, key, tuning) or *Start from a song* (load an audio file or a sample: it is split into stems and the title, tempo, key and chords fill in).
- **Everything is kept in your browser.** **☰ Songs** lists your songs with their takes and backing tracks; they reopen exactly as you left them. Nothing is uploaded and there are no accounts.
- **Bundles.** Export a song as a `.daily-song.zip` (`song.md`, `arrangement.json`, `audio/`), or back up every song at once. Plain files you can keep in Git.
- **Zoom.** *Canvas* (just the page), *Song* (writing layout), *Studio* (full arrangement and recording) on the same song.
- **Reset what you choose.** Settings ▸ Data ▸ Reset… clears layout, settings, presets, notes, songs or the offline copy, separately or all together.

## Make it yours: appearance (new in 1.6)

The ◐ button (top right; **More ▸ Appearance** on a phone) opens a drawer that restyles the app live: light, dark or match-system; 17 palettes (the brand pair Daily Light and Daily Night by default); any accent colour; compact, cosy or roomy density; sharp, soft or round corners; flat, soft or raised surfaces; seven typefaces (Inter and Montserrat are built in); high contrast; colour-blind-safe data colours; and eight one-click looks (the-daily.studio, Clinical, Studio night, Notebook, Calm, Midnight, Stage, Accessible). Your choices stay on the device.

## Your first five minutes

0. **Fastest start:** press **Start**, then **● Hum or sing**. A few seconds later you have a song.
1. **Press Start** on the welcome card. If your interface does not appear, open **I/O** in the left sidebar, pick it, and press the refresh button.
2. **Take the tour.** Accept the offer that appears on first run, or press **?** and choose **Take the guided tour**. It highlights each key area in about two minutes.
3. **Pick a tone** from **Tones** (left) and play. Watch the **Tuner** (right) and the level meters; aim for peaks around −12 to −6 dBFS.
4. **Turn on the band.** Click **Drums**, **Bass**, **Rhythm** in the band strip and press <kbd>Space</kbd>.
5. **Set your tuning** in **Song → Tuning**, or **Custom tuning** to set each string.
6. **Try the clever bits:** record a take in **Transcribe**, or drop a song into **Stems**.

## Tour of the panels

The dock at the top of the centre column holds every panel as a tab. **Drag** tabs to reorder them, **double-click** one to float it as a window, and use **▦** to choose a layout (Studio, Write, Arrange, Record, Tone, Practice, Show, Focus or Classic).

| # | Panel | What it is for |
|---|---|---|
| 1 | **Rig** | Tone, A/B morph, scenes, the signal chain strip and the full pedalboard. Drag pedal headers to reorder; **⚙** per pedal for width, colour, collapse, hide and footswitch binding. |
| 2 | **Tab** | Grid tab editor. Click a cell and type a fret; arrows move; `h p / \ b ~ x` set techniques; <kbd>Space</kbd> plays from the bar; *Capture from playing* writes what you play. |
| 3 | **Song** | Title, tuning, capo, scale, sections and chords, plus the chord library with voicings for the current tuning. |
| 4 | **Band** | Style, level and pan for drums, bass, rhythm guitar and lead playback. |
| 5 | **Fretboard** | A hexagon fretboard aware of tuning, capo and scale. Click any note to hear it. |
| 6 | **Visuals** | Audio-reactive visualisers from rig output, master mix or dry DI. |
| 7 | **Stage** | Performance mode: full-screen visuals, scenes, prompter and a neural view. |
| 8 | **Neural** | The music as an interactive node graph that evolves with the song. |
| 9 | **Stems** | Backing-track separation and analysis. |
| 10 | **Transcribe** | Audio to polyphonic tab, with calibration and self-test. |
| 11 | **Vision** | Webcam neck calibration and fretting-hand tracking. |
| 12 | **Research** | Session measurements, distributions and the loopback latency test. |
| 13 | **Export** | Ultimate Guitar text, ChordPro, MIDI, WAV bounce, project JSON, version history. |

More detail: **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)**.

## Tunings

Every part of the app reads the song's tuning and capo: the tuner, tab and fretboard labels, chord voicings, tab playback, chord and note detection, and transcription.

| Family | Presets |
|---|---|
| **Standard and down-tuned** | Standard (E A D G B E) · Eb (half-step down) · D (whole-step down) · C# (1½ steps down) · C (2 steps down) · B (2½ steps down) |
| **Drop** | Drop D · Drop C# · Drop C · Drop B · Drop Bb · Drop A · Double Drop D |
| **Alternate and open** | DADGAD · All fourths · Open G (Taro Patch) · Slack-key Wahine · Open D · Open Dm · Open E · Open C · Open A |
| **Custom** | **Song → Custom tuning** sets each of the six strings (E1 to G5) with shortcuts for ±½ step and *Drop low string*. |

Flat tunings are spelled with flats (Eb Ab Db Gb Bb Eb) and the rest with sharps. Click a string circle in the tuner to hear its reference pitch.

## Keyboard shortcuts

| Key | Action |
|---|---|
| <kbd>Space</kbd> | Play / stop |
| <kbd>R</kbd> | Arm / start recording (count-in, dry DI plus wet print) |
| <kbd>L</kbd> · <kbd>M</kbd> | Loop · metronome |
| <kbd>D</kbd> <kbd>B</kbd> <kbd>G</kbd> <kbd>T</kbd> | Band on / off: drums · bass · rhythm guitar · lead tab |
| <kbd>1</kbd>…<kbd>8</kbd> · <kbd>0</kbd> | Recall pedalboard scene (Stage scene when Stage is focused) · all pedals off |
| <kbd>Home</kbd> | Return to start |
| <kbd>Ctrl/⌘</kbd>+<kbd>Z</kbd> · +<kbd>Shift</kbd> | Undo · redo (song edits, clips and the stem mix share one history) |
| <kbd>Ctrl/⌘</kbd>+<kbd>E</kbd> · <kbd>Ctrl/⌘</kbd>+<kbd>D</kbd> · <kbd>Del</kbd> | Selected clip: split at the playhead · duplicate · delete (← → nudge; <kbd>Alt</kbd> while dragging = no snapping) |
| <kbd>Ctrl/⌘</kbd>+<kbd>.</kbd> | Kill switch: stops playback, recording, rendering and the microphone at once |
| <kbd>Ctrl/⌘</kbd>+<kbd>S</kbd> | Save project JSON |
| <kbd>Alt</kbd>+<kbd>1…9, 0</kbd> | Jump to panel by position |
| <kbd>[</kbd> <kbd>]</kbd> | Toggle left / right sidebar |
| <kbd>?</kbd> | Help and shortcuts |

Knobs: drag, mouse wheel, <kbd>Shift</kbd> for fine, double-click to reset, right-click to MIDI-learn.

## Audio setup

* **Guitar + vocal at once.** A two-input interface appears in the browser as one device with two channels. In **I/O → Channels** pick *Guitar & voice* (or *Swap*), arm both lanes in the arrangement and press <kbd>R</kbd>. A mono device cannot be split. Wear headphones when you monitor the vocal.
* **Connect, then Set my level.** In **I/O** press **Connect**, then **Set my level** and play or sing as loud as you will; the trim is set for you and the signal-path strip shows where the loudest point is.
* **Use headphones** or your interface's hardware **Direct Monitor** for zero-latency monitoring, and mute the in-app monitor while recording to avoid doubled sound and feedback.
* Browsers cannot talk to ASIO drivers, so achievable latency depends on your operating system's audio stack. Run the **Loopback test** (I/O panel) for a *measured* round-trip number instead of a guess.
* With a Focusrite or similar interface, set its buffer size as low as stays stable (Focusrite Control or your OS). Wired headphones beat Bluetooth by a large margin.
* If the interface is not listed, allow microphone access in the browser, close other apps that hold the device exclusively, and press the refresh button.

## Privacy and data

* Audio, camera frames, songs, takes and settings are processed **on your device**. There is no server, account or analytics.
* Your songs, recordings, presets and settings autosave to **this browser** (local storage and IndexedDB). Use **☰ Songs ▸ All songs ▸ Back up all songs** for one zip with everything, **Export → Project JSON** for a portable, git-friendly copy, or **Settings ▸ Export ▸ Backup folder** (Chrome and Edge) to save as you work.
* The page can reach exactly two other hosts, and **only after you say yes** to a one-time download: MediaPipe's code from jsDelivr and its model from Google storage, used by hand tracking and by the **Me in front** camera look (the stage route chooses that look, so it asks the first time). Your camera pictures are never uploaded. If you say no, or use motion-only mode or the edges-in look, nothing is requested. The host (Cloudflare) keeps ordinary access logs like any web host. [PRIVACY.md](PRIVACY.md) lists what is processed, what can be sent and what is kept; `test/e2e-privacy.cjs` checks it in a real browser, and `npm run audit` checks the licences and hosts. To self-host those files, see [docs/HOSTING.md](docs/HOSTING.md#8-self-hosting-the-camera-model-files).
* **Your music stays yours.** No recordings and no one else's lyrics are bundled; what you bring in stays on your device, and stems, chords and tab are worked out from your file. Share only what you have the right to share. The register of every file, font, dependency and download is [docs/LICENSING.md](docs/LICENSING.md); the licences and notices are also on the site at `/legal/`.
* Clearing site data in your browser removes your songs. Safari on an iPhone, iPad or Mac also clears a site's storage after about a week away unless you **Add to Home Screen** (or the Dock); **⋯ More ▸ Keep songs safe** explains it and backs everything up in one tap.

## Accuracy and honest limits

The app measures things; it does not pretend they are perfect.

* **Transcription.** The built-in self-test (synthetic Karplus-Strong guitar with known ground truth) scores roughly **F1 ≈ 87 %** in standard tuning, with string/fret agreement around 80 %. Real rooms, noisy interfaces and heavy distortion do worse; treat the synthetic score as an upper bound. Low tunings such as Drop B are less accurate (about 9 points lower in the same test) because the lowest string sits below the analyser's lowest frequency bin. Use **Measure noise** and **Calibrate to my guitar** to improve results, and review notes before applying them.
* **Stem separation** is classical DSP (harmonic / percussive separation, bass harmonic comb, centre-channel vocal mask) running locally, not a trained neural network. On a synthetic benchmark it recovers **drums, bass and vocals** well to moderately (SI-SDR +2 to +18 dB) and **guitar / other** poorly (the remainder). It cannot detect an absent guitar. Tempo, key and chord estimates are good on clear material and can be fooled by dense mixes. Expect "useful for practice", not studio stems.
* **Latency** is bounded by your OS and browser. The measured loopback number is the truth; the chip in the header is an estimate until you run the test.
* **Hand tracking** needs good light and a camera that sees the neck head-on; perspective error grows with tilt.
* **Not a plugin host.** There is no VST / AU / ASIO support. Effects are built in.
* **Six-string guitars only** for now (no 7/8-string or bass tab lanes).

## Phone and tablet

The same page adapts to the device it is on. It picks a layout from the screen size (and whether the main pointer is a finger), re-flows live when you rotate or resize, and never needs a separate site. Change it any time in **⋯ More ▸ Device layout** or **Settings** (Auto, Phone, Tablet, Desktop).

| | Phone | Tablet | Desktop |
|---|---|---|---|
| Navigation | Five sections along the bottom (**Play · Write · See · Stems · More**) with a chip row for the panels inside each; landscape moves them to a side rail | The familiar tab bar and band strip; **Tones** and **Tuner** slide in as drawers (☰) | Everything visible, resizable and floatable |
| Transport | Fixed bar at the bottom, in thumb reach; tempo, signature and key stay in the header | Header, on two rows | Header |
| Arrangement | **Tracks** button cycles mini strip → full-screen tracks → hidden (hidden by default in landscape and in *See*) | Always visible | Always visible |
| Writing tab | **On-screen keypad**: 0–9, **10s / 20s** for two-digit frets, arrows, delete, techniques, auto-advance | Same keypad | Keyboard |
| Gestures | Press and hold = right-click (MIDI-learn on knobs, band chip menus); pinch and two-finger pan on the Neural map; pedals move earlier / later from **⚙** | Same | Mouse and keyboard |
| While playing | The screen stays awake (switchable); **in-app monitoring starts off** to avoid speaker feedback | Same | Unchanged |
| Stage | **⛶ Full** fills the screen (works on iPhone, which cannot fullscreen an element) | Same | Fullscreen or pop-out window |

**What fits on a phone:** everything has a home: rig and pedalboard, band, tab writing, recording takes, transcription, stem separation, Neural map, Stage visuals and Research. Dense tools (the whole pedalboard, long tab sections, the Neural map) scroll or zoom instead of shrinking. **What is tighter:** the arrangement shows two or three lanes at once in the mini view, the floating-window layouts are desktop-only, and loading a long backing track into **Stems** is slow and memory-hungry on older phones, so short clips work best.

**Install it.** Open the hosted page over HTTPS, then use **⋯ More ▸ Install app** (Chrome, Edge, Samsung Internet) or the browser's **Share ▸ Add to Home Screen** (iPhone and iPad). The installed app opens full screen and keeps working offline after the first visit; your songs and settings stay on the device. Optional hand tracking still needs internet unless you [self-host it](docs/HOSTING.md#9-self-hosting-the-hand-tracking-files).

**Keep songs safe (iPhone and iPad).** Safari clears a website's saved data after about a week without a visit, unless the site is on the Home Screen. Add it (**Share ▸ Add to Home Screen**), open it from that icon, and your songs and recordings stay. **⋯ More ▸ Keep songs safe** shows the steps and has one **Back up all songs** button; **My songs**, **Open a file** (audio, lyrics, MIDI or a song file) and **Master · balance · click** are in the same sheet.

**Phone audio notes.** Use headphones. iPhones and iPads take a USB audio interface through the charging port; Web MIDI is not available in iOS browsers. Latency depends on the device's audio stack, so run the loopback test in **I/O**.

## Browser support

Developed and tested in **Chromium** (Chrome and Edge, desktop and Android) with phone, tablet and desktop emulation. Core features should work in current Firefox and Safari, but they are less tested, and some features depend on browser support:

| Feature | Needs |
|---|---|
| Audio, rig, band, tab, transcription, stems | Web Audio and AudioWorklet (all current browsers) |
| Microphone, camera, MIDI | HTTPS or `localhost`; **Web MIDI** is available in Chromium browsers, behind a permission prompt in Firefox, and not in Safari |
| Choosing an output device | Recent Chromium (`AudioContext.setSinkId`) |
| WAV bounce faster than real time | `OfflineAudioContext` with AudioWorklet (every current browser); otherwise it bounces in real time |
| Backup folder | Chrome and Edge on a computer (File System Access) |
| Keeping songs on iPhone, iPad, Safari | **Add to Home Screen** (or the Dock on a Mac); see *Keep songs safe* |

## Project layout

```
the-daily.studio/
├── index.html            ← the whole app as one file (built; the deploy folder is assembled from it)
├── src/
│   ├── parts/            ← source, concatenated in filename order into one script
│   ├── styles.css        ← all CSS
│   └── body.html         ← markup shell
├── codepen/              ← pen.html / pen.css / pen.js, ready for CodePen's three panels
├── manifest.webmanifest  ← installable-app manifest (generated)
├── sw.js                 ← offline cache service worker (generated)
├── samples/              ← sample tracks shown in Stems and Transcribe (+ manifest.json, info.json)
├── icons/                ← app icons (PNG) and their SVG source
├── scripts/              ← build.mjs (bundler), serve.mjs (static server), make-brand.mjs (logo, icons, social card), brand-mark.mjs, sync-journal.mjs
├── test/                 ← smoke test (jsdom), end-to-end suites and mobile (Playwright; lib.cjs and run.cjs run them in parallel), shots.cjs (documentation pictures), stem benchmark
├── docs/                 ← user guide, hosting, architecture, hardware checklist, screenshots
└── .github/              ← CI, Pages deployment, issue / PR templates
```

Read **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for how the parts fit together.

## Develop

```bash
npm install            # only needed for tests (jsdom, playwright)
npm run build          # src/ → index.html + codepen/
npm run build:check    # fails if the committed outputs are stale (CI runs this)
npm start              # serve on http://localhost:8080
npm test               # smoke test: boots the app in jsdom, fails on any error
npm run test:e2e       # every Playwright suite in parallel: core flows, I/O, drop, balance, lanes, camera, clips, session, render, MIDI, keep-safe, recording, voice, range editing, heatmap, backdrop, layout and phone
npm run test:e2e:core  # just the core flows (tunings, tour, rig, transcription, stems)
npm run test:mobile    # phone / tablet / desktop layouts, keypad, drawers, gestures, install files
npm run test:all       # smoke test, then every suite
npm run shots          # regenerate docs/screenshots (add words to pick some: npm run shots -- clips io)
npm run test:stems     # offline stem-separation benchmark on synthetic audio
```

Edit files in `src/`, run `npm run build`, and commit the regenerated `index.html` and `codepen/` together with your change. See [CONTRIBUTING.md](CONTRIBUTING.md). Before a release, work through the [real-hardware checklist](docs/HARDWARE_CHECKLIST.md): automated tests use a fake microphone and camera.

## Host it on your GitHub

The short version: push this folder to a new repository, then **Settings → Pages → Source: GitHub Actions**. The included workflow publishes `index.html` over HTTPS at `https://<your-user>.github.io/<repo>/` on every push to `main`. The complete walkthrough (commands, custom domain, hardening headers, CodePen, other hosts, release checklist) is in **[docs/HOSTING.md](docs/HOSTING.md)**.

## Roadmap ideas

* Seven- and eight-string guitar and bass support
* An optional machine-learning separator and transcriber (loaded on demand) alongside the classical DSP
* Tempo and key changes inside a song, MusicXML and Guitar Pro import and export (MIDI import is in 2.2)
* Dragging a clip onto another lane; copy and paste of clips between songs
* Sidechain ducking, pitch correction and a groove picker
* Shareable song links and a gallery of community presets
* More amp and cabinet models, impulse-response library browser

Ideas and pull requests are welcome.

## License and credits

Code: **[MIT License](LICENSE)**, © 2026 Tehau DeBarthe. You may use, copy, change and share it; keep the licence notice.

* **About me and credits** are inside the app under *Help & shortcuts*. Maker: [Tehau DeBarthe](https://github.com/TehauD) · [LinkedIn](https://www.linkedin.com/in/tehau/). A sibling project, [The Daily](https://the-daily.studio/journal/), a developer journal in the same spirit, is hosted at `/journal/` (source: [TehauD/daily](https://github.com/TehauD/daily)).
* **[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)**: optional hand tracking uses [MediaPipe Tasks Vision](https://developers.google.com/mediapipe) (Apache-2.0), loaded from a CDN only after you agree to a one-time download. Techniques: YIN pitch estimation (de Cheveigné and Kawahara, 2002), harmonic / percussive separation by median filtering (Fitzgerald, 2010), Karplus–Strong synthesis (1983).
* **[PRIVACY.md](PRIVACY.md)**: what is processed on your device, what can travel over the network and when, and what is kept.
* **[docs/LICENSING.md](docs/LICENSING.md)**: the licence and provenance register: every shipped file, font, dependency, model and downloadable output, and what is still open.
* Developed with AI assistance (Claude, Anthropic) under the author’s direction.

the-daily.studio is an independent project. It is not affiliated with or endorsed by Ultimate Guitar, Focusrite, Google or any amplifier or effects manufacturer; product and brand names are used only to describe compatibility.
