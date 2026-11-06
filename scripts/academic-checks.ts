import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import assets from '../data/tiu-guide-images.json';
import { DEFAULT_SETTINGS } from '../lib/config';
import { generate } from '../lib/generate';
import { createWorkspace } from '../lib/quality';
import { constrainNarrativePackage } from '../lib/silo-production';
import { buildLogika } from '../lib/tiu-logika';
import { TIU_FAMILIES, makeTiu } from '../lib/tiu';
import { rng } from '../lib/rng';
import { auditQuestion } from '../lib/validate';
import { validationBinding } from '../lib/binding';
import { stripMarks } from '../lib/richtext';
import type { Difficulty, Question } from '../lib/types';
import { checkSilogismeBlueprint, toQuestion } from './silogisme-checks';

const questionOf = (built: ReturnType<typeof buildLogika>, id: string): Question => {
  const q = toQuestion(built, id);
  return { ...q, options: q.options.map((o, i) => ({ ...o, score: i === q.answer ? 5 : 0 })) };
};

const metadata = (q: Question) => q.proof.kind === 'model' && q.proof.model.kind === 'syllogism' ? q.proof.model : undefined;
const valid = (q: Question) => {
  const failures: string[] = [];
  checkSilogismeBlueprint(q, (text) => failures.push(text));
  assert.deepEqual(failures, [], q.id);
  assert.deepEqual(auditQuestion(q), [], q.id);
};
function checkLimits(questions: Question[]) {
  for (const chapter of ['2 Premis - Narasi', '3 Premis - Narasi']) {
    const items = questions.map(metadata).filter((m) => m?.chapter === chapter).map((m) => m!.narrative!);
    assert.ok(items.filter((m) => m.reversed).length <= Math.floor(items.length / 5), chapter + ': batas soal');
    assert.ok(items.reduce((n, m) => n + m.reversed, 0) <= Math.floor(items.reduce((n, m) => n + m.implications, 0) / 5), chapter + ': batas premis');
  }
}
const reversed: Question[] = [];
for (const id of ['n2', 'n3']) {
  for (let seed = 0; seed < 2000 && reversed.filter((q) => q.id.startsWith(id)).length < 12; seed++) {
    const built = buildLogika(id, rng('academic-reverse-' + seed));
    if (built.reversed) reversed.push(questionOf(built, id + '-' + seed));
  }
  assert.equal(reversed.filter((q) => q.id.startsWith(id)).length, 12);
}
// Batas 0 untuk paket kecil, pembulatan ke bawah, dua chapter terpisah,
// dan soal yang memuat lebih dari satu premis terbalik.
let packageChecks = 0;
for (const n of [1, 4, 5, 9, 10, 12]) {
  const original = ['n2', 'n3'].flatMap((id) => reversed.filter((q) => q.id.startsWith(id)).slice(0, n));
  const before = JSON.stringify(original), bounded = constrainNarrativePackage(original);
  checkLimits(bounded);
  assert.equal(JSON.stringify(original), before, 'Tidak menyunting paket asal');
  assert.deepEqual(constrainNarrativePackage(bounded), bounded, 'Idempoten');
  bounded.forEach((q, i) => {
    valid(q); assert.equal(q.answer, original[i].answer); assert.deepEqual(q.options, original[i].options);
    assert.deepEqual(metadata(q)?.premises, metadata(original[i])?.premises);
    if (q !== original[i]) { assert.equal(q.binding, validationBinding(q)); assert.notEqual(q.stem, original[i].stem); assert.notEqual(q.explanation, original[i].explanation); }
  });
  packageChecks++;
}
for (let seed = 0; seed < 30; seed++) {
  for (const profile of ['free', 'tryout-2027'] as const) {
    const settings = { ...DEFAULT_SETTINGS, mode: 'TIU' as const, count: profile === 'free' ? 24 : 35, seed: 'academic-package-' + seed, profile,
      tiuSource: 'variation' as const, ...(profile === 'free' ? { topics: ['Verbal'], subtopics: ['Verbal::Silogisme naratif'] } : {}) };
    const questions = generate(settings)[0].questions;
    checkLimits(questions); questions.filter((q) => metadata(q)?.narrative).forEach(valid); packageChecks++;
  }
}
for (const asset of Object.values(assets)) {
  const bytes = Buffer.from(asset.url.split(',')[1], 'base64');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
}

// Paket kecil untuk memeriksa semua jalur penyajian pada browser sungguhan.
const examples: Question[] = ['b2', 'b3', 'n2', 'n3'].map((id) => {
  const built = buildLogika(id, rng('academic-example-' + id));
  return { ...questionOf(built, id), subtopic: built.chapter };
});
function sample(familyId: string, level: Difficulty, matches: (q: Question) => boolean) {
  const family = TIU_FAMILIES.find((f) => f.id === familyId)!;
  for (let i = 0; i < 500; i++) {
    const q: Question = { ...makeTiu(family, level, rng('academic-example-' + familyId + '-' + i)), id: familyId + '-' + i, no: 0 };
    if (matches(q)) return q;
  }
  throw new Error('Contoh tidak ditemukan: ' + familyId);
}
examples.push(sample('cerita-hitung', 'sulit', (q) => q.explanation.includes('RUMUS WOWO') && stripMarks(q.explanation).includes('TiFuS')));
examples.push(sample('cerita-hitung', 'sedang', (q) => q.explanation.includes('@acuan segitiga-vdw')));
examples.push(sample('cerita-hitung', 'sedang', (q) => q.explanation.includes('@acuan segitiga-jkw')));
examples.push(sample('pecahan', 'sedang', (q) => q.explanation.includes('@acuan pecahan-istimewa')));
examples.push(sample('deret', 'sulit', (q) => q.explanation.includes('@deret')));
examples.push(sample('fig-serial', 'sedang', (q) => q.explanation.includes('@gambar')));
for (const mode of ['TWK', 'TKP'] as const) examples.push(generate({ ...DEFAULT_SETTINGS, mode, count: 1, seed: 'academic-example-' + mode })[0].questions[0]);
const questions = constrainNarrativePackage(examples).map((q, i) => ({ ...q, id: 'academic-' + (i + 1), no: i + 1, binding: undefined }));
const settings = { ...DEFAULT_SETTINGS, title: 'Pemeriksaan panduan akademik TIU', seed: 'ACADEMIC-2026', count: questions.length };
const packages = [{ id: 'SKD-AKADEMIK', mode: 'SKD' as const, seed: settings.seed, duration: 100, questions }];
fs.mkdirSync('test-results', { recursive: true });
fs.writeFileSync('test-results/academic-fixture.json', JSON.stringify(createWorkspace({ settings, packages, elapsed: 0,
  audit: { ok: true, checked: questions.length, errors: [], duplicateCount: 0, keyDistribution: [0, 0, 0, 0, 0] } })));
console.log(JSON.stringify({ status: 'PASS', packageChecks, reversedSamples: reversed.length, originalImages: Object.keys(assets), examples: questions.length }, null, 2));
