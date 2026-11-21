#!/usr/bin/env node
/* the-daily.studio · scan-guard: turns a handful of Cloudflare WAF custom-rule slots into a rotating block list for scanners.

   What it does, each time it runs (once, or every N seconds with --watch):
     1. reads the last few minutes of requests that got a 4xx answer from Cloudflare's GraphQL analytics (read-only);
     2. scores every client IP by WHAT it asked for — not how much. Scanners are recognisable by the endpoints they try:
        .env / .git / wp-login / phpmyadmin / cgi-bin / backups, many different paths that all 404. A person with a stale
        bookmark asks for one or two paths that do not exist; a scanner asks for dozens of different ones;
     3. keeps the worst offenders in at most SLOTS (default 5) custom rules, one IP per rule, named "scan-guard …". The rules
        are the only state: when all slots are full, a new scanner replaces the quietest blocked one (or waits, if every
        slot still holds an active scanner); a blocked IP that goes quiet for a while is released, so a reassigned address
        is not blocked forever.
   It never touches a rule whose description does not start with "scan-guard", so your other custom rules (for example the
   honeypot-block rule in docs/CLOUDFLARE_SETUP.md) are left exactly as they are.

   Dry run by default: without --apply it prints what it would change and writes nothing.
     CF_API_TOKEN       custom token: Zone ▸ Zone WAF ▸ Edit, Zone ▸ Analytics ▸ Read, this one zone only
     CF_ZONE_ID         the zone id (dashboard ▸ the zone ▸ Overview)
     SCAN_GUARD_ALLOW   optional, comma-separated IPs that must never be blocked (your own, a monitor, a client)
     node scripts/scan-guard.mjs [--apply] [--watch [seconds]] [--slots 5] [--window 15] [--threshold 20] [--json]
   Honest limits: Cloudflare only sees web requests, so this catches scanning of the site's endpoints, not raw port scans
   against other services; and 6 or more scanners at once will exceed the slots (the block list then rotates by threat). */
import net from 'node:net';
import { pathToFileURL } from 'node:url';
import { isHoneyPath } from '../worker/honeypot.mjs';

export const DEFAULTS = {
  slots: 5,          /* custom rules this tool may use, one IP each (the free plan allows 5 in all: lower it if honeypot-block uses one) */
  windowMin: 15,     /* how far back to look */
  threshold: 20,     /* score that makes an IP a scanner */
  minHoldMin: 10,    /* a block is kept at least this long before another scanner may take its slot */
  quietMin: 60,      /* a blocked IP that has not asked for anything for this long is released */
  swapFactor: 1.5,   /* a waiting scanner takes an occupied slot only if it scores at least this many times what the holder does now */
};
export const PREFIX = 'scan-guard';
const PHASE = 'http_request_firewall_custom';
const API = 'https://api.cloudflare.com/client/v4';

/* ---------- what an endpoint says about whoever asks for it ---------- */
const BENIGN = /^\/(favicon\.ico|robots\.txt|sitemap\.xml|ads\.txt|apple-touch-icon[\w-]*\.png|\.well-known\/.*|sw\.js|manifest\.webmanifest)$/;
/* the first match names the kind of endpoint, which is what the report shows */
const FAMILIES = [
  ['wordpress', /wp-|xmlrpc/],
  ['git/svn', /\/\.(git|svn|hg)(\/|$)/],
  ['secrets', /\.env|\.aws|\.docker|\.ssh|\.npmrc|\.htpasswd|\.htaccess|\.vscode|id_rsa|credentials|secrets?\b|config\.(php|json|ya?ml|inc)/],
  ['php', /\.php|phpmyadmin|\/pma\b|vendor\/phpunit/],
  ['admin panels', /\/(admin|administrator|manager|console|cpanel|webadmin|login|signin|dashboard)(\/|$|\.)/],
  ['devices & apps', /cgi-bin|boaform|hnap1|actuator|solr|jenkins|server-status|server-info|owa\/|ecp\/|autodiscover|\/shell|telescope|_ignition|\.asp|\.jsp|\/api\/v\d/],
  ['backups & dumps', /\.(bak|old|sql|zip|tar|gz|tgz|7z|rar|swp|orig)$|backup|dump/],
];
export const familyOf = p => { const x = String(p || '').toLowerCase(); const f = FAMILIES.find(([, re]) => re.test(x)); return f ? f[0] : null; };

/** score for one path that was refused: 0 harmless, 1 an ordinary miss, 3 a known kind of probe, 5 scanner bait (the Worker's own honeypot list) */
export function pathWeight(path) {
  const p = String(path || '').toLowerCase();
  if (!p || BENIGN.test(p)) return 0;
  if (isHoneyPath(p)) return 5;
  return familyOf(p) ? 3 : 1;
}

