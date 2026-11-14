/* the-daily.studio · the site's Worker (Cloudflare Workers)
   It serves the built site (dist/, through the ASSETS binding) and, once the site owner has set up a GitHub App (docs/GITHUB.md),
   finishes "Sign in with GitHub". GitHub's sign-in hands back a one-time code; turning it into a token needs the app's client
   secret, which cannot live in a web page, so it lives here as a Worker secret. Nothing else passes through this Worker: songs and
   settings go from the browser straight to GitHub. It keeps nothing: no log of who signed in, no storage.
     GET  /auth/github/callback?code&state   → 302 to /#gh=<token, renewal token, expiry times, state>   (the part after # never
                                               reaches any server; the page checks the state, keeps the token and clears the address)
     POST /auth/github/refresh  { r }         → { t, r, exp, rexp }   a new token when the old one runs out (from this site only)
   /share/* (2.54) keeps encrypted recordings for 7 days for song links (worker/share.mjs, in the R2 bucket bound as SHARES).
   Secrets (npx wrangler secret put …): GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET. Without them both routes say so and the site works as before.
   The Daily (2.50) has its own address, journal.<site>: there "/" is The Daily and "/move/" receives a journal handed over from the old
   address. On the site itself, /journal/ is a page that moves a journal kept there to the new address; the receiving page is not served
   here. A short list of scanner/bot-bait paths (/.env, /wp-login.php, /.git/config, …) is deliberately routed here too and taxed with a
   slow, empty 404 (worker/honeypot.mjs, 2.69), with an optional auto-block of repeat offenders (2.69.1, off until set up) — everything
   else is the site, as before. */
import { share } from './share.mjs';
import { drops } from './drops.mjs';
import { isHoneyPath, honeypot } from './honeypot.mjs';
const NO_STORE = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const TOKEN_URL = 'https://github.com/login/oauth/access_token';

/** base64url of a string (UTF-8) */
export function b64url(s) { const u = new TextEncoder().encode(s); let b = ''; for (const x of u) b += String.fromCharCode(x); return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
const ready = env => !!(env && env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
/** GitHub's token endpoint, with the app's id and secret added */
async function exchange(env, params, fetchFn) {
  const body = new URLSearchParams(Object.assign({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET }, params));
  const r = await fetchFn(TOKEN_URL, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'the-daily.studio' }, body });
  try { return await r.json(); } catch (e) { return { error: 'bad-answer' }; }
}
const tokens = (j, now) => ({ t: j.access_token, r: j.refresh_token || '', exp: j.expires_in ? now + j.expires_in * 1000 : 0, rexp: j.refresh_token_expires_in ? now + j.refresh_token_expires_in * 1000 : 0 });
const clean = s => String(s || '').replace(/[^\w.-]/g, '').slice(0, 60) || 'unknown';

/** the site's file at `path`, as the assets would serve it (keeping the method and headers of the request) */
const asset = (env, req, u, path) => env.ASSETS.fetch(new Request(new URL(path, u), req));
export async function handle(req, env, fetchFn = fetch, now = Date.now(), sleepFn = ms => new Promise(r => setTimeout(r, ms))) {
  const u = new URL(req.url);
  if (isHoneyPath(u.pathname)) return honeypot(req, u, env, fetchFn, sleepFn);      /* scanner/bot bait (2.69, worker/honeypot.mjs) */
  if (/^journal\./.test(u.hostname)) {      /* The Daily's own address */
    if (u.pathname === '/' || u.pathname === '/index.html') return asset(env, req, u, '/journal/');
    if (u.pathname === '/move/' || u.pathname === '/move') return asset(env, req, u, '/journal/move');
    return asset(env, req, u, '/journal/not-here');      /* everything else: the site's not-found page */
  }
  if (u.pathname === '/journal' || u.pathname === '/journal/' || u.pathname === '/journal/index.html') return asset(env, req, u, '/journal/moving');
  if (/^\/journal\/move(\.html)?$/.test(u.pathname)) return asset(env, req, u, '/journal/not-here');      /* the receiving page belongs to the new address only */
  if (u.pathname.startsWith('/share/')) return share(req, env, u, fetchFn, now);
  if (u.pathname.startsWith('/drops/api/') || u.pathname.startsWith('/drops/a/')) return drops(req, env, u, fetchFn, now);      /* Drops (2.60, worker/drops.mjs) */      /* Send with recordings (2.54, worker/share.mjs) */
  if (u.pathname === '/auth/github/callback') {
    const back = frag => new Response(null, { status: 302, headers: Object.assign({ Location: '/#' + frag }, NO_STORE) });
    if (!ready(env)) return back('gh-error=not-set-up');
    const code = u.searchParams.get('code'), state = clean(u.searchParams.get('state'));
    if (!code) return back('gh-error=' + clean(u.searchParams.get('error') || 'no-code'));
    const j = await exchange(env, { code: code.slice(0, 200), redirect_uri: u.origin + '/auth/github/callback' }, fetchFn);
    if (!j.access_token) return back('gh-error=' + clean(j.error || 'exchange-failed'));
    return back('gh=' + b64url(JSON.stringify(Object.assign(tokens(j, now), { state }))));
  }
  if (u.pathname === '/auth/github/refresh') {
    const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, NO_STORE) });
    if (req.method !== 'POST') return json({ error: 'method' }, 405);
    const origin = req.headers.get('Origin'); if (origin && origin !== u.origin) return json({ error: 'origin' }, 403);
    if (!ready(env)) return json({ error: 'not-set-up' }, 503);
    let b = {}; try { b = await req.json(); } catch (e) { }
    if (!b || typeof b.r !== 'string' || !b.r || b.r.length > 500) return json({ error: 'no-refresh-token' }, 400);
    const j = await exchange(env, { grant_type: 'refresh_token', refresh_token: b.r }, fetchFn);
    if (!j.access_token) return json({ error: clean(j.error || 'refresh-failed') }, 401);
    return json(tokens(j, now));
  }
  return env.ASSETS.fetch(req);
}
export default { fetch: (req, env) => handle(req, env) };
