// Bahan bahasa silogisme: kerangka konteks (subjek dan lima proposisi p, q, r, s, t) untuk Silogisme Biasa (ringkas, Bagian 10–11 blueprint) dan Silogisme Narasi
// (panjang, Bagian B; kalimatnya disusun lib/silo-lang.ts dari kerangka kalimat utuh per bentuk logika). Semua proposisi adalah predikat dari satu subjek yang sama, dan lawannya (`neg`) ditulis sehingga persis meniadakan proposisi positifnya
// (Bagian 19–20: "tidak memerlukan" bukan "memerlukan untuk tidak"). Tidak ada kuantor, penghubung bersyarat, atau penanda sebab-akibat di dalam teks ini.
// `pos`/`neg`: predikat positif/negatif ("mengikuti pengarahan" / "tidak mengikuti pengarahan"); `mod`: pewatas setelah subjek ("dengan akses ruang" / "tanpa akses ruang", atau klausa
// "yang berada dalam daftar antrean"); `cat`: predikat kategori ("tercakup dalam daftar antrean" / "tidak tercakup dalam daftar antrean"); `right`: predikat hak di depan ("hak X melekat pada" /
// "hak X tidak melekat pada"); `anto`: pasangan makna (lawan kata sebagai negasi) beserta batas domainnya, yang harus tertulis pada soal. Proposisi ke-5 (t) hanya dipakai pada opsi "informasi tambahan".
// Aturan isi (diperiksa scripts/silogisme-checks.ts): keempat proposisi premis (p sampai s) dipilih acak dari kerangka, jadi tiap pasangan proposisi harus tetap masuk akal dalam
// keempat kombinasi tandanya ("tidak X" atau "X" dengan "tidak Y" atau "Y"). Karena itu proposisi kerangka berupa atribut administratif yang saling bebas, bukan sebab-akibat
// ("katup tertutup mengalirkan air", "gagal pada penilaian memperoleh sertifikat", "mengembalikan buku tepat waktu tidak terbebas dari denda" tidak dipakai).
export type Prop = { pos: string; neg: string; mod?: [string, string]; cat?: [string, string]; right?: [string, string]; anto?: string };
export type Frame = { name: string; ctx: string; subjects: [noun: string, id: string][]; props: Prop[] };
const P = (pos: string, extra: Partial<Prop> = {}): Prop => ({ pos, neg: 'tidak ' + pos, ...extra });
const DENGAN = (noun: string): [string, string] => ['dengan ' + noun, 'tanpa ' + noun];
// Pewatas berbentuk klausa ("yang berada dalam daftar antrean"): terbaca wajar sesudah subjek dan sebelum predikat (bukan "Desain P12 dalam antrean cetak disetujui").
const POSISI = (place: string): [string, string] => ['yang berada dalam ' + place, 'yang berada di luar ' + place];
const CATAT = (place: string): [string, string] => ['yang tercantum dalam ' + place, 'yang tidak tercantum dalam ' + place];
const DAFTAR = (place: string): [string, string] => ['tercakup dalam ' + place, 'tidak tercakup dalam ' + place];
const TERCANTUM = (place: string): [string, string] => ['tercantum dalam ' + place, 'tidak tercantum dalam ' + place];
// Kategori penerima ditulis sebagai daftar ("tercakup dalam daftar penerima kode layanan"), bukan "termasuk penerima ...": "penerima" langsung untuk berkas atau desain terbaca janggal dan,
// bersama pewatas "dengan/tanpa", menghasilkan kalimat seperti "Arman dengan pendaftaran peserta tidak termasuk pemilik hak memilih sesi".
const PEMILIK = (what: string): [string, string] => DAFTAR('daftar penerima ' + what);

