import { rng, type Rng } from '../rng';
import type { Difficulty, Option, Proof, Question, Visual } from '../types';
import type { Built } from './compose';
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
  const scenes = built.options ?? [built.key, ...built.wrong.map((w) => w.scene)], answer = built.answer ?? 0;
  // Soal figural tidak memuat alasan per opsi; pembahasan menguraikan aturannya, jadi `reason` dibiarkan kosong.
  const options: Option[] = scenes.map((scene, i) => ({ text: 'Gambar ' + (i + 1), score: i === answer ? 5 : 0, reason: '', scene }));
  return {
    stem: built.stem, options, answer, explanation: built.explanation, difficultyReason: built.difficultyReason, bloom: 'C4',
    visual: { kind: built.kind, columns: built.columns, figures: [], scenes: built.scenes, rule: built.rule },
    proof: { kind: 'scene', mekanisme: built.rule.mekanisme },
  };
}
// Posisi kunci figural (QC akademik #2, 3 Nov): pembangkit menaruh kunci di depan, dan profil tryout tidak mengacak opsi, sehingga kunci figural menumpuk di A.
// Kunci dipindah ke `keyAt`; opsi lain tetap berurutan dan label "Gambar n" mengikuti posisi barunya. Pembahasan figural tidak memuat huruf mati (penanda {kunci}
// dan kotak opsi diisi menurut susunan opsi saat tampil), jadi pembahasan, label, dan gambar tetap sesuai.
export function placeFiguralKey<T extends Pick<Question, 'options' | 'answer'>>(q: T, keyAt: number): T {
  const rest = q.options.map((_, i) => i).filter((i) => i !== q.answer), order = [...rest.slice(0, keyAt), q.answer, ...rest.slice(keyAt)];
  return { ...q, options: order.map((i, at) => ({ ...q.options[i], text: 'Gambar ' + (at + 1), score: i === q.answer ? 5 : 0 })), answer: keyAt };
}
// Menyusun satu soal figural. Pembangkit dijalankan dengan pengacak turunan supaya jumlah undian dari `r` selalu satu
// (hasil tetap deterministik per seed walau penyusunan perlu mengulang). Setiap hasil dibuktikan ulang oleh validator.
export function makeFigural(family: string, level: Difficulty, r: Rng): FiguralDraft {
  const build = BUILDERS[family];
  if (!build) throw new Error('Keluarga figural tidak dikenal: ' + family);
  const seed = r.int(0, 0x3fffffff);
  // Tingkat "sulit" memuat porsi soal HOTS (empat aturan serial, tiga perubahan analogi, matriks jumlah ganda dan tumpuk saling menghilangkan): tiga dari sepuluh seed,
  // dipilih dari seed itu sendiri sehingga tidak menambah undian dan sisa seed menghasilkan soal yang sama seperti sebelumnya.
  const tier = level === 'sulit' && seed % 10 < 3 ? 'hots' : level;
  let lastError = '';
  for (let attempt = 0; attempt < 80; attempt++) {
    const built = build(rng('fig|' + family + '|' + tier + '|' + seed + '|' + attempt), tier);
    if (!built) continue;
    const draft = assemble(built), proof = solveScene({ stem: draft.stem, options: draft.options, visual: draft.visual } as Question);
    if (!proof.errors.length && proof.answer === draft.answer) return draft;
    lastError = proof.errors[0] ?? 'kunci tidak cocok';
  }
  throw new Error('Soal figural ' + family + ' (' + level + ') tidak berhasil disusun: ' + lastError);
}
