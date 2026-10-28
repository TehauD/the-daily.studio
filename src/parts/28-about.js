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
    h('div', { class: 'ab-top' }, mark(), h('div', {}, h('b', { class: 'ab-name' }, h('span', {}, 'the-daily'), h('span', { class: 'tld' }, '.studio')), h('div', { class: 'tiny muted' }, 'v' + VERSION + ' · MIT licence'))),
    h('div', { class: 'ab-me ab-story' },
      h('h4', {}, 'Made for creators.'),
      h('p', {}, 'My mom put a guitar in my hands when I was five. It changed my life.'),
      h('p', {}, 'I didn’t grow up surrounded by instruments, studios, or technology. What I had was curiosity, persistence, and a desire to make music anyway.'),
      h('p', {}, 'the-daily.studio is built around that same idea.'),
      h('p', {}, 'It’s a place to explore sounds, understand songs, develop your ear, and capture ideas while inspiration is still fresh. The tools are simple, practical, and designed for people who want to create more than they want to learn software.'),
      h('p', {}, 'Built by a musician, software engineer, and dad who still believes great ideas can start with a guitar and a little curiosity.'),
      h('p', {}, 'Because sometimes all it takes is one spark, one melody, or one small breakthrough to change the direction of a day, a song, or even a life.'),
      h('p', {}, 'May this bring you joy!'),
      h('p', {}, 'Welcome to the-daily.studio'),
      h('p', { class: 'ab-sig' }, '— Tehau.'),
      h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, BRAND.support ? link('☕ ' + BRAND.supportLabel, BRAND.support, 'primary') : '', link('GitHub', BRAND.github), link('LinkedIn', BRAND.linkedin), link('The Daily', BRAND.journal), link('Source & issues', BRAND.repo))),
    h('details', { class: 'ab-cr', id: 'abPriv' }, h('summary', {}, 'Privacy at a glance'),
      h('ul', {},
        li(h('b', {}, 'Stays on this device: '), 'everything you play, sing, record, drop in or type: audio, camera pictures, songs, takes, lyrics and settings. Nothing is uploaded, and there is no account, analytics or advertising.'),
        li(h('b', {}, 'Sent over the network: '), 'nothing from your music. The page, its offline copy and the sample list come from this site. Only if you say yes to the one-time MediaPipe download does your browser also fetch code and a model from jsDelivr and Google Storage; those two sites see your IP address and browser type, like any web request.'),
        li(h('b', {}, 'Kept here, in this browser: '), 'songs and takes (IndexedDB), settings (local storage) and an offline copy of the app (Cache Storage). Settings ▸ Data ▸ Reset erases them. Files you export are yours to keep or share.'),
        li(h('b', {}, 'Seen by the host: '), 'the site is served by Cloudflare, which keeps ordinary access logs and traffic counts, as any web host does. The app itself sets no cookies.')),
      h('p', { class: 'tiny muted' }, 'The full statement: ', ext('privacy and notices', 'legal/#privacy'), '.')),
    h('details', { class: 'ab-cr' }, h('summary', {}, 'Credits & licences'),
      h('ul', {},
        li(h('b', {}, 'Code: '), 'MIT licence, © 2026 ' + BRAND.author + '. Free to use, copy, change and share; keep the licence notice.'),
        li(h('b', {}, 'Built with: '), 'the Web Audio API, AudioWorklet, Canvas, SVG and IndexedDB. No frameworks, no tracking, no analytics.'),
        li(h('b', {}, 'Hand tracking and person cut-out (optional): '), 'use ', ext('MediaPipe Tasks Vision', 'https://developers.google.com/mediapipe'), ' (Apache-2.0) with Google’s hand-landmarker and selfie-segmenter models. They are fetched from jsDelivr and Google Storage only after you say yes to a one-time download; this site does not host or copy them, and Google publishes them with model cards rather than a separate licence file. Motion-only mode and the edges-in look stay offline. ', CFG.mpOk ? h('button', { class: 'btn sm', id: 'mpForget', onclick: e => { CFG.mpOk = false; saveCfg(); e.target.remove(); toast('OK. It will ask again before downloading anything.', 'ok'); } }, 'Ask me again next time') : ''),
        li(h('b', {}, 'Methods: '), 'YIN pitch estimation (de Cheveigné & Kawahara, 2002); harmonic / percussive separation by median filtering (Fitzgerald, 2010); Karplus–Strong string synthesis (1983). Re-implemented here from the published papers.'),
        li(h('b', {}, 'Your music: '), 'the app ships with no recordings and no one else’s lyrics. Audio, lyrics and tab you bring in stay yours and stay on this device; you are responsible for having the right to use and share them. Chords, tab and stems are computed from your file and are derivative of it, so share them only as far as the original allows. The demo song is original.'),
        li(h('b', {}, 'Type: '), 'Inter and Montserrat (SIL Open Font Licence 1.1) are built into the page; nothing is downloaded. Other typefaces in Appearance use fonts already on your device.'),
        li(h('b', {}, 'Names: '), 'Ultimate Guitar, Focusrite, Scarlett, MIDI, Google and other names are used only to describe compatibility. This project is independent and not affiliated with or endorsed by them.'),
        li(h('b', {}, 'Made with AI assistance: '), 'developed with Claude (Anthropic) under my direction. The design choices, the music and any mistakes are mine.')),
      h('p', { class: 'tiny muted' }, 'Full text: ', ext('licences, third-party notices and privacy statement', 'legal/'), '.')),
    h('p', { class: 'tiny muted', style: { marginBottom: 0 } }, 'Your songs, recordings and settings stay in this browser. Nothing is uploaded. The only other sites this page can contact are jsDelivr and Google Storage, and only after you agree to the optional MediaPipe download.'));
}
