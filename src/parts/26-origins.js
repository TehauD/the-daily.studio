/* ============================================================
   Part 26 · ORIGINS, LIBRARY & ZOOM
   Two ways to begin — a clean canvas for a brand-new song, or "start from a song" (load a track → stems, tempo, key and
   chords fill in) — plus the song library and three zoom levels on the same document:
     Canvas  just the page: chords & lyrics, everything else out of the way
     Song    tab + chords & lyrics side by side
     Studio  arrangement, stems, takes, rig
   ============================================================ */
const ZOOM = { cur: CFG.zoom || 'studio' };
const ZOOMS = [['canvas', 'Canvas', 'Just the page: chords & lyrics, nothing else'], ['song', 'Song', 'Tab, chords & lyrics side by side'], ['studio', 'Studio', 'Arrangement, stems, takes and rig']];
const layoutPreset = n => (LAYOUTS.find(l => l[0] === n) || LAYOUTS[0])[2];
function zoomSet(z, quiet) {
  if (!quiet && z === 'studio') xpSignal(3);
  if (!ZOOMS.some(x => x[0] === z)) z = 'studio'; ZOOM.cur = z; CFG.zoom = z; saveCfg(); document.body.classList.toggle('zoom-canvas', z === 'canvas');
  if (isDesk()) {
    if (z === 'canvas') { LAY.right = true; saveLay(); applyLayout(); sideShow('refine'); }
    else if (z === 'song') applyPreset(layoutPreset('Songwriting'));
    else applyPreset(layoutPreset(STM.ch ? 'Track study' : 'Record'));
  }
  zoomSync(); if (!quiet) toast(ZOOMS.find(x => x[0] === z)[1] + ' view', ''); setTimeout(() => { try { tlSize(); } catch (e) { } window.dispatchEvent(new Event('resize')); }, 60);
}
function zoomSync() { $$('.sb-zoom button').forEach(b => b.classList.toggle('on', b.dataset.z === ZOOM.cur)); }
function zoomCtl() {
  const seg = h('div', { class: 'seg sb-zoom', role: 'group', 'aria-label': 'View: how much of the studio to show' }, ZOOMS.map(([k, n, t]) => h('button', { 'data-z': k, title: t, class: k === ZOOM.cur ? 'on' : '', onclick: () => zoomSet(k) }, n)));
  document.body.classList.toggle('zoom-canvas', ZOOM.cur === 'canvas'); return seg;
}

/* ---------- dialog helper ---------- */
function pdlg(id, title, body, o = {}) {
  const old = document.getElementById(id); if (old) { try { old.close(); } catch (e) { } old.remove(); }
  const d = h('dialog', { id, class: 'pdlg' + (o.wide ? ' wide' : '') + (o.cls ? ' ' + o.cls : '') }, h('div', { class: 'dlg-h' }, title, h('button', { class: 'btn sm', onclick: () => d.close() }, 'Close')), h('div', { class: 'dlg-b pd-b', style: { display: 'block' } }, body));
  d.addEventListener('close', () => { d.remove(); if (o.onclose) o.onclose(); }); document.body.append(d); if (d.showModal) d.showModal(); else d.setAttribute('open', ''); return d;
}
const pField = (label, el) => h('label', { class: 'pd-f' }, h('span', {}, label), el);
const pSel = (opts, v, fn) => h('select', { class: 'in', onchange: e => fn(e.target.value) }, opts.map(([k, t]) => h('option', { value: k, selected: String(k) === String(v) }, t)));

