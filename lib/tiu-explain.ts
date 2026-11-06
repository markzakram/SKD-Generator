// Penyusun pembahasan TIU numerik dasar menurut Panduan Produksi Soal TIU JadiASN (berhitung/pecahan: PDF 57–63) dan Contoh Soal TIU SKD 2027
// (pola bilangan tabel: PDF 38; kecukupan data: PDF 44–47). Semua fungsi murni; keluarannya string pembahasan berstruktur (lib/explanation.ts).
import { aligned, bullet, display, inline, KEY_MARK, optionEntryMark, tableLines } from './explanation';
import { DATA_LABELS, dataCategory, type Condition, type Model } from './models';
import { guideLine } from './guide-images';

const clean = (value: number) => Math.round(value * 10000) / 10000;
// Angka di dalam LaTeX memakai koma desimal ("0{,}75"); `num` untuk kalimat biasa.
export const tex = (value: number) => String(clean(value)).replace('.', '{,}');
export const num = (value: number) => String(clean(value)).replace('.', ',');
const frac = (top: number | string, bottom: number | string) => '\\frac{' + top + '}{' + bottom + '}';
const join = (...lines: string[]) => lines.join('\n');

// ---- Berhitung: urutan operasi per langkah -------------------------------------------------------------------------------------
type Token = { t: 'n'; v: number } | { t: 'o'; o: string } | { t: '(' } | { t: ')' };
const SYMBOL: Record<string, string> = { '+': '+', '-': '-', '*': '\\times', '/': '\\div' };
const tokenize = (expression: string): Token[] => (expression.match(/\d+(?:\.\d+)?|[()+*/-]/g) ?? []).map((s): Token =>
  /^\d/.test(s) ? { t: 'n', v: Number(s) } : s === '(' || s === ')' ? { t: s } : { t: 'o', o: s });
const render = (tokens: Token[]) => tokens.map((k) => k.t === 'n' ? tex(k.v) : k.t === 'o' ? SYMBOL[k.o] : k.t).join(' ').replace(/\( /g, '(').replace(/ \)/g, ')');
// Satu operasi: perkalian/pembagian paling kiri lebih dahulu, baru penjumlahan/pengurangan paling kiri (tanpa tanda kurung).
function reduceOnce(tokens: Token[]): Token[] {
  let at = tokens.findIndex((k) => k.t === 'o' && (k.o === '*' || k.o === '/'));
  if (at < 0) at = tokens.findIndex((k) => k.t === 'o');
  const left = tokens[at - 1] as { t: 'n'; v: number }, right = tokens[at + 1] as { t: 'n'; v: number }, op = (tokens[at] as { t: 'o'; o: string }).o;
  const value = op === '+' ? left.v + right.v : op === '-' ? left.v - right.v : op === '*' ? left.v * right.v : left.v / right.v;
  return [...tokens.slice(0, at - 1), { t: 'n', v: clean(value) }, ...tokens.slice(at + 2)];
}
// Kurung terdalam dikerjakan lebih dahulu; kurung dibuang begitu isinya menjadi satu bilangan.
function step(tokens: Token[]): Token[] {
  const close = tokens.findIndex((k) => k.t === ')');
  if (close < 0) return reduceOnce(tokens);
  const open = tokens.slice(0, close).map((k) => k.t).lastIndexOf('(');
  const inner = tokens.slice(open + 1, close), reduced = inner.length > 1 ? reduceOnce(inner) : inner;
  return [...tokens.slice(0, open), ...(reduced.length === 1 ? reduced : [{ t: '(' } as Token, ...reduced, { t: ')' } as Token]), ...tokens.slice(close + 1)];
}
// Ekspresi (grammar `calculate`), lalu satu baris "= ..." per operasi sampai hasil (PDF 60).
export function hitungSteps(expression: string): string[] {
  let tokens = tokenize(expression);
  const rows = [render(tokens)];
  for (let guard = 0; tokens.length > 1 && guard < 60; guard++) { tokens = step(tokens); rows.push('=' + render(tokens)); }
  return rows;
}
export const hitungExplanation = (expression: string) => aligned(hitungSteps(expression));

