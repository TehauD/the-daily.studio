#!/usr/bin/env node
/* Release gate for the deployable folder. Run after `npm run build:site`:  npm run verify:site
   Fails (exit 1) if anything a visitor depends on is missing or the security posture drifted. */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, SITE, PERSON, pageUrl } from './seo-pages.mjs';
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
ok(['/', '/index.html', '/journal/*', '/legal/*', '/guide/*', '/backstage/*'].every(r => new RegExp('^' + r.replace(/[*/]/g, m => m === '*' ? '\\*' : '\\/') + '\\n(?:  .*\\n)*?  Cache-Control: [^\\n]*no-transform', 'm').test(hdr)), 'the pages are sent with Cache-Control: no-transform (Cloudflare adds no analytics beacon or detection script to them)');
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
ok(statSync(join(d, 'index.html')).size < 2_200_000, 'index.html is under 2.2 MB');      /* 2.83: raised from 2.1 MB for the Voice-Leading Web and the Neural looks (2.82). Moving the visual worlds into rooms would win it back. */
{ /* what a visitor downloads: the page travels compressed, so this is the number that sets the first load. Raise it on purpose, not by drift. */
  const gz = gzipSync(readFileSync(join(d, 'index.html')), { level: 9 }).length;
  /* 2.37.0 crossed 700 kB and raised this to 750; 2.37.1 dropped the line breaks the minifier can safely drop and came back under, so 700 again.
     2.40 moved the fonts to files and the rarely used parts into rooms (scripts/rooms.mjs): about 580 kB. A big new feature belongs in a room. */
  ok(gz < 720_000, 'index.html is under 720 kB compressed (' + (gz / 1024).toFixed(0) + ' kB gzip)');      /* 2.80: raised from 700 for the visual worlds (2.77–2.80); 2.84: from 720 for the agent music tools, Backstage everywhere and the Voice-Leading Web; 2.85: back to 720 after the look worlds moved into a room. */
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
  { /* 2.78: Tehau is the one Person; the homepage, the About page and the product point at the same node */
    const pe = g.filter(n => [].concat(n['@type']).includes('Person')), me = pe[0] || {};
    ok(pe.length === 1 && me['@id'] === PERSON.id && me.name === 'Tehau' && me.alternateName === 'Tehau DeBarthe' && me.image === PERSON.image, 'first page: one Person, ' + PERSON.id + ', named Tehau with the alternate name Tehau DeBarthe and the profile image');
    ok(['github.com/TehauD', 'linkedin.com/in/tehau', 'instagram.com/tehaud'].every(u => (me.sameAs || []).some(x => x.includes(u))), 'first page: the Person lists GitHub, LinkedIn and Instagram (sameAs)');
    ok(g.some(n => n['@type'] === 'WebApplication' && n.author && n.author['@id'] === PERSON.id) && g.some(n => n['@type'] === 'WebSite' && n.publisher && n.publisher['@id'] === PERSON.id), 'first page: the product and the site name Tehau as their author and publisher');
    ok(!g.some(n => n['@id'] && /#author$/.test(n['@id'])), 'first page: no old #author entity is left to conflict with Tehau');
    ok(t.replace(/&amp;/g, '&') === 'the-daily.studio — Free Guitar & Voice Studio by Tehau', 'first page: the title names the creator: ' + t);
    ok(/<p class="boot-made">Made by <a href="guide\/about\/"[^>]*>Tehau<\/a>/.test(html), 'first page: a crawlable "Made by Tehau" line links to the About page');
    ok(/<meta name="author" content="Tehau">/.test(html) && html.includes('<link rel="author" href="' + SITE.authorUrl + '">'), 'first page: the author is Tehau, with a link to the About page'); }
  ok(html.includes('<meta name="msvalidate.01" content="' + SITE.bingVerify + '">'), 'first page: carries the Bing Webmaster Tools verification tag');
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
  const ld = ldOf(h); ok(ld.length === 1 && ld[0] && ld[0]['@graph'].some(n => [].concat(n['@type']).some(x => x === 'WebPage' || x === 'ProfilePage')) && ld[0]['@graph'].some(n => n['@type'] === 'BreadcrumbList') && (!p.faq || ld[0]['@graph'].some(n => n['@type'] === 'FAQPage' && n.mainEntity.length === p.faq.length)), name + 'structured data parses (page, breadcrumbs' + (p.faq ? ', FAQ' : '') + ')');
  if (p.about) { const G = ld[0]['@graph'], pp = G.find(n => n['@type'] === 'ProfilePage'), pe = G.filter(n => n['@type'] === 'Person'), me = pe[0] || {}, ids = G.map(n => n['@id']).filter(Boolean);
    ok(!!pp && pp.mainEntity && pp.mainEntity['@id'] === PERSON.id && pp.url === url, name + 'it is a ProfilePage whose main entity is Tehau (' + PERSON.id + ')');
    ok(pe.length === 1 && me['@id'] === PERSON.id && me.name === 'Tehau' && me.alternateName === 'Tehau DeBarthe' && me.url === url && me.image === PERSON.image && !!me.description && me.sameAs.length >= 3 && ['github.com/TehauD', 'linkedin.com/in/tehau', 'instagram.com/tehaud'].every(u => me.sameAs.some(x => x.includes(u))), name + 'one Person: Tehau, also Tehau DeBarthe, with the image, the About page as its url, and GitHub, LinkedIn and Instagram');
    ok(ids.length === new Set(ids).size, name + 'no entity is described twice');
    ok(t === 'Tehau — Musician, Engineer &amp; Creator of the-daily.studio' && desc === 'Meet Tehau, a musician, software engineer, and independent creator building creative technology, open-source software, and tools for musicians.', name + 'the SEO title and description are the chosen ones (' + t + ')');
    ok(metaOf(h, 'og:type') === 'profile' && metaOf(h, 'og:image') === PERSON.photoUrl && existsSync(join(d, PERSON.photo)), name + 'Open Graph says profile, with the picture served from this domain (' + PERSON.photo + ')');
    ok(/<h1>Tehau<\/h1>/.test(h) && h.includes('Musician, Software Engineer &amp; Independent Creator.') && /<img src="[^"]*icons\/tehau\.jpg"[^>]*alt="Tehau/.test(h), name + 'the H1 is Tehau, with the subtitle and the picture');
    ok(['https://github.com/TehauD"', 'https://www.linkedin.com/in/tehau/"', 'https://www.instagram.com/tehaud/"', 'https://journal.the-daily.studio/"'].every(u => h.includes('href="' + u)) && /My mom put a guitar in my hands/.test(h) && /The rest of what I make/.test(h) && /may it bring you joy/.test(h) && !/my line is simple/.test(h), name + 'it links to GitHub, LinkedIn, Instagram and the journal, explains the relationship, and keeps the origin story'); }
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
/* 2.87.1: the Markdown twins, the one-file guide, the Content Signals line and the root icons (what AI crawlers and browsers ask for before anything else) */
{
  const robots = rd('robots.txt'), cs = (robots.match(/^Content-Signal:\s*(.+)$/mi) || [])[1] || '';
  ok(/search=yes/.test(cs) && /ai-input=yes/.test(cs) && /ai-train=no/.test(cs), 'robots.txt declares Content Signals: search and AI answers yes, AI training no (' + cs + ')');
  const twins = ['index.md', 'guide/index.md', ...PAGES.filter(p => p.slug !== 'guide').map(p => 'guide/' + p.slug + '/index.md')], hdr = rd('_headers');
  ok(twins.every(f => existsSync(join(d, f)) && /^# \S/.test(rd(f))), 'the front page and every guide page have a Markdown twin (' + twins.length + ' files)');
  /* a _headers rule is its path on a line of its own, then its indented headers: read it line by line, so no path is ever turned into a pattern */
  const rule = path => { const ls = hdr.split('\n'), i = ls.indexOf(path), o = []; if (i < 0) return o; for (let k = i + 1; k < ls.length && /^\s/.test(ls[k]); k++) o.push(ls[k].trim()); return o; };
  ok(twins.every(f => rule('/' + f).includes('Content-Type: text/markdown; charset=utf-8')), 'each twin is sent as text/markdown');
  ok(PAGES.every(p => rd(p.slug === 'guide' ? 'guide/index.html' : 'guide/' + p.slug + '/index.html').includes('<link rel="alternate" type="text/markdown" href="' + pageUrl(p) + 'index.md">')) && html.includes('<link rel="alternate" type="text/markdown" href="index.md">'), 'each page names its Markdown twin in a <link rel="alternate">');
  const full = rd('llms-full.txt');
  ok(PAGES.filter(p => !p.unlisted).every(p => full.includes('# ' + p.h1)) && !/<[a-z][^>]*>/i.test(full.split('\n').slice(1).join('\n')), 'llms-full.txt holds the front page and every listed guide page, as plain Markdown');
  ok(rule('/llms-full.txt').some(l => l.startsWith('Content-Type: text/markdown')) && rule('/').includes('Vary: Accept') && rule('/guide/*').includes('Vary: Accept'), 'llms-full.txt is Markdown and the pages that have a twin say Vary: Accept');
  /* the API catalog (RFC 9727): a linkset the site root points to, whose one entry describes the agent tools and links to files that exist */
  const cat = existsSync(join(d, '.well-known', 'api-catalog')) ? JSON.parse(rd('.well-known/api-catalog')) : {}, ents = cat.linkset || [], local = h => h.startsWith(SITE.origin + '/') ? h.slice(SITE.origin.length + 1) : null, here = h => { const f = local(h); return f === null || existsSync(join(d, f.endsWith('/') ? f + 'index.html' : f || 'index.html')); };
  ok(ents.length >= 1 && ents.every(e => /^https:\/\//.test(e.anchor) && e['service-desc'] && e['service-desc'].length && e['service-doc'] && e['service-doc'].length && [...e['service-desc'], ...e['service-doc']].every(l => /^https:\/\//.test(l.href) && l.type && here(l.href))), '/.well-known/api-catalog is a linkset: each entry has an anchor, a service-desc and a service-doc, and the files on this site exist');
  ok(/^\/\.well-known\/api-catalog\n(?:  .*\n)*?  Content-Type: application\/linkset\+json$/m.test(hdr) && /^  Link: <\/\.well-known\/api-catalog>; rel="api-catalog"$/m.test(hdr), 'the catalog is sent as application/linkset+json and the front page points to it with a Link header');
  { const at = existsSync(join(d, 'agent-tools.json')) ? JSON.parse(rd('agent-tools.json')) : {}, ct = JSON.parse(readFileSync(join(root, 'test', 'agent-contract.json'), 'utf8')); ok(at.api === ct.api && JSON.stringify(at.tools) === JSON.stringify(ct.tools) && /no server endpoint/.test(at.about || ''), '/agent-tools.json is the tool contract the tests hold, and says the tools run in the page'); }
  const ico = existsSync(join(d, 'favicon.ico')) ? readFileSync(join(d, 'favicon.ico')) : Buffer.alloc(0);
  ok(ico.length > 100 && ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1 && existsSync(join(d, 'apple-touch-icon.png')), '/favicon.ico and /apple-touch-icon.png are served from the root (crawlers and browsers ask for them first)');
}
console.log(bad ? `\n${bad} check(s) failed` : '\nsite verified'); process.exit(bad ? 1 : 0);
