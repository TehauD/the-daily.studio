#!/usr/bin/env node
/* Dev tool: regenerates every brand asset from scripts/brand-mark.mjs. The outputs are committed, so you only run this if you change the artwork.
     npm install && npx playwright install chromium && node scripts/make-brand.mjs
   Writes icons/ (app icon, PNG sizes, mark SVGs, favicon, social card) and docs/brand/ (mark SVGs, brand sheet). */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { markInner, markSvg, BRAND as B } from './brand-mark.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), w = (p, d) => { mkdirSync(dirname(join(root, p)), { recursive: true }); writeFileSync(join(root, p), d); console.log(p); };
let chromium; try { ({ chromium } = process.env.PLAYWRIGHT_PATH ? createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH) : await import('playwright')); } catch { console.error('Needs the dev dependency: npm install'); process.exit(1); }
const font = (fam, f) => `@font-face{font-family:"${fam}";src:url(data:font/woff2;base64,${readFileSync(join(root, 'src/fonts', f)).toString('base64')}) format("woff2");font-weight:100 900}`;
const FONTS = font('Inter', 'inter-latin-wght.woff2') + font('Montserrat', 'montserrat-latin-wght.woff2');

/* ---- SVG files ---- */
const mk = o => markSvg(o);
w('icons/mark-dark.svg', mk({ hex: B.sage, ink: B.paper }) + '\n');
w('icons/mark-light.svg', mk({ hex: B.deep, ink: B.black }) + '\n');
w('docs/brand/mark-dark.svg', mk({ hex: B.sage, ink: B.paper }) + '\n');
w('docs/brand/mark-light.svg', mk({ hex: B.deep, ink: B.black }) + '\n');
const fav = markSvg({ hex: B.deep, ink: B.black, bars: false, k: 1.7, cls: true }).replace('>', `><style>.h{stroke:${B.deep}}.i{stroke:${B.black}}@media(prefers-color-scheme:dark){.h{stroke:${B.sage}}.i{stroke:${B.paper}}}</style>`);
w('icons/favicon.svg', fav + '\n');
const tile = (rx, scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a211e"/><stop offset="1" stop-color="${B.black}"/></linearGradient></defs><rect width="512" height="512" rx="${rx}" fill="url(#g)"/><g transform="translate(256 262) scale(${scale}) translate(-50 -50)">${markInner({ hex: B.sage, ink: B.paper })}</g></svg>`;
const icon = tile(112, 3.7), full = tile(0, 3.7), maskable = tile(0, 3.0);
w('icons/icon.svg', icon + '\n');

/* ---- PNGs ---- */
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: process.env.NO_SANDBOX ? ['--no-sandbox'] : [] });
const shot = async (name, wd, ht, html, scale = 1) => { const ctx = await b.newContext({ deviceScaleFactor: scale }), p = await ctx.newPage(); await p.setViewportSize({ width: wd, height: ht }); await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
  writeFileSync(join(root, name), await p.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: wd, height: ht } })); await ctx.close(); console.log(name); };
const svgPage = (svg, size) => `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`;
for (const [name, size, svg] of [['icons/icon-192.png', 192, icon], ['icons/icon-512.png', 512, icon], ['icons/icon-maskable-512.png', 512, maskable], ['icons/apple-touch-icon.png', 180, full]]) await shot(name, size, size, svgPage(svg, size));

/* social card 1200 x 630 */
const card = `<style>${FONTS}html,body{margin:0}body{width:1200px;height:630px;background:radial-gradient(900px 520px at 22% 40%,#1b2a23 0%,${B.black} 70%);color:${B.paper};font-family:Inter;display:flex;align-items:center;gap:56px;padding:0 84px;box-sizing:border-box;position:relative;overflow:hidden}
.m{width:330px;height:330px;flex:none}.t h1{font:700 74px/1 Montserrat;letter-spacing:-.02em;margin:0}.t h1 span{color:${B.sage}}.t h2{font:600 24px Montserrat;letter-spacing:.34em;color:${B.sage};margin:26px 0 0}.t p{font:400 27px/1.45 Inter;color:#9fb0a7;margin:30px 0 0;max-width:600px}
.bar{position:absolute;left:0;right:0;bottom:0;height:8px;background:linear-gradient(90deg,${B.deep},${B.sage} 60%,${B.gold})}</style>
<div class="m">${markSvg({ hex: B.sage, ink: B.paper })}</div><div class="t"><h1>the-daily<span>.studio</span></h1><h2>WRITE. PLAY. CREATE.</h2><p>A songwriter’s workspace that lives in your browser. No account, nothing uploaded.</p></div><div class="bar"></div>`;
await shot('icons/social-card.png', 1200, 630, card);

