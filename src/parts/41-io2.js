/* ---------- I/O 2: one place to connect, set your level and watch the signal path ----------
   One Connect component (device, Connect / Disconnect, live meter, Set my level, Hear myself) is used by the I/O panel, the header
   Audio dialog, the Perform readiness card and the Stage ⚙ button. Nothing here asks for the microphone until a button is pressed. */
const IO = { live: [], snap: [], wz: null, test: '', pkV: -120, pkAt: 0, sigAt: 0, connAt: 0, lv: null, lvN: -1, dbg: /[?&]debug\b/.test(location.search) };
const IO_TARGET = { g: -9, v: -10 };   // where the loudest peaks should land (dBFS)
const pctOf = d => clamp((d + 60) / 60, 0, 1) * 100;
const ioFmt = d => d < -90 ? '−∞' : d.toFixed(1);

/* ---- which browser, and what to tell the person when the microphone is refused ---- */
function ioBrowser(ua, touch) {
  ua = ua == null ? (navigator.userAgent || '') : ua; touch = touch == null ? (navigator.maxTouchPoints || 0) : touch;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1), android = /Android/.test(ua), win = /Windows/.test(ua), mac = /Macintosh/.test(ua) && !ios;
  const os = ios ? 'ios' : android ? 'android' : win ? 'win' : mac ? 'mac' : /CrOS/.test(ua) ? 'cros' : 'linux';
  const b = /Edg(e|A|iOS)?\//.test(ua) ? 'edge' : /OPR\/|Opera/.test(ua) ? 'opera' : /Firefox\/|FxiOS\//.test(ua) ? 'firefox' : /Chrome\/|CriOS\//.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : 'other';
  return { b, os };
}
const IO_BN = { chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox', safari: 'Safari', opera: 'Opera', other: 'your browser' };
function ioFramed() { try { return window.self !== window.top; } catch (e) { return true; } }
/** { kind, title, steps[] } for an error name from getUserMedia (or 'ended' when the device went away) */
function ioPermHelp(name, br, framed, secure) {
  br = br || ioBrowser(); framed = framed == null ? ioFramed() : framed; secure = secure == null ? window.isSecureContext !== false : secure;
  const B = IO_BN[br.b] || 'your browser', os = br.os, mobile = os === 'ios' || os === 'android', n = name || '';
  const kind = /^(NotAllowed|Security|PermissionDenied)/.test(n) ? 'denied' : /^(NotFound|Overconstrained|DevicesNotFound)/.test(n) ? 'none' : /^(NotReadable|Abort|TrackStart)/.test(n) ? 'busy' : n === 'ended' ? 'ended' : 'other';
  const sys = os === 'win' ? 'Windows Settings → Privacy & security → Microphone: turn on “Microphone access” and “Let desktop apps access your microphone”.'
    : os === 'mac' ? 'macOS System Settings → Privacy & Security → Microphone: switch ' + B + ' on.'
      : os === 'ios' ? 'iPhone / iPad Settings → Privacy & Security → Microphone: allow ' + B + '.'
        : os === 'android' ? 'Android Settings → Apps → ' + B + ' → Permissions → Microphone → Allow.' : 'Your system’s sound and privacy settings.';
  let title, steps = [];
  if (kind === 'denied') {
    title = 'The microphone is blocked in ' + B;
    if (!secure) steps.push('This page is not on a secure address. Open it with https:// (or localhost): browsers only allow the microphone on secure pages.');
    if (framed) steps.push('This page is running inside a frame (an editor preview). Open it in its own browser tab: frames usually cannot use the microphone.');
    if (br.b === 'firefox') steps.push('Click the permissions icon at the left of the address bar. If the microphone says “Blocked”, click the ✕ beside it to clear it.', 'Press Try again and choose Allow when ' + B + ' asks.');
    else if (br.b === 'safari' && os === 'ios') steps.push('Tap the “aA” button in the address bar → Website Settings.', 'Set Microphone to Allow, then press Try again.');
    else if (br.b === 'safari') steps.push('Safari menu → Settings for This Website…', 'Set Microphone to Allow, then press Try again.');
    else if (mobile) steps.push('Tap the lock (or sliders) icon in the address bar → Permissions → Microphone → Allow.', 'Then press Try again.');
    else steps.push('Click the lock (or sliders) icon at the left of the address bar → Site settings → Microphone → Allow.', 'Press Try again (reload the page if ' + B + ' asks).');
    steps.push('Still blocked? ' + sys);
  } else if (kind === 'none') {
    title = 'No audio input found';
    steps.push('Check that the interface is plugged in, powered on and not in a charge-only mode; try another USB port or cable.',
      os === 'win' ? 'Windows Settings → System → Sound → Input: is the interface listed and enabled?' : os === 'mac' ? 'macOS System Settings → Sound → Input: is the interface listed?' : mobile ? 'Make sure the interface is plugged in before you open the app.' : 'Check your system’s sound settings for the input.',
      'Press Try again, or choose a different input.');
  } else if (kind === 'busy') {
    title = 'The input is in use or cannot start';
    steps.push('Another app may be holding the device (a recorder, a call app, or the interface’s own mixer set to exclusive mode). Close it.',
      os === 'win' ? 'Windows: Sound settings → your device → Additional device properties → Advanced → untick “Allow applications to take exclusive control”.' : 'Unplug and re-plug the interface if it still will not start.', 'Then press Try again.');
  } else if (kind === 'ended') {
    title = 'The input was unplugged or taken by another app';
    steps.push('Check the USB cable and that the interface is still powered.', 'Press Connect to open it again.');
  } else {
    title = 'Could not open the input' + (n ? ' (' + n + ')' : '');
    steps.push('Press Try again, or choose a different input.', 'Open Advanced & troubleshooting → Diagnose devices for a full report.');
  }
  return { kind, title, steps };
}
/** one-line version for a toast / the status line */
function ioErrMsg(name) { const p = ioPermHelp(name); return p.title + '. ' + p.steps[0]; }

/* ---- input list (shared with renderDevices) ---- */
function ioInputs() {
  const cur = (E.inSettings && E.inSettings.deviceId) || CFG.inDev, seen = new Set(), ins0 = E.devs.in.slice();
  if (E.hasInput && E.stream && cur && !ins0.some(d => d.deviceId === cur)) ins0.unshift({ deviceId: cur, label: (E.stream.getAudioTracks()[0] || {}).label || 'Active input', groupId: '' });
  const list = ins0.filter(d => { if (d.deviceId === 'communications') return false; const k = (d.groupId || '') + '|' + (d.label || d.deviceId).replace(/^(Default|Communications) - /, ''); if (d.deviceId === 'default') return true; if (seen.has(k) && d.deviceId !== cur) return false; seen.add(k); return true; });
  return { list, cur };
}
const ioInLabel = () => { const t = E.stream && E.stream.getAudioTracks()[0], dv = E.devs.in.find(d => d.deviceId === ((E.inSettings && E.inSettings.deviceId) || CFG.inDev)); return (t && t.label) || (dv && dv.label) || 'Input'; };
const ioOutName = () => { const d = (E.devs.out || []).find(x => x.deviceId === CFG.outDev); return (d && d.label) || 'Default output'; };
const ioNch = () => (E.inSettings && E.inSettings.channelCount) || 0;

/* ---- subscribe for as long as the element is on the page ---- */
function ioSub(el, evs, fn) {
  const born = performance.now(), f = (...a) => { if (!el.isConnected && performance.now() - born > 1500) { evs.forEach(e => bus.off(e, f)); return; } fn(...a); };
  evs.forEach(e => bus.on(e, f)); return f;
}
function ioLive(el, fn) { IO.live.push({ el, fn, born: performance.now() }); return el; }

/* ---- levels, read once per frame ---- */
function ioLevels() {
  if (IO.lv && IO.lvN === frameN) return IO.lv; IO.lvN = frameN;
  const L = { conn: !!(E.ready && E.hasInput), raw: -120, trim: -120, rms: -120, rig: -120, master: -120, silentFor: 0, recent: -120, roles: true, monoBad: false };
  if (!E.ready) return (IO.lv = L);
  const rd = (an, k) => an ? peakOf(an, k) : { pk: -120, rms: -120 }, now = performance.now();
  if (L.conn && E.anaL) L.raw = Math.max(rd(E.anaL, 'ioL').pk, rd(E.anaR, 'ioR').pk);
  const g = rd(E.anaIn, 'ioG'), v = rd(E.anaVox, 'ioV'); L.trim = Math.max(g.pk, v.pk); L.rms = Math.max(g.rms, v.rms); L.rig = rd(E.anaRig, 'ioRig').pk; L.master = rd(E.anaMaster, 'ioMas').pk;
  if (L.trim > IO.pkV || now - IO.pkAt > 3500) { IO.pkV = L.trim; IO.pkAt = now; } L.recent = IO.pkV;
  if (L.raw > -65 || L.trim > -65) IO.sigAt = now;
  const r = chRoles(); L.roles = r.some(x => x !== 'o'); L.monoBad = ioNch() === 1 && r[1] !== 'o';
  L.silentFor = L.conn ? (now - Math.max(IO.sigAt, IO.connAt)) / 1000 : 0;
  return (IO.lv = L);
}
/** what the path is telling you, in one sentence; pure so it can be tested */
function ioDiagnose(L) {
  if (!L.conn) return { k: 'idle', msg: 'Not connected. Connect an input to see the signal path.' };
  if (L.roles === false) return { k: 'warn', msg: 'Both inputs are set to Off. Choose Guitar or Vocal in Channels.' };
  if (L.raw >= -0.6) return { k: 'bad', msg: 'The input is clipping at the interface. Turn its gain knob down until its light stays green.' };
  if (L.trim >= -0.6) return { k: 'bad', msg: 'It clips after the trim. Lower the trim, or press Set my level.' };
  if (L.master >= -1.2) return { k: 'warn', msg: 'The master is touching the safety limiter. Lower the Master knob a little.' };
  if (L.silentFor > 5) return { k: 'warn', msg: L.monoBad ? 'Nothing is arriving: this device has one input but a role is set on input 2. Use input 1 in Channels.' : 'Connected, but nothing is arriving. Check the cable, the Inst / Line switch and the interface gain.' };
  if (L.recent > -90 && L.recent < -30) return { k: 'warn', msg: 'The level is low. Raise the interface gain, or press Set my level.' };
  if (L.recent > -90 && L.recent < -18) return { k: 'ok', msg: 'A little quiet. Set my level brings it up to about −9 dBFS.' };
  if (L.recent >= -18) return { k: 'ok', msg: 'Levels look healthy.' };
  return { k: 'ok', msg: 'Connected. Play or sing to see the level.' };
}

/* ---- connect / disconnect (one code path for every place that has a Connect button) ---- */
async function ioConnect(id) {
  AK.killed = false;
  try { await startAudio(); } catch (e) { toast('Audio could not start: ' + e.message, 'bad'); return false; }
  const ok = id ? await openInput(id) : await pickInput();
  await listDevices(); bus.emit('audiostate'); if (ok) bus.emit('route'); return !!ok;
}
function ioDisconnect() { closeInput(); E.lastInErr = null; E.lastInKind = null; bus.emit('audiostate'); }
/** the Connect button on Perform / Stage: connects at once when the choice is obvious, otherwise opens the shared Audio panel */
async function ioConnectFlow() {
  try { await startAudio(); } catch (e) { toast('Audio could not start: ' + e.message, 'bad'); return false; }
  if (typeof AK !== 'undefined') AK.killed = false;
  await listDevices(); const named = ioInputs().list.filter(d => d.label && d.deviceId !== 'default');
  if (!E.hasInput && !CFG.inDev && named.length > 1) { audioOpen(); return false; }
  return ioConnect(CFG.inDev || '');
}

/* ---- the Connect component ---- */
function ioConnectEl(o = {}) {
  const led = h('i', { class: 'led' }), stTxt = h('span', {}), st = h('div', { class: 'io-st', role: 'status', 'aria-live': 'polite' }, led, stTxt);
  const sel = h('select', { class: 'in io-sel', 'aria-label': 'Audio input device', onchange: async () => { if (E.hasInput) await ioConnect(sel.value); } });
  const go = h('button', { class: 'btn primary io-go', onclick: async () => { go.disabled = true; try { if (E.hasInput) ioDisconnect(); else await ioConnect(sel.value); } finally { go.disabled = false; refresh(); } } }, 'Connect');
  const rescan = h('button', { class: 'btn sm io-scan', title: 'Re-scan devices (asks for the microphone if device names are hidden)', 'aria-label': 'Re-scan input devices', onclick: async () => { await refreshInputs(); refresh(); } }, '↻');
  const help = h('div', { class: 'io-help', hidden: true });
  const lvI = h('i'), lvU = h('u'), lvT = h('s', { class: 'io-tgt', title: 'Aim for peaks in this zone (−12 to −6 dBFS)' }), lvTxt = h('span', { class: 'mono tiny' }, 'not connected');
  const lvLed = h('i', { class: 'led', title: 'Clip light (click to clear)', onclick: () => { lvLed.className = 'led'; } });
  const lvl = h('div', { class: 'io-lv' }, h('div', { class: 'row sp tiny muted' }, h('span', {}, 'Level (after trim)'), lvTxt), h('div', { class: 'row', style: { gap: '8px' } }, h('div', { class: 'meter io-meter', 'aria-hidden': 'true' }, lvI, lvU, lvT), lvLed));
  const lvBtn = h('button', { class: 'btn sm io-level', title: 'Play or sing your loudest part for five seconds and the trim is set for you', onclick: () => ioLevelWizard() }, '🎚 Set my level');
  const mon = h('button', { class: 'tog io-mon', title: 'Hear yourself through the app. Headphones only, or it feeds back.', onclick: () => { const on = !CFG.monitor; setMonitor(on); if (on && !ioPhones()) toast('You are hearing yourself: wear headphones, or the speakers will feed back into the mic. (Or use the interface’s Direct Monitor and leave this off.)', 'warn'); } }, 'Hear myself');
  const row2 = h('div', { class: 'row io-btns' }, lvBtn, o.mon === false ? '' : mon);
  const note = o.mon === false ? '' : h('div', { class: 'tiny muted io-note' }, 'Headphones on? Then “Hear myself” is safe. For zero delay use your interface’s Direct Monitor and leave this off.');
  let hold = -120;
  const refresh = () => {
    const { list, cur } = ioInputs(), keep = sel.value; sel.innerHTML = '';
    if (!E.hasInput || !list.some(d => d.deviceId === 'default')) sel.append(h('option', { value: '' }, 'System default input'));
    list.forEach((d, i) => sel.append(h('option', { value: d.deviceId }, d.label || ('Input ' + (i + 1) + (E.hasInput ? '' : ' (name hidden until the mic is allowed)')))));
    const want = E.hasInput ? cur : ([...sel.options].some(x => x.value === keep) && keep !== '' ? keep : CFG.inDev);
    sel.value = [...sel.options].some(x => x.value === want) ? want : (sel.options[0] ? sel.options[0].value : '');
    const nch = ioNch(), kHz = E.ctx ? (E.ctx.sampleRate / 1000).toFixed(1).replace(/\.0$/, '') : '?';
    st.dataset.k = E.hasInput ? 'on' : (AK.killed || E.lastInKind) ? 'bad' : 'off';
    led.className = 'led ' + (E.hasInput ? 'on' : (AK.killed || E.lastInKind) ? 'bad' : '');
    stTxt.textContent = E.hasInput ? ioInLabel() + ' · ' + (nch === 1 ? 'mono' : (nch || '?') + ' ch') + ' · ' + kHz + ' kHz'
      : AK.killed ? 'Audio is killed (Ctrl + .). Press Connect to resume.' : E.lastInKind ? (E.lastInErr || 'Could not open the input.') : (E.devs.in.length && E.devs.in.every(d => !d.label) ? 'Not connected. Device names stay hidden until you allow the microphone.' : 'Not connected. Nothing is requested from your browser until you press Connect.');
    go.textContent = E.hasInput ? 'Disconnect' : 'Connect'; go.classList.toggle('primary', !E.hasInput);
    lvBtn.disabled = !E.hasInput; lvBtn.classList.toggle('primary', !!E.hasInput && !CFG.ioLeveled); mon.classList.toggle('on', !!CFG.monitor);
    help.innerHTML = ''; help.hidden = !(!E.hasInput && E.lastInKind);
    if (!help.hidden) {
      const p = ioPermHelp(E.lastInKind); help.append(h('b', {}, p.title), h('ol', {}, p.steps.map(s => h('li', {}, s))),
        h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, h('button', { class: 'btn sm primary io-retry', onclick: async () => { await ioConnect(sel.value); refresh(); } }, 'Try again'), h('button', { class: 'btn sm io-diag', onclick: async e => { e.target.disabled = true; const L = await diagnoseInputs(false); e.target.disabled = false; let pre = help.querySelector('pre'); if (!pre) { pre = h('pre', { class: 'tiny io-pre' }); help.append(pre); } pre.textContent = L.join('\n'); } }, '🩺 Run diagnostics')));
    }
  };
  const tick = () => {
    const L = ioLevels(), on = L.conn; lvI.style.width = on ? dbw(L.rms) : '0%'; hold = Math.max(L.trim, hold - .6); lvU.style.left = on ? dbw(Math.max(hold, -60)) : '0%';
    lvTxt.textContent = on ? 'peak ' + ioFmt(L.trim) + ' dBFS' : 'not connected'; if (on && (L.raw > -0.6 || L.trim > -0.6)) lvLed.className = 'led bad';
  };
  lvT.style.left = pctOf(-12) + '%'; lvT.style.width = (pctOf(-6) - pctOf(-12)) + '%';
  const root = h('div', { class: 'io-conn' }, st, h('div', { class: 'row io-pick' }, sel, rescan), h('div', { class: 'row' }, go), help, lvl, row2, note, o.path === false ? '' : ioPathEl());
  refresh(); ioSub(root, ['devices', 'input', 'audiostate', 'monitor', 'iolevel', 'route'], refresh); ioLive(root, tick); return root;
}
function ioPhones() { const d = (E.devs.out || []).find(x => x.deviceId === CFG.outDev) || (E.devs.out || []).find(x => x.deviceId === 'default'); return !!(d && /head(phone|set)|earphone|earbud|airpods|buds|bluetooth/i.test(d.label || '')); }

