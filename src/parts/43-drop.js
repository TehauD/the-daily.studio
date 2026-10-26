/* ============================================================
   Part 43 · Drop anywhere
   Drag a file onto the page and it goes to the right place:
     audio / video → a short chooser (backing track · vocal take · guitar take · hum into a song)
     lyrics (.txt .md .lrc) and song files (.zip, song .json) → the existing importers
     rig (.json) → loaded into the rig
   Everything is read on this device. A zone that already handles its own drop (Stems pane, lyric box, start card) keeps it.
   ============================================================ */
const DROP = { ov: null, tm: 0, row: null };
const DROP_AUDIO = /\.(mp3|wav|wave|flac|m4a|aac|ogg|oga|opus|weba|webm|mp4|m4v|mov|aif|aiff|caf)$/i;
const DROP_KINDS = [
  ['track', '🎼', 'Backing track', 'Splits it into stems and sets this song’s tempo and key. A restore point is saved first.'],
  ['vox', '🎤', 'Vocal take', 'A lane in the arrangement you can mix and add effects to.'],
  ['gtr', '🎸', 'Guitar take', 'A lane in the arrangement you can mix and add effects to.'],
  ['hum', '✨', 'Hum → new song', 'Finds the melody and builds a song around it. Starts a new song.']
];

