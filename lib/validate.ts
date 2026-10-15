import { BANK_MAP } from './bank';
import { calculate, entails } from './solver';
import { solveFigure } from './figures';
import { checkScene, solveScene } from './figural/solve';
import { solveModel } from './models';
import { checkBlueprint, actualBlueprint } from './blueprint';
import { validationBinding } from './binding';
import { distribution, fingerprint } from './generate';
import type { Audit, Package, Question, Settings } from './types';

export function auditQuestion(question: Question): string[] {
  const errors: string[] = [];
  const fail = (text: string) => errors.push(question.no + ': ' + text);
  if (!question.stem.trim() || !question.explanation.trim()) fail('pertanyaan atau pembahasan kosong');
  if (question.binding && question.binding !== validationBinding(question)) fail('stimulus, model, atau pembahasan berubah; verifikasi ulang diperlukan');
  if (question.table && (!Array.isArray(question.table.headers) || !question.table.headers.length || question.table.headers.length > 12 || question.table.headers.some((h) => typeof h !== 'string') || !Array.isArray(question.table.rows) || question.table.rows.length > 30 || question.table.rows.some((row) => !Array.isArray(row) || row.length !== question.table!.headers.length || row.some((cell) => typeof cell !== 'string')))) fail('struktur tabel tidak valid');
  if (question.visual && (!['analogi', 'serial', 'ketidaksamaan', 'matriks'].includes(question.visual.kind) || !Number.isInteger(question.visual.columns) || question.visual.columns < 1 || question.visual.columns > 8 || !Array.isArray(question.visual.figures) || question.visual.figures.length > 16 ||
    (question.visual.scenes !== undefined && (!Array.isArray(question.visual.scenes) || question.visual.scenes.length > 16)))) { fail('struktur stimulus gambar tidak valid'); return errors; }
  if (question.visual?.oddRule && !['attribute', 'count-fill', 'turn-count'].includes(question.visual.oddRule)) fail('aturan kelompok gambar tidak valid');
  if (question.options.length !== 5) { fail('jumlah opsi harus lima'); return errors; }
  if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer > 4) { fail('kunci di luar opsi'); return errors; }
  if (question.options.some((option) => !option.text.trim() || !option.reason.trim())) fail('teks/alasan opsi kosong');
  // Gambar mesin baru: struktur setiap kotak diperiksa walau soalnya sudah disunting manual, agar tampilan tidak rusak.
  const sceneErrors: string[] = [];
  (question.visual?.scenes ?? []).forEach((s, i) => { if (s) checkScene(s, 'kotak ' + (i + 1), sceneErrors); });
  question.options.forEach((o, i) => { if (o.scene) checkScene(o.scene, 'opsi ' + String.fromCharCode(65 + i), sceneErrors); });
  sceneErrors.forEach(fail);
  const figures = [...(question.visual?.figures ?? []), ...question.options.map((o) => o.figure)].filter(Boolean);
  if (figures.some((f) => !['triangle', 'square', 'circle', 'diamond'].includes(f!.shape) || !Number.isInteger(f!.count) || f!.count < 0 || f!.count > 8 || ![0, 1, 2].includes(f!.fill) || !Number.isFinite(f!.angle))) fail('atribut gambar tidak valid');
  if (new Set(question.options.map((option) => option.scene ? JSON.stringify(option.scene) : option.figure ? JSON.stringify(option.figure) : option.text.trim())).size !== 5) fail('opsi berulang');
  const high = Math.max(...question.options.map((option) => option.score));
  if (high !== 5 || question.options[question.answer].score !== high ||
    question.options.filter((option) => option.score === high).length !== 1) fail('kunci terbaik tidak tunggal');
  if (question.subtest === 'TKP') {
    if (question.options.some((option) => !Number.isInteger(option.score) || option.score < 1 || option.score > 5)) fail('skor TKP di luar 1–5');
  } else if (question.options.some((option, index) => option.score !== (index === question.answer ? 5 : 0))) fail('skor TWK/TIU tidak sesuai kunci');
  const proof = question.proof;
  try {
    if (proof.kind === 'numeric') {
      if (!proof.expression) fail('ekspresi untuk verifikasi numerik belum tersedia');
      const computed = proof.expression ? calculate(proof.expression) : NaN;
      const matches = proof.values.map((value, index) => ({ value, index })).filter(({ value }) => Math.abs(value - computed) < 0.000051);
      if (matches.length !== 1 || matches[0].index !== question.answer) fail('hasil hitung ulang tidak sesuai kunci');
      if (question.options.some((option, index) => !Number.isFinite(Number(option.text.replace(',', '.'))) || Math.abs(Number(option.text.replace(',', '.')) - proof.values[index]) > 0.000051)) fail('nilai opsi berubah');
    } else if (proof.kind === 'logic') {
      const valid = proof.entailment ? entails(proof.entailment.premises, proof.entailment.conclusions) : proof.valid;
      if (valid.filter(Boolean).length !== 1 || !valid[question.answer]) fail('kesimpulan logika tidak tunggal atau salah');
    } else if (proof.kind === 'figure') {
      if (solveFigure(question) !== question.answer) fail('gambar jawaban tidak sesuai pola stimulus');
    } else if (proof.kind === 'scene') {
      // Aturan disimpulkan ulang dari stimulus; tepat satu opsi boleh memenuhi seluruh ramalan.
      const result = solveScene(question);
      result.errors.forEach(fail);
      if (!result.errors.length && result.answer !== question.answer) fail('gambar jawaban tidak sesuai aturan yang dibuktikan dari stimulus');
    } else if (proof.kind === 'model') {
      const model = proof.model;
      if (model.kind === 'data' && (!Number.isInteger(model.domain) || model.domain < 1 || model.domain > 30)) throw new Error('domain solver di luar batas');
      if (model.kind === 'route' && model.nodes.length > 12) throw new Error('jumlah simpul di luar batas');
      const valid = solveModel(question);
      if (valid.filter(Boolean).length !== 1 || !valid[question.answer]) fail('hasil solver model berbeda dari kunci');
    } else if (proof.kind === 'manual') {
      if (!proof.note.trim()) fail('catatan verifikasi manual diperlukan');
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
    if (settings.blueprint) errors.push(...checkBlueprint(actualBlueprint(pack.questions), { ...settings, uniqueAcross: false }).map((error) => pack.id + ': ' + error));
    if (settings.blueprint) for (const row of settings.blueprint) {
      if (pack.questions.filter((q) => q.subtest === row.subtest && q.topic === row.topic && q.difficulty === row.difficulty).length !== row.count) errors.push(pack.id + ': kuota blueprint berbeda untuk ' + row.topic + '/' + row.difficulty);
    }
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
