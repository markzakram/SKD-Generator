import { rng, type Rng } from '../rng';
import type { Difficulty, Option, Proof, Question, Visual } from '../types';
import { reasonOf, type Built } from './compose';
import { buildAnalogi } from './analogi';
import { buildMatrix } from './matrix';
import { buildOdd } from './odd';
import { buildSerial } from './serial';
import { solveScene } from './solve';

export { solveScene } from './solve';
export { STEMS, LEAK } from './stems';

// Bagian butir soal yang dihasilkan mesin figural; sisanya dilengkapi oleh pemanggil (lib/tiu.ts).
export type FiguralDraft = Pick<Question, 'stem' | 'options' | 'answer' | 'explanation' | 'difficultyReason' | 'bloom'> & { visual: Visual; proof: Proof };
const BUILDERS: Record<string, (a: Rng, level: Difficulty) => Built | null> = {
  'fig-analogi': buildAnalogi,
  'fig-matrix': buildMatrix,
  'fig-odd': buildOdd,
  'fig-serial': buildSerial,
};
export const FIGURAL_FAMILIES = Object.keys(BUILDERS);

function assemble(built: Built): FiguralDraft {
  const reasons = built.reasons ?? [built.keyReason, ...built.wrong.map((w) => reasonOf(built.key, w, built.namer!))];
  const scenes = built.options ?? [built.key, ...built.wrong.map((w) => w.scene)], answer = built.answer ?? 0;
  const options: Option[] = scenes.map((scene, i) => ({ text: 'Gambar ' + (i + 1), score: i === answer ? 5 : 0, reason: reasons[i], scene }));
  return {
    stem: built.stem, options, answer, explanation: built.explanation, difficultyReason: built.difficultyReason, bloom: 'C4',
    visual: { kind: built.kind, columns: built.columns, figures: [], scenes: built.scenes, rule: built.rule },
    proof: { kind: 'scene', mekanisme: built.rule.mekanisme },
  };
}
// Menyusun satu soal figural. Pembangkit dijalankan dengan pengacak turunan supaya jumlah undian dari `r` selalu satu
// (hasil tetap deterministik per seed walau penyusunan perlu mengulang). Setiap hasil dibuktikan ulang oleh validator.
export function makeFigural(family: string, level: Difficulty, r: Rng): FiguralDraft {
  const build = BUILDERS[family];
  if (!build) throw new Error('Keluarga figural tidak dikenal: ' + family);
  const seed = r.int(0, 0x3fffffff);
  let lastError = '';
  for (let attempt = 0; attempt < 80; attempt++) {
    const built = build(rng('fig|' + family + '|' + level + '|' + seed + '|' + attempt), level);
    if (!built) continue;
    const draft = assemble(built), proof = solveScene({ stem: draft.stem, options: draft.options, visual: draft.visual } as Question);
    if (!proof.errors.length && proof.answer === draft.answer) return draft;
    lastError = proof.errors[0] ?? 'kunci tidak cocok';
  }
  throw new Error('Soal figural ' + family + ' (' + level + ') tidak berhasil disusun: ' + lastError);
}
