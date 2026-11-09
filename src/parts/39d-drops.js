/* ============================================================
   Part 39d · DROPS (2.60) — share a finished song publicly, for 7 days, after the site's owner has listened to it
   🌍 Drop it (in Finish it, once the song is mastered): the master is compressed here (Opus in an Ogg file, made with WebCodecs, 128 kbps
   stereo) and sent with a title, the name you choose, a note and, if you like, the song itself as a link (words, chords and the band; no
   recordings). It waits for the owner's review; once approved it's on /drops/ for 7 days, then gone. Drops are for music you made: a song
   still played over someone else's record can't be dropped (✦ Make it ours first). Sending needs Sign in with GitHub, as for recordings.
   The Ogg file: OpusHead and OpusTags pages, then the audio, up to 255 segments a page, each page's granule position the samples so far
   (48 kHz, counting Opus's lead-in), CRC-32 with Ogg's polynomial (0x04c11db7, not reflected).
   ============================================================ */
const DRP = { kbps: 128000 };
const DRP_CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let r = i << 24; for (let k = 0; k < 8; k++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1; t[i] = r >>> 0; } return t; })();
function drpPage(flags, granule, serial, seq, packets) {
  const lace = []; packets.forEach(p => { let n = p.length; while (n >= 255) { lace.push(255); n -= 255; } lace.push(n); });
  const size = packets.reduce((a, p) => a + p.length, 0), pg = new Uint8Array(27 + lace.length + size), dv = new DataView(pg.buffer);
  pg.set([0x4f, 0x67, 0x67, 0x53, 0, flags]); dv.setUint32(6, granule % 4294967296, true); dv.setUint32(10, Math.floor(granule / 4294967296), true); dv.setUint32(14, serial, true); dv.setUint32(18, seq, true); pg[26] = lace.length; pg.set(lace, 27);
  let o = 27 + lace.length; packets.forEach(p => { pg.set(p, o); o += p.length; });
  let c = 0; for (let i = 0; i < pg.length; i++) c = ((c << 8) ^ DRP_CRC[((c >>> 24) ^ pg[i]) & 255]) >>> 0; dv.setUint32(22, c, true); return pg;
}
/** a stereo master (any rate) as an Ogg Opus file */
async function drpOgg(l, r, sr) {
  if (typeof AudioEncoder !== 'function') throw new Error('This browser can’t compress audio for a drop. Chrome, Edge, Firefox and Safari 26 or later can.');
  let L = l, R = r; if (sr !== 48000) { const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, n = Math.round(l.length * 48000 / sr), c = new OC(2, n, 48000), b = c.createBuffer(2, l.length, sr); b.copyToChannel(l, 0); b.copyToChannel(r, 1); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(); const o = await c.startRendering(); L = o.getChannelData(0); R = o.getChannelData(1); }
  const pk = []; let cfg = null, err = null;
  const e = new AudioEncoder({ output: (ch, m) => { const d = new Uint8Array(ch.byteLength); ch.copyTo(d); pk.push([d, ch.duration]); if (m && m.decoderConfig) cfg = m.decoderConfig; }, error: x => { err = x; } });
  e.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: DRP.kbps });
  for (let i = 0; i < L.length; i += 48000) { const n = Math.min(48000, L.length - i), d = new Float32Array(n * 2); d.set(L.subarray(i, i + n), 0); d.set(R.subarray(i, i + n), n); e.encode(new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / 48 * 1000), data: d })); }
  await e.flush(); e.close(); if (err) throw err;
  const pre = srxPre(cfg && cfg.description), serial = (Math.random() * 4294967295) >>> 0, enc = new TextEncoder(), pages = [];
  const head = new Uint8Array(19); head.set(enc.encode('OpusHead')); head[8] = 1; head[9] = 2; new DataView(head.buffer).setUint16(10, pre, true); new DataView(head.buffer).setUint32(12, 48000, true);
  const vendor = enc.encode('the-daily.studio'), tags = new Uint8Array(8 + 4 + vendor.length + 4); tags.set(enc.encode('OpusTags')); new DataView(tags.buffer).setUint32(8, vendor.length, true); tags.set(vendor, 12);
  pages.push(drpPage(2, 0, serial, 0, [head]), drpPage(0, 0, serial, 1, [tags]));
  let seq = 2, gran = 0, cur = [], segs = 0;
  pk.forEach(([d, dur], i) => { const s = Math.floor(d.length / 255) + 1; if (segs + s > 255 && cur.length) { pages.push(drpPage(0, gran, serial, seq++, cur)); cur = []; segs = 0; } cur.push(d); segs += s; gran += Math.round((dur || 20000) * 48 / 1000); });
  pages.push(drpPage(4, Math.min(gran, pre + L.length), serial, seq++, cur));
  return new Blob(pages, { type: 'audio/ogg' });
}
/** can this song be dropped? (music you made: no record still under it) */
const drpOwn = () => !(STM.ch && !STM.mute) && !(S.trackRef && !(S.track && S.track.ours));
async function drpOpen() {
  if (!FIN.out) return toast('Master the song first (✦ Master it).', 'warn');
  if (CFG.shareOk !== SHARE_TERMS) return shareGate(drpOpen);      /* the sharing terms, once, as for any share */
  if (!drpOwn()) return toast('Drops are for music you made. This song is still played over a record: ✦ Make it ours first (the track’s menu in the song bar).', 'warn');
  const t = h('input', { class: 'in', id: 'drpTitle', maxlength: 80, value: S.title || '' }), a = h('input', { class: 'in', id: 'drpName', maxlength: 40, value: CFG.slName || (S.artist && S.artist !== 'Your Name' ? S.artist : ''), placeholder: 'The name to show' });
  const n = h('textarea', { class: 'in', id: 'drpNote', rows: 2, maxlength: 280, placeholder: 'A line about it (optional)' }), link = h('input', { type: 'checkbox', id: 'drpLink', checked: true }), mine = h('input', { type: 'checkbox', id: 'drpMine' });
  const say = h('p', { class: 'small', id: 'drpSay', role: 'status' });
  const go = h('button', { class: 'btn primary', id: 'drpGo', disabled: true, onclick: async () => {
    if (!ghTok()) { say.textContent = 'Sign in with GitHub first (Settings ▸ GitHub): a drop needs an account.'; return; }
    if (!t.value.trim() || !a.value.trim()) { say.textContent = 'A title and a name, please.'; return; }
    go.disabled = true; CFG.slName = a.value.trim().slice(0, 40); saveCfg();
    try {
      say.textContent = 'Compressing the master…'; const blob = await drpOgg(FIN.out.l, FIN.out.r, FIN.out.sr);
      let l = ''; if (link.checked) { const u = await slLink(); l = u.slice(u.indexOf('#') + 1); }
      const meta = slB64(new TextEncoder().encode(JSON.stringify({ t: t.value.trim(), a: a.value.trim(), n: n.value.trim(), l, d: Math.round(FIN.out.l.length / FIN.out.sr) })));
      say.textContent = 'Sending ' + projBytes(blob.size) + '…'; const tok = await ghToken();
      const r = await fetch('/drops/api/put', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'audio/ogg', 'X-Drop-Meta': meta }, body: blob, cache: 'no-store' }), j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error({ 'not-set-up': 'Drops aren’t switched on for this site yet.', 'sign-in': 'Sign in with GitHub first (Settings ▸ GitHub).', 'limit-you': 'Three drops a day at most: try again tomorrow.', 'queue-full': 'The review queue is full: try again in a day or two.', 'too-big': 'It’s more than 15 MB, even compressed.' }[j.error] || 'It couldn’t be sent (' + (j.error || r.status) + ').');
      say.textContent = '✓ Sent for review. Once the site’s owner has listened, it’s on the-daily.studio/drops for 7 days.'; toast('🌍 Dropped, waiting for review.', 'ok');
    } catch (e) { say.textContent = e.message || String(e); go.disabled = false; }
  } }, '🌍 Drop it');
  mine.addEventListener('change', () => { go.disabled = !mine.checked; });
  pdlg('drpDlg', '🌍 Drop “' + (S.title || 'Untitled') + '”', h('div', { class: 'drp' },
    h('p', { class: 'small' }, 'Drops is new music from the studio, public for 7 days. The site’s owner listens first; once approved, anyone can hear it at the-daily.studio/drops until it ends.'),
    h('label', { class: 'small' }, 'Title', t), h('label', { class: 'small' }, 'Your name, as shown', a), h('label', { class: 'small' }, 'Note', n),
    h('label', { class: 'chk small' }, link, ' Include the song (words, chords and the band; no recordings), so listeners can open it and make their own version'),
    h('label', { class: 'chk small' }, mine, ' I made this, music and words, or have the right to publish it; it’s no one else’s recording. (Terms of use)'),
    h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '8px' } }, go), say), {});
}
