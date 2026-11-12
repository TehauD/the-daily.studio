# Gaps register

What the studio, its tutorials, its documents and its tests do **not** cover yet, kept in one place so each release can close some and say so. Started in **2.47.0** with an audit of everything since 2.39.

How to use it: before a release, move what the release closed into *Closed* with the version, and add what it opened. [RELEASE.md](RELEASE.md) has this as a checklist item. Items marked **(maintainer)** are decisions or facts only the project's owner can settle; nothing here blocks a build.

## Closed in 2.66.0

- **Learn was a window over Practice:** the band, the tempo, the tuner and the fretboard were behind it while you played. It's Practice's own panel now, and a lesson opens in it.
- **The Rig showed all sixteen units, open, all the time** (a wall of knobs). The board shows the pedals on it, and the one you pick, large.
- **⚙ ▸ Earlier / Later** could swap a pedal with an unused unit, so nothing visibly moved.

## Closed in 2.65.2

- **Soundprints were kept in this browser only.** They travel with backups, folder sync and GitHub sync, merged so neither device loses one.
- **CI on main ended "cancelled"** every time: the Firefox pass hung until GitHub's six-hour limit. It stops after 20 minutes now, and names the step it hung in after 8.

## Closed in 2.65.1

- **A song's soundprint was kept as it came.** A song from someone else (a link, a backup, sync) keeps its print only in the print's own shape, capped at 4,000 characters; a sound file over 400 MB is refused before it is read; an unknown Soundprint world in the settings draws Print.
- **The small pages and the site's service worker shipped unminified.** The Drops pages, the journal move pages and `sw.js` are minified by the site build, with the same token check as the app.
- **ARCHITECTURE.md had no entry for fourteen parts** (09e, 13b, 16b, 24b, 25b, 39a–d, 46b, 63c, 63d, 92, 93). Every part is listed now.
- **Documents still described six workspaces** (TESTING, SECURITY_MODEL, PRIVACY, the user guide, the public guide's Showtime page).

## Closed in 2.65.0

- **The workspace and Visuals bars took up to six rows.** One row each, with ⋯ More; the collapsed arrangement is an edge rail like the sidebars.
- **A stray vertical scroll bar on the panel tab strip** (a 1 px overflow).

## Closed in 2.64.0

- **Six workspaces, two pairs of them alike** (Performer and Creator Studio, Practice and Teacher). Four now, and one ★ Showtime.

## Closed in 2.63.0

- **Two switches for how much shows** (Tools and Simple). Simple is the only one.
- **Panel tabs squeezed out of sight** on desktop by the band strip.

## Closed in 2.62.0

- **Soundprint was hard to find.** It's a look in the Visuals now, with doors in the drop strip and the Studio workspace (then Creator Studio).

## Closed in 2.61.0

- **Sound as art.** Soundprint turns any sound into a print, four moving worlds, a reading and an ambient piece, shared as a 1 kB link that never carries the sound.

## Closed in 2.60.0

- **No community page.** Drops is a public showcase, reviewed first and gone after 7 days. It's switched on by the owner (CLOUDFLARE_SETUP.md, Part H).

## Closed in 2.59.0

- **Two people working over the same famous song** had no way to line up their own copies. Load your copy does, from a 400-byte fingerprint.
- **Covers couldn't become your own songs.** Make it ours swaps the record for the band.

## Closed in 2.58.0

- **No way to say "this bit" while writing together.** Comments are pinned to a moment and travel with the song.
- **No help with rhymes or syllables beyond guesses from spelling.** The lyric helper has a 31,000-word pronouncing dictionary.

## Closed in 2.57.0

- **Finishing a song happened elsewhere.** Finish it masters to a streaming target with a real limiter, a fair Before / After and reference matching, and makes the release package with credits and splits.
- **"Nothing is uploaded" claims** that stopped being the whole truth with GitHub sync and Send with recordings are corrected across the app, the guide and the README.

## Closed in 2.56.0

- **Each round of Writing together opened as a new song** (opened by 2.51). It can now be added as a new version of the song you have.
- **Nothing showed where songs were kept.** The 🛡 chip does, with a weekly reminder when they're only in this browser.
- **No named versions.** ✓ Versions keeps them, with their recordings, and they travel with sync.

## Closed in 2.55.0

- **Lanes couldn't be taken to another app lined up.** Band parts went through the master limiter, stems started where the track did, and takes were bare clips. Now every lane saves from the first beat, without the master section, and 📦 Export makes the whole set with a premaster and a README.
- **Relative links could pile up** when the offline copy served the studio at another address. Fixed in the service worker and in the page.

## Closed in 2.54.0

- **Song links couldn't carry audio:** they now can, sealed in the browser and kept 7 days (Send with recordings).
- **There was no takedown route:** recordings in links have **⚑ Report**, and the owner can remove them (CLOUDFLARE_SETUP.md, Part G).

## Closed in 2.53.1

- The site had a second copy at its `workers.dev` address. That address and the preview addresses are off; `verify:site` keeps them off and fails a release if a private file (`.env`, `.dev.vars`, a key, a Wrangler file) is committed or deployed.

## Closed in 2.53.0

- The story behind the studio was only at the end of Help. It now has its own page, a line on the first page, and structured data linking the author's profiles.

## Closed in 2.52.0

- Since 2.50, every request went through the Worker and counted against the free plan; now only the pages that need it do.
- The service worker saved the page twice and re-fetched saved files on every visit, and the sample shelf was fetched four times a visit. A later visit is now one request.

## Closed in 2.50.0

- The Daily has its own address, `journal.the-daily.studio`, with a page at `/journal/` that moves a journal kept there.

## Closed in 2.49.2

- From the live-site evaluation (SECURITY_MODEL.md):
  - jsDelivr is narrowed to the camera library's folder;
  - the 404 page has a policy;
  - there's a `security.txt`;
  - CI's token is read-only, and Dependabot is on.

## Closed in 2.49.1

- The first page flashed the first-visit card, in the default colours, before Welcome back. The card now waits until it's laid out, and the saved theme is set first.
- People coming back had no way to the goals. They now sit under Pick up where I left off.

## Closed in 2.49.0

- The phone's Words screen showed one section at a time, and its ＋ offered five kinds and always added at the end. It now has the song map, a 📄 Song sheet, every section kind placed after the current one, and a ⋯ menu for each section.
- Writing had no next step from the sheet. Perform, Send and Print are now at its foot.

## Closed in 2.48.1

- Whole song needed a lot of scrolling and left most of the screen unused. It now opens as a chord sheet in columns, with repeats shortened, editing in place and a full-screen mode.
- Nothing stopped two parts declaring the same function; the build now refuses it.

## Closed in 2.48.0

- Seeing the whole song in Write: Write showed one section at a time, and ＋ could only add a Verse or a Chorus. Now there's **☰ Whole song**, a song map, and a menu of every section kind with names and chords filled in.
- Perform had one layout: controls at the bottom and the words in the middle. **⚙ Layout** now offers controls top right, at the bottom or hidden, the words at the bottom like a sing-along or in the middle, four text sizes, the song map, and a Sing-along view.

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

### Gigging (opened by 2.66)
- **No setlist yet:** the songs of a set in order, each with its tone and scenes, stepped through with a foot pedal or MIDI, and a gig view that shows now and next in large type. Songs don't remember a tone of their own either.
- **Scenes hold the whole rig;** there's no per-scene "only these pedals change" (as on some floor units), and no expression-pedal mapping to a knob beyond MIDI-learn.
- **The board's look per pedal is a colour and a label;** no pedal skins or photos.

### Song structure (opened by 2.48)
- The **Stage** panel's prompter and the lower third have none of Perform's layout choices.
- Sections can be reordered with ↑ ↓ but not dragged on the map.

### Soundprint (opened by 2.61)
- **Prints can't be dropped** to the public page yet. A soundprint gallery could use Drops' review, with the print instead of audio (no copyright question).
- **No vertical (9:16) video** for stories; the video is square.
- **The reading is a guess** from about a kilobyte: it hears one key for the whole sound, and chords only from the key's own (no borrowed chords).
- **No caption or location** on a print, by design for now.

### Drops (opened by 2.60)
- **Off until the owner sets it up** (public bucket, copyright agent, takedown email: CLOUDFLARE_SETUP.md, Part H).
- **The review queue doesn't notify you.** Check /drops/review/.
- **No block list:** an account can be stopped only by declining its drops.
- **No reactions, comments or "versions of this"** on the public page yet. The link to the song is how people answer.
- **The public page isn't in search engines (`noindex`).** Drops come and go; turn indexing on if you want it.
- **No cover art.**

### Load your copy (opened by 2.59)
- **Only the start is matched,** not the speed. A copy at a slightly different speed (a sped-up upload) lines up at the start and drifts; the studio doesn't stretch it yet.
- **The match looks at the first three minutes** of the copy for the first 40 seconds of the song. A copy with a much longer intro wouldn't be found.
- **A cover with the same arrangement** can match, which is usually what you want.
- **Make it ours** takes the chords, tempo, key and drum groove. It doesn't take the melody or the bass line note for note.

### Comments and the lyric helper (opened by 2.58)
- **Comment markers on the ruler can't be clicked yet:** use 💬 Comments to jump to one. Comments don't show in the whole-song sheet or Perform.
- **Replies:** a comment is a single note; there are no replies under it.
- **The phone** has no 💬 Comment button yet; comments made on a computer travel to it with the song.
- **The rhyme list includes some rare words** (doe, fro, hoe) among the common ones, and knows only words in the CMU dictionary. Slang and names fall back to spelling rules.
- **English only.**

### Finish it (opened by 2.57)
- **Cover art** isn't made or checked; the README says what's usually needed.
- **There's no ISRC or UPC.** Distributors issue them.
- **Splits are a record, not a contract.** The README and credits say so.
- **There's no MP3 or AAC in the package:** distributors want WAV. A compressed preview could come from the existing M4A export.
- **Mastering is one chain:** tone, glue, limiter. There's no multiband compression or stereo-width control.

### Versions (opened by 2.56)
- **The phone** has no journey strip, 🛡 chip or Versions window yet: they live in the song bar, which the phone layout doesn't show. Versions made on a computer still travel to the phone through sync.
- **You can't play a version without going back to it** (or opening a copy). A "listen" button would need a second song loaded at once.
- **A version's recordings sync as names only:** the audio stays on the device that made it, as with takes.
- **Two devices adding versions to the same song at the same time** keep both lists, but the song file itself still follows the "both changed: keep both" rule.

### Lanes out (opened by 2.55)
- **Dragging straight into another web app** (BandLab) depends on the browser passing a file from one page to another. It's tested in the page, not across two real windows. The desktop or the folder always works.
- **MIDI out of the band parts** (for replacing a sound in a DAW) isn't exported with the lanes.
- **The other app's tempo** has to be set by hand from the README; a tempo map in the files (BWF or an `.als` or `.dawproject` file) would set it automatically.
- **Sidechain ducking** keyed by the kick isn't heard on a bass lane saved on its own (the kick isn't playing), so it sounds a little fuller than in the mix.

