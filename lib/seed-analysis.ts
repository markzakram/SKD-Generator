import { figureSignature, sceneSignature } from './figures';
import { questionTable } from './table';
import { explanationOf } from './explanation';
import { LOCAL_MODELS } from './local';
import { fill } from './local/schema';
import type { Option, Package, Question, Settings } from './types';

// Preserve operators, signs, decimal separators, and case. Stripping punctuation
// would incorrectly merge e.g. x+2 and x-2. IDs/seed/position are not content.
const text = (s: string) => s.replace(/\r\n?/g, '\n').replace(/[\t ]+/g, ' ').trim();
export const stable = (value: unknown): string => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const optionKey = (o: Option) => o.scene ? 'scene:' + sceneSignature(o.scene) : o.figure ? 'figure:' + figureSignature(o.figure) : text(o.text);
const stimulus = (q: Question) => stable([text(q.stem), questionTable(q), q.visual && [q.visual.kind, q.visual.columns, q.visual.scenes?.map((s) => s ? sceneSignature(s) : null), q.visual.figures.map((f) => f ? figureSignature(f) : null)]]);
const options = (q: Question, scoring = true) => q.options.map((o, i) => stable([optionKey(o), ...(scoring ? [o.score, i === q.answer] : [])])).sort();
export const contentKey = (q: Question) => stable([q.subtest, stimulus(q), options(q)]);
const unscoredKey = (q: Question) => stable([q.subtest, stimulus(q), options(q, false)]);
const presentationKey = (q: Question) => stable(q.options.map((o) => optionKey(o)));
const explanationKey = (q: Question) => stable([text(explanationOf(q)), q.tip, q.options.map((o) => stable([optionKey(o), text(o.reason)])).sort()]);
export function patternKey(q: Question): string {
  if (q.proof.kind === 'local') return q.subtest + ':model:' + q.proof.model;
  if (q.kasus) return q.subtest + ':kasus:' + q.topic + ':' + q.kasus.pola;
  if (q.proof.kind === 'bank') return q.subtest + ':bank:' + q.proof.id;
  return q.subtest + ':pola:' + q.family + (q.proof.kind === 'scene' ? ':' + q.proof.mekanisme : '');
}
export type SeedRun = { seed: string; packages: Package[] };
export type Entry = { packageId: string; q: Question };
export const entries = (packages: Package[]): Entry[] => packages.flatMap((pack) => pack.questions.map((q) => ({ packageId: pack.id, q })));
export type DifferenceKind = 'same' | 'order' | 'explanation' | 'variant' | 'different';
export const DIFFERENCE_LABELS: Record<DifferenceKind, string> = { same: 'Isi sama', order: 'Isi sama, opsi diacak', explanation: 'Pembahasan berubah', variant: 'Isi berubah, pola sama', different: 'Butir / kasus lain' };
export type Difference = { a?: Entry; b: Entry; kind: DifferenceKind; changed: string[]; moved: boolean };
export function changedFields(a: Question, b: Question): string[] {
  const changes: string[] = [];
  if (text(a.stem) !== text(b.stem)) changes.push('Teks / fakta soal');
  if (stable(questionTable(a)) !== stable(questionTable(b))) changes.push('Data tabel');
  if (stable(a.visual) !== stable(b.visual) || stable(options(a, false)) !== stable(options(b, false)) && (a.visual || b.visual)) changes.push('Gambar / aturan figural');
  if (stable(options(a, false)) !== stable(options(b, false))) changes.push('Isi pilihan');
  else if (presentationKey(a) !== presentationKey(b)) changes.push('Urutan pilihan');
  if (stable(options(a)) !== stable(options(b)) || optionKey(a.options[a.answer]) !== optionKey(b.options[b.answer])) changes.push('Kunci / poin pilihan');
  if (explanationKey(a) !== explanationKey(b)) changes.push('Pembahasan / alasan');
  if (a.difficulty !== b.difficulty) changes.push('Kesulitan');
  if (a.proof.kind === 'local' && b.proof.kind === 'local' && a.proof.model === b.proof.model) {
    if (a.proof.context !== b.proof.context) changes.push('Konteks model');
    if (a.proof.state !== b.proof.state) changes.push('Kondisi keputusan');
  }
  return changes;
}
export function compareSeeds(a: SeedRun, b: SeedRun) {
  const left = entries(a.packages), right = entries(b.packages), used = new Set<number>();
  const matches = new Map<number, number>();
  // Reserve exact content matches globally before pairing new variants. Otherwise
  // an earlier variant could steal an exact match needed by a later question.
  for (const key of [contentKey, unscoredKey]) {
    const buckets = new Map<string, number[]>();
    left.forEach((entry, i) => { if (!used.has(i)) { const k = key(entry.q); buckets.set(k, [...(buckets.get(k) ?? []), i]); } });
    right.forEach((entry, i) => {
      if (matches.has(i)) return;
      const candidates = buckets.get(key(entry.q));
      if (!candidates?.length) return;
      const index = candidates.shift()!; matches.set(i, index); used.add(index);
    });
  }
  for (const sameGroup of [
    (x: Question, y: Question) => patternKey(x) === patternKey(y),
    (x: Question, y: Question) => x.subtest === y.subtest && (x.mappingId && x.mappingId === y.mappingId || x.topic === y.topic && x.subtopic === y.subtopic),
  ]) right.forEach((entry, i) => {
    if (matches.has(i)) return;
    const candidates = left.map((other, j) => ({ other, j })).filter(({ other, j }) => !used.has(j) && sameGroup(other.q, entry.q));
    const match = candidates.find(({ other }) => other.packageId === entry.packageId && other.q.difficulty === entry.q.difficulty) ?? candidates[0];
    if (match) { matches.set(i, match.j); used.add(match.j); }
  });
  const rows: Difference[] = right.map((entry, i) => {
    const match = matches.get(i), before = match === undefined ? undefined : left[match];
    if (!before) return { b: entry, kind: 'different', changed: ['Butir baru dalam perbandingan'], moved: false };
    const same = contentKey(before.q) === contentKey(entry.q), reordered = presentationKey(before.q) !== presentationKey(entry.q);
    // Different answer letters caused by shuffling do not count as a new item.
    const kind: DifferenceKind = same ? reordered ? 'order' : explanationKey(before.q) !== explanationKey(entry.q) ? 'explanation' : 'same' : patternKey(before.q) === patternKey(entry.q) ? 'variant' : 'different';
    return { a: before, b: entry, kind, changed: changedFields(before.q, entry.q), moved: same && (before.packageId !== entry.packageId || before.q.no !== entry.q.no) };
  });
  const counts = Object.fromEntries(Object.keys(DIFFERENCE_LABELS).map((kind) => [kind, rows.filter((row) => row.kind === kind).length])) as Record<DifferenceKind, number>;
  const shared = counts.same + counts.order + counts.explanation;
  return { a: a.seed, b: b.seed, rows, counts, shared, total: right.length, onlyA: left.filter((_, i) => !used.has(i)), overlap: right.length ? Math.round(shared / right.length * 100) : 0 };
}
export function scanSummary(runs: SeedRun[]) {
  const seen = new Set<string>(), patterns = new Set<string>();
  const rows = runs.map((run) => {
    const list = entries(run.packages), keys = new Set(list.map(({ q }) => contentKey(q)));
    const added = [...keys].filter((key) => !seen.has(key)).length;
    keys.forEach((key) => seen.add(key)); list.forEach(({ q }) => patterns.add(patternKey(q)));
    return { seed: run.seed, total: list.length, unique: keys.size, added, cumulative: seen.size, overlap: compareSeeds(runs[0], run).overlap };
  });
  return { rows, unique: seen.size, groups: patterns.size, total: rows.reduce((sum, row) => sum + row.total, 0) };
}
export function sequenceSeeds(seed: string, count: number): string[] {
  const clean = seed.trim();
  if (!clean || clean.length > 100) throw new Error('Seed harus berisi 1–100 karakter.');
  if (!Number.isInteger(count) || count < 2 || count > 20) throw new Error('Uji 2–20 seed sekaligus.');
  return Array.from({ length: count }, (_, i) => i === 0 ? clean : /^\d+$/.test(clean) && clean.length < 15 ? String(Number(clean) + i) : clean.slice(0, 90) + '-uji-' + (i + 1));
}
export const randomSeed = () => 'SKD-' + crypto.getRandomValues(new Uint32Array(2)).join('-');
export function checkScanBudget(settings: Settings, seeds: number) {
  if (settings.count * settings.packages * seeds > 6000) throw new Error('Maksimal 6.000 soal per proses perbandingan. Kurangi jumlah seed, paket, atau soal pada pengaturan generator.');
}
export function questionVariables(q: Question): Record<string, string> {
  if (q.proof.kind === 'local') {
    const proof = q.proof, model = LOCAL_MODELS.find((m) => m.id === proof.model);
    const context = model?.contexts[proof.context], state = model?.states[proof.state];
    return { 'Model': model?.concept ?? proof.model, 'Konteks': context?.intro ?? String(proof.context + 1), 'Fakta penentu': context && state ? fill(state.fact, context) : String(proof.state + 1),
      ...(context ? Object.fromEntries(Object.entries(context).filter(([key]) => key !== 'intro').map(([key, value]) => ['Variabel ' + key, value])) : {}),
      'Kondisi': (proof.state + 1) + ' dari ' + (model?.states.length ?? '?') };
  }
  if (q.kasus) return { 'Pola keputusan': q.kasus.pola, 'Peran': q.kasus.peran, 'Kewenangan': q.kasus.kewenangan, 'Fakta penentu': q.kasus.penentu, 'Tempat': q.kasus.tempat, 'Keputusan': q.kasus.keputusan };
  if (q.proof.kind === 'bank') return { 'Sumber butir': q.proof.id, 'Chapter': q.subtopic, 'Cara variasi': 'Memilih butir bank lain; isi butir yang terpilih tetap.' };
  if (q.proof.kind === 'scene') return { 'Keluarga pola': q.family, 'Mekanisme': q.proof.mekanisme, 'Aturan': q.visual?.rule?.aturan.join('; ') ?? '', 'Bentuk': [...new Set(q.visual?.scenes?.flatMap((s) => s?.parts.map((part) => part.g) ?? []) ?? [])].join(', ') };
  if (q.proof.kind === 'numeric') return { 'Keluarga pola': q.family, 'Angka masukan': q.proof.values.join(', '), 'Persamaan': q.proof.expression ?? '', 'Hasil': String(q.proof.answer) };
  if (q.proof.kind === 'model') return { 'Keluarga pola': q.family, 'Model penalaran': q.proof.model.kind, 'Parameter': stable(q.proof.model) };
  return { 'Keluarga / sumber': q.family, 'Jenis pembuktian': q.proof.kind, 'Chapter': q.subtopic };
}
