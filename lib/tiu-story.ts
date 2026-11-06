// Penyusun pembahasan soal cerita numerik menurut Panduan Produksi Soal TIU JadiASN, bagian 3 (PDF 80–133): perbandingan senilai/berbalik (3.1),
// polemik proyek dengan rumus WOWO (3.2), rata-rata (3.4), JKW (3.5), VDW (3.6), dan aritmatika sosial Haji Miu (3.7). Semua fungsi murni dan
// menerima nilai antara yang disimpan generator; keluarannya string pembahasan berstruktur (lib/explanation.ts). Penutup "Jadi, jawaban yang benar
// adalah {kunci}." memakai penanda yang diisi saat tampil. Contoh panduan yang keliru (PDF 82, 94–97) tidak disalin: semua angka dihitung ulang.
import { KEY_MARK, aligned, boxLines, bullet, inline, tableLines } from './explanation';
import type { Rng } from './rng';
import { num, tex } from './tiu-explain';
import { guideLine } from './guide-images';
import { mark as richMark } from './richtext';

// Panduan menulis persamaan rata kiri, jadi satu baris pun memakai aligned (bukan persamaan di tengah).
const display = (latex: string) => aligned([latex]);
const join = (...lines: string[]) => lines.join('\n');
const CLOSE = 'Jadi, jawaban yang benar adalah ' + KEY_MARK + '.';
const unit = (value: string) => '\\text{ ' + value + '}';
const rp = (value: number) => '\\text{Rp}' + String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const frac = (top: number | string, bottom: number | string) => '\\frac{' + top + '}{' + bottom + '}';
const DOT = '\\cdot ';

// ---- 3.5 JKW (segitiga J / K W) dan 3.6 VDW (Vas DeWi: V / D W) ---------------------------------------------------------------
const triangle = (top: string) => [guideLine(top === 'J' ? 'segitiga-jkw' : 'segitiga-vdw')];
// Pemisah ribuan titik untuk bilangan bulat besar ("14.400"); bilangan kecil atau desimal apa adanya.
export const big = (value: number) => Number.isInteger(value) ? String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : tex(value);
// Waktu diberikan dalam menit sedangkan kecepatan dalam km/jam: satuan disamakan dahulu (W dalam jam), baru J = K × W.
export function jkwExplanation(speed: number, minutes: number): string {
  const time = minutes / 60, distance = speed * time;
  return join(
    'Diketahui:', inline('K=' + tex(speed) + unit('km/jam')), inline('W=' + tex(minutes) + unit('menit')), '',
    'Ditanyakan:', inline('J=\\,?'), '',
    'INGAT:', ...triangle('J'), '',
    'Samakan satuan waktu dengan satuan kecepatan (km/jam):',
    aligned(['W=' + frac(minutes, 60), '=' + tex(time) + unit('jam')]), '',
    aligned(['J=K\\times W', 'J=' + tex(speed) + '\\times ' + tex(time), 'J=' + big(distance) + unit('km')]),
    'Jadi, jarak yang ditempuh kendaraan adalah ' + big(distance).replace(/\{,\}/g, ',') + ' km.', CLOSE);
}
// Debit dalam liter/menit sedangkan waktu dalam jam: waktu diubah ke menit lebih dahulu.
export function vdwExplanation(flow: number, hours: number): string {
  const minutes = hours * 60, volume = flow * minutes;
  return join(
    'Diketahui:', inline('D=' + tex(flow) + unit('liter/menit')), inline('W=' + tex(hours) + unit('jam')), '',
    'Ditanyakan:', inline('V=\\,?'), '',
    'INGAT:', richMark.bold('{merah:V}as {merah:D}e{merah:W}i'), '', ...triangle('V'), '',
    'Samakan satuan waktu dengan satuan debit (liter/menit):',
    aligned(['W=' + tex(hours) + '\\times 60', '=' + tex(minutes) + unit('menit')]), '',
    aligned(['V=D\\times W', '=' + tex(flow) + '\\times ' + tex(minutes), '=' + big(volume) + unit('liter')]),
    'Jadi, volume air yang dialirkan adalah ' + big(volume) + ' liter.');
}

// ---- 3.4 Rata-rata -----------------------------------------------------------------------------------------------------------------------
const sumOf = (symbol: string, count: number) => count <= 6 ? Array.from({ length: count }, (_, i) => symbol + '_{' + (i + 1) + '}').join('+') :
  symbol + '_{1}+' + symbol + '_{2}+' + symbol + '_{3}+\\dots+' + symbol + '_{' + count + '}';
