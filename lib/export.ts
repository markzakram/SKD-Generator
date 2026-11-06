import { KURASI_AKTIF, LABELS } from './config';
import { questionTable, tableGrid, type TableCell as GridCell } from './table';
import { mathParts, latexText, plainMath } from './math';
import { mathImageKey, mathLines, prepareMathImages, tableRaster } from './math-raster';
import { diagramName, diagramNote, diagramPlain, diagramResult, diagramTitle, isDiagramBlock, type DiagramBlock } from './diagram';
import { documentExplanation, explanationOf, explanationPlain, explanationTexts, hasOptionAnalysis, parseExplanation } from './explanation';
import { COLOR_HEX, hasMarks, mark, richRuns, stripMarks } from './richtext';
import { questionSvg } from './figures';
import type { ExportContent, Package, Question, Settings } from './types';
import { academicText } from './academic-format';
import { pdfTextRenderer, type PdfTextLine } from './pdf-text';
import { keepsOptionReasons, withoutGenericReason } from './reasons';
import { boldAnswerLabels, isCaseSubtest, separateTip } from './pembahasan';

export const letter = (index: number) => String.fromCharCode(65 + index);
const name = (text: string) => text.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'skd';
export { name as fileSlug };
// Teks baku soal yang dipakai bersama oleh PDF, Word, PNG, dan salinan clipboard (lib/take.ts), supaya tidak ada dua versi.
export const questionHeader = (q: Question) => 'Soal ' + q.no + ' | ' + q.subtest + ' | ' + q.subtopic + ' | ' + LABELS[q.difficulty] + (q.bloom ? ' | ' + q.bloom : '');
export const scoreLine = (q: Question) => q.options.map((option, i) => letter(i) + ': ' + option.score).join(' · ');
export const reasonLine = (q: Question, index: number) => letter(index) + (q.subtest === 'TKP' ? ' (' + q.options[index].score + ' poin)' : '') + ': ' + academicText(q, q.options[index].reason);
// Opsi tanpa alasan (soal TIU selain silogisme/analogi, TWK tanpa alasan spesifik) dilewati di semua keluaran: tidak ada baris kosong "C: ".
// Pembahasan yang sudah memuat "Analisis setiap opsi" (silogisme) tidak mengulang alasan opsi di bawahnya.
// TWK dan TKP: alasan opsi dan cara cepat sudah menyatu dalam pembahasan rakitan (lib/pembahasan.ts), jadi tidak ada baris alasan terpisah.
export const reasonLines = (q: Question) => isCaseSubtest(q) || hasOptionAnalysis(q.explanation) || !keepsOptionReasons(q) ? [] : q.options.flatMap((option, index) => withoutGenericReason(option.reason).trim() ? [reasonLine(q, index)] : []);
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
    'Kunci', 'Poin A', 'Poin B', 'Poin C', 'Poin D', 'Poin E', 'Pembahasan', 'Alasan A', 'Alasan B', 'Alasan C', 'Alasan D', 'Alasan E', 'Stimulus JSON', 'Sumber', 'Status', 'Revisi', 'Penelaah', 'Catatan kurasi', 'Alasan kesulitan', 'Rubrik JSON', 'Mapping ID','Category sumber','Lesson sumber','Chapter sumber','Label kesulitan sumber','Cara cepat','Asal butir'];
  const rows = packages.flatMap((pack) => pack.questions.map((q) => [pack.id, q.no, q.subtest, q.topic, q.subtopic, LABELS[q.difficulty],
    q.bloom ?? '', latexText(q.stem), ...q.options.map((option) => latexText(option.text)), letter(q.answer), ...q.options.map((option) => option.score),
    explanationPlain(explanationOf(q)), ...q.options.map((option) => plainMath(option.reason)), // alasan opsi sebagai teks terbaca (pembahasan juga), bukan LaTeX
    q.visual || q.table ? JSON.stringify({ visual: q.visual, table: q.table, figures: q.options.map((option) => option.figure), scenes: q.options.map((option) => option.scene) }) : '', q.source,
    q.review?.status ?? 'draft', q.review?.revision ?? 1, q.review?.reviewer ?? '', q.review?.note ?? '', q.difficultyReason ?? '', q.rubric ? JSON.stringify(q.rubric) : '',q.mappingId??'',q.provenance?.category??'',q.provenance?.lesson??'',q.provenance?.chapter??'',q.provenance?.declaredDifficulty??'',q.tip??'',q.provenance?.status??q.origin]));
  download(new Blob(['\ufeff' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }),
    name(settings.title) + '.csv');
}
export type Raster = { data: Uint8Array<ArrayBuffer>; url: string; width: number; height: number; content?: number }; // content: lebar isi baris (px), untuk menengahkan
const embeddedBankImages = new Map<string, string>();
// Bank illustrations load on demand, keeping the application's initial bundle
// small. SVG rasterization needs self-contained images; only registered local
// asset paths are fetched, never arbitrary external URLs from question content.
async function embedBankImages(svg: string): Promise<string> {
  const paths = [...new Set([...svg.matchAll(/(?:href|xlink:href)="(\/academic-bank\/bank-[a-f0-9]+\.png)"/g)].map(m => m[1]))];
  for (const path of paths) {
    if (!embeddedBankImages.has(path)) {
      const response = await fetch(path);
      if (!response.ok) throw new Error('Gambar pembahasan tidak ditemukan: ' + path);
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = ''; for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
      embeddedBankImages.set(path, 'data:image/png;base64,' + btoa(binary));
    }
    svg = svg.replaceAll('"' + path + '"', '"' + embeddedBankImages.get(path)! + '"');
  }
  return svg;
}
// SVG apa pun menjadi PNG berlatar putih, `scale` kali ukuran aslinya. Dipakai ekspor PDF, Word, PNG, dan salin ke clipboard.
export async function rasterizeSvg(svg: string, scale = 3): Promise<Raster> {
  // A registered source illustration is already a high-resolution PNG. Preserve
  // its bytes instead of enlarging/recompressing it into a much bigger canvas.
  const sourceImage = /^<svg[^>]*><title>[^<]*<\/title><image width="([\d.]+)" height="([\d.]+)" href="(\/academic-bank\/bank-[a-f0-9]+\.png)" xlink:href="\3"\/><\/svg>$/.exec(svg);
  svg = await embedBankImages(svg);
  if (sourceImage) {
    const url = embeddedBankImages.get(sourceImage[3])!;
    return { url, data: Uint8Array.from(atob(url.split(',')[1]), char => char.charCodeAt(0)), width: Number(sourceImage[1]), height: Number(sourceImage[2]) };
  }
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
const plain = (text: string) => stripMarks(text).normalize('NFKC').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—−]/g, '-')
  .replace(/¬/g, 'bukan ').replace(/…/g, '...').replace(/[•∙]/g, '-')
  .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/≠/g,'!=').replace(/∧/g,' dan ').replace(/∨/g,' atau ').replace(/∴/g,'maka ').replace(/∈/g,' anggota ');

