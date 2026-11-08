/* the-daily.studio · Drops (2.60): new music from the studio, public for 7 days, after the site's owner has listened to it
   An artist finishes a song (part 39c) and drops it: the master, compressed in their browser (Ogg Opus), with a title, the name they
   choose, a note and, if they like, a link to the song itself. It waits, private, until the owner approves it on /drops/review/; only then
   is it public, on /drops/, for 7 days (the public bucket's lifecycle rule, and this Worker hides anything older). Reports reach the owner.
     POST /drops/api/put       body: the audio; header X-Drop-Meta: base64url JSON { t, a, n, l, d }   → { id, status: 'pending' }
     GET  /drops/api/list                                   → the live drops (public, cached a minute)
     GET  /drops/a/<id>                                     → a live drop's audio, when there is no public bucket address (DROPS_URL)
     POST /drops/api/review    (owner)                      → { pending, live }
     GET  /drops/api/pending/<id>   (owner)                 → a waiting drop's audio, to listen before deciding
     POST /drops/api/decide    { id, ok }   (owner)         → approved: public for 7 days; not: deleted
     POST /drops/api/remove    { id }       (owner)         → taken down
     POST /drops/api/report    { id, why }                  → kept for the owner (in the private bucket, 7 days)
   Off until set up: the public bucket bound as DROPS, and the owner's GitHub account number in OWNER_GITHUB_ID (docs/CLOUDFLARE_SETUP.md,
   Part H). Waiting drops, a marker for each drop sent (for the daily limit) and reports are kept in the private bucket (SHARES), under drops-pending/,
   drops-sent/ and reports/drops/; its 7-day rule deletes them.
   Limits: 15 MB a drop, 3 a day for each account, 100 waiting at once. Sending needs Sign in with GitHub, as for recordings. */
export const DROP = { max: 15 * 1024 * 1024, perUser: 3, pending: 100, keepDays: 7, reportsDay: 100 };
const H = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const json = (o, s, extra) => new Response(JSON.stringify(o), { status: s || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, H, extra || {}) });
const ID = /^[A-Za-z0-9_-]{16,24}$/, day = now => new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
function rid() { const b = crypto.getRandomValues(new Uint8Array(12)); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
const str = (x, n) => String(x == null ? '' : x).replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, n);
async function who(req, fetchFn) {
  const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim(); if (!tok || tok.length > 400) return null;
  try { const r = await fetchFn('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'User-Agent': 'the-daily.studio' } }); if (!r.ok) return null; const j = await r.json(); return j && j.id ? { id: String(j.id), login: String(j.login || '') } : null; } catch (e) { return null; }
}
async function capped(req, max) { if (!req.body) return new Uint8Array(0); const r = req.body.getReader(), parts = []; let n = 0; for (;;) { const { value, done } = await r.read(); if (done) break; n += value.length; if (n > max) { try { await r.cancel(); } catch (e) { } return null; } parts.push(value); } const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }
/** what a drop says about itself (from the artist; shown on a public page, so plain text only, cut to length) */
function meta(raw) {
  let m = {}; try { m = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(String(raw || '').replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))); } catch (e) { return null; }
  const t = str(m.t, 80), a = str(m.a, 40); if (!t || !a) return null; const l = typeof m.l === 'string' && /^s=1[zj][A-Za-z0-9_-]{4,20000}$/.test(m.l) ? m.l : '';
  return { t, a, n: str(m.n, 280), l, d: Math.max(0, Math.min(3600, Math.round(+m.d || 0))) };
}
const live = (o, now) => o && o.customMetadata && now - (+o.customMetadata.at || 0) < DROP.keepDays * 864e5;
const card = (o, env) => { const m = o.customMetadata || {}, id = o.key.slice(5, -4); return { id, t: m.t, a: m.a, n: m.n || '', l: m.l || '', d: +m.d || 0, at: +m.at || 0, until: (+m.at || 0) + DROP.keepDays * 864e5, url: env.DROPS_URL ? String(env.DROPS_URL).replace(/\/+$/, '') + '/' + o.key : '/drops/a/' + id }; };

