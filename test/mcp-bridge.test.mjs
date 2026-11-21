/* The MCP bridge (scripts/mcp-bridge.mjs): an agent that speaks MCP over stdio makes music with the studio, hears it as numbers, and saves a WAV.
   It starts the bridge on the built site (npm run build:site first), talks JSON-RPC to it, and checks the files it writes. Needs Playwright's Chromium
   (CHROMIUM_PATH, NO_SANDBOX=1 in a container). Run: node test/mcp-bridge.test.mjs */
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safePath } from '../scripts/mcp-bridge.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), out = mkdtempSync(join(tmpdir(), 'daily-mcp-'));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
/* the file rules, without a browser */
let e1 = '', e2 = '', e3 = ''; try { safePath(out, '../x.wav', 'save_audio'); } catch (e) { e1 = e.message; } try { safePath(out, '/etc/passwd', 'save_audio'); } catch (e) { e2 = e.message; } try { safePath(out, 'song.exe', 'save_audio'); } catch (e) { e3 = e.message; }
ok(/inside the output folder/.test(e1) && /inside the output folder/.test(e2) && /must end in/.test(e3) && safePath(out, 'a.wav', 'save_audio') === join(out, 'a.wav'), 'files are written only inside the output folder, and only as .wav, text or .png');
const child = spawn(process.execPath, [join(root, 'scripts/mcp-bridge.mjs'), '--dist', join(root, 'dist'), '--out', out], { stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
let buf = '', err = ''; const waiting = new Map(); let n = 0;
child.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue; const m = JSON.parse(line); const w = waiting.get(m.id); if (w) { waiting.delete(m.id); w(m); } } });
child.stderr.on('data', d => { err += d; });
const rpc = (method, params, ms = 90000) => new Promise((res, rej) => { const id = ++n; const t = setTimeout(() => rej(new Error('timeout: ' + method + '\n' + err.slice(-400))), ms); waiting.set(id, m => { clearTimeout(t); res(m); }); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
const call = async (name, args) => { const r = await rpc('tools/call', { name, arguments: args || {} }); return r.result; };
try {
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  ok(init.result && init.result.serverInfo.name === 'the-daily-studio' && init.result.capabilities.tools && /get_music_guide/.test(init.result.instructions), 'it starts the studio and answers initialize');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const list = (await rpc('tools/list')).result.tools, names = list.map(t => t.name);
  ok(['write_song', 'write_notes', 'write_drums', 'render_audio', 'get_music_guide', 'arrange_sections', 'save_audio', 'save_export', 'screenshot'].every(x => names.includes(x)) && list.every(t => t.inputSchema && t.description), 'tools/list offers the studio\'s tools and the three the bridge adds (' + names.length + ' tools)');
  ok((await rpc('ping')).result && (await rpc('nope')).error.code === -32601, 'ping answers, an unknown method is an error');
  const w = await call('write_song', { lyrics: '[Verse]\nSalt wind on the water\nLights along the harbour\n[Chorus]\nHold on, hold on', key: 'A', progression: 'i VI III VII', bpm: 100, title: 'Bridge Test' });
  ok(!w.isError && w.structuredContent.done, 'a tool call reaches the studio: write_song made a song');
  const nt = await call('write_notes', { part: 'bass', section: 'Verse', notes: [{ bar: 1, note: 'A1', length: 8 }, { bar: 2, note: 'F1', length: 8 }] });
  ok(!nt.isError && nt.structuredContent.written === 2, 'write_notes wrote a bass line');
  const bad = await call('write_notes', { part: 'bass', section: 'Verse', notes: [{ bar: 50, note: 'A1' }] }); ok(bad.isError && /bar must be/.test(bad.content[0].text), 'a refused call comes back as an error with the reason');
  const rd = await call('render_audio', { tail: 1 }); ok(!rd.isError && rd.structuredContent.duration_s > 5 && typeof rd.structuredContent.loudness_lufs === 'number', 'render_audio measures the mix (' + rd.structuredContent.loudness_lufs + ' LUFS)');
  const sv = await call('save_audio', { file: 'bridge-test.wav' }); const f = sv.structuredContent && sv.structuredContent.saved;
  ok(!sv.isError && f === join(out, 'bridge-test.wav') && existsSync(f) && statSync(f).size > 200000 && readFileSync(f).subarray(0, 4).toString() === 'RIFF' && readFileSync(f).subarray(8, 12).toString() === 'WAVE', 'save_audio writes a real WAV file (' + (statSync(f).size / 1e6).toFixed(1) + ' MB)');
  const ex = await call('save_export', { format: 'chordpro', file: 'bridge-test.cho' }); ok(!ex.isError && /\[Am\]|\[A\]/.test(readFileSync(join(out, 'bridge-test.cho'), 'utf8')), 'save_export writes the song as ChordPro');
  const sh = await call('screenshot', { file: 'bridge-test.png' }); ok(!sh.isError && readFileSync(join(out, 'bridge-test.png')).subarray(1, 4).toString() === 'PNG', 'screenshot writes a PNG');
  const esc = await call('save_audio', { file: '../outside.wav' }); ok(esc.isError && /inside the output folder/.test(esc.content[0].text) && !existsSync(join(out, '..', 'outside.wav')), 'a file outside the output folder is refused');
} catch (e) { ok(false, 'bridge test failed: ' + e.message); }
child.stdin.end(); await new Promise(r => { const t = setTimeout(() => { child.kill(); r(); }, 8000); child.on('close', () => { clearTimeout(t); r(); }); });
rmSync(out, { recursive: true, force: true });
console.log(fails ? '\n' + fails + ' FAILED' : '\nmcp-bridge: all checks passed'); process.exit(fails ? 1 : 0);
