// Pembahasan terstruktur (TIU mengikuti Panduan Produksi Soal TIU JadiASN). Representasinya tetap satu string `Question.explanation`,
// satu blok per baris, sehingga soal lama, penyuntingan di kotak teks, ekspor CSV, dan pemeriksaan mutu tidak berubah:
//   baris kosong                  jarak antarblok
//   `Diketahui:` dst.             sub-judul tebal (hanya HEADINGS dan HEADINGS_PLAIN: sub-judul yang ada di contoh panduan)
//   `• teks` / `1. teks`          daftar bullet / bernomor (baris berurutan menjadi satu daftar)
//   `| sel | sel |`               tabel; baris `|---|---|` setelah baris pertama menandai baris itu sebagai header (tanpa pemisah = tanpa header);
//                                 header satu sel pada tabel lebih lebar menjadi judul selebar tabel; baris pendek diisi sel kosong;
//                                 sel berbentuk `==teks==` disorot
//   `> teks`                      kotak bergaris (rumus yang harus diingat); baris `> ` berurutan menjadi satu kotak, butir `> • teks` ikut
//   `\[ ... \]` utuh satu baris   persamaan tampil (LaTeX; `aligned` lewat `aligned()` untuk "=" rata kiri)
//   baris lain                    paragraf (rumus biasa lewat \( \) atau notasi lama yang sudah didukung lib/math.ts)
//   `@deret` / `@gambar` / `@graf {JSON}`  diagram deret (lib/chain.ts), figural beranotasi (lib/figural/annotate.ts), dan graf rute (lib/graph.ts); digambar sebagai SVG
//   `**teks**` `~~teks~~`         tebal dan coret sebaris; `{merah:teks}` memberi warna pada teks maupun rumus
//   `@acuan id`                  gambar asli panduan akademik, melalui daftar ID yang diizinkan
//   `{kunci}`                     huruf kunci jawaban; diisi saat ditampilkan (explanationOf), jadi tetap benar setelah opsi diacak atau disunting
//   `{opsi:N}. teks`              awal butir analisis opsi silogisme narasi; hurufnya diisi dan butirnya diurutkan menurut huruf saat ditampilkan (resolveOptionMarks)
// `parseExplanation` mengembalikan null bila tidak ada satu pun penanda di atas (paragraf biasa saja, tanpa rumus \( \)). Soal TWK/TKP dan pembahasan lama
// yang demikian tetap ditampilkan dan diekspor persis seperti sebelumnya.
import { parseChainLine, type Chain } from './chain';
import { diagramPlain, diagramResult, isDiagramBlock } from './diagram';
import { parseFigureLine, resolveOptionCells, type FigureDiagram } from './figural/annotate';
import { parseGraphLine, type GraphDiagram } from './graph';
import { parseGuideLine, type GuideImageId } from './guide-images';
import { latexText, plainMath } from './math';
import { hasMarks, mark, stripMarks } from './richtext';
import { tableGrid } from './table';
import { academicText } from './academic-format';
import { caseExplanation } from './pembahasan';

export type ExplanationBlock =
  | { k: 'p'; text: string }
  | { k: 'heading'; text: string }
  | { k: 'list'; ordered: boolean; start: number; items: string[] }
  | { k: 'table'; headers: string[]; rows: string[][] }
  | { k: 'box'; lines: string[] }
  | { k: 'chain'; chain: Chain }
  | { k: 'figure'; figure: FigureDiagram }
  | { k: 'graph'; graph: GraphDiagram }
  | { k: 'guide'; id: GuideImageId }
  | { k: 'math'; text: string }
  | { k: 'gap' };

