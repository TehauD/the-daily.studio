# Changelog

All notable changes to the-daily.studio (earlier versions were released under the name FRETWORK). Versions follow [Semantic Versioning](https://semver.org/).

## 2.17.0 — 2026-10-31 — A tip jar: let your audience tip you

### Added
- **🎸 Tips** (`src/parts/39b-tip.js`): an artist's own tip link as a QR code in a small open guitar case. Paste a Ko-fi, PayPal.me, Cash App, Buy Me a Coffee, Patreon or Bandcamp page, or any `https` address (`ko-fi.com/name` gets `https://`; a `$cashtag` becomes a Cash App link), add a name and a message, and choose where it shows:
  - **on the Visuals**, so it is in every stage video and in the Audience view;
  - **on the Stage**, so the room can scan it from the projector or the pop-out window (it steps around the chord, tuner, song info and lower third);
  - **on share pages**, as a button and a code beside the player;
  - **on a printed sign** for a real guitar case, and **as a picture** (PNG) to post.
  It can show all the time or only between songs, in any corner, at three sizes. In the Visuals bar, the Stage bar and **Settings ▸ Tip jar**.
- **A QR code maker** (`src/parts/39a-qr.js`), with no library and nothing downloaded: byte mode, error correction level M, versions 1 to 40, the mask chosen by the standard's penalty rules. Every version was checked with an independent QR reader while it was written, and the codes drawn on the Visuals and the Stage scan back to the link.

### Safeguards
- **Links are made safe**: `https` only; `javascript:`, `data:`, plain `http` and links carrying a user name or password are refused. **Test the link** opens it in a new tab so the artist can check where it goes.
- **Nothing shows until the artist confirms** that it is their own link and that the payment is between them, their audience and the service they chose (the studio is not part of it, takes nothing, and is not responsible for the service, the payments or taxes). Share pages say the same beside the button.
- **The link stays in this browser's settings**: not in songs, song backups or project files, and **the AI agent tools cannot read or change it**, so an agent cannot swap in another payment link.
- The studio never opens the link itself and sees no payment. Terms of use gain a **Tips** section; the privacy statement lists the tip jar.

### Tests
- `test/e2e-tip.cjs` (35 checks): the codes match the fingerprints of codes checked with an independent reader; every module drawn in the case matches the link; unsafe links are refused; nothing shows before the confirmation; the dialog, the corners, stepping around the neck and the lower third, "only between songs", the Stage, share pages (escaped, and absent when turned off), the printed sign, the picture, Settings, the agent tools not seeing the link, and the dialog on a phone.

## 2.16.1 — 2026-10-31 — A smaller page and steadier tests

Maintenance only: nothing a person can see or use changes.

### Changed
- **The page is about a fifth smaller.** `index.html` now carries a minified copy of the script and stylesheet: 1766 kB → 1424 kB (612 → 538 kB compressed, which is what a visitor downloads). The minifier (`scripts/minify.mjs`) needs no packages and only removes comments, indentation and the spaces around punctuation: line breaks stay, no name is shortened, and every string, template and regular expression is copied byte for byte. The build compiles the minified script and compares it token by token with the readable one, and stops if anything but whitespace differs. The CodePen panels keep the readable code; `node scripts/build.mjs --pretty` writes an unminified `index.debug.html` for debugging.
- **A size budget**: the release gate now also fails if `index.html` passes 700 kB compressed (alongside the 2 MB limit), so growth is a decision, not drift.
- **Steadier tests.** The frame-rate check in `e2e-show` measured the wrong thing on a slow machine (a machine that already draws near 30 frames a second "failed" the 30 fps cap); it now checks that the cap holds near 30 and that drawing goes on. The drawing-cost check in `e2e-concert` uses the 25th-percentile frame, so a frame delayed by other work does not decide it. The start-route checks in `e2e` and the scroll check in `e2e-goals` wait until the app is ready instead of sleeping a fixed time.
- **The test runner** (`test/run.cjs`) runs the suites that time drawing on their own after the rest, and runs a file that failed beside others once more alone, naming it as flaky if it then passes (`STRICT=1` counts that as a failure).
- **CI** uses `actions/checkout@v5` and `actions/setup-node@v5` (the v4 actions run on a Node version GitHub is retiring).

## 2.16.0 — 2026-10-31 — More for AI agents, and an agent layer built to last

### Added
- **Three agent tools** (`src/parts/72-agent.js`): **`set_visuals`** (the look, speed, size and zoom; never the camera), **`perform`** (open or close Perform and pick its display: shapes, big or sheet; never the microphone or recording) and **`get_chord_shape`** (the frets of a chord for the song's tuning and capo, lowest fret, barre, and other ways to play it; the song's chosen voicing first). `get_studio_state` now also gives the visuals, Perform, the API version, the app version and the build. 19 tools in all.
- **`window.dailyStudio.describe()`**: the API version, app version and build, how WebMCP is used, whether agent access is on, the aliases and the limits.
- **[docs/AGENT_API.md](docs/AGENT_API.md)**: the tools, answers, error codes, limits and versioning, for people building agents.

### Changed: hardening and future-proofing the agent layer
- **Answers** carry `structuredContent` (the data as an object) as well as text, for MCP clients that read it.
- **Errors** carry a code an agent can act on: `unknown_tool`, `disabled`, `loading`, `invalid_input`, `busy`, `timeout`, `rejected`.
- **Inputs** are copied before use (nothing the agent holds can change mid-call), must be an object, and are checked more strictly: list items, minimum lengths and a cap on text size.
- **Changes run one at a time**, in the order they arrive; reads do not wait. **Limits**: 20 changes and 40 reads a second (more are answered `busy`), 20 s per call, answers capped at 250,000 characters.
- **A burst of changes is one note** on screen ("… and 2 more") instead of a stack of them.
- **WebMCP**: each tool is registered on its own, so one refusal does not lose the rest; a name the browser already holds is taken back through `unregisterTool` and offered again; a `navigator.modelContext` that arrives after the page (an extension, say) is picked up; tools carry a title and `openWorldHint: false`.
- **A contract that catches breaking changes**: the API version (`AG_API`, now **2**) rises only when a tool is removed or renamed or a required input changes; renamed tools keep their old names in `AG_ALIAS`; `test/agent-contract.json` lists the published tools and their required inputs, and the tests fail if one disappears or changes.
- `test/e2e-agent.cjs` grows to 52 checks (the contract, structured answers and error codes, the three tools, ordering, the one note, the rate limit, late and duplicate WebMCP).

### Limits
- WebMCP is still a draft and few browsers and agents support it; both of its forms are handled, and the contract keeps the tools stable for agents written against them. Checked with stand-ins for `navigator.modelContext`, not a real browser agent.
- Desktop MCP clients reach the tools through a browser extension that relays WebMCP, not directly: the studio has no server.

## 2.15.0 — 2026-10-31 — AI agents can use the studio; AI search welcome, AI training not

### Added
- **Agent tools (WebMCP)** (`src/parts/72-agent.js`). The studio offers 16 tools to an AI agent in the browser through `navigator.modelContext` (`registerTool`, or `provideContext` in earlier drafts), each with a description and a JSON input schema: `get_song`, `get_studio_state`, `get_key_chords`, `load_chord_sheet`, `set_song_details`, `transpose_song`, `edit_section`, `add_section`, `remove_section`, `set_band`, `transport`, `open_workspace`, `list_songs`, `open_song`, `export_song` and `undo`. Reading tools are marked read-only and `remove_section` destructive. The same tools are at `window.dailyStudio` for agents that drive pages with scripts.
- They call the same functions as the buttons, check their input against the schema (a wrong key, an unknown chord or an unknown parameter gets a plain answer naming it), and every change is one undo step with a 🤖 note on screen. `transport` plays and stops but never records, and says when the browser needs a click before it can make sound.
- **Never offered**: the microphone, the camera, recording, deleting songs and Settings.
- **Settings ▸ Workflow ▸ Let AI agents in this browser use the studio** (on by default) withdraws the tools and refuses calls.
- **Transpose the whole song** (`songTranspose`, used by `transpose_song`): bar chords, slash basses, the chords inline in the lyrics, the key and the tab. F#/Gb major and D#/Eb minor keep the sharps or flats the song already used.
- `test/e2e-agent.cjs` (34 checks, with a stand-in `navigator.modelContext` in both its forms).
- **Phones use the whole screen.** Settings, Help, Workspace and Appearance open full-screen on a phone (they were a sheet that stopped short of the right edge, because the browser's own dialog width limit won): a one-line header with a 40 px close button, the section chips, and each section's controls across the full width without a boxed card around them, clear of the notch and the home bar. The welcome screen goes edge to edge with a smaller logo and headline, the six goals two to a row with two-line descriptions, and **Begin in the studio** full width above **Try the demo song** and **I know my way around**, so every choice is on the first screen (checked at 412×915, 390×844 and 360×740). `test/e2e-mobile-fit.cjs` (21 checks).
- **Speed, size and zoom for the visuals** (`src/parts/09e-vz-adjust.js`): **🎚 Speed · size · zoom** in the Visuals bar and the Stage's scene bar. Speed (¼×–3×) scales the visuals' clock, so every look moves faster or slower; Size (½×–2½×) sets the hexagons of Hex Resonance and the pulse grid; Zoom (1×–3×) pushes in on the middle of any look. Applied wherever the visuals are drawn (Visuals tab, Stage, Perform, Audience view), remembered, with Reset; the camera, chord, words and neck are not scaled. `test/e2e-vz-adjust.cjs` (10 checks).
- **Audience view is just you and the show**: the crowd silhouettes, the stage frame, the floor reflection and the **⤢ Taller** button are gone; the picture fills the card, so you can watch your expression while you record.
- **Perform has three displays** (the **Display** button, remembered): **◫ Chords & shapes** (the default) puts a panel beside the lyrics with the shape of the chord being played and the next one, for the song's tuning, capo and chosen voicing, with the frets under each and the chords after that; **◼ Big chord** is the look it had; **☰ Lyric sheet** drops the big chord for larger lyrics with more lines and their chords over the words. On phones the lyrics are sized to the width, show the line being sung and the next two, and no longer run under the buttons. `test/e2e-perform-views.cjs` (17 checks).
- **The version and build code** in the very bottom-right corner of Perform and at the end of the status bar (*v2.15.0 · build xxxxxxx*). The build fills in `VERSION` from package.json and a build code from the bundle's own hash (the same source always gives the same code, so `build --check` still holds). Help ▸ About had been showing v2.12.0; it now shows the real version.
- A small surprise for whoever finds it.
- **Share one track, or the video, lightly.** A recorded lane's ⋯ menu has **↗ Share…** (and a clip's options **↗ Share clip…**): the track becomes a small M4A (Opus where M4A cannot be made), made silently in real time with a progress bar and Cancel, and opens in Studio Replay as *Share a track* with **⇩ Save**, **↗ Share…** (the device's share sheet) and **🔗 Share page**. Studio Replay has **🔗 Share page** for videos too. A share page is one HTML file with the recording inside it, a player, and the words with their chords over them, lit in time; a track's page keeps only the sections it covers, and a stage video's page is timed from where the song was when recording began. Put it on any web host to get a link or an `<iframe>` embed. No server, no upload, nothing new to load. `test/e2e-share.cjs` (24 checks).
- **You are responsible for what you share.** Before the first share on a device (↗ Share…, a share page, or Export ▸ Share page) the studio asks you to confirm that you own the content or have permission to share it and accept responsibility for sharing it; a notice stays in the share window every time; every share page says the person who shared it is responsible for it and that the-daily.studio does not host, publish or review it. New **terms of use** (`TERMS.md`, first on the legal page at `/legal/#terms`): what you make is yours, you are the publisher of what you share, share only what you have the right to, AI agents you run act for you, the app comes without warranty and its makers are not liable for what you share. Linked from the notice, the question, Help ▸ About and PRIVACY.md.
- Share pages place each chord over its own word (a chord-and-words segment each), so the chords line up in any font, and their lines follow the chords written in them, as on the stage.
- **Chords over the words while you play** (`src/parts/13b-lyrics-live.js`). The stage's lyric line, the performer lower third and 🎤 Perform show the line being sung with its chords above the words, each over the syllable it was written over (as on the chord sheet), the chord being played lit and underlined and the ones already played dimmed. On the stage the corner chord gives way to this while the line carries chords; the next line shows dimmed underneath with its chords, and on the last line of a section it is the next section's first line.
- **The line on screen follows its chords.** A line written with E, B, F#m and A is on screen while those bars play, instead of each section's lines sharing its bars evenly. A chord held for two bars stays lit for both; a line with no chords of its own takes its turn while the chord before it is held; a section whose lyrics carry no chords, or whose bars were changed away from the written chords, shares its bars as before. `test/e2e-lyrics-live.cjs` (15 checks).

### Changed
- **robots.txt**: AI search and answer bots that cite and link back (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User) are named and allowed; crawlers that collect pages for AI training (GPTBot, ClaudeBot, anthropic-ai, Google-Extended, Applebot-Extended, CCBot, Meta-ExternalAgent, Bytespider, cohere-training-data-crawler, Diffbot) are asked to stay away. Search engines are unchanged. `verify:site` reads the robots groups and checks all three.
- PRIVACY.md says what agents can and cannot do, and that what an agent does with the song text it reads is up to that agent.
- **About** (Help ▸ About): the story is rewritten in Tehau's words, from a guitar at five to why the-daily.studio exists, signed -Tehau.

### Fixed
- A chord line above a line that already has its own `[Am]` chords is kept as its own line, instead of being merged into it with the chords doubled.

### Limits
- WebMCP is new: browsers and agents that support it are few, and the API may still change; both of its current forms are handled. Tested in a headless browser with a stand-in, not with a real browser agent.
- robots.txt is a request. Crawlers that ignore it are not stopped by it.

## 2.14.0 — 2026-10-31 — Paste a chord sheet and play it

### Added
- **Chord sheets become songs** (`src/parts/24b-chordsheet.js`). Paste a song's chords and words, the way tab sites and songbooks write them, and it becomes a song the studio can use: a section for each heading, a bar for each chord, the key read from the chords, the words with each chord over the syllable it was over, and a guitar part written into the tab. The band plays it at once; Write, Theory, the Fretboard and Perform all follow it.
- It reads **chords over words**, **inline chords** (`[Am]words`), **ChordPro** (`{title}`, `{key}`, `{tempo}`, `{c: …}`, `{soc}`/`{eoc}`), **chord-only lines** with `|` bar lines and `x2` repeats, and **`Capo:`, `Key:`, `Tempo:`, `Time:`** and **`Title - Artist`** lines. Slash chords, 7ths, 9ths, sus and add chords are kept as written; a chord the app cannot play becomes the nearest simpler one (a sus2 never turns into a sus4), and the preview says which.
- **Choices before loading**: a new song (the default; the current song stays in ☰ Songs), replace this song's sections, or add after them; each chord 1 bar, 2 bars or half a bar; the key (from the chords, or pick one); the guitar part (any of the tab fill patterns, or none). With no title in the sheet, the first line of the chorus is offered.
- **Ways in**: ☰ Songs ▸ **🎸 Paste a chord sheet…**, **🎸 Paste chords** in the Songwriter workspace, and the existing **📋 Paste lyrics** box, lyric boxes and dropped .txt files, which switch to the chord sheet import when the text has chords in it.
- `test/e2e-chordsheet.cjs` (37 checks, on invented sheets).

### Limits
- ASCII tab in a sheet (`e|--0--3--|`) is recognised and left out; the tab is written from the chords. How long each chord lasts is your choice (1 bar, 2 bars or half a bar for the whole sheet), because chord sheets do not say; a line with `|` bar lines keeps its own bars.
- Checked with invented sheets in a headless browser. A sheet in an unusual layout (chords and words on the same line without brackets, or chords in a proportional font that no longer line up) may place chords a word early or late; the bars are still right.

## 2.13.1 — 2026-10-31 — Hearing yourself through a Focusrite, and voice on input 1 by default

### Fixed
- **“Hear myself” was silent for a microphone.** It only switched on the guitar; the vocal needed a second switch (the vocal lane's 🎧, off by default), so with a mic on the interface nothing came out. Hear myself now carries the guitar **and** the vocal. The vocal lane's 🎧 and *Hear vocal* in I/O ▸ Channels still turn the vocal alone on or off, and the kill switch turns both off.
- **The output you chose was not used after a reload.** The output device (a Focusrite, say) was saved and shown in I/O, but the engine started on the system default output, so the sound went somewhere you were not listening. The saved output is now applied when the engine starts. An output that is gone, refuses, or does not answer within 4 s falls back to the system default with a message, instead of leaving the app silent.
- **An input the engine could not take left the audio half-connected.** Firefox refuses an input when the engine runs at a sample rate it did not choose (Settings ▸ Sample rate other than Auto). The device stayed open, nothing came through and the error escaped. Now the input is released, the engine switches to Auto and reconnects, and if it still cannot, it says what to do.

### Changed
- **A Focusrite starts as voice on input 1 and guitar on input 2** (Scarlett, Solo, Clarett, Vocaster and other Focusrite names): the mic / XLR is the vocal, the Inst jack the guitar. It stays that way until you choose otherwise in I/O ▸ Channels (a preset, an input's menu, ⚡ Find my guitar or the vocal lane's input), and from then on your choice is kept. Other interfaces are unchanged.
- `test/e2e-monitor.cjs` (18 checks): Hear myself and the vocal, the kill switch, the Focusrite default and keeping your choice, the saved output and its fallback, and an input the engine refuses.

### Limits
- Checked in a headless browser with a simulated input and simulated device names, not with a real Focusrite. Which physical jack the browser calls input 1 depends on the interface's driver; on the Scarlett range input 1 is the left jack.

## 2.13.0 — 2026-10-30 — Workspaces built around what a musician wants to do, and one dialog for the header's buttons

### Added
- **Six goal workspaces** (`src/parts/64-goals.js`, replacing `64-journeys.js`) in a row at the top of the panels: **🎸 Songwriter**, **🎤 Performer**, **🎬 Creator Studio**, **🎼 Practice**, **🎓 Teacher** and **⚙️ Full Rig**. Each is a complete layout (tab strip, open panel, sidebars and what is in them, arrangement height, Monitor widgets) plus a row of the tools that goal uses, one click each. Every panel stays under ☰ and ▦; a goal only decides what shows first.
- **Create → Perform → Share**: the three steps sit at the right of the row, lit for the goal you are in, and each goal ends with the button to the next one (Perform it → · Share it → · Write the next one →).
- **The first visit on a computer opens the Performer**, so the shortest route to a shareable performance is ⏺ Record video, play, ■, Save. A returning visitor keeps the workspace they had; *I know my way around* opens the Full Rig.
- **Studio Replay** (`src/parts/68-kit.js`): the newest stage video or screen recording plays back in place, with Save, Share (the device's share sheet, only when pressed), Thumbnail from this frame, and Record again.
- **MP4 first** for videos recorded from the Performer and Creator Studio (`srecMime(audio, mp4)`), where the browser can make it; other recordings keep WebM first, as before.
- **Thumbnail**: a 1280 × 720 PNG of the stage or a Replay frame with the title, key and tempo.
- **Teacher tools**: **Annotate** (ink over the whole page, five colours, Undo, Clear; the ink stays when you are done), **Lesson notes** (per song, kept in `fw.lessons`), **Record screen** (getDisplayMedia, with the studio's sound and, if allowed, the microphone; opens in Studio Replay).
- **Practice tools** on the row: Loop, Metronome, −5 / +5 BPM with the tempo shown, Scales (Theory) and Chords (Fretboard).
- `test/e2e-goals.cjs` (44 checks: the goals, their shapes and colours, the four dialogs, Appearance's mode-first palettes, the kit).
- `test/e2e-harmony.cjs` checks *New session clears* in the same call as the clear (it raced the simulated voice before).
- The site's `Permissions-Policy` header now names `display-capture=(self)` alongside the microphone, camera and MIDI.

- **One dialog for the header's buttons** (`src/parts/05c-hub.js`): **▦ Workspace** (was a popover), **◐ Appearance** (was a side drawer), **⚙ Settings** and **? Help** now open the same modal: a header with an icon, a line saying what it is for and ✕; the sections listed on the left (chips on a phone); each section a card in one scrolling column that the list follows. Settings is regrouped into Appearance, Workflow, Music, Audio engine, Recording & practice, Export, and Songs & data; Help into Get started, Shortcuts, Your work, Latency and About.
- **Appearance: light or dark first.** The mode switch comes first; a dropdown under it shows the palette in use and opens to only that mode's palettes (8 light or 9 dark; System shows a daytime and a night dropdown). Looks are filtered to the mode too. The same switch and dropdown are at the top of Settings.
- **▦ Workspace shows the goals as cards**: each with its colour, step (Create, Perform, Share), mission, a picture of its shape, and what goes where.

### Changed
- **The goals are distinct workspaces, not tab filters.** Songwriter is a notebook (Write in Both, Theory left, no right sidebar, the arrangement a strip); Performer a stage (Visuals large, Tones, Tuner and Levels); Creator Studio an edit bay (the picture, the Audience view and Views beside it); Practice a practice room (the Fretboard large in the middle); Teacher a whiteboard (the arrangement on top, Write below, the Fretboard beside, lesson notes open). Each has a colour (on the goal bar, its main tool and the open tab), a mission with three steps, and its main tool highlighted. The goal bar stays at the top of the centre whichever way round the workspace is.
- Choosing a goal leaves the Canvas view, so the workspace is always visible; the first-visit default does not.
- **Play, Create and Learn** (2.9) are replaced by the goals; `journeyGo('play' | 'create' | 'learn')` callers now use `goalGo`, and the old ids are aliases (Performer, Songwriter, Practice). The guided sessions open the Performer and the Songwriter.
- The **Practice layout** is now the Practice goal (Theory on the left for scales, the Fretboard on the right). The layout list is Studio, the six goals, Write, Arrange, Record, Tone, Show, Focus, Classic.
- A brand-new visitor's simple tab strip is the Performer's: Visuals, Rig, Band, Stage, Save & export.
- Part 37 emits `srec:blob` with each saved stage video so Studio Replay can keep it.

### Limits
- Whether the file is MP4 or WebM is the browser's choice: recent Chrome, Edge and Safari record MP4; Firefox records WebM. Replay says which you got.
- Screen recording needs a desktop browser with `getDisplayMedia`. Only the newest recording is kept for Replay, in memory; close the page and it is gone unless you saved it.

## 2.12.0 — 2026-10-29 — Welcome Back, a progress journal, labelled panel tabs, hexagon colours and six looks that sit behind you

### Added
- **Welcome Back** (`src/parts/69-journal.js`): the first page for someone who has been here before, in plain text. *Last practiced* (“2 days ago”, “3 months ago (Jul 30, 2026)”), *Current streak*, *Working on* (a pencil changes it: “90s Alternative Guitar”), *Latest recording*, *Progress* (“G → C changes now 90% on time, up from 30%”), and a one-line summary of the year: **Played 87 sessions · Learned 14 chords · Recorded 23 ideas · Completed 4 songs**. After a long gap it says how long it has been, kindly, and the streak reads “Starts again the next time you play · best so far 5 days” rather than a zero. The main button becomes **Pick up where I left off** and names the song. First-time visitors still see the goals and the demo, not this.
- **A progress journal**, kept only on this device (`fw.jn`): counts and dates, never sound or the notes you played. A **session** is a visit with at least a minute of playing, recording or editing in it (a page that is only open counts nothing; an edit counts when a key or tap just came before it, not when the app loads a song). A chord is **learned** once the app has heard you hold it steady five times. **Ideas** are takes you record, hum-to-song and Capture runs. **Completed songs** are the ones you mark finished (Songs menu ▸ Mark this song finished, or in My progress). A **chord change** counts as a try when you were holding the old chord as the song moved on, and as a hit when the new chord was heard within two beats; Progress shows a change only after five tries, and “up from” only after twenty.
- **My progress** (Songs menu, the phone’s More sheet, Settings ▸ Data, and Welcome Back): four counts for the last 90 days, this year or all time; a twelve-week strip, a square a day, darker for more minutes; the chord changes with how often each landed; the chords learned; *Working on*; **Mark this song finished**; **Download my journal** (JSON) and **Erase my journal** (asks twice; songs and recordings are untouched).
- **Hexagon colours you choose.** The Visuals bar shows a row of swatches while Hex Resonance is on: *Match the theme* (the default; it follows light / dark and your accent colour), **Dark green**, **White**, **Ocean**, **Ember**, **Violet**, **Mono**, **Blush**, **Daylight**, and **Pick your own**: three colour pickers for the background, the cells and the gold cells. The start screen uses the same choice. Saved choices of “light” and “dark” from the first 2.12 build still mean White and Dark green.
- **Behind you**: six backdrops made to sit behind the camera cut-out (`src/parts/70-backdrops.js`): **Light Ribbons**, **Aurora**, **Warp Stars**, **Pulse Rings**, **Nebula** and **Skyline**. They have their own labelled group in the Visuals bar and are also in the stage designer's list of looks, full screen and recordings. Set Camera look to “Me in front (green screen)” and you stand inside the picture. The colour follows the chord (C rests on blue; each fifth turns the hue 30°, gliding over about a second), the parts follow the sound, and the pace follows the comfort setting (Calm moves at about half the speed). Nothing flashes: brightness changes only by gliding, and rings and sweeps fade over seconds. The first time you pick one with the camera dimmed behind the visuals, a one-time tip says how to put yourself in front.
- `test/e2e-journal.cjs` (67 checks), `test/e2e-backdrops.cjs` (13 checks) and screenshots `78`–`84` and `73-welcome-back`, `74-welcome-back-light` and `75-my-progress`.

### Removed
- **Video 2086** (`68-video86.js`, tried in 2.11), **String Field**, **Ridgeline**, **Chord Landscape** and **Ecosystem**. They are out of the Visuals bar, the ✦ Look cycle (now Hex Resonance, Concert, Fifths Halo, Prism) and the stage designer. A saved choice of any of them, or a stage scene using one, opens as Hex Resonance. Eight harmony looks remain (was ten). The Audience view and the video take (2.11) stay; the screenshot `71-video-2086` is gone.
- **The twelve preset layouts** are no longer offered in the ▦ menu (no picker, no “Your layouts”). The layout data stays inside the app for the Canvas | Song | Studio switch and the guided sessions.

### Changed: a simpler ▦ menu, and labelled tabs on every panel area
- The **▦ menu** is now only about where panels go: the sidebars, show / hide or float for each panel, where panels live, and a reset. **Light / Dark / Auto** lives in **Appearance** (it was repeated here) and **Experience** (Automatic, Simple, More tools, Everything) stays on the **Tools** button. Experience changes which tools are offered, not how the studio works, so it is no longer presented as a layout choice.
- **Labelled edge tabs** (desktop), like the journal's tabs. Each sidebar has a vertical tab named for the panel that is open (*I/O*, *Monitor*, *Theory*…): click it to collapse the sidebar. While a sidebar is collapsed its edge lists the panels that live there, so one click opens exactly the one you want. The divider between the arrangement and the panels carries **Arrangement** (collapses it to the transport) and **Panels** (collapses them to their tab strip). The state is remembered. Phones and tablets keep their drawers.
- `test/e2e-view.cjs` (25 checks); `e2e-workspace`, `e2e-harmony` and `e2e-video` updated; screenshots `76-view-menu` and `77-edge-tabs`.

### Changed: white or dark-green hexagons, as originally designed
- The hexagon field now comes in **both** looks. The start screen follows its Light / Dark switch with a **white field (soft sage and gold cells)** or the **dark-green field**; before, “Light” still showed the dark field behind a light card. **Hex Resonance** in the studio does the same: it follows the theme by default, and the colour swatches in the Visuals bar (shown while Hex Resonance is on) pin one regardless of theme. Note and chord text switches to dark ink on the white field.
- Resetting “Notebook & version history” is now “Notebook, history & progress journal”.

### Honest limits
- The six backdrops are checked by reading canvas pixels in a headless browser (each paints, each moves, the hue follows and glides, brightness never jumps in Calm or Standard, Calm is slower). Whether they look good behind a real person, or composite well with your own camera and lighting, is for you to say; the cut-out itself still depends on the optional segmentation model.
- The hexagon colour swatches and the custom pickers are checked for what they paint, not for taste or for contrast on every combination: a custom background close to the cell colour will be hard to read.
- The edge tabs are checked for position, state and behaviour in a headless browser, not for how easy they are to find or whether they get in the way of a real hand on a real screen.
- Checked in a headless browser with **invented history and simulated chord input**, not months of real use and not a real guitar. The counts and wording are tested; whether the numbers feel right to a person over 90 days is for a person to say.
- **Chord detection is a guide.** “Learned” and chord-change accuracy depend on the app hearing the chord correctly. With speakers instead of headphones the band can be heard as you, and a change can count as landed when it was the band. Only the first chord of a bar change is judged, and a change you did not play along with is not counted against you.
- The journal lives in this browser. Clearing site data, a private window or a browser that evicts storage (Safari after a week away) can erase it; **Download my journal** keeps a copy. It is not part of the song bundles or the folder backup.
- A streak is days in a row with at least a minute of activity. A single missed day ends it; the best run is kept.

## 2.11.0 — 2026-10-28 — Video 2086, an Audience view, and your playing from the video lands in the arrangement

### Added
- **Video 2086** (`src/parts/68-video86.js`), a look in the Visuals bar (third, after Hex Resonance and Concert) and in the ✦ Look cycle: music television as it might have grown up, made from your song. A **corridor with a rib for every bar**: the ribs ahead of you are the chords still to come. A major chord is wide and arched, a minor one narrower and lower, a dominant twists, a diminished one pinches in and sags, a suspended one stands tall (and is drawn dashed), and the colour follows the chord's place on the circle of fifths. **A chord change makes the room shudder.** The **lyric line being sung** flies at you as giant chrome lettering (with no lyrics, the chord and the section name do). **Every drum hit the band plays bursts into outlined shapes** (kick: rings and hexagons; snare: shards; hats: sparks; toms: squares). The **chord's notes join up as a neon constellation** in the portal at the far end, the last chord's fading behind it, and notes you play outside the chord flare as stray stars. **Guitar notes paint glowing trails** coloured by the note, which drift away into the room. Memphis furniture (triangles, squiggles, rings, wire cubes) is chosen by the kind of section. With no song playing, the room is built from the chords you play and streams toward you. A lower third (song, performer, section, chord) slides in at each new section, with scan lines and a small station bug. It is named for the era and uses nobody's logo or artwork.
- **Audience view** (`src/parts/67-audience.js`): a Monitor widget that shows the show the way the room sees it: the visuals on a screen, you in front of them from the camera, **not mirrored**, and a crowd's silhouettes at the bottom lit by the screen. It has its own camera button, the Camera look choice and a Taller toggle. It draws its own small copy of the show, so it works while you are on the Tab or Write panels, and copies the Visuals tab's picture instead when that is open. It is in the chooser (it starts out of the way) and in the Record layout.
- **Your playing from the video goes into the arrangement.** Recording the stage as a video now also runs the take recorder: what comes in on the armed guitar and voice inputs becomes a lane in the arrangement, starting where the video started (for *The whole song, from the top*, at the song's first beat, not the count-in). It is the same take as pressing Record, with the same input delay correction. A tick box in the Record menu turns it off, the kill switch throws the video and the take away together, and **Undo** takes the lane out. The band is not recorded into it, because it is already in the arrangement.
- `test/e2e-video.cjs` (42 checks) and screenshots `71-video-2086` and `72-audience-view`.

### Changed
- Video 2086 is in the ✦ Look cycle: Hex Resonance, Concert, Video 2086, Fifths Halo, Prism.
- The Monitor widgets have a sixth entry (older saved layouts get it hidden, not forced on).

### Honest limits
- Checked in a headless browser with a fake camera, a fake microphone and simulated notes and drum hits, **not real hardware or real playing**. How Video 2086 reads with a real band is for a person to judge, and the checks cannot say whether it is to taste.
- The Audience view is an illustration of the audience side (a drawn crowd), not a view from a real room. The person cut-out for “Me in front” needs the one-time MediaPipe download the Camera look already asks about; without it you get the edges-in look.
- What the video take records is the **armed inputs**. If nothing is armed, the guitar lane is armed for you. If the input is not connected, only the video is recorded. With the monitor on and a speaker in the room, the input can pick up the room as well as the instrument, as it does for any take.
- Light comfort applies to Video 2086: **Calm has no screen flash** and slower, smaller bursts; flashes are never closer together than the comfort gap (three a second at most). That is an engineering safeguard, not a medical guarantee. Lasers and lights elsewhere are a screen simulation (no DMX or ILDA).

## 2.10.0 — 2026-10-28 — The hexagon is the default again, and ten ways to see harmony

### Changed
- **Hex Resonance is the default look again**, first in the bar, drawn like the start screen: a soft glow behind a field of hexagons, with a few warm gold cells. **Concert** is still there, second in the bar. Everyone's look is reset to Hex **once** on first opening 2.10 (the reset is keyed on a stored version, so it does not repeat). Choose any other look afterwards and it stays chosen.
- **✦ Look** and the favourites list start with Hex, then Concert, Fifths Halo and Prism.

### Added: ten harmony looks (`src/parts/65-harmony.js`, `src/parts/66-looks.js`)
All ten draw from one small model of the chord that is sounding (the song's, else the one heard, else the key's): each of the twelve notes is a **chord note**, a **colour** or **tension**. They are in the Visuals bar and in the Stage designer's list, and they work full-screen.
- **Harmonic Gravity**: the chord is a sun; chord notes orbit close, colours further out, tense notes sit far off in red. Your note pulls toward or away from the centre, with a plain sentence about it.
- **Improv Field**: a map of the twelve notes (safe, character, tension) with a trail of what you played; a tense note that moves to a chord note is marked as resolved.
- **Voice & Guitar**: two swarms, one for the voice and one for the guitar. They draw together when the notes agree and push apart when they clash. With one input, the line you sing or play is the voice.
- **Chord Landscape**: the song's chords become places (mountain, forest, lake, canyon, dunes, crater, meadow and more by chord quality), and a walker moves along them as the song plays.
- **Mood Colour**: the colour and light follow the chord (warm gold for major, blue for minor), with a bloom when tension resolves and lightning on dominant and tense moments. Lightning follows the Light comfort setting and never comes closer together than its gap; **Calm has none**.
- **Chord DNA**: each chord is a flower whose petals and symmetry come from its notes; chords played in this session gather in a row.
- **Constellation**: a star for each steady sung note, flat to the left, sharp to the right, brighter when in tune; stars that are close in time are joined.
- **Rhythm Flow**: a surface of waves where each note you strike makes a ripple placed by its position in the bar; the downbeat is large, off-beats make whirlpools, rushing and dragging stir the water, and a steady groove draws calm streamlines.
- **Ecosystem**: creatures by note class (gold lights, teal jellyfish, red thorns), colonies per chord, a plant that grows each time a four-note phrase repeats, and a climate that follows major or minor.
- **Session Painting**: the session painted as it goes (height is pitch, colour is harmony, speckle is timing, stroke weight is how hard you played). **New session** clears it and **Save picture** writes a 1920 × 1080 PNG.
- The Constellation, Ecosystem and Painting have **↺ New session** and **⬇ Save picture** buttons. Nothing is stored beyond the page; closing it clears them.
- The voice tracker now also runs while any of these looks is on screen, so no ribbon is needed.
- `test/e2e-harmony.cjs` (22 checks) and two screenshots (`69-hex-default`, `70-harmony-looks`).

### Honest limits
- The looks were checked on **simulated pitch and onset data in a headless browser**, not a real voice, guitar or interface. How they read with real playing is a thing for a person to judge (`docs/HARDWARE_CHECKLIST.md` has the steps).
- "Tension" is a **simplification**: distance from the chord's own notes, with a small penalty outside the key. It is not a universal rule; in jazz a note called tense here can be exactly the colour you want, which is why the looks say *tension* and not *wrong*.
- **Voice & Guitar** only separates the two with **two inputs** (a voice input and a guitar input). With one input the sung or played line is the voice, and the guitar swarm stays quiet.
- Rhythm Flow places each note by where it falls against the playing band, so it needs the band (or a click) running; without it the ripples have no bar to sit in.
- Lasers and lights are a screen simulation (no DMX or ILDA output). The flash limit is an engineering safeguard, not a medical guarantee.

## 2.9.0 — 2026-10-27 — One Write canvas, a capture that listens, and three journeys: Play, Create, Learn

The studio had grown a lot of tabs. This release organises it around three complete jobs and gives writing a song one page instead of three, and it rebuilds tab capture, which was not reliably writing what was played.

### Added
- **Write**: one canvas for the tab, the words and the neck. **Tab**, **Words** or **Both** (tab with the lyrics and chords beside it), section chips across the top, and a **fretboard strip** underneath that follows the bar you are writing: the chord's notes, what is already written, and what you are playing now. Click a position on the neck to put that note in the selected cell; click it again to take it out. *Song* and *Fretboard* are part of Write now; **Tools** has *Show Song and Fretboard as separate tabs* if you prefer them apart.
- **● Capture** (`src/parts/62-capture.js`): counts you in, loops the section and writes what you play into the bar that is playing, on the sixteenth-note grid. A strip shows the level, what it heard ("Em: E2 B2 E3 G3 B3 E4", "E3 → string 3, fret 2") and a count. A chord is written as a library shape when it matches, otherwise as the nearest playable fingering, and an empty bar is named after it. One **Undo** takes the whole capture back. ⚙ has count-in, loop, replace-on-the-next-pass and chord naming.
- **Three journeys** above the tab strip: **Play** (plug in, pick a tone, play with a backing track), **Create** (write, record, loop and layer, save), **Learn** (load a song, split it, read the chords and tab, practise). Each is a layout that shows only the tabs that job uses; they are also in the Layouts menu (twelve layouts now). **Tools ▸ Everything** still shows everything.
- **Two guided sessions for a first task**: *Play with a band* (connect, pick a tone, start the band, play along) and *Write down what you play* (open Write, Capture, play, stop, switch the canvas). The first page has six goals, Play and Write first; seven sessions in the menu.
- `test/e2e-capture.cjs` (38 checks): the engine on synthetic strings (single notes, ten chords, clean and over a ringing chord, at 48 000 and 44 100 Hz), fingering, the Write canvas, live capture through the input, one-step Undo, and the Write session ticking off.

### Changed
- **Capture was rewritten.** It used to follow one note at a time, ignored a note played again, depended on the bar being on screen and gave no sign of what it heard. Now each attack opens a short window; the notes in that window are found together (harmonic summation, with the sound before the attack subtracted so a ringing chord is not re-read), then written. If the input's own onset detector misses a soft note, an energy rise counts as one. A pass of a loop on which nothing was played is no longer kept as a silent layer, and the loop strip says so.
- The tab strip is shorter: *Song* and *Fretboard* no longer have their own tabs unless asked for. The phone's *Write* group lists Write, Refine, Band and Theory.
- The tab hint line is shorter; on a phone the Write canvas keeps the fretboard for while you capture, and the number keypad steps aside during a capture.

### Fixed
- A single note could be written twice, a beat or two apart, when the single-note tracker noticed a note that was still ringing.
- On the clean first screen the cursor goes to the lyrics box that is showing.

### Honest limits
- Measured on **synthetic string-like audio**, not a real guitar: single notes came out exactly (11 of 11), chords were named correctly 9 of 10 clean and 8 of 10 over a ringing chord, precision about 0.99. About a fifth of the notes inside a chord are missed (octave doubles are cancelled), which the library shapes put back when the chord is recognised.
- A **quiet low note struck right under a loud ringing chord** is not reliably heard. Notes are placed on a sixteenth-note grid, so very fast playing is simplified. Distortion and heavy effects, a noisy room and a badly gained input all lower accuracy; the strip says when the input is too quiet.
- Lasers and lights are a screen simulation (no DMX or ILDA output). The flash limit is an engineering safeguard, not a medical guarantee.

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
