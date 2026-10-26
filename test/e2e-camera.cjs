/* Camera looks: edges-in and the person cut-out (a stub segmenter stands in for the downloadable model). Polls instead of sleeping, because the fake camera's first frames arrive at their own pace. */
const { suite } = require('./lib.cjs');
suite('e2e-camera', async t => {
  const { ok, wait, poll } = t, cp = await t.open();
  await cp.click('#dock .tab[data-id="cam"]'); await wait(400);
  await cp.evaluate(() => [...document.querySelectorAll('button')].find(b => /Camera on\/off/.test(b.textContent)).click());
  ok(await poll(() => cp.evaluate(() => window.__daily.CAM.on), 12000), 'the camera starts when you press the button');
  await cp.click('#dock .tab[data-id="vis"]'); await wait(500);
  await cp.evaluate(() => [...document.querySelectorAll('button')].find(b => /Camera backdrop/.test(b.textContent)).click());
  ok(await cp.$$eval('select[aria-label="Camera look"] option', o => o.slice(0, 3).map(x => x.value).join()) === 'over,edges,person', 'camera look offers dimmed, edges-in and green-screen');
  const px = x => cp.evaluate(x => { const c = document.querySelector('.vcanvas'), g = c.getContext('2d'), d = g.getImageData(Math.floor(c.width * x), Math.floor(c.height * .5), 1, 1).data; return [d[0], d[1], d[2]]; }, x);
  const green = p => p[1] > p[0] + 50 && p[1] > p[2] + 50;
  await cp.selectOption('select[aria-label="Camera look"]', 'edges');
  ok(await poll(async () => green(await px(.5)) && !green(await px(.04)), 10000), 'edges-in: camera shows in the middle, visuals around it');
  await cp.evaluate(() => { const w = 320, h = 180, a = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (x - w / 2) / (w * .17), dy = (y - h * .55) / (h * .42); a[y * w + x] = dx * dx + dy * dy < 1 ? 0 : 1; }   // inverted on purpose
    const D = window.__daily; D.CF.inv = null; D.CF.acc = null; D.CF.mask = null; D.CF.errN = 0; D.CF.seg = { segmentForVideo(v, t, cb) { cb({ confidenceMasks: [{ width: w, height: h, getAsFloat32Array: () => a }] }); } }; D.CF.state = 'ready'; });
  await cp.selectOption('select[aria-label="Camera look"]', 'person');
  ok(await poll(() => cp.evaluate(() => window.__daily.CF.inv === true), 10000), 'cut-out: mask direction is detected automatically');
  ok(await poll(async () => green(await px(.5)) && !green(await px(.06)), 10000), 'cut-out: you stay in front, the visuals fill the rest');
});
