import assert from 'node:assert/strict';
import { BANK } from '../lib/bank';
import { DEFAULT_SETTINGS, TOPICS } from '../lib/config';
import { distribution, fingerprint, generate, normalizeSettings } from '../lib/generate';
import { SETTINGS_VERSION, migrateStoredSettings } from '../lib/prefs';
import { rng } from '../lib/rng';
import { TIU_FAMILIES, makeTiu } from '../lib/tiu';
import { auditPackages, auditQuestion } from '../lib/validate';
import { calculate, entails, implies, not, variable } from '../lib/solver';
import type { Question, Settings, Subtest } from '../lib/types';
import { runFiguralChecks } from './figural-checks';
import { runProxyChecks } from './proxy-checks';
import { runReplaceChecks } from './replace-checks';
import { runTakeChecks } from './take-checks';

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
// Silogisme kini dibuktikan oleh model silogisme (lib/models.ts: premis dan opsi berbentuk logika, status dihitung ulang oleh solver).
const logic = baseline[0].questions.find((item) => item.proof.kind === 'model' && item.proof.model.kind === 'syllogism')!;
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
assert.throws(() => generate({ ...DEFAULT_SETTINGS, packages: 10 }), /Persediaan/); checks++;
assert.throws(() => normalizeSettings({ mode: 'INVALID' as never }), /Subtes/); checks++;
assert.throws(() => normalizeSettings({ count: -1 }), /count/); checks++;
check(BANK.every((item) => item.options.length === 5 && item.options[item.answer].score === 5), 'Setiap sumber bank harus lengkap.');
generated({ ...DEFAULT_SETTINGS, mode: 'TKP', count: 4, subtopics: ['Pelayanan Publik::Prinsip dan Standar'] });
generated({ ...DEFAULT_SETTINGS, mode: 'TIU', count: 5, subtopics: ['Figural::Matriks 3 × 3'] });
// Koreksi akademik TKP (data/tkp-ref-koreksi.json) mengganti alasan semua opsi contoh kecuali tkp-ref-23 opsi D, jadi uji sel tabel PDF memakai opsi itu;
// alasan opsi A tkp-ref-1 (dulu "Paling partisipatif, edukatif, setara, ...") kini menjadi uji bahwa koreksi terpasang.
check(BANK.find((item) => item.id === 'tkp-ref-23')?.options[3].reason ===
  'Aman, proporsional, mencegah amplifikasi, dan menggunakan kanal yang tepat.', 'Alasan TKP harus mengikuti sel tabel PDF, bukan letak baris teks.');
check(BANK.find((item) => item.id === 'tkp-ref-1')?.options[0].reason.startsWith('Edukasi bersama perwakilan komunitas menjawab hambatan warga') === true, 'Koreksi akademik TKP terpasang: alasan opsi A tkp-ref-1 berasal dari data/tkp-ref-koreksi.json.');
// Migrasi pengaturan tersimpan (lib/prefs.ts): tkpSource "new" dari versi lama diganti sekali ke "accepted"; pengaturan lain dan pilihan versi baru tetap.
const oldPrefs = { twkSource: 'new', tkpSource: 'new', seed: 'seed-saya', packages: 3, topics: ['Integritas'], mode: 'TKP' };
check(JSON.stringify(migrateStoredSettings(oldPrefs, 1)) === JSON.stringify({ ...oldPrefs, tkpSource: 'accepted' }), 'Migrasi pengaturan v1: hanya tkpSource "new" diganti "accepted", pengaturan lain tidak hilang.');
check(migrateStoredSettings(oldPrefs, SETTINGS_VERSION).tkpSource === 'new' && migrateStoredSettings({ ...oldPrefs, tkpSource: 'accepted' }, 1).tkpSource === 'accepted' && migrateStoredSettings({ seed: 'x' }, 1).tkpSource === undefined,
  'Migrasi pengaturan: pilihan manual pada versi terbaru dipertahankan, "accepted" dan nilai kosong tidak berubah.');
runFiguralChecks(check).then(async (figural) => {
  const take = await runTakeChecks(check);
  const replace = runReplaceChecks(check); // ganti nomor terpilih dan saklar kurasi (cakupan ekspor, judul, uji peserta)
  runProxyChecks(check); // gerbang password situs (SITE_PASSWORD)
  console.log(JSON.stringify({ status: 'PASS', checks, auditedQuestions: questions, bank: BANK.length, families: TIU_FAMILIES.length, figural, take, replace }, null, 2));
}).catch((error) => { console.error(error); process.exit(1); });
