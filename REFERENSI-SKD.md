# Referensi pengembangan generator SKD

Ditinjau pada 14 Oktober 2026. Tujuan pengecekan ini adalah memetakan generator yang sudah ada dan bahan riset untuk pengembangan generator TWK, TIU, dan TKP di proyek ini.

## Hasil pengecekan sumber

| Sumber | Hasil | Peran |
| --- | --- | --- |
| `G:/Downloads/JadiASN - Riset Seleksi CPNS 2027.docx` | Terbaca; Bab 5.1 memuat 40 contoh TWK | Struktur materi, bentuk contoh TWK, dan baseline konfigurasi paket |
| [Contoh Soal TIU SKD 2027](https://drive.google.com/file/d/1tzx3GR5GSYtkuTkR1kXfDqyUsao2jXiP/view) | PDF berhasil diunduh; 74 halaman; contoh gambar figural diperiksa | Pola verbal, numerik, tabel, kecukupan data, dan figural |
| [Panduan Produksi Soal TKP JadiASN](https://drive.google.com/file/d/1NgyWaSFh7oL_Sfjkw37LvxiZCOFQw7P_/view) | PDF berhasil diunduh; 97 halaman | Enam materi, 23 submateri, rubrik respons, Bloom, dan pembahasan skor tiap opsi |

Tautan TKP sempat mengarah ke login pada percobaan pertama. Setelah pengguna memberikan tautan kembali, unduhan berhasil. Status sumber yang berlaku adalah berhasil diunduh dan dibaca.

Salinan kedua PDF, ekstraksi teks, URL sumber, hash SHA-256, dan metadata tersimpan di `references/`. PDF asli tetap menjadi rujukan untuk gambar, tabel, dan rumus; ekstraksi teks saja tidak menangkap seluruh isi visual.

## Pemetaan proyek yang sudah ada

Sepuluh proyek diperiksa melalui struktur berkas dan dokumentasinya. Bagian mesin, kontrak data, validasi, dan kontrol yang paling relevan juga ditinjau. Pengecekan ini bersifat baca kode; angka kapasitas dan hasil pengujian dalam README lama tidak diuji ulang.

| Proyek di `G:/Ali/code/` | Bagian yang dapat menjadi referensi | Penyesuaian untuk SKD |
| --- | --- | --- |
| `Kepribadian generator` | Antarmuka Next.js/TypeScript, korpus SJT, poin tiap opsi, pengacakan, kapasitas bank, validasi, ekspor Word/PDF/CSV/ZIP | Kandidat fondasi aplikasi. Konten STS, Passhand, dan distribusi Sekdin diganti dengan materi SKD dan rubrik TKP |
| `Tes Hitung Generator` | Pola numerik berparameter, pengecoh, pembahasan, seed, perhitungan ulang independen | Dasar TIU numerik; batas angka dan mapping KAI perlu diganti |
| `Tes Ketelitian Generator` | Validasi independen, distribusi paket, pratinjau dan ekspor | Referensi alur dan pemeriksaan mutu; isi soal S/T tidak termasuk materi yang diminta |
| `KBBI Generator` | Dataset terkurasi, porsi jenis soal, sumber definisi, pengecoh berbasis data | Pendukung bahasa dan kosakata. Analogi TIU tetap perlu hubungan semantik; TWK Bahasa Negara memerlukan bacaan dan kaidah bahasa |
| `Tahap2Generator` | Bank fakta/kerangka, pemeriksaan kemiripan, riwayat soal, ekspor | Referensi TWK berbasis konten terkurasi dan pemeriksaan duplikasi; isi PCPM tidak dipakai sebagai konten SKD |
| `tka-generator/soal-engine` | Blueprint/famili soal, pembahasan, pemeriksaan mutu, mesin aturan dan jalur AI/manual | Referensi pemisahan pola, isi, dan verifikasi; kebutuhan layanan AI untuk SKD belum ditetapkan |
| `Figural Kesesuaian Generator` | Analogi, ketidaksamaan, serial, render gambar, audit opsi secara geometris | Dasar TIU figural. Pola matriks 3×3 dan variasi dalam PDF TIU perlu dikembangkan tersendiri |
| `figural dadu` | Geometri, gambar soal/opsi, pengecoh teruji | Referensi teknis gambar spasial jika dibutuhkan; bukan pengganti seluruh figural TIU |
| `diagrammatical` | Famili aturan visual, sampling, validator ambiguitas, SVG/PNG | Referensi mesin visual dan pemeriksaan kunci; format klasifikasi set berbeda dari contoh TIU |
| `ICON Aplikasi generator` | Aset dan token visual JadiASN | Pendukung identitas tampilan aplikasi |

## Materi yang perlu dimodelkan

### TWK

Lima materi: Nasionalisme, Integritas, Bela Negara, Pilar Negara, dan Bahasa Negara. Bab 5.1 memuat delapan contoh per materi: dua Mudah, dua Sedang, dua Sulit, dan dua HOTS. Totalnya 40 contoh, dengan sepuluh contoh pada setiap label kesulitan.

Bentuknya mencakup kasus penerapan nilai, sejarah/tokoh, pemahaman konstitusi, kombinasi pernyataan, bacaan, kesimpulan, dan kalimat efektif. Mesin TWK memerlukan bank fakta dan kasus yang ditinjau secara akademik. Mengganti nama atau mengacak opsi pada 40 contoh tidak memberikan keragaman yang cukup untuk bank soal besar.

### TIU

PDF mencakup tiga kelompok: verbal, numerik, dan figural. Detailnya meliputi silogisme naratif, analisis argumen, susunan/jadwal/rute, deret dan tabel, kombinasi pernyataan/optimasi, kecukupan data, serta analogi/ketidaksamaan/serial/matriks figural.

Perbedaan penting dalam riset adalah kecukupan data, silogisme dengan dua atau tiga premis dalam narasi, dan penilaian kekuatan argumen. Pola numerik dan logika perlu memiliki penyelesaian yang dapat diperiksa ulang. Figural harus menyimpan aturan serta gambar soal dan setiap opsi. Subjudul Fibonacci di PDF tidak disertai contoh teks; cakupannya perlu dilengkapi saat penyusunan bank.

### TKP

| Materi | Jumlah submateri |
| --- | ---: |
| Pelayanan Publik | 5 |
| Jejaring Kerja | 4 |
| Sosial Budaya | 4 |
| Teknologi Informasi dan Komunikasi | 3 |
| Profesionalisme | 3 |
| Anti Radikalisme | 4 |

Panduan memuat 26 penanda contoh soal. Setiap contoh menilai tindakan dalam konteks, dengan poin dan alasan untuk opsi A–E. Bank perlu menyimpan skor per opsi, alasan penilaian, indikator, serta level Bloom. Saat opsi diacak, skor dan alasannya harus berpindah bersama teks opsi.

Rubrik perlu menimbang kepatuhan/kewenangan, hak dan keselamatan, efektivitas, komunikasi, proporsionalitas, serta tindak lanjut sesuai materinya. Penilaian tidak cukup ditentukan oleh keramahan, panjang opsi, atau tindakan yang paling formal.

Panduan memetakan C1–C6 ke label kesulitan aplikasi, tetapi juga menjelaskan bahwa Bloom bukan satu-satunya penentu kesulitan. Simpan `levelBloom` dan `tingkatKesulitan` sebagai metadata terpisah. Setiap submateri memiliki rentang Bloom yang perlu diperhatikan.

## Arah implementasi

Rekomendasi fondasi adalah mengikuti pola `Kepribadian generator`: aplikasi Next.js/TypeScript dengan kontrol, pratinjau, ringkasan, validator, dan ekspor. Sediakan tiga mode utama TWK, TIU, dan TKP, lalu pilihan materi/submateri, jumlah soal/paket, tingkat kesulitan, serta seed. Paket gabungan SKD dapat menjadi preset tambahan.

Pisahkan mesin untuk setiap subtes:

- TWK: fakta dan kasus terkurasi, kerangka soal, pengecoh dengan alasan.
- TIU: generator berparameter, solver numerik/logika, serta render dan audit visual.
- TKP: bank skenario dengan rubrik respons dan poin/alasan tiap opsi.

Kontrak satu butir sebaiknya memuat ID, subtes, materi, submateri, tingkat kesulitan, level Bloom bila relevan, stimulus, pertanyaan, opsi, kunci terbaik, skor tiap opsi, pembahasan, aturan/pola, dan sumber. Stimulus perlu mendukung teks, tabel, rumus, dan gambar.

Alur bersama: pilih bahan/pola → rakit soal dan opsi → hitung kunci/poin → validasi → cek kemiripan → pratinjau → ekspor soal, kunci, dan pembahasan. Kapasitas paket harus mengikuti persediaan konten; batas 500 paket dari proyek lama tidak otomatis berlaku untuk SKD.

## Temuan yang perlu diselesaikan pada konten

- TWK Bela Negara Soal 1 dan Soal 5 hampir sama, walau diberi label kesulitan berbeda.
- Pembahasan TWK Nasionalisme Soal 4 dan Bahasa Negara Soal 5 kosong pada ekstraksi paragraf dokumen.
- TWK Bela Negara Soal 3 berkunci A, tetapi bagian alasan pengecoh menamai opsi pertama yang salah sebagai A; label pembahasannya bergeser terhadap daftar opsi.
- Bagian Bahasa Negara juga memuat contoh analogi kalimat; klasifikasinya perlu diputuskan saat kurasi.
- Kebenaran seluruh fakta sejarah/konstitusi dan urutan skor TKP belum diaudit secara menyeluruh. Gunakan sumber ini sebagai pola dan bahan kurasi, lalu verifikasi konten sebelum masuk bank produksi.
- Riset berjudul 2027, tetapi beberapa bagian masih menyebut 2026 dan menggunakan acuan aturan 2024. Bagian perubahan TIU adalah proyeksi riset berdasarkan Sekdin 2026. Pengecekan ini tidak menetapkan bahwa semua rincian tersebut telah menjadi ketentuan resmi CPNS 2027.

Preset dalam riset adalah TWK 30 soal, TIU 35 soal, TKP 45 soal, dengan durasi gabungan 100 menit. Simpan jumlah, durasi, skor, dan ambang batas dalam konfigurasi yang dapat diperbarui sesuai sumber resmi saat implementasi.

## Berkas hasil pengecekan

- `references/source-manifest.json`: indeks sumber, metadata, status akses, dan hash PDF.
- `references/riset-cpns-2027.txt`: ekstraksi paragraf dokumen Word.
- `references/contoh-tiu-skd-2027.pdf` dan `.txt`: PDF TIU dan ekstraksi teksnya.
- `references/panduan-tkp-jadiasn.pdf` dan `.txt`: PDF TKP dan ekstraksi teksnya.

Sumber referensi diperlakukan sebagai bahan konten. Rekomendasi implementasi di atas merupakan hasil pemetaan, bukan aplikasi yang sudah selesai dibangun.
