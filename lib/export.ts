import { LABELS } from './config';
import { questionSvg } from './figures';
import type { ExportContent, Package, Question, Settings } from './types';

const letter = (index: number) => String.fromCharCode(65 + index);
const name = (text: string) => text.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'skd';
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export function exportJson(packages: Package[], settings: Settings) {
  download(new Blob([JSON.stringify({ version: 1, settings, packages }, null, 2)], { type: 'application/json' }), name(settings.title) + '.json');
}
function csvCell(text: unknown): string {
  const original = String(text ?? '');
  // Protect spreadsheet imports from interpreting question text as a formula.
  const value = /^[=+@\-\t\r]/.test(original) ? "'" + original : original;
  return '"' + value.replaceAll('"', '""') + '"';
}
export function exportCsv(packages: Package[], settings: Settings) {
  const headers = ['Paket', 'Nomor', 'Subtes', 'Materi', 'Submateri', 'Kesulitan', 'Bloom', 'Soal', 'A', 'B', 'C', 'D', 'E',
    'Kunci', 'Poin A', 'Poin B', 'Poin C', 'Poin D', 'Poin E', 'Pembahasan', 'Alasan A', 'Alasan B', 'Alasan C', 'Alasan D', 'Alasan E', 'Stimulus JSON', 'Sumber'];
  const rows = packages.flatMap((pack) => pack.questions.map((q) => [pack.id, q.no, q.subtest, q.topic, q.subtopic, LABELS[q.difficulty],
    q.bloom ?? '', q.stem, ...q.options.map((option) => option.text), letter(q.answer), ...q.options.map((option) => option.score),
    q.explanation, ...q.options.map((option) => option.reason),
    q.visual || q.table ? JSON.stringify({ visual: q.visual, table: q.table, figures: q.options.map((option) => option.figure) }) : '', q.source]));
  download(new Blob(['\ufeff' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }),
    name(settings.title) + '.csv');
}
async function rasterize(question: Question): Promise<{ data: Uint8Array; url: string; width: number; height: number }> {
  const svg = questionSvg(question);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Gambar figural gagal disiapkan.')); img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = img.width * 3; canvas.height = img.height * 3;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas tidak tersedia.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    const binary = atob(dataUrl.split(',')[1]);
    return { data: Uint8Array.from(binary, (char) => char.charCodeAt(0)), url: dataUrl, width: img.width, height: img.height };
  } finally { URL.revokeObjectURL(url); }
}
const plain = (text: string) => text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—−]/g, '-')
  .replace(/→/g, ' -> ').replace(/¬/g, 'bukan ').replace(/…/g, '...').replace(/[•∙]/g, '-')
  .replace(/≥/g, '>=').replace(/≤/g, '<=');

export async function pdfBlob(packages: Package[], settings: Settings, content: ExportContent): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  let y = 16, first = true;
  const page = () => { pdf.addPage(); y = 16; };
  const room = (height: number) => { if (y + height > 279) page(); };
  const text = (value: string, size = 10, bold = false, space = 2) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(plain(value), 178) as string[];
    const lineHeight = size * 0.3528 * 1.35;
    for (const line of lines) { room(lineHeight); pdf.text(line, 16, y + lineHeight * 0.8); y += lineHeight; }
    y += space;
  };
  for (const pack of packages) {
    if (!first) page(); first = false;
    text(settings.title, 17, true, 3);
    text(pack.id + ' · ' + pack.questions.length + ' soal · ' + pack.duration + ' menit', 10, false, 2);
    text('Seed: ' + pack.seed + ' | ' + (content === 'soal' ? 'Naskah soal' : content === 'kunci' ? 'Kunci jawaban' : 'Soal dan pembahasan'), 9, false, 7);
    for (const q of pack.questions) {
      if (content === 'kunci') {
        room(13);
        text(q.no + '. ' + q.subtest + ' — ' + letter(q.answer) +
          (q.subtest === 'TKP' ? ' | ' + q.options.map((option, i) => letter(i) + ': ' + option.score).join(' · ') : ''), 10, false, 1);
        continue;
      }
      const image = q.visual ? await rasterize(q) : null;
      const imageWidth = image ? Math.min(q.visual?.kind === 'matriks' ? 145 : 172, image.width * 0.3) : 0;
      const imageHeight = image ? imageWidth * image.height / image.width : 0;
      const measure = (value: string, size = 10, gap = 2) => {
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(size);
        return (pdf.splitTextToSize(plain(value), 178) as string[]).length * size * 0.3528 * 1.35 + gap;
      };
      const header = 'Soal ' + q.no + ' | ' + q.subtest + ' | ' + q.subtopic + ' | ' + LABELS[q.difficulty] + (q.bloom ? ' | ' + q.bloom : '');
      const tableHeight = q.table ? measure(q.table.headers.join(' | '), 9, 1) +
        q.table.rows.reduce((sum, row) => sum + measure(row.join(' | '), 9, 1), 0) + 3 : 0;
      const optionsHeight = image ? imageHeight + 6 : q.options.reduce((sum, option, index) => sum + measure(letter(index) + '. ' + option.text, 10, 1), 0);
      room(Math.min(260, measure(header, 9, 3) + measure(q.stem, 10, 3) + tableHeight + optionsHeight + 7));
      text('Soal ' + q.no + ' | ' + q.subtest + ' | ' + q.subtopic + ' | ' + LABELS[q.difficulty] + (q.bloom ? ' | ' + q.bloom : ''), 9, true, 3);
      text(q.stem, 10, false, 3);
      if (q.table) {
        text(q.table.headers.join(' | '), 9, true, 1);
        q.table.rows.forEach((row) => text(row.join(' | '), 9, false, 1));
        y += 3;
      }
      if (image) {
        room(imageHeight + 6); pdf.addImage(image.url, 'PNG', 16, y, imageWidth, imageHeight); y += imageHeight + 6;
      } else q.options.forEach((option, i) => text(letter(i) + '. ' + option.text, 10, false, 1));
      if (content === 'pembahasan') {
        room(20); text('Jawaban: ' + letter(q.answer), 10, true, 2); text(q.explanation, 9, false, 3);
        q.options.forEach((option, i) => text(letter(i) + (q.subtest === 'TKP' ? ' (' + option.score + ' poin)' : '') + ': ' + option.reason, 9, false, 2));
      }
      y += 7;
    }
  }
  const count = pdf.getNumberOfPages();
  for (let i = 1; i <= count; i++) { pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(110); pdf.text(i + ' / ' + count, 194, 289, { align: 'right' }); }
  return pdf.output('blob');
}

