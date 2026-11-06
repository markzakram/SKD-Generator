// Pemeriksaan jumlah per chapter (Settings.chapterCounts) pada standar tryout 2027. Dipanggil dari scripts/verify.ts; bisa dijalankan langsung (`npx tsx scripts/chapter-counts-checks.ts`).
// Yang diuji: jumlah persis dan urutan baris mapping, kombinasi lintas subtes, tiap chapter yang punya stok (termasuk tepat pada maksimumnya), keluarga modus dan kepatuhan blueprint pada 15 butir silogisme,
// tanpa kembar, determinisme, pesan melebihi maksimum, ganti nomor di chapter yang sama, validasi id dan angka, fitur turunan (ekspor, cadangan, bandingkan seed, ruang variasi, preferensi, API), dan tanpa isian hasil tetap.
import assert from 'node:assert/strict';
import { POST } from '../app/api/generate/route';
import { readBackup } from '../lib/backup';
import { DEFAULT_SETTINGS } from '../lib/config';
import { questionBlocks } from '../lib/export';
import { fingerprint, generate, normalizeSettings } from '../lib/generate';
import { chapterDuration, MAPPING_ROWS, profileCoverage, profilePlan, withChapterCounts } from '../lib/mapping';
import { migrateStoredSettings, SETTINGS_VERSION } from '../lib/prefs';
import { createWorkspace } from '../lib/quality';
import { NO_UNIQUE_REPLACEMENT, replaceQuestions } from '../lib/replace';
import { compareSeeds } from '../lib/seed-analysis';
import { siaduDocuments } from '../lib/siadu';
import { keluargaOfCode } from '../lib/silo-contoh';
import { chapterLimit, OPTION_CONTENT_ROWS, PROFILE_SETTINGS } from '../lib/tryout-profile';
import type { Package, Question, Settings } from '../lib/types';
import { auditPackages } from '../lib/validate';
import { variationSpace } from '../lib/variation-space';
import { checkSilogismeBlueprint } from './silogisme-checks';

type Check = (condition: unknown, message: string) => void;
const rowOf = (id: string) => MAPPING_ROWS.find((row) => row.id === id)!;
const stimulusOf = (q: Question) => fingerprint({ ...q, options: [] });
const familyOf = (q: Question) => q.proof.kind === 'model' && q.proof.model.kind === 'syllogism' ? keluargaOfCode(q.proof.model.code!) : undefined;
const spread = (values: (string | undefined)[]) => { const counts = new Map<string, number>(); for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1); return counts; };

