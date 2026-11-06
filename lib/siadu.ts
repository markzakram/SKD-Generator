import { KURASI_AKTIF, LABELS } from './config';
import { diagramResult, diagramTitle, isDiagramBlock } from './diagram';
import { documentExplanation, parseExplanation } from './explanation';
import { download, fileSlug, letter, rasterizeSvg, reasonLines, type Raster } from './export';
import { hasStimulus, optionSvg, questionSvg } from './figures';
import { mappingFor, MAPPING_ROWS } from './mapping';
import { mathParts } from './math';
import { boldAnswerLabels, separateTip } from './pembahasan';
import { COLOR_HEX, richRuns } from './richtext';
import { questionTable, tableGrid } from './table';
import type { Package, Question, Settings, Subtest } from './types';

export type SiaduScope = 'all' | Subtest;
export type SiaduDelivery = 'single' | 'zip';
export type SiaduContent = 'pembahasan' | 'soal-jawaban';
export const SIADU_SUBTESTS: Subtest[] = ['TWK', 'TIU', 'TKP'];
export const TKP_IMPORT_GUIDE = 'Auto Input v2.7.1 membaca poin A–E dan memilih mode TKP secara otomatis. Gunakan Mode Jawaban → Otomatis per soal.';
export const SIADU_MIXED_GUIDE = 'Satu DOCX dapat langsung dibaca Auto Input v2.7.1. Mode Otomatis per soal memilih Option New untuk TWK/TIU dan Legacy beserta poin A–E untuk TKP.';
export const SIADU_FORMAT_GUIDE = 'Auto Input v2.7.1 meneruskan gambar, tebal, warna, coretan, tabel, serta poin opsi dari DOCX. Rumus dirender di perangkat tanpa API. Importir memeriksa isi editor sebelum menyimpan. Gunakan Isi 1 Soal Tanpa Simpan untuk memeriksa hasil di SiAdu Anda.';
// Only prose stems are joined. TIU premises, numbered data, and all explanations keep their academic structure.
export const siaduStem = (q: Pick<Question, 'subtest' | 'stem'>) => q.subtest === 'TIU' ? q.stem : q.stem.replace(/\s+/g, ' ').trim();
// SiAdu Auto Input v2.6.1 parseScores reads precisely "Opsi A (5 poin)".
// The legacy form writes these to table.score_option_a..e. Never use the
// single-key Option New form for TKP's graded options.
export function siaduScoreLines(q: Pick<Question, 'options' | 'answer'>): string[] {
  const scores = q.options.map((option) => option.score);
  if (scores.length !== 5 || scores.some((score) => !Number.isInteger(score) || score < 1 || score > 5) || new Set(scores).size !== 5 || scores[q.answer] !== 5) {
    throw new Error('Ekspor TKP memerlukan poin 1–5, masing-masing satu kali, dan kunci pada opsi bernilai 5.');
  }
  return scores.map((score, i) => 'Opsi ' + letter(i) + ' (' + score + ' poin)');
}
// Penanda paragraf dan LaTeX mengikuti kontrak importir OJK Tahap 1.
// Gambar disimpan terpisah per opsi dalam Word; Auto Input v2.7.1 membaca media tersemat.
export const siaduText = (text: string) => mathParts(text).map((part) => part.kind === 'math' ? '$$' + part.value + '$$' : part.value).join('');
export function siaduMapping(q: Question) {
  if (q.subtest === 'TIU' && q.proof.kind === 'model' && q.proof.model.kind === 'syllogism' && q.proof.model.chapter) {
    return { category: 'Penalaran Verbal', lesson: 'Silogisme', chapter: q.proof.model.chapter };
  }
  const mapped = MAPPING_ROWS.find((row) => row.id === q.mappingId && row.subtest === q.subtest) ?? mappingFor(q);
  // Butir bentuk implikasi (konvers, invers, kontraposisi) tidak punya baris mapping sendiri, tetapi tetap Silogisme (lib/tiu-implikasi.ts).
  const implication = !mapped && q.subtest === 'TIU' && q.proof.kind === 'model' && q.proof.model.kind === 'implication' ? { category: 'Penalaran Verbal', lesson: 'Silogisme', chapter: 'Bentuk Implikasi' } : undefined;
  return {
    category: q.provenance?.category || mapped?.category || implication?.category || 'SKD',
    lesson: q.provenance?.lesson || mapped?.lesson || implication?.lesson || q.subtest,
    chapter: q.provenance?.chapter || mapped?.chapter || implication?.chapter || q.subtopic,
  };
}
export function siaduDocuments(packages: Package[], scope: SiaduScope = 'all') {
  return packages.flatMap((pack) => SIADU_SUBTESTS.filter((subtest) => scope === 'all' || scope === subtest).flatMap((subtest) => {
    const questions = pack.questions.filter((q) => q.subtest === subtest && !q.review?.excluded);
    return questions.length ? [{ pack, subtest, questions, filename: fileSlug(pack.id) + '-' + subtest.toLowerCase() + '-siadu.docx' }] : [];
  }));
}
export type SiaduDocument = Omit<ReturnType<typeof siaduDocuments>[number], 'subtest'> & { subtest: Subtest | 'SKD' };

