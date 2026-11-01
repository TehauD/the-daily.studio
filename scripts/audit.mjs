#!/usr/bin/env node
/* Release audit: licences, provenance and network surface. Run after `npm run build:site`:  npm run audit
   It compares what is REALLY shipped (dist/, the lockfile, src/, samples/) with what the documents say
   (docs/LICENSING.md, THIRD_PARTY_NOTICES.md, PRIVACY.md) and fails when they disagree:
     · no runtime dependencies; every development dependency under a permissive licence
     · every file in dist/ is in the register; no audio, video, raster image or binary blob hides inside the pages
     · every font has its licence text; every sample track has a licence line
     · every host named anywhere in the source is known; the only hosts the page can LOAD from are the two MediaPipe ones, and the notices say so
     · every place the code can make a network request is one we know about (a new one fails until it is reviewed)
     · no over-claiming phrases ("100% private", "completely offline", ...)
   What it cannot do is watch a browser. For that, test/e2e-privacy.cjs counts real requests. */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), dist = join(root, 'dist');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; return c; };
const rd = f => readFileSync(join(root, f), 'utf8'), has = f => existsSync(join(root, f));
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const pkg = JSON.parse(rd('package.json')), lock = JSON.parse(rd('package-lock.json')), ver = pkg.version;

/* ---------- 1 · dependencies ---------- */
console.log('\nDependencies');
ok(!Object.keys(pkg.dependencies || {}).length && !Object.keys(pkg.optionalDependencies || {}).length && !Object.keys(pkg.peerDependencies || {}).length, 'package.json has no runtime dependencies');
const entries = Object.entries(lock.packages || {}).filter(([k]) => k);
const runtime = entries.filter(([, v]) => !v.dev && !v.devOptional);
ok(runtime.length === 0, 'the lockfile has no runtime packages' + (runtime.length ? ': ' + runtime.map(([k]) => k).join(', ') : ''));
const OK_LIC = new Set(['MIT', 'MIT-0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'BlueOak-1.0.0', 'CC0-1.0', '0BSD', 'Unlicense']);
const lic = new Map(), unknown = [], odd = [];
for (const [k, v] of entries) {
  let l = v.license; if (!l && has(join(k, 'package.json'))) { try { const p = JSON.parse(rd(join(k, 'package.json'))); l = p.license || (p.licenses || []).map(x => x.type).join(' OR '); } catch { } }
  if (!l) { unknown.push(k); continue; } (lic.get(l) || lic.set(l, []).get(l)).push(k);
  if (!String(l).split(/\s+(?:OR|AND)\s+|[()]/).map(x => x.trim()).filter(Boolean).every(x => OK_LIC.has(x))) odd.push(k + ' (' + l + ')');
}
ok(unknown.length === 0, 'every package states a licence' + (unknown.length ? ' · missing: ' + unknown.join(', ') : ' (' + entries.length + ' packages)'));
ok(odd.length === 0, 'every licence is permissive: ' + [...lic].map(([l, a]) => l + ' ' + a.length).join(', ') + (odd.length ? ' · NOT ALLOWED: ' + odd.join(', ') : ''));

/* ---------- 2 · what ships, against the register ---------- */
console.log('\nShipped files');
const reg = rd('docs/LICENSING.md'), tokens = new Set([...reg.matchAll(/`([^`\n]+)`/g)].map(m => m[1]));
const covered = rel => tokens.has(rel) || [...tokens].some(t => t.endsWith('/') && rel.startsWith(t));
if (!ok(existsSync(dist), 'dist/ exists (run npm run build:site first)')) { console.log('\n' + bad + ' check(s) failed'); process.exit(1); }
const files = walk(dist).map(f => relative(dist, f).split('\\').join('/')), loose = files.filter(f => !covered(f));
ok(loose.length === 0, files.length + ' shipped files are all in docs/LICENSING.md' + (loose.length ? ' · not listed: ' + loose.join(', ') : ''));
const served = (reg.split(/^## What the site serves$/m)[1] || '').split(/^### /m)[0], named = [...served.matchAll(/^\|\s*((?:`[^`]+`(?:,\s*)?)+)\s*\|/gm)].flatMap(m => [...m[1].matchAll(/`([^`]+)`/g)].map(x => x[1]));
const stale = named.filter(t => !t.endsWith('/') && !files.includes(t) && !/^(Path)$/.test(t));
ok(stale.length === 0, 'every file the register names is really shipped' + (stale.length ? ' · missing: ' + stale.join(', ') : ''));
ok(reg.includes('v' + ver), 'the register was audited for this version (v' + ver + ')');

/* pages: nothing hidden inside */
const pages = files.filter(f => /\.html$/.test(f));
for (const f of pages) {
  const s = readFileSync(join(dist, f), 'utf8'), uris = [...s.matchAll(/data:([a-z0-9.+\-/]+)[;,]/gi)].map(m => m[1].toLowerCase());
  const banned = uris.filter(u => /^(audio|video)\/|^image\/(png|jpe?g|gif|webp|avif|bmp)|octet-stream|wasm|zip/.test(u));
  ok(banned.length === 0, f + ': no embedded audio, video, raster image or binary (' + [...new Set(uris)].join(', ') + (banned.length ? ' · BANNED ' + banned.join(', ') : '') + ')');
  const blobs = [...s.matchAll(/[A-Za-z0-9+/=]{4000,}/g)].map(m => Buffer.from(m[0], 'base64')), kinds = blobs.map(b => b.subarray(0, 4).toString('latin1') === 'wOF2' ? 'font' : /^\s*<!doctype html/i.test(b.subarray(0, 64).toString('utf8')) ? 'page' : 'UNKNOWN');
  const inner = blobs.filter((_, i) => kinds[i] === 'page').map(b => b.toString('utf8')).join('\n');   // an embedded page (The Daily's About) gets the same scrutiny as the page around it
  ok(!kinds.includes('UNKNOWN'), f + ': every long encoded blob is a font or an embedded first-party page (' + (kinds.join(', ') || 'none') + ')');
  ok(!/<script[^>]+\bsrc=|<link[^>]+href=["']?https?:|<img[^>]+src=["']?https?:|<iframe|data:(audio|video|image\/(png|jpe?g|gif|webp))/i.test(inner), f + ': the embedded page loads nothing from anywhere');
  ok(!/<script[^>]+\bsrc=|<link[^>]+rel=["']?(stylesheet|preload|modulepreload)[^>]+href=["']?https?:/i.test(s), f + ': no external script or stylesheet tag');
}
const ws = readdirSync(join(root, 'src/fonts')).filter(f => /\.woff2$/.test(f));
const idx = readFileSync(join(dist, 'index.html'), 'utf8');
ok((idx.match(/data:font\/woff2/g) || []).length === ws.length, 'index.html embeds exactly the ' + ws.length + ' fonts in src/fonts');

/* fonts */
console.log('\nFonts');
const notices = rd('THIRD_PARTY_NOTICES.md');
for (const w of ws) {
  const name = w.split('-')[0], OFL = 'src/fonts/OFL-' + name[0].toUpperCase() + name.slice(1) + '.txt';
  ok(has(OFL) && /SIL OPEN FONT LICENSE/i.test(rd(OFL)), name + ': licence text present (' + OFL + ')');
  ok(tokens.has('src/fonts/' + w) && new RegExp(name, 'i').test(notices) && /Copyright\b.*Project Authors/.test(rd(OFL).split('\n')[0]), name + ': in the register and the notices, copyright line present');
}
ok(files.includes('legal/index.html') && /SIL OPEN FONT LICENSE/.test(readFileSync(join(dist, 'legal/index.html'), 'utf8')) && /MIT License/.test(readFileSync(join(dist, 'legal/index.html'), 'utf8')), 'the site carries its own licence, notices and font licences at /legal/');

/* samples */
console.log('\nSample tracks');
const AUDIO = /\.(m4a|mp3|wav|ogg|oga|opus|flac|aac|webm|mp4|aif|aiff)$/i, sf = has('samples') ? readdirSync(join(root, 'samples')) : [], sa = sf.filter(f => AUDIO.test(f));
const sl = has('samples/LICENSE.md') ? rd('samples/LICENSE.md') : '', unlisted = sa.filter(f => !sl.includes(f));
ok(unlisted.length === 0, sa.length ? sa.length + ' sample track(s), each with a licence line in samples/LICENSE.md' + (unlisted.length ? ' · missing: ' + unlisted.join(', ') : '') : 'no audio is shipped');
const mf = JSON.parse(rd('samples/manifest.json')); ok((mf.tracks || []).length === sa.length, 'samples/manifest.json lists exactly the tracks present (' + (mf.tracks || []).length + ')');
const anyAudio = walk(root).filter(f => !/node_modules|[\\/]dist[\\/]|[\\/]test[\\/]|[\\/]\.git[\\/]/.test(f) && AUDIO.test(f));
ok(anyAudio.length === sa.length, 'no stray audio files anywhere else in the repository' + (anyAudio.length !== sa.length ? ': ' + anyAudio.map(f => relative(root, f)).join(', ') : ''));

/* ---------- 3 · hosts and network call sites ---------- */
console.log('\nNetwork surface');
const LOAD = ['cdn.jsdelivr.net', 'storage.googleapis.com'];                       // the only hosts the page may fetch from, only after a yes
const CONNECT = ['api.github.com'];                                                  // only if the person connects GitHub or opens the community gallery (part 74)
const LINKS = ['the-daily.studio', 'github.com', 'www.linkedin.com', 'developers.google.com', 'www.w3.org', 'cash.app', 'venmo.com'];   // links the person clicks, or XML namespaces; never loaded (cash.app, venmo.com: a $cashtag or @name in the tip jar becomes a link there, for the audience to follow)
const srcFiles = [...readdirSync(join(root, 'src/parts')).filter(f => /\.js$/.test(f)).map(f => 'src/parts/' + f), 'src/body.html', 'src/styles.css', 'scripts/build.mjs'].filter(has);
const seen = new Map();
for (const f of srcFiles) for (const m of rd(f).matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) { const h = m[1].toLowerCase().replace(/\.$/, ''); (seen.get(h) || seen.set(h, new Set()).get(h)).add(f.replace('src/parts/', '')); }
const unknownHosts = [...seen.keys()].filter(h => !LOAD.includes(h) && !CONNECT.includes(h) && !LINKS.includes(h) && h !== 'localhost');
ok(unknownHosts.length === 0, 'every web address in the source is a known host (' + [...seen.keys()].sort().join(', ') + ')' + (unknownHosts.length ? ' · NEW: ' + unknownHosts.map(h => h + ' in ' + [...seen.get(h)].join(', ')).join('; ') : ''));
const meta = (idx.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '', cspHosts = [...new Set(meta.match(/https:\/\/[a-z0-9.-]+/g) || [])].map(h => h.slice(8)).sort();
ok(cspHosts.join() === [...LOAD, ...CONNECT].sort().join(), 'the security policy lets the page connect to exactly ' + LOAD.concat(CONNECT).join(', ') + ' (' + cspHosts.join(', ') + ')');
ok(/default-src 'self'/.test(meta) && !/\*/.test(meta.replace(/\*\//g, '')), 'the security policy has no wildcard host');
const priv = rd('PRIVACY.md');
ok(CONNECT.every(h => priv.includes(h) && reg.includes(h)), 'PRIVACY.md and the register name ' + CONNECT.join(', ') + ' and when it is used');
ok(LOAD.every(h => priv.includes(h) && notices.includes(h === 'cdn.jsdelivr.net' ? 'jsDelivr' : 'Google') && reg.includes(h)), 'PRIVACY.md, the notices and the register all name both hosts');
const mpv = (rd('src/parts/09d-camfx.js').match(/tasks-vision@(\d+\.\d+\.\d+)/) || [])[1];
ok(mpv && notices.includes(mpv) && reg.includes(mpv), 'the MediaPipe version in the code (' + mpv + ') is the one in the notices and the register');
ok(['hand_landmarker.task', 'selfie_segmenter.tflite'].every(m => srcFiles.some(f => rd(f).includes(m)) && notices.includes(m) && reg.includes(m)), 'both model files named in the code are in the notices and the register');
ok(/mpConsent\(\)/.test(rd('src/parts/09d-camfx.js')) && /mpConsent\(\)\.then/.test(rd('src/parts/09d-camfx.js')), 'the only loader of MediaPipe asks first (mpConsent)');

/* every place the code can reach the network or load code from elsewhere */
const KNOWN = [
  [/^09d-camfx\.js$/, /import\('https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@\d+\.\d+\.\d+\/vision_bundle\.mjs'\)/, 'MediaPipe code, after consent'],
  [/^20-samples\.js$/, /fetch\('samples\//, 'sample list and tracks, same site'],
  [/^19-touch\.js$/, /serviceWorker\.register\('sw\.js'\)/, 'offline copy, same site'],
  [/^16-stems\.js$/, /new Worker\(url\)/, 'stem worker from a blob made in the page'],
  [/^74-github\.js$/, /fetch\(GH_API \+ path|fetch\('\/auth\/github\/refresh'/, 'GitHub, only after you connect it or open the gallery; the renewal is this site'],
];
const NET = /\bfetch\(|XMLHttpRequest|new WebSocket|EventSource\(|sendBeacon|importScripts\(|(?<![\w.$])import\(|new Worker\(|serviceWorker\.register|\.src\s*=\s*['"`]https?:/;
const hits = [], strange = [];
for (const f of srcFiles.filter(x => x.endsWith('.js'))) rd(f).split('\n').forEach((line, i) => {
  const code = line.replace(/\/\*.*?\*\//g, '').replace(/^\s*\/\/.*$|^\s*\*.*$/, ''); if (!NET.test(code)) return;
  const name = f.replace('src/parts/', ''), k = KNOWN.find(([fr, re]) => fr.test(name) && re.test(code)); k ? hits.push(name + ':' + (i + 1) + ' ' + k[2]) : strange.push(name + ':' + (i + 1) + '  ' + code.trim().slice(0, 110));
});
ok(strange.length === 0, hits.length + ' network or code-loading call sites, all known' + (strange.length ? ' · NEW (review, then add to KNOWN and to the privacy statement): \n    ' + strange.join('\n    ') : ''));

/* ---------- 4 · wording ---------- */
console.log('\nWording');
const OVER = /\b(100\s?% (private|offline|local|secure|safe)|completely offline|zero (network|requests)|never (connects|touches the network)|air-?gapped|military-grade|bank-level|gdpr[- ]compliant|totally private)\b/i;
const say = [...srcFiles, 'README.md', 'PRIVACY.md', 'SECURITY.md', 'docs/USER_GUIDE.md', 'docs/HOSTING.md', 'docs/SECURITY_MODEL.md'].filter(has), over = [];
for (const f of say) rd(f).split('\n').forEach((l, i) => { const m = OVER.exec(l); if (m) over.push(f + ':' + (i + 1) + ' "' + m[0] + '"'); });
ok(over.length === 0, 'no over-claiming phrases in the app text or documents' + (over.length ? ' · ' + over.join('; ') : ''));
ok(/collects nothing|has no server/i.test(priv) && /can be sent over the network/i.test(priv) && /What is kept/i.test(priv), 'PRIVACY.md says what is processed, what can be transmitted and what is retained');

console.log('\nShipped files:');
for (const f of files.sort()) console.log('  ' + String(statSync(join(dist, f)).size).padStart(9) + '  ' + f);
console.log(bad ? `\n${bad} check(s) failed` : '\naudit passed'); process.exit(bad ? 1 : 0);