/** rows: [{ ip, path, status, count }] (a 4xx answer each). Returns Map ip → { score, requests, paths, families } */
export function scoreRows(rows) {
  const by = new Map();
  for (const r of rows) {
    const w = pathWeight(r.path); if (!r.ip) continue;
    let e = by.get(r.ip); if (!e) by.set(r.ip, e = { score: 0, requests: 0, paths: new Map(), families: {} });
    e.requests += r.count || 1;
    if (!e.paths.has(r.path)) { e.paths.set(r.path, w); }
  }
  for (const e of by.values()) {
    let plain = 0;
    for (const [p, w] of e.paths) {
      if (w === 1) { plain++; continue; }       /* plain misses are counted below, with a cap */
      e.score += w;
      const f = familyOf(p) || 'scanner bait'; e.families[f] = (e.families[f] || 0) + 1;
    }
    e.score += Math.min(plain, 20);             /* many different missing paths is itself the signature of a crawler of guesses */
    if (plain) e.families['other misses'] = plain;
    e.distinct = e.paths.size;
  }
  return by;
}

/* ---------- which address a rule covers ---------- */
function v6prefix64(ip) {
  if (!net.isIPv6(ip) || ip.includes('.')) return null;
  const [h, t] = ip.split('::'); const head = h ? h.split(':') : [], tail = t ? t.split(':') : [];
  if (t === undefined && head.length !== 8) return null;
  const g = [...head, ...(t === undefined ? [] : Array(8 - head.length - tail.length).fill('0')), ...tail].map(x => parseInt(x, 16).toString(16));
  return g.length === 8 ? g.slice(0, 4).join(':') + '::/64' : null;
}
/** the unit that is blocked: an IPv4 address, or the /64 an IPv6 address belongs to (a single host is handed a whole /64) */
export function targetOf(ip) {
  if (net.isIPv4(ip)) return { key: ip, expr: 'ip.src eq ' + ip };
  const p = v6prefix64(ip); return p ? { key: p, expr: 'ip.src in {' + p + '}' } : null;
}
const isPrivate = ip => /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(ip) || /^(::1|fe80:|fc|fd)/i.test(ip);

/* ---------- the rule's description is the slot's memory ---------- */
export const describe = (key, since, seen, score, why) => `${PREFIX} ip=${key} since=${since} seen=${seen} score=${score} why=${why}`.slice(0, 480);
export function parseRule(rule) {
  const d = String(rule.description || ''); if (!d.startsWith(PREFIX)) return null;
  const g = k => (d.match(new RegExp('\\b' + k + '=(\\S+)')) || [])[1];
  const ip = g('ip'); if (!ip) return null;
  return { id: rule.id, ip, since: Date.parse(g('since')) || 0, seen: Date.parse(g('seen')) || 0, score: Number(g('score')) || 0 };
}
const why = e => Object.entries(e.families).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => k + '×' + n).join(' ');

/* ---------- the decision: pure, so it can be tested without a network ---------- */
/** existing: parsed slot rules; scored: Map from scoreRows keyed by raw IP; returns an ordered list of actions */
export function plan({ existing, scored, now, allow = [], opts = {} }) {
  const o = { ...DEFAULTS, ...opts }, min = 60e3, acts = [];
  const byKey = new Map();           /* blocked unit → what the traffic through it looks like now */
  for (const [ip, e] of scored) { const t = targetOf(ip); if (!t) continue; const c = byKey.get(t.key); if (!c || e.score > c.score) byKey.set(t.key, { ...e, ip, key: t.key, expr: t.expr }); }
  const allowKeys = new Set(allow.map(a => (targetOf(a) || {}).key).filter(Boolean));
  const held = [];
  for (const r of existing) {
    const cur = byKey.get(r.ip), last = Math.max(r.since, r.seen, cur ? now : 0);
    if (now - last >= o.quietMin * min) { acts.push({ type: 'release', rule: r, reason: 'quiet for ' + Math.round((now - last) / min) + ' min' }); continue; }
    if (allowKeys.has(r.ip)) { acts.push({ type: 'release', rule: r, reason: 'now on the allow list' }); continue; }
    held.push({ ...r, active: cur ? cur.score : 0 });
    if (cur && now - r.seen > 5 * min) acts.push({ type: 'refresh', rule: r, score: cur.score, why: why(cur) });
  }
  const blocked = new Set(existing.map(r => r.ip));
  const cands = [...byKey.values()].filter(c => c.score >= o.threshold && !blocked.has(c.key) && !allowKeys.has(c.key) && !isPrivate(c.ip)).sort((a, b) => b.score - a.score);
  const free = () => o.slots - held.length;
  for (const c of cands) {
    const add = { ip: c.ip, key: c.key, expr: c.expr, score: c.score, why: why(c), requests: c.requests, distinct: c.distinct };
    if (free() > 0) { acts.push({ type: 'add', ...add }); held.push({ ip: c.key, since: now, seen: now, active: c.score, fresh: true }); continue; }
    const victims = held.filter(h => !h.fresh && now - h.since >= o.minHoldMin * min).sort((a, b) => a.active - b.active || a.seen - b.seen);
    const v = victims[0];
    if (v && c.score >= v.active * o.swapFactor) {
      acts.push({ type: 'replace', rule: { id: v.id, ip: v.ip }, ...add, reason: v.active ? 'holder still scoring ' + v.active : 'holder is quiet' });
      held.splice(held.indexOf(v), 1, { ip: c.key, since: now, seen: now, active: c.score, fresh: true });
    } else acts.push({ type: 'wait', ...add, reason: v ? 'every slot still holds a scanner scoring at least ' + Math.ceil(c.score / o.swapFactor) : 'every slot was filled in the last ' + o.minHoldMin + ' min' });
  }
  return acts;
}

