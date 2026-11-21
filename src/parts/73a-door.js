/* ============================================================
   Part 73a · THE DOOR TO BACKSTAGE (2.85)
   Backstage itself (parts 73c and 73d: the rooms, the shell, the palette, the console toolkit) loads from the "backstage" room the first time it is
   needed: when you knock, when you open it, or when you start the studio already on the list. This part is what the core keeps without it:
     · the knock             dailyStudio.backstage() in the console: guest list only, the password is the build
     · the pass              a number of its own for this browser
     · other ways in         #backstage in the address, and ↑ ↑ ↓ ↓ ← → ← → B A (a short note for anyone not on the list)
     · bksOn(piece)          is a piece of Backstage switched on (the master switch and each piece are in Settings ▸ Backstage)
     · the Settings section  a box that fills in when the room arrives
   ============================================================ */
const BKD = { tries: 0, k: 0, want: undefined }, BKS_ROOM_IDS = ['pass', 'engine', 'perf', 'storage', 'bus', 'terminal', 'labs', 'pages', 'made', 'agent', 'secrets'];
/** is this piece of Backstage on: you have the pass, the master switch is on, and so is its own */
const bksOn = k => !!CFG.backstage && (CFG.bks || {}).on !== false && (k == null || (CFG.bks || {})[k] !== false);
const bksLoad = () => room('backstage').catch(() => { });
/** this browser's pass: a number of its own, the day and the build it was issued on */
function bksPass() { if (!CFG.bksPass || !CFG.bksPass.n) { CFG.bksPass = { n: 1000 + Math.floor(Math.random() * 9000), at: Date.now(), build: BUILD }; saveCfg(); } return CFG.bksPass; }
/** the door. Guest list only: the password is this page's build. Called as dailyStudio.backstage() from the console */
function backstage(word) {
  if (CFG.backstage) { const p = bksPass(); bksLoad(); setTimeout(() => backstageOpen(), 30); return '🎭 Welcome back, pass #' + p.n + '. Backstage is open.'; }
  if (word == null || word === '') return '🎟 Backstage is guest list only. The password is the build you are running: it is in the bottom-right corner of the studio (and in dailyStudio.describe().build). Then:  dailyStudio.backstage(\'<build>\')';
  if (String(word).trim().toLowerCase() !== String(BUILD).toLowerCase()) { BKD.tries++; return '🚪 Not on the list. ' + (BKD.tries > 2 ? 'Psst: seven characters, after “build” in the bottom-right corner.' : 'Look again: the bottom-right corner.'); }
  CFG.backstage = true; const p = bksPass(); saveCfg(); secretFound('backstage', true); bksLoad(); setTimeout(() => backstageOpen(), 30);
  return '🎭 You are on the list. All-access pass #' + p.n + ' issued to this browser. Come on in. ' + secretCount() + '  Backstage now comes with you: studio.help() here in the console, Ctrl/⌘ K for the palette, Ctrl + ` for the terminal. Settings ▸ Backstage turns it on and off.';
}
/** the body of Settings ▸ Backstage: filled in when the room has arrived */
function bksSettingsBox() { const box = h('div', { class: 'bks-set' }, h('p', { class: 'small muted' }, 'Loading Backstage…')); Promise.resolve(bksSettings()).then(el => { if (el) box.replaceChildren(el); }, () => { }); return box; }

/* ---------- other ways in: the address (#backstage, #backstage/<room>) and ↑↑↓↓←→←→BA ---------- */
function bksFromHash() {
  const m = /^#backstage(?:\/([\w-]+))?$/.exec(location.hash || ''); if (!m) return false;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
  BKD.want = m[1] && BKS_ROOM_IDS.includes(m[1]) ? m[1] : null;
  const go = () => { const w = BKD.want; if (w === undefined) return; BKD.want = undefined; if (CFG.backstage) backstageOpen(w || undefined); else toast('🎟 Backstage is guest list only. The door is in the browser console.', ''); };
  if (document.getElementById('boot')) bus.on('booted', () => setTimeout(go, 400)); else setTimeout(go, 600);
  return true;
}
/** part 10 calls this at start-up: when you are on the list (or the performance overlay is on) the room loads now, so the console toolkit and the palette are ready */
function bksBoot() { if (CFG.backstage || (CFG.labs && CFG.labs.perf)) bksLoad().then(() => { if (CFG.labs && CFG.labs.perf) bksOverlay(); }); bksFromHash(); }
window.addEventListener('hashchange', () => { bksFromHash(); });
const BKS_KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
document.addEventListener('keydown', e => {
  const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) { BKD.k = 0; return; }
  const key = e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key, near = BKD.k >= 8;
  BKD.k = key === BKS_KONAMI[BKD.k] ? BKD.k + 1 : key === BKS_KONAMI[0] ? 1 : 0;
  if (near && (key === 'b' || key === 'a')) { e.preventDefault(); e.stopPropagation(); }      /* B and A finish the code here, not the bass and the rest */
  if (BKD.k === BKS_KONAMI.length) { BKD.k = 0; if (CFG.backstage) backstageOpen('terminal'); else toast('🎟 Nice moves. Backstage is guest list only, and the door is in the browser console.', ''); }
}, true);
