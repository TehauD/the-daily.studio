/* ============================================================
   Part 39b · THE TIP JAR (an open guitar case)
   An artist pastes their own tip link (a Ko-fi, PayPal.me, Venmo, Cash App, Buy Me a Coffee, Patreon or Bandcamp page, any https
   address, a @venmo-name or a $cashtag) and the studio shows it as a QR code in a small open guitar case:
     · on the Visuals, so it is in every stage video (and the Audience view);
     · on the Stage, so the room can scan it from the projector or the pop-out window;
     · on share pages, as a button and a code;
     · on a printed sign for a real guitar case, and as a picture to post.
   It can show all the time or only between songs, in any corner, in three sizes.
   OFF BY DEFAULT. It is set up from 🎬 Creator Studio ▸ 🎸 Tip jar; until then nothing about it shows anywhere else. Once it is
   set up (a link saved and the terms agreed), a 🎸 Tips button appears in the Visuals and Stage bars to switch it on and off.
   Money goes straight from the audience to the service the artist chose. The studio never opens the link, never sees a
   payment and takes nothing. The link lives in this browser's settings, not in songs, backups or share files other than
   the share page itself, and the AI agent tools cannot read or change it (a payment link is not something to hand to an agent).
   ============================================================ */
const TIP_TERMS = 1;   /* raise when the wording below changes, so it is asked again */
const TIP_DEF = { on: false, link: '', name: '', msg: 'Enjoying the music? Leave a tip', where: { vis: true, stage: true, share: true }, corner: 'br', size: 'm', when: 'always' };
CFG.tip = Object.assign({}, TIP_DEF, CFG.tip && typeof CFG.tip === 'object' ? CFG.tip : {}); CFG.tip.where = Object.assign({}, TIP_DEF.where, CFG.tip.where || {});
const TIP = { qr: null, qrFor: '', cards: new Map(), a: { vis: 0, aud: 0, stage: 0 } };   /* cards: the drawn case at each size in use (the Visuals and the Stage differ), a few at most */
const TIP_SIZES = [['s', 'Small', .26], ['m', 'Medium', .34], ['l', 'Large', .46]];
const TIP_CORNERS = [['br', 'Bottom right'], ['bl', 'Bottom left'], ['tr', 'Top right'], ['tl', 'Top left']];

/** a tip link made safe: https only, no user name or password in it. '@name' becomes a Venmo profile link (venmo.com/u/name, Venmo's share-link
    form; Venmo names are 5 to 30 letters, digits, - and _), '$name' a Cash App link, and 'ko-fi.com/x' gets the https scheme added. '' when empty, null when not usable */