### Send with recordings (opened by 2.54)
- **Browsers:** Safari before 26 and older browsers can't compress or open the recordings (no WebCodecs audio). The song still opens, and the window says why. A fallback (16-bit WAV at a lower rate) would cover them at four to eight times the size.
- **Reports** are files in the bucket that the owner has to look at; there's no notification or block list yet.
- **Recordings go as they are now:** a take can't be sent on its own, and the stems of a backing track aren't sent.

### Writing together (opened by 2.51)
- Each round of a song passed back and forth opens as a new song. The rounds aren't gathered into one song with versions yet, so someone who passes a song many times gets many copies.
- Two people changing the same section at once aren't merged: the later round simply carries its own version.

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

### Security (maintainer, from the live-site evaluation)
- **Cloudflare settings:** turn off Web Analytics' automatic setup, bot detection's JavaScript and, if you can, Network Error Logging. Until then the 404 page and `/journal/` get Cloudflare's scripts, and `/journal/` gets a `cf_clearance` cookie.
- **Decide on `www.the-daily.studio`** (no DNS answer).
- **A Wrangler cache file** (Cloudflare account id and name, no key) stays in the repository's history; it is untracked since 2.53.1. Removing it from history means rewriting it, which only the owner should decide.
- **Pin the CI actions to commit hashes.**
- **Check the TLS configuration** with a public scanner; the evaluation couldn't, from behind a proxy.

### Licensing and legal (maintainer)
- **Demo words:** confirm you wrote the four lines of the demo song.
- **MediaPipe models:** confirm Google's terms before self-hosting or redistributing `selfie_segmenter.tflite` (and the hand model).
- **Patents:** none searched. The methods are decades old and the early patents have run their term; a freedom-to-operate opinion is needed before licensing the code commercially as a product.
- **Trademark:** no search for "the-daily.studio" or "The Daily".
- **Takedown contact:** recordings in links have ⚑ Report (2.54); for everything else, the contact is SECURITY.md's (GitHub). A plain email address would help a non-technical person.
- **AI-assisted authorship:** how it affects copyright differs by country; ask a lawyer before a commercial launch.