// Tata letak satu soal sebagai daftar blok (ukuran huruf, tebal, jarak, gambar). PDF (pdfBlob) dan PNG (questionPngBlob)
// sama-sama melukis daftar ini, jadi keduanya selalu seragam. Satuan lebar, tinggi, dan jarak: milimeter pada halaman A4.
export type Block =
  | { kind: 'text'; text: string; size: number; bold: boolean; gap: number; keepNext?: boolean }
  | { kind: 'image'; image: Raster; width: number; height: number; gap: number; keepNext?: boolean }
  | { kind: 'gap'; mm: number }
  | { kind: 'table'; headers: string[]; rows: string[][]; size: number; gap: number; box?: boolean } // diubah menjadi gambar oleh typesetBlocks; box: kotak satu kolom tanpa garis dalam
  | { kind: 'diagram'; block: DiagramBlock; gap: number }; // diagram deret, figural beranotasi, atau graf rute (lib/diagram.ts), diubah menjadi gambar
type Laid = Exclude<Block, { kind: 'table' } | { kind: 'diagram' }>;
export const DRAFT_NOTE = 'DRAF KURASI — belum disetujui';
export const DRAFT_PACK_NOTE = 'DRAF KURASI — belum disetujui seluruhnya';
// Label draf hanya dicetak saat kurasi aktif (lib/config.ts: KURASI_AKTIF). Parameter `curation` pada fungsi ekspor di bawah hanya untuk menguji kedua jalur.
// Judul berkas ekspor: diberi " — Draf kurasi" hanya saat kurasi aktif dan cakupan 'draft'.
export const exportTitle = (title: string, scope: 'approved' | 'draft', curation: boolean = KURASI_AKTIF) => title + (curation && scope === 'draft' ? ' — Draf kurasi' : '');
// Pembahasan menjadi blok per baris sesuai strukturnya (lib/explanation.ts): sub-judul tebal, butir, persamaan, dan tabel.
// Pembahasan tanpa penanda struktur (TWK/TKP, soal lama) tetap satu blok teks utuh seperti sebelumnya.
export function explanationBlocks(explanation: string): Block[] {
  const blocks = parseExplanation(explanation);
  const text = (value: string, bold = false, gap = 1): Block => ({ kind: 'text', text: value, size: 12, bold, gap });
  if (!blocks) return [text(explanation, false, 3)];
  const out = blocks.flatMap((block): Block[] => block.k === 'gap' ? [{ kind: 'gap', mm: 2 }] : block.k === 'heading' ? [{ ...text(block.text, true), keepNext: true } as Block] :
    block.k === 'list' ? block.items.map((item, i) => text((block.ordered ? block.start + i + '. ' : '• ') + item)) :
      block.k === 'table' ? [{ kind: 'table', headers: block.headers, rows: block.rows, size: 12, gap: 2 }] :
        block.k === 'box' ? [{ kind: 'table', headers: [], rows: block.lines.map((line) => [line]), size: 12, gap: 2, box: true }] :
          isDiagramBlock(block) ? [{ kind: 'diagram', block, gap: 2 }] : [text(block.text)]);
  // Keterangan gambar dan judul tetap bersama blok yang diterangkannya saat berganti halaman.
  out.forEach((block, i) => { if (block.kind === 'text' && out[i + 1]?.kind === 'diagram') block.keepNext = true; });
  return [...out, { kind: 'gap', mm: 2 }];
}
export function questionBlocks(q: Question, content: ExportContent, image: Raster | null, draftNote = false): { head: Block[]; tail: Block[] } {
  const text = (value: string, size = 12, bold = false, gap = 2): Block => ({ kind: 'text', text: value, size, bold, gap });
  const head: Block[] = [];
  if (draftNote && q.review?.status !== 'approved') head.push(text(DRAFT_NOTE, 9, true, 2));
  head.push(text(questionHeader(q), 12, true, 3), text(q.stem, 12, false, 3));
  const table=questionTable(q);
  // Matriks angka memakai kisi tabel yang sama dengan tabel lain (kolom selebar sama, sel ditengahkan) seperti di Word dan SiAdu, bukan larik LaTeX rata kanan
  // tanpa garis, supaya penjajarannya tetap pada setiap ekspor (QC akademik #2, soal 52).
  if (table) head.push({ kind: 'table', ...table, size: 12, gap: 3 });
  if (image) {
    const width = Math.min(q.visual?.kind === 'matriks' ? 145 : 172, image.width * 0.3);
    head.push({ kind: 'image', image, width, height: width * image.height / image.width, gap: 6 });
  } else q.options.forEach((option, i) => head.push(text(letter(i) + '. ' + latexText(option.text), 12, false, 1)));
  // Semua subtes: Jawaban, label Pembahasan, lalu isi pembahasan.
  const tail = content === 'pembahasan' ? [
    { ...text('Jawaban: ' + letter(q.answer), 12, boldAnswerLabels(q), 2), keepNext: true },
    { ...text('Pembahasan:', 12, boldAnswerLabels(q), 1), keepNext: true }, ...explanationBlocks(documentExplanation(q)),
    ...reasonLines(q).map((line) => text(line, 12, false, 2)),...(separateTip(q)?[text('**Cara cepat:** '+separateTip(q),12,false,3)]:[])] : content === 'soal-jawaban' ? [
      text('Jawaban: ' + letter(q.answer), 12, boldAnswerLabels(q), 2), ...(q.subtest === 'TKP' ? [text(scoreLine(q), 12, false, 2)] : []),
    ] : [];
  return { head, tail };
}

