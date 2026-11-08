# Release and go-live checklist (reviewed for v2.47.0)

## Before you publish
- [ ] `node scripts/build.mjs --check` passes; `npm test`, `npm run test:e2e`, `npm run test:mobile` pass; the CI `browsers` job (WebKit and Firefox, `test/xbrowser.cjs`) is green; `npm run build:site && npm run verify:site` prints `site verified` and `audit passed` (it includes the size budgets: the page under 700 kB compressed and each room under 150 kB compressed).
- [ ] The real-hardware pass in [HARDWARE_CHECKLIST.md](HARDWARE_CHECKLIST.md) (about 45 minutes: real interface and microphone, kill switch, camera models, MIDI, an iPhone with Add to Home Screen) done on the live site, and the other checks in [TESTING.md](TESTING.md).
- [ ] `npm run shots` run, and `git diff docs/screenshots` looked at: the pictures in the README match the release.
- [ ] **Sample track rights.** No music is bundled. If you add a file to `samples/`, record its licence in `samples/LICENSE.md` and, if it came from an AI music service, confirm that service's terms allow public redistribution.
- [ ] Read `THIRD_PARTY_NOTICES.md`, `PRIVACY.md` and `TERMS.md` once; they should match what you intend. `docs/LICENSING.md` must say it was audited for this version (`npm run audit` fails otherwise); read its *Open items*.
- [ ] Walk the guided tour on a computer (✦ Simple and Full Rig) and on a phone: every card should read true for this release (`test/e2e-tour.cjs` checks the targets, not the words).
- [ ] Look over [GAPS.md](GAPS.md): move what this release closed, and add what it opened.
- [ ] Optional: delete the "Made with AI assistance" line in `src/parts/28-about.js` if you would rather not state it.

## Repository
1. Rename the GitHub repository to `the-daily.studio` (Settings ▸ General). Links in the app and docs already use `github.com/TehauD/the-daily.studio`; GitHub redirects the old name.
2. Settings ▸ Pages: leave **disabled** (production is on Cloudflare; the Pages workflow and `CNAME` were removed).
3. Settings ▸ General ▸ Social preview: upload `icons/social-card.png`.
4. About box: description, website `https://the-daily.studio/`, topics.
5. Turn on private vulnerability reporting (Security ▸ Reporting) and branch protection on `main` (require the CI `verify` job).

## Deploy and domain (Cloudflare)
Follow [HOSTING.md](HOSTING.md) sections 1 and 2: import the repo as Worker `the-daily-studio`, build command `npm run build:site && npm run verify:site`, deploy `npx wrangler deploy`, attach custom domain `the-daily.studio` (and `www`), nameservers at the registrar, SSL mode Full (strict). Remove old GitHub Pages DNS records. Runbook: [OPERATIONS.md](OPERATIONS.md).

## Moving The Daily onto this domain
The page is already vendored at `journal/index.html` and deploys with the site (live at `https://the-daily.studio/journal/`).
1. **Before** switching anything, open the old address (`thedaily.azurewebsites.net`) in each browser you use and **export your entire journal** (and note any repository / provider settings; tokens are stored per address and do not carry over).
2. Open `https://the-daily.studio/journal/`, import the export, and re-enter your repository settings.
3. Optional: leave the Azure site running as it is, or add a redirect there to the new address once you have moved.
4. When The Daily's source changes, refresh the copy: `node scripts/sync-journal.mjs ../daily/public/index.html <commit>`, then commit and push.
5. Heads up: the optional token you enter in The Daily is stored on this site's address, next to the studio. Both pages have a Content-Security-Policy, and neither loads third-party scripts, but use a fine-grained, repo-scoped token.

## Tag and release
```
git tag -a v<version> -m "<the CHANGELOG entry's title>"
git push origin v<version>
```
Create a GitHub release from the tag, using that version's CHANGELOG entry (and those of any versions since the last release).

## Smoke test on the live site (desktop and a phone)
- [ ] Page loads over HTTPS with no console errors; start card appears and **no microphone prompt** shows until you choose.
- [ ] Header **Audio** button: Connect turns the light green; **Ctrl + .** turns it red and the browser's recording indicator goes off; Resume works.
- [ ] `curl -sI https://the-daily.studio/` shows `content-security-policy`, `x-frame-options: deny` and `strict-transport-security`.
- [ ] Blank song opens; play, add a tab note, reload; the song is still there.
- [ ] Appearance drawer opens; switch palette; reload; it persists.
- [ ] Help & shortcuts ▸ About: GitHub and LinkedIn links open the right pages.
- [ ] Songs ▸ All songs ▸ Back up all songs downloads a zip; **Open a file** brings it back.
- [ ] Drop a short WAV, choose **Vocal take**, split it with **Ctrl/⌘ + E**, press **Bounce master WAV**: the render window ends in seconds and the file plays.
- [ ] On an iPhone in Safari, **⋯ More ▸ Keep songs safe** shows the Add to Home Screen steps.
- [ ] Install to home screen / offline reload works.
- [ ] Hand tracking (Vision panel) and the camera **person** look: the one-time question appears first; **Download** then loads from jsDelivr and Google storage (the real download is not covered by the automated tests, the question and the refusal are). Confirm the segmenter model URL resolves.
- [ ] `BASE_URL=https://the-daily.studio/ node test/e2e-privacy.cjs` passes against the live site (no request to any other site, no cookie). From a sandbox that reaches the internet through a proxy, add `PW_PROXY=1`.
- [ ] In Cloudflare: Web Analytics' automatic setup, bot detection's JavaScript and Network Error Logging are off (see SECURITY_MODEL.md, *Live site evaluation*). `curl -s https://the-daily.studio/nope | grep -c cloudflareinsights` prints 0.
- [ ] `https://the-daily.studio/.well-known/security.txt` answers, and its `Expires` date is more than a month away.
- [ ] `https://the-daily.studio/legal/` opens and shows the licence, notices, privacy statement, terms and both font licences.
- [ ] **Song link:** 🔗 Send as a link, open the link in another browser: it offers the song, the address bar is cleaned, and it opens as a new song.
- [ ] **A room:** on a fresh profile, open **Transcribe** or **🎯 Tune** a take: its room loads with no console error (a hash mismatch would be refused). Then go offline and reload: it still opens.
- [ ] **Beats and tuning:** tap a beat and play it; record a short vocal and 🎯 Tune it Natural, then Off.

## Known limits

The current list, with what each release closed, is [GAPS.md](GAPS.md). The lasting ones:
- Songs live in the browser of the device that made them; sync is opt-in (folder sync, or your own GitHub repository). Back up from Songs. Safari clears a site's storage after about a week away unless the site is on the Home Screen; the app says so.
- Hand tracking and the person cut-out depend on jsDelivr and Google storage being reachable (self-hosting is described in HOSTING.md §8).
- Not covered by tests: very long sessions, large stems on low-memory phones, a full screen-reader pass, non-Chromium audio latency, real audio hardware (the automated tests use a fake microphone; see HARDWARE_CHECKLIST.md), and how the band and a tuned voice sound to a listener.
