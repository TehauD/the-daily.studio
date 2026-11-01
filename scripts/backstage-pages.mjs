/* the-daily.studio: the hidden pages under /backstage/ (2.23), for developers who found the door.
   Not linked from anywhere a crawler looks, not in the sitemap, noindex, and turned away in robots.txt. Each page checks this browser
   for a Backstage pass (the studio's own settings, in localStorage, same origin) before it shows anything; the pass is the studio's
   console door (part 73c). Of course, anyone can read the source of a static page. That is allowed; it is how developers are.
     /backstage/            the lobby: your pass, the rooms, this build at a glance, the ways in
     /backstage/source/     a map of every part of the page: what it does, how big it is, a link to its source
     /backstage/data/       your data, raw: what this browser keeps for the studio, read-only, straight from storage
     /backstage/api/        window.dailyStudio, WebMCP and the agent tools (docs/AGENT_API.md), and the Backstage shell's commands
     /backstage/changelog/  how it was built: every release, as a timeline (CHANGELOG.md)
   Plus /humans.txt. Each page has one inline script, allowed by its SHA-256 hash, and asks the network for nothing.
   Used by scripts/assemble.mjs. */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { markSvg } from './brand-mark.mjs';

const esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sha = s => "'sha256-" + createHash('sha256').update(s).digest('base64') + "'";

