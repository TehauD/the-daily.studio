/* the-daily.studio · a bounded, non-destructive tax on scanner/bot probes (2.69)
   Automated bots sweep the web for a short list of well-known paths — WordPress logins, .env files, an exposed
   .git folder, phpMyAdmin — hoping a site happens to be built from one of those stacks. This one is not: none
   of those paths, or anything behind them, exist here. There is no legitimate reason for a real visitor to ever
   request one, so unlike the rest of the site (where the Worker runs only where it has real work to do, keeping
   Worker invocations to one per genuine visit), these few paths are deliberately routed into the Worker too
   (wrangler.jsonc's run_worker_first), so this file can answer them on purpose rather than let them fall straight
   through to the asset binding's instant 404.
     What it does: holds the connection open for a few seconds, trickling out a handful of bytes, before answering
   with the same empty 404 the path would always have gotten. That costs a scanner real wall-clock time and a held
   socket for nothing — for the kind of simple, single-threaded scanner this is aimed at, worth tying up on a dead
   end rather than letting it move straight to the next target. A scanner built to disconnect the moment it sees
   the status line will still get out quickly; this does not claim otherwise.
     What it will never do: no decompression bomb, zip bomb, or anything that amplifies what one request costs to
   answer. The total body is a few bytes, the same handful of bytes repeated, never decoded or inflated into
   anything larger; the total wait is capped; and the cost to this Worker is a few seconds of one invocation,
   wall-clock only (await, not CPU) — never more, however many scanners hit it. For real protection, Cloudflare's
   own free Bot Fight Mode / WAF managed rules and the Custom Rule in CLOUDFLARE_SETUP.md do far more than any one
   path list could; this is a small, honest extra that lives in the code, not a replacement for them.
     2.69.1: after a few hits from the same IP inside an hour, that IP is added to the zone's IP Access Rules — a
   real block, not just a tarpit, for whoever keeps coming back. This is off until the site owner sets it up
   (docs/CLOUDFLARE_SETUP.md, Part I: a KV namespace bound as HONEY_KV, and CF_API_TOKEN / CF_ZONE_ID as Worker
   secrets); without them the tally is skipped and the tarpit behaves exactly as it did before. A single hit
   never blocks anyone — a shared IP (a works VPN, a phone carrier's NAT, a WARP exit) could otherwise lock out
   people who never requested any of these paths; a real scanner clears the small threshold in seconds regardless.
   The tally and the block call are both best-effort: neither can fail the response the visitor gets. */

/* exact paths that have no business existing on a static, from-scratch site like this one */
const PATHS = new Set([
  '/.env', '/.env.local', '/.env.production', '/.env.development', '/.env.bak',
  '/.git/config', '/.git/HEAD',
  '/wp-login.php', '/xmlrpc.php',
  '/.aws/credentials', '/.docker/config.json', '/.vscode/sftp.json',
  '/config.php', '/configuration.php', '/admin.php', '/.htaccess', '/.htpasswd',
  '/id_rsa', '/id_rsa.pub',
]);
/* folders that only exist on WordPress / PHP / exposed-tooling sites — none of them exist here either */
const PREFIXES = ['/wp-admin/', '/wp-content/', '/phpmyadmin/', '/phpMyAdmin/', '/.git/', '/.aws/', '/.vscode/', '/.docker/'];

/** true for a path on the short, well-known scanner-bait list above (case-insensitive) */
export function isHoneyPath(pathname) {
  const p = String(pathname || '').toLowerCase();
  return PATHS.has(p) || PREFIXES.some(x => p.startsWith(x));
}

const BLOCK_AFTER = 3;      /* repeat hits from the same IP, inside the window, before it is blocked outright */
const WINDOW_SECS = 3600;   /* one hour; the KV key expires on its own, so the count resets without any cleanup */

/** best-effort: count this IP's hits in HONEY_KV and, past BLOCK_AFTER, add it to the zone's IP Access Rules.
    Never throws past itself and never slows or changes the tarpit's response — a failure here (no KV bound, no
    secrets set, the Cloudflare API down) is invisible to whoever is being tarpitted; it just stays a tarpit. */
async function tally(req, env, fetchFn) {
  const ip = req.headers.get('cf-connecting-ip');
  if (!ip || !env.HONEY_KV) return;
  try {
    const key = 'honey:' + ip;
    const n = (parseInt(await env.HONEY_KV.get(key), 10) || 0) + 1;
    await env.HONEY_KV.put(key, String(n), { expirationTtl: WINDOW_SECS });
    if (n === BLOCK_AFTER && env.CF_API_TOKEN && env.CF_ZONE_ID) {
      await fetchFn('https://api.cloudflare.com/client/v4/zones/' + env.CF_ZONE_ID + '/firewall/access_rules/rules', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env.CF_API_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'block', configuration: { target: 'ip', value: ip }, notes: 'honeypot: repeat scanner probes (auto, ' + new Date().toISOString().slice(0, 10) + ')' }),
      });
    }
  } catch (e) { /* best-effort only; see the note above */ }
}

const DOT = new Uint8Array([0x2e]);      /* one byte per chunk; five chunks, five bytes, never more */
/** the same empty 404 this path would always have gotten, trickled out over a few seconds instead of answered at once */
export async function honeypot(req, u, env, fetchFn, sleepFn) {
  console.log('honeypot:', req.method, u.pathname);
  await tally(req, env, fetchFn);
  const chunks = 5;
  const body = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < chunks; i++) { await sleepFn(800 + Math.floor(Math.random() * 700)); controller.enqueue(DOT); }
      controller.close();
    },
  });
  return new Response(body, { status: 404, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' } });
}
