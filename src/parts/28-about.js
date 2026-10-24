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
    h('p', {}, 'A songwriter’s workspace that lives in your browser. Catch a lyric, find the chords, record guitar and vocals together, split a favourite track into stems and keep every song on your own device. No account, nothing uploaded, no tracking.'),
    h('div', { class: 'ab-me' },
      h('div', { class: 'lk-sec', style: { margin: 0 } }, 'ABOUT ME'),
      h('h4', {}, 'I’m Tehau — I play guitar, build things and write down what I learn.'),
      h('p', {}, 'This began as a guitar lab for my own practice and grew into a place to turn a hum into a finished song. It sits beside ', ext('The Daily', BRAND.journal), ', the journal I use to capture what I learn while building. Both are free and open source, and both keep your data on your device. I’d be delighted if this helps inspire new music and personal discovery.'),
      h('div', { class: 'row', style: { gap: '6px' } }, link('GitHub', BRAND.github), link('LinkedIn', BRAND.linkedin), link('The Daily', BRAND.journal), link('Source & issues', BRAND.repo))),
    h('details', { class: 'ab-cr' }, h('summary', {}, 'Credits & licences'),
      h('ul', {},
        li(h('b', {}, 'Code: '), 'MIT licence, © 2026 ' + BRAND.author + '. Free to use, copy, change and share; keep the licence notice.'),
        li(h('b', {}, 'Built with: '), 'the Web Audio API, AudioWorklet, Canvas, SVG and IndexedDB. No frameworks, no tracking, no analytics.'),
        li(h('b', {}, 'Hand tracking and person cut-out (optional): '), 'use ', ext('MediaPipe Tasks Vision', 'https://developers.google.com/mediapipe'), ' with its hand-landmarker and selfie-segmenter models by Google, Apache-2.0, fetched from jsDelivr and Google Storage only when you switch hand tracking on, or choose “Me in front” for the camera. Motion-only mode and the edges-in look stay offline.'),
        li(h('b', {}, 'Methods: '), 'YIN pitch estimation (de Cheveigné & Kawahara, 2002); harmonic / percussive separation by median filtering (Fitzgerald, 2010); Karplus–Strong string synthesis (1983). Re-implemented here from the published papers.'),
        li(h('b', {}, 'Sample track: '), '“Good Morning” © ' + BRAND.author + ', included so you can try the app. It is not covered by the MIT licence; see samples/LICENSE.md.'),
        li(h('b', {}, 'Type: '), 'Inter and Montserrat (SIL Open Font Licence 1.1) are built into the page; nothing is downloaded. Other typefaces in Appearance use fonts already on your device.'),
        li(h('b', {}, 'Names: '), 'Ultimate Guitar, Focusrite, Scarlett, MIDI, Google and other names are used only to describe compatibility. This project is independent and not affiliated with or endorsed by them.'),
        li(h('b', {}, 'Made with AI assistance: '), 'developed with Claude (Anthropic) under my direction. The design choices, the music and any mistakes are mine.')),
      h('p', { class: 'tiny muted' }, 'Full notices: THIRD_PARTY_NOTICES.md and PRIVACY.md in the repository.')),
    h('p', { class: 'tiny muted', style: { marginBottom: 0 } }, 'Your songs, recordings and settings stay in this browser. The only requests this page can make are the optional hand-tracking and cut-out files above.'));
}
