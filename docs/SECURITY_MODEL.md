# Security and privacy model

Version 2.12 (v2.12.0). The app is a static page that runs entirely in the visitor's browser. This document records what it can access, what it stores, what it contacts, and the controls that keep it that way.

## Trust boundaries

1. **The visitor's device** holds all data. There is no server component, account, cookie, analytics or telemetry.
2. **The host (Cloudflare)** serves static files and may keep ordinary access logs. It never sees songs, audio or video.
3. **Optional third-party hosts**, contacted only after the visitor says yes to a one-time download (`mpConsent()`), when hand tracking or the person cut-out look is used: `cdn.jsdelivr.net` (MediaPipe script and WASM) and `storage.googleapis.com` (hand-landmarker and selfie-segmenter models). They see an IP address and browser details, like any download, and never a camera picture.
4. **The Daily at `/journal/`** shares the origin. It contacts GitHub, Azure DevOps or an AI provider only if the user enters their own credentials.

## Device permissions

| Capability | When it is requested | User control |
| --- | --- | --- |
| Microphone | Only after the user presses **Connect** / "Start and connect my input" (or has opted in to "reconnect my last input on open") | Header **Audio** button; **Ctrl/Cmd + .** kills audio and releases the microphone; browser site settings |
| Audio output and monitoring | Monitoring is **off by default** | Audio panel ▸ "Hear myself" |
| Microphone for Hum to Song | Only when the person presses **● Hum or sing**; recorded in memory, never saved or uploaded | Stop; Ctrl/Cmd + . discards the recording and releases the microphone |
| Camera | Only when a Visuals / Vision camera feature is started, when **Begin on stage** (the small optional link on the first screen) is chosen, or when **Hum or sing** is pressed with "center stage" ticked (default). The first screen says it stays off unless chosen | Camera off / backdrop button; browser site settings |
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
| Backup folder (Chrome, Edge) | A folder handle the person chose, kept in IndexedDB; songs are written as `.daily-song.zip` | Only into that folder (a cloud-drive folder syncs under that drive's own rules) | Reset, or choosing another folder |
| Storage-persistence request | The app asks the browser once to keep its storage (`navigator.storage.persist()`); on Safari it also explains Add to Home Screen | No | n/a |
| Camera frames and microphone audio (including a hum recording) | Memory only while in use; the song built from a hum keeps only the notes and chords | No | Stop, kill switch, closing the tab |
| Consent to the MediaPipe download | `fw.cfg` (`mpOk`) | No | Reset, or About ▸ Credits ▸ Ask me again |
| The Daily entries | `localStorage` keys beginning `daily` | Only to a provider the user configures | The Daily's own controls |

The studio's reset removes only the studio's `fw.*` data and its own caches; it leaves The Daily alone.

## Network requests

* On a normal visit: only the site's own files (page, service worker, manifest, icons, `samples/manifest.json` and a sample track if the user opens it).
* Hand tracking and the person cut-out add requests to the two hosts above, **after the one-time question is answered yes**. The stage route chooses the cut-out look by default, so it asks the first time the camera is on. Nothing is sent to the hosts except the standard request for the file. A no keeps the page offline and is not asked again until the feature is chosen again.
* `verify:site` fails the release if the CSP allows any host other than those two. `npm run audit` fails if the source names a new host or gains a new place that can reach the network. `test/e2e-privacy.cjs` plays a whole session in a real browser and fails on any request to another site, any cookie, or any storage outside the app's own names; run it against the live site after a deploy (`BASE_URL=https://the-daily.studio/ node test/e2e-privacy.cjs`) so anything the host injects on its own is caught.
* Cloudflare Web Analytics' automatic script injection must stay off. If it were on, the CSP would block its script and the live-site test would fail.

## Controls in the page and headers

* **Content-Security-Policy** (meta tag in `index.html` and, for the studio page, an identical header plus `frame-ancestors 'none'`): the one inline script is allowed by SHA-256 hash; no `unsafe-eval`, no inline-script allowance; `object-src`, `base-uri` and `form-action` are `'none'`; `blob:` is allowed for the audio worklet and stem worker; `wasm-unsafe-eval` is needed only by MediaPipe.
* **Other headers:** `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, HSTS (one year, no subdomains, no preload), COOP `same-origin`, Permissions-Policy as above. Full list in [HOSTING.md](HOSTING.md#7-headers-and-csp).
* **Supply chain:** zero runtime npm dependencies; fonts (Inter, Montserrat; SIL OFL) are embedded; dev dependencies (jsdom, Playwright) are not shipped. The MediaPipe version is pinned. Licences are in `THIRD_PARTY_NOTICES.md`, the file-by-file register is [LICENSING.md](LICENSING.md), and both are published at `/legal/`.
* **Pictures:** read with the browser's own image decoder (`createImageBitmap`), drawn onto a canvas, reduced to at most 1920 px and stored as a fresh JPEG or PNG, so what is kept is not the file that came in. Only JPEG, PNG, WebP and GIF are accepted; **SVG is refused** because it can carry script. At most 24 pictures, 14 MB each. A picture is only ever drawn on a canvas, never inserted into the page as markup.
* **Imports:** JSON, WAV, MP3 and preset files are parsed locally; malformed files must produce an error, not code execution. Text from files is inserted as text, not HTML.
* **Same-origin neighbour:** the studio and The Daily use different storage names and do not read each other's data. A cross-site-scripting flaw in either would expose both, which is why both carry a CSP and neither loads third-party scripts. Use a fine-grained, repo-scoped token in The Daily.

## Known limits and residual risks

* Anyone with access to the browser profile can read local data; the app does not encrypt it.
* The two CDN-loaded camera files are not integrity-pinned (MediaPipe loads them dynamically). Self-hosting them removes this ([HOSTING.md §8](HOSTING.md#8-self-hosting-the-camera-model-files)).
* The selfie-segmenter and hand-landmarker URLs match Google's current documentation (checked 26 October 2026). If one is unavailable, or the visitor declines, the person cut-out look falls back to the edges look and hand tracking to motion mode. Google states no separate licence for the segmenter file: see [LICENSING.md](LICENSING.md#fetched-only-after-consent).
* The Daily's own security policy allows images from any `https` address, so a journal entry that links a remote picture makes the browser fetch it. That is its policy, not the studio's.
* `style-src` allows `'unsafe-inline'` because the app sets styles at run time; scripts are not affected.
* HSTS is set for one year without preload; consider preload only after the domain has been stable.

## Reporting

Use GitHub private vulnerability reporting (see [SECURITY.md](../SECURITY.md)).