// Sub-judul panduan: bertitik dua di akhir (HEADINGS), atau persis salah satu judul tanpa titik dua (HEADINGS_PLAIN, mis. "RUMUS WOWO").
export const HEADINGS = ['Diketahui', 'Ditanyakan', 'Rumus Dasar', 'Rumus Konsep', 'Penyelesaian', 'Kesimpulan', 'Rumus Cepat', 'INGAT', 'Ingat rumus'];
export const HEADINGS_PLAIN = ['RUMUS WOWO', 'Tambahan pekerja', 'Tambahan hari', 'Total realisasi hari', 'Total realisasi hari (karena ditanyakan tambahan hari)'];
const HEADING = new RegExp('^(?:' + HEADINGS.join('|') + '):$');
const BULLET = /^•\s+(\S.*)$/;
const NUMBERED = /^(\d{1,2})\.\s+(\S.*)$/;
const TABLE_ROW = /^\|.*\|$/;
const BOX_ROW = /^>\s?(.*)$/;
const SEPARATOR_CELL = /^:?-{2,}:?$/;
const DISPLAY = /^\\\[[\s\S]+\\\]$/;

const cellsOf = (row: string) => row.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
const bareTableRow = (line: string) => !/[\\$]/.test(line) && /\S\s+\|\s+\S/.test(line);

export function parseExplanation(text: string): ExplanationBlock[] | null {
  const blocks: ExplanationBlock[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) { if (blocks.length && blocks[blocks.length - 1].k !== 'gap') blocks.push({ k: 'gap' }); continue; }
    const last = blocks[blocks.length - 1];
    let match: RegExpMatchArray | null;
    if (TABLE_ROW.test(line) || bareTableRow(line) && i + 1 < lines.length && bareTableRow(lines[i + 1]) && cellsOf(line).length === cellsOf(lines[i + 1]).length) {
      const bare = !TABLE_ROW.test(line);
      const rows = [cellsOf(line)];
      while (i + 1 < lines.length && (TABLE_ROW.test(lines[i + 1]) || bare && bareTableRow(lines[i + 1]) && cellsOf(lines[i + 1]).length === rows[0].length)) rows.push(cellsOf(lines[++i]));
      const header = rows.length > 1 && rows[1].every((cell) => SEPARATOR_CELL.test(cell));
      const labels = bare && rows.length > 1 && rows[0].every(cell => /[a-z]/i.test(cell)) && !rows[1].every(cell => /[a-z]/i.test(cell));
      blocks.push({ k: 'table', headers: header || labels ? rows[0] : [], rows: header ? rows.slice(2) : labels ? rows.slice(1) : rows });
    } else if (line.startsWith('@deret ') && parseChainLine(line)) blocks.push({ k: 'chain', chain: parseChainLine(line)! });
    else if (line.startsWith('@gambar ') && parseFigureLine(line)) blocks.push({ k: 'figure', figure: parseFigureLine(line)! });
    else if (line.startsWith('@graf ') && parseGraphLine(line)) blocks.push({ k: 'graph', graph: parseGraphLine(line)! });
    else if (parseGuideLine(line)) blocks.push({ k: 'guide', id: parseGuideLine(line)! });
    else if ((match = BOX_ROW.exec(line))) {
      const boxLines = [match[1]];
      while (i + 1 < lines.length && BOX_ROW.test(lines[i + 1])) boxLines.push(BOX_ROW.exec(lines[++i])![1]);
      blocks.push({ k: 'box', lines: boxLines });
    } else if (HEADING.test(line) || HEADINGS_PLAIN.includes(line)) blocks.push({ k: 'heading', text: line });
    else if (DISPLAY.test(line)) blocks.push({ k: 'math', text: line });
    else if ((match = BULLET.exec(line))) {
      if (last?.k === 'list' && !last.ordered) last.items.push(match[1]); else blocks.push({ k: 'list', ordered: false, start: 1, items: [match[1]] });
    } else if ((match = NUMBERED.exec(line))) {
      if (last?.k === 'list' && last.ordered) last.items.push(match[2]); else blocks.push({ k: 'list', ordered: true, start: Number(match[1]), items: [match[2]] });
    } else blocks.push({ k: 'p', text: line });
  }
  while (blocks.length && blocks[blocks.length - 1].k === 'gap') blocks.pop();
  // Paragraf yang memuat rumus \( \) atau penanda format (tebal, coret) juga dianggap terstruktur (silogisme): rumus dan penandanya harus ikut diterjemahkan pada salinan teks dan CSV, dan baris kosongnya menjadi jarak.
  return blocks.some((block) => (block.k !== 'p' && block.k !== 'gap') || (block.k === 'p' && (block.text.includes('\\(') || hasMarks(block.text)))) ? blocks : null;
}

