import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import anchors from '../data/benchmark.json';
import { BANK, BANK_MAP } from '../lib/bank';
import { tkpCases } from '../lib/bank/cases';
import { TKP_KASUS_TOPICS } from '../lib/bank/tkp-kasus';
import { DEFAULT_SETTINGS } from '../lib/config';
import { buildBlueprint, actualBlueprint } from '../lib/blueprint';
import { fingerprint, generate, normalizeSettings, remapOptionLabels } from '../lib/generate';
import { auditPackages, auditQuestion } from '../lib/validate';
import { createWorkspace, editQuestion, exportPackages, qualitySummary, reviseWorkspace, setReview, questionIssues } from '../lib/quality';
import { analyzePilots, blankAnswers, contentHash, validatePilot } from '../lib/pilot';
import { readBackup } from '../lib/backup';
import { LOCAL_MODELS } from '../lib/local';
import { rng } from '../lib/rng';
import { TIU_FAMILIES, makeTiu } from '../lib/tiu';
import { DATA_LABELS } from '../lib/models';
import { OPTION_REASON_FAMILIES, isGenericReason, keepsOptionOrder, keepsOptionReasons, ordinalRanks, positionReferences, workingNote } from '../lib/reasons';
import type { Package, Proof, Question, PilotSession } from '../lib/types';
import { runTiuExportChecks, runTiuFormatChecks } from './tiu-format-checks';
import { runTkpChecks } from './tkp-checks';
import { runTwkChecks } from './twk-checks';

