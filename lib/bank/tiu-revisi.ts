// Revisi QC akademik #2 (3 Nov 2026) untuk contoh TIU diterima (data/tryout-reference.json, hasil scripts/import-tryouts.py dari dokumen sumber).
// Dipasang saat bank dimuat (lib/bank/index.ts), sesudah format sumber dipulihkan (lib/academic-format.ts), sehingga data sumber dan pemeriksa regresi format
// sumber tetap utuh. Revisi per chapter berlaku untuk semua butir chapter itu (juga butir yang ditambahkan kemudian bila bentuknya sama); revisi per butir
// hanya untuk naskah yang memang ditulis ulang (Tabel Pernyataan menurut naskah QC bagian 7, Susunan & Posisi, contoh ketidakcukupan data).
// Kunci dan urutan opsi tidak pernah diubah.
import type { BankItem, Difficulty } from '../types';
import { tableLines } from '../explanation';
import { stripMarks } from '../richtext';
import { towewMeaning } from '../tiu-deret';

const lines = (text: string) => text.split('\n');
const plainDigits = (text: string) => text.replace(/[\u{1D7CE}-\u{1D7D7}]/gu, (d) => String(d.codePointAt(0)! - 0x1d7ce));

// ---- Perkalian Setara dan Pembagian Setara (soal 43–44) ------------------------------------------------------------------------------------------
// Pasangan yang belum terbukti sama ditulis "dibandingkan dengan", perkalian silang didahului "Uji apakah", pasangan yang gugur ditulis dengan ≠, dan digit
// terakhir dinyatakan hanya menyaring (berbeda = pasti tidak sama; sama = belum terbukti).
export const DIGIT_FILTER = 'Digit terakhir hanya menyaring. Jika digit terakhir kedua hasil kali berbeda, kedua hasil kali pasti tidak sama. Jika digit terakhirnya sama, kesamaan belum terbukti, sehingga perkalian penuh tetap harus dihitung.';
const compared = (text: string) => text.replaceAll('**sama dengan**', '**dibandingkan dengan**').replaceAll(' sama dengan ', ' dibandingkan dengan ');
function setara(item: BankItem): BankItem {
  const out: string[] = [];
  let pair: [string, string] | undefined;
  const results = () => { const found = out.slice(-2).map((line) => /^[\d×]+=(\d+)$/.exec(stripMarks(line))?.[1]); return found.length === 2 && found.every(Boolean) ? found as string[] : undefined; };
  for (const raw of lines(item.explanation)) {
    let line = compared(raw);
    const plain = stripMarks(line), head = /^([A-E])\.\s*(.+?)\s*dibandingkan dengan\s*(.+)$/.exec(plainDigits(plain));
    if (/^\*\*[A-E]\.\*\*/.test(line) && head) pair = [head[2].replace(/\s+/g, ''), head[3].replace(/\s+/g, '')];
    if (/^\(\d+\)\/\(\d+\)=\(\d+\)\/\(\d+\)$/.test(plain)) line = 'Uji apakah ' + plain + ':';
    else if (plain === 'Jika hasil digit terakhirnya sama, maka lanjutkan pengerjaan. Jika tidak sama, maka lanjutkan ke opsi berikutnya.') line = DIGIT_FILTER;
    else if (plain === 'Karena digit terakhirnya berbeda, maka lanjutkan ke opsi selanjutnya.') line = 'Karena digit terakhirnya berbeda, kedua hasil kali pasti tidak sama' + (pair ? ': ' + pair[0] + ' ≠ ' + pair[1] : '') + '. Lanjutkan ke opsi selanjutnya.';
    else if (plain === 'Karena digit terakhirnya sama, maka lakukan perkalian penuhnya.') line = 'Digit terakhirnya sama, tetapi kesamaan belum terbukti. Lakukan perkalian penuh.';
    else if (/^Hasil berbeda\./.test(plain)) { const r = results(); line = 'Hasil berbeda' + (r ? ': ' + r[0] + ' ≠ ' + r[1] : '') + '. Lanjutkan ke opsi selanjutnya.'; }
    else if (/^Hasilnya sama\./.test(plain)) { const r = results(); line = plain.replace('Hasilnya sama.', 'Hasilnya sama' + (r ? ': ' + r[0] + ' = ' + r[1] : '') + '.'); }
    out.push(line);
  }
  return { ...item, options: item.options.map((option) => ({ ...option, text: compared(option.text) })), explanation: out.join('\n') };
}

