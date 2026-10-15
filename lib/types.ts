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
  oddRule?: 'attribute' | 'count-fill' | 'turn-count';
};
export type Option = { text: string; score: number; reason: string; figure?: Figure };
export type Proof =
  | { kind: 'numeric'; values: number[]; answer: number; expression?: string }
  | { kind: 'logic'; valid: boolean[]; entailment?: { premises: import('./solver').Logic[]; conclusions: import('./solver').Logic[] } }
  | { kind: 'figure'; answer: Figure; odd?: boolean }
  | { kind: 'bank'; id: string; answerText: string }
  | { kind: 'model'; model: import('./models').Model }
  | { kind: 'manual'; note: string };
export type ReviewStatus = 'draft' | 'revision' | 'approved';
export type Review = { status: ReviewStatus; excluded: boolean; note: string; revision: number; reviewedAt?: string; reviewer?: string; updatedAt: string };
export type Rubric = { authority: string; urgency: string; efficacy: string; risk: string; followUp: string };
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
  binding?: string;
  difficultyReason?: string;
  rubric?: Rubric;
  review?: Review;
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
  blueprint?: BlueprintRow[];
  composition?: { mudah: number; sedang: number; sulit: number };
};
export type BlueprintRow = { subtest: Subtest; topic: string; difficulty: Difficulty; count: number };
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
  difficultyReason?: string;
  rubric?: Rubric;
};
export type Snapshot = { version: number; at: string; label: string; result: Result };
export type Workspace = { schema: 2; id: string; name: string; createdAt: string; updatedAt: string; version: number; result: Result; snapshots: Snapshot[] };
export type PilotAnswer = { questionId: string; revision: number; hash: string; choice: number | null; seconds: number };
export type PilotSession = { id: string; workspaceId: string; version: number; packageId: string; participant: string; finishedAt: string; answers: PilotAnswer[] };
