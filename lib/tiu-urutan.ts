// Urutan dan Peringkat serta Jadwal menurut Panduan Produksi Soal TIU JadiASN (Verbal Analitis). Keduanya memakai mesin yang sama dengan Susunan dan Posisi (lib/tiu-posisi.ts):
// susunan linear satu garis, petunjuk dipilih dari fakta yang benar pada susunan acuan sampai jawaban tunggal pada SEMUA susunan (pemecah brute force), dan pembahasan berasal
// dari penalaran langkah demi langkah yang sama (lib/posisi-deduce.ts, lib/posisi-text.ts): mengalir dari fakta ke akibat ("sehingga", "maka"), "Urutan yang terbentuk adalah ...",
// "Jadi, jawaban yang benar adalah {kunci}.", lalu tabel bernama tebal. Yang berbeda hanya tema: kata hubungan (lebih cepat, nilai lebih tinggi, tiba lebih awal, dijadwalkan sebelum),
// kalimat pembuka, dan bentuk petunjuk. Urutan dan Peringkat: petunjuk dalam satu paragraf (contoh panduan: lomba lari). Jadwal: konteks lalu daftar bernomor "Terdapat beberapa
// informasi sebagai berikut:" (contoh panduan: pengiriman toko), dengan hari bernama sebagai tempat.
import type { Rng } from './rng';
import { DAYS, NAMES, buildPosisi, type PosisiBuild, type PosisiLevel, type Theme } from './tiu-posisi';
import { NUM } from './posisi-text';
import type { Linear } from './posisi-model';

export type UrutanKind = 'peringkat' | 'jadwal';
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const list = (items: string[]) => items.length > 2 ? items.slice(0, -1).join(', ') + ', dan ' + items[items.length - 1] : items.join(' dan ');
// Nama dengan huruf awal berbeda (hindari nama yang mudah tertukar), diurutkan menurut abjad seperti contoh panduan; atau huruf A, B, C, ... dengan peluang `letters`.
const distinct = (pool: readonly string[], count: number, r: Rng, letters: number) => {
  if (r.next() < letters) return { names: Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i)), letters: true };
  const out: string[] = [];
  for (const name of r.shuffle(pool)) if (out.length < count && !out.some((picked) => picked[0] === name[0])) out.push(name);
  return { names: out.sort((a, b) => a.localeCompare(b)), letters: false };
};
// "Enam siswa, yaitu A, B, dan C, <verb>." atau, bila nama berupa huruf, "Terdapat enam siswa (A, B, dan C) <verb>."
const lead = (names: string[], letters: boolean, noun: string, verb: string) => letters ? 'Terdapat ' + NUM[names.length] + ' ' + noun + ' (' + list(names) + ') ' + verb + '.' : cap(NUM[names.length]) + ' ' + noun + ', yaitu ' + list(names) + ', ' + verb + '.';
const days = (count: number) => 'dari hari ' + DAYS[0] + ' sampai hari ' + DAYS[count - 1];

type Spec = { style: Linear; who?: string; labels?: boolean; numbered: boolean; size: Theme['size']; pool: readonly string[]; letters: number; kinds: Theme['kinds']; intro: (names: string[], letters: boolean, r: Rng) => string };
const make = (spec: Spec): Theme => ({
  style: spec.style, who: spec.who, labels: spec.labels, numbered: spec.numbered, size: spec.size,
  names: (count, r) => distinct(spec.pool, count, r, spec.letters), intro: spec.intro, kinds: spec.kinds,
});

const RANK_KINDS: Theme['kinds'] = [
  { kind: 'siapa-posisi', w: { sedang: 3, sulit: 1 } }, { kind: 'posisi-orang', w: { sedang: 2, sulit: 1 } }, { kind: 'siapa-samping', w: { sedang: 2, sulit: 1 } },
  { kind: 'pernyataan', w: { sedang: 0, sulit: 1.5 } }, { kind: 'urutan', w: { sedang: 0, sulit: 3 } },
];
const SCHEDULE_KINDS: Theme['kinds'] = [
  { kind: 'posisi-orang', w: { sedang: 3, sulit: 1.5 } }, { kind: 'siapa-posisi', w: { sedang: 2, sulit: 1 } }, { kind: 'siapa-samping', w: { sedang: 1, sulit: 1 } },
  { kind: 'pernyataan', w: { sedang: 0, sulit: 1.5 } }, { kind: 'urutan', w: { sedang: 0, sulit: 3 } },
];
const RANK_SIZE: Theme['size'] = { sedang: [5, 6], sulit: [6, 7] };
const SCHEDULE_SIZE: Theme['size'] = { sedang: [5], sulit: [5, 6, 6] };
const rank = (style: Linear, noun: string, intro: (r: Rng) => { verb: string; rule: string }): Theme => make({
  style, numbered: false, size: RANK_SIZE, pool: NAMES, letters: 0.15, kinds: RANK_KINDS,
  intro: (names, letters, r) => { const { verb, rule } = intro(r); return lead(names, letters, noun, verb) + ' ' + rule; },
});

