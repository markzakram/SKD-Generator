// Pemeriksaan format pembahasan TIU tahap 4a: komponen bersama (lib/explanation.ts, lib/table.ts, components/Explanation.tsx, ekspor PDF/Word/PNG,
// salinan) dan empat keluarga numerik dasar (hitung, pecahan, tabel, data) menurut Panduan Produksi Soal TIU JadiASN (PDF 57–63) dan Contoh Soal TIU SKD 2027
// (pola bilangan tabel PDF 38, kecukupan data PDF 44–47). Dijalankan sendiri: `npx tsx scripts/tiu-format-checks.ts`.
// - checkTiuFormat(q): pemeriksa satu soal (daftar masalah; kosong = sesuai format).
// - runTiuFormatChecks(check): pemeriksaan sinkron (pembangkitan, parser, layar, salinan, blok ekspor).
// - runTiuExportChecks(check): pemeriksaan ekspor PDF/Word/PNG dengan peramban tiruan (asinkron).
import assert from 'node:assert/strict';
import { Buffer, resolveObjectURL } from 'node:buffer';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { unzipSync, unzlibSync } from 'fflate';
import Explanation from '../components/Explanation';
import MathText from '../components/MathText';
import QuestionCard from '../components/QuestionCard';
import { BANK } from '../lib/bank';
import { DEFAULT_SETTINGS } from '../lib/config';
import { fingerprint, normalizeSettings } from '../lib/generate';
import { generateTryout } from '../lib/tryout-profile';
import { explanationBlocks, exportCsv, pdfBlob, questionBlocks, questionPngBlob, reasonLines, wordBlob, type Block } from '../lib/export';
import { COLORS_RENDERED, hasMarks, richHtml, richRuns, stripMarks } from '../lib/richtext';
import { base2, base3, type Config } from '../lib/silo-spec';
import { buildFromConfig, buildLogika, type Chapter } from '../lib/tiu-logika';
import { chainSvg, type ChainArc } from '../lib/chain';
import { diagramResult, isDiagramBlock } from '../lib/diagram';
import { guideImage } from '../lib/guide-images';
import { aligned, diagramProblems, explanationOf, explanationPlain, explanationTexts, parseExplanation, tableLines } from '../lib/explanation';
import { mathHtml } from '../lib/math';
import { MAPPING_ROWS } from '../lib/mapping';
import { DATA_LABELS, orders, solveModel, type Condition, type Model } from '../lib/models';
import { workingNote } from '../lib/reasons';
import { rng, type Rng } from '../lib/rng';
import { makeMappedTiu } from '../lib/tryout-patterns';
import { SKENARIO } from '../lib/tiu-argumen';
import { calculate, entails, implies, not, variable, type Logic } from '../lib/solver';
import { RELATIONS, lookupPair, relationById } from '../lib/tiu-analogi';
import { optionNumber } from '../lib/validate';
import { tableGrid } from '../lib/table';
import { sectionsHtml, sectionsText, slotSvg, takeSections } from '../lib/take';
import { TIU_FAMILIES, makeTiu } from '../lib/tiu';
import { solve as solvePosisi, holdsAll as holdsAllPosisi, holdsNone as holdsNonePosisi } from '../lib/posisi-model';
import { deduce as deducePosisi, neededSteps } from '../lib/posisi-deduce';
import { clause, formedText, stepSentences } from '../lib/posisi-text';
import { isTheme } from '../lib/posisi-model';
import { figureSvg, type FigureDiagram } from '../lib/figural/annotate';
import { graphSvg } from '../lib/graph';
import { sidesOf } from '../lib/figural/solve';
import { sameScene } from '../lib/figural/scene';
import { DISTRACTOR_REASONS, DISTRACTOR_SCALE, TOWEW_ROWS, directions, towewOf } from '../lib/tiu-deret';
import { SPECIAL_FRACTIONS, SPECIAL_SENTENCE } from '../lib/tiu-explain';
import type { Difficulty, Package, Question, Scene } from '../lib/types';
import { solidPng } from './figural-checks';
import { runTiuQc2Checks } from './tiu-qc2-checks';
import { CONTOH_NARASI, contohBuild } from '../lib/silo-contoh';
import { toQuestion, checkSilogismeBlueprint, fillerAcross, repeatedWords, runSilogismeChecks, SURFACE_RULES, UNGRAMMATICAL } from './silogisme-checks';

type Check = (condition: unknown, message: string) => void;
export const DERET_FAMILIES = ['deret', 'fibonacci', 'tiga-jalur', 'selang-seling'];
export const FIGURAL_FAMILIES_CHECKED = ['fig-analogi', 'fig-odd', 'fig-serial', 'fig-matrix'];
export const FORMAT_FAMILIES = ['hitung', 'pecahan', 'tabel', 'data', 'cerita-hitung', 'posisi', 'peringkat', 'jadwal', 'kategori', ...DERET_FAMILIES, ...FIGURAL_FAMILIES_CHECKED, 'rute', 'silogisme', 'analogi'];
// Frasa yang diwajibkan diwujudkan menjadi langkah (QC TIU), bukan disebut saja; serta kalimat narasi lama keluarga ini.
export const GENERIC_PHRASES = [/uji seluruh petunjuk/i, /terdapat satu susunan/i, /penuhi seluruh aturan/i, /uji seluruh pasangan bilangan/i, /kerjakan tanda kurung terlebih dahulu/i,
  /hasil perhitungan adalah/i, /hubungkan petunjuk/i, /bedakan hubungan sebelum/i, /rangkaian lima presentasi/i, /kategori ini berbeda/i, /karena tepat dua peserta mengikuti/i, /samakan penyebut menjadi \d+\. nilai/i, /selisih nilai pada n=1/i, /konsep: kecukupan/i, /cara cepat/i];

// LaTeX baris persamaan -> nilai (hanya bentuk yang dipakai penyusun: + − × ÷, \frac, koma desimal, kurung).
export function latexValue(latex: string): number {
  let text = latex.replace(/^&?=?/, '').replace(/\\times/g, '*').replace(/\\div/g, '/').replace(/\{,\}/g, '.').replace(/\s+/g, '');
  for (let guard = 0; guard < 8 && /\\frac\{[^{}]*\}\{[^{}]*\}/.test(text); guard++) text = text.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))');
  return calculate(text);
}
const alignedRows = (line: string) => {
  const inner = /^\\\[\\begin\{aligned\}([\s\S]*)\\end\{aligned\}\\\]$/.exec(line)?.[1];
  return inner === undefined ? undefined : inner.split('\\\\').map((row) => row.replace(/^&/, ''));
};
const numberOf = optionNumber; // satuan dan titik ribuan pada opsi diabaikan
const decimals = (text: string) => (text.split(',')[1] ?? '').length;
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const optionTexts = (q: Question) => q.options.map((option) => option.text);

// Himpunan (x, y) yang memenuhi kondisi: pemeriksaan independen dari penyusun pembahasan.
const worldsOf = (model: Extract<Model, { kind: 'data' }>, conditions: readonly Condition[]) => {
  const out: { x: number; y: number }[] = [];
  for (let x = 1; x <= model.domain; x++) for (let y = 1; y <= model.domain; y++) {
    const holds = (c: Condition) => c.op === 'xGt' ? x > c.value : c.op === 'yGt' ? y > c.value : (c.op === 'x' ? x : c.op === 'y' ? y : c.op === 'sum' ? x + y : c.op === 'difference' ? x - y : x * y) === c.value;
    if (conditions.every(holds)) out.push({ x, y });
  }
  return out;
};
const targetOf = (model: Extract<Model, { kind: 'data' }>, w: { x: number; y: number }) => model.target === 'x' ? w.x : model.target === 'sum' ? w.x + w.y : w.x * w.y;

// ---- Tahap 4b: soal cerita numerik dan verbal analitis ----------------------------------------------------------------------------------
// Nilai satu potong LaTeX (bilangan, + − × ÷, \frac, \cdot, persen, titik ribuan rupiah, x diganti nilainya); undefined bila memuat huruf lain.
function evalPiece(raw: string, x?: number): number | undefined {
  let t = raw.replace(/\\text\{[^{}]*\}/g, '').replace(/\\mathbf\{[^{}]*\}/g, '').replace(/\\to|\\,|\\;/g, '').replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2').replace(/\{,\}/g, '.')
    .replace(/\\%/g, '*0.01').replace(/\\cdot|\\times/g, '*').replace(/\\div/g, '/').replace(/\s+/g, '');
  for (let guard = 0; guard < 8 && /\\frac\{[^{}]*\}\{[^{}]*\}/.test(t); guard++) t = t.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))');
  if (x !== undefined) t = t.replace(/(\d)x/g, '$1*x').replace(/x/g, '(' + x + ')');
  t = t.replace(/(\d|\))\(/g, '$1*(');
  if (!t || !/^[\d+\-*/().]*$/.test(t)) return undefined;
  try { return calculate(t); } catch { return undefined; }
}
const displayRows = (line: string) => alignedRows(line) ?? [line.replace(/^\\\[/, '').replace(/\\\]$/, '')];
// Rantai persamaan: semua bagian yang dapat dihitung dalam satu baris sama nilainya, dan baris "=..." melanjutkan baris sebelumnya.
function chainProblems(blocks: ReturnType<typeof parseExplanation> & object): { problems: string[]; last?: number } {
  const problems: string[] = [];
  const mathLines = blocks.flatMap((b) => b.k === 'math' ? [b.text] : []);
  let x: number | undefined;
  for (const line of mathLines) for (const row of displayRows(line)) { const found = /^x=(.*)$/.exec(row.replace(/\s/g, '')); if (found) x = evalPiece(found[1]); }
  let last: number | undefined;
  for (const line of mathLines) {
    let previous: number | undefined;
    for (const row of displayRows(line)) {
      const segments = row.replace(/^&/, '').split('='), values = segments.map((segment) => evalPiece(segment, x));
      const defined = values.filter((v): v is number => v !== undefined);
      if (defined.some((v) => !close(v, defined[0]))) problems.push('baris persamaan tidak konsisten: ' + row.slice(0, 80));
      if (segments[0].trim() === '' && previous !== undefined && defined.length && !close(defined[0], previous)) problems.push('baris "=" tidak melanjutkan baris sebelumnya: ' + row.slice(0, 80));
      previous = defined.length ? defined[defined.length - 1] : undefined;
      if (previous !== undefined) last = previous;
    }
  }
  return { problems, last };
}
const headingsOf = (blocks: NonNullable<ReturnType<typeof parseExplanation>>) => blocks.flatMap((b) => b.k === 'heading' ? [b.text] : []);
const inOrder = (all: string[], wanted: string[]) => { let at = -1; return wanted.every((item) => (at = all.indexOf(item, at + 1)) >= 0); };
const lastParagraph = (blocks: NonNullable<ReturnType<typeof parseExplanation>>) => [...blocks].reverse().find((b) => b.k === 'p');
const KEY = '{kunci}';

// Opsi soal cerita (QC 4b): bilangan bulat dengan titik ribuan dan satuan yang sama seperti stem; setiap pengecoh dari kesalahan konsep yang tercatat (bukan pengisi),
// positif, dan berada dalam rentang logis subjenis yang dihitung ulang dari stem.
function checkStoryOptions(q: Question, sub: string, fail: (text: string) => void) {
  const texts = optionTexts(q), values = texts.map(numberOf), key = values[q.answer], wrong = values.filter((_, i) => i !== q.answer);
  const unitOf = (text: string) => text.replace(/^Rp/, '').replace(/^[\d.]+/, '').trim();
  const money = sub === 'diskon' || sub === 'bertahap';
  if (/Rp\d{4,}/.test(q.stem)) fail('rupiah di stem harus memakai titik ribuan (Rp120.000)');
  if (new Set(values).size !== 5) fail('opsi harus lima nilai yang berbeda');
  if (texts.some((text) => !/^(?:Rp)?\d{1,3}(?:\.\d{3})*(?: [A-Za-z/ ]+)?$/.test(text))) fail('opsi harus bilangan bulat dengan titik ribuan dan satuan: ' + texts.join('; '));
  if (money !== texts.every((text) => text.startsWith('Rp'))) fail('opsi rupiah hanya pada soal harga: ' + texts.join('; '));
  const units = [...new Set(texts.map(unitOf))];
  if (units.length !== 1) fail('semua opsi memakai satuan yang sama: ' + texts.join('; '));
  const unit = units[0] ?? '';
  const wanted: Record<string, string> = { jkw: 'km', vdw: 'liter', berbalik: 'hari', rasio: 'buku', diskon: '', bertahap: '', 'rata-gabungan': '', 'rata-baru': '' };
  if (sub in wanted && unit !== wanted[sub]) fail('satuan opsi "' + unit + '" tidak sesuai subjenis ' + sub + ' (harus "' + wanted[sub] + '")');
  if (sub === 'senilai' && !q.stem.includes(unit)) fail('satuan opsi senilai harus disebut di stem: ' + unit);
  if (sub === 'wowo' && unit !== (/tambahan pekerja|berapa pekerja/.test(q.stem) ? 'pekerja' : 'hari')) fail('satuan opsi proyek harus pekerja atau hari sesuai pertanyaan: ' + unit);
  const nums = (pattern: RegExp) => [...q.stem.matchAll(pattern)].map((m) => numberOf(m[1]));
  let range: [number, number] | undefined;
  if (sub === 'rata-gabungan') { const [a, b] = nums(/rata-rata nilai (\d+)/g); range = [a, b]; }
  else if (sub === 'rata-baru') { const old = nums(/adalah (\d+)\./g)[0], added = nums(/nilai (\d+) bergabung/g)[0]; range = [Math.min(old, added), Math.max(old, added)]; }
  else if (money) range = [1, 1.5 * nums(/Rp([\d.]+)/g)[0]];
  else if (sub === 'rasio') range = [1, nums(/Totalnya (\d+)/g)[0] - 1];
  else if (sub === 'berbalik') range = [1, 2 * nums(/dalam (\d+) hari/g)[0]];
  else if (sub === 'senilai') range = [1, 2 * key];
  else if (sub === 'jkw' || sub === 'vdw') range = [1, 100 * key];
  else if (sub === 'wowo') { const days = nums(/(\d+) hari/g)[0], workers = nums(/(\d+) (?:orang|pekerja)/g)[0]; range = unit === 'pekerja' ? [1, 3 * workers] : [1, days]; }
  if (!range || range.some((v) => !Number.isFinite(v))) fail('rentang logis tidak dapat dihitung dari stem');
  else for (const value of wrong) if (value < range[0] || value > range[1]) fail('pengecoh ' + value + ' di luar rentang logis [' + range[0] + ', ' + range[1] + '] subjenis ' + sub);
  // Skala (QA akhir): setiap subjenis, termasuk jkw/vdw/wowo, mengikuti skala yang sama dengan deret: pengecoh antara 0,3 dan 3,3 kali kunci.
  for (const value of wrong) if (value < DISTRACTOR_SCALE[0] * key - 1e-9 || value > DISTRACTOR_SCALE[1] * key + 1e-9) fail('pengecoh ' + value + ' di luar skala ' + DISTRACTOR_SCALE[0] + '-' + DISTRACTOR_SCALE[1] + ' kali kunci ' + key + ' subjenis ' + sub);
  const recorded = q.proof.kind === 'numeric' ? q.proof.distractors ?? [] : [];
  if (recorded.length !== 4 || recorded.some((d) => d.source !== 'konsep' || !d.reason.trim() || /selisih kecil dari hasil/i.test(d.reason) || !wrong.includes(d.value)) || wrong.some((value) => !recorded.some((d) => d.value === value))) fail('setiap pengecoh harus tercatat sebagai kesalahan konsep dengan alasan (tanpa pengisi aritmetika)');
}

function checkStory(q: Question, blocks: NonNullable<ReturnType<typeof parseExplanation>>, fail: (text: string) => void): string {
  const text = stripMarks(q.explanation), key = q.options[q.answer].text, answer = numberOf(key);
  const tables = blocks.flatMap((b) => b.k === 'table' ? [b] : []), headings = headingsOf(blocks), boxes = blocks.flatMap((b) => b.k === 'box' ? [b] : []);
  const last = lastParagraph(blocks), lastText = last?.k === 'p' ? last.text : '';
  const chain = chainProblems(blocks);
  chain.problems.forEach(fail);
  const lastNumber = chain.last;
  if (/Jawaban yang benar adalah [A-E]\b|jawaban yang benar adalah [A-E]\./.test(text)) fail('huruf kunci tertulis mati; pakai penanda {kunci}');
  const sub = text.includes('RUMUS WOWO') ? 'wowo' : text.includes('Vas DeWi') ? 'vdw' : blocks.some((b) => b.k === 'guide' && b.id === 'segitiga-jkw') ? 'jkw' :
    text.includes('Tahap 1, diskon') ? 'bertahap' : headings.includes('Ingat rumus:') ? 'diskon' : text.includes('Rata-rata gabungan kedua kelompok') ? 'rata-gabungan' :
      text.includes('Rata-rata awal') ? 'rata-baru' : text.includes('Perbandingan A : B') ? 'rasio' : text.includes('perbandingan senilai') ? 'senilai' : text.includes('perbandingan berbalik') ? 'berbalik' : 'tidak-dikenal';
  if (sub === 'tidak-dikenal') fail('subjenis soal cerita tidak dikenali dari pembahasan');
  else checkStoryOptions(q, sub, fail);
  const closing = (text.match(/\{kunci\}/g) ?? []).length;
  const finalNumber = lastText.match(/adalah ([\d,]+)\.(?: Jawaban yang benar adalah \{kunci\}\.)?$/);
  if (['jkw', 'vdw', 'bertahap', 'diskon', 'senilai', 'berbalik'].includes(sub) || sub === 'wowo') {
    if (lastNumber === undefined || !close(lastNumber, answer)) fail(sub + ': nilai terakhir di persamaan (' + lastNumber + ') bukan kunci ' + key);
  }
  if (sub === 'jkw') {
    if (!inOrder(headings, ['Diketahui:', 'Ditanyakan:', 'INGAT:']) || !blocks.some((b) => b.k === 'guide' && b.id === 'segitiga-jkw')) fail('jkw: Diketahui, Ditanyakan, INGAT dan segitiga J / K W wajib ada');
    if (lastText !== 'Jadi, jawaban yang benar adalah ' + KEY + '.' || closing !== 1) fail('jkw: penutup "Jadi, jawaban yang benar adalah {kunci}."');
  } else if (sub === 'vdw') {
    if (!inOrder(headings, ['Diketahui:', 'Ditanyakan:', 'INGAT:']) || !text.includes('Vas DeWi') || !blocks.some((b) => b.k === 'guide' && b.id === 'segitiga-vdw')) fail('vdw: INGAT dengan kotak "Vas DeWi" dan segitiga V / D W wajib ada');
    if (closing !== 0 || !/^Jadi, volume air yang dialirkan adalah/.test(lastText)) fail('vdw: penutup kalimat "Jadi, volume air ..." tanpa huruf kunci (seperti contoh panduan)');
  } else if (sub === 'diskon' || sub === 'bertahap') {
    if (boxes.length !== 1 || boxes[0].lines.length !== 5 || !boxes[0].lines[0].includes('HaJi') || boxes[0].lines.filter((l) => l.startsWith('• ')).length !== 3 || !inOrder(headings, ['Ingat rumus:'])) fail(sub + ': kotak rumus Haji Miu (rumus, "dengan", tiga butir definisi) wajib ada');
    if (closing !== 0 || blocks[blocks.length - 1].k !== 'math') fail(sub + ': pembahasan berakhir pada baris "= hasil" tanpa kalimat penutup (contoh panduan)');
    if (sub === 'bertahap' && !(text.includes('HJ_1') && text.includes('HJ_2') && text.includes('u_2'))) fail('bertahap: dua tahap Haji Miu bernomor');
  } else if (sub === 'rata-gabungan' || sub === 'rata-baru' || sub === 'rasio') {
    if (!inOrder(headings, ['Diketahui:', 'Ditanyakan:', 'Rumus Dasar:', 'Penyelesaian:', 'Kesimpulan:'])) fail(sub + ': Diketahui, Ditanyakan, Rumus Dasar, Penyelesaian, Kesimpulan wajib berurutan');
    if (!finalNumber || !close(numberOf(finalNumber[1]), answer) || closing !== 1 || !lastText.includes('Jawaban yang benar adalah ' + KEY + '.')) fail(sub + ': kesimpulan "Jadi, ... adalah N. Jawaban yang benar adalah {kunci}." dengan N = kunci');
  } else if (sub === 'senilai' || sub === 'berbalik') {
    const lihat = blocks.find((b) => b.k === 'p' && b.text.startsWith('*Lihat bahwa jika')), arrows = lihat?.k === 'p' ? [...lihat.text.matchAll(/\(([↑↓])\)/g)].map((m) => m[1]) : [];
    if (!lihat || arrows.length !== 2 || (sub === 'senilai') !== (arrows[0] === arrows[1])) fail(sub + ': baris "*Lihat bahwa ..." dengan dua panah yang sesuai (searah untuk senilai, berlawanan untuk berbalik)');
    const first = blocks[0];
    if (first.k !== 'p' || !/^\d+ [^→]+ → \d+ /.test(first.text) || !text.includes('→ x ') || !text.includes('Maka digunakanlah perbandingan ' + sub + ':')) fail(sub + ': baris "n satuan → m satuan", "→ x satuan", dan kalimat perbandingan wajib ada');
    if (closing !== 0 || blocks[blocks.length - 1].k !== 'math') fail(sub + ': berakhir pada persamaan "x = hasil satuan" (contoh panduan)');
  } else if (sub === 'wowo') {
    if (!inOrder(headings, ['Rumus Konsep:', 'RUMUS WOWO', 'Rumus Cepat:']) || !text.includes('\nRencana:\n') || !text.includes('\nRealisasi:\n')) fail('wowo: Rumus Konsep (Rencana, Realisasi), RUMUS WOWO, dan Rumus Cepat wajib berurutan');
    const realisasi = tables[0], quick = tables[1];
    if (!realisasi || realisasi.headers.join('|') !== '|\\(W\\)|\\(O\\)' || realisasi.rows.length < 2 || realisasi.rows.length > 3) fail('wowo: tabel realisasi dengan kolom W dan O (2–3 tahap)');
    if (!quick || quick.rows.length !== 4 || quick.headers.join('|') !== '|Pekerja|Hari') fail('wowo: tabel Rumus Cepat empat baris (Pekerja | Hari)');
    if (realisasi && realisasi.rows.flat().filter((cell) => /x/.test(stripMarks(cell))).length !== 1) fail('wowo: tepat satu sel realisasi memuat yang dicari (x)');
    if (realisasi && !/^Hari 1 sampai \d+$/.test(realisasi.rows[0][0])) fail('wowo: rentang hari tahap pertama "Hari 1 sampai n"');
    if (closing !== 2 || lastText !== 'Jadi, jawaban yang benar adalah ' + KEY + '.') fail('wowo: penutup "Jadi, jawaban yang benar adalah {kunci}." setelah WOWO dan setelah Rumus Cepat');
    const unfinished = text.includes('BELUM\\ SELESAI!');
    if (unfinished !== (realisasi?.rows.flat().some((cell) => stripMarks(cell) === 'x hari') ?? false)) fail('wowo: "BELUM SELESAI!" hanya bila yang dicari hari tahap terakhir');
    if (!['Tambahan pekerja', 'Tambahan hari', 'Total realisasi hari'].some((h) => headings.includes(h)) && !text.includes('TiFuS')) fail('wowo: bagian akhir (Tambahan pekerja/hari, Total realisasi hari, atau x langsung untuk mangkrak)');
  }
  if (sub === 'wowo') {
    const rows = tables[0]?.rows.length;
    SUBTYPES.add('wowo:' + (headings.includes('Tambahan pekerja') ? 'sakit-balik-pekerja' : text.includes('TiFuS') ? 'mangkrak' : headings.includes('Total realisasi hari') ? 'kontrak' : rows === 3 ? 'sakit-balik-hari' : 'sakit-tidak-balik'));
  }
  return sub;
}

