/* ============================================================
   Part 89b · SEND WITH RECORDINGS (2.54) — a song link that carries your takes, for 7 days
   🔗 Send ▸ 🎙 Include my recordings: the song's takes (each clip as it plays, dry and with its effects) are compressed here with the
   browser's own Opus encoder (WebCodecs), packed with what each take is (name, place in the song, level, pan) and ENCRYPTED here
   (AES-GCM, a new random 256-bit key). Only the sealed package goes to this site's Worker (worker/share.mjs), which keeps it for 7 days.
   The key is added to the link after the #, the part of a link no server ever receives, so neither the site nor Cloudflare can open it.
   The backing track you loaded is not sent (it is usually someone else's recording); the beat and the band travel in the song itself.
   Sending needs Sign in with GitHub (one account, a daily limit); opening never does. Whoever opens the link gets the song as a new song
   with the takes in their lanes, sample-aligned, and can add their own and ↩ Send it back the same way.
   Package: "TDS1" + 12-byte IV + AES-GCM( a stored .zip: arrangement.json (the takes) + audio/<take>.tda (+ fret logs) ).
   A .tda is: u32 header length, the header (JSON: decoder config, chunk table, samples, Opus's lead-in), then the Opus chunks.
   Everything from a link is untrusted: sizes, counts and every field of a take are checked before anything is used.
   ============================================================ */
const SRX = { rate: 48000, kbps: 96000, max: 25 * 1024 * 1024, days: 7, takes: 48, secs: 3600, magic: [0x54, 0x44, 0x53, 0x31] };
const SRS = { att: '', ref: '', exp: 0, busy: null, err: '' };      /* this send dialog's upload: the link's attachment once it has gone */
/** can this browser make and open recordings in links? (WebCodecs audio, Web Crypto, and a page on the web) */
const srxCan = () => typeof AudioEncoder === 'function' && typeof AudioDecoder === 'function' && !!(window.crypto && crypto.subtle) && window.isSecureContext !== false;
/** a link's recordings: "<day>.<account>.<id>.<key>" */
const SRX_ATT = /^(\d{8}\.[0-9a-f]{12}\.[A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/;
const srxUntil = ref => { const d = String(ref).slice(0, 8); return new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)) + SRX.days * 864e5); };
const srxDate = d => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const srxErr = (code, message) => Object.assign(new Error(message), { code });

