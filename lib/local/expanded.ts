import { TKP_SOURCE, UUD, type CaseModel, type State } from './schema';

// Each entry is a separate authored dilemma, including its distractors. The second
// state changes the decisive constraint AND the response set, not just a name.
type Choice = [text: string, reason: string];
type Five = [Choice, Choice, Choice, Choice, Choice];
export type Variant = { fact: string; choices: Five; conclusion: string; prompt?: string };
function pair(id:string,subtest:'TWK'|'TKP',topic:string,concept:string,intro:string,tip:string,variants:[Variant,Variant]):CaseModel {
  const states:State[]=variants.map((v,i)=>{
    const choices=i?[v.choices[4],...v.choices.slice(0,4)]:v.choices;
    return {fact:v.fact,difficulty:i?'sulit':'sedang',actions:choices.map(c=>c[0]) as State['actions'],
      scores:(subtest==='TKP'?(i?[1,5,4,3,2]:[5,4,3,2,1]):(i?[0,5,0,0,0]:[5,0,0,0,0])) as State['scores'],
      reasons:choices.map(c=>c[1]) as State['reasons'],conclusion:v.conclusion,prompt:v.prompt};
  });
  return {id,subtest,topic,chapter:subtest==='TWK'?'SKD_'+topic:topic,concept,
    source:subtest==='TKP'?TKP_SOURCE:UUD,contexts:[{intro}],actions:states[0].actions!,states,
    prompt:subtest==='TKP'?'Respons yang paling tepat dalam situasi ini adalah ...':'Penilaian yang paling tepat terhadap kasus tersebut adalah ...',tip};
}
const twk=(id:string,topic:string,concept:string,intro:string,tip:string,v:[Variant,Variant])=>pair(id,'TWK',topic,concept,intro,tip,v);
const tkp=(id:string,topic:string,concept:string,intro:string,tip:string,v:[Variant,Variant])=>pair(id,'TKP',topic,concept,intro,tip,v);
export function singleTkp(id:string,topic:string,concept:string,intro:string,tip:string,v:Variant):CaseModel {
  const model=tkp(id,topic,concept,intro,tip,[v,v]);
  model.states=model.states.slice(0,1);return model;
}

