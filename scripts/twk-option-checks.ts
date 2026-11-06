import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { BANK } from '../lib/bank';
import { DEFAULT_SETTINGS } from '../lib/config';
import { generate } from '../lib/generate';
import { LOCAL_MODELS, LOCAL_RECIPES, makeLocal, renderLocal } from '../lib/local';
import { fill } from '../lib/local/schema';
import { optionLengthProfile, parallelTwkOptions } from '../lib/option-length';
import { readBackup } from '../lib/backup';
import { createWorkspace } from '../lib/quality';
import { rng } from '../lib/rng';
import { auditQuestion, auditPackages } from '../lib/validate';
import type { Question } from '../lib/types';

type Check = (ok: unknown, message: string) => void;
function metrics(questions: Pick<Question, 'options' | 'answer'>[]) {
  const metric = (key: 'words' | 'characters') => {
    let longest = 0, shortest = 0, guessLongest = 0, guessShortest = 0;
    for (const q of questions) {
      const lengths = optionLengthProfile(q.options.map((o) => o.text))[key], answer = lengths[q.answer];
      const max = Math.max(...lengths), min = Math.min(...lengths), high = lengths.filter((n) => n === max).length, low = lengths.filter((n) => n === min).length;
      if (answer === max) { longest += high === 1 ? 1 : 0; guessLongest += 1 / high; }
      if (answer === min) { shortest += low === 1 ? 1 : 0; guessShortest += 1 / low; }
    }
    return { longest, shortest, guessLongest: guessLongest / questions.length, guessShortest: guessShortest / questions.length };
  };
  return { questions: questions.length, words: metric('words'), characters: metric('characters') };
}

