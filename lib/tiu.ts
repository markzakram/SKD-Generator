import { isolated, type Rng } from './rng';
import type { Difficulty, Question } from './types';
import { calculate, entails, implies, not, variable, type Logic } from './solver';
import { makeFigural } from './figural';
import { DATA_LABELS, type Model } from './models';
import { OPTION_REASON_FAMILIES } from './reasons';
import { COMPARE, costExplanation, equalityExplanation, matrixExplanation, statementsExplanation, dataExplanation, dataOutcome, hitungExplanation, istimewaExplanation, pecahanExplanation, tabelExplanation } from './tiu-explain';
import { DISTRACTOR_SCALE, deretDistractors, deretDuaExplanation, deretSatuExplanation, fibonacciExplanation, selangSelingExplanation, tigaJalurExplanation, type Distractor } from './tiu-deret';
import { buildAnalogi as buildAnalogiVerbal } from './tiu-analogi';
import { LOGIKA_BY_LEVEL, buildLogika, type ContohSlot } from './tiu-logika';
import { ROUTE_PLACES, drawNet, enumerateRoutes, routeParagraph, routeQuestion, ruteExplanation, type RouteNet } from './tiu-rute';
import { kategoriOrangExplanation, kategoriTokoExplanation } from './tiu-analitis';
import { buildPosisi } from './tiu-posisi';
import { buildUrutan } from './tiu-urutan';
import { buildArgumen } from './tiu-argumen';
import { big, bertahapExplanation, diskonExplanation, jkwExplanation, makeWowo, perbandinganExplanation, rasioExplanation, rataBaruExplanation, rataGabunganExplanation, vdwExplanation, wowoExplanation, wowoSolve, type Pair, type WowoKind } from './tiu-story';

type Draft = Omit<Question, 'id' | 'no'>;
type Family = { id: string; topic: string; name: string; levels: Difficulty[] };
export const TIU_FAMILIES: Family[] = [
  { id: 'analogi', topic: 'Verbal', name: 'Analogi dua kata', levels: ['mudah', 'sedang'] },
  { id: 'silogisme', topic: 'Verbal', name: 'Silogisme naratif', levels: ['sedang', 'sulit', 'hots'] },
  { id: 'posisi', topic: 'Verbal', name: 'Susunan dan posisi', levels: ['sedang', 'sulit', 'hots'] },
  { id: 'argumen', topic: 'Verbal', name: 'Memperkuat dan memperlemah argumen', levels: ['hots'] },
  { id: 'peringkat', topic: 'Verbal', name: 'Urutan dan peringkat', levels: ['sedang', 'sulit'] },
  { id: 'jadwal', topic: 'Verbal', name: 'Jadwal', levels: ['sedang', 'sulit'] },
  { id: 'kategori', topic: 'Verbal', name: 'Distribusi dan kategori', levels: ['sedang', 'sulit'] },
  { id: 'rute', topic: 'Verbal', name: 'Rute dan jalur', levels: ['sedang', 'sulit'] },
  { id: 'hitung', topic: 'Numerik', name: 'Berhitung dan pecahan', levels: ['mudah', 'sedang', 'sulit'] },
  { id: 'pecahan', topic: 'Numerik', name: 'Operasi pecahan', levels: ['mudah', 'sedang', 'sulit'] },
  { id: 'setara', topic: 'Numerik', name: 'Perkalian dan pembagian setara', levels: ['sedang', 'sulit'] },
  { id: 'deret', topic: 'Numerik', name: 'Deret satu dan dua jalur', levels: ['mudah', 'sedang', 'sulit'] },
  { id: 'fibonacci', topic: 'Numerik', name: 'Deret penjumlahan dua suku', levels: ['sedang', 'sulit'] },
  { id: 'tiga-jalur', topic: 'Numerik', name: 'Deret tiga jalur', levels: ['sulit', 'hots'] },
  { id: 'selang-seling', topic: 'Numerik', name: 'Deret operasi selang-seling', levels: ['sedang', 'sulit'] },
  { id: 'tabel', topic: 'Numerik', name: 'Pola bilangan tabel', levels: ['sedang', 'sulit'] },
  { id: 'matriks-angka', topic: 'Numerik', name: 'Matriks deret angka', levels: ['sedang', 'sulit'] },
  { id: 'pernyataan-tabel', topic: 'Numerik', name: 'Tabel kombinasi pernyataan', levels: ['sedang', 'sulit'] },
  { id: 'cerita-hitung', topic: 'Numerik', name: 'Soal cerita numerik', levels: ['sedang', 'sulit'] },
  { id: 'cerita', topic: 'Numerik', name: 'Kombinasi optimal', levels: ['sulit', 'hots'] },
  { id: 'data', topic: 'Numerik', name: 'Kecukupan data', levels: ['sedang', 'sulit', 'hots'] },
  { id: 'fig-analogi', topic: 'Figural', name: 'Analogi', levels: ['mudah', 'sedang', 'sulit', 'hots'] },
  { id: 'fig-odd', topic: 'Figural', name: 'Ketidaksamaan', levels: ['mudah', 'sedang', 'sulit'] },
  { id: 'fig-serial', topic: 'Figural', name: 'Serial', levels: ['mudah', 'sedang', 'sulit'] },
  { id: 'fig-matrix', topic: 'Figural', name: 'Matriks 3 × 3', levels: ['mudah', 'sedang', 'sulit', 'hots'] },
].map((family) => ({ ...family, levels: [...new Set(family.levels.map((level) => level === 'hots' ? 'sulit' : level))] as Difficulty[] }))
  .map((family) => ['analogi', 'kategori', 'fibonacci', 'setara', 'selang-seling', 'pernyataan-tabel'].includes(family.id) ? { ...family, levels: (family.id === 'analogi' ? ['mudah'] : ['sedang']) as Difficulty[] } : family)
  .map((family) => family.id === 'pecahan' ? { ...family, levels: ['mudah', 'sedang'] as Difficulty[] } : family);
