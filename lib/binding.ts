import type { Question } from './types';
// Detects accidental separation of a stimulus, its model, and its explanation.
// It is a content checksum, not a signature or authentication mechanism.
export function validationBinding(q: Question): string {
  const text = JSON.stringify([q.stem, q.options, q.answer, q.explanation, q.table, q.visual, q.proof]);
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ text.charCodeAt(i); }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