// Pemisah pasangan pada opsi setara: pasangan belum terbukti sama, jadi tidak ditulis dengan "=".
export const COMPARE = ' dibandingkan dengan ';
// Compare every offered pair using exact integer products. Division uses cross
// multiplication, so rounded decimal quotients cannot make unequal pairs equal.
export function equalityExplanation(options: string[]): string {
  const rows = options.map(option => {
    const parts = /^(\d+)\s*([×÷])\s*(\d+)\s*(?:=|dibandingkan dengan)\s*(\d+)\s*([×÷])\s*(\d+)$/.exec(option);
    if (!parts || parts[2] !== parts[5]) throw new Error('Pasangan setara tidak dikenali: ' + option);
    const [, a, op, b, c, , d] = parts, divide = op === '÷';
    const left = +a * (divide ? +d : +b), right = +c * (divide ? +b : +d);
    const latex = (x: string, y: string) => divide ? frac(x, y) : x + '\\times' + y;
    return [inline(latex(a, b)) + ' dan ' + inline(latex(c, d)),
      inline(a + '\\times' + (divide ? d : b) + '=' + left) + '; ' + inline(c + '\\times' + (divide ? b : d) + '=' + right), left === right ? '**Setara** (' + inline(left + '=' + right) + ')' : 'Tidak setara (' + inline(left + '\\ne ' + right) + ')'];
  });
  return join('**Penyelesaian:**', options[0].includes('÷') ? 'Bandingkan pembagian melalui perkalian silang: ' + inline('\\frac{a}{b}=\\frac{c}{d}\\iff a\\times d=c\\times b') + ', dengan penyebut tidak nol.' : 'Hitung hasil kali kedua pasangan. Kedua pasangan setara jika hasil kalinya sama.',
    ...tableLines({ headers: ['Pasangan', 'Perhitungan', 'Hasil'], rows }),
    '**Kesimpulan:** Pilih pasangan bertanda **Setara**; kesamaan digit terakhir saja belum membuktikan kedua hasil sama.');
}

export function matrixExplanation(top: number[], middle: number[], bottom: number[], factor: number): string {
  return join('**Pola kolom:** ' + inline('\\text{tengah}=a\\times\\text{atas}+\\text{bawah}') + '.',
    '**Menentukan pengali:**', ...[0, 1].map(i => 'Kolom ' + (i + 1) + ': ' + inline('a=\\frac{' + middle[i] + '-' + bottom[i] + '}{' + top[i] + '}=' + factor) + '.'),
    '**Penyelesaian kolom ketiga:**', aligned(['x=' + middle[2] + '-' + factor + '\\times' + top[2], '=' + middle[2] + '-' + factor * top[2], '=' + bottom[2]]),
    '**Kesimpulan:** Bilangan pengganti tanda tanya adalah ' + inline(String(bottom[2])) + '.');
}

