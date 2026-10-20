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
