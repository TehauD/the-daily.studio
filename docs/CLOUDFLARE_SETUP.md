# Cloudflare setup checklist

Everything the site owner does in Cloudflare (and GitHub) to run the-daily.studio, in order, from 2.53.1. Each step says where to click and how to check it worked. The background is in [HOSTING.md](HOSTING.md), [GITHUB.md](GITHUB.md) and [SECURITY_MODEL.md](SECURITY_MODEL.md).

**What needs the Worker, and what doesn't:**

| Feature | Needs Cloudflare setup? |
| --- | --- |
| Song links (▶ Play it, writing together by passing a song back and forth), the share page, chord sheets with a QR code | **No.** The song is inside the link; no server sees it. Works as soon as the site is live. |
| GitHub sync, **Share looks and rigs**, the community gallery, with a pasted token | **No.** The browser talks to GitHub directly. |
| **Sign in with GitHub** (one click instead of a token) | **Yes:** a GitHub App, two Worker secrets and the app's public id in the code (Part D). |
| The Daily at `journal.the-daily.studio` | The custom domain (Part B). |
| **Drops** (2.60): finished songs public for 7 days, after your review | **Yes, when you want it:** a public R2 bucket, its address, and the steps in Part H. Off until then. |
| **Send with recordings** (2.54): takes travel with a song link for 7 days | **Yes:** an R2 bucket with a 7-day rule, bound to the Worker as `SHARES` (Part G). Uses Sign in with GitHub (Part D). |

---

## Part A: Builds and deploys

**Workers & Pages ▸ the-daily-studio ▸ Settings ▸ Build**

| Setting | Value |
| --- | --- |
| Git repository | `TehauD/the-daily.studio` |
| Production branch | `main` |
| Build command | `npm run build:site && npm run verify:site` |
| Deploy command | `npx wrangler@4 deploy` |
| Non-production branch builds | off. Since 2.53.1 versions have no preview address (`preview_urls: false`), so a branch build has nothing to open; test locally with `npx wrangler dev`. |
| Build variables | none needed |

- `@4` makes sure the deploy uses Wrangler 4. `run_worker_first` as a list needs 4.20 or later; with an older Wrangler the deploy fails rather than serving a wrong site.
- `verify:site` is the gate: if it fails, the deploy stops and the previous version stays live.

**Check:** after merging to `main`, the build log ends with `site verified`, `audit passed` and a deployed version. Then `https://the-daily.studio/humans.txt` shows the new version and build.

## Part B: Domains and DNS

**Workers & Pages ▸ the-daily-studio ▸ Settings ▸ Domains & Routes**
- [ ] `the-daily.studio`: Custom domain.
- [ ] `journal.the-daily.studio`: Custom domain.
- [ ] **No `workers.dev` route.** The deploy turns it off (`workers_dev: false`). If the dashboard still lists one after the first 2.53.1 deploy, disable it there.
- [ ] **Preview URLs: off** (the deploy turns them off too).

