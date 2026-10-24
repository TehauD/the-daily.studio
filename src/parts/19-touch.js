/* ============================================================
   Part 19 · touch-first extras
   on-screen tab keypad, long-press = right-click, screen wake lock while playing,
   first-run phone defaults, installable app (manifest + service worker), Esc / back for the stage
   Everything here is inert on desktop.
   ============================================================ */
const TK = { arm: '' };
const touchUI = () => !!document.body.dataset.form && document.body.dataset.form !== 'desktop';
const coarsePtr = () => matchMedia('(pointer:coarse)').matches;

/* ---------- on-screen tab keypad ---------- */
function kpSend(key) { tabKey({ key, ctrlKey: false, metaKey: false, altKey: false, preventDefault() { }, stopPropagation() { } }); kpSync(); }
function kpDigit(d) {
  let v = +d; if (TK.arm) { const w = +(TK.arm + d); if (w <= 24) v = w; TK.arm = ''; }
  TE.buf = ''; TE.t = 0; setNote(v); kpSync();
  if (CFG.kpAuto !== false) kpSend('ArrowRight');
}
function kpArm(a) { TK.arm = TK.arm === a ? '' : a; kpSync(); }
function kpSync() {
  if (!TK.el) return;
  $$('.kp.arm', TK.el).forEach(b => b.classList.toggle('on', b.dataset.a === TK.arm));
  TK.auto.classList.toggle('on', CFG.kpAuto !== false);
  const n = curBar() && curBar().tab.find(o => o.s === TE.slot && o.st === TE.st);
  TK.info.textContent = 'bar ' + (TE.bi + 1) + ' · string ' + (stringLabels()[5 - TE.st] || '') + ' · ' + (n ? 'fret ' + n.f + (n.t ? ' ' + n.t : '') : 'empty') + (TK.arm ? ' · +' + TK.arm + 'x' : '');
}
function buildKeypad() {
  const dock = $('#dock'); if (!dock || !PANES.tab) return;
  const k = (label, fn, cls, title, extra) => h('button', Object.assign({ class: 'kp ' + (cls || ''), type: 'button', title: title || '', 'aria-label': title || label, onpointerdown: e => e.preventDefault(), onclick: fn }, extra || {}), label);
  const nums = [...'0123456789'].map(d => k(d, () => kpDigit(d), 'num', 'Fret ' + d));
  TK.auto = k('Auto ▶', () => { CFG.kpAuto = CFG.kpAuto === false; saveCfg(); kpSync(); }, 'tog', 'Move to the next slot after each fret');
  TK.info = h('span', { class: 'kp-info' });
  const tech = [['h', 'h', 'Hammer-on'], ['p', 'p', 'Pull-off'], ['/', '/', 'Slide up'], ['\\', '\\', 'Slide down'], ['b', 'b', 'Bend'], ['~', '~', 'Vibrato'], ['x', 'x', 'Muted note'], ['<', '‹n›', 'Natural harmonic']].map(([key, lab, t]) => k(lab, () => kpSend(key), 'tech', t));
  const tools = h('div', { class: 'kp-row kp-tools' },
    k('10s', () => kpArm('1'), 'arm', 'Next digit makes a fret 10–19', { 'data-a': '1' }), k('20s', () => kpArm('2'), 'arm', 'Next digit makes a fret 20–24', { 'data-a': '2' }),
    k('◀', () => kpSend('ArrowLeft'), 'nav', 'Previous slot'), k('▶', () => kpSend('ArrowRight'), 'nav', 'Next slot'), k('▲', () => kpSend('ArrowUp'), 'nav', 'Higher string'), k('▼', () => kpSend('ArrowDown'), 'nav', 'Lower string'),
    k('⌫', () => kpSend('Delete'), 'nav bad', 'Clear this note'), TK.auto, ...tech,
    k('⏵ bar', () => kpSend('Enter'), 'nav', 'Play from this bar'));
  TK.el = h('div', { id: 'kpad', role: 'group', 'aria-label': 'Tab keypad' }, h('div', { class: 'kp-row kp-nums' }, ...nums), tools, TK.info);
  dock.append(TK.el);
  bus.on('song', kpSync); bus.on('dock', () => setTimeout(kpSync, 0));
  document.addEventListener('pointerup', () => { if (document.body.dataset.s === 'tab') setTimeout(kpSync, 0); }, true);
  kpSync();
}

/* ---------- long-press = right-click (knob MIDI-learn, band chip menus, …) ---------- */
function initLongPress() {
  let tm = 0, sx = 0, sy = 0, tgt = null, native = false;
  const stop = () => { clearTimeout(tm); tm = 0; };
  document.addEventListener('pointerdown', e => {
    stop(); native = false; if (e.pointerType !== 'touch' || !e.isPrimary || !touchUI()) return;
    if (e.target.closest('input,select,textarea,.tcell,#kpad,.msheet')) return;
    sx = e.clientX; sy = e.clientY; tgt = e.target;
    tm = setTimeout(() => {
      tm = 0; if (native || !tgt || !tgt.isConnected) return;
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: sx, clientY: sy, view: window, button: 2 });
      if (!tgt.dispatchEvent(ev) && navigator.vibrate) { try { navigator.vibrate(12); } catch (er) { } }
    }, 650);
  }, true);
  document.addEventListener('pointermove', e => { if (tm && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) stop(); }, true);
  ['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, stop, true));
  document.addEventListener('contextmenu', e => { if (e.isTrusted) { native = true; stop(); } }, true);
}

/* ---------- keep the screen on while it matters ---------- */
const WK = { lock: null };
async function wakeSync() {
  const want = touchUI() && CFG.wake !== false && !document.hidden && !!(T.playing || T.rec || (E.hasInput && CFG.monitor));
  if (want && !WK.lock && navigator.wakeLock) {
    try { WK.lock = await navigator.wakeLock.request('screen'); WK.lock.addEventListener('release', () => { WK.lock = null; }); } catch (e) { WK.lock = null; }
  } else if (!want && WK.lock) { try { await WK.lock.release(); } catch (e) { } WK.lock = null; }
}

/* ---------- installable app: manifest + offline cache (https / localhost only) ---------- */
function initPwa() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  document.body.dataset.pwa = standalone ? '1' : '0';
  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (secure && window.self === window.top && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  window.addEventListener('appinstalled', () => { M.installEvt = null; toast(BRAND.name + ' installed', 'ok'); });
}

/* ---------- build ---------- */
function buildTouch() {
  buildKeypad(); initLongPress(); initPwa();
  setInterval(wakeSync, 2000); document.addEventListener('visibilitychange', wakeSync);
  if (!CFG.touchInit && touchUI() && coarsePtr()) {
    CFG.touchInit = 1; CFG.monitor = false; saveCfg();
    bus.on('booted', () => setTimeout(() => toast('In-app monitoring starts OFF on touch devices to avoid speaker feedback. Plug in headphones, then switch Monitor on in ⋯ More.', 'ok'), 1200));
  }
  bus.on('form', () => { if (typeof renderStageUI === 'function') renderStageUI(); const w = SG && SG.wrap; if (w && w.classList.contains('pfs') && !touchUI()) stagePfs(false); kpSync(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && SG && SG.wrap && SG.wrap.classList.contains('pfs')) stagePfs(false); });
}
