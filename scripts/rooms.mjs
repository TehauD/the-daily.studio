/* the-daily.studio · rooms: parts of the app that the hosted site loads the first time they are used, instead of with the page (2.40).
   The single-file index.html (opened from disk, CodePen, any static host) still carries every part inline; only dist/ is split.

   How a room works
     · A room is one or more parts from src/parts, listed in ROOMS below. Its code runs in its own file (dist/rooms/<id>.<hash>.js),
       wrapped so that it sees the core's names exactly as it did inline:
         names the core never reassigns (const, function, class) are handed to it once, as local constants (fast);
         names the core can reassign (let, var: S, REC …) are read and written live, through getters and setters.
     · The core keeps a placeholder for each room name it mentions: a room function becomes a stand-in that loads the room and
       then calls the real one (so it returns a promise); anything else is undefined until the room has loaded (guard it with
       typeof, or `await room(id)` first). When the room arrives, every placeholder is replaced by the real thing.
     · room(id) loads it (one <script>, checked with Subresource Integrity, cached by the service worker for offline use).
   Rules the build enforces: a room may not use another room's names; the core may mention a room's names only as above. */
import { tokens } from './minify.mjs';

/** id → the parts it is made of. Pick parts that are big and used rarely, whose entry points are functions the core calls. */
export const ROOMS = {
  tx: ['09b-tx-engine.js'],          /* the transcription engine: its panel stays in the core and loads it when you transcribe */
  midi: ['47-midi-import.js'],       /* opening a .mid file */
  shower: ['73f-shower.js'],         /* Shower mode (Backstage) */
  tune: ['90-tune.js']               /* vocal tuning (2.43): loaded when a take is first tuned */
};
export const roomParts = new Set(Object.values(ROOMS).flat());

const START = new Set([undefined, ';', '}']);
const CONT = new Set(['.', '?', ':', '&', '|', '+', '-', '*', '/', '%', '=', '<', '>', ',', '(', '[', '^']);
const KW = new Set(['break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'let', 'static', 'await', 'async', 'of', 'get', 'set', 'true', 'false', 'null', 'undefined', 'arguments']);

/** the names a script declares at its top level: Map name → 'fn' | 'class' | 'const' | 'let' */
export function topNames(src) {
  const tk = tokens(src).filter(t => t.t !== 'ws'), out = new Map(); let depth = 0;
  const sig = (i, d) => { while (tk[i] && tk[i].t === 'nl') i += d; return tk[i]; };
  const atStart = i => { const p = tk[i - 1]; return !p || p.t === 'nl' || (p.t === 'p' && START.has(p.v)); };
  for (let i = 0; i < tk.length; i++) {
    const t = tk[i];
    if (t.t === 'p') { if ('([{'.includes(t.v)) depth++; else if (')]}'.includes(t.v)) depth--; continue; }
    if (depth || t.t !== 'word') continue;
    if ((t.v === 'function' || t.v === 'class') && (atStart(i) || (tk[i - 1] && tk[i - 1].v === 'async' && atStart(i - 1)))) {
      let j = i + 1; if (tk[j] && tk[j].v === '*') j++; if (tk[j] && tk[j].t === 'word') out.set(tk[j].v, t.v === 'class' ? 'class' : 'fn'); continue;
    }
    if ((t.v === 'const' || t.v === 'let' || t.v === 'var') && atStart(i)) {
      const kind = t.v === 'const' ? 'const' : 'let'; let j = i + 1;
      for (;;) {
        const nm = tk[j]; if (!nm || nm.t !== 'word') throw new Error('rooms: top-level destructuring is not supported (near ' + (nm && nm.v) + ')');
        out.set(nm.v, kind);
        let d = 0, k = j + 1, next = false;
        for (; k < tk.length; k++) {
          const x = tk[k];
          if (x.t === 'p') { if ('([{'.includes(x.v)) d++; else if (')]}'.includes(x.v)) d--; else if (!d && x.v === ';') break; else if (!d && x.v === ',') { next = true; break; } continue; }
          if (x.t === 'nl' && !d) { const p = sig(k - 1, -1), n = sig(k + 1, 1); const pc = p && p.t === 'p' && !/^[)\]}]$/.test(p.v) && p.v !== '++' && p.v !== '--'; const nc = n && n.t === 'p' && CONT.has(n.v); if (!pc && !nc && !(n && n.t === 'tpl')) break; }
        }
        i = k; if (!next) break; j = k + 1; while (tk[j] && tk[j].t === 'nl') j++;
      }
    }
  }
  return out;
}
/** every word a script uses as a name (not after a dot, not a keyword) */
export function refs(src) {
  const tk = tokens(src).filter(t => t.t !== 'ws' && t.t !== 'nl'), out = new Set();
  tk.forEach((t, i) => { if (t.t === 'word' && !KW.has(t.v) && !/^\d/.test(t.v) && !(tk[i - 1] && tk[i - 1].t === 'p' && tk[i - 1].v === '.' && !(tk[i - 2] && tk[i - 2].v === '.'))) out.add(t.v); });
  return out;
}

