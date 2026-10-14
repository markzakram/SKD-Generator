# JadiASN SKD Studio

Aplikasi untuk menyusun paket latihan **TWK, TIU, TKP, atau SKD gabungan**, berdasarkan riset dan contoh soal JadiASN yang disertakan. Generator, pratinjau, dan ekspor berjalan di browser. Tidak memerlukan API key, database, atau environment variable.

## Jalankan lokal

Memerlukan Node.js 20.9 atau lebih baru. Gunakan Node.js 22 LTS atau 24 LTS.

~~~powershell
npm install
npm run dev
~~~

Buka `http://localhost:3000`. Halaman langsung membuat contoh paket SKD 110 soal.

~~~powershell
npm run verify
npm run build
npm start
~~~

## Deploy ke Vercel

1. Masukkan isi folder proyek ini ke repositori GitHub.
2. Di Vercel, pilih **Add New → Project**, lalu impor repositori tersebut.
3. Pilih **Framework Preset: Next.js**. Jika repositori hanya memuat proyek ini, Root Directory adalah root repositori. Jika digabung dengan proyek lain, pilih folder `SKD Generator`.
4. Gunakan Build Command `npm run build`, Install Command `npm install`, dan Output Directory bawaan Next.js.
5. Pilih Node.js 22.x atau 24.x, lalu deploy. Tidak perlu menambahkan environment variable.

Konfigurasi framework sudah tersedia di `vercel.json`. **Sertakan `data/` dan `package-lock.json`**; bank JSON dipakai langsung oleh aplikasi saat build. Folder `references/` tidak diperlukan untuk deployment dan dikecualikan melalui `.vercelignore`.

Dokumentasi resmi: [Next.js di Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).

## Cara menggunakan

- Pilih SKD lengkap, TWK, TIU, atau TKP.
- Atur judul, jumlah paket, soal per paket, kesulitan, durasi, materi, dan submateri.
- Klik **Buat paket soal**. Cari soal atau filter subtes dalam pratinjau.
- Buka pembahasan per soal atau aktifkan **Tampilkan kunci**.
- Klik **Unduh paket** untuk PDF, Word, CSV, atau JSON. Word/PDF dapat berisi naskah soal tanpa kunci, kunci saja, atau soal beserta pembahasan; dokumen dapat dipisahkan per paket dalam ZIP.

Pengaturan hasil terakhir disimpan di browser. Seed dan pengaturan yang sama menghasilkan paket identik. Perubahan kontrol baru diterapkan setelah tombol generate ditekan; ekspor selalu memakai pengaturan yang melekat pada hasil yang sedang ditinjau.

## Isi generator

| Bagian | Isi awal |
| --- | --- |
| TWK | 117 butir: 37 contoh riset dan 80 variasi latihan dari 20 kerangka |
| TKP | 118 butir: 26 contoh panduan dan 92 variasi kasus dari 23 kerangka submateri |
| TIU | 25 famili berparameter: 8 verbal, 13 numerik, dan 4 figural |

Variasi kasus dapat menggunakan kerangka dan alternatif respons yang sama dalam konteks berbeda. Angka butir bukan jumlah kerangka unik. Tidak ada janji bank tak terbatas.

TWK mencakup Nasionalisme, Integritas, Bela Negara, Pilar Negara, dan Bahasa Negara. TKP mencakup Pelayanan Publik, Jejaring Kerja, Sosial Budaya, TIK, Profesionalisme, dan Anti Radikalisme. TIU mencakup analogi, silogisme, posisi/peringkat/jadwal, argumen, kategori, rute, berhitung/pecahan, deret, tabel, kecukupan data, cerita numerik, kombinasi optimal, serta analogi/ketidaksamaan/serial/matriks figural.

Dalam paket gabungan, jumlah soal dibagi mengikuti rasio 30 TWK : 35 TIU : 45 TKP. Bila jumlah diubah, rasio diskalakan dengan pembagian sisa sehingga total selalu tepat. Durasi dapat diubah di halaman.

Baseline jumlah soal dan durasi berasal dari riset pengguna dengan acuan aturan 2024. Ini bukan penetapan ketentuan resmi CPNS 2027. Pembaruan baseline dilakukan di `lib/config.ts`.

## Persediaan dan validasi