// Perubahan data (3.4.4, PDF 112–113): satu nilai ditambahkan.
export function rataBaruExplanation(count: number, mean: number, value: number): string {
  const total = count * mean, newTotal = total + value, newCount = count + 1, result = newTotal / newCount;
  return join(
    'Diketahui:', 'Rata-rata awal = ' + num(mean), 'Banyak data awal = ' + count, 'Satu nilai ' + num(value) + ' dimasukkan', '',
    'Ditanyakan:', 'Rata-rata nilai yang baru.', '',
    'Rumus Dasar:', display(frac(sumOf('x', count), count) + '=' + tex(mean)), '',
    'Penyelesaian:', 'Cari jumlah nilai awal dari rumus dasar:',
    aligned([frac(sumOf('x', count), count) + '=' + tex(mean), sumOf('x', count) + '=' + tex(mean) + DOT + count]),
    'Jumlah nilai awal = ' + num(total), '',
    'Sesuaikan jumlah nilai setelah perubahan:', 'Jumlah nilai baru = ' + num(total) + ' + ' + num(value), 'Jumlah nilai baru = ' + num(newTotal), '',
    'Banyak data baru:', 'Banyak data baru = ' + count + ' + 1', 'Banyak data baru = ' + newCount, '',
    'Hitung rata-rata baru:',
    aligned(['\\text{Rata-rata baru}=' + frac('\\text{jumlah nilai baru}', '\\text{banyak data baru}'), '=' + frac(tex(newTotal), newCount), '=' + tex(result)]), '',
    'Kesimpulan:', 'Jadi, rata-rata nilai yang baru adalah ' + num(result) + '. Jawaban yang benar adalah ' + KEY_MARK + '.');
}
// Rata-rata gabungan (3.4.3, PDF 110–111).
export function rataGabunganExplanation(sizeA: number, meanA: number, sizeB: number, meanB: number): string {
  const totalA = sizeA * meanA, totalB = sizeB * meanB, size = sizeA + sizeB, result = (totalA + totalB) / size;
  const group = (name: string, symbol: string, n: number, mean: number, total: number) => [
    'Cari jumlah nilai kelompok ' + name + ' dari rumus dasar:',
    aligned([frac(sumOf(symbol, n), n) + '=' + tex(mean), sumOf(symbol, n) + '=' + tex(mean) + DOT + n]),
    'Jumlah nilai kelompok ' + name + ' = ' + num(total), ''];
  return join(
    'Diketahui:', 'Kelompok A: ' + sizeA + ' peserta, rata-rata ' + num(meanA), 'Kelompok B: ' + sizeB + ' peserta, rata-rata ' + num(meanB), '',
    'Ditanyakan:', 'Rata-rata gabungan kedua kelompok.', '',
    'Rumus Dasar:', 'Rata-rata = jumlah data : banyak data', '',
    'Penyelesaian:', ...group('A', 'a', sizeA, meanA, totalA), ...group('B', 'b', sizeB, meanB, totalB),
    'Gabungkan seluruh jumlah nilai dan seluruh peserta:',
    aligned(['\\text{Rata-rata gabungan}=' + frac(tex(totalA) + '+' + tex(totalB), sizeA + '+' + sizeB), '=' + frac(tex(totalA + totalB), size), '=' + tex(result)]), '',
    'Kesimpulan:', 'Jadi, rata-rata gabungan kedua kelompok adalah ' + num(result) + '. Jawaban yang benar adalah ' + KEY_MARK + '.');
}

// ---- 3.7 Aritmatika sosial: Haji Miu (PDF 122–129) -------------------------------------------------------------------------
const MIU_BOX = boxLines([
  '\\(HJ=M(1+u)\\to\\mathbf{HaJi\\ MIu}\\)', 'dengan',
  bullet(inline('HJ') + ' = harga jual / harga akhir / nilai akhir'), bullet(inline('M') + ' = modal / harga beli / harga awal / nilai awal'),
  bullet(inline('u') + ' = persentase perubahan dalam bentuk desimal')]);
