/* ============================================================
   Part 73 · THE BUILD TAG, AND A HIDDEN LINE AT THE BOTTOM
   The version and build code sit in the very bottom-right corner (the app's status bar and Perform), so anyone can tell
   which build is running. Triple-click (or triple-tap) the tag and a small hidden line wakes up at the bottom of the page:
   a quote of the day from someone in history, to start a new idea. Triple-click again to put it back to sleep. Remembered here.
   A new quote comes at midnight (the device's own clock). Everyone gets the same one on the same day, and every quote comes
   round once, in a fixed shuffled order, before any comes round again, so two days in a row never share one.
   Every quote says who it is from. A saying that is only attributed (no known source) says "attributed to"; a paraphrase or a
   loose translation says "after"; and a line often credited to the wrong person carries the right name.
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
  ['Without music, life would be a mistake.', 'Friedrich Nietzsche'],
  ['Music is the universal language of mankind.', 'Henry Wadsworth Longfellow'],
  ['Music expresses that which cannot be said and on which it is impossible to be silent.', 'Victor Hugo'],
  ['After silence, that which comes nearest to expressing the inexpressible is music.', 'Aldous Huxley'],
  ['Music is a hidden arithmetic exercise of the soul, which does not know that it is counting.', 'Gottfried Wilhelm Leibniz'],
  ['I have no special talent. I am only passionately curious.', 'Albert Einstein'],
  ['Imagination is more important than knowledge.', 'Albert Einstein'],
  ['Genius is one per cent inspiration and ninety-nine per cent perspiration.', 'Thomas Edison'],
  ['Learning is not attained by chance; it must be sought for with ardour and attended to with diligence.', 'Abigail Adams'],
  ['The mind is not a vessel to be filled, but a fire to be kindled.', 'after Plutarch'],
  /* making things */
  ['Inspiration is a guest that does not willingly visit the lazy.', 'Pyotr Ilyich Tchaikovsky'],
  ['Don’t loaf and invite inspiration; light out after it with a club.', 'Jack London'],
  ['Ideas won’t keep. Something must be done about them.', 'Alfred North Whitehead'],
  ['Great things are not done by impulse, but by a series of small things brought together.', 'Vincent van Gogh'],
  ['If you hear a voice within you say ‘you cannot paint,’ then by all means paint, and that voice will be silenced.', 'Vincent van Gogh'],
  ['Every artist was first an amateur.', 'Ralph Waldo Emerson'],
  ['Nothing great was ever achieved without enthusiasm.', 'Ralph Waldo Emerson'],
  ['You can’t use up creativity. The more you use, the more you have.', 'Maya Angelou'],
  ['Practicing an art, no matter how well or badly, is a way to make your soul grow.', 'Kurt Vonnegut'],
  ['If there’s a book that you want to read, but it hasn’t been written yet, then you must write it.', 'Toni Morrison'],
  ['The creation of something new is not accomplished by the intellect but by the play instinct.', 'Carl Jung'],
  ['One must still have chaos in oneself to be able to give birth to a dancing star.', 'Friedrich Nietzsche'],
  ['Perfection is attained not when there is nothing more to add, but when there is nothing more to take away.', 'Antoine de Saint-Exupéry'],
  ['The more constraints one imposes, the more one frees one’s self of the chains that shackle the spirit.', 'Igor Stravinsky'],
  ['Have no fear of perfection — you’ll never reach it.', 'Salvador Dalí'],
  ['Creativity takes courage.', 'attributed to Henri Matisse'],
  ['Art enables us to find ourselves and lose ourselves at the same time.', 'Thomas Merton'],
  ['Work is love made visible.', 'Kahlil Gibran'],
  ['Let the beauty we love be what we do.', 'Rumi, translated by Coleman Barks'],
  ['What I cannot create, I do not understand.', 'Richard Feynman'],
  ['The best way to have a good idea is to have lots of ideas.', 'attributed to Linus Pauling'],
  ['Ideas are like rabbits. You get a couple and learn how to handle them, and pretty soon you have a dozen.', 'attributed to John Steinbeck'],
  ['Discovery consists of seeing what everybody has seen and thinking what nobody has thought.', 'Albert Szent-Györgyi'],
  ['I can’t understand why people are frightened of new ideas. I’m frightened of the old ones.', 'John Cage'],
  ['If something is boring after two minutes, try it for four. If still boring, then eight. Then sixteen. Then thirty-two. Eventually one discovers that it is not boring at all.', 'John Cage'],
  ['The most dangerous phrase in the language is ‘we’ve always done it this way.’', 'Grace Hopper'],
  ['The only way to do great work is to love what you do.', 'Steve Jobs'],
  ['Stay hungry. Stay foolish.', 'the Whole Earth Catalog’s farewell, quoted by Steve Jobs'],
  ['To achieve great things, two things are needed: a plan, and not quite enough time.', 'attributed to Leonard Bernstein'],
  /* learning, practice and mistakes */
  ['For the things we have to learn before we can do them, we learn by doing them.', 'Aristotle'],
  ['We are what we repeatedly do. Excellence, then, is not an act, but a habit.', 'Will Durant, after Aristotle'],
  ['I was obliged to be industrious. Whoever is equally industrious will succeed equally well.', 'Johann Sebastian Bach'],
  ['All one has to do is hit the right keys at the right time, and the instrument plays itself.', 'attributed to Johann Sebastian Bach'],
  ['Don’t only practice your art, but force your way into its secrets.', 'Ludwig van Beethoven'],
  ['Without craftsmanship, inspiration is a mere reed shaken in the wind.', 'attributed to Johannes Brahms'],
  ['I am still learning.', 'attributed to Michelangelo, at eighty-seven'],
  ['I think I’m making progress.', 'attributed to Pablo Casals, asked in his nineties why he still practiced'],
  ['If a thing is worth doing, it is worth doing badly.', 'G.K. Chesterton'],
  ['Ever tried. Ever failed. No matter. Try again. Fail again. Fail better.', 'Samuel Beckett'],
  ['A man of genius makes no mistakes. His errors are volitional and are the portals of discovery.', 'James Joyce'],
  ['An expert is a person who has made all the mistakes that can be made in a very narrow field.', 'attributed to Niels Bohr'],
  ['Do not fear mistakes. There are none.', 'attributed to Miles Davis'],
  ['Fall seven times, stand up eight.', 'Japanese proverb'],
  ['If I have seen further it is by standing on the shoulders of giants.', 'Isaac Newton'],
  ['Knowing is not enough; we must apply. Willing is not enough; we must do.', 'Johann Wolfgang von Goethe'],
  ['Whatever you can do, or dream you can, begin it. Boldness has genius, power and magic in it.', 'John Anster, after Goethe'],
  ['Well done is better than well said.', 'Benjamin Franklin'],
  ['Do what you can, with what you have, where you are.', 'Bill Widener, quoted by Theodore Roosevelt'],
  ['A journey of a thousand miles begins with a single step.', 'after Lao Tzu'],
  ['While we are postponing, life speeds by.', 'Seneca'],
  ['Talent hits a target no one else can hit; genius hits a target no one else can see.', 'Arthur Schopenhauer'],
  /* music */
  ['Rhythm and harmony find their way into the inward places of the soul.', 'Plato'],
  ['If music be the food of love, play on.', 'William Shakespeare'],
  ['Music has charms to soothe a savage breast.', 'William Congreve'],
  ['We are the music makers, and we are the dreamers of dreams.', 'Arthur O’Shaughnessy'],
  ['Music washes away from the soul the dust of everyday life.', 'Berthold Auerbach'],
  ['Music is the art of thinking with sounds.', 'Jules Combarieu'],
  ['I often think in music. I live my daydreams in music.', 'Albert Einstein'],
  ['The engine might compose elaborate and scientific pieces of music of any degree of complexity or extent.', 'Ada Lovelace, 1843'],
  ['If a man does not keep pace with his companions, perhaps it is because he hears a different drummer. Let him step to the music which he hears, however measured or far away.', 'Henry David Thoreau'],
  ['Give me a laundry list and I will set it to music.', 'attributed to Gioachino Rossini'],
  ['I pay no attention whatever to anybody’s praise or blame. I simply follow my own feelings.', 'attributed to Wolfgang Amadeus Mozart'],
  ['Music is enough for a lifetime, but a lifetime is not enough for music.', 'attributed to Sergei Rachmaninoff'],
  ['A painter paints pictures on canvas. But musicians paint their pictures on silence.', 'attributed to Leopold Stokowski'],
  ['This will be our reply to violence: to make music more intensely, more beautifully, more devotedly than ever before.', 'Leonard Bernstein'],
  ['Music is your own experience, your thoughts, your wisdom. If you don’t live it, it won’t come out of your horn.', 'Charlie Parker'],
  ['Life is a lot like jazz — it’s best when you improvise.', 'attributed to George Gershwin'],
  ['Musicians don’t retire; they stop when there’s no more music in them.', 'attributed to Louis Armstrong'],
  ['Just don’t give up trying to do what you really want to do. Where there is love and inspiration, I don’t think you can go wrong.', 'attributed to Ella Fitzgerald'],
  ['A problem is a chance for you to do your best.', 'attributed to Duke Ellington'],
  ['If I’m going to sing like someone else, then I don’t need to sing at all.', 'attributed to Billie Holiday'],
  ['I was born with music inside me. Music was one of my parts. Like my ribs, my kidneys, my liver, my heart.', 'Ray Charles'],
  ['One good thing about music, when it hits you, you feel no pain.', 'Bob Marley'],
  ['Music was my refuge. I could crawl into the space between the notes and curl my back to loneliness.', 'Maya Angelou'],
  ['Faith is the bird that feels the light and sings when the dawn is still dark.', 'Rabindranath Tagore'],
  /* courage and wonder */
  ['You must do the thing you think you cannot do.', 'Eleanor Roosevelt'],
  ['Life is either a daring adventure or nothing.', 'Helen Keller'],
  ['The best and most beautiful things in the world cannot be seen or even touched — they must be felt with the heart.', 'Helen Keller'],
  ['Life shrinks or expands in proportion to one’s courage.', 'Anaïs Nin'],
  ['Courage is resistance to fear, mastery of fear — not absence of fear.', 'Mark Twain'],
  ['The most difficult thing is the decision to act; the rest is merely tenacity.', 'attributed to Amelia Earhart'],
  ['I’m not afraid of storms, for I’m learning how to sail my ship.', 'Louisa May Alcott'],
  ['If there is no struggle, there is no progress.', 'Frederick Douglass'],
  ['If you can’t fly, then run. If you can’t run, then walk. If you can’t walk, then crawl. But whatever you do, you have to keep moving forward.', 'Martin Luther King Jr.'],
  ['Nothing in life is to be feared, it is only to be understood.', 'attributed to Marie Curie'],
  ['We suffer more often in imagination than in reality.', 'Seneca'],
  ['In the depth of winter, I finally learned that within me there lay an invincible summer.', 'Albert Camus'],
  ['Hope is the thing with feathers that perches in the soul.', 'Emily Dickinson'],
  ['Forever is composed of nows.', 'Emily Dickinson'],
  ['Hold fast to dreams, for if dreams die, life is a broken-winged bird that cannot fly.', 'Langston Hughes'],
  ['Tell me, what is it you plan to do with your one wild and precious life?', 'Mary Oliver'],
  ['Be patient toward all that is unsolved in your heart and try to love the questions themselves.', 'Rainer Maria Rilke'],
  ['We know what we are, but know not what we may be.', 'William Shakespeare'],
  ['I am large, I contain multitudes.', 'Walt Whitman'],
  ['Why, sometimes I’ve believed as many as six impossible things before breakfast.', 'Lewis Carroll'],
  ['We are all in the gutter, but some of us are looking at the stars.', 'Oscar Wilde'],
  ['Dwell on the beauty of life. Watch the stars, and see yourself running with them.', 'Marcus Aurelius'],
  ['We are a way for the cosmos to know itself.', 'Carl Sagan'],
  ['Not all those who wander are lost.', 'J.R.R. Tolkien'],
  ['Empty your mind. Be formless, shapeless, like water.', 'Bruce Lee'],
  ['You have brains in your head. You have feet in your shoes. You can steer yourself any direction you choose.', 'Dr. Seuss'],
  ['Fortune favors the brave.', 'Terence']
];
/** the order the quotes come in, one a day: a fixed shuffle (the same everywhere), so every quote comes round once before any comes again */
const EGG_ORDER = (() => { const o = EGG_LINES.map((x, i) => i); let s = 20261101; const r = () => (s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff) / 0x80000000; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; })();
/** today, as a count of days, by the device's own calendar (so the quote changes at its midnight, summer time or not) */
const eggDay = (d = new Date()) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
/** the quote for a day: its place in the shuffled order */
const eggFor = day => EGG_ORDER[((day % EGG_ORDER.length) + EGG_ORDER.length) % EGG_ORDER.length];
const EGG = { day: null, i: 0, shown: '' };
const eggOn = () => !!CFG.egg;
const eggText = i => { const [q, who] = EGG_LINES[i % EGG_LINES.length]; return '“' + q + '” — ' + who; };
/** today's quote, as it is shown: “…” — who */
const eggNow = () => { const d = eggDay(); if (d !== EGG.day) { EGG.day = d; EGG.i = eggFor(d); } return eggText(EGG.i); };
/** a build tag that wakes the hidden line on a triple click or tap */
function buildTag(cls) {
  let n = 0, t = 0;
  return h('span', { class: 'build-tag ' + (cls || ''), title: 'the-daily.studio ' + BUILD_TAG, onclick: () => {
    const now = performance.now(); n = now - t < 550 ? n + 1 : 1; t = now; if (n < 3) return; n = 0;
    CFG.egg = !eggOn(); saveCfg(); eggTick(true); const first = eggOn() && typeof secretFound === 'function' && secretFound('line', true); toast(eggOn() ? '🥚 You found the hidden line.' + (first ? ' ' + secretCount() : '') + ' Triple-click the version to hide it again.' : 'The hidden line is asleep again.', 'ok');
  } }, BUILD_TAG);
}
/** keep every .egg-line on the page showing today's quote (or nothing while asleep) */
function eggTick(force) {
  const txt = eggOn() ? eggNow() : ''; if (txt === EGG.shown && !force) return; EGG.shown = txt;
  document.querySelectorAll('.egg-line').forEach(el => {
    if (el._eggA) { el._eggA.cancel(); el._eggA = null; } el._eggOver = 0;
    el.textContent = ''; el.title = txt; el.classList.remove('egg-in', 'egg-long'); if (!txt) return;
    el.append(h('span', { class: 'egg-t' }, txt)); void el.offsetWidth; el.classList.add('egg-in');
    if (EGG.ro) EGG.ro.observe(el); requestAnimationFrame(() => eggFit(el));
  });
}
setInterval(() => { if (eggOn() || EGG.shown) eggTick(); }, 1000);
/* the line's space changes with the window and the bar around it, so a quote that now fits (or no longer does) is fitted again */
try { EGG.ro = new ResizeObserver(es => es.forEach(e => { if (e.target.isConnected && e.target.firstElementChild) eggFit(e.target); })); } catch (e) { }
/** a quote longer than its space glides to its end every so often, so its end and who said it are read, then back to its start;
    with reduced motion it stays still, with the whole quote on hover */
