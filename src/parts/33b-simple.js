/* ============================================================
   Part 33b · SIMPLE MODE (2.33) — one switch for someone who has never seen a studio
   ✦ Simple (top right, and Settings ▸ Workflow) keeps what you need to make something and tucks the rest away:
     · kept      play, stop, ● record, loop, click, the tempo and the key; the song's name, Songs, New, undo; Perform and Voice;
                 the six workspaces and each one's tools; ● Capture; the tab and the words; the band on or off; the arrangement
     · tucked    return-to-start, the bar·beat counter, time signature, the master meter, the latency estimate, the workspace
                 button, artist, tuning, capo, scale and notes; the view switch; the Create → Perform → Share flow; the panel
                 strip's Tools level; each band part's own switch and the mix; tab techniques, fill styles, copy and paste;
                 the arrangement's zoom, swing, loop and lane tools; the status line
   Nothing is turned off or lost: it is only out of sight, and the same button brings it all back. The panel tabs keep the
   adaptive strip of part 33 (it still grows as you use the studio), without numbers. Phones already have their own simple layout, so this only changes larger screens.
   First visits start in Simple (unless "I know my way around"); anyone who has been here before keeps the full studio.
   ============================================================ */
/* what Simple keeps on the panel strip (and whatever is open, and the backing track once one is loaded), and the tones it offers */
const SIMPLE_TABS = ['tab', 'band', 'vis', 'exp'];
const SIMPLE_TONES = ['Crystal Clean', 'Busker Corner', 'Edge of Breakup', 'Classic Crunch', 'Singing Lead', 'Tight Metal Rhythm', 'Shimmer Cathedral', 'Direct (No FX)'];
if (CFG.simple == null) { CFG.simple = !store.get('started', false) && !store.get('song', null); saveCfg(); }
function simpleApply() {
  document.body.classList.toggle('simple', !!CFG.simple); document.body.classList.toggle('io-voice-on', !!CFG.ioVoice || !CFG.simple);
  const av = document.getElementById('ioAddVoice'); if (av) av.textContent = CFG.ioVoice ? '− No microphone for my voice' : '＋ Add a microphone for your voice';
  const b = document.getElementById('simpleBtn');
  if (b) { b.setAttribute('aria-pressed', String(!!CFG.simple)); b.title = CFG.simple ? 'Simple is on: just the essentials. Press to show every tool.' : 'Simple: show just the essentials (nothing is lost; press again for every tool)'; }
}
/** switch Simple on or off; `quiet` skips the toast (used when another choice implies it) */
function simpleSet(on, quiet) {
  CFG.simple = !!on; saveCfg(); simpleApply();
  try { rebuildTabs(); } catch (e) { } try { UI.tAll = false; renderTones(); } catch (e) { }
  if (!quiet) toast(on ? 'Simple: just the essentials. Everything else is one press away (✦ Simple, top right).' : 'Every tool is showing. ✦ Simple tidies up again.', 'ok');
  bus.emit('simple', !!on); setTimeout(() => { try { tlSize(); } catch (e) { } window.dispatchEvent(new Event('resize')); }, 60);
}
/** the switch, beside Appearance in the top right */
function simpleMount() {
  const R = document.getElementById('topR'); if (!R) return;
  if (!document.getElementById('simpleBtn')) {
    const b = h('button', { class: 'btn sm simple-btn', id: 'simpleBtn', type: 'button', 'aria-pressed': String(!!CFG.simple), onclick: () => simpleSet(!CFG.simple) }, h('span', { class: 'simple-ic', 'aria-hidden': 'true' }, '✦'), h('span', { class: 'simple-tx' }, 'Simple'));
    const th = [...R.children].find(x => /^Appearance/.test(x.title || '')); R.insertBefore(b, th || null);
  }
  simpleApply();
}
bus.on('booted', simpleMount);
