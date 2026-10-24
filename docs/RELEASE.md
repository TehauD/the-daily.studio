# Release and go-live checklist (Release 1, v1.7.0)

## Before you publish
- [ ] `node scripts/build.mjs --check` passes; `npm test`, `npm run test:e2e`, `npm run test:mobile` pass; `npm run build:site && npm run verify:site` prints `site verified`.
- [ ] Manual checks in [TESTING.md](TESTING.md) done on the live site (real microphone, kill switch, camera models, Safari/iOS).
- [ ] **Sample track rights.** `samples/LICENSE.md` says "Good Morning" is © Tehau DeBarthe and not MIT. If it was made with an AI music service, confirm that service's terms allow public redistribution. If unsure, delete the file and `samples/manifest.json` entry and rebuild.
- [ ] Read `THIRD_PARTY_NOTICES.md` and `PRIVACY.md` once; they should match what you intend.
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
git tag -a v1.7.0 -m "Release 1"
git push origin v1.7.0
```
Create a GitHub release from the tag using the 1.7.0 CHANGELOG entry.

## Smoke test on the live site (desktop and a phone)
- [ ] Page loads over HTTPS with no console errors; start card appears and **no microphone prompt** shows until you choose.
- [ ] Header **Audio** button: Connect turns the light green; **Ctrl + .** turns it red and the browser's recording indicator goes off; Resume works.
- [ ] `curl -sI https://the-daily.studio/` shows `content-security-policy`, `x-frame-options: deny` and `strict-transport-security`.
- [ ] Blank song opens; play, add a tab note, reload; the song is still there.
- [ ] Appearance drawer opens; switch palette; reload; it persists.
- [ ] Help & shortcuts ▸ About: GitHub and LinkedIn links open the right pages.
- [ ] Songs ▸ Back up all songs downloads a bundle; import it back.
- [ ] Install to home screen / offline reload works.
- [ ] Hand tracking (Vision panel) and the camera **person** look start; these load from jsDelivr and Google storage and are not covered by the automated tests. Confirm the segmenter model URL resolves.

## Known limits at Release 1
- Songs live in the browser of the device that made them; there is no sync by design. Back up from Songs.
- Hand tracking and the person cut-out depend on jsDelivr and Google storage being reachable (self-hosting is described in HOSTING.md §8).
- Not covered by tests: very long sessions, large stems on low-memory phones, full screen-reader pass, non-Chromium audio latency.
