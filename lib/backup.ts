import { normalizeSettings } from './generate';
import { initializeResult } from './quality';
import { auditQuestion } from './validate';
import { BANK_MAP } from './bank';
import type { Result, Workspace } from './types';

function validResult(value: unknown): Result {
  if (!value || typeof value !== 'object') throw new Error('Data paket tidak valid.');
  const r = value as Result;
  if (!Array.isArray(r.packages) || !r.packages.length || r.packages.length > 50) throw new Error('Jumlah paket cadangan tidak valid.');
  const settings = normalizeSettings({ ...r.settings, blueprint: undefined });
  if (r.settings.blueprint) {
    if (!Array.isArray(r.settings.blueprint) || r.settings.blueprint.length > 100 || r.settings.blueprint.some((row) => !row || !['TWK', 'TIU', 'TKP'].includes(row.subtest) || typeof row.topic !== 'string' || !['mudah', 'sedang', 'sulit'].includes(row.difficulty) || !Number.isInteger(row.count) || row.count < 0 || row.count > 200)) throw new Error('Blueprint cadangan tidak valid.');
    settings.blueprint = r.settings.blueprint;
  }
  if (r.packages.reduce((sum, p) => sum + (Array.isArray(p.questions) ? p.questions.length : 99999), 0) > 4000) throw new Error('Cadangan melampaui 4.000 soal.');
  r.packages.forEach((pack) => {
    if (typeof pack.id !== 'string' || typeof pack.seed !== 'string' || !Array.isArray(pack.questions) || !pack.questions.length || pack.questions.length > 200 || !Number.isInteger(pack.duration) || pack.duration < 1 || pack.duration > 300) throw new Error('Struktur paket cadangan tidak valid.');
    const ids = new Set<string>();
    pack.questions.forEach((q, i) => {
      if (!q || typeof q.id !== 'string' || ids.has(q.id) || !['TWK', 'TIU', 'TKP'].includes(q.subtest) || typeof q.topic !== 'string' || typeof q.subtopic !== 'string' || typeof q.stem !== 'string' || q.stem.length > 15000 || typeof q.explanation !== 'string' || typeof q.source !== 'string' || !Array.isArray(q.options) || q.options.some((o) => !o || typeof o.text !== 'string' || typeof o.reason !== 'string') || !q.proof) throw new Error('Struktur soal cadangan tidak valid.');
      ids.add(q.id); q.no = i + 1;
      if (q.proof.kind === 'bank' && !BANK_MAP.has(q.proof.id)) { q.proof = { kind: 'manual', note: 'Bank versi lama; perlu verifikasi ulang substansi oleh penelaah.' }; q.binding = undefined; if (q.review) q.review.status = 'revision'; }
      if (q.proof.kind === 'model') {
        const m = q.proof.model;
        if (!m || (m.kind === 'data' && (!Number.isInteger(m.domain) || m.domain < 1 || m.domain > 30)) || (m.kind === 'route' && m.nodes.length > 12)) throw new Error('Model cadangan melampaui batas solver.');
      }
      if (!['mudah', 'sedang', 'sulit', 'hots'].includes(q.difficulty)) throw new Error('Kesulitan soal tidak valid.');
      const errors = auditQuestion(q); if (errors.length) throw new Error('Cadangan gagal pemeriksaan: ' + errors[0]);
      if (q.review && (!['draft', 'revision', 'approved'].includes(q.review.status) || typeof q.review.excluded !== 'boolean' || typeof q.review.note !== 'string' || !Number.isInteger(q.review.revision) || q.review.revision < 1)) throw new Error('Status kurasi cadangan tidak valid.');
      if (q.review?.status === 'approved' && (!q.review.reviewer?.trim() || !q.review.reviewedAt)) q.review.status = 'draft';
    });
  });
  return initializeResult({ ...r, settings, elapsed: r.elapsed ?? 0, audit: { ok: true, checked: r.packages.flatMap((p) => p.questions).length, errors: [], duplicateCount: 0, keyDistribution: [0, 0, 0, 0, 0] } });
}
export function readBackup(text: string): Workspace {
  if (text.length > 30 * 1024 * 1024) throw new Error('Cadangan maksimal 30 MB.');
  const value = JSON.parse(text);
  if (value.schema === 2) {
    if (typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' || !Number.isInteger(value.version) || value.version < 1 || !Number.isFinite(Date.parse(value.createdAt)) || !Number.isFinite(Date.parse(value.updatedAt))) throw new Error('Identitas cadangan tidak valid.');
    const result = validResult(value.result);
    const snapshots = (Array.isArray(value.snapshots) ? value.snapshots : []).slice(-20).map((s: Workspace['snapshots'][number]) => ({ ...s, result: validResult(s.result) }));
    return { ...value, result, snapshots };
  }
  const result = validResult({ ...value, audit: value.audit });
  const at = new Date().toISOString();
  return { schema: 2, id: crypto.randomUUID(), name: result.settings.title, version: 1, createdAt: at, updatedAt: at, result, snapshots: [] };
}
