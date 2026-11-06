// Pemeriksaan "Ganti nomor ini" / "Ganti nomor terpilih" (lib/replace.ts) dan saklar kurasi (lib/config.ts: KURASI_AKTIF) pada cakupan ekspor,
// judul ekspor, dan uji peserta. Dipanggil dari scripts/verify.ts. Label draf pada PDF/Word diperiksa di scripts/take-checks.ts (butuh peramban tiruan).
// Penyimpanan IndexedDB tidak bisa dijalankan di Node; yang diperiksa: penggantian menjadi satu versi workspace baru yang lolos serialisasi cadangan,
// dan kunci/urutan nomor tidak berubah, sehingga cara menyimpannya sama dengan suntingan soal.
import assert from 'node:assert/strict';
import { readBackup } from '../lib/backup';
import { DEFAULT_SETTINGS, KURASI_AKTIF } from '../lib/config';
import { exportTitle } from '../lib/export';
import { fingerprint, generate, normalizeSettings } from '../lib/generate';
import { LOCAL_RECIPES, makeLocal } from '../lib/local';
import { createWorkspace, exportPackages, exportScope, reviseWorkspace, setReview, shareable } from '../lib/quality';
import { NO_UNIQUE_REPLACEMENT, replaceMessages, replaceQuestions } from '../lib/replace';
import { rng } from '../lib/rng';
import { PROFILE_SETTINGS } from '../lib/tryout-profile';
import type { Package, Question, Settings } from '../lib/types';
import { auditPackages, auditQuestion } from '../lib/validate';

type Check = (condition: unknown, message: string) => void;
const workspaceOf = (settings: Settings, packages: Package[]) => createWorkspace({ settings, packages, audit: auditPackages(packages, settings), elapsed: 0 });
const prints = (packages: Package[]) => packages.flatMap((p) => p.questions.map(fingerprint));

