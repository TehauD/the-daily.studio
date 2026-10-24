#!/usr/bin/env node
/* Release gate for the deployable folder. Run after `npm run build:site`:  npm run verify:site
   Fails (exit 1) if anything a visitor depends on is missing or the security posture drifted. */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), d = join(root, 'dist');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const rd = f => readFileSync(join(d, f), 'utf8');
for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', '404.html', 'robots.txt', 'sitemap.xml', '_headers', 'journal/index.html', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.svg', 'icons/social-card.png'])
  ok(existsSync(join(d, f)), 'present: ' + f);
ok(!existsSync(join(d, 'CNAME')), 'no GitHub Pages CNAME in the deploy folder');
const html = rd('index.html'), hdr = rd('_headers');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(x => x[1]);
const inline = scripts.sort((a, b) => b.length - a.length)[0] || '';
const hash = "'sha256-" + createHash('sha256').update(inline).digest('base64') + "'";
const meta = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
ok(meta.includes(hash), 'CSP meta hash matches the shipped inline script');
ok(hdr.includes(meta.trim().replace(/;$/, '')), 'CSP header carries the same policy as the meta tag');
ok(/frame-ancestors 'none'/.test(hdr) && /X-Frame-Options: DENY/.test(hdr), 'framing is denied');
ok(/Strict-Transport-Security/.test(hdr) && /nosniff/.test(hdr) && /Referrer-Policy: no-referrer/.test(hdr), 'HSTS, nosniff and referrer policy are set');
ok(!/'unsafe-eval'/.test(meta) && !/script-src[^;]*'unsafe-inline'/.test(meta), 'script-src allows no unsafe-eval or unsafe-inline');
ok(/object-src 'none'/.test(meta) && /base-uri 'none'/.test(meta) && /form-action 'none'/.test(meta), 'object, base and form targets are locked');
const hosts = [...new Set((meta.match(/https:\/\/[a-z0-9.-]+/g) || []))].sort();
ok(hosts.join() === 'https://cdn.jsdelivr.net,https://storage.googleapis.com', 'third-party hosts are exactly jsDelivr and Google storage: ' + hosts.join(', '));
const sw = rd('sw.js'), ver = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))).version;
ok(sw.includes('daily-songs-' + ver), 'service worker cache name matches package version ' + ver);
const man = JSON.parse(rd('manifest.webmanifest')); ok(man.name && man.start_url && man.icons.length >= 3, 'manifest has name, start_url and icons');
ok(!/fretwork/i.test(rd('manifest.webmanifest') + rd('404.html')), 'no old product name in manifest or 404 page');
const j = rd('journal/index.html'); ok(/Content-Security-Policy/.test(j), 'The Daily page keeps its own CSP');
ok(statSync(join(d, 'index.html')).size < 2_000_000, 'index.html is under 2 MB');
console.log(bad ? `\n${bad} check(s) failed` : '\nsite verified'); process.exit(bad ? 1 : 0);
