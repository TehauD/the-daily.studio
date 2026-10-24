# Changelog

All notable changes to the-daily.studio (earlier versions were released under the name FRETWORK). Versions follow [Semantic Versioning](https://semver.org/).

## 1.7.0 — 2026-10-24 — MVP 1, first production release

### Added
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

### Changed
- README, hosting and security notes describe the finished product; documentation screenshots show the current look.
- Palette contrast: Paper's muted text and every accent are fitted to meet WCAG AA against their surfaces.

### Fixed
- Accessibility (WCAG A/AA, checked with axe on all 15 palettes): labels on selects and zoom controls, keyboard access to scrolling timeline and chain regions, side-tab roles.

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
