# Gaps register

What the studio, its tutorials, its documents and its tests do **not** cover yet, kept in one place so each release can close some and say so. Started in **2.47.0** with an audit of everything since 2.39.

How to use it: before a release, move what the release closed into *Closed* with the version, and add what it opened. [RELEASE.md](RELEASE.md) has this as a checklist item. Items marked **(maintainer)** are decisions or facts only the project's owner can settle; nothing here blocks a build.

## Closed in 2.47.1

- **Neutral names** for the drum machines and the sub bass: Deep Machine (was 808), Club Machine (was 909) and Glide Sub (was 808 Sub). Saved songs, song links, backups and snapshots that use the old names open with the new ones (`bandRename`). The Afrobeats beat is now **Golden Hour** (was Afro Sunset).

## Closed in 2.47.0

**Tutorials**
- The **guided tour** told the 2.13 studio: a guitar rig first, a "latency chip" that moved to the status line in 2.38.1, a brand name in the first step, nothing on workspaces, ✦ Simple, the beats, Song build, vocal tuning or song links. Rewritten (`src/parts/17-tour.js`); in ✦ Simple it keeps to the essentials (14 cards), the Full Rig adds the full studio (21).
- The **phone tour** still taught the pre-2.41 sections (Play, Write, See, Stems). It now follows Words, Sing, Beats, Tracks and More (11 cards).
- The **public guide** (`/guide/`) had no page for the songwriting and singing work of 2.39–2.46. Two new pages: *Write a song over a beat* and *Sing, record and tune your voice*; *Getting started* explains workspaces, ✦ Simple, connecting first and the tour; *New lately* lists 2.40–2.46.
- `test/e2e-tour.cjs`: every tour step must find what it points at, with the card on screen, in Simple, the Full Rig and on a phone, so a moved control fails a test instead of silently pointing at nothing.

**User documents**
- USER_GUIDE.md still said "Simple is the Songwriter" and "a first visit opens the Performer" (both changed in 2.39 and 2.46), listed the essentials-only panel tabs of 2.38, told phone users to record "in *Play*", and its contents line stopped at 2.44. Fixed, with a table of each workspace's panels and tools in Simple and a section on the tour.
- README.md: highlights stopped at 2.41 and the Simple row was out of date; the roadmap still listed sidechain ducking, a groove picker, song links, pitch correction and a community gallery, all shipped. *Your first five minutes* and the panel table described the old guitar-first start and layout presets removed in 2.12.
- docs/README.md (the index) was stamped 2.13 and did not list LICENSING.md, GITHUB.md or TERMS.md.

**Licensing and legal**
- LICENSING.md carried the wrong audit date, said `/legal/` has no terms (it has had them since 2.17), counted eleven guide pages, and credited no method for vocal tuning or the 2.46.1 guitar. It now cites TD-PSOLA and the Jaffe–Smith extensions, says the instruments of 2.45–2.46.1 are code with nothing sampled or measured from anyone else, adds a dates-only note on patents, and records the style names "808" and "909" as an open item. THIRD_PARTY_NOTICES.md has the two new citations and the style-name note.
- TERMS.md: the beats and the band are yours to use; a song link carries the song itself. (Added under *Your content*, so the sharing terms people confirm are unchanged and nobody is asked again.)
- PRIVACY.md said it was last checked against 2.19.1, had no row for vocal tuning, singing on a phone or the band, and said the studio's rooms are fetched "the first time they are needed" when the offline copy fetches them all on install. Fixed.
- SECURITY_MODEL.md was stamped 2.13: no song links (untrusted input in the address), no rooms and their integrity hashes, no tuned takes, no phone microphone. Added.

