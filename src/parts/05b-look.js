/* ============================================================
   Part 05b · LOOK — appearance system
   Light / dark / follow-system, 15 palettes, accent colours (and any colour you pick), density, corner style, surfaces,
   typeface, contrast and colour-blind-safe data colours, plus one-click "looks". Everything is computed here and written to
   CSS variables on <html>, so every canvas, meter and panel follows. Fonts are bundled (Inter and Montserrat, SIL OFL) or the ones already on the device.
   ============================================================ */
const LOOK_DEF = { lookMode: 'auto', palLight: 'dsday', palDark: 'dsnight', accent: 'auto', accentC: '', density: 'comfortable', corners: 'soft', surface: 'soft', font: 'brand', contrast: 'standard', data: 'standard' };
const PALETTES = [
  { id: 'dsday', mode: 'light', name: 'Daily Light', a2: '#b07a1e', cv: ['#b8741a', '#4a67c2', '#9a7d10', '#b5486a'], c: { bg: '#e9e9e6', bg2: '#dededa', panel: '#f4f4f1', panel2: '#fbfbf9', raise: '#ffffff', line: '#d6d8d3', line2: '#b8beb7', text: '#0d0f10', muted: '#4f5c56', accent: '#2f7a58' } },
  { id: 'porcelain', mode: 'light', name: 'Porcelain', c: { bg: '#eceff2', bg2: '#e2e7eb', panel: '#f6f8fa', panel2: '#ffffff', raise: '#ffffff', line: '#d5dce1', line2: '#b6c2c9', text: '#0c181c', muted: '#566b73', accent: '#0a8c97' } },
  { id: 'paper', mode: 'light', name: 'Paper', c: { bg: '#f0ebe1', bg2: '#e7e0d1', panel: '#f9f5ec', panel2: '#fffdf8', raise: '#ffffff', line: '#ddd3c0', line2: '#c2b59d', text: '#2a2218', muted: '#6a5d44', accent: '#b4532a' } },
  { id: 'sage', mode: 'light', name: 'Sage', c: { bg: '#e8eee7', bg2: '#dde6dc', panel: '#f3f7f2', panel2: '#fdfefd', raise: '#ffffff', line: '#cdd8ca', line2: '#acbca8', text: '#13231a', muted: '#566a5a', accent: '#2e7d55' } },
  { id: 'lilac', mode: 'light', name: 'Lilac', c: { bg: '#edeaf4', bg2: '#e3dfee', panel: '#f7f5fc', panel2: '#fefeff', raise: '#ffffff', line: '#d8d2e6', line2: '#b9b0d2', text: '#1c1730', muted: '#625980', accent: '#6a4fd1' } },
  { id: 'harbor', mode: 'light', name: 'Harbor', c: { bg: '#e6eef6', bg2: '#dae5f0', panel: '#f3f7fb', panel2: '#ffffff', raise: '#ffffff', line: '#cbd9e6', line2: '#a8bdd1', text: '#0d1b2a', muted: '#52677c', accent: '#1f6fd1' } },
  { id: 'blush', mode: 'light', name: 'Blush', c: { bg: '#f5ebeb', bg2: '#ecdcdc', panel: '#fcf6f6', panel2: '#fffdfd', raise: '#ffffff', line: '#e5d2d2', line2: '#cdaeb0', text: '#2b1a1c', muted: '#7a5a5e', accent: '#c2415a' } },
  { id: 'daylight', mode: 'light', name: 'Daylight HC', c: { bg: '#ffffff', bg2: '#f0f0f0', panel: '#ffffff', panel2: '#ffffff', raise: '#ffffff', line: '#6a777c', line2: '#1f2a2e', text: '#000000', muted: '#2f3f45', accent: '#005f73' } },
  { id: 'dsnight', mode: 'dark', name: 'Daily Night', a2: '#d4a25a', cv: ['#d4a25a', '#8da9e8', '#e9d27a', '#d98aa2'], c: { bg: '#0d0f10', bg2: '#111413', panel: '#151a18', panel2: '#1b221f', raise: '#232c28', line: '#222b27', line2: '#33423b', text: '#e8e8e6', muted: '#8fa497', accent: '#7dbf9b' } },
  { id: 'ink', mode: 'dark', name: 'Ink', c: { bg: '#070c0f', bg2: '#0a1114', panel: '#0e161a', panel2: '#121d22', raise: '#182429', line: '#1c2a30', line2: '#2c4149', text: '#e5eff1', muted: '#87a0a6', accent: '#3de0cf' } },
  { id: 'midnight', mode: 'dark', name: 'Midnight', c: { bg: '#080b14', bg2: '#0b1020', panel: '#0f1526', panel2: '#141b30', raise: '#1a2340', line: '#212b47', line2: '#34416a', text: '#e6ebf8', muted: '#8e9bc0', accent: '#6ea8ff' } },
  { id: 'graphite', mode: 'dark', name: 'Graphite', c: { bg: '#0d0e10', bg2: '#121316', panel: '#17181c', panel2: '#1d1f24', raise: '#24272d', line: '#2a2d34', line2: '#3d424b', text: '#ececf0', muted: '#9a9fab', accent: '#5fd4b8' } },
  { id: 'plum', mode: 'dark', name: 'Plum', c: { bg: '#0e0a12', bg2: '#130e19', panel: '#17101d', panel2: '#1d1526', raise: '#261c33', line: '#2d2139', line2: '#46345a', text: '#efe6f6', muted: '#a592b8', accent: '#d79bff' } },
  { id: 'forest', mode: 'dark', name: 'Forest', c: { bg: '#0a100c', bg2: '#0d1610', panel: '#101a13', panel2: '#15221a', raise: '#1b2c21', line: '#1f3326', line2: '#335040', text: '#e4f0e8', muted: '#86a692', accent: '#7be08f' } },
  { id: 'ember', mode: 'dark', name: 'Ember', c: { bg: '#110c0a', bg2: '#16100d', panel: '#1b1310', panel2: '#221815', raise: '#2c201b', line: '#33241e', line2: '#54392e', text: '#f3e8e2', muted: '#b09484', accent: '#ff9a52' } },
  { id: 'oled', mode: 'dark', name: 'OLED black', c: { bg: '#000000', bg2: '#000000', panel: '#060606', panel2: '#0b0b0b', raise: '#141414', line: '#202020', line2: '#353535', text: '#f2f2f2', muted: '#9a9a9a', accent: '#3de0cf' } },
  { id: 'nightHC', mode: 'dark', name: 'Night HC', c: { bg: '#000000', bg2: '#000000', panel: '#000000', panel2: '#0a0a0a', raise: '#141414', line: '#7d8d93', line2: '#b4c2c7', text: '#ffffff', muted: '#d0dadd', accent: '#5ff0e0' } }
];
const ACCENTS = [
  { id: 'auto', name: 'Palette default' }, { id: 'lagoon', name: 'Lagoon', c: '#0a8c97' }, { id: 'cobalt', name: 'Cobalt', c: '#2f64e0' }, { id: 'sky', name: 'Sky', c: '#0b84d8' },
  { id: 'violet', name: 'Violet', c: '#6a45e0' }, { id: 'magenta', name: 'Magenta', c: '#c0359a' }, { id: 'rose', name: 'Rose', c: '#d6355a' }, { id: 'coral', name: 'Coral', c: '#e0562f' },
  { id: 'amber', name: 'Amber', c: '#d99100' }, { id: 'lime', name: 'Lime', c: '#6f9d12' }, { id: 'emerald', name: 'Emerald', c: '#1c9a63' }, { id: 'slate', name: 'Slate', c: '#5b6b79' }
];
const LK_FONTS = {
  brand: ['the-daily.studio (Inter + Montserrat)', null],
  system: ['System UI', 'system-ui,"Segoe UI Variable Text","Segoe UI",-apple-system,Roboto,"Helvetica Neue",Arial,sans-serif'],
  humanist: ['Humanist', 'Seravek,"Gill Sans Nova","Avenir Next",Candara,Optima,"Trebuchet MS",system-ui,sans-serif'],
  rounded: ['Rounded', 'ui-rounded,"SF Pro Rounded",Nunito,"Varela Round","Hiragino Maru Gothic ProN","Arial Rounded MT Bold",system-ui,sans-serif'],
  editorial: ['Editorial serif', 'Charter,"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif'],
  legible: ['High legibility', '"Atkinson Hyperlegible",Verdana,Tahoma,"Segoe UI",system-ui,sans-serif'],
  mono: ['Instrument (mono)', 'ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace']
};
const LOOKS = [
  { id: 'signature', name: 'the-daily.studio', note: 'Sage and gold on charcoal', set: { lookMode: 'auto', palLight: 'dsday', palDark: 'dsnight', accent: 'auto', density: 'comfortable', corners: 'soft', surface: 'soft', font: 'brand', contrast: 'standard', data: 'standard', ui: 1 } },
  { id: 'clinical', name: 'Clinical', note: 'Cool, flat, precise', set: { lookMode: 'light', palLight: 'porcelain', accent: 'auto', density: 'compact', corners: 'soft', surface: 'flat', font: 'brand', contrast: 'standard', data: 'standard', ui: 1 } },
  { id: 'studio', name: 'Studio night', note: 'Ink teal, softly lit', set: { lookMode: 'dark', palDark: 'ink', accent: 'auto', density: 'comfortable', corners: 'soft', surface: 'soft', font: 'brand', contrast: 'standard', data: 'standard', ui: 1 } },
  { id: 'notebook', name: 'Notebook', note: 'Warm paper, serif', set: { lookMode: 'light', palLight: 'paper', accent: 'auto', density: 'comfortable', corners: 'round', surface: 'flat', font: 'editorial', contrast: 'standard', data: 'standard', ui: 1.05 } },
  { id: 'calm', name: 'Calm', note: 'Sage, rounded, airy', set: { lookMode: 'light', palLight: 'sage', accent: 'auto', density: 'spacious', corners: 'round', surface: 'soft', font: 'rounded', contrast: 'standard', data: 'standard', ui: 1.05 } },
  { id: 'midnightlook', name: 'Midnight', note: 'Deep blue, crisp', set: { lookMode: 'dark', palDark: 'midnight', accent: 'auto', density: 'comfortable', corners: 'soft', surface: 'soft', font: 'brand', contrast: 'standard', data: 'standard', ui: 1 } },
  { id: 'stage', name: 'Stage', note: 'OLED, large, high contrast', set: { lookMode: 'dark', palDark: 'oled', accent: 'amber', density: 'spacious', corners: 'sharp', surface: 'flat', font: 'legible', contrast: 'high', data: 'standard', ui: 1.2 } },
  { id: 'access', name: 'Accessible', note: 'High contrast, colour-blind safe', set: { lookMode: 'light', palLight: 'daylight', accent: 'cobalt', density: 'spacious', corners: 'soft', surface: 'flat', font: 'legible', contrast: 'high', data: 'cvd', ui: 1.15 } }
];