/* ---------- audio: to 48 kHz, Opus and back ---------- */
async function srxTo48(x, sr) {
  if (sr === SRX.rate || !x.length) return x;
  const n = Math.max(1, Math.round(x.length * SRX.rate / sr)), oc = new OfflineAudioContext(1, n, SRX.rate), b = oc.createBuffer(1, x.length, sr), s = oc.createBufferSource();
  b.copyToChannel(x, 0); s.buffer = b; s.connect(oc.destination); s.start(); return (await oc.startRendering()).getChannelData(0).slice();
}
const srxU8 = d => d instanceof ArrayBuffer ? new Uint8Array(d) : new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
/** decode a take's chunks (as this browser's decoder gives them: some drop the encoder's lead-in, some do not) */
async function srxDecodeRaw(e) {
  if (!e.chunks.length) return new Float32Array(0);
  const parts = []; let err = null, rate = SRX.rate;
  const d = new AudioDecoder({ output: a => { rate = a.sampleRate; const f = new Float32Array(a.numberOfFrames); a.copyTo(f, { planeIndex: 0, format: 'f32-planar' }); parts.push(f); a.close(); }, error: x => { err = x; } });
  const cfg = { codec: 'opus', sampleRate: SRX.rate, numberOfChannels: 1 }; if (e.cfg.description) cfg.description = slUnB64(e.cfg.description);
  d.configure(cfg); e.chunks.forEach(c => d.decode(new EncodedAudioChunk({ type: c[0] ? 'key' : 'delta', timestamp: c[1], duration: c[2] || undefined, data: c[3] }))); await d.flush(); d.close(); if (err) throw err;
  const n = parts.reduce((a, p) => a + p.length, 0), y = new Float32Array(n); let o = 0; parts.forEach(p => { y.set(p, o); o += p.length; });
  return rate === SRX.rate ? y : srxTo48(y, rate);
}
/** Opus's lead-in (pre-skip), from the encoder's own header (OpusHead, bytes 10–11); 312 samples is libopus's at 48 kHz */
const srxPre = desc => { const u = desc ? srxU8(desc) : null; return u && u.length >= 12 && u[0] === 0x4f && u[1] === 0x70 ? u[10] | (u[11] << 8) : 312; };
/** one take (48 kHz) as Opus, with what the receiver needs to put it back exactly where it was */
async function srxEncode(x) {
  const chunks = []; let cfg = null, err = null;
  const e = new AudioEncoder({ output: (c, m) => { const d = new Uint8Array(c.byteLength); c.copyTo(d); chunks.push([c.type === 'key' ? 1 : 0, c.timestamp, c.duration || 0, d]); if (m && m.decoderConfig) cfg = m.decoderConfig; }, error: z => { err = z; } });
  e.configure({ codec: 'opus', sampleRate: SRX.rate, numberOfChannels: 1, bitrate: SRX.kbps });
  for (let i = 0; i < x.length; i += SRX.rate) { const len = Math.min(SRX.rate, x.length - i); e.encode(new AudioData({ format: 'f32-planar', sampleRate: SRX.rate, numberOfFrames: len, numberOfChannels: 1, timestamp: Math.round(i / SRX.rate * 1e6), data: x.slice(i, i + len) })); }
  await e.flush(); e.close(); if (err) throw err;
  return { cfg: { codec: 'opus', description: cfg && cfg.description ? slB64(srxU8(cfg.description)) : '' }, chunks, n: x.length, pre: srxPre(cfg && cfg.description) };
}
function srxPack(e) {
  const hj = new TextEncoder().encode(JSON.stringify({ v: 1, cfg: e.cfg, n: e.n, pre: e.pre, c: e.chunks.map(c => [c[0], c[1], c[2], c[3].length]) }));
  const size = e.chunks.reduce((a, c) => a + c[3].length, 0), out = new Uint8Array(4 + hj.length + size); new DataView(out.buffer).setUint32(0, hj.length, true); out.set(hj, 4);
  let o = 4 + hj.length; e.chunks.forEach(c => { out.set(c[3], o); o += c[3].length; }); return out;
}
/** a .tda from a link, checked: Opus only, sizes that add up, no more than an hour */
function srxUnpack(u) {
  if (u.length < 8) throw srxErr('bad', 'a recording is damaged'); const hl = new DataView(u.buffer, u.byteOffset, u.byteLength).getUint32(0, true); if (hl > 4e6 || 4 + hl > u.length) throw srxErr('bad', 'a recording is damaged');
  let h0; try { h0 = JSON.parse(new TextDecoder().decode(u.subarray(4, 4 + hl))); } catch (e) { throw srxErr('bad', 'a recording is damaged'); }
  const okN = v => Number.isInteger(v) && v >= 0; if (!h0 || !h0.cfg || h0.cfg.codec !== 'opus' || !okN(h0.n) || h0.n > SRX.rate * SRX.secs || !okN(h0.pre) || h0.pre > 9600 || !Array.isArray(h0.c) || h0.c.length > 400000) throw srxErr('bad', 'a recording is not one this studio makes');
  if (typeof h0.cfg.description !== 'string' || h0.cfg.description.length > 400) throw srxErr('bad', 'a recording is damaged');
  let o = 4 + hl; const chunks = h0.c.map(c => { const n = c && c[3]; if (!Array.isArray(c) || !okN(n) || o + n > u.length || !Number.isFinite(c[1]) || !Number.isFinite(c[2])) throw srxErr('bad', 'a recording is damaged'); const d = u.subarray(o, o + n); o += n; return [c[0] ? 1 : 0, c[1], c[2], d]; });
  return { cfg: { codec: 'opus', description: h0.cfg.description }, chunks, n: h0.n, pre: h0.pre };
}
/** a take back as samples, exactly as long as it was and where it was. The frames add up to the lead-in + the take + padding; a decoder
    that drops the lead-in gives that many fewer samples, so what is left to drop is plain arithmetic, the same in every browser. */
