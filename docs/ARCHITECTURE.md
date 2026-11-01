# Architecture

the-daily.studio is one self-contained web page written in vanilla JavaScript. This document explains how the source is organised and how the main subsystems fit together, so you can find your way around and extend it.

## Build model

```
src/parts/*.js ─┐
src/styles.css ─┼─ scripts/build.mjs ─► index.html          (standalone single-file app)
src/body.html  ─┘                    └► codepen/pen.{html,css,js}
```

* `scripts/build.mjs` concatenates `src/parts/*.js` **in filename order** inside a single `(() => { 'use strict'; … })()` closure, checks the result compiles, wraps it with the CSS and markup, and writes the outputs. There are no modules, no bundler and no runtime dependencies.
* `index.html` gets a **minified** copy of the script and stylesheet (`scripts/minify.mjs`, no packages, because the build runs before `npm ci`). It removes comments, indentation and the spaces around punctuation, and nothing else: line breaks stay (so automatic semicolons behave as before), names are never shortened, and strings, templates and regular expressions are copied byte for byte. The build compiles the minified copy and compares its tokens with the readable one, and fails on any difference but whitespace. The CodePen panels keep the readable code. `node scripts/build.mjs --pretty` writes an unminified `index.debug.html` (ignored by git) for debugging.
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
| `05c-hub.js` | **The header's dialogs.** `hubOpen(id, {ico, title, sub, sections, at, foot, preview})` builds the one dialog shape used by ▦ Workspace (`workspaceOpen`, part 64), ◐ Appearance (`lookOpen`, 05b), ⚙ Settings (`openSettings`) and ? Help (`openHelp`): header with ✕, a section list, every section a card in one scrolling column (`hubGo` scrolls to one, `hubSpy` lights the list as you scroll), `hubRow` for a labelled control. |
| `06-ui-panels.js` | Dock framework (`DOCK`, `PANES`, `dockGo`), left sidebar (Tones / I-O / Theory), the Rig pane, right sidebar (tuner, meters, live analysis) |
| `07-ui-timeline-tab.js` | Canvas arrangement timeline and the tab editor |
| `08-ui-compose.js` | Song, Band and Export panes, Ultimate Guitar / ChordPro / MIDI / WAV writers and the submission lint |
| `09-ui-viz.js` | Fretboard, Visuals, Vision (webcam, MediaPipe) and Research panes |
| `09b-tx-engine.js` | Polyphonic transcription engine (pure DSP, no DOM) |
| `09c-tx-ui.js` | Transcribe pane: capture, review, apply, consensus, self-test |
| `10-main.js` | `boot()`, the frame loop, event wiring |
| `11-layout.js` | Workspace layout: tab order, floating windows, splitters, band strip; the **layout data** (twelve presets kept for the zoom switch and guided sessions, no longer shown in a picker), the **workspace menu** (`layoutMenu`: the sidebars, where panels live, show / hide, reset) and the **labelled edge tabs** (`edgeBuild`, `edgeSync`, `arrangeToggle`, `panelsToggle`; each sidebar's `.edge-rail` shows the open panel's name and, collapsed, lists its other panels) (the three journeys are added by `64-journeys.js`) (`LAYOUTS`, `applyPreset`, which sets the whole state so nothing leaks from the last one; `layThumb` draws the picker's wireframes); the **Monitor widgets** (`RCARDS`, `monShown`, `monChips`, `setCardHidden`; the frame loop in part 10 skips the drawing of any that are off) |
| `12-board.js` | Pedalboard v2: chain strip, per-pedal options, scenes, Stomp view, footswitch / MIDI bindings |
| `13-stage.js` | Stage: eight scenes (six looks, a prompter, you in front) with post effects, overlays, MIDI out; scene migration from the old defaults |
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

### Parts 25–49 (added from 1.4 to 2.2)

| File | Responsibility |
|---|---|
| `25-projects.js` – `27-reset.js` | Song library (IndexedDB), start card / library dialog / zoom, selective reset (see "Projects, origins, zoom and reset" below) |
| `28-about.js`, `29-guard.js` | About and credits; the last-line error guard that says, once in a while, that your songs are safe |
| `30-audio-control.js`, `41-io2.js` | The header Audio button and panel; the single **Connect** component (device, meter, Set my level, Hear myself, signal path, channel mapping) reused by the I/O panel, header and start card |
| `31-hum-engine.js`, `32-hum-ui.js` | Hum to Song: the on-device engine and the screens |
| `33-adapt.js`, `34-launch.js`, `35-neck.js`, `36-halo.js` | Adaptive studio, front screen and centre stage, the neck wired to everything, two more stage looks |
| `37-stage-rec.js`, `38-perform.js` | Record the stage (canvas + song audio to a video file); Perform |
| `39-export.js`, `40-sync.js` | Export and share (WAV, stems, MIDI, share page, bundle); folder sync: the studio kept in step with a chosen folder, recordings included, through part 74's engine (File System Access API) |
| `42-mixer.js` | Lane strips: 3-band EQ, one-knob compressor, sends, mute / solo, stem mix |
| `43-drop.js` | Drop anywhere: classify a dropped file (audio, lyrics, MIDI, song bundle) and ask the one question that matters |
| `44-balance.js` | Auto-balance: measure each lane, propose level and pan, apply as one undo step |
| `45-clips.js` | **Clips.** Every take carries a clip (`startSec`, `inS`, `outS`, `fadeIn`, `fadeOut`); move (whole beats), trim, fade, split, duplicate, delete, nudge, on desktop and on the phone clip bar. `tkKey` / `tkLead` name a take's buffers. The composite history `snap()` stores song + takes + stem mix, with `histBegin` / `histEnd` grouping a drag into one step |
| `46-render.js` | **Fast render.** `ofrRender()` builds the same graph a second time on an `OfflineAudioContext` (`ofrSwapIn` / `ofrRestore` set the live engine aside), posts plucked notes in 2.5 s batches confirmed by `ofrSync`, and renders as fast as the processor allows. `bounceFast()` adds the progress window and Cancel. `bounceMaster` tries it first and falls back to real time. The kill switch calls `ofrAbort()` |
| `47-midi-import.js` | **MIDI in.** `smfParse` (formats 0 / 1, running status, tempo and meter maps, text and lyric events), `smfParts` (melody / bass / chord / drum guesses), `smfBuild` (chords, key, lead tab, `.kar` words), and the track-picking window `smfOpen` |
| `48-keepsafe.js` | **Keep songs safe.** `keepRisk()` (is this a browser that may clear storage?), `keepCard()`, `keepOpen()`, `keepToast()` and the first-recording backup nudge `projNudge()`; requests persistent storage; offers Add to Home Screen steps and **Back up all songs** |
| `49-phone-extras.js` | Phone and tablet extras: the mix tiles (`mixOpen`), the files window (`filesOpen`) and the clip bar |
| `50-voice.js` | **Voice.** `VOX` (a pitch history fed by `voxTick()` from `anaTick`), the ribbon (`voxDraw`, also drawn over the Visuals), the window (`voxOpen`), range capture (`voxRange`), `voxPlan` / `voxTarget` / `voxMelody` (which keys fit), and `voxTranspose` (key, chords, `[chords]` in lyrics and tab frets, one history step) |
| `51-clip-range.js` | **Ranges.** `TKR` (the marked stretch), `tkrLane` (cut or silence in one lane), `tkrApply`, `tkrMark`, Shift-drag, and `PUNCH` / `tkrPunch` / `tkrPunchApply` (record only inside the stretch; `recBegin` / `recEnd` in part 03 honour it) |
| `52-heat.js` | **Fretboard heatmap.** `HEAT` (time, shared time and cents per string and fret), `heatLive` (called from `noteOff`; exact when the camera has the hand, otherwise shared across `heatCands`), `heatSongBuild`, `heatMap`, `paintHeat` (called from `paintFret` when the mode is Heatmap) and its controls |
| `53-backdrop.js` | **Performer backdrop.** `STG.pb`, `pbScene` (calm, section hue, smoothed loudness), `pbDim`, `pbFill`, `pbLowerGeom` / `pbLowerRect` (where the lower third sits, so a lens can stay clear of it), `drawLowerThird`, the Stage-pane card (including the Concert lens select) and the output-window tint. `stageFrame` in part 13 calls it |
| `54-concert.js` | **Concert.** `LX` (the show's state), `lxHit` / `lxFire` (the band's drum hits, queued from `drumStep` in part 03 with their audio-clock time and drained in `lxUpdate`), `concertDraw` (the visual dispatched from `stageExtra`: resolves the design, updates, performs, then the Teach overlay, strobe, vignette and scrim), the lenses (Teach: `lxRing`, `lxCard`, `lxMeters`, `lxNumeral`, `lxUpcoming`, `lxCaption`; Sky: `lxSky`, `lxSkyAdd`, `lxSkySave`), `lxMakeBand` (the room a lens may draw in), `lxSetLens` / `lxLensBar`, section kinds (`lxKind`) and the cue list `LX_PROG` |
| `55-monitor-views.js` | **Monitor ▸ Views.** `MV` and `monitorViewsCard`, `drawMonView`: the pitch wheel, spectrogram and scope on the Monitor tab, using the same `drawChroma` / `drawScope` as the Stage |
| `56-show.js` | **The show engine's state and designs.** Colour utilities (`lxHexHsl` with a chroma element, `lxAt`, `lxMix3`, `lxStep`), the six looks `SHOW_DESIGNS` (palette, rig, laser kit per section, motion, head patterns; `SHOW_ALIAS` maps the names 2.5 used), `lxProg` (the cue for a kind of section with the person's changes laid over it), the cue preview band (`lxPreview`) and `lxResolve` (a look plus the person's overrides, or the auto look for the Visuals tab), **comfort** (`LX_COMFORT`, `lxComfortKey`, `lxSetComfort`), the **governor** (`LXG`, `lxGovMeasure`: samples the finished picture, counts opposing brightness swings per second and eases `LX.gov`), the band's non-drum events on the audio clock (`lxEvt`, `lxFireX`: beat, bass, chord, lead), the per-frame brain `lxUpdate` (one clock `LX.pos`, laser kit and amount, palette from harmony, the once-a-bar blinder, adaptive lite mode) and the sparks and confetti |
| `57-lasers.js` | **Laser engine.** `lxLasers` and the eight patterns (`lzFan`, `lzCone`, `lzZipper`, `lzSheet`, `lzGrid`, `lzLissa`, `lzTunnel`, `lzBurst`): beams placed from `LX.pos` so they are locked to the bar, brightness swelling with real hits through a gate scaled by comfort and the governor, optional beat-stepped motion |
| `58-lights.js` | **The layers.** `lxStage` (gradient room, drawn small and scaled up), `lxHaze`, `lxWall` and `lxWallImage` (spectrum or a picture as a pixel wall), `lxBackdrop` and `lxLogo` (the person's pictures), `lxBeams` (moving lights and floor pools), `lxParticles`, `lxStrobe`, `lxScrim`, `lxVignette` and `lxPerform`, which draws them in order |
| `62-capture.js` | **Capture.** `capStart/capStop/capToggle` (count-in, loop the section, restore everything on stop, one Undo), `capOnset` (worklet attack or energy-rise fallback) opens a window, `capEval` reads the post-attack audio with the pre-attack spectrum subtracted, `capNotes` (harmonic summation over playable pitches, lobe-shaped cancellation), `capInterpret` (library shape or nearest fingering, chord name), `capPut` (writes into the bar playing, replace-per-pass), `capHeardNote` (single-note fallback with a same-note check). |
| `63-write.js` | **Write canvas.** Restructures the Tab pane into section chips, the Tab/Words/Both switch, the Capture button, the capture strip, the tab column, the words column and the fretboard strip (`wrFretBuild`, `wrFretPaint`, `wrFretPlace`); `writeFrame` repaints from the frame loop. |
| `64-goals.js` | **Goal workspaces.** `GOALS` (Songwriter, Performer, Creator Studio, Practice, Teacher, Full Rig): each a layout spec (added to `LAYOUTS`), a Create / Perform / Share step, a next goal, and its tools. `goalGo` (remembered in `CFG.ws`; old journey ids are aliases), `goalNow`, `goalShows` (lets the experience level allow the tabs a goal needs; Full Rig allows all), the `goalBar` row at the top of the dock (`goalBarBuild`, `goalSync` keeps the tools' on/off state), each goal's colour (`goalMark`, `--goal`), mission and steps, `goalPlace` (the bar at the top of whichever of panels / arrangement is on top), `workspaceOpen` (the ▦ dialog: goal cards with `goalThumb`, panels, show & float, reset), and the first-visit default (the Performer, on a computer; a returning visitor keeps their workspace). |
| `65-harmony.js` | **Harmony state** for the eight harmony looks. `HM_MODES`, `HM` (the chord sounding, `hmDiss` for how far each pitch class is from it: tone / colour / tension; the voice and guitar notes, resolution and tension times, onsets with their distance from the beat, the session record for the constellation and the painting), `hmUpdate` (once per frame), `hmClear`. A deliberately simple model; see the file header. |
| `66-looks.js` | **The eight harmony looks.** Registers them in `VMODES` (Harmonic Gravity, Improv Field, Voice & Guitar, Mood Colour, Chord DNA, Constellation, Rhythm Flow, Session Painting), per-look state in `HMX`, the draw functions (`HM_DRAW`, dispatched from `stageExtra` through `hmDraw`, which catches and warns once), the 1920 × 1080 painting render, `hmSave`, and the New session / Save picture buttons. |
| `67-audience.js` | **Audience view and the video take.** `AUD`, `audienceCard` (a Monitor widget, sixth in `RCARDS`), `audDraw` (draws the show to a small offscreen canvas with Mirror off, or copies the Visuals canvas when that tab is open; adds the screen's frame, its floor reflection and `audCrowd`), and `srecTakeBegin` / `srecTakeEnd`, which run the take recorder (`recBegin` / `recEnd`, part 03) beside the stage recording (part 37) so the armed inputs become a lane that starts where the video starts. |
| `68-kit.js` | **Creator and teacher kit.** `KIT`; Studio Replay (`kitKeep` holds the newest stage video, fed by the `srec:blob` event from part 37, or screen recording; `kitReplay`, `kitSave`, `kitShare`), `kitRecord` (stage video asking for MP4, Replay on stop), `kitThumb` (1280 × 720 PNG with the title), `kitScreen` (getDisplayMedia + the master and, optionally, the microphone), `kitNotes` (per-song lesson notes in `fw.lessons`), `kitInk` (annotation canvas over the page). |
| `69-journal.js` | **Progress journal and Welcome Back.** `JN`, `jnLoad` (the `fw.jn` record: `days` → `{t seconds, s sessions, i ideas}`, `heard`/`learned` chords, `songs` finished, `pairs` chord changes with the last 30 results, `last`, `focus`), `jnTick` (four times a second: activity, a session after a minute) and `jnStep` (chords held steady and chord-change windows, pure so it can be tested), `jnStreak`, `jnSum`, `jnBestPair`, `wbBoot`/`wbCard` (the first page for returning people, called from `boot()` in `10-main.js`), `progressOpen`. Hooks: `recEnd`, `capStop`, `humApply` call `jnIdea`; `xpEdit` marks an edit after a real key or tap. |
| `70-backdrops.js` | **Behind you.** `BK_MODES`, `VBACK` (Light Ribbons, Aurora, Warp Stars, Pulse Rings, Nebula, Skyline, also pushed onto `VMODES`), `bkTick` (eight smoothed bands, energy, the chord's hue via `bkHueFor` gliding at about a second, comfort-scaled time), `bkDraw` dispatched from `stageExtra`; `vzBare` keeps the pitch read-out and mini neck off them; `backTip` is the one-time camera tip. Plain 2D, no flashes: brightness only glides. |
| `70b-vidbg.js`, `72-agent.js` | Your own video loops behind you (`VBG`); the agent tools (`AGT`, `agTool`, `agentCall`) offered through WebMCP and `window.dailyStudio` |
| `73-build-egg.js`, `73b-secrets.js` | The build tag and the hidden line (a quote of the day from `EGG_LINES` in a fixed shuffled order, `eggDay`/`eggFor`); the secrets, their counter and the console note |
| `73c-backstage.js` | **Backstage** (for people who open the console). `backstage(word)` is the door: guest list only, the password is `BUILD`; `bksPass()` issues this browser's pass. `backstageOpen(room)` is the hub: the engine room (live numbers, scope, the rig chain with `FxUnit.lat()` per unit), performance (an FPS history, long tasks through `PerformanceObserver`), storage (`bksStorage`, `bksExport`), the event bus (`bus.emit` is wrapped and taps only while Backstage is open or the Labs log is on), the terminal (`BKS_CMDS`, `bksRun`), Labs (`DEV.make` from part 10 for `window.__daily`, the overlay, the bus log) and the hidden pages. `#backstage/<room>` and the Konami code open it |
| `74-github.js` | Your studio on GitHub, and the sync engine both it and a folder use (`studioSync(B, why)`: a place is `{st, base, head, read, commit, takeSong, local, after}`) |
| `61-looper.js` | **Loop & layer.** `LP` state, `lpWrap` (called from the `tick` wrap in `03-band` each time the loop comes round), `looperStart/Keep/More/Undo/End`, the strip (`lpHud`) and the window (`looperOpen`). Layers are ordinary takes recorded by the cycle recording in `03-band` (`REC.cycle`). |
| `60-guide.js` | **Guide.** Goals from the first page (`guideBoot`, `guideRoute`, `GD_GOALS`), the seven sessions (`GD_SESSIONS`: steps with a target, a `go` and a `done()` read from app state), the card (`guideStart/Stop`, `gdTick` every 400 ms, `gdPlace` keeps it off its target, `gdDrag`), first-open tab notes (`GD_HINTS`, `guideHint` on the `dock` event), the words list (`GD_WORDS`) and the Show preflight (`GD_PF`, `gdPfBlock`, ticked by `gdSniff` and a few hooks in 59-designer). Progress is in `CFG.guide` (`done`, `prog`, `hints`, `off`, `sess`). Finishing a first session calls `xpSignal(5)`, which is what adds tabs. |
| `59-designer.js` | **Show setup console** (the Stage tab). Pictures (`shAdd` reduces and stores them in IndexedDB under `stage/img/<id>`; `shImg`, `shRemove`, `shPrune`), the Visuals-tab auto look `lxAutoDesign`, the posters (`shPoster`), saved looks and look files (`shSaveLook`, `shUseLook`, `shExportLooks`, `shImportLooks`, and `shClean`, which lets only known, range-checked values in), the nine tabs (`shcLooks`, `shcRig`, `shcColour`, `shcCues`, `shcResp`, `shcPics`, `shcOut`, `shcScene`, `shcMidi`; state in `SHC`; changes are kept as differences in `ovr`), the output pipeline (`shBlackout`, `shFreeze`, `shTestPattern`, `shOutFrame`, called from the Stage frame in part 13), the live meters, `stgRestoreStarters` and the Visuals-bar button |

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

**Hidden developer pages.** `scripts/backstage-pages.mjs` writes `dist/backstage/` (a lobby, a source map built from the header comment of every part, your data read-only from IndexedDB and local storage, the console and agent API with the shell's commands taken from `BKS_CMDS`, and the changelog as a timeline) and `dist/humans.txt`. They are noindex, out of the sitemap and turned away in robots.txt; each has one inline script allowed by its hash, which shows the page only when the studio's settings in this browser hold a Backstage pass.

**Licences, notices and release gates.** `scripts/assemble.mjs` also writes `dist/legal/index.html` from `LICENSE`, `THIRD_PARTY_NOTICES.md`, `PRIVACY.md` and the two OFL texts, so the notices travel with the site. `scripts/verify-site.mjs` is the release gate for the deploy folder and finishes by running `scripts/audit.mjs`, which compares what is shipped (`dist/`, the lockfile, `src/`, `samples/`) with `docs/LICENSING.md`, the notices and the privacy statement: no runtime dependencies, permissive licences, every file registered, no audio or binary hidden in a page, every font and sample licensed, every host and network call site known, no over-claiming wording. A new network call, host, asset or dependency fails it until it is reviewed and documented.

## Extending

**Add a tuning.** Add `'Name (notes)': [e2, a2, d3, g3, b3, e4]` (MIDI numbers, low to high) to `TUNINGS` in `01-core.js`. It appears in the Song and Theory menus automatically.

**Add a pedal.** Call `defFx('id', 'Name', 'Category', [P(...), SELP(...), TOG(...)], ctx => ({ in, out, set(k, v) {…} }))` in `02-audio.js`, add the id to `RIG.order`, and (optionally) to presets. Defaults come from each parameter's `def`.

**Add a panel.** Append `['id', 'Name']` to `DOCK` in `06-ui-panels.js`, write `buildMyPane()` that appends to `PANES.id`, call it from `boot()` in `10-main.js`, and listen to `bus.on('dock', id => …)` to render lazily.

**Add a tour step.** Add an object to `tourStepsDesk()` (and `tourStepsPhone()` if it should appear on phones).

**Add a panel on phones.** Add its id to a group in `MGROUPS` (`18-mobile.js`).

## Testing

Full details are in [TESTING.md](TESTING.md). In outline:

* `npm test` boots the page in **jsdom** with a stubbed Web Audio layer, exercises exports, undo, presets and rendering, and fails on any uncaught error. It cannot hear audio.
* `npm run test:e2e` runs **every real-Chromium suite in parallel** (`test/run.cjs`): each `test/e2e-*.cjs` file starts its own static server, browser and contexts through `test/lib.cjs` (`suite(name, fn)`), so a failure names the file, and every file ends with a "no console, page or network errors" check. Name a few to run only those: `node test/run.cjs clips midi`. The suites that time drawing (`e2e-concert`, `e2e-show`) run on their own after the rest, and a file that fails beside others is run once more alone; if it then passes it is reported as flaky rather than failing the run (`STRICT=1` counts it as a failure).
* `npm run test:mobile` emulates a phone (portrait, small, landscape), tablets and a desktop window: layouts must not scroll sideways, the keypad writes tab, the More sheet and drawers work, the tour completes, long-press opens menus.
* `npm run test:stems` runs the separation DSP in Node on a synthetic mix with known stems and fails if SI-SDR falls below a floor.
* `npm run shots` regenerates the pictures in `docs/screenshots/` from the running app (`test/shots.cjs`), so the documentation cannot drift from the product.
* What no script can check (a real interface, camera, MIDI controller, Safari on an iPhone) is in [HARDWARE_CHECKLIST.md](HARDWARE_CHECKLIST.md).

## Design principles

1. **Local first.** No server, no telemetry, no account. The one thing that can leave the machine is the optional MediaPipe download, and only after a yes: `mpVision()` in `09d-camfx.js` waits on `mpConsent()` before it requests anything, so there is a single place to read and a single place to test. It is documented in `PRIVACY.md` and enforced by `scripts/audit.mjs` and `test/e2e-privacy.cjs`.
2. **Instrument, not toy.** Numbers are shown with their uncertainty and every analysis can be exported.
3. **One file.** The app must keep working when opened from disk, from CodePen or from any static host.
4. **No regressions.** New features are added beside existing ones; the end-to-end tests protect the core flows.

## Two-input recording (`02-audio.js`, `03-band.js`, `23-lanes.js`)

The browser opens one stream with up to two channels. `E.split` (a 2-way `ChannelSplitter`) feeds the **guitar** (`E.gL` / `E.gR` → `E.inSum` → rig) and the **vocal** (`E.vL` / `E.vR` → `E.voxIn` → `E.voxTrim` → analyser, optional monitor and `E.voxStrip` → the `vox` mix track). `setChannelMode` and `setVoxInput` set the gains so a channel given to the vocal is removed from the guitar (no bleed into the dry DI). `recBegin` taps `di`, `wet` and `vox` on the same clock; `recEnd` creates one take per armed lane (`kind: 'gtr' | 'vox'`). `scheduleTakes` plays every take with its own gain, pan, mute and solo; guitar takes can re-amp through the rig, vocal takes go through the vocal strip.

## Track on the transport

`trackStart(when, slot)` maps a transport slot to track time (`slot × slotDur() + trkT0()`, where `trkT0()` is the detected first downbeat) and calls `spPlay`; it is called from `play()` and again on every loop wrap, and `trackStop()` from `stopPlay()`. The arrangement draws the track and stems from a 20 ms envelope cache (`STM.envL`) at the bar grid's scale.

## Projects, origins, zoom and reset (parts 25–27, v1.4)

- **25-projects.js** — the song library. IndexedDB database `the-daily.studio` with stores `projects` (one record per song: metadata + song model) and `blobs` (`<id>/take/<takeId>/dry|wet|cam` as Int16 PCM, `<id>/track` as the original file). Autosave is debounced from the `song`, `takes` and `track` bus events and flushed on `pagehide`. A backing track is re-separated on open with `stemLoad(file, {restore:true})`. Also: a minimal ZIP writer/reader (STORE, plus `DecompressionStream('deflate-raw')` for reading), the bundle format (`song.md`, `arrangement.json`, `audio/*.wav`), import, and migration of a single autosaved song from earlier versions.
- **26-origins.js** — the start card (Clean canvas / Start from a song), the library dialog, the zoom control (`zoomSet('canvas'|'song'|'studio')`, which applies the Write or Record / Arrange layouts) and the song-bar buttons.
- **27-reset.js** — selective reset. `store.locked` blocks every write (the old bug was `beforeunload` re-saving after `localStorage.clear()`), a BroadcastChannel tells other tabs, then localStorage keys, the IndexedDB database and the Cache Storage / service worker are cleared and the page reloads on a clean address.
- Add `?debug` to the address to expose `window.__daily` for tests.
- Design rule: no accounts, no backend. Optional sync (for example to a GitHub repository, text first) is planned as a separate, opt-in layer on top of the bundle format.

## Appearance (part 05b-look.js, v1.6)

`applyAppearance()` resolves the mode (light, dark, or the system preference), picks the palette for that mode, applies high-contrast and colour-blind adjustments, fits the accent colour to the palette (`lkFit` raises or lowers lightness until a 3.4:1 contrast against the surface is reached), and writes every colour as a CSS variable on `<html>`. Shape and spacing come from `data-corners`, `data-density`, `data-surface`, `data-font` and `data-contrast` attributes styled at the end of `styles.css`. Canvases re-read the variables on the `theme` bus event. To add a palette, append an entry to `PALETTES`; to add a look, append to `LOOKS`.
