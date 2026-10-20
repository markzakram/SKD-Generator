# JadiASN SKD Studio v2.2

## Soal TWK dan TKP baru tanpa API

Pada **Buat paket → Sumber soal**, pilih **Soal baru · generator lokal** untuk TWK dan/atau TKP. Pilihan ini tersedia dalam profil tryout maupun latihan bebas. Instalasi baru memilih mode baru; pengaturan pengguna lama dan paket yang tersimpan tetap dipertahankan. Pilih **Gunakan bank contoh** untuk memakai sumber sebelumnya.

Mesin lokal menyusun stimulus, pilihan, kunci, poin, pembahasan, dan cara cepat dari **konteks + kondisi penentu + model keputusan**. Tidak memerlukan API key, biaya per soal, atau server AI. Contohnya, aduan belum terverifikasi membutuhkan pemeriksaan; kesalahan yang sudah terbukti dan berada dalam kewenangan membutuhkan koreksi; keputusan di luar kewenangan membutuhkan eskalasi. Kondisi yang berubah benar-benar mengubah tindakan terbaik serta alasan pilihan, bukan hanya nama tokoh.

- **TWK:** 12 model penerapan nilai pada Nasionalisme, Integritas, Bela Negara, Pilar Negara; 6 model Bahasa Negara sesuai mapping (ide pokok, simpulan, kalimat efektif, kata baku, tanda baca, EYD).
- **TKP:** 18 model pada seluruh enam kompetensi. Setiap model mempunyai 3 kondisi keputusan dan 3 konteks pekerjaan. Skor 1–5 disertai alasan setiap opsi, pembeda 5 vs 4, dan rubrik penelaahan.
- **Kapasitas saat ini:** 132 kombinasi TWK dan 202 kombinasi TKP dalam 78 model. Angka ini menghitung kombinasi kondisi dan konteks; beberapa memakai prinsip keputusan yang sama. Pengacakan opsi tidak menambah kapasitas. Tiga paket lengkap dapat memakai TWK/TKP baru tanpa isi identik, dengan kesulitan campuran. Kapasitas berkurang ketika difilter menurut chapter/kesulitan. Generator menolak kelebihan kapasitas sebelum mulai; pemakaian ulang dapat diizinkan antarpaket.
- **Pustaka soal → Model generator soal baru:** pratinjau setiap model; ubah konteks dan kondisi untuk membandingkan keputusan serta pembahasannya.
- **Kurasi:** seluruh hasil adalah draf. Pemeriksaan model memastikan konsistensi teks, opsi, kunci, dan skor terhadap parameter penyusun; bukan pembuktian independen atas kualitas akademik atau kalibrasi kesulitan. Persetujuan soal baru memerlukan identitas penelaah dan catatan substansi. Menyunting konten membatalkan bukti model serta persetujuan sebelumnya.
- **Kompatibilitas:** penggantian mempertahankan mode baru, chapter, dan kesulitan. Cadangan, penyalinan, PDF/Word/CSV/JSON, serta uji peserta menggunakan alur yang sama. Mapping 30/35/45 tetap berlaku. TIU masih mengikuti sumber/model TIU yang tersedia.