let checks = 0;
const ok = (condition: unknown, message: string) => { assert.ok(condition, message); checks++; };
for (const fixture of anchors.cases) {
  if ('bankId' in fixture) {
    const item = BANK_MAP.get(fixture.bankId!); ok(item, fixture.id); assert.equal(item!.options[item!.answer].text, fixture.expected); checks++;
    continue;
  }
  const answer = fixture.choices!.indexOf(fixture.expected);
  const q: Question = { id: fixture.id, no: 1, subtest: 'TIU', topic: 'Numerik', subtopic: 'Benchmark', family: 'benchmark', difficulty: 'sedang', stem: fixture.stem!, options: fixture.choices!.map((text, i) => ({ text, score: i === answer ? 5 : 0, reason: fixture.explanation })), answer, explanation: fixture.explanation, source: 'Anchor regresi; menunggu telaah ahli', origin: 'pola', proof: fixture.proof as Proof };
  ok(!auditQuestion(q).length, fixture.id + ': ' + auditQuestion(q));
  const corrupt = structuredClone(q); corrupt.answer = (answer + 1) % 5; corrupt.options.forEach((o, i) => o.score = i === corrupt.answer ? 5 : 0);
  ok(auditQuestion(corrupt).length, 'Solver menolak kunci salah: ' + fixture.id);
}
const settings = normalizeSettings({ ...DEFAULT_SETTINGS, count: 110, composition: { mudah: 25, sedang: 50, sulit: 25 } });
const blueprint = buildBlueprint(settings), packages = generate({ ...settings, blueprint });
ok(auditPackages(packages, { ...settings, blueprint }).ok, 'Kuota eksplisit harus dipenuhi.');
assert.deepEqual(actualBlueprint(packages[0].questions).sort((a,b) => (a.topic+a.difficulty).localeCompare(b.topic+b.difficulty)), blueprint.sort((a,b) => (a.topic+a.difficulty).localeCompare(b.topic+b.difficulty))); checks++;
assert.throws(() => generate({ ...settings, blueprint: [{ subtest: 'TWK', topic: 'Nasionalisme', difficulty: 'mudah', count: 110 }] }), /kuota|Jumlah|tersedia/); checks++;
assert.throws(() => normalizeSettings({ composition: { mudah: 20, sedang: 20, sulit: 20 } }), /100/); checks++;
const result = { settings, packages, audit: auditPackages(packages, settings), elapsed: 0 };
let workspace = createWorkspace(result), q = workspace.result.packages[0].questions[0];
assert.throws(() => setReview(q, 'approved', '', ''), /penelaah/); checks++;
assert.throws(() => exportPackages(workspace.result, 'approved'), /Belum/); checks++;
const approved = setReview(q, 'approved', 'Telah ditinjau dalam pengujian.', 'QA');
const next = structuredClone(workspace.result); next.packages[0].questions[0] = approved;
workspace = reviseWorkspace(workspace, next, 'Setuju');
ok(exportPackages(workspace.result, 'approved')[0].questions.length === 1, 'Ekspor hanya persetujuan.');
ok(readBackup(JSON.stringify(workspace)).result.packages[0].questions[0].review?.reviewer === 'QA', 'Cadangan mempertahankan jejak penelaah.');
const edited = editQuestion(approved, { ...approved, stem: approved.stem + ' Perhatikan seluruh informasi.' });
ok(edited.review?.status === 'revision' && edited.proof.kind === 'manual', 'Suntingan membatalkan persetujuan dan bukti model.');
assert.throws(() => setReview(edited, 'approved', '', 'QA'), /catatan/); checks++;
const badFigure = structuredClone(packages[0].questions.find((q) => q.visual)!); badFigure.options[0].scene!.parts[0].f = 9 as never;
ok(auditQuestion(badFigure).length, 'Atribut visual rusak ditolak.');
const badTable = { ...edited, table: { headers: ['A'], rows: [['1','2']] } }; ok(auditQuestion(badTable).length, 'Tabel rusak ditolak.');
const badStem = structuredClone(packages[0].questions.find((q) => q.proof.kind === 'numeric')!); badStem.stem += ' Angka pada stimulus telah diubah.'; ok(auditQuestion(badStem).length, 'Stimulus yang terpisah dari model ditolak.');
const excluded = structuredClone(workspace.result); excluded.packages[0].questions[0].review!.excluded = true;
assert.throws(() => exportPackages(excluded, 'approved'), /Belum/); checks++;
ok(questionIssues({ ...edited, options: edited.options.map((o,i) => i === edited.answer ? { ...o, text: o.text + ' tambahan'.repeat(100) } : o) }).some((i) => i.code === 'length'), 'Petunjuk panjang kunci ditandai.');
const pack = workspace.result.packages[0];
const session: PilotSession = { id: 'fixture-1', workspaceId: workspace.id, version: workspace.version, packageId: pack.id, participant: 'DATA UJI', finishedAt: new Date().toISOString(), answers: blankAnswers(pack).map((a,i) => ({ ...a, choice: i === 0 ? pack.questions[i].answer : null, seconds: 12 })) };
validatePilot(session, workspace); checks++;
const analysis = analyzePilots(workspace, pack, [session]); ok(analysis[0].bestRate === 1 && analysis[0].meanScore === 5 && !analysis[0].empirical, 'N kecil tidak diberi label empiris.');
const badSession = { ...session, answers: [{ ...session.answers[0], choice: 8 }] }; assert.throws(() => validatePilot(badSession, workspace), /tidak valid/); checks++;
const changed = structuredClone(workspace); changed.result.packages[0].questions[0] = edited;
ok(contentHash(edited) !== contentHash(approved) && analyzePilots(changed, changed.result.packages[0], [session])[0].count === 0, 'Respons revisi lama tidak dicampur.');
const many: PilotSession[] = Array.from({ length: 40 }, (_, n) => ({ ...session, id: 'fixture-' + n, answers: blankAnswers(pack).map((a, i) => ({ ...a, choice: n < 20 ? pack.questions[i].answer : (pack.questions[i].answer + 1) % 5, seconds: 10 + n })) }));
const stats = analyzePilots(workspace, pack, many); ok(stats[0].empirical === 'Sedang' && stats[0].discrimination !== null && stats[0].discrimination > .99, 'Kalibrasi dan korelasi memakai respons yang cocok.');
// Kerangka TKP lama yang masih dipakai (kompetensi yang belum punya berkas di data/tkp-kasus/). Kunci = opsi bernilai 5, bukan options[0].
// Kasus TKP baru diperiksa lebih ketat di scripts/tkp-checks.ts (kunci terpanjang paling banyak 20%, rasio panjang, tag, alasan, sebaran).
const legacyTkp = tkpCases.filter((q) => !TKP_KASUS_TOPICS.has(q.topic));
const keyOf = (q: (typeof tkpCases)[number]) => q.options.find((o) => o.score === 5)!;
const longest = legacyTkp.filter((q) => keyOf(q).text.length > Math.max(...q.options.filter((o) => o.score !== 5).map((o) => o.text.length))).length;
ok(!legacyTkp.length || longest / legacyTkp.length <= .35, 'Kunci TKP tidak sistematis menjadi pilihan terpanjang.');
ok(new Set(legacyTkp.map((q) => q.options.map((o) => o.text).sort().join('|'))).size === legacyTkp.length, 'Set opsi berbeda pada setiap kasus TKP.');
ok(BANK.filter((q) => q.id.startsWith('twk-case-v2')).every((q) => new Set(q.options.map((o) => o.reason)).size === 5), 'Alasan tiap pengecoh TWK berbeda.');
// Soal figural mesin baru melewati seluruh alur kurasi: persetujuan, suntingan, ekspor, cadangan, dan pembuktian ulang.
const figuralSettings = normalizeSettings({ ...DEFAULT_SETTINGS, mode: 'TIU', topics: ['Figural'], count: 12, seed: 'KURASI-FIGURAL' });
const figuralPacks = generate(figuralSettings), figuralResult = { settings: figuralSettings, packages: figuralPacks, audit: auditPackages(figuralPacks, figuralSettings), elapsed: 0 };
ok(figuralResult.audit.ok && figuralPacks[0].questions.every((q) => q.proof.kind === 'scene'), 'Paket figural lulus audit dengan bukti gambar.');
let figuralSpace = createWorkspace(figuralResult);
const figuralQuestion = figuralSpace.result.packages[0].questions[0];
ok(questionIssues(figuralQuestion, figuralSpace.result.packages[0].questions).every((i) => i.level !== 'error') && qualitySummary(figuralSpace.result.packages[0].questions).verified === 12, 'Soal figural terhitung terverifikasi tanpa galat struktur.');
const figuralApproved = setReview(figuralQuestion, 'approved', 'Gambar, kunci, dan pembahasan diperiksa.', 'QA');
const figuralNext = structuredClone(figuralSpace.result); figuralNext.packages[0].questions[0] = figuralApproved;
figuralSpace = reviseWorkspace(figuralSpace, figuralNext, 'Setuju figural');
ok(exportPackages(figuralSpace.result, 'approved')[0].questions.length === 1, 'Soal figural yang disetujui dapat diekspor.');
const restored = readBackup(JSON.stringify(figuralSpace));
ok(JSON.stringify(restored.result.packages[0].questions[0].visual) === JSON.stringify(figuralApproved.visual) && restored.result.packages[0].questions[0].options.every((o) => o.scene), 'Cadangan mempertahankan gambar figural.');
const figuralEdited = editQuestion(figuralApproved, { ...figuralApproved, stem: figuralApproved.stem + ' Perhatikan seluruh gambar.' });
ok(figuralEdited.review?.status === 'revision' && figuralEdited.proof.kind === 'manual' && auditQuestion(figuralEdited).length === 0, 'Suntingan soal figural membatalkan persetujuan dan tetap sah secara struktur.');
const tamperedBackup = JSON.parse(JSON.stringify(figuralSpace)); tamperedBackup.result.packages[0].questions[1].options[0].scene.parts[0].f = 9;
assert.throws(() => readBackup(JSON.stringify(tamperedBackup)), /Cadangan gagal pemeriksaan/); checks++;
const swapped = JSON.parse(JSON.stringify(figuralSpace)), swappedQuestion = swapped.result.packages[0].questions[2];
swappedQuestion.options.forEach((o: { score: number }, i: number) => { o.score = i === (swappedQuestion.answer + 1) % 5 ? 5 : 0; }); swappedQuestion.answer = (swappedQuestion.answer + 1) % 5;
assert.throws(() => readBackup(JSON.stringify(swapped)), /Cadangan gagal pemeriksaan/); checks++;

