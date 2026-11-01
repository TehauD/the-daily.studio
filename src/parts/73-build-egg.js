/* ============================================================
   Part 73 · THE BUILD TAG, AND A HIDDEN LINE AT THE BOTTOM
   The version and build code sit in the very bottom-right corner (the app's status bar and Perform), so anyone can tell
   which build is running. Triple-click (or triple-tap) the tag and a small hidden line wakes up at the bottom of the page:
   a rotating quote to start a new idea, from people in history or from Tehau, who made the studio. Triple-click again to put
   it back to sleep. Remembered here.
   Every quote says who it is from. A saying that is only attributed (no known source) says "attributed to"; a paraphrase says
   "after"; and a line often credited to the wrong person carries the right name.
   ============================================================ */
const BUILD_TAG = 'v' + VERSION + ' · build ' + BUILD;
/* [the quote, who it is from] */
const EGG_LINES = [
  ['The noblest pleasure is the joy of understanding.', 'Leonardo da Vinci'],
  ['Wonder is the beginning of philosophy.', 'Plato'],
  ['All we have to decide is what to do with the time that is given us.', 'J.R.R. Tolkien'],
  ['Learning never exhausts the mind.', 'Leonardo da Vinci'],
  ['Somewhere, something incredible is waiting to be known.', 'Sharon Begley, writing about Carl Sagan'],
  ['If you want to find the secrets of the universe, think in terms of energy, frequency and vibration.', 'attributed to Nikola Tesla'],
  ['The best sound is the one you haven’t discovered yet.', 'Tehau'],
  ['A melody can say what words cannot.', 'Tehau'],
  ['Create first. Understand it later.', 'Tehau'],
  ['Make mistakes. Just remember where you made them.', 'Tehau'],
  ['Without music, life would be a mistake.', 'Friedrich Nietzsche'],
  ['Music is the universal language of mankind.', 'Henry Wadsworth Longfellow'],
  ['Music expresses that which cannot be said and on which it is impossible to be silent.', 'Victor Hugo'],
  ['After silence, that which comes nearest to expressing the inexpressible is music.', 'Aldous Huxley'],
  ['Music is a hidden arithmetic exercise of the soul, which does not know that it is counting.', 'Gottfried Wilhelm Leibniz'],
  ['I have no special talent. I am only passionately curious.', 'Albert Einstein'],
  ['Imagination is more important than knowledge.', 'Albert Einstein'],
  ['Genius is one per cent inspiration and ninety-nine per cent perspiration.', 'Thomas Edison'],
  ['Learning is not attained by chance; it must be sought for with ardour and attended to with diligence.', 'Abigail Adams'],
  ['The mind is not a vessel to be filled, but a fire to be kindled.', 'after Plutarch']
];
const EGG = { i: Math.floor(Math.random() * EGG_LINES.length), until: 0, shown: '' };
const eggOn = () => !!CFG.egg;
const eggText = i => { const [q, who] = EGG_LINES[i % EGG_LINES.length]; return '“' + q + '” — ' + who; };
/** how long a quote stays: nine seconds and a little more for each letter, so a long one has time to be read (and to glide, if it must) */
const eggMs = t => 9000 + 60 * t.length;
/** the quote for now, as it is shown: “…” — who; the next one comes when this one's time is up */
const eggNow = () => { const now = Date.now(); if (now >= EGG.until) { EGG.i = (EGG.i + 1) % EGG_LINES.length; EGG.until = now + eggMs(eggText(EGG.i)); } return eggText(EGG.i); };
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
  document.querySelectorAll('.egg-line').forEach(el => {
    el.textContent = ''; el.title = txt; el.classList.remove('egg-in', 'egg-long'); if (!txt) return;
    el.append(h('span', { class: 'egg-t' }, txt)); void el.offsetWidth; el.classList.add('egg-in');
    requestAnimationFrame(() => eggFit(el));
  });
}
setInterval(() => { if (eggOn() || EGG.shown) eggTick(); }, 1000);
/** a quote longer than its space glides once to its end, so the end and who said it are read; with reduced motion it stays, with the whole quote on hover */
function eggFit(el) {
  /* the quote's own width against the room it has: the box's width can understate an italic line that is cut short */
  const t = el.firstElementChild; if (!t) return; const cs = getComputedStyle(el), room = el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0), over = Math.ceil(t.getBoundingClientRect().width - room) + 6; if (over <= 10) return;
  try { if (CFG.reduce || matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) { }
  el.style.setProperty('--egg-shift', -over + 'px'); el.style.setProperty('--egg-dur', Math.min(10, Math.max(3, over / 45)).toFixed(1) + 's');      /* about 45 px a second, done well before the quote's time is up */ el.classList.add('egg-long');
}
