# Operations runbook

How version 2.10 (v2.10.0) is built, shipped, watched and rolled back. The site is static, so there are no servers to patch and no database to restore.

## Moving parts

| Piece | Where | Notes |
| --- | --- | --- |
| Source of truth | GitHub `TehauD/the-daily.studio`, branch `main` | `src/` is edited; `index.html`, `codepen/`, `sw.js`, `manifest.webmanifest` are generated and committed |
| Build and deploy | Cloudflare Workers Builds, project `the-daily-studio` | build `npm run build:site && npm run verify:site`, deploy `npx wrangler deploy` |
| Hosting | Cloudflare Workers static assets (`dist/`) | headers from `dist/_headers` |
| Domain and TLS | Cloudflare DNS and certificates | `the-daily.studio`, `www` |
| Journal | `/journal/` (vendored copy of The Daily) | refresh with `scripts/sync-journal.mjs` |
| CI | `.github/workflows/ci.yml` | build check, deploy-folder check, smoke, stems benchmark, e2e and layouts (e2e job is allowed to fail on flaky runners) |

There are no secrets, API keys or environment variables anywhere.

## Release procedure

1. `git pull`; edit `src/`.
2. `npm run build` then `npm test`, `npm run test:e2e`, `npm run test:mobile` (e2e and mobile need Playwright Chromium: `npx playwright install chromium`; in sandboxes set `CHROMIUM_PATH` and `NO_SANDBOX=1`).
3. `npm run build:site && npm run verify:site` must print `site verified`.
4. Update `CHANGELOG.md`; bump `version` in `package.json` and `VERSION` in `src/parts/01-core.js` together (the service-worker cache name follows the version, and `verify:site` checks it).
5. Commit, push to `main`. Cloudflare builds and deploys; a failing build leaves the previous version live.
6. Run the live smoke test in [RELEASE.md](RELEASE.md). Tag `vX.Y.Z` and publish a GitHub release.

## Rollback

* **Fastest:** Cloudflare dashboard ▸ the Worker ▸ **Deployments** (or *Versions*) ▸ pick the last good version ▸ **Rollback / Deploy**. Takes seconds and needs no git change.
* **Permanent:** `git revert <bad commit>`, push; the pipeline redeploys.
* Visitors with the old version cached get the fix on their next visit or second launch (the service worker updates itself). `index.html` and `sw.js` are served `no-cache` so a rollback is not held back by caches.
* User data is never touched by a deploy. Songs, settings and The Daily entries live in each visitor's browser.

## Monitoring

No telemetry exists in the app by design. Use:

* Cloudflare **Workers & Pages ▸ Metrics** (requests, errors) and **Analytics** for aggregate traffic; no cookies or scripts are added to the pages. Keep **Web Analytics' automatic setup off**: it injects a script into the page, which would contradict the privacy statement. The live-site check (`BASE_URL=https://the-daily.studio/ node test/e2e-privacy.cjs`) fails if anything like it appears.
* An external uptime check on `https://the-daily.studio/` and `/journal/` (any free monitor; expect HTTP 200).
* GitHub Issues for user reports. Security reports go through private vulnerability reporting (see [SECURITY.md](../SECURITY.md)).

## Incident playbook

| Situation | Action |
| --- | --- |
| Blank page after a deploy | Console shows a CSP violation: the inline script hash and `index.html` disagree. Roll back, then `npm run build` and redeploy. `verify:site` should have blocked this; check the build log |
| Old version keeps appearing | Confirm `sw.js` is served `no-cache` (curl the headers). Ask the user to close and reopen the installed app; purge Cloudflare cache for `/sw.js` and `/` if needed |
| Audio runaway or feedback reports | By design the user can press **Ctrl/Cmd + .** or the header Audio button ▸ red button. Confirm monitoring defaults to off (`CFG.monitor` false) and that nothing connects at load |
| Hum to Song finds too few notes | Usually a noisy room or quiet recording; the app already says so and offers Try again. For a real bug, get the voice memo and run `humAnalyze` on it via `?debug` |
| Camera cut-out or hand tracking fails | Third-party host unreachable (jsDelivr or Google storage), or a school/work network blocks it. The app falls back to the edges look / motion energy. Check the model URLs in `09d-camfx.js` and `09-ui-viz.js` |
| `/journal/` broken | Re-run `node scripts/sync-journal.mjs <path-to-daily/public/index.html> <commit>`; check `journal/SOURCE.md`; run the e2e journal check |
| Domain or certificate problem | Cloudflare ▸ SSL/TLS ▸ Edge certificates; confirm the Worker custom domain is attached and DNS records are proxied |
| Dependency advisory (Playwright, jsdom) | They are dev-only and not shipped. Update with `npm update`, rerun all tests |

## Routine maintenance

* **Quarterly:** `npm audit`, update dev dependencies, confirm the MediaPipe version and model URLs still resolve, re-run the accessibility check, re-read `THIRD_PARTY_NOTICES.md`.
* **When The Daily changes:** sync the vendored copy and re-test `/journal/`.
* **Backups:** nothing server-side. The repository is the backup of the code; users back up songs from ☰ Songs ▸ Back up all songs.
* **Domain renewal:** put the registrar renewal date in a calendar; losing the domain loses the site.

## Support link (optional)

The app has no payments and no backend. To let people say thanks, create a page on a tip-jar service (Ko-fi charges no fee on tips; Buy Me a Coffee and GitHub Sponsors are alternatives) and paste its address into `BRAND.support` in `src/parts/01-core.js`, then rebuild. About ▸ shows a "Buy me a coffee" button; the link opens in a new tab with `noopener noreferrer`, loads nothing into the app, and the CSP is unchanged. Leave it empty to show nothing. Mention it in the README if you like.
