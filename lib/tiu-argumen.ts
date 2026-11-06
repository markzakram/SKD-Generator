// Pembangkit soal Memperkuat/Memperlemah Argumen (TIU Verbal Analitis, baris tryout 17). Panduan Produksi Soal TIU JadiASN tidak memuat bagian ini, jadi pola mengikuti
// sembilan contoh diterima (Andika, "Verbal Analitis - Memperkuat/Memperlemah"): stem berisi fakta dan pendapat (alasan lalu kesimpulan), pertanyaan "Temuan manakah yang paling
// MEMPERKUAT/MEMPERLEMAH ...?", lima opsi sejajar, dan pembahasan alasan -> kesimpulan -> penghubung yang disentuh kunci -> mengapa pengecoh terkuat gagal.
// Setiap skenario ditulis utuh oleh penulis: satu argumen, satu temuan penguat, satu temuan pelemah, dan empat pengecoh netral (tidak relevan, sebagian, di luar cakupan,
// mengulang premis) yang tidak memperkuat maupun memperlemah. Kedua arah dari satu skenario dihitung sebagai dua butir; opsi "arah terbalik" ialah temuan arah lawan.
// Aturan redaksi opsi (diperiksa scripts/tiu-format-checks.ts): kelima opsi sama-sama berupa pernyataan temuan dengan panjang yang mirip (rasio terpanjang terhadap terpendek paling
// banyak 1,4; panjang rata-rata tiap peran berselisih paling banyak 10% dari kunci) sehingga panjang tidak membocorkan kunci; penanda ragu ("belum diketahui", "tanpa data", "tidak
// diperiksa") tidak dipakai pada pengecoh karena peserta akan mencoret opsi beraroma ragu tanpa bernalar. Pengecoh "sebagian" dan "di luar cakupan" ditulis sebagai fakta biasa;
// kekurangannya (tidak menyentuh penghubung argumen) hanya dijelaskan pada pembahasan (`gagal`). Kata kontras ("sedangkan", "tetap sama", "tidak") tersebar pada pengecoh juga.
import { rng, type Rng } from './rng';
import { KEY_MARK } from './explanation';
import type { ArgumentRole } from './models';

export type Arah = 'perkuat' | 'lemahkan';
type Pengecoh = [teks: string, gagal: string];
export type Skenario = {
  id: string; level: 'sedang' | 'sulit'; jenis: string;
  fakta: string; pendapat: string; sebutan: string; pihak: string;
  alasan: string; kesimpulan: string; hubung: string;
  penguat: string; pelemah: string; penguatJelas: string; lemahJelas: string;
  tidakRelevan: Pengecoh; sebagian: Pengecoh; luarCakupan: Pengecoh; ulangPremis: Pengecoh;
};