export const BIASA_FRAMES: Frame[] = [
  { name: 'Layanan', ctx: 'layanan', subjects: [['Berkas', 'Rafi'], ['Berkas', 'Laila'], ['Berkas', 'R17'], ['Pengajuan', 'Tomi']], props: [
    P('lolos verifikasi', { mod: DENGAN('status lolos verifikasi') }), P('memperoleh kode layanan', { mod: DENGAN('kode layanan'), cat: PEMILIK('kode layanan') }),
    P('masuk daftar antrean', { mod: POSISI('daftar antrean'), cat: DAFTAR('daftar antrean') }), P('mendapat jadwal pemeriksaan lanjutan', { cat: PEMILIK('jadwal pemeriksaan lanjutan') }), P('menerima pemberitahuan tertulis')] },
  { name: 'Perjalanan', ctx: 'perjalanan', subjects: [['Tiket', 'Bayu'], ['Tiket', 'Citra'], ['Tiket', 'K09']], props: [
    P('tervalidasi', { mod: DENGAN('status tervalidasi') }), P('memberi akses ruang tunggu', { mod: DENGAN('akses ruang tunggu') }),
    P('tercatat pada daftar penumpang', { mod: CATAT('daftar penumpang'), cat: TERCANTUM('daftar penumpang') }), P('ditandai untuk pemeriksaan bagasi'), P('memperoleh kursi dekat jendela')] },
  { name: 'Produksi', ctx: 'produksi', subjects: [['Desain', 'Sari'], ['Desain', 'Dimas'], ['Desain', 'P12']], props: [
    P('disetujui', { mod: DENGAN('status disetujui') }), P('masuk antrean pemeriksaan', { mod: POSISI('antrean pemeriksaan'), cat: DAFTAR('antrean pemeriksaan') }),
    P('memiliki nomor kerja', { mod: DENGAN('nomor kerja'), cat: PEMILIK('nomor kerja') }), P('memerlukan penandaan ulang'), P('memperoleh label prioritas')] },
  { name: 'Teknologi', ctx: 'teknologi', subjects: [['Berkas proyek', 'Dewi'], ['Berkas proyek', 'Hadi'], ['Basis data', 'B41']], props: [
    P('tersimpan di server utama'), P('memiliki salinan cadangan', { mod: DENGAN('salinan cadangan') }), P('memerlukan pemulihan data'),
    P('tercatat dalam log pemeriksaan', { mod: CATAT('log pemeriksaan'), cat: TERCANTUM('log pemeriksaan') }), P('diperiksa oleh petugas teknis')] },
  { name: 'Olahraga', ctx: 'olahraga', subjects: [['', 'Rina'], ['', 'Arman'], ['', 'Salsa']], props: [
    P('mendaftar sebagai peserta'), P('mengikuti pemanasan bersama'),
    P('mengambil sesi pagi'), P('menyerahkan kartu peserta'), P('membawa perlengkapan sendiri', { mod: DENGAN('perlengkapan sendiri') })] },
  { name: 'Seni', ctx: 'seni', subjects: [['', 'Laras'], ['', 'Raisa'], ['', 'Mulya']], props: [
    P('mengikuti kelas melukis'), P('mendaftar pada kursus keramik'), P('mengambil sesi seni kertas'), P('membawa peralatan sendiri', { mod: DENGAN('peralatan sendiri') }), P('mengikuti pameran akhir')] },
  { name: 'Lingkungan', ctx: 'lingkungan', subjects: [['Saluran', 'barat'], ['Saluran', 'timur'], ['Jalur irigasi', 'A']], props: [
    P('terhubung ke tangki utama', { mod: DENGAN('sambungan ke tangki utama') }), P('menerima aliran air', { mod: DENGAN('aliran air') }), P('dilengkapi katup pengatur', { mod: DENGAN('katup pengatur') }),
    P('dipantau petugas lapangan'), P('tercatat dalam jadwal pembersihan', { mod: CATAT('jadwal pembersihan'), cat: TERCANTUM('jadwal pembersihan') })] },
  { name: 'Perdagangan', ctx: 'perdagangan', subjects: [['Pesanan', 'Tara'], ['Pesanan', 'Wulan'], ['Pesanan', 'D88']], props: [
    P('memiliki pembayaran terverifikasi', { mod: DENGAN('pembayaran terverifikasi') }), P('masuk antrean proses', { mod: POSISI('antrean proses'), cat: DAFTAR('antrean proses') }),
    P('memperoleh nomor proses', { mod: DENGAN('nomor proses'), cat: PEMILIK('nomor proses') }), P('dikemas dengan bahan pelindung'), P('dilengkapi faktur penjualan', { mod: DENGAN('faktur penjualan') })] },
  { name: 'Perpustakaan', ctx: 'perpustakaan', subjects: [['', 'Mira'], ['', 'Nando'], ['', 'Putri']], props: [
    P('memegang kartu anggota aktif', { mod: DENGAN('kartu anggota aktif') }), P('membaca di ruang referensi'),
    P('mengikuti klub baca'), P('mengisi daftar kunjungan'), P('memperoleh perpanjangan masa pinjam')] },
  { name: 'Pengelolaan dokumen', ctx: 'pengelolaan dokumen', subjects: [['Dokumen', 'R23'], ['Dokumen', 'K14'], ['Dokumen', 'S07']], props: [
    P('ditandatangani', { mod: DENGAN('tanda tangan pengesah') }), P('masuk daftar pemeriksaan', { mod: POSISI('daftar pemeriksaan'), cat: DAFTAR('daftar pemeriksaan') }),
    P('memerlukan revisi'), P('memiliki kode arsip', { mod: DENGAN('kode arsip'), cat: PEMILIK('kode arsip') }), P('dikirim ke bagian hukum')] },
  { name: 'Transportasi', ctx: 'transportasi', subjects: [['Kendaraan', 'T21'], ['Kendaraan', 'T08'], ['Kendaraan', 'V30']], props: [
    P('berada di garasi'), P('menjalani pemeriksaan rem'), P('dijadwalkan menjalani servis berkala'), P('memiliki izin keluar', { mod: DENGAN('izin keluar') }), P('diisi bahan bakar penuh')] },
  { name: 'Kegiatan komunitas', ctx: 'kegiatan komunitas', subjects: [['', 'Fikri'], ['', 'Bimo'], ['', 'Hana']], props: [
    P('mengikuti kegiatan dokumentasi'), P('membawa kamera', { mod: DENGAN('kamera') }), P('membawa tripod', { mod: DENGAN('tripod') }), P('mendapat tugas lapangan', { mod: DENGAN('tugas lapangan') }), P('menghadiri sesi evaluasi')] },
];

