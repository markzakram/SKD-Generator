import { LABELS } from './config';
import { questionSvg } from './figures';
import type { ExportContent, Package, Question, Settings } from './types';

export const letter = (index: number) => String.fromCharCode(65 + index);
const name = (text: string) => text.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'skd';
export { name as fileSlug };
// Teks baku soal yang dipakai bersama oleh PDF, Word, PNG, dan salinan clipboard (lib/take.ts), supaya tidak ada dua versi.
export const questionHeader = (q: Question) => 'Soal ' + q.no + ' | ' + q.subtest + ' | ' + q.subtopic + ' | ' + LABELS[q.difficulty] + (q.bloom ? ' | ' + q.bloom : '');
export const scoreLine = (q: Question) => q.options.map((option, i) => letter(i) + ': ' + option.score).join(' · ');
export const reasonLine = (q: Question, index: number) => letter(index) + (q.subtest === 'TKP' ? ' (' + q.options[index].score + ' poin)' : '') + ': ' + q.options[index].reason;
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export function exportJson(packages: Package[], settings: Settings) {
  download(new Blob([JSON.stringify({ version: 2, settings, packages }, null, 2)], { type: 'application/json' }), name(settings.title) + '.json');
}
function csvCell(text: unknown): string {
  const original = String(text ?? '');
  // Protect spreadsheet imports from interpreting question text as a formula.
  const value = /^[=+@\-\t\r]/.test(original) ? "'" + original : original;
  return '"' + value.replaceAll('"', '""') + '"';
}
export function exportCsv(packages: Package[], settings: Settings) {
  const headers = ['Paket', 'Nomor', 'Subtes', 'Materi', 'Submateri', 'Kesulitan', 'Bloom', 'Soal', 'A', 'B', 'C', 'D', 'E',
    'Kunci', 'Poin A', 'Poin B', 'Poin C', 'Poin D', 'Poin E', 'Pembahasan', 'Alasan A', 'Alasan B', 'Alasan C', 'Alasan D', 'Alasan E', 'Stimulus JSON', 'Sumber', 'Status', 'Revisi', 'Penelaah', 'Catatan kurasi', 'Alasan kesulitan', 'Rubrik JSON'];
  const rows = packages.flatMap((pack) => pack.questions.map((q) => [pack.id, q.no, q.subtest, q.topic, q.subtopic, LABELS[q.difficulty],
    q.bloom ?? '', q.stem, ...q.options.map((option) => option.text), letter(q.answer), ...q.options.map((option) => option.score),
    q.explanation, ...q.options.map((option) => option.reason),
    q.visual || q.table ? JSON.stringify({ visual: q.visual, table: q.table, figures: q.options.map((option) => option.figure), scenes: q.options.map((option) => option.scene) }) : '', q.source,
    q.review?.status ?? 'draft', q.review?.revision ?? 1, q.review?.reviewer ?? '', q.review?.note ?? '', q.difficultyReason ?? '', q.rubric ? JSON.stringify(q.rubric) : '']));
  download(new Blob(['\ufeff' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }),
    name(settings.title) + '.csv');
}
export type Raster = { data: Uint8Array<ArrayBuffer>; url: string; width: number; height: number };
// SVG apa pun menjadi PNG berlatar putih, `scale` kali ukuran aslinya. Dipakai ekspor PDF, Word, PNG, dan salin ke clipboard.
export async function rasterizeSvg(svg: string, scale = 3): Promise<Raster> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Gambar figural gagal disiapkan.')); img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = img.width * scale; canvas.height = img.height * scale;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas tidak tersedia.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    const binary = atob(dataUrl.split(',')[1]);
    return { data: Uint8Array.from(binary, (char) => char.charCodeAt(0)), url: dataUrl, width: img.width, height: img.height };
  } finally { URL.revokeObjectURL(url); }
}
const rasterize = (question: Question) => rasterizeSvg(questionSvg(question));
export const pngBlob = (raster: Raster) => new Blob([raster.data], { type: 'image/png' });
// Ukuran gambar figural di dokumen Word (piksel); salinan clipboard memakai ukuran yang sama supaya hasil tempel serupa.
export const docImageSize = (image: { width: number; height: number }) => { const width = Math.min(630, image.width * 1.1); return { width, height: width * image.height / image.width }; };
const plain = (text: string) => text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—−]/g, '-')
  .replace(/→/g, ' -> ').replace(/¬/g, 'bukan ').replace(/…/g, '...').replace(/[•∙]/g, '-')
  .replace(/≥/g, '>=').replace(/≤/g, '<=');

