/* the-daily.studio · Send with recordings (2.54): the Worker's side
   A song link can carry recordings. The studio compresses them, packs them with the song and ENCRYPTS the package in the sender's browser
   (AES-GCM, a new random key each time). Only the encrypted bytes come here; the key rides in the link after the #, which never reaches any
   server. So this Worker, Cloudflare and the site's owner can't open what is stored. Everything is deleted after 7 days (the bucket's
   lifecycle rule, and this Worker refuses anything older).
     POST /share/put      body: the encrypted package     → { ref, exp }   needs Sign in with GitHub (or a GitHub token): one account, limits
     GET  /share/<ref>                                     → the encrypted package, or 404 when it has expired or was taken back
     POST /share/delete   { ref }                          → { ok }        the sender takes a share back (same GitHub account)
     POST /share/report   { ref, why, key? }               → { ok }        anyone with the link can report it; kept for the owner to check
   Limits, so nobody can run up the bill or use this as free file storage: 25 MB a package, 10 a day for each account, 200 a day in all and
   3 GB a day in all. They are counted from the bucket itself (today's packages are listed), so nothing else needs setting up.
   Stored: the package under <day>/<account hash>/<random id>, with the GitHub account's number (for abuse reports, deleted with it). */
export const SHARE = { max: 25 * 1024 * 1024, perUser: 10, perDay: 200, bytesDay: 3e9, keepDays: 7, reportsDay: 100, magic: [0x54, 0x44, 0x53, 0x31] };      /* "TDS1" */
const H = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, H) });
const REF = /^(\d{8})\.([0-9a-f]{12})\.([A-Za-z0-9_-]{22})$/;
/** today as YYYYMMDD (UTC) */
export const shareDay = now => new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
const dayMs = d => Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8));
const keyOf = ref => { const m = REF.exec(String(ref || '')); return m ? m[1] + '/' + m[2] + '/' + m[3] : null; };
const expired = (ref, now) => now - dayMs(ref.slice(0, 8)) > (SHARE.keepDays + 1) * 864e5;
async function hex(s) { const b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); return [...b].map(x => x.toString(16).padStart(2, '0')).join(''); }
const accountHash = id => hex('the-daily.studio share:' + id).then(h => h.slice(0, 12));
function rid() { const b = crypto.getRandomValues(new Uint8Array(16)); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
/** who is sending: GitHub says, from the token the studio already has (the token is used for this one question and not kept) */
async function whoIs(req, fetchFn) {
  const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim(); if (!tok || tok.length > 400) return null;
  try { const r = await fetchFn('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'User-Agent': 'the-daily.studio' } }); if (!r.ok) return null; const j = await r.json(); return j && j.id ? { id: String(j.id) } : null; } catch (e) { return null; }
}
/** the request's body, read up to `max` bytes (null when there is more: an upload that hid its length is still stopped at the limit) */
async function capped(req, max) {
  if (!req.body) return new Uint8Array(0); const r = req.body.getReader(), parts = []; let n = 0;
  for (;;) { const { value, done } = await r.read(); if (done) break; n += value.length; if (n > max) { try { await r.cancel(); } catch (e) { } return null; } parts.push(value); }
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}
const sameSite = (req, u) => req.headers.get('Origin') === u.origin;

export async function share(req, env, u, fetchFn, now) {
  const B = env && env.SHARES; if (!B) return json({ error: 'not-set-up' }, 503);
  const path = u.pathname.slice('/share/'.length);

  if (req.method === 'GET' || req.method === 'HEAD') {      /* a package, to whoever has the link (and so the key) */
    const k = keyOf(path); if (!k || expired(path, now)) return json({ error: 'gone' }, 404);
    const o = await B.get(k); if (!o) return json({ error: 'gone' }, 404);
    return new Response(req.method === 'HEAD' ? null : o.body, { headers: Object.assign({ 'Content-Type': 'application/octet-stream', 'Content-Length': String(o.size), 'Cross-Origin-Resource-Policy': 'same-origin' }, H, { 'Cache-Control': 'private, max-age=86400' }) });
  }
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!sameSite(req, u)) return json({ error: 'origin' }, 403);

  if (path === 'put') {
    const len = +req.headers.get('Content-Length') || 0; if (len > SHARE.max) return json({ error: 'too-big', max: SHARE.max }, 413);
    const who = await whoIs(req, fetchFn); if (!who) return json({ error: 'sign-in' }, 401);
    const day = shareDay(now), uh = await accountHash(who.id), list = await B.list({ prefix: day + '/', limit: 1000 });
    const objs = list.objects || [], mine = objs.filter(o => o.key.startsWith(day + '/' + uh + '/')).length, bytes = objs.reduce((a, o) => a + (o.size || 0), 0);
    if (mine >= SHARE.perUser) return json({ error: 'limit-you', limit: SHARE.perUser }, 429);
    if (list.truncated || objs.length >= SHARE.perDay || bytes + Math.max(len, 1) > SHARE.bytesDay) return json({ error: 'limit-all' }, 429);
    const body = await capped(req, SHARE.max); if (!body) return json({ error: 'too-big', max: SHARE.max }, 413);
    if ((len && body.length !== len) || body.length < 4 + 12 + 16 || SHARE.magic.some((b, i) => body[i] !== b)) return json({ error: 'not-a-package' }, 400);      /* only the studio's own sealed packages */
    const id = rid(), ref = day + '.' + uh + '.' + id;
    await B.put(day + '/' + uh + '/' + id, body, { httpMetadata: { contentType: 'application/octet-stream' }, customMetadata: { u: who.id, at: String(now) } });
    return json({ ref, exp: now + SHARE.keepDays * 864e5 });
  }
  let b = {}; try { b = await req.json(); } catch (e) { } if (!b || typeof b !== 'object') b = {};
  if (path === 'delete') {      /* taken back by whoever sent it */
    const k = keyOf(b.ref); if (!k) return json({ error: 'ref' }, 400);
    const who = await whoIs(req, fetchFn); if (!who) return json({ error: 'sign-in' }, 401);
    if (k.split('/')[1] !== await accountHash(who.id)) return json({ error: 'not-yours' }, 403);
    await B.delete(k); return json({ ok: true });
  }
  if (path === 'report') {      /* anyone with the link; the reason, and the key only if they chose to include it */
    const k = keyOf(b.ref); if (!k) return json({ error: 'ref' }, 400);
    const day = shareDay(now), n = await B.list({ prefix: 'reports/' + day + '/', limit: SHARE.reportsDay });
    if ((n.objects || []).length >= SHARE.reportsDay) return json({ error: 'limit-all' }, 429);
    const o = await B.head(k), rep = { ref: b.ref, why: String(b.why || '').slice(0, 500), key: typeof b.key === 'string' && /^[A-Za-z0-9_-]{43}$/.test(b.key) ? b.key : '', account: o && o.customMetadata ? o.customMetadata.u || '' : '', at: new Date(now).toISOString() };
    await B.put('reports/' + day + '/' + now + '-' + rid().slice(0, 8) + '.json', JSON.stringify(rep, null, 1), { httpMetadata: { contentType: 'application/json' } });
    return json({ ok: true });
  }
  return json({ error: 'not-here' }, 404);
}
