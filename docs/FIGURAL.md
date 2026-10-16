# Soal Figural TIU

Mesin soal figural ada di `lib/figural/`. Dokumen ini menjelaskan jenis soal yang dibuat, aturan tiap tingkat kesulitan, cara validator membuktikan kunci, cara menjalankan pengujian, dan contoh hasilnya.

## 1. Ringkasan: sebelum dan sesudah

| | Sebelum | Sesudah |
|---|---|---|
| Bentuk | 4 bangun (segitiga, persegi, lingkaran, belah ketupat) dengan satu panah dan titik hitung | Katalog 23 bentuk dasar, poligon acak, garis berkepala, dan 8 keluarga gambar garis dari benih (port mesin "Figural Kesesuaian Generator") |
| Perubahan | Putaran, jumlah titik, siklus warna, dan siklus bentuk yang bergeser serentak | Putaran, cermin, inversi warna, hapus/tambah unsur, pindah posisi (mengorbit), ukuran, tukar tempat, susun-tumpuk, persegi Latin, deret jumlah, dan kombinasi 1 sampai 4 aturan |
| Kalimat soal | Menyebut aturan, misalnya "Warna mengikuti siklus putih → gelap → abu → putih" | Lima rumusan baku; aturan hanya ada di pembahasan |
| Pengecoh | Satu fitur diubah acak; alasan generik | Satu beda konkret yang dihitung dari geometri, ditambah aturan yang dilanggar |
| Bukti kunci | Dihitung ulang dengan rumus yang sama dengan pembuat soal | Aturan disimpulkan ulang dari gambar; semua aturan yang cocok harus meramalkan jawaban yang sama; tepat satu opsi memenuhi |
| Tingkat | Hanya beda besar langkah putaran dan banyaknya fitur yang ikut bergeser | Resep berbeda per tingkat; kerumitan terukur dan diuji naik |
| Matriks 3 × 3 | Hanya sulit | Mudah, sedang, dan sulit |

## 2. Jenis soal

Jenis mengikuti contoh Figural pada TIU SKD 2027 (analogi, ketidaksamaan, serial, matriks). Contoh 2027 tidak memuat jenis "kesesuaian/rotasi" yang berdiri sendiri, jadi tidak dibuat sebagai jenis baru. Putaran murni tetap dipakai sebagai hubungan pada analogi dan sebagai prinsip kelompok pada ketidaksamaan.

| Jenis (`family`) | Pertanyaan | Mekanisme (`visual.rule.mekanisme`) |
|---|---|---|
| Analogi (`fig-analogi`) | Gambar 1 : gambar 2 = gambar 3 : ? | `analogi-<perubahan>`, mis. `analogi-putar+inversi`, `analogi-cermin+geser`, `analogi-putar+skala+inversi`; `analogi-garis` (putaran atau cermin+putaran pada gambar garis) |
| Ketidaksamaan (`fig-odd`) | Gambar mana yang berbeda | `ketidaksamaan-urutan`, `-paritas`, `-sisi`, `-garis` |
| Serial (`fig-serial`) | Gambar yang melanjutkan (atau mengisi) deret | `serial-satu-aturan`, `-dua-aturan`, `-tiga-aturan`, `-empat-aturan`, `-jumlah`, `-jumlah-ganda` |
| Matriks 3 × 3 (`fig-matrix`) | Gambar untuk kotak kanan bawah | `matriks-baris-kolom`, `-putaran`, `-latin`, `-jumlah`, `-jumlah-ganda`, `-tumpuk`, `-tumpuk-xor`, `-cincin` |

Perubahan yang dipakai pada analogi: putar, cermin, inversi warna, hapus unsur, geser unsur mengelilingi pusat, ubah ukuran, dan tukar tempat dua unsur.

## 3. Aturan per tingkat

Mesin mengenal empat tingkat: mudah, sedang, sulit, dan HOTS.

**Catatan penting:** aplikasi saat ini melipat HOTS ke Sulit (`normalizeSettings` di `lib/generate.ts`, daftar tingkat di `lib/tiu.ts` dan `lib/blueprint.ts`; label HOTS sudah ditandai "Sulit (label lama)"). Jadi dari antarmuka dan `npm run generate` hanya tiga tingkat yang sampai ke soal: mudah, sedang, sulit. Resep HOTS tetap ada di mesin, dipanggil dengan `makeTiu(family, 'hots', rng)` dan diuji oleh `npm run verify`, supaya siap dipakai bila HOTS kelak dipisah lagi.

