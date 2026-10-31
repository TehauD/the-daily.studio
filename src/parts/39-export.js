/* ============================================================
   Part 39 · EXPORT & SHARE
   Loudness (ITU-R BS.1770 / EBU R128 integrated LUFS, true peak) for song bounces, with an optional target; compressed audio
   (M4A or Opus, made in real time with the browser's own encoder); a one-file share page (audio + lyrics + chords + a small
   player, nothing loaded from anywhere); and a printable lyric & chord sheet (print or Save as PDF). All on this device.
   ============================================================ */
const LOUD_TARGETS = [[0, 'Off (keep as played)'], [-14, '−14 LUFS (streaming)'], [-16, '−16 LUFS (podcasts, Apple)'], [-23, '−23 LUFS (broadcast, EBU R128)']];
/** K-weighting (two biquads) per BS.1770-4, for any sample rate */
function kWeight(x, sr) {
  const bq = (b0, b1, b2, a1, a2) => { let x1 = 0, x2 = 0, y1 = 0, y2 = 0; const y = new Float32Array(x.length), src = bq.src; for (let i = 0; i < src.length; i++) { const v = src[i], o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o; } return y; };
  let K = Math.tan(Math.PI * 1681.974450955533 / sr), Q = 0.7071752369554196, Vh = Math.pow(10, 3.999843853973347 / 20), Vb = Math.pow(Vh, 0.4996667741545416), a0 = 1 + K / Q + K * K;
  bq.src = x; const s1 = bq((Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0);
  K = Math.tan(Math.PI * 38.13547087602444 / sr); Q = 0.5003270373238773; a0 = 1 + K / Q + K * K; bq.src = s1;
  return bq(1, -2, 1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0);
}
/** true peak by 4x oversampling (12-tap windowed sinc), looked at only near the loudest samples */
function truePeak(x) {
  let sp = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > sp) sp = a; } if (sp === 0) return 0;
  const taps = []; for (let p = 1; p < 4; p++) { const f = p / 4, k = []; for (let j = -5; j <= 6; j++) { const t = j - f, s = Math.abs(t) < 1e-9 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t); k.push(s * 0.5 * (1 + Math.cos(Math.PI * t / 6.5))); } taps.push(k); }
  let tp = sp; const lim = sp * .6;
  for (let i = 5; i < x.length - 6; i++) { if (Math.abs(x[i]) < lim && Math.abs(x[i + 1]) < lim) continue; for (let p = 0; p < 3; p++) { let v = 0; const k = taps[p]; for (let j = -5; j <= 6; j++) v += x[i + j] * k[j + 5]; v = Math.abs(v); if (v > tp) tp = v; } }
  return tp;
}
/** integrated loudness (LUFS) with the absolute (−70) and relative (−10 LU) gates, sample peak and true peak (dBFS) */
function lufsMeasure(L, R, sr) {
  R = R || L; const kl = kWeight(L, sr), kr = kWeight(R, sr), hop = Math.round(sr * .1), nh = Math.floor(kl.length / hop), seg = [];
  for (let s = 0; s < nh; s++) { let a = 0, b = 0; for (let i = s * hop, e = i + hop; i < e; i++) { a += kl[i] * kl[i]; b += kr[i] * kr[i]; } seg.push((a + b) / hop); }
  const blocks = []; for (let j = 0; j + 4 <= seg.length; j++) blocks.push((seg[j] + seg[j + 1] + seg[j + 2] + seg[j + 3]) / 4);
  const lk = z => -0.691 + 10 * Math.log10(Math.max(z, 1e-12)), g1 = blocks.filter(z => lk(z) > -70); let lufs = -Infinity;
  if (g1.length) { const thr = lk(g1.reduce((a, z) => a + z, 0) / g1.length) - 10, g2 = g1.filter(z => lk(z) > thr); if (g2.length) lufs = lk(g2.reduce((a, z) => a + z, 0) / g2.length); }
  let sp = 0; for (let i = 0; i < L.length; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > sp) sp = a; }
  return { lufs, peak: dB(sp), tp: dB(Math.max(truePeak(L), truePeak(R))) };
}
const fmtLU = v => (isFinite(v) ? (v < 0 ? '−' : '') + Math.abs(v).toFixed(1) : '−∞');
/** called with a finished song bounce: measure it, optionally bring it to the target (never past −1 dBTP), and say what it is */
function loudAfterBounce(l, r, sr) {
  try {
    const m = lufsMeasure(l, r, sr); if (!isFinite(m.lufs)) return ' (silent)'; const tg = +CFG.lufsTarget || 0;
    if (!tg) return ' · ' + fmtLU(m.lufs) + ' LUFS, true peak ' + fmtLU(m.tp) + ' dBTP';
    let g = tg - m.lufs; const lim = -1 - m.tp; let capped = false; if (g > lim) { g = lim; capped = true; }
    const k = Math.pow(10, g / 20); for (let i = 0; i < l.length; i++) { l[i] *= k; r[i] *= k; }
    return ' · set to ' + fmtLU(m.lufs + g) + ' LUFS (was ' + fmtLU(m.lufs) + ')' + (capped ? ', held under −1 dBTP' : '');
  } catch (e) { return ''; }
}