/* ---- the signal path: Input → Trim → Rig → Master → Out ---- */
function ioPathEl() {
  const spec = [['raw', 'Input', 'What the interface sends in, before any change. If this clips, turn the gain knob on the interface down.'], ['trim', 'Trim', 'After the Input Trim (guitar) or Vocal Trim. Aim for peaks around −12 to −6 dBFS.'], ['rig', 'Rig', 'After your amp and effects.'], ['master', 'Master', 'After the master and the safety limiter. Keep it below −1 dBFS.']];
  const R = {}, wrap = h('div', { class: 'io-path', role: 'group', 'aria-label': 'Signal path: input, trim, rig, master, output' });
  spec.forEach(([k, t, tip]) => { const bar = h('i'), led = h('i', { class: 'led' }), rd = h('span', { class: 'mono' }, '–'); R[k] = { bar, led, rd, clipAt: 0, hold: -120, t: performance.now() }; wrap.append(h('div', { class: 'io-n', 'data-k': k, title: tip }, led, h('div', { class: 'io-vm', 'aria-hidden': 'true' }, bar), rd, h('b', {}, t))); });
  const oname = h('span', { class: 'io-on tiny' }, 'Default output'), tbtn = h('button', { class: 'btn sm io-test', title: 'Plays a short tone in the left speaker, then the right', onclick: () => ioTestSound() }, '🔊 Test');
  const outRow = h('div', { class: 'io-out', 'data-k': 'out', title: 'Where you hear the master' }, h('b', {}, 'Out'), oname, tbtn);
  const msg = h('div', { class: 'io-msg tiny', 'aria-live': 'polite' }), box = h('div', { class: 'io-pathbox' }, wrap, outRow, msg);
  const tick = () => {
    const L = ioLevels(), now = performance.now();
    spec.forEach(([k]) => { const r = R[k], live = k === 'rig' || k === 'master' ? E.ready : L.conn, x = live ? Math.max(L[k], -120) : -120, lim = k === 'master' ? -1.2 : -0.6; r.hold = Math.max(x, r.hold - 36 * Math.min(.25, (now - r.t) / 1000)); r.t = now; r.bar.style.height = pctOf(r.hold) + '%'; r.rd.textContent = r.hold < -90 ? '–' : r.hold.toFixed(0); if (live && x >= lim) r.clipAt = now; r.led.className = 'led' + (now - r.clipAt < 1500 ? ' bad' : ''); });
    const d = ioDiagnose(L); box.dataset.k = d.k; if (msg.textContent !== d.msg) msg.textContent = d.msg;
    const on = ioOutName(); if (oname.textContent !== on) oname.textContent = on; box.classList.toggle('io-testing', !!IO.test); if (IO.test) oname.textContent = IO.test === 'L' ? 'Left…' : 'Right…';
  };
  return ioLive(box, tick);
}
function ioTick() {
  const now = performance.now(); if (IO.live.length) IO.live = IO.live.filter(x => x.el.isConnected || now - x.born < 1500);
  const a = UI.audLv; if (a && a.isConnected) { const L = ioLevels(); a.firstChild.style.width = L.conn ? dbw(L.trim) : '0%'; a.classList.toggle('clip', L.conn && (L.raw > -0.6 || L.trim > -0.6)); a.classList.toggle('on', L.conn); }
  if (!IO.live.length) return; IO.live.forEach(x => { if (x.el.isConnected) try { x.fn(); } catch (e) { console.error(e); } });
}