// ---- Pemeriksaan sistemik revisi akademik (tahap 1): alasan opsi, sisa catatan, alasan TIU, sebaran kunci, rujukan posisi -------------
// (a) Tidak ada alasan generik di bank maupun paket hasil generate.
ok(BANK.every((q) => q.options.every((o) => !isGenericReason(o.reason))), 'Bank tidak memuat alasan generik.');
const SEEDS = ['JADIASN-2027', 'sistemik-1', 'sistemik-2', 'sistemik-3', 'sistemik-4'];
const pool: Package[] = SEEDS.flatMap((seed) => generate(normalizeSettings({ ...DEFAULT_SETTINGS, seed, packages: 2 })));
const localPool: Package[] = SEEDS.slice(0, 3).flatMap((seed) => generate(normalizeSettings({ ...DEFAULT_SETTINGS, seed, twkSource: 'new', tkpSource: 'new' })));
const allQuestions = [...pool, ...localPool].flatMap((p) => p.questions);
ok(allQuestions.every((q) => q.options.every((o) => !isGenericReason(o.reason))), 'Paket hasil generate tidak memuat alasan generik.');
ok(['TWK', 'TIU', 'TKP'].every((subtest) => allQuestions.some((q) => q.subtest === subtest)) && pool.length === SEEDS.length * 2, 'Contoh paket mencakup TWK, TIU, dan TKP.');
// (b) Tidak ada sisa catatan penyusunan di pembahasan dan alasan TWK/TKP (bank dan paket).
const noted = (q: { subtest: string; explanation: string; options: { reason: string }[] }) => q.subtest !== 'TIU' && [q.explanation, ...q.options.map((o) => o.reason)].some((text) => workingNote(text));
ok(!BANK.some(noted), 'Bank TWK/TKP tidak memuat sisa catatan (' + BANK.filter(noted).map((q) => q.id).slice(0, 5) + ').');
ok(!allQuestions.some(noted), 'Paket TWK/TKP tidak memuat sisa catatan penyusunan.');
const referenceTwk = BANK.filter((q) => q.id.startsWith('twk-ref-'));
ok(referenceTwk.length === 37 && referenceTwk.every((q) => !/Pembahasan Opsi|Alasan Opsi|Opsi salah|opsi yang salah/i.test(q.explanation) && q.options[q.answer].reason.trim() && !q.options.some((o) => /\b(?:Opsi|Pilihan)\s+[A-E]\b/.test(o.reason))),
  'Pembahasan TWK riset: bagian opsi salah tidak diulang, alasan kunci ada, huruf opsi tidak tertinggal di alasan.');