// ---- Deret angka (soal 51): arti "n towew" sebagai banyaknya larik berselang ------------------------------------------------------------------------
function towew(item: BankItem): BankItem {
  const out: string[] = [];
  for (const line of lines(item.explanation)) {
    out.push(line);
    const n = /artinya (\d+) towew$/.exec(stripMarks(line))?.[1];
    if (n && !item.explanation.includes(towewMeaning(Number(n)))) out.push(towewMeaning(Number(n)));
  }
  return { ...item, explanation: out.join('\n') };
}

// ---- Matriks Deret (soal 53): aturan diuji pada dua baris/kolom contoh sebelum diterapkan pada baris/kolom yang memuat x ----------------------------------
function matriks(item: BankItem): BankItem {
  const all = lines(item.explanation), steps = all.map((line) => /^(Baris|Kolom) (pertama|kedua|ketiga):/.exec(stripMarks(line))?.[1].toLowerCase());
  const first = steps.findIndex(Boolean), apply = all.findIndex((line, i) => steps[i] && /(^|[^a-z])x([^a-z]|$)/.test(stripMarks(line).replace(/^\S+ \S+:/, '')));
  if (first < 0 || apply < 0 || all.some((line) => stripMarks(line).startsWith('Periksa aturan itu'))) return item;
  const axis = steps[first]!;
  const out = all.flatMap((line, i): string[] => {
    if (!steps[i]) return [line];
    if (i === apply) return ['Aturan itu berlaku pada kedua ' + axis + ' contoh, sehingga dapat diterapkan pada ' + axis + ' yang memuat x:', line];
    const example = line.replace(/\.$/, '') + ' (sesuai dengan tabel).';
    return i === first ? ['Periksa aturan itu pada dua ' + axis + ' yang lengkap lebih dahulu:', example] : [example];
  });
  return { ...item, explanation: out.join('\n') };
}

// ---- Pola Bilangan Tabel (soal 54–55): notasi Uₙ bersubskrip dan aturan label kesulitan ---------------------------------------------------------------
// Rumus yang memuat U ditulis sebagai LaTeX eksplisit (U_{n}, U_{15}) supaya subskripnya sama di layar, PDF, Word, dan SiAdu.
const texOf = (formula: string) => formula.replace(/−/g, '-').replace(/\^\(([^()]+)\)/g, '^{$1}').replace(/×/g, '\\times ').replace(/\s+/g, ' ').trim();
const withSubscripts = (line: string) => line.replace(/\bU(n|\d+)\b([=0-9n+\-−×÷()^ ]*[0-9n)])?/g, (_, sub: string, rest = '') => '\\(' + texOf('U_{' + sub + '}' + rest) + '\\)');
// Label: linear = mudah; kuadrat, atau geometri yang rasionya terbaca dari dua urutan berurutan = sedang; geometri yang rasionya harus diturunkan dari urutan
// yang tidak berurutan = sulit. (Soal 54 dahulu berlabel Sulit walau U₁ = 2 dan U₂ = 6 langsung memperlihatkan rasio 3.)
export function polaLevel(item: Pick<BankItem, 'explanation' | 'table'>): { level: Difficulty; reason: string } | undefined {
  // Baris rumus dibaca dari bentuk sumber ("Un=…") maupun bentuk bersubskrip ("\(U_{n}=…\)").
  const normal = (line: string) => line.replace(/\\[()]/g, '').replace(/U_\{n\}/g, 'Un').replace(/\^\{([^{}]+)\}/g, '^($1)').replace(/\\times\s*/g, '×').replace(/-/g, '−');
  const rule = lines(item.explanation).map((line) => normal(stripMarks(line))).find((line) => /^Un=/.test(line));
  if (!rule || !item.table) return undefined;
  const known = item.table.rows.filter((row) => row[1] !== '?').map((row) => Number(row[0]));
  const consecutive = known.some((n, i) => i > 0 && n - known[i - 1] === 1);
  if (/\^\(n[−-]1\)/.test(rule)) return consecutive ? { level: 'sedang', reason: 'pola geometri; rasionya terbaca langsung dari dua urutan berurutan' } : { level: 'sulit', reason: 'pola geometri; rasionya harus diturunkan dari urutan yang tidak berurutan' };
  if (/n\^\(2\)/.test(rule)) return { level: 'sedang', reason: 'pola kuadrat' };
  return { level: 'mudah', reason: 'pola linear' };
}
function polaTabel(item: BankItem): BankItem {
  const level = polaLevel(item);
  const explanation = lines(item.explanation).map((line) => line.includes('\\(') ? line : withSubscripts(line.replace(/urutan ke-n, dengan n menyatakan/, 'urutan ke-\\(n\\), dengan \\(n\\) menyatakan'))).join('\n');
  return { ...item, explanation, ...(level ? { difficulty: level.level,
    difficultyReason: 'Aturan label Pola Bilangan Tabel (QC akademik #2): pola linear = mudah; pola kuadrat atau geometri yang rasionya terbaca dari dua urutan berurutan = sedang; geometri yang rasionya harus diturunkan dari urutan tidak berurutan = sulit. Butir ini: ' + level.reason + '. Label sumber: ' + (item.provenance?.declaredDifficulty ?? item.difficulty) + '.' } : {}) };
}

