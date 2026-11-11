/* ============================================================
   Part 92 · Soundprint's doors (2.61). The Soundprint itself (part 93) is a room, loaded the first time it is used; prtOpen, prtLook
   and prtSongMake here are the core's stand-ins for it (part 00).
     · Visuals ▸ Soundprint: a look like the others. The open song's print, made once and kept with the song, moving with the
       playhead. Its row in the Visuals bar (beside the Look button, 2.65) picks its world, listens again when the song has changed, and opens the full Soundprint.
     · the-daily.studio/#soundprint opens Soundprint; a soundprint link (#p=…) opens that print.
   ============================================================ */
VMODES.splice(2, 0, ['sprint', 'Soundprint']);
const PRT_LOOK_WORLDS = [['print', '◎ Print'], ['flow', '〰 Flow'], ['terrain', '⛰ Terrain'], ['bloom', '✿ Bloom'], ['harmono', '∞ Harmonograph']];
/** the world the Soundprint look draws: one of the five, whatever is in the settings */
const prtLookWorld = () => PRT_LOOK_WORLDS.some(x => x[0] === CFG.prtWorld) ? CFG.prtWorld : 'print';
const prtRoomReady = () => !ROOM.files || !ROOM.files.print || !!ROOM.done.print;
let prtRoomAsk = false;
/** the Visuals draw this for the Soundprint look (part 13 hands it over) */
function prtVisDraw(g, W, H) {
  if (prtRoomReady()) return prtLook(g, W, H);
  if (!prtRoomAsk) { prtRoomAsk = true; room('print').then(() => prtBarSync()).catch(() => { prtRoomAsk = false; }); }
  g.fillStyle = '#05060b'; g.fillRect(0, 0, W, H);
}
/** its row in the Visuals bar while Soundprint is the look */
function prtBar() {
  const box = h('div', { class: 'prt-bar', id: 'prtBar', style: { display: VZ.mode === 'sprint' ? '' : 'none' } });
  box.append(h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Soundprint world' }, PRT_LOOK_WORLDS.map(([k, n]) => h('button', { type: 'button', 'data-pw': k, role: 'radio', class: prtLookWorld() === k ? 'on' : '', 'aria-checked': prtLookWorld() === k ? 'true' : 'false', onclick: () => { CFG.prtWorld = k; saveCfg(); prtBarSync(); } }, n))),
    h('button', { class: 'btn sm', id: 'prtAgain', type: 'button', title: 'Make the song’s print again from how it sounds now (playback stops while it listens)', onclick: () => { if (T.playing) stopPlay(true); prtSongMake(); } }, '⟳ Listen again'),
    h('span', { class: 'tiny muted', id: 'prtBarSay' }),
    h('button', { class: 'btn sm', id: 'prtMore', type: 'button', title: 'Its reading and ambient piece; save the artwork, the piece or a video; share it as a link; or make a print of any other sound', onclick: async () => { await room('print'); const sp = prtSongPrint(); prtOpen(sp ? { print: sp.P } : {}); } }, '◎ Save, share, or any sound…'));
  return box;
}
function prtBarSync() {
  const box = document.getElementById('prtBar'); if (!box) return; box.style.display = VZ.mode === 'sprint' ? '' : 'none';
  box.querySelectorAll('[data-pw]').forEach(b => { const on = b.dataset.pw === prtLookWorld(); b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
  const say = document.getElementById('prtBarSay'); if (!say) return;
  if (!prtRoomReady()) { say.textContent = ''; return; }
  const sp = prtSongPrint(); say.textContent = PRV.busy ? 'Listening to the song…' : sp && !sp.fresh ? 'The song has changed since its print was made.' : sp ? prtGenome(sp.P).why.split('. ')[0] + '.' : '';
}
setInterval(() => { if (VZ.mode === 'sprint' && prtRoomReady()) prtBarSync(); }, 1500);

/* ---------- addresses ---------- */
function prtFromHash() {
  if (/^#soundprint$/i.test(location.hash || '')) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { } Promise.resolve(prtOpen()).catch(() => { }); return true; }
  const m = /^#p=(1[zr][A-Za-z0-9_-]+)$/.exec(location.hash || ''); if (!m) return false;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
  Promise.resolve(prtOpen({ link: m[1] })).catch(e => toast('That soundprint could not be opened: ' + (e.message || e) + '.', 'warn')); return true;
}
setTimeout(prtFromHash, 450);
window.addEventListener('hashchange', () => { prtFromHash(); });
