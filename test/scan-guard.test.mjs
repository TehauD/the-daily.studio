/* scripts/scan-guard.mjs: scoring by endpoint, the five rotating slots, and the Cloudflare calls, with Cloudflare stood in for.
   No network. Run: node test/scan-guard.test.mjs */
import { scoreRows, pathWeight, familyOf, targetOf, plan, run, cloudflare, parseRule, describe, DEFAULTS, PREFIX } from '../scripts/scan-guard.mjs';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const MIN = 60e3, NOW = Date.parse('2026-11-21T14:00:00Z');
const rows = (ip, paths, status = 404) => paths.map(p => ({ ip, path: p, status, count: 1 }));
const SCAN = ['/.env', '/wp-login.php', '/.git/config', '/phpmyadmin/', '/xmlrpc.php', '/.aws/credentials'];   /* six pieces of bait */

/* what an endpoint says */
ok(pathWeight('/.env') === 5 && pathWeight('/wp-login.php') === 5, 'the Worker’s own bait list counts as the strongest signal');
ok(pathWeight('/cgi-bin/luci') === 3 && pathWeight('/actuator/health') === 3 && pathWeight('/backup.zip') === 3 && pathWeight('/admin/') === 3, 'other well-known probe kinds are a middling signal');
ok(pathWeight('/some/old/page') === 1 && pathWeight('/favicon.ico') === 0 && pathWeight('/robots.txt') === 0 && pathWeight('/.well-known/x') === 0, 'an ordinary miss is a little, the usual browser asks are nothing');
ok(familyOf('/wp-content/x.php') === 'wordpress' && familyOf('/.git/HEAD') === 'git/svn' && familyOf('/.env.bak') === 'secrets' && familyOf('/about') === null, 'paths are named by the kind of endpoint they aim at');

/* a person against a scanner */
const person = scoreRows([...rows('198.51.100.7', ['/old-link', '/sw-old.js']), { ip: '198.51.100.7', path: '/', status: 404, count: 30 }]);
ok(person.get('198.51.100.7').score < DEFAULTS.threshold, 'a stale bookmark or two, even asked for many times, is nowhere near the threshold (' + person.get('198.51.100.7').score + ')');
const sc = scoreRows(rows('203.0.113.5', SCAN)).get('203.0.113.5');
ok(sc.score >= DEFAULTS.threshold && sc.families.wordpress === 2 && sc.families.secrets >= 2, 'a visitor who tries six bait paths is a scanner, and the report says which kinds (' + sc.score + ': ' + JSON.stringify(sc.families) + ')');
const guesser = scoreRows(rows('203.0.113.9', Array.from({ length: 30 }, (_, i) => '/guess-' + i))).get('203.0.113.9');
ok(guesser.score >= DEFAULTS.threshold, 'thirty different guesses that all missed is a crawler too (' + guesser.score + ')');
const hammer = scoreRows([{ ip: '203.0.113.11', path: '/missing.js', status: 404, count: 5000 }]).get('203.0.113.11');
ok(hammer.score < DEFAULTS.threshold, 'one broken path asked for thousands of times is not a scan');
ok(scoreRows(rows('203.0.113.12', ['/.env', '/.env'])).get('203.0.113.12').score === 5, 'the same path twice counts once');

/* the unit that is blocked */
ok(targetOf('203.0.113.5').expr === 'ip.src eq 203.0.113.5', 'an IPv4 address is blocked by itself');
ok(targetOf('2001:db8:1:2:3:4:5:6').expr === 'ip.src in {2001:db8:1:2::/64}' && targetOf('2001:db8::1').key === '2001:db8:0:0::/64', 'an IPv6 address is blocked as its /64');
ok(targetOf('nonsense') === null, 'something that is not an address is never turned into a rule');

