import assert from 'node:assert/strict';
import { BANK } from '../lib/bank';
import { DEFAULT_SETTINGS, TOPICS } from '../lib/config';
import { distribution, fingerprint, generate, normalizeSettings } from '../lib/generate';
import { rng } from '../lib/rng';
import { TIU_FAMILIES, makeTiu } from '../lib/tiu';
import { auditPackages, auditQuestion } from '../lib/validate';
import { calculate, entails, implies, not, variable } from '../lib/solver';
import type { Question, Settings, Subtest } from '../lib/types';
import { runFiguralChecks } from './figural-checks';

let checks = 0, questions = 0;
const check = (condition: unknown, message: string) => { assert.ok(condition, message); checks++; };
const generated = (settings: Partial<Settings>) => {
  const normalized = normalizeSettings(settings);
  const packs = generate(normalized);
  const audit = auditPackages(packs, normalized);
  check(audit.ok, audit.errors.join('\n')); questions += audit.checked;
  return packs;
};

assert.equal(calculate('2+3*4'), 14); assert.equal(calculate('(2+3)*4/2-1'), 9);
const p = variable('p'), q = variable('q');
assert.deepEqual(entails([implies(p, q), p], [q, not(q)]), [true, false]);
const baseline = generated(DEFAULT_SETTINGS);
assert.deepEqual(distribution('SKD', 110), { TWK: 30, TIU: 35, TKP: 45 });
assert.deepEqual(baseline, generate(DEFAULT_SETTINGS)); checks++;
for (const count of [3, 10, 25, 60, 111, 200]) check(Object.values(distribution('SKD', count)).reduce((a, b) => a + b, 0) === count, 'Komposisi harus berjumlah sesuai permintaan.');

for (let seed = 0; seed < 12; seed++) {
  for (const mode of ['SKD', 'TWK', 'TIU', 'TKP'] as const) generated({
    ...DEFAULT_SETTINGS, mode, seed: 'audit-' + seed, count: mode === 'SKD' ? 110 : mode === 'TKP' ? 45 : mode === 'TWK' ? 30 : 35,
  });
}
for (const subtest of ['TWK', 'TIU', 'TKP'] as Subtest[]) {
  for (const topic of TOPICS[subtest]) {
    generated({ ...DEFAULT_SETTINGS, mode: subtest, count: subtest === 'TIU' ? 8 : 5, topics: [topic] });
  }
}
for (const level of ['mudah', 'sedang', 'sulit', 'hots'] as const) {
  generated({ ...DEFAULT_SETTINGS, mode: 'TWK', count: 8, difficulty: level });
  generated({ ...DEFAULT_SETTINGS, mode: 'TIU', count: 15, difficulty: level });
}
for (const level of ['sedang', 'sulit', 'hots'] as const) generated({ ...DEFAULT_SETTINGS, mode: 'TKP', count: level === 'sedang' ? 5 : 12, difficulty: level });
generated({ ...DEFAULT_SETTINGS, packages: 2, uniqueAcross: true });
generated({ ...DEFAULT_SETTINGS, packages: 5, uniqueAcross: false });

for (const family of TIU_FAMILIES) for (const level of family.levels) for (let seed = 0; seed < 30; seed++) {
  const draft = makeTiu(family, level, rng('family-' + seed));
  const question: Question = { ...draft, no: 1, id: 'audit' };
  const errors = auditQuestion(question);
  check(!errors.length, family.id + '/' + level + '/' + seed + ': ' + errors.join('; ')); questions++;
}
const numeric = baseline[0].questions.find((item) => item.proof.kind === 'numeric')!;
const badNumber = structuredClone(numeric);
badNumber.options[badNumber.answer].text = '999999';
check(auditQuestion(badNumber).length > 0, 'Validator harus menolak perubahan angka jawaban.');
const logic = baseline[0].questions.find((item) => item.proof.kind === 'logic' && item.proof.entailment)!;
const badLogic = structuredClone(logic); badLogic.answer = (badLogic.answer + 1) % 5;
check(auditQuestion(badLogic).length > 0, 'Validator harus menolak kunci logika yang diubah.');
const visual = baseline[0].questions.find((item) => item.visual?.kind === 'matriks') ??
  { ...makeTiu(TIU_FAMILIES.find((item) => item.id === 'fig-matrix')!, 'hots', rng('matrix')), no: 1, id: 'matrix' };
const badFigure = structuredClone(visual), keyScene = badFigure.options[badFigure.answer].scene!;
keyScene.parts[0].f = ((keyScene.parts[0].f + 1) % 3) as never;
check(auditQuestion(badFigure).length > 0, 'Validator harus menghitung ulang jawaban gambar dari stimulus.');
const bank = baseline[0].questions.find((item) => item.subtest === 'TKP')!;
const badScore = structuredClone(bank); badScore.options[badScore.answer].score = 4;
check(auditQuestion(badScore).length > 0, 'Validator harus menolak skor TKP yang bergeser.');
const reordered = structuredClone(numeric);
[reordered.options[0], reordered.options[1]] = [reordered.options[1], reordered.options[0]];
check(fingerprint(reordered) === fingerprint(numeric), 'Pengacakan opsi tidak boleh dianggap soal baru.');
assert.throws(() => generate({ ...DEFAULT_SETTINGS, packages: 5 }), /Persediaan/); checks++;
assert.throws(() => normalizeSettings({ mode: 'INVALID' as never }), /Subtes/); checks++;
assert.throws(() => normalizeSettings({ count: -1 }), /count/); checks++;
check(BANK.every((item) => item.options.length === 5 && item.options[item.answer].score === 5), 'Setiap sumber bank harus lengkap.');
generated({ ...DEFAULT_SETTINGS, mode: 'TKP', count: 4, subtopics: ['Pelayanan Publik::Prinsip dan Standar'] });
generated({ ...DEFAULT_SETTINGS, mode: 'TIU', count: 5, subtopics: ['Figural::Matriks 3 × 3'] });
check(BANK.find((item) => item.id === 'tkp-ref-1')?.options[0].reason ===
  'Paling partisipatif, edukatif, setara, dan berorientasi pada tindak lanjut.', 'Alasan TKP harus mengikuti sel tabel PDF, bukan letak baris teks.');
runFiguralChecks(check).then((figural) => {
  console.log(JSON.stringify({ status: 'PASS', checks, auditedQuestions: questions, bank: BANK.length, families: TIU_FAMILIES.length, figural }, null, 2));
}).catch((error) => { console.error(error); process.exit(1); });
