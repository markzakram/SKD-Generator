export type Subtest = 'TWK' | 'TIU' | 'TKP';
export type Mode = Subtest | 'SKD';
export type Difficulty = 'mudah' | 'sedang' | 'sulit' | 'hots';
export type DifficultyFilter = Difficulty | 'campuran';
export type ExportContent = 'soal' | 'kunci' | 'pembahasan';

export type Figure = {
  shape: 'triangle' | 'square' | 'circle' | 'diamond';
  count: number;
  angle: number;
  fill: number;
};
export type Visual = {
  kind: 'analogi' | 'serial' | 'ketidaksamaan' | 'matriks';
  columns: number;
  figures: (Figure | null)[];
};
export type Option = { text: string; score: number; reason: string; figure?: Figure };
export type Proof =
  | { kind: 'numeric'; values: number[]; answer: number; expression?: string }
  | { kind: 'logic'; valid: boolean[]; entailment?: { premises: import('./solver').Logic[]; conclusions: import('./solver').Logic[] } }
  | { kind: 'figure'; answer: Figure; odd?: boolean }
  | { kind: 'bank'; id: string; answerText: string };
export type Question = {
  id: string;
  no: number;
  subtest: Subtest;
  topic: string;
  subtopic: string;
  difficulty: Difficulty;
  bloom?: string;
  family: string;
  stem: string;
  options: Option[];
  answer: number;
  explanation: string;
  tip?: string;
  source: string;
  origin: 'referensi' | 'pola' | 'kasus';
  table?: { headers: string[]; rows: string[][] };
  visual?: Visual;
  proof: Proof;
};
export type Package = { id: string; seed: string; mode: Mode; duration: number; questions: Question[] };
export type Settings = {
  mode: Mode;
  packages: number;
  count: number;
  difficulty: DifficultyFilter;
  topics: string[];
  subtopics: string[];
  seed: string;
  title: string;
  duration: number;
  uniqueAcross: boolean;
};
export type Audit = { ok: boolean; checked: number; errors: string[]; duplicateCount: number; keyDistribution: number[] };
export type Result = { settings: Settings; packages: Package[]; audit: Audit; elapsed: number };
export type BankItem = {
  id: string;
  subtest: 'TWK' | 'TKP';
  topic: string;
  subtopic: string;
  difficulty: Difficulty;
  bloom?: string;
  stem: string;
  options: Option[];
  answer: number;
  explanation: string;
  source: string;
};