function tipLink(raw) {
  let s = String(raw == null ? '' : raw).trim(); if (!s) return '';
  if (/^@[A-Za-z0-9][A-Za-z0-9_-]{4,29}$/.test(s)) s = 'https://venmo.com/u/' + s.slice(1);
  else if (/^\$[A-Za-z][A-Za-z0-9_-]{0,29}$/.test(s)) s = 'https://cash.app/' + s;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(s) && /^[^\s/:@]+\.[^\s/:@]{2,}/.test(s)) s = 'https://' + s;
  let u; try { u = new URL(s); } catch (e) { return null; }
  if (u.protocol !== 'https:' || !/\.[a-z]{2,}$/i.test(u.hostname) || u.username || u.password) return null;
  return u.href.length > 300 ? null : u.href;
}
/** the link as people read it: no https://, no www., no trailing slash */
function tipShort(link) { let s = String(link || '').replace(/^https:\/\//, '').replace(/^www\./, '').replace(/\/$/, ''); try { s = decodeURI(s); } catch (e) { } return s.length > 42 ? s.slice(0, 40) + '…' : s; }
const tipOk = () => CFG.tipOk === TIP_TERMS;
/** the saved link, made safe (worked out again only when it changes: this is asked on every frame) */
const TIPL = { raw: null, out: '' };
const tipNow = () => { if (TIPL.raw !== CFG.tip.link) { TIPL.raw = CFG.tip.link; TIPL.out = tipLink(CFG.tip.link); } return TIPL.out; };
/** set up in Creator Studio: a usable link saved and the terms agreed (the 🎸 Tips buttons in the Visuals and Stage bars appear only then) */
const tipSetUp = () => !!(tipOk() && tipNow());
/** set up, agreed to and switched on */
const tipReady = () => !!(CFG.tip.on && tipOk() && tipNow());
const tipName = () => String(CFG.tip.name || '').trim();
const tipMsg = () => String(CFG.tip.msg || '').trim() || TIP_DEF.msg;
function tipQr() { const l = tipNow(); if (!l) return null; if (TIP.qrFor !== l) { TIP.qr = qrMake(l); TIP.qrFor = l; TIP.cards.clear(); } return TIP.qr; }

/* ---------- the card: an open guitar case with the code inside ---------- */
function tipRound(g, x, y, w, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
/** write text on one line, made smaller (down to min) to fit w, and cut with … if it still does not fit */
function tipFit(g, txt, x, y, w, px, min, weight) {
  let s = Math.round(px); g.font = `${weight || 700} ${s}px system-ui,-apple-system,Segoe UI,Roboto,sans-serif`;
  while (s > min && g.measureText(txt).width > w) { s--; g.font = `${weight || 700} ${s}px system-ui,-apple-system,Segoe UI,Roboto,sans-serif`; }
  let t = txt; while (t.length > 1 && g.measureText(t).width > w) t = t.slice(0, -2) + '…';
  g.fillText(t, x, y);
}
/** the card, px pixels tall (cached until the link, the words or the size change) */
function tipCard(px) {
  const qr = tipQr(); if (!qr) return null; px = Math.round(px);
  const key = [TIP.qrFor, tipName(), tipMsg(), px].join('|'), had = TIP.cards.get(key); if (had) return had;
  const cw = Math.round(px * .78), cv = document.createElement('canvas'); cv.width = cw; cv.height = px;
  const g = cv.getContext('2d');
  const li = px * .03, pad = px * .07, q = cw - pad * 2, top = px * .17;
  /* the case: a dark shell, then the plush lining */
  tipRound(g, 0, 0, cw, px, px * .08); g.fillStyle = '#1b130d'; g.fill(); g.lineWidth = Math.max(1, px * .008); g.strokeStyle = '#4a3523'; g.stroke();
  const lg = g.createLinearGradient(0, 0, 0, px); lg.addColorStop(0, '#8e2546'); lg.addColorStop(1, '#4f1026');
  tipRound(g, li, li, cw - li * 2, px - li * 2, px * .06); g.fillStyle = lg; g.fill();
  g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#f7c95a';
  tipFit(g, tipMsg(), cw / 2, top - px * .045, cw - pad * 2, px * .062, Math.max(8, px * .034), 800);
  /* the code, black on white, with a quiet zone of three modules */
  tipRound(g, pad, top, q, q, q * .05); g.fillStyle = '#fff'; g.fill();
  /* whole pixels per module when there is room (every module the same size); on a small card a fraction, so the code still fills its panel */
  const fit = q / (qr.n + 6), cell = fit >= 4 ? Math.floor(fit) : fit, side = cell * qr.n, ox = Math.round(pad + (q - side) / 2), oy = Math.round(top + (q - side) / 2);
  qrDraw(g, qr, ox, oy, cell); cv.qrBox = { x: ox, y: oy, cell };
  const nm = tipName(), y1 = top + q + px * .068;
  g.fillStyle = '#fff'; tipFit(g, nm || tipShort(TIP.qrFor), cw / 2, y1, cw - pad * 2, px * .056, Math.max(8, px * .03), 800);
  if (nm) { g.fillStyle = 'rgba(255,255,255,.72)'; tipFit(g, tipShort(TIP.qrFor), cw / 2, y1 + px * .058, cw - pad * 2, px * .036, Math.max(7, px * .025), 600); }
  if (TIP.cards.size >= 4) TIP.cards.delete(TIP.cards.keys().next().value);
  TIP.cards.set(key, cv); return cv;
}
/** draw the case on a picture W×H. where: 'vis' | 'aud' | 'stage'; avoid: rectangles [x, y, w, h] the case should not cover (it moves up or down to clear them) */
function tipDraw(g, W, H, where, avoid) {
  const sh = where === 'stage' ? CFG.tip.where.stage : CFG.tip.where.vis;
  const want = tipReady() && sh && !(CFG.tip.when === 'stopped' && T.playing) ? 1 : 0;
  let a = TIP.a[where] || 0; a += (want - a) * (want ? .12 : .2); if (Math.abs(want - a) < .02) a = want; TIP.a[where] = a;
  if (a < .02) return null;
  const base = Math.min(H, W * .5625), sz = (TIP_SIZES.find(s => s[0] === CFG.tip.size) || TIP_SIZES[1])[2], px = Math.round(base * sz); if (px < 64) return null;
  let card; try { card = tipCard(px); } catch (e) { return null; } if (!card) return null;
  const cw = card.width, ch = card.height, m = Math.round(base * .035), c = CFG.tip.corner || 'br', right = c[1] === 'r', bottom = c[0] === 'b';
  const x = right ? W - m - cw : m; let y = bottom ? H - m - ch : m;
  (avoid || []).forEach(r => { if (r && x < r[0] + r[2] && x + cw > r[0] && y < r[1] + r[3] && y + ch > r[1]) y = bottom ? r[1] - m * .5 - ch : r[1] + r[3] + m * .5; });
  y = clamp(y, 0, Math.max(0, H - ch));
  g.save(); g.globalAlpha = a; g.globalCompositeOperation = 'source-over'; g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = px * .05; g.drawImage(card, Math.round(x), Math.round(y)); g.restore();
  return [x, y, cw, ch];
}
/** what the Visuals draw on top (the small neck, the voice ribbon, the note and chord read-out), so the case can step around them */
function tipVisAvoid(W, H, mode) {
  const r = [], perf = document.body.classList.contains('perform-on'), bare = vzBare(mode);
  if (CFG.vzNeck !== false && !perf && !bare) r.push(neckRect(W, H));
  if (CFG.vzRibbon && !perf && typeof voxRect === 'function') r.push(voxRect(W, H));
  if (!bare) r.push([0, 0, W * .32, H * .13 + 28 + Math.round(20 * Math.min(W, H * 2) / 900)]);
  return r;
}
/** what the Stage's own words cover, so the case can step around them (part 13's HUD, or the lower third) */
function tipStageAvoid(W, H, sc) {
  const ov = (sc && sc.ov) || {}, u = Math.min(W, H * 1.6), r = [];
  if (typeof pbOn === 'function' && pbOn()) { if (STG.pb.lower && typeof pbLowerGeom === 'function') { const lr = pbLowerGeom(W, H); r.push([lr.x, lr.y, lr.w, lr.h]); } return r; }
  if (STG.hud === false) return r;
  if (ov.tuner) r.push([W * .97 - u * .3, H * .93 - u * .06, u * .3, u * .07]);
  if (ov.info || ov.beat) r.push([W * .97 - u * .45, 0, u * .45, H * .2]);
  if (ov.chord) { const sz = u * .14; r.push([W * .04, H * .84 - sz * 1.9, sz * 3.4, sz * 2]); }
  return r;
}

/* ---------- the share page ---------- */
const tipShareCss = () => tipReady() && CFG.tip.where.share ? '.tip{display:flex;gap:16px;align-items:center;margin:18px 0;padding:14px;border-radius:16px;background:linear-gradient(#8e2546,#4f1026);border:4px solid #1b130d;color:#fff}.tip .tq{flex:0 0 132px;background:#fff;border-radius:10px;padding:4px;line-height:0}.tip .tq svg{width:100%;height:auto}.tip b{display:block;color:#f7c95a;font-size:18px}.tip a{display:inline-block;margin-top:8px;padding:8px 14px;border-radius:999px;background:#f7c95a;color:#1b130d;font-weight:800;text-decoration:none}.tip small{display:block;margin-top:8px;opacity:.75;font-size:12px;line-height:1.4}@media print{.tip{background:#fff;color:#000;border-color:#000}.tip b{color:#000}.tip a{background:none;color:#000;padding:0}}' : '';
function tipShareHtml() {
  if (!tipReady() || !CFG.tip.where.share) return '';
  const l = tipLink(CFG.tip.link), nm = tipName(), who = nm || 'the artist';
  return '<aside class="tip" aria-label="Tip ' + shareEsc(who) + '"><div class="tq">' + qrSvg(tipQr(), 3) + '</div><div><b>' + shareEsc(tipMsg()) + '</b>' + (nm ? shareEsc(nm) + '<br>' : '') +
    '<a href="' + shareEsc(l) + '" target="_blank" rel="noopener noreferrer nofollow">Tip ' + shareEsc(who) + ' · ' + shareEsc(tipShort(l)) + ' ↗</a>' +
    '<small>Tips go straight to ' + shareEsc(who) + ' through the service they chose. the-daily.studio is not part of the payment and takes nothing.</small></div></aside>';
}

/* ---------- a sign for a real guitar case, and a picture to post ---------- */
function tipPrint() {
  if (!tipLink(CFG.tip.link)) return toast('Add your tip link first.', 'warn');
  const old = document.getElementById('printSheet'); if (old) old.remove();
  const l = tipLink(CFG.tip.link), nm = tipName();
  const d = h('div', { id: 'printSheet', class: 'tip-sign', 'aria-hidden': 'true' });
  d.innerHTML = '<div class="ts-m">' + shareEsc(tipMsg()) + '</div>' + (nm ? '<h1>' + shareEsc(nm) + '</h1>' : '') + '<div class="ts-q">' + qrSvg(tipQr(), 4) + '</div><div class="ts-l">' + shareEsc(tipShort(l)) + '</div><div class="ts-n">Scan with your phone’s camera. Tips go straight to ' + shareEsc(nm || 'the artist') + '.</div>';
  document.body.append(d); document.body.classList.add('printing-sheet');
  const done = () => { document.body.classList.remove('printing-sheet'); const x = document.getElementById('printSheet'); if (x) x.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); setTimeout(() => { try { window.print(); } catch (e) { done(); } if (!('onafterprint' in window)) setTimeout(done, 2000); }, 60);
}
function tipPng() {
  let c; try { c = tipCard(1200); } catch (e) { c = null; } if (!c) return toast('Add your tip link first.', 'warn');
  c.toBlob(b => { if (!b) return toast('Could not make the picture.', 'bad'); download('tip-jar_' + (tipName() || 'qr').replace(/\W+/g, '_') + '.png', b); toast('Saved the tip jar as a picture. Post it, or add it to a video.', 'ok'); }, 'image/png');
  TIP.cards.clear();   /* the 1200-pixel copy is not kept */
}

/* ---------- setting it up ---------- */
/** the 🎸 Tips button for a toolbar (lit while the case is showing); cls: the bar's button class. Hidden until the tip jar is set up in Creator Studio */
function tipBtn(cls) {
  return h('button', { class: (cls || 'btn sm') + (tipReady() ? ' on' : ''), 'data-tipbtn': '1', title: 'Tip jar: a QR code your audience can scan to tip you', style: { display: tipSetUp() ? '' : 'none' }, onclick: () => tipOpen() }, '🎸 Tips');
}
const tipSync = () => { $$('[data-tipbtn]').forEach(b => { b.classList.toggle('on', tipReady()); b.style.display = tipSetUp() ? '' : 'none'; }); TIP.cards.clear(); if (typeof goalSync === 'function') goalSync(); };
function tipOpen() {
  const T0 = CFG.tip, save = () => { saveCfg(); tipSync(); paint(); };
  const prev = h('canvas', { class: 'tip-prev', width: 234, height: 300, role: 'img', 'aria-label': 'How the tip jar looks' });
  const msgLine = h('div', { class: 'tiny', id: 'tipLinkNote', 'aria-live': 'polite' });
  const onChk = h('input', { type: 'checkbox', id: 'tipOn', checked: !!T0.on, onchange: e => { T0.on = e.target.checked; save(); } });
  const agree = h('input', { type: 'checkbox', id: 'tipAgree', checked: tipOk(), onchange: e => { if (e.target.checked) CFG.tipOk = TIP_TERMS; else delete CFG.tipOk; save(); } });
  const linkIn = h('input', { class: 'in', id: 'tipLink', type: 'url', inputmode: 'url', autocomplete: 'off', spellcheck: false, maxlength: 300, value: T0.link || '', placeholder: 'ko-fi.com/you · paypal.me/you · @venmo-name · $cashtag',
    oninput: e => { T0.link = e.target.value.trim(); save(); } });
  const test = h('button', { class: 'btn sm', id: 'tipTest', title: 'Open your link in a new tab to check it goes to the right place', onclick: () => { const l = tipLink(T0.link); if (l) window.open(l, '_blank', 'noopener,noreferrer'); } }, 'Test the link ↗');
  const nameIn = h('input', { class: 'in', id: 'tipName', maxlength: 48, value: T0.name || '', placeholder: S.artist || 'Your name or band', oninput: e => { T0.name = e.target.value; save(); } });
  const msgIn = h('input', { class: 'in', id: 'tipMsg', maxlength: 48, value: T0.msg || '', placeholder: TIP_DEF.msg, oninput: e => { T0.msg = e.target.value; save(); } });
  const where = (k, label) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', 'data-tw': k, checked: T0.where[k] !== false, onchange: e => { T0.where[k] = e.target.checked; save(); } }), label);
  const seg = (opts, k, id) => h('div', { class: 'seg', role: 'group', id }, opts.map(([v, t]) => h('button', { type: 'button', class: T0[k] === v ? 'on' : '', 'data-v': v, onclick: e => { T0[k] = v; $$('button', e.currentTarget.parentNode).forEach(b => b.classList.toggle('on', b === e.currentTarget)); save(); } }, t)));
  function paint() {
    const l = tipLink(T0.link), ready = tipReady();
    msgLine.textContent = l === null ? 'That does not look like a web address. Use the https link of your tip page, your @venmo-name or your $cashtag.' : l ? 'The code opens ' + l : 'Paste the link people should go to.';
    msgLine.style.color = l === null ? 'var(--bad)' : ''; test.disabled = !l; onChk.disabled = !l || !tipOk();
    if (onChk.disabled && T0.on) onChk.checked = false; else onChk.checked = !!T0.on;
    $$('[data-tipneed]', box).forEach(b => { b.disabled = !l; });
    stat.textContent = ready ? 'Showing' + (T0.where.vis ? ' · Visuals and stage videos' : '') + (T0.where.stage ? ' · Stage' : '') + (T0.where.share ? ' · share pages' : '') : !l ? 'Add your link to start.' : !tipOk() ? 'Tick the box above to switch it on.' : 'Off.';
    const g = prev.getContext('2d'); g.clearRect(0, 0, prev.width, prev.height);
    let c = null; try { c = l ? tipCard(prev.height) : null; } catch (e) { c = null; }
    if (c) g.drawImage(c, Math.round((prev.width - c.width) / 2), 0); else { g.fillStyle = 'rgba(128,128,128,.25)'; tipRound(g, 0, 0, prev.width, prev.height, 18); g.fill(); g.fillStyle = 'rgba(128,128,128,.9)'; g.font = '600 13px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText('Your code shows here', prev.width / 2, prev.height / 2); }
  }
  const stat = h('div', { class: 'tiny muted', id: 'tipStatus' });
  const box = h('div', { class: 'tip-set' },
    h('p', { class: 'tiny muted', style: { margin: '0 0 10px', lineHeight: 1.5 } }, 'Put your tip link on the stage, in your videos and on your share pages as a QR code in an open guitar case. Your audience scans it with a phone camera and tips you directly. It stays off until you switch it on here; once it is set up, a 🎸 Tips button in the Visuals and Stage bars brings you back.'),
    h('div', { class: 'tip-grid' },
      h('div', { class: 'tip-f' },
        pField('Your tip link', linkIn), h('div', { class: 'row', style: { gap: '8px', alignItems: 'center', margin: '-4px 0 8px', flexWrap: 'wrap' } }, test, msgLine),
        pField('Your name or band (optional)', nameIn), pField('Message', msgIn),
        h('label', { class: 'chk tip-agree' }, agree, ' This is my own tip or payment link. Tips go straight from my audience to me through the service I chose. the-daily.studio is not part of the payment, takes nothing, and is not responsible for the service, the payments or any taxes on them; I am. ', h('a', { href: 'legal/#terms', target: '_blank', rel: 'noopener' }, 'Terms of use')),
        h('label', { class: 'chk', style: { fontWeight: 700 } }, onChk, ' Show the tip jar'), stat,
        h('h5', { style: { margin: '12px 0 4px' } }, 'Where'),
        where('vis', 'On the Visuals and in stage videos (and the Audience view)'), where('stage', 'On the Stage, the projector and the pop-out window'), where('share', 'On share pages (a button and a code)'),
        h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px' } },
          pField('When', pSel([['always', 'All the time'], ['stopped', 'Only between songs (while stopped)']], T0.when, v => { T0.when = v; save(); })),
          pField('Corner', pSel(TIP_CORNERS, T0.corner, v => { T0.corner = v; save(); }))),
        h('div', { class: 'row', style: { gap: '8px', alignItems: 'center', marginTop: '6px' } }, h('span', { class: 'tiny muted' }, 'Size'), seg(TIP_SIZES.map(s => [s[0], s[1]]), 'size', 'tipSize'))),
      h('div', { class: 'tip-side' }, prev,
        h('button', { class: 'btn sm', id: 'tipPrint', 'data-tipneed': '1', title: 'A sign with a large code for your real guitar case or merch table', onclick: tipPrint }, '🖨 Print a sign'),
        h('button', { class: 'btn sm', id: 'tipPng', 'data-tipneed': '1', title: 'The tip jar as a picture to post or add to a video', onclick: tipPng }, '⤓ Save as a picture'))),
    h('p', { class: 'tiny muted', style: { margin: '10px 0 0', lineHeight: 1.5 } }, 'The code is made on this device. The studio never opens your link and never sees a payment. Anyone who scans it goes to the service you chose, under that service’s terms. AI agent tools cannot read or change your link.'));
  pdlg('tipjar', 'TIP JAR', box, { wide: true, onclose: () => { tipSync(); if (typeof renderStageUI === 'function') renderStageUI(); } });
  paint();
}