// ---- Tabel Pernyataan (soal 56–57, naskah QC bagian 7): tabel hitungan, klaim, dan status; eliminasi opsi; tabel komparasi biaya dan kelayakan -------------
type Rewrite = { explanation: string; tip: string };
const block = (...parts: (string | string[])[]) => parts.flat().join('\n');
const ELIMINASI = 'Eliminasi opsi:';
const PERNYATAAN_TIP = 'Uji pernyataan yang paling membedakan pilihan untuk eliminasi awal, lalu pastikan opsi akhir memuat seluruh pernyataan benar tanpa tambahan pernyataan salah.';
const REWRITE: Record<string, Rewrite> = {
  'tryout-ref-00-43': { tip: PERNYATAAN_TIP, explanation: block(
    'Harga satuan pada tabel berlaku untuk semua pembelian tanpa biaya tambahan. Periksa setiap pernyataan dengan menjumlahkan banyak barang × harga satuannya. Tabel berikut menunjukkan nilai yang seharusnya, bukan hanya status benar/salah.',
    tableLines({ headers: ['No.', 'Hitungan (rupiah)', 'Klaim', 'Status'], rows: [
      ['(1)', '2 × 8.000 + 10.000 = 26.000', 'Rp26.000', '**Benar**'], ['(2)', '12.000 + 2 × 7.000 = 26.000', 'Rp25.000', 'Salah'],
      ['(3)', '2 × 10.000 + 7.000 = 27.000', 'Rp27.000', '**Benar**'], ['(4)', '3 × 8.000 + 12.000 = 36.000', 'Rp35.000', 'Salah']] }),
    'Pernyataan (1) benar karena 2 × 8.000 + 10.000 = 26.000 rupiah. Pernyataan (2) salah karena 12.000 + 2 × 7.000 = 26.000 rupiah, selisih Rp1.000 lebih tinggi daripada klaim. Pernyataan (3) benar karena 2 × 10.000 + 7.000 = 27.000 rupiah. Pernyataan (4) salah karena 3 × 8.000 + 12.000 = 36.000 rupiah, selisih Rp1.000 lebih tinggi daripada klaim.',
    ELIMINASI, 'A memuat (2) yang salah dan belum memuat (3).', 'B memuat (2) yang salah dan belum memuat (1).', 'C memuat (4) yang salah dan belum memuat (3).',
    'D memuat tepat seluruh pernyataan benar, yaitu (1) dan (3).', 'E memuat tambahan (4) yang salah.', 'Jadi, jawaban yang benar adalah D.') },
  'tryout-ref-00-44': { tip: 'Hitung total tiap RW sekali, lalu pakai ulang untuk pernyataan (1) dan (4). Pastikan opsi akhir memuat seluruh pernyataan benar tanpa tambahan pernyataan salah.', explanation: block(
    'Setiap peserta hanya terdaftar pada satu kegiatan, sehingga total peserta tiap RW adalah jumlah keempat kegiatannya. Hitung nilai sebenarnya dari tabel untuk setiap pernyataan, lalu bandingkan dengan klaimnya.',
    tableLines({ headers: ['No.', 'Hitungan', 'Klaim', 'Status'], rows: [
      ['(1)', 'RW 01: 18 + 9 + 11 + 7 = 45; RW 02: 15 + 12 + 8 + 10 = 45', 'Total RW 01 sama dengan total RW 02', '**Benar**'],
      ['(2)', '11 + 8 + 9 = 28', '28 orang', '**Benar**'], ['(3)', 'Kebun warga: RW 03 ada 14 orang, RW 02 ada 12 orang, RW 01 ada 9 orang', 'RW 03 terbanyak', '**Benar**'],
      ['(4)', 'RW 03: 12 + 14 + 9 + 9 = 44; selisih 45 − 44 = 1', '2 orang', 'Salah']] }),
    'Pernyataan (1), (2), dan (3) sesuai dengan tabel. Pernyataan (4) salah karena total RW 02 adalah 45 orang dan total RW 03 adalah 44 orang, sehingga selisihnya 1 orang, bukan 2 orang.',
    ELIMINASI, 'A belum memuat (3) yang benar.', 'B memuat tepat seluruh pernyataan benar, yaitu (1), (2), dan (3).', 'C memuat (4) yang salah dan belum memuat (1).',
    'D memuat (4) yang salah dan belum memuat (2).', 'E memuat tambahan (4) yang salah.', 'Jadi, jawaban yang benar adalah B.') },
  'tryout-ref-00-45': { tip: 'Hitung stok akhir keempat barang sekali (stok awal + masuk − keluar), lalu pakai ulang untuk semua pernyataan. Opsi akhir harus memuat seluruh pernyataan benar tanpa tambahan pernyataan salah.', explanation: block(
    'Stok akhir setiap barang dihitung dari stok awal ditambah barang masuk, lalu dikurangi barang keluar. Hitung nilai sebenarnya untuk setiap pernyataan, lalu bandingkan dengan klaimnya.',
    tableLines({ headers: ['No.', 'Hitungan (karton)', 'Klaim', 'Status'], rows: [
      ['(1)', 'Beras: 40 + 15 − 22 = 33', '32 karton', 'Salah'], ['(2)', 'Minyak: 25 + 20 − 16 = 29', '29 karton', '**Benar**'],
      ['(3)', 'Gula: 30 + 12 − 18 = 24; tepung: 35 + 10 − 24 = 21; selisih 24 − 21 = 3', 'Lebih banyak 8 karton', 'Salah'],
      ['(4)', '33 + 24 + 29 + 21 = 107', '107 karton', '**Benar**']] }),
    'Pernyataan (1) salah karena stok akhir beras 33 karton, 1 karton lebih banyak daripada klaim. Pernyataan (3) salah karena stok akhir gula hanya 3 karton lebih banyak daripada tepung, bukan 8 karton. Pernyataan (2) dan (4) sesuai dengan hasil hitungan.',
    ELIMINASI, 'A memuat tepat seluruh pernyataan benar, yaitu (2) dan (4).', 'B memuat (1) dan (3) yang salah serta belum memuat (2) dan (4).', 'C memuat tambahan (1) yang salah.',
    'D memuat tambahan (3) yang salah.', 'E memuat tambahan (1) dan (3) yang salah.', 'Jadi, jawaban yang benar adalah A.') },
  'tryout-ref-00-46': { tip: 'Coret dahulu opsi yang kapasitasnya kurang dari jumlah peserta, lalu hitung kursi kosong opsi yang tersisa. Kursi kosong yang tepat sama dengan batas tetap memenuhi syarat "tidak lebih dari".', explanation: block(
    'Dua ketentuan harus dipenuhi sekaligus: kapasitas sekurang-kurangnya 264 kursi dan kursi kosong paling banyak 12. Misalkan a, b, dan c banyak bus A, B, dan C. Kapasitas = 32a + 44b + 60c dan kursi kosong = kapasitas − 264.',
    tableLines({ headers: ['Opsi', 'Kombinasi bus', 'Kapasitas', 'Kursi kosong', 'Kelayakan'], rows: [
      ['A', '2 bus A dan 3 bus C', '2 × 32 + 3 × 60 = 244', 'kurang 20 kursi', 'Kursi tidak cukup'],
      ['B', '3 bus A dan 3 bus C', '3 × 32 + 3 × 60 = 276', '276 − 264 = 12', '**Memenuhi kedua ketentuan**'],
      ['C', '3 bus A, 2 bus B, dan 2 bus C', '3 × 32 + 2 × 44 + 2 × 60 = 304', '304 − 264 = 40', 'Kursi kosong lebih dari 12'],
      ['D', '3 bus A, 1 bus B, dan 2 bus C', '3 × 32 + 44 + 2 × 60 = 260', 'kurang 4 kursi', 'Kursi tidak cukup'],
      ['E', '2 bus A, 1 bus B, dan 3 bus C', '2 × 32 + 44 + 3 × 60 = 288', '288 − 264 = 24', 'Kursi kosong lebih dari 12']] }),
    'Ketentuan (1) mencoret A dan D karena kapasitasnya kurang dari 264 kursi. Ketentuan (2) mencoret C dan E karena kursi kosongnya 40 dan 24. Hanya B yang memenuhi keduanya: 276 kursi dengan tepat 12 kursi kosong, dan batas "tidak lebih dari 12" mencakup tepat 12.',
    'Kapasitas terbesar (opsi C) bukan tujuan soal; justru kelebihan kursinya melanggar batas kursi kosong.', 'Jadi, jawaban yang benar adalah B.') },
  'tryout-ref-00-47': { tip: 'Coret opsi yang tidak cukup kursi, hitung biaya total opsi layak, lalu bandingkan. Jangan memilih hanya dari harga per kursi atau jumlah kursi yang paling pas.', explanation: block(
    'Dua syarat harus dipenuhi secara berurutan: kapasitas sekurang-kurangnya 130 kursi, lalu biaya total terkecil di antara pilihan. Misalkan a, b, dan c banyak bus jenis A, B, C. Kapasitas = 20a + 35b + 50c; biaya dalam rupiah = \\(900.000a+1.330.000b+1.800.000c\\). Kelebihan kursi diperbolehkan karena tidak ada syarat harus tepat 130.',
    tableLines({ headers: ['Opsi', 'Kombinasi bus', 'Kapasitas', 'Biaya total', 'Kelayakan'], rows: [
      ['A', '7 bus A', '140 kursi', 'Rp6.300.000', 'Cukup'], ['B', '4 bus B', '140 kursi', 'Rp5.320.000', 'Cukup'], ['C', '4 bus A dan 1 bus C', '130 kursi', 'Rp5.400.000', 'Cukup'],
      ['D', '3 bus C', '150 kursi', 'Rp5.400.000', 'Cukup'], ['E', '1 bus B dan 2 bus C', '135 kursi', '**Rp4.930.000**', '**Cukup; termurah**']] }),
    'Seluruh opsi memenuhi kapasitas. Opsi E memuat 1 bus B dan 2 bus C dengan 35 + 2 × 50 = 135 kursi dan biaya \\(1.330.000+2\\times 1.800.000=4.930.000\\) rupiah. Biaya ini Rp390.000 lebih rendah daripada opsi B, Rp470.000 lebih rendah daripada C maupun D, dan Rp1.370.000 lebih rendah daripada A. Jadi, E merupakan pilihan paling hemat di antara opsi yang tersedia.',
    'Harga per kursi: A Rp45.000; B Rp38.000; C Rp36.000. Angka ini membantu melihat efisiensi, tetapi tidak cukup menjadi dasar jawaban karena bus disewa utuh. Tiga bus C memang memakai jenis termurah per kursi, namun memberi 150 kursi seharga Rp5.400.000; mencampur 1 B dan 2 C justru lebih murah. Opsi C memberi tepat 130 kursi, tetapi tepat kapasitas bukan tujuan minimum biaya.',
    'Jadi, jawaban yang benar adalah E.') },
  'tryout-ref-00-48': { tip: 'Coret opsi yang melanggar salah satu ketentuan (anggaran, jumlah baki, atau stok baki C), lalu pilih kapasitas terbesar di antara opsi yang tersisa. Jangan memilih hanya dari kapasitas terbesar atau biaya per bibit.', explanation: block(
    'Tiga ketentuan harus dipenuhi sekaligus: biaya paling banyak Rp70.000, jumlah baki paling banyak 6, dan baki C paling banyak 2 buah. Di antara opsi yang memenuhi semuanya, dipilih kapasitas terbesar.',
    tableLines({ headers: ['Opsi', 'Kombinasi baki', 'Kapasitas (bibit)', 'Biaya (rupiah)', 'Kelayakan'], rows: [
      ['A', '6 baki B', '6 × 20 = 120', '6 × 11.000 = 66.000', 'Layak'],
      ['B', '1 baki A, 4 baki B, dan 1 baki C', '12 + 4 × 20 + 30 = 122', '7.000 + 4 × 11.000 + 16.000 = 67.000', 'Layak'],
      ['C', '2 baki A, 2 baki B, dan 2 baki C', '2 × 12 + 2 × 20 + 2 × 30 = 124', '2 × 7.000 + 2 × 11.000 + 2 × 16.000 = 68.000', '**Layak; kapasitas terbesar**'],
      ['D', '1 baki A, 3 baki B, dan 2 baki C', '12 + 3 × 20 + 2 × 30 = 132', '7.000 + 3 × 11.000 + 2 × 16.000 = 72.000', 'Melebihi anggaran'],
      ['E', '3 baki A dan 3 baki C', '3 × 12 + 3 × 30 = 126', '3 × 7.000 + 3 × 16.000 = 69.000', 'Baki C lebih dari 2']] }),
    'Semua opsi memakai 6 baki. D dan E menampung lebih banyak bibit daripada C, tetapi melanggar ketentuan: D memerlukan biaya Rp72.000, melebihi anggaran Rp70.000, dan E memerlukan 3 baki C, padahal hanya tersedia 2. Di antara opsi yang layak (A, B, dan C), kapasitas terbesar adalah 124 bibit pada C.',
    'Biaya per bibit (A sekitar Rp583, B Rp550, C sekitar Rp533) membantu melihat efisiensi, tetapi bukan dasar jawaban karena jumlah baki dan stok baki C dibatasi.',
    'Jadi, jawaban yang benar adalah C.') },
};

