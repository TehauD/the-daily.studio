# Security and privacy model

Reviewed for 2.49.2 (first written for 2.13), with an evaluation of the live site below. The app is a static page that runs entirely in the visitor's browser. This document records what it can access, what it stores, what it contacts, and the controls that keep it that way.

## Trust boundaries

1. **The visitor's device** holds all data. There is no account, cookie, analytics or telemetry, and no server keeps data. The site's Worker (`worker/index.mjs`) only serves the files and, if the owner sets up Sign in with GitHub, passes GitHub's one-time sign-in code to GitHub and the token back to the browser (it stores nothing). A person may connect their own GitHub repository (Settings ▸ GitHub); then the browser talks to `api.github.com` directly (docs/GITHUB.md).
2. **The host (Cloudflare)** serves static files and may keep ordinary access logs. It never sees songs, or audio or video it can open.
6. **Drops (2.60, `worker/drops.mjs`)** is public by design, so the owner reviews before anything is shown.
   - **Uploading** needs a GitHub token (one `GET api.github.com/user`, not kept). It accepts Ogg audio only, up to 15 MB, 3 a day per account (counted by markers in the private bucket) and 100 waiting.
   - **Text** (title, name, note) is cut to length with `<` and `>` removed. A link is kept only if it is a song link.
   - **Waiting drops** stay in the private bucket. The owner-only routes check the GitHub account number against `OWNER_GITHUB_ID`.
   - **The public and review pages** have a strict policy (one script allowed by its hash; no inline handlers) and put every text in with `textContent`. Audio plays from the site or the public bucket's own address only.
5. **Recordings sent with a song link (2.54, `worker/share.mjs`)** are the one thing the site keeps:
   - **Sealed in the sender's browser:** AES-GCM-256 with a new random key, which rides in the link after the `#` and is never sent.
   - **Stored for 7 days** in R2, under a random name, with the sending GitHub account's number.
   - **Uploading** needs a GitHub token. The Worker uses it for one `GET api.github.com/user` and doesn't keep it.
   - **Limits:** 25 MB a package, 10 a day per account, 200 and 3 GB a day in all.
   - **The package check** accepts only the studio's sealed envelope (`TDS1`).
   - **Downloading** needs only the random name, and gives back only ciphertext.
   - **The receiver** treats everything as untrusted: the package size, the zip, every field of every take (`srxCleanTake`), Opus only, at most 48 takes and an hour of audio.
3. **Optional third-party hosts**, contacted only after the visitor says yes to a one-time download (`mpConsent()`), when hand tracking or the person cut-out look is used: `cdn.jsdelivr.net` (MediaPipe script and WASM) and `storage.googleapis.com` (hand-landmarker and selfie-segmenter models). They see an IP address and browser details, like any download, and never a camera picture.
4. **The Daily at `journal.the-daily.studio`** (2.50) has its own origin. It contacts GitHub, Azure DevOps or an AI provider only if the user enters their own credentials.

## Device permissions

| Capability | When it is requested | User control |
| --- | --- | --- |
| Microphone | Only after the user presses **Connect** / "Start and connect my input" (or has opted in to "reconnect my last input on open") | Header **Audio** button; **Ctrl/Cmd + .** kills audio and releases the microphone; browser site settings |
| Audio output and monitoring | Monitoring is **off by default** | Audio panel ▸ "Hear myself" |
| Microphone for Hum to Song | Only when the person presses **● Hum or sing**; recorded in memory, never saved or uploaded | Stop; Ctrl/Cmd + . discards the recording and releases the microphone |
| Camera | Only when a Visuals / Vision camera feature is started, when **Begin on stage** (the small optional link on the first screen) is chosen, or when **Hum or sing** is pressed with "center stage" ticked (default). The first screen says it stays off unless chosen | Camera off / backdrop button; browser site settings |
| Screen capture | Only when the person presses **⏺ Record screen** (Practice ▸ ⋯ More; Teacher until 2.64); the browser asks which tab, window or screen to share, and the microphone is added only if allowed. Recorded in memory for Studio Replay, saved only as a file the person downloads | Press the button again or the browser's *Stop sharing*; closing the tab |
| Files the user drops or chooses (audio, lyrics, MIDI, song files) | Only when the person drops files on the page or presses **Choose a file…** / **Open a file**; read with the browser's File API in memory, never uploaded. MIDI files are size-limited (8 MB, 300,000 notes, 128 tracks) before they are parsed. Drops are declined while a window is open, and the page never navigates to a dropped file | n/a |
| MIDI | Only when the user enables MIDI | Browser site settings |
| Location, payment, USB, serial | Never (disabled by Permissions-Policy) | n/a |

