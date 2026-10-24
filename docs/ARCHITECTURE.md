# Architecture

the-daily.studio is one self-contained web page written in vanilla JavaScript. This document explains how the source is organised and how the main subsystems fit together, so you can find your way around and extend it.

## Build model

```
src/parts/*.js ─┐
src/styles.css ─┼─ scripts/build.mjs ─► index.html          (standalone, served by GitHub Pages)
src/body.html  ─┘                    └► codepen/pen.{html,css,js}
```

* `scripts/build.mjs` concatenates `src/parts/*.js` **in filename order** inside a single `(() => { 'use strict'; … })()` closure, checks the result compiles, wraps it with the CSS and markup, and writes the outputs. There are no modules, no bundler and no runtime dependencies.
* Because everything shares one scope, parts can call each other's functions freely; **top-level `const` / `let` names must be unique across all parts** (a duplicate stops the whole app at load time). The smoke test catches this.
* Parts run in order but `boot()` (in `10-main.js`) is called only after *all* parts have been evaluated, so a part may use functions defined in a later one at call time.
* `index.html` and `codepen/*` are committed build outputs. CI runs `npm run build:check` to make sure they match `src/`.

## Parts

| File | Responsibility |
|---|---|
| `01-core.js` | `h()` DOM helper, `$` / `$$`, `bus` (tiny event emitter), `CFG` (settings) and `store` (localStorage with fallback), music theory (notes, scales, chord parsing, key detection), the **voicing search** (`voicings()`), `TUNINGS`, and the song model `S` with `commit()` / undo / redo |
| `02-audio.js` | Audio engine `E` (AudioContext, input / output selection, worklets), the **FX framework** (`defFx`, `FX`), amp / cabinet / reverb models, the rig `RIG`, presets |
| `03-band.js` | Karplus-Strong plucked-string synth, drum and bass generators, strum patterns, the transport `T` and scheduler, recording and re-amp |
| `04-analysis.js` | Live analysis `AN`: YIN pitch, cents, vibrato, chroma / chord and key detection, onsets, timing statistics, loopback latency |
| `05-ui-core.js` | Knobs and MIDI learn, header and transport, settings dialog, help, global keyboard shortcuts, status bar |
| `06-ui-panels.js` | Dock framework (`DOCK`, `PANES`, `dockGo`), left sidebar (Tones / I-O / Theory), the Rig pane, right sidebar (tuner, meters, live analysis) |
| `07-ui-timeline-tab.js` | Canvas arrangement timeline and the tab editor |
| `08-ui-compose.js` | Song, Band and Export panes, Ultimate Guitar / ChordPro / MIDI / WAV writers and the submission lint |
| `09-ui-viz.js` | Fretboard, Visuals, Vision (webcam, MediaPipe) and Research panes |
| `09b-tx-engine.js` | Polyphonic transcription engine (pure DSP, no DOM) |
| `09c-tx-ui.js` | Transcribe pane: capture, review, apply, consensus, self-test |
| `10-main.js` | `boot()`, the frame loop, event wiring |
| `11-layout.js` | Workspace layout: tab order, floating windows, presets, splitters, band strip |
| `12-board.js` | Pedalboard v2: chain strip, per-pedal options, scenes, Stomp view, footswitch / MIDI bindings |
| `13-stage.js` | Stage: eight scenes with post effects, overlays, prompter |
| `14-neural.js` | Neural map: node graph, learned chord transitions, replay |
| `15-safety.js` | Version history snapshots and "calibrate to my guitar" |
| `16a-stem-dsp.js` | Stem separation DSP. A pure function factory so it can run in a Web Worker *or* on the main thread |
| `16-stems.js` | Stems pane, chunked stem player, tempo / key / chord analysis glue |
| `17-tour.js` | Guided tour overlay (desktop / tablet steps and a phone walkthrough) |
| `18-mobile.js` | Responsive shell: form-factor detection, phone bottom navigation, More sheet, tablet drawers |
| `19-touch.js` | Touch extras: tab keypad, long-press = right-click, wake lock, PWA registration, first-run phone defaults |
| `20-samples.js` | Sample-track shelves (reads `samples/manifest.json`, loads a track into Stems or Transcribe on tap) |
| `21-songbar.js` | The persistent song strip (title, artist, tuning, capo, scale, notes popover) and the loaded-track chip; title cleaning, ID3 / MP4 tag reading and `stemAutofill()` (one undoable step) |
| `22-sides.js` | Panel registry for the sidebars: `homeOf`, `sideShow`, `movePanel`, `swapSides`, per-tab widths, the "Where panels live" menu, card collapse. Any panel can live in the centre dock, the left or the right sidebar |
| `24-lyrics.js` | Lyric intake: `lyricParse` (headings, stanzas, .lrc), `liBuild` (pure plan: reuse, repeat, new sections), `liPlace` (chords over words), the import dialog |
| `23-lanes.js` | DAW lane model for the arrangement (`LN`: order, heights, colours, hidden), lane headers and menu, lane drawing (chords, tab, bass, drums, live input, vocal, takes, track and stems), the Guitar + vocal I/O card, level meters, expand modes, and the track-follows-transport hooks (`trackStart` / `trackStop`) |

