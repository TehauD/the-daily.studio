# the-daily.studio user guide

A practical walkthrough of every panel. For a ten-minute orientation, press **?** in the app and choose **Take the guided tour**.

Contents: [Clips and the mix](#clips-move-trim-fade-split-22) · [Fast WAV render](#faster-than-real-time-wav-render-22) · [Open a MIDI file](#open-a-midi-file-22) · [Keep songs safe](#keep-songs-safe-22) · [Perform, share and back up](#perform-share-and-back-up-20) · [Getting sound](#getting-sound-in-and-out) · [Tones and the Rig](#tones-and-the-rig) · [The band](#the-band) · [Arrangement and recording](#arrangement-and-recording) · [Tab editor](#tab-editor) · [Song, tunings and capo](#song-tunings-and-capo) · [Fretboard and tuner](#fretboard-and-tuner) · [Transcribe](#transcribe-audio-to-tab) · [Stems](#stems-and-backing-tracks) · [Neural map](#neural-map) · [Visuals and Stage](#visuals-and-stage) · [Vision](#vision-lab) · [Research](#research-panel) · [Export, history and backup](#export-history-and-backup) · [MIDI](#midi) · [Layout](#layout-and-themes)

---

## Hum to Song (start here)

**The band.** A new blank song starts with the band off, so pressing Play plays only what you recorded or wrote. The song that Hum to Song builds comes with the band; its panel has a **🥁 Band** button to switch drums, bass and rhythm off or on (your melody keeps playing), and the BAND row in the studio has the same switches.

**The first screen: pick a route.** **● Begin in the studio** (the default) opens a clean canvas: a blank page with the cursor in the lyrics, no camera and no full screen, to write your thoughts down. A slim bar underneath lets you **sing or hum an idea**, plug in a guitar, or load a song file instead. **🎥 Begin on stage** goes full screen with your camera and the hexagons, you in front. The camera is asked for only when you choose the stage, and you can switch any time with **🎥 Go on stage** in the Visuals bar, or **Start in** under Settings ▸ Workflow or I/O ▸ Camera. The app remembers the route you used last. Either way you are offered **● Hum or sing** or **🎸 I have a guitar**; under them: **a song file…**** (it is split into stems and the chords fill in), **a blank page** or **the demo song**. **＋ New song** (top right of the stage) brings this panel back; **⚙ Inputs** opens I/O, where you choose the microphone and camera once and the app remembers. "Start with camera and mic off" (under Other ways to start) never asks for either. ✕ Studio (top right) returns to the normal studio any time; ■ Stop audio stops all sound and releases the microphone.

**I have a guitar.** The coach walks you through three steps: **1 · Tune** each string (pluck it open; the bar fills when it is in tune), **2 · Learn the chords** of your song one at a time (the diagram shows where your fingers go; it says what it hears), **3 · Play along** with the band. You need an audio input for the guitar (the browser asks when you press the button). Skip any step with the buttons.

**The studio grows with you.** New visitors see four tabs with plain names. As you use the studio (open Studio view, edit, record, connect an input) more tabs appear. **Tools** on the tab row changes this: Automatic, Simple, More tools, Everything.

The fastest way in: **hum or sing a few seconds of melody and get a whole song back.**

1. On the first screen (or ☰ Songs ▸ 🎤 Hum or sing a song…, or More on a phone) press **● Hum or sing**. Your browser asks for the microphone, and for the camera only on the stage route (it is by default). Nothing is asked before you press the button.
2. Hum or sing for 10–30 seconds. No words or instrument needed. The big letter shows the note you are singing. Press **■ Stop**. You can also choose a voice memo or audio file instead.
3. In a few seconds the app has found your notes, tempo and key, chosen chords, built **Intro, Verse, Chorus, Verse, Chorus, Bridge, Chorus, Outro**, and starts playing it with a band. Your melody plays as the lead guitar.
4. Change anything in the panel at the bottom and it re-builds right away: **Style** (Folk, Pop, Rock, Ballad, Dance), **Tempo**, **Key** and mode, **Song shape** (full song or quick verse + chorus), and 🎲 **Try different chords**. **👂 Hear my hum** plays your original recording.
5. Make it yours: **✎ Add lyrics**, edit any chord, or **🎛 Open in the studio** for the rig, tab, stems and export. The song is saved in My songs automatically.

**Center stage.** On the stage route (or when "Go on stage while I sing" is ticked), the app opens the Visuals tab with your camera behind the hexagons, "me in front" (green screen), so you see yourself while you sing. Turn it off with **📷 Camera off** in the panel or the **📷 Camera backdrop** button in Visuals. The person cut-out needs a small model from the internet the first time; offline it falls back to an outline look.

**Record the stage.** **⏺ Record** (Visuals bar, and the bar on the full-screen stage) saves a video of the visuals with the song's sound to your device (.webm, or .mp4 where the browser makes that). Choose **Record now** or **The whole song, from the top** (no metronome, one pass). The camera is in the video only if you already turned it on; recording never starts it. Live guitar is in the sound when monitoring is on. Keep the tab in front while recording. Ctrl/Cmd + . stops it and discards it. Nothing is uploaded.

**Microphone.** The Hum screen uses the same microphone as the Audio button (names appear after you first allow access). **Ctrl/Cmd + .** stops a recording in progress and releases the microphone.

**What it can and cannot do.** It tracks one voice at a time, so hum single notes in a quiet room. It assumes 4/4. The song is arranged by rules from music theory and played by the app's own band; it is not an AI audio model, and nothing is sent anywhere. The first tab you see is the stage; after that the app remembers the last tab you used.

## Getting sound in and out

**Audio button and kill switch.** The app never asks for your microphone on its own. Start with the microphone off, or connect it from the start screen. The **Audio** button in the header (light: grey off, green live, amber no input, red killed) opens a panel to start the engine, choose and connect an input, toggle monitoring and optionally reconnect your last input on open. **Ctrl/Cmd + .** (or the red button in that panel) kills audio instantly: playback and recording stop, monitoring turns off, the microphone is released. Press Resume to continue. On a phone, find it in More.

1. Open **I/O** (left sidebar) or press the header **Audio** button. The **Audio input** card says *Not connected* and asks nothing of the browser yet.
2. Pick your interface in the list and press **Connect**. The browser asks for microphone access; allow it. (This is how a web page reads your audio interface.) If it is blocked, the card shows the steps for your browser and system.
3. Press **Set my level**, play or sing as loud as you will, and the **Input trim** is set for you. **Undo** puts it back. The **signal path** under the card (Input → Trim → Rig → Master → Out) shows where the loudest point is and says in one sentence if peaks are hot or low.
4. For a two-input interface, **Channels** offers *Guitar*, *Guitar + voice*, *Swap* and *Voice*; each input can also be set to Guitar, Vocal or Off.
5. Choose the **Audio output** (needs a recent Chromium browser to switch away from the system default) and press **Test sound** to hear it. **Hear myself** lets you hear the rig live; with an interface that has its own **Direct Monitor**, leave the app's monitor *off* to avoid doubling, or wear headphones.
6. **Advanced** (closed by default) has **Latency lab → Run loopback test** (a measured round-trip delay: patch an output to an input first), **Diagnose devices** and the rarely used controls. The header chip shows an *estimate* until you run it.
7. Plug in a different interface while the app is open and a small prompt offers to use it.

## Tones and the Rig

**Tones** (left sidebar) is the preset library, 27 starting tones from *Crystal Clean* to heavier and ambient sounds. Search, filter by category, click to load. Save your own in the Rig panel; they appear under **User**.

The **Rig** tab (1) has a control deck on top and the pedalboard below.

* **Current tone**, **Master** knob.
* **Store A / A / B / Store B** and the slider between them: store two snapshots, then morph or compare.
* **Mutate** nudges the active parameters randomly (a good source of happy accidents); **Reset all** goes to a direct signal.
* **Preset name → Save / Export / Import** manage your own tones as files.
* **Scenes** (eight slots): *Store* arms, then click a slot to keep the whole board. Click a slot to recall it with a smooth morph (the **Morph** time), **Shift+click** to overwrite, **right-click** to rename or clear. Number keys <kbd>1</kbd>…<kbd>8</kbd> recall scenes when **Live keys** is on, <kbd>0</kbd> switches every pedal off. **Scenes + band** makes scenes switch the band too.
* **Board / Stomp**: *Board* shows full pedals; *Stomp* shows big footswitch tiles for playing live. **Width** sets pedal size; **Show hidden** reveals pedals you hid.
* The **signal chain strip** shows order at a glance. Click a pedal to jump to it.
* Each pedal has a bypass **stomp** button, parameter knobs (drag, wheel, <kbd>Shift</kbd> for fine, double-click to reset, right-click to MIDI-learn) and **⚙** for width, colour, collapse, hide and footswitch binding (a key or a MIDI note). **Drag a pedal's header** to change its place in the chain.

Units: Noise Gate · Compressor · Wah · Overdrive · Distortion · Fuzz · Pitch / Harmony · Amp (Clean, Chime, Crunch, Lead, Hi-Gain) · Cabinet / IR (1×12, 2×12, 4×12, 1×10, Studio Flat, Acoustic Body Sim, or load an impulse response) · Parametric EQ · Chorus · Phaser · Flanger · Tremolo · Delay · Reverb (Room, Hall, Plate, Spring, Cathedral, Ethereal).

## The band

The **band strip** above the panels toggles **Drums**, **Bass**, **Rhythm** and **Lead tab** (the lead plays whatever is in your tab), plus the **Click**. Hotkeys: <kbd>D</kbd> <kbd>B</kbd> <kbd>G</kbd> <kbd>T</kbd> and <kbd>M</kbd>. Right-click a chip for level, pan and style. The **Mix** menu picks a rehearsal setup, such as "rhythm section only" or "everything but lead".

The **Band** panel (4) sets the style of each instrument: drum grooves (Folk Backbeat, Rock 8ths, Four on the Floor, Pop, Funk 16ths, Blues Shuffle, Reggae One-Drop, Bossa Nova, Ballad, Island, Metal Double Kick, Hip-Hop Boom Bap), bass patterns (Root, Root–Fifth, Eighths, Walking, Syncopated, Reggae Dub, Octave Pump) and strumming patterns for the rhythm guitar, including arpeggios and a Travis roll. Voicings for the rhythm guitar are searched for the **current tuning and capo**, not looked up from a fixed chart.

## Arrangement and recording

The lower strip is the **arrangement**, laid out like a DAW's track list: chord blocks, tab notes, bass and drum lanes, your **Guitar** and **Vocal** input lanes, recorded takes and, when a track is loaded, the **Track** and its four stems.

* Click a bar to select it; the **Tab** panel opens on that bar (click the chord lane to refine that bar in **Refine**). **Follow** keeps the playhead visible; **Zoom** and **Swing** change the view and feel.
* **Loop 4 bars here** and **Clear loop** set a practice loop; <kbd>L</kbd> toggles it.
* **Lanes.** Drag a lane's grip (⠿) to reorder it, drag its bottom edge to make it taller or shorter (double-click to reset), double-click its name to collapse it, or use **⋯** for height presets, colour, order and hide. **Lanes ▾** in the bar shows hidden lanes, adds the vocal or guitar lane and resets the arrangement; **− / +** scale every lane; drag the right edge of the headers to widen them. **⤢** gives the arrangement the whole centre (<kbd>Esc</kbd> returns).
* **Record** (<kbd>R</kbd>) starts after a count-in and captures every **armed** lane on the same clock. The Guitar lane records **both the dry DI and the processed (wet) signal**, so you can re-amp or export either; the Vocal lane records the microphone. Waveforms draw live while recording. Takes are saved with the song in this browser (and in bundles and backups); you can also export them as WAV from **Export** or a lane's **⋯** menu.
* **Takes** each have a lane with mute, solo, level and pan (guitar takes also have **RE-AMP**: play the dry DI through the current rig instead of the wet print; **RE** on a phone). Double-click a take's name to rename it. Each recording is a **clip** you can move, trim, fade and split: see [Clips](#clips-move-trim-fade-split-22).
* Drag the divider between the arrangement and the panels to resize, double-click it to reset. The **↕** button cycles the arrangement height. Double-click the ruler to clear the loop.

### Lane strips, Auto-balance and the master (2.1)

* **Every lane has a strip.** Band lanes, the vocal lane, takes, stems and the backing track show **M** (mute), **S** (solo), a volume fader, **pan** and **+Fx**. Click a lane's name to select it (it is tinted in the arrangement).
* **+Fx** opens that lane's effects: **EQ** (low, mid, high), **compressor**, a **reverb** send and a **delay** send, with quick looks (Flat, Warm, Bright, Punch, Room, Hall, Echo). The chip lights when anything is on. Settings are saved with the song, and with each take. The stem and backing-track strips (levels, mutes, solos and effects) are saved too, and come back when you reopen the song.
* **Take faders go to +12 dB** (a squared fader, so it is finer near the middle) for quiet recordings.
* **⚖ Auto-balance** (**Lanes ▾**, or the master menu) measures your takes and backing track on this device and shows a plan before it changes anything: vocal about −16 LUFS, guitar about −19, backing track about −21 (about −16 when it is alone), two or more guitar takes spread left and right, band parts back at their reference levels. **Apply** it, **Undo** it. A restore point is saved first. A take that is too quiet to reach its target is raised as far as its fader goes, and the plan says how far short it is.
* **Master chip** (header): the master level, a clip light and a preset (**Off**, **Clean**, **Warm**, **Bright**, **Loud**) that sets the tone, a touch of glue and the loudness target used when you save audio.
* **↶ ↷** in the song bar undo and redo changes to the song, its clips and the stem mix, in the order you made them (<kbd>Ctrl/Cmd</kbd> + <kbd>Z</kbd>; <kbd>Shift</kbd> to redo); the **✓ Saved** mark confirms your work is stored in this browser (it says *Saving…* for a moment after a change, or *Not saved* if the browser refuses).
* **Count-in.** The **▾** beside **Click** sets the count-in (none, 1, 2 or 4 bars) and the click volume.

### Drop it in (2.1, MIDI in 2.2)

Drag files onto the page, or press **Choose a file…** in the row under an empty arrangement.

| You drop | What happens |
| --- | --- |
| Audio or video (MP3, WAV, M4A, FLAC, OGG, MP4…) | A short question: **Backing track** (split into stems, sets tempo and key, a restore point first), **Vocal take**, **Guitar take** or **Hum → new song**. Several files at once become takes. |
| Lyrics (.txt, .md, .lrc) | The lyrics import opens with the text. |
| A song file (.daily-song.zip or a backup) or a song .json | The song (or songs) are imported. |
| A MIDI file (.mid, .midi, .kar) | The track picker opens, then **Create song** (see [Open a MIDI file](#open-a-midi-file-22)). |
| A rig .json | The rig is loaded. |

Takes land at the start of the song and the page grows enough bars to play all of them. Everything is read on your device. While a window is open, drops are declined with a note, and the browser never leaves the page for a dropped file.

### Clips: move, trim, fade, split (2.2)

Every recording on a take lane is a **clip**. Click one to select it (its outline turns gold and the **clip bar** under the arrangement toolbar names it); everything below is one undo step.

![Clips](screenshots/24-clips.png)

| To do this | Do this |
| --- | --- |
| **Move** a clip | Drag its body. It jumps by whole beats; hold <kbd>Alt</kbd> for no snapping. Nudge from the keyboard with ← → (<kbd>Shift</kbd> = a bar) while the arrangement has focus, or with the arrows in the clip menu. |
| **Trim** it | Drag its left or right edge. The audio is not changed; **Reset trim** in the clip menu brings it all back. |
| **Fade** it | Drag the small square at the top-left or top-right corner, or set **Fade in / Fade out** in the clip menu. The fade is shown as a ramp on the waveform. |
| **Split** it | Put the playhead where you want the cut and press **✂ Split** (<kbd>Ctrl/⌘</kbd>+<kbd>E</kbd>). Both halves share one recording in memory, so nothing is copied. |
| **Duplicate** it | **⧉ Duplicate** (<kbd>Ctrl/⌘</kbd>+<kbd>D</kbd>) puts a copy right after the clip. |
| **Delete** it | **✕ Delete** or <kbd>Del</kbd>. Undo brings it back with its audio. |
| **Save** a clip | Right-click ▸ **Save clip (WAV)**. |

![The clip menu](screenshots/25-clip-menu.png)

* A lane keeps **one** level, pan, mute, solo and effects strip however many clips it holds. Delete the first clip and the lane's settings pass to the next.
* **Auto-balance** and **Bounce** use the lane as it plays: trimmed parts are silent, fades are applied.
* On a phone the clip bar has a row of its own above the arrangement; the same actions are there, with **⋯** for the rest.
* A clip stays on its own lane. Dragging a clip to a different lane is not built yet.
* **One history.** <kbd>Ctrl/⌘</kbd>+<kbd>Z</kbd> steps back through clip edits, song edits, the stem mix and Auto-balance together, newest first.

### Faster-than-real-time WAV render (2.2)

**Bounce master WAV** and **Bounce this part** no longer wait for the song to play. The app builds a second copy of its sound engine that is not connected to your speakers, schedules every note, take and backing-track stem on it, and mixes the song as fast as your processor allows: the same strips, effects, master tone and limiter that you hear, in the same order.

![Fast render](screenshots/30-render.png)

* A window shows progress and a **Cancel** button. <kbd>Ctrl/⌘</kbd>+<kbd>.</kbd> stops it too. While it runs, the sound engine you were using is set aside and put back when it ends.
* The saved file is identical in level and tone to a real-time bounce. The window ends with the render time.
* If the browser cannot do it, a message says so and the bounce runs in real time as before. **Compressed audio**, the **share page** and **Record the stage** still record while the song plays, and say so on their buttons.
* **Settings ▸ Export ▸ Render WAVs faster than real time** turns the fast path off (for example, to compare the two files).
* Speed depends on your device: on a small two-core test server it ran about three times faster than real time.

### Open a MIDI file (2.2)

Drop a `.mid`, `.midi` or `.kar` (karaoke) file on the page, or choose one in **＋ New ▸ Start from a song**, or **⋯ More ▸ Open a file** on a phone.

![Open MIDI file](screenshots/31-midi.png)

1. **The window** lists the pitched tracks with their note counts and range, and shows the file's tempo and time signature. The track most likely to be the melody is chosen for you; change it with the round buttons. The other tracks are ticked to decide the **chords**. Untick any you do not want. Drum tracks are not copied: the band plays its own pattern.
2. **Create song** makes a new song (your current song is saved first): tempo and time signature from the file; the key worked out from the notes (the file's own key signature is used when it is one of the best fits); chords for every half bar from the notes that sound together, with the lowest note counted most; the melody on the lead tab; karaoke words as lyrics under the chords; and a band style chosen from the tempo and key (Ballad, Folk, Pop, Rock or Dance). With only a melody, chords are suggested from the melody.
3. The song is limited to 160 bars. Very large files (more than 8 MB, 300,000 notes or 128 tracks) and files with SMPTE time are explained instead of opened.

Everything is read on your device. The result is an ordinary song: edit the chords, change the style, add lyrics, record over it.

### Keep songs safe (2.2)

Your songs live in your browser. Chrome and Edge keep them unless you clear site data. **Safari on an iPhone, iPad or Mac clears a website's saved data after about a week without a visit**, unless the site has been added to the Home Screen (or the Dock on a Mac).

![Keep my songs safe](screenshots/32-keep.png)

* **⋯ More ▸ Keep songs safe** (and the card at the top of **My songs**) explains it in three steps (Share ▸ Add to Home Screen ▸ Add), and has one **Back up all songs** button that saves every song and recording as one zip. **Open a file** brings that zip back.
* The first time you record a take in Safari on an iPhone or iPad, a one-time tip offers the same.
* A backup reminder appears after a while away: 7 days where the risk is high (Safari not on the Home Screen), 30 days elsewhere. It only reminds; nothing is uploaded.
* On a computer, **Settings ▸ Export ▸ Backup folder** (Chrome and Edge) writes each song to a folder as you work.

### Recording guitar and vocals together

A two-input interface (a Focusrite Scarlett Solo / 2i2 / 4i4, for example) shows up in the browser as **one device with two channels**. The app reads input 1 and input 2 separately, so:

1. Plug the guitar into one input and the microphone into the other.
2. In **I/O → Audio input**, choose the interface itself (not "Default"); in **Channels** set one input to **Guitar** and the other to **Vocal**. **Detect & visualise** chooses what the note detector, tuner, neck and visuals follow: **Guitar**, **Vocal** (the neck shows the note you sing) or **Both**; the visuals Source menu can also listen to the vocal microphone directly. The Vocal lane appears with its own meter.
3. Arm both lanes with ● (guitar and vocal), then press <kbd>R</kbd>. You get two takes, aligned to each other and to the band.
4. **Hear vocal** monitors the microphone through the app; use headphones (or your interface's Direct Monitor with the app's monitor off) or the microphone will feed back. **Vocal polish** adds a 90 Hz high-pass and gentle compression.

Browsers cannot reach more than the channels the operating system exposes for that device. A mono device (a webcam microphone, an input that only exposes one channel) cannot be split into guitar and vocal, and the-daily.studio says so when it detects that.

## Tab editor

* Click a cell and **type a fret number** (0–24). Arrow keys move; <kbd>Del</kbd> clears; <kbd>Shift</kbd>+arrows select; <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> transposes.
* Techniques: <kbd>h</kbd> hammer-on · <kbd>p</kbd> pull-off · <kbd>/</kbd> <kbd>\</kbd> slides · <kbd>b</kbd> bend · <kbd>~</kbd> vibrato · <kbd>x</kbd> dead / muted note · the <kbd>&lt;n&gt;</kbd> button marks a natural harmonic.
* <kbd>Space</kbd> plays from the current bar. **+ Bar / − Bar**, **Copy / Paste / Clear bar**, **Fill bar** and **Fill section** speed things up. **Capture from playing** writes notes you play into the grid while the band runs.
* The picker at the top chooses which section you are editing; the pattern menu next to **Fill bar** / **Fill section** offers fingerstyle and strumming patterns (for example *Fingerstyle pop*) to fill from.
* Bar labels and the string names follow your tuning, e.g. `C# G# C# F# A# D#`.

## Song, tunings and capo

The **song strip** under the header holds the **title**, **artist**, **Tuning**, **Capo** and **scale**, and is visible whatever panel you are in. **Notes & tuning ▾** opens the notes field (they appear in export headers) and the custom per-string tuning editor. The **Song** panel (3) is the map of sections and the **chord library** with several playable voicings for every chord in the current tuning; the lyric and chord canvas for each section is **Refine** (right sidebar).

**Loading a track fills in the song.** When a backing track finishes loading, the strip takes its title and artist (from the file's tags, or a cleaned-up file name such as "Good Morning" from `01 - Good_Morning (Official Audio).m4a`), and sets tempo, time signature, key and scale. If the song has no work of your own yet, the detected chords are written into it. Anything you had is snapshotted first (undo, or **History**, gets it back). The **♪ track chip** at the right of the strip offers *Import chords*, *Use tempo + key*, *Play band with track*, *Open Stems* and *Unload*, the switch **Track follows the transport** and the **When a track loads** setting (fill details + chords, details only, or nothing).

**Pasting finished lyrics.** In Refine press **📋 Paste lyrics** (or paste a whole lyric sheet into any lyric box, or drop a .txt / .lrc file on the panel). Headings like `[Verse 1]`, `[Pre-Chorus]`, `(Chorus)`, `Verse 2:` or `## Bridge` become sections; with no headings, blank-line stanzas become Verses, and a stanza that repeats becomes the Chorus. Choose where it goes (a section per block, fill the sections you have, or add after), how many bars a line gets for new sections, and whether to place your chords over the words. The preview lists exactly what happens, including any sections that would be replaced. One undo puts everything back.

**Refine** is the shared space for lyrics and chords: each section is a card with its name, bars, lyric lines and chord names. Keep any other panel (Tab, Fretboard, Stems, Transcribe) open in the centre while you write.

**Tunings.** Choose a preset (Standard, Eb, D, C#, C, B; Drop D, Drop C#, Drop C, Drop B, Drop Bb, Drop A, Double Drop D; DADGAD; All fourths; Open G, D, Dm, E, C, A; slack-key tunings), or open **Custom tuning · set each string** to pick the note and octave of all six strings (E1–G5). Quick shifts: **↓ ½ step**, **↑ ½ step**, **Drop low string**, **Reset to standard**. The **Theory** tab in the left sidebar has the same tuning menu, and the strip's **Tuning** menu is the quickest way to change it.

Everything follows: the tuner's string circles (click one to hear its reference tone), tab and fretboard labels, chord voicings, tab playback, live note and chord detection, transcription, and exports. Flat tunings are spelled with flats.

**Capo** (0–12) raises every open string; voicings, the fretboard and detection take it into account.

## Fretboard and tuner

The **Fretboard** (5) draws a hexagon fretboard for your tuning and capo. Pick a **Root** and a **Scale** (major, minor, pentatonics, blues, the modes, harmonic and melodic minor, Phrygian dominant, whole tone, diminished, Hirajoshi), then choose what to overlay: **Scale**, **Chord tones (current chord)**, **Scale + chord**, or **Live only** (just what you play). Label notes as **Note names**, **Scale degrees** or **Fret numbers**; **Follow song** tracks the song's key and chord; **⇄ Handedness** mirrors the board for left-handed players. Click any note to hear it. With Vision active, tracked finger positions overlay too.

The **Tuner** (right sidebar) shows the detected note, frequency, cents and clarity. A note within ±5 ¢ turns green. Click a string circle for a reference pitch. Below it are the level meters, **Live analysis** (chord, key, centroid, rolloff, vibrato and more) and a spectrum.

## Transcribe: audio to tab

Turns a recording into polyphonic tab for your tuning.

1. **Source.** Pick a take, **Import audio…** (WAV, MP3, etc.) or **Record & transcribe**.
2. Adjust **Sensitivity**, **Max simultaneous notes**, **Quantise to** (16th / 8th / quarter), **Auto-align timing**, and whether to detect **bends & vibrato** and **hammer-ons / pull-offs / slides**. Under **Musical priors**, *Chord-shape repair* tests the bar's chord voicings against the spectrum and keeps the one that explains the audio best (it recovers octave-doubled strings), sliders set how strongly chord shapes and the camera log influence string / fret choices, and *Hide notes below confidence* filters the display.
3. **Review.** Notes are placed on strings and frets and coloured by confidence. Hover for details; click to accept or reject; rejected notes are ignored on apply. A timing plot shows each event's error against the grid.
4. **Apply to song** with **Replace bars** or **Merge into empty slots**; optionally name empty bars' chords from what was heard. **Copy tab** and **Export report (JSON)** are also available.

Quality tools:

* **Run self-test** transcribes synthetic Karplus-Strong guitar with known ground truth in *your current tuning, capo and settings* and reports precision, recall, F1 and string/fret accuracy. Synthetic audio is cleaner than a room, so treat it as an upper bound.
* **① Measure noise** (3 s of silence) sets a note gate for the tuner, detection and visuals. **② Check open strings** walks you through the open strings and flags tuning, level and clipping problems, then stores your guitar's brightness and sustain.

Tips: record a clean, dry take; avoid heavy distortion for transcription; play chords in a steady rhythm; use two takes of the same part to unlock *consensus* transcription that drops random ghost notes.

## Stems and backing tracks

Load a backing track to separate it, learn its structure and play along.

1. **Load backing track** (any audio file your browser can decode). Analysis runs locally in a worker with a progress bar.
2. The waveform shows the mix and four stems: **Drums**, **Bass**, **Vocals** and **Guitar · keys · other**, with the detected chords above. Click a lane to seek, **Shift-click** to set a loop start, **Alt-click** to set a loop end. Each stem has **M**ute, **S**olo, a level and a **⤓ WAV** export, plus a presence estimate (for example "strong · 76 % of track · enters 0:09").
3. **JAM** presets set the mix in one click: *All*, *Play the guitar* (mutes the guitar / keys stem), *Play the bass*, *Karaoke* (mutes the vocal) and *Drummer's out*.
4. **Tempo · key · chords · groove** reports the tempo, key, how many bars it found and the drum groove it averaged. If it found double- or half-time, use **½ tempo** / **2× tempo**; if the bar lines are off by a beat, use **‹ downbeat** / **downbeat ›**; **reset** returns to the automatic result. Each detected bar's chord is listed (hover for its time).
5. The track and each stem also appear as **lanes in the arrangement**, aligned to the bar grid, with their own mute, solo and level. With **Track follows the transport** on (the default), play, stop, seek and loop in the main transport move the track with the band.
6. Use the result: **Import chords as the song** (a snapshot is saved first), **Use tempo + key only**, **Copy drum groove to the band**, or **▶ Track + band together** to import the tempo, start the track at bar 1 and let the band play with it.

Be realistic: this is classical signal processing (harmonic / percussive separation, a bass harmonic comb, a centre-channel vocal mask) tuned for practice, not studio-grade source separation. Drums and vocals separate best; the guitar / other stem is whatever is left, and the app cannot tell whether a guitar is present at all.

### Sample tracks

Under the *Load backing track* button, **Sample tracks** lists any songs the site owner has bundled (none ship with the app). Tap one to load it into Stems; **Transcribe** has the same shelf under *Import audio*. The file is fetched from the site only when you tap it, so a 5 MB track costs nothing until used. The shelf is hidden when the page is opened straight from disk, in CodePen, or from a single emailed `index.html`, because those have no `samples/` folder beside them.

**Add your own (repo owners):** copy the audio into `samples/`, optionally name it in `samples/info.json`, run `npm run build`, commit and push. Only add music you have the right to share: a public repository is public.

## Neural map

A node graph of the music as it plays: notes, chords, functions (tonic, subdominant, dominant), sections and the key form layers, with learned transitions between chords shown as edges. Switch between **Layers**, **Fifths** and **Force** layouts; colour by pitch class, time in song, section, loudness, octave or chord quality; toggle edges, learned transitions, notes, the path taken, labels, unheard (not yet played) nodes, the floor, pulses and spin; scrub the **Replay**; **Pre-train** the transition model from your song or **Forget** it. Hover or click nodes for details; drag to rotate, right-drag or Shift-drag to pan, wheel to zoom, double-click to reset the view.

## Visuals and Stage

**Visuals** (6) offers Hex Resonance, Hex Tunnel, Spectrogram, Chroma Wheel, Oscilloscope, String Field, Chord Bloom, Harmonic Orrery, Ridgeline, Beat Grid, a Prompter, the Neural map, **Fifths Halo** (the circle of fifths as a ring around you, with the song's chords on it and your notes flying in) and **Prism** (a kaleidoscope that changes on the off-beat; flashes and spin are limited while Stage ▸ safe is on). In full-screen, **✦ Look** cycles Hex Resonance, Fifths Halo, Prism and Tunnel. **🎸 Neck** puts a small guitar neck on the visuals and the Neural map: what is playing, a dashed ghost of the note coming next, the note you are singing (pink, at every place it can be played) and any chord you click in the Neural map, driven by the rig output, the master mix or your dry DI. Add a **camera backdrop** or go **⛶ Stage mode**.

**Camera look.** Turn on **📷 Camera backdrop** (Visuals tab, or per scene in Stage) after starting the camera in the Vision tab, then pick how it sits with the visuals: *Dimmed behind the visuals*; *Visuals frame me (edges in)*, where you stay clear in a soft oval and the visuals live around the edges (drag the slider to size the clear area); or *Me in front (green screen)*, which cuts you out so the visuals play behind you. The cut-out downloads a small model the first time (Google's selfie segmenter, nothing is uploaded); offline it falls back to edges-in. Good light and a plain-ish background help the cut-out.

**Stage** (7) is the performance surface: full-screen visuals with **eight scenes** (<kbd>1</kbd>…<kbd>8</kbd> when Stage is focused, or MIDI notes 48–55). Each scene picks a visual and sets hue and hue drift, trails, glow, kaleidoscope, sensitivity and beat flash, plus overlays for the current chord, lyric, beat, tuner and song info. **Auto-switch on section** changes scene by section name as the song plays. Move the mouse to show the controls; they fade when idle.

## Vision lab

Uses your webcam to relate what your hand does to what you play.

1. **Camera on/off**, choose **Hand tracking (MediaPipe via CDN)** or **Motion energy only (offline)**.
2. **Calibrate neck**: frame the neck head-on, press ⌖, then click the nut on the low-E string, the 12th-fret marker on the low-E string, and the nut on the high-e string. Fret spacing uses the equal-temperament rule `d(n) = L·(1 − 2^(−n/12))`.
3. Fusion statistics compare camera-estimated fingering with detected notes. Camera frames never leave the page; the hand-tracking model downloads from a CDN only if you choose it (see [HOSTING.md](HOSTING.md#9-self-hosting-the-hand-tracking-files) to self-host it).

## Research panel

Live and session measurements: pitch-class usage and intonation (mean cents deviation per note), timing against the click (mean, standard deviation, 95th percentile), vibrato events, attack harshness (HFR), noise floor and SNR, crest factor, clipping, key estimate, latency and camera agreement. **⏱ Loopback latency test** measures round-trip delay. **CSV** and **Session JSON** export everything for your own analysis.

## Perform, share and back up (2.0)

**Perform.** Press **🎤 Perform** in the song bar (or on the full-screen stage). A readiness check comes first: audio is running, your input is connected (with a live level), the camera if you want it, lyrics to follow, and the count-in length. **Start performing** then shows the chord huge with the next one under it, the lyrics scrolling with the song, a big count-in, and **Play**, **● Record**, **Loop**, **Click** and tempo −/+ within reach. Tick **Show the visuals behind** to put the stage behind the words, or leave it for a plain dark page. <kbd>Space</kbd> plays or stops, <kbd>R</kbd> records, <kbd>Esc</kbd> leaves, and <kbd>Ctrl/⌘</kbd>+<kbd>.</kbd> stops everything. A finished take goes straight into your song.

**Voice memo.** On a clean canvas, **🎤 Voice memo** records your voice as it is: one Vocal take at the start of the page, no analysis and no band. The page grows enough bars to play all of it.

**Auto look.** **🎬 Auto look** in the Visuals bar makes the look follow the section while the song plays (choruses open into the Fifths Halo, bridges into Prism, intros and outros into the Tunnel). When playback stops, your own look comes back.

**Export and share** (the Export panel, and the Save menu on the hum result):
* **Bounce master WAV** is rendered faster than the song plays (see [above](#faster-than-real-time-wav-render-22)) and reports the song's loudness (LUFS) and true peak. **Settings ▸ Export ▸ Loudness target** can bring song WAVs to −14 (streaming), −16 or −23 LUFS, never past −1 dBTP. Part WAVs are left as they are.
* **Compressed audio** saves M4A (or Opus in a .webm where the browser cannot make M4A). It plays once in real time, like a bounce.
* **Share page** saves **one HTML file** with the sound, lyrics, chords and a small player. Open it in any browser or send it. Click a lyric line to jump there. It loads nothing from anywhere.
* **Print or PDF sheet** makes a clean sheet with chords over the words for the browser's Print dialog (choose **Save as PDF** there).
* **⏺ Record the stage** (Visuals bar) saves a video of the visuals with the song's sound.

**Backup folder** (Chrome and Edge on a computer). **Settings ▸ Export ▸ Backup folder ▸ Choose a folder…** Each song is written there as a `.daily-song.zip` shortly after you change it, and **Save all songs now** writes them all. A folder inside a cloud drive works with that drive's own sync. After a browser restart it may ask once to allow access again. No account is involved: the browser writes the files directly. Renaming a song leaves its old file in the folder.

## Export, history and backup

* **Ultimate Guitar** text with `[ch]` / `[tab]` tags (toggle off for plain text), **ChordPro**, lyrics-only, and tab-only, each with **Copy** and **Download**. A **submission lint** warns about unreadable chords, over-wide lines and similar problems.
* **MIDI**, **Bounce master WAV** (rendered faster than real time), **Each band part (WAVs)**, **All takes (dry DI + wet)**, **Project JSON** (<kbd>Ctrl/⌘</kbd>+<kbd>S</kbd>), **Import project**, **Load demo song**, **New blank song**.
* **Version history** snapshots your song automatically (before each play, periodically and when you leave the page) and keeps the last 30 in this browser. **Restoring** first snapshots the current state, so it is reversible. **＋ Snapshot now** makes one on demand.
* Your song autosaves to this browser. **Back up all songs** (☰ Songs ▸ All songs) is your portable backup of everything; **Project JSON** is one song as plain text. Clearing browser data deletes the autosave.

## MIDI

Connect a controller and allow MIDI access when asked (HTTPS or `localhost`; Chromium browsers). Right-click any knob to **MIDI-learn** a control. Pedals can be bound to MIDI notes in their **⚙** menu, pedalboard scene slots respond to notes 36–43, and Stage scenes to notes 48–55, so a pad controller works as a footswitch bank.

## On a phone or tablet

The app switches layout by itself; **⋯ More ▸ Device layout** (or Settings) forces Phone, Tablet or Desktop.

**Phone, portrait.** Top: tempo, signature, key and the **⋯** button. Below it a row of chips for the panels in the current section. Bottom: the transport (rewind, play, stop, record, loop, click and the bar·beat·slot readout) and the five sections:

| Section | Panels |
|---|---|
| **Play** | Rig (tone, A/B, scenes, pedalboard) · Tones · Tuner · I/O |
| **Write** | Tab · Song (tuning, capo, chords, lyrics) · Band · Fretboard · Theory |
| **See** | Visuals · Stage · Neural · Vision |
| **Stems** | Stems · Transcribe |
| **More** | Research · Export |

The **⋯** button (top right) opens the **More sheet**: **Hum or sing a song**, **Audio · kill switch**, **Light theme**, **Appearance**, **Monitor**, **Screen awake**, **Settings**, **Help**, **Guided tour**, **Save project**, **Share link**, **My songs**, **Open a file** (audio, lyrics, MIDI or a song file), **Master · balance · click** (master preset, Auto-balance, count-in and click level), **Keep songs safe**, **Install app** (when the browser offers it), **Full screen** and **Device layout**.

The **Tracks** button at the right of the chip row cycles the arrangement between a mini strip, a **full-screen tracks view** (no other panel competing; the button then reads **▾ Panel**) and hidden. The band strip (drums, bass, rhythm, lead) sits under the chips in *Play* and *Write*.

**Landscape** puts the sections on a left rail and the transport in the header, which leaves the most room for the Fretboard, Stage and Neural map. The arrangement starts hidden there; bring it back with **Tracks**.

**Write tab on a touch screen.** Tap a cell, then a fret on the keypad. **10s** / **20s** turn the next digit into 10–19 / 20–24. **Auto ▶** advances after each note (turn it off to stack notes on different strings). Arrow keys move the cursor and **▲ ▼** change string; **⌫** clears a note; **h p / \ b ~ x ‹n›** set techniques; **⏵ bar** plays from the current bar. Chord names above each bar are edited in **Song**.

**Record a take.** Open **I/O**, pick the input, put headphones on, then in *Play* press **●**. In-app **Monitor** starts off on touch devices; switch it on from **⋯ More** once you have headphones in. The screen stays awake while you play (switch off in **⋯ More** if you prefer).

**Gestures.** Press and hold a knob or a band chip for its right-click menu. Drag on the Neural map to orbit, pinch to zoom and use two fingers to pan. Open a pedal's **⚙** and use **Earlier / Later** to reorder the chain.

**Stage.** **⛶ Full** in the Stage panel fills the screen; rotate to landscape and prop the phone on a stand.

**Tablet.** The tab bar, band strip and arrangement stay as on desktop. Tap **☰** (top left) for Tones, I/O and Theory and the tuner icon (top right) for the tuner, levels and live analysis; tap outside to close.

**Install.** In Chrome or Edge choose **⋯ More ▸ Install app**; on iPhone or iPad use **Share ▸ Add to Home Screen**. After one visit the installed app also opens offline.

## Layout and themes

* **Drag** dock tabs to reorder; **double-click** a tab to float it as a window and again to dock it back. **▦** opens layout presets (including *Songwriting*, *Track study* and *Record*), show / hide for each panel and a reset.
* **☰** at the end of the tab strip lists every panel (nothing is hidden when the strip scrolls). **⤢** expands the current panel to the whole centre; <kbd>Esc</kbd> goes back.
* **Interchangeable panels.** **⇆** on a sidebar (or **☰ → Where panels live…**) lets you put any panel in the centre, the left sidebar or the right sidebar, swap the two sidebars, collapse or expand all cards and reset. Sidebar cards collapse with their ▾ and remember it.
* Drag the vertical splitters to resize the sidebars (double-click to reset); each sidebar tab remembers its own width. <kbd>[</kbd> and <kbd>]</kbd> toggle them. In a desktop window narrower than 1180 px the right sidebar opens as an overlay when you choose Refine or the Monitor.
* **◐** switches light and dark. **⚙** opens Settings: theme and accent colour, UI scale, reduced motion; A4 reference pitch, sharps vs flats, a left-handed fretboard and fretboard labels; the audio engine (latency hint, sample rate, analyser size and smoothing, with an *audio engine restart*); count-in, metronome level, humanize and timing grid; recording options; Ultimate Guitar export width and tags; and a data section to export settings or reset everything.
* **?** shows shortcuts and starts the guided tour.

## Songs, new songs and reset (1.4)

**Where your songs live.** Every song is saved automatically in this browser (IndexedDB), with its takes and, for a song started from a track, the backing track. Nothing leaves the device. Browsers can clear site data when storage is low or if you clear cookies, and Safari does it after about a week away, so use **Back up all songs** to keep a copy (see [Keep songs safe](#keep-songs-safe-22)).

**Starting.** **＋ New** (song bar; on a phone Settings ▸ Data ▸ My songs ▸ ＋ New song) asks how to begin:
- *Clean canvas*: a blank page. Give it a working title; **Set it up first** lets you choose tempo, key, mode, time signature, tuning and shape.
- *Start from a song*: choose or drop an audio file, or pick a sample. It is split into stems; the title, artist, tempo, key and chords are filled in, and the Studio opens. A **MIDI file** works here too: see [Open a MIDI file](#open-a-midi-file-22).

**My songs.** ☰ Songs ▸ All songs: Open, Rename (✎), Duplicate, Bundle (export) and Delete (click twice). **Back up all songs** (the button in the card at the top) gives one zip with every song, take and backing track; **Open a bundle or lyrics…** imports a `.daily-song.zip`, a `.txt` / `.md` / `.lrc` lyric file (goes through Paste lyrics), or an older `.daily-song.json`.

**Backing tracks.** The original file is stored and separated again when you reopen the song. On phones you tap **Restore track** (Settings ▸ Data ▸ Restore track changes this).

**Zoom.** The song bar's **Canvas · Song · Studio** control changes how much of the workspace is shown for the same song. Canvas is just the lyric and chord page.

**Reset.** Settings ▸ Data ▸ Reset… (or Reset… in My songs). Choose what to erase, or use *Layout only*, *Settings & layout* or *Everything*. Songs are only erased if "All songs & recordings" is ticked; click once to arm, again to erase. The app then restarts.

## Appearance (1.6)

Open the **◐** button (or Settings ▸ Customize appearance…; on a phone More ▸ Appearance). The drawer sits beside the app so you see every change as you make it.

- **Looks** set everything at once. **Mode** chooses Light, Dark or Match system.
- **Palettes** are grouped light and dark; the one in use is marked. Picking a palette switches to its mode. Choose one light and one dark palette, then press **Match system** to have the app switch between them with your device.
- **Accent** colours the controls, active tabs, waveforms and highlights. The colour wheel takes any colour and adjusts it so it stays readable on the palette.
- **Density, corners, surfaces and text size** change spacing, shape and depth.
- **Typeface**: the default is Inter with Montserrat headings, built into the page. The other choices use fonts installed on your device (nothing is downloaded). **High contrast** strengthens text and borders. **Colour-blind safe** swaps charts, meters, visuals and status lights to a palette that stays distinguishable for red–green and blue–yellow colour-blindness.
- **Reset appearance** returns to the defaults.

## Support

The app is free and open source. If it helps you make something, a coffee keeps it going (never expected). The link, when set, is in About inside the app.
