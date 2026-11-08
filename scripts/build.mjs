#!/usr/bin/env node
/* the-daily.studio build: concatenates src/parts/*.js (in filename order) into one IIFE and emits
     index.html            standalone single-file app (site entry point; also opens from disk)
     codepen/pen.{html,css,js}   the three CodePen panels
   No dependencies. `--check` verifies the committed outputs are up to date and exits 1 if not. */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { markInner, markSvg, BRAND as BR } from './brand-mark.mjs';
import { SITE, appJsonLd, sitemap, guideLinks, llmsTxt } from './seo-pages.mjs';
import { minifyJS, minifyCSS, tokens } from './minify.mjs';
import { splitRooms } from './rooms.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = p => readFileSync(join(root, 'src', p), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const parts = readdirSync(join(root, 'src', 'parts')).filter(f => f.endsWith('.js')).sort();
let js = "(()=>{'use strict';\n";
for (const f of parts) js += `/* >>> parts/${f} */\n${src('parts/' + f)}\n`;
js += "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();\n})();\n";
try { new vm.Script(js, { filename: 'daily-songs.js' }); } catch (e) { console.error('Syntax error in bundled script:\n' + e.stack); process.exit(1); }
/* two parts declaring the same top-level function is legal JavaScript, and the later one silently replaces the earlier everywhere: refuse it */
{ const seen = new Map(), dup = []; for (const f of parts) for (const m of src('parts/' + f).matchAll(/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm)) { if (seen.has(m[1])) dup.push(m[1] + ' (' + seen.get(m[1]) + ' and ' + f + ')'); else seen.set(m[1], f); }
  if (dup.length) { console.error('The same function is declared in two places, so one would silently replace the other:\n  ' + dup.join('\n  ')); process.exit(1); } }

/* sample tracks: samples/manifest.json lists every audio file in samples/ (titles from samples/info.json or the file name) */
const AUDIO = /\.(m4a|mp3|wav|ogg|flac|aac)$/i; let info = {}; try { info = JSON.parse(readFileSync(join(root, 'samples', 'info.json'), 'utf8')); } catch { }
let sampleFiles = []; try { sampleFiles = readdirSync(join(root, 'samples')).filter(f => AUDIO.test(f)).sort(); } catch { }
const samples = JSON.stringify({ tracks: sampleFiles.map(f => ({ file: f, title: (info[f] && info[f].title) || f.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(), note: (info[f] && info[f].note) || '', mb: +(statSync(join(root, 'samples', f)).size / 1048576).toFixed(1) })) }, null, 2) + '\n';
/* 2.52: the page carries the sample shelf the build found, so it needs no request for it */
js = js.replaceAll('__SAMPLES_BUILT__', samples);
const MARK = markInner({ hex: 'var(--accent)', ink: 'var(--text)' });
const MARK_SM = markInner({ hex: 'var(--accent)', ink: 'var(--text)', bars: false, k: 1.45 });
js = js.replaceAll('__MARK_INNER__', MARK);
/* the version the app shows, and a build code taken from the code itself: the same source always gives the same code */
const BUILD = createHash('sha256').update(js).digest('hex').slice(0, 7);
js = js.replaceAll('__VERSION__', pkg.version).replaceAll('__BUILD__', BUILD).replaceAll('__PARTS__', String(parts.length)).replaceAll('__LINES__', String(js.split('\n').length));
{ const left = js.match(/\b__[A-Z][A-Z0-9_]*__\b/); if (left) { console.error('The script still has a placeholder the build did not fill: ' + left[0]); process.exit(1); } }      /* 2.52: never ship one */
/* index.html carries a minified copy (comments, indentation and needless spaces out; nothing else). The CodePen files keep the
   readable source. `node scripts/build.mjs --pretty` writes an unminified index.debug.html for debugging (not committed). */
