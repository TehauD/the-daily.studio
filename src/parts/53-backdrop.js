/* ============================================================
   Part 53 · Performer backdrop — visuals that sit behind a person, not in front of them
   A mode of the Stage (part 13) rather than a new screen. With it on:
     · the picture is calmer and dimmer: slower trails, no flashing, gentler glow, and it eases to a new colour when the section changes
     · it still breathes with the music: a little brighter when you play loud, darker when you stop
     · a lower third carries what the audience (or the band) needs: the chord and the next one, the section, the lyric line and the one after
     · the background can be the visuals, plain black, or chroma-key green, for a projector or for OBS to key out
     · “Clean output window” opens a bare window with no controls on it, which you drag to the projector and make full screen
   Nothing is sent anywhere: the window is fed from this page’s own canvas.
   ============================================================ */
const PBK_DEF = { on: false, bg: 'visuals', dim: .45, calm: true, lower: true, size: 1, pos: 'bottom' };
STG.pb = Object.assign({}, PBK_DEF, STG.pb || {});
const PBK = { lv: 0, hue: 0, sec: '' };
const PBK_BG = { visuals: '#000000', black: '#000000', green: '#00b140' };
const pbOn = () => !!(STG.pb && STG.pb.on);
const pbSolid = () => pbOn() && STG.pb.bg !== 'visuals';
const pbBgColor = () => pbOn() ? PBK_BG[STG.pb.bg] || '#000' : '#000';
/** the scene as the backdrop wants it: same look, calmer, nudged in hue by the section, plus the smoothed loudness for pbDim */
function pbScene(sc, info) {
  if (!pbOn()) return sc;
  const pb = STG.pb, si = Math.max(0, S.sections.findIndex(s => s.name === info.sec)), target = si * 52;
  let d = ((target - PBK.hue + 540) % 360) - 180; PBK.hue += d * .015;                      // ease around the colour wheel, a few seconds per change
  const db = AN.active ? AN.rms : -90, lv = clamp((db + 60) / 50, 0, 1); PBK.lv += (lv - PBK.lv) * (lv > PBK.lv ? .25 : .04);   // quick to rise, slow to fall
  const o = Object.assign({}, sc, { hue: sc.hue + PBK.hue, flash: 0 });
  if (pb.calm) { o.trail = Math.max(sc.trail, .8); o.glow = sc.glow * .45; o.sens = Math.min(sc.sens, 1) * .75; o.drift = Math.min(sc.drift || 0, .25); }
  if (pbSolid()) { o.cam = false; o.kal = 0; o.glow = 0; }
  return o;
}
/** dim the picture; louder playing lifts it a little */
function pbDim(g, w, h) {
  if (!pbOn() || pbSolid()) return; const a = clamp(STG.pb.dim - (STG.pb.calm ? .22 : .1) * PBK.lv, 0, .92); if (a < .01) return;
  g.save(); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = 'rgba(0,0,0,' + a.toFixed(3) + ')'; g.fillRect(0, 0, w, h); g.restore();
}
function pbFill(off) { const g = off.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = pbBgColor(); g.fillRect(0, 0, off.width, off.height); }
/** chord + next, section, lyric + next lyric, in a panel along the bottom (or the top) */
function drawLowerThird(g, W, H, info, C) {
  const pb = STG.pb, lyr = info.lyric, sym = info.sym; if (!sym && !lyr && !(info.playing && info.sec)) return;
  const u = Math.min(W, H * 1.6) * (pb.size || 1), mono = 'ui-monospace,Menlo,Consolas,monospace', sans = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
  const ph = u * .2, pw = W * .94, x = W * .03, y = pb.pos === 'top' ? H * .04 : H - ph - H * .05, r = u * .02, cw = u * .34;
  g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = u * .015;
  g.beginPath(); g.roundRect ? g.roundRect(x, y, pw, ph, r) : g.rect(x, y, pw, ph); g.fillStyle = 'rgba(8,10,16,.72)'; g.fill(); g.shadowBlur = 0;
  g.fillStyle = C.a; g.fillRect(x, y + ph * .12, u * .006, ph * .76);                        // accent edge
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const csz = Math.round(ph * .44); g.font = `800 ${csz}px ${mono}`; g.fillStyle = '#fff'; g.fillText(sym || '·', x + u * .03, y + ph * .7, cw - u * .05);
  if (info.next && info.playing) { g.font = `700 ${Math.round(ph * .14)}px ${mono}`; g.fillStyle = C.b; g.fillText('NEXT  ' + info.next, x + u * .03, y + ph * .91, cw - u * .05); }
  if (info.sec) { g.font = `700 ${Math.round(ph * .12)}px ${sans}`; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(info.sec.toUpperCase() + (info.nBars ? '  ' + info.barIn + '/' + info.nBars : ''), x + u * .03, y + ph * .2, cw - u * .05); }
  const lx = x + cw, lw = pw - cw - u * .03; g.textAlign = 'left';
  if (lyr) {
    g.font = `700 ${Math.round(ph * .3)}px ${sans}`; g.fillStyle = '#fff'; g.fillText(lyr, lx, y + ph * (info.lyricNext ? .46 : .6), lw);
    if (info.lyricNext) { g.font = `600 ${Math.round(ph * .2)}px ${sans}`; g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText(info.lyricNext, lx, y + ph * .8, lw); }
  } else if (info.playing) { g.font = `600 ${Math.round(ph * .2)}px ${sans}`; g.fillStyle = 'rgba(255,255,255,.4)'; g.fillText('♪', lx, y + ph * .6, lw); }
  g.restore(); g.textAlign = 'left';
}
/** the settings card on the Stage pane */
function pbCard() {
  const pb = STG.pb, save = () => { saveStg(); SG.hudDirty = 1; if (SG.pop && !SG.pop.closed) pbPopTint(); };
  const row = (label, ctl) => h('label', { class: 'small', style: { display: 'flex', flexDirection: 'column', gap: '3px', fontWeight: 700 } }, label, ctl);
  const chk = (k, label, title) => h('label', { class: 'chk small', title: title || '', style: { display: 'flex', gap: '4px', alignItems: 'center', fontWeight: 700 } }, h('input', { type: 'checkbox', id: 'pb_' + k, checked: pb[k], onchange: e => { pb[k] = e.target.checked; save(); renderStageUI(); } }), label);
  const sel = (k, opts) => h('select', { class: 'in', id: 'pb_' + k, style: { fontFamily: 'var(--sans)' }, onchange: e => { pb[k] = e.target.value; save(); } }, opts.map(o => h('option', { value: o[0], selected: String(o[0]) === String(pb[k]) }, o[1])));
  return h('div', { class: 'card', id: 'pbCard', style: { padding: '10px' } }, h('h4', { style: { margin: '0 0 8px' } }, 'Performer backdrop'),
    h('div', { class: 'tiny muted', style: { marginBottom: '8px' } }, 'For when people are looking at you, not at the picture: calmer and dimmer, still moving with the music, with the chord and lyric in a lower third. Plain black or green for a projector or OBS.'),
    h('div', { class: 'row', style: { gap: '14px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' } }, chk('on', 'Performer backdrop on', 'Turns the backdrop mode on for the stage, the full screen and the output window'), chk('calm', 'Calm motion', 'Slower trails, no flashing, softer glow'), chk('lower', 'Lower third (chord · lyric)')),
    h('div', { class: 'sgrid', style: { marginTop: 0 } },
      row('Background', sel('bg', [['visuals', 'The visuals (dimmed)'], ['black', 'Plain black'], ['green', 'Chroma-key green']])),
      row('Dimming', h('input', { type: 'range', id: 'pb_dim', min: 0, max: .9, step: .05, value: pb.dim, oninput: e => { pb.dim = +e.target.value; save(); } })),
      row('Lower third size', sel('size', [[.8, 'Small'], [1, 'Normal'], [1.25, 'Large']])), row('Lower third position', sel('pos', [['bottom', 'Bottom'], ['top', 'Top']]))),
    h('div', { class: 'row', style: { gap: '8px', marginTop: '8px', flexWrap: 'wrap' } },
      h('button', { class: 'btn sm', id: 'pbOut', title: 'A bare window with just the picture: drag it to the projector, then double-click it for full screen. Turns the backdrop on.', onclick: () => { pb.on = true; save(); renderStageUI(); stagePop(); } }, '▢ Clean output window'),
      h('button', { class: 'btn sm', id: 'pbFull', title: 'Fill this screen with the backdrop (Esc to leave)', onclick: () => { pb.on = true; save(); renderStageUI(); stageFull(); } }, '⛶ Full screen')),
    h('div', { class: 'tiny muted', style: { marginTop: '6px' } }, 'OBS: add the output window as a Window Capture, then Filters → Chroma Key (green). Nothing is uploaded; the window is fed from this page.'));
}
/** the output window’s own background follows the choice, and the pointer hides itself when it is still */
function pbPopTint() { const w = SG.pop; if (!w || w.closed) return; try { w.document.body.style.background = pbBgColor(); } catch (e) { } }
function pbPopSetup(w) {
  try {
    w.document.body.style.background = pbBgColor(); let tm = 0; const hide = () => { w.document.body.style.cursor = 'none'; }; const show = () => { w.document.body.style.cursor = ''; clearTimeout(tm); tm = setTimeout(hide, 2500); };
    w.document.addEventListener('mousemove', show); tm = setTimeout(hide, 2500);
  } catch (e) { }
}
