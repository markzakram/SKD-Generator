# JadiASN SKD Studio v2

Ruang kerja untuk menyusun, menelaah, menguji, dan mengekspor paket latihan TWK, TIU, TKP, atau SKD gabungan. Tampilan menggunakan biru #3D6E99, biru tua #052C5F, dan emas #E8B41E dari identitas JadiASN.

Generator dan ekspor berjalan di browser. Aplikasi tidak memerlukan API key atau layanan basis data eksternal. Paket, versi, dan hasil peserta tersimpan dengan IndexedDB di browser yang digunakan.

## Menjalankan dan deploy

Memerlukan Node.js ≥20.9. Gunakan Node.js 22 atau 24 untuk deployment.

~~~powershell
npm install
npm run dev
~~~

Buka http://localhost:3000. Pilih **Buat paket** untuk menyusun latihan pertama. Jika sudah ada paket tersimpan, aplikasi membuka ruang kurasi terakhir.

~~~powershell
npm run verify
npm run verify:quality
npm run typecheck
npm run build
npm start
~~~

Untuk Vercel:

1. Masukkan proyek ke repositori GitHub dan impor sebagai proyek Vercel.
2. Framework: **Next.js**. Root Directory: folder proyek ini; bila repositorinya khusus proyek ini, gunakan root repositori.
3. Install: **npm install**. Build: **npm run build**. Output Directory: bawaan Next.js.
4. Gunakan Node.js 22.x atau 24.x. Tidak perlu environment variable.
5. Sertakan **data/**, **package-lock.json**, dan seluruh kode aplikasi. Folder references/, output/, dan test-results/ tidak diperlukan di deployment.

Konfigurasi tersedia pada vercel.json. Dokumentasi: [Next.js di Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).

Next.js telah diperbarui ke 16.3.8. Setelah memasang dependensi baru, restart server dev yang masih memakai versi sebelumnya. Pemeriksaan npm audit dilakukan terpisah dari pengujian aplikasi.

## Alur penggunaan

1. **Buat paket:** pilih subtes, materi, jumlah soal, dan tingkat kesulitan. Pengaturan seed, durasi, paket tambahan, dan submateri berada di bagian lanjutan.
2. **Blueprint:** tinjau kuota tiap materi dan kesulitan. Persentase kesulitan dapat ditentukan sendiri; kuota dapat disunting secara manual. Persediaan yang kurang menghasilkan pesan kesalahan, tanpa penggantian materi diam-diam.
3. **Ruang kurasi:** gunakan daftar nomor dan filter untuk meninjau satu soal. Periksa pertanyaan, tabel/gambar, seluruh pilihan, kunci, alasan pengecoh, pembahasan, sumber, dan rubrik. Panel **Ambil soal** di atas kartu soal menyalin atau mengunduh soal itu saja, atau beberapa soal terpilih (lihat bagian Ambil soal satuan atau terpilih).
4. **Sunting / ganti / tandai / keluarkan:** suntingan konten membuat revisi baru dan membatalkan persetujuan. Penggantian mempertahankan subtes, materi, dan kesulitan blueprint serta menghindari soal identik. Soal yang dikeluarkan tidak diekspor atau dianalisis.
5. **Persetujuan:** isi nama penelaah dan konfirmasi pemeriksaan per soal. Soal dengan kegagalan struktur/skor tidak bisa disetujui. Soal hasil suntingan juga memerlukan catatan verifikasi substansi.
6. **Evaluasi peserta:** uji soal yang telah disetujui, periksa respons, kemudian gunakan hasilnya untuk revisi berikutnya.
7. **Ekspor:** pilih soal disetujui atau seluruh soal aktif untuk draf kurasi. Soal yang dikeluarkan dilewati dan nomor diurutkan kembali.

Status: **Draf → Perlu revisi → Disetujui**. Penelaah dapat mengembalikan status ke draf. Nama penelaah adalah catatan kurasi yang diisi pengguna; aplikasi tidak memiliki akun atau pengesahan dari lembaga eksternal.

## Konten dan kesulitan

| Bagian | Pustaka v2 |
| --- | --- |
| TWK | 77 butir: 37 contoh riset dan 40 soal orisinal dengan kumpulan opsi berbeda |
| TKP | 118 butir: 26 contoh panduan dan 92 kasus orisinal |
| TIU | 25 keluarga pola: 8 verbal, 13 numerik, 4 figural |

TWK tambahan versi lama memakai 80 variasi dari 20 kerangka. Versi ini menggantinya dengan 40 soal yang berbeda beserta alasan spesifik tiap pengecoh.

TKP memakai 23 konteks dengan empat kondisi keputusan: kewenangan jelas, tenggat dan kewenangan terbatas, bukti bertentangan, serta masalah yang berulang. Setiap kondisi mempunyai kumpulan respons berbeda. Rubrik meliputi kewenangan, urgensi, efektivitas, risiko, dan tindak lanjut. Skor kasus orisinal merupakan rubrik latihan yang perlu telaah, bukan kunci resmi BKN.

TIU menggunakan pengecoh dari salah prioritas operasi, salah dasar persentase, bobot rata-rata, salah jalur deret, pembalikan hubungan logika, dan perubahan fitur gambar. Beberapa keluarga sederhana hanya tersedia pada tingkat yang sesuai; label sulit tidak diberikan hanya karena angka atau narasi lebih panjang.

Kesulitan memakai **mudah / sedang / sulit**, dengan alasan kompleksitas pada setiap soal. Bloom dicatat terpisah. Input lama HOTS dinormalisasi menjadi sulit; ini tidak menyatakan bahwa setiap soal tersebut telah memenuhi tuntutan analisis tinggi.

Pada SKD, rasio 30 TWK : 35 TIU : 45 TKP diskalakan sesuai jumlah yang diminta. Durasi bawaan 100 menit. Baseline berasal dari riset pengguna dengan acuan aturan 2024, bukan penetapan aturan resmi CPNS 2027.

## Pemeriksaan mutu

- Validasi struktur, lima opsi berbeda, satu kunci terbaik, dan rentang skor.
- TWK/TIU: kunci 5, pengecoh 0. TKP: setiap respons 1–5 dan satu respons tertinggi.
- Ekspresi numerik dihitung dengan parser tanpa eval.
- Silogisme diperiksa dengan enumerasi tabel kebenaran.
- Susunan/peringkat/jadwal diperiksa dari seluruh permutasi yang memenuhi batasan.
- Rute dihitung ulang dari graf; kombinasi biaya dan pernyataan harga diperiksa dari model.
- Kecukupan data mengevaluasi seluruh pasangan dalam domain bilangan yang dinyatakan.
- Figural diperiksa dari rotasi, jumlah titik, warna, perubahan bentuk, atau hubungan ciri kelompok.
- Checksum konten mendeteksi stimulus, pembahasan, atau model yang berubah terpisah dari bukti awal. Ini pemeriksaan konsistensi, bukan tanda tangan keamanan.
- Butir bank dicocokkan dengan sumber; analogi kata dan penilaian argumen tetap membutuhkan pemeriksaan bahasa/substansi.
- Pemeriksaan mutu menandai panjang kunci, pengecoh dengan klaim mutlak, kumpulan opsi berulang, dan kemiripan teks. Penanda adalah heuristik untuk ditinjau.

Hasil solver membuktikan model yang dituliskan, bukan seluruh penafsiran bahasa alami. **Status disetujui hanya diberikan setelah telaah pengguna.**

**data/benchmark.json** berisi 12 contoh acuan regresi dengan kunci dan pembahasan eksplisit. Contoh tersebut menunggu telaah ahli materi; tidak diberi klaim sebagai standar akademik yang sudah disahkan.

## Uji peserta dan statistik

- **Uji di perangkat ini:** mencatat pilihan dan waktu tiap soal, lalu menyimpan sesi selesai ke IndexedDB.
- **Berkas uji HTML:** penyusun mengunduh soal disetujui untuk dibagikan kepada peserta. Berkas tidak menyertakan kunci, poin, atau pembahasan. Peserta mengunduh hasil JSON dan menyerahkannya kepada penyusun.
- **Impor hasil JSON:** mendukung satu atau beberapa berkas, objek sesi, array sesi, atau berkas dengan properti sessions. ID sesi yang sudah ada tidak dihitung ulang.
- Respons dipadankan dengan ID soal, revisi, dan checksum stimulus/kunci. Respons versi lama tetap tersimpan, tetapi tidak dicampur ke analisis soal yang berubah.
- Statistik: N, frekuensi A–E, jawaban kosong, proporsi benar/terbaik, rerata poin, rerata waktu, pengecoh yang jarang dipilih, dan korelasi skor soal dengan total soal lain.
- Jawaban kosong diberi 0 poin. TWK/TIU memakai proporsi benar; TKP memakai distribusi poin, bukan klasifikasi benar/salah saja.
- Label empiris TWK/TIU baru ditampilkan pada ≥30 respons: proporsi benar ≥0,80 mudah, 0,40–0,79 sedang, <0,40 sulit. Batas ini adalah aturan awal proyek, bukan keputusan psikometrik final.
- Daya pembeda hanya dihitung pada ≥30 sesi lengkap yang cocok dengan isi seluruh soal pembanding; nilai kosong jika variasi skor tidak tersedia.

Tidak ada data peserta buatan pada dashboard. Fixture sintetis hanya dipakai oleh script pengujian dan tidak dimasukkan ke IndexedDB pengguna.

Pengumpulan hasil belum memakai basis data bersama atau tautan akun peserta. Vercel menyediakan aplikasi, sementara perpindahan hasil antarperangkat dilakukan melalui berkas.

## Riwayat dan cadangan

- Riwayat menyimpan seluruh paket saat ini dan **20 snapshot terakhir** sebelum perubahan.
- Memulihkan versi lama membuat versi baru, sehingga riwayat saat ini tetap dapat ditelusuri.
- Cadangan JSON mencakup paket, status, penelaah, revisi, snapshot, dan hasil peserta pada workspace itu.
- Impor memeriksa struktur, model, skor, dan metadata. Saat memulihkan ID workspace yang sama, hasil cadangan menjadi versi baru di riwayat yang ada.
- Cadangan versi lama tetap dapat dimuat; butir dari bank lama yang tidak tersedia menjadi soal yang memerlukan verifikasi manual.
- Penyimpanan terikat pada browser dan domain. Membersihkan data situs dapat menghapusnya; unduh cadangan sebelum membersihkan browser atau berpindah domain.

## Ekspor

PDF dan Word: naskah tanpa kunci, kunci saja, atau soal + pembahasan; dapat dipisahkan per paket dalam ZIP. Draf diberi label. Gambar figural disertakan sebagai gambar di dokumen.

CSV: soal, opsi, skor, pembahasan, alasan, sumber, status, revisi, penelaah, catatan, alasan kesulitan, rubrik, dan stimulus. JSON: data terstruktur beserta bukti model. CSV dan JSON menyertakan kunci; gunakan naskah PDF/Word atau berkas uji HTML untuk peserta.

Ekspor memuat jumlah aktual setelah pemilihan status dan pengecualian, bukan otomatis seluruh jumlah blueprint. Komposisi aktual dapat diperiksa di ruang kurasi.

## Ambil soal satuan atau terpilih

Untuk tim akademik yang hanya butuh satu atau beberapa soal, tanpa membuat ekspor paket. Panel **Ambil soal** ada di ruang kurasi, di atas kartu soal.

- **Salin** (menu): soal (pertanyaan, tabel, gambar stimulus), pilihan A sampai E, jawaban (TKP: skor tiap pilihan), pembahasan beserta alasan tiap pilihan, atau semua. Hasilnya langsung bisa ditempel ke Word atau Google Docs: `text/html` dengan gambar PNG tertanam (gambar SVG dirasterkan di browser) dan `text/plain` sebagai cadangan.
- **Salin gambar:** tombol kecil di bawah gambar stimulus dan di bawah tiap gambar pilihan menyalin gambar itu sebagai `image/png`.
- **Unduh PNG** dan **Unduh PDF** untuk soal yang sedang dibuka. Kotak **Sertakan kunci & pembahasan** menentukan isinya. Huruf, tata letak TWK/TIU/TKP, dan gambar figural sama dengan PDF ekspor paket (satu model tata letak di `lib/export.ts` dilukis oleh PDF dan PNG). Soal yang belum disetujui diberi label draf.
- **Pilih beberapa soal:** nomor di daftar menjadi kotak centang. **Pilih semua** mengikuti filter daftar dan melewati soal yang dikeluarkan; pilihan bertahan saat pindah halaman. Aksinya **Ekspor PDF** (satu berkas), **Ekspor PNG** (satu PNG per soal, dibungkus ZIP bila lebih dari satu), dan **Salin terpilih**. Urutan mengikuti paket dan nomor soal tidak diubah.

Hasil salin dan unduh diumumkan lewat toast. Salinan kaya memakai Async Clipboard API (`ClipboardItem`), yang butuh HTTPS atau localhost. Bila browser tidak mendukung atau menolak akses clipboard, yang tersalin hanya teks dan toast memberi tahu; tombol salin gambar menampilkan galat dan menyarankan Unduh PNG. Pengujian UI dilakukan di Edge (Chromium); Chrome memakai mesin yang sama. Safari dan Firefox belum diuji di sini.

## Batas, CLI, dan API

Maksimal 50 paket, 200 soal per paket, 4.000 soal per proses. Persediaan per materi/kesulitan dapat membatasi lebih rendah. Analogi dua kata mempunyai 10 pasangan; pola berparameter lain juga tidak dijanjikan tak terbatas.

~~~powershell
npm run generate -- --mode SKD --paket 1 --seed LATIHAN-01 --out output
npm run generate -- --mode TIU --soal 35 --paket 5 --seed TIU-01
npm run generate -- --mode TKP --paket 5 --boleh-ulang
~~~

CLI menulis paket.json dan validasi.json sebagai bahan draf. PDF/Word dibuat di browser.

GET /api/generate mengembalikan metadata. POST menerima pengaturan JSON, dengan batas 1.000 soal per permintaan:

~~~json
{
  "mode": "TIU",
  "count": 20,
  "packages": 1,
  "seed": "TIU-01",
  "difficulty": "campuran",
  "topics": ["Numerik"],
  "subtopics": [],
  "uniqueAcross": true,
  "composition": { "mudah": 25, "sedang": 50, "sulit": 25 }
}
~~~

Filter submateri memakai format Materi::Submateri, misalnya Figural::Matriks 3 × 3. Kuota eksplisit dapat dikirim sebagai blueprint berisi baris subtest, topic, difficulty, dan count. Jumlahnya harus sesuai distribusi subtes; kekurangan stok menghasilkan error 400.

## Pengujian dan sumber

**npm run verify** menguji determinisme, rasio, filter, stok, duplikasi, dan setiap keluarga TIU pada beberapa seed serta tingkat yang tersedia.

**npm run verify:quality** menguji contoh acuan, kuota eksplisit, suntingan dan pembatalan persetujuan, ekspor, cadangan, pencocokan revisi peserta, statistik, dan petunjuk panjang kunci. Laporan ditulis ke test-results/quality-report-v2.json.

**scripts/browser-smoke.mjs** memerlukan Playwright di lingkungan QA. Memeriksa alur kurasi, IndexedDB/reload, snapshot, impor cadangan, uji lokal/HTML, impor respons, enam ekspor, mobile, dan API. Playwright tidak diperlukan di deployment.

Sumber penelitian disimpan di references/ dan tidak dibaca saat runtime. Bank contoh berada di data/twk-reference.json dan data/tkp-reference.json. Alasan TKP berasal dari sel tabel PDF, bukan pencocokan baris teks.

- [TIU dalam riset JadiASN](https://drive.google.com/file/d/1tzx3GR5GSYtkuTkR1kXfDqyUsao2jXiP/view)
- [Panduan TKP JadiASN](https://drive.google.com/file/d/1NgyWaSFh7oL_Sfjkw37LvxiZCOFQw7P_/view)
- [UUD NRI 1945 — DPR RI](https://www.dpr.go.id/dokumen/jdih/undang-undang-dasar)
- [EYD V — Badan Bahasa](https://ejaan.kemendikdasmen.go.id/eyd/)

Untuk memperbarui contoh dari ekstraksi sumber: npm run references. Jika PDF TKP berubah, ekstrak tabel kembali dengan scripts/extract-tkp-tables.py (memerlukan pdfplumber), lalu impor dan jalankan verifikasi. Koreksi sumber tercatat dalam data/reference-import-report.json.
