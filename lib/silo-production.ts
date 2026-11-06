import { validationBinding } from './binding';
import type { Question } from './types';

const modelOf = (q: Question) => q.proof.kind === 'model' && q.proof.model.kind === 'syllogism' && q.proof.model.chapter?.endsWith('Narasi') ? q.proof.model : undefined;

// Bagian 25 blueprint: maksimum floor(20% soal) DAN floor(20% premis implikasi),
// dihitung per chapter dalam paket. Disjungsi dan fakta tunggal bukan penyebut.
// Mengubah urutan bahasa saja; premis formal, opsi, kunci, langkah, dan urutan soal tetap.
export function constrainNarrativePackage(questions: Question[]): Question[] {
  const totals = new Map<string, { questions: number; implications: number }>();
  for (const q of questions) {
    const model = modelOf(q);
    if (!model?.narrative) continue; // Paket lama tanpa metadata tidak ditebak atau disunting.
    const total = totals.get(model.chapter!) ?? { questions: 0, implications: 0 };
    total.questions++; total.implications += model.narrative.implications;
    totals.set(model.chapter!, total);
  }
  const used = new Map<string, { questions: number; implications: number }>();
  return questions.map((q) => {
    const model = modelOf(q), meta = model?.narrative;
    if (!model || !meta?.reversed) return q;
    const chapter = model.chapter!, total = totals.get(chapter)!, count = used.get(chapter) ?? { questions: 0, implications: 0 };
    if (count.questions + 1 <= Math.floor(total.questions / 5) && count.implications + meta.reversed <= Math.floor(total.implications / 5)) {
      used.set(chapter, { questions: count.questions + 1, implications: count.implications + meta.reversed });
      return q;
    }
    let stem = q.stem, explanation = q.explanation;
    for (const pair of meta.forward) {
      stem = stem.replaceAll(pair.from, pair.to);
      explanation = explanation.replaceAll(pair.markedFrom, pair.markedTo);
    }
    const next: Question = { ...q, stem, explanation, proof: { kind: 'model', model: { ...model, narrative: { ...meta, reversed: 0, forward: [] } } } };
    return { ...next, binding: validationBinding(next) };
  });
}