/* the slots */
const slot = (ip, minsAgo, seenAgo = minsAgo) => ({ id: 'r-' + ip, ip, since: NOW - minsAgo * MIN, seen: NOW - seenAgo * MIN, score: 30 });
const scan = (ip, n = 6) => scoreRows(rows(ip, SCAN.slice(0, n)));
const merge = (...ms) => new Map(ms.flatMap(m => [...m]));
let acts = plan({ existing: [], scored: merge(scan('203.0.113.5'), person), now: NOW });
ok(acts.length === 1 && acts[0].type === 'add' && acts[0].ip === '203.0.113.5', 'a scanner is blocked and a person is not');
acts = plan({ existing: [], scored: scan('203.0.113.5'), now: NOW, allow: ['203.0.113.5'] });
ok(acts.length === 0, 'an address on the allow list is never blocked');
acts = plan({ existing: [slot('203.0.113.5', 5)], scored: scan('203.0.113.5'), now: NOW });
ok(acts.every(a => a.type !== 'add'), 'an address that already holds a slot is not added again');
acts = plan({ existing: [], scored: merge(...[1, 2, 3, 4, 5, 6, 7].map(i => scan('203.0.113.' + (20 + i)))), now: NOW });
ok(acts.filter(a => a.type === 'add').length === 5 && acts.filter(a => a.type === 'wait').length === 2, 'seven at once: five get a slot, two wait (' + acts.map(a => a.type).join(',') + ')');
const full = [1, 2, 3, 4, 5].map(i => slot('198.51.100.' + i, 30));
acts = plan({ existing: full, scored: scan('203.0.113.99'), now: NOW });
ok(acts.length === 1 && acts[0].type === 'replace' && /quiet/.test(acts[0].reason), 'slots full of quiet blocks: the newest scanner takes the quietest slot');
const fullActive = full.map(r => r.ip);
acts = plan({ existing: full, scored: merge(scan('203.0.113.99'), ...fullActive.map(ip => scan(ip))), now: NOW });
ok(!acts.some(a => a.type === 'replace') && acts.some(a => a.type === 'wait'), 'slots full of scanners still at it: a newcomer of the same weight waits, nobody is swapped out');
const heavy = scoreRows(rows('203.0.113.99', [...SCAN, ...Array.from({ length: 20 }, (_, i) => '/g' + i)]));
acts = plan({ existing: full, scored: merge(heavy, ...fullActive.map(ip => scan(ip))), now: NOW });
ok(acts.some(a => a.type === 'replace' && a.ip === '203.0.113.99'), 'a far worse newcomer does take a slot from a lesser scanner (' + heavy.get('203.0.113.99').score + ' vs ' + scan('x').get('x').score + ')');
acts = plan({ existing: full.map(r => ({ ...r, since: NOW - 3 * MIN, seen: NOW - 3 * MIN })), scored: scan('203.0.113.99'), now: NOW });
ok(acts.length === 1 && acts[0].type === 'wait' && /last 10 min/.test(acts[0].reason), 'a block younger than the minimum hold is not taken over (no thrashing)');
acts = plan({ existing: [slot('198.51.100.1', 200)], scored: new Map(), now: NOW });
ok(acts.length === 1 && acts[0].type === 'release', 'a block that has been quiet for an hour is released');
acts = plan({ existing: [slot('198.51.100.1', 200, 20)], scored: new Map(), now: NOW });
ok(acts.length === 0, 'but not if it asked for something 20 minutes ago');
acts = plan({ existing: [slot('198.51.100.1', 200, 20)], scored: scan('198.51.100.1'), now: NOW });
ok(acts.length === 1 && acts[0].type === 'refresh', 'a blocked address that keeps trying keeps its slot (and its last-seen time is refreshed)');
acts = plan({ existing: [], scored: merge(scan('203.0.113.5'), scan('203.0.113.6')), now: NOW, opts: { slots: 1 } });
ok(acts.filter(a => a.type === 'add').length === 1 && acts.filter(a => a.type === 'wait').length === 1, 'the slot count can be lowered (when another custom rule needs one of the five)');

/* the rule is the memory */
const d = describe('203.0.113.5', '2026-11-21T14:00:00Z', '2026-11-21T14:05:00Z', 37, 'wordpress×2_secrets×3');
const pr = parseRule({ id: 'x', description: d });
ok(pr && pr.ip === '203.0.113.5' && pr.score === 37 && pr.since === Date.parse('2026-11-21T14:00:00Z') && pr.seen > pr.since, 'what a slot holds is written in its description and read back');
ok(parseRule({ id: 'y', description: 'honeypot-block' }) === null && parseRule({ id: 'z' }) === null, 'a rule that is not one of ours is never read as a slot');

/* Cloudflare, stood in for: custom rules (ours and one that is not), analytics */
function fakeCF(initial, analyticsRows) {
  const st = { rules: initial.slice(), log: [], n: 0, hasRuleset: true };
  const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = async (url, init) => {
    const u = new URL(url), m = init.method, body = init.body ? JSON.parse(init.body) : null;
    st.log.push(m + ' ' + u.pathname.replace(/\/zones\/[^/]+/, '/zones/Z') + (body && body.expression ? ' ' + body.expression : ''));
    if (init.headers.Authorization !== 'Bearer T') return respond({ success: false, errors: [{ message: 'bad token' }] }, 403);
    if (u.pathname === '/client/v4/graphql') return respond({ data: { viewer: { zones: [{ httpRequestsAdaptiveGroups: analyticsRows.map(r => ({ count: r.count, dimensions: { clientIP: r.ip, clientRequestPath: r.path, edgeResponseStatus: r.status } })) }] } }, errors: null });
    if (m === 'GET') return st.hasRuleset ? respond({ success: true, result: { id: 'RS', rules: st.rules } }) : respond({ success: false, errors: [{ message: 'no ruleset' }] }, 404);
    if (m === 'PUT') { st.hasRuleset = true; st.rules = body.rules.map(r => ({ ...r, id: 'n' + ++st.n })); return respond({ success: true, result: { id: 'RS', rules: st.rules } }); }
    if (m === 'POST') { const r = { ...body, id: 'n' + ++st.n }; st.rules.push(r); return respond({ success: true, result: r }); }
    const id = u.pathname.split('/').pop(), i = st.rules.findIndex(r => r.id === id);
    if (i < 0) return respond({ success: false, errors: [{ message: 'no such rule' }] }, 404);
    if (m === 'PATCH') { st.rules[i] = { ...st.rules[i], ...body }; return respond({ success: true, result: st.rules[i] }); }
    if (m === 'DELETE') { st.rules.splice(i, 1); return respond({ success: true, result: {} }); }
    return respond({ success: false, errors: [{ message: 'unexpected' }] }, 400);
  };
  return { st, cf: cloudflare({ token: 'T', zone: 'Z', fetchFn }) };
}
const other = { id: 'honey', action: 'block', expression: 'lower(http.request.uri.path) in {"/.env"}', description: 'honeypot-block', enabled: true };
const traffic = [...rows('203.0.113.5', SCAN), ...rows('203.0.113.6', SCAN), ...rows('198.51.100.7', ['/old-link'])];