function eggFit(el) {
  /* the quote's own width against the room it has: the box's width can understate an italic line that is cut short */
  const t = el.firstElementChild; if (!t) return; const cs = getComputedStyle(el), room = el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  const over = Math.ceil(t.getBoundingClientRect().width - room) + 6; let still = false;
  try { still = !!CFG.reduce || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { }
  const long = over > 10 && room >= 120 && !still;      /* in a sliver of space (or none) it is cut short instead: too little shows to read a glide */ if (long === !!el._eggA && (!long || Math.abs(over - el._eggOver) < 12)) return;      /* nothing a reader would notice has changed */
  if (el._eggA) { el._eggA.cancel(); el._eggA = null; } el._eggOver = over; el.classList.toggle('egg-long', long); if (!long || !t.animate) return;
  /* a pause to start reading, the glide at about 45 px a second (reading pace), a hold on its end, a quicker way back, and a long rest before the next time */
  const g = Math.min(16, Math.max(3, over / 45)) * 1000, back = Math.max(1500, g / 3), wait = 2500, hold = 3500, rest = 20000, tot = wait + g + hold + back + rest, a = 'translateX(0px)', b = 'translateX(' + -over + 'px)', e = 'ease-in-out';
  el._eggA = t.animate([{ transform: a, offset: 0 }, { transform: a, offset: wait / tot, easing: e }, { transform: b, offset: (wait + g) / tot }, { transform: b, offset: (wait + g + hold) / tot, easing: e }, { transform: a, offset: (wait + g + hold + back) / tot }, { transform: a, offset: 1 }], { duration: tot, iterations: Infinity });
}