const PRETTY = process.argv.includes('--pretty');
let jsMin = js;
if (!PRETTY) {
  jsMin = minifyJS(js);
  try { new vm.Script(jsMin, { filename: 'daily-songs.min.js' }); } catch (e) { console.error('The minified script does not compile:\n' + e.stack); process.exit(1); }
  /* proof: the same words, numbers, strings, templates, regexes and punctuation, in the same order; only whitespace and comments differ */
  const sig = x => tokens(x).filter(t => t.t !== 'ws' && t.t !== 'nl'), a = sig(js), b = sig(jsMin);
  const k = a.findIndex((t, i) => !b[i] || b[i].t !== t.t || b[i].v !== t.v);
  if (k >= 0 || a.length !== b.length) { console.error('Minifying changed the script at token ' + (k < 0 ? Math.min(a.length, b.length) : k) + ': ' + JSON.stringify(a[k]) + ' → ' + JSON.stringify(b[k])); process.exit(1); }
}
const fontFace = (fam, file) => `@font-face{font-family:"${fam}";src:url(data:font/woff2;base64,${readFileSync(join(root, 'src', 'fonts', file)).toString('base64')}) format("woff2");font-weight:100 900;font-style:normal;font-display:swap}\n`;
const css = fontFace('DS Inter', 'inter-latin-wght.woff2') + fontFace('DS Montserrat', 'montserrat-latin-wght.woff2') + src('styles.css'), bodyRaw = src('body.html').replaceAll('__MARK_INNER__', MARK).replaceAll('__MARK_SM__', MARK_SM), body = bodyRaw.replaceAll('__GUIDE_LINKS__', guideLinks()), bodyPen = bodyRaw.replaceAll('__GUIDE_LINKS__', guideLinks(SITE.origin + '/'));
const chlog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8').match(/^## (\d+\.\d+\.\d+) — (\d{4}-\d{2}-\d{2})/m), modified = chlog ? chlog[2] : new Date().toISOString().slice(0, 10);
const favSvg = markSvg({ hex: BR.deep, ink: BR.black, bars: false, k: 1.7, cls: true }).replace('>', `><style>.h{stroke:${BR.deep}}.i{stroke:${BR.black}}@media(prefers-color-scheme:dark){.h{stroke:${BR.sage}}.i{stroke:${BR.paper}}}</style>`);
const icon = encodeURIComponent(favSvg);
const T = SITE.title, D = SITE.description, SHORT = 'Record guitar and mic, split any song into stems, get the chords and tab, and run a live light show. Free, private, nothing to install.';
const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="the-daily.studio">
<title>${T}</title><link rel="canonical" href="${SITE.origin}/"><meta name="description" content="${D}"><meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#0d0f10"><meta property="og:title" content="${T}"><meta property="og:type" content="website"><meta property="og:site_name" content="the-daily.studio"><meta property="og:locale" content="en_US"><meta property="og:url" content="${SITE.origin}/"><meta property="og:description" content="${SHORT}"><meta property="og:image" content="${SITE.card}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="the-daily.studio: lyrics, chords, recording and stems in one browser page">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${T}"><meta name="twitter:description" content="${SHORT}"><meta name="twitter:image" content="${SITE.card}"><meta name="twitter:image:alt" content="the-daily.studio: lyrics, chords, recording and stems in one browser page">
<meta name="author" content="${SITE.author}"><meta name="referrer" content="no-referrer"><meta name="color-scheme" content="light dark">
<script type="application/ld+json">${appJsonLd(pkg.version, modified)}</script>
<link rel="icon" href="data:image/svg+xml,${icon}"><link rel="apple-touch-icon" href="icons/apple-touch-icon.png"><link rel="manifest" href="manifest.webmanifest"><link rel="alternate" type="text/plain" href="llms.txt" title="For AI assistants">`;
const cssMin = PRETTY ? css : minifyCSS(css);
{ const br = x => [(x.match(/\{/g) || []).length, (x.match(/\}/g) || []).length].join(); if (br(cssMin) !== br(css.replace(/\/\*[\s\S]*?\*\//g, ''))) { console.error('Minifying the stylesheet changed its braces'); process.exit(1); } }
const inlineJs = `\n${jsMin.replace(/<\/script>/g, '<\\/script>')}\n`;
/* 2.49.2: jsDelivr serves every npm package, so the policy names only the one folder the camera library loads from (its code and WASM),
   read from part 09d so the two cannot drift apart */
const MPV = (src('parts/09d-camfx.js').match(/tasks-vision@(\d+\.\d+\.\d+)\/vision_bundle/) || [])[1]; if (!MPV) { console.error('Could not find the MediaPipe version in part 09d'); process.exit(1); }
const MPDIR = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MPV + '/';
const csp = ["default-src 'self'", `script-src 'sha256-${createHash('sha256').update(inlineJs).digest('base64')}' 'wasm-unsafe-eval' blob: ${MPDIR}`, "worker-src 'self' blob:", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "media-src 'self' blob: data:", `connect-src 'self' blob: data: ${MPDIR} https://storage.googleapis.com https://api.github.com`, "font-src 'self' data:", "object-src 'none'", "base-uri 'none'", "form-action 'none'"].join('; ');
const standalone = `<!doctype html>\n<html lang="en"><head><meta http-equiv="Content-Security-Policy" content="${csp}">${head}\n<style>\n${cssMin}\n</style></head><body>\n${body}\n<noscript><div style="max-width:40rem;margin:0 auto;padding:24px 16px;font:16px/1.5 system-ui,sans-serif"><h2>the-daily.studio needs JavaScript</h2><p>It is a guitar and voice studio that runs entirely in your browser: record guitar and voice, split a song into stems, get chords, tab and lyrics, and run a live light show. It sends nothing anywhere, so it needs JavaScript to do the work on your device.</p><p>Read about it: ${guideLinks()}</p></div></noscript>\n<script>${inlineJs}</script></body></html>\n`;

