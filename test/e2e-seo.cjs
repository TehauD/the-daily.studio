/* Search and sharing: what a crawler or a link preview sees on the first page, after the scripts have run, and the plain pages generated for search
   (dist/guide, sitemap.xml, robots.txt) when the deploy folder has been built. Own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
suite('e2e-seo', async t => {
  const { ok } = t, p = await t.open({ w: 1280, h: 800 }), ev = (f, a) => p.evaluate(f, a);
  /* what a crawler gets: the page as served, before any script has run */
  const h = await ev(async () => {
    const raw = await (await fetch('./', { cache: 'no-store' })).text(), doc = new DOMParser().parseFromString(raw, 'text/html');
    const m = (k, a = 'name') => { const e = doc.querySelector('meta[' + a + '="' + k + '"]'); return e ? e.getAttribute('content') : null; }, ld = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(s => { try { return JSON.parse(s.textContent); } catch (e) { return null; } });
    const link = doc.querySelector('link[rel="canonical"]'), imgs = [...doc.querySelectorAll('img')];
    return { lang: doc.documentElement.lang, title: doc.title, desc: m('description'), canon: link && link.getAttribute('href'), og: ['og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'og:site_name'].map(k => !!m(k, 'property')).join(), ogImg: m('og:image', 'property'), tw: m('twitter:card'), theme: m('theme-color'), vp: m('viewport'), ld, h1: doc.querySelectorAll('h1').length, main: doc.querySelectorAll('main').length, noalt: imgs.filter(i => !i.hasAttribute('alt')).length, noscript: /JavaScript/.test(raw.slice(raw.indexOf('<noscript'), raw.indexOf('</noscript>'))), manifest: !!doc.querySelector('link[rel="manifest"]'), icon: !!doc.querySelector('link[rel~="icon"],link[rel="apple-touch-icon"]') };
  });
  /* and what a person sees once it has started: every visible control has a name */
  const live = await ev(() => ({ unnamed: [...document.querySelectorAll('button,a[href]')].filter(b => !(b.textContent.trim() || b.getAttribute('aria-label') || b.getAttribute('title')) && b.getClientRects().length).length, noalt: [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt')).length }));
  ok(h.lang === 'en' && h.vp && /width=device-width/.test(h.vp), 'the page declares its language and works at phone width');
  ok(h.title.length >= 30 && h.title.length <= 70 && /the-daily\.studio/.test(h.title) && /guitar/i.test(h.title), 'the title names the product and what it does, in under 70 characters (' + h.title.length + '): ' + h.title);
  ok(h.desc && h.desc.length >= 100 && h.desc.length <= 175 && /guitar/i.test(h.desc) && /browser/i.test(h.desc), 'the description says what it is in 100–175 characters (' + (h.desc && h.desc.length) + ')');
  ok(h.canon === 'https://the-daily.studio/', 'one canonical address: ' + h.canon);
  ok(h.og === 'true,true,true,true,true,true' && h.tw && /^https:\/\/the-daily\.studio\//.test(h.ogImg), 'a link preview has a title, description, type, address, image and site name, and a Twitter card (' + h.og + ', ' + h.ogImg + ')');
  const g = (h.ld[0] && h.ld[0]['@graph']) || [], types = g.map(x => x['@type']);
  ok(h.ld.length >= 1 && h.ld.every(Boolean) && types.includes('WebSite') && (types.includes('WebApplication') || types.includes('SoftwareApplication')), 'structured data parses and describes the site and the application (' + types.join(', ') + ')');
  const app = g.find(x => x['@type'] === 'WebApplication' || x['@type'] === 'SoftwareApplication') || {};
  ok(app.applicationCategory && app.offers && String(app.offers.price) === '0' && !app.aggregateRating && !app.review && !JSON.stringify(h.ld).includes('aggregateRating'), 'it says the app is free and makes no invented ratings or reviews');
  ok(h.h1 === 1 && h.main === 1, 'the served page has one main heading and one main region (' + h.h1 + ', ' + h.main + ')');
  ok(h.noalt === 0 && live.noalt === 0 && live.unnamed === 0, 'every image has alt text and every visible button or link has a name (' + live.noalt + ' images, ' + live.unnamed + ' unnamed controls)');
  ok(h.noscript, 'a visitor without scripts, and a crawler that does not run them, gets an explanation and not a blank page');
  ok(h.manifest && h.icon && h.theme, 'manifest, icons and theme colour are declared');

  const fs = t.fs, path = t.path, root = path.join(__dirname, '..'), dist = path.join(root, 'dist');
  const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
  ok(/Sitemap: https:\/\/the-daily\.studio\/sitemap\.xml/.test(rd('robots.txt')) && !/Disallow: \/\s*$/m.test(rd('robots.txt')), 'robots.txt allows crawling and points to the sitemap');
  const sm = rd('sitemap.xml'), urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x => x[1]);
  ok(urls.length >= 8 && urls.every(u => /^https:\/\/the-daily\.studio\//.test(u)) && new Set(urls).size === urls.length && urls[0] === 'https://the-daily.studio/', 'the sitemap lists the first page and the guide pages, each once (' + urls.length + ' addresses)');
  if (fs.existsSync(path.join(dist, 'guide'))) {
    const missing = [], bad = [];
    for (const u of urls) {
      if (/\/journal\/$/.test(u)) continue;   // The Daily is a separate first-party app, copied unchanged
      const rel = u.replace('https://the-daily.studio/', ''), f = path.join(dist, rel, rel.endsWith('.html') ? '' : 'index.html'), file = rel === '' ? path.join(dist, 'index.html') : rel.endsWith('/') ? path.join(dist, rel, 'index.html') : path.join(dist, rel);
      if (!fs.existsSync(file)) { missing.push(rel); continue; }
      const html = fs.readFileSync(file, 'utf8').replace(/<script[\s\S]*?<\/script>/g, ''), title = (html.match(/<title>([^<]+)/) || [])[1] || '', canon = (html.match(/rel="canonical" href="([^"]+)"/) || [])[1], h1s = (html.match(/<h1[ >]/g) || []).length;
      if (!title || title.length > 75 || canon !== u || h1s !== 1 || !/name="description" content="[^"]{60,}/.test(html)) bad.push(rel + ' (' + title.length + ', ' + canon + ', ' + h1s + ' h1)');
    }
    ok(missing.length === 0, 'every address in the sitemap exists in the deploy folder' + (missing.length ? ': ' + missing.join(', ') : ''));
    ok(bad.length === 0, 'every page has its own title, description, canonical address and one h1' + (bad.length ? ': ' + bad.join('; ') : ''));
  }
});