// Kerangka narasi (Bagian B blueprint, Bagian 19 dan 20): subjek orang atau berkas tertentu, predikat panjang yang bermakna, dan lima proposisi tulisan tangan. Kalimat premis dan opsi disusun
// dari kerangka kalimat utuh per bentuk logika di lib/silo-lang.ts; kerangka ini hanya menyediakan frasa yang cocok untuk kerangka itu (predikat, pewatas "dengan/tanpa", kategori daftar,
// predikat hak di depan). Tidak ada keterangan rujukan pengisi yang diulang di setiap kalimat: konteks (`ctx`) dipakai paling banyak pada satu kalimat tiap soal.
// Aturan penulisan (diperiksa scripts/silogisme-checks.ts): tidak ada urutan tiga kata yang sama pada dua proposisi berbeda atau antara `ctx` dan proposisi; `ctx` tidak memakai kata benda
// subjek; tiap proposisi dapat dipakai sebagai syarat (pewatas `mod` atau tanpa kata "yang" pada predikat); kategori (`cat`) selalu berupa daftar atau kelompok. Proposisi pertama pada
// kerangka pasangan makna (`anto`) memuat batas domain pada predikatnya sehingga terbaca pada soal. Proposisi kelima (t) hanya dipakai pada opsi informasi tambahan.
export const NARASI_FRAMES: Frame[] = [
  { name: 'Ruang pamer', ctx: 'pemesanan ruang pamer', subjects: [['Pemohon', 'Nadira'], ['Pemohon', 'Rendra'], ['Pemohon', 'Hesti']], props: [
    P('memiliki berkas pengajuan yang dinyatakan lengkap', { mod: DENGAN('berkas pengajuan yang dinyatakan lengkap') }),
    P('berhak memilih jadwal pemakaian ruang', { right: ['hak memilih jadwal pemakaian ruang melekat pada', 'hak memilih jadwal pemakaian ruang tidak melekat pada'],
      mod: ['sebagai pemilik hak memilih jadwal pemakaian ruang', 'yang bukan pemilik hak memilih jadwal pemakaian ruang'], cat: DAFTAR('kelompok pemilik hak memilih jadwal pemakaian ruang') }),
    P('tercantum dalam daftar penjadwalan ruang', { mod: POSISI('daftar penjadwalan ruang'), cat: DAFTAR('daftar penjadwalan ruang') }),
    P('memperoleh nomor agenda pameran', { mod: DENGAN('nomor agenda pameran'), cat: PEMILIK('nomor agenda pameran') }),
    P('menetapkan satu sesi lewat portal pemesanan')] },
  { name: 'Katalog pameran', ctx: 'penyiapan bahan terbitan', subjects: [['Naskah katalog milik', 'Hana'], ['Naskah katalog milik', 'Irfan'], ['Naskah katalog milik', 'Yuni']], props: [
    P('berstatus siap dicetak', { mod: DENGAN('status siap dicetak') }),
    P('tercantum dalam daftar persetujuan penelaah', { mod: POSISI('daftar persetujuan penelaah'), cat: DAFTAR('daftar persetujuan penelaah') }),
    P('memperoleh nomor penerbitan', { mod: DENGAN('nomor penerbitan'), cat: PEMILIK('nomor penerbitan') }),
    P('menjadi bagian dari arsip pameran', { mod: ['yang menjadi bagian dari arsip pameran', 'yang bukan bagian dari arsip pameran'] }),
    P('dikirim ke percetakan rekanan')] },
  { name: 'Koleksi arsip', ctx: 'layanan baca arsip', subjects: [['', 'Nabila'], ['', 'Reza'], ['', 'Salma']], props: [
    P('memegang status pembatasan yang telah dicabut', { mod: DENGAN('status pembatasan yang telah dicabut') }),
    P('wajib didampingi petugas di ruang baca', { right: ['kewajiban didampingi petugas di ruang baca melekat pada', 'kewajiban didampingi petugas di ruang baca tidak melekat pada'] }),
    P('berhak mengajukan peminjaman lewat layanan daring', { right: ['hak mengajukan peminjaman lewat layanan daring melekat pada', 'hak mengajukan peminjaman lewat layanan daring tidak melekat pada'] }),
    P('mengikuti orientasi layanan arsip'),
    P('meminjam koleksi lewat portal mandiri')] },
  { name: 'Peminjaman alat', ctx: 'layanan perlengkapan bersama', subjects: [['Kartu keanggotaan milik', 'Dimas'], ['Kartu keanggotaan milik', 'Fitri'], ['Kartu keanggotaan milik', 'Gilang']], props: [
    P('memerlukan pembaruan data'),
    P('memberi hak mengajukan peminjaman alat lewat layanan daring', { right: ['hak mengajukan peminjaman alat lewat layanan daring melekat pada', 'hak mengajukan peminjaman alat lewat layanan daring tidak melekat pada'], mod: DENGAN('hak mengajukan peminjaman alat lewat layanan daring') }),
    P('tercatat aktif pada sistem layanan'),
    P('dilengkapi foto pemilik kartu', { mod: DENGAN('foto pemilik kartu') }),
    P('dipakai untuk meminta pinjaman alat', { neg: 'tidak dipakai untuk meminta pinjaman alat' })] },
  { name: 'Kendaraan angkut', ctx: 'pengelolaan armada barang', subjects: [['Kendaraan angkut', 'M27'], ['Kendaraan angkut', 'M14'], ['Kendaraan angkut', 'M32']], props: [
    P('lolos pemeriksaan kesiapan perjalanan', { mod: DENGAN('status lolos pemeriksaan kesiapan perjalanan') }),
    P('tercantum dalam daftar siap bertugas', { mod: POSISI('daftar siap bertugas'), cat: DAFTAR('daftar siap bertugas') }),
    P('memiliki kode perjalanan', { mod: DENGAN('kode perjalanan'), cat: PEMILIK('kode perjalanan') }),
    P('dinyatakan layak memperoleh surat jalan'),
    P('berangkat membawa muatan', { neg: 'tidak berangkat membawa muatan' })] },
  { name: 'Pelatihan kerajinan', ctx: 'program keterampilan', subjects: [['', 'Kirana'], ['', 'Manda'], ['', 'Dwi']], props: [
    P('memiliki pendaftaran yang disahkan pengelola', { mod: DENGAN('pendaftaran yang disahkan pengelola') }),
    P('memiliki hak membuka kalender sesi praktik', { mod: DENGAN('hak membuka kalender sesi praktik') }),
    P('berhak memilih satu sesi praktik', { right: ['hak memilih satu sesi praktik melekat pada', 'hak memilih satu sesi praktik tidak melekat pada'], cat: DAFTAR('kelompok pemilik hak memilih satu sesi praktik') }),
    P('tercantum dalam daftar peserta kegiatan', { mod: POSISI('daftar peserta kegiatan'), cat: DAFTAR('daftar peserta kegiatan') }),
    P('menghadiri sesi pembukaan')] },
  { name: 'Perpustakaan', ctx: 'layanan perpustakaan', subjects: [['', 'Mira'], ['', 'Nando'], ['', 'Putri']], props: [
    P('memegang kartu anggota yang masih aktif', { mod: DENGAN('kartu anggota yang masih aktif') }),
    P('berhak meminjam buku dari koleksi umum', { right: ['hak meminjam buku dari koleksi umum melekat pada', 'hak meminjam buku dari koleksi umum tidak melekat pada'], cat: DAFTAR('kelompok pemilik hak meminjam buku dari koleksi umum') }),
    P('tercatat dalam daftar anggota baru', { mod: POSISI('daftar anggota baru'), cat: DAFTAR('daftar anggota baru') }),
    P('mengisi daftar kunjungan harian'),
    P('memperoleh perpanjangan masa pinjam')] },
  // Katup: keadaan terbuka/tertutup tidak dipasangkan dengan "mengalirkan air" (katup tertutup yang mengalirkan air bertentangan dengan pengetahuan umum); proposisi lain bersifat administratif.
  { name: 'Katup saluran', ctx: 'pengoperasian saluran air', subjects: [['Katup dua posisi', 'K04'], ['Katup dua posisi', 'K11'], ['Katup dua posisi', 'K26']], props: [
    P('terbuka pada posisi akhirnya', { neg: 'tertutup pada posisi akhirnya', anto: 'Pada posisi akhirnya status terbuka dan tertutup merupakan dua keadaan yang tersedia.' }),
    P('dilengkapi pengukur tekanan', { mod: DENGAN('pengukur tekanan') }),
    P('tercatat pada lembar operasi', { mod: CATAT('lembar operasi'), cat: TERCANTUM('lembar operasi') }),
    P('memerlukan pemeriksaan petugas'),
    P('dibersihkan oleh petugas')] },
  // Hasil penilaian: lulus/gagal tidak dipasangkan dengan sertifikat (gagal tetapi bersertifikat bertentangan dengan pengetahuan umum); proposisi lain wajar pada kedua hasil.
  { name: 'Hasil penilaian', ctx: 'penilaian akhir kelas', subjects: [['', 'Anjani'], ['', 'Bagas'], ['', 'Cahya']], props: [
    P('lulus pada penilaian akhir dua kategori', { neg: 'gagal pada penilaian akhir dua kategori', anto: 'Pada penilaian akhir dua kategori status lulus dan gagal merupakan dua keadaan yang tersedia.' }),
    P('memperoleh salinan lembar penilaian', { mod: DENGAN('salinan lembar penilaian'), cat: PEMILIK('salinan lembar penilaian') }),
    P('masuk daftar pemantauan lanjutan', { mod: POSISI('daftar pemantauan lanjutan'), cat: DAFTAR('daftar pemantauan lanjutan') }),
    P('berhak mengikuti pelatihan lanjutan', { right: ['hak mengikuti pelatihan lanjutan melekat pada', 'hak mengikuti pelatihan lanjutan tidak melekat pada'] }),
    P('menerima surat keterangan')] },
  { name: 'Panel kendali', ctx: 'pemeriksaan perangkat peringatan', subjects: [['Indikator biner', 'P05'], ['Indikator biner', 'K12'], ['Indikator biner', 'L03']], props: [
    P('menyala pada pemeriksaan normal', { neg: 'padam pada pemeriksaan normal', anto: 'Pada pemeriksaan normal status menyala dan padam merupakan dua keadaan yang tersedia.' }),
    P('mengirim sinyal ke ruang kendali'),
    P('tercatat pada log pemantauan', { mod: CATAT('log pemantauan'), cat: TERCANTUM('log pemantauan') }),
    P('memerlukan pemeriksaan teknisi'),
    P('diganti oleh teknisi', { neg: 'tidak diganti oleh teknisi' })] },
];
