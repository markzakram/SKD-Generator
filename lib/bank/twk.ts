import type { BankItem, Difficulty } from '../types';

type Template = { topic: string; subtopic: string; difficulty: Difficulty; stems: string[]; choices: string[] };
const templates: Template[] = [
  { topic: 'Nasionalisme', subtopic: 'Persatuan dalam keberagaman', difficulty: 'mudah', stems: [
    'Panitia kegiatan warga terdiri dari beberapa latar suku. Sikap yang paling mendukung persatuan adalah ...',
    'Kelompok siswa merancang kegiatan lintas daerah. Sikap yang menunjukkan nasionalisme dalam keberagaman adalah ...',
    'Pegawai dari berbagai daerah diminta bekerja bersama. Sikap yang memperkuat persatuan adalah ...',
    'Komunitas seni melibatkan beberapa budaya lokal. Sikap yang sesuai semangat kebangsaan adalah ...',
  ], choices: [
    'Menghargai perbedaan dan bekerja sama untuk tujuan bersama.|Menghargai keragaman sambil membangun tujuan bersama mencerminkan persatuan.',
    'Menggunakan kebiasaan kelompok terbesar sebagai satu-satunya acuan.|Dominasi satu kelompok tidak memberi ruang setara bagi keragaman.',
    'Membatasi kerja sama hanya kepada orang dari daerah yang sama.|Pembatasan berdasarkan daerah mempersempit persatuan.',
    'Memisahkan kegiatan berdasarkan asal daerah agar tidak perlu berdialog.|Pemisahan menghindari kesempatan membangun saling pengertian.',
    'Menghapus seluruh unsur budaya daerah agar semua tampak sama.|Persatuan tidak mensyaratkan penghapusan identitas budaya.',
  ] },
  { topic: 'Nasionalisme', subtopic: 'Kepentingan nasional', difficulty: 'sedang', stems: [
    'Sebuah lomba inovasi mempertemukan peserta dari berbagai daerah. Sikap yang mengutamakan kepentingan nasional adalah ...',
    'Program pertukaran siswa mempertemukan kelompok yang berbeda pandangan. Sikap yang mendukung kemajuan bersama adalah ...',
    'Tim antarwilayah menyusun promosi produk lokal. Sikap yang mencerminkan nasionalisme terbuka adalah ...',
    'Kolaborasi komunitas bertujuan memperluas manfaat penelitian. Sikap yang paling sesuai kepentingan bersama adalah ...',
  ], choices: [
    'Berbagi keahlian dan mempertahankan mutu agar manfaatnya dapat dirasakan lebih luas.|Kontribusi serta mutu diarahkan pada kemajuan bersama.',
    'Mengutamakan kemenangan daerah sendiri meskipun harus menahan informasi penting.|Keuntungan kelompok mengalahkan manfaat nasional.',
    'Menolak semua praktik dari luar tanpa menilai manfaat dan kesesuaiannya.|Nasionalisme terbuka menilai manfaat secara selektif.',
    'Menggunakan label nasional sebagai pengganti pemeriksaan mutu hasil.|Simbol tidak menggantikan kualitas kontribusi.',
    'Memilih mitra hanya berdasarkan kesamaan asal daerah.|Pemilihan demikian membatasi kerja sama lintas kelompok.',
  ] },
  { topic: 'Nasionalisme', subtopic: 'Literasi digital dan persatuan', difficulty: 'sulit', stems: [
    'Konten mengenai suatu daerah viral, tetapi sumber dan konteksnya belum jelas. Respons yang menjaga persatuan adalah ...',
    'Grup warga menerima tuduhan terhadap kelompok tertentu tanpa bukti. Sikap yang tepat untuk menjaga kebersamaan adalah ...',
    'Sebuah potongan video memicu ketegangan antarkomunitas. Tindakan yang sesuai nasionalisme adalah ...',
    'Pesan provokatif dibagikan menjelang kegiatan lintas budaya. Langkah yang mendukung persatuan adalah ...',
  ], choices: [
    'Memeriksa sumber dan konteks, menahan penyebaran tuduhan, serta mengajak dialog berdasarkan fakta.|Verifikasi dan dialog mencegah perpecahan akibat informasi yang tidak dapat dipastikan.',
    'Membagikan konten lebih luas agar kelompok sendiri dapat bersiap melawan.|Penyebaran tanpa verifikasi memperbesar ketegangan.',
    'Membalas dengan tuduhan terhadap kelompok lain agar ada keseimbangan.|Tuduhan balasan tidak memperbaiki kebenaran informasi.',
    'Menganggap semua anggota kelompok yang disebut mempunyai perilaku sama.|Generalisasi mengabaikan individu dan memperkuat prasangka.',
    'Mendukung konten karena dibagikan oleh tokoh yang dikenal.|Popularitas pembagi tidak membuktikan kebenaran isi.',
  ] },
  { topic: 'Nasionalisme', subtopic: 'Kebijakan dan partisipasi', difficulty: 'hots', stems: [
    'Program budaya nasional mempunyai peserta beragam, tetapi kesempatan menampilkan karya hanya diberikan kepada kelompok tertentu. Perbaikan yang tepat adalah ...',
    'Kampanye produk daerah berhasil menarik perhatian, tetapi manfaat pelatihan belum menjangkau pelaku usaha kecil. Tindakan yang sesuai tujuan nasional adalah ...',
    'Kegiatan kolaborasi antardaerah mempunyai tujuan persatuan, tetapi anggotanya tidak dilibatkan dalam keputusan. Perbaikan yang paling sesuai adalah ...',
    'Program pengenalan budaya hanya mengejar jumlah acara tanpa mengevaluasi keterlibatan masyarakat. Perbaikan yang mendukung nasionalisme adalah ...',
  ], choices: [
    'Membuka partisipasi yang setara, menetapkan kriteria yang jelas, dan mengevaluasi manfaat nyata.|Persatuan diwujudkan dalam akses, keterlibatan, dan manfaat bersama.',
    'Menambah simbol nasional agar kegiatan terlihat lebih meriah.|Simbol tidak menyelesaikan hambatan partisipasi.',
    'Mempertahankan mekanisme lama karena sudah menghasilkan angka kegiatan tinggi.|Jumlah kegiatan tidak membuktikan pemerataan manfaat.',
    'Memberi semua keputusan kepada kelompok yang paling berpengalaman tanpa konsultasi.|Keahlian tidak menghapus kebutuhan keterwakilan.',
    'Membatasi peserta baru agar pelaksanaan lebih mudah dikendalikan.|Kemudahan pelaksanaan tidak membenarkan penutupan akses.',
  ] },
  { topic: 'Integritas', subtopic: 'Kejujuran', difficulty: 'mudah', stems: [
    'Anda menemukan angka laporan berbeda dari data asli. Sikap yang menunjukkan integritas adalah ...',
    'Kesalahan pencatatan membuat capaian tim tampak lebih tinggi daripada kenyataan. Sikap berintegritas adalah ...',
    'Data kehadiran mencatat Anda hadir ketika sebenarnya berhalangan. Tindakan yang sesuai integritas adalah ...',
    'Catatan pengeluaran memuat transaksi yang belum didukung bukti. Sikap berintegritas adalah ...',
  ], choices: [
    'Mengklarifikasi perbedaan dan memperbaiki catatan berdasarkan bukti yang dapat ditelusuri.|Kejujuran harus diwujudkan dalam ketepatan data dan koreksi yang transparan.',
    'Membiarkan catatan karena menguntungkan penilaian.|Keuntungan tidak membenarkan data yang tidak benar.',
    'Mengubah data asli agar sama dengan laporan.|Menyamakan data dengan hasil yang salah merupakan manipulasi.',
    'Meminta rekan menyimpan masalah agar citra tim tidak terganggu.|Menutup masalah menghilangkan akuntabilitas.',
    'Meneruskan laporan tanpa memeriksa bukti karena tenggat dekat.|Tekanan waktu tidak menggantikan tanggung jawab atas kebenaran.',
  ] },
  { topic: 'Integritas', subtopic: 'Konflik kepentingan', difficulty: 'sedang', stems: [
    'Kerabat ikut seleksi yang Anda nilai. Tindakan yang menunjukkan integritas adalah ...',
    'Teman dekat mengikuti pengadaan yang melibatkan unit Anda. Sikap berintegritas adalah ...',
    'Anda diminta menilai kegiatan organisasi yang dipimpin anggota keluarga. Tindakan yang tepat adalah ...',
    'Mitra menawarkan hadiah pribadi ketika proses penilaian masih berlangsung. Tindakan yang menjaga integritas adalah ...',
  ], choices: [
    'Mengungkap potensi konflik kepentingan dan mengikuti mekanisme penanganan yang berlaku.|Transparansi dan penanganan konflik menjaga objektivitas proses.',
    'Tetap mengambil keputusan sendiri karena yakin dapat bersikap adil.|Keyakinan pribadi tidak menggantikan pengelolaan konflik.',
    'Memberikan kemudahan sekali saja untuk menjaga hubungan.|Pengecualian personal melanggar kesetaraan.',
    'Menyembunyikan hubungan agar peserta lain tidak curiga.|Ketertutupan membuat konflik tidak dapat dinilai.',
    'Meminta pihak yang berkepentingan menyusun alasan keputusan.|Keputusan kehilangan independensi.',
  ] },
  { topic: 'Integritas', subtopic: 'Konsistensi prinsip', difficulty: 'sulit', stems: [
    'Target hampir tercapai, tetapi Anda diminta mencatat pekerjaan yang belum dilakukan. Sikap paling berintegritas adalah ...',
    'Agar kegiatan terlihat sukses, tim ingin menghapus keluhan dari rekap. Sikap berintegritas adalah ...',
    'Anda diminta mengubah tanggal dokumen untuk menutupi keterlambatan. Tindakan berintegritas adalah ...',
    'Atasan meminta angka perkiraan ditulis sebagai hasil yang sudah diverifikasi. Sikap yang tepat adalah ...',
  ], choices: [
    'Menjelaskan risiko secara sopan, mempertahankan data yang benar, dan mengusulkan perbaikan yang sah.|Keteguhan prinsip tetap disertai tanggung jawab mencari penyelesaian.',
    'Mengikuti permintaan karena berasal dari pemimpin.|Kewenangan tidak membenarkan manipulasi.',
    'Menyetujui sementara lalu mengubah kembali setelah penilaian selesai.|Manipulasi sementara tetap merusak kejujuran.',
    'Menolak seluruh pekerjaan agar tidak ikut bertanggung jawab.|Menghindari seluruh tugas tidak menawarkan penyelesaian.',
    'Mencatat perubahan tanpa memberi tahu pihak yang menerima laporan.|Koreksi yang tidak transparan menghambat akuntabilitas.',
  ] },
  { topic: 'Integritas', subtopic: 'Akuntabilitas keputusan', difficulty: 'hots', stems: [
    'Tim ingin mencapai tenggat dengan mengurangi pemeriksaan yang menentukan keabsahan hasil. Keputusan yang menjaga integritas adalah ...',
    'Pekerjaan penting tertunda dan pimpinan meminta cara mempercepat tanpa menurunkan standar. Pilihan yang tepat adalah ...',
    'Unit menghadapi tekanan target setelah menemukan masalah mutu. Langkah yang sesuai integritas adalah ...',
    'Kesalahan sudah diketahui, tetapi koreksi akan memengaruhi penilaian kinerja. Tindakan yang tepat adalah ...',
  ], choices: [
    'Menilai risiko, mengklarifikasi prioritas, mempertahankan pemeriksaan penting, dan mendokumentasikan penyesuaian yang sah.|Target dicapai melalui cara yang dapat dipertanggungjawabkan.',
    'Menghapus pemeriksaan tanpa persetujuan agar target selesai.|Kecepatan menghilangkan kontrol yang menentukan mutu.',
    'Menurunkan standar dalam catatan tanpa mengumumkan perubahan.|Perubahan standar tersembunyi memanipulasi penilaian.',
    'Menunda semua keputusan tanpa memetakan pilihan yang tersedia.|Kehati-hatian tanpa usaha penyelesaian tidak cukup.',
    'Memilih cara yang paling menguntungkan citra unit meskipun bukti belum lengkap.|Citra mengalahkan kebenaran dan akuntabilitas.',
  ] },
  { topic: 'Bela Negara', subtopic: 'Kontribusi nonmiliter', difficulty: 'mudah', stems: [
    'Pelajar membantu edukasi kesiapsiagaan bencana di lingkungannya. Kegiatan tersebut menunjukkan ...',
    'Warga ikut menjaga lingkungan dan fasilitas umum secara teratur. Kontribusi tersebut merupakan ...',
    'Komunitas mengajarkan literasi digital agar warga tidak mudah terpengaruh informasi palsu. Hal ini menunjukkan ...',
    'Relawan membantu masyarakat memperoleh informasi kesehatan yang benar. Kontribusi tersebut mencerminkan ...',
  ], choices: [
    'Partisipasi bela negara nonmiliter melalui kontribusi sesuai kemampuan.|Ketahanan masyarakat diperkuat melalui kontribusi sipil yang bermanfaat.',
    'Penggantian seluruh peran lembaga negara oleh masyarakat.|Partisipasi tidak menghapus kewenangan lembaga negara.',
    'Bela negara yang hanya dapat dilakukan oleh anggota militer.|Kontribusi bela negara tidak terbatas pada kegiatan militer.',
    'Kewajiban melakukan tindakan di luar kompetensi pribadi.|Kontribusi harus tetap sesuai kemampuan dan aturan.',
    'Kegiatan pribadi yang tidak mempunyai hubungan dengan kepentingan masyarakat.|Manfaat kegiatan langsung berkaitan dengan ketahanan bersama.',
  ] },
  { topic: 'Bela Negara', subtopic: 'Ketahanan informasi', difficulty: 'sedang', stems: [
    'Pesan tentang bencana beredar tanpa sumber resmi. Tindakan yang mendukung ketahanan masyarakat adalah ...',
    'Rumor mengenai layanan penting membuat warga panik. Sikap yang sesuai bela negara adalah ...',
    'Informasi palsu memicu pertentangan di lingkungan. Kontribusi yang tepat adalah ...',
    'Komunitas menerima kabar ancaman yang belum dapat dipastikan. Tindakan yang tepat adalah ...',
  ], choices: [
    'Memeriksa informasi melalui sumber yang dapat dipercaya dan menyampaikan koreksi secara bertanggung jawab.|Verifikasi menjaga ketahanan informasi dan mencegah kepanikan.',
    'Menyebarkan pesan segera agar dianggap paling cepat memberi peringatan.|Kecepatan tanpa verifikasi menambah risiko.',
    'Menyembunyikan seluruh informasi termasuk yang sudah terverifikasi.|Ketahanan membutuhkan informasi benar yang dapat diakses.',
    'Membalas rumor dengan rumor tandingan.|Rumor tandingan tidak membangun kepercayaan.',
    'Menganggap sumber resmi tidak perlu diperiksa karena sudah ada banyak unggahan.|Jumlah unggahan tidak membuktikan kebenaran.',
  ] },
  { topic: 'Bela Negara', subtopic: 'Lingkungan dan ketahanan', difficulty: 'sulit', stems: [
    'Pencemaran sungai mengurangi akses air dan memicu konflik warga. Makna perlindungan lingkungan dalam bela negara adalah ...',
    'Kerusakan hutan meningkatkan risiko bencana dan mengganggu ekonomi lokal. Pandangan yang tepat adalah ...',
    'Krisis sumber air berdampak pada kesehatan serta mata pencaharian masyarakat. Sikap yang sesuai ketahanan nasional adalah ...',
    'Alih fungsi lahan meningkatkan kerentanan pangan komunitas. Pemahaman yang tepat adalah ...',
  ], choices: [
    'Menjaga sumber daya sebagai bagian dari keberlanjutan hidup dan ketahanan masyarakat.|Dampak lingkungan berkaitan dengan keselamatan, stabilitas, dan kesejahteraan.',
    'Memisahkan persoalan lingkungan dari seluruh aspek ketahanan.|Dampaknya meluas ke kesehatan dan ekonomi.',
    'Menganggap tanggung jawab hanya berada pada pemerintah tanpa partisipasi warga.|Ketahanan memerlukan peran masyarakat sesuai kewenangan.',
    'Menghentikan seluruh kegiatan ekonomi tanpa mempertimbangkan kebutuhan masyarakat.|Penanganan perlu menimbang keberlanjutan serta dampak sosial.',
    'Mengabaikan dampak jangka panjang selama produksi masih meningkat.|Keuntungan sesaat tidak menjamin ketahanan.',
  ] },
  { topic: 'Bela Negara', subtopic: 'Kesiapsiagaan dan kewenangan', difficulty: 'hots', stems: [
    'Ancaman bencana meningkat, tetapi relawan belum mempunyai pembagian peran. Langkah yang tepat adalah ...',
    'Warga ingin membantu penanganan keadaan darurat namun belum mendapat arahan teknis. Tindakan yang tepat adalah ...',
    'Beberapa komunitas menawarkan bantuan yang sama saat kebutuhan di tempat lain belum terpenuhi. Perbaikan yang tepat adalah ...',
    'Informasi keadaan darurat berubah cepat dan masyarakat ingin bertindak. Langkah yang mendukung bela negara adalah ...',
  ], choices: [
    'Mengikuti informasi terverifikasi, mengoordinasikan peran sesuai kemampuan, dan menjaga keselamatan dalam tindakan.|Kontribusi terkoordinasi memberi manfaat tanpa menambah risiko.',
    'Bertindak sendiri di semua lokasi agar bantuan terlihat cepat.|Tindakan tanpa koordinasi dapat memperbesar risiko.',
    'Mengambil tugas teknis yang belum dikuasai demi menunjukkan keberanian.|Keberanian tidak menggantikan kompetensi.',
    'Menunggu tanpa menawarkan kemampuan yang dapat digunakan secara aman.|Sikap pasif mengabaikan peluang kontribusi.',
    'Menyebarkan semua informasi mentah agar warga memilih tindakan sendiri.|Informasi tidak terverifikasi dapat membahayakan.',
  ] },
  { topic: 'Pilar Negara', subtopic: 'Pancasila dan persatuan', difficulty: 'mudah', stems: [
    'Warga bergotong royong tanpa membedakan asal kelompoknya. Sikap ini paling mencerminkan nilai ...',
    'Tim lintas daerah mengutamakan tujuan bersama di atas kepentingan kelompok. Nilai yang menonjol adalah ...',
    'Pelajar menghargai keragaman sambil menjaga kebersamaan. Nilai yang ditunjukkan adalah ...',
    'Komunitas menolak perpecahan berdasarkan latar budaya. Prinsip yang paling tepat adalah ...',
  ], choices: [
    'Persatuan Indonesia.|Persatuan menghubungkan keragaman dengan kepentingan bersama.',
    'Dominasi kelompok mayoritas.|Persatuan bukan dominasi satu kelompok.',
    'Penghapusan budaya daerah.|Identitas daerah dapat hidup dalam persatuan.',
    'Pemisahan kepentingan setiap kelompok secara mutlak.|Pemisahan mutlak melemahkan kebersamaan.',
    'Keistimewaan kelompok yang paling kuat.|Keistimewaan tidak mencerminkan persatuan setara.',
  ] },
  { topic: 'Pilar Negara', subtopic: 'Musyawarah', difficulty: 'sedang', stems: [
    'Rapat warga menghadapi dua usulan berbeda. Cara mengambil keputusan yang sesuai musyawarah adalah ...',
    'Panitia belum sepakat tentang penggunaan fasilitas bersama. Langkah yang sesuai nilai kerakyatan adalah ...',
    'Perwakilan kelompok mempunyai kebutuhan yang berbeda dalam kegiatan lingkungan. Sikap yang tepat adalah ...',
    'Anggota tim ingin menentukan prioritas program yang memengaruhi banyak pihak. Cara yang tepat adalah ...',
  ], choices: [
    'Mendengar alasan para pihak dan membahas keputusan untuk kepentingan bersama.|Musyawarah memberi ruang pertimbangan dan tanggung jawab bersama.',
    'Memberikan keputusan kepada orang yang berbicara paling keras.|Kekuatan suara bukan kualitas pertimbangan.',
    'Menutup kesempatan kelompok kecil menyampaikan kebutuhan.|Musyawarah memerlukan kesempatan menyampaikan pendapat.',
    'Memutuskan menurut kedekatan personal dengan pimpinan.|Kedekatan tidak menjadi dasar kepentingan bersama.',
    'Menunda selamanya agar tidak ada pihak yang tidak puas.|Musyawarah tetap harus mengarah pada keputusan.',
  ] },
  { topic: 'Pilar Negara', subtopic: 'Kesetaraan dan konstitusi', difficulty: 'sulit', stems: [
    'Layanan publik memberi syarat tambahan hanya kepada kelompok tertentu tanpa dasar yang sah. Penilaian yang tepat adalah ...',
    'Akses fasilitas umum dibatasi berdasarkan asal daerah tanpa alasan yang relevan. Sikap yang sesuai pilar negara adalah ...',
    'Kesempatan mengikuti program ditutup kepada peserta karena identitas budayanya. Tindakan yang tepat adalah ...',
    'Aturan diterapkan berbeda kepada warga dengan kondisi yang sama karena kedekatan personal. Penilaian yang tepat adalah ...',
  ], choices: [
    'Meninjau perlakuan berdasarkan prinsip kesetaraan dan dasar aturan yang dapat dipertanggungjawabkan.|Perbedaan perlakuan memerlukan alasan yang sah, bukan identitas atau kedekatan.',
    'Menerima pembatasan karena petugas mempunyai kewenangan.|Kewenangan harus digunakan sesuai prinsip dan aturan.',
    'Mengutamakan kelompok yang paling dekat dengan penanggung jawab.|Favoritisme bertentangan dengan kesetaraan.',
    'Menyeragamkan seluruh kebutuhan pengguna tanpa menilai hambatan akses.|Kesetaraan juga memerlukan perhatian pada kebutuhan yang sah.',
    'Membiarkan perbedaan sampai muncul tekanan dari banyak orang.|Hak tidak bergantung pada besarnya tekanan.',
  ] },
  { topic: 'Pilar Negara', subtopic: 'Bhinneka Tunggal Ika', difficulty: 'hots', stems: [
    'Program bersama mengharuskan semua peserta meninggalkan identitas budayanya agar dianggap kompak. Evaluasi yang tepat adalah ...',
    'Kegiatan lintas budaya membuka partisipasi tetapi hanya mengakui satu kebiasaan sebagai ukuran keberhasilan. Evaluasi yang tepat adalah ...',
    'Panitia menganggap perbedaan adat sebagai hambatan dan menutup dialog. Perbaikan yang tepat adalah ...',
    'Kelompok yang berbeda latar diminta bekerja sama, tetapi salah satu kelompok tidak diberi ruang pendapat. Evaluasi yang tepat adalah ...',
  ], choices: [
    'Membangun tujuan bersama sambil menghormati keragaman dan memberikan ruang partisipasi setara.|Bhinneka Tunggal Ika menghubungkan perbedaan dengan kesatuan, bukan penyeragaman paksa.',
    'Mempertahankan penyeragaman karena membuat kegiatan lebih mudah.|Kemudahan tidak membenarkan penghilangan keragaman.',
    'Memisahkan semua kelompok agar tidak pernah berinteraksi.|Pemisahan menghindari kesempatan membangun kesatuan.',
    'Membiarkan satu kelompok menentukan semua ukuran kegiatan.|Dominasi menutup partisipasi setara.',
    'Menghapus tujuan bersama agar setiap kelompok berjalan sendiri.|Keragaman tetap dapat dihubungkan oleh tujuan bersama.',
  ] },
  { topic: 'Bahasa Negara', subtopic: 'Kalimat efektif', difficulty: 'mudah', stems: [
    'Pilih kalimat yang efektif untuk undangan rapat.',
    'Kalimat yang hemat dan jelas dalam pengumuman rapat adalah ...',
    'Penulisan kalimat efektif untuk peserta rapat adalah ...',
    'Manakah kalimat yang tidak memuat kata berlebihan?',
  ], choices: [
    'Peserta diminta hadir tepat waktu.|Subjek dan predikat jelas, dengan penggunaan kata yang hemat.',
    'Para peserta-peserta diminta hadir tepat waktu.|Penanda jamak digunakan dua kali.',
    'Peserta diminta untuk agar hadir tepat waktu.|Penghubung untuk dan agar berlebihan.',
    'Peserta diminta hadir tepat waktu supaya agar rapat dimulai.|Penghubung supaya dan agar berlebihan.',
    'Peserta diminta hadir tepat waktu demi untuk kelancaran rapat.|Demi dan untuk digunakan berlebihan.',
  ] },
  { topic: 'Bahasa Negara', subtopic: 'Kata depan dan imbuhan', difficulty: 'sedang', stems: [
    'Kalimat dengan penulisan kata depan dan imbuhan yang tepat adalah ...',
    'Pilih penulisan yang tepat untuk pengumuman layanan.',
    'Manakah kalimat yang membedakan kata depan di dan imbuhan di- dengan benar?',
    'Kalimat yang sesuai kaidah penulisan lokasi dan verba pasif adalah ...',
  ], choices: [
    'Berkas disimpan di kantor.|Disimpan adalah verba pasif dengan imbuhan; di kantor menunjukkan tempat.',
    'Berkas di simpan di kantor.|Imbuhan pada verba pasif harus ditulis serangkai.',
    'Berkas disimpan dikantor.|Kata depan yang menunjukkan lokasi ditulis terpisah.',
    'Berkas di simpan dikantor.|Penulisan imbuhan dan kata depan sama-sama tidak tepat.',
    'Berkas di-simpan di-kantor.|Tanda hubung tidak diperlukan pada kedua bentuk tersebut.',
  ] },
  { topic: 'Bahasa Negara', subtopic: 'Kesimpulan bacaan', difficulty: 'sulit', stems: [
    'Perpustakaan menambah koleksi digital. Sebagian pengunjung terbantu, tetapi warga tanpa internet masih kesulitan mengaksesnya. Perpustakaan kemudian menyediakan perangkat dan pendampingan. Kesimpulan yang tepat adalah ...',
    'Layanan perizinan beralih ke sistem daring. Proses menjadi lebih cepat bagi sebagian pengguna, tetapi warga yang belum terbiasa memerlukan bantuan. Petugas menyediakan pendampingan. Kesimpulan yang tepat adalah ...',
    'Sekolah menggunakan bahan belajar digital. Banyak siswa mudah mengakses materi, tetapi sebagian tidak mempunyai perangkat. Sekolah menyediakan fasilitas bersama. Kesimpulan yang tepat adalah ...',
    'Pendaftaran kegiatan dilakukan secara digital. Sebagian peserta terbantu, tetapi peserta tanpa akses internet mengalami hambatan. Panitia membuka loket bantuan. Kesimpulan yang tepat adalah ...',
  ], choices: [
    'Perubahan digital perlu disertai dukungan akses bagi pengguna yang mengalami hambatan.|Kesimpulan merangkum manfaat, hambatan, dan solusi yang disebut dalam teks.',
    'Sistem digital selalu memperlambat seluruh pengguna.|Teks menyebut sebagian pengguna terbantu.',
    'Semua pengguna mempunyai akses internet yang sama.|Teks menyatakan adanya hambatan akses.',
    'Sistem digital harus dihentikan sepenuhnya.|Teks menawarkan dukungan akses, bukan penghentian.',
    'Pendampingan tidak memengaruhi akses pengguna.|Pendampingan disediakan untuk mengatasi hambatan.',
  ] },
  { topic: 'Bahasa Negara', subtopic: 'Penalaran isi bacaan', difficulty: 'hots', stems: [
    'Survei menunjukkan kepuasan layanan meningkat setelah petugas dilatih. Namun, waktu tunggu masih panjang. Evaluasi menyarankan perbaikan alur antrean. Pernyataan yang didukung teks adalah ...',
    'Pengunjung lebih memahami materi setelah panduan diperbaiki. Namun, akses bagi sebagian pengguna masih terbatas. Evaluasi menyarankan penambahan kanal bantuan. Pernyataan yang didukung teks adalah ...',
    'Peserta lebih aktif setelah metode pembelajaran berubah. Namun, hasil sebagian peserta belum mencapai target. Evaluasi menyarankan pendampingan tambahan. Pernyataan yang didukung teks adalah ...',
    'Koordinasi tim membaik setelah jadwal disepakati. Namun, beberapa pekerjaan masih terlambat. Evaluasi menyarankan pemeriksaan pembagian tugas. Pernyataan yang didukung teks adalah ...',
  ], choices: [
    'Perbaikan pada satu aspek belum menyelesaikan seluruh hambatan yang ditemukan.|Teks memuat kemajuan sekaligus masalah yang masih perlu ditangani.',
    'Perbaikan yang dilakukan tidak memberi manfaat apa pun.|Teks secara eksplisit menyebut kemajuan.',
    'Seluruh hambatan sudah selesai setelah perubahan pertama.|Teks menyebut masalah yang masih tersisa.',
    'Masalah tersisa membuktikan bahwa perubahan harus dibatalkan.|Kesimpulan itu melampaui informasi dalam teks.',
    'Evaluasi tidak diperlukan karena sudah terjadi kemajuan.|Teks menunjukkan manfaat evaluasi lanjutan.',
  ] },
];

export const twkCases: BankItem[] = templates.flatMap((template, index) => template.stems.map((stem, variant) => {
  const options = template.choices.map((choice, i) => {
    const [text, reason] = choice.split('|');
    return { text, reason, score: i === 0 ? 5 : 0 };
  });
  return {
    id: 'twk-case-' + index + '-' + variant, subtest: 'TWK', topic: template.topic,
    subtopic: template.subtopic, difficulty: template.difficulty, stem, options, answer: 0,
    explanation: options[0].reason,
    source: 'Kasus latihan berdasarkan cakupan TWK dalam Riset Seleksi CPNS 2027.',
  };
}));