/* ---------- the hosted site's page (2.40, `--site`, written to dist/ by scripts/assemble.mjs) ----------
   The same app, lighter to load: the fonts are files beside the page (the guide pages already use them), and the rooms in
   scripts/rooms.mjs are their own scripts, loaded the first time they are used. index.html above stays one complete file. */
function siteBuild() {
  const sp = splitRooms(parts.map(f => [f, src('parts/' + f)])), LINES = String(js.split('\n').length);
  const fin = x => x.replaceAll('__SAMPLES_BUILT__', samples).replaceAll('__MARK_INNER__', MARK).replaceAll('__VERSION__', pkg.version).replaceAll('__BUILD__', BUILD).replaceAll('__PARTS__', String(parts.length)).replaceAll('__LINES__', LINES);
  const proof = (a0, b0, what) => { const sig = x => tokens(x).filter(t => t.t !== 'ws' && t.t !== 'nl'), a = sig(a0), b = sig(b0); const k = a.findIndex((t, i) => !b[i] || b[i].t !== t.t || b[i].v !== t.v); if (k >= 0 || a.length !== b.length) { console.error('Minifying changed ' + what + ' at token ' + k); process.exit(1); } };
  const files = {}, sri = {}, roomOut = {};
  for (const [id, code0] of Object.entries(sp.rooms)) {
    const code = fin(code0); try { new vm.Script(code, { filename: 'room-' + id + '.js' }); } catch (e) { console.error('Room ' + id + ' does not compile:\n' + e.stack); process.exit(1); }
    const min = minifyJS(code); proof(code, min, 'room ' + id); new vm.Script(min);
    const name = 'rooms/' + id + '.' + createHash('sha256').update(min).digest('hex').slice(0, 8) + '.js';
    files[id] = name; sri[id] = 'sha384-' + createHash('sha384').update(min).digest('base64'); roomOut[name] = min;
  }
  let sj = "(()=>{'use strict';\n" + sp.header;
  for (const [f, s0] of sp.core) sj += `/* >>> parts/${f} */\n${s0}\n`;
  sj += sp.footer + `ROOM.files = ${JSON.stringify(files)}; ROOM.sri = ${JSON.stringify(sri)};\n`;
  sj += "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();\n})();\n";
  sj = fin(sj); { const left = sj.match(/\b__[A-Z][A-Z0-9_]*__\b/); if (left) { console.error('The site script still has a placeholder the build did not fill: ' + left[0]); process.exit(1); } }      /* 2.52: never ship one */
  try { new vm.Script(sj, { filename: 'daily-songs.site.js' }); } catch (e) { console.error('The site script does not compile:\n' + e.stack); process.exit(1); }
  const sjMin = minifyJS(sj); proof(sj, sjMin, 'the site script'); new vm.Script(sjMin);
  const FONTS = [['DS Inter', 'inter-latin-wght.woff2'], ['DS Montserrat', 'montserrat-latin-wght.woff2']];
  const cssS = minifyCSS(FONTS.map(([fam, f]) => `@font-face{font-family:"${fam}";src:url(fonts/${f}) format("woff2");font-weight:100 900;font-style:normal;font-display:swap}\n`).join('') + src('styles.css'));
  const inl = `\n${sjMin.replace(/<\/script>/g, '<\\/script>')}\n`;
  const cspS = csp.replace(/script-src 'sha256-[^']+'/, `script-src 'sha256-${createHash('sha256').update(inl).digest('base64')}' 'self'`);
  const pre = FONTS.map(([, f]) => `<link rel="preload" href="fonts/${f}" as="font" type="font/woff2" crossorigin>`).join('');
  const html = standalone.replace(csp, cspS).replace(`<style>\n${cssMin}\n</style>`, () => `${pre}<style>\n${cssS}\n</style>`).replace(`<script>${inlineJs}</script>`, () => `<script>${inl}</script>`);
  if (html === standalone || !html.includes(inl) || !html.includes(cspS)) { console.error('Could not assemble the site page'); process.exit(1); }
  const extra = FONTS.map(([, f]) => 'fonts/' + f).concat(Object.values(files));
  const swS = sw.replace('const CORE = [', `const EXTRA = ${JSON.stringify(extra)};      /* the fonts and rooms: kept for offline use, but a missing one never stops the install */\nconst CORE = [`).replace('Promise.all(CORE.map(u => save(c, u))))', 'Promise.all(CORE.map(u => save(c, u))).then(() => Promise.all(EXTRA.map(u => save(c, new Request(u, { cache: \'force-cache\' })).catch(() => { })))))');
  if (swS === sw) { console.error('Could not make the site service worker'); process.exit(1); }
  return { 'index.html': html, 'sw.js': swS, ...roomOut, info: sp.info };
}

