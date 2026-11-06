import type { Question } from './types';

// Older imports stored the first numerical row in `headers`. Preserve it as data.
// Other tables (prices, schedules, etc.) retain their descriptive column headings.
export function questionTable(q: Pick<Question, 'table' | 'subtopic' | 'family'>) {
  if (!q.table) return undefined;
  const matrix = q.subtopic === 'Matriks Deret' || q.family === 'matriks-angka';
  if (!matrix) return q.table;
  const labels = q.table.headers.every(v => /^\s*Kolom\s+\d+\s*$/i.test(v));
  return { headers: [], rows: q.table.headers.length && !labels ? [q.table.headers, ...q.table.rows] : q.table.rows };
}

// Tata letak bersama tabel pembahasan di layar, Word, salinan, PDF, dan PNG. Mendukung header angka atau kata, sel kosong, tanpa header,
// baris yang lebih pendek (diisi sel kosong), judul satu sel selebar tabel, dan sel sorot ("==teks==", untuk penanda ✓ / x / ?).
// plain: header angka urut polos (1, 2, ..., n pada tabel susunan atau urutan) yang ditulis sebagai teks biasa di PDF, Word, dan SiAdu, bukan rumus; selain itu angka tetap dirumuskan seperti biasa.
export type TableCell = { text: string; mark: boolean; span: number; plain?: boolean };
// centered: semua sel pendek (segitiga rumus, tabel posisi, matriks ✓ x ?, jadwal) ditengahkan seperti di panduan; tabel berisi kalimat atau rumus tetap rata kiri.
export type TableGrid = { columns: number; header: TableCell[] | null; rows: TableCell[][]; centered: boolean };
// Tanda "x" (tidak tersedia) ditampilkan tegak, bukan huruf miring seperti variabel x.
const toCell = (value: string, span = 1): TableCell => {
  const marked = /^==([\s\S]+)==$/.exec(value.trim()), text = marked ? marked[1].trim() : value.trim();
  return { text: text === 'x' ? '\\(\\text{x}\\)' : text, mark: Boolean(marked), span };
};
export function tableGrid(table: { headers: string[]; rows: string[][] }): TableGrid {
  const columns = Math.max(1, table.headers.length, ...table.rows.map((row) => row.length));
  const numbered = table.headers.length > 0 && table.headers.every((value, i) => value.trim() === String(i + 1));
  const header = table.headers.length ? table.headers.map((value, i, all) => ({ ...toCell(value, i === all.length - 1 ? columns - all.length + 1 : 1), ...(numbered ? { plain: true } : {}) })) : null;
  const rows = table.rows.map((row) => Array.from({ length: columns }, (_, i) => toCell(row[i] ?? '')));
  return { columns, header, rows, centered: [...(header ?? []), ...rows.flat()].every((cell) => cell.text.length <= 14) };
}