### Sebelum

| Jenis | Mudah | Sedang | Sulit / HOTS |
|---|---|---|---|
| Analogi dan Serial | Satu bangun berputar 90° | Putaran 45° sampai 225°, jumlah titik bertambah 1 | Ditambah warna dan bentuk bergeser 1 langkah; semua serentak dari rumus yang sama |
| Ketidaksamaan | Jumlah titik berbeda | Hubungan jumlah titik dan warna (mod 3) | Hubungan arah panah dan jumlah titik (mod 8) |
| Matriks | Tidak ada | Tidak ada | Jumlah titik, arah, dan warna bertambah per baris dan kolom |

### Sesudah

**Analogi.** Gambar dibangun dari rangka, bangun di tengah, dan penanda; tingkat yang lebih tinggi menambah panah kecil dan bulatan kecil. Sekitar 30% soal memakai gambar garis dari benih (hubungan putaran atau cermin+putar).

| Tingkat | Jumlah perubahan | Contoh |
|---|---|---|
| Mudah | 1 | putar 90° atau 180°; inversi warna; satu unsur dihilangkan |
| Sedang | 1 sampai 2 | putar kelipatan 45°; cermin; putar 90° + inversi; putar + hapus unsur |
| Sulit | 2 | putar + inversi; putar + geser unsur mengelilingi pusat; cermin + inversi; putar + ubah ukuran; cermin + geser |
| HOTS | 3 | cermin + putar + inversi; putar + inversi + hapus; cermin + putar + geser; putar + inversi + tukar tempat; putar + ubah ukuran + inversi |

Pengecoh melanggar tepat satu perubahan (parameter keliru, perubahan dilewatkan, atau perubahan yang tidak ada ditambahkan).

**Ketidaksamaan.** Empat mekanisme diundi: urutan 30%, paritas 15%, jumlah sisi 15%, gambar garis 40%. HOTS memakai resep yang sama dengan sulit.

| Mekanisme | Mudah | Sedang | Sulit |
|---|---|---|---|
| Urutan bangun di sekeliling pusat | 4 bangun, sudut tampil kelipatan 90°; beda: dua bangun bertukar atau satu bangun diganti | 5 bangun, sudut kelipatan 45°; beda: tukar tetangga atau tukar warna | 6 bangun, sudut kelipatan 15°; beda: tukar jauh, tukar warna, atau seluruh susunan dicerminkan |
| Paritas bangun hitam | Sampai 8 bangun hitam di antara bangun putih | Sampai 10, ditambah bangun abu-abu | Sampai 13, dua jenis bangun dan tiga warna |
| Jumlah sisi (poligon acak, ada sudut cekung) | Dua jenis jumlah sisi, selisih 3 sampai 4 | Dua pasangan dan satu tanpa pasangan, selisih 2 sampai 3 | Selisih 1 (jumlah sisi berurutan) |
| Gambar garis: empat putaran dari satu susunan, satu bukan | Sudut tampil 90°, 180°, 270° (dilengkapi sudut antara); beda mudah dilihat (unsur hilang, tambah, berubah ukuran, atau berpindah) | Sudut tampil kelipatan 45°; beda berupa jumlah, ukuran, atau letak unsur | Sudut tampil 45°, 135°, 225°, 315° (dilengkapi sudut antara); kelima gambar berprofil sama, beda hanya pada hubungan antarunsur (mis. cermin, putaran terhadap titik tumpu) |

**Serial.** Deret 5 kotak (mudah, sedang) atau 6 kotak (sulit, HOTS). Pada sulit, kotak yang hilang berada di tengah deret dengan peluang 40%; pada HOTS selalu di tengah. Pada mudah dan sedang, sekitar 28% soal berupa deret jumlah bangun.