## Runtime model

* **State.** One mutable song object `S` (title, tuning, capo, sections → bars → chord + tab notes, band settings, mix). `commit(push)` records an undo step, autosaves and emits `bus.emit('song')`. Panes re-render on that event. Settings live in `CFG`; both persist through `store` (localStorage, with an in-memory fallback if storage is unavailable).
* **Events.** `bus.on / emit` decouples panes (`'song'`, `'dock'`, `'preset'`, `'audio:ready'`, `'booted'`, …).
* **Frame loop.** `requestAnimationFrame(frame)` repaints canvases and meters; `setInterval(anaTick, 33)` runs the analysis tick that reads time- and frequency-domain data from analyser nodes.
* **Panes.** `DOCK` is the ordered list of `[id, name]`; `PANES[id]` is the container element (`#pane-<id>`). `buildX()` functions populate panes at boot. A pane can be docked or floated; `paneVisible(id)` tells heavy renderers whether to draw.

## Audio graph (simplified)

```
 guitar / mic ─► input trim ─► DI analyser ─┬─► RIG chain (16 units, reorderable) ─► rig analyser
                                            │                                          │
 band synths (drums, bass, rhythm, lead) ───┼──────────────────────────────────────────┤
 stem player (backing track chunks) ────────┘                                          ▼
                                                                          E.mix ─► master gain ─► limiter ─► out
```

* The noise gate, pitch shifter, flanger, plucked-string voices and recording taps run as **AudioWorklets**, defined as source strings and loaded from Blob URLs (with a `data:` fallback).
* Each FX unit is registered with `defFx(id, name, category, params, build)`. `build(ctx)` returns `{ in, out, set(key, value) }`; the framework creates the pedal UI, preset, A/B and morph handling from the `params` list.
* Recording captures the **dry DI** and the **wet** signal separately so takes can be re-amped.

## Tunings and the voicing engine

`TUNINGS` maps a name to six MIDI note numbers (low to high). `S.tuning` is the active array, `S.capo` the capo fret, and `S.tuningName` the label. Everything downstream derives pitch from `S.tuning[string] + S.capo + fret` (see `noteMidi`). `voicings(symbol, tuning, capo, limit)` **searches** playable fingerings for any chord in any tuning (it is cached per symbol / tuning / capo) rather than looking them up in a table. `setTuning(array)` is the one function that changes tuning: it names the result (a matching preset, or `Custom (…)`), resets voicing preferences and commits.

Spelling follows the tuning name (`tunFlat()` / `tunPc()`): flat tunings are spelled with flats.

## Transcription engine (`09b-tx-engine.js`)

Pure DSP with no DOM access, so it is benchmarkable in Node. In outline: onset detection → onset-synchronous spectral-difference multi-pitch estimation (iterative estimate-and-cancel) over the pitch table implied by the tuning and capo → quantisation → a **Viterbi search over string / fret assignments** with chord-voicing and camera priors → technique detection (bends, vibrato, slides, hammer-ons). `txSynth` generates Karplus-Strong guitar with known ground truth, which powers the in-app **self-test**.

## Stem separation (`16a-stem-dsp.js`)

