// Penyusun pembahasan deret angka menurut Panduan Produksi Soal TIU JadiASN, bagian 2 (PDF 64–71): konsep towew (panah arah ↑ ↓ dan tabel
// "1 / 2 / 3 towew"), "Pola yang terlihat" berupa angka dengan panah melengkung berlabel selisih/rasio/operasi, Fibonacci dengan panah turun
// "1+1", dan pola Campuran. Diagram disimpan sebagai baris `@deret {JSON}` (lib/chain.ts). Semua angka berasal dari soal yang dibangkitkan;
// contoh panduan yang keliru tidak disalin (PDF 70–71: U7 tertulis 55 padahal (7×10)−1 = 69). Tidak ada "Rumus Cepat" pada deret (panduan tidak memakainya).
import { chainLine, type Chain, type ChainArc } from './chain';
import { KEY_MARK, tableLines } from './explanation';
import type { Rng } from './rng';

const join = (...lines: string[]) => lines.join('\n');
const CLOSE = 'Jadi, jawaban yang benar adalah ' + KEY_MARK + '.';
const MINUS = '−';

export type Lane = { op: '+' | '×'; n: number };
export const laneLabel = (lane: Lane) => lane.op + lane.n;
const apply = (value: number, lane: Lane) => lane.op === '+' ? value + lane.n : value * lane.n;

// Jumlah towew dari tiga panah pertama: ↑↑↑ atau ↓↓↓ = 1, ↑↓↑ atau ↓↑↓ = 2, ↑↑↓ atau ↓↓↑ = 3 (0 bila ada suku yang sama atau polanya lain).
export function directions(values: number[]): string[] { return values.slice(1).map((v, i) => v > values[i] ? '↑' : v < values[i] ? '↓' : '='); }
export function towewOf(values: number[]): number {
  const d = directions(values).slice(0, 3);
  if (d.length < 3 || d.includes('=')) return 0;
  return d[0] === d[1] && d[1] === d[2] ? 1 : d[0] !== d[1] && d[0] === d[2] ? 2 : d[0] === d[1] ? 3 : 0;
}
export const TOWEW_ROWS = [['↑ ↑ ↑ atau ↓ ↓ ↓', '1 Towew'], ['↑ ↓ ↑ atau ↓ ↑ ↓', '2 Towew'], ['↑ ↑ ↓ atau ↓ ↓ ↑', '3 Towew']];

// Arti istilah towew (QC akademik #2, soal 51): istilah internal dijelaskan sebagai banyaknya larik berselang, supaya pembaca tidak perlu mengenal istilahnya lebih dahulu.
export const towewMeaning = (n: number) => n === 1 ? '1 towew berarti seluruh suku membentuk satu larik dengan pola yang sama dari suku ke suku.' :
  n === 2 ? '2 towew berarti deret tersusun atas dua larik berselang: suku ke-1, 3, 5, … membentuk larik ganjil, sedangkan suku ke-2, 4, 6, … membentuk larik genap.' :
  n + ' towew berarti deret tersusun atas ' + n + ' larik berselang: ' + Array.from({ length: n }, (_, k) => 'suku ke-' + [k + 1, k + 1 + n, k + 1 + 2 * n].join(', ') + ', … membentuk larik ke-' + (k + 1)).join('; ') + '.';
// Blok konsep towew: angka dengan panah arah (tiga panah pertama dilingkari merah), tabel konsep, dan "↑ ↓ ↑ artinya 2 towew" beserta artinya.
function arah(values: number[], expected: number): string[] {
  const towew = towewOf(values);
  if (towew !== expected) throw new Error('Arah suku tidak sesuai ' + expected + ' towew.');
  const chain: Chain = { terms: [...values.map(String), '…'], arcs: directions(values).map((label, i): ChainArc => ({ from: i, to: i + 1, label, color: 'ink', side: 'top', style: 'tick' })), loop: [0, 3] };
  return [chainLine(chain), ...tableLines({ rows: TOWEW_ROWS }), directions(values).slice(0, 3).join(' ') + ' artinya ' + towew + ' towew', towewMeaning(towew), ''];
}
const arcs = (indices: number[], label: string, color: ChainArc['color'], side: ChainArc['side'], depth = 0): ChainArc[] =>
  indices.slice(1).map((to, i) => ({ from: indices[i], to, label, color, side, ...(depth ? { depth } : {}) }));
