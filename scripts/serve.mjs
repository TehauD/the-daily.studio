#!/usr/bin/env node
/* Tiny zero-dependency static server for local use: `npm start` → http://localhost:8080 (opens your browser).
   localhost counts as a secure context, so microphone, camera and MIDI work without HTTPS.
   PORT=9000 npm start  ·  NO_OPEN=1 npm start (do not open a browser tab) */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, join, normalize, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.md': 'text/markdown; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  try {
    // URL paths always use "/", but normalize() turns them into "\" on Windows, so test for both
    let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\]*\.\.(?:[/\\]|$))+/, '');
    if (p === '.' || p === sep || p === '/' || p === '\\' || /[/\\]$/.test(p)) p = join(p, 'index.html');
    const full = join(root, p); if (!full.startsWith(root)) throw 0;
    const data = await readFile(full); res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
function listen(port, tries) {
  server.once('error', e => { if (e.code === 'EADDRINUSE' && tries < 10) { console.log(`Port ${port} is busy, trying ${port + 1}…`); listen(port + 1, tries + 1); } else { console.error('Could not start the server:', e.message); process.exit(1); } });
  server.listen(port, () => {
    const url = `http://localhost:${port}/`; console.log(`the-daily.studio → ${url}  (Ctrl+C to stop)`);
    if (process.env.NO_OPEN || !process.stdout.isTTY) return;
    try { const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]]; const c = spawn(cmd, args, { stdio: 'ignore', detached: true }); c.on('error', () => { }); c.unref(); } catch (e) { }
  });
}
listen(+process.env.PORT || 8080, 0);