const sign = (percent: number) => percent < 0 ? '-' : '+';
// Satu tahap Haji Miu: HJ = M(1 + u) dengan u berupa persen (negatif untuk diskon atau rugi). `from` dan `to` nama besaran awal dan akhir.
function miuRows(base: number, percent: number, from: string, to: string): { rows: string[]; result: number } {
  const factor = 1 + percent / 100, result = Math.round(base * factor * 100) / 100, p = Math.abs(percent);
  return { result, rows: [to + '=' + from + '(1+u)', '=' + rp(base) + '(1' + sign(percent) + tex(p) + '\\%)', '=' + rp(base) + '(1' + sign(percent) + tex(p / 100) + ')', '=' + rp(base) + '(' + tex(factor) + ')', '=' + rp(result)] };
}
export function diskonExplanation(price: number, percent: number): string {
  const { rows } = miuRows(price, -percent, 'M', 'HJ');
  return join('Ingat rumus:', ...MIU_BOX, '', inline('u=-' + tex(percent) + '\\%') + ' karena harga berkurang (diskon)', aligned(rows));
}
// Persentase bertahap (3.7.3): diskon, lalu pajak atas harga setelah diskon; tiap tahap memakai nilai terbaru dari tahap sebelumnya.
export function bertahapExplanation(price: number, discount: number, tax: number): string {
  const first = miuRows(price, -discount, 'M', 'HJ_1'), second = miuRows(first.result, tax, 'HJ_1', 'HJ_2');
  return join('Ingat rumus:', ...MIU_BOX, '',
    'Tahap 1, diskon ' + discount + '%: ' + inline('u_1=-' + tex(discount) + '\\%') + ' karena harga berkurang', aligned(first.rows.map((row, i) => i ? row : 'HJ_1=M(1+u_1)')), '',
    'Tahap 2, pajak ' + tax + '% dikenakan atas harga setelah diskon: ' + inline('u_2=+' + tex(tax) + '\\%') + ' karena harga bertambah',
    aligned(second.rows.map((row, i) => i ? row : 'HJ_2=HJ_1(1+u_2)')));
}

// ---- 3.1 Perbandingan senilai dan berbalik (PDF 80–82) -------------------------------------------------------------------------
export type Pair = { first: string; second: string };
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : Math.abs(a);
// x1 -> y1, x2 -> y2 (x2 = nilai baru, y2 = yang dicari). `middle` = kalimat perubahan ("Terdapat tambahan 10 sapi, sehingga 50 + 10 = 60 sapi"),
// `what` = frasa besaran kedua untuk kalimat "*Lihat bahwa ...". Senilai x1/x2 = y1/y2, berbalik x1/x2 = y2/y1; jawabannya dihitung ulang
// (contoh berbalik PDF 82 memuat 40 hari vs 10 hari dan tidak disalin).
export function perbandinganExplanation(kind: 'senilai' | 'berbalik', names: Pair, x1: number, y1: number, x2: number, y2: number, middle: string, what: string): string {
  const row = (x: number | string, y: number | string) => x + ' ' + names.first + ' → ' + y + ' ' + names.second;
  const up = x2 > x1, secondUp = kind === 'senilai' ? up : !up, g = gcd(x1, x2), answer = tex(y2) + unit(names.second);
  const arrow = (more: boolean) => more ? '(↑)' : '(↓)';
  const senilai = [frac(x1, x2) + '=' + frac(y1, 'x'), 'x=' + y1 + DOT + frac(x2, x1)];
  if (g > 1 && x1 / g > 1) { senilai.push('x=' + y1 + DOT + frac(x2 / g, x1 / g)); if (y1 % (x1 / g) === 0) senilai.push('x=' + tex(y1 / (x1 / g)) + DOT + tex(x2 / g)); }
  senilai.push('x=' + answer);
  const berbalik = [frac(x1, x2) + '=' + frac('x', y1), 'x=' + frac(x1, x2) + DOT + y1, 'x=' + frac(tex(x1 * y1), x2), 'x=' + answer];
  return join(
    row(x1, y1), middle, row(x2, 'x'),
    '*Lihat bahwa jika ' + names.first + ' ' + (up ? 'bertambah' : 'berkurang') + ' ' + arrow(up) + ', maka ' + what + ' ' + (kind === 'senilai' ? 'juga ' : '') + 'akan ' + (secondUp ? 'bertambah' : 'berkurang') + ' ' + arrow(secondUp), '',
    'Maka digunakanlah perbandingan ' + (kind === 'senilai' ? 'senilai' : 'berbalik') + ':', row(x1, y1), row(x2, 'x'), aligned(kind === 'senilai' ? senilai : berbalik));
}
// Pembagian menurut perbandingan a : b (tidak ada contoh di panduan; memakai kerangka rata-rata: Diketahui sampai Kesimpulan).
export function rasioExplanation(a: number, b: number, total: number, thing: string): string {
  const parts = a + b, answer = total * a / parts;
  return join(
    'Diketahui:', 'Perbandingan A : B = ' + a + ' : ' + b, 'Total ' + thing + ' = ' + total, '',
    'Ditanyakan:', 'Banyak ' + thing + ' kelompok A.', '',
    'Rumus Dasar:', display('\\text{Bagian A}=' + frac('\\text{perbandingan A}', '\\text{jumlah perbandingan}') + '\\times\\text{total}'), '',
    'Penyelesaian:', 'Jumlah perbandingan = ' + a + ' + ' + b + ' = ' + parts,
    aligned(['\\text{Bagian A}=' + frac(a, parts) + '\\times ' + total, '=' + tex(answer)]), '',
    'Kesimpulan:', 'Jadi, banyak ' + thing + ' kelompok A adalah ' + num(answer) + '. Jawaban yang benar adalah ' + KEY_MARK + '.');
}