// Tabel Pernyataan (naskah QC akademik #2 bagian 7, soal 56): tabel hitungan, klaim, dan status; alasan tiap pernyataan salah; eliminasi setiap opsi.
// Butir eliminasi memakai penanda {opsi:N} (N = Option.ref), sehingga hurufnya tetap benar setelah opsi diacak.
const rp = (value: number) => 'Rp' + value.toLocaleString('id-ID');
const listNo = (items: number[]) => items.map((n) => '(' + n + ')').join(items.length > 2 ? ', ' : ' dan ').replace(/, (\(\d\))$/, ', dan $1');
export function statementsExplanation(prices: number[], amounts: number[][], offered: number[], combos: string[] = []): string {
  const totals = amounts.map((counts) => counts.reduce((sum, n, j) => sum + n * prices[j], 0));
  const correct = totals.flatMap((total, i) => total === offered[i] ? [i + 1] : []), wrong = totals.flatMap((total, i) => total === offered[i] ? [] : [i + 1]);
  const rows = amounts.map((counts, i) => ['(' + (i + 1) + ')', inline(counts.map((n, j) => n + '\\times ' + prices[j]).join('+') + '=' + totals[i]), rp(offered[i]), totals[i] === offered[i] ? '**Benar**' : 'Salah']);
  const reasons = wrong.map((no) => { const gap = offered[no - 1] - totals[no - 1]; return 'Pernyataan (' + no + ') salah karena hasil hitungannya ' + rp(totals[no - 1]) + ', ' + rp(Math.abs(gap)) + ' lebih ' + (gap > 0 ? 'rendah' : 'tinggi') + ' daripada klaim.'; });
  const eliminate = combos.map((combo, ref) => {
    const picked = combo.split(/,? dan |, /).map(Number), extra = picked.filter((n) => wrong.includes(n)), missing = correct.filter((n) => !picked.includes(n));
    const verdict = !extra.length && !missing.length ? 'memuat tepat seluruh pernyataan benar, yaitu ' + listNo(correct) + '.' :
      [extra.length ? 'memuat ' + listNo(extra) + ' yang salah' : '', missing.length ? 'belum memuat ' + listNo(missing) : ''].filter(Boolean).join(' dan ') + '.';
    return optionEntryMark(ref) + 'Kombinasi ' + combo + ' ' + verdict;
  });
  return join('Harga satuan pada tabel berlaku untuk setiap pembelian. Periksa setiap pernyataan dengan menjumlahkan banyak barang × harga satuannya. Tabel berikut menunjukkan nilai yang seharusnya, bukan hanya status benar/salah.',
    ...tableLines({ headers: ['No.', 'Hitungan (rupiah)', 'Klaim', 'Status'], rows }),
    'Pernyataan ' + listNo(correct) + ' benar karena hasil hitungannya sama dengan klaim. ' + reasons.join(' '),
    ...(eliminate.length ? ['Eliminasi opsi:', ...eliminate, ''] : []),
    'Jadi, pernyataan yang benar adalah ' + listNo(correct) + '. Jawaban yang benar adalah ' + KEY_MARK + '.');
}

// Kombinasi optimal (naskah QC akademik #2 bagian 7, soal 57): tabel komparasi kapasitas, kursi kosong, biaya, dan kelayakan; harga per kursi bukan dasar jawaban.
export function costExplanation(target: number, prices: number[], combinations: { a: number; b: number; c: number; seats: number; price: number }[]): string {
  const best = Math.min(...combinations.map(c => c.price)), sorted = [...combinations].sort((x, y) => x.price - y.price), cheapest = sorted[0];
  const name = (c: { a: number; b: number; c: number }) => c.a + ' bus A, ' + c.b + ' bus B, ' + c.c + ' bus C';
  const perSeat = prices.map((price, i) => { const value = price / [20, 40, 60][i]; return ['A', 'B', 'C'][i] + ' ' + (Number.isInteger(value) ? rp(value) : 'sekitar ' + rp(Math.round(value))); });
  return join('Dua syarat harus dipenuhi: seluruh ' + target + ' peserta memperoleh kursi dengan kursi kosong paling banyak 20, lalu biaya total terkecil di antara pilihan. Misalkan a, b, dan c banyak bus A, B, dan C.',
    inline('\\text{kapasitas}=20a+40b+60c') + '; ' + inline('\\text{biaya}=' + prices.map((n,i) => n + ['a','b','c'][i]).join('+')) + '.',
    ...tableLines({ headers: ['Kombinasi bus', 'Kapasitas', 'Kursi kosong', 'Biaya total', 'Kelayakan'], rows: sorted.map(c => [name(c), c.seats + ' kursi', String(c.seats - target), c.price === best ? '**' + rp(c.price) + '**' : rp(c.price), c.price === best ? '**Memenuhi; termurah**' : 'Memenuhi']) }),
    'Seluruh kombinasi pada pilihan memenuhi kapasitas dan batas kursi kosong, sehingga yang menentukan adalah biaya total. Kombinasi ' + name(cheapest) + ' memerlukan biaya ' + rp(best) + ', ' + rp(sorted[1].price - best) + ' lebih rendah daripada pilihan termurah berikutnya.',
    'Harga per kursi: ' + perSeat.join('; ') + '. Angka ini membantu melihat efisiensi, tetapi tidak cukup menjadi dasar jawaban karena bus disewa utuh dan kursi kosong dibatasi; bandingkan biaya total setiap kombinasi.',
    'Jadi, jawaban yang benar adalah ' + KEY_MARK + '.');
}

