# Security and privacy model

Version 2.2 (v2.2.1). The app is a static page that runs entirely in the visitor's browser. This document records what it can access, what it stores, what it contacts, and the controls that keep it that way.

## Trust boundaries

1. **The visitor's device** holds all data. There is no server component, account, cookie, analytics or telemetry.
2. **The host (Cloudflare)** serves static files and may keep ordinary access logs. It never sees songs, audio or video.
3. **Optional third-party hosts**, contacted only when a camera feature is used: `cdn.jsdelivr.net` (MediaPipe script and WASM) and `storage.googleapis.com` (hand-landmarker and selfie-segmenter models).
4. **The Daily at `/journal/`** shares the origin. It contacts GitHub, Azure DevOps or an AI provider only if the user enters their own credentials.

## Device permissions

| Capability | When it is requested | User control |
| --- | --- | --- |
| Microphone | Only after the user presses **Connect** / "Start and connect my input" (or has opted in to "reconnect my last input on open") | Header **Audio** button; **Ctrl/Cmd + .** kills audio and releases the microphone; browser site settings |
| Audio output and monitoring | Monitoring is **off by default** | Audio panel ▸ "Hear myself" |
| Microphone for Hum to Song | Only when the person presses **● Hum or sing**; recorded in memory, never saved or uploaded | Stop; Ctrl/Cmd + . discards the recording and releases the microphone |
| Camera | Only when a Visuals / Vision camera feature is started, or when **● Begin** (first screen) or **Hum or sing** is pressed with "center stage" ticked (default); the first screen says so before the button is pressed | Camera off / backdrop button; browser site settings |
| Files the user drops or chooses (audio, lyrics, MIDI, song files) | Only when the person drops files on the page or presses **Choose a file…** / **Open a file**; read with the browser's File API in memory, never uploaded. MIDI files are size-limited (8 MB, 300,000 notes, 128 tracks) before they are parsed. Drops are declined while a window is open, and the page never navigates to a dropped file | n/a |
| MIDI | Only when the user enables MIDI | Browser site settings |
| Location, payment, USB, serial | Never (disabled by Permissions-Policy) | n/a |

## Data inventory

| Data | Stored in | Leaves the device? | Cleared by |
| --- | --- | --- | --- |
| Settings, appearance, calibration, tour state | `localStorage` keys `fw.cfg`, `fw.cal`, `fw.tour`, `fw.toured` | No | Reset (Help ▸ Reset) |
| Songs, takes and stems | IndexedDB database `the-daily-songs` | No | Reset, or deleting a song |
| Offline copy of the app | Cache Storage `daily-songs-<version>` (service worker) | No | Reset, or a new version |
| Backups and exports (including **Back up all songs**, WAV bounces and clips saved as WAV) | Files the user downloads. A fast WAV render runs in an offline audio engine in the page and writes nothing until the file is saved | Only where the user puts them | n/a |
| Backup folder (Chrome, Edge) | A folder handle the person chose, kept in IndexedDB; songs are written as `.daily-song.zip` | Only into that folder (a cloud-drive folder syncs under that drive's own rules) | Reset, or choosing another folder |
| Storage-persistence request | The app asks the browser once to keep its storage (`navigator.storage.persist()`); on Safari it also explains Add to Home Screen | No | n/a |
| Camera frames and microphone audio (including a hum recording) | Memory only while in use; the song built from a hum keeps only the notes and chords | No | Stop, kill switch, closing the tab |
| The Daily entries | `localStorage` keys beginning `daily` | Only to a provider the user configures | The Daily's own controls |

The studio's reset removes only the studio's `fw.*` data and its own caches; it leaves The Daily alone.

## Network requests

* On a normal visit: only the site's own files (page, manifest, icons, `samples/manifest.json` and a sample track if the user opens it).
* Camera features add requests to the two hosts above. Nothing is sent to them except the standard request for the file.
* `verify:site` fails the release if the CSP allows any host other than those two.

## Controls in the page and headers

* **Content-Security-Policy** (meta tag in `index.html` and, for the studio page, an identical header plus `frame-ancestors 'none'`): the one inline script is allowed by SHA-256 hash; no `unsafe-eval`, no inline-script allowance; `object-src`, `base-uri` and `form-action` are `'none'`; `blob:` is allowed for the audio worklet and stem worker; `wasm-unsafe-eval` is needed only by MediaPipe.
* **Other headers:** `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, HSTS (one year, no subdomains, no preload), COOP `same-origin`, Permissions-Policy as above. Full list in [HOSTING.md](HOSTING.md#7-headers-and-csp).
* **Supply chain:** zero runtime npm dependencies; fonts (Inter, Montserrat; SIL OFL) are embedded; dev dependencies (jsdom, Playwright) are not shipped. The MediaPipe version is pinned. Licences are in `THIRD_PARTY_NOTICES.md`.
* **Imports:** JSON, WAV, MP3 and preset files are parsed locally; malformed files must produce an error, not code execution. Text from files is inserted as text, not HTML.
* **Same-origin neighbour:** the studio and The Daily use different storage names and do not read each other's data. A cross-site-scripting flaw in either would expose both, which is why both carry a CSP and neither loads third-party scripts. Use a fine-grained, repo-scoped token in The Daily.

## Known limits and residual risks

* Anyone with access to the browser profile can read local data; the app does not encrypt it.
* The two CDN-loaded camera files are not integrity-pinned (MediaPipe loads them dynamically). Self-hosting them removes this ([HOSTING.md §8](HOSTING.md#8-self-hosting-the-camera-model-files)).
* The selfie-segmenter model URL has not been confirmed from the build environment. If it is unavailable the person cut-out look falls back to the edges look.
* `style-src` allows `'unsafe-inline'` because the app sets styles at run time; scripts are not affected.
* HSTS is set for one year without preload; consider preload only after the domain has been stable.

## Reporting

Use GitHub private vulnerability reporting (see [SECURITY.md](../SECURITY.md)).