/* ---------- Cloudflare ---------- */
export function cloudflare({ token, zone, fetchFn = fetch }) {
  const call = async (method, path, body) => {
    const res = await fetchFn(API + path, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    let j = {}; try { j = await res.json(); } catch (e) { /* not JSON */ }
    if (res.status === 404 && method === 'GET') return null;
    if (!res.ok || j.success === false || (j.errors && j.errors.length && !j.data)) throw new Error(method + ' ' + path.replace(zone, '<zone>') + ' → ' + res.status + ' ' + ((j.errors || []).map(e => e.message).join('; ') || 'failed'));
    return j;
  };
  const base = '/zones/' + zone;
  return {
    /** requests answered with a 4xx in [since, until): one row per IP, path and status */
    async misses(since, until) {
      const q = 'query($z:String!,$s:Time!,$u:Time!){viewer{zones(filter:{zoneTag:$z}){httpRequestsAdaptiveGroups(limit:10000,filter:{datetime_geq:$s,datetime_lt:$u,edgeResponseStatus_geq:400,edgeResponseStatus_lt:500},orderBy:[count_DESC]){count dimensions{clientIP clientRequestPath edgeResponseStatus}}}}}';
      const j = await call('POST', '/graphql', { query: q, variables: { z: zone, s: since.toISOString(), u: until.toISOString() } });
      if (j.errors && j.errors.length) throw new Error('analytics: ' + j.errors.map(e => e.message).join('; '));
      const g = (((j.data || {}).viewer || {}).zones || [])[0];
      if (!g) throw new Error('analytics: the zone was not found (check CF_ZONE_ID and the token’s Analytics ▸ Read permission)');
      const rows = g.httpRequestsAdaptiveGroups.map(r => ({ ip: r.dimensions.clientIP, path: r.dimensions.clientRequestPath, status: r.dimensions.edgeResponseStatus, count: r.count }));
      return { rows, truncated: rows.length >= 10000 };
    },
    async entrypoint() { const j = await call('GET', `${base}/rulesets/phases/${PHASE}/entrypoint`); return j ? j.result : null; },
    async add(rs, rule) {
      if (!rs) return (await call('PUT', `${base}/rulesets/phases/${PHASE}/entrypoint`, { rules: [rule] })).result;
      return (await call('POST', `${base}/rulesets/${rs.id}/rules`, rule)).result;
    },
    replace: (rs, id, rule) => call('PATCH', `${base}/rulesets/${rs.id}/rules/${id}`, rule),
    remove: (rs, id) => call('DELETE', `${base}/rulesets/${rs.id}/rules/${id}`),
  };
}
const ruleOf = (a, now) => { const t = new Date(now).toISOString().replace(/\.\d+Z$/, 'Z'); return { action: 'block', enabled: true, expression: a.expr, description: describe(a.key, t, t, a.score, (a.why || 'n/a').replace(/\s+/g, '_')) }; };

/** one pass: read, decide, and (with apply) write. Returns { acts, scored, truncated } */
export async function run({ cf, now = Date.now(), apply = false, allow = [], opts = {}, log = () => {} }) {
  const o = { ...DEFAULTS, ...opts };
  const { rows, truncated } = await cf.misses(new Date(now - o.windowMin * 60e3), new Date(now));
  const scored = scoreRows(rows);
  let rs = await cf.entrypoint();
  const owned = ((rs && rs.rules) || []).map(parseRule).filter(Boolean);
  const acts = plan({ existing: owned, scored, now, allow, opts: o });
  if (apply) {
    for (const a of acts) {
      try {
        if (a.type === 'release') await cf.remove(rs, a.rule.id);
        else if (a.type === 'refresh') {
          const t = new Date(now).toISOString().replace(/\.\d+Z$/, 'Z'), r = (rs.rules || []).find(x => x.id === a.rule.id);
          await cf.replace(rs, a.rule.id, { action: 'block', enabled: true, expression: r.expression, description: describe(a.rule.ip, new Date(a.rule.since).toISOString().replace(/\.\d+Z$/, 'Z'), t, a.score, (a.why || 'n/a').replace(/\s+/g, '_')) });
        } else if (a.type === 'add') { const made = await cf.add(rs, ruleOf(a, now)); if (!rs && made) rs = made; else if (!rs) rs = await cf.entrypoint(); }
        else if (a.type === 'replace') await cf.replace(rs, a.rule.id, ruleOf(a, now));
        a.done = true;
      } catch (e) { a.error = e.message; log('  ! ' + a.type + ' failed: ' + e.message); }
    }
  }
  return { acts, scored, truncated, held: owned.length };
}

/* ---------- command line ---------- */
export function describeAct(a) {
  const who = a.ip || (a.rule && a.rule.ip);
  if (a.type === 'add') return `block   ${who}  score ${a.score}  (${a.distinct} paths, ${a.requests} requests: ${a.why})`;
  if (a.type === 'replace') return `swap    ${a.rule.ip} → ${who}  score ${a.score}  (${a.reason}; ${a.why})`;
  if (a.type === 'release') return `release ${who}  (${a.reason})`;
  if (a.type === 'refresh') return `keep    ${who}  still active, score ${a.score}`;
  return `waiting ${who}  score ${a.score}  (${a.reason}; ${a.why})`;
}
function args(argv) {
  const o = { apply: false, watch: 0, json: false, opts: {} }, num = k => Number(argv[argv.indexOf(k) + 1]);
  if (argv.includes('--apply')) o.apply = true;
  if (argv.includes('--json')) o.json = true;
  if (argv.includes('--watch')) { const n = num('--watch'); o.watch = n > 0 ? n : 60; }
  for (const [flag, key] of [['--slots', 'slots'], ['--window', 'windowMin'], ['--threshold', 'threshold'], ['--quiet', 'quietMin'], ['--hold', 'minHoldMin']]) if (argv.includes(flag)) { const n = num(flag); if (n > 0) o.opts[key] = n; }
  return o;
}
async function main() {
  const a = args(process.argv.slice(2)), token = process.env.CF_API_TOKEN, zone = process.env.CF_ZONE_ID;
  if (!token || !zone) { console.error('Set CF_API_TOKEN and CF_ZONE_ID (see the header of scripts/scan-guard.mjs and docs/CLOUDFLARE_SETUP.md, Part J).'); process.exit(2); }
  const allow = (process.env.SCAN_GUARD_ALLOW || '').split(',').map(s => s.trim()).filter(Boolean), cf = cloudflare({ token, zone });
  const once = async () => {
    const t = new Date().toISOString().slice(11, 19), r = await run({ cf, apply: a.apply, allow, opts: a.opts, log: console.error });
    if (a.json) { console.log(JSON.stringify({ at: new Date().toISOString(), apply: a.apply, held: r.held, truncated: r.truncated, actions: r.acts })); return; }
    const top = [...r.scored].sort((x, y) => y[1].score - x[1].score).slice(0, 3).map(([ip, e]) => `${ip} ${e.score}`).join(', ');
    console.log(`[${t}] ${r.scored.size} IPs with refused requests${top ? ' (highest: ' + top + ')' : ''}; ${r.held} slots in use${a.apply ? '' : ' · DRY RUN, nothing written'}`);
    if (r.truncated) console.log('  note: the analytics answer was cut at 10,000 rows; shorten --window to see everything');
    for (const x of r.acts) console.log('  ' + describeAct(x) + (x.error ? '  [FAILED]' : ''));
  };
  await once();
  while (a.watch) { await new Promise(r => setTimeout(r, a.watch * 1000)); try { await once(); } catch (e) { console.error('run failed: ' + e.message); } }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.error(e.message); process.exit(1); });
