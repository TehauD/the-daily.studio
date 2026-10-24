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

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = p => readFileSync(join(root, 'src', p), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const parts = readdirSync(join(root, 'src', 'parts')).filter(f => f.endsWith('.js')).sort();
let js = "(()=>{'use strict';\n";
for (const f of parts) js += `/* >>> parts/${f} */\n${src('parts/' + f)}\n`;
js += "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();\n})();\n";
try { new vm.Script(js, { filename: 'daily-songs.js' }); } catch (e) { console.error('Syntax error in bundled script:\n' + e.stack); process.exit(1); }

const MARK = markInner({ hex: 'var(--accent)', ink: 'var(--text)' });
const MARK_SM = markInner({ hex: 'var(--accent)', ink: 'var(--text)', bars: false, k: 1.45 });
js = js.replaceAll('__MARK_INNER__', MARK);
const fontFace = (fam, file) => `@font-face{font-family:"${fam}";src:url(data:font/woff2;base64,${readFileSync(join(root, 'src', 'fonts', file)).toString('base64')}) format("woff2");font-weight:100 900;font-style:normal;font-display:swap}\n`;
const css = fontFace('DS Inter', 'inter-latin-wght.woff2') + fontFace('DS Montserrat', 'montserrat-latin-wght.woff2') + src('styles.css'), body = src('body.html').replaceAll('__MARK_INNER__', MARK).replaceAll('__MARK_SM__', MARK_SM);
const favSvg = markSvg({ hex: BR.deep, ink: BR.black, bars: false, k: 1.7, cls: true }).replace('>', `><style>.h{stroke:${BR.deep}}.i{stroke:${BR.black}}@media(prefers-color-scheme:dark){.h{stroke:${BR.sage}}.i{stroke:${BR.paper}}}</style>`);
const icon = encodeURIComponent(favSvg);
const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="the-daily.studio">
<title>the-daily.studio — a songwriter’s workspace</title><link rel="canonical" href="https://the-daily.studio/"><meta property="og:url" content="https://the-daily.studio/">
<meta name="description" content="A free, open-source songwriter’s workspace that runs entirely in your browser: capture an idea, write lyrics and chords, record guitar and vocals, split a track into stems, and keep it all on your device.">
<meta name="theme-color" content="#0d0f10"><meta property="og:title" content="the-daily.studio — a songwriter’s workspace"><meta property="og:type" content="website"><meta property="og:site_name" content="the-daily.studio"><meta property="og:image" content="https://the-daily.studio/icons/social-card.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="the-daily.studio: lyrics, chords, recording and stems in one browser page">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="the-daily.studio — a songwriter’s workspace"><meta name="twitter:image" content="https://the-daily.studio/icons/social-card.png">
<meta name="author" content="Tehau DeBarthe"><meta name="referrer" content="no-referrer"><meta name="color-scheme" content="light dark">
<meta property="og:description" content="Clean canvas or start from a song. Lyrics, chords, tab, recording, stems and a pedal rig. No account, nothing uploaded. the-daily.studio">
<link rel="icon" href="data:image/svg+xml,${icon}"><link rel="apple-touch-icon" href="icons/apple-touch-icon.png"><link rel="manifest" href="manifest.webmanifest">`;
const inlineJs = `\n${js.replace(/<\/script>/g, '<\\/script>')}\n`;
const csp = ["default-src 'self'", `script-src 'sha256-${createHash('sha256').update(inlineJs).digest('base64')}' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net`, "worker-src 'self' blob:", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "media-src 'self' blob: data:", "connect-src 'self' blob: data: https://cdn.jsdelivr.net https://storage.googleapis.com", "font-src 'self' data:", "object-src 'none'", "base-uri 'none'", "form-action 'none'"].join('; ');
const standalone = `<!doctype html>\n<html lang="en"><head><meta http-equiv="Content-Security-Policy" content="${csp}">${head}\n<style>\n${css}\n</style></head><body>\n${body}\n<noscript>the-daily.studio needs JavaScript. It runs entirely in your browser and sends nothing anywhere.</noscript>\n<script>${inlineJs}</script></body></html>\n`;

/* installable web app: manifest + offline cache (the page registers sw.js only on https / localhost) */
const manifest = JSON.stringify({
  name: 'the-daily.studio', short_name: 'The Daily', description: pkg.description, id: './', start_url: './', scope: './', display: 'standalone', orientation: 'any',
  background_color: '#0d0f10', theme_color: '#0d0f10', categories: ['music', 'productivity'],
  icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
}, null, 2) + '\n';
const sw = `/* the-daily.studio service worker (generated by scripts/build.mjs — do not edit). Same-origin files only: the page is fetched network-first (always the newest version, cached copy when offline),
   other files stale-while-revalidate. Audio, camera and your song never go through it. */
const V = 'daily-songs-${pkg.version}';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => (k.startsWith('fretwork-') || k.startsWith('daily-songs-')) && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return; const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (/\\/(journal|api)\\/|\\/healthz$/.test(u.pathname)) return;   // The Daily lives at /journal/ on this origin and manages itself
  if (r.mode === 'navigate' || /\\/$|\\.html$/.test(u.pathname)) {   // the page itself: network first, so a new version is never hidden behind an old copy
    e.respondWith(fetch(r).then(res => { if (res && res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r, { ignoreSearch: true }).then(h => h || caches.match('index.html')))); return;
  }
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => {
    const net = fetch(r).then(res => { if (res && res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; }).catch(() => hit || (r.mode === 'navigate' ? caches.match('index.html') : undefined));
    return hit || net;
  }));
});
`;
/* sample tracks: samples/manifest.json lists every audio file in samples/ (titles from samples/info.json or the file name) */
const AUDIO = /\.(m4a|mp3|wav|ogg|flac|aac)$/i; let info = {}; try { info = JSON.parse(readFileSync(join(root, 'samples', 'info.json'), 'utf8')); } catch { }
let sampleFiles = []; try { sampleFiles = readdirSync(join(root, 'samples')).filter(f => AUDIO.test(f)).sort(); } catch { }
const samples = JSON.stringify({ tracks: sampleFiles.map(f => ({ file: f, title: (info[f] && info[f].title) || f.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(), note: (info[f] && info[f].note) || '', mb: +(statSync(join(root, 'samples', f)).size / 1048576).toFixed(1) })) }, null, 2) + '\n';
const outputs = { 'index.html': standalone, 'codepen/pen.html': body, 'codepen/pen.css': css, 'codepen/pen.js': js, 'manifest.webmanifest': manifest, 'sw.js': sw, ...(sampleFiles.length ? { 'samples/manifest.json': samples } : {}) };
if (process.argv.includes('--check')) {
  let bad = 0;
  for (const [f, c] of Object.entries(outputs)) { let cur = ''; try { cur = readFileSync(join(root, f), 'utf8'); } catch { } if (cur !== c) { console.error('out of date: ' + f); bad++; } }
  if (bad) { console.error('Run `npm run build` and commit the result.'); process.exit(1); } else console.log('build outputs are up to date');
} else {
  mkdirSync(join(root, 'codepen'), { recursive: true });
  for (const [f, c] of Object.entries(outputs)) writeFileSync(join(root, f), c);
  console.log(`the-daily.studio ${pkg.version}: ${parts.length} parts → index.html (${(standalone.length / 1024).toFixed(0)} kB), codepen/pen.{html,css,js}, manifest.webmanifest, sw.js`);
}