export const SKENARIO: Skenario[] = [
  // ---- Sedang: hubungan langsung antara tindakan dan hasil ----------------------------------------------------------------------------
  { id: 'antrean-digital', level: 'sedang', jenis: 'sebab-akibat langsung',
    fakta: 'Sebuah kantor kelurahan mulai membagikan nomor antrean digital yang menampilkan perkiraan waktu giliran di layar ruang tunggu. Sebelumnya, warga mengantre tanpa mengetahui kapan akan dipanggil.',
    pendapat: 'Lurah berpendapat bahwa nomor antrean digital akan mengurangi keluhan warga tentang lamanya menunggu, karena warga dapat memperkirakan gilirannya dan mengatur waktunya sendiri.',
    sebutan: 'pendapat lurah', pihak: 'lurah', alasan: 'perkiraan giliran memungkinkan warga mengatur waktunya sendiri', kesimpulan: 'keluhan tentang lamanya menunggu akan berkurang',
    hubung: 'Bagian yang perlu diuji adalah apakah warga benar-benar memakai perkiraan giliran untuk mengatur waktu dan apakah hal itu mengurangi keluhan mereka.',
    penguat: 'warga memakai perkiraan giliran untuk mengurus keperluan lain sebelum dipanggil, dan keluhan tentang lamanya menunggu menurun pada hari kunjungan sebanding',
    pelemah: 'perkiraan giliran sering meleset jauh dari waktu pemanggilan sebenarnya sehingga warga tetap duduk di ruang tunggu, dan keluhan menunggu tidak berkurang',
    penguatJelas: 'Temuan ini menunjukkan kedua bagian argumen terhubung: perkiraan giliran dipakai untuk mengatur waktu, lalu keluhan menurun pada beban kunjungan yang setara, sehingga penurunan itu tidak sekadar karena pengunjung berkurang.',
    lemahJelas: 'Temuan ini memutus penghubung argumen: perkiraan yang tidak dapat diandalkan tidak dipakai warga untuk mengatur waktu, sehingga keluhan tidak berkurang sebagaimana diperkirakan.',
    tidakRelevan: ['layar ruang tunggu juga menampilkan pengumuman jadwal posyandu dan imbauan agar warga tidak lupa membawa fotokopi kartu keluarga saat mengurus dokumen kependudukan', 'Informasi tambahan pada layar tidak berkaitan dengan pemakaian perkiraan giliran maupun keluhan tentang lamanya menunggu.'],
    sebagian: ['warga menilai tampilan nomor antrean mudah dibaca, dan layar ruang tunggu tidak pernah mati dari pagi hingga jam pelayanan berakhir pada semua hari kerja', 'Tampilan yang mudah dibaca dan layar yang selalu menyala hanya menunjukkan perkiraan giliran dapat dilihat; belum ada bukti bahwa warga memakainya untuk mengatur waktu atau bahwa keluhan berkurang.'],
    luarCakupan: ['petugas loket merasa urutan kerja mereka lebih teratur sejak nomor antrean dipakai, dan jumlah berkas yang terselesaikan setiap hari bertambah sedikit', 'Keteraturan kerja petugas berada di luar hal yang dipersoalkan, yaitu keluhan warga tentang lamanya menunggu.'],
    ulangPremis: ['nomor antrean digital menampilkan perkiraan waktu giliran di layar ruang tunggu sehingga warga dapat melihat urutan pemanggilan dari tempat duduknya', 'Pernyataan ini hanya mengulang fakta yang sudah diketahui dan tidak menambah bukti tentang perilaku atau keluhan warga.'] },
  { id: 'membaca-pagi', level: 'sedang', jenis: 'sebab-akibat langsung',
    fakta: 'Sebuah sekolah dasar menambahkan lima belas menit membaca bersama sebelum pelajaran pertama setiap hari. Kegiatan itu diikuti seluruh siswa dengan buku cerita pilihan mereka sendiri.',
    pendapat: 'Kepala sekolah berpendapat bahwa kebiasaan ini akan meningkatkan kemampuan siswa memahami bacaan, karena siswa berlatih membaca secara teratur setiap hari.',
    sebutan: 'pendapat kepala sekolah', pihak: 'kepala sekolah', alasan: 'siswa berlatih membaca secara teratur setiap hari', kesimpulan: 'kemampuan memahami bacaan akan meningkat',
    hubung: 'Bagian yang perlu diuji adalah apakah latihan membaca yang teratur itu benar-benar tercermin pada kemampuan memahami bacaan.',
    penguat: 'siswa yang rutin membaca bersama menjawab soal pemahaman lebih tepat pada tes bulanan daripada siswa kelas sejenis yang belum menerapkannya, dengan guru sama',
    pelemah: 'skor pemahaman bacaan siswa tidak berubah setelah satu semester, padahal hampir semua siswa hadir pada kegiatan membaca bersama setiap pagi tanpa terlambat',
    penguatJelas: 'Temuan ini menghubungkan latihan rutin dengan hasil yang dikatakan kepala sekolah, dan kelas pembanding dengan guru serta bahan ajar yang sama menyingkirkan penjelasan lain.',
    lemahJelas: 'Temuan ini menunjukkan latihan teratur berlangsung tetapi hasil yang diperkirakan tidak muncul, sehingga hubungan antara kebiasaan membaca dan pemahaman bacaan menjadi lemah.',
    tidakRelevan: ['perpustakaan sekolah menambah koleksi buku bergambar dan memperbaiki pencahayaan ruang baca, lalu membuka layanan peminjaman buku tanpa biaya pada jam istirahat', 'Perbaikan fasilitas perpustakaan tidak berkaitan dengan kegiatan membaca bersama maupun hasil tes pemahaman.'],
    sebagian: ['siswa menyatakan senang mengikuti kegiatan membaca bersama, dan hampir tidak ada yang lupa membawa buku cerita pilihan sendiri setiap pagi sepanjang semester', 'Rasa senang dan kebiasaan membawa buku hanya menunjukkan kegiatan diterima dan diikuti; kemampuan memahami bacaan belum diukur.'],
    luarCakupan: ['guru kelas melaporkan siswa tampak lebih tenang dan siap saat memulai pelajaran pertama, dan siswa yang terlambat masuk kelas menjadi lebih sedikit', 'Ketenangan di kelas berada di luar kesimpulan yang menyangkut kemampuan memahami bacaan.'],
    ulangPremis: ['kegiatan membaca bersama berlangsung lima belas menit setiap pagi sebelum pelajaran pertama dan diikuti siswa di semua kelas dengan buku pilihan mereka', 'Pernyataan ini hanya mengulang fakta kegiatan dan tidak memberi bukti tentang pemahaman bacaan.'] },
  { id: 'pengingat-imunisasi', level: 'sedang', jenis: 'sebab-akibat langsung',
    fakta: 'Sebuah puskesmas mengirim pesan pengingat satu hari sebelum jadwal imunisasi balita. Pesan itu memuat tanggal dan tempat pelayanan, dan dikirim kepada orang tua yang terdaftar.',
    pendapat: 'Kepala puskesmas berpendapat bahwa pengingat tersebut akan meningkatkan jumlah balita yang diimunisasi tepat jadwal, karena orang tua sering lupa tanggal imunisasi.',
    sebutan: 'pendapat kepala puskesmas', pihak: 'kepala puskesmas', alasan: 'orang tua sering lupa tanggal imunisasi', kesimpulan: 'lebih banyak balita akan diimunisasi tepat jadwal',
    hubung: 'Bagian yang perlu diuji adalah apakah pesan itu benar-benar mengingatkan orang tua yang semula lupa, lalu mengubah ketepatan kedatangan mereka.',
    penguat: 'proporsi balita yang datang tepat jadwal naik sesudah pengingat dikirim, dan banyak orang tua yang datang menyebut pesan itu sebagai pengingat jadwal',
    pelemah: 'sebagian besar orang tua yang biasa lupa jadwal tidak membaca pesan dari puskesmas, dan proporsi balita yang datang tepat jadwal sama seperti sebelumnya',
    penguatJelas: 'Temuan ini menyentuh kedua ujung argumen: orang tua memakai pesan sebagai pengingat, dan ketepatan kedatangan meningkat sesudahnya.',
    lemahJelas: 'Temuan ini menunjukkan pesan tidak sampai kepada orang tua yang justru sering lupa, dan ketepatan kedatangan tidak berubah, sehingga alasan dan kesimpulan kepala puskesmas tidak terhubung.',
    tidakRelevan: ['puskesmas juga memperbarui papan informasi tentang manfaat vitamin A dan jam pelayanan poli gigi, sedangkan jumlah kursi di ruang tunggu tetap sama', 'Pembaruan papan informasi tidak berkaitan dengan pesan pengingat maupun ketepatan jadwal imunisasi.'],
    sebagian: ['pesan pengingat terkirim kepada hampir semua orang tua balita yang terdaftar tepat satu hari sebelum jadwal imunisasi dan tidak ada pesan yang gagal terkirim', 'Terkirimnya pesan hanya bagian awal; apakah pesan dibaca dan mengubah ketepatan kedatangan belum ditunjukkan.'],
    luarCakupan: ['petugas pendaftaran mengaku lebih mudah menyiapkan daftar balita karena jadwal kunjungan tercatat rapi sejak pengingat dikirim secara terjadwal setiap bulan', 'Kemudahan kerja petugas pendaftaran berada di luar hal yang dipersoalkan, yaitu ketepatan jadwal imunisasi balita.'],
    ulangPremis: ['pesan pengingat dikirim satu hari sebelum jadwal imunisasi dan memuat tanggal serta tempat pelayanan kepada orang tua balita yang terdaftar di puskesmas', 'Pernyataan ini hanya mengulang isi kegiatan yang sudah diketahui dan tidak menunjukkan perubahan perilaku orang tua.'] },
  { id: 'pembayaran-qr', level: 'sedang', jenis: 'sebab-akibat langsung',
    fakta: 'Pengelola sebuah pasar tradisional menyediakan pembayaran nontunai berkode QR di seluruh kios. Setiap transaksi yang dibayar dengan kode itu tercatat otomatis pada telepon pedagang.',
    pendapat: 'Pengelola berpendapat bahwa langkah ini akan mengurangi kesalahan hitung uang kembalian, karena nilai transaksi tercatat otomatis dan tidak perlu dihitung secara manual.',
    sebutan: 'pendapat pengelola pasar', pihak: 'pengelola', alasan: 'nilai transaksi tercatat otomatis dan tidak perlu dihitung manual', kesimpulan: 'kesalahan hitung uang kembalian akan berkurang',
    hubung: 'Bagian yang perlu diuji adalah apakah pembeli dan pedagang benar-benar memakai pembayaran nontunai, sehingga perhitungan manual berkurang.',
    penguat: 'pedagang yang beralih ke pembayaran QR melaporkan selisih kas harian jauh lebih kecil daripada sebelumnya, dengan jumlah transaksi per hari yang relatif sama',
    pelemah: 'sebagian besar pembeli tetap membayar tunai karena sinyal di pasar lemah, sehingga pedagang masih menghitung uang kembalian manual dan selisih kas tidak berubah',
    penguatJelas: 'Temuan ini menunjukkan pembayaran QR dipakai dan selisih kas mengecil pada beban transaksi yang setara, sehingga penurunan itu tidak sekadar karena transaksi berkurang.',
    lemahJelas: 'Temuan ini menunjukkan perhitungan manual tetap dominan, sehingga alasan pengelola tentang pencatatan otomatis tidak berlaku pada sebagian besar transaksi.',
    tidakRelevan: ['kios makanan di bagian depan pasar mendapat pelanggan baru dari karyawan perkantoran, sedangkan kios di bagian belakang tetap melayani pelanggan yang sama', 'Tambahan pelanggan kios makanan tidak berkaitan dengan cara pembayaran maupun selisih kas.'],
    sebagian: ['hampir semua pedagang telah memasang kode QR di kiosnya dan tidak ada yang melewatkan pelatihan singkat tentang cara memakainya pada minggu pertama program', 'Terpasangnya kode QR dan pelatihan belum menunjukkan bahwa transaksi benar-benar berpindah dari tunai ke nontunai.'],
    luarCakupan: ['pembayaran nontunai menurunkan biaya pengamanan uang tunai di pasar dan mengurangi kebutuhan pedagang menyetor uang tunai ke bank setiap hari menjelang sore', 'Biaya pengamanan berada di luar hal yang dipersoalkan, yaitu kesalahan hitung uang kembalian.'],
    ulangPremis: ['setiap kios kini memiliki kode QR yang mencatat nilai transaksi otomatis pada telepon pedagang begitu pembeli menyelesaikan pembayaran di kios tersebut', 'Pernyataan ini hanya mengulang fakta tentang fasilitas dan tidak menambah bukti tentang kesalahan hitung.'] },
  { id: 'papan-petunjuk', level: 'sedang', jenis: 'sebab-akibat langsung',
    fakta: 'Sebuah desa wisata memasang papan petunjuk jalur berbahasa Inggris di sepanjang rute kunjungan. Papan itu memuat nama setiap lokasi beserta arah menuju lokasi tersebut.',
    pendapat: 'Kepala desa berpendapat bahwa papan itu akan mengurangi wisatawan asing yang tersesat, karena mereka dapat membaca arah jalur sendiri tanpa bertanya.',
    sebutan: 'pendapat kepala desa', pihak: 'kepala desa', alasan: 'wisatawan asing dapat membaca arah jalur sendiri', kesimpulan: 'wisatawan asing yang tersesat akan berkurang',
    hubung: 'Bagian yang perlu diuji adalah apakah papan benar-benar dipakai wisatawan di titik tempat mereka biasa kehilangan arah.',
    penguat: 'laporan wisatawan asing yang tersesat dan meminta bantuan petugas menurun setelah papan terpasang, sedangkan jumlah wisatawan asing tiap bulan hampir sama',
    pelemah: 'wisatawan asing tersesat di persimpangan dalam desa yang tidak dipasangi papan, sehingga laporan tersesat tidak berkurang meski papan terpasang di jalur utama',
    penguatJelas: 'Temuan ini menunjukkan papan membantu menemukan arah dan penurunan laporan tidak disebabkan oleh berkurangnya wisatawan.',
    lemahJelas: 'Temuan ini menunjukkan papan tidak berada di titik tempat wisatawan kehilangan arah, sehingga kemampuan membaca arah tidak menolong di tempat yang justru bermasalah.',
    tidakRelevan: ['kelompok sadar wisata menambah penjual kerajinan di dekat gerbang desa pada akhir pekan dan menyediakan tempat parkir tambahan bagi bus wisata dan mobil pribadi', 'Tambahan penjual kerajinan tidak berkaitan dengan papan petunjuk maupun wisatawan yang tersesat.'],
    sebagian: ['wisatawan asing menilai tulisan pada papan jelas dan mudah dibaca, dan banyak dari mereka berhenti sejenak untuk membaca papan di gerbang jalur wisata', 'Kejelasan tulisan dan kebiasaan berhenti membaca di gerbang belum menunjukkan bahwa papan dipakai di persimpangan tempat wisatawan biasa kehilangan arah.'],
    luarCakupan: ['warga menyebut papan membuat desa tampak lebih tertata dan menambah kebanggaan mereka terhadap desanya sebagai tujuan wisata unggulan di kabupaten', 'Kesan tertata berada di luar kesimpulan tentang wisatawan asing yang tersesat.'],
    ulangPremis: ['papan berbahasa Inggris dipasang di sepanjang rute kunjungan desa wisata dan memuat nama setiap lokasi beserta arah menuju lokasi tersebut bagi para pengunjung', 'Pernyataan ini hanya mengulang fakta pemasangan papan dan tidak menambah bukti tentang wisatawan yang tersesat.'] },
  { id: 'pelatihan-k3', level: 'sedang', jenis: 'sebab-akibat langsung',
    fakta: 'Sebuah pabrik memberikan pelatihan keselamatan kerja selama satu jam kepada seluruh operator mesin. Pelatihan itu menjelaskan cara menghindari bahaya pada setiap jenis mesin di lini produksi.',
    pendapat: 'Manajer pabrik berpendapat bahwa pelatihan itu akan mengurangi kecelakaan ringan di lini produksi, karena operator menjadi lebih memahami cara menghindari bahaya mesin.',
    sebutan: 'pendapat manajer pabrik', pihak: 'manajer', alasan: 'operator menjadi lebih memahami cara menghindari bahaya mesin', kesimpulan: 'kecelakaan ringan di lini produksi akan berkurang',
    hubung: 'Bagian yang perlu diuji adalah apakah pemahaman yang diperoleh dari pelatihan benar-benar diterapkan operator saat bekerja.',
    penguat: 'kecelakaan ringan pada operator terlatih berkurang dibandingkan sebelum pelatihan, dan mereka mengaku menerapkan langkah pengamanan sebelum menjalankan mesin',
    pelemah: 'operator yang telah dilatih tetap melewatkan langkah pengamanan karena mengejar target harian, dan jumlah kecelakaan ringan di lini produksi tidak berubah',
    penguatJelas: 'Temuan ini menunjukkan pemahaman dari pelatihan diterapkan dalam pekerjaan dan angka kecelakaan menurun, sehingga alasan dan kesimpulan manajer terhubung.',
    lemahJelas: 'Temuan ini menunjukkan pengetahuan dari pelatihan tidak diterapkan karena tekanan target, sehingga kecelakaan tidak berkurang sebagaimana diperkirakan.',
    tidakRelevan: ['kantin pabrik memperpanjang jam layanan makan siang agar operator shift malam dapat makan lebih teratur, dan tidak menaikkan harga menu makanan maupun minuman', 'Perubahan jam kantin tidak berkaitan dengan pelatihan maupun kecelakaan di lini produksi.'],
    sebagian: ['seluruh operator hadir tepat waktu dan menyatakan materi pelatihan mudah dipahami, dan hampir semuanya dapat menyebutkan bahaya setiap jenis mesin pada tes tertulis', 'Kehadiran dan penguasaan materi pada tes tertulis belum menunjukkan bahwa langkah pengamanan diterapkan saat bekerja.'],
    luarCakupan: ['pelatihan membuat operator lebih percaya diri berbicara dengan penyelia dan lebih terbuka melaporkan kerusakan mesin atau perlengkapan yang aus setiap pekan', 'Rasa percaya diri berbicara dengan penyelia berada di luar kesimpulan tentang kecelakaan ringan.'],
    ulangPremis: ['pelatihan berlangsung selama satu jam dan diikuti seluruh operator mesin di ruang rapat pabrik pada awal shift sebelum mereka kembali bekerja di lini produksi', 'Pernyataan ini hanya mengulang fakta pelatihan dan tidak menambah bukti tentang kecelakaan.'] },
  { id: 'sampah-terpilah', level: 'sedang', jenis: 'sebab-akibat langsung',
    fakta: 'Pengelola sebuah taman kota menyediakan tiga tempat sampah terpisah untuk sampah organik, anorganik, dan residu di setiap titik taman. Setiap wadah diberi warna dan label yang berbeda.',
    pendapat: 'Pengelola berpendapat bahwa pemisahan ini akan menambah jumlah sampah yang dapat didaur ulang, karena pengunjung memilah sampahnya langsung di tempat.',
    sebutan: 'pendapat pengelola taman', pihak: 'pengelola', alasan: 'pengunjung memilah sampahnya langsung di tempat', kesimpulan: 'jumlah sampah yang dapat didaur ulang akan bertambah',
    hubung: 'Bagian yang perlu diuji adalah apakah pengunjung benar-benar membuang sampah ke wadah yang sesuai sehingga hasil pilahan layak didaur ulang.',
    penguat: 'sampah anorganik yang terkumpul untuk didaur ulang bertambah, dan sebagian besar sampah di wadah sesuai jenisnya pada jumlah pengunjung yang sebanding',
    pelemah: 'sebagian besar sampah di wadah anorganik bercampur sisa makanan sehingga digabungkan kembali sebelum diangkut, dan sampah yang didaur ulang tidak bertambah',
    penguatJelas: 'Temuan ini menunjukkan pengunjung memilah dengan benar dan hasil pilahan yang bertambah tidak sekadar karena pengunjung lebih banyak.',
    lemahJelas: 'Temuan ini menunjukkan pilahan di tempat tidak berhasil karena tercampur, sehingga alasan pengelola tidak menghasilkan tambahan sampah yang dapat didaur ulang.',
    tidakRelevan: ['pengelola menanam pohon peneduh baru di sekitar tempat bermain anak, mengganti bangku taman yang rusak, dan tidak mengubah jam buka taman pada akhir pekan', 'Penanaman pohon dan penggantian bangku tidak berkaitan dengan pemilahan sampah.'],
    sebagian: ['pengunjung menyatakan setuju dengan adanya tiga tempat sampah, dan banyak yang mengaku mengenali warna serta label pada setiap wadah sejak pemasangan di taman', 'Persetujuan dan kemampuan mengenali label belum menunjukkan bahwa sampah benar-benar dibuang ke wadah yang sesuai.'],
    luarCakupan: ['tempat sampah berwarna membuat taman tampak lebih rapi dalam foto pengunjung dan menambah jumlah unggahan taman di media sosial setiap akhir pekan', 'Kesan rapi berada di luar kesimpulan tentang jumlah sampah yang dapat didaur ulang.'],
    ulangPremis: ['setiap titik taman kini memiliki tiga tempat sampah yang berwarna dan berlabel untuk sampah organik, anorganik, dan residu di dekat bangku taman dan jalur pejalan kaki', 'Pernyataan ini hanya mengulang fakta penyediaan wadah dan tidak menambah bukti tentang hasil pilahan.'] },
  { id: 'lampu-surya', level: 'sedang', jenis: 'sebab-akibat langsung',
    fakta: 'Pemerintah sebuah desa memasang lampu jalan tenaga surya di jalur utama permukiman. Lampu itu menyala otomatis ketika hari mulai gelap dan sebelumnya jalur tersebut tidak berpenerangan.',
    pendapat: 'Kepala desa berpendapat bahwa lampu itu akan mengurangi gangguan keamanan pada malam hari, karena jalan yang terang membuat pelaku lebih mudah terlihat.',
    sebutan: 'pendapat kepala desa', pihak: 'kepala desa', alasan: 'jalan yang terang membuat pelaku lebih mudah terlihat', kesimpulan: 'gangguan keamanan pada malam hari akan berkurang',
    hubung: 'Bagian yang perlu diuji adalah apakah penerangan benar-benar mengubah keberanian pelaku, sehingga gangguan di jalur itu berkurang.',
    penguat: 'jumlah laporan gangguan keamanan malam hari di jalur yang diberi lampu turun, sedangkan jumlah warga yang berjaga dan melintas pada malam hari relatif sama',
    pelemah: 'gangguan keamanan malam hari tetap terjadi pada tingkat yang sama di jalur yang diberi lampu, karena pelaku beraksi di bagian jalur yang sepi dan jauh dari rumah',
    penguatJelas: 'Temuan ini menghubungkan penerangan dengan turunnya gangguan, dan kesamaan jumlah warga yang berjaga menyingkirkan penjelasan lain.',
    lemahJelas: 'Temuan ini menunjukkan terang tidak menghalangi pelaku karena yang menentukan adalah kesepian lokasi, sehingga gangguan tidak berkurang meskipun lampu menyala.',
    tidakRelevan: ['pemerintah desa menjadwalkan kerja bakti membersihkan saluran air di sepanjang jalan utama setiap bulan dan menata ulang tempat sampah di dekat balai desa', 'Kerja bakti membersihkan saluran air tidak berkaitan dengan penerangan maupun gangguan keamanan.'],
    sebagian: ['warga mengaku jalan terasa lebih terang dan lebih nyaman dilalui pada malam hari sejak lampu menyala, dan lampu tidak pernah padam saat hujan deras turun', 'Jalan yang terasa lebih terang hanya bagian awal argumen; perubahan jumlah gangguan keamanan belum ditunjukkan.'],
    luarCakupan: ['lampu tenaga surya menghemat biaya listrik desa dan mengurangi pemakaian genset pada kegiatan malam hari di balai desa serta tempat ibadah selama setahun terakhir', 'Penghematan biaya listrik berada di luar kesimpulan tentang gangguan keamanan.'],
    ulangPremis: ['lampu jalan tenaga surya terpasang di sepanjang jalur utama permukiman dan menyala otomatis ketika hari mulai gelap, sedangkan sebelumnya jalur itu tidak berlampu', 'Pernyataan ini hanya mengulang fakta pemasangan lampu dan tidak menambah bukti tentang gangguan keamanan.'] },
  { id: 'foto-produk', level: 'sedang', jenis: 'sebab-akibat langsung',
    fakta: 'Pemilik sebuah toko daring kerajinan mengganti foto beberapa produknya dengan foto bercahaya alami dan berlatar polos. Harga dan promosi produk-produk itu tidak berubah.',
    pendapat: 'Pemilik toko berpendapat bahwa foto baru akan menaikkan jumlah pesanan, karena pembeli dapat melihat warna dan detail produk dengan lebih jelas.',
    sebutan: 'pendapat pemilik toko', pihak: 'pemilik toko', alasan: 'pembeli dapat melihat warna dan detail produk dengan lebih jelas', kesimpulan: 'jumlah pesanan akan naik',
    hubung: 'Bagian yang perlu diuji adalah apakah kejelasan gambar benar-benar memengaruhi keputusan membeli.',
    penguat: 'pesanan naik pada produk yang fotonya diganti, sedangkan pesanan produk yang fotonya tidak diganti tidak berubah pada periode yang sama dengan harga sama',
    pelemah: 'pesanan produk yang fotonya diganti tidak berubah, dan ulasan pembeli menyebut keputusan membeli lebih ditentukan oleh harga serta ongkos kirim daripada foto',
    penguatJelas: 'Temuan ini membandingkan produk yang fotonya diganti dengan yang tidak, pada harga dan promosi yang sama, sehingga kenaikan pesanan dapat dikaitkan dengan fotonya.',
    lemahJelas: 'Temuan ini menunjukkan kejelasan foto tidak mengubah jumlah pesanan karena keputusan membeli ditentukan faktor lain.',
    tidakRelevan: ['pemilik toko memperbarui nama toko dan menambahkan stiker kemasan dengan warna merek yang baru, sedangkan bahan kemasan paket tetap sama seperti sebelumnya', 'Pembaruan nama dan stiker kemasan tidak berkaitan dengan foto produk maupun jumlah pesanan.'],
    sebagian: ['pembeli menilai foto baru lebih menarik dan lebih jelas daripada foto lama, dan lebih banyak pembeli membuka halaman produk yang fotonya diganti pada bulan itu', 'Penilaian menarik dan lebih banyaknya kunjungan halaman belum menunjukkan perubahan jumlah pesanan.'],
    luarCakupan: ['foto baru membuat pengikut akun media sosial toko bertambah, sedangkan jumlah suka dan komentar pada unggahan lama tetap sama seperti pada bulan sebelumnya', 'Jumlah pengikut berada di luar kesimpulan tentang jumlah pesanan.'],
    ulangPremis: ['foto produk yang baru diambil dengan cahaya alami dan latar polos sehingga warna serta detail kerajinan terlihat jelas pada layar telepon pembeli', 'Pernyataan ini hanya mengulang ciri foto baru dan tidak menambah bukti tentang pesanan.'] },
  // ---- Sulit: penjelasan alternatif, pemilihan diri, data tidak sepadan, dan penerapan di tempat lain --------------------------------------
  { id: 'sungai-hujan', level: 'sulit', jenis: 'penjelasan alternatif',
    fakta: 'Setelah kampanye larangan membuang sampah ke sungai, kualitas air sebuah sungai kota membaik. Pada periode yang sama, curah hujan meningkat sehingga debit sungai bertambah.',
    pendapat: 'Dinas lingkungan berpendapat bahwa perbaikan kualitas air terutama disebabkan oleh kampanye tersebut, bukan oleh bertambahnya debit sungai.',
    sebutan: 'pendapat dinas lingkungan', pihak: 'dinas lingkungan', alasan: 'perbaikan terjadi setelah kampanye dijalankan', kesimpulan: 'kampanye, bukan bertambahnya debit, yang terutama memperbaiki kualitas air',
    hubung: 'Karena bertambahnya debit juga dapat membersihkan sungai, bagian yang menentukan adalah apakah perbaikan tetap terjadi atau berbeda ketika debit dan kampanye dipisahkan.',
    penguat: 'pada ruas sungai yang debitnya sama-sama bertambah, kualitas air membaik lebih besar di ruas yang banyak warganya mengikuti kampanye daripada ruas lainnya',
    pelemah: 'di sungai lain yang tidak mengalami kampanye tetapi debitnya bertambah oleh hujan yang sama, kualitas air membaik hampir sama dengan sungai kota',
    penguatJelas: 'Temuan ini membandingkan ruas dengan debit yang sama tetapi tingkat kampanye berbeda, sehingga selisih perbaikannya dapat dikaitkan dengan kampanye dan bukan dengan debit.',
    lemahJelas: 'Temuan ini menunjukkan perbaikan yang serupa muncul tanpa kampanye, sehingga bertambahnya debit sudah cukup menjelaskan perbaikan dan peran kampanye menjadi tidak terbukti.',
    tidakRelevan: ['dinas lingkungan memasang papan edukasi baru tentang bahaya limbah rumah tangga di tepi sungai dan membagikan brosur kepada warga di permukiman sekitar', 'Pemasangan papan edukasi tidak berkaitan dengan perbandingan kualitas air pada debit yang berbeda.'],
    sebagian: ['jumlah sampah yang terlihat di tepi sungai berkurang setelah kampanye, dan banyak warga sekitar sungai mengaku tidak lagi membuang sampah ke sungai', 'Berkurangnya sampah dan pengakuan warga hanya menyentuh sebagian proses; peran kampanye belum dipisahkan dari peran debit.'],
    luarCakupan: ['warga di sekitar sungai merasa bau sungai berkurang sehingga lebih nyaman beraktivitas di tepi sungai pada sore hari dan tidak lagi menutup hidung saat lewat', 'Kenyamanan warga berada di luar kesimpulan tentang penyebab perbaikan kualitas air.'],
    ulangPremis: ['kualitas air sungai membaik setelah kampanye, dan pada periode yang sama debit sungai bertambah karena curah hujan meningkat selama beberapa pekan', 'Pernyataan ini hanya mengulang fakta yang sudah diketahui dan tidak membedakan peran kampanye dari peran debit.'] },
  { id: 'bimbingan-sore', level: 'sulit', jenis: 'pemilihan diri',
    fakta: 'Sebuah sekolah menyelenggarakan bimbingan belajar sore yang boleh diikuti siswa secara sukarela. Nilai rata-rata siswa yang mengikuti bimbingan lebih tinggi daripada siswa yang tidak mengikutinya.',
    pendapat: 'Kepala sekolah menyimpulkan bahwa bimbingan sore meningkatkan nilai siswa, lalu menganjurkan semua siswa mengikutinya agar nilai mereka naik.',
    sebutan: 'kesimpulan kepala sekolah', pihak: 'kepala sekolah', alasan: 'siswa peserta bimbingan bernilai lebih tinggi daripada yang tidak ikut', kesimpulan: 'bimbingan sore meningkatkan nilai siswa',
    hubung: 'Karena siswa memilih sendiri ikut atau tidak, bagian yang menentukan adalah apakah selisih nilai itu muncul akibat bimbingan atau sudah ada sebelum bimbingan.',
    penguat: 'siswa yang semula bernilai sama dibagi menurut undian untuk ikut atau tidak ikut bimbingan, dan yang ikut naik nilainya lebih besar pada ujian berikutnya',
    pelemah: 'peserta bimbingan sudah bernilai lebih tinggi sebelum bimbingan dimulai, dan kenaikan nilai mereka selama bimbingan tidak berbeda dari siswa yang tidak ikut',
    penguatJelas: 'Temuan ini menghilangkan kemungkinan bahwa siswa yang rajin saja yang memilih ikut: kelompok dibentuk menurut undian, sehingga kenaikan yang lebih besar dapat dikaitkan dengan bimbingan.',
    lemahJelas: 'Temuan ini menunjukkan selisih nilai sudah ada sebelum bimbingan dan kenaikan selama bimbingan tidak berbeda, sehingga selisih itu bukan akibat bimbingan.',
    tidakRelevan: ['ruang bimbingan sore dilengkapi kipas angin baru dan papan tulis putih yang lebih luas, serta jadwal pelajaran yang dipasang di dinding dekat pintu', 'Perlengkapan ruang tidak berkaitan dengan perbandingan kenaikan nilai antara peserta dan bukan peserta.'],
    sebagian: ['peserta bimbingan menyatakan puas dengan penjelasan guru dan merasa lebih siap menghadapi ujian, dan hampir tidak ada yang absen pada pertemuan sore', 'Kepuasan dan kehadiran peserta hanya menunjukkan penerimaan; selisih nilai antara peserta dan bukan peserta belum dijelaskan sebabnya.'],
    luarCakupan: ['orang tua peserta menilai anak mereka lebih disiplin mengerjakan tugas di rumah dan lebih rajin merapikan buku pelajaran serta tas sekolah setiap malam', 'Kedisiplinan di rumah berada di luar kesimpulan tentang nilai siswa.'],
    ulangPremis: ['nilai rata-rata siswa yang mengikuti bimbingan sore lebih tinggi daripada nilai rata-rata siswa yang tidak mengikutinya pada ujian semester lalu', 'Pernyataan ini hanya mengulang data yang sudah dipakai dan tidak menjelaskan arah hubungannya.'] },
  { id: 'nilai-akhir-pelatihan', level: 'sulit', jenis: 'data tidak sepadan',
    fakta: 'Sebuah balai pelatihan melaporkan bahwa rata-rata nilai akhir peserta naik dari 70 menjadi 82 setelah kurikulum baru diterapkan. Nilai akhir dihitung dari peserta yang mengikuti ujian di akhir pelatihan.',
    pendapat: 'Kepala balai menyimpulkan bahwa kurikulum baru membuat peserta menguasai materi lebih baik daripada kurikulum lama.',
    sebutan: 'kesimpulan kepala balai', pihak: 'kepala balai', alasan: 'rata-rata nilai akhir peserta naik setelah kurikulum baru', kesimpulan: 'kurikulum baru membuat peserta menguasai materi lebih baik',
    hubung: 'Karena rata-rata hanya dihitung dari peserta yang mengikuti ujian, bagian yang menentukan adalah apakah kenaikan itu berasal dari penguasaan materi atau dari berubahnya siapa yang ikut ujian.',
    penguat: 'nilai akhir dihitung dari semua peserta termasuk yang tidak lulus, dan jumlah peserta yang mengundurkan diri sama dengan kurikulum lama pada nilai awal sebanding',
    pelemah: 'banyak peserta bernilai rendah mengundurkan diri sebelum ujian akhir pada kurikulum baru sehingga tidak tercatat, sedangkan sisanya umumnya bernilai tinggi',
    penguatJelas: 'Temuan ini menunjukkan kelompok yang dibandingkan sepadan sejak awal dan tidak ada peserta yang hilang dari perhitungan, sehingga kenaikan rata-rata dapat dikaitkan dengan kurikulum.',
    lemahJelas: 'Temuan ini menunjukkan kenaikan rata-rata dapat terjadi hanya karena peserta bernilai rendah tidak ikut dihitung, sehingga penguasaan materi tidak terbukti membaik.',
    tidakRelevan: ['balai pelatihan menambah jumlah laptop dan memperbarui peralatan di ruang praktik, sedangkan ruang kelas, ruang istirahat, dan ruang tunggu peserta tidak diubah', 'Penambahan peralatan tidak berkaitan dengan siapa yang dihitung dalam rata-rata nilai akhir.'],
    sebagian: ['peserta yang mengikuti ujian akhir menyatakan materi kurikulum baru lebih mudah dipahami dan lebih runtut, dan banyak yang menilai contoh kasusnya relevan', 'Pendapat peserta yang mengikuti ujian belum menjawab apakah peserta yang tidak tercatat mengubah rata-rata.'],
    luarCakupan: ['kurikulum baru memuat lebih banyak sesi praktik sehingga jam pelatihan setiap pekan bertambah dan biaya pelatihan per peserta naik sekitar sepersepuluh', 'Penambahan jam pelatihan berada di luar kesimpulan tentang penguasaan materi yang diukur nilai.'],
    ulangPremis: ['rata-rata nilai akhir peserta pada kurikulum baru adalah 82, lebih tinggi daripada rata-rata 70 pada kurikulum lama yang dipakai sebelumnya oleh balai', 'Pernyataan ini hanya mengulang angka yang sudah diberikan dan tidak menjelaskan siapa yang dihitung.'] },
  { id: 'ruang-bugar', level: 'sulit', jenis: 'faktor ketiga',
    fakta: 'Kantor-kantor yang menyediakan ruang bugar tercatat memiliki karyawan yang lebih jarang izin sakit daripada kantor yang tidak menyediakannya.',
    pendapat: 'Seorang konsultan menyimpulkan bahwa ruang bugar mengurangi izin sakit karyawan, lalu menganjurkan semua kantor membangun ruang bugar.',
    sebutan: 'kesimpulan konsultan', pihak: 'konsultan', alasan: 'kantor dengan ruang bugar memiliki izin sakit yang lebih jarang', kesimpulan: 'ruang bugar mengurangi izin sakit karyawan',
    hubung: 'Karena hubungan dua hal tidak selalu berarti yang satu menyebabkan yang lain, bagian yang menentukan adalah apakah ada faktor lain yang menjelaskan perbedaan itu.',
    penguat: 'pada kantor dengan asuransi dan pemeriksaan berkala yang sama, karyawan yang rutin memakai ruang bugar lebih jarang izin sakit daripada yang tidak memakainya',
    pelemah: 'kantor yang memiliki ruang bugar umumnya juga memberi asuransi lengkap dan pemeriksaan berkala, dan kantor yang hanya memberi asuransi sama rendah izin sakitnya',
    penguatJelas: 'Temuan ini menahan faktor asuransi dan pemeriksaan tetap sama, sehingga perbedaan izin sakit dapat dikaitkan dengan pemakaian ruang bugar.',
    lemahJelas: 'Temuan ini menunjukkan perbedaan itu dapat dijelaskan oleh asuransi dan pemeriksaan berkala yang menyertai ruang bugar, sehingga peran ruang bugar sendiri tidak terbukti.',
    tidakRelevan: ['sebagian kantor memilih menyewa pelatih kebugaran dari luar dan membeli perlengkapan senam berwarna cerah, sedangkan kantor lain memakai perlengkapan lama', 'Pilihan pelatih dan warna perlengkapan tidak berkaitan dengan penyebab perbedaan izin sakit.'],
    sebagian: ['karyawan menyatakan senang memiliki ruang bugar di kantor dan memakainya beberapa kali sepekan, dan banyak yang mengaku badannya terasa lebih segar', 'Rasa senang dan badan yang terasa segar hanya menunjukkan penerimaan fasilitas; perubahan izin sakit dan faktor lain belum diperiksa.'],
    luarCakupan: ['ruang bugar membuat karyawan lebih betah berada di kantor setelah jam kerja dan lebih sering mengobrol dengan rekan lintas divisi di sela waktu latihan setiap sore', 'Kebetahan karyawan berada di luar kesimpulan tentang izin sakit.'],
    ulangPremis: ['kantor yang menyediakan ruang bugar tercatat memiliki karyawan yang lebih jarang izin sakit daripada kantor yang tidak menyediakannya dalam catatan kepegawaian', 'Pernyataan ini hanya mengulang data yang sudah diketahui dan tidak menjelaskan penyebabnya.'] },
  { id: 'sekolah-terpencil', level: 'sulit', jenis: 'penerapan di tempat lain',
    fakta: 'Sebuah sekolah menengah di kota besar menerapkan tugas proyek kelompok dan hasil belajar siswanya naik. Dinas pendidikan berencana menerapkan hal yang sama di sekolah-sekolah menengah di daerah terpencil.',
    pendapat: 'Dinas pendidikan memperkirakan manfaat yang sama akan muncul di sekolah terpencil, berdasarkan keberhasilan di sekolah kota.',
    sebutan: 'perkiraan dinas pendidikan', pihak: 'dinas pendidikan', alasan: 'tugas proyek kelompok berhasil menaikkan hasil belajar di sekolah kota', kesimpulan: 'tugas proyek kelompok akan menaikkan hasil belajar di sekolah terpencil',
    hubung: 'Karena perkiraan ini bertumpu pada kemiripan dua tempat, bagian yang menentukan adalah apakah faktor yang membuat proyek berhasil juga ada di sekolah terpencil.',
    penguat: 'sekolah terpencil memiliki jumlah siswa per kelas, ketersediaan buku, dan kemampuan guru mengelola kerja kelompok yang sebanding dengan sekolah kota',
    pelemah: 'keberhasilan di sekolah kota bergantung pada akses internet untuk mencari bahan proyek, sedangkan sebagian besar sekolah terpencil tidak memiliki jaringan',
    penguatJelas: 'Temuan ini menunjukkan faktor yang menopang keberhasilan di sekolah kota juga ada di sekolah terpencil, sehingga perkiraan manfaat yang sama menjadi lebih kuat.',
    lemahJelas: 'Temuan ini menunjukkan faktor penentu keberhasilan di sekolah kota tidak tersedia di sekolah terpencil, sehingga keberhasilan di kota tidak dapat dipindahkan begitu saja.',
    tidakRelevan: ['dinas pendidikan menyiapkan seragam baru dan kalender kegiatan tahunan untuk semua sekolah menengah serta membagikan buku agenda kepada guru pada awal tahun ajaran', 'Seragam dan kalender kegiatan tidak berkaitan dengan kemiripan faktor penentu keberhasilan proyek.'],
    sebagian: ['sekolah terpencil dan sekolah kota sama-sama memakai kurikulum nasional dan buku paket yang sama, dan jam belajar di kedua jenis sekolah hampir sama', 'Kesamaan kurikulum dan jam belajar hanya sebagian dari kemiripan; faktor yang menopang keberhasilan proyek belum dibandingkan.'],
    luarCakupan: ['siswa sekolah kota lebih sering mengikuti lomba tingkat provinsi daripada siswa sekolah terpencil, sedangkan siswa terpencil lebih sering ikut lomba kecamatan', 'Prestasi lomba berada di luar kesimpulan tentang manfaat tugas proyek di sekolah terpencil.'],
    ulangPremis: ['hasil belajar siswa di sekolah kota naik setelah tugas proyek kelompok diterapkan, dan dinas ingin menerapkannya di sekolah menengah daerah terpencil', 'Pernyataan ini hanya mengulang fakta dan rencana yang sudah diketahui dan tidak membandingkan kedua tempat.'] },
  { id: 'aplikasi-jalan', level: 'sulit', jenis: 'syarat mekanisme',
    fakta: 'Dinas pekerjaan umum meluncurkan aplikasi pelaporan jalan rusak. Laporan dari aplikasi memuat foto dan lokasi kerusakan yang tepat, sedangkan laporan melalui telepon hanya menyebut nama jalan.',
    pendapat: 'Dinas berpendapat bahwa aplikasi itu akan mempercepat perbaikan jalan, karena petugas menerima lokasi kerusakan secara tepat dan tidak perlu mencari di lapangan.',
    sebutan: 'pendapat dinas pekerjaan umum', pihak: 'dinas', alasan: 'petugas menerima lokasi kerusakan secara tepat', kesimpulan: 'perbaikan jalan akan lebih cepat',
    hubung: 'Bagian yang menentukan adalah apakah ketepatan lokasi benar-benar menjadi penghambat waktu perbaikan, atau ada tahap lain yang menentukan.',
    penguat: 'laporan lewat aplikasi ditindaklanjuti lebih cepat daripada laporan lewat telepon pada jenis kerusakan yang sama, dan waktu mencari lokasi berkurang',
    pelemah: 'waktu perbaikan ditentukan oleh ketersediaan aspal dan alat berat yang terbatas, sehingga laporan aplikasi menunggu giliran sama lamanya dengan laporan telepon',
    penguatJelas: 'Temuan ini menunjukkan ketepatan lokasi memangkas waktu tindak lanjut pada jenis kerusakan yang setara, sehingga alasan dinas terhubung dengan percepatan perbaikan.',
    lemahJelas: 'Temuan ini menunjukkan penghambat perbaikan ada pada bahan dan alat, bukan pada pencarian lokasi, sehingga ketepatan lokasi tidak mempercepat perbaikan.',
    tidakRelevan: ['dinas mengecat ulang marka jalan di beberapa persimpangan yang padat pada akhir tahun, sedangkan rambu di dekat sekolah dasar dan pasar tidak diganti', 'Pengecatan marka jalan tidak berkaitan dengan laporan kerusakan maupun waktu perbaikan.'],
    sebagian: ['jumlah laporan yang masuk lewat aplikasi jauh lebih banyak daripada lewat telepon sejak aplikasi diluncurkan, dan hampir semua laporan memuat foto yang jelas', 'Banyaknya laporan dan foto yang jelas hanya menunjukkan pemakaian aplikasi; kecepatan perbaikan belum dibandingkan.'],
    luarCakupan: ['warga menilai aplikasi mudah dipasang di telepon dan tampilannya sederhana, dan sebagian besar menyebut mengisi laporan hanya butuh waktu kurang dari satu menit', 'Kemudahan memasang aplikasi berada di luar kesimpulan tentang kecepatan perbaikan jalan.'],
    ulangPremis: ['laporan dari aplikasi memuat foto dan lokasi kerusakan yang tepat, sedangkan laporan lewat telepon hanya menyebut nama jalan atau nama kampung terdekat', 'Pernyataan ini hanya mengulang perbedaan isi laporan dan tidak menunjukkan hasilnya pada waktu perbaikan.'] },
  { id: 'pengangguran-blk', level: 'sulit', jenis: 'urutan waktu dan faktor lain',
    fakta: 'Angka pengangguran sebuah kecamatan turun setelah balai latihan kerja dibuka. Pada periode yang sama sebuah pabrik baru juga beroperasi di kecamatan itu.',
    pendapat: 'Camat berpendapat bahwa penurunan pengangguran itu terutama berkat balai latihan kerja, karena warga yang dilatih menjadi lebih mudah mendapat pekerjaan.',
    sebutan: 'pendapat camat', pihak: 'camat', alasan: 'warga yang dilatih menjadi lebih mudah mendapat pekerjaan', kesimpulan: 'penurunan pengangguran terutama berkat balai latihan kerja',
    hubung: 'Karena pabrik baru juga dapat menyerap pekerja, bagian yang menentukan adalah apakah penurunan itu lebih besar pada warga yang dilatih daripada pada warga yang tidak dilatih.',
    penguat: 'pengangguran turun lebih besar pada warga yang dilatih daripada warga seusia dan sependidikan yang tidak dilatih, padahal pabrik menyerap keduanya sama banyak',
    pelemah: 'pengangguran sudah turun dengan laju yang sama sejak setahun sebelum balai dibuka, bersamaan dengan pembukaan pabrik baru yang menyerap banyak pekerja setempat',
    penguatJelas: 'Temuan ini memisahkan peran pelatihan dari peran pabrik: pabrik menyerap kedua kelompok sama banyak, tetapi kelompok terlatih lebih banyak terserap, sehingga selisihnya berasal dari pelatihan.',
    lemahJelas: 'Temuan ini menunjukkan penurunan sudah berlangsung sebelum balai dibuka dan dapat dijelaskan oleh pabrik, sehingga peran balai latihan kerja tidak terbukti.',
    tidakRelevan: ['balai latihan kerja menempati gedung bekas kantor kecamatan yang dicat ulang dengan warna hijau, sedangkan taman dan halamannya tetap sama seperti sebelumnya', 'Keadaan gedung balai tidak berkaitan dengan penurunan pengangguran maupun perbandingan antarkelompok warga.'],
    sebagian: ['banyak warga yang dilatih mengaku keterampilannya bertambah dan lebih percaya diri melamar kerja, dan hampir semuanya sudah mengirim lamaran ke perusahaan', 'Bertambahnya keterampilan dan jumlah lamaran hanya bagian awal; perbandingan penurunan pengangguran antarkelompok belum ada.'],
    luarCakupan: ['pabrik baru membuat harga sewa kios di sekitar kecamatan naik dan menambah jumlah warung makan serta kos-kosan pekerja di dekat gerbang pabrik pada tahun itu', 'Kenaikan harga sewa kios berada di luar kesimpulan tentang penyebab turunnya pengangguran.'],
    ulangPremis: ['angka pengangguran kecamatan turun setelah balai latihan kerja dibuka, pada periode yang sama dengan beroperasinya pabrik baru di kawasan industri kecamatan itu', 'Pernyataan ini hanya mengulang fakta yang sudah diketahui dan tidak memisahkan peran balai dari peran pabrik.'] },
  { id: 'diskon-akhir-pekan', level: 'sulit', jenis: 'data tidak sepadan',
    fakta: 'Sebuah toko perlengkapan rumah memberi diskon pada akhir pekan. Total penjualan pada akhir pekan itu naik 40% dibandingkan akhir pekan biasa.',
    pendapat: 'Pemilik toko menyimpulkan bahwa diskon akhir pekan menarik lebih banyak pembeli, karena penjualan akhir pekan naik cukup besar.',
    sebutan: 'kesimpulan pemilik toko', pihak: 'pemilik toko', alasan: 'total penjualan akhir pekan naik 40%', kesimpulan: 'diskon menarik lebih banyak pembeli',
    hubung: 'Karena total penjualan dapat naik tanpa pembeli bertambah, bagian yang menentukan adalah apakah kenaikan itu berasal dari jumlah pembeli atau dari sebab lain.',
    penguat: 'jumlah pembeli pada akhir pekan itu bertambah dan kenaikan penjualan tersebar pada banyak transaksi kecil, bukan pada satu atau dua pesanan besar',
    pelemah: 'kenaikan penjualan berasal dari satu pesanan besar sebuah instansi untuk keperluan acara, sedangkan jumlah pembeli pada akhir pekan itu tidak berubah',
    penguatJelas: 'Temuan ini menunjukkan kenaikan total berasal dari bertambahnya pembeli dan bukan dari satu transaksi luar biasa, sehingga kesimpulan pemilik toko terdukung.',
    lemahJelas: 'Temuan ini menunjukkan kenaikan total hanya berasal dari satu pesanan besar sementara jumlah pembeli tetap, sehingga diskon tidak terbukti menarik lebih banyak pembeli.',
    tidakRelevan: ['toko memperbarui tata letak rak dan memasang lampu sorot baru di bagian peralatan dapur, sedangkan seragam pegawai dan papan nama tidak diganti pada bulan itu', 'Perubahan tata letak rak tidak berkaitan dengan asal kenaikan total penjualan.'],
    sebagian: ['pembeli yang datang pada akhir pekan itu menyebut diskon sebagai alasan belanja, dan banyak yang membeli barang yang termasuk dalam daftar diskon pilihan', 'Alasan pembeli yang datang belum menunjukkan bahwa jumlah pembeli bertambah dibandingkan akhir pekan biasa.'],
    luarCakupan: ['diskon akhir pekan mempercepat habisnya stok barang tertentu sehingga gudang harus diisi lebih cepat dan jadwal pengiriman pemasok berubah pada pekan berikutnya', 'Percepatan habisnya stok berada di luar kesimpulan tentang jumlah pembeli.'],
    ulangPremis: ['total penjualan toko pada akhir pekan diskon naik 40% dibandingkan total penjualan akhir pekan biasa, dan angka itu dicatat oleh bagian keuangan toko', 'Pernyataan ini hanya mengulang angka yang sudah diberikan dan tidak menjelaskan asal kenaikannya.'] },
  { id: 'lampu-sensor', level: 'sulit', jenis: 'uji coba tidak mewakili',
    fakta: 'Pengelola sebuah gedung menguji lampu sensor gerak selama satu minggu pada lantai tiga dan mencatat pemakaian listrik lantai itu turun 25%.',
    pendapat: 'Pengelola menyimpulkan bahwa pemasangan lampu sensor di seluruh gedung akan menghemat listrik sebesar itu sepanjang tahun.',
    sebutan: 'kesimpulan pengelola gedung', pihak: 'pengelola', alasan: 'pemakaian listrik lantai uji coba turun 25% selama satu minggu', kesimpulan: 'lampu sensor di seluruh gedung akan menghemat listrik sebesar itu sepanjang tahun',
    hubung: 'Karena kesimpulan memperluas hasil satu minggu pada satu lantai menjadi seluruh gedung selama setahun, bagian yang menentukan adalah apakah hasil itu mewakili kondisi lain.',
    penguat: 'pemakaian listrik lantai tiga tetap turun sekitar seperempat pada beberapa bulan berikutnya, sedangkan lantai lain tanpa sensor pemakaiannya tidak berubah',
    pelemah: 'pekan uji coba bertepatan dengan libur panjang sehingga lantai tiga hampir kosong, dan pemakaian listrik lantai tanpa sensor juga turun sekitar seperempat',
    penguatJelas: 'Temuan ini menunjukkan penghematan bertahan sesudah pekan uji coba dan tidak muncul di lantai pembanding, sehingga hasil satu minggu dapat diperluas.',
    lemahJelas: 'Temuan ini menunjukkan penurunan terjadi juga tanpa sensor karena libur, sehingga hasil uji coba tidak mewakili penghematan sepanjang tahun.',
    tidakRelevan: ['pengelola gedung mengganti papan nama di lobi dan menata ulang tanaman hias di setiap lantai, sedangkan warna pagar halaman dan marka parkir tetap sama', 'Penggantian papan nama dan penataan tanaman tidak berkaitan dengan pemakaian listrik.'],
    sebagian: ['karyawan di lantai tiga menyatakan lampu sensor menyala tepat saat mereka masuk ruangan dan tidak padam saat ruangan masih terpakai, dan sebagian besar puas', 'Kinerja sensor pada satu pekan belum menunjukkan penghematan yang bertahan atau berlaku di lantai lain.'],
    luarCakupan: ['pemasangan lampu sensor menambah biaya perawatan instalasi listrik gedung dan memerlukan teknisi untuk memeriksa setiap sensor sekali sebulan pada semua lantai', 'Biaya perawatan berada di luar kesimpulan tentang penghematan listrik.'],
    ulangPremis: ['lampu sensor gerak diuji pada lantai tiga selama satu minggu dan pemakaian listrik lantai itu tercatat turun 25% menurut catatan meteran listrik gedung', 'Pernyataan ini hanya mengulang hasil uji coba yang sudah diketahui dan tidak menunjukkan apakah hasil itu berlaku umum.'] },
];

