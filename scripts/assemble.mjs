#!/usr/bin/env node
/* Builds the app, then copies exactly the files a static host should serve into ./dist (used by Cloudflare Workers Builds).
     npm run build:site */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { PAGES, renderPage } from './seo-pages.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), out = join(root, 'dist');
execFileSync(process.execPath, [join(root, 'scripts', 'build.mjs')], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(join(out, 'journal'), { recursive: true });
for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'robots.txt', 'sitemap.xml', '404.html']) cpSync(join(root, f), join(out, f));
cpSync(join(root, 'icons'), join(out, 'icons'), { recursive: true });
if (existsSync(join(root, 'samples'))) cpSync(join(root, 'samples'), join(out, 'samples'), { recursive: true });
cpSync(join(root, 'journal', 'index.html'), join(out, 'journal', 'index.html'));

/* /guide/: the public pages that say what the studio does (one question per page), each with its own title, description, canonical link and structured data.
   Written by scripts/seo-pages.mjs; the pictures are the small WebP files in site/img (see docs/OPERATIONS.md). */
{
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')), log = readFileSync(join(root, 'CHANGELOG.md'), 'utf8').match(/^## (\d+\.\d+\.\d+) — (\d{4}-\d{2}-\d{2})/m), modified = log ? log[2] : new Date().toISOString().slice(0, 10);
  for (const p of PAGES) { const dir = p.slug === 'guide' ? join(out, 'guide') : join(out, 'guide', p.slug); mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, 'index.html'), renderPage(p, { version: pkg.version, modified })); }
  if (existsSync(join(root, 'site', 'img'))) cpSync(join(root, 'site', 'img'), join(out, 'guide', 'img'), { recursive: true });
}

/* /legal/: the licence, the third-party notices, the privacy statement and the two font licences as one plain page, so the notices travel with the site
   (the SIL Open Font Licence asks that its text accompany the fonts; MIT asks that the notice stay with the software). Built from the files in this repository. */
mkdirSync(join(out, 'legal'), { recursive: true });
{
  const repo = 'https://github.com/TehauD/the-daily.studio/blob/main/', slug = x => x.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/ +/g, '-');
  const rd = f => readFileSync(join(root, f), 'utf8'), esc = x => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = x => esc(x).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*\s][^*]*)\*/g, '<i>$1</i>').replace(/\[([^\]]+)\]\(((?:https?:|#)[^)\s]+)\)/g, (_, t, u) => '<a href="' + u + '"' + (u[0] === '#' ? '' : ' rel="noopener noreferrer"') + '>' + t + '</a>').replace(/\[([^\]]+)\]\(([\w./-]+\.(?:md|txt))(#[\w-]+)?\)/g, (_, t, u, a) => '<a href="' + repo + u + (a || '') + '" rel="noopener noreferrer">' + t + '</a>').replace(/&lt;(https?:[^&\s]+)&gt;/g, '<a href="$1" rel="noopener noreferrer">$1</a>');
  const md = src => {   // the small subset these files use: headings, paragraphs, bullets, tables
    const lines = src.replace(/\r/g, '').split('\n'), o = []; let list = '', tbl = null, para = [];
    const flush = () => { if (para.length) { o.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } }, endList = () => { if (list) { o.push('</' + list + '>'); list = ''; } };
    const endTbl = () => { if (tbl) { o.push('<table>' + tbl.map((r, i) => '<tr>' + r.map(c => (i ? '<td>' : '<th>') + inline(c.trim()) + (i ? '</td>' : '</th>')).join('') + '</tr>').join('') + '</table>'); tbl = null; } };
    for (const l of lines) {
      let m;
      if (/^\s*\|.*\|\s*$/.test(l)) { flush(); endList(); const cells = l.trim().replace(/^\||\|$/g, '').split('|'); if (cells.every(c => /^\s*:?-{3,}:?\s*$/.test(c))) continue; (tbl = tbl || []).push(cells); continue; }
      endTbl();
      if ((m = /^(#{1,3})\s+(.*)$/.exec(l))) { flush(); endList(); o.push('<h' + (m[1].length + 1) + ' id="' + slug(m[2]) + '">' + inline(m[2]) + '</h' + (m[1].length + 1) + '>'); }
      else if ((m = /^\s*(?:([-*])|\d+\.)\s+(.*)$/.exec(l))) { flush(); const kind = m[1] ? 'ul' : 'ol'; if (list !== kind) { endList(); o.push('<' + kind + '>'); list = kind; } o.push('<li>' + inline(m[2]) + '</li>'); }
      else if (!l.trim()) { flush(); endList(); }
      else para.push(l.trim());
    }
    flush(); endList(); endTbl(); return o.join('\n');
  };
  const pre = t => '<pre>' + esc(t.trim()) + '</pre>';
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
<meta name="robots" content="noindex"><title>Terms, licences, notices and privacy — the-daily.studio</title>
<style>:root{color-scheme:light dark}body{margin:0;font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:Canvas;color:CanvasText}main{max-width:820px;margin:0 auto;padding:24px 16px 64px}h1{font-size:26px;margin:.2em 0}h2{font-size:21px;margin:1.6em 0 .4em;padding-top:.6em;border-top:1px solid color-mix(in srgb,CanvasText 18%,transparent)}h3,h4{margin:1.2em 0 .3em}a{color:LinkText}code,pre{font:13px/1.45 ui-monospace,Menlo,Consolas,monospace}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:color-mix(in srgb,CanvasText 7%,transparent);padding:12px;border-radius:8px}table{border-collapse:collapse;width:100%;font-size:14px;display:block;overflow-x:auto}th,td{border:1px solid color-mix(in srgb,CanvasText 22%,transparent);padding:6px 9px;text-align:left;vertical-align:top}nav a{margin-right:14px}</style></head><body><main>
<p><a href="../">← the-daily.studio</a></p><h1>Terms, licences, notices and privacy</h1>
<nav><a href="#terms">Terms of use</a><a href="#licence">Licence</a><a href="#notices">Third-party notices</a><a href="#privacy">Privacy</a><a href="#fonts">Font licences</a></nav>
<section id="terms">${md(rd('TERMS.md').replace(/^# /, '## '))}</section>
<section id="licence"><h2>Licence</h2>${pre(rd('LICENSE'))}</section>
<section id="notices">${md(rd('THIRD_PARTY_NOTICES.md').replace(/^# /, '## '))}</section>
<section id="privacy">${md(rd('PRIVACY.md').replace(/^# /, '## '))}</section>
<section id="fonts"><h2>Font licences</h2><h3>Inter</h3>${pre(rd('src/fonts/OFL-Inter.txt'))}<h3>Montserrat</h3>${pre(rd('src/fonts/OFL-Montserrat.txt'))}</section>
</main></body></html>`;
  writeFileSync(join(out, 'legal', 'index.html'), page);
}
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
  Permissions-Policy: microphone=(self), camera=(self), midi=(self), display-capture=(self), geolocation=(), payment=(), usb=(), serial=()`;
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
/legal/*
  Cache-Control: no-cache
/icons/*
  Cache-Control: public, max-age=86400
`);
console.log('dist/ ready');
