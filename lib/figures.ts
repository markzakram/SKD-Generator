import type { Figure, Question } from './types';
export const mod = (value: number, divisor = 360) => ((value % divisor) + divisor) % divisor;
export const figureSignature = (figure: Figure, rotation = true) =>
  [figure.shape, figure.count, rotation ? mod(figure.angle) : 0, figure.fill].join(':');
const colors = ['#ffffff', '#173f3b', '#99b6ad'];

export function figureMarkup(figure: Figure): string {
  const fill = colors[figure.fill];
  const style = ' fill="' + fill + '" stroke="#173f3b" stroke-width="2.5"';
  const shape = figure.shape === 'circle' ? '<circle cx="50" cy="45" r="20"' + style + '/>' :
    figure.shape === 'triangle' ? '<path d="M50 23 L73 64 L27 64 Z"' + style + '/>' :
    figure.shape === 'diamond' ? '<path d="M50 20 L73 45 L50 70 L27 45 Z"' + style + '/>' :
    '<rect x="29" y="24" width="42" height="42" rx="1"' + style + '/>';
  // Arrow supplies a visible orientation even for symmetric shapes.
  const arrow = '<path d="M50 16 L50 5 M45 10 L50 5 L55 10" fill="none" stroke="#173f3b" stroke-width="3" stroke-linecap="round"/>';
  const dots = Array.from({ length: figure.count }, (_, i) =>
    '<circle cx="' + (20 + i * 9) + '" cy="94" r="2.6" fill="#173f3b"/>').join('');
  return '<g transform="rotate(' + figure.angle + ' 50 45)">' + shape + arrow + '</g>' + dots;
}
export function figureSvg(figure: Figure): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="120" height="120">' +
    '<rect width="100" height="100" fill="white"/>' + figureMarkup(figure) + '</svg>';
}
export function questionSvg(question: Question, includeOptions = true): string {
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
    const signatures = question.options.map((option) => option.figure ? figureSignature(option.figure, false) : '');
    const unique = signatures.map((signature, index) => ({ signature, index }))
      .filter(({ signature }) => signatures.filter((other) => other === signature).length === 1);
    if (unique.length !== 1 || new Set(signatures).size !== 2) throw new Error('Pola ketidaksamaan ambigu.');
    return unique[0].index;
  }
  let expected: Figure;
  if (visual.kind === 'analogi') {
    const [a, b, c] = figures;
    expected = { ...c, angle: mod(c.angle + b.angle - a.angle), count: c.count + b.count - a.count,
      fill: mod(c.fill + b.fill - a.fill, 3) };
  } else {
    const a = figures[figures.length - 2], b = figures[figures.length - 1];
    expected = { ...b, count: 2 * b.count - a.count, angle: mod(2 * b.angle - a.angle),
      fill: mod(2 * b.fill - a.fill, 3) };
  }
  const matches = question.options.map((option, index) => ({ option, index }))
    .filter(({ option }) => option.figure && figureSignature(option.figure) === figureSignature(expected));
  if (matches.length !== 1) throw new Error('Kunci figural tidak tunggal.');
  return matches[0].index;
}
