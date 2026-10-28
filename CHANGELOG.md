# Changelog

All notable changes to the-daily.studio (earlier versions were released under the name FRETWORK). Versions follow [Semantic Versioning](https://semver.org/).

## 2.8.0 — 2026-10-27 — Loop & layer: record chords, loop them, play a lead on top

A looper-pedal way of working, built on the recording engine that already made one take per pass of a loop.

### Added
- **⟲ Loop & layer** (Arrangement tab; More ▸ Loop & layer on a phone). One window sets a 1, 2, 4 or 8 bar loop, clears the band away (or keeps it), counts you in and records. Each pass of the loop records a new layer while the earlier layers play back (`src/parts/61-looper.js`).
- **A strip while the loop runs**: what is happening (count-in, recording layer N, looping N layers), the loop length and pass number, **Keep looping** (stop recording, keep playing), **● Add a layer**, **↶ Undo layer** and **■ Stop**.
- **A fifth guided session**, *Record, loop and layer* (six steps), now the second goal on the first page in place of *Record guitar and voice*, which is still in the sessions menu.
- `test/e2e-looper.cjs` (22 checks) and extra checks for the new session in `test/e2e-guide.cjs`.

### Changed
- Takes recorded on a looped pass are named **Layer N** (**Vocal layer N** for a voice), and a pass on which nothing was played is no longer kept as a silent take.
- The song is extended automatically to fit the loop.

### Honest limits
- Tested in a headless browser with a fake microphone, not with a real guitar and interface. Your interface's delay is compensated, but a note played in the last few milliseconds before the loop point can be clipped by about that delay.
- Layers are separate takes, not a destructive overdub, so they can be moved, trimmed, muted and exported but not "baked" into one track here.

## 2.7.0 — 2026-10-27 — Goals on the first page, guided sessions, first-open tab notes, plain words and a Show preflight

The studio was too hard to use straight away. It still adapts quietly to how much you use it, but now it also teaches: it asks what you want to **do** (never how good you are) and walks you through it on the real controls.

### Added
- **Four goals on the first page** instead of the three feature boxes: *Turn a hum into a song*, *Record guitar and voice*, *Learn a song*, *Run a show*. Each opens the right place (a clean page, the Record layout, the Backing track tab, or the Show layout on the demo song) and starts a guided session. **I know my way around** opens the studio with every tool showing and no coaching. People who already have songs see one button, as before.
- **Guided sessions** (`src/parts/60-guide.js`). A small card names one step, outlines the control it means, and ticks the step off when the app sees it done: a hum recorded, a take stopped, a stem muted, a test pattern shown. **Show me** takes you to the control, **Skip** moves on, **–** folds the card, **✕** leaves and keeps your place. The card moves out of the way of the control it points at, can be dragged, and is a slim strip on a phone. Finishing a session adds the tools it used to the tab strip (and says which). Under **? ▸ Guided sessions**, and on the phone's More sheet: all four, with Start, Resume and Again.
- **A note the first time a tab opens**: what it is in a sentence, one thing to try, **Got it**. It then folds into a small “What is this tab?” line. Never shown on *Everything*, while a session is running, or when switched off in the sessions menu.
- **DAW words, in guitar terms** (lane, clip, take, arm, dry and wet, input level, monitor, latency, count-in, loop, stem, snap, master, render, scene): a searchable list under ? ▸ Guided sessions.
- **Show preflight.** Seven checks a technician makes before doors: pick a look, check the rig, open the output, run a test pattern, set the master level, try the blackout, play the song once and watch the flash meter. The app ticks each when it sees it done. It is the *Set up a show* session and also sits at the top of the Output tab in Show setup, with **Start over** for the next room.
- A **Getting started** page for search (`guide/getting-started/`), linked from the guide pages and the sitemap.
- `test/e2e-guide.cjs` (41 checks), and six new screenshots (`59`–`65`).

### Changed
- The first page asks “What would you like to do first?” first; **Begin in the studio**, **Try the demo song** and **I know my way around** follow as quieter choices. Nothing asks for the microphone or camera on load.
- The tour offer does not appear on top of a guided session.

### Honest limits
- A step is ticked from the app's own state, so a step the app cannot observe is worded as an instruction and ticked by the thing it causes (for example, the hum step ticks when a hum has been recorded, not when the button is pressed).
- The sessions are tested by driving the same state the guide watches; they have not been watched with first-time users. Watching five people try it cold, and timing how long until they hear something they made, is the next thing to do.
- The preflight is a checklist the app ticks, not a guarantee the room is safe or the projector is aligned.

## 2.6.0 — 2026-10-27 — Search-friendly pages, nine distinct layouts, optional Monitor widgets and a show-setup console for a stage or AV technician

### Added
- **Search and sharing.** The first page now has a precise title and description, one canonical address, Open Graph and Twitter preview tags, structured data (a website and a free software application, with no invented ratings or reviews), an explanation for visitors and crawlers that do not run scripts, and a sitemap and `robots.txt`. Five plain, fast guide pages are generated into the deploy folder (`/guide/`: record guitar and voice, split a song into stems, chords/tab/lyrics from audio, hum to song, live visuals and show), each with its own title, description, canonical address, one heading, a short FAQ, breadcrumbs and links to the app. `npm run verify:site` checks all of it.
- **Show setup console** (Stage tab, under the picture, or beside it on a wide pane; **🎛 Show setup** in the Visuals bar). Nine tabs, every change visible as it is made:
  **Looks** (six finished looks built differently; save your own looks, up to 24; carry them to another device as a file, checked on the way in) · **Rig** (where the lights stand: truss, floor, towers, wash or none; how many, beam style, spread, floor lights, room, haze, backdrop, laser amount, starburst, brightness, blinder, confetti, motion) · **Colour** (six colours, one-, two- or full-colour treatment, palettes borrowed from another look) · **Cues** (a cue sheet for intro, verse, pre-chorus, chorus, bridge, solo and outro: level, how many lights, haze, floor lights, backdrop, confetti and blinder, which light patterns and which laser patterns, and a silent band to rehearse each cue without a song) · **Response** (how strongly kick, snare, hi-hat, bass, strums and lead notes drive the lights, with live meters and a Fire button for each) · **Pictures** · **Output** · **Scene** · **MIDI**.
- **Output controls** for a room: master level, **blackout** (key <kbd>0</kbd>, eased) and **freeze** (key <kbd>9</kbd>) while the Stage is showing, mirror and flip for rear or ceiling projection, safe-frame guides on the screen, test patterns (bars, grid, ramp, grey, white, black), a 30 or 60 frames-a-second limit, light comfort and a live **flash meter** (flashes per second against the limit of three, the governor, and the highest this session).
- **Nine layouts, each a whole workspace for one job:** Studio, Write, Arrange, Record, Tone, Practice, Show, Focus and Classic. A layout sets where the sidebars are and what is in them, how tall the arrangement is, which panel is open, which tabs are on the strip and which Monitor widgets show, and replaces the last layout completely. The picker shows a small wireframe of each. Your own saved layouts keep all of it.
- **Optional Monitor widgets.** The Monitor opens with the Tuner and Levels. **Analysis**, **Spectrum** and **Views** are chips you add; a ✕ removes a widget. A widget that is not showing is not drawn or updated at all.
- **`test/e2e-workspace.cjs`** (layouts and Monitor widgets) and **`test/e2e-seo.cjs`** (what a crawler sees); `test/e2e-show.cjs` rewritten for the console.

### Changed
- **The six starter shows are replaced by six looks that differ in construction, not just colour:** **Theatre** (warm front light, haze with dust, no strobe, no lasers), **Backlight** (hard beams from the floor behind the band through heavy haze), **Blades** (tall hard-edged bars that follow the spectrum, with a few precise lasers), **Pixel field** (a generative LED wall), **Horizon** (a low sun, rays and a sky) and **Laser room** (haze and lasers, with a different laser kit for each section). The old names still work: a song, a scene or a setting that names Arena, Neon Laser, Campfire, Aurora, Noir Club or Golden Hour gets the nearest new look.
- **The eight default Stage scenes** are Theatre, Backlight, Blades, Pixel field, Horizon, Laser room, Lyric prompter and Me in front. Scenes you never changed are replaced; if you changed even one scene, all of them stay as they were. **Restore starter scenes** (Stage ▸ Show setup ▸ Scene) brings the new ones back.
- **Layouts.** Perform, Pedalboard, Light show, Songwriting, Track study and Compose are replaced by the nine above; **Canvas | Song | Studio** now picks Write (Song) or Record / Arrange (Studio). Saved layouts from earlier versions still open.
- **Monitor views** no longer add a long scroll by default: Views, Spectrum and Analysis start off.
- **Tools ▸ Everything** also brings back any tab a layout had left off the strip.

### Removed
- **The six example songs and the "▶ Example song" buttons** (part 60). The first-page demo song is still there. Nothing in the app now ships with song words other than that one demo.
- The Stage designer drawer (its controls are in the console).

### Honest limits
- The lasers, lights and haze are a simulation on a screen. The app does not drive DMX, ILDA or any lighting hardware; the **MIDI** tab sends notes, clock and controllers only.
- A MIDI note does not trigger blackout yet (keys <kbd>0</kbd> and <kbd>9</kbd> and the buttons do).
- The three-flashes-a-second limit and the governor are engineering safeguards tested against the web accessibility guidelines' definition of a flash. They are not certified, not a medical guarantee and not legal advice.
- Looks files carry the look's settings, not pictures. Pictures stay in the browser they were added in.

## 2.5.0 — 2026-10-27 — Six starter light shows, lasers that play with the band, a stage designer and your own pictures

### Added
- **Six starter shows**, each with its own palette, lights, lasers and motion, and each with an **example song** written for it (original chords, words and lead line, marked "(example)"):
  **Arena** (gold and crimson stadium rock, *Hold the Sky Up*), **Neon Laser** (magenta, cyan and violet synth, *Midnight Grid*), **Campfire** (ember orange, no lasers, no strobe, *Slow River Home*), **Aurora** (green, blue and violet curtains, *Northern Quiet*), **Noir Club** (ice white and steel with one hot pink, *Back Booth*) and **Golden Hour** (honey gold on a dusk-blue sky, *Better Than Yesterday*). They are the first six Stage scenes (keys <kbd>1</kbd>…<kbd>6</kbd>). The Visuals tab chooses one from the song's feel (kit, groove, key, tempo) until you pick one yourself or the song names its show.
- **One musical clock.** Everything on the stage moves with the song's position in bars, not with a timer: beams, sweeps and chases are locked to the bar, so the same moment in a song always looks the same and a four-bar sweep returns to where it started every four bars. **Move in steps that land on the beat** makes the beams step on the grid. Drum hits, bass notes, chords and lead notes arrive from the band on the audio clock, so syncopation shows exactly where it is played. With no song playing, your own notes move the show (an eighth of a bar per note); an idle stage drifts almost imperceptibly instead of looping.
- **Lasers.** Eight patterns (fan, cone, zipper, curtain, lattice, scribble, tunnel, starburst on the drop). Each section calls for a combination, and the combination changes on four-bar phrases (the second phrase of a section drops one pattern, and the last chorus runs a little brighter), so it keeps changing without ever changing at a random moment. Beams swell on real kicks, snares, strums and lead notes. The lasers are drawn on the screen: nothing in the app drives laser hardware.
- **Stage designer** (**🎛 Show design** in the Visuals bar, and a Show design card on Stage): the starter shows with a poster each, six colours (the room, three lights, two lasers), moving lights, haze, brightness, blinder, confetti, floor lights, embers, the LED wall, laser amount and each pattern, how long a sweep takes, stepping on the beat, your pictures and light comfort. Changes are kept as differences from the starter, so **Reset changes** always has somewhere to go back to. It works on the Visuals tab or on the Stage scene you are on, and a change shows on the picture behind the drawer as you make it.
- **Your own pictures.** Add a band photo, a poster, a logo or a venue: as a **backdrop** (several pictures change at each new section), as the **LED wall** (the picture becomes a pixel wall the music plays across) or as a **logo** (lit by the band, six positions, size). They are reduced to 1920 px, stored in this browser's own database and never uploaded. JPEG, PNG, WebP and GIF; SVG is refused. Up to 24 pictures.
- **Light comfort: Calm, Standard, Full show.** Standard is the default; **Calm** is the default when your device asks for reduced motion (and has no strobe, slower movement and softer pulses). Whatever the setting, the show keeps to **no more than three flashes in any second**: the blinder fires at most once a bar and never closer than 340 ms (a second in Calm), every flashing visual obeys the same gap, and a **governor** looks at the finished picture (brightness swings of 7% or more in the whole picture and in each quarter, and saturated red) and pulls every pulse back when it gets near. This is a safeguard built into the app, not a medical guarantee.
- **A lighter picture on a slow machine.** If frames are slow for a few seconds the show drops its laser halos and some moving lights, then comes back by itself once frames are quick again.
- **`test/e2e-show.cjs`** (71 checks): the six designs and the example songs, the auto look, comfort levels, the governor on made-up pictures, events on the audio clock, lasers locked to the bar, laser combinations changing only on phrases, the designer, pictures (reduced, kept in the browser's own database, nothing sent to another site, SVG refused, removed everywhere), the drawer on a phone and scene migration. Its flash test is independent of the governor: it samples the finished picture at 190 BPM with 16th-note funk and counts opposing brightness swings of 10% or more, in the whole picture and each quarter, in all three comfort levels.
- Seven new screenshots (`46`–`52`): the six shows playing their example songs, and the designer.

### Changed
- **The eight default Stage scenes** are now Arena, Neon Laser, Campfire, Aurora, Noir Club, Golden Hour, Lyric prompter and Me in front. Scenes you never touched are replaced; if you changed even one of the old scenes they are all left exactly as they were. **Restore starter shows** (Stage ▸ Show design) brings the new ones back whenever you want them.
- **Reduce flashing is now Light comfort.** If you had turned Reduce flashing off you are on Full show; everyone else is on Standard.
- **Concert's colours belong to the design.** The harmony still moves the colour (each step round the circle of fifths leans the lights towards the design's other colours, and tension pulls towards its third light), but inside the design's own palette instead of round the whole colour wheel. The Teach lens still colours the circle of fifths by hue.
- Prism and Fifths Halo follow Light comfort too: their kick pulses, spin, zoom and flashes are scaled, never closer than the comfort gap, and softer in Calm.
- The lasers' brightness swell on hits is shallower and its depth is scaled by Light comfort and the governor, so they never blink on every sixteenth note.
- The new parts are 56 (colours, designs, comfort, the governor, the band's events), 57 (lasers), 58 (lights, wall, pictures), 59 (the designer, pictures, the Visuals-tab auto look) and 60 (the example songs).

### Honest limits
- The lasers are a simulation on a screen. Real lasers, real strobes and real haze have their own safety rules and need their own controllers.
- The three-flashes-a-second limit and the governor are engineering safeguards, tested here against the web accessibility guidelines' definition of a flash. They are not certified, not a medical guarantee and not legal advice. If lights or motion bother you, choose Calm or stop the show.
- Pictures are not part of a song's `.zip` and not in a backup; clearing the site's data removes them.
- The example songs' words are original; a web check of each chorus line (27 October 2026) found nothing, which is a sanity check and not a clearance.

## 2.4.0 — 2026-10-26 — Concert visuals, and a first page that says what it is for

### Added
- **Concert.** A new visual, and the new default: a lighting rig that listens, built like a touring show instead of a screen saver.
  - **Colour is the harmony.** The home chord has one colour (warm for a major key, deep violet for a minor one) and every step round the circle of fifths moves the hue by 30°, so a modulation is a colour change you can see. The gradient stage, haze, floor glow and LED wall all follow it.
  - **Mood you can see.** Energy (how loud, how dense, where the section is heading), valence (major bright, minor sad), tension (diminished, augmented and dominant chords, and distance from home) and brightness (timbre) set saturation, speed, how many beams are lit, haze and glow. They are smoothed, so it moves like a person reading the room instead of a meter.
  - **Lights on the band's real drum hits.** The kick pumps the floor lights, the snare flicks alternate fixtures and fires the blinder, every hat steps the chase and toms jump it. The hits are scheduled on the audio clock, so the syncopation of the groove (ghost notes, off-beat hats) is exactly what you see. Without the band, your own playing drives it.
  - **A cue list written from the song.** Intro haze, verse low, a build in the last bars before a chorus, a drop on the chorus (flash, beams wide, confetti), a cool sparse bridge, tight spots for a solo. Section names are read, so a section called "Hook" or "Pre-Chorus" does the right thing.
  - **Reduce flashing** (a checkbox on the Stage pane, on by default) keeps the strobe to at most about 3 flashes a second and softens it to a wash.
- **Three lenses** on the same show, in the Visuals bar and in Stage ▸ Performer backdrop:
  - **Perform**: big and calm, for an audience.
  - **Teach**: the circle of fifths as a lit floor ring with your key's notes, the chord that is playing, the path to the next one, a card with **roman numerals** for what is playing and the next four chords, one line on why the next chord pulls the way it does ("Dominant → home: the strongest resolution"), the key and tempo, and energy, mood and tension meters.
  - **Sky**: every chord you play becomes a star, every move a line, and lines that repeat glow brighter. **⤓ Save sky** saves the session as a 1800 × 1200 PNG poster; **New sky** starts again.
  - Teach and Sky draw in the room the lower third leaves them, so the chord card, the ring and the lyric line never sit on top of each other.
- **Monitor ▸ Views.** The pitch wheel, spectrogram and scope, for looking at your sound rather than projecting it, now live on the Monitor tab under the tuner. They are still Stage scenes.
- **A first page that says what it is for.** The start card now reads **Record it. Split it. Write it down.** and shows, in this order: **Record guitar + mic**, **Split any song** and **Chords, tab and lyrics**; then **Begin in the studio** and, for first-timers, **Try the demo song** (a finished song, no microphone or camera needed); then **Presets and effects** and **Neural graph and visuals**. The camera is an optional line at the bottom, a small text link that says it stays off unless you choose it. The page title, the search and link-preview descriptions, the guided tour and the README say the same thing.
- **A one-time question before anything leaves the page.** Hand tracking and the **Me in front** look (which the stage route chooses by default) used to fetch MediaPipe from jsDelivr and Google as soon as the camera started. They now ask first ("One-time download": the two hosts, what they see, about 10 MB, and that the camera picture is never sent). **Download and turn it on** is remembered; **Not now, stay offline** uses the edges-in look or motion mode and does not ask again until the feature is chosen again. **Help ▸ About ▸ Credits ▸ Ask me again** takes a yes back.
- **Privacy at a glance** in Help ▸ About, and a full statement at `/legal/` on the site together with the licence, the third-party notices and both font licences (the font licence asks that its text travel with the fonts).
- **`docs/LICENSING.md`**, a register of every file the site serves, font, dependency, model and downloadable output, with its source and licence and a short list of what only the owner can confirm. **`npm run audit`** checks it against the real build (and runs at the end of `npm run verify:site`, so the deploy carries it): no runtime dependencies, permissive licences only, every shipped file registered, no audio or binary hidden in a page, a licence for every font and sample, every host and network call site known, no over-claiming wording.
- **`test/e2e-privacy.cjs`**, a real-browser count of every request: a whole session makes none to another site, sets no cookie and stores only under the app's own names. Run it against the live site after a deploy.
- Short notices where material comes in or goes out: the Stems panel, the lyric importer, the Export panel and the share page's footer, and a "Your music" line in About. Stems, chords and tab are described as derived from the loaded file.

### Changed
- **Concert is the default visual** and the first scene on the Stage. If you have already chosen a visual it is kept; pick Concert in the Visuals bar.
- **Hex Tunnel is retired.** A saved Tunnel look (the Visuals choice or a Stage scene) opens as Concert; scenes you made yourself, and each scene's section link, are left alone. The new Resonance scene takes its place in the default scene list.
- The pitch wheel, spectrogram and oscilloscope left the Visuals bar (see Monitor ▸ Views).
- The performer backdrop's lower third now reports where it sits, so the lenses can keep clear of it.
- The About text, `PRIVACY.md` and the notices no longer say the models are "Apache-2.0" as if checked: the MediaPipe code is, the hand model's card is reported as Apache-2.0, and Google states no separate licence for the selfie segmenter. The project hosts neither file. `PRIVACY.md` now has a table of what is processed, sent and kept, and says the stage route asks before it downloads.

### Fixed
- The chord strum no longer throws when it is given a rest ('.') or an empty bar.
- A broken link in the README (self-hosting the camera files) and a stale note in the security model about the segmenter URL.
- On the full-screen stage, notices (including the one-time download question) sit under the top bar instead of over the start panel.
- The camera picture keeps running in motion mode while the one-time download question waits for an answer.

### Not built
- A performer cut-out (the person lifted out of the camera picture and placed in the show).
- Dragging a clip onto a different lane.
- Lyrics are not read from audio. The lyric sheet is yours to type, paste or drop in (.txt, .md, .lrc); chords and tab are what the app extracts from sound.

## 2.3.0 — 2026-10-26 — Voice, editing, heatmap and performer backdrop

### Added
- **Voice.** A **〰 Voice** chip in the song bar (and a tile on a phone) opens the Voice window. **Pitch ribbon**: the note you are singing, drawn against the notes of the song's key, green within 20 cents of one, yellow within 35, red beyond; bright rows are the chord that is playing. **Find my range**: sing from your lowest note to your highest once and it is kept on this device. **Find my key**: it compares your range with the song's melody and offers the keys that fit, and **Move the song to …** moves the key, the chords, the `[chords]` in the lyrics and the tab in one undo step (recorded takes stay as they were). The ribbon can also sit over the Visuals (**Pitch** button).
- **Cut a stretch out of a recording.** Shift-drag across a take lane (or **[ In** / **Out ]** at the playhead, which works with a finger) to mark a stretch. **Cut out** (<kbd>Del</kbd>) takes it out and closes the gap; **Silence** takes it out and leaves the gap; **Punch in** plays from a bar before it and records only inside it, then drops the new audio into the same lane. **All lanes** (on by default) edits a guitar and a vocal recorded together as one, so they stay in step. Every cut gets an 8 ms fade so it never clicks. One undo step each.
- **Clip level.** A level for one clip, separate from the lane's level, in the clip bar and the clip menu.
- **Fretboard heatmap.** Fretboard ▸ the third menu ▸ **Heatmap**. **Where you play** (time on each string and fret), **How in tune** (average cents at each position: blue flat, green within 7 cents, orange sharp) and **Which notes belong** (key and chord tones lit, notes outside the key in red, with the share of your playing that is inside the key). Source is **Live** (the microphone, kept for the session and across reloads) or **Song** (the tab and chord shapes). A microphone hears the pitch, not the string, so live time is placed exactly only when the camera sees your hand or the note has one possible place; otherwise it is shared across every place the note can be played, and the summary says how much was shared. **Reset heatmap** clears it; a new tuning or capo starts a fresh one.
- **Performer backdrop.** Stage ▸ **Performer backdrop**: the visuals calmer and dimmer (long trails, no flashing, softer glow), easing to a new colour on each section and a little brighter when you play loud; a **lower third** with the chord and the next one, the section, and the lyric line and the one after; and a background of **the visuals**, **plain black** or **chroma-key green**. **Clean output window** opens a bare window (just the picture, a hidden pointer, and the same background colour) to drag to a projector or capture in OBS.

### Changed
- A plain click on a lane clears a marked stretch; <kbd>Del</kbd> and <kbd>Esc</kbd> work while the clip bar has focus. The Help text for recording was updated for the 2.2.1 behaviour.

### Not built
- Dragging a clip onto a different lane.

## 2.2.1 — 2026-10-26 — One press, one take

### Fixed
- **Recording a short song made a pile of takes.** With **Loop** on (the default) and a short song, recording ended and restarted at the end of every pass, so a few seconds of singing over a 4-bar song produced Take 1, Take 2, Take 3… and a Vocal take for each. Now one press of **R** is one take: recording keeps going past the end of the song until you press **R** or **Stop**, the song grows a bar at a time so the click and the band carry on, and the spare bar is taken back at the end. With Loop off the song also grows now (before, the take ran on in silence after the click had stopped).
- **A silent second input is not kept.** With both the Guitar and Vocal lanes armed and a microphone on only one input, the other lane used to record an empty take. If one lane is below −60 dBFS while the other is above −30 dBFS, only the played one is kept and a message says so.

### Changed
- **A loop region you set is cycle recording.** **Loop 4 bars here** (or Shift-drag across the ruler) records a new take on every pass of that region, as before. The whole-song Loop no longer does.
- **Settings ▸ Recording & practice ▸ When recording reaches the end of the song**: *Keep going (the song grows to fit)* (default), *Stop at the end*, or *Loop back, one take per pass* (the old behaviour).

## 2.2.0 — 2026-10-26 — Clips, Fast Render and MIDI

The follow-up to I/O and Lanes: every gap that release left open, plus the polish that the new features needed. Everything still runs on your device.

### Added
- **Editable takes (clips).** A recording is now a clip you can shape. Click it to select it (the **clip bar** under the arrangement names it); **drag** it to move it (it snaps to the beat; hold <kbd>Alt</kbd> for no snapping); drag an **edge** to trim; drag the **corner squares** for a fade in or out. **✂ Split** cuts at the playhead (<kbd>Ctrl/⌘</kbd>+<kbd>E</kbd>), **⧉ Duplicate** (<kbd>Ctrl/⌘</kbd>+<kbd>D</kbd>) places a copy right after, <kbd>Del</kbd> removes, and ← → nudge by a beat (<kbd>Shift</kbd>: a bar). Right-click a clip (or the **⋯** in the bar) for fades, nudge, **Reset trim**, **Save clip (WAV)** and **Delete clip**. A split shares one recording in memory, a lane keeps one level, pan, mute and effects strip however many clips it holds, and clips are saved with the song, in bundles and in backups.
- **WAVs render faster than the song plays.** **Bounce master WAV** and **Bounce this part** now build the same engine a second time offline and mix the song as fast as your processor allows (on a small two-core test server it ran about 3× faster than real time; your device will differ). Same strips, effects, master tone and limiter as you hear; a progress window with **Cancel**; the kill switch (<kbd>Ctrl/⌘</kbd>+<kbd>.</kbd>) stops it. If the browser cannot do it, the app says so and bounces in real time as before. Compressed audio and the share page still record while the song plays, and say so. Settings ▸ Export ▸ **Render WAVs faster than real time** turns it off.
- **MIDI import.** Drop a `.mid`, `.midi` or `.kar` file on the page (or choose one in **＋ New ▸ Start from a song**). A window lists the tracks with their note counts and range, picks the melody for you, ticks the others to decide the chords, and shows the file's tempo and time signature. **Create song** makes a new song: tempo and time signature from the file, key worked out from the notes, chords per half bar, the melody on the lead tab, karaoke words under the chords, and a band style. A melody-only file gets chords worked out from the notes. Drum tracks are not copied (the band plays its own pattern). Files with SMPTE time, no notes, or more than 8 MB / 300,000 notes / 128 tracks are explained instead of opened.
- **Keep my songs safe.** Safari on an iPhone, iPad or Mac clears a site's storage after about a week away unless the site is added to the Home Screen or Dock. The app now says so, in plain steps: **⋯ More ▸ Keep songs safe** (and a card at the top of **My songs**) explains **Add to Home Screen** and has one **Back up all songs** button; a one-time tip appears after your first recording in Safari on an iPhone or iPad; and the backup reminder comes after 7 days (not 30) where the risk is high. Nothing is sent anywhere; the backup is one zip you keep.
- **One history for everything.** <kbd>Ctrl/⌘</kbd>+<kbd>Z</kbd> and ↶ ↷ now step through song edits, clip edits (move, trim, fade, split, duplicate, delete) and the stem mix together, in the order you made them. **Auto-balance** is one step.
- **The stem mix is saved.** Stem faders, mutes, solos and effects are kept with the song, in bundles and in the backup, and come back when you reopen it.
- **Phone: Open a file, Master · balance · click, My songs.** Four new tiles in **⋯ More**: **My songs**, **Open a file** (audio, lyrics, MIDI or a song file), **Master · balance · click** (master preset, Auto-balance, count-in and click level), and **Keep songs safe**.
- **Help and tour.** The guided tour has a new stop, **Drop things in, edit them as clips**, and mentions faster WAVs, backups and Open a file. **Help & shortcuts** lists the clip keys and the drop targets.
- **Hardware checklist.** [docs/HARDWARE_CHECKLIST.md](docs/HARDWARE_CHECKLIST.md): about 45 minutes with your own interface, microphone, camera, MIDI keyboard and phone, for the things an automated test with a fake microphone cannot tell you.

### Changed
- **The test suite is now parallel and isolated.** The one long script is split into independent files (`e2e.cjs` core flows, `e2e-io`, `e2e-drop`, `e2e-balance`, `e2e-lanes`, `e2e-camera`, `e2e-clips`, `e2e-session`, `e2e-render`, `e2e-midi`, `e2e-keep`, `e2e-layout` and `mobile`), each with its own server, browser and context, run together by `npm run test:e2e`. The fake-camera check polls instead of sleeping. `npm run shots` regenerates the pictures in the documentation.
- **Header and song bar at laptop and desktop widths.** Below 1660 px the Loop and Click buttons and the master label drop their words and the time display tightens; below 1520 px the latency chip hides (it is still in I/O); the song bar's field labels hide below 1900 px and its boxes shrink a little below 1660 px. From 1440 px up, the BPM, signature, key and mode boxes show their whole value and the Canvas | Song | Studio switch is never cut off.
- **Re-amp** reads **RE** on a phone, so the lane header stays on one row.
- **The New song window** accepts a MIDI file (choose or drop), and its song card says so. **Back up all songs** is one button in the My songs card (the footer copy is gone).
- **Help & shortcuts** describes the shared history, Back up all songs and Add to Home Screen.

### Fixed
- **“null” in lane headers.** A lane header could print the word *null* after the name (the vocal take lane, the power and effects chips). Fixed, and a layout test scans for it.
- **Phone vocal lane header was cramped.** The input selector overlapped the name, **RE-AMP** wrapped, and the clip bar was clipped. The selector now lives in I/O only, the clip bar has a row of its own, and every header is checked to fit its column.
- **Time display clipped at about 1280 px.** The position and time readouts kept their width and no longer lose a digit.
- **The MIDI window on a phone** no longer runs its column titles together (the range column is dropped on narrow screens).
- **Test flakiness.** Drawer animations on busy machines (waits are now for the state, not for a fixed time), the fake-camera pixel comparison and a service-worker unregister that could hang the old script.

### Notes
- Still not in the app: pitch correction, a groove picker, hosted loop libraries, accounts and collaboration. Dragging a clip onto a different lane is not built yet (clips stay on their lane).
- Fast render needs `OfflineAudioContext` with AudioWorklet support, which every current browser has.

## 2.1.0 — 2026-10-26 — I/O and Lanes

### Added
- **One Connect card for your input.** I/O ▸ **Audio input** is now one card: pick the interface, press **Connect**, and the card shows the live level with **Set my level** and **Hear myself**. The same card opens from the header Audio button, the full-screen stage and Perform. Nothing asks the browser for the microphone until you press **Connect**.
- **Set my level.** A guided check: play or sing as loud as you will, and the **Input trim** is set so your peaks land near −9 dBFS (−10 for voice), with an Undo. It says plainly when the interface gain itself is too low or too hot.
- **Signal path strip.** Input → Trim → Rig → Master → Out as four live bars with the loudest point named, a one-sentence verdict ("Peaks are hot — turn the interface gain down"), and a **Test sound** for the output. A small level bar lives on the header Audio button, so you can see the input without opening anything.
- **Channels that follow your interface.** A one-input microphone shows one row; a two-input interface offers *Guitar*, *Guitar + voice*, *Swap* and *Voice* in one tap. If the interface sends one channel only, it says so.
- **New-interface prompt.** Plug in an interface while the app is open and a small prompt offers to use it, with **Set my level** one tap away. Unplug and the app says the input is gone and how to reconnect.
- **Permission help that knows your browser.** If the microphone is blocked, not found, busy or unplugged, the card names the exact steps for your browser and system (Chrome, Edge, Firefox, Safari, iPhone and iPad, Mac, Windows) instead of a generic error.
- **Per-lane mixer strip.** Every band lane, vocal lane, take, stem and the whole backing track has a header with **M**, **S**, volume, pan and **+Fx**. **+Fx** opens a small strip: three-band EQ, compressor, reverb send and delay send, with quick looks (Flat, Warm, Bright, Punch, Room, Hall, Echo). Settings are saved with the song and with each take. Click a lane header to select it; the lane is tinted in the arrangement.
- **Drop anywhere.** Drag audio, lyrics (.txt, .md, .lrc), a song file (.zip), a song or rig .json onto the page. Lyrics, song files and rigs go straight to their importers. Audio asks what it is: **Backing track** (stems, tempo, key), **Vocal take**, **Guitar take** or **Hum → new song**; several files at once become takes. Your last choice is highlighted. A dashed **Drop audio, lyrics or a song file** row sits under an empty arrangement, with **Choose a file…** and **Voice memo**. Nothing is uploaded, and a drop is politely declined while a window is open.
- **Auto-balance.** **⚖ Auto-balance** (Lanes ▾, and the master menu) measures your takes and backing track with the same loudness meter the exporter uses and shows a plan first: vocal near −16 LUFS, guitar near −19, backing track near −21, guitar takes spread left and right when there are two or more, and the band parts back at their reference balance. **Apply**, then **Undo** if you prefer it as it was. A restore point is saved first.
- **Master chip.** The header shows the master level and a preset menu (**Off**, **Clean**, **Warm**, **Bright**, **Loud**: tone, glue and the loudness target used when you save audio), with a clip light. It is the same control as the Master knob in the Rig tab.
- **Visible undo and redo, and a Saved indicator.** ↶ ↷ buttons in the song bar (greyed when there is nothing to undo) and a quiet "✓ Saved" that reads "Saving…" for a moment after you change something, and "Not saved" if the browser refuses to store your work.
- **Count-in menu.** The ▾ beside Click chooses the count-in (none, 1, 2 or 4 bars) and the click volume.

### Changed
- **Take faders reach +12 dB.** Take volume is now a squared fader (finer near unity, up to four times the recorded level) so a quiet recording can be brought up to match the rest.
- **Lane headers are wider** (216 px by default; double-click the divider to reset) to fit the new strip. Lanes ▾ no longer shows a per-lane ⤓; use the lane ⋯ menu.
- **Laptop-width header.** Below 1440 px the Loop and Click buttons drop their words, below 1340 px the master chip shortens, and below 1240 px the latency chip hides (it is still in I/O), so the header fits from 1100 px up.
- **I/O ▸ Advanced** now holds the latency lab, diagnostics, MIDI details and the rarely used controls, closed by default.

### Fixed
- **Reset could stall on a stuck service worker.** Reset ▸ Everything waited without limit for the browser to confirm that the offline copy was removed. Each of those steps now gives up after a moment and the app restarts regardless.

### Notes
- Not in this release: pitch correction, a groove picker, hosted loop libraries, accounts and collaboration. Everything here runs on your device.

## 2.0.0 — 2026-10-26 — Perform and Share

### Added
- **Perform.** **🎤 Perform** (the song bar, and on the full-screen stage) opens one full-screen view for a run-through or a take: a readiness check first (audio, input and its level, camera, lyrics, count-in), then the chord huge, the next chord, the lyrics scrolling with the song, a big count-in, and Play, Record, Loop, Click and tempo within reach. Show the stage visuals behind it or keep a plain dark page. Space, R, L, M and Esc work; Ctrl/Cmd + . still stops everything.
- **Voice memo.** On the clean canvas, **🎤 Voice memo** records your voice as it is: one Vocal take at the start of the page, no analysis and no band, and the page grows enough bars to play all of it (up to 10 minutes).
- **Loudness meter and target.** Song WAV bounces report integrated loudness (LUFS, ITU-R BS.1770 with gating) and true peak. Settings ▸ Export can bring a bounce to −14, −16 or −23 LUFS, never past −1 dBTP.
- **Compressed audio.** **⤓ Compressed audio** saves the whole song as M4A (or Opus in a .webm where the browser cannot make M4A). It plays once in real time.
- **Share page.** **🔗 Share page** saves one HTML file with the song's sound, lyrics, chords and a small player with a moving ring. Open it in any browser or send it; it loads nothing from anywhere.
- **Print or PDF sheet.** **🖨 Print or PDF sheet** makes a clean lyric and chord sheet (chords over the words) for the browser's Print or Save as PDF.
- **Backup folder.** In Chrome and Edge, Settings ▸ Export ▸ **Backup folder** saves each song to a folder you pick (a cloud-drive folder works) as a .daily-song.zip after you change it. No account; the browser writes the files directly.
- **Auto look.** **🎬 Auto look** in the Visuals bar makes the look follow the section while the song plays: Fifths Halo in choruses, Prism in bridges, Tunnel in intros and outros. Your own look returns when it stops.
- **⏺ Record the stage.** A video of the Visuals (hexagons, Halo, you in front when the camera is on) with the song's sound, saved to your device as .webm or .mp4. **⏺ Record** is in the Visuals bar and on the full-screen stage: record now, or the whole song from the top. Nothing is uploaded, recording never starts the camera, and Ctrl/Cmd + . stops it and throws it away.
- **Two routes: the studio, or the stage.** The start card asks first: **● Begin in the studio** (the default) opens a clean canvas with the cursor in the lyrics and a slim bar to sing or hum, play guitar or load a song, with no camera and no full screen; **🎥 Begin on stage** goes full screen with your camera and the visuals. The camera is requested only on the stage route. Switch any time with **🎥 Go on stage** in the Visuals bar or **Start in** in Settings and I/O ▸ Camera; the route you used last is remembered.

### Fixed
- **Reset ▸ Everything test race.** The end-to-end test could act on the old page while a reset was still finishing. It now waits for the new page.

## 1.7.0 — 2026-10-24 — MVP 1, first production release

### Changed
- **New songs start with the band off.** A blank song (the empty page made for Hum or sing, Clean canvas, or a blank page) no longer plays a drum, bass and rhythm band over what you record or write. Hum to Song still builds and plays a band for the song it makes, and its panel has a **Band on/off** button (your melody keeps playing). The first time you press Play on chords with the band off, a toast says where to turn it on.
- **Phone: Tracks has its own view.** **⤢ Tracks** gives the arrangement the whole work area instead of sharing it with the open panel; **▾ Panel** goes back.
- **No bundled sample track.** "Good Morning" and its licence file are gone from the app, the About credits and the notices. The `samples/` mechanism stays for anything you add.

### Added
- **One Channels card for the inputs.** I/O ▸ **Channels** replaces the separate guitar-channel buttons and the Guitar + vocal buttons: each interface input is **Guitar** (through the rig), **Vocal** (through the vocal strip) or **Off**, with a live level meter per input. **Detect & visualise** chooses what the note detector, tuner, chord finder, onset pulses, neck and visuals follow: Guitar, Vocal or Both. Singing live with it set to Vocal shows your note on the neck and sends pink notes into the Fifths Halo. The visuals Source menu gains **vocal microphone**.
- **Fifths Halo (new look).** The circle of fifths from the Neural map as a tilted ring around you: with the camera cut-out you stand in the middle, the back of the ring passes behind you and the front in front. Pitch classes glow as they sound, the song's chords sit on the ring (major outside, minor inside, extended chords float), arcs show the progression, the next chord is ringed, and every note spirals in toward you. The ring kicks on the beat.
- **Prism (new look).** A feedback kaleidoscope: the fold count, hue and spin change on the off-beat ("the and") when the song plays, or on your own onsets when you play live; the downbeat only breathes. Notes land in the wedge by their place on the circle of fifths. Flash and spin are limited while Stage ▸ safe is on.
- **✦ Look** in full-screen cycles Hex Resonance, Fifths Halo, Prism and Tunnel.
- **The neck is wired to everything.** A small neck (**🎸 Neck**) on the Visuals and the Neural map, and the Fretboard pane, now show: what is playing, a dashed **ghost** of the next lead note (and the next chord) before it arrives, the note you are **singing** while you hum (and when you hear it back) at every place it can be played, and a chord you **click in the Neural map** (it is strummed too).
- **Save any track.** Every recording, stem and band part has a **⤓** on its lane that saves it as a WAV on your device (the band parts play the song once in real time with only that part on). The hum panel has **⤓ Save** for the whole song, **My hum**, each band part, or MIDI. Export gains **Each band part (WAVs)**. Nothing is uploaded.
- **Visuals follow playback.** The Visuals source is now **Auto**: the mix while the song, your hum or a backing track plays, your guitar rig otherwise (before, the hexes only moved for live input). The fretboard lights the exact string and fret of each lead note and chord tone as the playhead reaches it, the beat pulses the hexes, and the Chroma Wheel and its chord name follow the song.
- **Your hum is in the arrangement.** Hum to Song now adds the recording itself as a **My hum** Vocal take, lined up so its first note lands on the first melody note of Verse 1. Band, lead tab and voice play together; re-arranging replaces it, and **🎤 My hum** turns it on or off.
- **About rewritten** as a personal note: "Made for creators." (a short note about curiosity, a guitar and a little spark) The credits, links and (optional) support button stay below it.
- **One front door, no repeats.** Every start button now lands on the same place: the stage with one panel. **Hum or sing** and **I have a guitar** are the two big choices; a quiet row below offers **a song file**, **a blank page** and **the demo song**. The separate welcome dialog, the extra "more ways to start" hop and the long feature grid are gone from the first run (the New song dialog in the studio stays). Choosing something other than humming removes the empty placeholder page instead of leaving it in My songs.
- **Camera backdrop by default.** **● Begin** and **Start and connect my input** switch on the camera backdrop on Hex Resonance, "me in front". **Start with camera and mic off** never does. Turning the camera off (on the stage, or in I/O) is remembered.
- **I/O is the first left tab**, with a new **Camera** card (device and backdrop button) beside the audio input and output, so sound and picture are enabled in one place. These choices are saved on your device.
- **Stage bar:** **＋ New song** (reopens the start panel, reusing an untouched page) and **⚙ Inputs** (takes you to I/O) join Stop audio, full screen and Studio.
- **A shorter welcome:** four one-line features (stem splitting, guitar + microphone, tab maker, neural graph and visuals). The CodePen, Focusrite and phone tips moved out of the welcome card; the Focusrite notes remain in I/O and docs/AUDIO.md.
- **Support link (optional).** Set `BRAND.support` in `src/parts/01-core.js` to a Ko-fi / Buy Me a Coffee / GitHub Sponsors page and About shows a "Buy me a coffee" button. It is a plain link; no scripts, cookies or tracking, and nothing shows while it is empty.
- **A first screen that starts the show.** The welcome screen is a dark, living hexagon field with one button, **● Begin**. Begin opens a **full-screen center stage** (your camera behind and in front of the reacting hexagons) with two big choices: **● Hum or sing** and **🎸 I have a guitar**. A small bar keeps **■ Stop audio**, **full screen** and **✕ Studio** in reach, and the hexagons shimmer even when it is quiet. Nothing asks for the camera or microphone until you press a button.
- **Guitar coach for complete beginners.** *I have a guitar* tunes each of the six strings (live meter, ±10 cents), then teaches the four chords of your song (or a friendly starter, G Em C D) one at a time with a finger diagram and "I hear…" feedback, then plays you along with the band.
- **The studio adapts to you, silently.** A quiet experience score (opening a Studio view, editing, recording, connecting an input) decides how many tabs you see and what they are called: new visitors get four plain tabs (Stage, Song, Band, Save & export); more appear as you use them. **Tools** on the tab row overrides it (Automatic, Simple, More tools, Everything). Existing users keep everything.
- **Hum to Song.** Hum or sing a few seconds (or choose a voice memo) and get a full song: a pitch tracker finds your notes, tempo and key (it also corrects a flat or sharp hum), chords are chosen to fit the melody, and the app builds intro, verses, choruses, bridge and outro with your melody as the lead guitar and a band in one of five styles. Change style, tempo, key, shape or chords and it re-builds instantly. Everything runs on the device.
- **Center stage.** The camera backdrop is one tap, "me in front" (green screen) by default, and is on by default in the Hum flow. The studio now opens on the Visuals tab and then remembers your last tab.
- **A beginner's front door.** The welcome card and first screen now lead with "Hum a melody. Get a song." and three plain steps; the technical feature list is tucked into a "What is inside" fold.
- **Audio control and kill switch.** Nothing asks for the microphone until you choose it: the start screen offers “Start · microphone stays off” first. A header **Audio** button (with a status light) opens the audio panel: start the engine, pick and connect an input, turn monitoring on, or stop everything. **Ctrl/Cmd + .** kills audio at any time (stops playback and recording, turns monitoring off, releases the microphone, suspends the engine). Monitoring is off by default; “reconnect my last input on open” is opt-in. Saved settings are kept.
- **About & credits** in Help & shortcuts: a short intro, "About me" with links to GitHub and LinkedIn, The Daily, the source repository, and a collapsible list of credits and licences.
- **THIRD_PARTY_NOTICES.md**, **PRIVACY.md**, **CODE_OF_CONDUCT.md** and **samples/LICENSE.md** (the bundled sample track is not MIT-licensed).
- **Content-Security-Policy** built into the page (script allowed by hash; only optional hand tracking can reach other hosts).
- Social preview card, `robots.txt`, `sitemap.xml`, a friendly `404.html`, richer link-preview metadata.
- **Your songs are safer:** the app asks the browser to keep storage persistent, and gently reminds you to back up if it has been a while.
- A small error guard: unexpected errors show one calm message instead of failing silently.
- **Camera look for the visuals.** Beside “Camera backdrop” (Visuals tab and Stage) choose how the camera sits with the visuals: *Dimmed behind the visuals* (as before), *Visuals frame me (edges in)* (you stay clear in a soft oval, the visuals grow around the edges, with a size slider) or *Me in front (green screen)*, a real person cut-out so the visuals play behind you. The cut-out uses MediaPipe's selfie segmenter, downloaded only when chosen; if it cannot load the app falls back to edges-in.
- About: a closing line about hoping the app inspires new music and personal discovery.
- **The Daily now lives at `/journal/`** on the same site (vendored from github.com/TehauD/daily; refresh with `scripts/sync-journal.mjs`). The studio's service worker and reset leave it alone, and the About link points to it.
- docs/RELEASE.md, a go-live checklist.

### Security and release hardening
- **Deploy gate.** `npm run build:site` now also writes a `_headers` file: the page's CSP as a header plus `frame-ancestors 'none'`, `X-Frame-Options: DENY`, HSTS, COOP, `nosniff`, no-referrer, a tight Permissions-Policy and cache rules. `npm run verify:site` fails the build if files are missing, the CSP hash is stale, framing is allowed, or any third-party host other than jsDelivr and Google storage appears. CI runs it.
- **Cloudflare only.** The GitHub Pages workflow and `CNAME` were removed; hosting docs now describe Cloudflare Workers.
- **Escaping.** Neural-map details panel escapes song data (section names, chord labels) before inserting it as HTML; a shared `esc()` helper and test were added.
- **Tests.** The kill-switch test now confirms every microphone track ends.
- **Docs.** New: docs index, OPERATIONS runbook, SECURITY_MODEL, TESTING, AUDIO. HOSTING, RELEASE, PRIVACY and SECURITY updated.

### Brand
- **New mark:** a hexagon drawn as a cube, with T, D and S on its faces and a small waveform standing on its foot, mirrored around the stem. It is used in the header, start card, About, favicon, app icon (including maskable), social card and README, all from one drawing (`scripts/brand-mark.mjs`; regenerate with `scripts/make-brand.mjs`). In the app the mark follows your accent colour.
- **New default palettes:** *Daily Light* (paper, charcoal, deep sage) and *Daily Night* (charcoal, sage, gold), with a matching gold secondary colour for charts. Every existing palette, accent, density, corner, surface, contrast and colour-blind option still works; the old teal Porcelain and Ink palettes are still in the list. A new look, **the-daily.studio**, applies the pair in one click.
- **Type:** Inter (text) and Montserrat (headings) are now built into the page (SIL OFL, about 90 kB), so the app looks the same on every device. The old system-font choice is now "System UI".
- **Tagline:** "Write. Play. Create."
- docs/BRAND.md and a brand sheet (docs/brand/brand-sheet.png).

### Changed
- README, hosting and security notes describe the finished product; documentation screenshots show the current look.
- Palette contrast: Paper's muted text and every accent are fitted to meet WCAG AA against their surfaces.

### Fixed
- Accessibility (WCAG A/AA, checked with axe on the palettes, including the two new defaults): labels on selects and zoom controls, keyboard access to scrolling timeline and chain regions, side-tab roles.

## 1.6.0 — 2026-10-24

### Added
- **Appearance drawer** (the ◐ button, Settings ▸ Customize appearance…, or More ▸ Appearance on a phone). It opens beside the app so you watch it change as you choose, and everything is saved on the device.
  - **Mode:** Light, Dark or Match system.
  - **15 palettes:** Porcelain, Paper, Sage, Lilac, Harbor, Blush and Daylight HC (light); Ink, Midnight, Graphite, Plum, Forest, Ember, OLED black and Night HC (dark).
  - **Accent:** eleven colours, the palette's own, or any colour you pick; custom colours are adjusted automatically so text and controls stay readable.
  - **Feel:** density (Compact, Cosy, Roomy), corners (Sharp, Soft, Round), surfaces (Flat, Soft, Raised) and text size.
  - **Type and accessibility:** typeface (System, Humanist, Rounded, Editorial serif, High legibility, Instrument mono; these use fonts already on the device), high contrast, colour-blind-safe data colours (Okabe–Ito) for charts, meters, visuals and status lights, and reduce motion.
  - **Seven one-click looks:** Clinical, Studio night, Notebook, Calm, Midnight, Stage and Accessible.
- The app follows the system light / dark setting by default for new installs; the browser's own controls and scrollbars follow the chosen mode.

### Changed
- Accent choice moved from a short list in Settings to the drawer. Older saved accents (Cobalt, Coral, Violet, Amber) carry over; the old default "Lagoon teal" is now "Palette default".

## 1.5.1 — 2026-10-24

### Fixed
- **Local launch.** `npm start` returned "Not found" for the start page on Windows (path separators); fixed. It now opens your browser, moves to the next free port if 8080 is busy, and refuses paths outside the project.
- **Stale copies.** The offline cache served the previous version of the page first after an update; the page is now fetched from the network first and the cache is only the offline fallback.

## 1.5.0 — 2026-10-24

### Changed
- **One name everywhere: `the-daily.studio`.** The header, welcome card, guided tours, share / install text, page title, manifest, exported file names (`the-daily.studio-rig.json`, `the-daily.studio_session_….csv`), file format identifiers, docs, issue templates, repository URLs and the package name all use exactly that string. Older project and session files still import.
- **Instrument skin.** A calmer, more clinical look: a cool porcelain light theme and a deep ink-teal dark theme; flat controls with hairline borders and one accent; sharper focus rings; thinner sliders; custom select arrows; tabular numerals for readouts; glass toasts with a colour edge instead of solid blocks; softer dialogs with a blurred backdrop; a two-by-two welcome card. The wordmark is set in lowercase with an accent-coloured `.studio`.
- **New accent: Cobalt** (Settings ▸ Appearance), alongside Lagoon teal, Coral, Violet and Amber.

## 1.4.0 — 2026-10-24

### Added
- **the-daily.studio.** The app is now the-daily.studio, a songwriter's workspace and a sibling of The Daily developer journal. Still one static page: no accounts, no backend, nothing uploaded. A `CNAME` file for GitHub Pages ships in the repository.
- **My songs.** Every song is kept in this browser (IndexedDB) with its lyrics, chords, tab, section map, recorded takes and backing track. **☰ Songs** in the song bar (or Settings ▸ Data ▸ My songs) lists them with Open, Rename, Duplicate, Bundle and a two-click Delete, and shows how much space they use. Work is saved automatically; a song comes back exactly as you left it, takes included. A backing track is re-separated into stems on open (automatically on desktop, on a tap on phones; Settings ▸ Data ▸ Restore track).
- **Two ways to begin.** **＋ New** (and the first-run card) offers **Clean canvas** (a blank page for a new song, with an optional title, tempo, key, time signature and tuning) or **Start from a song** (load or drop an audio file, or pick a sample; it is split into stems and the title, tempo, key and chords fill the song in).
- **Song bundles.** A song exports as a `.daily-song.zip`: `song.md` (readable lyrics with chords), `arrangement.json` and `audio/` (takes as WAV, the backing track as it was loaded). **Back up all songs** makes one zip with a folder per song. Import accepts bundles, lyric files (.txt, .md, .lrc) and older `.daily-song.json` files. Bundles are plain files, ready for a Git repository.
- **Three zoom levels** on the same song: **Canvas** (just the lyric and chord page, full width), **Song** (the Songwriting layout) and **Studio** (the full arrangement and recording workspace). Desktop song bar; phones and tablets keep their own layouts.

### Changed
- **Reset is real and tiered.** Settings ▸ Data ▸ Reset… lets you choose what to erase: layout, settings & calibration, presets & saved layouts, notebook & history, all songs & recordings, the offline copy. Quick buttons: *Layout only*, *Settings & layout*, *Everything*. Everything takes two clicks, offers to back up your songs first, and restarts the app as on a first visit. The layout menu's button is now **Reset layout**.
- Brand, title, manifest, offline cache name and the project file extension (`.daily-song.json`) follow the new name.

### Fixed
- **"Reset everything" did not reset everything.** The page's save-on-exit handler wrote the song and settings back after storage was cleared. All writes are now blocked while a reset runs, other open tabs are told to stop saving too, and the song database and offline cache are cleared with the rest.
- The first-run card no longer leaves a stray copy of the demo song in the library.

## 1.3.0 — 2026-10-23

### Added
- **Song strip across the whole app.** Title, artist, tuning, capo and scale now live in a persistent strip under the header, so every panel (and every export) sees the same details. **Notes & tuning ▾** opens the notes field and the per-string tuning editor.
- **Loading a track fills in the song.** A loaded backing track brings its title and artist (from the file's tags, or a cleaned-up file name), tempo, time signature, key and scale, and, when the song has no work of your own yet, its chords. Everything is written as one undoable step. The track chip in the strip offers *Import chords*, *Use tempo + key*, *Play band with track*, *Open Stems* and *Unload*, plus switches for *Track follows the transport* and *Auto-fill*.
- **Refine panel (right sidebar).** The lyric and chord canvas moved out of the Song tab into a right-sidebar tab, so you can keep the tab editor, the fretboard or the stems in the centre while you write. Sections are an accordion with add / duplicate / move / delete.
- **Interchangeable panels.** Every sidebar and dock panel can live in the centre, the left sidebar or the right sidebar (**⇆**, or **☰ → Where panels live**), the sidebars can be swapped, cards inside sidebars collapse, and per-panel widths are remembered. New layout presets: *Songwriting*, *Track study*, *Record*.
- **Record guitar and vocals at the same time.** On a two-input interface (Focusrite Scarlett, Solo, 2i2…) one input carries the guitar and the other the microphone. Pick **Guitar 1 · Vocal 2** (or the reverse) in **I/O → Guitar + vocal**, arm both lanes (●) and press **R**: you get a separate guitar take (dry DI + wet print) and a vocal take, recorded on the same clock, each with its own lane, level, pan, mute and solo. The vocal path has its own trim, level meter, optional high-pass + compressor "polish" and an optional monitor (headphones only).
- **DAW-style arrangement.** Lanes can be dragged to reorder, resized by their bottom edge, recoloured, hidden and re-added (**Lanes ▾**); the track header width is adjustable; lane height can be scaled up and down; and the arrangement or the current panel can be expanded to the whole centre (⤢, <kbd>Esc</kbd> to return). Recordings draw live while you record.
- **Track and stems in the arrangement.** The loaded track and its four stems appear as lanes aligned to the bar grid, with mute / solo / level, and the track follows play, stop, seek and loop of the transport.
- **Lyric intake.** **📋 Paste lyrics** in Refine (or paste a whole sheet into any lyric box, or drop a .txt / .lrc file) turns a finished lyric sheet into song sections. Headings such as `[Verse 1]`, `(Chorus)`, `Verse 2:` or `## Bridge` are recognised; with no headings, stanzas become Verses and a stanza that repeats becomes the Chorus. Repeated sections reuse the first one's chords, sections whose name matches yours keep your bars and tab, and your chords are placed over the words. A preview shows what will happen, and the whole import is one undoable step.
- **All-panels menu (☰)** above the dock tabs, so no panel is hidden by the tab strip scrolling; a two-column Stems layout on wide screens; a Refine overlay on desktop windows narrower than 1180 px.

### Changed
- The Song tab is now a section map and chord library; its details moved to the song strip.
- Takes carry a kind (guitar or vocal), pan and solo. Re-amp applies to guitar takes only.
- Guided tours (desktop and phone) cover the song strip, the Refine panel and the new lanes.

## 1.2.0 — 2026-10-23

### Added
- **Responsive layouts for phone, tablet and desktop.** The page detects the device (screen size and finger vs. mouse), re-flows live on rotation or resize, and can be forced from Settings or **⋯ More ▸ Device layout**.
  - *Phone:* compact header (tempo, signature, key), a thumb-reach **transport bar**, five-section **bottom navigation** (Play, Write, See, Stems, More) with panel chips, a **More** sheet (theme, monitor, screen-awake, settings, help, tour, save, share, install, full screen), a collapsible **arrangement** (mini, tall, hidden) and a side-rail layout in landscape.
  - *Tablet:* two-row header, the familiar tab bar and band strip, and **Tones** / **Tuner** as slide-in drawers.
- **On-screen tab keypad** for phones and tablets: frets 0–9, 10s / 20s, arrows, delete, technique keys, play from bar, auto-advance. Can be turned off in Settings.
- **Touch gestures:** press and hold = right-click (knob MIDI-learn, band chip menus), pinch-zoom and two-finger pan on the Neural map, and *Earlier / Later* buttons in a pedal's ⚙ menu (drag and drop does not exist on touch).
- **Stage ⛶ Full button**, with a fill-the-viewport fallback for iPhone Safari.
- **Screen wake lock** while playing, recording or monitoring on touch devices (switchable).
- **Installable web app (PWA):** web manifest, icons and a service worker (https / localhost only) for an offline cache and *Install app*.
- **Sample tracks:** audio files in `samples/` appear as one-tap buttons in **Stems** and **Transcribe** (loaded from the site only when tapped). `npm run build` regenerates `samples/manifest.json`; titles come from `samples/info.json`. Ships with *Good Morning*.
- A phone-specific guided tour, a phone note on the start card, `npm run test:mobile`, and mobile screenshots in the README.

### Changed
- On touch devices in-app monitoring starts **off** on first run to prevent speaker feedback.
- Tab cell size follows the device (`--tcw` / `--tch`), and the Fretboard scrolls sideways instead of shrinking.
- The "MIDI unavailable" toast is not shown on phones and tablets (Web MIDI is absent on iOS).

## 1.1.0 — 2026-10-23

### Added
- **Any tuning.** New presets: C# standard, C standard, B standard, Drop C#, Drop B, Drop Bb, Drop A, All fourths, Open Dm. A **custom per-string tuning editor** (Song → *Custom tuning*) with ±½ step, *Drop low string* and reset. Flat tunings are spelled with flats. The tuner's string circles now play reference tones when clicked.
- **Guided tour**: a spotlight walkthrough of the key areas, offered once on first run and available from **?**. Keyboard driven; never changes your song.
- **Repository and docs**: README, user guide, architecture notes, hosting guide, CI and GitHub Pages workflows, end-to-end tests, and a Node build script that regenerates `index.html` and the CodePen files from `src/`.
- Inline favicon and page metadata.

### Changed
- **Rig tab header and toolbar** rebuilt as one compact control deck: no empty areas, every row fills its width, *All off* sits with the scenes.
- The dock scrolls the active tab into view and supports mouse-wheel scrolling when tabs overflow.

### Fixed
- Removed a stray 404 request for the favicon.

## 1.0.0

Initial public feature set: pedal rig and pedalboard v2 with scenes, backing band, tab / chord / lyric composer with Ultimate Guitar export, polyphonic audio-to-tab transcription, Stage visuals, Neural map, version history and calibration, and backing-track stem separation with tempo, key and chord detection.