// ---- 3.2 Polemik proyek: rumus WOWO (PDF 83–97) --------------------------------------------------------------------------------
export type WowoKind = 'sakit-balik-pekerja' | 'sakit-balik-hari' | 'sakit-tidak-balik' | 'kontrak' | 'mangkrak';
// Nilai antara yang disimpan saat membangkitkan soal. T = hari rencana, P = pekerja rencana, a = hari berjalan sebelum gangguan,
// H = lama gangguan (hari), S = pekerja sakit, Pt/Tt = pekerja kontrak dan lamanya, M = hari proyek berhenti. `condition` = kalimat kondisi soal.
export type Wowo = { kind: WowoKind; T: number; P: number; a: number; H?: number; S?: number; Pt?: number; Tt?: number; M?: number; condition: string };
export type WowoSolution = { phases: { w: number | 'x'; o: number | string }[]; x: number; answer: number };
// Penyelesaian aljabar tiap subjenis; `x` = nilai yang dicari pada tahap terakhir, `answer` = jawaban soal.
export function wowoSolve(p: Wowo): WowoSolution {
  const { T, P, a } = p;
  if (p.kind === 'sakit-balik-pekerja') { const H = p.H!, S = p.S!, rest = T - a - H, x = ((T - a) * P - H * (P - S)) / rest; return { phases: [{ w: a, o: P }, { w: H, o: P - S }, { w: rest, o: 'x' }], x, answer: x - P }; }
  if (p.kind === 'sakit-balik-hari') { const H = p.H!, S = p.S!, x = ((T - a) * P - H * (P - S)) / P; return { phases: [{ w: a, o: P }, { w: H, o: P - S }, { w: 'x', o: P }], x, answer: a + H + x - T }; }
  if (p.kind === 'sakit-tidak-balik') { const S = p.S!, x = (T - a) * P / (P - S); return { phases: [{ w: a, o: P }, { w: 'x', o: P - S }], x, answer: a + x - T }; }
  if (p.kind === 'kontrak') { const Pt = p.Pt!, Tt = p.Tt!, x = ((T - a) * P - Tt * (P + Pt)) / P; return { phases: [{ w: a, o: P }, { w: Tt, o: P + Pt }, { w: 'x', o: P }], x, answer: a + Tt + x }; }
  const M = p.M!, rest = T - a - M, x = (T - a) * P / rest - P;
  return { phases: [{ w: a, o: P }, { w: M, o: 0 }, { w: rest, o: 'P+x' }], x, answer: x };
}
const mark = (value: string) => richMark.bold(richMark.color('merah', value)); // nilai W/O merah dan tebal sesuai panduan
const NOT_DONE = '\\to\\mathbf{BELUM\\ SELESAI!}';
const QUICK_TABLE = tableLines({ headers: ['', 'Pekerja', 'Hari'], rows: [
  ['Sakit balik lagi', inline(frac('Sa\\cdot Ha', 'Si')), inline(frac('Sa\\cdot Ha', 'P'))], ['Sakit tidak balik lagi', '−', inline(frac('P\\cdot Si', 'Se'))],
  ['Pekerja kontrak', '−', inline('T_{tot}-' + frac('P_t', 'P') + 'T_t')], ['Proyek mangkrak', inline(frac('(T-F-S)P', 'S')), '−']] });
const daySpan = (from: number, to: number | string) => 'Hari ' + from + ' sampai ' + to;