// One document keeps package/question order and assigns a single continuous sequence of question numbers.
// Package headings are confined to the preamble so an importer cannot append them to the previous explanation.
export function siaduDeliveryDocuments(packages: Package[], scope: SiaduScope, delivery: SiaduDelivery): SiaduDocument[] {
  if (delivery === 'zip') return siaduDocuments(packages, scope);
  const selected = packages.map(pack => ({ ...pack, questions: pack.questions.filter(q => !q.review?.excluded && (scope === 'all' || q.subtest === scope)) })).filter(pack => pack.questions.length);
  if (!selected.length) return [];
  const questions = selected.flatMap(pack => pack.questions), subtests = new Set(questions.map(q => q.subtest));
  const subtest = subtests.size === 1 ? questions[0].subtest : 'SKD';
  const pack = selected.length === 1 ? selected[0] : { ...selected[0], id: selected.map(p => p.id).join(' + '), seed: selected.map(p => p.id + ': ' + p.seed).join(' · '), questions };
  const filename = (selected.length === 1 ? fileSlug(pack.id) : selected.length + '-paket') + '-' + subtest.toLowerCase() + '-siadu.docx';
  return [{ pack, subtest, questions, filename }];
}

export const siaduFilename = (doc: Pick<SiaduDocument, 'filename'>, content: SiaduContent) => content === 'soal-jawaban' ? doc.filename.replace(/\.docx$/, '-tanpa-pembahasan.docx') : doc.filename;

