import twkReference from '@/data/twk-reference.json';
import tkpReference from '@/data/tkp-reference.json';
import { tkpCases } from './cases';
import { twkCases } from './twk';
import type { BankItem, DifficultyFilter, Subtest } from '../types';
import tryoutReference from '@/data/tryout-reference.json';

export const ACCEPTED_BANK = tryoutReference as BankItem[];
export const BANK: BankItem[] = [...ACCEPTED_BANK, ...twkReference as BankItem[], ...twkCases, ...tkpReference as BankItem[], ...tkpCases].map((item) => ({
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