const format = (value: number) => String(Math.round(value * 10000) / 10000).replace('.', ',');
const base = (family: Family, difficulty: Difficulty): Draft => ({
  subtest: 'TIU', topic: family.topic, subtopic: family.name, difficulty, family: family.id,
  stem: '', options: [], answer: 0, explanation: '', origin: 'pola',
  source: 'Pola latihan berdasarkan Contoh Soal TIU SKD 2027.',
  proof: { kind: 'logic', valid: [true, false, false, false, false] },
  bloom: family.topic === 'Figural' ? 'C4' : 'C3',
  difficultyReason: difficulty === 'mudah' ? 'Satu hubungan atau satu operasi utama.' : difficulty === 'sedang' ? 'Menghubungkan dua informasi atau beberapa operasi berurutan.' : 'Menggabungkan beberapa batasan atau perubahan untuk memilih hasil yang konsisten.',
});
type Mistake = [number, string];
const places = (value: number) => (String(Math.round(value * 10000) / 10000).split('.')[1] ?? '').length;
// `uniform` (berhitung dan pecahan, panduan PDF 63): semua opsi berbentuk sama dengan jawaban, yaitu bilangan bulat semua atau desimal semua
// dengan jumlah angka di belakang koma yang sama ("2,5; 3,0; 3,5"). Pengecoh yang memerlukan lebih banyak desimal daripada jawaban dilewati.
// `story` (soal cerita): pengecoh hanya dari kesalahan konsep yang disebut dan selisih angka soal; bentuk ekspresi yang diutak-atik dan nilai nol atau negatif dilewati.
const numeric = (q: Draft, answer: number, r: Rng, expression?: string, mistakes: Mistake[] = [], uniform = false, story = false): Draft => {
  void r;
  const choices: Mistake[] = [[answer, q.explanation]], digits = places(answer);
  const add = (value: number, reason: string) => {
    const rounded = Math.round(value * 10000) / 10000;
    if (Number.isFinite(rounded) && (!story || rounded > 0 || answer <= 0) && (!uniform || places(rounded) <= digits) && !choices.some(([v]) => Math.abs(v - rounded) < 0.000051)) choices.push([rounded, reason]);
  };
  mistakes.forEach(([value, reason]) => add(value, reason));
  if (expression && !story) {
    const wrong = [
      [expression.replace(/[()]/g, ''), 'Mengabaikan pengelompokan dalam tanda kurung mengubah urutan operasi.'],
      [expression.replace('*', '+'), 'Perkalian terbaca sebagai penjumlahan; hubungan antarbesaran berubah.'],
      [expression.replace('/', '*'), 'Pembagian diganti perkalian; satuan atau perbandingan tidak lagi sesuai.'],
      [expression.replace('-', '+'), 'Pengurangan terbaca sebagai penambahan; arah perubahan keliru.'],
      [expression.replace('+', '-'), 'Penambahan terbaca sebagai pengurangan; jumlah tidak sesuai informasi.'],
    ];
    wrong.forEach(([e, reason]) => { try { add(calculate(e), reason); } catch { /* invalid mistaken expression */ } });
  }
  const terms = expression?.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [answer];
  for (const term of terms) {
    add(answer + term, 'Menambahkan kembali komponen yang sudah masuk dalam hasil menghitungnya dua kali.');
    add(answer - term, 'Mengurangi komponen sekali lagi menghilangkan bagian yang sudah diperhitungkan.');
    add(answer + 2 * term, 'Menerapkan tambahan komponen sebanyak dua kali mengubah jumlah yang diminta.');
    add(answer - 2 * term, 'Menerapkan pengurangan komponen sebanyak dua kali mengubah jumlah yang diminta.');
  }
  if (story) for (const step of [1, -1, 2, -2, 3, 5, 10]) add(answer + step, 'Selisih kecil dari hasil yang benar.');
  if (choices.length < 5) throw new Error('Pengecoh numerik belum cukup; perbaiki model keluarga ' + q.family + '.');
  q.options = choices.slice(0, 5).map(([value, reason], i) => ({ text: uniform ? (Math.round(value * 10000) / 10000).toFixed(digits).replace('.', ',') : format(value), reason, score: i === 0 ? 5 : 0 }));
  q.proof = { kind: 'numeric', values: choices.slice(0, 5).map(([v]) => v), answer: choices[0][0], expression };
  return q;
};
// Soal cerita: opsi ditulis dengan satuan dan pemisah ribuan seperti stem ("Rp60.000", "120 km", "2 pekerja"). Pengecoh hanya dari kesalahan konsep (`mistakes`),
// berupa bilangan positif dalam rentang logis subjenis, berbeda dari kunci dan satu sama lain; tidak ada pengisi aritmetika (±1, ±komponen). Sumber tiap pengecoh
// dicatat di proof.distractors (tidak ditampilkan).
const plain = (value: number) => Number.isInteger(value) ? big(value) : String(Math.round(value * 10000) / 10000).replace('.', ',');
const rupiah = (value: number) => 'Rp' + plain(value);
// Skala pengecoh (QA akhir): selain rentang logis subjenis, tiap pengecoh antara 0,3 dan 3,3 kali kunci (DISTRACTOR_SCALE, sama dengan deret), sehingga kesalahan konsep yang meleset puluhan kali
// (mis. menit × km/jam tanpa konversi) diganti kesalahan konsep lain. Pemeriksa di scripts/tiu-format-checks.ts menghitung ulang rentang yang sama.
const storyNumeric = (q: Draft, answer: number, expression: string, mistakes: Mistake[], render: (value: number) => string, range: [number, number], r: Rng): Draft => {
  const digits = places(answer), picked: Mistake[] = [], low = Math.max(range[0], DISTRACTOR_SCALE[0] * answer), high = Math.min(range[1], DISTRACTOR_SCALE[1] * answer);
  for (const [value, reason] of r.shuffle(mistakes)) {
    const rounded = Math.round(value * 10000) / 10000;
    if (Number.isFinite(rounded) && rounded >= low - 1e-9 && rounded <= high + 1e-9 && places(rounded) <= digits && Math.abs(rounded - answer) > 0.000051 && !picked.some(([v]) => Math.abs(v - rounded) < 0.000051)) picked.push([rounded, reason]);
    if (picked.length === 4) break;
  }
  if (picked.length < 4) throw new Error('Pengecoh soal cerita belum cukup: ' + q.stem);
  const choices: Mistake[] = [[answer, q.explanation], ...picked];
  q.options = choices.map(([value], i) => ({ text: render(value), reason: '', score: i === 0 ? 5 : 0 }));
  q.proof = { kind: 'numeric', values: choices.map(([v]) => v), answer, expression, distractors: picked.map(([value, reason]) => ({ value, source: 'konsep', reason })) };
  return q;
};
// Deret: pengecoh dari kesalahan konsep (lib/tiu-deret.ts); sumber tiap pengecoh dicatat di proof.distractors.
const deretNumeric = (q: Draft, answer: number, r: Rng, expression: string, distractors: Distractor[]): Draft => {
  const out = numeric(q, answer, r, expression, distractors.map((d): Mistake => [d.value, d.reason]));
  if (out.proof.kind === 'numeric') out.proof = { ...out.proof, distractors };
  return out;
};
const logicChoices = (q: Draft, texts: string[], reasons: string[], valid = [true, false, false, false, false]) => {
  q.options = texts.map((text, index) => ({ text, score: valid[index] ? 5 : 0, reason: reasons[index] }));
  q.answer = valid.indexOf(true);
  q.proof = { kind: 'logic', valid };
  return q;
};
const NAMES = ['Alya', 'Bima', 'Citra', 'Damar', 'Elin', 'Fajar', 'Gita', 'Hana', 'Indra', 'Jihan'];