export async function siaduWordBlob(doc: SiaduDocument, settings: Pick<Settings, 'title'>, rasterize = rasterizeSvg, content: SiaduContent = 'pembahasan'): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle } = await import('docx');
  type Child = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;
  const children: Child[] = [];
  // Metadata never passes through math detection: IDs like SKD-01 are plain text.
  // Auto Input treats any w:b node as bold, including w:b val="off". Omit
  // the property for ordinary runs so its DOCX reader preserves plain markers.
  const paragraph = (text: string, bold = false, keepNext = false) => new Paragraph({ keepNext, spacing: { after: 100 }, children: text.split(/\r?\n/).map((line, i) => new TextRun({ text: line, ...(bold ? { bold: true } : {}), ...(i ? { break: 1 } : {}) })) });
  // **tebal** dan ~~coret~~ pada pembahasan (lib/richtext.ts) menjadi run Word bold dan strike; baris tanpa penanda tidak berubah.
  // literal: teks tanpa penanda rumus (header angka urut polos pada tabel, lib/table.ts): "1" tetap "1", bukan "$$1$$".
  const prose = (text: string, bold = false, keepNext = false, centered = false, literal = false) => new Paragraph({ keepNext, ...(centered ? { alignment: 'center' as const } : {}), spacing: { after: 100 }, children: richRuns(text).flatMap((run) => (literal ? run.text : siaduText(run.text)).split(/\r?\n/).map((line, i) =>
    new TextRun({ text: line, ...(bold || run.bold ? { bold: true } : {}), ...(run.strike ? { strike: true } : {}), ...(run.color ? { color: COLOR_HEX[run.color] } : {}), ...(i ? { break: 1 } : {}) }))) });
  const imgRun = (image: Raster, title: string, maxWidth = 610) => {
    const width = Math.min(maxWidth, image.width);
    return new ImageRun({ type: 'png', data: image.data, transformation: { width, height: width * image.height / image.width }, altText: { title, description: title, name: title } });
  };
  const addImage = async (svg: string, title: string) => children.push(new Paragraph({ spacing: { after: 120 }, children: [imgRun(await rasterize(svg), title)] }));
  const gridTable = (data: { headers: string[]; rows: string[][] }) => {
    const grid = tableGrid(data), width = Math.floor(9900 / grid.columns);
    const border = { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' };
    return new Table({ width: { size: width * grid.columns, type: WidthType.DXA }, columnWidths: Array(grid.columns).fill(width),
      rows: [...(grid.header ? [{ cells: grid.header, header: true }] : []), ...grid.rows.map((cells) => ({ cells, header: false }))].map(({ cells, header }) => new TableRow({ ...(header ? { tableHeader: true } : {}), children: cells.map((cell) => new TableCell({
        columnSpan: cell.span, width: { size: width * cell.span, type: WidthType.DXA }, margins: { top: 90, bottom: 90, left: 120, right: 120 },
        borders: { top: border, bottom: border, left: border, right: border }, children: [prose(cell.text, header || cell.mark, false, header || grid.centered, cell.plain)],
      })) })) });
  };
  children.push(paragraph(settings.title + ' — ' + doc.pack.id + ' · ' + doc.subtest, true), paragraph('Format input Word SiAdu · ' + doc.questions.length + ' soal · benih ' + doc.pack.seed));
  if (content === 'soal-jawaban') children.push(paragraph('Isi dokumen: Soal + jawaban tanpa pembahasan'));
  if (doc.subtest === 'TKP') children.push(paragraph(TKP_IMPORT_GUIDE));
  else if (doc.questions.some(q => q.subtest === 'TKP') && doc.questions.some(q => q.subtest !== 'TKP')) children.push(paragraph(SIADU_MIXED_GUIDE));
  for (const [index, q] of doc.questions.entries()) {
    const mapping = siaduMapping(q);
    // A paragraph style preserves the bold title in Word while legacy readers see plain "Soal N".
    children.push(new Paragraph({ style: 'SiaduQuestion', keepNext: true, spacing: { after: 100 }, children: [new TextRun('Soal ' + (index + 1))] }), paragraph('Category: ' + mapping.category, true, true),
      paragraph('Lesson: ' + mapping.lesson, true, true), paragraph('Chapter: ' + mapping.chapter, true, true));
    const level = paragraph('Tingkat Kesulitan: ' + (q.difficulty === 'hots' ? 'Hots' : LABELS[q.difficulty]), false, true);
    // Auto Input starts the stem immediately after Tingkat Kesulitan, for every subtest.
    children.push(paragraph('Bentuk Soal: ' + (q.subtest === 'TKP' ? 'Option (Legacy)' : 'Option New'), false, true), level);
    children.push(...siaduStem(q).split(/\r?\n/).filter(line => line.trim()).map(line => prose(line)));
    const table = questionTable(q);
    if (table) children.push(gridTable(table));
    if (hasStimulus(q)) await addImage(questionSvg(q, false), 'Stimulus soal ' + (index + 1));
    for (const [i, option] of q.options.entries()) {
      const svg = optionSvg(option);
      children.push(svg ? new Paragraph({ spacing: { after: 120 }, children: [new TextRun(letter(i) + '. ' + (option.text ? siaduText(option.text) + ' ' : '')), imgRun(await rasterize(svg), 'Pilihan ' + letter(i), 120)] }) : paragraph(letter(i) + '. ' + siaduText(option.text)));
    }
    // Tebal melalui style paragraf: Word menampilkannya tebal, sedangkan pembaca
    // SiAdu tetap melihat "Jawaban: X" tanpa pembungkus ** yang merusak parseQuestions.
    // TWK gaya Nynda (Nasionalisme, Integritas, Bela Negara, Pilar Negara) tidak menebalkan "Jawaban:" dan "Pembahasan:" (lib/pembahasan.ts); semua yang lain tebal.
    const boldLabels = boldAnswerLabels(q);
    children.push(new Paragraph({ ...(boldLabels ? { style: 'SiaduAnswer' } : {}), keepNext: content === 'pembahasan' || q.subtest === 'TKP', spacing: { after: 100 }, children: [new TextRun('Jawaban: ' + letter(q.answer))] }));
    if (content === 'pembahasan') {
      children.push(paragraph('Pembahasan:', boldLabels, true));
      if (KURASI_AKTIF && q.review?.status !== 'approved') children.push(paragraph('DRAF KURASI — belum disetujui', true));
      const explanation = documentExplanation(q), blocks = parseExplanation(explanation);
      if (!blocks) children.push(...explanation.split(/\r?\n/).map((line) => prose(line)));
      else for (const [blockIndex, block] of blocks.entries()) {
        if (isDiagramBlock(block)) {
          const made = diagramResult(block);
          if ('error' in made) throw new Error('Diagram pembahasan soal ' + q.no + ' tidak dapat diekspor: ' + made.error);
          await addImage(made.svg, diagramTitle(block));
        } else if (block.k === 'gap') children.push(paragraph(''));
        else if (block.k === 'table') children.push(gridTable(block));
        else if (block.k === 'box') children.push(gridTable({ headers: [], rows: block.lines.map((line) => [line]) }));
        else if (block.k === 'list') children.push(...block.items.map((item, i) => prose((block.ordered ? block.start + i + '. ' : '- ') + item)));
        else children.push(prose(block.text, block.k === 'heading', block.k === 'heading' || !!blocks[blockIndex + 1] && isDiagramBlock(blocks[blockIndex + 1])));
      }
      children.push(...reasonLines(q).map((line) => prose(line)));
      if (separateTip(q)) children.push(prose('**Cara cepat:** ' + separateTip(q)));
    }
    // Last occurrence wins in the importer. Keep authoritative scores after
    // all prose so old score mentions in an edited explanation cannot override
    // the actual options, including when their order has been shuffled.
    if (q.subtest === 'TKP') children.push(paragraph('Nilai per opsi:', true), ...siaduScoreLines(q).map((line) => paragraph(line)));
  }
  return Packer.toBlob(new Document({ creator: 'JadiASN SKD Studio', title: settings.title + ' · ' + doc.subtest,
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24, color: '000000' }, paragraph: { spacing: { line: 360 } } } },
      paragraphStyles: [
        { id: 'SiaduAnswer', name: 'Jawaban SiAdu', basedOn: 'Normal', run: { bold: true, font: 'Times New Roman', size: 24 } },
        { id: 'SiaduQuestion', name: 'Nomor soal SiAdu', basedOn: 'Normal', run: { bold: true, font: 'Times New Roman', size: 24 } },
      ] },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } }, children }],
  }));
}

