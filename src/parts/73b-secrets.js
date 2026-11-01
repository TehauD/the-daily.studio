/* ============================================================
   Part 73b · SECRETS (2.20) — small surprises for people who look, and a door backstage for developers
   · Tuned to perfection   all six open strings within ±2 cents of true, one after another (the tuner the studio already has)
   · In the pocket         sixteen notes in a row within 10 ms of the beat while the song plays (the timing analysis already there)
   · The hidden line       triple-click the version tag (part 73)
   · Backstage pass        the browser console says hello to developers and points at dailyStudio.backstage(), which unlocks
                           Backstage: the engine live, a signal scope, how the page is made, a playground for the agent tools, the secrets
   A small 🗝 counter next to the version shows how many have been found, once the first one has. The rules: nothing fires while a take
   or a video is recording, nothing flashes (Calm and reduced motion get no glow), nothing loads or leaves the page, and Settings ▸
   Workflow ▸ Hidden surprises turns the musical ones off. Found secrets are remembered in this browser (CFG.secrets).
   ============================================================ */
const SECRETS = [
  ['line', 'The hidden line', 'Some numbers want to be clicked three times.', 'Triple-click the version tag: a rotating quote wakes up at the bottom of the page, from people in history or from Tehau.'],
  ['tuned', 'Tuned to perfection', 'Six strings, two cents.', 'All six open strings within ±2 cents of true, one after another.'],
  ['pocket', 'In the pocket', 'Sixteen notes, right on time.', 'Sixteen notes in a row within 10 ms of the beat while the song plays.'],
  ['backstage', 'Backstage pass', 'Developers know where to look.', 'Read the note in the browser console and knocked on the door backstage.']
];
CFG.secrets = CFG.secrets && typeof CFG.secrets === 'object' ? CFG.secrets : {};
const SEC = { tuned: {}, tunedT0: 0, hold: { i: -1, t: 0 }, pocket: 0, chips: [] };
const secretsOn = () => CFG.eggs !== false;
const secretBusy = () => !!(REC || (typeof SREC !== 'undefined' && SREC.on));      /* never while a take or a video records */
const secretN = () => SECRETS.filter(s => CFG.secrets[s[0]]).length;
const secretCount = () => '(Secret ' + secretN() + ' of ' + SECRETS.length + '.)';
const secretCalm = () => CFG.reduce || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || (typeof lxComfort === 'function' && lxComfort().calm);
/** mark a secret found; true the first time. quiet: the caller says so itself */
function secretFound(id, quiet) {
  if (CFG.secrets[id] || (!secretsOn() && id !== 'backstage')) return false;
  const s = SECRETS.find(x => x[0] === id); if (!s) return false;
  CFG.secrets[id] = Date.now(); saveCfg(); secretSync(); bus.emit('secret', id);
  if (!quiet) { toast(h('span', { class: 'egg-toast' }, (id === 'tuned' ? '🎯 ' : id === 'pocket' ? '🥁 ' : '🗝 ') + s[1] + '. ', h('span', { class: 'muted' }, s[2] + ' ' + secretCount())), 'ok'); secretGlow(); }
  return true;
}
/** a soft gold glow from the edges, for two seconds (not with Calm or reduced motion) */
function secretGlow() {
  if (secretCalm()) return; const g = h('div', { class: 'egg-glow', 'aria-hidden': 'true' }); document.body.append(g); setTimeout(() => g.remove(), 2400);
}
/** the 🗝 counter beside the version tags (hidden until the first secret is found, and when hidden surprises are off) */
function secretChip(cls) {
  const c = h('button', { type: 'button', class: 'secret-chip ' + (cls || ''), title: 'Secrets found', onclick: () => secretsOpen() }); SEC.chips.push(c); secretSync(); return c;
}
function secretSync() {
  const n = secretN(); SEC.chips = SEC.chips.filter(c => c.isConnected || !c.parentNode);
  SEC.chips.forEach(c => { c.textContent = '🗝 ' + n + '/' + SECRETS.length; c.hidden = !n || !secretsOn(); c.setAttribute('aria-label', n + ' of ' + SECRETS.length + ' secrets found'); });
}
/** the list: what has been found, and a hint for the rest */
function secretList() {
  return h('div', { class: 'secret-list' }, SECRETS.map(([id, name, hint, how]) => { const at = CFG.secrets[id];
    return h('div', { class: 'secret-row' + (at ? ' found' : ''), 'data-secret': id }, h('span', { class: 'secret-i', 'aria-hidden': 'true' }, at ? '🗝' : '?'),
      h('div', {}, h('b', {}, at ? name : '???'), h('div', { class: 'tiny muted' }, at ? how + ' Found ' + new Date(at).toLocaleDateString() + '.' : hint))); }));
}
function secretsOpen() { pdlg('secretsDlg', 'SECRETS · ' + secretN() + ' OF ' + SECRETS.length, h('div', {}, secretList(), h('p', { class: 'tiny muted', style: { marginTop: '10px' } }, 'Settings ▸ Workflow ▸ Hidden surprises turns these off.'))); }

