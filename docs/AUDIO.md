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
* **Lane strips** (`42-mixer.js`: `fxStrip`) sit in every track's chain: `in → low shelf (110 Hz) → mid peak (1.2 kHz) → high shelf (7 kHz) → [compressor + make-up | bypass] → (pan) → out`, with reverb and delay sends into the shared effects bus. Settings are `S.mix[id].fx` (band and vocal lanes, saved with the song), `take.fx` (saved with each take) and `STM.mix[i].fx` / `STM.fx` (stems and the whole track; saved with the song in `stemMix`, 2.2).
* **Master chain** (`mstBuild`): low shelf, high shelf and a parallel compressor between the mix bus and `E.master`, driven by `CFG.mstPre`, which also sets `CFG.lufsTarget` for exports. The limiter stays last.
* **Auto-balance** (`44-balance.js`) measures integrated loudness (BS.1770, the exporter's meter) of the first 60 s of each take and of the backing track as it is heard, plans gains and pans, and applies them only after the person presses Apply. Nothing is uploaded; nothing opens the microphone.

## Clips, fast render and MIDI (2.2)

* **Clips** (`45-clips.js`): a take is a clip with `startSec`, `inS` / `outS` (the trim, in seconds of the recording), `fadeIn` / `fadeOut` and an optional `src` (the recording it shares after a split). A lane is the *lead* clip (`tkLead`); its level, pan, mute, solo and effects belong to the lane. `scheduleTakes(when, from)` starts one buffer source per clip at the right moment and offset, with a gain ramp for each fade; `tkRender` renders the lane as it plays (trims and fades applied) for Auto-balance and WAV export. Every edit goes through the composite history (`snap()` = song + clips + stem mix; `histPush`, `histBegin`, `histEnd`).
* **Fast render** (`46-render.js`): `ofrRender` builds the engine a second time on an `OfflineAudioContext` (`ofrSwapIn` sets the live engine aside; `ofrRestore` puts it back), schedules the song, the clips and the backing-track stems in slices of about 2.5 s (`oc.suspend` / `resume`, each slice confirmed by the plucked-string voices with `sync` messages so timing stays sample exact) and returns the stereo buffer. The live engine is not touched while it runs; `ofrAbort` (Cancel, or **Ctrl/⌘ + .**) restores it at once. `bounceMaster` tries it first (`CFG.renderFast`) and falls back to the real-time path when the browser cannot. Compressed audio, the share page and **Record the stage** still run in real time because the browser's encoders are real-time.
* **MIDI import** (`47-midi-import.js`): `smfParse` reads a Standard MIDI File (also RMID and karaoke text events); `smfParts` splits it into parts and guesses each part's role; `smfBuild` turns the chosen parts into a song. It runs in the page, makes no requests and never opens the microphone.

## Latency (2.18)

* **Measured, not guessed.** `test/e2e-latency.cjs` sends a click into the guitar input (`E.inSum`) and the vocal input (`E.voxIn`) and times it at the rig output, the vocal strip and the limiter. With the browser's own nodes the default rig (compressor, amp, cab, reverb) added **20.7 ms** to the guitar and the vocal path **12 ms**: `DynamicsCompressorNode` always looks 6 ms ahead (the amp's sag, the compressor pedal, vocal polish, the lane and master compressors and the limiter are all compressors), and `WaveShaperNode` oversampling adds 128 frames at 2x and 192 at 4x (the amp has two shapers, each drive pedal one).
* **Zero-delay replacements** (`02-audio.js`, in `WORKLET_SRC`): `fw-comp` follows the browser compressor's static curve (threshold, soft knee, ratio) and its make-up gain exactly, so levels do not move (within 0.5 dB over the app's settings), and works on 32-sample slices, reading each slice before scaling it, with no look-ahead buffer. `fw-shape` rebuilds the app's `satCurve` from its parameters and oversamples 2x/4x through polyphase IIR half-band filters (12 and 4 coefficients: flat to 0.002 dB, images 87–131 dB down, about 0.1 ms). Same level as the browser's 4x shaper, the same aliasing (about −92 dB). `mkComp(c)` and `mkShaper(c)` make them, with the same properties as the native nodes (`threshold` … `release`; `curve`, `oversample`), or the native nodes when there are no worklets or **Settings ▸ Audio engine ▸ Zero-delay effects** (`CFG.lowLat`) is off. Now the guitar comes out after **0.2 ms** and the voice after **0**. The cost is about 3.6% of one core for an amp's worth (two 4x shapers, three compressors) against 2.6% native.
* **Delay compensation.** Each rig unit reports the delay it adds (`FxUnit.lat()`, from its nodes' `_lat`); `rigLat()` and `voxLat()` sum them. A take played through the rig (re-amp) or the vocal polish is started that much early (`scheduleTakes`), a wet print is trimmed by the rig delay it was recorded with (`REC.wl`), and the compressor pedal's Blend delays its dry side to match a look-ahead compressor, so the two do not comb-filter. With the zero-delay effects all of this is 0; with the native ones it keeps takes within a sample of where they were played. The fast render goes through the same code, so exports match.
* **Not the app's to fix:** the browser's own input and output buffering (`baseLatency`, `outputLatency`, the input's `latency`) and the interface driver. Recordings already allow for it (`rttMs()`, measured by the Latency lab).
* Chrome never calls an AudioWorklet processor again once it has returned `false`, even if something is connected later, so `fw-comp` and `fw-shape` always return `true`; a take's lane strip, made for one playback, sends its compressor `{ end: true }` when it is thrown away (`fxStrip().dispose`).

## What the kill switch does

In order: stops playback and recording, turns monitoring off, stops every input track and disconnects the input node (the browser's recording indicator goes off), emits the input-closed event so meters and analysis go idle, suspends the AudioContext, sets the state to *killed* and shows a toast. **Resume** restarts the engine with the microphone still off.

## Implementation map

* `src/parts/30-audio-control.js`: `audioKill`, `audioResume`, `closeInput`, `audioState`, `audioButton`, `audioOpen`, the key handler.
* `src/parts/10-main.js`: boot (no auto-connect unless `CFG.autoIn && CFG.inDev`), start-screen buttons, status line.
* `src/parts/01-core.js`: defaults `monitor: false`, `autoIn: false`.
* Tests: `test/e2e.cjs` "audio control" block.
* Tests: `test/e2e-io.cjs`, `e2e-drop.cjs`, `e2e-balance.cjs` and `e2e-lanes.cjs` (2.1); `e2e-clips.cjs`, `e2e-session.cjs`, `e2e-render.cjs`, `e2e-midi.cjs` and `e2e-keep.cjs` (2.2). Run them together with `npm run test:e2e`.

## Hum to Song

The Hum screen has its own short recording (microphone only, optional camera) that does not use the audio engine. It follows the same rules: nothing is requested until **● Hum or sing** is pressed, the microphone is the one chosen for the Audio button, the recording lives in memory, and **Ctrl/Cmd + .** discards it and releases the microphone. Code: `src/parts/31-hum-engine.js` (analysis and arrangement) and `32-hum-ui.js` (screens).

## Upgrading users

Saved settings are preserved. A user who previously had monitoring on keeps it on until they untick it; the new defaults apply to new visitors and after Reset.