/**
 * Split the parts into the core and the rooms.
 * parts: [[file, source]] in build order. Returns { core: [[file, source]], header, footer, rooms: { id: code } } where header and footer are
 * the core's generated placeholders and hand-over table, and each room's code is a complete script for dist/rooms/.
 */
export function splitRooms(parts) {
  const core = parts.filter(([f]) => !roomParts.has(f)), coreSrc = core.map(([, s]) => s).join('\n');
  const coreNames = topNames(coreSrc), coreRefs = refs(coreSrc), rooms = {}, holders = [], applies = [], usedConst = new Set(), usedLive = new Set(), allRoomNames = new Map();
  for (const [id, files] of Object.entries(ROOMS)) {
    const src = files.map(f => { const p = parts.find(([x]) => x === f); if (!p) throw new Error('rooms: no part ' + f); return '/* >>> parts/' + f + ' */\n' + p[1]; }).join('\n');
    const own = topNames(src); own.forEach((k, n) => { if (coreNames.has(n)) throw new Error('rooms: ' + n + ' is declared in the core and in room ' + id); if (allRoomNames.has(n)) throw new Error('rooms: ' + n + ' is declared in two rooms'); allRoomNames.set(n, id); });
    const use = [...refs(src)].filter(n => coreNames.has(n) && !own.has(n)), c = use.filter(n => coreNames.get(n) !== 'let'), v = use.filter(n => coreNames.get(n) === 'let');
    c.forEach(n => usedConst.add(n)); v.forEach(n => usedLive.add(n));
    const exp = [...own.keys()];
    rooms[id] = { src, exp, c, v };
    const mention = exp.filter(n => coreRefs.has(n));
    mention.forEach(n => { if (own.get(n) === 'let') throw new Error('rooms: the core uses ' + n + ', a variable room ' + id + ' can reassign; make it a const or keep the part in the core'); });
    mention.forEach(n => holders.push(own.get(n) === 'fn' ? `${n} = __roomFn('${id}', '${n}')` : n));
    applies.push(`case '${id}': ${mention.map(n => `${n} = x.${n};`).join(' ')} break;`);
  }
  for (const [id, r] of Object.entries(rooms)) {      /* a room may not lean on another room */
    const other = [...refs(r.src)].filter(n => allRoomNames.has(n) && allRoomNames.get(n) !== id); if (other.length) throw new Error('rooms: room ' + id + ' uses ' + other.join(', ') + ' from another room');
  }
  const header = holders.length ? `let ${holders.join(', ')};\n` : '';
  const footer = `ROOM.sc = { c: { ${[...usedConst].join(', ')} }, v: { ${[...usedLive].map(n => `get ${n}() { return ${n}; }, set ${n}(x) { ${n} = x; }`).join(', ')} } };\nROOM.apply = (id, x) => { switch (id) { ${applies.join(' ')} } };\n`;
  const code = {};
  for (const [id, r] of Object.entries(rooms)) {
    code[id] = `/* the-daily.studio room "${id}" (scripts/rooms.mjs): loaded the first time it is used */\nwindow.__dailyRoom('${id}', function (__SC) { with (__SC.v) { return (function () { 'use strict'; const { ${r.c.join(', ')} } = __SC.c;\n${r.src}\nreturn { ${r.exp.join(', ')} }; })(); } });\n`;
  }
  return { core, header, footer, rooms: code, info: Object.fromEntries(Object.entries(rooms).map(([id, r]) => [id, { exports: r.exp.length, shared: r.c.length, live: r.v }])) };
}
