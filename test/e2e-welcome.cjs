/* The first page: it says what the app is for in one look and asks what you want to do first (four goals), the way in needs nothing,
   and the camera is an optional extra at the bottom, never the first thing. Own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
const FRESH = new Function(`try { localStorage.removeItem('fw.started'); } catch (e) { }`);
const SPY = () => { window.__gum = { audio: 0, video: 0 }; const md = navigator.mediaDevices, g = md.getUserMedia.bind(md); md.getUserMedia = c => { if (c && c.audio) window.__gum.audio++; if (c && c.video) window.__gum.video++; return g(c); }; };
suite('e2e-welcome', async t => {
  const { ok, wait } = t;
  const open = async (o = {}) => { const p = await t.open({ boot: false, init: o.returning ? undefined : FRESH, ...o }); await p.addInitScript(SPY); await p.goto(t.BASE + '?debug'); await wait(3600); return p; };

  // a first visit, on a desktop
  const p = await open({ w: 1440, h: 900 });
  const txt = await p.$eval('#boot', e => e.textContent);
  ok(/Record it\. Split it\. Write it down\./.test(txt) && /guitar and voice studio/i.test(txt), 'the first page says what it is: record it, split it, write it down');
  const f = await p.evaluate(() => {
    const top = s => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().top) : null; }, st = document.getElementById('bootStage'), go = document.getElementById('bootNoMic');
    return { keys: [...document.querySelectorAll('.boot-goal b')].map(b => b.textContent), also: [...document.querySelectorAll('.boot-also li b')].map(b => b.textContent), key0: top('.boot-goal'), go: top('#bootNoMic'), also0: top('.boot-also li'), stage: top('#bootStage'), demo: !!document.getElementById('bootDemo'), stageH: st.getBoundingClientRect().height, goH: go.getBoundingClientRect().height, inCard: !!st.closest('.boot-card'), overflow: document.documentElement.scrollWidth > innerWidth };
  });
  ok(f.keys.join('|') === 'Play with a band|Write down what you play|Turn a hum into a song|Record, loop and layer|Learn a song|Run a show', 'the first thing on the page is what you want to do: play with a band, write down what you play, hum a song, loop, learn a song, run a show (' + f.keys.join(' | ') + ')');
  ok(f.also.join('|') === 'Presets and effects|Neural graph and visuals', 'presets and effects, and the neural graph with visuals, come next (' + f.also.join(' | ') + ')');
  ok(f.key0 < f.go && f.go < f.also0 && f.also0 < f.stage, 'order on the page: the goals, then the way in, then the extras, then the camera route (' + [f.key0, f.go, f.also0, f.stage].join(' < ') + ')');
  ok(f.stageH < 24 && f.goH > 60 && f.inCard, 'the camera route is a small text link while the studio is the big button (' + Math.round(f.stageH) + ' px against ' + Math.round(f.goH) + ' px)');
  ok(/optional/i.test(txt) && /camera/i.test(txt) && /stays off unless you choose/i.test(txt), 'the camera is described as optional and off unless chosen');
  ok(f.demo && !f.overflow, 'a first-timer can try the demo song, and the page does not scroll sideways');
  ok(await p.evaluate(() => window.__gum.audio === 0 && window.__gum.video === 0), 'nothing asks for the microphone or the camera on load');
  const meta = await p.evaluate(() => (document.querySelector('meta[name=description]') || {}).content || '');
  ok(/guitar/i.test(meta) && /stems/i.test(meta) && /chords/i.test(meta), 'the search and link-preview description says the same thing (' + meta.slice(0, 60) + '…)');

  // the studio route: no camera, no microphone
  await p.evaluate(() => document.getElementById('bootNoMic').click()); await wait(3200);
  ok(await p.evaluate(() => window.__gum.audio === 0 && window.__gum.video === 0 && window.__daily.CFG.route === 'studio'), 'Begin in the studio asks for neither the microphone nor the camera');
  await p.ctx.close();

  // the demo route
  const d = await open({ w: 1440, h: 900 });
  await d.evaluate(() => document.getElementById('bootDemo').click()); await wait(3600);
  const r = await d.evaluate(() => { const D = window.__daily; return { title: D.S.title, secs: D.S.sections.length, zoom: D.CFG.zoom, route: D.CFG.route, gum: D.CFG && window.__gum, boot: !!document.getElementById('boot'), origins: !!document.getElementById('origins') }; });
  ok(/demo/i.test(r.title) && r.secs >= 2 && !r.boot && !r.origins, 'Try the demo song opens a finished song straight away (' + r.title + ', ' + r.secs + ' sections)');
  ok(r.zoom === 'song' && r.route === 'studio' && r.gum.audio === 0 && r.gum.video === 0, 'the demo needs no microphone and no camera, and opens in the Song view');
  await d.ctx.close();

  // someone who already has songs just carries on
  const rt = await open({ w: 1440, h: 900, returning: true });
  ok(await rt.evaluate(() => !document.getElementById('bootDemo') && document.getElementById('bootRoutes').classList.contains('solo') && !!document.getElementById('bootNoMic')), 'a returning visitor sees one button and no demo prompt');
  await rt.ctx.close();

  // a phone
  const ph = await open({ w: 390, h: 844, mobile: true, dpr: 2 });
  const m = await ph.evaluate(() => { const r = e => document.querySelector(e).getBoundingClientRect(); return { goBottom: Math.round(r('#bootNoMic').bottom), vh: innerHeight, over: document.documentElement.scrollWidth > innerWidth, keyW: Math.round(r('.boot-door').width), chipH: Math.round(r('.boot-goal').height), cardW: Math.round(r('.boot-card').width) }; });
  ok(m.goBottom <= m.vh && !m.over, 'on a phone the way in is on the first screen and nothing scrolls sideways (button ends at ' + m.goBottom + ' of ' + m.vh + ')');
  ok(m.keyW > m.cardW * .4 && m.keyW < m.cardW * .55 && m.chipH < 40, 'on a phone the ways in sit two to a row and fill the width between them, and the single tasks are small chips (' + m.keyW + ' of ' + m.cardW + ', chips ' + m.chipH + ' px)');
  await ph.ctx.close();
  /* 2.49.1: no flash of the wrong first page. A first visit is always the dark green page, whatever light or dark is saved; someone coming
     back sees Welcome back in their own light or dark, from the first frame the card is shown */
  const watch = async (store) => {
    const c = await t.fresh({ w: 1280, h: 860 }); await c.addInitScript(new Function('s', `try { localStorage.clear(); for (const k in s) localStorage.setItem(k, s[k]); } catch (e) { }`), store);
    const q = await c.newPage(), seen = []; await q.goto(t.BASE + '?debug', { waitUntil: 'commit' });
    for (let k = 0; k < 60 && seen.filter(x => x.vis).length < 8; k++) { try { seen.push(await q.evaluate(() => { const b = document.getElementById('boot'), card = b && b.querySelector('.boot-card'); return { vis: !!card && getComputedStyle(card).visibility === 'visible', bg: b ? getComputedStyle(b).backgroundColor : '', wb: !!document.getElementById('welcomeBack'), goals: !!document.querySelector('#bootDoors .boot-door') && !document.querySelector('.boot-start-sm') }; })); } catch (e) { } await wait(50); }
    await c.close(); return seen.filter(x => x.vis);
  };
  const F = await watch({ 'fw.cfg': JSON.stringify({ lookMode: 'light', theme: 'light' }) });
  ok(F.length && F.every(x => x.bg === 'rgb(4, 9, 10)' && !x.wb && x.goals), 'a first visit opens on the dark green page with the ways in, even with light saved, from the first frame it shows (' + F.length + ' frames)');
  const R = await watch({ 'fw.cfg': JSON.stringify({ lookMode: 'light', theme: 'light' }), 'fw.started': 'true' });
  ok(R.length && R.every(x => x.wb && x.bg !== 'rgb(4, 9, 10)' && !x.goals), 'someone coming back sees Welcome back in their own light theme from its first frame, never the first-visit page (' + R.length + ' frames)');
  const D = await watch({ 'fw.cfg': JSON.stringify({ lookMode: 'dark', theme: 'dark' }), 'fw.started': 'true' });
  ok(D.length && D.every(x => x.wb && x.bg === 'rgb(4, 9, 10)'), 'and in their own dark theme if that is what they chose');
  ok(t.errors ? t.errors().length === 0 : true, 'no console errors');
});