export async function exportSiadu(packages: Package[], settings: Settings, scope: SiaduScope, progress?: (message: string) => void, delivery: SiaduDelivery = 'single', content: SiaduContent = 'pembahasan') {
  const docs = siaduDeliveryDocuments(packages, scope, delivery);
  if (!docs.length) throw new Error('Tidak ada soal pada subtes yang dipilih.');
  const files: Record<string, Uint8Array> = {};
  for (const [i, doc] of docs.entries()) {
    progress?.('Menyiapkan Word ' + doc.subtest + ' · ' + doc.pack.id + ' (' + (i + 1) + '/' + docs.length + ')…');
    const blob = await siaduWordBlob(doc, settings, rasterizeSvg, content), filename = siaduFilename(doc, content);
    if (docs.length === 1) { download(blob, filename); return filename; }
    files[fileSlug(doc.pack.id) + '/' + filename] = new Uint8Array(await blob.arrayBuffer());
  }
  const { zipSync } = await import('fflate');
  const filename = fileSlug(settings.title) + '-' + (packages.length === 1 ? fileSlug(packages[0].id) : packages.length + '-paket') + '-siadu' + (content === 'soal-jawaban' ? '-tanpa-pembahasan' : '') + '.zip';
  download(new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), filename);
  return filename;
}