Implementasi: `lib/local/{schema,twk,tkp,bahasa,index}.ts`. Tambahkan model dan verifikasi kapasitas untuk memperluas variasi; hasilnya tidak diklaim sebagai generasi bahasa tanpa batas. Acuan prinsip dan ejaan diperiksa pada [UUD NRI 1945 — JDIH DPR](https://jdih.dpr.go.id/index/uu1945), [EYD V — Badan Bahasa](https://ejaan.kemendikdasmen.go.id/), serta [KBBI Daring](https://kbbi.kemendikdasmen.go.id/). Aturan operasional pada kasus yang menyebut pedoman internal merupakan fakta simulasi pada stimulus, bukan klaim peraturan baru.

Verifikasi: `npm run verify:local` mencakup seluruh kombinasi, pengacakan, perubahan keputusan saat kondisi berubah, penolakan isi yang diubah tanpa kurasi, tiga paket unik, sumber campuran, kapasitas, cadangan, dan penggantian. `scripts/browser-local.mjs` memeriksa alur browser dan ekspor.

API menerima `twkSource: "new"` dan `tkpSource: "new"`. Nilai `"accepted"` atau kolom yang tidak dikirim mempertahankan perilaku bank sebelumnya.

~~~powershell
npm run generate -- --profile tryout-2027 --twk new --tkp new --paket 3
~~~

## Acuan tiga tryout 2027

Profil **Standar tryout 2027** pada halaman generator memakai **Mapping SKD 2027.xlsx** dan 312 contoh yang dinyatakan layak oleh pengguna: 90 TWK, 87 TIU, dan 135 TKP. Pilih **Latihan bebas** untuk pengaturan kuota manual sebelumnya.

Pada paket penuh 110 soal, distribusi mengikuti 37 baris berkuota dari workbook: 30 TWK, 35 TIU, 45 TKP. Seluruh 57 chapter tetap tersedia dalam data mapping, termasuk chapter latihan yang tidak memiliki kuota pada tryout penuh.

- TWK: Nasionalisme, Integritas, Bela Negara, dan Pilar Negara masing-masing 6 soal; Bahasa Negara 6 soal, masing-masing satu ide pokok, simpulan, kalimat efektif, kata baku, tanda baca, dan EYD.
- TIU verbal: silogisme 5 (1 tiga premis, 2 narasi dua premis, 2 narasi tiga premis), analogi kata 1, argumen 3, susunan/posisi 2.
- TIU numerik: berhitung 3, kecukupan data 6, deret 1, matriks angka 2, pola tabel 2, kombinasi pernyataan 1, kombinasi optimal 1.
- TIU figural: analogi, ketidaksamaan, serial, dan matriks masing-masing 2.
- TKP: Pelayanan Publik, Jejaring Kerja, Sosial Budaya masing-masing 8; TIK, Profesionalisme, Anti Radikalisme masing-masing 7.

Rotasi tiga paket pada bagian bawah sheet **3 TO 0 Latsol** diterapkan pada pasangan chapter aljabar, jenis/sifat-keterbagian-faktor bilangan, serta tiga kelompok soal cerita. Sel yang kosong pada kuota tryout tidak diubah menjadi kuota 1. Angka ketersediaan SIADU dalam workbook tidak dianggap sebagai soal yang telah tersedia di proyek.

**Penyusunan TIU** menyediakan dua pilihan:

1. **Utamakan contoh diterima:** mempertahankan stimulus, urutan pilihan, kunci, skor, dan pembahasan teks dari dokumen. Tiga paket penuh dapat disusun tanpa soal identik; sebanyak 300 soal berasal dari contoh, sedangkan 30 lainnya memakai pola analogi/figural dan pelengkap susunan. Contoh analogi kata dan figural tidak terdapat pada berkas baru yang disertakan, sehingga bagian itu memakai mesin proyek yang tersedia.
2. **Variasi TIU terhitung + contoh acuan:** membuat variasi pada model silogisme, susunan, pecahan, perkalian/pembagian setara, aljabar terbatas, deret, matriks/tabel, kombinasi, dan figural. Argumen, sifat/keterbagian bilangan, serta rotasi cerita khusus tetap menggunakan contoh diterima. Pilihan TIU independen dari pilihan sumber TWK dan TKP di atasnya.

Variasi baru diberi label tersendiri dan diperiksa ulang melalui model. Aljabar variasi memakai domain bilangan bulat yang dinyatakan eksplisit pada soal; tidak diperlakukan sebagai pembuktian untuk semua bilangan real. Contoh sumber dengan label HOTS tetap menyimpan label tersebut pada metadata; estimasi kesulitan aplikasi menjadi sulit, bukan klaim kalibrasi empiris.

**Pustaka soal → Acuan tryout diterima** memuat semua 312 contoh, termasuk chapter tambahan yang tidak masuk paket penuh. Sumber menampilkan nama berkas dan nomor soal. Teks cara cepat ikut ditampilkan, disalin, serta diekspor ke PDF, Word, PNG, dan CSV. Rumus Word diekstrak sebagai teks matematis; pecahan campuran ditulis dengan tanda tambah eksplisit agar tidak terbaca sebagai perkalian. Tabel dipertahankan. Diagram bantu yang berada dalam pembahasan sumber tidak direplikasi; uraian langkah dan tabelnya tetap digunakan.

Versi awal **Dhea_TWK - Bahasa Negara.docx** tidak dihitung ulang; versi **Done Input** menjadi sumber kanonisnya. Penanda sumber adalah **Contoh diterima**, **Variasi baru**, atau **Adaptasi sumber** setelah konten disunting. Semua paket tetap memulai kurasi sebagai draf. Satu catatan ketidaksesuaian alasan opsi D pada sumber Nynda TKP soal 1 ditampilkan dalam panel mutu tanpa mengubah poin asli diam-diam.

Data dan verifikasi:

- **data/skd-mapping.json**: kuota, category, lesson, chapter, baris asal, dan rotasi workbook.
- **data/tryout-reference.json**: contoh, metadata sumber, label asli, nomor soal, dan hash dokumen.
- **data/tryout-import-report.json**: jumlah impor, versi duplikat, dan perubahan notasi.
- **scripts/extract-tryouts.py**, kemudian **scripts/import-tryouts.py**: impor ulang dari berkas asli di G:/Downloads; ekstraksi workbook memerlukan openpyxl. Python tidak diperlukan saat build atau runtime Vercel.
- **npm run verify:tryout**: memeriksa sumber, rotasi dan kuota tiga paket, duplikasi, variasi pada banyak seed, notasi/kunci hitungan sumber, penggantian soal, cara cepat, dan cadangan.
- **scripts/browser-tryout.mjs**: menguji profil, tiga paket, pustaka, variasi TIU, ekspor Word/PDF/CSV, pemulihan browser, API, dan ukuran mobile.

Pada mode bank contoh, profil ini menolak permintaan ketika contoh suatu chapter habis; tidak mengisi kuotanya dengan materi generik. Untuk memakai ulang sumber di paket berbeda, matikan larangan pengulangan antarpaket. Jumlah soal selain 110 diskalakan menurut rasio subtes dan chapter; jumlah sangat kecil dapat membuat beberapa chapter mendapat kuota nol.

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
| TWK | 167 butir: 90 contoh tryout + 77 butir pustaka sebelumnya |
| TKP | 253 butir: 135 contoh tryout + 118 butir pustaka sebelumnya |
| TIU | 87 contoh tryout + 25 keluarga pola: 8 verbal, 13 numerik, 4 figural |

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


## Pembaruan variasi dan notasi matematika

Tambahan 42 model memuat 64 kasus baru dengan pilihan dan alasan tersendiri: 24 TWK dan 40 TKP. Cakupan baru meliputi atribusi karya, indikator kinerja, solidaritas lintas wilayah, serah terima, informasi biaya, akses layanan, konflik definisi data, kebutuhan budaya, izin berkas, verifikasi konten, serta pembedaan kritik dan kekerasan. Kondisi lanjutan pada model baru dapat mengganti seluruh pilihan. Model yang belum dipakai diprioritaskan dalam paket; riwayat paket juga dipakai untuk mengurangi pengulangan keluarga. Jumlah kombinasi tetap terbatas dan bukan ukuran kualitas psikometrik; status awal tetap draf untuk kurasi.

Matriks Deret ditampilkan tanpa header. Impor lama yang menyimpan baris angka pertama sebagai header dinormalisasi saat penyajian, termasuk angka negatif, tanpa mengubah isi sumber atau bukti validasinya. Tabel lain tetap memiliki header. Generator tidak lagi memilih pola figural garis bebas `analogi-garis` dan `ketidaksamaan-garis`; pembaca cadangan lama tetap dapat menampilkannya. Gunakan Ganti soal atau buat paket baru untuk mengganti butir lama tersebut.

Rumus memakai renderer LaTeX lokal MathJax SVG tanpa CDN. Notasi eksplisit `\( ... \)` dan `\[ ... \]` didukung pada soal, pilihan, pembahasan, dan tabel; operasi aritmetika lama, pecahan dari Word, serta pangkat ²/³ dinormalisasi saat ditampilkan. Teks sumber dan bukti hitung tetap utuh. PDF, PNG, Word, salinan kaya, serta HTML peserta menyertakan rumus yang sudah dirender. Rumus di Word dan clipboard berupa gambar; teks biasa/CSV menyertakan notasi LaTeX, sedangkan JSON cadangan mempertahankan sumber aslinya. Rumus khusus yang belum terdeteksi otomatis dapat diberi pembatas LaTeX lewat Sunting soal.

`npm run verify:presentation` menguji konversi rumus, enam matriks sumber, pengamanan HTML, keragaman model satu paket, dan tidak munculnya figural garis. `scripts/browser-presentation.mjs` memeriksa tampilan desktop/mobile, salin, ekspor rumus dan matriks, serta HTML peserta offline. Renderer mengikuti [dokumentasi SVG MathJax 3.2](https://docs.mathjax.org/en/v3.2/options/output/svg.html); dependensi dipin agar hasil tidak berubah oleh CDN.