/** what is this file? 'audio' | 'lyrics' | 'bundle' | 'json' | 'midi' | 'other' */
function dropKind(f) {
  const n = String((f && f.name) || '').toLowerCase(), t = String((f && f.type) || '').toLowerCase();
  if (/\.zip$/.test(n) || /^application\/(x-)?zip(-compressed)?$/.test(t)) return 'bundle';
  if (/\.(txt|md|lrc)$/.test(n) || t === 'text/plain' || t === 'text/markdown') return 'lyrics';
  if (/\.json$/.test(n) || t === 'application/json') return 'json';
  if (/\.(mid|midi)$/.test(n) || t === 'audio/midi' || t === 'audio/x-midi') return 'midi';
  if (DROP_AUDIO.test(n) || /^(audio|video)\//.test(t)) return 'audio';
  return 'other';
}
const dropHasFiles = e => { const t = e.dataTransfer && e.dataTransfer.types; return !!t && [...t].includes('Files'); };
/** a modal window or the start-up screen is up: dropping should not do anything behind it */
function dropBlocked() { return !!document.getElementById('boot') || !!document.querySelector('dialog[open]:not(.humbar)'); }

function dropOvShow(on) {
  if (on && !DROP.ov) {
    DROP.ov = h('div', { id: 'dropOv', class: 'drop-ov', 'aria-hidden': 'true' }, h('div', { class: 'drop-in' }, h('div', { class: 'drop-ic' }, '⤓'), h('b', {}, 'Drop to add it here'),
      h('span', { class: 'muted' }, 'Audio · lyrics (.txt .md .lrc) · song file (.zip) · rig (.json)')));
    document.body.append(DROP.ov);
  }
  if (DROP.ov) DROP.ov.classList.toggle('on', !!on);
  clearTimeout(DROP.tm); if (on) DROP.tm = setTimeout(() => dropOvShow(false), 700);
}
document.addEventListener('dragenter', e => { if (dropHasFiles(e) && !e.defaultPrevented && !dropBlocked()) dropOvShow(true); });
document.addEventListener('dragover', e => {
  if (!dropHasFiles(e)) return;
  if (e.defaultPrevented) { dropOvShow(false); return; }               // a zone with its own drop handler owns this one
  e.preventDefault(); try { e.dataTransfer.dropEffect = 'copy'; } catch (x) { }
  dropOvShow(!dropBlocked());
});
document.addEventListener('dragleave', e => { if (!e.relatedTarget) dropOvShow(false); });
document.addEventListener('drop', e => {
  dropOvShow(false); if (!dropHasFiles(e) || e.defaultPrevented) return;
  e.preventDefault();                                                  // never let the browser navigate away from the song
  if (dropBlocked()) return toast('Close this window first, then drop the file.', 'warn');
  dropFiles([...(e.dataTransfer.files || [])]);
});

/** route a list of files (from a drop or the “Choose a file…” button) */
async function dropFiles(files) {
  files = (files || []).filter(f => f && f.name != null); if (!files.length) return { handled: 0 };
  const by = { bundle: [], lyrics: [], json: [], audio: [], midi: [], other: [] }; files.forEach(f => by[dropKind(f)].push(f));
  let handled = 0;
  if (by.bundle.length) { if (by.bundle.length > 1) toast('Opening “' + by.bundle[0].name + '” first. Drop the others one at a time.', 'warn'); await projImport(by.bundle[0]); handled++; }
  if (by.json.length) { await dropJson(by.json[0]); handled++; }
  if (by.lyrics.length) { await projImport(by.lyrics[0]); handled++; }
  if (by.midi.length) toast('MIDI files cannot be opened here yet. Export audio from your music app instead, or drop it as a recording.', 'warn');
  if (by.other.length && !handled && !by.audio.length) toast('“' + by.other[0].name + '” is not something ' + BRAND.name + ' can open. Try audio (MP3, WAV, M4A…), lyrics (.txt, .md, .lrc) or a song file (.zip).', 'warn');
  if (by.audio.length) { dropAudioChoose(by.audio); handled++; }
  return { handled, by };
}
async function dropJson(f) {
  let d; try { d = JSON.parse(await f.text()); } catch (e) { return toast('“' + f.name + '” could not be read as JSON.', 'warn'); }
  const s = d && (d.song || d);
  if (s && Array.isArray(s.sections)) return projImport(f);
  const r = d && (d.rig || ((d.u || d.order) ? d : null));
  if (r) { try { rigApply(r); bus.emit('rig:state'); toast('Rig loaded from “' + f.name + '”', 'ok'); } catch (e) { toast('That rig file did not load: ' + (e.message || e), 'warn'); } return; }
  toast('“' + f.name + '” is not a song or a rig.', 'warn');
}

/** audio: ask what it is (the last answer is highlighted) */
function dropAudioChoose(files) {
  const many = files.length > 1, f0 = files[0]; let last = CFG.dropKind || 'track'; if (many && (last === 'track' || last === 'hum')) last = 'vox';
  const pick = k => { CFG.dropKind = k; saveCfg(); const d = document.getElementById('dropDlg'); if (d) d.close(); dropAudio(files, k); };
  const opts = DROP_KINDS.map(([k, ic, t, sub]) => {
    const off = many && (k === 'track' || k === 'hum'), note = off ? 'One file at a time.' : (k === 'track' && STM.file ? 'Replaces the backing track that is loaded now. ' : '') + sub;
    return h('button', { class: 'btn drop-opt' + (k === last ? ' on' : ''), 'data-k': k, disabled: off, onclick: () => pick(k) }, h('span', { class: 'drop-oi', 'aria-hidden': 'true' }, ic), h('span', {}, h('b', {}, t), h('small', {}, note)));
  });
  pdlg('dropDlg', many ? 'Add ' + files.length + ' recordings' : 'Add “' + (cleanTitle(f0.name) || f0.name).slice(0, 48) + '”', h('div', { class: 'drop-dlg' },
    h('p', { class: 'muted' }, many ? 'What are these?' : 'What is this recording?'), h('div', { class: 'drop-opts' }, opts), h('div', { class: 'tiny muted' }, 'It is read on this device. Nothing is uploaded.')));
}
async function dropAudio(files, kind) {
  if (kind === 'track') { if (ZOOM.cur === 'canvas') zoomSet('song', true); dockGo('stems'); return stemLoad(files[0]); }
  if (kind === 'hum') return humFromFile(files[0]);
  let n = 0; for (const f of files) if (await dropTake(f, kind)) n++;
  if (n && ZOOM.cur === 'canvas') zoomSet('song', true);
  return n;
}
/** an audio file as a Vocal or Guitar take at the start of the song; bars are added so the whole recording plays */
async function dropTake(file, kind) {
  try {
    const vox = kind === 'vox', { pcm, sr } = await humDecode(await file.arrayBuffer(), 600);
    let pk = 0, e = 0; for (let i = 0; i < pcm.length; i++) { const a = Math.abs(pcm[i]); if (a > pk) pk = a; e += pcm[i] * pcm[i]; }
    if (!pcm.length || pk < 1e-4) { toast('“' + file.name + '” is silent.', 'warn'); return null; }
    const nth = TAKES.filter(t => (t.kind === 'vox') === vox).length + 1, nm = (cleanTitle(file.name) || (vox ? 'Vocal ' : 'Take ') + nth).slice(0, 40);
    const tk = { id: uid(), kind: vox ? 'vox' : 'gtr', name: nm, startSec: 0, sr, dry: pcm, wet: null, peaks: peaksOf(pcm), g: 1, pan: 0, mute: false, solo: false, mode: 'wet', bpm: S.bpm, preset: '', peak: dB(pk), rms: dB(Math.sqrt(e / pcm.length)), dur: pcm.length / sr, t: Date.now(), stats: null, cam: [], imported: true };
    TAKES.push(tk); const last = S.sections[S.sections.length - 1]; let guard = 0; while (last && songSlots() * slotDur() < tk.dur + .5 && guard++ < 400) last.bars.push(newBar(''));
    T.bars = null; commit(false); bus.emit('takes'); toast('Added “' + tk.name + '” (' + fmtT(tk.dur) + ') as a ' + (vox ? 'Vocal' : 'Guitar') + ' take', 'ok');
    return tk;
  } catch (err) { console.warn(err); toast('Could not read “' + file.name + '” (' + (err.message || err.name) + '). Try a WAV, MP3 or M4A.', 'warn'); return null; }
}

/** the drop row under the arrangement: only while there is nothing in it yet */
function dropRowMake() {
  const inp = h('input', { type: 'file', multiple: true, accept: 'audio/*,video/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.opus,.aif,.aiff,.txt,.md,.lrc,.zip,.json', style: { display: 'none' }, 'aria-label': 'Choose files to add', onchange: e => { const fl = [...e.target.files]; e.target.value = ''; if (fl.length) dropFiles(fl); } });
  DROP.row = h('div', { class: 'tl-drop', id: 'tlDrop' }, inp, h('span', { class: 'tl-drop-ic', 'aria-hidden': 'true' }, '⤓'),
    h('span', { class: 'tl-drop-t' }, h('b', {}, h('span', { class: 'dr-d' }, 'Drop audio, lyrics or a song file anywhere'), h('span', { class: 'dr-t' }, 'Add audio, lyrics or a song file')), h('span', { class: 'muted' }, ' · it stays on this device')),
    h('button', { class: 'btn sm', id: 'dropPick', onclick: () => inp.click() }, 'Choose a file…'), h('button', { class: 'btn sm', id: 'dropMemo', title: 'Record your voice as it is', onclick: () => humRecord(true) }, '🎤 Voice memo'));
  dropRowSync(); return DROP.row;
}
function dropRowSync() { if (!DROP.row) return; DROP.row.hidden = !!(TAKES.length || STM.ch || STM.busy); }
bus.on('takes', dropRowSync); bus.on('track', dropRowSync); bus.on('song', dropRowSync);