/* brand sheet 1536 x 1024 (uses the dark app screenshot when present) */
const appShot = existsSync(join(root, 'docs/screenshots/01-rig-dark.png')) ? 'data:image/png;base64,' + readFileSync(join(root, 'docs/screenshots/01-rig-dark.png')).toString('base64') : '';
const sw = (hex, name) => `<div class="sw"><i style="background:${hex}"></i><b>${hex.slice(1).toUpperCase()}</b><span>${name}</span></div>`;
const sheet = `<style>${FONTS}html,body{margin:0}body{width:1536px;height:1024px;background:${B.black};color:${B.paper};font-family:Inter;display:grid;grid-template-columns:1.15fr 1fr;grid-template-rows:440px 1fr 1fr;gap:1px;background:#1e2622}
section{background:${B.black};padding:28px;box-sizing:border-box;position:relative;overflow:hidden}h6{margin:0 0 14px;font:600 11px Montserrat;letter-spacing:.2em;color:#7e8d85}.hero{display:flex;gap:36px;align-items:center;grid-row:1}.hero .m{width:250px;flex:none}.hero h1{font:700 60px/1 Montserrat;margin:0;letter-spacing:-.02em}.hero h1 span{color:${B.sage}}
.hero h2{font:600 18px Montserrat;letter-spacing:.34em;color:${B.sage};margin:20px 0 0}.hero p{font:400 17px/1.55 Inter;color:#a5b3ab;margin:20px 0 0;max-width:420px}.shot{padding:0;display:flex;align-items:center;justify-content:center;background:#0a0c0d}.shot img{width:100%;height:100%;object-fit:cover;object-position:left top}
.row{display:flex;gap:26px;align-items:center}.pal{display:flex;gap:12px}.sw{width:112px}.sw i{display:block;height:84px;border-radius:6px;border:1px solid #2d3833}.sw b{display:block;font:600 12px Inter;margin-top:8px}.sw span{font:400 11px Inter;color:#7e8d85}
.type{display:flex;gap:40px;align-items:flex-end}.aa{font:600 96px/1 Montserrat}.type div b{display:block;font:700 22px Montserrat}.type div span{font:400 12px Inter;color:#7e8d85}.row2{grid-column:1 / span 2}
.logos{display:flex;gap:34px;align-items:center}.logos .tile{display:flex;align-items:center;justify-content:center}</style>
<section class="hero"><div class="m">${markSvg({ hex: B.sage, ink: B.paper })}</div><div><h1>the-daily<span>.studio</span></h1><h2>WRITE. PLAY. CREATE.</h2><p>A songwriter’s workspace that lives in your browser: catch an idea, find the chords, record guitar and vocals, split a track into stems, keep every song on your own device.</p></div></section>
<section class="shot">${appShot ? `<img src="${appShot}">` : ''}</section>
<section><h6>MARK · VARIATIONS</h6><div class="logos"><div style="width:130px">${markSvg({ hex: B.sage, ink: B.paper })}</div><div style="width:130px">${markSvg({ hex: B.paper, ink: B.paper })}</div><div class="tile" style="width:130px;height:130px;background:${B.sage};border-radius:10px"><div style="width:100px">${markSvg({ hex: B.black, ink: B.black })}</div></div><div class="tile" style="width:150px;height:130px;background:${B.paper};border-radius:10px"><div style="width:100px">${markSvg({ hex: B.deep, ink: B.black })}</div></div></div></section>
<section><h6>APP ICON · FAVICON</h6><div class="row"><div style="width:130px;filter:drop-shadow(0 6px 14px #000a)">${icon}</div><div style="width:48px">${markSvg({ hex: B.sage, ink: B.paper, bars: false, k: 1.6 })}</div><div style="width:28px">${markSvg({ hex: B.sage, ink: B.paper, bars: false, k: 1.8 })}</div><div style="width:16px">${markSvg({ hex: B.sage, ink: B.paper, bars: false, k: 2 })}</div></div></section>
<section><h6>COLOUR</h6><div class="pal">${sw(B.sage, 'Sage')}${sw(B.deep, 'Deep green')}${sw(B.black, 'Charcoal')}${sw(B.paper, 'Paper')}${sw(B.gold, 'Gold')}</div></section>
<section><h6>TYPOGRAPHY</h6><div class="type"><div class="aa">Aa</div><div><span>HEADINGS</span><b>Montserrat</b><span>Bold · SemiBold · Medium</span></div><div style="font-family:Inter"><span>BODY</span><b style="font-family:Inter;font-weight:600">Inter</b><span>Regular · Medium</span></div></div></section>`;
await shot('docs/brand/brand-sheet.png', 1536, 1024, sheet);
await b.close();