/* installable web app: manifest + offline cache (the page registers sw.js only on https / localhost) */
const manifest = JSON.stringify({
  name: 'the-daily.studio', short_name: 'The Daily', description: pkg.description, id: './', start_url: './', scope: './', display: 'standalone', orientation: 'any',
  background_color: '#0d0f10', theme_color: '#0d0f10', categories: ['music', 'productivity'],
  icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
}, null, 2) + '\n';
const sw = `/* the-daily.studio service worker (generated by scripts/build.mjs — do not edit). Same-origin files only. Audio, camera and your song never go through it.
   2.52, as few requests as possible:
     a page            network first (always the newest version), the saved copy when offline; the studio is saved once, as ./
     saved files       everything saved at install (the fonts, icons and the rooms) comes from the saved copy, with no request: a new
                       version of the studio saves them afresh, and a room whose name (and so whose contents) did not change is copied
                       over from the last version instead of downloaded again
     anything else     the saved copy at once, and a fresh one in the background */
const V = 'daily-songs-${pkg.version}';
const CORE = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const HASHED = /\\.[0-9a-f]{8}\\.js$/;
const save = (c, u) => { const p = typeof u === 'string' ? u : u.url; return HASHED.test(p) ? caches.match(p).then(old => old ? c.put(p, old) : c.add(u)) : c.add(u); };      /* force-cache (the fonts and rooms the page just loaded): taken from the browser's cache when it has them */
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => Promise.all(CORE.map(u => save(c, u)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => (k.startsWith('fretwork-') || k.startsWith('daily-songs-')) && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const SAVED = /\\/(fonts|icons|rooms)\\//;
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return; const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (/\\/(journal|api|auth|share)\\/|\\/healthz$/.test(u.pathname)) return;   // the moving page at /journal/, the sign-in routes and shared recordings (encrypted, 7 days; never cached here) manage themselves
  if (r.mode === 'navigate' || /\\/$|\\.html$/.test(u.pathname)) {   // the page itself: network first, so a new version is never hidden behind an old copy
    e.respondWith(fetch(r).then(res => { if (res && res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r, { ignoreSearch: true }).then(h => h || caches.match('./')))); return;
  }
  if (SAVED.test(u.pathname)) {   // saved at install for this version: no request at all
    e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => hit || fetch(r).then(res => { if (res && res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; }))); return;
  }
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => {
    const net = fetch(r).then(res => { if (res && res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
`;
const outputs = { 'index.html': standalone, 'codepen/pen.html': bodyPen, 'codepen/pen.css': css, 'codepen/pen.js': js, 'manifest.webmanifest': manifest, 'sw.js': sw, 'samples/manifest.json': samples, 'sitemap.xml': sitemap(modified), 'llms.txt': llmsTxt(pkg.version, readFileSync(join(root, 'docs', 'AGENT_API.md'), 'utf8')) };
if (process.argv.includes('--site')) {
  const out = join(root, 'dist'), o = siteBuild(), info = o.info; delete o.info; mkdirSync(join(out, 'rooms'), { recursive: true });
  for (const [f, c] of Object.entries(o)) writeFileSync(join(out, f), c);
  console.log(`site: index.html ${(o['index.html'].length / 1024).toFixed(0)} kB, ` + Object.keys(o).filter(f => f.startsWith('rooms/')).map(f => f + ' ' + (o[f].length / 1024).toFixed(0) + ' kB').join(', '));
} else if (process.argv.includes('--check')) {
  let bad = 0;
  for (const [f, c] of Object.entries(outputs)) { let cur = ''; try { cur = readFileSync(join(root, f), 'utf8'); } catch { } if (cur !== c) { console.error('out of date: ' + f); bad++; } }
  if (bad) { console.error('Run `npm run build` and commit the result.'); process.exit(1); } else console.log('build outputs are up to date');
} else if (PRETTY) {
  writeFileSync(join(root, 'index.debug.html'), standalone); console.log('index.debug.html written (unminified, for debugging; not committed)');
} else {
  mkdirSync(join(root, 'codepen'), { recursive: true });
  for (const [f, c] of Object.entries(outputs)) writeFileSync(join(root, f), c);
  console.log(`the-daily.studio ${pkg.version}: ${parts.length} parts → index.html (${(standalone.length / 1024).toFixed(0)} kB), codepen/pen.{html,css,js}, manifest.webmanifest, sw.js`);
}