export async function drops(req, env, u, fetchFn, now) {
  if (!env || !env.DROPS || !env.SHARES || !env.OWNER_GITHUB_ID) return json({ error: 'not-set-up' }, 503);
  const p = u.pathname, B = env.DROPS, P = env.SHARES, owner = async () => { const w = await who(req, fetchFn); return w && w.id === String(env.OWNER_GITHUB_ID) ? w : null; };
  if (req.method === 'GET' && p === '/drops/api/list') {
    const l = await B.list({ prefix: 'live/', limit: 500, include: ['customMetadata'] }), items = (l.objects || []).filter(o => live(o, now)).map(o => card(o, env)).sort((a, b) => b.at - a.at);
    return json({ drops: items }, 200, { 'Cache-Control': 'public, max-age=60' });
  }
  if (req.method === 'GET' && p.startsWith('/drops/a/')) { const id = p.slice(9); if (!ID.test(id)) return json({ error: 'gone' }, 404); const o = await B.get('live/' + id + '.ogg'); if (!o || !live(o, now)) return json({ error: 'gone' }, 404); return new Response(o.body, { headers: Object.assign({ 'Content-Type': 'audio/ogg', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' }) }); }
  if (req.method === 'GET' && p.startsWith('/drops/api/pending/')) { if (!await owner()) return json({ error: 'owner' }, 403); const id = p.slice(19); if (!ID.test(id)) return json({ error: 'gone' }, 404); const o = await P.get('drops-pending/' + id + '.ogg'); return o ? new Response(o.body, { headers: Object.assign({ 'Content-Type': 'audio/ogg' }, H) }) : json({ error: 'gone' }, 404); }
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (req.headers.get('Origin') !== u.origin) return json({ error: 'origin' }, 403);
  if (p === '/drops/api/put') {
    const len = +req.headers.get('Content-Length') || 0; if (len > DROP.max) return json({ error: 'too-big', max: DROP.max }, 413);
    const m = meta(req.headers.get('X-Drop-Meta')); if (!m) return json({ error: 'meta' }, 400);
    const w = await who(req, fetchFn); if (!w) return json({ error: 'sign-in' }, 401);
    const list = await P.list({ prefix: 'drops-pending/', limit: 1000, include: ['customMetadata'] }), objs = (list.objects || []).filter(o => o.key.endsWith('.ogg'));
    if (objs.length >= DROP.pending) return json({ error: 'queue-full' }, 429);
    const today = day(now), sent = await P.list({ prefix: 'drops-sent/' + today + '/' + w.id + '/', limit: DROP.perUser + 1 }); if ((sent.objects || []).length >= DROP.perUser) return json({ error: 'limit-you', limit: DROP.perUser }, 429);      /* every drop sent today counts, waiting, approved or not */
    const body = await capped(req, DROP.max); if (!body) return json({ error: 'too-big', max: DROP.max }, 413);
    if (body.length < 64 || body[0] !== 0x4f || body[1] !== 0x67 || body[2] !== 0x67 || body[3] !== 0x53) return json({ error: 'not-audio' }, 400);      /* "OggS": an Ogg Opus file made by the studio */
    const id = rid(); await P.put('drops-sent/' + today + '/' + w.id + '/' + id, '1');
    await P.put('drops-pending/' + id + '.ogg', body, { httpMetadata: { contentType: 'audio/ogg' }, customMetadata: Object.assign({}, m, { u: w.id, login: w.login, day: today, sent: String(now) }) });
    return json({ id, status: 'pending' });
  }
  let b = {}; try { b = await req.json(); } catch (e) { } if (!b || typeof b !== 'object') b = {};
  if (p === '/drops/api/report') {
    if (!ID.test(String(b.id || ''))) return json({ error: 'id' }, 400); const d = day(now), n = await P.list({ prefix: 'reports/drops/' + d + '/', limit: DROP.reportsDay }); if ((n.objects || []).length >= DROP.reportsDay) return json({ error: 'limit-all' }, 429);
    const o = await B.head('live/' + b.id + '.ogg'); await P.put('reports/drops/' + d + '/' + now + '-' + rid().slice(0, 6) + '.json', JSON.stringify({ id: b.id, why: str(b.why, 500), title: o && o.customMetadata ? o.customMetadata.t : '', account: o && o.customMetadata ? o.customMetadata.u : '', at: new Date(now).toISOString() }, null, 1), { httpMetadata: { contentType: 'application/json' } });
    return json({ ok: true });
  }
  if (!await owner()) return json({ error: 'owner' }, 403);
  if (p === '/drops/api/review') {
    const pl = await P.list({ prefix: 'drops-pending/', limit: 1000, include: ['customMetadata'] }), ll = await B.list({ prefix: 'live/', limit: 500, include: ['customMetadata'] });
    return json({ pending: (pl.objects || []).filter(o => o.key.endsWith('.ogg')).map(o => Object.assign({ id: o.key.slice(14, -4), size: o.size }, o.customMetadata)), live: (ll.objects || []).filter(o => live(o, now)).map(o => Object.assign(card(o, env), { u: (o.customMetadata || {}).u, login: (o.customMetadata || {}).login })) });
  }
  if (p === '/drops/api/decide') {
    if (!ID.test(String(b.id || ''))) return json({ error: 'id' }, 400); const k = 'drops-pending/' + b.id + '.ogg', o = await P.get(k); if (!o) return json({ error: 'gone' }, 404);
    if (b.ok === true) { const body = new Uint8Array(await new Response(o.body).arrayBuffer()); await B.put('live/' + b.id + '.ogg', body, { httpMetadata: { contentType: 'audio/ogg', cacheControl: 'public, max-age=86400' }, customMetadata: Object.assign({}, o.customMetadata, { at: String(now) }) }); }
    await P.delete(k); return json({ ok: true, live: b.ok === true });
  }
  if (p === '/drops/api/remove') { if (!ID.test(String(b.id || ''))) return json({ error: 'id' }, 400); await B.delete('live/' + b.id + '.ogg'); return json({ ok: true }); }
  return json({ error: 'not-here' }, 404);
}
