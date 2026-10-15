import type { Figure, Option, Question } from './types';
import { sceneSvg, visualSvg } from './figural/render';

export { sceneSignature } from './figural/scene';
export const mod = (value: number, divisor = 360) => ((value % divisor) + divisor) % divisor;
export const SHAPES: Figure['shape'][] = ['triangle', 'square', 'circle', 'diamond'];
const shiftShape = (shape: Figure['shape'], a: Figure, b: Figure) => SHAPES[mod(SHAPES.indexOf(shape) + SHAPES.indexOf(b.shape) - SHAPES.indexOf(a.shape), 4)];
export const figureSignature = (figure: Figure, rotation = true) =>
  [figure.shape, figure.count, rotation ? mod(figure.angle) : 0, figure.fill].join(':');
const colors = ['#ffffff', '#052c5f', '#91acc4'];

export function figureMarkup(figure: Figure): string {
  const fill = colors[figure.fill];
  const style = ' fill="' + fill + '" stroke="#052c5f" stroke-width="2.5"';
  const shape = figure.shape === 'circle' ? '<circle cx="50" cy="45" r="20"' + style + '/>' :
    figure.shape === 'triangle' ? '<path d="M50 23 L73 64 L27 64 Z"' + style + '/>' :
    figure.shape === 'diamond' ? '<path d="M50 20 L73 45 L50 70 L27 45 Z"' + style + '/>' :
    '<rect x="29" y="24" width="42" height="42" rx="1"' + style + '/>';
  // Arrow supplies a visible orientation even for symmetric shapes.
  const arrow = '<path d="M50 16 L50 5 M45 10 L50 5 L55 10" fill="none" stroke="#052c5f" stroke-width="3" stroke-linecap="round"/>';
  const dots = Array.from({ length: figure.count }, (_, i) =>
    '<circle cx="' + (20 + i * 9) + '" cy="94" r="2.6" fill="#052c5f"/>').join('');
  return '<g transform="rotate(' + figure.angle + ' 50 45)">' + shape + arrow + '</g>' + dots;
}
export function figureSvg(figure: Figure): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="120" height="120">' +
    '<rect width="100" height="100" fill="white"/>' + figureMarkup(figure) + '</svg>';
}
// Soal figural mesin baru memakai `scenes`/`scene`; paket lama dari versi sebelumnya memakai `figures`/`figure`.
export const usesScenes = (question: Question) => Boolean(question.visual?.scenes) || question.options.some((option) => option.scene);
export const hasStimulus = (question: Question) => Boolean(question.visual?.scenes?.length || question.visual?.figures.length);
export const optionSvg = (option: Option) => option.scene ? sceneSvg(option.scene) : option.figure ? figureSvg(option.figure) : '';
export function questionSvg(question: Question, includeOptions = true): string {
  if (usesScenes(question)) return visualSvg(question, includeOptions);
  const figures = question.visual?.figures ?? [];
  const columns = question.visual?.columns ?? 4;
  const cell = 110;
  const topRows = Math.ceil(figures.length / columns);
  const optionsY = topRows * cell + (figures.length ? 14 : 0);
  const width = Math.max(columns, includeOptions ? 5 : 1) * cell;
  const height = optionsY + (includeOptions ? cell + 24 : 0);
  const pieces = figures.map((figure, index) => {
    const x = (index % columns) * cell;
    const y = Math.floor(index / columns) * cell;
    return '<g transform="translate(' + x + ' ' + y + ')"><rect x="1" y="1" width="100" height="100" rx="5" fill="white" stroke="#cbd9d3"/>' +
      (figure ? figureMarkup(figure) : '<text x="50" y="63" text-anchor="middle" font-family="Arial" font-size="34" fill="#173f3b">?</text>') + '</g>';
  });
  if (includeOptions) {
    question.options.forEach((option, index) => {
      if (!option.figure) return;
      pieces.push('<g transform="translate(' + index * cell + ' ' + optionsY + ')">' +
        '<rect x="1" y="1" width="100" height="100" rx="5" fill="white" stroke="#cbd9d3"/>' +
        figureMarkup(option.figure) + '<text x="50" y="120" text-anchor="middle" font-family="Arial" font-size="13" fill="#173f3b">' +
        String.fromCharCode(65 + index) + '</text></g>');
    });
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">' +
    '<rect width="100%" height="100%" fill="white"/>' + pieces.join('') + '</svg>';
}
export function solveFigure(question: Question): number {
  const visual = question.visual;
  if (!visual) throw new Error('Stimulus figural tidak tersedia.');
  const figures = visual.figures.filter((figure): figure is Figure => figure !== null);
  if (visual.kind === 'ketidaksamaan') {
    const signatures = question.options.map((option) => {
      const f = option.figure; if (!f) return '';
      return visual.oddRule === 'count-fill' ? String(mod(f.count - f.fill, 3)) : visual.oddRule === 'turn-count' ? String(mod(f.angle / 45 - f.count, 8)) : figureSignature(f, false);
    });
    const unique = signatures.map((signature, index) => ({ signature, index }))
      .filter(({ signature }) => signatures.filter((other) => other === signature).length === 1);
    if (unique.length !== 1 || new Set(signatures).size !== 2) throw new Error('Pola ketidaksamaan ambigu.');
    return unique[0].index;
  }
  let expected: Figure;
  if (visual.kind === 'analogi') {
    const [a, b, c] = figures;
    expected = { ...c, shape: shiftShape(c.shape, a, b), angle: mod(c.angle + b.angle - a.angle), count: c.count + b.count - a.count,
      fill: mod(c.fill + b.fill - a.fill, 3) };
  } else {
    const a = figures[figures.length - 2], b = figures[figures.length - 1];
    expected = { ...b, shape: shiftShape(b.shape, a, b), count: 2 * b.count - a.count, angle: mod(2 * b.angle - a.angle),
      fill: mod(2 * b.fill - a.fill, 3) };
  }
  const matches = question.options.map((option, index) => ({ option, index }))
    .filter(({ option }) => option.figure && figureSignature(option.figure) === figureSignature(expected));
  if (matches.length !== 1) throw new Error('Kunci figural tidak tunggal.');
  return matches[0].index;
}
