# Testing and quality gates

| Command | What it proves | Needs |
| --- | --- | --- |
| `npm run build:check` | Committed `index.html`, `codepen/`, `sw.js`, manifest match `src/` | Node |
| `npm test` | Boots the whole app in jsdom; any script error fails; checks presets, undo/redo, theory, lab update | `npm ci` |
| `npm run test:stems` | Stem-separation benchmark on synthetic audio | Node |
| `npm run test:e2e` | **Every real-Chromium suite below, in parallel** (see the table); one summary at the end; a non-zero exit if any file fails | Playwright Chromium |
| `npm run test:e2e:core` | Only the core flows (`test/e2e.cjs`) | Playwright Chromium |
| `npm run test:mobile` | Phone, tablet and desktop layouts, More sheet, navigation, install files | Playwright Chromium |
| `npm run test:all` | The jsdom smoke test, then every suite | both |
| `npm run build:site && npm run verify:site` | Deploy folder complete; CSP hash matches the script; header policy; only two third-party hosts; version matches service worker; icons present | Node |
| `npm run shots` | Regenerates every picture in `docs/screenshots/` from the running app (also fails on any console, page or network error) | Playwright Chromium |

In sandboxes: `CHROMIUM_PATH=/path/to/chromium NO_SANDBOX=1 npm run test:e2e`. To run a few suites, name them: `node test/run.cjs clips midi` (any file whose name contains one of the words). `JOBS=3` sets how many run at once (default: half the processors, 1 to 4). `BASE_URL=https://…` tests a deployed site instead of the local server.

## The browser suites

Each file starts its **own** static server, its own Chromium (fake microphone and camera) and fresh browser contexts through `test/lib.cjs`, so nothing one file leaves behind (settings, songs, a stuck service worker) can change another, and they run side by side. Every file ends by asserting that the page produced no console errors, page errors or failed requests.

| File | Covers |
| --- | --- |
| `e2e.cjs` | Start overlay and **no microphone request on load**, Audio button, **Ctrl + . kill and resume**, tunings, tour, rig deck, transcription, stems, appearance and palettes, camera looks (with a stubbed person segmenter), The Daily at `/journal/`, reset |
| `e2e-io.cjs` | The Connect card, Set my level, channels, permission help per browser, new-interface prompt, signal path, latency lab |
| `e2e-drop.cjs` | Drop anywhere: what each file kind does, the chooser, the empty-arrangement row, refusal while a window is open |
| `e2e-balance.cjs` | Auto-balance: the plan, nothing moves until Apply, undo, two guitar takes split left and right, the band back to reference, a backing track measured, a take too short to measure |
| `e2e-lanes.cjs` | Lane strips (M S, volume, pan, +Fx), effects saved with the song and each take, the master menu and presets, undo / redo and the Saved mark, the count-in menu |
| `e2e-camera.cjs` | Camera backdrop and its looks (dimmed, edges-in, green-screen cut-out), checked by polling for the picture instead of sleeping |
| `e2e-clips.cjs` | Clips: split, move, trim, fade, duplicate, delete and undo; exact scheduling of each clip; lane settings kept; saved with the song and in a bundle |
| `e2e-session.cjs` | One history for song, clips and stem mix; the stem mix, clips and fades saved and restored after a reload; bundles hold one WAV per clip |
| `e2e-render.cjs` | Fast render: a stereo 24-bit WAV that is not silent, the same loudness and loudness shape as the real-time bounce, one band part on its own, takes included, the progress window, **Cancel**, the kill switch, and the live engine put back afterwards |
| `e2e-midi.cjs` | MIDI import: track picker, chords, melody, tempo, time signature, karaoke words, format-0 files, running status, files that cannot be opened, the New song window |
| `e2e-keep.cjs` | Keep songs safe: the iPhone case, the card and its Add to Home Screen steps, the one-time tip, the backup reminder and its timing, the installed-app case, desktop Chrome |
| `e2e-record.cjs` | Recording: one press is one take (loop on or off), the song grows to fit and takes the spare bar back, a loop region stacks takes, the three Settings choices, a silent second input is not kept |
| `e2e-voice.cjs` | Voice: the key's notes, matching a pitch to a note, transposing chords, a range from a spread of notes, the plan for a melody that is too high or fits, transposing the song as one undo step, the window with the fake microphone, the Pitch ribbon on the Visuals, the kill switch |
| `e2e-edit.cjs` | Range editing: Shift-drag and Mark in / out, Cut out (closes the gap), Silence, all lanes or one, splitting across clips, fades at the cuts, punch in recording only inside the stretch, clip level, one undo step each, keys, phone clip bar |
| `e2e-heat.cjs` | Heatmap: one place is exact, several are shared and counted as shared, the camera decides, a blip is ignored, the three views and their colours, the summary wording, the Song source, a new tuning starts fresh, Reset, switching back to Scale |
| `e2e-backdrop.cjs` | Performer backdrop: off by default, calm scene values, the colour easing between sections, dimming and loudness, green and black backgrounds on the real stage canvas, the lower third (bottom, top, nothing to show), the clean output window and its colour, the kill switch |
| `e2e-layout.cjs` | Nothing clipped or squeezed: time display from 1280 px, the beat, key and mode boxes and the song bar from 1440 to 1920 px, lane headers and clip bar on a phone, no stray “null” |
| `mobile.cjs` | Phone, tablet and desktop layouts, the keypad, drawers, gestures, installable-app files |

## Hum to Song checks

The e2e suite runs a synthetic hummed melody (16 notes, 25 cents sharp) through the real analysis and arranger and asserts every note, the tempo, key, section list, valid chords, lead-guitar notes in verse, chorus and bridge, style and key re-arrangement, the Ctrl + . stop, and the center-stage defaults. It also drives the **guitar coach** with stand-in guitar readings (tune six strings, play four chords, reach play-along), the **adaptive studio** (four plain tabs for a new visitor, more after use, the Tools override) and the **full-screen center stage** (fills the screen; Studio button returns). axe-core (WCAG A/AA) was run on the first screen, the start panel and the coach in light and dark with no violations. Real voices are noisier: also try humming, singing with words, and a voice memo on the deployed site.

## Manual checks before a release

Automated tests use a fake microphone and camera and do not reach the third-party camera hosts. The full list, in the order to do it with real gear (about 45 minutes), is **[HARDWARE_CHECKLIST.md](HARDWARE_CHECKLIST.md)**. The short version, on the deployed site:

1. **Real audio:** connect a real interface or headphone mic, play, then press Ctrl/Cmd + . and confirm the browser's recording indicator turns off. Resume; confirm the microphone stays off until Connect.
2. **Monitoring:** off by default; tick "Hear myself" with headphones and confirm sound; untick.
3. **Camera:** Visuals ▸ camera backdrop, look = *person* and *edges*; hand tracking. Confirm models load (Network tab shows jsDelivr and storage.googleapis.com).
4. **Offline:** load once, go offline, reload; install to home screen on a phone.
5. **Browsers:** current Chrome/Edge, Safari (macOS and iOS), Firefox. Web Audio and camera behave differently; note any gaps in the changelog. On an iPhone, check **Keep songs safe** before and after Add to Home Screen.
6. **Accessibility:** keyboard-only pass through start card, Audio panel and Appearance; run axe on the light and dark default palettes and the Audio dialog.
7. **Journal:** `/journal/` loads, imports an export, and the studio's Reset does not remove it.

## What is not covered

Very long sessions, large stem imports on low-memory phones, screen-reader pass of every panel, and non-Chromium audio latency. These are known gaps for Release 1.
