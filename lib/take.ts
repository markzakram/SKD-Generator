// Ambil soal satuan atau terpilih: bagian soal yang bisa disalin, serialisasi ke teks dan HTML (untuk Word dan Google Docs),
// nama berkas unduhan, dan himpunan soal terpilih. Semua fungsi di sini murni (tanpa DOM) sehingga bisa diuji di Node;
// rasterisasi gambar dan clipboard ada di lib/take-actions.ts dan lib/clipboard.ts.
import { docImageSize, fileSlug, letter, questionHeader, reasonLines, scoreLine } from './export';
import { hasStimulus, optionSvg, questionSvg } from './figures';
import { questionTable, tableGrid } from './table';
import { diagramNote, diagramPlain, diagramResult, diagramTitle, isDiagramBlock } from './diagram';
import { explanationOf, parseExplanation, plainTableRows } from './explanation';
import { boldAnswerLabels, separateTip } from './pembahasan';
import { mathHtml, plainMath } from './math';
import { mark, richHtml, stripMarks, type Run } from './richtext';
import type { Question, QuestionContent } from './types';

export type TakePart = 'soal' | 'pilihan' | 'jawaban' | 'pembahasan';
export type TakeChoice = TakePart | 'semua';
export const ALL_PARTS: readonly TakePart[] = ['soal', 'pilihan', 'jawaban', 'pembahasan'];
export const NASKAH_PARTS: readonly TakePart[] = ['soal', 'pilihan'];
export const TAKE_MENU: { id: TakeChoice; label: string; hint: string }[] = [
  { id: 'soal', label: 'Salin soal', hint: 'Pertanyaan, tabel, dan gambar stimulus' },
  { id: 'pilihan', label: 'Salin pilihan', hint: 'Pilihan A sampai E' },
  { id: 'jawaban', label: 'Salin jawaban', hint: 'Kunci (TKP: skor tiap pilihan)' },
  { id: 'pembahasan', label: 'Salin pembahasan', hint: 'Pembahasan dan alasan tiap pilihan' },
  { id: 'semua', label: 'Salin semua', hint: 'Soal lengkap dengan kunci dan pembahasan' },
];
export const partsOf = (choice: TakeChoice): readonly TakePart[] => choice === 'semua' ? ALL_PARTS : [choice];

// Gambar yang bisa ikut tersalin. 'gabungan' = stimulus + pilihan dalam satu gambar, sama dengan gambar di PDF dan Word.
export type ImageSlot = 'stimulus' | 'pilihan' | 'gabungan' | `diagram${number}`; // diagramN = diagram ke-N pada pembahasan (deret atau figural)
// Diagram yang tidak dapat digambar tidak punya gambar (dilewati di sini) dan tersalin sebagai keterangan teks (explanationNodes); nomor slot hanya untuk diagram yang berhasil digambar.
const diagramsOf = (q: Question) => (parseExplanation(explanationOf(q)) ?? []).flatMap((block) => { if (!isDiagramBlock(block)) return []; const made = diagramResult(block); return 'svg' in made ? [made.svg] : []; });
export const slotSvg = (q: Question, slot: ImageSlot) => slot.startsWith('diagram') ? diagramsOf(q)[Number(slot.slice(7))] : slot === 'stimulus' ? questionSvg(q, false) : slot === 'pilihan' ? questionSvg(q, true, false) : questionSvg(q, true);
export const hasOptionImages = (q: Question) => q.options.some((option) => optionSvg(option) !== '');

export type TakeNode =
  | { k: 'heading'; text: string }
  | { k: 'text'; text: string; bold?: boolean; small?: boolean; plain?: boolean } // plain: pembahasan terstruktur, teks polos tanpa LaTeX
  | { k: 'option'; letter: string; text: string }
  | { k: 'table'; headers: string[]; rows: string[][]; columns?: number; centered?: boolean } // columns: judul satu sel selebar tabel (tabel pembahasan)
  | { k: 'image'; slot: ImageSlot; alt: string; text?: string; exactSize?: boolean }; // text: pengganti teks polos bila gambar tidak ikut
const lines = (value: string) => value.split('\n').filter((line) => line.trim() !== '');
// Pembahasan terstruktur menjadi node teks (sub-judul tebal, butir "• ...", persamaan) dan tabel; tanpa struktur tetap per baris seperti dulu.
function explanationNodes(explanation: string): TakeNode[] {
  const blocks = parseExplanation(explanation);
  if (!blocks) return lines(explanation).map((text): TakeNode => ({ k: 'text', text }));
  let diagrams = 0;
  return blocks.flatMap((block): TakeNode[] => {
    if (block.k === 'gap') return [];
    if (isDiagramBlock(block)) { const made = diagramResult(block); return 'error' in made ? [{ k: 'text', text: diagramNote(made.error), plain: true }] : [{ k: 'image', slot: ('diagram' + diagrams++) as ImageSlot, alt: diagramTitle(block), text: diagramPlain(block), exactSize: block.k === 'guide' }]; }
    if (block.k === 'heading') return [{ k: 'text', bold: true, text: block.text, plain: true }];
    if (block.k === 'box') return block.lines.map((line): TakeNode => ({ k: 'text', plain: true, text: line }));
    if (block.k === 'list') return block.items.map((item, i): TakeNode => ({ k: 'text', plain: true, text: (block.ordered ? block.start + i + '. ' : '• ') + item }));
    if (block.k === 'table') { const grid = tableGrid(block); return [{ k: 'table', headers: grid.header?.map((cell) => cell.text) ?? [], rows: grid.rows.map((row) => row.map((cell) => cell.text)), columns: grid.columns, centered: grid.centered }]; }
    return [{ k: 'text', text: block.text, plain: true }];
  });
}