| Tingkat | Aturan serentak | Contoh |
|---|---|---|
| Mudah | 1 | bangun di tengah berputar; satu bangun kecil mengorbit pada lintasan; atau satu bangun berganti tiap kotak (`serial-jumlah`) |
| Sedang | 2 | bangun berputar + bulatan sudut berganti warna; bangun berputar + batang berputar dengan langkah lain; bangun berganti warna + bangun kecil mengorbit; atau dua jumlah (`serial-jumlah-ganda`) |
| Sulit | 3 | bangun berputar + warna bangun + bangun kecil mengorbit berlawanan arah; atau bangun berputar + batang berputar + warna bulatan sudut |
| HOTS | 4 | bangun berputar dan berganti warna + batang berputar + bulatan sudut berganti warna dengan siklus tiga warna |

Pada sulit dan HOTS, setiap pengecoh hanya berbeda pada satu bagian dari jawaban dan hanya berupa kesalahan yang paling wajar (salah satu langkah, arah berlawanan), bukan perubahan acak.

**Matriks 3 × 3.**

| Tingkat | Resep yang diundi |
|---|---|
| Mudah | bentuk tetap per baris + warna tetap per kolom; jumlah bangun aritmetika; satu bangun berputar per kolom |
| Sedang | persegi Latin pada dua bagian; jumlah bangun (kolom 3 = kolom 1 + kolom 2, atau dikali tetap); tumpukan gabungan (6 lapisan garis); putaran per kolom dan baris + dua warna dengan arah berbeda |
| Sulit | persegi Latin pada bentuk dan warna bangun di tengah serta bentuk bangun sudut, ditambah warna sudut dan batang yang mengikuti baris atau kolom; deret prima, jumlah, kali, atau aritmetika besar; tumpukan saling menghilangkan (7 lapisan); cincin bangun yang bergeser dengan warna berputar |
| HOTS | persegi Latin + batang yang berputar; dua kelompok bangun dengan aturan jumlah berbeda; tumpukan saling menghilangkan 9 lapisan; cincin + bangun pusat persegi Latin |

### Kerumitan terukur

`npm run verify` mengukur kerumitan dari stimulus dan mensyaratkan rata-ratanya naik tiap tingkat. Ukurannya: pada analogi, banyaknya langkah pada hubungan terpendek gambar 1 ke gambar 2; pada serial dan matriks, banyaknya aspek bagian (bentuk, isi, arah, letak, jumlah, dan seterusnya) yang berubah di antara kotak yang tampak. Hasil terakhir (mudah, sedang, sulit, HOTS):

| Jenis | Aspek yang berubah |
|---|---|
| Analogi | 1,03; 1,34; 1,76; 2,44 |
| Serial | 1,41; 2,13; 3,36; 4,00 |
| Matriks | 1,63; 2,99; 5,73; 6,97 |

## 4. Kalimat soal tidak boleh membocorkan aturan

Kalimat soal hanya boleh salah satu rumusan baku di `lib/figural/stems.ts`:

- Analogi: "Tentukanlah gambar yang tepat untuk menggantikan tanda tanya "?", sehingga kedua pasangan gambar di bawah ini memiliki hubungan yang serupa."
- Ketidaksamaan: "Manakah gambar yang memiliki prinsip, pola, atau karakteristik yang berbeda dibandingkan gambar lainnya?"
- Serial: "Tentukanlah gambar berikutnya dari seri gambar di bawah ini!" (jawaban di ujung deret) atau "... untuk menggantikan tanda tanya "?" pada seri gambar di bawah ini!" (kotak hilang di tengah).
- Matriks: "Tentukanlah gambar yang tepat untuk menggantikan tanda tanya "?" pada susunan gambar di bawah ini!"

Validator menolak kalimat yang bukan salah satu rumusan itu, dan juga kalimat yang cocok dengan pola `LEAK` (kata putar, cermin, warna, siklus, ganjil, genap, jumlah, urutan, angka, dan sejenisnya). Aturan hanya muncul di `explanation` (pembahasan) dan `visual.rule`. Gambar sendiri juga tidak memuat kata aturan; tes memeriksa SVG-nya.

## 5. Pengecoh dan pembahasan

