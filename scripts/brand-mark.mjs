/* the-daily.studio mark: a hexagon drawn as a cube (the Y), with T, D and S on its three faces and a small waveform
   rising from the foot of the cube. One geometry, used by the app (inline), the favicon, the icons and the brand sheet.
   viewBox 0 0 100 100. No fonts: the letters are drawn as strokes so the mark looks the same everywhere. */
const R = 44, CX = 50, CY = 50, DX = +(R * Math.cos(Math.PI / 6)).toFixed(2);
const V = { t: [CX, CY - R], ur: [CX + DX, CY - R / 2], lr: [CX + DX, CY + R / 2], b: [CX, CY + R], ll: [CX - DX, CY + R / 2], ul: [CX - DX, CY - R / 2] };
const P = ([x, y]) => x + ' ' + y;
const f = n => +n.toFixed(2);
/** @param {{hex:string, ink:string, bars?:boolean, k?:number, letters?:boolean}} o  hex = outline / cube / waveform colour, ink = letters, k = stroke weight multiplier */
export function markInner(o) {
  const { hex, ink, bars = true, k = 1, letters = true, cls = false } = o, hc = cls ? ' class="h"' : '', ic = cls ? ' class="i"' : '', sw = 3.3 * k, yw = 2.1 * k, lw = 3 * k;
  let s = `<path${hc} d="M${P(V.t)}L${P(V.ur)}L${P(V.lr)}L${P(V.b)}L${P(V.ll)}L${P(V.ul)}Z" fill="none" stroke="${hex}" stroke-width="${f(sw)}" stroke-linejoin="miter"/>`;
  s += `<path${hc} d="M${P(V.ul)}L${CX} ${CY}L${P(V.ur)}M${CX} ${CY}L${P(V.b)}" fill="none" stroke="${hex}" stroke-width="${f(yw)}" stroke-linecap="butt" stroke-linejoin="miter"/>`;
  if (bars) {   // waveform: bars stand on the two lower edges, mirrored around the stem so the mark stays balanced
    const edge = x => V.b[1] - Math.abs(x - CX) * ((V.b[1] - V.lr[1]) / DX) - sw / 2 - .4, offs = [-15, -10, -5, 5, 10, 15], hs = [6, 10, 14, 14, 10, 6];
    s += `<path${hc} d="${offs.map((o, i) => `M${CX + o} ${f(edge(CX + o))}V${f(edge(CX + o) - hs[i])}`).join('')}" fill="none" stroke="${hex}" stroke-width="${f(2 * k)}" stroke-linecap="butt"/>`;
  }
  if (letters) {
    const g = (x, y, d) => `<path${ic} transform="translate(${x} ${y})" d="${d}" fill="none" stroke="${ink}" stroke-width="${f(lw)}" stroke-linejoin="miter" stroke-linecap="butt"/>`;
    s += g(50, 29.5, 'M-6.4 -6.8H6.4M0 -6.8V7.6');                                                      // T
    s += g(29.6, 55.4, 'M-3.8 -7.6H.4A7.8 7.6 0 0 1 .4 7.6H-3.8Z');                                      // D
    s += g(68.4, 55.4, 'M5 -4.6C4.1 -6.8 2.3 -7.8 0 -7.8C-3.2 -7.8 -5 -6.3 -5 -4C-5 -1.8 -3 -.9 0 0C3 .9 5 1.8 5 4.1C5 6.4 3.2 7.8 0 7.8C-2.3 7.8 -4.1 6.9 -5 4.9'); // S
  }
  return s;
}
export const markSvg = (o, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${extra}>${markInner(o)}</svg>`;
export const BRAND = { sage: '#7dbf9b', deep: '#264238', black: '#0d0f10', paper: '#e8e8e6', gold: '#d4a25a' };