// Bagian-bagian soal sebagai kelompok node. Urutannya mengikuti naskah: judul, soal, pilihan, jawaban, pembahasan.
export function takeSections(q: Question, parts: readonly TakePart[], heading = false): TakeNode[][] {
  const has = (part: TakePart) => parts.includes(part);
  const sections: TakeNode[][] = [];
  if (heading) sections.push([{ k: 'heading', text: questionHeader(q) }]);
  const stimulus = Boolean(q.visual) && hasStimulus(q), optionImages = hasOptionImages(q);
  const merged = has('soal') && has('pilihan') && stimulus && optionImages;
  if (has('soal')) {
    const section: TakeNode[] = lines(q.stem).map((text) => ({ k: 'text', text }));
    const table=questionTable(q);
    if (table) section.push({ k: 'table', ...table });
    if (merged) section.push({ k: 'image', slot: 'gabungan', alt: 'Gambar soal ' + q.no + ' beserta pilihan A sampai E' });
    else if (stimulus) section.push({ k: 'image', slot: 'stimulus', alt: 'Gambar soal ' + q.no });
    sections.push(section);
  }
  if (has('pilihan') && !merged) {
    sections.push(optionImages ? [{ k: 'image', slot: 'pilihan', alt: 'Pilihan gambar A sampai E, soal ' + q.no }] :
      q.options.map((option, i) => ({ k: 'option', letter: letter(i), text: option.text })));
  }
  if (has('jawaban')) {
    const section: TakeNode[] = [{ k: 'text', bold: boldAnswerLabels(q), text: 'Jawaban: ' + letter(q.answer) + (q.subtest === 'TKP' ? ' (' + q.options[q.answer].score + ' poin)' : '') }];
    if (q.subtest === 'TKP') section.push({ k: 'text', text: 'Skor tiap pilihan: ' + scoreLine(q) });
    sections.push(section);
  }
  if (has('pembahasan')) {
    sections.push([{ k: 'text', bold: boldAnswerLabels(q), text: 'Pembahasan:' }, ...explanationNodes(explanationOf(q)),
      ...reasonLines(q).map((line): TakeNode => ({ k: 'text', small: true, plain: true, text: line })),...(separateTip(q)?[{k:'text' as const,text:'Cara cepat: '+separateTip(q)}]:[])]);
  }
  return sections;
}
export const sectionSlots = (sections: TakeNode[][]): ImageSlot[] =>
  [...new Set(sections.flat().flatMap((node) => node.k === 'image' ? [node.slot] : []))];

// ---- Teks biasa (cadangan bila browser tidak mengizinkan salinan kaya) ----------------------------------------------------
const IMAGE_TEXT = { stimulus: 'Gambar soal', pilihan: 'Gambar pilihan A sampai E', gabungan: 'Gambar soal dan pilihan A sampai E' };
const imageText = (slot: ImageSlot) => slot.startsWith('diagram') ? 'Diagram pola deret' : IMAGE_TEXT[slot as 'stimulus' | 'pilihan' | 'gabungan'];
// Penanda tebal dan coret (lib/richtext.ts) dibuang pada teks polos; coretan tidak tergambar tetapi isi dan alasannya tetap terbaca.
const plainRich = (text: string) => plainMath(stripMarks(text));
const nodeText = (node: TakeNode): string => node.k === 'table' ? [...(node.headers.length?[node.headers]:[]), ...node.rows].map((row) => row.map(plainRich).join(' | ')).join('\n') :
  node.k === 'option' ? node.letter + '. ' + plainRich(node.text) : node.k === 'image' ? node.text ?? '[' + imageText(node.slot) + ']' : plainRich(node.text);
// Teks biasa tersalin sebagai teks terbaca ("A. 332", "3/5 + 1/5 - 7/10", tabel bersekat " | "), bukan LaTeX (\(332\)) atau penanda mentah.
const plainOf = (node: TakeNode) => node.k === 'image' && node.text !== undefined ? node.text : node.k === 'table' && node.columns ? plainTableRows(node).join('\n') : nodeText(node);
export const sectionsText = (sections: TakeNode[][]) => sections.map((section) => section.map(node=>node.k==='heading'?node.text:plainOf(node)).join('\n')).join('\n\n');
export const joinTexts = (texts: string[]) => texts.join('\n\n\n');