/* ---------- Tuned to perfection: each open string held within ±2 cents for a moment, all six inside three minutes ---------- */
setInterval(() => {
  if (!secretsOn() || CFG.secrets.tuned || !E.ready || secretBusy() || !AN.active || AN.midi == null || (CFG.anSrc || 'g') === 'v') { SEC.hold.i = -1; return; }
  const now = performance.now(), open = S.tuning || [];
  if (SEC.tunedT0 && now - SEC.tunedT0 > 180000) { SEC.tuned = {}; SEC.tunedT0 = 0; }
  const i = open.indexOf(AN.midi);
  if (i < 0 || Math.abs(AN.cents) > 2) { SEC.hold.i = -1; return; }
  if (SEC.hold.i !== i) { SEC.hold = { i, t: now }; return; }
  if (now - SEC.hold.t < 350 || SEC.tuned[i]) return;
  SEC.tuned[i] = 1; if (!SEC.tunedT0) SEC.tunedT0 = now;
  if (open.every((_, k) => SEC.tuned[k])) { secretFound('tuned'); SEC.tuned = {}; SEC.tunedT0 = 0; }
}, 100);
/* ---------- In the pocket: sixteen notes in a row within 10 ms of the beat ---------- */
function secretTiming(ms) {
  if (!secretsOn() || CFG.secrets.pocket || !T.playing || secretBusy()) { SEC.pocket = 0; return; }
  SEC.pocket = Math.abs(ms) <= 10 ? SEC.pocket + 1 : 0;
  if (SEC.pocket >= 16) { SEC.pocket = 0; secretFound('pocket'); }
}
bus.on('timing', secretTiming);
bus.on('transport', () => { if (!T.playing) SEC.pocket = 0; });

/* ---------- a word for developers, in the console ---------- */
try {
  console.log('%c the-daily.studio %c v' + VERSION + ' · build ' + BUILD + ' ', 'background:#1f8a56;color:#fff;font:700 14px system-ui,sans-serif;padding:4px 8px;border-radius:6px 0 0 6px', 'background:#0b100e;color:#7dbf9b;font:600 12px ui-monospace,Menlo,monospace;padding:5px 8px;border-radius:0 6px 6px 0');
  console.log('%cHey, you opened the console. 🎸 Respect.\n%cNo framework, no tracking, nothing kept on a server: one HTML file made from ' + PARTS_N + ' plain JavaScript parts (' + LINES_N.toLocaleString('en') + ' lines), a hand-made minifier, a QR encoder and a lot of Web Audio. The source is at ' + BRAND.repo + '\n\nThere is a door backstage for people like you. Knock:  %cdailyStudio.backstage()',
    'font:700 13px system-ui,sans-serif', 'font:12px/1.5 system-ui,sans-serif;color:#9db3a5', 'font:700 12px ui-monospace,Menlo,monospace;color:#f7c95a;background:#1b130d;padding:2px 6px;border-radius:4px');
} catch (e) { }