## Data inventory

| Data | Stored in | Leaves the device? | Cleared by |
| --- | --- | --- | --- |
| Settings, appearance, calibration, tour state | `localStorage` keys `fw.cfg`, `fw.cal`, `fw.tour`, `fw.toured` | No | Reset (Help ▸ Reset) |
| Progress journal (2.12): days played and minutes, chords held steady, ideas recorded, songs marked finished, how often chord changes landed, the song and recording last worked on, and a line you may type (“Working on”) | `localStorage` key `fw.jn`. Counts and dates only: no audio, no notes, no file names. A few hundred bytes to a few tens of kilobytes | No | Reset (Notebook, history & progress journal), **Erase my journal** in My progress, or the whole reset |
| Songs, takes and stems | IndexedDB database `the-daily-songs` | No | Reset, or deleting a song |
| Stage pictures (backdrops, a pixel wall, a logo) | IndexedDB database `the-daily-songs`, store `blobs`, keys `stage/img/<id>`; their names and sizes are in `fw.cfg` | No | Removing the picture in the stage designer, or Reset. They are not in a song's zip or a backup |
| Offline copy of the app | Cache Storage `daily-songs-<version>` (service worker) | No | Reset, or a new version |
| Backups and exports (including **Back up all songs**, WAV bounces and clips saved as WAV) | Files the user downloads. A fast WAV render runs in an offline audio engine in the page and writes nothing until the file is saved | Only where the user puts them | n/a |
| Folder sync (Chrome, Edge; was the backup folder) | A folder handle the person chose, kept in IndexedDB. The studio is written into `the-daily.studio` inside it (settings without this device's own, presets, looks, scenes, notes, songs as text, recordings as WAV, backing tracks as loaded) and read back from it; optionally a `.daily-song.zip` per song. What is read is checked like GitHub's (song fields, ids as names, rig presets cleaned) and only the studio's own file names are ever removed | Only into that folder; the page makes no request (a cloud-drive folder syncs under that drive's own rules) | Turn off, Reset, or choosing another folder |
| Backstage (2.23) and its hidden pages | The pass (`CFG.backstage`, `CFG.bksPass`) and the Labs switches (`CFG.labs`) in `fw.cfg`. **Developer handles** put `window.__daily` (the internal handles the tests use) on the page; only the page's own hashed script can run, so nothing else can reach them. `/backstage/` pages read the studio's IndexedDB and local storage read-only, never create the database, never show `fw.ghtok`, and may connect nowhere | No | Labs switches off, Reset |
| Storage-persistence request | The app asks the browser once to keep its storage (`navigator.storage.persist()`); on Safari it also explains Add to Home Screen | No | n/a |
| Camera frames and microphone audio (including a hum recording) | Memory only while in use; the song built from a hum keeps only the notes and chords | No | Stop, kill switch, closing the tab |
| Lesson notes | `fw.lessons` (per song title) | No | Clear the note, or Reset |
| Studio Replay (the newest stage video or screen recording) | Memory only, until the next recording or closing the tab | No (↗ Share hands it to the device's share sheet only when pressed) | Close the tab |
| Consent to the MediaPipe download | `fw.cfg` (`mpOk`) | No | Reset, or About ▸ Credits ▸ Ask me again |
| A tuned vocal take (2.43) and its original | IndexedDB, in the song, next to the take; the original is kept so **Off** brings it back exactly | No | Deleting the take or the song, or Reset |
| A song received as a link (2.40) | Nothing until the person chooses **Open**: then a new song in IndexedDB. The link itself is removed from the address bar as soon as it is read | The link carries the song wherever the person sends it (see *Song links* below) | Deleting the song |
| The Daily entries | `localStorage` keys beginning `daily` | Only to a provider the user configures | The Daily's own controls |

The studio's reset removes only the studio's `fw.*` data and its own caches; it leaves The Daily alone.

## Network requests

* On a normal visit: only the site's own files (page, service worker, manifest, icons, `samples/manifest.json` and a sample track if the user opens it). Since 2.40 the two fonts and four rarely used parts of the studio (`rooms/`: transcription, MIDI import, Shower mode, vocal tuning) are separate files on the same origin. The service worker fetches them all when it installs, so they work offline; on a first visit before it has, a room is fetched the first time it is used. Each room is loaded with a `sha384` integrity hash built into the page, so a changed file is refused.
* Hand tracking and the person cut-out add requests to the two hosts above, **after the one-time question is answered yes**. The stage route chooses the cut-out look by default, so it asks the first time the camera is on. Nothing is sent to the hosts except the standard request for the file. A no keeps the page offline and is not asked again until the feature is chosen again.
* `verify:site` fails the release if the CSP allows any host other than those two. `npm run audit` fails if the source names a new host or gains a new place that can reach the network. `test/e2e-privacy.cjs` plays a whole session in a real browser and fails on any request to another site, any cookie, or any storage outside the app's own names; run it against the live site after a deploy (`BASE_URL=https://the-daily.studio/ node test/e2e-privacy.cjs`) so anything the host injects on its own is caught.
* Cloudflare Web Analytics' automatic script injection must stay off. If it were on, the CSP would block its script and the live-site test would fail.

## Controls in the page and headers

* **Content-Security-Policy** (meta tag in `index.html` and, for the studio page, an identical header plus `frame-ancestors 'none'`): the one inline script is allowed by SHA-256 hash; no `unsafe-eval`, no inline-script allowance; `object-src`, `base-uri` and `form-action` are `'none'`; `blob:` is allowed for the audio worklet and stem worker; `wasm-unsafe-eval` is needed only by MediaPipe.
* **Other headers:** `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, HSTS (one year, no subdomains, no preload), COOP `same-origin`, Permissions-Policy as above. Full list in [HOSTING.md](HOSTING.md#7-headers-and-csp).
* **Supply chain:** zero runtime npm dependencies; fonts (Inter, Montserrat; SIL OFL) are embedded; dev dependencies (jsdom, Playwright) are not shipped. The MediaPipe version is pinned. Licences are in `THIRD_PARTY_NOTICES.md`, the file-by-file register is [LICENSING.md](LICENSING.md), and both are published at `/legal/`.
* **Pictures:** read with the browser's own image decoder (`createImageBitmap`), drawn onto a canvas, reduced to at most 1920 px and stored as a fresh JPEG or PNG, so what is kept is not the file that came in. Only JPEG, PNG, WebP and GIF are accepted; **SVG is refused** because it can carry script. At most 24 pictures, 14 MB each. A picture is only ever drawn on a canvas, never inserted into the page as markup.
* **Song links (2.40):** the song travels after the `#`, which browsers never send to a server. Everything in a link is untrusted input: the link is capped at 60,000 characters and its unpacked size at 256 kB (a ceiling on decompression), the JSON is parsed as data, names are checked against the studio's own lists, numbers clamped, text lengths capped and chords parsed before anything is used. Text is inserted as text, never HTML. The link is cleared from the address once read, and the person is asked before it opens, as a new song that replaces nothing. A link is readable by anyone who has it, including link-preview services in chat apps; the send window says so.
* **AI agent tools (2.26, wider in 2.47):** the tools run in the page and can read and edit the open song and the band, play and stop, and export text. They never reach the microphone, the camera, recording, deleting songs or Settings, every change shows a 🤖 note and is one undo step, and the person can turn them off (Settings ▸ Workflow). 2.47 lets `set_band` pick a beat and change the kit, sounds and Song build, and `edit_section` set a section's energy; neither opens anything new.
* **Imports:** JSON, WAV, MP3 and preset files are parsed locally; malformed files must produce an error, not code execution. Text from files is inserted as text, not HTML.
* **The Daily's own origin (2.50):** The Daily is served at `journal.the-daily.studio`, and the studio at `the-daily.studio`, so the browser keeps their storage apart; neither sets cookies (`verify-site` checks). The page at `/journal/` moves a journal kept at the old address with a one-time hand-over between two pages: each accepts it only from the other's exact origin and the window it opened or was opened by, keeps only `daily…` keys and well-formed rows, never overwrites what is already there, and leaves the old copy until the person removes it. Both pages allow only their own script, by hash.

## Known limits and residual risks

* Anyone with access to the browser profile can read local data; the app does not encrypt it.
* The two CDN-loaded camera files are not integrity-pinned (MediaPipe loads them dynamically). Self-hosting them removes this ([HOSTING.md §8](HOSTING.md#8-self-hosting-the-camera-model-files)).
* The selfie-segmenter and hand-landmarker URLs match Google's current documentation (checked 26 October 2026). If one is unavailable, or the visitor declines, the person cut-out look falls back to the edges look and hand tracking to motion mode. Google states no separate licence for the segmenter file: see [LICENSING.md](LICENSING.md#fetched-only-after-consent).
* The Daily's own security policy allows images from any `https` address, so a journal entry that links a remote picture makes the browser fetch it. That is its policy, not the studio's.
* `style-src` allows `'unsafe-inline'` because the app sets styles at run time; scripts are not affected.
* HSTS is set for one year without preload; consider preload only after the domain has been stable.
* **Recordings in a link:** anyone who has the whole link can play them for 7 days, because the key is in the link. That's the same reach as the song itself.
  * The site can't open them, so it can't check them before a report. Abuse is limited by the sign-in, the daily limits and the 7 days, and handled through **⚑ Report**.
  * Reports land in the bucket under `reports/` and are deleted after 7 days like everything else, so the owner needs to look at them within that week (CLOUDFLARE_SETUP.md, Part G).
* **Soundprint links (2.61)** (`#p=1…`) are untrusted input too: at most 4,000 characters, inflated with the same ceiling as song links, checked byte by byte (version, lengths, counts, the key), and the title and name are shown as text with control characters and `<` `>` removed. The print holds no audio, so a link can't carry a recording. A print kept in a song (2.62, `S.sprint`) comes from whoever made the song, so `normSong` keeps it only as a base64url code of at most 4,000 characters with a hex signature (2.65.1), and it is decoded by the same checked reader. A sound file chosen for a print is refused over 400 MB before it is read into memory, and only its first ten minutes are analysed.
* A song link is as private as the channel it is sent through. Link previews in chat apps can fetch the address; they still cannot see the part after `#` unless the app reads the whole link it was given. The studio cannot control that.
* The device permissions table describes the computer. On a phone (2.41), **Sing** opens the microphone when the person presses 🎤 Sing into this phone or ●; the same kill switch applies.

## Live site evaluation (2026-11-08)

A passive look at https://the-daily.studio/, then running 2.48.1. Nothing was load-tested or attacked; every request was one a visitor or crawler could make. Run from a sandbox whose proxy re-signs TLS, so the certificate and TLS settings were **not** evaluated (check them with a public TLS scanner).

**Holding up:**
- **Headers:** every response has HSTS (one year), `nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, a cross-origin opener policy and the permissions policy. The studio page's policy header matches its `<meta>` policy and adds `frame-ancestors 'none'`.
- **The studio's script** is the one inline script its policy allows by hash, and the hash matches. No outside script is loaded.
- **Nothing private is served:** `.git`, `package.json`, `wrangler.jsonc`, `src/`, `scripts/`, `worker/`, `test/`, `docs/`, `.env`, `_headers`, `index.debug.html` and `codepen/` all answer 404.
- **The guide, legal and backstage pages** each carry their own strict policy: no script, or one pinned by hash on backstage.
- **The sign-in routes:**
  - `/auth/github/callback` only ever redirects to `/#…`, never to an address it is given, and cleans the state it passes back;
  - `/auth/github/refresh` refuses GET (405) and other sites (403);
  - both say `not-set-up` (Sign in with GitHub isn't configured in production) and send `no-store`.
- **The studio page sets no cookie**, and a whole session reaches no other site (`e2e-privacy` against the live site: 40 of 42 checks; the two failures are the Cloudflare beacon below).

**Found, and fixed in 2.49.2:**
- **jsDelivr was trusted as a whole host;** now only the camera library's folder is (`test/net-mediapipe.cjs` loads it for real under the new policy).
- **The 404 page had no policy,** so scripts Cloudflare adds on the way out ran there. It now runs none.
- **No `security.txt`:** there is one now.
- **CI's token had GitHub's default permissions:** it is now read-only, and Dependabot is on.

**Found, for the site owner to change in Cloudflare:**
- **Web Analytics' automatic setup is on.** Cloudflare adds `static.cloudflareinsights.com/beacon.min.js` to pages. The studio's policy blocks it (with console errors), but it ran on the 404 page and is attempted on `/journal/`. Turn it off: *Analytics & Logs ▸ Web Analytics*, the site's automatic setup. [LICENSING.md](LICENSING.md) open item 6 asks for this.
- **Bot detection is on** ("JavaScript detections" or Bot Fight Mode). Cloudflare injects an inline script that loads `/cdn-cgi/challenge-platform/…`. The studio's policy blocks it; on `/journal/`, whose policy allows inline scripts, it runs and sets a `cf_clearance` cookie. PRIVACY.md says no cookies, so turn it off (*Security ▸ Bots*), or say so in PRIVACY.md.
- **Network Error Logging** (`NEL` / `Report-To` headers) asks visitors' browsers to report failed connections to Cloudflare. It's harmless, but it isn't in PRIVACY.md; turn it off in the dashboard if you can, or mention it.
- **`www.the-daily.studio` has no DNS answer.** Add it with a redirect to the bare domain, or leave it out on purpose.
- ~~**`workers_dev: true`** in `wrangler.jsonc` also served the site at `the-daily-studio.<account>.workers.dev`: a second copy, not covered by the domain's HSTS.~~ Off since 2.53.1, with the preview addresses.

**Since then:** The Daily moved to its own address (2.50).

**Private files and the origin (2.53.1):**
- **No origin server.** The site is a Cloudflare Worker and its static assets; there is no server or IP address behind Cloudflare to reach directly. Since 2.53.1 the `workers.dev` and preview addresses are off, so the custom domains are the only way in.
- **Nothing private is deployed.** `dist/` is built fresh from a fixed list of files; it also carries a `.assetsignore` (`.env*`, `.dev.vars*`, `.git`, `.wrangler`, `node_modules`, keys, package and Wrangler files). `verify:site` fails if any such file is in `dist/` or committed, or if `workers_dev` or `preview_urls` is turned back on. Probed live on both addresses: all 404.
- **Secrets.** The only ones are Sign in with GitHub's `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, Worker secrets set with `wrangler secret put` and kept in Cloudflare. `wrangler.jsonc` holds no secret, and the repository's history has no token or key.

**Still open:**
- **The CI actions are pinned to major versions,** not commit hashes; Dependabot can keep commit pins current.

## Reporting

Use GitHub private vulnerability reporting (see [SECURITY.md](../SECURITY.md)).
