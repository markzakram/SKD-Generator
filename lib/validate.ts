import { BANK_MAP } from './bank';
import { calculate, entails } from './solver';
import { solveFigure } from './figures';
import { distribution, fingerprint } from './generate';
import type { Audit, Package, Question, Settings } from './types';

export function auditQuestion(question: Question): string[] {
  const errors: string[] = [];
  const fail = (text: string) => errors.push(question.no + ': ' + text);
  if (!question.stem.trim() || !question.explanation.trim()) fail('pertanyaan atau pembahasan kosong');
  if (question.options.length !== 5) { fail('jumlah opsi harus lima'); return errors; }
  if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer > 4) { fail('kunci di luar opsi'); return errors; }
  if (question.options.some((option) => !option.text.trim() || !option.reason.trim())) fail('teks/alasan opsi kosong');
  if (new Set(question.options.map((option) => option.figure ? JSON.stringify(option.figure) : option.text.trim())).size !== 5) fail('opsi berulang');
  const high = Math.max(...question.options.map((option) => option.score));
  if (high !== 5 || question.options[question.answer].score !== high ||
    question.options.filter((option) => option.score === high).length !== 1) fail('kunci terbaik tidak tunggal');
  if (question.subtest === 'TKP') {
    if (question.options.some((option) => !Number.isInteger(option.score) || option.score < 1 || option.score > 5)) fail('skor TKP di luar 1–5');
  } else if (question.options.some((option, index) => option.score !== (index === question.answer ? 5 : 0))) fail('skor TWK/TIU tidak sesuai kunci');
  const proof = question.proof;
  try {
    if (proof.kind === 'numeric') {
      const computed = proof.expression ? calculate(proof.expression) : proof.answer;
      const matches = proof.values.map((value, index) => ({ value, index })).filter(({ value }) => Math.abs(value - computed) < 0.000051);
      if (matches.length !== 1 || matches[0].index !== question.answer) fail('hasil hitung ulang tidak sesuai kunci');
      if (question.options.some((option, index) => Math.abs(Number(option.text.replace(',', '.')) - proof.values[index]) > 0.000051)) fail('nilai opsi berubah');
    } else if (proof.kind === 'logic') {
      const valid = proof.entailment ? entails(proof.entailment.premises, proof.entailment.conclusions) : proof.valid;
      if (valid.filter(Boolean).length !== 1 || !valid[question.answer]) fail('kesimpulan logika tidak tunggal atau salah');
    } else if (proof.kind === 'figure') {
      if (solveFigure(question) !== question.answer) fail('gambar jawaban tidak sesuai pola stimulus');
    } else {
      const bank = BANK_MAP.get(proof.id);
      if (!bank) fail('sumber bank tidak ditemukan');
      else {
        const expected = bank.options[bank.answer].text;
        if (question.stem !== bank.stem || question.options[question.answer].text !== expected) fail('isi/kunci berbeda dari bank sumber');
        for (const option of question.options) {
          const source = bank.options.find((item) => item.text === option.text);
          if (!source || source.score !== option.score) fail('opsi atau skor berbeda dari bank sumber');
        }
      }
    }
  } catch (error) { fail(error instanceof Error ? error.message : 'pemeriksaan gagal'); }
  return errors;
}
export function auditPackages(packages: Package[], settings: Settings): Audit {
  const errors: string[] = [], global = new Set<string>(), keyDistribution = [0, 0, 0, 0, 0];
  let checked = 0, duplicateCount = 0;
  const expected = distribution(settings.mode, settings.count);
  if (packages.length !== settings.packages) errors.push('Jumlah paket berbeda dari permintaan.');
  packages.forEach((pack) => {
    const local = new Set<string>();
    if (pack.questions.length !== settings.count) errors.push(pack.id + ': jumlah soal berbeda.');
    for (const subtest of ['TWK', 'TIU', 'TKP'] as const) {
      if (pack.questions.filter((question) => question.subtest === subtest).length !== expected[subtest]) errors.push(pack.id + ': distribusi ' + subtest + ' berbeda.');
    }
    pack.questions.forEach((question, index) => {
      checked++; errors.push(...auditQuestion(question).map((error) => pack.id + '/' + error));
      if (question.no !== index + 1) errors.push(pack.id + ': nomor soal tidak berurutan.');
      if (settings.difficulty !== 'campuran' && question.difficulty !== settings.difficulty) errors.push(pack.id + ': kesulitan di luar filter.');
      if (settings.topics.length && !settings.topics.includes(question.topic)) errors.push(pack.id + ': materi di luar filter.');
      if (settings.subtopics.length && !settings.subtopics.includes(question.topic + '::' + question.subtopic)) errors.push(pack.id + ': submateri di luar filter.');
      const signature = fingerprint(question);
      if (local.has(signature) || (settings.uniqueAcross && global.has(signature))) {
        duplicateCount++; errors.push(pack.id + ': soal berulang.');
      }
      local.add(signature); global.add(signature);
      if (keyDistribution[question.answer] !== undefined) keyDistribution[question.answer]++;
    });
  });
  return { ok: errors.length === 0, checked, errors, duplicateCount, keyDistribution };
}