ok(BANK_MAP.get('twk-ref-3-3')!.options.every((o) => o.reason.trim()) && !/Tips|Tri(?:ck|k)|Cara cepat|Carcep|Rumus cepat/i.test(BANK_MAP.get('twk-ref-3-3')!.explanation), 'twk-ref-3-3: alasan tiap opsi spesifik dan tanpa tips.');
ok(BANK.filter((q) => q.id.startsWith('tkp-ref-')).every((q) => q.options.every((o) => /[.!?]$/.test(o.reason) && o.reason.split(/(?<=[.!?])\s+/).every((s) => /^\p{Lu}/u.test(s)))), 'Alasan TKP riset hanya berisi kalimat alasan utuh.');
// (c) TIU: alasan per opsi hanya untuk silogisme dan analogi verbal.
for (const family of TIU_FAMILIES) for (const level of family.levels) for (let seed = 0; seed < 4; seed++) {
  const draft = makeTiu(family, level, rng('alasan|' + family.id + '|' + level + '|' + seed));
  // Silogisme Biasa (2 dan 3 Premis) tidak memuat analisis maupun alasan opsi (blueprint Bagian 8); Silogisme Narasi dan bentuk implikasi beralasan.
  const has = draft.options.map((o) => o.reason.trim() !== ''), required = OPTION_REASON_FAMILIES.includes(family.id);
  ok(required ? (family.id === 'silogisme' ? has.every(Boolean) || !has.some(Boolean) : has.every(Boolean)) : !has.some(Boolean), family.id + '/' + level + ': alasan per opsi ' + (required ? 'wajib ada' : 'tidak boleh ada'));
}
const biasaSilogisme = (q: Question) => q.family === 'silogisme' && q.proof.kind === 'model' && q.proof.model.kind === 'syllogism' && ['2 Premis', '3 Premis'].includes(q.proof.model.chapter ?? '');
ok(OPTION_REASON_FAMILIES.join() === 'silogisme,analogi' && allQuestions.filter((q) => q.subtest === 'TIU' && q.origin === 'pola').every((q) => (OPTION_REASON_FAMILIES.includes(q.family) && !biasaSilogisme(q)) === q.options.every((o) => o.reason.trim() !== '')), 'Paket: TIU hasil pola beralasan hanya untuk silogisme narasi/implikasi dan analogi; Silogisme Biasa tanpa alasan opsi.');
// Aturan yang sama berlaku untuk semua soal TIU apa pun asalnya: bank, contoh diterima, pola, dan profil tryout-2027 (contoh diterima maupun variasi).
const tryoutPool: Package[] = (['accepted', 'variation'] as const).flatMap((tiuSource) => generate(normalizeSettings({ ...DEFAULT_SETTINGS, profile: 'tryout-2027', tiuSource, packages: 3, seed: 'sistemik-tryout' })));
const everyTiu = [...BANK, ...allQuestions, ...tryoutPool.flatMap((p) => p.questions)].filter((q) => q.subtest === 'TIU');
const breaking = everyTiu.filter((q) => !keepsOptionReasons(q) && q.options.some((o) => o.reason.trim()));
ok(everyTiu.length > 500 && !breaking.length, 'Semua soal TIU (bank, contoh diterima, pola, profil tryout) tanpa alasan opsi kecuali silogisme/analogi verbal: ' + breaking.slice(0, 5).map((q) => q.id));
ok(tryoutPool.flatMap((p) => p.questions).some((q) => q.provenance?.status === 'accepted-example' && q.subtest === 'TIU' && q.subtopic.startsWith('Memperkuat')) && BANK.filter((q) => q.subtest === 'TIU' && keepsOptionReasons(q)).every((q) => /Premis|Kata|Silogisme|Analogi/i.test(q.subtopic)), 'Contoh diterima Memperkuat/Memperlemah Argumen termasuk yang dikosongkan; hanya silogisme/analogi yang mempertahankan alasan.');
// (d) Sebaran posisi kunci TWK dan TIU per paket tidak timpang: tiap huruf antara floor(n/5)−2 dan ceil(n/5)+2.
const spread: Record<'TWK' | 'TIU', number[][]> = { TWK: [], TIU: [] };
const balanced = (pack: Package, subtest: 'TWK' | 'TIU') => {
  const keys = pack.questions.filter((q) => q.subtest === subtest), counts = [0, 0, 0, 0, 0];
  keys.forEach((q) => counts[q.answer]++);
  spread[subtest].push(counts);
  return counts.every((n) => n >= Math.floor(keys.length / 5) - 2 && n <= Math.ceil(keys.length / 5) + 2);
};
for (const pack of pool) for (const subtest of ['TWK', 'TIU'] as const) ok(balanced(pack, subtest), pack.seed + ' ' + subtest + ': sebaran kunci timpang ' + spread[subtest].at(-1));
for (const seed of ['kunci-a', 'kunci-b', 'kunci-c', 'kunci-d']) for (const [mode, count] of [['TWK', 30], ['TIU', 35], ['SKD', 55]] as const) {
  for (const pack of generate(normalizeSettings({ ...DEFAULT_SETTINGS, mode, count, seed }))) for (const subtest of ['TWK', 'TIU'] as const) {
    if (pack.questions.some((q) => q.subtest === subtest)) ok(balanced(pack, subtest), seed + ' ' + mode + ' ' + subtest + ': sebaran kunci timpang ' + spread[subtest].at(-1));
  }
}
const widest = (lists: number[][]) => Math.max(...lists.map((counts) => Math.max(...counts) - Math.min(...counts)));
ok(widest(spread.TIU) <= 1, 'Soal TIU yang seluruhnya diacak seimbang (selisih antarhuruf paling banyak satu).');
ok(JSON.stringify(generate(normalizeSettings({ ...DEFAULT_SETTINGS, seed: 'kunci-a' }))) === JSON.stringify(generate(normalizeSettings({ ...DEFAULT_SETTINGS, seed: 'kunci-a' }))), 'Penempatan kunci deterministik per seed.');
// Butir yang posisinya tetap tidak disentuh penyeimbangan.
const fixedKept = pool.flatMap((p) => p.questions).filter(keepsOptionOrder), origin = (q: Question) => q.proof.kind === 'bank' ? BANK_MAP.get(q.proof.id) : undefined;
ok(fixedKept.length > 0 && fixedKept.filter((q) => origin(q)).every((q) => q.answer === origin(q)!.answer), 'Butir dengan posisi tetap mempertahankan urutan opsi aslinya.');
// Opsi berurutan baku tidak diacak: kategori kecukupan data (urutan acuan 2027) dan opsi ordinal ("Sila pertama" … "Sila kelima").
const dataItems = [...pool, ...tryoutPool].flatMap((p) => p.questions).filter((q) => q.options.some((o) => DATA_LABELS.includes(o.text)));
ok(pool.flatMap((p) => p.questions).some((q) => q.family === 'data') && tryoutPool.flatMap((p) => p.questions).some((q) => q.options.some((o) => DATA_LABELS.includes(o.text))) &&
  dataItems.every((q) => q.options.map((o) => o.text).join('|') === DATA_LABELS.join('|')), 'Kategori kecukupan data (pola dan profil tryout) selalu berurutan baku.');
