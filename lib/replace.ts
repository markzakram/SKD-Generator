import { DEFAULT_SETTINGS } from './config';
import { clashesExclusive, exclusiveGroupOf, fingerprint, generate } from './generate';
import { replaceLocalQuestion, usesLocal } from './local';
import { rng } from './rng';
import { replaceMappedQuestion } from './tryout-profile';
import type { Question, Result, Settings } from './types';
import { constrainNarrativePackage } from './silo-production';

// Mengganti satu atau beberapa nomor pada satu paket (tombol "Ganti nomor ini" dan "Ganti nomor terpilih"). Murni: tidak menyentuh penyimpanan;
// pemanggil (app/page.tsx) menyimpan hasilnya sebagai satu versi workspace baru, sehingga tersimpan di IndexedDB seperti suntingan lain.
export const REPLACE_ATTEMPTS = 80;
export const NO_UNIQUE_REPLACEMENT = 'Stok habis: tidak ada pengganti unik untuk submateri dan tingkat ini. Perluas blueprint atau sunting soal yang ada.';
export type ReplaceFailure = { id: string; no: number; reason: string };
export type ReplaceOutcome = { result: Result; replaced: Question[]; failed: ReplaceFailure[] };

// Satu pengganti untuk `q`: submateri dan tingkat sama, bukan soal yang sama, tidak kembar dengan soal mana pun di `peers` (semua paket),
// dan tidak membawa soal eksklusif yang pasangannya sudah ada di paket yang sama (`siblings`). Melempar galat bila stok habis.
export function findReplacement(q: Question, peers: Question[], siblings: Question[], settings: Settings, seed: string): Question {
  const taken = new Set(peers.map(fingerprint)), own = fingerprint(q);
  for (let i = 0; i < REPLACE_ATTEMPTS; i++) {
    let next = q.proof.kind === 'local' || usesLocal(settings, q.subtest) ? replaceLocalQuestion(q, peers, rng(seed + '-' + i))
      : q.mappingId ? replaceMappedQuestion(q, peers, seed + '-' + i, fingerprint, !!settings.chapterCounts)
        : generate({ ...DEFAULT_SETTINGS, mode: q.subtest, count: 1, difficulty: q.difficulty === 'hots' ? 'sulit' : q.difficulty, topics: [q.topic], subtopics: settings.subtopics.filter((s) => s.startsWith(q.topic + '::')), seed: seed + '-replace-' + i })[0].questions[0];
    if (q.mappingId) { next.mappingId = q.mappingId; if (next.subtopic !== q.subtopic && !(settings.chapterCounts && q.subtest === 'TKP')) continue; } // TKP: chapter mapping = kompetensi, submaterinya boleh lain pada jumlah per chapter
    next = constrainNarrativePackage([...siblings.filter((other) => other.id !== q.id), next]).at(-1)!;
    const print = fingerprint(next);
    const group = settings.chapterCounts ? exclusiveGroupOf(next) : undefined;
    if (print !== own && !taken.has(print) && !clashesExclusive(next, siblings, q.id) && !(group && siblings.some((other) => other.id !== q.id && exclusiveGroupOf(other) === group))) return next;
  }
  throw new Error(NO_UNIQUE_REPLACEMENT);
}

// Mengganti soal bernomor `ids` pada paket `packageId`, berurutan menurut nomor. Setiap pengganti langsung masuk ke daftar `peers` soal berikutnya,
// jadi pengganti tidak saling kembar dan tidak sama dengan soal lain di semua paket. Id, nomor, dan urutan soal tidak berubah.
// Nomor yang gagal tidak menghentikan yang lain; alasannya dicatat di `failed`.
export function replaceQuestions(result: Result, packageId: string, ids: readonly string[], seed: string): ReplaceOutcome {
  const target = result.packages.findIndex((p) => p.id === packageId);
  if (target < 0) throw new Error('Paket tidak ditemukan.');
  const wanted = new Set(ids), replaced: Question[] = [], failed: ReplaceFailure[] = [];
  let packages = result.packages;
  for (let at = 0; at < result.packages[target].questions.length; at++) {
    const current = packages[target].questions[at];
    if (!wanted.has(current.id)) continue;
    const peers = packages.flatMap((p) => p.questions).filter((other) => other !== current);
    try {
      const next = findReplacement(current, peers, packages[target].questions, result.settings, seed + '-' + current.id);
      const question: Question = { ...next, id: current.id, no: current.no, review: { status: 'draft', excluded: false, note: '', revision: (current.review?.revision ?? 1) + 1, updatedAt: new Date().toISOString() } };
      packages = packages.map((p, pi) => pi === target ? { ...p, questions: p.questions.map((item, index) => index === at ? question : item) } : p);
      replaced.push(question);
    } catch (e) { failed.push({ id: current.id, no: current.no, reason: e instanceof Error ? e.message : 'Penggantian gagal.' }); }
  }
  return { result: { ...result, packages }, replaced, failed };
}

// Ringkasan untuk pengguna: "3 nomor diganti (4, 7, 9)." dan, bila ada yang gagal, nomor-nomornya dikelompokkan per alasan.
export function replaceMessages(outcome: Pick<ReplaceOutcome, 'replaced' | 'failed'>): { notice: string; error: string } {
  const list = (numbers: number[]) => numbers.length <= 15 ? ' (' + numbers.join(', ') + ')' : '';
  const reasons = new Map<string, number[]>();
  for (const item of outcome.failed) reasons.set(item.reason, [...(reasons.get(item.reason) ?? []), item.no]);
  return {
    notice: outcome.replaced.length ? outcome.replaced.length + ' nomor diganti' + list(outcome.replaced.map((q) => q.no)) + '. Versi sebelumnya tersimpan dalam riwayat versi.' : '',
    error: outcome.failed.length ? outcome.failed.length + ' nomor gagal diganti: ' + [...reasons].map(([reason, numbers]) => 'nomor ' + numbers.join(', ') + ' (' + reason + ')').join('; ') + '.' : '',
  };
}
