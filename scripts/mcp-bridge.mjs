#!/usr/bin/env node
/* the-daily.studio · MCP bridge: lets an AI agent that speaks MCP over stdio (Claude Desktop, Claude Code, Cursor…) make music with the studio.

   The studio is a web page, and its agent tools live in the page (WebMCP, window.dailyStudio). This opens the page in a headless browser on your own
   computer, offers every one of those tools over MCP, and adds three that need a computer rather than a page: save_audio (the mix as a WAV file),
   save_export (the song as text) and screenshot. Nothing goes anywhere but your own disk: the page runs locally, the only network use is loading the
   studio itself (or none, with --dist), and files are written only inside --out.

     node scripts/mcp-bridge.mjs [--dist dist] [--url https://the-daily.studio/] [--out ./the-daily-output] [--profile <dir>] [--headed]
   --dist serves the built site from a folder (npm run build:site) on 127.0.0.1; --url opens a studio that is already hosted. Default: ./dist if it
   exists, else the live site. --profile keeps songs between runs (otherwise each run starts with an empty studio).
   In Claude Desktop / Claude Code:   { "command": "node", "args": ["/path/to/the-daily.studio/scripts/mcp-bridge.mjs", "--dist", "/path/to/dist"] }
   Needs Playwright with a Chromium (npm install in this repo; set CHROMIUM_PATH to use another; NO_SANDBOX=1 in a container). */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, extname, relative, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : null; };
const OUT = resolve(opt('out') || 'the-daily-output'), log = (...a) => console.error('[the-daily mcp]', ...a);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.xml': 'application/xml' };
const SAFE_EXT = { save_audio: ['.wav'], save_export: ['.txt', '.md', '.cho', '.chordpro'], screenshot: ['.png'] };

/** a file path inside the output folder, or an error: the agent may write only there, and only these kinds of file */
export function safePath(out, name, tool) {
  const p = resolve(out, String(name || '')), rel = relative(out, p);
  if (!name || rel.startsWith('..') || isAbsolute(rel) || rel === '') throw new Error('The file must be inside the output folder (' + out + '): use a plain name such as "song.wav".');
  if (!SAFE_EXT[tool].includes(extname(p).toLowerCase())) throw new Error('A file from ' + tool + ' must end in ' + SAFE_EXT[tool].join(' or ') + '.');
  return p;
}
const slug = s => String(s || 'song').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'song';

function staticServer(dir) {
  const srv = createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = resolve(dir, '.' + p);
    if (!f.startsWith(dir) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, url: 'http://127.0.0.1:' + srv.address().port + '/' })));
}

const BRIDGE_TOOLS = [
  { name: 'save_audio', description: 'Mix the open song to audio (the same signal as playing it, faster than real time) and save it as a WAV file in the output folder. Returns the path, the size, and the measurements render_audio gives (loudness, balance, advice).',
    inputSchema: { type: 'object', properties: { file: { type: 'string', description: 'File name inside the output folder, ending in .wav. Default: the song title.' }, bits: { type: 'number', enum: [16, 24], description: '16 (default) or 24 bit.' }, tail: { type: 'number', description: 'Seconds of ring-out after the last bar, 0–8 (default 2).' } }, additionalProperties: false }, annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false } },
  { name: 'save_export', description: 'Save the open song as text in the output folder: ultimate_guitar (chords over words with tab), chordpro, lyrics or tab.',
    inputSchema: { type: 'object', properties: { format: { type: 'string', enum: ['ultimate_guitar', 'chordpro', 'lyrics', 'tab'] }, file: { type: 'string', description: 'File name inside the output folder, ending in .txt, .md or .cho. Default: the song title.' } }, required: ['format'], additionalProperties: false }, annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false } },
  { name: 'screenshot', description: 'Save a picture of the studio as it is now (the visuals, the song, the open panel) as a PNG in the output folder.',
    inputSchema: { type: 'object', properties: { file: { type: 'string', description: 'File name inside the output folder, ending in .png.' } }, additionalProperties: false }, annotations: { readOnlyHint: false, openWorldHint: false } }
];