// ---- Urutan butir ----------------------------------------------------------------------------------------------------------------------------
// Butir = skenario x arah. Urutan acak menurut seed: setiap skenario muncul sekali dengan satu arah sebelum arah lawannya dipakai, sehingga paling sedikit
// SKENARIO.length butir pertama tidak mengulang skenario. Pemilihan menurut tingkat dilakukan pada daftar yang sudah diurutkan.
export type Butir = { skenario: Skenario; arah: Arah };
export const ARGUMEN_BUTIR_COUNT = SKENARIO.length * 2;
export const argumenButirCount = (level: 'sedang' | 'sulit') => SKENARIO.filter((x) => x.level === level).length * 2;
export function urutanButir(seed: string): Butir[] {
  const r = rng('argumen|urutan|' + seed), first = r.shuffle(SKENARIO).map((skenario) => ({ skenario, arah: r.pick(['perkuat', 'lemahkan'] as Arah[]) }));
  const second = r.shuffle(first).map(({ skenario, arah }) => ({ skenario, arah: arah === 'perkuat' ? 'lemahkan' : 'perkuat' } as Butir));
  return [...first, ...second];
}

// ---- Perakitan ------------------------------------------------------------------------------------------------------------------------------
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const sentence = (text: string) => cap(text) + '.';
export type ArgumenBuild = {
  stem: string; options: { text: string; role: ArgumentRole }[]; answer: number; explanation: string; direction: Arah; scenario: string;
  difficulty: 'sedang' | 'sulit'; bloom: 'C4' | 'C5'; difficultyReason: string;
};
const NOUN = ['Temuan', 'Informasi', 'Bukti', 'Keterangan', 'Hasil pemeriksaan'];