- Pengecoh dibuat dengan melanggar tepat satu aturan. Pada serial dan matriks, satu aspek satu bagian pada kunci diganti (arah, warna, bentuk, jumlah, letak, ukuran, atau bagian hilang atau tambah) dengan nilai yang wajar, misalnya nilai yang muncul pada kotak tetangga atau langkah yang keliru. Pada analogi, pengecoh adalah hasil penerapan hubungan dengan satu langkah dilewatkan atau diganti parameternya. Pada gambar garis, pengecoh berasal dari salah satu dari 10 strategi cacat.
- Setiap pengecoh dijamin salah: `sameScene` membandingkan geometri, bukan teks, sehingga dua gambar yang tampak sama (mis. persegi diputar 90°) tidak mungkin menjadi kunci dan pengecoh sekaligus.
- Alasan tiap opsi berbentuk: "Gambar ini berbeda dari gambar yang benar: *beda konkret*. Padahal *aturan yang dilanggar*." Beda konkret dihitung oleh `describeDiff` (`lib/figural/text.ts`) dari selisih geometri kedua gambar, bukan ditulis tangan.
- Pada ketidaksamaan, alasan tiap opsi menyebut ciri yang dipakai (jumlah sisi beserta sisi terpanjang dan sudut cekungnya, jumlah bangun hitam, atau urutan bangun dan arah titik terjauh).
- Pembahasan tidak menyebut huruf opsi, karena opsi diacak setelah soal dibuat; opsi bergambar diberi nama menurut huruf barunya ("Gambar C").

## 6. Model gambar

Gambar bukan lagi satu struktur `Figure`, tetapi `Scene`: kumpulan `Part` (`lib/types.ts`).

```ts
type Part = {
  id: string;      // nama peran, stabil antarkotak; kelompok berhitung memakai "nama@nomor"
  g: string;       // id bentuk dasar, atau "poligon" (tertutup) / "garis" (terbuka) yang memakai titik `p`
  x: number; y: number; // pusat pada kotak 100 x 100 berpusat di (0, 0), y ke bawah
  s: number; r: number; // skala dan putaran searah jarum jam (derajat)
  f: 0 | 1 | 2 | 3;     // putih, abu-abu, hitam, tanpa isi (hanya garis)
  m?: 1;           // tercermin terhadap sumbu tegak sebelum diputar
  p?: number[];    // titik x1,y1,x2,y2,... untuk "poligon" dan "garis"
  h?: 1 | 2;       // kepala ujung garis: 1 mata panah, 2 kait
};
```

Soal figural memakai `visual.scenes` (kotak stimulus, `null` = tanda tanya), `options[i].scene`, `visual.rule` (mekanisme dan kalimat aturan), dan `proof: { kind: 'scene' }`.

Katalog bentuk dasar (`lib/figural/glyphs.ts`): lingkaran, persegi, segitiga, belah ketupat, bintang, bintang bersudut empat, bulan sabit, panah, batang, tanda tambah, segi lima runcing, segienam, setengah lingkaran, layang-layang, trapesium, busur, tetesan, bentuk L, jajar genjang, segitiga siku-siku, baling-baling, bentuk S, dan bendera. Tiap bentuk punya orde simetri putar (`k`) dan penanda kiral (`chiral`); keduanya diverifikasi numerik oleh tes sehingga perbandingan arah selalu benar (mis. persegi yang diputar 90° sama dengan dirinya).

Gambar garis dari benih (`lib/figural/garis.ts`, port dari "Figural Kesesuaian Generator"): delapan keluarga (garis bersarang, bangun datar + penanda, kisi titik dan penghubung, panah-sirip-kait, pita zigzag menyilang, tulang dan gigi sisir, blok bertumpuk, lingkaran dan tali silang). Hanya gambar yang lolos penyaring yang dipakai: simetri putar tunggal (hanya putaran 0° yang memetakan gambar ke dirinya), kiral (cerminnya bukan putarannya, jadi pengecoh cermin pasti salah), tidak ada ruas sehalus rambut, tidak gepeng, garisnya tidak terlalu sedikit atau padat, tidak ada dua unsur yang berhimpit, dan cerminnya cukup berbeda dari aslinya. Pengecoh memakai 10 strategi (cermin, putar unsur, putar unsur pada tempatnya, ubah ukuran, hapus, tambah, ubah isi, geser, cermin unsur, putar terhadap titik tumpu) dengan urutan prioritas yang berbeda tiap tingkat; pada sulit pengecoh wajib berprofil sama dengan gambar acuan.

