import type { Rng } from './rng';
import type { Difficulty, Figure, Question } from './types';
import { calculate, entails, implies, not, variable } from './solver';
import { figureSignature, mod } from './figures';

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
  { id: 'fig-matrix', topic: 'Figural', name: 'Matriks 3 × 3', levels: ['sulit', 'hots'] },
];
const format = (value: number) => String(Math.round(value * 10000) / 10000).replace('.', ',');
const base = (family: Family, difficulty: Difficulty): Draft => ({
  subtest: 'TIU', topic: family.topic, subtopic: family.name, difficulty, family: family.id,
  stem: '', options: [], answer: 0, explanation: '', origin: 'pola',
  source: 'Pola latihan berdasarkan Contoh Soal TIU SKD 2027.',
  proof: { kind: 'logic', valid: [true, false, false, false, false] },
});
const numeric = (q: Draft, answer: number, r: Rng, expression?: string): Draft => {
  const values = new Set<number>([Math.round(answer * 10000) / 10000]);
  const step = Number.isInteger(answer) ? 1 : 0.1;
  while (values.size < 5) values.add(Math.round((answer + r.int(-8, 8) * step) * 10000) / 10000);
  const choices = [...values];
  q.options = choices.map((value, i) => ({
    text: format(value), score: i === 0 ? 5 : 0,
    reason: i === 0 ? 'Nilai ini sesuai hasil perhitungan.' : 'Nilai ini berbeda dari hasil perhitungan yang ditunjukkan.',
  }));
  q.proof = { kind: 'numeric', values: choices, answer: choices[0], expression };
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
    return numeric(q, answer, r, expression);
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
    return logicChoices(q, texts, reasons);
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
      const other = r.int(30, 60), otherStep = r.int(2, 8);
      values = Array.from({ length: 8 }, (_, i) => i % 2 ? other + Math.floor(i / 2) * otherStep : start + Math.floor(i / 2) * step);
      answer = start + 4 * step; expression = start + '+4*' + step;
      q.explanation = 'Pisahkan suku pada posisi ganjil dan genap. Posisi ganjil bertambah ' + step + ', posisi genap bertambah ' + otherStep + '. Posisi ke-9 mengikuti jalur ganjil: ' + answer + '.';
    }
    q.stem = 'Tentukan bilangan berikutnya berdasarkan pola deret: ' + values.join(', ') + ', ...';
    return numeric(q, answer, r, expression);
  }
  if (family.id === 'tabel') {
    const slope = r.int(2, 8), offset = r.int(1, 12), target = r.int(8, 18);
    q.table = { headers: ['Urutan n', 'Nilai'], rows: [1, 2, 4, target, target + 5].map((n) => [String(n), n === target ? '?' : String(slope * n + offset)]) };
    q.stem = 'Nilai dalam tabel mengikuti hubungan linear yang sama. Berapakah nilai pada urutan ke-' + target + '?';
    const answer = slope * target + offset;
    q.explanation = 'Hubungan linear: nilai = ' + slope + ' × n + ' + offset + '. Pada n = ' + target + ', nilainya ' + answer + '.';
    return numeric(q, answer, r, slope + '*' + target + '+' + offset);
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
    return logicChoices(q, [best, ...rest].map((item) => item.a + ' bus A, ' + item.b + ' bus B, ' + item.c + ' bus C'),
      [best, ...rest].map((item) => 'Kapasitas ' + item.seats + ', kursi kosong ' + (item.seats - target) + ', biaya Rp' + item.price + '.'));
  }
  if (family.id === 'data') {
    const x = r.int(3, 12), y = r.int(2, 8);
    const pattern = r.int(0, 4);
    const questions = [
      ['Berapakah nilai x?', '(1) x = ' + x + '.', '(2) x + y = ' + (x + y) + '.', 'Pernyataan (1) memberi nilai x langsung. Pernyataan (2) belum menentukan x karena y tidak diketahui.'],
      ['Berapakah nilai x?', '(1) x + y = ' + (x + y) + '.', '(2) x = ' + x + '.', 'Pernyataan (2) memberi nilai x langsung. Pernyataan (1) belum menentukan x karena y tidak diketahui.'],
      ['Berapakah nilai x?', '(1) x + y = ' + (x + y) + '.', '(2) x - y = ' + (x - y) + '.', 'Masing-masing persamaan memiliki dua variabel. Keduanya bersama-sama menghasilkan 2x = ' + (2 * x) + ', sehingga x = ' + x + '.'],
      ['Berapakah nilai x?', '(1) 2x = ' + (2 * x) + '.', '(2) 3x = ' + (3 * x) + '.', 'Setiap pernyataan secara terpisah memberikan nilai x yang tunggal, yaitu ' + x + '.'],
      ['Berapakah nilai x?', '(1) x > ' + x + '.', '(2) x < ' + (x + 5) + '.', 'Gabungan pernyataan hanya memberi interval dan tidak menetapkan satu nilai x.'],
    ][pattern];
    q.stem = 'x dan y adalah bilangan real. ' + questions[0] + '\n' + questions[1] + '\n' + questions[2];
    q.explanation = 'Periksa setiap pernyataan secara terpisah, kemudian gabungannya bila diperlukan. ' + questions[3];
    const texts = ['(1) saja cukup, (2) saja tidak cukup.', '(2) saja cukup, (1) saja tidak cukup.',
      'Keduanya bersama cukup, masing-masing tidak cukup.', 'Masing-masing pernyataan cukup.', 'Keduanya bersama tetap tidak cukup.'];
    return logicChoices(q, texts, texts.map((_, i) => i === pattern ? questions[3] : 'Kategori kecukupan ini tidak sesuai evaluasi kedua pernyataan.'), texts.map((_, i) => i === pattern));
  }
  if (family.id === 'analogi') {
    const pairs = [
      ['Termometer', 'Suhu', 'Barometer', 'Tekanan udara'], ['Mikroskop', 'Objek kecil', 'Teleskop', 'Objek jauh'],
      ['Dokter', 'Pasien', 'Guru', 'Murid'], ['Penulis', 'Buku', 'Pelukis', 'Lukisan'],
      ['Kompas', 'Arah', 'Jam', 'Waktu'], ['Kunci', 'Pintu', 'Kata sandi', 'Akun'],
      ['Akar', 'Pohon', 'Fondasi', 'Bangunan'], ['Pustakawan', 'Perpustakaan', 'Apoteker', 'Apotek'],
      ['Benih', 'Tanaman', 'Telur', 'Anak ayam'], ['Nelayan', 'Jala', 'Petani', 'Cangkul'],
    ];
    const pair = r.pick(pairs);
    const distractors = r.shuffle(['Ukuran', 'Kecepatan', 'Arah', 'Waktu', 'Buku', 'Bangunan', 'Rumah', 'Pasien', 'Warna'].filter((value) => value !== pair[3])).slice(0, 4);
    q.stem = pair[0] + ' : ' + pair[1] + ' = ' + pair[2] + ' : ...';
    q.explanation = 'Pertahankan hubungan pasangan pertama. Hubungan ' + pair[0] + ' dengan ' + pair[1] + ' setara dengan hubungan ' + pair[2] + ' dengan ' + pair[3] + '.';
    return logicChoices(q, [pair[3], ...distractors], [q.explanation, ...distractors.map(() => 'Pilihan ini tidak mempertahankan hubungan pasangan pertama.')]);
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
  if (family.id === 'posisi') {
    const names = r.shuffle(NAMES).slice(0, difficulty === 'sedang' ? 4 : difficulty === 'sulit' ? 5 : 6);
    const order = r.shuffle(names), position = r.int(2, names.length - 1);
    const clues = r.shuffle(order.slice(0, -1).map((name, i) => name + ' tepat di sebelah kiri ' + order[i + 1] + '.'));
    q.stem = names.join(', ') + ' duduk pada satu baris dari kiri ke kanan. ' + clues.join(' ') + '\nSiapa yang berada pada posisi ke-' + position + ' dari kiri?';
    const answer = order[position - 1];
    const texts = [answer, ...r.shuffle(names.filter((name) => name !== answer)).slice(0, 3)];
    while (texts.length < 5) texts.push('Tidak dapat ditentukan');
    q.explanation = 'Gabungkan pasangan yang harus berdampingan sesuai arah kiri–kanan. Susunan tunggal adalah ' + order.join(' – ') + '. Posisi ke-' + position + ' adalah ' + answer + '.';
    return logicChoices(q, texts, texts.map((text) => text === answer ? q.explanation : 'Tidak sesuai posisi pada susunan yang memenuhi seluruh petunjuk.'));
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
      'Program tersebut banyak diberitakan dalam beberapa bulan terakhir.', 'Pelaksana program mempunyai pengalaman kerja yang panjang.', 'Jumlah peserta kegiatan berubah setiap tahun.'];
    return logicChoices(q, texts, [q.explanation, 'Pernyataan ini justru mengarah pada pengaruh yang berlawanan.',
      'Popularitas berita tidak menguji hubungan sebab dan hasil.', 'Pengalaman pelaksana bukan bukti langsung hubungan yang diklaim.', 'Perubahan jumlah saja tidak menjelaskan hasil yang diklaim.']);
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
    return logicChoices(q, [
      names[1] + ' mengikuti ' + activities[0] + ' dan tidak mengikuti ' + activities[1] + '.',
      names[0] + ' mengikuti kedua kegiatan.', names[1] + ' mengikuti kedua kegiatan.',
      names[2] + ' mengikuti kedua kegiatan.', 'Tidak ada peserta yang mengikuti ' + activities[0] + '.',
    ], [q.explanation, 'Kegiatan kedua hanya diikuti peserta ketiga.', 'Kegiatan kedua hanya diikuti peserta ketiga.',
      'Peserta ketiga tidak mengikuti kegiatan pertama.', 'Ada tepat dua peserta yang mengikuti kegiatan pertama.']);
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
    return numeric(q, paths[0], r, edges.filter(([from]) => from === 0).map(([, to]) => paths[to]).join('+'));
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
    return numeric(q, answer, r, starts[0] + '+3*' + steps[0]);
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
    q.stem = 'Pada setiap kolom, bilangan tengah = ' + factor + ' × bilangan atas + bilangan bawah. Nilai yang menggantikan tanda tanya adalah ...';
    q.explanation = 'Balikkan hubungan: bilangan bawah = bilangan tengah − ' + factor + ' × bilangan atas. Pada kolom ketiga: ' +
      middle[2] + ' − ' + factor + ' × ' + top[2] + ' = ' + bottom[2] + '.';
    return numeric(q, bottom[2], r, middle[2] + '-' + factor + '*' + top[2]);
  }
  if (family.id === 'pernyataan-tabel') {
    const products = ['Pulpen', 'Buku', 'Pensil'], prices = [r.int(3, 7) * 1000, r.int(8, 15) * 1000, r.int(2, 5) * 1000];
    const trueStatements = r.shuffle([1, 2, 3, 4]).slice(0, 2).sort();
    const statements: string[] = [], reasons: string[] = [];
    for (let i = 0; i < 4; i++) {
      const amounts = products.map(() => r.int(1, 4)), total = amounts.reduce((sum, n, j) => sum + n * prices[j], 0);
      const offered = trueStatements.includes(i + 1) ? total : total + r.int(1, 3) * 1000;
      statements.push('(' + (i + 1) + ') ' + amounts.map((n, j) => n + ' ' + products[j].toLowerCase()).join(', ') + ' berharga Rp' + offered + '.');
      reasons.push('Pernyataan ' + (i + 1) + ': harga sebenarnya Rp' + total + ', sehingga ' + (total === offered ? 'benar' : 'salah') + '.');
    }
    const correct = trueStatements.join(' dan ');
    const combinations = ['1 dan 2', '1 dan 3', '1 dan 4', '2 dan 3', '2 dan 4', '3 dan 4'].filter((text) => text !== correct);
    q.table = { headers: ['Barang', 'Harga satuan'], rows: products.map((product, i) => [product, 'Rp' + prices[i]]) };
    q.stem = statements.join('\n') + '\nKombinasi dua pernyataan yang benar adalah ...';
    q.explanation = reasons.join(' ');
    return logicChoices(q, [correct, ...r.shuffle(combinations).slice(0, 4)], [q.explanation, ...Array(4).fill('Setidaknya satu pernyataan dalam kombinasi ini salah menurut perhitungan harga.')]);
  }
  if (family.id === 'cerita-hitung') {
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
  const shapes: Figure['shape'][] = ['triangle', 'square', 'circle', 'diamond'];
  const shape = r.pick(shapes), angle = r.int(0, 7) * 45, count = r.int(1, 3), fill = r.int(0, 2);
  const first: Figure = { shape, angle, count, fill };
  const turn = difficulty === 'mudah' ? 90 : r.pick([45, 90, 135, 180, 225]);
  const step = difficulty === 'mudah' ? 0 : 1;
  const colorStep = difficulty === 'sulit' || difficulty === 'hots' ? 1 : 0;
  let answer: Figure;
  if (family.id === 'fig-odd') {
    const choices = [0, 1, 2, 3].map((i) => ({ ...first, angle: mod(angle + i * 90) }));
    answer = { ...first, count: count + 1, angle: mod(angle + 45) };
    q.visual = { kind: 'ketidaksamaan', columns: 5, figures: [] };
    q.stem = 'Pilih satu gambar yang berbeda. Orientasi panah boleh berbeda; perhatikan jenis bangun, warna, dan jumlah titik.';
    q.explanation = 'Empat gambar memiliki jenis bangun, warna, dan jumlah titik yang sama. Satu gambar mempunyai jumlah titik berbeda.';
    q.options = [answer, ...choices].map((figure, i) => ({ text: 'Gambar ' + (i + 1), figure, score: i === 0 ? 5 : 0,
      reason: i === 0 ? 'Jumlah titik berbeda dari empat gambar lainnya.' : 'Ciri bangun, warna, dan jumlah titik sama dengan kelompok mayoritas.' }));
    q.proof = { kind: 'figure', answer, odd: true };
    return q;
  }
  if (family.id === 'fig-analogi') {
    const second = { ...first, angle: mod(angle + turn), count: count + step, fill: mod(fill + colorStep, 3) };
    const third: Figure = { shape: r.pick(shapes), angle: r.int(0, 7) * 45, count: r.int(1, 4), fill: r.int(0, 2) };
    answer = { ...third, angle: mod(third.angle + turn), count: third.count + step, fill: mod(third.fill + colorStep, 3) };
    q.visual = { kind: 'analogi', columns: 4, figures: [first, second, third, null] };
    q.stem = 'Hubungan gambar 1 terhadap gambar 2 diterapkan pada gambar 3. Pilih gambar pengganti tanda tanya. Warna mengikuti urutan putih → gelap → abu → putih.';
  } else if (family.id === 'fig-serial') {
    const figures = Array.from({ length: 4 }, (_, i) => ({ ...first, angle: mod(angle + i * turn), count: count + i * step, fill: mod(fill + i * colorStep, 3) }));
    answer = { ...first, angle: mod(angle + 4 * turn), count: count + 4 * step, fill: mod(fill + 4 * colorStep, 3) };
    q.visual = { kind: 'serial', columns: 5, figures: [...figures, null] };
    q.stem = 'Pilih gambar yang melanjutkan urutan. Warna mengikuti siklus putih → gelap → abu → putih.';
  } else {
    const figures = Array.from({ length: 8 }, (_, i) => {
      const row = Math.floor(i / 3), col = i % 3;
      return { shape: shapes[(shapes.indexOf(shape) + row) % shapes.length], angle: mod(angle + row * 45 + col * turn),
        count: count + row + col, fill: mod(fill + row + col * colorStep, 3) };
    });
    answer = { shape: shapes[(shapes.indexOf(shape) + 2) % shapes.length], angle: mod(angle + 90 + 2 * turn),
      count: count + 4, fill: mod(fill + 2 + 2 * colorStep, 3) };
    q.visual = { kind: 'matriks', columns: 3, figures: [...figures, null] };
    q.stem = 'Perubahan di setiap baris mengikuti aturan yang sama. Pilih gambar untuk kotak kanan bawah. Warna mengikuti siklus putih → gelap → abu → putih.';
  }
  const candidates: Figure[] = [answer];
  const seen = new Set([figureSignature(answer)]);
  while (candidates.length < 5) {
    const candidate = { ...answer };
    const feature = r.pick(['angle', 'count', 'fill'] as const);
    if (feature === 'angle') candidate.angle = mod(answer.angle + r.int(1, 7) * 45);
    if (feature === 'count') candidate.count = mod(answer.count + r.int(1, 3), 8) + 1;
    if (feature === 'fill') candidate.fill = mod(answer.fill + r.int(1, 2), 3);
    const signature = figureSignature(candidate);
    if (!seen.has(signature)) { candidates.push(candidate); seen.add(signature); }
  }
  q.options = candidates.map((figure, index) => ({ text: 'Gambar ' + (index + 1), figure, score: index === 0 ? 5 : 0,
    reason: index === 0 ? 'Seluruh ciri sesuai pola perubahan.' : 'Setidaknya satu ciri orientasi, warna, atau jumlah titik tidak sesuai pola.' }));
  q.explanation = 'Periksa arah panah, jumlah titik, dan warna secara terpisah. ' +
    (family.id === 'fig-matrix' ? 'Lanjutkan perubahan dua kotak pertama pada baris terakhir.' :
      'Arah berubah ' + turn + '°, titik berubah ' + step + ', dan warna bergeser ' + colorStep + ' langkah pada siklus.') +
    ' Gambar jawaban mempunyai ' + answer.count + ' titik dan panah pada sudut ' + answer.angle + '°.';
  q.proof = { kind: 'figure', answer };
  return q;
}