// Tata letak satu soal sebagai daftar blok (ukuran huruf, tebal, jarak, gambar). PDF (pdfBlob) dan PNG (questionPngBlob)
// sama-sama melukis daftar ini, jadi keduanya selalu seragam. Satuan lebar, tinggi, dan jarak: milimeter pada halaman A4.
export type Block =
  | { kind: 'text'; text: string; size: number; bold: boolean; gap: number }
  | { kind: 'image'; image: Raster; width: number; height: number; gap: number }
  | { kind: 'gap'; mm: number };
export const DRAFT_NOTE = 'DRAF KURASI — belum disetujui';
export function questionBlocks(q: Question, content: ExportContent, image: Raster | null, draftNote = false): { head: Block[]; tail: Block[] } {
  const text = (value: string, size = 10, bold = false, gap = 2): Block => ({ kind: 'text', text: value, size, bold, gap });
  const head: Block[] = [];
  if (draftNote && q.review?.status !== 'approved') head.push(text(DRAFT_NOTE, 9, true, 2));
  head.push(text(questionHeader(q), 9, true, 3), text(q.stem, 10, false, 3));
  if (q.table) head.push(text(q.table.headers.join(' | '), 9, true, 1), ...q.table.rows.map((row) => text(row.join(' | '), 9, false, 1)), { kind: 'gap', mm: 3 });
  if (image) {
    const width = Math.min(q.visual?.kind === 'matriks' ? 145 : 172, image.width * 0.3);
    head.push({ kind: 'image', image, width, height: width * image.height / image.width, gap: 6 });
  } else q.options.forEach((option, i) => head.push(text(letter(i) + '. ' + option.text, 10, false, 1)));
  const tail = content === 'pembahasan' ? [text('Jawaban: ' + letter(q.answer), 10, true, 2), text(q.explanation, 9, false, 3),
    ...q.options.map((_, i) => text(reasonLine(q, i), 9, false, 2))] : [];
  return { head, tail };
}

