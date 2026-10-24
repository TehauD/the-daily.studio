#!/usr/bin/env node
/* Builds the app, then copies exactly the files a static host should serve into ./dist (used by Cloudflare Workers Builds).
     npm run build:site */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), out = join(root, 'dist');
execFileSync(process.execPath, [join(root, 'scripts', 'build.mjs')], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(join(out, 'journal'), { recursive: true });
for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'robots.txt', 'sitemap.xml', '404.html']) cpSync(join(root, f), join(out, f));
cpSync(join(root, 'icons'), join(out, 'icons'), { recursive: true });
if (existsSync(join(root, 'samples'))) cpSync(join(root, 'samples'), join(out, 'samples'), { recursive: true });
cpSync(join(root, 'journal', 'index.html'), join(out, 'journal', 'index.html'));
/* Response headers (Cloudflare _headers). The studio page gets the same policy as its <meta> CSP plus frame-ancestors, which only works as a header.
   The CSP is scoped to the studio page only: /journal/ carries its own policy in its own <meta>, and headers from several matching rules are combined. */
const html = readFileSync(join(root, 'index.html'), 'utf8'), m = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
if (!m) throw new Error('index.html has no Content-Security-Policy meta; refusing to build a site without one');
const csp = m[1].trim().replace(/;$/, '') + "; frame-ancestors 'none'";
const common = `  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Strict-Transport-Security: max-age=31536000
  Cross-Origin-Opener-Policy: same-origin
  Permissions-Policy: microphone=(self), camera=(self), midi=(self), geolocation=(), payment=(), usb=(), serial=()`;
writeFileSync(join(out, '_headers'), `/*
${common}
/
  Content-Security-Policy: ${csp}
  Cache-Control: no-cache
/index.html
  Content-Security-Policy: ${csp}
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
/manifest.webmanifest
  Cache-Control: no-cache
/journal/*
  Cache-Control: no-cache
/icons/*
  Cache-Control: public, max-age=86400
`);
console.log('dist/ ready');