// 'paket': judul, info paket, dan label draf (ekspor biasa). 'ringkas': untuk soal terpilih, tanpa durasi paket.
// 'tanpa': hanya soal tanpa judul; saat kurasi aktif, label draf menempel pada tiap soal yang belum disetujui (satu soal).
async function typesetBlocks(blocks:Block[]):Promise<Laid[]> {
  const output:Laid[]=[];
  for(const b of blocks){
    if(b.kind==='table'){
      const image=await tableRaster(b,b.size*96/72,178*96/25.4,rasterizeSvg,b.box);
      output.push({kind:'image',image,width:178,height:image.height*25.4/96,gap:b.gap});continue;
    }
    if(b.kind==='diagram'){
      const made=diagramResult(b.block);
      if('error' in made){output.push({kind:'text',text:diagramNote(made.error),size:9,bold:false,gap:b.gap});continue;} // diagram yang tidak dapat digambar menjadi keterangan, ekspor tetap berjalan
      const image=await rasterizeSvg(made.svg,3),width=Math.min(170,image.width*25.4/96*(b.block.k==='guide'?1:.8));
      output.push({kind:'image',image,width,height:width*image.height/image.width,gap:b.gap});continue;
    }
    // Teks bertanda tebal atau coret (lib/richtext.ts) ikut dirasterkan oleh mathLines, seperti baris berumus.
    if(b.kind!=='text'||/^Soal \d+ \|/.test(b.text)||(!hasMarks(b.text)&&!mathParts(b.text).some(p=>p.kind==='math'))){output.push(b);continue;}
    const lines=await mathLines(b.text,b.size*96/72,b.bold,178*96/25.4,rasterizeSvg);
    lines.forEach((image,i)=>output.push({kind:'image',image,width:178,height:image.height*25.4/96,gap:i===lines.length-1?b.gap:0,...(i<lines.length-1||b.keepNext?{keepNext:true}:{})}));
  }
  return output;
}
export type PdfHeading = 'paket' | 'ringkas' | 'tanpa';
export async function pdfBlob(packages: Package[], settings: Pick<Settings, 'title'>, content: ExportContent, heading: PdfHeading = 'paket', curation: boolean = KURASI_AKTIF): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const renderer = pdfTextRenderer(pdf, rasterizeSvg);
  type Prepared = { height: number; gap: number; keepNext?: boolean; draw: (top: number) => void; repeat?: Prepared };
  const prepare = async (blocks: Block[]): Promise<Prepared[]> => {
    const output: Prepared[] = [];
    for (const block of blocks) {
      if (block.kind === 'text') {
        const lines = await renderer.layout(block.text, block.size, block.bold, 178, /^Soal \d+ \|/.test(block.text));
        lines.forEach((line, i) => output.push({ height: line.height, gap: i === lines.length - 1 ? block.gap : 0, keepNext: block.keepNext || i === 0 && lines.length > 1, draw: top => renderer.draw(line, 16, top) }));
      } else if (block.kind === 'table') {
        const grid = tableGrid(block), column = 178 / grid.columns, padding = 2;
        let header: Prepared | undefined;
        const rows = [...(grid.header ? [[grid.header, true] as const] : []), ...grid.rows.map(row => [row, false] as const)];
        for (const [rowIndex, [cells, isHeader]] of rows.entries()) {
          let left = 16;
          const laid: { left: number; width: number; lines: PdfTextLine[]; centered: boolean; height: number }[] = [];
          for (const cell of cells) {
            const width = column * cell.span, lines = await renderer.layout(cell.text, block.size, isHeader || cell.mark, width - padding * 2, cell.plain);
            laid.push({ left, width, lines, centered: isHeader || grid.centered, height: lines.reduce((sum, line) => sum + line.height, 0) }); left += width;
          }
          const height = Math.max(block.size * 25.4 / 72 * 1.5, ...laid.map(cell => cell.height)) + padding * 2;
          const row: Prepared = { height, gap: 0, keepNext: isHeader, repeat: isHeader ? undefined : header, draw: top => {
            for (const cell of laid) {
              pdf.setDrawColor(140); pdf.setLineWidth(.2);
              if (block.box) {
                pdf.line(cell.left, top, cell.left, top + height); pdf.line(cell.left + cell.width, top, cell.left + cell.width, top + height);
                if (rowIndex === 0) pdf.line(cell.left, top, cell.left + cell.width, top);
                if (rowIndex === rows.length - 1) pdf.line(cell.left, top + height, cell.left + cell.width, top + height);
              }
              else pdf.rect(cell.left, top, cell.width, height);
              let y = top + padding;
              for (const line of cell.lines) { renderer.draw(line, cell.left + padding + (cell.centered ? Math.max(0, (cell.width - padding * 2 - line.width) / 2) : 0), y); y += line.height; }
            }
          } };
          if (isHeader) header = row;
          output.push(row);
        }
        if (output.length) output[output.length - 1].gap = block.gap;
      } else if (block.kind === 'gap') output.push({ height: block.mm, gap: 0, draw: () => {} });
      else {
        const images = block.kind === 'diagram' ? await typesetBlocks([block]) : [block];
        for (const item of images) {
          if (item.kind === 'image') {
            const scale = Math.min(1, 260 / item.height);
            output.push({ height: item.height * scale, gap: item.gap, draw: top => pdf.addImage(item.image.url, 'PNG', 16, top, item.width * scale, item.height * scale) });
          } else if (item.kind === 'text') output.push(...await prepare([item]));
        }
      }
    }
    return output;
  };
  let y = 16, first = true;
  const page = () => { pdf.addPage(); y = 16; };
  const room = (height: number) => { if (y + height > 279) page(); };
  const text = (value: string, size = 10, bold = false, space = 2) => {
    pdf.setFont('times', bold ? 'bold' : 'normal'); pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(plain(value), 178) as string[];
    const lineHeight = size * 0.3528 * 1.5;
    for (const line of lines) { room(lineHeight); pdf.text(line, 16, y + lineHeight * 0.8); y += lineHeight; }
    y += space;
  };
  const heightOf = (blocks: Prepared[]) => blocks.reduce((sum, b) => sum + b.height + b.gap, 0);
  const paint = (blocks: Prepared[]) => {
    for (const [index, b] of blocks.entries()) {
      if (b.keepNext) {
        let end = index + 1;
        const continues = (item: Prepared) => item.keepNext;
        while (end < blocks.length && continues(blocks[end])) end++;
        const together = heightOf(blocks.slice(index, end + 1));
        if (together <= 263) room(together);
      }
      const oldPage = pdf.getNumberOfPages(); room(b.height + b.gap);
      if (pdf.getNumberOfPages() !== oldPage && b.repeat && b.repeat.height + b.height < 263) { b.repeat.draw(y); y += b.repeat.height; }
      b.draw(y); y += b.height + b.gap;
    }
  };
  for (const pack of packages) {
    if (!first) page(); first = false;
    if (heading !== 'tanpa') {
      text(settings.title, 17, true, 3);
      text(pack.id + ' · ' + pack.questions.length + (heading === 'paket' ? ' soal · ' + pack.duration + ' menit' : ' soal terpilih'), 10, false, 2);
      if (curation && pack.questions.some((q) => q.review?.status !== 'approved')) text(DRAFT_PACK_NOTE, 9, true, 2);
      text('Seed: ' + pack.seed + ' | ' + (content === 'soal' ? 'Naskah soal' : content === 'kunci' ? 'Kunci jawaban' : content === 'soal-jawaban' ? 'Soal dan jawaban' : 'Soal dan pembahasan'), 9, false, 7);
    }
    for (const q of pack.questions) {
      if (content === 'kunci') {
        room(13);
        text(q.no + '. ' + q.subtest + ' — ' + letter(q.answer) + (q.subtest === 'TKP' ? ' | ' + scoreLine(q) : ''), 12, false, 1);
        continue;
      }
      const image = q.visual ? await rasterize(q) : null;
      const blocks = questionBlocks(q, content, image, curation && heading === 'tanpa');
      const head=await prepare(blocks.head),tail=await prepare(blocks.tail);
      room(Math.min(260, heightOf(head) + (content === 'soal-jawaban' ? heightOf(tail) : 0) + 7));
      paint(head);
      if (tail.length) { room(20); paint(tail); }
      y += 7;
    }
  }
  const count = pdf.getNumberOfPages();
  for (let i = 1; i <= count; i++) { pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(110); pdf.text(i + ' / ' + count, 194, 289, { align: 'right' }); }
  return pdf.output('blob');
}