Classical, local, deterministic DSP: STFT (N = 2048, hop 1024, sqrt-Hann) → harmonic / percussive separation by sliding median filtering → low-frequency transient boost for kick → bass harmonic comb (f0 38–150 Hz, needs a strong fundamental) → centre-channel pitched-voice mask for vocals → remainder as guitar / other. Stems sum back to the original mix. Tempo, downbeat, key and chords come from onset, beat-grid and peak-picked chroma analysis. The code is wrapped in `stemDSPFactory()`; the Stems pane builds a Web Worker from `stemDSPFactory.toString()` and falls back to the main thread if workers are unavailable.

## Guided tour (`17-tour.js`)

A step list (`tourSteps()`) of `{ t: target, pane, pre, title, b, side, tip }`. `tourGo(i)` switches the pane, finds the target element, and `tourPlace()` positions a spotlight (a div with a very large `box-shadow`) and a card next to it, avoiding overlap and clamping to the viewport. Keys are captured while the tour is open so shortcuts cannot fire accidentally. Add a step by adding an entry to the array.

## Responsive shell (`18-mobile.js`, `19-touch.js`)

`detectForm()` returns `phone`, `tablet` or `desktop` from the viewport and `(pointer:coarse)`, unless `CFG.form` forces one. `applyForm()` writes `body[data-form]`, `data-land` (landscape), `data-touch`, and on every navigation `data-view`, `data-g` (section), `data-s` (panel), `data-tl` (arrangement state) and `data-kpad`. **All responsive CSS hangs off those attributes** at the end of `styles.css`, so desktop styles are never edited and cannot regress; at `desktop` the new elements are `display:none`.

* **Phone** keeps the same DOM. `mMoveTransport()` moves the first eight transport children (rewind … time) into `#mtrans` (bottom bar) and moves them back when the form changes, so tempo, signature, key and mode stay in the header. Navigation is a model, not new panels: `MGROUPS` maps five sections to the existing dock panes (`dockGo`) and to the two sidebars, which become full views (`data-view=left|right`). The arrangement is the same `#timeline`; only its grid row changes (`--tlp`).
* **Tablet** keeps the dock tab bar and turns `#left` / `#right` into fixed drawers (`body.d-left|d-right`, `#mback` backdrop). `toggleSide()` (`[` and `]`) opens them.
* The tab keypad is a sibling of the panes in `#dock`, shown only for `data-s=tab`. It drives the editor through `tabKey()` / `setNote()`, so it shares all behaviour with the keyboard.
* Long-press dispatches a synthetic `contextmenu` after 650 ms (cancelled by movement, or by a real `contextmenu` on Android). Pinch is handled with a pointer map in the Neural pane.
* The tour chooses `tourStepsPhone()` on phones and opens the drawers on tablets.

**PWA.** `scripts/build.mjs` also writes `manifest.webmanifest` and `sw.js` (cache name = package version, same-origin stale-while-revalidate, never touches cross-origin or audio). `icons/` holds the committed PNGs (`scripts/make-icons.mjs` regenerates them from `icons/icon.svg`). The page registers `sw.js` only on https / localhost and not inside an iframe, so CodePen is unaffected. Bump `version` in `package.json` to roll the cache.

## Extending

**Add a tuning.** Add `'Name (notes)': [e2, a2, d3, g3, b3, e4]` (MIDI numbers, low to high) to `TUNINGS` in `01-core.js`. It appears in the Song and Theory menus automatically.

**Add a pedal.** Call `defFx('id', 'Name', 'Category', [P(...), SELP(...), TOG(...)], ctx => ({ in, out, set(k, v) {…} }))` in `02-audio.js`, add the id to `RIG.order`, and (optionally) to presets. Defaults come from each parameter's `def`.

**Add a panel.** Append `['id', 'Name']` to `DOCK` in `06-ui-panels.js`, write `buildMyPane()` that appends to `PANES.id`, call it from `boot()` in `10-main.js`, and listen to `bus.on('dock', id => …)` to render lazily.

**Add a tour step.** Add an object to `tourStepsDesk()` (and `tourStepsPhone()` if it should appear on phones).

**Add a panel on phones.** Add its id to a group in `MGROUPS` (`18-mobile.js`).

## Testing

