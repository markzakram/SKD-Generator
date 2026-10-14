import { TKP_SUBTOPICS } from '../config';
import type { BankItem, Difficulty } from '../types';

type Case = { index: number; bloom: string; situations: string[]; actions: string[] };
// Each situation has a different operational obstacle. Scores are attached to
// the action, never to its eventual A–E position.
const cases: Case[] = [
  { index: 0, bloom: 'C3', situations: [
    'Banyak warga mengetahui bahwa pengaduan dapat disampaikan, tetapi tidak mengetahui cara memantau tindak lanjutnya.',
    'Formulir layanan sering tidak lengkap karena petunjuk pengisian menggunakan istilah yang tidak dipahami pengguna.',
    'Keluhan warga berulang tentang tahapan layanan yang tidak jelas meskipun kantor sudah memiliki laman informasi.',
    'Warga di wilayah tanpa internet kesulitan mengakses informasi persyaratan yang hanya dipasang secara daring.',
  ], actions: [
    '5|Mengidentifikasi hambatan pengguna, menyediakan panduan dan kanal yang mudah diakses, serta memastikan tindak lanjut.|Menghubungkan kebutuhan nyata, akses yang setara, dan penyelesaian yang dapat dipantau.',
    '4|Memberikan penjelasan langsung kepada pengguna yang datang, lalu mencatat hambatan yang mereka alami.|Membantu secara nyata dan mengumpulkan informasi, tetapi jangkauannya belum mencakup pengguna lain.',
    '3|Meminta izin pimpinan untuk memperbarui informasi setelah menerima beberapa keluhan tambahan.|Mengarah pada perbaikan, tetapi menunda penanganan masalah yang sudah diketahui.',
    '2|Mengarahkan semua pengguna ke laman informasi yang sudah tersedia.|Menggunakan kanal resmi, tetapi mengabaikan hambatan akses dan pemahaman.',
    '1|Menganggap kesulitan tersebut sebagai tanggung jawab pengguna untuk mencari informasi sendiri.|Mengabaikan orientasi pelayanan dan membiarkan hambatan berulang.',
  ] },
  { index: 1, bloom: 'C4', situations: [
    'Nomor antrean elektronik seorang warga tidak muncul, tetapi ia menunjukkan bukti pemesanan yang sah.',
    'Persyaratan baru belum disosialisasikan sehingga warga membawa dokumen sesuai informasi resmi yang lama.',
    'Kesalahan input oleh petugas membuat status permohonan warga tertunda walaupun dokumennya lengkap.',
    'Sistem mencatat biaya yang berbeda dari tarif resmi yang diumumkan kepada warga.',
  ], actions: [
    '5|Memeriksa bukti dan aturan yang berlaku, menjelaskan kendala, lalu mengoordinasikan koreksi melalui prosedur yang sah.|Menjaga kepastian, hak pengguna, bukti, dan kewenangan sekaligus.',
    '4|Memverifikasi bukti dan meminta bantuan unit terkait sambil memberi estimasi tindak lanjut yang realistis.|Tepat dalam verifikasi dan komunikasi, tetapi perlu memastikan koreksi benar-benar dituntaskan.',
    '3|Mencatat laporan warga dan meneruskannya tanpa menjelaskan langkah atau waktu tindak lanjut.|Ada pencatatan, tetapi pengguna belum mendapat kepastian proses.',
    '2|Meminta warga mengulangi seluruh proses agar data baru lebih mudah ditangani.|Memindahkan dampak masalah sistem kepada pengguna.',
    '1|Mengubah catatan berdasarkan perkiraan tanpa verifikasi agar warga segera terlayani.|Kecepatan tidak membenarkan perubahan tanpa bukti dan prosedur.',
  ] },
  { index: 2, bloom: 'C3', situations: [
    'Seorang warga berbicara dengan nada tinggi karena hasil layanan belum selesai pada waktu yang dijanjikan.',
    'Pengguna lanjut usia tampak cemas ketika petugas menjelaskan adanya kendala aplikasi.',
    'Seorang pengguna kecewa karena informasi dari dua loket berbeda tidak konsisten.',
    'Warga mengeluhkan jawaban petugas yang terlalu teknis dan meminta penjelasan yang lebih sederhana.',
  ], actions: [
    '5|Mendengarkan dengan tenang, mengakui kendala, menjelaskan informasi yang benar, dan menawarkan langkah penyelesaian yang realistis.|Empati disertai informasi dan solusi, bukan sekadar keramahan.',
    '4|Menjelaskan masalah dengan sopan dan membantu menghubungkan pengguna kepada petugas yang tepat.|Membantu dengan komunikasi baik, tetapi tindak lanjut perlu dipastikan.',
    '3|Meminta maaf dan mengajak pengguna menunggu tanpa memberikan informasi tambahan.|Menjaga hubungan, tetapi belum memberi kepastian atau solusi.',
    '2|Meminta pengguna membaca pengumuman agar penjelasan petugas tidak perlu diulang.|Kurang menyesuaikan komunikasi dengan kebutuhan pengguna.',
    '1|Membalas nada pengguna agar ia memahami bahwa petugas juga memiliki tekanan kerja.|Memperburuk konflik dan mengabaikan kendali emosi.',
  ] },
  { index: 3, bloom: 'C4', situations: [
    'Pengguna kursi roda kesulitan mencapai loket, sementara petugas memiliki prosedur bantuan akses.',
    'Seorang warga meminta didahulukan karena mengenal pejabat, padahal antrean prioritas diperuntukkan bagi kelompok rentan.',
    'Pengguna dengan gangguan pendengaran meminta penjelasan tertulis tentang tahapan pelayanan.',
    'Warga yang tidak memiliki telepon pintar membutuhkan bantuan mengajukan layanan yang tersedia secara digital.',
  ], actions: [
    '5|Memberikan bantuan atau akomodasi sesuai kebutuhan yang sah sambil menjaga hak antrean dan aturan bagi pengguna lain.|Kesetaraan berarti mengatasi hambatan secara sah, bukan memberikan keistimewaan karena hubungan.',
    '4|Menghubungkan pengguna dengan petugas bantuan yang sesuai dan menjelaskan prosedurnya.|Membuka akses, tetapi keterhubungan sampai selesai perlu dipastikan.',
    '3|Menjelaskan bahwa aturan berlaku untuk semua dan meminta arahan pimpinan tentang bantuan tambahan.|Menjaga aturan, tetapi belum memakai bantuan yang sudah tersedia secara aktif.',
    '2|Menerapkan proses yang persis sama tanpa mempertimbangkan hambatan akses pengguna.|Kesamaan proses belum tentu menghasilkan akses yang adil.',
    '1|Memberikan pengecualian hanya kepada pengguna yang memiliki hubungan pribadi dengan petugas.|Favoritisme mengorbankan prinsip nondiskriminasi.',
  ] },
  { index: 4, bloom: 'C5', situations: [
    'Layanan mendesak dibutuhkan warga, tetapi sebagian dokumen pendukung belum terverifikasi dan kewenangan Anda terbatas.',
    'Gangguan sistem menghambat layanan penting, sementara terdapat prosedur alternatif yang harus mendapat persetujuan.',
    'Dua kelompok pengguna sama-sama meminta prioritas, tetapi tingkat urgensi dan risikonya berbeda.',
    'Sebuah permohonan berisiko merugikan pihak lain jika disetujui segera tanpa pemeriksaan tambahan.',
  ], actions: [
    '5|Menilai urgensi, bukti, dan risiko, mengklarifikasi kewenangan, lalu mengoordinasikan alternatif yang sah dan mendokumentasikan keputusan.|Memadukan kecepatan yang proporsional dengan legalitas, keselamatan, dan akuntabilitas.',
    '4|Memeriksa bukti dan mengeskalasi kepada pihak berwenang sambil menjelaskan kondisi kepada pengguna.|Aman dan komunikatif, tetapi perlu menyiapkan alternatif layanan yang tersedia.',
    '3|Mengumpulkan informasi tambahan sebelum menentukan tindak lanjut tanpa menjelaskan sementara kepada pengguna.|Verifikasi penting, tetapi komunikasi dan pengelolaan urgensi belum lengkap.',
    '2|Menunda semua keputusan sampai situasi kembali normal tanpa mempertimbangkan dampaknya.|Menghindari risiko pribadi, tetapi tidak proporsional terhadap kebutuhan mendesak.',
    '1|Menyetujui permohonan di luar kewenangan karena merasa kasihan kepada pengguna.|Niat membantu tidak menggantikan kewenangan dan verifikasi.',
  ] },
  { index: 5, bloom: 'C2', situations: [
    'Dua unit mempunyai target yang saling bergantung, tetapi masing-masing hanya membahas pencapaiannya sendiri.',
    'Mitra baru menawarkan kerja sama, sementara tujuan dan batas peran kedua pihak belum disepakati.',
    'Tim Anda mempunyai banyak kontak profesional, tetapi belum ada tindak lanjut untuk kebutuhan pekerjaan bersama.',
    'Hubungan antarrekan cukup akrab, tetapi tidak ada kesepakatan tentang hasil kerja yang harus dicapai.',
  ], actions: [
    '5|Menyamakan tujuan bersama, mengklarifikasi kontribusi dan batas peran, serta menyepakati tindak lanjut yang saling bermanfaat.|Jejaring produktif dibangun melalui tujuan, kepercayaan, dan komitmen yang jelas.',
    '4|Mengajak para pihak membahas kebutuhan masing-masing dan mencari peluang kerja sama.|Membangun saling pengertian, tetapi belum mengikatnya pada peran dan tindak lanjut.',
    '3|Menjaga komunikasi rutin agar hubungan tetap baik sebelum membahas pekerjaan lebih jauh.|Hubungan terpelihara, tetapi hasil bersama belum ditentukan.',
    '2|Mengumpulkan lebih banyak kontak tanpa menilai relevansinya terhadap tujuan kerja.|Banyak kontak tidak otomatis menghasilkan jejaring produktif.',
    '1|Memanfaatkan hubungan untuk memperoleh perlakuan khusus bagi unit sendiri.|Penyalahgunaan relasi bertentangan dengan batas etis.',
  ] },
  { index: 6, bloom: 'C3', situations: [
    'Dua unit menggunakan versi data yang berbeda sehingga rencana kerja tidak sinkron.',
    'Informasi perubahan jadwal baru diterima sebagian anggota tim dan berpotensi menghambat pekerjaan.',
    'Dokumen kerja bersama memuat informasi sensitif yang tidak boleh dibagikan kepada seluruh mitra.',
    'Rekan meminta informasi segera, tetapi angka yang Anda terima belum diverifikasi oleh pemilik data.',
  ], actions: [
    '5|Memverifikasi informasi, menyepakati sumber resmi, dan membagikannya kepada pihak yang berhak dengan konfirmasi pemahaman.|Akurasi, ketepatan penerima, dan koordinasi mencegah salah tafsir serta kebocoran.',
    '4|Menghubungi pemilik informasi untuk klarifikasi dan memperbarui anggota yang berkepentingan.|Menjaga keandalan informasi, tetapi perlu satu sumber rujukan bersama.',
    '3|Meneruskan permintaan kepada pemilik data tanpa memastikan pengguna menerima jawabannya.|Menggunakan pihak yang tepat, tetapi tindak lanjut masih lemah.',
    '2|Membagikan seluruh dokumen agar setiap orang dapat memilih informasi sendiri.|Mengabaikan batas akses dan membebani penerima.',
    '1|Menyebarkan angka yang belum dipastikan benar agar terlihat responsif.|Kecepatan mengorbankan akurasi dan kepercayaan.',
  ] },
  { index: 7, bloom: 'C4', situations: [
    'Pekerjaan tim tertunda karena dua anggota menganggap tugas yang sama menjadi tanggung jawab orang lain.',
    'Tim lintas unit berselisih tentang pembagian sumber daya untuk mencapai target bersama.',
    'Seorang anggota menguasai bagian teknis, tetapi belum membagikan informasi yang diperlukan anggota lain.',
    'Rapat menghasilkan banyak usulan, tetapi tidak menetapkan siapa yang melakukan tindak lanjut.',
  ], actions: [
    '5|Memetakan masalah bersama, menyepakati peran sesuai kompetensi, dan menetapkan jadwal serta cara memantau hasil.|Kolaborasi efektif membutuhkan solusi, pembagian peran, dan tindak lanjut terukur.',
    '4|Memfasilitasi diskusi terbuka agar anggota memahami hambatan dan saling membantu.|Mengurangi konflik, tetapi belum memastikan kepemilikan tugas dan pemantauan.',
    '3|Membantu bagian yang mendesak sambil menunggu tim menyelesaikan pembagian pekerjaan.|Membantu sementara, tetapi akar masalah koordinasi tetap ada.',
    '2|Mengambil semua tugas sendiri agar tim tidak perlu berdiskusi lagi.|Berisiko menumpuk beban dan melemahkan keterlibatan tim.',
    '1|Menyalahkan anggota yang paling lambat di depan seluruh tim.|Mempermalukan pihak lain tanpa memperbaiki proses kerja.',
  ] },
  { index: 8, bloom: 'C5', situations: [
    'Mitra ingin melanjutkan kerja sama, tetapi evaluasi sebelumnya menunjukkan pembagian manfaat belum seimbang.',
    'Kerja sama antarlembaga berjalan baik, tetapi komitmen tindak lanjut hanya disampaikan secara lisan.',
    'Anda diminta memilih mitra baru dengan kebutuhan teknis yang berbeda dari kerja sama sebelumnya.',
    'Pergantian penanggung jawab di pihak mitra membuat beberapa kesepakatan tidak lagi dipahami dengan sama.',
  ], actions: [
    '5|Meninjau kebutuhan dan evaluasi bersama, menyepakati kontribusi yang adil, lalu mendokumentasikan komitmen serta mekanisme evaluasi.|Hubungan berkelanjutan memerlukan manfaat bersama, kejelasan, dan kemampuan memperbaiki proses.',
    '4|Mengadakan pertemuan untuk menyamakan harapan dan memperjelas penanggung jawab.|Membangun kembali komunikasi, tetapi komitmen terukur belum lengkap.',
    '3|Mempertahankan kesepakatan lama sambil mencatat masalah untuk pembahasan berikutnya.|Menjaga kesinambungan, tetapi perubahan kebutuhan belum ditangani.',
    '2|Mengandalkan kedekatan personal dengan satu kontak untuk menyelesaikan seluruh urusan.|Kerja sama rentan ketika kontak atau kondisi berubah.',
    '1|Meminta mitra mengikuti seluruh kepentingan unit Anda tanpa membahas manfaat bersama.|Hubungan sepihak merusak kepercayaan dan keberlanjutan.',
  ] },
  { index: 9, bloom: 'C2', situations: [
    'Anda belum memahami siapa yang mempunyai peran adat ketika kegiatan melibatkan komunitas setempat.',
    'Istilah yang sama mempunyai makna berbeda bagi dua kelompok masyarakat dalam kegiatan bersama.',
    'Rencana kegiatan mengabaikan jadwal penting masyarakat lokal yang belum diketahui tim.',
    'Tim menganggap seluruh anggota komunitas mempunyai kebiasaan yang sama tanpa berkonsultasi.',
  ], actions: [
    '5|Mencari pemahaman dari pihak yang relevan, memeriksa keragaman pandangan, dan menyesuaikan komunikasi tanpa mengorbankan hak peserta.|Membaca struktur sosial dan konteks mencegah stereotip serta keputusan yang tidak tepat.',
    '4|Berkonsultasi kepada perwakilan lokal sebelum melanjutkan kegiatan.|Menghormati konteks, tetapi perlu memastikan lebih dari satu perspektif terwakili.',
    '3|Mengikuti kebiasaan yang paling terlihat sambil mengamati respons peserta.|Ada upaya adaptasi, tetapi belum didukung pemahaman yang cukup.',
    '2|Memakai kebiasaan unit sendiri karena dianggap lebih mudah diterapkan.|Mengabaikan makna dan kebutuhan masyarakat setempat.',
    '1|Menggeneralisasi perilaku seluruh komunitas dari pengalaman dengan satu orang.|Stereotip tidak memberi dasar keputusan yang adil.',
  ] },
  { index: 10, bloom: 'C3', situations: [
    'Anda bekerja di daerah baru dan belum memahami tata krama dalam pertemuan warga.',
    'Rekan menggunakan bahasa lokal yang belum Anda kuasai ketika membahas pekerjaan.',
    'Kebiasaan waktu pertemuan komunitas berbeda dari pola kerja di tempat Anda sebelumnya.',
    'Anda diminta menghadiri kegiatan masyarakat dengan aturan partisipasi yang belum Anda pahami.',
  ], actions: [
    '5|Meminta penjelasan dengan hormat, mempelajari kebiasaan yang relevan, dan mencari cara berpartisipasi yang tetap sesuai aturan dan hak pribadi.|Adaptasi menggabungkan keterbukaan, pemahaman, dan batas yang sah.',
    '4|Meminta bantuan rekan lokal agar dapat mengikuti kegiatan secara tepat.|Membuka jalan adaptasi, tetapi pemahaman mandiri perlu dikembangkan.',
    '3|Mengamati terlebih dahulu sebelum mengambil peran aktif.|Berhati-hati, tetapi tanpa klarifikasi dapat mempertahankan ketidakpahaman.',
    '2|Meminta seluruh komunitas segera menggunakan kebiasaan dari tempat asal Anda.|Membebankan penyesuaian sepihak kepada lingkungan.',
    '1|Menghindari semua kegiatan karena kebiasaan setempat dianggap merepotkan.|Menutup kesempatan memahami dan membangun hubungan.',
  ] },
  { index: 11, bloom: 'C4', situations: [
    'Anggota tim dari kelompok minoritas jarang diajak berdiskusi walaupun memiliki keahlian yang relevan.',
    'Seorang rekan menjadi sasaran lelucon mengenai latar budayanya dan mulai menarik diri.',
    'Pembagian tugas hanya melibatkan anggota yang dekat secara personal dengan penanggung jawab.',
    'Usulan rekan baru ditolak sebelum dibahas karena dianggap tidak memahami kebiasaan kelompok.',
  ], actions: [
    '5|Mendengar pihak terdampak, menghentikan perilaku yang merendahkan secara proporsional, dan memperbaiki kesempatan partisipasi yang setara.|Empati diterjemahkan menjadi perlindungan martabat dan perbaikan dinamika kelompok.',
    '4|Memberi dukungan kepada rekan dan mengajaknya terlibat dalam pekerjaan bersama.|Memberi bantuan nyata, tetapi pola eksklusi kelompok perlu diperbaiki.',
    '3|Mengingatkan anggota lain secara umum agar menjaga hubungan baik.|Memberi pesan positif, tetapi tidak cukup menangani hambatan konkret.',
    '2|Menyarankan rekan yang tersisih untuk menyesuaikan diri tanpa membahas perilaku kelompok.|Membebankan masalah hanya kepada pihak terdampak.',
    '1|Membiarkan perilaku tersebut karena sudah menjadi kebiasaan tim.|Normalisasi eksklusi merusak harmoni dan kesetaraan.',
  ] },
  { index: 12, bloom: 'C5', situations: [
    'Perubahan kegiatan komunitas menimbulkan perselisihan antara kelompok muda dan kelompok senior.',
    'Program baru dinilai bermanfaat, tetapi sebagian warga khawatir tradisi lokal akan hilang.',
    'Dua kelompok berbeda pandangan mengenai pemanfaatan fasilitas bersama dan mulai saling menyalahkan.',
    'Pendatang dan warga lama mempunyai harapan berbeda terhadap aturan kegiatan lingkungan.',
  ], actions: [
    '5|Memetakan kepentingan dan dampak, memfasilitasi dialog yang aman, serta mencari kesepakatan yang menghormati hak dan tujuan bersama.|Penyelesaian konstruktif membaca akar konflik dan melibatkan pihak terdampak.',
    '4|Mengajak perwakilan kelompok membahas solusi melalui musyawarah.|Mengutamakan dialog, tetapi perlu memastikan keterwakilan dan tindak lanjut.',
    '3|Menunda perubahan sementara sambil mengumpulkan informasi tambahan.|Dapat mengurangi tekanan, tetapi belum memberi mekanisme penyelesaian.',
    '2|Memilih pendapat kelompok yang paling banyak anggotanya tanpa membahas dampak terhadap kelompok lain.|Mayoritas saja tidak memastikan keadilan atau harmoni.',
    '1|Menganggap kelompok yang berbeda pandangan sebagai penghambat dan menutup diskusi.|Meningkatkan polarisasi serta mengabaikan hak peserta.',
  ] },
  { index: 13, bloom: 'C3', situations: [
    'Anda harus mengolah data besar, tetapi belum memeriksa akurasi alat otomatis yang tersedia.',
    'Tim memakai beberapa aplikasi dengan data yang tidak tersinkron sehingga laporan berbeda.',
    'Rekan mengusulkan alat digital baru tanpa menilai kecocokannya dengan kebutuhan pengguna.',
    'Hasil perhitungan aplikasi berbeda dari sampel yang Anda cek secara manual.',
  ], actions: [
    '5|Menilai kebutuhan dan keamanan alat, menguji hasil pada sampel, lalu menerapkan alur yang dapat diverifikasi dan dipantau.|Teknologi meningkatkan mutu bila sesuai kebutuhan, aman, dan hasilnya tervalidasi.',
    '4|Memakai alat yang sudah disetujui dan memeriksa hasilnya sebelum diserahkan.|Aman dan teliti, tetapi integrasi atau perbaikan alur masih dapat dikembangkan.',
    '3|Mengerjakan secara manual sambil meminta saran mengenai alat yang sesuai.|Menjaga kehati-hatian, tetapi belum memanfaatkan peluang efisiensi secara terencana.',
    '2|Memilih aplikasi yang paling banyak digunakan tanpa memeriksa hasil dan kebutuhan pekerjaan.|Popularitas tidak menjamin kecocokan atau akurasi.',
    '1|Mengirim hasil otomatis apa adanya agar pekerjaan cepat selesai.|Kecepatan tidak menggantikan tanggung jawab memvalidasi hasil.',
  ] },
  { index: 14, bloom: 'C4', situations: [
    'Sistem lama akan dihentikan, tetapi kemampuan menggunakan sistem pengganti belum merata.',
    'Rekan menolak aplikasi baru karena belum melihat manfaatnya untuk tugas sehari-hari.',
    'Pelatihan sistem baru sudah dilakukan, tetapi beberapa anggota masih kesulitan pada langkah penting.',
    'Penerapan teknologi baru berpotensi mengganggu pelayanan jika seluruh perubahan dilakukan sekaligus.',
  ], actions: [
    '5|Mempelajari sistem, menguji penerapan bertahap, mendampingi rekan, dan mengevaluasi manfaat serta hambatannya.|Menggabungkan pembelajaran, perubahan terkontrol, dan kesiapan tim.',
    '4|Mempelajari sistem dan membagikan panduan praktik kepada rekan.|Membangun kemampuan, tetapi perlu pendampingan dan evaluasi penerapan.',
    '3|Mengikuti pelatihan yang tersedia tanpa mencoba penerapan pada pekerjaan nyata.|Ada kesiapan belajar, tetapi transfer kemampuan belum dipastikan.',
    '2|Menunggu sampai sistem lama dihentikan sebelum mulai belajar.|Meningkatkan risiko ketidaksiapan saat perubahan wajib berlangsung.',
    '1|Menolak perubahan tanpa menguji manfaat atau menyampaikan hambatan secara konstruktif.|Menghambat adaptasi dan perbaikan mutu kerja.',
  ] },
  { index: 15, bloom: 'C4', situations: [
    'Pesan mencurigakan meminta Anda memasukkan kata sandi akun kerja melalui tautan yang tidak dikenal.',
    'Rekan meminta memakai akun Anda karena hak aksesnya belum tersedia.',
    'Dokumen berisi data pribadi hendak dibagikan melalui aplikasi yang belum disetujui organisasi.',
    'Anda menemukan data sensitif di folder bersama yang dapat diakses pihak yang tidak berkepentingan.',
  ], actions: [
    '5|Menghentikan tindakan berisiko, menjaga bukti yang aman, memverifikasi melalui kanal resmi, dan mengoordinasikan penanganan dengan pihak berwenang.|Mengendalikan risiko serta melindungi data tanpa memperluas paparan.',
    '4|Memeriksa kebijakan dan meminta konfirmasi pihak keamanan melalui kanal terpisah.|Verifikasi aman, tetapi pengendalian dan tindak lanjut perlu dipastikan.',
    '3|Tidak melanjutkan tindakan dan memberi tahu rekan terdekat saja.|Mengurangi risiko pribadi, tetapi belum menjangkau pihak yang perlu menangani.',
    '2|Meneruskan dokumen atau tautan kepada banyak orang agar mereka menilai risikonya.|Niat memperingatkan justru memperluas paparan.',
    '1|Melanjutkan tindakan karena permintaan tampak mendesak atau berasal dari rekan.|Urgensi tidak membenarkan pelanggaran akses dan keamanan.',
  ] },
  { index: 16, bloom: 'C4', situations: [
    'Atasan meminta Anda menandatangani dokumen yang belum sempat diperiksa.',
    'Anda menemukan ketidaksesuaian data pada laporan rekan senior sebelum laporan dikirim.',
    'Kerabat meminta informasi internal yang tidak boleh dibagikan kepadanya.',
    'Anda diminta memberi penilaian teknis yang berada di luar kompetensi dan kewenangan Anda.',
  ], actions: [
    '5|Mengklarifikasi fakta dan batas kewenangan dengan sopan, menjaga kerahasiaan, serta menawarkan penyelesaian sesuai standar.|Profesionalisme menjaga mutu, integritas, dan komunikasi sekaligus.',
    '4|Menjelaskan keberatan berbasis standar dan meminta pihak yang kompeten membantu.|Menjaga batas yang benar, tetapi perlu memastikan pekerjaan tetap dituntaskan.',
    '3|Menunda respons sampai mendapat arahan tambahan tanpa menjelaskan kendala utama.|Berhati-hati, tetapi komunikasi dan kepemilikan masalah masih kurang.',
    '2|Mengikuti permintaan karena hubungan atau senioritas dianggap lebih penting.|Hubungan tidak menggantikan bukti, kewenangan, dan standar.',
    '1|Mengubah atau membagikan informasi diam-diam agar permintaan cepat terpenuhi.|Menghilangkan transparansi dan pertanggungjawaban.',
  ] },
  { index: 17, bloom: 'C3', situations: [
    'Anda menyadari kesalahan pada pekerjaan sendiri yang sudah diteruskan kepada unit lain.',
    'Tugas berisiko terlambat dan Anda masih memiliki waktu untuk berkoordinasi sebelum tenggat.',
    'Catatan kegiatan Anda tidak lengkap sehingga hasil pekerjaan sulit ditelusuri.',
    'Anda berhalangan menyelesaikan bagian pekerjaan yang sudah dijanjikan kepada tim.',
  ], actions: [
    '5|Menyampaikan kondisi secara jujur, menilai dampak, mengoordinasikan perbaikan, dan mendokumentasikan tindak lanjut.|Mengambil tanggung jawab serta menjaga hasil dapat ditelusuri dan diperbaiki.',
    '4|Segera memperbaiki pekerjaan dan menginformasikan pihak yang terdampak.|Tepat dalam perbaikan, tetapi pencegahan atau dokumentasi perlu diperkuat.',
    '3|Meminta rekan membantu tanpa menjelaskan seluruh dampak dan tanggung jawab yang tersisa.|Ada upaya penyelesaian, tetapi koordinasi belum lengkap.',
    '2|Menunggu pihak lain menemukan masalah sebelum menjelaskannya.|Menunda koreksi dan menambah risiko terhadap pekerjaan bersama.',
    '1|Menyembunyikan kondisi atau menyalahkan pihak lain agar penilaian pribadi tetap baik.|Bertentangan dengan kejujuran dan akuntabilitas.',
  ] },
  { index: 18, bloom: 'C5', situations: [
    'Dua tugas penting mempunyai tenggat berdekatan dan kemampuan tim tidak cukup jika seluruhnya dikerjakan sendiri.',
    'Kesalahan pekerjaan yang sama berulang walaupun tim selalu melakukan koreksi di akhir.',
    'Anda menerima umpan balik bahwa kualitas laporan belum memenuhi standar analisis.',
    'Metode kerja yang selama ini digunakan mulai tidak sesuai dengan kebutuhan layanan yang berubah.',
  ], actions: [
    '5|Menilai prioritas dan akar masalah, mengoordinasikan sumber daya, memperbaiki metode, dan memeriksa mutu hasil secara terukur.|Penyelesaian menjaga hasil saat ini dan meningkatkan kemampuan atau proses berikutnya.',
    '4|Meminta umpan balik yang spesifik dan memperbaiki bagian pekerjaan yang paling berdampak.|Berorientasi mutu, tetapi perlu rencana serta evaluasi yang lebih menyeluruh.',
    '3|Menambah waktu kerja untuk menyelesaikan masalah tanpa meninjau cara kerjanya.|Membantu sementara, tetapi akar masalah dapat kembali muncul.',
    '2|Mengerjakan bagian yang paling mudah agar jumlah keluaran terlihat meningkat.|Mengutamakan angka keluaran tanpa memastikan prioritas dan mutu.',
    '1|Mengubah indikator atau menurunkan standar tanpa persetujuan agar target terlihat tercapai.|Manipulasi ukuran menghilangkan akuntabilitas hasil.',
  ] },
  { index: 19, bloom: 'C2', situations: [
    'Rekan menganggap kritik kebijakan yang disampaikan secara damai sebagai bukti bahwa pembicara berbahaya.',
    'Diskusi akademik dengan pendapat berbeda dinilai sebagai ancaman hanya karena topiknya sensitif.',
    'Seseorang dicurigai tanpa bukti perilaku berbahaya hanya karena identitas kelompoknya.',
    'Peserta rapat menolak mendengar argumen rekan karena latar keyakinannya berbeda.',
  ], actions: [
    '5|Membedakan kritik atau identitas dari perilaku berbahaya berdasarkan fakta, menjaga hak berdiskusi, dan menolak diskriminasi.|Penilaian harus bertumpu pada perilaku dan risiko, bukan perbedaan pendapat atau identitas.',
    '4|Meminta bukti dan konteks sebelum menyimpulkan serta mengingatkan agar diskusi tetap saling menghormati.|Mendorong verifikasi dan penghargaan, tetapi perlu memperjelas batas perilaku berbahaya.',
    '3|Mengalihkan topik agar ketegangan mereda tanpa membahas kesalahpahaman yang muncul.|Dapat meredakan sesaat, tetapi anggapan keliru belum diperbaiki.',
    '2|Menjauh dari peserta yang dicurigai tanpa menguji informasi yang disampaikan.|Mengikuti dugaan dan berpotensi memperkuat eksklusi.',
    '1|Menyebarkan tuduhan berdasarkan identitas atau kritik yang disampaikan secara damai.|Menggeneralisasi dan menimbulkan diskriminasi tanpa dasar perilaku.',
  ] },
  { index: 20, bloom: 'C4', situations: [
    'Pesan dalam grup mulai merendahkan martabat suatu kelompok dan membenarkan perlakuan kasar terhadap mereka.',
    'Sebuah akun mengajak anggota menyebarkan kebencian terhadap kelompok tertentu.',
    'Anda menerima materi yang membenarkan pemaksaan dan ancaman sebagai cara menyelesaikan perbedaan.',
    'Rekan diminta mengikuti pertemuan yang isi ajakannya mengarah pada pembenaran kekerasan.',
  ], actions: [
    '5|Memeriksa konteks dan indikator perilaku, menahan penyebaran, menyimpan bukti secara aman, dan meminta penanganan sesuai tingkat risiko.|Mengidentifikasi risiko dari isi serta tindakan dan menjaga keselamatan tanpa amplifikasi.',
    '4|Mengonfirmasi informasi melalui pihak yang kompeten dan mengingatkan rekan agar tidak menyebarkannya.|Verifikasi dan pencegahan tepat, tetapi bukti serta respons terkoordinasi perlu dipastikan.',
    '3|Menghapus pesan dari perangkat sendiri tanpa memberi tahu pihak yang mungkin terdampak.|Mengurangi paparan pribadi, tetapi pencegahan terhadap lingkungan terbatas.',
    '2|Membagikan ulang materi lengkap untuk meminta pendapat banyak orang.|Memperluas jangkauan propaganda dan risiko eskalasi.',
    '1|Menganggap ajakan kekerasan sebagai hal biasa karena disampaikan oleh orang yang dikenal.|Kedekatan tidak mengurangi bahaya isi dan tindakan.',
  ] },
  { index: 21, bloom: 'C3', situations: [
    'Grup kerja mulai menerima konten kebencian berulang, tetapi belum ada aturan moderasi yang jelas.',
    'Kegiatan orientasi belum membahas cara mengenali dan menolak pesan yang membenarkan kekerasan.',
    'Rekan baru kesulitan menilai konten provokatif dan meminta bantuan sebelum membagikannya.',
    'Komunitas membutuhkan langkah pencegahan agar diskusi perbedaan tidak berubah menjadi saling merendahkan.',
  ], actions: [
    '5|Mengajak penyusunan aturan dan edukasi berbasis perilaku, memeriksa sumber informasi, serta menyediakan kanal bantuan atau pelaporan yang tepat.|Pencegahan membangun kemampuan dan proses yang dapat diterapkan tanpa menyudutkan identitas.',
    '4|Mengingatkan anggota agar memverifikasi informasi dan menolak konten yang merendahkan atau membenarkan kekerasan.|Pesan pencegahan tepat, tetapi perlu mekanisme yang konsisten.',
    '3|Mengadakan imbauan umum tentang kerukunan tanpa membahas cara menghadapi konten berisiko.|Berniat baik, tetapi kemampuan praktis peserta belum dibangun.',
    '2|Melarang seluruh perbedaan pendapat agar tidak ada perselisihan.|Mencampur kritik damai dengan perilaku berbahaya.',
    '1|Menentukan kelompok tertentu sebagai sumber masalah tanpa bukti perilaku.|Pencegahan berubah menjadi stereotip dan diskriminasi.',
  ] },
  { index: 22, bloom: 'C5', situations: [
    'Sebuah pesan memuat ancaman nyata terhadap rekan dan menyebut lokasi kegiatan yang akan dihadirinya.',
    'Anda melihat ajakan melakukan kekerasan dalam kanal komunitas yang juga memuat data calon sasaran.',
    'Rekan menerima intimidasi berulang yang sudah membuatnya takut hadir di tempat kerja.',
    'Konten provokatif disertai rencana tindakan yang dapat membahayakan peserta kegiatan.',
  ], actions: [
    '5|Mengutamakan keselamatan, menjaga bukti tanpa menyebarluaskan, dan segera menghubungi pihak berwenang melalui prosedur yang tersedia.|Ancaman nyata memerlukan perlindungan dan penanganan resmi yang terkoordinasi.',
    '4|Memberi tahu penanggung jawab keamanan dan membantu pihak terdampak memperoleh perlindungan.|Melindungi pihak terdampak, tetapi bukti serta jalur tindak lanjut perlu dipastikan.',
    '3|Menganjurkan pihak terdampak menghindari lokasi sementara tanpa mengoordinasikan penanganan ancaman.|Mengurangi paparan sementara, tetapi sumber ancaman tetap belum ditangani.',
    '2|Mengajak pembuat ancaman berdebat sendiri agar ia mengubah pandangan.|Konfrontasi pribadi dapat meningkatkan risiko.',
    '1|Menyebarkan nama, lokasi, dan ancaman ke semua grup agar orang lain ikut menghadapi pelaku.|Memperluas paparan data dan mendorong tindakan tidak terkoordinasi.',
  ] },
];

export const tkpCases: BankItem[] = cases.flatMap((item) => item.situations.map((situation, variant) => {
  const [topic, subtopic] = TKP_SUBTOPICS[item.index];
  const options = item.actions.map((action) => {
    const [score, text, reason] = action.split('|');
    return { text, reason, score: Number(score) };
  });
  const difficulty: Difficulty = item.bloom === 'C2' ? 'sedang' : item.bloom === 'C3' ? 'sulit' : 'hots';
  return {
    id: 'tkp-case-' + item.index + '-' + variant, subtest: 'TKP', topic, subtopic, difficulty,
    bloom: item.bloom, stem: situation + ' Tindakan yang paling tepat adalah ...',
    options, answer: 0,
    explanation: options[0].reason + ' Penilaian setiap alternatif mengikuti efektivitas, kepatuhan, proporsionalitas, dan tindak lanjut dalam situasi tersebut.',
    source: 'Kasus latihan turunan rubrik Panduan Produksi Soal TKP JadiASN, submateri ' + subtopic,
  };
}));