async function srxDecodeTake(u) {
  const e = srxUnpack(u), y = await srxDecodeRaw(e), total = e.chunks.reduce((a, c) => a + Math.round((c[2] || 20000) * SRX.rate / 1e6), 0);
  const lead = clamp(y.length - (total - e.pre), 0, Math.min(e.pre, Math.max(0, y.length - e.n))), x = new Float32Array(e.n);
  x.set(y.subarray(lead, lead + e.n)); return x;
}

/* ---------- the package ---------- */
/** the open song's takes, compressed, with what each one is (the backing track is left out) */
async function srxBundle(onStep) {
  await projSave(); const files = await projEntries(PRJ.cur, ''), dec = new TextDecoder(), af = files.find(f => f.name === 'arrangement.json'), arr = JSON.parse(dec.decode(af.data));
  const out = [], takes = []; let secs = 0, i = 0;
  for (const t of (arr.takes || []).slice(0, SRX.takes)) {
    const m = Object.assign({}, t, { files: {} }); delete m.stats; onStep && onStep(++i, Math.min(arr.takes.length, SRX.takes));
    for (const k of ['dry', 'wet']) {
      const fn = t.files && t.files[k], f = fn && files.find(x => x.name === fn); if (!f) continue;
      const w = wavParse(f.data), x = await srxTo48(fromI16(w.i16), w.sr); if (k === 'dry') secs += x.length / SRX.rate;
      const nn = fn.replace(/\.wav$/i, '') + '.tda'; out.push({ name: nn, data: srxPack(await srxEncode(x)) }); m.files[k] = nn;
    }
    if (t.files && t.files.cam) { const f = files.find(x => x.name === t.files.cam); if (f) { out.push(f); m.files.cam = t.files.cam; } }
    if (m.files.dry) takes.push(m);
  }
  out.unshift({ name: 'arrangement.json', data: new TextEncoder().encode(JSON.stringify({ format: 'the-daily-recordings', version: 1, app: BRAND.name + ' ' + VERSION, takes })) });
  return { blob: zipBuild(out), takes: takes.length, secs };
}
async function srxSeal(blob) {
  const raw = crypto.getRandomValues(new Uint8Array(32)), key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await blob.arrayBuffer())), out = new Uint8Array(16 + ct.length);
  out.set(SRX.magic); out.set(iv, 4); out.set(ct, 16); return { body: out, key: slB64(raw) };
}
async function srxUnseal(u, k) {
  if (u.length < 32 || SRX.magic.some((b, i) => u[i] !== b)) throw srxErr('bad', 'the recordings are damaged'); const raw = slUnB64(k); if (raw.length !== 32) throw srxErr('bad', 'the link’s key is damaged');
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  try { return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(4, 16) }, key, u.subarray(16))); } catch (e) { throw srxErr('bad', 'the recordings could not be unlocked (part of the link may be missing)'); }
}
const SRX_WHY = { 'sign-in': 'Sign in with GitHub first (Settings ▸ GitHub): sending recordings needs an account.', 'limit-you': 'You have sent recordings 10 times today, the most for one day. Try again tomorrow.', 'limit-all': 'The studio has sent as many recordings as it can today. Try again tomorrow.', 'too-big': 'The recordings are more than 25 MB, even compressed. Delete takes you don’t need, then try again.', 'not-set-up': 'Sending recordings isn’t switched on for this site yet.', 'origin': 'Sending recordings only works on the-daily.studio itself.' };
/** pack, seal and send the open song's takes; the link's attachment comes back */
async function srxSend(onStep) {
  if (!srxCan()) throw srxErr('browser', 'This browser can’t compress audio for a link. Chrome, Edge, Firefox and Safari 26 or later can.');
  if (!ghTok()) throw srxErr('sign-in', SRX_WHY['sign-in']); if (!TAKES.length) throw srxErr('none', 'This song has no recordings yet.');
  const b = await srxBundle((i, n) => onStep && onStep('Compressing take ' + i + ' of ' + n + '…')), s = await srxSeal(b.blob);
  if (s.body.length > SRX.max) throw srxErr('too-big', SRX_WHY['too-big']);
  onStep && onStep('Sending ' + projBytes(s.body.length) + ' (encrypted)…');
  const tok = await ghToken(); let r, j = {};
  try { r = await fetch('/share/put', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/octet-stream' }, body: s.body, cache: 'no-store' }); j = await r.json().catch(() => ({})); } catch (e) { throw srxErr('offline', 'The recordings could not be sent. Are you online?'); }
  if (!r.ok || !j.ref) throw srxErr(j.error || 'http', SRX_WHY[j.error] || 'The recordings could not be sent (' + (j.error || r.status) + ').');
  return { att: j.ref + '.' + s.key, ref: j.ref, exp: j.exp, takes: b.takes, secs: b.secs, bytes: s.body.length };
}
/** take a share back before it runs out (the sender's own account only) */
async function srxTakeBack(ref) {
  const tok = await ghToken(); const r = await fetch('/share/delete', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ ref }), cache: 'no-store' });
  if (!r.ok) throw srxErr('http', 'It could not be taken back (' + r.status + ').');
}

