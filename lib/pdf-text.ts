import type { jsPDF } from 'jspdf';
import { mathParts, mathSvg, sizedMathSvg } from './math';
import { COLOR_HEX, richRuns } from './richtext';
import type { Raster } from './export';

const MM = 25.4 / 72;
type Span = { text?: string; image?: Raster; width: number; ascent: number; descent: number; bold: boolean; strike: boolean; color: string };
export type PdfTextLine = { spans: Span[]; height: number; baseline: number; width: number; size: number };
// Both plain and formatted prose use the same PDF font and font metrics. Only
// formulae are images; bold/color/strike remain selectable text, including tables.
export function pdfTextRenderer(pdf: jsPDF, rasterize: (svg: string) => Promise<Raster>) {
  const images = new Map<string, Promise<Raster>>();
  const setFont = (size: number, bold: boolean) => { pdf.setFont('times', bold ? 'bold' : 'normal'); pdf.setFontSize(size); };
  // jsPDF menggambar teks tanpa kerning, sedangkan getTextWidth menghitung dengan kerning ("Yo", "Wa", "Te" lebih sempit): ukur tanpa kerning supaya kata berikutnya mulai tepat di ujung kata yang digambar.
  const textWidth = (text: string) => pdf.getStringUnitWidth(text, { doKerning: false }) * pdf.getFontSize() / pdf.internal.scaleFactor;
  async function layout(text: string, size: number, bold: boolean, maxWidth: number, literal = false): Promise<PdfTextLine[]> {
    const lines: PdfTextLine[] = []; let spans: Span[] = [], width = 0;
    const flush = () => {
      if (!spans.length) return;
      const ascent = Math.max(size * MM * .85, ...spans.map(s => s.ascent)), descent = Math.max(size * MM * .25, ...spans.map(s => s.descent));
      lines.push({ spans, size, width, height: Math.max(size * MM * 1.5, ascent + descent + size * MM * .4), baseline: ascent + size * MM * .1 });
      spans = []; width = 0;
    };
    const push = (span: Span) => {
      if (width + span.width > maxWidth + .001 && spans.length) flush();
      if (!spans.length && span.text?.trim() === '') return;
      spans.push(span); width += span.width;
    };
    // Run yang bersambung tanpa spasi ("**pelatihan lanjutan**" lalu ".", atau rumus sebaris lalu ",") adalah satu kata: pindah baris bersama, tidak dipotong di antara run.
    let word: Span[] = [], wordWidth = 0;
    const commit = () => {
      if (!word.length) return;
      if (width + wordWidth > maxWidth + .001 && spans.length) flush();
      spans.push(...word); width += wordWidth; word = []; wordWidth = 0;
    };
    const glue = (span: Span) => {
      if (wordWidth + span.width > maxWidth + .001 && word.length) { commit(); flush(); } // satu kata lebih panjang dari baris: dipotong per bagian
      word.push(span); wordWidth += span.width;
    };
    const endLine = () => { commit(); flush(); };
    for (const run of richRuns(text)) {
      const heavy = bold || !!run.bold, color = COLOR_HEX[run.color ?? ''] ?? '000000', strike = !!run.strike;
      for (const part of literal ? [{ kind: 'text' as const, value: run.text }] : mathParts(run.text)) {
        if (part.kind === 'math') {
          const key = [part.value, size, heavy, color].join('|');
          if (!images.has(key)) images.set(key, rasterize(sizedMathSvg(part.value, size * 96 / 72, { bold: heavy }).replaceAll('#142b49', '#' + color)));
          const image = await images.get(key)!, dimensions = mathSvg(part.value, { bold: heavy });
          const scale = Math.min(1, maxWidth / (dimensions.width * size * MM));
          const span = { image, width: dimensions.width * size * MM * scale, ascent: (dimensions.height - dimensions.depth) * size * MM * scale, descent: dimensions.depth * size * MM * scale, bold: heavy, color, strike };
          if (part.display) { endLine(); push(span); flush(); } else glue(span);
        } else {
          // Core Times supports these standard typographic characters. Remaining
          // logical notation is converted before it reaches prose (mathParts).
          const prose = part.value.replace(/\r\n?/g, '\n');
          for (const token of prose.split(/(\n|[ \t]+)/).filter(Boolean)) {
            if (token === '\n') { endLine(); continue; }
            const blank = /^[ \t]+$/.test(token);
            if (blank) commit();
            let rest = token;
            while (rest) {
              setFont(size, heavy);
              let end = rest.length;
              while (end > 1 && textWidth(rest.slice(0, end)) > maxWidth) end--;
              const value = rest.slice(0, end), span = { text: value, width: textWidth(value), ascent: size * MM * .85, descent: size * MM * .25, bold: heavy, color, strike };
              if (blank) push(span); else glue(span);
              rest = rest.slice(end);
            }
          }
        }
      }
    }
    endLine(); return lines;
  }
  function draw(line: PdfTextLine, x: number, y: number) {
    for (const span of line.spans) {
      if (span.image) pdf.addImage(span.image.url, 'PNG', x, y + line.baseline - span.ascent, span.width, span.ascent + span.descent);
      else { setFont(line.size, span.bold); pdf.setTextColor('#' + span.color); pdf.text(span.text ?? '', x, y + line.baseline); }
      if (span.strike) { pdf.setDrawColor('#' + span.color); pdf.setLineWidth(Math.max(.2, line.size * MM * .045)); pdf.line(x, y + line.baseline - line.size * MM * .3, x + span.width, y + line.baseline - line.size * MM * .3); }
      x += span.width;
    }
    pdf.setTextColor(0);
  }
  return { layout, draw };
}
