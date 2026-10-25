# Third-party notices

the-daily.studio is a single static page with **no bundled third-party code**: no frameworks, no npm runtime dependencies, no icon sets and no analytics, and just two bundled typefaces (below). This file lists everything it builds on or may load, so credit goes where it is due.

## Loaded only if you turn it on

| Component | Author | Licence | How it is used |
| --- | --- | --- | --- |
| [MediaPipe Tasks Vision](https://developers.google.com/mediapipe) (`@mediapipe/tasks-vision` 0.10.14) | Google | Apache-2.0 | Hand tracking in the Vision panel. Fetched from jsDelivr when you enable hand tracking; nothing is copied into this repository. |
| MediaPipe Hand Landmarker model (`hand_landmarker.task`) | Google | Apache-2.0 | Fetched from Google Cloud Storage at the same moment. |
| MediaPipe Selfie Segmenter model (`selfie_segmenter.tflite`) | Google | Apache-2.0 | The “Me in front (green screen)” camera look. Fetched from Google Cloud Storage, with the same runtime, only when you choose that look. Frames are processed in your browser. |

"Motion energy only" mode in the Vision panel needs neither and works offline. Apache-2.0 text: <https://www.apache.org/licenses/LICENSE-2.0>.

## Methods (re-implemented from the published papers; no code copied)

- **YIN** fundamental-frequency estimation: A. de Cheveigné and H. Kawahara, *YIN, a fundamental frequency estimator for speech and music*, JASA 111(4), 2002.
- **Harmonic / percussive separation** by median filtering: D. Fitzgerald, *Harmonic/Percussive Separation using Median Filtering*, DAFx-10, 2010.
- **Karplus–Strong** plucked-string synthesis: K. Karplus and A. Strong, *Digital Synthesis of Plucked-String and Drum Timbres*, Computer Music Journal 7(2), 1983.

## Platform

Web Audio API, AudioWorklet, Web MIDI, MediaDevices, Canvas, SVG, IndexedDB and Cache Storage as provided by your browser.

## Used only for development and tests (not shipped to users)

[Playwright](https://playwright.dev/) (Apache-2.0) and [jsdom](https://github.com/jsdom/jsdom) (MIT), listed in `devDependencies`.

## Fonts

Two typefaces are built into the page (latin subset, variable weight, embedded in `index.html`), both under the **SIL Open Font License 1.1** (full texts in `src/fonts/OFL-Inter.txt` and `src/fonts/OFL-Montserrat.txt`):

| Font | Used for | Copyright |
| --- | --- | --- |
| [Inter](https://rsms.me/inter/) | Interface text | © 2016 The Inter Project Authors |
| [Montserrat](https://github.com/JulietaUla/Montserrat) | Headings, wordmark | © 2011 The Montserrat Project Authors |

The other typefaces in Appearance (Humanist, Rounded, Editorial serif, High legibility, System UI, Instrument mono) are requested by name and use whichever fonts your device already has; none are included.

The logo letters (T, D, S) are drawn as strokes in `scripts/brand-mark.mjs`, not set in a font.

## Sample audio

No music is bundled. If you add sample tracks to `samples/`, describe their licence in `samples/LICENSE.md`.

## Names and trademarks

Ultimate Guitar, Focusrite, Scarlett, MIDI, Google, MediaPipe and any amplifier, pedal or software names that appear are trademarks of their owners and are used only to describe compatibility. This project is independent and is not affiliated with or endorsed by them.

## Assistance

Developed with the assistance of Claude (Anthropic) under the direction of the author.

## Bundled first-party app: The Daily

`journal/index.html` is [The Daily](https://github.com/TehauD/daily), a separate developer journal by the same author, MIT licensed (© 2026 Tehau DeBarthe). It is served at `/journal/` on the same site, is copied in unchanged apart from a Content-Security-Policy tag (see `journal/SOURCE.md`), and has its own dependencies and notices in its own repository.