// ---- HTML untuk Word dan Google Docs --------------------------------------------------------------------------------------
// Hanya gaya inline: clipboard peramban membuang <style>, dan Word membaca gaya inline. Gambar berupa PNG data URI.
export type TakeImage = { url: string; width: number; height: number };
export type TakeImages = Partial<Record<ImageSlot, TakeImage>>;
export const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cell = 'border:1px solid #bfbfbf;padding:3pt 6pt;text-align:left;';
function nodeHtml(node: TakeNode, images: TakeImages, renderText:(text:string,style?:Run)=>string): string {
  switch (node.k) {
    case 'heading': return '<p style="margin:0 0 6pt;font-size:10pt"><b>' + esc(node.text) + '</b></p>';
    // richHtml: **tebal** dan ~~coret~~ pada teks pembahasan menjadi <b> dan <s> (Word dan Google Docs membaca keduanya); teks tanpa penanda tidak berubah.
    case 'text': return '<p style="margin:0 0 ' + (node.small ? 3 : 6) + 'pt' + (node.small ? ';font-size:10pt' : '') + '">' + richHtml(node.bold ? mark.bold(node.text) : node.text, renderText) + '</p>';
    case 'option': return '<p style="margin:0 0 3pt"><b>' + node.letter + '.</b> ' + renderText(node.text) + '</p>';
    case 'table': return '<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;margin:0 0 8pt">' +
      (node.headers.length ? '<tr>' + node.headers.map((header, i, all) => '<th' + (node.columns && i === all.length - 1 && node.columns > all.length ? ' colspan="' + (node.columns - all.length + 1) + '"' : '') + ' style="' + cell + (node.columns ? ';text-align:center' : '') + '">' + richHtml(mark.bold(header),renderText) + '</th>').join('') + '</tr>' : '') +
      node.rows.map((row) => '<tr>' + row.map((value) => '<td style="' + cell + (node.centered ? 'text-align:center;' : '') + '">' + richHtml(value,renderText) + '</td>').join('') + '</tr>').join('') + '</table>';
    case 'image': {
      const image = images[node.slot];
      if (!image) return node.text ? node.text.split('\n').map((line) => '<p style="margin:0 0 3pt">' + esc(line) + '</p>').join('') : '<p style="margin:0 0 6pt"><i>[' + imageText(node.slot) + ']</i></p>';
      const size = node.exactSize ? { width: image.width, height: image.height } : docImageSize(image);
      return '<p style="margin:6pt 0 8pt"><img src="' + image.url + '" width="' + Math.round(size.width) + '" height="' + Math.round(size.height) + '" alt="' + esc(node.alt) + '"></p>';
    }
  }
}
export const sectionsHtml = (sections: TakeNode[][], images: TakeImages, renderText:(text:string,style?:Run)=>string=mathHtml) => sections.flat().map((node) => nodeHtml(node, images, renderText)).join('');
// Gaya akademik sama dengan dokumen Word.
export const joinHtml = (items: string[]) => '<div style="font-family:Times New Roman,serif;font-size:12pt;line-height:1.5;color:#000000">' +
  items.join('<hr style="border:0;border-top:1px solid #bfbfbf;margin:12pt 0">') + '</div>';

// ---- Nama berkas -----------------------------------------------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(3, '0');
export type TakeContext = { title: string; packId: string };
export function takeFileName(context: TakeContext, questions: readonly Question[], withKey: boolean | QuestionContent, kind: 'png' | 'pdf' | 'zip'): string {
  const base = fileSlug(context.title) + '-' + fileSlug(context.packId), mode = withKey === 'soal-jawaban' ? 'soal-jawaban' : withKey && withKey !== 'soal' ? 'dengan-kunci' : 'tanpa-kunci';
  if (questions.length === 1) return base + '-soal-' + pad(questions[0].no) + '-' + questions[0].subtest + '-' + mode + '.' + kind;
  return base + '-' + questions.length + '-soal-terpilih-' + mode + (kind === 'zip' ? '-png.zip' : '.' + kind);
}
// Nama tiap PNG di dalam ZIP; bila dua soal bernomor sama, nama kedua diberi akhiran supaya tidak saling menimpa.
export function pngEntryNames(questions: readonly Question[]): string[] {
  const seen = new Map<string, number>();
  return questions.map((q) => {
    const base = 'soal-' + pad(q.no) + '-' + q.subtest, count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return base + (count > 1 ? '-' + count : '') + '.png';
  });
}

// ---- Soal terpilih ---------------------------------------------------------------------------------------------------------
export function togglePick(picked: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(picked);
  if (!next.delete(id)) next.add(id);
  return next;
}
// "Pilih semua": menambahkan semua soal yang tampil, kecuali yang dikeluarkan dari paket (seperti pada ekspor biasa).
export const selectable = (questions: readonly Question[]) => questions.filter((q) => !q.review?.excluded);
export function pickAll(picked: ReadonlySet<string>, questions: readonly Question[]): Set<string> {
  const next = new Set(picked);
  for (const q of selectable(questions)) next.add(q.id);
  return next;
}
// Soal terpilih menurut urutan di paket, bukan urutan klik; id yang sudah tidak ada di paket diabaikan.
export const pickedQuestions = (all: readonly Question[], picked: ReadonlySet<string>) => all.filter((q) => picked.has(q.id));
