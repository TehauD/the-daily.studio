# Contributing to the-daily.studio

Thanks for helping. the-daily.studio is a vanilla-JavaScript, local-first guitar workstation, and small, focused contributions are the easiest to review.

## Ways to help

* **Report bugs** with the browser, audio interface and the console output (the issue template asks for these).
* **Share tones, tunings or backing-track results** in Discussions.
* **Improve docs**: corrections, screenshots, translations of the guide.
* **Send code**: bug fixes, new tunings, pedals, amp or cabinet models, band styles, panels, accuracy improvements to transcription or stem separation.

## Set up

```bash
git clone https://github.com/<you>/the-daily.studio.git && cd the-daily.studio
npm install                 # jsdom and playwright, for tests only
npm start                   # http://localhost:8080
```

You need Node 18 or newer. There is no runtime dependency and no bundler.

## The one rule about the build

**Edit files in `src/`. Never edit `index.html` or `codepen/` by hand.** They are generated:

```bash
npm run build               # regenerate index.html and codepen/
npm run build:check         # what CI runs: fails if the outputs are stale
```

Commit the regenerated files together with your source change.

## Checks before opening a pull request

```bash
npm run build
npm test                    # smoke test in jsdom; must print "ERRORS: 0"
npx playwright install chromium     # once
npm run test:e2e            # every real-browser suite, in parallel (about five minutes; name a few to run less: node test/run.cjs clips)
npm run test:mobile         # phone / tablet / desktop layouts and gestures (about a minute)
npm run test:stems          # only if you touched the stem DSP
npm run shots               # only if the look of a screen changed: refreshes docs/screenshots
```

Then try the change in the browser in **light and dark** themes, at a normal laptop width (1280–1440 px), and with the **guided tour** (it must still point at the right things if you moved or renamed UI).

## Code style

* Plain modern JavaScript, no frameworks, no TypeScript, no transpilation. Use the existing helpers (`h()`, `$`, `$$`, `bus`, `store`, `toast`).
* Match the surrounding style: two-space indent, `const` / `let`, single quotes, compact one-line handlers are fine.
* Keep names unique across `src/parts/` (they share one scope). Prefix new subsystems (the stem player is `STP`, the tour is `TOUR`) to avoid clashes.
* Keep the DSP files DOM-free (`09b`, `16a`) so they stay testable in Node.
* Respect the privacy model: **no analytics, no network calls, no external fonts or scripts** unless the user opts in and the README documents it.
* Prefer extending to rewriting. Do not remove features without discussion.

## Accuracy claims

If a change affects transcription, separation or detection, say how you measured it: the in-app **self-test**, `npm run test:stems`, or your own recordings (describe the setup). Report honest before / after numbers, including any case that got worse.

## Commit and PR conventions

* Short imperative subject ("Add Drop A tuning preset"), details in the body.
* One logical change per PR. Link the issue if there is one.
* By contributing you agree your work is released under the repository's [MIT License](LICENSE).

## Conduct

Be kind and assume good faith. Harassment and personal attacks are not welcome; maintainers may remove comments or contributors who cross that line.
