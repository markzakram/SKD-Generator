import { auditQuestion } from './validate';
import { fingerprint, normalizeText } from './generate';
import type { Question, ReviewStatus, Result, Workspace } from './types';

export const STATUS_LABELS: Record<ReviewStatus, string> = { draft: 'Draf', revision: 'Perlu revisi', approved: 'Disetujui' };
export type Issue = { code: string; level: 'error' | 'warning' | 'info'; text: string };
export function questionIssues(q: Question, peers: Question[] = []): Issue[] {
  const issues: Issue[] = auditQuestion(q).map((text) => ({ code: 'structure', level: 'error', text }));
  if (!q.visual) {
    const lengths = q.options.map((o) => o.text.split(/\s+/).length), answer = lengths[q.answer];
    if (answer > Math.max(...lengths.filter((_, i) => i !== q.answer)) && answer > lengths.reduce((a, b) => a + b, 0) / 5 * 1.5)
      issues.push({ code: 'length', level: 'warning', text: 'Kunci jauh lebih panjang dari pilihan lain; periksa kemungkinan petunjuk jawaban.' });
    if (q.options.filter((o, i) => i !== q.answer && /selalu|seluruh|tidak pernah|semua|apa pun/i.test(o.text)).length >= 3)
      issues.push({ code: 'absolute', level: 'warning', text: 'Beberapa pengecoh memakai klaim mutlak; pastikan tetap masuk akal.' });
  }
  const options = (p: Question) => p.options.map((o) => normalizeText(o.text)).sort().join('|');
  if (peers.some((p) => p.id !== q.id && !p.review?.excluded && (fingerprint(q) === fingerprint(p) || (!q.visual && options(q) === options(p)))))
    issues.push({ code: 'duplicate', level: 'warning', text: 'Stimulus atau kumpulan opsi sama dengan soal lain; tinjau variasi substansinya.' });
  const tokens = (p: Question) => new Set(normalizeText(p.stem).split(' ').filter((t) => t.length > 3 && !/^[0-9]+$/.test(t)));
  const a = tokens(q);
  if (!q.visual && a.size > 12 && peers.some((p) => {
    if (p.id === q.id || p.review?.excluded || p.subtest !== q.subtest || p.topic !== q.topic) return false;
    const b = tokens(p), overlap = [...a].filter((t) => b.has(t)).length;
    return overlap / new Set([...a, ...b]).size > 0.84;
  })) issues.push({ code: 'similar', level: 'warning', text: 'Teks sangat mirip dengan soal lain; bandingkan tuntutan penalarannya.' });
  if (q.proof.kind === 'manual' || (q.proof.kind === 'logic' && !q.proof.entailment)) issues.push({ code: 'human', level: 'info', text: 'Memerlukan verifikasi substansi oleh penelaah; belum diverifikasi solver independen.' });
  if (q.proof.kind === 'bank') issues.push({ code: 'bank', level: 'info', text: 'Isi cocok dengan bank sumber; kecocokan ini belum membuktikan mutu akademik.' });
  if (q.difficulty === 'hots') issues.push({ code: 'legacy', level: 'warning', text: 'Label HOTS lama perlu ditinjau. Pilih kesulitan dan Bloom secara terpisah.' });
  return issues;
}
export function qualitySummary(questions: Question[]) {
  const included = questions.filter((q) => !q.review?.excluded);
  const issues = included.map((q) => questionIssues(q, included));
  return { total: questions.length, included: included.length, excluded: questions.length - included.length,
    approved: included.filter((q) => q.review?.status === 'approved').length,
    revision: included.filter((q) => q.review?.status === 'revision').length,
    flagged: issues.filter((list) => list.some((i) => i.level !== 'info')).length,
    errors: issues.filter((list) => list.some((i) => i.level === 'error')).length,
    verified: included.filter((q) => ['numeric', 'figure', 'scene', 'model'].includes(q.proof.kind) || q.proof.kind === 'logic' && q.proof.entailment).length,
  };
}
const now = () => new Date().toISOString();
export function initializeResult(result: Result): Result {
  return { ...result, packages: result.packages.map((p) => ({ ...p, questions: p.questions.map((q) => ({ ...q,
    review: q.review ?? { status: 'draft', excluded: false, note: '', revision: 1, updatedAt: now() },
  })) })) };
}
export function createWorkspace(result: Result): Workspace {
  const at = now();
  return { schema: 2, id: crypto.randomUUID(), name: result.settings.title, createdAt: at, updatedAt: at, version: 1, result: initializeResult(result), snapshots: [] };
}
export function reviseWorkspace(workspace: Workspace, result: Result, label: string): Workspace {
  return { ...workspace, name: result.settings.title, result, version: workspace.version + 1, updatedAt: now(),
    snapshots: [...workspace.snapshots, { version: workspace.version, at: workspace.updatedAt, label: 'Sebelum: ' + label, result: workspace.result }].slice(-20) };
}
export function setReview(q: Question, status: ReviewStatus, note: string, reviewer: string): Question {
  const errors = auditQuestion(q);
  if (status === 'approved' && errors.length) throw new Error('Perbaiki kegagalan validasi sebelum persetujuan: ' + errors[0]);
  if (status === 'approved' && q.review?.excluded) throw new Error('Kembalikan soal ke paket sebelum menyetujuinya.');
  if (status === 'approved' && !reviewer.trim()) throw new Error('Isi nama penelaah untuk mencatat persetujuan.');
  if (status === 'approved' && q.proof.kind === 'manual' && !note.trim()) throw new Error('Soal hasil suntingan memerlukan catatan pemeriksaan substansi.');
  return { ...q, review: { ...q.review!, status, note, updatedAt: now(), ...(status === 'approved' ? { reviewer: reviewer.trim(), reviewedAt: now() } : { reviewedAt: undefined, reviewer: undefined }) } };
}
export function editQuestion(original: Question, draft: Question): Question {
  const q = { ...draft, id: original.id, no: original.no, subtest: original.subtest, topic: original.topic,
    binding: undefined,
    proof: { kind: 'manual' as const, note: 'Konten disunting; model sumber tidak lagi digunakan sebagai bukti. Penelaah harus memeriksa stimulus, kunci, skor, dan pembahasan.' },
    review: { status: 'revision' as const, excluded: original.review?.excluded ?? false, revision: (original.review?.revision ?? 1) + 1, note: original.review?.note ?? '', updatedAt: now() } };
  const errors = auditQuestion(q); if (errors.length) throw new Error(errors.join('; '));
  return q;
}
export function exportPackages(result: Result, scope: 'approved' | 'draft', active?: number) {
  const selected = active === undefined ? result.packages : [result.packages[active]];
  const packages = selected.map((p) => ({ ...p, questions: p.questions.filter((q) => !q.review?.excluded && (scope === 'draft' || q.review?.status === 'approved')).map((q, i) => ({ ...q, no: i + 1 })) })).filter((p) => p.questions.length);
  if (!packages.length) throw new Error(scope === 'approved' ? 'Belum ada soal disetujui pada lingkup ini.' : 'Semua soal pada lingkup ini dikeluarkan.');
  const errors = packages.flatMap((p) => p.questions.flatMap(auditQuestion));
  if (errors.length) throw new Error('Ekspor ditahan karena validasi gagal: ' + errors[0]);
  return packages;
}
