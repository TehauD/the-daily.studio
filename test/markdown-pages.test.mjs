/* The Markdown twins, the one-file guide and the API catalog (2.87.1): made from the same pages as the HTML, plain text, and honest about where the tools run. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAGES, SITE, apiCatalog, agentToolsJson, renderPage } from '../scripts/seo-pages.mjs';
import { pageMarkdown, homeMarkdown, llmsFull } from '../scripts/markdown-pages.mjs';
const meta = { version: '9.9.9', modified: '2026-01-02' };

test('every page has a Markdown twin with its title, lead, and every section and question', () => {
  for (const p of PAGES) {
    const md = pageMarkdown(p, meta);
    assert.ok(md.startsWith('# ' + p.h1 + '\n'), p.slug + ': starts with its heading');
    assert.ok(md.includes(p.lead), p.slug + ': has the lead');
    for (const s of p.sections || []) assert.ok(md.includes('## ' + s.h), p.slug + ': section ' + s.h);
    for (const [q, a] of p.faq || []) assert.ok(md.includes('### ' + q) && md.includes(a), p.slug + ': question ' + q);
    for (const t of p.limits || []) assert.ok(md.includes('- ' + t), p.slug + ': limit');
    assert.ok(!/<[a-z][^>]*>/i.test(md), p.slug + ': no HTML in it');
  }
});
test('the twin says what the HTML says (the same strings, un-escaped)', () => {
  const p = PAGES.find(x => x.slug === 'getting-started'), html = renderPage(p, meta), md = pageMarkdown(p, meta);
  assert.ok(html.includes('href="' + SITE.origin + '/guide/getting-started/index.md"'));
  for (const [, a] of p.faq || []) assert.ok(md.includes(a) && (html.includes(a) || html.includes(a.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'))));
});
test('llms-full.txt holds the front page and every listed page, and not the unlisted one', () => {
  const full = llmsFull('9.9.9', '2026-01-02');
  assert.ok(full.includes(homeMarkdown('9.9.9').trimEnd()));
  const tops = full.split('\n').filter(l => /^# /.test(l));      /* top-level headings only: a "## For AI assistants" section is not the unlisted page */
  for (const p of PAGES.filter(x => !x.unlisted)) assert.ok(tops.includes('# ' + p.h1), p.slug);
  for (const p of PAGES.filter(x => x.unlisted)) assert.ok(!tops.includes('# ' + p.h1), p.slug);
});
test('the front page says what stays private and that the tools run in the browser', () => {
  const md = homeMarkdown('9.9.9');
  assert.ok(/Nothing is sent to a server unless the person chooses to/.test(md) && /there is no server, API or login/.test(md));
});
test('the API catalog is a linkset with anchor, service-desc and service-doc, and claims no server', () => {
  const c = JSON.parse(apiCatalog());
  assert.equal(c.linkset.length, 1);
  const e = c.linkset[0];
  assert.equal(e.anchor, SITE.origin + '/');
  assert.ok(e['service-desc'][0].href === SITE.origin + '/agent-tools.json' && e['service-doc'].length >= 2 && !('status' in e));
  const t = JSON.parse(agentToolsJson(JSON.parse(readFileSync(new URL('./agent-contract.json', import.meta.url), 'utf8'))));
  assert.ok(Object.keys(t.tools).length >= 30 && /no server endpoint/.test(t.about));
});