// Semua potongan teks yang diketik dengan rumus (paragraf, sub-judul, butir, kotak, persamaan, sel tabel), untuk menyiapkan gambar rumus
// ekspor. Pembahasan tanpa struktur dikembalikan utuh. Sel tabel diambil dari tableGrid (teks seperti yang ditata dan digambar: sel "x" menjadi rumus \(\text{x}\),
// sorot "==teks==" tanpa tanda), supaya gambar rumus yang disiapkan sama dengan yang dipakai Word; teks mentah sel tidak lagi dipakai.
export function explanationTexts(text: string): string[] {
  const blocks = parseExplanation(text);
  if (!blocks) return [text];
  const cells = (table: { headers: string[]; rows: string[][] }) => { const grid = tableGrid(table); return [
    ...(grid.header ?? []).map((cell) => mark.bold(cell.text)), ...grid.rows.flat().map((cell) => cell.mark ? mark.bold(cell.text) : cell.text),
  ]; };
  // Penanda warna dipertahankan sampai prepareMathImages memecah run: rumus merah dan hitam memakai gambar berbeda.
  return blocks.flatMap((block) => block.k === 'gap' || isDiagramBlock(block) ? [] : block.k === 'list' ? block.items : block.k === 'box' ? block.lines.map((line) => line.replace(/^•\s+/, '')) :
    block.k === 'table' ? cells(block) : [block.k === 'heading' ? '**' + block.text + '**' : block.text]);
}

// Catatan asal butir tetap tersimpan untuk editor/cadangan, tetapi bukan bagian
// naskah peserta atau pembahasan terbit. Hanya baris metadata yang dibuang;
// kata "sumber" di dalam materi (misalnya sumber energi) tidak diubah.
export function documentExplanation(q: Parameters<typeof explanationOf>[0]): string {
  return explanationOf(q).split(/\r?\n/).filter((line) => !/^\s*(?:\*\*)?Sumber\s*:(?:\*\*)?\s*/i.test(line)).join('\n').trim();
}

// Bagian "Analisis setiap opsi" pada pembahasan silogisme narasi (lib/tiu-logika.ts, lib/silo-contoh.ts): opsi yang salah tertulis coret beserta alasannya. Alasan opsi yang
// ditampilkan di bawah soal tidak diulang bila pembahasan sudah memuat bagian ini. Silogisme Biasa tidak memuat bagian ini (blueprint Bagian 8: format inti berakhir pada jawaban kalimat).
export const ANALYSIS_MARK = '**Analisis setiap opsi**';
export const hasOptionAnalysis = (explanation: string) => explanation.includes(ANALYSIS_MARK);

