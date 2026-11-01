# Privacy

**the-daily.studio collects nothing: no server keeps your data, and there is no account of its own, no analytics, no cookies and no advertising.** What you play, sing, record, type or drop in is processed in your browser and stays on your device. Nothing you make is uploaded.

That sentence is a claim about how the software behaves, so this page also says exactly what *can* travel over the network, to whom, and when. Last checked against version 2.19.1 with `test/e2e-privacy.cjs` (see [How this is checked](#how-this-is-checked)).

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
| Studio Replay, thumbnails, ↗ Share and share pages (a video, or a track or clip made into a small M4A) | The recording is played back from memory; a track is turned into M4A in the page; a thumbnail or a one-file share page is made in the page | No. **↗ Share** hands the file to your device's own share sheet, and only when you press it. A share page is a file you download; where it goes next is up to you (see the [terms of use](#terms)) | Nowhere, unless you save it or pick an app to share it with |
| Videos you add behind you (Visuals ▸ 🎞 Your videos) | Played muted, looped and drawn on the visuals, in the page | No | This browser's IndexedDB, next to your songs, until you remove them. They are not part of a song's backup |
| Errors and warnings the studio notices (Help ▸ Report a problem) | The last 20 kept in memory, with quoted names, web addresses and file addresses blanked out, for a report you copy yourself | No. You copy the report and paste it where you choose | In memory only; gone when the page closes |
| Folder sync (Settings ▸ Folder sync, Chrome and Edge; off unless you choose a folder) | Settings, presets, looks, scenes, notes, songs, their recordings and backing tracks are written to, and read from, a folder on your computer that you chose | No. The browser writes the folder itself. If it is inside a cloud drive (iCloud Drive, Dropbox, Google Drive, OneDrive), that drive's own app uploads it, under that drive's terms | The folder; the browser's handle to it in IndexedDB until you turn it off |
| Your studio on GitHub (Settings ▸ GitHub; off unless you connect) | Settings, presets, looks, scenes, notes and songs as text are kept in step with a private repository in your own GitHub account | Yes, to GitHub only, and only after you connect. Recordings, tracks, pictures and videos are never sent | Your repository; the token in this browser's local storage (`fw.ghtok`) until you disconnect |
| Your tip jar: the link, name and message (Creator Studio ▸ 🎸 Tip jar; off unless you set it up) | Turned into a QR code in the page and drawn where you choose: the visuals and stage videos, the Stage, share pages, a printed sign or a picture | No. The page never opens the link, except when you press **Test the link**. People who scan the code go to the service you chose, under its terms | This browser's local storage (`fw.cfg`). It is not part of songs or song backups, and the AI agent tools cannot read or change it |
| Lesson notes (Teacher ▸ 📝 Lesson notes) | Typed and kept per song title | No | This browser's local storage (`fw.lessons`) |
| What an AI agent in your browser reads or changes through the studio's tools (WebMCP) | The tools run in the page: they read the open song, load chord sheets, edit, play and stop | Not by the page. The agent is software you chose to run; see below | Changes go into your song like your own edits (and can be undone) |

Clearing the site's data in your browser, or **Settings ▸ Data ▸ Reset…**, removes all of it. Browsers can also clear site data when disk space is low, so keep copies: **☰ Songs ▸ Back up all songs** makes one zip.

## What can be sent over the network

1. **Loading the site (always).** Your browser asks Cloudflare, which hosts the site at the-daily.studio, for the page and its small files. Like any web host, Cloudflare sees your IP address, browser details and the address requested, and may keep standard access logs and aggregate traffic statistics (page requests, approximate visitor counts, countries) that the site owner can see in the Cloudflare dashboard. This project adds no analytics, cookies or tracking scripts of its own. Cloudflare's own retention is not something this project controls.
2. **MediaPipe (only after you say yes).** Hand tracking and the **Me in front (green screen)** camera look use Google's MediaPipe. The first time you use either, the page asks. If you agree, your browser downloads the MediaPipe code from `cdn.jsdelivr.net` and a small model from `storage.googleapis.com`, about 10 MB. Those two services see your IP address and browser details, as with any download. Your camera pictures are processed on your device and are never uploaded. If you say no, nothing is requested and the app uses the edges-in look or motion-only mode instead. The stage route (**Begin on stage**, **Go on stage while I sing**, **📷 Camera backdrop**) chooses the Me in front look by default, so it asks the first time; the question does not appear until the camera is on.
3. **Links you click.** GitHub, LinkedIn and The Daily open in a new tab only when you click them, and so does your own tip link when you press **Test the link** in the tip jar.

4. **GitHub (only if you connect it, 2.21).** In **Settings ▸ GitHub** you can keep your studio in a private repository in your own GitHub account. Only then does your browser talk to `api.github.com`, directly: it sends your settings (not this device's audio devices, levels, layout, measured latency or download consent), rig presets, stage looks and scenes, lesson notes and notebook, and songs as text (chords, words, tab, arrangement); recordings, backing tracks, pictures and videos stay on the device. The token you paste, or the one **Sign in with GitHub** gets, is kept in this browser (`fw.ghtok`), is never written to the repository and is removed by **Disconnect**. With Sign in with GitHub, this site's Worker turns GitHub's one-time code into that token and renews it; it keeps nothing and never sees your songs. If you **share looks and rigs**, the ones you choose go to a public repository in your account. Opening **Community looks and rigs** asks GitHub's search for studios that share (without signing in, unless you are connected) and reads their public files. GitHub sees your IP address and, when you are connected, your account, under its own privacy statement.

Nothing else. The page cannot contact any other site: its security policy allows only this site plus the hosts above (GitHub's API only for what you connect or open), and the test below fails if anything else is attempted.

## AI agents in your browser

The studio offers its main actions as tools for an AI agent running in your browser (WebMCP, `navigator.modelContext`; also `window.dailyStudio`): reading the song, loading a chord sheet, changing the key or tempo, editing sections, setting the band, playing and stopping, and exporting text. The tools run inside the page and send nothing anywhere. They cannot reach the microphone, the camera, recording, your other files, deleting songs or Settings. Every change an agent makes shows a 🤖 note and can be undone.

An agent is software you run, and it usually works with an AI service. When it reads your song through these tools (title, chords, lyrics), what it does with that text, including sending it to its AI provider, is up to that agent and its provider's terms, not this page. To stop agents using the studio, turn off **Settings ▸ Workflow ▸ Let AI agents in this browser use the studio**.

**Crawlers.** `robots.txt` lets search engines and AI search or answer services (which link back to the page) read the public pages, and asks crawlers that only collect pages for training AI models to stay away. That is a request: well-behaved crawlers follow it.

## What is kept, and for how long

- **By this project: nothing.** No server of this project keeps or receives your data. (The site's Worker only passes GitHub's sign-in code to GitHub and the token back to you, if you use Sign in with GitHub; it stores nothing.)
- **In your browser:** the items in the table above, until you remove them.
- **By your host and the services above:** whatever their own logs keep, under their own policies. A **synced folder**, if you choose one in Settings ▸ Folder sync (Chrome and Edge), holds your studio (and, if you turn it on, a `.daily-song.zip` of each song); it is a folder on your own computer that the browser was given access to, and you can turn it off at any time. A cloud drive that folder is in keeps it under that drive's own policy.
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