// ---- Pecahan istimewa (PDF 59) ------------------------------------------------------------------------------------------------------
const SPECIAL: [number, number, string, string][][] = [
  [[1, 2, '0{,}5', '50']],
  [[1, 3, '0{,}3333', '33{,}33'], [2, 3, '0{,}6667', '66{,}67']],
  [[1, 4, '0{,}25', '25'], [3, 4, '0{,}75', '75']],
  [[1, 6, '0{,}1667', '16{,}67'], [5, 6, '0{,}8333', '83{,}33']],
  [[1, 8, '0{,}125', '12{,}5'], [3, 8, '0{,}375', '37{,}5'], [5, 8, '0{,}625', '62{,}5'], [7, 8, '0{,}875', '87{,}5']],
];
export const SPECIAL_FRACTIONS = SPECIAL.flat().map(([p, q]) => p + '/' + q);
// Pecahan ditulis apa adanya ("5/10" bukan pecahan istimewa walau nilainya 1/2): tabel hanya bila soal memuat salah satu dari daftar.
export const usesSpecial = (fractions: [number, number][]) => fractions.some(([p, q]) => SPECIAL_FRACTIONS.includes(p + '/' + q));
export const specialTable = (): string[] => [guideLine('pecahan-istimewa')];
export const SPECIAL_SENTENCE = 'Gunakan tabel pecahan istimewa berikut.';

// ---- Pecahan: w + a/D + b/(D/2) − c/D --------------------------------------------------------------------------------------------------
export function pecahanExplanation(whole: number, a: number, b: number, c: number, denominator: number): string {
  const half = denominator / 2, top = a + 2 * b - c, base = whole ? String(whole) : '', plus = whole ? '+' : '';
  // Hasil penjumlahan pembilang bisa negatif; tanda itu dibawa sebagai pengurangan dari bagian bulat.
  const sign = top < 0 ? '-' : plus, size = Math.abs(top);
  const expression = base + plus + frac(a, denominator) + '+' + frac(b, half) + '-' + frac(c, denominator);
  const rows = [
    '=' + base + plus + frac(a, denominator) + '+' + frac(2 * b, denominator) + '-' + frac(c, denominator),
    '=' + base + plus + frac(a + '+' + 2 * b + '-' + c, denominator),
    '=' + base + sign + frac(size, denominator),
    '=' + base + sign + tex(size / denominator),
    ...(whole ? ['=' + tex(whole + top / denominator)] : []),
  ];
  return usesSpecial([[a, denominator], [b, half], [c, denominator]]) ? join(aligned([expression]), SPECIAL_SENTENCE, ...specialTable(), aligned(rows)) : aligned([expression, ...rows]);
}

// ---- Pecahan dengan desimal istimewa: W + d × f (PDF 61) -----------------------------------------------------------------------
export type SpecialDecimal = { p: number; q: number };
export function istimewaExplanation(whole: number, decimal: SpecialDecimal, factor: SpecialDecimal): string {
  const product = decimal.p * factor.p / (decimal.q * factor.q), shown = clean(decimal.p / decimal.q);
  return join(
    aligned([whole + '+' + tex(shown) + '\\times' + frac(factor.p, factor.q)]),
    SPECIAL_SENTENCE, ...specialTable(),
    aligned([
      '=' + whole + '+' + frac(decimal.p, decimal.q) + '\\times' + frac(factor.p, factor.q),
      '=' + whole + '+' + frac(decimal.p + '\\times' + factor.p, decimal.q + '\\times' + factor.q),
      '=' + whole + '+' + frac(decimal.p * factor.p, decimal.q * factor.q),
      '=' + whole + '+' + tex(product),
      '=' + tex(whole + product),
    ]));
}

