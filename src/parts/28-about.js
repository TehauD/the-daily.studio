/* ============================================================
   Part 28 · ABOUT & CREDITS — shown at the end of Help & shortcuts (not a main touch point)
   Who made it, where to find the source, what it builds on, and the licences that apply.
   Edit the copy here; the links come from BRAND in 01-core.js.
   ============================================================ */
function aboutBlock() {
  const link = (label, href, cls) => h('a', { class: 'btn sm ' + (cls || ''), href, target: '_blank', rel: 'noopener noreferrer' }, label + ' ↗');
  const li = (...kids) => h('li', {}, ...kids);
  const ext = (t, href) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, t);
  const mark = () => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 100 100'); s.setAttribute('width', 42); s.setAttribute('height', 42); s.setAttribute('aria-hidden', 'true'); s.innerHTML = '__MARK_INNER__'; return s; };
  return h('section', { class: 'ab', 'aria-label': 'About' },
    h('div', { class: 'ab-top' }, mark(), h('div', {}, h('b', { class: 'ab-name' }, h('span', {}, 'the-daily'), h('span', { class: 'tld' }, '.studio')), h('div', { class: 'tiny muted' }, 'MVP 1 · v' + VERSION + ' · MIT licence'))),
    h('div', { class: 'ab-me ab-story' },
      h('h4', {}, 'Built from a lifelong love of music.'),
      h('p', {}, 'My mom taught me to play guitar when I was five years old.'),
      h('p', {}, 'I grew up loving music, but we didn’t have the money for instruments or gear. You learned to work with what you had, make the most of it, and find your own way to make a sound.'),
      h('p', {}, 'That spirit stayed with me.'),
      h('p', {}, 'Today, I’m a software engineer, a musician, and someone who loves building things. the-daily.studio brings those worlds together: using technology to make the music tools I once would have loved to have access to myself.'),
      h('p', {}, 'I wanted a place where you could plug in a guitar, explore a sound, pull apart a song, chase a melody, or capture an idea without needing an expensive setup or a collection of specialized software.'),
      h('p', {}, 'Something practical. Something curious. Something that puts the joy of making music first.'),
      h('p', {}, 'So I built it.'),
      h('p', {}, 'the-daily.studio is free and open source, designed to run locally in your browser, with your work staying on your device.'),
      h('p', {}, 'Not everyone has access to a professional studio or the latest equipment. I know that feeling. If this gives someone a way to experiment, learn, create, or fall a little deeper in love with music, then it’s doing what I hoped it would do.'),
      h('p', {}, 'The best tool is the one that helps you make something you couldn’t make before.'),
      h('p', { class: 'ab-sig' }, '— Tehau DeBarthe'),
      h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, BRAND.support ? link('☕ ' + BRAND.supportLabel, BRAND.support, 'primary') : '', link('GitHub', BRAND.github), link('LinkedIn', BRAND.linkedin), link('The Daily', BRAND.journal), link('Source & issues', BRAND.repo))),
    h('details', { class: 'ab-cr' }, h('summary', {}, 'Credits & licences'),
      h('ul', {},
        li(h('b', {}, 'Code: '), 'MIT licence, © 2026 ' + BRAND.author + '. Free to use, copy, change and share; keep the licence notice.'),
        li(h('b', {}, 'Built with: '), 'the Web Audio API, AudioWorklet, Canvas, SVG and IndexedDB. No frameworks, no tracking, no analytics.'),
        li(h('b', {}, 'Hand tracking and person cut-out (optional): '), 'use ', ext('MediaPipe Tasks Vision', 'https://developers.google.com/mediapipe'), ' with its hand-landmarker and selfie-segmenter models by Google, Apache-2.0, fetched from jsDelivr and Google Storage only when you switch hand tracking on, or choose “Me in front” for the camera. Motion-only mode and the edges-in look stay offline.'),
        li(h('b', {}, 'Methods: '), 'YIN pitch estimation (de Cheveigné & Kawahara, 2002); harmonic / percussive separation by median filtering (Fitzgerald, 2010); Karplus–Strong string synthesis (1983). Re-implemented here from the published papers.'),
        li(h('b', {}, 'Type: '), 'Inter and Montserrat (SIL Open Font Licence 1.1) are built into the page; nothing is downloaded. Other typefaces in Appearance use fonts already on your device.'),
        li(h('b', {}, 'Names: '), 'Ultimate Guitar, Focusrite, Scarlett, MIDI, Google and other names are used only to describe compatibility. This project is independent and not affiliated with or endorsed by them.'),
        li(h('b', {}, 'Made with AI assistance: '), 'developed with Claude (Anthropic) under my direction. The design choices, the music and any mistakes are mine.')),
      h('p', { class: 'tiny muted' }, 'Full notices: THIRD_PARTY_NOTICES.md and PRIVACY.md in the repository.')),
    h('p', { class: 'tiny muted', style: { marginBottom: 0 } }, 'Your songs, recordings and settings stay in this browser. The only requests this page can make are the optional hand-tracking and cut-out files above.'));
}
