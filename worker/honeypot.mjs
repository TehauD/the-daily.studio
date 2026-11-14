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
   path list could; this is a small, honest extra that lives in the code, not a replacement for them. */

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

const DOT = new Uint8Array([0x2e]);      /* one byte per chunk; five chunks, five bytes, never more */
/** the same empty 404 this path would always have gotten, trickled out over a few seconds instead of answered at once */
export function honeypot(req, u, sleepFn) {
  console.log('honeypot:', req.method, u.pathname);
  const chunks = 5;
  const body = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < chunks; i++) { await sleepFn(800 + Math.floor(Math.random() * 700)); controller.enqueue(DOT); }
      controller.close();
    },
  });
  return new Response(body, { status: 404, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' } });
}