/* colour helpers */
const lkRgb = x => { const m = /^#?([0-9a-f]{6})$/i.exec(x || ''); const n = m ? parseInt(m[1], 16) : 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const lkHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const lkMix = (a, b, t) => { const x = lkRgb(a), y = lkRgb(b); return lkHex(x.map((v, i) => v + (y[i] - v) * t)); };
const lkLum = x => { const [r, g, b] = lkRgb(x).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
const lkContrast = (a, b) => { const x = lkLum(a), y = lkLum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
function lkFit(col, bg, dark, softT) {   // make the accent readable as TEXT (4.5:1) on both the surface and its own tint
  let c = col, i = 0; const ok = x => lkContrast(x, bg) >= 4.5 && lkContrast(x, lkMix(bg, x, softT || .15)) >= 4.5;
  while (!ok(c) && i++ < 60) c = lkMix(c, dark ? '#ffffff' : '#000000', .05); return c;
}
const lkInk = acc => lkContrast(acc, '#ffffff') >= lkContrast(acc, '#06100f') ? '#ffffff' : '#06100f';

function lookInit() {
  const raw = store.get('cfg', {});
  if (CFG.lookMode === undefined) CFG.lookMode = raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : LOOK_DEF.lookMode;
  Object.keys(LOOK_DEF).forEach(k => { if (CFG[k] === undefined) CFG[k] = LOOK_DEF[k]; });
  if (CFG.accent === 'lagoon') CFG.accent = 'auto';
}
const lkSys = () => { try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; } };
function applyAppearance() {
  lookInit();
  const r = document.documentElement, st = r.style, mode = CFG.lookMode === 'auto' ? (lkSys() ? 'dark' : 'light') : CFG.lookMode, dark = mode === 'dark';
  CFG.theme = mode;
  const pal = PALETTES.find(p => p.id === (dark ? CFG.palDark : CFG.palLight)) || PALETTES.find(p => p.mode === mode), P = Object.assign({}, pal.c);
  if (CFG.contrast === 'high') { P.text = lkMix(P.text, dark ? '#ffffff' : '#000000', .6); P.muted = lkMix(P.muted, P.text, .5); P.line = lkMix(P.line, P.text, .4); P.line2 = lkMix(P.line2, P.text, .6); }
  P.accent = lkFit(P.accent, P.panel2, dark, dark ? .18 : .15);
  const ac = ACCENTS.find(a => a.id === CFG.accent);
  if (CFG.accent === 'custom' && /^#[0-9a-f]{6}$/i.test(CFG.accentC || '')) P.accent = lkFit(CFG.accentC, P.panel2, dark, dark ? .18 : .15);
  else if (ac && ac.c) P.accent = lkFit(ac.c, P.panel2, dark, dark ? .18 : .15);
  const v = (n, val) => { if (val == null) st.removeProperty(n); else st.setProperty(n, val); };
  ['bg', 'bg2', 'panel', 'panel2', 'raise', 'line', 'line2', 'text', 'muted', 'accent'].forEach(k => v('--' + k, P[k]));
  v('--accent-ink', lkInk(P.accent)); v('--accent-soft', lkMix(P.panel2, P.accent, dark ? .18 : .15)); v('--wave', P.accent);
  v('--grid', lkMix(P.bg, P.line, .75)); v('--meter-bg', lkMix(P.panel2, P.line, dark ? .85 : .7));
  v('--shadow', CFG.surface === 'flat' ? '0 0 0 1px rgba(0,0,0,0)' : dark ? (CFG.surface === 'raised' ? '0 0 0 1px rgba(255,255,255,.05),0 2px 4px rgba(0,0,0,.6),0 16px 36px rgba(0,0,0,.5)' : null) : (CFG.surface === 'raised' ? '0 0 0 1px rgba(12,24,28,.05),0 2px 4px rgba(12,24,28,.12),0 14px 32px rgba(12,24,28,.12)' : null));
  if (CFG.data === 'cvd') {   // Okabe–Ito: distinguishable with every common kind of colour-blindness
    const cv = dark ? ['#56B4E9', '#F0E442', '#CC79A7', '#2FD0A0', '#E69F00'] : ['#0072B2', '#E69F00', '#CC79A7', '#009E73', '#D55E00'];
    cv.forEach((c, i) => v('--cv' + (i + 1), c)); v('--accent2', dark ? '#E69F00' : '#D55E00'); v('--ok', dark ? '#56B4E9' : '#0072B2'); v('--warn', dark ? '#F0E442' : '#B8860B');
  } else ['--cv1', '--cv2', '--cv3', '--cv4', '--cv5', '--accent2', '--ok', '--warn'].forEach(n => v(n, null));
  if (CFG.data !== 'cvd') { v('--cv1', P.accent); if (pal.a2) v('--accent2', pal.a2); if (pal.cv) pal.cv.forEach((c, i) => v('--cv' + (i + 2), c)); }
  const f = LK_FONTS[CFG.font]; v('--sans', f && f[1]); v('--display', CFG.font === 'brand' ? null : f && f[1]);
  st.setProperty('--ui', CFG.ui); st.colorScheme = mode;
  r.dataset.theme = mode; r.dataset.palette = pal.id; r.dataset.density = CFG.density; r.dataset.corners = CFG.corners; r.dataset.surface = CFG.surface; r.dataset.font = CFG.font; r.dataset.contrast = CFG.contrast; delete r.dataset.accent;
  document.body.classList.toggle('reduce', !!CFG.reduce);
  const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.setAttribute('content', P.panel2);
  bus.emit('theme');
}
function setTheme(t) { CFG.lookMode = t; saveCfg(); applyAppearance(); $$('.seg [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t)); bus.emit('look'); }
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (CFG.lookMode === 'auto') applyAppearance(); }); } catch (e) { }

/* ---------- the Appearance panel (a side drawer, so you watch the app change as you choose) ---------- */
function lookApply(set) { Object.assign(CFG, set); saveCfg(); applyAppearance(); bus.emit('look'); }
function lookReset() { const keep = { ui: 1 }; lookApply(Object.assign({}, LOOK_DEF, keep, { accentC: '', reduce: false })); }
function lookOpen() {
  lookInit();
  const body = h('div', { class: 'lk' });
  const sw = (p, on) => h('button', { class: 'lk-pal' + (on ? ' on' : ''), title: p.name, onclick: () => { lookApply(p.mode === 'dark' ? { palDark: p.id, lookMode: 'dark' } : { palLight: p.id, lookMode: 'light' }); draw(); } },
    h('span', { class: 'lk-prev', style: { background: p.c.bg } }, h('i', { style: { background: p.c.panel2, borderColor: p.c.line } }, h('b', { style: { background: p.c.accent } }), h('u', { style: { background: p.c.line2 } }), h('u', { style: { background: p.c.line2, width: '60%' } }))), h('span', { class: 'lk-n' }, p.name));
  const seg = (key, opts, extra) => h('div', { class: 'seg lk-seg' }, opts.map(([k, t]) => h('button', { class: CFG[key] === k ? 'on' : '', onclick: () => { lookApply(Object.assign({ [key]: k }, extra || {})); draw(); } }, t)));
  const row = (label, el, hint) => h('div', { class: 'lk-row' }, h('div', { class: 'lk-l' }, h('b', {}, label), hint ? h('span', {}, hint) : null), el);
  function draw() {
    const sc = body.parentElement ? body.parentElement.scrollTop : 0; body.innerHTML = '';
    const effLight = CFG.theme === 'light';
    body.append(
      h('div', { class: 'lk-sec' }, 'LOOKS'), h('div', { class: 'lk-looks' }, LOOKS.map(l => {
        const pl = PALETTES.find(p => p.id === (l.set.lookMode === 'dark' ? l.set.palDark : l.set.palLight)); const ac = ACCENTS.find(a => a.id === l.set.accent);
        return h('button', { class: 'lk-look', onclick: () => { lookApply(Object.assign({ accentC: '' }, l.set)); draw(); } }, h('span', { class: 'lk-prev sm', style: { background: pl.c.bg } }, h('i', { style: { background: pl.c.panel2, borderColor: pl.c.line } }, h('b', { style: { background: (ac && ac.c) || pl.c.accent } }), h('u', { style: { background: pl.c.line2 } }))), h('span', { class: 'lk-n' }, l.name), h('span', { class: 'lk-s' }, l.note));
      })),
      h('div', { class: 'lk-sec' }, 'MODE'), h('div', { class: 'lk-note' }, 'Match system uses your chosen light palette by day and dark palette by night.'), seg('lookMode', [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Match system']]),
      h('div', { class: 'lk-sec' }, 'LIGHT PALETTES' + (effLight ? ' · in use' : '')), h('div', { class: 'lk-pals' }, PALETTES.filter(p => p.mode === 'light').map(p => sw(p, CFG.palLight === p.id))),
      h('div', { class: 'lk-sec' }, 'DARK PALETTES' + (!effLight ? ' · in use' : '')), h('div', { class: 'lk-pals' }, PALETTES.filter(p => p.mode === 'dark').map(p => sw(p, CFG.palDark === p.id))),
      h('div', { class: 'lk-sec' }, 'ACCENT'),
      h('div', { class: 'lk-acc' }, ACCENTS.map(a => h('button', { class: 'lk-dot' + (CFG.accent === a.id ? ' on' : ''), title: a.name, style: a.c ? { background: a.c } : {}, onclick: () => { lookApply({ accent: a.id }); draw(); } }, a.c ? '' : 'A')),
        h('label', { class: 'lk-dot custom' + (CFG.accent === 'custom' ? ' on' : ''), title: 'Pick any colour' }, h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(CFG.accentC) ? CFG.accentC : '#0a8c97', oninput: e => { CFG.accent = 'custom'; CFG.accentC = e.target.value; saveCfg(); applyAppearance(); }, onchange: () => draw() }), '+')),
      h('div', { class: 'lk-note' }, 'Any colour works: it is automatically adjusted so text and controls stay readable on the palette you chose.'),
      h('div', { class: 'lk-sec' }, 'FEEL'),
      row('Density', seg('density', [['compact', 'Compact'], ['comfortable', 'Cosy'], ['spacious', 'Roomy']])),
      row('Corners', seg('corners', [['sharp', 'Sharp'], ['soft', 'Soft'], ['round', 'Round']])),
      row('Surfaces', seg('surface', [['flat', 'Flat'], ['soft', 'Soft'], ['raised', 'Raised']]), 'Shadows and depth'),
      row('Text size', h('input', { type: 'range', min: .85, max: 1.4, step: .05, value: CFG.ui, oninput: e => { CFG.ui = +e.target.value; saveCfg(); applyAppearance(); } })),
      h('div', { class: 'lk-sec' }, 'TYPE & ACCESSIBILITY'),
      row('Typeface', h('select', { class: 'in', onchange: e => { lookApply({ font: e.target.value }); } }, Object.entries(LK_FONTS).map(([k, [t]]) => h('option', { value: k, selected: CFG.font === k }, t))), 'Uses fonts already on your device'),
      row('Contrast', seg('contrast', [['standard', 'Standard'], ['high', 'High']])),
      row('Data colours', seg('data', [['standard', 'Standard'], ['cvd', 'Colour-blind safe']]), 'Charts, meters, visuals, status lights'),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!CFG.reduce, onchange: e => { CFG.reduce = e.target.checked; saveCfg(); applyAppearance(); } }), 'Reduce motion'),
      h('div', { class: 'lk-foot' }, h('button', { class: 'btn', onclick: () => { lookReset(); draw(); } }, 'Reset appearance'), h('span', { class: 'tiny muted' }, 'Saved on this device.')));
    if (body.parentElement) body.parentElement.scrollTop = sc;
  }
  const d = pdlg('look', 'APPEARANCE', body, { cls: 'lookdlg' }); draw(); return d;
}