// ---- Huruf kunci dan huruf opsi -----------------------------------------------------------------------------------------------------------
// Penutup "Jadi, jawaban yang benar adalah {kunci}." memakai penanda; hurufnya diambil dari `answer` saat tampil/ekspor.
export const KEY_MARK = '{kunci}';
// Awal butir analisis opsi: `{opsi:N}. teks opsi`. N = `Option.ref` (nomor tetap opsi, ikut berpindah bersama opsinya), jadi huruf yang tampil selalu sesuai urutan opsi saat itu.
const OPTION_ENTRY = /^\{opsi:(\d)\}\. /;
export const optionEntryMark = (ref: number) => '{opsi:' + ref + '}. ';
// Bagian analisis opsi menurut blueprint (Bagian B): notasi tambahan bila opsi memuat proposisi baru, lalu tiap opsi `X. teks` (salah dicoret) dan `→ **rumus** — alasan (**status**)`.
export type AnalysisEntry = { ref: number; text: string; symbol: string | null; reason: string; key: boolean };
export function analysisBlock(entries: AnalysisEntry[], extra: { name: string; text: string }[] = []): string[] {
  const lines = [ANALYSIS_MARK];
  for (const item of extra) lines.push(inline(item.name) + ': ' + item.text);
  if (extra.length) lines.push('Notasi tambahan ini hanya memetakan isi opsi dan tidak menjadi premis soal.');
  entries.forEach((entry, i) => lines.push(...(i > 0 ? [''] : []), optionEntryMark(entry.ref) + (entry.key ? entry.text : mark.strike(entry.text)),
    '→ ' + mark.bold(entry.symbol === null ? 'Tidak dapat disimpulkan' : inline(entry.symbol)) + ' — ' + entry.reason + ' (' + mark.bold(entry.key ? 'kesimpulan yang dicari' : 'bukan kesimpulan yang dicari') + ')'));
  return lines;
}
// Mengganti `{opsi:N}` dengan hurufnya dan mengurutkan butir analisis menurut huruf (A sampai E). Butir terdiri atas baris `{opsi:N}. …` dan baris sesudahnya sampai baris kosong
// berikutnya; baris sebelum butir pertama (notasi tambahan) tetap di tempatnya. Opsi tanpa `ref` dibaca menurut urutannya.
export function resolveOptionMarks(text: string, options: { ref?: number }[] | undefined): string {
  if (!options || !text.includes('{opsi:')) return text;
  const lines = text.split('\n'), first = lines.findIndex((line) => OPTION_ENTRY.test(line));
  if (first < 0) return text;
  const hasRef = options.some((option) => option.ref !== undefined);
  const letterOf = (ref: number) => { const at = hasRef ? options.findIndex((option) => option.ref === ref) : ref; return at >= 0 && at < options.length ? String.fromCharCode(65 + at) : '?'; };
  const entries: { letter: string; lines: string[] }[] = [], rest: string[] = [];
  let current: { letter: string; lines: string[] } | undefined;
  for (const line of lines.slice(first)) {
    const match = OPTION_ENTRY.exec(line);
    if (match) { current = { letter: letterOf(Number(match[1])), lines: [line.replace(OPTION_ENTRY, '')] }; current.lines[0] = current.letter + '. ' + current.lines[0]; entries.push(current); }
    else if (line === '') current = undefined;
    else if (current) current.lines.push(line);
    else rest.push(line);
  }
  const sorted = entries.map((entry, index) => ({ ...entry, index })).sort((a, b) => a.letter.localeCompare(b.letter) || a.index - b.index);
  return [...lines.slice(0, first), ...sorted.flatMap((entry, i) => [...(i > 0 ? [''] : []), ...entry.lines]), ...rest].join('\n');
}
// Kotak opsi pada diagram `@gambar` (opt) diisi huruf dan diurutkan menurut opsi soal yang sedang tampil (resolveOptionCells).
// Soal TWK dan TKP (q.subtest) tampil sebagai pembahasan akhir yang dirakit lib/pembahasan.ts: paragraf, alasan hanya empat opsi nonkunci, dan cara cepat.
export function explanationOf(q: { explanation: string; answer: number; options?: { scene?: import('./types').Scene; ref?: number; text?: string; reason?: string; score?: number }[]; provenance?: import('./types').Provenance; subtest?: string; topic?: string; tip?: string; kasus?: { kataKunci?: string } }): string {
  let text = academicText(q, q.explanation);
  if (q.options && text.includes('"opt":true')) text = text.split('\n').map((line) => line.startsWith('@gambar ') ? resolveOptionCells(line, q.options!) : line).join('\n');
  text = resolveOptionMarks(text, q.options);
  text = text.includes(KEY_MARK) ? text.replaceAll(KEY_MARK, String.fromCharCode(65 + q.answer)) : text;
  return caseExplanation(q, text);
}