export const EXTRA_TWK:CaseModel[]=[
twk('nas-produk','Nasionalisme','Kepentingan nasional dinilai dari manfaat nyata dan peningkatan kemampuan bersama.','Sebuah koperasi memilih peralatan pengolahan hasil panen.','Bedakan keberpihakan yang beralasan dari simbol asal produk.',[
 {fact:'Dua penawaran memenuhi standar keselamatan dan kapasitas yang sama. Produk dalam negeri memiliki biaya perawatan lebih rendah serta layanan teknisi setempat; produk impor hanya unggul pada popularitas merek.',prompt:'Alasan yang paling mencerminkan nasionalisme dalam pemilihan tersebut adalah ...',choices:[
 ['Memilih produk dalam negeri karena manfaat usaha dan dukungan terhadap kemampuan produksi lokal saling menguatkan.','Pilihan didukung mutu yang setara, manfaat pengguna, dan pengembangan kemampuan domestik.'],
 ['Memilih produk dalam negeri karena asal barang sudah cukup untuk menjamin seluruh aspek mutunya.','Kesimpulan mutu harus mengikuti pemeriksaan, bukan semata asal barang.'],
 ['Memilih produk impor agar koperasi diakui mengikuti perkembangan dunia.','Popularitas tidak mengatasi keunggulan manfaat yang dibuktikan dalam kasus.'],
 ['Membeli keduanya dengan jumlah sama agar tidak tampak memihak negara tertentu.','Keseimbangan asal bukan tujuan pengadaan peralatan koperasi.'],
 ['Menunda pembelian sampai semua komponen produk lokal dibuat di dalam negeri.','Syarat baru ini tidak diperlukan oleh kebutuhan dan standar dalam kasus.']],conclusion:'Keberpihakan memiliki dasar substantif ketika kualitas, kebutuhan, dan pengembangan kemampuan domestik sejalan.'},
 {fact:'Kini hanya mesin impor yang lolos standar keselamatan untuk proses yang dibutuhkan. Produsen lokal bersedia mengembangkan mesin setara, tetapi baru dapat mengujinya tahun depan. Koperasi harus beroperasi bulan depan.',choices:[
 ['Menggunakan mesin yang memenuhi keselamatan sambil membuka kerja sama pengembangan dengan produsen lokal.','Kebutuhan saat ini terlindungi sekaligus membuka peningkatan kemampuan domestik.'],
 ['Tetap menggunakan mesin lokal karena pengorbanan keselamatan menunjukkan keberpihakan pada bangsa.','Keselamatan anggota bukan pengorbanan yang dibenarkan oleh asal produk.'],
 ['Menghentikan seluruh hubungan dengan produsen lokal karena belum mampu memenuhi satu kebutuhan.','Kekurangan saat ini tidak meniadakan peluang pengembangan kemampuan.'],
 ['Menghapus standar keselamatan sementara agar produk lokal dapat dinyatakan setara.','Mengubah tolok ukur demi hasil tertentu mengabaikan kepentingan pengguna.'],
 ['Mengiklankan mesin impor sebagai produk lokal agar dukungan anggota tetap tinggi.','Penyamaran asal barang merusak kejujuran dan tidak membangun kemampuan lokal.']],conclusion:'Nasionalisme tidak menuntut pengabaian keselamatan; pengembangan kemampuan dapat berjalan bersama pemenuhan kebutuhan yang nyata.'}
]),
twk('nas-batas-wilayah','Nasionalisme','Solidaritas kebangsaan melampaui batas administratif, dengan tanggung jawab yang tetap jelas.','Dua kabupaten bertetangga menghadapi kerusakan jalur distribusi pangan.','Batas pengelolaan tidak menghapus kepentingan bersama.',[
 {fact:'Gudang di kabupaten pertama memiliki persediaan berlebih. Kabupaten kedua mengalami kekurangan sementara. Mekanisme peminjaman antardaerah tersedia dan tidak mengurangi persediaan minimum warga kabupaten pertama.',choices:[
 ['Mendukung peminjaman melalui mekanisme yang tersedia karena keselamatan warga lintas daerah merupakan kepentingan bersama.','Solidaritas dapat diwujudkan tanpa mengabaikan kebutuhan minimum dan pertanggungjawaban.'],
 ['Menolak seluruh peminjaman karena kewajiban kebangsaan berakhir pada batas kabupaten.','Batas administrasi bukan batas solidaritas sebagai satu bangsa.'],
 ['Menyerahkan seluruh persediaan tanpa pencatatan agar bantuan tampak lebih tulus.','Jumlah dan pencatatan tetap harus mempertimbangkan kebutuhan serta tanggung jawab.'],
 ['Meminjamkan hanya jika nama kabupaten pertama dicantumkan pada setiap paket.','Promosi daerah bukan dasar utama pemenuhan kebutuhan mendesak.'],
 ['Meminta warga kabupaten kedua pindah domisili sebelum memperoleh bantuan.','Syarat domisili baru menghalangi tujuan bantuan lintas daerah.']],conclusion:'Persatuan tampak pada kesediaan menanggung masalah bersama melalui cara yang terukur.'},
 {fact:'Persediaan kedua kabupaten kini sama-sama hanya cukup untuk kebutuhan minimum. Bantuan provinsi dapat diminta melalui usulan gabungan berbasis data kebutuhan.',choices:[
 ['Menyusun kebutuhan gabungan dan mengajukan dukungan provinsi dengan prioritas penerima yang transparan.','Kerja sama menambah peluang pemenuhan tanpa memindahkan kekurangan ke daerah lain.'],
 ['Memaksa kabupaten pertama melepas persediaan minimum sebagai bukti persaudaraan.','Solidaritas tidak mensyaratkan menciptakan kekurangan yang sama pada warga lain.'],
 ['Membesar-besarkan angka kebutuhan daerah sendiri agar mendapat bantuan lebih dahulu.','Klaim yang tidak benar mengganggu pembagian bagi kepentingan bersama.'],
 ['Membatasi informasi kebutuhan agar daerah tetangga tidak menjadi pesaing.','Persaingan informasi bertentangan dengan mekanisme bersama yang tersedia.'],
 ['Mengalihkan tanggung jawab sepenuhnya kepada provinsi tanpa menyusun data.','Pengajuan bersama memerlukan kontribusi informasi dari kedua daerah.']],conclusion:'Ketika keduanya kekurangan, solidaritas beralih dari transfer persediaan ke pengupayaan dukungan bersama.'}
]),
twk('nas-ingatan','Nasionalisme','Penghargaan atas perjuangan bersama tidak didasarkan pada dominasi kelompok.','Tim museum menyusun pameran sejarah perjuangan di daerahnya.','Periksa apakah narasi tetap setia pada bukti dan mencakup kontribusi yang relevan.',[
 {fact:'Arsip yang telah diverifikasi menunjukkan peran kelompok pendatang dan warga setempat. Sponsor meminta hanya tokoh kelompok mayoritas ditampilkan agar pameran lebih mudah dipromosikan.',choices:[
 ['Menampilkan kontribusi kedua kelompok sesuai bukti untuk memperlihatkan terbentuknya perjuangan bersama.','Narasi kebangsaan yang inklusif tetap bertumpu pada bukti sejarah.'],
 ['Membagi jumlah tokoh secara sama tanpa mempertimbangkan kelengkapan bukti.','Keterwakilan tidak membenarkan penyamaan yang tidak didukung bukti.'],
 ['Mengikuti sponsor karena pembiayaan memberinya hak menentukan kebenaran sejarah.','Sumber dana tidak menentukan kebenaran fakta.'],
 ['Menghapus asal seluruh tokoh sekalipun relevan untuk memahami kerja sama mereka.','Penghapusan konteks dapat menghilangkan makna persatuan lintas kelompok.'],
 ['Membatalkan pameran karena keberagaman pelaku pasti menimbulkan perselisihan.','Perbedaan pelaku tidak dengan sendirinya menghalangi penyajian berbasis bukti.']],conclusion:'Narasi bersama terbentuk melalui pengakuan kontribusi yang dapat dibuktikan, bukan pengutamaan identitas mayoritas.'},
 {fact:'Sebuah cerita kepahlawanan yang populer belum memiliki arsip pendukung. Tim menemukan sumber berbeda yang bertentangan, sedangkan kontribusi tokoh lain sudah terverifikasi.',choices:[
 ['Membedakan fakta terverifikasi dari cerita yang masih diteliti serta menjelaskan batas bukti kepada pengunjung.','Kejujuran sejarah memungkinkan penghargaan tanpa mengubah dugaan menjadi kepastian.'],
 ['Menyatakan cerita populer sebagai fakta karena isinya membangkitkan kebanggaan.','Manfaat emosional tidak menggantikan dukungan bukti.'],
 ['Menyimpulkan tokoh tersebut tidak pernah ada karena arsipnya belum lengkap.','Ketiadaan bukti memadai belum membuktikan tokoh tidak pernah ada.'],
 ['Menggabungkan semua versi menjadi cerita tunggal tanpa menyebut perbedaannya.','Penggabungan menyembunyikan pertentangan sumber yang relevan.'],
 ['Menghapus semua materi perjuangan sampai setiap cerita telah disepakati.','Ketidakpastian sebagian cerita tidak membatalkan fakta lain yang telah terverifikasi.']],conclusion:'Kecintaan pada bangsa perlu berjalan bersama kejujuran tentang apa yang sudah dan belum diketahui.'}
]),
twk('int-target','Integritas','Akuntabilitas menghubungkan indikator dengan keadaan yang benar-benar terjadi.','Tim layanan mengevaluasi pencapaian target bulanan.','Bedakan perbaikan indikator dari manipulasi hasil.',[
 {fact:'Target mengukur permohonan yang selesai. Beberapa berkas baru diterima, tetapi koordinator meminta semuanya ditandai selesai agar target tercapai.',choices:[
 ['Mencatat status aktual dan menjelaskan hambatan penyelesaian beserta rencana perbaikannya.','Pelaporan tetap benar sekaligus menunjukkan tanggung jawab atas kekurangan.'],
 ['Menghitung berkas masuk sebagai selesai karena keduanya menunjukkan tim sudah bekerja.','Penerimaan dan penyelesaian adalah tahap berbeda menurut indikator kasus.'],
 ['Menandai selesai sekarang lalu menyelesaikan pekerjaan pada bulan berikutnya.','Rencana kerja mendatang tidak mengubah status aktual saat pelaporan.'],
 ['Menghapus berkas belum selesai dari daftar permohonan agar persentase naik.','Penghapusan data menyembunyikan beban yang seharusnya dipertanggungjawabkan.'],
 ['Membiarkan kolom status kosong tanpa penjelasan agar tidak perlu menyatakan kegagalan.','Informasi yang sengaja tidak lengkap menghindari pertanggungjawaban.']],conclusion:'Kejujuran ukuran kinerja mengharuskan pembedaan antara pekerjaan dimulai dan pekerjaan selesai.'},
 {fact:'Indikator lama hanya menghitung jumlah berkas, sehingga satu permohonan kompleks dinilai sama dengan satu permohonan sederhana. Tim boleh mengusulkan indikator baru untuk periode mendatang; angka periode berjalan sudah diaudit.',choices:[
 ['Mempertahankan hasil audit periode ini dan mengusulkan bobot kompleksitas untuk periode mendatang dengan dasar yang terbuka.','Perbaikan ukuran dilakukan prospektif dan tidak mengubah hasil agar menguntungkan tim.'],
 ['Mengganti bobot periode lalu sampai capaian terlihat memenuhi target.','Pengubahan setelah hasil diketahui berpotensi merekayasa penilaian.'],
 ['Menolak evaluasi indikator karena perubahan apa pun merupakan ketidakjujuran.','Perbaikan yang transparan dan berlaku ke depan dapat meningkatkan ketepatan ukuran.'],
 ['Memilih sendiri bobot baru tanpa membahas definisi kompleksitas.','Bobot tanpa dasar bersama sulit dipertanggungjawabkan.'],
 ['Menghilangkan permohonan kompleks agar perhitungan indikator lebih sederhana.','Kesederhanaan perhitungan tidak membenarkan menghapus pekerjaan nyata.']],conclusion:'Integritas juga mencakup keberanian memperbaiki ukuran yang keliru melalui proses yang tidak menguntungkan diri secara surut.'}
]),
twk('int-kredit-karya','Integritas','Pengakuan kontribusi dan kepemilikan karya harus sesuai kenyataan.','Sebuah tim menyiapkan presentasi inovasi layanan.','Uji kejujuran atribusi, bukan hanya siapa yang membawakan presentasi.',[
 {fact:'Analisis dibuat oleh anggota baru, sedangkan ketua merapikan slide dan akan menjadi pembicara. Draf mencantumkan ketua sebagai pembuat seluruh analisis.',choices:[
 ['Mencantumkan pembuat analisis dan penyunting sesuai kontribusinya, dengan ketua tetap sebagai pembicara.','Peran presentasi dapat dibedakan dari kepengarangan tanpa mengurangi kerja sama.'],
 ['Menganggap seluruh analisis milik ketua karena ia bertanggung jawab atas tim.','Tanggung jawab kepemimpinan tidak menghapus kontribusi intelektual anggota.'],
 ['Menghapus seluruh nama agar ketidakakuratan atribusi tidak terlihat.','Menghilangkan pengakuan bukan koreksi yang tepat ketika kontribusi diketahui.'],
 ['Menyerahkan seluruh kredit kepada anggota baru sehingga penyuntingan tidak perlu disebut.','Pengakuan yang benar tetap mencakup kontribusi relevan anggota lain.'],
 ['Membiarkan atribusi draf karena anggota baru belum menyampaikan keberatan.','Diamnya pihak yang dirugikan tidak membuat atribusi menjadi benar.']],conclusion:'Kejujuran pengakuan tidak bergantung pada jabatan ataupun ada tidaknya protes.'},
 {fact:'Tim memakai diagram berlisensi terbuka yang mengizinkan adaptasi dengan pencantuman sumber. Warna dan susunan diagram telah diubah; struktur gagasannya tetap digunakan.',choices:[
 ['Menyebut sumber serta menjelaskan adaptasi yang dibuat sesuai syarat lisensinya.','Perubahan tampilan tidak menghapus kewajiban atribusi yang dinyatakan.'],
 ['Mengaku sebagai pembuat asli karena diagram sudah berbeda warna.','Perbedaan kosmetik tidak mengubah asal struktur gagasan.'],
 ['Menyebut sumber hanya jika pembuat aslinya menghubungi tim.','Syarat penggunaan berlaku sejak pemakaian, bukan setelah ada keberatan.'],
 ['Tidak menggunakan diagram apa pun karena karya terbuka tidak boleh diadaptasi.','Kasus secara tegas mengizinkan adaptasi dengan syarat tertentu.'],
 ['Mencantumkan nama situs pencarian sebagai pengganti sumber diagram.','Situs pencarian bukan identitas sumber karya yang digunakan.']],conclusion:'Pemanfaatan karya yang sah tetap memerlukan kejujuran tentang asal serta perubahan yang dilakukan.'}
]),
twk('int-kesalahan-sendiri','Integritas','Tanggung jawab pribadi mencakup pengungkapan kesalahan dan pemulihan akibatnya.','Petugas menemukan kekeliruan dalam informasi jadwal yang ia kirimkan.','Perbaikan harus menjangkau pihak yang sudah terdampak.',[
 {fact:'Jadwal salah telah diterima peserta dan dua orang sudah memesan perjalanan. Jadwal yang benar tersedia dan petugas dapat segera menghubungi penerima.',choices:[
 ['Mengakui kekeliruan, mengirim koreksi kepada semua penerima, dan membantu penanganan dampak sesuai kewenangannya.','Pengungkapan dan pemulihan menjangkau akibat nyata, bukan sekadar memperbaiki berkas.'],
 ['Mengganti berkas pada penyimpanan tanpa menghubungi penerima lama.','Penerima lama masih dapat bertindak berdasarkan informasi salah.'],
 ['Menjelaskan bahwa peserta seharusnya memeriksa ulang sebelum memesan perjalanan.','Pernyataan itu mengalihkan tanggung jawab atas informasi yang dikirim petugas.'],
 ['Menunggu peserta menemukan kesalahan agar koreksi hanya dikirim kepada yang bertanya.','Penundaan memperluas potensi kerugian yang dapat dicegah.'],
 ['Mengubah tanggal kirim pesan lama agar seolah-olah koreksi sudah disampaikan.','Rekayasa jejak komunikasi merupakan ketidakjujuran baru.']],conclusion:'Tanggung jawab bukan hanya mengakui niat baik, tetapi mencegah dan memperbaiki akibat kesalahan.'},
 {fact:'Setelah diperiksa, jadwal yang dikirim petugas benar pada saat pengiriman. Panitia kemudian mengubahnya tanpa pemberitahuan. Peserta mengira petugas lalai.',choices:[
 ['Menjelaskan kronologi berdasarkan bukti sambil menyampaikan jadwal terbaru dan mengupayakan pemberitahuan yang lebih baik.','Kejujuran tidak mengharuskan mengakui kesalahan yang tidak terjadi; layanan tetap perlu diperbaiki.'],
 ['Mengaku sengaja mengirim jadwal salah agar peserta berhenti memperdebatkan panitia.','Pengakuan yang tidak benar mengaburkan sumber masalah dan tindak lanjut.'],
 ['Menolak membantu karena kesalahan bukan berasal dari petugas.','Kebenaran kronologi tidak menghapus kebutuhan membantu peserta memperoleh informasi.'],
 ['Menyalahkan panitia di ruang publik tanpa menunjukkan kronologi.','Tuduhan tidak menggantikan penjelasan berbukti dan penanganan dampak.'],
 ['Menghapus seluruh riwayat pesan agar tidak ada pihak yang dipersalahkan.','Penghapusan jejak menghambat penelusuran serta perbaikan komunikasi.']],conclusion:'Integritas menuntut kronologi yang benar serta perbaikan layanan, bukan pengambilan atau pengalihan kesalahan secara palsu.'}
]),
twk('bela-ketahanan-pangan','Bela Negara','Ketahanan masyarakat dapat diperkuat melalui kontribusi sipil yang terkoordinasi.','Kelompok warga menyiapkan cadangan pangan untuk menghadapi gangguan distribusi.','Kontribusi bela negara dapat berbentuk kemampuan sipil yang berguna.',[
 {fact:'Seorang ahli penyimpanan pangan menawarkan pelatihan untuk mengurangi kerusakan stok. Pengurus menilai kegiatan itu bukan bela negara karena tidak melibatkan latihan fisik.',choices:[
 ['Penilaian pengurus terlalu sempit karena keahlian sipil dapat memperkuat ketahanan dan keselamatan masyarakat.','Kontribusi sesuai keahlian berhubungan langsung dengan kemampuan menghadapi gangguan.'],
 ['Penilaian pengurus tepat karena hanya kegiatan berseragam yang menunjukkan kesiapan membela negara.','Bentuk pakaian tidak menentukan manfaat kontribusi bagi ketahanan bersama.'],
 ['Pelatihan termasuk bela negara hanya jika menghasilkan keuntungan pribadi yang tinggi.','Keuntungan pribadi bukan syarat kontribusi terhadap kepentingan bersama.'],
 ['Pelatihan cukup menggantikan seluruh kebutuhan koordinasi distribusi.','Satu jenis keahlian tidak menggantikan seluruh tugas yang berbeda.'],
 ['Kegiatan warga tidak relevan karena ketahanan pangan sepenuhnya urusan pemerintah.','Partisipasi sipil dapat melengkapi pengelolaan publik sesuai kapasitasnya.']],conclusion:'Bela negara juga diwujudkan melalui kemampuan yang menjaga keberlangsungan kehidupan bersama.'},
 {fact:'Sebagian warga mengusulkan membeli seluruh pangan di pasar untuk disimpan kelompoknya. Data menunjukkan pasokan masih cukup jika pembelian dilakukan sesuai kebutuhan normal.',choices:[
 ['Menyusun cadangan secara bertahap berdasarkan kebutuhan sambil menjaga akses pangan bagi warga lain.','Kesiapsiagaan harus memperkuat ketahanan bersama, bukan menciptakan kelangkaan buatan.'],
 ['Memborong sebanyak mungkin karena kepentingan kelompok selalu mendahului masyarakat lain.','Pemborongan yang tidak sesuai kebutuhan dapat merugikan ketahanan kelompok lain.'],
 ['Menghentikan seluruh upaya cadangan karena pasar belum mengalami kekurangan.','Kesiapsiagaan yang terukur tetap dapat dilakukan sebelum gangguan terjadi.'],
 ['Menyebarkan kabar kelangkaan agar masyarakat segera mengikuti pembelian kelompok.','Kabar yang tidak didukung data menciptakan kepanikan.'],
 ['Menyembunyikan stok dan menjualnya kembali ketika harga naik.','Tujuan keuntungan dari kelangkaan bertentangan dengan perlindungan kebutuhan bersama.']],conclusion:'Kesiapsiagaan dibatasi tanggung jawab menjaga akses dan ketahanan masyarakat secara keseluruhan.'}
]),
twk('bela-ruang-digital','Bela Negara','Perlindungan kepentingan bersama mencakup perilaku bertanggung jawab di ruang digital.','Relawan menemukan daftar warga penerima bantuan tersebar pada forum umum.','Bedakan melaporkan risiko dari memperluas penyebaran data.',[
 {fact:'Daftar memuat identitas lengkap dan kontak pribadi. Relawan ingin memperingatkan pengelola, tetapi tidak diberi kewenangan mengakses sistem instansi.',choices:[
 ['Melaporkan lokasi temuan melalui kanal resmi dengan bukti seperlunya tanpa menyebarkan ulang identitas warga.','Risiko dapat dilaporkan tanpa memperluas paparan atau memasuki sistem tanpa kewenangan.'],
 ['Membagikan ulang daftar lengkap agar sebanyak mungkin warga ikut memeriksa.','Peringatan dengan data lengkap justru memperluas paparan.'],
 ['Mencoba masuk ke akun pengelola untuk menghapus daftar sendiri.','Tujuan baik tidak memberi kewenangan mengakses akun pihak lain.'],
 ['Mengabaikan temuan karena ancaman digital tidak berkaitan dengan keselamatan masyarakat.','Paparan data dapat merugikan warga sehingga layak ditangani.'],
 ['Menawarkan daftar kepada pengiklan untuk mendanai kegiatan relawan.','Pemanfaatan tanpa hak memperbesar kerugian warga.']],conclusion:'Kontribusi warga dapat berupa pelaporan yang tepat dan pengendalian penyebaran informasi sensitif.'},
 {fact:'Pengelola telah menutup akses daftar. Beredar ajakan menyerang akun orang yang diduga mengunggahnya, padahal identitas pelaku belum diverifikasi.',choices:[
 ['Mendukung penelusuran resmi dan menolak penyerangan terhadap pihak yang belum terbukti bertanggung jawab.','Pemulihan keamanan perlu disertai tanggung jawab berbasis bukti.'],
 ['Mengikuti serangan sebagai bentuk keberanian melindungi negara.','Serangan tanpa bukti menciptakan kerugian baru dan tidak membantu pemulihan.'],
 ['Menganggap penutupan akses menghapus kebutuhan mengevaluasi penyebab kebocoran.','Penutupan akses belum menjelaskan sebab dan pencegahan berulang.'],
 ['Menyebarkan identitas terduga agar ia menjelaskan sendiri kepada masyarakat.','Paparan dan tekanan publik mendahului pembuktian.'],
 ['Menolak seluruh pelaporan warga berikutnya agar tidak menimbulkan keributan.','Pelaporan yang bertanggung jawab tetap membantu perlindungan masyarakat.']],conclusion:'Ketahanan digital membutuhkan perbaikan sistem dan penelusuran berbukti, bukan tindakan balasan tanpa dasar.'}
]),
twk('bela-kesiapsiagaan','Bela Negara','Kesiapsiagaan berarti menjalankan peran yang berguna dengan mempertimbangkan keselamatan.','Warga mengikuti simulasi penanganan gangguan fasilitas umum.','Utamakan kontribusi terkoordinasi daripada tindakan yang sekadar tampak berani.',[
 {fact:'Seorang peserta belum terlatih ingin masuk ke bangunan yang telah dinyatakan berbahaya. Koordinator menyediakan tugas pencatatan warga di zona aman.',choices:[
 ['Menerima tugas pencatatan di zona aman karena data warga membantu penanganan tanpa menambah korban.','Tugas pendukung berkontribusi nyata sesuai kemampuan dan batas keselamatan.'],
 ['Masuk ke bangunan agar keberanian pribadi dapat dicontoh peserta lain.','Keberanian yang mengabaikan keselamatan dapat menambah kebutuhan pertolongan.'],
 ['Meninggalkan lokasi karena tugas pencatatan tidak berkaitan dengan bela negara.','Tugas pendukung turut menjaga keselamatan dan koordinasi.'],
 ['Mengambil alih keputusan teknis koordinator karena semua warga memiliki hak yang sama.','Kesetaraan warga tidak berarti kesamaan kompetensi dan penugasan teknis.'],
 ['Mengajak peserta lain masuk bersama agar risiko terbagi.','Penambahan orang yang tidak terlatih memperluas risiko, bukan menguranginya.']],conclusion:'Kerelaan berkontribusi dinilai dari manfaat dan tanggung jawabnya, bukan besarnya risiko yang sengaja diambil.'},
 {fact:'Sesudah simulasi, jalur yang ditetapkan ternyata tidak dapat dilalui pengguna kursi roda. Pengurus ingin tetap memakai jalur itu karena sebagian besar peserta berhasil melewatinya.',choices:[
 ['Mengevaluasi jalur dan menyiapkan akses serta bantuan yang mencakup warga dengan kebutuhan berbeda.','Kesiapsiagaan harus memperhitungkan keselamatan seluruh kelompok warga.'],
 ['Menganggap simulasi berhasil penuh karena mayoritas peserta dapat keluar.','Keberhasilan mayoritas tidak menghilangkan hambatan kelompok lain.'],
 ['Melarang pengguna kursi roda mengikuti kegiatan agar proses lebih cepat.','Pengecualian menghindari masalah alih-alih memperbaiki perlindungan.'],
 ['Menyerahkan kebutuhan akses sepenuhnya kepada keluarga masing-masing.','Pengelolaan jalur bersama tetap perlu mengakomodasi kebutuhan yang diketahui.'],
 ['Membatalkan seluruh simulasi mendatang karena tidak ada jalur yang sempurna.','Temuan kekurangan dapat digunakan untuk perbaikan, bukan alasan berhenti menyiapkan diri.']],conclusion:'Kepentingan bersama mencakup warga yang menghadapi hambatan, termasuk ketika jumlahnya lebih sedikit.'}
]),
twk('pilar-musyarawah','Pilar Negara','Musyawarah memperhatikan alasan dan dampak, bukan sekadar menghitung dukungan.','Forum warga memilih lokasi ruang kegiatan bersama.','Periksa kesempatan berpendapat dan kelayakan alasan sebelum keputusan.',[
 {fact:'Mayoritas mendukung lokasi termurah, tetapi seorang warga menunjukkan bahwa lokasi itu tidak dapat diakses sebagian pengguna. Alternatif yang dapat diakses masih berada dalam anggaran.',choices:[
 ['Membahas keberatan berbukti serta membandingkan alternatif sebelum menetapkan pilihan.','Musyawarah mempertimbangkan dampak terhadap peserta, termasuk kelompok yang lebih sedikit.'],
 ['Mengakhiri pembahasan karena jumlah suara sudah menentukan seluruh kebenaran alasan.','Dukungan mayoritas tidak menghapus fakta relevan tentang akses.'],
 ['Memberikan hak keputusan tunggal kepada warga yang keberatan.','Mendengar keberatan tidak berarti mengalihkan seluruh kewenangan kepada satu orang.'],
 ['Meniadakan ruang kegiatan karena terdapat perbedaan pendapat.','Perbedaan dapat diproses melalui pembahasan alternatif yang tersedia.'],
 ['Menyembunyikan informasi akses agar keputusan dapat segera disahkan.','Penyembunyian menghambat keputusan yang bertanggung jawab.']],conclusion:'Keputusan bersama yang baik memproses keberatan yang relevan, tidak hanya mengandalkan jumlah pendukung.'},
 {fact:'Seluruh alternatif dan keberatan telah dibahas terbuka. Tata tertib yang disepakati mengizinkan pemungutan suara setelah mufakat tidak tercapai. Tidak ada hak dasar yang dilanggar oleh alternatif tersisa.',choices:[
 ['Melaksanakan pemungutan suara sesuai tata tertib dan mencatat alasan serta hasilnya.','Ketika pembahasan memadai dan aturan tersedia, keputusan dapat ditetapkan secara bertanggung jawab.'],
 ['Memaksa peserta yang berbeda pendapat mencabut pendapat agar hasil disebut mufakat.','Mufakat yang dibentuk dengan paksaan menghilangkan kebebasan berpendapat.'],
 ['Menunda tanpa batas karena musyawarah tidak pernah boleh diakhiri dengan suara terbanyak.','Kasus menyatakan prosedur pemungutan suara telah disepakati setelah upaya mufakat.'],
 ['Meminta ketua memilih di luar alternatif karena jabatan memberinya hak tanpa batas.','Kewenangan ketua tetap dibatasi proses dan aturan yang disepakati.'],
 ['Mengulang pemungutan suara sampai menghasilkan pilihan ketua.','Pengulangan untuk memaksakan hasil merusak kejujuran prosedur.']],conclusion:'Musyawarah mengutamakan pembahasan; mekanisme keputusan yang disepakati dapat digunakan ketika mufakat belum tercapai.'}
]),
twk('pilar-persamaan','Pilar Negara','Kesetaraan perlakuan mempertimbangkan hambatan relevan tanpa memberikan keistimewaan berdasarkan status.','Loket layanan mengatur antrean warga.','Bedakan penyesuaian akses dari perlakuan istimewa karena kedudukan.',[
 {fact:'Seorang warga yang kesulitan berdiri lama memperoleh fasilitas duduk dan bantuan pengisian. Persyaratan substantif permohonannya tetap sama dengan pemohon lain.',choices:[
 ['Penyesuaian tersebut mendukung kesetaraan akses tanpa menghapus persyaratan substantif.','Bantuan mengatasi hambatan menggunakan layanan, bukan memberikan kelulusan istimewa.'],
 ['Penyesuaian selalu melanggar persamaan karena semua proses harus identik.','Proses identik dapat membiarkan hambatan yang berbeda tanpa penanganan.'],
 ['Bantuan akses mengharuskan permohonan otomatis disetujui.','Akomodasi akses tidak menentukan pemenuhan syarat substantif.'],
 ['Pemohon lain kehilangan hak karena seorang warga menggunakan kursi tambahan.','Tidak ada fakta bahwa bantuan tersebut menghilangkan hak pemohon lain.'],
 ['Pelayanan hanya adil jika seluruh warga diwajibkan memakai bentuk bantuan yang sama.','Bantuan seharusnya sesuai kebutuhan, bukan dipaksakan kepada semua orang.']],conclusion:'Kesetaraan bukan penyeragaman seluruh cara pelayanan; hambatan akses dapat ditangani sambil menjaga persyaratan yang sama.'},
 {fact:'Seorang pejabat meminta kerabatnya didahulukan tanpa kebutuhan mendesak atau hambatan akses. Aturan antrean yang berlaku tidak menyediakan pengecualian berdasarkan hubungan pribadi.',choices:[
 ['Menerapkan antrean biasa karena hubungan pribadi bukan dasar pengecualian yang relevan.','Kesetaraan menolak keuntungan yang semata-mata berasal dari kedudukan atau kedekatan.'],
 ['Mendahulukan kerabat pejabat agar kerja sama antarlembaga tetap lancar.','Tujuan menjaga hubungan tidak mengubah dasar antrean yang dinyatakan.'],
 ['Memperlambat permohonannya sebagai hukuman atas permintaan pejabat.','Menolak keistimewaan tidak membenarkan perlakuan merugikan di luar aturan.'],
 ['Meminta pemohon lain menyetujui keistimewaan tanpa menjelaskan alasannya.','Tekanan sosial tidak menjadikan kedekatan pribadi dasar layanan yang setara.'],
 ['Menutup loket agar semua pemohon mengalami keterlambatan yang sama.','Kerugian merata bukan pemenuhan kesetaraan pelayanan.']],conclusion:'Perbedaan berdasarkan kebutuhan akses dapat dibenarkan; keistimewaan berdasarkan kedekatan pribadi tidak memiliki dasar pada kasus ini.'}
]),
twk('pilar-keputusan','Pilar Negara','Pembatasan kewenangan dan pengawasan menjaga keputusan tetap dapat dipertanggungjawabkan.','Sebuah lembaga menguji prosedur pelayanan baru.','Nilai manfaat keputusan bersama batas kewenangan dan ruang koreksinya.',[
 {fact:'Pimpinan mengusulkan penghapusan mekanisme keberatan agar keputusan lebih cepat. Mekanisme itu selama ini memungkinkan pemohon memperbaiki kekeliruan data yang memengaruhi hasil.',choices:[
 ['Kecepatan perlu diperbaiki tanpa menghilangkan saluran koreksi atas keputusan yang keliru.','Efisiensi tidak cukup menjadi alasan menghapus pertanggungjawaban dan peluang koreksi.'],
 ['Penghapusan tepat karena keputusan pimpinan selalu mewakili kebenaran data.','Jabatan tidak menjamin keputusan bebas dari kesalahan.'],
 ['Semua keputusan harus dibatalkan apabila satu pemohon mengajukan keberatan.','Keberatan harus diperiksa, bukan otomatis membatalkan seluruh keputusan.'],
 ['Pengawasan hanya diperlukan jika pimpinan berasal dari luar daerah.','Asal pimpinan tidak menentukan perlunya pertanggungjawaban.'],
 ['Pemohon sebaiknya menyampaikan keberatan hanya melalui tekanan di media sosial.','Saluran koreksi yang teratur tetap diperlukan untuk pemeriksaan yang jelas.']],conclusion:'Keputusan yang cepat tetap perlu dapat diperiksa dan diperbaiki ketika dasar faktanya keliru.'},
 {fact:'Hasil uji coba memperlihatkan sebagian keberatan sebenarnya hanya permintaan informasi. Tim menawarkan jalur penjelasan cepat, sementara keberatan substantif tetap diperiksa oleh petugas berbeda.',choices:[
 ['Pemisahan jalur dapat mempercepat respons sambil mempertahankan pemeriksaan atas keberatan substantif.','Perbaikan alur menjaga fungsi pengawasan serta menyesuaikan kebutuhan tiap permohonan.'],
 ['Semua jalur harus tetap sama karena penyesuaian alur pasti mengurangi hak warga.','Perubahan alur tidak otomatis mengurangi hak jika fungsi substantifnya dijaga.'],
 ['Petugas boleh mengubah semua keberatan substantif menjadi permintaan informasi agar cepat selesai.','Pelabelan ulang untuk menghindari pemeriksaan menghilangkan fungsi koreksi.'],
 ['Pemisahan jalur berarti pemohon tidak lagi perlu memperoleh alasan keputusan.','Kebutuhan penjelasan tetap ada pada kedua jenis layanan.'],
 ['Pengawasan petugas berbeda harus dihapus setelah waktu pelayanan menurun.','Perbaikan kecepatan belum menjadi alasan menghilangkan pemeriksaan independen.']],conclusion:'Efisiensi dan pertanggungjawaban dapat diperbaiki bersama melalui pembedaan kebutuhan serta pengawasan yang tetap tersedia.'}
]),
];

