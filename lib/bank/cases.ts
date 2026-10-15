import { TKP_SUBTOPICS } from '../config';
import type { BankItem, Rubric } from '../types';

type Context = { issue: string; object: string; check: string; action: string; owner: string; temporary: string; outcome: string; risk: string };
// Variants change authority, urgency, evidence, or recurrence. The best action
// follows those constraints instead of a fixed list of generic good behaviours.
const contexts: Context[] = [
  { issue: 'Warga tidak mengetahui cara memantau pengaduan yang sudah diterima.', object: 'nomor pengaduan', check: 'cocokkan nomor dengan register pengaduan', action: 'Berikan nomor pelacakan dan jadwal pembaruan kepada warga.', owner: 'koordinator pengaduan', temporary: 'berikan bukti penerimaan tertulis', outcome: 'warga dapat melihat pembaruan status', risk: 'status pengaduan yang tidak dapat dipastikan' },
  { issue: 'Bukti pemesanan warga sah, tetapi nomor antreannya tidak muncul di sistem.', object: 'bukti pemesanan', check: 'cocokkan bukti dengan log pemesanan', action: 'Pulihkan antrean melalui prosedur koreksi yang tercatat.', owner: 'pengelola antrean', temporary: 'catat waktu kedatangan agar hak antrean terlindungi', outcome: 'hak antrean dipulihkan tanpa melewati pengguna lain', risk: 'perubahan urutan tanpa bukti' },
  { issue: 'Dua loket memberikan informasi berbeda tentang waktu penyelesaian izin.', object: 'estimasi penyelesaian', check: 'periksa status izin dan standar waktu layanan', action: 'Sampaikan estimasi terverifikasi beserta kanal pembaruannya.', owner: 'penanggung jawab izin', temporary: 'jelaskan informasi yang sudah terkonfirmasi', outcome: 'pemohon menerima satu estimasi yang dapat dipantau', risk: 'janji waktu yang tidak dapat dipenuhi' },
  { issue: 'Pengguna dengan gangguan pendengaran tidak memahami penjelasan lisan di loket.', object: 'panduan tertulis', check: 'tanyakan bentuk komunikasi yang nyaman bagi pengguna', action: 'Gunakan panduan tertulis dan periksa pemahaman pengguna.', owner: 'koordinator akses layanan', temporary: 'tuliskan langkah layanan yang telah diketahui', outcome: 'pengguna memahami langkah tanpa kehilangan hak antrean', risk: 'hambatan komunikasi yang belum teratasi' },
  { issue: 'Permohonan mendesak tertahan karena satu dokumen pendukung belum terverifikasi.', object: 'dokumen pendukung', check: 'periksa urgensi dan bagian dokumen yang belum terverifikasi', action: 'Aktifkan jalur verifikasi cepat sesuai prosedur layanan.', owner: 'pejabat pemberi persetujuan', temporary: 'proses bagian berkas yang tidak membutuhkan persetujuan', outcome: 'kebutuhan mendesak ditangani melalui kewenangan yang sah', risk: 'persetujuan tanpa verifikasi' },
  { issue: 'Keluaran unit pertama diperlukan unit kedua, tetapi target kedua unit belum selaras.', object: 'target lintas unit', check: 'petakan keluaran yang saling bergantung', action: 'Sepakati keluaran bersama dan pemilik tugas serah terima.', owner: 'koordinator lintas unit', temporary: 'bagikan peta ketergantungan tugas', outcome: 'kedua unit memakai target dan jadwal yang selaras', risk: 'target bersama kehilangan penanggung jawab' },
  { issue: 'Dua unit memakai versi berbeda dari data penerima layanan.', object: 'versi data', check: 'bandingkan tanggal pemutakhiran dengan pemilik data', action: 'Gunakan versi terverifikasi sebagai rujukan kedua unit.', owner: 'pemilik data', temporary: 'tandai data yang masih berselisih', outcome: 'perbedaan versi terselesaikan dan penerima yang berhak diberi akses', risk: 'angka belum terverifikasi tersebar' },
  { issue: 'Rapat tim selesai tanpa menetapkan siapa yang menindaklanjuti keputusan.', object: 'daftar tindak lanjut', check: 'konfirmasikan tugas dan tenggat dari notula', action: 'Tetapkan pemilik tugas dan tenggat dengan persetujuan tim.', owner: 'ketua tim', temporary: 'susun daftar tindakan yang menunggu penetapan', outcome: 'setiap tindak lanjut mempunyai pemilik dan tenggat', risk: 'tugas tumpang tindih atau terbengkalai' },
  { issue: 'Penanggung jawab mitra berganti dan kesepakatan ditafsirkan berbeda.', object: 'kesepakatan kerja sama', check: 'bandingkan pemahaman baru dengan dokumen kesepakatan', action: 'Konfirmasikan ulang komitmen dengan kontak resmi mitra.', owner: 'pengelola kemitraan', temporary: 'bagikan ringkasan komitmen yang masih berlaku', outcome: 'kedua pihak menyepakati peran dan mekanisme evaluasi', risk: 'komitmen baru melampaui mandat kerja sama' },
  { issue: 'Jadwal sosialisasi berbenturan dengan kegiatan penting masyarakat setempat.', object: 'jadwal sosialisasi', check: 'konfirmasikan kebutuhan dari beberapa perwakilan masyarakat', action: 'Sesuaikan jadwal untuk menjaga akses seluruh kelompok.', owner: 'koordinator kegiatan', temporary: 'catat pilihan waktu dari warga yang terdampak', outcome: 'jadwal memberi kesempatan hadir yang adil', risk: 'satu perwakilan dianggap mewakili seluruh warga' },
  { issue: 'Anda bertugas di daerah baru dan belum memahami tata krama pertemuan warga.', object: 'tata krama pertemuan', check: 'minta penjelasan kebiasaan yang relevan kepada rekan setempat', action: 'Klarifikasi kebiasaan lalu sesuaikan cara berkomunikasi.', owner: 'penghubung komunitas', temporary: 'ikuti bagian pertemuan yang sudah dipahami', outcome: 'komunikasi menghormati kebiasaan dan hak pribadi', risk: 'prasangka menggantikan pemahaman' },
  { issue: 'Rekan dari kelompok minoritas jarang diberi kesempatan mengusulkan gagasan.', object: 'kesempatan diskusi', check: 'dengarkan pengalaman rekan dan amati pembagian giliran', action: 'Buka giliran diskusi yang setara bagi semua anggota.', owner: 'pemimpin diskusi', temporary: 'undang rekan menyampaikan gagasan dengan persetujuannya', outcome: 'gagasan dinilai berdasarkan isi tanpa mengungkap cerita pribadi', risk: 'rekan terdampak kembali dipermalukan' },
  { issue: 'Warga lama dan pendatang berselisih tentang pemakaian fasilitas bersama.', object: 'kesepakatan fasilitas', check: 'petakan kebutuhan dan aturan penggunaan dari kedua pihak', action: 'Fasilitasi kesepakatan penggunaan dengan kedua kelompok.', owner: 'pengelola fasilitas', temporary: 'gunakan jadwal sementara yang telah disepakati', outcome: 'akses kedua kelompok terjaga dengan mekanisme keluhan', risk: 'keputusan sepihak memperbesar perselisihan' },
  { issue: 'Hasil aplikasi pengolah data berbeda dari sampel yang dihitung manual.', object: 'hasil pengolahan', check: 'telusuri sumber data dan rumus pada sampel yang berbeda', action: 'Perbaiki penyebab selisih sebelum memakai hasil aplikasi.', owner: 'pengelola aplikasi', temporary: 'pisahkan hasil belum terverifikasi dari laporan final', outcome: 'hasil dapat direproduksi dari sumber yang benar', risk: 'laporan salah digunakan untuk keputusan' },
  { issue: 'Sistem lama akan dihentikan, tetapi kemampuan memakai penggantinya belum merata.', object: 'rencana migrasi', check: 'petakan langkah yang belum dikuasai dan risiko layanan', action: 'Lakukan latihan terarah sebelum petugas beralih sistem.', owner: 'penanggung jawab migrasi', temporary: 'pakai panduan dan pendampingan pada tugas yang sulit', outcome: 'petugas menyelesaikan tugas tanpa mengganggu layanan', risk: 'migrasi menghentikan layanan penting' },
  { issue: 'Rekan mengirim data warga ke akun pribadi agar mudah dikerjakan dari rumah.', object: 'salinan data warga', check: 'periksa cakupan data dan kebijakan akses yang berlaku', action: 'Amankan salinan melalui kanal resmi dan laporkan insiden.', owner: 'petugas keamanan informasi', temporary: 'hentikan penyebaran salinan lebih lanjut', outcome: 'akses terkendali dan penanganan insiden dapat ditelusuri', risk: 'data pribadi tersebar lebih luas' },
  { issue: 'Penyedia menawarkan hadiah setelah Anda selesai menilai hasil pekerjaannya.', object: 'tawaran hadiah', check: 'periksa hubungan penilaian dengan tawaran hadiah', action: 'Tolak tawaran dan catat melalui mekanisme pelaporan kantor.', owner: 'pengelola kepatuhan', temporary: 'pisahkan komunikasi hadiah dari penilaian pekerjaan', outcome: 'penilaian tetap independen dan tawaran tercatat', risk: 'konflik kepentingan tidak terungkap' },
  { issue: 'Laporan harian terlanjur dikirim dengan satu angka yang salah.', object: 'angka laporan', check: 'cocokkan angka dengan dokumen sumber', action: 'Kirim koreksi tercatat kepada penerima laporan.', owner: 'penanggung jawab laporan', temporary: 'beri tahu penerima agar angka belum digunakan', outcome: 'penerima memakai versi koreksi dan jejak perubahan tersimpan', risk: 'penerima mengambil keputusan dari angka keliru' },
  { issue: 'Pekerjaan berulang terlambat karena satu tahap pemeriksaan menumpuk.', object: 'alur pemeriksaan', check: 'ukur beban dan waktu pada tahap yang menumpuk', action: 'Uji pembagian beban baru pada tahap pemeriksaan.', owner: 'koordinator proses', temporary: 'prioritaskan pekerjaan sesuai tenggat yang disepakati', outcome: 'waktu penyelesaian turun tanpa kehilangan pemeriksaan mutu', risk: 'kecepatan meningkat dengan mengurangi pemeriksaan penting' },
  { issue: 'Dalam diskusi, perbedaan pandangan politik dianggap sebagai bukti radikalisme.', object: 'penilaian perilaku', check: 'bedakan perbedaan pendapat dari ajakan kekerasan atau diskriminasi', action: 'Kembalikan diskusi pada perilaku dan bukti yang relevan.', owner: 'fasilitator dialog', temporary: 'ingatkan peserta agar tidak memberi label pada identitas', outcome: 'perbedaan pendapat aman dan perilaku berisiko ditangani', risk: 'pelabelan tanpa bukti merusak hak seseorang' },
  { issue: 'Tangkapan layar diduga memuat ajakan kekerasan dari seorang rekan.', object: 'tangkapan layar', check: 'periksa konteks dan keaslian tanpa menyebarkan ulang', action: 'Simpan bukti secara aman dan gunakan kanal pelaporan.', owner: 'penanggung jawab keamanan', temporary: 'batasi akses bukti pada pihak yang berhak', outcome: 'dugaan dinilai dari bukti tanpa tuduhan publik', risk: 'tuduhan atau konten kekerasan tersebar' },
  { issue: 'Materi kegiatan kantor menyertakan pesan yang merendahkan kelompok tertentu.', object: 'materi kegiatan', check: 'identifikasi bagian yang merendahkan dan tujuan kegiatan', action: 'Ganti bagian diskriminatif sebelum materi digunakan.', owner: 'penanggung jawab kegiatan', temporary: 'tahan distribusi bagian yang bermasalah', outcome: 'kegiatan berjalan dengan materi yang menghormati peserta', risk: 'pesan diskriminatif dinormalisasi' },
  { issue: 'Grup kerja membagikan tautan yang mendorong kekerasan terhadap kelompok lain.', object: 'tautan berisiko', check: 'periksa isi dan tingkat ancaman tanpa memperluas penyebaran', action: 'Hentikan penyebaran dan laporkan melalui kanal keamanan.', owner: 'penanggung jawab keamanan', temporary: 'ingatkan anggota agar tidak meneruskan tautan', outcome: 'ancaman ditangani pihak berwenang dan bukti terlindungi', risk: 'ancaman meluas atau bukti hilang' },
];