// ---- Pola bilangan tabel (2027 PDF 38) -----------------------------------------------------------------------------------------------
// Nilai = a × urutan^p + b. `known` = urutan yang nilainya tertulis di tabel.
export function tabelExplanation(slope: number, offset: number, power: number, known: number[], target: number): string {
  const exponent = power === 2 ? '^{2}' : '';
  const at = (n: number, long: boolean) => {
    const middle = slope * n ** power, value = middle + offset, head = slope + '(' + n + ')' + exponent + '+' + offset + '=';
    return long || power === 2 ? head + middle + '+' + offset + '=' + value : head + value;
  };
  return join(
    'Perhatikan hubungan antara urutan dan nilainya.',
    ...known.map((n) => bullet('Urutan ke-' + n + ' → ' + inline(at(n, false)))),
    'Maka pola yang digunakan adalah:',
    inline('\\text{Nilai}=' + slope + '\\times\\text{urutan}' + exponent + '+' + offset),
    'Untuk urutan ke-' + target + ' → ' + inline(at(target, true)),
    'Jadi, nilai pada urutan ke-' + target + ' adalah ' + (slope * target ** power + offset) + '.');
}

// ---- Kecukupan data (2027 PDF 44–47) -------------------------------------------------------------------------------------------------
type DataModel = Extract<Model, { kind: 'data' }>;
type World = { x: number; y: number };
const holds = (c: Condition, { x, y }: World) => c.op === 'xGt' ? x > c.value : c.op === 'yGt' ? y > c.value :
  (c.op === 'x' ? x : c.op === 'y' ? y : c.op === 'sum' ? x + y : c.op === 'difference' ? x - y : x * y) === c.value;
const texCondition = (c: Condition) => c.op === 'xGt' ? 'x>' + c.value : c.op === 'yGt' ? 'y>' + c.value :
  (c.op === 'x' ? 'x' : c.op === 'y' ? 'y' : c.op === 'sum' ? 'x+y' : c.op === 'difference' ? 'x-y' : 'xy') + '=' + c.value;
const TARGET = { x: 'x', sum: 'x+y', product: 'xy' } as const;
const LISTED = 8;

function analyse(model: DataModel) {
  const worlds: World[] = [];
  for (let x = 1; x <= model.domain; x++) for (let y = 1; y <= model.domain; y++) worlds.push({ x, y });
  const valueOf = ({ x, y }: World) => model.target === 'x' ? x : model.target === 'sum' ? x + y : x * y;
  const satisfy = (conditions: Condition[]) => worlds.filter((w) => conditions.every((c) => holds(c, w)));
  const sets = { first: satisfy(model.first), second: satisfy(model.second), both: satisfy([...model.first, ...model.second]) };
  const decided = (list: World[]) => new Set(list.map(valueOf)).size === 1;
  return { valueOf, sets, first: decided(sets.first), second: decided(sets.second), both: decided(sets.both) };
}
// Kategori dari hasil pengujian sendiri; bunyi opsinya dicari di DATA_LABELS (tidak mengandalkan huruf atau urutan).
export function dataOutcome(model: DataModel): { label: string; first: boolean; second: boolean; both: boolean } {
  const { first, second, both, sets } = analyse(model);
  if (!sets.first.length || !sets.second.length || !sets.both.length) throw new Error('Pernyataan kecukupan data tidak konsisten.');
  const label = first && second ? DATA_LABELS[3] : first ? DATA_LABELS[0] : second ? DATA_LABELS[1] : both ? DATA_LABELS[2] : DATA_LABELS[4];
  if (DATA_LABELS.indexOf(label) !== dataCategory(model)) throw new Error('Kategori kecukupan data berbeda dari solver.');
  return { label, first, second, both };
}

