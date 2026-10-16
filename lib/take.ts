// Ambil soal satuan atau terpilih: bagian soal yang bisa disalin, serialisasi ke teks dan HTML (untuk Word dan Google Docs),
// nama berkas unduhan, dan himpunan soal terpilih. Semua fungsi di sini murni (tanpa DOM) sehingga bisa diuji di Node;
// rasterisasi gambar dan clipboard ada di lib/take-actions.ts dan lib/clipboard.ts.
import { docImageSize, fileSlug, letter, questionHeader, reasonLine, scoreLine } from './export';
import { hasStimulus, optionSvg, questionSvg } from './figures';
import type { Question } from './types';

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
export type ImageSlot = 'stimulus' | 'pilihan' | 'gabungan';
export const slotSvg = (q: Question, slot: ImageSlot) => slot === 'stimulus' ? questionSvg(q, false) : slot === 'pilihan' ? questionSvg(q, true, false) : questionSvg(q, true);
export const hasOptionImages = (q: Question) => q.options.some((option) => optionSvg(option) !== '');

export type TakeNode =
  | { k: 'heading'; text: string }
  | { k: 'text'; text: string; bold?: boolean; small?: boolean }
  | { k: 'option'; letter: string; text: string }
  | { k: 'table'; headers: string[]; rows: string[][] }
  | { k: 'image'; slot: ImageSlot; alt: string };
const lines = (value: string) => value.split('\n').filter((line) => line.trim() !== '');

// Bagian-bagian soal sebagai kelompok node. Urutannya mengikuti naskah: judul, soal, pilihan, jawaban, pembahasan.
export function takeSections(q: Question, parts: readonly TakePart[], heading = false): TakeNode[][] {
  const has = (part: TakePart) => parts.includes(part);
  const sections: TakeNode[][] = [];
  if (heading) sections.push([{ k: 'heading', text: questionHeader(q) }]);
  const stimulus = Boolean(q.visual) && hasStimulus(q), optionImages = hasOptionImages(q);
  const merged = has('soal') && has('pilihan') && stimulus && optionImages;
  if (has('soal')) {
    const section: TakeNode[] = lines(q.stem).map((text) => ({ k: 'text', text }));
    if (q.table) section.push({ k: 'table', headers: q.table.headers, rows: q.table.rows });
    if (merged) section.push({ k: 'image', slot: 'gabungan', alt: 'Gambar soal ' + q.no + ' beserta pilihan A sampai E' });
    else if (stimulus) section.push({ k: 'image', slot: 'stimulus', alt: 'Gambar soal ' + q.no });
    sections.push(section);
  }
  if (has('pilihan') && !merged) {
    sections.push(optionImages ? [{ k: 'image', slot: 'pilihan', alt: 'Pilihan gambar A sampai E, soal ' + q.no }] :
      q.options.map((option, i) => ({ k: 'option', letter: letter(i), text: option.text })));
  }
  if (has('jawaban')) {
    const section: TakeNode[] = [{ k: 'text', bold: true, text: 'Jawaban: ' + letter(q.answer) + (q.subtest === 'TKP' ? ' (' + q.options[q.answer].score + ' poin)' : '') }];
    if (q.subtest === 'TKP') section.push({ k: 'text', text: 'Skor tiap pilihan: ' + scoreLine(q) });
    sections.push(section);
  }
  if (has('pembahasan')) {
    sections.push([{ k: 'text', bold: true, text: 'Pembahasan' }, ...lines(q.explanation).map((text): TakeNode => ({ k: 'text', text })),
      ...q.options.map((_, i): TakeNode => ({ k: 'text', small: true, text: reasonLine(q, i) }))]);
  }
  return sections;
}
export const sectionSlots = (sections: TakeNode[][]): ImageSlot[] =>
  [...new Set(sections.flat().flatMap((node) => node.k === 'image' ? [node.slot] : []))];

// ---- Teks biasa (cadangan bila browser tidak mengizinkan salinan kaya) ----------------------------------------------------
const IMAGE_TEXT: Record<ImageSlot, string> = { stimulus: 'Gambar soal', pilihan: 'Gambar pilihan A sampai E', gabungan: 'Gambar soal dan pilihan A sampai E' };
const nodeText = (node: TakeNode): string => node.k === 'table' ? [node.headers, ...node.rows].map((row) => row.join(' | ')).join('\n') :
  node.k === 'option' ? node.letter + '. ' + node.text : node.k === 'image' ? '[' + IMAGE_TEXT[node.slot] + ']' : node.text;
export const sectionsText = (sections: TakeNode[][]) => sections.map((section) => section.map(nodeText).join('\n')).join('\n\n');
export const joinTexts = (texts: string[]) => texts.join('\n\n\n');

// ---- HTML untuk Word dan Google Docs --------------------------------------------------------------------------------------
// Hanya gaya inline: clipboard peramban membuang <style>, dan Word membaca gaya inline. Gambar berupa PNG data URI.
export type TakeImage = { url: string; width: number; height: number };
export type TakeImages = Partial<Record<ImageSlot, TakeImage>>;
export const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cell = 'border:1px solid #bfbfbf;padding:3pt 6pt;text-align:left;';
function nodeHtml(node: TakeNode, images: TakeImages): string {
  switch (node.k) {
    case 'heading': return '<p style="margin:0 0 6pt;font-size:10pt"><b>' + esc(node.text) + '</b></p>';
    case 'text': return '<p style="margin:0 0 ' + (node.small ? 3 : 6) + 'pt' + (node.small ? ';font-size:10pt' : '') + '">' + (node.bold ? '<b>' + esc(node.text) + '</b>' : esc(node.text)) + '</p>';
    case 'option': return '<p style="margin:0 0 3pt"><b>' + node.letter + '.</b> ' + esc(node.text) + '</p>';
    case 'table': return '<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;margin:0 0 8pt">' +
      '<tr>' + node.headers.map((header) => '<th style="' + cell + 'background:#f2f2f2">' + esc(header) + '</th>').join('') + '</tr>' +
      node.rows.map((row) => '<tr>' + row.map((value) => '<td style="' + cell + '">' + esc(value) + '</td>').join('') + '</tr>').join('') + '</table>';
    case 'image': {
      const image = images[node.slot];
      if (!image) return '<p style="margin:0 0 6pt"><i>[' + IMAGE_TEXT[node.slot] + ']</i></p>';
      const size = docImageSize(image);
      return '<p style="margin:6pt 0 8pt"><img src="' + image.url + '" width="' + Math.round(size.width) + '" height="' + Math.round(size.height) + '" alt="' + esc(node.alt) + '"></p>';
    }
  }
}
export const sectionsHtml = (sections: TakeNode[][], images: TakeImages) => sections.flat().map((node) => nodeHtml(node, images)).join('');
// Beberapa soal dipisah garis tipis; satu pembungkus memberi huruf Calibri 11 pt seperti ekspor Word.
export const joinHtml = (items: string[]) => '<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#000000">' +
  items.join('<hr style="border:0;border-top:1px solid #bfbfbf;margin:12pt 0">') + '</div>';

// ---- Nama berkas -----------------------------------------------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(3, '0');
export type TakeContext = { title: string; packId: string };
export function takeFileName(context: TakeContext, questions: readonly Question[], withKey: boolean, kind: 'png' | 'pdf' | 'zip'): string {
  const base = fileSlug(context.title) + '-' + fileSlug(context.packId), mode = withKey ? 'dengan-kunci' : 'tanpa-kunci';
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