/* ---------- receiving ---------- */
/** a take from someone else, kept to what a take can hold */
function srxCleanTake(m, used) {
  const num = (v, lo, hi, d) => Number.isFinite(+v) ? clamp(+v, lo, hi) : d, str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').slice(0, n);
  let id = /^[\w-]{1,40}$/.test(m && m.id) ? m.id : 'tk' + Math.random().toString(36).slice(2, 9); while (used.has(id)) id += 'x'; used.add(id);
  const fx = m && m.fx && typeof m.fx === 'object' ? Object.fromEntries(FX_KEYS.filter(k => Number.isFinite(+m.fx[k])).map(k => [k, clamp(+m.fx[k], 0, 1)])) : null;
  return { id, hum: !!m.hum, kind: /^[a-z]{2,8}$/.test(m.kind) ? m.kind : 'gtr', name: str(m.name, 60) || 'Take', startSec: num(m.startSec, 0, 36000, 0), g: num(m.g, 0, 4, 1), pan: num(m.pan, -1, 1, 0), fx: fx && fxOn(fx) ? fx : null,
    mute: !!m.mute, solo: !!m.solo, mode: m.mode === 'wet' ? 'wet' : 'dry', bpm: Number.isFinite(+m.bpm) ? clamp(+m.bpm, 20, 400) : undefined, preset: str(m.preset, 40), fadeIn: num(m.fadeIn, 0, 60, 0), fadeOut: num(m.fadeOut, 0, 60, 0), cg: num(m.cg, 0, 8, 1), t: num(m.t, 0, 1e13, Date.now()) };
}
/** fetch, unlock and decode a link's recordings: the takes, ready to go in the song's lanes */
async function srxReceive(att, onStep) {
  const m = SRX_ATT.exec(att || ''); if (!m) throw srxErr('bad', 'the link’s recordings part is damaged');
  if (!srxCan()) throw srxErr('browser', 'This browser can’t open recordings from a link (Chrome, Edge, Firefox and Safari 26 or later can).');
  onStep && onStep('Fetching the recordings…'); let r;
  try { r = await fetch('/share/' + m[1], { cache: 'no-store' }); } catch (e) { throw srxErr('offline', 'The recordings could not be fetched. Are you online?'); }
  if (r.status === 404) throw srxErr('gone', 'The recordings in this link have run out (they are kept 7 days) or were taken back.'); if (!r.ok) throw srxErr('http', 'The recordings could not be fetched (' + r.status + ').');
  if (+r.headers.get('Content-Length') > SRX.max + 64) throw srxErr('bad', 'the recordings are bigger than a link can carry');
  const u = new Uint8Array(await r.arrayBuffer()); if (u.length > SRX.max + 64) throw srxErr('bad', 'the recordings are bigger than a link can carry');
  onStep && onStep('Unlocking…'); const z = await zipRead(new Blob([await srxUnseal(u, m[2])])), a = z.get('arrangement.json'); if (!a) throw srxErr('bad', 'there are no recordings in it');
  let arr; try { arr = JSON.parse(new TextDecoder().decode(await a.get())); } catch (e) { throw srxErr('bad', 'the recordings are damaged'); }
  const list = Array.isArray(arr && arr.takes) ? arr.takes.slice(0, SRX.takes) : [], used = new Set(), out = []; let total = 0;
  for (let i = 0; i < list.length; i++) {
    const t = list[i], fd = t && t.files && typeof t.files.dry === 'string' && z.get(t.files.dry); if (!fd) continue; onStep && onStep('Decoding take ' + (i + 1) + ' of ' + list.length + '…');
    const dry = await srxDecodeTake(await fd.get()); total += dry.length; if (total > SRX.rate * SRX.secs) break;
    const fw = typeof t.files.wet === 'string' && z.get(t.files.wet), wet = fw ? await srxDecodeTake(await fw.get()) : null;
    let cam = []; const fc = typeof t.files.cam === 'string' && z.get(t.files.cam); if (fc) { try { const c = JSON.parse(new TextDecoder().decode(await fc.get())); cam = Array.isArray(c) ? c.slice(0, 20000).filter(x => x && Number.isFinite(x.t)) : []; } catch (e) { } }
    const meta = srxCleanTake(t, used); out.push(Object.assign(meta, { sr: SRX.rate, dur: dry.length / SRX.rate, dry, wet: wet && wet.length === dry.length ? wet : null, cam, peaks: peaksOf(dry), _saved: false }));
    if (!out[out.length - 1].wet) out[out.length - 1].mode = 'dry';
  }
  return out;
}
/** put received takes in the open song */
function srxAdd(takes) { takes.forEach(t => TAKES.push(t)); bus.emit('takes'); projDirty(); }
/** someone with the link reports it to the site's owner (the key only if they say so, so the owner can listen) */
async function srxReport(att) {
  const m = SRX_ATT.exec(att || ''); if (!m) return; const why = h('textarea', { class: 'in', id: 'srxWhy', rows: 3, maxlength: 500, placeholder: 'What’s wrong with it?' }), withKey = h('input', { type: 'checkbox', id: 'srxKey', checked: true });
  const old = document.getElementById('srxRep'); if (old) old.remove();
  const d = h('dialog', { class: 'sl-dlg', id: 'srxRep', 'aria-labelledby': 'srxRepH' }, h('h3', { id: 'srxRepH' }, '⚑ Report these recordings'),
    h('p', { class: 'small muted' }, 'The site’s owner checks reports and removes recordings that break the terms. The recordings are encrypted, so the owner can only listen if you include the link’s key.'),
    why, h('label', { class: 'chk small' }, withKey, ' Include the key, so the owner can listen and check'),
    h('div', { class: 'row sl-acts' }, h('button', { class: 'btn primary', id: 'srxSendRep', type: 'button', onclick: async () => {
      try { const r = await fetch('/share/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: m[1], why: why.value.trim(), key: withKey.checked ? m[2] : '' }), cache: 'no-store' }); if (!r.ok) throw new Error(r.status); d.close(); toast('Reported. Thank you.', 'ok'); } catch (e) { toast('The report could not be sent (' + (e.message || e) + ').', 'bad'); }
    } }, 'Send report'), h('span', { class: 'grow' }), h('button', { class: 'btn', type: 'button', onclick: () => d.close() }, 'Cancel')));
  d.addEventListener('close', () => d.remove()); document.body.append(d); d.showModal(); why.focus();
}

/* ---------- in the send dialog (part 89) ---------- */
/** the "Include my recordings" row: sends once, and the link carries the recordings from then on */
function srxRow(rebuild) {
  SRS.att = ''; SRS.ref = ''; SRS.exp = 0; SRS.busy = null; SRS.err = '';
  const n = TAKES.length; if (!n) return null;
  const secs = TAKES.reduce((a, t) => a + (t.dur || 0), 0), can = srxCan(), signed = !!ghTok();
  const say = h('p', { class: 'tiny', id: 'srxSay', 'aria-live': 'polite' }), box = h('input', { type: 'checkbox', id: 'srxOn', disabled: !can });
  const back = h('button', { class: 'btn', id: 'srxBack', type: 'button', hidden: true, onclick: async () => { back.disabled = true; try { await srxTakeBack(SRS.ref); SRS.att = SRS.ref = ''; box.checked = false; back.hidden = true; say.textContent = 'Taken back: the recordings are deleted, and the link no longer has them.'; rebuild(); } catch (e) { say.textContent = e.message; } finally { back.disabled = false; } } }, 'Take them back');
  box.addEventListener('change', async () => {
    if (box.checked && CFG.shareOk !== SHARE_TERMS) { box.checked = false; shareGate(() => { box.checked = true; box.dispatchEvent(new Event('change')); }); return; }      /* the terms, once, as for any share */
    if (!box.checked) { if (SRS.ref) say.textContent = 'The link no longer carries the recordings. (They stay on the site until ' + srxDate(srxUntil(SRS.ref)) + ' unless you take them back.)'; SRS.att = ''; rebuild(); return; }
    if (SRS.ref && SRS.keep) { SRS.att = SRS.keep; rebuild(); say.textContent = '✓ The link carries your recordings until ' + srxDate(srxUntil(SRS.ref)) + '.'; return; }
    box.disabled = true; say.style.color = '';
    SRS.busy = srxSend(t => { say.textContent = t; }).then(x => { SRS.att = SRS.keep = x.att; SRS.ref = x.ref; SRS.exp = x.exp; say.textContent = '✓ ' + x.takes + (x.takes === 1 ? ' take (' : ' takes (') + fmtT(x.secs) + ', ' + projBytes(x.bytes) + (x.takes === 1 ? ') goes' : ') go') + ' with the link until ' + srxDate(new Date(x.exp)) + '.'; back.hidden = false; })
      .catch(e => { box.checked = false; say.textContent = e.message; say.style.color = 'var(--bad)'; if (e.code === 'sign-in') say.append(' ', h('button', { class: 'btn small', type: 'button', onclick: () => { try { document.getElementById('slDlg').close(); openSettings('github'); } catch (x) { } } }, 'Sign in…')); })
      .finally(() => { box.disabled = false; SRS.busy = null; rebuild(); });
    rebuild();
  });
  return h('div', { class: 'srx-row', id: 'srxRow' },
    h('label', { class: 'chk' }, box, ' 🎙 Include my recordings (' + n + (n === 1 ? ' take' : ' takes') + ', ' + fmtT(secs) + ')'),
    h('p', { class: 'tiny muted' }, !can ? 'This browser can’t compress audio for a link. Chrome, Edge, Firefox and Safari 26 or later can.' : (signed ? '' : 'Needs Sign in with GitHub (Settings ▸ GitHub). ') + 'They are compressed and encrypted here, kept on the site for 7 days, then deleted. Only people with the link can play them. Your backing track isn’t sent.'),
    say, back);
}