**Tests**
- `test/e2e-privacy.cjs` had not been widened since 2.19.1. Its session now taps a beat with Song build, makes and reads a song link and tunes a take and puts it back, and still makes no request to any other site.
- TESTING.md's table was missing sixteen suites (agent, goals, chord sheets, share, tip jar, GitHub and more). All listed now.
- HARDWARE_CHECKLIST.md had nothing after 2.12. Section 15 covers what only ears and real devices can judge: the beats and the sub bass on real speakers, the guitars folded to mono, Song build, tuning a real voice, singing on a phone, song links through chat apps, and the tour.

**Agents and machine-readable files**
- `llms.txt` listed the renamed `open_shower_mode` as a tool with a garbled line; only the tools table is read now, and `verify-site` checks it.
- An agent answer still pointed at `open_shower_mode`, renamed in 2.27.
- Agents could not reach the band of 2.39–2.45. `set_band` now takes a beat, the kit, the bass and keys sounds, the rhythm guitar and Song build; `edit_section` takes a section's energy. New optional inputs, so the API stays at version 2.

**Housekeeping**
- RELEASE.md tagged `v2.13.0`, pointed at the 2.8.0 changelog entry and listed "known limits at 2.2". Now version-neutral, with smoke tests for song links, rooms, beats and tuning.
- `package-lock.json` said 2.38.1.

## Open

### Product
- **Guided sessions** (`src/parts/60-guide.js`: play, write, hum, record, loop, split, show) are still written for the full studio and a guitar. They work, but in ✦ Simple some steps point at panels the workspace does not show, and none is about singing on a phone. A singer's session (beat → words → sing → tune → send) would match 2.41 and 2.46.
- **First-open hints and Help text** for each tab were not re-read for 2.46's per-workspace Simple.
- **Agents** cannot tune a take, read or set the vocal pedals, or make a song link (`export_song` gives text formats only). Tuning edits a recording, which the tools have so far never touched; that is a decision, not an oversight.
- `get_song` does not return section energies or whether Song build is on (`edit_section` and `set_band` answers do).
- **Per-room usage:** the offline copy fetches every room on install, so the host's request counts cannot show which rooms people use. This is privacy-friendly and probably right; recorded so nobody reads the counts as usage.

### Tutorials and documents
- The two new guide pages have **no picture** yet (`test/guide-shots.cjs` makes the others).
- `docs/screenshots/` and `guide/img/` predate 2.46 (Simple per workspace) and 2.41 (the phone); regenerate with `npm run shots` and `node test/guide-shots.cjs`, and check `git diff`.
- HOSTING.md (2.13), OPERATIONS.md (2.13) and GITHUB.md (2.21–2.22) were not reviewed line by line in 2.47. Only HOSTING.md's opening (which still said everything is inside `index.html`, untrue on the hosted site since 2.40) and OPERATIONS.md's version stamp were corrected.
- README.md still carries *What's new* sections for 2.2–2.13; the CHANGELOG is the history, and the README could drop them.
- USER_GUIDE.md has grown newest-first, one section per release. A task-first order (start, write, sing, record, play, perform, share, keep safe) would read better.

### Tests
- The jsdom smoke test (`npm test`) cannot run in some sandboxes; CI runs it.
- How the band and a tuned voice **sound** is measured by numbers (brightness, correlation, cents), not judged by ears: HARDWARE_CHECKLIST.md section 15 is the human pass.
- Not covered at all: very long sessions, large stems on low-memory phones, a full screen-reader pass, audio latency outside Chromium.
- The tour test checks that each step points at something, not that its words are true; RELEASE.md asks a person to read them.

### Licensing and legal (maintainer)
- **Demo words:** confirm you wrote the four lines of the demo song.
- **MediaPipe models:** confirm Google's terms before self-hosting or redistributing `selfie_segmenter.tflite` (and the hand model).
- **Patents:** none searched. The methods are decades old and the early patents have run their term; a freedom-to-operate opinion is needed before licensing the code commercially as a product.
- **Trademark:** no search for "the-daily.studio" or "The Daily".
- **Takedown contact:** none, if the site becomes a public product.
- **AI-assisted authorship:** how it affects copyright differs by country; ask a lawyer before a commercial launch.