export function dataExplanation(model: DataModel): string {
  const { valueOf, sets, first, second, both } = analyse(model);
  const target = TARGET[model.target], name = inline(target), pair = inline('(x,y)');
  const set = (list: World[]) => inline('\\{' + list.map((w) => '(' + w.x + ',' + w.y + ')').join(',') + '\\}');
  const example = (list: World[]) => {
    const one = list[0], other = list.find((w) => valueOf(w) !== valueOf(one))!;
    const show = (w: World) => inline('x=' + w.x + ',\\;y=' + w.y) + ', maka nilai ' + name + ' adalah ' + valueOf(w);
    return 'Misalnya: ' + show(one) + '. Namun, bisa juga: ' + show(other) + '. Nilai ' + name + ' tidak tunggal.';
  };
  const verdict = (list: World[], decided: boolean) => decided ? [list.length === 1 ? 'Hanya ada satu pasangan, sehingga nilai ' + name + ' adalah ' + valueOf(list[0]) + '.' :
    'Semua pasangan menghasilkan nilai ' + name + ' yang sama, yaitu ' + valueOf(list[0]) + '.'] : [example(list)];
  const statement = (index: number, conditions: Condition[], list: World[], decided: boolean) => {
    const direct = conditions.length === 1 && ((conditions[0].op === 'x' && model.target === 'x') || (conditions[0].op === 'sum' && model.target === 'sum') || (conditions[0].op === 'product' && model.target === 'product'));
    return [
      'Pernyataan (' + index + '):', ...conditions.map((c) => display(texCondition(c))),
      ...(direct ? ['Nilai ' + name + ' langsung diketahui, yaitu ' + valueOf(list[0]) + '.'] : [
        list.length <= LISTED ? 'Pasangan bilangan bulat positif ' + pair + ' yang memenuhi: ' + set(list) + '.' : 'Terdapat ' + list.length + ' pasangan bilangan bulat positif ' + pair + ' (paling besar ' + model.domain + ') yang memenuhi.',
        ...verdict(list, decided)]),
      'Pernyataan (' + index + ') SAJA ' + (decided ? 'cukup.' : 'tidak cukup.'),
    ];
  };
  const parts = [statement(1, model.first, sets.first, first), statement(2, model.second, sets.second, second)];
  if (!first && !second) {
    const firstSmaller = sets.first.length <= sets.second.length;
    const base = firstSmaller ? sets.first : sets.second, from = firstSmaller ? 1 : 2, other = firstSmaller ? 2 : 1;
    parts.push([
      'Pernyataan (1) dan (2) bersama-sama:', 'Diketahui:', ...[...model.first, ...model.second].map((c) => display(texCondition(c))),
      ...(base.length <= LISTED ? ['Pasangan yang memenuhi (' + from + '): ' + set(base) + '.', 'Dari pasangan tersebut, yang juga memenuhi (' + other + ') adalah: ' + set(sets.both) + '.'] :
        [sets.both.length <= LISTED ? 'Pasangan yang memenuhi (1) dan (2) sekaligus: ' + set(sets.both) + '.' : 'Terdapat ' + sets.both.length + ' pasangan ' + pair + ' yang memenuhi (1) dan (2) sekaligus.']),
      ...verdict(sets.both, both),
      both ? 'Jadi, kedua pernyataan bersama-sama cukup untuk menentukan nilai ' + name + ', tetapi masing-masing pernyataan saja tidak cukup.' :
        'Jadi, kedua pernyataan bersama-sama tetap tidak cukup untuk menentukan nilai ' + name + '.',
    ]);
  }
  return parts.map((lines) => lines.join('\n')).join('\n\n');
}