const series = (from: number, until: number, stride: number) => { const out: number[] = []; for (let i = from; i <= until; i += stride) out.push(i); return out; };
const diagram = (values: number[], answer: number, arcList: ChainArc[], color: ChainArc['color']) =>
  chainLine({ terms: [...values.map(String), String(answer)], arcs: arcList, marks: [{ index: values.length, color }] });

// 1 towew (PDF 65–66): deret aritmetika dengan selisih tetap.
export function deretSatuExplanation(values: number[], step: number, answer: number): string {
  const n = values.length;
  return join(...arah(values, 1), 'Pola yang terlihat:',
    diagram(values, answer, arcs(series(0, n, 1), '+' + step, 'ink', 'top'), 'red'),
    'Pola tambahannya tetap, yaitu +' + step + '. Maka suku berikutnya adalah ' + values[n - 1] + ' + ' + step + ' = ' + answer + '.', CLOSE);
}
// 2 towew (PDF 67–68): larik ganjil (biru, di atas) dan larik genap (hijau, di bawah); yang ditanyakan jatuh pada larik ganjil (suku ke-9).
export function deretDuaExplanation(values: number[], odd: Lane, even: Lane, answer: number): string {
  const n = values.length;
  if (apply(values[n - 2], odd) !== answer) throw new Error('Larik ganjil tidak menghasilkan jawaban.');
  return join(...arah(values, 2), 'Pola yang terlihat:',
    diagram(values, answer, [...arcs(series(0, n, 2), laneLabel(odd), 'blue', 'top'), ...arcs(series(1, n - 1, 2), laneLabel(even), 'green', 'bottom')], 'blue'),
    'Suku yang ditanyakan berada pada larik ganjil (suku ke-' + (n + 1) + '). Larik genap berpola ' + laneLabel(even) + '.',
    'Pada larik ganjil, suku berikutnya adalah ' + values[n - 2] + ' ' + odd.op + ' ' + odd.n + ' = ' + answer + '.',
    'Jadi, bilangan berikutnya adalah ' + answer + '. Jawaban yang benar adalah ' + KEY_MARK + '.');
}
// 3 towew (PDF 66–67): tiga larik berulang tiap tiga suku; yang ditanyakan jatuh pada larik ke-1 (suku ke-10).
export function tigaJalurExplanation(values: number[], steps: number[], answer: number): string {
  const n = values.length;
  if (values[n - 3] + steps[0] !== answer) throw new Error('Larik pertama tidak menghasilkan jawaban.');
  return join(...arah(values, 3), 'Pola yang terlihat:',
    diagram(values, answer, [...arcs(series(0, n, 3), '+' + steps[0], 'blue', 'top'), ...arcs(series(1, n - 2, 3), '+' + steps[1], 'green', 'bottom'), ...arcs(series(2, n - 1, 3), '+' + steps[2], 'red', 'bottom', 1)], 'blue'),
    'Suku yang ditanyakan berada pada larik ke-1 (suku ke-' + (n + 1) + '). Larik ke-1 memiliki pola +' + steps[0] + ', yaitu ' + values[0] + ', ' + values[3] + ', ' + values[6] + ', sehingga suku berikutnya adalah ' + values[6] + ' + ' + steps[0] + ' = ' + answer + '.',
    CLOSE);
}
// Fibonacci (PDF 61): panah turun dari tiap suku dengan label jumlah dua suku sebelumnya.
export function fibonacciExplanation(values: number[], answer: number): string {
  const n = values.length, terms = [...values, answer];
  if (values[n - 2] + values[n - 1] !== answer) throw new Error('Jumlah dua suku terakhir bukan jawaban.');
  const drops: ChainArc[] = terms.map((_, i): ChainArc => ({ from: i, to: i, label: i >= 2 ? terms[i - 2] + '+' + terms[i - 1] : '', color: 'ink', side: 'bottom', style: 'drop', depth: i % 2 })).filter((a) => a.label);
  const sums = terms.slice(2, n).map((v, i) => terms[i] + ' + ' + terms[i + 1] + ' = ' + v);
  return join('Pola yang terlihat:', chainLine({ terms: terms.map(String), arcs: drops, marks: [{ index: n, color: 'red' }] }),
    'Setiap suku diperoleh dari jumlah dua suku sebelumnya.', sums.slice(0, 4).join(', ') + ', dan seterusnya.',
    'Maka suku berikutnya adalah ' + values[n - 2] + ' + ' + values[n - 1] + ' = ' + answer + '.', CLOSE);
}
// Selang-seling sebagai pola Campuran (PDF 62, keputusan akademik: panah "+a" / "−b" bergantian dan satu perhitungan per suku).
export function selangSelingExplanation(values: number[], add: number, subtract: number, answer: number): string {
  const n = values.length, terms = [...values, answer];
  const label = (i: number) => i % 2 === 0 ? '+' + add : MINUS + subtract;
  if (values[n - 1] + add !== answer) throw new Error('Operasi berikutnya bukan jawaban.');
  const calc = terms.slice(1).map((v, i) => terms[i] + (i % 2 === 0 ? ' + ' + add : ' ' + MINUS + ' ' + subtract) + ' = ' + v);
  return join('Pola yang terlihat:',
    chainLine({ terms: terms.map(String), arcs: terms.slice(1).map((_, i): ChainArc => ({ from: i, to: i + 1, label: label(i), color: 'ink', side: 'top' })), marks: [{ index: n, color: 'red' }] }),
    'Pola campuran: ditambah ' + add + ', lalu dikurangi ' + subtract + ', berulang dari satu suku ke suku berikutnya.', ...calc,
    'Jadi, bilangan berikutnya adalah ' + answer + '. Jawaban yang benar adalah ' + KEY_MARK + '.');
}