/** Playwright from this repo's node_modules, or wherever Node finds it (NODE_PATH, a global install) */
async function loadPlaywright() {
  try { return await import('playwright'); } catch (e) { /* not an ES-module lookup away: try Node's other resolution */ }
  try { return createRequire(import.meta.url)('playwright'); } catch (e) { throw new Error('Playwright is not installed. Run "npm install" in the the-daily.studio folder (and "npx playwright install chromium" if it has no browser).'); }
}
async function main() {
  const { chromium } = await loadPlaywright();
  let site = opt('url'), srv = null; const dist = opt('dist') ? resolve(opt('dist') === true ? join(root, 'dist') : opt('dist')) : null;
  if (!site || site === true) { const d = dist || (existsSync(join(root, 'dist', 'index.html')) ? join(root, 'dist') : null); if (d) { const s = await staticServer(d); srv = s.srv; site = s.url; } else site = 'https://the-daily.studio/'; }
  mkdirSync(OUT, { recursive: true });
  const launch = { headless: !opt('headed'), args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'].concat(process.env.NO_SANDBOX ? ['--no-sandbox'] : []) };
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  let ctx, browser; const prof = opt('profile');
  if (prof && prof !== true) { ctx = await chromium.launchPersistentContext(resolve(prof), Object.assign({ viewport: { width: 1360, height: 860 } }, launch)); } else { browser = await chromium.launch(launch); ctx = await browser.newContext({ viewport: { width: 1360, height: 860 } }); }
  const page = ctx.pages()[0] || await ctx.newPage(); page.on('pageerror', e => log('page error:', e.message));
  await page.goto(site, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.dailyStudio && window.dailyStudio.tools().length > 0, null, { timeout: 60000 });
  await page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 30000 }).catch(() => { }); await page.mouse.click(4, 4).catch(() => { });
  log('the studio is open at', site, '· files go to', OUT);
  const pageTools = () => page.evaluate(() => window.dailyStudio.tools()), call = (n, i) => page.evaluate(([n, i]) => window.dailyStudio.call(n, i || {}), [n, i]);
  const text = (t, err) => ({ content: [{ type: 'text', text: typeof t === 'string' ? t : JSON.stringify(t, null, 1) }], structuredContent: typeof t === 'object' ? t : undefined, isError: !!err || undefined });

  async function tool(name, a) {
    if (name === 'save_audio') {
      const r = await page.evaluate(o => window.dailyStudio.render(o), { bits: a.bits === 24 ? 24 : 16, tail: a.tail }); const title = await page.evaluate(() => window.dailyStudio.call('get_song', { include_lyrics: false }).then(x => x.structuredContent && x.structuredContent.title));
      const f = safePath(OUT, a.file || slug(title) + '.wav', 'save_audio'); writeFileSync(f, Buffer.from(r.wav_base64, 'base64'));
      return text({ saved: f, bytes: r.bytes, seconds: r.seconds, sample_rate: r.sample_rate, bits: r.bits, metrics: r.metrics });
    }
    if (name === 'save_export') {
      const r = await call('export_song', { format: a.format }); if (r.isError) return r; const title = await page.evaluate(() => window.dailyStudio.call('get_song', { include_lyrics: false }).then(x => x.structuredContent && x.structuredContent.title));
      const f = safePath(OUT, a.file || slug(title) + '.txt', 'save_export'); const body = r.content[0].text; writeFileSync(f, body); return text({ saved: f, bytes: Buffer.byteLength(body) });
    }
    if (name === 'screenshot') { const f = safePath(OUT, a.file || 'studio.png', 'screenshot'); await page.screenshot({ path: f }); return text({ saved: f }); }
    return call(name, a);
  }
  const send = o => process.stdout.write(JSON.stringify(o) + '\n');
  const handle = async m => {
    const id = m.id, reply = r => id != null && send({ jsonrpc: '2.0', id, result: r }), fail = (code, message) => id != null && send({ jsonrpc: '2.0', id, error: { code, message } });
    try {
      if (m.method === 'initialize') return reply({ protocolVersion: (m.params && m.params.protocolVersion) || '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'the-daily-studio', version: await page.evaluate(() => window.dailyStudio.app) }, instructions: 'Make music with the-daily.studio. Start with get_music_guide, write the song (write_song, load_chord_sheet, add_section, write_drums, write_notes), hear it as numbers with render_audio, and save it with save_audio.' });
      if (m.method === 'ping') return reply({});
      if (m.method === 'tools/list') return reply({ tools: (await pageTools()).map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: Object.assign({ openWorldHint: false }, t.annotations) })).concat(BRIDGE_TOOLS) });
      if (m.method === 'tools/call') { const p = m.params || {}; let r; try { r = await tool(p.name, p.arguments || {}); } catch (e) { r = text('Error: ' + (e && e.message || e), true); } return reply(r); }
      if (m.method && m.method.startsWith('notifications/')) return;
      fail(-32601, 'Method not found: ' + m.method);
    } catch (e) { fail(-32603, e && e.message || String(e)); }
  };
  const rl = createInterface({ input: process.stdin }); let busy = Promise.resolve();
  rl.on('line', line => { if (!line.trim()) return; let m; try { m = JSON.parse(line); } catch (e) { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); return; } busy = busy.then(() => handle(m)); });
  rl.on('close', async () => { await busy.catch(() => { }); try { await ctx.close(); } catch (e) { } if (browser) await browser.close().catch(() => { }); if (srv) srv.close(); process.exit(0); });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main().catch(e => { console.error('the-daily mcp: ' + e.message); process.exit(1); });
