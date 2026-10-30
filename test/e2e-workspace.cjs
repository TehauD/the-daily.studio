/* Workspace: the twelve layouts (each one a whole workspace that replaces the last), the view menu, and the Monitor's optional widgets.
   Own browser contexts; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
suite('e2e-workspace', async t => {
  const { ok, wait, poll } = t, p = await t.open({ w: 1600, h: 950, debug: true }), ev = (f, a) => p.evaluate(f, a);
  await ev(async () => { await window.__daily.ioConnect(); });

  // ---- the nine layouts
  const names = await ev(() => window.__daily.LAYOUTS.map(l => l[0]));
  ok(names.join() === 'Studio,Play,Create,Learn,Write,Arrange,Record,Tone,Practice,Show,Focus,Classic', 'twelve layouts, each for one job: ' + names.join(', '));
  ok(!names.some(n => /Perform|Light show|Track study|Songwriting|Pedalboard|Compose/.test(n)), 'the old, overlapping layouts are gone');
  const fp = await ev(async () => {
    const d = window.__daily, out = {};
    for (const [n, , s] of d.LAYOUTS) {
      d.applyPreset(s, n); await new Promise(r => setTimeout(r, 350));
      const dock = document.querySelector('#dock .tab.on'), tabs = [...document.querySelectorAll('#dock .tabs .tab')].map(b => b.textContent.trim());
      out[n] = { name: d.LAY.name, flip: !!d.LAY.flip, left: !!d.LAY.left, right: !!d.LAY.right, tlh: d.LAY.tlh || '', dock: d.DOCK.cur, lcur: d.SD.cur.left, rcur: d.SD.cur.right, mon: ['tuner', 'levels', 'live', 'spectrum', 'views'].filter(w => !d.LAY.rc.hide[w]).join('+'), tabs: tabs.join('|'), side: JSON.stringify(d.LAY.side), tlhVar: document.getElementById('center').style.getPropertyValue('--tlh'), lvis: getComputedStyle(document.getElementById('left')).visibility, rvis: getComputedStyle(document.getElementById('right')).visibility, dockH: Math.round(document.getElementById('dock').getBoundingClientRect().height), tlH: Math.round(document.getElementById('timeline').getBoundingClientRect().height), dockY: Math.round(document.getElementById('dock').getBoundingClientRect().top), tlY: Math.round(document.getElementById('timeline').getBoundingClientRect().top), activeTab: dock ? dock.textContent.trim() : '' };
    }
    return out;
  });
  ok(names.every(n => fp[n].name === n), 'choosing a layout names it in the workspace state');
  const sig = n => [fp[n].flip, fp[n].left, fp[n].right, fp[n].tlh, fp[n].dock, fp[n].lcur, fp[n].rcur, fp[n].mon, fp[n].tabs, fp[n].side].join(' / ');
  ok(new Set(names.map(sig)).size === 12, 'no two layouts are the same workspace');
  const aspects = n => [fp[n].flip, fp[n].left && fp[n].right ? 'both' : fp[n].left ? 'L' : fp[n].right ? 'R' : 'none', fp[n].tlh, fp[n].dock, fp[n].rcur + '/' + fp[n].lcur, fp[n].mon, fp[n].tabs, fp[n].side];
  let weak = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) { if ([names[i], names[j]].sort().join() === 'Classic,Studio') continue; const a = aspects(names[i]), b = aspects(names[j]), diff = a.filter((x, k) => x !== b[k]).length; if (diff < 2) weak.push(names[i] + '~' + names[j] + ':' + diff); }
  ok(weak.length === 0, 'every pair differs in at least two things (where the sidebars are, how tall the arrangement is, which panel is open, which tabs, which monitor widgets)' + (weak.length ? ' — too close: ' + weak.join(' ') : ''));
  ok(fp.Studio.dockY < fp.Studio.tlY && fp.Write.dockY < fp.Write.tlY && fp.Arrange.tlY < fp.Arrange.dockY && fp.Classic.tlY < fp.Classic.dockY, 'Write and Studio put the panels above the arrangement; Arrange and Classic put the arrangement on top');
  ok(fp.Arrange.tlH > fp.Write.tlH * 1.5 && fp.Arrange.tlH > 300 && fp.Write.tlH < 330, 'Arrange makes the arrangement tall (' + fp.Arrange.tlH + ' px) and Write keeps it short (' + fp.Write.tlH + ' px)');
  ok(fp.Show.tlH < 140 && fp.Focus.tlH < 160 && fp.Tone.tlH < 140, 'Show, Focus and Tone reduce the arrangement to a strip (' + [fp.Show.tlH, fp.Focus.tlH, fp.Tone.tlH].join(', ') + ' px)');
  ok(fp.Show.lvis === 'hidden' && fp.Show.rvis === 'hidden' && fp.Focus.lvis === 'hidden' && fp.Focus.rvis === 'hidden' && fp.Practice.lvis === 'hidden' && fp.Practice.rvis === 'visible' && fp.Write.lvis === 'visible' && fp.Arrange.lvis === 'hidden' && fp.Arrange.rvis === 'visible', 'the sidebars are where each layout says (Show and Focus have none, Practice and Arrange have the right, Write both)');
  ok(fp.Show.dock === 'stage' && fp.Write.dock === 'tab' && fp.Arrange.dock === 'band' && fp.Record.dock === 'rig' && fp.Tone.dock === 'rig' && fp.Practice.dock === 'tab', 'each opens on the panel for its job (Show on the Stage, Write on the Tab, Arrange on the Band, Record and Tone on the Rig)');
  ok(!/Stage|Neural|Stems|Camera/.test(fp.Write.tabs) && /Stage/.test(fp.Show.tabs) && !/\bTab\b/.test(fp.Show.tabs) && fp.Write.tabs.split('|').length < fp.Studio.tabs.split('|').length, 'the tab strip shows what the job needs: Write has no Stage or Stems, Show has no Tab (' + fp.Write.tabs + ' ‖ ' + fp.Show.tabs + ')');
  ok(fp.Record.mon === 'tuner+levels' && fp.Tone.mon === 'tuner+live+spectrum' && fp.Studio.mon === 'tuner+levels', 'each layout brings its own Monitor widgets (Record: tuner and levels · Tone: tuner, analysis and spectrum)');
  ok(fp.Practice.side === '{"fret":"right"}' && fp.Studio.side === '{}' && fp.Write.rcur === 'refine' && fp.Write.lcur === 'theory', 'Practice puts the fretboard in the right sidebar and Write puts theory and refine beside the tab');

  // nothing carries over from the last layout
  const leak = await ev(async () => {
    const d = window.__daily, go = async n => { const l = d.LAYOUTS.find(x => x[0] === n); d.applyPreset(l[2], n); await new Promise(r => setTimeout(r, 300)); }, out = {};
    await go('Tone'); const tone = ['spectrum', 'live'].map(w => !d.LAY.rc.hide[w]); await go('Record'); out.rec = ['tuner', 'levels', 'live', 'spectrum', 'views'].map(w => !d.LAY.rc.hide[w]).join(); out.toneHad = tone.join();
    await go('Practice'); out.pr = JSON.stringify(d.LAY.side); await go('Write'); out.wr = JSON.stringify(d.LAY.side) + ' ' + JSON.stringify(d.LAY.so); out.panesPerSide = [document.querySelectorAll('#right [data-pane]').length];
    await go('Show'); await go('Studio'); out.hid = d.LAY.hidden.length; out.cur = d.DOCK.cur;
    return out;
  });
  ok(leak.toneHad === 'true,true' && leak.rec === 'true,true,false,false,false', 'moving from Tone to Record takes the spectrum and analysis away again (' + leak.rec + ')');
  ok(leak.pr === '{"fret":"right"}' && leak.wr === '{} {"left":[],"right":[]}', 'moving from Practice to Write gives the fretboard back to the panel strip');
  ok(leak.hid === 0, 'Studio shows every tab again after Show hid most of them');
  await ev(() => { const d = window.__daily; d.applyPreset(d.LAYOUTS[0][2], 'Studio'); document.querySelector('button[title^="Layout"]').click(); });
  await wait(500);
  const menu = await ev(() => { const m = document.querySelector('.lay-menu'); return { cards: m ? m.querySelectorAll('.lay-card').length : 0, heads: m ? [...m.querySelectorAll('h5')].map(h => h.textContent).join('|') : '', theme: m ? m.querySelectorAll('#vmTheme').length : 0, xp: m ? m.querySelectorAll('#vmXp').length : 0, boxes: m ? m.querySelectorAll('input[type=checkbox]').length : 0, over: m ? m.scrollWidth - m.clientWidth : 99 }; });
  ok(menu.cards === 0 && menu.heads === 'Workspace' && menu.theme === 0 && menu.xp === 0 && menu.boxes >= 3 && menu.over <= 1, 'the top-right menu is only about where panels go: no layout cards, and light/dark and Experience live elsewhere (' + JSON.stringify(menu) + ')');
  await ev(() => { document.body.click(); window.__daily.closePop && window.__daily.closePop(); }); await wait(200);
  // light/dark belongs to Appearance; Experience to the Tools button
  await ev(() => window.__daily.setTheme('light')); await wait(300);
  ok(await ev(() => window.__daily.CFG.lookMode === 'light' && document.documentElement.dataset.theme === 'light'), 'Appearance’s Light switches the whole app at once');
  await ev(() => window.__daily.setTheme('dark')); await wait(300);
  ok(await ev(() => window.__daily.CFG.lookMode === 'dark' && document.documentElement.dataset.theme === 'dark'), 'and Dark switches it back');
  await ev(() => document.getElementById('xpTools') && document.getElementById('xpTools').click()); await wait(300);
  const xpo = await ev(() => [...document.querySelectorAll('.xp-pop .xp-opt')].map(b => b.querySelector('b').textContent).join());
  ok(/Automatic,Simple,More tools/.test(xpo), 'Experience stays on the Tools button (' + xpo + ')');
  await ev(() => { const o = [...document.querySelectorAll('.xp-pop .xp-opt')].find(b => b.querySelector('b').textContent === 'Simple'); if (o) o.click(); }); await wait(300);
  ok(await ev(() => window.__daily.xpLevel() === 'new'), 'Simple narrows the studio');
  await ev(() => window.__daily.CFG.xpMode = 'pro'); await wait(100);
  ok(await ev(() => window.__daily.xpLevel() === 'pro'), 'and Everything opens it all up again');
  await ev(() => { document.body.click(); window.__daily.closePop && window.__daily.closePop(); }); await wait(200);

  // zoom levels pick a layout, too
  const zl = await ev(async () => { const d = window.__daily, out = {}; d.applyPreset(d.LAYOUTS[0][2], 'Studio'); document.querySelectorAll('.seg button').forEach(b => { if (b.textContent.trim() === 'Song') out.songBtn = true; }); const song = [...document.querySelectorAll('#songbar button')].find(b => b.textContent.trim() === 'Song'), canvas = [...document.querySelectorAll('#songbar button')].find(b => b.textContent.trim() === 'Canvas'), studio = [...document.querySelectorAll('#songbar button')].find(b => b.textContent.trim() === 'Studio'); song.click(); await new Promise(r => setTimeout(r, 500)); out.song = d.LAY.name; studio.click(); await new Promise(r => setTimeout(r, 500)); out.studio = d.LAY.name; return out; });
  ok(zl.song === 'Write' && /^(Record|Arrange)$/.test(zl.studio), 'the Canvas | Song | Studio switch goes to Write for songs and Record or Arrange for the studio (' + zl.song + ', ' + zl.studio + ')');

  // ---- the Monitor's optional widgets
  await ev(() => { const d = window.__daily; localStorage.removeItem('fw.lay'); d.applyPreset(d.LAYOUTS[0][2], 'Studio'); d.SD.cur.right = 'monitor'; });
  const m0 = await ev(() => { const d = window.__daily; d.applyPreset(d.LAYOUTS[0][2], 'Studio'); const chips = [...document.querySelectorAll('.mon-chip')], card = n => document.querySelector('[data-card="' + n + '"]'); return { chips: chips.map(c => c.textContent + ':' + c.getAttribute('aria-pressed')).join(' '), shown: ['tuner', 'levels', 'live', 'spectrum', 'views'].map(n => card(n) && card(n).style.display !== 'none').join(), label: !!document.querySelector('.mon-wl'), group: document.querySelector('.mon-wid') && document.querySelector('.mon-wid').getAttribute('role') }; });
  ok(m0.chips === 'Tuner:true Levels:true + Analysis:false + Spectrum:false + Views:false + Audience:false' && m0.shown === 'true,true,false,false,false' && m0.label && m0.group === 'group', 'the Monitor opens with the Tuner and Levels, and a row of widget chips to add the rest (' + m0.chips + ')');
  const cardH = n => ev(n => { const c = document.querySelector('[data-card="' + n + '"]'); return c && c.style.display !== 'none' ? Math.round(c.getBoundingClientRect().height) : 0; }, n);
  ok(await cardH('views') === 0 && await cardH('spectrum') === 0 && await cardH('live') === 0, 'so the Monitor is short: no extra scroll');
  await ev(() => document.querySelector('.mon-chip[data-w="views"]').click()); await wait(400);
  const m1 = await ev(() => { const d = window.__daily, c = document.querySelector('.mon-chip[data-w="views"]'); return { on: c.classList.contains('on'), pressed: c.getAttribute('aria-pressed'), text: c.textContent, hide: d.LAY.rc.hide.views, h: Math.round(document.querySelector('[data-card="views"]').getBoundingClientRect().height), cv: !!d.MV.cv && d.MV.cv.isConnected }; });
  ok(m1.on && m1.pressed === 'true' && m1.text === 'Views' && m1.hide === false && m1.h > 100, 'a chip adds a widget, and it shows (' + JSON.stringify(m1) + ')');
  await ev(() => document.querySelector('[data-card="views"] .wx').click()); await wait(300);
  ok(await ev(() => { const d = window.__daily; return d.LAY.rc.hide.views === true && document.querySelector('[data-card="views"]').style.display === 'none' && document.querySelector('.mon-chip[data-w="views"]').textContent === '+ Views'; }) && await cardH('views') === 0, 'the ✕ on a widget removes it, and the chip offers it back');
  ok(await ev(() => [...document.querySelectorAll('[data-card] .wx')].every(b => /^Remove /.test(b.getAttribute('aria-label')) && b.closest('[data-card]').dataset.card !== 'c0')), 'every ✕ is labelled for a screen reader');
  // the frame loop skips what is not on show
  const gate = await ev(async () => {
    const d = window.__daily, chip = n => document.querySelector('.mon-chip[data-w="' + n + '"]'), want = (n, on) => { if (!d.LAY.rc.hide[n] === on) return; chip(n).click(); };
    const proto = CanvasRenderingContext2D.prototype, orig = { fillRect: proto.fillRect, clearRect: proto.clearRect, stroke: proto.stroke, fill: proto.fill }; let target = null, n = 0;
    ['fillRect', 'clearRect', 'stroke', 'fill'].forEach(k => { proto[k] = function (...a) { if (this.canvas === target) n++; return orig[k].apply(this, a); }; });
    const spec = () => [...document.querySelectorAll('[data-card="spectrum"] canvas')][0], views = () => d.MV.cv, kv = () => document.querySelector('[data-card="live"] .kv');
    let mut = 0; const mo = new MutationObserver(l => { mut += l.length; }), out = {};
    const hold = ms => new Promise(r => setTimeout(r, ms));
    want('spectrum', false); want('views', false); want('live', false); await hold(300);
    target = spec(); n = 0; await hold(800); out.specHidden = n;
    target = views(); n = 0; await hold(800); out.viewsHidden = n;
    mo.observe(kv(), { childList: true }); mut = 0; await hold(900); out.liveHidden = mut;
    want('spectrum', true); want('views', true); want('live', true); await hold(500);
    target = spec(); n = 0; await hold(800); out.specShown = n;
    target = views(); n = 0; await hold(800); out.viewsShown = n;
    mut = 0; await hold(900); out.liveShown = mut; mo.disconnect();
    Object.assign(proto, orig); want('spectrum', false); want('views', false); want('live', false); return out;
  });
  ok(gate.specHidden === 0 && gate.viewsHidden === 0 && gate.liveHidden === 0, 'a widget you have removed costs nothing: nothing is drawn or updated for it (' + [gate.specHidden, gate.viewsHidden, gate.liveHidden].join(', ') + ')');
  ok(gate.specShown > 0 && gate.viewsShown > 0 && gate.liveShown > 0, 'and it draws again the moment you add it back (' + [gate.specShown, gate.viewsShown, gate.liveShown].join(', ') + ')');
  await ev(() => document.querySelector('.mon-chip[data-w="spectrum"]').click()); await wait(200);
  await p.reload(); await t.boot(p);
  ok(await ev(() => { const d = window.__daily; return !d.LAY.rc.hide.spectrum && d.LAY.rc.hide.views && d.LAY.rc.hide.live && document.querySelector('.mon-chip[data-w="spectrum"]').classList.contains('on'); }), 'the widgets you chose are still there after a reload');
  const ord = await ev(() => { const d = window.__daily; const c = document.querySelector('[data-card="spectrum"]'); return { drag: c.firstChild.getAttribute('draggable'), collapse: (() => { c.firstChild.click(); const a = c.classList.contains('cc'); c.firstChild.click(); return a; })() }; });
  ok(ord.drag === 'true' && ord.collapse === true, 'widgets can still be collapsed by their title and dragged into order');

  // ---- a phone has the Monitor in its drawer: the same widgets, nothing leaking sideways
  const pm = await t.open({ w: 390, h: 800, mobile: true, debug: true });
  const mm = await pm.evaluate(() => { const d = window.__daily; return { chips: document.querySelectorAll('.mon-chip').length, over: document.scrollingElement.scrollWidth - innerWidth, hidden: ['live', 'spectrum', 'views'].every(n => d.LAY.rc.hide[n]) }; });
  ok(mm.chips === 6 && mm.over <= 1 && mm.hidden, 'on a phone the Monitor starts short too (' + JSON.stringify(mm) + ')');
});
