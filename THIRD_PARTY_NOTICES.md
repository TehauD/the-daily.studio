# Third-party notices

the-daily.studio is a single static page. It ships **no third-party code**: no frameworks, no runtime dependencies, no icon sets, no analytics and no audio or image assets from anyone else. The only third-party material inside the page is two typefaces (below). This file lists everything the site builds on, embeds or may fetch, and what has been checked. The same text is published at `/legal/` on the site. The file-by-file register is [docs/LICENSING.md](docs/LICENSING.md), and `npm run audit` checks it against what is actually shipped.

## Fetched only after you agree

| Component | Author | Licence | How it is used |
| --- | --- | --- | --- |
| [MediaPipe Tasks Vision](https://developers.google.com/mediapipe) (`@mediapipe/tasks-vision` 0.10.14) | Google | Apache-2.0 | Hand tracking and the person cut-out. Your browser fetches it from jsDelivr after you say yes to the one-time download. Nothing is copied into this repository or served from this site. |
| MediaPipe Hand Landmarker model (`hand_landmarker.task`) | Google | Apache-2.0 according to its model card; Google's pages do not carry a separate licence statement for the file | Fetched from Google Cloud Storage at the same moment, only for hand tracking. |
| MediaPipe Selfie Segmenter model (`selfie_segmenter.tflite`) | Google | No separate licence statement found; governed by Google's MediaPipe terms and model card | The “Me in front (green screen)” camera look. Fetched from Google Cloud Storage with the same runtime, only for that look. Frames are processed in your browser. |

What was checked: a text search of the 0.10.14 package found no analytics, beacon or telemetry calls and no hard-coded web addresses in its JavaScript (it loads only the addresses this page hands it), and WebAssembly cannot reach the network by itself. Because this project neither hosts nor copies the models, no licence is needed to *serve* them. If you self-host them (see [docs/HOSTING.md](docs/HOSTING.md)), you become the distributor: confirm Google's current terms for the model files first. "Motion energy only" mode and the edges-in look need none of this and work offline. Apache-2.0 text: <https://www.apache.org/licenses/LICENSE-2.0>.

## Methods (re-implemented from the published papers; no code copied)

- **YIN** fundamental-frequency estimation: A. de Cheveigné and H. Kawahara, *YIN, a fundamental frequency estimator for speech and music*, JASA 111(4), 2002.
- **Harmonic / percussive separation** by median filtering: D. Fitzgerald, *Harmonic/Percussive Separation using Median Filtering*, DAFx-10, 2010.
- **Karplus–Strong** plucked-string synthesis: K. Karplus and A. Strong, *Digital Synthesis of Plucked-String and Drum Timbres*, Computer Music Journal 7(2), 1983.

There are no trained neural-network weights in this project (the source was searched for model files, embedded tensors and large numeric tables: none). The Neural Map visualisation starts empty and learns from what is played in the session (a small Markov next-chord predictor and an embedding cloud). Stem separation, chord and tab extraction and the band are signal-processing code written for this project. No pretrained checkpoint is bundled or downloaded, other than the two optional MediaPipe models above.

## Platform

Web Audio API, AudioWorklet, Web MIDI, MediaDevices, Canvas, SVG, IndexedDB and Cache Storage as provided by your browser.

## Used only for development and tests (not shipped to users)

The full dependency tree is 41 packages, all from `devDependencies` (`jsdom` and `playwright`), none installed on the site and none reachable from it. Their licences, read from the lockfile: MIT (29), Apache-2.0 (3: `playwright`, `playwright-core`, `xml-name-validator`), MIT-0 (2), BSD-2-Clause (2), BSD-3-Clause (2), ISC (1), BlueOak-1.0.0 (1), CC0-1.0 (1). No copyleft and no unlicensed packages. There are no runtime (`dependencies`) packages at all. `npm run audit` fails if that changes or if a licence outside this permissive set appears.

## Fonts

Two typefaces are built into the page (latin subset, variable weight, embedded in `index.html`), both under the **SIL Open Font License 1.1**. Each font file carries its copyright and licence address in its own metadata, the full texts are in `src/fonts/OFL-Inter.txt` and `src/fonts/OFL-Montserrat.txt`, and both are published at `/legal/`. Neither declares a Reserved Font Name.

| Font | Version | Used for | Copyright |
| --- | --- | --- | --- |
| [Inter](https://rsms.me/inter/) | 4.001 | Interface text | © 2016 The Inter Project Authors |
| [Montserrat](https://github.com/JulietaUla/Montserrat) | 9.000 | Headings, wordmark | © 2011 The Montserrat Project Authors |

The other typefaces in Appearance (Humanist, Rounded, Editorial serif, High legibility, System UI, Instrument mono) are requested by name and use whichever fonts your device already has; none are included.

The logo letters (T, D, S) are drawn as strokes in `scripts/brand-mark.mjs`, not set in a font. The app icons, social card and brand sheet are generated from that file by `scripts/make-brand.mjs`.

## Music, lyrics and sample audio

No recording of anyone else's music and no one else's lyrics are bundled. The built-in demo song (“Salt Wind”) is a short original sketch written for this project: two ordinary four-chord progressions and four short lines of original words. Sample tracks (`samples/`) are empty; if you add any, describe each file's licence in `samples/LICENSE.md` (`npm run audit` fails if an audio file there is not listed). Audio, lyrics and tab you bring in belong to their owners, stay on your device, and are your responsibility; see [docs/LICENSING.md](docs/LICENSING.md#what-you-bring-in-and-what-comes-out).

## Names and trademarks

Ultimate Guitar, Focusrite, Scarlett, MIDI, Google, MediaPipe, Cloudflare and any amplifier, pedal or software names that appear are trademarks of their owners and are used only to describe compatibility. This project is independent and is not affiliated with or endorsed by them.

## Assistance

Developed with the assistance of Claude (Anthropic) under the direction of the author.

## Bundled first-party app: The Daily

`journal/index.html` is [The Daily](https://github.com/TehauD/daily), a separate developer journal by the same author, MIT licensed (© 2026 Tehau DeBarthe). It is served at `/journal/` on the same site and is copied in unchanged apart from a Content-Security-Policy tag (see `journal/SOURCE.md`). It was checked for embedded libraries, fonts and images: it is one self-contained file with no third-party code, no embedded binary assets and no external scripts. It talks to GitHub, Azure DevOps and AI providers only with credentials you enter.