export function wowoExplanation(p: Wowo): string {
  const { T, P, a } = p, s = wowoSolve(p), x = s.x, ph = s.phases;
  // Tabel realisasi: tiap tahap dengan rentang hari, W (hari), dan O (orang).
  const rows: string[][] = [];
  let day = 1;
  const note = (label: string, w: number | 'x', o: string) => { const last = w === 'x' ? 'selesai' : day + w - 1; rows.push([label ? label : daySpan(day, last), w === 'x' ? mark('x hari') : mark(w + ' hari'), o]); if (w !== 'x') day += w; };
  const orang = (o: number | string) => o === 'x' ? mark('x orang') : o === 'P+x' ? mark(P + ' + x orang') : mark(o + ' orang');
  // Sel O: nilai yang dipakai pada rumus disorot; sel keterangan (hitungan jumlah pekerja) ditulis polos seperti contoh panduan.
  const explainO: Record<WowoKind, string[]> = {
    'sakit-balik-pekerja': [orang(P), p.S + ' pekerja sakit, jadi ' + P + ' − ' + p.S + ' = ' + orang(P - p.S!), orang('x')],
    'sakit-balik-hari': [orang(P), p.S + ' pekerja sakit, jadi ' + P + ' − ' + p.S + ' = ' + orang(P - p.S!), 'Pekerja sakit kembali bekerja, jadi lengkap ' + orang(P)],
    'sakit-tidak-balik': [orang(P), p.S + ' pekerja sakit, jadi ' + P + ' − ' + p.S + ' = ' + orang(P - p.S!)],
    'kontrak': [orang(P), 'Ditambah ' + p.Pt + ' pekerja baru, jadi ' + P + ' + ' + p.Pt + ' = ' + orang(P + p.Pt!), 'Pekerja kontrak selesai, jadi kembali ' + orang(P)],
    'mangkrak': [orang(P), 'Proyek berhenti, jadi tidak ada yang bekerja = ' + orang(0), orang('P+x')],
  };
  ph.forEach((phase, i) => note('', phase.w, explainO[p.kind][i]));
  // Rumus WOWO: W · O = Σ Wi · Oi, lalu substitusi dan penyelesaian langkah demi langkah.
  const sumRow = 'W\\cdot O=' + ph.map((_, i) => 'W_' + (i + 1) + '\\cdot O_' + (i + 1)).join('+');
  const head = ['W\\cdot O=\\sum_{i=1}^{n}W_i\\cdot O_i', sumRow];
  const n = (value: number | string) => String(value);
  let equations: string[], finish: string[], unitX = p.kind === 'sakit-balik-pekerja' || p.kind === 'mangkrak' ? unit('orang') : unit('hari');
  if (p.kind === 'mangkrak') {
    const M = p.M!, rest = T - a - M, A = T - a;
    equations = [...head, n(T) + '\\cdot ' + P + '=' + a + '\\cdot ' + P + '+' + M + '\\cdot 0+' + rest + '\\cdot (' + P + '+x)',
      n(T) + '\\cdot ' + P + '-' + a + '\\cdot ' + P + '-' + M + '\\cdot 0=' + rest + '\\cdot (' + P + '+x)', '(' + T + '-' + a + ')\\cdot ' + P + '=' + rest + '\\cdot (' + P + '+x)',
      A + '\\cdot ' + P + '=' + rest + '\\cdot (' + P + '+x)', frac(A + '\\cdot ' + P, rest) + '=' + P + '+x', tex(A * P / rest) + '=' + P + '+x', 'x=' + tex(A * P / rest) + '-' + P, 'x=' + tex(x) + unitX];
  } else if (ph.length === 2) {
    const o2 = P - p.S!, A = T - a;
    equations = [...head, n(T) + '\\cdot ' + P + '=' + a + '\\cdot ' + P + '+x\\cdot ' + o2, n(T) + '\\cdot ' + P + '-' + a + '\\cdot ' + P + '=x\\cdot ' + o2, '(' + T + '-' + a + ')\\cdot ' + P + '=' + o2 + 'x',
      A + '\\cdot ' + P + '=' + o2 + 'x', tex(A * P) + '=' + o2 + 'x', 'x=' + frac(tex(A * P), o2), 'x=' + tex(x) + unitX + NOT_DONE];
  } else {
    // Tiga tahap: pekerja rencana pada tahap pertama, tahap kedua (gangguan), tahap ketiga memuat yang dicari (hari atau orang).
    const w1 = ph[0].w as number, w2 = ph[1].w as number, o2 = ph[1].o as number, last = ph[2], A = T - w1;
    const lastTerm = last.w === 'x' ? 'x\\cdot ' + P : last.w + '\\cdot x', B = last.w === 'x' ? P : (last.w as number), Bx = B + 'x', N = A * P - w2 * o2;
    equations = [...head, n(T) + '\\cdot ' + P + '=' + w1 + '\\cdot ' + P + '+' + w2 + '\\cdot ' + o2 + '+' + lastTerm, n(T) + '\\cdot ' + P + '-' + w1 + '\\cdot ' + P + '-' + w2 + '\\cdot ' + o2 + '=' + lastTerm,
      '(' + T + '-' + w1 + ')\\cdot ' + P + '-' + w2 + '\\cdot ' + o2 + '=' + Bx, A + '\\cdot ' + P + '-' + w2 + '\\cdot ' + o2 + '=' + Bx, tex(A * P) + '-' + tex(w2 * o2) + '=' + Bx, tex(N) + '=' + Bx,
      'x=' + frac(tex(N), B), 'x=' + tex(x) + unitX + (last.w === 'x' ? NOT_DONE : '')];
  }
  const days = ph.map((phase) => phase.w === 'x' ? tex(x) : tex(phase.w as number));
  const total = (symbols: string) => display(symbols + '=' + days.join('+') + '=' + tex(ph.reduce((sum, phase) => sum + (phase.w === 'x' ? x : (phase.w as number)), 0)) + unit('hari'));
  const symbols = ph.map((_, i) => 'W_' + (i + 1)).join('+');
  const totalDays = ph.reduce((sum, phase) => sum + (phase.w === 'x' ? x : (phase.w as number)), 0);
  if (p.kind === 'sakit-balik-pekerja') finish = ['Tambahan pekerja', display('=x-O=' + tex(x) + '-' + P + '=' + tex(s.answer) + unit('orang')), CLOSE];
  else if (p.kind === 'sakit-balik-hari' || p.kind === 'sakit-tidak-balik') finish = ['Total realisasi hari (karena ditanyakan tambahan hari)', total(symbols), '', 'Tambahan hari', display('\\text{Total realisasi hari}-W=' + tex(totalDays) + '-' + T + '=' + tex(s.answer) + unit('hari')), CLOSE];
  else if (p.kind === 'kontrak') finish = ['Total realisasi hari', total(symbols), CLOSE];
  else finish = [CLOSE];
  const condition = p.condition;
  // Rumus Cepat: tabel pilihan rumus, lalu rumus subjenis ini dengan angka soal.
  const quick: string[] = (() => {
    const label = { 'sakit-balik-pekerja': 'Pekerja sakit tapi balik lagi', 'sakit-balik-hari': 'Pekerja sakit tapi balik lagi', 'sakit-tidak-balik': 'Pekerja sakit dan tidak balik lagi', kontrak: 'Pekerja kontrak', mangkrak: 'Proyek mangkrak' }[p.kind];
    const lead = [condition + ' → ' + label, ...QUICK_TABLE, ''];
    if (p.kind === 'sakit-balik-pekerja') { const H = p.H!, S = p.S!, rest = T - a - H; return [...lead, display('\\text{tambahan pekerja}=' + frac('Sa\\cdot Ha', 'Si')), inline('Sa') + ' : Sakit (orang)', inline('Ha') + ' : Hari sakit (berapa lama sakit)', inline('Si') + ' : Sisa hari',
      display('\\text{tambahan pekerja}=' + frac('Sa\\cdot Ha', 'Si') + '=' + frac(S + '\\cdot ' + H, rest) + '=' + tex(S * H / rest)), CLOSE]; }
    if (p.kind === 'sakit-balik-hari') { const H = p.H!, S = p.S!; return [...lead, display('\\text{tambahan hari}=' + frac('Sa\\cdot Ha', 'P')), inline('Sa') + ' : Sakit (orang)', inline('Ha') + ' : Hari sakit (berapa lama sakit)', inline('P') + ' : Pekerja awal',
      display('\\text{tambahan hari}=' + frac('Sa\\cdot Ha', 'P') + '=' + frac(S + '\\cdot ' + H, P) + '=' + tex(S * H / P)), CLOSE]; }
    if (p.kind === 'sakit-tidak-balik') { const S = p.S!, rest = T - a; return [...lead, display('H=' + frac('P\\cdot Si', 'Se')), inline('P') + ' : Pekerja awal', inline('Si') + ' : Sisa hari', inline('Se') + ' : Sehat (jumlah orang sehat)',
      display('H=' + frac('P\\cdot Si', 'Se') + '=' + frac(P + '\\cdot ' + rest, P - S) + '=' + tex(x)), display('\\text{tambahan hari}=H+W_1-W=' + tex(x) + '+' + a + '-' + T + '=' + tex(s.answer)), CLOSE]; }
    if (p.kind === 'kontrak') { const Pt = p.Pt!, Tt = p.Tt!; return [...lead, display('T_{tot}-' + frac('P_t', 'P') + 'T_t'), inline('T_{tot}') + ' : Waktu rencana total', inline('P_t') + ' : Pekerja tambahan (kontrak)', inline('P') + ' : Pekerja awal', inline('T_t') + ' : Waktu tambahan',
      // Pt/P bulat: kalikan langsung (seperti panduan); bila tidak, hasil kali Pt·Tt dibagi P dahulu agar tidak ada pembulatan desimal.
      aligned(['T_{tot}-' + frac('P_t', 'P') + 'T_t', '=' + T + '-' + frac(Pt, P) + '\\cdot ' + Tt, ...(Pt % P === 0 ? ['=' + T + '-' + tex(Pt / P) + '\\cdot ' + Tt] : ['=' + T + '-' + frac(Pt + '\\cdot ' + Tt, P)]), '=' + T + '-' + tex(Pt * Tt / P) + '=' + tex(s.answer)]), CLOSE]; }
    const M = p.M!, rest = T - a - M;
    return [...lead, display(frac('(T-F-S)P', 'S')), 'Ingat: kena {merah:T}i{merah:F}u{merah:S} gara-gara main {merah:PS}', inline('T') + ' : Total hari', inline('F') + ' : Finish', inline('S') + ' : Sisa hari', inline('P') + ' : Pekerja awal',
      aligned([frac('(T-F-S)P', 'S') + '=' + frac(T + '-' + a + '-' + rest, rest) + '\\cdot ' + P, '=' + frac(M, rest) + '\\cdot ' + P, '=' + tex(M * P / rest)]), CLOSE];
  })();
  return join('Rumus Konsep:', 'Rencana:', inline('W\\to O'), T + ' hari → ' + P + ' orang', '',
    'Realisasi:', condition + ' Maka:', ...tableLines({ headers: ['', inline('W'), inline('O')], rows }), '',
    'RUMUS WOWO', aligned(equations), '', ...finish, '', 'Rumus Cepat:', ...quick);
}