export async function runChapterCountsChecks(check: Check) {
  let generated = 0;
  // Membuat paket, memeriksa audit, jumlah persis per chapter, urutan baris mapping, dan tanpa kembar.
  const made = (counts: Record<string, number>, extra: Partial<Settings> = {}, seed = 'CHAPTER-1'): { settings: Settings; packs: Package[] } => {
    const settings = normalizeSettings({ chapterCounts: counts, seed, ...extra }), packs = generate(settings), label = JSON.stringify(counts) + ' ' + JSON.stringify(extra) + ' ' + seed + ': ';
    const audit = auditPackages(packs, settings);
    check(audit.ok, label + audit.errors.slice(0, 3).join('; '));
    check(packs.length === settings.packages, label + 'jumlah paket');
    const prints = new Set<string>(), stimuli = new Set<string>();
    for (const pack of packs) {
      const local = new Set<string>(), localStimuli = new Set<string>();
      for (const row of MAPPING_ROWS) check(pack.questions.filter((q) => q.mappingId === row.id).length === (counts[row.id] ?? 0), label + 'jumlah persis ' + row.chapter);
      const rows = pack.questions.map((q) => rowOf(q.mappingId!).row);
      check(rows.every((row, i) => !i || rows[i - 1] <= row), label + 'urutan mengikuti baris mapping');
      check(pack.questions.every((q) => q.subtopic === rowOf(q.mappingId!).chapter || q.subtest !== 'TIU' && q.topic === rowOf(q.mappingId!).topic || rowOf(q.mappingId!).row === 24), label + 'soal tetap di chapter yang diminta');
      for (const q of pack.questions) {
        generated++;
        const print = fingerprint(q), stimulus = stimulusOf(q), plain = OPTION_CONTENT_ROWS.includes(rowOf(q.mappingId!).row) || q.proof.kind === 'local'; // model lokal Bahasa: kalimat soal tetap, isinya ada pada opsi
        check(!local.has(print) && (!plain && !localStimuli.has(stimulus) || plain), label + 'tanpa kembar dalam paket');
        check(!settings.uniqueAcross || !prints.has(print) && (plain || !stimuli.has(stimulus)), label + 'tanpa kembar antarpaket');
        local.add(print); localStimuli.add(stimulus); prints.add(print); stimuli.add(stimulus);
      }
    }
    return { settings, packs };
  };

  // 1. Validasi id, angka, dan batas ---------------------------------------------------------------------------------------------------------------------
  const rejected: [unknown, RegExp][] = [[{ 'map-99': 1 }, /Chapter tidak dikenal: map-99/], [{ hacked: 1 }, /Chapter tidak dikenal/], [{ 'map-14': 1.5 }, /2 Premis - Narasi harus bilangan bulat/], [{ 'map-14': -1 }, /bilangan bulat/], [{ 'map-14': '15' }, /bilangan bulat/], [{ 'map-14': Number.NaN }, /bilangan bulat/],
    [{ 'map-14': 201 }, /bilangan bulat 0–200/], [{ 'map-14': 150, 'map-15': 51 }, /maksimal 200/], [{}, /sedikitnya satu chapter/], [{ 'map-14': 0 }, /sedikitnya satu chapter/], [[], /objek/], [null, /objek/], ['map-14=15', /objek/]];
  for (const [value, message] of rejected) { assert.throws(() => normalizeSettings({ chapterCounts: value as Record<string, number> }), message); check(true, 'validasi'); }
  assert.throws(() => normalizeSettings({ profile: 'free', chapterCounts: { 'map-14': 1 } }), /Standar tryout 2027/); check(true, 'latihan bebas menolak isian');
  assert.throws(() => normalizeSettings({ chapterCounts: { 'map-14': 100 }, packages: 50 }), /4\.000/); check(true, 'batas 4.000 soal');
  const normal = normalizeSettings({ chapterCounts: { 'map-54': 10, 'map-14': 15, 'map-20': 0 }, seed: 'x', topics: ['Verbal'], subtopics: ['Verbal::Jadwal'], composition: { mudah: 50, sedang: 50, sulit: 0 } });
  check(normal.profile === 'tryout-2027' && normal.count === 25 && normal.mode === 'SKD' && normal.duration === chapterDuration(25) && !normal.topics.length && !normal.subtopics.length && !normal.composition, 'normalisasi: profil, jumlah, jenis, durasi, dan filter yang tidak berlaku');
  check(JSON.stringify(normal.chapterCounts) === JSON.stringify({ 'map-14': 15, 'map-54': 10 }), 'normalisasi: urutan baris mapping dan angka nol dibuang');
  check(normalizeSettings({ chapterCounts: { 'map-14': 2 }, duration: 77 }).duration === 77 && normalizeSettings({ chapterCounts: { 'map-14': 2 } }).mode === 'TIU', 'durasi yang disebut dipertahankan; satu subtes menjadi jenis paket');
  check(normalizeSettings({ chapterCounts: { 'map-03': 1, 'map-14': 1 } }).mode === 'SKD', 'dua subtes dua soal tetap sah (batas minimal gabungan tidak berlaku)');

  // 2. Baris 14 = 15 soal ---------------------------------------------------------------------------------------------------------------------------------
  const main = made({ 'map-14': 15 });
  check(main.packs[0].questions.length === 15 && main.packs[0].questions.every((q) => q.subtopic === '2 Premis - Narasi' && q.mappingId === 'map-14') && main.packs[0].duration === chapterDuration(15), 'baris 14 = 15 soal persis, durasi sebanding');
  assert.deepEqual(generate(main.settings), main.packs); check(true, 'deterministik per seed');
  check(fingerprint(made({ 'map-14': 15 }, {}, 'CHAPTER-2').packs[0].questions[0]) !== undefined, 'seed lain tetap sah');
  check(JSON.stringify(made({ 'map-14': 15 }, {}, 'CHAPTER-2').packs) !== JSON.stringify(main.packs), 'seed berbeda menghasilkan paket berbeda');

  // 3. Lintas subtes dan beberapa paket --------------------------------------------------------------------------------------------------------------------
  const cross = made({ 'map-14': 15, 'map-20': 5, 'map-54': 10 });
  const q = cross.packs[0].questions;
  check(cross.settings.mode === 'SKD' && q.length === 30 && q.slice(0, 15).every((x) => x.mappingId === 'map-14') && q.slice(15, 20).every((x) => x.mappingId === 'map-20') && q.slice(20).every((x) => x.mappingId === 'map-54' && x.subtest === 'TKP' && !!x.kasus), 'lintas subtes: urutan baris mapping, TKP dari kasus orisinal');
  const trio = made({ 'map-03': 3, 'map-14': 2, 'map-20': 2, 'map-54': 3 }, { packages: 3 });
  check(trio.packs.every((pack) => pack.questions.length === 10) && new Set(trio.packs.flatMap((pack) => pack.questions.map(fingerprint))).size === 30, 'lintas subtes tiga paket tanpa kembar');
  assert.deepEqual(generate(trio.settings), trio.packs); check(true, 'deterministik beberapa paket');
  made({ 'map-14': 15, 'map-54': 10 }, { packages: 2, uniqueAcross: false });

  // 4. Tiap chapter yang punya stok, pada dua sumber TIU dan sumber lokal ----------------------------------------------------------------------------------
  const blank = normalizeSettings({ chapterCounts: { 'map-14': 1 }, seed: 'x' });
  let chaptersWithStock = 0;
  for (const source of [{ tiuSource: 'accepted' }, { tiuSource: 'variation' }] as Partial<Settings>[]) for (const row of MAPPING_ROWS) {
    const limit = chapterLimit(row, { ...blank, ...source });
    if (!limit.max) { assert.throws(() => generate({ chapterCounts: { [row.id]: 1 }, seed: 'x', ...source }), new RegExp(row.chapter.replace(/[()]/g, '.') + ': maksimum 0 soal')); check(true, 'stok nol menyebut chapter'); continue; }
    chaptersWithStock++;
    made({ [row.id]: Math.min(limit.max, 2) }, source);
    if (limit.max < 30 || row.row === 16) made({ [row.id]: limit.max }, source); // tepat pada maksimum
  }
  // Baris 19–23 pada bawaan: empat punya pembangkit, Logika Pernyataan hanya tiga contoh.
  for (const row of [19, 20, 22, 23]) { check(chapterLimit(MAPPING_ROWS.find((r) => r.row === row)!, blank).max === 200, 'baris ' + row + ' memakai pembangkit'); made({ ['map-' + row]: 12 }); }
  check(chapterLimit(rowOf('map-21'), blank).max === 3, 'Logika Pernyataan paling banyak 3');
  check(new Set(made({ 'map-20': 8 }).packs[0].questions.map((x) => x.origin)).has('pola'), 'Jadwal: pembangkit mengisi sesudah contoh habis');
  // Sumber lokal: jumlah resep pada maksimum.
  for (const id of ['map-03', 'map-07', 'map-54']) { const source = { twkSource: 'new', tkpSource: 'new' } as Partial<Settings>; made({ [id]: chapterLimit(rowOf(id), { ...blank, ...source }).max }, source); }
  // Pembangkit yang membatasi, tepat pada maksimum, beberapa seed. Baris 39 memakai deret satu larik pada mode ini; baris tryout dengan dua larik tidak berubah.
  for (const seed of ['L1', 'L2', 'L3']) {
    made({ 'map-16': 72 }, {}, seed); made({ 'map-17': 45 }, {}, seed); made({ 'map-17': 36 }, { tiuSource: 'variation' }, seed); made({ 'map-39': 120 }, { tiuSource: 'variation' }, seed); made({ 'map-45': 70 }, {}, seed); made({ 'map-24': 60 }, { tiuSource: 'variation', difficulty: 'mudah' }, seed); made({ 'map-27': 60 }, { tiuSource: 'variation', difficulty: 'sulit' }, seed);
    made({ 'map-45': 35 }, { packages: 2 }, seed);
    made({ 'map-49': 200 }, { tiuSource: 'variation' }, seed); made({ 'map-49': 66 }, { tiuSource: 'variation', packages: 3 }, seed); // stimulus Kombinasi Optimal sekitar 252
  }
  check(made({ 'map-39': 3 }, { tiuSource: 'variation' }).packs[0].questions.every((x) => x.family === 'deret' && x.difficulty === 'mudah'), 'baris 39: deret 1 towew');
  // Kelompok eksklusif: stok dibagi per paket, tidak gagal acak, satu kelompok paling banyak sekali per paket.
  for (const packages of [1, 2, 3]) {
    const limit = chapterLimit(rowOf('map-04'), { ...blank, packages }), run = made({ 'map-04': limit.max }, { packages }, 'EKS' + packages);
    check(limit.max === (packages === 1 ? 11 : packages === 2 ? 7 : 5), 'maksimum SKD_Integritas menghitung kelompok eksklusif');
    for (const pack of run.packs) { const groups = pack.questions.flatMap((x) => { const id = x.proof.kind === 'bank' ? x.proof.id : ''; return [['tryout-ref-03-14', 'tryout-ref-04-08', 'tryout-ref-04-12', 'tryout-ref-05-07', 'tryout-ref-05-11'].includes(id)]; }); check(groups.filter(Boolean).length <= 1, 'soal sekelompok eksklusif paling banyak satu per paket'); }
  }
  // Kisi kesulitan x sumber: maksimum yang dilaporkan bisa dibuat dan tingkatnya sesuai; maksimum 0 gagal dengan pesan yang menyebut chapter.
  for (const difficulty of ['mudah', 'sedang', 'sulit'] as const) for (const source of [{ tiuSource: 'accepted' }, { tiuSource: 'variation' }, { twkSource: 'new', tkpSource: 'new' }] as Partial<Settings>[]) for (const row of MAPPING_ROWS) {
    const limit = chapterLimit(row, { ...blank, ...source, difficulty });
    if (!limit.max) { assert.throws(() => generate({ chapterCounts: { [row.id]: 1 }, difficulty, ...source }), (error: Error) => error.message.includes(row.chapter + ': maksimum 0')); check(true, 'tingkat tanpa stok menyebut chapter'); continue; }
    check(made({ [row.id]: Math.min(limit.max, 2) }, { difficulty, ...source }, 'KISI').packs[0].questions.every((x) => x.difficulty === difficulty), row.chapter + ' mengikuti kesulitan ' + difficulty);
  }
  // Filter kesulitan: pembangkit silogisme hanya tingkat sedang, TKP tanpa tingkat sulit, figural mengikuti filter.
  assert.throws(() => generate({ chapterCounts: { 'map-14': 2 }, difficulty: 'sulit' }), /2 Premis - Narasi: maksimum 0/); check(true, 'kesulitan yang tidak ada');
  assert.throws(() => generate({ chapterCounts: { 'map-54': 1 }, difficulty: 'sulit' }), /Pelayanan Publik: maksimum 0/); check(true, 'TKP tanpa tingkat sulit');
  check(made({ 'map-50': 3 }, { difficulty: 'mudah' }).packs[0].questions.every((x) => x.difficulty === 'mudah'), 'figural mengikuti filter kesulitan');
  check(made({ 'map-19': 4 }, { difficulty: 'sulit' }).packs[0].questions.every((x) => x.difficulty === 'sulit'), 'pembangkit diulang sampai tingkatnya sesuai');

  // 5. Silogisme: keluarga modus merata, blueprint, contoh lebih dahulu -------------------------------------------------------------------------------------
  const seeds = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
  for (const seed of seeds) for (const id of ['map-13', 'map-14', 'map-15']) {
    const { packs } = made({ [id]: 15 }, {}, seed), items = packs[0].questions, counts = spread(items.map(familyOf));
    check(items.every((x) => familyOf(x)), 'keluarga terbaca: ' + id);
    check(counts.size === (id === 'map-13' ? 6 : 5), id + ': semua keluarga muncul pada 15 butir (' + seed + ')');
    check(Math.max(...counts.values()) - Math.min(...counts.values()) <= 1, id + ': keluarga merata (' + seed + '): ' + JSON.stringify([...counts]));
    for (const item of items) { const found: string[] = []; checkSilogismeBlueprint(item, (text) => found.push(text)); check(!found.length, id + ' butir ' + item.no + ' mengikuti blueprint (' + seed + '): ' + found[0]); }
    check(items.every((x) => x.difficulty === 'sedang' && x.bloom === (id === 'map-14' ? 'C3' : id === 'map-15' ? 'C4' : x.bloom)), id + ': label sama dengan tryout');
    if (id !== 'map-13') {
      const reversed = items.reduce((n, x) => n + (x.proof.kind === 'model' && x.proof.model.kind === 'syllogism' ? x.proof.model.narrative?.reversed ?? 0 : 0), 0);
      check(reversed <= 3, id + ': redaksi konsekuen-dahulu paling banyak 20% butir');
    }
    if (id === 'map-14') check(items.filter((x) => x.source.startsWith('Contoh ')).length === 8, 'seluruh 8 contoh dua premis terpakai lebih dahulu');
    if (id === 'map-15') check(items.filter((x) => x.source.startsWith('Contoh ')).length >= 8, 'contoh tiga premis dipakai lebih dahulu');
  }
  for (const seed of ['B1', 'B2']) {
    const big = made({ 'map-14': 15 }, { packages: 5 }, seed), overall = spread(big.packs.flatMap((pack) => pack.questions.map(familyOf)));
    check(new Set(big.packs.flatMap((pack) => pack.questions.map(fingerprint))).size === 75, 'lima paket x 15 tanpa kembar');
    check(big.packs.every((pack) => { const each = spread(pack.questions.map(familyOf)); return each.size === 5 && [...each.values()].every((n) => n === 3); }), 'tiap paket merata');
    check([...overall.values()].every((n) => n === 15), 'seluruh paket merata');
    check(big.packs.flatMap((pack) => pack.questions).filter((x) => x.source.startsWith('Contoh ')).length === 8, 'contoh tidak dipakai dua kali');
    check(new Set(big.packs[0].questions.map((x) => x.source)).size >= 8 && big.packs.flatMap((pack) => pack.questions).every((x) => { const found: string[] = []; checkSilogismeBlueprint(x, (text) => found.push(text)); return !found.length; }), 'lima paket mengikuti blueprint');
  }
  const twoOfEach = made({ 'map-13': 1, 'map-14': 2, 'map-15': 2 }).packs[0].questions.map(familyOf);
  check(new Set(twoOfEach).size === 5, 'kuota kecil tetap memakai perencana lima keluarga berbeda');

  // 6. Pesan melebihi maksimum ---------------------------------------------------------------------------------------------------------------------------
  const tooMuch: [Record<string, number>, Partial<Settings>, RegExp][] = [
    [{ 'map-21': 5 }, {}, /Logika Pernyataan: maksimum 3 soal per paket \(hanya contoh diterima\), diminta 5\. Pembangkit chapter ini belum tersedia/],
    [{ 'map-54': 26 }, {}, /Pelayanan Publik: maksimum 25 soal per paket \(kasus orisinal\), diminta 26/],
    [{ 'map-54': 13 }, { packages: 2 }, /Pelayanan Publik: maksimum 12 soal.*pengulangan antarpaket/],
    [{ 'map-24': 9 }, {}, /Operasi Hitung - Dasar: maksimum 3 soal.*Variasi TIU terhitung/],
    [{ 'map-16': 73 }, {}, /2 Kata: maksimum 72 soal/],
    [{ 'map-14': 15, 'map-21': 4, 'map-54': 2 }, {}, /Logika Pernyataan: maksimum 3/],
  ];
  for (const [counts, extra, message] of tooMuch) { assert.throws(() => generate({ chapterCounts: counts, seed: 'x', ...extra }), message); check(true, 'pesan melebihi maksimum'); }
  made({ 'map-54': 13 }, { packages: 2, uniqueAcross: false }); // boleh berulang antarpaket: stok tidak dibagi

  // 7. Ganti nomor tetap di chapter yang sama ---------------------------------------------------------------------------------------------------------------
  const swap = (counts: Record<string, number>, extra: Partial<Settings> = {}, bankOnly = false) => {
    const { settings, packs } = made(counts, extra, 'GANTI'), workspace = createWorkspace({ settings, packages: packs, audit: auditPackages(packs, settings), elapsed: 0 }), pack = packs[0], ids = pack.questions.filter((_, i) => i % 2 === 0).map((x) => x.id);
    const outcome = replaceQuestions(workspace.result, pack.id, ids, 'ganti');
    check(bankOnly ? outcome.failed.every((item) => item.reason === NO_UNIQUE_REPLACEMENT) : !outcome.failed.length, 'ganti nomor berhasil: ' + JSON.stringify(counts) + ' ' + outcome.failed[0]?.reason);
    for (const next of outcome.replaced) {
      const before = pack.questions.find((x) => x.id === next.id)!;
      check(next.mappingId === before.mappingId && (next.subtest === 'TKP' || next.subtopic === before.subtopic) && next.topic === before.topic && next.no === before.no && fingerprint(next) !== fingerprint(before), 'pengganti dari chapter yang sama');
    }
    const after = outcome.result.packages.flatMap((p) => p.questions);
    check(new Set(after.map(fingerprint)).size === after.length, 'pengganti tidak kembar');
    check(auditPackages(outcome.result.packages, settings).ok, 'paket sesudah ganti nomor lolos audit');
    return outcome;
  };
  swap({ 'map-14': 15 }); swap({ 'map-20': 4, 'map-19': 2, 'map-23': 2 }); swap({ 'map-54': 6 }); swap({ 'map-03': 6 }, {}, true); swap({ 'map-39': 4 }, { tiuSource: 'variation' }); swap({ 'map-14': 15, 'map-20': 5, 'map-54': 10 }, { packages: 2 });
  // Stok habis: pesan gagal, bukan pindah chapter.
  const stuck = made({ 'map-30': 1 }), stuckOutcome = replaceQuestions(createWorkspace({ settings: stuck.settings, packages: stuck.packs, audit: auditPackages(stuck.packs, stuck.settings), elapsed: 0 }).result, stuck.packs[0].id, [stuck.packs[0].questions[0].id], 'habis');
  check(stuckOutcome.failed.length === 1 && !stuckOutcome.replaced.length, 'stok chapter habis: tidak pindah chapter');

  // 8. Fitur turunan ---------------------------------------------------------------------------------------------------------------------------------------
  const derived = made({ 'map-14': 3, 'map-20': 2, 'map-50': 2, 'map-54': 2, 'map-03': 2 });
  const coverage = profileCoverage(derived.packs[0].questions, derived.settings);
  check(coverage.length === 5 && coverage.every((row) => row.actual === row.count), 'cakupan per chapter (Workbench)');
  check(profilePlan(derived.settings).map((row) => row.id).join() === 'map-03,map-14,map-20,map-50,map-54', 'rencana mengikuti isian');
  for (const item of derived.packs[0].questions) for (const content of ['soal', 'kunci', 'soal-jawaban', 'pembahasan'] as const) check(questionBlocks(item, content, null).head.length > 0, 'blok ekspor: ' + item.subtopic);
  check(siaduDocuments(derived.packs, 'all').flatMap((doc) => doc.questions ?? []).length >= 0 && siaduDocuments(derived.packs, 'TIU').length > 0, 'dokumen SiAdu tersusun');
  const workspace = createWorkspace({ settings: derived.settings, packages: derived.packs, audit: auditPackages(derived.packs, derived.settings), elapsed: 0 });
  check(JSON.stringify(readBackup(JSON.stringify(workspace)).result.settings.chapterCounts) === JSON.stringify(derived.settings.chapterCounts), 'Riwayat dan cadangan menyimpan isian per chapter');
  const left = { seed: 'CHAPTER-1', packages: derived.packs }, right = { seed: 'CHAPTER-3', packages: generate({ ...derived.settings, seed: 'CHAPTER-3' }) };
  check(right.packages[0].questions.length === 11 && compareSeeds(left, right).total === 11, 'Bandingkan seed memakai isian yang sama');
  const space = variationSpace(derived.settings);
  check(['map-14', 'map-20', 'map-50'].every((id) => space.find((source) => source.id === id)?.kind === 'parameter') && space.find((source) => source.id === 'map-54')?.kind === 'bank', 'ruang variasi per chapter');
  // Preferensi: isian sah dipertahankan, isian yang tidak sah tidak menggugurkan preferensi lain.
  const stored = { seed: 'punya-saya', mode: 'TIU', count: 15, profile: 'tryout-2027', chapterCounts: { 'map-14': 15 }, packages: 3 };
  assert.deepEqual(migrateStoredSettings(stored, SETTINGS_VERSION), stored); check(true, 'preferensi isian sah utuh');
  const dirty = migrateStoredSettings({ ...stored, chapterCounts: { 'map-99': 3, 'map-14': 2, 'map-15': 1.5 } }, SETTINGS_VERSION);
  check(JSON.stringify(dirty.chapterCounts) === JSON.stringify({ 'map-14': 2 }) && dirty.count === 2 && dirty.seed === 'punya-saya', 'preferensi: id tak dikenal dan angka tidak sah dibuang');
  const empty = migrateStoredSettings({ ...stored, chapterCounts: {}, count: 0 }, SETTINGS_VERSION);
  check(!('chapterCounts' in empty) && empty.count === 35 && empty.packages === 3 && normalizeSettings(empty as Partial<Settings>).count === 35, 'preferensi: isian kosong kembali ke kuota saran tanpa menghapus pengaturan lain');
  const oldPrefs = { twkSource: 'new', tkpSource: 'new', seed: 'seed-saya', packages: 3, topics: ['Integritas'], mode: 'TKP' };
  check(JSON.stringify(migrateStoredSettings(oldPrefs, 1)) === JSON.stringify({ ...oldPrefs, tkpSource: 'accepted' }), 'preferensi lama tetap dimigrasikan seperti sebelumnya');
  // Perpindahan ke isian: jumlah, jenis, dan durasi ikut; isian kosong tetap menyisakan jenis paket.
  const moved = withChapterCounts({ ...DEFAULT_SETTINGS, profile: 'free', topics: ['Verbal'], mode: 'TKP' }, { 'map-14': 15 });
  check(moved.profile === 'tryout-2027' && moved.count === 15 && moved.mode === 'TIU' && moved.duration === chapterDuration(15) && !moved.topics.length, 'withChapterCounts: pindah ke standar tryout');
  check(withChapterCounts({ ...DEFAULT_SETTINGS, mode: 'TKP' }, {}).mode === 'TKP', 'isian kosong mempertahankan jenis paket');
  // API
  const post = async (body: unknown) => { const response = await POST(new Request('http://local/api/generate', { method: 'POST', body: JSON.stringify(body) })); return { status: response.status, json: await response.json() as { packages?: Package[]; settings?: Settings; error?: string } }; };
  const api = await post({ chapterCounts: { 'map-14': 15 }, seed: 'API' });
  check(api.status === 200 && api.json.settings?.profile === 'tryout-2027' && api.json.packages?.[0].questions.length === 15 && api.json.packages[0].questions.every((x) => x.mappingId === 'map-14'), '/api/generate menerima chapterCounts');
  const apiMax = await post({ chapterCounts: { 'map-21': 4 } }), apiBad = await post({ chapterCounts: { nope: 1 } });
  check(apiMax.status === 400 && /Logika Pernyataan: maksimum 3/.test(apiMax.json.error ?? '') && apiBad.status === 400 && /Chapter tidak dikenal/.test(apiBad.json.error ?? ''), '/api/generate: pesan jelas');

  // 9. Tanpa isian: rencana dan hasil tetap (rekaman seed: TRYOUT_SEED_SNAPSHOT, scripts/quality-verify.ts) ---------------------------------------------------
  const base = { ...DEFAULT_SETTINGS, ...PROFILE_SETTINGS, packages: 2, seed: 'TANPA-ISIAN' };
  check(profilePlan(normalizeSettings(base)).reduce((n, row) => n + row.count, 0) === 110 && profilePlan(normalizeSettings(base)).length === 37, 'rencana workbook tetap 37 baris, 110 soal');
  assert.deepEqual(generate({ ...base, chapterCounts: undefined }), generate(base)); check(true, 'chapterCounts kosong sama dengan tanpa kolom');
  check(!('chapterCounts' in normalizeSettings(base)), 'normalisasi tidak menambah kolom pada pengaturan lama');
  return { chaptersWithStock, generated };
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/chapter-counts-checks.ts')) {
  let checks = 0;
  runChapterCountsChecks((condition, message) => { assert.ok(condition, message); checks++; })
    .then((report) => console.log(JSON.stringify({ status: 'PASS', checks, ...report }, null, 2)))
    .catch((error) => { console.error(error); process.exit(1); });
}
