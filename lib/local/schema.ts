import type { Difficulty, Rubric } from '../types';

// Contexts supply domain-specific tasks; states change the decisive facts and ranking.
// These are finite authored decision models, not an AI or a calibrated psychometric test.
export type Context = { intro: string; [key: string]: string };
export type State = {
  fact: string; difficulty: Difficulty; scores: [number, number, number, number, number];
  reasons: [string, string, string, string, string]; conclusion: string;
  actions?: [string, string, string, string, string];
  prompt?: string;
};
export type CaseModel = {
  id: string; subtest: 'TWK' | 'TKP'; topic: string; chapter: string;
  concept: string; source: string; prompt: string; tip: string;
  contexts: Context[]; actions: [string, string, string, string, string]; states: State[];
  rubric?: Rubric;
};
export const UUD = 'Prinsip konstitusi: UUD NRI 1945, JDIH DPR RI — https://jdih.dpr.go.id/index/uu1945';
export const TKP_SOURCE = 'Model keputusan lokal; acuan kedalaman kasus dan pembahasan: tiga tryout TKP pengguna. Peringkat merupakan rubrik penulis, bukan kunci resmi BKN.';
export function fill(text: string, context: Context) {
  return text.replace(/\{([a-z]+)\}/g, (_, key: string) => {
    if (!(key in context)) throw new Error('Parameter konteks tidak tersedia: '+key);
    return context[key];
  });
}