// ---- Susunan & Posisi (soal 40–41) -------------------------------------------------------------------------------------------------------------------
// Soal berkas: semua kalimat menyebut "berkas X" sampai pembahasan. Soal baris-kolom: kursi kiri–kanan tidak semuanya pasti, jadi tabelnya diberi judul.
const BERKAS_STEM = 'Enam berkas milik Ardi, Beni, Caca, Dini, Ega, dan Fina disusun berjajar pada rak bernomor 1 sampai 6 dari kiri ke kanan. Berkas Caca berada di posisi keempat. Berkas Beni berada tepat di sebelah kiri berkas Caca. Berkas Fina berada tepat di sebelah kanan berkas Caca. Berkas Ardi berada di sebelah kiri berkas Beni. Berkas Dini berada tepat di sebelah kanan berkas Ardi. Berkas Ega berada di sebelah kanan berkas Fina.\nBerkas siapa yang berada pada posisi kedua?';
const BERKAS: Rewrite = { tip: '', explanation: block(
  'Berkas Caca berada di posisi keempat dari kiri. Informasi ini menjadi patokan karena posisinya sudah pasti dan tidak bergantung pada berkas lain. Berkas Beni berada tepat di sebelah kiri berkas Caca. Kata “tepat” berarti tidak ada berkas lain di antara keduanya, sehingga berkas Beni menempati posisi ketiga. Dengan alasan yang sama, berkas Fina yang tepat di sebelah kanan berkas Caca berada di posisi kelima.',
  'Berkas Ega berada di sebelah kanan berkas Fina. Karena berkas Fina sudah menempati posisi kelima dan rak hanya memiliki enam tempat, satu-satunya tempat di sebelah kanannya adalah posisi keenam. Maka posisi keenam ditempati berkas Ega.',
  'Posisi ketiga sampai keenam sudah terisi berkas Beni, Caca, Fina, dan Ega. Posisi yang tersisa adalah posisi pertama dan kedua untuk berkas Ardi dan berkas Dini. Berkas Ardi berada di sebelah kiri berkas Beni, dan berkas Dini tepat di sebelah kanan berkas Ardi. Jika berkas Ardi ditempatkan di posisi kedua, berkas Dini harus berada di posisi ketiga yang sudah diisi berkas Beni. Karena itu, berkas Ardi berada di posisi pertama dan berkas Dini di posisi kedua.',
  'Susunan berkas dari kiri ke kanan adalah berkas Ardi, Dini, Beni, Caca, Fina, dan Ega. Dengan demikian, berkas yang berada pada posisi kedua adalah berkas Dini.',
  tableLines({ headers: ['**Posisi 1**', '**Posisi 2**', '**Posisi 3**', '**Posisi 4**', '**Posisi 5**', '**Posisi 6**'], rows: [['Ardi', 'Dini', 'Beni', 'Caca', 'Fina', 'Ega']] }),
  'Jadi, jawaban yang benar adalah C.') };