export const EXTRA_TKP:CaseModel[]=[
tkp('prof-serah-terima','Profesionalisme','Menjaga kesinambungan pekerjaan melalui serah terima yang dapat digunakan.','Anda akan pindah unit ketika sebuah pekerjaan masih berlangsung.','Nilai apakah penerima benar-benar dapat melanjutkan pekerjaan.',[
 {fact:'Pengganti sudah ditunjuk dan tersedia satu hari untuk serah terima. Berkas tersebar pada beberapa folder; dua keputusan masih menunggu konfirmasi mitra.',choices:[
 ['Menelusuri alurnya bersama pengganti, melengkapi catatan keputusan tertunda, dan menguji aksesnya.','Selain menyerahkan informasi, langkah ini menguji kesiapan penerima untuk melanjutkan pekerjaan.'],
 ['Merapikan berkas serta mengirim daftar keputusan tertunda dan kontak mitra kepada pengganti.','Dokumentasi sudah berguna, tetapi kesempatan memastikan pemahaman dan akses belum dipakai.'],
 ['Menjelaskan perkembangan secara lisan dan menawarkan diri dihubungi setelah pindah.','Penjelasan membantu, tetapi ketergantungan pada ingatan dan ketersediaan Anda tetap besar.'],
 ['Mengirim seluruh folder agar pengganti mempelajari sendiri urutannya.','Bahan tersedia, namun keputusan tertunda dan alur kerja belum terlihat jelas.'],
 ['Menyelesaikan pekerjaan yang mudah saja lalu menyerahkan sisanya tanpa catatan.','Pekerjaan yang justru memerlukan perhatian tidak memperoleh konteks yang memadai.']],conclusion:'Serah terima yang kuat menggabungkan peta status, akses, dan konfirmasi pemahaman penerima.'},
 {fact:'Pengganti baru bergabung setelah Anda pindah. Penanggung jawab sementara sudah ditunjuk, dan Anda tidak akan memiliki akses sistem lama.',choices:[
 ['Mendokumentasikan status dan panduan, lalu meminta penanggung jawab sementara menguji serah terima sebelum akses berakhir.','Verifikasi dilakukan oleh pihak yang tersedia dan berwenang sehingga tidak bergantung pada akses Anda nanti.'],
 ['Menulis catatan perkembangan pekerjaan berikut daftar keputusan tertunda, lalu mengirimkannya kepada penanggung jawab sementara untuk diteruskan kepada pengganti.','Bahan diteruskan melalui pihak tepat, tetapi belum dipastikan dapat digunakan sebelum Anda pergi.'],
 ['Merekam penjelasan umum pekerjaan dan meninggalkan kontak pribadi.','Orientasi terbantu, tetapi status keputusan serta akses belum ditangani secara terstruktur.'],
 ['Menunggu nama pengganti definitif agar dokumentasi ditulis sesuai kebutuhannya.','Penundaan melewatkan kesempatan ketika Anda masih memiliki akses.'],
 ['Menyalin seluruh berkas ke akun pribadi agar tetap bisa mengurusnya setelah pindah.','Cara ini memindahkan penguasaan berkas tanpa dasar kewenangan yang dinyatakan.']],conclusion:'Ketika penerima akhir belum tersedia, serah terima tetap dapat diverifikasi melalui penanggung jawab sementara.'}
]),
tkp('prof-kesalahan-rekan','Profesionalisme','Memberi umpan balik yang spesifik sambil menjaga mutu hasil bersama.','Anda memeriksa bahan presentasi yang dibuat rekan.','Perhatikan tenggat, bukti kesalahan, dan kesempatan belajar.',[
 {fact:'Satu grafik memakai penyebut yang salah. Presentasi berlangsung tiga hari lagi. Rekan terbuka menerima masukan dan masih dapat merevisi sendiri.',choices:[
 ['Membahas perhitungan secara pribadi, meminta rekan merevisi, lalu memeriksa kembali hasilnya bersama.','Kesalahan diperbaiki sekaligus memberi kesempatan memahami sumbernya sebelum pemeriksaan akhir.'],
 ['Menunjukkan sel yang salah dan meminta rekan mengirim grafik yang telah diperbaiki.','Umpan balik spesifik membantu koreksi, tetapi penelusuran penyebab belum sejelas pilihan terbaik.'],
 ['Memperbaiki grafik sendiri lalu memberitahukan bahwa ada perhitungan yang diubah.','Hasil dapat benar, tetapi pemahaman dan tanggung jawab pembuat kurang dikembangkan.'],
 ['Menyarankan rekan lebih teliti tanpa menunjukkan bagian yang keliru.','Pesan umum sulit ditindaklanjuti dan belum melindungi hasil presentasi.'],
 ['Menyampaikan kesalahan di grup besar agar semua orang mengetahui siapa pembuat grafik.','Paparan pribadi tidak diperlukan untuk koreksi dan dapat menghambat kerja sama.']],conclusion:'Dengan waktu cukup, umpan balik spesifik dan pemeriksaan revisi memperbaiki hasil serta kemampuan rekan.'},
 {fact:'Presentasi dimulai sepuluh menit lagi, rekan sedang tidak dapat dihubungi, dan Anda berwenang menyunting bahan. Nilai yang benar sudah diverifikasi dengan sumbernya.',choices:[
 ['Memperbaiki grafik dengan catatan perubahan, memberi tahu pembicara, dan menjadwalkan pembahasan dengan rekan sesudahnya.','Risiko segera ditangani tanpa kehilangan keterlacakan dan kesempatan belajar setelah acara.'],
 ['Memperbaiki grafik menggunakan nilai yang telah diverifikasi, menyimpan bahan yang sudah benar, dan segera memberi tahu pembicara sebelum presentasi dimulai.','Mutu presentasi terlindungi, tetapi penelusuran penyebab bersama pembuat belum direncanakan.'],
 ['Menghapus grafik dan meminta pembicara menjelaskan temuan secara umum.','Risiko angka salah berkurang, tetapi informasi benar yang sudah tersedia tidak dimanfaatkan.'],
 ['Menampilkan grafik lama disertai catatan bahwa angkanya mungkin keliru.','Peringatan belum cukup ketika kesalahan dan koreksi sudah diketahui.'],
 ['Membiarkan grafik agar rekan tetap bertanggung jawab atas kesalahannya sendiri.','Tanggung jawab tim tidak dipenuhi dengan membiarkan informasi salah digunakan.']],conclusion:'Urgensi dan kewenangan memungkinkan koreksi segera, diikuti penjelasan serta pembelajaran.'}
]),
tkp('prof-permintaan-lisan','Profesionalisme','Menyelaraskan hasil kerja dengan kebutuhan tanpa kehilangan kepastian ruang lingkup.','Anda menyusun ringkasan kajian untuk rapat pimpinan.','Konfirmasi keluaran yang berubah sebelum menghabiskan waktu.',[
 {fact:'Dua koordinator memberi arahan lisan berbeda tentang sasaran pembaca. Tenggat masih dua hari dan keduanya bisa dihubungi.',choices:[
 ['Mengusulkan keluaran berdasarkan tujuan rapat dan merangkum kesepakatan kedua koordinator secara tertulis.','Perbedaan diselesaikan pada tujuan dan keputusan bersama sehingga revisi berulang dapat dicegah.'],
 ['Menghubungi kedua koordinator untuk meminta kesepakatan tentang sasaran pembaca sebelum melanjutkan.','Konfirmasi tepat, tetapi belum membantu mereka membandingkan pilihan keluaran.'],
 ['Menyusun dua versi lengkap agar masing-masing koordinator memperoleh keinginannya.','Kebutuhan diakomodasi, tetapi ada pekerjaan ganda yang belum terbukti diperlukan.'],
 ['Mengikuti arahan koordinator yang terakhir berbicara.','Urutan waktu tidak menyelesaikan pertentangan tujuan.'],
 ['Menunda seluruh pekerjaan sampai salah satu koordinator menghubungi Anda lagi.','Tidak ada upaya aktif memperjelas kebutuhan meskipun saluran tersedia.']],conclusion:'Profesionalisme mencakup mengelola ketidakjelasan kebutuhan, bukan sekadar cepat menghasilkan dokumen.'},
 {fact:'Kesepakatan tertulis sudah menetapkan ringkasan dua halaman untuk pengambil keputusan. Menjelang tenggat, seorang rekan meminta lampiran teknis panjang yang tidak diminta dalam rapat.',choices:[
 ['Menuntaskan ringkasan sesuai kesepakatan dan menyertakan tautan bahan teknis yang relevan.','Keluaran utama terlindungi sementara kebutuhan tambahan dilayani secara proporsional.'],
 ['Menyelesaikan ringkasan terlebih dahulu dan membicarakan lampiran setelah tenggat.','Prioritas tepat, tetapi sumber teknis yang tersedia belum dimanfaatkan untuk membantu.'],
 ['Menambahkan lampiran singkat sejauh masih memungkinkan tanpa mengonfirmasi kegunaannya.','Masih menjaga tenggat, tetapi menambah pekerjaan yang relevansinya belum jelas.'],
 ['Mengubah ringkasan menjadi laporan panjang agar dianggap lebih lengkap.','Kelengkapan teknis mengorbankan format yang sudah disepakati untuk pembaca.'],
 ['Menghentikan penyusunan karena permintaan rekan dianggap membatalkan kesepakatan.','Rekan tidak dinyatakan memiliki kewenangan membatalkan keluaran yang telah disepakati.']],conclusion:'Permintaan tambahan dinilai terhadap tujuan dan tenggat, dengan alternatif bantuan yang tidak merusak keluaran utama.'}
]),
tkp('prof-janji-mitra','Profesionalisme','Menyampaikan estimasi secara jujur dan mengelola ketergantungan pekerjaan.','Anda menjadi penghubung penyelesaian laporan bersama.','Pisahkan hal yang bisa Anda pastikan dari ketergantungan pihak lain.',[
 {fact:'Sebagian data mitra belum masuk. Pimpinan meminta kepastian selesai besok, tetapi mitra baru dapat memberi estimasi setelah pemeriksaan sore ini.',choices:[
 ['Menyampaikan risiko dan jadwal pembaruan sore ini sambil menuntaskan bagian mandiri.','Ketidakpastian dinyatakan dengan rencana kerja dan titik pembaruan yang konkret.'],
 ['Mengatakan tenggat masih bergantung pada data mitra dan berjanji memberi kabar sore ini.','Informasi jujur, tetapi kemajuan pada bagian yang bisa dikerjakan belum dioptimalkan.'],
 ['Menyampaikan perkiraan awal dengan catatan bahwa waktunya dapat berubah.','Ketidakpastian disebut, tetapi belum didasarkan pada informasi mitra yang segera tersedia.'],
 ['Menjanjikan selesai besok agar tim terdorong bekerja lebih cepat.','Janji tidak didukung kendali atas data yang dibutuhkan.'],
 ['Tidak menjawab permintaan sampai semua data lengkap.','Pimpinan kehilangan informasi untuk mengelola rencana yang bergantung pada laporan.']],conclusion:'Estimasi yang berguna menyebut batas kepastian, langkah yang tetap berjalan, dan kapan informasi diperbarui.'},
 {fact:'Mitra memastikan data lengkap baru tersedia minggu depan. Rapat besok hanya memerlukan tiga indikator yang sudah diverifikasi. Laporan final tetap memerlukan seluruh data.',choices:[
 ['Menawarkan ringkasan sementara tiga indikator dengan batas cakupan yang jelas dan jadwal laporan final setelah data lengkap.','Kebutuhan rapat dipenuhi tanpa menyamarkan keluaran sementara sebagai laporan final.'],
 ['Mengirim tiga indikator terverifikasi dengan keterangan bahwa data lain menyusul.','Informasi relevan tersedia, tetapi jadwal dan status keluaran akhir belum cukup tegas.'],
 ['Meminta rapat ditunda sampai laporan final dapat dibuat.','Kelengkapan dijaga, tetapi kebutuhan rapat sebenarnya sudah dapat dilayani sebagian.'],
 ['Mengisi data yang belum masuk dengan angka periode lalu tanpa pembeda.','Perbedaan periode menjadi tersembunyi sehingga pembaca dapat menarik kesimpulan salah.'],
 ['Menyatakan laporan selesai karena tiga indikator sudah cukup untuk rapat.','Kebutuhan rapat tidak mengubah definisi kelengkapan laporan final.']],conclusion:'Keluaran antara dapat digunakan bila cakupan, status, dan tindak lanjutnya dijelaskan dengan jujur.'}
]),
tkp('prof-perbaikan-proses','Profesionalisme','Menguji perbaikan dengan ukuran keberhasilan dan pengendalian risiko.','Anda menemukan tahapan kerja yang tampaknya menyebabkan antrean dokumen.','Usulan perbaikan perlu bukti, batas uji, dan cara mengevaluasi hasil.',[
 {fact:'Data satu minggu menunjukkan berkas sering menunggu pemeriksaan yang sama dua kali. Anda boleh mengusulkan uji coba, tetapi tidak berwenang menghapus tahapan sendiri.',choices:[
 ['Memetakan fungsi kedua pemeriksaan, mengusulkan uji terbatas beserta ukuran mutu dan waktu, lalu meminta persetujuan penanggung jawab.','Usulan mempertimbangkan fungsi kontrol sebelum mengubah proses dan menyediakan dasar evaluasi.'],
 ['Menyampaikan data antrean selama satu minggu dan titik pemeriksaan berulang kepada penanggung jawab, lalu meminta evaluasi atas perlunya kedua tahapan tersebut.','Masalah didukung bukti, tetapi rancangan perbaikan yang dapat diuji belum disiapkan.'],
 ['Mengumpulkan data beberapa minggu lagi tanpa membahas temuan awal.','Data bertambah, tetapi peluang evaluasi awal yang sudah tersedia ditunda.'],
 ['Melewati salah satu pemeriksaan agar penurunan waktu segera terlihat.','Perubahan melampaui kewenangan dan belum menilai fungsi pengendalian.'],
 ['Meminta petugas pemeriksa bekerja lebih cepat tanpa melihat alur.','Tekanan pribadi tidak menangani penyebab penantian yang telah terindikasi.']],conclusion:'Perbaikan proses harus menjaga tujuan kontrol dan dapat diuji melalui kewenangan yang tepat.'},
 {fact:'Uji coba telah disetujui. Waktu tunggu turun, tetapi tingkat koreksi kesalahan naik dibanding kelompok pembanding. Data dikumpulkan dengan definisi yang sama.',choices:[
 ['Menelaah penyebab kesalahan bersama hasil percepatan, lalu memperbaiki rancangan sebelum perluasan.','Manfaat kecepatan ditimbang bersama mutu sehingga perluasan tidak menyebarkan kelemahan.'],
 ['Menunda perluasan sambil meminta pemeriksaan atas peningkatan kesalahan.','Risiko dijaga, tetapi penyusunan perbaikan dari hasil uji belum aktif dilakukan.'],
 ['Memperpanjang uji tanpa perubahan agar jumlah data semakin besar.','Data tambahan mungkin membantu, tetapi masalah mutu yang terlihat belum ditangani.'],
 ['Melaporkan penurunan waktu saja karena itulah tujuan utama uji coba.','Penghilangan indikator mutu membuat hasil evaluasi tidak lengkap.'],
 ['Memperluas proses segera agar semua unit merasakan percepatan.','Perluasan mendahului penanganan peningkatan kesalahan yang sudah terukur.']],conclusion:'Keberhasilan perbaikan tidak hanya dinilai dari satu indikator yang menguntungkan.'}
]),
tkp('layanan-akses-baca','Pelayanan Publik','Membantu pengguna memahami layanan tanpa mengambil alih keputusan pribadinya.','Anda melayani warga yang kesulitan membaca formulir.','Bantu pemahaman dan verifikasi tanpa mengarahkan pilihan pribadi.',[
 {fact:'Warga meminta Anda membacakan petunjuk dan mencatat jawaban yang ia sebutkan. Pendampingan seperti itu diperbolehkan, dan tersedia tempat yang cukup privat.',choices:[
 ['Mendampingi secara privat dengan petunjuk sederhana, mencatat jawaban warga, dan membacakan ulang untuk konfirmasi.','Bantuan mengatasi hambatan baca sambil menjaga keputusan, akurasi, dan privasi warga.'],
 ['Membacakan petunjuk dan mengisi jawaban yang warga sampaikan di tempat privat.','Bantuan sesuai kebutuhan, tetapi pemeriksaan ulang jawaban belum dilakukan.'],
 ['Memberikan contoh formulir terisi dan menunggu warga menyalinnya.','Contoh dapat membantu, tetapi hambatan membaca masih ada dan jawaban pribadi berisiko tertukar.'],
 ['Meminta warga membawa keluarga pada hari berikutnya meskipun pendampingan tersedia sekarang.','Beban kunjungan tambahan tidak perlu dibebankan ketika bantuan dapat diberikan.'],
 ['Mengisi pilihan yang menurut Anda paling menguntungkan tanpa menanyakannya kepada warga.','Petugas mengambil alih keputusan yang menjadi hak pengguna.']],conclusion:'Pendampingan yang baik menjaga kendali pengguna dan memastikan jawaban yang tercatat benar.'},
 {fact:'Formulir memuat pilihan yang berdampak berbeda pada layanan. Warga berkata, "Pilihkan saja, saya ikut Anda." Petunjuk resmi menjelaskan konsekuensi setiap pilihan.',choices:[
 ['Menjelaskan konsekuensi secara netral, mengecek pemahaman warga, lalu meminta keputusannya.','Pengguna dibantu mengambil keputusan sendiri berdasarkan informasi yang dapat dipahami.'],
 ['Membacakan konsekuensi resmi dan meminta warga menentukan pilihannya.','Informasi dan hak memilih terjaga, tetapi pemahaman belum diperiksa.'],
 ['Menjelaskan pilihan yang paling sering digunakan lalu meminta persetujuan warga.','Ada persetujuan, tetapi popularitas pilihan dapat mengarahkan keputusan tanpa membandingkan kebutuhan.'],
 ['Memilihkan pilihan yang sama dengan warga sebelumnya agar layanan cepat.','Kebutuhan warga belum diperhitungkan dan kendali keputusan diambil alih.'],
 ['Mengakhiri pelayanan karena warga belum mampu memilih sendiri sejak awal.','Hambatan pemahaman belum ditangani dengan bantuan yang tersedia.']],conclusion:'Persetujuan yang bermakna membutuhkan pemahaman atas konsekuensi, bukan sekadar mengikuti pilihan petugas.'}
]),
tkp('layanan-antrean-tutup','Pelayanan Publik','Menjaga kepastian pelayanan pada batas jam kerja tanpa memberi janji yang tidak dapat dipenuhi.','Anda menjaga loket menjelang akhir jam pelayanan.','Bedakan penerimaan permohonan dengan janji penyelesaiannya.',[
 {fact:'Warga sudah mengambil nomor sebelum batas penerimaan. Ketentuan unit menyatakan seluruh nomor tersebut tetap dilayani; rekan pengganti tersedia untuk pergantian petugas.',choices:[
 ['Mengatur pergantian petugas sesuai sisa antrean dan menginformasikan estimasi hingga seluruh nomor terlayani.','Hak layanan dipenuhi bersama pengaturan kapasitas dan kepastian waktu.'],
 ['Tetap melayani seluruh nomor dan menginformasikan bahwa pelayanan dilanjutkan sampai antrean habis.','Komitmen tepat, tetapi kapasitas pengganti dan estimasi belum dikelola.'],
 ['Melayani sebanyak mungkin sendiri tanpa memberi penjelasan waktu tunggu.','Ada usaha melayani, tetapi pengguna tidak mendapat kepastian dan sumber daya tersedia belum digunakan.'],
 ['Meminta seluruh warga kembali besok karena jam kantor hampir berakhir.','Tindakan bertentangan dengan ketentuan untuk nomor yang sudah diterima.'],
 ['Mendahulukan warga yang paling keras memprotes agar suasana tenang.','Urutan pelayanan berubah berdasarkan tekanan, bukan ketentuan antrean.']],conclusion:'Kepastian layanan perlu diwujudkan melalui pengelolaan kapasitas dan informasi yang dapat diandalkan.'},
 {fact:'Warga datang setelah batas penerimaan yang diumumkan. Sistem sudah ditutup dan petugas tidak dapat membuka transaksi baru. Kanal reservasi besok masih tersedia; tidak ada kebutuhan darurat.',choices:[
 ['Menjelaskan keterbatasan transaksi, membantu reservasi besok, dan memeriksa kelengkapan awal agar kunjungan berikutnya efektif.','Batas layanan dijelaskan disertai bantuan konkret yang masih berada dalam kewenangan.'],
 ['Menjelaskan jam penerimaan dan membantu membuat reservasi besok.','Ada solusi yang sah, tetapi kesempatan mencegah kunjungan gagal karena berkas belum dimanfaatkan.'],
 ['Menunjukkan nomor kanal informasi agar warga mencari jadwal sendiri.','Informasi dasar tersedia, tetapi bantuan langsung yang memungkinkan tidak diberikan.'],
 ['Berjanji memasukkan transaksi hari ini walaupun sistem sudah tidak dapat digunakan.','Janji tidak didukung kemampuan operasional.'],
 ['Menyalahkan warga karena tidak membaca jadwal lalu menutup pembicaraan.','Batas waktu dapat ditegakkan tanpa merendahkan pengguna dan menghentikan bantuan.']],conclusion:'Ketika transaksi tidak bisa dilakukan, kualitas layanan terlihat dari alternatif yang jelas dan benar-benar tersedia.'}
]),
tkp('layanan-aduan-berulang','Pelayanan Publik','Mengurangi beban pengguna dengan menelusuri riwayat dan menetapkan tindak lanjut.','Seorang warga menghubungi layanan untuk ketiga kalinya.','Jangan meminta pengguna mengulang informasi yang sudah dapat ditelusuri.',[
 {fact:'Nomor aduan dan dokumen sebelumnya masih tersimpan. Warga belum mendapat kabar; Anda dapat melihat status dan menghubungi petugas penanggung jawab.',choices:[
 ['Menelusuri hambatan bersama penanggung jawab, lalu memberi jadwal pembaruan dan kontak penghubung kepada warga.','Riwayat digunakan untuk tindak lanjut yang terukur tanpa membebani warga mengulang proses.'],
 ['Memeriksa catatan serta status terbaru pada nomor aduan yang sudah ada dan menjelaskan hasil pemeriksaan tersebut kepada warga.','Informasi aktual membantu, tetapi kepastian pembaruan ketika masalah belum selesai masih kurang.'],
 ['Meminta penanggung jawab menghubungi warga tanpa memastikan kapan tindak lanjut dilakukan.','Kasus diarahkan ke pihak tepat, namun perpindahan tanggung jawab belum dapat dilacak pengguna.'],
 ['Membuat nomor aduan baru agar kasus tampil pada antrean terbaru.','Duplikasi dapat memecah riwayat dan tidak menyelesaikan hambatan aduan lama.'],
 ['Meminta warga mengirim semua dokumen lagi sebelum Anda melihat statusnya.','Beban pengulangan tidak diperlukan karena dokumen sudah tersedia.']],conclusion:'Tindak lanjut yang baik menggunakan riwayat serta memberi kepastian pembaruan, bukan memulai ulang tanpa alasan.'},
 {fact:'Catatan menunjukkan aduan sudah dijawab, tetapi dikirim ke alamat kontak yang salah ketik. Anda dapat mengoreksi kontak setelah verifikasi identitas singkat.',choices:[
 ['Mengoreksi kontak terverifikasi, mengirim ulang jawaban, memastikan penerimaan, dan mencatat perbaikannya.','Masalah pengiriman ditangani sampai hasil benar-benar sampai kepada pengguna.'],
 ['Memverifikasi dan mengoreksi kontak lalu mengirim ulang jawaban.','Penyebab langsung diperbaiki, tetapi penerimaan belum dipastikan.'],
 ['Membacakan jawaban melalui telepon dan meminta warga menghubungi kembali bila perlu.','Pengguna mendapat isi jawaban, tetapi data kontak salah tetap dapat mengganggu layanan berikutnya.'],
 ['Menyatakan aduan sudah selesai karena jawaban pernah dikirim.','Status internal tidak mencerminkan apakah pengguna menerima hasil layanan.'],
 ['Menyuruh warga membuat akun baru agar kontaknya tidak lagi bermasalah.','Solusi menambah beban ketika koreksi langsung tersedia.']],conclusion:'Penyelesaian layanan perlu diukur dari informasi yang sampai kepada pengguna, bukan hanya tindakan kirim di sistem.'}
]),
tkp('layanan-biaya','Pelayanan Publik','Memberi penjelasan biaya yang transparan tanpa memanfaatkan ketidaktahuan pengguna.','Warga mempertanyakan jumlah pembayaran layanan.','Jelaskan rincian yang bisa diverifikasi dan pisahkan biaya yang berbeda.',[
 {fact:'Jumlah pada tagihan sesuai tarif yang diumumkan, tetapi warga mengira layanan gratis karena membaca informasi untuk jenis layanan lain. Rincian tarif tersedia di loket.',choices:[
 ['Membandingkan jenis layanan pada informasi warga dengan tagihannya, menjelaskan rincian tarif, dan memberi kesempatan memeriksanya sebelum membayar.','Kesalahpahaman dijelaskan dengan bukti yang dapat diperiksa tanpa menekan keputusan pengguna.'],
 ['Menunjukkan daftar tarif yang berlaku dan menjelaskan jumlah tagihan.','Dasar biaya terbuka, tetapi sumber kebingungan pengguna belum ditelusuri langsung.'],
 ['Meminta rekan menjelaskan tarif karena warga tampak tidak percaya kepada Anda.','Bantuan dapat berguna, tetapi persoalan dapat dijelaskan langsung dengan bukti tersedia.'],
 ['Meminta warga membayar dahulu karena keberatan bisa diajukan setelahnya.','Tekanan pembayaran mendahului penjelasan yang sebenarnya bisa diberikan.'],
 ['Menawarkan biaya tambahan pribadi agar prosesnya tidak perlu diperdebatkan.','Tawaran di luar mekanisme merusak transparansi dan kesetaraan pelayanan.']],conclusion:'Transparansi biaya mencakup pemahaman pengguna, bukan sekadar keberadaan papan tarif.'},
 {fact:'Anda menemukan satu komponen biaya terhitung dua kali. Koreksi harus disahkan supervisor yang sedang berada di kantor; warga belum membayar.',choices:[
 ['Menjelaskan kekeliruan dan menunjukkan koreksi yang disahkan supervisor sebelum warga membayar.','Kesalahan dibuka dan diperbaiki melalui kewenangan yang tersedia sebelum menimbulkan kerugian.'],
 ['Meminta supervisor memeriksa tagihan dan memberi tahu warga untuk menunggu koreksi.','Jalur perbaikan tepat, tetapi penjelasan komponen masalah kepada warga belum jelas.'],
 ['Menunda pembayaran warga sampai sistem diperiksa pada akhir hari.','Kerugian dicegah, tetapi solusi yang tersedia di kantor belum dimanfaatkan segera.'],
 ['Mencoret sendiri biaya tanpa pengesahan agar warga tidak perlu menunggu.','Hasil mungkin benar, tetapi koreksi tidak mengikuti batas kewenangan yang dinyatakan.'],
 ['Menerima pembayaran penuh dan berharap warga tidak menyadari perhitungannya.','Kesalahan yang diketahui dibiarkan merugikan pengguna.']],conclusion:'Kesalahan biaya perlu diperbaiki secara terbuka dengan mekanisme pengesahan yang tersedia.'}
]),
tkp('layanan-hasil-negatif','Pelayanan Publik','Menyampaikan keputusan yang tidak diharapkan dengan alasan dan jalur tindak lanjut yang tepat.','Permohonan warga belum memenuhi persyaratan layanan.','Empati perlu disertai alasan yang spesifik serta langkah yang dapat dilakukan.',[
 {fact:'Satu dokumen belum lengkap dan masih boleh dilengkapi dalam tujuh hari. Warga khawatir seluruh proses harus dimulai kembali.',choices:[
 ['Menjelaskan kekurangan, cara dan tenggat pelengkapan, serta status berkas; kemudian mengonfirmasi pemahaman warga.','Penjelasan mengatasi kecemasan sekaligus memberi langkah operasional yang lengkap.'],
 ['Memberikan daftar dokumen yang belum lengkap dan tenggat pelengkapan secara tertulis, lalu menjelaskan persyaratan setiap dokumen kepada warga.','Informasi utama tersedia, tetapi kepastian status berkas dan pemahaman belum dikonfirmasi.'],
 ['Mengarahkan warga membaca panduan pelengkapan yang tersedia.','Panduan membantu, tetapi kebutuhan penjelasan spesifik belum terjawab langsung.'],
 ['Mengatakan permohonan ditolak tanpa membedakan kekurangan yang masih dapat dilengkapi.','Istilah yang tidak tepat membuat pengguna mengira tidak ada kesempatan tindak lanjut.'],
 ['Meloloskan berkas agar warga tidak kecewa.','Empati tidak membenarkan mengabaikan syarat yang berlaku.']],conclusion:'Kabar yang tidak diharapkan tetap dapat disampaikan dengan kepastian tentang tindakan serta kesempatan yang tersedia.'},
 {fact:'Permohonan telah diputus tidak memenuhi syarat substantif setelah pemeriksaan lengkap. Pengajuan keberatan masih dimungkinkan, tetapi Anda tidak dapat menjanjikan hasilnya.',choices:[
 ['Menjelaskan dasar keputusan dengan bahasa yang tenang dan menunjukkan cara serta tenggat keberatan tanpa menjanjikan perubahan hasil.','Hak tindak lanjut tersedia bersama penjelasan jujur tentang batas kewenangan dan kepastian hasil.'],
 ['Menjelaskan dasar keputusan dan mengarahkan warga ke kanal keberatan resmi.','Alasan dan jalur tersedia, tetapi bantuan mengenai langkah serta tenggat belum lengkap.'],
 ['Meminta supervisor mengulang penjelasan karena warga kecewa.','Dapat membantu bila diperlukan, tetapi belum menunjukkan upaya Anda menjelaskan keputusan.'],
 ['Menjanjikan keputusan berubah jika warga menyampaikan keberatan.','Janji melampaui kepastian yang Anda miliki.'],
 ['Menghindari pembicaraan agar tidak menghadapi kekecewaan warga.','Pengguna kehilangan penjelasan dan kesempatan menggunakan jalur yang tersedia.']],conclusion:'Pelayanan yang baik tidak selalu menghasilkan persetujuan, tetapi harus memberi alasan dan akses tindak lanjut yang benar.'}
]),
];
