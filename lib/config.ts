import type { Difficulty, Mode, Settings, Subtest } from './types';

export const TOPICS: Record<Subtest, string[]> = {
  TWK: ['Nasionalisme', 'Integritas', 'Bela Negara', 'Pilar Negara', 'Bahasa Negara'],
  TIU: ['Verbal', 'Numerik', 'Figural'],
  TKP: ['Pelayanan Publik', 'Jejaring Kerja', 'Sosial Budaya', 'Teknologi Informasi dan Komunikasi', 'Profesionalisme', 'Anti Radikalisme'],
};
export const LABELS: Record<Difficulty, string> = { mudah: 'Mudah', sedang: 'Sedang', sulit: 'Sulit', hots: 'Sulit (label lama)' };
export const PRESET = { TWK: 30, TIU: 35, TKP: 45, SKD: 110 };
export const DESCRIPTIONS: Record<Mode, string> = {
  SKD: 'Paket gabungan TWK, TIU, dan TKP',
  TWK: 'Wawasan kebangsaan dan bahasa Indonesia',
  TIU: 'Penalaran verbal, numerik, dan figural',
  TKP: 'Keputusan dalam situasi kerja dan pelayanan',
};
// Baseline riset pengguna, bukan pernyataan ketentuan resmi CPNS 2027.
export const BASELINE = { counts: { TWK: 30, TIU: 35, TKP: 45 }, duration: 100, rulesYear: 2024 };
export const DEFAULT_SETTINGS: Settings = {
  mode: 'SKD', packages: 1, count: 110, difficulty: 'campuran', topics: [], subtopics: [],
  seed: 'JADIASN-2027', title: 'Latihan SKD CPNS 2027', duration: 100, uniqueAcross: true,
};
export const TKP_SUBTOPICS = [
  ['Pelayanan Publik', 'Konsep Dasar dan Ruang Lingkup'],
  ['Pelayanan Publik', 'Prinsip dan Standar'],
  ['Pelayanan Publik', 'Pelayanan Prima dan Kepuasan'],
  ['Pelayanan Publik', 'Adil, Inklusif, dan Tidak Diskriminatif'],
  ['Pelayanan Publik', 'Pengambilan Keputusan'],
  ['Jejaring Kerja', 'Konsep Dasar dan Prinsip'],
  ['Jejaring Kerja', 'Komunikasi, Koordinasi, dan Berbagi Informasi'],
  ['Jejaring Kerja', 'Kolaborasi dan Penyelesaian Masalah dalam Tim'],
  ['Jejaring Kerja', 'Pengembangan Hubungan Kerja dan Kemitraan Produktif'],
  ['Sosial Budaya', 'Konsep Dasar, Unsur, dan Struktur Sosial Budaya'],
  ['Sosial Budaya', 'Adaptasi dalam Masyarakat Majemuk'],
  ['Sosial Budaya', 'Empati, Kepedulian, dan Harmoni Sosial'],
  ['Sosial Budaya', 'Perubahan Sosial Budaya dan Penyelesaian Konflik'],
  ['Teknologi Informasi dan Komunikasi', 'Konsep Dasar dan Pemanfaatan TIK dalam Pekerjaan'],
  ['Teknologi Informasi dan Komunikasi', 'Adaptasi terhadap Perubahan Teknologi'],
  ['Teknologi Informasi dan Komunikasi', 'Etika, Keamanan, dan Tanggung Jawab Digital'],
  ['Profesionalisme', 'Konsep Dasar, Ciri, dan Etika Profesional'],
  ['Profesionalisme', 'Tanggung Jawab, Akuntabilitas, dan Disiplin Kerja'],
  ['Profesionalisme', 'Kualitas Kinerja, Penyelesaian Masalah, dan Pengembangan Kompetensi'],
  ['Anti Radikalisme', 'Konsep Dasar Anti Radikalisme'],
  ['Anti Radikalisme', 'Ciri-Ciri dan Bentuk Paparan Radikalisme'],
  ['Anti Radikalisme', 'Sikap Pencegahan dan Penolakan terhadap Radikalisme'],
  ['Anti Radikalisme', 'Respons di Lingkungan Kerja, Sosial, dan Digital'],
] as const;
