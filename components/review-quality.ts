import { useMemo, useRef } from 'react';
import { questionIssues, type Issue } from '@/lib/quality';
import type { Question } from '@/lib/types';

// Isu mutu hanya bergantung pada isi soal dan status "dikeluarkan" soal lain. Persetujuan, catatan, dan nomor revisi tidak mengubahnya,
// jadi daftar lama dipakai ulang selama keduanya sama. questionIssues untuk satu paket ±0,4 dtk; tanpa ini tiap persetujuan menunggu selama itu.
const sameQuality = (a: Question, b: Question) => {
  if (a === b) return true;
  if (!!a.review?.excluded !== !!b.review?.excluded) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as (keyof Question)[]);
  for (const key of keys) if (key !== 'review' && !Object.is(a[key], b[key])) return false;
  return true;
};

export function useIssueLists(questions: Question[]): Issue[][] {
  const last = useRef<{ questions: Question[]; lists: Issue[][] } | null>(null);
  return useMemo(() => {
    const prev = last.current;
    const lists = prev && prev.questions.length === questions.length && questions.every((q, i) => sameQuality(prev.questions[i], q)) ? prev.lists : questions.map((q) => questionIssues(q, questions));
    last.current = { questions, lists };
    return lists;
  }, [questions]);
}

export type Mark = { tone: 'error' | 'warning' | 'ok'; text: string; title: string };
const MARK_TEXT: Record<string, string> = { structure: 'Gagal validasi', length: 'Panjang kunci', absolute: 'Klaim mutlak', duplicate: 'Duplikat', similar: 'Mirip soal lain', 'source-note': 'Catatan sumber', legacy: 'Label HOTS lama' };
const hasSolver = (q: Question) => ['numeric', 'figure', 'scene', 'model'].includes(q.proof.kind) || (q.proof.kind === 'logic' && !!q.proof.entailment);

// Tanda mutu satu baris untuk antrean: isu terberat dulu, lalu "Solver lolos". Catatan tingkat info tidak ditandai.
export function markOf(q: Question, issues: Issue[]): Mark | null {
  const serious = issues.filter((i) => i.level !== 'info'), first = serious.find((i) => i.level === 'error') ?? serious[0];
  if (first) {
    const text = (MARK_TEXT[first.code] ?? 'Perlu diperiksa') + (serious.length > 1 ? ' +' + (serious.length - 1) : '');
    return { tone: first.level === 'error' ? 'error' : 'warning', text, title: serious.map((i) => i.text).join('\n') };
  }
  return hasSolver(q) ? { tone: 'ok', text: 'Solver lolos', title: 'Jawaban dibuktikan solver independen. Ketepatan substansi tetap perlu ditelaah.' } : null;
}