export function runReplaceChecks(check: Check) {
  let replacedTotal = 0, failedTotal = 0;

  // 1. Paket tryout 2027 seperti bawaan aplikasi (TWK model lokal, TIU dan TKP dari contoh): dua paket, 16 nomor terpilih sekaligus -----------------------
  const settings = normalizeSettings({ ...DEFAULT_SETTINGS, ...PROFILE_SETTINGS, twkSource: 'new', tkpSource: 'accepted', packages: 2 });
  const workspace = workspaceOf(settings, generate(settings)), before = workspace.result.packages, pack = before[0];
  const ids = pack.questions.filter((_, i) => i % 7 === 0).map((q) => q.id), seed = workspace.id + '-' + workspace.version;
  const outcome = replaceQuestions(workspace.result, pack.id, ids, seed), after = outcome.result.packages;
  replacedTotal += outcome.replaced.length; failedTotal += outcome.failed.length;
  check(ids.length === 16 && outcome.replaced.length + outcome.failed.length === ids.length && outcome.replaced.length > 0, 'Ganti nomor terpilih: tiap nomor terpilih diganti atau dilaporkan gagal (diganti ' + outcome.replaced.length + ', gagal ' + outcome.failed.length + ')');
  check(outcome.failed.every((f) => f.reason.trim() !== '' && ids.includes(f.id)), 'Nomor yang gagal disebut beserta alasannya');
  check(after[0].questions.map((q) => q.no + ':' + q.id).join() === pack.questions.map((q) => q.no + ':' + q.id).join() && after[0].questions.every((q, i) => q.no === i + 1), 'Nomor dan id soal tidak berubah urutan');
  check(after[0].questions.every((q, i) => ids.includes(q.id) && outcome.replaced.some((r) => r.id === q.id) ? q !== pack.questions[i] : q === pack.questions[i]), 'Hanya nomor yang berhasil diganti yang berubah; nomor lain dan nomor yang gagal tetap objek semula');
  check(after[1] === before[1] && outcome.result.settings === workspace.result.settings, 'Paket lain dan pengaturan tidak disentuh');
  const original = (id: string) => pack.questions.find((q) => q.id === id)!;
  check(outcome.replaced.every((r) => { const o = original(r.id); return r.no === o.no && r.subtest === o.subtest && r.topic === o.topic && r.difficulty === o.difficulty && r.subtopic === o.subtopic && !!r.mappingId && r.mappingId === o.mappingId; }), 'Pengganti dari chapter, subtes, dan tingkat yang sama; nomor tetap');
  check(outcome.replaced.every((r) => r.review?.status === 'draft' && r.review.excluded === false && r.review.revision === (original(r.id).review?.revision ?? 1) + 1), 'Pengganti memakai nomor revisi berikutnya sehingga respons uji lama tidak tercampur');
  const all = prints(after);
  check(new Set(all).size === all.length && new Set(prints(before)).size === all.length, 'Tanpa duplikat di seluruh paket setelah penggantian (pengganti tidak kembar satu sama lain maupun dengan soal lain)');
  check(outcome.replaced.every((r) => fingerprint(r) !== fingerprint(original(r.id))) && outcome.replaced.every((r) => auditQuestion(r).length === 0), 'Pengganti berbeda dari soal asal dan lolos audit soal');
  check(auditPackages(after, settings).ok, 'Paket hasil penggantian tetap lolos audit kuota dan duplikasi');
  const again = replaceQuestions(workspace.result, pack.id, ids, seed);
  check(again.replaced.map((q) => fingerprint(q)).join('|') === outcome.replaced.map((q) => fingerprint(q)).join('|') && again.failed.length === outcome.failed.length, 'Seed yang sama menghasilkan penggantian yang sama');
  // Satu versi workspace baru: sama seperti suntingan soal, jadi ikut tersimpan dan bisa dipulihkan dari riwayat.
  const revised = reviseWorkspace(workspace, outcome.result, 'Mengganti ' + outcome.replaced.length + ' nomor');
  check(revised.version === workspace.version + 1 && revised.snapshots.at(-1)?.result === workspace.result, 'Penggantian menjadi satu versi baru dan versi sebelumnya masuk riwayat');
  const restored = readBackup(JSON.stringify(revised));
  check(restored.result.packages[0].questions.map(fingerprint).join('|') === after[0].questions.map(fingerprint).join('|') && restored.result.packages[0].questions.every((q, i) => q.no === i + 1), 'Hasil penggantian lolos serialisasi dan validasi cadangan dengan urutan nomor utuh');
  // Satu nomor lewat jalur yang sama (tombol "Ganti nomor ini").
  const single = replaceQuestions(workspace.result, pack.id, [pack.questions[3].id], seed);
  replacedTotal += single.replaced.length; failedTotal += single.failed.length;
  check(single.replaced.length === 1 && single.replaced[0].no === 4 && single.result.packages[0].questions.filter((q, i) => q !== pack.questions[i]).length === 1, 'Ganti nomor ini: tepat satu nomor berubah dan nomornya tetap');

  // 2. Persediaan menipis: pengganti yang baru jadi harus ikut dihitung sebagai soal lain (kalau tidak, dua nomor mendapat pengganti kembar) -------------------
  // Dua kelompok model lokal dengan 6 resep pada satu chapter dan tingkat. Resep soal yang diganti terbebas untuk nomor berikutnya, jadi tiap nomor mengambil
  // resep yang tersisa atau yang baru dilepas; bila semua 6 resep sudah terpakai di paket, nomor itu gagal dengan alasan stok habis.
  const groups = new Map<string, typeof LOCAL_RECIPES>();
  for (const r of LOCAL_RECIPES) { const key = [r.subtest, r.topic, r.subtopic, r.difficulty].join('|'); groups.set(key, [...(groups.get(key) ?? []), r]); }
  const [groupA, groupB] = [...groups.values()].filter((g) => g.length === 6 && g[0].subtest === 'TWK');
  const tightSettings = normalizeSettings({ ...DEFAULT_SETTINGS, mode: 'TWK', count: 11, twkSource: 'new' });
  const tightOf = (recipes: typeof LOCAL_RECIPES) => {
    const questions = recipes.map((recipe, i): Question => ({ ...makeLocal(recipe, rng('stok-' + i + recipe.key)), id: 'stok-' + i, no: i + 1 }));
    const tightPack: Package = { id: 'STOK-01', seed: 'stok', mode: 'TWK', duration: 10, questions };
    return { questions, result: { settings: tightSettings, packages: [tightPack], audit: auditPackages([tightPack], tightSettings), elapsed: 0 } };
  };
  const keyOf = (q: Question) => q.proof.kind === 'local' ? [q.proof.model, q.proof.context, q.proof.state].join(':') : q.id;
  const five = tightOf(groupA.slice(0, 5)), pair = replaceQuestions(five.result, 'STOK-01', ['stok-0', 'stok-1'], 'stok');
  replacedTotal += pair.replaced.length; failedTotal += pair.failed.length;
  const pairKeys = pair.result.packages[0].questions.map(keyOf);
  check(pair.replaced.length === 2 && pair.failed.length === 0 && new Set(pairKeys).size === 5 && keyOf(pair.replaced[0]) === groupA[5].key && keyOf(pair.replaced[1]) === groupA[0].key, 'Pengganti pertama dihitung sebagai peers: nomor kedua tidak mendapat pengganti kembar, melainkan resep yang baru dilepas nomor pertama');
  check(pair.result.packages[0].questions.every((q, i) => q.no === i + 1 && q.id === 'stok-' + i) && pair.replaced.every((r) => r.subtopic === groupA[0].subtopic && r.difficulty === groupA[0].difficulty && r.topic === groupA[0].topic), 'Pengganti dari chapter dan tingkat yang sama; nomor dan id tetap');
  const mixed = tightOf([...groupA, ...groupB.slice(0, 5)]), fullPack = replaceQuestions(mixed.result, 'STOK-01', ['stok-0', 'stok-6'], 'stok');
  replacedTotal += fullPack.replaced.length; failedTotal += fullPack.failed.length;
  check(fullPack.replaced.length === 1 && fullPack.replaced[0].id === 'stok-6' && fullPack.failed.length === 1 && fullPack.failed[0].id === 'stok-0' && fullPack.failed[0].no === 1 && /habis/.test(fullPack.failed[0].reason), 'Stok habis: nomor yang chapternya terpakai penuh gagal dengan alasan stok habis, nomor lain tetap diganti');
  check(fullPack.result.packages[0].questions[0] === mixed.questions[0] && fullPack.result.packages[0].questions[6] !== mixed.questions[6] && fullPack.result.packages[0].questions.slice(1, 6).every((q, i) => q === mixed.questions[i + 1]), 'Nomor yang gagal dan yang tidak dipilih tetap soal semula');
  const everyone = replaceQuestions(mixed.result, 'STOK-01', mixed.questions.map((q) => q.id), 'stok');
  replacedTotal += everyone.replaced.length; failedTotal += everyone.failed.length;
  const everyoneKeys = everyone.result.packages[0].questions.map(keyOf);
  check(everyone.replaced.length === 5 && everyone.failed.length === 6 && everyone.failed.every((f) => f.no <= 6) && new Set(everyoneKeys).size === 11, 'Mengganti semua nomor: lima dari chapter yang masih punya stok berhasil, enam dari chapter yang habis gagal, tidak ada soal kembar');
  const messages = replaceMessages(fullPack);
  check(messages.notice.startsWith('1 nomor diganti (7).') && messages.error.startsWith('1 nomor gagal diganti: nomor 1 (') && /habis/.test(messages.error), 'Ringkasan menyebut nomor yang diganti dan nomor yang gagal beserta alasannya');
  check(replaceMessages({ replaced: outcome.replaced.slice(0, 3), failed: [] }).notice.startsWith('3 nomor diganti (' + outcome.replaced.slice(0, 3).map((q) => q.no).join(', ') + ').') && replaceMessages({ replaced: [], failed: [] }).notice === '' && replaceMessages({ replaced: [], failed: [] }).error === '', 'Ringkasan "3 nomor diganti" tanpa galat bila semuanya berhasil');
  const grouped = replaceMessages({ replaced: [], failed: [{ id: 'a', no: 4, reason: NO_UNIQUE_REPLACEMENT }, { id: 'b', no: 9, reason: NO_UNIQUE_REPLACEMENT }, { id: 'c', no: 12, reason: 'alasan lain' }] }).error;
  check(grouped.startsWith('3 nomor gagal diganti: nomor 4, 9 (Stok habis') && grouped.includes('nomor 12 (alasan lain)'), 'Nomor yang gagal dengan alasan sama dikelompokkan');
  assert.throws(() => replaceQuestions(workspace.result, 'TIDAK-ADA', ids, seed), /Paket tidak ditemukan/); check(true, 'Paket yang tidak ada ditolak');

  // 3. Latihan bebas (tanpa mapping): materi dan tingkat sama, tidak kembar -----------------------------------------------------------------------------
  const freeSettings = normalizeSettings({ ...DEFAULT_SETTINGS, mode: 'TIU', count: 12, topics: ['Numerik'], seed: 'ganti-bebas' }), freePacks = generate(freeSettings);
  const free = replaceQuestions({ settings: freeSettings, packages: freePacks, audit: auditPackages(freePacks, freeSettings), elapsed: 0 }, freePacks[0].id, freePacks[0].questions.filter((_, i) => i % 2 === 0).map((q) => q.id), 'bebas');
  replacedTotal += free.replaced.length; failedTotal += free.failed.length;
  const freePrints = prints(free.result.packages);
  check(free.replaced.length + free.failed.length === 6 && free.replaced.length > 0 && free.replaced.every((r) => { const o = freePacks[0].questions.find((q) => q.id === r.id)!; return r.no === o.no && r.topic === o.topic && r.difficulty === o.difficulty && r.subtest === o.subtest; }) && new Set(freePrints).size === freePrints.length, 'Latihan bebas: enam nomor, materi dan tingkat sama, tanpa duplikat');

  // 4. Saklar kurasi: cakupan ekspor, judul, dan uji peserta ---------------------------------------------------------------------------------------------
  check(exportScope('approved', false) === 'draft' && exportScope('draft', false) === 'draft' && exportScope('approved', true) === 'approved' && exportScope('draft', true) === 'draft' && exportScope('approved') === (KURASI_AKTIF ? 'approved' : 'draft'), 'Cakupan ekspor: semua soal aktif saat kurasi dimatikan, pilihan pengguna saat dihidupkan');
  check(exportTitle('Judul', 'draft', false) === 'Judul' && exportTitle('Judul', 'approved', false) === 'Judul' && exportTitle('Judul', 'draft', true) === 'Judul — Draf kurasi' && exportTitle('Judul', 'approved', true) === 'Judul' && exportTitle('Judul', 'draft') === (KURASI_AKTIF ? 'Judul — Draf kurasi' : 'Judul'), 'Judul ekspor tanpa " — Draf kurasi" saat kurasi dimatikan');
  const open = exportPackages(workspace.result, exportScope('approved', false));
  check(open.length === 2 && open.every((p) => p.questions.length === 110 && p.questions.every((q, i) => q.no === i + 1)), 'Ekspor saat kurasi dimatikan memuat seluruh 110 soal tiap paket tanpa soal yang belum disetujui dilewati');
  assert.throws(() => exportPackages(workspace.result, exportScope('approved', true)), /Belum/); check(true, 'Jalur kurasi tetap menolak ekspor tanpa soal disetujui');
  const flagged = structuredClone(workspace.result); flagged.packages[0].questions[0].review!.excluded = true;
  check(exportPackages(flagged, exportScope('approved', false))[0].questions.length === 109, 'Soal yang ditandai dikeluarkan pada workspace lama tetap dilewati saat ekspor');
  const approvedOne = setReview(pack.questions.find((q) => ['numeric', 'model', 'scene', 'figure'].includes(q.proof.kind))!, 'approved', 'Diperiksa.', 'QA');
  check(shareable(pack.questions[0], false) && shareable(approvedOne, false) && !shareable(pack.questions[0], true) && shareable(approvedOne, true) && !shareable({ ...approvedOne, review: { ...approvedOne.review!, excluded: true } }, false), 'Soal untuk uji peserta: semua soal aktif saat kurasi dimatikan, hanya yang disetujui saat dihidupkan');
  // Data lama: workspace dengan status dan penelaah tetap termuat dan terekspor.
  const legacy = structuredClone(workspace); legacy.result.packages[0].questions[pack.questions.findIndex((q) => q.id === approvedOne.id)] = approvedOne;
  const legacyBack = readBackup(JSON.stringify(legacy));
  const legacyOne = legacyBack.result.packages[0].questions.find((q) => q.id === approvedOne.id)!;
  check(legacyOne.review?.status === 'approved' && legacyOne.review.reviewer === 'QA' && exportPackages(legacyBack.result, exportScope('approved', false))[0].questions.length === 110, 'Workspace lama dengan data review tetap dimuat dan diekspor lengkap');

  return { replaced: replacedTotal, failed: failedTotal, packages: before.length, selected: ids.length };
}