// ---- Verbal analitis: susunan dan posisi, urutan dan peringkat, jadwal (panduan Verbal Analitis) dan memperkuat/memperlemah argumen ----------------------------------------
// Urutan dan peringkat serta jadwal memakai mesin dan pemeriksa yang sama dengan susunan dan posisi (checkPosisi): model susunan linear bergaya bertema (lomba, nilai, datang, tinggi, jadwal).
// Susunan dan posisi: kunci dibuktikan ulang oleh pemecah brute force (kunci benar pada semua susunan, pengecoh salah pada semua susunan), petunjuk berupa paragraf (bukan
// daftar bernomor), nama diperkenalkan dengan "dan", pembahasan tanpa "Informasi n:", kalimat penalaran persis hasil penalaran yang diperiksa terhadap pemecah, penutup
// "Jadi, jawaban yang benar adalah {kunci}." tepat satu, dan tabel posisi bernama tebal di akhir.
function posisiCells(model: Extract<Model, { kind: 'arrangement' }>, solutions: number[][]): string[][] {
  const { geo, names } = model, seats = geo.form === 'grid' ? geo.rows * geo.cols : geo.n;
  const cell = (s: number) => { const who = new Set(solutions.map((sol) => { const i = sol.indexOf(s); return i < 0 ? '' : names[i]; })); return who.size === 1 ? ([...who][0] ? '**' + [...who][0] + '**' : 'kosong') : '?'; };
  const all = Array.from({ length: seats }, (_, s) => cell(s));
  if (geo.form === 'linear') return [Array.from({ length: geo.n }, (_, i) => geo.labels ? geo.labels[i] : String(i + 1)), all];
  if (geo.form === 'circular') return [['Kursi', ...all.map((_, i) => String(i + 1))], ['Nama', ...all]]; // dipakai hanya untuk memeriksa urutan penghuni; pembahasan melingkar memakai diagram
  return [['', ...(geo.cols === 2 ? ['Kursi Kiri', 'Kursi Kanan'] : ['Kursi Kiri', 'Kursi Tengah', 'Kursi Kanan'])], ...Array.from({ length: geo.rows }, (_, row) => ['Baris ' + (row + 1), ...all.slice(row * geo.cols, (row + 1) * geo.cols)])];
}
function checkPosisi(q: Question, blocks: NonNullable<ReturnType<typeof parseExplanation>>, fail: (text: string) => void) {
  const model = q.proof.kind === 'model' && q.proof.model.kind === 'arrangement' ? q.proof.model : undefined;
  if (!model) return fail('bukti model susunan (arrangement) tidak ada');
  const { geo, names } = model, solutions = solvePosisi(geo, names, model.clues, model.anchor, 20000);
  if (!solutions.length) return fail('petunjuk tidak konsisten (tidak ada susunan)');
  if (geo.form !== 'grid' && solutions.length !== 1) fail('susunan linear/melingkar harus tunggal (' + solutions.length + ')');
  // Jawaban tunggal: kunci benar pada SEMUA susunan, tiap pengecoh salah pada SEMUA susunan.
  const solved = solveModel(q);
  if (solved.filter(Boolean).length !== 1 || !solved[q.answer]) fail('kunci berbeda dari hasil pemecah');
  q.options.forEach((option, i) => {
    const fact = model.options.find((x) => x.text === option.text)?.fact;
    if (!fact) return fail('opsi tanpa fakta model: ' + option.text);
    if (i === q.answer ? !holdsAllPosisi(fact, names, solutions, geo) : !holdsNonePosisi(fact, names, solutions, geo)) fail('opsi ' + option.text + ' tidak sesuai pemecah (kunci harus benar di semua susunan, pengecoh salah di semua susunan)');
  });
  // Stem: paragraf petunjuk, tanpa daftar bernomor (jadwal mengikuti contoh panduan: konteks, "Terdapat beberapa informasi sebagai berikut:", daftar bernomor, pertanyaan); daftar nama
  // memakai "dan"; setiap petunjuk model tertulis di stem persis seperti kalimat yang dibentuk dari faktanya.
  const lines = q.stem.split('\n'), themed = geo.form === 'linear' && isTheme(geo.style), schedule = geo.form === 'linear' && geo.style === 'jadwal';
  if (q.family === 'posisi' && themed) fail('susunan dan posisi tidak memakai gaya bertema');
  if ((q.family === 'jadwal') !== schedule || (q.family === 'peringkat') !== (themed && !schedule)) fail('keluarga ' + q.family + ' tidak sesuai gaya model');
  if (schedule) {
    const numbered = lines.filter((line) => /^\d+\. /.test(line));
    if (!lines[0].endsWith('Terdapat beberapa informasi sebagai berikut:') || numbered.length < 3 || numbered.length > model.clues.length || numbered.some((line, i) => !line.startsWith((i + 1) + '. ') || !line.endsWith('.')) || lines.length !== numbered.length + 2) fail('stem jadwal: konteks, "Terdapat beberapa informasi sebagai berikut:", daftar bernomor 1..n, lalu satu baris pertanyaan');
  } else {
    if (lines.length !== 2 || /^\s*\d+\.\s/m.test(q.stem)) fail('stem: satu paragraf petunjuk lalu satu baris pertanyaan, tanpa daftar bernomor');
    if (/Terdapat beberapa informasi/.test(q.stem)) fail('stem: kalimat "Terdapat beberapa informasi sebagai berikut" tidak dipakai');
  }
  for (const f of model.clues) {
    const text = clause(f, geo), subject = names.filter((name) => text.startsWith(name + ' ')).sort((a, b) => b.length - a.length)[0] ?? text.split(' ')[0];
    if (!q.stem.includes(text) && !q.stem.includes(' dan ' + text.slice(subject.length + 1))) fail('stem tidak memuat petunjuk model: ' + text);
  }
  const listed = /\(([A-Z](?:, [A-Z])+, dan [A-Z])\)|yaitu (.+?, dan [^,]+),/.exec(lines[0]);
  if (!listed) fail('stem: daftar nama harus berbentuk "(A, B, C, dan D)" atau "yaitu A, B, dan C" (memakai "dan")');
  else if ((listed[1] ?? listed[2]).split(/, dan |, /).sort().join() !== [...names].sort().join()) fail('stem: daftar nama tidak sama dengan nama pada model');
  if (!/\?$|\.\.\.$/.test(lines[lines.length - 1])) fail('stem: baris terakhir adalah pertanyaan');
  // Pembahasan.
  if (/[Ii]nformasi \d/.test(q.explanation)) fail('pembahasan: pola "Informasi n: ..." tidak dipakai');
  if (blocks.filter((b) => b.k === 'p' && b.text === 'Jadi, jawaban yang benar adalah ' + KEY + '.').length !== 1) fail('penutup "Jadi, jawaban yang benar adalah {kunci}." tepat satu');
  const tables = blocks.filter((b) => b.k === 'table'), last = blocks[blocks.length - 1], before = blocks.filter((b) => b.k !== 'gap');
  const ringed = geo.form === 'circular';
  if (ringed ? tables.length !== 0 || last.k !== 'graph' : tables.length !== 1 || last.k !== 'table') return fail(ringed ? 'pembahasan melingkar: tanpa tabel, diagram lingkaran berada di akhir (contoh panduan Duduk Melingkar)' : 'pembahasan: tepat satu tabel dan berada di akhir');
  // QC akademik #2 (soal 41): tabel yang memuat kursi belum pasti (?) diberi judul tepat di atasnya; tabel yang semuanya pasti tanpa judul.
  const CAPTION = '**Kedudukan yang dapat dipastikan** (tanda ? berarti kursi itu belum dapat dipastikan dari informasi yang ada)';
  const unsure = !ringed && last.k === 'table' && last.rows.some((row) => row.includes('?')), captioned = before[before.length - 2]?.k === 'p' && (before[before.length - 2] as { text: string }).text === CAPTION;
  if (unsure !== captioned) fail('pembahasan: tabel dengan kursi belum pasti (?) wajib berjudul "Kedudukan yang dapat dipastikan", tabel yang semuanya pasti tanpa judul');
  const beforeTable = before[before.length - (captioned ? 3 : 2)];
  if (beforeTable?.k !== 'p' || beforeTable.text !== 'Jadi, jawaban yang benar adalah ' + KEY + '.') fail('pembahasan: tabel atau diagram menyusul tepat sesudah kalimat penutup');
  if (last.k === 'graph') {
    // Diagram lingkaran: penghuni kursi 1..n sama dengan susunan pemecah, petunjuk kunci = kalimat petunjuk di soal, kotak kesimpulan = kalimat "Dengan demikian, ..." pembahasan.
    const order = names.map((name, i) => [name, solutions[0][i]] as const).sort((a, b) => a[1] - b[1]).map(([name]) => name), ring = last.graph.ring;
    const conclusion = blocks.flatMap((b) => b.k === 'p' && b.text.startsWith('Dengan demikian, ') ? [b.text] : [])[0] ?? '';
    if (!ring || last.graph.nodes.join('|') !== order.join('|') || last.graph.edges.length) fail('diagram lingkaran: penghuni kursi 1..n tidak sama dengan susunan dari pemecah: ' + last.graph.nodes.join(', '));
    else if (ring.clues.length < 3 || ring.clues.some((clue) => !q.stem.includes(clue)) || ring.note !== conclusion.slice('Dengan demikian, '.length).charAt(0).toUpperCase() + conclusion.slice('Dengan demikian, '.length + 1)) fail('diagram lingkaran: petunjuk kunci harus kalimat petunjuk soal dan kotak kesimpulan sama dengan kalimat "Dengan demikian, ..." pembahasan');
  } else {
    const expected = posisiCells(model, solutions), shown = last as Extract<typeof last, { k: 'table' }>;
    if (shown.headers.join('|') !== expected[0].join('|') || shown.rows.map((row) => row.join('|')).join('/') !== expected.slice(1).map((row) => row.join('|')).join('/')) fail('tabel akhir tidak sama dengan susunan dari pemecah: ' + JSON.stringify(shown.rows));
  }
  // Penalaran: langkah diperiksa ulang terhadap semua susunan, kalimat yang tampil persis kalimat dari langkah itu.
  const deduction = deducePosisi(geo, names, model.clues, model.anchor), index = (name: string) => names.indexOf(name);
  for (const step of deduction.steps) {
    const ok = step.kind === 'clue' ? solutions.every((sol) => step.after.includes(sol[index(step.person)])) :
      step.kind === 'elim' ? solutions.every((sol) => sol[index(step.holder)] === step.seat && sol[index(step.person)] !== step.seat) :
        step.kind === 'single' ? solutions.every((sol) => sol[index(step.person)] === step.seat) : solutions.every((sol) => sol[index(step.person)] !== step.seat);
    if (!ok) fail('langkah penalaran bertentangan dengan pemecah: ' + step.kind + ' ' + step.person);
  }
  if (geo.form !== 'grid' && !names.every((name) => name in deduction.positions)) fail('penalaran tidak menempatkan semua orang');
  let from = 0;
  for (const sentence of stepSentences({ geo, clues: model.clues, names }, neededSteps(deduction))) {
    const at = q.explanation.indexOf(sentence, from);
    if (at < 0) { fail('kalimat penalaran tidak ada pada pembahasan: ' + sentence.slice(0, 70)); break; }
    from = at + sentence.length;
  }
  if (geo.form === 'circular' && !q.explanation.startsWith('Susunan melingkar tidak mempunyai posisi awal yang tetap, sehingga ' + model.anchor + ' dijadikan acuan di kursi 1.')) fail('pembahasan melingkar: acuan kursi 1 disebut lebih dahulu');
  if (geo.form === 'circular' && !/Dalam soal ini, kiri seseorang berarti kursi tepat setelahnya searah jarum jam\./.test(q.stem)) fail('stem melingkar: definisi "kiri" harus ada');
  // Mutu kalimat pembahasan (panduan: kalimat pendek, satu fakta lalu akibatnya): tidak ada tumpukan tiga klausa "Karena ... dan ... dan ..., maka", dan "kursi" hanya untuk susunan
  // yang memang berkursi (melingkar, baris-kolom), bukan untuk orang berdiri, mengantre, peringkat, atau jadwal.
  for (const sentence of explanationSentences(q.explanation)) if (stacksThreeClauses(sentence)) fail('kalimat menumpuk tiga klausa: ' + sentence.slice(0, 90));
  if (geo.form === 'linear' && /\bkursi\b/i.test(q.explanation) || geo.form === 'linear' && geo.style !== 'duduk' && /\bkursi\b/i.test(q.stem)) fail('kata "kursi" pada susunan linear (berdiri, mengantre, peringkat, jadwal)');
  if (geo.form === 'linear' && !model.options.every((o) => o.fact.k === 'order')) {
    const seq = names.map((name, i) => [name, solutions[0][i]] as const).sort((a, b) => a[1] - b[1]).map(([name]) => name);
    if (!q.explanation.includes(formedText(geo, seq))) fail('pembahasan: kalimat susunan yang terbentuk tidak ada atau tidak sama dengan susunan pemecah');
  }
  // Level Bloom dan kesulitan diturunkan dari kebutuhan penalaran.
  const allOrder = model.options.every((o) => o.fact.k === 'order');
  if ((q.bloom === 'C6') !== allOrder) fail('Bloom C6 hanya untuk soal susunan lengkap (opsi berupa susunan)');
  if (q.difficulty === 'sedang' && (q.bloom !== 'C4' || deduction.refutations > 0 || model.clues.length >= 7)) fail('kesulitan sedang: tanpa pengujian andaian, Bloom C4');
  if (q.difficulty === 'sulit' && q.bloom === 'C4' && deduction.refutations === 0 && model.clues.length < 7) fail('kesulitan sulit tanpa alasan penalaran');
  if (!['C4', 'C5', 'C6'].includes(q.bloom ?? '')) fail('Bloom susunan dan posisi harus C4–C6');
  if (themed) { SUBTYPES.add(q.family); SUBTYPES.add('tema:' + (geo as { style: string }).style); SUBTYPES.add(q.family + '-bloom:' + q.bloom); return; }
  SUBTYPES.add('posisi:' + geo.form); SUBTYPES.add('posisi-bloom:' + q.bloom);
  if (deduction.refutations > 0) SUBTYPES.add('posisi:uji-andaian');
}
// Kalimat pembahasan (tanpa tabel dan kalimat penutup baku), dan tumpukan klausa: kalimat "Karena" yang memuat dua "dan" atau lebih sebelum ", maka"/", sehingga".
export const explanationSentences = (explanation: string) => explanation.split('\n').filter((line) => line && !line.startsWith('|') && !line.startsWith('Jadi,')).join(' ').split(/(?<=[.])\s+/);
export const stacksThreeClauses = (sentence: string) => sentence.startsWith('Karena ') && (sentence.split(/, (?:maka|sehingga) /)[0].match(/ dan /g) ?? []).length >= 2;

// Penanda ragu pada opsi argumen: "belum diketahui", "tidak diperiksa", "tanpa data", "tidak ada catatan", dan sejenisnya.
const HEDGE_MARKER = /\b(?:belum|tidak) (?:diketahui|diperiksa|dicatat|dibandingkan|diukur|diamati|ditunjukkan|diteliti|ada (?:data|catatan|informasi|bukti))\b|\btanpa (?:data|informasi|catatan|bukti|pengukuran)\b|\btidak ada (?:data|catatan|informasi|bukti)\b/i;
// Memperkuat/memperlemah argumen: peran tiap opsi (kunci, arah terbalik, dan pengecoh), pertanyaan menyebut MEMPERKUAT/MEMPERLEMAH, pembahasan alasan -> kesimpulan -> kunci -> pengecoh.
function checkArgumen(q: Question, fail: (text: string) => void) {
  const model = q.proof.kind === 'model' && q.proof.model.kind === 'argument' ? q.proof.model : undefined;
  if (!model) return fail('bukti model argumen tidak ada');
  const solved = solveModel(q);
  if (solved.filter(Boolean).length !== 1 || !solved[q.answer]) fail('kunci berbeda dari peran opsi pada model');
  const roles = model.options.map((o) => o.role), others = roles.filter((role) => role !== 'kunci');
  if (roles.filter((role) => role === 'kunci').length !== 1 || new Set(others).size !== 4 || !others.includes('terbalik') || !others.includes('sebagian')) fail('peran opsi: satu kunci dan empat pengecoh berbeda (termasuk arah terbalik dan sebagian): ' + roles.join(','));
  const asked = /\n(?:Temuan|Informasi|Bukti|Keterangan|Hasil pemeriksaan) manakah yang paling (MEMPERKUAT|MEMPERLEMAH) .+\?$/.exec(q.stem);
  if (!asked) fail('pertanyaan: "Temuan manakah yang paling MEMPERKUAT/MEMPERLEMAH ...?"');
  else if ((asked[1] === 'MEMPERKUAT') !== (model.direction === 'perkuat')) fail('arah pertanyaan berbeda dari model');
  if (q.options.some((option) => option.reason.trim())) fail('alasan per opsi tidak ada pada soal argumen');
  const lengths = q.options.map((o) => o.text.length);
  // Kelima opsi harus berada dalam rentang panjang yang mirip (rasio terpanjang terhadap terpendek paling banyak 1,4): kunci, arah terbalik, dan pengecoh netral tidak boleh dibedakan lewat panjang.
  if (Math.min(...lengths) < 70 || Math.max(...lengths) > 280 || Math.max(...lengths) > 1.4 * Math.min(...lengths)) fail('opsi harus sejajar dan panjangnya setara (rasio paling banyak 1,4): ' + lengths.join(','));
  // Penanda ragu ("belum diketahui", "tanpa data", "tidak diperiksa") tidak boleh hanya ada pada pengecoh: peserta mencoret opsi beraroma ragu tanpa bernalar. Pengecoh dibedakan lewat hubungannya dengan penghubung argumen.
  const hedged = q.options.map((o) => HEDGE_MARKER.test(o.text));
  if (!hedged[q.answer] && hedged.some(Boolean)) fail('penanda ragu hanya muncul pada pengecoh, tidak pada kunci: ' + q.options.filter((_, i) => hedged[i]).map((o) => o.text.slice(0, 60)).join(' | '));
  if (q.options.some((o) => !/[.]$/.test(o.text) || /^[a-z]/.test(o.text))) fail('opsi diawali huruf kapital dan diakhiri titik');
  const paragraphs = q.explanation.split('\n\n'), key = q.options[q.answer].text.replace(/\.$/, '');
  if (paragraphs.length !== 4 || !paragraphs[0].startsWith('Alasan ') || !paragraphs[0].includes('Kesimpulannya, ')) fail('pembahasan: paragraf 1 memuat alasan dan kesimpulan');
  if (!paragraphs[1]?.includes(key.charAt(0).toLowerCase() + key.slice(1))) fail('pembahasan: paragraf 2 memuat temuan kunci');
  const partial = model.options.find((o) => o.role === 'sebagian')!.text.replace(/\.$/, '');
  if (!paragraphs[2]?.includes(partial.charAt(0).toLowerCase() + partial.slice(1)) || !paragraphs[2].includes('Adapun temuan bahwa')) fail('pembahasan: paragraf 3 memuat pengecoh sebagian yang gagal dan arah terbalik');
  if (paragraphs[3] !== 'Jadi, jawaban yang benar adalah ' + KEY + '.') fail('penutup "Jadi, jawaban yang benar adalah {kunci}." paragraf terakhir');
  if (workingNote(q.explanation)) fail('sisa catatan penyusunan');
  if (/\b(?:opsi|pilihan|jawaban)\s+[A-E]\b/i.test(q.explanation)) fail('pembahasan tidak menyebut huruf opsi');
  SUBTYPES.add('argumen:' + model.direction); SUBTYPES.add('argumen-bloom:' + q.bloom);
}

// Dua tafsir kalimat informasi diuji dengan brute force dari teks stem: tafsir inklusif ("dapat ditemukan di A, B" tidak melarang toko lain) dan eksklusif (toko lain pasti tidak menjual).
// Kalimat positif dibuat eksplisit ("hanya tersedia di ..."), sehingga kedua tafsir harus menghasilkan satu toko yang sama dengan kunci.
function storeReadings(q: Question, model: Extract<Model, { kind: 'availability' }>, facts: string[], fail: (text: string) => void) {
  const letters = (text: string) => [...text.matchAll(/[A-E]/g)].map((m) => 'Toko ' + m[0]);
  const absent: { policy: 'always' | 'only-when-exclusive'; stores: string[] }[] = [];
  for (const fact of facts) {
    let found: RegExpExecArray | null;
    if ((found = /^Hanya (Toko [A-E]) yang tidak menjual bunga \w+\.$/.exec(fact))) absent.push({ policy: 'always', stores: [found[1]] });
    else if ((found = /^(Toko [A-E]) tidak menjual bunga \w+\.$/.exec(fact))) absent.push({ policy: 'always', stores: [found[1]] });
    else if ((found = /^(Toko [A-E]) dan (Toko [A-E]) tidak menjual bunga \w+\.$/.exec(fact))) absent.push({ policy: 'always', stores: [found[1], found[2]] });
    else if ((found = /^Bunga \w+ tidak dapat ditemukan di (Toko [A-E, dan]+)\.$/.exec(fact))) absent.push({ policy: 'always', stores: letters(found[1]) });
    else if (/^Semua toko menjual bunga \w+\.$/.test(fact)) continue;
    else if ((found = /^Bunga \w+ hanya tersedia di (Toko [A-E, dan]+)\.$/.exec(fact))) { const only = letters(found[1]); absent.push({ policy: 'always', stores: model.stores.filter((store) => !only.includes(store)) }); }
    else if ((found = /^Bunga \w+ dapat ditemukan di (Toko [A-E, dan]+)\.$/.exec(fact))) { const some = letters(found[1]); absent.push({ policy: 'only-when-exclusive', stores: model.stores.filter((store) => !some.includes(store)) }); }
    else fail('kalimat informasi toko tidak dikenali: ' + fact);
  }
  if (absent.some((entry) => entry.policy === 'only-when-exclusive')) fail('kalimat "dapat ditemukan di ..." ambigu antara tafsir inklusif dan eksklusif; tulis "hanya tersedia di ..."');
  for (const exclusive of [false, true]) {
    const out = new Set(absent.filter((entry) => entry.policy === 'always' || exclusive).flatMap((entry) => entry.stores)), open = model.stores.filter((store) => !out.has(store));
    if (open.length !== 1 || open[0] !== q.options[q.answer].text) fail('tafsir ' + (exclusive ? 'eksklusif' : 'inklusif') + ' tidak menghasilkan satu toko yang sama dengan kunci: ' + open.join(', '));
  }
}

function checkKategori(q: Question, blocks: NonNullable<ReturnType<typeof parseExplanation>>, fail: (text: string) => void): string {
  const model = q.proof.kind === 'model' ? q.proof.model : undefined, table = blocks.flatMap((b) => b.k === 'table' ? [b] : [])[0];
  const solved = solveModel(q);
  if (solved.filter(Boolean).length !== 1 || !solved[q.answer]) fail('kunci berbeda dari hasil solver');
  const numbered = [...q.stem.matchAll(/^(\d+)\. (.+)$/gm)];
  if (numbered.length < 3 || numbered.some((m, i) => Number(m[1]) !== i + 1)) fail('informasi di soal harus bernomor');
  if (!table) { fail('tabel hasil tidak ada'); return 'tanpa-tabel'; }
  const cited = [...q.explanation.matchAll(/informasi (\d+)/gi)].map((m) => Number(m[1]));
  if (cited.some((n) => n < 1 || n > numbered.length)) fail('rujukan informasi tidak valid');
  if (blocks.filter((b) => b.k === 'p' && b.text === 'Jadi, jawaban yang benar adalah ' + KEY + '.').length !== 1) fail('penutup "Jadi, jawaban yang benar adalah {kunci}." tepat satu');
  if (model?.kind === 'availability') {
    storeReadings(q, model, numbered.map((m) => m[2]), fail);
    // Matriks barang x toko: sel x tepat pada pasangan yang dinyatakan tidak tersedia; toko kunci tanpa x, toko lain minimal satu x.
    if (table.headers.join() !== ['Toko', ...model.stores.map((s) => s.replace('Toko ', ''))].join()) fail('header matriks: Toko dan huruf toko');
    table.rows.forEach((row, item) => row.slice(1).forEach((cell, store) => {
      if (!['✓', 'x', '?'].includes(cell)) fail('sel matriks hanya ✓, x, atau ?');
      if ((cell === 'x') !== model.absent[item].includes(store)) fail('sel x tidak sama dengan data tidak tersedia (' + row[0] + ', ' + model.stores[store] + ')');
    }));
    const open = model.stores.filter((_, store) => model.absent.every((list) => !list.includes(store)));
    const gugur = model.stores.filter((s) => !open.includes(s));
    if (open.length !== 1 || q.options[q.answer].text !== open[0]) fail('toko kunci harus satu-satunya tanpa tanda x');
    if (!q.explanation.includes(gugur.slice(0, -1).join(', ') + ', dan ' + gugur[gugur.length - 1] + ' gugur karena') || !q.explanation.includes('Jadi, toko yang akan dikunjungi')) fail('kalimat "... gugur karena ..." dan kesimpulan toko wajib ada');
    return 'objek-tempat';
  }
  if (!/^[✓x]$/.test(table.rows[0][1]) || table.headers[0] !== '') fail('tabel orang x kegiatan: header kosong lalu nama, sel ✓ atau x');
  if (model?.kind === 'category') {
    const [a, b, c] = model.names, first = table.rows[0], second = table.rows[1];
    const expectFirst = [a, b, c].map((name) => name === b || model.yes.includes(name) ? '✓' : 'x'), expectSecond = [a, b, c].map((name) => model.second.includes(name) ? '✓' : 'x');
    if (first.slice(1).join() !== expectFirst.join() || second.slice(1).join() !== expectSecond.join() || table.headers.slice(1).join() !== model.names.join()) fail('tabel orang x kegiatan tidak sama dengan model');
  }
  return 'orang-kegiatan';
}

// ---- Tahap 4c: deret angka (panduan PDF 61–71) ------------------------------------------------------------------------------------------
const OPERATION = /^([+−×])(\d+)$/;
const operate = (value: number, label: string) => { const m = OPERATION.exec(label); return !m ? undefined : m[1] === '+' ? value + Number(m[2]) : m[1] === '−' ? value - Number(m[2]) : value * Number(m[2]); };
// Pola satu larik dihitung ulang dari suku-sukunya, tanpa memakai label penyusun: selisih tetap "+d" atau rasio bulat tetap "×r".
function laneLabel(lane: number[]): string | undefined {
  const diffs = lane.slice(1).map((v, i) => v - lane[i]), ratios = lane.slice(1).map((v, i) => v / lane[i]);
  if (diffs.length && diffs.every((d) => d === diffs[0]) && diffs[0] > 0) return '+' + diffs[0];
  if (ratios.length && ratios.every((r) => r === ratios[0]) && Number.isInteger(ratios[0]) && ratios[0] > 1) return '×' + ratios[0];
  return undefined;
}
// Nilai pengecoh dihitung ulang dari kode sumber kesalahannya memakai suku-suku soal (tanpa memakai data penyusun).
function recomputeDistractor(source: string, kind: string, given: number[], key: number): number | undefined {
  const n = given.length, last = given[n - 1];
  if (kind === 'fibonacci') return ({ 'ulang-suku-terakhir': last, 'jumlah-suku-berselang': last + given[n - 3], 'jumlah-tiga-suku': last + given[n - 2] + given[n - 3], 'jumlah-suku-keempat': last + given[n - 4],
    'salah-hitung-lebih-satu': key + 1, 'salah-hitung-kurang-satu': key - 1 } as Record<string, number>)[source];
  if (kind === 'selang-seling') {
    const add = given[1] - given[0], subtract = given[1] - given[2];
    return ({ 'urutan-operasi-terbalik': last - subtract, 'dua-operasi-sekaligus': last + add - subtract, 'pengurang-ditambah': last + subtract, 'ulang-suku-terakhir': last, 'maju-dua-suku': key + add,
      'salah-hitung-lebih-satu': key + 1, 'salah-hitung-kurang-satu': key - 1 } as Record<string, number>)[source];
  }
  const count = kind === 'satu-towew' ? 1 : kind === 'dua-towew' ? 2 : 3, laneAt = (offset: number) => given.filter((_, i) => i % count === offset);
  const own = laneAt(n % count), label = laneLabel(own), lastOwn = own[own.length - 1];
  if (!label) return undefined;
  const op = label[0], size = Number(label.slice(1)), laneLabelAt = (offset: number) => laneLabel(laneAt(offset)) ?? '';
  const table: Record<string, number | undefined> = {
    'ulang-suku-terakhir': lastOwn, 'maju-dua-suku': operate(key, label),
    'selisih-lebih-satu': op === '+' ? lastOwn + size + 1 : undefined, 'selisih-kurang-satu': op === '+' ? lastOwn + size - 1 : undefined,
    'rasio-lebih-satu': op === '×' ? lastOwn * (size + 1) : undefined, 'rasio-kurang-satu': op === '×' ? lastOwn * (size - 1) : undefined,
    'arah-terbalik': op === '+' ? lastOwn - size : undefined, 'tukar-operasi': op === '+' ? lastOwn * size : lastOwn + size,
    'anggap-selisih-tetap': op === '×' ? lastOwn + (lastOwn - own[own.length - 2]) : undefined,
    'selisih-larik-lain': count === 2 ? operate(lastOwn, laneLabelAt(1)) : undefined, 'lanjut-larik-lain': count === 2 ? operate(last, laneLabelAt(1)) : undefined,
    'selisih-larik-kedua': count === 3 ? operate(lastOwn, laneLabelAt(1)) : undefined, 'selisih-larik-ketiga': count === 3 ? operate(lastOwn, laneLabelAt(2)) : undefined,
    'lanjut-larik-ketiga': count === 3 ? operate(last, laneLabelAt(2)) : undefined,
  };
  return table[source];
}
// Pengecoh deret: bukan nilai absurd (nol, negatif, pecahan, atau beda skala), unik, dan tiap pengecoh punya sumber kesalahan yang nilainya dapat dihitung ulang.
function checkDeretDistractors(q: Question, kind: string, given: number[], key: number, fail: (text: string) => void) {
  const values = q.options.map((option) => numberOf(option.text)), wrong = values.filter((_, i) => i !== q.answer);
  if (new Set(values).size !== 5 || q.options.length !== 5) fail('opsi harus lima nilai yang berbeda');
  for (const value of wrong) {
    const ratio = value / key;
    if (!Number.isInteger(value) || value <= 0 || ratio < DISTRACTOR_SCALE[0] || ratio > DISTRACTOR_SCALE[1]) fail('pengecoh absurd (nol, negatif, pecahan, atau beda skala dengan kunci ' + key + '): ' + value);
  }
  const proof = q.proof.kind === 'numeric' ? q.proof : undefined, recorded = proof?.distractors ?? [];
  if (recorded.length !== 4 || recorded.some((d) => !(d.source in DISTRACTOR_REASONS) || !d.reason.trim() || !wrong.includes(d.value)) || new Set(recorded.map((d) => d.value)).size !== 4 || wrong.some((value) => !recorded.some((d) => d.value === value))) fail('setiap pengecoh deret harus tercatat dengan kode sumber, alasan, dan nilai opsinya');
  for (const d of recorded) if (recomputeDistractor(d.source, kind, given, key) !== d.value) fail('nilai pengecoh ' + d.value + ' tidak sama dengan hitungan ulang sumbernya "' + d.source + '" (' + recomputeDistractor(d.source, kind, given, key) + ')');
}
function checkDeret(q: Question, blocks: NonNullable<ReturnType<typeof parseExplanation>>, fail: (text: string) => void): string {
  const key = numberOf(q.options[q.answer].text), given = (q.stem.split(':').slice(1).join(':').match(/-?\d+/g) ?? []).map(Number), n = given.length;
  const chains = blocks.flatMap((b) => b.k === 'chain' ? [b.chain] : []), paragraphs = blocks.flatMap((b) => b.k === 'p' ? [b.text] : []);
  const kind = q.family === 'fibonacci' || q.family === 'selang-seling' || q.family === 'tiga-jalur' ? q.family : n === 8 ? 'dua-towew' : 'satu-towew';
  const lanes = kind === 'satu-towew' ? 1 : kind === 'dua-towew' ? 2 : kind === 'tiga-jalur' ? 3 : 0;
  if (n < 6) fail('soal harus memuat sedikitnya enam suku');
  checkDeretDistractors(q, kind, given, key, fail);
  if (blocks.some((b) => b.k === 'heading')) fail('deret tidak memakai sub-judul (termasuk Rumus Cepat), mengikuti contoh panduan');
  if (!paragraphs.includes('Pola yang terlihat:')) fail('"Pola yang terlihat:" wajib ada');
  const pattern = chains[chains.length - 1];
  if (!pattern) { fail('diagram pola tidak ada'); return kind; }
  if (chains.length !== (lanes ? 2 : 1)) fail('jumlah diagram: ' + (lanes ? 'arah dan pola' : 'pola saja'));
  const marks = pattern.marks ?? [];
  if (pattern.terms.slice(0, n).join() !== given.join() || pattern.terms.length !== n + 1 || numberOf(pattern.terms[n]) !== key || marks.length !== 1 || marks[0].index !== n) fail('suku pada diagram pola tidak sama dengan soal, atau jawaban tidak ditandai');
  if (lanes) {
    // Konsep towew: panah arah dihitung ulang dari suku soal, tabel konsep baku, dan kalimat "↑ ↓ ↑ artinya N towew".
    const arah = chains[0], tick = directions(given), table = blocks.flatMap((b) => b.k === 'table' ? [b] : [])[0];
    if (towewOf(given) !== lanes) fail('arah suku tidak sesuai ' + lanes + ' towew');
    if (arah.terms.join() !== [...given.map(String), '…'].join() || arah.arcs.length !== n - 1 || arah.arcs.some((a, i) => a.style !== 'tick' || a.label !== tick[i] || a.from !== i || a.to !== i + 1) || arah.loop?.join() !== '0,3') fail('diagram arah: panah ↑/↓ sesuai suku dan lingkaran pada tiga panah pertama');
    if (!table || table.headers.length || table.rows.map((row) => row.join('|')).join(';') !== TOWEW_ROWS.map((row) => row.join('|')).join(';')) fail('tabel konsep towew baku (3 baris, tanpa header) wajib ada');
    if (!paragraphs.includes(tick.slice(0, 3).join(' ') + ' artinya ' + lanes + ' towew')) fail('kalimat "↑ ↓ ↑ artinya N towew" sesuai arah');
  } else if (blocks.some((b) => b.k === 'table')) fail('fibonacci dan campuran tidak memakai tabel towew');
  const arcs = pattern.arcs.filter((a) => (a.style ?? 'arc') === 'arc'), terms = pattern.terms.map(Number);
  if (lanes) {
    // Tiap larik: pola dihitung ulang dari suku soal, setiap panah berlabel pola itu dan benar secara aritmetika (termasuk panah menuju jawaban).
    for (let offset = 0; offset < lanes; offset++) {
      const own = given.filter((_, i) => i % lanes === offset), label = laneLabel(own), mine = arcs.filter((a) => a.from % lanes === offset);
      if (!label) { fail('larik ' + (offset + 1) + ' bukan selisih atau rasio tetap'); continue; }
      if (mine.length !== (offset === n % lanes ? own.length : own.length - 1) || mine.some((a) => a.label !== label || a.to - a.from !== lanes || operate(terms[a.from], a.label) !== terms[a.to])) fail('panah larik ' + (offset + 1) + ' tidak konsisten dengan suku (' + label + ')');
    }
    const next = given.filter((_, i) => i % lanes === n % lanes), nextLabel = laneLabel(next);
    if (!nextLabel || operate(next[next.length - 1], nextLabel) !== key) fail('jawaban tidak sama dengan suku berikutnya pada larik ' + ((n % lanes) + 1));
    if (new Set(arcs.map((a) => a.color)).size !== lanes) fail('tiap larik memiliki warna panah sendiri');
  } else if (kind === 'fibonacci') {
    const drops = pattern.arcs.filter((a) => a.style === 'drop');
    if (arcs.length || drops.length !== terms.length - 2 || terms.some((t, i) => i >= 2 && t !== terms[i - 2] + terms[i - 1]) || drops.some((a) => a.label !== terms[a.to - 2] + '+' + terms[a.to - 1])) fail('fibonacci: tiap suku = jumlah dua suku sebelumnya dan label panah turun sama dengan penjumlahan itu');
    if (!paragraphs.includes('Setiap suku diperoleh dari jumlah dua suku sebelumnya.') || !paragraphs.some((p) => p.endsWith('dan seterusnya.'))) fail('fibonacci: kalimat pola dan daftar penjumlahan wajib ada');
  } else {
    // Campuran: panah +a dan −b bergantian dari suku pertama, satu perhitungan per suku, jawaban = suku terakhir + a.
    const add = terms[1] - terms[0], sub = terms[1] - terms[2];
    if (!(add > 0 && sub > 0 && sub < add) || arcs.length !== n || arcs.some((a, i) => a.from !== i || a.to !== i + 1 || a.label !== (i % 2 ? '−' + sub : '+' + add) || operate(terms[i], a.label) !== terms[i + 1])) fail('campuran: panah +a / −b bergantian dan konsisten dengan suku');
    if (key !== given[n - 1] + add || !paragraphs.some((p) => p.startsWith('Pola campuran: ditambah ' + add + ', lalu dikurangi ' + sub))) fail('campuran: jawaban dan kalimat pola');
    if (paragraphs.filter((p) => /^\d+ [+−] \d+ = \d+$/.test(p)).length !== n) fail('campuran: satu perhitungan per suku (' + n + ')');
  }
  // Setiap perhitungan "a op b = c" pada kalimat benar.
  for (const p of paragraphs) for (const m of p.matchAll(/(\d+) ([+×−]) (\d+) = (\d+)/g)) if (operate(Number(m[1]), m[2] + m[3]) !== Number(m[4])) fail('perhitungan salah pada kalimat: ' + m[0]);
  const wanted = kind === 'dua-towew' || kind === 'selang-seling' ? 'Jadi, bilangan berikutnya adalah ' + key + '. Jawaban yang benar adalah ' + KEY + '.' : 'Jadi, jawaban yang benar adalah ' + KEY + '.';
  if (paragraphs[paragraphs.length - 1] !== wanted || blocks[blocks.length - 1].k !== 'p') fail('penutup "' + wanted + '"');
  return kind;
}