const sila = BANK_MAP.get('twk-case-v2-28')!;
ok(ordinalRanks(sila.options.map((o) => o.text))?.join() === '0,1,2,3,4' && sila.options[sila.answer].score === 5, 'Bank menyusun opsi sila menurut urutan ordinal dan kunci tetap sah.');
const silaSeen: Question[] = [];
for (let n = 0; n < 60 && silaSeen.length < 3; n++) for (const pack of generate(normalizeSettings({ ...DEFAULT_SETTINGS, mode: 'TWK', count: 30, seed: 'sila-' + n }))) silaSeen.push(...pack.questions.filter((q) => q.id === 'twk-case-v2-28'));
ok(silaSeen.length >= 3 && silaSeen.every((q) => ordinalRanks(q.options.map((o) => o.text))?.join() === '0,1,2,3,4' && q.options[q.answer].text === sila.options[sila.answer].text), 'Opsi sila tidak diacak pada paket hasil generate.');
ok(silaSeen.every((q) => q.options.every((o) => sila.options.find((b) => b.text === o.text)?.reason === o.reason && o.reason.trim() !== '')), 'Alasan opsi sila ikut berpindah bersama opsinya.');
// Regresi seleksi seed profil tryout-2027: butir tiap paket sama dengan sebelum tahap 1 (rekaman dari kode sebelum perubahan); sidik jari
// mengabaikan urutan opsi, jadi hanya urutan opsi kecukupan data yang boleh berbeda. Undian acak butir berurutan baku tetap diambil agar seed tidak bergeser.
const hashOf = (text: string) => { let a = 2166136261; for (let i = 0; i < text.length; i++) a = Math.imul(a ^ text.charCodeAt(i), 16777619); return (a >>> 0).toString(16).padStart(8, '0'); };
const TRYOUT_SEED_SNAPSHOT: Record<string, string[]> = {
  // Revisi tahap 4e (rute, silogisme, analogi; baris tryout 13–15 memakai builder baru) dan pembagian lintas paket: keempat nilai diperbarui (keputusan PM yang sama).
  // Profil contoh diterima diperbarui pada revisi tahap 4b (keputusan PM yang sama): soal susunan `posisi` pengganti contoh diterima kini memakai
  // informasi bernomor.
  // Profil contoh diterima diperbarui lagi pada revisi QC tahap 2b (keputusan PM: kebenaran label lebih penting daripada sidik jari): 31 butir TWK contoh tryout
  // direvisi (stem, opsi, alasan, pembahasan, tip; data/tryout-twk-koreksi.json lewat scripts/import-tryouts.py). Pemilihan butir tidak berubah: dengan teks sumber
  // dikembalikan, sidik jarinya sama dengan nilai sebelumnya (8b14dbac, da1a79b2, 8e51eb0e dan 63bcabbc, 7c423918, eb6885b7). Mengubah berkas koreksi mengubah nilai ini.
  // QA akhir 4c–4e (keputusan PM: B1): keacakan tiap pembangkit/pola diisolasi dengan pengacak turunan (lib/rng.ts: isolated; SHARED_DRAWS di lib/tiu.ts dan ROW_DRAWS di
  // lib/tryout-patterns.ts membekukan undian aliran bersama pada nilai sebelum tahap 4) dan percobaan ulang karena sidik jari kembar memakai pengacak turunan (lib/tryout-profile.ts),
  // sehingga pemilihan butir profil tidak bergeser oleh revisi pembangkit. Keempat nilai diperbarui; terhadap HEAD (40 seed × 3 paket) pemilihan identik pada semua paket yang di HEAD
  // tidak memakai coba ulang, dan teks berubah hanya pada butir TWK tahap 2b (baris 3–6, 8) serta baris TIU pola yang direvisi: contoh diterima 16, 18, 50–53; variasi ditambah
  // 13–15 (silogisme baru), 24, 27, 39, dan 48–49 (rupiah bertitik ribuan). Opsi kembar baris 25 dan 26 kini dibedakan tanpa undian baru (hanya mengubah paket yang dahulu gagal).
  // Diperbarui pada Verbal Analitis 29 Okt (keputusan user, Panduan Produksi Soal TIU JadiASN): Susunan & Posisi (baris 18) dan Memperkuat/Memperlemah Argumen (baris 17) memakai pembangkit baru
  // (lib/tiu-posisi.ts, lib/tiu-argumen.ts). Pada profil contoh diterima hanya soal pengganti baris 18 (keluarga posisi, sesudah tiga contoh Uma habis) yang berubah, jadi paket 1 tetap sama
  // dan paket 2 dan 3 berbeda. Dibandingkan butir demi butir dengan keadaan sebelum perubahan (40 seed: tryout dua profil 3 paket, TIU 2 paket, SKD 2 paket; 38.000 butir), 36.852 butir bukan
  // analitis identik (isi, opsi, kunci); yang berbeda hanya butir baris 17 dan 18 serta keluarga posisi dan argumen, dan empat paket yang di keadaan lama memakai coba ulang karena kolisi
  // pembangkit argumen lama (delapan kombinasi saja).
  // Diperbarui pada perbaikan QA 2 Nov (keputusan user): pembahasan dan sebaran bentuk Susunan & Posisi (baris 18, pengganti contoh diterima) berubah; paket 1 tetap sama.
  // Diperbarui pada QC akademik #2 (4 Nov, keputusan user): TKP profil tryout kini dari 144 kasus orisinal, silogisme baris 13-15 selalu dari generator blueprint, revisi contoh TIU (lib/bank/tiu-revisi.ts), dan posisi kunci figural diacak.
  'accepted|sistemik-tryout': ['6e49cc78', '3a905992', '7327de65'], 'accepted|JADIASN-2027': ['0323401c', 'fe2bf99f', '86b4db35'],
  // Profil variasi diperbarui pada revisi tahap 4a (keputusan PM: kebenaran soal lebih penting daripada sidik jari seed): soal kecukupan data
  // baris 27 tidak lagi mengulang pernyataan (1) sebagai (2) dan opsi pecahan baris 24 seragam desimal.
  // Profil variasi diperbarui lagi pada revisi tahap 4c (keputusan PM yang sama): stem baris 18 (susunan posisi) kini bernomor "1. ... 2. ..." supaya pembahasan
  // dapat merujuk "Informasi n", dan deret tingkat sulit menaikkan larik genap di atas suku ke-3 agar tiga panah pertama ↑ ↓ ↑ (2 towew); sidik jari memuat stem dan opsi.
  // Diperbarui sekali lagi pada 4c (keputusan PM yang sama): pengecoh deret kini dari kesalahan konsep (tanpa nol, negatif, atau beda skala) dan opsi soal cerita memakai satuan
  // serta titik ribuan, dengan JKW/VDW berwaktu menit/jam, rata-rata baru berbanyak data ganjil, dan kalimat toko "hanya tersedia di"; sidik jari memuat stem dan opsi.
  // Profil variasi diperbarui pada silogisme blueprint akademik 28 Okt (keputusan user): baris 13–15 kini memakai generator Blueprint Silogisme Tanpa Logika Kuantor (3 Premis, 2 Premis - Narasi,
  // 3 Premis - Narasi; lib/tiu-logika.ts). Dibandingkan dengan sebelum perubahan (30 seed × 3 paket, profil contoh diterima dan variasi, serta paket TIU dan SKD biasa), yang berbeda hanya butir baris
  // 13–15 dan butir keluarga silogisme; seluruh butir lain identik pada posisi yang sama. Profil contoh diterima tidak berubah.
  // Diperbarui lagi pada revisi QA silogisme 28 Okt (pengecoh dan panjang opsi, bahasa, kerangka konteks; keputusan yang sama): dibandingkan butir demi butir dengan keadaan sebelum revisi (26 kelompok seed,
  // 3.915 butir: tryout dua profil, SKD, TIU, TWK, TKP), 3.768 butir bukan silogisme identik (id, keluarga, isi) dan yang berbeda hanya butir baris 13–15 serta keluarga silogisme.
  // Diperbarui lagi pada penyesuaian silogisme 29 Okt (keputusan user, akademik): contoh narasi blueprint dipakai lebih dahulu, kerangka kalimat narasi baru tanpa keterangan rujukan pengisi, Silogisme Biasa
  // tanpa analisis opsi. Dibandingkan butir demi butir dengan keadaan sebelum perubahan (15 kelompok seed: tryout variasi 3 paket dan 5 paket TIU, tryout contoh diterima, SKD, TIU, latihan silogisme),
  // 3.585 butir: 3.424 identik dan 161 berbeda, semuanya butir baris 13–15 atau keluarga silogisme; tidak ada butir lain yang berubah. Profil contoh diterima tidak berubah.
  // Diperbarui pada Verbal Analitis 29 Okt (keputusan user): baris 17 kini dibangkitkan (masuk VARY_ROWS; sebelumnya contoh diterima) dan baris 18 memakai pembangkit Susunan & Posisi baru.
  // Baris 17 tidak mengambil undian dari aliran bersama dan baris 18 berjalan pada pengacak turunan (ROW_DRAWS 18: 18), sehingga butir lain identik dengan keadaan sebelum perubahan.
  // Diperbarui pada perbaikan QA 2 Nov (keputusan user): kalimat kerangka silogisme (baris 13–15), opsi argumen (baris 17), dan Susunan & Posisi (baris 18) ditulis ulang.
  // Diperbarui pada QC akademik #2 (4 Nov, keputusan user): perubahan yang sama dengan profil contoh diterima, ditambah pembangkit TIU yang direvisi (analogi, susunan, deret, tabel).
  'variation|sistemik-tryout': ['3321de01', '9bb763ba', 'e5695753'], 'variation|JADIASN-2027': ['38741822', '3270ca15', '1d1e8254'],
};
for (const [key, expected] of Object.entries(TRYOUT_SEED_SNAPSHOT)) {
  const [tiuSource, seed] = key.split('|') as ['accepted' | 'variation', string];
  const packs = generate(normalizeSettings({ ...DEFAULT_SETTINGS, profile: 'tryout-2027', tiuSource, packages: 3, seed }));
  ok(packs.map((p) => hashOf(p.questions.map((q) => fingerprint(q)).join('\n'))).join() === expected.join(), 'Profil tryout-2027 ' + key + ': butir per paket sama dengan sebelum tahap 1 (selain urutan opsi).');
}
// Daftar soal yang kini tidak diacak karena opsinya berurutan baku (laporan).
const orderedOptionIds = [...new Set([...BANK.filter((q) => q.provenance?.status !== 'accepted-example' && ordinalRanks(q.options.map((o) => o.text))).map((q) => q.id), 'family:data (TIU kecukupan data)', 'tryout row 27 (kecukupan data)'])];
// Pemetaan huruf opsi pada soal referensi: hanya rujukan eksplisit; singkatan nama/gelar tidak berubah (B1: "R.A. Kartini" menjadi "R.C. Kartini").
const swap = [2, 0, 1, 4, 3];
ok(remapOptionLabels('R.A. Kartini; A.H. Nasution; S.H.; D. N. Aidit; Vitamin B; Pasal 36A', swap) === 'R.A. Kartini; A.H. Nasution; S.H.; D. N. Aidit; Vitamin B; Pasal 36A', 'Singkatan nama, huruf lepas, dan huruf dalam kata tidak dipetakan.');
ok(remapOptionLabels('Opsi A dan C benar; opsi B salah. Pilihan E (D) paling tepat.', swap) === 'Opsi B dan A benar; opsi C salah. Pilihan D (E) paling tepat.', 'Rujukan opsi eksplisit dipetakan ke urutan baru.');
ok(remapOptionLabels('B: alasan\nC. alasan lain\nD. N. Aidit mengatakan', swap, true) === 'C: alasan\nA. alasan lain\nD. N. Aidit mengatakan', 'Butir "X." / "X:" hanya dipetakan pada blok alasan per opsi; inisial nama tetap.');
ok(remapOptionLabels('A. Hasyim Muzadi memimpin.\nD. N. Aidit mengatakan.\nB: kata', swap) === 'A. Hasyim Muzadi memimpin.\nD. N. Aidit mengatakan.\nB: kata', 'Pembahasan bebas: awal baris "A. Hasyim Muzadi" / "D. N. Aidit" tidak disentuh.');
ok(remapOptionLabels('Opsi A, B, dan Esai tetap', swap) === 'Opsi B, C, dan Esai tetap', 'Daftar huruf opsi dipetakan tanpa menyentuh kata berawalan huruf kapital.');
ok(remapOptionLabels('Opsi A, B, dan C benar', swap) === 'Opsi B, C, dan A benar', 'Daftar huruf dengan "dan" di ujung dipetakan seluruhnya.');
const shift = [3, 0, 1, 2, 4]; // A→B, B→C, C→D, D→A, E tetap
ok(remapOptionLabels('Opsi A–C benar; opsi A hingga D; pilihan D-E; jawaban B sampai dengan E', shift) === 'Opsi B, C, dan D benar; opsi A, B, C, dan D; pilihan A dan E; jawaban A, C, D, dan E', 'Rentang huruf opsi dipetakan seluruhnya sebagai daftar, tidak setengah-setengah.');
const lineLabelled = BANK.filter((q) => q.id.includes('-ref-') && q.provenance?.status !== 'accepted-example').flatMap((q) => q.options.map((o) => o.reason));
ok(lineLabelled.length > 150 && lineLabelled.every((reason) => remapOptionLabels(reason, shift, true) === remapOptionLabels(reason, shift, false)), 'Aturan butir awal-baris tidak pernah aktif pada alasan opsi bank referensi.');
const initials = (text: string) => text.match(/\b[A-Z]\.(?:\s?[A-Z]\.)+/g) ?? [];
const texts = (q: { stem: string; explanation: string; options: { reason: string }[] }) => [q.stem, q.explanation, ...q.options.map((o) => o.reason)].join('\n');
const referenceMade: Question[] = [];
for (let n = 0; n < 30; n++) for (const pack of generate(normalizeSettings({ ...DEFAULT_SETTINGS, mode: 'TWK', count: 30, seed: 'ra-' + n }))) referenceMade.push(...pack.questions.filter((q) => q.origin === 'referensi' && q.proof.kind === 'bank' && !keepsOptionOrder(q)));
ok(referenceMade.some((q) => q.id === 'twk-ref-1-3'), 'Contoh seed memuat soal referensi twk-ref-1-3 (R.A. Kartini).');
ok(referenceMade.every((q) => !/R\.[B-E]\. Kartini/.test(texts(q)) && initials(texts(q)).join('|') === initials(texts(BANK_MAP.get((q.proof as { id: string }).id)!)).join('|')), 'Soal referensi hasil acak mempertahankan singkatan nama dari sumber.');
// Isu kurasi baru terdeteksi pada soal hasil suntingan.
const sample = pool[0].questions.find((q) => q.subtest === 'TWK' && q.origin === 'kasus')!;
const flagged = (patch: Partial<Question>) => questionIssues({ ...sample, ...patch }).map((i) => i.code);
ok(flagged({ options: sample.options.map((o) => ({ ...o, reason: 'Pilihan yang sesuai dengan penjelasan kunci.' })) }).includes('generic-reason'), 'Alasan generik ditandai pada kurasi.');
ok(flagged({ explanation: sample.explanation + ' Kesulitan Kesulitan Contoh Soal 4 – Level Bloom: C5' }).includes('working-note'), 'Sisa catatan penyusunan ditandai pada kurasi.');
ok(flagged({ explanation: 'Opsi B paling tepat.' }).includes('position-ref') && !flagged({ origin: 'referensi', explanation: 'Opsi B paling tepat.' }).includes('position-ref'), 'Rujukan posisi opsi ditandai, kecuali soal referensi yang hurufnya dipetakan.');
// (e) Daftar peringatan (tidak menggagalkan): pembahasan soal yang diacak yang merujuk huruf atau urutan opsi.
const positional = new Map<string, string[]>();
type Scanned = Pick<Question, 'id' | 'origin' | 'explanation' | 'proof' | 'provenance' | 'options'> & { family?: string };
const bankScanned: Scanned[] = BANK.map((item) => ({ id: item.id, origin: item.id.includes('-ref-') ? 'referensi' : 'kasus', explanation: item.explanation, options: item.options, family: item.id, provenance: item.provenance, proof: { kind: 'bank', id: item.id, answerText: '' } }));
for (const q of [...bankScanned, ...allQuestions]) {
  if (q.origin === 'referensi' || keepsOptionOrder(q)) continue;
  const hits = positionReferences(q.explanation);
  if (hits.length) positional.set(q.id.replace(/-p\d+$/, ''), hits);
}
// Daftar tips yang terbaca sebagai rumus jawaban mutlak (hanya dilaporkan).
const FORMULA = /Apabila soal menyebut|mengarah ke|\bcari (?:kata|opsi)|\bekstrem\b|\bterpanjang\b|paling (?:lengkap|panjang)|\bbiasanya\b|langsung (?:pilih|cari)|hindari (?:opsi|pilihan|jawaban)|\brumus (?:cepat|singkat)\b|jawaban(?:nya)? (?:pasti|selalu)/i;
const formulaTips = [...LOCAL_MODELS.map((m) => [m.id, m.tip] as const), ...BANK.flatMap((q) => q.tip ? [[q.id, q.tip] as const] : [])].filter(([, tip]) => FORMULA.test(tip)).map(([id]) => id);
const range = (lists: number[][]) => lists.length + ' paket, tiap huruf ' + Math.min(...lists.flat()) + '–' + Math.max(...lists.flat());
// Bank TKP baru (Tahap 3): data kasus, tag/skor, panjang opsi, alasan, sebaran per paket: scripts/tkp-checks.ts.
const tkpKasus = runTkpChecks(ok);
// Bank TWK revisi akademik (tahap 2): label, tip, pembahasan, bentuk opsi, dan pasangan eksklusif per paket: scripts/twk-checks.ts.
const twkBank = runTwkChecks(ok);
const report = { status: 'PASS', checks, benchmarkAnchors: anchors.cases.length, academicReview: anchors.status, tkpLegacyFrames: legacyTkp.length, tkpUniqueOptionSets: legacyTkp.length, tkpBestStrictlyLongest: longest, tkpKasus, twk: twkBank, participantData: 'Hanya fixture pengujian; tidak dimasukkan ke aplikasi.',
  keySpread: { TWK: range(spread.TWK), TIU: range(spread.TIU) },
  unshuffledByOrder: orderedOptionIds,
  positionReferenceWarnings: { count: positional.size, ids: [...positional.keys()].slice(0, 25) },
  formulaLikeTips: { count: formulaTips.length, ids: formulaTips.slice(0, 25) } };
// Format pembahasan TIU tahap 4a (komponen bersama, hitung, pecahan, tabel, kecukupan data): scripts/tiu-format-checks.ts.
const tiuFormat = runTiuFormatChecks(ok);
runTiuExportChecks(ok).then((tiuExport) => {
  const full = { ...report, checks, tiuFormat: { generated: tiuFormat.generated, coverage: tiuFormat.coverage, export: tiuExport } };
  mkdirSync('test-results', { recursive: true }); writeFileSync('test-results/quality-report-v2.json', JSON.stringify(full, null, 2)); console.log(JSON.stringify(full, null, 2));
}).catch((error) => { console.error(error); process.exit(1); });
