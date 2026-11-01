/* ============================================================
   Part 73 · THE BUILD TAG, AND A HIDDEN LINE AT THE BOTTOM
   The version and build code sit in the very bottom-right corner (the app's status bar and Perform), so anyone can tell
   which build is running. Triple-click (or triple-tap) the tag and a small hidden line wakes up at the bottom of the page:
   a rotating bit of song inspiration or musician humour. Triple-click again to put it back to sleep. Remembered here.
   All lines are written for this app; none are quotes.
   ============================================================ */
const BUILD_TAG = 'v' + VERSION + ' · build ' + BUILD;
const EGG_LINES = [
  'Every song you love started as a rough first draft.',
  'Play it slowly until it is easy. Then play it slowly a little longer.',
  'The riff you hummed in the shower counts. Write it down.',
  'A wrong note played twice on purpose is a choice.',
  'Your voice does not need to sound like anyone else’s. That is the point.',
  'Ten minutes today beats two hours someday.',
  'Finish the song. You can fix it in the next one.',
  'The space between the notes is part of the music too.',
  'Borrow a chord progression; keep your own story.',
  'Calluses are just practice you can feel.',
  'If it makes you smile, it is working.',
  'Write the line you would be nervous to sing. Then sing it.',
  'Hum it, record it, forget it, find it again. That is a workflow.',
  'Somewhere, someone will hear your song for the first time. Make it count.',
  'Somebody, somewhere, is also stuck on the bridge.',
  'Wrote a verse? Great. Wrote two? Now it is a song.',
  'Loop the hard bar. Then loop it again. The bar always gives up first.',
  'The metronome is not judging you. Mostly.',
  'You do not need another pedal. You want another pedal. Both are valid.',
  'That F chord is building character. Yours, mostly.',
  'Practice amp on 3, dreams on 11.',
  'Tuning takes thirty seconds. Talking about tuning takes thirty minutes.',
  'Behind every great song is a phone full of “New Recording 47”.',
  'If the cat leaves the room, it might be the solo.',
  'Sore fingertips are the guitar’s way of saying hello.',
  'Your neighbours know this song better than you think. Bring it home.',
  'The B string is never quite in tune. It is a lifestyle.',
  'Counting to four is harder than it looks. Ask any band. Lovingly.',
  'Breathe on the rest, sing on the downbeat, look calm throughout.',
  'This app has no opinion about your strumming. The drummer might.',
  'Capo on two: new key, zero theory, full confidence.',
  'Done is a sound. So is “one more take”.'
];
const EGG = { start: Math.floor(Math.random() * EGG_LINES.length), shown: '' };
const eggOn = () => !!CFG.egg;
/** the line for now: a new one every nine seconds */
const eggNow = () => EGG_LINES[(EGG.start + Math.floor(Date.now() / 9000)) % EGG_LINES.length];
/** a build tag that wakes the hidden line on a triple click or tap */
function buildTag(cls) {
  let n = 0, t = 0;
  return h('span', { class: 'build-tag ' + (cls || ''), title: 'the-daily.studio ' + BUILD_TAG, onclick: () => {
    const now = performance.now(); n = now - t < 550 ? n + 1 : 1; t = now; if (n < 3) return; n = 0;
    CFG.egg = !eggOn(); saveCfg(); eggTick(true); const first = eggOn() && typeof secretFound === 'function' && secretFound('line', true); toast(eggOn() ? '🥚 You found the hidden line.' + (first ? ' ' + secretCount() : '') + ' Triple-click the version to hide it again.' : 'The hidden line is asleep again.', 'ok');
  } }, BUILD_TAG);
}
/** keep every .egg-line on the page showing the current line (or nothing while asleep) */
function eggTick(force) {
  const txt = eggOn() ? eggNow() : ''; if (txt === EGG.shown && !force) return; EGG.shown = txt;
  document.querySelectorAll('.egg-line').forEach(el => { el.textContent = txt; el.classList.remove('egg-in'); void el.offsetWidth; if (txt) el.classList.add('egg-in'); });
}
setInterval(() => { if (eggOn() || EGG.shown) eggTick(); }, 1000);