Perbandingan gambar (`lib/figural/scene.ts`): setiap bagian diubah ke kunci kanonik (bentuk, isi, skala, orientasi modulo simetri, cermin); `sameScene` mencocokkan dua gambar sebagai multiset bagian dengan toleransi 0,08. Sudut putar yang memetakan satu gambar ke gambar lain dicari lewat titik terjauh dari pusat (`rotationAngles`, `rotationBetween`), jadi "gambar ini hanya diputar" dapat dibuktikan, bukan dikira-kira.

## 7. Cara kerja validator

Validator (`solveScene` di `lib/figural/solve.ts`, dipanggil dari `auditQuestion` di `lib/validate.ts`) tidak mempercayai catatan pembuat soal. Kunci dihitung ulang hanya dari gambar stimulus dan kelima opsi.

Pemeriksaan umum untuk semua jenis:

1. Kalimat soal memakai rumusan baku dan tidak cocok dengan pola `LEAK`.
2. Lima opsi berupa gambar; struktur tiap bagian sah (bentuk dikenal, angka berhingga, di dalam kotak); alasan lima opsi berbeda.
3. Tidak ada dua opsi yang tampak sama (`sameScene`).

Lalu menurut jenis:

- **Analogi.** `explain(A, B)` menelusuri hubungan gambar 1 ke gambar 2: 32 perubahan global (cermin, putaran kelipatan 45°, inversi warna) dikombinasikan dengan perubahan sisa (hapus, tambah, isi, ukuran, geser, putar pada tempatnya, tukar), lengkap dengan tafsir alternatif. Hubungan terpendek yang ditemukan diterapkan pada gambar 3 lewat semua tafsir. Hasilnya harus **satu** gambar; bila tafsir berbeda menghasilkan gambar berbeda, soal ditolak sebagai ambigu. Tepat satu opsi harus sama dengan hasil itu.
- **Serial dan matriks.** `inferHidden` (`lib/figural/infer.ts`) membaca tiap bagian pada kotak yang tampak, lalu untuk setiap aspek (bentuk, isi, arah, cermin, ukuran, jumlah, letak, kemunculan) mencari semua hipotesis sederhana di `lib/figural/hyp.ts` yang cocok dengan data:
  - deret: tetap, berulang tiap 2 atau 3 kotak, bertambah dengan langkah tetap (modulo untuk sudut dan warna);
  - kisi: tetap, tetap per baris atau per kolom (hanya sah bila teruji oleh sedikitnya satu baris atau kolom dengan dua pengamatan), persegi Latin, a + d1 × kolom + d2 × baris, kolom 3 = jumlah atau selisih kolom 1 dan 2, dikali tetap, serta deret menurut urutan baca (aritmetika, bertingkat, dua suku sebelumnya, prima, kuadrat, kubik, segitiga, pangkat dua);
  - tumpukan: kolom atau baris 3 = gabungan, hanya salah satunya (yang sama saling menghilangkan), atau kolom 1 tanpa kolom 2.

  **Semua hipotesis yang cocok harus meramalkan nilai yang sama.** Bila dua hipotesis meramalkan nilai berbeda, soal ditolak karena ambigu; bila tidak ada hipotesis yang cocok, ditolak karena aturan tidak dapat dibuktikan. Aspek bagian yang diramal absen pada kotak tersembunyi tetap harus beraturan. Bagian tumpukan dinilai hanya oleh satu operasi tumpukan yang sama untuk semua bagian. Aritmetika deret memerlukan sedikitnya tiga pengamatan. Setelah itu tepat satu opsi harus memenuhi seluruh ramalan.
- **Ketidaksamaan.** `panel` menghitung ciri tiap gambar: kelas putaran (urutan), jumlah bangun hitam, paritas, jumlah abu-abu, putih, dan bagian, jumlah sisi, serta komposisi bentuk. Ciri yang dinyatakan mekanisme (`ODD_FEATURE`) harus menunjuk **tepat satu** gambar, dan tidak boleh ada ciri lain yang menunjuk gambar yang lain (jawaban ganda).

Karena validator memakai logika yang terpisah dari pembuat soal, kesalahan di pembuat soal (mis. pengecoh yang kebetulan benar) tertangkap. Soal yang gagal dibuktikan dibuang, dan `makeFigural` mencoba lagi sampai 80 kali.

## 8. Determinisme, keunikan, dan fingerprint