// ---- Tahap 4d: pembahasan figural beranotasi (panduan PDF 158–178) ------------------------------------------------------------------------------
const countParts = (scene: Scene | null | undefined, prefix: string) => scene ? scene.parts.filter((p) => p.id.startsWith(prefix)).length : -1;
const SAME_SCENE = (a: Scene | null | undefined, b: Scene | null | undefined) => !!a && !!b && sameScene(a, b);
// Diagram pembahasan dihitung ulang dari gambar soal: kotak, kunci, label, angka, dan penanda hijau/merah harus sama dengan data soal; huruf opsi hanya lewat {kunci}
// atau diisi dari susunan opsi yang tampil (explanationOf), dan penutupnya baku.
function checkFigural(q: Question, raw: NonNullable<ReturnType<typeof parseExplanation>>, fail: (text: string) => void): string {
  const visual = q.visual, key = q.options[q.answer].scene, letter = String.fromCharCode(65 + q.answer);
  if (!visual || !key || !visual.rule) { fail('soal figural tanpa gambar atau aturan'); return 'tanpa-data'; }
  const shown = parseExplanation(explanationOf(q)) ?? [], figures = shown.flatMap((b) => b.k === 'figure' ? [b.figure] : []), rawFigures = raw.flatMap((b) => b.k === 'figure' ? [b.figure] : []);
  const paragraphs = raw.flatMap((b) => b.k === 'p' ? [b.text] : []), mechanism = visual.rule.mekanisme, scenes = visual.scenes ?? [];
  if (!figures.length || figures.length !== rawFigures.length) fail('pembahasan figural wajib memuat diagram beranotasi');
  if (paragraphs[paragraphs.length - 1] !== 'Jadi, jawaban yang benar adalah ' + KEY + '.' || raw[raw.length - 1].k !== 'p') fail('penutup "Jadi, jawaban yang benar adalah {kunci}."');
  if (/\b(?:opsi|pilihan|gambar)\s+[A-E]\b/i.test(q.explanation) || rawFigures.some((f) => f.cells.some((c) => c.opt && c.caption))) fail('huruf opsi tidak boleh tertulis mati di pembahasan; pakai {kunci} atau kotak opsi (opt)');
  if (raw.some((b) => b.k === 'heading' || b.k === 'table')) fail('pembahasan figural tidak memakai sub-judul atau tabel');
  const tags = figures.flatMap((f) => f.cells.flatMap((c) => c.tag ? [c.tag] : []));
  if (tags.some((tag) => tag !== 'Sesuai dengan gambar pada opsi ' + letter)) fail('tag kunci harus "Sesuai dengan gambar pada opsi ' + letter + '"');
  if (!tags.length) fail('kotak jawaban wajib bertag "Sesuai dengan gambar pada opsi X"');
  if (visual.kind === 'analogi') {
    const [first, second] = figures;
    if (figures.length !== 2 || first.cells.length !== 2 || second.cells.length !== 2) return fail('analogi: dua diagram pasangan (A → B dan C → jawaban)'), mechanism;
    if (!SAME_SCENE(first.cells[0].scene, scenes[0]) || !SAME_SCENE(first.cells[1].scene, scenes[1]) || !SAME_SCENE(second.cells[0].scene, scenes[2]) || !SAME_SCENE(second.cells[1].scene, key)) fail('analogi: gambar pada diagram tidak sama dengan soal dan kunci');
    // QC akademik #2 (soal 58): panah hanya berlabel pendek "Aturan …"; bunyi aturan ditulis bernomor di bawah gambar dan gambar dibesarkan (zoom).
    const n = visual.rule.aturan.length, label = first.links?.[0]?.text ?? '', wantLabel = n === 1 ? 'Aturan 1' : n === 2 ? 'Aturan 1 dan 2' : 'Aturan 1 sampai ' + n;
    const numbered = n === 1 ? paragraphs.filter((p) => p.startsWith('Hubungan yang berlaku: ')).length === 1 : raw.some((b) => b.k === 'list' && b.ordered && b.items.length === n);
    if (label !== wantLabel || label !== second.links?.[0]?.text || !numbered || first.links?.length !== 1 || first.links[0].tone !== 'blue' || (first.zoom ?? 1) < 1.5 || (second.zoom ?? 1) < 1.5) fail('analogi: panah biru berlabel "' + wantLabel + '" pada kedua pasangan, ' + n + ' aturan bernomor di bawah gambar, dan gambar dibesarkan');
    if (second.cells[1].frame !== 'green' || first.cells.some((c) => c.tag || c.frame)) fail('analogi: hanya kotak jawaban yang berbingkai hijau dan bertag');
  } else if (visual.kind === 'ketidaksamaan') {
    const all = figures[0];
    if (all.cells.length !== 5 || !all.cells.every((c, i) => c.opt && SAME_SCENE(c.scene, q.options[i].scene) && c.caption === String.fromCharCode(65 + i))) fail('ketidaksamaan: lima kotak opsi bergambar sama dan berhuruf menurut susunan opsi yang tampil');
    const odd = all.cells[q.answer];
    if (mechanism === 'ketidaksamaan-paritas') {
      const blacks = q.options.map((o) => o.scene!.parts.filter((p) => p.f === 2).length);
      if (all.cells.some((c, i) => c.label?.text !== blacks[i] + ' hitam' || (c.label?.tone === 'red') !== (i === q.answer)) || new Set(blacks.filter((_, i) => i !== q.answer).map((n) => n % 2)).size !== 1 || blacks[q.answer] % 2 === blacks[(q.answer + 1) % 5] % 2) fail('paritas: label jumlah bangun hitam, empat sejenis (hijau) dan satu berbeda (merah)');
    } else if (mechanism === 'ketidaksamaan-sisi') {
      const sides = q.options.map((o) => sidesOf(o.scene!));
      const tones = all.cells.map((c) => c.label?.tone);
      if (all.cells.some((c, i) => c.label?.text !== sides[i] + ' sisi') || tones[q.answer] !== 'red' || sides.filter((v) => v === sides[q.answer]).length !== 1 ||
        sides.some((v, i) => i !== q.answer && sides.some((w, j) => j !== q.answer && (v === w) !== (tones[i] === tones[j])))) fail('sisi: label "n sisi", pasangan sebangsa berwarna sama, dan gambar tanpa pasangan berwarna merah');
    } else if (mechanism === 'ketidaksamaan-urutan') {
      const other = figures[1];
      if (all.cells.some((c) => (c.boxes ?? []).some((box) => box.ids.some((id) => !c.scene!.parts.some((p) => p.id === id))))) fail('urutan: kotak harus mengelilingi bagian yang ada pada gambarnya');
      if (all.cells.some((c, i) => (c.boxes ?? []).some((box) => box.tone !== (i === q.answer ? 'red' : 'blue')))) fail('urutan: kotak merah hanya pada gambar yang berbeda, biru pada empat gambar lain');
      if (figures.length !== 2 || other.cells.length !== 1 || !SAME_SCENE(other.cells[0].scene, key) || other.cells[0].frame !== 'green') fail('urutan: diagram kedua memuat gambar yang berbeda sebagai jawaban');
      if (odd.frame === 'green') fail('urutan: jawaban ditandai pada diagram kedua, bukan pertama');
    } else fail('mekanisme ketidaksamaan tidak dikenal: ' + mechanism);
    if (mechanism !== 'ketidaksamaan-urutan' && (odd.tag !== 'Sesuai dengan gambar pada opsi ' + letter || odd.frame !== 'red')) fail('ketidaksamaan: gambar yang berbeda berbingkai merah dan bertag kunci');
  } else if (visual.kind === 'serial') {
    const fig = figures[0], hidden = scenes.findIndex((s) => s === null), n = scenes.length;
    if (figures.length !== 1 || hidden < 0 || fig.cells.length !== n || fig.columns !== n) return fail('serial: satu diagram dengan satu kotak per gambar deret'), mechanism;
    if (!fig.cells.every((c, i) => c.caption === String(i + 1) && (i === hidden ? SAME_SCENE(c.scene, key) : SAME_SCENE(c.scene, scenes[i])))) fail('serial: kotak bernomor harus sama dengan deret soal dan kotak ' + (hidden + 1) + ' = kunci');
    if (fig.cells[hidden].frame !== 'green' || fig.cells.some((c, i) => i !== hidden && (c.tag || c.frame))) fail('serial: hanya kotak jawaban yang berbingkai hijau dan bertag');
    const links = fig.links ?? [], sides = new Set(links.map((l) => l.side));
    if (!links.length || links.length % (n - 1) !== 0 || links.some((l) => l.to !== l.from + 1 || !l.text) || sides.size > 2 || links.length !== sides.size * (n - 1)) fail('serial: panah berlabel antara kotak berurutan, satu lajur atas dan satu bawah paling banyak');
    if (fig.cells.some((c) => c.corners)) {
      const bad = fig.cells.some((c, i) => !c.corners || c.corners.length !== 2 || Number(c.corners[0].text) !== countParts(i === hidden ? key : scenes[i], 'x@') || Number(c.corners[1].text) !== countParts(i === hidden ? key : scenes[i], 'y@'));
      if (bad) fail('serial: angka di sudut harus sama dengan jumlah bangun x dan y pada kotaknya');
    }
  } else if (visual.kind === 'matriks') {
    const known = scenes.slice(0, 8), last = figures[figures.length - 1];
    const prefixes: Record<string, string[]> = { 'matriks-jumlah': ['bangun@'], 'matriks-jumlah-ganda': ['kiri@', 'kanan@'] };
    if (mechanism.startsWith('matriks-tumpuk')) {
      if (figures.length !== 3 || figures.some((f, r) => f.cells.length !== 3 || f.signs?.join('') !== '+=' || !f.cells.every((c, i) => r === 2 && i === 2 ? SAME_SCENE(c.scene, key) : SAME_SCENE(c.scene, scenes[r * 3 + i])))) fail('tumpuk: tiga diagram baris "kotak + kotak = kotak" sama dengan matriks soal (baris ketiga berakhir pada kunci)');
      if (last.cells[2].frame !== 'green') fail('tumpuk: hasil baris ketiga berbingkai hijau');
    } else if (prefixes[mechanism]) {
      const fig = figures[0];
      if (figures.length !== 1 || fig.cells.length !== 9 || !known.every((s, i) => SAME_SCENE(fig.cells[i].scene, s)) || fig.cells[8].scene !== null || fig.cells[8].frame !== 'green') fail('jumlah: satu diagram 3 × 3 dengan kotak tanda tanya berbingkai hijau');
      else for (const [i, cell] of fig.cells.entries()) {
        const source = i === 8 ? key : scenes[i];
        if ((cell.corners ?? []).map((b) => Number(b.text)).join() !== prefixes[mechanism].map((prefix) => countParts(source, prefix)).join()) fail('jumlah: angka di sudut kotak ' + (i + 1) + ' harus sama dengan banyak bangunnya');
      }
    } else {
      // Satu langkah per bagian: bagian itu dilingkari merah pada kotak yang diketahui (kotak tanda tanya tanpa lingkaran), lalu diagram akhir memuat kunci.
      if (figures.length < 2 || !SAME_SCENE(last.cells[8].scene, key) || last.cells[8].frame !== 'green' || !known.every((s, i) => SAME_SCENE(last.cells[i].scene, s))) fail('matriks: diagram akhir memuat seluruh kotak dan kunci pada kotak kanan bawah');
      for (const fig of figures.slice(0, -1)) {
        if (fig.cells.length !== 9 || fig.cells[8].scene !== null || !known.every((s, i) => SAME_SCENE(fig.cells[i].scene, s))) { fail('matriks: diagram langkah memuat delapan kotak diketahui dan satu kotak tanda tanya'); continue; }
        const rings = fig.cells.slice(0, 8).map((c) => c.rings ?? []);
        if (rings.some((list) => list.length !== 1 || list[0] !== rings[0][0]) || fig.cells.slice(0, 8).some((c, i) => !c.scene!.parts.some((p) => p.id.startsWith((rings[i][0] ?? '').replace('*', '')))) || fig.cells[8].rings?.length) fail('matriks: bagian yang dilingkari ada pada setiap kotak yang diketahui');
      }
      if (paragraphs.filter((p) => p.startsWith('Perhatikan') || p.startsWith('Sekarang perhatikan')).length !== figures.length - 1) fail('matriks: satu kalimat pengantar per diagram langkah');
    }
  }
  return mechanism;
}

export const SUBTYPES = new Set<string>();
// ---- Tahap 4e: rute dan graf, silogisme, analogi verbal ------------------------------------------------------------------------------------------------------
const REASONED = ['silogisme', 'analogi']; // dua-duanya memakai ulasan per opsi (keputusan akademik F.1)
// Silogisme: status tiap opsi dihitung ulang oleh mesin logika; langkah pembahasan (Premis, Kesimpulan) harus sah menurut premis dan berakhir pada kunci.
function checkSilogisme(q: Question, fail: (text: string) => void): string {
  const model = q.proof.kind === 'model' ? q.proof.model : undefined;
  if (!model || (model.kind !== 'syllogism' && model.kind !== 'implication')) return fail('bukti model silogisme tidak ada'), 'tanpa-model';
  const solved = solveModel(q), keyText = q.options[q.answer].text, lines = q.explanation.split('\n');
  if (solved.filter(Boolean).length !== 1 || !solved[q.answer]) fail('kunci berbeda dari hasil solver model');
  if (new Set(q.options.map((o) => o.text)).size !== 5) fail('lima opsi harus berbeda');
  if (/\b(?:opsi|pilihan|jawaban)\s+[A-E]\b/i.test(q.explanation) || q.options.some((o) => /\b(?:opsi|pilihan)\s+[A-E]\b/i.test(o.reason))) fail('huruf opsi tidak boleh tertulis mati');
  if (model.kind === 'implication') {
    const lines = q.explanation.split('\n').map(stripMarks);
    const asked = /^(Konvers|Invers|Kontraposisi) dari kalimat "(.+)" adalah \.\.\.$/.exec(q.stem);
    if (!asked || asked[1].toLowerCase() !== model.asked) fail('soal bentuk implikasi harus menyebut bentuk yang diminta dan kalimat asli');
    q.options.forEach((o, i) => { const key = i === q.answer; if (!o.reason.startsWith(key ? 'Sesuai dengan yang diminta: ' : 'Tidak sesuai: ') || o.reason.length < 40) fail('ulasan opsi bentuk implikasi tidak sesuai statusnya: ' + o.reason.slice(0, 50)); });
    const rule = lines.find((line) => line.startsWith('• Penerapan Rumus: '));
    const expected = { konvers: 'q \\to p', invers: '\\neg p \\to \\neg q', kontraposisi: '\\neg q \\to \\neg p' }[model.asked];
    if (!lines[0].startsWith('Pernyataan Asli: ') || !rule || rule !== '• Penerapan Rumus: ' + model.asked.charAt(0).toUpperCase() + model.asked.slice(1) + ' memiliki rumus \\(' + expected + '\\).' || lines[lines.length - 1] !== '• Kesimpulan Akhir: ' + keyText) fail('pembahasan bentuk implikasi: pernyataan asli, identifikasi variabel, rumus, dan kesimpulan akhir wajib sesuai kunci');
    return 'implikasi-' + model.asked;
  }
  // Silogisme blueprint akademik 28 Okt: pemeriksa mandiri (scripts/silogisme-checks.ts) menghitung ulang tabel kebenaran, jenis kesalahan, stem, dan format pembahasan.
  const chapter = checkSilogismeBlueprint(q, fail);
  SUBTYPES.add('silogisme-chapter:' + chapter);
  return chapter;
}

// Analogi verbal: jenis dan arah hubungan dihitung ulang dari katalog; ulasan tiap opsi menyebut sepadan atau tidak sepadan dengan alasannya.
const wordsOfCatalog = RELATIONS.flatMap((relation) => relation.pairs.flat());
function checkAnalogi(q: Question, fail: (text: string) => void): string {
  const model = q.proof.kind === 'model' ? q.proof.model : undefined;
  if (!model || model.kind !== 'analogy') return fail('bukti model analogi tidak ada'), 'tanpa-model';
  const premiseText = q.stem.replace(' = … : …', ''), premise = lookupPair(premiseText);
  if (q.stem !== premiseText + ' = … : …' || !premise || premise.reversed) return fail('soal harus berbentuk "A : B = … : …" dengan pasangan katalog'), 'tanpa-pasangan';
  const target = relationById(premise.relation);
  if (model.target !== target.id) fail('jenis hubungan model berbeda dari katalog');
  const found = q.options.map((o) => lookupPair(o.text));
  if (found.some((f) => !f) || new Set(q.options.map((o) => o.text)).size !== 5) return fail('setiap opsi harus pasangan katalog yang berbeda'), target.id;
  const keys = found.flatMap((f, i) => f!.relation === target.id && !f!.reversed ? [i] : []);
  if (keys.length !== 1 || keys[0] !== q.answer) fail('tepat satu opsi berjenis dan berarah sama dengan soal, dan itu kuncinya');
  q.options.forEach((o, i) => {
    const f = found[i]!, rel = relationById(f.relation), key = i === q.answer, reversed = f.reversed;
    if (!o.reason.startsWith(o.text + ': hubungan ' + rel.name) || !o.reason.includes(key ? '; sepadan, karena ' : '; tidak sepadan, karena ') || o.reason.length < 60) fail('ulasan opsi ' + (i + 1) + ' harus memuat pasangan, jenis hubungan, sepadan atau tidak, dan alasannya: ' + o.reason.slice(0, 70));
    if (!key && !reversed && !o.reason.includes('bukan ' + target.name)) fail('ulasan pengecoh jenis lain harus menyebut jenis hubungan soal: ' + o.reason.slice(0, 70));
    if (!key && reversed && !o.reason.includes('arah terbalik')) fail('ulasan pengecoh berarah terbalik harus menyebut arah terbalik');
  });
  const words = premiseText.toLowerCase().split(' : '), keyWords = q.options[q.answer].text.toLowerCase().split(' : ');
  if (!q.explanation.includes('Kata "' + words[0] + '" dan "' + words[1] + '" memiliki hubungan ' + target.name) || !q.explanation.includes('Pola yang sama terdapat pada opsi ' + KEY + ', yaitu "' + keyWords[0] + '" dan "' + keyWords[1] + '"') ||
    /\b(?:opsi|pilihan)\s+[A-E]\b/i.test(q.explanation)) fail('pembahasan: hubungan soal, "Pola yang sama terdapat pada opsi {kunci}", dan pasangan kunci');
  if (new Set(wordsOfCatalog).size !== wordsOfCatalog.length) fail('kata pada katalog analogi harus unik agar tidak ada pasangan ganda');
  SUBTYPES.add('analogi:' + target.id);
  return target.id;
}

// Rute dan jalur: rute sederhana dihitung ulang dengan penelusuran sendiri; daftar rute, kalimat jumlah, graf, dan pengecoh diperiksa terhadap sisi yang dibaca dari cerita soal.
function checkRute(q: Question, blocks: NonNullable<ReturnType<typeof parseExplanation>>, fail: (text: string) => void): string {
  const model = q.proof.kind === 'model' && q.proof.model.kind === 'route' ? q.proof.model : undefined;
  if (!model) return fail('model rute tidak ada'), 'tanpa-model';
  const names = model.nodes, index = (name: string) => names.indexOf(name);
  // Stem berupa cerita (contoh panduan Rute dan Jalur): sisi ditulis sebagai kalimat; sisi dibaca kembali dari teks dan harus sama dengan model.
  const [story, ask, ...extra] = q.stem.split('\n'), unit = /melihat (\S+) [A-L]\./.exec(story)?.[1];
  if (extra.length || q.table || !unit || !/^[A-Z]\w+ pergi ke [^.]+\. Di dekat pintu masuk, ia melihat /.test(story)) fail('stem rute: cerita satu paragraf, "Di dekat pintu masuk, ia melihat ...", tanpa tabel sisi');
  if (!ask || !new RegExp('^Berapa banyak rute yang dapat dilewati \\w+ dari pintu masuk hingga pintu keluar jika tidak diperbolehkan mengunjungi ' + unit + ' sebelumnya\\?$').test(ask)) fail('stem rute: pertanyaan "Berapa banyak rute ... jika tidak diperbolehkan mengunjungi ... sebelumnya?"');
  const letters = (text: string) => [...text.matchAll(/\b[A-L]\b/g)].map((m) => m[0]), edgesText: [string, string][] = [];
  for (const m of story.matchAll(new RegExp('Dari ' + unit + ' (\\S+) dapat (?:pergi ke|menuju) ' + unit + ' ([^.]+)\\.', 'g'))) for (const to of letters(m[2])) edgesText.push([m[1], to]);
  for (const m of story.matchAll(new RegExp('\\w+ ([A-L]) dan ' + unit + ' ([A-L]) saling terhubung\\.', 'g'))) edgesText.push([m[1], m[2]], [m[2], m[1]]);
  const exit = /Dari \w+ ([^.]+?) langsung dapat menuju \w+ ([A-L]) yang berada di dekat pintu keluar\./.exec(story);
  if (!exit || exit[2] !== names[names.length - 1] || !new RegExp('melihat ' + unit + ' ' + names[0] + '\\.').test(story)) fail('stem rute: simpul masuk dan simpul keluar harus sama dengan model');
  if (exit) for (const from of letters(exit[1])) edgesText.push([from, exit[2]]);
  const edges = model.edges.map(([from, to]) => [index(from), index(to)] as [number, number]);
  if (edges.some(([a, b]) => a < 0 || b < 0 || a === b) || new Set(edges.map((e) => e.join())).size !== edges.length) fail('sisi model harus berbeda antarsimpul');
  if (edgesText.map((e) => e.join('>')).sort().join('|') !== model.edges.map((e) => e.join('>')).sort().join('|')) fail('sisi pada cerita tidak sama dengan sisi model: ' + edgesText.map((e) => e.join('>')).sort().join(',') + ' vs ' + model.edges.map((e) => e.join('>')).sort().join(','));
  const routes: number[][] = [], walk = (path: number[]) => { const here = path[path.length - 1]; if (here === names.length - 1) { routes.push(path); return; } for (const [a, b] of edges) if (a === here && !path.includes(b)) walk([...path, b]); };
  walk([0]);
  const count = routes.length, listed = blocks.flatMap((b) => b.k === 'list' ? [b] : [])[0], paragraphs = blocks.flatMap((b) => b.k === 'p' ? [b.text] : []);
  if (optionNumber(q.options[q.answer].text) !== count) fail('kunci ' + q.options[q.answer].text + ' berbeda dari banyak rute hitungan ulang (' + count + ')');
  if (paragraphs[0] !== 'Daftar rute yang mungkin adalah sebagai berikut:' || !listed || !listed.ordered || listed.start !== 1) fail('"Daftar rute yang mungkin adalah sebagai berikut:" lalu daftar bernomor mulai dari 1');
  const shownRoutes = listed?.items ?? [], expected = routes.map((route) => route.map((n) => names[n]).join(' – '));
  if (shownRoutes.slice().sort().join('|') !== expected.slice().sort().join('|') || new Set(shownRoutes).size !== shownRoutes.length) fail('daftar rute (' + shownRoutes.length + ') tidak sama dengan semua rute hitungan ulang (' + count + ')');
  if (paragraphs[1] !== 'Jadi, terdapat ' + count + ' rute yang dapat dilewati.' || paragraphs[2] !== 'Jadi, jawaban yang benar adalah ' + KEY + '.') fail('kalimat "Jadi, terdapat N rute yang dapat dilewati." dan penutup baku');
  const graphs = blocks.flatMap((b) => b.k === 'graph' ? [b.graph] : []), last = blocks[blocks.length - 1];
  if (graphs.length !== 1 || last.k !== 'graph' || graphs[0].nodes.join() !== names.join() || graphs[0].entry !== 0 || graphs[0].exit !== names.length - 1 || graphs[0].edges.map((e) => e.join()).sort().join('|') !== edges.map((e) => e.join()).sort().join('|')) fail('graf: simpul, sisi, simpul masuk, dan simpul keluar sama dengan sisi pada cerita soal dan berada setelah kalimat penutup');
  if (graphs[0]?.routes?.join('|') !== routes.map((route) => route.map((n) => names[n]).join('-')).join('|')) fail('graf: kotak "Jumlah rute valid" memuat semua rute dalam urutan yang sama dengan daftar pembahasan (contoh panduan)');
  const values = q.options.map((o) => optionNumber(o.text)), wrong = values.filter((_, i) => i !== q.answer), recorded = model.distractors ?? [];
  if (q.options.some((o) => !/^\d+ rute$/.test(o.text)) || new Set(values).size !== 5 || wrong.some((v) => v < 1 || v > 4 * count + 4)) fail('opsi rute: bilangan bulat positif berbeda dengan satuan "rute" dan dalam rentang logis: ' + q.options.map((o) => o.text).join('; '));
  if (recorded.length !== 4 || recorded.some((d) => d.source !== 'konsep' || !d.reason.trim() || !wrong.includes(d.value)) || wrong.some((v) => !recorded.some((d) => d.value === v))) fail('setiap pengecoh rute harus tercatat sebagai kesalahan konsep dengan alasan');
  const twoWay = edges.some(([a, b]) => edges.some(([x, y]) => x === b && y === a));
  SUBTYPES.add('rute:' + (twoWay ? 'dua-arah' : 'searah'));
  return count + '-rute';
}

