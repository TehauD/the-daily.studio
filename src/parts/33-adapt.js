/* ============================================================
   Part 33 · How much of the studio shows. Since 2.63 there is one switch for it: ✦ Simple (part 33b). Simple on: each workspace's
   few panels and tools, in plain words. Simple off: every panel the workspace has. (Until 2.62 a separate "Tools" level, Automatic /
   Essentials / More tools / Everything, filtered the panel strip again; inside a workspace it changed almost nothing, and with Simple
   on it was ignored, so it went.)
   Actions still add to a private score kept in this browser (CFG.xp): someone who knows their way around (that score, or "I know my
   way around" on the first visit) gets no coaching notes on the panels (part 60).
   ============================================================ */
var XP = { quiet: 0, last: null };
var XP_NAMES = { rig: 'Guitar sound', tab: 'Write', vis: 'Visuals', song: 'Song', band: 'Band', exp: 'Save & export', fret: 'Fretboard', stems: 'Backing track', learn: 'Learn' };
if (CFG.xp == null) { CFG.xp = (store.get('started', false) || store.get('song', null)) ? 40 : 0; saveCfg(); }   // people who already use the app know their way around
/** 'pro' once the person knows their way around (no coaching notes), else 'new' */
function xpLevel() { return CFG.xpMode === 'pro' || (CFG.xp || 0) >= 12 ? 'pro' : 'new'; }
function xpAllowed(id, ignoreSimple) { if (CFG.simple && !ignoreSimple) return simpleTabs().includes(id) || id === DOCK.cur || (id === 'stems' && typeof STM !== 'undefined' && !!STM.ch); return true; }
function xpTabText(id, name, i) { return CFG.simple ? (XP_NAMES[id] || name) : (i + 1) + ' · ' + name; }
function xpSignal(pts) { if (XP.quiet) return; CFG.xp = Math.min(40, (CFG.xp || 0) + pts); clearTimeout(XP.t); XP.t = setTimeout(saveCfg, 800); }
const xpEdit = () => { if (!XP.quiet) { xpSignal(.25); try { if (performance.now() - JN.inp < 3000) JN.edit = performance.now(); } catch (e) { } } };       // a change the person made (a key or a tap just before it, not the app loading a song) counts as activity in the journal
/** run a generator (like Hum to Song) without counting its changes as the person's own edits */
function xpQuiet(fn) { XP.quiet++; try { return fn(); } finally { XP.quiet--; } }
