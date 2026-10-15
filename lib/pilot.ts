import { figureSignature, sceneSignature } from './figures';
import type { Package, PilotAnswer, PilotSession, Question, Workspace } from './types';

// Content identity is for version matching, not cryptographic authentication.
export function contentHash(q: Question): string {
  const value = JSON.stringify([q.stem, q.table, q.visual, q.options.map((o) => [o.text, o.score, o.figure && figureSignature(o.figure), o.scene && sceneSignature(o.scene)]), q.answer]);
  let a = 2166136261, b = 5381;
  for (let i = 0; i < value.length; i++) { a = Math.imul(a ^ value.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ value.charCodeAt(i); }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
export function blankAnswers(pack: Package): PilotAnswer[] {
  return pack.questions.map((q) => ({ questionId: q.id, revision: q.review?.revision ?? 1, hash: contentHash(q), choice: null, seconds: 0 }));
}
export function matchedAnswer(q: Question, answer: PilotAnswer) {
  return answer.questionId === q.id && answer.revision === (q.review?.revision ?? 1) && answer.hash === contentHash(q);
}
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export function correlation(xs: number[], ys: number[]): number | null {
  if (xs.length < 30 || xs.length !== ys.length) return null;
  const x = mean(xs)!, y = mean(ys)!;
  const covariance = xs.reduce((sum, v, i) => sum + (v - x) * (ys[i] - y), 0);
  const denom = Math.sqrt(xs.reduce((sum, v) => sum + (v - x) ** 2, 0) * ys.reduce((sum, v) => sum + (v - y) ** 2, 0));
  return denom ? covariance / denom : null;
}
export function analyzePilots(workspace: Workspace, pack: Package, sessions: PilotSession[]) {
  const included = pack.questions.filter((q) => !q.review?.excluded), relevant = sessions.filter((s) => s.workspaceId === workspace.id && s.packageId === pack.id);
  return included.map((q) => {
    const entries = relevant.flatMap((session) => { const answer = session.answers.find((a) => matchedAnswer(q, a)); return answer ? [{ session, answer }] : []; });
    const frequencies = [0, 0, 0, 0, 0], xs: number[] = [], ys: number[] = [];
    for (const { session, answer } of entries) {
      if (answer.choice !== null) frequencies[answer.choice]++;
      const remaining = included.filter((other) => other.id !== q.id).map((other) => ({ q: other, a: session.answers.find((a) => matchedAnswer(other, a)) }));
      if (remaining.length && remaining.every(({ a }) => a)) {
        xs.push(answer.choice === null ? 0 : q.options[answer.choice].score);
        ys.push(remaining.reduce((sum, { q: other, a }) => sum + (a!.choice === null ? 0 : other.options[a!.choice].score), 0));
      }
    }
    const count = entries.length, answered = frequencies.reduce((a, b) => a + b, 0);
    const p = count ? frequencies[q.answer] / count : null;
    return { question: q, count, answered, blank: count - answered, frequencies,
      // Unanswered items receive zero in both exam systems.
      p: q.subtest === 'TKP' ? null : p,
      meanScore: mean(entries.map(({ answer }) => answer.choice === null ? 0 : q.options[answer.choice].score)),
      bestRate: p, meanSeconds: mean(entries.map(({ answer }) => answer.seconds)), discrimination: correlation(xs, ys),
      unusedDistractors: answered >= 30 ? frequencies.map((n, i) => i !== q.answer && n / answered < 0.05 ? String.fromCharCode(65 + i) : '').filter(Boolean) : [],
      empirical: q.subtest !== 'TKP' && count >= 30 && p !== null ? p >= 0.8 ? 'Mudah' : p >= 0.4 ? 'Sedang' : 'Sulit' : null,
    };
  });
}
export function validatePilot(input: unknown, workspace: Workspace): PilotSession {
  if (!input || typeof input !== 'object') throw new Error('Data hasil uji tidak valid.');
  const s = input as PilotSession;
  if (typeof s.id !== 'string' || s.id.length > 100 || s.workspaceId !== workspace.id || !Number.isInteger(s.version) || typeof s.participant !== 'string' || s.participant.length > 100 ||
      !Number.isFinite(Date.parse(s.finishedAt)) || !Array.isArray(s.answers) || !s.answers.length || s.answers.length > 200) throw new Error('Identitas atau isi hasil uji tidak sesuai paket ini.');
  const pack = workspace.result.packages.find((p) => p.id === s.packageId); if (!pack) throw new Error('Paket hasil uji tidak ditemukan.');
  const ids = new Set<string>();
  s.answers.forEach((a) => {
    if (!a || typeof a.questionId !== 'string' || ids.has(a.questionId) || !pack.questions.some((q) => q.id === a.questionId) || !Number.isInteger(a.revision) || a.revision < 1 || !/^[a-f0-9]{16}$/.test(a.hash) ||
      (a.choice !== null && (!Number.isInteger(a.choice) || a.choice < 0 || a.choice > 4)) || !Number.isFinite(a.seconds) || a.seconds < 0 || a.seconds > 86400) throw new Error('Jawaban, revisi, atau durasi hasil uji tidak valid.');
    ids.add(a.questionId);
  });
  return s;
}