/* ---------- two origins ---------- */
function originsOpen(o = {}) {
  const f = { title: '', bpm: 92, key: 9, minor: true, ts: '4/4', tuning: 'Standard (E A D G B E)', form: 'empty' };
  let chosen = false; if (o.first && !PRJ.cur) PRJ.fresh = true;
  const close = () => { chosen = true; const d = document.getElementById('origins'); if (d) d.close(); };
  const startBlank = async () => { close(); await projCreate('blank', Object.assign({}, f, { ts: f.ts.split('/').map(Number), zoom: 'song' })); sideShow('refine'); setTimeout(() => { if (SB.f.title) { SB.f.title.focus(); SB.f.title.select(); } }, 80); };
  const isMidi = fl => /\.(mid|midi|kar)$/i.test(fl.name), intake = fl => { close(); if (isMidi(fl)) dropFiles([fl]); else projFromTrack(fl); };   // a MIDI file opens the track picker; anything else is a backing track
  const pick = h('input', { type: 'file', accept: 'audio/*,.mp3,.wav,.flac,.m4a,.ogg,.mid,.midi,.kar', style: { display: 'none' }, onchange: e => { const fl = e.target.files[0]; e.target.value = ''; if (fl) intake(fl); } });
  const opt = h('details', { class: 'pd-opt' }, h('summary', {}, 'Set it up first (optional)'), h('div', { class: 'pd-form' },
    pField('Tempo', h('input', { class: 'in', type: 'number', min: 30, max: 260, value: f.bpm, onchange: e => { f.bpm = +e.target.value || 92; } })), pField('Key', pSel(NS.map((n, i) => [i, n]), f.key, v => { f.key = +v; })), pField('Mode', pSel([['min', 'minor'], ['maj', 'major']], 'min', v => { f.minor = v === 'min'; })),
    pField('Time', pSel(['4/4', '3/4', '2/4', '5/4', '6/8', '12/8', '7/8'].map(x => [x, x]), f.ts, v => { f.ts = v; })), pField('Tuning', pSel(Object.keys(TUNINGS).map(k => [k, k]), f.tuning, v => { f.tuning = v; })),
    pField('Shape', pSel([['empty', 'An empty page (one section)'], ['vc', 'Verse · Chorus'], ['vcb', 'Verse · Chorus · Bridge']], f.form, v => { f.form = v; }))));
  const blank = h('section', { class: 'pd-card' }, h('div', { class: 'pd-ic' }, '✎'), h('h3', {}, 'Clean canvas'), h('p', { class: 'muted' }, 'A blank page for a brand-new song. Write lyrics and chords, hum an idea, record a take — nothing is pre-filled.'),
    pField('Working title', h('input', { class: 'in', placeholder: 'Untitled Idea', oninput: e => { f.title = e.target.value; }, onkeydown: e => { if (e.key === 'Enter') startBlank(); } })), opt, h('button', { class: 'btn primary pd-go', onclick: startBlank }, 'Start writing →'));
  const track = h('section', { class: 'pd-card pd-drop' }, h('div', { class: 'pd-ic' }, '♪'), h('h3', {}, 'Start from a song'), h('p', { class: 'muted' }, 'Load a track (a demo, a recording, a song you want to learn). It is split into stems and the title, tempo, key and chords fill the song in. Or open a MIDI file and get chords and a lead tab.'),
    h('button', { class: 'btn primary pd-go', onclick: () => pick.click() }, '📂 Choose an audio or MIDI file…'), pick, h('div', { class: 'tiny muted', style: { margin: '6px 0 8px' } }, 'or drop a file here · stays on this device'), samplesShelf(fl => { close(); projFromTrack(fl); }, 'TRY A SAMPLE'));
  ['dragover', 'dragenter'].forEach(ev => track.addEventListener(ev, e => { e.preventDefault(); track.classList.add('over'); })); ['dragleave', 'drop'].forEach(ev => track.addEventListener(ev, () => track.classList.remove('over')));
  track.addEventListener('drop', e => { e.preventDefault(); const fl = e.dataTransfer.files[0]; if (fl) intake(fl); });
  const hero = h('section', { class: 'pd-card pd-hero' }, h('div', { class: 'pd-ic' }, '🎤'), h('h3', {}, 'Hum or sing an idea'), h('p', {}, 'No instrument or experience needed. Hum a few seconds and hear a whole song.'),
    h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap' } }, h('button', { class: 'btn primary pd-go', id: 'originsHum', onclick: () => { close(); humOpen(); } }, '● Hum or sing'), h('span', { class: 'tiny muted' }, 'Everything stays on this device.')));
  const bund = h('input', { type: 'file', accept: '.zip,.json,.txt,.md,.lrc', style: { display: 'none' }, onchange: e => { const fl = e.target.files[0]; e.target.value = ''; if (fl) { close(); projImport(fl); } } });
  const more = h('div', { class: 'pd-more' }, PRJ.list.length ? h('button', { class: 'btn', onclick: () => { close(); libraryOpen(); } }, '☰ My songs (' + PRJ.list.length + ')') : null, h('button', { class: 'btn', title: 'A song bundle (.zip), a lyric sheet (.txt/.md) or an older project .json', onclick: () => bund.click() }, '⤒ Open a bundle or lyrics…'), bund,
    h('button', { class: 'btn', onclick: () => { close(); projCreate('demo', { zoom: 'song' }); } }, '♫ Try the demo song'));
  const d = pdlg('origins', o.first ? 'WELCOME — WHAT DO YOU WANT TO MAKE?' : 'NEW SONG — WHAT DO YOU WANT TO MAKE?', h('div', {}, hero, h('div', { class: 'pd-grid' }, blank, track), more,
    h('p', { class: 'tiny muted', style: { margin: '10px 0 0' } }, PRJ.cur ? 'Your current song is saved in My songs before the new one opens.' : 'Everything is saved on this device. Nothing is uploaded.')), {
    wide: true, onclose: () => { if (o.first && !chosen && !PRJ.cur) projCreate('demo', { zoom: 'song' }); }
  });
  setTimeout(() => { const i = $('input.in', blank); if (i) i.focus(); }, 40); return d;
}
function startMaybe() { if (PRJ.cur || store.get('started', false) || /[?&]start=0/.test(location.search) || document.getElementById('origins')) return; PRJ.fresh = true; if (CFG.route === 'stage') humStageFirst(); else humCanvasFirst(); }   // (the song on screen is only the built-in demo until the person picks something) the first thing anyone sees is the stage with one panel: hum, guitar, or a song file / blank page / demo
bus.on('booted', () => { if (PRJ.ready) startMaybe(); else PRJ.wantStart = true; });
/* a library that is unavailable (private window) still lets you begin */
function newSongGo() { originsOpen({}); }

/* ---------- library ---------- */
function libraryOpen() {
  const box = h('div', { class: 'pd-lib' }), arm = { id: null, t: 0 };
  async function draw() {
    box.innerHTML = ''; await projRefresh(); const tot = PRJ.list.reduce((a, r) => a + (r.size || 0), 0);
    box.append(h('div', { class: 'pd-head' }, h('span', { class: 'muted small' }, PRJ.ok ? PRJ.list.length + (PRJ.list.length === 1 ? ' song' : ' songs') + ' · ' + projBytes(tot) + ' on this device' : 'This browser is not keeping a library (private window?). Export bundles to keep your work.'), h('span', { class: 'grow' }),
      h('button', { class: 'btn sm primary', onclick: () => { d.close(); newSongGo(); } }, '＋ New song'), h('button', { class: 'btn sm', onclick: () => { d.close(); resetOpen(); } }, 'Reset…')));
    box.append(keepCard({ onDone: draw }));
    if (!PRJ.list.length) box.append(h('div', { class: 'muted', style: { padding: '18px 4px' } }, 'No songs yet.'));
    PRJ.list.forEach(r => {
      const cur = r.id === PRJ.cur, name = h('b', { class: 'pd-name' }, r.title || 'Untitled'), row = h('div', { class: 'pd-row' + (cur ? ' cur' : '') });
      const ren = () => { const inp = h('input', { class: 'in', value: r.title || '', style: { width: '100%' } }); name.replaceWith(inp); inp.focus(); inp.select(); const fin = async ok => { inp.onblur = null; if (ok) await projRename(r.id, inp.value); draw(); }; inp.onkeydown = e => { if (e.key === 'Enter') fin(true); if (e.key === 'Escape') fin(false); }; inp.onblur = () => fin(true); };
      const badge = (t, ti) => h('span', { class: 'pd-b', title: ti || '' }, t);
      const del = h('button', { class: 'btn sm bad', title: 'Delete this song and its recordings from this browser', onclick: async e => { if (arm.id !== r.id || Date.now() - arm.t > 4000) { arm.id = r.id; arm.t = Date.now(); e.target.textContent = 'Click again to delete'; return; } await projDelete(r.id); draw(); } }, 'Delete');
      row.append(h('div', { class: 'pd-main' }, name, h('div', { class: 'tiny muted' }, (r.artist ? r.artist + ' · ' : '') + (cur ? 'open now · ' : '') + projAgo(r.modified))),
        h('div', { class: 'pd-badges' }, r.origin === 'track' || r.track ? badge('♪ track', r.track ? r.track.title || r.track.name : '') : badge('✎'), r.nTakes ? badge('🎙 ' + r.nTakes, r.nTakes + ' recorded takes') : null, badge(projBytes(r.size || 0))),
        h('div', { class: 'pd-acts' }, cur ? h('button', { class: 'btn sm', disabled: true }, 'Open') : h('button', { class: 'btn sm primary', onclick: async () => { d.close(); await projLoad(r.id); } }, 'Open'),
          h('button', { class: 'btn sm', onclick: ren }, 'Rename'), h('button', { class: 'btn sm', onclick: async () => { await projDuplicate(r.id); toast('Duplicated', 'ok'); draw(); } }, 'Duplicate'), h('button', { class: 'btn sm', title: 'Download a .zip song folder: song.md, arrangement.json, audio/', onclick: () => projExport(r.id) }, '⤓ Bundle'), del));
      box.append(row);
    });
    const imp = h('input', { type: 'file', accept: '.zip,.json,.txt,.md,.lrc', style: { display: 'none' }, onchange: e => { const fl = e.target.files[0]; e.target.value = ''; if (fl) { d.close(); projImport(fl); } } });
    box.append(h('div', { class: 'pd-foot' }, h('button', { class: 'btn sm', onclick: () => imp.click() }, '⤒ Open a bundle…'), imp, 
      h('span', { class: 'tiny muted' }, 'A bundle is a plain folder of files — song.md opens in any text editor or Obsidian.')));
  }
  const d = pdlg('library', 'MY SONGS', box, { wide: true }); draw(); return d;
}

/* ---------- the song bar: ☰ Songs menu + zoom ---------- */
function songsMenu(anchor) {
  const box = h('div', { class: 'pd-menu' }), go = fn => () => { closePop(); fn(); };
  box.append(h('h5', {}, 'Songs'), h('button', { class: 'btn sm primary', onclick: go(newSongGo) }, '＋ New song…'), h('button', { class: 'btn sm', onclick: go(humOpen) }, '🎤 Hum or sing a song…'));
  if (PRJ.list.length) { box.append(h('div', { class: 'tiny muted', style: { margin: '8px 0 2px', fontWeight: 800, letterSpacing: '.06em' } }, 'RECENT')); PRJ.list.slice(0, 6).forEach(r => box.append(h('button', { class: 'btn sm pd-rec' + (r.id === PRJ.cur ? ' on' : ''), onclick: go(() => { if (r.id !== PRJ.cur) projLoad(r.id); }) }, h('span', {}, (r.origin === 'track' || r.track ? '♪ ' : '✎ ') + (r.title || 'Untitled')), h('i', {}, projAgo(r.modified))))); }
  box.append(h('div', { class: 'hr' }), h('button', { class: 'btn sm', onclick: go(libraryOpen) }, '☰ All songs…'), h('button', { class: 'btn sm', disabled: !PRJ.cur || !PRJ.ok, onclick: go(() => projExport(PRJ.cur)) }, '⤓ Save this song as a bundle'), h('button', { class: 'btn sm', onclick: go(() => liOpen()) }, '📋 Paste lyrics…'), h('button', { class: 'btn sm', onclick: go(resetOpen) }, 'Reset…'));
  popover(anchor, box, { style: { width: '290px', maxWidth: '92vw' } });
}
function sbProject() {
  const b = h('button', { class: 'btn sm sb-songs', title: 'Songs: new, open, bundles', 'aria-label': 'Songs', onclick: e => songsMenu(e.currentTarget) }, h('span', { class: 'sb-ic' }, '☰'), h('span', { class: 'sb-tx' }, ' Songs'));
  const n = h('button', { class: 'btn sm sb-new', title: 'New song — clean canvas, or start from a track', 'aria-label': 'New song', onclick: newSongGo }, '＋', h('span', { class: 'sb-tx' }, ' New'));
  return h('div', { class: 'sb-proj' }, b, n);
}