* `npm test` boots the page in **jsdom** with a stubbed Web Audio layer, exercises exports, undo, presets and rendering, and fails on any uncaught error. It cannot hear audio.
* `npm run test:e2e` drives a real Chromium with a fake audio device through tunings, the tour, the rig layout, a transcription self-test and a stem-separation run.
* `npm run test:mobile` emulates a phone (portrait, small, landscape), tablets and a desktop window: layouts must not scroll sideways, the keypad writes tab, the More sheet and drawers work, the tour completes, long-press, pinch, wake lock and the service worker register, and the desktop shell is unchanged.
* `npm run test:stems` runs the separation DSP in Node on a synthetic mix with known stems and fails if SI-SDR falls below a floor.

## Design principles

1. **Local first.** No server, no telemetry, no account. Anything that leaves the machine (optional MediaPipe download) is opt-in and documented.
2. **Instrument, not toy.** Numbers are shown with their uncertainty and every analysis can be exported.
3. **One file.** The app must keep working when opened from disk, from CodePen or from any static host.
4. **No regressions.** New features are added beside existing ones; the end-to-end tests protect the core flows.

## Two-input recording (`02-audio.js`, `03-band.js`, `23-lanes.js`)

The browser opens one stream with up to two channels. `E.split` (a 2-way `ChannelSplitter`) feeds the **guitar** (`E.gL` / `E.gR` → `E.inSum` → rig) and the **vocal** (`E.vL` / `E.vR` → `E.voxIn` → `E.voxTrim` → analyser, optional monitor and `E.voxStrip` → the `vox` mix track). `setChannelMode` and `setVoxInput` set the gains so a channel given to the vocal is removed from the guitar (no bleed into the dry DI). `recBegin` taps `di`, `wet` and `vox` on the same clock; `recEnd` creates one take per armed lane (`kind: 'gtr' | 'vox'`). `scheduleTakes` plays every take with its own gain, pan, mute and solo; guitar takes can re-amp through the rig, vocal takes go through the vocal strip.

## Track on the transport

`trackStart(when, slot)` maps a transport slot to track time (`slot × slotDur() + trkT0()`, where `trkT0()` is the detected first downbeat) and calls `spPlay`; it is called from `play()` and again on every loop wrap, and `trackStop()` from `stopPlay()`. The arrangement draws the track and stems from a 20 ms envelope cache (`STM.envL`) at the bar grid's scale.

## Projects, origins, zoom and reset (parts 25–27, v1.4)

- **25-projects.js** — the song library. IndexedDB database `the-daily.studio` with stores `projects` (one record per song: metadata + song model) and `blobs` (`<id>/take/<takeId>/dry|wet|cam` as Int16 PCM, `<id>/track` as the original file). Autosave is debounced from the `song`, `takes` and `track` bus events and flushed on `pagehide`. A backing track is re-separated on open with `stemLoad(file, {restore:true})`. Also: a minimal ZIP writer/reader (STORE, plus `DecompressionStream('deflate-raw')` for reading), the bundle format (`song.md`, `arrangement.json`, `audio/*.wav`), import, and migration of a single autosaved song from earlier versions.
- **26-origins.js** — the start card (Clean canvas / Start from a song), the library dialog, the zoom control (`zoomSet('canvas'|'song'|'studio')`, which applies the Songwriting or Record / Track study layout presets) and the song-bar buttons.
- **27-reset.js** — selective reset. `store.locked` blocks every write (the old bug was `beforeunload` re-saving after `localStorage.clear()`), a BroadcastChannel tells other tabs, then localStorage keys, the IndexedDB database and the Cache Storage / service worker are cleared and the page reloads on a clean address.
- Add `?debug` to the address to expose `window.__daily` for tests.
- Design rule: no accounts, no backend. Optional sync (for example to a GitHub repository, text first) is planned as a separate, opt-in layer on top of the bundle format.

## Appearance (part 05b-look.js, v1.6)

`applyAppearance()` resolves the mode (light, dark, or the system preference), picks the palette for that mode, applies high-contrast and colour-blind adjustments, fits the accent colour to the palette (`lkFit` raises or lowers lightness until a 3.4:1 contrast against the surface is reached), and writes every colour as a CSS variable on `<html>`. Shape and spacing come from `data-corners`, `data-density`, `data-surface`, `data-font` and `data-contrast` attributes styled at the end of `styles.css`. Canvases re-read the variables on the `theme` bus event. To add a palette, append an entry to `PALETTES`; to add a look, append to `LOOKS`.
