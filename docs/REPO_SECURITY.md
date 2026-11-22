# Securing the public repository

The code is public, so anyone can read it and anyone can propose a change. Nothing here relies on the code being secret: the keys live in Cloudflare (`wrangler secret`) and in your shell, never in the repository. What matters is who can **change** `main` (a push to `main` is what Cloudflare builds and serves), who can run code in **CI**, and what a stranger can learn from the **history**.

What is already in the repository (2.87.2, held by `npm run audit`):

- every action in `.github/workflows` is pinned to a full commit hash, and Dependabot proposes new ones;
- every workflow sets read-only token permissions at the top; none runs fork code with secrets (`pull_request_target`, `workflow_run` and `secrets.` are not used);
- `.github/CODEOWNERS` names who reviews workflow, Worker, build and security-file changes;
- a CodeQL workflow (`.github/workflows/codeql.yml`) scans the code for security mistakes every push, pull request and Monday.

The rest is in GitHub's and Cloudflare's settings, which a commit cannot change. Do these once. The labels move around a little between GitHub releases; the words in **bold** are what to look for. Each step ends with how to check it.

## 1. Protect `main`

A rule on the branch, so nothing reaches `main` without passing CI, and it cannot be deleted or rewritten.

1. GitHub ▸ the repository ▸ **Settings** ▸ **Rules** ▸ **Rulesets** ▸ **New ruleset** ▸ **New branch ruleset**.
2. **Ruleset name:** `protect main`. **Enforcement status:** **Active**.
3. **Bypass list** ▸ **Add bypass** ▸ choose yourself (or the **Repository admin** role) and set the mode to **For pull requests only**. That lets you merge your own pull request without a second reviewer, but not push straight to `main`.
4. **Target branches** ▸ **Add target** ▸ **Include default branch**.
5. Under **Branch rules**, tick:
   - **Restrict deletions**
   - **Block force pushes**
   - **Require a pull request before merging**. Set **Required approvals** to **0**: you cannot approve your own pull request, and the CI check below is the gate. (Setting 1 or more, or ticking **Require review from Code Owners**, would make every change wait for a second person, which with one maintainer means only the bypass can merge.)
   - **Require status checks to pass**. Click **Add checks** and search for `verify` and `e2e`; tick both. They appear only after the CI workflow has run once on a pull request or push, so open any pull request first if they are not offered. **Do not add `browsers`**: it is allowed to fail on purpose (see `ci.yml`). Add `analyze` too once the CodeQL workflow has run once.
   - Leave **Require branches to be up to date before merging** off unless you want every merge to wait for a fresh CI run on the newest `main` (safer, slower).
6. **Create**.

**Check:** on your computer, `git push origin HEAD:main` from a checkout should be refused ("Changes must be made through a pull request" or "protected branch"). On a pull request, the merge button says it is waiting for `verify` and `e2e`.

Why this matters here: the site is built from `main` (Cloudflare Workers Builds), so write access to `main` is the same as the ability to deploy. Collaborators and any tool or token you give write access to are inside that boundary; keep the list short.

## 2. Secret scanning and push protection

Secret scanning looks through the code and history for keys; push protection stops a push that contains one before it lands in public history. Both are free on a public repository.

1. **Settings** ▸ **Advanced Security** (older name: **Code security and analysis**).
2. **Secret Protection** (older: **Secret scanning**) ▸ **Enable**.
3. **Push protection** ▸ **Enable**.
4. Optional, if offered: **Scan for generic secrets** / **Non-provider patterns**, and **Automatically verify if a secret is valid**.
5. Do not enable **CodeQL default setup** (below); the repository has its own workflow.

**Check:** **Security** tab ▸ **Secret scanning** shows the feature on and, as the repository was checked clean on 2026-11-22 (tracked files and all history, by pattern), no alerts. If an alert ever appears: treat the key as leaked, **revoke it at the provider first**, then deal with the commit.

## 3. Private vulnerability reporting

`/.well-known/security.txt` and `SECURITY.md` send reporters to GitHub's private advisory form. If this setting is off, that link goes nowhere.

1. **Settings** ▸ **Advanced Security** (or **Code security and analysis**).
2. **Private vulnerability reporting** ▸ **Enable**.

**Check:** open the repository in a private window while signed out, go to the **Security** tab. A **Report a vulnerability** button should be there. Reports arrive as an email and under **Security** ▸ **Advisories**.

## 4. GitHub Actions settings

