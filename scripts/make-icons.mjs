#!/usr/bin/env node
/* Optional dev tool: renders icons/icon.svg to the PNG sizes the web-app manifest and iOS need.
   The PNGs are committed, so you only run this if you change the artwork:  npx playwright install chromium && node scripts/make-icons.mjs */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let chromium; try { ({ chromium } = await import('playwright')); } catch { console.error('Needs the dev dependency: npm install'); process.exit(1); }
const svg = readFileSync(join(root, 'icons', 'icon.svg'), 'utf8');
// "maskable" keeps the artwork inside the central 80% safe zone and fills the whole square
const maskable = svg.replace('<rect width="512" height="512" rx="112"', '<rect width="512" height="512" rx="0"').replace('scale(10.4)', 'scale(8.2)');
const full = svg.replace('rx="112"', 'rx="0"');
const jobs = [['icon-192.png', 192, svg], ['icon-512.png', 512, svg], ['icon-maskable-512.png', 512, maskable], ['apple-touch-icon.png', 180, full]];
const b = await chromium.launch(); const ctx = await b.newContext({ deviceScaleFactor: 1 });
for (const [name, size, src] of jobs) {
  const p = await ctx.newPage(); await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${src}`);
  writeFileSync(join(root, 'icons', name), await p.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })); await p.close(); console.log('icons/' + name);
}
await b.close();
