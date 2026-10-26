# Audio control and kill switch

Design notes for how the-daily.studio treats the microphone and sound output.

## Principles

1. **Nothing is requested until the user acts.** No microphone permission prompt, no input stream, no monitoring at load.
2. **The state is always visible.** The header **Audio** button shows a status light and label: *Audio off* (grey), *Input live* (green), *No input* (amber), *Audio killed* (red).
3. **Stopping is one action.** Ctrl/Cmd + . works from anywhere in the app, including while a dialog is open.
4. **Monitoring is opt-in** because it can cause feedback on speakers.

## Start screen

* **▶ Start with camera and mic off** (primary): opens the app with the audio engine idle.
* **🎙 Start and connect my input** (secondary): starts the engine and asks the browser for the microphone.

## Audio panel (header button; on phones, More ▸ Audio · kill switch)

* Start or resume the engine without a microphone.
* Choose an input and **Connect** / **Disconnect**.
* **Hear myself through the app** (monitoring), off by default.
* **Reconnect my last input when the app opens** (`autoIn`), off by default. Only when on does the app reopen the saved input device at load.
* **KILL AUDIO · Ctrl + .**

## I/O, levels and the mixer (2.1)

* **One Connect card** (`41-io2.js`: `ioConnectEl`) is used by I/O, the header Audio panel, the stage and Perform. It only asks the browser for the microphone when **Connect** is pressed. Permission errors map to a browser- and system-specific help (`ioPermHelp`).
* **Set my level** (`ioLevelWizard`) measures the raw input peak and sets `CFG.gTrim` (applied by `E.inTrim`, a gain after the input and before the rig) so peaks land at `IO_TARGET` (−9 dBFS guitar, −10 voice). The signal-path strip reads four analysers: `E.anaL/anaR` (raw), `E.anaIn` (post-trim), `E.anaRig`, `E.anaMaster`.
* **Lane strips** (`42-mixer.js`: `fxStrip`) sit in every track's chain: `in → low shelf (110 Hz) → mid peak (1.2 kHz) → high shelf (7 kHz) → [compressor + make-up | bypass] → (pan) → out`, with reverb and delay sends into the shared effects bus. Settings are `S.mix[id].fx` (band and vocal lanes, saved with the song), `take.fx` (saved with each take) and `STM.mix[i].fx` / `STM.fx` (stems and the whole track, session only).
* **Master chain** (`mstBuild`): low shelf, high shelf and a parallel compressor between the mix bus and `E.master`, driven by `CFG.mstPre`, which also sets `CFG.lufsTarget` for exports. The limiter stays last.
* **Auto-balance** (`44-balance.js`) measures integrated loudness (BS.1770, the exporter's meter) of the first 60 s of each take and of the backing track as it is heard, plans gains and pans, and applies them only after the person presses Apply. Nothing is uploaded; nothing opens the microphone.

## What the kill switch does

In order: stops playback and recording, turns monitoring off, stops every input track and disconnects the input node (the browser's recording indicator goes off), emits the input-closed event so meters and analysis go idle, suspends the AudioContext, sets the state to *killed* and shows a toast. **Resume** restarts the engine with the microphone still off.

## Implementation map

* `src/parts/30-audio-control.js`: `audioKill`, `audioResume`, `closeInput`, `audioState`, `audioButton`, `audioOpen`, the key handler.
* `src/parts/10-main.js`: boot (no auto-connect unless `CFG.autoIn && CFG.inDev`), start-screen buttons, status line.
* `src/parts/01-core.js`: defaults `monitor: false`, `autoIn: false`.
* Tests: `test/e2e.cjs` "audio control" block.
* Tests: `test/e2e.cjs` blocks "I/O 2", "v2.1 · drop anywhere", "v2.1 · auto-balance" and "v2.1 · lane strips, master chip, undo / saved, count-in".

## Hum to Song

The Hum screen has its own short recording (microphone only, optional camera) that does not use the audio engine. It follows the same rules: nothing is requested until **● Hum or sing** is pressed, the microphone is the one chosen for the Audio button, the recording lives in memory, and **Ctrl/Cmd + .** discards it and releases the microphone. Code: `src/parts/31-hum-engine.js` (analysis and arrangement) and `32-hum-ui.js` (screens).

## Upgrading users

Saved settings are preserved. A user who previously had monitoring on keeps it on until they untick it; the new defaults apply to new visitors and after Reset.
