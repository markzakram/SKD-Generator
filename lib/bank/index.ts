import twkReference from '@/data/twk-reference.json';
import tkpReference from '@/data/tkp-reference.json';
import { tkpCases } from './cases';
import { TKP_KASUS_BANK, TKP_KASUS_TOPICS } from './tkp-kasus';
import { twkCases } from './twk';
import type { BankItem, DifficultyFilter, Subtest } from '../types';
import { keepsOptionReasons, ordinalRanks, withoutGenericReason, withoutOptionReasons } from '../reasons';
import tryoutReference from '@/data/tryout-reference.json';
import { academicText } from '../academic-format';
import { reviseAcceptedTiu } from './tiu-revisi';

// Kalimat pengisi sebagai alasan opsi (mis. "Penjelasan per pilihan tidak dipisahkan dalam sumber") dikosongkan, bukan ditampilkan.
// Soal TIU selain silogisme dan analogi verbal tidak membawa alasan per opsi, apa pun asalnya (contoh diterima, bank, pola).
const withoutGeneric = (item: BankItem): BankItem => {
  const clean = { ...item, options: item.options.map((option) => ({ ...option, reason: withoutGenericReason(option.reason) })) };
  return keepsOptionReasons(clean) ? clean : withoutOptionReasons(clean);
};
// Opsi ordinal ("Sila pertama." sampai "Sila kelima.") disusun menurut urutan bakunya, bukan urutan penulisan (kunci di depan);
// contoh diterima mempertahankan urutan sumbernya.
const ordered = (item: BankItem): BankItem => {
  const ranks = item.provenance?.status === 'accepted-example' ? null : ordinalRanks(item.options.map((option) => option.text));
  if (!ranks) return item;
  const order = ranks.map((rank, index) => ({ rank, index })).sort((a, b) => a.rank - b.rank).map((entry) => entry.index);
  return { ...item, options: order.map((index) => item.options[index]), answer: order.indexOf(item.answer) };
};
// Kerangka TKP lama (cases.ts) hanya dipakai untuk kompetensi yang belum punya berkas di data/tkp-kasus/; begitu berkasnya terisi, kerangka lamanya
// otomatis tidak dipakai lagi.
const legacyTkpCases = tkpCases.filter((item) => !TKP_KASUS_TOPICS.has(item.topic));
// Contoh TIU diterima melewati revisi QC akademik #2 (lib/bank/tiu-revisi.ts) sesudah format sumber dipulihkan.
export const ACCEPTED_BANK = (tryoutReference as BankItem[]).map(item => ({ ...item, explanation: academicText(item, item.explanation), options: item.options.map(option => ({ ...option, reason: academicText(item, option.reason) })) })).map(reviseAcceptedTiu).map(withoutGeneric);
export const BANK: BankItem[] = [...ACCEPTED_BANK, ...twkReference as BankItem[], ...twkCases, ...tkpReference as BankItem[], ...legacyTkpCases, ...TKP_KASUS_BANK].map(withoutGeneric).map(ordered).map((item) => ({
  ...item, difficulty: item.difficulty === 'hots' ? 'sulit' : item.difficulty,
  difficultyReason: item.difficultyReason ?? 'Estimasi dari referensi; cocokkan kompleksitas penalaran saat kurasi. Belum dikalibrasi dari peserta.',
}));
export const BANK_MAP = new Map(BANK.map((item) => [item.id, item]));
export const bankFor = (subtest: Subtest, topics: string[], difficulty: DifficultyFilter, subtopics: string[] = []) =>
  BANK.filter((item) => item.subtest === subtest && (!topics.length || topics.includes(item.topic)) &&
    (difficulty === 'campuran' || item.difficulty === difficulty) &&
    (!subtopics.length || subtopics.includes(item.topic + '::' + item.subtopic)));
export const bankStats = () => {
  return ['TWK', 'TIU', 'TKP'].map((subtest) => {
    const items = BANK.filter((item) => item.subtest === subtest);
    return { subtest, count: items.length, reference: items.filter((item) => item.id.includes('-ref-')).length,
      accepted: items.filter((item) => item.provenance?.status === 'accepted-example').length,
      subtopics: new Set(items.map((item) => item.subtopic)).size };
  });
};