export async function wordBlob(packages: Package[], settings: Settings, content: ExportContent, curation: boolean = KURASI_AKTIF): Promise<Blob> {
  const { AlignmentType, Document, Packer, Paragraph, TextRun, ImageRun, Table, TableCell, TableRow, WidthType, BorderStyle } = await import('docx');
  type Child = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;
  const mathImages=await prepareMathImages(content === 'kunci' ? [] : packages.flatMap(p=>p.questions.flatMap(q=>[q.stem,...q.options.map(o=>o.text),
    ...(content === 'pembahasan' ? [...explanationTexts(documentExplanation(q)),separateTip(q)??'',...reasonLines(q)] : []),
    ...(q.table?[...q.table.headers.map(cell=>mark.bold(cell)),...q.table.rows.flat(),...q.table.headers]:[])])),rasterizeSvg);
  // Baris judul paket, seed, dan kunci adalah teks biasa: "SKD-01" tidak boleh terbaca sebagai rumus.
  const plainParagraph = (text: string, bold = false, size = 24) => new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text, bold, size, font: 'Times New Roman' })] });
  // literal: teks tanpa deteksi rumus (header angka urut polos pada tabel, lib/table.ts).
  const paragraph = (text: string, bold = false, size = 24, keepNext = false, center = false, literal = false) => new Paragraph({
    keepNext, spacing: { after: 100 }, ...(center ? { alignment: AlignmentType.CENTER } : {}), children: richRuns(text).flatMap(run=>(literal ? [{ kind: 'text' as const, value: run.text }] : mathParts(run.text)).map(part=>{
      if(part.kind==='text')return new TextRun({text:part.value,bold:bold||!!run.bold,...(run.strike?{strike:true}:{}),...(run.color?{color:COLOR_HEX[run.color]}:{}),size,font:'Times New Roman'});
      const image=mathImages.get(mathImageKey(part.value,run.color,{bold:bold||run.bold,strike:run.strike}));
      const scale=image?Math.min(size/24,630/image.width):1;
      return image?new ImageRun({type:'png',data:image.data,transformation:{width:image.width*scale,height:image.height*scale},altText:{title:part.value,description:part.value,name:'formula'}}):new TextRun({text:'\\('+part.value+'\\)',size});
    })),
  });
  const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' };
  // Tabel pembahasan: kolom sama lebar, judul satu sel selebar tabel, sel kosong bagi baris yang lebih pendek.
  const gridTable = (block: { headers: string[]; rows: string[][] }) => {
    const grid = tableGrid(block), width = Math.floor(9900 / grid.columns);
    const cell = (c: GridCell, header: boolean) => new TableCell({ columnSpan: c.span, width: { size: width * c.span, type: WidthType.DXA }, margins: { top: 90, bottom: 90, left: 120, right: 120 },
      borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder }, children: [paragraph(c.text, header || c.mark, 24, false, header || grid.centered, c.plain)] });
    return new Table({ width: { size: width * grid.columns, type: WidthType.DXA }, columnWidths: Array.from({ length: grid.columns }, () => width),
      rows: [...(grid.header ? [new TableRow({ tableHeader: true, children: grid.header.map((c) => cell(c, true)) })] : []), ...grid.rows.map((row) => new TableRow({ children: row.map((c) => cell(c, false)) }))] });
  };
  // Diagram deret dirasterkan lebih dahulu (satu kali per gambar), lalu disisipkan sebagai gambar di paragraf pembahasan.
  const chainImages = new Map<string, Raster>();
  if (content === 'pembahasan') for (const pack of packages) for (const q of pack.questions) for (const block of parseExplanation(documentExplanation(q)) ?? []) {
    if (!isDiagramBlock(block)) continue;
    const made = diagramResult(block);
    if (!('error' in made) && !chainImages.has(made.svg)) chainImages.set(made.svg, await rasterizeSvg(made.svg, 3));
  }
  const chainParagraph = (block: DiagramBlock) => {
    const made = diagramResult(block);
    if ('error' in made) return plainParagraph(diagramNote(made.error), false, 20); // diagram yang tidak dapat digambar menjadi keterangan, ekspor tetap berjalan
    const image = chainImages.get(made.svg)!, width = Math.min(600, image.width * (block.k === 'guide' ? 1 : 0.8));
    return new Paragraph({ spacing: { after: 100 }, children: [new ImageRun({ type: 'png', data: image.data, transformation: { width, height: width * image.height / image.width },
      altText: { title: diagramTitle(block), description: diagramPlain(block), name: diagramName(block) } })] });
  };
  const explanationChildren = (explanation: string): Child[] => {
    const blocks = parseExplanation(explanation);
    if (!blocks) return explanation.split('\n').filter(Boolean).map((line) => paragraph(line));
    return blocks.flatMap((block, i): Child[] => block.k === 'gap' ? [] : block.k === 'heading' ? [paragraph(block.text, true, 24, true)] :
      block.k === 'list' ? block.items.map((item, i) => paragraph((block.ordered ? block.start + i + '. ' : '• ') + item)) :
        block.k === 'box' ? [new Table({ width: { size: 9900, type: WidthType.DXA }, columnWidths: [9900], rows: [new TableRow({ children: [new TableCell({ width: { size: 9900, type: WidthType.DXA },
          margins: { top: 90, bottom: 90, left: 120, right: 120 }, borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder }, children: block.lines.map((line) => paragraph(line)) })] })] }), new Paragraph({ spacing: { after: 80 } })] :
          isDiagramBlock(block) ? [chainParagraph(block)] : block.k === 'table' ? [gridTable(block), new Paragraph({ spacing: { after: 80 } })] : [paragraph(block.text, false, 24, !!blocks[i + 1] && isDiagramBlock(blocks[i + 1]))]);
  };
  const children: Child[] = [];
  for (let i = 0; i < packages.length; i++) {
    const pack = packages[i];
    children.push(new Paragraph({ pageBreakBefore: i > 0, spacing: { after: 160 },
      children: [new TextRun({ text: settings.title, bold: true, size: 32, color: '000000' })] }),
      plainParagraph(pack.id + ' · ' + pack.questions.length + ' soal · ' + pack.duration + ' menit'),
      plainParagraph('Seed: ' + pack.seed, false, 18));
    if (curation && pack.questions.some((q) => q.review?.status !== 'approved')) children.push(plainParagraph(DRAFT_PACK_NOTE, true, 18));
    for (const q of pack.questions) {
      if (content === 'kunci') {
        children.push(plainParagraph(q.no + '. ' + q.subtest + ' — ' + letter(q.answer) + (q.subtest === 'TKP' ? ' | ' + scoreLine(q) : '')));
        continue;
      }
      children.push(new Paragraph({ keepNext: true, spacing: { before: 200, after: 100 }, children: [
        new TextRun({ text: questionHeader(q), bold: true, size: 20 }),
      ] }));
      q.stem.split('\n').filter(Boolean).forEach((line) => children.push(paragraph(line, false, 22, Boolean(q.visual || q.table))));
      // Tabel stimulus memakai tata letak bersama (lib/table.ts: lebar kolom sama, sel pendek ditengahkan), sama dengan PDF dan SiAdu (QC akademik #2, soal 52).
      const table=questionTable(q);
      if (table) children.push(gridTable(table));
      if (q.visual) {
        const image = await rasterize(q);
        children.push(new Paragraph({ children: [new ImageRun({ type: 'png', data: image.data,
          transformation: docImageSize(image),
          altText: { title: 'Soal figural ' + q.no, description: q.stem, name: 'figural-' + q.no } })] }));
      } else q.options.forEach((option, j) => children.push(paragraph(letter(j) + '. ' + latexText(option.text))));
      if (content === 'soal-jawaban') {
        children.push(plainParagraph('Jawaban: ' + letter(q.answer), boldAnswerLabels(q)));
        if (q.subtest === 'TKP') children.push(plainParagraph(scoreLine(q)));
      }
      if (content === 'pembahasan') {
        children.push(paragraph('Jawaban: ' + letter(q.answer), boldAnswerLabels(q)));
        children.push(plainParagraph('Pembahasan:', boldAnswerLabels(q)));
        children.push(...explanationChildren(documentExplanation(q)));
        reasonLines(q).forEach((line) => children.push(paragraph(line)));
        if(separateTip(q))children.push(paragraph('**Cara cepat:** '+separateTip(q)));
      }
    }
  }
  return Packer.toBlob(new Document({
    creator: 'JadiASN SKD Studio', title: settings.title,
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24, color: '000000' }, paragraph: { spacing: { line: 360 } } } } },
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
const pngFont = (size: number, bold: boolean) => (bold ? 'bold ' : '') + Math.round(size * PT_MM * PNG_PX_PER_MM * 100) / 100 + 'px "Times New Roman", serif';
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
export async function questionPngBlob(q: Question, content: ExportContent, curation: boolean = KURASI_AKTIF): Promise<Blob> {
  const image = q.visual ? await rasterize(q) : null;
  const blocks = questionBlocks(q, content, image, curation);
  const head=await typesetBlocks(blocks.head),tail=await typesetBlocks(blocks.tail);
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas tidak tersedia.');
  const px = PNG_PX_PER_MM;
  // Tahap 1: pecah teks menjadi baris dan hitung tinggi tiap blok dengan rumus yang sama seperti PDF.
  const laid = [...head, ...tail].map((b) => {
    if (b.kind !== 'text') return { b, lines: [] as string[], height: b.kind === 'image' ? b.height + b.gap : b.mm };
    context.font = pngFont(b.size, b.bold);
    const lines = wrapLines(context, b.text, 178 * px);
    return { b, lines, height: lines.length * b.size * PT_MM * 1.5 + b.gap };
  });
  canvas.width = Math.round(210 * px); canvas.height = Math.round((16 + laid.reduce((sum, item) => sum + item.height, 0) + 12) * px); // ukuran baru mengosongkan state context
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000000'; context.textBaseline = 'alphabetic'; context.imageSmoothingQuality = 'high';
  let y = 16;
  for (const { b, lines } of laid) {
    if (b.kind === 'text') {
      context.font = pngFont(b.size, b.bold);
      const lineHeight = b.size * PT_MM * 1.5;
      for (const line of lines) { context.fillText(line, 16 * px, (y + lineHeight * 0.8) * px); y += lineHeight; }
      y += b.gap;
    } else if (b.kind === 'image') {
      context.drawImage(await loadImage(b.image.url), 16 * px, y * px, b.width * px, b.height * px); y += b.height + b.gap;
    } else y += b.mm;
  }
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG gagal dibuat.')), 'image/png'));
}