// ---- Pengecoh deret: hanya dari kesalahan konsep yang bisa disebut ------------------------------------------------------------------------------
// Tiap pengecoh membawa kode sumber kesalahan dan kalimat alasannya (dicatat di proof.distractors, tidak ditampilkan). Nilainya harus bilangan bulat
// positif, berbeda dari kunci dan dari pengecoh lain, dan berskala sama dengan kunci (0,3 sampai 3,3 kali). Pemeriksa di scripts/tiu-format-checks.ts
// menghitung ulang setiap nilai dari kode sumbernya memakai suku-suku soal.
export type Distractor = { value: number; source: string; reason: string };
export const DISTRACTOR_REASONS: Record<string, string> = {
  'ulang-suku-terakhir': 'Mengulang suku terakhir pada larik tanpa menerapkan pola.',
  'maju-dua-suku': 'Menerapkan pola dua kali sehingga melompati satu suku.',
  'selisih-lebih-satu': 'Selisih pola dihitung lebih besar satu dari yang benar.',
  'selisih-kurang-satu': 'Selisih pola dihitung lebih kecil satu dari yang benar.',
  'rasio-lebih-satu': 'Pengali pola dihitung lebih besar satu dari yang benar.',
  'rasio-kurang-satu': 'Pengali pola dihitung lebih kecil satu dari yang benar.',
  'arah-terbalik': 'Selisih dikurangkan padahal suku-suku larik menaik.',
  'tukar-operasi': 'Penjumlahan dan perkalian tertukar pada pola larik.',
  'anggap-selisih-tetap': 'Larik berpola perkalian dianggap berselisih tetap.',
  'selisih-larik-lain': 'Pola larik lain dipakai pada larik yang ditanyakan.',
  'lanjut-larik-lain': 'Meneruskan larik lain, bukan larik yang ditanyakan.',
  'selisih-larik-kedua': 'Selisih larik kedua dipakai pada larik yang ditanyakan.',
  'selisih-larik-ketiga': 'Selisih larik ketiga dipakai pada larik yang ditanyakan.',
  'lanjut-larik-ketiga': 'Meneruskan larik ketiga, bukan larik yang ditanyakan.',
  'jumlah-suku-berselang': 'Menjumlahkan suku terakhir dengan suku yang berselang satu, bukan dua suku terakhir.',
  'jumlah-tiga-suku': 'Menjumlahkan tiga suku terakhir, bukan dua.',
  'jumlah-suku-keempat': 'Menjumlahkan suku terakhir dengan suku keempat dari belakang.',
  'salah-hitung-lebih-satu': 'Hasil penjumlahan benar tetapi salah hitung lebih satu.',
  'salah-hitung-kurang-satu': 'Hasil penjumlahan benar tetapi salah hitung kurang satu.',
  'urutan-operasi-terbalik': 'Operasi berselang terbalik: suku terakhir dikurangi, bukan ditambah.',
  'dua-operasi-sekaligus': 'Kedua operasi (tambah lalu kurang) diterapkan sekaligus pada satu langkah.',
  'pengurang-ditambah': 'Bilangan pengurang dipakai sebagai penambah.',
};
export type DeretKind = 'satu' | 'dua' | 'tiga' | 'fibonacci' | 'campuran';
export const DISTRACTOR_SCALE: [number, number] = [0.3, 3.3];
// `lanes`: pola tiap larik (indeks 0 = larik yang ditanyakan); `add`/`subtract`: pola campuran. Mengembalikan empat pengecoh (urutan diundi dengan `r`).
export function deretDistractors(kind: DeretKind, values: number[], answer: number, setup: { lanes?: Lane[]; add?: number; subtract?: number }, r: Rng): Distractor[] {
  const n = values.length, last = values[n - 1];
  let all: [string, number][];
  if (kind === 'fibonacci') {
    all = [['ulang-suku-terakhir', last], ['jumlah-suku-berselang', last + values[n - 3]], ['jumlah-tiga-suku', last + values[n - 2] + values[n - 3]], ['jumlah-suku-keempat', last + values[n - 4]],
      ['salah-hitung-lebih-satu', answer + 1], ['salah-hitung-kurang-satu', answer - 1]];
  } else if (kind === 'campuran') {
    const add = setup.add!, subtract = setup.subtract!;
    all = [['urutan-operasi-terbalik', last - subtract], ['dua-operasi-sekaligus', last + add - subtract], ['pengurang-ditambah', last + subtract], ['ulang-suku-terakhir', last],
      ['maju-dua-suku', answer + add], ['salah-hitung-lebih-satu', answer + 1], ['salah-hitung-kurang-satu', answer - 1]];
  } else {
    const lanes = setup.lanes!, count = lanes.length, own = lanes[0], lastOwn = values[n - count];
    all = [['ulang-suku-terakhir', lastOwn], ['maju-dua-suku', apply(answer, own)],
      own.op === '+' ? ['selisih-lebih-satu', lastOwn + own.n + 1] : ['rasio-lebih-satu', lastOwn * (own.n + 1)],
      own.op === '+' ? ['selisih-kurang-satu', lastOwn + own.n - 1] : ['rasio-kurang-satu', lastOwn * (own.n - 1)],
      own.op === '+' ? ['arah-terbalik', lastOwn - own.n] : ['anggap-selisih-tetap', lastOwn + (lastOwn - values[n - 2 * count])],
      ['tukar-operasi', own.op === '+' ? lastOwn * own.n : lastOwn + own.n]];
    if (count === 2) all.push(['selisih-larik-lain', apply(lastOwn, lanes[1])], ['lanjut-larik-lain', apply(last, lanes[1])]);
    if (count === 3) all.push(['selisih-larik-kedua', apply(lastOwn, lanes[1])], ['selisih-larik-ketiga', apply(lastOwn, lanes[2])], ['lanjut-larik-ketiga', apply(last, lanes[2])]);
  }
  const picked: Distractor[] = [];
  for (const [source, value] of r.shuffle(all)) {
    const ratio = value / answer;
    if (!Number.isInteger(value) || value <= 0 || value === answer || ratio < DISTRACTOR_SCALE[0] || ratio > DISTRACTOR_SCALE[1] || picked.some((d) => d.value === value)) continue;
    picked.push({ value, source, reason: DISTRACTOR_REASONS[source] });
    if (picked.length === 4) return picked;
  }
  throw new Error('Pengecoh deret belum cukup (' + kind + ': ' + values.join(', ') + ').');
}