- `makeFigural` (`lib/figural/index.ts`) mengambil **satu** bilangan dari pengacak induk, lalu setiap percobaan memakai pengacak turunan `rng('fig|keluarga|tingkat|seed|percobaan')`. Hasil per seed tetap sama, dan jumlah undian dari pengacak induk selalu satu walau penyusunan perlu mengulang.
- `fingerprint` di `lib/generate.ts` memuat `sceneSignature` stimulus dan opsi (bagian diurutkan, letak dibulatkan), sehingga soal kembar dalam satu paket maupun antarpaket ditolak dan diundi ulang oleh pembuat paket. Tes membuktikan 240 soal figural dalam 10 paket tanpa duplikat.
- `contentHash` di `lib/pilot.ts` juga memuat `sceneSignature`, sehingga perubahan gambar terdeteksi di lembar pilot.

## 9. Tampilan dan ekspor

- `lib/figural/render.ts` menggambar bagian menjadi SVG: kotak 100 × 100 per gambar; analogi dengan tanda `:` `=` `:` di antara kotak, deret satu baris, matriks 3 × 3, dan lima opsi berhuruf A sampai E di bawahnya.
- `questionSvg` di `lib/figures.ts` memakai render baru bila soal memuat `scenes` atau `scene`, dan tetap memakai render lama untuk data lama. `QuestionCard`, ekspor Word dan PDF (`lib/export.ts`), dan lembar pilot (`lib/pilot-export.ts`) memakai `hasStimulus` dan `optionSvg` sehingga kedua bentuk data tampil.
- `questionSvg(question, includeOptions = true, includeStimulus = true)` menghasilkan stimulus saja (`false`), stimulus dan opsi (bawaan; dipakai PDF, Word, dan PNG), atau deret opsi saja (`true, false`). Fitur ambil soal (`lib/take.ts`, README bagian "Ambil soal satuan atau terpilih") memakai ketiganya untuk salinan ke Word dan Google Docs, dan `optionSvg` untuk tombol "Salin gambar" per opsi; semuanya dirasterkan ke PNG oleh `rasterizeSvg` di `lib/export.ts`.
- Ekspor CSV memuat kolom `scenes` pada JSON stimulus. `QuestionEditor` menyertakan `scenes` dan `scene` per opsi pada JSON stimulus yang disunting.
- Kotak stimulus dan opsi dipaskan ke kotak 100 × 100 dengan batas jangkauan 49 satuan, sehingga tidak ada bagian yang terpotong atau saling menimpa (kecuali bagian bersusun yang memang sepusat, yaitu bangun inti, batang, dan jari-jari pusat).

## 10. Kompatibilitas dengan data lama

Paket dan cadangan yang dibuat sebelum mesin ini memakai `visual.figures`, `option.figure`, dan `proof.kind: 'figure'`. Semuanya masih terbaca: `solveFigure` dan render lama dipertahankan, dan audit tetap meloloskannya. Soal baru memakai `scenes`, `scene`, dan `proof.kind: 'scene'`.

Soal yang disunting manual lewat `QuestionEditor` berubah menjadi `proof.kind: 'manual'` (perilaku yang sudah ada di `editQuestion`, `lib/quality.ts`). Untuk soal bergambar, audit tetap memeriksa struktur setiap gambar (`checkScene`), lima opsi yang berbeda, dan kunci tunggal, tetapi tidak lagi membuktikan kunci dari aturan; penelaah yang harus memeriksa isinya.

## 11. Pengujian

```
npm run typecheck
npm run verify
npm run verify:quality
```

`scripts/figural-checks.ts` dipanggil dari `scripts/verify.ts` dan memeriksa:

- katalog bentuk: simetri putar dan kiralitas tiap bentuk diukur numerik;
- aljabar gambar (putar, cermin, `sameScene`, `rotationBetween`) dan perangkat hipotesis;
- 4 jenis × 4 tingkat × 90 seed (1.440 soal) lewat `makeTiu`: lolos `auditQuestion`, kalimat baku tanpa kebocoran, SVG sah, pembahasan tidak menyebut huruf opsi, lima alasan berbeda, setiap pengecoh berbeda dari kunci dengan alasan "beda konkret";
- kontrol negatif (18 seed per sel, 1.152 kasus): kunci digeser, opsi dikembarkan, kunci diubah, stimulus dirusak di kotak terdekat kotak tersembunyi, mekanisme tidak dikenal, dan dua gambar yang berbeda; semuanya harus ditolak validator;
- kerumitan naik tiap tingkat, dan pengecoh sulit serta HOTS pada serial dan matriks hanya berbeda pada satu bagian;
- determinisme per seed (termasuk lewat `generate`), keunikan 240 soal di 10 paket, sebaran huruf kunci merata (χ² < 13,28), dan submateri memilih keluarga yang benar;
- `QuestionCard` dirender di server dan jumlah SVG-nya dihitung; ekspor Word dan PDF dijalankan di Node dengan DOM tiruan; rasterisasi nyata dengan `sharp` bila tersedia;
- fixture paket lama tetap lolos.