// ---- Pembangkit soal polemik proyek ---------------------------------------------------------------------------------------------------
// Angka dicari dengan undian berulang sampai semua nilai antara bulat dan positif (panduan: angka bersih, perhitungan cepat). Bila tidak ada
// yang lolos, contoh panduan (dengan angka yang sudah diperiksa) dipakai.
const KINDS: WowoKind[] = ['sakit-balik-pekerja', 'sakit-balik-hari', 'sakit-tidak-balik', 'kontrak', 'mangkrak'];
const FALLBACK: Record<WowoKind, Wowo> = {
  'sakit-balik-pekerja': { kind: 'sakit-balik-pekerja', T: 40, P: 50, a: 20, H: 4, S: 8, condition: '' },
  'sakit-balik-hari': { kind: 'sakit-balik-hari', T: 16, P: 8, a: 5, H: 8, S: 3, condition: '' },
  'sakit-tidak-balik': { kind: 'sakit-tidak-balik', T: 60, P: 42, a: 12, S: 6, condition: '' },
  kontrak: { kind: 'kontrak', T: 50, P: 12, a: 15, Pt: 24, Tt: 5, condition: '' },
  mangkrak: { kind: 'mangkrak', T: 24, P: 15, a: 12, M: 7, condition: '' },
};
const whole = (value: number) => Number.isInteger(value);
function draw(kind: WowoKind, r: Rng): Wowo | undefined {
  if (kind === 'sakit-balik-pekerja') {
    const P = r.pick([20, 24, 30, 40, 45, 50, 60]), T = r.pick([24, 30, 36, 40, 48, 60]), a = r.int(6, Math.floor(T * 0.6)), H = r.int(2, 8), S = r.int(2, 12), rest = T - a - H;
    if (rest < 6 || S * 2 >= P || (H * S) % rest !== 0 || H * S / rest > 10) return undefined;
    return { kind, T, P, a, H, S, condition: 'Memasuki hari ke-' + (a + 1) + ' ada ' + S + ' pekerja jatuh sakit selama ' + H + ' hari.' };
  }
  if (kind === 'sakit-balik-hari') {
    const P = r.pick([6, 8, 10, 12, 15, 20, 24, 30]), T = r.pick([16, 20, 24, 30, 36, 40]), a = r.int(3, Math.floor(T / 2)), H = r.int(3, 10), S = r.int(2, Math.max(2, Math.floor(P / 2)));
    if (S >= P || (H * S) % P !== 0 || H * S / P > 6 || T - a - H * (P - S) / P < 2) return undefined;
    return { kind, T, P, a, H, S, condition: 'Di hari ke-' + (a + 1) + ', ada ' + S + ' orang pekerja yang sakit tidak bisa bekerja dan baru bekerja lagi ' + H + ' hari setelahnya.' };
  }
  if (kind === 'sakit-tidak-balik') {
    const P = r.pick([36, 40, 42, 45, 48, 50, 60]), T = r.pick([48, 60, 72, 80, 90]), a = r.int(6, Math.floor(T / 2)), S = r.int(2, 12);
    if (S * 3 >= P || ((T - a) * P) % (P - S) !== 0) return undefined;
    const extra = a + (T - a) * P / (P - S) - T;
    if (extra < 1 || extra > 20) return undefined;
    return { kind, T, P, a, S, condition: 'Setelah bekerja selama ' + a + ' hari, ' + S + ' orang pekerja sakit dan tidak melanjutkan pekerjaan.' };
  }
  if (kind === 'kontrak') {
    const P = r.pick([10, 12, 15, 20, 24, 25]), Pt = r.int(6, 40), Tt = r.int(2, 8), T = r.pick([30, 40, 45, 50, 60]), a = r.int(5, Math.floor(T / 2));
    if ((Tt * Pt) % P !== 0 || T - a - Tt - Tt * Pt / P < 3) return undefined;
    return { kind, T, P, a, Pt, Tt, condition: 'Setelah bekerja selama ' + a + ' hari, kepala desa menambahkan pekerja dari kampung sebelah sebanyak ' + Pt + ' orang selama ' + Tt + ' hari.' };
  }
  const P = r.pick([12, 15, 18, 20, 24, 30, 36]), T = r.pick([20, 24, 30, 36, 40, 48]), a = r.int(4, Math.floor(T / 2)), M = r.int(3, 10), rest = T - a - M;
  if (rest < 3 || (M * P) % rest !== 0 || M * P / rest > 2 * P) return undefined;
  return { kind: 'mangkrak', T, P, a, M, condition: 'Setelah dikerjakan ' + a + ' hari, pekerjaan dihentikan selama ' + M + ' hari.' };
}
function stemOf(p: Wowo): string {
  const { T, P } = p;
  if (p.kind === 'sakit-balik-pekerja') return 'Suatu proyek dijadwalkan selesai dalam ' + T + ' hari dengan ' + P + ' pekerja. ' + p.condition + ' Agar proyek selesai tepat waktu, berapa pekerja yang harus ditambahkan?';
  if (p.kind === 'sakit-balik-hari') return 'Suatu pekerjaan akan selesai dalam waktu ' + T + ' hari dengan ' + P + ' orang pekerja. ' + p.condition + ' Berapakah tambahan hari agar pekerjaan tersebut selesai?';
  if (p.kind === 'sakit-tidak-balik') return 'Untuk menyelesaikan sebuah waduk, dibutuhkan ' + T + ' hari dan ' + P + ' orang pekerja. ' + p.condition + ' Berapa tambahan hari yang dibutuhkan untuk menyelesaikan waduk tersebut?';
  if (p.kind === 'kontrak') return 'Pembangunan sebuah puskesmas membutuhkan ' + P + ' pekerja yang akan selesai dalam ' + T + ' hari. ' + p.condition + ' Jika kecepatan pekerja tetap sama, berapa lama waktu yang diperlukan untuk membangun puskesmas?';
  return 'Pembangunan sebuah jembatan direncanakan selesai dalam waktu ' + T + ' hari bila dikerjakan oleh ' + P + ' orang. ' + p.condition + ' Supaya pembangunan itu selesai tepat pada waktunya, diperlukan tambahan pekerja sebanyak ...';
}
export function makeWowo(index: number, r: Rng): Wowo & { stem: string } {
  const kind = KINDS[index];
  let found = FALLBACK[kind];
  for (let attempt = 0; attempt < 800; attempt++) {
    const candidate = draw(kind, r);
    if (!candidate) continue;
    const s = wowoSolve(candidate);
    if (whole(s.x) && whole(s.answer) && s.answer >= 1 && s.x >= 1 && ![candidate.S, candidate.H, candidate.M, candidate.a].includes(s.answer) && ![candidate.S, candidate.H, candidate.M, candidate.a, 2 * s.answer].includes(s.x) && s.phases.every((phase) => phase.w === 'x' || (whole(phase.w) && phase.w >= 0))) { found = candidate; break; }
  }
  if (!found.condition) found = { ...found, condition: stemFallback(found) };
  return { ...found, stem: stemOf(found) };
}
function stemFallback(p: Wowo): string {
  if (p.kind === 'sakit-balik-pekerja') return 'Memasuki hari ke-' + (p.a + 1) + ' ada ' + p.S + ' pekerja jatuh sakit selama ' + p.H + ' hari.';
  if (p.kind === 'sakit-balik-hari') return 'Di hari ke-' + (p.a + 1) + ', ada ' + p.S + ' orang pekerja yang sakit tidak bisa bekerja dan baru bekerja lagi ' + p.H + ' hari setelahnya.';
  if (p.kind === 'sakit-tidak-balik') return 'Setelah bekerja selama ' + p.a + ' hari, ' + p.S + ' orang pekerja sakit dan tidak melanjutkan pekerjaan.';
  if (p.kind === 'kontrak') return 'Setelah bekerja selama ' + p.a + ' hari, kepala desa menambahkan pekerja dari kampung sebelah sebanyak ' + p.Pt + ' orang selama ' + p.Tt + ' hari.';
  return 'Setelah dikerjakan ' + p.a + ' hari, pekerjaan dihentikan selama ' + p.M + ' hari.';
}