// Pemeriksaan pembahasan hasil suntingan: baris diagram (@deret, @gambar, @graf) yang JSON-nya terbaca tetapi tidak bisa digambar (mis. bentuk figural tidak dikenal)
// dilaporkan sebagai pesan, supaya editor menolak menyimpannya. Baris yang JSON atau strukturnya rusak tidak dikenali sebagai diagram dan tampil sebagai teks mentah (tidak dilaporkan).
export function diagramProblems(q: Parameters<typeof explanationOf>[0]): string[] {
  const problems: string[] = [];
  for (const line of explanationOf(q).replace(/\r\n?/g, '\n').split('\n')) {
    const block = /^@(?:deret|gambar|graf) /.test(line.trim()) ? parseExplanation(line)?.find(isDiagramBlock) : undefined;
    const made = block ? diagramResult(block) : undefined;
    if (made && 'error' in made) problems.push('Diagram pada pembahasan tidak dapat digambar (' + line.trim().split(' ')[0] + '): ' + made.error + '.');
  }
  return problems;
}

// ---- Penyusun pembahasan (dipakai generator) ------------------------------------------------------------------------------
export const inline = (latex: string) => '\\(' + latex + '\\)';
export const display = (latex: string) => '\\[' + latex + '\\]';
// Persamaan bertingkat: tiap larik satu baris, seluruhnya dimulai pada kolom yang sama sehingga tanda "=" rata kiri.
export const aligned = (rows: string[]) => display('\\begin{aligned}' + rows.map((row) => '&' + row).join('\\\\') + '\\end{aligned}');
export const bullet = (text: string) => '• ' + text;
export const boxLines = (lines: string[]) => lines.map((line) => '> ' + line);
export function tableLines(table: { headers?: string[]; rows: string[][] }): string[] {
  const row = (cells: string[]) => '| ' + cells.join(' | ') + ' |';
  return [...(table.headers?.length ? [row(table.headers), '|' + table.headers.map(() => '---').join('|') + '|'] : []), ...table.rows.map(row)];
}

// Teks polos tanpa penanda tebal dan coret (isi tetap terbaca, hanya gayanya yang hilang): salinan teks dan CSV.
const plainRich = (text: string) => plainMath(stripMarks(text));
// ---- Teks polos (salinan teks dan CSV) ----------------------------------------------------------------------------------------------
// Tabel menjadi baris bersekat " | " tanpa baris "---"; sel kosong di ujung baris dibuang.
export function plainTableRows(table: { headers: string[]; rows: string[][] }): string[] {
  const grid = tableGrid(table);
  const line = (cells: string[]) => { const out = cells.map((cell) => plainRich(cell)); while (out.length > 1 && out[out.length - 1] === '') out.pop(); return out.join(' | '); };
  return [...(grid.header ? [line(grid.header.map((cell) => cell.text))] : []), ...grid.rows.map((row) => line(row.map((cell) => cell.text)))];
}
// Pembahasan menjadi teks terbaca, termasuk panah di dalam paragraf biasa.
export function explanationPlain(text: string): string {
  const blocks = parseExplanation(text);
  if (!blocks) return plainRich(text);
  return blocks.flatMap((block): string[] => block.k === 'gap' ? [''] : block.k === 'heading' ? [block.text] : block.k === 'table' ? plainTableRows(block) :
    block.k === 'box' ? block.lines.map((line) => plainRich(line)) : isDiagramBlock(block) ? diagramPlain(block).split('\n') :
      block.k === 'list' ? block.items.map((item, i) => (block.ordered ? block.start + i + '. ' : '• ') + plainRich(item)) : [plainRich(block.text)]).join('\n');
}