`scripts/quality-verify.ts` ditambah pemeriksaan kurasi, persetujuan, ekspor, cadangan (roundtrip), suntingan, serta penolakan cadangan yang dirusak atau kunci yang digeser untuk soal figural.

Melihat contoh dengan mata:

```
npm run figural:preview -- --out <folder> [--per 3] [--seed CONTOH] [--png]
```

Skrip ini menulis `index.html` berisi gambar, kunci, pembahasan, dan alasan tiap opsi untuk setiap jenis dan tingkat. `--png` juga menulis PNG per soal bila pustaka `sharp` tersedia (tidak wajib). Paket nyata dapat dibuat dengan `npm run generate -- --mode TIU --paket 3 --seed FIG-UJI --out <folder>`.

## 12. Contoh soal

Teks dipangkas; gambarnya dapat dilihat lewat `figural-preview.ts`.

**Serial, sulit (`serial-tiga-aturan`).** Kalimat soal: "Tentukanlah gambar yang tepat untuk menggantikan tanda tanya "?" pada seri gambar di bawah ini!"

> Pembahasan: Terdapat 3 aturan yang berjalan bersamaan dari kotak ke kotak: (1) bangun di tengah berputar 135° berlawanan arah jarum jam pada setiap kotak; (2) batang yang melintang di tengah berputar 90° searah jarum jam pada setiap kotak; (3) warna bulatan kecil di sudut berganti-ganti antara putih dan hitam. Meneruskan semua aturan itu ke kotak ke-3: bangun di tengah (trapesium) sisi pendek ke kanan bawah, batang terputar 180° dari kedudukannya pada kotak pertama, dan bulatan kecil berwarna putih.
>
> Pengecoh: "Gambar ini berbeda dari gambar yang benar: bulatan kecil di sudut (lingkaran) berwarna hitam, seharusnya putih. Padahal warna bulatan kecil di sudut berganti-ganti antara putih dan hitam."

**Matriks, sulit (`matriks-latin`).** Kalimat soal: "Tentukanlah gambar yang tepat untuk menggantikan tanda tanya "?" pada susunan gambar di bawah ini!"

> Pembahasan: Setiap baris dan setiap kolom memuat ketiga bentuk bangun di tengah (segitiga, segienam, dan lingkaran) tepat satu kali. Hal yang sama berlaku untuk warna bangun di tengah dan bentuk bangun kecil di sudut. Warna bangun kecil di sudut sama pada setiap baris.
>
> Pengecoh: "Gambar ini berbeda dari gambar yang benar: bangun di tengah (lingkaran) berganti menjadi segitiga. Padahal setiap baris dan setiap kolom memuat ketiga bentuk bangun di tengah tepat satu kali."

**Analogi, sulit (`analogi-putar+inversi`).** Kalimat soal: "Tentukanlah gambar yang tepat untuk menggantikan tanda tanya "?", sehingga kedua pasangan gambar di bawah ini memiliki hubungan yang serupa."

> Pembahasan: (1) seluruh gambar diputar 90° berlawanan arah jarum jam; (2) warna putih dan hitam pada semua bagian (selain bangun pembingkai) saling berbalik, sedangkan warna abu-abu tetap. Diterapkan pada gambar ketiga.
>
> Pengecoh: "Gambar ini berbeda dari gambar yang benar: seluruh gambar berputar 90° searah jarum jam dari kedudukan yang benar. Padahal pada pasangan pertama seluruh gambar diputar 90° berlawanan arah jarum jam."

**Ketidaksamaan, sedang (`ketidaksamaan-sisi`).** Kalimat soal: "Manakah gambar yang memiliki prinsip, pola, atau karakteristik yang berbeda dibandingkan gambar lainnya?"

