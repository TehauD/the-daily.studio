#!/usr/bin/env node
/* Release gate for the deployable folder. Run after `npm run build:site`:  npm run verify:site
   Fails (exit 1) if anything a visitor depends on is missing or the security posture drifted. */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, SITE, pageUrl } from './seo-pages.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), d = join(root, 'dist');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const rd = f => readFileSync(join(d, f), 'utf8');
for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', '404.html', 'robots.txt', 'sitemap.xml', '_headers', 'journal/index.html', 'legal/index.html', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.svg', 'icons/social-card.png'])
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
ok(hosts.join() === 'https://api.github.com,https://cdn.jsdelivr.net,https://storage.googleapis.com', 'third-party hosts are exactly GitHub’s API (only if you connect it or open the gallery), jsDelivr and Google storage (only after a yes): ' + hosts.join(', '));
ok(!/cdn\.jsdelivr\.net[ ;'"]/.test(meta) && /https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@\d+\.\d+\.\d+\/[ ;]/.test(meta), 'jsDelivr is allowed only for the camera library’s own folder, not every package it serves (2.49.2)');
{ const nf = rd('404.html'); ok(/http-equiv="Content-Security-Policy" content="default-src 'none'[^"]*script-src 'none'/.test(nf) || /http-equiv="Content-Security-Policy" content="default-src 'none'/.test(nf) && !/script-src/.test(nf.match(/Content-Security-Policy" content="([^"]+)/)[1]), 'the not-found page has a policy that runs no script, so nothing added to it on the way can run (2.49.2)'); }
{ const st = existsSync(join(d, '.well-known', 'security.txt')) ? rd('.well-known/security.txt') : ''; ok(/^Contact: https:\/\//m.test(st) && /^Expires: \d{4}-\d\d-\d\dT/m.test(st) && new Date(st.match(/^Expires: (.+)$/m)[1]) > new Date(), '/.well-known/security.txt says how to report a security problem and has not expired'); }
const sw = rd('sw.js'), ver = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))).version;
ok(sw.includes('daily-songs-' + ver), 'service worker cache name matches package version ' + ver);
const man = JSON.parse(rd('manifest.webmanifest')); ok(man.name && man.start_url && man.icons.length >= 3, 'manifest has name, start_url and icons');
ok(!/fretwork/i.test(rd('manifest.webmanifest') + rd('404.html')), 'no old product name in manifest or 404 page');
const j = rd('journal/index.html'); ok(/Content-Security-Policy/.test(j), 'The Daily page keeps its own CSP');
/* 2.50: The Daily has its own address; the pages that move a journal there each allow only their own script */
for (const f of ['journal/moving.html', 'journal/move.html']) { const t = existsSync(join(d, f)) ? rd(f) : '', sc = (t.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || '', pol = (t.match(/Content-Security-Policy" content="([^"]+)/) || [])[1] || '';
  ok(sc && pol.includes("script-src 'sha256-" + createHash('sha256').update(sc).digest('base64') + "'") && /default-src 'none'/.test(pol) && !/__SCRIPT_HASH__/.test(t), f + ': present, and its policy allows only its own script'); }
/* 2.53.1: nothing private is deployed or committed */
{ const all = []; const walk = dir => readdirSync(join(d, dir), { withFileTypes: true }).forEach(e => { const rel = dir ? dir + '/' + e.name : e.name; if (e.isDirectory()) walk(rel); else all.push(rel); }); walk('');
  const bad = all.filter(f => /(^|\/)\.(?!well-known\/|assetsignore$)/.test(f) || /(^|\/)(\.env[^/]*|\.dev\.vars[^/]*|package(-lock)?\.json|wrangler\.[a-z]+|[^/]+\.(pem|key|p12))$/.test(f) || /(^|\/)(node_modules|\.git|\.wrangler)\//.test(f));
  ok(!bad.length, 'the deployed folder holds no dotfiles (but .well-known), no .env or .dev.vars, no keys, no package or Wrangler files' + (bad.length ? ': ' + bad.slice(0, 5).join(', ') : ' (' + all.length + ' files)'));
  ok(/^\.env$/m.test(rd('.assetsignore')) && /^\.git$/m.test(rd('.assetsignore')), 'and .assetsignore tells Cloudflare never to upload them'); }
{ let tracked = []; try { tracked = execFileSync('git', ['ls-files'], { cwd: join(d, '..'), encoding: 'utf8' }).split('\n'); } catch (e) { tracked = null; }
  if (tracked) { const bad = tracked.filter(f => /(^|\/)(\.env(\.[^/]*)?|\.dev\.vars[^/]*|[^/]+\.(pem|key|p12))$/.test(f) || /^\.wrangler\//.test(f)); ok(!bad.length, 'no .env, .dev.vars, key or Wrangler cache file is committed' + (bad.length ? ': ' + bad.join(', ') : '')); } }
{ const cl = rd('../CHANGELOG.md').split('\n'), bare = cl.filter(l => /^\d{4}-\d{2}-\d{2} — /.test(l)), top = (cl.find(l => /^## \d/.test(l)) || '').match(/^## (\d+\.\d+\.\d+)/);
  ok(!bare.length && top && top[1] === JSON.parse(rd('../package.json')).version, 'every CHANGELOG release heading has its version, and the newest is package.json\'s' + (bare.length ? ': ' + bare[0].slice(0, 50) : '')); }
const wr = rd('../wrangler.jsonc');
ok(/"binding":\s*"SHARES"/.test(wr), 'the Worker has its bucket for shared recordings (SHARES)');
ok(/"\/share\/\*"/.test(wr) && /\(journal\|api\|auth\|share\)/.test(rd('sw.js')), 'shared recordings (2.54) go through the Worker, and the service worker never caches them'); ok(/"workers_dev":\s*false/.test(wr) && /"preview_urls":\s*false/.test(wr), 'the site is served only at its own addresses: no workers.dev copy, no preview addresses');
ok(!/document\.cookie/.test(rd('index.html')) && !/document\.cookie/.test(j), 'neither the studio nor The Daily uses cookies, so nothing is shared between their two addresses');
ok(!/\/journal\//.test(rd('sitemap.xml')), 'the sitemap no longer lists /journal/ (The Daily has its own address)');
ok(statSync(join(d, 'index.html')).size < 2_000_000, 'index.html is under 2 MB');
{ /* what a visitor downloads: the page travels compressed, so this is the number that sets the first load. Raise it on purpose, not by drift. */
  const gz = gzipSync(readFileSync(join(d, 'index.html')), { level: 9 }).length;
  /* 2.37.0 crossed 700 kB and raised this to 750; 2.37.1 dropped the line breaks the minifier can safely drop and came back under, so 700 again.
     2.40 moved the fonts to files and the rarely used parts into rooms (scripts/rooms.mjs): about 580 kB. A big new feature belongs in a room. */
  ok(gz < 700_000, 'index.html is under 700 kB compressed (' + (gz / 1024).toFixed(0) + ' kB gzip)');
  /* a room is loaded when it is used, so it does not count above, but each stays small enough to arrive in a moment */
  let rooms = []; try { rooms = readdirSync(join(d, 'rooms')); } catch { }
  for (const f of rooms) { const g = gzipSync(readFileSync(join(d, 'rooms', f)), { level: 9 }).length; ok(g < 150_000, 'rooms/' + f + ' is under 150 kB compressed (' + (g / 1024).toFixed(0) + ' kB gzip)'); }
}

/* ---- search engines: the first page and every guide page ---- */
const metaOf = (h, n) => (h.match(new RegExp('<meta (?:name|property)="' + n + '" content="([^"]*)"')) || [])[1] || '';
const ldOf = h => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => { try { return JSON.parse(m[1]); } catch { return null; } });
const bodyOf = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
{
  const t = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '', desc = metaOf(html, 'description');
  ok(t.length >= 30 && t.length <= 70, 'first page: title is 30–70 characters (' + t.length + ')');
  ok(desc.length >= 70 && desc.length <= 160, 'first page: description is 70–160 characters (' + desc.length + ')');
  ok(html.includes('<link rel="canonical" href="' + SITE.origin + '/">') && !/noindex/.test(metaOf(html, 'robots')), 'first page: canonical link, and it is indexable');
  ok(['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card', 'twitter:image'].every(k => metaOf(html, k)), 'first page: Open Graph and Twitter card tags are present');
  const ld = ldOf(html), g = ld[0] && ld[0]['@graph'] || [];
  ok(ld.length === 1 && ld[0] && g.some(n => n['@type'] === 'WebApplication' && n.isAccessibleForFree === true && n.featureList.length >= 5) && g.some(n => n['@type'] === 'WebSite'), 'first page: structured data parses and describes a free WebApplication');
  ok((bodyOf(html).match(/<h1[ >]/g) || []).length === 1, 'first page: exactly one <h1>');
  ok(PAGES.filter(p => !p.unlisted).every(p => html.includes('href="guide/' + (p.slug === 'guide' ? '' : p.slug + '/') + '"')), 'first page: links to every listed guide page (crawlable)');
  ok(PAGES.filter(p => p.unlisted).every(p => !new RegExp('href="[^"]*guide/' + p.slug).test(html)) && html.includes('<link rel="alternate" type="text/plain" href="llms.txt"'), 'first page: the page for AI assistants is not linked anywhere a person looks; the head points assistants to llms.txt');
  ok(/<noscript>[\s\S]*guide\/[\s\S]*<\/noscript>/.test(html), 'first page: the no-JavaScript text carries the guide links');
}
const urls = [], known = new Set();
for (const p of PAGES) {
  const rel = 'guide/' + (p.slug === 'guide' ? '' : p.slug + '/') + 'index.html', here = posix.dirname(rel), name = 'guide page ' + p.slug + ': ';
  if (!existsSync(join(d, rel))) { ok(false, name + 'present'); continue; }
  const h = rd(rel), t = (h.match(/<title>([^<]*)<\/title>/) || [])[1] || '', desc = metaOf(h, 'description'), b = bodyOf(h), url = pageUrl(p); urls.push(url); known.add(t);
  ok(t.length >= 25 && t.length <= 72 && !/&amp;amp;/.test(t), name + 'title is 25–72 characters (' + t.length + ')');
  ok(desc.length >= 70 && desc.length <= 160, name + 'description is 70–160 characters (' + desc.length + ')');
  ok(h.includes('<link rel="canonical" href="' + url + '">') && metaOf(h, 'og:url') === url, name + 'canonical and og:url are ' + url);
  ok((b.match(/<h1[ >]/g) || []).length === 1 && (b.match(/<h2[ >]/g) || []).length >= 2, name + 'one <h1> and at least two <h2>');
  ok((b.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length) >= 280, name + 'has real text (280+ words)');
  const ld = ldOf(h); ok(ld.length === 1 && ld[0] && ld[0]['@graph'].some(n => [].concat(n['@type']).includes('WebPage')) && ld[0]['@graph'].some(n => n['@type'] === 'BreadcrumbList') && (!p.faq || ld[0]['@graph'].some(n => n['@type'] === 'FAQPage' && n.mainEntity.length === p.faq.length)), name + 'structured data parses (page, breadcrumbs' + (p.faq ? ', FAQ' : '') + ')');
  if (p.about) ok(ld[0]['@graph'].some(n => [].concat(n['@type']).includes('AboutPage')) && ld[0]['@graph'].some(n => n['@type'] === 'Person' && Array.isArray(n.sameAs) && n.sameAs.some(u => /linkedin\.com\/in\//.test(u)) && n.sameAs.some(u => /github\.com\//.test(u))), name + 'it is an About page, and names the author with their LinkedIn and GitHub (2.53)');
  ok(p.faq ? p.faq.every(([q]) => b.includes(q.replace(/&/g, '&amp;'))) : true, name + 'every FAQ question in the data is visible on the page');
  ok(!/<script[^>]+\bsrc=/i.test(h) && !/<img(?![^>]*\balt="[^"]+")/i.test(h) && !/<img(?![^>]*\bwidth=)/i.test(h), name + 'no external script; every image has alt text and a size');
  const bad2 = [...h.matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)].map(m => m[1]).filter(u => !/^(https?:|mailto:|data:)/.test(u)).filter(u => { const f = posix.normalize(posix.join(here, u)); const g = f.endsWith('/') ? f + 'index.html' : f; return !existsSync(join(d, g)); });
  ok(!bad2.length, name + 'every local link and picture exists' + (bad2.length ? ': ' + bad2.join(', ') : ''));
}
ok(known.size === PAGES.length, 'every guide page has its own title');
{
  const ll = existsSync(join(d, 'llms.txt')) ? rd('llms.txt') : '', ag = rd('../docs/AGENT_API.md'), names = [...((ag.split(/^## The tools/m)[1] || '').split(/^## /m)[0]).matchAll(/^\| `([a-z_]+)` \| [^|]+ \| [^|]+ \|$/gm)].map(m => m[1]);
  ok(/^# the-daily\.studio\n\n> /.test(ll) && names.length >= 20 && names.every(n => ll.includes('- ' + n + ' (')) && ll.includes(SITE.origin + '/guide/for-ai-assistants/'), 'llms.txt: a title, a summary, every agent tool (' + names.length + ') and the page for assistants');
  ok(!/^- open_shower_mode \(/m.test(ll), 'llms.txt: a renamed tool is not listed as a tool');
  const others = PAGES.filter(p => p.slug !== 'guide' && !p.unlisted).map(p => rd('guide/' + p.slug + '/index.html')).concat(rd('guide/index.html'));
  ok(others.every(h => !/href="[^"]*for-ai-assistants/.test(h)), 'no listed guide page links to the page for AI assistants');
}
{
  const sm = rd('sitemap.xml'), locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  ok([SITE.origin + '/', ...urls].every(u => locs.includes(u)), 'sitemap.xml lists the first page and every guide page');
  ok(locs.every(u => { const f = u.replace(SITE.origin, '').replace(/^\//, ''); return existsSync(join(d, f ? (f.endsWith('/') ? f + 'index.html' : f) : 'index.html')); }), 'every sitemap address exists in the site');
  /* robots.txt groups: consecutive User-agent lines share the rules under them */
  const robots = rd('robots.txt'), groups = []; let g = null, rules = false;
  robots.split('\n').map(l => l.replace(/#.*/, '').trim()).filter(Boolean).forEach(l => { const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(l); if (!m) return; const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { if (!g || rules) { g = { ua: [], dis: [] }; groups.push(g); rules = false; } g.ua.push(v.toLowerCase()); } else if (g && (k === 'disallow' || k === 'allow')) { rules = true; if (k === 'disallow' && v) g.dis.push(v); } });
  const blocked = ua => { const gr = groups.find(x => x.ua.includes(ua.toLowerCase())) || groups.find(x => x.ua.includes('*')); return !!gr && gr.dis.includes('/'); };
  ok(/Sitemap: https:\/\/the-daily\.studio\/sitemap\.xml/.test(robots) && !blocked('*') && !blocked('Googlebot') && !blocked('Bingbot'), 'robots.txt allows crawling and points to the sitemap');
  ok(['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot'].every(u => !blocked(u)), 'robots.txt lets AI search and answer bots in');
  ok(['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot', 'Applebot-Extended', 'Meta-ExternalAgent'].every(blocked), 'robots.txt turns AI training crawlers away');
}
console.log(bad ? `\n${bad} check(s) failed` : '\nsite verified'); process.exit(bad ? 1 : 0);