/* ---------- Backstage ---------- */
const BKS = { tm: 0, raf: 0 };
/** the door: unlocks Backstage (remembered here), counts the secret, opens it, and answers in the console */
function backstage() {
  const first = !CFG.backstage; CFG.backstage = true; saveCfg(); secretFound('backstage', true);
  setTimeout(() => backstageOpen(), 30);
  return first ? '🎭 Come on in. Backstage is unlocked in this browser (and in Help from now on). ' + secretCount() : '🎭 Welcome back. Backstage is open.';
}
const bksRow = (k, v) => h('div', { class: 'bks-r' }, h('span', {}, k), h('b', { class: 'mono' }, v));
function backstageOpen(at) {
  if (!CFG.backstage) return toast('That door is locked. Developers know where to look.', '');
  const close = () => { const d = $('#backstage'); if (d) d.close(); };
  const live = h('div', { class: 'bks-grid', id: 'bksLive' }), scope = h('canvas', { class: 'bks-scope', id: 'bksScope', width: 640, height: 180, role: 'img', 'aria-label': 'The master output as a waveform and a spectrum' });
  const tools = (window.dailyStudio && window.dailyStudio.tools()) || [], sel = h('select', { class: 'in', id: 'bksTool' }, tools.map(t => h('option', { value: t.name }, t.name)));
  const inp = h('textarea', { class: 'in mono', id: 'bksIn', rows: 4, spellcheck: false, 'aria-label': 'Input (JSON)' }), outp = h('pre', { class: 'bks-out', id: 'bksOut', 'aria-live': 'polite' }, '—');
  const example = () => { const t = tools.find(x => x.name === sel.value), s = t && t.inputSchema, o = {}; ((s && s.required) || []).forEach(k => { const p = s.properties[k] || {}; o[k] = p.enum ? p.enum[0] : p.type === 'number' || p.type === 'integer' ? 0 : p.type === 'array' ? [] : p.type === 'boolean' ? false : ''; }); inp.value = JSON.stringify(o, null, 1); };
  sel.onchange = example; example();
  const run = h('button', { class: 'btn primary', id: 'bksRun', onclick: async () => {
    let input; try { input = JSON.parse(inp.value || '{}'); } catch (e) { outp.textContent = 'That is not JSON: ' + e.message; return; }
    outp.textContent = '…'; const r = await window.dailyStudio.call(sel.value, input); outp.textContent = JSON.stringify(r.structuredContent || r, null, 2).slice(0, 20000);
  } }, '▶ Run');
  const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0], kb = v => v ? Math.round(v / 1024) + ' kB' : '?';
  const d = hubOpen('backstage', { ico: '🎭', title: 'Backstage', sub: 'For people who opened the console. How the studio works, live.', at, sections: [
    { key: 'engine', label: 'The engine, live', ico: '◉', sub: 'Updated twice a second while this is open.', wide: true, body: () => [live, scope] },
    { key: 'made', label: 'How it is made', ico: '⚙', wide: true, body: () => [h('div', { class: 'bks-grid' },
      bksRow('Version', 'v' + VERSION + ' · build ' + BUILD), bksRow('Made from', PARTS_N + ' parts · ' + LINES_N.toLocaleString('en') + ' lines'), bksRow('This page arrived as', nav ? kb(nav.transferSize || nav.encodedBodySize) + ' (' + kb(nav.decodedBodySize) + ' unpacked)' : '?'),
      bksRow('Framework', 'none'), bksRow('Runtime dependencies', '0'), bksRow('Requests to other sites', '0 (unless you say yes to MediaPipe, or connect GitHub)'), bksRow('Script policy', 'one inline script, allowed by its SHA-256 hash'), bksRow('Audio', 'Web Audio + 7 AudioWorklet processors')),
      h('p', { class: 'small muted' }, 'The parts are plain JavaScript files concatenated in name order into one closure, minified by a dependency-free minifier that the build proves changed nothing but whitespace. The QR codes, the zero-delay compressors and the oversampling filters are written here too.'),
      h('div', { class: 'hub-acts' }, h('a', { class: 'btn', href: BRAND.repo, target: '_blank', rel: 'noopener noreferrer' }, 'Source ↗'), h('a', { class: 'btn', href: BRAND.repo + '/blob/main/docs/ARCHITECTURE.md', target: '_blank', rel: 'noopener noreferrer' }, 'Architecture ↗'), h('a', { class: 'btn', href: BRAND.repo + '/blob/main/docs/AGENT_API.md', target: '_blank', rel: 'noopener noreferrer' }, 'Agent API ↗'))] },
    { key: 'agent', label: 'Agent playground', ico: '🤖', sub: 'Call the same tools an AI agent gets (WebMCP and window.dailyStudio). Changes are real, and Ctrl/⌘+Z undoes them.', wide: true, body: () => [
      CFG.agents === false ? h('p', { class: 'small' }, 'Agent access is off in Settings ▸ Workflow, so calls are answered “disabled”.') : null,
      h('div', { class: 'row', style: { gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, sel, run), inp, outp].filter(Boolean) },
    { key: 'secrets', label: 'Secrets', ico: '🗝', wide: true, body: () => [secretList()] }
  ] });
  /* the live numbers, and the scope */
  const paint = () => {
    if (!live.isConnected) { clearInterval(BKS.tm); BKS.tm = 0; return; }
    const c = E.ctx, ms = v => v == null ? '—' : (v * 1000).toFixed(1) + ' ms', mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : 'n/a';
    live.innerHTML = '';
    [['Audio engine', c ? c.state + ' · ' + c.sampleRate + ' Hz' : 'not started'], ['One render quantum', c ? '128 frames · ' + (128 / c.sampleRate * 1000).toFixed(2) + ' ms' : '—'], ['Browser base / output latency', c ? ms(c.baseLatency) + ' / ' + ms(c.outputLatency) : '—'],
      ['Zero-delay effects', E.worklet && CFG.lowLat !== false ? 'on' : 'off'], ['Delay the rig adds', ms(rigLat())], ['Delay the vocal strip adds', ms(voxLat())], ['Measured round trip', CFG.rtt != null ? CFG.rtt + ' ms' : 'not measured'],
      ['Input', E.hasInput ? 'open' : 'none'], ['Frames a second', String(FPS)], ['JS memory', mem], ['Takes in memory', String(TAKES.length)], ['Secrets found', secretN() + ' of ' + SECRETS.length]].forEach(([k, v]) => live.append(bksRow(k, v)));
  };
  const draw = () => {
    if (!scope.isConnected) { cancelAnimationFrame(BKS.raf); BKS.raf = 0; return; }
    BKS.raf = requestAnimationFrame(draw); const g = scope.getContext('2d'), W = scope.width, H = scope.height; g.fillStyle = '#050b0c'; g.fillRect(0, 0, W, H);
    const an = E.anaMaster; if (!an) return; const n = an.fftSize, td = BKS.td && BKS.td.length === n ? BKS.td : (BKS.td = new Float32Array(n)), fd = BKS.fd && BKS.fd.length === an.frequencyBinCount ? BKS.fd : (BKS.fd = new Float32Array(an.frequencyBinCount));
    an.getFloatTimeDomainData(td); an.getFloatFrequencyData(fd);
    g.fillStyle = 'rgba(61,220,132,.28)'; const bins = 96; for (let i = 0; i < bins; i++) { const k = Math.floor(Math.pow(i / bins, 2) * fd.length * .5) + 1, v = clamp((fd[k] + 100) / 80, 0, 1); g.fillRect(i * W / bins, H - v * H * .9, W / bins - 1, v * H * .9); }
    g.strokeStyle = '#3ddc84'; g.lineWidth = 1.5; g.beginPath(); const step = Math.max(1, Math.floor(n / W)); for (let x = 0; x < W; x++) { const v = td[Math.min(n - 1, x * step)] || 0; const y = H / 2 - v * H * .45; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    g.fillStyle = 'rgba(157,179,165,.8)'; g.font = '11px ui-monospace,Menlo,monospace'; g.fillText('master · ' + (E.ctx ? E.ctx.sampleRate : '') + ' Hz', 8, 14);
  };
  clearInterval(BKS.tm); paint(); BKS.tm = setInterval(paint, 500); cancelAnimationFrame(BKS.raf); draw();
  return d;
}