export const PERINGKAT: Theme[] = [
  rank('lomba', 'peserta', (r) => ({ verb: 'mengikuti ' + r.pick(['lomba lari', 'lomba renang', 'lomba bersepeda']) + ' di ' + r.pick(['Sekolah Sukamaju', 'SMA Harapan Bangsa', 'Balai Pemuda Kota']), rule: 'Peserta yang finis paling awal berada di posisi pertama, dan tidak ada dua peserta yang finis bersamaan.' })),
  rank('nilai', 'siswa', (r) => ({ verb: 'mengikuti ' + r.pick(['ujian matematika', 'ujian akhir semester', 'tes keterampilan']), rule: 'Hasil ujian diurutkan dari nilai tertinggi (urutan pertama) hingga terendah, dan tidak ada dua siswa yang memperoleh nilai sama.' })),
  rank('datang', 'peserta', (r) => ({ verb: 'tiba di ' + r.pick(['lokasi pelatihan', 'aula pertemuan', 'kantor pusat']) + ' pada hari yang sama', rule: 'Peserta yang tiba paling awal berada di urutan pertama, dan tidak ada dua peserta yang tiba bersamaan.' })),
  rank('tinggi', 'siswa', () => ({ verb: 'diukur tinggi badannya', rule: 'Hasil pengukuran diurutkan dari yang tertinggi (urutan pertama) hingga terendah, dan tidak ada dua siswa yang sama tinggi.' })),
];

const schedule = (style: Linear, who: string, noun: string, pool: readonly string[], letters: number, text: (count: number, r: Rng) => { verb: string; rule: string }): Theme => make({
  style, who, labels: true, numbered: true, size: SCHEDULE_SIZE, pool, letters, kinds: SCHEDULE_KINDS,
  intro: (names, isLetters, r) => { const { verb, rule } = text(names.length, r); return lead(names, isLetters, noun, verb) + ' ' + rule; },
});
const SUBJECTS = ['Matematika', 'Fisika', 'Kimia', 'Biologi', 'Sejarah', 'Geografi', 'Ekonomi', 'Antropologi', 'Informatika', 'Logika', 'Prakarya'];
const COURSES = ['Statistika', 'Akuntansi', 'Manajemen', 'Hukum Bisnis', 'Ekonomi Mikro', 'Kewirausahaan', 'Pemasaran', 'Logistik', 'Auditing', 'Teori Organisasi', 'Dasar Perpajakan'];
const MODULES = ['Etika Pelayanan', 'Kearsipan', 'Manajemen Waktu', 'Pelayanan Prima', 'Tata Naskah', 'Literasi Digital', 'Pengelolaan Anggaran', 'Wawasan Kebangsaan', 'Komunikasi Efektif', 'Statistik Dasar'];
export const JADWAL: Theme[] = [
  schedule('jadwal', 'mata pelajaran', 'mata pelajaran', SUBJECTS, 0.1, (count, r) => ({ verb: 'dijadwalkan untuk dipelajari ' + r.pick(['Rina', 'Andi', 'Dinda', 'Bagas']) + ' ' + days(count), rule: 'Setiap hari hanya ada satu mata pelajaran, dan setiap mata pelajaran dipelajari satu kali.' })),
  schedule('jadwal', 'mata kuliah', 'mata kuliah', COURSES, 0.1, (count) => ({ verb: 'dijadwalkan oleh program studi ' + days(count), rule: 'Setiap hari hanya ada satu mata kuliah, dan setiap mata kuliah diadakan satu kali.' })),
  schedule('jadwal', 'materi', 'materi pelatihan', MODULES, 0.25, (count) => ({ verb: 'diajarkan dalam pelatihan pegawai ' + days(count), rule: 'Setiap hari hanya ada satu materi, dan setiap materi diajarkan satu kali.' })),
  schedule('jadwal', 'orang', 'mahasiswa', NAMES, 0, (count) => ({ verb: 'mempresentasikan tugas kelompok ' + days(count), rule: 'Setiap hari hanya ada satu presentasi, dan setiap mahasiswa tampil satu kali.' })),
];

// Satu butir Urutan dan Peringkat atau Jadwal; tema dipilih acak. Hasilnya sama dengan butir Susunan dan Posisi (proof = model susunan), sehingga kunci dibuktikan ulang oleh pemecah.
export function buildUrutan(kind: UrutanKind, level: PosisiLevel, r: Rng): PosisiBuild {
  const themes = kind === 'peringkat' ? PERINGKAT : JADWAL;
  return buildPosisi(level, r, 'linear', r.pick(themes));
}
