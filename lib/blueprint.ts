import { BANK, bankFor } from './bank';
import { TOPICS } from './config';
import { distribution } from './generate';
import { TIU_FAMILIES } from './tiu';
import type { BlueprintRow, Difficulty, Settings, Subtest } from './types';

export const LEVELS: Difficulty[] = ['mudah', 'sedang', 'sulit'];
export function rowCapacity(settings: Settings, row: BlueprintRow): number {
  if (row.subtest === 'TIU') {
    const families = TIU_FAMILIES.filter((f) => f.topic === row.topic && f.levels.includes(row.difficulty) && (!settings.subtopics.length || settings.subtopics.includes(f.topic + '::' + f.name)));
    return !families.length ? 0 : families.every((f) => f.id === 'analogi') ? 10 : 10000;
  }
  return bankFor(row.subtest, [row.topic], row.difficulty, settings.subtopics).length;
}
export function checkBlueprint(rows: BlueprintRow[], settings: Settings): string[] {
  const errors: string[] = [], keys = new Set<string>();
  const counts = distribution(settings.mode, settings.count);
  for (const row of rows) {
    if (!['TWK', 'TIU', 'TKP'].includes(row.subtest) || !TOPICS[row.subtest]?.includes(row.topic) || !LEVELS.includes(row.difficulty) ||
      !Number.isInteger(row.count) || row.count < 0 || row.count > 200) { errors.push('Baris blueprint tidak valid.'); continue; }
    const key = [row.subtest, row.topic, row.difficulty].join('|');
    if (keys.has(key)) errors.push('Kuota berulang: ' + key); keys.add(key);
    if (settings.topics.length && !settings.topics.includes(row.topic)) errors.push('Kuota di luar materi pilihan: ' + row.topic);
    if (settings.difficulty !== 'campuran' && row.difficulty !== settings.difficulty && row.count) errors.push('Kuota di luar kesulitan pilihan.');
    const needed = row.count * (settings.uniqueAcross ? settings.packages : 1), available = rowCapacity(settings, row);
    if (needed > available) errors.push(row.topic + ' / ' + row.difficulty + ': tersedia ' + available + ', diperlukan ' + needed + '.');
    if (row.subtest === 'TIU' && row.count && !available) errors.push('Pola TIU tidak tersedia untuk ' + row.topic + ' / ' + row.difficulty + '.');
  }
  for (const subtest of ['TWK', 'TIU', 'TKP'] as const) if (rows.filter((r) => r.subtest === subtest).reduce((sum, r) => sum + r.count, 0) !== counts[subtest]) errors.push('Jumlah kuota ' + subtest + ' harus ' + counts[subtest] + '.');
  return errors;
}
export function buildBlueprint(settings: Settings): BlueprintRow[] {
  if (settings.blueprint) {
    const errors = checkBlueprint(settings.blueprint, settings);
    if (errors.length) throw new Error(errors.join(' '));
    return settings.blueprint.filter((row) => row.count).map((row) => ({ ...row }));
  }
  const rows: BlueprintRow[] = [], counts = distribution(settings.mode, settings.count);
  const weight = settings.composition ?? { mudah: 25, sedang: 50, sulit: 25 };
  for (const subtest of ['TWK', 'TIU', 'TKP'] as Subtest[]) {
    const count = counts[subtest]; if (!count) continue;
    const candidates = TOPICS[subtest].filter((t) => !settings.topics.length || settings.topics.includes(t)).flatMap((topic) =>
      LEVELS.filter((difficulty) => settings.difficulty === 'campuran' || difficulty === settings.difficulty).map((difficulty) => ({ subtest, topic, difficulty, count: 0 })));
    const factor = settings.uniqueAcross ? settings.packages : 1;
    const cap = (row: BlueprintRow) => Math.floor(rowCapacity(settings, row) / factor);
    const plan = settings.composition && settings.difficulty === 'campuran' ? LEVELS.map((difficulty) => ({ difficulty, count: Math.floor(count * weight[difficulty as keyof typeof weight] / 100), fraction: count * weight[difficulty as keyof typeof weight] / 100 % 1 })) : [];
    if (plan.length) {
      plan.sort((a, b) => b.fraction - a.fraction);
      for (let remainder = count - plan.reduce((sum, r) => sum + r.count, 0), i = 0; i < remainder; i++) plan[i % plan.length].count++;
    }
    for (let i = 0; i < count; i++) {
      const level = plan.length ? plan.find((p) => p.count > candidates.filter((r) => r.difficulty === p.difficulty).reduce((sum, r) => sum + r.count, 0))?.difficulty : undefined;
      const eligible = candidates.filter((r) => r.count < cap(r) && (!level || r.difficulty === level));
      if (!eligible.length) throw new Error('Persediaan ' + subtest + (level ? ' / ' + level : '') + ' tidak cukup untuk kuota. Kurangi soal/paket atau perluas filter.');
      eligible.sort((a, b) => {
        const topicCount = (topic: string) => candidates.filter((r) => r.topic === topic).reduce((sum, r) => sum + r.count, 0);
        return topicCount(a.topic) - topicCount(b.topic) || a.count / Math.max(1, weight[a.difficulty as keyof typeof weight]) - b.count / Math.max(1, weight[b.difficulty as keyof typeof weight]);
      });
      eligible[0].count++;
    }
    rows.push(...candidates.filter((r) => r.count));
  }
  return rows;
}
export function actualBlueprint(questions: { subtest: Subtest; topic: string; difficulty: Difficulty }[]): BlueprintRow[] {
  const rows: BlueprintRow[] = [];
  questions.forEach((q) => { const row = rows.find((r) => r.subtest === q.subtest && r.topic === q.topic && r.difficulty === q.difficulty); if (row) row.count++; else rows.push({ subtest: q.subtest, topic: q.topic, difficulty: q.difficulty, count: 1 }); });
  return rows;
}
export const inventoryCount = BANK.length;