/* ---- output test: a short tone left, then right, through the real master chain ---- */
async function ioTestSound() {
  if (AK.killed) return toast('Audio is killed. Resume it first (Audio ▸ Connect).', 'warn');
  if (T.rec) return toast('Stop recording first: the test tone would be recorded.', 'warn');
  try { await startAudio(); } catch (e) { return toast('Audio could not start: ' + e.message, 'bad'); }
  if (!E.ready) return toast('The audio engine is not ready yet.', 'warn');
  const c = E.ctx, t0 = c.currentTime + .06, dest = E.mix || E.master;
  [[330, -1, 0, 'L'], [495, 1, .6, 'R']].forEach(([f, pan, dt, tag]) => {
    const o = c.createOscillator(), g = c.createGain(), p = c.createStereoPanner(), a = t0 + dt; o.type = 'sine'; o.frequency.value = f; p.pan.value = pan;
    g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(.18, a + .03); g.gain.setValueAtTime(.18, a + .38); g.gain.linearRampToValueAtTime(0, a + .5);
    o.connect(g); g.connect(p); p.connect(dest); o.start(a); o.stop(a + .55); o.onended = () => { try { p.disconnect(); } catch (e) { } };
    setTimeout(() => { IO.test = tag; }, Math.max(0, (a - c.currentTime) * 1000));
  });
  setTimeout(() => { IO.test = ''; }, 1400); bus.emit('iotest');
  toast('Test tone: you should hear a low note on the left, then a higher one on the right, at a comfortable level.', 'ok');
}

