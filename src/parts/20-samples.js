/* ============================================================
   Part 20 · sample tracks
   Audio files in /samples (listed in samples/manifest.json by the build) appear as one-tap shelves in Stems and
   Transcribe. They are fetched from the same site only when tapped; nothing is uploaded anywhere.
   Hidden when the page is opened from disk or the folder is absent (CodePen, a single emailed file).
   ============================================================ */
const SMP = { list: null, shelves: [] };
async function samplesList() {
  if (SMP.list) return SMP.list;
  try {
    if (typeof fetch !== 'function' || location.protocol === 'file:') throw new Error('no fetch');
    const r = await fetch('samples/manifest.json', { cache: 'no-cache' }); if (!r.ok) throw new Error('none');
    const j = await r.json(); SMP.list = Array.isArray(j.tracks) ? j.tracks : [];
  } catch (e) { SMP.list = []; }
  return SMP.list;
}
async function samplePick(t, handler) {
  try {
    toast('Loading “' + t.title + '”…');
    const r = await fetch('samples/' + encodeURIComponent(t.file)); if (!r.ok) throw new Error('HTTP ' + r.status);
    const blob = await r.blob(), ext = (t.file.match(/\.[^.]+$/) || [''])[0];
    await handler(new File([blob], t.title + ext, { type: blob.type || 'audio/mp4' }));
  } catch (e) { console.warn(e); toast('Could not load that sample: ' + (e.message || e), 'bad'); }
}
function samplesShelf(handler, label) {
  const box = h('div', { class: 'smp-shelf', style: { display: 'none' } }, h('span', { class: 'smp-l' }, label || 'SAMPLE TRACKS'));
  samplesList().then(list => {
    if (!list.length) return;
    list.forEach(t => box.append(h('button', { class: 'btn sm smp', title: (t.note ? t.note + ' · ' : '') + (t.mb ? t.mb + ' MB, downloaded when you tap it' : 'Tap to load'), onclick: () => samplePick(t, handler) }, '▶ ', t.title)));
    box.style.display = '';
  });
  return box;
}
