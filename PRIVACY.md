# Privacy

**the-daily.studio has no server, no account, no analytics, no cookies and no advertising.** What you play, sing, record, type or drop in is processed in your browser and stays on your device. Nothing you make is uploaded.

That sentence is a claim about how the software behaves, so this page also says exactly what *can* travel over the network, to whom, and when. Last checked against version 2.6.0 with `test/e2e-privacy.cjs` (see [How this is checked](#how-this-is-checked)).

## What happens to your data

| Your data | What the page does with it | Sent anywhere? | Where it is kept |
| --- | --- | --- | --- |
| Microphone, guitar input and MIDI | Played, metered and analysed live in the page | No | Nowhere, unless you record a take |
| Camera pictures | Shown behind the visuals and (optionally) analysed for hand tracking or the person cut-out, in the page | No | Nowhere. Stage recordings are saved only as a file you download |
| Songs, lyrics, chords, tab, takes, backing tracks and stems | Edited and played in the page | No | This browser's IndexedDB (☰ Songs) until you delete them |
| Files you drop or open (audio, MIDI, lyrics, song files) | Read in the page's memory | No | Only the song you make from them is kept, in IndexedDB |
| Settings, appearance, presets and notes | Used by the page | No | This browser's local storage (`fw.` keys) |
| Pictures you add to the stage (backdrops, a pixel wall, a logo) | Reduced to at most 1920 px and drawn behind the lights, in the page | No | This browser's IndexedDB, next to your songs, until you remove them. They are not part of a song's `.zip` and not in a backup |
| The app itself | Cached so it opens offline | No | This browser's Cache Storage |
| Hum to Song recordings | Analysed in memory | No | Not stored. Only the notes, chords and settings derived from it are saved |
| Exports (WAV, M4A, MIDI, share page, print sheet, Sky poster, stage video, backup zips) | Built in the page | No | A file in your downloads. What you do with it afterwards is up to you |
| Screen recordings (Teacher ▸ ⏺ Record screen) | Your browser asks which tab, window or screen to share; the picture, the studio's sound and (if you allow it) your microphone are recorded in the page | No | In memory for Studio Replay until you record another or close the page; saved only as a file you download |
| Studio Replay, thumbnails and ↗ Share | The newest recording is played back from memory; a thumbnail is drawn in the page | No. **↗ Share** hands the file to your device's own share sheet, and only when you press it | Nowhere, unless you save it or pick an app to share it with |
| Lesson notes (Teacher ▸ 📝 Lesson notes) | Typed and kept per song title | No | This browser's local storage (`fw.lessons`) |

Clearing the site's data in your browser, or **Settings ▸ Data ▸ Reset…**, removes all of it. Browsers can also clear site data when disk space is low, so keep copies: **☰ Songs ▸ Back up all songs** makes one zip.

## What can be sent over the network

1. **Loading the site (always).** Your browser asks Cloudflare, which hosts the site at the-daily.studio, for the page and its small files. Like any web host, Cloudflare sees your IP address, browser details and the address requested, and may keep standard access logs and aggregate traffic statistics (page requests, approximate visitor counts, countries) that the site owner can see in the Cloudflare dashboard. This project adds no analytics, cookies or tracking scripts of its own. Cloudflare's own retention is not something this project controls.
2. **MediaPipe (only after you say yes).** Hand tracking and the **Me in front (green screen)** camera look use Google's MediaPipe. The first time you use either, the page asks. If you agree, your browser downloads the MediaPipe code from `cdn.jsdelivr.net` and a small model from `storage.googleapis.com`, about 10 MB. Those two services see your IP address and browser details, as with any download. Your camera pictures are processed on your device and are never uploaded. If you say no, nothing is requested and the app uses the edges-in look or motion-only mode instead. The stage route (**Begin on stage**, **Go on stage while I sing**, **📷 Camera backdrop**) chooses the Me in front look by default, so it asks the first time; the question does not appear until the camera is on.
3. **Links you click.** GitHub, LinkedIn and The Daily open in a new tab only when you click them.

Nothing else. The page cannot contact any other site: its security policy allows only this site plus the two hosts above, and the test below fails if anything else is attempted.

## What is kept, and for how long

- **By this project: nothing.** It has no server and receives no data.
- **In your browser:** the items in the table above, until you remove them.
- **By your host and the services above:** whatever their own logs keep, under their own policies. A **backup folder**, if you choose one in Settings (Chrome and Edge), receives a copy of each song you edit; it is a folder on your own computer that the browser was given access to, and you can remove the access at any time.
- **Persistent storage.** The app may ask the browser to keep its library (the browser decides). Safari can still clear a site's data after about a week without a visit unless the site is added to the Home Screen; the app tells you when that applies.

## The Daily at /journal/

The site also hosts [The Daily](https://the-daily.studio/journal/), a separate journal app by the same author. Its entries stay in your browser. It contacts GitHub, Azure DevOps or an AI provider only if you enter your own credentials and use those features, and it sends them straight from your browser to that provider, never to this site. Its page also allows images from any `https` address, so an entry that links to a remote picture makes your browser fetch it. Because both apps share the same web address, your browser keeps their data side by side (the studio under `fw.` names, The Daily under `daily` names). They do not read each other's data, and the studio's reset only removes the studio's own. The studio never loads The Daily unless you open it.

## Hum to Song

Humming uses your microphone (and your camera if you leave "center stage" on) only after you press the button. The recording is analysed on your device and kept in memory while you work. The saved song contains only the notes, chords and settings that were derived from it.

## Children

The app has no accounts, messaging or data collection. Songs you create stay on the device you use.

## How this is checked

- `test/e2e-privacy.cjs` opens the app in a real browser, plays a whole session (first visit, demo song, playback, Concert and its Sky poster, the Show setup console worked through tab by tab with a looks file saved, a stem split, a recording, every kind of export and the backup) and fails if any request goes to another site, if a cookie is set, or if anything is stored outside the app's own names. It also checks that the camera and hand tracking ask before they touch jsDelivr or Google, and that "no" stays offline. After a deploy, run it against the live site: `BASE_URL=https://the-daily.studio/ node test/e2e-privacy.cjs`.
- `npm run audit` checks the shipped files, hosts and licences against [docs/LICENSING.md](docs/LICENSING.md).

If this ever changes, the change will be listed in the [changelog](CHANGELOG.md) before it ships. Questions: open an issue at <https://github.com/TehauD/the-daily.studio/issues>.