/* ---------- the share page ---------- */
const shareEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** the song for a share page. off: the song time (s) at the start of the recording; len: its length (s). With both, only the
    sections the recording covers are kept and every time is measured from the start of the recording. */
function shareData(off, len) {
  const sp = spb(), sd = slotDur(), secs = [], o = off || 0; let bars0 = 0;
  S.sections.forEach(sec => {
    const ls = (sec.lyrics || '').split('\n').filter(l => l.trim()), n = sec.bars.length, t0 = bars0 * sp * sd, t1 = (bars0 + n) * sp * sd;
    /* when each line comes up: from the chords written in it (part 13b), as on the stage */
    const at = ls.map(() => null), v = lyTimeline(sec);
    if (v) sec.bars.forEach((b, bi) => { const nc = Math.max(1, barChords(b).length); for (let k = 0; k < nc; k++) { const li = v.lineOf[v.first[bi] + k]; if (li != null && at[li] == null) at[li] = (bars0 + bi + k / nc) * sp * sd; } });
    for (let k = ls.length - 1; k >= 0; k--) if (at[k] == null) at[k] = v ? (k + 1 < ls.length ? at[k + 1] : t1) : (bars0 + k / ls.length * n) * sp * sd;
    const keep = len == null || (t1 > o && t0 < o + len);
    if (keep) secs.push({ name: sec.name, t: t0 - o, chords: sec.bars.map(b => barChords(b).join(' ') || '·'), lines: ls.map((l, k) => { const y = lyLayout(l); let cl = ''; y.chords.forEach(c => { cl = cl.padEnd(c.col) + c.sym; }); const segs = y.chords.length ? (y.chords[0].col > 0 ? [['', y.text.slice(0, y.chords[0].col)]] : []).concat(y.chords.map((c, i) => [c.sym, y.text.slice(c.col, i + 1 < y.chords.length ? y.chords[i + 1].col : undefined)])) : null; return { t: at[k] - o, text: y.text, chords: y.chords.length ? cl : '', segs }; }) });
    bars0 += n;
  });
  return { dur: len != null ? len : bars0 * sp * sd, title: S.title || 'Untitled', artist: S.artist || '', key: keyName(), bpm: Math.round(S.bpm), ts: S.ts.join('/'), notes: S.notes || '', secs };
}
/* ---------- your content, your responsibility: the notice and the one-time acknowledgement before sharing ---------- */
const SHARE_TERMS = 1;   /* raise when the wording changes, so it is asked again */
function shareNotice() {
  return h('div', { class: 'share-note', role: 'note' }, h('b', {}, 'You are responsible for what you share. '),
    'Share only songs, words and recordings that are yours or that you have permission to share. Covers, other people’s lyrics and backing tracks usually need the owners’ permission before you post them. This app makes the file on your device; it does not upload, host or publish anything. ',
    h('a', { href: 'legal/#terms', target: '_blank', rel: 'noopener' }, 'Terms of use'));
}
/** run fn once the person has said they have the right to share (asked once, remembered on this device) */
function shareGate(fn) {
  if (CFG.shareOk === SHARE_TERMS) return fn();
  const chk = h('input', { type: 'checkbox', id: 'shareOkChk', onchange: () => { go.disabled = !chk.checked; } });
  const go = h('button', { class: 'btn primary', id: 'shareOkGo', disabled: true, onclick: () => { CFG.shareOk = SHARE_TERMS; saveCfg(); d.close(); fn(); } }, 'Continue');
  const d = pdlg('shareOk', 'BEFORE YOU SHARE', h('div', { class: 'share-gate' },
    h('p', {}, 'Recordings and share pages you make here can be sent, posted and copied once they leave this device.'),
    h('ul', {}, h('li', {}, 'Share only your own songs, words and recordings, or other people’s work with their permission. A cover, someone else’s lyrics or a backing track you did not make usually needs the owners’ permission before you post it publicly.'),
      h('li', {}, 'You are the one sharing it: you are responsible for it, and for following the rules of the places you post it.'),
      h('li', {}, 'the-daily.studio makes the file on this device. It does not upload, host, publish or review what you share, and is not responsible for it.')),
    h('label', { class: 'chk' }, chk, ' I own this content or have permission to share it, and I accept responsibility for sharing it.'),
    h('p', { class: 'tiny muted' }, h('a', { href: 'legal/#terms', target: '_blank', rel: 'noopener' }, 'Terms of use'), ' · asked once on this device.'),
    h('div', { class: 'row', style: { gap: '8px', justifyContent: 'flex-end' } }, h('button', { class: 'btn', onclick: () => d.close() }, 'Cancel'), go)));
  return null;
}
/** kind: 'audio' (default) or 'video' */
function shareHtml(audioUri, d, kind) {
  const vid = kind === 'video';
  const json = JSON.stringify(Object.assign({ kind: vid ? 'video' : 'audio' }, d)).replace(/</g, '\\u003c');
  const css = ':root{color-scheme:dark;--bg:#0b100e;--panel:#141a17;--line:#27332d;--text:#e9efeb;--mut:#9db3a5;--acc:#7dbf9b}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}main{max-width:760px;margin:0 auto;padding:28px 18px 60px}h1{font-size:clamp(26px,5vw,40px);margin:0;line-height:1.1}.sub{color:var(--mut);margin:6px 0 18px;font-size:14px}video{width:100%;max-height:70vh;display:block;border-radius:16px;background:#000}canvas{width:100%;height:220px;display:block;border-radius:16px;background:radial-gradient(circle at 50% 50%,#13201a,#080c0a);border:1px solid var(--line)}.pl{display:flex;align-items:center;gap:12px;margin:14px 0 26px}button{font:inherit;border:0;border-radius:999px;background:var(--acc);color:#07120c;font-weight:700;width:52px;height:52px;cursor:pointer;font-size:20px}input[type=range]{flex:1;accent-color:var(--acc)}.tm{font:13px ui-monospace,monospace;color:var(--mut);min-width:88px;text-align:right}h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--acc);margin:26px 0 6px}.ch{font:600 14px ui-monospace,Menlo,monospace;color:var(--mut)}.ln{margin:2px 0;padding:2px 8px;border-radius:8px;cursor:pointer}.ln pre{margin:0;font:600 14px ui-monospace,Menlo,monospace;color:var(--acc)}.sg{display:inline-flex;flex-direction:column;vertical-align:bottom;white-space:pre}.sg b{font:600 14px/1.3 ui-monospace,Menlo,monospace;color:var(--acc);padding-right:.35em;min-height:1.3em}.ln div{font-size:18px}.ln.on{background:#1b2a22;outline:1px solid var(--line)}footer{margin-top:40px;color:var(--mut);font-size:12px;line-height:1.5}footer p{margin:0 0 6px}@media print{body{background:#fff;color:#000}canvas,.pl,audio,footer{display:none}h2{color:#000}.ln pre,.ch{color:#333}}';
  const js = "(function(){var D=JSON.parse(document.getElementById('d').textContent),au=document.getElementById('au'),pl=document.getElementById('pl'),sk=document.getElementById('sk'),tm=document.getElementById('tm'),cv=document.getElementById('cv'),g=cv.getContext('2d'),an=null,buf=null,L=[].slice.call(document.querySelectorAll('.ln'));function f(t){t=Math.max(0,t||0);return Math.floor(t/60)+':'+('0'+Math.floor(t%60)).slice(-2)}function ac(){if(an)return;try{var C=window.AudioContext||window.webkitAudioContext,c=new C(),s=c.createMediaElementSource(au);an=c.createAnalyser();an.fftSize=256;s.connect(an);an.connect(c.destination);buf=new Uint8Array(an.frequencyBinCount)}catch(e){an=null}}pl.onclick=function(){if(au.paused){ac();au.play()}else au.pause()};au.onplay=function(){pl.textContent='❚❚'};au.onpause=au.onended=function(){pl.textContent='▶'};function du(){return isFinite(au.duration)&&au.duration>0?au.duration:D.dur}sk.oninput=function(){au.currentTime=sk.value/1000*du()};if(!D.nosync)L.forEach(function(el){el.onclick=function(){au.currentTime=Math.max(0,+el.getAttribute('data-t'));ac();au.play()}});function draw(){requestAnimationFrame(draw);var w=cv.width=cv.clientWidth*(devicePixelRatio||1),h=cv.height=cv.clientHeight*(devicePixelRatio||1),cx=w/2,cy=h/2,R=Math.min(w,h)*.22,n=64,i,v;g.clearRect(0,0,w,h);if(an&&!au.paused)an.getByteFrequencyData(buf);g.lineWidth=Math.max(2,w/320);g.strokeStyle='#7dbf9b';g.lineCap='round';for(i=0;i<n;i++){v=an&&!au.paused?buf[Math.floor(i/n*buf.length*.8)]/255:.04+.02*Math.sin(i);var a=i/n*Math.PI*2-Math.PI/2,r1=R,r2=R+v*R*1.4+3;g.globalAlpha=.35+v*.65;g.beginPath();g.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);g.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2);g.stroke()}g.globalAlpha=1;var t=au.currentTime,cur=-1;if(!D.nosync)for(i=0;i<L.length;i++){if(+L[i].getAttribute('data-t')<=t+.05)cur=i}L.forEach(function(el,k){el.classList.toggle('on',k===cur&&!au.paused)});if(du()){sk.value=Math.min(1000,t/du()*1000);tm.textContent=f(t)+' / '+f(du())}}draw();})();";
  const sections = d.secs.map(s => '<h2>' + shareEsc(s.name) + '</h2><div class="ch">' + s.chords.map(shareEsc).join(' &nbsp;|&nbsp; ') + '</div>' + s.lines.map(l => '<div class="ln" data-t="' + l.t.toFixed(2) + '">' + (l.segs ? '<div>' + l.segs.map(g => '<span class="sg"><b>' + (shareEsc(g[0]) || '&nbsp;') + '</b>' + (shareEsc(g[1]) || '&nbsp;') + '</span>').join('') + '</div>' : (l.chords ? '<pre>' + shareEsc(l.chords) + '</pre>' : '') + '<div>' + shareEsc(l.text) + '</div>') + '</div>').join('')).join('');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + shareEsc(d.title) + (d.artist ? ' · ' + shareEsc(d.artist) : '') + '</title><style>' + css + '</style></head><body><main><h1>' + shareEsc(d.title) + '</h1><div class="sub">' + shareEsc([d.artist, d.key, d.bpm + ' BPM', d.ts].filter(Boolean).join(' · ')) + '</div>' + (vid ? '<video id="au" playsinline preload="auto" src="' + audioUri + '"></video><canvas id="cv" aria-hidden="true" style="display:none"></canvas>' : '<canvas id="cv" aria-hidden="true"></canvas>') + '<div class="pl"><button id="pl" aria-label="Play or pause">▶</button><input id="sk" type="range" min="0" max="1000" value="0" aria-label="Seek"><span class="tm" id="tm">0:00</span></div>' + sections + (d.notes ? '<h2>Notes</h2><div class="ch">' + shareEsc(d.notes) + '</div>' : '') + '<footer><p>Shared by the person who made this page, who is responsible for having the right to share the recording, music and words in it. All rights in the songs, lyrics and recordings belong to their owners.</p><p>This page is one file: everything is inside it. It was made with the-daily.studio on the maker’s own device; the-daily.studio does not host, publish or review it and is not responsible for its content.</p></footer></main>' + (vid ? '' : '<audio id="au" preload="auto" src="' + audioUri + '"></audio>') + '<script type="application/json" id="d">' + json + '</script><script>' + js + '</script></body></html>';
}
function shareMake() {
  if (!songHasWork() && !TAKES.length) return toast('Add some chords or lyrics first, then make a share page.', 'warn');
  if (CFG.shareOk !== SHARE_TERMS) return shareGate(shareMake);
  toast('Recording the song for the share page. It plays once in real time.', 'ok');
  srecStart(true, { audio: true, onBlob: blob => {
    const fr = new FileReader(); fr.onload = () => { const html = shareHtml(fr.result, shareData()); download((S.title || 'song').replace(/\W+/g, '_') + '_share.html', new Blob([html], { type: 'text/html' })); toast('Saved the share page (' + (html.length / 1048576).toFixed(1) + ' MB). Open it in any browser, or send it to someone.', 'ok'); }; fr.onerror = () => toast('Could not build the share page.', 'bad'); fr.readAsDataURL(blob);
  } });
}
function compressedSave() { toast('Recording the song as compressed audio. It plays once in real time.', 'ok'); srecStart(true, { audio: true }); }

