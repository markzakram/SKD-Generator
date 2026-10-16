import type { Part, Question, Scene } from '../types';
import { glyph } from './glyphs';

const FILL = ['#ffffff', '#b3b3b3', '#141414', 'none'];
const INK = '#141414';
const FONT = 'Arial, Helvetica, sans-serif';
const num = (value: number) => String(Math.round(value * 1000) / 1000);

export function partMarkup(p: Part): string {
  const fill = FILL[p.f] ?? FILL[0];
  if (p.g === 'poligon' || p.g === 'garis') {
    const pts = p.p ?? [], count = pts.length / 2, width = num(1.7 / p.s);
    const d = 'M' + Array.from({ length: count }, (_, i) => num(pts[i * 2]) + ' ' + num(pts[i * 2 + 1])).join('L') + (p.g === 'poligon' ? 'Z' : '');
    const transform = 'translate(' + num(p.x) + ' ' + num(p.y) + ') rotate(' + num(p.r) + ') scale(' + num(p.m ? -p.s : p.s) + ' ' + num(p.s) + ')';
    let head = '';
    if (p.g === 'garis' && p.h && count >= 2) {
      // Kepala digambar dari arah ruas terakhir: mata panah tertutup atau kait pendek melintang.
      const [ox, oy, qx, qy] = [pts[(count - 2) * 2], pts[(count - 2) * 2 + 1], pts[(count - 1) * 2], pts[(count - 1) * 2 + 1]], len = Math.hypot(qx - ox, qy - oy) || 1;
      const ux = (qx - ox) / len, uy = (qy - oy) / len, nx = -uy, ny = ux, long = 7.5 / p.s, wide = 3.9 / p.s, hook = 8.5 / p.s;
      head = p.h === 1 ?
        '<path d="M' + num(qx) + ' ' + num(qy) + 'L' + num(qx - ux * long + nx * wide) + ' ' + num(qy - uy * long + ny * wide) + 'L' + num(qx - ux * long - nx * wide) + ' ' + num(qy - uy * long - ny * wide) + 'Z" fill="' + INK + '" stroke="' + INK + '" stroke-width="' + width + '" stroke-linejoin="round"/>' :
        '<path d="M' + num(qx) + ' ' + num(qy) + 'L' + num(qx + (nx - ux * 0.35) * hook) + ' ' + num(qy + (ny - uy * 0.35) * hook) + '" fill="none" stroke="' + INK + '" stroke-width="' + width + '" stroke-linecap="round"/>';
    }
    return '<g transform="' + transform + '"><path d="' + d + '" fill="' + (p.g === 'garis' ? 'none' : fill) + '" stroke="' + INK + '" stroke-width="' + width + '" stroke-linejoin="round" stroke-linecap="round"/>' + head + '</g>';
  }
  return '<path d="' + glyph(p.g).d + '" fill="' + fill + '" stroke="' + INK + '" stroke-width="' + num(1.7 / p.s) + '" stroke-linejoin="round" transform="translate(' + num(p.x) + ' ' + num(p.y) + ') rotate(' + num(p.r) + ') scale(' + num(p.m ? -p.s : p.s) + ' ' + num(p.s) + ')"/>';
}
export const sceneMarkup = (s: Scene) => s.parts.map(partMarkup).join('');

const frame = (inner: string) => '<rect x="1" y="1" width="98" height="98" rx="3" fill="#ffffff" stroke="' + INK + '" stroke-width="1.6"/>' + inner;
const cell = (s: Scene | null, x: number, y: number) => '<g transform="translate(' + x + ' ' + y + ')">' + frame(s ?
  '<g transform="translate(50 50)">' + sceneMarkup(s) + '</g>' :
  '<text x="50" y="66" text-anchor="middle" font-family="' + FONT + '" font-weight="700" font-size="48" fill="' + INK + '">?</text>') + '</g>';
const label = (text: string, x: number, y: number, size = 20) => '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-family="' + FONT + '" font-weight="700" font-size="' + size + '" fill="' + INK + '">' + text + '</text>';

// Satu gambar (opsi) pada kotak 100 × 100.
export function sceneSvg(s: Scene): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="120" height="120">' + frame('<g transform="translate(50 50)">' + sceneMarkup(s) + '</g>') + '</svg>';
}
export const LAYOUT = { cell: 100, optionGap: 10, optionsWidth: 5 * 100 + 4 * 10 };
// Tata letak stimulus menurut jenis soal. Mengembalikan isi SVG, lebar, dan tinggi.
export function stimulusLayout(question: Question): { body: string; width: number; height: number } {
  const scenes = question.visual?.scenes ?? [];
  if (!scenes.length) return { body: '', width: 0, height: 0 };
  const kind = question.visual!.kind;
  if (kind === 'matriks') {
    const gap = 6, size = 3 * 100 + 2 * gap;
    return { body: scenes.map((s, i) => cell(s, (i % 3) * (100 + gap), Math.floor(i / 3) * (100 + gap))).join(''), width: size, height: size };
  }
  if (kind === 'analogi') {
    const gap = 30, signs = [':', '=', ':'];
    return { body: scenes.map((s, i) => cell(s, i * (100 + gap), 0)).join('') + signs.map((sign, i) => label(sign, 100 + gap / 2 + i * (100 + gap), 62, 34)).join(''),
      width: scenes.length * 100 + (scenes.length - 1) * gap, height: 100 };
  }
  const gap = 12;
  return { body: scenes.map((s, i) => cell(s, i * (100 + gap), 0)).join(''), width: scenes.length * 100 + (scenes.length - 1) * gap, height: 100 };
}
// Stimulus beserta (bila diminta) kelima opsi berhuruf, untuk layar, PDF, dan Word.
// `includeStimulus = false` menghasilkan deret opsi saja (dipakai untuk menyalin pilihan gambar).
export function visualSvg(question: Question, includeOptions: boolean, includeStimulus = true): string {
  const stimulus = includeStimulus ? stimulusLayout(question) : { body: '', width: 0, height: 0 };
  const optionsY = stimulus.height ? stimulus.height + 22 : 0;
  const width = Math.max(stimulus.width, includeOptions ? LAYOUT.optionsWidth : 0) + 2;
  const height = optionsY + (includeOptions ? 100 + 28 : 0) + 2;
  let body = stimulus.height ? '<g transform="translate(' + (1 + (width - 2 - stimulus.width) / 2) + ' 1)">' + stimulus.body + '</g>' : '';
  if (includeOptions) {
    const left = 1 + (width - 2 - LAYOUT.optionsWidth) / 2;
    body += question.options.map((option, i) => option.scene ?
      '<g transform="translate(' + (left + i * 110) + ' ' + (optionsY + 1) + ')">' + cell(option.scene, 0, 0) + label(String.fromCharCode(65 + i), 50, 120, 17) + '</g>' : '').join('');
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '"><rect width="100%" height="100%" fill="#ffffff"/>' + body + '</svg>';
}