export function rakitArgumen(butir: Butir, r: Rng): ArgumenBuild {
  const { skenario: s, arah } = butir, perkuat = arah === 'perkuat';
  const key = perkuat ? s.penguat : s.pelemah, opposite = perkuat ? s.pelemah : s.penguat;
  // Empat pengecoh dari lima peran: arah terbalik dan "sebagian" selalu ada (pengecoh terkuat); satu dari tiga peran lain digugurkan secara acak.
  const dropped = r.pick(['tidak-relevan', 'luar-cakupan', 'ulang-premis'] as const);
  const pool: { role: ArgumentRole; text: string; gagal?: string }[] = [
    { role: 'terbalik', text: opposite }, { role: 'sebagian', text: s.sebagian[0], gagal: s.sebagian[1] },
    ...(dropped === 'tidak-relevan' ? [] : [{ role: 'tidak-relevan' as const, text: s.tidakRelevan[0], gagal: s.tidakRelevan[1] }]),
    ...(dropped === 'luar-cakupan' ? [] : [{ role: 'luar-cakupan' as const, text: s.luarCakupan[0], gagal: s.luarCakupan[1] }]),
    ...(dropped === 'ulang-premis' ? [] : [{ role: 'ulang-premis' as const, text: s.ulangPremis[0], gagal: s.ulangPremis[1] }]),
  ];
  const options = r.shuffle([{ role: 'kunci' as ArgumentRole, text: key }, ...pool]).map((o) => ({ role: o.role, text: sentence(o.text) }));
  const answer = options.findIndex((o) => o.role === 'kunci');
  const verb = perkuat ? 'MEMPERKUAT' : 'MEMPERLEMAH', noun = r.pick(NOUN);
  const stem = s.fakta + ' ' + s.pendapat + '\n' + noun + ' manakah yang paling ' + verb + ' ' + s.sebutan + '?';
  const partial = pool.find((o) => o.role === 'sebagian')!;
  const explanation = [
    'Alasan ' + s.pihak + ' adalah bahwa ' + s.alasan + '. Kesimpulannya, ' + s.kesimpulan + '. ' + s.hubung,
    'Temuan yang menyentuh penghubung itu adalah bahwa ' + key + '. ' + (perkuat ? s.penguatJelas : s.lemahJelas),
    'Pengecoh yang paling menggoda adalah temuan bahwa ' + partial.text + '. ' + partial.gagal + ' Adapun temuan bahwa ' + opposite + ' justru ' + (perkuat ? 'melemahkan' : 'memperkuat') + ' pendapat tersebut. Dengan demikian, arahnya berlawanan dengan yang ditanyakan.', // dipecah: teks temuan sendiri sering memuat "sehingga", satu kalimat tidak boleh memuat dua
    'Jadi, jawaban yang benar adalah ' + KEY_MARK + '.',
  ].join('\n\n');
  const hard = s.level === 'sulit';
  return {
    stem, options, answer, explanation, direction: arah, scenario: s.id, difficulty: s.level, bloom: hard ? 'C5' : 'C4',
    difficultyReason: hard
      ? 'Menguji ' + s.jenis + ': peserta mengevaluasi temuan yang memisahkan penyebab sebenarnya dari penjelasan lain, dengan pengecoh sebagian dan arah terbalik.'
      : 'Menguji hubungan langsung antara tindakan dan hasil: peserta menentukan temuan yang menyentuh penghubung alasan dan kesimpulan, dengan pengecoh yang tampak relevan.',
  };
}

// Pembangkit: dengan `pick`, butir diambil dari daftar berurutan menurut seed sehingga butir berbeda sampai daftar tingkat itu habis; tanpa `pick`, butir diundi.
export function buildArgumen(level: 'sedang' | 'sulit', r: Rng, pick?: { seed: string; index: number }): ArgumenBuild {
  const wanted = level === 'sulit' ? 'sulit' : 'sedang';
  if (pick) {
    const pool = urutanButir(pick.seed).filter((b) => b.skenario.level === wanted);
    return rakitArgumen(pool[pick.index % pool.length], rng('argumen|opsi|' + pick.seed + '|' + pick.index));
  }
  const skenario = r.pick(SKENARIO.filter((x) => x.level === wanted));
  return rakitArgumen({ skenario, arah: r.pick(['perkuat', 'lemahkan'] as Arah[]) }, r);
}
