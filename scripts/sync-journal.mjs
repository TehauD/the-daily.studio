#!/usr/bin/env node
/* Vendors The Daily (https://github.com/TehauD/daily) into ./journal/ so it is served at /journal/ on the same site.
 *   node scripts/sync-journal.mjs path/to/daily/public/index.html [source-commit]
 * The page is copied unchanged except for one <meta> Content-Security-Policy tag. On Azure the same policy is sent as a header by
 * Express; GitHub Pages cannot send headers, so the meta tag carries it (frame-ancestors is header-only and is omitted). */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2], commit = process.argv[3] || 'unknown';
if (!src) { console.error('usage: node scripts/sync-journal.mjs <daily/public/index.html> [commit]'); process.exit(1); }
const csp = ["default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https:", "font-src 'self' data:",
  "connect-src 'self' https://api.github.com https://dev.azure.com https://api.openai.com https://*.openai.azure.com https://*.services.ai.azure.com http://localhost:* http://127.0.0.1:*",
  "frame-src 'self' blob:", "worker-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "form-action 'self'"].join('; ');
let html = readFileSync(resolve(src), 'utf8');
if (/http-equiv="Content-Security-Policy"/i.test(html)) html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/i, '');
html = html.replace(/(<meta charset="UTF-8">)/i, `$1\n<meta http-equiv="Content-Security-Policy" content="${csp}">\n<meta name="referrer" content="no-referrer">`);
mkdirSync(resolve(root, 'journal'), { recursive: true });
writeFileSync(resolve(root, 'journal/index.html'), html);
writeFileSync(resolve(root, 'journal/SOURCE.md'), `# The Daily (vendored)\n\nThis folder is a copy of the built page from https://github.com/TehauD/daily (MIT), source commit \`${commit}\`.\nIt is served at https://the-daily.studio/journal/. Do not edit \`index.html\` by hand; refresh it with:\n\n\`\`\`\nnode scripts/sync-journal.mjs ../daily/public/index.html <commit>\n\`\`\`\n\nThe only change is a Content-Security-Policy meta tag (the live Azure copy sends the same policy as an HTTP header).\nThe Daily keeps its data in this browser under keys starting \`daily\`; the studio uses \`fw.\`. They never read each other's data.\n`);
console.log('journal/index.html written (' + Math.round(html.length / 1024) + ' kB)');
