# Hosting the-daily.studio on your own GitHub

the-daily.studio is a **static site**: one `index.html` with everything inside. There is no backend, database or build step at runtime, which makes GitHub Pages a perfect home. This guide takes you from an empty folder to a public HTTPS URL, then covers custom domains, other hosts, hardening and releases.

> **Why HTTPS matters.** Browsers only allow the **microphone, camera and MIDI** on *secure contexts*: `https://…` pages and `http://localhost`. GitHub Pages serves HTTPS automatically, so audio input works for everyone who opens your link. A plain `http://` site, or an `http://192.168.x.x` address on your LAN, will *not* get microphone access.

Contents: [1. Publish on GitHub Pages](#1-publish-on-github-pages) · [2. Check it works](#2-check-it-works) · [3. Custom domain](#3-custom-domain) · [4. Updating](#4-updating-the-site) · [5. Releases](#5-cut-a-release) · [6. Repository polish](#6-repository-polish-checklist) · [7. Other hosts](#7-other-ways-to-run-it) · [8. Hardening](#8-optional-hardening-headers-and-csp) · [9. Self-hosting hand tracking](#9-self-hosting-the-hand-tracking-files) · [10. Troubleshooting](#10-troubleshooting)

---

## 1. Publish on GitHub Pages

You need a free GitHub account and `git`. The `gh` CLI is optional but makes step 1b a single command.

### 1a. Create the repository

**With the website:** go to <https://github.com/new>, name it `the-daily.studio` (any name works), choose **Public**, and leave "Add a README" **unticked** (this folder already has one). Then in the project folder:

```bash
git init -b main
git add .
git commit -m "the-daily.studio 1.4.0"
git remote add origin https://github.com/TehauD/the-daily.studio.git
git push -u origin main
```

### 1b. …or with the GitHub CLI

```bash
gh auth login                      # once
git init -b main && git add . && git commit -m "the-daily.studio 1.4.0"
gh repo create TehauD/the-daily.studio --public --source=. --remote=origin --push \
  --description "A local-first guitar workstation in one web page: rig, band, tab, transcription, stems, visuals."
```

> Replace `TehauD` with your GitHub username everywhere it appears (`README.md`, `package.json`, `docs/`). A quick way:
> `grep -rl TehauD . --exclude-dir=node_modules --exclude-dir=.git | xargs sed -i 's/TehauD/YOUR-USER/g'`

### 1c. Turn on Pages

1. Open the repository on GitHub → **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Go to the **Actions** tab. The **Deploy to GitHub Pages** workflow (`.github/workflows/pages.yml`) runs on every push to `main`. The first run takes about a minute.
4. When it is green, your site is live at:

   ```
   https://<your-user>.github.io/<repo-name>/        e.g. https://the-daily.studio/
   ```

The workflow publishes `index.html`, the web-app manifest, the service worker, the icons and the `samples/` folder (the README, docs and screenshots stay on the repository page). It does not need any secrets.

> **Prefer no workflow?** Because `index.html` is committed, you can instead choose **Source: Deploy from a branch → `main` → `/ (root)`**. Delete `.github/workflows/pages.yml` so the two do not compete. The repository's `.nojekyll` file stops GitHub from processing the files with Jekyll.

> **Private repository?** GitHub Pages for *private* repositories requires a paid GitHub plan. Public repositories are free. Remember that "public" exposes the source code, which is the point of sharing it.

## 2. Check it works

Open your Pages URL in Chrome or Edge and check:

1. The welcome card appears and **Start** asks for microphone access (the padlock shows HTTPS).
2. **I/O** lists your audio interface and the level meters move when you play.
3. **?** → **Take the guided tour** runs through all steps.
4. The browser console shows no red errors.

If microphone access is blocked, see [Troubleshooting](#10-troubleshooting).

### Sample tracks

Anything in `samples/` is served beside the page and listed in the app (see the user guide). Keep each file to a few MB; GitHub rejects single files over 100 MB and the Pages site is limited to about 1 GB. If you deploy by copying files to another host, copy `samples/` too, including `manifest.json`.

### Phones and installing as an app

The hosted HTTPS page is also the mobile app: open the URL on a phone and the layout adapts. Chrome and Edge offer **⋯ More ▸ Install app**; on iPhone use **Share ▸ Add to Home Screen**. The service worker (`sw.js`) is only registered on HTTPS or `localhost`, caches the page for offline use and refreshes it on the next visit; after a deploy, close and reopen the app (or reload twice) to pick up the new version. Quick way to share: send the link, or use **⋯ More ▸ Share link**. If you host elsewhere, deploy `index.html`, `manifest.webmanifest`, `sw.js` and the `icons/` folder together at the same path.

## 3. Custom domain

**the-daily.studio (this project's domain).** The repository already contains a `CNAME` file with `the-daily.studio`, so GitHub Pages serves the site there once DNS points at it:

1. At your registrar add four **A** records for the apex (`@`): `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (optionally the matching four `AAAA` records), and a **CNAME** for `www` → `tehaud.github.io`.
2. Repository **Settings → Pages → Custom domain** → `the-daily.studio` → **Save**, wait for the DNS check, then tick **Enforce HTTPS**.
3. Songs are stored per origin: people who used the old `github.io` address will not see their songs on the new domain. Back up first (☰ Songs ▸ Back up all songs) and import the bundle on the new address.

## Any other domain

Using something like `studio.example.com`:

1. In your DNS provider add a **CNAME** record: name `the-daily.studio` → value `<your-user>.github.io` (no repository name). For an apex domain (`example.com`) use GitHub's four `A` records instead; they are listed in [GitHub's custom-domain docs](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site).
2. Repository **Settings → Pages → Custom domain** → enter `studio.example.com` → **Save**. GitHub adds a `CNAME` file and checks DNS.
3. When the check passes, tick **Enforce HTTPS**. The certificate is issued automatically and can take up to an hour.

The GitHub Actions workflow publishes `CNAME`, `robots.txt`, `sitemap.xml` and `404.html` along with the app, so the custom domain survives each deploy. If you fork this for another domain, change those files (`CNAME`, `robots.txt`, `sitemap.xml`, and `BRAND.domain` / `BRAND.url` in `src/parts/01-core.js`).

## 4. Updating the site

All source lives in `src/`. `index.html` and `codepen/` are **generated** from it.

```bash
# edit src/parts/*.js, src/styles.css or src/body.html
npm run build            # regenerate index.html and codepen/
npm test                 # optional: smoke test (needs `npm install` once)
git add -A && git commit -m "Describe your change"
git push                 # the Pages workflow redeploys automatically
```

Continuous integration (`.github/workflows/ci.yml`) runs `npm run build:check` so a pull request that edits `src/` without rebuilding is flagged, then runs the smoke test.

Browsers cache aggressively. After a deploy, hard-reload (<kbd>Ctrl/⌘</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>) to see the new version; your saved song and settings are kept.

## 5. Cut a release

Releases give people a stable download (a zip of the repository) and a changelog.

1. Bump the version in `package.json` and in `src/parts/01-core.js` (`const VERSION = '…'`), and add notes to `CHANGELOG.md`.
2. `npm run build && git add -A && git commit -m "Release v1.4.0" && git push`
3. Tag and publish:

```bash
git tag -a v1.4.0 -m "the-daily.studio 1.4.0"
git push origin v1.4.0
gh release create v1.4.0 --title "the-daily.studio 1.4.0" --notes-file CHANGELOG.md
# optional: attach the standalone page for people who just want the file
gh release upload v1.4.0 index.html#the-daily.studio-standalone.html
```

## 6. Repository polish checklist

* **About** (right side of the repo page): add the description, your Pages URL as the website, and topics such as `guitar`, `web-audio`, `audioworklet`, `music-transcription`, `tablature`, `guitar-effects`, `javascript`, `pwa-ready`.
* **Social preview**: *Settings → General → Social preview* → upload `icons/social-card.png` (1200×630).
* **Issues and Discussions**: the issue templates in `.github/ISSUE_TEMPLATE/` are ready. Enable *Discussions* for questions and tone sharing.
* **Branch protection** (optional): require the **CI** check on `main` once you accept outside pull requests.
* **Security**: *Settings → Code security* → enable *Private vulnerability reporting* (see `SECURITY.md`) and Dependabot alerts (only the dev dependencies are affected; nothing ships to users).
* **License**: `LICENSE` is MIT with your name; edit the copyright line if you want a different holder or licence.

## 7. Other ways to run it

| Option | How |
|---|---|
| **Locally** | `npm start` (zero-dependency server on `http://localhost:8080`) or `python3 -m http.server 8080`. Opening `index.html` directly also works in most browsers. |
| **CodePen** | Create a pen, paste `codepen/pen.html`, `codepen/pen.css`, `codepen/pen.js` into the HTML / CSS / JS panels, then **Change View → Full Page** (or Debug). |
| **Netlify / Cloudflare Pages / Vercel** | Import the repository; build command *none* (or `npm run build`), publish directory `/` (the repo root). HTTPS is automatic. These hosts can also set the headers in section 8. |
| **Your own server** | Copy `index.html` to any web root served over HTTPS. A minimal nginx site is below. |
| **Zip to a friend** | Send `index.html`. It is fully self-contained; they can open it from disk or run it on `localhost`. (Install-as-app and offline caching need the HTTPS site.) |
| **Try it on your phone from your computer** | Easiest is the Pages URL. For a local test use a tunnel that gives you HTTPS (for example `npx localtunnel --port 8080` or a Cloudflare Tunnel), because microphone access needs HTTPS and a plain `http://192.168.x.x` address will not get it. |

Minimal nginx server block:

```nginx
server {
  listen 443 ssl http2;
  server_name studio.example.com;
  # ssl_certificate / ssl_certificate_key via certbot …
  root /var/www/the-daily.studio;
  index index.html;
  add_header Permissions-Policy "microphone=(self), camera=(self), midi=(self)" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "no-referrer" always;
}
```

## 8. Optional hardening: headers and CSP

GitHub Pages cannot set custom response headers, and the app works fine without them. If you host elsewhere (nginx, Netlify `_headers`, Cloudflare), these are sensible:

```
Permissions-Policy: microphone=(self), camera=(self), midi=(self), geolocation=(), payment=()
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

A **Content-Security-Policy is already built into `index.html`** (a `<meta>` tag, generated by `scripts/build.mjs`). The inline script is allowed by its SHA-256 hash rather than `unsafe-inline`, so injected scripts cannot run. It permits only what the app genuinely uses: `blob:` workers and worklets (the audio worklet and the stem-separation worker are created from Blob URLs), `data:` images, and, only for optional hand tracking, jsDelivr and Google storage. The worklet's `data:` fallback is intentionally blocked; the Blob path is the one that runs.

Because the hash changes whenever the script changes, **always deploy the built `index.html`** (`node scripts/build.mjs`) and never hand-edit the script inside it; `node scripts/build.mjs --check` and the CI job verify it. If you edit the page by hand the browser console will show a CSP violation and the app will not start.

If you remove hand tracking entirely, drop the two external hosts and `wasm-unsafe-eval` from the `csp` string in `scripts/build.mjs`, and the page makes **no** third-party requests at all.

## 9. Self-hosting the hand-tracking files

Hand tracking (optional) loads three things at runtime: the MediaPipe Tasks Vision script and WASM from jsDelivr (`@mediapipe/tasks-vision@0.10.14`) and the `hand_landmarker.task` model from Google storage. To make the site fully self-contained:

1. Download the `@mediapipe/tasks-vision` package files (`vision_bundle.mjs` and the `wasm/` folder) and `hand_landmarker.task` into a `vendor/mediapipe/` folder in the repository.
2. In `src/parts/09-ui-viz.js`, change the three URLs (search for `mediapipe`) to relative paths such as `./vendor/mediapipe/vision_bundle.mjs`, `./vendor/mediapipe/wasm`, and `./vendor/mediapipe/hand_landmarker.task`.
3. `npm run build`, commit, push. Mind the MediaPipe licence (Apache-2.0): keep its notices with the files.

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| **No microphone prompt / "permission denied" / interface missing** | You are on `http://` (not HTTPS), or inside an iframe without permission. Use the HTTPS Pages URL or `localhost`. Check the padlock → Site settings → Microphone = Allow. |
| **Pages shows 404** | Settings → Pages must show a published URL. Confirm the workflow succeeded (Actions tab) and that **Source** is *GitHub Actions* (or *main / root* if you removed the workflow). The URL includes the repository name unless you use a custom domain. |
| **Workflow fails at "Setup Pages"** | Pages is not enabled yet: do step 1c first, then re-run the failed workflow. |
| **Old version after a deploy** | Hard-reload. If you use a CDN in front, purge it. The installed app updates on the second launch after a deploy. |
| **Phone shows the desktop layout (or the reverse)** | **⋯ More ▸ Device layout** (or Settings) overrides the automatic choice. |
| **No microphone prompt on the phone** | You are on `http://`. Use the HTTPS URL. On iPhone allow the mic under Settings ▸ Safari ▸ Microphone if you denied it. |
| **Sound is doubled or feeds back** | Mute the in-app monitor when using your interface's Direct Monitor, or wear headphones. |
| **High latency** | Run the Loopback test. Lower your interface buffer size, use wired headphones, close other audio apps. |
| **Camera backdrop or hand tracking will not start** | Allow camera access. Hand tracking needs internet unless you self-host the model; choose "motion energy only" for fully offline use. |
| **`npm run build:check` fails in CI** | You changed `src/` but did not commit the rebuilt `index.html` / `codepen/`. Run `npm run build` and commit. |