**the-daily.studio ▸ DNS ▸ Records**
- [ ] The two custom domains show as Worker records (Cloudflare makes them; don't edit them).
- [ ] **Delete anything else that points somewhere**: old GitHub Pages `A`/`AAAA` records (`185.199.108–111.153`), a `CNAME` to `*.github.io`, a `CNAME` to `*.azurewebsites.net`, or any record you don't recognise. A leftover record pointing at a service you no longer own can be taken over by someone else.
- [ ] `www`: either leave it out (it doesn't resolve today), or add it as a custom domain and a redirect rule (*Rules ▸ Redirect Rules*: hostname equals `www.the-daily.studio` → `https://the-daily.studio${path}`, 301).
- [ ] Keep `TXT` records for email (SPF, DKIM, DMARC) if you use the domain for email. If you don't, add `v=spf1 -all` and `_dmarc` with `v=DMARC1; p=reject` so no one can send mail as the domain.

**SSL/TLS**
- [ ] *Overview*: **Full (strict)**.
- [ ] *Edge Certificates*: **Always Use HTTPS** on; **Minimum TLS Version 1.2**; **TLS 1.3** on. Leave HSTS off here: the site already sends `Strict-Transport-Security` itself.

**GitHub:** in the repository's *Settings ▸ Pages*, make sure Pages is **off** (no source). Then nothing else serves the repository's files.

## Part C: Security settings

**Security ▸ WAF**
- [ ] *Managed rules*: turn on the **Cloudflare Free Managed Ruleset** (or the full managed ruleset on a paid plan).
- [ ] *Rate limiting rules* ▸ Create rule (the free plan includes one):
  - Name: `auth`
  - If: URI Path starts with `/auth/`
  - Same characteristics: IP
  - When rate exceeds: **20 requests per 10 seconds**
  - Then: **Block** for 10 seconds
  
  A person signing in makes two or three requests, so only scripts hit this.
- [ ] *Custom rules* (optional, 2.69): block requests whose URI path matches `/.env`, `/.git`, `/wp-`, `/.wrangler`, `/xmlrpc.php`, `/phpmyadmin`, `/.aws`, `/.docker`, `/.vscode`, `/config.php`, `/admin.php`, `/.htaccess`, `/.htpasswd` or `/id_rsa`. None of them, or anything behind them, exists on this site; they're only ever a scanner or bot. The Worker already answers that same short list itself, deliberately (`worker/honeypot.mjs`, SECURITY_MODEL.md "Scanner and bot traffic"), holding the connection a few seconds before the usual empty 404. A Custom Rule here blocks them a step earlier still, at Cloudflare's edge, before the Worker runs at all — turn it on if you'd rather these never reach the Worker's request count, at the cost of the Worker's own tarpit never getting the chance to run for them (whichever answers first wins; they are alternatives, not both-at-once).

**Security ▸ Bots**
- [ ] **Bot Fight Mode: off**, and **JavaScript detections: off**. They inject a script and set a `cf_clearance` cookie, which the privacy policy says the site doesn't do. The WAF and rate limit above cover abuse.

**Analytics & Logs ▸ Web Analytics**
- [ ] Turn off the **automatic setup** for the-daily.studio. It injects a beacon script, which the site's policy blocks with console errors. Cloudflare's own request counts stay available without it.

**Network Error Logging:** if your plan shows it (*Speed* or *Network*), turn it off. The privacy policy doesn't mention it.

**Check:**
```bash
curl -sI https://the-daily.studio/ | grep -iE "set-cookie|content-security|strict-transport"
```
This should show the policy and HSTS, and no `set-cookie`.

## Part D: Sign in with GitHub (the Worker's sharing route)

1. **Create the GitHub App:** github.com ▸ *Settings ▸ Developer settings ▸ GitHub Apps ▸ New GitHub App*.
   - GitHub App name: e.g. `the-daily.studio`. The slug is the last part of its page address.
   - Homepage URL: `https://the-daily.studio/`
   - Callback URL: `https://the-daily.studio/auth/github/callback`
   - **Expire user authorization tokens:** on.
   - Request user authorization during installation: off.
   - **Webhook:** untick *Active*.
   - Repository permissions: **Contents: Read and write**. Metadata: Read-only is added automatically. Add *Administration: Read and write* only if you want the app to create people's private repository for them.
   - Account permissions: none.
   - Where can this GitHub App be installed: **Any account**.
2. **Make a client secret** on the app's page (*Client secrets ▸ Generate*). Copy it once; GitHub won't show it again. Also note the **Client ID** (starts `Iv23`).
3. **Give the Worker its secrets.** Use either way; both store them encrypted in Cloudflare and never in the repository.
   - Dashboard: *Workers & Pages ▸ the-daily-studio ▸ Settings ▸ Variables and Secrets ▸ Add*. Type **Secret** (not Text), name `GITHUB_CLIENT_ID`, then again for `GITHUB_CLIENT_SECRET`. Deploy when asked.
   - Or from a terminal signed in to Cloudflare:
     ```bash
     npx wrangler@4 secret put GITHUB_CLIENT_ID
     ```
     ```bash
     npx wrangler@4 secret put GITHUB_CLIENT_SECRET
     ```
   Secrets survive later deploys. Never paste them into chat, a commit, `wrangler.jsonc` or a build variable.
4. **Put the public parts in the page** (done in 2.53.1: `Iv23liTjqEBQsgmGaE1Q`, `tehaud-the-daily-studio`): `src/parts/01-core.js` → `ghApp: { clientId: 'Iv23…', slug: 'your-app-slug' }`. Then `npm run build`, commit and merge. These two values are public (they appear in the sign-in address); the secret is the only private part.
5. **Check:**
   ```bash
   curl -sI "https://the-daily.studio/auth/github/callback" | grep -i location
   ```
   - Before the secrets are set, this shows `/#gh-error=not-set-up`.
   - Afterwards it shows `/#gh-error=no-code`, which means the Worker is ready.

   Then in the studio: *Settings ▸ GitHub ▸ Sign in with GitHub*, approve, follow *give it access on GitHub* and choose only the studio repository. *Share looks and rigs* and *Community looks and rigs* then work without a token.

**If you think the secret has leaked:** generate a new client secret on GitHub, put it in Cloudflare (step 3), then delete the old one on GitHub. People stay signed in; their tokens renew with the new secret.

## Part E: Account safety

- [ ] **Two-factor authentication** with an authenticator app or security key on Cloudflare, GitHub and the email account behind both.
- [ ] Cloudflare *Manage Account ▸ Audit Log*: no changes you didn't make.
- [ ] Cloudflare *My Profile ▸ API Tokens*: delete tokens you don't use. Workers Builds makes its own; keep that one.
- [ ] *Manage Account ▸ Members*: only you.
- [ ] GitHub *Settings ▸ Security log*, *Applications* and *Developer settings ▸ Personal access tokens*: nothing unexpected.
- [ ] Repository *Settings ▸ Code security*: **private vulnerability reporting** on (`security.txt` points to it), **secret scanning** and **push protection** on.
- [ ] Look at *Security ▸ Events* now and then. 404s for `/.env` and `/wp-login.php` are routine internet background noise, not a targeted attack.

## Part F: After each deploy

```bash
for p in /.env /.git/config /.dev.vars /wrangler.jsonc /package.json /.wrangler/; do printf '%s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "https://the-daily.studio$p"; done
```
Each should print `404`. The release check (`verify:site`) already refuses to deploy any of these; this is the outside view.

## Part G: Send with recordings (R2)

The Worker keeps the sealed recordings people send with song links. You can't open them; the key is only in the links.

1. **R2 ▸ Create bucket.** Any name, for example `the-daily-shares`. Location: automatic.
2. **The bucket ▸ Settings ▸ Object lifecycle rules ▸ Add rule:** delete objects **7 days** after upload, for the whole bucket (no prefix). The Worker also refuses anything older, so a day's delay in the rule doesn't matter.
3. **Bind it to the Worker.** `wrangler.jsonc` lists it under `r2_buckets` with the binding name `SHARES` and your bucket's name (`thedaily`, since 2.54.0), so every deploy keeps it. Adding it in the dashboard only would be undone by the next deploy.
   **Keep the bucket private.** Under *Settings*: **Public access** off, no **r2.dev** address, and no **Custom Domain**. Only the Worker should read and write it; it applies the 7 days, the limits and the checks.
4. **Check, after the deploy:**
   ```bash
   curl -s -X POST -H "Origin: https://the-daily.studio" https://the-daily.studio/share/put -w " %{http_code}\n"
   ```
   It should print `{"error":"sign-in"} 401`. If it says `not-set-up` (503), the binding is missing.

**What it costs:** R2's free allowance is 10 GB stored, 1 million uploads and 10 million downloads a month, and downloads are free. The Worker refuses anything past 200 sends and 3 GB a day, and the 7-day rule deletes old ones, so at most about 21 GB is ever stored: roughly $0.20 a month above the free allowance in the worst case.
- Set a **billing notification** (*Manage Account ▸ Billing ▸ Notifications*) at, say, $1, so you hear about anything unusual.
- The Worker stays on the free plan.

**Reports:** a **⚑ Report** lands in the bucket under `reports/<day>/` as a small JSON file. It holds:
- the share's name;
- the reason;
- the GitHub account number it came from;
- the link's key, if the reporter allowed it.

Check that folder now and then (*R2 ▸ the bucket ▸ Objects*). Reports are deleted after 7 days like everything else.
- **To remove a share:** delete its object (`<day>/<hash>/<id>`; the share's name in the report is the same with dots for slashes).
- **To listen first** (only if the report includes the key): in the studio, 🔗 Send any song and copy its link. Add `&r=<share name>.<key>` to the end and open it. The recordings come in with that song.
- **To stop an account:** the account number is GitHub's (`https://api.github.com/user/<number>` shows who). There's no block list yet; ask me to add one if it's ever needed.

## Part H: Drops (switch on when you're ready)

Drops makes music public, so do the first two steps before switching it on.

1. **Before launch (not Cloudflare):**
   - **Register a copyright (DMCA) agent** at copyright.gov ("DMCA designated agent"; $6, renew every 3 years). Use a P.O. box or mail-forwarding address, not your home: the directory is public.
   - **Set up a takedown email**, for example `abuse@the-daily.studio` with Cloudflare Email Routing (*Email ▸ Email Routing*, free, forwarding to your inbox). Tell me the address and I'll add it to `security.txt`, the terms and the Drops page.
2. **R2 ▸ Create bucket:** `thedaily-drops` (any name; tell me if it's different).
   - *Settings ▸ Object lifecycle rules:* delete after **7 days**.
   - *Settings ▸ Custom Domains ▸ Add:* `drops.the-daily.studio`. This is the one bucket that's meant to be public. Leave the r2.dev address off.
3. **Tell me when it's done.** I'll switch it on in `wrangler.jsonc`: the `DROPS` binding, and `DROPS_URL` set to `https://drops.the-daily.studio`. Your GitHub account number (13037814) is already there as `OWNER_GITHUB_ID`, and only that account can review.
4. **Check after the deploy:**
   ```bash
   curl -s https://the-daily.studio/drops/api/list
   ```
   This should print `{"drops":[]}` (not `not-set-up`).

**Reviewing:** open **https://the-daily.studio/drops/review/** in the browser where you're signed in to the studio with GitHub. Listen to each waiting drop, then **Approve** (public for 7 days) or **Reject** (deleted). **Take it down** removes a live one.
- **Reports:** they land in the private bucket under `reports/drops/`.
- **Pace:** drops wait until you decide. Up to 100 can wait at once, and each account can send 3 a day.

**What it costs:**
- **Storage:** about 3–4 MB per drop for 7 days, so a few hundred drops a week is still inside R2's free 10 GB.
- **Plays:** served from the bucket's own address through Cloudflare's cache, so they don't count as Worker requests, and R2 doesn't charge for downloads.
- **The list:** one Worker request per page view, cached for a minute.
