import type { Rng } from './rng';
import type { Difficulty, Question } from './types';
import { calculate, entails, implies, not, variable, type Logic } from './solver';
import { makeFigural } from './figural';
import { DATA_LABELS, dataCategory, orders, type Model, type Constraint } from './models';

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
const numeric = (q: Draft, answer: number, r: Rng, expression?: string, mistakes: Mistake[] = []): Draft => {
  void r;
  const choices: Mistake[] = [[answer, q.explanation]];
  const add = (value: number, reason: string) => {
    const rounded = Math.round(value * 10000) / 10000;
    if (Number.isFinite(rounded) && !choices.some(([v]) => Math.abs(v - rounded) < 0.000051)) choices.push([rounded, reason]);
  };
  mistakes.forEach(([value, reason]) => add(value, reason));
  if (expression) {
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
  if (choices.length < 5) throw new Error('Pengecoh numerik belum cukup; perbaiki model keluarga ' + q.family + '.');
  q.options = choices.slice(0, 5).map(([value, reason], i) => ({ text: format(value), reason, score: i === 0 ? 5 : 0 }));
  q.proof = { kind: 'numeric', values: choices.slice(0, 5).map(([v]) => v), answer: choices[0][0], expression };
  return q;
};
const logicChoices = (q: Draft, texts: string[], reasons: string[], valid = [true, false, false, false, false]) => {
  q.options = texts.map((text, index) => ({ text, score: valid[index] ? 5 : 0, reason: reasons[index] }));
  q.answer = valid.indexOf(true);
  q.proof = { kind: 'logic', valid };
  return q;
};
const NAMES = ['Alya', 'Bima', 'Citra', 'Damar', 'Elin', 'Fajar', 'Gita', 'Hana', 'Indra', 'Jihan'];

export function makeTiu(family: Family, difficulty: Difficulty, r: Rng): Draft {
  let q = base(family, difficulty);
  if (family.id === 'hitung') {
    const a = r.int(5, 45), b = r.int(2, 12), c = r.int(2, 9), d = r.int(1, 9);
    const expression = difficulty === 'mudah' ? a + '+' + b + '*' + c :
      difficulty === 'sedang' ? a + '+' + b + '/' + 2 + '-' + d :
        '(' + a + '+' + b + ')*' + c + '/2-' + d;
    const answer = calculate(expression);
    q.stem = 'Hasil dari ' + expression.replaceAll('*', ' × ').replaceAll('/', ' ÷ ').replaceAll('+', ' + ').replaceAll('-', ' − ') + ' adalah ...';
    q.explanation = 'Kerjakan tanda kurung terlebih dahulu, kemudian perkalian/pembagian, lalu penjumlahan/pengurangan. Hasil perhitungan adalah ' + format(answer) + '.';
    const errors: Mistake[] = difficulty === 'mudah' ? [[(a + b) * c, 'Menjumlahkan dahulu mengabaikan prioritas perkalian.'], [a * b + c, 'Menukar posisi operator mengubah ekspresi.'], [b * c, 'Suku awal belum ditambahkan.'], [a + b + c, 'Perkalian terbaca sebagai penjumlahan.']] : difficulty === 'sedang' ? [[(a + b) / 2 - d, 'Penjumlahan dikerjakan sebelum pembagian.'], [a + b / 2 + d, 'Pengurangan suku terakhir berubah menjadi penambahan.'], [a + b - d, 'Pembagian dua diabaikan.'], [(a + b - d) / 2, 'Seluruh jumlah dibagi dua, padahal hanya suku tengah.']] : [[a + b * c / 2 - d, 'Kurung diabaikan sehingga hanya b yang dikalikan.'], [(a + b) * c - d, 'Pembagian dua diabaikan.'], [(a + b) * c / 2 + d, 'Tanda suku terakhir keliru.'], [(a + b) * c / (2 - d), 'Pengurangan d dimasukkan ke penyebut.']];
    return numeric(q, answer, r, expression, errors);
  }
  if (family.id === 'setara') {
    const a = r.int(12, 70), b = r.int(3, 12);
    const division = r.next() < 0.5;
    const texts: string[] = [], reasons: string[] = [];
    for (let i = 0; i < 5; i++) {
      const left = a + i * 2, divisor = b + i;
      const value = left * divisor;
      const right = i === 0 ? value : value + r.int(1, 8);
      texts.push(division ? value + ' ÷ ' + divisor + ' = ' + (right * 2) + ' ÷ ' + (divisor * 2) :
        left + ' × ' + divisor + ' = ' + right + ' × 1');
      reasons.push(division ? 'Ruas kiri = ' + format(value / divisor) + '; ruas kanan = ' + format(right / divisor) + '.' :
        'Ruas kiri = ' + value + '; ruas kanan = ' + right + '.');
    }
    q.stem = 'Manakah pasangan ' + (division ? 'pembagian' : 'perkalian') + ' yang menghasilkan nilai sama?';
    q.explanation = 'Hitung kedua ruas tiap pilihan atau gunakan perkalian silang. Hanya satu pasangan menghasilkan nilai sama.';
    q = logicChoices(q, texts, reasons); q.proof = { kind: 'model', model: { kind: 'equality' } }; return q;
  }
  if (family.id === 'deret' || family.id === 'fibonacci') {
    const start = r.int(2, 20), step = r.int(2, 9);
    let values: number[], answer: number, expression: string;
    if (family.id === 'fibonacci') {
      values = [r.int(1, 8), r.int(2, 12)];
      for (let i = 2; i < 7; i++) values.push(values[i - 1] + values[i - 2]);
      answer = values[5] + values[6]; expression = values[5] + '+' + values[6];
      q.explanation = 'Setiap suku setelah dua suku pertama merupakan jumlah dua suku sebelumnya. Jadi suku berikutnya = ' + values[5] + ' + ' + values[6] + ' = ' + answer + '.';
    } else if (difficulty === 'mudah') {
      values = Array.from({ length: 6 }, (_, i) => start + step * i);
      answer = start + step * 6; expression = start + '+' + step + '*6';
      q.explanation = 'Selisih antar-suku tetap sebesar ' + step + '. Suku berikutnya adalah ' + answer + '.';
    } else {
      const other = r.int(30, 60), otherStep = r.int(2, 8), factor = r.int(2, 3);
      values = Array.from({ length: 8 }, (_, i) => i % 2 ? other + Math.floor(i / 2) * otherStep : difficulty === 'sulit' ? start * factor ** Math.floor(i / 2) : start + Math.floor(i / 2) * step);
      answer = difficulty === 'sulit' ? start * factor ** 4 : start + 4 * step;
      expression = difficulty === 'sulit' ? start + '*' + [factor, factor, factor, factor].join('*') : start + '+4*' + step;
      q.explanation = 'Pisahkan suku pada posisi ganjil dan genap. Posisi ganjil ' + (difficulty === 'sulit' ? 'dikalikan ' + factor : 'bertambah ' + step) + ', posisi genap bertambah ' + otherStep + '. Posisi ke-9 mengikuti jalur ganjil: ' + answer + '.';
    }
    q.stem = 'Tentukan bilangan berikutnya berdasarkan pola deret: ' + values.join(', ') + ', ...';
    return numeric(q, answer, r, expression);
  }
  if (family.id === 'tabel') {
    const slope = r.int(2, 8), offset = r.int(1, 12), target = r.int(8, 18);
    const power = difficulty === 'sedang' ? 1 : 2;
    q.table = { headers: ['Urutan n', 'Nilai'], rows: [1, 2, 4, target, target + 5].map((n) => [String(n), n === target ? '?' : String(slope * n ** power + offset)]) };
    q.stem = 'Nilai dalam tabel mengikuti hubungan ' + (power === 1 ? 'linear y = a × n + b' : 'kuadratik y = a × n² + b') + ' dengan a dan b konstan. Berapakah nilai pada urutan ke-' + target + '?';
    const answer = slope * target ** power + offset;
    q.explanation = 'Selisih nilai pada n=1 dan n=2 adalah ' + (slope * (2 ** power - 1)) + ', sehingga a = ' + slope + '. Substitusi n=1 memberikan b = ' + offset + '. Nilai pada urutan ' + target + ' adalah ' + answer + '.';
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
    q.table = { headers: ['Bus', 'Kapasitas', 'Biaya'], rows: [['A', '20', 'Rp' + priceA], ['B', '40', 'Rp' + priceB], ['C', '60', 'Rp' + priceC]] };
    q.stem = 'Sebanyak ' + target + ' peserta harus memperoleh tempat duduk. Bus dapat dipilih lebih dari satu dan kursi kosong paling banyak 20. Di antara pilihan berikut, kombinasi manakah yang paling murah?';
    q.explanation = 'Hitung kapasitas dan total biaya setiap kombinasi yang ditawarkan. Pilih kapasitas yang cukup dengan kursi kosong paling banyak 20, kemudian biaya paling rendah. Biaya terbaik dari pilihan adalah Rp' + best.price + '.';
    q = logicChoices(q, [best, ...rest].map((item) => item.a + ' bus A, ' + item.b + ' bus B, ' + item.c + ' bus C'),
      [best, ...rest].map((item) => 'Kapasitas ' + item.seats + ', kursi kosong ' + (item.seats - target) + ', biaya Rp' + item.price + '.'));
    q.proof = { kind: 'model', model: { kind: 'cost', capacities: [20, 40, 60], prices: [priceA, priceB, priceC], target, spare: 20 } };
    return q;
  }
  if (family.id === 'data') {
    const x = r.int(3, 10), y = r.int(2, 9);
    const model: Extract<Model, { kind: 'data' }> = { kind: 'data', domain: 20, target: difficulty === 'sedang' ? 'x' : r.pick(['x', 'sum', 'product']), first: [], second: [] };
    const pattern = r.int(0, 4);
    model.first = pattern === 0 ? [{ op: 'x', value: x }] : pattern === 3 ? [{ op: 'sum', value: x + y }] : [{ op: 'product', value: x * y }];
    model.second = pattern === 1 ? [{ op: 'x', value: x }] : pattern === 3 ? [{ op: 'sum', value: x + y }] : pattern === 4 ? [{ op: 'xGt', value: 1 }] : [{ op: 'difference', value: x - y }];
    const describe = (c: typeof model.first[number]) => (c.op === 'xGt' ? 'x > ' : c.op === 'x' ? 'x = ' : c.op === 'sum' ? 'x + y = ' : c.op === 'difference' ? 'x − y = ' : 'xy = ') + c.value;
    q.stem = 'x dan y adalah bilangan bulat positif paling besar 20. Tentukan ' + (model.target === 'x' ? 'nilai x' : model.target === 'sum' ? 'nilai x + y' : 'nilai xy') + '.\n(1) ' + model.first.map(describe).join('; ') + '.\n(2) ' + model.second.map(describe).join('; ') + '.\nKategori kecukupan data yang tepat adalah ...';
    const answer = dataCategory(model);
    q.explanation = 'Uji seluruh pasangan bilangan dalam domain yang dinyatakan, terlebih dahulu untuk (1), lalu (2), kemudian gabungannya. Cukup berarti semua pasangan yang memenuhi pernyataan memberikan nilai target yang sama. Hasil: ' + DATA_LABELS[answer];
    q = logicChoices(q, DATA_LABELS, DATA_LABELS.map((_, i) => i === answer ? q.explanation : 'Kategori ini berbeda dari banyaknya nilai target yang mungkin; satu contoh pasangan belum membuktikan kecukupan.'), DATA_LABELS.map((_, i) => i === answer));
    q.bloom = 'C4'; q.proof = { kind: 'model', model }; return q;
  }
  if (family.id === 'analogi') {
    const pairs = [
      ['Termometer', 'Suhu', 'Barometer', 'Tekanan udara', 'Kecepatan angin', 'Kelembapan udara', 'Curah hujan', 'Suhu udara', 'alat dan besaran yang diukur secara langsung'],
      ['Penulis', 'Novel', 'Pelukis', 'Lukisan', 'Kuas', 'Kanvas', 'Galeri', 'Pameran', 'profesi dan karya yang dihasilkan'],
      ['Kompas', 'Arah', 'Jam', 'Waktu', 'Jarum', 'Putaran', 'Alarm', 'Angka', 'alat dan informasi utama yang ditunjukkan'],
      ['Kunci', 'Pintu', 'Kata sandi', 'Akun', 'Papan ketik', 'Jaringan', 'Layar', 'Aplikasi pengolah kata', 'alat autentikasi dan akses yang dibukanya'],
      ['Akar', 'Pohon', 'Fondasi', 'Bangunan', 'Semen', 'Arsitek', 'Lantai', 'Atap', 'bagian penopang dan keseluruhan yang ditopang'],
      ['Pustakawan', 'Perpustakaan', 'Apoteker', 'Apotek', 'Obat', 'Resep', 'Pasien', 'Etalase', 'profesi dan tempat utama pelayanannya'],
      ['Benih', 'Tanaman', 'Telur ayam', 'Anak ayam', 'Sarang ayam', 'Pakan ayam', 'Cangkang', 'Bulu ayam', 'asal biologis dan hasil perkembangan'],
      ['Nelayan', 'Jala', 'Petani', 'Cangkul', 'Sawah', 'Gabah', 'Lumbung', 'Pupuk', 'pekerja dan alat kerja khas yang digunakan'],
      ['Paru-paru', 'Pernapasan', 'Lambung', 'Pencernaan', 'Peredaran darah', 'Pergerakan', 'Penglihatan', 'Pendengaran', 'organ dan fungsi utama'],
      ['Buku', 'Halaman', 'Kalung', 'Manik-manik', 'Leher', 'Perhiasan', 'Toko', 'Pemakai', 'keseluruhan dan bagian penyusunnya'],
    ];
    const pair = r.pick(pairs);
    q.stem = pair[0] + ' : ' + pair[1] + ' = ' + pair[2] + ' : ...';
    q.explanation = 'Hubungannya adalah ' + pair[8] + '. Hubungan ini dipertahankan oleh ' + pair[2] + ' dengan ' + pair[3] + '.';
    q.bloom = 'C2'; return logicChoices(q, pair.slice(3, 8), [q.explanation, ...pair.slice(4, 8).map((text) => text + ' terkait konteksnya, tetapi bukan pasangan dengan hubungan ' + pair[8] + '.')]);
  }
  if (family.id === 'silogisme') {
    const person = r.pick(NAMES);
    const context = r.pick([
      ['berkas telah terverifikasi', 'berkas dapat diproses', 'pemohon menerima nomor registrasi'],
      ['peserta lulus pelatihan', 'peserta mendapat sertifikat', 'peserta dapat mengikuti tahap lanjutan'],
      ['produk lolos pemeriksaan', 'produk masuk rak utama', 'produk mendapat label promosi'],
      ['jadwal disetujui', 'ruangan disiapkan', 'peserta menerima undangan'],
      ['dokumen lengkap', 'permohonan diterima', 'nomor permohonan diterbitkan'],
    ]);
    const negative = r.next() < 0.5, [a, b, c] = context;
    if (difficulty !== 'sedang') {
      const p = variable('p'), s = variable('s'), t = variable('t'), u = variable('u');
      const extra = 'proses memasuki tahap akhir', premise: Logic = { op: 'and', left: p, right: s };
      const premises = [implies(premise, t), implies(t, u), p, not(u)], conclusions = [not(s), s, t, u, implies(not(s), t)];
      const valid = entails(premises, conclusions);
      q.stem = 'Dalam soal ini berlaku ketentuan berikut. Jika ' + a + ' dan ' + b + ', maka ' + c + '. Jika ' + c + ', maka ' + extra + '. Dalam kasus ini, ' + a + ', tetapi tidak benar bahwa ' + extra + '. Kesimpulan yang pasti benar adalah ...';
      q.explanation = 'Dari t → u dan ¬u diperoleh ¬t. Karena p ∧ s → t, maka ¬(p ∧ s). Diketahui p benar, sehingga s harus salah. Kesimpulan tidak membalik implikasi.';
      const texts = ['Tidak benar bahwa ' + b + '.', b + '.', c + '.', extra + '.', 'Jika tidak benar bahwa ' + b + ', maka ' + c + '.'];
      q = logicChoices(q, texts, texts.map((_, i) => valid[i] ? q.explanation : 'Kesimpulan tidak berlaku pada setiap kemungkinan yang memenuhi seluruh premis.'), valid);
      q.proof = { kind: 'logic', valid, entailment: { premises, conclusions } }; q.bloom = 'C4'; return q;
    }
    const p = variable('p'), s = variable('q'), t = variable('r');
    const premises = [implies(p, s), implies(s, t), negative ? not(t) : p];
    const conclusions = negative ? [not(p), p, s, t, implies(not(p), t)] : [t, not(t), not(s), not(p), implies(t, not(s))];
    q.stem = 'Jika ' + a + ', maka ' + b + '. Jika ' + b + ', maka ' + c + '. Pada kasus ' + person + ', ' +
      (negative ? 'tidak benar bahwa ' + c : a) + '.\nKesimpulan yang pasti benar adalah ...';
    q.explanation = negative ? 'Rangkaian p → q → r dan ¬r menghasilkan ¬p melalui modus tollens. Tidak boleh membalik implikasi.' :
      'Dari p → q, q → r, dan p, diperoleh q lalu r melalui modus ponens.';
    const texts = negative ? ['Tidak benar bahwa ' + a + '.', a + '.', b + '.', c + '.', 'Jika tidak benar bahwa ' + a + ', maka ' + c + '.'] :
      [c + '.', 'Tidak benar bahwa ' + c + '.', 'Tidak benar bahwa ' + b + '.', 'Tidak benar bahwa ' + a + '.', 'Jika ' + c + ', maka tidak benar bahwa ' + b + '.'];
    const valid = entails(premises, conclusions);
    q = logicChoices(q, texts, texts.map((_, i) => valid[i] ? q.explanation : 'Kesimpulan ini tidak berlaku pada semua keadaan yang memenuhi premis.'), valid);
    q.proof = { kind: 'logic', valid, entailment: { premises, conclusions } };
    return q;
  }
  if (['posisi', 'peringkat', 'jadwal'].includes(family.id)) {
    const order = r.shuffle(NAMES).slice(0, difficulty === 'sedang' ? 5 : 6), position = r.int(2, order.length - 1);
    const constraints: Constraint[] = [{ a: order[0], op: 'at', value: 1 }];
    for (let i = 0; i < order.length - 1; i++) constraints.push({ a: order[i], b: order[i + 1], op: difficulty === 'sedang' ? 'adjacent' : 'before' });
    if (difficulty !== 'sedang') {
      constraints.splice(2, 1, { a: order[1], b: order[3], op: 'distance', value: 2 });
      constraints.push({ a: order[2], op: 'notAt', value: order.length });
      constraints.push({ a: order[2], b: order[3], op: 'before' });
    }
    const labels = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].slice(0, order.length);
    const model: Extract<Model, { kind: 'ordering' }> = { kind: 'ordering', names: r.shuffle(order), constraints,
      query: family.id === 'jadwal' ? { person: order[position - 1] } : { position }, ...(family.id === 'jadwal' ? { labels } : {}) };
    const possible = orders(model);
    const outputs = new Set(possible.map((o) => family.id === 'jadwal' ? labels[o.indexOf(order[position - 1])] : o[position - 1]));
    const answer = outputs.size === 1 ? [...outputs][0] : 'Tidak dapat ditentukan';
    const relation = family.id === 'posisi' ? 'di sebelah kiri' : family.id === 'peringkat' ? 'di atas' : 'sebelum';
    const clues = r.shuffle(constraints).map((c) => c.op === 'at' ? c.a + ' menempati urutan ' + c.value + '.' :
      c.op === 'notAt' ? c.a + ' bukan pada urutan ' + c.value + '.' : c.op === 'distance' ? c.a + ' berada ' + c.value + ' urutan ' + relation + ' ' + c.b + '.' :
        c.a + ' ' + (c.op === 'adjacent' ? 'tepat satu urutan ' : '') + relation + ' ' + c.b + '.');
    q.stem = model.names.join(', ') + (family.id === 'jadwal' ? ' presentasi satu orang per hari pada ' + labels.join(', ') : family.id === 'peringkat' ? ' memiliki nilai berbeda dan diurutkan dari tertinggi ke terendah' : ' duduk dalam satu baris dari kiri ke kanan') + '. ' + clues.join(' ') + '\n' +
      (family.id === 'jadwal' ? 'Pada hari apa ' + order[position - 1] + ' presentasi?' : 'Siapa yang menempati urutan ke-' + position + '?');
    const candidates = family.id === 'jadwal' ? labels : order;
    const texts = [answer, ...r.shuffle(candidates.filter((v) => v !== answer)).slice(0, 4)];
    q.explanation = 'Bedakan hubungan sebelum dengan tepat sebelum. Uji seluruh petunjuk bersama; ' + possible.length + ' susunan memenuhi batasan. ' +
      (outputs.size === 1 ? 'Semua susunan tersebut memberi jawaban ' + answer + '.' : 'Ada lebih dari satu hasil untuk posisi yang ditanyakan.');
    q = logicChoices(q, texts, texts.map((t) => t === answer ? q.explanation : 'Pilihan ini tidak konsisten dengan seluruh batasan, meskipun dapat cocok dengan salah satu petunjuk.'));
    q.bloom = 'C4'; q.proof = { kind: 'model', model }; return q;
  }
  if (family.id === 'argumen') {
    const examples = [
      ['Menambah ruang hijau akan membantu menurunkan suhu lingkungan.', 'Area dengan vegetasi lebih banyak tercatat mempunyai suhu lebih rendah pada kondisi yang sebanding.', 'Area hijau tetap lebih panas setelah faktor kepadatan dan cuaca dikendalikan.'],
      ['Pendampingan pengisian formulir akan mengurangi kesalahan permohonan.', 'Kesalahan pengisian turun pada pengguna yang mendapat pendampingan dengan jenis permohonan yang sama.', 'Kesalahan tetap sama pada kelompok yang mendapat pendampingan dan kelompok pembanding.'],
      ['Jadwal angkutan yang lebih pasti akan mendorong penggunaan transportasi umum.', 'Survei menunjukkan banyak pengguna beralih setelah jadwal keberangkatan menjadi lebih dapat diprediksi.', 'Pengguna tetap memilih kendaraan pribadi meskipun ketepatan jadwal sudah meningkat.'],
      ['Panduan kerja yang jelas akan mengurangi pekerjaan ulang.', 'Pekerjaan ulang turun setelah panduan diperbaiki pada tim dengan beban yang sebanding.', 'Jumlah pekerjaan ulang tidak berubah setelah panduan diterapkan secara konsisten.'],
    ];
    const [claim, strengthen, weaken] = r.pick(examples), negative = r.next() < 0.5;
    q.stem = 'Seorang peneliti berpendapat: "' + claim + '" Pernyataan manakah yang paling ' + (negative ? 'memperlemah' : 'memperkuat') + ' argumen tersebut?';
    q.explanation = 'Uji hubungan antara tindakan dan hasil yang diklaim. Bukti yang ' + (negative ? 'menunjukkan hasil tidak terjadi meskipun tindakan diterapkan' : 'menunjukkan hasil terjadi setelah tindakan, dengan kondisi pembanding yang relevan') + ' paling langsung memengaruhi argumen.';
    const texts = [negative ? weaken : strengthen, negative ? strengthen : weaken,
      'Hasil membaik, tetapi kelompok penerima program juga mendapat tambahan sumber daya pada saat yang sama.',
      'Sebagian penerima mengaku menyukai program, sedangkan perubahan hasil belum diukur dengan kriteria yang sama.',
      'Kondisi awal kelompok penerima lebih baik daripada kelompok pembanding dan belum dikendalikan dalam analisis.'];
    return logicChoices(q, texts, [q.explanation, 'Pernyataan ini justru mengarah pada pengaruh yang berlawanan.',
      'Tambahan sumber daya adalah penjelasan alternatif; lebih tidak langsung daripada pengukuran hasil pada kondisi sebanding.',
      'Kesukaan terhadap program belum membuktikan perubahan hasil yang diklaim.', 'Ketidakseimbangan awal membatasi perbandingan; bukti hasil setelah pengendalian faktor lebih langsung.']);
  }
  if (family.id === 'peringkat' || family.id === 'jadwal') {
    const order = r.shuffle(NAMES).slice(0, 5), target = r.int(1, 5);
    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    if (family.id === 'peringkat') {
      q.stem = 'Lima peserta memiliki nilai berbeda. ' + r.shuffle(order.slice(0, 4).map((name, i) =>
        name + ' tepat satu peringkat di atas ' + order[i + 1] + '.')).join(' ') + ' Siapa yang berada pada peringkat ke-' + target + '?';
      q.explanation = 'Hubungkan petunjuk peringkat berurutan. Urutan tertinggi ke terendah adalah ' + order.join(' – ') + '.';
      const choices = [order[target - 1], ...order.filter((name) => name !== order[target - 1])];
      return logicChoices(q, choices, choices.map((name, i) => i === 0 ? 'Sesuai urutan peringkat yang memenuhi semua petunjuk.' : name + ' berada pada peringkat ' + (order.indexOf(name) + 1) + '.'));
    }
    q.stem = 'Lima peserta mendapat jadwal presentasi satu orang per hari, Senin–Jumat. ' +
      r.shuffle(order.slice(0, 4).map((name, i) => 'Presentasi ' + name + ' tepat sehari sebelum ' + order[i + 1] + '.')).join(' ') +
      ' Pada hari apa ' + order[target - 1] + ' presentasi?';
    q.explanation = 'Rangkaian lima presentasi mengisi lima hari tanpa celah: ' + order.map((name, i) => days[i] + ' = ' + name).join('; ') + '.';
    return logicChoices(q, days, days.map((day, i) => day + ' merupakan jadwal ' + order[i] + '.'), days.map((_, i) => i === target - 1));
  }
  if (family.id === 'kategori') {
    const names = r.shuffle(NAMES).slice(0, 3), activities = r.shuffle(['basket', 'teater', 'fotografi', 'musik', 'robotika']).slice(0, 2);
    q.stem = names.join(', ') + ' mengikuti kegiatan sekolah. Tepat dua dari mereka mengikuti ' + activities[0] + '. ' +
      names[0] + ' mengikuti ' + activities[0] + ', sedangkan ' + names[2] + ' tidak mengikutinya. Hanya ' + names[2] +
      ' yang mengikuti ' + activities[1] + '. Kesimpulan yang pasti benar adalah ...';
    q.explanation = 'Karena tepat dua peserta mengikuti ' + activities[0] + ', peserta kedua adalah ' + names[1] + '. Informasi tentang ' + activities[1] + ' tidak mengubah penghitungan tersebut.';
    const texts = [
      names[1] + ' mengikuti ' + activities[0] + ' dan tidak mengikuti ' + activities[1] + '.',
      names[0] + ' mengikuti kedua kegiatan.', names[1] + ' mengikuti kedua kegiatan.',
      names[2] + ' mengikuti kedua kegiatan.', 'Tidak ada peserta yang mengikuti ' + activities[0] + '.',
    ];
    q = logicChoices(q, texts, [q.explanation, 'Kegiatan kedua hanya diikuti peserta ketiga.', 'Kegiatan kedua hanya diikuti peserta ketiga.',
      'Peserta ketiga tidak mengikuti kegiatan pertama.', 'Ada tepat dua peserta yang mengikuti kegiatan pertama.']);
    q.proof = { kind: 'model', model: { kind: 'category', names, total: 2, yes: [names[0]], no: [names[2]], second: [names[2]], claims: [
      { text: texts[0], person: names[1], first: true, second: false }, { text: texts[1], person: names[0], first: true, second: true },
      { text: texts[2], person: names[1], first: true, second: true }, { text: texts[3], person: names[2], first: true, second: true },
    ] } }; return q;
  }
  if (family.id === 'rute') {
    const size = difficulty === 'sedang' ? 5 : 6;
    const nodes = r.shuffle(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']).slice(0, size);
    const edges: number[][] = [];
    for (let i = 0; i < size - 1; i++) {
      edges.push([i, i + 1]);
      for (let j = i + 2; j < size; j++) if (r.next() < 0.45) edges.push([i, j]);
    }
    const paths = Array(size).fill(0) as number[]; paths[size - 1] = 1;
    for (let i = size - 2; i >= 0; i--) paths[i] = edges.filter(([from]) => from === i).reduce((sum, [, to]) => sum + paths[to], 0);
    q.table = { headers: ['Dari', 'Menuju'], rows: edges.map(([from, to]) => [nodes[from], nodes[to]]) };
    q.stem = 'Jalur pada tabel hanya dapat dilalui sesuai arah yang ditunjukkan. Berapa banyak rute berbeda dari ' + nodes[0] + ' menuju ' + nodes[size - 1] + '?';
    q.explanation = 'Hitung dari tujuan ke belakang. Banyak rute dari suatu simpul adalah jumlah rute dari semua simpul yang dapat dituju langsung. ' +
      nodes.map((node, i) => node + ': ' + paths[i]).join('; ') + '. Jadi terdapat ' + paths[0] + ' rute.';
    q = numeric(q, paths[0], r, edges.filter(([from]) => from === 0).map(([, to]) => paths[to]).join('+'), [
      [edges.length, 'Menghitung ruas jalan, bukan rute lengkap dari awal sampai tujuan.'],
      [edges.filter(([from]) => from === 0).length, 'Menghitung cabang awal saja mengabaikan percabangan setelahnya.'],
      [size - 1, 'Menghitung ruas pada jalur berantai saja mengabaikan rute alternatif.'],
    ]);
    q.proof = { kind: 'model', model: { kind: 'route', nodes, edges: edges.map(([from, to]) => [nodes[from], nodes[to]]) } }; return q;
  }
  if (family.id === 'pecahan') {
    const a = r.int(1, 9), b = r.int(1, 4), c = r.int(1, 5), whole = difficulty === 'mudah' ? 0 : r.int(2, 12);
    const expression = whole + '+' + a + '/10+' + b + '/5-' + c + '/10';
    const answer = calculate(expression);
    q.stem = 'Hasil dari ' + (whole ? whole + ' + ' : '') + a + '/10 + ' + b + '/5 − ' + c + '/10 adalah ...';
    q.explanation = 'Samakan penyebut menjadi 10. Nilai pecahan = (' + a + ' + ' + (2 * b) + ' − ' + c + ')/10. Tambahkan bagian bilangan bulat ' + whole + '. Hasil = ' + format(answer) + '.';
    return numeric(q, answer, r, expression);
  }
  if (family.id === 'tiga-jalur') {
    const starts = [r.int(1, 15), r.int(20, 40), r.int(45, 65)], steps = [r.int(2, 6), r.int(3, 7), r.int(2, 8)];
    const values = Array.from({ length: 9 }, (_, i) => starts[i % 3] + Math.floor(i / 3) * steps[i % 3]);
    q.stem = 'Tentukan bilangan yang melanjutkan pola deret tiga jalur: ' + values.join(', ') + ', ...';
    const answer = starts[0] + 3 * steps[0];
    q.explanation = 'Pisahkan posisi 1–4–7, 2–5–8, dan 3–6–9. Masing-masing jalur mempunyai selisih tetap ' + steps.join(', ') +
      '. Posisi ke-10 meneruskan jalur pertama: ' + values[6] + ' + ' + steps[0] + ' = ' + answer + '.';
    return numeric(q, answer, r, starts[0] + '+3*' + steps[0], [
      [values[8] + steps[2], 'Meneruskan jalur ketiga, padahal posisi ke-10 termasuk jalur pertama.'],
      [values[6] + steps[1], 'Menggunakan selisih jalur kedua untuk suku jalur pertama.'],
      [values[6], 'Mengulang suku terakhir jalur pertama tanpa menambahkan selisihnya.'],
      [answer + steps[0], 'Maju dua langkah pada jalur pertama, bukan satu langkah.'],
    ]);
  }
  if (family.id === 'selang-seling') {
    const add = r.int(3, 9), subtract = r.int(1, add - 1), values = [r.int(15, 40)];
    for (let i = 1; i < 7; i++) values.push(values[i - 1] + (i % 2 ? add : -subtract));
    const answer = values[6] + add;
    q.stem = 'Tentukan bilangan berikutnya pada deret: ' + values.join(', ') + ', ...';
    q.explanation = 'Operasi bergantian: tambah ' + add + ', lalu kurang ' + subtract + '. Operasi berikutnya adalah tambah ' + add + ', sehingga hasilnya ' + answer + '.';
    return numeric(q, answer, r, values[6] + '+' + add);
  }
  if (family.id === 'matriks-angka') {
    const top = Array.from({ length: 3 }, () => r.int(2, 12)), bottom = Array.from({ length: 3 }, () => r.int(2, 15));
    const factor = difficulty === 'sedang' ? 2 : r.int(3, 6);
    const middle = top.map((value, i) => factor * value + bottom[i]);
    q.table = { headers: ['Kolom 1', 'Kolom 2', 'Kolom 3'], rows: [top.map(String), middle.map(String), [String(bottom[0]), String(bottom[1]), '?']] };
    q.stem = 'Pada setiap kolom, bilangan tengah = a × bilangan atas + bilangan bawah, dengan a bilangan bulat positif yang sama.' + (difficulty === 'sedang' ? ' Diketahui a = ' + factor + '.' : ' Tentukan a dari dua kolom yang lengkap.') + ' Nilai yang menggantikan tanda tanya adalah ...';
    q.explanation = 'Balikkan hubungan: bilangan bawah = bilangan tengah − ' + factor + ' × bilangan atas. Pada kolom ketiga: ' +
      middle[2] + ' − ' + factor + ' × ' + top[2] + ' = ' + bottom[2] + '.';
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
      statements.push('(' + (i + 1) + ') ' + amounts.map((n, j) => n + ' ' + products[j].toLowerCase()).join(', ') + ' berharga Rp' + offered + '.');
      reasons.push('Pernyataan ' + (i + 1) + ': harga sebenarnya Rp' + total + ', sehingga ' + (total === offered ? 'benar' : 'salah') + '.');
    }
    const correct = trueStatements.join(' dan ');
    const combinations = ['1 dan 2', '1 dan 3', '1 dan 4', '2 dan 3', '2 dan 4', '3 dan 4'].filter((text) => text !== correct);
    q.table = { headers: ['Barang', 'Harga satuan'], rows: products.map((product, i) => [product, 'Rp' + prices[i]]) };
    q.stem = statements.join('\n') + '\nKombinasi dua pernyataan yang benar adalah ...';
    q.explanation = reasons.join(' ');
    q = logicChoices(q, [correct, ...r.shuffle(combinations).slice(0, 4)], [q.explanation, ...Array(4).fill('Setidaknya satu pernyataan dalam kombinasi ini salah menurut perhitungan harga.')]);
    q.proof = { kind: 'model', model: { kind: 'statements', prices, amounts: allAmounts, offered: allOffered } }; return q;
  }
  if (family.id === 'cerita-hitung') {
    if (difficulty === 'sulit') {
      const variant = r.int(0, 2), a = r.int(3, 9), b = r.int(2, 5);
      let expression: string; let mistakes: Mistake[];
      if (variant === 0) {
        const price = a * 50000, discount = b * 5, tax = 10;
        expression = price + '*(100-' + discount + ')/100*(100+' + tax + ')/100';
        q.stem = 'Barang berharga Rp' + price + ' mendapat diskon ' + discount + '%. Setelah diskon, pajak 10% dikenakan atas harga yang sudah didiskon. Berapa total yang dibayar?';
        q.explanation = 'Tentukan harga setelah diskon terlebih dahulu; pajak dihitung dari dasar harga tersebut, bukan harga awal.';
        mistakes = [[price * (100 - discount + tax) / 100, 'Diskon dan pajak digabung pada harga awal, padahal dasar pajak berubah.'], [price * (100 - discount) / 100, 'Pajak setelah diskon belum dimasukkan.'], [price * 1.1, 'Diskon belum diterapkan.'], [price * (100 - discount) / 100 - price * .1, 'Pajak dikurangi dan memakai dasar harga awal.']];
      } else if (variant === 1) {
        const old = 70, added = 90, total = a * old + b * added;
        expression = '(' + a + '*' + old + '+' + b + '*' + added + ')/(' + a + '+' + b + ')';
        q.stem = 'Rata-rata nilai ' + a + ' peserta adalah 70. Sebanyak ' + b + ' peserta lain dengan rata-rata 90 bergabung. Berapa rata-rata gabungan?';
        q.explanation = 'Gunakan jumlah nilai tiap kelompok sebagai bobot; rata-rata kelompok tidak dijumlahkan lalu dibagi dua kecuali ukurannya sama.';
        mistakes = [[80, 'Rata-rata kelompok diberi bobot sama meskipun banyak peserta berbeda.'], [total / a, 'Jumlah nilai gabungan dibagi hanya peserta kelompok awal.'], [total / b, 'Jumlah nilai gabungan dibagi hanya peserta tambahan.'], [(70 + 90) / (a + b), 'Rata-rata dianggap sebagai jumlah nilai kelompok.']];
      } else {
        const workers = a * 2, days = b * 8, elapsed = b * 2, extra = a;
        expression = '(' + workers + '*' + days + '-' + workers + '*' + elapsed + ')/(' + workers + '+' + extra + ')';
        q.stem = 'Pekerjaan dapat selesai oleh ' + workers + ' pekerja dalam ' + days + ' hari. Setelah ' + elapsed + ' hari bekerja, ditambah ' + extra + ' pekerja dengan produktivitas sama. Berapa hari lagi yang diperlukan?';
        q.explanation = 'Hitung sisa beban dalam satuan orang-hari setelah pekerjaan awal, kemudian bagi dengan jumlah pekerja baru.';
        mistakes = [[workers * days / (workers + extra), 'Beban yang sudah dikerjakan belum dikurangi.'], [days - elapsed, 'Tambahan pekerja belum diperhitungkan.'], [(workers + extra) * (days - elapsed) / workers, 'Perbandingan pekerja dan waktu dibalik.'], [(days - elapsed) / extra, 'Jumlah pekerja tambahan dianggap seluruh tenaga kerja.']];
      }
      const answer = calculate(expression); q.explanation += ' Hasil = ' + format(answer) + '.';
      return numeric(q, answer, r, expression, mistakes);
    }
    const variant = r.int(0, 5), a = r.int(3, 12), b = r.int(2, 6);
    let expression: string;
    if (variant === 0) {
      const speed = a * 10, time = b / 2;
      expression = speed + '*' + time;
      q.stem = 'Kendaraan bergerak dengan kecepatan tetap ' + speed + ' km/jam selama ' + format(time) + ' jam. Berapa jarak yang ditempuh dalam kilometer?';
      q.explanation = 'Jarak = kecepatan × waktu.';
    } else if (variant === 1) {
      const debit = a * 5, time = b * 10;
      expression = debit + '*' + time;
      q.stem = 'Pompa mengalirkan air dengan debit tetap ' + debit + ' liter/menit selama ' + time + ' menit. Berapa liter air yang dialirkan?';
      q.explanation = 'Volume = debit × waktu. Satuan waktu keduanya adalah menit.';
    } else if (variant === 2) {
      const n = a, oldMean = r.int(60, 80), newValue = r.int(75, 95);
      expression = '(' + n + '*' + oldMean + '+' + newValue + ')/' + (n + 1);
      q.stem = 'Rata-rata nilai ' + n + ' peserta adalah ' + oldMean + '. Satu peserta dengan nilai ' + newValue + ' bergabung. Berapa rata-rata baru?';
      q.explanation = 'Jumlah nilai awal = banyak peserta × rata-rata. Tambahkan nilai peserta baru, kemudian bagi dengan jumlah peserta baru.';
    } else if (variant === 3) {
      const price = a * 20000, percent = b * 5;
      expression = price + '*(100-' + percent + ')/100';
      q.stem = 'Barang berharga Rp' + price + ' mendapat diskon ' + percent + '%. Berapa harga setelah diskon dalam rupiah?';
      q.explanation = 'Harga setelah diskon = harga awal × (100 − persentase diskon)/100.';
    } else if (variant === 4) {
      const workers = a, days = b * 6, newWorkers = a * 2;
      expression = workers + '*' + days + '/' + newWorkers;
      q.stem = 'Pekerjaan diselesaikan ' + workers + ' pekerja dalam ' + days + ' hari. Jika produktivitas sama, berapa hari yang diperlukan ' + newWorkers + ' pekerja?';
      q.explanation = 'Banyak pekerja dan waktu berbanding terbalik. Pertahankan hasil kali pekerja × hari.';
    } else {
      const total = (a + b) * r.int(3, 12);
      expression = total + '*' + a + '/(' + a + '+' + b + ')';
      q.stem = 'Perbandingan jumlah buku kelompok A dan B adalah ' + a + ' : ' + b + '. Totalnya ' + total + ' buku. Berapa buku kelompok A?';
      q.explanation = 'Bagian A = total × rasio A/(rasio A + rasio B).';
    }
    const answer = calculate(expression);
    q.explanation += ' Hasil perhitungan = ' + format(answer) + '.';
    return numeric(q, answer, r, expression);
  }
  // Soal figural dibangun oleh mesin figural (lib/figural): bentuk kaya, aturan tidak bocor di kalimat soal,
  // dan kuncinya dibuktikan ulang dari gambar oleh validator.
  const figural = makeFigural(family.id, difficulty, r);
  return { ...q, ...figural };
}