/* ---- Set my level ---- */
/** raw = loudest peak with 0 dB of trim; returns what to do (pure) */
function ioPlan(raw, target, lo, hi) {
  lo = lo == null ? -24 : lo; hi = hi == null ? 36 : hi;
  if (raw < -55) return { k: 'none' };
  if (raw >= -0.5) return { k: 'hot', trim: 0 };
  const t = clamp(Math.round((target - raw) * 2) / 2, lo, hi);
  return { k: 'ok', trim: t, pk: raw + t, big: t > 24, low: t <= -3 };
}
const ioTrimKey = src => src === 'v' ? 'voxTrim' : 'trim';
const ioTrimOf = src => { const k = KNOBS.get(ioTrimKey(src)); return k ? k.get() : (src === 'v' ? CFG.voxTrim || 0 : CFG.gTrim || 0); };
function ioApplyTrim(src, db) { const k = KNOBS.get(ioTrimKey(src)); if (k) k.set(db); else if (src === 'v') setVoxTrim(db); else { CFG.gTrim = db; saveCfg(); if (E.ready) tc(E.inTrim.gain, fromDB(db), .02); } }
/** the loudest peak right now, measured after the trim */
function ioSample(src) {
  if (IO.dbg && typeof window.__ioFeed === 'function') return window.__ioFeed(src) + ioTrimOf(src);
  const an = src === 'v' ? E.anaVox : E.anaIn; return an ? peakOf(an, 'ioW' + src).pk : -120;
}
function ioLevelWizard(src0) {
  const roles = chRoles(), has = { g: roles.includes('g'), v: roles.includes('v') };
  const W = IO.wz = { src: src0 || (has.g ? 'g' : has.v ? 'v' : 'g'), phase: 'ready', pk: -120, t0: 0, res: null, prev: 0, timer: 0 };
  const body = h('div', { class: 'io-wz' }), dur = () => (IO.dbg && window.__ioLevelMs) || 5000, stop = () => { if (W.timer) { clearInterval(W.timer); W.timer = 0; } };
  const name = () => W.src === 'v' ? 'voice' : 'guitar';
  function finish() {
    stop(); const trim0 = ioTrimOf(W.src), raw = W.pk - trim0, plan = ioPlan(raw, IO_TARGET[W.src]); W.prev = trim0; W.res = { raw, plan }; W.phase = 'result';
    if (plan.k === 'ok') { ioApplyTrim(W.src, plan.trim); CFG.ioLeveled = true; saveCfg(); bus.emit('iolevel'); } draw();
  }
  function start() {
    W.phase = 'listen'; W.pk = -120; W.t0 = performance.now(); stop(); draw();
    W.timer = setInterval(() => { const v = ioSample(W.src); W.pk = Math.max(W.pk, v); const left = Math.max(0, dur() - (performance.now() - W.t0)), bar = body.querySelector('.io-wz-bar'), t = body.querySelector('.io-wz-t'), pk = body.querySelector('.io-wz-pk');
      if (bar) bar.style.width = dbw(v); if (t) t.textContent = Math.ceil(left / 1000) + ' s'; if (pk) pk.textContent = 'Loudest so far: ' + ioFmt(W.pk) + ' dBFS'; if (left <= 0) finish(); }, 40);
  }
  function draw() {
    body.innerHTML = '';
    if (!E.hasInput) { body.append(h('p', {}, 'First connect your input, then I can hear it.'), ioConnectEl({ path: false, mon: false })); return; }
    if (W.phase === 'ready') {
      if (!has.g && !has.v) { body.append(h('p', {}, 'Both inputs are set to Off. Choose Guitar or Vocal in the Channels card first.'), h('button', { class: 'btn', onclick: () => d.close() }, 'Close')); return; }
      body.append(
        has.g && has.v ? h('div', { class: 'row', style: { gap: '8px', alignItems: 'center' } }, h('span', { class: 'tiny muted' }, 'Set the level for'), h('div', { class: 'seg io-wz-src' }, [['g', '🎸 Guitar'], ['v', '🎤 Voice']].map(([k, t]) => h('button', { class: W.src === k ? 'on' : '', 'data-src': k, onclick: () => { W.src = k; draw(); } }, t)))) : h('div', { class: 'tiny muted' }, 'Setting the level for your ' + name() + '.'),
        h('p', {}, W.src === 'v' ? 'Sing (or talk) at your loudest for five seconds, as if it were the chorus. I will set the Vocal Trim so the peaks land around −10 dBFS.' : 'Play your guitar the way you will in the song, including the loudest chords, for five seconds. I will set the Input Trim so the peaks land around −9 dBFS.'),
        h('p', { class: 'tiny muted' }, 'First, set the gain knob on your interface so its light is green and never red. The trim here only fine-tunes it.'),
        h('div', { class: 'row', style: { gap: '8px' } }, h('button', { class: 'btn primary io-wz-go', onclick: start }, '▶ Start listening'), h('button', { class: 'btn', onclick: () => d.close() }, 'Cancel')));
    } else if (W.phase === 'listen') {
      body.append(h('div', { class: 'io-wz-big' }, h('b', {}, W.src === 'v' ? 'Sing now…' : 'Play now…'), h('span', { class: 'io-wz-t mono' }, '')), h('div', { class: 'meter io-wz-m', 'aria-hidden': 'true' }, h('i', { class: 'io-wz-bar' }), h('s', { class: 'io-tgt', style: { left: pctOf(-12) + '%', width: (pctOf(-6) - pctOf(-12)) + '%' } })), h('div', { class: 'tiny mono io-wz-pk' }, ''), h('button', { class: 'btn', onclick: () => { stop(); W.phase = 'ready'; draw(); } }, 'Cancel'));
    } else {
      const { raw, plan } = W.res, r = h('div', { class: 'io-wz-res', 'data-k': plan.k });
      if (plan.k === 'none') r.append(h('b', {}, 'I did not hear anything.'), h('ul', { class: 'tiny' }, [h('li', {}, 'Is the cable in, and is the Inst / Line switch right for a guitar?'), h('li', {}, 'Turn the interface’s gain knob up a little.'), h('li', {}, 'In Channels, is the right input set to ' + (W.src === 'v' ? 'Vocal' : 'Guitar') + '?'), h('li', {}, 'Is the instrument or mic muted?')]));
      else if (plan.k === 'hot') r.append(h('b', {}, 'That was clipping at the interface.'), h('p', { class: 'tiny' }, 'The peak reached 0 dBFS before the app could touch it, so a trim cannot fix it. Turn the interface’s gain knob down until its light stays green, then measure again.'));
      else r.append(h('b', {}, 'Level set.'), h('p', {}, 'Loudest peak was ', h('span', { class: 'mono' }, ioFmt(raw) + ' dBFS'), ' with no trim. The ' + (W.src === 'v' ? 'Vocal' : 'Input') + ' Trim is now ', h('span', { class: 'mono io-wz-trim' }, (plan.trim >= 0 ? '+' : '') + plan.trim.toFixed(1) + ' dB'), ', so peaks land around ', h('span', { class: 'mono' }, ioFmt(plan.pk) + ' dBFS'), '.'),
        plan.big ? h('p', { class: 'tiny' }, 'That is a lot of software gain, which also lifts the noise. If you can, raise the gain knob on the interface and measure again.') : '',
        plan.low ? h('p', { class: 'tiny' }, 'Your interface gain is on the high side already. Turning it down a little gives you more headroom.') : '');
      body.append(r, h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, plan.k === 'ok' ? h('button', { class: 'btn primary io-wz-done', onclick: () => d.close() }, 'Done') : '', plan.k === 'ok' ? h('button', { class: 'btn io-wz-undo', onclick: () => { ioApplyTrim(W.src, W.prev); toast('Trim put back to ' + (W.prev >= 0 ? '+' : '') + W.prev.toFixed(1) + ' dB', 'ok'); d.close(); } }, 'Undo') : '', h('button', { class: 'btn io-wz-again', onclick: () => { W.phase = 'ready'; draw(); } }, 'Measure again')));
    }
  }
  const d = pdlg('iolevel', 'SET MY LEVEL', body, { cls: 'auddlg', onclose: () => { stop(); IO.wz = null; } });
  ioSub(body, ['input'], () => { if (W.phase !== 'listen') draw(); }); draw(); return d;
}