- Soal identik selalu dicegah dalam satu paket, termasuk soal yang hanya berbeda urutan opsi.
- Pilihan **Tanpa soal berulang antarpaket** juga mencegah pengulangan di seluruh batch. Jika bahan tidak cukup, generator menjelaskan batasnya dan menghentikan permintaan.
- Saat pilihan tersebut dimatikan, suatu butir boleh dipakai pada paket berbeda. Tidak ada pengulangan diam-diam dalam paket yang sama.
- Pembatasan umum: 50 paket, 200 soal per paket, dan 4.000 soal per proses. Filter serta persediaan bank dapat membatasi lebih rendah.
- Opsi diacak bersama skor dan alasan; label dalam pembahasan contoh sumber ikut dipetakan ke posisi baru.
- TWK/TIU memakai satu kunci bernilai 5 dan pengecoh bernilai 0. TKP menyimpan poin 1–5 pada setiap alternatif.
- Validator mencocokkan soal bank dengan sumber terstruktur, menghitung ekspresi numerik, memeriksa model silogisme melalui tabel kebenaran, dan menentukan kunci figural dari stimulus.

Validasi otomatis memastikan struktur dan aturan yang dimodelkan; validasi ini tidak menggantikan peninjauan akademik fakta, bahasa, kualitas pengecoh, atau rubrik setiap kasus. Tingkat kesulitan adalah label konten, bukan hasil kalibrasi psikometrik pada peserta nyata.

## Ekspor

PDF dan Word menyertakan gambar figural yang dirender dari SVG. CSV menyimpan kolom soal, opsi, kunci, poin, alasan tiap opsi, sumber, dan stimulus terstruktur. JSON menyimpan seluruh data, termasuk model gambar serta metadata pemeriksaan.

Ekspor browser memakai `docx`, `jspdf`, dan `fflate` yang dibundel oleh aplikasi; tidak mengambil library dari CDN. PDF menggunakan font Helvetica dan menyederhanakan beberapa simbol menjadi bentuk teks yang kompatibel.

## CLI dan API

~~~powershell
npm run generate -- --mode SKD --paket 1 --seed LATIHAN-01 --out output
npm run generate -- --mode TIU --soal 35 --paket 5 --seed TIU-01
npm run generate -- --mode TKP --paket 5 --boleh-ulang
~~~

CLI menulis `paket.json` dan `validasi.json`. PDF/Word dibuat dari halaman browser.

`GET /api/generate` mengembalikan metadata bank, famili, dan batas API.

`POST /api/generate` menerima pengaturan JSON:

~~~json
{
  "mode": "TIU",
  "count": 20,
  "packages": 1,
  "seed": "TIU-01",
  "difficulty": "campuran",
  "topics": ["Numerik"],
  "subtopics": [],
  "uniqueAcross": true
}
~~~

Format filter submateri adalah `Materi::Submateri`, misalnya `Figural::Matriks 3 × 3`. API dibatasi 1.000 soal per permintaan dan mengembalikan error 400 untuk pengaturan yang tidak valid.

## Menambah konten

- `lib/bank/twk.ts`: kerangka TWK dan variasi pertanyaan.
- `lib/bank/cases.ts`: kasus TKP, skor, serta alasan setiap tindakan.
- `lib/config.ts`: materi, submateri TKP, preset, dan baseline.
- `lib/tiu.ts`: famili serta pembangkit TIU.
- `lib/solver.ts`: parser hitungan dan pemeriksa logika.
- `lib/figures.ts`: model, render SVG, dan pemeriksa pola gambar.
- `data/twk-reference.json` dan `data/tkp-reference.json`: contoh sumber yang diimpor.
- `data/tkp-score-rows.json`: alasan/skor dari sel tabel PDF asli.

Saat menambah soal, berikan lima opsi yang berbeda, satu kunci terbaik, pembahasan, alasan per opsi, dan sumber. Jalankan `npm run verify` setelah perubahan.

## Memperbarui sumber riset

Ekstraksi sumber tersimpan di `references/`; aplikasi tidak membacanya saat runtime. `npm run references` menyusun ulang bank contoh dari ekstraksi teks dan skor tabel yang sudah disimpan.

Jika PDF TKP diganti, ekstrak kembali sel tabel dengan Python yang memiliki `pdfplumber`, kemudian impor ulang:

~~~powershell
python scripts/extract-tkp-tables.py
npm run references
npm run verify
~~~

Ekstraksi tabel sengaja dipisahkan dari teks agar alasan skor tidak bergeser ketika label opsi berada di tengah tinggi baris PDF. Tiga contoh TWK dikecualikan dan tiga pembahasan dikoreksi; rincian tersedia di `data/reference-import-report.json`.

## Pemeriksaan

`npm run verify` menguji determinisme, distribusi, filter materi/submateri, pengulangan, setiap famili TIU pada beberapa seed, serta penolakan kunci/angka/gambar/skor yang diubah.

`scripts/browser-smoke.mjs` menguji antarmuka, pengaturan tersimpan, gambar figural, pencarian, lima jenis unduhan, layout mobile, dan API. Script ini memerlukan Playwright pada lingkungan pengujian; Playwright tidak diperlukan untuk build atau deployment.
