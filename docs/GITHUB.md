# Your studio on GitHub

From 2.21 a person can keep their studio in a repository in **their own** GitHub account and have it in step on every device. Nothing about this runs until they connect. This page is for the site owner (setting up Sign in with GitHub) and for anyone curious how it works. The code is `src/parts/74-github.js` (the page) and `worker/index.mjs` (the site's Worker).

## What a person gets

- **Settings ▸ GitHub ▸ Connect with a token**: paste a fine-grained token for one repository (Contents: Read and write). No server is involved. The app makes the repository (private, `my-daily-studio`) if the token may, otherwise it says how.
- **Sign in with GitHub** (once you set it up, below): one click, then the person gives the app access to that one repository.
- What is kept in step, and what is not:

| In the repository | Stays on the device |
| --- | --- |
| `settings.json`: settings (sorted keys) | this device's audio devices, input levels, layout, measured latency, monitoring, download consent |
| `rig/presets.json`, `stage/looks.json`, `stage/scenes.json` | stage pictures and Your video files |
| `notes.json`: lesson notes and the notebook | recordings, backing tracks, stems |
| `songs/<id>.json`: each song as text (chords, words, tab, arrangement) | the token (`fw.ghtok` in the browser) |
| `README.md` (the list of songs), `studio.json` | |

- **Merging.** Each sync reads the repository's head, compares every file by its Git blob id (computed in the page), takes in what changed there, and sends what changed here as **one commit** (a tree with the changed files inline, a commit, the branch moved forward). Settings merge key by key (where both changed, this device wins). A song changed in both places keeps both versions ("… (from another device)"). A song deleted here is removed there; a song deleted elsewhere is kept here and not sent back until it is changed. Every change has a history in Git.
- **Automatic sync**: a little after each change, when the page opens, and when it comes back to the front after two minutes. A change that leaves every file as it was does not ask GitHub anything.

## GitHub's limits, and how this stays inside them

| Limit | How |
| --- | --- |
| Files over 100 MB are refused (50 MB warns) | Only text is sent; songs are a few kilobytes, and any file over 5 MB is skipped |
| Repositories should stay under about 1 GB | Text only: years of songs stay in the megabytes |
| 5,000 API requests an hour per person | A sync is about five requests, plus one per file that changed on GitHub; automatic syncs that changed nothing make none |
| About 80 content-creating requests a minute | One commit per sync, however many files changed |

## Setting up Sign in with GitHub (site owner)

1. On GitHub: **Settings ▸ Developer settings ▸ GitHub Apps ▸ New GitHub App**.
   - **Homepage URL**: `https://the-daily.studio/`
   - **Callback URL**: `https://the-daily.studio/auth/github/callback`
   - **Expire user authorization tokens**: on (the Worker renews them).
   - **Webhook**: off (untick Active).
   - **Repository permissions**: **Contents: Read and write**; Metadata: Read-only (always on). Add **Administration: Read and write** only if you want the app to be able to create the private repository itself; otherwise people create it and the app explains how.
   - **Where can this GitHub App be installed?** Any account.
2. Create a **client secret**. Note the **Client ID** and the app's **slug** (the last part of its public page address).
3. Put the public parts in `src/parts/01-core.js`, then `npm run build`:
   ```js
   ghApp: { clientId: 'Iv23li…', slug: 'your-app-slug' },
   ```
4. Give the Worker the secrets, then deploy:
   ```bash
   npx wrangler secret put GITHUB_CLIENT_ID
   ```
   ```bash
   npx wrangler secret put GITHUB_CLIENT_SECRET
   ```
5. Try it: Settings ▸ GitHub ▸ Sign in with GitHub. After signing in, the person gives the app access to their studio repository (the link is in the same place).

Without steps 3 and 4 the site works as before and people use a token. `test/worker.test.mjs` checks the Worker's two routes; `test/e2e-github.cjs` checks the page against a stand-in for GitHub's API (two devices, conflicts, deletions, sign-in, sharing, the gallery).

## How many people use it

The app has no analytics, and this does not add any. Two honest counts come with it:

- **Connected studios**: every account that installs your GitHub App is one installation. GitHub lists them for the app's owner (the app's settings, or `GET /app/installations` signed as the app).
- **Sharing studios**: public repositories tagged `the-daily-studio`. The community gallery shows the number, and so does a GitHub search: `topic:the-daily-studio`.

For everyone who never connects, Cloudflare's own dashboard counts requests and visitors for the Worker, on its side, with nothing added to the page.

## Sharing and the community gallery

- **Share looks and rigs** puts the chosen saved looks and rig presets in a **public** repository in the person's account (`daily-studio-shared`: `looks.json`, `rigs.json`, a README), tagged `the-daily-studio`. Nothing from the private studio repository is shared.
- **Community looks and rigs** lists public repositories with that topic (GitHub's repository search; it works without signing in, a few times a minute), and opens one's `looks.json` and `rigs.json`. Everything is cleaned before it is shown or kept: only known designs, fields and value ranges survive, names are text, and pictures are never taken from anyone. A kept look or rig carries `@who` in its name.
