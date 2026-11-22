/* the-daily.studio: the public pages as Markdown, for AI assistants that ask for it (2.87.1).
   Cloudflare's "Markdown for Agents" does this on the fly on a paid plan; this does the same job at build time, from the same PAGES the HTML guide is
   rendered from, so the two cannot drift and nothing is paid for. Three kinds of file, all written by scripts/assemble.mjs:
     index.md in each folder   one page each. A request for the page that says `Accept: text/markdown` is sent to these by a free Cloudflare
                                       Transform Rule (docs/CLOUDFLARE_SETUP.md, Part K); each HTML page also names its twin in <link rel="alternate">.
     llms-full.txt                    the whole guide in one file (llmstxt.org), for an assistant that wants everything in one fetch.
   Plain text only: no script, no tracking, and the same words the page has. */
import { PAGES, SITE, FEATURES, PERSON, pageUrl } from './seo-pages.mjs';

const firstLine = p => p.blurb || p.description.split('. ')[0].replace(/\.$/, '') + '.';
const ref = p => pageUrl(p);

/** one guide page as Markdown (same sections, in the same order, as renderPage) */
export function pageMarkdown(p, { version, modified }) {
  const o = [`# ${p.h1}`, ''];
  if (p.subtitle) o.push(`*${p.subtitle}*`, '');
  o.push(`> ${p.lead}`, '', `Page: ${pageUrl(p)} · studio: ${SITE.origin}/ · version ${version} · updated ${modified}`, '');
  if (p.img) o.push(`![${p.img.alt}](${SITE.origin}/guide/img/${p.img.src})`, '');
  if (p.glance) { o.push('## At a glance', ''); p.glance.forEach(([, t, d]) => o.push(`- **${t}**: ${d}`)); o.push(''); }
  (p.sections || []).forEach(s => {
    o.push(`## ${s.h}`, '');
    if (s.topics) { PAGES.filter(x => x.slug !== 'guide' && !x.unlisted && !x.about).forEach(x => o.push(`- [${x.h1}](${ref(x)}): ${firstLine(x)}`)); o.push(''); }
    if (s.p) s.p.forEach(t => o.push(t, ''));
    if (s.ul) { s.ul.forEach(t => o.push(`- ${t}`)); o.push(''); }
    if (s.ol) { s.ol.forEach((t, i) => o.push(`${i + 1}. ${t}`)); o.push(''); }
    if (s.links) { s.links.forEach(([t, h]) => o.push(`- [${t}](${/^https?:/.test(h) ? h : new URL(h, pageUrl(p)).href})`)); o.push(''); }
  });
  if (p.limits) { o.push('## Good to know', ''); p.limits.forEach(t => o.push(`- ${t}`)); o.push(''); }
  if (p.faq) { o.push('## Questions', ''); p.faq.forEach(([q, a]) => o.push(`### ${q}`, '', a, '')); }
  const related = (p.related || []).map(r => PAGES.find(x => x.slug === r)).filter(Boolean);
  if (related.length) { o.push('## Keep reading', ''); related.forEach(x => o.push(`- [${x.h1}](${ref(x)}): ${firstLine(x)}`)); o.push(''); }
  return o.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** the front page as Markdown. The studio itself is an app, not an article, so this says what it is, what it keeps private and where everything is */
export function homeMarkdown(version) {
  const pages = PAGES.filter(p => !p.unlisted && p.slug !== 'guide').map(p => `- [${p.h1}](${ref(p)}): ${firstLine(p)}`);
  return `# ${SITE.name}

> ${SITE.description}

${SITE.name} is a ${SITE.tagline}. It is one web page: open it and it works, with nothing to install and no account. Version ${version}. Free and open source (MIT), made by [${PERSON.name}](${PERSON.url}) (${PERSON.alt}).

## What it does

${FEATURES.map(f => `- ${f}`).join('\n')}

## What stays private

Recording, stem splitting, chord and tab detection and the light show all run in the visitor's browser. Songs, takes and settings are kept in that browser, on that device. Nothing is sent to a server unless the person chooses to (a shared link, GitHub sync). The page has no tracking and no adverts. Privacy statement: ${SITE.origin}/legal/#privacy

## For AI assistants

An assistant running in the visitor's browser can use the studio through tools (WebMCP, or window.dailyStudio from a script). They never reach the microphone, the camera, recording, deleting songs or Settings. The tools run in the page, so there is no server, API or login to point an assistant at. Tool list: ${SITE.origin}/llms.txt. Reference: ${SITE.repo}/blob/main/docs/AGENT_API.md. Guide for assistants: ${SITE.origin}/guide/for-ai-assistants/.

## The guide

- [How it works](${SITE.origin}/guide/): what it does, what stays on the device, where its limits are
${pages.join('\n')}

## More

- Everything above in one file: ${SITE.origin}/llms-full.txt
- Source code: ${SITE.repo}
- Licences, notices and privacy: ${SITE.origin}/legal/
- Sitemap: ${SITE.origin}/sitemap.xml
`;
}

/** llms-full.txt: the front page and every listed guide page in one file, each under its own address */
export function llmsFull(version, modified) {
  const parts = [homeMarkdown(version).trimEnd(), ...PAGES.filter(p => !p.unlisted).map(p => pageMarkdown(p, { version, modified }).trimEnd())];
  return `<!-- ${SITE.name} v${version}: the front page and the guide as Markdown. A shorter index is at ${SITE.origin}/llms.txt -->\n\n` + parts.join('\n\n---\n\n') + '\n';
}
