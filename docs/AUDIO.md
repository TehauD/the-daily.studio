# Audio control and kill switch

Design notes for how the-daily.studio treats the microphone and sound output.

## Principles

1. **Nothing is requested until the user acts.** No microphone permission prompt, no input stream, no monitoring at load.
2. **The state is always visible.** The header **Audio** button shows a status light and label: *Audio off* (grey), *Input live* (green), *No input* (amber), *Audio killed* (red).
3. **Stopping is one action.** Ctrl/Cmd + . works from anywhere in the app, including while a dialog is open.
4. **Monitoring is opt-in** because it can cause feedback on speakers.

## Start screen

* **▶ Start · microphone stays off** (primary): opens the app with the audio engine idle.
* **🎙 Start and connect my input** (secondary): starts the engine and asks the browser for the microphone.

## Audio panel (header button; on phones, More ▸ Audio · kill switch)

* Start or resume the engine without a microphone.
* Choose an input and **Connect** / **Disconnect**.
* **Hear myself through the app** (monitoring), off by default.
* **Reconnect my last input when the app opens** (`autoIn`), off by default. Only when on does the app reopen the saved input device at load.
* **KILL AUDIO · Ctrl + .**

## What the kill switch does

In order: stops playback and recording, turns monitoring off, stops every input track and disconnects the input node (the browser's recording indicator goes off), emits the input-closed event so meters and analysis go idle, suspends the AudioContext, sets the state to *killed* and shows a toast. **Resume** restarts the engine with the microphone still off.

## Implementation map

* `src/parts/30-audio-control.js`: `audioKill`, `audioResume`, `closeInput`, `audioState`, `audioButton`, `audioOpen`, the key handler.
* `src/parts/10-main.js`: boot (no auto-connect unless `CFG.autoIn && CFG.inDev`), start-screen buttons, status line.
* `src/parts/01-core.js`: defaults `monitor: false`, `autoIn: false`.
* Tests: `test/e2e.cjs` "audio control" block.

## Upgrading users

Saved settings are preserved. A user who previously had monitoring on keeps it on until they untick it; the new defaults apply to new visitors and after Reset.
