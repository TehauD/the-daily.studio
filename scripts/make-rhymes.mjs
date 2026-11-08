#!/usr/bin/env node
/* Makes data/rhymes.txt for the lyric helper (part 63d, 2.58). Not part of the build: run it by hand to regenerate, from two packages
   unpacked somewhere outside the repository (they are data, not dependencies of the site):
     npm pack cmu-pronouncing-dictionary@3.0.0 wordlist-english@1.2.1   (then untar both)
     node scripts/make-rhymes.mjs <dir with cmu-pronouncing-dictionary-3.0.0/> <dir with wordlist-english-1.2.1/>
   Words: SCOWL's English lists at levels 10, 20 and 35 (common words, no proper names), letters only, that the CMU Pronouncing
   Dictionary knows. Each line is a rhyme: the sounds from the last stressed vowel to the end, then the words with their syllable counts,
   commonest level first. Licences: THIRD_PARTY_NOTICES.md (CMU Pronouncing Dictionary, cmu-pronouncing-dictionary, SCOWL). */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [cmuDir, scowlDir] = process.argv.slice(2); if (!cmuDir || !scowlDir) { console.error('usage: node scripts/make-rhymes.mjs <cmu dir> <scowl dir>'); process.exit(1); }
const src = readFileSync(join(cmuDir, 'cmu-pronouncing-dictionary-3.0.0', 'package', 'index.js'), 'utf8');
const dict = {}; for (const m of src.matchAll(/^\s*"([a-z][a-z']*)": "([A-Z0-9 ]+)",?$/gm)) dict[m[1]] = m[2];
const lvl = {}; for (const L of [10, 20, 35]) for (const w of JSON.parse(readFileSync(join(scowlDir, 'wordlist-english-1.2.1', 'package', `english-words-${L}.json`), 'utf8'))) if (/^[a-z]+$/.test(w) && !(w in lvl)) lvl[w] = L;
const groups = {};
for (const [w, L] of Object.entries(lvl)) {
  const p = dict[w]; if (!p) continue; const ph = p.split(' '), vow = ph.map((x, i) => /\d/.test(x) ? i : -1).filter(i => i >= 0); if (!vow.length) continue;
  let k = -1; for (const i of vow) if (/1$/.test(ph[i])) k = i; if (k < 0) for (const i of vow) if (/2$/.test(ph[i])) k = i; if (k < 0) k = vow[vow.length - 1];
  const key = ph.slice(k).map(x => x.replace(/\d/, '')).join(' '); (groups[key] = groups[key] || []).push([w, vow.length, L]);
}
const txt = Object.entries(groups).map(([k, ws]) => k + '|' + ws.sort((a, b) => a[2] - b[2] || a[0].localeCompare(b[0])).map(([w, s]) => w + s).join(' ')).join('\n');
writeFileSync(join(process.cwd(), 'data', 'rhymes.txt'), txt); console.log('data/rhymes.txt: ' + Object.keys(groups).length + ' rhymes, ' + txt.length + ' bytes');