/* ---------------------------------------------------------------- a small Markdown reader (what these two files use) */
function md(src, repoBlob) {
  const link = u => /^(https?:|#|mailto:)/.test(u) ? u : repoBlob + u.replace(/^\.\//, '');
  const inline = x => esc(x).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => '<a href="' + esc(link(u.replace(/&amp;/g, '&'))) + '" rel="noopener noreferrer">' + t + '</a>');
  const lines = src.replace(/\r/g, '').split('\n'), o = []; let para = [], tbl = null, code = null; const stack = [];
  const flush = () => { if (para.length) { o.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  const closeLists = (to = 0) => { while (stack.length > to) { const s = stack.pop(); o.push('</li></' + s.kind + '>'); } };
  const endTbl = () => { if (tbl) { o.push('<div class="tw"><table>' + tbl.map((r, i) => '<tr>' + r.map(c => (i ? '<td>' : '<th>') + inline(c.trim()) + (i ? '</td>' : '</th>')).join('') + '</tr>').join('') + '</table></div>'); tbl = null; } };
  for (const l of lines) {
    if (code) { if (/^\s*```/.test(l)) { o.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>'); code = null; } else code.push(l); continue; }
    if (/^\s*```/.test(l)) { flush(); closeLists(); endTbl(); code = []; continue; }
    if (/^\s*\|.*\|\s*$/.test(l)) { flush(); closeLists(); const cells = l.trim().replace(/^\||\|$/g, '').split('|'); if (cells.every(c => /^\s*:?-{3,}:?\s*$/.test(c))) continue; (tbl = tbl || []).push(cells); continue; }
    endTbl(); let m;
    if ((m = /^(#{1,4})\s+(.*)$/.exec(l))) { flush(); closeLists(); const n = Math.min(4, m[1].length + 1); o.push('<h' + n + '>' + inline(m[2]) + '</h' + n + '>'); continue; }
    if ((m = /^(\s*)(?:([-*])|\d+\.)\s+(.*)$/.exec(l))) {
      flush(); const depth = Math.floor(m[1].length / 2) + 1, kind = m[2] ? 'ul' : 'ol';
      if (stack.length < depth) { stack.push({ kind }); o.push('<' + kind + '><li>'); }
      else { closeLists(depth); o.push('</li><li>'); }
      o.push(inline(m[3])); continue;
    }
    if (!l.trim()) { flush(); if (stack.length) continue; continue; }
    if (stack.length && /^\s{2,}\S/.test(l)) { o.push(' ' + inline(l.trim())); continue; }
    if (/^---+\s*$/.test(l)) { flush(); closeLists(); o.push('<hr>'); continue; }
    closeLists(); para.push(l.trim());
  }
  flush(); closeLists(); endTbl(); return o.join('\n');
}

/* ---------------------------------------------------------------- the look: backstage after dark, the studio's fonts */
const CSS = `@font-face{font-family:"DS Inter";src:url(../fonts/inter-latin-wght.woff2) format("woff2");font-weight:100 900;font-display:swap}
@font-face{font-family:"DS Montserrat";src:url(../fonts/montserrat-latin-wght.woff2) format("woff2");font-weight:100 900;font-display:swap}
:root{color-scheme:dark;--bg:#070b0a;--panel:#0d1412;--raise:#121b18;--line:#1f2b26;--text:#e6ece8;--muted:#8fa497;--green:#3ddc84;--sage:#7dbf9b;--gold:#f7c95a;--blue:#8da9e8;--red:#ff8a9a;
--sans:"DS Inter",Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--display:"DS Montserrat",Montserrat,var(--sans);--mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:radial-gradient(1200px 600px at 80% -10%,rgba(247,201,90,.07),transparent 60%),var(--bg);color:var(--text);font:16px/1.6 var(--sans);min-height:100vh}
a{color:var(--sage);text-underline-offset:3px}a:hover{color:var(--gold)}code,pre,.mono{font-family:var(--mono)}code{font-size:.9em;background:var(--raise);border:1px solid var(--line);border-radius:5px;padding:0 .3em}
.wrap{max-width:980px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-left))}
header.top{border-bottom:1px solid var(--line);background:rgba(7,11,10,.8);backdrop-filter:blur(8px);position:sticky;top:0;z-index:2}header.top .wrap{display:flex;align-items:center;gap:16px;padding-top:10px;padding-bottom:10px}
.brand{display:flex;align-items:center;gap:10px;color:var(--text);text-decoration:none;font:800 15px var(--display)}.brand svg{width:26px;height:26px;color:var(--gold)}.brand i{font-style:normal;color:var(--gold)}
nav.rooms{display:flex;gap:4px;margin-left:auto;overflow-x:auto;scrollbar-width:none;font:600 13px var(--mono)}nav.rooms::-webkit-scrollbar{display:none}nav.rooms a{color:var(--muted);text-decoration:none;padding:5px 10px;border-radius:99px;white-space:nowrap}nav.rooms a:hover{color:var(--text);background:var(--raise)}nav.rooms a[aria-current]{color:#170f02;background:var(--gold)}
main{padding:30px 0 60px}.kicker{font:700 12px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin:0 0 8px}
h1{font:800 clamp(28px,5vw,44px)/1.1 var(--display);letter-spacing:-.02em;margin:0 0 12px}h2{font:800 22px/1.25 var(--display);margin:40px 0 12px}h3{font:700 17px var(--sans);margin:22px 0 8px}h4{font:700 15px var(--sans);margin:16px 0 6px}
p.lead{font-size:18px;color:var(--muted);max-width:70ch}p{margin:0 0 12px}ul,ol{padding-left:1.3em}li{margin:.25em 0}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}.card{display:block;padding:16px;border:1px solid var(--line);border-radius:14px;background:var(--panel);color:inherit;text-decoration:none}a.card:hover{border-color:var(--gold);color:inherit}
.card b{display:block;font-weight:700;margin-bottom:4px}.card span{display:block;color:var(--muted);font-size:14px}.card .mono{color:var(--sage);font-size:12px;margin-top:8px}
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}.stat{padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}.stat b{display:block;font:800 22px var(--display);color:var(--gold)}.stat span{color:var(--muted);font-size:13px}
.pass{position:relative;overflow:hidden;border-radius:18px;padding:22px 24px;background:linear-gradient(135deg,#17110a,#0b100e 60%,#10161a);border:1px solid rgba(247,201,90,.45);max-width:560px;margin:8px 0 10px}
.pass::before{content:"";position:absolute;inset:-40%;background:conic-gradient(from 200deg,transparent,rgba(247,201,90,.16),rgba(125,191,155,.16),rgba(141,169,232,.14),transparent);animation:holo 9s linear infinite}@keyframes holo{to{transform:rotate(1turn)}}@media (prefers-reduced-motion:reduce){.pass::before{animation:none}}
.pass>*{position:relative}.pass .k{font:800 12px var(--display);letter-spacing:.28em;color:var(--gold)}.pass .no{float:right;font:700 22px var(--mono);color:var(--gold)}.pass .n{font:800 22px var(--display);margin:12px 0 2px}.pass .m{font:12px var(--mono);color:#c8bfa8}
table{width:100%;border-collapse:collapse;font-size:14px}.tw{overflow-x:auto;border:1px solid var(--line);border-radius:12px;margin:10px 0}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:600;background:var(--panel);position:sticky;top:0}tr:last-child td{border-bottom:0}
td.num{text-align:right;font-family:var(--mono);white-space:nowrap}td .d{color:var(--muted);font-size:13px;display:block;margin-top:2px}.badge{display:inline-block;font:700 11px var(--mono);color:#170f02;background:var(--sage);border-radius:6px;padding:1px 6px;margin-right:6px}
.bar{height:8px;border-radius:4px;background:linear-gradient(90deg,var(--gold),var(--sage))}
input.find{width:100%;max-width:420px;background:var(--raise);border:1px solid var(--line);border-radius:10px;padding:9px 12px;color:var(--text);font:14px var(--mono);margin:6px 0 4px}
#rec,#lsv{max-height:520px}pre{background:#050807;border:1px solid var(--line);border-radius:12px;padding:12px 14px;overflow:auto;font-size:13px;line-height:1.5;color:#c9e9d6}
.term{background:#050807;border:1px solid var(--line);border-radius:12px;padding:12px 14px;font:13px/1.6 var(--mono);color:#c9e9d6;overflow-x:auto}.term .p{color:var(--green)}.term .c{color:var(--gold)}
details.rel{border:1px solid var(--line);border-radius:12px;background:var(--panel);margin:0 0 8px}details.rel>summary{cursor:pointer;padding:12px 16px;list-style:none;display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}details.rel>summary::-webkit-details-marker{display:none}
details.rel>summary .v{font:700 15px var(--mono);color:var(--gold)}details.rel>summary .t{font-weight:700}details.rel>summary .dt{color:var(--muted);font:12px var(--mono);margin-left:auto}details.rel>div{padding:0 16px 14px;border-top:1px solid var(--line)}
.locked{display:none;text-align:center;padding:80px 0}.locked .door{font-size:64px}html:not(.bks-in) .locked{display:block}html:not(.bks-in) .vault{display:none}
.note{color:var(--muted);font-size:13px}.ok{color:var(--green)}.warn{color:var(--gold)}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:13px;padding:18px 0 30px}footer a{color:var(--muted)}
@media (max-width:560px){h2{margin-top:32px}.pass .no{float:none;display:block}}`;

/* the gate: the studio's settings say whether this browser holds a pass; the page shows itself, or the door */
const GATE = `var B={};try{var c=JSON.parse(localStorage.getItem('fw.cfg')||'{}');B.ok=c.backstage===true;B.pass=c.bksPass||null;}catch(e){B.ok=false;}document.documentElement.classList.toggle('bks-in',!!B.ok);
document.addEventListener('DOMContentLoaded',function(){if(!B.ok)return;var p=B.pass;document.querySelectorAll('[data-pass-no]').forEach(function(e){e.textContent=p?'#'+p.n:'#—';});document.querySelectorAll('[data-pass-at]').forEach(function(e){e.textContent=p?new Date(p.at).toLocaleDateString()+' · build '+(p.build||'?'):'';});});`;

const ROOMS = [['', 'Lobby'], ['source/', 'Source'], ['data/', 'Data'], ['api/', 'API'], ['changelog/', 'Changelog']];
function page({ slug, title, kicker, h1, lead, body, script = '', version }) {
  const js = GATE + '\n' + script, depth = slug ? '../../' : '../', here = slug ? '../' : '';
  const nav = ROOMS.map(([s, n]) => `<a href="${here}${s}"${s === slug ? ' aria-current="page"' : ''}>${n}</a>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${sha(js)}; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${esc(title)} · Backstage · the-daily.studio</title>
<link rel="icon" href="${depth}icons/favicon.svg" type="image/svg+xml"><style>${CSS.replaceAll('../fonts/', depth + 'fonts/')}</style>
<script>${js}</script></head><body>
<header class="top"><div class="wrap"><a class="brand" href="${here || './'}" aria-label="Backstage lobby">${markSvg({ hex: 'currentColor', ink: 'currentColor', bars: false, k: 1.5 })}<span>Backstage <i>·</i> the-daily.studio</span></a><nav class="rooms" aria-label="Backstage pages">${nav}</nav></div></header>
<main class="wrap">
<section class="locked" aria-live="polite"><div class="door" aria-hidden="true">🚪</div><h1>Backstage is guest list only.</h1><p class="lead" style="margin:0 auto 16px">This browser has no pass yet. Open <a href="${depth}">the studio</a>, open the browser’s console, and knock.</p><p class="note">(You could also just read this page’s source. Of course you could.)</p></section>
<div class="vault">
<p class="kicker">${esc(kicker)}</p><h1>${esc(h1)}</h1><p class="lead">${lead}</p>
${body}
</div>
</main>
<footer><div class="wrap">Backstage · the-daily.studio v${esc(version)} · not linked from anywhere, not indexed, nothing leaves this page · <a href="${depth}">back to the studio</a> · <a href="${depth}humans.txt">humans.txt</a></div></footer>
</body></html>
`;
}

/* ---------------------------------------------------------------- what the pages say */
/** every part: its file, title, what it is for, its size */
export function partsOf(root) {
  const dir = join(root, 'src', 'parts');
  return readdirSync(dir).filter(f => f.endsWith('.js')).sort().map(f => {
    const src = readFileSync(join(dir, f), 'utf8'), head = (src.match(/^\/\*\s*=+\s*\n([\s\S]*?)\n\s*=+\s*\*\//) || [])[1] || '';
    const ls = head.split('\n').map(x => x.trim()).filter(Boolean), at = ls.findIndex(x => /^Part\s+\w+\s*·/.test(x)), t = at >= 0 ? ls[at] : '';
    const m = /^Part\s+(\w+)\s*·\s*(.*)$/.exec(t) || [], desc = (at >= 0 ? ls.slice(at + 1) : []).filter(x => !/^[·•]/.test(x)).join(' ').replace(/\s+/g, ' ');
    const short = desc.length > 260 ? (desc.slice(0, 260).replace(/[^.]*$/, '') || desc.slice(0, 257) + '…') : desc;
    const title = (m[2] || f.replace(/\.js$/, '')).replace(/\s+—\s+/, ' — ');
    return { file: f, no: m[1] || f.split('-')[0], title, desc: short, lines: src.split('\n').length, bytes: Buffer.byteLength(src) };
  });
}
function lobby(o) {
  const pages = [['source/', 'Source map', 'Every part of the page: what it does, how big it is, and a link to its source.'], ['data/', 'Your data, raw', 'What this browser keeps for the studio, read-only, straight from storage.'], ['api/', 'Console and agent API', 'window.dailyStudio, WebMCP, the tools, and the Backstage shell.'], ['changelog/', 'How it was built', 'Every release, as a timeline.']];
  const app = [['terminal', 'Terminal', 'A small shell for the studio. Type help.'], ['engine', 'Engine room', 'The audio engine live, the scope, the signal chain.'], ['perf', 'Performance', 'Frames a second, long tasks, memory.'], ['bus', 'Event bus', 'Every event the parts send each other, live.'], ['labs', 'Labs', 'Developer handles, a performance overlay, the bus in the console.'], ['storage', 'Storage', 'What is kept, where it syncs, an export as JSON.']];
  const body = `<div class="pass" aria-label="Your Backstage pass"><span class="no mono" data-pass-no>#—</span><div class="k">ALL ACCESS</div><div class="n">the-daily.studio · Backstage</div><div class="m">Issued <span data-pass-at></span> · this browser only</div></div>
<h2>Pages back here</h2><div class="cards">${pages.map(([s, n, d]) => `<a class="card" href="${s}"><b>${n}</b><span>${d}</span><span class="mono">/backstage/${s}</span></a>`).join('')}<a class="card" href="../humans.txt"><b>humans.txt</b><span>Who made this, and with what.</span><span class="mono">/humans.txt</span></a></div>
<h2>Rooms in the studio</h2><div class="cards">${app.map(([s, n, d]) => `<a class="card" href="../#backstage/${s}"><b>${n}</b><span>${d}</span><span class="mono">/#backstage/${s}</span></a>`).join('')}</div>
<h2>This build</h2><div class="stats">${[[ 'v' + o.version, 'version · build ' + o.build ], [o.parts.length, 'parts, concatenated in name order'], [o.lines.toLocaleString('en'), 'lines of JavaScript'], [Math.round(o.raw / 1024) + ' kB', 'one HTML file (' + Math.round(o.gz / 1024) + ' kB gzip)'], ['0', 'runtime dependencies'], ['0', 'frameworks'], [o.worklets, 'AudioWorklet processors'], [o.tests, 'browser test files']].map(([b, s]) => `<div class="stat"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('')}</div>
<h2>Ways in</h2><div class="term"><span class="p">console $</span> <span class="c">dailyStudio.backstage()</span>          knock (guest list only)<br><span class="p">console $</span> <span class="c">dailyStudio.backstage('${'<build>'.replace(/</g, '&lt;').replace(/>/g, '&gt;')}')</span>   the password is the build<br><span class="p">address  </span> <span class="c">/#backstage/terminal</span>              straight to a room<br><span class="p">keys     </span> <span class="c">↑ ↑ ↓ ↓ ← → ← → B A</span>               the terminal</div>
<p class="note" style="margin-top:12px">Everything back here runs in your browser. These pages read what the studio keeps on this device and ask the network for nothing.</p>`;
  return page({ slug: '', title: 'Lobby', kicker: 'Backstage · all access', h1: 'Welcome backstage.', lead: 'You knocked, you knew the password, and now you have a pass. This is where the studio keeps the things only developers go looking for.', body, version: o.version });
}
function source(o) {
  const max = Math.max(...o.parts.map(p => p.lines)), top = o.parts.slice().sort((a, b) => b.lines - a.lines).slice(0, 10);
  const rows = o.parts.map(p => `<tr data-q="${esc((p.file + ' ' + p.title + ' ' + p.desc).toLowerCase())}"><td><span class="badge">${esc(p.no)}</span><a class="mono" href="${o.repo}/blob/main/src/parts/${esc(p.file)}" rel="noopener noreferrer">${esc(p.file)}</a><span class="d"><b>${esc(p.title)}</b>${p.desc ? ' · ' + esc(p.desc) : ''}</span></td><td class="num">${p.lines.toLocaleString('en')}</td><td class="num">${(p.bytes / 1024).toFixed(1)} kB</td></tr>`).join('');
  const body = `<div class="stats">${[[o.parts.length, 'parts'], [o.lines.toLocaleString('en'), 'lines'], [Math.round(o.bytes / 1024) + ' kB', 'of source'], [Math.round(o.raw / 1024) + ' kB', 'built and minified (' + Math.round(o.gz / 1024) + ' kB gzip)']].map(([b, s]) => `<div class="stat"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('')}</div>
<h2>How the page is made</h2><ol><li><code>src/parts/*.js</code> are plain JavaScript files, concatenated in name order into one closure (an IIFE). No bundler, no transpiler, no framework.</li><li>A dependency-free minifier (<code>scripts/minify.mjs</code>) removes comments and whitespace, and the build proves, token by token, that it changed nothing else.</li><li>The styles, the two fonts (as data), the body and the script become one HTML file. The script is allowed by its SHA-256 hash in the page's security policy; nothing else may run.</li><li>The service worker, the manifest, the sitemap, the guide pages and these pages are written beside it.</li></ol>
<h2>The ten biggest parts</h2><div class="tw"><table>${top.map(p => `<tr><td class="mono" style="width:38%">${esc(p.file)}</td><td><div class="bar" style="width:${(p.lines / max * 100).toFixed(1)}%"></div></td><td class="num">${p.lines.toLocaleString('en')}</td></tr>`).join('')}</table></div>
<h2>Every part</h2><input class="find" id="find" type="search" placeholder="Find a part: audio, sync, qr, stage…" aria-label="Find a part"><p class="note" id="count">${o.parts.length} parts</p>
<div class="tw"><table id="parts"><thead><tr><th>Part</th><th class="num">Lines</th><th class="num">Size</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const script = `document.addEventListener('DOMContentLoaded',function(){var f=document.getElementById('find'),rows=[].slice.call(document.querySelectorAll('#parts tbody tr')),n=document.getElementById('count');if(!f)return;f.addEventListener('input',function(){var q=f.value.trim().toLowerCase(),k=0;rows.forEach(function(r){var on=!q||r.getAttribute('data-q').indexOf(q)>=0;r.hidden=!on;if(on)k++;});n.textContent=k+' of '+rows.length+' parts';});});`;
  return page({ slug: 'source/', title: 'Source map', kicker: 'Backstage · source', h1: 'The source map', lead: 'The studio is one HTML file made from ' + o.parts.length + ' plain JavaScript parts. Here is what each one does, how big it is, and where to read it.', body, script, version: o.version });
}
function data(o) {
  const body = `<div class="stats" id="sum"><div class="stat"><b>…</b><span>reading this browser’s storage</span></div></div>
<h2>Songs</h2><p class="note">From IndexedDB <code>the-daily-songs</code> ▸ <code>projects</code>. Read-only: nothing here changes anything. Choose a song to see its record.</p><div class="tw"><table id="songs"><thead><tr><th>Song</th><th class="num">Takes</th><th class="num">Audio</th><th class="num">Changed</th></tr></thead><tbody></tbody></table></div><pre id="rec" hidden></pre>
<h2>Stored blobs</h2><p class="note">IndexedDB ▸ <code>blobs</code>, counted by kind from their keys (the audio itself is not read).</p><div class="tw"><table id="blobs"><tbody></tbody></table></div>
<h2>Local storage</h2><p class="note">The studio’s <code>fw.*</code> keys. A GitHub token is never shown.</p><div class="tw"><table id="ls"><thead><tr><th>Key</th><th class="num">Size</th></tr></thead><tbody></tbody></table></div><pre id="lsv" hidden></pre>`;
  const script = `function T(id){return document.querySelector('#'+id+' tbody')}function el(t,a,x){var e=document.createElement(t);if(a)for(var k in a)e.setAttribute(k,a[k]);if(x!=null)e.textContent=x;return e}
function kb(n){return n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?Math.round(n/1024)+' kB':n+' B'}function row(t,cells){var r=el('tr');cells.forEach(function(c,i){var d=el('td',i?{class:'num'}:null,c);r.appendChild(d);});t.appendChild(r);return r}
function tidy(j){return j.replace(/\\[\\s+([^\\[\\]{}]*?)\\s+\\]/g,function(m,x){return '['+x.replace(/\\s+/g,' ')+']';});}
function stat(b,s){var d=el('div',{class:'stat'});d.appendChild(el('b',null,b));d.appendChild(el('span',null,s));return d}
function openDb(){return new Promise(function(res){var go=function(){var q;try{q=indexedDB.open('the-daily-songs');}catch(e){return res(null);}q.onupgradeneeded=function(){try{q.transaction.abort();}catch(e){}};q.onsuccess=function(){res(q.result)};q.onerror=q.onblocked=function(){res(null)};};
 if(indexedDB.databases)indexedDB.databases().then(function(l){if(l.some(function(d){return d.name==='the-daily-songs'}))go();else res(null);},go);else go();});}
function all(db,st,keys){return new Promise(function(res){try{var tx=db.transaction(st,'readonly'),s=tx.objectStore(st),q=keys?s.getAllKeys():s.getAll();q.onsuccess=function(){res(q.result||[])};q.onerror=function(){res([])};}catch(e){res([])}})}
document.addEventListener('DOMContentLoaded',async function(){if(!B.ok)return;var sum=document.getElementById('sum'),db=await openDb(),songs=db?await all(db,'projects'):[],keys=db?await all(db,'blobs',true):[],est={};
 try{est=await navigator.storage.estimate();}catch(e){}var per=false;try{per=await navigator.storage.persisted();}catch(e){}
 sum.textContent='';sum.appendChild(stat(kb(est.usage||0),'used of '+kb(est.quota||0)));sum.appendChild(stat(songs.length,'songs'));sum.appendChild(stat(songs.reduce(function(a,r){return a+((r.takes||[]).length)},0),'takes'));sum.appendChild(stat(keys.length,'stored blobs'));sum.appendChild(stat(per?'kept':'may go','when space is short'));
 var rec=document.getElementById('rec');songs.sort(function(a,b){return(b.modified||0)-(a.modified||0)}).forEach(function(r){var tr=row(T('songs'),[(r.title||'Untitled')+(r.artist?' · '+r.artist:''),String((r.takes||[]).length),kb(r.size||0),r.modified?new Date(r.modified).toLocaleDateString():'']);tr.style.cursor='pointer';tr.title=r.id;
  tr.addEventListener('click',function(){var c=JSON.parse(JSON.stringify(r));rec.hidden=false;rec.textContent='// '+r.id+'\\n'+tidy(JSON.stringify(c,null,1)).slice(0,60000);rec.scrollIntoView({block:'nearest'});});});
 if(!songs.length)row(T('songs'),['No songs in this browser yet.','','','']);
 var kinds={};keys.forEach(function(k){k=String(k);var p=k.split('/'),kind=/\\/take\\/[^/]+\\/dry$/.test(k)?'recording (dry)':/\\/take\\/[^/]+\\/wet$/.test(k)?'recording (amp print)':/\\/take\\/[^/]+\\/cam$/.test(k)?'fret log':/\\/track$/.test(k)?'backing track':/^stage\\/img\\//.test(k)?'stage picture':/^stage\\/vid\\//.test(k)?'your video':/^gh\\/base\\//.test(k)?'GitHub sync base':/^fs\\/base\\//.test(k)?'folder sync base':k==='sync/dir'?'chosen folder':p[0];kinds[kind]=(kinds[kind]||0)+1;});
 Object.keys(kinds).sort(function(a,b){return kinds[b]-kinds[a]}).forEach(function(k){row(T('blobs'),[k,String(kinds[k])]);});if(!keys.length)row(T('blobs'),['None yet.','']);
 var lsv=document.getElementById('lsv'),ls=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(/^fw\\./.test(k))ls.push([k,(localStorage.getItem(k)||'').length]);}ls.sort(function(a,b){return b[1]-a[1]});
 ls.forEach(function(x){var tr=row(T('ls'),[x[0],kb(x[1])]);tr.style.cursor='pointer';tr.addEventListener('click',function(){var v=localStorage.getItem(x[0])||'';lsv.hidden=false;if(x[0]==='fw.ghtok'){lsv.textContent='// fw.ghtok: a GitHub token. Not shown, on purpose.';return;}try{v=tidy(JSON.stringify(JSON.parse(v),null,1));}catch(e){}lsv.textContent='// '+x[0]+'\\n'+v.slice(0,60000);});});
});`;
  return page({ slug: 'data/', title: 'Your data, raw', kicker: 'Backstage · data', h1: 'Your data, raw', lead: 'What this browser keeps for the studio, read straight from IndexedDB and local storage. It is read-only, it stays in this browser, and it is the same data the studio shows you in a friendlier way.', body, script, version: o.version });
}
function api(o) {
  const cmds = o.cmds.map(([u, d]) => `<tr><td class="mono">${esc(u)}</td><td>${esc(d)}</td></tr>`).join('');
  const body = `<h2>The Backstage shell</h2><p>In the studio, Backstage ▸ Terminal (or <code>/#backstage/terminal</code>) is a small shell. ↑ and ↓ walk the history, Tab completes a command, and a few other words work too.</p><div class="tw"><table><thead><tr><th>Command</th><th>What it does</th></tr></thead><tbody>${cmds}</tbody></table></div>
<h2>In the console</h2><div class="term"><span class="p">$</span> <span class="c">dailyStudio.describe()</span>              the API version, the app, the build, the tools<br><span class="p">$</span> <span class="c">dailyStudio.tools()</span>                 each tool with its JSON schema<br><span class="p">$</span> <span class="c">await dailyStudio.call('get_song')</span>  call one (the same as an agent)<br><span class="p">$</span> <span class="c">dailyStudio.backstage()</span>             the door</div>
<div class="md">${o.apiMd}</div>`;
  return page({ slug: 'api/', title: 'Console and agent API', kicker: 'Backstage · api', h1: 'Console and agent API', lead: 'The studio offers its main actions as tools: to an AI agent in the browser through WebMCP, to you through <code>window.dailyStudio</code>, and to the Backstage shell. Same tools, same rules, same undo.', body, version: o.version });
}
function changelog(o) {
  const rels = o.changelog.split(/^## /m).slice(1).map(x => { const nl = x.indexOf('\n'), head = x.slice(0, nl), m = /^(\d+\.\d+\.\d+)\s*—\s*(\d{4}-\d{2}-\d{2})?\s*(?:—\s*)?(.*)$/.exec(head.trim()) || [];
    return { v: m[1] || head, d: m[2] || '', t: m[3] || '', body: md(x.slice(nl + 1).replace(/^### /gm, '#### '), o.repo + '/blob/main/') }; });
  const body = `<div class="stats">${[[rels.length, 'releases written up'], [rels[rels.length - 1] ? rels[rels.length - 1].v : '', 'the first one here'], [rels[0] ? rels[0].v : '', 'the latest']].map(([b, s]) => `<div class="stat"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('')}</div>
<h2>Every release</h2>${rels.map((r, i) => `<details class="rel"${i < 3 ? ' open' : ''}><summary><span class="v">${esc(r.v)}</span><span class="t">${esc(r.t)}</span><span class="dt">${esc(r.d)}</span></summary><div>${r.body}</div></details>`).join('\n')}`;
  return page({ slug: 'changelog/', title: 'How it was built', kicker: 'Backstage · changelog', h1: 'How it was built', lead: 'Every release, newest first: what was added, what changed, and how it was tested. The same text as CHANGELOG.md in the repository.', body, version: o.version });
}
export function humans(o) {
  return `/* TEAM */
  Made by: ${o.author}
  Site: ${o.origin}
  GitHub: ${o.repo}

/* THANKS */
  Everyone who opened the console.
  The authors of Inter and Montserrat.

/* SITE */
  Last update: ${o.modified}
  Version: ${o.version} (build ${o.build})
  Language: English
  Standards: HTML, CSS, JavaScript, Web Audio, AudioWorklet, Web MIDI, File System Access, WebMCP
  Components: none. No framework and no runtime dependencies: ${o.parts.length} plain JavaScript parts, one HTML file
  Software: a text editor, Node.js for the build, Playwright for ${o.tests} browser test files
  Fonts: Inter, Montserrat (SIL Open Font Licence 1.1)

/* PSST */
  There is a door backstage. Open the studio, then the browser's console.
`;
}
/** every hidden page as [path under dist, contents], and the numbers they show */
export function backstagePages({ root, version, build, modified, repo, origin, author }) {
  const html = readFileSync(join(root, 'index.html')), parts = partsOf(root), testDir = join(root, 'test');
  const shell = readFileSync(join(root, 'src', 'parts', '73c-backstage.js'), 'utf8').split('const BKS_CMDS = {')[1].split('\n};')[0];
  const o = { version, build, modified, repo, origin, author, parts, lines: parts.reduce((a, p) => a + p.lines, 0), bytes: parts.reduce((a, p) => a + p.bytes, 0), raw: html.length, gz: gzipSync(html, { level: 9 }).length,
    worklets: (readFileSync(join(root, 'src', 'parts', '02-audio.js'), 'utf8').match(/registerProcessor\(/g) || []).length, tests: readdirSync(testDir).filter(f => /^(e2e(-.+)?|mobile|smoke|xbrowser)\.c?js$|\.test\.mjs$/.test(f)).length,
    cmds: [...shell.matchAll(/^\s+\w+: \['([^']+)', '([^']+)'\]/gm)].map(m => [m[1], m[2]]),
    apiMd: md(readFileSync(join(root, 'docs', 'AGENT_API.md'), 'utf8').replace(/^# .*\n/, ''), repo + '/blob/main/docs/'), changelog: readFileSync(join(root, 'CHANGELOG.md'), 'utf8') };
  return { files: [['backstage/index.html', lobby(o)], ['backstage/source/index.html', source(o)], ['backstage/data/index.html', data(o)], ['backstage/api/index.html', api(o)], ['backstage/changelog/index.html', changelog(o)], ['humans.txt', humans(o)]], o };
}