/* ---------- printable lyric & chord sheet ---------- */
function printSheetHtml() {
  const meta = [S.artist, keyName(), Math.round(S.bpm) + ' BPM', S.ts.join('/'), S.capo ? 'Capo ' + S.capo : '', tuningNotes()].filter(Boolean).join(' · ');
  const secs = S.sections.map(sec => {
    const ls = (sec.lyrics || '').split('\n').filter(l => l.trim()), prog = sec.bars.map(b => barChords(b).join(' ') || '·').join('  |  ');
    return '<section><h2>' + shareEsc(sec.name) + '</h2>' + (ls.length ? '<div class="pr">' + shareEsc(prog) + '</div>' + ls.map(l => { const o = chordOverLine(l); return '<pre>' + (o.hasChords ? '<b>' + shareEsc(o.chordLine) + '</b>\n' : '') + shareEsc(o.text) + '</pre>'; }).join('') : '<pre><b>' + shareEsc('| ' + prog + ' |') + '</b></pre>') + '</section>';
  }).join('');
  return '<h1>' + shareEsc(S.title || 'Untitled') + '</h1><div class="meta">' + shareEsc(meta) + '</div>' + secs + (S.notes ? '<section><h2>Notes</h2><div class="pr">' + shareEsc(S.notes) + '</div></section>' : '') + '<div class="ft">the-daily.studio</div>';
}
function printSheet() {
  if (!S.sections.length) return toast('Nothing to print yet.', 'warn');
  const old = document.getElementById('printSheet'); if (old) old.remove();
  const d = h('div', { id: 'printSheet', 'aria-hidden': 'true' }); d.innerHTML = printSheetHtml(); document.body.append(d); document.body.classList.add('printing-sheet');
  const done = () => { document.body.classList.remove('printing-sheet'); const x = document.getElementById('printSheet'); if (x) x.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); setTimeout(() => { try { window.print(); } catch (e) { done(); } if (!('onafterprint' in window)) setTimeout(done, 2000); }, 60);
}
/** the three buttons shared by the Export panel and the Save menus */
function exportExtras(close) {
  const go = fn => () => { try { close && close(); } catch (e) { } fn(); };
  return [h('button', { class: 'btn', id: 'exAudioC', title: 'The whole song as a smaller audio file (M4A where the browser can, otherwise Opus). Plays once in real time.', onclick: go(compressedSave) }, '⤓ Compressed audio (M4A / Opus)'),
    h('button', { class: 'btn', id: 'exShare', title: 'One HTML file with the song, words, chords and a small player. Open it anywhere or send it to someone.', onclick: go(shareMake) }, '🔗 Share page (one file)'),
    h('button', { class: 'btn', id: 'exPrint', title: 'A clean lyric and chord sheet. Use your browser’s Print or Save as PDF.', onclick: go(printSheet) }, '🖨 Print or PDF sheet')];
}
