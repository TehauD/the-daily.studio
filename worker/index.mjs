/* the-daily.studio · the site's Worker (Cloudflare Workers)
   It serves the built site (dist/, through the ASSETS binding) and, once the site owner has set up a GitHub App (docs/GITHUB.md),
   finishes "Sign in with GitHub". GitHub's sign-in hands back a one-time code; turning it into a token needs the app's client
   secret, which cannot live in a web page, so it lives here as a Worker secret. Nothing else passes through this Worker: songs and
   settings go from the browser straight to GitHub. It keeps nothing: no log of who signed in, no storage.
     GET  /auth/github/callback?code&state   → 302 to /#gh=<token, renewal token, expiry times, state>   (the part after # never
                                               reaches any server; the page checks the state, keeps the token and clears the address)
     POST /auth/github/refresh  { r }         → { t, r, exp, rexp }   a new token when the old one runs out (from this site only)
   Secrets (npx wrangler secret put …): GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET. Without them both routes say so and the site works as before. */
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

export async function handle(req, env, fetchFn = fetch, now = Date.now()) {
  const u = new URL(req.url);
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
