# Testing and quality gates

| Command | What it proves | Needs |
| --- | --- | --- |
| `npm run build:check` | Committed `index.html`, `codepen/`, `sw.js`, manifest match `src/` | Node |
| `npm test` | Boots the whole app in jsdom; any script error fails; checks presets, undo/redo, theory, lab update | `npm ci` |
| `npm run test:stems` | Stem-separation benchmark on synthetic audio | Node |
| `npm run test:e2e` | Real Chromium flows: start overlay, **no microphone request on load**, Audio button, **Ctrl + . kill and resume**, tunings, tour, rig deck, transcription, stems, appearance and palettes, camera looks (including a stubbed person segmenter), The Daily at `/journal/`, reset | Playwright Chromium |
| `npm run test:mobile` | Phone, tablet and desktop layouts, More sheet, navigation | Playwright Chromium |
| `npm run build:site && npm run verify:site` | Deploy folder complete; CSP hash matches the script; header policy; only two third-party hosts; version matches service worker | Node |

In sandboxes: `CHROMIUM_PATH=/path/to/chromium NO_SANDBOX=1 npm run test:e2e`.

## Manual checks before a release

Automated tests use a fake microphone and do not reach the third-party camera hosts. Do these on the deployed site:

1. **Real audio:** connect a real interface or headphone mic, play, then press Ctrl/Cmd + . and confirm the browser's recording indicator turns off. Resume; confirm the microphone stays off until Connect.
2. **Monitoring:** off by default; tick "Hear myself" with headphones and confirm sound; untick.
3. **Camera:** Visuals ▸ camera backdrop, look = *person* and *edges*; hand tracking. Confirm models load (Network tab shows jsDelivr and storage.googleapis.com).
4. **Offline:** load once, go offline, reload; install to home screen on a phone.
5. **Browsers:** current Chrome/Edge, Safari (macOS and iOS), Firefox. Web Audio and camera behave differently; note any gaps in the changelog.
6. **Accessibility:** keyboard-only pass through start card, Audio panel and Appearance; run axe on the light and dark default palettes and the Audio dialog.
7. **Journal:** `/journal/` loads, imports an export, and the studio's Reset does not remove it.

## What is not covered

Very long sessions, large stem imports on low-memory phones, screen-reader pass of every panel, and non-Chromium audio latency. These are known gaps for Release 1.
