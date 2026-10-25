# Privacy

**the-daily.studio collects nothing.** There is no server behind it, no account, no analytics, no cookies and no advertising.

## What stays on your device

- Songs, lyrics, chords, tab, recorded takes and backing tracks: in this browser's IndexedDB (the **☰ Songs** library).
- Settings, appearance, presets and notes: in this browser's local storage.
- Microphone, camera and MIDI: used live inside the page after you grant permission. Audio and video frames are not sent anywhere or stored unless you record a take, and takes stay in the library on your device.
- A copy of the app itself, so it opens offline: in Cache Storage via a service worker.

Clearing the site's data in your browser, or **Settings ▸ Data ▸ Reset…**, removes it. Browsers can also clear site data when disk space is low, so keep copies: **☰ Songs ▸ Back up all songs** makes one zip.

## What can leave your device

- **Only if you switch on hand tracking** in the Vision panel, or choose the **“Me in front (green screen)”** camera look, your browser downloads the MediaPipe runtime from jsDelivr and the hand or person-cut-out model from Google Cloud Storage. Those services see your IP address and browser details as with any download; your camera frames are processed locally and are not uploaded.
- **Files you choose to export** (bundles, WAV, text, MIDI) are saved to your device. What you do with them afterwards is up to you.
- **Links** to GitHub, LinkedIn and The Daily open in a new tab only when you click them.

## The Daily at /journal/

The site also hosts [The Daily](https://the-daily.studio/journal/), a separate journal app by the same author. It follows the same rule: entries stay in your browser. It only contacts GitHub, Azure DevOps or an AI provider if you enter your own credentials and use those features, and it sends them directly from your browser to that provider, never to this site. Because both apps are on the same web address, your browser keeps their data side by side (the studio under `fw.` names, The Daily under `daily` names). They do not read each other's data, and the studio's reset only removes the studio's own.

## Hum to Song

Humming uses your microphone (and your camera if you leave "center stage" on) only after you press the button. The recording is analysed on your device, kept in memory while you work, and is not uploaded or stored; the saved song contains only the notes, chords and settings that were derived from it.

## Hosting

The site is served as static files from Cloudflare at the-daily.studio. Like any web host, Cloudflare may keep standard access logs and aggregate traffic statistics (page requests, approximate visitor counts, countries), which the site owner can view in the Cloudflare dashboard; this project adds no analytics, cookies or tracking scripts. The optional camera features (hand tracking, person cut-out) fetch a script and model files from cdn.jsdelivr.net and storage.googleapis.com only when you turn them on; your camera frames are processed on your device and never uploaded. The microphone is never opened until you press a button, and Ctrl/Cmd + . releases it at any time.

## Children

The app has no accounts, messaging or data collection. Songs you create stay on the device you use.

## Changes and contact

If this ever changes, the change will be listed in the [changelog](CHANGELOG.md) before it ships. Questions: open an issue at <https://github.com/TehauD/the-daily.studio/issues>.
