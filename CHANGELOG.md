# Changelog

All notable changes to the-daily.studio (earlier versions were released under the name FRETWORK). Versions follow [Semantic Versioning](https://semver.org/).

## 2.69.1 — 2026-11-14 — The honeypot gets teeth, and an edge-level block alongside it

### Changed
- **The honeypot can now auto-block repeat offenders.** Past 3 hits from the same IP inside an hour, the Worker adds that IP to the zone's IP Access Rules via Cloudflare's own API — a real block, not just the tarpit's few-second delay (`worker/honeypot.mjs`). It's off until the site owner sets up a KV namespace and two scoped Worker secrets (`CLOUDFLARE_SETUP.md`, Part I); without all three, nothing changes from 2.69.0. A single hit never blocks: a shared IP (a works VPN, a carrier's NAT, a WARP exit) could otherwise lock out people who never touched these paths, while a real scanner clears three hits in well under a second. The block has no expiry (Cloudflare's API doesn't offer one), so it needs the same occasional human look the R2 reports already get.
- **The WAF Custom Rule for the same scanner-bait list** (previously described only in passing) now has the exact Expression Editor syntax to paste in (`CLOUDFLARE_SETUP.md`, Part C) — one Custom Rule, well inside the free plan's 5-rule limit (checked against Cloudflare's current docs), separate from the `/auth/` rate limit's own 1-rule quota. Turning it on blocks the list at the edge, before the Worker ever runs, which makes the tarpit and the auto-block above moot for exactly that list — both still matter for anything this list doesn't happen to name.
- **Corrected course on a bad lead:** `cf.threat_score`, floated as a free "bot score" signal, turns out to be deprecated — Cloudflare's own field reference says it now always returns 0. It was never written into any doc or code; this note is so nobody chases it later.

### Tests
- **`worker.test.mjs`** adds 8 checks for the auto-block: the first two hits from an IP stay tarpit-only; the third calls Cloudflare's Access Rules API with the right URL, token and IP; it isn't called again once blocked; a different IP has its own count; no KV binding skips the tally entirely; a KV namespace with no API token/zone ID still counts but never calls Cloudflare; a failing KV read never breaks the tarpit's response. 77/77 passing.

## 2.69.0 — 2026-11-14 — Lessons that teach harmony and style, and a honeypot for scanners

### Changed
- **Practice lessons: the shapes they describe are now drawn.** A handful of steps in Foundations and Lead explained a shape in words and left the neck diagram blank — open strings, the pentatonic box, pushing a bend, vibrato, landing on a chord tone. All five now draw the fretboard and tab alongside the text, with ▶ Listen to demo it (there's nothing to check, so no ● Play it).
- **Two new lesson paths in Learn ▸ Lessons:**
  - **🎶 Progressions** — six named chord progressions behind thousands of songs, each explained and then played through with the band, full chord diagrams on screen: I–IV–V (the three-chord song), I–V–vi–IV (the pop progression), 12-bar blues, ii–V–I (the jazz cadence), the Andalusian cadence, the minor loop.
  - **🎭 Styles** — what makes a genre sound like itself: Blues, Rock, Funk, Country, Pop and Reggae, each with a short explanation of its rhythm and harmony and a representative riff to play, neck diagram and tab included.
  - Both sit after Singing and before Warm-ups; a singer's 📅 Today stays all-sung, untouched by either.
- **A honeypot for scanner and bot probes** (`/.env`, `/wp-login.php`, `/.git/config` and the like). There is no legitimate reason for a real visitor ever to request one, so they are now deliberately routed into the Worker (unlike every other path, which the Worker runs for only when it has real work to do) and taxed: the same empty 404 they'd always have gotten, trickled out five bytes at a time over a few seconds instead of answered at once (`worker/honeypot.mjs`). A decompression or zip bomb was asked for and refused: it's a denial-of-service payload regardless of the target, risky to whoever actually receives it, not only whoever it's aimed at. An optional Cloudflare WAF Custom Rule (`CLOUDFLARE_SETUP.md`) blocks the same list even earlier, at the edge, for anyone who'd rather these never reach the Worker at all. Written up in `SECURITY_MODEL.md` ("Scanner and bot traffic: the honeypot"), with an honest note on what it does and doesn't do.

### Tests
- **`e2e-lessons`** (new, 13 checks): an info step with a shape draws the neck and tab (▶ Listen, no ● Play it) and still marks itself done; Progressions' six names and a full chord-diagram playthrough; Styles' six genres and a riff's neck/tab; both paths' position relative to Singing and Warm-ups; a singer's Today unaffected; both paths discoverable in Learn ▸ Lessons.
- **`worker.test.mjs`** adds six checks for the honeypot: path recognition (exact and by folder, case-insensitive) without catching real site paths; a tarpit'd 404 with its five bytes and five waits; no caching or indexing on any method; the same behaviour at The Daily's own address; a near-miss path still served normally and at once.

## 2.68.0 — 2026-11-12 — Workspaces that adapt, lessons you can sing, the phone's own journeys

### Changed
- **The workspaces adapt to who you mostly are.** The choice on the start page (Singer, Guitarist, New to music, Producer) now shapes Songwriter, Studio and Practice too, and a small chip beside the workspaces changes it at any time. Nothing is removed: what a workspace doesn't lead with is under ⋯ More and ☰. A guitarist, and anyone who hasn't said, gets each workspace as it was. Full Rig is the same for everyone.
  - **A singer:** Songwriter opens on the words, with 🥁 Beats, 🎤 Hum an idea, ✎ Rhymes, Paste chords and Send, and no fretboard under the page. Studio leads with Record video, Camera, Vocal pedals and 〰 Voice, has no Rig tab, opens the microphone beside it, and shows your pitch on the visuals in place of a guitar neck. Practice leads with Learn, 〰 Voice and ⏱ Speed & key, with the words and the backing track as tabs and no fretboard.
  - **Someone new to music:** Songwriter is a beat, a hum, the words.
  - **A producer:** Songwriter leads with the piano roll, Keys and Pads, with the arrangement open and the backing track on the strip; Studio leads with the video's shape and the stream window.
  - **✦ Simple follows:** each keeps its own few tools and tabs.
- **New tools, in every workspace's list:** 🎤 Hum an idea and ✎ Rhymes in Songwriter; 〰 Voice (your pitch against the key, your range, the key that suits you) in Studio and Practice.
- **Practice for singers: 🎤 Singing in Learn.** Four lessons the coach follows as you sing: match a note, three and five notes, thirds, arpeggios, the octave, the whole scale, and notes held in tune.
  - The coach hears your voice (the vocal channel if you have one, else the main input), in any octave. A voice slides between notes, so a wrong note counts only when it's held.
  - A sung step shows a **keyboard** with its notes lit, the one to sing now, and the note you are singing, with the note names under it, where a guitar step shows the neck and tab. ▶ Listen plays it on a piano.
  - **Hold a note:** a new kind of step. Keep one note in tune for three or four seconds; it says whether you're a little high or low.
  - The **Key** menu moves an exercise to where your voice is comfortable. After **Voice ▸ Find my range**, exercises start at the bottom of your comfortable range by themselves.
  - **A singer's 📅 Today** is sung: a held note to warm up, something to review, the next step. Nobody else's Today has sung steps in it.
  - Learn's list also has **〰 Voice**, and a singer's way in from the start page opens Singing with its journey.
- **On a phone, the ways in have journeys of their own,** on the phone's own screens (they led to older, shorter sessions):
  - **Write a song:** Beats → hear it → Words → Sing → Send (📄 Song ▸ 🔗 Send). A singer starts on the hum bar.
  - **Play it live:** the band → a look → ★ Showtime.
  - **Learn** fills the screen as before, on Singing for a singer.
- **The start page's headline is "Your song, start to finish."** with *Write it, sing it, play it, learn it, share it* under it. It was "Record it. Split it. Write it down."

### Tests
- **`e2e-adapt`** (new, 29 checks): each workspace for anyone, a guitarist, a singer, someone new and a producer; nothing removed; one row; the chip; ✦ Simple; Singing in Learn; a sung step's keyboard; the coach following a simulated voice (an octave up, a slide ignored, a held wrong note counted); holding a note in tune; the range moving the exercises; a singer's Today.
- **`e2e-doors`** adds the phone's journeys and the singer's Learn (36 checks). **`e2e-welcome`** and **`e2e`** follow the headline.

## 2.67.0 — 2026-11-12 — Four ways in

### Changed
- **The start page offers four ways in, one per workspace,** where it had six separate tasks:
  - **🎸 Write a song** (Songwriter): a new song and a journey that goes the whole way: an idea, hear it, a line of words, a second part, a take, the stage, and out the door.
  - **🎤 Play it live** (Studio): a look, your sound, the band, ★ Showtime, and a video to post.
  - **🎼 Learn and practise** (Practice): the Learn panel, with a lesson open and the coach listening.
  - **⚙️ Explore everything** (Full Rig): every tool, a finished song to take apart and, the first time, the tour. It replaces "I know my way around".
- **"I'm mostly a" Singer, Guitarist, New to music or Producer.** It's optional, it's remembered, and it asks what you do, never how good you are. It changes what each way in says and where it leads:
  - a **singer's** song starts by humming, their Studio journey skips the guitar tone and sings from ★ Showtime, and their Practice opens Voice (the pitch ribbon, range and key);
  - a **guitarist's** song starts by capturing a riff, and their Practice opens today's fifteen minutes;
  - someone **new to music** starts a song from a beat and opens the first lesson.
- **The six single tasks are still there, under "Or do one thing",** and each now opens in one of the four workspaces with what it needs showing: *Record, loop and layer* in Studio with the arrangement open (it opened the old Record layout), *Learn a song* in Practice with Backing track on the strip (its tab was missing), *Run a show* with every tab showing.
- **Play, Learn and Explore keep your own song** if you have one with chords; a first visit gets the demo song.
- **On a phone** the four ways in sit two to a row and the single tasks are small chips, so the main button stays on the first screen.

### Fixed
- **On Welcome back, every "start something new" button just opened your last song.** They were only routed on a first visit. Each one starts what it says now.

### Tests
- **`e2e-doors`** (new, 30 checks): the page, each way in for each kind of person, the whole-song journey walked to its end, the single tasks' workspaces, and a returning visitor with a song of their own. **`e2e-guide`, `e2e-welcome`, `e2e-mobile-fit`, `e2e-simple`** follow the new page.

## 2.66.0 — 2026-11-12 — Learn is Practice, and the rig is a board

### Changed
- **Learn is the Practice workspace's own panel,** not a window over it. Practice opens on it: Today, lessons, warm-ups, This song, By ear, riffs and licks, Riff Lab, the scale atlas, teaching, and **Scales & ear** in the same list.
  - A lesson, riff or shape opens in the panel (**◀ Back** returns to the list), so the band strip, the tempo, the tuner, the Theory sidebar and the **Fretboard** tab stay in reach while you play.
  - Learn from anywhere else (the Theory sidebar's "Practise this scale", the agent, a guided step) goes to Practice.
  - On a phone, Learn and the coach are still full-screen, as before.
  - Practice's tools are now 🎓 Learn, − 5 / BPM / + 5 and ⏱ Speed & key; the teaching tools (Annotate, Lesson notes, Record screen, Transcribe) are under ⋯ More. Today, This song, By ear, riffs and Scales & ear moved into the panel's list. In ✦ Simple, Practice shows Learn, the Fretboard and the Band.
- **The Rig is laid out like a real pedalboard.**
  - **One row** for the tone (**◀ ▶** step through your tones; the name opens a searchable list of all of them), **A ⇄ B** (click recalls, Shift+click stores, the slider morphs), **💾 Save** (name it; export and import files there too), **⋯** (Mutate, store A or B, reset) and the master. The scenes are under it; an empty scene slot is just its number.
  - **The board shows only the pedals on it,** in chain order, not all sixteen units. A pedal is on the board while it's on, or once you put it there: **＋ Pedal** lists the rest by kind. Its LED stomps it (it stays on the board, bypassed); click it to open it.
  - **◎ Edit** (the new default) opens the pedal you picked, large, under the board. **▦ All** opens every pedal on the board. **◉ Stomp** is big footswitches for playing live.
  - **A pedal's ⚙** adds a **label** of your own ("Klon", "Lead boost") and **✕ Off the board**, beside its colour, width, collapse, hide, footswitch key and MIDI note. **◀ Earlier / Later ▶** step past the next pedal on the board.
  - **⚙ (board)** holds pedal width, scene morph time, scenes-and-the-band, live keys and *show every unit*.
- **Full Rig opens with your Tones beside the board** (Audio input first until an input is connected, as in every workspace).

### Fixed
- **⚙ ▸ Earlier / Later** moved a pedal one place among all sixteen units, so next to an unused one nothing visibly changed.

### Tests
- **`e2e-board`** (new, 19 checks): the tone row, the board before and after the audio starts, opening, stomping, adding and removing pedals, labels, Earlier among the board's pedals, the tone list, the three views, Save.
- **`e2e-learn`, `e2e-goals`, `e2e-simple`, `e2e-workspace`** follow the Learn panel; **`e2e`** and **`mobile`** follow the two-row deck and ▦ All.

## 2.65.2 — 2026-11-12 — Soundprints in backups, and CI that finishes

### Changed
- **Your soundprints travel with backups, folder sync and GitHub sync,** merged so neither device loses one (they were kept in this browser only).
- **CI's Firefox pass stops after 20 minutes** and names the step it hung in after 8; it had run to GitHub's six-hour limit, so every run on main ended "cancelled".

## 2.65.1 — 2026-11-11 — Hardened, minified, and the documents caught up

### Security
- **A song's soundprint is kept only in its own shape.** A song that comes from someone else (a song link, a backup, sync) keeps its print only as a base64url code of at most 4,000 characters with a hex signature; anything else is dropped when the song is opened. It was already decoded by the checked reader, so nothing could run; now nothing oversized is kept either.
- **A sound file over 400 MB is refused** before it is read into memory for a soundprint (ten minutes of 96 kHz 24-bit stereo fit well under that).
- **An unknown Soundprint world in the settings draws Print** instead of whatever the value said.

### Changed
- **The site's service worker, the Drops pages and the journal move pages ship minified,** with the same check as the app (the code's tokens must be identical before and after) and their Content-Security-Policy hashes taken from what ships. The vendored journal page is still served byte for byte as its own project builds it.
- **The AI-agent tool `open_workspace` describes the four workspaces** (it still accepted the old names, and still does).

### Documents
- **ARCHITECTURE.md** lists every part again: fourteen were missing (09e, 13b, 16b, 24b, 25b, 39a–d, 46b, 63c, 63d, 92, 93), and the goals, layout, Visuals and experience entries describe 2.63–2.65.
- **The user guide, README, TESTING, SECURITY_MODEL, PRIVACY, GAPS and the public guide pages** say ★ Showtime, four workspaces, ⋯ More and the arrangement rail where they still said Perform, six workspaces, Teacher, Creator Studio or the Tools button.
- **The pictures** in the README, the user guide and the public guide pages are made again from 2.65.1.

### Tests
- **`e2e-soundprint`** checks the song-print guards and the world fallback. **`e2e-requests`** reads the minified service worker without depending on its spacing. **`e2e-concert`** gives the 2 MB Sky poster up to 15 s to encode (it sometimes took more than the 4 s it had on a slow software renderer).

## 2.65.0 — 2026-11-11 — Less on screen, the same studio

### Changed
- **The workspace bar is one row.** The four workspaces, the workspace's main tools, **⋯ More** and the next step share a single row, which wraps only when the centre is narrow (then the other workspaces show just their icons, and the next step just its arrow). The rest of each workspace's tools are under **⋯ More** (it remembers whether you left it open), and a tool that's switched on stays showing:
  - **🎸 Songwriter:** 🥁 Beats · 🎸 Paste chords · 👆 Pads · 🎹 Keys · 🔗 Send as a link · *More:* 🎤 Vocal pedals · 🎛 Piano roll.
  - **🎤 Studio:** ⏺ Record video · 📷 Camera · 🎤 Vocal pedals · ▶ Studio Replay · ⇩ Export · *More:* video shape · ✨ Overlays · 📺 Stream window · 🖼 Thumbnail · 🎸 Tip jar · ◎ Soundprint.
  - **🎼 Practice:** 🎓 Learn · 📅 Today · 🎵 This song · 🎼 Scales & ear · − 5 / BPM / + 5 · *More:* 👂 By ear · 🎸 Riffs & licks · ⏱ Speed & key · ✎ Annotate · 📝 Lesson notes · ⏺ Record screen · ♪ Transcribe.
  - The mission and its three steps are behind the **?** at the start of the tools.
- **The Visuals bar is one row** (two when the centre is narrow), where it was up to six. The **Look** button names the look and opens the looks (and the Behind you looks) under it; picking one closes them. Then what the look itself offers (the hexagon colours, Soundprint's worlds, Concert's Live / Teach / Sky, which now shows only for Concert), then **⏺ Record**, **🎥 Go on stage** and **⛶ Stage mode**. **⋯ More** holds the source, Auto look, Camera backdrop and how it sits, Neck, Pitch, Speed · size · zoom, the tip jar and Show setup.
- **The collapsed arrangement is an edge, like the sidebars:** a thin rail along the bottom with its **▴ Arrangement** tab in the middle, where it was a strip with its header and ruler. The tab opens it to the workspace's usual height, as before, and so does a new take (a recording, a dropped file, a hum), so you see it land. Opening a song that already has takes leaves it as it is.

### Fixed
- **The panel tab strip no longer shows a small vertical scroll bar** at its end. It was a pixel taller than its row.

### Tests
- **`e2e-goals`, `e2e-simple`, `e2e-tip`, `e2e-voice`, `e2e-camera`, `e2e-privacy`, `e2e-vz-adjust`, `e2e-lanes`, `e2e-looper`, `mobile`** follow the one-row workspace bar, ⋯ More, the Look button and the arrangement rail.

## 2.64.0 — 2026-11-11 — Four workspaces, one Showtime, and the arrangement collapsed

### Changed
- **Four workspaces instead of six,** so it's clearer where to go:
  - **🎸 Songwriter** — write the song.
  - **🎤 Studio** — what were Performer and Creator Studio: the stage large, your tones, tuner, levels and the audience view; record a video in the shape you want, camera and overlays, vocal pedals, Studio Replay, stream window, thumbnail, tip jar, Soundprint and export.
  - **🎼 Practice** — what were Practice and Teacher: the fretboard large; lessons that listen, Today, This song, By ear, riffs and licks, Scales & ear, tempo and Speed & key; and for teaching, annotate, lesson notes, screen recording and Transcribe. Lesson notes no longer open by themselves.
  - **⚙️ Full Rig** — everything, as before.
  - Anything that opened the old ones (a saved workspace, a guided session, an agent asking for "creator" or "teacher") opens what they became.
- **★ Showtime is the one way to play the song full screen,** in the song bar of every workspace (it was "🎤 Perform"). Nothing else says Perform: the whole-song view's own button is gone on a computer (the song bar's is right there), the Visuals lens is **Live / Teach / Sky**, and the next-workspace buttons say **Into the Studio** and **Write the next one**.
- **The Create → Perform → Share strip is gone.** It only repeated three of the workspace buttons beside it.
- **The arrangement starts collapsed,** in every workspace: a strip with its header and ruler under the panels, so they get the room. **▴ Arrangement** opens it to the workspace's usual height, and the drop strip comes back with it (dropping a file anywhere works either way). This applies once to a studio already set up too, except in the Arrange and Record layouts, which are about the arrangement.
- **The view switch is Canvas · Song · Full.** Its third option was called Studio, which is now a workspace's name.
- **👆 Pads has its own icon,** no longer the same drum as 🥁 Beats.
- **One Mute all on each screen:** in the band strip on a computer, beside the click on a phone (the transport's copy shows only on a phone).

### Tests
- **`e2e-goals`** walks the four workspaces, checks there's no strip, that ★ Showtime is the only Perform control on screen, the next-workspace path, and that the old ids open the merged workspaces. **`e2e-simple`, `e2e-workspace`, `e2e-tip`, `e2e-shapes`, `e2e-learn`** follow the new names.

## 2.63.0 — 2026-11-11 — One switch for how much shows, and panel tabs you can see

### Changed
- **✦ Simple is the one switch for how much of the studio shows.** The separate **Tools** level on the panel strip (Automatic, Essentials, More tools, Everything) is gone. Inside a workspace it changed almost nothing, because each workspace already chooses its panels; with Simple on it was ignored. Now: Simple on, each workspace's few panels and tools in plain words; Simple off, every panel the workspace has, numbered for Alt+1…9. Nothing is turned off or lost.
- **The Visuals panel is called Visuals in Simple too.** It was "Stage" there, beside a separate panel also called Stage.
- **Finishing a guided session no longer announces "unlocked" tools,** since nothing is hidden by level. Coaching notes on the panels stay for newcomers and stay off for anyone who knows their way around.

### Fixed
- **The panel tabs were squeezed out of sight.** On a 1440 px screen the band strip left the panel strip 16–109 px: one tab in Performer, Creator Studio, Practice and Full Rig, none in Teacher (the rest scrolled out, with no scrollbar). The tabs now keep their width and the band strip takes its own line when it doesn't fit beside them; a strip wider than the dock shows a thin scrollbar.
- **Teacher's Lesson notes followed you to every workspace.** The notes Teacher opens close when you leave it; notes you open yourself stay.

## 2.62.0 — 2026-11-11 — Soundprint in the Visuals

### New
- **Soundprint is a look in the Visuals,** third in the list, beside Hex Resonance and Concert. Choose it and the open song becomes its print: the whole mix is rendered faster than it plays, listened to once, and its print (about 1.4 kB of shapes) is kept with the song. It moves with the playhead: the fingerprint grows from its core, Flow and Bloom follow the song, the terrain travels. It's on the Stage and in Stage mode like any other look.
- **Its row, under the looks:** the five worlds (Print, Flow, Terrain, Bloom, Harmonograph), why it looks the way it does, **⟳ Listen again** (the old print stays until you ask, because listening stops playback) and **◎ Save, share, or any sound…** (the reading, the ambient piece, artwork, video, a link, or a print of any other sound).
- **More ways in:** ◎ Soundprint in the drop strip under the arrangement, in Creator Studio's tools, and the address the-daily.studio/#soundprint.

### Fixed
- **Soundprint was hard to find.** Its only desktop door was in the Export tab, the eleventh panel tab, usually scrolled out of view and beyond the Alt+number shortcuts.

### Tests
- **`e2e-soundprint` (55 checks, 6 new):** the look is third in the list with its five worlds; choosing it makes and keeps the song's print and draws it; its worlds switch and are remembered; it plays with the song; a changed song says so, and ⟳ Listen again makes it again.

## 2.61.0 — 2026-11-10 — Soundprint: every sound becomes something only it could make

### New
- **◎ Soundprint.** Record a sound (up to a minute), choose an audio file, a take, the song or its master. It's listened to on this device and becomes a **print**: about 1 kB of shapes (its loudness, brightness and motion over 128 moments, its notes and spectrum over 64, its onsets, key and pulse). Everything else grows from the print.
- **The sound decides the kind of picture, not only its details.** Each print has a genome, shown under its reading ("Its print is a loop: a sound that flows…"):
  - **its fingerprint class,** as in fingerprint science: mostly texture makes an arch (busy texture, a tented arch), pitched and steady a whorl, dramatic a double loop, busy and pitched a central-pocket whorl, otherwise a loop (right in major, left in minor);
  - **its colours:** only the notes it's made of, each its colour on the circle of fifths; noise mutes them;
  - **its ground:** paper for bright or calm major sounds, night for dark minor ones, stone for textures, otherwise ink;
  - **the rest:** turbulence from its motion, ridge spacing from its onsets, grain from its noise, a hand's wobble from its dynamics, symmetry from its pulse. The print's ID seeds the chance in between, like a fingerprint's minutiae.
- **Five worlds that move with it:**
  - **◎ Print:** ridges traced along an orientation field built from the class's cores and deltas, evenly spaced inside a fingertip. Time runs out from the core; each ridge's colour, weight and breaks are the sound at that moment. Silences leave rings, onsets end ridges, noise turns them to dots. While it plays, the print grows from the core and its onsets flash.
  - **〰 Flow:** thousands of particles in a field made from the sound: a calm, pitched sound flows in long curving currents, motion makes eddies, each onset is a burst. The still is a long exposure of the whole sound; while it plays the field lives.
  - **⛰ Terrain:** the spectrum as a landscape you travel over, in lines, a mesh or dots by how pitched it is, under a night sky or a pale dawn; onsets are fountains of light.
  - **✿ Bloom:** a mandala of superformula rings, one for each moment: its symmetry is the pulse, petals rounder for a calm sound and sharper for a busy one, shaped by the spectrum.
  - **∞ Harmonograph:** a figure for each chord of the progression, laid over each other: pendulums tuned to the chord (3:2, 5:4, 6:5), a hair out of tune so they turn. While it plays, the chord sounding shines.
- **A reading of its music:** key (a key or its relative, by the chord it starts and ends on), pulse (only when there are real onsets), character, its strongest colours and a chord progression. **✎ Start a song from it** makes a new song in its key and tempo with its chords.
- **An ambient piece grown from it:** pads on those chords (the filter follows the brightness), a drone, bells on its onsets in the key's pentatonic scale, wind for its noise and, if you like, the recording itself an octave down. Made faster than it plays.
- **How it listens:** notes from interpolated spectral peaks; how pitched it is from the share of energy in sharp peaks; brightness from the spectral centroid; onsets and motion from each band's level in dB; all on the same frequency grid at any sample rate, so a sound reads the same at 22.05, 44.1 or 48 kHz.
- **Keep it, share it:** ⤓ Artwork (2048 px PNG with its title and reading), ⤓ the piece (WAV), ⏺ a video of the world moving with the piece, and **🔗 Copy link**. The link carries the print, not the sound: whoever opens it sees the same worlds and the same reading, and hears the same piece, grown on their device.
- **Your soundprints:** the prints you make (and ones you ☆ Keep) are kept in this browser, newest 48.
- **Where it is:** Save & export ▸ ◎ Soundprint…, a clip's menu, Finish it (the master) and, on a phone, More ▸ Soundprint. It's a room: the site loads it the first time it's opened. The Audio kill switch stops it.

### Tests
- **`e2e-soundprint` (49 checks):**
  - a made-up song (Am F C G at 100 BPM) is read as A minor, 100 BPM, Am – F – C – G, its onsets the beats; the print is under 1.4 kB;
  - the same sound makes the same print, and noise makes another (texture, no pulse);
  - a calm pad, rain and fast drums make different kinds of print (class, ground, colours), and a sound reads the same at 22.05, 44.1 and 48 kHz;
  - each of the five worlds draws its own picture in colour;
  - the piece sounds all the way through at −1 dBFS, is the same every time from the print alone, and stops with the kill switch;
  - artwork, WAV and video downloads;
  - the link opens the same print, reading and piece elsewhere, with no sound, and a cleaned address; on a phone it fits;
  - Your soundprints, a title with markup shown as text, a broken link, the microphone, and Start a song from it;
  - nothing fetched from anywhere else.
- **`e2e-rooms`** lists the new room.

## 2.60.0 — 2026-11-08 — Drops: new music from the studio, public for 7 days, after review

### New
- **🌍 Drop it** (Finish it, once the song is mastered). Share a finished song publicly, for 7 days.
  - **What's sent:** the master, compressed in your browser to an Ogg Opus file (128 kbps stereo, made with WebCodecs, playable in every current browser), with a title, the name you choose, a note and, if you like, the song itself as a link (words, chords and the band; no recordings).
  - **Review first:** it waits, privately, for the site's owner to listen. Once approved, it's on **the-daily.studio/drops** for 7 days, then gone.
  - **Rules:** you tick that the music is yours, and the sharing terms ask once more. A song still played over someone else's record can't be dropped (✦ Make it ours first). Sending needs Sign in with GitHub, with up to 3 drops a day per account.
- **`/drops/`, the public page:** each drop with its title, who made it, the note, a player, how long it has left, a link that opens the song in the studio (to make your own version), and ⚑ Report.
- **`/drops/review/`, for the site's owner:** listen to each waiting drop, then Approve (public for 7 days) or Reject (deleted), and take down anything live. It uses the GitHub sign-in from the studio on that browser; only the owner's GitHub account (`OWNER_GITHUB_ID`) is let in.

### Fixed
- **The song bar fits the window again.** The song journey and the 🛡 chip (2.56) made the bar wider than the window at 1440–1920 px (`e2e-layout`). Now:
  - the journey is a thin six-part bar along the bottom of the song's title, which opens it when pressed;
  - Saved and "where your songs are kept" are one control beside undo: ✓ when they're kept somewhere else as well, ⚠ when only in this browser. It opens Keep my songs safe.

### The Worker (`worker/drops.mjs`)
- **Routes:** `POST /drops/api/put`, `GET /drops/api/list` (cached a minute), `GET /drops/a/<id>`, and for the owner `review`, `pending/<id>`, `decide` and `remove`; plus `report`.
- **Storage:** waiting drops and reports stay in the private bucket, approved ones go to a public bucket (`DROPS`), and 7-day rules on both delete them.
- **Checks:** only Ogg audio is accepted, up to 15 MB. Titles, names and notes are plain text (`<` and `>` removed), and a link that isn't a song link is dropped.
- **Limits:** 3 drops a day for each account (counted even after a drop is approved or rejected) and 100 waiting at once.
- **Off until set up:** without the public bucket bound, every route says "not set up". The owner's account number is already in `wrangler.jsonc`.

### Terms
- **The sharing terms are version 3,** asked once more: songs you choose to drop are public for 7 days after review, can be reported, and can be removed by the site's owner. PRIVACY.md and TERMS.md say the same.

### Tests
- **`e2e-drops` (16 checks):**
  - the Ogg file is real audio of the master's length;
  - the terms ask first, and Drop it waits for "this is mine";
  - a drop waits privately, and nothing is public before approval;
  - the review page lists it, its markup arrives as plain text, and the owner can listen;
  - Approve publishes it;
  - the public page lists it as text with "7 days left", its audio plays from this site, and it links to the song;
  - a song over a record can't be dropped.
- **`worker.test` (63 checks, 17 new):**
  - off until set up;
  - sign-in, Ogg only, title and name required, markup and non-song links removed;
  - nothing public before approval, and only the owner reviews and listens;
  - approve, the public list (address, end time, caching), gone after 7 days;
  - report, remove, reject;
  - 3 a day counting decided drops, and another site can't drop.

## 2.59.0 — 2026-11-08 — Load your copy, and Make it ours

### New
- **♪ Load your copy.** A song link for a song played over a record now names the record ("Joy – Artist") and carries a **fingerprint** of it: about 400 bytes describing how its sound rises and falls for 40 seconds from the song's first downbeat. Never the audio.
  - **What the person who opens it sees:** "🎵 Played over…", and the song bar offers **♪ Load your copy of "Joy"**. They pick their own file. It's split and analysed as usual, without changing the song (its title, tempo and chords stay), and lined up: the studio finds where the fingerprint fits best in their file and puts the song's first downbeat there, on their copy's nearest beat. The alignment is kept with the song.
  - **What lines up:** a different rip, a longer intro or a second of silence before the music.
  - **What doesn't:** a different recording isn't taken for the same one. The studio says the match isn't clear and leaves the copy at its own first downbeat.
  - **The fingerprint** combines onsets with the loudness contour (log energy against its own last second). Silence is floored 30 dB under the average and onsets are capped, so a quiet start or one loud hit can't outweigh the rest.
- **✦ Make it ours** (the track chip's menu). One press turns a song played over a record into the studio's own:
  - the chords found in the track (if the song has none), its tempo and key, and its drum groove;
  - the band (drums, bass, rhythm) playing them;
  - the record muted (✕ Unload removes it).
  
  The next link no longer names a record. Undo takes it back.

### Changed
- **Loading a track** has a `noFill` option (used by Load your copy) that leaves the song exactly as it is.

### Tests
- **`e2e-yourcopy` (12 checks), with a made-up 48-second record:**
  - the fingerprint is about 530 characters and the link carries it;
  - the song bar offers Load your copy;
  - "someone else's copy" (2.5 s later, 3 dB quieter) lines up at exactly +2.5 s, and the song isn't changed;
  - a different record (another tempo, chords and drums) matches 5% and isn't lined up;
  - Make it ours turns on the band over the song's chords and mutes the record;
  - the next link names no record, and Undo works.

## 2.58.0 — 2026-11-08 — Comments pinned to a moment, and a lyric helper

### New
- **💬 Comments pinned to a moment.** **💬 Comment** in the arrangement bar (or press **C**) pins a note to where the playhead is: "bar 12: rush here?".
  - **It's pinned to a bar and beat,** not a time in seconds, so it stays on the beat if the tempo changes.
  - **Comments show on the arrangement's ruler.** 💬 Comments lists them: jump to one, mark it ✓ Done, or remove it.
  - **They're part of the song,** so they're kept in its versions and go with it to sync.
  - **They travel in song links:** the open ones (up to 20), each at its place, with who wrote it. Opening the link shows them. When a round comes back as a new version, your comments and theirs are both kept, without doubles. Comments from a link are checked like everything else: places clamped, words cut to 280 characters, names to 40.
- **✎ Rhymes & syllables,** in the Write card's Lyrics row and on the phone's Words screen. A small panel follows whichever lyrics box you're typing in:
  - **Line by line:** each line's syllable count, and the rhyme scheme from the line endings (A B A B). Uneven lines stand out.
  - **Rhymes** for the last word you typed (or any word you enter): perfect ones grouped by syllables, common words first, then near rhymes. Click one to put it in at the cursor.
  - **The words:** 31,469 common English words (SCOWL levels 10–35, no proper names) with pronunciations from the CMU Pronouncing Dictionary, in `data/rhymes.txt`. It's fetched from this site the first time the helper opens (about 170 KB compressed), then kept offline. The Write card's own syllable counts and rhyme scheme use the dictionary once it's loaded.
  - **Without the word list** (the single-file app, or offline before first use), syllables come from spelling rules and rhymes from the song's own words. Nothing you write is sent anywhere.

### Tests
- **`e2e-comments` (15 checks):**
  - **Comments:**
    - pinned at the playhead's bar, listed, jumped to;
    - a link carries the open ones, not the done one;
    - a hostile link's comments are clamped and cut;
    - opening a link shows them;
    - a round as a version keeps both sides' comments, without doubles.
  - **Lyric helper:**
    - 31,469 words load from this site;
    - dictionary syllables (everything 3, beautiful 3) and an A B A B scheme;
    - rhymes for "night" (light, fight, tonight, delight…) with near rhymes;
    - typing fills in the last word, and clicking a rhyme puts it in at the cursor;
    - the panel's scheme follows.

## 2.57.0 — 2026-11-08 — Finish it: master the song and make its release package

### New
- **✦ Finish it** (Save & export, the Songwriter's export menu, and the last step of the song journey). It runs on this device; nothing is uploaded.
  1. **The sound.** Your mix (without the master section) goes through:
     - a tone: Natural, Clean, Warm, Bright, Dense, or **matched to a reference song** you load;
     - a gentle glue compressor;
     - gain and a **look-ahead limiter**, until it reaches the loudness you choose (−14 LUFS for streaming, −16 for Apple Music and podcasts, −11 louder, −9 club, or no target), with **true peaks under −1 dBTP**. It's measured to BS.1770 and the masters are checked again after limiting.
     
     **▶ Before / After** plays both **at the same loudness**, so you hear the tone and dynamics rather than "louder". Switch at any moment, from any point.
  2. **Credits and splits.** Everyone in the song's history (rounds of Writing together, versions), with what they did (words, music, played, produced) and a writing share. The shares start equal and the window checks they add up to 100 %.
  3. **The release package**, in a folder or one .zip:
     - the **master in 24-bit**, and in **16-bit 44.1 kHz with dither for distributors**;
     - `lyrics.txt`, the chord sheet, `credits.txt` and `splits.csv`;
     - the song itself (`.daily-song.zip`);
     - a README with the loudness, the song's details and what a distributor will ask for.
     
     The release is kept as a version, and the song journey shows the song as finished.
- **Reference matching:** both songs' average spectrum (a 4096-point FFT across the whole song) is compared in eleven bands. The difference, smoothed, limited to ±6 dB and scaled by Amount, becomes eleven gentle filters. The reference stays on this device.

### Fixed
- **What the studio says about itself is accurate again.** Since GitHub sync, Sign in with GitHub and Send with recordings, "nothing is uploaded" and "it runs entirely in your browser" were no longer the whole story. Now:
  - the About page's *How it is made*, Help ▸ About, Settings ▸ Songs & data, the guided tour, the phone footer, the first page, the guide's FAQs, its footer and its description, and the README all say what's true: your songs stay on your device, and nothing is uploaded unless you choose to (GitHub sync to your own account, a folder, or recordings sent with a link, sealed and kept 7 days);
  - *How it is made* also says a small Cloudflare Worker handles the sign-in and those recordings, and that the studio was made with AI assistance.

### Tests
- **`e2e-finish`:**
  - the limiter never lets a sample past its ceiling, and leaves the rest alone;
  - matching a brighter reference lifts the highs and lowers the lows, within ±6 dB;
  - the master lands within 0.5 LU of −14 LUFS with true peaks at or under −1 dBTP;
  - Before / After is level-matched and switches at once;
  - credits name everyone in the history, with shares adding up to 100 %;
  - the package holds both masters (the distributor one 16-bit 44.1 kHz), lyrics, chord sheet, credits, splits, the song and a README;
  - the song is marked finished and the release kept as a version.

## 2.56.0 — 2026-11-08 — Versions, the song journey, and where your songs are kept

### New
- **✓ Versions.** Keep the moments of a song worth keeping. **Mark this version** keeps the song as it is (every section, the band, the arrangement) and its takes as they're placed and trimmed, with a name ("Demo 2") and a note.
  - **The window lists every version,** newest first: who made it, when, how many takes, and what changed since the one before ("Chorus: words; added Bridge").
  - **⟲ Go back to this.** What you had is kept as a version first ("Before going back to Demo 2"), so nothing is ever lost.
  - **⧉ Open as a copy:** a song of its own, with the version's recordings.
  - **A version's recordings are kept** for as long as the version is, even after the take is deleted from the song. Versions travel with the song to your folder and to GitHub (the last 20), and versions made on both sides are kept.
- **↩ Rounds become versions.** A round of Writing together that comes back for a song you already have now offers **Add as a new version of "Harbour Song"**. It becomes "Round from Sam", with Sam's note, and what you had just before is kept as a version. Rounds stop piling up as copies, and the 2.51 gap is closed. **Open as a separate song** still works.
- **The song journey,** in the song bar: six dots for words, chords, recorded, a version, shared and finished, plus the next step. Press it to see each step and go straight to it (Versions…, Send…, Finish…).
- **🛡 Where your songs are kept,** beside Saved: *Only in this browser* (⚠), *Backed up* (a backup in the last two weeks), *Kept in your folder* or *In step with GitHub*. Press it for Keep my songs safe.
  - **A gentle reminder:** once a week at most, and only once there's real work kept nowhere else.

### Tests
- **`e2e-versions` (17 checks):**
  - the journey and its next step;
  - the 🛡 chip before and after a backup;
  - marking a version with a take, a name and a note;
  - a deleted take's recording is kept for its version;
  - "what changed";
  - going back (audio and all) with what you had kept as a version;
  - opening a copy with its audio;
  - a round becoming "Round from Sam" with no copy;
  - versions going out with the song to sync.

## 2.55.0 — 2026-11-08 — Every lane out, ready to mix and master anywhere

### New
- **⤓ Save this lane (WAV)** in every lane's ⋯ menu: band parts (drums, bass, rhythm, lead), each take, and each stem of a backing track.
  - **Lined up:** each file starts at the song's first beat and runs the whole song plus its tail, so in BandLab, a DAW or a mastering app they line up when dropped at bar 1.
  - **The lane's mix, not the master's:** each one keeps its own level, pan and effects, and leaves out the master section (master tone, master level, limiter). That part belongs to whoever mixes it next.
  - **Drag it out:** the ready window has a file you can drag. Edge and Chrome drop it on the desktop or in a folder; pages that take dropped files can take it directly. Or press ⤓ Save.
  - The take's old **⤓ WAV**, the bare recording, is now **⤓ Raw clip**.
- **📦 Export for mixing & mastering** (Save & export, the Songwriter's export menu, and **📦 All lanes…** in any lane menu): choose the lanes, then a folder (Edge and Chrome write straight into it) or one .zip. You get:
  - **00 Premaster:** the full mix without the master section, turned down to peak at −3 dBFS if louder, which leaves headroom for mastering;
  - **01, 02…** each lane, numbered in the arrangement's order;
  - **README.txt:** the tempo, time signature, key, sample rate and length, how to line the files up, and any level change.
  
  Levels stay as mixed. A lane that would clip is turned down just enough, and the README says how many dB to raise its fader to get the balance back. Silent lanes are left out. Only one lane's audio is in memory at a time, so long songs work on ordinary laptops.
- **Copy and paste:** browsers only put text and pictures on the clipboard, never audio, so moving a lane between apps is done by dragging or through the folder.
- **On the first page:** "Share Joy, by Tehau. **The story**" (shorter).

### Fixed
- **Links that piled up** (`/guide/about/guide/getting-started/…`). When the network failed, the offline copy served the studio at any address, and its relative links grew one level each time.
  - Offline, the studio is now only served at its own address; any other page says it's offline, with a link home.
  - The studio also goes to its own address if a server ever hands it out inside a guide, legal or backstage address.

### Under the hood
- The fast renderer takes `raw`: the mix as it leaves the strips, straight out.
- The zip builder takes a file with its checksum worked out ahead of time, so big WAVs aren't held twice.

### Tests
- **`e2e-lanesout` (15 checks):**
  - a take's first sound is within 2 samples of its place in the song;
  - with the master level at 30 %, the take still comes out at its own level;
  - every lane is the same length;
  - the band, mixer, take mutes and monitoring are untouched afterwards;
  - the drag carries the WAV as a file and as a desktop download;
  - ⤓ Save gives 24-bit stereo;
  - the .zip holds the premaster, the numbered lanes (all the same length) and a README with the tempo and "bar 1".
- **`e2e-requests` (+2):** the studio inside another page's address goes home, and the offline fallback is only at its own address.
- **`e2e`:** the lane menus offer ⤓ Save this lane and ⤓ Raw clip.

## 2.54.0 — 2026-11-08 — Send a song with its recordings

### New
- **🔗 Send ▸ 🎙 Include my recordings.** A song link can now carry the song's takes, so whoever opens it hears your voice and guitar, not only the words and chords. They can add their own take and ↩ Send it back the same way.
  - **Compressed:** in the browser, with its own Opus encoder (96 kbps), about 0.7 MB a minute of take.
  - **Encrypted:** in the browser, with a new random key for each send (AES-GCM, 256-bit). The key is added to the link after the `#`, which browsers never send to a server. The site, Cloudflare and the site's owner keep only bytes they can't open.
  - **Kept for 7 days,** then deleted. The sender can **Take them back** sooner.
  - **Sending needs Sign in with GitHub** (one account behind each send, and a daily limit). Opening never needs an account.
  - **Not sent:** the backing track you loaded, which is usually someone else's recording. The beat and the band travel in the song as before.
- **Opening one:** the invitation says "🎙 With recordings, until <day>". **Open** brings the song in as a new song, with the takes in their lanes:
  - same name, kind, place in the song, level and pan;
  - sample-aligned: the receiving browser works out exactly how much of the codec's lead-in its decoder already dropped, from the frame lengths and the Opus header, so a take lands where it was.
  - If the recordings have run out, were taken back, or the link was damaged, the song still opens, and it says why.
- **⚑ Report** on a link with recordings sends the reason to the site's owner, with the link's key if the person agrees, so the owner can listen and remove it.

### The Worker (`worker/share.mjs`)
- New routes: `POST /share/put`, `GET /share/<ref>`, `POST /share/delete` and `POST /share/report`. They're stored in the private R2 bucket `thedaily`, bound as `SHARES`, with the bucket's 7-day lifecycle rule; the Worker also refuses anything older.
- **Limits**, so nobody can run up the bill or use it as free file storage:
  - 25 MB a send;
  - 10 sends a day for each GitHub account;
  - 200 sends and 3 GB a day in all.
  
  They're counted by listing the day's files in the bucket, so no other storage is needed.
- **Only the studio's own sealed packages are accepted.** What's stored: the encrypted bytes, under a random name, with the GitHub account's number for abuse reports (deleted with it). The GitHub token is used once to ask GitHub who is sending, and is never kept.
- The service worker never caches `/share/`.

### Terms
- **The sharing terms changed, so the app asks once more before the next share.** One exception to "the project hosts nothing": recordings you choose to send with a link are kept, encrypted, for 7 days, can be reported, and can be removed by the site's owner. PRIVACY.md, TERMS.md and Help ▸ About say the same.

### Tests
- **`e2e-sendrec` (21 checks):** two people, with the site's real Worker and an in-memory bucket.
  - The package is sealed: no song, take or file name can be read in it, and the key never leaves the browser.
  - A take at 44.1 kHz comes back at 48 kHz exactly as long, lined up with the original to the sample, and within 1 dB.
  - Reports.
  - A tampered key, a share that was taken back, and no sign-in.
- **`worker.test`:** 46 checks, 22 of them new: sign-in, origin, package check, size (including an upload that hides its size), the daily limits, 7-day expiry, take-back and reports.

## 2.53.2 — 2026-11-08 — Sign in with GitHub: the last step, as buttons

### Fixed
- **Signed in with GitHub, a studio repository that was there was called missing.** The app can only see the repositories it has been given access to, and GitHub answers "not found" for the rest. So the studio said "my-daily-studio is not there" and told people to press a Connect button that wasn't shown.
- **Settings ▸ GitHub now shows the step that's left, as buttons:**
  - **Create "my-daily-studio" on GitHub** (private, name filled in), if it isn't there yet;
  - **Give the app access**, choosing *Only select repositories*, then that one (with a token: make sure the token covers it);
  - **Check again.** It also checks by itself when you come back to the tab from GitHub.
- Until the repository can be reached, nothing tries to sync, and Sync now, Share and Open on GitHub stay hidden. Disconnect is still there.

### Tests
- `e2e-github`: an app sign-in without access to the repository gets the new words and buttons, and nothing syncs. Once access is given, Check again connects and Sync now is back. (The stand-in for GitHub can now hide a repository from one token.)

## 2.53.1 — 2026-11-08 — Only what's meant to be public

### Security
- **The site is served only at its own addresses.** `wrangler.jsonc` turns off the `workers.dev` address and the preview addresses (`workers_dev: false`, `preview_urls: false`), so every visit goes through the domain's Cloudflare settings and HSTS. There is no origin server behind Cloudflare: the site is the Worker and its static assets.
- **Private files can't be committed or deployed by accident:**
  - `.gitignore` covers `.env` and `.env.*`, `.dev.vars`, key files (`*.pem`, `*.key`, `*.p12`) and Wrangler's local folder;
  - a Wrangler cache file that had been committed (it named the Cloudflare account; no key or token) is no longer tracked;
  - the deployed folder carries a `.assetsignore`, so Cloudflare would refuse to upload any of these even if one ended up there.
- **`verify:site` now fails a release** if the deployed folder holds any dotfile (other than `.well-known/`), an `.env` or `.dev.vars` file, a key, or a package or Wrangler file; if any such file is committed; or if the `workers.dev` or preview addresses are turned back on.

### Sign in with GitHub
- **The site's GitHub App is named in the page** (`BRAND.ghApp`: client id `Iv23liTjqEBQsgmGaE1Q`, app `tehaud-the-daily-studio`). Both are public. Settings ▸ GitHub now offers **Sign in with GitHub**, next to Connect with a token. It finishes once the Worker has its two secrets in Cloudflare ([docs/CLOUDFLARE_SETUP.md](docs/CLOUDFLARE_SETUP.md), Part D). Until then, a sign-in comes back with a plain message to use a token for now, and a cancelled sign-in says so.

### Docs
- **[docs/CLOUDFLARE_SETUP.md](docs/CLOUDFLARE_SETUP.md):** a single checklist for the site owner: build and deploy settings, domains and DNS (and leftover records to remove), TLS, WAF and a rate limit on `/auth/*`, Sign in with GitHub with the Worker's secrets, and account safety. Song links need none of it.
- **CHANGELOG:** the headings for 2.47.1 to 2.52.0 had lost their version numbers; restored. `verify:site` now catches a release heading without one.

Checked on the live site for both addresses: `.env` and its variants, `.git/`, `.dev.vars`, `.wrangler/`, `wrangler.jsonc`, `package.json`, the source folders and common admin paths all answer 404. The only secrets the site uses (Sign in with GitHub's client id and secret) are Worker secrets kept in Cloudflare, never in the repository or the deployed files.

## 2.53.0 — 2026-11-08 — The story behind it, where people can find it

### New
- **An About page,** `/guide/about/`, with the story from Help ▸ About (*Made for creators*): why the studio exists and who made it. It links to LinkedIn, GitHub, the source code and The Daily. It's in the guide's top bar and linked from the in-app About.
- **On the first page:** "Made by Tehau DeBarthe: a musician, a software engineer and a dad. **The story**".
- **Structured data for search engines,** with no script and no tracking:
  - the About page is marked as an About page;
  - it names its author, with the LinkedIn and GitHub profiles as theirs;
  - the studio's page names the same author, with the same profiles.

  This lets search engines show the site for the author's name and connect it to those profiles.

### Changed
- **Help ▸ About ▸ Privacy at a glance** no longer says the page fetches a sample list (it stopped in 2.52). It now mentions song links (the song, and any name and note, inside the link) and GitHub.

### Tests
- **`verify-site`:** the About page is an About page and names its author with the LinkedIn and GitHub profiles.

## 2.52.0 — 2026-11-08 — Fewer requests, lower costs

### Changed
- **The Worker runs only where it has work:** The Daily's address, the moving page, Sign in with GitHub, backstage and the studio's own page. Fonts, code, icons, pictures and the guide are served as static files, which Cloudflare doesn't count as Worker requests. In 2.50 every file went through the Worker, so one visit was 10 to 15 counted requests; now it's one. `run_worker_first` lists the paths and needs Wrangler 4.20 or later.
- **A first visit downloads the page once.** The service worker saved its own copy twice more, as `/` and `/index.html`, and the second was a redirect on Cloudflare.
- **Later visits make one request:** asking whether the page has changed.
  - Fonts, icons and the studio's rarely used parts come from the saved copy with no request. Before, every visit fetched them again in the background.
  - A new version copies over any part whose name (and so whose contents) didn't change, instead of downloading it again.
- **The sample shelf is built into the page.** It used to be fetched four times on every visit, twice by the page and twice by the service worker.
- **Longer caching:** a year for the parts named by their contents, a month for the fonts, a week for icons and guide pictures.

### Fixed before release
- The new sample shelf placeholder wasn't filled into the hosted build, so the studio stopped part way through starting. Caught by measuring. **The build now refuses any unfilled placeholder,** and **the tests now fail on code errors the app catches and logs as warnings.**

### Tests
- **New `e2e-requests`** (9 checks): every request on a first and a later visit, the saved copy, the Worker's path list and the cache times.

## 2.51.0 — 2026-11-08 — Write a song together, by passing it back and forth

### New
- **From and Note in the send window.** Your name, remembered on this device, and a note go inside the song link ("Can you write the chorus?").
- **Who opens it sees:**
  - "🎵 Alice sent you a song";
  - the note;
  - the rounds so far: who changed what, and when (the last eight travel with the song).
- **↩ Send it back.** After opening a song someone sent, the send buttons say **↩ Send back to Alice** (in the Songwriter tools, Save & export and the Whole song sheet). The window lists **Your changes**, worked out from what the song was when it arrived: "wrote words for Chorus; changed Verse 2; added Bridge". They join the history in the link.
- **A first visit through a link is an invitation:** **▶ Play it** opens the song and plays it in Perform with the words as a sing-along, or **Open it in the studio**.
- **What you share links back to the song:**
  - a share page ends with **Open this song in the-daily.studio**;
  - a printed sheet carries a code to scan that opens it.
- **Nothing is uploaded:** the names, note and history ride inside the link with the song.

### Changed
- **The demo song's placeholder artist ("Your Name")** no longer travels in links.

### Tests
- **New `e2e-collab`** (15 checks). Two browsers pass a song back and forth: name, note, the invitation, ↩ Send back with what changed, both rounds, links back from share pages and printed sheets, and odd values cleaned.

## 2.50.0 — 2026-11-08 — The Daily at its own address

### Changed
- **The Daily now lives at https://journal.the-daily.studio/.** The studio's links point there.
- **`the-daily.studio/journal/` is now a moving page:**
  - **With a journal on this device,** it offers **Move my journal**, which hands the entries and settings to the new address in the browser, through a window it opens. Nothing is uploaded.
  - **Once moved,** **Remove the old copy** clears it from the old address.
  - **With no journal there,** it goes straight to the new address.
- **The Worker** sees every request first (`run_worker_first`) and tells the two addresses apart. `wrangler.jsonc` lists both as custom domains.
- **The sitemap** no longer lists `/journal/`.

### Tests
- **New `e2e-journal-move`** (14 checks). Both real addresses are answered in the browser from the build through the site's own Worker. It checks:
  - the move, exactly;
  - that nothing is removed until asked;
  - hand-overs refused from any other site;
  - the routes;
  - The Daily opening at its address;
  - the no-journal redirect.
- **`worker.test`** (24 checks) adds the routing.
- **`verify-site`** checks:
  - that both moving pages allow only their own script;
  - that neither app uses cookies;
  - that the sitemap no longer lists `/journal/`.

## 2.49.2 — 2026-11-08 — Security hardening, after a look at the live site

A passive evaluation of https://the-daily.studio/ (running 2.48.1): headers, the policy on every page, files that must not be served, the sign-in routes with bad input, and the privacy test run against the live site. The full findings are in [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md#live-site-evaluation-2026-11-08).

### Changed
- **jsDelivr is allowed only for the camera library's own folder** (`/npm/@mediapipe/tasks-vision@0.10.14/`), not for every package it serves. If something ever slipped a script tag into the page, it could not load an arbitrary package from there. The build reads the version from the code that loads it, so the two cannot drift apart, and `verify-site` checks it.
- **The not-found page has a security policy** that runs no script. On the live site, Cloudflare adds its analytics beacon and bot-detection script to pages on the way out, and the 404 page was the one place they could run.
- **`/.well-known/security.txt`** says where to report a security problem (GitHub's private vulnerability reporting).
- **CI's token is read-only** (`permissions: contents: read`), and **Dependabot** keeps the CI actions and the development tools up to date.
- **Tests can reach a deployed site through a sandbox's proxy** (`PW_PROXY=1` with `BASE_URL`).

### Found on the live site, to change in Cloudflare (no code can)
- **Web Analytics automatic setup is on.** Its beacon is blocked on the studio page by the policy, and the live privacy test fails 2 of 42 checks because of it. It loaded on the 404 page (fixed above) and is attempted on `/journal/`.
- **Bot detection ("JavaScript detections" or Bot Fight Mode) is on.** It injects a script that runs on `/journal/` (whose policy allows inline scripts) and on the 404 page, and it sets a `cf_clearance` cookie there. PRIVACY.md says no cookies.
- **Network Error Logging headers** ask visitors' browsers to report failed connections to Cloudflare.
- **`www.the-daily.studio`** has no DNS answer.
- **The `workers.dev` address** (`workers_dev: true` in `wrangler.jsonc`) serves a second copy of the site.

## 2.49.1 — 2026-11-08 — The first page, without the flash

### Fixed
- **A flash of the wrong first page.** Someone coming back saw the first-visit page, with its goals, in the default colours for a moment before Welcome back replaced it in their own theme. Now:
  - the card stays hidden until it's laid out for that person;
  - the saved light or dark is set before anything is drawn.

  So the first thing anyone sees is their own page.

### Changed
- **A first visit always opens on the dark green page**, whatever light or dark is saved. The one exception is hexagon colours chosen on purpose (Visuals ▸ hexagon colours), which the start page keeps.
- **Welcome back follows the person's appearance setting:** light or dark, from its first frame.
- **People coming back keep the goals.** Under **Pick up where I left off** they get **Or start something new**: play with a band, write down what you play, turn a hum into a song, record and layer, learn a song, or run a show. Each starts a new song and leaves yours as they are. Before, coming back removed the goals entirely.

### Tests
- `e2e-welcome` watches the page from its first frame:
  - a first visit is dark green with the goals, even with light saved;
  - Welcome back is in the person's own light or dark, and the first-visit page never shows.
- `e2e-guide` and `e2e-journal` expect the goals under the main button for returning visitors.

## 2.49.0 — 2026-11-07 — Writing on a phone, beginning to end

### Phone (Words)
- **A song map** above the section chips: every section as a coloured block, as wide as its bars. Tap one to write in it.
- **📄 Song**, beside ✎ Write and ♪ Chords, shows the whole song as a chord sheet in one column. Tap a section to write in it, or use **🎤 Perform** and **🔗 Send** right there. The phone remembers which of the three you were using.
- **＋** offers every kind of section (Intro, Verse, Pre-chorus, Chorus, Interlude, Bridge, Solo, Outro, or a repeat of one already in the song):
  - the new section goes after the one you're in, is named for you, and opens;
  - a second verse starts with the first one's chords.

  Before, ＋ offered five kinds and always added at the end.
- **⋯** for the section you're in: rename it, move it earlier or later, repeat it after itself, play from it, or delete it (undo brings it back).
- Section chips are underlined in their section's colour, the same colours as the map.
- The Write / Chords / Song switch fits on one line, and ⧉ Paste became an icon.

### Writing, beginning to end
- The Whole song sheet on a computer ends with **🎤 Perform**, **🔗 Send** and **🖨 Print**: write it, sing it, send it.
- A blank song says how to begin: add sections, paste a lyric sheet, or put a beat under it.
- The phone tour's Words card mentions 📄 Song, ＋ and ⋯. The guide page *Write a song over a beat* has a new section, *See the whole song*.

### Tests
- `e2e-songmap` (34 checks) adds the phone:
  - the map, coloured chips and the three ways to write, with nothing off the side;
  - ＋ Verse placing and naming Verse 2 with its chords;
  - the ⋯ menu and moving a section earlier;
  - Song as a one-column sheet with Perform and Send;
  - tapping a section to write in it;
  - the remembered way of writing.
- `e2e-phone-singer` uses the new ＋ menu.

## 2.48.1 — 2026-11-07 — The whole song as a chord sheet

### Write
- **Whole song opens as a 📄 Sheet**, laid out the way a chord sheet is pasted:
  - each section's name, then its words with the chords over them, or its bars of chords if it has no words;
  - the sections flow into as many columns as the screen holds, so a whole song fits without scrolling;
  - a section that repeats an earlier one word for word and chord for chord is one line ("Same words and chords as Chorus above"), with **Show** to open it;
  - while the song plays, the section playing is lit and kept in view.
- **Editing:** click a section to edit it where it is; **✓ Done** turns it back into the sheet. **✎ Edit all** shows every section's editor, as 2.48.0 did.
- **A− / A+** change the text size; smaller text means more columns.
- **⛶ Full screen** fills the window with the song. Esc, or the button again, brings the studio back.

### Fixed
- The new sheet code briefly reused the scale trainer's function name `wsFollow`, which started the trainer and repeated its "Connect your input" warning. It's renamed (never released).
- **The build now refuses two parts declaring the same function**, since JavaScript lets the later one silently replace the earlier.

### Tests
- `e2e-songmap` (27 checks) adds:
  - the sheet: sections, chords over the words, bars, a repeat shortened, columns;
  - editing in place;
  - full screen and Esc;
  - that the trainer stays quiet.

## 2.48.0 — 2026-11-07 — See the whole song, and Perform your way

### Write: the whole song
- **☰ Whole song**, a fourth way to see Write beside Tab, Words and Both. It shows every section in order, from intro to outro, each with its name, chords and words, all editable where they are.
- **A song map** above the section chips and at the top of Whole song:
  - a block per section, as wide as its bars;
  - coloured by kind (intro, verse, pre-chorus, chorus, interlude, bridge, solo, outro);
  - the section playing is lit and fills as the song moves through it;
  - click a block to go there.
- **＋ is a menu of section kinds:** Intro, Verse, Pre-chorus, Chorus, Interlude, Bridge, Solo, Outro, or a copy of any section already in the song.
  - The new section goes after the one you picked, and it's named for you: the second verse makes the first one "Verse 1" and itself "Verse 2".
  - A second verse or chorus starts with the first one's chords, with no words or tab.

### Perform: laid out your way
- **⚙ Layout**, remembered on this device:
  - **Show:** chords and shapes, big chord, lyric sheet, or the new **🎤 Sing-along**;
  - **Controls:** top right, bottom, or hidden until you move the mouse;
  - **Words:** in a band along the bottom like a sing-along, or in the middle under the chord;
  - **Text size:** small, medium, large or huge;
  - **Song map:** show or hide.
- **The new default is a sing-along:**
  - the controls are at the top right;
  - the words sit in a band at the bottom: the line being sung, its chords over the words, and the next line;
  - the song map is under the title. Click a section on it and the song plays on from there.
- **Sing-along** makes the words the show, with the chord smaller above them.

### Tests
- **New `e2e-songmap`** (18 checks):
  - the Whole song view and its map;
  - the add menu, section names and copied chords;
  - Perform's default layout (controls top right, words at the bottom), every Layout choice, and that it's remembered;
  - hide until I move;
  - the map playing on from a section;
  - a phone.
- **`e2e-perform-views`** adds the Sing-along view to the cycle of views.

## 2.47.1 — 2026-11-07 — Neutral names for the drum machines

### Changed
- The drum machines and the sub bass have neutral names:
  - **Deep Machine** (was 808): the long sub kick;
  - **Club Machine** (was 909): the short punchy kick;
  - **Glide Sub** (was 808 Sub): the bass that slides between notes.
  - The sounds are unchanged. Songs, song links, backups and snapshots saved with the old names open with the new ones.
- The Afrobeats beat is now called **Golden Hour** (was Afro Sunset).
- LICENSING.md, THIRD_PARTY_NOTICES.md and the docs use the new names. The open item about the style names is closed.

### Tests
- `e2e-kits`: a song saved with the old names opens with the new ones, no kit or bass sound has a model number in its name, and the Afrobeats beat is Golden Hour.

## 2.47.0 — 2026-11-07 — The tutorials, guides and licensing catch up

A release to close the gaps that 2.39–2.46.1 left in the tutorials, the documents, the licensing register and the tests, and to start a register of what is still open: [docs/GAPS.md](docs/GAPS.md). Nothing is removed.

### Tutorials
- **A new guided tour on a computer.** It now shows:
  - the workspaces and ✦ Simple;
  - connecting your input (Audio input opens first until one is connected);
  - play and record, the workspace's tools and the tabs;
  - the beats and the band, with Song build;
  - writing words, chords and tab;
  - recording, editing and 🎯 tuning a take;
  - song details, then saving, sending and sharing.

  In ✦ Simple that is the whole tour, 14 cards. In the Full Rig it adds the Rig and pedalboard, tones, the fretboard, the tuner, stems, transcription and the stage, for 21. The old tour was guitar-first, named a "latency chip" that moved in 2.38.1, and named a brand in its first step.
- **A new phone tour.** It follows the phone's bottom bar (Words, Sing, Beats, Tracks, More), then the guitar and the stage under More: 11 cards. The old one taught the sections phones had before 2.41.
- **Two new guide pages** on the site:
  - *Write a song over a beat*: beats, kits, Song build and sending a link;
  - *Sing, record and tune your voice*: takes, 🎯 Tune and the vocal pedals.
- **Getting started** now explains the workspaces, ✦ Simple, connecting first and the tour. The guide's *New lately* lists 2.40–2.46.

### Documents
- **USER_GUIDE.md:**
  - new: a *Guided tour* section, and a table of each workspace's panels and tools in Simple;
  - the 2.46.1 guitar is described;
  - corrected: the first visit now opens the Songwriter, not the Performer, and the phone records from Sing, not *Play*;
  - the contents line is complete.
- **README.md:**
  - highlights for 2.39–2.46.1, and a current Simple row;
  - *Your first five minutes* now starts with a beat, the words, a take, tuning and a link;
  - the panel table is current;
  - the roadmap no longer lists five things that have shipped.
- **AUDIO.md:** audio first, and how the band, Song build and vocal tuning are made.
- **SECURITY_MODEL.md:** song links as untrusted input, the rooms and their integrity hashes, tuned takes, the phone's microphone, and the wider agent tools.
- **TESTING.md:** every suite is listed (sixteen were missing).
- **HARDWARE_CHECKLIST.md:** a new section for what only ears and real devices can judge.
- **RELEASE.md:** version-neutral, with smoke tests for song links, rooms, beats and tuning.
- **The documentation index:** lists every document, including LICENSING, GITHUB, TERMS and GAPS.

### Licensing, privacy and terms
- **LICENSING.md** (audited for 2.47.0):
  - the methods behind vocal tuning (TD-PSOLA) and the 2.46.1 guitar (the Jaffe–Smith extensions of Karplus–Strong) are credited;
  - the 2.45 instruments are described as code, with nothing sampled or measured from anyone else;
  - a dates-only note on patents (none searched; the early ones have run their term);
  - "808" and "909" are recorded as style names, with an open item for the maintainer;
  - the guide's page count is corrected, and so is the claim that `/legal/` has no terms.
- **THIRD_PARTY_NOTICES.md:** the two new citations and the style-name note.
- **PRIVACY.md:**
  - rows for vocal tuning, singing on a phone and the band;
  - corrected: the offline copy fetches every room when it installs, not the first time each is used;
  - checked against 2.47.0.
- **TERMS.md** (updated 7 November 2026): the beats and the band are yours to use, and a song link carries the song itself. Both are under *Your content*, so the sharing terms you confirm are unchanged and nobody is asked again.

### For AI agents
- **`set_band`** can pick a beat and set:
  - the drum kit;
  - the bass sound (including the 808 Sub);
  - the keys and their sound;
  - the rhythm guitar (steel, nylon or electric);
  - Song build.
- **`edit_section`** can set a section's energy (1 to 5, or 0 for the one its name suggests).
- These are new optional inputs, so the API stays at version 2.
- **Fixed:**
  - `llms.txt` listed the renamed `open_shower_mode` as a tool, on a garbled line;
  - one answer still suggested `open_shower_mode`.

### Tests
- **New `e2e-tour`** (13 checks). The tour is walked in ✦ Simple, in the Full Rig and on a phone. Every step must find what it points at, the card must be fully on screen, the words must hold no brand names or moved controls, and the song must be unchanged.
- **`e2e-agent`** (70 checks) adds a beat, the kit, the sounds and Song build through `set_band`, and a section's energy.
- **`e2e-privacy`** (42 checks): its session now includes a beat with Song build, a song link and a tuned take, still with no request to any other site.
- **`verify-site`** checks that `llms.txt` lists only real tools.
- **`e2e` and `mobile`:** the tour step counts now allow the new tours (12–29 cards on a computer, 9–15 on a phone).

## 2.46.1 — 2026-11-07 — The guitar, not a harpsichord

### Fixed
- **The band's guitars sounded like a harpsichord.** Measured on a strummed G chord, three causes, all fixed:
  - **A near-white pick:** the pluck's burst now goes through two gentle filters, with the pick a little further from the bridge. Treble in the attack fell from 40% to about 21% on steel and from 31% to 13% on nylon.
  - **Strings that kept their highs:** the string loop has natural averaging plus a little extra damping per instrument (nylon the most, electric the least), so the highs fade as a real string's do. The treble still there half a second after the strum fell from about 10% to under 4%.
  - **A doubled copy:** 2.45's double-tracking repeated the same strum 14 ms later, which combs the sound the way a harpsichord's doubled strings do (correlation 0.48 at 14 ms). The second take is now its own performance: 9–21 ms behind, a few cents off and a little softer, panned to the other side. Correlation is now about 0.
- **Tuning:** the string loop's length now accounts for each filter's delay at the note's own frequency. Notes are within half a cent, low and high (the first try was 4–16 cents flat).

### Tests
- `e2e-instruments` (13 checks) adds:
  - highs that fade (steel under 7% and nylon under 4% of the sound above 2.5 kHz half a second on);
  - no comb from a copied double;
  - a softer pick;
  - tuning within 3 cents, low and high.

## 2.46.0 — 2026-11-07 — Simple in every workspace; audio first

### Changed
- **✦ Simple now simplifies the workspace you are in, instead of moving you to Songwriter.** Every workspace stays in the goal bar, and each keeps its own few panels and tools:
  - **Songwriter:** Write, Band, Save · Beats, Paste chords, Pads, Keys, Send as a link.
  - **Performer:** Stage, Band, Save · Record video, Camera, Vocal pedals, Replay.
  - **Creator Studio:** Stage, Save · Record MP4, Video shape, Replay, Thumbnail, Export.
  - **Practice:** Fretboard, Write, Band · −5 / BPM / +5, Teach me this song, Scales & ear.
  - **Teacher:** Write, Band · Learn, Today, This song, By ear, Riffs.
- **Full Rig is the one workspace with everything.**
  - Choosing it turns Simple off.
  - Turning Simple on from Full Rig takes you to the last workspace you used.
  - Turning Simple off again brings Full Rig back exactly as it was.
- **Visuals in Simple** shows four core looks (Hex Resonance, Concert, Chord Bloom, Prompter); **More looks…** shows the rest.
- **Audio first:** until an input is connected, every workspace opens its sidebar on the **Audio input** tab, because connecting comes before anything else. Once an input is connected, each workspace opens on its own tab again.

### Tests
- `e2e-simple`: 34 checks:
  - Simple stays in Performer with its panels and tools;
  - every workspace keeps its essentials;
  - Full Rig turns Simple off, and the round trip back to Full Rig is exact.
- `e2e-goals`: 46 checks, with every workspace opening on Audio input until an input is connected; each workspace's own shape is checked with an input connected.

## 2.45.0 — 2026-11-07 — Better instruments

### Changed
- **Piano:** twelve stretched partials; the lower four each have two strings a fraction of a cent apart, one quieter, for a slow shimmer that never cancels. The high partials ring bright on the hammer and die within a moment (harder playing is brighter). A felt-hammer knock and a small room.
- **Electric piano:** the hammer's bark on the tine, and the classic auto-pan tremolo.
- **Pad:** four detuned saws spread hard left and right, a sub, and a filter that breathes slowly.
- **Guitars:**
  - **Wooden body:** the acoustic sounds (steel, nylon) play through a body resonance made in the page (air and plate modes, about 100–800 Hz); an electric hardly does.
  - **Double-tracked rhythm:** the rhythm guitar is two takes, one each side, 14 ms apart.
  - **A room:** both guitar tracks get a small one.
- **Keys** have their own small room too.
- **Song build:** the verse now sits at −2.5 dB, and the crash and riser are more present, so a chorus still lifts clearly in the fuller mix.

### Added
- **Strings**, a new keys sound: a bowed section of five players a few cents apart across the stage, with vibrato that comes in after the bow and a soft attack.

### Fixed
- The offline render shared the guitar-body settings with the live engine, so after any bounce the live body setting pointed at the render's copy. Each engine now has its own.

### Tests
- `e2e-instruments` (9 checks), measured from the render with one note or chord alone:
  - the piano is bright on the hammer and mellower as it rings (5.5% → 3.3% of it above 1.5 kHz);
  - the strings swell in (+15 dB by 0.3 s), with vibrato arriving late (2.7 → 6.2 cents);
  - the pad is wide (left–right correlation 0.87 against 1.00);
  - the rhythm guitar is double-tracked (a copy 14 ms later on the other side);
  - the body boosts its resonances 62 dB over the treble, and the acoustic sounds use it while the electric hardly does.
- While building it, the tests caught:
  - a body resonance whose strength the convolver was normalising away;
  - a piano with too few partials to mellow;
  - two equally loud strings drifting into cancellation at 1.6 s.
- `e2e-speedkeys`: seven keys sounds.

## 2.44.0 — 2026-11-07 — Songs that build

### Added
- **Song build: the band plays each section at its own energy**, from 1 to 5 (Band panel, Simple's band, and Beats on a phone; every beat turns it on).
  - **Defaults from the section's name:** intro 2, verse 3, pre-chorus 4, chorus 5, bridge 2, solo 4, outro 2. Tap a dot to set your own.
  - **1:** hats and rim only, no bass, one harmony instrument.
  - **2:** kick, hats and a softer snare.
  - **3:** the groove as written.
  - **4:** adds an open hat at each bar's end and a crash to start.
  - **5:** everything, with sixteenth hats.
- **The level follows the energy:** the chorus plays at full level and the quieter sections sit under it (−5 dB at 1, −2 dB at 3), set on each band track after its compressor, so the difference is real and the chorus doesn't hit the master limiter.
- **Between sections:**
  - **Fill:** a drum fill in the last beat; a tom-and-snare roll when the next section is bigger.
  - **Crash:** on the first beat of a section at 4 or more.
  - **Riser:** a noise riser swelling through the last bar into a section that lifts.
- **Ending:** a song that does not loop ends on one hit with a crash, with the bass and chords left ringing.
- **Song links** carry Song build and the energies you set.

### Tests
- `e2e-build` (11 checks), measured from the studio's render:
  - intro, verse and chorus come out at rising levels (−21.6, −16, −14.3 dB), 7.4 dB apart against 0.2 dB with Song build off;
  - the crash at the chorus, the riser into it, and the ending;
  - a section turned down to 1, the controls on a computer and a phone, and the song link.
- While building it, the tests caught:
  - lifting the chorus did nothing, because the master limiter flattened it, so the quieter sections now come down instead;
  - note strength alone barely changed the level (each track's compressor evened it out), so energy is now a level stage per track;
  - a name clash had left the build stale;
  - the riser stayed inaudible on an exponential swell.

## 2.43.0 — 2026-11-07 — Vocal tuning

### Added
- **🎯 Tune a vocal take to the song's key**, on the device, from the take's menu (computer) or its row on Sing (phone).
  - **Natural:** most of the way to the note, gently; your slides and vibrato stay.
  - **Tight:** nearly all the way, quickly (pop).
  - **Hard:** snaps every moment to the note (the modern tuned sound; vibrato goes).
  - **Off:** gives back the exact original, which is kept in memory and in the song's own storage, so it survives a reload.
- **How it works:**
  - The pitch is read every 10 ms (YIN, with a level gate, and smoothed over one-frame octave slips and short gaps).
  - The target is the nearest note of the key's scale, held until the voice clearly moves.
  - The shift is TD-PSOLA: grains two periods long, cut at the same peak of each cycle, laid down closer or further apart at fractional-sample spacing.
  - The voice keeps its character, and nothing moves in time; the take keeps its length.
- **A room:** on the hosted site it is a 4 kB room, loaded the first time someone tunes.

### Tests
- `e2e-tune` (11 checks): synthetic voices with known problems.
  - A flat A (−32 cents) lands within a cent with Hard.
  - A note between A and B goes to A with Tight (within 3 cents).
  - Natural gets most of the way gently.
  - Hard flattens a ±45-cent vibrato (31 → 3 cents spread) while Natural keeps it.
  - Onset and length do not move, and Off restores the original sample for sample.
  - The room loads only on use, and the controls work on a computer and on a phone.
- While building it, the tests caught an octave-low artefact (grains cut on alternating peaks) and an 8–16-cent error (whole-sample grain spacing). Both were fixed before release.

## 2.42.0 — 2026-11-07 — Drum machines and an 808 sub

### Added
- **Three drum-machine kits, built the way the classic machines made their sounds** (part 03b). Still no samples: every hit is made in the page, so there is nothing to download or license.
  - **808:** a long sub kick that falls from about 150 to 48 Hz and rings, saturated so phone speakers can hear it. A snare of two tuned tones and a noise snap. Hats from six square waves at metallic pitches, band-passed and high-passed (centred near 9 kHz); the closed hat cuts off the open one. A clap of four quick bursts and a tail.
  - **909:** a short, punchy kick with a click, a brighter snare, and hats of metal and noise.
  - **Boom Bap:** a round, dusty kick and a fat saturated snare, with softened hats.
- **The acoustic kits are rebuilt the same way: Acoustic, Rock Room and Brush.**
  - **Kick:** a beater click, a pitch-dropping head and a resonant shell.
  - **Snare:** two tuned shell tones and a band of wire noise; ghost notes are softer and shorter. On **Brush** it is a slow swish instead of a crack.
  - **Hats:** metal and noise together, as a real hat is; the closed hat cuts off the open one. Brush hats are darker and quieter.
  - **Rim:** the rim row is a cross-stick (a short woody knock with a click), where the drum machines clap.
  - **Toms:** with the stick on the head.
  - **A small room:** a short reverb made in the page that each drum sends into. Rock Room has the most, Brush the least.
  - **Human feel:** every hit varies a little in strength and timing, so a groove never sounds stamped out.
- **808 Sub, a bass sound** (Band ▸ Bass ▸ Tone):
  - a sine with a short pitch drop, saturated so its upper harmonics carry on small speakers, held for the note;
  - one note at a time, sliding into the next while the last one still rings;
  - set to sit with the kit and under a voice, not over it.
- **Three new beats:** **Drill Night** (142 BPM, 808 and 808 sub), **Afro Sunset** (Afrobeats, 104 BPM), **Late R&B** (68 BPM, 808, sub and electric piano).

### Changed
- **The modern beats use the new sounds:**
  - **Trap Glide:** 808 kit and 808 sub.
  - **Night Drive:** 909 kit and 808 sub.
  - **Pop Drive:** 909 kit.
  - **Lo-fi Nod:** Boom Bap kit.
- The acoustic beats (folk, rock, reggae, blues, ballad, funk, bossa) keep their kits, which now use the rebuilt sounds above.

### Tests
- `e2e-kits` (14 checks), measured from the studio's own render:
  - the 808 kick is a sub near 47 Hz that rings, and the 909 kick is short;
  - the closed hat is bright (near 9 kHz), the open hat rings longer, and the clap is a burst;
  - the 808 sub is a held low A, an octave under the plucked bass;
  - the Rock Room snare carries its room, the rim is a short woody knock, the acoustic kick sits around 50–90 Hz and its hits vary, and the brush is softer;
  - the beats use the new kits.
- `e2e-simple`: Lo-fi Nod is now on Boom Bap.

## 2.41.0 — 2026-11-07 — The phone, for singers and songwriters

### Changed
- **On a phone the studio is now built around the words and the voice.** Few people have a guitar plugged into their phone. Computers and tablets are unchanged.
  - **The bottom bar is Words · Sing · Beats · Tracks · More** (it was Play · Write · See · Stems · More).
  - **The guitar** (rig, tones, tuner, I/O, tab, refine) and **the visuals** are under **More**, in rows of their own. Nothing was removed.
  - **A phone opens on the words** (or wherever you were last).
- **Words is a lyric notebook.**
  - Sections as chips, with **＋** to add a verse, pre-chorus, chorus, bridge or outro.
  - **✎ Write** gives the section's words in one big text box, with the live syllable count of the line you're on and of the line before.
  - **♪ Chords** shows every word as a big button with its chord over it, a syllable count per line, and the chords of your key below. Pick a chord, tap the word it lands on; **✕ Remove** takes one off; **Other…** takes any chord.
  - **⧉ Paste** takes a whole lyric sheet.
  - **The chords are the song's own `[Am]` markers**, so the desktop Write canvas, chord sheets, exports and song links all see them.
  - **Each chord is tied to its place in the words**, so typing, adding lines or rewriting around it keeps it on its word.
  - **A new section's band follows its words' chords**, one bar each. **↻ Band plays these chords** does the same for a section that already had bars.
  - One undo takes back each edit.
- **Sing is one screen.**
  - **🎤 Sing into this phone** makes the phone's microphone the voice input (no chooser).
  - **● Record over the beat** records it on the vocal lane, with a count-in, and **▶ Hear it back** plays it.
  - Your takes are listed (with delete), and the eight voice sounds (Clean lead, Ballad, Harmony lead and so on) are one tap each.
  - Pitch and your range, Hum it into a song, and Voice memo are there too.
- **The hexagons on a phone:**
  - **Sing** has a strip of the hexagon field at the top. It follows your voice, and the whole mix while the song plays.
  - **More ▸ Visuals** shows the hexagon graphic first, at nearly half the screen, with its looks and settings below (they used to come first, pushing it to the bottom).
- **Beats** is the beats and who plays. Band holds every setting.
- **The top bar keeps only the song's name.** The name opens the song sheet, which now holds the tempo, time signature, key and mode as well as the artist, tuning, capo and backing track. The arrangement toggle is now called **Timeline**.
- The song's name in the top bar is a phone-only button. A first build showed it on tablets and computers too, where it crowded the header over the song bar's New button; `e2e.cjs` caught it.
- Old phone section names (play, write, stems) still work for guided sessions and links. Panels the studio opens while it starts no longer move a phone off its screen.

### Tests
- `e2e-phone-singer` (25 checks; the hexagons on Sing and Visuals-first included): the bottom bar and opening on the words; typing keeps chords on their words; syllables; undo; placing and removing a chord on a word; a new section whose band follows its chords; Sing (the microphone as the voice, a voice sound, recording a take); Beats; the song sheet and putting its fields back; More with the guitar and the visuals; the old names; a desktop untouched.
- `mobile` (every section on two phone sizes, landscape and tablet), `e2e-phone-panels` and `e2e-layout` updated for the new sections.

## 2.40.0 — 2026-11-06 — Send a song as a link, and room to grow

### Added
- **🔗 Send as a link.** The song travels inside an ordinary link to the studio, after the `#`. Browsers never send that part to a server, so nothing is uploaded or stored anywhere.
  - **What it carries:** the title, key, tempo, time signature and tuning; every section's chords, words and tab; the band (the beat, drum pattern, bass, rhythm guitar, keys); and the piano roll's keys and bass line. Recordings stay with you; a share page carries audio.
  - **Size:** the browser's own compression keeps it short. A full song with a beat, tab and words is about 900 characters.
  - **Sharing:** Copy link, Share… on phones, or a QR code to scan across the room. A warning shows when a link is long enough that some chat apps might cut it.
  - **Opening one:** the studio offers the song by name, with what it holds, even over the first page on a first visit. **▶ Open and play** opens it as a new song and starts it; your own songs are untouched. The link is taken out of the address, so a reload does not offer it again.
  - **Where:** 🔗 Send as a link in the Songwriter tools (Simple too), and in Save & export.
  - **Safe with any link:** everything in a link is treated as untrusted. Lengths are capped; numbers are clamped; names are checked against the studio's own lists; only real chords are kept; the unpacked size is limited while it unpacks; and text is never turned into page elements.
- **Rooms: the hosted site loads rarely used parts the first time they are used** (`scripts/rooms.mjs`, part 00). The first three are the transcription engine (fetched when you open Transcribe), MIDI import and Shower mode.
  - Each is a small file named by its contents, checked with Subresource Integrity, and kept by the service worker for offline use.
  - A room sees the studio's live song exactly as inline code would. The build refuses rooms that lean on each other, or a core that relies on a room's state.
  - New big features can go into a room without making the first load heavier.

### Changed
- **The hosted page is 578 kB gzip, from 684 kB**, with this release's features included.
  - The two fonts are now files beside the page (preloaded, and the guide pages already used them) instead of being embedded.
  - The rooms above are no longer part of the first load.
- **The single-file `index.html` is unchanged in spirit:** it still carries every part and both fonts inline, so it opens from disk and in CodePen as before. Only the hosted site (`dist/`) is split.
- **The tests run on the hosted site's build** (`dist/`, built automatically when stale). `STANDALONE=1` runs them on the single file, and CI does that for MIDI, Shower mode, song links and Simple.
- **The release gate checks the rooms:** each is shipped, from this site only, matches its hash, reaches no other site, and stays under 150 kB gzip. The page's policy now allows scripts from this site (`'self'`) beside its own inline one.
- **Shower mode's ways in** (hold the logo, or type "shower") moved into the core (part 73g), so they work before the room has loaded.

### Fixed
- A song link naming the scale or tuning `__proto__` could reach the app's drawing code. Names are now looked up only among the studio's own entries. The new hostile-link test found this before release.

### Tests
- `e2e-rooms` (17 checks): the page starts without rooms and links its fonts, a stand-in loads its room and hands over, one hashed script per room, a live song, a failed load that can be retried, and Transcribe fetching its engine.
- `e2e-songlink` (17 checks):
  - the link itself, the QR code, and an exact read-back;
  - nothing in any request;
  - a first visit, and someone who keeps their songs;
  - hostile links (markup, numbers out of range, oversized), a compression bomb, a truncated link and an unknown format.
- `e2e-backstage-pages` serves the repository (it writes its pages under `test/out/`). `e2e-privacy` allows this site's fonts and rooms. `e2e-shower` loads the room before reaching into it. `e2e-simple` now expects the fifth tool.

## 2.39.0 — 2026-11-05 — Simple is the Songwriter, with beats

### Added
- **🥁 Beats: a ready band to play, sing or write over, in one tap.** Eleven beats: Easy Folk, Pop Drive, Garage Rock, Lo-fi Nod, Night Drive (dance), Trap Glide, Island Sway (reggae), Slow Burn (blues shuffle), Quiet Ballad, Funk Pocket and Bossa Evening.
  - Each is a groove, a tempo and a band (drums, bass, and guitar or keys where the style wants them). Tapping one sets the band and the tempo and starts it looping.
  - A song with no chords yet gets the beat's progression in the song's key. A song that has chords keeps them, and the beat plays them.
  - One undo puts your band, tempo and chords back.
  - They are played by the studio's own instruments, so there are no audio files to download or license, they cost almost nothing in page size, and they follow the key, chords and tempo. The grooves were written for this studio.
  - Where: the top of the Band panel, and **🥁 Beats** in the Songwriter tools.

### Changed
- **✦ Simple is now the Songwriter workspace.** A first visit on a computer opens there (it was the Performer).
  - Switching Simple on from another workspace moves to the Songwriter. Switching it off puts that workspace back exactly as it was: sidebars, panels, tabs and the open panel.
  - The goal bar shows only the Songwriter, with "Make a song: pick a beat, play or sing over it, put the words under the chords", and four tools: **🥁 Beats** (highlighted), Paste chords, Pads and Keys. Vocal pedals, the piano roll and "Perform it →" wait for the full studio.
- **The Band panel in Simple is the beats and who plays:** drums, bass, guitar and keys, each with a switch and a level. **Show every band setting** brings back the kit, patterns, step grid, styles and instruments, with the beats on top.

### Removed
- **Leftovers from retired features**, so the beats fit in the 700 kB budget. Nothing removed was used anywhere: about 2.7 kB of styles for the old first page, layout menu and song dialog, seven functions and six constants nothing called, and 22 names listed twice in the test hook. The page is just under 700 kB gzip again.

### Tests
- `e2e-simple`: 31 checks (up from 24), covering the Songwriter, the beats, undo, the band view and getting your workspace back.
- `e2e-goals` and `e2e`: a first visit opens the Songwriter.

## 2.38.1 — 2026-11-05 — Latency moves to the status line

### Changed
- **The latency estimate ("≈60 ms est.", or the measured round trip) moved from the top bar to the status line at the bottom**, next to the audio engine's details. The top bar keeps what you act on: the master level, the input, Simple, appearance, settings and help. The measured value and the loopback test are still in I/O ▸ Advanced.

## 2.38.0 — 2026-11-04 — ✦ Simple, across the board

### Changed
- **✦ Simple now simplifies inside the panels too**, not just the controls around them. Switching back keeps your arrangement exactly as it was.
  - **Panel tabs:** only the essentials (Write, Band, Stage, Save & export), plus the backing track once one is loaded and whatever is open. This applies even in workspaces that have more; Performer's Guitar sound tab waits for the full studio.
  - **Tones:** eight core tones, from clean to metal, plus direct. **Show all 27 tones** lists the rest; the search and categories are in the full studio.
  - **Audio:** one input (connect, set my level, hear myself) and the output. **＋ Add a microphone for your voice** brings in the second input. The camera, MIDI, the signal path, the trim knob and troubleshooting are in the full studio.
  - **Sidebars:** the Refine tab, the Monitor widget picker and the chord finder are tucked away.
  - **Arrangement lanes:** they keep on/off, mute and solo, without faders, pans and effects.
  - **Workspaces:** the Full Rig button is hidden.
- **A guided session in Simple** now says which new tools are ready and that switching Simple off shows them. Before, it claimed it had added them to the tab strip.

### Tests
- `e2e-simple`: 24 checks (up from 17).
- `e2e` and `e2e-guide`: updated for first visits starting in Simple.

## 2.37.1 — 2026-11-04 — Smaller page

### Changed
- **Line breaks the browser cannot miss are left out of the page's script.** The build already removed comments, indentation and needless spaces. It now also drops a line break where no automatic semicolon could depend on it: after punctuation that needs more to follow (`;` `{` `,` `(` `=` `&&` and so on, but not `)` `]` `}` `++` `--`), and before `)` `]` `}` `,` `;` `.` `?` `:`. As before, the build checks the result token by token and fails if anything but whitespace changed.
- **The result:** the page is 697 kB gzip (from 703 kB) and 562 kB with brotli, back under the 700 kB budget. The budget is 700 kB again.
- **Not done:** shortening names (mangling). Shortening every long name, which would not even be valid, would save at most about 32 kB gzip. A safe version needs a JavaScript parser, which the build does not have and would have to add as a dependency.

## 2.37.0 — 2026-11-04 — For electronic music: piano roll, sidechain, MIDI out

### Added
- **🎛 Piano roll** (`src/parts/87-electronic.js`; Songwriter tools, and in the Keys room). Draw the keys part or the bass line of a section on a grid of 16ths:
  - click to add a note, drag right to lengthen it, click to remove it, Shift-click for loud, medium or soft;
  - show only the scale's notes, and move up or down an octave;
  - loop the section while you draw;
  - one undo per edit.
  It writes the same part the Keys room records into.
- **Sidechain ducking:** each kick dips the keys, the bass, the rhythm guitar or the loaded track (your choice), with a set depth and release. It is kept with the song and is in bounces too. Each mixer track gained a duck stage before its fader.
- **MIDI out** (Settings ▸ Pedal & MIDI sync): the keys part, the bass (played or made up) and the drums go to a MIDI device on their own channels (1, 2, 10; drums as General MIDI notes).
  - Notes are timed to what you hear (scheduled ahead, allowing for output latency), and stopping sends all-notes-off.
  - "Also play the studio's own sound" can be turned off so the hardware takes over.
  - The Keys room sends live, so a controller can play a synth through the studio.

### Changed
- **The page's size budget** in `verify:site` went from 700 kB to 750 kB compressed: this release took the page to about 703 kB gzip, after 2.35–2.37 added about 45 kB. 2.37.1 brought it back under 700 kB, and the budget back to 700 kB.

### Tests
- New `e2e-electronic` (20 checks).

## 2.36.0 — 2026-11-04 — Bass guitar

### Added
- **4, 5 and 6-string bass.**
  - **Choosing it:** Settings ▸ Music ▸ My instrument, or the tuning list. The bass tunings are standard, drop D, half-step down, D standard, 5-string with a low B or a high C, and 6-string.
  - **What follows the strings:** the tab editor, the tab text, both fretboards, the transcription view, the tuning editor and the tuning check.
  - **Bass tab** plays with a bass sound.
  - **The band's bass** steps out while you play bass, and comes back when you switch to a guitar tuning.
  - **The band's rhythm guitar** keeps a guitar's chord shapes.
  - **The pitch tracker** reaches down to 27 Hz for a bass, so it hears a 5-string's low B, and keeps the guitar range otherwise.

### Fixed
- A tuning was named after the first listed tuning whose strings it matched, even if it had a different number of strings. A 5-string with a high C would have been called "Bass: standard". It now has to have the same number of strings.

### Tests
- New `e2e-bass` (15 checks).
- `e2e-learn2`: the simulated notes are held longer, so the wrong-note check also holds when the machine is busy. It failed once beside other tests in the 2.35 full run, then passed alone.
- The 2.35.0 full suite: 61 files, 1,944 checks passed.

## 2.35.0 — 2026-11-04 — Speed & key, and Keys

### Added
- **⏱ Speed & key** (`src/parts/85-stretch.js`), in the transport (on a phone, More ▸ Speed & key).
  - **Speed:** 50–125%, one press for 50/60/70/75/80/90/100%. The band, the click and the loaded track slow down without dropping in pitch. The song itself is untouched.
  - **Key:** −6 to +6 semitones for the track at the same speed. "Move the song's chords and tab too" transposes the song so the band follows. With no track, the key transposes the song. The track's shift is kept with the song.
  - **How the track is stretched:** a phase vocoder (2048-point frames, identity phase locking) then a cubic resampler, in a worker, two seconds ahead, per stem channel, so mute and solo keep working. Tested at 50%, 75%, +12, −5 and 60%/+3: pitch within 1%, the right length, the same level, and no click between chunks.
  - **Recording at practice speeds:** it waits until you're back at 100%, and recorded takes stay quiet, because takes are kept at the song's own speed.
- **🎹 Keys** (`src/parts/86-keys.js`).
  - **A piano under Write**, next to the fretboard (one at a time). It shows the chord playing (root in gold), the scale and what's sounding, and you can click or drag along it.
  - **The Keys room:** play with the mouse, touch, the computer keys or a MIDI keyboard. It plays into its own six sounds, the band's bass or the lead guitar.
  - **● Record into the song:** a keys part, a bass line (replacing the made-up bass in those bars) or lead tab. Notes are rounded to the grid, and one undo takes them out.
  - **Keys in the band:** five styles with smooth voice leading, a Keys chip on the band strip, and a Keys channel in the mixer and in bounces.
- **Workspaces:** Songwriter gets 🎹 Keys and Practice gets ⏱ Speed & key. On a phone, Keys and Speed & key are in More.

### Fixed (found while testing)
- The Organ sound failed to start (its vibrato pointed at the wrong node).

### Tests
- New `e2e-speedkeys` (29 checks).
- `mobile` now counts 15 desktop transport controls (⏱ is one); on phones ⏱ sits in More instead of the top bar.

## 2.34.0 — 2026-11-04 — Learn 2: feedback that teaches, Today, This song, By ear

### Added
- **Feedback after every go** (`src/parts/80b-coach-feedback.js`): the coach says what went wrong and what to do next.
  - **Wrong notes, on the neck:** the note it wanted (green) beside where you probably were (✕), and in words ("one fret too high"). **🔁 Practise notes 2–5** puts in a slower piece of just the tricky notes.
  - **Timing, on a strip:** each stroke or note is a dot, early above the line and late below, with misses hollow. It says whether you rush or drag, where you were furthest out, and offers **🐢 Slower**.
  - **🎧 Hear my take:** your attempt is recorded from the input while the coach listens, so you can compare it with the coach. It's kept in memory only and dropped when you move on.
- **📅 Today** (`src/parts/83-practice-plan.js`): about fifteen minutes, a new plan each day.
  - The plan is a warm-up, a review, the next new step on your path (with its explanation first) and a riff at your level.
  - Reviews come back after 1, 3, 7, 14 and 30 days.
  - A streak and a week count are shown, and finishing says so.
- **🎵 This song:** the open song as lessons.
  - Its own strum pattern, each section's chords in time with the band, its riff from the tab, then the whole song.
  - It starts at 70% of the song's tempo, and the ladder stops at the song's tempo. Progress is remembered per song.
  - It's also in the Practice workspace.
- **👂 By ear:** call and response.
  - The coach plays a short phrase in your key and scale with the tab hidden, then listens for you to play it back.
  - The phrase grows a note when you get it, and shrinks after two misses. **👁 Show me** reveals it.
- **The Teacher workspace's tools** are now 🎓 Learn, 📅 Today, 🎵 This song, 👂 By ear and 🎸 Riffs & licks, plus the teaching tools. Riff Lab, the atlas and the warm-ups are inside Learn.

### Fixed
- **Strum timing:** a stroke could count for two beats, so a late stroke also showed as early for the next beat. Each stroke now counts once, closest pairs first.
- **Learn's ticks:** any step passed now marks the Learn window to refresh when the coach closes.

### Tests
- New `e2e-learn2` (36 checks). `e2e-learn` updated for the new Teacher tools and Learn sections.

## 2.33.2 — 2026-11-04 — The coach stays in front

### Fixed
- **Riff Lab and the coach could disappear behind the Learn window.** 🎲 Another, ★ Keep and finishing a step all refreshed the Learn window behind the coach. That refresh reopened the window, which put it in front of the coach. The coach was still open underneath, so pressing 🎲 Make a riff again changed a riff you couldn't see.
  - The Learn window now waits until the coach closes before it refreshes.
  - Opening the coach always brings it to the front.

### Tests
- `e2e-learn` (54 checks): after 🎲 Another, after closing the coach and pressing Make a riff again, and after Another twice more, the coach shows the new riff and is the window in front. Two of these checks fail on 2.33.1.

## 2.33.1 — 2026-11-04 — Settings tidied; the megaphone pedal folds into Pedal & MIDI sync

### Fixed
- **Settings layout:**
  - Pedal & MIDI sync and Megaphone pedal sat in the left half of a two-column card, which squeezed their text and left the right half empty. A card with one block in it now uses the whole width.
  - Folder sync had an empty band at the top of its card, from a paragraph's default margin. It's gone.

### Changed
- **The megaphone pedal moved into Settings ▸ Pedal & MIDI sync** as a fold-out (📢 Megaphone pedal · optional), closed unless it's switched on. It no longer has its own section. Links that opened it (`openSettings('mega')`) now open the fold-out.
- **No pedal brands are named:** the app, the guides, the README and earlier changelog entries now say "a megaphone, radio or telephone voice effect pedal".

### Tests
- `e2e-megaphone`: its settings are in the Pedal & MIDI sync section, open when linked to, with no brand named and no separate section.

## 2.33.0 — 2026-11-03 — ✦ Simple

### Added
- **✦ Simple** (`src/parts/33b-simple.js`): one switch, at the top right and in Settings ▸ Workflow, for anyone who has never used a recording studio.
  - **What stays:** play, stop, ● record, Loop and Click (now labelled), the tempo and the key. Also: the song's name, Songs, New, undo, Perform and Voice; the six workspaces and their tools; ● Capture; the tab and the words; Mute all; the arrangement and Loop & layer.
  - **What is tucked away:** return to start, the bar · beat counter, time signature, the master meter, the latency estimate, the workspace button, artist, tuning, capo, scale and notes, and the Canvas / Song / Studio switch. Also: the Create → Perform → Share flow, the Tools menu, each band part's switch and the mix, tab techniques, fill styles, copy and paste, the arrangement's zoom, swing and lane tools, the stage's extra settings, and the status line.
  - On the Songwriter screen at 1600 × 900, that is 91 controls instead of 137.
  - Nothing is turned off or lost: the hiding is CSS only, and the same button brings everything back.
  - **Who starts in it:** a first visit starts in Simple, and "I know my way around" opens the full studio instead. Anyone who has been here before keeps the full studio until they press ✦ Simple.
  - Simple is kept per device (it doesn't sync). Phones keep their own layout.

### Changed
- The Tools menu's tab level called "Simple" is now **Essentials**, so it isn't confused with ✦ Simple. Its heading is "Which panels on the strip?". The panel strip keeps its own adaptive level in Simple mode, shown without numbers.

### Tests
- New `e2e-simple` (17 checks).
- `e2e`, `e2e-goals`, `e2e-privacy` and `e2e-workspace` updated:
  - a brand-new visitor starts in ✦ Simple and switches it off before using full-studio controls;
  - the menu level is now Essentials.

## 2.32.1 — 2026-11-03 — Fewer buttons, a steady theme, and your choice of red light

### Changed
- **Each workspace's tool row lost the buttons that did nothing new.** A tool that only opened a panel already on screen, or repeated a button already in view, is gone:
  - **Songwriter:** ✎ Lyrics & tab and ♯ Chords & scales opened what was already open. ● Capture idea repeated the ● Capture above the tab, and ⏺ Record idea repeated ● at the top. What's left: 🎸 Paste chords, 🎤 Vocal pedals, 🥁 Pads. Recording is now two buttons, each with its own job: ● at the top records sound, ● Capture above the tab writes the notes you play.
  - **Performer:** ● Record take (the ● at the top) and 🎤 Perform view (Perform in the song bar) are gone.
  - **Practice:** ⟲ Loop and ♩ Metronome (both at the top), ♯ Scales (Theory is already open) and ▦ Chords (the Fretboard is already the middle) are gone. What's left: tempo −5 / +5, 🥁 Pads and 🎼 Scales & ear.
  - **Teacher:** ▦ Fretboard (already on the right) is gone.
  - Each workspace's three steps say where the moved controls are.
- **Light or dark is now kept per device.** Folder sync and GitHub sync carried it between devices, so a phone in dark mode could switch a computer to dark the next time they synced. That is the likely cause of the "random" switches. Syncing now leaves light / dark / System alone. Palettes, accents and the rest still sync. **System** follows the computer, which may itself switch at sunset; Settings ▸ Appearance now says so.

### Added
- **Settings ▸ Appearance ▸ On air light:** Blink red (as before), Steady red, or Off. Off leaves the logo, the tab icon and the title alone while recording. It takes effect at once, even during a take, and is kept per device.
- **Settings ▸ Appearance ▸ Performance overlay:** the frames-a-second readout in the bottom-left corner (from Backstage ▸ Labs) now has a switch here, and a ✕ on the overlay itself hides it.

### Tests
- `e2e-goals`: no tool repeats a panel that is open or a button already on screen.
- `e2e-onair`: Steady and Off (including mid-take), the overlay's switch and ✕, and a sync from a dark-mode device leaving this one light while other settings still sync.
- `e2e-github` and `e2e-folder`: a synced setting (A4 = 442 Hz) reaches the second device; light / dark does not.

## 2.32.0 — 2026-11-03 — Learn: lessons that listen, riffs, Riff Lab and a map of the neck

### Added
- **🎓 Learn**, the front door of the **Teacher** workspace (also on a phone in **More**). The Teacher is now a place to be taught as well as to teach. Everything here is written for this studio, runs in the page, and uses the same input the tuner does: nothing new is downloaded or sent.
  - **The coach** (`src/parts/80-coach.js`): every step shows the notes on the neck and as tab, plays them for you (▶ Listen), then listens while you play them (● Play it). It plays its own little band (click, drums, chords, bass) and never touches your song.
    - It can honestly check notes (a note still ringing is not a mistake), timing against its click (and whether you rush or drag), chords held, chord changes in time, a minute of changes, strumming patterns, bends (how far, and in tune), vibrato (rate and width), and landing on a chord tone at each change while it plays a progression.
    - Hammer-ons, pull-offs and slides are followed by their notes; the coach cannot tell them apart from picking, and says so.
    - **Tempo ladder:** pass a step and it comes back 5 BPM faster. **−/+** set the tempo, **Backing** and **Click** switch the band and the click.
  - **Lessons** in four paths, about 60 steps: **Foundations** (tuning, first chords, changing in time, strumming, a first song), **Lead** (the pentatonic box, bends, vibrato, first licks, licks in time, soloing over the band), **Rhythm** (on the beat, eighths and accents, muted chugs, syncopation, the pocket) and **Technique** (alternate picking, hammer-ons and pull-offs, slides, string skipping, legato). Progress is kept in this browser.
  - **🔥 Warm-ups:** the spider, finger permutations, the chromatic walk, trills, one-minute changes and a scale sprint.
  - **🎸 Riffs & licks:** 40 original riffs and licks in blues, rock, funk, metal, country, pop, jazz, reggae and latin, by level. Any key; note by note or **⏱ In time** against a drummer; **➕ Put it in my song** adds it as a new section of tab after the one you are in, with the lead playing it (one undo takes it out); **⇩ Share as a file**.
  - **🧪 Riff Lab:** choose a scale, a feel (straight, funky sixteenths, shuffle, heavy half-time), one or two bars, how busy and a key, and it writes a riff you have never played. Then vary it: **Shift**, **Reverse**, **Major ↔ minor**, **Add bends**, **Higher** up the neck and **Sequence** it into two bars. **★ Keep** puts it in **My riffs**; **🎲 Another** writes the next one. The same seed always makes the same riff.
  - **🗺 Scale atlas:** the five pentatonic boxes (box 1 from the root), the seven three-notes-per-string positions, arpeggios (major, minor, 7ths, half-diminished) in five positions, the seven **modes over a band vamp** with the note that gives each mode its colour starred, and **target notes** over a progression.
  - **🍎 For teachers:** annotate, lesson notes and record the screen (as before), **This section as an exercise** (the tab of the section you are in, note by note), and **lesson files** (`.daily-lesson.json`) to give a student and to open one. A file is checked piece by piece; anything it does not understand is left out, and its words are shown as text.
- **The Teacher workspace** leads with 🎓 Learn, 🔥 Warm-ups, 🎸 Riffs, 🧪 Riff Lab and 🗺 Scale atlas; ✎ Annotate, 📝 Lesson notes, ⏺ Record screen, ▦ Fretboard and ♪ Transcribe are all still there.

### Fixed (found while testing the coach)
- Pressing ● Play it while the demo was still playing left the demo running, so the coach would have heard itself. The demo now stops when listening starts.
- Closing the coach and opening it again at once let the late `close` event stop the new step.

### Tests
- New `e2e-learn` (50 checks): the Teacher's tools; a lesson followed note by note (a ringing note is fine, a wrong one counts) and the tempo ladder; a chord held; strums against the click, early and late; a bend short of the note and in tune; vibrato too narrow and wide enough; landing on chord tones over the band; the riff library, its filter, a riff in another key and in time; Put it in my song and its undo; Riff Lab's determinism, scale, endings and variations; the atlas's boxes, positions, arpeggios, modes and target notes; an exercise from the song's tab; a lesson file round trip, files that are not lessons, and words in a file shown as text; progress after a reload; the coach on a phone.

## 2.31.1 — 2026-11-03 — The tab's red light in step with the page

### Fixed
- **The tab icon and the page now flip together.** The logo and the record buttons blinked together, but the browser tab's icon blinked a fraction of a second behind: browsers repaint the tab icon a little after it is set, while the page changes at once. The tab icon is now set first and the page follows it by 120 ms (`AIR_LAG`), so they flip together as seen. Calm and reduced motion stay steady.

### Tests
- `e2e-onair` times each tab-icon flip against the logo's: each logo flip comes about 120 ms after the icon's, and never before it.

## 2.31.0 — 2026-11-03 — Vocal pedals: Scream, de-esser, megaphone, doubler, harmony, echo and reverb

### Added
- **🎤 Vocal pedals** (`src/parts/79-vocalboard.js`): seven stompboxes for the voice, after the vocal polish. You open it from the Voice window, the Songwriter, Performer and Creator Studio tools, or the phone's More sheet.
  - **Where it applies:** the live voice goes through it, and so do vocal takes. Takes are recorded clean and played back through the board, so the sound can change after you sing. A fast bounce builds the same board offline.
  - **🤘 Scream:**
    - a gate, hard compression, and grit blended beside the clean voice and focused on the mids, so words stay clear;
    - growl from an analog-style octave divider (new `fw-oct` worklet), which adds no delay;
    - styles Rasp, Hardcore, Fry growl and Death growl.
  - **De-esser** (new `fw-deess` worklet): turns the band above 4–9 kHz down only while it's loud.
  - **📢 Megaphone:** megaphone, radio or telephone.
  - **Doubler:** two slightly delayed, moving copies, left and right.
  - **Harmony** (new `fw-harm` worklet): it finds the note being sung and moves it by steps of the song's scale, or to a tone of the chord playing. Voices: a third or a fifth above, a third below, a third and a fifth, or an octave. It works in bounces too.
  - **Echo:** tempo-synced divisions. **Throw** echoes only while the foot pedal is held.
  - **Reverb:** room, plate or hall, with the lows cut.
  - **Presets:** Clean lead, Rock grit, Scream, Ballad, Ambient echo, Harmony lead and Megaphone.
  - **By section:** a song can switch presets as it plays.
- **Foot pedal actions:** Vocal: Scream on / off, Vocal: next preset, and Vocal: echo throw. The throw is held: key-up, note-off and the footswitch coming up all release it.
- **The show reacts:** with Scream or Megaphone on, the show turns gritty, as for a megaphone pedal. This can be switched off.

### Fixed
- **The re-amp timing check in `e2e-latency`** failed again in the 2.30.0 full run, with exactly the same 3 ms shortfall as in 2.25. The 2.25.1 note was wrong to say the app change there fixed it.
  - **The real cause:** the test recorded through a ScriptProcessor on the page's thread, which drops audio when that thread is busy.
  - **The fix:** the timing tests now record with an AudioWorklet on the audio thread, which can't drop audio. The check still asks for ± 1 ms, and passes with four other test files running beside it.
  - The 2.25.1 change (late takes skip in against the audio clock) stays, as an improvement in its own right.

### Tests
- `e2e-vocalboard` (22 checks): every pedal measured by what it does to a signal, plus presets, sections, the pedal, the look and a phone.
- `e2e-gear` now expects ten pedal actions.

## 2.30.0 — 2026-11-03 — Your megaphone pedal drives the show

### Added
- **Megaphone pedal** (Settings ▸ Megaphone pedal, `src/parts/78-megaphone.js`; in Settings ▸ Pedal & MIDI sync since 2.33.1). It's for any megaphone, radio or telephone voice effect pedal between the mic and the interface.
  - **How it's heard:** such pedals usually have no MIDI, but the studio hears it in the vocal input, by the balance of lows, middle and highs that such an effect cuts and pushes.
  - **Teach it my voice:** three seconds with the pedal off and three with it on. Without teaching, general settings suit most megaphone sounds.
  - **While the pedal is on:**
    - the stage and the Visuals turn red-hot with scan lines and a jolt as it comes on, drawn into the picture so the projector and stage videos carry it;
    - the lights flash as you stomp it on, within your light comfort;
    - the words in Perform and the stream window go red and shake.
  - **Timing:** on within a third of a second, held through a breath, off a moment after you sing clean.
  - Each reaction can be switched off, and Calm and reduced motion keep the colour without the shake.
  - Nothing is recorded. Only six numbers from teaching are kept.

### Tests
- `e2e-megaphone` (17 checks), on synthesised low and high voices, clean and through a megaphone-like band limit and drive.

## 2.29.0 — 2026-11-03 — Pads, beatbox to beat, a foot pedal, MIDI clock and a stream window

### Added
- **🥁 Pads** (`src/parts/75-pads.js`), in the Band panel, the Songwriter and Practice tools, and the phone's More sheet.
  - **Six pads** on the band's own kit: kick, snare, hat, open hat, clap / rim and tom. Play them by touch, with A S D F G H (Shift for an accent), or from a MIDI pad controller on the General MIDI drum notes, which is velocity-sensitive. Hits light the stage like the band's drums do.
  - **Tap tempo:** a button, or T while the pads are open. One burst of taps is one undo.
  - **● Record a groove:**
    - one or two bars loop over the click;
    - hits are written where they were heard, after the speakers' delay, onto the band's drum pattern;
    - each press is a pass on top of the last, and ↶ takes the last pass away.
  - **🎤 Beatbox it:** after a bar's count-in, beatbox the loop. Kicks, snares, hats and open hats are told apart by their sound and written on the grid.
  - **Bass follows the kick:** a new bass style, so one groove makes the drums and the bass.
  - **The grid is the pattern:** tap a step for normal → accent → ghost → off.
- **Foot pedal** (Settings ▸ Pedal & MIDI sync, `src/parts/76-gear.js`).
  - It works with Bluetooth page-turner pedals, which type keys, and MIDI footswitches (control change, note or program change). Learn each action by stepping on the pedal.
  - Actions: play / stop, next section, previous section, record, loop, the band on / off, tap tempo.
  - It's off until switched on. Keys in text boxes are left alone, a pedal that bounces counts once, and a pedal coming back up does nothing.
- **MIDI clock:**
  - **Send:** 24 clocks a quarter note on the band's own schedule, timed with Web MIDI timestamps. Start, or Song Position and Continue from the middle of a song, and Stop.
  - **Follow:** tempo, Start, Continue, Stop and Song Position from other gear.
  - It needs Chrome or Edge.
- **📺 Stream window** (`src/parts/77-stream.js`), in the Creator Studio and Performer tools. It shows the line being sung, the next line and the chord, in large type on a key colour (green, blue, magenta or black), for a window capture with a chroma or luma key in OBS or any streaming app. It runs its own timer, so it keeps up when the studio's window is covered.

### Fixed
- **Two-bar drum patterns now play both bars.** The drums were read by position within the bar, so the second half of a 24- or 32-step pattern (offered in the Band panel since long ago) never played. They are now read by position in the song, and one-bar patterns sound exactly as before.

### Tests
- `e2e-pads` (25 checks) and `e2e-gear` (24 checks), run twice each.

## 2.28.1 — 2026-11-03 — Friendlier words about listening

### Changed
- **Nothing in the studio talks as if it is listening on its own.** Four lines are rewritten so that what listens is clearly the guitar input you connected, and only while you play:
  - the Up and down secret's hint, "Every note, there and back. Anywhere I can hear you.", is now "Every note of a scale, there and back, on your connected guitar.";
  - the Scales & ear lock hint says "on your connected guitar, anywhere in the studio";
  - the "connect your input" notes in Scales & ear and the level panel no longer say "the room can hear you" or "then I can hear it";
  - the guitar coach says "Picking up G" instead of "I hear G".

## 2.28.0 — 2026-11-02 — Shower mode gets a Shower set: a whole playlist in one pick, no waiting between songs, and the words

### Added
- **The Shower set: your playlist, kept apart from your Songs.**
  - **One pick:** add many songs at once with ＋ Songs, a whole folder with ＋ A folder, or drag files or folders in.
  - **Playlist order:** a playlist file (`.m3u`, `.m3u8`, `.pls`) picked with them sets the order, matched by file name whatever the paths say.
  - **Adding is quick:** a song is kept as its original file and split only when it is about to play.
  - **Nothing goes into your Songs.** The set lives in this browser's IndexedDB (`shower/set`, `shower/a/<id>`).
- **No waiting between songs.**
  - The next song is split in the background worker while the current one plays, and the screen shows "next: … ✓" when it's ready.
  - ⏭ and the move from one song to the next play at once.
  - Only the current and the next song are kept split, to spare a phone's memory.
- **☰ The set:**
  - 🔀 Shuffle, which keeps the song that is on;
  - 🔁 Repeat all, 🔂 Repeat one, ➡ Play once;
  - ↑ ↓ to reorder, ✕ to remove, and tap a song to play it;
  - each song shows whether it has words, and whether it came from the folder.
- **The words come with the music:**
  - a timed `.lrc` file beside the song, with offsets, repeated lines and word stamps;
  - words stored in the file itself, plain or timed: ID3 USLT and SYLT in MP3, ©lyr in M4A, LYRICS in FLAC (LRC text in any of them is timed);
  - or a `.txt` beside it.
  - Untimed words are spread over where the singer is heard in the track.
  - A thin line under the words shows how far into the song you are.
- **The shower folder:** with folder sync on, a `shower` folder inside the studio folder fills the set on every computer, words included, and songs added in Shower mode are copied into it. Removing a song from the set leaves the folder's copy alone and doesn't bring it back on this device.
- **Reading words from files:** `readTags(buf, { lyrics: true })` and `lrcParse` (part 21) read lyrics from FLAC as well as MP3 and M4A.

### Changed
- **Shower mode no longer opens your songs to play them.**
  - Tracks play through the stems player, and the song you had open is set aside in memory and put back as it was.
  - Leaving is immediate, with nothing to split again.
  - While Shower mode is open, your song isn't saved, so it never gets a shower track.

## 2.27.0 — 2026-11-02 — Shower mode becomes a hidden singing companion; the trainers move to Practice

### Added
- **🚿 Shower mode, rebuilt as a hidden singing companion** (`src/parts/73f-shower.js`). It is fun but practical, made for wet hands, and not on any menu.
  - **Ways in:**
    - hold the logo for two seconds (phones too);
    - type "shower" anywhere outside a text box;
    - type `shower` in the Backstage terminal.
  - **One full screen with a handful of big buttons:**
    - **⏮ ▶/⏸ ⏭** step through every song you have saved with a track. Each song plays straight into the next, ⏮ restarts the song if it has been playing a while, and ⏭ goes round.
    - **The four stems** take one tap each. The singer cycles as recorded → quiet guide → off (karaoke). Drums, bass and the rest are on or off. The choices hold for every song, on top of each song's own mix, which is put back afterwards.
    - **● records you.** The microphone opens only now, with echo cancellation, and is never played through the speakers. The red On air light comes on, and a belt meter shows how hard you are going.
    - **After recording:**
      - a splash score with a title, from Rubber Duck Rookie to Hot Water Heavyweight;
      - a rubber duck for every four seconds you hold a note;
      - **▶ Hear it, steamy** plays the music from where you started, with your take through a tiled-bathroom reverb;
      - **💾 Keep it** saves your voice with the reverb as a WAV file;
      - **✕** throws the take away.
    - **＋** adds a song from inside, and its singer is split off on this device.
    - The words show large when the song has them.
  - **While you're in it:**
    - The band and the click are silent (`T.quiet`, playback only: no song's band is switched off).
    - The screen stays awake.
  - **When you leave:** everything goes back, including the song you had open.

### Changed
- **The scale, arpeggio and ear trainers moved to Practice as 🎼 Scales & ear** (`src/parts/73d-scales-ear.js`, `trainOpen`).
  - It opens from the Practice tools, the Theory panel's "Practise this scale" and the phone's More sheet. The shower jokes stayed in the shower.
  - The secrets that open its treasures work as before, and their messages now point to Practice ▸ Scales & ear. Golden ear's hint is "Ten in a row, by ear. Practice has a room for that."
  - Its settings keep the name `CFG.shed`, so nobody's choices are lost.
- **The agent tool `open_shower_mode` is now `open_practice_room`.** The old name still works as an alias (`describe().aliases`), and the contract test now honours aliases. Agents get no tool for the hidden Shower mode.
- **No public page names Shower mode.** The README hints at it, and the guide's tones page shows a Scales & ear card. The privacy statement does describe its use of the microphone.

### Fixed
- **The red lights blink together.** The logo, the tab icon and the record buttons each had their own timer (1.3 s, 650 ms, 1.2 s, 1.4 s), so they drifted apart. They now change on the tab icon's one clock (`body.air-dim`), and the record buttons drop their own pulse while on air.

### Removed
- The first draft of a Sing room inside the trainer hub, before it was shipped, in favour of the hidden player.

### Tests
- `e2e-shower` (36 checks): hidden, the gestures, the queue, stems, play and pause, auto-advance, record, score, hear, keep, leaving, and a phone.
- `e2e-scales-ear` (38, renamed from `e2e-shower`).
- `e2e-agent` checks that the old tool name still works.
- `e2e-onair` 9 → 11 checks: the logo and the tab icon in step over eight samples, and the record button on the same clock.

## 2.26.0 — 2026-11-02 — Easier for AI assistants to find and use, with nothing new for people to manage

### Added
- **Three agent tools that do a whole job in one call** (API 2; nothing removed or changed):
  - `write_song`: lyrics to a song the band plays. Chords from a progression (a name, Roman numerals or chord names) are laid over each line, with an optional chorus progression, a key and a tempo.
  - `explain_song`: the key, every section's chords with Roman numerals, chords outside the key, sections that share their chords, and well-known progressions it uses.
  - `set_up_practice`: loop a section, slow the song down or set a tempo, the click, how much of the band plays, and play. Tempo changes are undoable.
- **`describe().start_here`:** five good first calls with example inputs, and `docs`, the address of the page for assistants.
- **`/llms.txt`:** what the studio is, how to call its tools, and every tool, for assistants that read it. `scripts/build.mjs` writes it from the table in `docs/AGENT_API.md`, and the page's head links to it.
- **`/guide/for-ai-assistants/`:** the tools, what they never touch, how they behave and good first calls. It is in the sitemap and `llms.txt` for assistants and search, but no menu, card or link in the studio or the other guide pages points to it.

### Unchanged on purpose
- People see nothing new. Agent access stays on by default with its one switch in Settings ▸ Workflow, and the short "🤖 AI agent: …" note still appears only when an agent changes something.

### Tests
- `e2e-agent` 65 checks:
  - `start_here`;
  - `write_song` (sections, the verse and chorus progressions, chords in the words, refusals);
  - `explain_song` (numerals, a known progression, a chord outside the key);
  - `set_up_practice` (the chorus looped at 75 % with just the drums, undo, refusals).
- `verify:site`:
  - `llms.txt` lists every tool and the page for assistants;
  - the head links to it;
  - neither the first page nor any listed guide page links to the page for assistants.

## 2.25.1 — 2026-11-02 — Shower mode on phones, a red light you can hear, two agent tools, steadier tests

### Added
- **Agent tools** (API 2, nothing removed):
  - `mute_band`: mutes the whole band and the click, or brings back exactly what was playing, like Shift+M. `get_studio_state` now says `band_muted`.
  - `open_shower_mode`: opens Shower mode on scales (with a key and a scale), arpeggios or ear. It never turns the microphone on and cannot pick a scale that is still locked.
- **The README** describes Shower mode, the seven secrets, On air and band mute, with Shift+M in the shortcuts.
- **Guide pictures:** the start, record, stems, chords and tab, hum and stage pictures are made again from this version (by `test/guide-shots.cjs`, like the newer ones). The first page now shows its six goals.

### Changed
- **Shower mode on a phone.** The fretboard shows only the frets the run uses, a little either side, so the dots are about 20 px across instead of 8. Choices sit two to a row, the buttons share the width, and the ear trainer's answers are two to a row and 44 px tall. Turning the phone redraws the neck to fit.
- **Accessibility in the new rooms:**
  - The fretboard is a named picture: which run, which frets, and while it follows you, the next note with its string and fret.
  - The buttons say what they do. The notes are a list, and the ear trainer's answers are a named group whose chosen answer is marked as pressed.
  - The Backstage terminal's output is a log.
  - **On air**, for a screen reader: "On air: recording." when the red light goes on and "Off air: recording stopped." when it goes off, in a status line nobody sees. The logo's tooltip says it too.

### Fixed
- **Takes stay sample-aligned on a busy computer.** When the page took longer than playback's lead time to schedule the takes, a take could start a few milliseconds off the others. Each take now skips in by how late it really is, measured against the audio clock, so they stay on one timeline.

### Tests
- **Three timing checks no longer fail on a loaded machine**, and none of them checks less:
  - `e2e-latency`: the re-amp gap was 3 ms out under load. The app fix above solves it, and it still has to be 500 ms ± 1.
  - `e2e-show`: blinders are counted from the show's own record of when each fired and in which bar, not by sampling a light that fades in a few frames.
  - `e2e.cjs`: the stage video stops once the recorder has handed over real video, not after a fixed 2.6 s.
- `e2e-shower` 29 → 38 checks: the names a screen reader hears, and the room on a 390 px phone (frets shown, dot size, nothing wider than the screen, tap sizes, sideways).
- `e2e-onair` 7 → 9: the status line on and off.
- `e2e-agent` 56 checks, including `mute_band` and `open_shower_mode` (locked scales refused, nothing unlocked, no microphone). `test/agent-contract.json` lists both.

## 2.25.0 — 2026-11-01 — Shower mode (scales, arpeggios, your ear), seven secrets out in the studio, and the red light

### Added
- **🚿 Shower mode** (`src/parts/73d-shower.js`): a practice room where everyone sounds better. *Not responsible for damage to electronic devices.* It has a fretboard drawn for the song's tuning and capo, and a fine-print section that asks you to keep the guitar out of the water.
  - **Where to find it:** the Practice workspace's tools, the top of the Theory panel ("Practise it in Shower mode" opens it on the song's key and scale), the phone's More sheet, and `shower` in the Backstage terminal.
  - **Scales** ("the warm-up"): a key, a scale, where on the neck, one or two octaves.
    - **▶ Listen** plays the run.
    - **● Play it** follows your guitar note by note, using the pitch the tuner already hears. It marks what is next, ticks off what you play and counts wrong notes (blame the tiles). The note still ringing from the last one is never a mistake, and octaves do not matter.
  - **Arpeggios** ("lather, rinse, repeat"): the song's chords one note at a time, or one chord up and down.
  - **Your ear:** name the interval you hear, from 4, 6 or 12 choices, with a streak and a best.
- **Seven secrets, spread out to be explored.** Each of the three new ones opens a treasure in Shower mode, and its toast says so. With Hidden surprises off, the treasures are simply open.
  - **Up and down:** any scale up and back down, anywhere the tuner hears you, including in Shower mode. Opens the modes and every other scale.
  - **Broken chords:** while the song plays, break three of the band's chords in a row into their notes (root, third, fifth). Opens seventh arpeggios.
  - **Golden ear:** ten intervals in a row in Shower mode, from six choices or more. Opens chord qualities by ear.
- **On air** (`src/parts/73e-onair.js`): a tribute to the red light outside a studio door.
  - While a take or a stage video records, the logo in the header and the browser tab's icon blink red, and the tab's title says **● REC**, so you can see from any tab that the studio is rolling.
  - Calm and reduced motion get a steady red light.

### Fixed
- Shower mode keeps its settings under `CFG.shed`, apart from the workspace you are in (`CFG.ws`). A first draft used the same name and cost first visits the Performer workspace.

### Tests
- `test/e2e-shower.cjs` (29 checks), with the guitar stood in for by the tuner's readings. It covers:
  - the way in from Theory, the A minor pentatonic box, the locked scales, Listen, a ringing note against a wrong one, Up and down from a clean run, the modes opening, and Dorian;
  - the song's arpeggios, and a clean arpeggio run in the shower not counting, because that secret is out with the band;
  - Broken chords: not while stopped, not out of order, then three chords in a row;
  - the ear trainer and Golden ear, chord qualities, the counter, and everything open with surprises off.
- `test/e2e-onair.cjs` (7): the red logo, tab icon and ● REC title, the blink, a stage video lighting it too, everything back as it was afterwards, and a steady light with reduced motion.
- `test/e2e-secrets.cjs` counts seven.

## 2.24.0 — 2026-11-01 — Mute the whole band in one press; the phone's More, and one panel at a time

### Added
- **Mute the whole band and the click in one press** (`bandMute` in `src/parts/11-layout.js`). Press again and exactly what was playing comes back (for the same song; a new song gets its usual band). Switching one part back on by hand ends the mute.
  - On a computer: **🔊 Mute all** in the band strip, and <kbd>Shift</kbd>+<kbd>M</kbd>. <kbd>M</kbd> alone is still the click.
  - On a phone: a **🔊** button in the transport, beside the click. The speaker shows what you hear now (🔇, highlighted, when muted).
  - In Perform: **🔊 Band** beside the click.

### Fixed
- **On a phone, Voice and the song sheet no longer stack.** Only one panel sits at the bottom at a time.
  - Opening Voice (from the song sheet, the More sheet or anywhere else) puts the song sheet and the More sheet away.
  - Opening the song sheet or the More sheet puts Voice away.
  - The song sheet's own **Voice**, **Perform** and **Load a track** buttons close the sheet before they open anything.

### Changed
- **The phone's bottom More** opens the sheet of extras (the same one as ⋯), instead of switching straight to the Research measurements. Its first row opens the **Research** and **Export** panels.
- The phone's transport now keeps tempo, signature, key and mode in the header by what they are, not by position, so an extra button can never push one of them out.
- On phones narrower than 380 px, the position readout drops its caption so all seven buttons fit.

### Tests
- `test/e2e-phone-panels.cjs` (21 checks): the band button in the phone transport, mute and an exact restore of a mixed band, the bottom More and its panels, the ••• sheet, one panel at a time in both directions, Perform's band button, nothing wider than the screen, and on a computer the band strip chip, Shift+M, M alone, and ending the mute by hand.

## 2.23.0 — 2026-11-01 — New guide pages, Backstage with all access, and hidden pages for developers

### Changed
- **The guide pages** (`scripts/seo-pages.mjs`, `/guide/`) are redesigned and brought up to date.
  - One column for words and pictures, so text no longer wraps short of the picture above it.
  - The studio's own colours and fonts: Inter and Montserrat, served from `/fonts/` with the security policy allowing only this site's fonts.
  - Each topic now reads the same way: an at-a-glance row of cards, numbered steps, a **Good to know** box for honest limits, questions that open and close, and one-line cards to keep reading.
  - The content now covers everything up to 2.22: zero-delay effects, Loop & layer, Your video, wide and vertical videos, the tip jar, folder sync and GitHub.
  - Three new pages: **Guitar amps, pedals and tones**, **Perform live and share**, and **Your studio, on every computer**. Their pictures are made from the app itself (`test/guide-shots.cjs`, WebP encoded in the browser).
- **Backstage is guest list only.** `dailyStudio.backstage()` now says how to get on the list. The password is the build you are running (bottom-right corner, or `dailyStudio.describe().build`), and a wrong one gets a stronger hint after a few tries. Getting in issues this browser an **all-access pass** with a number of its own. A browser that was already in keeps its way in and gets a number.

### Added
- **Backstage rooms** (`src/parts/73c-backstage.js`):
  - **Your pass**.
  - **Engine room**, now with the guitar's signal chain, unit by unit, showing what each unit adds, and the AudioWorklet processors.
  - **Performance**: frames a second over the last minute, long tasks, memory and the number of elements.
  - **Storage**: what this browser keeps, where it syncs, and the studio exported as JSON.
  - **Event bus**: every event the parts send each other, live, with a filter. The bus is tapped only while Backstage is open.
  - **Terminal**: a small shell for the studio, with history, Tab completion and a few words just for fun. Type `help`; it has 30 commands, including `play`, `bpm`, `transpose`, `look`, `call <tool> {json}`, `bus`, `storage`, `sync now`, `export`, `quote tomorrow`, `labs`, `open source` and `exit`.
  - **Labs**: developer handles (`window.__daily` without `?debug`), a performance overlay, and the event bus logged to the console.
  - **Hidden pages**, plus the existing How it is made, Agent playground and Secrets rooms.
- **Other ways into Backstage**: `#backstage/<room>` in the address, and ↑ ↑ ↓ ↓ ← → ← → B A, which opens the terminal. B and A finish the code rather than toggling the band.
- **Hidden pages for developers** (`scripts/backstage-pages.mjs`), shown only to a browser with a pass:
  - `/backstage/`: the lobby, with your pass, the rooms, this build at a glance and the ways in.
  - `/backstage/source/`: a map of every part, built from each part's own header comment, searchable, with sizes and links to the source.
  - `/backstage/data/`: your data, raw. It reads the studio's IndexedDB and local storage only, never creates a database, and never shows a GitHub token.
  - `/backstage/api/`: the console, WebMCP and agent API, and every shell command.
  - `/backstage/changelog/`: every release as a timeline.
  - How they are kept apart: noindex, kept out of the sitemap, and robots.txt asks crawlers to stay out of `/backstage/`. Each page has one inline script, allowed by its hash, and may connect nowhere.
  - `/humans.txt`.

### Tests
- `test/e2e-secrets.cjs` (54 checks): the guest list, a wrong password, the build as password, the pass, every room, the terminal's commands (help, version, bpm, quote, call, fun words, unknown commands, history, Tab, labs, ls), the deep link, the Konami code without toggling the bass, and the developer handles without `?debug` (persisting, then switched off).
- `test/e2e-backstage-pages.cjs` (17 checks): the hidden pages, written into `test/out/site` and opened from the studio's own origin.
- `npm run verify:site` and `npm run audit` cover the new guide pages, the served fonts, `backstage/` and `humans.txt`.

## 2.22.0 — 2026-11-01 — Folder sync: your whole studio, recordings too, in a folder you choose

### Added
- **Folder sync** (`src/parts/40-sync.js`, **Settings ▸ Folder sync**; Chrome and Edge on a computer). Choose a folder, ideally inside iCloud Drive, Dropbox, Google Drive or OneDrive, and your whole studio is kept in step with it: songs **with their recordings and backing tracks**, settings (not this computer's own audio devices, levels and layout), rig presets, stage looks and scenes, lesson notes and the notebook. Choose the same folder on another computer and it has the same studio; the drive's own app carries the files. No account, and the page makes no request: the browser reads and writes the folder itself.
  - **The files** are a GitHub studio's (`studio.json`, `settings.json`, `songs/<id>.json` …) in `the-daily.studio` inside the chosen folder. Songs also list their recordings, and `media/<song>/` holds each recording as a WAV (dry, and the amp print if any) and each backing track as the file that was loaded. A recording never changes once made, so its file is only ever copied to the side that lacks it; a WAV a cloud drive has not finished copying is left for later.
  - **Merges** are GitHub's, from one engine: settings key by key, a song changed on two computers keeps both versions, a song deleted elsewhere stays here until deleted here.
  - **Cloud-drive conflicts**: when two computers save the same song before the drive catches up, the drive keeps a second file (Dropbox's "conflicted copy", "(1)", " 2", OneDrive's "-COMPUTER"). The studio keeps that version as a song of its own ("… (from another device)"), named from its content so two computers doing it at once make one song, and removes the extra file. A file named for another song never replaces that song.
  - **When**: a few seconds after a change, when the page opens or comes back, and every minute while open; **⟳ Sync now**. Never while playing, recording or looping.
  - **Tidy**: a recording no song uses is removed from the folder once that has been so for a day (by this computer's count and the file's age), so a drive still copying never loses one. Only the studio's own file names are ever removed.
  - **Also save each song as a .daily-song.zip** is still there: on for folders chosen before 2.22 (the backup folder becomes a synced studio by itself, keeps its zips, and says so once).

### Changed
- **One sync engine** (`studioSync` in `src/parts/74-github.js`) for GitHub and folders: a place that keeps a studio says how to read its files, read one, write and delete, and take in a song; GitHub behaves exactly as before (its 42 checks unchanged).
- **A song whose recordings are not on this device yet** (on their way through a folder) opens without them and keeps them on every save, instead of a save dropping them (`src/parts/25-projects.js`).
- Settings: **Folder sync** has its own section next to GitHub (the Export section points to it). `syncAt` and the folder's state are this device's own and never synced to GitHub.

### Tests
- `test/e2e-folder.cjs` (50 checks): two computers through real directories (the browser's private file system), with the cloud drive played by copying folders, wholly or partly: the studio and recordings written and read back sample for sample, backing tracks, settings without this computer's own, a change and a new take reaching the other computer and the open song updating in place, a recording that arrives after its song (kept through an edit, taken in when it lands), both versions kept, Dropbox- and OneDrive-style conflict copies, deletions, tidying after a day while other files are never touched, nothing while playing, the zip option, a 2.21 backup folder upgraded, permission, and no network request.
- `test/e2e.cjs`: the backup-folder checks now choose a real directory and find the studio written there.

## 2.21.2 — 2026-11-01 — The hidden line: a quote of the day

### Changed
- **The hidden line** (triple-click the version tag) shows **one quote a day**, from people in history (`src/parts/73-build-egg.js`). It changes at midnight by the device's own clock. Everyone gets the same quote on the same day, and all quotes come round once, in a fixed shuffled order, before any repeats, so two days in a row never share one.
- **118 quotes** (up from 20) on making things, learning and practice, mistakes, music, courage and wonder: among others Tchaikovsky, Bach, Beethoven, Stravinsky, John Cage, Charlie Parker, Ella Fitzgerald, Ada Lovelace, Grace Hopper, Feynman, Van Gogh, Maya Angelou, Toni Morrison, Helen Keller, Frederick Douglass, Seneca and Rumi. The four lines credited to Tehau are gone.
  - Credits stay honest: a saying with no known source says **attributed to**; a paraphrase or a loose translation says **after**; and a line often credited to the wrong person carries the right name ("Do what you can, with what you have, where you are" is Bill Widener's, quoted by Theodore Roosevelt; "Whatever you can do, or dream you can, begin it" is John Anster's, after Goethe; "Music has charms to soothe a savage breast" is William Congreve's).
- A quote too long for its space now glides to its end at reading pace, holds there, goes back to its start and rests before the next time, instead of gliding once. It is measured again when its space changes, and in a sliver of space it is cut short instead. With reduced motion it does not move, and the whole quote is always on hover.

### Tests
- `test/e2e-perform-views.cjs`: 118 different quotes, each with who it is from and none from the maker; today's quote is shown; it changes at midnight by the device's calendar (summer time and the new year too); every quote comes round once before any repeats, never two days running; the line moves on by itself after midnight; the long-quote glide reaches the end in every place, holds, comes back and repeats, is measured again when its space narrows, and stays still in a sliver of space and with reduced motion.

## 2.21.1 — 2026-11-01 — The hidden line: quotes from history, and from Tehau

### Changed
- **The hidden line** (triple-click the version tag) now rotates **quotes to start a new idea**, each with who it is from (`src/parts/73-build-egg.js`): Leonardo da Vinci, Plato, J.R.R. Tolkien, Nietzsche, Longfellow, Victor Hugo, Aldous Huxley, Leibniz, Einstein, Edison, Abigail Adams and Plutarch, and four lines by **Tehau**. Shown as “…” — who.
  - Honest credits: a saying with no known source says **attributed to** (Nikola Tesla's "energy, frequency and vibration"); a paraphrase says **after** (Plutarch); and "Somewhere, something incredible is waiting to be known", often credited to Carl Sagan, carries the name of the writer who wrote it about him (Sharon Begley).
  - A quote stays longer the longer it is (9 s and a little per letter), and one too long for its space glides once to its end, so the end and who said it are read; the whole quote is on hover, and with reduced motion it does not move.

### Tests
- `test/e2e-perform-views.cjs`: every line has who it is from, Tehau's lines are his, honest credits, and a long quote glides far enough to show its end, in every place it is shown, with time to read it.

## 2.21.0 — 2026-11-01 — Your studio on GitHub, Sign in with GitHub, and a community gallery

### Added
- **Your studio on GitHub** (`src/parts/74-github.js`, Settings ▸ GitHub; nothing happens until you connect). Settings (not the device's own audio devices, levels, layout, measured latency, monitoring or download consent), rig presets, stage looks and scenes, lesson notes and the notebook, and songs as text are kept in step with a **private repository in your own GitHub account** (`my-daily-studio`, made by the app if the token may). Recordings, backing tracks, pictures and videos stay on the device, so the repository stays tiny and far inside GitHub's limits.
  - **One commit per sync** through the Git Data API (the changed files inline in one tree), with files compared by their Git blob ids computed in the page; tidy JSON with sorted keys, so every change reads well in Git's history.
  - **Merges**: settings key by key (this device wins where both changed), a song changed in both places keeps both versions, a song deleted here is removed there and one deleted elsewhere is kept here. Synced looks keep their ids, so devices never trade them back and forth.
  - **Automatic**: a little after a change, when the page opens and when it comes back; an automatic sync that changed nothing asks GitHub nothing. **⟳ Sync now**, **Disconnect** (removes the token), errors a person can act on (a refused token, an hour's limit used up, a repository the token may not create).
- **Sign in with GitHub** (`worker/index.mjs`): the site's Worker turns GitHub's one-time sign-in code into a token with the GitHub App's secret and renews it; the answer comes back after `#` and the page checks it against the state it made, keeps it and clears the address. It keeps nothing and never sees songs. Off until the site owner sets up the app (`BRAND.ghApp` and two Worker secrets; [docs/GITHUB.md](docs/GITHUB.md)); without it, people connect with a token. `wrangler.jsonc` now has the Worker (`main`) with the site as its `ASSETS`.
- **Share looks and rigs** to a separate **public** repository (`daily-studio-shared`, tagged `the-daily-studio`), and **Community looks and rigs**: GitHub's search for studios that share (it says how many), opened, cleaned (only known designs, fields and ranges; names as text; no pictures) and kept with `@who` in the name.

### Changed
- The security policy lets the page connect to `api.github.com` as well (only used after you connect GitHub or open the gallery); the release gate and the audit know it as a third kind of host, and PRIVACY.md, TERMS.md (a GitHub section), the licensing register and SECURITY_MODEL.md say exactly when it is used. Wording that said "no server" now says that no server keeps your data.

### Tests
- `test/e2e-github.cjs` (42 checks) against `test/fake-github.cjs`, a stand-in for GitHub's API (refs, commits, trees, blobs with Git's own ids, contents, topics, search): two devices, a private repository, what is and is not sent, a quiet sync asking nothing, a change reaching the other device, both versions kept, settings merged, deletions, refused tokens, Sign in with GitHub's return (and a wrong check refused) and renewal, sharing, the gallery and its cleaning.
- `test/worker.test.mjs` (17 checks): the Worker's two routes with GitHub's token endpoint stood in for. In CI's verify job.

## 2.20.0 — 2026-11-01 — Secrets, and a door backstage

### Added
- **Hidden surprises** (`src/parts/73b-secrets.js`). A few secrets for people who look and listen; details are in the code and its test, not here, so as not to spoil them. Two are earned by playing (on the tuner the studio already has, and on the timing it already measures), the triple-click on the version tag (2.15) now counts as one, and one is for developers. Once the first is found, a 🗝 counter next to the version shows how many, and opens the list with a hint for each one not yet found. They never fire while a take or a video records, nothing flashes (no glow with Calm or reduced motion), nothing loads or leaves the page, and **Settings ▸ Workflow ▸ Hidden surprises** turns them off. Found ones are remembered in this browser.
- **A word for developers in the console**, and **Backstage**, which it leads to: the audio engine live (sample rate, render quantum, the browser's latency, the zero-delay effects and the delay the rig and vocal strip add, frame rate, memory), a waveform and spectrum scope of the master, how the page is made (version, build, parts and lines, what the page weighed, no framework or runtime dependencies), a playground for the agent tools (choose a tool, its required inputs are filled in, Run, see the answer) and the secrets. Once unlocked it stays in Help. The build now fills in the number of parts and lines (`__PARTS__`, `__LINES__`).

### Tests
- `test/e2e-secrets.cjs` (27 checks).

## 2.19.1 — 2026-11-01 — Ready for more people: blocking tests, Safari and Firefox, 720p, problem reports

### Added
- **Help ▸ Report a problem** (`src/parts/29-guard.js`): **Copy a problem report** puts a short report on the clipboard for a GitHub issue: the version and build, browser and screen, how the audio is set up (engine state, sample rate, latency, worklets, input, monitor), the studio's state (workspace, look, video shape and quality, recording, playing), storage use, and the last 20 errors and warnings, kept in memory. Quoted names, web addresses and file addresses are blanked out, and there are no song titles, words, file names, device names or tip link. Nothing is sent. **Show it first** opens it to read, and the message that says something went wrong offers it too.
- **Video quality** (`src/parts/37-stage-rec.js`): **Auto** (1080p on a computer, 720p on a phone or tablet), **1080p** or **720p** (1280 × 720 or 720 × 1280), in the Record menu and Creator Studio's video shape. The frames are counted while a video records, and if more than one in ten came late the app says so afterwards and suggests 720p.
- **`test/xbrowser.cjs`**: the studio in Safari's engine (WebKit) and Firefox's as well as Chromium: it opens, the audio engine and worklets start, the song plays, the visuals draw, wide and vertical videos record at their sizes, Your video plays, the tip jar draws, Settings and Help open, the problem report is made. `test/lib.cjs` takes `BROWSER=webkit|firefox`.

### Changed
- **Browser tests now block a merge.** The CI `e2e` job (every suite, in Chromium) no longer has `continue-on-error`; it has been green on GitHub. A new `browsers` job runs `test/xbrowser.cjs` in WebKit and Firefox; it reports without blocking until it has been green on hosted runners.
- **The privacy claim is checked against this version.** `test/e2e-privacy.cjs` now also uses the zero-delay effects, the tip jar (with its sign and picture, and a share page that links to the tip page), wide and vertical videos, Your video and the problem report, and still finds no request to any other site; `PRIVACY.md` says it was last checked against 2.19.1 (it said 2.6.0), and lists the problem log.

### Tests
- `test/e2e-report.cjs` (10 checks); `test/e2e-shapes.cjs` 31 checks (quality); `test/e2e-privacy.cjs` 41 checks; `test/xbrowser.cjs` 14 checks in Chromium here (WebKit and Firefox run in CI).

## 2.19.0 — 2026-11-01 — Wide and vertical videos, and your own video behind you

### Added
- **Video shapes** (`src/parts/37-stage-rec.js`). A stage video is now drawn for its own frame instead of copied from the screen: **▭ Wide 16:9** (1920 × 1080, for YouTube, a website or a TV; the default), **▯ Vertical 9:16** (1080 × 1920, for Reels, TikTok and Shorts) or **▢ As on screen** (what it did before). The look, your colours, the camera (cropped to fill, so you stay in the middle of a vertical video), the small neck and the tip jar are drawn at the video's size.
  - **Words and chord on the video**: the line being sung, with its chords over the words, and the chord in large type over a soft shade at the bottom; the next line under it. On by default for vertical, off for wide; remembered for each shape.
  - While a video records, the Visuals show a preview of it (a tall one with black at the sides for vertical), and it keeps recording, picture and all, if you open another panel (before, the picture stopped).
  - In the Record menu, and in **🎬 Creator Studio** next to **⏺ Record MP4**. The **🖼 Thumbnail** takes the same shape (1080 × 1920 for vertical). Vertical files end in `_vertical`.
- **Your video** (`src/parts/70b-vidbg.js`): your own video loops (MP4 or WebM, up to 8, 300 MB each) as a **Behind you** look, added with **🎞 Your videos**. Played muted, looped and filling the picture, on the Visuals, the Stage and in recorded videos. **🎚 Speed** sets how fast it plays; **Breathe** brightens it when you play loud and swells it slightly on a strong beat; **Tint to the chord**; **Darken**; **Change video** on each section or every 4 or 8 bars while the song plays (with a crossfade; your choice comes back when it stops). Kept in this browser's database, not uploaded, not part of song backups; a file the browser cannot play is turned away when added, and a video no look is drawing is paused.

### Tests
- `test/e2e-shapes.cjs` (27 checks): each shape's file size (1920 × 1080, 1080 × 1920, the Visuals' own), the preview, the words, recording on another panel, Creator Studio and the thumbnail; adding videos (and refusing one that cannot play), showing, switching, speed, changing every 4 bars and coming back, Your video in a recorded video and on the Stage, the tint, removing, and the dialog on a phone. The test videos are made in the page.

## 2.18.0 — 2026-10-31 — Hear yourself sooner, and takes in time

### Changed
- **Hearing yourself through the app is about 20 ms sooner on the guitar and 12 ms sooner on the voice.** Measured with a click through the default rig: the guitar came out of the app 20.7 ms after it went in, the voice 12 ms; now 0.2 ms and 0. The browser's own compressor always looks 6 ms ahead and its 4x oversampling adds 4 ms, and the amp alone had two shapers and a compressor in a row. The compressors (amp sag, compressor pedal, vocal polish, lane and master compressors, limiter) and the amp and drive saturation now run in the app's audio worklet with no look-ahead: the same curves and make-up gain (levels within 0.5 dB), the same saturation and the same aliasing (about −92 dB), oversampled through low-delay IIR filters. Your interface and the browser still add their own delay; for tracking, the interface's Direct Monitor has none.
- **Takes play in time with each other.** Guitar takes played through the rig, or from their wet print, used to be heard 15–21 ms behind the band and about 9–15 ms behind the vocal; vocal takes 6 ms behind the band. Now each rig unit reports the delay it adds, and a take is started that much early and a wet print trimmed to match (delay compensation), so guitar, vocal and band land within a sample of where they were played, in playback and in exports.
- **The compressor pedal's Blend no longer thins the tone.** It mixed your dry guitar with a compressed copy 6 ms late (a comb filter); both now arrive together.

### Added
- **Settings ▸ Audio engine ▸ Zero-delay effects** (on). Off goes back to the browser's own compressor and oversampling (about 20 ms more on the guitar); takes are still kept in time.

### Tests
- `test/e2e-latency.cjs` (17 checks): the guitar and voice paths timed with a click (with the default rig and with every drive pedal on), the compressor against the browser's at five settings and five levels, the shaper's level, aliasing and first samples in an offline render, a guitar take (re-amped and from its wet print) against a vocal take on playback, and all of it again with the setting off.

## 2.17.0 — 2026-10-31 — A tip jar: let your audience tip you

### Added
- **🎸 Tips** (`src/parts/39b-tip.js`): an artist's own tip link as a QR code in a small open guitar case. Paste a Ko-fi, PayPal.me, Venmo, Cash App, Buy Me a Coffee, Patreon or Bandcamp page, or any `https` address (`ko-fi.com/name` gets `https://`; a `@venmo-name` becomes a Venmo profile link, `venmo.com/u/name`; a `$cashtag` becomes a Cash App link), add a name and a message, and choose where it shows:
  - **on the Visuals**, so it is in every stage video and in the Audience view;
  - **on the Stage**, so the room can scan it from the projector or the pop-out window (it steps around the chord, tuner, song info and lower third);
  - **on share pages**, as a button and a code beside the player;
  - **on a printed sign** for a real guitar case, and **as a picture** (PNG) to post.
  It can show all the time or only between songs, in any corner, at three sizes.
- **Off by default, set up in 🎬 Creator Studio** (its **🎸 Tip jar** tool). Until it is set up nothing about it appears anywhere else; once it is, a **🎸 Tips** button appears in the Visuals and Stage bars to switch it on or off.
- **A QR code maker** (`src/parts/39a-qr.js`), with no library and nothing downloaded: byte mode, error correction level M, versions 1 to 40, the mask chosen by the standard's penalty rules. Every version was checked with an independent QR reader while it was written, and the codes drawn on the Visuals and the Stage scan back to the link.

### Safeguards
- **Links are made safe**: `https` only; `javascript:`, `data:`, plain `http` and links carrying a user name or password are refused. **Test the link** opens it in a new tab so the artist can check where it goes.
- **Nothing shows until the artist confirms** that it is their own link and that the payment is between them, their audience and the service they chose (the studio is not part of it, takes nothing, and is not responsible for the service, the payments or taxes). Share pages say the same beside the button.
- **The link stays in this browser's settings**: not in songs, song backups or project files, and **the AI agent tools cannot read or change it**, so an agent cannot swap in another payment link.
- The studio never opens the link itself and sees no payment. Terms of use gain a **Tips** section; the privacy statement lists the tip jar.

### Tests
- `test/e2e-tip.cjs` (38 checks): the codes match the fingerprints of codes checked with an independent reader; every module drawn in the case matches the link; unsafe links are refused; off by default (no button outside Creator Studio until it is set up); nothing shows before the confirmation; the dialog, the corners, stepping around the neck and the lower third, "only between songs", the Stage, share pages (escaped, and absent when turned off), the printed sign, the picture, the agent tools not seeing the link, and the dialog on a phone.

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
