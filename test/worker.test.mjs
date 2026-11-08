/* The site's Worker (worker/index.mjs): Sign in with GitHub's two routes, with GitHub's token endpoint stood in for. No browser, no network.
   Run: node test/worker.test.mjs */
import { handle, b64url } from '../worker/index.mjs';
import { SHARE, shareDay } from '../worker/share.mjs';
import { fakeR2 } from './fake-r2.mjs';
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
/* The Daily's own address (2.50) */
const J = 'https://journal.the-daily.studio';
r = await handle(new Request(J + '/'), ENV, gh({})); ok(await r.text() === 'asset /journal/', 'journal.<site>/ is The Daily');
r = await handle(new Request(J + '/move/'), ENV, gh({})); ok(await r.text() === 'asset /journal/move', 'journal.<site>/move/ is the page that receives a journal');
r = await handle(new Request(J + '/guide/'), ENV, gh({})); ok(await r.text() === 'asset /journal/not-here', 'nothing else of the site is served at The Daily’s address (its not-found page)');
r = await handle(new Request(J + '/auth/github/callback?code=x&state=s'), ENV, gh({ access_token: 't' })); ok(await r.text() === 'asset /journal/not-here', 'and the sign-in routes are the studio’s only');
r = await handle(new Request(SITE + '/journal/'), ENV, gh({})); ok(await r.text() === 'asset /journal/moving', 'the-daily.studio/journal/ is the page that moves a journal to the new address');
r = await handle(new Request(SITE + '/journal'), ENV, gh({})); ok(await r.text() === 'asset /journal/moving', 'with or without the slash');
r = await handle(new Request(SITE + '/journal/move'), ENV, gh({})); ok(await r.text() === 'asset /journal/not-here', 'the receiving page is not served at the old address');
ok(b64url('é✓') === btoa(String.fromCharCode(...new TextEncoder().encode('é✓'))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), 'base64url handles any text');
/* ---- Send with recordings (2.54): /share/* ---- */
{
  const R2 = fakeR2(), SENV = Object.assign({}, ENV, { SHARES: R2 }), NOW = Date.UTC(2026, 10, 8, 12);
  const users = { tokA: { id: 101, login: 'a' }, tokB: { id: 202, login: 'b' } };
  const ghU = async (url, init) => { const t = String((init.headers || {}).Authorization || '').replace('Bearer ', ''); return users[t] ? new Response(JSON.stringify(users[t]), { headers: { 'Content-Type': 'application/json' } }) : new Response('{"message":"Bad credentials"}', { status: 401 }); };
  const pkg = (n = 100) => { const u = new Uint8Array(n); u.set(SHARE.magic); for (let i = 4; i < n; i++) u[i] = (i * 31) & 255; return u; };
  const put = (body, tok, o = {}) => handle(new Request(SITE + '/share/put', { method: 'POST', headers: Object.assign({ Origin: o.origin || SITE, 'Content-Type': 'application/octet-stream' }, tok ? { Authorization: 'Bearer ' + tok } : {}, o.len ? { 'Content-Length': String(o.len) } : {}), body }), SENV, ghU, o.now || NOW);
  r = await handle(new Request(SITE + '/share/put', { method: 'POST', headers: { Origin: SITE }, body: pkg() }), ENV, ghU, NOW);
  ok(r.status === 503, 'without the bucket, sharing recordings says it is not set up');
  r = await put(pkg(), null); ok(r.status === 401 && !R2.m.size, 'sending recordings needs a GitHub sign-in; nothing is stored without one');
  r = await put(pkg(), 'nope'); ok(r.status === 401, 'a token GitHub refuses is refused');
  r = await put(pkg(), 'tokA', { origin: 'https://evil.example' }); ok(r.status === 403, 'another site cannot send');
  const bad = new Uint8Array(100); bad.set([0x50, 0x4b, 3, 4]); r = await put(bad, 'tokA'); ok(r.status === 400 && !R2.m.size, 'only the studio’s own sealed packages are taken (a zip, or any other file, is refused)');
  r = await put(pkg(), 'tokA', { len: SHARE.max + 1 }); ok(r.status === 413, 'over 25 MB is refused before anything is read');
  r = await put(new Uint8Array(SHARE.max + 10).fill(0x54), 'tokA'); ok(r.status === 413 && !R2.m.size, 'and an upload that does not say its size is still stopped at 25 MB');
  r = await put(pkg(1000), 'tokA'); const J = await r.json();
  ok(r.status === 200 && /^20261108\.[0-9a-f]{12}\.[A-Za-z0-9_-]{22}$/.test(J.ref) && J.exp === NOW + 7 * 864e5, 'a package is kept under a random name, for 7 days (' + J.ref + ')');
  const key = J.ref.replace(/\./g, '/'), stored = R2.m.get(key);
  ok(stored && stored.bytes.length === 1000 && stored.meta.u === '101' && !JSON.stringify(stored.meta).includes('tokA') && !key.includes('101'), 'stored: the bytes as sent and the account number for abuse reports; never the token, and the name does not show the account');
  r = await handle(new Request(SITE + '/share/' + J.ref), SENV, ghU, NOW + 3 * 864e5); const got = new Uint8Array(await r.arrayBuffer());
  ok(r.status === 200 && got.length === 1000 && got[10] === pkg(1000)[10] && r.headers.get('Content-Type') === 'application/octet-stream' && r.headers.get('Cross-Origin-Resource-Policy') === 'same-origin', 'whoever has the link gets the package back, as plain bytes, for this site only');
  r = await handle(new Request(SITE + '/share/' + J.ref), SENV, ghU, NOW + 9 * 864e5); ok(r.status === 404, 'after 7 days it is gone, even before the bucket deletes it');
  r = await handle(new Request(SITE + '/share/20261108.zz..%2F..%2Fetc'), SENV, ghU, NOW); ok(r.status === 404, 'anything that is not a share’s name is 404');
  r = await handle(new Request('https://journal.the-daily.studio/share/' + J.ref), SENV, ghU, NOW); ok(await r.text() === 'asset /journal/not-here', 'and shares are not served at The Daily’s address');
  /* limits */
  for (let i = 0; i < SHARE.perUser - 1; i++) await put(pkg(), 'tokA');
  r = await put(pkg(), 'tokA'); ok(r.status === 429 && (await r.json()).error === 'limit-you', 'ten a day for each account');
  r = await put(pkg(), 'tokB'); ok(r.status === 200, 'another account can still send');
  r = await put(pkg(), 'tokA', { now: NOW + 864e5 }); ok(r.status === 200, 'and the next day the count starts again');
  const before = R2.m.size; for (let i = 0; i < SHARE.perDay; i++) await R2.put(shareDay(NOW) + '/ffffffffffff/x' + i, pkg());
  r = await put(pkg(), 'tokB'); ok(r.status === 429 && (await r.json()).error === 'limit-all' && R2.m.size === before + SHARE.perDay, 'and 200 a day in all, so nobody can run up the bill');
  /* taking one back, and reports */
  const del = (ref, tok) => handle(new Request(SITE + '/share/delete', { method: 'POST', headers: { Origin: SITE, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ ref }) }), SENV, ghU, NOW);
  r = await del(J.ref, 'tokB'); ok(r.status === 403 && R2.m.has(key), 'someone else cannot take your share back');
  r = await handle(new Request(SITE + '/share/report', { method: 'POST', headers: { Origin: SITE, 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: J.ref, why: 'Not mine', key: 'k'.repeat(43) }) }), SENV, ghU, NOW);
  const rep = [...R2.m.keys()].find(k => k.startsWith('reports/')), rj = rep && JSON.parse(new TextDecoder().decode(R2.m.get(rep).bytes));
  ok(r.status === 200 && rj && rj.ref === J.ref && rj.why === 'Not mine' && rj.account === '101' && rj.key.length === 43, 'anyone with the link can report it: the reason, the account it came from and (if they chose) the key, so the owner can listen and act');
  r = await del(J.ref, 'tokA'); ok(r.status === 200 && !R2.m.has(key), 'the sender can take a share back');
  r = await handle(new Request(SITE + '/share/' + J.ref), SENV, ghU, NOW); ok(r.status === 404, 'and then the link’s recordings are gone');
  r = await handle(new Request(SITE + '/share/put'), SENV, ghU, NOW); ok(r.status === 404 || r.status === 405, 'GET on the upload route stores nothing');
}
console.log('\nworker: ' + (n - fails) + '/' + n + ' checks passed'); process.exit(fails ? 1 : 0);