export async function wordBlob(packages: Package[], settings: Settings, content: ExportContent): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableCell, TableRow, WidthType, BorderStyle } = await import('docx');
  type Child = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;
  const paragraph = (text: string, bold = false, size = 22, keepNext = false) => new Paragraph({
    keepNext, spacing: { after: 100 }, children: [new TextRun({ text, bold, size, font: 'Calibri' })],
  });
  const children: Child[] = [];
  for (let i = 0; i < packages.length; i++) {
    const pack = packages[i];
    children.push(new Paragraph({ pageBreakBefore: i > 0, spacing: { after: 160 },
      children: [new TextRun({ text: settings.title, bold: true, size: 32, color: '000000' })] }),
      paragraph(pack.id + ' · ' + pack.questions.length + ' soal · ' + pack.duration + ' menit'),
      paragraph('Seed: ' + pack.seed, false, 18));
    for (const q of pack.questions) {
      if (content === 'kunci') {
        children.push(paragraph(q.no + '. ' + q.subtest + ' — ' + letter(q.answer) +
          (q.subtest === 'TKP' ? ' | ' + q.options.map((option, j) => letter(j) + ': ' + option.score).join(' · ') : '')));
        continue;
      }
      children.push(new Paragraph({ keepNext: true, spacing: { before: 200, after: 100 }, children: [
        new TextRun({ text: 'Soal ' + q.no + ' | ' + q.subtest + ' | ' + q.subtopic + ' | ' + LABELS[q.difficulty] + (q.bloom ? ' | ' + q.bloom : ''), bold: true, size: 20 }),
      ] }));
      q.stem.split('\n').filter(Boolean).forEach((line) => children.push(paragraph(line, false, 22, Boolean(q.visual || q.table))));
      if (q.table) {
        const widths = q.table.headers.map(() => Math.floor(9900 / q.table!.headers.length));
        const border = { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' };
        children.push(new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths,
          rows: [q.table.headers, ...q.table.rows].map((row, rowIndex) => new TableRow({
            tableHeader: rowIndex === 0, children: row.map((cell, cellIndex) => new TableCell({
              width: { size: widths[cellIndex], type: WidthType.DXA }, margins: { top: 90, bottom: 90, left: 120, right: 120 },
              borders: { top: border, bottom: border, left: border, right: border }, children: [paragraph(cell, rowIndex === 0, 20)],
            })),
          })) }));
      }
      if (q.visual) {
        const image = await rasterize(q), width = Math.min(630, image.width * 1.1);
        children.push(new Paragraph({ children: [new ImageRun({ type: 'png', data: image.data,
          transformation: { width, height: width * image.height / image.width },
          altText: { title: 'Soal figural ' + q.no, description: q.stem, name: 'figural-' + q.no } })] }));
      } else q.options.forEach((option, j) => children.push(paragraph(letter(j) + '. ' + option.text)));
      if (content === 'pembahasan') {
        children.push(paragraph('Jawaban: ' + letter(q.answer), true));
        q.explanation.split('\n').filter(Boolean).forEach((line) => children.push(paragraph(line)));
        q.options.forEach((option, j) => children.push(paragraph(letter(j) +
          (q.subtest === 'TKP' ? ' (' + option.score + ' poin)' : '') + ': ' + option.reason, false, 20)));
      }
    }
  }
  return Packer.toBlob(new Document({
    creator: 'JadiASN SKD Studio', title: settings.title,
    styles: { default: { document: { run: { font: 'Calibri', size: 22, color: '000000' }, paragraph: { spacing: { line: 276 } } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 },
      margin: { top: 850, right: 850, bottom: 850, left: 850 } } }, children }],
  }));
}
export async function exportFile(format: 'pdf' | 'docx', content: ExportContent, packages: Package[], settings: Settings, zipped: boolean) {
  const build = format === 'pdf' ? pdfBlob : wordBlob;
  const basename = name(settings.title) + '-' + content;
  if (!zipped) { download(await build(packages, settings, content), basename + '.' + format); return; }
  const { zipSync } = await import('fflate');
  const files: Record<string, Uint8Array> = {};
  for (const pack of packages) files[pack.id + '-' + content + '.' + format] = new Uint8Array(await (await build([pack], settings, content)).arrayBuffer());
  const zip = zipSync(files, { level: 6 });
  download(new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), basename + '.zip');
}