export const tkpCases: BankItem[] = contexts.flatMap((c, index) => [0, 1, 2, 3].map((variant) => {
  const [topic, subtopic] = TKP_SUBTOPICS[index];
  const constraint = [
    'Anda berwenang menjalankan perbaikan ini dan bukti masalah sudah dikonfirmasi. Apa tindakan pertama yang paling tepat?',
    'Penanganan diperlukan hari ini. Anda boleh menyiapkan langkah sementara, tetapi keputusan final menjadi wewenang ' + c.owner + '. Apa yang Anda lakukan?',
    'Dua laporan tentang masalah ini bertentangan. Dokumen pendukung memuat informasi pribadi dan keputusan bergantung pada laporan yang benar. Apa langkah pertama Anda?',
    'Perbaikan pertama telah dilakukan sesuai prosedur, tetapi masalah yang sama kembali muncul tiga kali dalam sebulan. Sebagai koordinator, bagaimana Anda menindaklanjutinya?',
  ][variant];
  const texts = variant === 0 ? [
    c.action,
    'Koordinasikan rencana perbaikan dengan ' + c.owner + ' sebelum mulai bertindak.',
    'Catat masalah pada ' + c.object + ' untuk dibahas dalam evaluasi mingguan.',
    'Selesaikan pekerjaan lain dahulu, lalu ' + c.temporary + '.',
    'Gunakan penyelesaian informal untuk ' + c.object + ' tanpa catatan perubahan.',
  ] : variant === 1 ? [
    'Lakukan langkah sementara: ' + c.temporary + '; minta keputusan ' + c.owner + ' hari ini.',
    'Minta keputusan ' + c.owner + ' hari ini dan jelaskan batas kewenangan kepada pihak terdampak.',
    'Kirim seluruh permintaan kepada ' + c.owner + ' untuk ditangani sesuai antrean rutin.',
    'Tunggu balasan ' + c.owner + ' sebelum memberi informasi tentang ' + c.object + '.',
    'Ambil keputusan final tentang ' + c.object + ' agar tidak melewati batas waktu hari ini.',
  ] : variant === 2 ? [
    'Batasi akses dokumen; ' + c.check + '.',
    'Minta ' + c.owner + ' memeriksa dua laporan melalui kanal resmi sebelum mengambil keputusan.',
    'Kumpulkan penjelasan dari pelapor dan gunakan laporan yang disampaikan lebih awal.',
    'Gunakan laporan terbaru sambil meminta pihak terdampak mengajukan koreksi bila perlu.',
    'Bagikan kedua dokumen di grup terbuka agar anggota menentukan laporan yang benar.',
  ] : [
    'Telusuri penyebab bersama ' + c.owner + '; uji dan pantau perbaikannya.',
    'Minta ' + c.owner + ' menyelidiki pengulangan sambil meneruskan prosedur yang berlaku.',
    'Ulangi perbaikan sebelumnya dan tambahkan pengingat mengenai ' + c.object + '.',
    'Tambah pemeriksaan manual untuk setiap ' + c.object + ' tanpa mengevaluasi beban petugas.',
    'Ganti seluruh prosedur ' + c.object + ' segera agar pengulangan berhenti, lalu evaluasi dampaknya.',
  ];
  const reasons = variant === 0 ? [
    'Kewenangan dan bukti sudah tersedia; tindakan langsung menangani hambatan spesifik.',
    'Koordinasi menjaga keselarasan, tetapi persetujuan tambahan tidak diperlukan dalam situasi ini.',
    'Pencatatan bermanfaat untuk evaluasi, tetapi belum mengatasi masalah yang dapat ditangani sekarang.',
    'Ada bantuan sementara, tetapi prioritas tidak sesuai hambatan yang sudah dikonfirmasi.',
    'Penyelesaian tanpa catatan mengurangi ketertelusuran dan dapat menimbulkan ' + c.risk + '.',
  ] : variant === 1 ? [
    'Menangani urgensi dengan bantuan dalam kewenangan sendiri dan eskalasi yang mempunyai tenggat.',
    'Eskalasi dan komunikasi tepat; bantuan sementara yang diizinkan belum digunakan.',
    'Menggunakan pemegang kewenangan, tetapi antrean rutin tidak menanggapi kebutuhan hari ini.',
    'Menjaga batas keputusan, tetapi menahan informasi memperbesar ketidakpastian pengguna.',
    'Tenggat tidak memberi kewenangan baru; keputusan final tetap melalui ' + c.owner + '.',
  ] : variant === 2 ? [
    'Memulai dari verifikasi yang relevan dan akses terbatas sebelum memilih laporan.',
    'Pemeriksaan resmi dan keamanan dijaga; verifikasi awal yang dapat Anda lakukan belum digunakan.',
    'Klarifikasi ada, tetapi waktu diterimanya laporan bukan bukti kebenaran isinya.',
    'Kebaruan belum membuktikan akurasi; dampak kesalahan dipindahkan ke pihak terdampak.',
    'Forum terbuka mengungkap informasi pribadi dan belum menjamin kompetensi pemeriksa.',
  ] : [
    'Menghubungkan analisis penyebab, uji yang terukur, dan hasil spesifik; menjaga prosedur selama evaluasi.',
    'Penyelidikan mengarah pada akar masalah, tetapi indikator dan pemantauan belum ditetapkan.',
    'Menangani kejadian saat ini, tetapi tidak menguji mengapa perbaikan yang sama terus gagal.',
    'Pemeriksaan tambahan membantu sementara; beban dan penyebab pengulangan belum dinilai.',
    'Perubahan luas tanpa uji atau evaluasi awal dapat menimbulkan risiko baru pada layanan.',
  ];
  const rubric: Rubric = {
    authority: variant === 1 ? 'Keputusan final: ' + c.owner + '; bantuan sementara diperbolehkan.' : variant === 3 ? 'Anda koordinator; perubahan prosedur tetap perlu koordinasi.' : 'Tindakan awal berada dalam kewenangan petugas.',
    urgency: variant === 1 ? 'Hari ini; jangan menunggu antrean rutin.' : 'Tidak ada keadaan darurat yang membenarkan melewati prosedur.',
    efficacy: c.outcome + '.', risk: c.risk + '.', followUp: variant === 3 ? 'Bandingkan frekuensi pengulangan sebelum dan setelah uji perbaikan.' : 'Pastikan hasil tercatat dan diterima pihak terkait.',
  };
  return { id: 'tkp-case-v2-' + index + '-' + variant, subtest: 'TKP', topic, subtopic,
    difficulty: variant === 0 ? 'mudah' : variant === 1 ? 'sedang' : 'sulit', bloom: variant < 2 ? 'C3' : 'C4',
    difficultyReason: variant === 0 ? 'Bukti dan kewenangan jelas; memilih satu tindakan langsung.' : variant === 1 ? 'Memadukan tenggat dan batas kewenangan.' : variant === 2 ? 'Menilai bukti bertentangan sekaligus melindungi akses data.' : 'Mengevaluasi pengulangan dan memilih perbaikan yang dapat diuji.',
    stem: c.issue + ' ' + constraint, options: texts.map((text, i) => ({ text, score: 5 - i, reason: reasons[i] })), answer: 0,
    explanation: reasons[0] + ' Urutan skor mengikuti efektivitas tindakan pada batasan kasus ini; rubrik bukan kunci resmi BKN.', rubric,
    source: 'Kasus orisinal v2; cakupan kompetensi mengacu pada Panduan TKP JadiASN. Skor merupakan rubrik latihan yang perlu kurasi.',
  };
}));