export function runTwkOptionChecks(check: Check) {
  const recipes = LOCAL_RECIPES.filter((r) => r.subtest === 'TWK');
  const old: Question[] = [], revised: Question[] = [];
  for (const recipe of recipes) {
    const model = LOCAL_MODELS.find((m) => m.id === recipe.model)!, state = model.states[recipe.state], context = model.contexts[recipe.context];
    const v1 = renderLocal({ kind: 'local', version: 1, model: recipe.model, context: recipe.context, state: recipe.state, order: [0, 1, 2, 3, 4] });
    old.push(v1);
    assert.deepEqual(v1.options.map((o) => o.text), (state.actions ?? model.actions).map((text) => fill(text, context)), 'Versi 1 tetap persis seperti sumber semula');
    check(auditQuestion(v1).length === 0, 'Paket lama tetap lolos rekonstruksi: ' + recipe.key);
    for (let seed = 0; seed < 8; seed++) {
      const q = makeLocal(recipe, rng('twk-parallel-' + seed));
      check(q.proof.kind === 'local' && q.proof.version === 2, 'Butir baru memakai redaksi versi 2');
      check(parallelTwkOptions(q.options.map((o) => o.text)), 'Panjang paralel: ' + recipe.key);
      check(auditQuestion(q).length === 0, 'Kunci, skor, dan pembahasan tetap konsisten: ' + recipe.key);
      check(q.stem === v1.stem && q.tip === v1.tip, 'Kasus dan kaidah tidak diubah untuk mengejar panjang');
      const proof = q.proof as Extract<Question['proof'], { kind: 'local' }>;
      check(proof.order[q.answer] === v1.answer, 'Tindakan yang benar tidak berubah: ' + recipe.key);
      assert.deepEqual(q.options.map((o) => o.reason), proof.order.map((i) => v1.options[i].reason));
      if (seed === 0) revised.push(q);
    }
  }
  // Contoh isi, bukan hanya skor yang dibaca ulang dari penyusun.
  for (const [model, state, correct] of [
    ['nas-kebutuhan', 0, /sama banyak.*terbukti setara/], ['nas-kebutuhan', 1, /menurut kesenjangan/],
    ['integritas-konflik', 0, /Mendeklarasikan.*pengalihan penilaian/], ['integritas-konflik', 1, /tugas administratif terbuka/],
    ['bela-aset', 1, /Mengisolasi bagian.*melaporkannya/], ['nas-produk', 1, /mesin yang aman.*produsen lokal/],
    ['pilar-persamaan', 1, /antrean biasa.*kedekatan pribadi/],
  ] as const) {
    const q = revised.find((q) => q.proof.kind === 'local' && q.proof.model === model && q.proof.state === state && q.proof.context === 0)!;
    check(correct.test(q.options[q.answer].text), 'Anchor substansi versi 2: ' + model + '/' + state);
  }
  const before = metrics(old), after = metrics(revised);
  for (const key of ['words', 'characters'] as const) {
    check(after[key].guessLongest <= .27, 'Menebak terpanjang tidak mendominasi: ' + key);
    check(after[key].guessShortest <= .30, 'Tidak diganti menjadi pola kunci terpendek: ' + key);
    check(after[key].longest > 0 && after[key].shortest > 0, 'Opsi terpanjang/terpendek tidak otomatis salah: ' + key);
  }
  check(after.characters.guessLongest < before.characters.guessLongest * .5, 'Bias terpanjang turun lebih dari separuh');
  const mutation = revised.find((q) => q.topic !== 'Bahasa Negara')!.options.map((o) => o.text);
  mutation[0] += ' ' + mutation[0] + ' ' + mutation[0];
  check(!parallelTwkOptions(mutation), 'Penjaga menolak opsi yang dipanjangkan berlebihan, apa pun indeksnya');
  const profiles = [];
  for (const profile of ['free', 'tryout-2027'] as const) {
    const all: Question[] = [];
    let maxLongest = 0;
    for (let seed = 0; seed < 100; seed++) {
      const settings = { ...DEFAULT_SETTINGS, mode: 'TWK' as const, count: 30, twkSource: 'new' as const, profile, seed: 'twk-length-' + seed };
      const packages = generate(settings), qs = packages[0].questions;
      check(auditPackages(packages, settings).ok, profile + ': hasil paket tetap valid');
      maxLongest = Math.max(maxLongest, metrics(qs).characters.longest / qs.length);
      all.push(...qs);
      if (seed === 0) {
        assert.deepEqual(generate(settings), packages, 'Seed tetap dapat direproduksi');
        const saved = createWorkspace({ settings, packages, audit: auditPackages(packages, settings), elapsed: 0 });
        check(readBackup(JSON.stringify(saved)).result.packages[0].questions.length === 30, 'Cadangan versi 2 dapat dibaca');
        mkdirSync('test-results', { recursive: true });
        writeFileSync('test-results/twk-options-' + profile + '.json', JSON.stringify(saved));
      }
    }
    const stats = metrics(all);
    check(stats.characters.guessLongest <= .25 && stats.words.guessLongest <= .25, '100 seed ' + profile + ': tebakan opsi terpanjang tidak mendominasi');
    check(stats.characters.guessShortest <= .32 && stats.words.guessShortest <= .32, '100 seed ' + profile + ': tidak beralih ke pola terpendek');
    check(maxLongest <= .4, 'Tidak ada paket dengan mayoritas kunci terpanjang pada ' + profile);
    profiles.push({ profile, seeds: 100, maxLongest, ...stats });
  }
  const bank = metrics(BANK.filter((q) => q.subtest === 'TWK'));
  check(bank.characters.guessLongest <= .3 && bank.words.guessLongest <= .3, 'Bank referensi diperiksa: kunci terpanjang tidak dominan');
  return { before, after, profiles, bank };
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/twk-option-checks.ts')) {
  let checks = 0;
  const result = runTwkOptionChecks((ok, message) => { assert.ok(ok, message); checks++; });
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/twk-options-report.json', JSON.stringify({ status: 'PASS', checks, ...result }, null, 2));
  console.log(JSON.stringify({ status: 'PASS', checks, ...result }, null, 2));
}