// Rupiah selalu dengan titik ribuan ("Rp60.000"), di stem, tabel, opsi, alasan, dan pembahasan (QA akhir B5); berlaku untuk semua keluarga, termasuk bus dan pernyataan tabel.
export function rupiahProblems(q: Question): string[] {
  const pieces = [q.stem, q.explanation, ...(q.table?.rows.flat() ?? []), ...q.options.flatMap((option) => [option.text, option.reason])];
  return pieces.filter((piece) => /Rp\}?\s?\d{4,}/.test(piece)).map((piece) => q.family + ': rupiah tanpa titik ribuan: ' + piece.slice(0, 60));
}

export function checkTiuFormat(q: Question): string[] {
  const problems: string[] = rupiahProblems(q);
  const fail = (text: string) => problems.push(q.family + ': ' + text);
  if (q.family === 'argumen') { checkArgumen(q, fail); return problems; }
  const blocks = parseExplanation(q.explanation), reasoned = REASONED.includes(q.family);
  if (!blocks && !reasoned) return [q.family + ': pembahasan tidak berstruktur (tanpa baris "=", butir, sub-judul, tabel, atau persamaan)'];
  const text = q.explanation, key = q.options[q.answer].text;
  for (const phrase of GENERIC_PHRASES) if (phrase.test(text)) fail('frasa generik ' + phrase);
  if (workingNote(text)) fail('sisa catatan penyusunan');
  if (!reasoned && q.options.some((option) => option.reason.trim())) fail('alasan per opsi tidak boleh ada');
  const biasa = q.family === 'silogisme' && q.proof.kind === 'model' && q.proof.model.kind === 'syllogism' && ['2 Premis', '3 Premis'].includes(q.proof.model.chapter ?? '');
  if (reasoned && !biasa && q.options.some((option) => !option.reason.trim())) fail('ulasan per opsi wajib ada pada silogisme narasi, bentuk implikasi, dan analogi verbal (Silogisme Biasa tanpa analisis opsi)');
  if (q.tip) fail('field tip tidak ditampilkan untuk keluarga ini');
  for (const piece of explanationTexts(text)) if (mathHtml(piece).includes('math-error')) fail('LaTeX tidak terbaca: ' + piece.slice(0, 60));
  if (q.family === 'silogisme') { SUBTYPES.add('silogisme:' + checkSilogisme(q, fail)); return problems; }
  if (q.family === 'analogi') { checkAnalogi(q, fail); return problems; }
  if (!blocks) return problems;
  const maths = blocks.filter((b) => b.k === 'math');
  if (q.family === 'cerita-hitung') SUBTYPES.add('cerita-hitung:' + checkStory(q, blocks, fail));
  else if (['posisi', 'peringkat', 'jadwal'].includes(q.family)) checkPosisi(q, blocks, fail);
  else if (q.family === 'kategori') SUBTYPES.add('kategori:' + checkKategori(q, blocks, fail));
  else if (q.family === 'rute') checkRute(q, blocks, fail);
  else if (DERET_FAMILIES.includes(q.family)) { SUBTYPES.add('deret:' + checkDeret(q, blocks, fail)); return problems; }
  else if (FIGURAL_FAMILIES_CHECKED.includes(q.family)) { SUBTYPES.add('figural:' + checkFigural(q, blocks, fail)); return problems; }

  if (q.family === 'hitung' || q.family === 'pecahan') {
    // Ekspresi, lalu tiap baris diawali "=" sampai hasil; tanpa kalimat penutup (PDF 60–62).
    // Tanpa pecahan istimewa satu blok persamaan; dengan tabel, ekspresi ada di blok pertama dan baris "=" di blok kedua.
    const rows = maths.flatMap((b) => b.k === 'math' ? alignedRows(b.text) ?? [] : []);
    if (blocks[blocks.length - 1].k !== 'math' || rows.length < 3) return [...problems, q.family + ': blok persamaan bertingkat tidak ada atau terlalu pendek'];
    if (rows[0].startsWith('=') || !rows.slice(1).every((row) => row.startsWith('='))) fail('baris pertama ekspresi, baris berikutnya wajib diawali "="');
    if (blocks.some((b) => b.k === 'p' && b.text !== SPECIAL_SENTENCE)) fail('kalimat penutup/narasi tidak ada dalam contoh panduan');
    const answer = numberOf(key);
    try { if (!rows.every((row) => close(latexValue(row), answer))) fail('ada baris persamaan yang nilainya berbeda dari kunci ' + key); } catch (error) { fail('baris persamaan tidak terhitung: ' + (error as Error).message); }
    if (!close(latexValue(rows[rows.length - 1]), answer) || !/^=[-\d{},]+$/.test(rows[rows.length - 1].replace(/\s/g, ''))) fail('baris terakhir harus hasil akhir berupa angka');
    if (new Set(optionTexts(q).map(decimals)).size !== 1) fail('opsi tidak seragam bentuk (desimal semua atau bilangan bulat semua): ' + optionTexts(q).join('; '));
    const fractions = [...q.stem.matchAll(/(\d+)\/(\d+)/g)].map((m) => m[1] + '/' + m[2]), special = fractions.some((f) => SPECIAL_FRACTIONS.includes(f));
    const tables = blocks.filter((b) => b.k === 'guide' && b.id === 'pecahan-istimewa'), at = blocks.findIndex((b) => b.k === 'guide' && b.id === 'pecahan-istimewa');
    if (special !== (tables.length === 1)) fail('tabel pecahan istimewa harus ada tepat bila soal memakai pecahan istimewa (soal: ' + q.stem + ')');
    if (special && !(at > 0 && blocks[at - 1].k === 'p' && blocks.findIndex((b) => b.k === 'math') < at && maths.length === 2 && blocks.lastIndexOf(maths[1]) > at)) fail('urutan: ekspresi, kalimat tabel, tabel, lalu baris "="');
    if (q.family === 'hitung' && (tables.length || blocks.length !== 1)) fail('hitung bilangan bulat tidak memakai tabel atau kalimat');
  } else if (q.family === 'tabel') {
    const bullets = blocks.find((b) => b.k === 'list'), known = (q.table?.rows ?? []).filter((row) => row[1] !== '?');
    if (blocks[0].k !== 'p' || blocks[0].text !== 'Perhatikan hubungan antara urutan dan nilainya.') fail('kalimat pembuka baku tidak ada');
    if (!bullets || bullets.k !== 'list' || bullets.ordered || bullets.items.length !== known.length) fail('butir "Urutan ke-n →" harus satu per baris tabel yang diketahui (' + known.length + ')');
    const evaluate = (chain: string) => chain.replace(/\\\(|\\\)/g, '').replace(/\^\{2\}/g, '²').replace(/(\d+)\((\d+)\)²/g, '$1*$2*$2').replace(/(\d+)\((\d+)\)/g, '$1*$2').split('=').map((part) => calculate(part));
    if (bullets?.k === 'list') bullets.items.forEach((item, i) => {
      const found = /^Urutan ke-(\d+) → (.+)$/.exec(item);
      if (!found || found[1] !== known[i]?.[0]) return fail('butir ' + (i + 1) + ' tidak memuat urutan ke-' + known[i]?.[0]);
      const values = evaluate(found[2]);
      if (values.length < 2 || !values.every((v) => close(v, Number(known[i][1])))) fail('butir urutan ke-' + found[1] + ' tidak menghasilkan nilai tabel ' + known[i][1]);
    });
    const target = /Berapakah nilai pada urutan ke-(\d+)\?/.exec(q.stem)?.[1];
    const finalSentence = blocks[blocks.length - 1], untuk = blocks.find((b) => b.k === 'p' && b.text.startsWith('Untuk urutan ke-'));
    if (!blocks.some((b) => b.k === 'p' && b.text === 'Maka pola yang digunakan adalah:') || !blocks.some((b) => b.k === 'p' && /^\\\(\\text\{Nilai\}=/.test(b.text))) fail('rumus pola tidak ditulis');
    if (!untuk || untuk.k !== 'p' || !new RegExp('^Untuk urutan ke-' + target + ' → ').test(untuk.text) || !evaluate(untuk.text.replace(/^.*? → /, '')).every((v) => close(v, numberOf(key)))) fail('baris untuk urutan yang ditanyakan tidak menghasilkan kunci');
    if (finalSentence.k !== 'p' || finalSentence.text !== 'Jadi, nilai pada urutan ke-' + target + ' adalah ' + key + '.') fail('kalimat penutup "Jadi, nilai pada urutan ke-n adalah ..." tidak sesuai kunci');
  } else if (q.family === 'data') {
    const model = q.proof.kind === 'model' && q.proof.model.kind === 'data' ? q.proof.model : undefined;
    if (!model) return [...problems, 'data: bukti model tidak ada'];
    if (optionTexts(q).join('|') !== DATA_LABELS.join('|')) fail('opsi baku A–E harus berurutan tetap');
    if (JSON.stringify(model.first) === JSON.stringify(model.second)) fail('pernyataan (1) dan (2) identik');
    const sets = { first: worldsOf(model, model.first), second: worldsOf(model, model.second), both: worldsOf(model, [...model.first, ...model.second]) };
    const decided = (list: { x: number; y: number }[]) => new Set(list.map((w) => targetOf(model, w))).size === 1;
    const first = decided(sets.first), second = decided(sets.second), both = decided(sets.both);
    const expected = first && second ? 3 : first ? 0 : second ? 1 : both ? 2 : 4;
    if (DATA_LABELS[expected] !== key) fail('kunci "' + key + '" tidak sama dengan hasil pengujian "' + DATA_LABELS[expected] + '"');
    const lines = text.split('\n'), sections = { 1: lines.indexOf('Pernyataan (1):'), 2: lines.indexOf('Pernyataan (2):'), both: lines.indexOf('Pernyataan (1) dan (2) bersama-sama:') };
    if (!(sections[1] === 0 && sections[2] > sections[1])) fail('blok "Pernyataan (1):" lalu "Pernyataan (2):" wajib berurutan di awal');
    if ((sections.both >= 0) !== (!first && !second)) fail('blok gabungan hanya ada bila tidak ada pernyataan yang cukup sendiri');
    const verdicts = lines.filter((line) => /^Pernyataan \([12]\) SAJA (?:cukup|tidak cukup)\.$/.test(line));
    if (verdicts.join('|') !== ['Pernyataan (1) SAJA ' + (first ? 'cukup.' : 'tidak cukup.'), 'Pernyataan (2) SAJA ' + (second ? 'cukup.' : 'tidak cukup.')].join('|')) fail('kesimpulan per pernyataan tidak sesuai pengujian: ' + verdicts.join(' / '));
    if (sections.both >= 0 && !blocks.some((b) => b.k === 'heading' && b.text === 'Diketahui:')) fail('blok gabungan memuat "Diketahui:"');
    if (sections.both >= 0 && !lines.some((line) => line.startsWith(both ? 'Jadi, kedua pernyataan bersama-sama cukup untuk menentukan' : 'Jadi, kedua pernyataan bersama-sama tetap tidak cukup'))) fail('kalimat "Jadi, kedua pernyataan bersama-sama ..." tidak sesuai');
    // Pernyataan yang tidak cukup wajib menunjukkan dua nilai berbeda yang sama-sama memenuhi.
    const examples = [...text.matchAll(/Misalnya: \\\(x=(\d+),\\;y=(\d+)\\\), maka nilai .*? adalah (\d+)\. Namun, bisa juga: \\\(x=(\d+),\\;y=(\d+)\\\), maka nilai .*? adalah (\d+)\./g)];
    const needed = [!first, !second, !first && !second && !both].filter(Boolean).length, groups = [[model.first, !first], [model.second, !second], [[...model.first, ...model.second], !first && !second && !both]] as const;
    if (examples.length !== needed) fail('contoh dua nilai wajib untuk setiap bagian yang tidak cukup (' + examples.length + ' dari ' + needed + ')');
    let used = 0;
    for (const [conditions, wanted] of groups) if (wanted && examples[used]) {
      const e = examples[used++].slice(1).map(Number), pairs = [{ x: e[0], y: e[1] }, { x: e[3], y: e[4] }];
      const okPairs = pairs.every((w) => worldsOf(model, conditions).some((v) => v.x === w.x && v.y === w.y));
      if (!okPairs || e[2] === e[5] || e[2] !== targetOf(model, pairs[0]) || e[5] !== targetOf(model, pairs[1])) fail('contoh dua nilai tidak memenuhi pernyataan atau tidak menghasilkan nilai berbeda');
    }
  }
  return problems;
}

const LEVELS: Difficulty[] = ['mudah', 'sedang', 'sulit'];
const sample = (family: string, level: Difficulty, seed: number): Question => ({ ...makeTiu(TIU_FAMILIES.find((f) => f.id === family)!, level, rng('format-' + family + '-' + level + '-' + seed)), id: 'format', no: 1 });

// Pemeriksaan gabungan verbal analitis: tiga subbentuk susunan dan posisi, tingkat sesuai permintaan, pembangkit argumen (>= 30 butir, kunci tidak selalu terpanjang), profil
// tryout (5 paket x 3 butir argumen tanpa ulang pada profil variasi; sembilan contoh diterima tetap dipakai pada profil contoh diterima), dan isolasi undian aliran bersama.
export function runAnalitisChecks(check: Check): Record<string, unknown> {
  const report: Record<string, unknown> = {};
  const row17 = MAPPING_ROWS.find((r) => r.row === 17)!, row18 = MAPPING_ROWS.find((r) => r.row === 18)!;
  // A. Susunan dan posisi: tiga bentuk, level sesuai permintaan, pertanyaan bervariasi, stem tanpa "Terdapat beberapa informasi".
  const forms: Record<string, Record<string, number>> = { sedang: {}, sulit: {} }, asks = new Set<string>(), levelMiss: string[] = [], SAMPLES = 250;
  let sentences = 0, karena = 0, stacked = 0, hanyaMungkin = 0, explained = 0;
  for (const level of ['sedang', 'sulit'] as const) for (let seed = 0; seed < SAMPLES; seed++) {
    const q = sample('posisi', level, 300 + seed), model = q.proof.kind === 'model' && q.proof.model.kind === 'arrangement' ? q.proof.model : undefined;
    check(!!model, 'posisi: model susunan ada');
    if (!model) continue;
    forms[level][model.geo.form] = (forms[level][model.geo.form] ?? 0) + 1;
    asks.add(model.geo.form + ':' + q.stem.split('\n')[1].replace(/\b[A-Z][a-z]+\b|\b[A-H]\b/g, 'X').replace(/\d+/g, 'n'));
    if (q.difficulty !== level) levelMiss.push(level + '/' + seed);
    // Mutu kalimat pembahasan (seluruh sampel): proporsi kalimat "Karena", tumpukan tiga klausa, dan pengulangan "hanya mungkin berada di".
    const list = explanationSentences(q.explanation);
    sentences += list.length; karena += list.filter((s) => s.startsWith('Karena ')).length; stacked += list.filter(stacksThreeClauses).length; hanyaMungkin += (q.explanation.match(/hanya mungkin/g) ?? []).length; explained++;
  }
  // Sebaran bentuk: bobot 4:3:3 (linear, melingkar, baris-kolom) per tingkat. Bentuk dipilih sekali per butir (undian berbobot), sehingga selisih dari 40/30/30 hanya galat sampel (+-3 poin pada 250 butir); batas 8 poin.
  const target: Record<string, number> = { linear: 40, circular: 30, grid: 30 };
  for (const level of ['sedang', 'sulit']) for (const form of Object.keys(target)) {
    const share = 100 * (forms[level][form] ?? 0) / SAMPLES;
    check(Math.abs(share - target[form]) <= 8, 'Susunan dan posisi (' + level + '): bentuk ' + form + ' ' + share.toFixed(1) + '% dari ' + SAMPLES + ' butir, sasaran ' + target[form] + '% (+-8 poin)');
  }
  check(levelMiss.length <= 5, 'Susunan dan posisi: tingkat sesuai permintaan (meleset ' + levelMiss.length + ' dari ' + 2 * SAMPLES + '): ' + levelMiss.join(', '));
  check(asks.size >= 14, 'Susunan dan posisi: pertanyaan bervariasi (' + asks.size + ' bentuk berbeda)');
  check(karena / sentences <= 0.35, 'Pembahasan susunan: kalimat berawal "Karena" paling banyak 35% (' + (100 * karena / sentences).toFixed(1) + '%)');
  check(stacked === 0, 'Pembahasan susunan: tidak ada kalimat dengan tumpukan tiga klausa (' + stacked + ')');
  check(hanyaMungkin / explained <= 5, 'Pembahasan susunan: "hanya mungkin berada di" rata-rata paling banyak 5 kali per butir (' + (hanyaMungkin / explained).toFixed(1) + ')');
  report.posisi = { forms, questionForms: asks.size, levelMiss: levelMiss.length, karenaPersen: Math.round(1000 * karena / sentences) / 10, hanyaMungkinRata: Math.round(10 * hanyaMungkin / explained) / 10 };
  // Urutan dan peringkat serta jadwal: kalimat penutup baku, tanpa "Informasi n:", "Karena" paling banyak 35%, dan semua tema tampil dengan Bloom C4 sampai C6 (pemeriksa per butir: checkPosisi).
  let themedSentences = 0, themedKarena = 0, themedClosing = 0, themedTotal = 0;
  const themes = new Set<string>();
  for (const family of ['peringkat', 'jadwal']) for (const level of ['sedang', 'sulit'] as const) for (let seed = 0; seed < 40; seed++) {
    const q = sample(family, level, 700 + seed), model = q.proof.kind === 'model' && q.proof.model.kind === 'arrangement' ? q.proof.model : undefined;
    check(!!model && model.geo.form === 'linear', family + ': model susunan linear bertema');
    if (!model || model.geo.form !== 'linear') continue;
    themes.add(model.geo.style); themedTotal++;
    const list = explanationSentences(q.explanation);
    themedSentences += list.length; themedKarena += list.filter((s) => s.startsWith('Karena ')).length;
    if (q.explanation.split('\n').includes('Jadi, jawaban yang benar adalah {kunci}.') && !/[Ii]nformasi \d+:/.test(q.explanation)) themedClosing++;
  }
  check(themedClosing === themedTotal, 'Peringkat dan jadwal: kalimat penutup baku ada dan tanpa "Informasi n:" (' + themedClosing + ' dari ' + themedTotal + ')');
  check(themedKarena / themedSentences <= 0.35, 'Peringkat dan jadwal: kalimat berawal "Karena" paling banyak 35% (' + (100 * themedKarena / themedSentences).toFixed(1) + '%)');
  check(['lomba', 'nilai', 'datang', 'tinggi', 'jadwal'].every((style) => themes.has(style)), 'Peringkat dan jadwal: semua tema tampil pada contoh (' + [...themes].join(', ') + ')');
  // Diagram duduk melingkar (contoh panduan): tampil di kartu soal, terbaca pada salinan teks, dan gambarnya sah; graf rute memuat kotak "Jumlah rute valid".
  let ringChecked = 0;
  for (let seed = 0; seed < 120 && ringChecked < 3; seed++) {
    const q = sample('posisi', 'sulit', 900 + seed);
    if (q.proof.kind !== 'model' || q.proof.model.kind !== 'arrangement' || q.proof.model.geo.form !== 'circular') continue;
    ringChecked++;
    const html = renderToStaticMarkup(createElement(QuestionCard, { question: q, showAnswers: true })), plain = explanationPlain(explanationOf(q));
    check(html.includes('explanation-graph') && html.includes('aria-label="Diagram duduk melingkar: ') && html.includes('Petunjuk kunci') && !html.includes('@graf') && !html.includes('math-error'), 'melingkar: kartu soal menampilkan diagram lingkaran (kursi bernomor, Petunjuk kunci, kotak kesimpulan)');
    check(plain.includes('Kursi 1: ') && plain.includes('Petunjuk kunci: 1. ') && plain.includes('Kesimpulan: ') && !plain.includes('@graf') && !plain.includes('{kunci}') && diagramProblems(q).length === 0, 'melingkar: salinan teks memuat penghuni kursi, petunjuk kunci, dan kesimpulan; gambar sah');
  }
  check(ringChecked === 3, 'melingkar: tiga contoh diagram lingkaran ditemukan (' + ringChecked + ')');
  const rute = sample('rute', 'sulit', 910), ruteGraph = (parseExplanation(explanationOf(rute)) ?? []).flatMap((b) => b.k === 'graph' ? [b.graph] : [])[0];
  check(!!ruteGraph?.routes?.length && graphSvg(ruteGraph).includes('Jumlah rute valid = ' + ruteGraph.routes.length) && graphSvg(ruteGraph).includes('Jalur searah'), 'rute: graf memuat kotak "Jumlah rute valid" dan keterangan jalur seperti contoh panduan');
  // Baris 18 pada profil tryout: tidak ada soal kembar pada lima paket, kedua profil.
  for (const tiuSource of ['accepted', 'variation'] as const) {
    const packs = generateTryout(normalizeSettings({ ...DEFAULT_SETTINGS, mode: 'TIU', count: 2, subtopics: ['Verbal::Susunan & Posisi'], profile: 'tryout-2027', tiuSource, packages: 3, seed: 'analitis-18' } as never), fingerprint);
    const rows = packs.flatMap((pack) => pack.questions.filter((x) => x.mappingId === row18.id));
    check(rows.length === 6 && new Set(rows.map(fingerprint)).size === 6, tiuSource + ': baris 18 tiga paket tanpa soal kembar');
    if (tiuSource === 'variation') for (const x of rows) check(x.proof.kind === 'model' && x.proof.model.kind === 'arrangement' && !/\n\d+\. /.test(x.stem), 'baris 18 variasi memakai pembangkit baru tanpa daftar bernomor');
  }
  // B. Memperkuat/memperlemah argumen.
  check(SKENARIO.length * 2 >= 30, 'Argumen: paling sedikit 30 butir unik (' + SKENARIO.length * 2 + ')');
  let longest = 0, shortest = 0, total = 0;
  const seen = new Set<string>(), roleLengths: Record<string, number[]> = {};
  for (let s = 0; s < 3; s++) for (const level of ['sedang', 'sulit'] as const) {
    const stems = new Set<string>();
    for (let i = 0; i < SKENARIO.length; i++) {
      const draft = makeMappedTiu(row17, level, rng('argumen-' + s + level + i), 0, { seed: 'argumen-' + s, used: () => i }), x: Question = { ...draft, id: 'argumen', no: 1, family: 'argumen' };
      const problems = checkTiuFormat(x);
      check(problems.length === 0, 'argumen ' + s + '/' + level + '/' + i + ': ' + problems.join('; ') + '\n' + x.stem + '\n' + x.explanation);
      check(x.difficulty === level, 'argumen: tingkat sesuai permintaan');
      stems.add(x.stem); seen.add(x.stem);
      const lengths = x.options.map((o) => o.text.length);
      total++; if (lengths.every((len, k) => k === x.answer || len < lengths[x.answer])) longest++;
      if (lengths.every((len, k) => k === x.answer || len > lengths[x.answer])) shortest++;
      if (x.proof.kind === 'model' && x.proof.model.kind === 'argument') x.proof.model.options.forEach((o) => (roleLengths[o.role] ??= []).push(o.text.length));
    }
    check(stems.size === SKENARIO.length, 'argumen ' + s + '/' + level + ': ' + SKENARIO.length + ' butir berbeda untuk satu tingkat tanpa ulang (' + stems.size + ')');
  }
  check(seen.size >= 30, 'Argumen: paling sedikit 30 stem unik (' + seen.size + ')');
  check(longest / total <= 0.25, 'Argumen: kunci terpanjang paling banyak 25% (' + longest + ' dari ' + total + ')');
  // Kunci juga tidak boleh hampir selalu terpendek atau tidak pernah di ujung panjang: kedua ujung memberi petunjuk sama kuatnya.
  check(shortest / total <= 0.25 && longest / total >= 0.05 && shortest / total >= 0.05, 'Argumen: kunci terpendek 5% sampai 25% dan terpanjang 5% sampai 25% (' + shortest + ' terpendek, ' + longest + ' terpanjang dari ' + total + ')');
  // Panjang rata-rata tiap peran (kunci, arah terbalik, sebagian, dan tiga pengecoh netral) berselisih paling banyak 10% dari panjang rata-rata kunci.
  const mean = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length, keyMean = mean(roleLengths.kunci ?? [1]);
  const roleGaps = Object.entries(roleLengths).map(([role, list]) => [role, Math.abs(mean(list) / keyMean - 1)] as const);
  check(Object.keys(roleLengths).length === 6 && roleGaps.every(([, gap]) => gap <= 0.1), 'Argumen: panjang rata-rata tiap peran opsi sebanding dengan kunci (selisih paling banyak 10%): ' + roleGaps.map(([role, gap]) => role + ' ' + Math.round(gap * 100) + '%').join(', '));
  check(HEDGE_MARKER.test('warga menilai tampilan mudah dibaca, tetapi belum diketahui apakah mereka memakainya') && HEDGE_MARKER.test('petugas merasa lebih teratur, tanpa data tentang keluhan warga') && HEDGE_MARKER.test('tidak ada catatan tentang waktu perbaikan') && !HEDGE_MARKER.test('warga memakai perkiraan giliran untuk mengurus keperluan lain sebelum dipanggil'), 'pemeriksa penanda ragu mengenali "belum diketahui", "tanpa data", dan "tidak ada catatan"');
  // Penanda ragu pada teks skenario: bila ada pengecoh netral yang memuatnya, kedua temuan utama (penguat dan pelemah) juga harus memuatnya (per soal diperiksa lagi pada checkArgumen).
  for (const s of SKENARIO) check(![s.sebagian[0], s.tidakRelevan[0], s.luarCakupan[0], s.ulangPremis[0]].some((text) => HEDGE_MARKER.test(text)) || [s.penguat, s.pelemah].every((text) => HEDGE_MARKER.test(text)), 'Argumen ' + s.id + ': penanda ragu hanya pada pengecoh');
  report.argumen = { skenario: SKENARIO.length, butir: SKENARIO.length * 2, stemUnik: seen.size, kunciTerpanjang: longest + '/' + total, kunciTerpendek: shortest + '/' + total };
  // Profil variasi: lima paket x tiga butir argumen tanpa ulang, skenario tidak berulang.
  for (const seed of ['analitis-a', 'analitis-b', 'JADIASN-2027']) {
    const packs = generateTryout(normalizeSettings({ ...DEFAULT_SETTINGS, mode: 'TIU', count: 3, subtopics: ['Verbal::Memperkuat/Memperlemah Argumen'], profile: 'tryout-2027', tiuSource: 'variation', packages: 5, seed } as never), fingerprint);
    const items = packs.flatMap((pack) => pack.questions.filter((x) => x.mappingId === row17.id));
    check(items.length === 15 && new Set(items.map(fingerprint)).size === 15, seed + ': lima paket memuat 15 butir argumen tanpa ulang');
    const scenarios = items.map((x) => x.proof.kind === 'model' && x.proof.model.kind === 'argument' ? x.proof.model.scenario : '');
    check(scenarios.every(Boolean) && new Set(scenarios).size === 15, seed + ': 15 skenario berbeda pada lima paket');
    packs.forEach((pack) => check(pack.questions.filter((x) => x.mappingId === row17.id).length === 3, seed + ': tiga butir argumen per paket'));
    for (const x of items) { const problems = checkTiuFormat({ ...x, family: 'argumen' }); check(problems.length === 0, seed + ': ' + problems.join('; ')); }
  }
  // Profil contoh diterima tetap memakai sembilan contoh (tiga paket), baik kesulitan campuran maupun default.
  for (const seed of ['analitis-a', 'JADIASN-2027']) {
    const packs = generateTryout(normalizeSettings({ ...DEFAULT_SETTINGS, mode: 'TIU', count: 3, subtopics: ['Verbal::Memperkuat/Memperlemah Argumen'], profile: 'tryout-2027', tiuSource: 'accepted', packages: 3, seed } as never), fingerprint);
    const ids = packs.flatMap((pack) => pack.questions.filter((x) => x.mappingId === row17.id)).map((x) => x.proof.kind === 'bank' ? x.proof.id : x.proof.kind);
    check(ids.length === 9 && new Set(ids).size === 9 && ids.every((id) => /^tryout-ref-10-0\d$/.test(id)), seed + ': profil contoh diterima memakai sembilan contoh argumen: ' + ids.join(','));
  }
  // Isolasi undian: butir argumen pada profil tidak mengambil undian dari aliran bersama.
  const base = rng('argumen-draw'); let used = 0;
  const probe: Rng = { next: () => { used++; return base.next(); }, int: (min: number, max: number) => { used++; return Math.floor(base.next() * (max - min + 1)) + min; }, pick: <T,>(items: readonly T[]) => { used++; return items[Math.floor(base.next() * items.length)]; }, shuffle: <T,>(items: readonly T[]) => { used += items.length; return [...items]; } };
  makeMappedTiu(row17, 'sulit', probe, 0, { seed: 'x', used: () => 4 });
  check(used === 0, 'baris 17 pada profil tidak mengundi dari aliran bersama (' + used + ')');
  return report;
}

export function runTiuFormatChecks(check: Check): Record<string, unknown> {
  const report: Record<string, unknown> = {};
  // 1. Keluarga numerik dasar: struktur, kebenaran, dan keseragaman opsi pada banyak soal hasil bangkitan.
  const made: Record<string, number> = {}, special = { pecahan: 0, hitungDesimal: 0, dataGabungan: 0, dataKategori: new Set<string>() };
  for (const family of TIU_FAMILIES.filter((f) => FORMAT_FAMILIES.includes(f.id))) for (const level of family.levels) for (let seed = 0; seed < (family.id === "cerita-hitung" ? 200 : 60); seed++) {
    const q = sample(family.id, level, seed), problems = checkTiuFormat(q);
    check(problems.length === 0, family.id + '/' + level + '/' + seed + ': ' + problems.join('; ') + '\n' + q.explanation);
    made[family.id] = (made[family.id] ?? 0) + 1;
    if (family.id === 'pecahan' && q.explanation.includes(SPECIAL_SENTENCE)) special.pecahan++;
    if (family.id === 'hitung' && decimals(q.options[0].text) > 0) special.hitungDesimal++;
    if (family.id === 'data') { special.dataKategori.add(q.options[q.answer].text); if (q.explanation.includes('bersama-sama:')) special.dataGabungan++; }
  }
  check(special.pecahan > 0 && special.hitungDesimal > 0 && special.dataGabungan > 0 && special.dataKategori.size >= 4, 'Contoh mencakup pecahan istimewa, opsi desimal seragam, gabungan data, dan >= 4 kategori kecukupan data');
  // Semua subjenis soal cerita, kelima polemik proyek, dua bentuk kategori, dan tiga keluarga susunan harus muncul pada contoh.
  const wanted = ['cerita-hitung:jkw', 'cerita-hitung:vdw', 'cerita-hitung:rata-baru', 'cerita-hitung:rata-gabungan', 'cerita-hitung:diskon', 'cerita-hitung:bertahap', 'cerita-hitung:rasio', 'cerita-hitung:senilai',
    'cerita-hitung:berbalik', 'cerita-hitung:wowo', 'wowo:sakit-balik-pekerja', 'wowo:sakit-balik-hari', 'wowo:sakit-tidak-balik', 'wowo:kontrak', 'wowo:mangkrak', 'kategori:orang-kegiatan', 'kategori:objek-tempat', 'posisi:linear', 'posisi:circular', 'posisi:grid', 'posisi-bloom:C4', 'posisi-bloom:C5', 'posisi-bloom:C6', 'posisi:uji-andaian', 'peringkat', 'jadwal', 'tema:lomba', 'tema:nilai', 'tema:datang', 'tema:tinggi', 'tema:jadwal', 'peringkat-bloom:C4', 'jadwal-bloom:C4',
    'deret:satu-towew', 'deret:dua-towew', 'deret:tiga-jalur', 'deret:fibonacci', 'deret:selang-seling'];
  check(wanted.every((item) => SUBTYPES.has(item)), 'Semua subjenis tercakup; kurang: ' + wanted.filter((item) => !SUBTYPES.has(item)).join(', '));
  // Pemeriksa harus menolak pembahasan yang dirusak (kunci bergeser, langkah hilang, tabel tertukar).
  for (const [family, level] of [['cerita-hitung', 'sedang'], ['cerita-hitung', 'sulit'], ['posisi', 'sulit'], ['peringkat', 'sedang'], ['jadwal', 'sulit'], ['kategori', 'sedang']] as const) {
    for (let seed = 0; seed < 6; seed++) {
      const good = sample(family, level, 100 + seed);
      check(checkTiuFormat({ ...good, answer: (good.answer + 1) % 5 }).length > 0, family + '/' + level + ': pemeriksa menolak kunci yang bergeser');
      if (['peringkat', 'jadwal'].includes(family)) check(checkTiuFormat({ ...good, explanation: good.explanation.replace(/^.*\n\n/, '') }).length > 0, family + ': pemeriksa menolak langkah yang hilang');
      if (family === 'posisi') {
        const wrongPosisi = (changed: Question, why: string) => check(checkTiuFormat(changed).length > 0, 'posisi: pemeriksa menolak ' + why);
        wrongPosisi({ ...good, explanation: good.explanation.replace(/^.*\n\n/, '') }, 'penalaran yang hilang');
        wrongPosisi({ ...good, explanation: ((text: string) => { const at = text.lastIndexOf('\n\n|'), tail = text.slice(at), names = [...tail.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]); return names.length < 2 ? text + 'x' : text.slice(0, at) + tail.replace('**' + names[0] + '**', '@@A@@').replace('**' + names[1] + '**', '**' + names[0] + '**').replace('@@A@@', '**' + names[1] + '**'); })(good.explanation) }, 'tabel yang namanya tertukar');
        wrongPosisi({ ...good, explanation: 'Informasi 1: ' + good.explanation }, 'pola "Informasi n:"');
        wrongPosisi({ ...good, explanation: good.explanation.replace('Jadi, jawaban yang benar adalah {kunci}.', 'Jadi, jawabannya adalah {kunci}.') }, 'penutup yang berubah');
        wrongPosisi({ ...good, stem: good.stem.replace('\n', ' Terdapat beberapa informasi sebagai berikut:\n1. A.\n') }, 'daftar bernomor pada stem');
        wrongPosisi({ ...good, stem: good.stem.replace(/, dan /, ', ') }, 'daftar nama tanpa "dan"');
      }
      if (family === 'kategori') check(checkTiuFormat({ ...good, explanation: good.explanation.replace('✓', 'x') }).length > 0, 'kategori: pemeriksa menolak tabel yang tidak cocok');
      if (family === 'cerita-hitung') {
        // Opsi soal cerita: pengecoh di luar rentang logis, satuan tidak seragam, catatan sumber hilang, dan rupiah di stem tanpa titik ribuan harus ditolak.
        const wrongAt = good.options.findIndex((_, i) => i !== good.answer), shown = good.options[wrongAt].text, numericProof = good.proof.kind === 'numeric' ? good.proof : undefined;
        const withText = (text: string) => ({ ...good, options: good.options.map((option, i) => i === wrongAt ? { ...option, text } : option) });
        check(checkTiuFormat(withText((shown.startsWith('Rp') ? 'Rp' : '') + '9.999.999' + shown.replace(/^Rp/, '').replace(/^[\d.]+/, ''))).length > 0, level + ': pemeriksa menolak pengecoh soal cerita di luar rentang logis');
        check(checkTiuFormat(withText(shown + ' buah')).length > 0, level + ': pemeriksa menolak satuan opsi yang tidak seragam');
        check(!!numericProof && checkTiuFormat({ ...good, proof: { ...numericProof, distractors: undefined } }).length > 0, level + ': pemeriksa menolak pengecoh cerita tanpa catatan sumber');
        const plainStem = good.stem.replace(/Rp(\d{1,3})\.(\d{3})/, 'Rp$1$2');
        if (plainStem !== good.stem) check(checkTiuFormat({ ...good, stem: plainStem }).length > 0, level + ': pemeriksa menolak rupiah di stem tanpa titik ribuan');
        // QA akhir B6: pengecoh yang meleset jauh dari kunci (di luar 0,3-3,3 kali) ditolak walau masih dalam rentang logis subjenis (mis. jkw/vdw dahulu sampai 100 kali kunci).
        const far = String(Math.round(optionNumber(good.options[good.answer].text) * 5)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'), farText = (shown.startsWith('Rp') ? 'Rp' : '') + far + shown.replace(/^Rp/, '').replace(/^[\d.]+/, '');
        check(checkTiuFormat(withText(farText)).some((problem) => problem.includes('skala')), level + ': pemeriksa menolak pengecoh di luar skala 0,3-3,3 kali kunci (' + farText + ')');
      }
    }
  }
  // Objek-tempat: kalimat positif yang ambigu ("dapat ditemukan di") atau daftar toko tanpa toko kunci harus ditolak oleh uji dua tafsir.
  let shownFacts = 0;
  for (let seed = 300; seed < 420 && shownFacts < 4; seed++) {
    const good = sample('kategori', 'sedang', seed);
    if (!good.stem.includes('hanya tersedia di') || good.proof.kind !== 'model' || good.proof.model.kind !== 'availability') continue;
    shownFacts++;
    check(checkTiuFormat(good).length === 0, 'objek-tempat: contoh baik lolos dua tafsir');
    check(checkTiuFormat({ ...good, stem: good.stem.replace('hanya tersedia di', 'dapat ditemukan di') }).length > 0, 'objek-tempat: pemeriksa menolak kalimat "dapat ditemukan di" yang ambigu');
    const letter = 'ABCDE'[good.answer], withoutKey = good.stem.replace(/(hanya tersedia di Toko )([A-E, dan]+)\./, (_all, head: string, list: string) => head + list.replace(letter, 'Z') + '.');
    check(withoutKey !== good.stem && checkTiuFormat({ ...good, stem: withoutKey }).length > 0, 'objek-tempat: pemeriksa menolak daftar toko tanpa toko kunci');
  }
  check(shownFacts >= 3, 'objek-tempat: contoh dengan kalimat "hanya tersedia di" ditemukan (' + shownFacts + ')');
  // Figural: setiap mekanisme tampil pada contoh; diagram yang tidak sama dengan soal, tag atau penutup yang rusak, dan huruf opsi tertulis mati harus ditolak;
  // setelah opsi diacak, huruf pada kotak opsi dan tag kunci mengikuti susunan yang tampil.
  const wantedFigural = ['ketidaksamaan-urutan', 'ketidaksamaan-paritas', 'ketidaksamaan-sisi', 'serial-satu-aturan', 'serial-dua-aturan', 'serial-tiga-aturan', 'serial-jumlah', 'serial-jumlah-ganda',
    'matriks-baris-kolom', 'matriks-putaran', 'matriks-latin', 'matriks-jumlah', 'matriks-jumlah-ganda', 'matriks-cincin', 'matriks-tumpuk', 'matriks-tumpuk-xor', 'serial-empat-aturan'].map((item) => 'figural:' + item);
  for (const id of FIGURAL_FAMILIES_CHECKED) for (const level of TIU_FAMILIES.find((f) => f.id === id)!.levels) for (let seed = 500; seed < 900 && !wantedFigural.every((item) => SUBTYPES.has(item)); seed++) {
    const problems = checkTiuFormat(sample(id, level, seed));
    check(problems.length === 0, id + '/' + level + '/' + seed + ': ' + problems.join('; '));
  }
  check(wantedFigural.every((item) => SUBTYPES.has(item)), 'Semua mekanisme figural tercakup; kurang: ' + wantedFigural.filter((item) => !SUBTYPES.has(item)).join(', '));
  let changedLabels = 0, changedRings = 0;
  for (const [family, level] of [['fig-analogi', 'sedang'], ['fig-odd', 'mudah'], ['fig-odd', 'sedang'], ['fig-serial', 'sedang'], ['fig-serial', 'mudah'], ['fig-matrix', 'sedang'], ['fig-matrix', 'mudah']] as const) {
    for (let seed = 0; seed < 5; seed++) {
      const good = sample(family, level, 700 + seed), tag = family + '/' + level, letter = String.fromCharCode(65 + good.answer);
      check(checkTiuFormat(good).length === 0, tag + ': contoh figural baik lolos');
      const lines = good.explanation.split('\n'), at = lines.flatMap((line, i) => line.startsWith('@gambar ') ? [i] : []);
      const edit = (index: number, change: (figure: FigureDiagram) => void) => { const copy = lines.slice(); const figure = JSON.parse(copy[at[index]].slice(8)) as FigureDiagram; change(figure); copy[at[index]] = '@gambar ' + JSON.stringify(figure); return copy.join('\n'); };
      const wrong = (explanation: string, why: string) => { check(explanation !== good.explanation, tag + ': perusakan ' + why + ' harus mengubah teks'); check(checkTiuFormat({ ...good, explanation }).length > 0, tag + ': pemeriksa menolak ' + why); };
      wrong(edit(at.length - 1, (f) => { f.cells.forEach((c) => { delete c.tag; }); }), 'diagram tanpa tag kunci');
      wrong(edit(0, (f) => { const c = f.cells.find((x) => x.scene)!; c.scene = { parts: c.scene!.parts.slice(1) }; }), 'gambar kotak yang kehilangan satu bagian');
      wrong(good.explanation.replace('opsi {kunci}', 'opsi ' + letter), 'huruf opsi yang tertulis mati');
      wrong(good.explanation.replace(/\nJadi, jawaban yang benar adalah \{kunci\}\.$/, '\nJadi, jawabannya sudah jelas.'), 'penutup yang bukan baku');
      const labelled = edit(0, (f) => { const c = f.cells.find((x) => x.label); if (c) c.label!.text = '99 sisi'; });
      if (labelled !== good.explanation) { changedLabels++; wrong(labelled, 'label angka yang salah'); }
      const ringed = edit(0, (f) => { const c = f.cells.find((x) => x.rings?.length); if (c) c.rings = ['zzz*']; });
      if (ringed !== good.explanation) { changedRings++; wrong(ringed, 'lingkaran pada bagian yang tidak ada'); }
      // Opsi diacak setelah soal dibuat: huruf kunci dan huruf kotak opsi mengikuti susunan baru, dan pemeriksa tetap lolos.
      const order = [2, 0, 4, 1, 3], shuffled: Question = { ...good, options: order.map((i) => good.options[i]), answer: order.indexOf(good.answer) };
      check(checkTiuFormat(shuffled).length === 0, tag + ': setelah opsi diacak diagram tetap benar (huruf dari susunan yang tampil)');
      const text = explanationOf(shuffled);
      check(text.includes('opsi ' + String.fromCharCode(65 + shuffled.answer)) && !text.includes('{kunci}'), tag + ': tag kunci mengikuti huruf kunci setelah diacak');
      const odd = parseExplanation(text)!.flatMap((b) => b.k === 'figure' ? [b.figure] : [])[0];
      if (odd.cells.some((c) => c.opt)) check(odd.cells.map((c) => c.caption).join('') === 'ABCDE' && odd.cells.every((c, i) => c.scene === null || sameScene(c.scene!, shuffled.options[i].scene!)), tag + ': kotak opsi diurutkan menurut opsi yang tampil');
    }
  }
  check(changedLabels >= 3 && changedRings >= 3, 'Uji perusakan label dan lingkaran dijalankan pada contoh yang memilikinya (' + changedLabels + ', ' + changedRings + ')');
  // QA akhir B2: tag kuning tidak boleh terpotong di dasar gambar (dasar kotak kuning + margin <= tinggi SVG), termasuk tag yang jatuh di bawah kotak.
  let tagsChecked = 0;
  for (const id of FIGURAL_FAMILIES_CHECKED) for (const level of TIU_FAMILIES.find((f) => f.id === id)!.levels) for (let seed = 0; seed < 25; seed++) {
    const good = sample(id, level, 900 + seed);
    for (const block of parseExplanation(explanationOf(good))!.flatMap((b) => b.k === 'figure' ? [b.figure] : [])) {
      const svg = figureSvg(block), height = Number(/<svg[^>]* height="(\d+)"/.exec(svg)![1]);
      for (const m of svg.matchAll(/<rect x="[\d.-]+" y="([\d.-]+)" width="[\d.]+" height="([\d.]+)" rx="2" fill="#ffff00"\/>/g)) {
        tagsChecked++;
        check(Number(m[1]) + Number(m[2]) + 8 <= height, id + '/' + level + '/' + seed + ': tag kuning terpotong (dasar ' + (Number(m[1]) + Number(m[2])) + ', tinggi gambar ' + height + ')');
      }
    }
  }
  check(tagsChecked >= 20, 'Uji tag kuning dijalankan pada banyak diagram (' + tagsChecked + ')');
  // Diagram yang diedit: bentuk figural tidak dikenal tidak membuat penggambaran gagal (layar memakai diagramResult, editor menolak simpan lewat diagramProblems);
  // baris @gambar yang JSON-nya rusak tampil sebagai teks mentah dan tidak melempar galat.
  {
    const good = sample('fig-odd', 'sedang', 700), lines = good.explanation.split('\n'), at = lines.findIndex((line) => line.startsWith('@gambar '));
    const figure = JSON.parse(lines[at].slice(8)) as FigureDiagram;
    figure.cells.find((c) => c.scene)!.scene!.parts[0].g = 'bentuk-tak-dikenal';
    const edited: Question = { ...good, explanation: lines.map((line, i) => i === at ? '@gambar ' + JSON.stringify(figure) : line).join('\n') };
    check(diagramProblems(good).length === 0, 'diagramProblems: pembahasan figural yang baik tidak dilaporkan');
    const problems = diagramProblems(edited);
    check(problems.length === 1 && problems[0].includes('bentuk-tak-dikenal') && problems[0].includes('@gambar'), 'diagramProblems: bentuk figural tidak dikenal dilaporkan dengan pesan jelas: ' + problems.join(' / '));
    const block = parseExplanation(explanationOf(edited))!.find(isDiagramBlock)!, made = diagramResult(block);
    check('error' in made && made.error.includes('bentuk-tak-dikenal'), 'diagramResult: galat penggambaran dikembalikan sebagai pesan, bukan dilempar');
    const html = renderToStaticMarkup(createElement(Explanation, { text: explanationOf(edited) }));
    check(html.includes('Diagram tidak dapat digambar') && html.includes('bentuk-tak-dikenal') && html.includes('role="alert"'), 'Explanation: diagram yang tidak dapat digambar tampil sebagai pesan galat, bukan membuat render gagal');
    const broken: Question = { ...good, explanation: good.explanation.replace('@gambar {', '@gambar {{') };
    check(broken.explanation !== good.explanation && diagramProblems(broken).length === 0 && renderToStaticMarkup(createElement(Explanation, { text: explanationOf(broken) })).includes('@gambar'), 'Baris @gambar dengan JSON rusak tampil sebagai teks mentah tanpa galat');
  }
  // QA akhir B4: dua suku berurutan yang sama diberi tanda "=", digambar tanpa kepala panah (tidak berarah ↑); panah lain tetap berkepala.
  {
    const values = [2, 48, 6, 50, 18, 52, 54, 54], ticks = directions(values).map((label, i): ChainArc => ({ from: i, to: i + 1, label, color: 'ink', side: 'top', style: 'tick' }));
    const svg = chainSvg({ terms: [...values.map(String), '…'], arcs: ticks, loop: [0, 3] }), equal = ticks.filter((t) => t.label === '=').length;
    check(directions(values).join(' ') === '↑ ↓ ↑ ↓ ↑ ↑ =' && equal === 1, 'Arah deret: dua suku sama berlabel "="');
    check((svg.match(/<polygon /g) ?? []).length === ticks.length - equal, 'Diagram deret: panah berkepala hanya untuk suku yang naik atau turun, tidak untuk "=" (' + (svg.match(/<polygon /g) ?? []).length + ' kepala)');
    check((svg.match(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="\2"/g) ?? []).length === 2 * equal, 'Diagram deret: "=" digambar sebagai dua garis mendatar');
  }
  // Rute, silogisme, analogi verbal: setiap konstruk baru diuji dengan perusakan yang harus ditolak dan dengan opsi yang diacak (pemeriksa memakai teks opsi, bukan urutannya).
  for (const [family, level] of [['rute', 'sedang'], ['rute', 'sulit'], ['silogisme', 'sedang'], ['silogisme', 'sulit'], ['analogi', 'mudah']] as const) {
    for (let seed = 0; seed < 6; seed++) {
      const good = sample(family, level, 800 + seed), tag = family + '/' + level, lines = good.explanation.split('\n');
      check(checkTiuFormat(good).length === 0, tag + ': contoh baik lolos\n' + good.explanation);
      const wrong = (changed: Question, why: string) => check(checkTiuFormat(changed).length > 0, tag + ': pemeriksa menolak ' + why);
      const withExplanation = (explanation: string, why: string) => { check(explanation !== good.explanation, tag + ': perusakan ' + why + ' harus mengubah teks'); wrong({ ...good, explanation }, why); };
      const order = [2, 0, 4, 1, 3], shuffled: Question = { ...good, options: order.map((i) => good.options[i]), answer: order.indexOf(good.answer) };
      check(checkTiuFormat(shuffled).length === 0, tag + ': setelah opsi diacak soal tetap lolos');
      wrong({ ...good, answer: (good.answer + 1) % 5 }, 'kunci yang bergeser');
      if (family === 'rute') {
        const first = lines.findIndex((line) => /^1\. /.test(line)), graphAt = lines.findIndex((line) => line.startsWith('@graf '));
        withExplanation(lines.filter((_, i) => i !== first).join('\n'), 'daftar rute yang kehilangan satu rute');
        withExplanation(good.explanation.replace(/Jadi, terdapat (\d+) rute/, (_all, n: string) => 'Jadi, terdapat ' + (Number(n) + 1) + ' rute'), 'jumlah rute yang salah');
        withExplanation(lines.map((line, i) => { if (i !== graphAt) return line; const graph = JSON.parse(line.slice(6)) as { edges: number[][] }; graph.edges.pop(); return '@graf ' + JSON.stringify(graph); }).join('\n'), 'graf yang kehilangan satu sisi');
        wrong({ ...good, options: good.options.map((o, i) => i === (good.answer + 1) % 5 ? { ...o, text: o.text.replace(' rute', ' buah') } : o) }, 'satuan opsi yang salah');
        wrong({ ...good, proof: { ...good.proof, model: { ...(good.proof as { model: object }).model, distractors: undefined } } as never }, 'pengecoh rute tanpa catatan sumber');
        wrong({ ...good, stem: good.stem.replace(/ Dari \S+ \S+ dapat pergi ke [^.]+\./, '') }, 'cerita yang kehilangan kalimat sisi');
        wrong({ ...good, stem: good.stem.replace(' sebelumnya?', ' dua kali?') }, 'pertanyaan tanpa aturan tidak mengunjungi gerai sebelumnya');
        wrong({ ...good, table: { headers: ['Dari', 'Menuju'], rows: [['A', 'B']] } }, 'tabel sisi yang tertinggal pada stem cerita');
      } else if (family === 'silogisme') {
        // Bentuk implikasi (konvers, invers, kontraposisi) memakai pemeriksa lama; silogisme blueprint diuji mutasinya oleh silogismeMutations (di bawah).
        const key = good.options[good.answer];
        if ((good.proof as { model: { kind: string } }).model.kind === 'implication') {
          wrong({ ...good, options: good.options.map((o, i) => i === good.answer ? { ...o, reason: o.reason.replace(/^(Sesuai dengan yang diminta)/, 'Belum dapat dipastikan') } : o) }, 'ulasan kunci dengan status keliru');
          wrong({ ...good, options: good.options.map((o, i) => i === (good.answer + 1) % 5 ? { ...o, reason: '' } : o) }, 'ulasan opsi yang kosong');
          wrong({ ...good, options: good.options.map((o, i) => i === (good.answer + 1) % 5 ? { ...o, reason: 'Pilihan yang tidak sesuai.' } : o) }, 'ulasan opsi yang hanya menyebut tidak sesuai tanpa alasan logika');
          wrong({ ...good, stem: good.stem.replace(/^Kontraposisi|^Konvers|^Invers/, (word) => word + 'nya') }, 'premis di soal yang berbeda dari pembahasan');
          if (key.reason.startsWith('Sesuai')) withExplanation(good.explanation.replace(/\n• \*\*Kesimpulan Akhir:\*\* .*$/, '\n• **Kesimpulan Akhir:** ' + good.options[(good.answer + 1) % 5].text.replace(/\.$/, '')), 'baris kesimpulan yang bukan kunci');
        }
      } else {
        const reversed = good.options[good.answer].text.split(' : ').reverse().join(' : ');
        wrong({ ...good, options: good.options.map((o, i) => i === good.answer ? { ...o, text: reversed } : o) }, 'kunci dengan arah hubungan terbalik');
        const other = (good.answer + 1) % 5;
        wrong({ ...good, options: good.options.map((o, i) => i === good.answer ? { ...o, reason: good.options[other].reason } : i === other ? { ...o, reason: good.options[good.answer].reason } : o) }, 'ulasan opsi yang tertukar');
        wrong({ ...good, options: good.options.map((o, i) => i === other ? { ...o, reason: o.reason.replace('; tidak sepadan, karena', '; sepadan, karena') } : o) }, 'pengecoh yang disebut sepadan');
        withExplanation(good.explanation.replace(/Kata "([^"]+)"/, 'Kata "zzz"'), 'pembahasan yang menyebut kata berbeda dari soal');
      }
    }
  }
  // Deret: pemeriksa harus menolak pembahasan yang dirusak (pola, panah, arah towew, perhitungan, penutup, atau sub-judul tambahan).
  const rusak = (text: string, from: string | RegExp, to: string | ((...match: string[]) => string)) => { const out = text.replace(from, to as string); assert.notEqual(out, text, 'perusakan tidak mengubah teks: ' + String(from)); return out; };
  const bahan: [string, Difficulty][] = [['deret', 'mudah'], ['deret', 'sedang'], ['deret', 'sulit'], ['fibonacci', 'sedang'], ['tiga-jalur', 'sulit'], ['selang-seling', 'sedang']];
  for (const [family, level] of bahan) for (let seed = 0; seed < 6; seed++) {
    const good = sample(family, level, 200 + seed), tag = family + '/' + level, hapus = (text: string) => text.split('\n').filter((line) => !line.startsWith('@deret ')).join('\n');
    const wrong = (explanation: string, why: string) => check(checkTiuFormat({ ...good, explanation }).length > 0, tag + ': pemeriksa menolak ' + why);
    check(checkTiuFormat(good).length === 0, tag + ': contoh baik harus lolos\n' + good.explanation);
    check(checkTiuFormat({ ...good, answer: (good.answer + 1) % 5 }).length > 0, tag + ': pemeriksa menolak kunci yang bergeser');
    const lines = good.explanation.split('\n'), last = lines.findLastIndex((line) => line.startsWith('@deret '));
    const pola = JSON.parse(lines[last].slice(7)) as { terms: string[]; arcs: { label: string; style?: string }[]; marks: { index: number }[] };
    const withChain = (edit: (chain: typeof pola) => void) => { const copy = JSON.parse(JSON.stringify(pola)) as typeof pola; edit(copy); return [...lines.slice(0, last), '@deret ' + JSON.stringify(copy), ...lines.slice(last + 1)].join('\n'); };
    const arc = (chain: typeof pola) => chain.arcs.find((a) => (a.style ?? 'arc') === 'arc' || a.style === 'drop')!;
    wrong(withChain((chain) => { arc(chain).label = '+99'; }), 'label panah yang bukan pola');
    wrong(withChain((chain) => { chain.terms[chain.terms.length - 1] = String(Number(chain.terms[chain.terms.length - 1]) + 1); }), 'suku jawaban pada diagram yang bergeser');
    wrong(withChain((chain) => { chain.terms[1] = String(Number(chain.terms[1]) + 1); }), 'suku diagram yang tidak sama dengan soal');
    wrong(withChain((chain) => { chain.marks = []; }), 'diagram tanpa tanda jawaban');
    wrong(rusak(good.explanation, 'Pola yang terlihat:', 'Pola:'), 'pembahasan tanpa "Pola yang terlihat:"');
    wrong(hapus(good.explanation), 'pembahasan tanpa diagram');
    wrong(rusak(good.explanation, /\n(Jadi, [^\n]*)$/, '\nRumus Cepat:\n$1'), 'sub-judul tambahan (Rumus Cepat) pada deret');
    wrong(good.explanation.replace(/\n[^\n]*$/, '\nJadi, jawaban ditemukan.'), 'penutup yang bukan baku');
    wrong(rusak(good.explanation, /(\d+) ([+×−]) (\d+) = (\d+)/, (_all, a, op, b, c) => a + ' ' + op + ' ' + b + ' = ' + (Number(c) + 1)), 'perhitungan kalimat yang salah');
    // Pengecoh: nilai absurd, catatan sumber hilang, atau sumber tidak sesuai nilai harus ditolak.
    const wrongAt = good.options.findIndex((_, i) => i !== good.answer), numericProof = good.proof.kind === 'numeric' ? good.proof : undefined;
    const withOption = (text: string) => ({ ...good, options: good.options.map((option, i) => i === wrongAt ? { ...option, text } : option) });
    check(checkTiuFormat(withOption('0')).length > 0 && checkTiuFormat(withOption('-' + good.options[wrongAt].text)).length > 0 && checkTiuFormat(withOption(String(numberOf(good.options[good.answer].text) * 20))).length > 0, tag + ': pemeriksa menolak pengecoh nol, negatif, atau beda skala');
    check(!!numericProof && checkTiuFormat({ ...good, proof: { ...numericProof, distractors: undefined } }).length > 0, tag + ': pemeriksa menolak pengecoh tanpa catatan sumber');
    check(!!numericProof && checkTiuFormat({ ...good, proof: { ...numericProof, distractors: numericProof.distractors!.map((d, i) => i ? d : { ...d, source: 'tukar-operasi', value: d.value + 1 }) } }).length > 0, tag + ': pemeriksa menolak sumber yang tidak sesuai nilai pengecoh');
    if (['sedang', 'sulit'].includes(level) && family === 'deret') {
      wrong(rusak(good.explanation, /"label":"↑"/, '"label":"↓"'), 'panah arah yang tidak sesuai suku');
      wrong(rusak(good.explanation, /artinya 2 towew/, 'artinya 1 towew'), 'jumlah towew yang salah');
      wrong(rusak(good.explanation, '| 1 Towew |', '| 5 Towew |'), 'tabel konsep towew yang diubah');
    }
    if (family === 'tiga-jalur') wrong(rusak(good.explanation, /artinya 3 towew/, 'artinya 2 towew'), 'jumlah towew yang salah');
    if (family === 'selang-seling') wrong(rusak(good.explanation, 'Pola campuran:', 'Pola:'), 'kalimat pola campuran yang hilang');
  }
  report.subtypes = [...SUBTYPES].sort();
  report.generated = made; report.coverage = { pecahanIstimewa: special.pecahan, hitungDesimal: special.hitungDesimal, dataGabungan: special.dataGabungan, dataKategori: [...special.dataKategori] };

  // 1b. Baris profil tryout 2027 yang memakai keluarga ini (24 pecahan /8, 27 kecukupan data, 47 pola bilangan tabel): format pembahasan sama.
  const mapped: Record<number, string> = { 17: 'argumen', 18: 'posisi', 24: 'pecahan', 27: 'data', 39: 'deret', 47: 'tabel' };
  for (const [rowNumber, family] of Object.entries(mapped)) {
    const row = MAPPING_ROWS.find((r) => r.row === Number(rowNumber))!;
    for (let seed = 0; seed < 40; seed++) {
      const level: Difficulty = seed % 2 ? 'sulit' : 'sedang', draft = makeMappedTiu(row, level, rng('mapped-' + rowNumber + '-' + seed)), q: Question = { ...draft, id: 'mapped', no: 1, family };
      const problems = checkTiuFormat(q);
      check(problems.length === 0, 'baris tryout ' + rowNumber + '/' + seed + ': ' + problems.join('; ') + '\n' + q.explanation);
    }
  }
  report.mappedRows = Object.keys(mapped);
  report.analitis = runAnalitisChecks(check);

  // 1c. QA akhir. B5: baris tryout 48 (pernyataan tabel) dan 49 (bus) menulis rupiah bertitik ribuan di stem, tabel, opsi, alasan, dan pembahasan; pemeriksa menolak rupiah tanpa titik.
  let rupiahTables = 0;
  for (const rowNumber of [48, 49]) {
    const row = MAPPING_ROWS.find((r) => r.row === rowNumber)!;
    for (let seed = 0; seed < 40; seed++) {
      const q: Question = { ...makeMappedTiu(row, seed % 2 ? 'sulit' : 'sedang', rng('rupiah-' + rowNumber + '-' + seed)), id: 'rupiah', no: 1 };
      const problems = rupiahProblems(q), cells = (q.table?.rows.flat() ?? []).filter((cell) => cell.startsWith('Rp'));
      check(problems.length === 0, 'baris tryout ' + rowNumber + '/' + seed + ': ' + problems.join('; '));
      check(cells.every((cell) => /^Rp\d{1,3}(?:\.\d{3})+$/.test(cell)), 'baris tryout ' + rowNumber + ': sel tabel rupiah bertitik ribuan: ' + cells.join(', '));
      if (cells.length) { rupiahTables++; check(rupiahProblems({ ...q, table: { ...q.table!, rows: q.table!.rows.map((cells2) => cells2.map((cell) => cell.replace(/\./g, ''))) } }).length > 0, 'baris tryout ' + rowNumber + ': pemeriksa menolak rupiah tanpa titik ribuan di tabel'); }
    }
  }
  check(rupiahTables >= 60, 'Uji rupiah dijalankan pada tabel baris 48 dan 49 (' + rupiahTables + ')');
  // B7: baris 25 dan 26 (pasangan setara) selalu memuat lima opsi berbeda, juga bila undian kebetulan kembar (pengacak palsu yang selalu mengembalikan nilai terkecil),
  // dan jumlah undian aliran bersama tidak berubah (23) sehingga pemilihan butir lain tidak bergeser.
  const constant: Rng = { next: () => 0, int: (min: number) => min, pick: <T,>(items: readonly T[]) => items[0], shuffle: <T,>(items: readonly T[]) => [...items] };
  const counted = (seed: string) => {
    const base = rng(seed); let used = 0;
    const next = () => { used++; return base.next(); };
    const int = (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min;
    const pick = <T,>(items: readonly T[]) => items[int(0, items.length - 1)];
    const shuffle = <T,>(items: readonly T[]) => { const result = [...items]; for (let i = result.length - 1; i > 0; i--) { const j = int(0, i); [result[i], result[j]] = [result[j], result[i]]; } return result; };
    return { r: { next, int, pick, shuffle } as Rng, count: () => used };
  };
  for (const rowNumber of [25, 26]) {
    const row = MAPPING_ROWS.find((r) => r.row === rowNumber)!, forced = makeMappedTiu(row, 'sedang', constant);
    check(new Set(forced.options.map((o) => o.text)).size === 5 && forced.options.filter((o) => o.score > 0).length === 1, 'baris ' + rowNumber + ': opsi kembar akibat undian kembar dibedakan: ' + forced.options.map((o) => o.text).join('; '));
    for (let seed = 0; seed < 1500; seed++) {
      const { r, count } = counted('setara-' + rowNumber + '-' + seed), draft = makeMappedTiu(row, 'sedang', r);
      if (new Set(draft.options.map((o) => o.text)).size !== 5 || count() !== 23) check(false, 'baris ' + rowNumber + '/' + seed + ': opsi harus berbeda dengan 23 undian bersama (dipakai ' + count() + ')');
    }
  }
  // B1: jumlah undian aliran bersama per pembangkit dibekukan pada nilai sebelum tahap 4 (diukur terhadap HEAD). Pembangkit yang direvisi berjalan pada pengacak turunan (lib/rng.ts: isolated)
  // dan memajukan aliran bersama sebanyak nilai ini; mengubahnya menggeser pemilihan butir profil tryout 2027 dan isi paket lain pada seed yang sama. cerita (bus, tingkat sulit)
  // sejak awal jumlahnya bervariasi sehingga dikecualikan.
  const FROZEN_TIU_DRAWS: Record<string, number> = {
    'analogi:mudah': 1, 'silogisme:sedang': 3, 'silogisme:sulit': 3, 'posisi:sedang': 21, 'posisi:sulit': 26, 'argumen:sulit': 2, 'peringkat:sedang': 21, 'peringkat:sulit': 26, 'jadwal:sedang': 21, 'jadwal:sulit': 26,
    'kategori:sedang': 13, 'rute:sedang': 13, 'rute:sulit': 17, 'hitung:mudah': 4, 'hitung:sedang': 4, 'hitung:sulit': 4, 'pecahan:mudah': 3, 'pecahan:sedang': 4, 'setara:sedang': 7, 'deret:mudah': 2, 'deret:sedang': 5,
    'deret:sulit': 5, 'fibonacci:sedang': 4, 'tiga-jalur:sulit': 6, 'selang-seling:sedang': 3, 'tabel:sedang': 3, 'tabel:sulit': 3, 'matriks-angka:sedang': 6, 'matriks-angka:sulit': 7, 'pernyataan-tabel:sedang': 24,
    'cerita-hitung:sedang': 4, 'cerita-hitung:sulit': 3, 'data:sedang': 3, 'data:sulit': 4, 'fig-analogi:mudah': 1, 'fig-analogi:sedang': 1, 'fig-analogi:sulit': 1, 'fig-odd:mudah': 1, 'fig-odd:sedang': 1, 'fig-odd:sulit': 1,
    'fig-serial:mudah': 1, 'fig-serial:sedang': 1, 'fig-serial:sulit': 1, 'fig-matrix:mudah': 1, 'fig-matrix:sedang': 1, 'fig-matrix:sulit': 1,
  };
  for (const family of TIU_FAMILIES) for (const level of family.levels) {
    const key = family.id + ':' + level, want = FROZEN_TIU_DRAWS[key];
    if (want === undefined) { check(key === 'cerita:sulit', 'konsumsi undian ' + key + ' belum dibekukan di FROZEN_TIU_DRAWS'); continue; }
    for (let seed = 0; seed < 8; seed++) {
      const { r, count } = counted('guard-' + key + '-' + seed);
      makeTiu(family, level, r);
      if (count() !== want) check(false, 'konsumsi undian bersama ' + key + ' berubah dari ' + want + ' menjadi ' + count() + ' (menggeser pemilihan butir lain pada seed yang sama)');
    }
  }
  // B1: percobaan ulang karena sidik jari kembar memakai pengacak turunan. Memaksa kolisi pada percobaan pertama baris 16 (analogi, dibangkitkan) tidak boleh menggeser
  // pemilihan dan isi butir sesudahnya pada seed yang sama; jumlah percobaan ulang bergantung pada isi pembangkit, jadi tidak boleh memajukan aliran paket.
  for (const tiuSource of ['accepted', 'variation'] as const) {
    const settings = normalizeSettings({ ...DEFAULT_SETTINGS, profile: 'tryout-2027', tiuSource, packages: 1, seed: 'stab-6' } as never);
    const normal = generateTryout(settings, fingerprint)[0].questions, existing = fingerprint(normal[0]);
    let forced = 0;
    const colliding = generateTryout(settings, (q) => { if (q.id === 'tryout-pattern-map-16-0-0-0') { forced++; return existing; } return fingerprint(q); })[0].questions;
    const at = normal.findIndex((q) => q.mappingId === 'map-16');
    check(forced === 1 && at > 0 && colliding.length === normal.length, tiuSource + ': kolisi paksa pada baris 16 terjadi tepat sekali (' + forced + ')');
    check(normal.slice(at + 1).every((q, i) => fingerprint(q) === fingerprint(colliding[at + 1 + i])), tiuSource + ': percobaan ulang tidak menggeser butir sesudah baris 16');
  }
  const FROZEN_ROW_DRAWS: Record<number, [number, number]> = { 13: [6, 6], 14: [5, 5], 15: [5, 5], 16: [1, 1], 18: [18, 18], 24: [8, 8], 25: [23, 23], 26: [23, 23], 27: [8, 8], 39: [8, 8], 46: [6, 7], 47: [3, 3], 48: [24, 24], 50: [1, 1], 51: [1, 1], 52: [1, 1], 53: [1, 1] };
  for (const [rowNumber, [sedang, sulit]] of Object.entries(FROZEN_ROW_DRAWS)) {
    const row = MAPPING_ROWS.find((r) => r.row === Number(rowNumber))!;
    for (const [level, want] of [['sedang', sedang], ['sulit', sulit]] as const) for (let seed = 0; seed < 6; seed++) {
      const { r, count } = counted('guard-row-' + rowNumber + '-' + level + '-' + seed);
      makeMappedTiu(row, level, r, 0);
      if (count() !== want) check(false, 'konsumsi undian bersama baris tryout ' + rowNumber + '/' + level + ' berubah dari ' + want + ' menjadi ' + count());
    }
  }

  // 2. Parser: blok, tabel, dan kompatibilitas soal lama.
  check(parseExplanation('Satu kalimat.') === null && parseExplanation('Satu.\n\nDua.\nTiga: ya.') === null && parseExplanation('Kesimpulan: tetap paragraf biasa.') === null, 'Paragraf biasa (termasuk baris kosong dan titik dua) tidak dianggap terstruktur');
  const parsed = parseExplanation('Diketahui:\nA = 1\n\n• satu\n• dua\n1. langkah\n2. langkah dua\n\\[x=1\\]\n| 1 | 2 |\n|---|---|\n| a | b | c |\n| ==✓== | x |')!;
  check(parsed.map((b) => b.k).join() === 'heading,p,gap,list,list,math,table' && parsed[3].k === 'list' && parsed[3].items.length === 2 && parsed[4].k === 'list' && parsed[4].ordered && parsed[4].items.length === 2, 'Parser: sub-judul, paragraf, jarak, butir, daftar bernomor, persamaan, tabel');
  const table = parsed[6];
  check(table.k === 'table' && table.headers.join() === '1,2' && table.rows.length === 2, 'Parser: baris setelah pemisah menjadi header angka');
  const grid = tableGrid(table as { headers: string[]; rows: string[][] });
  check(grid.columns === 3 && grid.header![1].span === 2 && grid.rows[1].length === 3 && grid.rows[1][0].mark && grid.rows[1][0].text === '✓' && grid.rows[1][2].text === '' && grid.rows[0][2].text === 'c', 'Tabel: kolom terlebar, header menutup sisa kolom, sel kosong, sel sorot');
  const plainTable = parseExplanation(tableLines({ rows: [['x', '✓'], ['?', 'x']] }).join('\n'))!;
  check(plainTable[0].k === 'table' && plainTable[0].headers.length === 0 && plainTable[0].rows.length === 2, 'Tabel tanpa header (tanpa baris pemisah)');
  check(aligned(['a', '=b']) === '\\[\\begin{aligned}&a\\\\&=b\\end{aligned}\\]' && parseExplanation(aligned(['a', '=b']))![0].k === 'math', 'Persamaan bertingkat: "=" rata kiri lewat aligned');
  const legacy = BANK.filter((q) => q.subtest !== 'TIU');
  check(legacy.length > 300 && legacy.every((q) => parseExplanation(q.explanation) === null), 'Pembahasan TWK/TKP lama tidak berstruktur: layar, ekspor, dan salinan memakai jalur lama');
  check(legacy.slice(0, 60).every((q) => renderToStaticMarkup(createElement(Explanation, { text: q.explanation })) === renderToStaticMarkup(createElement('p', { className: 'explanation-text' }, createElement(MathText, null, q.explanation)))), 'Tampilan layar pembahasan TWK/TKP identik dengan sebelum perubahan');
  check(legacy.slice(0, 60).every((q) => { const b = explanationBlocks(q.explanation); return b.length === 1 && b[0].kind === 'text' && b[0].text === q.explanation && b[0].size === 12 && !b[0].bold && b[0].gap === 3; }), 'Blok ekspor pembahasan TWK/TKP tetap satu blok teks utuh, ukuran 12 pt');

  // 3. Layar, salinan, dan blok ekspor untuk satu contoh tiap keluarga (+ pecahan istimewa).
  const find = (family: string, level: Difficulty, wanted: (q: Question) => boolean) => { for (let seed = 0; seed < 300; seed++) { const q = sample(family, level, seed); if (wanted(q)) return q; } throw new Error('contoh tidak ditemukan: ' + family); };
  const samples = {
    hitung: find('hitung', 'sulit', (q) => decimals(q.options[0].text) > 0), pecahan: find('pecahan', 'sedang', (q) => q.explanation.includes(SPECIAL_SENTENCE)),
    pecahanBiasa: find('pecahan', 'sedang', (q) => !q.explanation.includes(SPECIAL_SENTENCE)), tabel: find('tabel', 'sulit', () => true),
    dataGabungan: find('data', 'sulit', (q) => q.explanation.includes('bersama-sama:')), dataSatu: find('data', 'sedang', (q) => q.options[q.answer].text === DATA_LABELS[1]),
  };
  report.contoh = Object.fromEntries(Object.entries(samples).map(([name, q]) => [name, q.explanation]));
  const html = (q: Question) => renderToStaticMarkup(createElement(QuestionCard, { question: q, showAnswers: true }));
  const hitungHtml = html(samples.hitung), istimewaHtml = html(samples.pecahan), tabelHtml = html(samples.tabel), dataHtml = html(samples.dataGabungan);
  check(hitungHtml.includes('class="explanation-eq is-aligned"') && !hitungHtml.includes('class="explanation-text"') && !hitungHtml.includes('option-reasons') && !hitungHtml.includes('math-error'), 'Layar hitung: persamaan bertingkat rata kiri, tanpa blok alasan opsi');
  check(istimewaHtml.includes('explanation-guide') && istimewaHtml.includes('Pecahan Istimewa') && istimewaHtml.includes('data:image/png;base64,'), 'Layar pecahan istimewa: tabel berjudul selebar 4 kolom, 5 baris, sel kosong ikut');
  check(tabelHtml.includes('<ul class="explanation-list">') && (tabelHtml.match(/<li>/g) ?? []).length === 4 && !tabelHtml.includes('math-error'), 'Layar tabel: empat butir "Urutan ke-"');
  check(dataHtml.includes('<p class="explanation-heading">Diketahui:</p>') && dataHtml.includes('class="explanation-eq"') && dataHtml.includes('explanation-gap') && !dataHtml.includes('math-error'), 'Layar data: sub-judul tebal, persamaan di tengah, jarak antarbagian');
  check(!html(samples.pecahanBiasa).includes('explanation-table') && html(samples.pecahanBiasa).includes('explanation-eq'), 'Layar pecahan tanpa pecahan istimewa tidak memuat tabel');
  const tails = (q: Question) => questionBlocks(q, 'pembahasan', null).tail;
  const kinds = (blocks: Block[]) => blocks.map((b) => b.kind).join(',');
  check(tails(samples.hitung).filter((b) => b.kind === 'text' && b.text.startsWith('\\[')).length === 1 && !tails(samples.hitung).some((b) => b.kind === 'text' && b.text.includes('\n')), 'Blok PDF/PNG hitung: satu blok persamaan, tidak ada teks bercampur baris baru');
  check(tails(samples.pecahan).filter((b) => b.kind === 'diagram' && b.block.k === 'guide' && b.block.id === 'pecahan-istimewa').length === 1, 'Blok PDF/PNG pecahan istimewa memuat satu tabel');
  const dataTail = tails(samples.dataGabungan);
  check(dataTail.some((b) => b.kind === 'text' && b.bold && b.text === 'Diketahui:') && dataTail.some((b) => b.kind === 'gap') && dataTail.filter((b) => b.kind === 'text' && b.text.startsWith('Pernyataan (')).length >= 5, 'Blok PDF/PNG data: sub-judul tebal, jarak, tiap pernyataan satu blok');
  const bulletBlocks = tails(samples.tabel).filter((b) => b.kind === 'text' && b.text.startsWith('• Urutan ke-'));
  check(bulletBlocks.length === 4, 'Blok PDF/PNG tabel: empat butir bullet');
  // Label "Pembahasan:" setelah "Jawaban: X" untuk TIU (panduan, aturan urutan blok); TWK/TKP tidak berubah.
  for (const item of Object.values(samples)) {
    const tail = tails(item), at = tail.findIndex((b) => b.kind === 'text' && b.text === 'Jawaban: ' + String.fromCharCode(65 + item.answer));
    check(at === 0 && tail[1].kind === 'text' && tail[1].text === 'Pembahasan:' && tail[1].bold, item.family + ': label "Pembahasan:" tebal tepat setelah baris jawaban');
  }
  const asQuestion = (subtest: 'TWK' | 'TKP'): Question => { const item = BANK.find((b) => b.subtest === subtest)!; return { ...item, no: 1, family: 'bank', origin: 'kasus', proof: { kind: 'bank', id: item.id, answerText: item.options[item.answer].text } }; };
  // Permintaan tim akademik (28 Okt 2026): TWK dan TKP juga memakai label "Pembahasan:" tebal tepat setelah baris jawaban, sama seperti TIU.
  check(['TWK', 'TKP'].every((s) => { const tail = tails(asQuestion(s as 'TWK' | 'TKP')); return tail[1]?.kind === 'text' && tail[1].text === 'Pembahasan:' && tail[1].bold; }), 'Blok pembahasan TWK/TKP: label "Pembahasan:" tebal tepat setelah baris jawaban');
  // Salinan teks polos dan kolom CSV: teks terbaca, bukan LaTeX atau penanda tabel mentah.
  const leak = /\\\[|\\\(|\\frac|\\begin|\\times|\|---\||&/;
  for (const item of Object.values(samples)) {
    const copy = sectionsText(takeSections(item, ['pembahasan'])), csv = explanationPlain(item.explanation);
    check(!leak.test(copy) && !leak.test(csv), item.family + ': salinan teks dan CSV tanpa LaTeX atau penanda mentah\n' + copy);
  }
  const copyHitung = sectionsText(takeSections(samples.hitung, ['pembahasan'])).split('\n');
  const hitungRows = alignedRows(samples.hitung.explanation)!;
  check(copyHitung[0] === 'Pembahasan:' && copyHitung.length === 1 + hitungRows.length && copyHitung.slice(2).every((line) => line.startsWith('= ')), 'Salin hitung: ekspresi lalu satu baris "= ..." per operasi');
  const copyIstimewa = sectionsText(takeSections(samples.pecahan, ['pembahasan']));
  // QC akademik #2 (soal 42): nilai yang dibulatkan memakai ≈.
  check(copyIstimewa.includes('\nPecahan Istimewa\n1/2 = 0,5 = 50%\n1/3 ≈ 0,3333 ≈ 33,33% | 2/3 ≈ 0,6667 ≈ 66,67%\n') && !copyIstimewa.includes('---'), 'Salin pecahan istimewa: judul tabel dan sel bersekat " | ", sel kosong dibuang');
  const takeNodes = (q: Question) => takeSections(q, ['pembahasan'])[0];
  const nodes = takeNodes(samples.dataGabungan);
  check(nodes.some((n) => n.k === 'text' && n.bold && n.text === 'Diketahui:') && nodes[0].k === 'text' && nodes[0].text === 'Pembahasan:' && !nodes.some((n) => n.k === 'text' && n.text === ''), 'Salin data: sub-judul tebal dan tanpa baris kosong');
  const istimewaNodes = takeNodes(samples.pecahan), tableNode = istimewaNodes.find((n) => n.k === 'image');
  check(tableNode?.k === 'image' && tableNode.alt === 'Pecahan Istimewa' && slotSvg(samples.pecahan, tableNode.slot).includes('data:image/png;base64,'), 'Salin pecahan istimewa memakai gambar asli panduan');
  const copied = sectionsHtml([istimewaNodes], {});
  check(istimewaNodes.some((node) => node.k === 'image') && sectionsText([istimewaNodes]).includes('Pecahan Istimewa'), 'HTML dan teks salinan: judul tabel selebar kolom');
  check(sectionsText([takeNodes(samples.tabel)]).includes('\n• Urutan ke-1 → ') || sectionsText([takeNodes(samples.tabel)]).includes('• Urutan ke-1 →'), 'Teks salinan tabel memuat butir bullet');
  // Silogisme blueprint akademik 28 Okt: uji mutasi, penanda format, dan stress ringan (katalog lengkap serta 3000 seed per chapter dijalankan oleh `npx tsx scripts/tiu-format-checks.ts`).
  report.silogisme = { mutasi: silogismeMutations(check), stress: runSilogismeChecks(check, { stress: 120, catalog: false }) };
  return report;
}

// ---- Silogisme blueprint akademik 28 Okt: penanda format, uji mutasi, dan contoh dari katalog ---------------------------------------------------------
// Mutasi: pembahasan, kunci, model, atau stem yang dirusak harus ditolak pemeriksa mandiri (scripts/silogisme-checks.ts) lewat checkTiuFormat.
const silogismeSamples = (): Question[] => {
  const asQ = (built: ReturnType<typeof buildFromConfig>, no: number): Question => ({ ...toQuestion(built, 'mutasi-' + no), no });
  const configs: [Config, Chapter][] = [
    [{ base: base2('MP', 0), forms: [0, 0], keyForm: 0, order: 0 }, '2 Premis'], [{ base: base2('MT', 3), forms: [2, 0], keyForm: 0, order: 1 }, '2 Premis'],
    [{ base: base2('SK', 2), forms: [1, 2], keyForm: 1, order: 1 }, '2 Premis'], [{ base: base2('SK', 5), forms: [2, 1], keyForm: 2, order: 0 }, '2 Premis'],
    [{ base: base2('SD', 3), forms: [2, 0], keyForm: 0, order: 0 }, '2 Premis'], [{ base: base2('TK', 1), forms: [0, 0], keyForm: 0, order: 0 }, '2 Premis'], [{ base: base2('TA', 2), forms: [2, 0], keyForm: 0, order: 1 }, '2 Premis'],
    [{ base: base2('MP', 1), forms: [3, 0], keyForm: 0, order: 0 }, '2 Premis'], [{ base: base2('NI', 2), forms: [0, 1], keyForm: 0, order: 1 }, '2 Premis'],
    [{ base: base3(1, 0), forms: [1, 2, 0], keyForm: 0, order: 4 }, '3 Premis'], [{ base: base3(3, 5), forms: [1, 0, 2], keyForm: 2, order: 2 }, '3 Premis'], [{ base: base3(4, 3), forms: [0, 0, 0], keyForm: 0, order: 1 }, '3 Premis'],
    [{ base: base3(7, 2), forms: [0, 1, 0], keyForm: 0, order: 3 }, '3 Premis'], [{ base: base3(10, 1), forms: [0, 0, 0], keyForm: 0, order: 5 }, '3 Premis'], [{ base: base3(11, 5), forms: [2, 0, 0], keyForm: 0, order: 0 }, '3 Premis'],
    [{ base: base2('MT', 1), forms: [0, 0], keyForm: 0, order: 0 }, '2 Premis - Narasi'], [{ base: base2('TA', 0), forms: [0, 0], keyForm: 0, order: 1 }, '2 Premis - Narasi'],
    [{ base: base3(4, 3), forms: [0, 0, 0], keyForm: 0, order: 1 }, '3 Premis - Narasi'], [{ base: base3(9, 2), forms: [0, 0, 0], keyForm: 0, order: 3 }, '3 Premis - Narasi'], [{ base: base3(11, 6), forms: [0, 0, 0], keyForm: 0, order: 0 }, '3 Premis - Narasi'],
  ];
  const out = configs.map(([cfg, chapter], i) => asQ(buildFromConfig(cfg, chapter, rng('mutasi-config-' + i)), i + 1));
  for (const id of ['b2', 'b2x', 'b3', 'b3x', 'n2', 'n3']) for (let seed = 0; seed < 6; seed++) out.push(asQ(buildLogika(id, rng('mutasi-' + id + '-' + seed)), out.length + 1));
  // Contoh blueprint (butir jadi dari tulisan tim akademik) diperiksa dengan aturan yang sama: susunan terbalik, TDS, notasi tambahan, empat proposisi, dan TDS tiga premis.
  for (const index of [0, 6, 8, 10, 18]) out.push(asQ(contohBuild(CONTOH_NARASI[index], rng('mutasi-contoh-' + index)), out.length + 1));
  return out;
};
export function silogismeMutations(check: Check): Record<string, unknown> {
  type Syl = Extract<Model, { kind: 'syllogism' }>;
  const modelOf = (q: Question) => (q.proof as { model: Syl }).model;
  const withModel = (q: Question, change: (model: Syl) => void): Question => { const model = structuredClone(modelOf(q)); change(model); return { ...q, proof: { kind: 'model', model } as never }; };
  const edit = (q: Question, change: (lines: string[]) => string[] | null): Question | null => { const out = change(q.explanation.split('\n')); return out && out.join('\n') !== q.explanation ? { ...q, explanation: out.join('\n') } : null; };
  const replaceFirst = (lines: string[], test: (line: string) => boolean, make: (line: string) => string | null): string[] | null => { const at = lines.findIndex(test); if (at < 0) return null; const made = make(lines[at]); if (made === null) return lines.filter((_, i) => i !== at); return lines.map((line, i) => i === at ? made : line); };
  const flipSign = (tex: string) => tex.includes('\\neg ') ? tex.replace('\\neg ', '') : '\\neg ' + tex;
  const LAWS = ['Modus Ponens', 'Modus Tollens', 'hukum Silogisme', 'rumus silogisme', 'Silogisme Disjungtif'];
  const mutants: [string, (q: Question) => Question | null][] = [
    ['kunci yang bergeser', (q) => ({ ...q, answer: (q.answer + 1) % 5 })],
    ['opsi salah yang tidak dicoret', (q) => edit(q, (lines) => replaceFirst(lines, (line) => /^\{opsi:\d\}\. ~~.+~~$/.test(line), (line) => line.split('~~').join('')))],
    ['kunci yang ikut dicoret', (q) => edit(q, (lines) => replaceFirst(lines, (line) => line === '{opsi:' + q.options[q.answer].ref + '}. ' + q.options[q.answer].text, (line) => line.replace('}. ', '}. ~~') + '~~'))],
    ['seluruh coretan yang hilang', (q) => edit(q, (lines) => lines.map((line) => line.split('~~').join('')))],
    ['ulasan kunci dengan status keliru', (q) => ({ ...q, options: q.options.map((o, i) => i === q.answer ? { ...o, reason: o.reason.replace(/^(Maknanya sama dengan hasil penalaran langsung|Nilai kebenaran pernyataan yang ditanyakan belum dapat ditetapkan)/, 'Belum dapat dipastikan') } : o) })],
    ['ulasan pengecoh yang dikosongkan (narasi)', (q) => modelOf(q).chapter?.endsWith('Narasi') ? ({ ...q, options: q.options.map((o, i) => i === (q.answer + 1) % 5 ? { ...o, reason: '' } : o) }) : null],
    ['alasan pengecoh yang bertentangan dengan status (narasi)', (q) => modelOf(q).chapter?.endsWith('Narasi') ? ({ ...q, options: q.options.map((o, i) => i === (q.answer + 1) % 5 ? { ...o, reason: o.reason + ' Pernyataan ini berlawanan dengan premis dan belum diketahui.' } : o) }) : null],
    ['alasan opsi pada Silogisme Biasa', (q) => modelOf(q).chapter?.endsWith('Narasi') ? null : ({ ...q, options: q.options.map((o, i) => i === (q.answer + 1) % 5 ? { ...o, reason: 'Alasan opsi yang tidak boleh ada.' } : o) })],
    ['analisis opsi pada Silogisme Biasa', (q) => modelOf(q).chapter?.endsWith('Narasi') ? null : ({ ...q, explanation: q.explanation + '\n\n**Analisis setiap opsi**\n' + q.options.map((o) => o.text).join('\n') })],
    ['jenis kesalahan pengecoh yang hilang', (q) => withModel(q, (model) => { const at = model.options.findIndex((o) => o.text === q.options[(q.answer + 1) % 5].text); model.errors = model.errors!.map((e, i) => i === at ? null : e); })],
    ['baris Jawaban yang bukan kunci', (q) => edit(q, (lines) => replaceFirst(lines, (line) => line.startsWith('**Jawaban: '), () => '**Jawaban: ' + q.options[(q.answer + 1) % 5].text.replace(/\.$/, '') + '**'))],
    ['baris Jawaban yang tidak tebal', (q) => edit(q, (lines) => replaceFirst(lines, (line) => line.startsWith('**Jawaban: '), (line) => line.split('**').join('')))],
    ['hukum yang tertukar', (q) => edit(q, (lines) => replaceFirst(lines, (line) => LAWS.some((law) => line === 'Gunakan ' + law), (line) => line === 'Gunakan Modus Ponens' ? 'Gunakan Modus Tollens' : 'Gunakan Modus Ponens'))],
    ['baris TDS yang diganti hukum', (q) => edit(q, (lines) => replaceFirst(lines, (line) => line.includes('tidak masuk ke rumus silogisme manapun'), () => 'Gunakan Modus Ponens'))],
    ['kesimpulan yang berlawanan', (q) => edit(q, (lines) => replaceFirst(lines, (line) => /^\*\*Kesimpulan: \\\(/.test(line), (line) => line.replace(/\\\((.*)\\\)/, (_all, inner: string) => '\\(' + flipSign(inner) + '\\)')))],
    ['kesimpulan sementara yang keliru', (q) => edit(q, (lines) => replaceFirst(lines, (line) => /^(\*\*Kesimpulan \(Premis 4\): \\\(|Kesimpulan sementara: \*\*\\\()/.test(line), (line) => line.replace(/\\\((.*)\\\)/, (_all, inner: string) => '\\(' + flipSign(inner) + '\\)')))],
    ['rumus premis yang berbeda dari soal', (q) => edit(q, (lines) => replaceFirst(lines, (line) => /^Premis \d: \\\(/.test(line), (line) => line.replace(/\\\((.*)\\\)/, (_all, inner: string) => '\\(' + flipSign(inner) + '\\)')))],
    ['definisi variabel yang hilang', (q) => edit(q, (lines) => replaceFirst(lines, (line) => /^\\\(p\\\): /.test(line), () => null))],
    ['entri analisis yang hilang', (q) => edit(q, (lines) => lines.slice(0, -3))],
    ['kutipan premis yang berubah', (q) => edit(q, (lines) => replaceFirst(lines, (line) => /^Premis 1: /.test(line), (line) => line.replace('Premis 1: ', 'Premis 1: Menurut catatan '))) ],
    ['penghubung bersyarat pada stem', (q) => ({ ...q, stem: q.stem.replace(/^(\S+) /, 'Jika $1 ') })],
    ['kunci yang tidak mengikuti premis (model)', (q) => modelOf(q).options[q.answer].logic ? withModel(q, (model) => { const k = model.options[q.answer]; k.logic = { op: 'not', item: k.logic! }; }) : null],
    ['dua opsi yang sah (model)', (q) => withModel(q, (model) => { const key = model.options[q.answer], other = model.options.findIndex((o, i) => i !== q.answer && o.logic); if (other < 0) return; model.options[other].logic = key.logic ?? model.premises[0]; })],
    ['dua opsi tidak dapat disimpulkan', (q) => modelOf(q).options[q.answer].logic ? withModel(q, (model) => { [(q.answer + 1) % 5, (q.answer + 2) % 5].forEach((i) => { delete model.options[i].logic; }); }) : null],
    ['rujukan huruf opsi', (q) => ({ ...q, explanation: q.explanation + '\nOpsi A sudah tepat.' })],
    ['entri analisis berhuruf mati', (q) => edit(q, (lines) => replaceFirst(lines, (line) => /^\{opsi:\d\}\. /.test(line), (line) => line.replace(/^\{opsi:\d\}\. /, 'A. ')))],
    ['nomor penanda opsi yang bertukar', (q) => edit(q, (lines) => { const at = lines.flatMap((line, i) => /^\{opsi:\d\}\. /.test(line) ? [i] : []); if (at.length < 2) return null; const first = lines[at[0]], second = lines[at[1]]; return lines.map((line, i) => i === at[0] ? line.replace(/^\{opsi:\d\}/, '{opsi:' + second.slice(6, 7) + '}') : i === at[1] ? line.replace(/^\{opsi:\d\}/, '{opsi:' + first.slice(6, 7) + '}') : line); })],
    ['opsi narasi tanpa nomor tetap', (q) => modelOf(q).chapter?.endsWith('Narasi') ? ({ ...q, options: q.options.map((o) => { const { ref: _ref, ...rest } = o; return rest; }) }) : null],
    ['alasan analisis yang berbeda dari ulasan opsi', (q) => edit(q, (lines) => replaceFirst(lines, (line) => line.startsWith('→ '), (line) => line.replace(' — ', ' — Opsi ini dipilih karena kebiasaan. ')))],
    ['kata kunci narasi yang tidak tebal', (q) => modelOf(q).chapter?.endsWith('Narasi') ? edit(q, (lines) => replaceFirst(lines, (line) => /^Premis 1: /.test(line), (line) => line.split('**').join(''))) : null],
    ['kutipan premis Biasa yang ditebalkan', (q) => modelOf(q).chapter?.endsWith('Narasi') ? null : edit(q, (lines) => replaceFirst(lines, (line) => /^Premis 1: /.test(line), (line) => line.replace('Premis 1: ', 'Premis 1: **') + '**'))],
    ['koma pada premis narasi', (q) => modelOf(q).chapter?.endsWith('Narasi') ? { ...q, stem: q.stem.replace(' ', ', ') } : null],
    ['frasa berulang pada premis', (q) => ({ ...q, stem: q.stem.replace(/\.( |\n)/, ' pada catatan layanan pada catatan layanan.$1') })],
    ['opsi dengan tiga kata "tidak"', (q) => ({ ...q, options: q.options.map((o, i) => i === (q.answer + 1) % 5 ? { ...o, text: o.text.replace(/\.$/, ' tidak tidak tidak.') } : o) })],
    ['opsi literal pada soal hubungan (model)', (q) => { const keyLogic = modelOf(q).options[q.answer].logic; return keyLogic && (keyLogic.op === 'implies' || keyLogic.op === 'or') ? withModel(q, (model) => { model.options[(q.answer + 1) % 5].logic = model.premises[0].op === 'var' ? model.premises[0] : { op: 'var', name: 'p' }; }) : null; }],
  ];
  let applied = 0;
  const samples = silogismeSamples();
  samples.forEach((good, index) => {
    check(checkTiuFormat(good).length === 0, 'silogisme blueprint #' + index + ' (' + modelOf(good).code + '): contoh baik lolos\n' + checkTiuFormat(good).join('; ') + '\n' + good.stem + '\n' + good.explanation);
    for (const [name, mutate] of mutants) {
      const bad = mutate(good);
      if (!bad || JSON.stringify(bad) === JSON.stringify(good)) continue; // perusakan yang tidak berlaku pada chapter ini (mis. analisis opsi pada Silogisme Biasa)
      applied++;
      check(checkTiuFormat(bad).length > 0, 'silogisme ' + modelOf(good).code + ': pemeriksa menolak ' + name);
    }
  });
  const kinds = new Set(samples.map((q) => modelOf(q).chapter));
  check(kinds.size === 4 && applied > samples.length * 10, 'mutasi silogisme: ' + applied + ' perusakan pada ' + samples.length + ' contoh (empat chapter) semuanya ditolak');
  // Pemeriksa mandiri juga memeriksa opsi yang diacak (memakai teks opsi, bukan urutannya).
  check(samples.every((q) => { const order = [3, 1, 4, 0, 2]; return checkTiuFormat({ ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) }).length === 0; }), 'silogisme: soal tetap lolos setelah opsi diacak (model dan analisis dicocokkan lewat teks opsi)');
  // Pemeriksa frasa berulang, kalimat tidak gramatikal, dan aturan permukaan bekerja pada contoh yang diketahui.
  check(repeatedWords('Peminjam Nabila yang wajib didampingi petugas pada peminjaman koleksi pada peminjaman koleksi yang dibahas.') === 'pada peminjaman koleksi' &&
    repeatedWords('Pendaftaran pelatihan kerajinan milik Kirana tercatat dalam catatan pendaftaran kegiatan dalam catatan pendaftaran kegiatan tersebut.') !== undefined, 'pemeriksa frasa berulang menolak rujukan yang diulang');
  check(repeatedWords('Berkas Rafi tidak lolos verifikasi dan berkas Rafi tidak memperoleh kode layanan.') === undefined && repeatedWords('Katup K11 terbuka dan katup K11 tidak mengalirkan air ke bak penampung.') === undefined, 'subjek yang diulang pada opsi bukan frasa berulang');
  check(UNGRAMMATICAL.test('Pemohon Nadira tercakup dalam pemilik hak memilih jadwal pemakaian ruang.') && UNGRAMMATICAL.test('Untuk tenda yang tidak masuk daftar penyewaan, keterangan bahwa tenda melewati pemeriksaan berlaku.') &&
    !UNGRAMMATICAL.test('Pemohon Nadira tercakup dalam kelompok pemilik hak memilih jadwal pemakaian ruang.'), 'pemeriksa kalimat tidak gramatikal');
  check(fillerAcross(['Pemohon Nadira dengan berkas pengajuan yang dinyatakan lengkap berhak memilih jadwal pemakaian ruang dalam catatan pendaftaran yang ditinjau.', 'Pemohon Nadira tidak memiliki hak membuka kalender sesi praktik dalam catatan pendaftaran yang ditinjau.'])?.startsWith('dalam catatan') === true &&
    fillerAcross(['Pemohon Nadira dengan berkas pengajuan yang dinyatakan lengkap berhak memilih jadwal pemakaian ruang.', 'Pemohon Nadira tidak memiliki berkas pengajuan yang dinyatakan lengkap.']) === undefined, 'pemeriksa pengisi berulang menolak keterangan rujukan yang diulang di tiap premis, tetapi frasa proposisi penghubung boleh muncul pada dua premis');
  check(SURFACE_RULES.some(([, rule]) => rule('Berkas Rafi lolos verifikasi dan berkas Rafi masuk daftar antrean.', undefined)) && !SURFACE_RULES.some(([, rule]) => rule('Berkas Rafi lolos verifikasi.', undefined)), 'aturan permukaan menandai "dan" dan tidak menandai literal');
  // Penanda format sebaris (lib/richtext.ts): tebal, coret, bersarang, rumus dilewati, penanda tanpa pasangan, dan warna yang disiapkan.
  const runs = (text: string) => richRuns(text).map((run) => (run.bold ? 'B' : '') + (run.strike ? 'S' : '') + (run.color ? '#' + run.color : '') + '[' + run.text + ']').join('');
  check(runs('Teks biasa') === '[Teks biasa]' && runs('a **tebal** b') === '[a ]B[tebal][ b]' && runs('~~salah~~ benar') === 'S[salah][ benar]' && runs('**~~keduanya~~**') === 'BS[keduanya]', 'richRuns: teks biasa, tebal, coret, dan bersarang');
  check(runs('**Kesimpulan: \\(p \\to q\\)**') === 'B[Kesimpulan: \\(p \\to q\\)]' && runs('\\(a**b~~c\\)') === '[\\(a**b~~c\\)]' && runs('2 ** 3') === '[2 ** 3]' && runs('**tanpa penutup') === '[**tanpa penutup]', 'richRuns: rumus tidak dibaca sebagai penanda, penanda tanpa pasangan tetap teks');
  check(runs('{merah:penting} biasa') === '#merah[penting][ biasa]' && runs('{kunci} {biru:a **b**}') === '[{kunci} ]#biru[a ]B#biru[b]' && runs('{tak-dikenal:x}') === '[{tak-dikenal:x}]' && stripMarks('**a** ~~b~~ {hijau:c}') === 'a b c' && hasMarks('**a**') && !hasMarks('a * b') && !hasMarks('{kunci}'), 'richRuns: warna disiapkan ({merah:teks}) tetapi tidak mengganggu {kunci}; stripMarks membuang semua penanda');
  check(richHtml('**a** ~~b~~ {merah:c}', (text) => text) === '<b>a</b> <s style="text-decoration:line-through">b</s> <span data-warna="merah" style="color:#FF0000">c</span>' && COLORS_RENDERED === true, 'richHtml: tebal menjadi <b>, coret menjadi <s>, warna panduan digambar dengan gaya inline');
  const sample = samples.find((q) => modelOf(q).chapter?.endsWith('Narasi'))!, shown = explanationOf(sample); // analisis opsi hanya pada Silogisme Narasi
  check(parseExplanation(shown) !== null && explanationPlain(shown).includes('bukan kesimpulan yang dicari') && /^A\. /m.test(explanationPlain(shown)) && !/\*\*|~~|\{opsi:/.test(explanationPlain(shown)), 'penanda format: pembahasan terstruktur, teks polos tanpa penanda tetapi isinya terbaca');
  return { samples: samples.length, mutations: applied };
}

// ---- Ekspor PDF, Word, PNG dengan peramban tiruan ---------------------------------------------------------------------------------
function pdfDrawingCommands(buffer: Buffer): string {
  const source = buffer.toString('latin1'), streams: string[] = [];
  for (const match of source.matchAll(/stream\r?\n/g)) {
    const start = match.index! + match[0].length, end = source.indexOf('endstream', start);
    if (end < 0) continue;
    try { streams.push(Buffer.from(unzlibSync(buffer.subarray(start, end))).toString('latin1')); } catch { /* uncompressed or non-page stream */ }
  }
  return streams.filter(stream => /\bBT\b/.test(stream)).join('\n');
}
class StubCanvas {
  width = 0; height = 0; drawn = ''; images = 0; rects = 0; xs: number[] = [];
  context = { scale: () => {}, font: '', fillStyle: '', textBaseline: '', imageSmoothingQuality: '', fillRect: () => { this.rects++; }, measureText: (text: string) => ({ width: text.length * 5 }), fillText: () => {},
    drawImage: (image: { tag: string }, ...coordinates: number[]) => { this.drawn = image.tag; this.images++; this.xs.push(coordinates.length === 8 ? coordinates[4] : coordinates[0] ?? 0); } };
  getContext() { return this.context; }
  toDataURL() { return 'data:image/png;base64,' + Buffer.from(solidPng(this.width, this.height, this.drawn + this.images + ':' + this.rects)).toString('base64'); }
  toBlob(done: (blob: Blob | null) => void) { done(new Blob([solidPng(this.width, this.height, this.drawn) as Uint8Array<ArrayBuffer>], { type: 'image/png' })); }
}
class StubImage {
  onload: (() => void) | null = null; onerror: ((error: unknown) => void) | null = null; width = 0; height = 0; tag = '';
  set src(url: string) {
    void (async () => {
      try {
        if (url.startsWith('data:image/png;base64,')) { const png = Buffer.from(url.slice(22), 'base64'); this.width = png.readUInt32BE(16); this.height = png.readUInt32BE(20); this.tag = 'png'; }
        else { const svg = await resolveObjectURL(url)!.text(), size = svg.match(/width="([\d.]+)" height="([\d.]+)"/)!; this.width = Number(size[1]); this.height = Number(size[2]); this.tag = 'svg'; }
        this.onload?.();
      } catch (error) { this.onerror?.(error); }
    })();
  }
}

export async function runTiuExportChecks(check: Check): Promise<Record<string, unknown>> {
  const report: Record<string, unknown> = {};
  const g = globalThis as Record<string, unknown>, saved = { Image: g.Image, document: g.document }, canvases: StubCanvas[] = [];
  g.Image = StubImage;
  const anchors: { href: string }[] = [];
  g.document = { createElement(name: string) {
    if (name === 'a') { const a = { href: '', download: '', click() { anchors.push({ href: a.href }); }, remove() {} }; return a; }
    assert.equal(name, 'canvas'); const canvas = new StubCanvas(); canvases.push(canvas); return canvas;
  }, body: { appendChild() {} } };
  try {
    const q = (family: string, level: Difficulty, wanted: (q: Question) => boolean, no: number): Question => {
      for (let seed = 0; seed < 300; seed++) { const item = sample(family, level, seed); if (wanted(item)) return { ...item, no }; }
      throw new Error('contoh tidak ditemukan: ' + family);
    };
    const questions = [q('hitung', 'sulit', (x) => decimals(x.options[0].text) > 0, 1), q('pecahan', 'sedang', (x) => x.explanation.includes(SPECIAL_SENTENCE), 2), q('tabel', 'sedang', () => true, 3),
      q('data', 'sulit', (x) => x.explanation.includes('bersama-sama:'), 4)];
    const pack: Package = { id: 'SKD-01', seed: 'format', mode: 'TIU', duration: 90, questions };
    const settings = { title: 'Uji format TIU' };

    // PDF: satu berkas untuk keempat soal, termasuk tabel yang digambar sebagai gambar.
    const before = canvases.length;
    const pdf = Buffer.from(await (await pdfBlob([pack], settings, 'pembahasan')).arrayBuffer());
    check(pdf.subarray(0, 5).toString() === '%PDF-' && canvases.length > before + 4, 'PDF pembahasan terstruktur terbentuk (persamaan dan tabel dirasterkan)');
    check(canvases.slice(before).some((c) => c.width === guideImage('pecahan-istimewa').width * 3), 'PDF/PNG merasterkan gambar pecahan istimewa asli, bukan menggambar ulang tabel');

    // PNG satu soal.
    for (const item of questions) {
      const blob = await questionPngBlob(item, 'pembahasan'), bytes = new Uint8Array(await blob.arrayBuffer());
      check(bytes[0] === 137 && bytes[1] === 80, item.family + ': PNG pembahasan terbentuk');
    }

    // Word: tabel bergaris, judul selebar kolom, butir, dan sub-judul tebal.
    const parts = unzipSync(new Uint8Array(await (await wordBlob([pack], settings as never, 'pembahasan')).arrayBuffer()));
    const xml = new TextDecoder().decode(parts['word/document.xml']);
    check((xml.match(/<w:tbl>/g) ?? []).length === 1 && xml.includes('title="Pecahan Istimewa"') && xml.includes(SPECIAL_SENTENCE), 'Word: tabel pecahan istimewa dengan judul selebar 4 kolom dan kalimat pengantar');
    // Teks yang terlihat (bukan keterangan alternatif gambar, yang memang memuat LaTeX).
    const runs = [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
    check(runs.includes('• Urutan ke-1') && runs.includes('Pernyataan (1):') && runs.includes('Diketahui:') && !runs.includes('begin{aligned}') && !runs.includes('\\frac') && !xml.includes('undefined'), 'Word: butir bullet, pernyataan, sub-judul, dan persamaan (gambar) tanpa LaTeX mentah di teks');
    check(/<w:b\/>[\s\S]{0,200}?Diketahui:/.test(xml), 'Word: sub-judul "Diketahui:" tebal');
    check(runs.includes('SKD-01') && !runs.includes('\\(') && !runs.includes('mathrm'), 'Word: judul paket "SKD-01" teks biasa, bukan LaTeX');
    check((runs.match(/Pembahasan:/g) ?? []).length === 4 && runs.indexOf('Jawaban: ') < runs.indexOf('Pembahasan:'), 'Word: label "Pembahasan:" setelah "Jawaban:" pada tiap soal TIU');
    check(xml.includes('title="Pecahan Istimewa"') && Object.keys(parts).some((name) => name.startsWith('word/media/')), 'Word: judul tabel pecahan istimewa rata tengah');
    // CSV: kolom pembahasan terbaca, tanpa LaTeX atau penanda tabel mentah.
    await exportCsv([pack], { ...(settings as object), title: 'Uji CSV' } as never);
    const csv = await resolveObjectURL(anchors[anchors.length - 1].href)!.text();
    // Kolom soal dan opsi memang memuat LaTeX seperti sebelumnya; yang diperiksa hanya penanda khas pembahasan.
    check(!/\\begin\{aligned\}|\\text\{Nilai\}|\\frac\{1\}\{2\}=0|\|---\||\\\[/.test(csv) && csv.includes('Pernyataan (1):') && csv.includes('• Urutan ke-1 →') && csv.includes('Pecahan Istimewa') && csv.includes('1/8 = 0,125 = 12,5% | 3/8 = 0,375'), 'CSV: pembahasan terstruktur berupa teks terbaca (tanpa LaTeX atau |---| mentah)');
    const media = Object.keys(parts).filter((name) => name.startsWith('word/media/') && name.endsWith('.png'));
    check(media.length >= 5, 'Word: persamaan bertingkat menjadi gambar (' + media.length + ' gambar)');
    report.word = { tables: (xml.match(/<w:tbl>/g) ?? []).length, images: media.length }; // dua tabel: tabel soal pola bilangan dan tabel pecahan istimewa

    // Tahap 4b: kotak rumus, segitiga, tabel realisasi WOWO, matriks ✓ x ?, tabel posisi; huruf kunci diisi dari q.answer saat ekspor.
    const story = [q('cerita-hitung', 'sedang', (x) => stripMarks(x.explanation).includes('Vas DeWi'), 11), q('cerita-hitung', 'sulit', (x) => x.explanation.includes('RUMUS WOWO'), 12),
      q('kategori', 'sedang', (x) => x.explanation.includes('| Toko |'), 13), q('posisi', 'sulit', () => true, 14), q('cerita-hitung', 'sedang', (x) => x.explanation.includes('INGAT:') && !stripMarks(x.explanation).includes('Vas DeWi'), 15)]
      .map((item) => item.explanation.includes('{kunci}') ? { ...item, answer: 3 } : item);
    const pack2: Package = { id: 'SKD-02', seed: 'format-4b', mode: 'TIU', duration: 90, questions: story };
    const beforeStory = canvases.length;
    const pdf2 = Buffer.from(await (await pdfBlob([pack2], settings, 'pembahasan')).arrayBuffer());
    check(pdf2.subarray(0, 5).toString() === '%PDF-' && canvases.length > beforeStory + 5, 'PDF: kotak, segitiga, tabel realisasi, dan matriks terbentuk');
    check((pdfDrawingCommands(pdf2).match(/ re\n/g) ?? []).length >= 16 && ['segitiga-jkw', 'segitiga-vdw'].every((id) => canvases.slice(beforeStory).some((c) => c.width === guideImage(id as 'segitiga-jkw' | 'segitiga-vdw').width * 3)), 'PDF: tabel memiliki sel vektor dan dua segitiga memakai gambar asli panduan');
    for (const item of story) check((await questionPngBlob(item, 'pembahasan')).size > 100, item.family + ': PNG pembahasan 4b terbentuk');
    const parts2 = unzipSync(new Uint8Array(await (await wordBlob([pack2], settings as never, 'pembahasan')).arrayBuffer()));
    const xml2 = new TextDecoder().decode(parts2['word/document.xml']), runs2 = [...xml2.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
    check((xml2.match(/<w:tbl>/g) ?? []).length === 4 && xml2.includes('title="Segitiga JKW"') && xml2.includes('title="Segitiga VDW"') && runs2.includes('Vas DeWi') && runs2.includes('RUMUS WOWO') && runs2.includes('Rumus Konsep:') && runs2.includes('Rencana:'), 'Word: kotak Vas DeWi, tabel segitiga, realisasi, Rumus Cepat, matriks, dan posisi sebagai tabel');
    check(!runs2.includes('{kunci}') && (runs2.match(/Jadi, jawaban yang benar adalah D\./g) ?? []).length >= 5 && !xml2.includes('undefined'), 'Word: huruf kunci terisi dari jawaban (D), tanpa penanda mentah');
    check(!/\\(?:frac|begin|text|cdot)|\\\[|\\\(/.test(runs2), 'Word: tidak ada LaTeX mentah pada teks yang terlihat');
    const csv2 = (await exportCsv([pack2], { ...(settings as object), title: 'Uji CSV 4b' } as never), await resolveObjectURL(anchors[anchors.length - 1].href)!.text());
    check(csv2.includes('Jadi, jawaban yang benar adalah D.') && !csv2.includes('{kunci}') && !/\\begin\{aligned\}|\\text\{x\}|\|---\||\\\[/.test(csv2), 'CSV: huruf kunci terisi dan pembahasan 4b berupa teks terbaca');
    const taken = sectionsText(takeSections(story[1], ['pembahasan'])), htmlTaken = sectionsHtml(takeSections(story[2], ['pembahasan']), {});
    check(taken.includes('Jadi, jawaban yang benar adalah D.') && !/\\|\{kunci\}/.test(taken) && taken.includes('RUMUS WOWO') && htmlTaken.includes('text-align:center'), 'Salin: huruf kunci terisi, teks terbaca, tabel pendek ditengahkan');
    report.word4b = { tables: (xml2.match(/<w:tbl>/g) ?? []).length };

    // Tahap 4c: diagram deret (panah arah, panah pola, panah turun Fibonacci) harus ikut ke layar, PDF, PNG, Word, CSV, dan salinan.
    const deret = [q('deret', 'mudah', () => true, 21), q('deret', 'sedang', () => true, 22), q('fibonacci', 'sedang', () => true, 23), q('tiga-jalur', 'sulit', () => true, 24), q('selang-seling', 'sedang', () => true, 25)]
      .map((item) => ({ ...item, answer: 3 }));
    const chainsOf = (item: Question) => (parseExplanation(item.explanation) ?? []).flatMap((b) => b.k === 'chain' ? [b.chain] : []);
    const allChains = deret.flatMap(chainsOf), widthOf = (svg: string) => Number(/width="(\d+)"/.exec(svg)![1]);
    check(allChains.length === 2 + 2 + 1 + 2 + 1, 'Contoh deret memuat 8 diagram (mudah 2, sedang 2, fibonacci 1, tiga jalur 2, campuran 1)');
    const pack3: Package = { id: 'SKD-03', seed: 'format-4c', mode: 'TIU', duration: 90, questions: deret };
    const beforeDeret = canvases.length;
    const pdf3 = Buffer.from(await (await pdfBlob([pack3], settings, 'pembahasan')).arrayBuffer());
    const drawn = canvases.slice(beforeDeret).map((c) => c.width);
    check(pdf3.subarray(0, 5).toString() === '%PDF-' && allChains.every((chain) => drawn.includes(widthOf(chainSvg(chain)) * 3)), 'PDF: setiap diagram deret dirasterkan tiga kali ukuran SVG-nya');
    for (const item of deret) check((await questionPngBlob(item, 'pembahasan')).size > 100, item.family + ': PNG pembahasan deret terbentuk');
    const beforePng = canvases.length;
    await questionPngBlob(deret[1], 'pembahasan');
    check(chainsOf(deret[1]).every((chain) => canvases.slice(beforePng).some((c) => c.width === widthOf(chainSvg(chain)) * 3)), 'PNG: diagram arah dan pola tersusun ke dalam gambar pembahasan');
    const parts3 = unzipSync(new Uint8Array(await (await wordBlob([pack3], settings as never, 'pembahasan')).arrayBuffer()));
    const xml3 = new TextDecoder().decode(parts3['word/document.xml']), runs3 = [...xml3.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
    const media3 = Object.keys(parts3).filter((name) => name.startsWith('word/media/') && name.endsWith('.png')).length;
    check((xml3.match(/title="Diagram pola deret"/g) ?? []).length === allChains.length && media3 >= 1 && !xml3.includes('undefined') && !runs3.includes('@deret') && !runs3.includes('{"terms"'), 'Word: tiap diagram deret menjadi gambar bertitle "Diagram pola deret", tanpa JSON mentah di teks');
    check(runs3.includes('Pola yang terlihat:') && runs3.includes('artinya 2 towew') && xml3.includes('title="\\uparrow"') && xml3.includes('title="\\downarrow"') && (xml3.match(/<w:tbl>/g) ?? []).length === 3 && (runs3.match(/Jadi, [^.]*\. Jawaban yang benar adalah D\.|Jadi, jawaban yang benar adalah D\./g) ?? []).length === 5 && !runs3.includes('{kunci}'), 'Word: panah sebagai glif gambar, "artinya N towew", tabel konsep towew (3), dan huruf kunci D terisi');
    await exportCsv([pack3], { ...(settings as object), title: 'Uji CSV 4c' } as never);
    const csv3 = await resolveObjectURL(anchors[anchors.length - 1].href)!.text();
    check(!csv3.includes('@deret') && !csv3.includes('{"terms"') && csv3.includes('Arah: ↑ ↓ ↑') && csv3.includes(' →(+') && csv3.includes(' →(−') && /\d+ = \d+\+\d+/.test(csv3) && csv3.includes('Pola yang terlihat:') && !csv3.includes('{kunci}'), 'CSV: diagram deret berupa teks (Arah, "a →(+k) b", "c = a+b"), tanpa JSON mentah');
    // Salinan: tiap diagram satu gambar (slot diagramN) dengan teks pengganti; tanpa gambar jadi teks polos.
    deret.forEach((item) => {
      const nodes = takeSections(item, ['pembahasan'])[0], images = nodes.filter((n) => n.k === 'image');
      check(images.length === chainsOf(item).length && images.every((n, i) => n.k === 'image' && n.slot === 'diagram' + i && !!n.text), item.family + ': salin memuat satu gambar per diagram dengan teks pengganti');
      const text = sectionsText([nodes]), html = sectionsHtml([nodes], {});
      check(!text.includes('@deret') && !text.includes('{"terms"') && !html.includes('@deret') && !html.includes('{"terms"') && text.includes('→(') === chainsOf(item).some((c) => c.arcs.some((a) => (a.style ?? 'arc') === 'arc')) && html.includes('→(') === text.includes('→('), item.family + ': salinan teks dan HTML tanpa JSON mentah');
    });
    const screen = renderToStaticMarkup(createElement(QuestionCard, { question: deret[1], showAnswers: true }));
    check((screen.match(/class="explanation-chain"/g) ?? []).length === 2 && screen.includes('<svg') && screen.includes('aria-label="Pola deret: ') && !screen.includes('@deret') && !screen.includes('math-error'), 'Layar: dua diagram SVG (arah dan pola) pada pembahasan deret 2 towew');
    report.deret4c = { diagrams: allChains.length, media: media3, tables: (xml3.match(/<w:tbl>/g) ?? []).length };

    // Tahap 4d: diagram figural beranotasi (lingkaran merah, kotak biru, panah berlabel, label, angka sudut, tag kuning) ikut ke layar, PDF, PNG, Word, CSV, dan salinan.
    const keyAtD = (item: Question): Question => { const rest = item.options.map((_, i) => i).filter((i) => i !== item.answer), order = [...rest.slice(0, 3), item.answer, ...rest.slice(3)]; return { ...item, options: order.map((i) => item.options[i]), answer: 3 }; };
    const figuralSet = [q('fig-analogi', 'sedang', () => true, 31), q('fig-odd', 'mudah', (x) => x.visual?.rule?.mekanisme === 'ketidaksamaan-urutan', 32), q('fig-odd', 'sedang', (x) => x.visual?.rule?.mekanisme === 'ketidaksamaan-sisi', 33),
      q('fig-serial', 'sedang', (x) => x.visual?.rule?.mekanisme === 'serial-dua-aturan', 34), q('fig-matrix', 'sedang', (x) => x.visual?.rule?.mekanisme === 'matriks-latin', 35), q('fig-matrix', 'sedang', (x) => x.visual?.rule?.mekanisme === 'matriks-jumlah', 36)].map(keyAtD);
    const figuresOf = (item: Question) => (parseExplanation(explanationOf(item)) ?? []).flatMap((b) => b.k === 'figure' ? [b.figure] : []);
    const allFigures = figuralSet.flatMap(figuresOf);
    check(figuralSet.every((item) => checkTiuFormat(item).length === 0) && allFigures.length >= 10, 'Contoh figural memuat diagram beranotasi (' + allFigures.length + ' diagram) dan lolos pemeriksa');
    const pack4: Package = { id: 'SKD-04', seed: 'format-4d', mode: 'TIU', duration: 90, questions: figuralSet };
    const beforeFig = canvases.length;
    const pdf4 = Buffer.from(await (await pdfBlob([pack4], settings, 'pembahasan')).arrayBuffer());
    const drawnFig = canvases.slice(beforeFig).map((c) => c.width);
    check(pdf4.subarray(0, 5).toString() === '%PDF-' && allFigures.every((figure) => drawnFig.includes(widthOf(figureSvg(figure)) * 3)), 'PDF: setiap diagram figural dirasterkan tiga kali ukuran SVG-nya');
    for (const item of figuralSet) check((await questionPngBlob(item, 'pembahasan')).size > 100, item.family + ': PNG pembahasan figural terbentuk');
    const parts4 = unzipSync(new Uint8Array(await (await wordBlob([pack4], settings as never, 'pembahasan')).arrayBuffer()));
    const xml4 = new TextDecoder().decode(parts4['word/document.xml']), runs4 = [...xml4.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
    const media4 = Object.keys(parts4).filter((name) => name.startsWith('word/media/') && name.endsWith('.png')).length;
    check((xml4.match(/title="Diagram pembahasan figural"/g) ?? []).length === allFigures.length && media4 >= allFigures.length && !xml4.includes('undefined') && !runs4.includes('@gambar') && !runs4.includes('"cells"') && !runs4.includes('{kunci}'), 'Word: tiap diagram figural menjadi gambar bertitle "Diagram pembahasan figural", tanpa JSON atau penanda mentah di teks');
    check((runs4.match(/Jadi, jawaban yang benar adalah D\./g) ?? []).length === figuralSet.length, 'Word: huruf kunci D terisi pada penutup tiap soal figural');
    await exportCsv([pack4], { ...(settings as object), title: 'Uji CSV 4d' } as never);
    const csv4 = await resolveObjectURL(anchors[anchors.length - 1].href)!.text();
    check(!csv4.includes('@gambar') && !csv4.includes('"cells"') && !csv4.includes('{kunci}') && csv4.includes('Sesuai dengan gambar pada opsi D') && csv4.includes('→('), 'CSV: diagram figural berupa teks (kotak, panah berlabel, tag dengan huruf kunci), tanpa JSON mentah');
    figuralSet.forEach((item) => {
      const nodes = takeSections(item, ['pembahasan'])[0], images = nodes.filter((n) => n.k === 'image');
      check(images.length === figuresOf(item).length && images.every((n, i) => n.k === 'image' && n.slot === 'diagram' + i && !!n.text) && slotSvg(item, 'diagram0' as never) === figureSvg(figuresOf(item)[0]), item.family + ': salin memuat satu gambar per diagram figural dengan teks pengganti');
      const text = sectionsText([nodes]), html = sectionsHtml([nodes], {});
      check(!text.includes('@gambar') && !text.includes('"cells"') && !html.includes('@gambar') && !html.includes('"cells"') && text.includes('opsi D'), item.family + ': salinan teks dan HTML tanpa JSON mentah');
    });
    const screenFig = renderToStaticMarkup(createElement(QuestionCard, { question: figuralSet[1], showAnswers: true }));
    check((screenFig.match(/explanation-figure/g) ?? []).length === figuresOf(figuralSet[1]).length && screenFig.includes('aria-label="Diagram pembahasan: ') && !screenFig.includes('@gambar') && !screenFig.includes('NaN') && !screenFig.includes('math-error'), 'Layar: diagram figural tampil sebagai SVG pada pembahasan');
    report.figural4d = { diagrams: allFigures.length, media: media4 };

    // QA akhir: diagram yang tidak dapat digambar (bentuk figural tidak dikenal pada data yang lolos tanpa editor, mis. pemulihan cadangan) tidak menggagalkan ekspor.
    // PDF, PNG, Word, CSV, dan salinan tetap terbentuk dengan keterangan pengganti, sedangkan diagram lain pada soal yang sama tetap digambar.
    {
      const lines = figuralSet[1].explanation.split('\n'), at = lines.findIndex((line) => line.startsWith('@gambar '));
      const figure = JSON.parse(lines[at].slice(8)) as FigureDiagram;
      figure.cells.find((c) => c.scene)!.scene!.parts[0].g = 'bentuk-tak-dikenal';
      const bad: Question = { ...figuralSet[1], explanation: lines.map((line, i) => i === at ? '@gambar ' + JSON.stringify(figure) : line).join('\n') };
      const blocks = (parseExplanation(explanationOf(bad)) ?? []).filter(isDiagramBlock), failing = blocks.filter((block) => 'error' in diagramResult(block)).length;
      check(failing === 1 && blocks.length >= 1, 'Uji diagram rusak: tepat satu diagram tidak dapat digambar (' + failing + ' dari ' + blocks.length + ')');
      const packBad: Package = { id: 'SKD-06', seed: 'format-qa', mode: 'TIU', duration: 90, questions: [bad] };
      const survives = async (label: string, run: () => Promise<unknown>) => { try { await run(); return true; } catch (error) { check(false, label + ' gagal total: ' + (error as Error).message); return false; } };
      let pdfBad: Buffer | undefined, wordBad: Record<string, Uint8Array> | undefined;
      await survives('PDF', async () => { pdfBad = Buffer.from(await (await pdfBlob([packBad], settings, 'pembahasan')).arrayBuffer()); });
      check(!!pdfBad && pdfBad.subarray(0, 5).toString() === '%PDF-', 'PDF: ekspor tetap berjalan bila ada diagram yang tidak dapat digambar');
      await survives('PNG', async () => { check((await questionPngBlob(bad, 'pembahasan')).size > 100, 'PNG: pembahasan dengan diagram rusak tetap terbentuk'); });
      await survives('Word', async () => { wordBad = unzipSync(new Uint8Array(await (await wordBlob([packBad], settings as never, 'pembahasan')).arrayBuffer())); });
      const xmlBad = wordBad ? new TextDecoder().decode(wordBad['word/document.xml']) : '', runsBad = [...xmlBad.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
      check(runsBad.includes('Diagram tidak dapat digambar') && runsBad.includes('bentuk-tak-dikenal') && (xmlBad.match(/title="Diagram pembahasan figural"/g) ?? []).length === blocks.length - failing, 'Word: diagram rusak diganti keterangan, diagram lain tetap berupa gambar (' + (blocks.length - failing) + ')');
      await survives('CSV', async () => { await exportCsv([packBad], { ...(settings as object), title: 'Uji CSV rusak' } as never); });
      await survives('Salinan', async () => {
        const nodes = takeSections(bad, ['pembahasan'])[0], images = nodes.filter((n) => n.k === 'image');
        check(images.length === blocks.length - failing && images.every((n, i) => n.k === 'image' && n.slot === 'diagram' + i) && sectionsText([nodes]).includes('Diagram tidak dapat digambar') && (blocks.length === failing || slotSvg(bad, 'diagram0' as never).startsWith('<svg')), 'Salinan: diagram rusak menjadi keterangan teks; nomor gambar hanya untuk diagram yang berhasil digambar');
      });
    }

    // QA akhir: sel "x" pada tabel pembahasan (bentuk orang-kegiatan, yang kalimatnya tidak memuat rumus x sehingga gambarnya hanya bisa berasal dari sel) menjadi gambar rumus di Word. tableGrid mengubah "x" menjadi \(\text{x}\) saat tata letak, jadi gambar rumus harus
    // disiapkan dari teks sel hasil tata letak (explanationTexts), bukan dari teks mentah; sebelumnya Word menampilkan teks "\(\text{x}\)".
    {
      const kategori = q('kategori', 'sedang', (x) => /\|\s*x\s*\|/.test(x.explanation) && !x.explanation.includes('\\(\\text{x}\\)'), 61), table = (parseExplanation(explanationOf(kategori)) ?? []).flatMap((b) => b.k === 'table' ? [b] : [])[0];
      const crosses = table.rows.flat().filter((cell) => cell.trim() === 'x').length;
      const wordK = unzipSync(new Uint8Array(await (await wordBlob([{ id: 'SKD-07', seed: 'format-x', mode: 'TIU', duration: 90, questions: [kategori] }], settings as never, 'pembahasan')).arrayBuffer()));
      const xmlK = new TextDecoder().decode(wordK['word/document.xml']), runsK = [...xmlK.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
      check(crosses >= 3 && !runsK.includes('\\(') && !runsK.includes('\\text') && (xmlK.match(/name="formula"/g) ?? []).length >= crosses, 'Word: ' + crosses + ' sel "x" pada tabel pembahasan menjadi gambar rumus, tanpa teks mentah \\(\\text{x}\\)');
      check(explanationTexts(explanationOf(kategori)).filter((piece) => piece === '\\(\\text{x}\\)').length === crosses, 'explanationTexts memuat sel "x" sebagai rumus (teks seperti yang ditata)');
    }

    // Tahap 4e: graf rute, rumus logika (\neg, \to, \lor) pada pembahasan dan ulasan opsi, serta ulasan per opsi analogi ikut ke layar, PDF, PNG, Word, CSV, dan salinan.
    const keyAtThree = (item: Question): Question => { const rest = item.options.map((_, i) => i).filter((i) => i !== item.answer), order = [...rest.slice(0, 3), item.answer, ...rest.slice(3)]; return { ...item, options: order.map((i) => item.options[i]), answer: 3 }; };
    const verbalSet = [q('rute', 'sulit', (x) => x.stem.includes('saling terhubung'), 41), q('rute', 'sedang', () => true, 42),
      q('silogisme', 'sulit', (x) => x.explanation.includes('hukum implikasi'), 43), q('silogisme', 'sulit', (x) => x.explanation.includes('Langkah 2') && x.explanation.includes('**Analisis setiap opsi**'), 44), q('silogisme', 'sedang', (x) => x.explanation.includes('Gunakan Modus Ponens') && !x.explanation.includes('Langkah'), 45),
      q('silogisme', 'sedang', (x) => x.stem.startsWith('Kontraposisi'), 46), q('analogi', 'mudah', () => true, 47)].map(keyAtThree);
    const graphsOf = (item: Question) => (parseExplanation(explanationOf(item)) ?? []).flatMap((b) => b.k === 'graph' ? [b.graph] : []);
    const allGraphs = verbalSet.flatMap(graphsOf);
    check(verbalSet.every((item) => checkTiuFormat(item).length === 0) && allGraphs.length === 2, 'Contoh rute, silogisme, dan analogi lolos pemeriksa (dua graf rute)');
    const pack5: Package = { id: 'SKD-05', seed: 'format-4e', mode: 'TIU', duration: 90, questions: verbalSet };
    const beforeVerbal = canvases.length;
    const pdf5 = Buffer.from(await (await pdfBlob([pack5], settings, 'pembahasan')).arrayBuffer());
    const drawnVerbal = canvases.slice(beforeVerbal).map((c) => c.width);
    check(pdf5.subarray(0, 5).toString() === '%PDF-' && allGraphs.every((graph) => drawnVerbal.includes(widthOf(graphSvg(graph)) * 3)) && canvases.length - beforeVerbal > allGraphs.length + 8, 'PDF: graf rute dirasterkan tiga kali ukuran SVG-nya, rumus logika dan ulasan opsi ikut tergambar');
    for (const item of verbalSet) check((await questionPngBlob(item, 'pembahasan')).size > 100, item.family + ': PNG pembahasan terbentuk');
    const parts5 = unzipSync(new Uint8Array(await (await wordBlob([pack5], settings as never, 'pembahasan')).arrayBuffer()));
    const xml5 = new TextDecoder().decode(parts5['word/document.xml']), runs5 = [...xml5.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
    check((xml5.match(/title="Graf rute"/g) ?? []).length === allGraphs.length && !xml5.includes('undefined') && !runs5.includes('@graf') && !runs5.includes('"nodes"') && !/\\(?:neg|to|lor|equiv)|\\\(/.test(runs5) && !runs5.includes('{kunci}'), 'Word: graf rute menjadi gambar bertitle "Graf rute"; rumus logika tidak tertulis sebagai LaTeX mentah');
    check((runs5.match(/Jadi, jawaban yang benar adalah D\./g) ?? []).length === 2 && runs5.includes('Pola yang sama terdapat pada opsi D') && /Maknanya sama dengan hasil penalaran langsung|Nilai kebenaran pernyataan yang ditanyakan belum dapat ditetapkan/.test(runs5) && /\([A-E]\)|[A-E]\. /.test(runs5), 'Word: huruf kunci D terisi, ulasan opsi silogisme dan analogi tertulis');
    await exportCsv([pack5], { ...(settings as object), title: 'Uji CSV 4e' } as never);
    const csv5 = await resolveObjectURL(anchors[anchors.length - 1].href)!.text();
    for (const [name, ok] of Object.entries({ 'tanpa JSON graf': !csv5.includes('@graf') && !csv5.includes('"nodes"'), 'tanpa penanda kunci': !csv5.includes('{kunci}'), 'tanpa LaTeX mentah': !/\\neg|\\to|\\lor|\\equiv|\\\(/.test(csv5), 'teks graf': csv5.includes('Masuk: '), 'lambang logika': csv5.includes('¬') && csv5.includes('→'), 'ulasan silogisme': /Maknanya sama dengan hasil penalaran langsung|Nilai kebenaran pernyataan yang ditanyakan belum dapat ditetapkan/.test(csv5), 'ulasan analogi': csv5.includes('tidak sepadan, karena') }))
      check(ok, 'CSV: graf menjadi teks, rumus logika terbaca (¬, →, ∨), ulasan opsi ikut: ' + name + ' tidak terpenuhi');
    verbalSet.forEach((item) => {
      const nodes = takeSections(item, ['pembahasan'])[0], images = nodes.filter((n) => n.k === 'image'), text = sectionsText([nodes]);
      check(images.length === graphsOf(item).length && images.every((n, i) => n.k === 'image' && n.slot === 'diagram' + i && !!n.text) && !text.includes('@graf') && !/\\neg|\\to|\\lor/.test(text), item.family + ': salinan pembahasan membawa graf sebagai gambar dengan teks pengganti, rumus logika terbaca');
    });
    const rute5 = renderToStaticMarkup(createElement(QuestionCard, { question: verbalSet[0], showAnswers: true })), logic5 = renderToStaticMarkup(createElement(QuestionCard, { question: verbalSet[5], showAnswers: true })), analysis5 = renderToStaticMarkup(createElement(QuestionCard, { question: verbalSet[3], showAnswers: true })), biasa5 = renderToStaticMarkup(createElement(QuestionCard, { question: verbalSet[2], showAnswers: true }));
    check(rute5.includes('explanation-graph') && rute5.includes('aria-label="Graf rute: ') && !rute5.includes('@graf') && !rute5.includes('math-error') && logic5.includes('option-reasons') && logic5.includes('math-formula') && !logic5.includes('math-error') && analysis5.includes('line-through') && analysis5.includes('math-formula') && !analysis5.includes('option-reasons') && !analysis5.includes('math-error') && !/\\neg|\\to /.test(logic5.replace(/aria-label="[^"]*"/g, '')), 'Layar: graf rute tampil sebagai SVG; ulasan opsi dan rumus logika terbaca tanpa kesalahan LaTeX');
    check(!biasa5.includes('line-through') && !biasa5.includes('option-reasons') && !biasa5.includes('Analisis setiap opsi') && biasa5.includes('Jawaban: ') && !biasa5.includes('math-error'), 'Layar: Silogisme Biasa berakhir pada jawaban kalimat, tanpa analisis opsi dan tanpa daftar alasan opsi');
    report.verbal4e = { graphs: allGraphs.length, media: Object.keys(parts5).filter((name) => name.startsWith('word/media/')).length };
    // Silogisme blueprint akademik 28 Okt: opsi yang salah ditulis coret (~~teks~~) pada analisis opsi; coretan dan tebal harus sampai ke layar, PDF, PNG, Word, salinan HTML, salinan teks, dan CSV.
    {
      const make = (id: string, seed: string, no: number): Question => ({ ...toQuestion(buildLogika(id, rng(seed)), 'coret-' + no), no });
      const items = [make('n3', 'coret-a', 1), make('n2', 'coret-b', 2), make('n2', 'coret-c', 3)], biasaItem = make('b2x', 'coret-d', 4);
      const wrongTexts = (item: Question) => item.options.filter((_, i) => i !== item.answer).map((o) => o.text);
      const pack6: Package = { id: 'SKD-06', seed: 'format-coret', mode: 'TIU', duration: 90, questions: items };
      const unstruck: Package = { ...pack6, questions: items.map((item) => ({ ...item, explanation: item.explanation.split('~~').join('') })) };
      // PDF dan PNG: coretan digambar dengan fillRect pada kanvas baris (satu garis per kata dan spasi yang dicoret). Kanvas baris dipakai ulang untuk tiap baris, jadi jumlah fillRect
      // dibandingkan dengan versi tanpa penanda (baris dan latar sama persis); selisihnya adalah garis coretan.
      const rectsFrom = (start: number) => canvases.slice(start).reduce((sum, c) => sum + c.rects, 0);
      let from = canvases.length;
      const pdf6 = Buffer.from(await (await pdfBlob([pack6], settings, 'pembahasan')).arrayBuffer());
      const countStrokes = (bytes: Buffer) => (pdfDrawingCommands(bytes).match(/ l\nS\n/g) ?? []).length;
      const plainPdf = Buffer.from(await (await pdfBlob([unstruck], settings, 'pembahasan')).arrayBuffer());
      const pdfStruck = countStrokes(pdf6) - countStrokes(plainPdf);
      check(pdf6.subarray(0, 5).toString() === '%PDF-' && pdfStruck >= 12, 'PDF: opsi salah pada analisis digambar dengan coretan (' + pdfStruck + ' garis coretan; tanpa penanda tidak ada garis tambahan)');
      for (const item of items) {
        from = canvases.length; await questionPngBlob(item, 'pembahasan'); const pngRects = rectsFrom(from);
        from = canvases.length; await questionPngBlob({ ...item, explanation: item.explanation.split('~~').join('') }, 'pembahasan');
        check(pngRects - rectsFrom(from) >= 4, 'PNG: coretan opsi salah tergambar (' + (pngRects - rectsFrom(from)) + ' garis coretan; tanpa penanda tidak ada garis tambahan)');
      }
      // Word: run bertanda <w:strike/> persis pada keempat opsi salah tiap soal, tidak pada kunci; tebal pada kesimpulan dan jawaban.
      const word6 = unzipSync(new Uint8Array(await (await wordBlob([pack6], settings as never, 'pembahasan')).arrayBuffer()));
      const xml6 = new TextDecoder().decode(word6['word/document.xml']), runElements = xml6.match(/<w:r>[\s\S]*?<\/w:r>/g) ?? [];
      const textOf = (run: string) => [...run.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
      const struckRuns = runElements.filter((run) => run.includes('<w:strike/>')).map(textOf), boldRuns = runElements.filter((run) => run.includes('<w:b/>')).map(textOf);
      const xmlText = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      const wrongAll = items.flatMap(wrongTexts), keyAll = items.map((item) => item.options[item.answer].text);
      check(struckRuns.length === wrongAll.length && wrongAll.every((text) => struckRuns.includes(xmlText(text))) && keyAll.every((text) => !struckRuns.includes(xmlText(text))), 'Word: tepat ' + wrongAll.length + ' run bercoret (<w:strike/>) berisi opsi salah, kunci tidak dicoret');
      check(boldRuns.some((text) => text.startsWith('Jawaban: ') && text.length > 12) && boldRuns.some((text) => text === 'Analisis setiap opsi') && boldRuns.includes('kesimpulan yang dicari') && boldRuns.includes('bukan kesimpulan yang dicari') && !xml6.includes('~~') && !textOf(xml6).includes('**'),
        'Word: Jawaban, judul analisis, dan status opsi tebal; tanpa penanda ~~ atau ** yang tertinggal');
      // Salinan HTML (Word dan Google Docs) dan teks polos.
      for (const item of items) {
        const nodes = takeSections(item, ['pembahasan']), html = sectionsHtml(nodes, {}), text = sectionsText(nodes);
        const struckHtml = [...html.matchAll(/<s style="text-decoration:line-through">([^<]*)<\/s>/g)].map((m) => m[1]);
        check(struckHtml.length === 4 && struckHtml.every((value) => wrongTexts(item).includes(value.replaceAll('&amp;', '&'))) && !html.includes('~~') && !html.includes('**') && /<b>Jawaban: /.test(html), item.options[item.answer].text.slice(0, 30) + ': salinan HTML memuat <s> pada empat opsi salah dan <b> pada jawaban');
        check(!text.includes('~~') && !text.includes('**') && wrongTexts(item).every((value) => text.includes(value)) && text.includes('bukan kesimpulan yang dicari') && text.includes('Jawaban: '), 'salinan teks polos: tanpa penanda, opsi salah dan alasannya tetap terbaca');
        check(item.options.every((o, i) => text.includes('ABCDE'[i] + '. ' + o.text)) && !text.includes('{opsi:'), 'salinan teks polos: analisis opsi berhuruf menurut urutan opsi yang tampil');
      }
      // CSV: pembahasan terbaca tanpa penanda tebal dan coret.
      await exportCsv([pack6], { ...(settings as object), title: 'Uji CSV coret' } as never);
      const csv6 = await resolveObjectURL(anchors[anchors.length - 1].href)!.text();
      check(items.every((item) => item.options.every((o, i) => csv6.includes('ABCDE'[i] + '. ' + o.text))) && !csv6.includes('{opsi:'), 'CSV: analisis opsi berhuruf menurut urutan opsi yang tampil');
      check(!csv6.includes('~~') && !csv6.includes('**') && wrongAll.every((value) => csv6.includes(value)) && csv6.includes('bukan kesimpulan yang dicari') && csv6.includes('Jawaban: ') && !/\\\(|\\neg|\\to /.test(csv6.slice(csv6.indexOf('Pembahasan'))), 'CSV: pembahasan silogisme berupa teks terbaca tanpa penanda ~~ dan **');
      // Layar: <s> pada opsi salah, <b> pada kesimpulan, tanpa penanda mentah.
      for (const item of items) {
        const markup = renderToStaticMarkup(createElement(Explanation, { text: explanationOf(item) }));
        check((markup.match(/<s style="text-decoration:line-through">/g) ?? []).length === 4 && markup.includes('<b>') && !markup.includes('~~') && !markup.replace(/aria-label="[^"]*"/g, '').includes('**') && !markup.includes('math-error'), 'Layar: Explanation menampilkan empat opsi salah tercoret dan teks tebal tanpa penanda mentah');
        const card = renderToStaticMarkup(createElement(QuestionCard, { question: item, showAnswers: true }));
        check(!card.includes('option-reasons') && card.includes('line-through'), 'Layar: kartu soal tidak mengulang alasan opsi di bawah pembahasan yang sudah memuat analisis opsi');
      }
      check(items.every((item) => reasonLines(item).length === 0 && takeSections(item, ['pembahasan']).flat().every((node) => node.k !== 'text' || !node.small)) && items.every((item) => item.options.every((o) => o.reason.trim())), 'pembahasan dengan analisis opsi tidak mengulang alasan opsi (PDF, Word, salinan); ulasan opsi tetap tersimpan untuk CSV');
      // Silogisme Biasa: format inti berakhir pada jawaban kalimat (blueprint Bagian 8); tanpa analisis opsi dan tanpa daftar alasan opsi di PDF, Word, salinan, dan layar.
      const biasaText = sectionsText(takeSections(biasaItem, ['pembahasan']));
      check(!biasaItem.explanation.includes('Analisis setiap opsi') && !biasaText.includes('Analisis setiap opsi') && !biasaText.includes('~~') && reasonLines(biasaItem).length === 0 && biasaItem.options.every((o) => o.reason === '') &&
        biasaText.trimEnd().split('\n').at(-1)!.startsWith('Jawaban: ') && !renderToStaticMarkup(createElement(QuestionCard, { question: biasaItem, showAnswers: true })).includes('option-reasons'), 'Silogisme Biasa: pembahasan berakhir pada baris Jawaban, tanpa analisis opsi dan tanpa alasan opsi');
      report.coret = { pdfStruck, wordStruck: struckRuns.length };
    }
  } finally { g.Image = saved.Image; g.document = saved.document; }
  return report;
}

// Dijalankan langsung: semua pemeriksaan di atas.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/tiu-format-checks.ts')) {
  let checks = 0;
  const check: Check = (condition, message) => { assert.ok(condition, message); checks++; };
  const result = runTiuFormatChecks(check);
  const silogisme = runSilogismeChecks(check, { stress: 3000 }); // seluruh katalog blueprint dan minimal 3000 seed per chapter
  const qc2 = runTiuQc2Checks(check); // revisi QC akademik #2 (TIU selain silogisme)
  runTiuExportChecks(check).then((exported) => {
    console.log(JSON.stringify({ status: 'PASS', checks, qc2, generated: result.generated, coverage: result.coverage, subtypes: result.subtypes, analitis: result.analitis, silogisme, export: exported }, null, 2));
    if (process.argv.includes('--contoh')) console.log(Object.entries(result.contoh as Record<string, string>).map(([name, text]) => '=== ' + name + '\n' + text).join('\n\n'));
  }).catch((error) => { console.error(error); process.exit(1); });
}