/* ---- channels that follow the device ---- */
function ioChannelPresets() {
  const nch = ioNch(), P = [['🎸 Guitar', ['g', 'o'], 'Input 1 is the guitar'], ['🎤 Voice', ['v', 'o'], 'Input 1 is the voice']];
  if (nch !== 1) P.splice(1, 0, ['🎸+🎤 Guitar & voice', ['g', 'v'], 'Guitar on input 1, voice on input 2'], ['⇄ Swap', null, 'Swap what the two inputs are']);
  return P.map(([t, r, tip]) => h('button', { class: 'btn sm io-preset', title: tip, onclick: () => { if (r) chSetRoles(r[0], r[1]); else { const c = chRoles(); chSetRoles(c[1], c[0]); } } }, t));
}
function ioChannelNote() {
  const nch = ioNch(), roles = chRoles(), max = E.inMax || 0;
  if (!E.hasInput) return 'Not connected yet: choose what is plugged into each input now, or connect first and the card adapts to your device.';
  if (nch === 1) return roles[1] !== 'o' ? 'This device has one input, but input 2 is in use. Use input 1 only.' : 'This device has a single input, so it can carry the guitar or the voice, not both at once. For both, use a two-input interface (a Focusrite Scarlett / Solo or similar).';
  const base = CFG.vin === 'off' ? 'Set each input to what is plugged into it. A guitar on one input and a mic on the other gives each its own lane and take; “Guitar” on both sums them into one guitar.' : 'Guitar and voice are on separate inputs. Arm both lanes (●) and press R: both record on the same clock. Use headphones, or the interface’s Direct Monitor, to avoid feedback.';
  return max > 2 ? 'This device has ' + max + ' inputs; the browser gives the app inputs 1 and 2. To use others, route them to 1 and 2 in the interface’s own mixer. ' + base : base;
}

