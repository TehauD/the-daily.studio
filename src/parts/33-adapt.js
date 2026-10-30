/* ============================================================
   Part 33 · Adaptive studio: the studio shows what you have shown you need.
   Nobody is asked their level. Actions add to a private score kept in this browser (CFG.xp);
   the score picks Simple, More tools or Everything. "Tools" in the tab strip overrides it.
   ============================================================ */
var XP = { quiet: 0, last: null };
var XP_TABS = { new: ['vis', 'tab', 'band', 'exp'], some: ['vis', 'tab', 'band', 'rig', 'stems', 'exp'], pro: null };
var XP_NAMES = { rig: 'Guitar sound', tab: 'Write', vis: 'Stage', song: 'Song', band: 'Band', exp: 'Save & export', fret: 'Fretboard', stems: 'Backing track' };
var XP_LABEL = { new: 'Simple', some: 'More tools', pro: 'Everything' };
if (CFG.xp == null) { CFG.xp = (store.get('started', false) || store.get('song', null)) ? 40 : 0; saveCfg(); }   // people who already use the app keep the full studio
function xpLevel() { const m = CFG.xpMode || 'auto'; if (XP_TABS[m] !== undefined) return m; const s = CFG.xp || 0; return s >= 12 ? 'pro' : s >= 4 ? 'some' : 'new'; }
function xpAllowed(id) { const l = XP_TABS[xpLevel()]; return !l || l.includes(id) || id === DOCK.cur || (typeof goalShows === 'function' && goalShows(id)); }
function xpTabText(id, name, i) { return xpLevel() === 'pro' ? (i + 1) + ' · ' + name : (XP_NAMES[id] || name); }
function xpSignal(pts) {
  if (XP.quiet || (CFG.xpMode && CFG.xpMode !== 'auto')) return; const before = xpLevel(); CFG.xp = Math.min(40, (CFG.xp || 0) + pts); clearTimeout(XP.t); XP.t = setTimeout(saveCfg, 800);
  const now = xpLevel(); if (now !== before) { try { rebuildTabs(); } catch (e) { } toast(now === 'some' ? 'More tools are now on the tab strip. Find the rest under “Tools”.' : 'Everything is unlocked. Welcome to the full studio.', 'ok'); }
}
const xpEdit = () => { if (!XP.quiet) { xpSignal(.25); try { if (performance.now() - JN.inp < 3000) JN.edit = performance.now(); } catch (e) { } } };       // a change the person made (a key or a tap just before it, not the app loading a song) counts as activity in the journal
/** run a generator (like Hum to Song) without counting its changes as the person's own edits */
function xpQuiet(fn) { XP.quiet++; try { return fn(); } finally { XP.quiet--; } }
function xpSetMode(k) { CFG.xpMode = k; saveCfg(); if (k === 'pro' && LAY.hidden.length) { LAY.hidden = []; saveLay(); } rebuildTabs(); if (k !== 'auto') toast((XP_LABEL[k]) + ' tools', ''); }
function xpToolsButton() {
  const l = xpLevel(), b = h('button', { class: 'btn sm xp-tools', id: 'xpTools', title: 'Choose how much of the studio to show', 'aria-haspopup': 'dialog', onclick: () => {
    const m = CFG.xpMode || 'auto', opt = (k, t, d) => h('button', { class: 'btn sm xp-opt' + (m === k ? ' on' : ''), 'aria-pressed': String(m === k), onclick: () => { CFG.xpMode = k; saveCfg(); closePop(); if (k === 'pro' && LAY.hidden.length) { LAY.hidden = []; saveLay(); }   /* “Everything” brings back any tab a layout had left off the strip */
      rebuildTabs(); if (k !== 'auto') toast((XP_LABEL[k]) + ' tools', ''); } }, h('b', {}, t), h('span', { class: 'muted' }, d));
    popover(b, h('div', { class: 'xp-pop' }, h('h5', {}, 'How much of the studio?'), opt('auto', 'Automatic', 'Starts simple and adds tools as you use them'), opt('new', 'Simple', 'Hum, Song, Band, Stage, Save'), opt('some', 'More tools', 'Adds guitar sound, tab, fretboard, backing track'), opt('pro', 'Everything', 'All tabs, technical labels, numbered shortcuts'), h('label', { class: 'xp-sep tiny', style: { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px', cursor: 'pointer' } }, h('input', { type: 'checkbox', id: 'xpSep', checked: !!CFG.sepTabs, onchange: e => { CFG.sepTabs = e.target.checked; saveCfg(); rebuildTabs(); toast(CFG.sepTabs ? 'Song and Fretboard are separate tabs again' : 'Song and Fretboard live inside Write', ''); } }), h('span', {}, 'Show Song and Fretboard as separate tabs'))), { style: { width: '320px', maxWidth: '92vw' } });
  } }, l === 'pro' ? 'Tools' : '＋ More tools'); return b;
}