// Alasan per opsi hanya disertakan untuk silogisme dan analogi verbal; keluarga lain (numerik, posisi, data, figural) cukup dengan
// pembahasan, jadi `reason` setiap opsinya dikosongkan. Pembahasan (explanation) tidak berubah.
// Undian aliran bersama yang dipakai pembangkit sebelum direvisi (tahap 4), per "keluarga:tingkat". Pembangkit yang tercantum berjalan pada pengacak turunan
// (isolated) dan hanya memajukan aliran bersama sebanyak ini, sehingga pemilihan butir lain pada seed yang sama tidak bergeser. Pembangkit yang tidak tercantum
// jumlah undiannya tidak berubah dan memakai aliran bersama langsung (figural memakai satu undian sebagai benih). cerita-hitung jumlahnya bervariasi pada versi
// lama, jadi dibekukan pada nilai tetap.
const SHARED_DRAWS: Record<string, number> = {
  'analogi:mudah': 1, 'silogisme:sedang': 3, 'silogisme:sulit': 3, 'posisi:sedang': 21, 'posisi:sulit': 26, 'argumen:sulit': 2, 'peringkat:sedang': 21, 'peringkat:sulit': 26, 'jadwal:sedang': 21, 'jadwal:sulit': 26, 'kategori:sedang': 13, 'rute:sedang': 13, 'rute:sulit': 17,
  'pecahan:sedang': 4, 'deret:mudah': 2, 'deret:sedang': 5, 'deret:sulit': 5, 'fibonacci:sedang': 4, 'tiga-jalur:sulit': 6, 'selang-seling:sedang': 3, 'cerita-hitung:sedang': 4, 'cerita-hitung:sulit': 3,
};
// `slot`: hanya untuk silogisme narasi (contoh blueprint dipakai lebih dahulu, lib/tiu-logika.ts buildLogika); keluarga lain mengabaikannya.
export function makeTiu(family: Family, difficulty: Difficulty, r: Rng, slot?: ContohSlot): Draft {
  const draws = SHARED_DRAWS[family.id + ':' + difficulty];
  const draft = buildTiu(family, difficulty, draws === undefined ? r : isolated(r, 'tiu|' + family.id + '|' + difficulty, draws), slot);
  return OPTION_REASON_FAMILIES.includes(family.id) ? draft : { ...draft, options: draft.options.map((option) => ({ ...option, reason: '' })) };
}
function buildTiu(family: Family, difficulty: Difficulty, r: Rng, slot?: ContohSlot): Draft {
  let q = base(family, difficulty);
  if (family.id === 'hitung') {
    const a = r.int(5, 45), b = r.int(2, 12), c = r.int(2, 9), d = r.int(1, 9);
    const expression = difficulty === 'mudah' ? a + '+' + b + '*' + c :
      difficulty === 'sedang' ? a + '+' + b + '/' + 2 + '-' + d :
        '(' + a + '+' + b + ')*' + c + '/2-' + d;
    const answer = calculate(expression);
    q.stem = 'Hasil dari ' + expression.replaceAll('*', ' × ').replaceAll('/', ' ÷ ').replaceAll('+', ' + ').replaceAll('-', ' − ') + ' adalah ...';
    q.explanation = hitungExplanation(expression);
    const errors: Mistake[] = difficulty === 'mudah' ? [[(a + b) * c, 'Menjumlahkan dahulu mengabaikan prioritas perkalian.'], [a * b + c, 'Menukar posisi operator mengubah ekspresi.'], [b * c, 'Suku awal belum ditambahkan.'], [a + b + c, 'Perkalian terbaca sebagai penjumlahan.']] : difficulty === 'sedang' ? [[(a + b) / 2 - d, 'Penjumlahan dikerjakan sebelum pembagian.'], [a + b / 2 + d, 'Pengurangan suku terakhir berubah menjadi penambahan.'], [a + b - d, 'Pembagian dua diabaikan.'], [(a + b - d) / 2, 'Seluruh jumlah dibagi dua, padahal hanya suku tengah.']] : [[a + b * c / 2 - d, 'Kurung diabaikan sehingga hanya b yang dikalikan.'], [(a + b) * c - d, 'Pembagian dua diabaikan.'], [(a + b) * c / 2 + d, 'Tanda suku terakhir keliru.'], [(a + b) * c / (2 - d), 'Pengurangan d dimasukkan ke penyebut.']];
    return numeric(q, answer, r, expression, errors, true);
  }
  if (family.id === 'setara') {
    const a = r.int(12, 70), b = r.int(3, 12);
    const division = r.next() < 0.5;
    const texts: string[] = [], reasons: string[] = [];
    for (let i = 0; i < 5; i++) {
      const left = a + i * 2, divisor = b + i;
      const value = left * divisor;
      const right = i === 0 ? value : value + r.int(1, 8);
      // Pasangan yang belum terbukti sama ditulis "dibandingkan dengan", bukan "=" (QC akademik #2, soal 43–44).
      texts.push(division ? value + ' ÷ ' + divisor + COMPARE + (right * 2) + ' ÷ ' + (divisor * 2) :
        left + ' × ' + divisor + COMPARE + right + ' × 1');
      reasons.push(division ? 'Ruas kiri = ' + format(value / divisor) + '; ruas kanan = ' + format(right / divisor) + '.' :
        'Ruas kiri = ' + value + '; ruas kanan = ' + right + '.');
    }
    q.stem = 'Manakah pasangan ' + (division ? 'pembagian' : 'perkalian') + ' yang menghasilkan nilai sama?';
    q.explanation = equalityExplanation(texts);
    q = logicChoices(q, texts, reasons); q.proof = { kind: 'model', model: { kind: 'equality' } }; return q;
  }
  if (family.id === 'deret' || family.id === 'fibonacci') {
    const start = r.int(2, 20), step = r.int(2, 9);
    let values: number[], answer: number, expression: string;
    if (family.id === 'fibonacci') {
      values = [r.int(1, 8), r.int(2, 12)];
      for (let i = 2; i < 7; i++) values.push(values[i - 1] + values[i - 2]);
      answer = values[5] + values[6]; expression = values[5] + '+' + values[6];
      q.explanation = fibonacciExplanation(values, answer);
      q.stem = 'Tentukan bilangan berikutnya berdasarkan pola deret: ' + values.join(', ') + ', ...';
      return deretNumeric(q, answer, r, expression, deretDistractors('fibonacci', values, answer, {}, r));
    } else if (difficulty === 'mudah') {
      values = Array.from({ length: 6 }, (_, i) => start + step * i);
      answer = start + step * 6; expression = start + '+' + step + '*6';
      q.explanation = deretSatuExplanation(values, step, answer);
      q.stem = 'Tentukan bilangan berikutnya berdasarkan pola deret: ' + values.join(', ') + ', ...';
      return deretNumeric(q, answer, r, expression, deretDistractors('satu', values, answer, { lanes: [{ op: '+', n: step }] }, r));
    } else {
      // Larik genap dibuat di atas suku ke-3 supaya tiga panah pertama ↑ ↓ ↑ (2 towew) seperti contoh panduan.
      const otherStep = r.int(2, 8), factor = r.int(2, 3), other = difficulty === 'sulit' ? Math.max(r.int(30, 60), start * factor + r.int(3, 8)) : r.int(30, 60);
      values = Array.from({ length: 8 }, (_, i) => i % 2 ? other + Math.floor(i / 2) * otherStep : difficulty === 'sulit' ? start * factor ** Math.floor(i / 2) : start + Math.floor(i / 2) * step);
      answer = difficulty === 'sulit' ? start * factor ** 4 : start + 4 * step;
      expression = difficulty === 'sulit' ? start + '*' + [factor, factor, factor, factor].join('*') : start + '+4*' + step;
      const odd = difficulty === 'sulit' ? { op: '×' as const, n: factor } : { op: '+' as const, n: step }, even = { op: '+' as const, n: otherStep };
      q.explanation = deretDuaExplanation(values, odd, even, answer);
      q.stem = 'Tentukan bilangan berikutnya berdasarkan pola deret: ' + values.join(', ') + ', ...';
      return deretNumeric(q, answer, r, expression, deretDistractors('dua', values, answer, { lanes: [odd, even] }, r));
    }
  }
  if (family.id === 'tabel') {
    const slope = r.int(2, 8), offset = r.int(1, 12), target = r.int(8, 18);
    const power = difficulty === 'sedang' ? 1 : 2;
    q.table = { headers: ['Urutan n', 'Nilai'], rows: [1, 2, 4, target, target + 5].map((n) => [String(n), n === target ? '?' : String(slope * n ** power + offset)]) };
    q.stem = 'Nilai dalam tabel mengikuti hubungan ' + (power === 1 ? 'linear y = a × n + b' : 'kuadratik y = a × n² + b') + ' dengan a dan b konstan. Berapakah nilai pada urutan ke-' + target + '?';
    const answer = slope * target ** power + offset;
    q.explanation = tabelExplanation(slope, offset, power, [1, 2, 4, target + 5], target);
    return numeric(q, answer, r, slope + '*' + target + (power === 2 ? '*' + target : '') + '+' + offset, [[slope * target + offset, 'Menggunakan n, padahal pola sulit memakai n².'], [slope * target ** power, 'Konstanta b tidak ditambahkan.'], [target ** power + offset, 'Koefisien a tidak diterapkan.'], [slope * (target + offset) ** power, 'Konstanta dimasukkan ke dalam operasi pada n.']]);
  }
  if (family.id === 'cerita') {
    const target = r.int(4, 10) * 20, capA = 20, capB = 40, capC = 60;
    const priceA = r.int(7, 10) * 100000, priceB = priceA + r.int(3, 5) * 100000, priceC = priceB + r.int(3, 5) * 100000;
    const possibilities: { a: number; b: number; c: number; seats: number; price: number }[] = [];
    for (let a = 0; a <= 12; a++) for (let b = 0; b <= 6; b++) for (let c = 0; c <= 4; c++) {
      const seats = a * capA + b * capB + c * capC;
      if (seats >= target && seats <= target + 20) possibilities.push({ a, b, c, seats, price: a * priceA + b * priceB + c * priceC });
    }
    possibilities.sort((a, b) => a.price - b.price || a.seats - b.seats);
    const best = possibilities[0];
    const rest = r.shuffle(possibilities.filter((item) => item.price > best.price)).slice(0, 4);
    if (rest.length !== 4) throw new Error('Kombinasi bus tidak cukup.');
    q.table = { headers: ['Bus', 'Kapasitas', 'Biaya'], rows: [['A', '20', rupiah(priceA)], ['B', '40', rupiah(priceB)], ['C', '60', rupiah(priceC)]] };
    q.stem = 'Sebanyak ' + target + ' peserta harus memperoleh tempat duduk. Bus dapat dipilih lebih dari satu dan kursi kosong paling banyak 20. Di antara pilihan berikut, kombinasi manakah yang paling murah?';
    q.explanation = costExplanation(target, [priceA, priceB, priceC], [best, ...rest]);
    q = logicChoices(q, [best, ...rest].map((item) => item.a + ' bus A, ' + item.b + ' bus B, ' + item.c + ' bus C'),
      [best, ...rest].map((item) => 'Kapasitas ' + item.seats + ', kursi kosong ' + (item.seats - target) + ', biaya ' + rupiah(item.price) + '.'));
    q.proof = { kind: 'model', model: { kind: 'cost', capacities: [20, 40, 60], prices: [priceA, priceB, priceC], target, spare: 20 } };
    return q;
  }
  if (family.id === 'data') {
    const x = r.int(3, 10), y = r.int(2, 9);
    const model: Extract<Model, { kind: 'data' }> = { kind: 'data', domain: 20, target: difficulty === 'sedang' ? 'x' : r.pick(['x', 'sum', 'product']), first: [], second: [] };
    const pattern = r.int(0, 4);
    model.first = pattern === 0 ? [{ op: 'x', value: x }] : pattern === 3 ? [{ op: 'sum', value: x + y }] : [{ op: 'product', value: x * y }];
    // Pola 3 (jumlah) dahulu mengulang pernyataan (1) apa adanya pada (2); kini (2) memberi selisih sehingga kedua pernyataan berbeda fungsi.
    model.second = pattern === 1 ? [{ op: 'x', value: x }] : pattern === 4 ? [{ op: 'xGt', value: 1 }] : [{ op: 'difference', value: x - y }];
    const describe = (c: typeof model.first[number]) => (c.op === 'xGt' ? 'x > ' : c.op === 'x' ? 'x = ' : c.op === 'sum' ? 'x + y = ' : c.op === 'difference' ? 'x − y = ' : 'xy = ') + c.value;
    q.stem = 'x dan y adalah bilangan bulat positif paling besar 20. Tentukan ' + (model.target === 'x' ? 'nilai x' : model.target === 'sum' ? 'nilai x + y' : 'nilai xy') + '.\n(1) ' + model.first.map(describe).join('; ') + '.\n(2) ' + model.second.map(describe).join('; ') + '.\nKategori kecukupan data yang tepat adalah ...';
    // Kategori ditentukan dari pengujian tiap pernyataan, lalu dipetakan ke opsi lewat bunyinya (bukan huruf atau urutan).
    const answer = DATA_LABELS.indexOf(dataOutcome(model).label);
    q.explanation = dataExplanation(model);
    q = logicChoices(q, DATA_LABELS, DATA_LABELS.map(() => ''), DATA_LABELS.map((_, i) => i === answer));
    q.bloom = 'C4'; q.proof = { kind: 'model', model }; return q;
  }
  if (family.id === 'analogi') {
    // Verbal analogi dua kata (lib/tiu-analogi.ts): kunci = pasangan kata dengan jenis dan arah hubungan yang sama; ulasan tiap opsi menyebut sepadan atau tidak.
    const built = buildAnalogiVerbal(r);
    q.stem = built.stem; q.explanation = built.explanation; q.bloom = 'C2'; q.answer = built.answer;
    q.options = built.options.map((option, i) => ({ text: option.text, score: i === built.answer ? 5 : 0, reason: option.reason }));
    q.proof = { kind: 'model', model: { kind: 'analogy', target: built.target, options: built.options.map((option) => ({ text: option.text, rel: option.rel, reversed: option.reversed })) } };
    return q;
  }
  if (family.id === 'silogisme') {
    // Blueprint Silogisme Tanpa Logika Kuantor (lib/tiu-logika.ts): 2 Premis, 3 Premis, dan kedua chapter Narasi, ditambah bentuk implikasi; kunci, pengecoh, dan status opsi dihitung oleh tabel kebenaran.
    const built = buildLogika(r.pick(LOGIKA_BY_LEVEL[difficulty === 'sedang' ? 'sedang' : 'sulit']), r, slot);
    q.stem = built.stem; q.explanation = built.explanation; q.bloom = built.bloom; q.answer = built.answer;
    if (built.source) q.source = built.source; // contoh blueprint menyebut asalnya
    q.options = built.options.map((option, i) => ({ text: option.text, score: i === built.answer ? 5 : 0, reason: option.reason, ...(option.ref !== undefined ? { ref: option.ref } : {}) }));
    q.proof = { kind: 'model', model: built.model };
    return q;
  }
  if (family.id === 'posisi') {
    // Susunan dan posisi menurut Panduan Produksi Soal TIU JadiASN (lib/tiu-posisi.ts): linear, duduk melingkar, atau baris-kolom; petunjuk berupa paragraf, jawaban tunggal
    // dibuktikan oleh pemecah brute force, kesulitan dan level Bloom diturunkan dari kebutuhan penalaran.
    const built = buildPosisi(difficulty === 'sulit' || difficulty === 'hots' ? 'sulit' : 'sedang', r);
    q.stem = built.stem; q.explanation = built.explanation; q.bloom = built.bloom; q.difficulty = built.difficulty; q.difficultyReason = built.difficultyReason;
    q.source = 'Pola latihan berdasarkan Panduan Produksi Soal TIU JadiASN (Susunan dan Posisi).';
    q.options = built.options.map((option, i) => ({ text: option.text, score: i === built.answer ? 5 : 0, reason: '' })); q.answer = built.answer;
    q.proof = { kind: 'model', model: { kind: 'arrangement', geo: built.geo, names: built.names, ...(built.anchor ? { anchor: built.anchor } : {}), clues: built.clues, options: built.options } };
    return q;
  }
  if (['peringkat', 'jadwal'].includes(family.id)) {
    // Urutan dan Peringkat serta Jadwal menurut Panduan Produksi Soal TIU JadiASN (lib/tiu-urutan.ts): mesin yang sama dengan Susunan dan Posisi (petunjuk dari fakta benar, jawaban tunggal
    // dibuktikan pemecah brute force, pembahasan mengalir dari penalaran langkah demi langkah), tema lomba/nilai/kedatangan/tinggi badan atau jadwal harian.
    const kind = family.id as 'peringkat' | 'jadwal', built = buildUrutan(kind, difficulty === 'sulit' || difficulty === 'hots' ? 'sulit' : 'sedang', r);
    q.stem = built.stem; q.explanation = built.explanation; q.bloom = built.bloom; q.difficulty = built.difficulty; q.difficultyReason = built.difficultyReason;
    q.source = 'Pola latihan berdasarkan Panduan Produksi Soal TIU JadiASN (' + (kind === 'peringkat' ? 'Urutan dan Peringkat' : 'Jadwal') + ').';
    q.options = built.options.map((option, i) => ({ text: option.text, score: i === built.answer ? 5 : 0, reason: '' })); q.answer = built.answer;
    q.proof = { kind: 'model', model: { kind: 'arrangement', geo: built.geo, names: built.names, clues: built.clues, options: built.options } };
    return q;
  }
  if (family.id === 'argumen') {
    // Memperkuat/memperlemah argumen menurut pola sembilan contoh diterima (lib/tiu-argumen.ts): skenario tulisan tangan, satu kunci, empat pengecoh beralasan.
    const built = buildArgumen('sulit', r);
    q.stem = built.stem; q.explanation = built.explanation; q.bloom = built.bloom; q.difficulty = built.difficulty; q.difficultyReason = built.difficultyReason;
    q.source = 'Pola latihan berdasarkan contoh diterima Memperkuat/Memperlemah Argumen (Andika, Verbal Analitis).';
    q.options = built.options.map((option, i) => ({ text: option.text, score: i === built.answer ? 5 : 0, reason: '' })); q.answer = built.answer;
    q.proof = { kind: 'model', model: { kind: 'argument', direction: built.direction, scenario: built.scenario, options: built.options } };
    return q;
  }
  if (family.id === 'kategori') {
    if (r.next() < 0.5) {
      // Bentuk orang-kegiatan (panduan PDF 52–53): informasi bernomor, langkah per informasi, tabel hasil.
      const names = r.shuffle(NAMES).slice(0, 3), activities = r.shuffle(['basket', 'teater', 'fotografi', 'musik', 'robotika']).slice(0, 2);
      q.stem = names.join(', ') + ' mengikuti kegiatan sekolah. Terdapat beberapa informasi sebagai berikut:\n1. Tepat dua dari mereka mengikuti ' + activities[0] + '.\n2. ' +
        names[0] + ' mengikuti ' + activities[0] + ', sedangkan ' + names[2] + ' tidak mengikutinya.\n3. Hanya ' + names[2] +
        ' yang mengikuti ' + activities[1] + '.\nKesimpulan yang pasti benar adalah ...';
      const texts = [
        names[1] + ' mengikuti ' + activities[0] + ' dan tidak mengikuti ' + activities[1] + '.',
        names[0] + ' mengikuti kedua kegiatan.', names[1] + ' mengikuti kedua kegiatan.',
        names[2] + ' mengikuti kedua kegiatan.', 'Tidak ada peserta yang mengikuti ' + activities[0] + '.',
      ];
      q.explanation = kategoriOrangExplanation(names, activities[0], activities[1], texts[0]);
      q = logicChoices(q, texts, texts.map(() => ''));
      q.bloom = 'C5'; // mengevaluasi beberapa pernyataan terhadap pembagian yang pasti (panduan: Distribusi dan Kategori C4-C6)
      q.proof = { kind: 'model', model: { kind: 'category', names, total: 2, yes: [names[0]], no: [names[2]], second: [names[2]], claims: [
        { text: texts[0], person: names[1], first: true, second: false }, { text: texts[1], person: names[0], first: true, second: true },
        { text: texts[2], person: names[1], first: true, second: true }, { text: texts[3], person: names[2], first: true, second: true },
      ] } }; return q;
    }
    // Bentuk objek-tempat (PDF 54): matriks ✓ / x / ? dari informasi bernomor; toko yang punya tanda x gugur, tepat satu toko tersisa.
    const items = r.shuffle(['mawar', 'lili', 'anggrek', 'tulip', 'dahlia', 'melati', 'krisan']).slice(0, r.int(4, 5)), buyer = r.pick(NAMES);
    const stores = ['Toko A', 'Toko B', 'Toko C', 'Toko D', 'Toko E'], key = r.int(0, 4), others = stores.map((_, i) => i).filter((i) => i !== key);
    const tokoList = (list: number[]) => 'Toko ' + (list.length > 2 ? list.slice(0, -1).map((i) => 'ABCDE'[i]).join(', ') + ', dan ' + 'ABCDE'[list[list.length - 1]] : list.map((i) => 'ABCDE'[i]).join(' dan '));
    const carriers = r.shuffle(items.map((_, i) => i)), carrying = r.int(2, 3), groups: number[][] = Array.from({ length: carrying }, () => []);
    r.shuffle(others).forEach((store, i) => groups[i % carrying].push(store));
    const matrix: ('✓' | 'x' | '?')[][] = items.map(() => stores.map(() => '?' as const)), absent: number[][] = items.map(() => []), facts: string[] = [];
    carriers.forEach((item, at) => {
      const flower = 'bunga ' + items[item];
      if (at < carrying) {
        const group = groups[at].sort((a, b) => a - b);
        group.forEach((store) => { matrix[item][store] = 'x'; absent[item].push(store); });
        if (group.length === 1 && r.next() < 0.5) { stores.forEach((_, store) => { if (store !== group[0]) matrix[item][store] = '✓'; }); facts[item] = 'Hanya ' + stores[group[0]] + ' yang tidak menjual ' + flower + '.'; }
        else if (group.length === 1) facts[item] = stores[group[0]] + ' tidak menjual ' + flower + '.';
        else if (group.length === 2 && r.next() < 0.5) facts[item] = stores[group[0]] + ' dan ' + stores[group[1]] + ' tidak menjual ' + flower + '.';
        else facts[item] = flower[0].toUpperCase() + flower.slice(1) + ' tidak dapat ditemukan di ' + tokoList(group) + '.';
      } else if (r.next() < 0.5) { stores.forEach((_, store) => { matrix[item][store] = '✓'; }); facts[item] = 'Semua toko menjual ' + flower + '.'; }
      else {
        // "Hanya tersedia di ...": toko lain pasti tidak menjual, sehingga tafsir eksklusif dan inklusif sama. Toko kunci selalu termasuk agar tetap tersisa.
        const shown = [key, ...r.shuffle(others).slice(0, r.int(2, 3))].sort((a, b) => a - b);
        stores.forEach((_, store) => { if (shown.includes(store)) matrix[item][store] = '✓'; else { matrix[item][store] = 'x'; absent[item].push(store); } });
        facts[item] = flower[0].toUpperCase() + flower.slice(1) + ' hanya tersedia di ' + tokoList(shown) + '.';
      }
    });
    const infoOrder = r.shuffle(items.map((_, i) => i));
    const list = items.length > 2 ? items.slice(0, -1).join(', ') + ', dan ' + items[items.length - 1] : items.join(' dan ');
    q.stem = buyer + ' membutuhkan beberapa jenis bunga. Terdapat lima toko bunga di kota tersebut, yaitu ' + stores.slice(0, -1).join(', ') + ', dan ' + stores[4] + '. Terdapat beberapa informasi sebagai berikut:\n' +
      infoOrder.map((item, i) => (i + 1) + '. ' + facts[item]).join('\n') + '\nToko apa yang akan dikunjungi ' + buyer + ' jika ' + buyer + ' membutuhkan ' + list + '?';
    q.explanation = kategoriTokoExplanation({ stores, items, matrix, key, buyer, infoCount: items.length });
    q = logicChoices(q, stores, stores.map(() => ''), stores.map((_, i) => i === key));
    q.bloom = 'C4'; // menganalisis aturan kategori yang saling membatasi (contoh panduan: Distribusi Objek/Tempat-Kategori, C4)
    q.proof = { kind: 'model', model: { kind: 'availability', stores, items, absent } }; return q;
  }
  if (family.id === 'rute') {
    // Undian yang tidak menyisakan empat pengecoh logis diulang dengan jaringan berikutnya.
    for (let attempt = 0; ; attempt++) try {
    // Jaringan berlapis dengan kemungkinan sisi dua arah; rute sederhana dihitung dengan penelusuran (lib/tiu-rute.ts) dan didaftar di pembahasan beserta grafnya.
    const net = drawNet(difficulty === 'sedang' ? 'sedang' : 'sulit', r), routes = enumerateRoutes(net), answer = routes.length, last = net.nodes.length - 1;
    // Cerita seperti contoh panduan: sisi ditulis sebagai kalimat ("Dari gerai A dapat pergi ke gerai B dan C."), bukan tabel.
    const place = r.pick(ROUTE_PLACES);
    q.stem = routeParagraph(net, place) + '\n' + routeQuestion(place);
    q.bloom = 'C4'; // menganalisis hubungan antartitik dan menghitung rute (panduan: Rute dan Jalur C4-C5, tidak dinaikkan hanya karena jaringan lebih besar)
    q.explanation = ruteExplanation(net, routes);
    // Rute bila sisi dua arah hanya dipakai searah (a < b): kesalahan membaca "saling terhubung".
    const oneDirection: RouteNet = { nodes: net.nodes, edges: net.edges.filter(([a, b]) => !net.edges.some(([x, y]) => x === b && y === a) || a < b) };
    const mistakes: Mistake[] = [
      [net.edges.length, 'Menghitung ruas jalan, bukan rute lengkap dari awal sampai tujuan.'],
      [net.edges.filter(([from]) => from === 0).length, 'Menghitung cabang awal saja mengabaikan percabangan setelahnya.'],
      [net.nodes.length - 1, 'Menghitung ruas pada satu jalur berantai saja mengabaikan rute alternatif.'],
      [enumerateRoutes(oneDirection).length, 'Sisi dua arah ("saling terhubung") dianggap hanya satu arah.'],
      [net.edges.filter(([, to]) => to === last).length, 'Menghitung jalan yang langsung menuju simpul tujuan saja.'],
      [Math.max(...routes.map((route) => route.length)), 'Menghitung banyak simpul pada rute terpanjang, bukan banyak rute.'],
      [answer - 1, 'Satu rute terlewat saat mendaftar.'], [answer + 1, 'Satu rute dihitung dua kali.'],
    ];
    const built = storyNumeric(q, answer, String(answer), mistakes, (value) => plain(value) + ' rute', [1, 4 * answer + 4], r);
    const distractors = built.proof.kind === 'numeric' ? built.proof.distractors : undefined;
    built.proof = { kind: 'model', model: { kind: 'route', nodes: net.nodes, edges: net.edges.map(([from, to]) => [net.nodes[from], net.nodes[to]]), distractors } };
    return built;
    } catch (error) { if (attempt >= 40 || !(error as Error).message.startsWith('Pengecoh soal cerita belum cukup')) throw error; }
  }
  if (family.id === 'pecahan') {
    const a = r.int(1, 9), b = r.int(1, 4), c = r.int(1, 5), whole = difficulty === 'mudah' ? 0 : r.int(2, 12);
    // Tingkat sedang kadang memakai desimal istimewa (panduan PDF 61): tabel pecahan istimewa dicantumkan sebelum langkah penyelesaian.
    if (difficulty !== 'mudah' && r.next() < 0.4) {
      const [decimal, factor] = r.pick([[[3, 4], [1, 2]], [[1, 4], [1, 2]], [[1, 2], [3, 4]], [[1, 2], [1, 4]]]);
      const shown = decimal[0] / decimal[1], times = factor[0] / factor[1];
      const expression = whole + '+' + shown + '*' + factor[0] + '/' + factor[1], answer = calculate(expression);
      q.stem = 'Hasil dari ' + whole + ' + ' + format(shown) + ' × ' + factor[0] + '/' + factor[1] + ' adalah ...';
      q.explanation = istimewaExplanation(whole, { p: decimal[0], q: decimal[1] }, { p: factor[0], q: factor[1] });
      return numeric(q, answer, r, expression, [
        [whole + shown, 'Faktor pecahan belum dikalikan.'], [(whole + shown) * times, 'Penjumlahan dikerjakan sebelum perkalian.'],
        [whole + shown / times, 'Perkalian terbaca sebagai pembagian.'], [whole + shown + times, 'Perkalian terbaca sebagai penjumlahan.'],
      ], true);
    }
    const expression = whole + '+' + a + '/10+' + b + '/5-' + c + '/10';
    const answer = calculate(expression);
    q.stem = 'Hasil dari ' + (whole ? whole + ' + ' : '') + a + '/10 + ' + b + '/5 − ' + c + '/10 adalah ...';
    q.explanation = pecahanExplanation(whole, a, b, c, 10);
    return numeric(q, answer, r, expression, [], true);
  }
  if (family.id === 'tiga-jalur') {
    const starts = [r.int(1, 15), r.int(20, 40), r.int(45, 65)], steps = [r.int(2, 6), r.int(3, 7), r.int(2, 8)];
    const values = Array.from({ length: 9 }, (_, i) => starts[i % 3] + Math.floor(i / 3) * steps[i % 3]);
    q.stem = 'Tentukan bilangan yang melanjutkan pola deret tiga jalur: ' + values.join(', ') + ', ...';
    const answer = starts[0] + 3 * steps[0];
    q.explanation = tigaJalurExplanation(values, steps, answer);
    return deretNumeric(q, answer, r, starts[0] + '+3*' + steps[0], deretDistractors('tiga', values, answer, { lanes: steps.map((n) => ({ op: '+' as const, n })) }, r));
  }
  if (family.id === 'selang-seling') {
    const add = r.int(3, 9), subtract = r.int(1, add - 1), values = [r.int(15, 40)];
    for (let i = 1; i < 7; i++) values.push(values[i - 1] + (i % 2 ? add : -subtract));
    const answer = values[6] + add;
    q.stem = 'Tentukan bilangan berikutnya pada deret: ' + values.join(', ') + ', ...';
    q.explanation = selangSelingExplanation(values, add, subtract, answer);
    return deretNumeric(q, answer, r, values[6] + '+' + add, deretDistractors('campuran', values, answer, { add, subtract }, r));
  }
  if (family.id === 'matriks-angka') {
    const top = Array.from({ length: 3 }, () => r.int(2, 12)), bottom = Array.from({ length: 3 }, () => r.int(2, 15));
    const factor = difficulty === 'sedang' ? 2 : r.int(3, 6);
    const middle = top.map((value, i) => factor * value + bottom[i]);
    q.table = { headers: [], rows: [top.map(String), middle.map(String), [String(bottom[0]), String(bottom[1]), '?']] };
    q.stem = 'Pada setiap kolom, bilangan tengah = a × bilangan atas + bilangan bawah, dengan a bilangan bulat positif yang sama.' + (difficulty === 'sedang' ? ' Diketahui a = ' + factor + '.' : ' Tentukan a dari dua kolom yang lengkap.') + ' Nilai yang menggantikan tanda tanya adalah ...';
    q.explanation = matrixExplanation(top, middle, bottom, factor);
    return numeric(q, bottom[2], r, middle[2] + '-' + factor + '*' + top[2]);
  }
  if (family.id === 'pernyataan-tabel') {
    const products = ['Pulpen', 'Buku', 'Pensil'], prices = [r.int(3, 7) * 1000, r.int(8, 15) * 1000, r.int(2, 5) * 1000];
    const trueStatements = r.shuffle([1, 2, 3, 4]).slice(0, 2).sort();
    const statements: string[] = [], reasons: string[] = [], allAmounts: number[][] = [], allOffered: number[] = [];
    for (let i = 0; i < 4; i++) {
      const amounts = products.map(() => r.int(1, 4)), total = amounts.reduce((sum, n, j) => sum + n * prices[j], 0);
      const offered = trueStatements.includes(i + 1) ? total : total + r.int(1, 3) * 1000;
      allAmounts.push(amounts); allOffered.push(offered);
      statements.push('(' + (i + 1) + ') ' + amounts.map((n, j) => n + ' ' + products[j].toLowerCase()).join(', ') + ' berharga ' + rupiah(offered) + '.');
      reasons.push('Pernyataan ' + (i + 1) + ': harga sebenarnya ' + rupiah(total) + ', sehingga ' + (total === offered ? 'benar' : 'salah') + '.');
    }
    const correct = trueStatements.join(' dan ');
    const combinations = ['1 dan 2', '1 dan 3', '1 dan 4', '2 dan 3', '2 dan 4', '3 dan 4'].filter((text) => text !== correct);
    q.table = { headers: ['Barang', 'Harga satuan'], rows: products.map((product, i) => [product, rupiah(prices[i])]) };
    q.stem = statements.join('\n') + '\nKombinasi dua pernyataan yang benar adalah ...';
    // Kombinasi opsi diundi sebelum pembahasan disusun (urutan undian sama seperti sebelumnya); pembahasan mengeliminasi setiap opsi lewat Option.ref.
    const offeredCombos = [correct, ...r.shuffle(combinations).slice(0, 4)];
    q.explanation = statementsExplanation(prices, allAmounts, allOffered, offeredCombos);
    q = logicChoices(q, offeredCombos, [q.explanation, ...Array(4).fill('Setidaknya satu pernyataan dalam kombinasi ini salah menurut perhitungan harga.')]);
    q.options = q.options.map((option, ref) => ({ ...option, ref }));
    q.proof = { kind: 'model', model: { kind: 'statements', prices, amounts: allAmounts, offered: allOffered } }; return q;
  }
  if (family.id === 'cerita-hitung') {
    // Pembahasan mengikuti subjenis di panduan (lib/tiu-story.ts). Opsi memakai satuan dan pemisah ribuan seperti stem; pengecoh hanya dari kesalahan konsep
    // yang berada dalam rentang logis subjenis (storyNumeric), tanpa pengisi aritmetika.
    // Undian yang tidak menyisakan empat pengecoh logis (kebetulan angka) diulang dengan undian berikutnya.
    const story = (): Draft => {
      let expression: string, mistakes: Mistake[], render: (value: number) => string = plain, range: [number, number];
      if (difficulty === 'sulit') {
        const variant = r.int(0, 2), a = r.int(3, 9), b = r.int(2, 5);
        if (variant === 0) {
          const price = a * 50000, discount = b * 5, tax = 10;
          expression = price + '*(100-' + discount + ')/100*(100+' + tax + ')/100';
          q.stem = 'Barang berharga ' + rupiah(price) + ' mendapat diskon ' + discount + '%. Setelah diskon, pajak 10% dikenakan atas harga yang sudah didiskon. Berapa total yang dibayar?';
          q.explanation = bertahapExplanation(price, discount, tax);
          mistakes = [[price * (100 - discount + tax) / 100, 'Diskon dan pajak digabung pada harga awal, padahal dasar pajak berubah.'], [price * (100 - discount) / 100, 'Pajak setelah diskon belum dimasukkan.'], [price * 1.1, 'Diskon belum diterapkan.'],
            [price * (100 - discount) / 100 - price * .1, 'Pajak dikurangi dan memakai dasar harga awal.'], [price * (100 - discount) / 100 + price * .1, 'Pajak dihitung dari harga awal, bukan harga setelah diskon.']];
          render = rupiah; range = [1, price * 1.5];
        } else if (variant === 1) {
          // Dua kelompok dengan rata-rata gabungan bulat (rata-rata kelompok tidak boleh langsung dirata-ratakan). Selisih rata-rata kelipatan 10 supaya rata-rata sederhana juga bulat.
          let sizeA = 8, sizeB = 12, meanA = 70, meanB = 80;
          for (let attempt = 0; attempt < 200; attempt++) {
            const na = r.int(4, 16), nb = r.int(4, 16), ma = r.int(10, 14) * 5, gap = r.int(1, 3) * 10;
            if (na !== nb && (nb * gap) % (na + nb) === 0) { sizeA = na; sizeB = nb; meanA = ma; meanB = ma + gap; break; }
          }
          expression = '(' + sizeA + '*' + meanA + '+' + sizeB + '*' + meanB + ')/(' + sizeA + '+' + sizeB + ')';
          q.stem = 'Kelompok A terdiri atas ' + sizeA + ' peserta dengan rata-rata nilai ' + meanA + '. Kelompok B terdiri atas ' + sizeB + ' peserta dengan rata-rata nilai ' + meanB + '. Rata-rata gabungan nilai kedua kelompok tersebut adalah ...';
          q.explanation = rataGabunganExplanation(sizeA, meanA, sizeB, meanB);
          // Rata-rata gabungan selalu di antara kedua rata-rata kelompok; pengecoh pun hanya dari kesalahan bobot di rentang itu.
          mistakes = [[(meanA + meanB) / 2, 'Rata-rata kelompok diberi bobot sama meskipun banyak peserta berbeda.'], [(sizeA * meanB + sizeB * meanA) / (sizeA + sizeB), 'Bobot banyak peserta tertukar antara kedua kelompok.'],
            [sizeA > sizeB ? meanA : meanB, 'Rata-rata kelompok yang pesertanya lebih banyak dianggap hasil gabungan.'], [sizeA > sizeB ? meanB : meanA, 'Rata-rata kelompok yang pesertanya lebih sedikit dianggap hasil gabungan.']];
          range = [meanA, meanB];
        } else {
          const wowo = makeWowo(r.int(0, 4), r);
          const solved = wowoSolve(wowo), { T, P, a: days } = wowo, H = wowo.H ?? 0, S = wowo.S ?? 0, Pt = wowo.Pt ?? 0, Tt = wowo.Tt ?? 0, M = wowo.M ?? 0, A = solved.answer, x = solved.x;
          q.bloom = 'C4'; q.stem = wowo.stem; q.explanation = wowoExplanation(wowo);
          const rest = wowo.kind === 'mangkrak' ? T - days - M : T - days - H;
          // Rentang logis: tambahan atau total hari tidak melebihi hari rencana; tambahan pekerja tidak melebihi tiga kali pekerja rencana.
          const known: Record<WowoKind, [string, Mistake[], string, [number, number]]> = {
            'sakit-balik-pekerja': [H + '*' + S + '/' + rest, [[P + A, 'Yang dijawab jumlah pekerja baru, bukan tambahannya.'], [S, 'Hanya pekerja yang sakit yang diganti.'], [H * S / (rest + H), 'Sisa hari dihitung tanpa lama sakit.'], [A * 2, 'Tambahan dihitung dua kali.'],
              [A + S, 'Pekerja sakit ditambahkan lagi pada tambahan yang diperlukan.'], [H, 'Lama sakit dianggap jumlah pekerja tambahan.'], [S * H, 'Hasil kali pekerja sakit dan lama sakit belum dibagi sisa hari.'], [A + H, 'Lama sakit ikut ditambahkan pada tambahan pekerja.'],
              [rest, 'Sisa hari dianggap jumlah pekerja tambahan.'], [P - S, 'Pekerja yang masih bekerja saat sakit dianggap tambahan.']], 'pekerja', [1, 3 * P]],
            'sakit-balik-hari': [S + '*' + H + '/' + P, [[x, 'Yang dijawab hari sisa pada tahap terakhir, belum dikurangkan.'], [H, 'Lama sakit dianggap tambahan hari.'], [S * H, 'Hasil kali belum dibagi pekerja awal.'], [S * H / (P - S), 'Dibagi pekerja yang tersisa, bukan pekerja awal.'],
              [A * 2, 'Tambahan dihitung dua kali.'], [A + H, 'Lama sakit ikut ditambahkan pada tambahan hari.'], [H - A, 'Tambahan dikurangkan dari lama sakit.'], [S, 'Pekerja yang sakit dianggap tambahan hari.'], [A + S, 'Pekerja sakit ditambahkan pada tambahan hari.'],
              [T - days, 'Sisa hari rencana dianggap tambahan.'], [T - days - H, 'Sisa hari setelah sakit dianggap tambahan.'], [T - days + H, 'Lama sakit ditambahkan pada sisa hari rencana.'], [P - S, 'Pekerja yang masih bekerja dianggap tambahan hari.'], [H + S, 'Lama sakit dan pekerja sakit dijumlahkan.']], 'hari', [1, T]],
            'sakit-tidak-balik': [P + '*(' + T + '-' + days + ')/(' + P + '-' + S + ')+' + days + '-' + T, [[x, 'Hari sisa tahap terakhir, belum dikurangi hari sisa rencana.'], [S, 'Pekerja yang sakit dianggap hari tambahan.'], [A * 2, 'Tambahan dihitung dua kali.'], [A + days, 'Hari yang sudah berjalan ikut dijumlahkan.'],
              [x - days, 'Hari berjalan dikurangkan, bukan hari sisa rencana.'], [(T - days) * S / P, 'Pekerja awal dipakai sebagai pembagi.'], [T - days, 'Sisa hari rencana dianggap tambahan.'], [days, 'Hari yang sudah berjalan dianggap tambahan.'], [A + S, 'Pekerja sakit ditambahkan pada tambahan hari.'], [T - days - S, 'Pekerja sakit dikurangkan dari sisa hari rencana.'], [x - S, 'Pekerja sakit dikurangkan dari hari tahap terakhir.'], [A + P, 'Jumlah pekerja awal ikut ditambahkan pada tambahan hari.']], 'hari', [1, T]],
            'kontrak': [T + '-' + Tt + '*' + Pt + '/' + P, [[T, 'Kontrak dianggap tidak mempercepat pekerjaan.'], [T - Tt, 'Hanya lama kontrak yang dikurangkan.'], [T - Tt * Pt / (P + Pt), 'Dibagi pekerja setelah ditambah, bukan pekerja awal.'], [x, 'Hari sisa tahap terakhir, bukan total realisasi.'],
              [days + x, 'Hari tahap kontrak belum ikut dihitung.'], [days + Tt, 'Hanya hari sebelum dan selama kontrak yang dijumlahkan.'], [T - Pt * Tt, 'Hasil kali pekerja kontrak dan harinya belum dibagi pekerja awal.'], [x + Tt, 'Hari sebelum kontrak belum ikut dihitung.'],
              [T - days, 'Hanya sisa hari rencana yang dihitung.'], [T - days - Tt, 'Sisa hari rencana setelah kontrak dianggap total.'], [T - Pt, 'Jumlah pekerja kontrak dikurangkan dari hari rencana.']], 'hari', [1, T]],
            'mangkrak': [M + '*' + P + '/' + rest, [[P + A, 'Yang dijawab jumlah pekerja baru, bukan tambahannya.'], [M, 'Hari berhenti dianggap tambahan pekerja.'], [M * P / (rest + M), 'Sisa hari dihitung termasuk hari berhenti.'], [P * M / T, 'Dibagi total hari rencana.'],
              [A * 2, 'Tambahan dihitung dua kali.'], [rest, 'Sisa hari dianggap tambahan pekerja.'], [A + M, 'Hari berhenti ikut ditambahkan pada tambahan pekerja.'], [P, 'Pekerja awal dianggap tambahan.'], [T - days, 'Sisa hari rencana dianggap tambahan pekerja.'], [A + rest, 'Sisa hari ikut ditambahkan pada tambahan pekerja.'], [A + days, 'Hari berjalan ikut ditambahkan pada tambahan pekerja.'], [P - A, 'Tambahan dikurangkan dari pekerja awal.']], 'pekerja', [1, 3 * P]],
          };
          let unitName: string;
          [expression, mistakes, unitName, range] = known[wowo.kind];
          if (Math.abs(calculate(expression) - A) > 1e-9) throw new Error('Jawaban polemik proyek berbeda dari penyelesaian WOWO.');
          render = (value) => plain(value) + ' ' + unitName;
          return storyNumeric(q, A, expression, mistakes, render, range, r);
        }
      } else {
        const variant = r.int(0, 6), a = r.int(3, 12), b = r.int(2, 6);
        if (variant === 0) {
          // Kecepatan dalam km/jam, waktu dalam menit: satuan harus disamakan (kelipatan agar jarak bulat).
          const speed = 4 * r.int(6, 30), minutes = 15 * r.int(2, 8);
          expression = speed + '*' + minutes + '/60';
          q.stem = 'Kendaraan bergerak dengan kecepatan tetap ' + speed + ' km/jam selama ' + minutes + ' menit. Berapa jarak yang ditempuh dalam kilometer?';
          q.explanation = jkwExplanation(speed, minutes);
          mistakes = [[speed * minutes, 'Satuan waktu tidak dikonversi: menit dikalikan langsung dengan km/jam.'], [speed + minutes, 'Kecepatan dan waktu dijumlahkan, bukan dikalikan.'], [speed * minutes / 30, 'Satu jam dianggap 30 menit.'], [speed * minutes / 20, 'Satu jam dianggap 20 menit.'],
            [speed * 60 / minutes, 'Rumus tertukar: kecepatan dibagi waktu (dalam jam).'], [speed - minutes, 'Kecepatan dikurangi waktu.'], [speed * minutes / 100, 'Satu jam dianggap 100 menit.'], [speed * minutes / 90, 'Satu jam dianggap 90 menit.'], [speed * minutes / 50, 'Satu jam dianggap 50 menit.']];
          render = (value) => plain(value) + ' km'; range = [1, 100 * speed * minutes / 60];
        } else if (variant === 1) {
          // Debit dalam liter/menit, waktu dalam jam.
          const debit = a * 5, hours = r.int(1, 4);
          expression = debit + '*' + hours + '*60';
          q.stem = 'Pompa mengalirkan air dengan debit tetap ' + debit + ' liter/menit selama ' + hours + ' jam. Berapa liter air yang dialirkan?';
          q.explanation = vdwExplanation(debit, hours);
          mistakes = [[debit * hours, 'Satuan waktu tidak dikonversi: jam dikalikan langsung dengan liter/menit.'], [debit + hours, 'Debit dan waktu dijumlahkan, bukan dikalikan.'], [debit * hours * 100, 'Satu jam dianggap 100 menit.'], [debit * hours * 30, 'Satu jam dianggap 30 menit.'],
            [debit * hours * 90, 'Satu jam dianggap 90 menit.'], [debit * hours * 6, 'Satu jam dianggap 6 menit.'], [debit * hours * 50, 'Satu jam dianggap 50 menit.'], [debit * hours * 120, 'Satu jam dianggap 120 menit.']];
          render = (value) => plain(value) + ' liter'; range = [1, 100 * debit * hours * 60];
        } else if (variant === 2) {
          // Satu nilai bergabung: nilai baru = rata-rata awal + k × (banyak data baru), sehingga rata-rata baru bulat; banyak data awal ganjil agar rata-rata sederhana juga bulat.
          const n = r.pick([3, 5, 7, 9]), oldMean = r.int(60, 80);
          let step = r.int(1, 3); if (oldMean + (n + 1) * step > 100) step = 1;
          const newValue = oldMean + (n + 1) * step;
          expression = '(' + n + '*' + oldMean + '+' + newValue + ')/' + (n + 1);
          q.stem = 'Rata-rata nilai ' + n + ' peserta adalah ' + oldMean + '. Satu peserta dengan nilai ' + newValue + ' bergabung. Berapa rata-rata baru?';
          q.explanation = rataBaruExplanation(n, oldMean, newValue);
          mistakes = [[(oldMean + newValue) / 2, 'Rata-rata lama dan nilai baru dirata-ratakan langsung.'], [oldMean, 'Nilai yang bergabung diabaikan; rata-rata dianggap tetap.'], [newValue, 'Hanya nilai yang bergabung yang dipakai.'],
            [(n * newValue + oldMean) / (n + 1), 'Bobot banyak data lama dan satu nilai baru tertukar.']];
          range = [oldMean, newValue];
        } else if (variant === 3) {
          const price = a * 20000, percent = b * 5;
          expression = price + '*(100-' + percent + ')/100';
          q.stem = 'Barang berharga ' + rupiah(price) + ' mendapat diskon ' + percent + '%. Berapa harga setelah diskon dalam rupiah?';
          q.explanation = diskonExplanation(price, percent);
          mistakes = [[price * percent / 100, 'Yang dijawab besar diskon, bukan harga setelah diskon.'], [price * (100 + percent) / 100, 'Diskon dianggap kenaikan harga.'], [price * (100 - 2 * percent) / 100, 'Persentase diskon dijumlahkan dua kali.'],
            [price * (100 - percent) * (100 - percent) / 10000, 'Diskon diterapkan dua kali berturut-turut.'], [price - percent, 'Persen dikurangkan langsung dari harga rupiah.']];
          render = rupiah; range = [1, price * 1.5];
        } else if (variant === 4) {
          const workers = a, newWorkers = a * 2; let days = b * 6; while (days <= workers || days === newWorkers) days += 6; // hari lebih dari pekerja dan bukan 2 × pekerja, supaya pengecoh tidak berbenturan
          expression = workers + '*' + days + '/' + newWorkers;
          q.stem = 'Pekerjaan diselesaikan ' + workers + ' pekerja dalam ' + days + ' hari. Jika produktivitas sama, berapa hari yang diperlukan ' + newWorkers + ' pekerja?';
          q.explanation = perbandinganExplanation('berbalik', { first: 'pekerja', second: 'hari' }, workers, days, newWorkers, workers * days / newWorkers, 'Pekerja menjadi ' + newWorkers + ' orang', 'lama pekerjaan');
          mistakes = [[days * newWorkers / workers, 'Dikerjakan sebagai perbandingan senilai padahal pekerja dan hari berbalik.'], [days + workers, 'Selisih pekerja dijumlahkan ke hari.'], [days - workers, 'Selisih pekerja dikurangkan dari hari.'],
            [days, 'Tambahan pekerja diabaikan; hari dianggap tetap.'], [days + newWorkers, 'Jumlah pekerja baru dijumlahkan ke hari.'], [workers * days / (workers + newWorkers), 'Jumlah pekerja lama dan baru dipakai sebagai pembagi.']];
          render = (value) => plain(value) + ' hari'; range = [1, 2 * days];
        } else if (variant === 5) {
          let partA = a, partB = b; if (partA === partB) partB += 1;
          const total = (partA + partB) * r.int(3, 12);
          expression = total + '*' + partA + '/(' + partA + '+' + partB + ')';
          q.stem = 'Perbandingan jumlah buku kelompok A dan B adalah ' + partA + ' : ' + partB + '. Totalnya ' + total + ' buku. Berapa buku kelompok A?';
          q.explanation = rasioExplanation(partA, partB, total, 'buku');
          mistakes = [[total * partB / (partA + partB), 'Bagian B yang dihitung.'], [total / (partA + partB), 'Satu bagian perbandingan belum dikalikan dengan perbandingan A.'], [total - partA, 'Perbandingan A dikurangkan dari total.'],
            [total - partB, 'Perbandingan B dikurangkan dari total.'], [total / 2, 'Total dibagi dua sama rata.'], [total / partA, 'Total dibagi bagian perbandingan A saja.']];
          render = (value) => plain(value) + ' buku'; range = [1, total - 1];
        } else {
          const kinds: { names: Pair; p: number; q: number; stem: (x: number, y: number, d: number) => string; what: string; extra: string }[] = [
            { names: { first: 'sapi', second: 'karung rumput' }, p: 8, q: 5, what: 'karung rumput yang dihabiskan', extra: 'sapi',
              stem: (x, y, d) => 'Sebanyak ' + x + ' sapi menghabiskan ' + y + ' karung rumput dalam waktu 1 bulan. Jika terdapat tambahan ' + d + ' sapi, maka akan menghabiskan berapa karung rumput?' },
            { names: { first: 'mesin', second: 'unit barang' }, p: 3, q: 2, what: 'unit barang yang dihasilkan', extra: 'mesin',
              stem: (x, y, d) => x + ' mesin menghasilkan ' + y + ' unit barang dalam sehari. Jika terdapat tambahan ' + d + ' mesin dengan kemampuan sama, berapa unit barang yang dihasilkan dalam sehari?' },
            { names: { first: 'liter bensin', second: 'km' }, p: 12, q: 1, what: 'jarak tempuh', extra: 'liter bensin',
              stem: (x, y, d) => 'Dengan ' + x + ' liter bensin sebuah mobil menempuh jarak ' + y + ' km. Jika terdapat tambahan ' + d + ' liter bensin, berapa km jarak yang dapat ditempuh seluruhnya?' },
          ];
          const kind = r.pick(kinds), i = r.int(4, 14), j = r.int(1, 4), x1 = kind.q * i, y1 = kind.p * i, extra = kind.q * j, x2 = x1 + extra, y2 = kind.p * (i + j);
          expression = y1 + '*' + x2 + '/' + x1;
          q.stem = kind.stem(x1, y1, extra);
          q.explanation = perbandinganExplanation('senilai', kind.names, x1, y1, x2, y2, 'Terdapat tambahan ' + extra + ' ' + kind.names.first + ', sehingga ' + x1 + ' + ' + extra + ' = ' + x2 + ' ' + kind.names.first, kind.what);
          mistakes = [[y1 * x1 / x2, 'Dikerjakan sebagai perbandingan berbalik.'], [y1 + extra, 'Tambahan ditambahkan langsung ke hasil.'], [y1, 'Tambahan diabaikan; hasil dianggap tetap.'], [y2 - y1, 'Yang dijawab hanya tambahan hasil, bukan totalnya.'],
            [2 * y2 - y1, 'Tambahan hasil dihitung dua kali.'], [y1 + y2, 'Hasil lama dan hasil baru dijumlahkan.']];
          render = (value) => plain(value) + ' ' + kind.names.second; range = [1, 2 * y2];
        }
      }
      return storyNumeric(q, calculate(expression), expression, mistakes, render, range, r);
    };
    for (let attempt = 0; ; attempt++) {
      try { return story(); } catch (error) { if (attempt >= 60 || !(error as Error).message.startsWith('Pengecoh soal cerita belum cukup')) throw error; }
    }
  }
  // Soal figural dibangun oleh mesin figural (lib/figural): bentuk kaya, aturan tidak bocor di kalimat soal,
  // dan kuncinya dibuktikan ulang dari gambar oleh validator.
  const figural = makeFigural(family.id, difficulty, r);
  return { ...q, ...figural };
}
