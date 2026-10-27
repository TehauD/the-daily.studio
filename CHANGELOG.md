# Changelog

All notable changes to the-daily.studio (earlier versions were released under the name FRETWORK). Versions follow [Semantic Versioning](https://semver.org/).

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