// 'paket': judul, info paket, dan label draf (ekspor biasa). 'ringkas': untuk soal terpilih, tanpa durasi paket.
// 'tanpa': hanya soal tanpa judul; label draf menempel pada tiap soal yang belum disetujui (satu soal).
export type PdfHeading = 'paket' | 'ringkas' | 'tanpa';
export async function pdfBlob(packages: Package[], settings: Pick<Settings, 'title'>, content: ExportContent, heading: PdfHeading = 'paket'): Promise<Blob> {
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
  const measure = (value: string, size = 10, gap = 2) => {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(size);
    return (pdf.splitTextToSize(plain(value), 178) as string[]).length * size * 0.3528 * 1.35 + gap;
  };
  const heightOf = (blocks: Block[]) => blocks.reduce((sum, b) => sum + (b.kind === 'text' ? measure(b.text, b.size, b.gap) : b.kind === 'image' ? b.height + b.gap : b.mm), 0);
  const paint = (blocks: Block[]) => {
    for (const b of blocks) {
      if (b.kind === 'text') text(b.text, b.size, b.bold, b.gap);
      else if (b.kind === 'image') { room(b.height + b.gap); pdf.addImage(b.image.url, 'PNG', 16, y, b.width, b.height); y += b.height + b.gap; }
      else y += b.mm;
    }
  };
  for (const pack of packages) {
    if (!first) page(); first = false;
    if (heading !== 'tanpa') {
      text(settings.title, 17, true, 3);
      text(pack.id + ' · ' + pack.questions.length + (heading === 'paket' ? ' soal · ' + pack.duration + ' menit' : ' soal terpilih'), 10, false, 2);
      if (pack.questions.some((q) => q.review?.status !== 'approved')) text('DRAF KURASI — belum disetujui seluruhnya', 9, true, 2);
      text('Seed: ' + pack.seed + ' | ' + (content === 'soal' ? 'Naskah soal' : content === 'kunci' ? 'Kunci jawaban' : 'Soal dan pembahasan'), 9, false, 7);
    }
    for (const q of pack.questions) {
      if (content === 'kunci') {
        room(13);
        text(q.no + '. ' + q.subtest + ' — ' + letter(q.answer) + (q.subtest === 'TKP' ? ' | ' + scoreLine(q) : ''), 10, false, 1);
        continue;
      }
      const image = q.visual ? await rasterize(q) : null;
      const { head, tail } = questionBlocks(q, content, image, heading === 'tanpa');
      room(Math.min(260, heightOf(head) + 7));
      paint(head);
      if (tail.length) { room(20); paint(tail); }
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
    if (pack.questions.some((q) => q.review?.status !== 'approved')) children.push(paragraph('DRAF KURASI — belum disetujui seluruhnya', true, 18));
    for (const q of pack.questions) {
      if (content === 'kunci') {
        children.push(paragraph(q.no + '. ' + q.subtest + ' — ' + letter(q.answer) + (q.subtest === 'TKP' ? ' | ' + scoreLine(q) : '')));
        continue;
      }
      children.push(new Paragraph({ keepNext: true, spacing: { before: 200, after: 100 }, children: [
        new TextRun({ text: questionHeader(q), bold: true, size: 20 }),
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
        const image = await rasterize(q);
        children.push(new Paragraph({ children: [new ImageRun({ type: 'png', data: image.data,
          transformation: docImageSize(image),
          altText: { title: 'Soal figural ' + q.no, description: q.stem, name: 'figural-' + q.no } })] }));
      } else q.options.forEach((option, j) => children.push(paragraph(letter(j) + '. ' + option.text)));
      if (content === 'pembahasan') {
        children.push(paragraph('Jawaban: ' + letter(q.answer), true));
        q.explanation.split('\n').filter(Boolean).forEach((line) => children.push(paragraph(line)));
        q.options.forEach((_, j) => children.push(paragraph(reasonLine(q, j), false, 20)));
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

// ---- PNG satu soal ---------------------------------------------------------------------------------------------------
// Dilukis di canvas dari daftar blok yang sama dengan PDF (questionBlocks): ukuran huruf, jarak, dan lebar kolom 178 mm sama,
// hanya tanpa pemotongan halaman. 6 piksel per milimeter (± 150 dpi): lebar halaman 210 mm menjadi 1.260 piksel.
const PNG_PX_PER_MM = 6, PT_MM = 0.3528;
const pngFont = (size: number, bold: boolean) => (bold ? 'bold ' : '') + Math.round(size * PT_MM * PNG_PX_PER_MM * 100) / 100 + 'px Arial, Helvetica, sans-serif';
// Memecah teks menjadi baris selebar `maxWidth` (aturan ukur dari `context`). Baris baru dari "\n" dipertahankan;
// satu kata yang lebih lebar dari baris dipotong per huruf.
export function wrapLines(context: { measureText(text: string): { width: number } }, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      let candidate = line ? line + ' ' + word : word;
      if (context.measureText(candidate).width <= maxWidth) { line = candidate; continue; }
      if (line) { lines.push(line); line = ''; }
      candidate = word;
      while (candidate.length > 1 && context.measureText(candidate).width > maxWidth) {
        let cut = candidate.length - 1;
        while (cut > 1 && context.measureText(candidate.slice(0, cut)).width > maxWidth) cut--;
        lines.push(candidate.slice(0, cut)); candidate = candidate.slice(cut);
      }
      line = candidate;
    }
    lines.push(line);
  }
  return lines;
}
const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Gambar figural gagal disiapkan.')); img.src = src;
});
export async function questionPngBlob(q: Question, content: ExportContent): Promise<Blob> {
  const image = q.visual ? await rasterize(q) : null;
  const { head, tail } = questionBlocks(q, content, image, true);
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas tidak tersedia.');
  const px = PNG_PX_PER_MM;
  // Tahap 1: pecah teks menjadi baris dan hitung tinggi tiap blok dengan rumus yang sama seperti PDF.
  const laid = [...head, ...tail].map((b) => {
    if (b.kind !== 'text') return { b, lines: [] as string[], height: b.kind === 'image' ? b.height + b.gap : b.mm };
    context.font = pngFont(b.size, b.bold);
    const lines = wrapLines(context, b.text, 178 * px);
    return { b, lines, height: lines.length * b.size * PT_MM * 1.35 + b.gap };
  });
  canvas.width = Math.round(210 * px); canvas.height = Math.round((16 + laid.reduce((sum, item) => sum + item.height, 0) + 12) * px); // ukuran baru mengosongkan state context
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000000'; context.textBaseline = 'alphabetic'; context.imageSmoothingQuality = 'high';
  let y = 16;
  for (const { b, lines } of laid) {
    if (b.kind === 'text') {
      context.font = pngFont(b.size, b.bold);
      const lineHeight = b.size * PT_MM * 1.35;
      for (const line of lines) { context.fillText(line, 16 * px, (y + lineHeight * 0.8) * px); y += lineHeight; }
      y += b.gap;
    } else if (b.kind === 'image') {
      context.drawImage(await loadImage(b.image.url), 16 * px, y * px, b.width * px, b.height * px); y += b.height + b.gap;
    } else y += b.mm;
  }
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG gagal dibuat.')), 'image/png'));
}