let f = fakeCF([other], traffic);
let r = await run({ cf: f.cf, now: NOW, apply: false });
ok(r.acts.filter(a => a.type === 'add').length === 2 && f.st.log.every(l => !/^(POST|PUT|PATCH|DELETE) \/client\/v4\/zones/.test(l)) && f.st.rules.length === 1, 'dry run reads and plans, and writes nothing');
f = fakeCF([other], traffic);
r = await run({ cf: f.cf, now: NOW, apply: true });
const mine = f.st.rules.map(parseRule).filter(Boolean);
ok(mine.length === 2 && f.st.rules.length === 3 && f.st.rules.includes(other) && f.st.rules.find(x => x.id === 'honey').expression === other.expression, 'apply makes one rule per scanner and leaves the rule that is not ours exactly as it was');
ok(f.st.rules.filter(x => x.id !== 'honey').every(x => x.action === 'block' && x.enabled && /^ip\.src eq 203\.0\.113\.[56]$/.test(x.expression) && x.description.startsWith(PREFIX)), 'each is a block rule for exactly one address');
/* a second pass, the same traffic: nothing new, nothing duplicated */
r = await run({ cf: f.cf, now: NOW + 2 * MIN, apply: true, ...{ opts: {} } });
ok(f.st.rules.length === 3 && r.acts.every(a => a.type === 'refresh' ? false : true), 'running again on the same traffic changes nothing');
/* later: they went quiet, a new scanner arrives, the slots are reused */
const f2 = fakeCF(f.st.rules, rows('203.0.113.77', SCAN));
r = await run({ cf: f2.cf, now: NOW + 90 * MIN, apply: true, opts: { slots: 2 } });
const after = f2.st.rules.map(parseRule).filter(Boolean);
ok(after.length === 1 && after[0].ip === '203.0.113.77' && f2.st.rules.some(x => x.id === 'honey'), 'an hour on: the quiet blocks are released, the new scanner holds a slot, the other custom rule is untouched');
/* no ruleset yet: it is created */
const f3 = fakeCF([], rows('203.0.113.5', SCAN)); f3.st.hasRuleset = false;
r = await run({ cf: f3.cf, now: NOW, apply: true });
ok(f3.st.log.some(l => l.startsWith('PUT ')) && f3.st.rules.length === 1 && f3.st.rules[0].expression === 'ip.src eq 203.0.113.5', 'with no custom ruleset yet, the first block creates it');
/* a slot being reused is patched, not recreated */
const f4 = fakeCF([{ id: 'old', action: 'block', enabled: true, expression: 'ip.src eq 198.51.100.1', description: describe('198.51.100.1', '2026-11-21T13:00:00Z', '2026-11-21T13:40:00Z', 30, 'x') }, ...[2, 3, 4, 5].map(i => ({ id: 'o' + i, action: 'block', enabled: true, expression: 'ip.src eq 198.51.100.' + i, description: describe('198.51.100.' + i, '2026-11-21T13:50:00Z', '2026-11-21T13:55:00Z', 30, 'x') }))], rows('203.0.113.99', SCAN));
r = await run({ cf: f4.cf, now: NOW, apply: true });
ok(f4.st.rules.length === 5 && f4.st.log.some(l => l.startsWith('PATCH ') && /203\.0\.113\.99/.test(l)) && !f4.st.log.some(l => /^POST \/client\/v4\/zones/.test(l)) && f4.st.rules.find(x => x.id === 'old').expression === 'ip.src eq 203.0.113.99', 'with five slots full, the quietest slot is rewritten in place: still five rules');
/* errors */
const bad = cloudflare({ token: 'WRONG', zone: 'Z', fetchFn: (async (u, i) => new Response(JSON.stringify({ success: false, errors: [{ message: 'bad token' }] }), { status: 403 })) });
let msg = ''; try { await run({ cf: bad, now: NOW }); } catch (e) { msg = e.message; }
ok(/403/.test(msg) && /bad token/.test(msg) && !/WRONG/.test(msg), 'a refused token stops the run with a clear message that does not repeat the token');

console.log(fails ? '\n' + fails + ' FAILED' : '\nscan-guard: all checks passed'); process.exit(fails ? 1 : 0);
