/* the-daily.studio · a small, dependency-free minifier for the build (no packages: the build must run before `npm ci`).
   It only removes what cannot change what the code does:
     JS   comments, indentation, blank lines and the spaces around punctuation. Line breaks are kept (so automatic semicolons
          behave exactly as before), names are never shortened, and strings, templates and regular expressions are copied byte
          for byte.
     CSS  comments, runs of whitespace, and the spaces around { } ; , and >; strings are copied as they are.
   The build compares the token list before and after, so a minified copy that differs in anything but whitespace fails the build. */

const WORD = /[A-Za-z0-9_$\\#\u0080-￿]/;
const KEYWORDS_BEFORE_EXPR = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);

/** split a script into tokens: { t: 'ws' | 'nl' | 'word' | 'num' | 'str' | 'tpl' | 're' | 'p', v } (comments become ws/nl) */
export function tokens(src) {
  const out = [], n = src.length, tpl = [];   /* tpl: brace depth inside each open template ${ } */
  let i = 0, last = null;                      /* last significant token, to tell a regex from a division */
  const push = (t, v) => { out.push({ t, v }); if (t !== 'ws' && t !== 'nl') last = { t, v }; };
  const reOk = () => !last || (last.t === 'p' && !/^[)\]]$/.test(last.v) && last.v !== '++' && last.v !== '--') || (last.t === 'word' && KEYWORDS_BEFORE_EXPR.has(last.v));
  /* the text part of a template, from i (just after ` or a closing }) to the closing ` or the next ${ */
  const tplPart = start => {
    let j = i; while (j < n) { const c = src[j]; if (c === '\\') { j += 2; continue; } if (c === '`') { j++; break; } if (c === '$' && src[j + 1] === '{') { j += 2; tpl.push(0); break; } j++; }
    if (j > n) throw new Error('unterminated template at ' + start);
    push('tpl', src.slice(start, j)); i = j;
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\u2028' || c === '\u2029' || c === '\ufeff' || c === '\v' || c === '\f') {
      let j = i, nl = false; while (j < n && /[ \t\r\n\u2028\u2029\ufeff\v\f]/.test(src[j])) { if (/[\n\r\u2028\u2029]/.test(src[j])) nl = true; j++; }
      push(nl ? 'nl' : 'ws', src.slice(i, j)); i = j; continue;
    }
    if (c === '/' && d === '/') { let j = i + 2; while (j < n && !/[\n\r\u2028\u2029]/.test(src[j])) j++; push('ws', src.slice(i, j)); i = j; continue; }
    if (c === '/' && d === '*') { const j = src.indexOf('*/', i + 2); if (j < 0) throw new Error('unterminated comment at ' + i); const body = src.slice(i, j + 2); push(/[\n\r\u2028\u2029]/.test(body) ? 'nl' : 'ws', body); i = j + 2; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < n && src[j] !== c) { if (src[j] === '\\') j++; else if (src[j] === '\n') throw new Error('line break in a string at ' + i); j++; } push('str', src.slice(i, j + 1)); i = j + 1; continue; }
    if (c === '`') { const s0 = i; i++; tplPart(s0); continue; }
    if (c === '}' && tpl.length && tpl[tpl.length - 1] === 0) { tpl.pop(); const s0 = i; i++; tplPart(s0); continue; }
    if (c === '/' && reOk()) {
      let j = i + 1, cls = false; while (j < n) { const x = src[j]; if (x === '\\') { j += 2; continue; } if (x === '\n') throw new Error('line break in a regex at ' + i); if (cls) { if (x === ']') cls = false; } else if (x === '[') cls = true; else if (x === '/') break; j++; }
      j++; while (j < n && /[a-z]/.test(src[j])) j++; push('re', src.slice(i, j)); i = j; continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(d))) {
      const m = /^(?:0[xX][0-9a-fA-F_]+n?|0[bBoO][0-9_]+n?|(?:[0-9][0-9_]*\.?[0-9_]*|\.[0-9][0-9_]*)(?:[eE][+-]?[0-9][0-9_]*)?n?)/.exec(src.slice(i, i + 64)); push('num', m[0]); i += m[0].length; continue;
    }
    if (WORD.test(c)) { let j = i; while (j < n && WORD.test(src[j])) j++; push('word', src.slice(i, j)); i = j; continue; }
    if ((c === '+' || c === '-') && d === c) { push('p', c + c); i += 2; continue; }
    if (c === '{' && tpl.length) tpl[tpl.length - 1]++;
    else if (c === '}' && tpl.length) tpl[tpl.length - 1]--;
    push('p', c); i++;
  }
  if (tpl.length) throw new Error('unterminated template expression');
  return out;
}

/** JS: comments and needless spaces out, line breaks and every literal kept */
export function minifyJS(src) {
  /* pieces in an array and the last two characters in a variable: reading the end of one growing string would flatten it at every token */
  const tk = tokens(src), parts = []; let gap = '', a2 = '', a = '';   /* gap: '' | ' ' | '\n' since the last token written; a2 a: the last two characters */
  const put = s => { parts.push(s); if (s.length >= 2) { a2 = s[s.length - 2]; a = s[s.length - 1]; } else if (s.length) { a2 = a; a = s; } };
  for (const x of tk) {
    if (x.t === 'nl') { gap = '\n'; continue; }
    if (x.t === 'ws') { if (!gap) gap = ' '; continue; }
    const v = x.v, b = v[0], started = parts.length > 0;
    if (gap === '\n' && started) put('\n');
    else if (gap && started) {
      const need = (WORD.test(a) && WORD.test(b)) || (WORD.test(a) && x.t === 'num') || (/[0-9]/.test(a) && b === '.') ||
        ((a === '+' || a === '-') && b === a) || (a === '/' && (b === '/' || b === '*')) || (a === '<' && b === '!') || (a === '-' && a2 === '-' && b === '>');
      if (need) put(' ');
    }
    put(v); gap = '';
  }
  return parts.join('').trim() + '\n';   /* no blanket replace here: it would reach inside template literals; the loop never writes two line breaks in a row */
}

/** CSS: comments and whitespace that carries no meaning; strings copied as they are */
export function minifyCSS(src) {
  let out = '', i = 0; const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? n : j + 2; if (!/\s$/.test(out)) out += ' '; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < n && src[j] !== c) { if (src[j] === '\\') j++; j++; } out += src.slice(i, j + 1); i = j + 1; continue; }
    if (/\s/.test(c)) { while (i < n && /\s/.test(src[i])) i++; out += ' '; continue; }
    out += c; i++;
  }
  /* outside strings only: the strings above were copied whole, so these never see their inside */
  return out.replace(/ ?([{};,>]) ?/g, (m, p, off, s) => (inStr(s, off) ? m : p)).replace(/;}/g, (m, off, s) => (inStr(s, off) ? m : '}')).trim();
}
/** is position k of a minified stylesheet inside a quoted string? (cheap: count unescaped quotes before it on the same rule) */
function inStr(s, k) { let q = null; for (let i = Math.max(0, s.lastIndexOf('}', k)); i < k; i++) { const c = s[i]; if (q) { if (c === '\\') i++; else if (c === q) q = null; } else if (c === '"' || c === "'") q = c; } return !!q; }