export const SALAH_SATU = '**Salah satu susunan yang memenuhi syarat**';
const SEATS_NOTE = 'Yang pasti hanya baris setiap peserta. Kursi kiri dan kanan pada setiap baris dapat bertukar: Gani dan Hira (Intan ikut berpindah karena selalu tepat di belakang Gani, sehingga Intan dan Joko juga bertukar), Kila dan Luki, serta Mira dan Nando.';
function seats(item: BankItem): BankItem {
  if (item.explanation.includes(SALAH_SATU)) return item;
  const all = lines(item.explanation), at = all.findIndex((line) => /^\|.*Baris.*\|.*Kiri.*\|/.test(stripMarks(line)));
  if (at < 0) return item;
  let end = at; while (end + 1 < all.length && all[end + 1].startsWith('|')) end++;
  return { ...item, explanation: [...all.slice(0, at), SALAH_SATU, ...all.slice(at, end + 1), SEATS_NOTE, ...all.slice(end + 1)].join('\n') };
}

// ---- Kecukupan data (soal 50): setiap pernyataan yang tidak cukup dicontohkan dengan dua kemungkinan yang hasilnya berbeda -----------------------------
const COUNTER: Record<string, [string, string][]> = {
  'tryout-ref-00-19': [
    ['Pernyataan ini belum cukup karena terdapat banyak kemungkinan jumlah peserta pada setiap jenis layanan. Harga kedua layanan berbeda, sehingga total pendapatan juga dapat berbeda.',
      'Contoh: m=100 dan n=120 memberi P=120.000(100)+60.000(120)=19.200.000, sedangkan m=80 dan n=140 memberi P=120.000(80)+60.000(140)=18.000.000. Keduanya memenuhi m+n=220, tetapi pendapatannya berbeda.'],
    ['Selisih jumlah peserta diketahui, tetapi jumlah peserta masing-masing layanan belum diketahui secara pasti.',
      'Contoh: m=20 dan n=80 memberi P=120.000(20)+60.000(80)=7.200.000, sedangkan m=80 dan n=140 memberi P=18.000.000. Keduanya memenuhi n=m+60, tetapi pendapatannya berbeda.'],
  ],
  'tryout-ref-00-20': [
    ['Nilai u atau persentase keuntungan belum diketahui. Modal belum dapat ditentukan secara pasti.',
      'Contoh: jika keuntungan 35%, modalnya M=27.000÷1,35=20.000; jika keuntungan 50%, modalnya M=27.000÷1,5=18.000. Harga jual sama, tetapi modalnya berbeda.'],
    ['Harga jual belum diketahui. Mengetahui persentase keuntungan saja belum dapat menentukan modal.',
      'Contoh: harga jual Rp27.000 memberi M=27.000÷1,35=20.000, sedangkan harga jual Rp13.500 memberi M=13.500÷1,35=10.000. Persentase keuntungan sama, tetapi modalnya berbeda.'],
  ],
  'tryout-ref-00-23': [['Karena p tidak diketahui, jarak Mobil P belum dapat diketahui secara numerik. Kesamaan jarak belum menentukan jarak Mobil Q.',
    'Contoh: jika Mobil P berjalan 3 jam, JQ=JP=80×3=240 km; jika Mobil P berjalan 6 jam, JQ=JP=80×6=480 km. Kedua kemungkinan memenuhi pernyataan (1), tetapi jaraknya berbeda.']],
  'tryout-ref-00-24': [['Waktu perjalanan Bus R belum diketahui, sehingga jaraknya belum dapat ditentukan secara numerik. Akibatnya, jarak Bus S juga belum dapat diketahui.',
    'Contoh: jika Bus R berjalan 2 jam, JS=JR=72×2=144 km; jika Bus R berjalan 4 jam, JS=JR=72×4=288 km. Kedua kemungkinan memenuhi pernyataan (2), tetapi jaraknya berbeda.']],
  'tryout-ref-00-27': [
    ['Nilai debit total belum diketahui, sehingga waktu pengosongan belum dapat ditentukan secara tunggal.',
      'Contoh: dengan debit total 300 liter/menit, W=12.000÷300=40 menit; dengan debit total 400 liter/menit, W=12.000÷400=30 menit. Volumenya sama, tetapi waktunya berbeda.'],
    ['Volume air belum diketahui dari pernyataan (2) saja, sehingga waktu pengosongan belum dapat ditentukan secara tunggal.',
      'Contoh: volume 12.000 liter memberi W=12.000÷300=40 menit, sedangkan volume 6.000 liter memberi W=6.000÷300=20 menit. Debitnya sama, tetapi waktunya berbeda.'],
  ],
};
function counterexamples(item: BankItem, pairs: [string, string][]): BankItem {
  const out: string[] = [];
  for (const line of lines(item.explanation)) {
    out.push(line);
    const add = pairs.find(([after]) => stripMarks(line) === after)?.[1];
    if (add && !item.explanation.includes(add)) out.push(add);
  }
  return { ...item, explanation: out.join('\n') };
}

export function reviseAcceptedTiu(item: BankItem): BankItem {
  if (item.subtest !== 'TIU' || item.provenance?.status !== 'accepted-example') return item;
  let q = item;
  if (q.subtopic === 'Perkalian Setara' || q.subtopic === 'Pembagian Setara') q = setara(q);
  if (q.subtopic.startsWith('Deret Angka')) q = towew(q);
  if (q.subtopic === 'Matriks Deret') q = matriks(q);
  if (q.subtopic === 'Pola Bilangan Tabel') q = polaTabel(q);
  if (COUNTER[q.id]) q = counterexamples(q, COUNTER[q.id]);
  if (REWRITE[q.id]) q = { ...q, explanation: REWRITE[q.id].explanation, tip: REWRITE[q.id].tip };
  if (q.id === 'tryout-ref-11-01') q = { ...q, stem: BERKAS_STEM, explanation: BERKAS.explanation };
  if (q.id === 'tryout-ref-11-02') q = seats(q);
  return q;
}
