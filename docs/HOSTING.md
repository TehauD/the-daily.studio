# Hosting the-daily.studio

the-daily.studio is a **static site**: one `index.html` with everything inside, plus a manifest, a service worker, icons, optional sample tracks, and The Daily journal at `/journal/`. There is no backend, database or server code. **Production runs on Cloudflare Workers static assets**; any static host works.

> **Why HTTPS matters.** Browsers only allow the **microphone, camera and MIDI** on secure contexts (`https://…` and `http://localhost`). Cloudflare serves HTTPS automatically. A plain `http://` or `http://192.168.x.x` address will not get microphone access.

Contents: [1. Deploy on Cloudflare](#1-deploy-on-cloudflare) · [2. Custom domain](#2-custom-domain) · [3. Check it works](#3-check-it-works) · [4. Updating](#4-updating-the-site) · [5. Releases](#5-cut-a-release) · [6. Other hosts](#6-other-hosts) · [7. Headers and CSP](#7-headers-and-csp) · [8. Self-hosting camera models](#8-self-hosting-the-camera-model-files) · [9. Troubleshooting](#9-troubleshooting)

For day-to-day running, rollback and incident steps see [OPERATIONS.md](OPERATIONS.md). For the security design see [SECURITY_MODEL.md](SECURITY_MODEL.md).

---

## 1. Deploy on Cloudflare

The repo contains `wrangler.jsonc` and two scripts:

* `npm run build:site` builds the app, copies exactly the files to serve into `dist/`, and writes `dist/_headers` (security headers and the Content-Security-Policy, generated from the page itself).
* `npm run verify:site` is the release gate: it fails if a required file is missing, the CSP hash no longer matches the script, framing is allowed, or a third-party host appears that should not.

In **Workers & Pages ▸ Create ▸ Import a repository**, choose the repository and set:

| Field | Value |
| --- | --- |
| Project name | `the-daily-studio` (must match `name` in `wrangler.jsonc`) |
| Build command | `npm run build:site && npm run verify:site` (`wrangler.jsonc` repeats it, so a deploy still works if this is left as `npm run build`) |
| Deploy command | `npx wrangler deploy` |
| Preview command | `npx wrangler versions upload` |
| Preview builds | on (optional; gives every branch a test URL) |
| Cloudflare Access | off (the site is public) |

Every push to the production branch builds, verifies and deploys. If `verify:site` fails the build stops and the previous version stays live.

## 2. Custom domain

1. Add `the-daily.studio` to Cloudflare (Websites ▸ Add a domain) and change the nameservers at your registrar to the two Cloudflare gives you.
2. Remove any old GitHub Pages `A`, `AAAA` or `CNAME` records so they do not conflict.
3. On the Worker: **Settings ▸ Domains & Routes ▸ Add ▸ Custom domain** → `the-daily.studio`, then again for `www` (and set a redirect from `www` to the apex if you want one).
4. HTTPS is issued automatically. In **SSL/TLS** use mode *Full (strict)*; optionally turn on *Always use HTTPS*.
5. The app is at `/` and The Daily at `/journal/`.

Songs are stored per web address. People who used another address will not see their songs here: back up first (☰ Songs ▸ Back up all songs) and import on the new address. If you fork this for another domain, change `robots.txt`, `sitemap.xml`, `manifest.webmanifest` links, and `BRAND` in `src/parts/01-core.js`.

## 3. Check it works

Open the site in Chrome or Edge:

1. The start card appears. **Start with camera and mic off** opens the app with no permission prompt.
2. Header **Audio** button ▸ **Connect** asks for the microphone; the light turns green. **Ctrl + .** turns it off again.
3. **?** ▸ **Take the guided tour** runs through all steps.
4. The console shows no red errors, and the Network tab shows no requests to other hosts until you use camera hand tracking or a person-cutout look.
5. `https://the-daily.studio/journal/` opens The Daily.

Sample tracks in `samples/` are served beside the page and listed in the app. Keep each file to a few MB.

### Phones and installing as an app

The hosted HTTPS page is also the mobile app. Chrome and Edge offer **⋯ More ▸ Install app**; on iPhone use **Share ▸ Add to Home Screen**. The service worker (`sw.js`) caches the page for offline use and refreshes it on the next visit; after a deploy, close and reopen the app (or reload twice) to pick up the new version.

## 4. Updating the site

All source lives in `src/`. `index.html` and `codepen/` are **generated** from it.

```bash
# edit src/parts/*.js, src/styles.css or src/body.html
npm run build            # regenerate index.html and codepen/
npm test                 # optional: smoke test (needs `npm install` once)
git add -A && git commit -m "Describe your change"
git push                 # Cloudflare builds, verifies and deploys automatically
```

Continuous integration (`.github/workflows/ci.yml`) runs `npm run build:check` so a pull request that edits `src/` without rebuilding is flagged, builds the deploy folder and runs `npm run verify:site`, then runs the smoke test.

Browsers cache aggressively. After a deploy, hard-reload (<kbd>Ctrl/⌘</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>) to see the new version; your saved song and settings are kept.

## 5. Cut a release

Releases give people a stable download (a zip of the repository) and a changelog.

1. Bump the version in `package.json` and in `src/parts/01-core.js` (`const VERSION = '…'`), and add notes to `CHANGELOG.md`.
2. `npm run build && npm run build:site && npm run verify:site && git add -A && git commit -m "Release v2.12.0" && git push`
3. Tag and publish:

```bash
git tag -a v2.12.0 -m "the-daily.studio 2.12.0"
git push origin v2.12.0
gh release create v2.1.0 --title "the-daily.studio 2.1.0" --notes-file CHANGELOG.md
# optional: attach the standalone page for people who just want the file
gh release upload v2.12.0 index.html#the-daily.studio-standalone.html
```

## 6. Other hosts

Any static host works: copy the contents of `dist/` (run `npm run build:site`). Serve over HTTPS. Keep `index.html`, `manifest.webmanifest`, `sw.js` and `icons/` together at the same path. `_headers` is Cloudflare/Netlify syntax; translate it for nginx or Apache (the contents are listed in section 7). nginx example:

```nginx
server {
  listen 443 ssl http2;
  server_name the-daily.studio;
  root /var/www/the-daily.studio;
  location = /sw.js { add_header Cache-Control "no-cache"; }
  location = / { add_header Cache-Control "no-cache"; }
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header Referrer-Policy "no-referrer" always;
  add_header Strict-Transport-Security "max-age=31536000" always;
  add_header Permissions-Policy "microphone=(self), camera=(self), midi=(self), geolocation=(), payment=()" always;
}
```

GitHub Pages also works (no custom headers; the meta CSP still applies). It is not used for production here.

## 7. Headers and CSP

`dist/_headers` is generated by `scripts/assemble.mjs`:

| Header | Value | Why |
| --- | --- | --- |
| Content-Security-Policy | the same policy as the page's `<meta>` tag, plus `frame-ancestors 'none'` (studio page only) | `frame-ancestors` only works as a header. The Daily keeps its own policy |
| X-Frame-Options | `DENY` | no clickjacking |
| X-Content-Type-Options | `nosniff` | no MIME guessing |
| Referrer-Policy | `no-referrer` | nothing leaks in referrers |
| Strict-Transport-Security | `max-age=31536000` | HTTPS only for a year (no `includeSubDomains`, no preload) |
| Cross-Origin-Opener-Policy | `same-origin` | isolates the window |
| Permissions-Policy | microphone, camera, MIDI for this site only; geolocation, payment, USB, serial off | least privilege |
| Cache-Control | `no-cache` for `/`, `index.html`, `sw.js`, manifest, `/journal/*`; one day for icons | new releases show up immediately |

The page's CSP allows the single inline script by its SHA-256 hash (no `unsafe-inline` or `unsafe-eval` for scripts), `blob:` workers and worklets, `data:` images and fonts, and, only for optional camera features, jsDelivr and Google storage. Because the hash changes whenever the script changes, **always deploy a freshly built `index.html`**; `build --check` and `verify:site` enforce it. If you hand-edit the script in `index.html` the console shows a CSP violation and the app will not start.

If you remove the camera features, drop the two external hosts and `wasm-unsafe-eval` from the `csp` string in `scripts/build.mjs`, and `verify:site`'s host check, and the page makes no third-party requests at all.

## 8. Self-hosting the camera model files

Optional camera features load, at runtime and only when used: the MediaPipe Tasks Vision script and WASM from jsDelivr (`@mediapipe/tasks-vision@0.10.14`), the `hand_landmarker.task` model, and the `selfie_segmenter.tflite` model (person cut-out look) from Google storage. To make the site fully self-contained:

1. Download `vision_bundle.mjs`, the `wasm/` folder, `hand_landmarker.task` and `selfie_segmenter.tflite` into `vendor/mediapipe/`.
2. Change the URLs in `src/parts/09-ui-viz.js` and `src/parts/09d-camfx.js` to relative paths, copy `vendor/` in `scripts/assemble.mjs`, and remove the two hosts from the CSP.
3. Change `mpConsent()` in `src/parts/09d-camfx.js` and the wording in `PRIVACY.md`, About and the notices: once the files come from your own site, nothing leaves it and the one-time question is no longer true. Update the host lists in `scripts/audit.mjs` and `scripts/verify-site.mjs`.
4. `npm run build`, `npm run build:site`, `npm run verify:site`, `npm run audit`, commit, push. MediaPipe's code is Apache-2.0: keep its licence and notices with the files.
5. **Serving the models makes you their distributor.** Google publishes the hand model with a model card (reported as Apache-2.0) and the selfie segmenter with none that states a licence. Confirm their current terms first, and add each file to `docs/LICENSING.md`. Until then the project fetches them from Google instead, which needs no licence from you.

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| **No microphone prompt / "permission denied" / interface missing** | You are on `http://` (not HTTPS), or inside an iframe without permission. Use the HTTPS URL or `localhost`. Check the padlock → Site settings → Microphone = Allow. |
| **Old version after a deploy** | Hard-reload. If you use a CDN in front, purge it. The installed app updates on the second launch after a deploy. |
| **Phone shows the desktop layout (or the reverse)** | **⋯ More ▸ Device layout** (or Settings) overrides the automatic choice. |
| **No microphone prompt on the phone** | You are on `http://`. Use the HTTPS URL. On iPhone allow the mic under Settings ▸ Safari ▸ Microphone if you denied it. |
| **Sound is doubled or feeds back** | Mute the in-app monitor when using your interface's Direct Monitor, or wear headphones. |
| **High latency** | Run the Loopback test. Lower your interface buffer size, use wired headphones, close other audio apps. |
| **Camera backdrop or hand tracking will not start** | Allow camera access. Hand tracking needs internet unless you self-host the model; choose "motion energy only" for fully offline use. |
| **`npm run build:check` fails in CI** | You changed `src/` but did not commit the rebuilt `index.html` / `codepen/`. Run `npm run build` and commit. |

| **The microphone light stays red / "Audio killed"** | You pressed Ctrl + . (or the red button). Open the header **Audio** button ▸ **Resume**. |
| **Deploy failed at `verify:site`** | Read the FAIL line: usually a CSP hash mismatch (run `npm run build` and commit the rebuilt `index.html`) or a missing file. |
| **`/journal/` shows the studio** | `dist/journal/index.html` is missing; run `npm run build:site` and check `journal/index.html` is committed. |