1. **Settings** ▸ **Actions** ▸ **General**.
2. **Actions permissions:** choose **Allow *owner*, and select non-*owner*, actions and reusable workflows**, tick **Allow actions created by GitHub** and nothing else (the workflows use only `actions/*` and `github/*`). Tick **Require actions to be pinned to a full-length commit SHA** if it is shown; the workflows already comply.
3. **Fork pull request workflows from outside collaborators:** choose **Require approval for all external contributors**. A stranger's pull request then runs nothing until you press **Approve and run**. (Read what it changes in **Files changed** first, above all anything under `.github/`, `scripts/` or `package.json`, which is code CI would execute.)
4. **Workflow permissions:** choose **Read repository contents and packages permissions**. **Untick** **Allow GitHub Actions to create and approve pull requests**.
5. Leave **Send write tokens to workflows from fork pull requests** and **Send secrets and variables to workflows from fork pull requests** **off** (they are off by default; the options are under **Fork pull request workflows**).
6. **Save**.

**Check:** a pull request from a fork (or from another account) shows **Workflows awaiting approval**.

## 5. Cloudflare Workers Builds

The build runs `npm run build:site && npm run verify:site` and needs no secrets. Keep it that way: a build has a token and variables, and a branch you do not control should never reach them.

1. Cloudflare dashboard ▸ **Workers & Pages** ▸ `the-daily-studio` ▸ **Settings** ▸ **Builds**.
2. **Git repository:** confirm it is `TehauD/the-daily.studio` and the **Production branch** is `main`.
3. **Branch control** ▸ **Builds for non-production branches:** turn **off** (it is not needed; `wrangler.jsonc` already has no preview addresses). If you want it on, turn it on only after step 4 shows there is nothing secret in the build.
4. **Build variables and secrets:** there should be nothing here that is a key. The Worker's real secrets (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `CF_API_TOKEN` / `CF_ZONE_ID` if Part I is on) belong under **Settings** ▸ **Variables and Secrets** as type **Secret**, which the build cannot read. Delete any key you find under Build variables, then rotate it.
5. **API token** (also on the Builds page): open it and check it is only the build token Cloudflare made, scoped to this Worker. If it is broader (all of the account, or DNS), replace it with a scoped token.
6. On GitHub: your profile picture ▸ **Settings** ▸ **Applications** ▸ **Installed GitHub Apps** ▸ **Cloudflare Workers and Pages** ▸ **Configure**. Under **Repository access** choose **Only select repositories** and pick `the-daily.studio` alone.

**Check:** a push to a branch other than `main` produces no new build in the Cloudflare **Builds** list.

## 6. Email privacy (new commits)

The author address on a commit is public, permanently, in a public repository. 53 commits already carry a personal address; those stay (rewriting history would break every link and every clone, and the address is not a secret an attacker needs). Stop it from adding to that:

1. GitHub ▸ your profile picture ▸ **Settings** ▸ **Emails**.
2. Tick **Keep my email addresses private**. GitHub then shows you an address like `12345678+TehauD@users.noreply.github.com` and uses it for commits you make in the browser, **including the merge commit when you merge a pull request**. (That merge commit is the one that carried the personal address, e.g. `64312d9` at the head of `main`.)
3. Tick **Block command line pushes that expose my email**.
4. On each computer you commit from, use the noreply address:
   ```bash
   git config --global user.email "12345678+TehauD@users.noreply.github.com"
   ```
   (use the exact address GitHub shows on the **Emails** page).

Commits from Claude Code sessions are already authored `noreply@anthropic.com`.

**Check:** merge a pull request, then `git log -1 --format=%ae origin/main` shows the noreply address.

## Also worth doing

- **Dependabot:** `.github/dependabot.yml` is on. Open the pull requests it makes (new action commits, jsdom, Playwright) one at a time and merge when CI is green; do not let them pile up.
- **Stale branches:** delete the `claude/*` branches once their pull request is merged (the pull request page has a **Delete branch** button).
- **Two-factor sign-in** on your GitHub and Cloudflare accounts, with a passkey or an authenticator app, not only SMS. An account takeover beats every setting above.
- **Tokens you made:** GitHub ▸ **Settings** ▸ **Developer settings** ▸ **Personal access tokens**: delete the ones you no longer use, and set an expiry on the rest.
- **Code scanning:** CodeQL results appear under **Security** ▸ **Code scanning** after the first run. Findings in generated files (`index.html`) are excluded on purpose (`.github/codeql/codeql-config.yml`): fix them in `src/`.

## What a public repository does and does not give an attacker

- **They can read:** the Worker's code, the honeypot list, the rate limits, the WAF-slot logic and every check. Those do not weaken anything: the protection is that they are enforced, not that they are hidden. (A scanner that reads `scan-guard` could keep its score below the threshold; it would still be slowed by the rate limit and the honeypot.)
- **They cannot read:** the Worker's secrets, your Cloudflare token, anything in your browser or on your drive.
- **The Backstage pages** are a doorway for fun, not a security boundary. They are in the repository and show only what is already in the visitor's own browser.