> Pembahasan: Hitung banyaknya sisi pada kelima gambar; hasilnya (diurutkan dari yang paling sedikit) adalah 6, 6, 9, 9, 11. Gambar dengan 6 dan 9 sisi masing-masing berpasangan, sedangkan gambar dengan 11 sisi tidak memiliki pasangan.
>
> Kunci: "Gambar ini memiliki 11 sisi (sisi terpanjangnya menghadap ke kanan atas, sekitar 35° dari atas searah jarum jam, dan memiliki 4 sudut cekung), satu-satunya yang tidak berpasangan dengan gambar lain dalam banyaknya sisi."

**Ketidaksamaan, sulit (`ketidaksamaan-garis`).**

> Pembahasan: Empat gambar lainnya adalah pola yang sama persis, hanya ditampilkan pada sudut putar yang berbeda-beda: bila diputar seperlunya, keempatnya bertumpuk tepat satu sama lain. Gambar yang berbeda tidak dapat ditumpangkan pada keempatnya karena gambar ini merupakan bayangan cermin dari keempat gambar lain.

**Matriks, sulit (`matriks-tumpuk-xor`).**

> Aturan: gambar pada kolom ketiga adalah hasil menumpuk gambar kolom pertama dan kedua pada baris yang sama; garis yang sama pada kedua gambar saling menghilangkan. Pengecoh "garis lingkaran tambahan" adalah hasil menggabungkan saja tanpa saling menghilangkan.

## 13. Menambah bentuk atau mekanisme

**Bentuk baru.** Tambahkan ke `GLYPH_LIST` di `lib/figural/glyphs.ts` (kontur berpusat di (0, 0), menghadap atas, simetris terhadap sumbu tegak bila punya sumbu cermin), isi orde simetri `k` dan `chiral`. Tes simetri di `scripts/figural-checks.ts` akan menolak metadata yang tidak cocok dengan kontur. Daftarkan ke `CORE_GLYPHS`, `MARK_GLYPHS`, `PLAIN_GLYPHS`, atau `FRAME_GLYPHS` agar dipakai oleh pembuat soal.

**Mekanisme baru.**

1. Tulis pembuat soal yang mengembalikan `Built` (`lib/figural/compose.ts`): kotak stimulus, kunci, pengecoh dengan aturan yang dilanggar, `rule`, pembahasan, dan kalimat soal baku.
2. Daftarkan sebagai resep pada pembuat yang ada (`pickOps`, `plan`, `buildMatrix`, `buildOdd`) atau sebagai keluarga baru di `BUILDERS` (`lib/figural/index.ts`) dan `TIU_FAMILIES` (`lib/tiu.ts`).
3. Validator harus mampu membuktikan aturan itu sendiri. Bila aturan memerlukan kelas hipotesis baru, tambahkan di `lib/figural/hyp.ts`; bila tidak, soal ditolak. Untuk ketidaksamaan, daftarkan mekanisme di `ODD_FEATURE` dan pastikan `panel` memuat cirinya.
4. Tambahkan rumusan kalimat soal ke `STEMS` bila jenisnya baru.
5. Jalankan `npm run verify`; tes menjelajah semua keluarga, tingkat, dan seed, serta menjalankan kontrol negatif pada mekanisme baru.

## 14. Batasan

- HOTS dilipat ke Sulit oleh aplikasi, sehingga resep tingkat tertinggi (aturan keempat pada serial, tiga perubahan pada analogi, dua kelompok bangun pada matriks) hanya dapat dicapai lewat panggilan langsung ke mesin.
- Validator hanya membuktikan aturan yang termasuk kelas hipotesisnya. Soal dengan aturan di luar kelas itu ditolak dan dibuang, bukan dianggap benar.
- Validator tidak menilai keterbacaan visual. Penyaring bentuk dan penjaga tata letak (`layoutOk`) membatasi tumpang tindih dan jangkauan, tetapi peninjauan mata tetap perlu; gunakan `figural-preview.ts`.
- Pencerminan selalu terhadap sumbu tegak, dan putaran selalu terhadap pusat kotak.
- Soal bergambar belum punya varian kalimat; semua soal sejenis memakai kalimat baku yang sama, sesuai gaya soal 2027.