/* ---- a new interface was plugged in ---- */
function ioNewInputs(before, list) {
  const known = before instanceof Set ? before : new Set(before || []);
  return (list || []).filter(d => d.label && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications' && !known.has(d.deviceId));
}
bus.on('devices', () => { IO.snap = (E.devs.in || []).filter(d => d.label).map(d => d.deviceId); });
bus.on('input', i => { if (i) IO.connAt = performance.now(); });
async function ioDeviceChange() {
  const before = new Set(IO.snap); await listDevices();
  if (!before.size || $('#boot') || !E.ctx || E.ctx.state !== 'running' || AK.killed) return;   // nothing before we were asked: stay quiet
  const added = ioNewInputs(before, E.devs.in); if (added.length) ioOffer(added[0]);
}
function ioOffer(dev) {
  const old = $('#ioOffer'); if (old) old.remove(); clearTimeout(IO.offerT);
  const name = (dev && dev.label) || 'A new audio input', switching = !!E.hasInput;
  const box = h('div', { id: 'ioOffer', class: 'io-offer', role: 'status', 'aria-live': 'polite' });
  const close = () => { clearTimeout(IO.offerT); box.remove(); };
  const ask = () => { box.innerHTML = ''; box.append(h('b', {}, '🎙 ' + name + ' was plugged in.'), h('span', { class: 'tiny' }, switching ? 'Switch to it for recording?' : 'Use it for recording?'),
    h('div', { class: 'row', style: { gap: '6px' } }, h('button', { class: 'btn sm primary', id: 'ioOfferUse', onclick: async () => { const ok = await ioConnect(dev.deviceId); if (ok) done(); else close(); } }, switching ? 'Switch' : 'Use it'), h('button', { class: 'btn sm', id: 'ioOfferNo', onclick: close }, 'Not now'))); };
  const done = () => { box.innerHTML = ''; box.append(h('b', {}, '✓ ' + ioInLabel()), h('div', { class: 'row', style: { gap: '6px' } }, h('button', { class: 'btn sm primary', id: 'ioOfferLevel', onclick: () => { close(); ioLevelWizard(); } }, 'Set my level'), h('button', { class: 'btn sm', onclick: close }, 'Done'))); clearTimeout(IO.offerT); IO.offerT = setTimeout(close, 15000); };
  ask(); document.body.append(box); IO.offerT = setTimeout(close, 25000); return box;
}

/* ---- the header pill shows a tiny live level ---- */
function ioPillLevel() { UI.audLv = h('i', { class: 'aud-lv', 'aria-hidden': 'true' }, h('b')); return UI.audLv; }
