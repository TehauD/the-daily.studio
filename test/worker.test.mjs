/* The site's Worker (worker/index.mjs): Sign in with GitHub's two routes, with GitHub's token endpoint stood in for. No browser, no network.
   Run: node test/worker.test.mjs */
import { handle, b64url } from '../worker/index.mjs';
let fails = 0, n = 0; const ok = (c, m) => { n++; console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const SITE = 'https://the-daily.studio', ENV = { GITHUB_CLIENT_ID: 'Iv1.abc', GITHUB_CLIENT_SECRET: 'shh', ASSETS: { fetch: r => new Response('asset ' + new URL(r.url).pathname) } };
const calls = []; const gh = answer => async (url, init) => { calls.push({ url, body: Object.fromEntries(new URLSearchParams(init.body)), headers: init.headers }); return new Response(JSON.stringify(answer), { headers: { 'Content-Type': 'application/json' } }); };
const frag = r => decodeURIComponent((r.headers.get('Location') || '').replace(/^\/#/, ''));
const decode = s => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));

/* not set up */
let r = await handle(new Request(SITE + '/auth/github/callback?code=x&state=s'), { ASSETS: ENV.ASSETS });
ok(r.status === 302 && frag(r) === 'gh-error=not-set-up', 'without the app’s secrets, the sign-in route says so and nothing else changes');
r = await handle(new Request(SITE + '/auth/github/refresh', { method: 'POST', body: '{"r":"x"}' }), { ASSETS: ENV.ASSETS });
ok(r.status === 503, 'and the renewal route answers 503');
/* the person said no on GitHub */
r = await handle(new Request(SITE + '/auth/github/callback?error=access_denied&state=s'), ENV, gh({}));
ok(r.status === 302 && frag(r) === 'gh-error=access_denied' && calls.length === 0, 'a refusal on GitHub comes back as an error, and GitHub is not asked for a token');
/* the code is exchanged */
r = await handle(new Request(SITE + '/auth/github/callback?code=CODE123&state=abc123'), ENV, gh({ access_token: 'ghu_tok', refresh_token: 'ghr_ref', expires_in: 28800, refresh_token_expires_in: 15811200, token_type: 'bearer' }), 1000);
const c0 = calls[0], f = frag(r);
ok(c0 && c0.url === 'https://github.com/login/oauth/access_token' && c0.body.client_id === 'Iv1.abc' && c0.body.client_secret === 'shh' && c0.body.code === 'CODE123' && c0.body.redirect_uri === SITE + '/auth/github/callback', 'the one-time code is exchanged at GitHub with the app’s id and secret');
ok(r.status === 302 && /^gh=[\w-]+$/.test(f), 'the answer goes back after # (never sent to a server), base64url');
const d = decode(f.slice(3));
ok(d.t === 'ghu_tok' && d.r === 'ghr_ref' && d.exp === 1000 + 28800e3 && d.rexp === 1000 + 15811200e3 && d.state === 'abc123', 'it carries the token, the renewal token, when they run out, and the check the page made (' + JSON.stringify(d) + ')');
ok(r.headers.get('Cache-Control') === 'no-store' && r.headers.get('Referrer-Policy') === 'no-referrer', 'nothing is cached and no address is passed on');
ok(!JSON.stringify(d).includes('shh'), 'the secret never leaves the Worker');
r = await handle(new Request(SITE + '/auth/github/callback?code=BAD&state=s'), ENV, gh({ error: 'bad_verification_code' }));
ok(frag(r) === 'gh-error=bad_verification_code', 'a code GitHub refuses comes back as an error');
r = await handle(new Request(SITE + '/auth/github/callback?code=X&state=<script>'), ENV, gh({ access_token: 't' }));
ok(decode(frag(r).slice(3)).state === 'script', 'the state is kept to plain characters');
/* renewal */
r = await handle(new Request(SITE + '/auth/github/refresh'), ENV, gh({}));
ok(r.status === 405, 'renewal is POST only');
r = await handle(new Request(SITE + '/auth/github/refresh', { method: 'POST', headers: { Origin: 'https://evil.example' }, body: '{"r":"x"}' }), ENV, gh({ access_token: 'z' }));
ok(r.status === 403, 'renewal refuses another site');
r = await handle(new Request(SITE + '/auth/github/refresh', { method: 'POST', headers: { Origin: SITE }, body: '{}' }), ENV, gh({}));
ok(r.status === 400, 'renewal needs a renewal token');
calls.length = 0;
r = await handle(new Request(SITE + '/auth/github/refresh', { method: 'POST', headers: { Origin: SITE, 'Content-Type': 'application/json' }, body: JSON.stringify({ r: 'ghr_ref' }) }), ENV, gh({ access_token: 'ghu_new', refresh_token: 'ghr_new', expires_in: 100 }), 5000);
const j = await r.json();
ok(r.status === 200 && j.t === 'ghu_new' && j.r === 'ghr_new' && j.exp === 5000 + 100e3 && calls[0].body.grant_type === 'refresh_token' && calls[0].body.refresh_token === 'ghr_ref', 'a renewal token gets a new token (' + JSON.stringify(j) + ')');
r = await handle(new Request(SITE + '/auth/github/refresh', { method: 'POST', headers: { Origin: SITE }, body: JSON.stringify({ r: 'old' }) }), ENV, gh({ error: 'bad_refresh_token' }));
ok(r.status === 401 && (await r.json()).error === 'bad_refresh_token', 'an expired renewal token is refused (sign in again)');
/* everything else is the site */
r = await handle(new Request(SITE + '/guide/'), ENV, gh({}));
ok(await r.text() === 'asset /guide/', 'every other address is the built site, as before');
ok(b64url('é✓') === btoa(String.fromCharCode(...new TextEncoder().encode('é✓'))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), 'base64url handles any text');
console.log('\nworker: ' + (n - fails) + '/' + n + ' checks passed'); process.exit(fails ? 1 : 0);
